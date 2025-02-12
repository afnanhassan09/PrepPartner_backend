const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const FormData = require("form-data");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const cron = require("node-cron"); // Import node-cron
dotenv.config();

const app = express();
const upload = multer();

const uri = process.env.MONGODB_CONNECTION_STRING;
const client = new MongoClient(uri);
const dbName = "PrepPartner_Test";
const collectionName = "test";

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).json({
    message: "Server is running",
  });
});

app.post("/api/video", async (req, res) => {
  try {
    const { station, index } = req.body;
    if (!station || index === undefined) {
      return res
        .status(400)
        .json({ error: "Station name and index are required" });
    }

    await client.connect();
    const database = client.db(dbName);
    const collection = database.collection(collectionName);

    // Fetch all videos for the given station
    const videos = await collection
      .find({ station })
      .sort({ _id: 1 })
      .toArray();

    if (videos.length === 0) {
      return res
        .status(404)
        .json({ error: "No videos found for the given station" });
    }

    if (index >= videos.length) {
      return res.json({
        message: "No more videos available",
        nextIndex: -1,
      });
    }

    const video = videos[index];
    const nextIndex = index + 1 < videos.length ? index + 1 : -1;

    res.json({
      question: video.question,
      url: video.videoLink,
      nextIndex,
    });
  } catch (error) {
    console.error("Error fetching video:", error);
    res.status(500).json({ error: "Failed to fetch video" });
  } finally {
    await client.close();
  }
});

app.get("/api/pause", async (req, res) => {
  res.status(200).json({
    url: "https://studyninja.s3.ap-south-1.amazonaws.com/videos/C%3A/Users/nobody/Downloads/pause.mp4",
  });
});

// Cron job to ping the backend every 10 minutes
cron.schedule("*/10 * * * *", async () => {
  try {
    const response = await axios.get("https://preppartner-backend.onrender.com/");
    console.log("Pinged backend:", response.status);
  } catch (error) {
    console.error("Error pinging backend:", error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
