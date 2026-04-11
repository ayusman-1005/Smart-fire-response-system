// src/components/StatsPanel.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function StatsPanel({ nodes, selectedNode, onSelectNode, API }) {
  const [stats, setStats]   = useState([]);
  const [range, setRange]   = useState('7d');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedNode) return;
    setLoading(true);
    axios.get(`${API}/nodes/${selectedNode}/stats?range=${range}`)
      .then(res => { setStats(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedNode, range, API]);

  const chartData = {
    labels: stats.map(s => s._id),
    datasets: [
      {
        label: 'Avg Probability',
        data: stats.map(s => Math.round(s.avgProbability || 0)),
        backgroundColor: 'rgba(255,91,69,0.7)',
        borderRadius: 6
      },
      {
        label: 'Max Probability',
        data: stats.map(s => Math.round(s.maxProbability || 0)),
        backgroundColor: 'rgba(255,174,66,0.6)',
        borderRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: `Daily Fire Risk Statistics - ${selectedNode}`
      }
    },
    scales: {
      y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
    }
  };

  return (
    <div className="stats-section">
      <div className="stats-controls">
        <div className="section-title">Daily Fire Statistics</div>
        <div className="stats-selectors">
          <select
            value={selectedNode || ''}
            onChange={e => onSelectNode(e.target.value)}
            className="node-select"
          >
            {nodes.map(n => (
              <option key={n.nodeId} value={n.nodeId}>{n.name || n.nodeId}</option>
            ))}
          </select>
          {['7d', '30d'].map(r => (
            <button
              key={r}
              className={`range-btn ${range === r ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="no-data">Loading...</div>
      ) : stats.length > 0 ? (
        <>
          <Bar data={chartData} options={chartOptions} />

          {/* Summary table */}
          <table className="stats-table" style={{ marginTop: '24px' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Avg Probability</th>
                <th>Max Probability</th>
                <th>Avg MQ2</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s._id}>
                  <td>{s._id}</td>
                  <td>{Math.round(s.avgProbability || 0)}%</td>
                  <td>{Math.round(s.maxProbability || 0)}%</td>
                  <td>{Number(s.avgGas || 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="no-data">No stats available for this range.</div>
      )}
    </div>
  );
}

export default StatsPanel;
