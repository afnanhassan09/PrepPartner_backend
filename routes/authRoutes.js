const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Reset Password
router.post("/requestResetPassword", authController.requestResetPassword);
router.post("/resetPassword", authController.resetPassword);

module.exports = router;