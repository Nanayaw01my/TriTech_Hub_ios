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

// Auto-decrypt phone on retrieval
CustomerSchema.post(/^find/, function () {
  const docs = Array.isArray(this._doc) ? [this._doc] : [this];
  docs.forEach(doc => {
    if (doc && doc.phone && typeof doc.phone === 'string') {
      doc.phone = decrypt(doc.phone);
    }
    if (doc && doc.ghana_card_id && typeof doc.ghana_card_id === 'string') {
      doc.ghana_card_id = decrypt(doc.ghana_card_id);
    }
    if (doc && doc.guarantor?.phone && typeof doc.guarantor.phone === 'string') {
      doc.guarantor.phone = decrypt(doc.guarantor.phone);
    }
    if (doc && doc.guarantor?.ghana_card_id && typeof doc.guarantor.ghana_card_id === 'string') {
      doc.guarantor.ghana_card_id = decrypt(doc.guarantor.ghana_card_id);
    }
  });
});

module.exports = mongoose.model('Customer', CustomerSchema);
