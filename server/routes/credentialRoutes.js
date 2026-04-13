const express = require('express');
const crypto = require('crypto');
const {
  credentialCreateSchema,
  credentialUpdateSchema,
  confirmationSchema
} = require('../validation/credentialSchemas');

function createCredentialRoutes({ vault }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    return res.status(200).json({ credentials: vault.list() });
  });

  router.post('/', (req, res) => {
    const parsed = credentialCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
    }

    const saved = vault.create(parsed.data);
    return res.status(201).json({ credential: saved });
  });

  router.patch('/:id', (req, res) => {
    const parsed = credentialUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload.', details: parsed.error.flatten() });
    }

    const updated = vault.update(req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    return res.status(200).json({ credential: updated });
  });

  router.post('/:id/confirmation-token', (req, res) => {
    if (!vault.store.has(req.params.id)) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    const token = crypto.randomBytes(24).toString('base64url');
    req.app.locals.confirmationTokens.set(token, {
      credentialId: req.params.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
      action: 'delete'
    });

    return res.status(201).json({ confirmationToken: token, expiresInSeconds: 300 });
  });

  router.delete('/:id', (req, res) => {
    const parsed = confirmationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'confirmationToken required.', details: parsed.error.flatten() });
    }

    const entry = req.app.locals.confirmationTokens.get(parsed.data.confirmationToken);
    if (!entry || entry.expiresAt < Date.now() || entry.credentialId !== req.params.id || entry.action !== 'delete') {
      return res.status(403).json({ error: 'Invalid or expired confirmation token.' });
    }

    const removed = vault.remove(req.params.id);
    req.app.locals.confirmationTokens.delete(parsed.data.confirmationToken);

    if (!removed) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    return res.status(200).json({ ok: true });
  });

  return router;
}

module.exports = { createCredentialRoutes };
