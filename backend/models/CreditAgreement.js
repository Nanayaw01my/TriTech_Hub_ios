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
    // Customer
    customer_name: { type: String, required: [true, 'Customer name is required'], trim: true },
    customer_phone: { type: String, required: [true, 'Customer phone is required'], trim: true },
    customer_address: { type: String, trim: true },
    document_type: { type: String, trim: true },
    id_number: { type: String, trim: true },
    customer_passport_url: { type: String },

    // Product
    product_type: { type: String, trim: true },
    product_description: { type: String, trim: true },
    serial_number: { type: String, trim: true },

    // Financials
    total_amount: { type: Number, required: [true, 'Total amount is required'], min: [0.01, 'Must be > 0'] },
    down_payment: { type: Number, default: 0 },
    remaining: { type: Number },
    payment_plan: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    weekly_installment: { type: Number },
    interest_rate: { type: Number, default: 0 },

    // Dates
    start_date: { type: Date, default: Date.now },
    end_date: { type: Date },

    // Guarantor
    guarantor_name: { type: String, trim: true },
    guarantor_phone: { type: String, trim: true },
    guarantor_address: { type: String, trim: true },
    guarantor_ghana_card: { type: String, trim: true },
    guarantor_passport_url: { type: String },

    // Legacy photo (disk path)
    customer_photo: { type: String },

    status: { type: String, enum: ['active', 'completed', 'defaulted'], default: 'active' },
    payments: [CreditPaymentSchema],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CreditAgreementSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('total_amount') || this.isModified('down_payment')) {
    this.remaining = Math.max(0, this.total_amount - this.down_payment);
    this.weekly_installment = this.remaining > 0 ? +(this.remaining / 3).toFixed(2) : 0;
  }

  if (this.isNew && this.start_date && !this.end_date) {
    const planDays = { daily: 3, weekly: 21, monthly: 90 };
    const days = planDays[this.payment_plan] || 21;
    const end = new Date(this.start_date);
    end.setDate(end.getDate() + days);
    this.end_date = end;
  }

  next();
});

CreditAgreementSchema.index({ status: 1 });
CreditAgreementSchema.index({ customer_name: 1 });
CreditAgreementSchema.index({ created_by: 1, createdAt: -1 });

module.exports = mongoose.model('CreditAgreement', CreditAgreementSchema);

