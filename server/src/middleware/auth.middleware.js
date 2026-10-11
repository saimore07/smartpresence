const { verifyToken } = require('../utils/jwt');
const Faculty = require('../models/Faculty');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.',
      });
    }

    const decoded = verifyToken(token);
    const faculty = await Faculty.findById(decoded.id).select('-passwordHash').lean();

    if (!faculty) {
      return res.status(401).json({
        success: false,
        message: 'Account not found. Token is invalid.',
      });
    }

    req.user = faculty;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

module.exports = authMiddleware;
