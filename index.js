const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// Route imports
const authRoutes = require('./routes/authRoutes');
const cropRoutes = require('./routes/cropRoutes');
const healthRoutes = require('./routes/healthRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const communityRoutes = require('./routes/communityRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const User = require('./models/User');
const { protect } = require('./middleware/authMiddleware');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// REQUEST LOGGER (dev helper)
// ============================================
app.use((req, res, next) => {
  if (req.path !== '/') {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ============================================
// ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/crop', cropRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);

// ============================================
// PUSH TOKEN REGISTRATION
// Save Expo push token when user opens the app
// ============================================
app.post('/api/users/push-token', protect, async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid push token format'
      });
    }

    await User.findByIdAndUpdate(req.user.id, { pushToken });
    console.log(`📲 Push token saved for user ${req.user.id}`);

    res.json({ success: true, message: 'Push token registered' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// DOCTOR AVAILABILITY TOGGLE
// ============================================
app.put('/api/users/availability', protect, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can update availability'
      });
    }
    const { isAvailable } = req.body;
    await User.findByIdAndUpdate(req.user.id, { isAvailable });
    res.json({
      success: true,
      isAvailable,
      message: `You are now ${isAvailable ? 'available' : 'unavailable'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// HEALTH CHECK ROUTE
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: 'RuralMate Server is running! 🌾',
    version: '2.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.log('❌ Global error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// CONNECT TO MONGODB & START SERVER
// ============================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 RuralMate Server running on port ${PORT}`);
      console.log(`📱 App: RuralMate v2.0`);
      console.log(`🌍 Domain: algearithm.xyz`);
    });

    // ── KEEP RENDER ALIVE ──
    // Ping server every 14 minutes to prevent free tier sleep
    if (process.env.NODE_ENV !== 'development') {
      const SERVER_URL = process.env.SERVER_URL ||
        'https://gramseva-server.onrender.com';

      setInterval(async () => {
        try {
          await axios.get(SERVER_URL, { timeout: 10000 });
          console.log('🏓 Keep-alive ping sent');
        } catch (e) {
          console.log('⚠️ Keep-alive ping failed:', e.message);
        }
      }, 14 * 60 * 1000); // 14 minutes

      console.log('🏓 Keep-alive pings enabled');
    }
  })
  .catch((err) => {
    console.log('❌ MongoDB Connection Failed:', err.message);
    process.exit(1);
  });
