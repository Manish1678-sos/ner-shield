import axios from 'axios';
export async function predictRisk(input) {
  try {
    const { data } = await axios.post(`${process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000'}/predict`, input, { timeout: 1800 });
    return data;
  } catch {
    const score = Math.min(1, Number((input.rainfall_24h * .0025 + input.soil_moisture * .004 + input.slope_angle * .012 + input.elevation * .00012 + input.road_condition * .18).toFixed(2)));
    return { riskScore: score, classification: score > .8 ? 'BLOCKED' : score > .6 ? 'HIGH RISK' : score > .3 ? 'MODERATE' : 'SAFE' };
  }
}
