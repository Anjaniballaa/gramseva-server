const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const axios = require('axios');
const CropReport = require('../models/CropReport');
const { protect } = require('../middleware/authMiddleware');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 120000
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// @route POST /api/crop/scan
router.post('/scan', protect, upload.single('image'), async (req, res) => {
  try {
    console.log('📸 Crop scan request received');
    console.log('File:', req.file ? 'YES' : 'NO');
    console.log('Body:', req.body);

    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    // Upload to Cloudinary
    console.log('Uploading to Cloudinary...');
    let uploadResult;
    try {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;

      uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'gramseva/crops',
        resource_type: 'image',
        timeout: 120000,
        transformation: [
          { width: 512, height: 512, crop: 'limit' },
          { quality: 'auto:low' }
        ]
      });
      console.log('✅ Cloudinary success:', uploadResult.secure_url);
    } catch (cloudinaryError) {
      console.log('Cloudinary failed:', cloudinaryError.message);
      return res.status(500).json({
        message: 'Image upload failed',
        error: cloudinaryError.message
      });
    }

    // Call Flask ML service
    console.log('Calling Flask ML service...');
    let diseaseName = 'Unknown';
    let severity = 'Moderate';
    let treatment = {
      organic: 'Consult local agricultural officer',
      chemical: 'Visit nearest Krishi Vigyan Kendra',
      prevention: 'Monitor crop regularly'
    };
    let confidence = 0;
    let wrongCrop = false;
    let actualCrop = req.body.cropType || 'Unknown';
    let farmerMessage = '';

    try {
      const mlResponse = await axios.post(
        'http://localhost:5001/predict',
        {
          image_url: uploadResult.secure_url,
          crop_type: req.body.cropType || 'tomato'
        },
        { timeout: 60000 }
      );

      console.log('ML Response:', mlResponse.data);

      if (mlResponse.data.success) {
        diseaseName = mlResponse.data.disease || 'Unknown';
        severity = mlResponse.data.severity || 'Moderate';
        confidence = mlResponse.data.confidence || 0;
        treatment = mlResponse.data.treatment || treatment;
        wrongCrop = mlResponse.data.wrong_crop || false;
        actualCrop = mlResponse.data.actual_crop || req.body.cropType;
        farmerMessage = mlResponse.data.message || '';
      }
    } catch (mlError) {
      console.log('ML service error:', mlError.message);
    }

    // Save to DB
    const report = await CropReport.create({
      userId: req.user.id,
      imageUrl: uploadResult.secure_url,
      diseaseName,
      severity,
      cropType: req.body.cropType || 'Unknown',
      treatment,
      village: req.body.village || 'Unknown',
      sharedToCommunity: false
    });

    console.log('✅ Report saved to DB');

    res.status(201).json({
      success: true,
      message: 'Crop scanned successfully',
      data: {
        diseaseName,
        severity,
        confidence,
        treatment,
        wrongCrop,
        actualCrop,
        selectedCrop: req.body.cropType || 'Unknown',
        farmerMessage,
        imageUrl: uploadResult.secure_url,
        reportId: report._id
      }
    });

  } catch (error) {
    console.log('❌ Crop scan error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/crop/history
router.get('/history', protect, async (req, res) => {
  try {
    const reports = await CropReport.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/crop/report/:id/share
router.post('/report/:id/share', protect, async (req, res) => {
  try {
    const report = await CropReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    report.sharedToCommunity = true;
    await report.save();
    res.json({ success: true, message: 'Shared to community!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/crop/community/:village
router.get('/community/:village', protect, async (req, res) => {
  try {
    const reports = await CropReport.find({
      village: req.params.village,
      sharedToCommunity: true
    })
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;