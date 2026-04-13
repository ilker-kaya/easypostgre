const crypto = require('crypto');

class SessionService {
  constructor({ ttlMs }) {
    this.ttlMs = ttlMs;
    this.sessions = new Map();
  }

  createSession({ username }) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const session = {
      id,
      username,
      createdAt: now,
      expiresAt: now + this.ttlMs
    };

    this.sessions.set(id, session);
    return session;
  }

  validate(sessionId) {
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  destroy(sessionId) {
    if (!sessionId) return;
    this.sessions.delete(sessionId);
  }
}

module.exports = { SessionService };
