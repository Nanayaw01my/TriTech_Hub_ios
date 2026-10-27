const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'hex';

// Records written while ENCRYPTION_KEY was unset were encrypted with this
// all-zeros key. It is public (it's in this source code), so such data is
// effectively unprotected — see reencryptLegacy() below to move it to a real key.
const LEGACY_KEY = Buffer.alloc(32, 0);

let _warned = false;
const hasRealKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  return !!key && /^[0-9a-fA-F]{64}$/.test(key);
};

const getEncryptionKey = () => {
  if (!hasRealKey()) {
    if (!_warned) {
      _warned = true;
      logger.warn('ENCRYPTION_KEY not set or invalid (must be 64 hex chars). Using the public default key — data is NOT protected!');
    }
    return LEGACY_KEY;
  }
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
};

const encrypt = (plaintext) => {
  if (!plaintext) return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    const combined = iv.toString(ENCODING) + ':' + authTag.toString(ENCODING) + ':' + encrypted;

    return combined;
  } catch (error) {
    logger.error('Encryption error: %s', error.message);
    return plaintext;
  }
};

/** Decrypt with one specific key; null if it isn't the right key. */
const decryptWith = (key, encrypted) => {
  try {
    const parts = encrypted.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(parts[0], ENCODING));
    decipher.setAuthTag(Buffer.from(parts[1], ENCODING));
    let decrypted = decipher.update(parts[2], ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
};

const decrypt = (encrypted) => {
  if (!encrypted) return null;
  if (encrypted.split(':').length !== 3) return encrypted;

  // Current key first; then the legacy key, so data written before a real
  // ENCRYPTION_KEY was set stays readable after you set one.
  const plain = decryptWith(getEncryptionKey(), encrypted)
    ?? (hasRealKey() ? decryptWith(LEGACY_KEY, encrypted) : null);
  if (plain === null) {
    logger.error('Decryption error: value could not be decrypted with the current or legacy key');
    return encrypted;
  }
  return plain;
};

const isEncrypted = (value) => {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
};

/**
 * If [value] is encrypted with the legacy (public) key and a real
 * ENCRYPTION_KEY is set, return it re-encrypted with the real key. Otherwise
 * return null (nothing to do). Plain-text values are left alone.
 */
const reencryptLegacy = (value) => {
  if (!hasRealKey() || !isEncrypted(value)) return null;
  if (decryptWith(getEncryptionKey(), value) !== null) return null; // already on the real key
  const plain = decryptWith(LEGACY_KEY, value);
  return plain === null ? null : encrypt(plain);
};

module.exports = { encrypt, decrypt, isEncrypted, hasRealKey, reencryptLegacy };
