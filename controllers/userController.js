const User = require("../models/userModel");
const Message = require("../models/messageModel");

class UserController {
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.json({ message: "User found", user: user });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  //////////////////////////////////// Friends Functions //////////////////////////////////
  async viewAllOnlinePeople(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const friendRequests = user.friend_requests.map((req) =>
        req.userId.toString()
      );
      const onlineUsers = await User.find({
        online: true,
        _id: { $nin: [...user.friend_list, ...friendRequests, user._id] },
      });
      if (!onlineUsers.length) {
        return res.status(404).json({ message: "No online users found" });
      }
      res.json({ online_users: onlineUsers });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async reqFriendship(req, res) {
    try {
      const user = await User.findById(req.user.id);
      const { friendId } = req.body;
      const friend = await User.findById(friendId);
      if (!friend) {
        return res.status(404).json({ message: "Friend not found" });
      }
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      if (
        user.friend_requests.some(
          (req) => req.userId.toString() === friendId && req.type === "sent"
        )
      ) {
        return res.status(400).json({ message: "Friend request already sent" });
      }
      user.friend_requests.push({ userId: friendId, type: "sent" });
      friend.friend_requests.push({ userId: req.user.id, type: "received" });
      await user.save();
      await friend.save();
      res.json({ message: "Friend request sent successfully" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getAllFriendRequests(req, res) {
    try {
      const user = await User.findById(req.user.id).populate(
        "friend_requests.userId",
        "name"
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const friendRequests = user.friend_requests.map((request) => ({
        userId: request.userId._id,
        name: request.userId.name,
        type: request.type,
        createdAt: request.createdAt,
      }));
      res.json({ friend_requests: friendRequests });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async acceptFriend(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = await User.findById(req.user.id);
      const { friendId, response } = req.body;
      const friend = await User.findById(friendId);
      if (!friend) {
        return res.status(404).json({ message: "Friend not found" });
      }
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      if (response === "yes") {
        if (user.friend_list.includes(friendId)) {
          return res.status(400).json({ message: "User is already a friend" });
        }
        user.friend_list.push(friendId);
        friend.friend_list.push(req.user.id);
      }
      user.friend_requests = user.friend_requests.filter(
        (req) => req.userId.toString() !== friendId
      );
      friend.friend_requests = friend.friend_requests.filter(
        (friendReq) => friendReq.userId.toString() !== req.user.id
      );
      await user.save();
      await friend.save();
      res.json({ message: "Friend request processed successfully" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  async getAllFriends(req, res) {
    try {
      const user = await User.findById(req.user.id).populate(
        "friend_list",
        "name"
      );
      console.log(user);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const friends = user.friend_list.map((friend) => ({
        id: friend._id,
        name: friend.name,
      }));
      res.json({ friends });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  /////////////////////////////////// Chatting Functions //////////////////////////////////
  async getChatsWithUser(req, res) {
    try {
      const userId = req.user.id;
      const { otherUserId } = req.params;
      const messages = await Message.find({
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      }).sort("createdAt");
      res.json(messages);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching messages", error: error });
    }
  }

  async sendMessage(req, res) {
    try {
      const senderId = req.user.id;
      const { receiverId, message, skipEmit } = req.body;

      if (!receiverId || !message) {
        return res.status(400).json({ message: "Receiver ID and message are required" });
      }

      // Check if receiver exists
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({ message: "Receiver not found" });
      }

      // Create and save the message
      const newMessage = await Message.create({
        senderId,
        receiverId,
        message,
      });

      // Only emit from server if skipEmit is not true
      if (!skipEmit) {
        // Get socket.io instance from app.js
        const io = req.app.get('io');
        const users = req.app.get('users');
        
        const receiverSocketId = users.get(receiverId);
        if (receiverSocketId && io) {
          io.to(receiverSocketId).emit("receive_message", {
            senderId,
            message
          });
        }
      }

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Error sending message", error: error.message });
    }
  }

  async getAllContacts(req, res) {
    try {
      const userId = req.user.id;
      const chatUsers = await Message.aggregate([
        { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$senderId", userId] },
                "$receiverId",
                "$senderId",
              ],
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            _id: "$user._id",
            name: "$user.name",
            status: "$user.status",
          },
        },
      ]);
      res.json(chatUsers);
    } catch (error) {
      res.status(500).json({ error: "Error fetching chat users" });
    }
  }

  async createMeetingWithFriend(req, res) {}
}

module.exports = new UserController();
