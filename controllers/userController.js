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
        { $project: { _id: "$user._id", name: "$user.name" } },
      ]);
      res.json(chatUsers);
    } catch (error) {
      res.status(500).json({ error: "Error fetching chat users" });
    }
  }
}

module.exports = new UserController();
