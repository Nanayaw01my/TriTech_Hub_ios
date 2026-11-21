const mongoose = require('mongoose');

/**
 * Keys for other systems (e.g. the shop management system) to use the API at
 * /api/v1. Only a hash of the key is stored; the key itself is shown once,
 * when it's created.
 */
const SCOPES = ['sales:read', 'payments:read', 'stock:read', 'payments:write'];

const ApiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    key_hash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true }, // first characters, to recognise the key
    scopes: [{ type: String, enum: SCOPES }],
    active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    last_used_at: { type: Date, default: null },
    uses: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ApiKeySchema.statics.SCOPES = SCOPES;
module.exports = mongoose.model('ApiKey', ApiKeySchema);
