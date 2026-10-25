const mongoose = require('mongoose');

// A location report from a phone's lock agent. Kept for a trail/history and
// auto-expired after 30 days to bound storage.
const LocationPingSchema = new mongoose.Schema(
  {
    device_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LocationPingSchema.index({ device_id: 1, at: -1 });
// Auto-delete pings older than 30 days.
LocationPingSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('LocationPing', LocationPingSchema);
