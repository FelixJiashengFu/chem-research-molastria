// 云同步的核心逻辑（public/sync/sync-core.js）：三方合并的各种情形，以及两三台设备对着一个假的账号服务来回同步。
//   node --test tools/sync-test.mjs
// 假服务照 deploy/account-worker.js 的 /sync 写：账号里递增的版本号、base 对不上就退回、空间满了放进 full。
// 真服务本身由 tools/account-test.ts 测。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../public/sync/sync-core.js');

// ── 三方合并 ──────────────────────────────────────────────────────────
test('merge3: only one side changed takes that side; both the same is fine', () => {
  assert.deepEqual(C.merge3([1], [1, 2], [1]), [1, 2]);
  assert.deepEqual(C.merge3([1], [1], [1, 3]), [1, 3]);
  assert.deepEqual(C.merge3([1], [1, 4], [1, 4]), [1, 4]);
  assert.equal(C.merge3({ a: 1 }, { a: 1 }, { a: 1 }).a, 1);
});

test('merge3: favourites as sets; a deletion on one side stays deleted, additions on both sides are kept', () => {
  // 手机删了 b，电脑加了 d：结果没有 b、有 d，不会“诈尸”
  assert.deepEqual(C.merge3(['a', 'b', 'c'], ['a', 'c'], ['a', 'b', 'c', 'd']), ['a', 'c', 'd']);
  assert.deepEqual(C.merge3([1, 2], [1, 2, 3], [1, 2, 4]), [1, 2, 3, 4]);
  // 两边都删了同一项
  assert.deepEqual(C.merge3([1, 2, 3], [1, 3, 5], [1, 3]), [1, 3, 5]);
  // 第一次同步（没有共同的底）：两边的都留下
  assert.deepEqual(C.merge3(undefined, [1, 2], [2, 3]), [1, 2, 3]);
});

test('merge3: objects merge field by field; a value changed differently on both sides keeps this device’s', () => {
  const base = { 'qp-1': true, 'qp-2': false, track: 'chem' };
  const local = { 'qp-1': true, 'qp-2': true, track: 'phys' };
  const remote = { 'qp-1': true, 'qp-2': false, 'qp-3': true, track: 'math' };
  assert.deepEqual(C.merge3(base, local, remote), { 'qp-1': true, 'qp-2': true, track: 'phys', 'qp-3': true });
  // 一边删了字段、另一边没动：删掉；一边删了、另一边改了：留下改过的
  assert.deepEqual(C.merge3({ a: 1, b: 2 }, { b: 2 }, { a: 1, b: 3 }), { b: 3 });
  assert.deepEqual(C.merge3({ a: 1 }, {}, { a: 9 }), { a: 9 });
});

test('merge3: arrays of records with ids merge by id, recursively (Study Desk sessions, own cards)', () => {
  const base = { sessions: [{ id: 's1', title: 'HF', steps: [1] }, { id: 's2', title: 'DFT' }], usage: { calls: 3 } };
  const laptop = { sessions: [{ id: 's1', title: 'HF', steps: [1, 2] }, { id: 's2', title: 'DFT' }, { id: 's3', title: 'CC' }], usage: { calls: 5 } };
  const phone = { sessions: [{ id: 's1', title: 'Hartree–Fock', steps: [1] }], usage: { calls: 3 } };
  assert.deepEqual(C.merge3(base, laptop, phone), {
    sessions: [{ id: 's1', title: 'Hartree–Fock', steps: [1, 2] }, { id: 's3', title: 'CC' }],
    usage: { calls: 5 }
  });
  // 一边删了一条，另一边改了这一条：留下改过的
  assert.deepEqual(C.merge3([{ id: 1, x: 1 }], [], [{ id: 1, x: 2 }]), [{ id: 1, x: 2 }]);
});

test('merge3: lists with repeated entries (a review log) keep both sides’ new entries', () => {
  const base = [{ c: 'a', r: 3 }, { c: 'a', r: 3 }];
  assert.deepEqual(C.merge3(base, [...base, { c: 'b', r: 1 }], [...base, { c: 'c', r: 4 }]), [...base, { c: 'b', r: 1 }, { c: 'c', r: 4 }]);
});

test('mergeText: raw localStorage text, missing values, text that is not JSON', () => {
  assert.equal(C.mergeText(null, '["a"]', null), '["a"]');
  assert.equal(C.mergeText('["a"]', null, '["a"]'), null, 'deleted here, untouched there');
  assert.equal(C.mergeText('["a"]', '["a","b"]', '["a","c"]'), '["a","b","c"]');
  assert.equal(C.mergeText('x', 'not json', 'also not'), 'not json', 'not JSON: this device wins');
  // the same content written with keys in another order is not a change worth rewriting
  assert.equal(C.mergeText('{"a":1}', '{"a":1,"b":2}', '{"b":2,"a":1}'), '{"a":1,"b":2}');
});

test('pageUses: which pages hold which record in memory', () => {
  const k = (key) => C.KEYS.find((e) => e.key === key);
  assert.ok(C.pageUses(k('chemresearch-saved'), '/'));
  assert.ok(C.pageUses(k('chemresearch-saved'), '/index.html'));
  assert.ok(!C.pageUses(k('chemresearch-saved'), '/learn/'));
  assert.ok(C.pageUses(k('molastria-learn'), '/review/index.html'));
  assert.ok(C.pageUses(k('molastria-qp-quiz'), '/quantum/physics/'));
  assert.ok(!C.pageUses(k('molastria-qp-quiz'), '/quantum/'));
});

test('the synced records are learning records and favourites only: no session, key or chat history', () => {
  for (const k of C.KEY_NAMES) {
    assert.match(k, C.KEY_RE);
    assert.ok(!/session|account|key$|-ai|token|history/.test(k), k);
  }
  assert.equal(new Set(C.KEY_NAMES).size, C.KEY_NAMES.length);
});

// ── 假的账号服务和设备 ─────────────────────────────────────────────────
function fakeServer({ limit = 1 << 20 } = {}) {
  const rows = new Map(); // key -> { v, body }
  const state = () => {
    const list = [...rows.entries()];
    return {
      versions: Object.fromEntries(list.map(([k, r]) => [k, r.v])),
      used: list.reduce((n, [, r]) => n + C.bytes(r.body), 0),
      cursor: list.reduce((n, [, r]) => Math.max(n, r.v), 0),
      limit, pro: false
    };
  };
  const server = {
    rows, calls: 0,
    wipe() { rows.clear(); },
    async call(method, arg) {
      server.calls++;
      const st = state();
      if (method === 'GET') {
        const from = arg.since > st.cursor ? 0 : arg.since;
        return { ...st, reset: arg.since > st.cursor, items: [...rows.entries()].filter(([, r]) => r.v > from).map(([key, r]) => ({ key, v: r.v, body: r.body })) };
      }
      const saved = {}, conflicts = [], full = [];
      for (const it of arg.items) {
        const cur = rows.get(it.key);
        if ((cur?.v || 0) !== it.base) { conflicts.push(cur ? { key: it.key, v: cur.v, body: cur.body } : { key: it.key, v: 0, body: null }); continue; }
        const others = [...rows.entries()].filter(([k]) => k !== it.key).reduce((n, [, r]) => n + C.bytes(r.body), 0);
        if (others + C.bytes(it.body) > limit) { full.push(it.key); continue; }
        const v = Math.max(0, ...[...rows.values()].map((r) => r.v)) + 1;
        rows.set(it.key, { v, body: it.body });
        saved[it.key] = v;
      }
      return { saved, conflicts, full, ...state() };
    }
  };
  return server;
}
function device(server, { email = 'me@example.com', path = '/learn/', slim = false } = {}) {
  const ls = new Map();
  const d = {
    ls,
    get: (k) => (ls.has(k) ? ls.get(k) : null),
    set: (k, v) => (v == null ? ls.delete(k) : ls.set(k, v)),
    read: (k) => JSON.parse(ls.get(k) ?? 'null'),
    write: (k, v) => ls.set(k, JSON.stringify(v)),
    loads: {}, // what "the page" read when it opened
    touched: [],
    open() { d.loads = Object.fromEntries(C.KEY_NAMES.map((k) => [k, d.get(k)])); d.under = new Set(); },
    under: new Set(),
    sync: (extra = {}) => C.syncOnce({
      email, slim,
      get: d.get, set: d.set,
      loadState: () => JSON.parse(ls.get('molastria-sync-state') ?? 'null'),
      saveState: (s) => ls.set('molastria-sync-state', JSON.stringify(s)),
      call: (m, a) => server.call(m, a),
      // same rule as sync.js: once sync wrote under a page that holds the record, merge the page's writes against what it loaded
      pageBase: (k) => (d.under.has(k) && C.pageUses(C.KEYS.find((e) => e.key === k), path) ? d.loads[k] : undefined),
      touched: (k) => { d.touched.push(k); d.under.add(k); },
      ...extra
    })
  };
  d.open();
  return d;
}

test('two devices: favourites added on one appear on the other; removing one on the phone removes it on the laptop', async () => {
  const s = fakeServer();
  const laptop = device(s, { path: '/' }), phone = device(s, { path: '/' });
  laptop.write('chemresearch-saved', ['pyscf', 'orca']);
  let r = await laptop.sync();
  assert.deepEqual(r.pushed, ['chemresearch-saved']);
  r = await phone.sync();
  assert.deepEqual(r.pulled, ['chemresearch-saved']);
  assert.deepEqual(phone.read('chemresearch-saved'), ['pyscf', 'orca']);
  assert.deepEqual(phone.touched, ['chemresearch-saved'], 'the open page is told to reload');
  phone.open(); // reloaded
  // phone removes orca, laptop adds cp2k, neither has synced
  phone.write('chemresearch-saved', ['pyscf']);
  laptop.write('chemresearch-saved', ['pyscf', 'orca', 'cp2k']);
  await phone.sync();
  await laptop.sync();
  await phone.sync();
  assert.deepEqual(laptop.read('chemresearch-saved'), ['pyscf', 'cp2k'], 'orca stays removed, cp2k arrives');
  assert.deepEqual(phone.read('chemresearch-saved'), ['pyscf', 'cp2k']);
  // nothing changed: a round only reads
  const before = s.calls;
  const quiet = await laptop.sync();
  assert.deepEqual([quiet.pulled, quiet.pushed, s.calls - before], [[], [], 1]);
});

test('two devices writing at the same moment: the second write is returned as a conflict, merged and sent again', async () => {
  const s = fakeServer();
  const a = device(s), b = device(s);
  a.write('molastria-qp-progress', { c1: true });
  await a.sync();
  await b.sync();
  a.write('molastria-qp-progress', { c1: true, c2: true });
  b.write('molastria-qp-progress', { c1: true, c3: true });
  // b reads the cloud, then a pushes before b does
  const realCall = s.call;
  let once = false;
  s.call = async (m, arg) => {
    if (m === 'POST' && !once) { once = true; await a.sync(); }
    return realCall(m, arg);
  };
  await b.sync();
  s.call = realCall;
  await a.sync();
  assert.deepEqual(a.read('molastria-qp-progress'), { c1: true, c2: true, c3: true });
  assert.deepEqual(b.read('molastria-qp-progress'), { c1: true, c2: true, c3: true });
});

test('first sync on a new device with its own data: nothing is lost on either side', async () => {
  const s = fakeServer();
  const a = device(s), b = device(s);
  a.write('molastria-fm-progress', { linalg: true });
  a.write('molastria-play', { tunnel: 3 });
  await a.sync();
  b.write('molastria-fm-progress', { calculus: true });
  await b.sync();
  await a.sync();
  assert.deepEqual(a.read('molastria-fm-progress'), { linalg: true, calculus: true });
  assert.deepEqual(b.read('molastria-fm-progress'), { linalg: true, calculus: true });
  assert.deepEqual(b.read('molastria-play'), { tunnel: 3 });
});

test('a page that still holds old data in memory: its next save does not undo what came from the other device', async () => {
  const s = fakeServer();
  const laptop = device(s, { path: '/review/' }), phone = device(s, { path: '/review/' });
  laptop.write('molastria-review', { mine: [{ id: 'm1', front: 'HF' }] });
  await laptop.sync();
  await phone.sync();
  phone.open();
  // the review page is open on the laptop and holds { mine: [m1] }; the phone adds m2
  laptop.open();
  const held = laptop.read('molastria-review');
  phone.write('molastria-review', { mine: [{ id: 'm1', front: 'HF' }, { id: 'm2', front: 'DFT' }] });
  await phone.sync();
  await laptop.sync();
  assert.deepEqual(laptop.touched, ['molastria-review'], 'the page is told to reload');
  // the page saves its in-memory copy plus a new card, without having reloaded
  laptop.write('molastria-review', { mine: [...held.mine, { id: 'm3', front: 'CC' }] });
  await laptop.sync();
  await phone.sync();
  const ids = (d) => d.read('molastria-review').mine.map((c) => c.id);
  assert.deepEqual(ids(laptop), ['m1', 'm3', 'm2']);
  assert.deepEqual(ids(phone), ['m1', 'm3', 'm2']);
  // and once the laptop page is reloaded it merges normally again: a deletion on the phone sticks
  laptop.open();
  phone.open();
  phone.write('molastria-review', { mine: phone.read('molastria-review').mine.filter((c) => c.id !== 'm3') });
  await phone.sync();
  await laptop.sync();
  assert.deepEqual(ids(laptop), ['m1', 'm2']);
});

test('a record cleared on one device is cleared on the other; a stored empty text reads as "none"', async () => {
  const s = fakeServer();
  const a = device(s), b = device(s);
  a.write('molastria-learn', { v: 1, sessions: [{ id: 's1' }] });
  await a.sync();
  await b.sync();
  a.set('molastria-learn', null);
  await a.sync();
  assert.equal(s.rows.get('molastria-learn').body, '');
  await b.sync();
  assert.equal(b.get('molastria-learn'), null);
});

test('the cloud copy deleted elsewhere: this device keeps its data and starts over instead of erasing it', async () => {
  const s = fakeServer();
  const a = device(s);
  a.write('molastria-qa-progress', { grover: true });
  await a.sync();
  s.wipe();
  const r = await a.sync();
  assert.deepEqual(a.read('molastria-qa-progress'), { grover: true });
  assert.deepEqual(r.pushed, ['molastria-qa-progress']);
});

test('another account on the same browser starts from nothing and does not inherit the first account’s state', async () => {
  const s1 = fakeServer(), s2 = fakeServer();
  const a = device(s1);
  a.write('molastria-play', { tunnel: 3 });
  await a.sync();
  const r = await C.syncOnce({
    email: 'other@example.com', get: a.get, set: a.set,
    loadState: () => JSON.parse(a.ls.get('molastria-sync-state')), saveState: (st) => a.ls.set('molastria-sync-state', JSON.stringify(st)),
    call: (m, arg) => s2.call(m, arg)
  });
  assert.deepEqual(r.pushed, ['molastria-play'], 'treated as a first sync for the new account');
  assert.equal(JSON.parse(a.ls.get('molastria-sync-state')).email, 'other@example.com');
});

test('a full cloud space: the record is reported, nothing is lost locally, the rest still syncs', async () => {
  const s = fakeServer({ limit: 200 });
  const a = device(s);
  a.write('molastria-learn', { notes: 'x'.repeat(500) });
  a.write('molastria-play', { tunnel: 1 });
  const r = await a.sync();
  assert.deepEqual([r.full, r.pushed], [['molastria-learn'], ['molastria-play']]);
  assert.equal(a.read('molastria-learn').notes.length, 500);
  // and it is tried again next time, not forgotten
  const again = await a.sync();
  assert.deepEqual(again.full, ['molastria-learn']);
});

test('slim shadows (only a hash kept): changes are still detected and pushed, merges fall back to keeping both sides', async () => {
  const s = fakeServer();
  const a = device(s, { slim: true }), b = device(s);
  a.write('chemdb-atlas-saved', [1, 2]);
  await a.sync();
  assert.ok(!JSON.parse(a.ls.get('molastria-sync-state')).keys['chemdb-atlas-saved'].s, 'no copy of the text');
  await b.sync();
  b.write('chemdb-atlas-saved', [1, 2, 3]);
  await b.sync();
  a.write('chemdb-atlas-saved', [1, 2, 4]);
  await a.sync();
  await b.sync();
  assert.deepEqual(a.read('chemdb-atlas-saved'), [1, 2, 4, 3]);
  assert.deepEqual(b.read('chemdb-atlas-saved'), [1, 2, 4, 3]);
});

test('three devices in turn converge', async () => {
  const s = fakeServer();
  const ds = [device(s), device(s), device(s)];
  for (let i = 0; i < 9; i++) {
    const d = ds[i % 3];
    const cur = d.read('molastria-fm-quiz') || {};
    cur[`q${i}`] = i;
    d.write('molastria-fm-quiz', cur);
    await d.sync();
  }
  for (const d of ds) await d.sync();
  const want = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`q${i}`, i]));
  for (const d of ds) assert.deepEqual(d.read('molastria-fm-quiz'), want);
});
