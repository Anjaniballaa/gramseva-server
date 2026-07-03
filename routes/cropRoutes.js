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
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Try flash first, fall back to pro if 503
const GEMINI_FLASH_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;
const GEMINI_PRO_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

const callGemini = async (body) => {
  try {
    const res = await axios.post(GEMINI_FLASH_URL, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 35000
    });
    return res;
  } catch (e) {
    if (e.response?.status === 503 || e.response?.status === 429) {
      console.log('⚠️ Flash model busy, trying gemini-1.5-flash fallback...');
      return await axios.post(GEMINI_PRO_URL, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 35000
      });
    }
    throw e;
  }
};

// ============================================
// LANGUAGE HELPERS
// ============================================
const LANG_NAMES = {
  te: 'Telugu',
  hi: 'Hindi',
  en: 'English'
};

const ERROR_MESSAGES = {
  no_image: {
    en: 'No image uploaded. Please take a photo of your crop.',
    te: 'చిత్రం అప్లోడ్ చేయబడలేదు. దయచేసి మీ పంట ఫోటో తీయండి.',
    hi: 'कोई छवि अपलोड नहीं हुई। कृपया अपनी फसल की फोटो लें।'
  },
  not_crop: {
    en: '🚫 This does not look like a crop or plant image. Please upload a clear photo of your crop leaves or plant.',
    te: '🚫 ఇది పంట లేదా మొక్క చిత్రంలా కనిపించడం లేదు. దయచేసి మీ పంట ఆకులు లేదా మొక్క యొక్క స్పష్టమైన ఫోటో అప్లోడ్ చేయండి.',
    hi: '🚫 यह फसल या पौधे की छवि नहीं लगती। कृपया अपनी फसल की पत्तियों या पौधे की स्पष्ट फोटो अपलोड करें।'
  },
  try_again: {
    en: '📷 Could not analyze this image. Please try again with a clearer photo in good lighting.',
    te: '📷 ఈ చిత్రాన్ని విశ్లేషించడం సాధ్యపడలేదు. దయచేసి మంచి వెలుతురులో స్పష్టమైన ఫోటోతో మళ్ళీ ప్రయత్నించండి.',
    hi: '📷 इस छवि का विश्लेषण नहीं हो सका। कृपया अच्छी रोशनी में स्पष्ट फोटो के साथ फिर से कोशिश करें।'
  },
  upload_failed: {
    en: 'Image upload failed. Please check your internet connection and try again.',
    te: 'చిత్రం అప్లోడ్ విఫలమైంది. దయచేసి మీ ఇంటర్నెట్ కనెక్షన్ తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి.',
    hi: 'छवि अपलोड विफल हो गई। कृपया अपना इंटरनेट कनेक्शन जांचें और फिर से कोशिश करें।'
  }
};

const getError = (key, lang = 'en') => {
  const msgs = ERROR_MESSAGES[key];
  return msgs[lang] || msgs['en'];
};

// ============================================
// STEP 1 — CROP.HEALTH API (PRIMARY)
// ============================================
async function detectWithCropHealth(imageBuffer, mimeType) {
  try {
    console.log('🌿 Calling crop.health API...');

    const base64Image = imageBuffer.toString('base64');

    const response = await axios.post(
      'https://crop.kindwise.com/api/v1/identification?details=treatment,description,symptoms,severity,cause&similar_images=true',
      {
        images: [`data:${mimeType};base64,${base64Image}`],
        latitude: 17.3850,
        longitude: 78.4867
      },
      {
        headers: {
          'Api-Key': process.env.CROP_HEALTH_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 40000
      }
    );

    console.log('crop.health status:', response.status);

    if (response.status !== 201 && response.status !== 200) {
      console.log('crop.health bad status:', response.status);
      return null;
    }

    const data = response.data;
    const result = data.result || {};

    // Check if it's a valid crop/plant image
    const isPlant = result.is_plant?.binary;
    const isPlantProbability = result.is_plant?.probability || 0;

    console.log('Is plant:', isPlant, 'Probability:', isPlantProbability);

    if (!isPlant || isPlantProbability < 0.3) {
      console.log('Not a plant image detected');
      return { notPlant: true };
    }

    // Get crop name
    const cropSuggestions = result.crop?.suggestions || [];
    const detectedCrop = cropSuggestions.length > 0
      ? cropSuggestions[0].name
      : 'Unknown Crop';

    // Get disease info
    const diseaseSuggestions = result.disease?.suggestions || [];

    if (diseaseSuggestions.length === 0) {
      console.log('No disease suggestions from crop.health');
      return {
        notPlant: false,
        detectedCrop,
        disease: 'Healthy',
        isHealthy: true,
        confidence: isPlantProbability * 100,
        treatment: { biological: '', chemical: '', prevention: '' },
        description: '',
        symptoms: ''
      };
    }

    const topDisease = diseaseSuggestions[0];
    const diseaseName = topDisease.name || 'Unknown Disease';
    const confidence = (topDisease.probability || 0) * 100;
    const isHealthy = diseaseName.toLowerCase().includes('healthy');

    const details = topDisease.details || {};
    const treatmentData = details.treatment || {};

    const parseTreatment = (val) => {
      if (!val) return '';
      if (Array.isArray(val)) return val.join('. ');
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    return {
      notPlant: false,
      detectedCrop,
      disease: diseaseName,
      isHealthy,
      confidence: Math.round(confidence * 10) / 10,
      treatment: {
        biological: parseTreatment(treatmentData.biological),
        chemical: parseTreatment(treatmentData.chemical),
        prevention: parseTreatment(treatmentData.prevention)
      },
      description: details.description || '',
      symptoms: details.symptoms || '',
      cause: details.cause || ''
    };

  } catch (error) {
    console.log('❌ crop.health error:', error.message);
    if (error.response) {
      console.log('crop.health response error:', error.response.status, error.response.data);
    }
    return null;
  }
}

// ============================================
// STEP 2 — GEMINI ENRICHMENT / TRANSLATION
// ============================================
async function enrichWithGemini(cropHealthResult, imageUrl, language) {
  try {
    const langName = LANG_NAMES[language] || 'English';
    console.log(`🤖 Calling Gemini for enrichment in ${langName}...`);

    let prompt;

    if (cropHealthResult && !cropHealthResult.notPlant) {
      // Enrich crop.health result with better treatment + translate
      const { detectedCrop, disease, isHealthy, confidence } = cropHealthResult;

      if (isHealthy) {
        prompt = `You are an expert Indian agricultural advisor. 
A farmer's ${detectedCrop} crop appears HEALTHY based on image analysis.

Respond ONLY in ${langName} language. Return ONLY valid JSON, no other text:
{
  "crop_identified": "${detectedCrop}",
  "disease": "Healthy",
  "is_healthy": true,
  "severity": "Healthy",
  "confidence": ${Math.round(confidence)},
  "farmer_message": "Good news message about healthy crop in ${langName}",
  "organic_treatment": "Preventive care tips in ${langName}",
  "chemical_treatment": "No chemical treatment needed - say this in ${langName}",
  "prevention": "How to keep crop healthy in ${langName}",
  "consult_officer": false,
  "consult_reason": ""
}`;
      } else {
        prompt = `You are an expert Indian agricultural advisor helping rural farmers.
A farmer's ${detectedCrop} crop has been identified with: ${disease}
Confidence: ${Math.round(confidence)}%

Give practical advice for Indian farmers with Indian product names and local remedies.
Respond ONLY in ${langName} language. Return ONLY valid JSON, no other text:
{
  "crop_identified": "${detectedCrop} crop name in ${langName}",
  "disease": "${disease} disease name in ${langName}",
  "is_healthy": false,
  "severity": "one of: Mild/Moderate/Severe based on disease",
  "confidence": ${Math.round(confidence)},
  "farmer_message": "Simple explanation of what is wrong with the crop in ${langName}",
  "organic_treatment": "Specific organic/natural treatment with local Indian remedies in ${langName}",
  "chemical_treatment": "Specific Indian chemical product names with dosage in ${langName} (e.g. Dithane M-45, Bavistin etc)",
  "prevention": "How to prevent this disease in future in ${langName}",
  "consult_officer": true or false based on severity,
  "consult_reason": "Why they should or should not consult agricultural officer in ${langName}"
}`;
      }
    } else {
      // Gemini-only fallback — analyze image directly
      prompt = `You are an expert Indian agricultural advisor. 
Analyze this crop/plant image URL: ${imageUrl}

First check if this is actually a crop or plant image.
If NOT a crop or plant image, respond with:
{"not_crop": true, "error_message": "Not a crop image message in ${langName}"}

If it IS a crop/plant, provide complete analysis for Indian farmers.
Respond ONLY in ${langName} language. Return ONLY valid JSON, no other text:
{
  "not_crop": false,
  "crop_identified": "crop name in ${langName}",
  "disease": "disease name in ${langName} or Healthy",
  "is_healthy": true or false,
  "severity": "Healthy/Mild/Moderate/Severe",
  "confidence": number between 60-90,
  "farmer_message": "Simple explanation in ${langName}",
  "organic_treatment": "Natural/organic treatment in ${langName}",
  "chemical_treatment": "Indian chemical products with dosage in ${langName}",
  "prevention": "Prevention tips in ${langName}",
  "consult_officer": true or false,
  "consult_reason": "Reason in ${langName}"
}`;
    }

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    };

    const response = await callGemini(requestBody);

    if (response.status !== 200) {
      console.log('Gemini bad status:', response.status);
      return null;
    }

    let text = response.data.candidates[0].content.parts[0].text.trim();

    // Clean JSON
    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(text);
    console.log('✅ Gemini enrichment success');
    return parsed;

  } catch (error) {
    console.log('❌ Gemini error:', error.message);
    return null;
  }
}

// ============================================
// STEP 3 — GEMINI IMAGE ANALYSIS (FALLBACK)
// ============================================
async function analyzeWithGeminiVision(imageBuffer, mimeType, imageUrl, language) {
  try {
    const langName = LANG_NAMES[language] || 'English';
    console.log(`🤖 Calling Gemini Vision fallback in ${langName}...`);

    const base64Image = imageBuffer.toString('base64');

    const prompt = `You are an expert Indian agricultural advisor.
Look at this image carefully.

First: Is this a crop, plant, or vegetation image?
- If NO (it's a person, animal, object, food, etc.) → respond with not_crop: true
- If YES → analyze the crop disease

Respond ONLY in ${langName} language. Return ONLY valid JSON:
{
  "not_crop": false,
  "crop_identified": "crop name",
  "disease": "disease name or Healthy", 
  "is_healthy": true or false,
  "severity": "Healthy/Mild/Moderate/Severe",
  "confidence": 75,
  "farmer_message": "what is wrong or good about this crop",
  "organic_treatment": "natural remedies with local Indian solutions",
  "chemical_treatment": "Indian brand chemical names with dosage",
  "prevention": "prevention tips",
  "consult_officer": false,
  "consult_reason": "reason"
}

If not a crop image:
{
  "not_crop": true,
  "error_message": "explanation that this is not a crop image"
}`;

    const response = await callGemini({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    });

    let text = response.data.candidates[0].content.parts[0].text.trim();

    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(text);
    console.log('✅ Gemini Vision fallback success');
    return parsed;

  } catch (error) {
    console.log('❌ Gemini Vision fallback error:', error.message);
    return null;
  }
}

// ============================================
// DETERMINE SEVERITY
// ============================================
function determineSeverity(disease, confidence, geminiSeverity) {
  if (geminiSeverity && ['Healthy', 'Mild', 'Moderate', 'Severe'].includes(geminiSeverity)) {
    return geminiSeverity;
  }
  const d = (disease || '').toLowerCase();
  if (d.includes('healthy')) return 'Healthy';
  if (d.includes('blight') || d.includes('wilt') || d.includes('rot')) return 'Severe';
  if (d.includes('spot') || d.includes('mold') || d.includes('rust')) return 'Moderate';
  if (confidence > 85) return 'Moderate';
  return 'Mild';
}

// ============================================
// @route POST /api/crop/scan
// ============================================
router.post('/scan', protect, upload.single('image'), async (req, res) => {
  try {
    console.log('\n🌾 ===== CROP SCAN REQUEST =====');

    if (!req.file) {
      const lang = req.body.language || req.user.language || 'en';
      return res.status(400).json({
        success: false,
        message: getError('no_image', lang)
      });
    }

    const language = req.body.language || req.user.language || 'en';
    const village = req.body.village || 'Unknown';
    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    console.log(`Language: ${language}, Village: ${village}`);
    console.log(`Image size: ${imageBuffer.length} bytes, Type: ${mimeType}`);

    // ── STEP 1: Upload to Cloudinary ──
    console.log('📤 Uploading to Cloudinary...');
    let imageUrl;
    try {
      const b64 = imageBuffer.toString('base64');
      const dataURI = `data:${mimeType};base64,${b64}`;

      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'ruralmate/crops',
        resource_type: 'image',
        timeout: 120000,
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto:good' }
        ]
      });
      imageUrl = uploadResult.secure_url;
      console.log('✅ Cloudinary upload success:', imageUrl);
    } catch (cloudinaryError) {
      console.log('❌ Cloudinary failed:', cloudinaryError.message);
      return res.status(500).json({
        success: false,
        message: getError('upload_failed', language)
      });
    }

    // ── STEP 2: Try crop.health API ──
    let cropHealthResult = null;
    let geminiResult = null;
    let usedFallback = false;

    cropHealthResult = await detectWithCropHealth(imageBuffer, mimeType);

    // ── Check if not a plant image ──
    if (cropHealthResult && cropHealthResult.notPlant) {
      console.log('🚫 Not a plant image - asking Gemini to confirm');
      // Double-check with Gemini Vision
      const geminiCheck = await analyzeWithGeminiVision(imageBuffer, mimeType, imageUrl, language);
      if (!geminiCheck || geminiCheck.not_crop) {
        return res.status(400).json({
          success: false,
          notCrop: true,
          message: geminiCheck?.error_message || getError('not_crop', language)
        });
      }
      // Gemini says it IS a crop — use Gemini result
      geminiResult = geminiCheck;
      usedFallback = true;
    } else if (cropHealthResult) {
      // ── STEP 3: Enrich crop.health result with Gemini ──
      geminiResult = await enrichWithGemini(cropHealthResult, imageUrl, language);
    } else {
      // ── STEP 4: crop.health completely failed — Gemini Vision fallback ──
      console.log('⚠️ crop.health failed, using Gemini Vision fallback...');
      geminiResult = await analyzeWithGeminiVision(imageBuffer, mimeType, imageUrl, language);
      usedFallback = true;

      if (!geminiResult) {
        return res.status(500).json({
          success: false,
          message: getError('try_again', language)
        });
      }

      if (geminiResult.not_crop) {
        return res.status(400).json({
          success: false,
          notCrop: true,
          message: geminiResult.error_message || getError('not_crop', language)
        });
      }
    }

    // ── STEP 5: Build final result ──
    let finalCrop, finalDisease, finalIsHealthy, finalConfidence;
    let finalOrganic, finalChemical, finalPrevention;
    let finalSeverity, finalMessage, finalConsultOfficer, finalConsultReason;

    if (geminiResult && !geminiResult.not_crop) {
      // Gemini result takes priority for language + enrichment
      finalCrop = geminiResult.crop_identified || cropHealthResult?.detectedCrop || 'Unknown';
      finalDisease = geminiResult.disease || cropHealthResult?.disease || 'Unknown';
      finalIsHealthy = geminiResult.is_healthy ?? cropHealthResult?.isHealthy ?? false;
      finalConfidence = geminiResult.confidence || cropHealthResult?.confidence || 75;
      finalOrganic = geminiResult.organic_treatment || cropHealthResult?.treatment?.biological || '';
      finalChemical = geminiResult.chemical_treatment || cropHealthResult?.treatment?.chemical || '';
      finalPrevention = geminiResult.prevention || cropHealthResult?.treatment?.prevention || '';
      finalSeverity = determineSeverity(finalDisease, finalConfidence, geminiResult.severity);
      finalMessage = geminiResult.farmer_message || '';
      finalConsultOfficer = geminiResult.consult_officer || false;
      finalConsultReason = geminiResult.consult_reason || '';
    } else if (cropHealthResult && !cropHealthResult.notPlant) {
      // Only crop.health result (Gemini failed)
      finalCrop = cropHealthResult.detectedCrop || 'Unknown';
      finalDisease = cropHealthResult.disease || 'Unknown';
      finalIsHealthy = cropHealthResult.isHealthy || false;
      finalConfidence = cropHealthResult.confidence || 75;
      finalOrganic = cropHealthResult.treatment?.biological || '';
      finalChemical = cropHealthResult.treatment?.chemical || '';
      finalPrevention = cropHealthResult.treatment?.prevention || '';
      finalSeverity = determineSeverity(finalDisease, finalConfidence, null);
      finalMessage = '';
      finalConsultOfficer = finalSeverity === 'Severe';
      finalConsultReason = '';
    } else {
      return res.status(500).json({
        success: false,
        message: getError('try_again', language)
      });
    }

    // ── STEP 6: Save to database ──
    let reportId = null;
    try {
      const report = await CropReport.create({
        userId: req.user.id,
        imageUrl,
        cropType: finalCrop,
        diseaseName: finalDisease,
        severity: finalSeverity,
        treatment: {
          organic: finalOrganic,
          chemical: finalChemical,
          prevention: finalPrevention
        },
        village,
        sharedToCommunity: false
      });
      reportId = report._id;
      console.log('✅ Saved to database');
    } catch (dbError) {
      console.log('⚠️ DB save failed (non-critical):', dbError.message);
    }

    // ── STEP 7: Send response ──
    console.log('✅ ===== SCAN COMPLETE =====\n');

    return res.status(201).json({
      success: true,
      message: 'Crop analyzed successfully',
      usedFallback,
      data: {
        cropIdentified: finalCrop,
        diseaseName: finalDisease,
        isHealthy: finalIsHealthy,
        severity: finalSeverity,
        confidence: finalConfidence,
        farmerMessage: finalMessage,
        treatment: {
          organic: finalOrganic,
          chemical: finalChemical,
          prevention: finalPrevention
        },
        consultOfficer: finalConsultOfficer,
        consultReason: finalConsultReason,
        imageUrl,
        reportId
      }
    });

  } catch (error) {
    console.log('❌ Crop scan critical error:', error.message);
    console.log(error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

// ============================================
// @route GET /api/crop/history
// ============================================
router.get('/history', protect, async (req, res) => {
  try {
    const reports = await CropReport.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// @route POST /api/crop/report/:id/share
// ============================================
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

// ============================================
// @route GET /api/crop/community/:village
// ============================================
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
