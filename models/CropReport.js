const mongoose = require('mongoose');

const cropReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  cropType: {
    type: String,
    default: 'Unknown'
  },
  diseaseName: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['Healthy', 'Mild', 'Moderate', 'Severe'],
    required: true
  },
  treatment: {
    organic: { type: String, default: '' },
    chemical: { type: String, default: '' },
    prevention: { type: String, default: '' }
  },
  village: {
    type: String,
    required: true
  },
  sharedToCommunity: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'en'
  }
}, { timestamps: true });

module.exports = mongoose.model('CropReport', cropReportSchema);
