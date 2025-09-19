const express = require('express');
const router = express.Router();

// Test routes for development
router.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected (In-Memory MongoDB)',
    services: {
      auth: 'Available',
      clients: 'Available', 
      keywords: 'Available',
      pages: 'Available',
      briefs: 'Available'
    }
  });
});

// Test database connection
router.get('/db-test', async (req, res) => {
  try {
    const Client = require('../models/Client');
    
    // Try to count clients (this will test DB connection)
    const count = await Client.countDocuments();
    
    res.json({
      success: true,
      message: 'Database connection successful',
      clientCount: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

module.exports = router;