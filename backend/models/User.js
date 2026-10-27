const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [4, 'Password must be at least 4 characters'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'staff', 'customer'],
      default: 'customer',
    },
    staff_id: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^Tri\d+$/, 'Staff ID must follow format Tri001'],
    },
    account_number: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // New accounts are DBS…; TRI… numbers from before the rename stay valid.
      match: [/^(DBS|TRI)\d{4}\d{5}$/, 'Account number must follow format DBS202600001'],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    branch: {
      type: String,
      trim: true,
      default: null,
    },
    // DSR commission per phone sold (GHS). Also the Paystack split share paid
    // automatically from the deposit when the DSR has payout details set up.
    commission_per_sale: {
      type: Number,
      default: 85,
      min: 0,
    },
    // DSR payout details for the automatic Paystack split (admin-entered).
    payout: {
      method: { type: String, enum: [null, 'bank', 'mobile_money'], default: null },
      bank_code: { type: String, trim: true, default: null },   // Paystack settlement_bank code
      bank_name: { type: String, trim: true, default: null },
      account_number: { type: String, trim: true, default: null },
      account_name: { type: String, trim: true, default: null },
      subaccount_code: { type: String, trim: true, default: null }, // ACCT_…
      split_id: { type: String, trim: true, default: null },
      split_code: { type: String, trim: true, default: null },      // SPL_…
      split_share: { type: Number, default: null },                 // GHS currently set on Paystack
      active: { type: Boolean, default: false },
      updated_at: { type: Date, default: null },
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  // Hash password if modified
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
      return next(err);
    }
  }

  // Encrypt phone if modified
  if (this.isModified('phone') && this.phone && !isEncrypted(this.phone)) {
    this.phone = encrypt(this.phone);
  }

  next();
});

// Auto-decrypt phone on retrieval
UserSchema.post(/^find/, function (docs) {
  const docArray = Array.isArray(docs) ? docs : [docs || {}];
  docArray.forEach(doc => {
    if (doc && isEncrypted(doc.phone)) {
      doc.phone = decrypt(doc.phone);
    }
  });
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
UserSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      name: this.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

UserSchema.index({ role: 1 });
UserSchema.index({ is_active: 1 });
UserSchema.index({ role: 1, is_active: 1 });

module.exports = mongoose.model('User', UserSchema);
