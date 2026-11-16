const mongoose = require('mongoose');

/**
 * "Do not sell" list: Ghana Cards (by fingerprint, see utils/idChecks) of past
 * defaulters. A new sale to that card is stopped; a guarantor on the list is
 * flagged.
 */
const BlacklistSchema = new mongoose.Schema(
  {
    card_hash: { type: String, required: true, unique: true },
    name: { type: String, trim: true },
    role: { type: String, enum: ['customer', 'guarantor'], default: 'customer' },
    reason: { type: String, trim: true, maxlength: 300 },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Blacklist', BlacklistSchema);
