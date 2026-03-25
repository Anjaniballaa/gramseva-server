const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, phone, pin, role, village, language, landSize, cropTypes } = req.body;

    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    const user = await User.create({
      name,
      phone,
      pin: hashedPin,
      role,
      village,
      language: language || 'english',
      landSize: landSize || '',
      cropTypes: cropTypes || []
    });

    if (user) {
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          village: user.village,
          language: user.language,
          token: generateToken(user._id, user.role)
        }
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { phone, pin, role } = req.body;
    
    console.log('Login attempt:', { phone, role });
    
    const user = await User.findOne({ phone, role });
    console.log('User found:', user ? 'YES' : 'NO');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found. Check phone number and role.' 
      });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    console.log('PIN match:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Wrong PIN. Try again.' 
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        village: user.village,
        language: user.language,
        landSize: user.landSize,
        specialization: user.specialization,
        qualification: user.qualification,
        hospitalName: user.hospitalName
      }
    });

  } catch (error) {
    console.log('Login server error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET ME
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-pin');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;