const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const FaceTemplate = require('../models/FaceTemplate');
const faceClient = require('../utils/faceClient');

// POST /api/attendance/recognize-session
// Uploads 1 to 8 classroom photographs, calls AI microservice, returns structured proposed attendance
const recognizeSession = async (req, res, next) => {
  try {
    const { className, subject, date } = req.body;

    if (!className || !subject || !date) {
      return res.status(400).json({
        success: false,
        message: 'Class name, subject, and date are required.',
      });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one classroom photograph must be uploaded for recognition.',
      });
    }

    // 1. Verify students enrolled in this class
    const classStudents = await Student.find({ className: className.trim() }).lean();
    if (classStudents.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No students are enrolled in class "${className}". Please enroll students before taking attendance.`,
      });
    }

    // Build lookup maps
    const studentMapById = new Map();
    const studentMapBySysId = new Map();
    const studentIds = [];
    for (const s of classStudents) {
      studentMapById.set(s._id.toString(), s);
      studentMapBySysId.set(s.studentId, s);
      studentIds.push(s._id);
    }

    // 2. Fetch active biometric templates for authorized students of this class
    const templates = await FaceTemplate.find({
      studentId: { $in: studentIds },
      enrollmentStatus: 'active',
    }).lean();

    const candidates = templates.map((tmpl) => {
      const student = studentMapById.get(tmpl.studentId.toString());
      return {
        student_id: student.studentId,
        name: student.name,
        roll_number: student.rollNumber,
        embedding: tmpl.embedding,
      };
    });

    // 3. Collect classroom image file paths
    const imagePaths = req.files.map((f) => f.path);
    const capturedImageUrls = req.files.map((f) => `/uploads/${f.filename}`);

    // 4. Call AI Face Recognition microservice
    const aiResult = await faceClient.recognizeClassroomGroup(imagePaths, candidates);

    // 5. Structure proposed Present students
    const proposedPresent = [];
    for (const match of aiResult.proposed_present_details || []) {
      const student = studentMapBySysId.get(match.student_id);
      if (student) {
        proposedPresent.push({
          _id: student._id,
          studentId: student.studentId,
          name: student.name,
          rollNumber: student.rollNumber,
          faceImageUrl: student.faceImageUrl,
          status: 'present',
          confidence: match.confidence,
          photoIndex: match.detection_photo_index,
          faceId: match.face_id,
          detectionProvenance: 'auto_matched',
        });
      }
    }

    // Structure proposed Absent students (enrolled class members not detected)
    const presentSysIds = new Set(aiResult.proposed_present_student_ids || []);
    const proposedAbsent = [];
    for (const s of classStudents) {
      if (!presentSysIds.has(s.studentId)) {
        proposedAbsent.push({
          _id: s._id,
          studentId: s.studentId,
          name: s.name,
          rollNumber: s.rollNumber,
          faceImageUrl: s.faceImageUrl,
          status: 'absent',
          confidence: 0,
          detectionProvenance: 'manual_faculty_verified',
        });
      }
    }

    // Natural sort by roll number
    proposedPresent.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
    proposedAbsent.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

    // Structure uncertain matches with candidate details
    const uncertainMatches = (aiResult.uncertain_details || []).map((u) => {
      const student = u.candidate_student_id ? studentMapBySysId.get(u.candidate_student_id) : null;
      return {
        ...u,
        matchedStudent: student
          ? {
              _id: student._id,
              studentId: student.studentId,
              name: student.name,
              rollNumber: student.rollNumber,
              faceImageUrl: student.faceImageUrl,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Classroom photographs analyzed successfully.',
      sessionMeta: {
        className: className.trim(),
        subject: subject.trim(),
        date: date.trim(),
      },
      capturedImageUrls,
      metrics: {
        totalPhotos: req.files.length,
        totalFacesDetected: aiResult.total_faces_detected,
        matchedCount: aiResult.matched_count,
        uncertainCount: aiResult.uncertain_count,
        unknownCount: aiResult.unknown_count,
        processingTimeMs: aiResult.processing_time_ms,
      },
      proposedPresent,
      proposedAbsent,
      uncertainMatches,
      unknownFaces: aiResult.unknown_details || [],
      conflicts: aiResult.conflicts || [],
      allDetections: aiResult.face_detections || [],
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/attendance
// Finalizes confirmed attendance roster in MongoDB
const createAttendance = async (req, res, next) => {
  try {
    let { className, subject, date, students, capturedImageUrls, capturedImageUrl } = req.body;

    if (typeof students === 'string') {
      try {
        students = JSON.parse(students);
      } catch (e) {
        students = [];
      }
    }

    if (typeof capturedImageUrls === 'string') {
      try {
        capturedImageUrls = JSON.parse(capturedImageUrls);
      } catch (e) {
        capturedImageUrls = [];
      }
    }

    if (!className || !subject || !date) {
      return res.status(400).json({
        success: false,
        message: 'Class name, subject, and date are required.',
      });
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student attendance records are required.',
      });
    }

    // Check for duplicate attendance for this class + subject + date
    const existing = await Attendance.findOne({ className, subject, date });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Attendance has already been recorded for this class and subject today.',
      });
    }

    // Handle captured images
    let primaryImageUrl = '';
    let allImageUrls = Array.isArray(capturedImageUrls) ? capturedImageUrls : [];

    if (req.file) {
      primaryImageUrl = `/uploads/${req.file.filename}`;
      if (!allImageUrls.includes(primaryImageUrl)) {
        allImageUrls.push(primaryImageUrl);
      }
    } else if (capturedImageUrl) {
      primaryImageUrl = capturedImageUrl;
    } else if (allImageUrls.length > 0) {
      primaryImageUrl = allImageUrls[0];
    }

    const attendance = await Attendance.create({
      facultyId: req.user._id,
      className,
      subject,
      date,
      capturedImageUrl: primaryImageUrl,
      capturedImageUrls: allImageUrls,
      students: students.map((s) => ({
        studentId: s.studentId,
        status: s.status,
        markedAt: new Date(),
        matchConfidence: s.matchConfidence !== undefined ? s.matchConfidence : 1.0,
        detectionProvenance: s.detectionProvenance || 'manual_faculty_verified',
      })),
    });

    const populated = await Attendance.findById(attendance._id)
      .populate('facultyId', 'name')
      .populate('students.studentId', 'name rollNumber studentId');

    res.status(201).json({
      success: true,
      message: 'Attendance saved successfully.',
      attendance: populated,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance
const getAttendance = async (req, res, next) => {
  try {
    const { className, subject, date, page, limit } = req.query;

    let filter = {};

    if (className) filter.className = className;
    if (subject) filter.subject = subject;
    if (date) filter.date = date;

    let query = Attendance.find(filter)
      .sort({ createdAt: -1 })
      .populate('facultyId', 'name')
      .populate('students.studentId', 'name rollNumber studentId')
      .lean();

    if (limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10));
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const records = await query;

    res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/:id
const getAttendanceById = async (req, res, next) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('facultyId', 'name')
      .populate('students.studentId', 'name rollNumber studentId')
      .lean();

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found.',
      });
    }

    res.status(200).json({
      success: true,
      attendance,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/student/:studentId
const getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const records = await Attendance.find({
      'students.studentId': studentId,
    })
      .sort({ date: -1 })
      .populate('facultyId', 'name')
      .lean();

    const attendance = records.map((record) => {
      const studentEntry = (record.students || []).find(
        (s) => s.studentId && s.studentId.toString() === studentId
      );
      return {
        _id: record._id,
        className: record.className,
        subject: record.subject,
        date: record.date,
        status: studentEntry ? studentEntry.status : 'absent',
        faculty: record.facultyId,
      };
    });

    const totalClasses = attendance.length;
    const presentClasses = attendance.filter((a) => a.status === 'present').length;
    const absentClasses = totalClasses - presentClasses;
    const percentage = totalClasses > 0 ? ((presentClasses / totalClasses) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalClasses,
        presentClasses,
        absentClasses,
        percentage: parseFloat(percentage),
      },
      attendance,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/stats
const getAttendanceStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalStudents, todayRecords, allTimeAgg, totalSessions] = await Promise.all([
      Student.countDocuments(),
      Attendance.find({ date: today }).select('students.status').lean(),
      Attendance.aggregate([
        { $unwind: '$students' },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ['$students.status', 'present'] }, 1, 0] },
            },
          },
        },
      ]),
      Attendance.countDocuments(),
    ]);

    let todayPresent = 0;
    let todayTotal = 0;
    for (let i = 0; i < todayRecords.length; i++) {
      const studs = todayRecords[i].students || [];
      for (let j = 0; j < studs.length; j++) {
        todayTotal++;
        if (studs[j].status === 'present') todayPresent++;
      }
    }

    const allPresent = allTimeAgg.length > 0 ? allTimeAgg[0].present : 0;
    const allTotal = allTimeAgg.length > 0 ? allTimeAgg[0].total : 0;
    const averageAttendance = allTotal > 0 ? ((allPresent / allTotal) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        todaySessions: todayRecords.length,
        todayPresent,
        todayTotal,
        averageAttendance: parseFloat(averageAttendance),
        totalSessions,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recognizeSession,
  createAttendance,
  getAttendance,
  getAttendanceById,
  getStudentAttendance,
  getAttendanceStats,
};
