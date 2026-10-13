const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  createStudent,
  getStudents,
  getStudentById,
  getClassNames,
  updateStudent,
  deleteStudent,
  deleteFaceTemplate,
  portalStudentLookup,
  getStudentMe,
  getStudentAttendanceSummary,
  getStudentAttendanceHistory,
} = require('../controllers/student.controller');
const {
  authMiddleware,
  requireFaculty,
  requireStudent,
  requireActiveStudent,
} = require('../middleware/auth.middleware');

// Multer config for student photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'student-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// Public Student Portal lookup routes (legacy search)
router.get('/portal/lookup', portalStudentLookup);
router.get('/portal/:id', getStudentById);

// Authenticated Student routes (strictly scoped to student's own JWT token)
router.get('/me', authMiddleware, requireStudent, getStudentMe);
router.get('/attendance/summary', authMiddleware, requireStudent, requireActiveStudent, getStudentAttendanceSummary);
router.get('/attendance/history', authMiddleware, requireStudent, requireActiveStudent, getStudentAttendanceHistory);

// Faculty administrative routes (strictly protected against student tokens)
router.post('/', authMiddleware, requireFaculty, upload.single('faceImage'), createStudent);
router.get('/', authMiddleware, requireFaculty, getStudents);
router.get('/classes', authMiddleware, requireFaculty, getClassNames);
router.get('/:id', authMiddleware, requireFaculty, getStudentById);
router.put('/:id', authMiddleware, requireFaculty, upload.single('faceImage'), updateStudent);
router.delete('/:id', authMiddleware, requireFaculty, deleteStudent);
router.delete('/:id/face-template', authMiddleware, requireFaculty, deleteFaceTemplate);

module.exports = router;
