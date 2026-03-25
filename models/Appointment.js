const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName: { type: String, required: true },
  doctorName: { type: String, required: true },
  symptoms: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  scheduledDate: { type: String, default: '' },
  scheduledTime: { type: String, default: '' },
  meetLink: { type: String, default: '' },
  meetType: { type: String, enum: ['jitsi', 'google_meet'], default: 'jitsi' },
  notes: { type: String, default: '' },
  village: { type: String, default: '' },
  followUpDate: { type: String, default: '' },
  sharedReports: [{ type: { type: String }, reportId: mongoose.Schema.Types.ObjectId, summary: String }]
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);