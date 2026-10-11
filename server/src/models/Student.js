const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    trim: true,
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    default: '',
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
  },
  className: {
    type: String,
    required: [true, 'Class / Division is required'],
    trim: true,
  },
  year: {
    type: String,
    required: [true, 'Year is required'],
    trim: true,
  },
  faceImageUrl: {
    type: String,
    default: '',
  },
  faceEnrollmentStatus: {
    type: String,
    enum: ['not_enrolled', 'enrolled', 'pending'],
    default: 'not_enrolled',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent duplicate roll number within the same class
studentSchema.index({ rollNumber: 1, className: 1 }, { unique: true });
// Optimize class lookup and distinct queries
studentSchema.index({ className: 1 });
// Optimize department filtering
studentSchema.index({ department: 1 });
// Optimize name sorting
studentSchema.index({ name: 1 });

module.exports = mongoose.model('Student', studentSchema);
