const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    business_name: { type: String, trim: true, default: 'Tritech Hub iOS' },
    contact_email: { type: String, trim: true, lowercase: true, default: 'support@tritech.com' },
    contact_phone: { type: String, trim: true, default: '' },
    contact_address: { type: String, trim: true, default: '' },
    whatsapp_number: { type: String, trim: true, default: '' },
    lock_grace_period_hours: { type: Number, default: 48 },
    installment_frequencies: { type: [String], default: ['daily', 'weekly', 'monthly'] },
    currency: { type: String, trim: true, default: 'GHS' },
  },
  { timestamps: true }
);

SettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Settings', SettingsSchema);
