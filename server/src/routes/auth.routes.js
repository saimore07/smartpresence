const express = require('express');
const router = express.Router();
const {
  facultySignup,
  login,
  adminLogin,
  changePassword,
  studentLogin,
  studentChangePassword,
  getMe,
} = require('../controllers/auth.controller');
const { authMiddleware, requireStudent } = require('../middleware/auth.middleware');

// Universal and Role-Specific Login Endpoints
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/faculty/signup', facultySignup);

// Authenticated Password Change
router.post('/change-password', authMiddleware, changePassword);

// Student authentication
router.post('/student/login', studentLogin);
router.post('/student/change-password', authMiddleware, requireStudent, studentChangePassword);

// Shared authenticated profile endpoint
router.get('/me', authMiddleware, getMe);

module.exports = router;
