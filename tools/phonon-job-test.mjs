// Tests for the Code Desk's phonon tab (public/code/phonon-core.js): presets, the POSCAR / CIF readers it uses for
// its estimates, the request body, how a result becomes the dispersion, DOS and thermal curves and the CSV, and the
// phonopy script it hands out. The limits and presets are checked against the two other places that hold them: the
// account service (deploy/account-worker.js) and the model server (tools/uma-server/phonon_backend.py, server.py).
// The result used is a real EMT copper run (tools/uma-server/fixtures/phonon-cu-emt.json). Every script is compiled
// by python3; where phonopy, spglib and seekpath are installed the EMT scripts run for real.
//   node --test tools/phonon-job-test.mjs        (PHONON_SKIP_PYTHON=1 skips the Python part)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/code/phonon-core.js', import.meta.url), 'utf8'), box);
const P = box.window.MolAstriaPhonon;
const plain = (v) => JSON.parse(JSON.stringify(v));
const worker = readFileSync(new URL('../deploy/account-worker.js', import.meta.url), 'utf8');
const backend = readFileSync(new URL('./uma-server/phonon_backend.py', import.meta.url), 'utf8');
const server = readFileSync(new URL('./uma-server/server.py', import.meta.url), 'utf8');
const FIX = JSON.parse(readFileSync(new URL('./uma-server/fixtures/phonon-cu-emt.json', import.meta.url), 'utf8'));
const py = (name) => backend.match(new RegExp(`^${name} = ([^#\\n]+)`, 'm'))[1].trim();
const pyTuple = (name) => [...py(name).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const state = (o = {}) => ({ source: 'preset', preset: 'Cu', engine: 'emt', structure: '', format: 'poscar', supercell: [2, 2, 2], displacement: 0.01, relax: true, mesh: 16, tMax: 1000, ...o });

test('the same limits, presets and cost as the model server and the account service', () => {
  const L = P.LIMITS;
  assert.equal(Number(py('MAX_TEXT')), L.maxText);
  assert.equal(Number(py('MAX_CELL_ATOMS')), L.maxCellAtoms);
  assert.equal(Number(py('MAX_SUPERCELL_ATOMS')), L.maxSupercellAtoms);
  assert.equal(Number(py('MAX_DISPLACEMENTS')), L.maxDisplacements);
  assert.equal(Number(py('SUPERCELL_MAX')), L.supercellMax);
  for (const [k, name] of [['disp', 'DISP'], ['mesh', 'MESH'], ['tmax', 'TMAX']]) assert.deepEqual(JSON.parse(py(name).replace(/[()]/g, (c) => (c === '(' ? '[' : ']'))), plain(L[k]), name);
  assert.equal(Number(py('IMAG_THZ')), P.IMAG_THZ);
  assert.deepEqual(pyTuple('EMT_METALS'), plain(P.EMT_METALS));
  assert.deepEqual(pyTuple('FORMATS'), ['poscar', 'cif']);
  // presets: the same ids, kinds and lattice constants
  const presets = [...backend.matchAll(/"(\w+)": \("(fcc|diamond|rocksalt)", ([\d.]+)\)/g)].map((m) => [m[1], m[2], Number(m[3])]);
  assert.deepEqual(presets, plain(P.PRESETS.map((p) => [p.id, p.kind, p.a])));
  // the account service: presets, EMT metals, ranges, the cost and the models
  const W = Function(`return ${worker.match(/const PHONON = (\{[^\n]+\});/)[1]}`)();
  assert.deepEqual(W.presets, plain(P.PRESETS.map((p) => p.id)));
  assert.deepEqual(W.emt, plain(P.EMT_METALS));
  assert.equal(W.maxText, L.maxText);
  assert.equal(W.supercellMax, L.supercellMax);
  assert.ok(worker.includes(`displacement: pnum(${L.disp[0]}, ${L.disp[1]}), relax: pbool, mesh: pnum(${L.mesh[0]}, ${L.mesh[1]}, true), t_max: pnum(${L.tmax[0]}, ${L.tmax[1]}, true)`), 'the worker ranges');
  assert.equal(Number(worker.match(/qslab: 3, phon: (\d+) \}/)[1]), P.COST);
  assert.ok(worker.includes(`'phonopy-emt': 'open'`));
  const omat = [...worker.match(/const UMA_OMAT = new Set\(\[([^\]]+)\]\)/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(omat, plain(P.ENGINES.filter((e) => !e.emtOnly).map((e) => e.model)));
  // the model server: the same models carry phon, and the time limit
  for (const m of omat) assert.match(server, new RegExp(`"?${m === 'uma-s-1p2p1' ? 'UMA' : `"${m}"`}"?: _fair\\("[^"]+", (True|False), omat=True\\)`), m);
  assert.match(server, /"phonopy-emt": \{"name": "phonopy · EMT", "lane": "phonon", "jobs": PH_JOBS/);
  assert.match(server, /"phon": 900\}/);
});

test('parsePoscar and parseCif: what the estimate needs, and readable errors', () => {
  const si = P.parsePoscar(P.SAMPLES.poscar);
  assert.equal(si.n, 2);
  assert.deepEqual(plain(si.counts), { Si: 2 });
  assert.ok(Math.abs(si.volume - 40.05) < 0.05, si.volume); // a³/4 for a = 5.431
  const nacl = P.parsePoscar('NaCl\n1.0\n5.64 0 0\n0 5.64 0\n0 0 5.64\nNa Cl\n4 4\nSelective dynamics\nDirect\n' + '0 0 0 T T T\n'.repeat(8));
  assert.deepEqual(plain(nacl.counts), { Na: 4, Cl: 4 });
  assert.match(P.parsePoscar('x\n1\n1 0 0\n0 1 0\n0 0 1\n4\nDirect\n0 0 0\n').error, /第 6 行要写元素符号/);
  assert.match(P.parsePoscar('x\n1\n1 0 0\n0 1 0\n0 0 1\nCu\n2\nDirect\n0 0 0\n').error, /坐标只有 1 行/);
  assert.match(P.parsePoscar('x\n1\n1 0 0\n2 0 0\n0 0 1\nCu\n1\nDirect\n0 0 0\n').error, /体积是零/);
  const c = P.parseCif(P.SAMPLES.cif);
  assert.deepEqual(plain([c.sites, c.symbols, c.symops]), [2, ['Na', 'Cl'], true]);
  assert.match(P.parseCif('data_x\n_cell_length_a 3\n').error, /_cell_length_a/);
  assert.equal(P.guessFormat(P.SAMPLES.cif), 'cif');
  assert.equal(P.guessFormat(P.SAMPLES.poscar), 'poscar');
});

test('estimate, engines and the request body', () => {
  assert.deepEqual(plain(P.estimate(state())).superAtoms, 32);
  assert.equal(P.estimate(state({ preset: 'Si', supercell: [3, 3, 3] })).superAtoms, 216);
  assert.match(P.estimate(state({ preset: 'Si', supercell: [3, 3, 4] })).error, /最多 216/);
  assert.match(P.estimate(state({ supercell: [5, 1, 1] })).error, /1 到 4/);
  assert.match(P.estimate(state({ source: 'structure', structure: 'x'.repeat(8001) })).error, /8000/);
  assert.match(P.estimate(state({ source: 'structure', structure: P.SAMPLES.poscar.replace('Si\n2', 'Si\n2　') })).error, /ASCII/);
  assert.equal(P.engineProblem(state({ preset: 'NaCl' }), P.estimate(state({ preset: 'NaCl' }))), 'EMT 只算 Al、Cu、Ag、Au、Ni、Pd、Pt，这个晶体里有 Na、Cl；换成 UMA');
  assert.equal(P.engineProblem(state({ preset: 'NaCl', engine: 'uma' }), P.estimate(state({ preset: 'NaCl' }))), '');
  assert.deepEqual(plain(P.body(state())), { job: 'phon', model: 'phonopy-emt', params: { preset: 'Cu', supercell: [2, 2, 2], displacement: 0.01, relax: true, mesh: 16, t_max: 1000 } });
  const b = P.body(state({ source: 'structure', structure: P.SAMPLES.cif.replace(/\n/g, '\r\n'), format: 'cif', engine: 'uma-s-1p1', relax: false }));
  assert.deepEqual(plain([b.model, b.params.format, b.params.relax, 'preset' in b.params, b.params.structure]), ['uma-s-1p1', 'cif', false, false, P.SAMPLES.cif]);
  assert.throws(() => P.body(state({ preset: 'Si' })), /EMT 只算/);
  assert.throws(() => P.body(state({ displacement: 0.2 })), /位移/);
  assert.throws(() => P.body(state({ mesh: 40 })), /网格/);
  assert.throws(() => P.body(state({ tMax: 50 })), /最高温度/);
});

test('a real result: dispersion, DOS, thermal curves, the verdict and the CSV', () => {
  const bd = P.band(FIX);
  assert.equal(bd.series.length, FIX.band.segments.length * 3); // three branches per segment for one atom per cell
  assert.deepEqual(plain(bd.ticks.map((t) => t.label)), ['Γ', 'X', 'U|K', 'Γ', 'L', 'W', 'X']);
  assert.ok(Math.abs(bd.lo) < 1e-3 && bd.hi > 7 && bd.hi < 9, `${bd.lo} ${bd.hi}`);
  const cm = P.band(FIX, 'cm1');
  assert.ok(Math.abs(cm.hi / bd.hi - 33.35641) < 1e-9);
  for (const u of ['thz', 'cm1', 'mev']) { const d = P.dos(FIX, u); assert.ok(Math.abs(P.trapz(d.xs, d.ys) - 3) < 0.05, u); } // 3 modes per primitive cell in every unit
  const t = P.thermal(FIX);
  assert.equal(t.n, 1);
  assert.ok(Math.abs(t.Cv.at(-1) / t.dp - 1) < 0.01, 'Dulong–Petit at 1000 K');
  const r300 = P.at(FIX, 298.15);
  assert.equal(r300.T, 300);
  assert.ok(r300.S > 28 && r300.S < 34);
  assert.deepEqual(plain(P.verdict(FIX).map((v) => v[0])), ['ok']);
  assert.match(P.verdict({ ...FIX, imaginary: true, min_frequency_thz: -1.2, n_imaginary_mesh: 12 })[0][1], /有虚频：最低 -1.20 THz/);
  const lines = P.csv(FIX).split('\n');
  assert.equal(lines[0], 'distance,segment,band1_thz,band2_thz,band3_thz');
  assert.match(lines[1], /^0\.00000,Γ-X,/);
  assert.equal(lines.filter((l) => l === '').length, 3); // two separators and the final newline
  assert.ok(lines.includes('temperature_k,free_energy_kj_mol,entropy_j_k_mol,heat_capacity_j_k_mol'));
});

const PYTHON = process.env.PHONON_PYTHON || 'python3';
const hasPhonopy = !process.env.PHONON_SKIP_PYTHON && spawnSync(PYTHON, ['-c', 'import phonopy, spglib, seekpath, ase'], { encoding: 'utf8' }).status === 0;
const hasPython = !process.env.PHONON_SKIP_PYTHON && spawnSync(PYTHON, ['--version']).status === 0;

test('the scripts compile; the EMT ones run with phonopy', { skip: !hasPython && 'no python3' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'phonon-'));
  try {
    const cases = [
      ['preset', state({ supercell: [3, 3, 3] }), true],
      ['poscar', state({ source: 'structure', structure: 'Cu fcc primitive\n1.0\n0 1.8 1.8\n1.8 0 1.8\n1.8 1.8 0\nCu\n1\nDirect\n0 0 0\n', relax: false }), true],
      ['uma', state({ preset: 'NaCl', engine: 'uma' }), false],
      ['cif', state({ source: 'structure', structure: P.SAMPLES.cif, format: 'cif', engine: 'uma-s-1p2' }), false],
    ];
    for (const [name, s, run] of cases) {
      const file = join(dir, `${name}.py`);
      writeFileSync(file, P.script(s));
      const c = spawnSync(PYTHON, ['-m', 'py_compile', file], { encoding: 'utf8' });
      assert.equal(c.status, 0, `${name}: ${c.stderr}`);
      if (!run || !hasPhonopy) continue;
      const r = spawnSync(PYTHON, ['-X', 'utf8', file], { cwd: dir, encoding: 'utf8', timeout: 120000 });
      assert.equal(r.status, 0, `${name}: ${r.stderr}`);
      assert.match(r.stdout, /space group Fm-3m \(225\), 4 atoms in the conventional cell/);
      assert.match(r.stdout, /\(no imaginary modes\)/);
      assert.match(r.stdout, new RegExp(`${name === 'preset' ? 108 : 32} atoms in the supercell, 1 displaced supercells`));
      const last = r.stdout.split('\n').filter((l) => /^\s+1000 /.test(l))[0].trim().split(/\s+/).map(Number);
      assert.ok(Math.abs(last[3] / (3 * 8.314462618) - 1) < 0.01, `Cv at 1000 K: ${last}`);
      assert.ok(readFileSync(join(dir, 'band.yaml'), 'utf8').includes('nqpoint'));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
