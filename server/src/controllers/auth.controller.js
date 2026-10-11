const Faculty = require('../models/Faculty');
const { generateToken } = require('../utils/jwt');
const { validateEmail, validateRequired } = require('../utils/validation');

// POST /api/auth/faculty/signup
const facultySignup = async (req, res, next) => {
  try {
    const { name, facultyId, email, department, password, confirmPassword } = req.body;

    // Validate required fields
    const missing = validateRequired({ name, facultyId, email, department, password });
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Validate email
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    // Check for existing email
    const existingEmail = await Faculty.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Check for existing faculty ID
    const existingFacultyId = await Faculty.findOne({ facultyId });
    if (existingFacultyId) {
      return res.status(409).json({
        success: false,
        message: 'An account with this Faculty ID already exists.',
      });
    }

    // Create faculty — passwordHash is hashed in the pre-save hook
    const faculty = await Faculty.create({
      name,
      facultyId,
      email: email.toLowerCase(),
      department,
      passwordHash: password,
    });

    const token = generateToken({ id: faculty._id, role: faculty.role });

    res.status(201).json({
      success: true,
      message: 'Faculty account created successfully.',
      token,
      user: faculty,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    // Find faculty
    const faculty = await Faculty.findOne({ email: email.toLowerCase() });
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    // Compare password
    const isMatch = await faculty.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password.',
      });
    }

    const token = generateToken({ id: faculty._id, role: faculty.role });

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: faculty,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { facultySignup, login, getMe };
