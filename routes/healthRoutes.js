const express = require('express');
const router = express.Router();
const axios = require('axios');
const HealthRecord = require('../models/HealthRecord');
const FamilyCard = require('../models/FamilyCard');
const { protect } = require('../middleware/authMiddleware');

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

// ============================================
// AI SYMPTOM ANALYSIS
// ============================================
async function analyzeWithGemini(patientInfo) {
  try {
    const { name, age, ageGroup, gender, symptoms, duration, additionalInfo } = patientInfo;

    const prompt = `You are a medical expert helping rural Indian villagers. Analyze these symptoms carefully.

Patient: ${name}, ${age} years old (${ageGroup}), ${gender}
Symptoms: ${symptoms.join(', ')}
Duration: ${duration}
Additional info: ${additionalInfo || 'None'}

Consider the patient age, gender and medical history carefully.
Return ONLY valid JSON no other text:
{
  "severity": "Green/Yellow/Red",
  "possible_conditions": ["condition1", "condition2"],
  "immediate_action": "what to do right now in simple words",
  "home_remedies": ["remedy1", "remedy2", "remedy3"],
  "warning_signs": ["sign1", "sign2"],
  "doctor_needed": true/false,
  "emergency": true/false,
  "advice": "detailed practical advice for Indian villager",
  "medicines_otc": ["safe over counter medicine if any"],
  "diet_advice": "what to eat and avoid"
}`;

    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    let text = response.data.candidates[0].content.parts[0].text.trim();
    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }

    return JSON.parse(text);
  } catch (error) {
    console.log('Gemini health error:', error.message);
    return null;
  }
}

// Fallback rule-based analysis
function ruleBasedAnalysis(symptoms, ageGroup) {
  const redSymptoms = [
    'chest pain', 'difficulty breathing', 'unconscious',
    'seizure', 'severe bleeding', 'high fever'
  ];
  const yellowSymptoms = [
    'fever', 'vomiting', 'diarrhea', 'headache',
    'body pain', 'weakness', 'cough', 'cold', 'rash'
  ];

  const lower = symptoms.map(s => s.toLowerCase());
  let severity = 'Green';

  for (let s of redSymptoms) {
    if (lower.some(sym => sym.includes(s))) { severity = 'Red'; break; }
  }
  if (severity !== 'Red') {
    for (let s of yellowSymptoms) {
      if (lower.some(sym => sym.includes(s))) { severity = 'Yellow'; break; }
    }
  }

  if (ageGroup === 'child' || ageGroup === 'elderly') {
    if (severity === 'Green') severity = 'Yellow';
    else if (severity === 'Yellow') severity = 'Red';
  }

  const advice = {
    Green: 'Rest at home, drink plenty of fluids, monitor symptoms.',
    Yellow: 'Visit your nearest health center or PHC today.',
    Red: 'Go to hospital immediately! Call 108 for ambulance.'
  };

  return {
    severity,
    possible_conditions: ['Please consult a doctor for proper diagnosis'],
    immediate_action: advice[severity],
    home_remedies: ['Drink plenty of water', 'Rest well', 'Eat light food'],
    warning_signs: ['If symptoms worsen', 'If fever goes above 103°F'],
    doctor_needed: severity !== 'Green',
    emergency: severity === 'Red',
    advice: advice[severity],
    medicines_otc: [],
    diet_advice: 'Eat light food, drink lots of water and rest well.'
  };
}

// @route POST /api/health/symptom-check
router.post('/symptom-check', protect, async (req, res) => {
  try {
    const {
      familyMemberName, age, ageGroup, gender, symptoms,
      duration, village, additionalInfo
    } = req.body;

    if (!symptoms || symptoms.length === 0) {
      return res.status(400).json({ message: 'At least one symptom required' });
    }

    console.log(`Analyzing symptoms for ${familyMemberName}, ${gender}, age ${age}`);

    let analysis = await analyzeWithGemini({
      name: familyMemberName,
      age, ageGroup, gender, symptoms, duration, additionalInfo
    });

    if (!analysis) {
      console.log('Using rule-based fallback');
      analysis = ruleBasedAnalysis(symptoms, ageGroup);
    }

    const severityLevel = analysis.severity || 'Yellow';

    const record = await HealthRecord.create({
      userId: req.user.id,
      familyMemberName,
      age: parseInt(age) || 0,
      ageGroup: ageGroup || 'adult',
      gender: gender || 'Male',
      symptoms,
      duration,
      severityLevel,
      village,
      status: 'pending',
      analysis: JSON.stringify(analysis),
      additionalInfo: additionalInfo || ''
    });

    res.status(201).json({
      success: true,
      data: {
        recordId: record._id,
        severityLevel,
        analysis,
        familyMemberName,
        gender,
        age,
        symptoms,
        duration
      }
    });

  } catch (error) {
    console.log('Symptom check error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/health/cases
router.get('/cases', protect, async (req, res) => {
  try {
    const { village } = req.query;
    const cases = await HealthRecord.find({ village })
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 });

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const recentCases = cases.filter(c => c.createdAt >= threeDaysAgo);
    const symptomCount = {};
    recentCases.forEach(c => {
      c.symptoms.forEach(s => {
        symptomCount[s] = (symptomCount[s] || 0) + 1;
      });
    });

    const epidemicWarning = Object.entries(symptomCount)
      .filter(([_, count]) => count >= 5)
      .map(([symptom]) => symptom);

    res.json({
      success: true,
      count: cases.length,
      epidemicWarning,
      data: cases
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route PUT /api/health/cases/:id
router.put('/cases/:id', protect, async (req, res) => {
  try {
    const { status, workerNote } = req.body;
    const record = await HealthRecord.findByIdAndUpdate(
      req.params.id,
      { status, workerNote },
      { new: true }
    );
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/health/family-cards
router.post('/family-cards', protect, async (req, res) => {
  try {
    const {
      memberName, age, gender, bloodGroup,
      conditions, medications, vaccinations,
      emergencyContact, emergencyName, notes, sharedWith
    } = req.body;

    const card = await FamilyCard.create({
      userId: req.user.id,
      memberName,
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/health/family-cards
router.get('/family-cards', protect, async (req, res) => {
  try {
    const cards = await FamilyCard.find({ userId: req.user.id });
    res.json({ success: true, data: cards });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route DELETE /api/health/family-cards/:id
router.delete('/family-cards/:id', protect, async (req, res) => {
  try {
    await FamilyCard.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/health/history
// @route GET /api/health/history
router.get('/history', protect, async (req, res) => {
  try {
    const records = await HealthRecord.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;