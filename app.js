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
const twilio = require("twilio");
const { v4: uuidv4 } = require("uuid");
const auth = require("./middlewares/auth");
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
app.set("io", io);
app.set("users", users);

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

// Twilio configuration
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioApiKey = process.env.TWILIO_API_KEY;
const twilioApiSecret = process.env.TWILIO_API_SECRET;

// Function to generate a Twilio access token
const generateTwilioToken = (identity, roomName) => {
  // Check if all required environment variables are set
  if (!twilioAccountSid || !twilioApiKey || !twilioApiSecret) {
    console.error("Missing Twilio credentials in environment variables");
    throw new Error("Twilio configuration error");
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VideoGrant = AccessToken.VideoGrant;

  // Create a Video grant for this token
  const videoGrant = new VideoGrant({
    room: roomName,
  });

  // Create an access token
  const token = new AccessToken(
    twilioAccountSid,
    twilioApiKey,
    twilioApiSecret,
    { identity: identity }
  );

  // Add the video grant to the token
  token.addGrant(videoGrant);

  // Return the token
  return token.toJwt();
};

// Replace the meeting endpoint with Twilio video call
app.post("/api/meeting", auth, async (req, res) => {
  const { receiverId } = req.body;

  // Make sure we have a valid user object from auth middleware
  if (!req.user || !req.user._id) {
    console.error("Missing user in request", req.user);
    return res.status(401).json({ message: "Authentication failed" });
  }

  const senderId = req.user._id;
  console.log(
    "Creating meeting with senderId:",
    senderId,
    "receiverId:",
    receiverId
  );

  try {
    // Generate a unique room name for this call
    const roomName = `room_${senderId}_${receiverId}_${uuidv4().substring(
      0,
      8
    )}`;

    // Make sure senderId is a string
    const senderIdStr = senderId.toString();
    const receiverIdStr = receiverId.toString();

    // Create a message with the room information
    const message = await Message.create({
      senderId: senderIdStr,
      receiverId: receiverIdStr,
      message: `Video call invitation: ${roomName}`,
      video_call: true,
      room_id: uuidv4(), // Generate a unique ID for this room
      room_name: roomName,
    });

    console.log("Created message for video call:", message);

    // Get the receiver's socket ID
    const receiverSocketId = users.get(receiverId);
    if (receiverSocketId) {
      // Send the message to the receiver
      io.to(receiverSocketId).emit("receive_message", {
        senderId: senderIdStr,
        message: message.message,
        isVideoCall: true,
        roomName: message.room_name,
        roomId: message.room_id,
      });
    }

    res.status(200).json({
      message: "Video call created successfully",
      roomName: message.room_name,
      roomId: message.room_id,
    });
  } catch (error) {
    console.error("Error creating video call:", error);
    res
      .status(500)
      .json({ message: "Failed to create video call: " + error.message });
  }
});

// Add endpoint to generate Twilio token for a specific room
app.post("/api/video/token", auth, async (req, res) => {
  const { roomName } = req.body;

  // Get user ID, handling both id and _id formats
  const userId = req.user._id || req.user.id;

  if (!roomName) {
    return res.status(400).json({ error: "Room name is required" });
  }

  try {
    // Get user details for identity
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate a token for this user and room
    const identity = `${user.name}_${userId}`;
    const token = generateTwilioToken(identity, roomName);

    res.json({ token, identity, roomName });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: "Failed to generate token" });
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
    const messageId = `${senderId}_${receiverId}_${Date.now()}_${message.substring(
      0,
      10
    )}`;

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
    console.log(
      `Looking for receiver ${receiverId}, found socket: ${
        receiverSocketId || "not found"
      }`
    );
    console.log("All connected users:", Array.from(users.entries()));

    // Send message to receiver if they're online
    if (receiverSocketId) {
      console.log(`Emitting to socket: ${receiverSocketId}`);
      // Using socket.to() instead of io.to() can cause issues with broadcasting
      socket
        .to(receiverSocketId)
        .emit("receive_message", { senderId, message });
    } else {
      console.log(`Receiver ${receiverId} is not online`);
    }

    try {
      // Save message to database
      const newMessage = await Message.create({
        senderId,
        receiverId,
        message,
      });
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
