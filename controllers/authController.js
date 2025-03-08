const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

class UserController {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Please enter all fields" });
      }
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, email, password: hashedPassword });
      await user.save();
      res.json({ message: "User registered successfully", user: user });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Failed to register user" });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Please enter all fields" });
      }
      let user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Email does not exist" });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Incorrect password" });
      }
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
      res.json({ message: "Logged in successfully", token });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Failed to login user" });
    }
  }

  async requestResetPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Please enter your email" });
      }
      let user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Email does not exist" });
      }
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000;
      await user.save();

      const resetUrl = `${process.env.FRONTEND_URL}reset-password?token=${resetToken}`;
      const message = `You are receiving this email because you (or someone else) have requested the reset of a password. Please make a put request to: \n\n ${resetUrl}`;

      await sendEmail(email, "Password Reset Request", message);

      res.json({
        message: "Password reset email sent",
        token: resetToken,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Failed to send reset password email" });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Please provide all fields" });
      }
      let user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });
      if (!user) {
        return res
          .status(400)
          .json({ message: "Password reset token is invalid or has expired" });
      }
      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      res.json({ message: "Password has been reset successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  }
}

module.exports = new UserController();
