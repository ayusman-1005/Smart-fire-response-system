// src/components/NodeCard.js
import React from 'react';

function NodeCard({ node, selected, onSelect, riskColor }) {
  const latest = node.latest || {};
  const timeSince = node.lastSeen
    ? Math.floor((Date.now() - new Date(node.lastSeen)) / 1000)
    : null;

  const timeLabel = timeSince === null
    ? 'Never seen'
    : timeSince < 60
    ? `${timeSince}s ago`
    : timeSince < 3600
    ? `${Math.floor(timeSince / 60)}m ago`
    : `${Math.floor(timeSince / 3600)}h ago`;

  const flameHits = Array.isArray(latest.flame) ? latest.flame.filter(Boolean).length : 0;
  const gasAvg = Array.isArray(latest.mq2) && latest.mq2.length
    ? (latest.mq2.reduce((s, v) => s + Number(v || 0), 0) / latest.mq2.length).toFixed(1)
    : '--';

  return (
    <div
      className={`node-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      style={{ borderTop: `4px solid ${riskColor}` }}
    >
      <div className="card-header">
        <span className="card-title">{node.name || node.nodeId}</span>
        <span className="card-time">{timeLabel}</span>
      </div>

      <div className="card-aqi" style={{ color: riskColor }}>
        {latest.fireProbability ?? node.lastProbability ?? '--'}
        <span className="card-aqi-label">%</span>
      </div>

      <div className="card-category">{latest.riskLevel || node.lastRisk || '--'}</div>

      <div className="card-metrics">
        <div className="metric">
          <span className="metric-label">Flame Hits</span>
          <span className="metric-value">{flameHits} <small>/5</small></span>
        </div>
        <div className="metric">
          <span className="metric-label">MQ2 Avg</span>
          <span className="metric-value">{gasAvg}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Relay</span>
          <span className="metric-value">{node.actuatorState?.relayOn ? 'ON' : 'OFF'}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Buzzer</span>
          <span className="metric-value">{node.actuatorState?.buzzerOn ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    </div>
  );
}

export default NodeCard;
