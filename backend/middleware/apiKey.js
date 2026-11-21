/**
 * API-key check for /api/v1. The key comes in the Authorization header
 * ("Bearer ddsk_…") or X-API-Key. Each route says which permission it needs.
 */
const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');

const hashKey = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
const apiError = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

function requireApiKey(scope) {
  return async (req, res, next) => {
    try {
      const auth = String(req.headers.authorization || '');
      const raw = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : String(req.headers['x-api-key'] || '').trim();
      if (!raw) return apiError(res, 401, 'missing_key', 'Send your API key in the Authorization header: "Bearer <key>".');
      const key = req.apiKey || await ApiKey.findOne({ key_hash: hashKey(raw) });
      if (!key || !key.active) return apiError(res, 401, 'invalid_key', 'This API key is not valid or has been switched off.');
      if (scope && !key.scopes.includes(scope)) {
        return apiError(res, 403, 'not_allowed', `This API key is not allowed to do this (needs "${scope}").`);
      }
      req.apiKey = key;
      // Remember when it was last used (at most once a minute).
      if (!key.last_used_at || Date.now() - key.last_used_at.getTime() > 60000) {
        ApiKey.updateOne({ _id: key._id }, { $set: { last_used_at: new Date() }, $inc: { uses: 1 } }).catch(() => {});
      }
      return next();
    } catch (e) {
      return apiError(res, 500, 'server_error', 'Server error.');
    }
  };
}

module.exports = { requireApiKey, hashKey, apiError };
