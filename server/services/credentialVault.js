const crypto = require('crypto');

function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(value.length - 4, 2))}${value.slice(-4)}`;
}

class CredentialVault {
  constructor({ secretKey }) {
    this.secretKey = secretKey;
    this.store = new Map();
  }

  encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.secretKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      tag: tag.toString('base64')
    };
  }

  decrypt(record) {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.secretKey,
      Buffer.from(record.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, 'base64')),
      decipher.final()
    ]);

    return plaintext.toString('utf8');
  }

  create(payload) {
    const id = crypto.randomUUID();
    const encryptedPassword = this.encrypt(payload.password);

    const record = {
      id,
      name: payload.name,
      host: payload.host,
      port: payload.port,
      database: payload.database,
      username: payload.username,
      encryptedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.store.set(id, record);
    return this.toSafeResponse(record);
  }

  update(id, payload) {
    const existing = this.store.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...payload,
      updatedAt: new Date().toISOString()
    };

    if (payload.password) {
      updated.encryptedPassword = this.encrypt(payload.password);
    }

    this.store.set(id, updated);
    return this.toSafeResponse(updated);
  }

  list() {
    return Array.from(this.store.values()).map((item) => this.toSafeResponse(item));
  }

  remove(id) {
    return this.store.delete(id);
  }

  getDecryptedForServerOnly(id) {
    const item = this.store.get(id);
    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      host: item.host,
      port: item.port,
      database: item.database,
      username: item.username,
      password: this.decrypt(item.encryptedPassword)
    };
  }

  toSafeResponse(record) {
    return {
      id: record.id,
      name: record.name,
      host: record.host,
      port: record.port,
      database: record.database,
      username: record.username,
      passwordMasked: maskSecret(this.decrypt(record.encryptedPassword)),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}

module.exports = { CredentialVault, maskSecret };
