// 化学学科馆（/chemistry/）的测试：chem-models.js 的数学对照解析解和教科书数值；每个开放展馆的内容完整、中英齐全、
// 文献都被引用且引用都能找到、站内链接和跨馆锚点都存在、演示都登记了；总入口的数字和数据一致；生成的展馆页是最新的。
//   node --test tools/chemistry-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const pub = new URL('../public/', import.meta.url);
const read = (p) => readFileSync(new URL(p, pub), 'utf8');
const load = (...files) => { const box = { window: {} }; vm.createContext(box); for (const f of files) vm.runInContext(read(f), box); return box.window; };
const M = load('chemistry/chem-models.js').MOLASTRIA_CHEM_MODELS;
const S = load('chemistry/chem-subjects.js').MOLASTRIA_CHEM_SUBJECTS;
const SOON = new Set(S.soon || []);
const HALLS = S.subjects.map((s) => s[0]);
const OPEN = HALLS.filter((id) => !SOON.has(id));
const hall = Object.fromEntries(OPEN.map((id) => {
  const w = load(`chemistry/${id}/data.js`, `chemistry/${id}/math.js`);
  return [id, { D: w.MOLASTRIA_CHEM, MATH: w.MOLASTRIA_CHEM_MATH || {}, demos: demosOf(id) }];
}));
function demosOf(id) {
  const w = load(`chemistry/${id}/demos.js`), DEMOS = {};
  const K = new Proxy({ M, en: false, L: (zh) => zh, tx: (t) => (Array.isArray(t) ? t[0] : t) }, { get: (o, k) => (k in o ? o[k] : () => '') });
  for (const reg of w.MOLASTRIA_CHEM_DEMOS || []) reg(K, DEMOS);
  return DEMOS;
}
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} vs ${b}`);
const argmax = (f, a, b, n = 20000) => { let best = a, v = -Infinity; for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n, y = f(x); if (y > v) { v = y; best = x; } } return best; };

// ── 01–04 四大基础 ────────────────────────────────────────────────────────
test('inorganic: Aufbau exceptions, Slater shielding, Born–Haber', () => {
  assert.match(M.configText(24), /3d⁵ 4s¹$/);
  assert.match(M.configText(29), /3d¹⁰ 4s¹$/);
  assert.match(M.configText(26), /3d⁶ 4s²$/);
  close(M.slater(6, 2, 1).zeff, 3.25, 1e-9, 'Slater Z_eff of carbon 2p');
  close(M.slater(19, 4, 0).zeff, 2.2, 1e-9, 'Slater Z_eff of potassium 4s');
  // NaCl：升华 107 + 电离 496 + ½ 解离 122 + 电子亲和 −349 − 生成焓 (−411) = 787 kJ/mol
  close(M.bornHaberU({ sub: 107, ie: 496, atom: 122, ea: -349, dfH: -411 }), 787, 1e-9, 'NaCl lattice energy');
});
test('organic: Eyring prefactor, ee, Hammett, conformer populations', () => {
  rel(M.eyring(0, 298.15), (M.kB * 298.15) / M.h, 1e-12, 'k at ΔG‡ = 0 is k_BT/h');
  rel(M.eyring(5.708, 298.15) * 10, M.eyring(0, 298.15), 1e-3, '5.708 kJ/mol is one decade at 25 °C');
  close(M.ee(95, 5), 0.9, 1e-12, 'ee');
  close(M.hammett(2, 0.5), 10, 1e-12, 'Hammett ρσ = 1 is ten-fold');
  close(M.equatorial(7.3, 298.15), 0.95, 0.002, 'tert-butyl A = 7.3 kJ/mol is ~95 % equatorial... (A ≈ 7.3)');
  close(M.equatorial(0, 300), 0.5, 1e-12, 'A = 0');
});
test('physical: kinetic speeds, van der Waals critical point, consecutive reactions', () => {
  const v = M.speeds(0.028, 300);
  rel(v.rms / v.mp, Math.sqrt(1.5), 1e-12, 'v_rms / v_mp');
  rel(v.mean / v.mp, 2 / Math.sqrt(Math.PI), 1e-12, 'v_mean / v_mp');
  rel(v.mp, argmax((x) => M.mb(x, 0.028, 300), 1, 2000), 1e-3, 'Maxwell–Boltzmann maximum');
  const c = M.vdwCrit(3.640, 0.04267);
  rel(M.vdwP(c.Vc, c.Tc, 3.640, 0.04267), c.pc, 1e-9, 'p(V_c, T_c) = p_c');
  rel(c.Tc, 304, 0.01, 'CO₂ T_c from a, b');
  for (const [k1, k2] of [[1, 0.3], [0.2, 2], [1, 1]]) rel(M.tmaxB(k1, k2), argmax((t) => M.consecutive(k1, k2, t).B ?? M.consecutive(k1, k2, t)[1], 0, 20), 2e-3, `t_max for k₁ = ${k1}, k₂ = ${k2}`);
  close(M.langmuir(2, 0.5), 0.5, 1e-12, 'Langmuir half coverage at Kp = 1');
});
test('analytical: speciation sums to one, half-equivalence pH = pKa, least squares', () => {
  for (const pH of [1, 4.76, 7, 12]) close(M.alphas(pH, [2.15, 7.20, 12.35]).reduce((a, b) => a + b, 0), 1, 1e-12, `α sum at pH ${pH}`);
  const a = M.alphas(4.76, [4.76]); close(a[0], 0.5, 1e-12, 'α(HA) at pH = pKa');
  const f = M.linfit([1, 2, 3, 4], [3, 5, 7, 9]); close(f.b1, 2, 1e-12, 'slope'); close(f.b0, 1, 1e-12, 'intercept');
  close(M.t95(10), 2.228, 1e-12, 't(0.975, 10)');
  close(M.resolution(10000, 1.1, 5), (100 / 4) * (0.1 / 1.1) * (5 / 6), 1e-12, 'Purnell resolution');
});

// ── 05–08 结构、计算、配位、电化学 ─────────────────────────────────────────
test('structural and computational: hydrogen levels, Hückel benzene, particle in a box, Morse', () => {
  close(M.hydrogenE(1, 2), -3.4014, 1e-4, 'H n = 2');
  const ring = M.huckelRing(6); [2, 1, 1, -1, -1, -2].forEach((x, i) => close(ring[i], x, 1e-12, `benzene level ${i}`));
  const chain = M.huckelChain(4).sort((a, b) => b - a); close(chain[0], 1.618034, 1e-6, 'butadiene HOMO−1'); close(chain[1], 0.618034, 1e-6, 'butadiene HOMO');
  // 盒中粒子：N 个 π 电子的 HOMO→LUMO 波长和能级差一致
  const L = 578, N = 4, dE = M.boxE(N / 2 + 1, L) - M.boxE(N / 2, L);
  rel(M.boxLambda(N, L), (M.h * M.c) / dE * 1e9, 1e-12, 'box λ');
  const mo = M.morseParams(2990.9, 52.8, 0.9796);
  rel(mo.De, 2990.9 ** 2 / (4 * 52.8), 1e-12, 'Morse D_e'); assert.equal(mo.vmax, 27);
  close(M.morseG(0, 2990.9, 52.8), 2990.9 / 2 - 52.8 / 4, 1e-9, 'zero-point level');
});
test('crystals: packing fractions of the cubic cells', () => {
  for (const [t, Z, f] of [['sc', 1, Math.PI / 6], ['bcc', 2, (Math.PI * Math.sqrt(3)) / 8], ['fcc', 4, Math.PI / (3 * Math.SQRT2)], ['diamond', 8, (Math.PI * Math.sqrt(3)) / 16]]) {
    const r = M.touchRadius(t, 1); close(M.packFraction(Z, [r], M.cellVolume(t, 1)), f, 1e-12, t);
  }
  close(M.packFraction(2, [M.touchRadius('hcp', 1)], M.cellVolume('hcp', 1, Math.sqrt(8 / 3))), Math.PI / (3 * Math.SQRT2), 1e-12, 'hcp ideal c/a');
});
test('coordination: 18-electron counts', () => {
  assert.equal(M.electronCount({ group: 8, L: 5 }).count, 18, 'Fe(CO)₅');
  assert.equal(M.electronCount({ group: 6, L: 6 }).count, 18, 'Cr(CO)₆');
  const fc = M.electronCount({ group: 8, X: 2, L: 4 }); assert.equal(fc.count, 18, 'ferrocene'); assert.equal(fc.ox, 2); assert.equal(fc.d, 6);
});
test('electrochemistry: Nernst slope, Butler–Volmer, simulated CV vs Randles–Ševčík', () => {
  close(M.nernst(0, 1, 1, 0) * 1000, 59.16, 0.01, '59.16 mV per decade');
  close(M.butlerVolmer(0, 1, 0.5), 0, 1e-12, 'no net current at η = 0');
  const r = M.cv({ c: 1e-3, D: 1e-5, v: 0.1, k0: 10, steps: 4000 });
  const ip = -Math.min(...r.j), iPa = Math.max(...r.j);
  rel(ip, M.randlesSevcik(1, 1e-3, 1e-5, 0.1), 0.03, 'reversible peak current');
  const Ec = r.E[r.j.indexOf(-ip)], Ea = r.E[r.j.indexOf(iPa)];
  close((Ea - Ec) * 1000, 58, 4, 'peak separation ≈ 57–59 mV');
  close(M.specCap(1, 6.94 + 0), 3862, 5, 'Li metal ≈ 3860 mAh/g');
});

// ── 09–11 高分子、生物、材料 ──────────────────────────────────────────────
test('polymers: Carothers, Flory distribution, Mayo–Lewis, chain stiffness, Flory–Huggins', () => {
  close(M.carothers(0.99), 100, 1e-9, 'X_n at p = 0.99');
  close(M.carothers(1, 0.98), 99, 1e-9, 'X_n at full conversion with r = 0.98');
  const p = 0.95, xs = Array.from({ length: 3000 }, (_, i) => i + 1);
  close(xs.reduce((a, x) => a + M.floryN(p, x), 0), 1, 1e-9, 'number fractions sum to one');
  rel(xs.reduce((a, x) => a + x * M.floryW(p, x), 0), M.floryXw(p), 1e-9, 'X_w from the weight distribution');
  close(M.poissonD(1e6), 1, 1e-5, 'living polymerisation Đ → 1');
  close(M.mayoLewis(0.3, 1, 1), 0.3, 1e-12, 'ideal copolymerisation');
  const r1 = 0.4, r2 = 0.6, fa = (1 - r2) / (2 - r1 - r2); close(M.mayoLewis(fa, r1, r2), fa, 1e-12, 'azeotropic composition');
  close(M.charRatio(1e7, (109.47 * Math.PI) / 180), 2, 1e-3, 'freely rotating tetrahedral chain C∞ ≈ 2');
  const cr = M.fhCrit(100); close(M.fhSpinodal(cr.phi, 100), cr.chi, 1e-12, 'critical point on the spinodal');
  const [a, b] = M.fhBinodal(1, 2.5); close(a + b, 1, 2e-3, 'symmetric binodal');
  close(Math.log(b / (1 - b)), 2.5 * (2 * b - 1), 2e-2, 'symmetric binodal condition');
});
test('biochemistry: pI, Michaelis–Menten, Hill, duplex melting', () => {
  close(M.pI(M.ionCounts('G')), (8.6 + 3.6) / 2, 1e-9, 'pI with no side chains');
  close(M.mmRate(2, { Vmax: 1, Km: 2 }), 0.5, 1e-12, 'v at S = K_m');
  close(M.mmRate(4, { Vmax: 1, Km: 2, I: 1, Ki: 1, type: 'comp' }), 0.5, 1e-12, 'competitive inhibitor doubles K_m');
  close(M.hill(3, 3, 2.8), 0.5, 1e-12, 'Hill at P50');
  assert.equal(M.revComp('ATGC'), 'GCAT');
  const s = M.nnDNA('GCGCAATTGCGC'); assert.ok(s.self);
  const Tm = M.dnaTm(s.dH, s.dS, 1e-6, true); close(M.duplexFrac(Tm, s.dH, s.dS, 1e-6, true), 0.5, 1e-9, 'half melted at T_m (self-complementary)');
  const t = M.nnDNA('ACGTTGCA'.replace(/./g, (c) => c) + 'GG'); const Tm2 = M.dnaTm(t.dH, t.dS, 1e-6, t.self); close(M.duplexFrac(Tm2, t.dH, t.dS, 1e-6, t.self), 0.5, 1e-9, 'half melted at T_m');
});
test('materials: tight binding, intrinsic silicon, Brus and the CdSe sizing curve', () => {
  const [lo, hi] = M.tbBands(0, 0, 0, 1, 0); close(lo, -1, 1e-12, 'k = 0 lower band'); close(hi, 1, 1e-12, 'upper band');
  const [l1, h1] = M.tbBands(1, 0.5, -0.5, 1, 1); close(h1 - l1, 1, 1e-12, 'Peierls gap 2|δ| when |β₁| = |β₂|');
  const si = M.semi({ Eg0: 1.17, a: 4.73e-4, b: 636, me: 1.08, mh: 0.81, mun: 1400, mup: 450 }, 300);
  close(si.Eg, 1.125, 0.003, 'Si gap at 300 K'); assert.ok(si.ni > 5e9 && si.ni < 2e10, `Si n_i ${si.ni}`);
  const n = M.semi({ Eg0: 1.17, a: 4.73e-4, b: 636, me: 1.08, mh: 0.81, mun: 1400, mup: 450 }, 300, 1e16); rel(n.n, 1e16, 1e-6, 'donors fully ionised'); rel(n.n * n.p, si.ni ** 2, 1e-9, 'mass action');
  close(M.brus(1e4, 1.74, 0.13, 0.45, 10.6), 1.74, 1e-3, 'bulk limit');
  assert.ok(M.brus(2, 1.74, 0.13, 0.45, 10.6) > M.brus(4, 1.74, 0.13, 0.45, 10.6));
  close(M.cdseD(550), 3.0, 0.15, 'Yu et al. 2003: a 550 nm first exciton is a ~3 nm CdSe dot');
});

// ── 13–15 环境、核化学、化学工程 ──────────────────────────────────────────
test('environment: rain pH, carbonate fractions, CO₂ forcing, box model, atom economy', () => {
  close(M.carbOpen(420e-6, 0).pH, 5.60, 0.01, 'rain in equilibrium with 420 ppm CO₂'); close(M.carbOpen(280e-6, 0).pH, 5.69, 0.01, 'pre-industrial rain');
  const f = M.carbFrac(M.CARB.pK1); close(f[0], f[1], 1e-3, 'CO₂ = HCO₃⁻ at pK₁');
  close(M.carbFrac(8.2).reduce((a, b) => a + b, 0), 1, 1e-12, 'fractions sum');
  close(M.forcingCO2(556), 5.35 * Math.LN2, 1e-12, 'doubling forcing 3.7 W/m²');
  close(M.warming(M.forcingCO2(556)), 3, 1e-12, 'ECS at doubling');
  rel(M.box(1e4, { S: 2, tau: 5 }), 10, 1e-6, 'steady state S·τ');
  close(M.molarMass('H2O'), 18.015, 1e-3, 'water'); close(M.molarMass('Ca(OH)2'), 74.092, 2e-3, 'brackets');
  close(M.atomEconomy('C2H6O', [[1, 'C2H4'], [1, 'H2O']]), 1, 1e-12, 'hydration is 100 % atom economic');
});
test('nuclear: SEMF, decay chains, radiocarbon', () => {
  close(M.semf(26, 56).BA, 8.846, 0.005, 'Fe-56 B/A from the SEMF');
  const bestZ = (A) => { let z = 1; for (let k = 1; k < A; k++) if (M.semf(k, A).B > M.semf(z, A).B) z = k; return z; };
  assert.equal(bestZ(56), 26); assert.equal(bestZ(208), 82);
  const l1 = Math.LN2 / 65.94, l2 = Math.LN2 / 6.0072;
  close(argmax((t) => M.bateman2(t, l1, l2)[1], 0, 100), 22.8, 0.05, 'Tc-99m activity peaks at 22.8 h');
  close(M.c14Age(0.5), 5568, 1e-9, 'one Libby half-life'); close(M.c14Age(0.25), 2 * 5568, 1e-9, 'two half-lives');
});
test('chemical engineering: ideal reactors, McCabe–Thiele, Antoine', () => {
  close(M.cstrX(1), 0.5, 1e-12, 'CSTR Da = 1'); close(M.pfrX(1), 1 - Math.exp(-1), 1e-12, 'PFR Da = 1');
  close(M.tanksX(1, 1), M.cstrX(1), 1e-12, 'one tank'); close(M.tanksX(1, 1e6), M.pfrX(1), 1e-6, 'many tanks → PFR');
  const Da = 3, X2 = M.cstrX(Da, 2); close(Da * (1 - X2) ** 2, X2, 1e-12, 'second-order CSTR balance');
  close(M.pfrX(Da, 2), Da / (1 + Da), 1e-12, 'second-order PFR');
  close(M.eqX(M.eqY(0.3, 2.5), 2.5), 0.3, 1e-12, 'equilibrium curve inverts');
  const r = M.mccabe({ a: 2.5, xD: 0.95, xB: 0.05, zF: 0.5, q: 1, R: 2 });
  assert.equal(r.stages, 11); assert.equal(r.feed, 5); close(r.Rmin, 1.1, 0.005, 'R_min');
  close(Math.log((0.95 / 0.05) * (0.95 / 0.05)) / Math.log(2.5), 6.43, 0.005, 'Fenske');
  const B = [6.90565, 1211.033, 220.79], T = [6.95464, 1344.8, 219.482];
  close(M.bubbleT(1, 760, B, T).T, 80.1, 0.1, 'benzene boils at 80.1 °C'); close(M.bubbleT(0, 760, B, T).T, 110.6, 0.1, 'toluene at 110.6 °C');
  const bp = M.bubbleT(0.5, 760, B, T); close(bp.T, 92.1, 0.1, 'equimolar bubble point'); close(bp.y1, 0.714, 0.005, 'vapour composition');
  close(M.dewT(bp.y1, 760, B, T).x1, 0.5, 1e-6, 'dew point returns the liquid');
});

// ── 内容 ────────────────────────────────────────────────────────────────
const CJK = /[㐀-鿿]/;
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };
const pairs = (v, at, out = []) => {
  if (Array.isArray(v)) { if (v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string' && CJK.test(v[0])) out.push([at, v]); else v.forEach((x, i) => pairs(x, `${at}[${i}]`, out)); }
  else if (v && typeof v === 'object' && typeof v !== 'function') for (const [k, x] of Object.entries(v)) pairs(x, `${at}.${k}`, out);
  return out;
};
const bi = (t, what) => { assert.ok(Array.isArray(t) && t.length === 2 && t[0].trim() && t[1].trim(), `${what} needs [zh, en]`); assert.ok(!CJK.test(t[1]), `${what}: Chinese in the English text`); };
const target = (path) => { const [file, hash] = path.split('#'); return { file, hash }; };
const anchorOk = (file, hash) => {
  const m = file.match(/^chemistry\/([\w-]+)\/index\.html$/);
  if (m) { if (SOON.has(m[1])) return !hash; const H = hall[m[1]]; return !hash || (hash.startsWith('c-') && H.D.chapters.some((c) => c.id === hash.slice(2))) || ['chm-demos', 'chm-quiz', 'chm-refs', 'chm-time'].includes(hash); }
  if (!hash) return true;
  const dir = new URL(file.replace(/[^/]+$/, ''), pub), id = hash.replace(/^[a-z]+-/, '');
  const re = new RegExp(`(^|[^\\w-])${id.replace(/[-]/g, '\\-')}([^\\w-]|$)`);
  return readdirSync(dir).filter((f) => f.endsWith('.js')).some((f) => re.test(readFileSync(new URL(f, dir), 'utf8')));
};

for (const id of OPEN) {
  test(`${id}: structure, both languages, references, links, formulas and demos`, () => {
    const { D, MATH, demos } = hall[id];
    assert.equal(D.id, id);
    assert.match(D.checked, /^\d{4}-\d{2}-\d{2}$/);
    for (const k of ['question', 'lead', 'scope']) bi(D.hero[k], `${id} hero.${k}`);
    const chIds = D.chapters.map((c) => c.id);
    assert.equal(new Set(chIds).size, chIds.length, 'chapter ids unique');
    const refIds = D.refs.map((r) => r.id);
    assert.equal(new Set(refIds).size, refIds.length, 'ref ids unique');
    assert.equal(new Set(D.refs.map((r) => r.doi.toLowerCase())).size, refIds.length, 'one entry per DOI');
    for (const r of D.refs) { assert.match(r.doi, /^10\.\d{4,9}\/\S+$/, r.id); assert.ok(r.authors && r.title && r.journal && r.year, r.id); }
    for (const [at, [zh, en]] of pairs(D, id)) { assert.ok(en.trim(), `${at}: English missing`); assert.ok(!CJK.test(en), `${at}: Chinese in the English text: ${en.slice(0, 60)}`); assert.ok(/[A-Za-z0-9]/.test(en) || !zh.trim(), `${at}: English looks empty`); }
    const text = strings(D).join('\n'), demoText = Object.values(demos).flatMap((x) => strings([x.note, x.intro])).join('\n');
    const cited = new Set([...(text + demoText).matchAll(/\[@([\w-]+(?:\s*,\s*[\w-]+)*)\]/g)].flatMap((m) => m[1].split(',').map((x) => x.trim())));
    for (const c of D.chapters) for (const r of c.refs || []) cited.add(r);
    for (const m of D.milestones || []) for (const r of m.refs || []) cited.add(r);
    for (const r of cited) assert.ok(refIds.includes(r), `${id}: cites missing ref ${r}`);
    for (const r of refIds) assert.ok(cited.has(r), `${id}: ref ${r} is never cited`);
    for (const m of text.matchAll(/\{\{ch:([\w-]+)\}\}/g)) assert.ok(chIds.includes(m[1]), `${id}: {{ch:${m[1]}}}`);
    const links = [...text.matchAll(/\[\[([^|\]]+)\|/g)].map((m) => m[1]);
    for (const c of D.chapters) for (const [p] of c.site || []) links.push(p);
    for (const [p] of D.siteLinks || []) links.push(p);
    for (const p of links) {
      const { file, hash } = target(p);
      assert.ok(existsSync(new URL(file, pub)), `${id}: link to missing page ${p}`);
      assert.ok(anchorOk(file, hash), `${id}: link to missing anchor ${p}`);
    }
    for (const c of D.chapters) {
      assert.ok(['core', 'adv', 'frontier'].includes(c.level), `${id}/${c.id} level`);
      bi(c.title, `${id}/${c.id} title`); bi(c.summary, `${id}/${c.id} summary`);
      assert.ok(c.body?.length >= 2, `${id}/${c.id} body`);
      assert.ok(c.example?.q && c.example.steps?.length && c.example.a, `${id}/${c.id} worked example`);
      for (const [k] of c.math || []) { assert.ok(D.math[k], `${id}/${c.id} formula ${k} missing`); assert.ok(MATH[k], `${id}: formula ${k} not in math.js (node tools/fundamental-math.mjs chemistry/${id})`); }
      for (const d of c.demos || []) {
        const x = demos[d];
        assert.ok(x, `${id}/${c.id}: demo ${d} not registered`);
        bi(x.title, `${id} demo ${d} title`);
        assert.ok(['exact', 'model', 'data'].includes(x.kind || 'model') && typeof x.draw === 'function' && x.figs?.length, `${id} demo ${d}`);
        for (const [ratio, cap] of x.figs) if (ratio !== 'html' || cap?.[0]) bi(cap, `${id} demo ${d} caption`);
        for (const [, preset] of x.btn || []) for (const k of Object.keys(preset)) assert.ok([...(x.ctl || []), ...(x.sel || []), ...(x.chk || [])].some((q) => q[0] === k) || k in (x.state || {}), `${id} demo ${d}: preset sets unknown control ${k}`);
      }
    }
    for (const d of Object.keys(demos)) assert.ok(D.chapters.some((c) => (c.demos || []).includes(d)), `${id}: demo ${d} is never shown`);
    for (const k of Object.keys(D.math)) assert.ok(D.chapters.some((c) => (c.math || []).some(([x]) => x === k)), `${id}: formula ${k} unused`);
    for (const q of D.quiz) { bi(q.q, `${id} quiz`); assert.ok(q.a >= 0 && q.a < q.opts.length, `${id} quiz answer`); assert.ok(!q.ch || chIds.includes(q.ch), `${id} quiz chapter ${q.ch}`); }
    for (const [, ch] of D.open || []) assert.ok(!ch || chIds.includes(ch), `${id} open question chapter ${ch}`);
    assert.ok(D.milestones.length >= 5 && D.quiz.length >= 5 && D.books.length >= 3, `${id}: timeline, quiz and books`);
  });
}

test('hub: counts in chem-subjects.js match the halls; soon halls have no content yet', () => {
  for (const [id, , group, zh, en, line, chapters, demos, refs, relIds] of S.subjects) {
    assert.ok(S.groups.some((g) => g.id === group), `${id} group`);
    assert.ok(zh && en && line?.length === 2, `${id} names`);
    for (const r of relIds) assert.ok(HALLS.includes(r), `${id}: related hall ${r}`);
    if (SOON.has(id)) { assert.deepEqual([chapters, demos, refs], [0, 0, 0], `${id} is not open yet`); assert.ok(!existsSync(new URL(`chemistry/${id}/data.js`, pub))); continue; }
    const { D } = hall[id];
    assert.deepEqual([chapters, demos, refs], [D.chapters.length, new Set(D.chapters.flatMap((c) => c.demos || [])).size, D.refs.length], `${id} counts (chem-subjects.js)`);
  }
});
test('the materials hall links back to the two MOF news items', () => {
  const porous = hall.materials.D.chapters.find((c) => c.id === 'porous');
  const sites = porous.site.map(([p]) => p);
  for (const n of ['mof-radical-pairs', 'mof-odmr']) { assert.ok(sites.includes(`news/index.html#n-${n}`), n); assert.ok(read('news/news-data.js').includes(`id: '${n}'`), `news item ${n}`); }
});
test('generated hall pages are up to date', () => {
  const out = execFileSync(process.execPath, [new URL('chemistry-pages.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
  for (const id of SOON) assert.ok(!read(`chemistry/${id}/index.html`).includes('data.js'), `${id} page must not load data.js`);
});
