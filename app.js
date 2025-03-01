const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const FormData = require("form-data");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");
const cron = require("node-cron");
dotenv.config();

const app = express();
const upload = multer();

const uri = process.env.MONGODB_CONNECTION_STRING;
const client = new MongoClient(uri);
const dbName = "PrepPartner_Test";
const collectionName = "test";


app.use(cors());

app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).json({
    message: "Server is running",
  });
});

app.post("/api/video", async (req, res) => {
  try {
    const { station, index } = req.body;
    if (!station) {
      return res.status(400).json({ error: "Station name is required" });
    }

    await client.connect();

    const database = client.db("PrepPartner_Test2");
    const collection = database.collection(collectionName);
    const videos = await collection.find({ station }).toArray();

    if (videos.length === 0) {
      return res
        .status(404)
        .json({ error: "No videos found for the given station" });
    }

    return res.json(videos);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
