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
} = require('../controllers/student.controller');
const authMiddleware = require('../middleware/auth.middleware');

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

// Public Student Portal routes (unauthenticated)
router.get('/portal/lookup', portalStudentLookup);
router.get('/portal/:id', getStudentById);

// All faculty administrative routes require authentication
router.use(authMiddleware);

router.post('/', upload.single('faceImage'), createStudent);
router.get('/', getStudents);
router.get('/classes', getClassNames);
router.get('/:id', getStudentById);
router.put('/:id', upload.single('faceImage'), updateStudent);
router.delete('/:id', deleteStudent);
router.delete('/:id/face-template', deleteFaceTemplate);

module.exports = router;
