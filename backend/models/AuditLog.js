const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    username: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ip_address: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

AuditLogSchema.index({ user_id: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ role: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
