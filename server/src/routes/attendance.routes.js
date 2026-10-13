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
} = require('../controllers/attendance.controller');
const authMiddleware = require('../middleware/auth.middleware');

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

// Public student attendance check (unauthenticated)
router.get('/student/:studentId', getStudentAttendance);

// All faculty administrative routes require authentication
router.use(authMiddleware);

// Export CSV endpoints (must precede /:id)
router.get('/export-csv', exportAttendanceCsv);
router.get('/:id/export-csv', exportAttendanceCsv);

// Stats must come before :id to avoid route conflict
router.get('/stats', getAttendanceStats);

// Recognition analysis for multiple row photographs
router.post('/recognize-session', upload.array('classroomImages', 8), recognizeSession);

// Final confirmation persistence
router.post('/', upload.single('classroomImage'), createAttendance);
router.get('/', getAttendance);
router.get('/:id', getAttendanceById);

module.exports = router;
