// 最近更新（public/updates/）：数据完整、中英齐全、地址和锚点都在、章数对得上源文件、shared-nav.js 的 UPDATES_LATEST 是最新一条；
// 纯逻辑（存档清洗、进度圈、新条目、自动弹出、日期分组）。
//   node --test tools/updates-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const C = require('../public/updates/updates-core.js');
const root = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(read('updates/updates-data.js'), ctx);
const { items } = ctx.window.MOLASTRIA_UPDATES;
const ui = read('updates/updates.js');
const ICONS = new Set([...ui.slice(ui.indexOf('const ICONS'), ui.indexOf('};', ui.indexOf('const ICONS'))).matchAll(/^\s+(\w+): '/gm)].map((m) => m[1]));
const CJK = /[一-鿿]/;

test('every item is complete and bilingual', () => {
  assert.ok(items.length >= 5);
  const ids = new Set();
  for (const x of items) {
    assert.ok(/^[a-z0-9-]+$/.test(x.id) && !ids.has(x.id), `id ${x.id}`);
    ids.add(x.id);
    assert.match(x.date, /^\d{4}-\d{2}-\d{2}$/, x.id);
    assert.ok(['find', 'learn', 'explore', 'models', 'make'].includes(x.group), `${x.id} group`);
    assert.ok(ICONS.has(x.icon), `${x.id} icon ${x.icon}`);
    assert.ok((CJK.test(x.zh) || x.zh === x.en) && x.en && !CJK.test(x.en), `${x.id} title`); // a proper name (NequIP) can be the same in both
    for (const k of ['note', 'more']) {
      assert.ok(Array.isArray(x[k]) && x[k].length === 2, `${x.id} ${k}`);
      assert.ok(CJK.test(x[k][0]), `${x.id} ${k} zh`);
      assert.ok(x[k][1].length > 10 && !/[一-鿿]{2}/.test(x[k][1]), `${x.id} ${k} en`);
    }
    assert.ok(x.more[0].length > x.note[0].length, `${x.id}: more says more than note`);
  }
});

test('newest first, and shared-nav.js knows the newest date', () => {
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].date >= items[i].date, `${items[i].id} out of order`);
  const nav = read('shared-nav.js');
  assert.equal(nav.match(/UPDATES_LATEST = '([\d-]+)'/)[1], C.latest(items));
});

test('every path exists, and anchors are on the page', () => {
  for (const x of items) {
    const [file, hash] = x.path.split('#');
    assert.ok(existsSync(new URL(file, root)), `${x.id}: ${file}`);
    if (hash && !hash.startsWith('c-')) assert.ok(read(file).includes(`id="${hash}"`), `${x.id}: #${hash}`);
  }
});

test('chapter counts and chapter ids match the module sources', () => {
  const SRC = { 'molastria-md': 'md', 'molastria-tensor': 'tensor', 'molastria-photochem': 'photochem', 'molastria-em': 'em', 'molastria-chemml': 'chemml', 'molastria-world': 'wm',
    'molastria-reaction': 'reaction', 'molastria-dft': 'dft', 'molastria-macro': 'macro', 'molastria-group': 'group', 'molastria-quasi': 'quasi', 'molastria-nequip': 'nequip', 'molastria-optics': 'optics' };
  for (const x of items.filter((y) => y.store)) {
    const dir = SRC[x.store];
    assert.ok(dir, `${x.id}: unknown store ${x.store}`);
    const files = readdirSync(new URL(`../tools/${dir}/ch/`, import.meta.url));
    const chIds = files.map((f) => readFileSync(new URL(`../tools/${dir}/ch/${f}`, import.meta.url), 'utf8').match(/id: '([^']+)'/)[1]);
    if (x.need) x.need.forEach((id) => assert.ok(chIds.includes(id), `${x.id}: chapter ${id}`));
    else assert.equal(x.chapters, chIds.length, `${x.id} chapters`);
    // the module reader really stores chapter ids under this key
    const reader = readdirSync(new URL(x.path.split('/')[0] + '/', root)).filter((f) => f.endsWith('.js'))
      .map((f) => read(`${x.path.split('/')[0]}/${f}`)).find((t) => t.includes(`'${x.store}'`));
    assert.ok(reader && /m\.seen = /.test(reader), `${x.id}: reader stores ${x.store}.seen`);
  }
});

test('migrate cleans bad saves', () => {
  assert.deepEqual(C.migrate(null), { v: 1, seen: '', pop: '', ack: [], p: [] });
  assert.deepEqual(C.migrate({ seen: 'x', pop: 5, ack: ['a', 'a', 3], p: 'no' }), { v: 1, seen: '', pop: '', ack: ['a'], p: [] });
  assert.equal(C.migrate({ p: Array.from({ length: 400 }, (_, i) => `p${i}`) }).p.length, C.KEEP);
});

test('normPath and visit agree with what shared-nav.js records', () => {
  assert.equal(C.normPath('index.html#hero-stage'), '');
  assert.equal(C.normPath('/open-models/sensetime/index.html?x=1'), 'open-models/sensetime/');
  assert.equal(C.normPath('spectra/index.html#sp-practice'), 'spectra/');
  let s = C.visit({}, 'dft/index.html');
  s = C.visit(s, 'dft/');
  assert.deepEqual(s.p, ['dft/']);
  const nav = read('shared-nav.js');
  assert.ok(nav.includes(".replace(/(^|\\/)index\\.html$/, '$1')"), 'shared-nav strips index.html the same way');
});

test('progress rings: chapters read, required chapters, or opened at all', () => {
  const dft = items.find((x) => x.id === 'dft'), rg = items.find((x) => x.id === 'macro-rg'), om = items.find((x) => x.id === 'om-sensetime');
  const store = { 'molastria-dft': { seen: ['why', 'hk', 'hk', 7] }, 'molastria-macro': { seen: ['thermo', 'critical'] } };
  const rs = (k) => store[k] || null;
  assert.deepEqual(C.progress(dft, {}, rs), { done: 2, total: 10, frac: 0.2, opened: true });
  assert.deepEqual(C.progress(rg, {}, rs), { done: 1, total: 1, frac: 1, opened: true });
  assert.equal(C.progress(om, {}, rs).frac, 0);
  assert.equal(C.progress(om, { p: ['open-models/sensetime/'] }, rs).frac, 1);
  assert.equal(C.progress(dft, {}, () => { throw new Error('bad json'); }).frac, 0);
  assert.equal(C.progress(dft, { p: ['dft/'] }, () => null).opened, true);
});

test('new items, mark all, the account dot and the once-per-release popup', () => {
  const rs = () => null;
  const n = items.length;
  assert.equal(C.newCount(items, {}, rs), n);
  const opened = { p: [C.normPath(items[0].path)] };
  assert.equal(C.newCount(items, opened, rs), n - 1);
  assert.equal(C.newCount(items, C.ackAll(items, {}), rs), 0);
  const top = C.latest(items);
  assert.equal(C.hasUnseen(items, {}), true);
  assert.equal(C.hasUnseen(items, C.markOpened(items, {})), false);
  assert.equal(C.shouldAutoOpen(items, {}, false), true);
  assert.equal(C.shouldAutoOpen(items, {}, true), false, 'never on a first visit');
  assert.equal(C.shouldAutoOpen(items, { pop: top }, false), false, 'once per release');
  assert.equal(C.shouldAutoOpen(items, { seen: top }, false), false, 'not after opening it yourself');
});

test('relative days and grouping by day', () => {
  const now = new Date(2026, 10, 18, 22).getTime();
  assert.deepEqual(C.relDay('2026-11-18', now), { zh: '今天', en: 'Today' });
  assert.deepEqual(C.relDay('2026-11-17', now), { zh: '昨天', en: 'Yesterday' });
  assert.deepEqual(C.relDay('2026-11-15', now), { zh: '3 天前', en: '3 days ago' });
  assert.deepEqual(C.relDay('2026-11-01', now), { zh: '11 月 1 日', en: 'Nov 1' });
  assert.deepEqual(C.relDay('2025-12-31', now), { zh: '2025 年 12 月 31 日', en: 'Dec 31, 2025' });
  assert.deepEqual(C.relDay('2026-11-20', now), { zh: '今天', en: 'Today' }, 'a release date ahead of a viewer’s clock reads as today');
  const g = C.byDay(items);
  assert.equal(g.reduce((a, d) => a + d.items.length, 0), items.length);
  assert.ok(g.every((d, i) => i === 0 || g[i - 1].date > d.date));
});
