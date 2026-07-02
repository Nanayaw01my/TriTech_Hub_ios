const mongoose = require('mongoose');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

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

// Auto-encrypt phone on save
PasswordResetSchema.pre('save', function (next) {
  if (this.isModified('phone') && this.phone && !isEncrypted(this.phone)) {
    this.phone = encrypt(this.phone);
  }
  next();
});

// Auto-decrypt phone on retrieval
PasswordResetSchema.post(/^find/, function (docs) {
  const docArray = Array.isArray(docs) ? docs : [docs || {}];
  docArray.forEach(doc => {
    if (doc && doc.phone && typeof doc.phone === 'string') {
      doc.phone = decrypt(doc.phone);
    }
  });
});

// TTL index: automatically remove documents after expires_at
PasswordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// Compound indexes include `used` so lookups hit the index directly
PasswordResetSchema.index({ email: 1, used: 1 });
PasswordResetSchema.index({ phone: 1, used: 1 });
PasswordResetSchema.index({ token: 1 }, { unique: true });

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
