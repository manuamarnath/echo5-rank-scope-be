require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes (to be implemented)
app.use('/auth', require('./routes/auth'));
app.use('/clients', require('./routes/clients'));
app.use('/keywords', require('./routes/keywords'));
app.use('/pages', require('./routes/pages'));
app.use('/briefs', require('./routes/briefs'));

// Error handling middleware (to be implemented)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// MongoDB connection (to be configured)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/echo5';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
