const express = require('express');
const router = express.Router();
const { login } = require('../controller/login');
const verifyToken = require('../controller/verify-token');

// Authentication routes
router.route("/login").post(login);

// Protected routes (add more as needed)
// Example: router.route("/profile").get(verifyToken, getUserProfile);

module.exports = router;