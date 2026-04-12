// src/components/MapView.js
import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapView({ summary, getRiskColor }) {
  const center = [22.2515, 84.9020]; // Default centered at NIT Rourkela

  return (
    <div className="map-section">
      <div className="section-title">City-Level Fire Map (NIT Rourkela)</div>
      <div style={{ height: '600px', borderRadius: '12px', overflow: 'hidden' }}>
        <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {summary.map(node => {
            if (!node.location?.lat) return null;
            const probability = node.latest?.fireProbability ?? node.lastProbability ?? 0;
            const color = getRiskColor(probability);
            return (
              <CircleMarker
                key={node.nodeId}
                center={[node.location.lat, node.location.lng]}
                radius={20}
                fillColor={color}
                color="#fff"
                weight={2}
                opacity={0.9}
                fillOpacity={0.75}
              >
                <Popup>
                  <strong>{node.name || node.nodeId}</strong><br />
                  Fire Probability: <strong style={{ color }}>{probability}%</strong><br />
                  Risk: {node.latest?.riskLevel || node.lastRisk || '--'}<br />
                  Temp: {Array.isArray(node.latest?.dht) && node.latest.dht.length ? Math.max(...node.latest.dht.map(d => d.temperature || 0)).toFixed(1) : '--'}°C<br />
                  Avg Gas: {Array.isArray(node.latest?.mq2) && node.latest.mq2.length ? (node.latest.mq2.reduce((a,b)=>a+b,0)/node.latest.mq2.length).toFixed(1) : '--'} ppm<br />
                  Flame hits: {Array.isArray(node.latest?.flame) ? node.latest.flame.filter(Boolean).length : 0}/5<br />
                  Water Pump: {node.actuatorState?.relayOn ? 'ON' : 'OFF'}<br />
                  Siren: {node.actuatorState?.buzzerOn ? 'ON' : 'OFF'}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* AQI Legend */}
      <div className="map-legend">
        {[
          { label: 'Low', color: '#32d74b', range: '0–34%' },
          { label: 'Medium', color: '#ffd60a', range: '35–59%' },
          { label: 'High', color: '#ff8c00', range: '60–79%' },
          { label: 'Critical', color: '#ff3b30', range: '80–100%' }
        ].map(item => (
          <div key={item.label} className="legend-item">
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.label} ({item.range})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MapView;
