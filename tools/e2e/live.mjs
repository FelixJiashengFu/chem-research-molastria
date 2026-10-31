// Read-only checks against the live site and account service. Sends no mail and writes nothing.
//   node tools/e2e/live.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const SITE = 'https://molastria.com', API = 'https://api.molastria.com';
const REPO = 'FelixJiashengFu/chem-research-molastria';
const bust = `v=${Date.now()}`; // GitHub Pages lets browsers cache files for 10 minutes

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check('account service answers and guards its routes', async () => {
  assert.deepEqual(await (await fetch(`${API}/`)).json(), { ok: true, service: 'molastria-account' });
  assert.equal((await fetch(`${API}/me`)).status, 401);
  assert.equal((await fetch(`${API}/admin/cards`)).status, 401);
});

check('account service allows the site and the desktop app, and nobody else', async () => {
  const preflight = (origin) => fetch(`${API}/auth/start`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
  for (const origin of ['https://molastria.com', 'http://tauri.localhost', 'tauri://localhost']) {
    assert.equal((await preflight(origin)).headers.get('access-control-allow-origin'), origin);
  }
  assert.equal((await preflight('https://example.com')).status, 403);
});

check('desktop update feed matches the latest release', async () => {
  const latest = await (await fetch(`https://github.com/${REPO}/releases/latest/download/latest.json`)).json();
  const release = await (await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })).json();
  assert.equal(`desktop-v${latest.version}`, release.tag_name);
  for (const [platform, entry] of Object.entries(latest.platforms)) assert.ok(entry.signature && entry.url.includes(release.tag_name), `${platform} entry`);
  console.log(`     desktop ${latest.version}`);
});

check('weekly picks: the preview is public and has no comments, the full issue needs an account', async () => {
  const r = await fetch(`${API}/digest/preview`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.items));
  assert.ok(d.items.every((it) => it.title && !it.why_zh && !it.why_en));
  assert.equal((await fetch(`${API}/digest/latest`)).status, 401);
  console.log(`     ${d.week || 'no issue yet'}, ${d.total} papers`);
});

let browser;
async function page(path) {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(`${SITE}${path}${path.includes('?') ? '&' : '?'}${bust}`, { waitUntil: 'networkidle' });
  return p;
}

check('account page offers sign-in, and an invitation link opens VIP mode', async () => {
  const p = await page('/pro/account.html?card=VIP-TEST-TEST-TEST');
  assert.equal(await p.isVisible('#acct-login'), true);
  assert.equal(await p.isVisible('#card-field'), true);
  assert.deepEqual(p.errors, []);
});

check('PreprintRadar opens in its frame', async () => {
  const p = await page('/radar/');
  const f = p.frame({ url: /radar\/app/ });
  await f.waitForSelector('#nav a', { timeout: 20000 });
  assert.deepEqual(p.errors, []);
});

check('search: a Chinese term finds English entries, and the pricing page loads', async () => {
  const p = await page('/index.html?q=' + encodeURIComponent('电解液'));
  await p.waitForSelector('.result-row');
  assert.deepEqual(p.errors, []);
  const pro = await page('/pro/index.html');
  assert.deepEqual(pro.errors, []);
});

check('catalogue page lists its sources, ChemRxiv among them', async () => {
  const p = await page('/hub/');
  await p.waitForSelector('#sourceCards .source-card');
  assert.ok((await p.$$eval('#sourceCards h3', (h) => h.map((x) => x.textContent))).some((t) => /ChemRxiv/.test(t)));
  assert.deepEqual(p.errors, []);
});

let failed = 0;
browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, fn] of checks) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 6).join('\n     ')}`); }
}
await browser.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
