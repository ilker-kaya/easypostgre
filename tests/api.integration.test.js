import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/server.js';

test('reports fallback mode when pg binaries are unavailable', async () => {
  const server = createApp({ commandExists: () => false });
  server.listen(0);
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/system/prerequisites`);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.pgDump, false);
  assert.equal(json.pgRestore, false);
  assert.equal(json.fallbackMode, true);

  server.close();
});
