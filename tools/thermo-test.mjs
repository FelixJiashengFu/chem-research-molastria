// 代码台和计算工作台的热化学（public/code/thermo-core.js，GoodVibes 的 JS 移植）：
//   node --test tools/thermo-test.mjs
// 1. 七份真实频率输出（Gaussian 09/16、ORCA 5、NWChem 7 的摘录，见 tools/thermo-fixtures/README.md）在八组选项下和真的 GoodVibes 4.4.0 对照：
//    ZPE、H、准谐 H、T·S、准谐 T·S、G、准谐 G 每一项差不到 1e-5 Eh（约 0.006 kcal/mol）。参考数字在 goodvibes-ref.json，
//    由 tools/thermo-goodvibes.py 生成；本机 python3 装了 goodvibes 时，测试会重跑它，看 JSON 是不是最新的（THERMO_SKIP_PYTHON=1 跳过）。
// 2. 每一项对照教科书的闭式：单原子只有平动，高温极限、零频极限、1 atm → 1 M 的 RT ln 24.46、对称数、直线形分子。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const Code = require('../public/code/code-core.js');
const TH = require('../public/code/thermo-core.js');
const DIR = new URL('./thermo-fixtures/', import.meta.url);
const fixture = (f) => readFileSync(new URL(f, DIR), 'utf8');
const REF = JSON.parse(fixture('goodvibes-ref.json'));
const TOL = 1e-5; // Eh

function ours(file, opts) {
  const t = fixture(file);
  const parsed = Code.parseOutput(t);
  const info = TH.fromOutput(t, parsed);
  return { parsed, info, r: TH.compute(TH.molOf(info), opts) };
}

test('every fixture is used and every option set is covered', () => {
  const outs = readdirSync(DIR).filter((f) => f.endsWith('.out')).sort();
  assert.deepEqual(Object.keys(REF.files).sort(), outs);
  assert.equal(REF.goodvibes, '4.4.0');
  assert.ok(Object.keys(REF.cases).length >= 8);
  const progs = new Set(outs.map((f) => Code.parseOutput(fixture(f)).program));
  assert.deepEqual([...progs].sort(), ['gaussian', 'nwchem', 'orca']);
});

test('matches GoodVibes for every fixture and every option (ZPE, H, qh-H, T·S, qh-T·S, G, qh-G within 1e-5 Eh)', () => {
  let n = 0;
  for (const [file, rows] of Object.entries(REF.files)) {
    for (const [name, want] of Object.entries(rows)) {
      const { r } = ours(file, REF.cases[name]);
      const where = `${file} / ${name}`;
      assert.ok(Math.abs(r.energy - want.scf_energy) < 1e-9, `${where}: electronic energy`);
      assert.equal(r.sigma, want.symmno, `${where}: symmetry number`);
      assert.equal(r.mult, want.mult, `${where}: multiplicity`);
      assert.deepEqual(r.imaginary, want.im, `${where}: imaginary`);
      assert.deepEqual(r.inverted, want.inverted, `${where}: inverted`);
      const pairs = [['zpe', r.zpe, want.zpe], ['H', r.H, want.enthalpy], ['TS', r.TS, want.TS], ['qhTS', r.qhTS, want.qh_TS], ['G', r.G, want.gibbs_free_energy], ['qhG', r.qhG, want.qh_gibbs_free_energy]];
      if (REF.cases[name].qh) pairs.push(['qhH', r.qhH, want.qh_enthalpy]);
      for (const [k, a, b] of pairs) { assert.ok(Math.abs(a - b) < TOL, `${where}: ${k} ${a} vs GoodVibes ${b} (Δ ${(a - b).toExponential(2)})`); n++; }
    }
  }
  assert.ok(n > 300, `compared ${n} numbers`);
});

test('the reference JSON is what GoodVibes gives today', { skip: process.env.THERMO_SKIP_PYTHON === '1' }, (t) => {
  let out;
  try { out = execFileSync('python3', [new URL('./thermo-goodvibes.py', import.meta.url).pathname, '--print'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { t.skip('python3 with goodvibes is not installed'); return; }
  const now = JSON.parse(out);
  for (const [file, rows] of Object.entries(REF.files)) {
    for (const [name, want] of Object.entries(rows)) {
      for (const k of ['zpe', 'enthalpy', 'qh_enthalpy', 'gibbs_free_energy', 'qh_gibbs_free_energy', 'TS', 'qh_TS']) assert.ok(Math.abs(now.files[file][name][k] - want[k]) < 1e-9, `${file} ${name} ${k}: rerun python3 tools/thermo-goodvibes.py`);
    }
  }
});

test('what is read from each output', () => {
  const h2o = ours('gaussian-h2o.out', {});
  assert.deepEqual(h2o.info.from, ['sigma', 'masses']);
  assert.equal(h2o.info.pointGroup, '');
  assert.equal(h2o.r.sigma, 2);
  const hcn = ours('gaussian-hcn-triplet.out', {});
  assert.equal(hcn.r.linear, true);
  assert.equal(hcn.r.mult, 3);
  assert.equal(hcn.r.rotTemps.length, 1);
  assert.ok(Math.abs(hcn.r.rotTemps[0] - 1.67171) < 1e-4, 'rotational temperature as Gaussian prints it');
  assert.equal(hcn.r.imaginary.length, 1);
  assert.ok(hcn.r.warnings.some((w) => w.id === 'imag'));
  const al = ours('gaussian-al-atom.out', {});
  assert.equal(al.r.monatomic, true);
  assert.equal(al.r.mult, 2);
  assert.equal(al.r.freqs.length, 0);
  const orca = ours('orca5-dvb-freq.out', {});
  assert.deepEqual(orca.info.from, ['sigma', 'mass', 'rot']);
  assert.equal(orca.info.pointGroup, 'C2h');
  assert.equal(orca.r.mass, 130.19, 'ORCA uses average atomic masses; its own value is kept');
  const nw = ours('nwchem7-dvb-freq.out', {});
  assert.equal(nw.r.sigma, 2);
  assert.equal(nw.r.freqs.length, 54);
});

// ── 闭式 ──────────────────────────────────────────────────────────────
const R = 8.3144621, J = TH.J_TO_AU;
test('a single atom has only translation (and spin): H − E = 5/2 RT, S = Sackur–Tetrode + R ln m', () => {
  const T = 298.15;
  const r = TH.compute({ energy: -1, freqs: [], atoms: [{ el: 'Ar', x: 0, y: 0, z: 0 }], mult: 1 }, { T });
  assert.ok(Math.abs((r.H + 1) * J - 2.5 * R * T) < 1e-9);
  // argon at 298.15 K, 1 atm: 154.8 J/(mol K) (NIST); with these constants 154.73
  assert.ok(Math.abs(r.S * J - 154.73) < 0.05, `S(Ar) = ${r.S * J}`);
  const d = TH.compute({ energy: -1, freqs: [], atoms: [{ el: 'Ar', x: 0, y: 0, z: 0 }], mult: 2 }, { T });
  assert.ok(Math.abs((d.S - r.S) * J - R * Math.log(2)) < 1e-9, 'doublet adds R ln 2');
});

test('1 atm → 1 mol/L shifts G by RT ln(RT/p°) ≈ 1.89 kcal/mol at 298.15 K and leaves H alone', () => {
  const mol = { energy: -76, freqs: [1600, 3700, 3800], atoms: [{ el: 'O', x: 0, y: 0, z: 0.12 }, { el: 'H', x: 0, y: 0.76, z: -0.48 }, { el: 'H', x: 0, y: -0.76, z: -0.48 }], sigma: 2 };
  const gas = TH.compute(mol, {}), sol = TH.compute(mol, { conc: 1 });
  assert.equal(gas.H, sol.H);
  const d = (sol.G - gas.G) * TH.KCAL;
  assert.ok(Math.abs(d - 1.8943) < 2e-3, `ΔG = ${d}`);
  assert.ok(Math.abs(TH.concCorrection(298.15, 1) * TH.KCAL - d) < 1e-9);
});

test('high-temperature limit of a vibration: U → RT, S → R(1 + ln(kT/hcν)); ZPE = ½hcν', () => {
  const T = 1e5, nu = 10;
  const x = (6.62606957e-34 * nu * 2.99792458e10) / (1.3806488e-23 * T);
  assert.ok(Math.abs(TH.terms.uVib(T, [nu], 1) / (R * T) - 1) < 1e-4);
  assert.ok(Math.abs(TH.terms.sRRHO(T, [nu], 1)[0] - R * (1 - Math.log(x))) < 1e-3);
  assert.ok(Math.abs(TH.terms.zpe([1000], 1) / J * 219474.63 - 500) < 0.01, 'ZPE of a 1000 cm⁻¹ mode is 500 cm⁻¹');
});

test('quasi-RRHO: high modes keep the harmonic entropy, low modes go to the free rotor; the weight is ½ at the cutoff', () => {
  const w = TH.terms.damp([100, 1000, 10], 100, 4);
  assert.ok(Math.abs(w[0] - 0.5) < 1e-12);
  assert.ok(w[1] > 0.9999 && w[2] < 1e-3);
  const T = 298.15, mol = { energy: 0, freqs: [12, 25, 1500], atoms: [{ el: 'C', x: 0, y: 0, z: 0 }, { el: 'O', x: 1.1, y: 0, z: 0 }, { el: 'H', x: -0.5, y: 0.9, z: 0 }], sigma: 1 };
  const g = TH.compute(mol, { T, qs: 'grimme' }), h = TH.compute(mol, { T, qs: 'rrho' }), tr = TH.compute(mol, { T, qs: 'truhlar' });
  assert.ok(g.qhS < h.qhS, 'the free rotor tames the diverging harmonic entropy of very soft modes');
  assert.ok(tr.qhS < h.qhS);
  assert.ok(Math.abs(g.modes[2].s - g.modes[2].sRRHO) < 1e-3 && g.modes[2].weight > 0.9999);
  assert.ok(h.warnings.some((x) => x.id === 'low'));
  // Truhlar: modes below the cutoff count as if they were at the cutoff (entropy only)
  const at = TH.terms.sRRHO(T, [100], 1)[0];
  assert.ok(Math.abs(tr.modes[0].s - at) < 1e-12 && Math.abs(tr.modes[1].s - at) < 1e-12);
  assert.equal(tr.H, h.H, 'Truhlar does not touch the enthalpy (as in GoodVibes)');
  // Head-Gordon: a very soft mode contributes ½RT instead of ≈ RT
  const q = TH.compute({ ...mol, freqs: [1] }, { T, qh: true, hCutoff: 100 });
  assert.ok(Math.abs(q.terms.vib.qhU - 0.5 * R * T) < 1e-3 * R * T);
});

test('symmetry numbers from point groups (rotational subgroup order)', () => {
  const want = { C1: 1, Cs: 1, Ci: 1, C2: 2, C2v: 2, C3v: 3, C2h: 2, D2h: 4, D3h: 6, D6h: 12, D2d: 4, D3d: 6, S4: 2, S6: 3, Td: 12, Oh: 24, Ih: 60, 'D∞h': 2, 'C∞v': 1, 'D*H': 2, 'C*V': 1, Dinfh: 2, 'C₂ᵥ': 2, 'D₆ₕ': 12 };
  for (const [pg, s] of Object.entries(want)) assert.equal(TH.symmetryNumber(pg), s, pg);
  assert.equal(TH.symmetryNumber('nonsense'), null);
  // σ only enters S_rot as −R ln σ
  const mol = { energy: 0, freqs: [1000, 1200, 1500], atoms: [{ el: 'O', x: 0, y: 0, z: 0.12 }, { el: 'H', x: 0, y: 0.76, z: -0.48 }, { el: 'H', x: 0, y: -0.76, z: -0.48 }] };
  const a = TH.compute({ ...mol, sigma: 1 }, {}), b = TH.compute({ ...mol, sigma: 2 }, {});
  assert.ok(Math.abs((a.S - b.S) * J - R * Math.log(2)) < 1e-9);
});

test('rotor: linear molecules are recognised and get RT and one rotational temperature; mode counts are checked', () => {
  const co2 = [{ el: 'O', x: 0, y: 0, z: -1.16 }, { el: 'C', x: 0, y: 0, z: 0 }, { el: 'O', x: 0, y: 0, z: 1.16 }];
  const rot = TH.rotor(co2);
  assert.equal(rot.linear, true);
  assert.equal(rot.rotTemps.length, 1);
  // B(CO₂) with r = 1.16 Å: I = 2·15.9949·1.16² = 43.04 amu Å² → B = 0.3916 cm⁻¹ → θ = 0.5635 K
  assert.ok(Math.abs(rot.rotTemps[0] - 0.5635) < 1e-3, `θ = ${rot.rotTemps[0]}`);
  const r = TH.compute({ energy: 0, freqs: [667, 667, 1333, 2349], atoms: co2, sigma: 2 }, {});
  assert.ok(Math.abs(r.terms.rot.U - R * 298.15) < 1e-9);
  assert.equal(r.warnings.filter((w) => w.id === 'count').length, 0, '3N − 5 = 4 modes');
  const bad = TH.compute({ energy: 0, freqs: [667, 1333, 2349], atoms: co2, sigma: 2 }, {});
  assert.ok(bad.warnings.some((w) => w.id === 'count'));
  // the moments do not depend on orientation
  const s = Math.SQRT1_2, turned = co2.map((a) => ({ ...a, x: a.z * s, y: 0, z: a.z * s }));
  assert.ok(Math.abs(TH.rotor(turned).rotTemps[0] - rot.rotTemps[0]) < 1e-12);
});

test('bad input is refused with a clear message', () => {
  assert.throws(() => TH.compute({ energy: 0, freqs: [100], atoms: [] }, {}), /结构/);
  assert.throws(() => TH.compute({ energy: 0, freqs: [], atoms: [{ el: 'He', x: 0, y: 0, z: 0 }] }, { T: 0 }), /温度/);
  assert.throws(() => TH.compute({ energy: 0, freqs: [], atoms: [{ el: 'He', x: 0, y: 0, z: 0 }] }, { conc: -1 }), /浓度/);
});

test('the browser files are wired up on both pages', () => {
  const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');
  for (const page of ['code/index.html', 'workbench/index.html']) {
    const h = read(page);
    assert.match(h, /thermo-core\.js[\s\S]*thermo\.js/, page);
    assert.match(h, /thermo\.js/, page);
    assert.match(h, /thermo\.css/, page);
  }
  assert.match(read('code/thermo-core.js'), /Copyright 2017 Robert Paton, University of Oxford/);
  assert.match(read('code/THIRD-PARTY-goodvibes.md'), /Copyright 2017 Robert Paton/);
  assert.match(read('code/thermo.js'), /translate', 'no'|translate="no"/);
});
