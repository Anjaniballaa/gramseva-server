const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Patient details
  familyMemberName: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  ageGroup: {
    type: String,
    enum: ['child', 'adult', 'elderly'],
    default: 'adult'
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Male'
  },

  // Symptoms
  symptoms: [{
    type: String
  }],
  duration: {
    type: String,
    enum: ['today', '2-3days', '1week+'],
    required: true
  },
  additionalInfo: {
    type: String,
    default: ''
  },

  // AI Analysis result — stored as JSON string
  analysis: {
    type: String,
    default: ''
  },

  // Severity
  severityLevel: {
    type: String,
    enum: ['Green', 'Yellow', 'Red'],
    required: true
  },

  // Status updated by field officer / health worker
  status: {
    type: String,
    enum: ['pending', 'visited', 'advised', 'referred', 'resolved'],
    default: 'pending'
  },
  workerNote: {
    type: String,
    default: ''
  },

  // Location
  village: {
    type: String,
    required: true
  },

  // Language used for analysis
  language: {
    type: String,
    default: 'en'
  }

}, { timestamps: true });

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
