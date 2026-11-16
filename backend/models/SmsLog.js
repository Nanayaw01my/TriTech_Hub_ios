const mongoose = require('mongoose');

/** Every text the system sends (kept 1 year), for the customer timeline and checks. */
const SmsLogSchema = new mongoose.Schema({
  to: { type: String, index: true },          // 233XXXXXXXXX
  message: { type: String },
  provider: { type: String, default: null },  // 'arkesel' | 'nkomo' | null
  ok: { type: Boolean, default: false },
  at: { type: Date, default: Date.now },
});
SmsLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
SmsLogSchema.index({ to: 1, at: -1 });

module.exports = mongoose.model('SmsLog', SmsLogSchema);
