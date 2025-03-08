const multer = require("multer");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGODB_CONNECTION_STRING;
const client = new MongoClient(uri);
const dbName = "PrepPartner_Test2";
const collectionName = "test";
class Bot {
  async getVideo(req, res) {
    try {
      const { station, index } = req.body;
      if (!station) {
        return res.status(400).json({ error: "Station name is required" });
      }

      await client.connect();

      const database = client.db(dbName);
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
  }

  async getPauseVideo(req, res) {
    res.status(200).json({
      url: "https://studyninja.s3.ap-south-1.amazonaws.com/videos/C%3A/Users/nobody/Downloads/pause.mp4",
    });
  }
}
module.exports = new Bot();
