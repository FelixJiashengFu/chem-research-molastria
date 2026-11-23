// node --test tools/particles-test.mjs
// GPU 粒子力场（/particles/）：验证五组 YAML 预设、localStorage 读写编码、外层页、导航/SEO/更新接入，以及精简 WebGPU 产物的完整性。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ROOT = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8');
const exists = (p) => fs.existsSync(new URL(p, ROOT));
const require = createRequire(import.meta.url);

function loadPresets() {
  const win = {};
  vm.runInNewContext(read('public/particles/particles-presets.js'), { window: win, globalThis: win });
  assert.ok(win.MOLASTRIA_PARTICLES, 'browser script global should expose window.MOLASTRIA_PARTICLES');
  return require('../public/particles/particles-presets.js');
}

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    dump() { return Object.fromEntries(map); },
  };
}

test('presets carry valid bilingual metadata and Particle HIVE YAML schemas', () => {
  const api = loadPresets();
  assert.ok(Array.isArray(api.PRESETS) && api.PRESETS.length === 5);

  const ids = new Set();
  const files = new Set();
  for (const p of api.PRESETS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    assert.ok(!files.has(p.filename), `duplicate filename ${p.filename}`);
    ids.add(p.id);
    files.add(p.filename);

    assert.match(p.filename, /^[a-z0-9-]+\.yml$/);
    assert.ok(p.nameZh && p.nameEn && p.tagZh && p.tagEn && p.summaryZh && p.summaryEn);
    assert.match(p.yaml, /^simulation:/m, `${p.id}: missing simulation section`);
    assert.match(p.yaml, /^particles:/m, `${p.id}: missing particles section`);
    assert.match(p.yaml, /^interactions:/m, `${p.id}: missing interactions section`);

    const countMatch = p.yaml.match(/\bcount:\s*(\d+)/);
    assert.ok(countMatch, `${p.id}: missing particle count`);
    const count = Number(countMatch[1]);
    assert.ok(count >= 64 && count % 64 === 0, `${p.id}: count ${count} should be a positive multiple of WORK_GROUP_SIZE (64)`);
  }
});

test('localStorage helpers encode KAML recentProjectPaths and apply/clear presets cleanly', () => {
  const api = loadPresets();
  assert.equal(api.encodeRecentProjectsYaml([]), '[]');
  assert.deepEqual(api.parseRecentProjectsYaml('[]'), []);
  assert.deepEqual(api.parseRecentProjectsYaml(null), []);

  const st = makeStorage();
  assert.equal(api.activePresetId(st), null);

  api.applyPresetToStorage(st, api.PRESETS[1]);
  assert.equal(api.activePresetId(st), api.PRESETS[1].id);
  assert.equal(st.getItem('paths/' + api.PRESETS[1].filename), api.PRESETS[1].yaml);
  assert.equal(st.getItem('recentProjectPaths'), `- "${api.PRESETS[1].filename}"`);

  api.applyPresetToStorage(st, api.PRESETS[0]);
  assert.equal(api.activePresetId(st), api.PRESETS[0].id);
  assert.deepEqual(
    api.parseRecentProjectsYaml(st.getItem('recentProjectPaths')),
    [api.PRESETS[0].filename, api.PRESETS[1].filename],
  );

  // Selecting an already-seen preset moves it to index 0 without duplicates.
  api.applyPresetToStorage(st, api.PRESETS[1]);
  assert.deepEqual(
    api.parseRecentProjectsYaml(st.getItem('recentProjectPaths')),
    [api.PRESETS[1].filename, api.PRESETS[0].filename],
  );

  api.clearRecentPreset(st);
  assert.equal(st.getItem('recentProjectPaths'), '[]');
  assert.equal(api.activePresetId(st), null);
});

test('outer /particles/ page follows MolAstria HTML/CSS/nav conventions', () => {
  const html = read('public/particles/index.html');
  assert.match(html, /data-section="particles"/);
  assert.match(html, /id="pt-bar"[^>]*translate="no"/);
  assert.match(html, /id="pt-summary"[^>]*translate="no"/);
  assert.match(html, /id="pt-drawer"[^>]*translate="no"/);
  assert.match(html, /id="particles-frame"[^>]*data-display-frame/);
  assert.match(html, /<script src="\.\.\/shared-nav\.js" defer><\/script>/);
  assert.match(html, /<script src="particles-presets\.js" defer><\/script>/);
  assert.match(html, /<script src="particles\.js" defer><\/script>/);

  const css = read('public/particles/particles.css');
  assert.doesNotMatch(css, /\b100dvh\b/, 'avoid 100dvh per CLAUDE.md zoom rule');

  const js = read('public/particles/particles.js');
  assert.doesNotMatch(js, /[↗→←↑↓]/, 'clickable UI buttons/links should use <i class="ico-ext"> instead of raw arrow glyphs');
  assert.match(js, /class="ico-ext"/);
});

test('vendored Particle HIVE build has required runtime assets, MIT license, and no source map', () => {
  for (const rel of [
    'public/particles/app/index.html',
    'public/particles/app/particles-demo.js',
    'public/particles/app/favicon.ico',
    'public/particles/app/assets/fonts/font-roboto-regular.png',
    'public/particles/app/assets/fonts/hack/font-hack-regular.png',
    'public/particles/app/assets/fonts/hack/font-hack-regular.json',
    'public/particles/app/LICENSE',
    'public/particles/app/NOTICE.txt',
    'public/particles/app/VERSION.txt',
  ]) {
    assert.ok(exists(rel), `missing vendored file: ${rel}`);
  }

  assert.ok(!exists('public/particles/app/particles-demo.js.map'), 'source map must not be vendored into public/particles/app');
  const appHtml = read('public/particles/app/index.html');
  assert.match(appHtml, /<meta name="robots" content="noindex">/);
  assert.match(appHtml, /navigator\.gpu/);
  assert.match(read('public/particles/app/LICENSE'), /MIT License[\s\S]*Danielle Voznyy/);
});

test('MolAstria navigation, updates feed, build-seo, CLAUDE.md, DECISIONS.md, and CI include /particles/', () => {
  assert.match(read('public/shared-nav.js'), /\['particles', 'particles\/index\.html'/);
  assert.match(read('public/updates/updates-data.js'), /id: 'particles'/);

  const seo = read('tools/build-seo.ts');
  assert.match(seo, /injectHead\("particles\/index\.html", "particles\/"/);
  assert.match(seo, /\["particles\/", "0\.8", "monthly"\]/);
  assert.match(seo, /path !== "particles\/app"/);

  assert.match(read('.github/workflows/pages.yml'), /node --test tools\/particles-test\.mjs/);
  assert.match(read('CLAUDE.md'), /particles\//);
  assert.match(read('docs/DECISIONS.md'), /Particle HIVE/);
});
