const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const {
  notifyDoctorNewAppointment,
  notifyPatientAppointmentConfirmed,
  notifyPatientAppointmentCancelled,
  notifyPatientPrescriptionReady
} = require('../utils/pushNotifications');
const {
  sendAppointmentBookedEmail,
  sendAppointmentConfirmedEmail,
  sendPrescriptionEmail
} = require('../utils/email');

// ============================================
// GENERATE JITSI LINK
// ============================================
const generateJitsiLink = (appointmentId) => {
  const roomName = `RuralMate-${appointmentId}-${Date.now()}`;
  return `https://meet.jit.si/${roomName}`;
};

// ============================================
// @route GET /api/appointments/doctors
// ============================================
router.get('/doctors', protect, async (req, res) => {
  try {
    const doctors = await User.find({
      role: 'doctor',
      isActive: { $ne: false }
    }).select('-pin -pushToken');

    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// ============================================
// @route POST /api/appointments/book
// ============================================
router.post('/book', protect, async (req, res) => {
  try {
    // Only villagers and farmers can book
    if (!['villager', 'farmer'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only residents and farmers can book appointments'
      });
    }

    const {
      doctorId, symptoms, scheduledDate,
      scheduledTime, meetType, notes, sharedReports
    } = req.body;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }

    if (!symptoms || symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please describe your symptoms'
      });
    }

    const [doctor, patient] = await Promise.all([
      User.findById(doctorId),
      User.findById(req.user.id)
    ]);

    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const appointment = await Appointment.create({
      patientId: req.user.id,
      doctorId,
      patientName: patient.name,
      doctorName: doctor.name,
      symptoms: Array.isArray(symptoms) ? symptoms : symptoms.split(',').map(s => s.trim()),
      scheduledDate: scheduledDate || '',
      scheduledTime: scheduledTime || '',
      meetType: meetType || 'jitsi',
      notes: notes || '',
      sharedReports: sharedReports || [],
      village: patient.village,
      status: 'pending'
    });

    // Generate Jitsi link immediately
    const meetLink = generateJitsiLink(appointment._id);
    appointment.meetLink = meetLink;
    await appointment.save();

    console.log(`📅 New appointment: ${patient.name} → Dr. ${doctor.name}`);

    // Send push notification to doctor
    if (doctor.pushToken) {
      notifyDoctorNewAppointment(
        doctor.pushToken,
        patient.name,
        appointment.symptoms
      ).catch(e => console.log('Push to doctor failed:', e.message));
    }

    // Send email to patient (non-blocking)
    sendAppointmentBookedEmail(patient, doctor, appointment)
      .catch(e => console.log('Email failed:', e.message));

    res.status(201).json({
      success: true,
      message: 'Appointment requested successfully',
      data: appointment,
      meetLink
    });

  } catch (error) {
    console.log('Book appointment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route GET /api/appointments/my
// ============================================
router.get('/my', protect, async (req, res) => {
  try {
    const query = req.user.role === 'doctor'
      ? { doctorId: req.user.id }
      : { patientId: req.user.id };

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name phone village')
      .populate('doctorId', 'name specialization hospitalName')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: appointments.length, data: appointments });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route PUT /api/appointments/:id/status
// ============================================
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status, scheduledDate, scheduledTime } = req.body;

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be: ${validStatuses.join(', ')}`
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Only doctor can confirm/complete, patient can cancel
    if (status === 'confirmed' && req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can confirm appointments'
      });
    }

    appointment.status = status;
    if (scheduledDate) appointment.scheduledDate = scheduledDate;
    if (scheduledTime) appointment.scheduledTime = scheduledTime;
    await appointment.save();

    // Get patient and doctor for notifications
    const [patient, doctor] = await Promise.all([
      User.findById(appointment.patientId),
      User.findById(appointment.doctorId)
    ]);

    if (status === 'confirmed') {
      console.log(`✅ Appointment confirmed: ${appointment.patientName} → Dr. ${appointment.doctorName}`);

      // Push to patient
      if (patient?.pushToken) {
        notifyPatientAppointmentConfirmed(
          patient.pushToken,
          appointment.doctorName,
          appointment.scheduledDate
        ).catch(e => console.log('Push failed:', e.message));
      }

      // Email to patient
      if (patient && doctor) {
        sendAppointmentConfirmedEmail(patient, doctor, appointment)
          .catch(e => console.log('Email failed:', e.message));
      }

    } else if (status === 'cancelled') {
      console.log(`❌ Appointment cancelled: ${appointment.patientName}`);

      // Push to patient
      if (patient?.pushToken) {
        notifyPatientAppointmentCancelled(
          patient.pushToken,
          appointment.doctorName
        ).catch(e => console.log('Push failed:', e.message));
      }
    }

    res.json({ success: true, data: appointment });

  } catch (error) {
    console.log('Update status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route PUT /api/appointments/availability
// Doctor updates their availability
// ============================================
router.put('/availability', protect, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can update availability'
      });
    }

    const { isAvailable } = req.body;

    await User.findByIdAndUpdate(req.user.id, { isAvailable });

    console.log(`🩺 Doctor ${req.user.id} availability: ${isAvailable}`);

    res.json({
      success: true,
      message: `You are now ${isAvailable ? 'available' : 'unavailable'} for appointments`,
      isAvailable
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route POST /api/appointments/:id/prescription
// ============================================
router.post('/:id/prescription', protect, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can write prescriptions'
      });
    }

    const { diagnosis, medicines, advice, followUpDate } = req.body;

    if (!diagnosis?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Diagnosis is required'
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const doctor = await User.findById(req.user.id);

    const prescription = await Prescription.create({
      doctorId: req.user.id,
      patientId: appointment.patientId,
      appointmentId: appointment._id,
      patientName: appointment.patientName,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization || 'General Physician',
      diagnosis: diagnosis.trim(),
      medicines: medicines || [],
      advice: advice || '',
      followUpDate: followUpDate || '',
      village: appointment.village
    });

    // Update appointment status
    appointment.status = 'completed';
    appointment.followUpDate = followUpDate || '';
    await appointment.save();

    console.log(`💊 Prescription created: ${appointment.patientName} by Dr. ${doctor.name}`);

    // Get patient for notifications
    const patient = await User.findById(appointment.patientId);

    // Push to patient
    if (patient?.pushToken) {
      notifyPatientPrescriptionReady(
        patient.pushToken,
        doctor.name,
        diagnosis
      ).catch(e => console.log('Push failed:', e.message));
    }

    // Email prescription to patient
    if (patient) {
      sendPrescriptionEmail(patient, doctor, prescription)
        .catch(e => console.log('Email failed:', e.message));
    }

    res.status(201).json({ success: true, data: prescription });

  } catch (error) {
    console.log('Prescription error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route GET /api/appointments/prescriptions
// ============================================
router.get('/prescriptions', protect, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, count: prescriptions.length, data: prescriptions });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
