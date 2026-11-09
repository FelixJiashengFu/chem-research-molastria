// Tests for 量子嘉年华 · 量子物理: the four demo models against analytic results, and the content's integrity
// (both languages present, every formula, paper, book, video, demo and pavilion link resolves, MathML up to date).
//   node --test tools/quantum-physics-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const load = (file) => { const box = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/quantum/${file}`, import.meta.url), 'utf8'), box); return box.window; };
const M = load('physics/qp-models.js').MOLASTRIA_QP_MODELS;
const D = load('physics/qp-data.js').MOLASTRIA_QP;
const MATH = load('physics/qp-math.js').MOLASTRIA_QP_MATH;
const SECTIONS = load('sections.js').MOLASTRIA_QUANTUM_SECTIONS;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('stationary states: harmonic oscillator and Morse levels match the exact formulas', () => {
  for (const omega of [0.6, 1, 1.6]) {
    const { states } = M.states('harmonic', { omega });
    states.forEach((s, n) => close(s.E, omega * (n + 0.5), 2e-3, `HO ω=${omega} n=${n}`));
  }
  const p = { D: 10 }, { states } = M.states('morse', p);
  for (let n = 0; n < 4; n++) close(states[n].E, M.exact.morse(n, p), 5e-3, `Morse n=${n}`);
  for (let n = 1; n < 5; n++) assert.ok(states[n + 1].E - states[n].E < states[n].E - states[n - 1].E, 'Morse spacing shrinks');
});

test('stationary states: eigenvectors are normalised, have n nodes, and the double-well splitting shrinks as the wells separate', () => {
  const { x, states } = M.states('harmonic', { omega: 1 }), h = x[1] - x[0];
  states.forEach((s, n) => {
    close(s.psi.reduce((t, v) => t + v * v, 0) * h, 1, 1e-6, `‖ψ${n}‖`);
    let nodes = 0; for (let i = 1; i < s.psi.length; i++) if (Math.abs(s.psi[i]) > 1e-4 && Math.abs(s.psi[i - 1]) > 1e-4 && s.psi[i] * s.psi[i - 1] < 0) nodes++;
    assert.equal(nodes, n, `ψ${n} has ${n} nodes`);
  });
  const split = (b) => { const s = M.states('double', { b }).states; return s[1].E - s[0].E; };
  assert.ok(split(1.2) > split(1.6) && split(1.6) > split(2.0) && split(2.0) > 0, 'splitting decreases with separation');
});

test('tunnelling: square-barrier transmission is a probability, matches the thick-barrier limit, and favours light isotopes', () => {
  for (const E of [0.1, 0.5, 0.99, 1.01, 2, 5]) { const t = M.transmission(E, 1, 3, M.MASS.e); assert.ok(t > 0 && t <= 1 + 1e-12, `0 < T ≤ 1 at E=${E}`); }
  // Above the barrier, T = 1 exactly when ka = nπ (resonance)
  const m = M.MASS.e, V0 = 1, a = 3, k = Math.PI / a, E = V0 + M.HB2M * k * k / m;
  close(M.transmission(E, V0, a, m), 1, 1e-9, 'resonance');
  // Thick barrier: T → 16 (E/V0)(1−E/V0) e^{−2κa}
  const Et = 0.4, kappa = Math.sqrt((V0 - Et) * m / M.HB2M), aT = 8, asym = 16 * Et * (1 - Et) * Math.exp(-2 * kappa * aT);
  close(M.transmission(Et, V0, aT, m) / asym, 1, 5e-3, 'thick-barrier limit (corrections ~e^{−2κa})');
  assert.ok(M.transmission(0.3, 0.5, 1, M.MASS.p) / M.transmission(0.3, 0.5, 1, M.MASS.d) > 10, 'H tunnels far more than D');
});

test('tunnelling: Crank–Nicolson keeps the norm and the packet transmits the energy-averaged T(E)', () => {
  const x = M.grid(80, 1600), h = x[1] - x[0], aau = 1, V = x.map((v) => (Math.abs(v) <= aau / 2 ? 1 : 0));
  const k0 = 1.3, sigma = 4, psi = M.packet(x, -25, k0, sigma), step = M.cnStepper(x, V, 0.05);
  close(M.norm(psi, h), 1, 1e-12, 'initial norm');
  step(psi, 900);
  close(M.norm(psi, h), 1, 1e-9, 'norm after 900 steps');
  close(M.weightRight(x, psi, aau / 2), M.packetTransmission(k0, sigma, 1, aau), 0.01, 'transmitted weight');
});

test('Stern–Gerlach: Malus-type law, and the 0°, 90°, 0° chain lets a quarter of the atoms through', () => {
  const r = Math.PI / 180;
  close(M.pass(0, 0), 1, 1e-15, 'same axis'); close(M.pass(0, Math.PI), 0, 1e-15, 'opposite'); close(M.pass(0, 90 * r), 0.5, 1e-15, 'perpendicular');
  close(M.chain([0, 90 * r, 0]), 0.25, 1e-15, 'erasure chain'); close(M.chain([0, 0, Math.PI]), 0, 1e-15, 'no return without the middle device');
  const [n1, n2, n3] = M.runChain([0, 90 * r, 0], 20000, M.rng(1));
  assert.equal(n1, 20000); close(n2 / n1, 0.5, 0.02, 'sampled device 2'); close(n3 / n1, 0.25, 0.02, 'sampled device 3');
});

test('CHSH: quantum S reaches −2√2 at the optimal angles, the hidden-variable model never beats 2, sampling agrees', () => {
  const r = Math.PI / 180, best = [0, 90, 45, 135].map((v) => v * r);
  close(M.S(M.Eqm, ...best), -2 * Math.SQRT2, 1e-12, 'Tsirelson');
  close(M.S(M.Elhv, ...best), -2, 1e-12, 'LHV at the same angles');
  const rand = M.rng(3);
  for (let i = 0; i < 2000; i++) { const ang = [0, 0, 0, 0].map(() => rand() * Math.PI); assert.ok(Math.abs(M.S(M.Elhv, ...ang)) <= 2 + 1e-12, 'LHV bound'); assert.ok(Math.abs(M.S(M.Eqm, ...ang)) <= 2 * Math.SQRT2 + 1e-12, 'Tsirelson bound'); }
  close(M.sampleE(0, 60 * r, 40000, M.rng(5)), -0.5, 0.02, 'sampled E(60°)');
  close(M.sampleE(0, 60 * r, 40000, M.rng(6), 'lhv'), M.Elhv(0, 60 * r), 0.02, 'sampled LHV E(60°)');
});

const both = (t, where) => { assert.ok(t && typeof t.zh === 'string' && t.zh.trim() && typeof t.en === 'string' && t.en.trim(), `${where}: needs zh and en`); assert.ok(!/[一-鿿]/.test(t.en), `${where}: Chinese left in English`); };

test('content: every chapter has both languages and resolves its formulas, papers, books, videos, demos and links', () => {
  const P = new Set(D.papers.map((p) => p.id)), B = new Set(D.books.map((b) => b.id)), V = new Set(D.videos.map((v) => v.id)), S = new Set(D.stages.map((s) => s.id));
  const halls = new Set(SECTIONS.map((s) => s.id));
  assert.equal(D.chapters.length, 12);
  assert.equal(new Set(D.chapters.map((c) => c.id)).size, 12, 'unique chapter ids');
  for (const c of D.chapters) {
    assert.ok(S.has(c.stage), `${c.id}: stage`);
    for (const k of ['name', 'tagline']) both(c[k], `${c.id}.${k}`);
    for (const k of ['explain', 'inChem', 'checks', 'pitfalls']) { assert.ok(c[k].length, `${c.id}.${k}`); c[k].forEach((t, i) => both(t, `${c.id}.${k}[${i}]`)); }
    c.outline.forEach(([t], i) => both(t, `${c.id}.outline[${i}]`));
    both(c.practice.title, `${c.id}.practice.title`); both(c.practice.body, `${c.id}.practice.body`); assert.ok(c.practice.code.includes('print('), `${c.id}: code`);
    for (const f of c.formulas) { assert.ok(D.math[f], `${c.id}: formula ${f}`); assert.ok(MATH[f], `${c.id}: MathML ${f}`); }
    for (const id of c.papers) assert.ok(P.has(id), `${c.id}: paper ${id}`);
    for (const id of c.books) assert.ok(B.has(id), `${c.id}: book ${id}`);
    for (const id of c.videos) assert.ok(V.has(id), `${c.id}: video ${id}`);
    for (const d of c.demos || []) assert.ok(['d1', 'd2', 'd3', 'd4'].includes(d), `${c.id}: demo ${d}`);
    for (const [hall, , t] of c.links || []) { assert.ok(halls.has(hall) && hall !== 'physics', `${c.id}: pavilion ${hall}`); both(t, `${c.id}.links`); }
  }
  for (const t of D.timeline) { assert.ok(P.has(t.paper), `timeline ${t.y}: paper`); assert.ok(D.chapters.some((c) => c.id === t.ch), `timeline ${t.y}: chapter`); both(t.t, `timeline ${t.y}`); }
  for (const b of D.books) { both(b.note, `book ${b.id}`); assert.ok(D.roles[b.role] && D.levels[b.level], `book ${b.id}: role/level`); assert.ok(!b.free || b.url, `book ${b.id}: free needs a url`); }
  for (const v of D.videos) { both(v.note, `video ${v.id}`); assert.ok(/^https:\/\//.test(v.url), `video ${v.id}: url`); }
  for (const p of D.papers) assert.ok(/^10\.\d{4,}\//.test(p.doi) && p.y >= 1900 && p.y <= 2026, `paper ${p.id}`);
  for (const k of ['quote', 'lead', 'honesty']) both(D.hero[k], `hero.${k}`);
});

test('content: every paper is cited somewhere, nothing is listed twice, and qp-math.js is up to date', () => {
  const cited = new Set([...D.chapters.flatMap((c) => c.papers), ...D.timeline.map((t) => t.paper)]);
  for (const p of D.papers) assert.ok(cited.has(p.id), `paper ${p.id} is not cited`);
  for (const list of [D.papers, D.books, D.videos]) assert.equal(new Set(list.map((x) => x.id)).size, list.length, 'unique ids');
  assert.equal(new Set(D.papers.map((p) => p.doi.toLowerCase())).size, D.papers.length, 'unique DOIs');
  assert.deepEqual(Object.keys(MATH).sort(), Object.keys(D.math).sort(), 'run node tools/fundamental-math.mjs');
  for (const [k, [tex]] of Object.entries(D.math)) assert.ok(MATH[k].includes(tex.trim().slice(0, 12).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) || MATH[k].includes('<annotation'), `${k}: MathML stale`);
});

test('hub: the physics pavilion is live and every pavilion block is complete', () => {
  assert.ok(SECTIONS.find((s) => s.id === 'physics').live, 'physics live');
  for (const s of SECTIONS) { both(s.title, `${s.id}.title`); both(s.blurb, `${s.id}.blurb`); }
});
