// 我的学习（public/me/me-core.js）：存档清洗、记一次、推出来的日子、连续天数、本周、热力图、各栏目汇总和总数。
//   node --test tools/me-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const M = require('../public/me/me-core.js');
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 12, 15); // 周四
const load = (file, name) => { const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8'), ctx); return ctx.window[name]; };

test('dayKey and addDays use local dates, across month and DST edges', () => {
  assert.equal(M.dayKey(at(2026, 11, 12, 0)), '2026-11-12');
  assert.equal(M.dayKey(at(2026, 11, 12, 23)), '2026-11-12');
  assert.equal(M.addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(M.addDays('2026-03-07', 2), '2026-03-09');
  assert.equal(M.addDays('2026-12-31', 1), '2027-01-01');
});

test('migrate: junk becomes an empty state; bad days, kinds and goals are dropped', () => {
  for (const raw of [null, undefined, 3, 'nope', '[]', [], { days: [] }]) assert.deepEqual(M.migrate(raw, NOW), M.emptyState());
  const st = M.migrate({ goal: 9, days: {
    '2026-11-12': { n: 2, k: { quiz: 1, review: 1, hack: 5 } },
    '2026-11-11': { n: 0, k: { play: 3.7 } },
    '2026-11-10': { n: 0, k: {} },
    'yesterday': { n: 4 },
    '2024-01-01': { n: 5, k: { quiz: 5 } },
    '__proto__': { n: 1 }
  } }, NOW);
  assert.equal(st.goal, 4);
  assert.deepEqual(Object.keys(st.days).sort(), ['2026-11-11', '2026-11-12']);
  assert.deepEqual(st.days['2026-11-12'], { n: 2, k: { quiz: 1, review: 1 } });
  assert.deepEqual(st.days['2026-11-11'], { n: 3, k: { play: 3 } }, 'n is at least the sum of kinds');
  assert.equal(M.migrate(JSON.stringify({ goal: 6 }), NOW).goal, 6);
});

test('record bumps today, maps unknown kinds to other, and prunes old days', () => {
  const st = M.migrate({ days: { '2025-01-01': { n: 1, k: { quiz: 1 } } } }, at(2025, 1, 2));
  M.record(st, 'quiz', NOW); M.record(st, 'quiz', NOW); M.record(st, 'weird', NOW);
  assert.deepEqual(st.days['2026-11-12'], { n: 3, k: { quiz: 2, other: 1 } });
  assert.ok(!st.days['2025-01-01'], 'older than KEEP_DAYS is gone');
  // the copy in shared-nav.js keeps the same shape: run it in a sandbox and compare
  const src = readFileSync(new URL('../public/shared-nav.js', import.meta.url), 'utf8');
  const start = src.indexOf('if (!window.MolAstriaActivity) {'), end = src.indexOf('\n  }\n', start) + 4;
  const store = new Map([['molastria-me', JSON.stringify({ v: 1, days: { '2020-01-01': { n: 1, k: {} } }, goal: 5 })]]);
  const win = { dispatchEvent() {} };
  vm.runInNewContext(src.slice(start, end), { window: win, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o.detail; } }, JSON, Math, Number, String, Date, Object, Array });
  win.MolAstriaActivity('review'); win.MolAstriaActivity('nonsense');
  const saved = JSON.parse(store.get('molastria-me'));
  const today = M.dayKey(Date.now());
  assert.deepEqual(saved.days[today], { n: 2, k: { review: 1, other: 1 } });
  assert.ok(!saved.days['2020-01-01']);
  assert.equal(saved.goal, 5);
  assert.deepEqual(M.migrate(saved).days[today], saved.days[today], 'shared-nav output survives migrate');
});

test('derivedDays reads review logs and study sessions; dayCounts takes the larger count', () => {
  const review = { log: [{ at: at(2026, 11, 10, 9) }, { at: at(2026, 11, 10, 20) }, { at: 'x' }, null] };
  const learn = { sessions: [{ created: at(2026, 11, 8), updated: at(2026, 11, 11) }, { created: at(2026, 11, 9), updated: at(2026, 11, 9, 18) }] };
  const d = M.derivedDays({ review, learn });
  assert.deepEqual(d, { '2026-11-10': 2, '2026-11-08': 1, '2026-11-11': 1, '2026-11-09': 1 });
  const st = M.migrate({ days: { '2026-11-10': { n: 5, k: { review: 5 } }, '2026-11-12': { n: 1, k: { quiz: 1 } } } }, NOW);
  assert.deepEqual(M.dayCounts(st, d), { '2026-11-10': 5, '2026-11-12': 1, '2026-11-08': 1, '2026-11-11': 1, '2026-11-09': 1 });
});

test('streak counts back from today, or from yesterday when today is still open', () => {
  const c = { '2026-11-08': 1, '2026-11-09': 2, '2026-11-10': 1, '2026-11-11': 4, '2026-11-01': 1, '2026-11-02': 1 };
  assert.deepEqual(M.streak(c, NOW), { current: 4, longest: 4, today: false, total: 6 });
  assert.equal(M.streak({ ...c, '2026-11-12': 1 }, NOW).current, 5);
  assert.equal(M.streak({ '2026-11-10': 1 }, NOW).current, 0, 'a gap of a full day breaks it');
  assert.deepEqual(M.streak({}, NOW), { current: 0, longest: 0, today: false, total: 0 });
  assert.equal(M.streak({ '2026-10-30': 1, '2026-10-31': 1, '2026-11-01': 1 }, NOW).longest, 3, 'across a month end');
});

test('week starts on Monday and knows how many days are left', () => {
  const w = M.week({ '2026-11-09': 1, '2026-11-11': 2, '2026-11-12': 1, '2026-11-08': 9 }, 4, NOW);
  assert.deepEqual(w.days.map((d) => d.day), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(w.done, 3); assert.equal(w.left, 1); assert.equal(w.met, false); assert.equal(w.daysLeft, 3);
  assert.ok(w.days[3].today && w.days[4].future && !w.days[2].future);
  assert.equal(M.week({ '2026-11-09': 1 }, 1, NOW).met, true);
  const sun = M.week({}, 4, at(2026, 11, 15));
  assert.equal(sun.days[0].day, '2026-11-09'); assert.equal(sun.daysLeft, 0);
});

test('heatmap: weeks of seven days ending this week, levels by quartile, future cells blank', () => {
  const counts = { '2026-11-12': 9, '2026-11-11': 1, '2026-11-10': 3, '2026-11-02': 5 };
  const cols = M.heatmap(counts, 26, NOW);
  assert.equal(cols.length, 26);
  assert.ok(cols.every((c) => c.length === 7));
  assert.equal(cols.at(-1)[0].day, '2026-11-09', 'last column starts on this Monday');
  assert.equal(cols[0][0].day, M.addDays('2026-11-09', -25 * 7));
  const cell = (d) => cols.flat().find((x) => x.day === d);
  assert.equal(cell('2026-11-12').level, 4);
  assert.equal(cell('2026-11-11').level, 1);
  assert.equal(cell('2026-11-01').level, 0);
  assert.ok(cell('2026-11-13').future);
  for (const c of cols.flat()) assert.ok(c.level >= 0 && c.level <= 4);
});

test('summary pulls each area together and nextSteps suggests at most three things', () => {
  const stores = {
    learn: { sessions: [{ id: 's-a', kind: 'learn', phase: 'teach', title: '变分原理', updated: NOW - 1000 }, { id: 's-b', kind: 'learn', phase: 'done', updated: NOW - 5000 }, { id: 'pr-1', kind: 'practice', phase: 'practice' }], props: [{}, {}, {}] },
    review: { sched: { a: { due: NOW - 1 }, b: { due: NOW + 1e9 }, c: { due: NOW - 5 } }, log: [{ at: NOW - 1000 }, { at: NOW - 30 * 86400000 }], mine: [{}] },
    play: { box: 3, sg: [], bell: ['x'], tunnel: [1, 2], nosuch: 9 },
    qpQuiz: ['birth-1', 'birth-2'], fmQuiz: 'bad', qpProgress: ['c1:0', 'c1:1', 'c2:0'], fmProgress: [], qaProgress: ['g:0'],
    pet: { name: '苞苞', kind: 'budi', xp: 120 }
  };
  const s = M.summary(stores, NOW, (xp) => Math.floor(xp / 100) + 1);
  assert.deepEqual([s.learn.sessions, s.learn.done, s.learn.practice, s.learn.props], [2, 1, 1, 3]);
  assert.equal(s.learn.open[0].id, 's-a');
  assert.deepEqual([s.review.seen, s.review.due, s.review.week, s.review.total, s.review.mine], [3, 2, 1, 2, 1]);
  assert.deepEqual(s.quiz.qp, { done: 2, total: M.TOTALS.qpQuiz });
  assert.deepEqual(s.quiz.fm, { done: 0, total: M.TOTALS.fmQuiz });
  assert.equal(s.checks.qp.done, 3); assert.equal(s.checks.qp.chapters, 2);
  assert.deepEqual(s.play.played.map((g) => g.id), ['box', 'tunnel', 'bell']);
  assert.equal(s.play.total, 19);
  assert.deepEqual(s.pet, { name: '苞苞', kind: 'budi', xp: 120, level: 2 });
  const next = M.nextSteps(s, M.week({}, 4, NOW));
  assert.equal(next.length, 3);
  assert.deepEqual(next.map((n) => n.id), ['review', 'learn', 'qp']);
  assert.match(next[1].href, /#s-s-a$/);
  const empty = M.summary({}, NOW);
  assert.equal(empty.pet, null);
  assert.deepEqual(M.nextSteps(empty, null).map((n) => n.id), ['qp', 'play']);
});

test('TOTALS and GAMES match the data files and the playground page', () => {
  const qp = load('quantum/physics/qp-data.js', 'MOLASTRIA_QP'), fm = load('fundamental-science/math/fm-data.js', 'MOLASTRIA_FM'), qa = load('quantum/algorithms/qa-data.js', 'MOLASTRIA_QA');
  const checks = (a) => a.reduce((n, x) => n + (x.checks || []).length, 0);
  const quiz = (q) => Object.values(q.items).reduce((n, a) => n + a.length, 0);
  assert.equal(M.TOTALS.qpCheck, checks(qp.chapters));
  assert.equal(M.TOTALS.fmCheck, checks(fm.subjects));
  assert.equal(M.TOTALS.qaCheck, checks(qa.algos));
  assert.equal(M.TOTALS.qpQuiz, quiz(load('quantum/physics/qp-quiz.js', 'MOLASTRIA_QP_QUIZ')));
  assert.equal(M.TOTALS.fmQuiz, quiz(load('fundamental-science/math/fm-quiz.js', 'MOLASTRIA_FM_QUIZ')));
  const html = readFileSync(new URL('../public/qchem/index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/class="play-best" data-best="([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.deepEqual(M.GAMES.map((g) => g[0]), ids);
});

test('molastria-me is in the cloud-sync list', () => {
  const S = require('../public/sync/sync-core.js');
  assert.ok(S.KEYS.some((k) => k.key === M.KEY && k.pages.includes('/me/')));
});
