const mongoose = require('mongoose');

/**
 * Notes on a customer: calls made, promises to pay, things to follow up.
 * A note with a follow-up date (or a promise date) shows on the "To call
 * today" list from that day until it's marked done.
 */
const CustomerNoteSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    text: { type: String, trim: true, required: true, maxlength: 1000 },
    promise_date: { type: Date, default: null },   // customer promised to pay by …
    promise_amount: { type: Number, default: null },
    follow_up_date: { type: Date, default: null }, // call again on …
    done: { type: Boolean, default: false },
    done_at: { type: Date, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
CustomerNoteSchema.index({ done: 1, follow_up_date: 1 });
CustomerNoteSchema.index({ done: 1, promise_date: 1 });

module.exports = mongoose.model('CustomerNote', CustomerNoteSchema);
