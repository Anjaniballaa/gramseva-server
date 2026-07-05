const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Basic info
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  pin: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['farmer', 'villager', 'gramsevak', 'doctor'],
    required: true
  },
  village: {
    type: String,
    required: true,
    trim: true
  },
  language: {
    type: String,
    enum: ['en', 'te', 'hi'],
    default: 'en'
  },

  // Farmer specific
  landSize: {
    type: String,
    default: ''
  },
  cropTypes: [{
    type: String
  }],

  // Doctor specific
  specialization: {
    type: String,
    default: ''
  },
  qualification: {
    type: String,
    default: ''
  },
  hospitalName: {
    type: String,
    default: ''
  },
  availableSlots: [{
    type: String
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  meetLink: {
    type: String,
    default: ''
  },

  // Field Officer (GramSevak) specific
  assignedVillages: [{
    type: String
  }],
  employeeId: {
    type: String,
    default: ''
  },

  // Push notifications — Expo push token
  pushToken: {
    type: String,
    default: ''
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
