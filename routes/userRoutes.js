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

// Request friendship
router.post("/friend/request", auth, userController.reqFriendship);

// Get all friend requests
router.get("/friend/requests", auth, userController.getAllFriendRequests);

// Accept or reject friend request
router.post("/friend/accept", auth, userController.acceptFriend);

// Get all friends
router.get("/friends", auth, userController.getAllFriends);

module.exports = router;
