const express = require('express');
const router = express.Router();

// Example auth route
router.get('/', (req, res) => {
  res.json({ message: 'Auth route' });
});

module.exports = router;
