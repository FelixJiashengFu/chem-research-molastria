// End-to-end checks in headless Chrome against local servers: the real pages and the real account worker,
// with Stripe, mail and DeepSeek faked (tools/account-local.ts), so this is free and sends nothing.
//   npm ci --prefix tools/e2e       once
//   node tools/e2e/run.mjs          all checks
//   node tools/e2e/run.mjs vip      only checks whose name contains "vip"
//   node tools/e2e/run.mjs --net    also run a real PreprintRadar search (calls Crossref and DataCite)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
// Optional: E2E_UMA_PYTHON=<python with the uma-server dependencies> puts the real tools/uma-server/server.py --fake
// behind the account worker instead of account-local.ts's built-in stand-in (no model weights, toy numbers). A one-time
// key goes to both sides; secret.local is not read. The models checks then test shapes instead of the stand-in's numbers.
const UMA_PY = process.env.E2E_UMA_PYTHON, UMA_PORT = 8844, UMA_KEY = randomBytes(24).toString('hex');
const REAL = !!UMA_PY;
const V = (standIn, real) => (REAL ? real : standIn);
const umaTmp = REAL ? mkdtempSync(join(tmpdir(), 'molastria-e2e-')) : '';
const servers = [
  spawn('deno', ['run', '--allow-net', '--allow-read', 'tools/serve.ts', String(SITE_PORT)], { cwd: ROOT, stdio: 'ignore' }),
  spawn('deno', ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-write', 'tools/account-local.ts', String(API_PORT), SITE], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, FAKE_AI: '1', ...(REAL ? { UMA_ORIGIN: `http://127.0.0.1:${UMA_PORT}`, UMA_SERVER_SECRET: UMA_KEY } : {}) } }),
  ...(REAL ? [spawn(UMA_PY, ['-X', 'utf8', 'tools/uma-server/server.py', '--fake', '--port', String(UMA_PORT), '--cache', join(umaTmp, 'cache.json')], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, MOLASTRIA_UMA_SECRET: UMA_KEY, PYTHONUTF8: '1' } })] : []),
];
const stopServers = () => { servers.forEach((s) => s.kill()); if (umaTmp) rmSync(umaTmp, { recursive: true, force: true }); };
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
  for (const path of ['/index.html', '/atlas/index.html', '/manual/index.html', '/journals/index.html', '/scimodels/index.html', '/videos/index.html', '/hub/index.html', '/hub/network.html', '/lab/index.html', '/meta/index.html', '/models/index.html', '/train/index.html', '/pro/index.html', '/pro/account.html', '/download/index.html', '/about/index.html', '/radar/index.html', '/research-atlas/index.html', '/qchem/index.html', '/digest/index.html']) {
    const p = await open();
    await go(p, path);
    assert.deepEqual(p.errors, [], `errors on ${path}`);
    await p.context().close();
  }
});
check('home page: English title, bilingual description, and square icons Google can use (48 px multiples)', async () => {
  const p = await open();
  await go(p, '/index.html');
  const head = await p.evaluate(() => ({
    title: document.querySelector('title').textContent,
    desc: document.querySelector('meta[name=description]').content,
    icons: [...document.querySelectorAll('link[rel=icon]')].map((l) => ({ href: l.href, sizes: l.getAttribute('sizes') })),
  }));
  assert.match(head.title, /^MolAstria · [A-Za-z ]+$/);
  assert.match(head.desc, /[A-Za-z]{4}/); assert.match(head.desc, HAN);
  for (const href of [...head.icons.map((i) => i.href), `${SITE}/favicon.ico`]) {
    const res = await p.request.get(href);
    assert.equal(res.status(), 200, href);
    if (!href.endsWith('.png')) continue;
    const size = await p.evaluate(async (u) => { const img = new Image(); img.src = u; await img.decode(); return [img.naturalWidth, img.naturalHeight]; }, href);
    assert.equal(size[0] % 48, 0, `${href} is a multiple of 48 px`);
    assert.equal(`${size[0]}x${size[1]}`, head.icons.find((i) => i.href === href).sizes, `${href} sizes attribute`);
  }
  await p.context().close();
});

check('pricing page: content free, three allowances, everything marked available exists', async () => {
  const p = await open();
  await go(p, '/pro/index.html');
  assert.match(await text(p, '[data-live="hosted"]'), /开通即享/);
  // Everything marked as available has to exist; update this list when a feature really ships.
  const live = await p.$$eval('.plan .st.ok', (els) => els.map((e) => e.parentElement.textContent.replace(e.textContent, '').trim()));
  assert.deepEqual(live, ['每周精选完整一期，免费订阅邮件', '在线模型每天 100 次（不登录 40 次），含 ANI-2x', '每天 5 次免配 key 的 AI 问答', 'AI 托管额度：免配 key，每月 300 次带出处问答', '在线模型每天 200 次', '每个席位每月 300 次 AI 托管额度、在线模型每天 200 次', '在账号页添加、移除成员', 'Stripe 收据可用于报销']);
  // The allowance table has to agree with deploy/wrangler.toml.
  const toml = readFileSync(join(ROOT, 'deploy/wrangler.toml'), 'utf8');
  const v = (k) => new RegExp(`^${k} = "(\\d+)"`, 'm').exec(toml)[1];
  const rows = await p.$$eval('#tiers tbody tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent.trim())));
  const row = (label) => rows.find((r) => r[0].startsWith(label)).slice(1).join('|');
  assert.equal(row('AI 托管额度'), `—|每天 ${v('FREE_DAILY_ASKS')} 次|每月 ${v('MONTHLY_ASKS')} 次`);
  assert.equal(row('在线模型：UMA'), `每天 ${v('UMA_DAILY')} 次|每天 ${v('UMA_DAILY_ACCOUNT')} 次|每天 ${v('UMA_DAILY_PRO')} 次`);
  assert.equal(row('在线模型：MACE'), Array(3).fill(`每天 ${v('ASL_DAILY')} 次`).join('|'));
  assert.equal(await p.getAttribute('.plan[data-plan=free] a.btn', 'href'), 'account.html');
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
  assert.equal(await text(p, '#quota-used'), '1', 'a normal question counts once');
  assert.ok(calls.length && calls.every((u) => u.startsWith(API)), `AI calls went to ${calls}`);
  await finish(p);
});

check('hosted AI: a Pro account gets V4 Flash only (a saved V4 Pro falls back to it), and a keyless provider is refused with a reason', async () => {
  const p = await open();
  await go(p, '/pro/success.html?session_id=cs_test_localpro&plan=pro_year');
  await p.waitForSelector('#activate.ok');
  // An account cached before the service listed its models falls back to the service's default: Flash only.
  await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('molastria-account')); delete a.models; localStorage.setItem('molastria-account', JSON.stringify(a)); });
  // a setting saved back when V4 Pro was offered
  await p.evaluate(() => localStorage.setItem('chemhub-ai', JSON.stringify({ provider: 'hosted', remember: true, models: { hosted: 'deepseek-v4-pro' } })));
  await go(p, '/index.html');
  await p.evaluate(() => window.ChemHub.loadAI().then((ai) => ai.openSettings()));
  await p.waitForSelector('.cai-prov input[value=hosted]');
  await p.check('.cai-prov input[value=hosted]', { force: true });
  assert.deepEqual(await p.$$eval('select[name=model] option', (o) => o.map((x) => x.value)), ['deepseek-flash']);
  await p.click('[data-act=save]');
  assert.deepEqual(await p.evaluate(() => { const s = window.ChemAI.settings(); return [s.provider, s.models.hosted]; }), ['hosted', 'deepseek-flash']);
  // DeepSeek without a key: the dialog stays open and explains, instead of silently going back to the quota.
  await p.evaluate(() => window.ChemAI.openSettings());
  await p.check('.cai-prov input[value=deepseek]', { force: true });
  await p.click('[data-act=save]');
  assert.match(await text(p, '.cai-status'), /要用你自己的 API key/);
  assert.equal(await p.evaluate(() => document.querySelector('dialog.cai-settings, dialog[aria-labelledby=cai-settings-title]').open), true);
  await finish(p);
});

check('weekly picks: the admin builds an issue, Pro reads and subscribes, visitors see the picks with comments', async () => {
  const admin = await open();
  await go(admin, '/pro/account.html');
  await signIn(admin, 'admin@example.com');
  await admin.waitForSelector('#digest-empty:not([hidden])');
  await admin.click('#digest-build');
  await admin.waitForSelector('#digest-list li');
  assert.equal(await admin.$$eval('#digest-list li', (l) => l.length), 3);
  assert.match(await text(admin, '#digest-list li:first-child p'), /解读 0/);
  await admin.click('#digest-toggle');
  await admin.waitForFunction(() => document.getElementById('digest-toggle').textContent === '退订邮件');
  await admin.reload({ waitUntil: 'networkidle' });
  await admin.waitForFunction(() => document.getElementById('digest-toggle').textContent === '退订邮件');
  await admin.click('#digest-toggle');
  await admin.waitForFunction(() => document.getElementById('digest-toggle').textContent === '订阅邮件');
  await finish(admin);

  const visitor = await open();
  await go(visitor, '/pro/index.html');
  await visitor.waitForSelector('#digest-preview:not([hidden]) li');
  assert.equal(await visitor.$$eval('#digest-preview li p', (l) => l.length), 3, 'visitors see each pick with its comment (this issue has three)');
  await finish(visitor);

  const english = await open();
  await go(english, '/pro/success.html?session_id=cs_test_localpro&plan=pro_year&lang=en');
  await english.waitForSelector('#activate.ok');
  await go(english, '/pro/account.html?lang=en');
  await english.waitForSelector('#digest-list li');
  assert.match(await text(english, '#digest-list li:first-child p'), /Why 0/);
  assert.match(await text(english, '#digest-overview'), /This week/);
  assert.equal(await text(english, '#digest-toggle'), 'Subscribe by email');
  await finish(english);
});

check('search: Chinese finds English entries, and few results offer a next step', async () => {
  const p = await open();
  await go(p, '/index.html');
  await p.fill('input[type=search]', '电解液');
  await p.waitForFunction(() => document.querySelectorAll('.result-row').length > 0);
  assert.ok((await p.$$eval('.result-row h3', (h) => h.map((x) => x.textContent))).some((t) => /electrolyte/i.test(t)), 'an electrolyte paper');
  await p.fill('input[type=search]', 'zzqqxxyy');
  await p.waitForSelector('#empty:not([hidden])');
  assert.equal(await p.isVisible('#search-next'), true);
  assert.match(await p.getAttribute('#next-radar', 'href'), /radar\/index\.html\?q=zzqqxxyy/);
  await p.click('#next-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  assert.equal(await p.inputValue('#cai-input'), 'zzqqxxyy');
  await finish(p);
  const many = await open();
  await go(many, '/index.html?q=Multiwfn');
  await many.waitForSelector('.result-row');
  assert.equal(await many.isVisible('#search-next'), false, 'plenty of results: no panel');
  await finish(many);
  const radar = await open();
  await go(radar, '/radar/index.html?q=lithium%20electrolyte');
  const f = radar.frame({ url: /radar\/app\/index\.html/ });
  await f.waitForSelector('#sq');
  await f.waitForFunction(() => document.getElementById('sq').value === 'lithium electrolyte');
  await finish(radar);
});

check('hosted AI: a long conversation sends less history and still counts once', async () => {
  const p = await open();
  const sent = [];
  p.on('request', (r) => { if (r.url().endsWith('/ai/chat') && r.method() === 'POST') sent.push(JSON.parse(r.postData()).messages); });
  await go(p, '/pro/account.html');
  await signIn(p, 'admin@example.com');
  await p.click('#open-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  const before = Number(await text(p, '#quota-used'));
  await p.evaluate(() => window.ChemAI.chat({ provider: 'hosted', maxTokens: 4096, messages: [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'old question' }, { role: 'assistant', content: 'x'.repeat(9000) },
    { role: 'user', content: 'newer question' }, { role: 'assistant', content: 'y'.repeat(9000) },
    { role: 'user', content: 'newest question' },
  ] }));
  await p.waitForFunction((n) => Number(document.getElementById('quota-used').textContent) > n, before);
  assert.equal(Number(await text(p, '#quota-used')), before + 1);
  const [messages] = sent;
  assert.equal(messages[0].content, 'system prompt');
  assert.equal(messages.at(-1).content, 'newest question');
  assert.ok(messages.reduce((n, m) => n + m.content.length, 0) <= 12000, 'history trimmed');
  assert.ok(messages.some((m) => m.content.startsWith('y')), 'the most recent answer is kept');
  await finish(p);
});

check('Pro pages: no serious accessibility problems in light or dark', async () => {
  const problems = [];
  for (const colorScheme of ['light', 'dark']) {
    const p = await open({ colorScheme });
    const scan = async (name) => {
      await p.waitForTimeout(400); // colour transitions finish
      await p.addScriptTag({ path: fileURLToPath(new URL('./node_modules/axe-core/axe.min.js', import.meta.url)) });
      const found = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target[0]} ${n.any[0]?.data?.contrastRatio ?? ''} ${n.any[0]?.data?.fgColor ?? ''} on ${n.any[0]?.data?.bgColor ?? ''}`)));
      problems.push(...found.map((f) => `${colorScheme} ${name}: ${f}`));
    };
    await go(p, '/pro/index.html');
    await scan('pricing');
    await go(p, '/pro/account.html');
    await scan('sign-in');
    await signIn(p, 'admin@example.com');
    await p.waitForSelector('#card-list li');
    await scan('account');
    await p.context().close();
  }
  assert.deepEqual(problems, []);
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

check('an address with no subscription signs in as a free account: digest, a daily AI allowance and the hosted provider', async () => {
  const p = await open();
  await go(p, '/pro/account.html');
  await signIn(p, 'nobody@example.com');
  assert.equal(await text(p, '#plan-badge'), '免费');
  assert.equal(await p.isVisible('#lapsed-card'), true);
  assert.equal(await p.isVisible('#digest-card'), true, 'weekly picks for every account');
  assert.equal(await p.isVisible('#quota-card'), true);
  assert.equal(await text(p, '#quota-limit'), '5');
  assert.match(await text(p, '#quota-reset'), /24 小时/);
  await p.click('#open-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  assert.equal(await p.evaluate(() => window.ChemAI.settings().provider), 'hosted');
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

check('research atlas: the copied site loads in its frame, follows the theme, mirrors its page in the address and opens other sites outside', async () => {
  const p = await open();
  await go(p, '/research-atlas/index.html#/cn-top20/');
  assert.equal(await p.getAttribute('.cr-links a[data-id=research]', 'aria-current'), 'page');
  const f = p.frame({ url: /research-atlas\/app\/cn-top20\// });
  await f.waitForSelector('.rank-tbl tbody tr');
  assert.equal(await f.$$eval('.rank-tbl tbody tr', (r) => r.length), 20);
  assert.equal(await f.evaluate(() => document.documentElement.dataset.embed), '1', 'the atlas knows it is embedded');
  assert.equal(await f.locator('.ra-theme').count(), 0, 'no second light/dark switch inside');
  await p.click('#cr-theme');
  await p.waitForFunction(() => document.getElementById('atlas-frame').contentDocument.documentElement.dataset.theme === 'dark');
  await f.click('.rank-tbl tbody tr');
  await p.waitForFunction(() => /^#\/cn-top20\/#A\d+$/.test(location.hash));
  await f.click('.ra-pill[data-key=schools]');
  await f.waitForSelector('.ra-pop:not([hidden]) .ra-sch li');
  assert.equal(await f.$$eval('.ra-pop .ra-sch li', (l) => l.length), 20, 'the school list');
  await p.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await f.evaluate(() => { const a = document.createElement('a'); a.href = 'https://openalex.org/'; a.textContent = 'x'; document.body.append(a); a.click(); });
  assert.deepEqual(await p.evaluate(() => window.__opened), ['https://openalex.org/'], 'other sites open outside the frame');
  assert.match(f.url(), /research-atlas\/app\//, 'the frame stayed on the atlas');
  // The typeface from the display panel reaches the atlas, also after a link inside the frame.
  await p.evaluate(() => { document.documentElement.dataset.font = 'serif'; });
  await p.waitForFunction(() => document.getElementById('atlas-frame').contentDocument.documentElement.dataset.raFont === 'serif');
  await Promise.all([p.waitForEvent('framenavigated', { predicate: (fr) => /schools\/mit\/$/.test(fr.url()) }), f.evaluate(() => { location.href = '../schools/mit/'; })]);
  const mit = p.frame({ url: /research-atlas\/app\/schools\/mit\// });
  await mit.waitForSelector('h1');
  assert.equal(await mit.evaluate(() => document.documentElement.dataset.raFont), 'serif', 'the typeface survives a link inside the frame');
  await finish(p);
  // In English the atlas is translated by the site's own i18n.js with the atlas dictionary.
  const e = await open();
  await go(e, '/research-atlas/index.html?lang=en#/');
  const ef = e.frame({ url: /research-atlas\/app\// });
  await ef.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.dataset.i18n);
  assert.match(await ef.textContent('.hero h1, h1'), /Research Atlas/);
  const left = await ef.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), out = []; for (let n = w.nextNode(); n; n = w.nextNode()) if (/[\u3400-\u9fff]/.test(n.nodeValue) && !n.parentElement.closest('script,style')) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(left, [], 'no Chinese left on the English home page');
  await finish(e);
});

check('PreprintRadar in the desktop app: notifications reach the system through the app, not the WebView', async () => {
  // macOS's WKWebView has no Notification API, so the frame starts without one; desktop/src-tauri/src/notify.rs
  // runs in every frame and sends notifications to the app, which is faked here (top window only, as in the app).
  const NOTIFY = readFileSync(new URL('../../desktop/src-tauri/src/notify.rs', import.meta.url), 'utf8').match(/r#"([\s\S]*?)"#;/)[1];
  const p = await open({ init: () => {
    try { delete window.Notification; } catch { /* keep going */ }
    if (window !== window.top) return;
    window.__MOLASTRIA_DESKTOP__ = true;
    window.__calls = [];
    window.__TAURI_INTERNALS__ = { invoke: async (cmd, a) => {
      window.__calls.push([cmd, a]);
      if (cmd === 'plugin:notification|is_permission_granted') return true;
      if (cmd === 'plugin:notification|request_permission') return 'granted';
      return null;
    } };
  } });
  await p.context().addInitScript({ content: NOTIFY });
  await go(p, '/radar/index.html');
  const f = p.frame({ url: /radar\/app\/index\.html/ });
  await f.waitForSelector('#nav a');
  await f.evaluate(() => { location.hash = '#/settings'; });
  await f.click('[data-act=notify-test]');
  await f.waitForFunction(() => document.body.innerText.includes('已发送测试通知'));
  const sent = await p.evaluate(() => window.__calls.filter(([c]) => c === 'plugin:notification|notify').map(([, a]) => a.options));
  assert.deepEqual(sent, [{ title: '预印本雷达：测试通知', body: '页面开着时，自动推荐有新文章会这样提醒你。' }]);
  assert.equal(await f.evaluate(() => Notification.permission), 'granted');
  await finish(p);
});

check('desktop app on macOS: the handbook\'s print button opens the system print dialog through the app', async () => {
  // WKWebView ignores window.print(); the app's start-up script (desktop/src-tauri/src/main.rs) hands it to print_page.
  const INIT = readFileSync(new URL('../../desktop/src-tauri/src/main.rs', import.meta.url), 'utf8').match(/const INIT_SCRIPT: &str = r#"([\s\S]*?)"#;/)[1];
  const p = await open({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    init: () => {
      if (window !== window.top) return;
      window.__calls = [];
      window.__TAURI_INTERNALS__ = { invoke: async (cmd, a) => { window.__calls.push([cmd, a]); return null; } };
    },
  });
  await p.context().addInitScript({ content: INIT });
  await go(p, '/manual/index.html');
  await p.click('#print-guide');
  assert.ok((await p.evaluate(() => window.__calls.map(([c]) => c))).includes('print_page'), 'print went to the app');
  await finish(p);
});

check('playground calculator (QChem Web): loads in its frame, computes a quantum dot, and follows the site language', async () => {
  const p = await open();
  await go(p, '/qchem/index.html#qd'); // a hash the playground does not know goes to the calculator
  assert.equal(await p.getAttribute('.cr-links a[data-id=qchem]', 'aria-current'), 'page');
  assert.equal(await p.getAttribute('#play-tabs a[data-view=lab]', 'aria-current'), 'page');
  const f = p.frame({ url: /qchem\/app\/index\.html/ });
  await f.waitForSelector('#tabs button');
  assert.deepEqual(await f.$$eval('#tabs button', (b) => b.map((x) => x.textContent.trim())), ['电子结构', '量子计算', '量子点', '对拍与说明']);
  // embed=1 hides the frame's own language switch; the site's switch is the only one.
  assert.equal(await f.isVisible('#langBtn'), false);
  await f.waitForFunction(() => /eV/.test(document.getElementById('qdCards').textContent), null, { timeout: 10000 });
  await go(p, '/qchem/index.html?lang=en#qd');
  const en = p.frame({ url: /qchem\/app\/index\.html\?embed=1&lang=en/ });
  await en.waitForFunction(() => /eV/.test(document.getElementById('qdCards').textContent), null, { timeout: 10000 });
  const left = await en.evaluate(() => (document.getElementById('tabs').innerText + document.getElementById('view-qd').innerText).match(/[^\n]*[㐀-鿿][^\n]*/g));
  assert.equal(left, null, `Chinese left in the English frame: ${left}`);
  await finish(p);
});

check('playground: overview, then each game plays by its rules (configuration, spectrum, tunnelling, orbitals, rings, box)', async () => {
  const p = await open();
  await go(p, '/qchem/index.html');
  assert.equal((await text(p, '.cr-links a[data-id=qchem]')).trim().startsWith('游乐场'), true, 'nav label');
  assert.equal(await p.locator('.play-card').count(), 7);
  assert.equal(await p.getAttribute('#qchem-frame', 'src'), null, 'the calculator loads only when its tab opens');
  // electron configuration: lithium, built by hand, then a Hund's-rule mistake on nitrogen
  await p.click('#play-tabs a[data-view=config]');
  await p.waitForSelector('.cfg-row');
  const place = async (Z, boxes) => {
    while (Number(await p.$eval('#cfg-el sub', (e) => e.textContent)) !== Z) await p.click('#cfg-new');
    for (const [sub, counts] of Object.entries(boxes)) for (const [i, n] of counts.entries()) for (let k = 0; k < n; k++) await p.click(`.cfg-row[data-s="${sub}"] .cfg-box >> nth=${i}`);
    await p.click('#cfg-check');
    return p.$eval('#cfg-msg', (e) => [e.dataset.tone, e.textContent]);
  };
  let [tone, msg] = await place(3, { '1s': [2], '2s': [1] });
  assert.equal(tone, 'ok', msg);
  [tone, msg] = await place(7, { '1s': [2], '2s': [2], '2p': [2, 1] });
  assert.equal(tone, 'bad'); assert.match(msg, /洪特/);
  // hydrogen spectrum: find the transition for the target line
  await p.click('#play-tabs a[data-view=lines]');
  await p.waitForSelector('#ln-task:not(:empty)'); // tabs switch on hashchange, after the click returns
  const lam = Number((await text(p, '#ln-task')).match(/λ = ([\d.]+)/)[1]);
  const [nu, nl] = await p.evaluate((l) => { const P = window.MOLASTRIA_PLAY; for (let a = 1; a <= 3; a++) for (let b = a + 1; b <= 7; b++) if (Math.abs(P.lineNm(b, a) - l) < 0.01) return [b, a]; }, lam);
  await p.click(`#ln-up button[data-n="${nu}"]`); await p.click(`#ln-low button[data-n="${nl}"]`); await p.click('#ln-emit');
  assert.equal(await p.$eval('#ln-msg', (e) => e.dataset.tone), 'ok');
  assert.match(await text(p, '[data-score=lines]'), /连续答对 1/);
  // tunnelling level 1: a 0.50 nm barrier lets about 10 % through
  await p.click('#play-tabs a[data-view=tunnel]');
  await p.click('#tun-missions button >> nth=0');
  assert.equal(await p.isDisabled('#tun-e'), true, 'level 1 locks the energy');
  await p.$eval('#tun-a', (r) => { r.value = '0.5'; r.dispatchEvent(new Event('input')); });
  assert.match(await text(p, '#tun-msg'), /过关/);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-play')).tunnel[0]), 0, 'progress saved');
  await p.click('#tun-fire');
  await p.waitForFunction(() => /穿过 \d+ 个，弹回 \d+ 个/.test(document.getElementById('tun-msg').textContent), null, { timeout: 8000 });
  // orbitals and rings: answer once each, the answer is marked
  await p.click('#play-tabs a[data-view=orbital]');
  await p.click('#orb-choices .play-choice >> nth=0');
  assert.equal(await p.locator('#orb-choices [data-mark=right]').count(), 1);
  await p.click('#play-tabs a[data-view=ring]');
  await p.click('#ring-choices .play-choice >> nth=0');
  assert.equal(await p.locator('#ring-choices [data-mark=right]').count(), 1);
  assert.match(await text(p, '#ring-read'), /离域能/);
  // particle in a box: tuning the sliders to the target wins
  await p.click('#play-tabs a[data-view=box]');
  await p.click('#box-hint');
  const target = Number((await text(p, '#box-target-v')).match(/\d+/)[0]);
  await p.evaluate((t) => { const P = window.MOLASTRIA_PLAY, n = document.getElementById('box-n'), l = document.getElementById('box-l'); n.value = '8'; l.value = P.boxLengthFor(t, 8).toFixed(2); l.dispatchEvent(new Event('input')); }, target);
  assert.equal(await p.$eval('#box-msg', (e) => e.dataset.tone), 'ok');
  // the overview shows saved progress; the calculator tab loads the frame on first open
  await p.click('#play-tabs a[data-view=home]');
  assert.match(await text(p, '[data-best=tunnel]'), /已过 1 \/ 4 关/);
  await p.click('#play-tabs a[data-view=lab]');
  await p.waitForSelector('#play-lab:not([hidden])');
  assert.match(await p.getAttribute('#qchem-frame', 'src'), /app\/index\.html\?embed=1&lang=zh/);
  await finish(p);
});

check('playground in English: games and canvas labels are translated, no Chinese left', async () => {
  const p = await open();
  for (const v of ['', '#play-box', '#play-config', '#play-tunnel', '#play-ring', '#play-lines', '#play-orbital']) {
    await go(p, '/qchem/index.html?lang=en' + v);
    await p.waitForFunction(() => !document.documentElement.dataset.i18n);
    const left = await p.evaluate(() => [...document.querySelectorAll('main .play-view:not([hidden]), #play-tabs')].map((e) => e.innerText).join('\n').match(/[^\n]*[㐀-鿿][^\n]*/g));
    assert.equal(left, null, `${v || 'overview'}: Chinese left: ${left}`);
  }
  assert.equal(await p.evaluate(() => window.ChemI18n.t('能量 (eV)')), 'Energy (eV)', 'canvas text goes through the dictionary');
  await finish(p);
});

check('embedded apps follow the display scale: the frame cancels the page zoom and is scaled so the app gets the narrower viewport', async () => {
  const p = await open({ viewport: { width: 1000, height: 800 }, init: () => { try { localStorage.setItem('molastria-zoom', '1.25'); localStorage.setItem('molastria-text', '1.2'); } catch {} } });
  for (const path of ['/radar/index.html', '/qchem/index.html#lab', '/research-atlas/index.html']) {
    await go(p, path);
    const el = await p.waitForSelector('iframe[data-display-frame]');
    const f = await el.contentFrame();
    await f.waitForLoadState('load');
    const box = await el.boundingBox(), inner = await f.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth }));
    assert.ok(Math.abs(box.x + box.width - 1000) <= 2, `${path}: the frame spans the window (${box.x + box.width})`);
    assert.ok(Math.abs(inner.w - Math.round(1000 / 1.5)) <= 3, `${path}: the app lays out at window ÷ 1.5 (${inner.w})`);
    assert.ok(inner.sw <= inner.w + 1, `${path}: no sideways scroll inside the app`);
    assert.ok(box.y + box.height <= 801, `${path}: the frame ends at the bottom of the window (${box.y + box.height})`);
  }
  await finish(p);
});

check('Meta page: Muse reads a sample image, RDKit checks it, and the UMA script follows', async () => {
  // A saved Muse key and a faked Meta Model API reply: one valid and one broken SMILES.
  const p = await open({ init: () => { try { localStorage.setItem('chemhub-ai', JSON.stringify({ provider: 'muse', remember: true, keys: { muse: 'test-key' } })); } catch {} } });
  let sent = null;
  await p.context().route('https://api.meta.ai/**', async (route) => {
    sent = route.request().postDataJSON();
    const content = JSON.stringify({ molecules: [{ name: 'vinylene carbonate', smiles: 'O=C1OC=CO1', confidence: 0.95, note: '' }, { name: 'broken', smiles: 'C1CC(', confidence: 0.2, note: 'cropped' }] });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'muse-spark-1.3', choices: [{ message: { content } }], usage: { prompt_tokens: 1200, completion_tokens: 80 } }) });
  });
  await p.context().route('https://api.github.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ name: 'fairchem-core-9.9.9', html_url: 'https://github.com/facebookresearch/fairchem/releases/tag/x', published_at: '2026-10-27T00:00:00Z' }]) }));
  await p.context().route('https://huggingface.co/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lastModified: '2026-10-27T14:58:57.000Z' }) }));
  await go(p, '/meta/index.html');
  assert.equal(await p.getAttribute('.cr-links a[data-id=meta]', 'aria-current'), 'page');
  // The generator fills in once RDKit has loaded: FEC, IP / EA with the UMA-M single points.
  await p.waitForFunction(() => /C3H3FO3/.test(document.getElementById('u-check').textContent), null, { timeout: 30000 });
  let code = await text(p, '#u-code');
  for (const s of ['get_predict_unit(MODEL', 'task_name="omol"', '"ip_uma_s"', 'uma-m-1p1', 'CATION_SPIN, ANION_SPIN = 2, 2']) assert.ok(code.includes(s), `script lacks ${s}`);
  await p.selectOption('#u-job', 'md');
  code = await text(p, '#u-code');
  assert.ok(code.includes('Langevin(') && !code.includes('csv'), 'md script');
  assert.equal(await p.isVisible('#u-m-wrap'), false);
  // A radical: one unpaired electron gives a doublet by default.
  await p.fill('#u-smiles', 'C[CH2]');
  await p.waitForFunction(() => document.getElementById('u-spin').value === '2');
  assert.equal(await p.getAttribute('#u-check', 'data-bad'), 'false');
  await p.fill('#u-spin', '1');
  await p.dispatchEvent('#u-spin', 'input');
  assert.equal(await p.getAttribute('#u-check', 'data-bad'), 'true');
  // Vision: the sample image goes to Muse as an image part; the broken SMILES is flagged, not trusted.
  await p.click('#v-sample');
  await p.waitForSelector('#v-drop img');
  await p.click('#v-run');
  await p.waitForSelector('.mx-mol');
  assert.equal(sent.model, 'muse-spark-1.3');
  assert.ok(sent.messages[1].content.some((c) => c.type === 'image_url' && /^data:image\/(png|jpeg);base64,/.test(c.image_url.url)), 'image part');
  const tags = await p.$$eval('.mx-mol .tag:first-child', (t) => t.map((x) => x.className));
  assert.deepEqual(tags, ['tag ok', 'tag bad']);
  await p.click('.mx-mol [data-act=uma]');
  assert.equal(await p.inputValue('#u-name'), ''); // a name with spaces is not used as a file name
  await p.waitForFunction(() => /C3H2O3/.test(document.getElementById('u-check').textContent));
  // Catalogue filter and the live release list.
  await p.click('.mx-filter button[data-kind=data]');
  assert.ok(await p.$$eval('#o-grid .mx-item:not([hidden])', (a) => a.length >= 10 && a.every((x) => x.dataset.kind === 'data')));
  await p.fill('#o-q', 'OPoly26');
  assert.equal(await p.$$eval('#o-grid .mx-item:not([hidden])', (a) => a.length), 1);
  await p.waitForFunction(() => /fairchem-core-9\.9\.9/.test(document.getElementById('live-list').textContent));
  await finish(p);
});

check('Meta page in the desktop app: checks Python, runs UMA locally, imports into the AI Lab', async () => {
  // The desktop commands are faked; desktop/src-tauri has the real ones (cargo test covers their input checks).
  const p = await open({ init: () => {
    const env = { python: '3.12.10', executable: 'C:\\envs\\uma\\Scripts\\python.exe', torch: '2.13.0+cu126', cuda: true, gpu: 'NVIDIA GeForce RTX 2080', fairchem: '2.25.0', rdkit: '2026.03.1', hf_login: false, uma_access: null };
    let polls = 0;
    const lines = ['@@STEP Loading uma-s-1p2p1 on cuda', 'neutral: charge +0, multiplicity 1, 12 steps, E = -10.0 eV', 'Downloading 10%', '@@RESULT {"job":"ipea","model":"uma-s-1p2p1","row":{"smiles":"O=C1OCC(F)O1","name":"FEC","ip_uma_s":10.9,"ea_uma_s":-0.31,"ip_uma_m":10.8,"ea_uma_m":-0.29},"files":["uma_results.csv"]}'];
    window.__MOLASTRIA_DESKTOP__ = true;
    window.__fake = { env, started: null };
    window.__TAURI_INTERNALS__ = { invoke: async (cmd, a) => {
      if (cmd === 'uma_find') return [{ python: env.python, executable: env.executable, has_fairchem: true, has_torch: true, has_rdkit: true }];
      if (cmd === 'uma_inspect') return { ...window.__fake.env };
      if (cmd === 'uma_start') { window.__fake.started = a; polls = 0; return 'C:\\runs\\1'; }
      if (cmd === 'uma_poll') {
        if (!window.__fake.started) return { from: 0, lines: [], running: false, exit: null, dir: null };
        polls++;
        const n = Math.min(lines.length, polls);
        return { from: Math.max(0, a.since - 1), lines: lines.slice(Math.max(0, a.since - 1), n), running: n < lines.length, exit: n < lines.length ? null : 0, dir: 'C:\\runs\\1' };
      }
      return null;
    } };
  } });
  await go(p, '/meta/index.html');
  await p.waitForSelector('#u-local:not([hidden])');
  assert.equal(await p.isVisible('#u-desk-note'), false);
  await p.waitForFunction(() => /没有登录 Hugging Face/.test(document.getElementById('u-env').textContent));
  assert.ok(await p.isDisabled('#u-run'));
  assert.ok((await text(p, '#u-help')).includes('& "C:\\envs\\uma\\Scripts\\python.exe" -c "from huggingface_hub import login; login()"'));
  // Logged in with access: the run starts with the generator's parameters and ends in a result card.
  await p.evaluate(() => { Object.assign(window.__fake.env, { hf_login: true, uma_access: true }); });
  await p.waitForFunction(() => /C3H3FO3/.test(document.getElementById('u-check').textContent), null, { timeout: 30000 });
  await p.click('#u-recheck');
  await p.waitForFunction(() => !document.getElementById('u-run').disabled);
  await p.click('#u-run');
  await p.waitForSelector('.mx-res');
  const started = await p.evaluate(() => window.__fake.started);
  assert.equal(started.python, 'C:\\envs\\uma\\Scripts\\python.exe');
  assert.deepEqual(started.params, { smiles: 'O=C1OCC(F)O1', name: 'FEC', job: 'ipea', model: 'uma-s-1p2p1', device: 'auto', charge: 0, spin: 1, with_m: true });
  const log = await text(p, '#u-log');
  assert.ok(log.includes('▸ Loading uma-s-1p2p1') && !log.includes('@@RESULT'), log);
  assert.ok((await text(p, '.mx-res')).includes('10.900'));
  await p.click('.mx-res [data-act=lab]');
  await p.waitForURL(/lab\/index\.html/);
  // FEC is one of the lab's seed solvents, so the result updates it instead of adding a molecule.
  await p.waitForFunction(() => /更新 1 个分子/.test(document.getElementById('import-msg')?.textContent || ''), null, { timeout: 30000 });
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-lab-import')), null);
  await finish(p);
});

check('MACE-OFF23: the Meta page writes a mace-torch script for neutral jobs, and the AI Lab reads its cross-check', async () => {
  const p = await open();
  await go(p, '/meta/index.html#uma');
  await p.waitForFunction(() => /C3H3FO3/.test(document.getElementById('u-check').textContent), null, { timeout: 30000 });
  await p.selectOption('#u-model', 'mace-off23-medium');
  assert.equal(await p.inputValue('#u-job'), 'opt');
  assert.equal(await p.evaluate(() => document.querySelector('#u-job option[value=ipea]').disabled), true);
  const code = await text(p, '#u-code');
  assert.match(code, /from mace\.calculators import mace_off/);
  assert.doesNotMatch(code, /from fairchem|FAIRChemCalculator/);
  assert.equal(await text(p, '#u-file'), 'mace_FEC_opt.py');
  await p.fill('#u-smiles', 'B(OC)(OC)OC');
  await p.waitForFunction(() => /MACE-OFF23 不认识 B/.test(document.getElementById('u-check').textContent));
  await p.selectOption('#u-model', 'uma-s-1p2p1');
  assert.equal(await p.evaluate(() => document.querySelector('#u-job option[value=ipea]').disabled), false);
  // A cloud-batch result where MACE-OFF23 relaxes FEC far from the UMA geometry.
  await go(p, '/lab/index.html');
  await p.click('[data-tab=results]');
  await p.fill('#paste-results', 'smiles,name,ip_uma_s,ea_uma_s,ip_uma_m,ea_uma_m,mace_rmsd,mace_erelax\nO=C1OCC(F)O1,FEC,10.9,-0.4,10.95,-0.38,0.71,0.55');
  await p.click('#apply-paste');
  await p.waitForFunction(() => /更新 1 个分子/.test(document.getElementById('import-msg')?.textContent || ''), null, { timeout: 30000 });
  await p.click('[data-tab=reliability]');
  await p.waitForFunction(() => document.getElementById('tab-reliability').textContent.includes('UMA 与 MACE-OFF23 不一致'), null, { timeout: 10000 });
  await finish(p);
});

check('AI Lab demo data: the long note can be closed, the status row still says the numbers are synthetic and reopens it', async () => {
  const p = await open();
  await go(p, '/lab/index.html');
  await p.click('#load-demo');
  await p.waitForSelector('#demo-banner:not([hidden])', { timeout: 30000 });
  await p.click('#demo-close');
  assert.equal(await p.isHidden('#demo-banner'), true);
  assert.match(await text(p, '#bench-status [data-demo-note]'), /合成演示数据/);
  await go(p, '/lab/index.html'); // remembered in this browser
  await p.waitForSelector('#bench-status [data-demo-note]', { timeout: 30000 });
  assert.equal(await p.isHidden('#demo-banner'), true);
  await p.click('#bench-status [data-demo-note]');
  assert.equal(await p.isVisible('#demo-banner'), true);
  await finish(p);
});

// ── models page (public/models/): the online model API v3 through the account service and the fake computer ──
const MODEL_WINDOWS = {
  charged: { models: ['uma-s-1p2p1', 'uma-s-1p2', 'uma-s-1p2p1-ft-d4rev', 'allscaip-md-conserving-all-omol', 'allscaip-md-direct-all-omol'], jobs: ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn', 'ipea', 'spin', 'bde', 'pa'] },
  neutral: { models: ['uma-s-1p1', 'esen-sm-conserving-all-omol', 'esen-sm-direct-all-omol', 'esen-md-direct-all-omol', 'mace-omol-0'], jobs: ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn'] },
  organic: { models: ['mace-off23-small', 'mace-off23-medium', 'mace-off23-large', 'ani-2x'], jobs: ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn'] },
  props: { models: ['mace-mdp'], jobs: ['polar', 'ir'] },
};
/** Opens the models page once the fake computer is online and RDKit has checked the sample SMILES; records each job sent. */
async function openModels(win = '', { health, ...options } = {}) {
  const p = await open(options);
  p.posts = [];
  p.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/uma/jobs')) p.posts.push(JSON.parse(r.postData() || '{}')); });
  if (health) await p.route(`${API}/uma/health`, async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, json: health(await res.json()) }); });
  await go(p, `/models/index.html${win ? `#${win}` : ''}`);
  await p.waitForFunction((re) => new RegExp(re).test(document.getElementById('m-status').textContent), V('在线 · \\d+ 个模型 · Test GPU', '在线 · \\d+ 个模型'), { timeout: 30000 });
  await p.waitForFunction(() => /C3H3FO3/.test(document.getElementById('m-check').textContent), null, { timeout: 30000 });
  return p;
}
const runOff = (p) => p.isDisabled('#m-run');
async function runJob(p, job, setup) {
  await p.selectOption('#m-job', job);
  if (setup) await setup();
  try { await p.waitForFunction(() => !document.getElementById('m-run').disabled, null, { timeout: 5000 }); }
  catch { throw new Error(`${job}: the run button stays off: ${await text(p, '#m-why')}`); }
  await p.click('#m-run');
  await p.waitForSelector('#m-result :is(.md-res, .md-err)', { timeout: 20000 });
  await p.waitForFunction(() => !document.getElementById('m-progress').textContent, null, { timeout: 20000 });
  const out = await text(p, '#m-result');
  assert.ok(!(await p.locator('#m-result .md-err').count()), `${job}: ${out}`);
  return out;
}

check('models page: each window lists only its own models and jobs, and the button shows the cost', async () => {
  const p = await openModels();
  assert.equal(await p.getAttribute('.cr-links a[data-id=models]', 'aria-current'), 'page');
  assert.match(await text(p, '.md-disclaim'), /不是 DFT 计算/);
  for (const [win, want] of Object.entries(MODEL_WINDOWS)) {
    await p.click(`#m-tabs [data-win=${win}]`);
    assert.equal(await p.getAttribute(`#m-tabs [data-win=${win}]`, 'aria-selected'), 'true');
    assert.deepEqual(await p.$$eval('#m-model option', (os) => os.map((o) => o.value)), want.models, `${win} models`);
    assert.deepEqual(await p.$$eval('#m-job option', (os) => os.map((o) => o.value)), want.jobs, `${win} jobs`);
    assert.equal(await p.isVisible('#m-cs'), win === 'charged', `charge and spin only in window 1 (${win})`);
    assert.equal(await p.locator('#m-cards .md-model').count(), want.models.length, `${win} model cards`);
  }
  await p.click('#m-tabs [data-win=charged]');
  const costs = { sp: 1, opt: 1, freq: 3, conf: 5, scan: 5, md: 5, rxn: 3, ipea: 1, spin: 2, bde: 2, pa: 2 };
  for (const [job, n] of Object.entries(costs)) {
    await p.selectOption('#m-job', job);
    assert.equal(await text(p, '#m-run'), `运行 · 消耗 ${n} 次`, job);
  }
  await p.check('#m-params input[data-k=thermo]');
  assert.equal(await text(p, '#m-run'), '运行 · 消耗 5 次', 'thermochemistry costs 5');
  assert.match(await text(p, '#m-costs'), /构象搜索、二面角扫描、分子动力学/);
  // Direct-force models say what their forces are.
  await p.selectOption('#m-model', 'allscaip-md-direct-all-omol');
  assert.equal(await p.isVisible('#m-direct'), true);
  await p.selectOption('#m-model', 'uma-s-1p2p1');
  assert.equal(await p.isVisible('#m-direct'), false);
  await finish(p);
});

check('models page: every job runs once and its result is shown', async () => {
  const p = await openModels();
  const last = () => p.posts.at(-1);
  assert.match(await runJob(p, 'sp'), V(/最大受力 0\.0120 eV\/Å/, /最大受力 -?\d+\.\d{4} eV\/Å/));
  assert.deepEqual(last(), { model: 'uma-s-1p2p1', job: 'sp', smiles: 'O=C1OCC(F)O1', charge: 0, spin: 1 });
  let r = await runJob(p, 'freq');
  assert.match(r, V(/有 1 个虚频/, /振动频率（cm⁻¹，共 \d+ 个）/)); assert.match(r, /吉布斯自由能 G/); assert.match(r, V(/-112\.4/, /零点能 ZPE-?\d+\.\d{4}/));
  assert.deepEqual(last().params, { temperature: 298.15, symmetry: 1 });
  r = await runJob(p, 'conf');
  assert.match(r, V(/去重后 3 个/, /去重后 \d+ 个/)); assert.match(r, V(/71\.2%/, /\d+\.\d%/));
  // Scan: the dihedral defaults to one around a rotatable bond of the numbered structure.
  await p.fill('#m-smiles', 'CCCO');
  await p.waitForFunction(() => /C3H8O/.test(document.getElementById('m-check').textContent));
  r = await runJob(p, 'scan');
  assert.match(r, /二面角 0-1-2-3，13 个点/);
  assert.deepEqual(last().params, { atoms: [0, 1, 2, 3], start: -180, end: 180, points: 13 });
  assert.equal(await p.locator('#m-result svg.md-plot polyline').count(), 1);
  assert.ok(await p.locator('#m-art svg').count(), 'the numbered 2D structure is drawn');
  r = await runJob(p, 'md');
  assert.match(r, V(/平均温度 301\.2 K/, /平均温度 -?\d+\.\d K/));
  assert.equal(await p.locator('#m-result svg.md-plot').count(), 2, 'energy and temperature curves');
  r = await runJob(p, 'rxn', () => p.check('#m-params input[data-k=thermo]'));
  assert.match(r, V(/ΔE = -1\.370 eV/, /ΔE = -?\d+\.\d{3} eV/)); assert.match(r, V(/ΔG\(298\.15 K\) = -1\.050 eV/, /ΔG\(298\.15 K\) = -?\d+\.\d{3} eV/));
  assert.equal(last().smiles, undefined, 'a reaction sends no structure');
  assert.equal(last().params.reaction, 'C=C.[H][H]>>CC');
  r = await runJob(p, 'ipea', () => p.selectOption('#m-params select[data-k=mode]', 'both'));
  assert.match(r, V(/绝热10\.900-0\.400/, /绝热-?\d+\.\d{3}-?\d+\.\d{3}/)); assert.match(r, V(/垂直11\.320-0\.950/, /垂直-?\d+\.\d{3}-?\d+\.\d{3}/));
  r = await runJob(p, 'spin');
  assert.match(r, V(/能隙 1\.020 eV/, /能隙 -?\d+\.\d{3} eV/));
  assert.deepEqual(last().params.spins, [1, 3]);
  r = await runJob(p, 'bde');
  assert.match(r, V(/BDE = 88\.8 kcal\/mol/, /BDE = -?\d+\.\d kcal\/mol/));
  assert.deepEqual(last().params.bond, [0, 1]);
  assert.ok((await p.$$eval('#m-params select[data-k=bond] option', (os) => os.map((o) => o.textContent))).includes('O3–H11'), 'X–H bonds use the AddHs numbering');
  r = await runJob(p, 'pa');
  assert.match(r, V(/质子亲和能 216\.8 kcal\/mol/, /质子亲和能 -?\d+\.\d kcal\/mol/));
  assert.deepEqual([last().params.site, last().params.mode], [3, 'protonate']);
  // Window 4: MACE-MDP.
  await p.click('#m-tabs [data-win=props]');
  r = await runJob(p, 'polar', async () => { await p.check('#m-academic'); await p.check('#m-params input[data-k=average]'); assert.equal(await text(p, '#m-run'), '运行 · 消耗 5 次'); });
  assert.match(r, V(/按 2 个构象的 Boltzmann 权重平均/, /按 \d+ 个构象的 Boltzmann 权重平均/)); assert.match(r, V(/4\.81 D/, /偶极矩 -?\d+\.\d{2} D/));
  assert.equal(last().academic, true);
  r = await runJob(p, 'ir');
  assert.ok(V((n) => n === 3, (n) => n > 0)(await p.locator('#m-result line.stick').count()), 'one stick per real mode');
  await p.locator('#m-result input[type=range]').fill('50');
  assert.equal(await text(p, '#m-result .md-fwhm'), '50');
  await p.check('#m-result input[value=raman]');
  assert.match(await p.getAttribute('#m-result .md-spec svg', 'aria-label'), /拉曼/);
  await finish(p);
});

check('models page: MACE academic box, ANI-2x free, ions kept to window 1, XYZ input, parameter limits', async () => {
  const p = await openModels('organic');
  await p.selectOption('#m-model', 'mace-off23-small');
  assert.equal(await p.isVisible('#m-asl'), true);
  assert.equal(await runOff(p), true);
  assert.match(await text(p, '#m-why'), /学术用途/);
  assert.match(await text(p, '#m-fine'), /ASL/);
  await p.check('#m-academic');
  assert.equal(await runOff(p), false, await text(p, '#m-why'));
  await p.selectOption('#m-model', 'ani-2x');
  assert.doesNotMatch(await text(p, '#m-why'), /Pro/);
  assert.equal(await runOff(p), false, 'ANI-2x is free for everyone');
  // A cation is fine in window 1 and refused in window 2.
  await p.click('#m-tabs [data-win=charged]');
  await p.fill('#m-smiles', '[NH4+]');
  await p.waitForFunction(() => /H4N/.test(document.getElementById('m-check').textContent));
  assert.equal(await p.inputValue('#m-charge'), '1');
  assert.equal(await runOff(p), false, await text(p, '#m-why'));
  await p.click('#m-tabs [data-win=neutral]');
  assert.match(await text(p, '#m-why'), /只算中性闭壳层分子/);
  assert.equal(await runOff(p), true);
  // XYZ: conformers need SMILES, a single point does not; no charge or spin is sent outside window 1.
  await p.check('input[name=m-mode][value=xyz]');
  await p.click('#m-xyz-sample');
  await p.waitForFunction(() => /XYZ · 3 个原子 · H2O/.test(document.getElementById('m-check').textContent));
  await p.selectOption('#m-job', 'conf');
  assert.match(await text(p, '#m-why'), /要从 SMILES 生成结构/);
  const r = await runJob(p, 'sp');
  assert.match(r, V(/能量 -2079\.6200 eV/, /能量 -?\d+\.\d{4} eV/));
  const sent = p.posts.at(-1);
  assert.deepEqual([sent.model, sent.job, sent.charge, sent.spin, sent.smiles], ['uma-s-1p1', 'sp', undefined, undefined, undefined]);
  assert.match(sent.xyz, /^3\nwater\nO 0\.000/);
  await p.fill('#m-xyz', `121\nbig\n${'C 0 0 0\n'.repeat(121)}`);
  await p.waitForFunction(() => /最多 120 个原子/.test(document.getElementById('m-check').textContent));
  assert.equal(await runOff(p), true);
  await p.check('input[name=m-mode][value=smiles]');
  // Parameter limits are checked before sending.
  await p.click('#m-tabs [data-win=charged]');
  await p.fill('#m-smiles', 'CCO');
  await p.waitForFunction(() => /C2H6O/.test(document.getElementById('m-check').textContent));
  await p.selectOption('#m-job', 'opt');
  await p.fill('#m-params input[data-k=fmax]', '0.5');
  assert.match(await text(p, '#m-why'), /fmax.*0\.001 到 0\.1/);
  await p.fill('#m-params input[data-k=fmax]', '0.1');
  assert.equal(await runOff(p), false, await text(p, '#m-why'));
  await p.selectOption('#m-job', 'md');
  await p.fill('#m-params input[data-k=steps]', '2001');
  assert.match(await text(p, '#m-why'), /步数要在 100 到 2000 之间/);
  await p.fill('#m-params input[data-k=steps]', '2000');
  assert.equal(await runOff(p), false);
  await p.selectOption('#m-job', 'scan');
  await p.fill('#m-params input[data-k=start]', '90');
  await p.fill('#m-params input[data-k=end]', '90');
  assert.match(await text(p, '#m-why'), /终止角要大于起始角|至少 4 个重原子/);
  // A reaction may have 6 species in all, both sides together (server.py counts the same way).
  await p.selectOption('#m-job', 'rxn');
  await p.fill('#m-params input[data-k=reaction]', 'C.C.C.C>>C.C.C.C');
  assert.match(await text(p, '#m-why'), /一共最多 6 个物种/);
  await p.fill('#m-params input[data-k=reaction]', 'C.C.C>>C.C.C');
  assert.equal(await runOff(p), false, await text(p, '#m-why'));
  await p.selectOption('#m-job', 'opt'); // a reaction hides the structure input
  // Deprotonation needs a hydrogen on the chosen atom: acetone's oxygen has none.
  await p.fill('#m-smiles', 'CC(C)=O');
  await p.waitForFunction(() => /C3H6O/.test(document.getElementById('m-check').textContent));
  await p.selectOption('#m-job', 'pa');
  await p.selectOption('#m-params select[data-k=mode]', 'deprotonate');
  await p.selectOption('#m-params select[data-k=site]', '3');
  assert.match(await text(p, '#m-why'), /O3 上没有氢，不能去质子/);
  await p.selectOption('#m-params select[data-k=site]', '0');
  assert.equal(await runOff(p), false, await text(p, '#m-why'));
  await finish(p);
});

check('models page: compare several models in one table, and a model that is off cannot be picked', async () => {
  const p = await openModels('', { health: (h) => { h.models['uma-s-1p2p1-ft-d4rev'].ready = false; return h; } });
  assert.equal(await p.$eval('#m-model option[value=uma-s-1p2p1-ft-d4rev]', (o) => o.disabled), true, 'an unloaded model is off');
  await p.check('#m-compare-on');
  await p.selectOption('#m-job', 'ipea');
  assert.equal(await text(p, '#m-run'), '依次运行 2 个模型 · 消耗 2 次');
  await p.check('#m-compare input[value=uma-s-1p2p1-ft-d4rev]');
  assert.match(await text(p, '#m-why'), /UMA-S 1\.2\.1 D4rev 现在没有在站长电脑上运行/);
  assert.equal(await runOff(p), true);
  await p.uncheck('#m-compare input[value=uma-s-1p2p1-ft-d4rev]');
  await p.check('#m-compare input[value=allscaip-md-conserving-all-omol]');
  assert.equal(await text(p, '#m-run'), '依次运行 3 个模型 · 消耗 3 次');
  await p.click('#m-run');
  await p.waitForFunction(() => document.querySelectorAll('#m-result .md-cmp tbody tr').length === 3 && !document.getElementById('m-progress').textContent, null, { timeout: 40000 });
  assert.deepEqual(p.posts.map((b) => b.model), ['uma-s-1p2p1', 'uma-s-1p2', 'allscaip-md-conserving-all-omol'], 'one after another');
  assert.match(await text(p, '#m-result .md-cmp'), /绝热 IP（eV）/);
  await finish(p);
});

check('models page: UMA-S 1.2.1 adiabatic IP / EA imports into the AI Lab, and progress is shown', async () => {
  const p = await openModels();
  await p.selectOption('#m-job', 'ipea');
  await p.click('#m-run');
  // The real --fake server finishes these jobs before the first poll, so only the stand-in shows progress.
  if (!REAL) await p.waitForFunction(() => /进度 1\/3 · test step/.test(document.getElementById('m-progress').textContent), null, { timeout: 10000 });
  await p.waitForSelector('#m-result [data-act=lab]', { timeout: 20000 });
  assert.match(await text(p, '#m-result'), V(/10\.900/, /绝热-?\d+\.\d{3}/));
  await p.click('#m-result [data-act=lab]');
  await p.waitForURL(/lab\/index\.html/);
  await p.waitForFunction(() => /更新 1 个分子/.test(document.getElementById('import-msg')?.textContent || ''), null, { timeout: 30000 });
  await finish(p);
});

check('English: the models page has no Chinese left in its windows and a result', async () => {
  const p = await openModels('', {});
  await go(p, '/models/index.html?lang=en#charged');
  await p.waitForFunction(() => /15/.test(document.getElementById('m-status').textContent) && /C3H3FO3/.test(document.getElementById('m-check').textContent), null, { timeout: 30000 });
  await runJob(p, 'freq');
  const left = new Set();
  for (const win of ['charged', 'neutral', 'organic', 'props']) {
    await p.click(`#m-tabs [data-win=${win}]`);
    await p.waitForFunction(() => !document.documentElement.dataset.i18n);
    await p.waitForTimeout(400);
    for (const t of await p.evaluate(() => {
      const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,code,textarea,[translate=no]')) out.push(n.nodeValue.trim());
      return out;
    })) left.add(t);
  }
  assert.deepEqual([...left], []);
  await finish(p);
});

check('Meta page: the online panel moved to the models page', async () => {
  const p = await open();
  await go(p, '/meta/index.html#uma');
  assert.equal(await p.locator('#u-online').count(), 0, 'the old online panel is gone');
  assert.equal(await p.locator('#u-code').count(), 1, 'the script generator stays');
  await p.click('#u-models a[href$="models/index.html"]');
  await p.waitForURL(/models\/index\.html/);
  await p.waitForSelector('#m-tabs');
  await finish(p);
});

check('AI settings: vendor presets fill the endpoint, list models and adapt to the API', async () => {
  // Vendor APIs are faked: a model list, and a chat endpoint that only accepts max_completion_tokens.
  const p = await open();
  const calls = [];
  await p.context().route('https://api.openai.com/v1/**', async (route) => {
    const req = route.request();
    const body = req.method() === 'POST' ? req.postDataJSON() : null;
    calls.push({ url: req.url(), method: req.method(), headers: req.headers(), body });
    if (req.url().endsWith('/models')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'gpt-test-mini' }, { id: 'gpt-test' }] }) });
    if ('max_tokens' in body) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: body.model, choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 3 } }) });
  });
  await p.context().route('https://api.anthropic.com/v1/**', (route) => {
    calls.push({ url: route.request().url(), method: route.request().method(), headers: route.request().headers() });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'claude-test' }] }) });
  });
  await go(p, '/index.html');
  await p.evaluate(() => window.ChemHub.loadAI().then((ai) => ai.openSettings()));
  await p.check('input[name=provider][value=custom]', { force: true });
  await p.selectOption('select[name=vendor]', 'openai');
  assert.equal(await p.inputValue('input[name=customBase]'), 'https://api.openai.com/v1');
  assert.equal(await p.getAttribute('[data-keyurl]', 'href'), 'https://platform.openai.com/api-keys');
  await p.fill('input[name=key]', 'sk-test');
  await p.click('[data-act=models]');
  await p.waitForFunction(() => document.querySelectorAll('#cai-models option').length === 2);
  await p.fill('input[name=customModel]', 'gpt-test-mini');
  await p.click('[data-act=test]');
  await p.waitForFunction(() => /连接成功/.test(document.querySelector('.cai-status').textContent));
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 2, 'one rejected request, one retried');
  assert.ok('max_tokens' in posts[0].body && 'max_completion_tokens' in posts[1].body && !('max_tokens' in posts[1].body));
  assert.equal(posts[1].headers.authorization, 'Bearer sk-test');
  // Claude answers browsers only with its opt-in header.
  await p.selectOption('select[name=vendor]', 'anthropic');
  await p.click('[data-act=models]');
  await p.waitForFunction(() => document.querySelectorAll('#cai-models option').length === 1);
  const claude = calls.find((c) => c.url.startsWith('https://api.anthropic.com'));
  assert.equal(claude.headers['anthropic-dangerous-direct-browser-access'], 'true');
  await finish(p);
});

check('handbook: its own page, Chinese and English chapters, the choice is remembered, the English site opens in English', async () => {
  const p = await open();
  await go(p, '/manual/index.html#p08-cat05');
  await p.waitForSelector('#guide-article h1');
  assert.match(await text(p, '#view-guide .page-intro h1'), /^说明讲解手册/);
  assert.equal(await p.getAttribute('.cr-links a[data-id=manual]', 'aria-current'), 'page');
  assert.equal(await p.locator('#guide-toc button').count(), 20);
  assert.equal(await p.locator('.sidebar, #view-resources, #view-agent').count(), 0, 'no database views on the handbook page');
  assert.equal(await p.locator('#view-guide .page-intro p').count(), 0);
  assert.equal(await text(p, '#guide-article h1'), '药物、生物活性与化学空间');
  await p.click('[data-guide-lang=en]');
  assert.equal(await text(p, '#guide-article h1'), 'Drugs, bioactivity & chemical space');
  assert.equal(await p.getAttribute('#guide-article', 'lang'), 'en');
  assert.equal(await text(p, '#reader-progress'), '09 / 20 · 05 · Drugs & chemical space');
  await p.click('#guide-next');
  assert.equal(await text(p, '#guide-article h1'), 'Metabolites, natural products & reaction pathways');
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#guide-article h1');
  assert.equal(await text(p, '#guide-article h1'), 'Metabolites, natural products & reaction pathways');
  // English chapters keep Chinese only in the title subtitle and in names given in parentheses.
  const left = await p.evaluate(() => window.CHEMDB_GUIDES_EN.guides.flatMap((g) => g.html.replace(/<div class="en" lang="zh-CN">[^<]*<\/div>/g, '').replace(/\([^)]*\)/g, '').match(/[一-鿿]+/g) || []));
  assert.deepEqual(left, []);
  await finish(p);
  const en = await open();
  await go(en, '/manual/index.html?lang=en#p00-cover');
  await en.waitForSelector('#guide-article h1');
  assert.match(await text(en, '#guide-article h1'), /^103 entry points/);
  assert.equal(await en.getAttribute('[data-guide-lang=en]', 'aria-pressed'), 'true');
  await finish(en);
});

check('handbook: old atlas #guide addresses open the same chapter in manual/, the database page has no handbook left', async () => {
  // The old address runs the database page first, which replaces itself with the handbook.
  const oldAddress = async (p, path, url) => { await p.goto(SITE + path, { waitUntil: 'commit' }); await p.waitForURL(url); await p.waitForSelector('#guide-article h1'); };
  const p = await open();
  await oldAddress(p, '/atlas/index.html#guide/p08-cat05', /\/manual\/index\.html#p08-cat05$/);
  assert.equal(await text(p, '#guide-article h1'), '药物、生物活性与化学空间');
  await oldAddress(p, '/atlas/index.html#guide', /\/manual\/index\.html$/);
  assert.equal(await text(p, '#reader-progress'), '02 / 20 · 三分钟导读');
  await finish(p);
  const en = await open();
  await oldAddress(en, '/atlas/index.html?lang=en#guide/p00-cover', /\/manual\/index\.html\?lang=en#p00-cover$/);
  assert.match(await text(en, '#guide-article h1'), /^103 entry points/);
  await finish(en);
  // The database page: resource navigation, research topics and Agent engineering only.
  const db = await open();
  await go(db, '/atlas/index.html');
  assert.deepEqual(await db.$$eval('.main-nav [data-view]', (b) => b.map((x) => x.dataset.view)), ['resources', 'agent']);
  assert.ok(await db.locator('#category-nav .category-button').count() > 10);
  assert.equal(await db.locator('#view-guide, [data-view=guide], [data-open-guide], .reading-banner, script[src*="guides-en"]').count(), 0);
  assert.equal(await db.getAttribute('.cr-links a[data-id=atlas]', 'aria-current'), 'page');
  await db.evaluate(() => { location.hash = '#agent'; });
  await db.waitForFunction(() => document.querySelector('.cr-links a[data-id=agent]').getAttribute('aria-current') === 'page' && !document.getElementById('view-agent').hidden);
  await finish(db);
  // Entry points elsewhere on the site lead to the new address: the home page and a handbook card in the network view.
  const home = await open();
  await go(home, '/index.html');
  assert.deepEqual(await home.$$eval('a[href*="atlas/index.html#guide"]', (a) => a.length), 0);
  assert.equal(await home.locator('.intro-actions a[href="manual/index.html"]').count(), 1);
  await go(home, '/hub/network.html?q=PubChem');
  const card = home.locator('#netResults a[href*="manual/index.html#"]').first();
  await card.waitFor();
  const href = await card.getAttribute('href');
  await card.click();
  await home.waitForURL(new RegExp(`/manual/index\\.html${href.slice(href.indexOf('#'))}$`));
  await home.waitForSelector('#guide-toc button.active');
  await finish(home);
});

check('agent: the Agent section shows chemdb-agent 0.2.0 as implemented, the integrated counts match the catalogue, the download is the packed source', async () => {
  const p = await open();
  await go(p, '/atlas/index.html#agent');
  await p.waitForFunction(() => !document.getElementById('view-agent').hidden);
  assert.match(await text(p, '#view-agent .agent-intro .pill'), /v0\.2\.0/);
  // The query tools, QCArchive and export are wired now; only the "not yet covered" row stays pending.
  assert.doesNotMatch(await p.innerText('#view-agent'), /占位|待接线/);
  assert.equal(await p.locator('#view-agent .state.pending').count(), 1);
  assert.equal(await p.locator('#view-agent .agent-flow .planned').count(), 0);
  // "已有接入模块" in the metrics and the filter tab is the number of catalogue entries with a module.
  const n = await p.evaluate(() => window.CHEMDB_CONTENT.resources.filter((r) => ['adapter', 'optimade'].includes(r.integration)).length);
  assert.equal(n, 13);
  assert.equal(await text(p, '[data-filter=integrated] span'), String(n));
  assert.match(await text(p, '.metrics > div:nth-child(3) strong'), new RegExp(`^${n}`));
  // Four research paths, every resource they name is in the catalogue.
  for (const task of ['molecule', 'crystal', 'basis', 'qm']) {
    await p.click(`[data-task=${task}]`);
    const names = await p.$$eval('#plan-result .plan-resource-list button', (b) => b.map((x) => x.textContent.replace('↗', '').trim()));
    assert.ok(names.length >= 3 && names.every(Boolean), `${task}: ${names}`);
  }
  await p.click('[data-code=python]');
  assert.match(await text(p, '#code-content'), /export_training_set/);
  await p.click('[data-code=mcp]');
  assert.match(await text(p, '#code-content'), /chemdb_agent\.server/);
  // The download button serves the zip built by tools/pack-chemdb-agent.py.
  const href = await p.getAttribute('#view-agent a[download]', 'href');
  assert.equal(href, 'downloads/chemdb-agent.zip');
  const res = await p.request.get(new URL(href, p.url()).href);
  assert.equal(res.status(), 200);
  const zip = await res.body();
  assert.equal(zip.subarray(0, 2).toString(), 'PK');
  assert.ok(['src/chemdb_agent/server.py', 'src/chemdb_agent/export.py', 'CHANGELOG.md'].every((f) => zip.includes(`chemdb-agent/${f}`)));
  assert.ok(!zip.includes('__pycache__') && !zip.includes('.venv/'));
  await go(p, '/atlas/index.html#resources');
  await p.click('[data-filter=integrated]');
  assert.match(await text(p, '#results-count'), new RegExp(`共 ${n} 条`));
  await finish(p);
});

check('top bar: one row at every desktop width in both languages, the rest goes into 更多 in order, phones scroll', async () => {
  for (const lang of ['zh', 'en']) {
    // Phones keep every link in the scrolling row, so they give the full list in its order.
    const phone = await open({ viewport: { width: 390, height: 844 } });
    await go(phone, `/manual/index.html${lang === 'en' ? '?lang=en' : ''}`);
    const order = await phone.$$eval('.cr-links > a[data-id]:not(.cr-pro-link)', (a) => a.map((x) => x.dataset.id));
    assert.ok(order.length >= 12 && ['manual', 'atlas', 'agent'].every((id) => order.includes(id)), `links: ${order}`);
    assert.ok(await phone.locator('.cr-more-btn').isHidden());
    assert.ok(await phone.evaluate(() => { const r = document.querySelector('.cr-links'); return r.scrollWidth > r.clientWidth && getComputedStyle(r).overflowX === 'auto'; }), 'phone row scrolls');
    await finish(phone);
    for (const width of [761, 1024, 1181, 1250, 1366, 1536, 1920]) {
      const p = await open({ viewport: { width, height: 800 } });
      await go(p, `/atlas/index.html${lang === 'en' ? '?lang=en' : ''}#agent`);
      await p.waitForFunction(() => !document.documentElement.dataset.i18n);
      const bar = await p.evaluate(() => {
        const row = document.querySelector('.cr-links'), btn = document.querySelector('.cr-more-btn');
        const shown = [...row.children].filter((el) => el.offsetWidth);
        return {
          tops: [...new Set(shown.map((el) => Math.round(el.getBoundingClientRect().top)))],
          inRow: [...row.querySelectorAll(':scope > a[data-id]')].filter((a) => a.offsetWidth).map((a) => a.dataset.id),
          inMenu: [...document.querySelectorAll('.cr-more-menu a')].map((a) => a.dataset.id),
          moreShown: !!btn.offsetWidth, moreCurrent: btn.hasAttribute('data-current'),
          header: document.querySelector('.cr-header').offsetHeight, wide: row.scrollWidth > row.clientWidth + 1,
        };
      });
      const where = `${lang} ${width}px`;
      assert.equal(bar.tops.length, 1, `${where}: links on ${bar.tops.length} rows`);
      assert.ok(bar.header <= 70 && !bar.wide, `${where}: header ${bar.header}px, row overflows ${bar.wide}`);
      assert.deepEqual([...bar.inRow, ...bar.inMenu], order, `${where}: order`);
      assert.equal(bar.moreShown, bar.inMenu.length > 0, `${where}: 更多 shown only when needed`);
      assert.equal(bar.moreCurrent, bar.inMenu.includes('agent'), `${where}: 更多 marked current when Agent 工程 is inside`);
      await p.context().close();
    }
  }
  // Keyboard: Enter opens, Tab reaches the first tucked-away link, Escape closes and returns focus. Resizing moves links back.
  const p = await open({ viewport: { width: 1024, height: 800 } });
  await go(p, '/atlas/index.html#agent');
  const tucked = await p.$$eval('.cr-more-menu a', (a) => a.map((x) => x.dataset.id));
  assert.ok(tucked.length >= 2 && tucked.includes('agent'), `tucked at 1024px: ${tucked}`);
  assert.ok(await p.evaluate(() => document.querySelector('.cr-more-btn').hasAttribute('data-current')));
  await p.focus('.cr-more-btn');
  await p.keyboard.press('Enter');
  assert.equal(await p.getAttribute('.cr-more-btn', 'aria-expanded'), 'true');
  assert.ok(await p.locator('.cr-more-menu').isVisible());
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.dataset.id), tucked[0]);
  await p.keyboard.press('Escape');
  assert.equal(await p.getAttribute('.cr-more-btn', 'aria-expanded'), 'false');
  assert.ok(await p.locator('.cr-more-menu').isHidden());
  assert.ok(await p.evaluate(() => document.activeElement.classList.contains('cr-more-btn')));
  await p.click('.cr-more-btn');
  await p.click('#breadcrumb');
  assert.ok(await p.locator('.cr-more-menu').isHidden(), 'a click outside closes the menu');
  // With 15 links (进一步基础科学发现 added 2026-11-07) every link fits from about 2000 px; at 1920 px Agent 工程 sits in 更多.
  await p.setViewportSize({ width: 2560, height: 800 });
  await p.waitForFunction(() => !document.querySelector('.cr-more-btn').offsetWidth);
  await p.setViewportSize({ width: 900, height: 800 });
  await p.waitForFunction((n) => document.querySelectorAll('.cr-more-menu a').length > n, tucked.length);
  await finish(p);
});

check('network: the searched term is the centre, suggestions complete, clicking a node recentres, Back returns', async () => {
  const p = await open();
  await go(p, '/hub/network.html?q=Shermo');
  await p.waitForFunction(() => window.MolAstriaNetView?.current().center?.name === 'Shermo');
  assert.equal((await text(p, '#resultTitle')).trim(), 'Shermo');
  assert.match(await p.innerText('#netRelated'), /热力学/);
  assert.match(await p.innerText('#netResults'), /Shermo/);
  // Suggestions while typing; Enter on a partial name completes it.
  await p.fill('#netQ', 'multiw');
  await p.waitForFunction(() => !document.getElementById('netSuggest').hidden && /Multiwfn/.test(document.getElementById('netSuggest').innerText));
  await p.press('#netQ', 'Enter');
  await p.waitForFunction(() => window.MolAstriaNetView.current().center?.name === 'Multiwfn');
  // Clicking a first-ring node on the canvas makes it the centre.
  await p.waitForFunction(() => window.MolAstriaNetView.settled(), null, { timeout: 15000 });
  await p.locator('#graph').scrollIntoViewIfNeeded();
  const target = await p.evaluate(() => { const v = window.MolAstriaNetView, n = v.nodes().find((x) => x.ring === 1 && x.entity); return { id: n.id, name: n.entity.name, at: v.screenOf(n.id) }; });
  await p.mouse.click(target.at.x, target.at.y);
  await p.waitForFunction((name) => window.MolAstriaNetView.current().center?.name === name, target.name);
  assert.match(p.url(), /[?&]q=/);
  await p.goBack();
  await p.waitForFunction(() => window.MolAstriaNetView.current().center?.name === 'Multiwfn');
  await finish(p);
  const en = await open();
  await go(en, '/hub/network.html?lang=en&q=' + encodeURIComponent('静电势'));
  await en.waitForFunction(() => document.getElementById('resultTitle')?.textContent.trim() === 'Electrostatic potential');
  await finish(en);
});

check('train page: the weekly Hugging Face check shows its date, link stats and new models', async () => {
  const p = await open();
  await go(p, '/train/index.html');
  const live = await p.evaluate(() => window.MOLASTRIA_MODELS_LIVE);
  assert.ok(live && live.checkedAt && live.linked > 30, 'models-live.js loaded');
  assert.match(await text(p, '#stamp-date'), new RegExp(live.checkedAt));
  assert.ok(await p.locator('.hf-stats').count() >= live.ok);
  assert.equal(await p.locator('.news-item').count(), live.fresh.length);
  assert.equal(await p.locator('#model-news').isVisible(), live.fresh.length > 0);
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

check('catalogue: international sources outnumber Chinese ones, the topic chart has topics, search and network find them', async () => {
  const p = await open();
  await go(p, '/hub/index.html');
  await p.waitForSelector('#sourceCards .source-card');
  const cards = await p.$$eval('#sourceCards h3', (h) => h.map((x) => x.textContent));
  for (const s of ['Matter Modeling Stack Exchange', 'matsci.org', 'Computational Chemistry Highlights', '主流程序发布说明']) assert.ok(cards.some((t) => t.includes(s)), `no source card for ${s}`);
  const split = await text(p, '#langSplit');
  const [, zh, intl] = split.match(/中文来源 (\d+) 条 · 国际来源 (\d+) 条/) || [];
  assert.ok(+intl > +zh, split);
  const topics = await p.$$eval('#tagBars .name', (n) => n.map((x) => x.textContent));
  assert.equal(topics.length, 10);
  for (const t of ['站长随笔', '论坛问答', '预印本', '期刊论文']) assert.ok(!topics.includes(t), `type tag ${t} in the topic chart`);
  await p.selectOption('#fSource', 'gromacsforum'); // an English forum question is filed under a topic
  assert.match(await p.innerText('#cards .card .chips'), /分子动力学/);
  const phone = await open({ viewport: { width: 390, height: 844 } }); // long URLs in forum excerpts must wrap
  await go(phone, '/hub/index.html');
  for (const id of ['mattermodeling', 'matsci', 'chemse']) {
    await phone.selectOption('#fSource', id);
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `sideways scroll with ${id} cards`);
  }
  await finish(phone);
  await go(p, '/index.html');
  await p.fill('input[type=search]', 'LAMMPS');
  await p.waitForFunction(() => [...document.querySelectorAll('.result-row')].some((r) => /matsci\.org/.test(r.textContent)), null, { timeout: 8000 });
  await go(p, '/hub/network.html?q=GROMACS');
  await p.waitForFunction(() => window.MolAstriaNetView?.current().center?.name === 'GROMACS');
  assert.match(await p.innerText('#netResults'), /GROMACS 论坛/);
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
  // Single-quoted placeholders (the topic query syntax hint) are translated too.
  await f.click('[data-act=new-topic]');
  await f.waitForSelector('#tq');
  await f.waitForFunction(() => !/[㐀-鿿]/.test(document.getElementById('tq').placeholder), null, { timeout: 5000 });
  assert.match(await f.getAttribute('#tq', 'placeholder'), /Comma or new line = OR/);
  await finish(p);
});

check('journals: 35+ journals by category, filters and search combine, empty state, sourced details, deep links', async () => {
  const p = await open();
  await go(p, '/journals/index.html');
  const visible = () => p.$$eval('.jr-card:not([hidden])', (c) => c.map((x) => x.dataset.id));
  const all = await visible();
  const journals = await p.locator('.jr-group:not([data-cat=preprint]) .jr-card').count();
  assert.ok(journals >= 35, `${journals} journals`);
  assert.ok(await p.locator('.jr-group[data-cat=preprint] .jr-card').count() >= 2, 'ChemRxiv and arXiv');
  // Every item has at least one field, and every field names its source with a link; every item has official links.
  const unsourced = await p.$$eval('.jr-card', (cards) => cards.filter((c) => !c.querySelector('.jr-fields > div') || [...c.querySelectorAll('.jr-fields > div')].some((f) => !f.querySelector('.jr-src a[href^="http"]')) || !c.querySelector('.jr-links a[href^="http"]')).map((c) => c.dataset.id));
  assert.deepEqual(unsourced, []);
  // One filter, two combined, search by ISSN with or without the hyphen, and an empty combination with its reset.
  await p.selectOption('#jr-cat', 'china');
  assert.ok((await visible()).length >= 5 && (await p.$$eval('.jr-card:not([hidden])', (c) => c.every((x) => x.closest('.jr-group').dataset.cat === 'china'))));
  assert.ok(await p.locator('.jr-group[data-cat=core]').isHidden(), 'empty groups are hidden');
  await p.selectOption('#jr-cat', '');
  await p.selectOption('#jr-pub', 'acs');
  await p.selectOption('#jr-oa', 'full');
  assert.deepEqual((await visible()).sort(), ['apcau', 'jacsau']);
  assert.match(await text(p, '#jr-count'), /2/);
  await p.click('#jr-reset');
  assert.equal((await visible()).length, all.length);
  for (const q of ['1549-9618', '15499618', 'JCTC']) {
    await p.fill('#jr-q', q);
    assert.deepEqual(await visible(), ['jctc'], `search ${q}`);
  }
  await p.fill('#jr-q', '');
  await p.selectOption('#jr-type', 'software');
  assert.ok((await visible()).includes('joss') && !(await visible()).includes('jacs'));
  await p.selectOption('#jr-cat', 'china');
  assert.equal((await visible()).length, 0);
  assert.ok(await p.locator('#jr-empty').isVisible(), 'empty-state message');
  await p.click('#jr-empty-reset');
  assert.equal((await visible()).length, all.length);
  assert.ok(await p.locator('#jr-empty').isHidden());
  // Details open in place and give the item an address; the address opens it again.
  await p.click('#j-pccp .jr-toggle');
  assert.equal(await p.getAttribute('#j-pccp .jr-toggle', 'aria-expanded'), 'true');
  assert.ok(await p.locator('#jd-pccp a[href*="rsc.org"]').first().isVisible());
  assert.match(p.url(), /#j-pccp$/);
  await go(p, '/journals/index.html#j-ccs');
  await p.waitForSelector('#jd-ccs:not([hidden])');
  await finish(p);
});

check('journals: the guide has a table of contents that jumps to each chapter, in Chinese and in English', async () => {
  const p = await open();
  await go(p, '/journals/index.html');
  const ids = await p.$$eval('#jr-toc a', (a) => a.map((x) => x.dataset.chapter));
  assert.ok(ids.length >= 15 && ['g-methods', 'g-details', 'g-cover', 'g-response', 'g-ethics', 'g-reject'].every((id) => ids.includes(id)), `chapters: ${ids}`);
  assert.deepEqual(await p.$$eval('#jr-guide-body .jr-chapter', (s) => s.map((x) => x.id)), ids);
  for (const id of ['g-response', 'g-repro']) {
    await p.click(`#jr-toc a[data-chapter=${id}]`);
    await p.waitForFunction((cid) => { const top = document.getElementById(cid).getBoundingClientRect().top, nav = document.querySelector('.cr-header').offsetHeight; return top >= nav - 2 && top < nav + 60; }, id);
    assert.match(p.url(), new RegExp(`#${id}$`));
    assert.equal(await p.getAttribute(`#jr-toc a[data-chapter=${id}]`, 'aria-current'), 'true');
  }
  await finish(p);
  // English: the same chapters in English, and the journal facts too (names in Chinese only where given in parentheses).
  const en = await open();
  await go(en, '/journals/index.html?lang=en#g-ethics');
  assert.match(await text(en, '#g-map h3'), /Overview/);
  assert.deepEqual(await en.$$eval('#jr-guide-body .jr-chapter', (s) => s.map((x) => x.id)), ids);
  const left = await en.evaluate(() => [...document.querySelectorAll('#jr-guide-body, .jr-fields dd > span[translate=no], .jr-scope, .jr-tags')].flatMap((n) => n.textContent.match(/[㐀-鿿]+/g) || []));
  assert.deepEqual([...new Set(left)], ['中科院分区']);
  await finish(en);
});

check('journals: the top bar marks 期刊发表 current, also when it sits in 更多', async () => {
  let tucked = 0;
  for (const width of [900, 1024, 1181, 1366, 1920]) {
    const p = await open({ viewport: { width, height: 800 } });
    await go(p, '/journals/index.html');
    const bar = await p.evaluate(() => ({ inMenu: !!document.querySelector('.cr-more-menu a[data-id=journals]'), current: document.querySelector('.cr-links a[data-id=journals]').getAttribute('aria-current'), more: document.querySelector('.cr-more-btn').hasAttribute('data-current') }));
    assert.equal(bar.current, 'page', `${width}px`);
    assert.equal(bar.more, bar.inMenu, `${width}px: 更多 marked current exactly when 期刊发表 is inside`);
    if (bar.inMenu) tucked++;
    await p.context().close();
  }
  assert.ok(tucked > 0, 'some tested width puts 期刊发表 into 更多');
});

check('scimodels: 27 model cards by subcategory with official links, filters and search, details by address, price chart with its table', async () => {
  const p = await open();
  await go(p, '/scimodels/index.html');
  assert.equal(await p.getAttribute('.cr-links a[data-id=scimodels]', 'aria-current'), 'page');
  const visible = () => p.$$eval('.sm-card:not([hidden])', (c) => c.map((x) => x.dataset.slug).sort());
  const all = await visible();
  assert.equal(all.length, 27);
  assert.equal(await p.locator('.sm-group').count(), 6);
  // Every card has a release link, and a trial link or a plain statement that there is none; external links open safely.
  const incomplete = await p.$$eval('.sm-card', (cards) => cards.filter((c) => { const [, trial, release] = c.querySelectorAll('.sm-links > div'); return !release.querySelector('a[href^="https://"]') || !(trial.querySelector('a[href^="https://"]') || trial.querySelector('.sm-none').textContent.trim()); }).map((c) => c.dataset.slug));
  assert.deepEqual(incomplete, []);
  const unsafe = await p.$$eval('main a[href]', (a) => a.filter((x) => new URL(x.href).origin !== location.origin && (x.target !== '_blank' || !/noopener/.test(x.rel) || !/noreferrer/.test(x.rel))).map((x) => x.href));
  assert.deepEqual(unsafe, []);
  assert.match(await text(p, '#m-mechgpt .sm-links'), /没有 Hugging Face 页面/);
  assert.match(await text(p, '#m-s1-base .sm-links'), /只提供权重，需自行部署/);
  // Filters alone and combined, search, the empty state and its reset.
  await p.selectOption('#sm-access', 'paid');
  assert.deepEqual(await visible(), ['hydrogen-1-0']);
  await p.selectOption('#sm-access', 'paper');
  assert.deepEqual(await visible(), ['chemmllm', 'mechgpt']);
  await p.selectOption('#sm-group', 'mat');
  assert.deepEqual(await visible(), ['mechgpt']);
  assert.ok(await p.locator('.sm-group[data-group=chem]').isHidden(), 'empty groups are hidden');
  await p.click('#sm-reset');
  await p.fill('#sm-q', 'MOF');
  assert.ok((await visible()).includes('mofreasoner'));
  await p.fill('#sm-q', 'zzzz');
  assert.ok(await p.locator('#sm-empty').isVisible(), 'empty-state message');
  await p.click('#sm-empty-reset');
  assert.equal((await visible()).length, 27);
  // Details open in place and give the card an address.
  await p.click('#m-ether0 .sm-toggle');
  assert.equal(await p.getAttribute('#m-ether0 .sm-toggle', 'aria-expanded'), 'true');
  assert.match(await text(p, '#md-ether0'), /Apache-2\.0/);
  assert.match(p.url(), /#m-ether0$/);
  // The chart and the table hold the same rows; one science model has a public price; each row names its official source.
  const rows = await p.locator('.sm-row').count();
  assert.ok(rows >= 14 && rows === await p.locator('#sm-table tbody tr').count(), `${rows} chart rows`);
  assert.equal(await p.locator('.sm-row.sci').count(), 1);
  assert.ok(await p.$$eval('#sm-table tbody tr', (r) => r.every((tr) => tr.lastElementChild.querySelector('a[href^="https://"]'))));
  assert.ok(await p.$$eval('.sm-track', (t) => t.every((x) => { const [i, o] = x.querySelectorAll('.sm-bar'); return i.offsetWidth > 0 && i.offsetWidth <= o.offsetWidth; })), 'input bar no longer than output bar');
  assert.equal(await p.locator('#sm-unpriced li a[href^="#m-"]').count(), 26);
  await finish(p);
  // From the database: a category-17 entry links to its card, which opens; other entries keep their old wording.
  const d = await open();
  await go(d, '/atlas/index.html#resources/205');
  assert.match(await text(d, '#dialog-body'), /2026-11-06 · 已对照官方页面逐条核对/);
  assert.match(await d.getAttribute('#dialog-body a[href*="scimodels"]', 'href'), /#m-mofreasoner$/);
  await d.click('#dialog-body a[href*="scimodels"]');
  await d.waitForSelector('#md-mofreasoner:not([hidden])');
  await go(d, '/atlas/index.html#resources/80');
  assert.match(await text(d, '#dialog-body'), /2026-10-27/);
  assert.equal(await d.locator('#dialog-body a[href*="scimodels"]').count(), 0);
  await go(d, '/manual/index.html#p11c-cat17');
  await d.waitForSelector('#guide-article a[href$="scimodels/index.html"]');
  await finish(d);
  // English: the model data is in English.
  const en = await open();
  await go(en, '/scimodels/index.html?lang=en#m-hydrogen-1-0');
  await en.waitForSelector('#md-hydrogen-1-0:not([hidden])');
  const left = await en.evaluate(() => [...document.querySelectorAll('.sm-card [translate=no], #sm-table [translate=no], #sm-unpriced a')].flatMap((n) => n.textContent.match(/[㐀-鿿]+/g) || []));
  assert.deepEqual(left, []);
  await finish(en);
});

check('teaching videos: cards by topic with original links, covers with fallbacks, play on click, filters, desktop opens outside', async () => {
  // No real video sites in tests: covers come back as a tiny PNG (or fail), players as a stub page.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const stub = async (p, covers) => {
    await p.context().route(/^https:\/\/(i\.ytimg\.com|[^/]*\.hdslb\.com)\//, (r) => (covers ? r.fulfill({ contentType: 'image/png', body: png }) : r.abort()));
    await p.context().route(/^https:\/\/(www\.youtube-nocookie\.com|player\.bilibili\.com)\//, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>player</title><p>player</p>' }));
  };
  const p = await open();
  await stub(p, true);
  await go(p, '/videos/index.html');
  assert.equal(await p.getAttribute('.cr-links a[data-id=videos]', 'aria-current'), 'page');
  const data = await p.evaluate(() => window.MOLASTRIA_VIDEOS);
  const n = data.items.length;
  assert.ok(n >= 100, `${n} videos`);
  assert.equal(new Set(data.items.map((v) => v.id)).size, n, 'no duplicate ids');
  assert.ok(data.items.every((v) => (v.p === 'yt' ? /^([\w-]{11}|PL[\w-]{16,})$/.test(v.id) : /^BV[0-9A-Za-z]{10}$/.test(v.id))), 'ids look like YouTube / Bilibili ids');
  assert.ok(data.items.every((v) => v.title && v.channel && v.note?.zh && v.note?.en && data.topics.some((t) => t.id === v.topic)), 'every video has a title, channel, both notes and a topic');
  assert.ok(data.items.some((v) => v.p === 'bili') && data.items.some((v) => v.lang === 'zh'), 'Chinese material from Bilibili');
  const visible = () => p.$$eval('.vd-card:not([hidden])', (c) => c.map((x) => x.dataset.id));
  assert.equal((await visible()).length, n);
  assert.equal(await p.locator('.vd-group').count(), new Set(data.items.map((v) => v.topic)).size);
  // Every card links to its original on YouTube or Bilibili; external links open safely.
  const noLink = await p.$$eval('.vd-card', (cards) => cards.filter((c) => !c.querySelector('.vd-link a[href^="https://www.youtube.com/"], .vd-link a[href^="https://www.bilibili.com/video/"]')).map((c) => c.dataset.id));
  assert.deepEqual(noLink, []);
  const unsafe = await p.$$eval('main a[href]', (a) => a.filter((x) => new URL(x.href).origin !== location.origin && (x.target !== '_blank' || !/noopener/.test(x.rel) || !/noreferrer/.test(x.rel))).map((x) => x.href));
  assert.deepEqual(unsafe, []);
  // Covers: thumbs/<id>.jpg is not in git, so locally the platform's image stands in (YouTube always has one).
  const yt = data.items.find((v) => v.p === 'yt' && v.k === 'video' && v.embed !== false);
  await p.locator(`#v-${yt.id} img`).scrollIntoViewIfNeeded();
  await p.waitForFunction((id) => document.querySelector(`#v-${id} img`)?.src.startsWith('https://i.ytimg.com/'), yt.id);
  assert.equal(await p.locator('iframe').count(), 0, 'no player before a click');
  // Click: the player loads in place, from youtube-nocookie, and the card gets an address.
  await p.click(`#v-${yt.id} button.vd-cover`);
  const src = await p.getAttribute(`#v-${yt.id} iframe`, 'src');
  assert.match(src, new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${yt.id}\\?`));
  assert.match(await p.getAttribute(`#v-${yt.id} iframe`, 'allow'), /fullscreen/);
  assert.match(p.url(), new RegExp(`#v-${yt.id}$`));
  const bili = data.items.find((v) => v.p === 'bili' && v.embed !== false);
  await p.click(`#v-${bili.id} button.vd-cover`);
  assert.match(await p.getAttribute(`#v-${bili.id} iframe`, 'src'), new RegExp(`^https://player\\.bilibili\\.com/player\\.html\\?bvid=${bili.id}&`));
  // A video whose platform does not allow embedding opens the original instead.
  const off = data.items.find((v) => v.embed === false);
  if (off) assert.equal(await p.getAttribute(`#v-${off.id} .vd-cover`, 'target'), '_blank');
  // Filters alone and combined, search, the empty state and its reset.
  await p.selectOption('#vd-platform', 'bili');
  assert.ok((await visible()).every((id) => data.items.find((v) => v.id === id).p === 'bili'));
  await p.selectOption('#vd-platform', '');
  await p.selectOption('#vd-lang', 'zh');
  const zh = await visible();
  assert.ok(zh.length && zh.every((id) => { const v = data.items.find((x) => x.id === id); return v.lang === 'zh' || v.subs === 'zh'; }));
  await p.selectOption('#vd-level', 'intro');
  assert.ok((await visible()).every((id) => data.items.find((v) => v.id === id).level === 'intro'));
  await p.click('#vd-reset');
  await p.fill('#vd-q', 'ORCA');
  const orca = await visible();
  assert.ok(orca.length >= 1 && orca.length < n, `${orca.length} ORCA videos`);
  await p.fill('#vd-q', 'zzzzqqq');
  assert.ok(await p.locator('#vd-empty').isVisible(), 'empty-state message');
  await p.click('#vd-empty-reset');
  assert.equal((await visible()).length, n);
  await finish(p);
  // An address opens straight to its video, even past a filter; with no cover at all a placeholder is drawn.
  const a = await open();
  await stub(a, false);
  const last = data.items[data.items.length - 1];
  await go(a, `/videos/index.html#v-${last.id}`);
  assert.ok(await a.locator(`#v-${last.id}`).isVisible());
  await a.waitForSelector(`#v-${last.id} .vd-cover.no-img .vd-ph`);
  await finish(a);
  // Desktop app: no embedded players; every cover opens the original in the system browser.
  const dsk = await open({ init: () => { window.__MOLASTRIA_DESKTOP__ = true; } });
  await stub(dsk, true);
  await go(dsk, '/videos/index.html');
  assert.equal(await dsk.locator('button.vd-cover').count(), 0);
  assert.equal(await dsk.locator('a.vd-cover[target=_blank]').count(), n);
  assert.ok(await dsk.locator('#vd-desktop').isVisible());
  await finish(dsk);
  // English: notes, facts and topic names are English (titles and channels keep their original language).
  const en = await open();
  await stub(en, true);
  await go(en, '/videos/index.html?lang=en');
  const left = await en.evaluate(() => [...document.querySelectorAll('.vd-note, .vd-facts, .vd-group h3, #vd-jump, #vd-topic option, #vd-lang option, #vd-level option, #vd-platform option')].flatMap((x) => x.textContent.match(/[㐀-鿿]+/g) || []));
  assert.deepEqual(left, []);
  await finish(en);
});

check('decor: the home logo loop and the download intro film play muted, are hidden decoration, and stay still under reduced motion', async () => {
  for (const [path, sel, loop] of [['/index.html', '.brand-loop video', true], ['/download/index.html', '.dl-intro video', false]]) {
    const p = await open();
    await go(p, path);
    await p.waitForFunction((s) => document.querySelector(s).currentTime > 0.5, sel);
    const v = await p.$eval(sel, (el) => ({ muted: el.muted, loop: el.loop, controls: el.controls, hidden: el.parentElement.getAttribute('aria-hidden'), tab: el.tabIndex }));
    assert.deepEqual(v, { muted: true, loop, controls: false, hidden: 'true', tab: -1 }, path);
    await finish(p);
    const still = await open({ reducedMotion: 'reduce' });
    await go(still, path);
    assert.deepEqual(await still.$eval(sel, (el) => [el.currentSrc, el.paused, !!el.getAttribute('poster')]), ['', true, true], `${path} under reduced motion`);
    await finish(still);
  }
});

check('AI panel entrance: the chosen mascot hops in on open (no video), Esc skips it, the logo-animation switch and the picker switch turn it off', async () => {
  const p = await open();
  let films = 0;
  p.on('request', (r) => { if (r.url().includes('intro.mp4')) films++; });
  await go(p, '/index.html');
  await p.click('#cr-ai');
  await p.waitForSelector('.cai-film[data-state=play] .cai-hero[data-mascot=astra] svg');
  assert.match(await text(p, '.cai-film .cai-hello'), /MolAstria/);
  assert.equal(films, 0, 'the old film is not fetched');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.querySelector('.cai-film').hidden);
  assert.equal(await p.$eval('.cai-drawer', (d) => d.dataset.open), 'true', 'Esc skips the entrance, not the panel');
  // it ends by itself after about five seconds
  await p.click('.cai-mascots ~ .cai-id, .cai-head h2').catch(() => {});
  await p.click('.cai-orb-btn');
  await p.click('[data-intro-play]');
  await p.waitForSelector('.cai-film[data-state=play]');
  await p.waitForFunction(() => document.querySelector('.cai-film').hidden, null, { timeout: 7000 });
  // the switch in the mascot picker turns it off and is remembered
  await p.click('.cai-orb-btn');
  await p.uncheck('[data-intro-toggle]');
  await p.keyboard.press('Escape');
  await p.keyboard.press('Escape');
  await p.reload({ waitUntil: 'networkidle' });
  await p.click('#cr-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  await p.waitForTimeout(300);
  assert.equal(await p.$('.cai-film:not([hidden])'), null, 'no entrance with the picker switch off');
  await p.evaluate(() => localStorage.removeItem('molastria-ai-intro'));
  // the site's logo-animation switch still turns it off
  await p.keyboard.press('Escape');
  await p.click('#cr-bg');
  await p.uncheck('.cr-bgpick input[data-logo-motion]');
  await p.keyboard.press('Escape');
  await p.reload({ waitUntil: 'networkidle' });
  await p.click('#cr-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  await p.waitForTimeout(300);
  assert.equal(await p.$('.cai-film:not([hidden])'), null, 'no entrance with the logo-animation switch off');
  await go(p, '/download/index.html');
  assert.deepEqual(await p.$eval('.dl-intro video', (v) => [v.currentSrc, !!v.getAttribute('poster')]), ['', true], 'download film: poster only');
  await finish(p);
  const still = await open({ reducedMotion: 'reduce' });
  await go(still, '/index.html');
  await still.click('#cr-ai');
  await still.waitForSelector('.cai-drawer[data-open=true]');
  assert.equal(await still.$('.cai-film'), null, 'no entrance under reduced motion');
  await finish(still);
});

check('AI mascots: the header face opens a picker of six; the choice changes every face, labels answers MolAstria and is remembered', async () => {
  const p = await open({ init: () => { try { localStorage.setItem('molastria-ai-intro', 'off'); } catch {} } });
  await go(p, '/index.html');
  await p.click('#cr-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  await p.click('.cai-orb-btn');
  assert.equal(await p.locator('.cai-mascots [data-mascot-pick]').count(), 6);
  assert.equal(await p.getAttribute('.cai-mascots [data-mascot-pick=astra]', 'aria-checked'), 'true', 'the classic one by default');
  await p.click('.cai-mascots [data-mascot-pick=owl]');
  assert.equal(await p.isHidden('.cai-mascots'), true);
  assert.deepEqual([...new Set(await p.$$eval('.cai-drawer .cai-orb:not(.cai-mascots .cai-orb)', (o) => o.map((x) => x.dataset.mascot)))], ['owl']);
  await p.reload({ waitUntil: 'networkidle' });
  await p.click('#cr-ai');
  await p.waitForSelector('.cai-drawer[data-open=true]');
  assert.equal(await p.getAttribute('.cai-orb-btn', 'data-mascot'), 'owl', 'remembered');
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-ai-mascot')), 'owl');
  await finish(p);
});

check('download card: bottom-left on web pages, × folds it and is remembered, absent on the download page and phones', async () => {
  const p = await open();
  await go(p, '/index.html');
  assert.match(await p.getAttribute('.cr-dl-card', 'href'), /download\/index\.html$/);
  await p.click('.cr-dl-x');
  await p.reload({ waitUntil: 'networkidle' });
  assert.equal(await p.$eval('.cr-dl', (d) => d.dataset.folded), 'true');
  await p.click('.cr-dl-fab');
  assert.equal(await p.$eval('.cr-dl', (d) => d.dataset.folded), 'false');
  await go(p, '/download/index.html');
  assert.equal(await p.$('.cr-dl'), null);
  await finish(p);
  const phone = await open({ viewport: { width: 390, height: 844 } });
  await go(phone, '/index.html');
  assert.equal(await phone.isVisible('.cr-dl'), false);
  await finish(phone);
});

check('PWA: no service worker on localhost, valid manifest, tablets get 添加到主屏幕 linking to the download page steps', async () => {
  // sw.js never registers on localhost (it would bypass the page.route mocks here); the full PWA checks need a secure
  // non-local host and the build-seo.ts head tags, see docs/RUNBOOK.md.
  const p = await open();
  await go(p, '/index.html');
  await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length)), 0);
  const m = await (await fetch(`${SITE}/manifest.webmanifest`)).json();
  assert.deepEqual([m.short_name, m.display, m.start_url, m.scope, m.icons.map((i) => `${i.sizes} ${i.purpose}`)], ['MolAstria', 'standalone', './', './', ['192x192 any', '512x512 any', '512x512 maskable']]);
  for (const i of [...m.icons, { src: 'assets/pwa/apple-touch-icon.png' }, { src: 'sw.js' }, { src: 'offline.html' }]) assert.equal((await fetch(`${SITE}/${i.src}`)).status, 200, i.src);
  await finish(p);
  // iPadOS Safari reports a Mac user agent; its touch screen (maxTouchPoints 5) tells it apart.
  const iPad = { viewport: { width: 820, height: 1180 }, hasTouch: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' };
  const tablet = await open({ ...iPad, init: () => Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 }) });
  await go(tablet, '/index.html');
  assert.equal(await tablet.textContent('.cr-dl[data-variant=home] .cr-dl-tx b'), '添加到主屏幕');
  await tablet.click('.cr-dl-card');
  await tablet.waitForURL(/download\/index\.html#home-screen$/);
  assert.ok(await tablet.isVisible('#home-screen'));
  assert.equal(await tablet.isVisible('.pwa-install'), false, 'install button only after beforeinstallprompt');
  await finish(tablet);
  const app = await open({ ...iPad, init: () => { Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 }); Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); } });
  await go(app, '/index.html');
  assert.equal(await app.$('.cr-dl'), null, 'no card when the site already runs from the home screen');
  await finish(app);
});

check('home: the 收藏夹 button counts favourites from home and the database page, opens them in place, and removes from both', async () => {
  const p = await open();
  await go(p, '/index.html');
  assert.equal(await text(p, '#fav-count'), '0');
  await p.click('#fav-open');
  assert.equal(await p.inputValue('#collection'), 'saved');
  assert.ok(await p.isVisible('#empty-saved'), 'empty state explains how to save');
  // Saved on the database page (ORCA is atlas #80), then the home page reloaded.
  await go(p, '/atlas/index.html#resources/80');
  await p.click('#dialog-save');
  await go(p, '/index.html');
  assert.equal(await text(p, '#fav-count'), '1');
  await p.click('#fav-open');
  assert.match(await text(p, '.result-row h3'), /ORCA/);
  await p.click('.result-row .save');
  assert.equal(await text(p, '#fav-count'), '0');
  assert.equal(await p.evaluate(() => localStorage.getItem('chemdb-atlas-saved')), '[]');
  assert.ok(await p.isVisible('#empty-saved'));
  await finish(p);
});

check('fundamental science: nav entry, pillars and tabs, MathML formulas, three working demos, references, English', async () => {
  const p = await open();
  await go(p, '/fundamental-science/index.html');
  const setRange = (sel, v) => p.$eval(sel, (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
  assert.equal(await p.locator('.cr-header a[data-id=fundamental]').count(), 1, 'nav entry');
  assert.equal(await p.locator('.fs-pillar').count(), 5);
  assert.equal(await p.locator('.fs-tab').count(), 6);
  assert.equal(await p.locator('.fs-dir').count(), 3);
  assert.equal(await p.locator('.fs-dir .fs-st[data-s=proposed]').count(), 3, 'every priority direction is labelled proposed');
  assert.ok(await p.locator('#s-qm math').count() >= 4, 'MathML formulas render');
  assert.equal(await p.locator('#s-qm .fs-topic').count(), 10);
  // A pillar card opens its tab; the FCI calculator counts exactly.
  await p.click('.fs-pillar[data-tab=math]');
  assert.equal(await p.isVisible('#s-math'), true);
  assert.equal(await p.isVisible('#s-qm'), false);
  assert.match(await text(p, '#calc-out'), /847,660,528/);
  await p.fill('#calc-n', '14'); await p.fill('#calc-k', '60');
  assert.match(await text(p, '#calc-out'), /17,345,898,649,800[\s\S]*4,144,481,640,000/); // C(60,14) and C(30,7)², checked with Python's math.comb
  // Demo 3: Berry phase π around the conical intersection, 0 when the loop misses it, Ω/2 once Δ opens a gap.
  assert.match(await text(p, '#b-read'), /1\.0000 π/);
  await setRange('#b-cx', 1.2); await setRange('#b-r', 0.5);
  assert.match(await text(p, '#b-read'), /0\.0000 π/);
  await setRange('#b-cx', 0); await setRange('#b-delta', 0.3);
  const ci = await text(p, '#b-read');
  const [num, ana] = [...ci.matchAll(/(-?\d\.\d{4}) π/g)].map((m) => Math.abs(Number(m[1])));
  assert.ok(Math.abs(num - ana) < 1e-3 && num < 1, `numerical vs analytic Berry phase: ${ci}`);
  // Demo 1: one localization picks a packet when the peaks are far apart compared with r_C.
  await p.click('#g-hit');
  const left = Number((await text(p, '#g-read')).match(/(\d\.\d{3})/)[1]);
  assert.ok(left < 0.01 || left > 0.99, `left-packet probability after a hit: ${left}`);
  // Demo 2: ammonia oscillates with a 42 ps period; strong decoherence freezes it.
  assert.match(await text(p, '#c-read'), /42 ps/);
  await setRange('#c-env', 13);
  assert.match(await text(p, '#c-read'), /过阻尼/);
  // Theory explorer and library filters.
  await p.click('.fs-chip[data-kind=modification]');
  assert.equal(await p.locator('.fs-theory').count(), 3);
  assert.equal(await p.locator('.fs-ref').count(), 36);
  await p.selectOption('#fs-lib-status', 'hypothesis');
  assert.equal(await p.locator('.fs-ref').count(), 4); // GRW 1986, Pearle 1989, GPR 1990, Smirne & Bassi 2015
  assert.match(await p.locator('.fs-ref').first().locator('a[href^="https://doi.org/"]').getAttribute('href'), /^https:\/\/doi\.org\/10\./);
  await finish(p);
  // English: content comes from the English half of the data, interface text from the dictionary.
  const e = await open();
  await go(e, '/fundamental-science/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.match(await text(e, '#fs-h1'), /Advancing Fundamental Science/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('display settings: scale, reading size and typeface apply, carry to other pages, are capped in narrow windows and reset', async () => {
  const p = await open({ viewport: { width: 1280, height: 900 } });
  await go(p, '/index.html');
  await p.click('#cr-disp');
  await p.waitForSelector('.cr-disp[data-open=true]');
  await p.click('[data-step=zoom][data-dir="1"]');
  await p.click('[data-step=text][data-dir="1"]');
  await p.click('[data-font-id=serif]');
  const s = () => p.evaluate(() => ({ zoom: document.documentElement.style.zoom, text: getComputedStyle(document.querySelector('main')).zoom, font: getComputedStyle(document.body).fontFamily }));
  let v = await s();
  assert.equal(v.zoom, '1.1');
  assert.equal(v.text, '1.1');
  assert.match(v.font, /Songti|Serif/);
  await p.keyboard.press('Escape');
  assert.equal(await p.getAttribute('#cr-disp', 'aria-expanded'), 'false');
  await go(p, '/journals/index.html');
  v = await s();
  assert.deepEqual([v.zoom, v.text], ['1.1', '1.1'], 'kept on the next page');
  // A narrow window cannot hold 150 % × 140 %: the reading size gives way, nothing scrolls sideways, the panel says why.
  await p.evaluate(() => { localStorage.setItem('molastria-zoom', '1.5'); localStorage.setItem('molastria-text', '1.4'); });
  await p.setViewportSize({ width: 820, height: 900 });
  await go(p, '/index.html');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  await p.click('#cr-disp');
  assert.equal(await p.isVisible('.cr-disp-note'), true);
  assert.equal(await p.isDisabled('[data-step=text][data-dir="1"]'), true);
  await p.click('.cr-disp-reset');
  v = await s();
  assert.deepEqual([v.zoom, v.text], ['', '1']);
  assert.doesNotMatch(v.font, /Songti/);
  await finish(p);
});

check('weekly picks: the page, the homepage card and the pricing page show the first five picks with comments; an empty week waits politely', async () => {
  const issue = {
    week: '2026-11-02', overview_zh: '本周概览：机器学习势和激发态各有亮点。', overview_en: 'This week: machine-learning potentials and excited states.', total: 10,
    items: Array.from({ length: 5 }, (_, i) => ({ source: i % 2 ? 'arXiv' : 'ChemRxiv', title: `Paper ${i + 1}`, url: `https://doi.org/10.1/p${i + 1}`, date: '2026-10-30', authors: 'A. Author', why_zh: `中文解读 ${i + 1}`, why_en: `English comment ${i + 1}` })),
  };
  const p = await open();
  let body = issue;
  await p.route(`${API}/digest/preview`, (route) => route.fulfill({ json: body }));
  await go(p, '/digest/index.html');
  await p.waitForSelector('#dg-letter:not([hidden])');
  assert.equal(await p.locator('.dg-pick').count(), 5);
  assert.match(await text(p, '.dg-pick:first-child .dg-why'), /中文解读 1/);
  assert.match(await text(p, '#dg-overview'), /机器学习势/);
  assert.match(await text(p, '#dg-more'), /还有 5 篇/);
  assert.match(await text(p, '#dg-issue'), /下一期/);
  assert.equal(await p.getAttribute('.cr-links a[data-id=digest]', 'aria-current'), 'page');
  await go(p, '/digest/index.html?lang=en');
  await p.waitForFunction(() => /English comment 1/.test(document.querySelector('.dg-pick .dg-why')?.textContent || ''));
  await p.evaluate(() => localStorage.setItem('chemhub-lang', 'zh')); // ?lang=en is remembered; back to Chinese
  await go(p, '/index.html');
  await p.waitForSelector('#digest-card:not([hidden])');
  assert.equal(await p.locator('#digest-card .dc-list li').count(), 3);
  await go(p, '/pro/index.html');
  await p.waitForSelector('#digest-preview:not([hidden])');
  assert.match(await text(p, '#digest-preview-list li:first-child p'), /中文解读 1/);
  body = { items: [], total: 0 };
  await go(p, '/digest/index.html');
  await p.waitForSelector('#dg-waiting:not([hidden])');
  assert.equal(await p.isHidden('#dg-letter'), true);
  await go(p, '/index.html');
  await p.waitForTimeout(400);
  assert.equal(await p.isHidden('#digest-card'), true, 'no card without an issue');
  await finish(p);
});

check('brand notice: every page carries one copyright line linking to TRADEMARKS.md; the full-screen radar page does not', async () => {
  const p = await open();
  for (const path of ['/index.html', '/manual/index.html', '/digest/index.html', '/pro/account.html', '/qchem/index.html']) {
    await go(p, path);
    assert.equal(await p.locator('.cr-legal').count(), 1, path);
    // The line now starts with the About link (晨光科技), so look for the TRADEMARKS.md link itself.
    assert.equal(await p.locator('.cr-legal a[href$="TRADEMARKS.md"]').count(), 1, path);
  }
  await go(p, '/radar/index.html');
  assert.equal(await p.locator('.cr-legal').count(), 0, 'not on the radar page');
  await finish(p);
});

check('nav order: a long press opens the glass panel without leaving the page; drag and arrow keys reorder; kept after reload; reset', async () => {
  const p = await open();
  await go(p, '/manual/index.html');
  const order = () => p.$$eval('.cr-links > a[data-id]:not(.cr-pro-link), .cr-more-menu a[data-id]', (a) => a.map((x) => x.dataset.id));
  const url = p.url();
  const box = await (await p.$('.cr-links > a[data-id="journals"]')).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(700);
  await p.mouse.up();
  await p.waitForSelector('.cr-arrange.open');
  assert.equal(p.url(), url, 'the long press did not open the page');
  assert.equal(await p.evaluate(() => document.activeElement.dataset.id), 'journals', 'the pressed module has focus');
  // drag journals onto the first tile
  const from = await (await p.$('.cr-arr-tile[data-id="journals"]')).boundingBox(), to = await (await p.$('.cr-arr-tile[data-id="search"]')).boundingBox();
  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(from.x + from.width / 2 + ((to.x + 8 - from.x - from.width / 2) * i) / 10, from.y + from.height / 2 + ((to.y + to.height / 2 - from.y - from.height / 2) * i) / 10);
  await p.mouse.up();
  assert.deepEqual((await order()).slice(0, 2), ['journals', 'search'], 'dragged to the front');
  await p.keyboard.press('ArrowRight');
  assert.deepEqual((await order()).slice(0, 2), ['search', 'journals'], 'moved one step with the keyboard');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.cr-arrange', { state: 'hidden' });
  await go(p, '/index.html');
  assert.deepEqual((await order()).slice(0, 3), ['search', 'journals', 'network'], 'kept on the next page');
  // the display panel leads here too; reset brings back the default order
  await p.click('#cr-disp');
  await p.click('.cr-disp-arr');
  await p.waitForSelector('.cr-arrange.open');
  await p.click('.cr-arr-reset');
  await p.click('.cr-arr-done');
  assert.deepEqual((await order()).slice(0, 3), ['search', 'network', 'manual']);
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-nav-order')), null);
  await finish(p);
});

check('nav order: modules are dragged straight along the header (mouse at once, touch after a hold); a plain click still opens the page', async () => {
  const p = await open();
  await go(p, '/manual/index.html');
  const row = () => p.$$eval('.cr-links > a[data-id]:not(.cr-pro-link)', (a) => a.filter((x) => x.offsetWidth).map((x) => x.dataset.id));
  const url = p.url();
  const from = await (await p.$('.cr-links > a[data-id="search"]')).boundingBox(), to = await (await p.$('.cr-links > a[data-id="atlas"]')).boundingBox();
  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(from.x + from.width / 2 + ((to.x + to.width / 2 + 4 - from.x - from.width / 2) * i) / 12, from.y + from.height / 2 + 1);
  assert.ok(await p.locator('.cr-links a.cr-lifted[data-id="search"]').count(), 'the module is lifted as glass');
  await p.mouse.up();
  assert.deepEqual((await row()).slice(0, 5), ['network', 'manual', 'videos', 'atlas', 'search'], 'dropped after 数据库');
  assert.equal(p.url(), url, 'the drag did not open the page');
  assert.equal(await p.locator('.cr-arrange.open').count(), 0, 'no panel after a drag');
  assert.deepEqual(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-nav-order'))).slice(0, 5), ['network', 'manual', 'videos', 'atlas', 'search']);
  await p.click('.cr-links > a[data-id="search"]');
  await p.waitForURL(/\/index\.html/);
  assert.deepEqual((await row()).slice(0, 5), ['network', 'manual', 'videos', 'atlas', 'search'], 'kept on the next page');
  await p.evaluate(() => localStorage.removeItem('molastria-nav-order'));
  await finish(p);
  // touch: a quick swipe leaves the order alone, a hold then a slide moves the module
  const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await go(t, '/index.html');
  const cdp = await t.context().newCDPSession(t);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const ids = () => t.$$eval('.cr-links > a[data-id]', (a) => a.map((x) => x.dataset.id).slice(0, 3));
  const b = await (await t.$('.cr-links > a[data-id="search"]')).boundingBox();
  let x = b.x + b.width / 2;
  await touch('touchStart', x, b.y + b.height / 2);
  for (let i = 0; i < 6; i++) await touch('touchMove', (x += 12), b.y + b.height / 2);
  await touch('touchEnd');
  assert.deepEqual(await ids(), ['search', 'network', 'manual'], 'a swipe does not reorder');
  await t.waitForTimeout(800); // let the swipe's fling end: a touch during it cannot hold the page still
  x = b.x + b.width / 2;
  await touch('touchStart', x, b.y + b.height / 2);
  await t.waitForTimeout(600);
  for (let i = 0; i < 15; i++) { await touch('touchMove', (x += 10), b.y + b.height / 2); await t.waitForTimeout(16); }
  await touch('touchEnd');
  assert.deepEqual(await ids(), ['network', 'manual', 'search'], 'hold and slide reorders');
  await finish(t);
});

check('language switch: every page stays where it was (radar view, calculator tab, tabs, filters, scroll)', async () => {
  const p = await open();
  const flip = async () => { await Promise.all([p.waitForEvent('load'), p.$eval('#cr-lang', (b) => b.click())]); await p.waitForTimeout(900); }; // a DOM click: Playwright's own would scroll the page first
  await go(p, '/radar/index.html');
  const radar = () => p.frames().find((f) => /radar\/app/.test(f.url()));
  await p.waitForFunction(() => document.getElementById('radar-frame').contentDocument?.readyState === 'complete');
  await radar().evaluate(() => { location.hash = '#/saved'; });
  await p.waitForURL(/#\/saved$/);
  await flip();
  assert.equal(await p.evaluate(() => document.documentElement.lang), 'en');
  assert.match(p.url(), /radar\/index\.html#\/saved$/, 'radar page and view kept');
  await p.waitForFunction(() => /#\/saved$/.test(document.getElementById('radar-frame').contentWindow.location.hash));
  await go(p, '/qchem/index.html#lab');
  await p.waitForFunction(() => document.getElementById('qchem-frame').contentDocument?.querySelector('#tabs [data-v="qd"]'));
  await p.frames().find((f) => /qchem\/app/.test(f.url())).click('#tabs [data-v="qd"]');
  assert.match(p.url(), /#qd$/);
  await flip();
  assert.equal(await p.frames().find((f) => /qchem\/app/.test(f.url())).evaluate(() => document.querySelector('#tabs .on')?.dataset.v), 'qd', 'calculator tab kept');
  await go(p, '/lab/index.html');
  await p.click('[data-tab="pareto"]');
  await flip();
  assert.equal(await p.$eval('[role=tab][aria-selected=true]', (b) => b.dataset.tab), 'pareto', 'lab tab kept');
  await go(p, '/journals/index.html');
  const cat = await p.$eval('#jr-cat', (s) => s.options[2].value);
  await p.selectOption('#jr-cat', cat);
  await p.fill('#jr-q', 'chem');
  await p.evaluate(() => scrollTo({ top: 400, behavior: 'instant' }));
  await flip();
  assert.deepEqual(await p.evaluate(() => [document.querySelector('#jr-cat').value, document.querySelector('#jr-q').value]), [cat, 'chem'], 'filters kept');
  assert.ok(await p.evaluate(() => scrollY > 300), 'scroll kept');
  await finish(p);
});

check('arrows: the site draws its own metallic arrow icons, no ↗ characters are left, the 收藏夹 button is gold', async () => {
  for (const path of ['/index.html', '/hub/index.html', '/train/index.html', '/manual/index.html', '/fundamental-science/index.html']) {
    const p = await open();
    await go(p, path);
    assert.ok(await p.locator('.ico-ext').count() > 0, `${path}: arrow icons`);
    assert.equal(await p.evaluate(() => document.body.innerText.includes('↗')), false, `${path}: no ↗ characters`);
    assert.match(await p.$eval('.ico-ext', (i) => getComputedStyle(i).backgroundImage), /linear-gradient/, `${path}: gold fill`);
    if (path === '/index.html') assert.match(await p.$eval('#fav-open', (b) => getComputedStyle(b).backgroundImage), /linear-gradient/);
    await finish(p);
  }
});

check('about: Morning Glory page, every non-MolAstria direction labelled planned, footer link, English', async () => {
  const p = await open();
  await go(p, '/about/index.html');
  assert.match(await text(p, 'h1'), /Intelligence Beyond Boundaries/);
  assert.match(await text(p, '.mg-facts'), /16513778 Canada Inc\.[\s\S]*Toronto, Ontario, Canada/);
  assert.equal(await p.locator('.mg-branches .mg-node').count(), 4);
  assert.equal(await p.locator('.mg-branches .mg-tag.live').count(), 1, 'only MolAstria is live');
  assert.equal(await p.locator('.mg-dir').count(), 4);
  assert.equal(await p.locator('.mg-dir .mg-plan').count(), 4, 'every direction says what is still planned');
  assert.equal(await p.locator('img[src*="openai.com"]').count(), 0);
  // Every page's footer line links here.
  await go(p, '/download/index.html');
  await p.click('.cr-legal a[href*="about/"]');
  await p.waitForURL(/\/about\//);
  await go(p, '/about/index.html?lang=en');
  await p.waitForFunction(() => !document.documentElement.dataset.i18n);
  assert.match(await text(p, '.lead-left'), /AI & Scientific Computing project of Morning Glory/);
  assert.match(await text(p, '.cr-legal'), /A Morning Glory project/);
  await finish(p);
});

check('phone width: no sideways scrolling', async () => {
  for (const path of ['/index.html', '/manual/index.html', '/journals/index.html', '/scimodels/index.html', '/videos/index.html', '/fundamental-science/index.html', '/pro/index.html', '/pro/account.html', '/hub/index.html', '/radar/index.html', '/research-atlas/index.html', '/qchem/index.html', '/digest/index.html', '/meta/index.html', '/models/index.html', '/download/index.html', '/about/index.html']) {
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
  for (let i = 0; REAL && i < 120; i++) { // server.py --fake takes a few seconds to import RDKit and ASE
    if ((await (await fetch(`${API}/uma/health`, { headers: { Origin: SITE } })).json().catch(() => ({}))).online) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (REAL) console.log(`models checks run against tools/uma-server/server.py --fake (${UMA_PY})`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, fn] of checks) {
    if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
    try { await fn(); console.log(`ok   ${name}`); }
    catch (e) { failed++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 24).join('\n     ')}`); }
  }
} finally {
  await browser?.close();
  stopServers();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
