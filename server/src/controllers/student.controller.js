const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const FaceTemplate = require('../models/FaceTemplate');
const faceClient = require('../utils/faceClient');
const { validateRequired, validateEmail } = require('../utils/validation');

// POST /api/students
// Enrolls a student, creates biometric templates if photo supplied, and provisions login credentials
const createStudent = async (req, res, next) => {
  let uploadedFilePath = null;
  try {
    let { firstName, lastName, name, studentId, rollNumber, email, department, className, year } = req.body;

    // Backward-compatibility: if legacy client passed 'name' only, split safely
    if ((!firstName || !lastName) && name) {
      const parts = name.trim().split(/\s+/);
      if (!firstName) firstName = parts[0] || '';
      if (!lastName) lastName = parts.slice(1).join(' ') || '';
    }

    const cleanFirstName = (firstName || '').trim();
    const cleanLastName = (lastName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanStudentId = (studentId || '').trim();
    const cleanRollNumber = (rollNumber || '').trim();
    const cleanDepartment = (department || '').trim();
    const cleanClassName = (className || '').trim();
    const cleanYear = (year || '').trim();

    // 1. Validate First and Last Name
    if (!cleanFirstName) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: 'First name is required.',
      });
    }
    if (cleanFirstName.length > 50) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: 'First name cannot exceed 50 characters.',
      });
    }

    if (!cleanLastName) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: 'Last name is required.',
      });
    }
    if (cleanLastName.length > 50) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: 'Last name cannot exceed 50 characters.',
      });
    }

    // 2. Validate Compulsory Email
    if (!cleanEmail) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: 'Student email is required.',
      });
    }
    if (!validateEmail(cleanEmail)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    // 3. Validate Remaining Academic Fields
    const missing = validateRequired({
      studentId: cleanStudentId,
      rollNumber: cleanRollNumber,
      department: cleanDepartment,
      className: cleanClassName,
      year: cleanYear,
    });
    if (missing.length > 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // 4. Duplicate Email Check
    const existingEmail = await Student.findOne({ email: cleanEmail });
    if (existingEmail) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // 5. Duplicate Student ID Check
    const existingStudent = await Student.findOne({ studentId: cleanStudentId });
    if (existingStudent) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        success: false,
        message: 'A student with this Student ID already exists.',
      });
    }

    // 6. Duplicate Roll Number Check in same class
    const existingRoll = await Student.findOne({ rollNumber: cleanRollNumber, className: cleanClassName });
    if (existingRoll) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        success: false,
        message: 'A student with this roll number already exists in this class.',
      });
    }

    // 7. Secure Credential Provisioning:
    // Generate cryptographically secure random temporary password and hash with bcrypt
    const temporaryPassword = 'SP@' + crypto.randomBytes(4).toString('hex');
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(temporaryPassword, salt);

    let faceImageUrl = '';
    let enrollmentStatus = 'not_enrolled';
    let enrollmentResult = null;

    if (req.file) {
      uploadedFilePath = req.file.path;
      faceImageUrl = `/uploads/${req.file.filename}`;

      // Call AI face recognition microservice for biometric template extraction
      try {
        enrollmentResult = await faceClient.enrollStudentFace(cleanStudentId, uploadedFilePath);
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
      firstName: cleanFirstName,
      lastName: cleanLastName,
      name: `${cleanFirstName} ${cleanLastName}`.trim(),
      studentId: cleanStudentId,
      rollNumber: cleanRollNumber,
      email: cleanEmail,
      passwordHash,
      mustChangePassword: true,
      role: 'student',
      department: cleanDepartment,
      className: cleanClassName,
      year: cleanYear,
      faceImageUrl,
      faceEnrollmentStatus: enrollmentStatus,
      createdBy: req.user._id,
      creatorModel: req.user.role === 'admin' ? 'Admin' : 'Faculty',
      isActive: true,
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

    const studentJson = student.toJSON();

    res.status(201).json({
      success: true,
      message: 'Student enrolled successfully.',
      student: studentJson,
      activation: {
        email: cleanEmail,
        temporaryPassword,
        mustChangePassword: true,
        instructions: 'Temporary credentials generated. The student must log in using their email and temporary password, then set a permanent password before accessing attendance records.',
      },
    });
  } catch (error) {
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlink(uploadedFilePath, () => {});
    }
    if (error.code === 11000) {
      const key = error.keyPattern ? Object.keys(error.keyPattern)[0] : '';
      if (key === 'email') {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }
      if (key === 'studentId') {
        return res.status(409).json({
          success: false,
          message: 'A student with this Student ID already exists.',
        });
      }
      if (key === 'rollNumber' || (error.message && error.message.includes('rollNumber'))) {
        return res.status(409).json({
          success: false,
          message: 'A student with this roll number already exists in this class.',
        });
      }
      return res.status(409).json({
        success: false,
        message: 'A duplicate record already exists.',
      });
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
      const cleanSearch = search.trim();
      filter.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { firstName: { $regex: cleanSearch, $options: 'i' } },
        { lastName: { $regex: cleanSearch, $options: 'i' } },
        { rollNumber: { $regex: cleanSearch, $options: 'i' } },
        { studentId: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
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

    // Ensure name and full properties are populated
    const formatted = students.map((s) => {
      delete s.passwordHash;
      if (!s.name && (s.firstName || s.lastName)) {
        s.name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
      }
      return s;
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      students: formatted,
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

    delete student.passwordHash;
    if (!student.name && (student.firstName || student.lastName)) {
      student.name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
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
    const { firstName, lastName, name, email, department, className, year } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    if (firstName) student.firstName = firstName.trim();
    if (lastName) student.lastName = lastName.trim();
    if (student.firstName && student.lastName) {
      student.name = `${student.firstName} ${student.lastName}`.trim();
    } else if (name) {
      student.name = name.trim();
    }

    if (email !== undefined && email.trim() !== '') {
      const cleanEmail = email.trim().toLowerCase();
      if (!validateEmail(cleanEmail)) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address.',
        });
      }
      const existingEmail = await Student.findOne({ email: cleanEmail, _id: { $ne: student._id } });
      if (existingEmail) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }
      student.email = cleanEmail;
    }

    if (department) student.department = department.trim();
    if (className) student.className = className.trim();
    if (year) student.year = year.trim();

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
      student: student.toJSON(),
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
      student: student.toJSON(),
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
        { firstName: { $regex: cleanQuery, $options: 'i' } },
        { lastName: { $regex: cleanQuery, $options: 'i' } },
      ],
    })
      .select('firstName lastName name studentId rollNumber className department year faceImageUrl faceEnrollmentStatus')
      .limit(10)
      .lean();

    const formatted = students.map((s) => {
      delete s.passwordHash;
      if (!s.name && (s.firstName || s.lastName)) {
        s.name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
      }
      return s;
    });

    res.status(200).json({
      success: true,
      students: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PROTECTED STUDENT PORTAL / DASHBOARD APIS
// ==========================================

// GET /api/students/me
// Returns current authenticated student's profile (derived strictly from token identity)
const getStudentMe = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user._id).select('-passwordHash').lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found.',
      });
    }

    if (!student.name && (student.firstName || student.lastName)) {
      student.name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/students/attendance/summary
// Calculates subject-wise attendance statistics and overall percentage for authenticated student
const getStudentAttendanceSummary = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user._id).select('-passwordHash').lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found.',
      });
    }

    // 1. Fetch all finalized attendance sessions held for the student's class
    const sessions = await Attendance.find({ className: student.className })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // 2. Calculate each subject independently
    // Denominator rule: all finalized attendance sessions held for this subject in the student's class
    // Numerator rule: session where the student was recorded with status === 'present'
    const subjectMap = new Map();

    for (const session of sessions) {
      const subjectName = session.subject ? session.subject.trim() : 'Unknown Subject';
      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          subject: subjectName,
          total: 0,
          attended: 0,
          sessionIds: new Set(),
        });
      }

      const entry = subjectMap.get(subjectName);
      const sessionIdStr = session._id.toString();

      // Ensure each unique session is counted exactly once
      if (!entry.sessionIds.has(sessionIdStr)) {
        entry.sessionIds.add(sessionIdStr);
        entry.total += 1;

        // Check student presence
        const studentRecord = (session.students || []).find(
          (s) => s.studentId && s.studentId.toString() === student._id.toString()
        );

        if (studentRecord && studentRecord.status === 'present') {
          entry.attended += 1;
        }
      }
    }

    let overallTotal = 0;
    let overallAttended = 0;

    const subjects = Array.from(subjectMap.values()).map((s) => {
      overallTotal += s.total;
      overallAttended += s.attended;
      const percentage = s.total > 0 ? parseFloat(((s.attended / s.total) * 100).toFixed(2)) : 0;
      return {
        subject: s.subject,
        total: s.total,
        attended: s.attended,
        absent: s.total - s.attended,
        percentage,
      };
    });

    subjects.sort((a, b) => a.subject.localeCompare(b.subject));

    // Overall aggregate percentage = (total attended / total eligible held) * 100
    const overallPercentage =
      overallTotal > 0 ? parseFloat(((overallAttended / overallTotal) * 100).toFixed(2)) : 0;

    res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        name: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        email: student.email,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        className: student.className,
        department: student.department,
        year: student.year,
        faceImageUrl: student.faceImageUrl || '',
      },
      overall: {
        totalClasses: overallTotal,
        attendedClasses: overallAttended,
        absentClasses: overallTotal - overallAttended,
        percentage: overallPercentage,
      },
      subjects,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/students/attendance/history
// Returns paginated list of sessions with attendance status for authenticated student
const getStudentAttendanceHistory = async (req, res, next) => {
  try {
    const student = await Student.findById(req.user._id).select('-passwordHash').lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found.',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));

    const totalSessions = await Attendance.countDocuments({ className: student.className });

    const sessions = await Attendance.find({ className: student.className })
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('facultyId', 'name email department')
      .lean();

    const history = sessions.map((session) => {
      const studentRecord = (session.students || []).find(
        (s) => s.studentId && s.studentId.toString() === student._id.toString()
      );

      return {
        _id: session._id,
        subject: session.subject,
        className: session.className,
        date: session.date,
        startTime: session.startTime || '',
        endTime: session.endTime || '',
        sessionSlot: session.sessionSlot || 'regular',
        status: studentRecord ? studentRecord.status : 'absent',
        markedAt: studentRecord ? studentRecord.markedAt : session.createdAt,
        faculty: session.facultyId
          ? {
              name: session.facultyId.name,
              department: session.facultyId.department,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      total: totalSessions,
      page,
      limit,
      history,
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
  getStudentMe,
  getStudentAttendanceSummary,
  getStudentAttendanceHistory,
};
