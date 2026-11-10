// Tests for the formula-answer questions: the grader in public/viewer/formula-check.js (decisions checked with a
// plain-JS engine, so no npm packages are needed; the built-in parser), the question banks
// public/fundamental-science/math/fm-quiz.js and public/quantum/physics/qp-quiz.js (both languages, hints, symbols,
// every common mistake graded as itself, MathML up to date), and an independent numerical check of every answer
// (quadrature, diagonalisation, ODE integration, counting) that does not reuse the closed form.
//   node --test tools/formula-check-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const F = createRequire(import.meta.url)('../public/viewer/formula-check.js');
const load = (file) => { const box = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8'), box); return box.window; };
const FMQ = load('fundamental-science/math/fm-quiz.js').MOLASTRIA_FM_QUIZ;
const QPQ = load('quantum/physics/qp-quiz.js').MOLASTRIA_QP_QUIZ;
const FMQ_MATH = load('fundamental-science/math/fm-quiz-math.js').MOLASTRIA_FM_QUIZ_MATH;
const QPQ_MATH = load('quantum/physics/qp-quiz-math.js').MOLASTRIA_QP_QUIZ_MATH;
const FM = load('fundamental-science/math/fm-data.js').MOLASTRIA_FM;
const QP = load('quantum/physics/qp-data.js').MOLASTRIA_QP;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const B = F.basicEngine;

// ── the grader's decisions, with a plain-JS engine ─────────────────────────────────────
const table = {
  'x/2': [['x'], (s) => s.x / 2], 'x*0.5': [['x'], (s) => 0.5 * s.x], x: [['x'], (s) => s.x], '+x': [['x'], (s) => s.x], '-x': [['x'], (s) => -s.x],
  '2x': [['x'], (s) => 2 * s.x], y: [['y'], (s) => s.y], 3: [[], () => 3], '0.50001x': [['x'], (s) => 0.50001 * s.x], '0.6x': [['x'], (s) => 0.6 * s.x],
  sing: [['x'], (s) => (s.x < 1 ? Infinity : 1 / s.x)], inv: [['x'], (s) => 1 / s.x], spoil: [['x'], (s) => (s.x < 1 ? NaN : 1 / s.x)], never: [['x'], () => NaN],
  hb2: [['hbar'], (s) => 2 * s.hbar], '2pihbar': [['hbar'], (s) => 2 * Math.PI * s.hbar], 'h/pi': [['h'], (s) => s.h / Math.PI], 'h/2': [['h'], (s) => s.h / 2],
  n2: [['n'], (s) => s.n * s.n], '2n-1': [['n'], (s) => 2 * s.n - 1], n: [['n'], (s) => s.n], nn: [['n'], (s) => s.n ** 2],
};
const plain = {
  parse(src) { const k = src.replace(/\s+/g, ''); if (!Object.prototype.hasOwnProperty.call(table, k)) throw new Error('syntax'); const [syms, f] = table[k]; return { symbols: new Set(syms), f }; },
  evaluate(x, s) { return [x.f(s), 0]; },
};

test('grader: correct, a matching common mistake, wrong, and the helpful in-between verdicts', () => {
  const q = { id: 't1', answer: 'x/2', vars: { x: '+' }, wrong: [{ a: 'x' }] };
  const v = (s) => F.check(s, q, plain);
  assert.deepEqual(v('x*0.5'), { verdict: 'correct' });
  assert.deepEqual(v('x'), { verdict: 'misconception', index: 0 });
  assert.deepEqual(v('2x'), { verdict: 'wrong' });
  assert.deepEqual(v('y'), { verdict: 'symbols', symbols: ['y'] });
  assert.deepEqual(v('3'), { verdict: 'missing', symbols: ['x'] });
  assert.deepEqual(v('0.50001x'), { verdict: 'close' }, 'a decimal within 0.5 % is "close", not correct');
  assert.deepEqual(v('0.6x'), { verdict: 'wrong' });
  assert.deepEqual(v('   '), { verdict: 'empty' });
  assert.deepEqual(v(String.raw`x^{\placeholder{}}`), { verdict: 'placeholder' });
  assert.deepEqual(v('x/'), { verdict: 'syntax' });
  assert.deepEqual(v('E = x/2'), { verdict: 'correct' }, 'a left-hand side is dropped');
  assert.deepEqual(v(String.raw`E \approx x/2.`), { verdict: 'correct' }, 'and so are ≈ and a full stop');
});

test('grader: lists are unordered, ± expands, the count is checked, wrapping braces are dropped', () => {
  const q = { id: 't2', answer: 'x,-x', vars: { x: '+' }, wrong: [{ a: 'x,x' }] };
  const v = (s) => F.check(s, q, plain);
  assert.equal(v('-x, x').verdict, 'correct');
  assert.equal(v(String.raw`\pm x`).verdict, 'correct');
  assert.equal(v('+-x').verdict, 'correct');
  assert.equal(v(String.raw`\{x, -x\}`).verdict, 'correct');
  assert.equal(v('(x, -x)').verdict, 'correct');
  assert.deepEqual(v('x, x'), { verdict: 'misconception', index: 0 });
  assert.deepEqual(v('x'), { verdict: 'count', expected: 2 });
  assert.deepEqual(v('x; -x'), { verdict: 'correct' });
  assert.deepEqual(F.check('x, -x', { id: 't3', answer: 'x', vars: { x: '+' }, wrong: [] }, plain), { verdict: 'count', expected: 1 });
});

test('grader: points where the reference is singular are skipped, a candidate that fails elsewhere is wrong', () => {
  const q = { id: 't4', answer: 'sing', vars: { x: [0.5, 2] }, wrong: [] };
  assert.equal(F.check('inv', q, plain).verdict, 'correct', 'agrees wherever the reference is finite');
  assert.equal(F.check('never', q, plain).verdict, 'wrong', 'NaN where the reference is finite');
  assert.equal(F.check('sing', { id: 't5', answer: 'inv', vars: { x: [0.5, 2] }, wrong: [] }, plain).verdict, 'wrong', 'Infinity where the reference is finite');
  assert.notEqual(F.check('inv', { id: 't6', answer: 'never', vars: { x: '+' }, wrong: [] }, plain).verdict, 'correct', 'needs enough usable points');
  assert.equal(F.check('inv', { id: 't7', answer: 'spoil', vars: { x: [0.5, 2] }, wrong: [] }, plain).verdict, 'correct');
});

test('grader: a symbolic "equal" from the engine is trusted for the answer only, and a throwing one falls back to numbers', () => {
  const q = { id: 't8', answer: 'x/2', vars: { x: '+' }, wrong: [{ a: 'x' }] };
  assert.equal(F.check('2x', q, { ...plain, equal: () => true }).verdict, 'correct');
  assert.equal(F.check('x*0.5', q, { ...plain, equal: () => { throw new Error('no'); } }).verdict, 'correct');
  assert.equal(F.check('2x', q, { ...plain, equal: () => false }).verdict, 'wrong');
});

test('grader: defined quantities (h = 2πħ) can be used in place of the variables', () => {
  const q = { id: 't9', answer: 'hb2', vars: { hbar: '+' }, defs: { h: '2pihbar' }, wrong: [{ a: 'h/2' }] };
  assert.equal(F.check('h/pi', q, plain).verdict, 'correct');
  assert.deepEqual(F.check('h/2', q, plain), { verdict: 'misconception', index: 0 });
  assert.notEqual(F.check('h/2', q, plain).verdict, 'missing', 'h covers ħ');
});

test('grader: integer variables tell n² from 2n − 1 and n', () => {
  const q = { id: 't10', answer: 'n2', vars: { n: 'int' }, wrong: [{ a: '2n-1' }] };
  assert.equal(F.check('nn', q, plain).verdict, 'correct');
  assert.deepEqual(F.check('2n-1', q, plain), { verdict: 'misconception', index: 0 });
  assert.equal(F.check('n', q, plain).verdict, 'wrong');
  const rand = F.rng(7);
  for (let k = 0; k < 200; k++) { const v = F.sampleValue('int', rand); assert.ok(Number.isInteger(v) && v >= 1 && v <= 8); }
  for (let k = 0; k < 200; k++) { const v = F.sampleValue([-2, -0.3], rand); assert.ok(v >= -2 && v <= -0.3); }
});

// ── the built-in parser (used when Compute Engine cannot load, and by these tests) ─────
test('built-in parser: LaTeX and ASCII maths evaluate as written', () => {
  const R = String.raw;
  const cases = [
    [R`\frac{n^2\pi^2\hbar^2}{2mL^2}`, { n: 2, hbar: 1.1, m: 0.7, L: 1.3 }, (4 * Math.PI ** 2 * 1.21) / (2 * 0.7 * 1.69)],
    ['n^2*pi^2*hbar^2/(2*m*L^2)', { n: 2, hbar: 1.1, m: 0.7, L: 1.3 }, (4 * Math.PI ** 2 * 1.21) / (2 * 0.7 * 1.69)],
    ['1/2m', { m: 2 }, 0.25], ['-x^2', { x: 3 }, -9], ['2^-1', {}, 0.5], ['2^3^2', {}, 512], [R`2^{-1/2}`, {}, Math.SQRT1_2],
    [R`\sqrt[3]{8}`, {}, 2], [R`\sqrt{\frac{2}{L}}`, { L: 2 }, 1], ['sqrt(2)/2', {}, Math.SQRT1_2], ['√2', {}, Math.SQRT2], ['π²', {}, Math.PI ** 2],
    [R`\sin^2\theta+\cos^2\theta`, { theta: 0.4 }, 1], [R`\cos\theta\sin\theta`, { theta: 0.5 }, Math.sin(0.5) * Math.cos(0.5)], [R`\ln 2x`, { x: 1.5 }, Math.log(3)],
    [R`-\tanh\left(\frac{\beta\Delta}{2}\right)`, { beta: 1, Delta: 1 }, -Math.tanh(0.5)], [R`\left|x\right|`, { x: -3 }, 3], ['|x|+1', { x: -3 }, 4],
    [R`\binom{8}{4}`, {}, 70], ['8!/4!', {}, 1680], [R`0.3+\sqrt{0.02}`, {}, 0.3 + Math.sqrt(0.02)], [R`3{,}5`, {}, 3.5],
    ['mL', { m: 2, L: 3 }, 6], ['pin', { n: 2 }, 2 * Math.PI], [R`k_BT\ln3`, { k_B: 2, T: 3 }, 6 * Math.log(3)], [R`\frac{2h}{m_ec}`, { h: 3, m_e: 2, c: 0.5 }, 6],
    [R`\alpha+2\beta\cos(ka)`, { alpha: 0.2, beta: -1, k: 1, a: 2 }, 0.2 - 2 * Math.cos(2)], ['ħω/2', { hbar: 2, omega: 3 }, 3], ['(3π^2n)^(1/3)', { n: 1 }, Math.cbrt(3 * Math.PI ** 2)],
    [R`\frac{\alpha^2E_h}{32}`, { alpha: 2, E_h: 8 }, 1], [R`T_2\ln2`, { T_2: 2 }, 2 * Math.LN2], [R`\exp(-2\kappa t)`, { kappa: 0.5, t: 1 }, Math.exp(-1)],
  ];
  for (const [src, scope, want] of cases) {
    const v = B.evaluate(B.parse(src), scope);
    close(v[0], want, 1e-12, src); close(v[1], 0, 1e-12, `${src} (imaginary part)`);
  }
  const e = B.evaluate(B.parse(R`e^{i\pi}`), {}); close(e[0], -1, 1e-12, 'e^{iπ}'); close(e[1], 0, 1e-12, 'e^{iπ} im');
  const ih = B.evaluate(B.parse(R`2i\hbar p`), { hbar: 1.5, p: 2 }); close(ih[0], 0, 1e-12, '2iħp re'); close(ih[1], 6, 1e-12, '2iħp im');
  assert.deepEqual([...B.parse(R`k_BT+\hbar\omega+m_e c`).symbols].sort(), ['T', 'c', 'hbar', 'k_B', 'm_e', 'omega']);
  for (const bad of [R`\frac{1}{`, R`\foo x`, '(1+2', '1+', '', R`x^{\placeholder{}}`, '2**', 'a & b']) assert.throws(() => B.parse(bad), undefined, bad);
});

test('splitting answers into values', () => {
  const R = String.raw;
  assert.deepEqual(F.pieces(R`\lambda_1=\alpha+\beta, \lambda_2=\alpha-\beta`), [R`\alpha+\beta`, R`\alpha-\beta`]);
  assert.deepEqual(F.pieces(R`\{\frac12,\frac32\}`), [R`\frac12`, R`\frac32`]);
  assert.deepEqual(F.pieces(R`\pm\sqrt{p^2c^2+m^2c^4}`), [R`+\sqrt{p^2c^2+m^2c^4}`, R`-\sqrt{p^2c^2+m^2c^4}`]);
  assert.deepEqual(F.pieces(R`E = \frac{5}{36}R_y.`), [R`\frac{5}{36}R_y`]);
  assert.deepEqual(F.pieces(R`\binom{8}{4}`), [R`\binom{8}{4}`], 'commas inside a group do not split');
  assert.deepEqual(F.pieces(R`f(x,y)`), [R`f(x,y)`]);
  assert.deepEqual(F.pieces(R`2i\hbar\hat{p}`), [R`2i\hbar p`], 'operator hats are dropped');
});

// ── the question banks ───────────────────────────────────────────────────────────────
const CJK = /[㐀-鿿]/;
const both = (t, where) => {
  assert.ok(t && typeof t.zh === 'string' && typeof t.en === 'string' && t.zh.trim() && t.en.trim(), `${where}: both languages`);
  assert.ok(CJK.test(t.zh), `${where}: Chinese text`);
  assert.ok(!CJK.test(t.en) && !/[，。；：（）、“”]/.test(t.en), `${where}: no Chinese in the English text`);
};
// names Compute Engine reads as constants or functions, so they must not be used as variables
const RESERVED = new Set(['e', 'i', 'pi', 'gamma', 'Gamma', 'zeta', 'G', 'D', 'N', 'epsilon', 'varepsilon', 'Pi']);
const BANKS = [
  ['math', FMQ, FMQ_MATH, FM.subjects.map((s) => s.id)],
  ['physics', QPQ, QPQ_MATH, QP.chapters.map((c) => c.id)],
];
const ALL = new Map();
for (const [, Q] of BANKS) for (const list of Object.values(Q.items)) for (const q of list) ALL.set(q.id, q);

for (const [name, Q, MATH, units] of BANKS) {
  test(`${name} questions: every subject or chapter has at least two, ids are unique, content in both languages`, () => {
    assert.match(Q.checked, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(Object.keys(Q.items).sort().join(), [...units].sort().join(), 'one list per subject or chapter');
    const seen = new Set();
    for (const [unit, list] of Object.entries(Q.items)) {
      assert.ok(list.length >= 2, `${unit}: at least two questions`);
      for (const q of list) {
        assert.ok(!seen.has(q.id), `${q.id} unique`); seen.add(q.id);
        assert.ok(q.id.startsWith(`${unit}-`), `${q.id} belongs to ${unit}`);
        both(q.q, `${q.id} prompt`); both(q.hint, `${q.id} hint`);
        assert.ok(typeof q.answer === 'string' && q.answer.trim(), `${q.id} answer`);
        assert.ok(Array.isArray(q.wrong) && q.wrong.length >= 1 && q.wrong.length <= 3, `${q.id}: 1–3 common mistakes`);
        q.wrong.forEach((w, k) => { assert.ok(typeof w.a === 'string' && w.a.trim(), `${q.id} mistake ${k}`); both(w.hint, `${q.id} mistake ${k} hint`); });
        assert.ok(q.steps.length >= 1, `${q.id} worked answer`);
        q.steps.forEach((s, k) => (typeof s === 'string' ? assert.ok(s.trim(), `${q.id} step ${k}`) : both(s, `${q.id} step ${k}`)));
      }
    }
  });

  test(`${name} questions: variables are declared, sampled sensibly and safe for Compute Engine`, () => {
    for (const list of Object.values(Q.items)) {
      for (const q of list) {
        const vars = Object.keys(q.vars || {}), defs = Object.keys(q.defs || {});
        for (const [v, spec] of Object.entries(q.vars || {})) {
          assert.ok(spec === '+' || spec === 'int' || (Array.isArray(spec) && spec.length === 2 && spec[0] < spec[1]), `${q.id}: spec of ${v}`);
          assert.ok(!RESERVED.has(v), `${q.id}: ${v} is read as a constant or function by Compute Engine`);
        }
        const used = (src) => F.pieces(src).flatMap((p) => [...B.parse(p).symbols]);
        const ans = new Set(used(q.answer));
        const defSyms = new Set(defs.flatMap((d) => [...B.parse(q.defs[d]).symbols]));
        for (const s of ans) assert.ok(vars.includes(s) || defs.includes(s), `${q.id}: answer symbol ${s} declared`);
        for (const v of vars) assert.ok(ans.has(v) || defSyms.has(v), `${q.id}: variable ${v} appears in the answer`);
        for (const d of defs) assert.ok([...B.parse(q.defs[d]).symbols].every((s) => vars.includes(s)), `${q.id}: definition of ${d} uses declared variables`);
        for (const w of q.wrong) for (const s of used(w.a)) assert.ok(vars.includes(s) || defs.includes(s), `${q.id}: mistake symbol ${s} declared`);
      }
    }
  });

  test(`${name} questions: the answer and alternatives grade as correct, every common mistake as itself`, () => {
    for (const list of Object.values(Q.items)) {
      for (const q of list) {
        assert.deepEqual(F.check(q.answer, q, B), { verdict: 'correct' }, `${q.id}: answer`);
        for (const a of q.alt || []) assert.deepEqual(F.check(a, q, B), { verdict: 'correct' }, `${q.id}: alternative ${a}`);
        q.wrong.forEach((w, k) => assert.deepEqual(F.check(w.a, q, B), { verdict: 'misconception', index: k }, `${q.id}: mistake ${k} (${w.a})`));
      }
    }
  });

  test(`${name} questions: generated MathML matches the formulas (run node tools/fundamental-math.mjs quiz)`, () => {
    const keys = [];
    for (const list of Object.values(Q.items)) {
      for (const q of list) {
        if (q.tex) keys.push(q.id);
        q.steps.forEach((s, k) => { if (typeof s === 'string') keys.push(`${q.id}:${k}`); });
      }
    }
    assert.equal(Object.keys(Q.math).sort().join(), [...keys].sort().join(), 'math keys');
    assert.equal(Object.keys(MATH).sort().join(), [...keys].sort().join(), 'generated MathML is up to date');
    for (const k of keys) assert.match(MATH[k], /^<math[\s\S]*<\/math>$/, k);
  });
}

// ── independent numerical checks of every answer ───────────────────────────────────────
// A(id, scope): the bank's answer evaluated by the built-in engine (definitions such as h = 2πħ filled in)
const A = (id, scope, { complex = false } = {}) => {
  const q = ALL.get(id), s = { ...scope };
  for (const [k, src] of Object.entries(q.defs || {})) if (!(k in s)) s[k] = B.evaluate(B.parse(src), s)[0];
  return F.pieces(q.answer).map((p) => {
    const v = B.evaluate(B.parse(p), s);
    if (complex) return v;
    assert.ok(Math.abs(v[1]) < 1e-12, `${id}: answer is real`);
    return v[0];
  });
};
const same = (got, want, tol, msg) => {
  assert.equal(got.length, want.length, `${msg}: number of values`);
  const g = [...got].sort((x, y) => x - y), w = [...want].sort((x, y) => x - y);
  g.forEach((x, k) => close(x, w[k], tol, `${msg} [${k}]`));
};
const simpson = (f, a, b, n = 20000) => {
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * f(a + k * h);
  return (s * h) / 3;
};
const golden = (f, a, b) => {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a), d = a + r * (b - a);
  while (b - a > 1e-12) { if (f(c) < f(d)) { b = d; } else { a = c; } c = b - r * (b - a); d = a + r * (b - a); }
  return (a + b) / 2;
};
const bisect = (f, a, b) => { let fa = f(a); for (let k = 0; k < 200; k++) { const m = (a + b) / 2, fm = f(m); if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; };
/** eigenvalues (ascending) and eigenvectors of a real symmetric matrix, cyclic Jacobi */
const jacobi = (M) => {
  const n = M.length, a = M.map((r) => [...r]), v = a.map((_, i) => a.map((__, j) => +(i === j)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
      }
    }
  }
  const order = a.map((_, i) => i).sort((i, j) => a[i][i] - a[j][j]);
  return { values: order.map((i) => a[i][i]), vectors: order.map((i) => v.map((r) => r[i])) };
};
/** symmetric tridiagonal matrix (diagonal d, off-diagonal e): number of eigenvalues below x (Sturm sequence) */
const below = (d, e, x) => {
  let q = d[0] - x, n = q < 0 ? 1 : 0;
  for (let i = 1; i < d.length; i++) { q = d[i] - x - (e[i - 1] * e[i - 1]) / (q === 0 ? 1e-300 : q); if (q < 0) n++; }
  return n;
};
const kth = (d, e, k) => { // k-th smallest eigenvalue, k from 0
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < d.length; i++) { const r = Math.abs(e[i - 1] || 0) + Math.abs(e[i] || 0); lo = Math.min(lo, d[i] - r); hi = Math.max(hi, d[i] + r); }
  for (let it = 0; it < 200 && hi - lo > 1e-15 * Math.max(1, Math.abs(lo) + Math.abs(hi)); it++) { const m = (lo + hi) / 2; if (below(d, e, m) > k) hi = m; else lo = m; }
  return (lo + hi) / 2;
};
const vectorAt = (d, e, E) => { // inverse iteration (Thomas algorithm) for the eigenvector at eigenvalue E
  const n = d.length, s = E - 1e-9 * Math.max(1, Math.abs(E));
  let x = new Array(n).fill(1);
  for (let it = 0; it < 4; it++) {
    const c = new Array(n), y = new Array(n);
    let b = d[0] - s; c[0] = e[0] / b; y[0] = x[0] / b;
    for (let i = 1; i < n; i++) { b = d[i] - s - e[i - 1] * c[i - 1]; c[i] = (e[i] || 0) / b; y[i] = (x[i] - e[i - 1] * y[i - 1]) / b; }
    for (let i = n - 2; i >= 0; i--) y[i] -= c[i] * y[i + 1];
    const norm = Math.hypot(...y); x = y.map((t) => t / norm);
  }
  return x;
};
/** finite-difference Hamiltonian −ħ²/(2m) d²/dx² + V on the grid x_i = x0 + (i + 1) h, i = 0 … n − 1, with ψ = 0 outside */
const fd = (hbar, m, x0, x1, n, V = () => 0) => {
  const h = (x1 - x0) / (n + 1), t = (hbar * hbar) / (2 * m * h * h), x = Array.from({ length: n }, (_, i) => x0 + (i + 1) * h);
  return { x, h, d: x.map((xi) => 2 * t + V(xi)), e: new Array(n - 1).fill(-t) };
};
// complex 2×2 / 4×4 helpers: a matrix is an array of rows of [re, im]
const cm = (a, b) => a.map((r, i) => b[0].map((_, j) => r.reduce((s, x, k) => [s[0] + x[0] * b[k][j][0] - x[1] * b[k][j][1], s[1] + x[0] * b[k][j][1] + x[1] * b[k][j][0]], [0, 0])));
const cadd = (a, b, f = 1) => a.map((r, i) => r.map((x, j) => [x[0] + f * b[i][j][0], x[1] + f * b[i][j][1]]));
const cscale = (a, s) => a.map((r) => r.map((x) => [x[0] * s[0] - x[1] * s[1], x[0] * s[1] + x[1] * s[0]]));
const real = (M) => M.map((r) => r.map((x) => [x, 0]));
const SX = real([[0, 1], [1, 0]]), SY = [[[0, 0], [0, -1]], [[0, 1], [0, 0]]], SZ = real([[1, 0], [0, -1]]), I2 = real([[1, 0], [0, 1]]);
const rk4 = (f, y, t1, n) => { // y is a flat array of numbers
  const h = t1 / n, add = (u, v, s) => u.map((x, k) => x + s * v[k]);
  for (let k = 0; k < n; k++) { const k1 = f(y), k2 = f(add(y, k1, h / 2)), k3 = f(add(y, k2, h / 2)), k4 = f(add(y, k3, h)); y = y.map((x, i) => x + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); }
  return y;
};
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

const checks = {
  // ── math ──
  'la-1': () => { const alpha = -0.7, beta = -1.3; same(A('la-1', { alpha, beta }), jacobi([[alpha, beta], [beta, alpha]]).values, 1e-12, 'Hückel eigenvalues'); },
  'la-2': () => { let n = 0; for (let m = 0; m < 256; m++) if (m.toString(2).split('').filter((c) => c === '1').length === 4) n++; same(A('la-2', {}), [n], 0, 'determinants'); },
  'fa-1': () => { const a = 1.7, [c] = A('fa-1', { a }), f = (x) => c * c * Math.exp(-2 * a * Math.abs(x)); close(simpson(f, -30, 0) + simpson(f, 0, 30), 1, 1e-9, '∫|ψ|²'); },
  'fa-2': () => { // Nyström: midpoint rule for the kernel, power iteration
    const n = 2000, x = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
    let v = x.map(() => 1), lam = 0;
    for (let it = 0; it < 5; it++) { const w = x.map((xi) => xi * x.reduce((s, y, j) => s + y * v[j], 0) / n); lam = Math.hypot(...w) / Math.hypot(...v); v = w; }
    close(A('fa-2', {})[0], lam, 1e-6, 'eigenvalue');
  },
  'gr-1': () => { // characters from the geometry of water in the yz plane, then the reduction formula
    const atoms = [[0, 0, 0.12], [0, 0.76, -0.47], [0, -0.76, -0.47]];
    const ops = [[1, 1, 1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1]]; // E, C2(z), σv(xz), σv'(yz) as diagonal matrices
    const chi = ops.map((R) => atoms.reduce((s, p) => s + (p.every((c, k) => Math.abs(R[k] * c - c) < 1e-12) ? R[0] + R[1] + R[2] : 0), 0));
    assert.deepEqual(chi, [9, -1, 1, 3], 'Γ3N characters as stated in the question');
    const B2 = [1, -1, -1, 1];
    same(A('gr-1', {}), [chi.reduce((s, c, k) => s + c * B2[k], 0) / 4], 0, 'n(B2)');
  },
  'gr-2': () => { // count M = m_l + m_s, then peel off j multiplets
    const count = new Map();
    for (const ml of [-1, 0, 1]) for (const ms of [-0.5, 0.5]) count.set(ml + ms, (count.get(ml + ms) || 0) + 1);
    const js = [];
    for (const M of [...count.keys()].filter((m) => m >= 0).sort((a, b) => b - a)) for (let k = 0; k < count.get(M) - (count.get(M + 1) || 0); k++) js.push(M);
    same(A('gr-2', {}), js, 1e-12, 'j values');
  },
  'dg-1': () => { // discrete Berry phase (Wilson loop) of the state aligned with n
    const theta = 1.1, N = 4000, psi = (phi) => [[Math.cos(theta / 2), 0], [Math.sin(theta / 2) * Math.cos(phi), Math.sin(theta / 2) * Math.sin(phi)]];
    const n = (phi) => [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
    const nsig = (phi) => { const [x, y, z] = n(phi); return cadd(cadd(cscale(SX, [x, 0]), cscale(SY, [y, 0])), cscale(SZ, [z, 0])); };
    const p0 = psi(0.3), np0 = cm(nsig(0.3), p0.map((z) => [z])); // (n·σ)ψ = ψ: the state is aligned with the field
    for (let k = 0; k < 2; k++) for (let c = 0; c < 2; c++) close(np0[k][0][c], p0[k][c], 1e-12, 'aligned with the field');
    let P = [1, 0];
    for (let k = 0; k < N; k++) {
      const a = psi((2 * Math.PI * k) / N), b = psi((2 * Math.PI * (k + 1)) / N);
      const o = [a[0][0] * b[0][0] + a[0][1] * b[0][1] + a[1][0] * b[1][0] + a[1][1] * b[1][1], a[0][0] * b[0][1] - a[0][1] * b[0][0] + a[1][0] * b[1][1] - a[1][1] * b[1][0]];
      P = [P[0] * o[0] - P[1] * o[1], P[0] * o[1] + P[1] * o[0]];
    }
    const gamma = -Math.atan2(P[1], P[0]);
    close(wrap(A('dg-1', { theta })[0] - gamma), 0, 1e-5, 'Berry phase mod 2π');
    for (const alt of ALL.get('dg-1').alt) close(wrap(B.evaluate(B.parse(alt), { theta })[0] - gamma), 0, 1e-5, `alternative ${alt}`);
  },
  'dg-2': () => { // follow the lower eigenvector continuously around the loop
    const N = 2000, low = (phi) => jacobi([[Math.cos(phi), Math.sin(phi)], [Math.sin(phi), -Math.cos(phi)]]).vectors[0];
    const v0 = low(0);
    let v = v0;
    for (let k = 1; k <= N; k++) { let w = low((2 * Math.PI * k) / N); if (w[0] * v[0] + w[1] * v[1] < 0) w = w.map((t) => -t); v = w; }
    const overlap = v[0] * v0[0] + v[1] * v0[1]; // e^{iγ}
    close(overlap, -1, 1e-9, 'sign change');
    for (const src of [ALL.get('dg-2').answer, ...ALL.get('dg-2').alt]) close(Math.cos(B.evaluate(B.parse(src), {})[0]), overlap, 1e-12, `e^{iγ} for ${src}`);
  },
  'pr-1': () => { // Monte Carlo over Brownian paths
    const rand = F.rng(2026), t = 1.6, steps = 40, paths = 20000, dt = t / steps;
    let sum = 0;
    for (let p = 0; p < paths; p++) { let w = 0; for (let k = 0; k < steps; k++) w += Math.sqrt(dt) * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()); sum += w * w; }
    close(sum / paths, A('pr-1', { t })[0], 0.03, 'E[W_t²]');
  },
  'pr-2': () => { // integrate the Lindblad equation itself
    const kappa = 0.8, t = 1.3, flat = (M) => M.flat(2), mat = (y) => [[[y[0], y[1]], [y[2], y[3]]], [[y[4], y[5]], [y[6], y[7]]]];
    const rho0 = [[[0.6, 0], [0.3, 0.2]], [[0.3, -0.2], [0.4, 0]]];
    const y = rk4((y) => flat(cscale(cadd(cm(SZ, cm(mat(y), SZ)), mat(y), -1), [kappa, 0])), flat(rho0), t, 4000);
    close(y[2] / 0.3, A('pr-2', { kappa, t })[0], 1e-10, 'ρ01(t)/ρ01(0)'); close(y[3] / 0.2, A('pr-2', { kappa, t })[0], 1e-10, 'imaginary part');
    close(y[0], 0.6, 1e-12, 'populations stay');
  },
  'na-1': () => { const { values } = jacobi([[5, 4], [4, 5]]); same(A('na-1', {}), [values[1] / values[0]], 1e-12, 'κ₂'); },
  'na-2': () => { // central differences of sin at 0.7: error ∝ h²
    const D = (h) => (Math.sin(0.7 + h) - Math.sin(0.7 - h)) / (2 * h), a = D(0.1), b = D(0.05), exact = Math.cos(0.7);
    const [r] = A('na-2', { a, b });
    assert.ok(Math.abs(r - exact) < 1e-6 && Math.abs(r - exact) < Math.abs(b - exact) / 100, `Richardson: ${r} vs ${exact}`);
  },
  'var-1': () => { const E = (z) => z * z - 4 * z + (5 / 8) * z, z = golden(E, 0, 4); close(A('var-1', {})[0], z, 1e-7, 'ζ*'); close(E(z), -2.8477, 1e-4, 'E(ζ*)'); },
  'var-2': () => { // ⟨H⟩ by quadrature, with ψ′ from finite differences
    const E = (alpha) => {
      const psi = (x) => Math.exp(-alpha * x * x), d = (x) => (psi(x + 1e-5) - psi(x - 1e-5)) / 2e-5;
      return simpson((x) => 0.5 * d(x) ** 2 + 0.5 * x * x * psi(x) ** 2, -12, 12) / simpson((x) => psi(x) ** 2, -12, 12);
    };
    for (const alpha of [0.3, 0.8, 1.9]) close(A('var-2', { alpha })[0], E(alpha), 1e-8, `E(${alpha})`);
    close(golden(E, 0.1, 3), 0.5, 1e-5, 'best α'); close(E(0.5), 0.5, 1e-9, 'minimum');
  },
  'oa-1': () => { // matrix exponential by its series
    const beta = 0.9, Delta = 1.7, H = cscale(SZ, [Delta / 2, 0]);
    let term = I2, ex = I2;
    for (let k = 1; k < 40; k++) { term = cscale(cm(term, H), [-beta / k, 0]); ex = cadd(ex, term); }
    const tr = (M) => M[0][0][0] + M[1][1][0];
    close(A('oa-1', { beta, Delta })[0], tr(cm(ex, SZ)) / tr(ex), 1e-12, '⟨σz⟩');
  },
  'oa-2': () => {
    const { values } = jacobi([[0, 0], [0, 4]]); // NᵀN
    let best = 0; for (let k = 0; k < 3600; k++) { const a = (Math.PI * k) / 1800; best = Math.max(best, Math.abs(2 * Math.sin(a))); } // max |Nv| over unit v
    same(A('oa-2', {}), [Math.sqrt(values[1])], 1e-12, '‖N‖'); close(best, Math.sqrt(values[1]), 1e-6, 'max |Nv|');
  },
  'tn-1': () => {
    const p = 0.3, psi = [Math.sqrt(p), 0, 0, Math.sqrt(1 - p)], rho = [0, 1].map((i) => [0, 1].map((j) => psi[2 * i] * psi[2 * j] + psi[2 * i + 1] * psi[2 * j + 1]));
    const S = -jacobi(rho).values.filter((l) => l > 0).reduce((s, l) => s + l * Math.log(l), 0);
    close(A('tn-1', { p })[0], S, 1e-12, 'entropy');
  },
  'tn-2': () => {
    const s = [0.8, 0.5, 0.3, Math.sqrt(0.02)];
    close(s.reduce((t, x) => t + x * x, 0), 1, 1e-12, 'normalised');
    const psi = s, kept = s.map((x, k) => (k < 2 ? x : 0)), err = psi.reduce((t, x, k) => t + (x - kept[k]) ** 2, 0); // ‖ψ − ψ̃‖² in the Schmidt basis
    same(A('tn-2', {}), [err], 1e-12, 'discarded weight');
  },
  'mt-1': () => { // quadrature at finite n (x = tan u), against n·(π/2)(1 − e^{−1/n}), whose limit is π/2
    const I = (n) => simpson((u) => (u === 0 ? 1 : (n * Math.sin(Math.tan(u) / n)) / Math.tan(u)), 0, Math.PI / 2 - 1e-9, 400000);
    for (const n of [2, 20]) close(I(n), (n * Math.PI * (1 - Math.exp(-1 / n))) / 2, 1e-5, `I(${n})`);
    close(A('mt-1', {})[0], (1e6 * Math.PI * (1 - Math.exp(-1e-6))) / 2, 1e-6, 'limit');
  },
  'mt-2': () => { // ∫_ε^1 x^{−2a} dx with x = e^{−s}: increments shrink below the threshold and grow above it
    const [a0] = A('mt-2', {}), J = (a, S) => simpson((s) => Math.exp(-s) * Math.exp(2 * a * s), 0, S, 20000);
    const lo = a0 - 0.05, hi = a0 + 0.05;
    assert.ok(J(lo, 200) - J(lo, 100) < (J(lo, 100) - J(lo, 50)) * 0.1, 'converges just below');
    assert.ok(J(hi, 200) - J(hi, 100) > (J(hi, 100) - J(hi, 50)) * 10, 'diverges just above');
  },
  // ── physics ──
  'birth-1': () => { // solve energy and momentum conservation for every angle, take the largest shift
    const h = 1.3, m = 0.9, c = 1.7, lam0 = 0.8, p = h / lam0;
    let best = 0;
    for (let k = 0; k <= 180; k++) {
      const th = (Math.PI * k) / 180;
      const pp = bisect((q) => (p - q) * c + m * c * c - Math.sqrt((p * p + q * q - 2 * p * q * Math.cos(th)) * c * c + m * m * c ** 4), 1e-12, p);
      best = Math.max(best, h / pp - lam0);
    }
    close(A('birth-1', { h, m_e: m, c })[0], best, 1e-9, 'largest Δλ');
  },
  'birth-2': () => { const R_y = 13.6, E = (n) => -R_y / (n * n); same(A('birth-2', { R_y }), [E(3) - E(2)], 1e-12, 'photon energy'); },
  'wave-1': () => {
    const hbar = 1.1, m = 0.7, L = 1.3, { d, e } = fd(hbar, m, 0, L, 3000);
    for (const n of [1, 2, 3]) close(A('wave-1', { n, hbar, m, L })[0], kth(d, e, n - 1), 1e-5, `E_${n}`);
  },
  'wave-2': () => { const L = 1.3, [a] = A('wave-2', { L }); close(simpson((x) => a * a * Math.sin((2 * Math.PI * x) / L) ** 2, 0, L), 1, 1e-10, '‖ψ₂‖'); },
  'ops-1': () => {
    const hbar = 0.9, m = 1.4, omega = 1.2, X = 10 * Math.sqrt(hbar / (m * omega));
    const { x, d, e } = fd(hbar, m, -X, X, 3000, (t) => 0.5 * m * omega * omega * t * t);
    const v = vectorAt(d, e, kth(d, e, 0));
    close(A('ops-1', { hbar, m, omega })[0], x.reduce((s, t, i) => s + t * t * v[i] * v[i], 0), 1e-4, '⟨x²⟩');
  },
  'ops-2': () => { // apply x p² − p² x to a test function with finite differences, p = −iħ d/dx
    const hbar = 0.8, f = (x) => Math.exp(-x * x) * (1 + 0.3 * x), g = (x) => x * f(x), x0 = 0.37, h = 1e-3;
    const d2 = (u, x) => (-u(x + 2 * h) + 16 * u(x + h) - 30 * u(x) + 16 * u(x - h) - u(x - 2 * h)) / (12 * h * h);
    const d1 = (u, x) => (-u(x + 2 * h) + 8 * u(x + h) - 8 * u(x - h) + u(x - 2 * h)) / (12 * h);
    const lhs = -hbar * hbar * (x0 * d2(f, x0) - d2(g, x0)); // real
    const [c1] = A('ops-2', { hbar, p: 1 }, { complex: true }), [c2] = A('ops-2', { hbar, p: 2 }, { complex: true });
    close(c2[0], 2 * c1[0], 1e-12, 'linear in p'); close(c2[1], 2 * c1[1], 1e-12, 'linear in p');
    const pf = [0, -hbar * d1(f, x0)]; // p f = −iħ f′
    close(c1[0] * pf[0] - c1[1] * pf[1], lhs, 1e-6, 'real part'); close(c1[0] * pf[1] + c1[1] * pf[0], 0, 1e-9, 'imaginary part');
  },
  'ang-1': () => { // L² on Y20 and Y21 from the differential operator
    const hbar = 1.3, h = 1e-4, th = 0.7;
    const L2 = (f, m) => { const g = (t) => Math.sin(t) * (f(t + h) - f(t - h)) / (2 * h); return -hbar * hbar * ((g(th + h) - g(th - h)) / (2 * h) / Math.sin(th) - (m * m * f(th)) / Math.sin(th) ** 2); };
    const Y20 = (t) => 3 * Math.cos(t) ** 2 - 1, Y21 = (t) => Math.sin(t) * Math.cos(t);
    close(L2(Y20, 0) / Y20(th), A('ang-1', { hbar })[0], 1e-6, 'm = 0'); close(L2(Y21, 1) / Y21(th), A('ang-1', { hbar })[0], 1e-6, 'm = 1');
  },
  'ang-2': () => {
    const a0 = 1.3, psi2 = (r) => Math.exp((-2 * r) / a0) / (Math.PI * a0 ** 3);
    close(simpson((r) => psi2(r) * 4 * Math.PI * r * r, 0, 60 * a0), 1, 1e-10, 'normalised');
    close(A('ang-2', { a_0: a0 })[0], simpson((r) => r * psi2(r) * 4 * Math.PI * r * r, 0, 60 * a0), 1e-10, '⟨r⟩');
  },
  'ang-3': () => { // radial equation for each l on a grid, count bound states at each level
    const levels = [1, 2, 3, 4, 5].map((n) => -1 / (2 * n * n)), cut = [-1].concat(levels.slice(0, 4).map((E, k) => (E + levels[k + 1]) / 2));
    const deg = [0, 0, 0, 0];
    for (let l = 0; l < 5; l++) {
      const { d, e } = fd(1, 1, 0, 100, 4000, (r) => (l * (l + 1)) / (2 * r * r) - 1 / r);
      for (let n = 1; n <= 4; n++) deg[n - 1] += (2 * l + 1) * (below(d, e, cut[n]) - below(d, e, cut[n - 1]));
    }
    for (let n = 1; n <= 4; n++) same(A('ang-3', { n }), [deg[n - 1]], 0, `degeneracy of n = ${n}`);
  },
  'approx-1': () => { // dE₀/dλ from exact (grid) eigenvalues, a Hellmann–Feynman check of first-order perturbation theory
    const hbar = 0.9, m = 1.4, omega = 1.2, X = 10 * Math.sqrt(hbar / (m * omega)), dl = 1e-3;
    const E0 = (lambda) => { const { d, e } = fd(hbar, m, -X, X, 3000, (t) => 0.5 * m * omega * omega * t * t + lambda * t ** 4); return kth(d, e, 0); };
    close(A('approx-1', { lambda: 1, hbar, m, omega })[0], (E0(dl) - E0(-dl)) / (2 * dl), 1e-4, 'dE₀/dλ');
  },
  'approx-2': () => { const v = 1e-3, Delta = 1.3; close(A('approx-2', { v, Delta })[0] / jacobi([[0, v], [v, Delta]]).values[0], 1, 1e-5, 'lower level shift'); },
  'ident-1': () => {
    const hbar = 1.1, m = 0.7, L = 1.3, { d, e } = fd(hbar, m, 0, L, 3000);
    close(A('ident-1', { hbar, m, L })[0], kth(d, e, 0) + kth(d, e, 1), 1e-5, 'two lowest levels');
  },
  'ident-2': () => { const x = Math.log(3); same(A('ident-2', {}), [1 / (Math.exp(x) + 1)], 1e-12, 'occupation'); },
  'ent-1': () => { // CHSH for |Φ+⟩, maximised over a grid of measurement angles
    const phi = [Math.SQRT1_2, 0, 0, Math.SQRT1_2], obs = (t) => [[Math.cos(t), Math.sin(t)], [Math.sin(t), -Math.cos(t)]];
    const E = (a, b) => { const A1 = obs(a), B1 = obs(b); let s = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += phi[i] * A1[i >> 1][j >> 1] * B1[i & 1][j & 1] * phi[j]; return s; };
    let best = 0;
    const g = Array.from({ length: 16 }, (_, k) => (Math.PI * k) / 8);
    for (const a1 of g) for (const a2 of g) for (const b1 of g) for (const b2 of g) best = Math.max(best, Math.abs(E(a1, b1) + E(a1, b2) + E(a2, b1) - E(a2, b2)));
    same(A('ent-1', {}), [best], 1e-12, 'max |S|');
  },
  'ent-2': () => {
    const theta = 0.6, psi = [Math.cos(theta), 0, 0, Math.sin(theta)], rho = [0, 1].map((i) => [0, 1].map((j) => psi[2 * i] * psi[2 * j] + psi[2 * i + 1] * psi[2 * j + 1]));
    same(A('ent-2', { theta }), jacobi(rho).values, 1e-12, 'eigenvalues of ρ_A');
  },
  'open-1': () => {
    const r = 0.7, n = [0.3, -0.5, 0.81], len = Math.hypot(...n), rv = n.map((t) => (r * t) / len);
    const rho = cscale(cadd(cadd(cadd(I2, cscale(SX, [rv[0], 0])), cscale(SY, [rv[1], 0])), cscale(SZ, [rv[2], 0])), [0.5, 0]);
    const purity = cm(rho, rho)[0][0][0] + cm(rho, rho)[1][1][0];
    same(A('open-1', { r }), [purity], 1e-12, 'Tr ρ²');
  },
  'open-2': () => { const T_2 = 1.7; same(A('open-2', { T_2 }), [bisect((t) => Math.exp(-t / T_2) - 0.5, 0, 10)], 1e-9, 'half time'); },
  'scat-1': () => { // partial waves, tan δ_l = j_l(ka)/y_l(ka)
    const a = 1.3, k = 1e-2 / a, x = k * a;
    const j = [Math.sin(x) / x, Math.sin(x) / x ** 2 - Math.cos(x) / x], y = [-Math.cos(x) / x, -Math.cos(x) / x ** 2 - Math.sin(x) / x];
    const sigma = j.reduce((s, jl, l) => s + ((4 * Math.PI) / (k * k)) * (2 * l + 1) * Math.sin(Math.atan(jl / y[l])) ** 2, 0);
    close(A('scat-1', { a })[0], sigma, 1e-4, 'σ');
  },
  'scat-2': () => { // the 3D Born integral −(m/2πħ²)∫e^{−iq·r}V d³r, both radius and angle by quadrature
    const m = 0.9, V_0 = 1.4, hbar = 1.1, mu = 0.8, q = 1.3;
    const f = -(m / (2 * Math.PI * hbar * hbar)) * simpson((r) => r * r * 2 * Math.PI * simpson((t) => Math.sin(t) * Math.cos(q * r * Math.cos(t)), 0, Math.PI, 200) * (V_0 * Math.exp(-mu * r)) / (r || 1e-300), 0, 50 / mu, 4000);
    close(A('scat-2', { m, V_0, hbar, mu, q })[0], f, 1e-6, 'f(q)');
  },
  'rel-1': () => { // the exact Dirac levels, expanded to α⁴ by taking a small α
    const alpha = 1 / 137.035999, mc2 = 1, Eh = alpha * alpha * mc2;
    const E = (n, j) => { const k = j + 0.5, dl = k - Math.sqrt(k * k - alpha * alpha); return mc2 / Math.sqrt(1 + (alpha / (n - dl)) ** 2); };
    close(A('rel-1', { alpha, E_h: Eh })[0] / (E(2, 1.5) - E(2, 0.5)), 1, 1e-3, 'ΔE');
  },
  'rel-2': () => { // H² for the 4×4 Dirac Hamiltonian
    const c = 1.3, m = 0.7, p = [0.4, -0.9, 0.6], P = Math.hypot(...p);
    const zero = real([[0, 0], [0, 0]]), blk = (a, b, cc, d) => [...a.map((r, i) => [...r, ...b[i]]), ...cc.map((r, i) => [...r, ...d[i]])];
    const alpha = [SX, SY, SZ].map((s) => blk(zero, s, s, zero)), beta = blk(I2, zero, zero, cscale(I2, [-1, 0]));
    let H = cscale(beta, [m * c * c, 0]);
    alpha.forEach((a, k) => { H = cadd(H, cscale(a, [c * p[k], 0])); });
    const H2 = cm(H, H), E2 = P * P * c * c + m * m * c ** 4;
    H2.forEach((r, i) => r.forEach((z, k) => { close(z[0], i === k ? E2 : 0, 1e-12, 'H² real'); close(z[1], 0, 1e-12, 'H² imaginary'); }));
    close(H[0][0][0] + H[1][1][0] + H[2][2][0] + H[3][3][0], 0, 1e-12, 'traceless: as many negative as positive levels');
    same(A('rel-2', { p: P, c, m }), [Math.sqrt(E2), -Math.sqrt(E2)], 1e-12, 'energies');
  },
  'cond-1': () => { // apply the ring Hamiltonian to Bloch vectors
    const N = 12, alpha = 0.2, beta = -0.8, a = 1.1;
    for (let jj = 0; jj < N; jj++) {
      const k = (2 * Math.PI * jj) / (N * a), v = (n) => [Math.cos(k * n * a), Math.sin(k * n * a)], [E] = A('cond-1', { alpha, beta, k, a });
      for (let n = 0; n < N; n++) { const l = v((n + N - 1) % N), r = v((n + 1) % N), c = v(n); for (const t of [0, 1]) close(alpha * c[t] + beta * (l[t] + r[t]), E * c[t], 1e-12, `Bloch k${jj}`); }
    }
  },
  'cond-2': () => { // count plane waves in a periodic box inside the Fermi sphere
    const kF = 1, R = 25, L = (2 * Math.PI * R) / kF;
    let count = 0;
    for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) for (let z = -R; z <= R; z++) if (x * x + y * y + z * z <= R * R) count++;
    close(A('cond-2', { n: (2 * count) / L ** 3 })[0], kF, 3e-3, 'k_F');
  },
  'optics-1': () => { // integrate i dψ/dt = (Ω/2)σx ψ
    const Omega = 1.7, [t] = A('optics-1', { Omega }), f = (y) => [(Omega / 2) * y[3], -(Omega / 2) * y[2], (Omega / 2) * y[1], -(Omega / 2) * y[0]]; // y = [Re a, Im a, Re b, Im b]
    const Pe = (s) => { const y = rk4(f, [1, 0, 0, 0], s, 2000); return y[2] ** 2 + y[3] ** 2; };
    close(Pe(t), 1, 1e-10, 'fully inverted');
    for (const s of [0.3, 0.6, 0.9, 0.95]) assert.ok(Pe(s * t) < 1 - 1e-3, `not yet inverted at ${s}·t`);
  },
  'optics-2': () => { // Jaynes–Cummings with up to two photons: basis |g,0⟩ |g,1⟩ |g,2⟩ |e,0⟩ |e,1⟩ |e,2⟩
    const w = 2, g = 0.3, H = Array.from({ length: 6 }, () => new Array(6).fill(0));
    for (let n = 0; n < 3; n++) { H[n][n] = w * n; H[3 + n][3 + n] = w * n + w; }
    for (let n = 1; n < 3; n++) { H[3 + n - 1][n] = H[n][3 + n - 1] = g * Math.sqrt(n); } // a σ+ : |g,n⟩ → √n |e,n−1⟩
    const ev = jacobi(H).values, one = ev.filter((E) => E > 1 && E < 3), two = ev.filter((E) => E > 3 && E < 5);
    same(A('optics-2', { g }), [one[1] - one[0]], 1e-12, 'vacuum Rabi splitting');
    close(two[1] - two[0], 2 * Math.sqrt(2) * g, 1e-12, 'two-excitation splitting (the 2√2 g mistake)');
  },
};

test('every answer agrees with an independent numerical calculation', () => {
  assert.deepEqual([...ALL.keys()].filter((id) => !checks[id]), [], 'a numerical check for every question');
  for (const [id, run] of Object.entries(checks)) {
    assert.ok(ALL.has(id), `${id} exists`);
    run();
  }
});
