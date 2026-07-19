const mongoose = require('mongoose');

// Records each commission payout made to a staff member, so owed commission
// can be computed as (total phones sold − phones already paid for) × rate.
const CommissionPayoutSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },          // GHS paid out
    sales_count: { type: Number, required: true },     // number of phones this payout covers
    rate: { type: Number, required: true },            // GHS per phone at time of payout
    status: { type: String, enum: ['success', 'pending', 'failed'], default: 'success' },
    momo_number: { type: String, trim: true },
    network: { type: String, trim: true },             // MTN / VOD / ATL
    paystack_transfer_code: { type: String, trim: true },
    paystack_reference: { type: String, trim: true },
    recipient_code: { type: String, trim: true },
    paid_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommissionPayout', CommissionPayoutSchema);
