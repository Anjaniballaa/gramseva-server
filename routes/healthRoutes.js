const express = require('express');
const router = express.Router();
const axios = require('axios');
const HealthRecord = require('../models/HealthRecord');
const FamilyCard = require('../models/FamilyCard');
const { protect } = require('../middleware/authMiddleware');

// ============================================
// GEMINI SETUP WITH FALLBACK
// ============================================
const GEMINI_FLASH_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;
const GEMINI_PRO_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

const callGemini = async (body) => {
  try {
    const res = await axios.post(GEMINI_FLASH_URL, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    return res;
  } catch (e) {
    if (e.response?.status === 503 || e.response?.status === 429) {
      console.log('⚠️ Flash busy, trying gemini-1.5-flash...');
      return await axios.post(GEMINI_PRO_URL, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
    }
    throw e;
  }
};

// ============================================
// LANGUAGE NAMES
// ============================================
const LANG_NAMES = {
  te: 'Telugu',
  hi: 'Hindi',
  en: 'English'
};

// ============================================
// GEMINI SYMPTOM ANALYSIS
// ============================================
async function analyzeWithGemini(patientInfo) {
  try {
    const {
      name, age, ageGroup, gender,
      symptoms, duration, additionalInfo,
      language
    } = patientInfo;

    const langName = LANG_NAMES[language] || 'English';
    const durationText = duration === 'today' ? 'since today'
      : duration === '2-3days' ? 'for 2-3 days'
      : 'for more than 1 week';

    console.log(`🤖 Analyzing symptoms in ${langName}...`);

    const prompt = `You are a medical expert helping rural Indian villagers get health guidance.

Patient Information:
- Name: ${name}
- Age: ${age} years (${ageGroup})
- Gender: ${gender}
- Symptoms: ${symptoms.join(', ')}
- Duration: ${durationText}
- Additional Info: ${additionalInfo || 'None'}

Important guidelines:
1. Consider patient age, gender carefully
2. Give practical advice suitable for rural India
3. Mention Indian OTC medicines available at local medical shops
4. Consider common diseases in rural India (malaria, typhoid, dengue, TB etc)
5. Be specific about when to go to hospital vs manage at home
6. Respond ONLY in ${langName} language
7. Return ONLY valid JSON, no other text

Return this exact JSON structure:
{
  "severity": "Green or Yellow or Red",
  "possible_conditions": ["condition1 in ${langName}", "condition2 in ${langName}"],
  "immediate_action": "what to do right now in simple ${langName} words",
  "home_remedies": ["remedy1 in ${langName}", "remedy2 in ${langName}", "remedy3 in ${langName}"],
  "warning_signs": ["sign1 in ${langName}", "sign2 in ${langName}"],
  "doctor_needed": true or false,
  "emergency": true or false,
  "advice": "detailed practical advice for Indian villager in ${langName}",
  "medicines_otc": ["medicine1 available at Indian medical shop", "medicine2"],
  "diet_advice": "what to eat and avoid in ${langName}",
  "follow_up": "when to come back or check again in ${langName}"
}

Severity rules:
- Green: mild symptoms, can manage at home
- Yellow: needs medical attention within 24 hours  
- Red: emergency, go to hospital immediately

Extra caution for:
- Children under 12
- Elderly above 60
- Chest pain, breathing difficulty, unconsciousness → always Red
- Fever above 104°F, severe dehydration → Red
- Symptoms lasting more than 1 week → at least Yellow`;

    const response = await callGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
    });

    let text = response.data.candidates[0].content.parts[0].text.trim();

    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(text);
    console.log('✅ Gemini analysis success, severity:', parsed.severity);
    return parsed;

  } catch (error) {
    console.log('❌ Gemini health error:', error.message);
    return null;
  }
}

// ============================================
// RULE-BASED FALLBACK ANALYSIS
// ============================================
function ruleBasedAnalysis(symptoms, ageGroup, duration, language) {
  const redSymptoms = [
    'chest pain', 'difficulty breathing', 'unconscious',
    'seizure', 'severe bleeding', 'high fever', 'paralysis',
    'heart attack', 'stroke', 'not breathing'
  ];
  const yellowSymptoms = [
    'fever', 'vomiting', 'diarrhea', 'headache', 'body pain',
    'weakness', 'cough', 'cold', 'rash', 'stomach pain',
    'joint pain', 'sore throat', 'ear pain', 'eye pain',
    'loss of appetite', 'swelling', 'dizziness', 'nausea'
  ];

  const lower = symptoms.map(s => s.toLowerCase());
  let severity = 'Green';

  for (const s of redSymptoms) {
    if (lower.some(sym => sym.includes(s))) {
      severity = 'Red';
      break;
    }
  }

  if (severity !== 'Red') {
    for (const s of yellowSymptoms) {
      if (lower.some(sym => sym.includes(s))) {
        severity = 'Yellow';
        break;
      }
    }
  }

  // Age-based severity upgrade
  if (ageGroup === 'child' || ageGroup === 'elderly') {
    if (severity === 'Green') severity = 'Yellow';
    else if (severity === 'Yellow') severity = 'Red';
  }

  // Duration-based severity upgrade
  if (duration === '1week+' && severity === 'Green') {
    severity = 'Yellow';
  }

  const adviceMap = {
    Green: {
      en: 'Rest at home, drink plenty of fluids, eat light food. Monitor symptoms.',
      te: 'ఇంట్లో విశ్రాంతి తీసుకోండి, ఎక్కువ నీళ్ళు తాగండి, తేలికైన ఆహారం తినండి.',
      hi: 'घर पर आराम करें, पर्याप्त पानी पियें, हल्का खाना खाएं।'
    },
    Yellow: {
      en: 'Visit your nearest health center or PHC today. Do not delay.',
      te: 'ఈ రోజే దగ్గరలోని ఆరోగ్య కేంద్రానికి వెళ్ళండి. ఆలస్యం చేయకండి.',
      hi: 'आज ही नजदीकी स्वास्थ्य केंद्र या PHC जाएं। देरी न करें।'
    },
    Red: {
      en: 'EMERGENCY! Go to hospital immediately or call ambulance 108 right now!',
      te: 'అత్యవసరం! వెంటనే ఆసుపత్రికి వెళ్ళండి లేదా 108 కి కాల్ చేయండి!',
      hi: 'आपातकाल! तुरंत अस्पताल जाएं या 108 पर एम्बुलेंस बुलाएं!'
    }
  };

  const lang = language || 'en';
  const advice = adviceMap[severity][lang] || adviceMap[severity]['en'];

  return {
    severity,
    possible_conditions: ['Please consult a doctor for proper diagnosis'],
    immediate_action: advice,
    home_remedies: [
      'Drink plenty of water',
      'Rest well',
      'Eat light food like rice and dal'
    ],
    warning_signs: [
      'If symptoms worsen suddenly',
      'If fever goes above 103°F (39.4°C)',
      'If unable to eat or drink'
    ],
    doctor_needed: severity !== 'Green',
    emergency: severity === 'Red',
    advice,
    medicines_otc: [],
    diet_advice: 'Eat light food, drink lots of water and rest well.',
    follow_up: severity === 'Green'
      ? 'If no improvement in 2 days, visit a doctor'
      : 'Follow doctor\'s advice'
  };
}

// ============================================
// @route POST /api/health/symptom-check
// ============================================
router.post('/symptom-check', protect, async (req, res) => {
  try {
    const {
      familyMemberName,
      age,
      ageGroup,
      gender,
      symptoms,
      duration,
      village,
      additionalInfo,
      language
    } = req.body;

    // Validation
    if (!familyMemberName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Patient name is required'
      });
    }
    if (!symptoms || symptoms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one symptom is required'
      });
    }
    if (!age || isNaN(age)) {
      return res.status(400).json({
        success: false,
        message: 'Valid age is required'
      });
    }

    const lang = language || req.user.language || 'en';

    console.log(`\n🏥 ===== SYMPTOM CHECK =====`);
    console.log(`Patient: ${familyMemberName}, ${age}y, ${gender}, ${ageGroup}`);
    console.log(`Symptoms: ${symptoms.join(', ')}`);
    console.log(`Language: ${lang}`);

    // Try Gemini first
    let analysis = await analyzeWithGemini({
      name: familyMemberName,
      age,
      ageGroup: ageGroup || 'adult',
      gender: gender || 'Male',
      symptoms,
      duration: duration || 'today',
      additionalInfo,
      language: lang
    });

    // Fallback to rule-based if Gemini fails
    if (!analysis) {
      console.log('⚠️ Using rule-based fallback');
      analysis = ruleBasedAnalysis(
        symptoms,
        ageGroup || 'adult',
        duration || 'today',
        lang
      );
    }

    const severityLevel = analysis.severity || 'Yellow';

    // Save to database with ALL fields
    const record = await HealthRecord.create({
      userId: req.user.id,
      familyMemberName: familyMemberName.trim(),
      age: parseInt(age),
      ageGroup: ageGroup || 'adult',
      gender: gender || 'Male',
      symptoms,
      duration: duration || 'today',
      additionalInfo: additionalInfo || '',
      analysis: JSON.stringify(analysis),
      severityLevel,
      village: village || 'Unknown',
      language: lang,
      status: 'pending'
    });

    console.log(`✅ Saved health record: ${record._id}, Severity: ${severityLevel}`);

    res.status(201).json({
      success: true,
      data: {
        recordId: record._id,
        severityLevel,
        analysis,
        familyMemberName,
        gender: gender || 'Male',
        age,
        ageGroup: ageGroup || 'adult',
        symptoms,
        duration: duration || 'today',
        language: lang
      }
    });

  } catch (error) {
    console.log('❌ Symptom check error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
      error: error.message
    });
  }
});

// ============================================
// @route GET /api/health/cases
// For field officers and doctors to view village cases
// ============================================
router.get('/cases', protect, async (req, res) => {
  try {
    const { village } = req.query;

    if (!village) {
      return res.status(400).json({
        success: false,
        message: 'Village is required'
      });
    }

    const cases = await HealthRecord.find({ village })
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 });

    // Epidemic detection — symptoms appearing 5+ times in last 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const recentCases = cases.filter(c => c.createdAt >= threeDaysAgo);

    const symptomCount = {};
    recentCases.forEach(c => {
      c.symptoms.forEach(s => {
        const key = s.toLowerCase().trim();
        symptomCount[key] = (symptomCount[key] || 0) + 1;
      });
    });

    const epidemicWarning = Object.entries(symptomCount)
      .filter(([_, count]) => count >= 5)
      .map(([symptom]) => symptom);

    // Stats
    const stats = {
      total: cases.length,
      red: cases.filter(c => c.severityLevel === 'Red').length,
      yellow: cases.filter(c => c.severityLevel === 'Yellow').length,
      green: cases.filter(c => c.severityLevel === 'Green').length,
      pending: cases.filter(c => c.status === 'pending').length,
      resolved: cases.filter(c => c.status === 'resolved').length,
      recentCount: recentCases.length
    };

    res.json({
      success: true,
      count: cases.length,
      epidemicWarning,
      stats,
      data: cases
    });

  } catch (error) {
    console.log('Health cases error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route PUT /api/health/cases/:id
// Field officer updates case status
// ============================================
router.put('/cases/:id', protect, async (req, res) => {
  try {
    const { status, workerNote } = req.body;

    const validStatuses = ['pending', 'visited', 'advised', 'referred', 'resolved'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const record = await HealthRecord.findByIdAndUpdate(
      req.params.id,
      {
        ...(status && { status }),
        ...(workerNote !== undefined && { workerNote })
      },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Health record not found'
      });
    }

    res.json({ success: true, data: record });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route POST /api/health/family-cards
// ============================================
router.post('/family-cards', protect, async (req, res) => {
  try {
    const {
      memberName, age, gender, bloodGroup,
      conditions, medications, vaccinations,
      emergencyContact, emergencyName, notes, sharedWith
    } = req.body;

    if (!memberName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Member name is required'
      });
    }
    if (!age || isNaN(age)) {
      return res.status(400).json({
        success: false,
        message: 'Valid age is required'
      });
    }

    const card = await FamilyCard.create({
      userId: req.user.id,
      memberName: memberName.trim(),
      age: parseInt(age),
      gender: gender || 'Female',
      bloodGroup: bloodGroup || 'Unknown',
      conditions: conditions || [],
      medications: medications || [],
      vaccinations: vaccinations || [],
      emergencyContact: emergencyContact || '',
      emergencyName: emergencyName || '',
      notes: notes || '',
      sharedWith: sharedWith || 'private'
    });

    res.status(201).json({ success: true, data: card });

  } catch (error) {
    console.log('Family card error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route GET /api/health/family-cards
// ============================================
router.get('/family-cards', protect, async (req, res) => {
  try {
    const cards = await FamilyCard.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, count: cards.length, data: cards });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route DELETE /api/health/family-cards/:id
// ============================================
router.delete('/family-cards/:id', protect, async (req, res) => {
  try {
    const card = await FamilyCard.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Health card not found'
      });
    }

    await FamilyCard.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Health card deleted successfully' });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// ============================================
// @route GET /api/health/history
// User's own health check history
// ============================================
router.get('/history', protect, async (req, res) => {
  try {
    const records = await HealthRecord.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      count: records.length,
      data: records
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
// @route GET /api/health/stats/:village
// Village health statistics for dashboard
// ============================================
router.get('/stats/:village', protect, async (req, res) => {
  try {
    const village = req.params.village;
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalCases, recentCases] = await Promise.all([
      HealthRecord.find({ village }).countDocuments(),
      HealthRecord.find({ village, createdAt: { $gte: last30Days } })
    ]);

    const symptomCount = {};
    recentCases.forEach(c => {
      c.symptoms.forEach(s => {
        const key = s.toLowerCase().trim();
        symptomCount[key] = (symptomCount[key] || 0) + 1;
      });
    });

    const topSymptoms = Object.entries(symptomCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([symptom, count]) => ({ symptom, count }));

    res.json({
      success: true,
      data: {
        totalCases,
        recentCases: recentCases.length,
        redCases: recentCases.filter(c => c.severityLevel === 'Red').length,
        yellowCases: recentCases.filter(c => c.severityLevel === 'Yellow').length,
        greenCases: recentCases.filter(c => c.severityLevel === 'Green').length,
        topSymptoms
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
