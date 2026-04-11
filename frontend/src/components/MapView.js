// src/components/MapView.js
import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapView({ summary, getRiskColor }) {
  // Default center: if nodes have locations use theirs, else fallback to a world center
  const center = summary.length > 0 && summary[0].location?.lat
    ? [summary[0].location.lat, summary[0].location.lng]
    : [20, 78]; // India center

  return (
    <div className="map-section">
      <div className="section-title">Node Locations - Live Fire Risk</div>
      <div style={{ height: '500px', borderRadius: '12px', overflow: 'hidden' }}>
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
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
                  Flame hits: {Array.isArray(node.latest?.flame) ? node.latest.flame.filter(Boolean).length : 0}/5<br />
                  Relay: {node.actuatorState?.relayOn ? 'ON' : 'OFF'}<br />
                  Buzzer: {node.actuatorState?.buzzerOn ? 'ON' : 'OFF'}
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
