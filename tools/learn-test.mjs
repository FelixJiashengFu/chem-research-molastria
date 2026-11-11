// Tests for the Study Desk core logic (public/learn/learn-core.js): state migration, the plan graph, grading and
// calibration, the knowledge graph, practice selection, note splitting, AI reply validators and prompt builders.
//   node --test tools/learn-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../public/learn/learn-core.js');
const SRC = readFileSync(new URL('../public/learn/learn-core.js', import.meta.url), 'utf8');

const clock = (start = 1_700_000_000_000) => { let t = start; return { now: () => t++ }; };
const seq = () => { let i = 0; return () => ((i++ * 0.6180339887) % 1); };
const planOf = (nodes, goalId) => C.normalizePlan({ nodes, goalId });
const node = (id, deps = [], status = 'todo', label = `idea ${id}`) => ({ id, label, deps, status });
const textOf = (c) => (Array.isArray(c) ? c.filter((p) => p.type === 'text').map((p) => p.text).join('\n') : c);
const size = (msgs) => msgs.reduce((n, m) => n + textOf(m.content).length, 0);
// The upstream project's name must not appear in our code or prompts (docs/DECISIONS.md is the one place for credit).
const UPSTREAM = new RegExp(['learn', 'harness'].join(''), 'i');
const HAS_HTML = /<\s*\/?\s*(script|img|b|i|div|span|a|iframe|svg|p)\b[^<>]*>/i;

// ── loading ────────────────────────────────────────────────────────────
test('the browser build defines window.MOLASTRIA_LEARN_CORE without module and touches no DOM', () => {
  const box = { window: {} };
  box.globalThis = box.window;
  vm.runInNewContext(SRC.replace(/typeof globalThis !== 'undefined' \? globalThis : this/, 'window'), box);
  const W = box.window.MOLASTRIA_LEARN_CORE;
  assert.ok(W && typeof W.migrate === 'function');
  assert.equal(W.STORE_KEY, 'molastria-learn');
  assert.equal(W.PROMPT_KEY, 'molastria-learn-prompts');
  assert.equal(W.SCHEMA_VERSION, 1);
  // Plain vm context with only globalThis (the real pattern): attaches to globalThis.
  const ctx = vm.createContext({});
  vm.runInContext(SRC, ctx);
  assert.equal(typeof vm.runInContext('MOLASTRIA_LEARN_CORE.emptyState', ctx), 'function');
  assert.doesNotMatch(SRC, /\bdocument\.|\bfetch\(|\beval\(|new Function\(|innerHTML/);
  assert.doesNotMatch(SRC, UPSTREAM);
});

// ── state ───────────────────────────────────────────────────────────────
test('emptyState has the documented shape', () => {
  assert.deepEqual(C.emptyState(), { v: 1, sessions: [], props: [], chains: [], usage: { cost: 0, tokens: 0, calls: 0 } });
});

test('migrate tolerates garbage and never throws', () => {
  for (const raw of [undefined, null, 0, 42, 'nope', '{bad json', '[]', [], true, { sessions: 'x', props: 5, chains: null, usage: 'y' }, { sessions: [null, 1, 'a', { id: '' }] }]) {
    const s = C.migrate(raw);
    assert.deepEqual(s, C.emptyState(), `raw = ${JSON.stringify(raw)}`);
  }
  const weird = Object.create(null);
  Object.defineProperty(weird, 'sessions', { get() { throw new Error('boom'); }, enumerable: true });
  assert.deepEqual(C.migrate(weird), C.emptyState());
});

test('migrate keeps valid data, drops invalid items, dedupes ids and repairs references', () => {
  const raw = {
    v: 1,
    sessions: [
      { id: 's1', kind: 'learn', goal: 'Understand tunnelling', phase: 'teach', created: 5, probe: { questions: [{ id: 'q1', kind: 'choice', prompt: 'Which?', options: ['a', 'b'], answer: 1 }, { prompt: '' }], answers: { q1: { value: 1, confidence: 'sure', thinking: 'because' }, zz: { value: 'x' } } },
        plan: { nodes: [node('a'), node('b', ['a', 'ghost'])], goalId: 'b' }, current: 'missing', steps: [{ id: 'st1', nodeId: 'a', kind: 'teach', explain: 'Step text', check: { prompt: 'Q?' }, answer: { value: 'x', confidence: 'bogus' } }, { explain: '' }],
        usage: { cost: -3, tokens: 12.6, calls: 'x' } },
      { id: 's1', kind: 'learn', goal: 'duplicate id' },
      { id: 'p1', kind: 'practice', phase: 'probe', practice: { items: [{ problem: 'P?', hints: ['h1', 'h2', 'h3', 'h4'], solution: 'S', hintsUsed: 9 }, { problem: '' }] } },
      { id: 'bad<script>', kind: 'weird', title: '<b>T</b>' }
    ],
    props: [{ id: 'x1', text: 'A claim', sessionIds: ['s1', 's1'] }, { id: 'x1', text: 'dup' }, { id: 'x2', text: '' }, { id: 'x3', text: 'Another', practiced: { at: 9, n: 2, missed: 1, last: 'wrong' } }],
    chains: [{ id: 'c1', premises: ['x1', 'x1'], conclusion: 'x3' }, { id: 'c2', premises: ['nope'], conclusion: 'x3' }, { id: 'c3', premises: ['x3'], conclusion: 'x3' }],
    usage: { cost: 0.5, tokens: 100, calls: 2, unpriced: true }
  };
  const s = C.migrate(JSON.stringify(raw));
  assert.equal(s.sessions.length, 3);
  const [a, p, odd] = s.sessions;
  assert.equal(a.phase, 'teach');
  assert.equal(a.probe.questions.length, 1);
  assert.deepEqual(Object.keys(a.probe.answers), ['q1']);
  assert.deepEqual(a.plan.nodes.find((n) => n.id === 'b').deps, ['a']);
  assert.equal(a.current, null);
  assert.equal(a.steps.length, 1);
  assert.equal(a.steps[0].answer.confidence, 'fair');
  assert.deepEqual(a.usage, { cost: 0, tokens: 13, calls: 0 });
  assert.equal(p.kind, 'practice');
  assert.equal(p.phase, 'practice', 'a learn phase on a practice session is reset');
  assert.equal(p.practice.items.length, 1);
  assert.equal(p.practice.items[0].hints.length, 3);
  assert.equal(p.practice.items[0].hintsUsed, 3);
  assert.equal(odd.id, 'badscript');
  assert.equal(odd.kind, 'learn');
  assert.equal(odd.title, 'T');
  assert.deepEqual(s.props.map((x) => x.id), ['x1', 'x3']);
  assert.deepEqual(s.props[0].sessionIds, ['s1']);
  assert.equal(s.props[1].practiced.last, 'wrong');
  assert.deepEqual(s.chains, [{ id: 'c1', premises: ['x1'], conclusion: 'x3', sessionIds: [] }]);
  assert.deepEqual(s.usage, { cost: 0.5, tokens: 100, calls: 2, unpriced: true });
  // Idempotent: migrating a migrated state changes nothing.
  assert.deepEqual(C.migrate(s), s);
  assert.deepEqual(C.migrate(JSON.parse(JSON.stringify(s))), s);
});

test('newId is unique, uses the injected clock and random source, and is deterministic', () => {
  const a = C.newId('s', [], { now: 1000, random: () => 0.5 });
  const b = C.newId('s', [], { now: 1000, random: () => 0.5 });
  assert.equal(a, b);
  assert.match(a, /^s[0-9a-z]+$/);
  assert.ok(a.startsWith('s' + (1000).toString(36)));
  const taken = new Set([a]);
  const c = C.newId('s', taken, { now: 1000, random: () => 0.5 });
  assert.notEqual(c, a);
  taken.add(c);
  assert.ok(!taken.has(C.newId('s', taken, { now: 1000, random: () => 0.5 })));
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(C.newId('p', ids));
  assert.equal(ids.size, 500);
  assert.match(C.newId('<bad>'), /^bad/);
});

test('createSession and removeSession: props survive, their session links go', () => {
  const st = C.emptyState();
  const s = C.createSession(st, { goal: '理解薛定谔方程的定态解', source: { type: 'chapter', ref: 'qp:c3', label: 'Ch 3' }, files: [{ name: 'a.md', size: 3, text: 'abc' }] }, { now: 50, random: () => 0.1 });
  assert.equal(st.sessions[0], s);
  assert.equal(s.kind, 'learn');
  assert.equal(s.phase, 'probe');
  assert.equal(s.source.type, 'chapter');
  assert.equal(s.created, 50);
  assert.ok(s.title.length <= 40);
  const pr = C.createSession(st, { kind: 'practice' }, { now: 51 });
  assert.equal(pr.phase, 'practice');
  assert.equal(st.sessions[0], pr);
  C.addProps(st, ['Claim one is here.'], s.id, { now: 1 });
  assert.ok(C.removeSession(st, s.id));
  assert.equal(st.sessions.length, 1);
  assert.equal(st.props.length, 1);
  assert.deepEqual(st.props[0].sessionIds, []);
  assert.equal(C.removeSession(st, 'nope'), false);
});

test('acceptFile enforces type, size and count', () => {
  assert.deepEqual(C.acceptFile('notes.md', 1000), { ok: true });
  assert.deepEqual(C.acceptFile('x.PY', 10), { ok: true });
  assert.equal(C.acceptFile('pic.png', 10).reason, 'type');
  assert.equal(C.acceptFile('big.txt', 60 * 1024 + 1).reason, 'size');
  assert.equal(C.acceptFile('ok.tex', 10, 3).reason, 'count');
});

// ── plan ────────────────────────────────────────────────────────────────
test('normalizePlan cleans ids, drops unknown and self deps, dedupes ids', () => {
  const p = C.normalizePlan({ nodes: [{ id: 'a b', label: '<i>A</i>', deps: ['a b', 'zz'] }, { id: 'ab', label: 'dup', deps: [] }, { label: 'no id', deps: ['ab'] }, { id: 'x', label: '' }, null, 'str'], goalId: 'nope' });
  assert.deepEqual(p.nodes.map((n) => n.id), ['ab', 'abx', 'n3']);
  assert.equal(p.nodes[0].label, 'A');
  assert.deepEqual(p.nodes[0].deps, []);
  assert.equal(p.goalId, 'n3', 'the goal falls back to the last sink');
  assert.deepEqual(C.normalizePlan({}), { nodes: [], goalId: null });
  assert.deepEqual(C.normalizePlan(null), { nodes: [], goalId: null });
});

test('normalizePlan breaks cycles deterministically and the result is a DAG', () => {
  const raw = { nodes: [node('a', ['c']), node('b', ['a']), node('c', ['b']), node('d', ['c', 'a'])], goalId: 'd' };
  const p1 = C.normalizePlan(raw), p2 = C.normalizePlan(JSON.parse(JSON.stringify(raw)));
  assert.deepEqual(p1, p2);
  const order = C.topoOrder(p1);
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const n of p1.nodes) for (const d of n.deps) assert.ok(pos.get(d) < pos.get(n.id), `${d} before ${n.id}`);
  assert.equal(p1.nodes.reduce((k, n) => k + n.deps.length, 0), 4, 'exactly one edge of the 3-cycle is removed');
  // A random dense graph always comes out acyclic.
  const r = C.rng(7);
  for (let t = 0; t < 30; t++) {
    const nodes = Array.from({ length: 10 }, (_, i) => node(`n${i}`, Array.from({ length: 4 }, () => `n${Math.floor(r() * 10)}`)));
    const p = C.normalizePlan({ nodes, goalId: 'n9' });
    const o = C.topoOrder(p), at = new Map(o.map((id, i) => [id, i]));
    assert.equal(o.length, 10);
    for (const n of p.nodes) for (const d of n.deps) assert.ok(at.get(d) < at.get(n.id));
  }
});

test('normalizePlan clamps to 14 nodes keeping the goal and its nearest prerequisites', () => {
  const nodes = [];
  for (let i = 0; i < 10; i++) nodes.push(node(`x${i}`)); // unrelated, listed first
  for (let i = 0; i < 12; i++) nodes.push(node(`c${i}`, i ? [`c${i - 1}`] : [])); // chain c0 → … → c11
  nodes.push(node('g', ['c11']));
  const p = C.normalizePlan({ nodes, goalId: 'g' });
  assert.equal(p.nodes.length, 14);
  assert.ok(p.nodes.some((n) => n.id === 'g'));
  for (let i = 0; i < 12; i++) assert.ok(p.nodes.some((n) => n.id === `c${i}`), `c${i} kept`);
  for (const n of p.nodes) for (const d of n.deps) assert.ok(p.nodes.some((m) => m.id === d), 'no dangling deps after clamping');
});

test('normalizePlan: heldTexts mark matching nodes held; the goal is never held; one doing at most', () => {
  const p = C.normalizePlan({ nodes: [{ id: 'a', label: 'Complex numbers', deps: [] }, { id: 'b', label: 'Wave functions', deps: ['a'], status: 'doing' }, { id: 'c', label: 'Normalisation', deps: ['b'], status: 'doing' }, { id: 'g', label: 'Tunnelling', deps: ['c'], status: 'held' }], goalId: 'g' }, { heldTexts: ['complex numbers.', 'Tunnelling'] });
  const st = Object.fromEntries(p.nodes.map((n) => [n.id, n.status]));
  assert.deepEqual(st, { a: 'held', b: 'doing', c: 'todo', g: 'todo' });
});

test('prunePlan removes nodes the goal does not need and keeps held ancestors', () => {
  const p = planOf([node('a', [], 'held'), node('b', ['a']), node('side'), node('side2', ['side']), node('g', ['b'])], 'g');
  const q = C.prunePlan(p);
  assert.deepEqual(q.nodes.map((n) => n.id), ['a', 'b', 'g']);
  assert.equal(q.nodes[0].status, 'held');
  assert.equal(p.nodes.length, 5, 'prunePlan does not mutate its input');
});

test('topoOrder is stable and nextNode walks the plan', () => {
  let p = planOf([node('g', ['b', 'c']), node('c', ['a']), node('a', [], 'held'), node('b')], 'g');
  assert.deepEqual(C.topoOrder(p), ['a', 'c', 'b', 'g'], 'among ready nodes the plan order decides');
  assert.equal(C.nextNode(p), 'c');
  p = C.setNodeStatus(p, 'b', 'doing');
  assert.equal(C.nextNode(p), 'b', 'the node in progress comes first');
  p = C.setNodeStatus(p, 'b', 'done');
  assert.equal(C.nextNode(p), 'c');
  p = C.setNodeStatus(p, 'c', 'done');
  assert.equal(C.nextNode(p), 'g');
  p = C.setNodeStatus(p, 'g', 'done');
  assert.equal(C.nextNode(p), null);
  // A shaky prerequisite blocks what depends on it until it is fixed.
  const s = planOf([node('a', [], 'shaky'), node('g', ['a'])], 'g');
  assert.equal(C.nextNode(s), 'a');
  assert.equal(C.nextNode({ nodes: [] }), null);
  // setNodeStatus keeps only one 'doing'.
  const d = C.setNodeStatus(C.setNodeStatus(p, 'a', 'doing'), 'b', 'doing');
  assert.equal(d.nodes.filter((n) => n.status === 'doing').length, 1);
});

test('applyPlanPatch: held, shaky, add with unlocks, merge, remove; goal protected; still a DAG', () => {
  const p = planOf([node('a'), node('b', ['a']), node('c', ['b']), node('g', ['c'])], 'g');
  const q = C.applyPlanPatch(p, {
    held: ['b', 'g', 'ghost'], shaky: ['a'],
    add: [{ id: 'p', label: 'New prerequisite', deps: [], unlocks: ['c'] }, { id: 'c', label: 'ignored', deps: ['a'] }, { label: '' }],
    remove: ['g', 'zz']
  });
  const by = Object.fromEntries(q.nodes.map((n) => [n.id, n]));
  assert.equal(by.b.status, 'held');
  assert.equal(by.g.status, 'todo', 'goal is never marked held');
  assert.ok(by.g, 'goal is never removed');
  assert.equal(by.a.status, 'shaky');
  assert.ok(by.p);
  assert.deepEqual(by.c.deps.sort(), ['a', 'b', 'p']);
  assert.equal(by.c.label, 'idea c');
  assert.equal(q.goalId, 'g');
  assert.equal(C.nextNode(q), 'a');
  // remove drops the node and every reference to it
  const r = C.applyPlanPatch(q, { remove: ['p'] });
  assert.ok(!r.nodes.some((n) => n.id === 'p' || n.deps.includes('p')));
  // a patch that would create a cycle comes out acyclic
  const cyc = C.applyPlanPatch(p, { add: [{ id: 'a', label: 'a', deps: ['c'] }] });
  const at = new Map(C.topoOrder(cyc).map((id, i) => [id, i]));
  for (const n of cyc.nodes) for (const d of n.deps) assert.ok(at.get(d) < at.get(n.id));
  // garbage patch leaves the plan as it was
  assert.deepEqual(C.applyPlanPatch(p, null), p);
  assert.deepEqual(C.applyPlanPatch(p, 'x'), p);
  assert.equal(p.nodes.length, 4, 'input is not mutated');
});

test('planProgress counts nodes to teach (held excluded)', () => {
  const p = planOf([node('a', [], 'held'), node('b', ['a'], 'done'), node('c', ['b'], 'shaky'), node('g', ['c'])], 'g');
  assert.deepEqual(C.planProgress(p), { done: 1, total: 3 });
  assert.deepEqual(C.planProgress({ nodes: [] }), { done: 0, total: 0 });
});

test('layoutLayers uses longest-path layers with unique indices per layer', () => {
  const p = planOf([node('a'), node('b'), node('c', ['a']), node('d', ['a', 'c']), node('g', ['b', 'd'])], 'g');
  const L = C.layoutLayers(p);
  assert.deepEqual(Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.layer])), { a: 0, b: 0, c: 1, d: 2, g: 3 });
  assert.deepEqual([L.a.index, L.b.index], [0, 1]);
  for (const n of p.nodes) for (const d of n.deps) assert.ok(L[d].layer < L[n.id].layer);
  assert.deepEqual(C.layoutLayers({ nodes: [] }), {});
});

// ── grading ─────────────────────────────────────────────────────────────
test('gradeChoice grades by index, letter or text, and returns null when it cannot', () => {
  const q = { kind: 'choice', options: ['red', 'green', 'blue'], answer: 1 };
  assert.equal(C.gradeChoice(q, 1), true);
  assert.equal(C.gradeChoice(q, '1'), true);
  assert.equal(C.gradeChoice(q, 'B'), true);
  assert.equal(C.gradeChoice(q, 'Green'), true);
  assert.equal(C.gradeChoice(q, 0), false);
  assert.equal(C.gradeChoice(q, 7), false);
  assert.equal(C.gradeChoice(q, undefined), false);
  assert.equal(C.gradeChoice({ kind: 'short', answer: 'x' }, 'x'), null);
  assert.equal(C.gradeChoice({ kind: 'choice', options: ['a', 'b'] }, 0), null);
  assert.equal(C.gradeChoice(null, 0), null);
});

test('calibration counts over- and under-confidence by level', () => {
  const c = C.calibration({
    a: { correct: true, confidence: 'sure' }, b: { correct: false, confidence: 'sure' }, c: { correct: true, confidence: 'guess' },
    d: { correct: false, confidence: 'guess' }, e: { correct: true, confidence: 'fair' }, f: { value: 'ungraded', confidence: 'sure' }, g: null
  });
  assert.deepEqual(c, { n: 5, correct: 3, overconfident: 1, underconfident: 1, byLevel: { sure: { n: 2, correct: 1 }, fair: { n: 1, correct: 1 }, guess: { n: 2, correct: 1 } } });
  assert.equal(C.calibration([{ correct: true, confidence: 'weird' }]).byLevel.fair.n, 1);
  assert.equal(C.calibration(undefined).n, 0);
});

test('needsRepair: wrong, or right but guessed', () => {
  assert.equal(C.needsRepair({ correct: false, confidence: 'sure' }), true);
  assert.equal(C.needsRepair({ correct: true, confidence: 'guess' }), true);
  assert.equal(C.needsRepair({ correct: true, confidence: 'fair' }), false);
  assert.equal(C.needsRepair({ correct: true, confidence: 'sure' }), false);
  assert.equal(C.needsRepair({ value: 'ungraded' }), false);
  assert.equal(C.needsRepair(null), false);
});

// ── knowledge graph ─────────────────────────────────────────────────────
test('normText and similar', () => {
  assert.equal(C.normText(' Ｅ＝ｍｃ²， Hello  World! '), 'e=mc2helloworld');
  assert.equal(C.normText('电子是费米子。'), '电子是费米子');
  assert.ok(C.similar('Electrons are fermions.', 'electrons are fermions'));
  assert.ok(C.similar('The energy levels of a particle in a box are quantised.', 'The energy levels of a particle in a box are quantized.'));
  assert.ok(C.similar('电子是费米子，服从泡利不相容原理', '电子是费米子,服从泡利不相容原理。'));
  assert.ok(!C.similar('Electrons are fermions.', 'Electrons are not fermions.'), 'a negation keeps claims apart');
  assert.ok(!C.similar('电子是费米子', '电子不是费米子'));
  assert.ok(!C.similar('Photons are bosons.', 'Electrons are fermions.'));
  assert.ok(!C.similar('', ''));
  assert.ok(!C.similar('a', 'ab'));
  assert.equal(C.dice('abc', 'abc'), 1);
  assert.equal(C.dice('abcd', 'wxyz'), 0);
});

test('addProps dedupes into existing props and merges sessionIds', () => {
  const st = C.emptyState(), o = { ...clock(), random: seq() };
  const ids1 = C.addProps(st, ['Electrons are fermions.', '<b>Photons</b> are bosons.', '', '   ', 'electrons are fermions'], 's1', o);
  assert.equal(ids1.length, 2);
  assert.equal(st.props.length, 2);
  assert.equal(st.props[1].text, 'Photons are bosons.', 'HTML is stripped');
  const ids2 = C.addProps(st, ['Electrons are fermions!', 'Spin is intrinsic angular momentum.'], 's2', o);
  assert.equal(ids2[0], ids1[0]);
  assert.equal(st.props.length, 3);
  assert.deepEqual(st.props[0].sessionIds, ['s1', 's2']);
  C.addProps(st, ['Electrons are fermions.'], 's2', o);
  assert.deepEqual(st.props[0].sessionIds, ['s1', 's2'], 'no duplicate session id');
  assert.equal(new Set(st.props.map((p) => p.id)).size, st.props.length);
  assert.equal(C.addProp(st, null, 's1', o), null);
  assert.ok(st.props.every((p) => typeof p.created === 'number'));
});

test('addChain links premises to a conclusion, merges repeats, ignores degenerate chains', () => {
  const st = C.emptyState(), o = { ...clock(), random: seq() };
  const c1 = C.addChain(st, ['The box has width L.', 'The wave must vanish at the walls.'], 'Only standing waves with nodes at the walls fit.', 's1', o);
  assert.ok(c1);
  assert.equal(st.props.length, 3);
  assert.equal(st.chains.length, 1);
  const ch = st.chains[0];
  assert.equal(ch.premises.length, 2);
  assert.equal(st.props.find((p) => p.id === ch.conclusion).text, 'Only standing waves with nodes at the walls fit.');
  const again = C.addChain(st, ['The wave must vanish at the walls.', 'The box has width L.'], 'Only standing waves with nodes at the walls fit', 's2', o);
  assert.equal(again, c1);
  assert.equal(st.chains.length, 1);
  assert.deepEqual(st.chains[0].sessionIds, ['s1', 's2']);
  assert.equal(C.addChain(st, ['X is Y.'], 'X is Y.', 's1', o), null, 'conclusion equal to its only premise');
  assert.equal(C.addChain(st, [], 'Lonely claim.', 's1', o), null);
  assert.equal(C.addChain(st, ['A premise.'], '', 's1', o), null);
  assert.equal(st.chains.length, 1);
});

test('removeProp also drops every chain that references it', () => {
  const st = C.emptyState(), o = { ...clock(), random: seq() };
  C.addChain(st, ['Premise one holds.', 'Premise two holds.'], 'The conclusion follows.', 's1', o);
  C.addChain(st, ['The conclusion follows.'], 'A further result follows.', 's1', o);
  C.addChain(st, ['Something unrelated holds.'], 'Another unrelated result.', 's1', o);
  assert.equal(st.chains.length, 3);
  const mid = st.props.find((p) => p.text === 'The conclusion follows.').id;
  assert.ok(C.removeProp(st, mid));
  assert.equal(st.chains.length, 1);
  assert.ok(!st.props.some((p) => p.id === mid));
  assert.ok(st.chains.every((c) => c.conclusion !== mid && !c.premises.includes(mid)));
  assert.equal(C.removeProp(st, 'nope'), false);
});

test('searchProps, relatedProps, neighbours and graphData', () => {
  const st = C.emptyState(), o = { ...clock(), random: seq() };
  C.addChain(st, ['薛定谔方程描述波函数随时间的演化。', '定态的概率密度不随时间变化。'], '定态解满足时间无关的薛定谔方程。', 's1', o);
  C.addChain(st, ['Tunnelling probability falls exponentially with barrier width.'], 'Scanning tunnelling microscopes are very sensitive to tip height.', 's2', o);
  C.addChain(st, ['定态的概率密度不随时间变化。', 'Extra premise about energy.'], '定态解满足时间无关的薛定谔方程。', 's3', o);
  assert.equal(st.props.length, 6);
  const hit = C.searchProps(st, '薛定谔');
  assert.equal(hit.length, 2);
  assert.ok(hit.every((p) => p.text.includes('薛定谔')));
  assert.equal(C.searchProps(st, 'TUNNELLING')[0].text.startsWith('Tunnelling'), true);
  assert.ok(C.searchProps(st, 'barrier widths tunnelling').length >= 1, 'fuzzy match by words');
  assert.equal(C.searchProps(st, '').length, 6);
  assert.equal(C.searchProps(st, 'zzzz qqqq').length, 0);

  const rel = C.relatedProps(st, '怎么解时间无关的薛定谔方程', 3);
  assert.ok(rel.length >= 1 && rel.length <= 3);
  assert.match(rel[0].text, /薛定谔/);
  const relEn = C.relatedProps(st, 'why is the microscope sensitive to the tip?', 2);
  assert.match(relEn[0].text, /microscope/i);
  assert.deepEqual(C.relatedProps(st, '', 5), []);
  assert.deepEqual(C.relatedProps(st, 'completely different words xyzzy', 5), []);

  const conc = st.props.find((p) => p.text.startsWith('定态解')).id;
  assert.equal(C.neighbours(st, conc).length, 3);

  const g = C.graphData(st);
  assert.equal(g.nodes.length, 6);
  assert.equal(g.links.length, 4, 'a repeated premise → conclusion pair becomes one link');
  const shared = g.links.find((l) => l.chains.length === 2);
  assert.ok(shared && shared.target === conc);
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const l of g.links) assert.ok(ids.has(l.source) && ids.has(l.target) && l.chain);
  assert.equal(g.nodes.find((n) => n.id === conc).degree, 3);
  assert.deepEqual(g.nodes.find((n) => n.id === conc).sessions, ['s1', 's3']);
  assert.deepEqual(C.graphData(C.emptyState()), { nodes: [], links: [] });
});

// ── practice ────────────────────────────────────────────────────────────
function practiceState() {
  const st = C.emptyState(), o = { ...clock(), random: seq() };
  const words = ['Photons carry momentum p = h/λ.', 'Electrons in a box have quantised energies.', 'Spin one-half particles obey Pauli exclusion.', 'Tunnelling decays exponentially with barrier width.',
    'Eigenvalues of Hermitian operators are real.', 'Commuting observables share eigenstates.', 'The commutator of x and p is iħ.', 'Unitary evolution preserves the norm.',
    'Enzymes may use hydrogen tunnelling.', 'Radical pairs can sense magnetic fields.', 'Photosynthetic transfer is highly efficient.', 'Olfaction theories invoke vibration.'];
  ['sA', 'sB', 'sC'].forEach((s, k) => { for (let i = 0; i < 4; i++) C.addProp(st, words[k * 4 + i], s, o); });
  assert.equal(st.props.length, 12);
  return st;
}

test('pickPractice interleaves sessions, is deterministic for a seed and respects k', () => {
  const st = practiceState(), now = 2_000_000_000_000;
  const a = C.pickPractice(st, { k: 6, now, seed: 42 });
  const b = C.pickPractice(st, { k: 6, now, seed: 42 });
  assert.deepEqual(a, b);
  assert.equal(a.length, 6);
  assert.equal(new Set(a).size, 6);
  const group = (id) => st.props.find((p) => p.id === id).sessionIds[0];
  for (let i = 1; i < a.length; i++) assert.notEqual(group(a[i]), group(a[i - 1]), 'neighbouring problems come from different sessions');
  assert.equal(new Set(a.slice(0, 3).map(group)).size, 3, 'the first round visits every session');
  assert.ok(C.pickPractice(st, { k: 100, now, seed: 1 }).length === 12);
  assert.deepEqual(C.pickPractice(st, { k: 0, now }), []);
  assert.deepEqual(C.pickPractice(C.emptyState(), { k: 5 }), []);
  const seeds = new Set(Array.from({ length: 8 }, (_, s) => C.pickPractice(st, { k: 6, now, seed: s }).join()));
  assert.ok(seeds.size > 1, 'different seeds give different picks');
});

test('pickPractice weights never practised > missed or guessed > longest since practice', () => {
  const st = practiceState(), now = 2_000_000_000_000, day = 86400000;
  const [p0, p1, p2, p3] = st.props;
  // Everything practised and right, at different ages, except: p1 missed, p2 guessed, p3 never practised.
  st.props.forEach((p, i) => { p.practiced = { at: now - (i + 1) * day, n: 3, missed: 0, last: 'right' }; });
  delete p3.practiced;
  C.recordPractice(st, [p1.id], false, now - day);
  C.recordPractice(st, [p2.id], true, now - day, 'guess');
  assert.equal(p1.practiced.last, 'wrong');
  assert.equal(p1.practiced.missed, 1);
  assert.equal(p1.practiced.n, 4);
  assert.equal(p2.practiced.last, 'unsure');
  for (let seed = 0; seed < 20; seed++) {
    const pick = C.pickPractice(st, { k: 1, now, seed });
    assert.deepEqual(pick, [p3.id], 'never practised first');
    const three = C.pickPractice(st, { k: 12, now, seed });
    assert.ok(three.indexOf(p1.id) < three.indexOf(p0.id) || st.props.indexOf(p0) < 0);
  }
  // Without the never-practised prop, the missed and the guessed come before the merely old ones.
  p3.practiced = { at: now, n: 1, missed: 0, last: 'right' };
  const sameGroup = st.props.filter((p) => p.sessionIds[0] === p0.sessionIds[0]);
  const order = C.pickPractice({ ...st, props: sameGroup }, { k: 4, now, seed: 3 });
  assert.deepEqual(new Set(order.slice(0, 2)), new Set([p1.id, p2.id]));
  // Among right answers, the oldest practice comes first.
  const old = st.props.filter((p) => p.sessionIds[0] === 'sB');
  old.forEach((p, i) => { p.practiced = { at: now - (i + 1) * 20 * day, n: 1, missed: 0, last: 'right' }; });
  assert.equal(C.pickPractice({ ...st, props: old }, { k: 1, now, seed: 9 })[0], old[3].id);
});

test('recordPractice only touches the given props', () => {
  const st = practiceState();
  C.recordPractice(st, [st.props[0].id, 'ghost'], true, 123, 'sure');
  assert.deepEqual(st.props[0].practiced, { at: 123, n: 1, missed: 0, last: 'right' });
  assert.equal(st.props[1].practiced, undefined);
});

// ── notes ───────────────────────────────────────────────────────────────
test('splitNotes chunks by headings and paragraphs within maxChars, losing nothing', () => {
  const para = (n, w) => Array.from({ length: n }, (_, i) => `${w} sentence ${i} is here.`).join(' ');
  const md = `# One\n\n${para(5, 'alpha')}\n\n${para(5, 'beta')}\n\n## Two\n\n${para(30, 'gamma')}\n\n# Three\n${para(3, 'delta')}\n\n\n\n不分段的一大段中文。${'这是一句很长的中文句子。'.repeat(80)}`;
  const chunks = C.splitNotes(md, 600);
  assert.ok(chunks.length >= 4);
  for (const c of chunks) { assert.ok(c.length <= 600, `chunk of ${c.length}`); assert.ok(c.trim().length > 0); }
  const flat = (s) => s.replace(/\s+/g, '');
  assert.equal(flat(chunks.join('')), flat(md), 'all text kept, in order');
  assert.ok(chunks.some((c) => c.startsWith('## Two')) || chunks.some((c) => c.startsWith('# Three')), 'headings start chunks');
  assert.deepEqual(C.splitNotes('', 500), []);
  assert.deepEqual(C.splitNotes('short note', 500), ['short note']);
  assert.deepEqual(C.splitNotes('a\r\n\r\nb', 500), ['a\n\nb']);
  const hard = C.splitNotes('x'.repeat(2500), 1000);
  assert.deepEqual(hard.map((c) => c.length), [1000, 1000, 500]);
});

// ── validators ──────────────────────────────────────────────────────────
test('stripTags removes HTML but keeps math comparisons', () => {
  assert.equal(C.stripTags('<b>bold</b> and <script>alert(1)</script>x'), 'bold and x');
  assert.equal(C.stripTags('<img src=x onerror=alert(1)>ok'), 'ok');
  assert.equal(C.stripTags('<div class="a"><span>t</span></div>'), 't');
  assert.equal(C.stripTags('<!-- hidden -->v'), 'v');
  assert.equal(C.stripTags('a < b and c > d, x<y, y>z, 0<x<1'), 'a < b and c > d, x<y, y>z, 0<x<1');
  assert.doesNotMatch(C.stripTags('<scr<script>ipt>alert(1)</script>'), /<script/i);
  assert.doesNotMatch(C.stripTags('<<b>img src=x onerror=alert(1)>'), HAS_HTML);
  assert.equal(C.stripTags('<svg onload=alert(1)><circle/></svg>after'), 'after');
});

test('truncate respects the limit and prefers sentence ends', () => {
  assert.equal(C.truncate('short', 10), 'short');
  assert.equal(C.truncate('anything', 0), '');
  const t = 'First sentence here. Second sentence here. Third one.';
  const r = C.truncate(t, 45);
  assert.ok(r.length <= 45);
  assert.ok(r.endsWith('…'));
  assert.ok(r.startsWith('First sentence here. Second sentence here.'));
  for (const n of [1, 2, 5, 17, 100]) assert.ok(C.truncate('x'.repeat(300), n).length <= n);
});

test('parseProbe: clean questions, 1–5, answers as indices, HTML stripped, garbage rejected', () => {
  const r = C.parseProbe({
    goalRestated: '<b>Explain</b> tunnelling',
    questions: [
      { id: 'q1', kind: 'choice', prompt: 'Pick <i>one</i>', options: ['A', 'B', 'C'], answer: 2, nodeHint: 'waves' },
      { id: 'q1', kind: 'choice', prompt: 'Letter answer', options: ['x', 'y'], answer: 'B' },
      { kind: 'choice', prompt: 'Too few options becomes short', options: ['only'], answer: 'model' },
      { id: 'q4', kind: 'short', prompt: 'Why?', answer: 'Because.' },
      { prompt: '' }, null, 7,
      { id: 'q6', kind: 'short', prompt: 'Five' }, { id: 'q7', kind: 'short', prompt: 'Six — cut' }
    ]
  });
  assert.equal(r.goalRestated, 'Explain tunnelling');
  assert.equal(r.questions.length, 5);
  assert.deepEqual(r.questions.map((q) => q.id), ['q1', 'q1x', 'q3', 'q4', 'q6']);
  assert.equal(r.questions[0].prompt, 'Pick one');
  assert.equal(r.questions[0].answer, 2);
  assert.equal(r.questions[1].answer, 1);
  assert.equal(r.questions[2].kind, 'short');
  assert.equal(r.questions[2].answer, 'model');
  assert.equal(r.questions[0].nodeHint, 'waves');
  assert.equal(C.parseProbe([{ prompt: 'array form' }]).questions.length, 1);
  for (const bad of [null, 'x', 3, {}, { questions: [] }, { questions: [{ prompt: '' }] }]) assert.throws(() => C.parseProbe(bad), /[一-鿿]/);
  const long = C.parseProbe({ questions: [{ prompt: 'x'.repeat(5000), options: ['a'.repeat(900), 'b'], answer: 9 }] });
  assert.ok(long.questions[0].prompt.length <= 800);
  assert.ok(long.questions[0].options[0].length <= 240);
  assert.equal(long.questions[0].answer, undefined, 'an out-of-range answer index is dropped');
});

test('parsePlan validates the map and the probe grades', () => {
  const r = C.parsePlan({ nodes: [{ id: 'n1', label: 'A', deps: [], status: 'held' }, { id: 'n2', label: '<b>B</b>', deps: ['n1', 'zz'], status: 'weird' }], goalId: 'n2', startNote: 'Start <script>x</script>here', grades: [{ id: 'q1', correct: 'true', feedback: 'ok' }, { id: 'q2' }, { correct: true }] });
  assert.equal(r.goalId, 'n2');
  assert.equal(r.nodes[1].label, 'B');
  assert.equal(r.nodes[1].status, 'todo');
  assert.deepEqual(r.nodes[1].deps, ['n1']);
  assert.equal(r.startNote, 'Start here');
  assert.deepEqual(r.grades, [{ id: 'q1', correct: true, feedback: 'ok' }]);
  assert.throws(() => C.parsePlan({ nodes: [] }), /[一-鿿]/);
  assert.throws(() => C.parsePlan([]), /[一-鿿]/);
  assert.equal(C.parsePlan({ nodes: [{ id: 'a', label: 'Known' }, { id: 'g', label: 'Goal', deps: ['a'] }] }, { heldTexts: ['known'] }).nodes[0].status, 'held');
});

test('parseDiagram: ≤ 12 nodes, ≤ 20 edges, labels ≤ 40, edges must reference nodes', () => {
  const nodes = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, label: `<b>L</b>${'x'.repeat(i * 5)}` }));
  const edges = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) edges.push({ from: `n${i}`, to: `n${j}`, label: 'rel' });
  edges.push({ from: 'n0', to: 'ghost' });
  const d = C.parseDiagram({ nodes, edges });
  assert.equal(d.nodes.length, 12);
  assert.equal(d.edges.length, 20);
  for (const n of d.nodes) { assert.ok(n.label.length <= 40); assert.doesNotMatch(n.label, /</); }
  const ids = new Set(d.nodes.map((n) => n.id));
  for (const e of d.edges) { assert.ok(ids.has(e.from) && ids.has(e.to)); assert.notEqual(e.from, e.to); }
  assert.throws(() => C.parseDiagram({ nodes: [] }));
  assert.throws(() => C.parseDiagram('<svg/>'));
  assert.deepEqual(C.parseDiagram({ nodes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'A2' }], edges: [{ from: 'a', to: 'ax' }, { from: 'a', to: 'ax' }] }), { nodes: [{ id: 'a', label: 'A' }, { id: 'ax', label: 'A2' }], edges: [{ from: 'a', to: 'ax' }] });
});

const goodStep = (over = {}) => ({
  step: { node: 'n2', kind: 'teach', predict: 'Guess?', explain: 'One step [1] and a fake citation [7].', diagram: { nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] }, demo: 'play-box', refs: [1, 7, 'x'], check: { kind: 'choice', prompt: 'Which?', options: ['p', 'q', 'r'], answer: 1 }, props: ['Claim A holds.', '<i>Claim B</i> holds.'] },
  ...over
});

test('parseStep: a clean step; refs and citations limited to provided references; demo whitelisted', () => {
  const r = C.parseStep(goodStep(), { nodeId: 'n2', nextId: 'n3', demoIds: ['play-box'], refCount: 2, id: 'st9' });
  assert.equal(r.nodeDone, false);
  assert.equal(r.grade, undefined);
  assert.equal(r.step.id, 'st9');
  assert.equal(r.step.nodeId, 'n2');
  assert.equal(r.step.kind, 'teach');
  assert.equal(r.step.explain, 'One step [1] and a fake citation .');
  assert.deepEqual(r.step.refs, [1]);
  assert.equal(r.step.demo, 'play-box');
  assert.equal(r.step.check.answer, 1);
  assert.deepEqual(r.step.props, ['Claim A holds.', 'Claim B holds.']);
  assert.equal(r.step.diagram.nodes.length, 2);
  assert.equal(C.parseStep(goodStep(), { nodeId: 'n2', demoIds: ['other'] }).step.demo, undefined);
  const badDiagram = C.parseStep(goodStep({ step: { ...goodStep().step, diagram: '<svg onload=x>' } }), { nodeId: 'n2' });
  assert.equal(badDiagram.step.diagram, undefined, 'an unusable diagram is dropped, not fatal');
});

test('parseStep enforces repair after a wrong or guessed answer, whatever the model says', () => {
  const wrong = C.parseStep(goodStep({ grade: { correct: false, feedback: 'No', misconception: 'thinks X' }, nodeDone: true, step: { ...goodStep().step, node: 'n3', kind: 'teach' } }), { nodeId: 'n2', nextId: 'n3', lastConfidence: 'sure' });
  assert.equal(wrong.grade.correct, false);
  assert.equal(wrong.grade.misconception, 'thinks X');
  assert.equal(wrong.nodeDone, false);
  assert.equal(wrong.step.kind, 'repair');
  assert.equal(wrong.step.nodeId, 'n2');
  const guessed = C.parseStep(goodStep({ grade: { correct: true, feedback: 'Yes' }, nodeDone: true }), { nodeId: 'n2', nextId: 'n3', lastConfidence: 'guess' });
  assert.equal(guessed.step.kind, 'repair');
  assert.equal(guessed.nodeDone, false);
  // The local choice grade wins over a model that calls a wrong pick right.
  const local = C.parseStep(goodStep({ grade: { correct: true, feedback: 'Yes' } }), { nodeId: 'n2', localCorrect: false, lastConfidence: 'sure' });
  assert.equal(local.grade.correct, false);
  assert.equal(local.step.kind, 'repair');
  // Right and sure, node done: the step moves on to the next node.
  const done = C.parseStep(goodStep({ grade: { correct: true, feedback: 'Yes' }, nodeDone: true, step: { ...goodStep().step, node: undefined } }), { nodeId: 'n2', nextId: 'n3', lastConfidence: 'sure' });
  assert.equal(done.nodeDone, true);
  assert.equal(done.step.nodeId, 'n3');
  assert.equal(done.step.kind, 'teach');
  // A model-named node outside {current, next} is ignored.
  assert.equal(C.parseStep(goodStep({ step: { ...goodStep().step, node: 'n99' } }), { nodeId: 'n2', nextId: 'n3' }).step.nodeId, 'n2');
});

test('parseStep: goal done may omit the step; otherwise step and check are required', () => {
  const end = C.parseStep({ grade: { correct: true, feedback: 'Done' }, nodeDone: true }, { nodeId: 'g', nextId: null, lastConfidence: 'sure' });
  assert.equal(end.nodeDone, true);
  assert.equal(end.step, null);
  assert.throws(() => C.parseStep({ grade: { correct: false }, nodeDone: true }, { nodeId: 'g', lastConfidence: 'sure' }), /[一-鿿]/, 'a wrong answer on the goal still needs a repair step');
  assert.throws(() => C.parseStep({ nodeDone: false }, { nodeId: 'n1' }), /[一-鿿]/);
  assert.throws(() => C.parseStep({ step: { explain: 'x' } }, { nodeId: 'n1' }), /检查题/);
  assert.throws(() => C.parseStep({ step: { explain: '', check: { prompt: 'q' } } }, { nodeId: 'n1' }), /[一-鿿]/);
  assert.throws(() => C.parseStep('text'), /[一-鿿]/);
  assert.throws(() => C.parseStep({ step: { kind: 'summary', explain: 'Wrap-up' } }, { nodeId: 'n1' }), /检查题/, 'a summary step without a check would leave nothing to answer');
  assert.equal(C.parseStep({ step: { kind: 'summary', explain: 'Wrap-up', check: { prompt: 'q' } } }, { nodeId: 'n1' }).step.kind, 'teach');
  const patch = C.parseStep(goodStep({ planPatch: { held: ['n4', '<x>'], add: [{ id: 'n9', label: 'Gap', unlocks: ['n2'] }, { label: '' }], remove: 'x' } }), { nodeId: 'n2' }).planPatch;
  assert.deepEqual(patch.held, ['n4', 'x']);
  assert.deepEqual(patch.add, [{ id: 'n9', label: 'Gap', deps: [], status: 'todo', unlocks: ['n2'] }]);
  assert.equal(C.parseStep(goodStep({ planPatch: { held: [] } }), { nodeId: 'n2' }).planPatch, undefined, 'an empty patch is dropped');
  const longStep = C.parseStep({ step: { explain: 'y'.repeat(9000), check: { prompt: 'q' }, props: Array(9).fill('p') } }, { nodeId: 'n1' });
  assert.ok(longStep.step.explain.length <= 2500);
  assert.ok(longStep.step.props.length <= 4);
});

test('parseGrade, parsePracticeItem and parsePracticeGrade', () => {
  assert.deepEqual(C.parseGrade({ correct: 'false', feedback: '<b>no</b>', misconception: 'm' }), { correct: false, feedback: 'no', misconception: 'm' });
  assert.throws(() => C.parseGrade({ feedback: 'x' }), /[一-鿿]/);
  const item = C.parsePracticeItem({ topic: 'Tunnelling', problem: 'A barrier doubles in width. What happens?', kind: 'choice', options: ['halves', 'squares', 'drops a lot'], answer: 2, hints: ['h1', 'h2', 'h3', 'h4'], solution: 'Exponential.' }, { propIds: ['p1', 'p2'], id: 'pi1' });
  assert.deepEqual(item, { id: 'pi1', propIds: ['p1', 'p2'], topic: 'Tunnelling', problem: 'A barrier doubles in width. What happens?', kind: 'choice', hints: ['h1', 'h2', 'h3'], solution: 'Exponential.', hintsUsed: 0, options: ['halves', 'squares', 'drops a lot'], expected: 2 });
  assert.equal(C.parsePracticeItem({ topic: 'tunnelling', problem: 'Use tunnelling to explain…', solution: 's', hints: [] }).namesTopic, true);
  assert.equal(C.parsePracticeItem({ problem: 'p', solution: 's', kind: 'short', answer: 'a' }).expected, 'a');
  assert.throws(() => C.parsePracticeItem({ problem: '', solution: 's' }), /[一-鿿]/);
  assert.throws(() => C.parsePracticeItem({ problem: 'p' }), /[一-鿿]/);
  assert.deepEqual(C.parsePracticeGrade({ correct: true, feedback: 'Good <img src=x onerror=1>' }), { correct: true, feedback: 'Good' });
  assert.throws(() => C.parsePracticeGrade({ correct: 'maybe' }), /[一-鿿]/);
});

test('parseExtraction and parseSummary', () => {
  const ex = C.parseExtraction({ props: ['A holds.', '<b>B holds.</b>', '', 5], chains: [{ premises: ['A holds.', 'C holds.'], conclusion: 'D follows.' }, { premises: [], conclusion: 'x' }, { premises: ['y'] }, 'junk'] });
  assert.deepEqual(ex.props, ['A holds.', 'B holds.', '5', 'C holds.', 'D follows.']);
  assert.deepEqual(ex.chains, [{ premises: ['A holds.', 'C holds.'], conclusion: 'D follows.' }]);
  assert.deepEqual(C.parseExtraction({}), { props: [], chains: [] });
  assert.throws(() => C.parseExtraction(null), /[一-鿿]/);
  assert.ok(C.parseExtraction({ props: Array.from({ length: 80 }, (_, i) => `p${i}`) }).props.length <= 40);
  const sm = C.parseSummary({ goalSentence: 'Now obvious.', props: ['P1.'], chains: [{ premises: ['P1.'], conclusion: 'P2.' }] });
  assert.deepEqual(sm, { goalSentence: 'Now obvious.', props: ['P1.', 'P2.'], chains: [{ premises: ['P1.'], conclusion: 'P2.' }] });
  assert.throws(() => C.parseSummary({ props: ['x'] }), /[一-鿿]/);
});

test('validators never let HTML through any string field', () => {
  const evil = '<img src=x onerror=alert(1)><script>alert(2)</script><b onclick="x()">t</b>';
  const all = [
    C.parseProbe({ goalRestated: evil, questions: [{ prompt: evil, options: [evil, evil], answer: 0, nodeHint: evil }] }),
    C.parsePlan({ nodes: [{ id: 'a', label: evil, detail: evil }], startNote: evil, grades: [{ id: 'q', correct: true, feedback: evil }] }),
    C.parseStep({ grade: { correct: true, feedback: evil, misconception: evil }, step: { predict: evil, explain: evil + 'x', diagram: { nodes: [{ id: 'a', label: evil + 'L' }], edges: [] }, check: { prompt: evil + 'q', options: [evil + '1', evil + '2'] }, props: [evil + 'p'] } }, { nodeId: 'a' }),
    C.parsePracticeItem({ topic: evil, problem: evil + 'p', options: [evil + 'o', 'k'], hints: [evil], solution: evil + 's' }),
    C.parseExtraction({ props: [evil + 'p'], chains: [{ premises: [evil + 'a'], conclusion: evil + 'c' }] }),
    C.parseSummary({ goalSentence: evil + 'g', props: [evil + 'p'] })
  ];
  const walk = (v) => { if (typeof v === 'string') assert.doesNotMatch(v, HAS_HTML, v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  all.forEach(walk);
});

// ── prompts ─────────────────────────────────────────────────────────────
function richSession() {
  const st = C.emptyState();
  const s = C.createSession(st, { goal: '我想弄懂为什么扫描隧道显微镜对针尖高度那么敏感'.repeat(3), files: [{ name: 'big.md', size: 60000, text: 'f'.repeat(60000) }, { name: 'b.py', size: 60000, text: 'print(1)\n'.repeat(6000) }, { name: 'c.txt', size: 50000, text: '字'.repeat(50000) }] }, { now: 1 });
  s.plan = planOf([node('n1', [], 'held', '波函数'), node('n2', ['n1'], 'done', '势垒'), node('n3', ['n2'], 'doing', '衰减长度'), node('n4', ['n3'], 'todo', '隧穿概率'), node('g', ['n4'], 'todo', 'STM 的灵敏度')], 'g');
  s.current = 'n3';
  for (let i = 0; i < 25; i++) s.steps.push({ id: `st${i}`, nodeId: i < 10 ? 'n2' : 'n3', kind: i % 4 === 3 ? 'repair' : 'teach', explain: `第 ${i} 步的讲解。`.repeat(60), check: { id: 'c', kind: 'choice', prompt: '哪一个？'.repeat(40), options: ['甲', '乙', '丙'], answer: 1 }, answer: { value: 1, confidence: 'sure', thinking: '因为'.repeat(300) }, graded: { correct: true, feedback: 'ok' }, props: ['命题'.repeat(50)] });
  const last = { id: 'stL', nodeId: 'n3', kind: 'teach', predict: '先猜猜？', predictAnswer: { value: '变小', thinking: '' }, explain: '衰减长度的讲解。'.repeat(80), check: { id: 'c', kind: 'choice', prompt: '势垒变宽一倍，透射会怎样？', options: ['减半', '变成平方', '大幅下降'], answer: 2 }, answer: { value: 0, confidence: 'sure', thinking: '我觉得是线性的'.repeat(40) } };
  s.steps.push(last);
  return { st, s, last };
}

const DEMOS = [
  { id: 'play-tunnel', path: 'qchem/index.html#play-tunnel', label: { zh: '隧穿', en: 'Tunnelling' }, desc: { zh: '调势垒宽度看透射', en: 'Change barrier width and watch transmission' }, keywords: ['tunnelling', '隧穿', '势垒'] },
  ...Array.from({ length: 20 }, (_, i) => ({ id: `demo-${i}`, label: { zh: `演示 ${i}`, en: `Demo ${i}` }, desc: { zh: '无关的演示'.repeat(10), en: 'unrelated demo' }, keywords: [] }))
];

test('every builder: TASK marker first, language named, JSON shape, roles, and compact size', () => {
  const { s, last } = richSession();
  const grounding = C.buildGrounding('章节正文。'.repeat(3000), Array.from({ length: 12 }, (_, i) => ({ title: `Ref ${i}`, url: `https://example.org/${i}`, type: 'paper', date: '2020', sources: ['Crossref'], excerpt: 'e'.repeat(500) })));
  const held = Array.from({ length: 40 }, (_, i) => `已掌握的命题 ${i}：` + '内容'.repeat(80));
  const cases = {
    probe: C.buildProbe({ goal: s.goal, grounding, held, files: s.files, lang: 'zh' }),
    plan: C.buildPlan({ goal: s.goal, grounding, held, probe: { questions: [{ id: 'q1', kind: 'choice', prompt: 'Q', options: ['a', 'b'], answer: 1, nodeHint: 'h' }, { id: 'q2', kind: 'short', prompt: 'Why', answer: 'because' }], answers: { q1: { value: 0, confidence: 'sure', thinking: 'I thought' }, q2: { value: 'idk', confidence: 'guess', thinking: '' } } }, lang: 'zh' }),
    teach: C.buildTeach({ session: s, node: 'n3', lastStep: last, held, grounding, demos: DEMOS, lang: 'zh' }),
    grade: C.buildGrade({ question: last.check, answer: last.answer, context: 'ctx', grounding, lang: 'zh' }),
    practice: C.buildPractice({ props: held.slice(0, 3), avoidTopics: ['a', 'b'], lang: 'zh' }),
    practiceGrade: C.buildPracticeGrade({ item: { problem: 'P', kind: 'choice', options: ['x', 'y'], expected: 1, hints: ['1', '2', '3'], hintsUsed: 2, solution: 'S'.repeat(5000) }, answer: { value: 0, confidence: 'fair', thinking: 't' }, lang: 'zh' }),
    extract: C.buildExtract({ text: 'n'.repeat(30000), lang: 'zh' }),
    summary: C.buildSummary({ session: s, lang: 'zh' }),
    photo: C.buildPhoto({ goal: s.goal, images: ['data:image/jpeg;base64,AAAA'], lang: 'zh' })
  };
  assert.deepEqual(Object.keys(cases).sort(), [...Object.keys(C.DEFAULT_PROMPTS), 'grade'].filter((v, i, a) => a.indexOf(v) === i).sort());
  for (const [task, msgs] of Object.entries(cases)) {
    assert.equal(msgs.length, 2, task);
    assert.deepEqual(msgs.map((m) => m.role), ['system', 'user'], task);
    assert.equal(msgs[0].content.split('\n')[0], `TASK: ${task}`, task);
    assert.match(msgs[0].content, /简体中文/, `${task} names the language`);
    assert.doesNotMatch(msgs[0].content, /\{lang\}/, task);
    assert.match(msgs[0].content, /\{"/, `${task} ends with a JSON shape`);
    assert.match(msgs[0].content, /never LaTeX/i, task);
    assert.match(msgs[0].content, /Never invent sources/i, task);
    assert.match(msgs[0].content, /No HTML/i, task);
    assert.match(textOf(msgs[1].content), /简体中文/, `${task}: reply-language reminder`);
    assert.ok(size(msgs) < 11000, `${task}: ${size(msgs)} chars must stay under ~11 000 (hosted quota cuts at 12 000)`);
  }
  // Teach keeps what matters when cutting.
  const teach = cases.teach[1].content;
  assert.match(teach, /LAST CHECK:/);
  assert.match(teach, /势垒变宽一倍/);
  assert.match(teach, /learner: A\) 减半 — sure/);
  assert.match(teach, /expected: C\) 大幅下降/);
  assert.match(teach, /choice check: wrong/);
  assert.match(teach, /NODE:\nn3: 衰减长度/);
  assert.match(teach, /NEXT NODE:\nn4: 隧穿概率/);
  assert.match(teach, /n3 \[doing\] 衰减长度 ← n2 {3}<= CURRENT/);
  assert.match(teach, /play-tunnel — /, 'the most relevant demo is listed');
  assert.ok((teach.match(/^demo-\d+ — /gm) || []).length <= 7, 'at most 8 demos');
  assert.match(teach, /GROUNDING/);
  // Plan carries confidence and thinking from the probe.
  const plan = cases.plan[1].content;
  assert.match(plan, /q1 \[probes: h\]/);
  assert.match(plan, /learner: A\) a — sure\nthinking: I thought/);
  assert.match(plan, /learner: idk — guessing/);
  assert.match(plan, /choice check: wrong/);
  // English sessions say English everywhere.
  for (const msgs of [C.buildProbe({ goal: 'g', lang: 'en' }), C.buildTeach({ session: s, node: 'n3', lang: 'en' })]) {
    assert.match(msgs[0].content, /in English/);
    assert.doesNotMatch(msgs[0].content, /简体中文/);
    assert.match(msgs[1].content, /Reply in English/);
  }
});

test('buildTeach / teachContext: next node, last check, first step without a check', () => {
  const { s, last } = richSession();
  const ctx = C.teachContext({ session: s, node: 'n3' });
  assert.equal(ctx.nodeId, 'n3');
  assert.equal(ctx.nextId, 'n4');
  assert.equal(ctx.last, last, 'defaults to the session\'s last step');
  assert.equal(ctx.localCorrect, false);
  assert.equal(ctx.lastConfidence, 'sure');
  const atGoal = C.teachContext({ session: s, node: 'g', lastStep: null });
  assert.equal(atGoal.nextId, null);
  assert.equal(atGoal.last, null);
  // An unfinished prerequisite is still what comes next…
  assert.equal(C.teachContext({ session: s, node: 'n4', lastStep: null }).nextId, 'n3');
  // …once it is done, the goal follows n4.
  s.plan = C.setNodeStatus(s.plan, 'n3', 'done');
  const first = C.buildTeach({ session: s, node: 'n4', lastStep: null, lang: 'zh' });
  assert.doesNotMatch(first[1].content, /LAST CHECK:/);
  assert.match(first[1].content, /NEXT NODE:\ng: STM/);
  const goal = C.buildTeach({ session: s, node: 'g', lastStep: null, lang: 'zh' });
  assert.match(goal[1].content, /NEXT NODE:\nnone — NODE is the goal/);
  // Defaults: no node given → session.current
  assert.equal(C.teachContext({ session: s }).nodeId, 'n3');
  // An empty session does not throw.
  assert.doesNotThrow(() => C.buildTeach({ session: {}, lang: 'zh' }));
});

test('buildGrounding keeps within budget, numbers references, and builders do not repeat them', () => {
  const refs = Array.from({ length: 12 }, (_, i) => ({ title: `<b>Paper ${i + 1}</b>`, type: 'paper', date: '2021', sources: ['Crossref', 'OpenAlex', 'x'], url: `https://e.org/${i}`, excerpt: 'Excerpt text.' }));
  const g = C.buildGrounding('正文'.repeat(5000), refs, 6000);
  assert.ok(g.length <= 6000);
  assert.match(g, /REFERENCES \(cite as \[n\]\):\n\[1\] Paper 1 \(paper, 2021\) — Crossref, OpenAlex/);
  assert.doesNotMatch(g, /\[9\]/, 'at most 8 references');
  assert.doesNotMatch(g, /<b>/);
  assert.equal(C.buildGrounding('short', [], 6000), 'short');
  assert.ok(C.buildGrounding('x'.repeat(10000), refs, 1000).length <= 1000);
  const msgs = C.buildProbe({ goal: 'g', grounding: g, refs, lang: 'zh' });
  assert.equal((msgs[1].content.match(/REFERENCES \(cite as/g) || []).length, 1);
  assert.match(msgs[1].content, /\[1\] Paper 1/, 'references survive even when the chapter is long');
  const sep = C.buildProbe({ goal: 'g', grounding: 'Chapter text.', refs: refs.slice(0, 2), lang: 'zh' });
  assert.match(sep[1].content, /\[2\] Paper 2/);
});

test('effectivePrompts merges overrides; builders use them but keep the TASK marker', () => {
  const eff = C.effectivePrompts({ teach: 'My own teach prompt in {lang}.', probe: '   ', bogus: 'x', plan: 5 });
  assert.equal(eff.teach, 'My own teach prompt in {lang}.');
  assert.equal(eff.probe, C.DEFAULT_PROMPTS.probe);
  assert.equal(eff.plan, C.DEFAULT_PROMPTS.plan);
  assert.ok(!('bogus' in eff));
  assert.deepEqual(C.effectivePrompts(null), C.DEFAULT_PROMPTS);
  const m = C.buildTeach({ session: {}, lang: 'en', prompts: { teach: 'TASK: something else\nMy own teach prompt in {lang}.' } });
  assert.equal(m[0].content, 'TASK: teach\nMy own teach prompt in English.');
  assert.ok(C.effectivePrompts({ extract: 'y'.repeat(20000) }).extract.length <= 8000);
});

test('default prompts: each one ends with its JSON shape, and the shapes parse through the validators', () => {
  const shapes = {};
  for (const [k, p] of Object.entries(C.DEFAULT_PROMPTS)) {
    assert.match(p, /\{lang\}/, `${k} has the language placeholder`);
    assert.doesNotMatch(p, UPSTREAM);
    const json = p.split('\n').find((l) => l.startsWith('{"'));
    assert.ok(json, `${k} has a one-line JSON example`);
    shapes[k] = JSON.parse(json.replace(/…/g, 'text'));
  }
  assert.equal(C.parseProbe(shapes.probe).questions.length, 2);
  assert.equal(C.parsePlan(shapes.plan).nodes.length, 2);
  const step = C.parseStep(shapes.teach, { nodeId: 'n3', nextId: 'n4', lastConfidence: 'sure', refCount: 3, demoIds: ['text'] });
  assert.equal(step.step.kind, 'repair', 'the example grade is wrong, so a repair');
  assert.equal(step.planPatch.add[0].unlocks[0], 'n3');
  assert.equal(C.parseGrade(shapes.grade).correct, true);
  assert.equal(C.parsePracticeItem(shapes.practice).expected, 2);
  assert.equal(C.parsePracticeGrade(shapes.practiceGrade).correct, true);
  assert.equal(C.parseExtraction(shapes.extract).chains.length, 1);
  assert.equal(C.parseSummary(shapes.summary).goalSentence, 'text');
  // The teaching rules that matter are in the teach prompt.
  const t = C.DEFAULT_PROMPTS.teach;
  for (const rx of [/one reasoning step/i, /repair/, /SAME point/, /Never build on a point that has not passed its check/, /tests exactly this step/, /No preamble/, /nodeDone/]) assert.match(t, rx);
  assert.match(C.DEFAULT_PROMPTS.practice, /Do not name the topic/);
  assert.match(C.DEFAULT_PROMPTS.probe, /frontier/);
});

// ── usage ───────────────────────────────────────────────────────────────
test('addUsage sums cost and tokens; unknown pricing counts tokens only and marks unpriced', () => {
  const st = C.emptyState(), s = C.createSession(st, { goal: 'g' }, { now: 1 });
  assert.deepEqual(C.addUsage(st, s, { cost: 0.0012, usage: { total_tokens: 900 } }), { cost: 0.0012, tokens: 900 });
  C.addUsage(st, s, { cost: null, usage: { prompt_tokens: 100, completion_tokens: 50 } });
  C.addUsage(st, null, { cost: 0.001, usage: null });
  C.addUsage(st, s, null);
  assert.equal(st.usage.calls, 4);
  assert.equal(st.usage.tokens, 1050);
  assert.ok(Math.abs(st.usage.cost - 0.0022) < 1e-12);
  assert.equal(st.usage.unpriced, true);
  assert.equal(s.usage.calls, 3);
  assert.equal(s.usage.tokens, 1050);
  assert.ok(Math.abs(s.usage.cost - 0.0012) < 1e-12);
  assert.equal(s.usage.unpriced, true);
  const fresh = C.emptyState();
  C.addUsage(fresh, null, { cost: 0.5, usage: { total_tokens: 10 } });
  assert.equal(fresh.usage.unpriced, undefined);
  assert.deepEqual(C.migrate(st).usage, st.usage, 'usage survives a save/load round trip');
});

test('a whole session survives JSON round trip through migrate', () => {
  const { st, s } = richSession();
  s.phase = 'teach';
  s.probe = { questions: [{ id: 'q1', kind: 'choice', prompt: 'Q', options: ['a', 'b'], answer: 0, nodeHint: 'h' }], answers: { q1: { value: 0, confidence: 'guess', thinking: 't', correct: true, feedback: 'f' } }, goalRestated: 'G' };
  s.practice.items.push(C.parsePracticeItem({ topic: 'T', problem: 'P', kind: 'short', answer: 'A', hints: ['1', '2', '3'], solution: 'S' }, { id: 'pi1', propIds: ['x'] }));
  s.summary = { goalSentence: 'Obvious now.', props: ['P1.'], chains: [] };
  C.addChain(st, ['A premise is true.'], 'A conclusion is true.', s.id, { now: 5 });
  const back = C.migrate(JSON.stringify(st));
  assert.deepEqual(back, C.migrate(st));
  const b = back.sessions[0];
  assert.equal(b.steps.length, s.steps.length);
  assert.equal(b.current, 'n3');
  assert.deepEqual(b.plan, s.plan);
  assert.deepEqual(b.probe, s.probe);
  assert.equal(b.practice.items[0].expected, 'A');
  assert.equal(b.summary.goalSentence, 'Obvious now.');
  assert.equal(back.chains.length, 1);
});

test('parseStep: a finished goal ends the session even when the reply still carries a step', () => {
  const r = C.parseStep(goodStep({ grade: { correct: true, feedback: 'ok' }, nodeDone: true }), { nodeId: 'g', nextId: null, lastConfidence: 'sure' });
  assert.equal(r.nodeDone, true);
  assert.equal(r.step, null);
  // a repair on the goal keeps the step
  const rep = C.parseStep(goodStep({ grade: { correct: false, feedback: 'no' }, nodeDone: true }), { nodeId: 'g', nextId: null, lastConfidence: 'sure' });
  assert.equal(rep.nodeDone, false);
  assert.equal(rep.step.kind, 'repair');
});

test('parseStep: a short check only the model can grade must come back graded', () => {
  assert.throws(() => C.parseStep(goodStep(), { nodeId: 'n1', localCorrect: null, needGrade: true }), /评分/);
  assert.equal(C.parseStep(goodStep({ grade: { correct: false, feedback: 'x' } }), { nodeId: 'n1', needGrade: true, lastConfidence: 'sure' }).step.kind, 'repair');
  assert.equal(C.parseStep(goodStep(), { nodeId: 'n1', localCorrect: true, needGrade: false }).grade, undefined);
});

test('choiceIndex via parseProbe: option text wins over a leading article “A ”', () => {
  const q = (answer) => C.parseProbe({ questions: [{ kind: 'choice', prompt: 'p', options: ['The energy rises', 'The energy falls', 'A node appears'], answer }] }).questions[0].answer;
  assert.equal(q('A node appears'), 2);
  assert.equal(q('a node appears'), 2);
  assert.equal(q('B'), 1);
  assert.equal(q('(c)'), 2);
  assert.equal(q('C.'), 2);
  assert.equal(q('B) The energy falls'), 1);
  assert.equal(q('A) A node appears'), 2, 'letter and text disagree: the text decides');
  assert.equal(q('A thing not listed'), undefined);
  assert.equal(C.gradeChoice({ kind: 'choice', options: ['The energy rises', 'The energy falls', 'A node appears'], answer: 2 }, 'A node appears'), true);
});

test('similar: claims that differ only in a number stay apart', () => {
  assert.equal(C.similar('The hydrogen ground state energy is -13.6 eV', 'The hydrogen ground state energy is -3.4 eV'), false);
  assert.equal(C.similar('The ground-state energy scales as 1/L²', 'The ground-state energy scales as L²'), false);
  assert.equal(C.similar('The ground-state energy scales as 1/L².', 'the ground state energy scales as 1/L²'), true);
  const st = C.emptyState();
  assert.equal(C.addProps(st, ['The hydrogen ground state energy is -13.6 eV', 'The hydrogen ground state energy is -3.4 eV'], 's1').length, 2);
});

test('applyPlanPatch: an added node that would close a cycle loses its own edge, not the plan’s', () => {
  const plan = C.normalizePlan({ nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', deps: ['a'] }, { id: 'g', label: 'G', deps: ['b'] }], goalId: 'g' });
  const p = C.applyPlanPatch(plan, { add: [{ id: 'x', label: 'X', deps: ['g'], unlocks: ['a'] }] });
  const deps = Object.fromEntries(p.nodes.map((n) => [n.id, n.deps]));
  assert.deepEqual(deps.b, ['a']);
  assert.deepEqual(deps.g, ['b']);
  assert.deepEqual(deps.a, []);
  // merging deps into an existing node: a dep that would close a cycle is skipped
  const q = C.applyPlanPatch(plan, { add: [{ id: 'a', label: 'A', deps: ['g'] }] });
  assert.deepEqual(q.nodes.find((n) => n.id === 'a').deps, []);
  assert.deepEqual(q.nodes.find((n) => n.id === 'b').deps, ['a']);
  // a legitimate unlock still works
  const r = C.applyPlanPatch(plan, { add: [{ id: 'x', label: 'X', unlocks: ['b'] }] });
  assert.deepEqual(r.nodes.find((n) => n.id === 'b').deps.sort(), ['a', 'x']);
});

test('reserved ids are refused: __proto__, constructor and other Object.prototype names', () => {
  const pr = C.parseProbe({ questions: [{ id: '__proto__', kind: 'short', prompt: 'p1' }, { id: 'constructor', kind: 'short', prompt: 'p2' }, { id: 'ok', kind: 'short', prompt: 'p3' }] });
  assert.deepEqual(pr.questions.map((q) => q.id), ['q1', 'q2', 'ok']);
  const st = C.migrate({ sessions: [{ id: 's1', phase: 'teach', steps: [{ explain: 'e', demo: 'constructor', check: { prompt: 'c' } }, { explain: 'e', demo: 'toString' }, { explain: 'e', demo: 'play-box' }] }] }, { isDemo: (id) => id === 'play-box' });
  assert.deepEqual(st.sessions[0].steps.map((x) => x.demo), [undefined, undefined, 'play-box']);
  const raw = JSON.parse('{"sessions":[{"id":"s1","probe":{"questions":[{"id":"__proto__","prompt":"p"}],"answers":{"__proto__":{"value":"v"}}}}]}');
  const m = C.migrate(raw);
  assert.equal(m.sessions[0].probe.questions[0].id, 'q1');
  assert.equal(Object.getPrototypeOf(m.sessions[0].probe.answers), Object.prototype);
});

test('photos: one user turn of text and images; the transcript comes back as a file-sized text and a goal', () => {
  const imgs = Array.from({ length: 6 }, (_, i) => `data:image/jpeg;base64,A${i}`);
  const m = C.buildPhoto({ goal: '', images: imgs, lang: 'en' });
  assert.equal(m[1].content[0].type, 'text');
  assert.match(m[1].content[0].text, /4 photos attached/);
  assert.deepEqual(m[1].content.slice(1).map((p) => p.image_url.url), imgs.slice(0, 4), 'at most 4 photos');
  assert.doesNotMatch(m[1].content[0].text, /GOAL/, 'an empty goal is left out');
  assert.match(C.buildPhoto({ goal: '弄懂这道题', images: imgs.slice(0, 1), lang: 'zh' })[1].content[0].text, /GOAL[^\n]*\n弄懂这道题/);
  assert.match(C.DEFAULT_PROMPTS.photo, /Do not solve/);
  const p = C.parsePhoto({ transcript: '<b>题 3</b>\r\n求 ψ(x) 的归一化常数。' + 'x'.repeat(70000), goal: '弄懂<script>归一化</script>' });
  assert.ok(p.transcript.startsWith('题 3\n求 ψ(x)'), 'tags stripped, line ends normalised');
  assert.ok(p.transcript.length <= C.FILE_RULES.maxBytes);
  assert.doesNotMatch(p.goal, /</);
  assert.throws(() => C.parsePhoto({ transcript: '  ' }), /没有从照片里读出文字/);
  assert.throws(() => C.parsePhoto('text'), /格式不对/);
});
