// src/components/NodeCard.js
import React from 'react';

function NodeCard({ node, selected, onSelect, riskColor }) {
  const OFFLINE_THRESHOLD_SEC = 5 * 60;
  const latest = node.latest || {};
  const timeSince = node.lastSeen
    ? Math.floor((Date.now() - new Date(node.lastSeen)) / 1000)
    : null;
  const isOffline = timeSince === null || timeSince > OFFLINE_THRESHOLD_SEC;

  const timeLabel = isOffline
    ? 'Offline'
    : timeSince < 60
    ? `${timeSince}s ago`
    : timeSince < 3600
    ? `${Math.floor(timeSince / 60)}m ago`
    : `${Math.floor(timeSince / 3600)}h ago`;

  const displayRiskColor = isOffline ? '#7a8ca3' : riskColor;
  const probability = isOffline ? '--' : (latest.fireProbability ?? node.lastProbability ?? '--');
  const categoryLabel = isOffline ? 'OFFLINE' : (latest.riskLevel || node.lastRisk || '--');

  const flameHits = Array.isArray(latest.flame) ? latest.flame.filter(Boolean).length : 0;
  const gasAvg = Array.isArray(latest.mq2) && latest.mq2.length
    ? (latest.mq2.reduce((s, v) => s + Number(v || 0), 0) / latest.mq2.length).toFixed(1)
    : '--';
  const tempMax = Array.isArray(latest.dht) && latest.dht.length
    ? Math.max(...latest.dht.map(d => d.temperature || 0)).toFixed(1)
    : '--';
  const humMin = Array.isArray(latest.dht) && latest.dht.length
    ? Math.min(...latest.dht.map(d => d.humidity || 100)).toFixed(1)
    : '--';

  return (
    <div
      className={`node-card ${selected ? 'selected' : ''} ${isOffline ? 'offline' : ''}`}
      onClick={onSelect}
      style={{ borderTop: `4px solid ${displayRiskColor}` }}
    >
      <div className="card-header">
        <span className="card-title">{node.name || node.nodeId}</span>
        <span className="card-time">{timeLabel}</span>
      </div>

      <div className="card-aqi" style={{ color: displayRiskColor }}>
        {probability}
        {probability !== '--' && <span className="card-aqi-label">%</span>}
      </div>

      <div className={`card-category ${isOffline ? 'offline' : ''}`}>{categoryLabel}</div>

      <div className="card-metrics">
        <div className="metric">
          <span className="metric-label">Temperature</span>
          <span className="metric-value">{tempMax} <small>{'\u00B0C'}</small></span>
        </div>
        <div className="metric">
          <span className="metric-label">Humidity</span>
          <span className="metric-value">{humMin} <small>%</small></span>
        </div>
        <div className="metric">
          <span className="metric-label">Flame Hits</span>
          <span className="metric-value">{flameHits} <small>/5</small></span>
        </div>
        <div className="metric">
          <span className="metric-label">MQ2 Avg</span>
          <span className="metric-value">{gasAvg} <small>ppm</small></span>
        </div>
        <div className="metric">
          <span className="metric-label">Water Pump</span>
          <span className="metric-value">{node.actuatorState?.relayOn ? 'ON' : 'OFF'}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Siren</span>
          <span className="metric-value">{node.actuatorState?.buzzerOn ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    </div>
  );
}

export default NodeCard;
