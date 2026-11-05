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
  for (const path of ['/index.html', '/atlas/index.html', '/hub/index.html', '/hub/network.html', '/lab/index.html', '/meta/index.html', '/train/index.html', '/pro/index.html', '/pro/account.html', '/download/index.html', '/radar/index.html', '/qchem/index.html']) {
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
  // Everything marked as available has to exist; update this list when a feature really ships.
  const live = await p.$$eval('.plan .st.ok', (els) => els.map((e) => e.parentElement.textContent.replace(e.textContent, '').trim()));
  assert.deepEqual(live, ['AI 托管额度：免配 key，每月 300 次带出处问答', '每周精选：ChemRxiv、arXiv 和计算化学期刊的新论文，附解读和邮件推送', '每个席位每月 300 次 AI 托管额度', '在账号页添加、移除成员', 'Stripe 收据可用于报销']);
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

check('weekly picks: the admin builds an issue, Pro reads and subscribes, visitors see titles', async () => {
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
  assert.equal(await visitor.$$eval('#digest-preview li p', (l) => l.length), 0, 'no comments for visitors');
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

check('QChem Web: loads in its frame, computes a quantum dot, and follows the site language', async () => {
  const p = await open();
  await go(p, '/qchem/index.html#qd');
  assert.equal(await p.getAttribute('.cr-links a[data-id=qchem]', 'aria-current'), 'page');
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
  assert.deepEqual(started.params, { smiles: 'O=C1OCC(F)O1', name: 'FEC', job: 'ipea', model: 'uma-s-1p2p1', device: 'cuda', charge: 0, spin: 1, with_m: true });
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
  for (const path of ['/index.html', '/pro/index.html', '/pro/account.html', '/hub/index.html', '/radar/index.html', '/qchem/index.html', '/meta/index.html']) {
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
    catch (e) { failed++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 24).join('\n     ')}`); }
  }
} finally {
  await browser?.close();
  stopServers();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
