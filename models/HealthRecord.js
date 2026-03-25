const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  familyMemberName: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  symptoms: [{
    type: String
  }],
  duration: {
    type: String,
    enum: ['today', '2-3days', '1week+'],
    required: true
  },
  severityLevel: {
    type: String,
    enum: ['Green', 'Yellow', 'Red'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'visited', 'advised', 'referred', 'resolved'],
    default: 'pending'
  },
  workerNote: {
    type: String,
    default: ''
  },
  village: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('HealthRecord', healthRecordSchema);