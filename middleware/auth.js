const jwt = require('jsonwebtoken');

// Use environment variable with a strong fallback for development only
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Roles: owner, employee, client
const roles = ['owner', 'employee', 'client'];

/**
 * Authentication middleware with role-based access control
 * @param {Array} requiredRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware function
 */
function authMiddleware(requiredRoles = roles) {
  return function (req, res, next) {
    // Check for Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required', 
        message: 'No valid authorization token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      // Verify the token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Check token expiration explicitly
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        return res.status(401).json({ 
          error: 'Token expired', 
          message: 'Your session has expired, please login again' 
        });
      }
      
      // Attach user info to request
      req.user = decoded;
      
      // Check role permissions
      if (!requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'You do not have permission to access this resource' 
        });
      }
      
      next();
    } catch (err) {
      // Handle different JWT errors
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token', 
          message: 'The authentication token is invalid' 
        });
      } else if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired', 
          message: 'Your session has expired, please login again' 
        });
      } else {
        console.error('Auth error:', err);
        return res.status(500).json({ 
          error: 'Authentication error', 
          message: 'An error occurred during authentication' 
        });
      }
    }
  };
}

module.exports = authMiddleware;
