const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const cron = require("node-cron");
const connectDB = require("./config/dbConnect");
const authRoutes = require("./routes/authRoutes.js");
const videoRoutes = require("./routes/videoRoutes");
const userRoutes = require("./routes/userRoutes");
const http = require("http");
const { Server } = require("socket.io");
const User = require("./models/userModel");
const Message = require("./models/messageModel");
const { createInstantMeeting } = require("./utils/zoomMeeting");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Map to store active user connections
const users = new Map();

// Make io and users available to routes
app.set('io', io);
app.set('users', users);

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).json({
    message: "Server is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/user", userRoutes);

app.post("/api/meeting", async (req, res) => {
  const { receiverId } = req.body;
  const senderId = req.user.id;

  try {
    const zoomLink = await createInstantMeeting("Meeting with friend", 60);

    const message = await Message.create({
      senderId,
      receiverId,
      message: zoomLink,
      zoom_meeting: true,
    });

    const receiverSocketId = users.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", {
        senderId,
        message: zoomLink,
      });
    }

    res.status(200).json({ message: "Meeting created successfully", zoomLink });
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ message: "Failed to create meeting" });
  }
});

cron.schedule("*/10 * * * *", async () => {
  try {
    const response = await axios.get(
      "https://preppartner-backend.onrender.com/"
    );
    console.log("Pinged backend:", response.status);
  } catch (error) {
    console.error("Error pinging backend:", error.message);
  }
});

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  if (!userId) {
    console.log("Socket connection rejected: No user ID provided");
    return;
  }

  console.log(`User connected: ${userId} with socket ID: ${socket.id}`);

  try {
    // Update user's online status
    await User.findByIdAndUpdate(userId, { online: true });
    
    // Store the socket ID for this user
    users.set(userId, socket.id);
    
    // Log all connected users for debugging
    console.log("Currently connected users:", Array.from(users.entries()));
  } catch (error) {
    console.error(`Error updating user online status: ${error.message}`);
  }

  // Handle ping event to keep connection alive
  socket.on("ping", () => {
    // Just respond with a pong to keep the connection alive
    socket.emit("pong");
  });

  // Store processed messages to prevent duplicates
  const processedMessages = new Set();

  socket.on("send_message", async ({ senderId, receiverId, message }) => {
    console.log(`Message from ${senderId} to ${receiverId}: ${message}`);
    
    if (!senderId || !receiverId || !message) {
      console.error("Invalid message data:", { senderId, receiverId, message });
      return;
    }
    
    // Generate a unique message ID to prevent duplicates
    const messageId = `${senderId}_${receiverId}_${Date.now()}_${message.substring(0, 10)}`;
    
    // Check if this message was recently processed
    if (processedMessages.has(messageId)) {
      console.log(`Ignoring duplicate message: ${messageId}`);
      return;
    }
    
    // Add to processed messages and limit the set size
    processedMessages.add(messageId);
    if (processedMessages.size > 100) {
      // Remove oldest entries when we have too many
      const iterator = processedMessages.values();
      processedMessages.delete(iterator.next().value);
    }
    
    // Get the receiver's socket ID
    const receiverSocketId = users.get(receiverId);
    console.log(`Looking for receiver ${receiverId}, found socket: ${receiverSocketId || 'not found'}`);
    console.log("All connected users:", Array.from(users.entries()));

    // Send message to receiver if they're online
    if (receiverSocketId) {
      console.log(`Emitting to socket: ${receiverSocketId}`);
      // Using socket.to() instead of io.to() can cause issues with broadcasting
      socket.to(receiverSocketId).emit("receive_message", { senderId, message });
    } else {
      console.log(`Receiver ${receiverId} is not online`);
    }

    try {
      // Save message to database
      const newMessage = await Message.create({ senderId, receiverId, message });
      console.log(`Message saved to database with ID: ${newMessage._id}`);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${userId}`);
    users.delete(userId);
    
    try {
      await User.findByIdAndUpdate(userId, { online: false });
    } catch (error) {
      console.error(`Error updating user offline status: ${error.message}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
