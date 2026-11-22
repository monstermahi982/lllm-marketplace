const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_jwt_key_marketplace_2026');

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token: User not found.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Account is blocked. Please contact platform administrator.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed. Invalid or expired token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Access denied for role '${req.user ? req.user.role : 'anonymous'}'. Required: ${roles.join(', ')}`,
      });
    }
    next();
  };
};

const requireApproved = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.user.status !== 'approved') {
    return res.status(403).json({
      message: `Your account status is '${req.user.status}'. You must be approved by the admin to perform this action.`,
    });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  requireApproved,
};
