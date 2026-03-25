const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

// ============================================
// GET CROP ADVISORY FROM GEMINI
// ============================================
async function getCropAdvisoryFromGemini(lat, lon, locationName, month, weather) {
  try {
    const monthName = new Date(2024, month - 1, 1).toLocaleString('en-IN', { month: 'long' });
    const prompt = `You are an expert Indian agricultural advisor. Give crop advisory for a farmer.

Location: ${locationName} (Latitude: ${lat}, Longitude: ${lon})
Current Month: ${monthName}
Current Weather: Temperature ${weather.temp}°C, Humidity ${weather.humidity}%, ${weather.description}

Based on the exact geographic location and current month, provide crop advisory.
Consider the region's soil type, climate zone, rainfall pattern, and traditional farming practices.

Return ONLY valid JSON:
{
  "region": "state/region name detected from coordinates",
  "season": "current farming season name",
  "recommended_crops": ["crop1", "crop2", "crop3", "crop4", "crop5"],
  "avoid_crops": ["crop to avoid this month"],
  "seasonal_tip": "one practical farming tip for this month in this region",
  "soil_prep": "soil preparation advice for this region",
  "irrigation_tip": "irrigation advice based on current weather",
  "pest_alert": "any pest/disease risk based on current weather and region",
  "market_tip": "which crop is profitable this season in this region"
}`;

    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    let text = response.data.candidates[0].content.parts[0].text.trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0].trim();
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0].trim();

    return JSON.parse(text);
  } catch (error) {
    console.log('Gemini crop advisory error:', error.message);
    return null;
  }
}

// ============================================
// BUILD FORECAST FROM RAW LIST
// ============================================
function buildForecast(rawList) {
  const dailyMap = {};
  rawList.forEach(item => {
    const date = item.dt_txt.split(' ')[0];
    const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0]);
    if (!dailyMap[date]) {
      dailyMap[date] = item;
    } else {
      const existingHour = parseInt(dailyMap[date].dt_txt.split(' ')[1].split(':')[0]);
      if (Math.abs(hour - 12) < Math.abs(existingHour - 12)) {
        dailyMap[date] = item;
      }
    }
  });

  return Object.entries(dailyMap).slice(0, 7).map(([date, item], index) => {
    const dateObj = new Date(date + 'T12:00:00');
    let dayLabel;
    if (index === 0) dayLabel = 'Today';
    else if (index === 1) dayLabel = 'Tomorrow';
    else dayLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

    return {
      date,
      day: dayLabel,
      temp: Math.round(item.main.temp),
      temp_min: Math.round(item.main.temp_min),
      temp_max: Math.round(item.main.temp_max),
      description: item.weather[0].description,
      icon: item.weather[0].icon,
      humidity: item.main.humidity,
      wind_speed: Math.round(item.wind.speed * 3.6),
      rainfall: item.rain ? item.rain['3h'] || 0 : 0
    };
  });
}

// ============================================
// BUILD WEATHER ADVISORY
// ============================================
function buildAdvisory(forecast) {
  const advisory = [];
  forecast.forEach(day => {
    if (day.humidity > 80) advisory.push(`${day.day}: High humidity — risk of fungal disease. Avoid spraying.`);
    if (day.description.includes('rain')) advisory.push(`${day.day}: Rain expected — avoid pesticide application.`);
    if (day.temp > 35) advisory.push(`${day.day}: High temperature — ensure adequate irrigation.`);
    if (day.temp < 10) advisory.push(`${day.day}: Cold weather — protect crops from frost.`);
  });
  return advisory;
}

// ============================================
// @route GET /api/weather?lat=x&lon=y&locationName=x
// ============================================
router.get('/', protect, async (req, res) => {
  try {
    const { lat, lon, locationName } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!lat || !lon) return res.status(400).json({ message: 'lat and lon required' });

    const [currentRes, forecastRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
      axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
    ]);

    const current = {
      temp: Math.round(currentRes.data.main.temp),
      feels_like: Math.round(currentRes.data.main.feels_like),
      temp_min: Math.round(currentRes.data.main.temp_min),
      temp_max: Math.round(currentRes.data.main.temp_max),
      humidity: currentRes.data.main.humidity,
      wind_speed: Math.round(currentRes.data.wind.speed * 3.6),
      description: currentRes.data.weather[0].description,
      icon: currentRes.data.weather[0].icon,
      pressure: currentRes.data.main.pressure,
      visibility: currentRes.data.visibility,
      sunrise: currentRes.data.sys.sunrise,
      sunset: currentRes.data.sys.sunset,
      cloudcover: currentRes.data.clouds.all,
      precipitation: currentRes.data.rain?.['1h'] || 0,
      city: currentRes.data.name
    };

    const forecast = buildForecast(forecastRes.data.list);
    const advisory = buildAdvisory(forecast);
    const currentMonth = new Date().getMonth() + 1;
    const placeName = locationName || current.city;

    // Get dynamic crop advisory from Gemini
    const cropAdvisory = await getCropAdvisoryFromGemini(lat, lon, placeName, currentMonth, current);

    res.json({
      success: true,
      city: current.city,
      current,
      forecast,
      advisory,
      cropAdvisory
    });

  } catch (error) {
    console.log('Weather error:', error.message);
    res.status(500).json({ message: 'Weather fetch failed', error: error.message });
  }
});

// ============================================
// @route GET /api/weather/:village (fallback)
// ============================================
router.get('/:village', protect, async (req, res) => {
  try {
    const village = req.params.village;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    const [currentRes, forecastRes] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${village},IN&appid=${apiKey}&units=metric`),
      axios.get(`https://api.openweathermap.org/data/2.5/forecast?q=${village},IN&appid=${apiKey}&units=metric`)
    ]);

    const current = {
      temp: Math.round(currentRes.data.main.temp),
      feels_like: Math.round(currentRes.data.main.feels_like),
      temp_min: Math.round(currentRes.data.main.temp_min),
      temp_max: Math.round(currentRes.data.main.temp_max),
      humidity: currentRes.data.main.humidity,
      wind_speed: Math.round(currentRes.data.wind.speed * 3.6),
      description: currentRes.data.weather[0].description,
      icon: currentRes.data.weather[0].icon,
      pressure: currentRes.data.main.pressure,
      visibility: currentRes.data.visibility,
      sunrise: currentRes.data.sys.sunrise,
      sunset: currentRes.data.sys.sunset,
      cloudcover: currentRes.data.clouds.all,
      precipitation: currentRes.data.rain?.['1h'] || 0,
      city: currentRes.data.name
    };

    const forecast = buildForecast(forecastRes.data.list);
    const advisory = buildAdvisory(forecast);
    const currentMonth = new Date().getMonth() + 1;

    const cropAdvisory = await getCropAdvisoryFromGemini(
      currentRes.data.coord.lat,
      currentRes.data.coord.lon,
      village,
      currentMonth,
      current
    );

    res.json({
      success: true,
      village,
      city: current.city,
      current,
      forecast,
      advisory,
      cropAdvisory
    });

  } catch (error) {
    console.log('Weather village error:', error.message);
    res.status(500).json({ message: 'Weather fetch failed', error: error.message });
  }
});

module.exports = router;