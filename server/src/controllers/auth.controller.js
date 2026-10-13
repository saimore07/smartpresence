const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const bcrypt = require('bcryptjs');
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

// POST /api/auth/login (Faculty Login)
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
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Compare password
    const isMatch = await faculty.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
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

// POST /api/auth/student/login
const studentLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const student = await Student.findOne({ email: cleanEmail });

    // Use generic message to prevent account enumeration
    if (!student || !student.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken({
      id: student._id,
      role: 'student',
      mustChangePassword: student.mustChangePassword,
    });

    const studentJson = student.toJSON();
    studentJson.role = 'student';

    res.status(200).json({
      success: true,
      message: 'Student login successful.',
      token,
      mustChangePassword: student.mustChangePassword,
      user: studentJson,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/student/change-password
const studentChangePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match.',
      });
    }

    const student = await Student.findById(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found.',
      });
    }

    // If an existing password was set, verify oldPassword
    if (student.passwordHash) {
      if (!oldPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required.',
        });
      }
      const isMatch = await student.comparePassword(oldPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }
    }

    if (oldPassword && oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as your current password.',
      });
    }

    const salt = await bcrypt.genSalt(12);
    student.passwordHash = await bcrypt.hash(newPassword, salt);
    student.mustChangePassword = false;
    await student.save();

    // Issue refreshed token without mustChangePassword restriction
    const token = generateToken({
      id: student._id,
      role: 'student',
      mustChangePassword: false,
    });

    const studentJson = student.toJSON();
    studentJson.role = 'student';

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Your account is fully active.',
      token,
      mustChangePassword: false,
      user: studentJson,
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

module.exports = { facultySignup, login, studentLogin, studentChangePassword, getMe };
