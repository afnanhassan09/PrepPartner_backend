const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const cron = require("node-cron");
const connectDB = require("./config/dbConnect");
const authRoutes = require("./routes/authRoutes.js");
const videoRoutes = require("./routes/videoRoutes");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).json({
    message: "Server is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/video", videoRoutes);

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
