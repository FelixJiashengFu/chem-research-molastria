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
async function open({ init, initArg, ...options } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', ...options });
  await ctx.route('**/pay/config.js', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(/accountApi: '[^']*'/, `accountApi: '${API}'`) });
  });
  // 联网搜索 (websearch/web.js) asks these from the browser: answer with small fakes so checks stay offline and free.
  await ctx.route(/^https:\/\/(api\.openalex\.org|api\.crossref\.org|(en|zh)\.wikipedia\.org\/w\/api\.php|pubchem\.ncbi\.nlm\.nih\.gov\/rest|api\.github\.com\/search|openlibrary\.org\/api\/books)/, (route) => route.fulfill(fakeWeb(route.request().url())));
  if (init) await ctx.addInitScript(init, initArg);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  return page;
}
/** Fake answers for the web search sources; ?fail=… in the page's query is not visible here, so failures are set per test. */
const webFakes = { openalex429: false, calls: [] };
function fakeWeb(url) {
  webFakes.calls.push(url);
  const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  const q = decodeURIComponent((url.match(/(?:search|query|srsearch|gsrsearch|q)=([^&]*)/) || [])[1] || '').replace(/\+/g, ' ');
  if (url.includes('openalex')) return webFakes.openalex429 ? json({ error: 'Rate limit exceeded' }, 429) : json({ results: [{ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.9999/fake.1', display_name: `A review of ${q}`, publication_year: 2024, cited_by_count: 321, primary_location: { source: { display_name: 'Fake Journal of Chemistry' } } }] });
  if (url.includes('crossref')) return json({ message: { items: [{ DOI: '10.9999/cross.1', title: [`${q} in practice`], 'container-title': ['Crossref Letters'], issued: { 'date-parts': [[2023]] }, 'is-referenced-by-count': 12 }] } });
  if (url.includes('zh.wikipedia')) return json({ query: { pages: [{ title: '乙酰水杨酸', index: 1, extract: '乙酰水杨酸，俗称阿司匹林，是一种药物。', langlinks: [{ lang: 'en', title: 'Aspirin' }] }] } });
  if (url.includes('wikipedia')) return json({ query: { pages: [{ title: q.replace(/^./, (c) => c.toUpperCase()), index: 1, extract: `${q} is a fake article.` }] } });
  if (url.includes('pubchem')) return /aspirin/i.test(url) ? json({ PropertyTable: { Properties: [{ CID: 2244, Title: 'Aspirin', MolecularFormula: 'C9H8O4', MolecularWeight: '180.16' }] } }) : json({ Fault: { Code: 'PUGREST.NotFound' } }, 404);
  if (url.includes('openlibrary')) return /9780486691862/.test(url) ? json({ 'ISBN:9780486691862': { title: 'Modern quantum chemistry', authors: [{ name: 'Attila Szabo' }, { name: 'Neil S. Ostlund' }], publishers: [{ name: 'Dover Publications' }], publish_date: '1996' } }) : json({});
  if (url.includes('github')) return json({ items: [{ full_name: 'pyscf/pyscf', html_url: 'https://github.com/pyscf/pyscf', description: `Python-based ${q}`, stargazers_count: 1500, language: 'Python' }] });
  return json({}, 404);
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
  for (const path of ['/index.html', '/atlas/index.html', '/manual/index.html', '/ai-math/index.html', '/journals/index.html', '/scimodels/index.html', '/videos/index.html', '/hub/index.html', '/hub/network.html', '/lab/index.html', '/meta/index.html', '/models/index.html', '/train/index.html', '/pro/index.html', '/pro/account.html', '/download/index.html', '/about/index.html', '/api/index.html', '/review/index.html', '/code/index.html', '/radar/index.html', '/research-atlas/index.html', '/qchem/index.html', '/digest/index.html', '/learn/index.html', '/open-models/index.html', '/open-models/deepmind/index.html', '/programming/index.html', '/vision/index.html', '/chat/index.html', '/pet/index.html', '/shelf/index.html']) {
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

check('home entrance: full on a first visit, brief in a later session, none within a session, on deep links or under reduced motion; skippable; the mark lands on the header', async () => {
  // Automated browsers get no entrance (navigator.webdriver), so every other check sees the plain page.
  let p = await open();
  await go(p, '/index.html');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.entrance), undefined);
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('entrance')).display), 'none');
  await finish(p);
  // A person's first visit: the full entrance, then the page as it always was.
  const human = () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  p = await open({ init: human });
  await p.goto(SITE + '/index.html', { waitUntil: 'commit' });
  await p.waitForFunction(() => document.documentElement.dataset.entranceState === 'playing');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.entrance), 'full');
  const box = await p.evaluate(() => { const r = document.getElementById('entrance').getBoundingClientRect(); return [r.width, r.height, innerWidth, innerHeight]; });
  assert.deepEqual(box.slice(0, 2), box.slice(2), 'the sheet covers the window');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.intro-copy h1')).opacity), '0', 'the hero waits behind the sheet');
  await p.waitForFunction(() => document.documentElement.dataset.entranceState === 'done', null, { timeout: 8000 });
  assert.equal(await p.$('#entrance'), null);
  await p.waitForFunction(() => getComputedStyle(document.querySelector('.metrics')).opacity === '1', null, { timeout: 5000 });
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.intro-copy h1')).transform), 'none');
  // Same session: nothing. A later session in the same browser: the brief one. Deep links: nothing.
  await p.reload({ waitUntil: 'commit' });
  assert.equal(await p.evaluate(() => document.documentElement.dataset.entrance), undefined);
  await p.evaluate(() => sessionStorage.clear());
  await p.goto(SITE + '/index.html?collection=saved', { waitUntil: 'commit' });
  assert.equal(await p.evaluate(() => document.documentElement.dataset.entrance), undefined, 'a deep link');
  await p.evaluate(() => sessionStorage.clear());
  await p.goto(SITE + '/index.html?lang=en', { waitUntil: 'commit' });
  assert.equal(await p.evaluate(() => document.documentElement.dataset.entrance), 'brief');
  await p.waitForFunction(() => document.documentElement.dataset.entranceState);
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.ent-foot')).display), 'none', 'no hint in the brief one');
  await p.waitForFunction(() => document.documentElement.dataset.entranceState === 'done', null, { timeout: 5000 });
  await finish(p);
  // Replay link (?intro=1), skipping with a key, and where the flying mark ends: on the header's mark, also under zoom.
  for (const zoom of ['1', '1.25']) {
    p = await open({ init: `try { localStorage.setItem('molastria-zoom', '${zoom}'); } catch (e) {}` });
    await go(p, '/index.html?intro=1');
    assert.equal(await p.evaluate(() => location.search), '', 'intro=1 leaves the address');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.entranceState), 'playing');
    const end = await p.evaluate(() => new Promise((done) => {
      let last = null;
      const tick = () => {
        const m = document.querySelector('.ent-mark'), t = document.querySelector('.cr-header .cr-mark');
        if (m && t) { const a = m.getBoundingClientRect(), b = t.getBoundingClientRect(); last = [a.left - b.left, a.top - b.top, a.width - b.width]; }
        if (document.documentElement.dataset.entranceState === 'done') return done(last);
        requestAnimationFrame(tick);
      };
      dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      tick();
    }));
    assert.ok(end && end.every((d) => Math.abs(d) < 1.5), `zoom ${zoom}: the mark lands on the header's mark, off by ${end}`);
    await finish(p);
  }
  // Reduced motion and the "logo animation" switch: no entrance, even when asked for by address only the former holds.
  p = await open({ init: human, reducedMotion: 'reduce' });
  await go(p, '/index.html?intro=1');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.entrance), undefined);
  await finish(p);
  p = await open({ init: () => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); try { localStorage.setItem('chemhub-logo-motion', 'off'); } catch (e) {} } });
  await go(p, '/index.html');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.entrance), undefined);
  await finish(p);
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
  // Pro is monthly only, ¥9.9 (2026-11-11): no year/month switch, the checkout sells pro_month.
  assert.equal(await text(p, '[data-plan=pro] .price'), '¥9.9/ 月');
  assert.equal(await p.locator('[data-billing]').count(), 0);
  assert.equal(await text(p, '[data-price=team]'), '¥500'); // ¥100 a seat a year, five seats at least
  assert.match(await text(p, '[data-seats=team]'), /每加 1 席 ¥100 \/ 年/);
  await p.click('[data-checkout=pro]');
  assert.match(await text(p, '#co-title'), /月付/);
  assert.equal(await text(p, '#co-price'), '¥9.9');
  await finish(p);
  const english = await open();
  await go(english, '/pro/index.html?lang=en');
  await english.waitForFunction(() => /CN¥9\.9/.test(document.querySelector('[data-price=pro]').textContent));
  assert.equal(await text(english, '[data-fx=pro]'), '≈ US$1.49');
  await finish(english);
});

check('paying signs the buyer in', async () => {
  const p = await open();
  await go(p, '/pro/success.html?session_id=cs_test_localpro&plan=pro_year');
  await p.waitForSelector('#activate.ok');
  await p.waitForSelector('#cr-acct[data-state=pro]');
  await p.click('#cr-acct');
  assert.match(await p.getAttribute('.cr-acct-pop .cr-ap-row', 'href'), /pro\/account\.html$/);
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
  // The list redraws 140 ms after the last key, so wait for the new rows rather than any rows.
  await p.waitForFunction(() => [...document.querySelectorAll('.result-row h3')].some((h) => /electrolyte/i.test(h.textContent)), null, { timeout: 5000 }).catch(() => {});
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

check('web search: best web matches sit above the catalogue, Chinese is bridged, OpenAlex out falls back to Crossref, can be turned off', async () => {
  webFakes.openalex429 = false; webFakes.calls.length = 0;
  const p = await open();
  await go(p, '/index.html');
  await p.fill('#intro-q', 'pyscf');
  await p.press('#intro-q', 'Enter');
  await p.waitForSelector('#web-results .wr-item');
  const titles = await p.$$eval('#web-results .wr-title', (a) => a.map((x) => x.textContent.trim()));
  assert.ok(titles.includes('pyscf/pyscf'), 'the GitHub repo');
  assert.ok(titles.some((t) => /review of pyscf/.test(t)), 'the OpenAlex paper');
  // The block sits between the result count and the catalogue list.
  assert.equal(await p.evaluate(() => document.getElementById('web-results').nextElementSibling.id), 'results');
  const inCat = await p.$('#web-results .wr-in');
  if (inCat) { await inCat.click(); await p.waitForSelector('#details[open]'); await p.click('#close-details'); }
  assert.ok(await p.isVisible('#web-results .wr-note'));
  // 阿司匹林: not in the glossary, so the Chinese wiki gives the English name, then PubChem finds the compound.
  await p.fill('#search', '阿司匹林');
  await p.press('#search', 'Enter');
  await p.waitForFunction(() => [...document.querySelectorAll('#web-results .wr-title')].some((a) => a.textContent.includes('Aspirin')), null, { timeout: 8000 });
  assert.ok(webFakes.calls.some((u) => /pubchem.*aspirin/i.test(u)), 'PubChem asked with the English name');
  assert.ok(await p.$$eval('#web-results .wr-title', (a) => a.some((x) => x.textContent.includes('乙酰水杨酸'))), 'the Chinese wiki article');
  // Typing waits: three quick keys make one search, not three.
  const before = webFakes.calls.length;
  await p.fill('#search', '');
  await p.type('#search', 'orca', { delay: 60 });
  await p.waitForFunction(() => document.querySelector('#web-results .wr-status').textContent.includes('共'), null, { timeout: 8000 });
  assert.ok(webFakes.calls.slice(before).filter((u) => u.includes('openalex')).length <= 1, 'one OpenAlex request for one word');
  // Off: nothing is sent, and the choice is kept.
  await p.uncheck('#web-results .wr-toggle input');
  const off = webFakes.calls.length;
  await p.fill('#search', 'xtb');
  await p.press('#search', 'Enter');
  await p.waitForTimeout(1000);
  assert.equal(webFakes.calls.length, off, 'off: no requests');
  assert.match(await text(p, '#web-results .wr-status'), /已关闭/);
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-web-search')), 'off');
  await p.check('#web-results .wr-toggle input');
  await finish(p);
  // OpenAlex's free daily budget used up: papers come from Crossref.
  webFakes.openalex429 = true;
  const q = await open();
  await go(q, '/index.html?q=electrolyte');
  await q.waitForFunction(() => [...document.querySelectorAll('#web-results .wr-src')].some((s) => s.textContent === 'Crossref'), null, { timeout: 8000 });
  webFakes.openalex429 = false;
  await q.setViewportSize({ width: 390, height: 800 });
  assert.ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll on a phone');
  await finish(q);
});

check('web search for Pro: general web results come through the account service; free accounts are pointed to Pro', async () => {
  const p = await open();
  await go(p, '/pro/account.html');
  await signIn(p, 'pro@example.com');
  await go(p, '/index.html?q=pyscf');
  // Plenty of catalogue hits: the web list starts folded at three, so open it before looking for the web page.
  await p.waitForFunction(() => /共 4 条/.test(document.querySelector('#web-results .wr-status').textContent), null, { timeout: 8000 });
  if (await p.isVisible('#web-results .wr-more')) await p.click('#web-results .wr-more');
  assert.ok(await p.$$eval('#web-results .wr-src', (s) => s.some((x) => x.textContent === 'Brave')), 'a Brave web result');
  assert.match(await text(p, '#web-results .wr-note'), /你是 Pro 支持者/);
  await finish(p);
  const f = await open();
  await go(f, '/pro/account.html');
  await signIn(f, 'webfree@example.com');
  await go(f, '/index.html?q=pyscf');
  await f.waitForSelector('#web-results .wr-item');
  await f.waitForTimeout(800);
  assert.ok(!(await f.$$eval('#web-results .wr-src', (s) => s.some((x) => x.textContent === 'Brave'))), 'no web results for a free account');
  assert.equal(await f.getAttribute('#web-results .wr-pro a', 'href'), 'pro/index.html');
  await finish(f);
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=radar]', 'aria-current'), 'page');
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=research]', 'aria-current'), 'page');
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
  // The atlas adds schools over time: the list must show every school in its nav.js, and at least the first 20.
  const nSchools = await f.evaluate(() => window.RA_NAV.SCHOOLS.length);
  assert.ok(nSchools >= 20, 'the atlas lists at least 20 schools');
  assert.equal(await f.$$eval('.ra-pop .ra-sch li', (l) => l.length), nSchools, 'the school list');
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
  // The host sends the typeface again once the new page has loaded (postMessage), so wait for it rather than read it at once: under load it lands after the h1.
  await mit.waitForFunction(() => document.documentElement.dataset.raFont === 'serif', null, { timeout: 5000 }).catch(() => {});
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=qchem]', 'aria-current'), 'page');
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
  assert.equal((await text(p, '.cr-mega a[data-id=qchem]')).trim().startsWith('游乐场'), true, 'nav label');
  assert.equal(await p.locator('.play-card').count(), 21, 'calculator + 20 games in four zones');
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

check('playground zones 2 and 3: spin filters, Bell game, circuits, error correction, Grover, noise-assisted transfer, Planck units, cube', async () => {
  const p = await open();
  const best = () => p.evaluate(() => JSON.parse(localStorage.getItem('molastria-play') || '{}'));
  const slide = (sel, v) => p.$eval(sel, (r, val) => { r.value = String(val); r.dispatchEvent(new Event('input')); }, v);
  // 07 Stern–Gerlach: level 2, a +x analyser between +z and −z passes 1/4
  await go(p, '/qchem/index.html#play-sg');
  await p.click('#sg-levels button >> nth=1');
  assert.match(await text(p, '#sg-read'), /0%/);
  await slide('#sg-sliders input', 90);
  assert.match(await text(p, '#sg-msg'), /过关！透过率 25/);
  assert.deepEqual((await best()).sg, ['paradox']);
  await p.click('#sg-fire');
  await p.waitForFunction(() => /个到达探测器/.test(document.getElementById('sg-msg').textContent), null, { timeout: 10000 });
  // 08 CHSH: the classical start is 25%; the optimal angles reach the Tsirelson bound and all quantum goals
  await p.click('#play-tabs a[data-view=bell]');
  await p.waitForSelector('#bell-read dd');
  assert.match(await text(p, '#bell-read'), /25%/);
  await p.click('#bell-mode button[data-m=q]');
  for (const [k, v] of [['a0', 0], ['a1', 45], ['b0', 22.5], ['b1', -22.5]]) await slide(`#bell-${k}`, v);
  await p.click('#bell-play');
  assert.match(await text(p, '#bell-read'), /85\.4%|85\.36%/);
  assert.deepEqual([...(await best()).bell].sort(), ['q80', 'q85']);
  // 09 circuits: puzzle 4 (Bell state) in two gates is optimal; the overview counts it
  await p.click('#play-tabs a[data-view=circuit]');
  await p.click('#cir-levels button >> nth=3');
  await p.click('#cir-pal button:has-text("H") >> nth=0');
  await p.click('#cir-pal button[data-g=CNOT] >> nth=0');
  assert.match(await text(p, '#cir-msg'), /正好是最少门数/);
  assert.equal((await best()).circuit.bell, 2);
  // 10 error correction: the decoder's choice is marked; the automatic run reports 1000 rounds
  await p.click('#play-tabs a[data-view=qec]');
  await p.click('#qec-choices .play-choice >> nth=0');
  assert.equal(await p.locator('#qec-choices [data-mark=right]').count(), 1);
  await p.click('#qec-auto');
  assert.match(await text(p, '#qec-msg'), /解码器跑了 1000 轮/);
  // 11 Grover: N = 4, one iteration makes the find certain
  await p.click('#play-tabs a[data-view=grover]');
  await p.click('#gr-sizes button >> nth=0');
  await p.click('#gr-step');
  assert.match(await text(p, '#gr-read'), /100\.00%/);
  await p.click('#gr-measure');
  assert.equal(await p.$eval('#gr-msg', (e) => e.dataset.tone), 'ok');
  // 12 noise-assisted transfer: the dark diamond fails without noise, passes at its optimum
  await p.click('#play-tabs a[data-view=enaqt]');
  await p.click('#en-nets button >> nth=2');
  assert.match(await text(p, '#en-read'), /传递效率 η0%/);
  const s = await p.evaluate(() => { const Q = window.MOLASTRIA_PLAYQ, c = Q.enaqtCurve(Q.networks[2]); return c.indexOf(Math.max(...c)); });
  await slide('#en-g', s);
  await p.click('#en-lock');
  assert.match(await text(p, '#en-msg'), /过关/);
  // 13 Planck units: the answer for length is ħ^(1/2) c^(−3/2) G^(1/2)
  await p.click('#play-tabs a[data-view=planck]');
  await p.click('#pl-targets button >> nth=0');
  for (const [i, n] of [[0, 1], [2, 1]]) for (let k = 0; k < n; k++) await p.click(`#pl-steps .pl-step >> nth=${i} >> button >> nth=1`);
  for (let k = 0; k < 3; k++) await p.click('#pl-steps .pl-step >> nth=1 >> button >> nth=0');
  assert.match(await text(p, '#pl-msg'), /普朗克长度/);
  // 14 cube: answering marks the right corner and moves the streak
  await p.click('#play-tabs a[data-view=cube]');
  await p.click('#cube-go');
  assert.match(await text(p, '[data-score=cube]'), /连续答对 [01]/);
  assert.equal(await p.isDisabled('#cube-go'), true);
  // overview shows progress for the new zones
  await p.click('#play-tabs a[data-view=home]');
  assert.match(await text(p, '[data-best=circuit]'), /已解 1 \/ 10 题/);
  assert.match(await text(p, '[data-best=bell]'), /已达成 2 \/ 3 个目标/);
  await finish(p);
});

check('playground in English: games and canvas labels are translated, no Chinese left', async () => {
  const p = await open();
  for (const v of ['', '#play-box', '#play-config', '#play-tunnel', '#play-ring', '#play-lines', '#play-orbital', '#play-sg', '#play-bell', '#play-circuit', '#play-qec', '#play-grover', '#play-enaqt', '#play-planck', '#play-cube', '#play-wave', '#play-vsepr', '#play-chiral', '#play-miller', '#play-bloch']) {
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=openmodels]', 'aria-current'), 'page');
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
  charged: { models: ['uma-s-1p2p1', 'uma-s-1p2', 'uma-s-1p2p1-ft-d4rev', 'allscaip-md-conserving-all-omol', 'allscaip-md-direct-all-omol'], jobs: ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn', 'ipea', 'spin', 'bde', 'pa', 'flow'] },
  neutral: { models: ['uma-s-1p1', 'esen-sm-conserving-all-omol', 'esen-sm-direct-all-omol', 'esen-md-direct-all-omol', 'mace-omol-0'], jobs: ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn'] },
  organic: { models: ['mace-off23-small', 'mace-off23-medium', 'mace-off23-large', 'ani-2x', 'gfn-ff'], jobs: ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn'] },
  props: { models: ['mace-mdp'], jobs: ['polar', 'ir'] },
  xtb: { models: ['gfn2-xtb', 'gfn2-xtb-alpb-water', 'gfn1-xtb'], jobs: ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn', 'spin', 'bde', 'pa'] },
  protein: { models: ['openmm-amber14'], jobs: ['pmd'] },
};
/** Opens the models page once the fake computer is online and RDKit has checked the sample SMILES; records each job sent. */
async function openModels(win = '', { health, ...options } = {}) {
  const p = await open(options);
  p.posts = [];
  p.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/uma/jobs')) p.posts.push(JSON.parse(r.postData() || '{}')); });
  // the page keeps polling the health check; a poll still in flight when the check closes the page is not a failure
  if (health) await p.route(`${API}/uma/health`, async (route) => {
    try { const res = await route.fetch(); await route.fulfill({ response: res, json: health(await res.json()) }); } catch (err) { if (!p.isClosed()) throw err; }
  });
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=models]', 'aria-current'), 'page');
  assert.match(await text(p, '.md-disclaim'), /不是 DFT 计算/);
  for (const [win, want] of Object.entries(MODEL_WINDOWS)) {
    await p.click(`#m-tabs [data-win=${win}]`);
    assert.equal(await p.getAttribute(`#m-tabs [data-win=${win}]`, 'aria-selected'), 'true');
    assert.deepEqual(await p.$$eval('#m-model option', (os) => os.map((o) => o.value)), want.models, `${win} models`);
    assert.deepEqual(await p.$$eval('#m-job option', (os) => os.map((o) => o.value)), want.jobs, `${win} jobs`);
    assert.equal(await p.isVisible('#m-cs'), win === 'charged' || win === 'xtb', `charge and spin only in windows 1 and 5 (${win})`);
    assert.equal(await p.locator('#m-cards .md-model').count(), want.models.length, `${win} model cards`);
  }
  await p.click('#m-tabs [data-win=charged]');
  const costs = { sp: 1, opt: 1, freq: 3, conf: 5, scan: 5, md: 5, rxn: 3, ipea: 1, spin: 2, bde: 2, pa: 2, flow: 4 };
  for (const [job, n] of Object.entries(costs)) {
    await p.selectOption('#m-job', job);
    assert.equal(await text(p, '#m-run'), `运行 · 消耗 ${n} 次`, job);
  }
  await p.selectOption('#m-job', 'pa');
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

check('models page: the one-click pipeline runs frequencies, then IP / EA on the optimised structure, and stops at an imaginary frequency', async () => {
  const p = await openModels();
  const jobs = () => p.posts.map((b) => b.job);
  // The fake computer's freq has one imaginary mode: by default the pipeline stops there and charges nothing more.
  let r = await runJob(p, 'flow');
  assert.deepEqual(jobs(), ['freq']);
  assert.deepEqual(p.posts[0].params, { temperature: 298.15, symmetry: 1 }, 'the pipeline-only option is not sent to the server');
  if (V(true, false)) {
    assert.match(r, /第 2 步没有算/); assert.match(r, /1 个虚频/);
    assert.match(await text(p, '#m-result .md-flow'), /流水线汇总/);
    // Untick the stop: step 2 runs on the coordinates step 1 returned.
    p.posts.length = 0;
    r = await runJob(p, 'flow', () => p.uncheck('#m-params input[data-k=stop_imag]'));
    assert.deepEqual(jobs(), ['freq', 'ipea']);
  } else if (!p.posts.some((b) => b.job === 'ipea')) return finish(p); // a real model found a minimum: nothing more to check offline
  const [freq, ip] = p.posts;
  assert.equal(ip.smiles, undefined); assert.match(ip.xyz, /^\s*\d+\n/); assert.deepEqual(ip.params, { mode: 'both' });
  assert.deepEqual([ip.charge, ip.spin], [freq.charge, freq.spin]);
  const sum = await text(p, '#m-result .md-flow');
  assert.match(sum, V(/10\.900/, /\d+\.\d{3}/)); assert.match(sum, V(/11\.320/, /\d+\.\d{3}/));
  assert.equal(await p.locator('#m-result .md-res h3', { hasText: /第 1 步/ }).count(), 1);
  assert.equal(await p.locator('#m-result .md-res h3', { hasText: /第 2 步/ }).count(), 1);
  await p.click('#m-result [data-act=flow-csv]');
  const csv = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (csv) assert.match(csv, /^model,energy_ev,n_imag,zpe_ev,g_ev,ip_adiabatic_ev/);
  await finish(p);
});

check('models page: window 5 runs xTB on an ion and shows the gap, dipole and charges', async () => {
  const p = await openModels('xtb');
  assert.equal(await p.getAttribute('#m-tabs [data-win=xtb]', 'aria-selected'), 'true');
  assert.match(await text(p, '#m-cards'), /免费 · 开源/);
  assert.match(await text(p, '#m-fine'), /grimme-lab\/xtb，LGPL-3\.0/);
  await p.fill('#m-smiles', '[NH4+]');
  await p.waitForFunction(() => /H4N/.test(document.getElementById('m-check').textContent));
  await p.fill('#m-charge', '1');
  const r = await runJob(p, 'opt');
  assert.match(r, /HOMO–LUMO 能隙 14\.693 eV/); assert.match(r, /偶极矩 2\.27 D/); assert.match(r, /每个原子的部分电荷/);
  assert.deepEqual([p.posts.at(-1).model, p.posts.at(-1).charge], ['gfn2-xtb', 1]);
  await p.selectOption('#m-model', 'gfn2-xtb-alpb-water');
  assert.match(await text(p, '#m-about'), /ALPB/);
  await finish(p);
});

check('models page: window 6 runs protein MD from a PDB ID: curves, fluctuation, 3D trajectory, downloads', async () => {
  const p = await openModels('protein');
  assert.equal(await p.isVisible('#m-struct'), false, 'no SMILES or XYZ box');
  assert.equal(await p.isVisible('#m-cs'), false);
  assert.match(await text(p, '#m-fine'), /OpenMM 8/);
  await p.selectOption('#m-job', 'pmd');
  await p.fill('#m-params input[data-k=pdb_id]', '1l2');
  assert.match(await text(p, '#m-why'), /PDB 编号是四位/);
  assert.equal(await runOff(p), true);
  await p.fill('#m-params input[data-k=pdb_id]', '1l2y');
  await p.fill('#m-params input[data-k=chains]', 'A B');
  assert.match(await text(p, '#m-why'), /链只写链的字母/);
  await p.fill('#m-params input[data-k=chains]', '');
  await p.fill('#m-params input[data-k=ps]', '50');
  assert.equal(await text(p, '#m-run'), '运行 · 消耗 10 次', 'longer than 20 ps costs 10');
  await p.fill('#m-params input[data-k=ps]', '20');
  assert.equal(await text(p, '#m-run'), '运行 · 消耗 5 次');
  const r = await runJob(p, 'pmd');
  assert.deepEqual(p.posts.at(-1), { model: 'openmm-amber14', job: 'pmd', params: { pdb_id: '1L2Y', chains: '', ps: 20, temperature: 300 } }, 'a PDB ID, no structure, no charge');
  assert.match(r, /1L2Y · 所选的链 A · 20 个残基 · 304 个原子/); assert.match(r, /OpenCL/); assert.match(r, /最终 Cα RMSD 1\.\d\d Å/);
  assert.match(r, /动得最多的残基：A:ASN1 /); assert.match(r, /经典力场的模拟/);
  assert.equal(await p.locator('#m-result svg.md-plot').count(), 5, 'RMSD, Rg, RMSF, then temperature and energy');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#m-result [data-act=pdb-traj]')]);
  assert.equal(dl.suggestedFilename(), '1L2Y_openmm-amber14_pmd_trajectory_ca.pdb');
  assert.equal(readFileSync(await dl.path(), 'utf8').match(/^MODEL /gm).length, 25);
  await p.click('#m-result [data-act="3d"]');
  await p.waitForSelector('#m-result .md-3d[data-ready]', { timeout: 30000 });
  assert.equal(await text(p, '#m-result .m3-fnum'), '第 1 / 25 帧');
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
  await p.waitForFunction(() => /20/.test(document.getElementById('m-status').textContent) && /C3H3FO3/.test(document.getElementById('m-check').textContent), null, { timeout: 30000 });
  await runJob(p, 'freq');
  const left = new Set();
  for (const win of ['charged', 'neutral', 'organic', 'props', 'xtb', 'protein']) {
    await p.click(`#m-tabs [data-win=${win}]`);
    if (win === 'xtb') await runJob(p, 'opt'); // the gap, dipole and charges of an xTB result
    if (win === 'protein') await runJob(p, 'pmd'); // curves, fluctuation, fixes
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=manual]', 'aria-current'), 'page');
  assert.equal(await p.locator('#guide-toc button').count(), 25);
  assert.equal(await p.locator('.sidebar, #view-resources, #view-agent').count(), 0, 'no database views on the handbook page');
  assert.equal(await p.locator('#view-guide .page-intro p').count(), 0);
  assert.equal(await text(p, '#guide-article h1'), '药物、生物活性与化学空间');
  await p.click('[data-guide-lang=en]');
  assert.equal(await text(p, '#guide-article h1'), 'Drugs, bioactivity & chemical space');
  assert.equal(await p.getAttribute('#guide-article', 'lang'), 'en');
  assert.equal(await text(p, '#reader-progress'), '09 / 25 · 05 · Drugs & chemical space');
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
  assert.equal(await text(p, '#reader-progress'), '02 / 25 · 三分钟导读');
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
  assert.equal(await db.getAttribute('.cr-mega a[data-id=atlas]', 'aria-current'), 'page');
  await db.evaluate(() => { location.hash = '#agent'; });
  await db.waitForFunction(() => document.querySelector('.cr-mega a[data-id=agent]').getAttribute('aria-current') === 'page' && !document.getElementById('view-agent').hidden);
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

check('agent: the Agent section shows chemdb-agent 0.3.0 as implemented, the integrated counts match the catalogue, the download is the packed source', async () => {
  const p = await open();
  await go(p, '/atlas/index.html#agent');
  await p.waitForFunction(() => !document.getElementById('view-agent').hidden);
  assert.match(await text(p, '#view-agent .agent-intro .pill'), /v0\.3\.0/);
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

check('top bar: five groups in one row at desktop widths in both languages, a single 栏目 sheet when they do not fit, the menu opens, switches and closes', async () => {
  for (const lang of ['zh', 'en']) {
    for (const width of [390, 768, 1024, 1181, 1366, 1920]) {
      const p = await open({ viewport: { width, height: 800 } });
      await go(p, `/atlas/index.html${lang === 'en' ? '?lang=en' : ''}#agent`);
      await p.waitForFunction(() => !document.documentElement.dataset.i18n);
      const bar = await p.evaluate(() => {
        const row = document.querySelector('.cr-links');
        const shown = [...row.children].filter((el) => el.offsetWidth);
        return {
          tops: [...new Set(shown.map((el) => Math.round(el.getBoundingClientRect().top)))],
          groups: [...row.querySelectorAll('.cr-grp-btn')].filter((b) => b.offsetWidth).map((b) => b.dataset.group),
          menu: !!row.querySelector('.cr-menu-btn').offsetWidth,
          where: row.querySelector('.cr-where').textContent,
          current: document.querySelector('.cr-grp-btn[data-group=models]').hasAttribute('data-current'),
          header: document.querySelector('.cr-header').offsetHeight, wide: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      const where = `${lang} ${width}px`;
      assert.ok(!bar.wide, `${where}: the page scrolls sideways`);
      if (width >= 1024) {
        assert.deepEqual(bar.groups, ['find', 'learn', 'explore', 'models', 'make'], `${where}: groups`);
        assert.equal(bar.tops.length, 1, `${where}: on ${bar.tops.length} rows`);
        assert.ok(bar.header <= 70 && !bar.menu, `${where}: header ${bar.header}px, 栏目 button ${bar.menu}`);
        assert.ok(bar.current, `${where}: 模型与 AI marked current for Agent 工程`);
      } else {
        assert.ok(bar.menu && !bar.groups.length, `${where}: one 栏目 button`);
        assert.match(bar.where, lang === 'en' ? /Agent/ : /Agent 工程/, `${where}: the button says where you are`);
      }
      await p.context().close();
    }
  }
  // Every section of the old flat list is still one click away, and every link in the menu resolves to a page.
  const p = await open({ viewport: { width: 1366, height: 800 } });
  await go(p, '/manual/index.html');
  const ids = await p.$$eval('.cr-mega a.cr-item[data-id]', (a) => a.map((x) => x.dataset.id));
  for (const id of ['search', 'atlas', 'network', 'research', 'radar', 'digest', 'hub', 'chat', 'manual', 'videos', 'programming', 'learn', 'review', 'shelf', 'pet', 'qchem', 'quantum', 'fundamental', 'realms', 'openmodels', 'aimath', 'scimodels', 'models', 'lab', 'train', 'agent', 'code', 'journals', 'api', 'download']) assert.ok(ids.includes(id), `menu has ${id}`);
  assert.ok(!ids.includes('meta'), 'Meta is no longer its own section; it sits under 开放模型馆');
  const hrefs = await p.$$eval('.cr-mega a[href]', (a) => [...new Set(a.map((x) => x.href.split('#')[0]))]);
  for (const h of hrefs) assert.equal((await p.request.get(h)).status(), 200, h);
  // Keyboard: ArrowDown on a group opens it with focus on its first link; Escape closes and returns focus. Hover switches groups.
  await p.focus('.cr-grp-btn[data-group=learn]');
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.getAttribute('.cr-grp-btn[data-group=learn]', 'aria-expanded'), 'true');
  assert.equal(await p.evaluate(() => document.activeElement.dataset.id), 'manual');
  assert.ok(await p.locator('.cr-sec[data-group=learn][data-active]').isVisible());
  await p.hover('.cr-grp-btn[data-group=models]');
  await p.waitForSelector('.cr-sec[data-group=models][data-active]');
  assert.ok(await p.locator('.cr-mega a[data-id=openmodels] ~ .cr-subs a[href*="open-models/deepmind"]').count() || await p.locator('.cr-cell[data-id=openmodels] .cr-subs a[href*="open-models/deepmind"]').count(), 'pavilions under 开放模型馆');
  await p.keyboard.press('Escape');
  assert.ok(await p.locator('#cr-mega').isHidden());
  assert.equal(await p.evaluate(() => document.activeElement.dataset.group), 'models', 'focus back on the group that was open');
  await p.click('.cr-grp-btn[data-group=find]');
  await p.click('main', { position: { x: 5, y: 400 } });
  assert.ok(await p.locator('#cr-mega').isHidden(), 'a click outside closes the menu');
  // The menu stays inside the window at a short height.
  await p.setViewportSize({ width: 1366, height: 520 });
  await p.click('.cr-grp-btn[data-group=find]');
  assert.ok(await p.evaluate(() => document.getElementById('cr-mega').getBoundingClientRect().bottom <= innerHeight + 1), 'menu fits the window');
  await finish(p);
});

check('top bar search: Ctrl+K opens it, words in either language find sections and sub-pages, Enter opens the first hit; page searches keep their own Ctrl+K', async () => {
  const p = await open({ viewport: { width: 1366, height: 800 } });
  await go(p, '/manual/index.html');
  await p.keyboard.press('Control+k');
  assert.ok(await p.locator('#cr-mega').isVisible());
  assert.ok(await p.evaluate(() => document.activeElement.matches('.cr-find input')));
  await p.keyboard.type('fortran');
  assert.deepEqual(await p.$$eval('.cr-cell:not([hidden])', (c) => c.map((x) => x.dataset.id)), ['programming']);
  await p.fill('.cr-find input', 'DeepMind');
  assert.ok((await p.$$eval('.cr-cell:not([hidden])', (c) => c.map((x) => x.dataset.id))).includes('openmodels'));
  await p.fill('.cr-find input', '没有这样的栏目zzz');
  assert.ok(await p.locator('.cr-none').isVisible());
  await p.fill('.cr-find input', '期刊');
  await p.keyboard.press('Enter');
  await p.waitForURL(/\/journals\/index\.html/);
  assert.equal(await p.getAttribute('.cr-mega a[data-id=journals]', 'aria-current'), 'page');
  // the home page search keeps Ctrl+K for itself
  await go(p, '/index.html');
  await p.keyboard.press('Control+k');
  assert.ok(await p.locator('#cr-mega').isHidden(), 'home search keeps the shortcut');
  // phones: the 栏目 sheet lists every group at once and the search narrows it
  const m = await open({ viewport: { width: 390, height: 844 } });
  await go(m, '/manual/index.html');
  await m.click('.cr-menu-btn');
  assert.ok(await m.evaluate(() => document.getElementById('cr-mega').classList.contains('cr-all')));
  assert.equal(await m.$$eval('.cr-sec', (s) => s.filter((x) => x.offsetHeight).length), 5);
  const box = await m.$eval('#cr-mega', (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right }; });
  assert.ok(box.l >= -1 && box.r <= 391, `sheet inside the screen: ${box.l}–${box.r}`);
  await m.fill('.cr-find input', 'python');
  assert.ok((await m.$$eval('.cr-cell:not([hidden])', (c) => c.map((x) => x.dataset.id))).includes('programming'));
  await finish(m);
  await finish(p);
});

check('header order and account: groups and buttons drag into a new order that is kept; Sign in panel; signed-in avatar, plan, allowance, sign out', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await go(p, '/manual/index.html');
  const order = () => p.evaluate(() => ({ g: [...document.querySelectorAll('.cr-grps .cr-grp-btn')].map((b) => b.dataset.group), rail: [...document.querySelectorAll('.cr-rail [data-rail]')].map((b) => b.dataset.rail), t: [...document.querySelectorAll('.cr-tools > [data-tool]')].map((b) => b.dataset.tool) }));
  const drag = async (from, to) => {
    const a = await p.locator(from).boundingBox(), b = await p.locator(to).boundingBox();
    await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await p.mouse.down();
    for (let i = 1; i <= 12; i++) { await p.mouse.move(a.x + a.width / 2 + (b.x - 10 - a.x) * i / 12, a.y + a.height / 2); await p.waitForTimeout(16); }
    assert.ok(await p.locator('.cr-header .cr-lifted').count() === 1, 'the dragged item is lifted');
    await p.mouse.up();
    await p.waitForTimeout(500);
  };
  await drag('.cr-grp-btn[data-group=explore]', '.cr-grp-btn[data-group=find]');
  let o = await order();
  assert.deepEqual(o.g, ['explore', 'find', 'learn', 'models', 'make']);
  assert.deepEqual(o.rail, o.g, 'the menu rail follows');
  assert.ok(await p.locator('#cr-mega').isHidden(), 'a drag does not open the menu');
  await drag('#cr-theme', '#cr-jump');
  o = await order();
  assert.equal(o.t[0], 'theme');
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme || ''), '', 'a drag does not press the button');
  // keyboard: Alt + Shift + arrow
  await p.focus('#cr-theme');
  await p.keyboard.press('Alt+Shift+ArrowRight');
  assert.equal((await order()).t[1], 'theme');
  await p.reload();
  o = await order();
  assert.deepEqual(o.g, ['explore', 'find', 'learn', 'models', 'make'], 'kept after reload');
  assert.equal(o.t[1], 'theme');
  // a plain click still opens the group
  await p.click('.cr-grp-btn[data-group=learn]');
  assert.ok(await p.locator('#cr-mega').isVisible());
  await p.keyboard.press('Escape');
  // the arrange panel puts the default order back
  await p.evaluate(() => document.querySelector('.cr-pins-edit').click());
  await p.click('.cr-arr-order');
  await p.click('.cr-arr-done');
  o = await order();
  assert.deepEqual(o.g, ['find', 'learn', 'explore', 'models', 'make']);
  assert.equal(o.t.join(), 'jump,acct,lang,disp,bg,theme,ai');
  assert.deepEqual(await p.evaluate(() => [localStorage.getItem('molastria-nav-groups'), localStorage.getItem('molastria-nav-tools')]), [null, null]);

  // signed out: "登录" opens a panel that leads to sign-in, Pro, the API, the weekly picks and the desktop app
  assert.equal(await text(p, '#cr-acct'), '登录');
  await p.click('#cr-acct');
  assert.ok(await p.locator('#cr-acct-pop').isVisible());
  const hrefs = await p.$$eval('#cr-acct-pop a', (a) => a.map((x) => new URL(x.href).pathname + new URL(x.href).hash));
  for (const h of ['/pro/account.html', '/pro/index.html', '/api/index.html', '/digest/index.html', '/download/index.html', '/pro/account.html#vip']) assert.ok(hrefs.includes(h), `panel links ${h}: ${hrefs}`);
  await p.keyboard.press('Escape');
  assert.ok(await p.locator('#cr-acct-pop').isHidden());
  // #vip on the account page opens the card field
  await go(p, '/pro/account.html#vip');
  await p.waitForSelector('#card-field:not([hidden])');

  // signed in (Pro): the initial, the plan, this month's allowance, the account page's parts, and signing out from the header
  await p.evaluate(() => { localStorage.setItem('molastria-session', 'tok'); localStorage.setItem('molastria-account', JSON.stringify({ email: 'ada@example.edu', pro: true, role: 'pro', plan: 'pro_year', cycle: 'year', usage: { period: 'month', asks: 42, limit: 300 } })); sessionStorage.setItem('molastria-account-checked', '1'); });
  await go(p, '/manual/index.html');
  assert.equal(await p.getAttribute('#cr-acct', 'data-state'), 'pro');
  assert.equal(await text(p, '#cr-acct .cr-avatar'), 'A');
  await p.click('#cr-acct');
  assert.equal(await text(p, '.cr-ap-mail'), 'ada@example.edu');
  assert.equal(await text(p, '.cr-ap-plan'), 'Pro');
  assert.match(await text(p, '.cr-ap-meter'), /42 \/ 300/);
  const inHrefs = await p.$$eval('#cr-acct-pop a', (a) => a.map((x) => new URL(x.href).pathname + new URL(x.href).hash));
  for (const h of ['/pro/account.html', '/pro/account.html#keys-card', '/pro/account.html#digest-card', '/pro/account.html#manage', '/download/index.html']) assert.ok(inHrefs.includes(h), `signed-in panel links ${h}`);
  await p.click('.cr-ap-out');
  await p.waitForSelector('#cr-acct[data-state=out]');
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-session')), null);

  // English and phones: the panel speaks English; on a phone the button sits in the second row and the panel fits the screen
  await go(p, '/manual/index.html?lang=en');
  assert.equal(await text(p, '#cr-acct'), 'Sign in');
  assert.equal(await text(p, '#cr-lang'), '中', 'the language button is not run through the dictionary');
  const m = await open({ viewport: { width: 390, height: 844 } });
  await go(m, '/manual/index.html');
  assert.ok(await m.evaluate(() => document.getElementById('cr-acct').parentElement.matches('.cr-links')));
  assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  await m.click('#cr-acct');
  const box = await m.$eval('#cr-acct-pop', (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right }; });
  assert.ok(box.l >= 0 && box.r <= 390, `panel inside the screen: ${box.l}–${box.r}`);
  await finish(m);
  await finish(p);
});

check('open model hall: eleven pavilions, task comparison, filters; a pavilion page with crumbs, releases and the switcher; Meta joins in; English', async () => {
  const p = await open({ viewport: { width: 1366, height: 900 } });
  await p.context().route(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ tag_name: 'v9.9.9', name: 'Stand-in release', html_url: 'https://github.com/example/example/releases/tag/v9.9.9', published_at: '2026-11-01T00:00:00Z' }]) }));
  await go(p, '/open-models/index.html');
  assert.equal(await p.getAttribute('.cr-mega a[data-id=openmodels]', 'aria-current'), 'page');
  assert.equal(await p.locator('.om-org-card').count(), 11);
  assert.match(await p.getAttribute('.om-org-card[data-org=meta]', 'href'), /^\.\.\/meta\/index\.html$/);
  const all = await p.locator('#om-all .om-item').count();
  assert.ok(all >= 50, `${all} entries`);
  assert.ok(await p.locator('#om-tasks .om-task').count() >= 6);
  await p.click('#om-all .mx-filter button[data-kind=bio]');
  const bio = await p.locator('#om-all .om-item:not([hidden])').count();
  assert.ok(bio > 0 && bio < all, `bio filter: ${bio}`);
  assert.equal(await p.locator('#om-all .om-item:not([hidden]):not([data-kind=bio])').count(), 0);
  await p.click('#om-all .mx-filter button[data-kind=""]');
  await p.fill('#om-all .mx-search input', 'alphafold');
  const hits = await p.$$eval('#om-all .om-item:not([hidden])', (a) => a.map((x) => x.dataset.key));
  assert.ok(hits.includes('deepmind:alphafold2') && hits.includes('deepmind:alphafold3') && hits.length < 12, `search: ${hits}`);
  // a pavilion
  await p.click('.om-org-card[data-org=deepmind]');
  await p.waitForURL(/open-models\/deepmind\/index\.html/);
  assert.match(await text(p, '#om-crumbs'), /开放模型馆/);
  assert.equal(await p.locator('#om-grid .om-item').count(), 7);
  await p.waitForFunction(() => /Stand-in release/.test(document.getElementById('om-rel').textContent));
  assert.equal(await p.getAttribute('#om-switch a[aria-current=page]', 'href'), '../../open-models/deepmind/index.html');
  await p.click('#om-switch a[href$="meta/index.html"]');
  await p.waitForURL(/\/meta\/index\.html/);
  assert.match(await text(p, '#om-crumbs'), /开放模型馆/);
  assert.equal(await p.locator('#om-switch a').count(), 12);
  assert.equal(await p.getAttribute('.cr-mega a[data-id=openmodels]', 'aria-current'), 'page', 'Meta counts as part of the hall');
  await finish(p);
  const e = await open({ viewport: { width: 390, height: 844 } });
  // GitHub refuses unauthenticated readers after 60 requests an hour; the fallback sentence must still fit a phone
  await e.context().route('https://api.github.com/**', (r) => r.fulfill({ status: 403, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"API rate limit exceeded"}' }));
  await go(e, '/open-models/microsoft/index.html?lang=en');
  assert.match(await text(e, '#om-rel'), /Could not read releases/);
  assert.match(await text(e, 'main h1'), /Microsoft/);
  assert.doesNotMatch(await e.innerText('main'), /[一-鿿]{4}/, 'no Chinese left in English');
  assert.ok(await e.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll on a phone');
  await finish(e);
});

check('programming: twenty languages, filters and search, the same task in every language by address, copy, untested marked, Python runs in the browser (stand-in Pyodide)', async () => {
  const p = await open({ viewport: { width: 1366, height: 900 } });
  if (!NET) await p.context().route(/^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v[\d.]+\/full\/pyodide\.mjs$/, (r) => r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE_PYODIDE }));
  await go(p, '/programming/index.html');
  assert.equal(await p.getAttribute('.cr-mega a[data-id=programming]', 'aria-current'), 'page');
  assert.equal(await p.locator('.pl-card').count(), 20);
  await p.click('.pl-filter button[data-tier=parallel]');
  assert.deepEqual(await p.$$eval('.pl-card:not([hidden])', (c) => c.map((x) => x.id)), ['lang-openmp', 'lang-mpi', 'lang-cuda']);
  await p.click('.pl-filter button[data-tier=""]');
  await p.fill('.pl-search input', 'VASP');
  assert.deepEqual(await p.$$eval('.pl-card:not([hidden])', (c) => c.map((x) => x.id)), ['lang-fortran', 'lang-mpi']);
  await p.fill('.pl-search input', 'zzzz');
  assert.ok(await p.locator('.pl-empty').isVisible());
  // by address: the Fortran tab with its tested code and command
  await go(p, '/programming/index.html#code-fortran');
  assert.equal(await p.getAttribute('#tab-fortran', 'aria-selected'), 'true');
  assert.match(await text(p, '#pl-panel pre'), /program lj/);
  assert.match(await text(p, '#pl-panel .pl-cmd'), /gfortran/);
  assert.ok(await p.locator('#pl-panel .pl-badge.ok').count());
  await p.focus('#tab-fortran');
  await p.keyboard.press('ArrowRight');
  assert.equal(await p.getAttribute('#tab-cpp', 'aria-selected'), 'true', 'arrow keys move between tabs');
  await p.click('#tab-julia');
  assert.ok(await p.locator('#pl-panel .pl-badge.warn').count(), 'Julia is marked as not run');
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await p.click('#pl-panel .pl-copy');
  assert.match(await p.evaluate(() => navigator.clipboard.readText()), /println/);
  // #lang- scrolls to the card even when a filter hid it
  await p.click('.pl-filter button[data-tier=quantum]');
  await p.evaluate(() => { location.hash = '#lang-rust'; });
  await p.waitForFunction(() => !document.getElementById('lang-rust').hidden);
  // Python runs in place
  await p.click('#tab-python-0');
  await p.click('#pl-panel .pl-run');
  await p.waitForFunction(() => /stand-in run|E = -3\.000000/.test(document.querySelector('#pl-panel .py-out')?.textContent || ''), null, { timeout: NET ? 120000 : 15000 });
  await finish(p);
  for (const [w, lang, theme] of [[390, 'en', 'dark'], [768, 'zh', 'light']]) {
    const q = await open({ viewport: { width: w, height: 844 }, colorScheme: theme });
    await go(q, `/programming/index.html${lang === 'en' ? '?lang=en' : ''}`);
    assert.ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${w}px: no sideways scroll`);
    if (lang === 'en') assert.doesNotMatch(await q.innerText('main'), /[一-鿿]{4}/, 'no Chinese left in English');
    await finish(q);
  }
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

check('network: a word the term table does not know is kept on this device, reported once anonymously, can be removed, copied out and turned off; the admin sees the site-wide list', async () => {
  const p = await open({ permissions: ['clipboard-read', 'clipboard-write'] });
  const reports = [], outside = [];
  const WORDS = /qwertyzz|zzqq|unsharedzz/i;
  p.on('request', (r) => {
    if (r.url() === `${API}/net/miss` && r.method() === 'POST') { reports.push({ body: JSON.parse(r.postData()), auth: r.headers().authorization || null }); return; }
    if (!r.url().startsWith(SITE) && WORDS.test(r.url() + (r.postData() || ''))) outside.push(r.url());
  });
  const reported = async (n) => { for (let i = 0; i < 50 && reports.length < n; i++) await p.waitForTimeout(100); return reports.length; };
  await go(p, '/hub/network.html');
  assert.equal(await p.locator('#missActions').isVisible(), false);
  assert.match(await p.innerText('#missList'), /还没有记下的词/);
  assert.equal(await p.isChecked('#missShare'), true, 'reporting is on by default and says so');
  assert.match(await p.innerText('#missShareNote'), /匿名报给站长一次/);
  await p.fill('#netQ', 'qwertyzz');
  await p.press('#netQ', 'Enter');
  await p.waitForFunction(() => window.MolAstriaNetView.current().mode === 'text');
  assert.equal(await reported(1), 1);
  assert.deepEqual(reports[0], { body: { q: 'qwertyzz', hits: 0 }, auth: null }, 'only the word and its hit count, no token');
  assert.match(await p.innerText('#netFocus'), /已记进这台设备上的“没找到的词”，这个词也匿名报给了站长/);
  assert.match(await p.innerText('#missList'), /qwertyzz\s*1 次 · 全文 0 条/);
  // A known term, and the same word again in this visit, add nothing and report nothing.
  await p.fill('#netQ', 'Multiwfn'); await p.press('#netQ', 'Enter');
  await p.waitForFunction(() => window.MolAstriaNetView.current().center?.name === 'Multiwfn');
  await p.goBack();
  await p.waitForFunction(() => window.MolAstriaNetView.current().mode === 'text');
  let stored = await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-net-misses')));
  assert.deepEqual(stored.items.map((x) => [x.q, x.n]), [['qwertyzz', 1]]);
  // A ?q= link counts once per visit, and the list survives a reload.
  await go(p, '/hub/network.html?q=' + encodeURIComponent('zzqq plasmonic gizmo'));
  await p.waitForFunction(() => window.MolAstriaNetView.current().mode === 'text');
  assert.equal(await reported(2), 2);
  assert.deepEqual(await p.$$eval('#missList .net-miss-q', (b) => b.map((x) => x.textContent)), ['zzqq plasmonic gizmo', 'qwertyzz'], 'same count: the latest first');
  assert.equal(await p.getAttribute('#missList .net-miss-q', 'translate'), 'no');
  const issue = new URL(await p.getAttribute('#missIssue', 'href'));
  assert.equal(issue.pathname, '/FelixJiashengFu/chem-research-molastria/issues/new');
  assert.match(issue.searchParams.get('body'), /- qwertyzz（1 次，全文命中 0 条）/);
  await p.click('#missCopy');
  await p.waitForFunction(() => /已复制/.test(document.getElementById('missMsg').textContent));
  assert.match(await p.evaluate(() => navigator.clipboard.readText()), /^qwertyzz\t1 次\t0 条全文命中/m);
  // Clicking a word searches it again without counting or reporting it; × removes it.
  await p.click('#missList .net-miss-q >> text=qwertyzz');
  await p.waitForFunction(() => window.MolAstriaNetView.current().q === 'qwertyzz');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-net-misses')).items.find((x) => x.q === 'qwertyzz').n), 1);
  await p.click('[data-miss-x="qwertyzz"]');
  assert.deepEqual(await p.$$eval('#missList .net-miss-q', (b) => b.map((x) => x.textContent)), ['zzqq plasmonic gizmo']);
  // Unticking "report" keeps new words on this device only.
  await p.uncheck('#missShare');
  await p.fill('#netQ', 'unsharedzz'); await p.press('#netQ', 'Enter');
  await p.waitForFunction(() => window.MolAstriaNetView.current().mode === 'text');
  assert.match(await p.innerText('#missList'), /unsharedzz/);
  assert.doesNotMatch(await p.innerText('#netFocus'), /报给了站长/);
  // Turning recording off clears the list, stops it, and keeps the reporting choice.
  await p.uncheck('#missOn');
  stored = await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-net-misses')));
  assert.deepEqual(stored, { v: 1, off: true, share: false, items: [] });
  assert.equal(await p.isDisabled('#missShare'), true);
  await p.fill('#netQ', 'qwertyzz'); await p.press('#netQ', 'Enter');
  await p.waitForFunction(() => window.MolAstriaNetView.current().mode === 'text');
  assert.doesNotMatch(await p.innerText('#netFocus'), /已记进/);
  assert.match(await p.innerText('#missList'), /已关闭/);
  await p.waitForTimeout(300);
  assert.deepEqual(reports.map((r) => r.body.q), ['qwertyzz', 'zzqq plasmonic gizmo'], 'one report per new word, none after unticking');
  assert.deepEqual(outside, [], 'the words go nowhere else');
  await finish(p);
  const phone = await open({ viewport: { width: 390, height: 844 }, init: () => localStorage.setItem('molastria-net-misses', JSON.stringify({ v: 1, items: [{ q: 'a-very-long-unbroken-search-word-that-must-wrap-somewhere', n: 3, hits: 0, first: 1, last: 1 }] })) });
  await go(phone, '/hub/network.html');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll with a long word');
  await finish(phone);
  // The site owner sees the reported words on the account page and deletes them; other accounts do not see the card.
  const admin = await open();
  await go(admin, '/pro/account.html');
  await signIn(admin, 'owner@example.com');   // admin@example.com's five codes an hour are spent by the other checks
  await admin.waitForSelector('#misses-list li code');
  assert.equal(await admin.isVisible('#misses-card'), true);
  const words = await admin.$$eval('#misses-list li code', (els) => els.map((e) => e.textContent));
  assert.ok(words.includes('qwertyzz') && words.includes('zzqq plasmonic gizmo') && !words.includes('unsharedzz'), String(words));
  assert.match(await admin.innerText('#misses-list'), /报过 1 次 · 全文 0 条 · 最近/);
  await admin.click('[data-miss="qwertyzz"]');
  await admin.waitForFunction(() => ![...document.querySelectorAll('#misses-list li code')].some((e) => e.textContent === 'qwertyzz'));
  assert.match(await admin.innerText('#misses-msg'), /已删掉 qwertyzz/);
  await finish(admin);
  const reader = await open();
  await go(reader, '/pro/account.html');
  await signIn(reader, 'reader@uni.edu');
  assert.equal(await reader.isVisible('#misses-card'), false);
  await finish(reader);
});

check('growth card: the site owner sees sign-ups and usage on the account page, other accounts do not', async () => {
  const admin = await open();
  await go(admin, '/pro/account.html');
  await signIn(admin, 'owner@example.com');
  await admin.waitForSelector('#growth-stats dd');
  assert.equal(await admin.isVisible('#growth-card'), true);
  const stats = await admin.$$eval('#growth-stats > div', (els) => els.map((e) => [e.querySelector('dt').textContent, Number(e.querySelector('dd').firstChild.textContent)]));
  assert.equal(stats[0][0], '账号总数');
  assert.ok(stats[0][1] >= 1, String(stats));
  assert.equal(await admin.$$eval('#growth-bars span', (els) => els.length), 30);
  assert.match(await admin.getAttribute('#growth-bars', 'aria-label'), /最近 30 天每天的新注册，共 \d+ 个/);
  await admin.click('.acct-growth-recent summary');
  assert.ok((await admin.$$eval('#growth-recent code', (els) => els.map((e) => e.textContent))).every((t) => /^.\*+@/.test(t)), 'emails are masked');
  await finish(admin);
  const reader = await open();
  await go(reader, '/pro/account.html');
  await signIn(reader, 'reader@uni.edu');
  assert.equal(await reader.isVisible('#growth-card'), false);
  await finish(reader);
});

check('narrow phones: no sideways scroll at 320–390 px on the main pages; the video tour downloads nothing until asked', async () => {
  for (const width of [320, 360, 375]) {
    const p = await open({ viewport: { width, height: 760 } });
    for (const path of ['/index.html', '/lab/index.html', '/vision/index.html', '/manual/index.html', '/code/index.html']) {
      await go(p, path);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width} px scrolls sideways`);
    }
    await finish(p);
  }
  const v = await open();
  const parts = [];
  v.on('request', (r) => { if (r.url().endsWith('.bin')) parts.push(r.url()); });
  await v.route('**/watch/video-0*.bin', (route) => route.fulfill({ status: 200, body: Buffer.alloc(8) }));
  await go(v, '/watch/index.html');
  await v.waitForTimeout(500);
  assert.deepEqual(parts, [], 'nothing downloaded before the button');
  await v.click('#load');
  await v.waitForFunction(() => document.getElementById('load').hidden);
  await v.waitForTimeout(500);
  assert.ok(parts.length >= 1, 'the button starts the download');
  v.errors.length = 0; // the 8-byte stand-in is not a playable video
  await v.context().close();
});

check('home hero: the map shows the numbers of the search, a chip filters the catalogue, the drawing sits on the hub (also zoomed), nothing moves under reduced motion', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await go(p, '/index.html');
  const num = (sel) => p.$eval(sel, (e) => +e.textContent.replace(/\D/g, ''));
  await p.waitForFunction(() => document.getElementById('hero-total').textContent === document.getElementById('stat-total').textContent, null, { timeout: 5000 });
  const total = await num('#hero-total');
  assert.ok(total > 2000, 'the hub shows the whole catalogue');
  await p.waitForFunction(() => /^\d+$/.test(document.querySelector('.nm-node[data-type=database] b').textContent) && +document.querySelector('.nm-node[data-type=database] b').dataset.n === +document.querySelector('.nm-node[data-type=database] b').textContent);
  const counts = await p.$$eval('.nm-node', (ns) => ns.map((n) => +n.querySelector('b').dataset.n));
  assert.equal(counts.length, 6); assert.ok(counts.every((n) => n > 0) && counts.reduce((a, b) => a + b) <= total, String(counts));
  // The drawing: the hexagon is centred on the hub, each edge ends on its chip, the thread starts at the search bar.
  const geo = () => p.evaluate(() => {
    const c = (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const hub = c(document.querySelector('.nm-hub')), hex = c(document.querySelector('.hw-hex')), bar = document.getElementById('intro-search').getBoundingClientRect();
    const th = document.querySelector('.hw-thread'), a = th.getPointAtLength(0), m = th.getScreenCTM(), start = [a.x * m.a + m.e, a.y * m.d + m.f];
    const ends = [...document.querySelectorAll('.nm-node')].map((n, i) => { const e = document.querySelectorAll('.hw-edge')[i], q = e.getPointAtLength(e.getTotalLength()), k = c(n); return Math.hypot(q.x * m.a + m.e - k[0], q.y * m.d + m.f - k[1]); });
    return { off: Math.hypot(hub[0] - hex[0], hub[1] - hex[1]), start: Math.hypot(start[0] - bar.right, start[1] - (bar.top + bar.height / 2)), ends: Math.max(...ends), wide: document.documentElement.scrollWidth - innerWidth };
  });
  await p.hover('#hero-map'); await p.waitForTimeout(1600); // the ring holds still under the pointer
  let g = await geo();
  assert.ok(g.off < 2 && g.start < 2 && g.ends < 3 && g.wide <= 0, JSON.stringify(g));
  const where = () => p.$eval('.nm-node', (n) => n.style.transform.match(/-?[\d.]+/g).slice(0, 2).map(Number));
  const moved = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  await p.waitForTimeout(600);
  const held = await where(); await p.waitForTimeout(500);
  assert.ok(moved(await where(), held) < 0.25, 'held still while the pointer is on the map');
  await p.mouse.move(200, 300); await p.waitForTimeout(1200);
  assert.ok(moved(await where(), held) > 1, 'and turns again afterwards');
  // A search changes the numbers; a chip narrows the catalogue to its type, a second click clears it.
  await p.fill('#intro-q', 'Multiwfn');
  await p.waitForFunction((t) => { const n = +document.getElementById('hero-total').dataset.n; return n > 0 && n < t; }, total);
  assert.equal(await num('#result-count'), +(await p.$eval('#hero-total', (e) => e.dataset.n)));
  await p.fill('#intro-q', ''); await p.waitForFunction((t) => +document.getElementById('hero-total').dataset.n === t, total);
  await p.hover('#hero-map'); await p.waitForTimeout(1600);
  await p.click('.nm-node[data-type=database]');
  await p.waitForFunction(() => document.getElementById('type').value === 'database' && Math.abs(document.getElementById('catalog').getBoundingClientRect().top) < 200);
  assert.equal(await p.getAttribute('.nm-node[data-type=database]', 'aria-pressed'), 'true');
  assert.equal(await num('#result-count'), counts[0]);
  await p.evaluate(() => scrollTo(0, 0)); await p.hover('#hero-map'); await p.waitForTimeout(1600);
  await p.click('.nm-node[data-type=database]');
  await p.waitForFunction(() => document.getElementById('type').value === '');
  // A quick keyword fills the bar; the figures are doors.
  await p.evaluate(() => scrollTo(0, 0));
  await p.click('.hero-try [data-query="PubChem"]');
  assert.equal(await p.inputValue('#intro-q'), 'PubChem'); assert.equal(await p.inputValue('#search'), 'PubChem');
  assert.deepEqual(await p.$$eval('.metrics > a', (as) => as.map((a) => a.getAttribute('href'))), ['#catalog', 'atlas/index.html', 'hub/index.html#overview', 'manual/index.html']);
  await finish(p);
  // The site's own zoom and text size: the drawing still sits on the chips; the headline keeps to two lines.
  const z = await open({ viewport: { width: 1440, height: 900 }, init: () => { try { localStorage.setItem('molastria-zoom', '1.25'); localStorage.setItem('molastria-text', '1.15'); } catch {} } });
  await go(z, '/index.html');
  await z.hover('#hero-map'); await z.waitForTimeout(1600);
  g = await z.evaluate(() => { const c = (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }; const a = c(document.querySelector('.nm-hub')), b = c(document.querySelector('.hw-hex')), h = document.querySelector('.intro h1'); return { off: Math.hypot(a[0] - b[0], a[1] - b[1]), lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight) / (h.getBoundingClientRect().width / h.offsetWidth)) }; });
  assert.ok(g.off < 3 && g.lines === 2, JSON.stringify(g));
  await finish(z);
  // Phones: one column, no thread, nothing wider than the screen; English too.
  for (const lang of ['zh', 'en']) {
    const m = await open({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true });
    await go(m, '/index.html' + (lang === 'en' ? '?lang=en' : ''));
    await m.waitForFunction(() => document.getElementById('hero-map').classList.contains('is-live'));
    const r = await m.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth, thread: getComputedStyle(document.querySelector('.hw-thread')).display, out: [...document.querySelectorAll('.nm-node')].filter((n) => { const b = n.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth; }).length }));
    assert.deepEqual(r, { wide: 0, thread: 'none', out: 0 }, lang);
    await finish(m);
  }
  // Reduced motion: the chips stand where the stylesheet puts them and stay there; the numbers are simply written.
  const q = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await go(q, '/index.html');
  const still = await q.$eval('.nm-node', (n) => n.style.transform); await q.waitForTimeout(500);
  assert.equal(await q.$eval('.nm-node', (n) => n.style.transform), still);
  assert.equal(await q.$eval('.hw-run', (e) => getComputedStyle(e).display), 'none');
  assert.equal(await q.textContent('#hero-total'), await q.textContent('#stat-total'));
  await finish(q);
});
check('first screen: the home search box is at the top, typing waits for a pause, Enter jumps to the results; touch inputs are 16 px; the header and drawn pages do not jump', async () => {
  const p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await go(p, '/index.html');
  const top = await p.evaluate(() => document.getElementById('intro-q').getBoundingClientRect().bottom);
  assert.ok(top < 844, `the search box is below the first screen (${top})`);
  await p.click('#intro-q');
  await p.keyboard.type('Multiwfn');
  assert.equal(await p.inputValue('#search'), 'Multiwfn', 'the catalogue box follows');
  await p.waitForFunction(() => /Multiwfn/.test(document.querySelector('.result-row h3')?.textContent || ''));
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => Math.abs(document.getElementById('catalog').getBoundingClientRect().top) < 200);
  assert.match(p.url(), /[?&]q=Multiwfn/);
  for (const path of ['/index.html', '/atlas/index.html', '/journals/index.html', '/code/index.html']) {
    await go(p, path);
    const small = await p.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]),select,textarea')]
      .filter((e) => e.getBoundingClientRect().width && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id || e.className));
    assert.deepEqual(small, [], `${path}: inputs under 16 px make iPhone Safari zoom in`);
  }
  await finish(p);
  const d = await open({ init: () => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } });
  for (const path of ['/journals/index.html', '/quantum/index.html', '/videos/index.html', '/about/index.html']) {
    await go(d, path);
    await d.waitForTimeout(400);
    const cls = await d.evaluate(() => window.__cls);
    assert.ok(cls < 0.05, `${path} jumps while loading (CLS ${cls.toFixed(3)})`);
  }
  await finish(d);
});

check('English address: hreflang alternates come from the build; at ?lang=en the summary and stray Chinese full stops turn English', async () => {
  const p = await open();
  await p.route(/\/scimodels\/index\.html/, async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace('</title>', '</title><link rel="canonical" href="https://molastria.com/scimodels/"><meta property="og:url" content="https://molastria.com/scimodels/">' +
      '<script>if(/[?&]lang=en(&|$)/.test(location.search))document.querySelectorAll(\'link[rel=canonical],meta[property="og:url"]\').forEach(function(e){var a=e.tagName==="LINK"?"href":"content",u=e.getAttribute(a);e.setAttribute(a,u+(u.indexOf("?")<0?"?":"&")+"lang=en")})</script>');
    await route.fulfill({ response: res, body: html });
  });
  await go(p, '/scimodels/index.html?lang=en');
  await p.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.dataset.i18n);
  assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://molastria.com/scimodels/?lang=en');
  const desc = await p.getAttribute('meta[name=description]', 'content');
  assert.doesNotMatch(desc, HAN, desc);
  assert.match(desc, /^Science language and multimodal foundation models/);
  const stray = await p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const out = []; for (let n = w.nextNode(); n; n = w.nextNode()) if (/^\s*。\s*$/.test(n.nodeValue) && n.parentElement.offsetParent) out.push(n.parentElement.outerHTML.slice(0, 80)); return out; });
  assert.deepEqual(stray, []);
  await finish(p);
});

check('handbook: the five chapters for categories 12–16 open in both languages and link to the site pages they name', async () => {
  const p = await open();
  await go(p, '/manual/index.html#p14f-cat16');
  await p.waitForSelector('#guide-article h1');
  assert.equal(await text(p, '#guide-article h1'), '量子计算与量子化学算法');
  assert.match(await text(p, '#reader-progress'), /^22 \/ 25 · 16 · /);
  assert.ok(await p.locator('#guide-article a[href="../quantum/algorithms/index.html"]').count() > 0);
  await p.click('[data-guide-lang=en]');
  assert.match(await text(p, '#guide-article h1'), /^Quantum computing/);
  for (const [id, h1] of [['p14b-cat12', /^Quantum chemistry programs/], ['p14c-cat13', /^Periodic systems/], ['p14d-cat14', /^Wavefunction analysis/], ['p14e-cat15', /^Courses/]]) {
    await go(p, `/manual/index.html#${id}`);
    await p.waitForSelector('#guide-article h1');
    assert.match(await text(p, '#guide-article h1'), h1, id);
  }
  await finish(p);
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

check('journals: the top bar marks 期刊发表 current under 工具', async () => {
  const p = await open({ viewport: { width: 1366, height: 800 } });
  await go(p, '/journals/index.html');
  assert.equal(await p.getAttribute('.cr-mega a[data-id=journals]', 'aria-current'), 'page');
  assert.ok(await p.evaluate(() => document.querySelector('.cr-grp-btn[data-group=make]').hasAttribute('data-current')));
  await finish(p);
});

check('scimodels: 27 model cards by subcategory with official links, filters and search, details by address, price chart with its table', async () => {
  const p = await open();
  await go(p, '/scimodels/index.html');
  assert.equal(await p.getAttribute('.cr-mega a[data-id=scimodels]', 'aria-current'), 'page');
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=videos]', 'aria-current'), 'page');
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

check('math foundations: sub-module page, relations map, subject reader, self-check progress, library filters, English', async () => {
  const p = await open();
  await go(p, '/fundamental-science/index.html');
  await p.click('.fs-module');
  await p.waitForURL(/fundamental-science\/math\/index\.html/);
  assert.equal(await p.getAttribute('.cr-header a[data-id=fundamental]', 'aria-current'), 'page', 'nav marks the parent section');
  assert.equal(await p.locator('.fm-tier').count(), 3);
  assert.equal(await p.locator('#fm-graph .fm-node').count(), 12, '10 subjects + 2 goals');
  assert.equal(await p.locator('#fm-graph .fm-edge').count(), 25);
  // Clicking a node lists its links and highlights only its edges: functional analysis has la, mt in and oa, var, na, qm out.
  await p.click('#fm-graph .fm-node[data-id=fa]');
  assert.match(await text(p, '#fm-map-panel'), /泛函分析与谱理论[\s\S]*建立在这些之上[\s\S]*通向/);
  assert.equal(await p.locator('#fm-graph .fm-edge.on').count(), 6);
  // Reader: one panel at a time, MathML formulas, books with DOIs, the hash opens a subject.
  assert.equal(await p.locator('.fm-panel:not([hidden])').count(), 1);
  await p.click('.fm-side-b[data-sub=dg]');
  assert.ok(await p.isVisible('#m-dg'));
  assert.ok(await p.locator('#m-dg math').count() >= 3, 'MathML formulas render');
  assert.equal(await p.locator('#m-dg .fm-book a[href="https://doi.org/10.1098/rspa.1984.0023"]').count(), 1, 'Berry 1984 with its DOI');
  await go(p, '/fundamental-science/math/index.html#m-tn');
  assert.ok(await p.isVisible('#m-tn'));
  // Self-check ticks drive the suggestion and survive a reload.
  assert.match(await text(p, '#fm-start-box'), /线性代数/);
  await p.click('.fm-side-b[data-sub=la]');
  for (const box of await p.$$('#m-la input[data-check]')) await box.check();
  assert.match(await text(p, '#fm-start-box'), /数值分析/, 'next on the chemistry track after linear algebra');
  await p.reload();
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-fm-progress'))).length, 4);
  await p.click('#fm-reset');
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-fm-progress')), '[]');
  // Library filters.
  await p.selectOption('#fm-f-sub', 'tn');
  assert.match(await text(p, '#fm-lib-count'), /共 9 本书与论文、3 门视频课/);
  await p.selectOption('#fm-f-sub', ''); await p.check('#fm-f-free');
  assert.ok(await p.locator('#fm-lib .fm-book').count() >= 8, 'free books listed');
  assert.equal(await p.locator('#fm-lib .fm-book:not(:has(.fm-free))').count(), 0, 'only free books');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  await finish(p);
  // English: everything except original Chinese book and video titles is English.
  const e = await open();
  await go(e, '/fundamental-science/math/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.match(await text(e, '#fm-h1'), /Mathematical Foundations & Exploration/);
  assert.equal(await e.title(), 'Mathematical Foundations & Exploration · MolAstria');
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math,.fm-cite[lang="zh-CN"],.fm-cite [lang="zh-CN"],.fm-au') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('realms of physics: nav entry, graph selects from the hash, panel, filters, local graph, cube, English', async () => {
  const p = await open({ viewport: { width: 1440, height: 1000 } });
  await go(p, '/physics-realms/index.html#n-gr');
  assert.equal(await p.getAttribute('.cr-header a[data-id=realms]', 'aria-current'), 'page', 'nav entry marks the section');
  assert.equal(await p.locator('#pr-graph .pr-node').count(), await p.evaluate(() => window.MOLASTRIA_REALMS.theories.length + window.MOLASTRIA_REALMS.problems.length));
  assert.match(await text(p, '#pr-panel'), /广义相对论/);
  assert.match(await text(p, '#pr-panel'), /疆界：在这里失效/);
  assert.match(await text(p, '#pr-panel'), /水星近日点进动/, 'lists what it explains');
  // A chip in the panel moves the selection and the address.
  await p.click('#pr-panel [data-go="p-mercury"]');
  assert.match(p.url(), /#n-p-mercury$/);
  assert.match(await text(p, '#pr-panel'), /牛顿万有引力/);
  // Clicking a node on the canvas selects it.
  await p.keyboard.press('Escape');
  await p.evaluate(() => document.querySelector('#pr-graph-wrap').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await p.click('#pr-zoom [data-z=fit]'); await p.waitForTimeout(600);
  const box = await p.locator('#pr-graph .pr-node[data-id=qm] circle').boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await p.evaluate(() => window.__realms.picked()), 'qm');
  // Local graph keeps only qm and its neighbours; a branch filter hides a whole branch.
  await p.check('#pr-local');
  const n = await p.evaluate(() => window.__realms.nodes());
  assert.ok(n > 5 && n < 40, `local graph shows ${n} nodes`);
  await p.uncheck('#pr-local');
  const all = await p.evaluate(() => window.__realms.nodes());
  await p.click('.pr-bchip[data-b=cosmo]');
  assert.ok(await p.evaluate(() => window.__realms.nodes()) < all, 'branch filter hides nodes');
  await p.click('.pr-bchip[data-b=cosmo]');
  // Search: Enter picks the first match.
  await p.fill('#pr-q', 'GPS'); await p.press('#pr-q', 'Enter');
  assert.equal(await p.evaluate(() => window.__realms.picked()), 'p-gps');
  // The cube points into the graph.
  await p.click('.pr-cube-v[data-i="4"]');
  await p.click('#pr-cube-info [data-go]');
  assert.equal(await p.evaluate(() => window.__realms.picked()), 'gr');
  assert.ok(await p.locator('#pr-bounds-list .pr-bound').count() >= 40, 'one boundary card per theory');
  assert.ok(await p.locator('#pr-open-list .pr-oq').count() >= 10, 'open problems listed');
  await p.evaluate(() => localStorage.removeItem('molastria-realms-view'));
  await finish(p);
  const e = await open({ viewport: { width: 390, height: 844 } });
  await go(e, '/physics-realms/index.html?lang=en#n-qm');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.equal(await e.title(), 'Realms of Physics · MolAstria');
  assert.match(await text(e, '#pr-panel'), /Where it works/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,noscript')) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  assert.ok(await e.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on a phone');
  await finish(e);
});

check('quantum carnival: the hub links its live pavilions, the physics page computes its demos, opens chapters and is English in English', async () => {
  const h = await open();
  await go(h, '/quantum/index.html');
  assert.equal(await h.getAttribute('.cr-mega a[data-id=quantum]', 'aria-current'), 'page', 'nav marks the carnival');
  assert.equal(await h.locator('#qc-hall-grid .qc-hall').count(), 4, 'four pavilions');
  await h.click('#qc-hall-grid a[href="physics/index.html"]');
  await h.waitForSelector('#qp-panels .fm-panel');
  assert.match(h.url(), /\/quantum\/physics\/index\.html$/);
  assert.equal(await h.getAttribute('.cr-mega a[data-id=quantum]', 'aria-current'), 'page', 'nav still marks the carnival');
  assert.match(await text(h, '#qp-crumbs'), /量子嘉年华/);
  await finish(h);
  const p = await open();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await go(p, '/quantum/physics/index.html');
  assert.equal(await p.locator('#qp-act-grid .fm-tier').count(), 3, 'three acts');
  assert.equal(await p.locator('#qp-time-list li').count(), 21, 'timeline');
  // Demo 1: the harmonic oscillator ground state matches ħω/2.
  await p.fill('#d1-p', '38'); // ω = 0.4 + 1.6 × 0.38 = 1.008
  assert.match(await text(p, '#d1-read'), /0\.50[34]\d*\s*\((解析|exact) 0\.504\)/);
  await p.selectOption('#d1-kind', 'double');
  assert.match(await text(p, '#d1-read'), /隧穿劈裂/);
  // Demo 2: a deuteron tunnels far less than an electron, and the packet run moves weight past the barrier.
  const T = async () => Number((await text(p, '#d2-read .fs-big')).replace(/\s*×\s*10/, 'e').replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => '-0123456789'['⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)]));
  const te = await T(); await p.selectOption('#d2-m', 'd'); assert.ok(await T() < te * 1e-3, 'deuteron ≪ electron');
  await p.selectOption('#d2-m', 'e'); await p.click('#d2-go');
  await p.waitForFunction(() => /已穿过势垒的概率：0\.[1-9]/.test(document.querySelector('#d2-pcap').textContent), null, { timeout: 15000 });
  // Demo 3: 0°, 90°, 0° lets a quarter through; demo 4: the optimal angles give 2√2.
  assert.match(await text(p, '#d3-read'), /穿过全部三台\s*0\.25/);
  await p.click('#d3-go'); assert.match(await text(p, '#d3-chain'), /1000/);
  await p.fill('#d4-b', '10'); assert.doesNotMatch(await text(p, '#d4-read'), /-2\.828/);
  await p.click('#d4-best'); assert.match(await text(p, '#d4-read'), /量子力学的 S\s*-2\.828/);
  await p.click('#d4-go'); assert.match(await text(p, '#d4-read'), /模拟实验的 S\s*-2\.[6-9]\d*\s*±/);
  // Reader: one panel at a time, MathML, the hash opens a chapter, ticks are remembered.
  assert.equal(await p.locator('.fm-panel:not([hidden])').count(), 1);
  await p.click('.fm-side-b[data-sub=ent]');
  assert.ok(await p.isVisible('#c-ent'));
  assert.ok(await p.locator('#c-ent math').count() >= 3, 'MathML formulas render');
  assert.equal(await p.locator('#c-ent a[href="https://doi.org/10.1103/PhysRev.47.777"]').count(), 1, 'EPR with its DOI');
  await go(p, '/quantum/physics/index.html#c-cond');
  assert.ok(await p.isVisible('#c-cond'));
  await p.click('.fm-side-b[data-sub=birth]');
  for (const box of await p.$$('#c-birth input[data-check]')) await box.check();
  assert.match(await text(p, '#qp-start-box'), /薛定谔方程/, 'next chapter suggested');
  await p.reload();
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-qp-progress'))).length, 4);
  // Library filters.
  await p.selectOption('#qp-f-type', 'paper');
  assert.match(await text(p, '#qp-lib-count'), /共 36 篇论文、0 本教材与讲义、0 门课程/);
  await p.selectOption('#qp-f-type', ''); await p.check('#qp-f-free');
  assert.equal(await p.locator('#qp-lib .fm-book:not(:has(.fm-free))').count(), 0, 'only free books');
  assert.deepEqual(errs, []);
  await finish(p);
  const e = await open();
  await go(e, '/quantum/physics/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.equal(await e.title(), 'Quantum Physics · Quantum Carnival · MolAstria');
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math,.fm-cite[lang="zh-CN"],.fm-cite [lang="zh-CN"],.fm-au,.fm-video .fm-title') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
  for (const path of ['/quantum/index.html', '/quantum/physics/index.html']) {
    const m = await open({ viewport: { width: 390, height: 844 } });
    await go(m, path);
    assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll at phone width: ${path}`);
    await finish(m);
  }
});

check('quantum algorithms: ledger, map, circuit simulator, four demos, Shor calculator, reader, progress, library and English', async () => {
  const p = await open({ viewport: { width: 1360, height: 900 } });
  await go(p, '/quantum/algorithms/index.html');
  assert.match(await text(p, '#qa-crumbs'), /量子嘉年华/);
  assert.equal(await p.locator('#qa-ledger-table tbody tr').count(), 14);
  await p.click('#qa-ledger-filter [data-ev=heuristic]');
  assert.equal(await p.locator('#qa-ledger-table tbody tr').count(), 3, 'VQE, QAOA and mitigation are heuristic');
  await p.click('#qa-graph .fm-node[data-id=qpe]');
  assert.match(await text(p, '#qa-map-panel'), /相位估计/);
  assert.equal(await p.locator('#qa-graph .fm-edge.on').count(), 4);
  // Circuit simulator: GHZ gives |000⟩ and |111⟩ at 50 % each; the circuit survives a reload.
  await p.selectOption('#c-preset', 'ghz');
  assert.equal(await p.locator('#c-bars .qa-bar').count(), 8);
  assert.equal(await p.locator('#c-bars .qa-bar:not([data-zero])').count(), 2);
  assert.match(await text(p, '#c-bars'), /\|111⟩[\s\S]*50\.0%/);
  await p.click('#c-sample');
  assert.equal(await p.locator('#c-bars .qa-track b').count(), 8);
  await p.click('.qa-pal[data-g=X]'); await p.click('.qa-cell[data-q="2"][data-c="5"]');
  assert.match(await text(p, '#c-read'), /\|110⟩|\|001⟩/);
  await p.reload();
  assert.equal(await p.locator('#c-bars .qa-bar').count(), 8, 'circuit kept in localStorage');
  await p.click('#c-clear');
  // Grover: the best k for N = 256, M = 1 is 12.
  await p.fill('#g-qubits', '8'); await p.click('#g-best');
  assert.equal(await p.inputValue('#g-k'), '12');
  assert.match(await text(p, '#g-read'), /99\.99%/);
  for (const id of ['g-canvas', 'p-canvas', 't-canvas', 'v-canvas']) assert.ok(await p.evaluate((i) => document.getElementById(i).width > 300, id), `${id} drawn`);
  assert.match(await text(p, '#v-read'), /-1\.56/);
  // Reader: the hash opens a panel; the Shor calculator factors 21.
  await go(p, '/quantum/algorithms/index.html#a-shor');
  assert.ok(await p.isVisible('#a-shor'));
  assert.equal(await p.locator('#qa-panels .fm-panel:not([hidden])').count(), 1);
  assert.match(await text(p, '#a-shor [data-shor-out]'), /21 = 3 × 7/);
  await p.fill('#a-shor [data-shor-n]', '35'); await p.fill('#a-shor [data-shor-a]', '2'); await p.click('#a-shor [data-shor-go]');
  assert.match(await text(p, '#a-shor [data-shor-out]'), /35 = (5 × 7|7 × 5)/);
  assert.ok(await p.locator('#a-shor math').count() >= 2, 'MathML formulas render');
  // A demo button loads its preset into the simulator.
  await p.click('.fm-side-b[data-sub=query]');
  await p.click('#a-query a[data-demo=circuit]');
  assert.equal(await p.locator('#c-grid .qa-q').count(), 3, 'Deutsch–Jozsa preset loaded');
  // Self-checks are stored and can be cleared.
  await p.click('.fm-side-b[data-sub=mapping]');
  for (const box of await p.$$('#a-mapping input[data-check]')) await box.check();
  assert.ok(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-qa-progress'))).length >= 3);
  await p.click('#qa-reset');
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-qa-progress')), '[]');
  // Library.
  assert.equal(await p.locator('#qa-lib .fs-ref').count(), 65);
  await p.selectOption('#qa-f-kind', 'estimate');
  assert.ok(await p.locator('#qa-lib .fs-ref').count() >= 4);
  assert.equal(await p.locator('#qa-lib .fm-video').count(), 0);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  await finish(p);
  const e = await open();
  await go(e, '/quantum/algorithms/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.equal(await e.title(), 'Quantum Algorithms · MolAstria');
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math,[lang="zh-CN"],.fm-au') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

// A stand-in DeepSeek for the Study Desk: reads the TASK: marker learn-core puts on the first line of each system
// message and answers with fixed JSON (the non-streaming shape ChemAI.chat accepts).
function studyDeskAI() {
  let teach = 0, practice = 0;
  const calls = [];
  const P1 = '一个能量子的大小等于 hν。', P2 = '高频模式在 hν ≫ kT 时被冻结。', P3 = '量子化消除了紫外灾难。';
  const reply = (task, user) => {
    calls.push(task);
    switch (task) {
      case 'probe': return { goalRestated: '说清楚能量为什么是量子化的', questions: [
        { id: 'q1', kind: 'choice', prompt: '黑体辐射在紫外区的经典预言是什么？<b>粗体</b>', options: ['发散', '趋于零', '常数'], answer: 0 },
        { id: 'q2', kind: 'choice', prompt: '光子能量和频率的关系？', options: ['E ∝ 1/ν', 'E ∝ ν²', 'E = hν'], answer: 2 },
        { id: 'q3', kind: 'short', prompt: '为什么光电效应有截止频率？', answer: 'hν 要大于逸出功' },
      ] };
      case 'plan': return { goalId: 'n3', startNote: '你熟悉经典图像，从能量子开始。', nodes: [
        { id: 'n1', label: '经典波动图像', deps: [], status: 'held' },
        { id: 'n2', label: '能量子 E = hν', deps: ['n1'], status: 'todo' },
        { id: 'n3', label: '为什么能量量子化', deps: ['n2'], status: 'todo' },
      ], grades: [{ id: 'q3', correct: true, feedback: '对' }] };
      case 'teach':
        teach++;
        if (teach === 1) return { step: { node: 'n2', kind: 'teach', predict: '频率翻倍，能量子怎么变？', explain: '普朗克假设振子的能量只能是 **hν** 的整数倍 [1]。<script>alert(1)</script> [9]', diagram: { nodes: [{ id: 'a', label: 'ν' }, { id: 'b', label: 'E = hν' }], edges: [{ from: 'a', to: 'b', label: '×h' }] }, demo: (/DEMOS \(on-site, use the id\):\n([\w-]+)/.exec(user) || [])[1] || 'none', refs: [1], check: { kind: 'choice', prompt: '频率加倍时，一个能量子的大小？', options: ['减半', '加倍', '不变'], answer: 1 }, props: [P1] } };
        if (teach === 2) return { grade: { correct: false, feedback: '方向反了。', misconception: '把频率和波长弄混了' }, step: { node: 'n2', kind: 'repair', explain: '换个角度：E = hν，ν 在分子上。', check: { kind: 'choice', prompt: 'ν 变成 3 倍，E 变成？', options: ['3 倍', '1/3', '不变'], answer: 0 } } };
        if (teach === 3) return { grade: { correct: true, feedback: '对。' }, nodeDone: true, step: { node: 'n3', kind: 'teach', explain: '把能量子放回黑体：高频模式激发不起来。', check: { kind: 'short', prompt: '为什么紫外发散消失了？', answer: 'hν ≫ kT' }, props: [P2] } };
        // The goal is done; a step sent anyway (as the prompt's example shape suggests) must not keep the session going.
        return { grade: { correct: true, feedback: '很好。' }, nodeDone: true, step: { node: 'n3', kind: 'teach', explain: '多余的一步。', check: { kind: 'choice', prompt: '多余？', options: ['是', '否'], answer: 0 } } };
      case 'summary': return { goalSentence: '能量只能一份一份地交换，每份 hν，所以高频模式冻结。', props: [P1, P2, P3], chains: [{ premises: [P1, P2], conclusion: P3 }] };
      case 'practice':
        practice++;
        return { topic: `能量子 ${practice}`, problem: `绿光和红光，哪个的光子能量大？（第 ${practice} 题）`, kind: 'choice', options: ['红光', '一样', '绿光'], answer: 2, hints: ['想想频率', 'E = hν', '绿光频率更高'], solution: '绿光频率更高，所以 E 更大。' };
      case 'practiceGrade': return { correct: true, feedback: '对。' };
      case 'photo': return { transcript: '[photo 1]\n题 3：氢原子 n = 2 能级的能量是多少？\n[figure] 能级图，n = 1 到 4', goal: '弄懂氢原子的能级公式' };
      default: return {};
    }
  };
  const route = async (r) => {
    const body = JSON.parse(r.request().postData());
    const task = /^TASK: (\w+)/.exec(body.messages[0].content)?.[1];
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'deepseek-v4-flash', choices: [{ message: { content: JSON.stringify(reply(task, body.messages.at(-1).content)) } }], usage: { prompt_tokens: 100, completion_tokens: 23, total_tokens: 123 } }) });
  };
  return { route, calls };
}
const studyKey = () => { try { localStorage.setItem('chemhub-ai', JSON.stringify({ provider: 'deepseek', remember: true, keys: { deepseek: 'sk-test' } })); } catch {} };

// A small red-and-blue PNG, made in the page so no binary file sits in the repo.
const pngIn = (p) => p.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 40; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 32, 40); g.fillStyle = '#36c'; g.fillRect(32, 0, 32, 40); return c.toDataURL('image/png').split(',')[1]; });
const pastePng = (p, selector, b64) => p.evaluate(([sel, b]) => {
  const bytes = Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0));
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], 'screenshot.png', { type: 'image/png' }));
  document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, [selector, b64]);

check('photos: the AI panel takes pasted and picked photos (text still works), the Study Desk reads them into editable text', async () => {
  const p = await open({ init: studyKey, reducedMotion: 'reduce' });
  const bodies = [];
  await p.route('https://api.deepseek.com/**', async (r) => {
    const body = JSON.parse(r.request().postData());
    bodies.push(body);
    if (/^TASK: /.test(body.messages[0].content)) return studyDeskAI().route(r);
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: body.model, choices: [{ message: { content: '图里左边红色、右边蓝色。' } }], usage: { prompt_tokens: 300, completion_tokens: 12 } }) });
  });
  await go(p, '/index.html');
  const b64 = await pngIn(p);
  await p.evaluate(() => window.ChemHub.loadAI().then((ai) => ai.openDrawer({ mode: 'free' })));
  await p.waitForSelector('.cai-drawer[data-open=true]');
  // Plain text first, exactly as before.
  await p.fill('#cai-input', '什么是 DFT？');
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.cai-msg.bot .cai-body').length === 1 && !document.querySelector('.cai-msg.bot')?.textContent.includes('生成中'));
  assert.equal(typeof bodies.at(-1).messages.at(-1).content, 'string', 'text only stays a plain string');
  // One photo from the picture button, one pasted; then a question.
  await p.setInputFiles('.cai-drawer [data-attach]', { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await p.waitForSelector('.cai-tray .cai-thumb img');
  await pastePng(p, '#cai-input', b64);
  await p.waitForFunction(() => document.querySelectorAll('.cai-tray .cai-thumb img').length === 2);
  await p.fill('#cai-input', '这张图是什么颜色？');
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.cai-msg.user .cai-pics img').length === 2);
  await p.waitForFunction((n) => document.querySelectorAll('.cai-msg.bot .cai-body').length === n, 2);
  let last = bodies.at(-1).messages.at(-1).content;
  assert.ok(Array.isArray(last), 'photos go as content parts');
  assert.equal(last[0].text, '这张图是什么颜色？');
  assert.deepEqual(last.slice(1).map((x) => x.image_url.url.slice(0, 23)), ['data:image/jpeg;base64,', 'data:image/jpeg;base64,']);
  assert.equal(bodies.at(-1).model, 'deepseek-flash');
  assert.equal(await p.locator('.cai-tray').isHidden(), true, 'tray empties after sending');
  // A follow-up in words: earlier photos are not sent again, the model is told they were there.
  await p.fill('#cai-input', '那蓝色是什么意思？');
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction((n) => document.querySelectorAll('.cai-msg.bot .cai-body').length === n, 3);
  const msgs = bodies.at(-1).messages;
  assert.equal(typeof msgs.at(-1).content, 'string');
  assert.ok(msgs.some((m) => typeof m.content === 'string' && /附了 2 张图/.test(m.content)), 'earlier photos noted in words');
  assert.ok(!JSON.stringify(msgs).includes('image_url'), 'no image resent');
  // V4 Pro does not read images: a photo question goes to Flash instead.
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('chemhub-ai')); s.models = { deepseek: 'deepseek-v4-pro' }; localStorage.setItem('chemhub-ai', JSON.stringify(s)); document.dispatchEvent(new Event('chemhub:ai-config')); });
  await pastePng(p, '#cai-input', b64);
  await p.waitForSelector('.cai-tray-note');
  assert.match(await text(p, '.cai-tray-note'), /deepseek-flash/);
  await p.press('#cai-input', 'Enter'); // a photo with no words gets a default question
  await p.waitForFunction((n) => document.querySelectorAll('.cai-msg.bot .cai-body').length === n, 4);
  assert.equal(bodies.at(-1).model, 'deepseek-flash');
  assert.match(bodies.at(-1).messages.at(-1).content[0].text, /请看这张图/);
  // Study Desk: paste a photo into the goal; the AI reads it, fills the empty goal, and the text can be edited.
  await go(p, '/learn/index.html#learn');
  await p.waitForSelector('#ln-goal');
  await pastePng(p, '#ln-goal', b64);
  await p.waitForSelector('.ln-photo-text textarea', { state: 'attached' });
  assert.equal(await p.inputValue('#ln-goal'), '弄懂氢原子的能级公式', 'goal suggested from the photo');
  assert.equal(await p.locator('.ln-photo .ln-thumbs img').count(), 1);
  const read = bodies.at(-1);
  assert.equal(read.model, 'deepseek-flash');
  assert.match(read.messages[0].content, /^TASK: photo/);
  assert.equal(read.messages[1].content.filter((x) => x.type === 'image_url').length, 1);
  await p.click('.ln-photo-text summary');
  await p.fill('.ln-photo-text textarea', '题 3：氢原子 n = 2 能级的能量（我改过）');
  await p.click('[data-act=new]');
  await p.waitForSelector('.ln-q');
  const probe = bodies.find((b) => /^TASK: probe/.test(b.messages[0].content));
  assert.equal(typeof probe.messages[1].content, 'string', 'the probe gets text, not the photo');
  assert.match(probe.messages[1].content, /我改过/, 'the edited transcript goes with the session');
  assert.ok(!JSON.stringify(probe).includes('image_url'));
  assert.ok(!(await p.evaluate(() => localStorage.getItem('molastria-learn'))).includes('data:image'), 'photos are not stored');
  await finish(p);
});

// Files and voice. pdf.js comes from jsDelivr on the site; here it is served from tools/e2e/node_modules.
const pdfjsLocal = (ctx) => ctx.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[\d.]+\/build\/(pdf(?:\.worker)?\.min\.mjs)$/, (r) => r.fulfill({
  contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' },
  body: readFileSync(new URL(`./node_modules/pdfjs-dist/build/${/build\/(.+)$/.exec(r.request().url())[1]}`, import.meta.url))
}));
const aiFixture = (n) => readFileSync(join(ROOT, 'tools/ai-fixtures', n));
// A stand-in for the browser's speech recognizer: says the words in window.__say, a partial result first, then final.
function fakeSpeech() {
  try { localStorage.setItem('chemhub-ai', JSON.stringify({ provider: 'deepseek', remember: true, keys: { deepseek: 'sk-test' } })); } catch {}
  window.__speech = [];
  class FakeRecognition {
    start() {
      window.__speech.push({ lang: this.lang, continuous: this.continuous, interim: this.interimResults });
      const words = window.__say || '你好';
      const res = (text, isFinal) => { const r = [{ transcript: text }]; r.isFinal = isFinal; return r; };
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [res(words.slice(0, 2), false)] }), 30);
      setTimeout(() => this.onresult?.({ resultIndex: 0, results: [res(words, true)] }), 80);
      this.timer = setTimeout(() => this.onend?.(), 2000);
    }
    stop() { clearTimeout(this.timer); setTimeout(() => this.onend?.(), 10); }
    abort() { this.stop(); }
  }
  window.webkitSpeechRecognition = FakeRecognition;
  delete window.SpeechRecognition;
}

check('files and voice: the AI panel reads PDF, Word, Excel, PowerPoint and chemistry files into the question, dictation types at the caret; the Study Desk takes the same', async () => {
  const p = await open({ init: fakeSpeech, reducedMotion: 'reduce' });
  await pdfjsLocal(p.context());
  const bodies = [];
  await p.route('https://api.deepseek.com/**', async (r) => {
    const body = JSON.parse(r.request().postData());
    bodies.push(body);
    if (/^TASK: /.test(body.messages[0].content)) return studyDeskAI().route(r);
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: body.model, choices: [{ message: { content: '读完了。' } }], usage: { prompt_tokens: 900, completion_tokens: 4 } }) });
  });
  await go(p, '/index.html');
  await p.evaluate(() => window.ChemHub.loadAI().then((ai) => ai.openDrawer({ mode: 'free' })));
  await p.waitForSelector('.cai-drawer[data-open=true]');
  assert.match(await p.$eval('.cai-drawer [data-attach]', (e) => e.accept), /\.pdf,.*\.docx.*\.xyz/, 'the picker offers documents and structures');
  const xyz = '3\nwater\nO 0.000 0.000 0.117\nH 0.000 0.757 -0.469\nH 0.000 -0.757 -0.469\n';
  await p.setInputFiles('.cai-drawer [data-attach]', [
    { name: 'water.xyz', mimeType: '', buffer: Buffer.from(xyz) },
    { name: 'sample.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: aiFixture('sample.docx') },
    { name: 'sample.pdf', mimeType: 'application/pdf', buffer: aiFixture('sample.pdf') },
    { name: 'sample.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: aiFixture('sample.xlsx') }
  ]);
  await p.waitForFunction(() => document.querySelectorAll('.cai-tray .cai-doc').length === 4 && !document.querySelector('.cai-tray .cai-busy'), null, { timeout: 30000 });
  assert.match(await text(p, '.cai-tray'), /water\.xyz[\s\S]*XYZ 坐标[\s\S]*sample\.pdf[\s\S]*PDF[\s\S]*共 1 页/);
  // remove one, then ask
  await p.click('.cai-doc:nth-child(4) [data-act=undoc]');
  await p.waitForFunction(() => document.querySelectorAll('.cai-tray .cai-doc').length === 3);
  await p.fill('#cai-input', '这几个文件说的是同一个分子吗？');
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.cai-msg.user .cai-files > span').length === 3);
  await p.waitForFunction(() => document.querySelectorAll('.cai-msg.bot .cai-body').length === 1 && !document.querySelector('.cai-msg.bot').textContent.includes('生成中'));
  let sent = bodies.at(-1).messages.at(-1).content;
  assert.equal(typeof sent, 'string', 'documents go as text');
  assert.ok(sent.startsWith('这几个文件说的是同一个分子吗？\n\n下面是提问者附上的 3 个文件'), sent.slice(0, 80));
  assert.match(sent, /【附件：water\.xyz（XYZ 坐标，\d+ 字）】\n```\n3\nwater\nO 0\.000/);
  assert.match(sent, /【附件：sample\.docx（Word，[^】]+）】[\s\S]*O–H 键长 0\.961 Å[\s\S]*104\.5°/);
  assert.match(sent, /【附件：sample\.pdf（PDF，\d+ 字，1 页）】\n```\n\[第 1 页\]\n[\s\S]*水分子的几何优化[\s\S]*-76\.4636/, 'the PDF text layer, Chinese included');
  assert.ok(!sent.includes('sample.xlsx'), 'the removed file is not sent');
  // A follow-up with your own key: the documents go again (the model has no memory); the saved history keeps names only.
  await p.fill('#cai-input', '键角是多少？');
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction((n) => document.querySelectorAll('.cai-msg.bot .cai-body').length === n, 2);
  const follow = bodies.at(-1).messages;
  assert.equal(follow.at(-1).content, '键角是多少？');
  assert.ok(follow.some((m) => m.role === 'user' && /【附件：sample\.docx/.test(m.content)), 'earlier documents sent again');
  const saved = await p.evaluate(() => sessionStorage.getItem('chemhub-ai-history'));
  assert.ok(saved.includes('sample.docx') && !saved.includes('104.5°'), 'history keeps the file names, not their text');
  // A long output: beginning and end go, the middle is left out and said so; a file with no words gets a default question.
  const log = `${'Iteration    Energy (Eh)\n'.repeat(5000)}FINAL SINGLE POINT ENERGY     -76.463600\n****ORCA TERMINATED NORMALLY****\n`;
  await p.setInputFiles('.cai-drawer [data-attach]', { name: 'job.out', mimeType: '', buffer: Buffer.from(log) });
  await p.waitForSelector('.cai-tray .cai-doc');
  assert.match(await text(p, '.cai-tray-note'), /超过一次能发的 100,000 字/);
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction((n) => document.querySelectorAll('.cai-msg.bot .cai-body').length === n, 3);
  sent = bodies.at(-1).messages.at(-1).content;
  assert.match(sent, /^请读一下这个文件/);
  assert.match(sent, /太长，只附了开头和结尾/);
  assert.match(sent, /中间省略约 \d+ 字/);
  assert.match(sent, /FINAL SINGLE POINT ENERGY {5}-76\.463600\n\*\*\*\*ORCA TERMINATED NORMALLY\*\*\*\*\n```$/, 'the end of the output, where the results are, is kept');
  assert.ok(sent.length < 101500);
  assert.match(await p.locator('.cai-msg.user .cai-files').last().textContent(), /job\.out（只发了首尾）/);
  // Things it cannot read say why.
  await p.setInputFiles('.cai-drawer [data-attach]', { name: 'old.doc', mimeType: 'application/msword', buffer: Buffer.from('\xd0\xcf\x11\xe0', 'latin1') });
  await p.waitForFunction(() => /另存为 \.docx/.test(document.querySelector('.cai-tray-note')?.textContent || ''));
  await p.setInputFiles('.cai-drawer [data-attach]', { name: 'blob.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2, 0, 255, 0]) });
  await p.waitForFunction(() => /不是文本文件/.test(document.querySelector('.cai-tray-note')?.textContent || ''));
  assert.equal(await p.locator('.cai-tray .cai-doc').count(), 0);
  // Voice: words go in at the caret, live, and the button shows it is listening until clicked again.
  await p.fill('#cai-input', '请解释和区别');
  await p.evaluate(() => { window.__say = '密度泛函'; const t = document.querySelector('#cai-input'); t.focus(); t.setSelectionRange(3, 3); });
  await p.click('.cai-drawer [data-act=mic]');
  await p.waitForFunction(() => document.querySelector('#cai-input').value === '请解释密度泛函和区别');
  assert.equal(await p.getAttribute('.cai-drawer [data-act=mic]', 'aria-pressed'), 'true');
  assert.deepEqual(await p.evaluate(() => window.__speech.at(-1)), { lang: 'zh-CN', continuous: true, interim: true });
  await p.click('.cai-drawer [data-act=mic]');
  await p.waitForFunction(() => document.querySelector('.cai-drawer [data-act=mic]').getAttribute('aria-pressed') === 'false');
  assert.equal(await p.inputValue('#cai-input'), '请解释密度泛函和区别');
  // Sending while listening sends what is there and stops listening; late words do not come back into the empty box.
  await p.fill('#cai-input', '');
  await p.click('.cai-drawer [data-act=mic]');
  await p.waitForFunction(() => document.querySelector('#cai-input').value === '密度泛函');
  await p.press('#cai-input', 'Enter');
  await p.waitForFunction((n) => document.querySelectorAll('.cai-msg.bot .cai-body').length === n, 4);
  assert.equal(bodies.at(-1).messages.at(-1).content, '密度泛函');
  await p.waitForTimeout(150);
  assert.equal(await p.inputValue('#cai-input'), '');
  // Study Desk: a Word file in the attachments, the goal said aloud.
  await go(p, '/learn/index.html#learn');
  await p.waitForSelector('#ln-goal');
  await p.evaluate(() => { window.__say = '弄懂水分子的键角'; });
  await p.$eval('.ln-mic[data-target=ln-goal]', (b) => b.click()); // (a click at the very top would land on the sticky header)
  await p.waitForFunction(() => document.querySelector('#ln-goal').value === '弄懂水分子的键角');
  await p.$eval('.ln-mic[data-target=ln-goal]', (b) => b.click()); // (a click at the very top would land on the sticky header)
  await p.setInputFiles('#ln-files', { name: 'sample.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: aiFixture('sample.docx') });
  await p.waitForFunction(() => /sample\.docx/.test(document.querySelector('.ln-file-list')?.textContent || ''));
  await p.click('[data-act=new]');
  await p.waitForSelector('.ln-q');
  const probe = bodies.find((b) => /^TASK: probe/.test(b.messages[0].content));
  assert.match(probe.messages[1].content, /弄懂水分子的键角/);
  assert.match(probe.messages[1].content, /104\.5°/, 'the Word text goes with the session');
  await finish(p);
  // Without a recognizer (Firefox, the desktop app) the button explains the system's own dictation.
  const q = await open({ init: () => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; }, reducedMotion: 'reduce' });
  await go(q, '/index.html');
  await q.evaluate(() => window.ChemHub.loadAI().then((ai) => ai.openDrawer({ mode: 'free' })));
  await q.waitForSelector('.cai-drawer[data-open=true]');
  await q.click('.cai-drawer [data-act=mic]');
  await q.waitForFunction(() => /语音输入|听写|麦克风/.test(document.querySelector('.cai-tray-note')?.textContent || ''));
  assert.equal(await q.getAttribute('.cai-drawer [data-act=mic]', 'aria-pressed'), 'false');
  await finish(q);
});

check('study desk: probe, plan, one step with a check and a repair, practice, knowledge graph, export', async () => {
  const p = await open({ init: studyKey, reducedMotion: 'reduce' });
  const ai = studyDeskAI();
  await p.route('https://api.deepseek.com/**', ai.route);
  // The chapter link on the quantum physics page opens the Study Desk with that chapter as grounding.
  await go(p, '/quantum/physics/index.html#c-birth');
  assert.equal(await p.getAttribute('#c-birth a[href$="learn/index.html#goal=qp:birth"]', 'href'), '../../learn/index.html#goal=qp:birth');
  await p.click('#c-birth a[href$="#goal=qp:birth"]');
  await p.waitForFunction(() => document.querySelector('#ln-goal')?.value.length > 0);
  assert.equal(await p.getAttribute('.cr-mega a[data-id=learn]', 'aria-current'), 'page', 'nav marks the Study Desk');
  assert.equal(await p.locator('.ln-chip-src').count(), 1, 'chapter chosen as grounding');
  // Probe: three questions, the model's HTML is shown as text, confidence is required.
  await p.click('[data-act=new]');
  await p.waitForSelector('.ln-q');
  const qs = p.locator('.ln-q');
  assert.equal(await qs.count(), 3);
  assert.equal(await p.locator('.ln-q b').count(), 0, 'no model HTML');
  await qs.nth(0).locator('.ln-opt').nth(0).click(); await qs.nth(0).locator('.ln-seg label').nth(0).click();
  await qs.nth(1).locator('.ln-opt').nth(0).click();
  await p.click('[data-act=probe-submit]');
  assert.ok((await qs.nth(1).locator('.ln-hint-msg').textContent()).length > 0, 'asks how sure');
  await qs.nth(1).locator('.ln-seg label').nth(0).click();
  await qs.nth(2).locator('textarea').first().fill('光子能量要大于逸出功');
  await qs.nth(2).locator('.ln-seg label').nth(2).click();
  await p.click('[data-act=probe-submit]');
  // Plan: three nodes, the held one marked, a note on calibration (one answer was wrong while "sure").
  await p.waitForSelector('.ln-plan .lg-pnode');
  assert.equal(await p.locator('.lg-pnode').count(), 3);
  assert.ok(await p.locator('.ln-calib').count() >= 1, 'calibration note');
  // Teach: predict first, explanation without the script tag or the invented [9], a diagram and a demo card.
  await p.click('[data-act=teach-start]');
  await p.waitForSelector('.ln-step .ln-predict');
  await p.fill('.ln-predict textarea', '变大');
  await p.click('[data-act=reveal]:not([data-skip])');
  await p.waitForSelector('.ln-step .ln-prose');
  const prose = await p.locator('.ln-step .ln-prose').first().innerHTML();
  assert.doesNotMatch(prose, /<script|\[9\]/);
  assert.ok(await p.locator('.ln-step svg').count() >= 1, 'diagram drawn');
  assert.equal(await p.locator('.ln-step .ln-demo').count(), 1, 'demo card');
  // A wrong answer brings a repair step on the same point.
  const s1 = p.locator('.ln-step').nth(0);
  await s1.locator('.ln-opt').nth(0).click(); await s1.locator('.ln-seg label').nth(1).click();
  await s1.locator('[data-act=check-submit]').click();
  await p.waitForSelector('.ln-step.is-repair');
  assert.equal(await s1.locator('.ln-answered.is-wrong').count(), 1);
  assert.equal(await p.locator('.ln-miscon').count(), 1, 'misconception shown');
  const s2 = p.locator('.ln-step').nth(1);
  await s2.locator('.ln-opt').nth(0).click(); await s2.locator('.ln-seg label').nth(0).click();
  await s2.locator('[data-act=check-submit]').click();
  await p.waitForFunction(() => document.querySelectorAll('.ln-step').length === 3);
  const s3 = p.locator('.ln-step').nth(2);
  await s3.locator('textarea').first().fill('hν ≫ kT'); await s3.locator('.ln-seg label').nth(0).click();
  await s3.locator('[data-act=check-submit]').click();
  // Summary: the goal sentence, then the ticked claims and the chain go into the knowledge graph.
  await p.waitForSelector('#ln-summary .ln-goalsent');
  await p.click('[data-act=summary-add]');
  await p.waitForSelector('#ln-summary .ln-picks[disabled]');
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-learn')));
  assert.equal(st.props.length, 3); assert.equal(st.chains.length, 1);
  // The fourth teach call only grades the last check and closes the goal (the extra step in its reply is dropped).
  assert.equal(await p.locator('#ln-summary').count(), 1);
  assert.deepEqual(ai.calls, ['probe', 'plan', 'teach', 'teach', 'teach', 'teach', 'summary']);
  assert.equal(st.usage.calls, 7); assert.equal(st.usage.tokens, 7 * 123);
  // Practice: the topic stays hidden until the answer, hints come one at a time.
  await p.click('.ln-tab[data-tab=practice]');
  await p.selectOption('#pr-k', '3');
  await p.click('[data-act=practice-start]');
  await p.waitForSelector('.ln-item');
  const it = p.locator('.ln-item').nth(0);
  assert.doesNotMatch(await it.innerText(), /能量子 1/, 'topic not named before answering');
  await p.click('[data-act=hint]'); await p.click('[data-act=hint]');
  assert.equal(await p.locator('.ln-hints li').count(), 2);
  await it.locator('.ln-opt').nth(2).click(); await it.locator('.ln-seg label').nth(0).click();
  await it.locator('[data-act=practice-submit]').click();
  await p.waitForSelector('.ln-item .ln-answered.is-right');
  assert.match(await it.innerText(), /能量子 1/, 'topic revealed');
  for (let n = 2; n <= 3; n++) {
    await p.click('[data-act=practice-next]');
    await p.waitForFunction((k) => document.querySelectorAll('.ln-item').length === k, n);
    const x = p.locator('.ln-item').nth(n - 1);
    await x.locator('.ln-opt').nth(2).click(); await x.locator('.ln-seg label').nth(1).click();
    await x.locator('[data-act=practice-submit]').click();
    await p.waitForFunction((k) => document.querySelectorAll('.ln-item .ln-answered.is-right').length === k, n);
  }
  await p.click('[data-act=practice-next]');
  await p.waitForSelector('#pr-done');
  assert.match(await text(p, '#pr-done .ln-big'), /3\s*\/\s*3/);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-learn')));
  assert.ok(st.props.some((x) => x.practiced?.n > 0), 'practice recorded on the claims');
  // Knowledge graph: three nodes; selecting one opens its card; deleting it removes the node and its chain.
  await p.click('.ln-tab[data-tab=graph]');
  await p.waitForSelector('.lg-kn');
  assert.equal(await p.locator('.lg-kn').count(), 3);
  await p.locator('#ln-kg').scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  const box = await p.locator('.lg-kn circle').first().boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForSelector('#ln-kg-card [data-act=kg-del]');
  await p.$eval('#ln-kg-card [data-act=kg-del]', (b) => b.click());
  await p.waitForFunction(() => document.querySelectorAll('.lg-kn').length === 2);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-learn')));
  assert.equal(st.props.length, 2); assert.equal(st.chains.length, 0);
  // Data: export, then merging the export back changes nothing; a prompt edit is saved and reset.
  await p.click('.ln-tab[data-tab=data]');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=export]')]);
  const exported = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  assert.equal(exported.state.props.length, 2);
  await p.setInputFiles('#data-file', await dl.path());
  await p.waitForSelector('#data-pi');
  await p.click('[data-act=import-merge]');
  await p.waitForTimeout(200);
  const merged = await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-learn')));
  assert.equal(merged.props.length, 2); assert.equal(merged.usage.calls, exported.state.usage.calls, 'usage not counted twice');
  await p.locator('.ln-prompt[data-key=teach] summary').click();
  await p.fill('#pr-teach', 'CUSTOM {lang} prompt');
  await p.click('[data-act=prompt-save][data-key=teach]');
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-learn-prompts'))).teach, 'CUSTOM {lang} prompt');
  await p.click('[data-act=prompt-reset][data-key=teach]');
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-learn-prompts')) || '{}').teach, undefined);
  await finish(p);

  // English at phone width: the math page's subject link fills the goal, the probe, the map and a step appear, and no
  // Chinese is left in the page chrome on any tab. The page's own fixed text is in L() spans (translate="no" lang="en"),
  // so those are checked; only data containers (translate="no" without lang: what the model or the learner wrote) are skipped.
  const e = await open({ init: studyKey, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  await e.route('https://api.deepseek.com/**', studyDeskAI().route);
  await go(e, '/fundamental-science/math/index.html?lang=en');
  const href = await e.getAttribute('.fm-panel:not([hidden]) a[href*="learn/index.html#goal=fm:"]', 'href');
  assert.match(href, /^\.\.\/\.\.\/learn\/index\.html#goal=fm:[\w-]+$/);
  await go(e, `/learn/index.html?lang=en${href.slice(href.indexOf('#'))}`);
  await e.waitForFunction(() => /^Understand/.test(document.querySelector('#ln-goal')?.value || ''));
  await e.click('[data-act=new]');
  await e.waitForSelector('.ln-q');
  const hanLeft = async (where) => {
    await e.waitForFunction(() => !document.documentElement.dataset.i18n);
    await e.waitForTimeout(300);
    const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,noscript,textarea,[translate=no]:not([lang])')) out.push(n.nodeValue.trim()); return out; });
    assert.deepEqual(han, [], `no Chinese left on the English page (${where})`);
    assert.ok(await e.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no sideways scroll on a phone (${where})`);
  };
  await hanLeft('probe');
  // Focus moves to the questions when they arrive.
  assert.equal(await e.evaluate(() => document.activeElement?.id), 'ln-probe-h');
  const eq = e.locator('.ln-q');
  await eq.nth(0).locator('.ln-opt').nth(0).click(); await eq.nth(0).locator('.ln-seg label').nth(0).click();
  await eq.nth(1).locator('.ln-opt').nth(2).click(); await eq.nth(1).locator('.ln-seg label').nth(1).click();
  await e.click('[data-act=probe-submit]');
  await e.waitForSelector('.ln-plan .lg-pnode');
  assert.equal(await e.evaluate(() => document.activeElement?.id), 'ln-plan-h');
  await hanLeft('map');
  await e.click('[data-act=teach-start]');
  await e.waitForSelector('.ln-step .ln-predict');
  await e.click('[data-act=reveal][data-skip]');
  await e.waitForSelector('.ln-step .ln-prose');
  await hanLeft('step');
  const refSources = await e.evaluate(() => [...document.querySelectorAll('.ln-refs small')].map((x) => x.textContent));
  assert.ok(refSources.every((x) => !/[㐀-鿿]/.test(x)), `reference sources in English: ${refSources}`);
  for (const tab of ['practice', 'graph', 'import', 'data', 'learn']) {
    await e.click(`.ln-tab[data-tab=${tab}]`);
    await e.waitForFunction((t) => document.getElementById('ln-panel').dataset.tab === t, tab);
    await hanLeft(`#${tab}`);
  }
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
  assert.equal(await p.getAttribute('.cr-mega a[data-id=digest]', 'aria-current'), 'page');
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
    // The line now starts with the About link (阿斯特赖亚科技), so look for the TRADEMARKS.md link itself.
    assert.equal(await p.locator('.cr-legal a[href$="TRADEMARKS.md"]').count(), 1, path);
  }
  await go(p, '/radar/index.html');
  assert.equal(await p.locator('.cr-legal').count(), 0, 'not on the radar page');
  await finish(p);
});

check('pinned sections: pin from the menu, they show in the header in order, the glass panel reorders and clears, kept after reload', async () => {
  const p = await open({ viewport: { width: 1440, height: 900 } });
  await go(p, '/manual/index.html');
  const pinned = () => p.$$eval('.cr-pins a[data-id]', (a) => a.filter((x) => x.offsetWidth).map((x) => x.dataset.id));
  assert.deepEqual(await pinned(), [], 'nothing pinned by default');
  await p.click('.cr-grp-btn[data-group=learn]');
  await p.hover('.cr-cell[data-id=videos]');
  await p.click('.cr-pin-t[data-pin=videos]');
  await p.click('.cr-grp-btn[data-group=find]');
  await p.hover('.cr-cell[data-id=atlas]');
  await p.click('.cr-pin-t[data-pin=atlas]');
  assert.equal(await p.getAttribute('.cr-pin-t[data-pin=atlas]', 'aria-pressed'), 'true');
  assert.deepEqual(await pinned(), ['videos', 'atlas']);
  assert.deepEqual(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-nav-pins'))), ['videos', 'atlas']);
  await p.keyboard.press('Escape');
  // the panel: arrow keys move a tile, the pool adds one, Delete removes one
  await p.click('#cr-disp');
  await p.click('.cr-disp-arr');
  await p.waitForSelector('.cr-arrange.open');
  await p.focus('.cr-arr-tile[data-id=atlas]');
  await p.keyboard.press('ArrowLeft');
  assert.deepEqual(await pinned(), ['atlas', 'videos'], 'moved with the keyboard');
  await p.click('.cr-arr-chip[data-add=code]');
  assert.deepEqual(await pinned(), ['atlas', 'videos', 'code']);
  await p.focus('.cr-arr-tile[data-id=videos]');
  await p.keyboard.press('Delete');
  assert.deepEqual(await pinned(), ['atlas', 'code']);
  await p.click('.cr-arr-done');
  await p.waitForSelector('.cr-arrange', { state: 'hidden' });
  await go(p, '/index.html');
  assert.deepEqual(await pinned(), ['atlas', 'code'], 'kept on the next page');
  // a pinned link is a plain link; the current page is marked
  await p.click('.cr-pins a[data-id=atlas]');
  await p.waitForURL(/\/atlas\/index\.html/);
  assert.equal(await p.getAttribute('.cr-pins a[data-id=atlas]', 'aria-current'), 'page');
  // dragging a pinned link along the header reorders it without opening it
  const url = p.url();
  const from = await (await p.$('.cr-pins a[data-id=code]')).boundingBox(), to = await (await p.$('.cr-pins a[data-id=atlas]')).boundingBox();
  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) await p.mouse.move(from.x + from.width / 2 + ((to.x + 4 - from.x - from.width / 2) * i) / 12, from.y + from.height / 2 + 1);
  await p.mouse.up();
  assert.equal(p.url(), url, 'the drag did not open the page');
  assert.deepEqual(await pinned(), ['code', 'atlas'], 'dragged to the front');
  // clear
  await p.click('#cr-disp');
  await p.click('.cr-disp-arr');
  await p.waitForSelector('.cr-arrange.open');
  await p.click('.cr-arr-reset');
  await p.click('.cr-arr-done');
  assert.deepEqual(await pinned(), []);
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-nav-pins')), null);
  await finish(p);
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

check('quantum computers: under the Quantum Carnival nav entry, seven parts, six platforms, three working demos, references, English', async () => {
  const p = await open();
  await go(p, '/quantum/computing/index.html');
  const setRange = (sel, v) => p.$eval(sel, (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
  const settle = () => p.waitForTimeout(80); // demos redraw on the next animation frame
  assert.equal(await p.getAttribute('.cr-header a[data-id=quantum]', 'aria-current'), 'page', 'the Quantum Carnival nav entry is current');
  assert.equal(await p.getAttribute('.qc-crumbs a', 'href'), '../index.html');
  assert.equal(await p.locator('.qc-level').count(), 3);
  assert.equal(await p.locator('.fs-pillar').count(), 7);
  assert.equal(await p.locator('.fs-tab').count(), 7);
  assert.ok(await p.locator('#s-qubit math').count() >= 3, 'MathML formulas render');
  await p.click('.fs-pillar[data-tab=qec]');
  assert.equal(await p.isVisible('#s-qec'), true);
  assert.equal(await p.isVisible('#s-qubit'), false);
  assert.equal(await p.locator('.qc-plat').count(), 6);
  assert.equal(await p.locator('#qc-timeline li').count(), 20);
  // Demo 1: default π pulse (Ω/2π = 5 MHz, T₁ = 10 μs, T₂ ≈ 4 μs), then an ideal qubit flips fully.
  assert.match(await text(p, '#b-read'), /π[\s\S]*99\.\d\d %/);
  await p.click('#b-ideal'); await settle();
  assert.match(await text(p, '#b-read'), /100\.00 %/);
  await p.click('#b-detune'); await settle();
  assert.match(await text(p, '#b-cap'), /50%/);
  // Demo 2: Sycamore-level errors on 53 qubits and 20 layers give F ≈ 0.09 % (sliders snap to 0.001 in log₁₀).
  await p.click('#c-syc'); await settle();
  assert.match(await text(p, '#c-read'), /0\.09\d\d %/);
  await p.click('#c-logical'); await settle();
  assert.match(await text(p, '#c-read'), /98\.4 %/);
  // Demo 3: repetition code below and above the threshold; the surface-code calculator at p = 0.1 %.
  assert.match(await text(p, '#q-read'), /d31(?!\d)[\s\S]*192,100/);
  await setRange('#q-p', 0.6); await settle();
  assert.match(await text(p, '#q-rep-cap'), /50%/);
  await p.click('#q-good'); await settle();
  assert.match(await text(p, '#q-read'), /d13(?!\d)/);
  // Ledger, library and the hub card.
  assert.equal(await p.locator('#qc-ledger-grid .fs-theory').count(), 7);
  await p.click('#qc-ledger-filter .fs-chip[data-kind=contested]');
  assert.equal(await p.locator('#qc-ledger-grid .fs-theory').count(), 4);
  assert.equal(await p.locator('.fs-ref').count(), 57);
  await p.click('#s-qec .fs-cite a[data-ref=google2025]');
  assert.match(await text(p, '#ref-google2025'), /below the surface code threshold/);
  await go(p, '/quantum/computing/index.html#qc-noise');
  await p.waitForTimeout(150);
  assert.equal(await p.isVisible('#s-noise'), true, '#qc-noise opens part 02');
  await finish(p);
  const e = await open();
  await go(e, '/quantum/computing/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.match(await text(e, '#qcomp-h1'), /Quantum Computers/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('Frontier AI Maths: nav entry, 44 topics and 12 appendices, working demos, the re-run of the notes’ checks, references, English', async () => {
  const p = await open();
  await go(p, '/ai-math/index.html');
  await p.waitForFunction(() => window.MOLASTRIA_AIM_READY);
  const settle = () => p.waitForTimeout(150); // demos redraw on the next animation frame
  const read = () => text(p, '#aim-panel .fs-readout');
  assert.equal(await p.getAttribute('.cr-header a[data-id=aimath]', 'aria-current'), 'page', 'the nav entry is current');
  assert.equal(await p.locator('.aim-card').count(), 56);
  assert.equal(await p.locator('#aim-select option').count(), 56);
  assert.equal(await p.locator('.aim-part').count(), 8);
  // Topic 01 is open; its formulas are MathML and the demo has drawn something.
  assert.ok(await p.locator('#aim-panel math').count() >= 2, 'MathML formulas render');
  assert.equal(await p.locator('#aim-panel .aim-demo').count(), 1);
  assert.ok(await p.evaluate(() => [...document.querySelectorAll('#aim-panel canvas')].every((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })), 'every canvas of the demo is painted');
  // Topic 11: the worked attention example of the notes, then the mask.
  await p.click('.aim-card[data-open="11"]'); await settle();
  assert.equal(await p.evaluate(() => location.hash), '#t-11');
  assert.match(await read(), /0\.401, 0\.198, 0\.401[\s\S]*0\.802, 0\.797/);
  await p.check('#aim-panel .aim-check input'); await settle();
  assert.match(await read(), /0\.500, 0\.500, 0\.000|0\.670, 0\.330, 0\.000/);
  // Topic 33: the tilted policy with β = 1 and rewards (0, 1, −1).
  await p.selectOption('#aim-select', '33'); await settle();
  assert.match(await read(), /0\.2055[\s\S]*0\.3133/);
  await p.click('#aim-panel [data-preset="0"]'); await settle();
  assert.doesNotMatch(await read(), /0\.2055|NaN|undefined/);
  // Next / previous, and the seen mark.
  await p.click('#aim-next'); await settle();
  assert.equal(await p.evaluate(() => location.hash), '#t-34');
  assert.ok((await p.evaluate(() => JSON.parse(localStorage.getItem('molastria-aim')).seen)).includes('33'));
  assert.equal(await p.locator('.aim-card.is-seen').count() >= 3, true);
  // Appendix K re-runs the notes’ numerical checks in the browser: the twelve error-table numbers agree.
  await go(p, '/ai-math/index.html#a-K');
  await p.waitForFunction(() => window.MOLASTRIA_AIM_READY); await p.waitForTimeout(300);
  assert.match(await text(p, '#aim-panel'), /三个可复现数值检查/);
  assert.match(await read(), /逐位一致/);
  assert.match(await text(p, '#aim-panel'), /0\.1575[\s\S]*0\.2100[\s\S]*1\.595e-1 \/ 4\.835e-3[\s\S]*5\.755e-3 \/ 1\.401e-5/);
  // Quiz, audit, references.
  assert.equal(await p.locator('#aim-quiz-list details').count(), 10);
  assert.ok(await p.locator('#aim-audit-body li').count() >= 8);
  assert.equal(await p.locator('.fs-ref').count(), 43);
  await go(p, '/ai-math/index.html#t-08'); await p.waitForFunction(() => window.MOLASTRIA_AIM_READY); await p.waitForTimeout(300);
  await p.click('#aim-panel a[data-ref=amari1998]');
  assert.match(await text(p, '#ref-amari1998'), /Amari[\s\S]*08/);
  await finish(p);
  const e = await open();
  await go(e, '/ai-math/index.html?lang=en#t-22');
  await e.waitForFunction(() => window.MOLASTRIA_AIM_READY && !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.match(await text(e, '#aim-h1'), /Frontier AI Mathematics/);
  assert.match(await text(e, '#aim-panel'), /Fokker–Planck[\s\S]*probability-flow|Fokker–Planck/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style')) out.push(n.nodeValue.trim().slice(0, 40)); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('NMR: nav entry, eleven parts, eight method families, timeline, five working demos, references, English', async () => {
  const p = await open();
  await go(p, '/nmr/index.html');
  const settle = () => p.waitForTimeout(120); // demos redraw on the next animation frame
  assert.equal(await p.getAttribute('.cr-header a[data-id=nmr]', 'aria-current'), 'page', 'the NMR nav entry is current');
  assert.equal(await p.locator('.nmr-level').count(), 3);
  assert.equal(await p.locator('.fs-pillar').count(), 11);
  assert.equal(await p.locator('.fs-tab').count(), 11);
  assert.ok(await p.locator('#s-basics math').count() >= 4, 'MathML formulas render');
  await p.click('.fs-pillar[data-tab=solid]');
  assert.equal(await p.isVisible('#s-solid'), true);
  assert.equal(await p.isVisible('#s-basics'), false);
  assert.equal(await p.locator('.nmr-fam').count(), 8);
  assert.equal(await p.locator('#nmr-timeline li').count(), 25);
  // Demo 1: the measured linewidth follows 1/(πT₂*); a matched filter doubles it.
  assert.match(await text(p, '#f-read'), /1\.0\d Hz/);
  await p.click('#f-match'); await settle();
  assert.match(await text(p, '#f-cap'), /匹配滤波/);
  assert.match(await text(p, '#f-read'), /2\.0\d Hz/);
  // Demo 2: two protons 0.25 ppm apart with J = 12 Hz are strongly coupled at 60 MHz and first order at 1.2 GHz; ethyl has five spins.
  await p.click('#s-60'); await settle();
  assert.match(await text(p, '#s-read'), /1\.25/);
  assert.match(await text(p, '#s-cap'), /强耦合/);
  await p.click('#s-presets [data-preset=ethyl]'); await p.click('#s-1200'); await settle();
  assert.match(await text(p, '#s-cap'), /弱耦合/);
  assert.match(await text(p, '#s-read'), /自旋数5/);
  // Demo 3: small molecules give nearly +50% NOE, a 20 kDa protein a negative one; the zero crossing sits at ωτc = 1.12.
  await p.click('#r-small'); await settle();
  assert.match(await text(p, '#r-read'), /\+49\.\d %/);
  await p.click('#r-prot'); await settle();
  assert.match(await text(p, '#r-read'), /-9\d\.\d %/);
  await p.click('#r-zero'); await settle();
  assert.match(await text(p, '#r-read'), /1\.1[12]/);
  // Demo 4: slow spinning spreads the intensity over sidebands, 150 kHz leaves only the centreband.
  await p.click('#m-slow'); await settle();
  assert.match(await text(p, '#m-cap'), /Herzfeld–Berger/);
  await p.click('#m-fast'); await settle();
  assert.match(await text(p, '#m-read'), /99\.\d %|100\.0 %/);
  // Demo 5: ¹H at 9.4 T and 298 K has 32.2 ppm polarisation; electrons at 3.35 T and 1.2 K have 95.4%.
  await p.click('#p-room'); await settle();
  assert.match(await text(p, '#p-read'), /32\.2 ppm[\s\S]*658\.2/);
  await p.click('#p-ddnp'); await settle();
  assert.match(await text(p, '#p-read'), /95\.4\d? %[\s\S]*2618/);
  // Ledger, library, citations.
  assert.equal(await p.locator('#nmr-ledger-grid .fs-theory').count(), 6);
  assert.equal(await p.locator('.fs-ref').count(), 203);
  await p.click('#s-solid .fs-cite a[data-ref=andrew1958]');
  assert.match(await text(p, '#ref-andrew1958'), /Andrew/);
  await p.selectOption('#nmr-lib-area', 'hyper');
  assert.ok(await p.locator('.fs-ref').count() < 60);
  await go(p, '/nmr/index.html#s-hyper');
  await p.waitForTimeout(150);
  assert.equal(await p.isVisible('#s-hyper'), true, '#s-hyper opens part 06');
  await finish(p);
  const e = await open();
  await go(e, '/nmr/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.match(await text(e, '#nmr-h1'), /Nuclear Magnetic Resonance/);
  assert.match(await text(e, '#s-cap'), /coupling/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('News explainers: nav entry, item list and filter, two explainers with key numbers, three working demos, English', async () => {
  const p = await open();
  await go(p, '/news/index.html');
  assert.equal(await p.getAttribute('.cr-header a[data-id=news]', 'aria-current'), 'page', 'the news nav entry is current');
  assert.equal(await p.locator('.nw-card').count(), 2);
  assert.equal(await p.locator('.nw-item').count(), 2);
  assert.match(await text(p, '#n-mof-radical-pairs .nw-paper'), /10\.1038\/s41467-026-79262-6/);
  assert.match(await text(p, '#n-mof-odmr .nw-nums'), /920 MHz, 150 MHz/);
  await p.click('#nw-filter button[data-f=spectroscopy]');
  assert.equal(await p.isVisible('#n-mof-radical-pairs'), false);
  assert.equal(await p.isVisible('#n-mof-odmr'), true);
  await p.click('#nw-filter button[data-f=""]');
  await p.evaluate(() => window.MOLASTRIA_NEWS_START());
  assert.equal(await p.locator('.nw-demo .sp-plot').count(), 6, 'every demo draws');
  // Demo: radical pair. A large J suppresses the T₀ yield.
  const rp = p.locator('#demo-mof-radical-pairs-rp');
  const yieldOf = async () => +(await rp.locator('.sp-out').innerText()).match(/([\d.]+)%/)[1];
  const weak = await yieldOf();
  await rp.locator('button[data-k=pre][data-v=strong]').click();
  assert.ok(await yieldOf() < weak / 3, 'strong exchange gives a much smaller T₀ yield');
  // Demo: EPR. Al-PMOF spans about 66 mT; the T₀-only preset is narrow.
  const epr = p.locator('#demo-mof-radical-pairs-epr');
  assert.match(await epr.locator('.sp-out').innerText(), /66\.1 mT/);
  await epr.locator('button[data-k=pre][data-v=rp]').click();
  assert.match(await epr.locator('.sp-out').innerText(), /1\.10 nm/);
  // Demo: zero-field ODMR lines.
  assert.match(await p.locator('#demo-mof-odmr-zf .sp-out').innerText(), /300, 770, 1070 MHz/);
  await p.locator('#demo-mof-odmr-zf button[data-k=pre][data-v=epr]').click();
  assert.match(await p.locator('#demo-mof-odmr-zf .sp-out').innerText(), /242, 805, 1047 MHz/);
  await finish(p);
  const e = await open();
  await go(e, '/news/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  await e.evaluate(() => window.MOLASTRIA_NEWS_START());
  assert.match(await text(e, '#nw-h1'), /Chemistry & Materials News/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('Chemistry Disciplines: nav entry, fifteen halls (one coming soon), map, every chapter and demo of the open halls draws, a worked number, English', async () => {
  const p = await open();
  const demoErrors = [];
  p.on('console', (m) => { if (m.type() === 'error') demoErrors.push(m.text()); });
  await go(p, '/chemistry/index.html');
  assert.equal(await p.getAttribute('.cr-header a[data-id=chemistry]', 'aria-current'), 'page', 'the chemistry nav entry is current');
  assert.equal(await p.locator('.chm-card').count(), 15);
  assert.equal(await p.locator('a.chm-card').count(), 14, 'fourteen open halls are links');
  assert.match(await text(p, '.chm-card.is-soon'), /即将上线[\s\S]*药物化学/);
  assert.equal(await p.locator('#chm-map .chm-node').count(), 15);
  assert.match(await text(p, '#chm-lead'), /现在开放 14 个展馆/);
  const halls = await p.evaluate(() => window.MOLASTRIA_CHEM_SUBJECTS.subjects.filter((s) => !(window.MOLASTRIA_CHEM_SUBJECTS.soon || []).includes(s[0])).map((s) => [s[0], s[6], s[7]]));
  assert.equal(halls.length, 14);
  for (const [id, chapters, demos] of halls) {
    await go(p, `/chemistry/${id}/index.html`);
    assert.equal(await p.locator('#chm-chapters .chm-ch').count(), chapters, `${id}: chapter cards`);
    assert.equal(await p.locator('#chm-switch .chm-soon').count(), 1, `${id}: the coming-soon hall is not a link`);
    const ids = await p.evaluate(() => window.MOLASTRIA_CHEM.chapters.filter((c) => c.demos?.length).map((c) => c.id));
    let drawn = 0;
    for (const ch of ids) {
      await p.evaluate((h) => { location.hash = h; }, `#c-${ch}`);
      await p.waitForTimeout(200);
      drawn += await p.locator('.chm-demo:visible').count();
    }
    assert.equal(drawn, demos, `${id}: every demo is shown`);
  }
  assert.deepEqual(demoErrors, [], 'no demo threw');
  // A worked number: McCabe–Thiele at α = 2.5, R = 2 needs 11 theoretical stages, R_min = 1.10.
  await go(p, '/chemistry/chemeng/index.html#c-separation');
  await p.waitForTimeout(300);
  assert.match(await p.locator('#demo-mccabe .fs-readout').innerText(), /理论板数\s*11[\s\S]*1\.10/);
  // The materials hall links back to the MOF news items.
  await go(p, '/chemistry/materials/index.html#c-porous');
  await p.waitForTimeout(300);
  assert.equal(await p.locator('a[href$="news/index.html#n-mof-radical-pairs"]').count() >= 1, true);
  await go(p, '/chemistry/medicinal/index.html');
  assert.match(await text(p, '#chm-lead'), /即将上线/);
  assert.equal(await p.locator('.chm-demo').count(), 0);
  await finish(p);
  const e = await open();
  for (const path of ['/chemistry/index.html', '/chemistry/organic/index.html', '/chemistry/nuclear/index.html', '/chemistry/medicinal/index.html']) {
    await go(e, `${path}?lang=en`);
    await e.waitForFunction(() => !document.documentElement.dataset.i18n);
    await e.waitForTimeout(400);
    const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim().slice(0, 40)); return out; });
    assert.deepEqual(han, [], `no Chinese left on ${path} in English`);
  }
  assert.match(await text(e, '#chm-lead'), /open soon/);
  await finish(e);
});

check('Spectra Hall: nav entry, 91 methods, filter and search, a method opens with drawn spectra, atlas, references, English', async () => {
  const p = await open();
  await go(p, '/spectra/index.html');
  assert.equal(await p.getAttribute('.cr-header a[data-id=spectra]', 'aria-current'), 'page', 'the Spectra Hall nav entry is current');
  assert.equal(await p.locator('.sp-card').count(), 91);
  await p.click('#sp-fams button[data-fam=ms]');
  const ms = await p.locator('.sp-card').count();
  assert.ok(ms > 5 && ms < 91, `mass spectrometry family shows ${ms}`);
  await p.click('#sp-fams button[data-fam=""]');
  await p.fill('#sp-q', 'GC-MS');
  assert.ok(await p.locator('.sp-card[data-id=gcms]').count() === 1);
  await p.fill('#sp-q', '');
  await go(p, '/spectra/index.html#m-gcms');
  await p.waitForTimeout(400);
  assert.match(await text(p, '#sp-m-title'), /GC-MS/);
  await p.locator('#sp-method .sp-fig').first().scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelectorAll('#sp-method .sp-fig[data-done] svg.sp-plot').length > 0);
  // Every figure says where its data come from.
  const kinds = await p.$$eval('#sp-method .sp-fig', (fs) => fs.map((f) => f.dataset.kind));
  assert.ok(kinds.length && kinds.every((k) => ['measured', 'computed', 'constants', 'sketch'].includes(k)), kinds.join());
  // Infrared opens with computed and measured spectra; the computed one carries a provenance tag.
  await go(p, '/spectra/index.html#m-ir');
  await p.waitForTimeout(400);
  assert.ok(await p.locator('#sp-method .sp-fig[data-kind=computed]').count() >= 1, 'IR has a computed spectrum');
  // Atlas tables are filled when opened.
  await p.click('#sp-atlas-list details summary >> nth=0');
  await p.locator('#sp-atlas-list details[open] table tr').nth(3).waitFor({ timeout: 5000 });
  assert.equal(await p.locator('#sp-refs > li').count(), 178);
  await p.click('#sp-case-tabs [data-case]:nth-child(2)');
  assert.equal(await p.locator('#sp-case-panel .sp-steps li').count() > 2, true);
  await finish(p);
  const e = await open();
  await go(e, '/spectra/index.html?lang=en#m-ms');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(800);
  assert.match(await text(e, '#sp-h1'), /Spectra Hall/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('quantum biology: under Quantum Carnival, seven directions, evidence ledger, three working demos, references, English', async () => {
  const p = await open();
  await go(p, '/quantum/biology/index.html');
  const setRange = (sel, v) => p.$eval(sel, (el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
  const settle = () => p.waitForTimeout(80); // demos redraw on the next animation frame
  assert.equal(await p.getAttribute('body', 'data-section'), 'quantum', 'part of Quantum Carnival');
  assert.equal(await p.locator('.cr-header a[data-id=quantumbio]').count(), 0, 'no nav entry of its own');
  assert.equal(await p.getAttribute('.cr-header a[data-id=quantum]', 'aria-current'), 'page', 'the 量子嘉年华 entry is current');
  assert.equal(await p.getAttribute('#qb-crumbs a', 'href'), '../index.html', 'breadcrumb back to the hub');
  assert.match(await p.textContent('#qb-crumbs'), /量子嘉年华\s*\/\s*量子生物学/);
  await p.click('#qb-crumbs a');
  await p.waitForURL(/\/quantum\/index\.html$/);
  assert.equal(await p.getAttribute('.qc-hall[data-hall=biology]', 'href'), 'biology/index.html', 'the hub card is open and links here');
  await p.click('.qc-hall[data-hall=biology]');
  await p.waitForURL(/\/quantum\/biology\/index\.html$/);
  assert.equal(await p.locator('.qb-level').count(), 3);
  assert.equal(await p.locator('.fs-pillar').count(), 7);
  assert.equal(await p.locator('.fs-tab').count(), 7);
  assert.ok(await p.locator('#s-photo math').count() >= 3, 'MathML formulas render');
  await p.click('.fs-pillar[data-tab=compass]');
  assert.equal(await p.isVisible('#s-compass'), true);
  assert.equal(await p.isVisible('#s-photo'), false);
  // Demo 1: FMO efficiency at γ = 10 ps⁻¹ beats fully coherent transport (values from tools/quantum-bio-test.mjs).
  assert.match(await text(p, '#e-read'), /99\.02 %/);
  await p.click('#e-coherent');
  assert.match(await text(p, '#e-read'), /90\.56 %/);
  await p.click('#e-best'); await settle();
  assert.match(await text(p, '#e-read'), /99\.\d\d %/);
  // Demo 2: radical-pair yield at 30°, then no direction dependence for an isotropic coupling.
  assert.match(await text(p, '#r-read'), /0\.4371/);
  await p.click('#r-iso');
  assert.match(await text(p, '#r-cap'), /各向同性/);
  // Demo 3: tunnelling signature, then a wide barrier is nearly classical.
  const kie = await text(p, '#k-read');
  assert.match(kie, /16\.3[\s\S]*7\.77[\s\S]*0\.183/);
  await p.click('#k-classical');
  assert.match(await text(p, '#k-cap'), /0\.7–1\.2/);
  await setRange('#k-t', 330); await settle();
  assert.match(await text(p, '#k-t-v'), /330 K/);
  // Evidence ledger and library filters.
  assert.equal(await p.locator('#qb-ledger-grid .fs-theory').count(), 7);
  await p.click('#qb-ledger-filter .fs-chip[data-kind=contested]');
  assert.equal(await p.locator('#qb-ledger-grid .fs-theory').count(), 2);
  assert.equal(await p.locator('.fs-ref').count(), 56);
  await p.selectOption('#qb-lib-status', 'contested');
  assert.equal(await p.locator('.fs-ref').count(), 8);
  await p.click('#s-compass .fs-cite a[data-ref=xu2021]');
  assert.match(await text(p, '#ref-xu2021'), /cryptochrome 4/);
  assert.deepEqual(await p.$$eval('#qb-road a', (as) => as.map((a) => new URL(a.href).pathname).filter((x) => !/\.html$/.test(x))), [], 'learning-path links point at pages');
  await finish(p);
  const e = await open();
  await go(e, '/quantum/biology/index.html?lang=en');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForTimeout(600);
  assert.match(await text(e, '#qb-h1'), /Quantum Biology/);
  const han = await e.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,math') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page');
  await finish(e);
});

check('arrows: the site draws its own metallic arrow icons, no ↗ characters are left, the 收藏夹 button is gold', async () => {
  for (const path of ['/index.html', '/hub/index.html', '/train/index.html', '/manual/index.html', '/fundamental-science/index.html', '/quantum/biology/index.html', '/quantum/computing/index.html', '/nmr/index.html', '/news/index.html', '/spectra/index.html', '/ai-math/index.html']) {
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

check('about: MolAstria brand story, five chapters, hand-written English, new Chinese company name', async () => {
  const p = await open({ viewport: { width: 390, height: 844 } });
  await go(p, '/about/index.html#story');
  assert.match(await text(p, '#story h2'), /从分子出发，探索现实的深层本质/);
  assert.equal(await p.locator('#story .story-ch').count(), 5);
  assert.equal(await p.locator('#story .story-ladder li').count(), 5);
  assert.match(await text(p, '.cr-legal'), /阿斯特赖亚科技（Morning Glory）旗下项目/);
  assert.ok(!/晨光/.test(await text(p, 'body')), 'the old Chinese name is gone');
  assert.equal(await p.locator('#story .story-questions li').count(), 3);
  assert.match(await text(p, '#story .story-quote'), /shoulders of giants[\s\S]*巨人的肩膀/);
  assert.equal(await p.locator('#story .cr-legal').count(), 0, 'the site footer line is not pulled into the story');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width');
  await go(p, '/index.html');
  assert.equal(await p.locator('footer a[href="about/index.html#story"]').count(), 1);
  await go(p, '/about/index.html?lang=en#story');
  await p.waitForFunction(() => !document.documentElement.dataset.i18n);
  assert.match(await text(p, '#story h2'), /From Molecules to the Deeper Nature of Reality/);
  assert.match(await text(p, '#story .story-ch h3'), /The Origin of Our Name/);
  assert.equal(await p.locator('#story .story-zh:visible, #story .story-en:visible').count(), 0, 'no doubled lines in English');
  assert.ok(!/[\u4e00-\u9fff]/.test(await text(p, '#story')), 'story fully in English');
  await finish(p);
});

check('vision: the operator\'s essay in full (28 paragraphs, 3 source links), bilingual toggle, outlook with status tags, nav and footer links', async () => {
  const p = await open({ viewport: { width: 390, height: 844 } });
  await go(p, '/vision/index.html');
  assert.match(await text(p, '.vs-hero h1'), /工业革命2.5/);
  assert.equal(await p.locator('.vs-essay .vs-para').count(), 28);
  assert.match(await text(p, '#part-1'), /我把正在发生的人工智能浪潮称为“工业革命2.5”。/);
  assert.match(await text(p, '#part-5'), /以自己的知识、劳动与判断，参与创造值得拥有的未来。/);
  const srcs = await p.$$eval('.vs-src', (xs) => xs.map((x) => x.href));
  assert.deepEqual(srcs, ['https://www.nps.gov/mapr/learn/historyculture/index.htm', 'https://www.whitehouse.gov/releases/2025/07/white-house-unveils-americas-ai-action-plan/', 'https://www.energy.gov/science/articles/genesis-mission-frameworks-advancing-frontiers-american-discovery']);
  assert.equal(await p.locator('.vs-en:visible').count(), 0, 'Chinese page shows only Chinese at first');
  await p.click('.vs-bi');
  assert.equal(await p.locator('.vs-en:visible').count(), 28, 'every paragraph gets its translation');
  assert.equal(await p.locator('.vo-card').count(), 4);
  // Every outlook item is drawn with its own status tag; "next" items move to "live" as the roadmap ships, so count against the data.
  const want = await p.evaluate(() => { const n = { live: 0, next: 0, idea: 0 }; for (const c of window.MOLASTRIA_VISION.outlook.pledges) for (const [st] of c.items) n[st]++; return n; });
  for (const st of ['live', 'next', 'idea']) assert.equal(await p.locator(`.vo-card .vo-${st}`).count(), want[st], `${st} items`);
  assert.ok(want.live >= 4 && want.idea >= 4, `live ${want.live}, idea ${want.idea}`);
  for (const href of await p.$$eval('.vo-card a[href]', (xs) => xs.map((x) => x.getAttribute('href')).filter((h) => !/^https?:/.test(h)))) assert.match(href, /^\.\.\/(?!\.\.\/)/, `site link ${href} is relative to /vision/ (one level up, the data gives paths from the site root)`);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width');
  assert.equal(await p.locator('.cr-legal a[href$="vision/index.html"]').count(), 1);
  await go(p, '/about/index.html');
  assert.equal(await p.locator('main a[href="../vision/index.html"]').count(), 1);
  await go(p, '/vision/index.html?lang=en');
  await p.waitForFunction(() => !document.documentElement.dataset.i18n);
  assert.match(await text(p, '.vs-hero h1'), /Industrial Revolution 2.5/);
  assert.ok(!/[\u4e00-\u9fff]/.test(await text(p, '#vision')), 'page fully in English');
  await finish(p);
});

check('open data API: files are valid, docs page lists them from index.json, footer link, English, phone width', async () => {
  const p = await open({ viewport: { width: 390, height: 844 } });
  await go(p, '/api/index.html');
  await p.waitForSelector('.api-set');
  const index = await (await p.request.get(`${SITE}/api/v1/index.json`)).json();
  assert.equal(await p.locator('.api-set').count(), index.endpoints.length);
  for (const e of index.endpoints) {
    const res = await p.request.get(`${SITE}/api/v1/${e.id}.json`);
    assert.equal(res.status(), 200, e.id);
    assert.equal((await res.json()).items.length, e.count, e.id);
    assert.match(await text(p, `.api-set:has(a.api-url[href="v1/${e.id}.json"])`), new RegExp(`共 ${e.count} 条`));
  }
  for (const f of ['api/v1/openapi.json', 'api/v1/molastria.mjs', 'api/embed.js', 'llms.txt']) assert.equal((await p.request.get(`${SITE}/${f}`)).status(), 200, f);
  for (const href of await p.locator('.api-files a').evaluateAll((as) => as.map((a) => a.href.split('#')[0]))) assert.equal((await p.request.get(href)).status(), 200, href);
  assert.match(await text(p, '#api-updated'), /最近核对 \d{4}-\d{2}-\d{2}/);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width');
  // Every page's footer line links here.
  await go(p, '/about/index.html');
  await p.click('.cr-legal a[href*="api/"]');
  await p.waitForURL(/\/api\//);
  await go(p, '/api/index.html?lang=en');
  await p.waitForFunction(() => !document.documentElement.dataset.i18n);
  await p.waitForSelector('.api-set'); await p.waitForSelector('.api-hit');
  assert.match(await text(p, 'h1'), /Open data API/);
  assert.match(await text(p, '.api-set'), /Resource catalogue[\s\S]*\d+ entries · checked/);
  assert.equal(await p.inputValue('#api-q'), 'density functional', 'English pages start with an English query');
  assert.match(await text(p, '#api-status'), /^\d+ results, showing the first 6$/);
  assert.ok(!/[\u4e00-\u9fff]/.test(await p.evaluate(() => [...document.querySelectorAll('main > :not(#api-hits):not(.api-embed):not(pre), .api-form')].map((n) => n.innerText).join('\n').replace(/密度泛函/g, ''))), 'page text fully in English');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll in English at phone width');
  await finish(p);
});

check('open data API: live search (bilingual synonyms, dataset chips, shareable address) and code that follows the search', async () => {
  const p = await open();
  await p.addInitScript(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await go(p, '/api/index.html');
  await p.waitForSelector('.api-hit');
  assert.equal(await p.inputValue('#api-q'), '密度泛函');
  const count = async () => +(await text(p, '#api-status')).match(/共 (\d+) 条/)[1];
  const zh = await count(), zhTitles = await p.locator('.api-hit-title').allTextContents();
  assert.ok(zh > 20);
  assert.ok(zhTitles.some((t) => /DFT/.test(t) && !/密度泛函/.test(t)), 'finds entries that only say DFT');
  await p.fill('#api-q', 'DFT');
  await p.waitForFunction(() => /#q=DFT$/.test(location.hash));
  await p.waitForTimeout(200);
  assert.equal(await count(), zh, '“DFT” and “密度泛函” match the same entries');
  assert.deepEqual(await p.locator('.api-hit-title').allTextContents(), zhTitles);
  // Chips: counts for every dataset; pressing one narrows the list and the code.
  const videos = +(await text(p, '#api-in [data-set=videos] b'));
  assert.ok(videos > 0 && videos < zh);
  await p.click('#api-in [data-set=videos]');
  await p.waitForFunction(() => /in=videos/.test(location.hash));
  await p.waitForFunction((n) => new RegExp(`共 ${n} 条`).test(document.querySelector('#api-status').textContent), videos);
  assert.deepEqual([...new Set(await p.locator('.api-kind').allTextContents())], ['videos']);
  assert.match(await text(p, '#api-code'), /search\("DFT", \{ datasets: \["videos"\], limit: 6 \}\)/);
  await p.click('.api-tabs [data-tab=py]');
  assert.match(await text(p, '#api-code'), /words = "DFT"\.lower\(\)\.split\(\)[\s\S]*for name in \["videos"\]/);
  await p.click('.api-tabs [data-tab=curl]');
  assert.match(await text(p, '#api-code'), /^curl -s https:\/\/molastria\.com\/api\/v1\/videos\.json \| jq -r --arg w0 'dft' /);
  await p.click('.api-copy[data-copy=api-code]');
  assert.match(await p.evaluate(() => window.__copied), /^curl -s /);
  assert.match(await text(p, '.api-copy[data-copy=api-code]'), /已复制/);
  // A result shows its raw entry; its title goes to the resource itself.
  await p.click('.api-hit summary');
  assert.match(await text(p, '.api-hit details[open] pre'), /"platform": "(youtube|bilibili)"/);
  assert.match(await p.getAttribute('.api-hit-title', 'href'), /^https:\/\/(www\.youtube\.com|www\.bilibili\.com)\//);
  // The address restores the search (embed cards link here this way); nonsense finds nothing, without errors.
  await go(p, '/api/index.html#q=orca&in=resources');
  await p.waitForSelector('.api-hit');
  assert.equal(await p.inputValue('#api-q'), 'orca');
  assert.equal(await text(p, '.api-hit-title'), 'ORCA');
  assert.equal(await p.getAttribute('#api-in [data-set=resources]', 'aria-pressed'), 'true');
  await p.fill('#api-q', 'zzzz-nothing');
  await p.waitForFunction(() => /没有找到/.test(document.querySelector('#api-status').textContent));
  assert.equal(await p.locator('.api-hit').count(), 0);
  await p.click('#api-tries [data-try] >> nth=1');
  await p.waitForSelector('.api-hit');
  assert.equal(await p.inputValue('#api-q'), 'ORCA');
  await finish(p);
});

check('API keys on the account page: made once and shown once, listed by prefix, revoked', async () => {
  const p = await open();
  await p.addInitScript(() => { navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
  await go(p, '/pro/account.html');
  await signIn(p, 'keys@example.com');
  await p.waitForSelector('#key-list .acct-empty');
  assert.ok(await p.isHidden('#key-new'));
  assert.match(await text(p, '#keys-card .acct-sub'), /RTX 2080，尽力而为，可能离线/);
  await p.fill('#key-name', 'lab workstation');
  await p.click('#key-form button');
  await p.waitForSelector('#key-new:not([hidden])');
  const key = await text(p, '#key-value');
  assert.match(key, /^mola_[A-Za-z0-9_-]{43}$/);
  assert.match(await text(p, '#key-new'), /只显示这一次/);
  await p.click('#key-copy');
  assert.equal(await p.evaluate(() => window.__copied), key);
  assert.match(await text(p, '#key-list li'), new RegExp(`^${key.slice(0, 10)}…撤销lab workstation · .+生成 · 还没用过$`));
  assert.ok(!(await text(p, '#key-list')).includes(key), 'the list shows the prefix only');
  // The key works from a program, and that shows as used.
  const me = await p.request.get(`${API}/v1/me`, { headers: { Authorization: `Bearer ${key}`, Origin: 'https://elsewhere.example' } });
  assert.deepEqual([me.status(), (await me.json()).tier, me.headers()['access-control-allow-origin']], [200, 'free', '*']);
  // After a reload the key is gone for good; the list stays.
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#key-list li code');
  assert.ok(await p.isHidden('#key-new'));
  assert.ok(!(await p.content()).includes(key), 'the key is nowhere on the page after a reload');
  assert.ok(!(await p.evaluate(() => JSON.stringify({ ...localStorage }))).includes(key), 'and not in the browser storage');
  assert.match(await text(p, '#key-list li'), /最近使用/);
  // Usage: nothing computed yet, then one job with the key (a frequency job costs 3 uses). The molecule is not shown, because it is not kept.
  assert.match(await text(p, '#key-usage-line'), /^今天还没用过，每天 \d+ 次，网站上算的和用 key 算的加在一起。$/);
  assert.ok(await p.isHidden('#key-jobs-box'));
  const sent = await p.request.post(`${API}/v1/jobs`, { data: { smiles: 'CC(=O)Oc1ccccc1C(=O)O', job: 'freq', model: 'ani-2x' }, headers: { Authorization: `Bearer ${key}` } });
  assert.deepEqual([sent.status(), (await sent.json()).cost], [202, 3]);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('#key-jobs tr');
  assert.match(await text(p, '#key-usage-line'), /^已用 3 \/ \d+ 次，网站上算的和用 key 算的加在一起；.+重新计数。$/);
  assert.match(await text(p, '#key-jobs tr'), new RegExp(`${key.slice(0, 10)}…lab workstationani-2x振动频率与热化学3$`));
  assert.match(await text(p, '#key-list li'), /过去 24 小时用了 3 次/);
  assert.match(await text(p, '#key-usage'), /不记录你算的分子/);
  assert.ok(!(await p.content()).includes('CC(=O)O'), 'the molecule is nowhere on the page');
  // English
  await go(p, '/pro/account.html?lang=en');
  await p.waitForFunction(() => !document.documentElement.dataset.i18n);
  await p.waitForSelector('#key-list li code');
  await p.waitForSelector('#key-jobs tr');
  assert.ok(!HAN.test(await p.innerText('#keys-card')), 'the API key card is fully in English');
  assert.match(await p.innerText('#keys-card'), /best effort.*may be offline[\s\S]*Revoke[\s\S]*Last used[\s\S]*3 of \d+ uses[\s\S]*Vibrational frequencies/);
  await p.setViewportSize({ width: 390, height: 844 });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the usage table does not push the page sideways at phone width');
  await p.setViewportSize({ width: 1280, height: 900 });
  await go(p, '/pro/account.html?lang=zh');
  await p.waitForSelector('#key-list li code');
  // Three at most; revoking stops the key at once.
  for (let i = 0; i < 2; i++) { await p.click('#key-form button'); await p.waitForFunction((n) => document.querySelectorAll('#key-list li code').length === n, i + 2); }
  await p.click('#key-form button');
  await p.waitForFunction(() => /最多 3 个 API key/.test(document.querySelector('#key-msg').textContent));
  await p.click('#key-list li:first-child [data-key]'); // the confirm dialog is accepted
  await p.waitForFunction(() => document.querySelectorAll('#key-list li code').length === 2);
  assert.match(await text(p, '#key-msg'), /已撤销 mola_/);
  assert.equal((await p.request.get(`${API}/v1/me`, { headers: { Authorization: `Bearer ${key}` } })).status(), 401);
  // Signing out clears the card.
  await p.click('#signout');
  await p.waitForSelector('#acct-login:not([hidden])');
  assert.equal(await p.locator('#key-list li').count(), 0);
  assert.ok(await p.isHidden('#key-usage'), 'and the usage with it');
  await finish(p);
});

check('cloud sync: two devices on one account merge favourites and progress, an open page is told to reload, the panel shows it, English, wiping the cloud copy', async () => {
  const email = 'sync-e2e@example.com';
  const laptop = await open(), phone = await open({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  // The laptop has favourites and a self-check from before signing in.
  await go(laptop, '/pro/account.html');
  await laptop.evaluate(() => { localStorage.setItem('chemresearch-saved', JSON.stringify(['pyscf', 'orca'])); localStorage.setItem('molastria-qp-progress', JSON.stringify({ c1: true })); });
  await signIn(laptop, email);
  await laptop.waitForSelector('#sync-card:not([hidden])');
  assert.equal(await laptop.locator('#sync-list li').count(), 16, 'every synced record is listed');
  assert.match(await text(laptop, '#sync-card'), /不同步/);
  assert.equal(await text(laptop, '#sync-toggle'), '打开云同步');
  await laptop.click('#sync-toggle');
  await laptop.waitForFunction(() => /已打开/.test(document.getElementById('sync-msg').textContent));
  assert.match(await text(laptop, '#sync-line'), /上次同步：.*已用 \d+ KB \/ 1\.0 MB/);
  // The phone signs in with its own favourites, and gets the laptop's.
  await go(phone, '/pro/account.html');
  await phone.evaluate(() => localStorage.setItem('chemresearch-saved', JSON.stringify(['cp2k'])));
  await signIn(phone, email);
  await phone.click('#sync-toggle');
  await phone.waitForFunction(() => /已打开/.test(document.getElementById('sync-msg').textContent));
  assert.match(await text(phone, '#sync-msg'), /取回了 2 份记录/);
  const saved = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('chemresearch-saved')).sort());
  assert.deepEqual(await saved(phone), ['cp2k', 'orca', 'pyscf']);
  assert.deepEqual(await phone.evaluate(() => JSON.parse(localStorage.getItem('molastria-qp-progress'))), { c1: true });
  // The laptop is on the home page (which holds the favourites in memory) when the phone removes one.
  await go(laptop, '/index.html');
  await laptop.waitForFunction(() => window.MolAstriaSync && window.MolAstriaSync.status().state === 'ok');
  await laptop.evaluate(() => window.MolAstriaSync.now());
  assert.deepEqual(await saved(laptop), ['cp2k', 'orca', 'pyscf']);
  assert.equal(await laptop.locator('.cr-sync-bar').count(), 1, 'the open page is told to reload');
  await phone.evaluate(() => { localStorage.setItem('chemresearch-saved', JSON.stringify(['cp2k', 'pyscf'])); return window.MolAstriaSync.now(); });
  await laptop.evaluate(() => window.MolAstriaSync.now());
  assert.deepEqual(await saved(laptop), ['cp2k', 'pyscf'], 'orca stays removed');
  // The header's account panel shows that it is on.
  await laptop.click('#cr-acct');
  await laptop.waitForSelector('#cr-acct-pop:not([hidden])');
  assert.match(await laptop.innerText('#cr-acct-pop'), /云同步\s*已打开 · 刚刚同步/);
  // English, at phone width, in the dark.
  await go(phone, '/pro/account.html?lang=en#sync-card');
  await phone.waitForFunction(() => document.documentElement.lang === 'en' && !document.documentElement.dataset.i18n);
  await phone.waitForSelector('#sync-list li');
  assert.ok(!HAN.test(await phone.innerText('#sync-card')), 'the sync card is fully in English');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width');
  // Wiping the cloud copy keeps the local records and switches this device off.
  await go(laptop, '/pro/account.html?lang=zh#sync-card');
  await laptop.waitForSelector('#sync-wipe:not([hidden])');
  await laptop.click('#sync-wipe'); // the confirm dialog is accepted
  await laptop.waitForFunction(() => /云端副本已删除/.test(document.getElementById('sync-msg').textContent));
  assert.equal(await text(laptop, '#sync-toggle'), '打开云同步');
  assert.deepEqual(await saved(laptop), ['cp2k', 'pyscf']);
  const token = await laptop.evaluate(() => localStorage.getItem('molastria-session'));
  const cloud = await (await laptop.request.get(`${API}/sync`, { headers: { Origin: SITE, Authorization: `Bearer ${token}` } })).json();
  assert.deepEqual(cloud.versions, {});
  await finish(laptop);
  await finish(phone);
});

check('compute API on the docs page: is the computer on and how often it was, a job with a key, code that follows the choice (Python client first), MACE refused, English', async () => {
  const p = await open();
  // A key, made the way the account page makes one.
  const post = async (path, data, token) => (await p.request.post(API + path, { data, headers: { Origin: SITE, ...(token ? { Authorization: `Bearer ${token}` } : {}) } })).json();
  const { devCode } = await post('/auth/start', { email: 'compute@example.com' });
  const { token } = await post('/auth/verify', { email: 'compute@example.com', code: devCode });
  const { key } = await post('/keys', { name: 'e2e' }, token);
  await go(p, '/api/index.html#compute');
  await p.waitForSelector('#gpu-live[data-state=on]');
  assert.match(await text(p, '#gpu-text'), /现在在线/);
  assert.match(await text(p, '.api-gpu'), /算力是站长电脑上的 RTX 2080，尽力而为，可能离线/);
  // The record of the last 7 days: the local service probed once when it started, so today has a sample and the days before have none.
  await p.waitForSelector('#gpu-uptime:not([hidden])');
  assert.equal(await p.locator('#gpu-days .api-upday').count(), 7);
  assert.match(await text(p, '#gpu-ratio'), /^最近 7 天在线 100%，每 15 分钟探测一次，日期按 UTC。$/);
  assert.match(await p.getAttribute('#gpu-days .api-upday:last-child', 'title'), /^\d+月\d+日：在线 100%$/);
  assert.match(await p.getAttribute('#gpu-days .api-upday:first-child', 'title'), /：没有记录$/);
  const status = await (await p.request.get(`${API}/v1/status`, { headers: { Origin: 'https://elsewhere.example' } })).json();
  assert.deepEqual([status.online, status.uptime.samples, status.uptime.days.length], [true, 1, 7], 'the same record is public, without a key');
  assert.equal(await p.locator('#run-jobs tr').count(), 12);
  assert.match(await text(p, '#run-jobs tr:nth-child(5)'), /^scan二面角扫描5atoms 必填 start end points$/);
  const models = await p.locator('#run-model option').evaluateAll((os) => os.map((o) => o.value));
  assert.equal(models.length, 14); // ten machine-learning potentials and the four xTB models (#123)
  assert.ok(!models.some((m) => m.startsWith('mace')), 'no MACE model is offered');
  // The code follows the form and never holds the key.
  await p.fill('#run-key', key);
  await p.fill('#run-smiles', 'c1ccccc1O');
  await p.selectOption('#run-model', 'ani-2x');
  assert.deepEqual(await p.locator('#run-job option').evaluateAll((os) => os.map((o) => o.value)), ['opt', 'sp', 'freq', 'conf', 'md'], 'ANI-2x: neutral molecules only, so no ionisation energy');
  await p.selectOption('#run-job', 'freq');
  // The first tab is the one-file Python client, which the site serves.
  assert.match(await text(p, '#run-code'), /curl -O https:\/\/molastria\.com\/api\/v1\/molastria\.py[\s\S]*molastria\.Compute\(\)[\s\S]*\.run\(smiles="c1ccccc1O", model="ani-2x", job="freq"\)/);
  const client = await p.request.get(`${SITE}/api/v1/molastria.py`);
  assert.ok(client.ok() && /^__version__ = "\d+\.\d+\.\d+"$/m.test(await client.text()), 'molastria.py is served');
  await p.click('#run-tabs [data-tab=py]');
  assert.match(await text(p, '#run-code'), /call\("\/jobs", \{"smiles": "c1ccccc1O", "model": "ani-2x", "job": "freq"\}\)/);
  await p.click('#run-tabs [data-tab=js]');
  assert.match(await text(p, '#run-code'), /call\('\/jobs', \{ smiles: 'c1ccccc1O', model: 'ani-2x', job: 'freq' \}\)/);
  await p.click('#run-tabs [data-tab=curl]');
  assert.match(await text(p, '#run-code'), /-d '\{"smiles":"c1ccccc1O","model":"ani-2x","job":"freq"\}'/);
  assert.match(await text(p, '#api-code'), /import \{ search \}/, 'the search example above keeps its own tab');
  for (const tab of ['client', 'py', 'js', 'curl']) { await p.click(`#run-tabs [data-tab=${tab}]`); assert.ok(!(await text(p, '#run-code')).includes(key), `${tab}: no key in the code`); }
  // Run it: queued, running, done, with what is left today.
  await p.click('#run-go');
  await p.waitForSelector('#run-result:not([hidden])', { timeout: 15000 });
  const job = JSON.parse(await text(p, '#run-result'));
  assert.deepEqual([job.status, job.result.job, job.result.model, job.result.smiles, job.result.frequencies_cm1.length], ['done', 'freq', 'ani-2x', 'c1ccccc1O', 4]);
  assert.match(await text(p, '#run-status'), /^算完了。今天还剩 \d+ 次计算。$/);
  assert.ok(!(await p.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }) + location.href)).includes(key), 'the key stays in memory');
  // A bad key, and a model the API does not offer.
  await p.fill('#run-key', 'not-a-key');
  await p.click('#run-go');
  assert.match(await text(p, '#run-status'), /先填一个 API key/);
  await p.fill('#run-key', `mola_${'A'.repeat(43)}`);
  await p.click('#run-go');
  await p.waitForFunction(() => /无效或已撤销/.test(document.querySelector('#run-status').textContent));
  const mace = await p.request.post(`${API}/v1/jobs`, { data: { smiles: 'CCO', job: 'opt', model: 'mace-off23-small', academic: true }, headers: { Authorization: `Bearer ${key}` } });
  assert.deepEqual([mace.status(), (await mace.json()).error.code], [403, 'licence']);
  // Offline: said plainly.
  await p.route('**/uma/health', (r) => r.fulfill({ json: { online: false } }));
  await go(p, '/api/index.html?lang=en#compute');
  await p.waitForFunction(() => !document.documentElement.dataset.i18n);
  await p.waitForSelector('#gpu-live[data-state=off]');
  assert.match(await text(p, '#gpu-text'), /offline right now/);
  assert.match(await text(p, '.api-gpu'), /RTX 2080.*best effort.*may be offline/);
  assert.match(await text(p, '#run-jobs tr:nth-child(5)'), /^scanDihedral scan5atoms required/);
  assert.ok(!HAN.test(await p.evaluate(() => { const out = []; for (let n = document.getElementById('compute'); n; n = n.nextElementSibling) out.push(n.innerText); return out.join('\n'); })), 'the compute section is fully in English');
  await p.setViewportSize({ width: 390, height: 844 });
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width');
  await finish(p);
});

check('open data API: embed card (builder preview and snippet, a bare script tag on another page, dark theme, English, no style leaks)', async () => {
  const p = await open();
  await go(p, '/api/index.html');
  const card = (sel, q) => p.evaluate(([s, inner]) => { const r = document.querySelector(s)?.shadowRoot; return inner ? [...(r?.querySelectorAll(inner) || [])].map((n) => n.textContent) : !!r; }, [sel, q]);
  await p.waitForFunction(() => document.querySelector('#api-preview').shadowRoot?.querySelectorAll('li').length === 4);
  assert.match(await text(p, '#api-snippet'), /^<script async src="https:\/\/molastria\.com\/api\/embed\.js" data-q="机器学习势" data-limit="4"><\/script>$/);
  await p.fill('#api-embed-form [name=q]', 'ORCA');
  await p.selectOption('#api-embed-form [name=dataset]', 'resources');
  await p.fill('#api-embed-form [name=limit]', '2');
  await p.selectOption('#api-embed-form [name=lang]', 'en');
  await p.selectOption('#api-embed-form [name=theme]', 'dark');
  await p.waitForFunction(() => document.querySelector('#api-preview').shadowRoot?.querySelectorAll('li').length === 2 && document.querySelector('#api-preview').dataset.theme === 'dark');
  assert.equal((await card('#api-preview', '.t'))[0], 'ORCA');
  assert.deepEqual([...new Set(await card('#api-preview', '.k'))], ['Resource']);
  assert.match((await card('#api-preview', 'footer'))[0], /See all \d+ on MolAstria.*Data: MolAstria open data API.*CC BY 4\.0/);
  assert.match(await text(p, '#api-snippet'), /data-q="ORCA" data-dataset="resources" data-limit="2" data-lang="en" data-theme="dark"/);
  // On someone else's page: one script tag, the card appears after it and the page's own CSS does not reach inside.
  await go(p, '/offline.html');
  await p.evaluate(() => {
    document.head.insertAdjacentHTML('beforeend', '<style>a{color:rgb(255,0,0)!important} li{padding:99px!important}</style>');
    const s = Object.assign(document.createElement('script'), { src: '/api/embed.js' });
    Object.assign(s.dataset, { q: '密度泛函', dataset: 'journals,videos', limit: '3', title: 'DFT 入门' });
    document.body.append(s);
  });
  await p.waitForFunction(() => document.querySelector('.molastria-embed')?.shadowRoot?.querySelectorAll('li').length === 3);
  assert.equal((await card('.molastria-embed', 'header span'))[0], 'DFT 入门');
  assert.ok((await card('.molastria-embed', '.k')).every((k) => k === '期刊' || k === '视频'));
  const style = await p.evaluate(() => { const r = document.querySelector('.molastria-embed').shadowRoot; return [getComputedStyle(r.querySelector('a')).color, getComputedStyle(r.querySelector('li')).paddingTop]; });
  assert.notEqual(style[0], 'rgb(255, 0, 0)'); assert.equal(style[1], '12px');
  assert.ok(await p.evaluate(() => [...document.querySelector('.molastria-embed').shadowRoot.querySelectorAll('a')].every((a) => /^https:\/\//.test(a.href) && a.rel === 'noopener')));
  // Nothing matches: says so instead of an empty box.
  await p.evaluate(() => window.MolAstriaEmbed.render(document.querySelector('.molastria-embed'), { q: 'zzzz-nothing', lang: 'en' }));
  await p.waitForFunction(() => /Nothing matches/.test(document.querySelector('.molastria-embed').shadowRoot.querySelector('.state')?.textContent));
  await finish(p);
});

check('3D molecule viewer and sketcher: the model API sample turns in 3D, the sketcher hands the SMILES back', async () => {
  const p = await open();
  await go(p, '/models/index.html');
  await p.check('input[name=m-mode][value=xyz]');
  await p.click('#m-xyz-sample');
  await p.click('#m-xyz-3d .m3-open');
  await p.waitForSelector('#m-xyz-3d[data-ready=true]', { timeout: 30000 });
  assert.match(await text(p, '#m-xyz-3d .m3-info'), /H2O · 3 个原子/);
  assert.ok(await p.evaluate(() => document.querySelector('#m-xyz-3d canvas').width > 300), '3Dmol.js drew on a canvas');
  await p.selectOption('#m-xyz-3d .m3-bar select', 'sphere');
  // The sketcher opens with the current SMILES drawn and gives back the same molecule.
  await p.check('input[name=m-mode][value=smiles]').catch(() => {});
  await p.waitForFunction(() => /C3H3FO3/.test(document.getElementById('m-check').textContent), null, { timeout: 30000 });
  const before = await p.inputValue('#m-smiles');
  await p.click('.sk-open');
  await p.waitForSelector('.sk-dialog[data-ready=true]', { timeout: 30000 });
  await p.click('.sk-ok');
  await p.waitForFunction(() => !document.querySelector('.sk-dialog').open, null, { timeout: 10000 });
  assert.ok((await p.inputValue('#m-smiles')).length >= before.length - 2, 'a SMILES came back');
  await p.waitForFunction(() => /C3H3FO3/.test(document.getElementById('m-check').textContent), null, { timeout: 10000 });
  await finish(p);
});

check('quantum biology structure gallery: six PDB structures, the first loads when scrolled to, buttons switch', async () => {
  const cif = ['data_MINI', 'loop_', ...'group_PDB id type_symbol label_atom_id label_alt_id label_comp_id label_asym_id label_entity_id label_seq_id pdbx_PDB_ins_code Cartn_x Cartn_y Cartn_z occupancy B_iso_or_equiv auth_seq_id auth_comp_id auth_asym_id auth_atom_id pdbx_PDB_model_num'.split(' ').map((k) => `_atom_site.${k}`),
    'ATOM 1 N N . GLY A 1 1 ? 0.000 0.000 0.000 1.00 10.00 1 GLY A N 1', 'ATOM 2 C CA . GLY A 1 1 ? 1.458 0.000 0.000 1.00 10.00 1 GLY A CA 1',
    'ATOM 3 C C . GLY A 1 1 ? 2.009 1.420 0.000 1.00 10.00 1 GLY A C 1', 'ATOM 4 O O . GLY A 1 1 ? 1.251 2.390 0.000 1.00 10.00 1 GLY A O 1',
    'HETATM 5 FE FE . FE2 B 2 . ? 4.000 5.000 1.000 1.00 10.00 901 FE2 A FE 1', ''].join('\n');
  for (const lang of ['', '?lang=en']) {
    const p = await open({ viewport: { width: lang ? 390 : 1280, height: 900 }, colorScheme: lang ? 'dark' : 'light' });
    const asked = [];
    await p.context().route('https://files.rcsb.org/**', (r) => { asked.push(r.request().url()); return r.fulfill({ body: cif, headers: { 'access-control-allow-origin': '*' } }); });
    await go(p, `/quantum/biology/index.html${lang}`);
    assert.equal(await p.locator('.qb-struct-btn').count(), 6);
    assert.equal(asked.length, 0, 'nothing downloads before the gallery is on screen');
    await p.locator('#qb-structures').scrollIntoViewIfNeeded();
    await p.waitForSelector('#qb-struct-3d[data-ready=true]', { timeout: 30000 });
    await p.click('.qb-struct-btn[data-pdb="3PZW"]');
    await p.waitForFunction(() => document.querySelector('.qb-struct-btn[data-pdb="3PZW"]').getAttribute('aria-pressed') === 'true');
    assert.ok(asked.some((u) => /3PZW/i.test(u)), 'the chosen entry is fetched from RCSB');
    assert.match(await text(p, '#qb-struct-text'), lang ? /[A-Za-z]{4}/ : /[一-鿿]/);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
    await finish(p);
  }
});

check('quantum algorithms circuit: rotation gates, mid-circuit measurement, step through columns, Bloch spheres', async () => {
  const p = await open({ viewport: { width: 1360, height: 900 } });
  await go(p, '/quantum/algorithms/index.html');
  // Teleportation: after the whole circuit, q2 carries the pure state that started on q0.
  await p.selectOption('#c-preset', 'teleport');
  assert.equal(await p.locator('#c-bloch .qa-bl').count(), 3);
  assert.deepEqual(await p.$$eval('#c-bloch figcaption', (x) => x.map((y) => y.textContent)), ['q0 · |r| 0.00', 'q1 · |r| 0.00', 'q2 · |r| 1.00']);
  assert.match(await text(p, '#c-read'), /测量分支数/);
  // Step back to after column 5: q0 is still partly coherent, q2 is not yet.
  await p.fill('#c-step', '5'); await p.dispatchEvent('#c-step', 'input');
  assert.match(await text(p, '#c-step-o'), /5/);
  assert.equal(await p.locator('#c-grid .qa-after').count() > 0, true, 'later columns are greyed');
  assert.deepEqual(await p.$$eval('#c-bloch figcaption', (x) => x.map((y) => y.textContent)), ['q0 · |r| 0.45', 'q1 · |r| 0.00', 'q2 · |r| 0.00']);
  // Rx(π/2) on |0⟩ gives 50 % / 50 %.
  await p.selectOption('#c-preset', 'rotation');
  assert.equal(await p.locator('#c-bars .qa-bar:not([data-zero])').count(), 2);
  assert.match(await text(p, '#c-bars'), /50\.0%[\s\S]*50\.0%/);
  // A rotation gate placed by hand keeps its angle through a reload.
  await p.click('#c-clear');
  await p.fill('#c-angle', '1'); await p.dispatchEvent('#c-angle', 'input');
  await p.click('.qa-pal[data-g=Ry]'); await p.click('.qa-cell[data-q="0"][data-c="0"]');
  assert.match(await text(p, '#c-bars'), /\|1⟩[\s\S]*100\.0%|\|10?⟩[\s\S]*100\.0%/);
  await p.reload();
  assert.match(await text(p, '#c-grid'), /Ry/);
  await p.click('#c-clear');
  await finish(p);
});

check('resource catalogue: 253 entries, the 2026-11-10 additions are searchable in both languages', async () => {
  const p = await open();
  await go(p, '/atlas/index.html');
  assert.match(await text(p, '.filter[data-filter=all]'), /253/);
  await p.fill('#search', 'PySCF');
  await p.waitForTimeout(300);
  assert.match(await text(p, 'main'), /Apache-2.0/);
  await p.fill('#search', 'Quirk');
  await p.waitForTimeout(300);
  assert.match(await text(p, 'main'), /Quirk/);
  for (const [q, lic] of [['Environ', /GPL-2\.0/], ['VOTCA', /Apache-2\.0/]]) { // 2026-11-12 content-gap additions
    await p.fill('#search', q);
    await p.waitForTimeout(300);
    assert.match(await text(p, 'main'), lic, q);
  }
  await finish(p);
  const e = await open();
  await go(e, '/index.html?lang=en');
  await e.waitForFunction(() => document.getElementById('stat-atlas').textContent === '253', null, { timeout: 5000 }); // the figure counts up when it comes into view
  await finish(e);
});

check('code desk: inputs for nine programs, spin check, output reader, software check-up (mocked APIs), code search links, English', async () => {
  const p = await open({ acceptDownloads: true });
  const ctx = p.context();
  await ctx.route('https://pypi.org/pypi/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ info: { name: 'pyscf', version: '2.15.0', summary: 'PySCF', license: 'Apache-2.0', requires_python: '>=3.9', project_urls: { Repository: 'https://github.com/pyscf/pyscf' }, classifiers: [] }, urls: [{ upload_time_iso_8601: '2026-11-05T05:41:29Z' }] }) }));
  await ctx.route('https://api.osv.dev/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ full_name: 'pyscf/pyscf', html_url: 'https://github.com/pyscf/pyscf', stargazers_count: 1720, pushed_at: '2026-11-10T02:30:05Z', archived: false, license: { spdx_id: 'Apache-2.0' } }) }));
  await ctx.route('https://archive.softwareheritage.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ date: '2026-10-30T12:00:00Z', status: 'full' }) }));
  await go(p, '/code/index.html');
  assert.match(await text(p, '#in-status'), /H2O · 3 个原子 · 10 个电子/);
  assert.match(await text(p, '#in-code'), /dft\.RKS\(mol\)/);
  await p.fill('#in-mult', '2');
  assert.equal(await p.getAttribute('#in-status', 'data-bad'), 'true');
  assert.equal(await p.isDisabled('#in-copy'), true);
  await p.click('[data-sample=o2]');
  await p.selectOption('#in-task', 'optfreq');
  await p.click('[data-prog=xtb]');
  assert.equal(await text(p, '#in-run'), 'xtb o2.xyz --ohess --gfn 2 --chrg 0 --uhf 2');
  await p.click('[data-prog=orca]');
  assert.match(await text(p, '#in-code'), /! B3LYP def2-SVP UKS Opt Freq[\s\S]*\* xyz 0 3/);
  const dl = p.waitForEvent('download');
  await p.click('#in-save');
  assert.equal((await dl).suggestedFilename(), 'o2.inp');
  await p.click('[data-prog=qcschema]');
  assert.match(await text(p, '#in-code'), /qcschema_optimization_input/);
  // 读输出
  await p.click('#t-output');
  await p.click('#out-demo');
  assert.match(await text(p, '#out-result'), /ORCA[\s\S]*-114\.50123046 Eh[\s\S]*1 个虚频/);
  await p.click('.cd-diff summary');
  await p.fill('#d-e2', '-114.4');
  assert.match(await text(p, '#d-out'), /kcal\/mol/);
  // 软件体检
  await p.click('#t-check');
  await p.waitForSelector('#ck-swh .ok');
  assert.match(await text(p, '#ck-out'), /pyscf 2\.15\.0[\s\S]*最新版本没有已知漏洞[\s\S]*Apache-2\.0[\s\S]*1,720[\s\S]*已存档/);
  assert.match(await text(p, '#lic-table'), /GPL[\s\S]*不行/);
  // 搜代码
  await p.click('#t-search');
  const gh = await p.getAttribute('[data-engine=github]', 'href');
  assert.match(decodeURIComponent(gh), /def get_veff \(repo:pyscf\/pyscf OR/);
  await p.uncheck('#sr-chem');
  assert.doesNotMatch(decodeURIComponent(await p.getAttribute('[data-engine=github]', 'href')), /repo:/);
  // 刷新后回到同一个标签和分子
  await p.reload({ waitUntil: 'networkidle' });
  assert.equal(await p.evaluate(() => document.body.dataset.tab), 'search');
  await finish(p);
  const e = await open();
  await go(e, '/code/index.html?lang=en#input');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  assert.match(await text(e, '.cd-tabs'), /Write inputs[\s\S]*Read outputs/);
  assert.match(await text(e, '#in-status'), /electrons/);
  assert.doesNotMatch(await e.evaluate(() => document.querySelector('main').innerText), /[㐀-鿿]/, 'no Chinese left on the input tab');
  await finish(e);
});

/** Serves OpenChemLib (the SMILES → 3D library the code desk loads from jsDelivr) from tools/e2e/node_modules. */
const OCL_DIST = join(ROOT, 'tools/e2e/node_modules/openchemlib/dist/');
async function localOCL(ctx, delay = 0) {
  const served = { 'openchemlib.js': 0, 'resources.json': 0 };
  await ctx.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/openchemlib@[\d.]+\/dist\/(openchemlib\.js|resources\.json)$/, async (r) => {
    const f = new URL(r.request().url()).pathname.split('/').pop();
    served[f]++;
    if (delay) await new Promise((ok) => setTimeout(ok, delay));
    await r.fulfill({ status: 200, contentType: f.endsWith('.json') ? 'application/json' : 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(join(OCL_DIST, f)) });
  });
  return served;
}

check('code desk: SMILES to 3D in a worker, frame picker, NWChem / CP2K / Q-Chem demos, English', async () => {
  const p = await open();
  const served = await localOCL(p.context());
  p.workerCount = 0;
  p.on('worker', () => { p.workerCount++; });
  await go(p, '/code/index.html');
  const embed = async (page, smiles) => {
    await page.fill('#in-smiles', smiles);
    await page.click('#in-embed');
    await page.waitForFunction(() => !document.getElementById('in-embed').disabled, null, { timeout: 60000 });
    return text(page, '#in-embed-status');
  };
  // L-alanine: several conformers, all the same enantiomer, sorted by MMFF94 energy
  assert.match(await embed(p, 'C[C@H](N)C(=O)O'), /搭了 \d+ 个构象，去掉重复的还剩 \d+ 个/);
  assert.equal(p.workerCount, 1, 'the force field runs in a Web Worker');
  assert.match(await text(p, '#in-status'), /C3H7NO2 · 13 个原子 · 48 个电子/);
  assert.match(await p.inputValue('#in-xyz'), /^13\nconformer 1\/\d+ from SMILES C\[C@H\]\(N\)C\(=O\)O \| MMFF94s\+ E = -?\d+\.\d{3} kcal\/mol\n/);
  assert.equal(await p.isVisible('#in-frame-row'), true);
  const n = await p.locator('#in-frame option').count();
  assert.ok(n >= 2, `${n} conformers`);
  const first = await text(p, '#in-code');
  await p.selectOption('#in-frame', String(n - 1));
  assert.notEqual(await text(p, '#in-code'), first, 'the input is written from the chosen frame');
  assert.match(await text(p, '#in-status'), /C3H7NO2/);
  assert.match(await text(p, '#in-embed-status'), new RegExp(`现在用的是第 ${n} 个，比最低的高 \\d+\\.\\d\\d kcal/mol`), 'the status follows the chosen frame');
  // pasting another multi-frame file starts again from its first frame
  await p.fill('#in-xyz', '3\nfirst\nO 0 0 0\nH 0 0.76 0.59\nH 0 -0.76 0.59\n3\nsecond\nO 0 0 0.1\nH 0 0.76 0.69\nH 0 -0.76 0.69\n3\nthird\nO 0 0 0.2\nH 0 0.76 0.79\nH 0 -0.76 0.79\n');
  assert.equal(await p.inputValue('#in-frame'), '0');
  assert.equal(await text(p, '#in-embed-status'), '', 'the SMILES status went with the molecule it described');
  await embed(p, 'C[C@H](N)C(=O)O');
  // charge and multiplicity come from the SMILES
  await embed(p, '[CH3]');
  assert.equal(await p.inputValue('#in-mult'), '2');
  assert.equal(await p.getAttribute('#in-status', 'data-bad'), 'false');
  assert.match(await text(p, '#in-embed-notes'), /未成对电子/);
  await embed(p, 'CC(=O)[O-]');
  assert.equal(await p.inputValue('#in-charge'), '-1');
  assert.equal(p.workerCount, 1, 'one worker for every run: the library stays loaded');
  assert.deepEqual(served, { 'openchemlib.js': 1, 'resources.json': 1 }, 'OpenChemLib is fetched once');
  // an odd electron count OpenChemLib does not flag still gets an even multiplicity; a bare atom follows Hund's rule
  await embed(p, '[Cu+2]');
  assert.deepEqual([await p.inputValue('#in-mult'), await p.getAttribute('#in-status', 'data-bad')], ['2', 'false']);
  await embed(p, '[N]');
  assert.equal(await p.inputValue('#in-mult'), '4');
  assert.match(await text(p, '#in-embed-notes'), /洪特规则/);
  // a bracket atom OpenChemLib would give a hydrogen is refused, not silently changed
  assert.match(await embed(p, 'O=[N]=O'), /方括号里的 \[N\] 写明了 0 个氢，OpenChemLib 读成了 1 个/);
  // unspecified stereo is fixed and said; a bad SMILES is said and the coordinates stay
  await embed(p, 'CC(N)C(=O)O');
  assert.match(await text(p, '#in-embed-notes'), /1 处立体构型没写，按第一个搭出的结构定成了 \S*@/);
  const before = await p.inputValue('#in-xyz');
  assert.match(await embed(p, 'C1CC'), /这个 SMILES 读不出来：.*ring closure/);
  assert.equal(await p.getAttribute('#in-embed-status', 'data-bad'), 'true');
  assert.equal(await p.inputValue('#in-xyz'), before);
  // the sketcher button sits next to the SMILES box
  assert.equal(await p.isVisible('.cd-smi-row .sk-open'), true);
  // a sample clears the frames and the notes about the old molecule
  await p.click('[data-sample=water]');
  assert.equal(await p.isHidden('#in-frame-row'), true);
  assert.deepEqual([await text(p, '#in-embed-status'), await text(p, '#in-embed-notes')], ['', '']);
  // output demos for the three new readers
  await p.click('#t-output');
  await p.selectOption('#out-demo-prog', 'nwchem');
  assert.match(await text(p, '#out-result'), /NWChem[\s\S]*-76\.40702414 Eh[\s\S]*结构优化收敛[\s\S]*9\.673 eV[\s\S]*1710\.8 3721\.1 3844\.9/);
  await p.selectOption('#out-demo-prog', 'cp2k');
  assert.match(await text(p, '#out-result'), /CP2K[\s\S]*结构优化没有收敛/);
  await p.selectOption('#out-demo-prog', 'qchem');
  assert.match(await text(p, '#out-result'), /Q-Chem[\s\S]*1\.823 eV开壳层：HOMO 取 α、β 里较高的一个/);
  await p.selectOption('#out-demo-prog', 'orca');
  assert.match(await text(p, '#out-result'), /ORCA[\s\S]*1 个虚频/);
  // the library cannot load: the page says so and nothing breaks
  await p.click('#t-input');
  await p.context().unrouteAll();
  await p.context().route(/cdn\.jsdelivr\.net\/npm\/openchemlib/, (r) => r.abort());
  await p.evaluate(() => window.MolAstriaSmiles3D.stop(true)); // the idle worker holds the loaded copy; end it so a new one fetches again
  assert.match(await embed(p, 'CCO'), /没载入 OpenChemLib/);
  await finish(p);
  const e = await open();
  await localOCL(e.context());
  await go(e, '/code/index.html?lang=en#input');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await embed(e, 'CC(N)C(=O)O'); // frames, a status line and a note showing
  assert.equal(await e.isVisible('#in-frame-row'), true);
  assert.doesNotMatch(await e.evaluate(() => document.querySelector('main').innerText), HAN, 'no Chinese left on the input tab with frames and notes');
  await e.click('#t-output');
  for (const k of ['nwchem', 'cp2k', 'qchem']) {
    await e.selectOption('#out-demo-prog', k);
    assert.doesNotMatch(await text(e, '#out-result'), HAN, `${k} result in English`);
  }
  await finish(e);
});

check('code desk: without module workers the SMILES runs in the page, and Stop still stops it', async () => {
  const p = await open({ init: { content: 'window.Worker = function () { throw new Error(\'no module workers\'); };' } });
  await localOCL(p.context(), 1500);
  await go(p, '/code/index.html');
  const before = await p.inputValue('#in-xyz');
  await p.fill('#in-smiles', 'CCO');
  await p.click('#in-embed');
  await p.waitForTimeout(300);
  await p.click('#in-embed-stop');
  await p.waitForFunction(() => !document.getElementById('in-embed').disabled);
  assert.equal(await text(p, '#in-embed-status'), '已停止。');
  await p.waitForTimeout(2500); // the library arrives after the stop: nothing may change
  assert.equal(await p.inputValue('#in-xyz'), before);
  assert.equal(await text(p, '#in-embed-status'), '已停止。');
  await p.fill('#in-smiles', 'CCN'); // and the next run works in the page
  await p.click('#in-embed');
  await p.waitForFunction(() => !document.getElementById('in-embed').disabled, null, { timeout: 60000 });
  assert.match(await p.inputValue('#in-xyz'), /from SMILES CCN/);
  await finish(p);
});

check('code desk: cheminformatics with RDKit (descriptors, Lipinski, SMARTS, similarity, CSV, Python), English', async () => {
  const p = await open({ acceptDownloads: true });
  await go(p, '/code/index.html#chem');
  assert.equal(await p.getAttribute('#t-chem', 'aria-selected'), 'true');
  await p.waitForFunction(() => /算了 6 个分子/.test(document.getElementById('ci-status').textContent), null, { timeout: 60000 });
  assert.equal(await p.locator('#ci-table tbody tr[data-i]').count(), 6);
  const aspirin = await text(p, '#ci-table tbody tr[data-i="0"]');
  assert.match(aspirin, /阿司匹林[\s\S]*C9H8O4[\s\S]*180\.16[\s\S]*1\.31[\s\S]*63\.6/); // RDKit: MW, Crippen cLogP, TPSA
  assert.match(await text(p, '#ci-detail'), /BSYNRYMUTXBXSQ-UHFFFAOYSA-N/);
  // a carboxylic acid SMARTS: aspirin, ibuprofen, salicylic acid
  await p.selectOption('#ci-smarts-pick', { label: '羧酸' });
  await p.waitForFunction(() => /3 个含有这个子结构/.test(document.getElementById('ci-status').textContent));
  // similarity to salicylic acid: itself first, Tanimoto 1
  await p.fill('#ci-ref', 'OC(=O)c1ccccc1O');
  await p.waitForFunction(() => /Tanimoto/.test(document.getElementById('ci-status').textContent));
  assert.match(await text(p, '#ci-table tbody tr[data-i="0"]'), /水杨酸[\s\S]*1\.000/);
  // a broken line is marked, the rest still computed
  await p.fill('#ci-list', 'CCO ethanol\nC1CC broken\n');
  await p.click('#ci-run');
  await p.waitForFunction(() => /有 1 行读不出 SMILES/.test(document.getElementById('ci-status').textContent));
  assert.equal(await p.locator('#ci-table tr.ci-bad').count(), 1);
  const dl = p.waitForEvent('download');
  await p.click('#ci-csv');
  const csv = readFileSync(await (await dl).path(), 'utf8');
  assert.match(csv, /^name,input_smiles,canonical_smiles,formula,inchikey,amw/);
  assert.match(csv, /ethanol,CCO,CCO,C2H6O,LFQSCWFLJHTTHZ-UHFFFAOYSA-N,46\.069/);
  await p.click('#ci-py');
  assert.match(await text(p, '#ci-pycode'), /pip install rdkit[\s\S]*\("CCO", "ethanol"\)[\s\S]*MolFromSmarts\("\[CX3\]\(=O\)\[OX2H1\]"\)[\s\S]*TanimotoSimilarity/);
  // the row hands its SMILES to the input tab
  await p.click('#ci-table tbody tr[data-i="0"]');
  await p.click('#ci-to3d');
  assert.equal(await p.getAttribute('#t-input', 'aria-selected'), 'true');
  assert.equal(await p.inputValue('#in-smiles'), 'CCO');
  await finish(p);
  const e = await open();
  await go(e, '/code/index.html?lang=en#chem');
  await e.waitForFunction(() => /6 molecules/.test(document.getElementById('ci-status').textContent), null, { timeout: 60000 });
  assert.match(await text(e, '#ci-table tbody tr[data-i="0"]'), /aspirin/);
  assert.doesNotMatch(await e.evaluate(() => document.getElementById('p-chem').innerText), /[㐀-鿿]/, 'no Chinese left on the cheminformatics tab');
  await finish(e);
});

check('code desk: structure search asks PubChem (mocked) by drawing or SMILES, ranks by Morgan similarity, adds a hit to the list', async () => {
  const p = await open();
  const asked = [];
  await p.route(/pubchem\.ncbi\.nlm\.nih\.gov\/rest\/pug\/compound\//, (route) => {
    const r = route.request(), url = r.url();
    asked.push({ url, body: r.postData() || '' });
    if (/fastsimilarity_2d|fastsubstructure/.test(url)) return route.fulfill({ json: { IdentifierList: { CID: [1983, 2244, 338] } }, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/fastidentity/.test(url)) return route.fulfill({ status: 404, json: { Fault: { Code: 'PUGREST.NotFound', Message: 'No CID found' } }, headers: { 'Access-Control-Allow-Origin': '*' } });
    return route.fulfill({ json: { PropertyTable: { Properties: [
      { CID: 2244, MolecularFormula: 'C9H8O4', MolecularWeight: '180.16', SMILES: 'CC(=O)OC1=CC=CC=C1C(=O)O', Title: 'Aspirin' },
      { CID: 1983, MolecularFormula: 'C8H9NO2', MolecularWeight: '151.16', SMILES: 'CC(=O)NC1=CC=C(C=C1)O', Title: 'Acetaminophen' },
      { CID: 338, MolecularFormula: 'C7H6O3', MolecularWeight: '138.12', SMILES: 'C1=CC=C(C(=C1)C(=O)O)O', Title: 'Salicylic Acid' },
    ] } }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await go(p, '/code/index.html#chem');
  await p.waitForFunction(() => /算了 6 个分子/.test(document.getElementById('ci-status').textContent), null, { timeout: 60000 });
  assert.ok(await p.locator('#ss-box .ms-sketch-btn, #ss-box button', { hasText: '画结构' }).count(), 'the drawing button sits next to the search box');
  await p.click('#ss-go');
  await p.waitForFunction(() => /找到 3 个/.test(document.getElementById('ss-status').textContent), null, { timeout: 30000 });
  assert.match(asked[0].url, /fastsimilarity_2d\/smiles\/cids\/JSON\?MaxRecords=20&Threshold=90$/);
  assert.equal(decodeURIComponent(asked[0].body.replace(/^smiles=/, '')), 'CC(=O)Oc1ccccc1C(=O)O', 'RDKit canonical SMILES in the form body');
  assert.match(asked[1].url, /cid\/1983,2244,338\/property\//);
  const names = await p.$$eval('#ss-table tbody tr b', (bs) => bs.map((b) => b.textContent));
  assert.deepEqual(names, ['Aspirin', 'Salicylic Acid', 'Acetaminophen'], 'ranked by Morgan Tanimoto to the query');
  assert.match(await text(p, '#ss-table tbody tr:first-child'), /CID 2244[\s\S]*C9H8O4[\s\S]*180\.16[\s\S]*1\.000/);
  assert.equal(await p.getAttribute('#ss-table tbody tr:first-child a[href*="pubchem"]', 'href'), 'https://pubchem.ncbi.nlm.nih.gov/compound/2244');
  assert.equal(await p.getAttribute('#ss-table tbody tr:first-child a[href*="index.html?q="]', 'href'), '../index.html?q=Aspirin');
  await p.click('#ss-table tbody tr:nth-child(2) [data-ss=add]');
  await p.waitForFunction(() => /算了 7 个分子/.test(document.getElementById('ci-status').textContent));
  assert.match(await p.inputValue('#ci-list'), /C1=CC=C\(C\(=C1\)C\(=O\)O\)O Salicylic Acid\n$/);
  // the threshold box is only for similarity; no match is not an error
  await p.selectOption('#ss-mode', 'identity');
  assert.equal(await p.isVisible('#ss-th'), false);
  await p.click('#ss-go');
  await p.waitForFunction(() => /没有找到/.test(document.getElementById('ss-status').textContent));
  assert.equal(await p.getAttribute('#ss-status', 'data-bad'), 'false');
  assert.match(asked.at(-1).url, /identity_type=same_connectivity/);
  // a SMILES RDKit cannot read never reaches PubChem
  const n = asked.length;
  await p.fill('#ss-q', 'C1CC');
  await p.click('#ss-go');
  await p.waitForFunction(() => /RDKit 读不出/.test(document.getElementById('ss-status').textContent));
  assert.equal(asked.length, n);
  await finish(p);
  const e = await open();
  await go(e, '/code/index.html?lang=en#chem');
  await e.waitForFunction(() => /6 molecules/.test(document.getElementById('ci-status').textContent), null, { timeout: 60000 });
  assert.doesNotMatch(await e.evaluate(() => document.getElementById('ss-box').innerText), /[㐀-鿿]/, 'the structure search box is translated');
  await finish(e);
});

check('code desk: the output reader shows every structure of an optimisation, its energies and the 3D trajectory', async () => {
  const p = await open({ acceptDownloads: true });
  await go(p, '/code/index.html#output');
  await p.fill('#out-text', readFileSync(join(ROOT, 'tools/code-fixtures/orca5-dvb-gopt.out'), 'utf8'));
  assert.match(await text(p, '#out-result'), /共 4 个结构（每一步一个），最后一个有 20 个原子C10H10/);
  assert.match(await text(p, '#out-result figcaption'), /共 4 次/);
  assert.equal(await p.locator('#out-result .cd-steps circle').count(), 4);
  const dl = p.waitForEvent('download');
  await p.click('#out-xyz');
  const xyz = readFileSync(await (await dl).path(), 'utf8');
  assert.equal(xyz.split('\n').filter((l) => l.trim() === '20').length, 4, 'four frames of 20 atoms');
  assert.match(xyz, /ORCA 4\/4 E = -382\.05513337 Eh/);
  await p.click('#out-3d button');
  await p.waitForSelector('#out-3d[data-ready=true]', { timeout: 60000 });
  assert.match(await text(p, '#out-3d'), /第 1 \/ 4 帧/);
  await p.click('#out-to-input');
  assert.equal(await p.getAttribute('#t-input', 'aria-selected'), 'true');
  assert.match(await text(p, '#in-status'), /C10H10 · 20 个原子/);
  await finish(p);
});

check('models page: a result goes to the code desk with its frames, charges and multiplicities', async () => {
  const p = await openModels();
  await runJob(p, 'spin');
  await p.click('#m-result [data-act=code]');
  await p.waitForURL(/code\/index\.html#input/);
  await p.waitForSelector('#in-import:not([hidden])');
  assert.match(await text(p, '#in-import'), /这个结构来自模型接口：UMA-S 1\.2\.1 · 自旋态能隙/);
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-code-import')), null, 'read once');
  assert.equal(await p.locator('#in-frame option').count(), 2, 'one frame per spin state');
  assert.deepEqual([await p.inputValue('#in-frame'), await p.inputValue('#in-mult')], ['0', '1'], 'starts on the lower state');
  await p.selectOption('#in-frame', '1');
  assert.equal(await p.inputValue('#in-mult'), '3', 'each state keeps its own multiplicity');
  assert.equal(await p.getAttribute('#in-status', 'data-bad'), 'false');
  assert.equal(await p.inputValue('#in-name'), 'uma-spin');
  // a reload keeps the molecule but not the notice
  await p.reload({ waitUntil: 'networkidle' });
  assert.equal(await p.isHidden('#in-import'), true);
  assert.equal(await p.inputValue('#in-mult'), '3');
  await finish(p);
  // a model name with Chinese in it is translated on the English page
  const IMPORT = JSON.stringify({ xyz: '3\nw\nO 0 0 0\nH 0 0.76 0.59\nH 0 -0.76 0.59\n', charge: 0, mult: 1, name: 'esen-opt', model: 'eSEN-sm 直接受力型', job: '结构优化' });
  const e = await open({ init: { content: `try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('molastria-code-import', ${JSON.stringify(IMPORT)}); sessionStorage.setItem('seeded', '1'); } } catch {}` } });
  await go(e, '/code/index.html?lang=en#input');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  await e.waitForSelector('#in-import:not([hidden])');
  assert.doesNotMatch(await text(e, '#in-import'), HAN, await text(e, '#in-import'));
  assert.match(await text(e, '#in-import'), /eSEN-sm/);
  await finish(e);
});

check('pets: adopt one of three mascots, pat / feed / play / sleep, outfits by level, the corner buddy elsewhere, English, picture fallback', async () => {
  const p = await open();
  await go(p, '/pet/index.html');
  const mode = () => p.evaluate(() => window.MolAstriaPet?.mode);
  await p.waitForFunction(() => window.MolAstriaPet?.mode && window.MolAstriaPet.mode !== 'loading', null, { timeout: 30000 });
  assert.ok(['3d', 'still'].includes(await mode()), 'stage is 3D or the picture');
  assert.equal(await p.locator('.pt-kind[data-kind]').count(), 5, 'five mascots to choose from');
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-pet')), null, 'nothing saved before adopting');
  await p.click('.pt-kind[data-kind="astra"]');
  assert.equal(await p.getAttribute('.pt-kind[data-kind="astra"]', 'aria-checked'), 'true');
  await p.fill('#pt-name-in', '  星星  ');
  await p.click('#pt-adopt-form button[type=submit]');
  await p.waitForSelector('#pt-title');
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('molastria-pet')));
  let s = await saved();
  assert.equal(s.kind, 'astra');
  assert.equal(s.name, '星星');
  assert.equal(await text(p, '#pt-title'), '星星');
  // 摸摸、喂食（吃饱了会拒绝）、玩耍、睡觉和叫醒
  await p.click('[data-act="pet"]');
  s = await saved();
  assert.equal(s.count.pet, 1);
  assert.equal(s.xp, 1);
  await p.click('[data-act="feed"]');
  assert.ok(await p.isVisible('#pt-snacks'), 'snack row opens');
  await p.click('[data-snack="benzene"]');
  assert.ok(await p.isHidden('#pt-snacks'), 'snack row closes');
  s = await saved();
  assert.equal(s.count.feed, 1);
  assert.ok(s.full > 95, 'full after a cookie');
  await p.click('[data-act="feed"]');
  await p.click('[data-snack="water"]');
  assert.match(await text(p, '#pt-say'), /吃不下/);
  await p.click('[data-act="play"]');
  s = await saved();
  assert.equal(s.count.play, 1);
  assert.equal(s.xp, 1 + 3 + 4);
  await p.click('[data-act="sleep"]');
  assert.equal(await text(p, '#pt-sleep-t'), '叫醒');
  assert.ok(await p.isDisabled('[data-act="feed"]'), 'no feeding while asleep');
  assert.equal(await p.getAttribute('#pt-stage', 'data-mood'), 'sleeping');
  await p.click('[data-act="wake"]');
  assert.equal(await text(p, '#pt-sleep-t'), '睡觉');
  // 配饰：2 级才有护目镜
  assert.ok(await p.isDisabled('[data-acc="goggles"]'));
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('molastria-pet')); o.xp = 65; localStorage.setItem('molastria-pet', JSON.stringify(o)); });
  await go(p, '/pet/index.html');
  assert.equal(await text(p, '#pt-lv'), 'Lv 3');
  assert.ok(await p.isEnabled('[data-acc="cap"]'));
  assert.ok(await p.isDisabled('[data-acc="halo"]'));
  await p.click('[data-acc="cap"]');
  assert.equal((await saved()).acc, 'cap');
  // 改名
  await p.click('#pt-rename');
  await p.fill('#pt-rename-in', '小星');
  await p.click('#pt-rename-form button[type=submit]');
  assert.equal((await saved()).name, '小星');
  // 换一只：进度留着
  await p.click('.pt-more summary');
  await p.click('[data-swap="budi"]');
  s = await saved();
  assert.deepEqual([s.kind, s.name, s.xp, s.acc], ['budi', '小星', 65, 'cap']);
  assert.equal((await p.request.get(`${SITE}/pet/models/budi.glb`)).status(), 200, 'model download');
  // 别的页面右下角的小伙伴：点开、收起（这个会话不再出现）
  await go(p, '/review/index.html');
  await p.waitForSelector('#pb-buddy .pb-pet');
  assert.match(await p.getAttribute('#pb-buddy img', 'src'), /pet\/img\/budi\.webp$/);
  await p.click('#pb-pet');
  assert.match(await text(p, '#pb-bub'), /小星/);
  assert.match(await p.getAttribute('#pb-bub a', 'href'), /\/pet\/index\.html$/);
  await p.click('#pb-hide');
  assert.equal(await p.locator('#pb-buddy').count(), 0);
  await go(p, '/manual/index.html');
  assert.equal(await p.locator('#pb-buddy').count(), 0, 'hidden for the rest of the session');
  // 在小窝里关掉以后，新的会话里也不出现
  await go(p, '/pet/index.html');
  await p.click('.pt-more summary');
  await p.uncheck('#pt-buddy');
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-pet-buddy')), 'off');
  await p.evaluate(() => sessionStorage.clear());
  await go(p, '/review/index.html');
  assert.equal(await p.locator('#pb-buddy').count(), 0, 'switched off');
  await p.evaluate(() => localStorage.removeItem('molastria-pet-buddy'));
  await go(p, '/review/index.html');
  await p.waitForSelector('#pb-buddy .pb-pet');
  // 重新领养
  await go(p, '/pet/index.html');
  await p.click('.pt-more summary');
  await p.click('#pt-reset');
  await p.click('#pt-reset-yes');
  await p.waitForSelector('#pt-adopt-form');
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-pet')), null);
  // 顶栏菜单里有这一栏
  assert.ok(await p.evaluate(() => [...document.querySelectorAll('a[href]')].some((a) => /\/pet\/index\.html$/.test(a.href))), 'nav links to the pet page');
  await finish(p);

  // 英文，以及载不到 three.js 时用图片
  const e = await open({ init: () => { try { localStorage.setItem('molastria-pet', JSON.stringify({ v: 1, kind: 'budi-plain', name: 'Bao', born: Date.now() - 2 * 864e5, t: Date.now(), full: 20, joy: 50, energy: 60, xp: 0 })); } catch { /* ignore */ } } });
  await e.context().route(/cdn\.jsdelivr\.net\/npm\/three@/, (r) => r.abort());
  await go(e, '/pet/index.html?lang=en');
  await e.waitForFunction(() => window.MolAstriaPet?.mode === 'still', null, { timeout: 20000 });
  assert.ok(await e.isVisible('#pt-still'), 'picture shown');
  assert.match(await e.getAttribute('#pt-still', 'src'), /img\/budi-plain\.webp$/);
  assert.match(await text(e, 'h1'), /Bao.*corner/);
  assert.equal((await text(e, '[data-act="pet"]')).trim(), 'Pat');
  assert.match(await text(e, '#pt-mood'), /Hungry/);
  await e.click('#pt-still', { force: true });
  assert.equal((await e.evaluate(() => JSON.parse(localStorage.getItem('molastria-pet')))).count.pet, 1, 'tapping the picture pats');
  assert.doesNotMatch(await text(e, 'main'), HAN, 'no Chinese left on the English page');
  await finish(e);
});

check('pet in the menu: the current group is marked by your pet (Budi by default), clicking it opens the floating garden to adopt, pat, feed and sleep; phone, English, the pet page repaints', async () => {
  const p = await open();
  await go(p, '/videos/index.html');
  await p.click('.cr-grp-btn[data-group=learn]');
  await p.waitForSelector('.cr-petm-rail:not([hidden])');
  assert.match(await p.getAttribute('.cr-petm-rail img', 'src'), /pet\/img\/budi\.webp$/, 'Budi when nothing is adopted');
  // it sits right after the group's name on the current row, not on the others
  const box = await p.evaluate(() => {
    const m = document.querySelector('.cr-petm-rail').getBoundingClientRect(), b = document.querySelector('[data-rail=learn] b').getBoundingClientRect();
    return { dx: m.left - b.right, feet: m.bottom - b.bottom };
  });
  assert.ok(box.dx >= 0 && box.dx < 12 && Math.abs(box.feet) < 6, `next to the group name ${JSON.stringify(box)}`);
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('[data-rail=learn] b'), '::after').content), 'none', 'the old green dot is gone');
  await p.click('.cr-petm-rail');
  await p.waitForSelector('#pet-garden:not([hidden])');
  assert.ok(await p.evaluate(() => document.querySelector('.cr-mega').hidden), 'the menu closes');
  assert.equal(await text(p, '#pg-t'), '苞苞的花园');
  assert.ok(await p.isVisible('[data-adopt]'), 'offers to adopt Budi');
  assert.ok(!(await p.isVisible('.pg-acts')));
  await p.click('[data-adopt]');
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('molastria-pet')));
  assert.equal((await saved()).kind, 'budi');
  await p.click('.pg-acts [data-act=pet]');
  assert.equal((await saved()).count.pet, 1);
  await p.click('.pg-acts [data-act=feed]');
  await p.click('[data-snack=water]');
  assert.equal((await saved()).count.feed, 1);
  await p.click('.pg-acts [data-act=sleep]');
  assert.equal((await saved()).asleep, true);
  assert.equal((await text(p, '.pg-acts [data-act=sleep]')).trim(), '叫醒');
  await p.click('.pg-acts [data-act=play]');
  assert.match(await text(p, '.pg-msg'), /睡着/, 'asleep: no playing');
  await p.keyboard.press('Escape');
  assert.ok(await p.evaluate(() => document.getElementById('pet-garden').hidden), 'Escape closes');
  await p.waitForSelector('#pb-buddy .pb-pet', { timeout: 3000 }).catch(() => {}); // the corner buddy appears on the next page
  await finish(p);

  // phone, English, an adopted Astra: the mark is next to the group title in the all-groups list
  const e = await open({ viewport: { width: 390, height: 844 }, init: () => { try { localStorage.setItem('molastria-pet', JSON.stringify({ v: 1, kind: 'astra', name: 'Star', born: Date.now() - 864e5, t: Date.now(), full: 70, joy: 70, energy: 70, xp: 0 })); } catch { /* ignore */ } } });
  await go(e, '/videos/index.html?lang=en');
  await e.click('.cr-menu-btn');
  await e.waitForSelector('.cr-sec[data-group=learn] h3 .cr-petm-head:not([hidden])');
  assert.match(await e.getAttribute('.cr-petm-head img', 'src'), /pet\/img\/astra\.webp$/);
  assert.match(await e.getAttribute('.cr-petm-head', 'aria-label'), /Star/);
  await e.click('.cr-petm-head');
  await e.waitForSelector('#pet-garden:not([hidden])');
  assert.equal(await text(e, '#pg-t'), 'Star’s garden');
  assert.doesNotMatch(await text(e, '#pet-garden'), HAN, 'no Chinese in the English garden');
  const w = await e.evaluate(() => document.querySelector('.pg-win').getBoundingClientRect().width);
  assert.equal(Math.round(w), 390, 'a bottom sheet on phones');
  assert.equal(await e.evaluate(() => document.documentElement.scrollWidth), 390, 'no sideways scroll');
  await finish(e);

  // on the pet page itself, the den repaints after acting in the garden
  const d = await open({ init: () => { try { localStorage.setItem('molastria-pet', JSON.stringify({ v: 1, kind: 'budi', name: '苞苞', born: Date.now() - 864e5, t: Date.now(), full: 70, joy: 50, energy: 70, xp: 0 })); } catch { /* ignore */ } } });
  await go(d, '/pet/index.html');
  await d.click('.cr-grp-btn[data-current]');
  await d.click('.cr-petm-rail');
  await d.click('.pg-acts [data-act=pet]');
  assert.equal(await d.evaluate(() => window.MolAstriaPet.state.count.pet), 1, 'the den saw the pat');
  await finish(d);
});

check('bookshelf: site shelves, pull a book out, status / stars / notes, my shelf, DOI / ISBN / title lookup, typed-in book, reorder, BibTeX, covers view, English', async () => {
  const p = await open();
  await go(p, '/shelf/index.html');
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('molastria-shelf') || 'null'));
  assert.equal(await saved(), null, 'nothing saved before touching anything');
  assert.ok(await p.locator('.sh-case').count() >= 6, 'site shelves');
  assert.equal(await p.locator('[data-shelf="handbook"] .sp').count(), 25, 'the Handbook series');
  // 搜索和筛选
  await p.fill('#sh-q', 'helgaker');
  await p.waitForFunction(() => document.querySelectorAll('.sp').length === 1);
  await p.fill('#sh-q', '');
  await p.waitForFunction(() => document.querySelectorAll('.sp').length > 100);
  await p.click('[data-filter="free"]');
  assert.ok(await p.locator('.sp[data-id="fm-axler-ladr"]').count() === 1 && await p.locator('.sp[data-id="helgaker"]').count() === 0, 'free-to-read filter');
  await p.click('[data-filter="all"]');
  // 抽出一本书：详情、站内推荐的链接、状态、评分、笔记、放上书架
  await p.click('.sp[data-id="helgaker"]');
  await p.waitForSelector('.sh-dlg.on #bk-title');
  assert.equal(await text(p, '#bk-title'), 'Molecular Electronic-Structure Theory');
  assert.match(await p.getAttribute('.bk-ids a', 'href'), /doi\.org\/10\.1002\/9781119019572$/);
  assert.ok(await p.locator('.bk-from a[href$="manual/index.html#p14e-cat15"]').count(), 'links back to the handbook chapter');
  assert.match(p.url(), /#b-helgaker$/);
  await p.click('[data-status="reading"]');
  await p.click('[data-rate="4"]');
  await p.fill('#bk-note', '第 9 章');
  let s = await saved();
  assert.equal(s.items.helgaker.s, 'reading');
  assert.equal(s.items.helgaker.r, 4);
  assert.deepEqual(s.order, ['helgaker'], 'marking a status puts it on my shelf');
  await p.click('.bk-x');
  await p.waitForFunction(() => document.querySelector('.sh-dlg').hidden);
  assert.equal((await saved()).items.helgaker.n, '第 9 章', 'note saved on close');
  assert.ok(await p.locator('.sp[data-id="helgaker"] .sp-reading').count(), 'ribbon on the spine');
  // 地址打开一本书，Esc 放回去
  await go(p, '/shelf/index.html#b-szabo-ostlund');
  await p.waitForSelector('.sh-dlg.on');
  await p.click('[data-act="shelve"]');
  await p.keyboard.press('Escape');
  assert.deepEqual((await saved()).order, ['helgaker', 'szabo-ostlund']);
  // 我的书架：DOI、ISBN、书名查找，手填（校验位错的 ISBN 被拦下）
  await p.click('[data-tab="mine"]');
  assert.equal(await p.locator('[data-shelf="mine"] .sp').count(), 2);
  await p.fill('#sh-find-q', '10.9999/fake.1');
  await p.click('#sh-find button[type=submit]');
  await p.waitForSelector('[data-add="0"]');
  assert.equal(await saved().then((x) => x.mine.length), 0, 'nothing added until picked');
  await p.click('[data-add="0"]');
  s = await saved();
  assert.equal(s.mine.length, 1);
  assert.equal(s.mine[0].doi, '10.9999/fake.1');
  const fake = s.mine[0].id;
  await p.fill('#sh-find-q', '978-0-486-69186-9');
  await p.click('#sh-find button[type=submit]');
  await p.waitForFunction(() => /校验位/.test(document.querySelector('.sh-find-msg').textContent));
  await p.fill('#sh-find-q', '9780486691862');
  await p.click('#sh-find button[type=submit]');
  await p.waitForSelector('[data-add="0"]');
  assert.match(await text(p, '.sh-hit'), /Modern quantum chemistry/);
  await p.click('[data-add="0"]');
  s = await saved();
  assert.equal(s.mine.length, 1, 'same ISBN as a site book: the site book is used');
  assert.match(await text(p, '.sh-find-msg'), /站内已经有了/);
  await p.click('[data-act="manual"]');
  await p.fill('#sh-manual [name=t]', 'Essentials of Computational Chemistry');
  await p.fill('#sh-manual [name=a]', 'C. J. Cramer');
  await p.fill('#sh-manual [name=isbn]', '0470091827');
  await p.click('#sh-manual button[type=submit]');
  s = await saved();
  assert.equal(s.mine.length, 2);
  const own = s.mine[1].id;
  assert.equal(s.mine[1].isbn, '9780470091821');
  assert.deepEqual(s.order, ['helgaker', 'szabo-ostlund', fake, own]);
  // 拖动换位
  const from = await p.locator(`.sp[data-id="${own}"]`).boundingBox(), to = await p.locator('.sp[data-id="helgaker"]').boundingBox();
  await p.mouse.move(from.x + from.width / 2, from.y + 40);
  await p.mouse.down();
  await p.mouse.move(from.x - 20, from.y + 40, { steps: 4 });
  await p.mouse.move(to.x + 4, to.y + 40, { steps: 8 });
  await p.mouse.up();
  assert.deepEqual((await saved()).order, [own, 'helgaker', 'szabo-ostlund', fake], 'dragged to the front');
  // 键盘换位
  await p.focus(`.sp[data-id="${own}"]`);
  await p.keyboard.press('Alt+Shift+ArrowRight');
  assert.deepEqual((await saved()).order, ['helgaker', own, 'szabo-ostlund', fake]);
  // BibTeX
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="bib"]')]);
  const bib = readFileSync(await dl.path(), 'utf8');
  assert.match(bib, /@book\{helgaker2000molecular,/);
  assert.match(bib, /isbn += \{978-0-47009-182-1\}/);
  // 封面朝外，删掉自己的书
  await p.click('[data-view="cover"]');
  assert.equal(await p.locator('[data-shelf="mine"] .face-btn').count(), 4);
  await p.click(`.face-btn[data-id="${own}"]`);
  await p.click('[data-act="unshelve"]');
  s = await saved();
  assert.equal(s.mine.length, 1);
  assert.deepEqual(s.order, ['helgaker', 'szabo-ostlund', fake]);
  assert.ok(await p.evaluate(() => [...document.querySelectorAll('a[href]')].some((a) => /\/shelf\/index\.html$/.test(a.href))), 'nav links to the shelf');
  await finish(p);

  const e = await open({ init: () => { try { localStorage.setItem('molastria-shelf', JSON.stringify({ v: 1, items: { 'qp-zeng': { s: 'want' } }, mine: [], order: ['qp-zeng', 'hb-p14e-cat15'] })); } catch { /* ignore */ } } });
  await go(e, '/shelf/index.html?lang=en#mine');
  await e.waitForFunction(() => !document.documentElement.dataset.i18n);
  assert.equal(await e.locator('[data-shelf="mine"] .sp').count(), 2);
  assert.match(await text(e, 'h1'), /Bookshelf/);
  await e.click('.sp[data-id="hb-p14e-cat15"]');
  assert.equal(await text(e, '#bk-title'), '15 · Quantum courses & textbooks');
  await e.keyboard.press('Escape');
  // 书脊上的书名是原文（这本书本来就是中文书），其余都要是英文
  const main = (await e.evaluate(() => { const m = document.querySelector('main').cloneNode(true); m.querySelectorAll('.sp').forEach((x) => x.remove()); return m.textContent; })).replace(/书架/g, '');
  assert.doesNotMatch(main, HAN, 'no Chinese left on the English page apart from book titles');
  await finish(e);
});

check('review cards: three decks, FSRS schedule, own cards, Anki export and backup, offline fallback, English', async () => {
  const LEARN = JSON.stringify({ sessions: [{ id: 's1', title: '谐振子' }], props: [{ id: 'p1', text: '谐振子的能级等间距', sessionIds: ['s1'] }, { id: 'p2', text: '升降算符满足 [a, a†] = 1', sessionIds: ['s1'] }, { id: 'p3', text: '基态能量是 ħω/2', sessionIds: ['s1'] }], chains: [{ id: 'c1', premises: ['p1', 'p2'], conclusion: 'p3' }] });
  const seed = (l) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('molastria-learn', l); sessionStorage.setItem('seeded', '1'); } } catch { /* private mode */ } };
  const p = await open({ init: { content: `(${seed})(${JSON.stringify(LEARN)})` }, acceptDownloads: true });
  await go(p, '/review/index.html');
  await p.waitForFunction(() => document.body.dataset.scheduler, null, { timeout: 20000 });
  assert.equal(await p.evaluate(() => document.body.dataset.scheduler), 'fsrs', 'ts-fsrs loaded from jsDelivr');
  // One card per group of the term table (public/search-terms.js), plus the Study Desk's four.
  const terms = (() => { const w = {}; new Function('window', readFileSync(join(ROOT, 'public/search-terms.js'), 'utf8'))(w); return w.MolAstriaTerms.groups.length; })();
  assert.match(await text(p, '#rv-status'), new RegExp(`到期 0 张 · 新卡 15 张（共 ${terms + 4} 张）`));
  assert.match(await text(p, '#rv-decks'), new RegExp(`共 ${terms} 张[\\s\\S]*共 4 张`));
  // The Study Desk's chain comes first: premises on the front, the conclusion on the back.
  assert.match(await text(p, '#rv-front'), /由这些推出什么？[\s\S]*升降算符/);
  await p.keyboard.press('Space');
  assert.match(await text(p, '#rv-back'), /基态能量/);
  assert.deepEqual(await p.$$eval('#rv-rate small', (x) => x.map((y) => y.textContent)), ['1 分钟后', '6 分钟后', '10 分钟后', await p.$eval('#rv-rate [data-iv="4"]', (y) => y.textContent)]);
  await p.keyboard.press('3');
  assert.match(await text(p, '#rv-status'), /新卡 14 张/);
  const stored = JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-review')));
  assert.equal(Object.keys(stored.sched).length, 1);
  assert.equal(stored.newDay.n, 1);
  assert.equal(await p.evaluate(() => localStorage.getItem('molastria-learn').length > 50), true, 'the Study Desk store is untouched');
  // An own card goes to the front of the new cards.
  await p.fill('#rv-f', '相关能的定义？'); await p.fill('#rv-b', 'E_exact − E_HF'); await p.fill('#rv-t', '量子化学');
  await p.click('#rv-form button[type=submit]');
  assert.match(await text(p, '#rv-front'), /相关能的定义/);
  assert.match(await text(p, '#rv-mine-sum'), /共 1 张/);
  // Anki export: headers, one line per card, tags.
  const dl = p.waitForEvent('download'); await p.click('#rv-anki');
  const anki = readFileSync(await (await dl).path(), 'utf8').trimEnd().split('\n');
  assert.deepEqual(anki.slice(0, 5), ['#separator:Tab', '#html:true', '#notetype:Basic', '#deck:MolAstria', '#tags column:3']);
  assert.equal(anki.length, 5 + terms + 5);
  assert.ok(anki.includes('相关能的定义？\tE_exact − E_HF\tMolAstria MolAstria::mine 量子化学'));
  // Backup and restore round-trip; clearing asks first.
  const bk = p.waitForEvent('download'); await p.click('#rv-backup');
  const backup = await (await bk).path();
  await p.click('#rv-reset');
  assert.match(await text(p, '#rv-mine-sum'), /共 0 张/);
  await p.setInputFiles('#rv-restore', backup);
  await p.waitForFunction(() => /共 1 张/.test(document.getElementById('rv-mine-sum').textContent));
  assert.match(await text(p, '#rv-status'), new RegExp(`新卡 14 张（共 ${terms + 5} 张）`), 'the review done before the backup still counts today');
  assert.equal(Object.keys(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-review'))).sched).length, 1);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await finish(p);
  // Offline: the simple schedule takes over and says so.
  const o = await open({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await o.context().route('https://cdn.jsdelivr.net/npm/ts-fsrs@*/**', (r) => r.abort());
  await go(o, '/review/index.html?lang=en');
  await o.waitForFunction(() => document.body.dataset.scheduler === 'simple', null, { timeout: 20000 });
  await o.waitForFunction(() => !document.documentElement.dataset.i18n);
  assert.match(await text(o, '#rv-sched-note'), /FSRS/);
  assert.match(await text(o, '#rv-status'), /Due 0/);
  await o.click('#rv-show');
  assert.deepEqual(await o.$$eval('#rv-rate small', (x) => x.map((y) => y.textContent)), ['in 10 min', 'in 1 day', 'in 1 day', 'in 4 days']);
  const han = await o.evaluate(() => { const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,[translate=no],textarea') && n.parentElement.checkVisibility()) out.push(n.nodeValue.trim()); return out; });
  assert.deepEqual(han, [], 'no Chinese left on the English page outside card content');
  assert.ok(await o.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await finish(o);
});

check('math foundations: probability demos (law of large numbers, CLT) and Lean resources; realms: double pendulum', async () => {
  const p = await open({ viewport: { width: 1280, height: 900 } });
  await go(p, '/fundamental-science/math/index.html#m-pr');
  // The demos sit in the probability panel only and compute once scrolled into view.
  assert.equal(await p.locator('.fm-panel .fm-prob').count(), 1);
  assert.equal(await p.locator('#m-pr #fm-prob + .fm-res').count(), 1, 'placed before the books');
  await p.locator('#fm-prob').scrollIntoViewIfNeeded();
  await p.waitForFunction(() => document.querySelector('#fm-lln-read dd'));
  assert.match(await text(p, '#fm-lln-read'), /种子\s*2026/);
  // Law of large numbers: N = 10 000 draws of a fair die, the running mean sits near 3.5.
  await p.locator('#fm-lln-n').fill('4');
  assert.equal(await text(p, '#fm-lln-n-v'), 'N = 10000');
  const xN = Number(await p.getAttribute('#fm-lln-read dd[data-v]', 'data-v'));
  assert.ok(Math.abs(xN - 3.5) < 0.06, `running mean ${xN}`);
  await p.click('#fm-lln-new');
  assert.match(await text(p, '#fm-lln-read'), /种子\s*2027/);
  // Central limit theorem: loaded die, n = 30; the spread of the means matches σ/√n, more draws accumulate, reset is reproducible.
  await p.selectOption('#fm-clt-d', 'loaded');
  await p.locator('#fm-clt-n').fill('9');
  assert.equal(await text(p, '#fm-clt-n-v'), 'n = 30');
  const ratio = Number(await p.getAttribute('#fm-clt-read dd.fs-big', 'data-v'));
  assert.ok(Math.abs(ratio - 1) < 0.1, `sd of means / (σ/√n) = ${ratio}`);
  await p.click('#fm-clt-go');
  assert.equal(await p.getAttribute('#fm-clt-read dd[data-v]', 'data-v'), '2000');
  const once = await text(p, '#fm-clt-read');
  await p.click('#fm-clt-reset'); await p.click('#fm-clt-go');
  assert.equal(await text(p, '#fm-clt-read'), once, 'same seed, same histogram');
  // Lean resources in the bibliographies.
  assert.equal(await p.locator('#m-la a.fm-title[href^="https://adam.math.hhu.de/"]', { hasText: 'Natural Number Game' }).count(), 1);
  assert.match(await text(p, '#m-mt .fm-res'), /Mathematics in Lean[\s\S]*Set Theory Game[\s\S]*Theorem Proving in Lean 4/);
  assert.match(await text(p, '#m-na .fm-res'), /Functional Programming in Lean/);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  await finish(p);
  const e = await open({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await go(e, '/fundamental-science/math/index.html?lang=en#m-pr');
  await e.locator('#fm-prob').scrollIntoViewIfNeeded();
  await e.waitForFunction(() => document.querySelector('#fm-clt-read dd'));
  assert.match(await text(e, '#fm-prob-h'), /law of large numbers/);
  assert.doesNotMatch(await text(e, '#fm-prob'), /[㐀-鿿]/, 'demo is English on the English page');
  assert.ok(await e.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on a phone');
  await finish(e);

  // Double pendulum: loads its maths only when the chaos (or analytical mechanics) panel opens; RK4 keeps energy; pause stops time.
  const r = await open({ viewport: { width: 1440, height: 1000 } });
  await go(r, '/physics-realms/index.html#n-gr');
  assert.equal(await r.evaluate(() => !!window.MOLASTRIA_REALMS_MODELS), false, 'not loaded up front');
  await r.evaluate(() => window.__realms.select('chaos'));
  await r.waitForSelector('#pr-dp-cv');
  assert.equal(await r.evaluate(() => !!window.MOLASTRIA_REALMS_MODELS), true);
  await r.evaluate(() => { const pn = document.querySelector('#pr-panel'); pn.scrollTop = pn.scrollHeight; });
  await r.click('#pr-dp-play');
  assert.equal(await r.getAttribute('#pr-dp-play', 'aria-pressed'), 'true');
  await r.waitForTimeout(2500);
  await r.click('#pr-dp-play');
  const v = await r.$$eval('#pr-dp-read dd', (dd) => dd.map((d) => d.dataset.v));
  assert.ok(Number(v[0]) > 1, `time advanced: ${v[0]} s`);
  assert.ok(Number(v[1]) > 1e-6 && Number(v[1]) < 1e-2, `separation grew from 1e-6: ${v[1]}`);
  assert.ok(Number(v[3]) < 1e-6, `energy drift ${v[3]}`);
  await r.waitForTimeout(400);
  assert.equal(await r.$eval('#pr-dp-read dd', (d) => d.dataset.v), v[0], 'paused: time stands still');
  await r.click('#pr-dp-reset');
  assert.equal(await r.$eval('#pr-dp-read dd', (d) => d.dataset.v), '0');
  await r.evaluate(() => window.__realms.select('newton'));
  assert.equal(await r.locator('#pr-dp').count(), 0, 'other theories have no demo');
  await r.evaluate(() => window.__realms.select('analytic'));
  await r.waitForSelector('#pr-dp-cv');
  await finish(r);
});

// A stand-in for Pyodide (the real one is 9 MB from jsDelivr; --net uses it): prints a line, returns a small chart,
// raises for print(y) with Pyodide-style frames, and never returns for `while True`, so Stop can be tested.
const FAKE_PYODIDE = `export async function loadPyodide() {
  let out = () => {};
  const dict = () => { const m = new Map(); return { get: (k) => m.get(k), has: (k) => m.has(k), set: (k, v) => m.set(k, v), destroy() {} }; };
  return {
    loadedPackages: {},
    setStdout(o) { out = o.batched; }, setStderr() {}, setStdin() {},
    globals: { get: () => dict },
    runPython(src, { globals }) { globals.set('to_json', (c) => JSON.stringify(c)); },
    async loadPackage(names) { for (const n of names) this.loadedPackages[n] = 'stand-in'; },
    async loadPackagesFromImports() {},
    async runPythonAsync(code, { globals }) {
      if (code.includes('while True')) await new Promise(() => {});
      if (code.includes('print(y)')) throw new Error('Traceback (most recent call last):\\n  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async\\n    await CodeRunner(\\n  File "h2_rhf.py", line 2, in <module>\\nNameError: name \\'y\\' is not defined');
      out('stand-in run, ' + code.split('\\n').length + ' lines');
      globals.set('chart', { title: 'stand-in', x: [0, 1, 2], series: [{ name: 'E', y: [1, 0, 1] }] });
    },
  };
}`;
check('python in the browser: run, output, chart, errors, stop and offline in the handbook and the physics pavilion (stand-in Pyodide unless --net)', async () => {
  const stand = async (p) => { if (!NET) await p.context().route(/^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v[\d.]+\/full\/pyodide\.mjs$/, (r) => r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE_PYODIDE })); };
  const settled = (p, box) => p.waitForFunction((s) => ['done', 'error', 'offline'].includes(document.querySelector(s).dataset.state), box, { timeout: 60000 });
  // Handbook: the Hartree–Fock box sits only after the compute-engines chapter.
  const p = await open();
  await stand(p);
  await go(p, '/manual/index.html#p12-cat10a');
  const box = '.guide-try-run';
  await p.waitForSelector(`${box}[data-ready=true]`);
  assert.match(await text(p, `${box} .py-status`), /约 9\.2 MB，含 numpy/, 'says how much the first run downloads');
  assert.match(await p.inputValue(`${box} .py-code`), /^R = 1\.4 /m);
  await p.click(`${box} .py-run`);
  await settled(p, box);
  assert.equal(await p.getAttribute(box, 'data-state'), 'done');
  assert.match(await text(p, `${box} .py-out`), NET ? /total energy\s+-1\.116714 hartree/ : /stand-in run/);
  assert.ok(await p.isVisible(`${box} .py-chart canvas`), 'the chart is drawn');
  await p.fill(`${box} .py-code`, 'x = 1\nprint(y)\n');
  await p.click(`${box} .py-run`);
  await settled(p, box);
  assert.equal(await p.getAttribute(box, 'data-state'), 'error');
  const err = await text(p, `${box} .py-out`);
  assert.match(err, /File "h2_rhf\.py", line 2[\s\S]*NameError/); assert.doesNotMatch(err, /_pyodide/, 'Pyodide\'s own frames are dropped');
  await p.fill(`${box} .py-code`, 'while True:\n    pass\n');
  await p.click(`${box} .py-run`);
  await p.waitForSelector(`${box}[data-state=running]`);
  await p.click(`${box} .py-stop`);
  assert.equal(await p.getAttribute(box, 'data-state'), 'stopped');
  await p.click(`${box} .py-reset`);
  assert.match(await p.inputValue(`${box} .py-code`), /^# Restricted Hartree-Fock/);
  await p.click('#guide-next');
  assert.ok(await p.locator('.guide-try').isHidden(), 'other chapters have no box');
  await finish(p);
  // Pavilion: English and phone width.
  const e = await open({ viewport: { width: 390, height: 844 } });
  await stand(e);
  await go(e, '/quantum/physics/index.html?lang=en#c-wave');
  const qb = '#c-wave .qp-py-run';
  await e.waitForSelector(`${qb}[data-ready=true]`);
  assert.equal(await text(e, `${qb} .py-run`), 'Run');
  await e.click(`${qb} .py-run`);
  await settled(e, qb);
  assert.match(await text(e, `${qb} .py-out`), NET ? /^ 0 {4}0\.499988 {4}0\.500000/m : /stand-in run/);
  assert.ok(await e.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at phone width');
  await finish(e);
  // Offline: says so and starts nothing.
  const o = await open();
  await go(o, '/quantum/physics/index.html#c-wave');
  await o.context().setOffline(true);
  await o.click(`${qb} .py-run`);
  assert.match(await text(o, `${qb} .py-status`), /现在离线/);
  assert.equal(o.workers().length, 0);
  await finish(o);
});

check('playground 15: a mirror steers the wave packet into the box; the demo is not scored', async () => {
  const p = await open();
  await go(p, '/qchem/index.html#play-wave');
  const at = async (cx, cy) => { const b = await p.locator('#wv-cv').boundingBox(), G = b.width < 520 ? b.width : Math.min(b.height, b.width * 0.68); return [b.x + cx * G / 128, b.y + cy * G / 128]; };
  await p.click('#wv-levels button >> nth=2');
  const [x0, y0] = await at(81, 105), [x1, y1] = await at(101, 85);
  await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 30 }); await p.mouse.up();
  await p.click('#wv-go');
  await p.waitForFunction(() => /过关|还没过关/.test(document.getElementById('wv-msg').textContent), null, { timeout: 60000 });
  assert.match(await text(p, '#wv-msg'), /过关！框里的概率最高/);
  const best = () => p.evaluate(() => JSON.parse(localStorage.getItem('molastria-play')).wave);
  assert.ok((await best()).steer >= 1);
  await p.click('#wv-levels button >> nth=1'); await p.click('#wv-demo'); await p.click('#wv-go');
  await p.waitForFunction(() => /示范解法：/.test(document.getElementById('wv-msg').textContent), null, { timeout: 60000 });
  assert.equal((await best()).tunnel, undefined);
  assert.ok(await p.$eval('#wv-cv', (e) => e.dataset.msPerStep));
  await finish(p);
});

check('playground 16–19 (3D hall): drag an electron pair, turn a molecule to read R/S, Miller planes, Bloch-sphere gates', async () => {
  const p = await open();
  const best = () => p.evaluate(() => JSON.parse(localStorage.getItem('molastria-play') || '{}'));
  // 16: CO₂. Drag one oxygen anywhere: on release it slides to the far side of the carbon, which is the minimum.
  await go(p, '/qchem/index.html#play-vsepr');
  await p.click('#vs-levels button >> nth=0');
  const [x0, y0] = JSON.parse(await p.$eval('#vs-cv', (e) => e.dataset.points))[0], box = await p.locator('#vs-cv').boundingBox();
  await p.mouse.move(box.x + x0, box.y + y0); await p.mouse.down(); await p.mouse.move(box.x + x0 + 30, box.y + y0 + 20, { steps: 8 }); await p.mouse.up();
  await p.waitForSelector('#vs-ask:not([hidden])');
  assert.match(await text(p, '#vs-msg'), /排好了！用了 1 次拖动/);
  await p.click('#vs-choices button:text-is("直线形")');
  assert.equal((await best()).vsepr.co2, 3);
  // PCl₅: “auto relax” finds the trigonal bipyramid, a wrong name is marked, and nothing is scored.
  await p.click('#vs-levels button >> nth=6'); await p.click('#vs-auto');
  await p.waitForSelector('#vs-ask:not([hidden])');
  await p.click('#vs-choices button:text-is("四方锥形")');
  assert.match(await text(p, '#vs-msg'), /不是这个/);
  await p.click('#vs-choices button:text-is("三角双锥形")');
  assert.match(await text(p, '#vs-msg'), /不计分/);
  assert.equal((await best()).vsepr.pcl5, undefined);
  // 17: R and S stay locked until group 4 points away; turn the molecule with the keyboard (30° steps, then 10°).
  await go(p, '/qchem/index.html#play-chiral');
  assert.ok(await p.isDisabled('#ch-ans [data-a=R]'));
  await p.focus('#ch-cv');
  const away = async () => Number(await p.$eval('#ch-cv', (e) => e.dataset.away));
  for (let i = 0; i < 400 && await away() > 28; i++) await p.keyboard.press(i < 156 ? (i % 13 === 12 ? 'Shift+ArrowDown' : 'Shift+ArrowRight') : (i % 37 === 36 ? 'ArrowDown' : 'ArrowRight'));
  assert.ok(await p.isEnabled('#ch-ans [data-a=R]'));
  await p.click('#ch-ans [data-a=R]');
  assert.match(await text(p, '#ch-msg'), /^(对了：R|应该是 S)/);
  // 18: a wrong answer is drawn and marked; the shown answer checks out but is not scored.
  await go(p, '/qchem/index.html#play-miller');
  await p.click('#mi-steps [data-i="0"][data-d="-1"]'); await p.click('#mi-steps [data-i="0"][data-d="-1"]'); await p.click('#mi-steps [data-i="1"][data-d="-1"]'); await p.click('#mi-steps [data-i="1"][data-d="-1"]');
  await p.click('#mi-go');
  assert.match(await text(p, '#mi-msg'), /^还不对：/);
  await p.click('#mi-show'); await p.click('#mi-go');
  assert.match(await text(p, '#mi-msg'), /看过答案，这一题不计分/);
  // 19: |1⟩ without X is H Z H, three gates: three stars.
  await go(p, '/qchem/index.html#play-bloch');
  await p.click('#bl-levels button >> nth=1');
  for (const g of ['H', 'Z', 'H']) { await p.click(`#bl-gates [data-g=${g}]`); await p.waitForFunction(() => !document.querySelector('#bl-gates button').disabled || /到了/.test(document.getElementById('bl-msg').textContent)); }
  assert.match(await text(p, '#bl-msg'), /到了！★★★/);
  assert.equal((await best()).bloch.one, 3);
  await go(p, '/qchem/index.html');
  assert.match(await text(p, '.play-card [data-best=bloch]'), /已得 3 \/ 27 颗星/);
  await finish(p);
});

check('playground 20 (quantum world): the WebGL page loads in its frame, switches scenes, follows the language and theme, pauses when left', async () => {
  const p = await open();
  await go(p, '/qchem/index.html#play-world');
  const frame = p.frameLocator('#qw-frame');
  await frame.locator('#nav button[data-k=atom]').waitFor();
  const f = p.frames().find((x) => x.url().includes('/qchem/world/'));
  assert.ok(f, 'the frame loaded world/');
  assert.match(f.url(), /embed=1/);
  assert.equal(await f.$eval('#home', (e) => getComputedStyle(e).display), 'none', 'no "back" link inside the playground');
  if (await f.$eval('#nogl', (e) => !e.hidden)) { console.log('    (no WebGL2 in this browser: checked the notice only)'); return; }
  await f.waitForFunction(() => window.__quantum && window.__quantum.time > 0.2);
  // scenes: the nav switches the panel; the tunnelling read-out has both transmissions and the barrier is the slider's width
  await frame.locator('#nav button[data-k=tun]').click();
  assert.ok(await f.isVisible('section[data-k=tun]'));
  await f.waitForFunction(() => /T = \d/.test(document.querySelector('#tRead').textContent));
  assert.match(await f.textContent('#tRead'), /平面波理论透射率 T = 23\.5%.*按波包的动量分布平均 23\.9%/);
  assert.equal(await f.evaluate(() => window.__quantum.mods.tun.sim.w), 1);
  await frame.locator('#nav button[data-k=bell]').click();
  await f.evaluate(() => window.__quantum.advance(3));
  assert.match(await f.textContent('#bRead'), /已统计 \d+ 对/);
  // leaving the tab pauses the scene; coming back resumes it
  await go(p, '/qchem/index.html#play-bloch');
  await f.waitForFunction(() => !window.__quantum.running);
  await go(p, '/qchem/index.html#play-world');
  await f.waitForFunction(() => window.__quantum.running);
  // the site's theme reaches the frame
  await p.evaluate(() => { localStorage.setItem('chemhub-theme', 'light'); document.documentElement.dataset.theme = 'light'; window.dispatchEvent(new Event('resize')); });
  await f.waitForFunction(() => window.__quantum.light === true);
  await p.evaluate(() => { localStorage.setItem('chemhub-theme', 'dark'); document.documentElement.dataset.theme = 'dark'; window.dispatchEvent(new Event('resize')); });
  await f.waitForFunction(() => window.__quantum.light === false);
  // English: the frame gets ?lang=en and writes its own English
  await go(p, '/qchem/index.html?lang=en#play-world');
  const g = await (async () => { for (let i = 0; i < 50; i++) { const x = p.frames().find((y) => /\/qchem\/world\/.*lang=en/.test(y.url())); if (x) return x; await p.waitForTimeout(100); } })();
  assert.ok(g, 'the frame reloaded in English');
  await g.waitForSelector('#nav button[data-k=slit]');
  assert.equal(await g.textContent('#nav button[data-k=slit]'), 'Slits');
  assert.equal(await g.textContent('section[data-k=overview] h2'), 'The quantum world, as I see it');
  await p.evaluate(() => localStorage.removeItem('chemhub-theme'));
  await p.close();
});

check('formula questions: MathLive answers graded with targeted hints, nudge, worked answer, stored progress, text fallback, English', async () => {
  const quiz = async (p, path, sel, kind = 'math-field') => {
    await go(p, path);
    await p.waitForTimeout(300); // the page scrolls to the chapter list 60 ms after the hash is read
    await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'start' }), sel);
    await p.waitForSelector(`${sel} ${kind}`, { timeout: 40000 }); // MathLive loads from jsDelivr once the block is in view
  };
  const grade = async (p, li, value) => {
    await p.evaluate(([s, v]) => { document.querySelector(`${s} math-field, ${s} .fq-text`).value = v; document.querySelector(`${s} .fq-check`).click(); }, [li, value]);
    await p.waitForFunction((s) => { const f = document.querySelector(`${s} .fq-fb`); return f.textContent && !/判分|Checking/.test(f.textContent); }, li, { timeout: 40000 }); // Compute Engine loads on first check
    return text(p, `${li} .fq-fb`);
  };
  const p = await open();
  await quiz(p, '/quantum/physics/index.html#c-wave', '#c-wave .fq');
  const li = '#c-wave #fq-wave-1';
  assert.match(await grade(p, li, String.raw`\frac{n^2\pi^2\hbar^2}{8mL^2}`), /^提示：.*换成 ħ/, 'the h-versus-ħ mistake gets its own hint');
  assert.ok(await p.isHidden(`${li} .fq-hint`) && await p.isHidden(`${li} .fq-sol`));
  assert.match(await grade(p, li, String.raw`\frac{n^2\pi^2\hbar^2}{mL^2}`), /^提示：.*p²\/\(2m\)/);
  assert.match(await text(p, `${li} .fq-hint`), /^再想想：/, 'a general nudge after two tries');
  assert.match(await grade(p, li, String.raw`\frac{\hbar^2}{2mL^2}`), /答案里应该出现：n/);
  assert.ok(await p.isVisible(`${li} .fq-sol`), 'the worked answer opens after three tries');
  assert.match(await grade(p, li, String.raw`\frac{n^2h^2}{8mL^2}`), /^答对了/, 'written with h instead of ħ is still right');
  assert.match(await grade(p, '#c-wave #fq-wave-2', String.raw`\sqrt{\frac{2}{L}}`), /^答对了/);
  assert.deepEqual(JSON.parse(await p.evaluate(() => localStorage.getItem('molastria-qp-quiz'))).sort(), ['wave-1', 'wave-2']);
  await p.reload();
  await p.waitForSelector('#c-wave #fq-wave-1 .fq-done');
  await finish(p);
  // jsDelivr unreachable: plain text boxes with ASCII maths and a note; still graded.
  const t = await open();
  await t.context().route(/cdn\.jsdelivr\.net/, (r) => r.abort());
  await quiz(t, '/fundamental-science/math/index.html#m-la', '#m-la .fq', '.fq-text');
  assert.match(await text(t, '#m-la .fq-note'), /普通文本框/);
  await t.fill('#m-la #fq-la-1 .fq-text', 'alpha+-beta');
  await t.press('#m-la #fq-la-1 .fq-text', 'Enter');
  await t.waitForFunction(() => /答对了/.test(document.querySelector('#m-la #fq-la-1 .fq-fb').textContent));
  assert.match(await grade(t, '#m-la #fq-la-2', '8^4'), /^提示：.*8⁴/);
  await finish(t);
  // English, phone width: the block is English and fits.
  const e = await open({ viewport: { width: 390, height: 844 } });
  await quiz(e, '/quantum/physics/index.html?lang=en#c-ent', '#c-ent .fq');
  assert.match(await text(e, '#c-ent .fq-h'), /Work it out/);
  assert.match(await grade(e, '#c-ent #fq-ent-1', '2'), /^Hint: 2 is the bound for local hidden variables/);
  assert.match(await grade(e, '#c-ent #fq-ent-1', String.raw`2\sqrt{2}`), /^Correct/);
  assert.ok(await e.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  await finish(e);
});

check('home glass switches: loaded only near view, silent until pressed, one plays at a time, keyboard works, bilingual', async () => {
  // Count AudioContexts the page creates: none may exist before a press (no autoplay).
  const countAudio = () => { const A = window.AudioContext; window.__acN = 0; if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); window.__acN++; } }; };
  let p = await open({ init: countAudio });
  // The discussion-room card above grows when the latest messages arrive (earlier checks leave some): an empty summary keeps
  // the distance to this block what the first layout says.
  await p.route('**/chat/summary', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"state":"on","online":0,"rooms":7,"top":[],"latest":[]}' }));
  // The weekly-picks card between them appears once an issue exists (earlier checks generate one) and pushes the block down
  // after the observer has fired: no issue keeps that card folded away.
  await p.route('**/digest/preview', (r) => r.fulfill({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }));
  // The loader starts 400 px before the block scrolls in. Where the block is when the script is asked for is what counts: a
  // look after the page settles races cards above it that grow or shrink while the home page fills in.
  let askedAt = null;
  await p.route('**/viewer/glass-switch.js', async (r) => {
    askedAt = await p.evaluate(() => document.getElementById('glass-duo').getBoundingClientRect().top - innerHeight).catch(() => null);
    await r.continue();
  });
  await go(p, '/index.html');
  if (askedAt !== null) assert.ok(askedAt < 400 + 60, `not loaded before scrolling near it (asked for ${Math.round(askedAt)} px below the screen)`);
  await p.locator('#glass-duo').scrollIntoViewIfNeeded();
  await p.waitForSelector('#glass-duo .gsw-hydrogen .gsw-switch');
  await p.waitForSelector('#glass-duo .gsw-blackhole .gsw-switch');
  await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => window.__acN), 0, 'no audio before a press');
  const H = '#glass-duo .gsw-hydrogen', B = '#glass-duo .gsw-blackhole';
  await p.click(`${H} .gsw-switch`);
  assert.equal(await p.getAttribute(`${H} .gsw-switch`, 'aria-checked'), 'true');
  assert.equal(await text(p, `${H} .gsw-state`), '2p 激发态');
  assert.ok(await p.evaluate(() => window.__acN) >= 1, 'audio starts on a press');
  await p.waitForFunction((sel) => /−3\.40 eV/.test(document.querySelector(sel).textContent), `${H} .gsw-read`);
  // Turning the black hole on turns the hydrogen off: one switch sounds at a time.
  await p.click(`${B} .gsw-switch`);
  assert.equal(await p.getAttribute(`${B} .gsw-switch`, 'aria-checked'), 'true');
  assert.equal(await p.getAttribute(`${H} .gsw-switch`, 'aria-checked'), 'false');
  assert.equal(await text(p, `${H} .gsw-state`), '1s 基态');
  // Keyboard: Space on the focused switch toggles it.
  await p.focus(`${B} .gsw-switch`);
  await p.keyboard.press('Space');
  assert.equal(await p.getAttribute(`${B} .gsw-switch`, 'aria-checked'), 'false');
  assert.equal(await text(p, `${B} .gsw-state`), '静默');
  await finish(p);
  // English: the switches carry their own English (translate="no"), the section copy comes from the dictionary.
  p = await open({ init: () => { try { localStorage.setItem('chemhub-lang', 'en'); } catch (e) {} } });
  await go(p, '/index.html?lang=en');
  await p.locator('#glass-duo').scrollIntoViewIfNeeded();
  await p.waitForSelector('#glass-duo .gsw-blackhole .gsw-switch');
  assert.equal(await text(p, `${H} .gsw-state`), '1s ground state');
  assert.equal(await p.getAttribute(`${B} .gsw-switch`, 'aria-label'), 'Cosmic music');
  await p.waitForFunction(() => !/[㐀-鿿]/.test(document.getElementById('glass-duo').innerText));
  await finish(p);
});
check('phone width: no sideways scrolling', async () => {
  for (const path of ['/index.html', '/manual/index.html', '/journals/index.html', '/scimodels/index.html', '/videos/index.html', '/fundamental-science/index.html', '/fundamental-science/math/index.html', '/quantum/biology/index.html', '/quantum/algorithms/index.html', '/quantum/computing/index.html', '/nmr/index.html', '/news/index.html', '/spectra/index.html', '/ai-math/index.html', '/pro/index.html', '/pro/account.html', '/hub/index.html', '/radar/index.html', '/research-atlas/index.html', '/qchem/index.html', '/digest/index.html', '/meta/index.html', '/models/index.html', '/download/index.html', '/about/index.html', '/api/index.html', '/review/index.html', '/learn/index.html', '/open-models/index.html', '/open-models/deepmind/index.html', '/programming/index.html', '/chat/index.html']) {
    const p = await open({ viewport: { width: 390, height: 844 } });
    await go(p, path);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `sideways scroll on ${path}`);
    await p.context().close();
  }
});

// ── discussion rooms (/chat/, deploy/chat.js behind tools/chat-local.ts) ─
/** A signed-in person on a bare WebSocket (no browser), to put something in the rooms that a page should then show. */
// Sign-in codes are limited to 20 an hour per address, and the whole suite signs in from one: the chat checks sign in
// over the API, each from an address of its own (TEST-NET-2), so they neither hit that limit nor use it up for others.
let chatAddr = 0;
async function chatToken(email) {
  const headers = { 'Content-Type': 'application/json', Origin: SITE, 'CF-Connecting-IP': `198.51.100.${(++chatAddr % 250) + 1}` };
  const post = async (path, body) => (await fetch(API + path, { method: 'POST', headers, body: JSON.stringify(body) })).json();
  const { devCode } = await post('/auth/start', { email });
  const { token } = await post('/auth/verify', { email, code: devCode });
  assert.ok(token, `no session for ${email}`);
  return token;
}
async function chatPerson(email, name) {
  const token = await chatToken(email);
  const ws = new WebSocket(`${API.replace('http', 'ws')}/chat/ws`, ['molastria-chat', `t.${token}`]);
  const frames = [], waiting = [];
  ws.addEventListener('message', (e) => {
    if (!String(e.data).startsWith('{')) return;
    const f = JSON.parse(e.data);
    frames.push(f);
    for (const w of [...waiting]) if (w.test(f)) { waiting.splice(waiting.indexOf(w), 1); w.resolve(f); }
  });
  await new Promise((ok, no) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', () => no(new Error('the chat WebSocket did not open')), { once: true }); });
  const until = (test, what) => frames.find(test) ? Promise.resolve(frames.find(test)) : new Promise((resolve, reject) => {
    waiting.push({ test, resolve });
    setTimeout(() => reject(new Error(`chat: no ${what} for ${email}; last frames ${JSON.stringify(frames.slice(-3))}`)), 8000);
  });
  let n = 0, last = 0;
  const ask = async (f) => { const cid = `e2e${++n}${randomBytes(3).toString('hex')}`; ws.send(JSON.stringify({ ...f, cid })); const r = await until((x) => x.cid === cid, f.t); assert.notEqual(r.t, 'err', `chat ${f.t}: ${r.code}`); return r; };
  await until((f) => f.t === 'hello', 'hello');
  await ask({ t: 'name', name });
  return {
    frames, until, ask, close: () => ws.close(),
    async say(room, text) { // the rooms take one message every 1.5 s from a person
      await new Promise((r) => setTimeout(r, Math.max(0, last + 1650 - Date.now())));
      const r = await ask({ t: 'say', room, text });
      last = Date.now();
      return r.m;
    }
  };
}
const chatSaid = (p, s) => p.waitForFunction((x) => [...document.querySelectorAll('.ch-rows .ch-msg .ch-text')].some((el) => el.textContent.includes(x)), s);
const chatRow = (p, s) => p.locator('.ch-rows .ch-msg').filter({ has: p.locator('.ch-text', { hasText: s }) }).last(); // by its own text, not by a line it quotes
async function chatSignedIn(email, hash) {
  const token = await chatToken(email);
  const p = await open({ init: (tk) => { try { localStorage.setItem('molastria-session', tk); } catch {} }, initArg: token });
  await go(p, `/chat/index.html${hash}`);
  return p;
}
async function chatNickname(p, name) {
  await p.waitForSelector('#ch-name');
  await p.fill('#ch-name', name);
  await p.click('dialog.ch-dlg button[type=submit]');
  await p.waitForSelector('#ch-name', { state: 'detached' });
}

check('chat: a guest reads every room, cannot post, and is offered the sign-in page', async () => {
  const p = await open();
  await go(p, '/chat/index.html#r-qc');
  await p.waitForSelector('a.ch-room[data-room="qc"][aria-current="true"]');
  assert.deepEqual(await p.$$eval('a.ch-room[data-kind="official"]', (a) => a.map((x) => x.dataset.room)), ['lobby', 'qc', 'mlip', 'software', 'papers', 'study', 'site']);
  assert.match(await text(p, '.ch-status'), /\d+ 人在线/);
  assert.equal(await p.$('#ch-input'), null, 'no message box for a guest');
  assert.match(await p.getAttribute('.ch-compose .ch-cta a.ch-btn', 'href'), /pro\/account\.html/);
  // Opening a room needs an account too: the dialog says so instead of failing quietly.
  await p.click('#ch-new-room');
  assert.match(await p.getAttribute('dialog.ch-dlg a.ch-btn.primary', 'href'), /pro\/account\.html/);
  await p.keyboard.press('Escape');
  // The two links under the room list lead to sections that exist.
  const foot = await p.$$eval('#ch-foot a', (a) => a.map((x) => x.href));
  assert.equal(foot.length, 2);
  for (const href of foot) {
    const [page, id] = href.split('#');
    assert.ok(id && (await (await p.request.get(page)).text()).includes(`id="${id}"`), `${href} has its section`);
  }
  await finish(p);
});

check('chat: two people talk live: nickname, message, unread, reply, markup stays text, delete, a room of their own', async () => {
  const a = await chatSignedIn('chat-ada@example.com', '#r-study');
  await a.waitForSelector('#ch-input');
  // The first message asks for a nickname and is sent once the name is taken.
  await a.fill('#ch-input', 'e2e 第一问：B3LYP 还是 TPSSh？');
  await a.press('#ch-input', 'Enter');
  await chatNickname(a, 'Ada_e2e');
  await chatSaid(a, 'e2e 第一问');
  assert.equal(await a.inputValue('#ch-input'), '');

  const b = await chatSignedIn('chat-ben@example.com', '#r-study');
  await chatSaid(b, 'e2e 第一问'); // history for someone who arrives later
  await b.click('#ch-name-btn');
  await chatNickname(b, 'Ben_e2e');
  await b.click('a.ch-room[data-room="lobby"]');
  await b.waitForSelector('a.ch-room[data-room="lobby"][aria-current="true"]');

  // A message in a room that is not open shows as unread; opening the room clears it.
  await a.fill('#ch-input', 'e2e 第二问：def2-TZVP 够吗');
  await a.press('#ch-input', 'Enter');
  await chatSaid(a, 'e2e 第二问');
  await b.waitForSelector('a.ch-room[data-room="study"][data-unread]');
  await b.click('a.ch-room[data-room="study"]');
  await chatSaid(b, 'e2e 第二问');
  await b.waitForSelector('a.ch-room[data-room="study"]:not([data-unread])');

  // A reply carries the line it answers.
  const second = chatRow(b, 'e2e 第二问');
  await second.hover();
  await second.locator('.ch-act-reply').click();
  assert.match(await text(b, '#ch-replying'), /Ada_e2e/);
  await b.fill('#ch-input', 'e2e 回答：单点够了');
  await b.press('#ch-input', 'Enter');
  await chatSaid(a, 'e2e 回答');
  assert.match(await chatRow(a, 'e2e 回答').locator('.ch-quote').textContent(), /Ada_e2e.*e2e 第二问/s);

  // What people type is text: no element comes out of it, a web address becomes a link that says it is user content.
  await a.fill('#ch-input', '<img src=x onerror="window.__chatXss=1"> <b>e2e-bold</b> 见 https://example.org/a?b=1 和 javascript:alert(1)');
  await a.press('#ch-input', 'Enter');
  await chatSaid(b, 'e2e-bold');
  const markup = chatRow(b, 'e2e-bold').locator('.ch-text');
  assert.equal(await markup.locator('img, b').count(), 0);
  assert.equal(await b.evaluate(() => window.__chatXss), undefined);
  assert.deepEqual(await markup.locator('a').evaluateAll((l) => l.map((x) => [x.getAttribute('href'), x.target, x.rel])), [['https://example.org/a?b=1', '_blank', 'noopener noreferrer nofollow ugc']]);

  // Deleting your own message blanks it for everybody.
  const mine = chatRow(a, 'e2e 第二问：def2');
  await mine.hover();
  await mine.locator('.ch-act-more').click();
  await a.click('dialog.ch-menu button.danger');
  await a.click('dialog.ch-dlg .ch-btn.danger.solid');
  await b.waitForFunction(() => [...document.querySelectorAll('.ch-rows .ch-msg.gone .ch-text')].some((x) => x.textContent === '这条消息已删除'));
  assert.equal(await b.locator('.ch-rows .ch-msg .ch-text', { hasText: 'e2e 第二问：def2' }).count(), 0);

  // A room of one's own: it opens at once, has its address, and a guest can walk in by that address.
  await a.click('#ch-new-room');
  await a.fill('#ch-room-title', 'E2E reading group');
  await a.fill('#ch-room-topic', 'One paper a week');
  await a.click('dialog.ch-dlg button[type=submit]');
  await a.waitForFunction(() => /^#r-[a-z0-9]+$/.test(location.hash) && document.querySelector('#ch-pane h2')?.textContent.includes('E2E reading group'));
  const room = await a.evaluate(() => location.hash);
  await b.waitForSelector(`a.ch-room[data-room="${room.slice(3)}"]`); // the list of everyone who is connected gets it
  const g = await open();
  await go(g, `/chat/index.html${room}`);
  await g.waitForFunction(() => document.querySelector('#ch-pane h2')?.textContent.includes('E2E reading group'));
  await g.context().close();
  // …and the next one has to wait: one new room in ten minutes.
  await a.click('#ch-new-room');
  await a.fill('#ch-room-title', 'E2E second room');
  await a.click('dialog.ch-dlg button[type=submit]');
  await a.waitForSelector('#ch-room-say[data-bad]');
  assert.ok((await text(a, '#ch-room-say')).length > 4);
  await finish(a);
  await finish(b);
});

check('chat: a report reaches the owner\'s panel; delete and mute take effect at once; unmute gives the voice back', async () => {
  const dave = await chatPerson('chat-dave@example.com', 'Dave_e2e');
  await dave.say('site', 'e2e 广告：便宜的机时，加我');
  const e = await chatSignedIn('chat-erin@example.com', '#r-site');
  await chatSaid(e, 'e2e 广告');
  const row = chatRow(e, 'e2e 广告');
  await row.hover();
  await row.locator('.ch-act-more').click();
  await e.locator('dialog.ch-menu button', { hasText: '举报' }).click();
  await chatNickname(e, 'Erin_e2e'); // reporting needs a nickname as well; the report dialog follows
  await e.fill('#ch-report-why', 'e2e 广告刷屏');
  await e.click('dialog.ch-dlg button[type=submit]');
  await e.waitForFunction(() => document.querySelector('.ch-toast')?.textContent.includes('已举报'));

  const o = await chatSignedIn('chat-owner@example.com', '#mod'); // a third admin: the other checks spend admin@example.com's five codes an hour
  const report = o.locator('.ch-report', { hasText: 'e2e 广告：便宜的机时' });
  await report.waitFor();
  assert.match(await report.textContent(), /Dave_e2e/);
  assert.match(await report.locator('.ch-reasons').textContent(), /e2e 广告刷屏/);
  await report.locator('button', { hasText: '删除并禁言 1 天' }).click();
  await report.waitFor({ state: 'detached' });
  const held = o.locator('.ch-users li', { hasText: 'Dave_e2e' });
  await held.waitFor();
  // The author is told at once, and everybody sees the message go.
  const muted = await dave.until((f) => f.t === 'me' && f.me.muted > Date.now(), 'mute');
  assert.ok(muted.me.muted - Date.now() > 23 * 3600e3);
  await e.waitForFunction(() => [...document.querySelectorAll('.ch-rows .ch-msg.gone .ch-text')].some((x) => x.textContent === '这条消息已被站长删除'));
  await assert.rejects(dave.ask({ t: 'say', room: 'site', text: 'e2e 还能说话吗' }), /muted/); // refused by the server, whatever a page shows
  await held.locator('button', { hasText: '解除禁言' }).click();
  await dave.until((f) => f.t === 'me' && f.me.muted === 0 && dave.frames.indexOf(f) > dave.frames.indexOf(muted), 'unmute');
  // A guest who types the panel's address gets the rooms, and is told why.
  const g = await open();
  await go(g, '/chat/index.html#mod');
  await g.waitForFunction(() => document.querySelector('.ch-toast')?.textContent.includes('只有站长'));
  assert.equal(await g.$('.ch-report'), null);
  await g.context().close();
  dave.close();
  await finish(e);
  await finish(o);
});

check('chat: the daily problem is the same for everyone today, graded in place, and hands a draft to the study room', async () => {
  const req = (await import('node:module')).createRequire(import.meta.url);
  const D = req('../../public/chat/daily-core.js');
  const vmLoad = async (file, name) => { const ctx = { window: {} }; (await import('node:vm')).runInNewContext(readFileSync(join(ROOT, 'public', file), 'utf8'), ctx); return ctx.window[name]; };
  const want = D.pick(D.pool({ qp: await vmLoad('quantum/physics/qp-quiz.js', 'MOLASTRIA_QP_QUIZ'), fm: await vmLoad('fundamental-science/math/fm-quiz.js', 'MOLASTRIA_FM_QUIZ') }), D.dayKey());
  const p = await chatSignedIn('chat-dora@example.com', '#r-lobby');
  await p.waitForSelector('a.ch-room[data-room="lobby"][aria-current="true"]');
  const card = await text(p, '#ch-daily');
  assert.match(card, /每日一题/); assert.doesNotMatch(card, /已答对/);
  await p.click('.ch-daily-btn');
  await p.waitForSelector('dialog.ch-daily-dlg .fq-item', { timeout: 40000 });
  assert.equal(await p.getAttribute('dialog.ch-daily-dlg .fq-item', 'data-q'), want.item.id, 'the problem the core picks for today');
  assert.match(await p.getAttribute('dialog.ch-daily-dlg .ch-daily-src a', 'href'), want.set === 'qp' ? new RegExp(`quantum/physics/index\\.html#c-${want.chapter}$`) : new RegExp(`math/index\\.html#m-${want.chapter}$`));
  await p.waitForSelector('dialog.ch-daily-dlg :is(math-field, .fq-text)', { timeout: 40000 });
  await p.evaluate((v) => { document.querySelector('dialog.ch-daily-dlg :is(math-field, .fq-text)').value = v; document.querySelector('dialog.ch-daily-dlg .fq-check').click(); }, want.item.answer);
  await p.waitForFunction(() => /答对了/.test(document.querySelector('dialog.ch-daily-dlg .fq-fb').textContent), null, { timeout: 40000 });
  assert.ok(JSON.parse(await p.evaluate((k) => localStorage.getItem(k), D.SETS[want.set].store)).includes(want.item.id), 'counts in its section too');
  await p.click('dialog.ch-daily-dlg .ch-dlg-f .ch-btn.primary');
  await p.waitForSelector('a.ch-room[data-room="study"][aria-current="true"]');
  await p.waitForSelector('#ch-input');
  assert.match(await p.inputValue('#ch-input'), /^【每日一题 \d\d-\d\d】[\s\S]+\n我的思路：$/);
  await p.waitForFunction(() => /已答对/.test(document.getElementById('ch-daily').textContent), null, { timeout: 5000 });
  await p.reload();
  await p.waitForSelector('.ch-daily-btn[data-solved]');
  await finish(p);
});

check('chat: English and a phone: the page speaks English by itself, list first, one column, no sideways scroll', async () => {
  const p = await open({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, init: () => { try { localStorage.setItem('chemhub-lang', 'en'); } catch (e) {} } });
  await go(p, '/chat/index.html?lang=en');
  await p.waitForSelector('a.ch-room[data-room="mlip"]');
  assert.equal(await p.getAttribute('#ch-app', 'data-view'), 'list');
  assert.match(await text(p, '.ch-h1'), /Discussion rooms/);
  assert.equal(await text(p, 'a.ch-room[data-room="mlip"] .ch-room-t'), 'ML potentials & models');
  // Official rooms, the status line, the buttons: nothing of the page's own is left in Chinese (community rooms are named by people).
  assert.deepEqual(await p.evaluate(() => {
    const out = [], w = document.createTreeWalker(document.getElementById('ch-app'), NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('a.ch-room:not([data-kind="official"]), .ch-text, .ch-quote, .ch-name')) out.push(n.nodeValue.trim());
    return out;
  }), []);
  await p.tap('a.ch-room[data-room="mlip"]');
  await p.waitForFunction(() => document.getElementById('ch-app').dataset.view === 'pane' && location.hash === '#r-mlip');
  assert.match(await text(p, '.ch-compose'), /Sign in/);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll in a room');
  await p.tap('#ch-back');
  await p.waitForFunction(() => document.getElementById('ch-app').dataset.view === 'list');
  await finish(p);
});

check('home: the chat card and the pill on the first screen show who is online and the latest messages, and step aside when the rooms are closed', async () => {
  const mia = await chatPerson('chat-mia@example.com', 'Mia_e2e');
  const said = `e2e home ${randomBytes(3).toString('hex')} <b>not bold</b> & co`;
  await mia.say('papers', said);
  let p = await open();
  await go(p, '/index.html');
  assert.equal(await p.getAttribute('#chat-pill', 'href'), 'chat/index.html');
  await p.waitForFunction(() => /现在 \d+ 人在线/.test(document.getElementById('cc-online').textContent) && /讨论室现在 \d+ 人在线/.test(document.getElementById('chat-pill-text').textContent));
  assert.ok(await p.isVisible('#chat-pill'), 'the pill is on the first screen');
  assert.ok((await p.locator('#chat-pill').boundingBox()).y < 900, 'the pill is above the fold');
  assert.deepEqual((await p.$$eval('#cc-rooms a', (a) => a.map((x) => x.getAttribute('href')))).slice(0, 7), ['lobby', 'qc', 'mlip', 'software', 'papers', 'study', 'site'].map((id) => `chat/index.html#r-${id}`));
  assert.equal(await text(p, '#cc-label'), '最新发言');
  const feed = p.locator('#cc-feed a.cc-msg');
  assert.ok((await feed.count()) >= 1 && (await feed.count()) <= 3);
  const newest = feed.last(); // the newest is at the bottom, as in a room
  assert.equal(await newest.getAttribute('href'), 'chat/index.html#r-papers');
  assert.equal(await newest.locator('.cc-say').textContent(), said);
  assert.equal(await newest.locator('.cc-say b').count(), 0, 'markup in a message stays text');
  assert.match(await newest.locator('.cc-meta').textContent(), /Mia_e2e.*论文与预印本 · 刚刚/s);
  // The button leads into the rooms.
  await p.click('#chat-card .cc-go');
  await p.waitForURL(/\/chat\/index\.html$/);
  await p.waitForSelector('a.ch-room[data-room="lobby"]');
  await finish(p);

  // English: the card's own words come from the dictionary and from chat-card.js; only what people wrote stays as written.
  p = await open({ init: () => { try { localStorage.setItem('chemhub-lang', 'en'); } catch (e) {} } });
  await go(p, '/index.html?lang=en');
  await p.waitForFunction(() => /\d+ online now/.test(document.getElementById('cc-online').textContent) && document.querySelector('#cc-feed a.cc-msg'));
  await p.waitForFunction(() => {
    for (const root of [document.getElementById('chat-card'), document.getElementById('chat-pill')]) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('.cc-say, .cc-meta b')) return false;
    }
    return true;
  });
  assert.match(await p.locator('#cc-feed a.cc-msg').last().locator('.cc-meta').textContent(), /Papers & preprints · just now/);
  await finish(p);
  mia.close();

  // Closed by the owner, or an account service that has no rooms yet: both entries go away. A network failure leaves the card as written.
  const cors = { 'Access-Control-Allow-Origin': '*' };
  for (const [how, gone] of [[{ status: 200, headers: cors, json: { state: 'off' } }, true], [{ status: 404, headers: cors, json: { error: { message: '没有这个接口' } } }, true], [null, false]]) {
    p = await open();
    await p.route('**/chat/summary', (route) => (how ? route.fulfill(how) : route.abort()));
    await go(p, '/index.html');
    await p.waitForFunction((g) => document.getElementById('chat-card').hidden === g && document.getElementById('chat-pill').hidden === g, gone);
    if (!gone) {
      assert.equal(await p.locator('#cc-feed .cc-msg').count(), 2, 'the card as it is written in the page');
      assert.ok(await p.isHidden('#cc-online'));
      assert.equal(await text(p, '#chat-pill-text'), '讨论室开张了，进来聊聊');
    }
    await finish(p);
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
