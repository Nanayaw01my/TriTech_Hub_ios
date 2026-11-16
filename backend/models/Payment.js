const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    installment_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstallmentPlan',
      required: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payment_date: {
      type: Date,
      default: Date.now,
    },
    payment_method: {
      type: String,
      // manual_* = recorded by staff/admin for money received outside Paystack:
      // cash, Mobile Money sent to the company number, or a bank transfer.
      enum: ['paystack', 'manual_cash', 'manual_momo', 'manual_bank'],
      required: true,
    },
    paystack_reference: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    paystack_status: {
      type: String,
      trim: true,
    },
    paid_by: {
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      user_role: {
        type: String,
        enum: ['admin', 'staff', 'customer'],
      },
      name: {
        type: String,
        trim: true,
      },
    },
    recorded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
    },
    // 'deposit' (down payment) or 'installment'. Older records: see isDeposit().
    kind: { type: String, enum: ['deposit', 'installment'], default: undefined },
    // How much of this payment went to late fees (the rest went to the balance).
    applied_penalty: { type: Number, default: undefined },
    // Cancelled by an admin (e.g. recorded twice). Kept for the record, but left
    // out of every total and balance. Queries skip voided payments unless
    // asked with .setOptions({ includeVoided: true }).
    voided: { type: Boolean, default: false },
    voided_at: { type: Date, default: null },
    voided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    void_reason: { type: String, trim: true, default: null },
    // Cash-up: cash/MoMo collected by staff, marked as handed in to the office.
    cash_received_at: { type: Date, default: null },
    cash_received_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
  }
);

// Leave voided payments out of every find / count / aggregate, unless the
// query says { includeVoided: true }.
function skipVoided() {
  if (this.getOptions?.().includeVoided) return;
  const q = this.getQuery ? this.getQuery() : {};
  if (q && Object.prototype.hasOwnProperty.call(q, 'voided')) return; // asked explicitly
  this.where({ voided: { $ne: true } });
}
PaymentSchema.pre(/^find/, skipVoided);
PaymentSchema.pre('countDocuments', skipVoided);
PaymentSchema.pre('aggregate', function () {
  if (this.options?.includeVoided) return;
  const first = this.pipeline()[0];
  if (first && first.$match && Object.prototype.hasOwnProperty.call(first.$match, 'voided')) return;
  this.pipeline().unshift({ $match: { voided: { $ne: true } } });
});

/** Was this the down payment? (Older records have no kind: read the note.) */
PaymentSchema.statics.isDeposit = (p) => p?.kind === 'deposit' || (!p?.kind && /deposit/i.test(p?.notes || ''));

PaymentSchema.index({ customer_id: 1 });
PaymentSchema.index({ customer_id: 1, payment_date: -1 });
PaymentSchema.index({ installment_plan_id: 1 });
PaymentSchema.index({ payment_date: -1 });
PaymentSchema.index({ payment_method: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
