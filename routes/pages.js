const express = require('express');
const router = express.Router();

// Example pages route
router.get('/', (req, res) => {
  res.json({ message: 'Pages route' });
});

module.exports = router;
