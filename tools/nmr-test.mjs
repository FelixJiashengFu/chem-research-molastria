// Tests for the NMR section (/nmr/): the five demo models against analytic results,
// and the content's integrity (statuses, formulas, references, links, both languages).
//   node --test tools/nmr-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../public/nmr/${file}`, import.meta.url), 'utf8');
const load = (file) => { const box = { window: {} }; vm.runInNewContext(read(file), box); return box.window; };
const M = load('nmr-models.js').MOLASTRIA_NMR_MODELS;
const D = load('nmr-data.js').MOLASTRIA_NMR;
const MATH = load('nmr-math.js').MOLASTRIA_NMR_MATH;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} vs ${b}`);

// ── 基本常数 ──────────────────────────────────────────────────────────────
test('Larmor frequencies: ¹H at 9.4 T is 400 MHz, ¹³C a quarter of it, 1.2 GHz needs 28.2 T', () => {
  rel(M.larmor('H1', 9.3949), 400, 1e-4, '¹H at 9.39 T');
  rel(M.larmor('C13', M.fieldOf(400)), 100.58, 1e-4, '¹³C on a 400 MHz magnet');
  rel(M.larmor('N15', M.fieldOf(600)), 60.82, 1e-3, '¹⁵N on a 600 MHz magnet');
  rel(M.fieldOf(1200), 28.2, 2e-3, '1.2 GHz');
  for (const [k, n] of Object.entries(M.NUCLEI)) { assert.ok(n.xi > 0 && n.xi <= 100 && n.abundance > 0 && n.abundance <= 100 && /^\d(\/2)?$/.test(n.spin), k); }
});

// ── 演示 1：FID 与傅里叶变换 ──────────────────────────────────────────────
test('Fourier transform: a pure tone lands on its bin, and Parseval holds', () => {
  const n = 64, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { re[i] = Math.cos(2 * Math.PI * 5 * i / n); im[i] = Math.sin(2 * Math.PI * 5 * i / n); }
  M.fft(re, im);
  for (let k = 0; k < n; k++) close(Math.hypot(re[k], im[k]), k === 5 ? n : 0, 1e-9, `bin ${k}`);
  const rand = M.rng(3), a = Float64Array.from({ length: 128 }, () => M.gauss(rand)), b = Float64Array.from({ length: 128 }, () => M.gauss(rand));
  const e0 = a.reduce((s, v, i) => s + v * v + b[i] * b[i], 0);
  M.fft(a, b);
  rel(a.reduce((s, v, i) => s + v * v + b[i] * b[i], 0) / 128, e0, 1e-10, 'Parseval');
});
test('FID → spectrum: Lorentzian of width 1/(πT₂) at the right frequency; windows add, noise averages as 1/√n', () => {
  for (const T2 of [0.2, 0.5, 1]) {
    const fid = M.fid([{ f: 30, T2 }], { sw: 200, n: Math.round(12 * T2 * 200) });
    const sp = M.spectrum(fid, { size: 16384 }), m = M.measureWidth(sp.f, sp.y);
    rel(m.width, M.fwhm(T2), 0.01, `T₂ = ${T2}`);
    close(m.peak, 30, 0.02, 'peak position');
    rel(m.height, T2, 0.01, 'peak height equals T₂');
    const lb = M.measureWidth(sp.f, M.spectrum(fid, { lb: 2, size: 16384 }).y);
    rel(lb.width, M.fwhm(T2) + 2, 0.01, 'exponential window adds its width');
  }
  // truncation: acquisition much shorter than T₂ gives sin(2πΔf·aq)/(2πΔf), 0.603/aq wide at half height, with negative lobes
  const short = M.spectrum(M.fid([{ f: 30, T2: 5 }], { sw: 200, n: 40 }), { size: 4096 });
  rel(M.measureWidth(short.f, short.y).width, 0.603 / 0.2, 0.05, 'truncated line');
  assert.ok(Math.min(...short.y) < -0.1 * Math.max(...short.y), 'truncation wiggles go negative');
  // noise: same seed, same numbers; standard deviation as asked
  const n1 = M.fid([], { sw: 200, n: 4000, noise: 0.4, seed: 5 }), n2 = M.fid([], { sw: 200, n: 4000, noise: 0.4, seed: 5 });
  assert.deepEqual(Array.from(n1.re.slice(0, 5)), Array.from(n2.re.slice(0, 5)));
  rel(Math.sqrt(n1.re.reduce((s, v) => s + v * v, 0) / 4000), 0.4, 0.05, 'noise level');
});
test('Ernst angle maximises the steady-state signal', () => {
  for (const [TR, T1] of [[0.5, 2], [1, 1], [3, 1]]) {
    const a = M.ernstAngle(TR, T1), s = M.steadySignal(a, TR, T1);
    close(Math.cos(a), Math.exp(-TR / T1), 1e-12, 'cos θ = exp(−TR/T₁)');
    assert.ok(s > M.steadySignal(a + 0.05, TR, T1) && s > M.steadySignal(a - 0.05, TR, T1), `TR/T₁ = ${TR / T1}`);
  }
});

// ── 演示 2：自旋体系 ──────────────────────────────────────────────────────
test('spin systems: AB matches the analytic solution at every field', () => {
  for (const [dppm, J, field] of [[0.25, 12, 40], [0.25, 12, 400], [0.05, 7, 60], [1, 15, 600]]) {
    const lines = M.spinSystem({ shifts: [5 + dppm / 2, 5 - dppm / 2], J: [[0, J]], field }), want = M.abAnalytic(dppm * field, J);
    assert.equal(lines.length, 4);
    lines.forEach((l, i) => { close(l.f - 5 * field, want[i].f, 1e-8, `frequency ${i}`); close(l.I, want[i].I, 1e-9, `intensity ${i}`); });
  }
});
test('spin systems: equivalent spins show no splitting, first-order multiplets are binomial, intensities sum to n', () => {
  const a2 = M.mergeLines(M.spinSystem({ shifts: [2, 2], J: [[0, 10]], field: 400 }), 1e-6).filter((l) => l.I > 1e-9);
  assert.equal(a2.length, 1); close(a2[0].I, 2, 1e-9, 'A₂ is one line of intensity 2'); close(a2[0].ppm, 2, 1e-9, 'A₂ position');
  // ethyl at very high field: quartet 1:3:3:1 (×2 protons) and triplet 1:2:1 (×3 protons), spacing J
  const ethyl = M.PRESETS.find((p) => p.id === 'ethyl'), field = 20000;
  const lines = M.mergeLines(M.spinSystem({ ...ethyl, field }), 0.05).filter((l) => l.I > 1e-3);
  const q = lines.filter((l) => l.ppm > 3), t = lines.filter((l) => l.ppm < 2);
  assert.equal(q.length, 4); assert.equal(t.length, 3);
  [0.25, 0.75, 0.75, 0.25].forEach((v, i) => close(q[i].I, v, 0.01, `quartet line ${i}`));
  [0.75, 1.5, 0.75].forEach((v, i) => close(t[i].I, v, 0.01, `triplet line ${i}`));
  close(q[1].f - q[0].f, 7, 0.01, 'quartet spacing'); close(t[2].f - t[1].f, 7, 0.01, 'triplet spacing');
  for (const p of M.PRESETS) for (const f of [40, 60, 400, 1200]) {
    const all = M.spinSystem({ ...p, field: f });
    close(all.reduce((s, l) => s + l.I, 0), p.shifts.length, 1e-8, `${p.id} at ${f} MHz: total intensity`);
    close(all.reduce((s, l) => s + l.I * l.ppm, 0) / p.shifts.length, p.shifts.reduce((s, v) => s + v, 0) / p.shifts.length, 1e-8, `${p.id}: centre of gravity is the mean shift`);
    assert.ok(p.zh && p.en, p.id);
  }
  // the roof effect: at low field the inner lines of AB are stronger than the outer ones
  const ab = M.spinSystem({ ...M.PRESETS[0], field: 60 });
  assert.ok(ab[1].I > 1.5 * ab[0].I && ab[2].I > 1.5 * ab[3].I);
});
test('spin systems: six spins diagonalise, and the rendered spectrum integrates to the total intensity', () => {
  const six = M.spinSystem({ shifts: [1, 1.2, 2.5, 3.1, 4, 4.4], J: [[0, 7, 2, 0, 0, 0], [0, 0, 7, 1, 0, 0], [0, 0, 0, 12, 3, 0], [0, 0, 0, 0, 8, 2], [0, 0, 0, 0, 0, 10]], field: 90 });
  close(six.reduce((s, l) => s + l.I, 0), 6, 1e-7, 'six spins');
  assert.throws(() => M.spinSystem({ shifts: [1, 2, 3, 4, 5, 6, 7], field: 100 }));
  const p = M.PRESETS[2], lines = M.spinSystem({ ...p, field: 400 }), sp = M.renderSpectrum(lines, { field: 400, lo: 3, hi: 9, npts: 60000, lw: 1 });
  let area = 0; for (let i = 1; i < sp.x.length; i++) area += 0.5 * (sp.y[i] + sp.y[i - 1]) * (sp.x[i] - sp.x[i - 1]) * 400;
  rel(area, 3, 0.01, 'area under the AMX spectrum');
});
test('Jacobi diagonalisation reproduces a known spectrum', () => {
  const { w } = M.jacobi([[2, 1, 0], [1, 2, 1], [0, 1, 2]]);
  [2 - Math.SQRT2, 2, 2 + Math.SQRT2].forEach((v, i) => close([...w].sort((a, b) => a - b)[i], v, 1e-10, `eigenvalue ${i}`));
});

// ── 演示 3：偶极弛豫 ──────────────────────────────────────────────────────
test('dipolar relaxation: extreme narrowing, the T₁ minimum, slow motion and the NOE', () => {
  const field = 600, w = 2 * Math.PI * field * 1e6;
  const fast = M.relax({ field, tc: 1e-12 });
  rel(fast.T1, fast.T2, 1e-3, 'T₁ = T₂ in extreme narrowing');
  close(fast.noe, 0.5, 1e-3, 'NOE +50% for small molecules');
  rel(fast.R1, 1.5 * M.dipolarB(1.8) ** 2 * 1e-12, 1e-3, 'R₁ = (3/2) b² τc');
  const slow = M.relax({ field, tc: 1e-7 });
  close(slow.noe, -1, 1e-3, 'NOE −100% for large molecules');
  assert.ok(slow.T1 > 100 * slow.T2, 'T₂ ≪ T₁ in slow motion');
  rel(slow.R2, 0.45 * M.dipolarB(1.8) ** 2 * 1e-7, 1e-2, 'R₂ → (9/20) b² τc');
  close(M.relax({ field, tc: Math.sqrt(5) / 2 / w }).noe, 0, 1e-9, 'NOE crosses zero at ωτc = √5/2');
  // T₁ minimum at ωτc = 0.616
  let best = 0, at = 0;
  for (let x = 0.3; x < 1.2; x += 0.0005) { const r = M.relax({ field, tc: x / w }).R1; if (r > best) { best = r; at = x; } }
  close(at, 0.616, 0.002, 'position of the T₁ minimum');
  rel(M.relax({ field, tc: 1e-10, r: 3.6 }).R1 * 64, M.relax({ field, tc: 1e-10, r: 1.8 }).R1, 1e-9, 'r⁻⁶');
  rel(M.dipolarB(1) / (2 * Math.PI), 120120, 2e-3, '¹H–¹H dipolar coupling at 1 Å is 120.1 kHz');
});
test('Stokes–Einstein–Debye: a 20 kDa protein tumbles in roughly 10 ns, τc grows with size and viscosity', () => {
  const p20 = M.tauC({ mw: 20000 });
  assert.ok(p20.tc > 6e-9 && p20.tc < 14e-9, `τc = ${p20.tc}`);
  assert.ok(p20.radius > 18 && p20.radius < 24, `radius ${p20.radius} Å`);
  assert.ok(M.tauC({ mw: 80000 }).tc > 3 * p20.tc);
  rel(M.tauC({ mw: 20000, eta: 1.78e-3 }).tc, 2 * p20.tc, 1e-9, 'τc ∝ η');
});

// ── 演示 4：魔角旋转 ──────────────────────────────────────────────────────
test('magic-angle spinning: sidebands keep the intensity, the centre of gravity and the second moment', () => {
  close(M.MAGIC * 180 / Math.PI, 54.7356, 1e-4, 'the magic angle');
  for (const [delta, eta, rate] of [[10, 0, 2], [10, 0.6, 3], [8, 1, 1.5], [-10, 0.3, 2.5]]) {
    const sb = M.sidebands({ delta, eta, rate, grid: 28 });
    const sum = sb.reduce((s, l) => s + l.I, 0), m1 = sb.reduce((s, l) => s + l.I * l.f, 0), m2 = sb.reduce((s, l) => s + l.I * l.f * l.f, 0);
    close(sum, 1, 1e-6, `δ = ${delta}, η = ${eta}: total`);
    close(m1, 0, 0.02 * Math.abs(delta), 'first moment');
    rel(m2, M.csaM2(delta, eta), 0.01, 'second moment');
  }
  // the skew of the sideband pattern follows the sign of δ, as the static powder pattern does
  const m3 = (delta) => M.sidebands({ delta, eta: 0, rate: 2, grid: 28 }).reduce((s, l) => s + l.I * l.f ** 3, 0);
  assert.ok(m3(10) > 0 && m3(-10) < 0, 'third moment has the sign of δ');
  rel(m3(10), 2 * 10 ** 3 / 35, 0.03, 'third moment 2δ³/35');
  // fast spinning leaves only the centreband; slow spinning spreads it
  assert.ok(M.sidebands({ delta: 10, eta: 0.3, rate: 150 }).find((l) => l.N === 0).I > 0.995);
  assert.ok(M.sidebands({ delta: 10, eta: 0.3, rate: 1 }).find((l) => l.N === 0).I < 0.15);
  // off the magic angle the tensor is no longer averaged: the rotor-averaged frequency is non-zero
  assert.ok(M.sidebands({ delta: 10, eta: 0, rate: 3 }).length > 5);
});
test('static powder pattern: normalised, with the Haeberlen edges and second moment', () => {
  for (const [delta, eta] of [[10, 0], [10, 0.5], [6, 1]]) {
    const p = M.powder({ delta, eta, bins: 200, grid: 300 }), w = p.f[1] - p.f[0];
    let area = 0, m1 = 0, m2 = 0; for (let i = 0; i < p.f.length; i++) { area += p.y[i] * w; m1 += p.y[i] * p.f[i] * w; m2 += p.y[i] * p.f[i] ** 2 * w; }
    close(area, 1, 1e-6, 'area'); close(m1, 0, 0.02 * delta, 'traceless');
    rel(m2, M.csaM2(delta, eta), 0.01, 'second moment');
    const on = Array.from(p.f).filter((_, i) => p.y[i] > 0);
    close(Math.max(...on), delta, 2 * w, 'upper edge at δ'); close(Math.min(...on), -delta * (1 + eta) / 2, 2 * w, 'lower edge at −δ(1+η)/2');
  }
});

// ── 演示 5：极化度 ────────────────────────────────────────────────────────
test('polarisation: thermal values, the electron at d-DNP conditions, and the DNP ceiling', () => {
  rel(M.nuclearP('H1', 9.4, 298), 3.22e-5, 5e-3, '¹H at 9.4 T and 298 K');
  rel(M.nuclearP('C13', 9.4, 298), 3.22e-5 * 0.25145, 5e-3, '¹³C is a quarter of that');
  rel(M.electronP(3.35, 1.2), 0.954, 5e-3, 'electrons at 3.35 T and 1.2 K');
  assert.ok(M.nuclearP('C13', 3.35, 1.2) < 1e-3, 'thermal ¹³C stays below 0.1% there');
  rel(M.dnpMax('H1'), 658.2, 1e-3, 'γe/γ(¹H)');
  rel(M.dnpMax('C13'), 2618, 1e-3, 'γe/γ(¹³C)');
  rel(M.nuclearP('H1', 18.8, 298), 2 * M.nuclearP('H1', 9.4, 298), 1e-6, 'linear in B at high temperature');
  rel(M.receptivity('C13').natural, 1.70e-4, 0.02, 'receptivity of ¹³C at natural abundance');
  close(M.receptivity('H1').perSpin, 1, 1e-12, '¹H is the reference');
});

// ── 内容 ──────────────────────────────────────────────────────────────────
// 中文一栏要有汉字（缩写和纯数字的短条目除外），英文一栏不能混进汉字
const both = (t, where) => assert.ok(t && typeof t.zh === 'string' && typeof t.en === 'string' && t.zh.trim() && t.en.trim() && (/[\u4e00-\u9fff]/.test(t.zh) || t.zh.length < 32) && !/[\u4e00-\u9fff]/.test(t.en), `${where}: needs zh and en`);
test('content: every status, formula, reference and link resolves, in both languages', () => {
  const ids = new Set(D.refs.map((r) => r.id));
  assert.equal(ids.size, D.refs.length, 'reference ids are unique');
  assert.equal(new Set(D.refs.map((r) => r.doi.toLowerCase())).size, D.refs.length, 'DOIs are unique');
  assert.ok(D.refs.length >= 200, 'at least 200 references');
  const statuses = new Set(Object.keys(D.status));
  assert.deepEqual([...statuses], ['established', 'active', 'hypothesis']);
  for (const k of statuses) { both(D.status[k], k); both(D.statusLong[k], k); }
  for (const r of D.refs) {
    assert.ok(statuses.has(r.status), r.id);
    assert.match(r.doi, /^10\.\d{4,}\/\S+$/, r.id);
    assert.ok(D.areas[r.area], `${r.id} area`);
    assert.ok(r.title && r.authors && r.journal && r.year >= 1936 && r.year <= 2026, `${r.id} complete`);
    assert.ok(!/undefined|null|NaN/.test(`${r.authors} ${r.title} ${r.journal} ${r.vol} ${r.pages}`), `${r.id} has no holes`);
  }
  for (const a of Object.keys(D.areas)) { both(D.areas[a], a); assert.ok(D.refs.some((r) => r.area === a), `area ${a} is used`); }
  const cited = new Set(), cite = (r, where) => { assert.ok(ids.has(r), `${where} cites ${r}`); cited.add(r); };
  const sec = (id) => D.sections.some((s) => s.id === id);
  assert.equal(D.sections.length, 11, 'eleven sections');
  for (const s of D.sections) {
    assert.ok(s.formulas.length >= 2 && s.topics.length >= 5 && s.questions.length >= 1, `${s.id} is filled in`);
    for (const [key, cap] of s.formulas) { assert.ok(D.math[key] && MATH[key]?.startsWith('<math'), `${s.id}: formula ${key}`); both(cap, `${s.id}.${key}`); }
    for (const [st, a, b, refs = []] of s.topics) { assert.ok(statuses.has(st), `${s.id} status ${st}`); both(a, s.id); both(b, s.id); assert.ok(refs.length, `${s.id}: "${a.en}" cites something`); refs.forEach((r) => cite(r, s.id)); }
    s.refs.forEach((r) => cite(r, s.id));
    for (const [q, a] of s.questions) { both(q, s.id); both(a, s.id); }
    both(s.title, s.id); both(s.intro, s.id);
    assert.ok(D.pillars.some((p) => p.id === s.id && p.num === s.pillar), `${s.id} has a pillar card`);
  }
  assert.equal(D.pillars.length, D.sections.length);
  for (const p of D.pillars) { both(p.title, p.id); both(p.summary, p.id); }
  both(D.hero.question, 'hero'); both(D.hero.lead, 'hero'); both(D.hero.honesty, 'hero');
  D.intro.forEach((p) => both(p, 'intro'));
  for (const l of D.levels) { both(l.title, l.k); both(l.text, l.k); assert.ok(statuses.has(l.status)); }
  for (const c of D.ledger) { assert.ok(statuses.has(c.status) && sec(c.section), c.id); assert.ok(c.refs.length, c.id); c.refs.forEach((r) => cite(r, c.id)); both(c.claim, c.id); both(c.evidence, c.id); both(c.caveat, c.id); }
  both(D.ledgerNote, 'ledger'); both(D.familiesNote, 'families');
  for (const k of Object.keys(D.ledgerFields)) both(D.ledgerFields[k], k);
  assert.equal(D.families.length, 8, 'eight method families');
  for (const p of D.families) { assert.ok(statuses.has(p.status) && sec(p.section), p.id); p.refs.forEach((r) => cite(r, p.id)); for (const k of Object.keys(D.familyFields)) both(p[k], `${p.id}.${k}`); both(p.name, p.id); }
  for (const k of Object.keys(D.familyFields)) both(D.familyFields[k], k);
  for (const m of D.milestones) { assert.ok(statuses.has(m.status), String(m.year)); cite(m.ref, `milestone ${m.year}`); both(m.text, String(m.year)); assert.ok(Math.abs(refById(m.ref).year - m.year) <= 6, `milestone ${m.year} cites a paper of its time (${m.ref})`); }
  const years = Array.from(D.milestones, (m) => m.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b), 'milestones in order');
  assert.ok(years[0] === 1938 && years[years.length - 1] >= 2022, 'the timeline runs from 1938 to today');
  for (const [st, area, q] of D.openQuestions) { assert.ok(statuses.has(st) && sec(area), area); both(q, 'open question'); }
  for (const k of ['ft', 'spins', 'relax', 'mas', 'polar']) { both(D.demos[k].intro, k); both(D.demos[k].notes, k); }
  for (const t of D.tools) { assert.match(t.url, /^https:\/\//, t.name); both(t.text, t.name); if (t.ref) cite(t.ref, t.name); }
  for (const r of D.refs) assert.ok(cited.has(r.id), `${r.id} is cited somewhere`);
  const html = read('index.html');
  for (const p of D.path) for (const [href, label] of p.links) {
    both(label, href); both(p.title, 'path'); both(p.text, 'path');
    if (href.startsWith('#')) { assert.ok(html.includes(`id="${href.slice(1)}"`), `anchor ${href}`); continue; }
    assert.ok(existsSync(new URL(`../public/${href.split('#')[0]}`, import.meta.url)), href);
  }
  assert.deepEqual(Object.keys(MATH).sort(), Object.keys(D.math).sort(), 'nmr-math.js is up to date: run node tools/fundamental-math.mjs nmr/');
  const used = new Set([...D.sections.flatMap((s) => s.formulas.map((f) => f[0])), ...[...html.matchAll(/data-math="(\w+)"/g)].map((m) => m[1])]);
  for (const k of Object.keys(D.math)) assert.ok(used.has(k), `formula ${k} is shown somewhere`);
  for (const m of html.matchAll(/data-math="(\w+)"/g)) assert.ok(MATH[m[1]], `demo formula ${m[1]}`);
  for (const m of html.matchAll(/data-demo-(?:intro|notes)="(\w+)"/g)) assert.ok(D.demos[m[1]], `demo text ${m[1]}`);
  // the numbers the page states in words agree with the data
  assert.match(html, /203 篇/); assert.equal(D.refs.length, 203);
  // the navigation lists the section
  assert.match(readFileSync(new URL('../public/shared-nav.js', import.meta.url), 'utf8'), /\['nmr', 'nmr\/index\.html'/);
});
function refById(id) { return D.refs.find((r) => r.id === id); }
