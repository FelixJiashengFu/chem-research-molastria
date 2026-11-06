// Screenshots of the Meta page's online-model panel (light, dark, English, phone) against the local fake services.
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
for (const url of [SITE, `${API}/health`]) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok || url.includes('health')) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const shots = [
  ['online-light', { colorScheme: 'light' }, '', 'mace-mdp'],
  ['online-dark', { colorScheme: 'dark' }, '', 'allscaip-md-conserving-all-omol'],
  ['online-english', { colorScheme: 'light' }, '?lang=en', 'mace-mdp'],
  ['online-phone', { colorScheme: 'light', viewport: { width: 390, height: 844 }, isMobile: true }, '', 'mace-mdp'],
];
for (const [name, options, query, model] of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  await ctx.route('**/pay/config.js', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(/accountApi: '[^']*'/, `accountApi: '${API}'`) });
  });
  const p = await ctx.newPage();
  await p.goto(`${SITE}/meta/index.html${query}#uma`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !document.getElementById('u-online').hidden && /15/.test(document.getElementById('u-online-status').textContent), null, { timeout: 30000 });
  await p.selectOption('#u-online-model', model);
  if (model.startsWith('mace')) await p.check('#u-online-academic');
  await p.click('#u-online-run');
  await p.waitForSelector('#u-online-result .mx-res', { timeout: 15000 });
  await p.waitForTimeout(400);
  await p.locator('#u-online').screenshot({ path: join(OUT, `${name}.png`) });
  const wide = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(name, wide ? 'SIDEWAYS SCROLL' : 'ok');
  await ctx.close();
}
await browser.close();
process.exit(0);
