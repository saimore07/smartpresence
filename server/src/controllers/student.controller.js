const Student = require('../models/Student');
const FaceTemplate = require('../models/FaceTemplate');
const faceClient = require('../utils/faceClient');
const { validateRequired } = require('../utils/validation');
const path = require('path');
const fs = require('fs');

// POST /api/students
const createStudent = async (req, res, next) => {
  let uploadedFilePath = null;
  try {
    const { name, studentId, rollNumber, email, department, className, year } = req.body;

    // Validate required fields
    const missing = validateRequired({ name, studentId, rollNumber, department, className, year });
    if (missing.length > 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Check for duplicate student ID
    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        success: false,
        message: 'A student with this Student ID already exists.',
      });
    }

    // Check for duplicate roll number within the same class
    const existingRoll = await Student.findOne({ rollNumber, className });
    if (existingRoll) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        success: false,
        message: 'A student with this roll number already exists in this class.',
      });
    }

    let faceImageUrl = '';
    let enrollmentStatus = 'not_enrolled';
    let enrollmentResult = null;

    if (req.file) {
      uploadedFilePath = req.file.path;
      faceImageUrl = `/uploads/${req.file.filename}`;

      // Call AI face recognition microservice for biometric template extraction
      try {
        enrollmentResult = await faceClient.enrollStudentFace(studentId, uploadedFilePath);
        enrollmentStatus = 'enrolled';
      } catch (faceErr) {
        // Clean up uploaded file if biometric validation fails
        if (fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }
        return res.status(400).json({
          success: false,
          message: faceErr.message || 'Face validation failed for the uploaded portrait.',
        });
      }
    }

    const student = await Student.create({
      name,
      studentId,
      rollNumber,
      email: email || '',
      department,
      className,
      year,
      faceImageUrl,
      faceEnrollmentStatus: enrollmentStatus,
      createdBy: req.user._id,
    });

    // If biometric template was successfully generated, persist to FaceTemplate collection
    if (enrollmentResult && enrollmentResult.embedding) {
      await FaceTemplate.create({
        studentId: student._id,
        modelIdentifier: enrollmentResult.model_identifier || 'opencv_yunet_sface_v1',
        embedding: enrollmentResult.embedding,
        qualityScore: enrollmentResult.quality_score || 0.0,
        enrollmentStatus: 'active',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Student enrolled successfully.',
      student,
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlink(uploadedFilePath, () => {});
    }
    next(error);
  }
};

// GET /api/students
const getStudents = async (req, res, next) => {
  try {
    const { search, className, department, page, limit } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }

    if (className) {
      filter.className = className;
    }

    if (department) {
      filter.department = department;
    }

    let query = Student.find(filter)
      .sort({ name: 1 })
      .populate('createdBy', 'name')
      .lean();

    if (limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10));
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const students = await query;

    res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/students/:id
const getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('createdBy', 'name')
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    const faceTemplate = await FaceTemplate.findOne({ studentId: student._id })
      .select('modelIdentifier qualityScore enrollmentStatus createdAt updatedAt')
      .lean();

    res.status(200).json({
      success: true,
      student: {
        ...student,
        faceTemplate: faceTemplate || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/students/:id
const updateStudent = async (req, res, next) => {
  try {
    const { name, email, department, className, year } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    if (name) student.name = name;
    if (email !== undefined) student.email = email;
    if (department) student.department = department;
    if (className) student.className = className;
    if (year) student.year = year;

    // Handle new face image
    if (req.file) {
      try {
        const enrollmentResult = await faceClient.enrollStudentFace(student.studentId, req.file.path);

        // Delete old image file if it exists
        if (student.faceImageUrl) {
          const oldPath = path.join(__dirname, '..', '..', student.faceImageUrl);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }

        student.faceImageUrl = `/uploads/${req.file.filename}`;
        student.faceEnrollmentStatus = 'enrolled';

        // Upsert face template
        await FaceTemplate.findOneAndUpdate(
          { studentId: student._id },
          {
            modelIdentifier: enrollmentResult.model_identifier || 'opencv_yunet_sface_v1',
            embedding: enrollmentResult.embedding,
            qualityScore: enrollmentResult.quality_score || 0.0,
            enrollmentStatus: 'active',
            updatedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (faceErr) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: faceErr.message || 'Face validation failed for the updated portrait.',
        });
      }
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student updated successfully.',
      student,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/students/:id
const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    // Delete image file
    if (student.faceImageUrl) {
      const imagePath = path.join(__dirname, '..', '..', student.faceImageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete student and associated biometric template
    await Promise.all([
      Student.findByIdAndDelete(req.params.id),
      FaceTemplate.deleteMany({ studentId: req.params.id }),
    ]);

    res.status(200).json({
      success: true,
      message: 'Student and biometric templates deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/students/:id/face-template
const deleteFaceTemplate = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    // Delete face template record
    await FaceTemplate.deleteMany({ studentId: student._id });

    // Clean up photo on disk
    if (student.faceImageUrl) {
      const imgPath = path.join(__dirname, '..', '..', student.faceImageUrl);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    student.faceImageUrl = '';
    student.faceEnrollmentStatus = 'not_enrolled';
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student facial biometric enrollment revoked and deleted.',
      student,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/students/classes
const getClassNames = async (req, res, next) => {
  try {
    const classes = await Student.distinct('className');
    res.status(200).json({
      success: true,
      classes: classes.filter(Boolean).sort(),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/students/portal/lookup?query=...
const portalStudentLookup = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required.',
      });
    }

    const cleanQuery = query.trim();
    const students = await Student.find({
      $or: [
        { studentId: { $regex: cleanQuery, $options: 'i' } },
        { rollNumber: { $regex: cleanQuery, $options: 'i' } },
        { name: { $regex: cleanQuery, $options: 'i' } },
      ],
    })
      .select('name studentId rollNumber className department year faceImageUrl faceEnrollmentStatus')
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      students,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStudent,
  getStudents,
  getStudentById,
  getClassNames,
  updateStudent,
  deleteStudent,
  deleteFaceTemplate,
  portalStudentLookup,
};
