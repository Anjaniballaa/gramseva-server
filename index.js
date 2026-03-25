const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const cropRoutes = require('./routes/cropRoutes');
const healthRoutes = require('./routes/healthRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const communityRoutes = require('./routes/communityRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const chatRoutes = require('./routes/chatRoutes');


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/crop', cropRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);
// Test route
app.get('/', (req, res) => {
  res.json({ message: 'GramSeva Server is running! 🌾' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    app.listen(process.env.PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log('❌ MongoDB Connection Failed:', err.message);
  });