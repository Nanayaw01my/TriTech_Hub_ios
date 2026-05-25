const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema(
  {
    company_name: {
      type: String,
      default: 'DAN & DOR SOLAR COMPANY LIMITED',
      trim: true,
    },
    company_address: {
      type: String,
      trim: true,
    },
    company_phone: {
      type: String,
      trim: true,
    },
    company_email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    logo_url: {
      type: String,
    },
    tax_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    low_stock_alert: {
      type: Number,
      default: 5,
    },
    receipt_header: {
      type: String,
      trim: true,
    },
    receipt_footer: {
      type: String,
      trim: true,
    },
    currency_symbol: {
      type: String,
      default: 'GH₵',
    },
    email_config: {
      smtp_host: { type: String },
      smtp_port: { type: Number },
      smtp_user: { type: String },
      smtp_pass: { type: String, select: false },
      from_email: { type: String },
    },
    notification_settings: {
      large_sale_threshold: { type: Number, default: 5000 },
      expense_threshold: { type: Number, default: 1000 },
      email_notifications: { type: Boolean, default: true },
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model('Settings', SettingsSchema);
