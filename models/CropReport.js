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
  diseaseName: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['Healthy', 'Mild', 'Moderate', 'Severe'],
    required: true
  },
  cropType: {
    type: String,
    default: ''
  },
  treatment: {
    organic: String,
    chemical: String,
    dosage: String
  },
  village: {
    type: String,
    required: true
  },
  sharedToCommunity: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('CropReport', cropReportSchema);