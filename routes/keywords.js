const express = require('express');
const router = express.Router();

// Example keywords route
router.get('/', (req, res) => {
  res.json({ message: 'Keywords route' });
});

module.exports = router;
