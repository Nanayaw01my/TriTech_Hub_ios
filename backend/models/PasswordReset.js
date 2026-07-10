const mongoose = require('mongoose');

const PasswordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    token: {
      type: String,
      required: true,
      trim: true,
    },
    expires_at: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    },
    used: {
      type: Boolean,
      default: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Note: the phone on this short-lived OTP record is intentionally NOT encrypted.
// The record expires in minutes and the code is stored hashed; keeping phone in
// plaintext is required so the OTP can be looked up by phone number.

// TTL index: automatically remove documents after expires_at
PasswordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// Compound indexes include `used` so lookups hit the index directly
PasswordResetSchema.index({ email: 1, used: 1 });
PasswordResetSchema.index({ phone: 1, used: 1 });
PasswordResetSchema.index({ token: 1 }, { unique: true });

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
