// utils/aqiCalculator.js
// EPA standard AQI formula using PM2.5 breakpoints

const PM25_BREAKPOINTS = [
  { cLow: 0.0,   cHigh: 12.0,  iLow: 0,   iHigh: 50,  category: 'Good',                       color: '#00e400' },
  { cLow: 12.1,  cHigh: 35.4,  iLow: 51,  iHigh: 100, category: 'Moderate',                    color: '#ffff00' },
  { cLow: 35.5,  cHigh: 55.4,  iLow: 101, iHigh: 150, category: 'Unhealthy for Sensitive Groups', color: '#ff7e00' },
  { cLow: 55.5,  cHigh: 150.4, iLow: 151, iHigh: 200, category: 'Unhealthy',                   color: '#ff0000' },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300, category: 'Very Unhealthy',              color: '#8f3f97' },
  { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500, category: 'Hazardous',                   color: '#7e0023' }
];

/**
 * Calculate AQI from PM2.5 concentration (µg/m³)
 * Returns { aqi, category, color }
 */
function calculateAQI(pm25) {
  if (pm25 < 0) return { aqi: 0, category: 'Good', color: '#00e400' };

  const bp = PM25_BREAKPOINTS.find(b => pm25 >= b.cLow && pm25 <= b.cHigh);

  if (!bp) {
    // Above hazardous range
    return { aqi: 500, category: 'Hazardous', color: '#7e0023' };
  }

  // Linear interpolation formula
  const aqi = Math.round(
    ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow
  );

  return {
    aqi,
    category: bp.category,
    color: bp.color
  };
}

/**
 * Get health recommendation for AQI category
 */
function getRecommendation(category) {
  const recommendations = {
    'Good': 'Air quality is satisfactory. Enjoy outdoor activities.',
    'Moderate': 'Air quality is acceptable. Unusually sensitive individuals should limit prolonged outdoor exertion.',
    'Unhealthy for Sensitive Groups': 'Members of sensitive groups may experience health effects. General public is not affected.',
    'Unhealthy': 'Everyone may begin to experience health effects. Sensitive groups should limit outdoor activity.',
    'Very Unhealthy': 'Health alert: everyone may experience serious health effects. Avoid outdoor activities.',
    'Hazardous': 'Health warning — emergency conditions. Everyone should avoid all outdoor activities.'
  };
  return recommendations[category] || 'No recommendation available.';
}

module.exports = { calculateAQI, getRecommendation };
