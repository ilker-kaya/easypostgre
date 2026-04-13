import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEncryptionKey, decryptCredential, encryptCredential } from '../src/crypto.js';

test('encrypts and decrypts credentials', () => {
  const key = Buffer.alloc(32, 7);
  const encrypted = encryptCredential('postgres://user:pass@localhost/db', key);
  const decrypted = decryptCredential(encrypted, key);

  assert.equal(decrypted, 'postgres://user:pass@localhost/db');
});

test('validates key length', () => {
  assert.throws(() => decodeEncryptionKey(Buffer.alloc(16).toString('base64')), /exactly 32 bytes/);
});
