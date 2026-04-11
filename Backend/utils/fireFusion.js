// utils/fireFusion.js

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function avg(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + Number(v || 0), 0) / values.length;
}

function computeFireEstimate({ flame, mq2, dht }) {
  const flameList = Array.isArray(flame) ? flame : [];
  const mq2List = Array.isArray(mq2) ? mq2 : [];
  const dhtList = Array.isArray(dht) ? dht : [];

  const flameHits = flameList.filter(Boolean).length;
  const flameScore = flameList.length > 0 ? flameHits / flameList.length : 0;

  const gasAverage = avg(mq2List);
  const gasScore = clamp((gasAverage - 200) / 500, 0, 1);

  const hottest = dhtList.reduce((max, d) => Math.max(max, Number(d?.temperature || 0)), 0);
  const driest = dhtList.reduce((min, d) => Math.min(min, Number(d?.humidity ?? 100)), 100);
  const tempScore = clamp((hottest - 30) / 40, 0, 1);
  const humidityScore = clamp((45 - driest) / 35, 0, 1);

  // Initial rule-based fusion. This can be replaced later with a trained model.
  const probability = Math.round(
    (0.45 * flameScore + 0.3 * gasScore + 0.2 * tempScore + 0.05 * humidityScore) * 100
  );

  let riskLevel = 'LOW';
  if (probability >= 80) riskLevel = 'CRITICAL';
  else if (probability >= 60) riskLevel = 'HIGH';
  else if (probability >= 35) riskLevel = 'MEDIUM';

  return {
    fireProbability: probability,
    riskLevel,
    features: {
      flameHits,
      gasAverage,
      hottest,
      driest
    }
  };
}

function decideActuation({ fireProbability, riskLevel, flame }) {
  const autoThreshold = Number(process.env.FIRE_AUTO_THRESHOLD || 70);
  const flameHits = Array.isArray(flame) ? flame.filter(Boolean).length : 0;
  const trigger = fireProbability >= autoThreshold || riskLevel === 'CRITICAL' || flameHits >= 3;

  return {
    relayOn: trigger,
    buzzerOn: trigger,
    mode: 'auto',
    source: 'fusion-engine'
  };
}

module.exports = {
  computeFireEstimate,
  decideActuation
};
