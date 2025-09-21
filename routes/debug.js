const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Quick debug endpoint to inspect owner user and bcrypt result (no validation middleware)
router.post('/auth-check', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ foundUser: false });
    const match = password ? await bcrypt.compare(password, user.passwordHash) : null;
    return res.status(200).json({
      foundUser: true,
      userId: user._id,
      hasPasswordHash: !!user.passwordHash,
      bcryptCompare: match
    });
  } catch (err) {
    console.error('Debug auth-check error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
