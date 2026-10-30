const mongoose = require('mongoose');

// Enrollment breadcrumbs from phones: each step of QR setup the phone reaches.
// Lets the admin see where a failed enrollment stopped. Auto-deleted after 7 days.
const AgentTraceSchema = new mongoose.Schema(
  {
    stage: { type: String, trim: true, maxlength: 60 },
    detail: { type: String, trim: true, maxlength: 300, default: '' },
    model: { type: String, trim: true, maxlength: 80, default: '' },
    android_version: { type: String, trim: true, maxlength: 20, default: '' },
    app_version: { type: String, trim: true, maxlength: 20, default: '' },
    device_ref: { type: String, trim: true, maxlength: 64, default: '' },
    createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 },
  },
  { versionKey: false }
);

module.exports = mongoose.model('AgentTrace', AgentTraceSchema);
