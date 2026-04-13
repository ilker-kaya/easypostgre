import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';

/** @param {string} command */
export function binaryExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

/** @param {{commandExists?: (cmd: string) => boolean}} [deps] */
export function createApp(deps = {}) {
  const commandExists = deps.commandExists ?? binaryExists;

  return createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === '/api/v1/system/prerequisites' && req.method === 'GET') {
      const pgDump = commandExists('pg_dump');
      const pgRestore = commandExists('pg_restore');

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          pgDump,
          pgRestore,
          fallbackMode: !(pgDump && pgRestore),
          fallbackBehavior:
            'If binaries are missing, API returns fallbackMode=true and backup/restore operations should be disabled by callers.'
        })
      );
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

if (process.env.RUN_SERVER === '1') {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`easypostgre listening on port ${port}`);
  });
}
