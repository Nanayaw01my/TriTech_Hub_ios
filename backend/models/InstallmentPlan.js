const mongoose = require('mongoose');

const ScheduleItemSchema = new mongoose.Schema(
  {
    due_date: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
  },
  { _id: true }
);

const InstallmentPlanSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    device_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    down_payment: {
      type: Number,
      required: true,
      min: 0,
    },
    total_price: {
      type: Number,
      required: true,
      min: 0,
    },
    remaining_balance: {
      type: Number,
      required: true,
      min: 0,
    },
    installment_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    total_payments: {
      type: Number,
      required: true,
      min: 1,
    },
    payments_made: {
      type: Number,
      default: 0,
      min: 0,
    },
    start_date: {
      type: Date,
      required: true,
    },
    next_due_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      // 'pending'   = sale registered by a DSR, awaiting the admin's review.
      // 'returned'  = admin sent it back to the DSR to correct (see review_note).
      // 'approved'  = admin approved; waiting for the DSR to collect the deposit
      //               via Paystack. Paying it activates the plan automatically.
      // 'closed'    = phone released by the admin; plan ended (balance written off).
      // 'cancelled' = customer deleted.
      // The schedule clock + overdue locking only run while 'active'.
      enum: ['pending', 'returned', 'approved', 'active', 'completed', 'defaulted', 'repossessed', 'closed', 'cancelled'],
      default: 'active',
    },
    // Admin's reason when sending a sale back for correction.
    review_note: {
      type: String,
      trim: true,
      default: null,
    },
    returned_at: {
      type: Date,
      default: null,
    },
    closed_at: {
      type: Date,
      default: null,
    },
    close_reason: {
      type: String,
      enum: [null, 'phone_released', 'customer_deleted'],
      default: null,
    },
    // Unpaid balance at the moment the plan was closed/cancelled.
    written_off: {
      type: Number,
      default: 0,
    },
    approved_at: {
      type: Date,
      default: null,
    },
    activated_at: {
      type: Date,
      default: null,
    },
    // Deposit (down payment) — collected through Paystack after approval.
    down_payment_paid: {
      type: Boolean,
      default: false,
    },
    down_payment_reference: {
      type: String,
      trim: true,
      default: null,
    },
    schedule: [ScheduleItemSchema],
  },
  {
    timestamps: true,
  }
);

InstallmentPlanSchema.index({ customer_id: 1 });
InstallmentPlanSchema.index({ customer_id: 1, status: 1 });
InstallmentPlanSchema.index({ status: 1, next_due_date: 1 });
InstallmentPlanSchema.index({ created_by: 1 });
InstallmentPlanSchema.index({ device_id: 1 });

module.exports = mongoose.model('InstallmentPlan', InstallmentPlanSchema);
