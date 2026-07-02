const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'hex';

const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    logger.warn('ENCRYPTION_KEY not set or invalid (must be 64 hex chars). Using defaults — data NOT encrypted!');
    return Buffer.from('0'.repeat(64), 'hex');
  }
  return Buffer.from(key, 'hex');
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

const decrypt = (encrypted) => {
  if (!encrypted) return null;

  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted;

    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], ENCODING);
    const authTag = Buffer.from(parts[1], ENCODING);
    const encryptedData = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption error: %s', error.message);
    return encrypted;
  }
};

const isEncrypted = (value) => {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
};

module.exports = { encrypt, decrypt, isEncrypted };
