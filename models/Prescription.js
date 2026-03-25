const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  patientName: { type: String, required: true },
  doctorName: { type: String, required: true },
  doctorSpecialization: { type: String, default: 'General Physician' },
  diagnosis: { type: String, required: true },
  medicines: [{
    name: String,
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String
  }],
  advice: { type: String, default: '' },
  followUpDate: { type: String, default: '' },
  village: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);