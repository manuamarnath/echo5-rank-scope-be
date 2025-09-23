const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const Keyword = require('../models/Keyword');
const Page = require('../models/Page');
const Task = require('../models/Task');
const Brief = require('../models/Brief');
const auth = require('../middleware/auth');

// GET /api/stats - Dashboard statistics (owner/employee only)
router.get('/', auth(['owner', 'employee']), async (req, res) => {
  try {
    const [totalClients, totalKeywords, totalPages, totalTasks, totalBriefs] = await Promise.all([
      Client.countDocuments(),
      Keyword.countDocuments(),
      Page.countDocuments(),
      Task.countDocuments(),
      Brief.countDocuments()
    ]);

    const stats = {
      totalClients,
      totalKeywords,
      totalPages,
      totalTasks,
      totalBriefs,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;