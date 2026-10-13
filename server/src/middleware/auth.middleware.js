const { verifyToken } = require('../utils/jwt');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');

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

    if (decoded.role === 'student') {
      const student = await Student.findById(decoded.id).select('-passwordHash').lean();
      if (!student) {
        return res.status(401).json({
          success: false,
          message: 'Student account not found. Token is invalid.',
        });
      }
      student.role = 'student';
      req.user = student;
      return next();
    }

    // Default or faculty role
    const faculty = await Faculty.findById(decoded.id).select('-passwordHash').lean();
    if (faculty) {
      faculty.role = 'faculty';
      req.user = faculty;
      return next();
    }

    // Fallback: check if it belongs to a student when role was omitted
    const studentFallback = await Student.findById(decoded.id).select('-passwordHash').lean();
    if (studentFallback) {
      studentFallback.role = 'student';
      req.user = studentFallback;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Account not found. Token is invalid.',
    });
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

const requireFaculty = (req, res, next) => {
  if (!req.user || req.user.role !== 'faculty') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Faculty privileges required.',
    });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Student privileges required.',
    });
  }
  next();
};

const requireActiveStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Student privileges required.',
    });
  }
  if (req.user.mustChangePassword) {
    return res.status(403).json({
      success: false,
      mustChangePassword: true,
      message: 'Please complete your initial password change before accessing attendance records.',
    });
  }
  next();
};

authMiddleware.requireFaculty = requireFaculty;
authMiddleware.requireStudent = requireStudent;
authMiddleware.requireActiveStudent = requireActiveStudent;

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireFaculty = requireFaculty;
module.exports.requireStudent = requireStudent;
module.exports.requireActiveStudent = requireActiveStudent;

