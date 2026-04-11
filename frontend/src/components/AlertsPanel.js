// src/components/AlertsPanel.js
import React from 'react';

function AlertsPanel({ alerts, getRiskColor }) {
  return (
    <div className="alerts-section">
      <div className="section-title">Fire Alerts - Threshold Breaches</div>
      {alerts.length === 0 ? (
        <div className="no-data">No alerts. Fire risk is within safe limits.</div>
      ) : (
        <table className="alerts-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Probability</th>
              <th>Risk</th>
              <th>Flame Hits</th>
              <th>Action</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={i}>
                <td><strong>{a.nodeId}</strong></td>
                <td>
                  <span
                    className="aqi-badge"
                    style={{
                      background: getRiskColor(a.fireProbability),
                      color: a.fireProbability <= 50 ? '#222' : '#fff'
                    }}
                  >
                    {a.fireProbability}%
                  </span>
                </td>
                <td>{a.riskLevel}</td>
                <td>{Array.isArray(a.flame) ? a.flame.filter(Boolean).length : 0}/5</td>
                <td>{a.decision?.relayOn || a.decision?.buzzerOn ? 'AUTO ON' : 'NO ACTION'}</td>
                <td>{new Date(a.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AlertsPanel;
