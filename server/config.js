const crypto = require('crypto');

function loadConfig() {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const appSecret = process.env.APP_SECRET;
  const sessionTtlMinutes = Number(process.env.SESSION_TTL_MINUTES || 60);

  if (!adminPassword) {
    throw new Error('Missing ADMIN_PASSWORD env var for admin login.');
  }

  if (!appSecret) {
    throw new Error('Missing APP_SECRET env var for credential encryption.');
  }

  const appSecretKey = crypto.createHash('sha256').update(appSecret).digest();

  return {
    adminUser,
    adminPassword,
    appSecretKey,
    sessionTtlMs: sessionTtlMinutes * 60 * 1000
  };
}

module.exports = { loadConfig };
