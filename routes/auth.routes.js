const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'supersecret_jwt_key_marketplace_2026',
    { expiresIn: '7d' }
  );
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    // Role safety: default to buyer, or allow seller or admin
    let userRole = 'buyer';
    if (role === 'seller' || role === 'admin') {
      userRole = role;
    }

    // Admins are approved immediately, sellers and buyers default to pending
    const status = userRole === 'admin' ? 'approved' : 'pending';

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: userRole,
      status,
    });

    const token = generateToken(user);
    res.status(201).json({
      message: 'Registration successful',
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Your account has been blocked by the admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error during login' });
  }
});

// Current User Profile
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
