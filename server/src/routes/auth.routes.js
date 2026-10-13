const express = require('express');
const router = express.Router();
const {
  facultySignup,
  login,
  studentLogin,
  studentChangePassword,
  getMe,
} = require('../controllers/auth.controller');
const { authMiddleware, requireStudent } = require('../middleware/auth.middleware');

// Faculty authentication
router.post('/faculty/signup', facultySignup);
router.post('/login', login);

// Student authentication
router.post('/student/login', studentLogin);
router.post('/student/change-password', authMiddleware, requireStudent, studentChangePassword);

// Shared authenticated profile endpoint
router.get('/me', authMiddleware, getMe);

module.exports = router;
