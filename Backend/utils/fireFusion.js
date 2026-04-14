// utils/fireFusion.js

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function avg(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + Number(v || 0), 0) / values.length;
}

function computeFireEstimate({ flame, mq2, dht, history }) {
  const flameList = Array.isArray(flame) ? flame : [];
  const mq2List = Array.isArray(mq2) ? mq2 : [];
  const dhtList = Array.isArray(dht) ? dht : [];

  const flameHits = flameList.filter(Boolean).length;
  const flameScore = flameList.length > 0 ? flameHits / flameList.length : 0;

  const gasAverage = avg(mq2List);
  const gasScore = clamp((gasAverage - 200) / 500, 0, 1);

  const hottest = dhtList.reduce((max, d) => Math.max(max, Number(d?.temperature || 0)), 0);
  const driest = dhtList.reduce((min, d) => Math.min(min, Number(d?.humidity ?? 100)), 100);

  let tempChangeRate = 0;
  if (Array.isArray(history) && history.length > 0) {
    const pastValid = history.filter(h => h.dht && h.dht.length > 0);
    if (pastValid.length > 0) {
       const oldest = pastValid[0].dht.reduce((max, d) => Math.max(max, Number(d?.temperature || 0)), 0);
       const dt = hottest - oldest;
       // Temp score is primarily based on sudden spikes now
       tempChangeRate = clamp(dt / 10, 0, 1); 
    }
  }

  // Base heat score (if it's above 45C independently, still adds risk)
  const baseTempScore = clamp((hottest - 45) / 30, 0, 1); 
  const totalTempScore = Math.max(baseTempScore, tempChangeRate);

  const humidityScore = clamp((35 - driest) / 25, 0, 1);

  // Adjusted weights to favor sudden heat waves over static hot summer days (totalTempScore vs tempChangeRate logic overhead)
  const probability = Math.round(
    (0.40 * flameScore + 0.35 * gasScore + 0.20 * totalTempScore + 0.05 * humidityScore) * 100
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
  const flameList = Array.isArray(flame) ? flame : [];
  const flameHits = flameList.filter(Boolean).length;
  const allFlamesDetected = flameList.length > 0 && flameList.every((v) => Boolean(v));
  const trigger = allFlamesDetected || fireProbability >= autoThreshold || riskLevel === 'CRITICAL' || flameHits >= 3;

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
