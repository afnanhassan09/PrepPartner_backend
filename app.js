const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const cron = require("node-cron");
const connectDB = require("./config/dbConnect");
const authRoutes = require("./routes/authRoutes.js");
const videoRoutes = require("./routes/videoRoutes");
const userRoutes = require("./routes/userRoutes");
const http = require('http');
const { Server } = require('socket.io');
const User = require("./models/userModel");
const Message = require("./models/messageModel"); 

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

const users = new Map(); 

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
    if (!userId) return;

    await User.findByIdAndUpdate(userId, { online: true });

    users.set(userId, socket.id);

    socket.on("send_message", async ({ senderId, receiverId, message }) => {
        const receiverSocketId = users.get(receiverId);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("receive_message", { senderId, message });
        }

        try {
            await Message.create({ senderId, receiverId, message });
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    socket.on("disconnect", async () => {
        users.delete(userId);
        await User.findByIdAndUpdate(userId, { online: false });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
