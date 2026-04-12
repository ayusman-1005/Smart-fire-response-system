import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function getTempFromReading(reading) {
  const rows = Array.isArray(reading?.dht) ? reading.dht : [];
  if (!rows.length) return null;
  const values = rows.map((d) => Number(d?.temperature || 0));
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function formatLabel(ts, range) {
  const d = new Date(ts);
  if (range === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function GraphCard({ node, rows }) {
  const labels = rows.map((r) => formatLabel(r.timestamp, rows.length > 80 ? '7d' : '24h'));
  const fireData = rows.map((r) => Number(r.fireProbability || 0));
  const tempData = rows.map((r) => getTempFromReading(r));

  const data = {
    labels,
    datasets: [
      {
        label: 'Fire Probability %',
        data: fireData,
        borderColor: '#e45353',
        backgroundColor: 'rgba(228, 83, 83, 0.12)',
        borderWidth: 2,
        pointRadius: 1,
        tension: 0.35,
        fill: true,
        yAxisID: 'y'
      },
      {
        label: 'Temperature deg C',
        data: tempData,
        borderColor: '#2f86ff',
        backgroundColor: 'rgba(47, 134, 255, 0.1)',
        borderWidth: 2,
        pointRadius: 1,
        tension: 0.3,
        fill: true,
        yAxisID: 'y1'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: `${node.name || node.nodeId} - Fire Probability and Temperature`
      }
    },
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 100,
        title: { display: true, text: 'Probability %' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'Temp deg C' },
        grid: { drawOnChartArea: false }
      }
    }
  };

  return (
    <article className="graph-card">
      <div className="graph-title">{node.name || node.nodeId}</div>
      {rows.length === 0 ? (
        <div className="no-data">No data available for this building in selected range.</div>
      ) : (
        <div className="graph-canvas-wrap">
          <Line data={data} options={options} />
        </div>
      )}
    </article>
  );
}

function GraphsPanel({ nodes, API }) {
  const [range, setRange] = useState('24h');
  const [loading, setLoading] = useState(false);
  const [nodeSeries, setNodeSeries] = useState({});

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => (a.name || a.nodeId).localeCompare(b.name || b.nodeId));
  }, [nodes]);

  useEffect(() => {
    if (!sortedNodes.length) {
      setNodeSeries({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      sortedNodes.map(async (node) => {
        try {
          const res = await axios.get(`${API}/nodes/${node.nodeId}/data?range=${range}`);
          return [node.nodeId, Array.isArray(res.data) ? res.data : []];
        } catch (err) {
          return [node.nodeId, []];
        }
      })
    )
      .then((results) => {
        if (cancelled) return;
        setNodeSeries(Object.fromEntries(results));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sortedNodes, API, range]);

  return (
    <section className="graphs-section">
      <div className="panel-head">
        <div className="section-title">All Building Graphs</div>
        <div className="stats-selectors">
          {['24h', '7d', '30d'].map((r) => (
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

      {loading && <div className="no-data">Loading graphs...</div>}

      <div className="graph-grid">
        {sortedNodes.map((node) => (
          <GraphCard key={node.nodeId} node={node} rows={nodeSeries[node.nodeId] || []} />
        ))}
      </div>
    </section>
  );
}

export default GraphsPanel;
