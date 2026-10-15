const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const { validateEmail, validateRequired } = require('../utils/validation');

// GET /api/admin/stats
const getAdminStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalStudents,
      totalFaculty,
      totalSubjects,
      totalSessions,
      todaySessions,
      allTimeAgg,
    ] = await Promise.all([
      Student.countDocuments(),
      Faculty.countDocuments(),
      Subject.countDocuments(),
      Attendance.countDocuments(),
      Attendance.countDocuments({ date: today }),
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
    ]);

    const allPresent = allTimeAgg.length > 0 ? allTimeAgg[0].present : 0;
    const allTotal = allTimeAgg.length > 0 ? allTimeAgg[0].total : 0;
    const averageAttendance = allTotal > 0 ? parseFloat(((allPresent / allTotal) * 100).toFixed(1)) : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalFaculty,
        totalSubjects,
        totalSessions,
        todaySessions,
        averageAttendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/faculty
const getFacultyList = async (req, res, next) => {
  try {
    const { search, department } = req.query;
    let filter = {};

    if (search) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { facultyId: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } },
      ];
    }

    if (department) {
      filter.department = department.trim();
    }

    const faculty = await Faculty.find(filter)
      .select('-passwordHash')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: faculty.length,
      faculty,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/faculty/:id
const getFacultyById = async (req, res, next) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .select('-passwordHash')
      .lean();

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found.',
      });
    }

    res.status(200).json({
      success: true,
      faculty,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/faculty (Create Faculty by Admin)
const createFaculty = async (req, res, next) => {
  try {
    const { name, facultyId, email, department, password, assignedSubjects } = req.body;

    const missing = validateRequired({ name, facultyId, email, department, password });
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const existingEmail = await Faculty.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const cleanFacultyId = facultyId.trim();
    const existingFacultyId = await Faculty.findOne({ facultyId: cleanFacultyId });
    if (existingFacultyId) {
      return res.status(409).json({
        success: false,
        message: 'An account with this Faculty ID already exists.',
      });
    }

    const subjectsArray = Array.isArray(assignedSubjects)
      ? assignedSubjects.map((s) => s.trim()).filter(Boolean)
      : [];

    const faculty = await Faculty.create({
      name: name.trim(),
      facultyId: cleanFacultyId,
      email: cleanEmail,
      department: department.trim(),
      passwordHash: password,
      role: 'faculty',
      assignedSubjects: subjectsArray,
      isActive: true,
    });

    // Sync Subject collection: add this faculty._id to the corresponding subjects
    if (subjectsArray.length > 0) {
      await Subject.updateMany(
        { name: { $in: subjectsArray } },
        { $addToSet: { facultyIds: faculty._id } }
      );
    }

    const facultyJson = faculty.toJSON();

    res.status(201).json({
      success: true,
      message: 'Faculty member registered successfully.',
      faculty: facultyJson,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/faculty/:id (Update Faculty by Admin)
const updateFaculty = async (req, res, next) => {
  try {
    const { name, email, department, assignedSubjects, isActive, password } = req.body;

    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found.',
      });
    }

    if (name) faculty.name = name.trim();
    if (department) faculty.department = department.trim();

    if (email && email.trim() !== '') {
      const cleanEmail = email.toLowerCase().trim();
      if (!validateEmail(cleanEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid email address.',
        });
      }
      const existingEmail = await Faculty.findOne({ email: cleanEmail, _id: { $ne: faculty._id } });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'Another account already uses this email address.',
        });
      }
      faculty.email = cleanEmail;
    }

    if (assignedSubjects !== undefined && Array.isArray(assignedSubjects)) {
      const oldSubjects = faculty.assignedSubjects || [];
      const newSubjects = assignedSubjects.map((s) => s.trim()).filter(Boolean);
      faculty.assignedSubjects = newSubjects;

      // Unassign faculty from removed subjects
      const removedSubjects = oldSubjects.filter((s) => !newSubjects.includes(s));
      if (removedSubjects.length > 0) {
        await Subject.updateMany(
          { name: { $in: removedSubjects } },
          { $pull: { facultyIds: faculty._id } }
        );
      }

      // Assign faculty to new subjects
      if (newSubjects.length > 0) {
        await Subject.updateMany(
          { name: { $in: newSubjects } },
          { $addToSet: { facultyIds: faculty._id } }
        );
      }
    }

    if (isActive !== undefined) {
      faculty.isActive = Boolean(isActive);
    }

    if (password && password.trim().length >= 6) {
      faculty.passwordHash = password.trim();
    }

    await faculty.save();

    res.status(200).json({
      success: true,
      message: 'Faculty member updated successfully.',
      faculty: faculty.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/faculty/:id/status (Toggle Faculty active status)
const toggleFacultyStatus = async (req, res, next) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found.',
      });
    }

    faculty.isActive = !faculty.isActive;
    await faculty.save();

    res.status(200).json({
      success: true,
      message: `Faculty account ${faculty.isActive ? 'activated' : 'deactivated'} successfully.`,
      faculty: faculty.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/subjects
const getSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find()
      .populate('facultyIds', 'name email department facultyId')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: subjects.length,
      subjects,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/subjects (Create Subject and Assign Faculty)
const createSubject = async (req, res, next) => {
  try {
    const { name, code, department, className, facultyIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject name is required.',
      });
    }

    const cleanName = name.trim();
    const cleanClassName = className ? className.trim() : '';

    const existing = await Subject.findOne({ name: cleanName, className: cleanClassName });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Subject "${cleanName}" for class "${cleanClassName || 'All'}" already exists.`,
      });
    }

    const validFacultyIds = Array.isArray(facultyIds) ? facultyIds.filter(Boolean) : [];

    const subject = await Subject.create({
      name: cleanName,
      code: code ? code.trim() : '',
      department: department ? department.trim() : '',
      className: cleanClassName,
      facultyIds: validFacultyIds,
      isActive: true,
    });

    // Also update assignedSubjects on the assigned Faculty models
    if (validFacultyIds.length > 0) {
      await Faculty.updateMany(
        { _id: { $in: validFacultyIds } },
        { $addToSet: { assignedSubjects: cleanName } }
      );
    }

    const populated = await Subject.findById(subject._id)
      .populate('facultyIds', 'name email department facultyId')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Subject created successfully.',
      subject: populated,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/subjects/:id (Update Subject and Faculty Assignments)
const updateSubject = async (req, res, next) => {
  try {
    const { name, code, department, className, facultyIds, isActive } = req.body;

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found.',
      });
    }

    const oldName = subject.name;
    const oldFacultyIds = (subject.facultyIds || []).map((id) => id.toString());

    if (name) subject.name = name.trim();
    if (code !== undefined) subject.code = code.trim();
    if (department !== undefined) subject.department = department.trim();
    if (className !== undefined) subject.className = className.trim();
    if (isActive !== undefined) subject.isActive = Boolean(isActive);

    if (Array.isArray(facultyIds)) {
      subject.facultyIds = facultyIds.filter(Boolean);
    }

    await subject.save();

    const newFacultyIds = (subject.facultyIds || []).map((id) => id.toString());
    const subjectName = subject.name;

    // Remove from unassigned faculty
    const removedFaculty = oldFacultyIds.filter((id) => !newFacultyIds.includes(id));
    if (removedFaculty.length > 0) {
      await Faculty.updateMany(
        { _id: { $in: removedFaculty } },
        { $pull: { assignedSubjects: oldName } }
      );
    }

    // Add to newly assigned faculty
    const addedFaculty = newFacultyIds.filter((id) => !oldFacultyIds.includes(id));
    if (addedFaculty.length > 0) {
      await Faculty.updateMany(
        { _id: { $in: addedFaculty } },
        { $addToSet: { assignedSubjects: subjectName } }
      );
    }

    // If subject name changed, update on existing assigned faculty
    if (oldName !== subjectName) {
      await Faculty.updateMany(
        { _id: { $in: newFacultyIds }, assignedSubjects: oldName },
        { $set: { 'assignedSubjects.$': subjectName } }
      );
    }

    const populated = await Subject.findById(subject._id)
      .populate('facultyIds', 'name email department facultyId')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully.',
      subject: populated,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/subjects/:id
const deleteSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found.',
      });
    }

    // Remove subject from all faculty members' assignedSubjects
    await Faculty.updateMany(
      { assignedSubjects: subject.name },
      { $pull: { assignedSubjects: subject.name } }
    );

    await Subject.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Subject deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/students/:id/status (Toggle Student active status)
const toggleStudentStatus = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found.',
      });
    }

    student.isActive = !student.isActive;
    await student.save();

    res.status(200).json({
      success: true,
      message: `Student account ${student.isActive ? 'activated' : 'deactivated'} successfully.`,
      student: student.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
