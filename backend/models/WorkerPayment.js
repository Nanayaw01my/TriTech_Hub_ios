const mongoose = require('mongoose');

const WorkerPaymentSchema = new mongoose.Schema(
  {
    worker_name: {
      type: String,
      required: [true, 'Worker name is required'],
      trim: true,
    },
    worker_phone: {
      type: String,
      trim: true,
    },
    commission_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    amount_paid: {
      type: Number,
      required: [true, 'Amount paid is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    payment_date: {
      type: Date,
      default: Date.now,
    },
    period_start: {
      type: Date,
    },
    period_end: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
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

WorkerPaymentSchema.index({ payment_date: -1 });
WorkerPaymentSchema.index({ worker_name: 1 });

module.exports = mongoose.model('WorkerPayment', WorkerPaymentSchema);
