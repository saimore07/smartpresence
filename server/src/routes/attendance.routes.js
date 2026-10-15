const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  recognizeSession,
  createAttendance,
  getAttendance,
  getAttendanceById,
  getStudentAttendance,
  getAttendanceStats,
  exportAttendanceCsv,
  getAssignedSubjects,
} = require('../controllers/attendance.controller');
const {
  authMiddleware,
  requireFaculty,
  requireAdminOrFaculty,
} = require('../middleware/auth.middleware');

// Multer config for classroom images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'attendance-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

// Student attendance lookup (compatible with student ID check)
router.get('/student/:studentId', getStudentAttendance);

// Protected routes require valid authentication
router.use(authMiddleware);

// Faculty assigned subjects endpoint (also accessible to admin)
router.get('/subjects', requireAdminOrFaculty, getAssignedSubjects);

// Export CSV endpoints (must precede /:id)
router.get('/export-csv', requireAdminOrFaculty, exportAttendanceCsv);
router.get('/:id/export-csv', requireAdminOrFaculty, exportAttendanceCsv);

// Stats must come before :id to avoid route conflict
router.get('/stats', requireAdminOrFaculty, getAttendanceStats);

// Recognition analysis for multiple row photographs (Faculty only)
router.post('/recognize-session', requireFaculty, upload.array('classroomImages', 8), recognizeSession);

// Final confirmation persistence (Faculty only)
router.post('/', requireFaculty, upload.single('classroomImage'), createAttendance);

// Attendance history list and single record
router.get('/', requireAdminOrFaculty, getAttendance);
router.get('/:id', requireAdminOrFaculty, getAttendanceById);

module.exports = router;
