/**
 * Registration checks on the customer's and guarantor's details.
 *
 * Ghana Card numbers are stored encrypted (a different result every time), so
 * to find "this card is already registered" each customer also gets a
 * fingerprint of the number (ghana_card_hash): a keyed hash that can be
 * compared but not turned back into the number.
 */
const crypto = require('crypto');
const logger = require('./logger');

// "gha-123 456 789-0" → "GHA1234567890"
const normCard = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Last 9 digits of a Ghana phone number (0244…, +233244…, 233244… all match).
const normPhone = (v) => String(v || '').replace(/\D/g, '').slice(-9);

function hashKey() {
  const k = process.env.ENCRYPTION_KEY;
  return k && /^[0-9a-fA-F]{64}$/.test(k) ? Buffer.from(k, 'hex') : Buffer.alloc(32, 0);
}
/** Which key the fingerprints were made with (so a key change re-makes them). */
function keyId() {
  return crypto.createHash('sha256').update(hashKey()).digest('hex').slice(0, 8);
}
/** Fingerprint of a Ghana Card number, or null if it's too short to be one. */
function cardHash(v) {
  const n = normCard(v);
  if (n.length < 6) return null;
  return crypto.createHmac('sha256', hashKey()).update(`ghana-card:${n}`).digest('hex');
}

/**
 * Check the ID details of a registration.
 * Returns { blocks: [msg], warns: [{ code, message, admin }] }:
 *  - blocks stop the registration (always wrong);
 *  - warns are shown to the DSR to confirm, and flagged for the admin.
 */
async function checkIdentity({ ghana_card_id, guarantor_ghana_card_id, phone, guarantor_phone, excludeCustomerId = null }) {
  const Customer = require('../models/Customer');
  const blocks = [];
  const warns = [];

  const c = normCard(ghana_card_id);
  const g = normCard(guarantor_ghana_card_id);
  if (c && g && c === g) {
    blocks.push("The guarantor's Ghana Card number is the same as the customer's. The guarantor must be a different person — enter the guarantor's own Ghana Card number.");
  }

  if (phone && guarantor_phone && normPhone(phone).length === 9 && normPhone(phone) === normPhone(guarantor_phone)) {
    warns.push({
      code: 'guarantor_same_phone',
      message: "The guarantor's phone number is the same as the customer's. Use the guarantor's own number.",
      admin: "Guarantor's phone number is the same as the customer's.",
    });
  }

  const h = cardHash(ghana_card_id);
  if (h) {
    const q = { ghana_card_hash: h, deleted_at: null };
    if (excludeCustomerId) q._id = { $ne: excludeCustomerId };
    const others = await Customer.find(q).select('full_name user_id').populate({ path: 'user_id', select: 'account_number' }).limit(3).lean()
      .catch((e) => { logger.warn('[id-check] lookup failed: %s', e.message); return []; });
    if (others.length) {
      warns.push({
        code: 'ghana_card_already_registered',
        message: 'This Ghana Card number is already registered to another customer. Continue only if the SAME person is buying another phone; otherwise check the number.',
        admin: `Ghana Card number already used by: ${others.map((o) => `${o.full_name}${o.user_id?.account_number ? ` (${o.user_id.account_number})` : ''}`).join(', ')}.`,
      });
    }
  }
  return { blocks, warns };
}

const PHOTO_CODES = new Set([
  'front_no_face', 'back_has_face', 'customer_no_face', 'guarantor_no_face',
  'guarantor_same_as_customer', 'customer_card_mismatch', 'photo_dark', 'photo_bright', 'photo_blurry',
]);
const FIELD_NAMES = {
  ghana_card_front: 'Ghana Card front', ghana_card_back: 'Ghana Card back',
  customer_photo: 'Customer photo', guarantor_photo: 'Guarantor photo',
};

/** Photo warnings the DSR confirmed on the phone → review flags (sanitized). */
function photoFlags(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 12)
    .filter((f) => f && PHOTO_CODES.has(String(f.code)) && FIELD_NAMES[f.field])
    .map((f) => ({
      code: String(f.code),
      source: 'photo',
      message: `${FIELD_NAMES[f.field]}: ${String(f.message || '').slice(0, 200)} (DSR confirmed it was correct)`,
      at: new Date(),
    }));
}

/** Review flags for a sale: ID warnings + photo warnings the DSR overrode. */
function reviewFlags(idResult, photoFlagList) {
  return [
    ...idResult.warns.map((w) => ({ code: w.code, source: 'system', message: w.admin, at: new Date() })),
    ...photoFlags(photoFlagList),
  ];
}

/**
 * Give every customer a Ghana Card fingerprint (and re-make them if the
 * encryption key changed). Run at start-up; cheap.
 */
async function backfillCardHashes() {
  const Customer = require('../models/Customer');
  const kid = keyId();
  const todo = await Customer.find({ ghana_card_id: { $nin: [null, ''] }, ghana_card_hash_kid: { $ne: kid } })
    .select('ghana_card_id').lean();
  let n = 0;
  for (const c of todo) {
    const h = cardHash(c.ghana_card_id); // decrypted by the model's find hook
    await Customer.updateOne({ _id: c._id }, { $set: { ghana_card_hash: h, ghana_card_hash_kid: kid } });
    n += 1;
  }
  if (n) logger.info('[id-check] Ghana Card fingerprints made for %d customer(s).', n);
  return n;
}

module.exports = { normCard, normPhone, cardHash, keyId, checkIdentity, reviewFlags, photoFlags, backfillCardHashes };
