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

// TTL index: automatically remove documents after expires_at
PasswordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index({ email: 1 });
PasswordResetSchema.index({ phone: 1 });
PasswordResetSchema.index({ token: 1 });

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
