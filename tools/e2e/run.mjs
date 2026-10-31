// End-to-end checks in headless Chrome against local servers: the real pages and the real account worker,
// with Stripe, mail and DeepSeek faked (tools/account-local.ts), so this is free and sends nothing.
//   npm ci --prefix tools/e2e       once
//   node tools/e2e/run.mjs          all checks
//   node tools/e2e/run.mjs vip      only checks whose name contains "vip"
//   node tools/e2e/run.mjs --net    also run a real PreprintRadar search (calls Crossref and DataCite)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE_PORT = 8840, API_PORT = 8842;
const SITE = `http://localhost:${SITE_PORT}`, API = `http://127.0.0.1:${API_PORT}`;
const args = process.argv.slice(2);
const NET = args.includes('--net');
const only = args.find((a) => !a.startsWith('--'));
const HAN = /[㐀-鿿]/;

// ── local servers ───────────────────────────────────────────────────────
const servers = [
  spawn('deno', ['run', '--allow-net', '--allow-read', 'tools/serve.ts', String(SITE_PORT)], { cwd: ROOT, stdio: 'ignore' }),
  spawn('deno', ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-write', 'tools/account-local.ts', String(API_PORT), SITE], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, FAKE_AI: '1' } }),
];
const stopServers = () => servers.forEach((s) => s.kill());
process.on('exit', stopServers);
async function ready(url) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not start`);
}

// ── browser helpers ─────────────────────────────────────────────────────
let browser;
async function open({ init, ...options } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', ...options });
  await ctx.route('**/pay/config.js', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(/accountApi: '[^']*'/, `accountApi: '${API}'`) });
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  return page;
}
const go = (p, path) => p.goto(SITE + path, { waitUntil: 'networkidle' });
const text = (p, sel) => p.textContent(sel);
const finish = async (p) => { assert.deepEqual(p.errors, [], 'page errors'); await p.context().close(); };

/** Signs in on the account page with an emailed code; the local server hands the code to the page. */
async function signIn(p, email) {
  await p.fill('#login-email', email);
  await p.click('#login-btn');
  await p.waitForFunction(() => document.getElementById('login-code').value.length === 6, null, { timeout: 10000 });
  await p.click('#login-btn');
  await p.waitForSelector('#acct-main:not([hidden])');
}

// ── checks ──────────────────────────────────────────────────────────────
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

check('every main page loads without script errors', async () => {
  for (const path of ['/index.html', '/atlas/index.html', '/hub/index.html', '/hub/network.html', '/lab/index.html', '/train/index.html', '/pro/index.html', '/pro/account.html', '/download/index.html', '/radar/index.html']) {
    const p = await open();
    await go(p, path);
    assert.deepEqual(p.errors, [], `errors on ${path}`);
    await p.context().close();
  }
});

check('pricing page shows the hosted quota as available', async () => {
  const p = await open();
  await go(p, '/pro/index.html');
  assert.match(await text(p, '[data-live="hosted"]'), /开通即享/);
  await finish(p);
});

check('paying signs the buyer in', async () => {
  const p = await open();
  await go(p, '/pro/success.html?session_id=cs_test_localpro&plan=pro_year');
  await p.waitForSelector('#activate.ok');
  assert.match(await p.getAttribute('.cr-pro', 'href'), /pro\/account\.html$/);
  await go(p, '/pro/account.html');
  await p.waitForSelector('#acct-main:not([hidden])');
  assert.equal(await text(p, '#plan-badge'), 'Pro');
  await finish(p);
});

check('hosted AI: the quota button switches away from a saved own key, and the meter moves', async () => {
  const p = await open({ init: () => { if (!localStorage.getItem('chemhub-ai')) localStorage.setItem('chemhub-ai', JSON.stringify({ provider: 'deepseek', remember: true, keys: { deepseek: 'sk-own' } })); } });
  const calls = [];
  p.on('request', (r) => { if (/\/ai\/chat|api\.deepseek\.com/.test(r.url()) && r.method() === 'POST') calls.push(r.url()); });
  await go(p, '/pro/success.html?session_id=cs_test_localteam&plan=team_year');
  await p.waitForSelector('#activate.ok');
  await go(p, '/pro/account.html');
  await p.waitForSelector('#acct-main:not([hidden])');
  await p.click('#open-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  assert.deepEqual(await p.evaluate(() => [window.ChemAI.settings().provider, JSON.parse(localStorage.getItem('chemhub-ai')).keys.deepseek]), ['hosted', 'sk-own']);
  await p.fill('#cai-input', '推荐一个分子动力学软件');
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction(() => Number(document.getElementById('quota-used').textContent) >= 1, null, { timeout: 20000 });
  assert.ok(calls.length && calls.every((u) => u.startsWith(API)), `AI calls went to ${calls}`);
  await finish(p);
});

check('email code sign-in and group members', async () => {
  const p = await open();
  await go(p, '/pro/account.html');
  await signIn(p, 'PI@example.com');
  assert.equal(await text(p, '#plan-badge'), '课题组');
  await p.fill('#member-email', 'student@lab.edu');
  await p.click('#member-form button');
  await p.waitForFunction(() => document.getElementById('member-list').textContent.includes('student@lab.edu'));
  await p.click('[data-member="student@lab.edu"]');
  await p.waitForFunction(() => !document.getElementById('member-list').textContent.includes('student@lab.edu'));
  await finish(p);
});

check('an address with no subscription gets the same answer but no code', async () => {
  const p = await open();
  await go(p, '/pro/account.html');
  await p.fill('#login-email', 'nobody@example.com');
  await p.click('#login-btn');
  await p.waitForSelector('#code-field:not([hidden])');
  assert.equal(await p.inputValue('#login-code'), '');
  await finish(p);
});

check('VIP cards: issue, invitation link, stacking, revoke', async () => {
  const admin = await open();
  await go(admin, '/pro/account.html');
  await signIn(admin, 'admin@example.com');
  assert.equal(await text(admin, '#plan-badge'), '站长');
  assert.equal(await admin.isVisible('#admin-card'), true);
  await admin.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__clip = t; return Promise.resolve(); }; });
  await admin.fill('#card-count', '2');
  await admin.selectOption('#card-days', '30');
  await admin.click('#card-form button[type=submit]');
  await admin.waitForSelector('#card-list li.new');
  const codes = await admin.$$eval('#card-list li.new code', (els) => els.map((e) => e.textContent));
  assert.equal(codes.length, 2);
  await admin.click(`[data-copy="${codes[0]}"]`);
  await admin.waitForFunction(() => !!window.__clip);
  const link = /\?card=(VIP-[A-Z0-9-]+)/.exec(await admin.evaluate(() => window.__clip))[1];
  assert.equal(link, codes[0]);

  const friend = await open();
  await go(friend, `/pro/account.html?card=${link}`);
  assert.equal(await friend.inputValue('#login-card'), codes[0]);
  await signIn(friend, 'friend@uni.edu');
  assert.equal(await text(friend, '#plan-badge'), 'VIP');
  assert.equal(await friend.isVisible('#admin-card'), false, 'friend must not see the admin card');
  const first = await text(friend, '#plan-line');
  await friend.fill('#redeem-code', codes[1]);
  await friend.click('#redeem-form button');
  await friend.waitForFunction((before) => document.getElementById('plan-line').textContent !== before, first);
  const stacked = await text(friend, '#plan-line');

  await admin.reload({ waitUntil: 'networkidle' });
  await admin.waitForSelector('#card-list code');
  assert.match(await admin.$eval(`#card-list li:has(code:text("${codes[0]}")) small`, (e) => e.textContent), /friend@uni\.edu/);
  await admin.click(`[data-revoke="${codes[0]}"]`);
  await admin.waitForFunction((c) => [...document.querySelectorAll('#card-list li.off code')].some((e) => e.textContent === c), codes[0]);
  await friend.reload({ waitUntil: 'networkidle' });
  await friend.waitForFunction((was) => { const t = document.getElementById('plan-line').textContent; return t && t !== was; }, stacked);
  assert.equal(await text(friend, '#plan-line'), first, 'revoking takes off only that card');
  await finish(admin);
  await finish(friend);
});

check('AI drawer: drag to resize, width kept, double-click restores', async () => {
  const p = await open();
  await go(p, '/index.html');
  const openDrawer = async () => { await p.click('#cr-ai'); await p.waitForSelector('.cai-drawer[data-open=true]'); await p.waitForTimeout(300); };
  const width = () => p.$eval('.cai-drawer', (e) => e.getBoundingClientRect().width);
  await openDrawer();
  assert.equal(await width(), 460);
  const g = await (await p.$('.cai-grip')).boundingBox();
  await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await p.mouse.down();
  await p.mouse.move(g.x - 200, g.y + g.height / 2, { steps: 8 });
  await p.mouse.up();
  const dragged = await width();
  assert.ok(dragged > 640, `dragged to ${dragged}`);
  await p.reload({ waitUntil: 'networkidle' });
  await openDrawer();
  assert.equal(await width(), dragged);
  await p.dblclick('.cai-grip');
  assert.equal(await width(), 460);
  await finish(p);
  const phone = await open({ viewport: { width: 390, height: 844 } });
  await go(phone, '/index.html');
  await phone.click('#cr-ai');
  await phone.waitForSelector('.cai-drawer[data-open=true]');
  assert.equal(await phone.isVisible('.cai-grip'), false);
  await finish(phone);
});

check('PreprintRadar: loads in its frame and follows the site theme', async () => {
  const p = await open();
  await go(p, '/radar/index.html');
  assert.equal(await p.getAttribute('.cr-links a[data-id=radar]', 'aria-current'), 'page');
  const f = p.frame({ url: /radar\/app\/index\.html/ });
  await f.waitForSelector('#nav a');
  assert.deepEqual(await f.$$eval('#nav a', (a) => a.map((x) => x.textContent.trim())), ['推荐', '搜索', '兴趣主题', '我的收藏', '设置']);
  const light = await f.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.click('#cr-theme');
  await p.waitForFunction(() => document.getElementById('radar-frame').contentDocument.documentElement.dataset.theme === 'dark');
  assert.notEqual(await f.evaluate(() => getComputedStyle(document.body).backgroundColor), light);
  if (NET) {
    await f.click('#nav a:nth-child(2)');
    await f.fill('#sq', 'density functional');
    await f.press('#sq', 'Enter');
    await f.waitForSelector('.paper', { timeout: 45000 });
  }
  await finish(p);
});

check('catalogue: ChemRxiv card, mixed papers section, home search', async () => {
  const p = await open();
  await go(p, '/hub/index.html');
  await p.waitForSelector('#sourceCards .source-card');
  assert.ok((await p.$$eval('#sourceCards h3', (h) => h.map((x) => x.textContent))).some((t) => /ChemRxiv/.test(t)));
  const fresh = await p.$$eval('#freshCards .card', (c) => c.map((x) => (x.textContent.match(/ChemRxiv|arXiv|期刊/) || ['?'])[0]));
  for (const s of ['ChemRxiv', 'arXiv']) assert.ok(fresh.includes(s), `papers section lacks ${s}: ${fresh}`);
  await go(p, '/index.html');
  await p.fill('input[type=search]', 'ChemRxiv machine learning');
  await p.waitForFunction(() => [...document.querySelectorAll('.result-row')].some((r) => /ChemRxiv/.test(r.textContent)), null, { timeout: 8000 });
  await finish(p);
});

check('English: account page and radar are translated, paper-free UI has no Chinese left', async () => {
  const p = await open();
  await go(p, '/pro/account.html?lang=en');
  await p.waitForSelector('#acct-login:not([hidden])');
  await p.waitForFunction(() => !document.documentElement.dataset.i18n);
  const heading = await text(p, '#login-h');
  assert.ok(!HAN.test(heading), `account heading: ${heading}`);
  await go(p, '/radar/index.html?lang=en');
  const f = p.frame({ url: /radar\/app\/index\.html/ });
  await f.waitForSelector('#nav a');
  await f.waitForFunction(() => !document.documentElement.dataset.i18n && !/[㐀-鿿]/.test(document.getElementById('nav').textContent), null, { timeout: 8000 });
  await finish(p);
});

check('phone width: no sideways scrolling', async () => {
  for (const path of ['/index.html', '/pro/index.html', '/pro/account.html', '/hub/index.html', '/radar/index.html']) {
    const p = await open({ viewport: { width: 390, height: 844 } });
    await go(p, path);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `sideways scroll on ${path}`);
    await p.context().close();
  }
});

// ── run ─────────────────────────────────────────────────────────────────
let failed = 0;
try {
  await Promise.all([ready(`${SITE}/index.html`), ready(`${API}/`)]);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, fn] of checks) {
    if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
    try { await fn(); console.log(`ok   ${name}`); }
    catch (e) { failed++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 6).join('\n     ')}`); }
  }
} finally {
  await browser?.close();
  stopServers();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
