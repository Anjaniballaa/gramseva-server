const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const response = await axios.get(
      'http://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone'
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Location fetch failed' });
  }
});

module.exports = router;