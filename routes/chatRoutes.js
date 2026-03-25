const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const HealthRecord = require('../models/HealthRecord');
const FamilyCard = require('../models/FamilyCard');
const CropReport = require('../models/CropReport');
const { protect } = require('../middleware/authMiddleware');
const Chat = require('../models/chat');


// @route GET /api/chat/my — Get all chats for current user
router.get('/my', protect, async (req, res) => {
  try {
    const query = req.user.role === 'doctor'
      ? { doctorId: req.user.id }
      : { patientId: req.user.id };

    const chats = await Chat.find(query)
      .sort({ lastMessageTime: -1 });

    res.json({ success: true, data: chats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/chat/:appointmentId — Get or create chat for appointment
router.get('/:appointmentId', protect, async (req, res) => {
  try {
    let chat = await Chat.findOne({ appointmentId: req.params.appointmentId });

    if (!chat) {
      const appointment = await Appointment.findById(req.params.appointmentId);
      if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

      chat = await Chat.create({
        appointmentId: req.params.appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        patientName: appointment.patientName,
        doctorName: appointment.doctorName,
        messages: []
      });
    }

    res.json({ success: true, data: chat });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/chat/:appointmentId/message — Send message
router.post('/:appointmentId/message', protect, async (req, res) => {
  try {
    const { text, type, reportData } = req.body;

    let chat = await Chat.findOne({ appointmentId: req.params.appointmentId });

    if (!chat) {
      const appointment = await Appointment.findById(req.params.appointmentId);
      if (!appointment) return res.status(404).json({ message: 'Not found' });

      chat = await Chat.create({
        appointmentId: req.params.appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        patientName: appointment.patientName,
        doctorName: appointment.doctorName,
        messages: []
      });
    }

    const sender = await User.findById(req.user.id);

    const message = {
      senderId: req.user.id,
      senderName: sender.name,
      senderRole: sender.role,
      text: text || '',
      type: type || 'text',
      reportData: reportData || null,
      createdAt: new Date()
    };

    chat.messages.push(message);
    chat.lastMessage = text || '📎 Shared a report';
    chat.lastMessageTime = new Date();
    await chat.save();

    res.json({ success: true, data: chat });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/chat/patient/:patientId/history — Doctor views patient health history
router.get('/patient/:patientId/history', protect, async (req, res) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'gramsevak') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const [healthRecords, familyCards, cropReports] = await Promise.all([
      HealthRecord.find({ userId: req.params.patientId }).sort({ createdAt: -1 }),
      FamilyCard.find({ userId: req.params.patientId }),
      CropReport.find({ userId: req.params.patientId }).sort({ createdAt: -1 })
    ]);

    const patient = await User.findById(req.params.patientId).select('-pin');

    res.json({
      success: true,
      data: {
        patient,
        healthRecords,
        familyCards,
        cropReports
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;