require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./database');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/clients', require('./routes/clients'));
app.use('/keywords', require('./routes/keywords'));
app.use('/pages', require('./routes/pages'));
app.use('/briefs', require('./routes/briefs'));
app.use('/test', require('./routes/test'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Database connection
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
