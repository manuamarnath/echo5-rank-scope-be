/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let error = err;
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Log error details
  console.error(`[ERROR] ${req.method} ${req.path} - ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map(val => val.message);
    message = `Validation failed: ${errors.join(', ')}`;
    error = new ApiError(statusCode, message, true, err.stack);
  }

  // Handle Mongoose cast errors (e.g., invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    error = new ApiError(statusCode, message, true, err.stack);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    error = new ApiError(statusCode, message, true, err.stack);
  }

  // Handle token expiration
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
    error = new ApiError(statusCode, message, true, err.stack);
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for ${field}`;
    error = new ApiError(statusCode, message, true, err.stack);
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};

module.exports = {
  ApiError,
  errorHandler
};