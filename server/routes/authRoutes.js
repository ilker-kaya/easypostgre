const express = require('express');

function createAuthRoutes({ config, sessionService }) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { username, password } = req.body || {};

    if (username !== config.adminUser || password !== config.adminPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const session = sessionService.createSession({ username });

    res.cookie('sid', session.id, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: config.sessionTtlMs
    });

    return res.status(200).json({
      ok: true,
      username: session.username,
      expiresAt: session.expiresAt
    });
  });

  router.post('/logout', (req, res) => {
    const sid = req.cookies.sid || req.header('x-session-id');
    sessionService.destroy(sid);
    res.clearCookie('sid');
    return res.status(200).json({ ok: true });
  });

  return router;
}

module.exports = { createAuthRoutes };
