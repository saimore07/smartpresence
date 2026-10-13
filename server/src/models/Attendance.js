const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true,
  },
  markedAt: {
    type: Date,
    default: Date.now,
  },
  matchConfidence: {
    type: Number,
    default: 1.0,
  },
  detectionProvenance: {
    type: String,
    enum: ['auto_matched', 'manual_faculty_verified', 'manual_added'],
    default: 'manual_faculty_verified',
  },
});

const attendanceSchema = new mongoose.Schema({
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  className: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true,
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
  },
  date: {
    type: String,
    required: [true, 'Date is required'],
  },
  sessionSlot: {
    type: String,
    default: 'regular',
    trim: true,
  },
  startTime: {
    type: String,
    default: '',
    trim: true,
  },
  endTime: {
    type: String,
    default: '',
    trim: true,
  },
  capturedImageUrl: {
    type: String,
    default: '',
  },
  capturedImageUrls: {
    type: [String],
    default: [],
  },
  students: [attendanceRecordSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent duplicate attendance for class + subject + date + sessionSlot
attendanceSchema.index({ className: 1, subject: 1, date: 1, sessionSlot: 1 }, { unique: true });
// Optimize date queries and dashboard statistics
attendanceSchema.index({ date: 1 });
// Optimize student attendance lookup
attendanceSchema.index({ 'students.studentId': 1 });
// Optimize history sorting
attendanceSchema.index({ createdAt: -1 });
// Optimize faculty query
attendanceSchema.index({ facultyId: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
