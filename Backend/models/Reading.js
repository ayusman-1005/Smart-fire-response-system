// models/Reading.js
const mongoose = require('mongoose');

const ReadingSchema = new mongoose.Schema({
  nodeId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  flame: [Boolean],
  mq2: [Number],
  dht: [{ temperature: Number, humidity: Number }],
  fireProbability: Number,
  riskLevel: String,
  decision: {
    relayOn: Boolean,
    buzzerOn: Boolean,
    mode: String,
    source: String
  }
});

// TTL index: auto-delete readings older than 30 days
ReadingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('Reading', ReadingSchema);
