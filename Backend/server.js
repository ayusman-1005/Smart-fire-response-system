require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const mqtt = require('mqtt');

const Reading = require('./models/Reading');
const Node = require('./models/Node');
const twilio = require('twilio');
const { computeFireEstimate, decideActuation } = require('./utils/fireFusion');

const app = express();
const PORT = process.env.PORT || 5000;

const DEFAULT_BUILDINGS = [
  { nodeId: 'Main_Building', name: 'Main Building', location: { lat: 22.2520, lng: 84.9010 } },
  { nodeId: 'CSE_Building', name: 'CSE Building', location: { lat: 22.2515, lng: 84.9020 } },
  { nodeId: 'Mech_Building', name: 'Mech Building', location: { lat: 22.2525, lng: 84.9030 } },
  { nodeId: 'ECE_Building', name: 'ECE Building', location: { lat: 22.2510, lng: 84.9040 } },
  { nodeId: 'LA1', name: 'LA1', location: { lat: 22.2535, lng: 84.9000 } },
  { nodeId: 'LA2', name: 'LA2', location: { lat: 22.2535, lng: 84.8990 } },
  { nodeId: 'SD_Hall', name: 'SD Hall', location: { lat: 22.2470, lng: 84.9050 } }
];
const ALLOWED_NODE_IDS = new Set(DEFAULT_BUILDINGS.map((n) => n.nodeId));
const LEGACY_NODE_IDS = ['NODE1', 'node1', 'Node1', 'node-1', 'NODE-1'];

function isAllowedNodeId(nodeId) {
  return ALLOWED_NODE_IDS.has(nodeId);
}

// Twilio setup
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_FROM = process.env.TWILIO_FROM_PHONE;
const TWILIO_TO = process.env.TWILIO_TO_PHONE;

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json());

let mongoConnected = false;

function connectMongoDB() {
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 20000,
    retryWrites: true,
    w: 'majority'
  })
    .then(async () => {
      mongoConnected = true;
      console.log('MongoDB connected');
      // Load existing nodes state
      try {
        // Pre-seed the NIT Rourkela buildings so they appear on the scalable City Map immediately
        for (const dn of DEFAULT_BUILDINGS) {
          await Node.findOneAndUpdate({ nodeId: dn.nodeId }, { $setOnInsert: dn }, { upsert: true });
        }

        await Node.deleteMany({ nodeId: { $in: LEGACY_NODE_IDS } });
        await Reading.deleteMany({ nodeId: { $in: LEGACY_NODE_IDS } });

        const nodes = await Node.find({ nodeId: { $in: [...ALLOWED_NODE_IDS] } });
        nodes.forEach(async (n) => {
          if (n.actuatorState?.mode === 'manual') {
            const exp = n.actuatorState.expiresAt ? new Date(n.actuatorState.expiresAt).getTime() : null;
            if (exp && Date.now() > exp) {
              n.actuatorState.mode = 'auto';
              n.actuatorState.relayOn = false;
              n.actuatorState.buzzerOn = false;
              await n.save();
            } else {
              manualOverrides[n.nodeId] = {
                relayOn: n.actuatorState.relayOn,
                buzzerOn: n.actuatorState.buzzerOn,
                expiresAt: exp
              };
            }
          }
        });
      } catch(err) {
        console.error('Failed to sync overrides and seed nodes:', err.message);
      }
    })
    .catch((err) => {
      mongoConnected = false;
      console.error('MongoDB error:', err.message);
      setTimeout(connectMongoDB, 5000);
    });
}

connectMongoDB();

mongoose.connection.on('disconnected', () => {
  mongoConnected = false;
  console.warn('MongoDB disconnected. Retrying...');
  setTimeout(connectMongoDB, 3000);
});

const mqttOptions = {};
if (process.env.MQTT_USER) {
  mqttOptions.username = process.env.MQTT_USER;
  mqttOptions.password = process.env.MQTT_PASS;
}

const mqttClient = mqtt.connect(process.env.MQTT_BROKER, mqttOptions);

const memoryCache = {};
const manualOverrides = {};

function getNodeCache(nodeId) {
  if (!memoryCache[nodeId]) {
    memoryCache[nodeId] = {
      latest: null,
      all: [],
      actuatorState: {
        relayOn: false,
        buzzerOn: false,
        mode: 'auto',
        updatedAt: new Date(),
        source: 'startup'
      }
    };
  }
  return memoryCache[nodeId];
}

function getControlTopic(nodeId) {
  return `sensors/${nodeId}/control`;
}

function publishControl(nodeId, control) {
  const payload = JSON.stringify({
    relayOn: !!control.relayOn,
    buzzerOn: !!control.buzzerOn,
    mode: control.mode || 'auto',
    source: control.source || 'backend',
    at: new Date().toISOString()
  });

  mqttClient.publish(getControlTopic(nodeId), payload);
  console.log(`[CONTROL] ${nodeId} -> ${payload}`);
}

function normalizePayload(nodeIdFromTopic, raw) {
  const nodeId = raw.nodeId || nodeIdFromTopic;
  if (!isAllowedNodeId(nodeId)) return null;
  let flameRaw = Array.isArray(raw.flame) ? raw.flame : [];
  let mq2Raw = Array.isArray(raw.mq2) ? raw.mq2 : [];
  let dhtRaw = Array.isArray(raw.dht) ? raw.dht : [];

  // Backward compatibility for lightweight test payloads like:
  // { nodeId, temp, gas } or { nodeId, temperature, gas }
  if (mq2Raw.length === 0 && (raw.gas !== undefined || raw.mq2Value !== undefined)) {
    const gas = Number(raw.gas ?? raw.mq2Value ?? 0);
    mq2Raw = [gas, gas, gas, gas, gas];
  }

  if (dhtRaw.length === 0 && (raw.temp !== undefined || raw.temperature !== undefined || raw.humidity !== undefined)) {
    const temp = Number(raw.temp ?? raw.temperature ?? 0);
    const humidity = Number(raw.humidity ?? 0);
    dhtRaw = [
      { temperature: temp, humidity },
      { temperature: temp, humidity }
    ];
  }

  if (flameRaw.length === 0) {
    const flameDetected = Number(raw.flameDetected ?? raw.fire ?? 0) === 1;
    flameRaw = [flameDetected ? 1 : 0, 0, 0, 0, 0];
  }

  const flame = flameRaw.slice(0, 5).map((v) => {
    if (typeof v === 'boolean') return v;
    return Number(v) === 1;
  });

  const mq2 = mq2Raw.slice(0, 5).map((v) => Number(v || 0));

  const dht = dhtRaw.slice(0, 2).map((item) => ({
    temperature: Number(item?.temperature || 0),
    humidity: Number(item?.humidity || 0)
  }));

  // Update Node Location if payload includes lat/lng (for dynamic nodes)
  if (raw.lat !== undefined && raw.lng !== undefined && mongoConnected) {
    Node.findOneAndUpdate(
       { nodeId },
       { 'location.lat': Number(raw.lat), 'location.lng': Number(raw.lng) },
       { upsert: true }
    ).catch(()=>{});
  }

  return { nodeId, flame, mq2, dht };
}

function isManualActive(nodeId) {
  const override = manualOverrides[nodeId];
  if (!override) return false;
  if (override.expiresAt && Date.now() > override.expiresAt) {
    delete manualOverrides[nodeId];
    return false;
  }
  return true;
}

mqttClient.on('connect', () => {
  console.log('MQTT connected');
  mqttClient.subscribe('sensors/+/data', (err) => {
    if (err) console.error('MQTT subscribe error:', err.message);
    else console.log('Subscribed: sensors/+/data');
  });
});

mqttClient.on('error', (err) => {
  console.error('MQTT error:', err.message);
});

mqttClient.on('message', async (topic, message) => {
  const parts = topic.split('/');
  const nodeId = parts[1];

  let payload;
  try {
    payload = JSON.parse(message.toString());
  } catch (err) {
    console.error('Invalid JSON from topic', topic);
    return;
  }

  const normalized = normalizePayload(nodeId, payload);
    if (!normalized) return;
  const estimate = computeFireEstimate({ 
     ...normalized, 
     history: getNodeCache(normalized.nodeId).all.slice(-10) 
  });

  let decision;
  if (isManualActive(normalized.nodeId)) {
    const override = manualOverrides[normalized.nodeId];
    decision = {
      relayOn: !!override.relayOn,
      buzzerOn: !!override.buzzerOn,
      mode: 'manual',
      source: 'manual-override'
    };
  } else {
    decision = decideActuation({
      fireProbability: estimate.fireProbability,
      riskLevel: estimate.riskLevel,
      flame: normalized.flame
    });
  }

  const reading = {
    nodeId: normalized.nodeId,
    timestamp: new Date(),
    flame: normalized.flame,
    mq2: normalized.mq2,
    dht: normalized.dht,
    fireProbability: estimate.fireProbability,
    riskLevel: estimate.riskLevel,
    decision
  };

  const nodeCache = getNodeCache(normalized.nodeId);
  nodeCache.latest = reading;
  nodeCache.all.push(reading);
  nodeCache.actuatorState = {
    relayOn: decision.relayOn,
    buzzerOn: decision.buzzerOn,
    mode: decision.mode,
    updatedAt: new Date(),
    source: decision.source
  };
  if (nodeCache.all.length > 200) nodeCache.all.shift();

  publishControl(normalized.nodeId, decision);

  if (decision.relayOn || decision.buzzerOn || estimate.riskLevel === 'CRITICAL') {
    console.warn(`[ALERT] ${normalized.nodeId} probability=${estimate.fireProbability}% risk=${estimate.riskLevel}`);
    
    if (estimate.riskLevel === 'CRITICAL' && twilioClient && TWILIO_FROM && TWILIO_TO) {
      if (!nodeCache.lastSmsSent || Date.now() - nodeCache.lastSmsSent > 10 * 60 * 1000) {
        nodeCache.lastSmsSent = Date.now();
        twilioClient.messages.create({
           body: `[URGENT] CRITICAL Fire Alert from Node ${normalized.nodeId}. Probability: ${estimate.fireProbability}%. Action taken: Pump ${decision.relayOn ? 'ON' : 'OFF'}, Siren ${decision.buzzerOn ? 'ON' : 'OFF'}. Please check Dashboard immediately! Location: NIT Rourkela (Default).`,
           from: TWILIO_FROM,
           to: TWILIO_TO
        }).catch(e => console.error('Twilio SMS Error:', e.message));

        // Let's also do a call
        twilioClient.calls.create({
          twiml: `<Response><Say>Critical fire alert at ${normalized.nodeId}. Please check the emergency dashboard.</Say></Response>`,
          to: TWILIO_TO,
          from: TWILIO_FROM
        }).catch(e => console.error('Twilio Call Error:', e.message));
      }
    }
  }

  if (mongoConnected) {
    try {
      await Reading.create(reading);
      await Node.findOneAndUpdate(
        { nodeId: normalized.nodeId },
        {
          lastSeen: new Date(),
          lastRisk: estimate.riskLevel,
          lastProbability: estimate.fireProbability,
          actuatorState: {
            relayOn: decision.relayOn,
            buzzerOn: decision.buzzerOn,
            mode: decision.mode,
            updatedAt: new Date(),
            source: decision.source
          }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('DB save error:', err.message);
    }
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    backend: 'running',
    mongodb: mongoConnected ? 'connected' : 'disconnected',
    mqtt: mqttClient.connected ? 'connected' : 'disconnected'
  });
});

app.get('/api/nodes', async (req, res) => {
  if (mongoConnected) {
    try {
      const nodes = await Node.find({ nodeId: { $in: [...ALLOWED_NODE_IDS] } });
      return res.json(nodes);
    } catch (err) {
      console.error('Nodes query failed:', err.message);
    }
  }

  const nodes = Object.keys(memoryCache).filter(isAllowedNodeId).map((nodeId) => ({
    nodeId,
    name: nodeId,
    lastSeen: memoryCache[nodeId].latest?.timestamp,
    lastRisk: memoryCache[nodeId].latest?.riskLevel,
    lastProbability: memoryCache[nodeId].latest?.fireProbability,
    actuatorState: memoryCache[nodeId].actuatorState
  }));
  res.json(nodes);
});

app.get('/api/summary', async (req, res) => {
  if (mongoConnected) {
    try {
      const nodes = await Node.find({ nodeId: { $in: [...ALLOWED_NODE_IDS] } });
      const summary = await Promise.all(nodes.map(async (node) => {
        const latest = await Reading.findOne({ nodeId: node.nodeId }).sort({ timestamp: -1 });
        return {
          nodeId: node.nodeId,
          name: node.name,
          location: node.location,
          description: node.description,
          lastSeen: node.lastSeen,
          lastRisk: node.lastRisk,
          lastProbability: node.lastProbability,
          actuatorState: node.actuatorState,
          latest
        };
      }));
      return res.json(summary);
    } catch (err) {
      console.error('Summary query failed:', err.message);
    }
  }

  const summary = Object.keys(memoryCache).filter(isAllowedNodeId).map((nodeId) => ({
    nodeId,
    name: nodeId,
    location: null,
    description: null,
    lastSeen: memoryCache[nodeId].latest?.timestamp,
    lastRisk: memoryCache[nodeId].latest?.riskLevel,
    lastProbability: memoryCache[nodeId].latest?.fireProbability,
    actuatorState: memoryCache[nodeId].actuatorState,
    latest: memoryCache[nodeId].latest
  }));
  res.json(summary);
});

app.get('/api/nodes/:id/latest', async (req, res) => {
  const nodeId = req.params.id;
  if (!isAllowedNodeId(nodeId)) return res.status(404).json({ error: 'Unknown building node' });
  if (mongoConnected) {
    try {
      const reading = await Reading.findOne({ nodeId }).sort({ timestamp: -1 });
      if (reading) return res.json(reading);
    } catch (err) {
      console.error('Latest query failed:', err.message);
    }
  }

  const latest = memoryCache[nodeId]?.latest;
  if (!latest) return res.status(404).json({ error: 'No data yet' });
  res.json(latest);
});

app.get('/api/nodes/:id/data', async (req, res) => {
  const nodeId = req.params.id;
  if (!isAllowedNodeId(nodeId)) return res.status(404).json({ error: 'Unknown building node' });
  const range = req.query.range || '24h';
  const rangeMap = { '24h': 24, '7d': 168, '30d': 720 };
  const hours = rangeMap[range] || 24;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  if (mongoConnected) {
    try {
      const readings = await Reading.find({ nodeId, timestamp: { $gte: since } })
        .sort({ timestamp: 1 });
      return res.json(readings);
    } catch (err) {
      console.error('Data query failed:', err.message);
    }
  }

  const readings = (memoryCache[nodeId]?.all || []).filter((r) => new Date(r.timestamp) >= since);
  res.json(readings);
});

app.get('/api/nodes/:id/stats', async (req, res) => {
  if (!isAllowedNodeId(req.params.id)) return res.status(404).json({ error: 'Unknown building node' });
  const range = req.query.range || '7d';
  const rangeMap = { '24h': 24, '7d': 168, '30d': 720 };
  const hours = rangeMap[range] || 168;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  try {
    if (!mongoConnected) {
      const nodeId = req.params.id;
      const rows = (memoryCache[nodeId]?.all || []).filter((r) => new Date(r.timestamp) >= since);
      const grouped = {};
      rows.forEach((r) => {
        const key = new Date(r.timestamp).toISOString().slice(0, 10);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      });
      const stats = Object.keys(grouped).sort().map((date) => {
        const data = grouped[date];
        const avgProb = data.reduce((s, r) => s + Number(r.fireProbability || 0), 0) / data.length;
        const maxProb = Math.max(...data.map((r) => Number(r.fireProbability || 0)));
        const avgGas = data.reduce((s, r) => s + (Array.isArray(r.mq2) && r.mq2.length ? r.mq2.reduce((a, b) => a + b, 0) / r.mq2.length : 0), 0) / data.length;
        return { _id: date, avgProbability: avgProb, maxProbability: maxProb, avgGas };
      });
      return res.json(stats);
    }

    const stats = await Reading.aggregate([
      { $match: { nodeId: req.params.id, timestamp: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          avgProbability: { $avg: '$fireProbability' },
          maxProbability: { $max: '$fireProbability' },
          avgGas: { $avg: { $avg: '$mq2' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  const threshold = Number(req.query.threshold || process.env.FIRE_ALERT_THRESHOLD || 60);

  try {
    if (!mongoConnected) {
      const rows = [];
      Object.keys(memoryCache).forEach((nodeId) => {
        if (!isAllowedNodeId(nodeId)) return;
        memoryCache[nodeId].all.forEach((r) => {
          if (Number(r.fireProbability || 0) >= threshold) rows.push(r);
        });
      });
      rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return res.json(rows.slice(0, 50));
    }

    const alerts = await Reading.find({ fireProbability: { $gte: threshold } })
      .where('nodeId').in([...ALLOWED_NODE_IDS])
      .sort({ timestamp: -1 })
      .limit(50)
      .select('nodeId timestamp fireProbability riskLevel flame mq2 decision acknowledged');

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/nodes/:id/settings', async (req, res) => {
  const nodeId = req.params.id;
  if (!isAllowedNodeId(nodeId)) return res.status(404).json({ error: 'Unknown building node' });
  const { name, lat, lng } = req.body;
  if (!mongoConnected) return res.status(500).json({ error: 'DB not connected' });

  try {
     const n = await Node.findOneAndUpdate(
        { nodeId },
        { 
          name: name,
          'location.lat': lat,
          'location.lng': lng
        },
        { upsert: true, new: true }
     );
     res.json(n);
  } catch(err) {
     res.status(500).json({ error: err.message });
  }
});

// Acknowledge Alert Endpoints
app.post('/api/alerts/:id/ack', async (req, res) => {
  const { id } = req.params;
  if(!mongoConnected) return res.json({ ok:true });

  try {
     await Reading.findByIdAndUpdate(id, { acknowledged: true });
     res.json({ ok: true });
  } catch(err) {
     res.status(500).json({ error: err.message });
  }
});

app.post('/api/nodes/:id/control', async (req, res) => {
  const nodeId = req.params.id;
  if (!isAllowedNodeId(nodeId)) return res.status(404).json({ error: 'Unknown building node' });
  const relayOn = !!req.body.relayOn;
  const buzzerOn = !!req.body.buzzerOn;
  const mode = req.body.mode === 'manual' ? 'manual' : 'auto';
  const durationSec = Number(req.body.durationSec || 0);

  let command;
  if (mode === 'manual') {
    const expiresAt = durationSec > 0 ? Date.now() + durationSec * 1000 : null;
    manualOverrides[nodeId] = { relayOn, buzzerOn, expiresAt };
    command = {
      relayOn,
      buzzerOn,
      mode: 'manual',
      source: 'frontend'
    };
  } else {
    delete manualOverrides[nodeId];
    command = {
      relayOn: false,
      buzzerOn: false,
      mode: 'auto',
      source: 'frontend-auto'
    };
  }

  publishControl(nodeId, command);

  const nodeCache = getNodeCache(nodeId);
  nodeCache.actuatorState = {
    relayOn: command.relayOn,
    buzzerOn: command.buzzerOn,
    mode: command.mode,
    updatedAt: new Date(),
    source: command.source
  };

  if (mongoConnected) {
    try {
      await Node.findOneAndUpdate(
        { nodeId },
        {
          actuatorState: {
            relayOn: command.relayOn,
            buzzerOn: command.buzzerOn,
            mode: command.mode,
            expiresAt: manualOverrides[nodeId]?.expiresAt || null,
            updatedAt: new Date(),
            source: command.source
          }
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Node control save failed:', err.message);
    }
  }

  res.json({ ok: true, nodeId, command, expiresInSec: durationSec || null });
});

app.get('/api/nodes/:id/control', (req, res) => {
  const nodeId = req.params.id;
  if (!isAllowedNodeId(nodeId)) return res.status(404).json({ error: 'Unknown building node' });
  const override = manualOverrides[nodeId];
  const state = memoryCache[nodeId]?.actuatorState || null;

  res.json({
    nodeId,
    manualOverride: override ? {
      relayOn: override.relayOn,
      buzzerOn: override.buzzerOn,
      expiresAt: override.expiresAt ? new Date(override.expiresAt).toISOString() : null
    } : null,
    actuatorState: state
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
