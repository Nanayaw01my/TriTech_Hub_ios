const mongoose = require('mongoose');

const TempOTPSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  otp_hash: {
    type: String,
    required: true,
  },
  expires_at: {
    type: Date,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
});

TempOTPSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
TempOTPSchema.index({ user_id: 1 });

module.exports = mongoose.model('TempOTP', TempOTPSchema);
