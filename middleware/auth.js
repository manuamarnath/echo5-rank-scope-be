const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Roles: owner, employee, client
const roles = ['owner', 'employee', 'client'];

function authMiddleware(requiredRoles = roles) {
  return function (req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (!requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden: insufficient role' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = authMiddleware;
