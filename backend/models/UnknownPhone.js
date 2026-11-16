const mongoose = require('mongoose');

/**
 * A phone that tries to check in with an id the system doesn't know (e.g. its
 * record was taken over by another phone). Kept 14 days so the admin can
 * reconnect it (Enroll Stock → "Phones the system doesn't know").
 */
const UnknownPhoneSchema = new mongoose.Schema({
  device_id: { type: String, required: true, unique: true },
  imei: { type: String, default: null },
  app_version: { type: String, default: null },
  android_version: { type: String, default: null },
  lock_state: { type: String, default: null },
  tries: { type: Number, default: 0 },
  first_at: { type: Date, default: Date.now },
  last_at: { type: Date, default: Date.now },
});
UnknownPhoneSchema.index({ last_at: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

module.exports = mongoose.model('UnknownPhone', UnknownPhoneSchema);
