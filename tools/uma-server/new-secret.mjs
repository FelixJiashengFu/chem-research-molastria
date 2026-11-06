// Makes a new shared secret for the UMA service and hands it to both sides without printing it:
// tools/uma-server/secret.local (read by server.py, kept out of git) and the account Worker's UMA_SERVER_SECRET
// (through `wrangler secret put`, which reads it from stdin). Run it again any time to rotate the secret;
// restart server.py afterwards.
//   node tools/uma-server/new-secret.mjs           (needs `npx.cmd wrangler login` done once in deploy/)
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const secret = randomBytes(32).toString('hex');
writeFileSync(join(here, 'secret.local'), secret + '\n', { mode: 0o600 });
console.log('Wrote tools/uma-server/secret.local (not in git).');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const r = spawnSync(`${npx} wrangler secret put UMA_SERVER_SECRET`, { cwd: join(here, '..', '..', 'deploy'), input: secret, stdio: ['pipe', 'inherit', 'inherit'], shell: true });
if (r.status !== 0) {
  console.error('wrangler did not store the secret. Log in with  npx.cmd wrangler login  in deploy/, then run this again.');
  process.exit(1);
}
console.log('The account service has the same secret. Restart server.py if it is running.');
