const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Client = require('../models/Client');
const authMiddleware = require('../middleware/auth');

// Input validation middleware
const loginValidation = [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const registerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['owner', 'employee', 'client']).withMessage('Invalid role')
];

// Login route
router.post('/login', loginValidation, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    console.log(`[Auth] Login attempt for email=${email}`);
    
  // Find user by email
  let user = await User.findOne({ email });
    // If caller sets X-Debug-Auth header, return safe diagnostic details (no secrets)
    if (req.headers['x-debug-auth'] === '1') {
      if (!user) {
        console.log(`[Auth] No user found for email=${email} (debug)`);
        return res.status(200).json({ debug: { foundUser: false } });
      }
      console.log(`[Auth] Found user id=${user._id} email=${user.email} role=${user.role} hasPasswordHash=${!!user.passwordHash} (debug)`);
      const isMatchDebug = await bcrypt.compare(password, user.passwordHash);
      return res.status(200).json({
        debug: {
          foundUser: true,
          userId: user._id,
          hasPasswordHash: !!user.passwordHash,
          bcryptCompare: !!isMatchDebug
        }
      });
    }
    if (!user) {
      console.log(`[Auth] No user found for email=${email}`);
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    console.log(`[Auth] Found user id=${user._id} email=${user.email} role=${user.role} hasPasswordHash=${!!user.passwordHash}`);
    
    // Validate password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log(`[Auth] bcrypt.compare result for email=${email}: ${isMatch}`);
    if (!isMatch) {
      console.log(`[Auth] Invalid password for email=${email}`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT payload
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: payload });
      }
    );
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register route
router.post('/register', registerValidation, async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, role } = req.body;
    
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // For new users who need a client, create a default client
    let clientId = null;
    if (role === 'client' || role === 'owner') {
      // Create a default client for this user
      const client = new Client({
        name: `${name}'s Organization`,
        domain: email.split('@')[1] || 'example.com',
        industry: 'General',
        targetLocation: {
          city: 'Not specified',
          state: 'Not specified',
          country: 'Not specified'
        },
        businessInfo: {
          description: 'Default client organization'
        }
      });
      await client.save();
      clientId = client._id;
    }
    
    // Hash password first
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create new user
    user = new User({
      clientId,
      name,
      email,
      passwordHash,
      role: role || 'client',
      status: 'active'
    });
    
    // Save user
    await user.save();
    
    // Create JWT payload
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: payload });
      }
    );
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user route (protected)
router.get('/me', authMiddleware(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
