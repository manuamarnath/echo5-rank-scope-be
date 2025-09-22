require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { connectDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 5001; // Updated port comment

// Security middleware
app.use(helmet()); // Adds various HTTP headers for security

// CORS configuration - allow the deployed frontend origin
const allowedOrigins = [
  'https://echo5-rank-scope-fe-e5i4.vercel.app'
];

// In development we want to allow local frontend dev servers to call the backend
// (e.g. http://localhost:3000). In production we keep the stricter allowlist.
if (process.env.NODE_ENV !== 'production') {
  // Permissive during local development: allow any origin (but keep credentials enabled)
  app.use(cors({ origin: true, credentials: true }));
  console.log('CORS: permissive mode enabled for development');
} else {
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  };
  app.use(cors(corsOptions));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/auth', apiLimiter); // Apply rate limiting to auth routes

// Body parser middleware
app.use(express.json({ limit: '1mb' })); // Limit payload size

// Routes - Standardized with /api prefix for consistency
app.use('/api/auth', require('./routes/auth'));
app.use('/api/audits', require('./routes/audits'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/keywords', require('./routes/keywords'));
app.use('/api/pages', require('./routes/pages'));
app.use('/api/briefs', require('./routes/briefs'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/report', require('./routes/report'));
app.use('/api/test', require('./routes/test'));

// Legacy route support (without /api prefix) - can be removed once frontend is updated
// Legacy route support (without /api prefix) - can be removed once frontend is updated
app.use('/auth', require('./routes/auth'));
app.use('/audits', require('./routes/audits'));
app.use('/clients', require('./routes/clients'));
app.use('/keywords', require('./routes/keywords'));
app.use('/pages', require('./routes/pages'));
app.use('/briefs', require('./routes/briefs'));
app.use('/tasks', require('./routes/tasks'));
app.use('/report', require('./routes/report'));
app.use('/content', require('./routes/content'));

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Additional health endpoint for API route that frontend expects
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Import custom error handler
const { errorHandler } = require('./middleware/errorHandler');

// Error handling middleware
app.use(errorHandler);

// Database connection
connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
