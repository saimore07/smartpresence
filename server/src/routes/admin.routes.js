const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getFacultyList,
  getFacultyById,
  createFaculty,
  updateFaculty,
  toggleFacultyStatus,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  toggleStudentStatus,
} = require('../controllers/admin.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');

// Protect all admin routes with authentication and strict Admin role check
router.use(authMiddleware);
router.use(requireAdmin);

// Dashboard system stats
router.get('/stats', getAdminStats);

// Faculty Management
router.get('/faculty', getFacultyList);
router.post('/faculty', createFaculty);
router.get('/faculty/:id', getFacultyById);
router.put('/faculty/:id', updateFaculty);
router.patch('/faculty/:id/status', toggleFacultyStatus);

// Subject Management & Faculty Assignments
router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

// Student status toggle (active/inactive)
router.patch('/students/:id/status', toggleStudentStatus);

module.exports = router;
