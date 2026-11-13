// Tests for the chemistry & materials news section (/news/): the demo models against analytic results and the papers' own
// numbers, and the content's integrity (both languages, sources of every number, references, demos, links).
//   node --test tools/news-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../public/news/${file}`, import.meta.url), 'utf8');
const load = (file) => { const box = { window: {} }; vm.runInNewContext(read(file), box); return box.window; };
const M = load('news-models.js').MOLASTRIA_NEWS_MODELS;
const D = load('news-data.js').MOLASTRIA_NEWS;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ── 自由基对 ──────────────────────────────────────────────────────────────
test('radical pair: S–T₀ mixing is a two-level Rabi problem', () => {
  close(M.stMix(0, 5, 0), 0, 1e-12, 'starts in S');
  close(M.stMix(0, 5, 1 / (4 * 5)), 1, 1e-12, 'J = 0: full transfer at a quarter period of 2Q');
  for (const [J, Q] of [[1, 1], [10, 2], [0.3, 7]]) {
    let mx = 0; for (let i = 0; i <= 4000; i++) mx = Math.max(mx, M.stMix(J, Q, i / 4000 / Math.hypot(J, Q)));
    close(mx, (Q * Q) / (J * J + Q * Q), 1e-5, `amplitude Q²/(J²+Q²) at J=${J}, Q=${Q}`);
  }
  close(M.stMix(3, 0, 0.37), 0, 1e-15, 'no mixing without Q');
  // Δg = 2×10⁻³ at 340 mT: Q = Δg μB B / 2h ≈ 4.76 MHz
  close(M.qFromDg(2e-3, 340), 4.759, 2e-3, 'Δg mixing frequency');
});

test('radical pair: the lifetime-averaged yield matches a direct time integral', () => {
  for (const [J, Q, tau] of [[1, 3, 0.5], [20, 2, 0.1], [0, 4, 2]]) {
    const n = 200000, T = 40 * tau, dt = T / n;
    let s = 0; for (let i = 0; i < n; i++) { const t = (i + 0.5) * dt; s += (Math.exp(-t / tau) / tau) * M.stMix(J, Q, t) * dt; }
    close(M.stYield(J, Q, tau), s, 2e-4, `yield J=${J} Q=${Q} τ=${tau}`);
  }
  close(M.stYield(0, 50, 100), 0.5, 1e-4, 'long-lived, strongly mixed pairs end up half in T₀');
  close(M.gaussAvg((x) => x * x, 0, 3), 9, 1e-6, 'Gaussian average reproduces the variance');
  close(M.gaussAvg((x) => x, 2, 3), 2, 1e-9, 'and the mean');
  assert.ok(M.stYieldAvg(100, 4.76, 5, 0.5) < M.stYieldAvg(1, 4.76, 5, 0.5) / 5, 'a large J suppresses the T₀ yield');
});

// ── 三重态 ────────────────────────────────────────────────────────────────
test('triplet: zero-field lines are 2E, D−E, D+E and the paper’s ODMR lines are self-consistent', () => {
  assert.deepEqual([...M.zeroField(926, 121).lines], [242, 805, 1047]);
  const f = M.fromLines([300, 770, 1070]);
  assert.deepEqual([f.D, f.E, f.check], [920, 150, 0]);
  const lv = M.levelsAt(920, 150, 0), z = M.zeroField(920, 150).levels;
  assert.deepEqual([...lv].map((v) => Math.round(v * 1e6) / 1e6), [z.Z, z.X, z.Y].map((v) => Math.round(v * 1e6) / 1e6));
  close(lv.reduce((a, b) => a + b, 0), 0, 1e-9, 'traceless at zero field');
});

test('triplet: exact levels in a field match the analytic cases', () => {
  // B ∥ z: T₀ stays at −2D/3, T± at D/3 ± √(E² + (γB)²)
  const D = 920, E = 150, B = 5, gB = M.gamma() * B, lv = M.levelsAt(D, E, B, 'z');
  close(lv[0], (-2 * D) / 3, 1e-9, 'Tz unchanged for B ∥ z');
  close(lv[2], D / 3 + Math.hypot(E, gB), 1e-9, 'upper level');
  close(lv[1], D / 3 - Math.hypot(E, gB), 1e-9, 'middle level');
  // high field: first-order Zeeman limit, E_m ≈ m γB for B ≫ D
  const hi = M.levelsAt(D, E, 3000, 'x'), g3 = M.gamma() * 3000;
  close(hi[2] - hi[0], 2 * g3, 0.02 * g3, 'splitting tends to 2γB');
  close(M.gamma(), 28.025, 1e-3, 'γ for g = 2.0023 in MHz/mT');
});

test('triplet EPR: line positions, polarisation patterns and the paper’s spectral width', () => {
  const nu = 9500, B0 = nu / M.gamma();
  const t0 = M.tripletSticks({ D: 70, E: 0, nu, pops: { mode: 't0' }, n: 400 });
  // T₀ only: −1↔0 lines emissive (−1), 0↔+1 absorptive (+1), net zero
  assert.ok(t0.every((s, i) => s.I === (i % 2 ? 1 : -1)));
  close(t0.reduce((a, s) => a + s.I, 0), 0, 1e-12, 'net polarisation zero');
  const all = M.tripletSticks({ D: 926, E: 121, nu, pops: { mode: 'isc', P: [0.68, 0.32, 0] }, n: 3000 });
  const lo = Math.min(...all.map((s) => s.B)), hi = Math.max(...all.map((s) => s.B));
  close(hi - lo, M.spanMT(926), 0.5, 'outermost lines are 2|D|/γ apart (≈ 66 mT)');
  close((hi + lo) / 2, B0, 0.5, 'centred on g = 2.0023');
  close(M.spanMT(926), 66.08, 0.05, '66 mT');
  // ISC populations: p0 = Σ P n², each orientation keeps p₋ + p₀ + p₊ = 1
  const sp = M.broaden(all, B0 - 40, B0 + 40, 800, 1.5);
  assert.equal(sp.xs.length, 800); close(Math.max(...sp.ys.map(Math.abs)), 1, 1e-12, 'normalised');
  // point dipole: 1 nm → |D| = 78 MHz, and back again
  close(M.dipD(1), 78.06, 0.01, 'D at 1 nm'); close(M.rFromD(M.dipD(1.37)), 1.37, 1e-9, 'r from D');
  close(M.branch(26e-3, 1.9), 0.9865, 1e-4, 'charge transfer vs ISC from the solution constants');
});

// ── 内容 ──────────────────────────────────────────────────────────────────
const bi = (t, where) => { assert.ok(t && typeof t.zh === 'string' && typeof t.en === 'string' && t.zh.trim() && t.en.trim(), `both languages: ${where}`); assert.ok(/[一-鿿]/.test(t.zh), `zh is Chinese: ${where}`); assert.ok(!/[一-鿿]/.test(t.en), `en has no Chinese: ${where}`); };
const refIds = new Set(D.refs.map((r) => r.id));

test('references: unique ids, DOIs well formed, every one checked and cited', () => {
  assert.equal(refIds.size, D.refs.length);
  const cited = new Set(D.items.flatMap((i) => [i.paper, ...i.refs]));
  for (const r of D.refs) {
    assert.match(r.doi, /^10\.\d{4,9}\/\S+$/, r.id);
    assert.ok(r.title && r.journal && r.year > 1900 && r.authors && r.vol && r.pages && r.checked, r.id);
    assert.ok(cited.has(r.id), `cited somewhere: ${r.id}`);
  }
  assert.equal(new Set(D.refs.map((r) => r.doi.toLowerCase())).size, D.refs.length, 'no DOI twice');
});

test('items: newest first by date, both languages everywhere, every number has a source', () => {
  const ids = new Set();
  for (const it of D.items) {
    assert.match(it.id, /^[a-z0-9-]+$/); assert.ok(!ids.has(it.id), it.id); ids.add(it.id);
    assert.match(it.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(refIds.has(it.paper), `${it.id} paper`); assert.ok(it.refs.includes(it.paper), `${it.id} lists its own paper`);
    for (const r of it.refs) assert.ok(refIds.has(r), `${it.id} ref ${r}`);
    for (const f of it.fields) assert.ok(D.fields[f], `${it.id} field ${f}`);
    for (const k of ['title', 'dek', 'kicker']) bi(it[k], `${it.id}.${k}`);
    for (const [i, p] of it.plain.entries()) bi(p, `${it.id}.plain[${i}]`);
    for (const [i, s] of it.steps.entries()) { bi(s.t, `${it.id}.steps[${i}].t`); bi(s.text, `${it.id}.steps[${i}]`); }
    for (const [i, p] of [...it.why, ...it.limits].entries()) bi(p, `${it.id}.why/limits[${i}]`);
    if (it.interp) bi(it.interp, `${it.id}.interp`);
    for (const [k, v, s, n] of it.numbers) {
      bi(k, `${it.id} number`); assert.ok(D.srcLabel[s], `${it.id} source ${s}`);
      if (typeof v !== 'string') assert.ok(v.zh && v.en, `${it.id} value in both languages`);
      if (s === 'calc') assert.ok(n, `${it.id}: a computed number says how it was computed`);
      if (n) bi(n, `${it.id} number note`);
    }
    for (const [u] of it.press) assert.match(u, /^https:\/\//);
    for (const d of it.demos) assert.ok(D.demos[d], `${it.id} demo ${d}`);
    for (const k of it.related) { const s = D.site[k]; assert.ok(s, `${it.id} related ${k}`); assert.ok(existsSync(new URL(s[0].split('#')[0], new URL('../public/news/', import.meta.url))), `link target exists: ${s[0]}`); }
  }
  const dates = [...D.items].map((i) => i.date);
  assert.deepEqual(dates, [...dates].sort().reverse(), 'items are listed newest first');
  for (const [k, d] of Object.entries(D.demos)) { bi(d.title, `demo ${k}`); bi(d.intro, `demo ${k}`); bi(d.notes, `demo ${k}`); }
  bi(D.hero.lead, 'hero'); bi(D.hero.honesty, 'hero');
});

test('computed numbers on the page agree with the models', () => {
  const nums = Object.fromEntries(D.items.flatMap((i) => i.numbers.map((n) => [n[0].en, n[1]])));
  assert.equal(nums['Share that goes to charge transfer'], `${(100 * M.branch(26e-3, 1.9)).toFixed(1)}%`);
  assert.equal(nums['D and E from ODMR'], `${M.fromLines([300, 770, 1070]).D} MHz, ${M.fromLines([300, 770, 1070]).E} MHz`);
  assert.equal(nums['Full width of the EPR spectrum'], `≈ ${Math.round(M.spanMT(926))} mT`);
});

test('the page loads its scripts and the nav knows the section', () => {
  const html = read('index.html');
  for (const s of ['../spectra/sp-plot.js', 'news-data.js', 'news-models.js', 'news.js', 'news.css']) assert.ok(html.includes(s), s);
  assert.match(html, /data-section="news"/);
  const nav = readFileSync(new URL('../public/shared-nav.js', import.meta.url), 'utf8');
  assert.match(nav, /\['news', 'news\/index\.html'/);
});

test('radical pair: the hyperfine average has no aliasing revival at long times', () => {
  // J = 0: ⟨sin²(2π q t)⟩ over q ~ N(Q0, σ²) → 1/2 − cos(4πQ0 t) e^{−8π²σ²t²}/2 exactly
  for (const t of [0.3, 1, 1.7, 2]) {
    const exact = 0.5 - 0.5 * Math.cos(4 * Math.PI * 4.76 * t) * Math.exp(-8 * Math.PI ** 2 * 25 * t * t);
    close(M.stMixAvg(0, 4.76, 5, t), exact, 1e-6, `t = ${t} μs`);
  }
});
