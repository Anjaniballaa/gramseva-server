const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  role: {
    type: String,
    enum: ['farmer', 'villager', 'gramsevak', 'doctor'],
    required: true
  },
  village: { type: String, required: true },
  language: { type: String, default: 'hindi' },
  landSize: { type: String },

  // Doctor specific
  specialization: { type: String, default: '' },
  qualification: { type: String, default: '' },
  hospitalName: { type: String, default: '' },
  availableSlots: [{ type: String }],
  isAvailable: { type: Boolean, default: true },
  meetLink: { type: String, default: '' },

  // Gram Sevak specific
  assignedVillages: [{ type: String }],
  employeeId: { type: String, default: '' }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);