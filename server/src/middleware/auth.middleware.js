const { verifyToken } = require('../utils/jwt');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

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

    // 1. Admin Role
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id).select('-passwordHash').lean();
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin account not found. Token is invalid.',
        });
      }
      if (admin.isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'Admin account has been deactivated. Please contact support.',
        });
      }
      admin.role = 'admin';
      req.user = admin;
      return next();
    }

    // 2. Student Role
    if (decoded.role === 'student') {
      const student = await Student.findById(decoded.id).select('-passwordHash').lean();
      if (!student) {
        return res.status(401).json({
          success: false,
          message: 'Student account not found. Token is invalid.',
        });
      }
      if (student.isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'Student account has been deactivated. Please contact an administrator.',
        });
      }
      student.role = 'student';
      req.user = student;
      return next();
    }

    // 3. Faculty Role
    if (decoded.role === 'faculty') {
      const faculty = await Faculty.findById(decoded.id).select('-passwordHash').lean();
      if (!faculty) {
        return res.status(401).json({
          success: false,
          message: 'Faculty account not found. Token is invalid.',
        });
      }
      if (faculty.isActive === false) {
        return res.status(403).json({
          success: false,
          message: 'Faculty account has been deactivated. Please contact an administrator.',
        });
      }
      faculty.role = 'faculty';
      req.user = faculty;
      return next();
    }

    // Fallback if role was omitted in legacy token
    const adminFallback = await Admin.findById(decoded.id).select('-passwordHash').lean();
    if (adminFallback && adminFallback.isActive !== false) {
      adminFallback.role = 'admin';
      req.user = adminFallback;
      return next();
    }

    const facultyFallback = await Faculty.findById(decoded.id).select('-passwordHash').lean();
    if (facultyFallback && facultyFallback.isActive !== false) {
      facultyFallback.role = 'faculty';
      req.user = facultyFallback;
      return next();
    }

    const studentFallback = await Student.findById(decoded.id).select('-passwordHash').lean();
    if (studentFallback && studentFallback.isActive !== false) {
      studentFallback.role = 'student';
      req.user = studentFallback;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Account not found or inactive. Token is invalid.',
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

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required.',
    });
  }
  next();
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

const requireAdminOrFaculty = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'faculty')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Faculty or Administrator privileges required.',
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

authMiddleware.requireAdmin = requireAdmin;
authMiddleware.requireFaculty = requireFaculty;
authMiddleware.requireAdminOrFaculty = requireAdminOrFaculty;
authMiddleware.requireStudent = requireStudent;
authMiddleware.requireActiveStudent = requireActiveStudent;

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.requireFaculty = requireFaculty;
module.exports.requireAdminOrFaculty = requireAdminOrFaculty;
module.exports.requireStudent = requireStudent;
module.exports.requireActiveStudent = requireActiveStudent;
