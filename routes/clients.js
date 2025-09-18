const express = require('express');
const router = express.Router();

// Example clients route
router.get('/', (req, res) => {
  res.json({ message: 'Clients route' });
});

module.exports = router;
