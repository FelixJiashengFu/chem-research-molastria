// The discussion rooms under the real runtime: deploy/account-worker.js with its Durable Object ChatHub in workerd
// (wrangler dev --local), a local D1 with deploy/schema.sql, and Node's own WebSocket as the browsers.
// tools/chat-test.mjs tests the room logic and tools/account-test.ts the Worker's side with stand-ins; this is the
// one place where the thin platform adapter (WebSocketPair, hibernation sockets, storage.sql, the binding and the
// migration in wrangler.toml) actually runs. Nothing touches Cloudflare: no account and no network are needed.
//   npm ci --prefix deploy        once, for wrangler
//   node tools/chat-workerd-test.mjs
// Prints "skipped" and exits 0 when deploy/node_modules is missing. Uses port 8866 and a temporary folder.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deploy = join(root, 'deploy');
const wrangler = join(deploy, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
if (!existsSync(wrangler)) {
  console.log('skipped: deploy/node_modules is missing (npm ci --prefix deploy)');
  process.exit(0);
}
const PORT = 8866, API = `http://127.0.0.1:${PORT}`, ORIGIN = 'https://molastria.com';
const state = mkdtempSync(join(tmpdir(), 'molastria-chat-'));
const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const d1 = (...args) => {
  const r = spawnSync(wrangler, ['d1', 'execute', 'molastria', '--local', '--persist-to', state, ...args], { cwd: deploy, env, encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); rmSync(state, { recursive: true, force: true }); process.exit(1); }
};
d1('--file', 'schema.sql');
// Signing in looks the account up at Stripe unless a recent row says what plan it has; there is no Stripe here.
d1('--command', "INSERT INTO accounts (email, plan, checked) VALUES ('ada@example.com', 'free', unixepoch()), ('ben@example.com', 'free', unixepoch())");

let log = '';
// detached: wrangler starts workerd as a child, and both must go when the test ends
const dev = spawn(wrangler, ['dev', '--local', '--persist-to', state, '--port', String(PORT), '--ip', '127.0.0.1', '--var', 'DEV_SHOW_CODE:1', '--var', `ALLOWED_ORIGINS:${ORIGIN}`, '--show-interactive-dev-session=false'],
  { cwd: deploy, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
dev.stdout.on('data', (d) => { log += d; });
dev.stderr.on('data', (d) => { log += d; });
function stop() {
  try { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(dev.pid), '/t', '/f']); else process.kill(-dev.pid, 'SIGKILL'); } catch { /* already gone */ }
  rmSync(state, { recursive: true, force: true });
}

async function call(method, path, body, token) {
  const r = await fetch(API + path, { method, headers: { Origin: ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null), headers: r.headers };
}
async function signIn(email) {
  const s = await call('POST', '/auth/start', { email });
  assert.ok(s.data?.devCode, `no sign-in code for ${email}: ${JSON.stringify(s.data)}`);
  const v = await call('POST', '/auth/verify', { email, code: s.data.devCode });
  assert.ok(v.data?.token, `no token for ${email}`);
  return v.data.token;
}
/** A browser: every frame it got, and until(test) for the next one that fits. */
async function browser(token) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/chat/ws`, { protocols: token ? ['molastria-chat', `t.${token}`] : ['molastria-chat'], headers: { Origin: ORIGIN } });
  const frames = [], texts = [], waiting = [];
  ws.addEventListener('message', (e) => {
    if (typeof e.data !== 'string' || !e.data.startsWith('{')) { texts.push(e.data); return; }
    const f = JSON.parse(e.data);
    frames.push(f);
    for (const w of [...waiting]) if (w.test(f)) { waiting.splice(waiting.indexOf(w), 1); w.resolve(f); }
  });
  await new Promise((ok, no) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', () => no(new Error('the WebSocket did not open')), { once: true }); });
  const until = (test, what = 'a frame') => {
    const hit = frames.find(test);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      waiting.push({ test, resolve });
      setTimeout(() => reject(new Error(`timed out waiting for ${what}; got ${JSON.stringify(frames.slice(-4))}`)), 8000);
    });
  };
  return { ws, frames, texts, until, send: (f) => ws.send(typeof f === 'string' ? f : JSON.stringify(f)), close: () => ws.close() };
}

let failed = false;
try {
  for (let i = 0; ; i++) {
    if (dev.exitCode !== null) throw new Error(`wrangler dev stopped:\n${log}`);
    if (await fetch(API + '/').then((r) => r.ok, () => false)) break;
    if (i > 240) throw new Error(`wrangler dev did not start:\n${log}`);
    await sleep(500);
  }

  const first = await call('GET', '/chat/summary');
  assert.equal(first.status, 200);
  assert.deepEqual([first.data.state, first.data.online, first.data.rooms, first.data.latest], ['on', 0, 7, []], 'the seven official rooms are there before anyone connects');
  assert.equal((await call('GET', '/chat/ws')).status, 426);

  const [tokenA, tokenB] = [await signIn('ada@example.com'), await signIn('ben@example.com')];
  const a = await browser(tokenA), b = await browser(tokenB), guest = await browser('');
  const [helloA, helloB, helloG] = await Promise.all([a, b, guest].map((x) => x.until((f) => f.t === 'hello', 'hello')));
  assert.equal(a.ws.protocol, 'molastria-chat', 'the server names the protocol it chose, and not the one that carried the token');
  assert.deepEqual([helloA.auth, helloA.me.name, helloA.me.role, helloG.auth, helloG.me], ['ok', null, 'user', 'none', null]);
  assert.match(helloA.me.uid, /^[a-z0-9]{12}$/);
  assert.notEqual(helloA.me.uid, helloB.me.uid);
  assert.deepEqual(helloA.rooms.map((r) => r.id), ['lobby', 'qc', 'mlip', 'software', 'papers', 'study', 'site']);
  assert.ok(!JSON.stringify([helloA, helloB]).includes('@example.com'), 'no email in what a browser is sent');

  a.send({ t: 'name', name: 'Ada' });
  b.send({ t: 'name', name: '小本' });
  await Promise.all([a.until((f) => f.t === 'ok' && f.re === 'name'), b.until((f) => f.t === 'ok' && f.re === 'name')]);
  for (const x of [a, b, guest]) x.send({ t: 'join', room: 'qc' });
  const roomG = await guest.until((f) => f.t === 'room', 'the room');
  assert.deepEqual([roomG.room, roomG.msgs], ['qc', []]);
  await Promise.all([a.until((f) => f.t === 'room'), b.until((f) => f.t === 'room')]);

  a.send({ t: 'say', room: 'qc', text: 'B3LYP 还是 TPSSh？ <b>not html</b>', cid: 'c1' });
  const mine = await a.until((f) => f.t === 'msg' && f.cid === 'c1', 'my own message');
  const theirs = await b.until((f) => f.t === 'msg', 'the message in the other browser');
  const seen = await guest.until((f) => f.t === 'msg', 'the message for the guest');
  assert.deepEqual([theirs.m.id, theirs.m.name, theirs.m.text, theirs.cid, seen.m.id], [mine.m.id, 'Ada', 'B3LYP 还是 TPSSh？ <b>not html</b>', undefined, mine.m.id]);

  b.send({ t: 'say', room: 'qc', text: 'TPSSh', reply: mine.m.id, cid: 'c2' });
  const answer = await a.until((f) => f.t === 'msg' && f.m.name === '小本', 'the reply');
  assert.deepEqual(answer.m.reply, { id: mine.m.id, name: 'Ada', text: 'B3LYP 还是 TPSSh？ <b>not html</b>' });

  guest.send({ t: 'say', room: 'qc', text: 'let me in', cid: 'g1' });
  assert.equal((await guest.until((f) => f.t === 'err' && f.cid === 'g1', 'the refusal')).code, 'signin');

  // storage.sql and transactionSync: a delete blanks the row and everybody is told
  a.send({ t: 'del', id: mine.m.id });
  const gone = await b.until((f) => f.t === 'upd' && f.m.id === mine.m.id, 'the deletion');
  assert.deepEqual([gone.m.del, gone.m.text], [1, '']);

  // "ping" is answered by the platform itself (setWebSocketAutoResponse)
  guest.send('ping');
  for (let i = 0; i < 40 && !guest.texts.includes('pong'); i++) await sleep(100);
  assert.ok(guest.texts.includes('pong'), 'ping → pong');

  // the summary is read from the same object over HTTP (cached for 30 s at the edge: ask past the cache)
  await sleep(1700); // one message every 1.5 s per person
  b.send({ t: 'say', room: 'qc', text: '给首页卡片的一句话', cid: 'c3' });
  await b.until((f) => f.t === 'msg' && f.cid === 'c3');
  let sum = null;
  for (let i = 0; i < 80; i++) {
    sum = (await call('GET', '/chat/summary')).data;
    if (sum.latest.length === 2) break;
    await sleep(500);
  }
  assert.deepEqual([sum.online, sum.latest.map((m) => [m.name, m.text])], [3, [['小本', '给首页卡片的一句话'], ['小本', 'TPSSh']]], 'online people and the last messages, without the deleted one');

  // a second connection of the same account is the same person, and the room keeps its history
  a.close();
  const again = await browser(tokenA);
  const helloAgain = await again.until((f) => f.t === 'hello');
  assert.deepEqual([helloAgain.me.uid, helloAgain.me.name], [helloA.me.uid, 'Ada']);
  again.send({ t: 'join', room: 'qc' });
  const back = await again.until((f) => f.t === 'room');
  assert.deepEqual(back.msgs.map((m) => [m.name, m.text, m.del || 0]), [['Ada', '', 1], ['小本', 'TPSSh', 0], ['小本', '给首页卡片的一句话', 0]]);
  for (const x of [again, b, guest]) x.close();
  console.log('ok   chat under workerd: sign-in, WebSocket upgrade through the Worker, rooms, messages, replies, deletion, ping, summary');
} catch (e) {
  failed = true;
  console.error('FAIL chat under workerd\n', e);
  console.error(log.split('\n').slice(-30).join('\n'));
} finally {
  stop();
}
process.exit(failed ? 1 : 0);
