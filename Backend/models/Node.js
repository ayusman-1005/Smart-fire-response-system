// models/Node.js
const mongoose = require('mongoose');

const NodeSchema = new mongoose.Schema({
  nodeId: {
    type: String,
    required: true,
    unique: true
  },
  name: String,            // human-readable label
  location: {
    lat: Number,
    lng: Number
  },
  description: String,
  lastSeen: Date,
  lastRisk: String,
  lastProbability: Number,
  actuatorState: {
    relayOn: { type: Boolean, default: false },
    buzzerOn: { type: Boolean, default: false },
    mode: { type: String, default: 'auto' },
    updatedAt: Date,
    source: String
  }
});

module.exports = mongoose.model('Node', NodeSchema);
