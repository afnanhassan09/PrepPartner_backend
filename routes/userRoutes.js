const express = require("express");
const userController = require("../controllers/userController");
const auth = require("../middlewares/auth");

const router = express.Router();

// Get all users
router.get("/profile", auth, userController.getProfile);

// get all chats with a user
router.get("/chats/:otherUserId", auth, userController.getChatsWithUser);

// get all contacts
router.get("/contacts", auth, userController.getAllContacts);

module.exports = router;
