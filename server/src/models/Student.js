const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [1, 'First name must be at least 1 character'],
    maxlength: [50, 'First name cannot exceed 50 characters'],
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [1, 'Last name must be at least 1 character'],
    maxlength: [50, 'Last name cannot exceed 50 characters'],
  },
  name: {
    type: String,
    trim: true,
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
    required: [true, 'Student email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
  },
  passwordHash: {
    type: String,
    default: '',
  },
  mustChangePassword: {
    type: Boolean,
    default: true,
  },
  role: {
    type: String,
    default: 'student',
    enum: ['student'],
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

// Auto-sync full name from firstName and lastName before validation
studentSchema.pre('validate', function () {
  // If firstName and lastName are provided, derive full name
  if (this.firstName && this.lastName) {
    this.name = `${this.firstName.trim()} ${this.lastName.trim()}`.trim();
  } else if (!this.firstName && !this.lastName && this.name) {
    // Legacy support: if only name was provided, safely populate firstName & lastName
    const parts = this.name.trim().split(/\s+/);
    this.firstName = parts[0] || 'Unknown';
    this.lastName = parts.slice(1).join(' ') || 'Student';
  }
});

// Compare student password method
studentSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Never return passwordHash in JSON serialization
studentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  // Ensure name is present for legacy client compatibility
  if (!obj.name && (obj.firstName || obj.lastName)) {
    obj.name = `${obj.firstName || ''} ${obj.lastName || ''}`.trim();
  }
  return obj;
};

// Prevent duplicate roll number within the same class
studentSchema.index({ rollNumber: 1, className: 1 }, { unique: true });
// Unique student email index (sparse for legacy safety)
studentSchema.index({ email: 1 }, { unique: true, sparse: true });
// Optimize class lookup and distinct queries
studentSchema.index({ className: 1 });
// Optimize department filtering
studentSchema.index({ department: 1 });
// Optimize name sorting
studentSchema.index({ name: 1 });
studentSchema.index({ lastName: 1, firstName: 1 });

module.exports = mongoose.model('Student', studentSchema);
