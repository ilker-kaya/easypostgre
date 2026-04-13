import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureSafeStoragePath, validateDbIdentifier, validateRequiredString } from '../src/validation.js';

test('rejects empty required strings', () => {
  assert.throws(() => validateRequiredString('AUTH_SECRET', '   '), /required/);
});

test('rejects traversal in storage paths', () => {
  assert.throws(() => ensureSafeStoragePath('../tmp'), /Path traversal/);
});

test('validates db identifier format', () => {
  assert.equal(validateDbIdentifier('tenant_01-app'), 'tenant_01-app');
  assert.throws(() => validateDbIdentifier('tenant;drop table'), /can only contain/);
});
