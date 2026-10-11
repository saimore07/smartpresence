const mongoose = require('mongoose');

const faceTemplateSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true,
  },
  modelIdentifier: {
    type: String,
    required: true,
    default: 'opencv_yunet_sface_v1',
  },
  version: {
    type: String,
    default: '1.0',
  },
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'Embedding must be a non-empty numeric array.',
    },
  },
  enrollmentStatus: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
  },
  qualityScore: {
    type: Number,
    default: 0.0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

faceTemplateSchema.index({ enrollmentStatus: 1 });

module.exports = mongoose.model('FaceTemplate', faceTemplateSchema);
