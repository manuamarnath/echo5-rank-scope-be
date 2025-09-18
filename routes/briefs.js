const express = require('express');
const router = express.Router();

// Example briefs route
router.get('/', (req, res) => {
  res.json({ message: 'Briefs route' });
});

module.exports = router;
