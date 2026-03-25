const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const generateJitsiLink = (appointmentId) => {
  const roomName = `GramSeva-${appointmentId}-${Date.now()}`;
  return `https://meet.jit.si/${roomName}`;
};

const sendLocalNotification = async (title, body) => {
  console.log(`📢 NOTIFICATION: ${title} — ${body}`);
};

// @route GET /api/appointments/doctors
router.get('/doctors', protect, async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('-pin');
    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/appointments/book
router.post('/book', protect, async (req, res) => {
  try {
    if (req.user.role !== 'villager') {
      return res.status(403).json({ message: 'Only villagers can book appointments' });
    }

    const { doctorId, symptoms, scheduledDate, scheduledTime, meetType, notes, sharedReports } = req.body;

    const doctor = await User.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const patient = await User.findById(req.user.id);

    const appointment = await Appointment.create({
      patientId: req.user.id,
      doctorId,
      patientName: patient.name,
      doctorName: doctor.name,
      symptoms: symptoms || [],
      scheduledDate: scheduledDate || '',
      scheduledTime: scheduledTime || '',
      meetType: meetType || 'jitsi',
      notes: notes || '',
      sharedReports: sharedReports || [],
      village: patient.village,
      status: 'pending'
    });

    const meetLink = generateJitsiLink(appointment._id);
    appointment.meetLink = meetLink;
    await appointment.save();

    await sendLocalNotification(
      '📅 Appointment Requested',
      `${patient.name} requested an appointment with Dr. ${doctor.name}`
    );

    res.status(201).json({ success: true, data: appointment, meetLink });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/appointments/my
router.get('/my', protect, async (req, res) => {
  try {
    const query = req.user.role === 'doctor'
      ? { doctorId: req.user.id }
      : { patientId: req.user.id };

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name phone village')
      .populate('doctorId', 'name specialization hospitalName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route PUT /api/appointments/:id/status
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status, scheduledDate, scheduledTime } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Not found' });

    appointment.status = status;
    if (scheduledDate) appointment.scheduledDate = scheduledDate;
    if (scheduledTime) appointment.scheduledTime = scheduledTime;
    await appointment.save();

    if (status === 'confirmed') {
      await sendLocalNotification(
        '✅ Appointment Confirmed!',
        `Dr. ${appointment.doctorName} confirmed your appointment for ${appointment.scheduledDate || 'soon'}`
      );
    } else if (status === 'cancelled') {
      await sendLocalNotification(
        '❌ Appointment Cancelled',
        `Your appointment with Dr. ${appointment.doctorName} was cancelled`
      );
    }

    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/appointments/:id/prescription
router.post('/:id/prescription', protect, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can write prescriptions' });
    }

    const { diagnosis, medicines, advice, followUpDate } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Not found' });

    const doctor = await User.findById(req.user.id);

    const prescription = await Prescription.create({
      doctorId: req.user.id,
      patientId: appointment.patientId,
      appointmentId: appointment._id,
      patientName: appointment.patientName,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization || 'General Physician',
      diagnosis,
      medicines: medicines || [],
      advice: advice || '',
      followUpDate: followUpDate || '',
      village: appointment.village
    });

    appointment.status = 'completed';
    appointment.followUpDate = followUpDate || '';
    await appointment.save();

    await sendLocalNotification(
      '💊 Prescription Ready!',
      `Dr. ${doctor.name} sent you a prescription. Diagnosis: ${diagnosis}`
    );

    res.status(201).json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/appointments/prescriptions
router.get('/prescriptions', protect, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;