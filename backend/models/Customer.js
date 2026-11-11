const mongoose = require('mongoose');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const CustomerSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    full_name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    ghana_card_id: {
      type: String,
      trim: true,
    },
    // Fingerprint of the Ghana Card number (the number itself is encrypted),
    // used to spot a card that's already registered. See utils/idChecks.js.
    ghana_card_hash: { type: String, default: null, index: true },
    ghana_card_hash_kid: { type: String, default: null },
    // Things for the admin to look at before approving: ID warnings found by
    // the system, and photo warnings the DSR overrode ("It's correct").
    review_flags: [{
      code: { type: String },
      source: { type: String }, // 'system' | 'photo'
      message: { type: String },
      at: { type: Date, default: Date.now },
      _id: false,
    }],
    photos: {
      ghana_card_front: {
        type: String,
        default: null,
      },
      ghana_card_back: {
        type: String,
        default: null,
      },
      customer_photo: {
        type: String,
        default: null,
      },
      guarantor_photo: {
        type: String,
        default: null,
      },
      signature: {
        type: String,
        default: null,
      },
    },
    occupation: {
      type: String,
      trim: true,
    },
    income: {
      amount: {
        type: Number,
        default: 0,
      },
      source: {
        type: String,
        trim: true,
      },
    },
    location: {
      region: {
        type: String,
        trim: true,
      },
      district: {
        type: String,
        trim: true,
      },
      town: {
        type: String,
        trim: true,
      },
      landmark: {
        type: String,
        trim: true,
      },
      gps_address: {
        type: String,
        trim: true,
      },
    },
    guarantor: {
      full_name: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      ghana_card_id: {
        type: String,
        trim: true,
      },
      relationship: {
        type: String,
        trim: true,
      },
    },
    proof_of_income: {
      type: String,
      default: null,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // True when the system generated the login PIN (the DSR left the password
    // blank). The customer is only texted their login once the plan starts, so
    // a fresh PIN is issued then.
    pin_pending: {
      type: Boolean,
      default: false,
    },
    // What the customer agreed to at registration (recorded by the DSR).
    consents: {
      terms: { type: Boolean, default: false },
      adult: { type: Boolean, default: false },
      device_management: { type: Boolean, default: false },
      late_fee_per_day: { type: Number, default: null },
      accepted_at: { type: Date, default: null },
      recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    // Unique id the DSR's app sends with a registration. If the same sale is
    // sent twice (weak network, retry), the server returns the first one
    // instead of creating a duplicate customer.
    client_ref: {
      type: String,
      default: undefined,
      index: { unique: true, sparse: true },
    },
    // The customer asked for their data to be deleted (handled by the admin).
    deletion_requested_at: {
      type: Date,
      default: null,
    },
    // Set when the admin deletes the customer: hidden from lists and counts,
    // record kept for the audit trail.
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

CustomerSchema.index({ user_id: 1 });
CustomerSchema.index({ created_by: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ full_name: 'text' });

// Auto-encrypt phone on save
CustomerSchema.pre('save', function (next) {
  // Fingerprint the Ghana Card number while it's still readable.
  if (this.isModified('ghana_card_id') && this.ghana_card_id && !isEncrypted(this.ghana_card_id)) {
    const ids = require('../utils/idChecks');
    this.ghana_card_hash = ids.cardHash(this.ghana_card_id);
    this.ghana_card_hash_kid = ids.keyId();
  }
  if (this.isModified('phone') && this.phone && !isEncrypted(this.phone)) {
    this.phone = encrypt(this.phone);
  }
  if (this.isModified('ghana_card_id') && this.ghana_card_id && !isEncrypted(this.ghana_card_id)) {
    this.ghana_card_id = encrypt(this.ghana_card_id);
  }
  if (this.isModified('guarantor.phone') && this.guarantor?.phone && !isEncrypted(this.guarantor.phone)) {
    this.guarantor.phone = encrypt(this.guarantor.phone);
  }
  if (this.isModified('guarantor.ghana_card_id') && this.guarantor?.ghana_card_id && !isEncrypted(this.guarantor.ghana_card_id)) {
    this.guarantor.ghana_card_id = encrypt(this.guarantor.ghana_card_id);
  }
  next();
});

// Auto-decrypt PII on retrieval.
// In a post(/^find/) hook Mongoose passes the result docs as the argument
// (`this` is the Query, not the documents). Works for lean() results too.
CustomerSchema.post(/^find/, function (result) {
  if (!result) return;
  const docs = Array.isArray(result) ? result : [result];
  docs.forEach(doc => {
    if (!doc) return;
    if (isEncrypted(doc.phone)) doc.phone = decrypt(doc.phone);
    if (isEncrypted(doc.ghana_card_id)) doc.ghana_card_id = decrypt(doc.ghana_card_id);
    if (doc.guarantor && isEncrypted(doc.guarantor.phone)) doc.guarantor.phone = decrypt(doc.guarantor.phone);
    if (doc.guarantor && isEncrypted(doc.guarantor.ghana_card_id)) doc.guarantor.ghana_card_id = decrypt(doc.guarantor.ghana_card_id);
  });
});

module.exports = mongoose.model('Customer', CustomerSchema);
