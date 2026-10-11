const express = require('express');
const router = express.Router();
const { facultySignup, login, getMe } = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// POST /api/auth/faculty/signup
router.post('/faculty/signup', facultySignup);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me
router.get('/me', authMiddleware, getMe);

module.exports = router;
