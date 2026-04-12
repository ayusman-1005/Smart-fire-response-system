// src/components/AlertsPanel.js
import React, { useState } from 'react';
import axios from 'axios';

function AlertsPanel({ alerts, getRiskColor, API, stopAlarm }) {
  const [acking, setAcking] = useState({});

  const handleAck = async (alertId) => {
    setAcking(p => ({ ...p, [alertId]: true }));
    try {
      await axios.post(`${API}/alerts/${alertId}/ack`);
      stopAlarm();
    } catch(err) {
      console.error('Failed to ack', err);
    }
  };

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
              <th>Action</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <tr key={React.useId()}>
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
                <td>{a.decision?.relayOn || a.decision?.buzzerOn ? 'AUTO ACTUATED' : 'NO ACTION'}</td>
                <td>
                  {a.acknowledged ? (
                    <span style={{color: '#32d74b'}}>Acknowledged</span>
                  ) : (
                    <button 
                       className="action-btn warn" 
                       style={{padding: '4px 8px'}} 
                       disabled={acking[a._id]}
                       onClick={() => handleAck(a._id)}>
                       Acknowledge
                    </button>
                  )}
                </td>
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
