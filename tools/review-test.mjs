// 复习卡片（public/review/review-core.js）：存档清洗、三个卡组、到期队列、每天新卡上限、简化调度、Anki 导出。
//   node --test tools/review-test.mjs
// ts-fsrs 本身不在这里测（它从 CDN 载入，有自己的测试）；这里用 simpleScheduler 和一个记录调用的假调度器。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const R = require('../public/review/review-core.js');
const MIN = 60000, DAY = 86400000;
const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);

/** search-terms.js 是浏览器脚本（挂在 window 上），放进一个沙箱里读出术语组。 */
function termGroups() {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../public/search-terms.js', import.meta.url), 'utf8'), ctx);
  return ctx.window.MolAstriaTerms.groups;
}

test('migrate: anything stored becomes a valid state, bad parts dropped', () => {
  for (const raw of [null, undefined, 42, 'not json', '[]', [], { sched: 'x' }]) assert.deepEqual(R.migrate(raw), R.emptyState());
  const st = R.migrate(JSON.stringify({
    decks: { terms: false, learn: 'yes', extra: true }, dir: 'en-zh', newPerDay: 500,
    sched: { 'terms:abc': { due: NOW, reps: 2, state: 2, stability: 3.1, last_review: NOW - DAY }, 'bogus:1': { due: NOW }, 'mine:x': { due: 'soon' }, '__proto__': { due: 1 } },
    mine: [{ id: 'a', front: ' Q ', back: 'A', tags: ['two words', 3] }, { id: 'a', front: 'dup', back: 'dup' }, { id: 'b', front: '', back: 'A' }, { id: 'c<script>', front: 'F', back: 'B' }],
    log: [{ id: 'terms:abc', at: NOW, r: 3 }, { id: 'terms:abc', at: NOW, r: 9 }, { id: 'x', at: NOW, r: 1 }],
    newDay: { day: '2026-11-10', n: 4.4 }
  }));
  assert.deepEqual(st.decks, { terms: false, learn: true, mine: true });
  assert.equal(st.dir, 'en-zh');
  assert.equal(st.newPerDay, 15, 'out-of-range limit falls back');
  assert.deepEqual(Object.keys(st.sched), ['terms:abc']);
  assert.equal(st.sched['terms:abc'].last_review, NOW - DAY);
  assert.deepEqual(st.mine.map((m) => [m.id, m.front, m.tags]), [['a', 'Q', ['two_words']], ['cscript', 'F', []]]);
  assert.deepEqual(st.log, [{ id: 'terms:abc', at: NOW, r: 3 }]);
  assert.deepEqual(st.newDay, { day: '2026-11-10', n: 4 });
});

test('term deck: every group of the search glossary becomes one card with a stable id', () => {
  const groups = termGroups();
  const cards = R.termCards(groups);
  assert.equal(cards.length, groups.length, 'every glossary group has Chinese and English');
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length, 'ids are unique');
  const dft = cards.find((c) => c.zh === '密度泛函');
  assert.equal(dft.front, '密度泛函');
  assert.equal(dft.back, 'density functional', 'the longest English spelling is the answer');
  assert.deepEqual([...dft.enAlt], ['dft']);
  const back = R.termCards(groups, 'en-zh').find((c) => c.zh === '密度泛函');
  assert.equal(back.id, dft.id, 'direction does not change the id, so progress is shared');
  assert.equal(back.front, 'density functional');
  assert.equal(back.back, '密度泛函');
  assert.equal(R.termCards([['只有中文'], ['english only'], 'junk']).length, 0);
});

/** 研习台存档的样子（与 learn-core.js 的 migrate 输出一致的字段）。 */
const LEARN = {
  sessions: [{ id: 's1', title: '谐振子' }, { id: 's2', title: '' , goal: '学会变分法' }],
  props: [
    { id: 'p1', text: '谐振子的能级等间距', sessionIds: ['s1'] },
    { id: 'p2', text: '升降算符满足 [a, a†] = 1', sessionIds: ['s1', 'nope'] },
    { id: 'p3', text: '基态能量是 ħω/2', sessionIds: ['s2'] },
    { id: 'p1', text: 'duplicate', sessionIds: [] },
    { id: '', text: 'no id' }
  ],
  chains: [
    { id: 'c1', premises: ['p2', 'p1', 'missing'], conclusion: 'p3' },
    { id: 'c2', premises: ['p3'], conclusion: 'p3' },
    { id: 'c3', premises: ['p1'], conclusion: 'missing' }
  ]
};

test('Study Desk deck: chains become “what follows?” cards, propositions become “explain” cards; read-only', () => {
  const before = JSON.stringify(LEARN);
  const cards = R.learnCards(JSON.stringify(LEARN));
  assert.equal(JSON.stringify(LEARN), before);
  const chains = cards.filter((c) => c.kind === 'chain'), props = cards.filter((c) => c.kind === 'prop');
  assert.equal(chains.length, 1, 'chains with no premise left or a missing conclusion are dropped');
  assert.deepEqual(chains[0].premises, ['升降算符满足 [a, a†] = 1', '谐振子的能级等间距']);
  assert.equal(chains[0].back, '基态能量是 ħω/2');
  assert.deepEqual(chains[0].sessions, ['学会变分法'], 'a session without a title uses its goal');
  assert.deepEqual(props.map((p) => p.id), ['learn:p-p1', 'learn:p-p2', 'learn:p-p3']);
  assert.deepEqual(props[1].sessions, ['谐振子'], 'unknown sessions are left out');
  for (const raw of [null, '', '{', { props: 'x' }]) assert.deepEqual(R.learnCards(raw), []);
});

test('own cards: add, refuse incomplete ones, remove with their schedule', () => {
  const st = R.emptyState();
  const id = R.addMine(st, { front: '薛定谔方程', back: 'iħ∂ψ/∂t = Ĥψ', tags: ['量子 物理'] }, { now: NOW, id: 'k1' });
  assert.equal(id, 'mine:k1');
  assert.equal(R.addMine(st, { front: 'x', back: '' }), '');
  assert.equal(R.addMine(st, { front: 'x', back: 'y' }, { id: 'k1' }), '', 'duplicate id refused');
  st.sched[id] = { due: NOW };
  assert.deepEqual(R.mineCards(st).map((c) => [c.id, c.tags]), [['mine:k1', ['量子_物理']]]);
  assert.equal(R.removeMine(st, id), true);
  assert.equal(st.mine.length, 0);
  assert.equal(st.sched[id], undefined);
});

test('queue: due cards first by due time, then new cards up to the daily limit, own cards first', () => {
  const st = R.emptyState();
  st.newPerDay = 2;
  const cards = [
    { id: 'terms:t1', deck: 'terms' }, { id: 'terms:t2', deck: 'terms' }, { id: 'terms:t3', deck: 'terms' },
    { id: 'learn:p-a', deck: 'learn' }, { id: 'mine:m1', deck: 'mine' }
  ];
  st.sched['terms:t2'] = { ...R.simpleScheduler.empty(NOW), due: NOW - DAY };
  st.sched['terms:t3'] = { ...R.simpleScheduler.empty(NOW), due: NOW - MIN };
  st.sched['learn:p-a'] = { ...R.simpleScheduler.empty(NOW), due: NOW + 3 * DAY };
  let q = R.buildQueue(st, cards, NOW, 0);
  assert.deepEqual(q.queue.map((c) => c.id), ['terms:t2', 'terms:t3', 'mine:m1', 'terms:t1']);
  assert.equal(q.due, 2); assert.equal(q.fresh, 2); assert.equal(q.newLeft, 2); assert.equal(q.next, NOW + 3 * DAY); assert.equal(q.total, 5);
  st.newDay = { day: '2026-11-10', n: 1 };
  q = R.buildQueue(st, cards, NOW, 0);
  assert.deepEqual(q.queue.map((c) => c.id), ['terms:t2', 'terms:t3', 'mine:m1'], 'one new card left today');
  st.newDay = { day: '2026-11-09', n: 9 };
  assert.equal(R.buildQueue(st, cards, NOW, 0).newLeft, 2, 'yesterday’s count does not carry over');
  st.decks.terms = false;
  q = R.buildQueue(st, cards, NOW, 0);
  assert.deepEqual(q.queue.map((c) => c.id), ['mine:m1']);
  assert.deepEqual(R.deckStats(st, cards, NOW), { terms: { total: 3, fresh: 1, due: 2 }, learn: { total: 1, fresh: 0, due: 0 }, mine: { total: 1, fresh: 1, due: 0 } });
});

test('record: uses the scheduler, counts new cards per local day, keeps the log short', () => {
  const st = R.emptyState();
  const calls = [];
  const fake = {
    empty: (now) => ({ ...R.simpleScheduler.empty(now), marker: 'empty' }),
    next: (card, now, rating) => { calls.push([card.marker || 'stored', rating]); return { ...card, due: new Date(now + rating * DAY), last_review: new Date(now), reps: card.reps + 1, state: 2 }; }
  };
  const s1 = R.record(st, 'terms:x', 3, NOW, fake, 0);
  assert.equal(s1.due, NOW + 3 * DAY, 'Date objects from ts-fsrs are stored as milliseconds');
  assert.equal(s1.last_review, NOW);
  assert.equal(s1.marker, undefined, 'only schedule fields are stored');
  R.record(st, 'terms:x', 1, NOW + 3 * DAY, fake, 0);
  assert.deepEqual(calls, [['empty', 3], ['stored', 1]]);
  assert.deepEqual(st.newDay, { day: '2026-11-10', n: 1 }, 'a second review of the same card is not a new card');
  // 时区：UTC 23:30 在东八区已经是第二天
  R.record(st, 'terms:y', 3, Date.UTC(2026, 10, 10, 23, 30), fake, -480);
  assert.deepEqual(st.newDay, { day: '2026-11-11', n: 1 });
  assert.throws(() => R.record(st, 'nope', 3, NOW, fake));
  assert.throws(() => R.record(st, 'terms:x', 5, NOW, fake));
  for (let i = 0; i < R.MAX_LOG + 20; i++) R.record(st, 'terms:x', 3, NOW + i, fake, 0);
  assert.equal(st.log.length, R.MAX_LOG);
});

test('simple scheduler: again in 10 minutes, then growing intervals; a lapse is counted', () => {
  const S = R.simpleScheduler;
  let c = S.empty(NOW);
  const p = S.preview(c, NOW);
  assert.deepEqual([1, 2, 3, 4].map((r) => (p[r].due - NOW) / MIN), [10, 1440, 1440, 4 * 1440]);
  c = S.next(c, NOW, 3);
  assert.equal(c.scheduled_days, 1);
  c = S.next(c, NOW + DAY, 3);
  assert.equal(c.scheduled_days, 3, '1 day × 2.5 rounds to 3');
  c = S.next(c, NOW + 4 * DAY, 4);
  assert.equal(c.scheduled_days, 11, '3 × 3.5 = 10.5 rounds to 11');
  c = S.next(c, NOW + 15 * DAY, 1);
  assert.equal(c.lapses, 1); assert.equal(c.due, NOW + 15 * DAY + 10 * MIN); assert.equal(c.reps, 4);
});

test('interval labels', () => {
  assert.deepEqual(R.interval(10 * MIN), [10, 'min']);
  assert.deepEqual(R.interval(5 * 3600000), [5, 'h']);
  assert.deepEqual(R.interval(3 * DAY), [3, 'd']);
  assert.deepEqual(R.interval(90 * DAY), [3, 'mo']);
  assert.deepEqual(R.interval(800 * DAY), [2.2, 'y']);
  assert.deepEqual(R.interval(0), [1, 'min']);
});

test('Anki export: file headers, one note per line, HTML-escaped fields and tags', () => {
  const cards = [
    { id: 'mine:a', deck: 'mine', kind: 'mine', front: 'a < b & "c"', back: 'line 1\nline\t2', tags: ['QM'] },
    { id: 'learn:c-1', deck: 'learn', kind: 'chain', premises: ['P1', 'P2'], back: 'C' },
    ...R.termCards([['密度泛函', 'dft', 'density functional']])
  ];
  const txt = R.ankiText(cards, { deck: 'MolAstria\tbad' });
  const lines = txt.trimEnd().split('\n');
  assert.deepEqual(lines.slice(0, 5), ['#separator:Tab', '#html:true', '#notetype:Basic', '#deck:MolAstria bad', '#tags column:3']);
  assert.equal(lines.length, 5 + cards.length, 'newlines inside fields never break a note');
  for (const l of lines.slice(5)) assert.equal(l.split('\t').length, 3);
  assert.equal(lines[5], 'a &lt; b &amp; &quot;c&quot;\tline 1<br>line 2\tMolAstria MolAstria::mine QM');
  assert.equal(lines[6], '由这些推出什么？<br>· P1<br>· P2\tC\tMolAstria MolAstria::learn');
  assert.equal(lines[7], '密度泛函\tdensity functional<br>也写作：dft\tMolAstria MolAstria::terms');
  const en = R.ankiText(cards.slice(1, 2), { t: (s) => (s === '由这些推出什么？' ? 'What follows from these?' : s) });
  assert.match(en, /What follows from these\?<br>· P1/);
});
