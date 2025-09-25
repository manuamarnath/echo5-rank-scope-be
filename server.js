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

// CORS configuration - allow the deployed frontend origin and local dev origins
const deployedFrontend = process.env.FRONTEND_URL || 'https://echo5-rank-scope-fe-e5i4.vercel.app';

// Allowlist includes the deployed frontend and common localhost dev origins
const allowedOrigins = new Set([
  deployedFrontend,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001', // Frontend dev server alternate port
  'http://localhost:5173', // Vite default
  'http://127.0.0.1:5173'
]);

// In development we allow common local dev origins and any origin when explicitly desired
if (process.env.NODE_ENV === 'development') {
  const devCorsOptions = {
    origin: function (origin, callback) {
      // If no origin (server-to-server or curl), allow
      if (!origin) return callback(null, true);
      // Allow if in the allowlist, otherwise fall back to permissive for local dev (but log)
      if (allowedOrigins.has(origin)) return callback(null, true);
      console.log('CORS: allowing development origin:', origin);
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
  app.use(cors(devCorsOptions));
  console.log('CORS: development mode — allowing local dev origins and FRONTEND_URL');
} else {
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
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
app.use('/api/local-opportunities', require('./routes/localOpportunities'));
app.use('/api/queue-health', require('./routes/queueHealth'));

// Development helper to start workers (do not enable in production)
if (process.env.NODE_ENV !== 'production') {
  try {
    // Lazy-load worker runner so it doesn't affect production memory footprint
    require('./workers/runner');
  } catch (err) {
    console.warn('Failed to start workers locally:', err.message || err);
  }
}
app.use('/api/clients', require('./routes/clients'));
app.use('/api/keywords', require('./routes/keywords'));
app.use('/api/keyword-map', require('./routes/keywordMap'));
app.use('/api/blog-ideas', require('./routes/blogIdeas'));
app.use('/api/heatmap', require('./routes/heatmap'));
app.use('/api/pages', require('./routes/pages'));
app.use('/api/briefs', require('./routes/briefs'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/report', require('./routes/report'));
app.use('/api/test', require('./routes/test'));
app.use('/api/analysis', require('./routes/websiteAnalysis'));

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
app.use('/heatmap', require('./routes/heatmap'));

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple ping endpoint for uptime monitoring (lightweight)
app.get('/ping', (req, res) => {
  res.json({ status: 'OK', message: 'Server is alive' });
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
