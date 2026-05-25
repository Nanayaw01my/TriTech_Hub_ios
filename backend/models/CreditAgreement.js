const mongoose = require('mongoose');

const CreditPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    payment_date: { type: Date, default: Date.now },
    week_number: { type: Number },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const CreditAgreementSchema = new mongoose.Schema(
  {
    customer_name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customer_phone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
    },
    customer_photo: {
      type: String, // file path
    },
    customer_address: {
      type: String,
      trim: true,
    },
    guarantor_name: {
      type: String,
      trim: true,
    },
    guarantor_phone: {
      type: String,
      trim: true,
    },
    guarantor_address: {
      type: String,
      trim: true,
    },
    product_description: {
      type: String,
      trim: true,
    },
    total_amount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0.01, 'Total amount must be greater than 0'],
    },
    down_payment: {
      type: Number,
      default: 0,
    },
    remaining: {
      type: Number,
    },
    interest_rate: {
      type: Number,
      default: 0,
    },
    weekly_installment: {
      type: Number, // remaining / 3
    },
    start_date: {
      type: Date,
      default: Date.now,
    },
    end_date: {
      type: Date, // start + 21 days
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'defaulted'],
      default: 'active',
    },
    payments: [CreditPaymentSchema],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save: compute remaining and weekly installment
CreditAgreementSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('total_amount') || this.isModified('down_payment')) {
    this.remaining = Math.max(0, this.total_amount - this.down_payment);
    this.weekly_installment = this.remaining > 0 ? Math.ceil(this.remaining / 3) : 0;
  }

  if (this.isNew && this.start_date && !this.end_date) {
    const end = new Date(this.start_date);
    end.setDate(end.getDate() + 21);
    this.end_date = end;
  }

  next();
});

CreditAgreementSchema.index({ status: 1 });
CreditAgreementSchema.index({ customer_name: 1 });
CreditAgreementSchema.index({ created_by: 1, createdAt: -1 });

module.exports = mongoose.model('CreditAgreement', CreditAgreementSchema);
