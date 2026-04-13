const express = require('express');
const cookieParser = require('cookie-parser');
const { loadConfig } = require('./config');
const { SessionService } = require('./services/sessionService');
const { CredentialVault } = require('./services/credentialVault');
const { requireAdminSession } = require('./middleware/auth');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createCredentialRoutes } = require('./routes/credentialRoutes');

const config = loadConfig();
const sessionService = new SessionService({ ttlMs: config.sessionTtlMs });
const vault = new CredentialVault({ secretKey: config.appSecretKey });

const app = express();
app.use(express.json());
app.use(cookieParser());
app.locals.confirmationTokens = new Map();

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.use('/auth', createAuthRoutes({ config, sessionService }));

app.use('/credentials', requireAdminSession(sessionService), createCredentialRoutes({ vault }));

app.get('/admin/me', requireAdminSession(sessionService), (req, res) => {
  return res.status(200).json({ username: req.adminSession.username, expiresAt: req.adminSession.expiresAt });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${port}`);
});
