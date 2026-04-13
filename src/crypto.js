import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/** @param {string} base64Key */
export function decodeEncryptionKey(base64Key) {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.');
  }
  return key;
}

/** @param {string} plaintext @param {Buffer} key */
export function encryptCredential(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

/** @param {string} serialized @param {Buffer} key */
export function decryptCredential(serialized, key) {
  const [ivB64, tagB64, ciphertextB64] = serialized.split('.');

  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted credential payload format.');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}
