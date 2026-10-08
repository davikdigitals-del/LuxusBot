import crypto from 'crypto';
import config from '../config/index.js';

const ALGO = 'aes-256-gcm';

const getKey = () => Buffer.from(config.encryptionKey, 'hex'); // 32 bytes

/**
 * Encrypt a string (used for tenant AI provider keys).
 * Format: v1:<iv>:<authTag>:<ciphertext> (all hex)
 */
export const encrypt = (plain) => {
  if (plain === undefined || plain === null || plain === '') return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${data.toString('hex')}`;
};

export const decrypt = (payload) => {
  if (!payload) return payload;
  const [version, ivHex, tagHex, dataHex] = String(payload).split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !dataHex) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};

export const sha256 = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

/**
 * Create a tenant API key. Show `key` to the user ONCE; store only prefix + keyHash.
 */
export const generateApiKey = (env = 'live') => {
  const key = `lx_${env}_${crypto.randomBytes(24).toString('hex')}`;
  return { key, prefix: key.slice(0, 12), keyHash: sha256(key) };
};

export default { encrypt, decrypt, sha256, generateApiKey };
