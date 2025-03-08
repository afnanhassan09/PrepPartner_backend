const Bot = require("../controllers/videoController");
const express = require("express");
const router = express.Router();

// Get station video
router.post("/station", Bot.getVideo);

// Get pause video

router.get("/pause", Bot.getPauseVideo);

module.exports = router;
