// The discussion rooms' daily problem (public/chat/daily-core.js): Beijing-time days, the shuffled cycle with no
// repeats, the real question pools from the Quantum Physics and Mathematics sections, the room draft.
//   node --test tools/chat-daily-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const D = require('../public/chat/daily-core.js');
const load = (file, name) => { const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8'), ctx); return ctx.window[name]; };
const data = { qp: load('quantum/physics/qp-quiz.js', 'MOLASTRIA_QP_QUIZ'), fm: load('fundamental-science/math/fm-quiz.js', 'MOLASTRIA_FM_QUIZ') };
const math = { qp: load('quantum/physics/qp-quiz-math.js', 'MOLASTRIA_QP_QUIZ_MATH'), fm: load('fundamental-science/math/fm-quiz-math.js', 'MOLASTRIA_FM_QUIZ_MATH') };

test('a day runs from midnight to midnight Beijing time', () => {
  assert.equal(D.dayKey(Date.parse('2026-11-12T15:59:59Z')), '2026-11-12');
  assert.equal(D.dayKey(Date.parse('2026-11-12T16:00:00Z')), '2026-11-13');
  assert.equal(D.dayKey(Date.parse('2026-11-11T16:00:00Z')), '2026-11-12');
  assert.equal(D.msToNext(Date.parse('2026-11-12T15:59:59Z')), 1000);
  assert.equal(D.msToNext(Date.parse('2026-11-12T16:00:00Z')), 86400000);
  assert.equal(D.dayNumber('2026-11-13') - D.dayNumber('2026-11-12'), 1);
  assert.equal(D.dayNumber('1970-01-01'), 0);
  assert.ok(Number.isNaN(D.dayNumber('nonsense')));
});

test('the pool is every formula question of both sections, each with a question, an answer and its formulas', () => {
  const pool = D.pool(data);
  const want = Object.values(data.qp.items).flat().length + Object.values(data.fm.items).flat().length;
  assert.equal(pool.length, want);
  assert.ok(pool.length >= 40, `${pool.length} problems`);
  assert.equal(new Set(pool.map((e) => `${e.set}:${e.item.id}`)).size, pool.length, 'ids are unique');
  for (const e of pool) {
    assert.ok(e.item.q.zh && e.item.q.en && e.item.answer, e.item.id);
    if (e.item.tex) assert.ok(math[e.set][e.item.id], `${e.item.id}: the question's formula has MathML`);
    assert.ok(D.SETS[e.set].href(e.chapter).endsWith(e.set === 'qp' ? `#c-${e.chapter}` : `#m-${e.chapter}`));
  }
});

test('everyone gets the same problem on a day, and none repeats until all have come round', () => {
  const pool = D.pool(data), start = D.dayNumber('2026-11-12');
  const keyOf = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  const seen = new Set();
  for (let d = start; d < start + pool.length; d++) {
    const e = D.pick(pool, keyOf(d));
    assert.equal(e.key, keyOf(d)); assert.equal(e.n, pool.length);
    assert.deepEqual(D.pick(pool, keyOf(d)).item.id, e.item.id, 'deterministic');
    seen.add(`${e.set}:${e.item.id}`);
  }
  assert.equal(seen.size, pool.length, 'a full cycle without repeats');
  assert.equal(D.pick(pool, keyOf(start + pool.length)).item.id, D.pick(pool, keyOf(start)).item.id, 'then it starts over');
  const perm = D.order(pool.length);
  assert.deepEqual([...perm].sort((a, b) => a - b), pool.map((_, i) => i));
  assert.notDeepEqual(perm, pool.map((_, i) => i), 'actually shuffled, so the two sections alternate');
  assert.equal(D.pick([], '2026-11-12'), null);
});

test('the room draft names the day and the question but never the answer, and the room exists', () => {
  const pool = D.pool(data);
  for (const e of pool.map((x) => ({ ...x, key: '2026-11-12' }))) {
    const zh = D.draft(e), en = D.draft(e, true);
    assert.match(zh, /^【每日一题 11-12】/); assert.match(zh, /\n我的思路：$/);
    assert.match(en, /^\[Daily problem 11\/12\] /); assert.match(en, /\nMy approach: $/);
    assert.ok(zh.length <= 2000 && zh.length < 200, 'well under the 2000-character limit');
    // nothing but the header, the question (maybe cut short) and the prompt line: so no answer, no hint, no steps
    const middle = zh.replace(/^【每日一题 11-12】/, '').replace(/\n我的思路：$/, ''), q = e.item.q.zh.replace(/\s+/g, ' ').trim();
    assert.ok(middle === q || (middle.endsWith('…') && q.startsWith(middle.slice(0, -1))), `${e.item.id}: only the question`);
  }
  assert.match(readFileSync(new URL('../deploy/chat.js', import.meta.url), 'utf8'), new RegExp(`\\['${D.ROOM}', '学习与课程'`), 'the study room is an official room');
});
