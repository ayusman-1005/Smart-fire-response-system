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
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  // New states for editing map location
  const [editLocationNode, setEditLocationNode] = useState(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

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

  const updateLocation = async () => {
    if (!editLocationNode) return;
    try {
      await axios.post(`${API}/nodes/${editLocationNode}/settings`, { 
         lat: Number(editLat), 
         lng: Number(editLng) 
      });
      setEditLocationNode(null);
      await fetchSummary();
    } catch(err) {
      console.error('Location update failed', err);
    }
  };

  const selectedNodeData = summary.find((n) => n.nodeId === selectedNode);

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
      <header className="app-header" style={{ padding: '20px 40px', background: '#0a0a0a', borderBottom: '1px solid #333' }}>
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span className="header-icon" style={{ fontSize: '28px', color: '#ff3b30' }}>🔥</span>
          <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '1px', color: '#fff', margin: 0 }}>NIT Rourkela City-Wide Fire Station Dashboard</h1>
        </div>
        <nav className="header-nav" style={{ display: 'flex', gap: '10px' }}>
          {['dashboard', 'map', 'alerts', 'stats'].map((tab) => (
            <button
              key={tab}
              className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
              style={{
                 padding: '8px 16px', borderRadius: '8px', 
                 textTransform: 'uppercase', fontSize: '13px', fontWeight: '600',
                 backgroundColor: activeTab === tab ? '#ff3b30' : 'transparent',
                 color: activeTab === tab ? '#fff' : '#a0a0a0', border: 'none', cursor: 'pointer'
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="header-right" style={{display:'flex', alignItems:'center', gap:'15px'}}>
          <button className="theme-btn" onClick={() => setIsDarkTheme(!isDarkTheme)} title="Toggle Light/Dark Theme">
             {isDarkTheme ? '☀️' : '🌙'}
          </button>
          <span className="live-badge" style={{ padding: '6px 12px', background: 'rgba(50, 215, 75, 0.2)', color: '#32d74b', borderRadius: '20px', fontWeight: '700', fontSize: '12px' }}>● LIVE SECURE CITY</span>
        </div>
      </header>

      <main className="app-main" style={{ padding: '30px', background: '#121212', minHeight: '100vh', color: '#e0e0e0' }}>
        {activeTab === 'dashboard' && (
          <>
            <section className="node-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              {summary.map((node) => (
                <NodeCard
                  key={node.nodeId}
                  node={node}
                  selected={selectedNode === node.nodeId}
                  onSelect={() => setSelectedNode(node.nodeId)}
                  riskColor={getRiskColor(node.latest?.fireProbability ?? node.lastProbability ?? 0)}
                  style={{
                     background: '#1c1c1e', padding: '20px', borderRadius: '16px', cursor: 'pointer',
                     boxShadow: selectedNode === node.nodeId ? `0 0 15px ${getRiskColor(node.latest?.fireProbability ?? node.lastProbability ?? 0)}` : '0 4px 6px rgba(0,0,0,0.2)',
                     transition: '0.3s ease', outline: selectedNode === node.nodeId ? `2px solid ${getRiskColor(node.latest?.fireProbability ?? node.lastProbability ?? 0)}` : 'none'
                  }}
                />
              ))}
            </section>

            <section className="map-preview-section" style={{marginBottom: '24px'}}>
               <MapView summary={summary} getRiskColor={getRiskColor} />
            </section>

            {selectedNodeData && (
              <section className="control-panel">
                <div className="section-title" style={{display:'flex', justifyContent:'space-between'}}>
                  <span>Manual Override - {selectedNodeData.name || selectedNodeData.nodeId}</span>
                  {editLocationNode !== selectedNodeData.nodeId ? (
                     <button className="action-btn" style={{padding:'4px 10px', fontSize:'12px'}} onClick={() => {
                        setEditLocationNode(selectedNodeData.nodeId);
                        setEditLat(selectedNodeData.location?.lat || 22.2515);
                        setEditLng(selectedNodeData.location?.lng || 84.9020);
                     }}>Edit Location</button>
                  ) : (
                     <div style={{display:'flex', gap:'5px', fontSize:'12px'}}>
                        <input type="number" style={{width:'80px', padding:'4px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid #444'}} value={editLat} onChange={e=>setEditLat(e.target.value)} />
                        <input type="number" style={{width:'80px', padding:'4px', background:'var(--bg-panel)', color:'var(--text-main)', border:'1px solid #444'}} value={editLng} onChange={e=>setEditLng(e.target.value)} />
                        <button className="action-btn auto" style={{padding:'4px 8px'}} onClick={updateLocation}>Save</button>
                        <button className="action-btn" style={{padding:'4px 8px'}} onClick={()=>setEditLocationNode(null)}>Cancel</button>
                     </div>
                  )}
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
                    className={`action-btn danger ${(selectedNodeData.actuatorState?.relayOn && selectedNodeData.actuatorState?.buzzerOn) ? 'active-pressed' : ''}`} 
                    onClick={() => sendControl({ relayOn: true, buzzerOn: true, mode: 'manual' })}>
                    {selectedNodeData.actuatorState?.relayOn && selectedNodeData.actuatorState?.buzzerOn ? "EMERGENCY ACTIVE" : "Emergency ON"}
                  </button>
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn warn ${selectedNodeData.actuatorState?.relayOn && !selectedNodeData.actuatorState?.buzzerOn ? 'active-pressed' : ''}`} 
                    onClick={() => sendControl({ relayOn: true, buzzerOn: false, mode: 'manual' })}>
                    {selectedNodeData.actuatorState?.relayOn && !selectedNodeData.actuatorState?.buzzerOn ? "PUMP ACTIVE" : "Water Pump ON"}
                  </button>
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn warn ${!selectedNodeData.actuatorState?.relayOn && selectedNodeData.actuatorState?.buzzerOn ? 'active-pressed' : ''}`} 
                    onClick={() => sendControl({ relayOn: false, buzzerOn: true, mode: 'manual' })}>
                    {selectedNodeData.actuatorState?.buzzerOn && !selectedNodeData.actuatorState?.relayOn ? "SIREN ACTIVE" : "Siren ON"}
                  </button>
                  <button 
                    disabled={controlBusy} 
                    className={`action-btn auto ${selectedNodeData.actuatorState?.mode === 'auto' ? 'active-pressed' : ''}`} 
                    onClick={() => sendControl({ relayOn: false, buzzerOn: false, mode: 'auto', durationSec: 0 })}>
                    {selectedNodeData.actuatorState?.mode === 'auto' ? "AUTO MODE (RESET)" : "Return to AUTO / OFF"}
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

      <section className="dev-section">
        <h2 className="dev-title">OUR DEVELOPERS</h2>
        <div className="dev-grid">
          {[
            { id: 'ab', initials: 'AB', name: 'Ayusman Behera', color: '#f26f21', link: 'https://www.linkedin.com/in/ayusman-behera-43354b270/' },
            { id: 'uh', initials: 'UH', name: 'Udayanath Hota', color: '#e52c2c', link: 'https://www.linkedin.com/in/udaynath-hota/' },
            { id: 'sn', initials: 'SN', name: 'Stephen Nayak', color: '#8c52ff' },
            { id: 'aa', initials: 'AA', name: 'Anas Ahmed', color: '#2c82e5' },
            { id: 'ml', initials: 'ML', name: 'Mayank Lohan', color: '#32d74b' },
            { id: 'ar', initials: 'AR', name: 'Ansh Rajpal', color: '#ffb300' }
          ].map(dev => (
             <a key={dev.id} href={dev.link || '#'} target={dev.link ? "_blank" : "_self"} rel="noreferrer" className="dev-card" style={{ cursor: dev.link ? 'pointer' : 'default', textDecoration: 'none' }}>
               <div className="dev-avatar" style={{ background: dev.color }}>
                 {dev.initials}
               </div>
               <div className="dev-name">{dev.name}</div>
             </a>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div>
          <h4>About SFRS Monitor</h4>
          <p style={{ maxWidth:'280px', lineHeight:'1.5' }}>
            Real-time fire quality monitoring system providing accurate readings, early warning mechanisms, and automated water pump integrations.
          </p>
        </div>
        <div>
          <h4>Features</h4>
          <ul>
            <li>Real-time Fire monitoring</li>
            <li>Temperature & Humidity tracking</li>
            <li>Severe flame/gas alerts</li>
            <li>Instant Pump Automation</li>
          </ul>
        </div>
        <div>
          <h4>Resources</h4>
          <ul>
            <li>Gas Scale Information</li>
            <li>Safety Guidelines</li>
            <li>Data Sources</li>
            <li>Support</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

export default App;
