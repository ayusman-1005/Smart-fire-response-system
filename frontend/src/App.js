import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import MapView from './components/MapView.js';
import NodeCard from './components/NodeCard.js';
import AlertsPanel from './components/AlertsPanel.js';
import StatsPanel from './components/StatsPanel.js';
import Footer from './components/Footer.js';
import './App.css';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

const API = process.env.REACT_APP_API_URL || '/api';
const POLL_INTERVAL = 8000;

function App() {
  const [summary, setSummary] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [range, setRange] = useState('24h');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [controlBusy, setControlBusy] = useState(false);
  const [manualDuration, setManualDuration] = useState('0');
  const [nodeLat, setNodeLat] = useState("");
  const [nodeLng, setNodeLng] = useState("");

  const fetchSummary = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/summary`);
      setSummary(res.data);
      if (!selectedNode && res.data.length > 0) {
        setSelectedNode(res.data[0].nodeId);
      }
    } catch (err) {
      console.error('Summary fetch error:', err.message);
    }
  }, [selectedNode]);

  const fetchHistory = useCallback(async () => {
    if (!selectedNode) return;
    try {
      const res = await axios.get(`${API}/nodes/${selectedNode}/data?range=${range}`);
      setHistory(res.data);
    } catch (err) {
      console.error('History fetch error:', err.message);
    }
  }, [selectedNode, range]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/alerts?threshold=55`);
      setAlerts(res.data);
      // Play audible alarm if there's an unacknowledged critical alert
      const hasCritical = res.data.some(a => a.fireProbability >= 80 && !a.acknowledged);
      if (hasCritical) {
         playAlarmSound();
      }
    } catch (err) {
      console.error('Alerts fetch error:', err.message);
    }
  }, []);

  const playAlarmSound = () => {
     let audio = document.getElementById('fire-alarm-sound');
     if (!audio) {
        audio = new Audio('/alarm.mp3'); // Assuming public/alarm.mp3 exists or standard beep
        audio.id = 'fire-alarm-sound';
        audio.loop = true;
        document.body.appendChild(audio);
     }
     audio.play().catch(e => console.warn('Audio play blocked by browser until interacted', e));
  };
  
  const stopAlarmSound = () => {
      const audio = document.getElementById('fire-alarm-sound');
      if (audio) {
         audio.pause();
         audio.currentTime = 0;
      }
  };

  useEffect(() => {
    const init = async () => {
      await fetchSummary();
      await fetchAlerts();
      setLoading(false);
    };

    init();
    const interval = setInterval(() => {
      fetchSummary();
      fetchAlerts();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchSummary, fetchAlerts]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const getRiskColor = (riskOrProbability) => {
    if (typeof riskOrProbability === 'number') {
      if (riskOrProbability >= 80) return '#ff3b30';
      if (riskOrProbability >= 60) return '#ff8c00';
      if (riskOrProbability >= 35) return '#ffd60a';
      return '#32d74b';
    }

    const risk = String(riskOrProbability || '').toUpperCase();
    if (risk === 'CRITICAL') return '#ff3b30';
    if (risk === 'HIGH') return '#ff8c00';
    if (risk === 'MEDIUM') return '#ffd60a';
    return '#32d74b';
  };

  const selectedNodeData = summary.find((n) => n.nodeId === selectedNode);

  // Sync coords on node change
  useEffect(() => {
     if (selectedNodeData?.location) {
        setNodeLat(selectedNodeData.location.lat || "");
        setNodeLng(selectedNodeData.location.lng || "");
     }
  }, [selectedNodeData]);

  const saveCoords = async () => {
     if (!selectedNodeData) return;
     try {
       await axios.post(`${API}/nodes/${selectedNode}/settings`, {
         name: selectedNodeData.name || selectedNode,
         lat: Number(nodeLat),
         lng: Number(nodeLng)
       });
       await fetchSummary();
       alert('Coordinates updated!');
     } catch(err) {
       console.error(err);
       alert('Failed to update coords');
     }
  }

  const sendControl = async ({ relayOn, buzzerOn, mode = 'manual', durationSec }) => {
    if (!selectedNode) return;
    setControlBusy(true);
    const resolvedDuration = typeof durationSec === 'number' ? durationSec : Number(manualDuration);

    // Optimistic UI update for faster feedback while command is in-flight.
    setSummary((prev) => prev.map((node) => {
      if (node.nodeId !== selectedNode) return node;
      return {
        ...node,
        actuatorState: {
          relayOn,
          buzzerOn,
          mode,
          updatedAt: new Date().toISOString(),
          source: 'ui-pending'
        }
      };
    }));

    try {
      await axios.post(`${API}/nodes/${selectedNode}/control`, {
        relayOn,
        buzzerOn,
        mode,
        durationSec: resolvedDuration
      });
      await fetchSummary();
      await fetchHistory();
      await fetchAlerts();
    } catch (err) {
      console.error('Control request failed:', err.message);
      await fetchSummary();
    } finally {
      setControlBusy(false);
    }
  };

  const chartData = {
    labels: history.map((r) => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [
      {
        label: 'Fire Probability %',
        data: history.map((r) => r.fireProbability),
        borderColor: '#3ca8ff',
        backgroundColor: 'rgba(60,168,255,0.16)',
        borderWidth: 2,
        pointRadius: 2,
        fill: true,
        tension: 0.35,
        yAxisID: 'y'
      },
      {
        label: 'Average MQ2',
        data: history.map((r) => {
          const values = Array.isArray(r.mq2) ? r.mq2 : [];
          if (!values.length) return 0;
          return values.reduce((s, v) => s + Number(v || 0), 0) / values.length;
        }),
        borderColor: '#8be0ff',
        backgroundColor: 'rgba(139,224,255,0.1)',
        borderWidth: 1.5,
        pointRadius: 1,
        fill: true,
        tension: 0.35,
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `${selectedNode || ''} - Fire Risk Timeline` }
    },
    scales: {
      y: { type: 'linear', min: 0, max: 100, position: 'left', title: { display: true, text: 'Probability %' } },
      y1: { type: 'linear', position: 'right', title: { display: true, text: 'Gas Level' }, grid: { drawOnChartArea: false } }
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Connecting to fire safety network...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="header-icon">🔥</span>
          <h1>NIT Rourkela Centralised Fire Station</h1>
        </div>
        <nav className="header-nav">
          {['dashboard', 'map', 'alerts', 'stats'].map((tab) => (
            <button
              key={tab}
              className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="live-badge">LIVE SECURE</span>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'dashboard' && (
          <>
            <section className="node-cards">
              {summary.map((node) => (
                <NodeCard
                  key={node.nodeId}
                  node={node}
                  selected={selectedNode === node.nodeId}
                  onSelect={() => setSelectedNode(node.nodeId)}
                  riskColor={getRiskColor(node.latest?.fireProbability ?? node.lastProbability ?? 0)}
                />
              ))}
            </section>

            <section className="map-preview-section">
               <MapView summary={summary} getRiskColor={getRiskColor} />
            </section>

            {selectedNodeData && (
              <section className="control-panel">
                <div className="section-title">Manual Override - {selectedNodeData.name || selectedNodeData.nodeId}</div>
                
                <div className="coord-editor">
                  <span>Map Pins Setup:</span>
                  <label>Lat:</label>
                  <input className="coord-input" type="number" step="0.0001" value={nodeLat} onChange={e=>setNodeLat(e.target.value)} />
                  <label>Lng:</label>
                  <input className="coord-input" type="number" step="0.0001" value={nodeLng} onChange={e=>setNodeLng(e.target.value)} />
                  <button className="coord-save-btn" onClick={saveCoords}>Update Location</button>
                </div>

                <div className="control-status">
                  <span className="status-pill">Mode: {selectedNodeData.actuatorState?.mode || 'auto'}</span>
                  <span className="status-pill">Water Pump: {selectedNodeData.actuatorState?.relayOn ? 'ON' : 'OFF'}</span>
                  <span className="status-pill">Siren: {selectedNodeData.actuatorState?.buzzerOn ? 'ON' : 'OFF'}</span>
                </div>
                <div className="control-duration-row">
                  <label htmlFor="holdDuration" className="duration-label">Manual Hold</label>
                  <select
                    id="holdDuration"
                    className="duration-select"
                    value={manualDuration}
                    onChange={(e) => setManualDuration(e.target.value)}
                  >
                    <option value="0">Until Return to AUTO</option>
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="900">15 minutes</option>
                  </select>
                </div>
                <div className="control-grid">
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn danger ${selectedNodeData.actuatorState?.relayOn && selectedNodeData.actuatorState?.buzzerOn ? 'active' : ''}`}
                    onClick={() => sendControl({ relayOn: true, buzzerOn: true, mode: 'manual' })}>
                    Emergency ON
                  </button>
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn warn ${selectedNodeData.actuatorState?.relayOn && !selectedNodeData.actuatorState?.buzzerOn ? 'active' : ''}`}
                    onClick={() => sendControl({ relayOn: true, buzzerOn: false, mode: 'manual' })}>
                    Water Pump ON
                  </button>
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn warn ${!selectedNodeData.actuatorState?.relayOn && selectedNodeData.actuatorState?.buzzerOn ? 'active' : ''}`}
                    onClick={() => sendControl({ relayOn: false, buzzerOn: true, mode: 'manual' })}>
                    Siren ON
                  </button>
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn ${!selectedNodeData.actuatorState?.relayOn && !selectedNodeData.actuatorState?.buzzerOn ? 'active' : ''}`} 
                    onClick={() => sendControl({ relayOn: false, buzzerOn: false, mode: 'manual' })}>
                    All OFF
                  </button>
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn auto ${selectedNodeData.actuatorState?.mode === 'auto' ? 'active' : ''}`} 
                    onClick={() => sendControl({ relayOn: false, buzzerOn: false, mode: 'auto', durationSec: 0 })}>
                    Return to AUTO
                  </button>
                </div>
              </section>
            )}

            {alerts.length > 0 && (
              <section className="alerts-preview">
                <div className="section-title">Recent Fire Alerts</div>
                {alerts.slice(0, 4).map((a, i) => (
                  <div key={i} className="alert-item">
                    <span className="alert-node">{a.nodeId}</span>
                    <span className="alert-aqi" style={{ color: getRiskColor(a.fireProbability) }}>{a.fireProbability}%</span>
                    <span className="alert-cat">{a.riskLevel}</span>
                    <span className="alert-time">{new Date(a.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {activeTab === 'map' && <MapView summary={summary} getRiskColor={getRiskColor} />}

        {activeTab === 'alerts' && <AlertsPanel alerts={alerts} getRiskColor={getRiskColor} API={API} stopAlarm={stopAlarmSound} />}

        {activeTab === 'stats' && (
          <StatsPanel
            nodes={summary}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            API={API}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
