// Screenshots of the models page (public/models/) in light, dark, English and phone width, against the local fake services.
// Each shot runs one job first, so a result is on screen; the English shot also lists any Chinese left in the interface.
//   node tools/e2e/shots-online.mjs [output folder]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = process.argv[2] || join(ROOT, 'tools', 'e2e', 'shots');
const SITE_PORT = 8850, API_PORT = 8852;
const SITE = `http://localhost:${SITE_PORT}`, API = `http://127.0.0.1:${API_PORT}`;
mkdirSync(OUT, { recursive: true });
const servers = [
  spawn('deno', ['run', '--allow-net', '--allow-read', 'tools/serve.ts', String(SITE_PORT)], { cwd: ROOT, stdio: 'ignore' }),
  spawn('deno', ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-write', 'tools/account-local.ts', String(API_PORT), SITE], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, FAKE_AI: '1' } }),
];
process.on('exit', () => servers.forEach((s) => s.kill()));
for (const url of [SITE, `${API}/`]) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
// name, context options, query, window, job, theme stored by the site
const shots = [
  ['models-light', { colorScheme: 'light' }, '', 'charged', 'freq', 'light'],
  ['models-dark', { colorScheme: 'dark' }, '', 'props', 'ir', 'dark'],
  ['models-english', { colorScheme: 'light' }, '?lang=en', 'charged', 'scan', 'light'],
  ['models-phone', { colorScheme: 'light', viewport: { width: 390, height: 844 }, isMobile: true }, '', 'charged', 'md', 'light'],
];
for (const [name, options, query, win, job, theme] of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  await ctx.addInitScript((t) => { try { localStorage.setItem('chemhub-theme', t); } catch { /* */ } }, theme);
  await ctx.route('**/pay/config.js', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(/accountApi: '[^']*'/, `accountApi: '${API}'`) });
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${SITE}/models/index.html${query}#${win}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => /15/.test(document.getElementById('m-status').textContent) && /C3H3FO3/.test(document.getElementById('m-check').textContent), null, { timeout: 30000 });
  if (job === 'scan') { await p.fill('#m-smiles', 'CCCO'); await p.waitForFunction(() => /C3H8O/.test(document.getElementById('m-check').textContent)); }
  await p.selectOption('#m-job', job);
  if (win === 'props') await p.check('#m-academic');
  await p.click('#m-run');
  await p.waitForSelector('#m-result .md-res', { timeout: 20000 });
  await p.waitForFunction(() => !document.getElementById('m-progress').textContent, null, { timeout: 20000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  let han = [];
  if (query.includes('en')) {
    await p.waitForFunction(() => !document.documentElement.dataset.i18n);
    await p.waitForTimeout(800);
    han = await p.evaluate(() => {
      const out = [], w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (/[㐀-鿿]/.test(n.nodeValue) && !n.parentElement.closest('script,style,code,textarea,[translate=no]')) out.push(n.nodeValue.trim());
      return out;
    });
  }
  console.log(name, wide ? 'SIDEWAYS SCROLL' : 'ok', errors.length ? `errors: ${errors.join(' | ')}` : '', han.length ? `\n  Chinese left: ${han.join(' | ')}` : '');
  await ctx.close();
}
await browser.close();
process.exit(0);
