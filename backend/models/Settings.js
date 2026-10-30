const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    business_name: { type: String, trim: true, default: 'Dan & Dor Solar Company Ltd.' },
    contact_email: { type: String, trim: true, lowercase: true, default: 'support@tritech.com' },
    contact_phone: { type: String, trim: true, default: '' },
    contact_address: { type: String, trim: true, default: '' },
    whatsapp_number: { type: String, trim: true, default: '' },
    lock_grace_period_hours: { type: Number, default: 48 },
    installment_frequencies: { type: [String], default: ['daily', 'weekly', 'monthly'] },
    currency: { type: String, trim: true, default: 'GHS' },
    maintenance_mode: { type: Boolean, default: false },
    // Company logo uploaded in Settings (shown on login, header, etc.).
    // null = use the built-in /logo.png.
    logo_url: { type: String, default: null },
    // Names of one-off data migrations already applied (so they never re-run).
    applied_migrations: { type: [String], default: [] },
    // Reusable token embedded in the "Stock Enrollment" QR. Scanning it on any
    // factory-reset phone enrols that phone into the unassigned stock pool.
    stock_enrollment_token: { type: String, default: null },
    // Factory Reset Protection: company Google accounts. After a recovery-mode
    // reset, an enrolled phone can only be set up again by signing in with one
    // of these. google_id is the account's numeric Google ID (what Android needs).
    frp_accounts: {
      type: [{
        google_id: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true, default: '' },
        added_at: { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

SettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Settings', SettingsSchema);
