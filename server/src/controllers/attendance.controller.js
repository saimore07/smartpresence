const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const FaceTemplate = require('../models/FaceTemplate');
const faceClient = require('../utils/faceClient');

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Retrieves the set of subject names authorized for the given user.
 * For Admin, returns null (meaning unconstrained access).
 * For Faculty, returns an array of assigned subject names.
 */
const getAuthorizedSubjectNames = async (user) => {
  if (!user) return [];
  if (user.role === 'admin') return null; // Unrestricted access for Administrators

  const explicitSubjects = Array.isArray(user.assignedSubjects) ? user.assignedSubjects : [];

  // Also query Subject collection where facultyIds contains user._id
  const subjectDocs = await Subject.find({
    $or: [
      { facultyIds: user._id },
      { name: { $in: explicitSubjects } },
    ],
  })
    .select('name')
    .lean();

  const nameSet = new Set([
    ...explicitSubjects.map((s) => s.trim()).filter(Boolean),
    ...subjectDocs.map((s) => s.name.trim()).filter(Boolean),
  ]);

  return Array.from(nameSet);
};

// GET /api/attendance/subjects
// Returns authorized subjects for the logged-in user (Faculty assigned subjects or Admin all subjects)
const getAssignedSubjects = async (req, res, next) => {
  try {
    const authorizedSubjects = await getAuthorizedSubjectNames(req.user);

    if (authorizedSubjects === null) {
      // Administrator: returns all active canonical subjects
      const allSubjects = await Subject.find({ isActive: true })
        .populate('facultyIds', 'name email department facultyId')
        .sort({ name: 1 })
        .lean();

      return res.status(200).json({
        success: true,
        subjects: Array.from(new Set(allSubjects.map((s) => s.name))),
        details: allSubjects,
      });
    }

    // Faculty: return subjects assigned to this faculty member
    const subjectDocs = await Subject.find({
      name: { $in: authorizedSubjects },
      isActive: true,
    })
      .populate('facultyIds', 'name email department facultyId')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      subjects: authorizedSubjects,
      details: subjectDocs,
    });
  } catch (error) {
    next(error);
  }
};

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

    // Enforce faculty-specific subject authorization on backend
    const authorizedSubjects = await getAuthorizedSubjectNames(req.user);
    if (authorizedSubjects !== null) {
      const cleanSubject = subject.trim();
      const isAuthorized = authorizedSubjects.some(
        (s) => s.toLowerCase() === cleanSubject.toLowerCase()
      );
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You are not authorized to take attendance for subject "${cleanSubject}".`,
        });
      }
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one classroom photograph must be uploaded for recognition.',
      });
    }

    // 1. Verify students enrolled in this class (active only)
    const classStudents = await Student.find({ className: className.trim(), isActive: true }).lean();
    if (classStudents.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No active students are enrolled in class "${className}". Please enroll students before taking attendance.`,
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

// Helper to parse and validate 12-hour AM/PM time strings into minutes from midnight (0..1439)
const parse12HourTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
};

// POST /api/attendance
// Finalizes confirmed attendance roster in MongoDB
const createAttendance = async (req, res, next) => {
  try {
    let {
      className,
      subject,
      date,
      startTime,
      endTime,
      sessionSlot,
      students,
      capturedImageUrls,
      capturedImageUrl,
    } = req.body;

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

    const cleanSubject = subject.trim();

    // Enforce faculty-specific subject authorization on backend
    const authorizedSubjects = await getAuthorizedSubjectNames(req.user);
    if (authorizedSubjects !== null) {
      const isAuthorized = authorizedSubjects.some(
        (s) => s.toLowerCase() === cleanSubject.toLowerCase()
      );
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You are not authorized to record attendance for subject "${cleanSubject}".`,
        });
      }
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student attendance records are required.',
      });
    }

    // Validate 12-hour session start and end times if supplied
    let cleanStartTime = startTime ? startTime.trim() : '';
    let cleanEndTime = endTime ? endTime.trim() : '';
    let activeSlot = sessionSlot && sessionSlot.trim() ? sessionSlot.trim() : 'regular';

    if (cleanStartTime || cleanEndTime) {
      if (!cleanStartTime) {
        return res.status(400).json({
          success: false,
          message: 'Session start time is required.',
        });
      }
      if (!cleanEndTime) {
        return res.status(400).json({
          success: false,
          message: 'Session end time is required.',
        });
      }

      const startMinutes = parse12HourTime(cleanStartTime);
      const endMinutes = parse12HourTime(cleanEndTime);

      if (startMinutes === null) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be formatted as 12-hour time with AM/PM (e.g. 09:00 AM).',
        });
      }

      if (endMinutes === null) {
        return res.status(400).json({
          success: false,
          message: 'End time must be formatted as 12-hour time with AM/PM (e.g. 10:00 AM).',
        });
      }

      if (endMinutes <= startMinutes) {
        return res.status(400).json({
          success: false,
          message: 'End time must be later than start time for the class session.',
        });
      }

      activeSlot = `${cleanStartTime} - ${cleanEndTime}`;
    }

    // Check for duplicate attendance for this class + subject + date + sessionSlot
    const existing = await Attendance.findOne({
      className: className.trim(),
      subject: cleanSubject,
      date: date.trim(),
      sessionSlot: activeSlot,
    });

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

    // Always enforce authenticated faculty identity - NEVER trust client-supplied facultyId
    const attendance = await Attendance.create({
      facultyId: req.user._id,
      className: className.trim(),
      subject: cleanSubject,
      date: date.trim(),
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      sessionSlot: activeSlot,
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
      .populate('facultyId', 'name email facultyId')
      .populate('students.studentId', 'firstName lastName name rollNumber studentId');

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
// Returns attendance sessions strictly filtered to authorized subjects for faculty
const getAttendance = async (req, res, next) => {
  try {
    const { className, subject, date, page, limit } = req.query;

    let filter = {};

    const authorizedSubjects = await getAuthorizedSubjectNames(req.user);

    if (authorizedSubjects !== null) {
      // Faculty user: strictly enforce authorized subjects
      if (authorizedSubjects.length === 0) {
        return res.status(200).json({
          success: true,
          count: 0,
          records: [],
        });
      }

      if (subject) {
        const cleanSubject = subject.trim();
        const isAuthorized = authorizedSubjects.some(
          (s) => s.toLowerCase() === cleanSubject.toLowerCase()
        );
        if (!isAuthorized) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are not authorized to view attendance history for subject "${cleanSubject}".`,
          });
        }
        filter.subject = { $regex: new RegExp(`^${escapeRegExp(cleanSubject)}$`, 'i') };
      } else {
        filter.subject = { $in: authorizedSubjects };
      }
    } else if (subject) {
      // Administrator: can filter by requested subject or view all
      filter.subject = subject.trim();
    }

    if (className) filter.className = className.trim();
    if (date) filter.date = date.trim();

    let query = Attendance.find(filter)
      .sort({ createdAt: -1 })
      .populate('facultyId', 'name email facultyId')
      .populate('students.studentId', 'firstName lastName name rollNumber studentId className year department')
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
      .populate('facultyId', 'name email facultyId')
      .populate('students.studentId', 'firstName lastName name rollNumber studentId className year department')
      .lean();

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found.',
      });
    }

    // Enforce faculty-specific subject authorization on backend
    const authorizedSubjects = await getAuthorizedSubjectNames(req.user);
    if (authorizedSubjects !== null) {
      const isAuthorized = authorizedSubjects.some(
        (s) => s.toLowerCase() === (attendance.subject || '').trim().toLowerCase()
      );
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not authorized to view attendance records for this subject.',
        });
      }
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
// Returns a student's attendance history scoped strictly to the authorized subjects for faculty
const getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    let filter = {
      'students.studentId': studentId,
    };

    // If request has authenticated user, enforce role scoping
    if (req.user) {
      const authorizedSubjects = await getAuthorizedSubjectNames(req.user);
      if (authorizedSubjects !== null) {
        filter.subject = { $in: authorizedSubjects };
      }
    }

    const records = await Attendance.find(filter)
      .sort({ date: -1 })
      .populate('facultyId', 'name email facultyId')
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
// Calculates attendance statistics scoped strictly to authorized subjects for faculty
const getAttendanceStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const authorizedSubjects = await getAuthorizedSubjectNames(req.user);

    let sessionFilter = {};
    let todayFilter = { date: today };

    if (authorizedSubjects !== null) {
      if (authorizedSubjects.length === 0) {
        return res.status(200).json({
          success: true,
          stats: {
            totalStudents: 0,
            todaySessions: 0,
            todayPresent: 0,
            todayTotal: 0,
            averageAttendance: 0,
            totalSessions: 0,
            assignedSubjects: [],
          },
        });
      }
      sessionFilter.subject = { $in: authorizedSubjects };
      todayFilter.subject = { $in: authorizedSubjects };
    }

    // Determine relevant class names to accurately count total eligible students
    const distinctClassNames = await Attendance.distinct('className', sessionFilter);
    const studentFilter = { isActive: true };
    if (distinctClassNames && distinctClassNames.length > 0) {
      studentFilter.className = { $in: distinctClassNames };
    }

    const [totalStudents, todayRecords, allTimeAgg, totalSessions] = await Promise.all([
      Student.countDocuments(studentFilter),
      Attendance.find(todayFilter).select('students.status').lean(),
      Attendance.aggregate([
        { $match: sessionFilter },
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
      Attendance.countDocuments(sessionFilter),
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
        assignedSubjects: authorizedSubjects || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper to escape CSV values safely
const escapeCsvField = (val) => {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

// GET /api/attendance/export-csv or /api/attendance/:id/export-csv
// Generates standard CSV file scoped strictly to authorized subjects for faculty
const exportAttendanceCsv = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { className, subject, date } = req.query;

    const authorizedSubjects = await getAuthorizedSubjectNames(req.user);

    let records = [];

    if (id) {
      const single = await Attendance.findById(id)
        .populate('facultyId', 'name')
        .populate('students.studentId', 'name rollNumber studentId className year department')
        .lean();

      if (!single) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found.',
        });
      }

      if (authorizedSubjects !== null) {
        const isAuthorized = authorizedSubjects.some(
          (s) => s.toLowerCase() === (single.subject || '').trim().toLowerCase()
        );
        if (!isAuthorized) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You are not authorized to export attendance records for this subject.',
          });
        }
      }
      records = [single];
    } else {
      let filter = {};

      if (authorizedSubjects !== null) {
        if (authorizedSubjects.length === 0) {
          return res.status(200).send('Student Name,Roll Number,Student ID,Class,Division,Subject Name,Date,Time,Status\r\n');
        }

        if (subject) {
          const cleanSubject = subject.trim();
          const isAuthorized = authorizedSubjects.some(
            (s) => s.toLowerCase() === cleanSubject.toLowerCase()
          );
          if (!isAuthorized) {
            return res.status(403).json({
              success: false,
              message: `Access denied. You are not authorized to export attendance for subject "${cleanSubject}".`,
            });
          }
          filter.subject = { $regex: new RegExp(`^${escapeRegExp(cleanSubject)}$`, 'i') };
        } else {
          filter.subject = { $in: authorizedSubjects };
        }
      } else if (subject) {
        filter.subject = subject.trim();
      }

      if (className) filter.className = className.trim();
      if (date) filter.date = date.trim();

      records = await Attendance.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .populate('facultyId', 'name')
        .populate('students.studentId', 'firstName lastName name rollNumber studentId className year department')
        .lean();
    }

    // Required columns: Student Name, Class, Division, Subject Name, Date, Time, Status
    const headers = [
      'Student Name',
      'Roll Number',
      'Student ID',
      'Class',
      'Division',
      'Subject Name',
      'Date',
      'Time',
      'Status',
    ];

    const rows = [headers.map(escapeCsvField).join(',')];

    records.forEach((record) => {
      const subjectName = record.subject || '';
      const dateStr = record.date || '';

      (record.students || []).forEach((entry) => {
        const student = entry.studentId || {};
        let studentName = student.name;
        if (!studentName && (student.firstName || student.lastName)) {
          studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
        }
        if (!studentName) studentName = 'Unknown';

        const rollNumber = student.rollNumber || '';
        const studentId = student.studentId || '';
        const studentClass = student.year || record.className || '';
        const studentDivision = student.className || record.className || '';
        const status = entry.status === 'present' ? 'Present' : 'Absent';

        const timestamp = entry.markedAt || record.createdAt;
        let timeStr = record.startTime && record.endTime ? `${record.startTime} - ${record.endTime}` : '';
        if (!timeStr && timestamp) {
          try {
            timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          } catch (e) {
            timeStr = '';
          }
        }

        rows.push(
          [
            escapeCsvField(studentName),
            escapeCsvField(rollNumber),
            escapeCsvField(studentId),
            escapeCsvField(studentClass),
            escapeCsvField(studentDivision),
            escapeCsvField(subjectName),
            escapeCsvField(dateStr),
            escapeCsvField(timeStr),
            escapeCsvField(status),
          ].join(',')
        );
      });
    });

    const csvContent = rows.join('\r\n');
    const filename =
      records.length === 1
        ? `attendance-${records[0].className || 'class'}-${records[0].subject || 'subject'}-${records[0].date || 'date'}.csv`.replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          )
        : `attendance-report-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
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
  exportAttendanceCsv,
  getAssignedSubjects,
  getAuthorizedSubjectNames,
};
