// Mol* 查看器的纯函数（public/viewer/molstar-core.js）：多帧 PDB 读写、Cα 轨迹 JSON → PDB、RMSF → B 因子、
// 理想螺旋 + 弹性网络模型的玩具轨迹；还有 molstar.js 的版本写死、e2e 装的 molstar 是同一个版本。
//   node --test tools/molstar-test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../public/viewer/molstar-core.js');
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

// 和 tools/uma-server/openmm_backend.py 的 ca_models / pdb_atom_line 写法一样的三帧三残基轨迹
const line = (i, rn, rs, [x, y, z]) => `ATOM  ${String(i).padStart(5)}  CA  ${rn} A${String(rs).padStart(4)}    ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}  1.00  0.00           C\n`;
const RES = [['MET', 1], ['GLY', 2], ['LYS', 3]];
const frame = (k) => RES.map(([rn, rs], i) => line(i + 1, rn, rs, [3.8 * i, 0.3 * Math.sin(i + k), 0]));
const TRAJ = [0, 1, 2].map((k) => `MODEL     ${String(k + 1).padStart(4)}\nREMARK   t = ${(k + 1) * 2}.0 ps\n${frame(k).join('')}ENDMDL\n`).join('') + 'END\n';

test('PDB IDs: four characters starting with 1-9, or the extended form', () => {
  assert.equal(C.cleanPdbId(' 1l2y '), '1L2Y');
  assert.equal(C.cleanPdbId('pdb_00001abc'), 'PDB_00001ABC');
  for (const bad of ['0ABC', '1L2', '1L2YY', '', null, '1L2Y;']) assert.equal(C.cleanPdbId(bad), '', String(bad));
});

test('multi-model PDB: frames, times, atoms; a single structure is one frame', () => {
  const m = C.parseModels(TRAJ);
  assert.equal(m.length, 3);
  assert.deepEqual(m.map((x) => x.t), [2, 4, 6]);
  assert.deepEqual(m[0].atoms.map((a) => `${a.chain}:${a.resn}${a.resi}:${a.name}`), ['A:MET1:CA', 'A:GLY2:CA', 'A:LYS3:CA']);
  assert.equal(m[1].atoms[2].x, 7.6);
  assert.ok(C.caOnly(TRAJ));
  const single = C.parseModels(frame(0).join('') + 'END\n');
  assert.equal(single.length, 1); assert.equal(single[0].t, null);
  assert.equal(C.parseModels('').length, 0);
  assert.equal(C.parseModels('HEADER x\nATOM  bad line\n').length, 0, 'a short or broken ATOM line is skipped');
  assert.equal(C.caOnly(line(1, 'ALA', 1, [0, 0, 0]).replace(' CA ', ' N  ')), false);
});

test('writing back gives the same atoms in fixed PDB columns', () => {
  const m = C.parseModels(TRAJ), out = C.writeModels(m);
  assert.deepEqual(C.parseModels(out).map((x) => x.atoms.map((a) => [a.name, a.resn, a.resi, a.x, a.y, a.z])), m.map((x) => x.atoms.map((a) => [a.name, a.resn, a.resi, a.x, a.y, a.z])));
  for (const l of out.split('\n').filter((s) => s.startsWith('ATOM'))) {
    assert.equal(l.slice(12, 16), ' CA ', 'atom name in columns 13-16');
    assert.equal(l.slice(76, 78), ' C', 'element in columns 77-78');
  }
  assert.equal((out.match(/^MODEL /gm) || []).length, 3);
  assert.ok(!/^MODEL/m.test(C.writeModels([m[0]])), 'one frame: no MODEL record');
});

test('RMSF → B factor is B = 8π²/3 · RMSF² and back', () => {
  assert.ok(Math.abs(C.rmsfToB(1) - 26.3189) < 1e-4);
  for (const a of [0.3, 1, 2.5]) assert.ok(Math.abs(C.bToRmsf(C.rmsfToB(a)) - a) < 1e-12);
  assert.deepEqual(C.domainOf([2, NaN, 5, 3]), [2, 5]);
  assert.deepEqual(C.domainOf([4, 4]), [3.5, 4.5], 'a flat range is widened');
  assert.deepEqual(C.domainOf([]), [0, 1]);
});

test('the models page result: RMSF written into the B column of every frame, matched by chain and residue', () => {
  const rmsf = [{ res: 'MET1', chain: 'A', a: 0.5 }, { res: 'GLY2', chain: 'A', a: 1 }, { res: 'LYS3', chain: 'A', a: 2 }];
  const r = C.withRmsf(TRAJ, rmsf);
  assert.equal(r.frames, 3); assert.equal(r.matched, 3);
  assert.deepEqual(r.times, [2, 4, 6]);
  const m = C.parseModels(r.pdb);
  for (const fr of m) assert.deepEqual(fr.atoms.map((a) => a.b), [0.5, 1, 2].map((a) => +C.rmsfToB(a).toFixed(2)));
  assert.deepEqual(r.rmsfDomain, [0.5, 2]);
  assert.ok(Math.abs(r.domain[1] - C.rmsfToB(2)) < 1e-9);
  // names that differ (HID for HIS) but the same count: matched in order
  const ord = C.withRmsf(TRAJ, [{ res: 'X1', a: 1 }, { res: 'X2', a: 2 }, { res: 'X3', a: 3 }]);
  assert.equal(ord.matched, 3);
  assert.deepEqual(C.parseModels(ord.pdb)[0].atoms.map((a) => C.bToRmsf(a.b).toFixed(1)), ['1.0', '2.0', '3.0']);
  // nothing usable: unchanged
  const none = C.withRmsf(TRAJ, []);
  assert.equal(none.domain, null); assert.equal(none.pdb, TRAJ);
  // full-atom structure: every atom of a residue gets that residue's value
  const full = ['N  ', 'CA ', 'C  '].map((n, i) => line(i + 1, 'ALA', 7, [i, 0, 0]).replace(' CA ', ` ${n}`)).join('') + line(4, 'GLY', 8, [3, 0, 0]);
  const f = C.rmsfPerAtom(C.parseModels(full)[0].atoms, [{ chain: 'A', res: 'ALA7', a: 1.5 }, { chain: 'A', res: 'GLY8', a: 0.7 }]);
  assert.deepEqual(f.values, [1.5, 1.5, 1.5, 0.7]);
});

test('the trajectory as JSON → a multi-model Cα PDB, bad frames dropped, RMSF as numbers or objects', () => {
  const residues = RES.map(([resn, resi]) => ({ resn, chain: 'A', resi }));
  const frames = [0, 1].map((k) => ({ t_ps: k * 0.5, xyz: residues.map((_, i) => [i * 3.8, k, 0]) }));
  const pdb = C.framesToPdb({ residues, frames: [...frames, { t_ps: 9, xyz: [[0, 0, 0]] }, { xyz: [[0, 0, 'x'], [0, 0, 0], [0, 0, 0]] }] }, [0.4, 0.8, 1.6]);
  const m = C.parseModels(pdb);
  assert.equal(m.length, 2);
  assert.deepEqual(m.map((x) => x.t), [0, 0.5]);
  assert.deepEqual(m[1].atoms.map((a) => [a.resn, a.resi, a.y]), [['MET', 1, 1], ['GLY', 2, 1], ['LYS', 3, 1]]);
  assert.deepEqual(m[0].atoms.map((a) => +C.bToRmsf(a.b).toFixed(1)), [0.4, 0.8, 1.6]);
  assert.equal(C.framesToPdb({ residues, frames: [] }), '');
  assert.equal(C.framesToPdb(null), '');
});

test('B factors of 1000 Å² and more keep their leading digits (fewer decimals, never cut)', () => {
  const residues = [{ resn: 'MET', chain: 'A', resi: 1 }, { resn: 'GLY', chain: 'A', resi: 2 }, { resn: 'LYS', chain: 'A', resi: 3 }];
  const frames = [{ t_ps: 0, xyz: [[0, 0, 0], [3.8, 0, 0], [7.6, 0, 0]] }];
  const rmsf = [0.5, 7, 40]; // B = 6.58, 1289.6, 42106
  const m = C.parseModels(C.framesToPdb({ residues, frames }, rmsf));
  const b = m[0].atoms.map((x) => x.b);
  assert.ok(Math.abs(b[1] - C.rmsfToB(7)) < 0.06, `B for 7 Å is ${b[1]}`);
  assert.ok(Math.abs(b[2] - C.rmsfToB(40)) < 0.6, `B for 40 Å is ${b[2]}`);
  assert.deepEqual(m[0].atoms.map((x) => +C.bToRmsf(x.b).toFixed(2)), [0.5, 7, 40]);
  // the RMSF domain the page shows is the one in the file
  const r = C.withRmsf(C.framesToPdb({ residues, frames }), rmsf.map((a, i) => ({ chain: 'A', res: `${residues[i].resn}${i + 1}`, a })));
  const back = C.parseModels(r.pdb)[0].atoms.map((x) => x.b);
  assert.ok(Math.abs(Math.max(...back) - r.domain[1]) / r.domain[1] < 1e-4);
  // the columns stay where PDB readers look for them, and coordinates past ±1000 Å lose decimals, not digits
  for (const line of r.pdb.split('\n').filter((l) => l.startsWith('ATOM'))) assert.equal(line.length, 78);
  const atom = { het: false, name: 'CA', resn: 'ALA', chain: 'A', resi: 1, x: -1234.5678, y: 12345.678, z: 1e9, occ: 1, b: 1e7, el: 'C' };
  const back2 = C.parseAtom(C.atomLine(1, atom));
  assert.equal(back2.x, -1234.57); assert.equal(back2.y, 12345.68); assert.equal(back2.z, 99999999); assert.equal(back2.b, 999999);
});

test('Mol* viewer: a late open() never wipes a newer viewer, and the models page disposes viewers before redrawing', () => {
  const js = read('public/viewer/molstar.js');
  assert.match(js, /const owns = \(\) => el\.contains\(stage\)/);
  assert.match(js, /const fail = \(e\) => \{ if \(!owns\(\)\) return e;/);
  assert.match(js, /if \(owns\(\)\) \{ el\.innerHTML = ''/);
  assert.match(js, /if \(el\.ms === handle\) el\.ms = null/);
  assert.ok((js.match(/if \(!owns\(\)\)/g) || []).length >= 4, 'checked after every await');
  assert.match(js, /const gone = \(\) =>/);
  const models = read('public/models/models.js');
  assert.match(models, /function dropMolstar\(\) \{ for \(const b of \$\('m-result'\)\.querySelectorAll\('\.md-ms'\)\) b\.ms\?\.destroy\(\); \}/);
  assert.match(models, /function paint\(\) \{\n    const box = \$\('m-result'\);\n    dropMolstar\(\);/);
  assert.match(models, /dropMolstar\(\);\n    \$\('m-result'\)\.innerHTML = '';/);
  // the box is translate="no": its labels come in both languages
  assert.match(models, /en \? `Cα trajectory of \$\{id\}` : `\$\{id\} 的 Cα 轨迹`/);
  assert.match(models, /en \? `\$\{id\} \(RCSB PDB\)`/);
});

test('frame label', () => {
  assert.equal(C.frameLabel(0, 25, 0.8), '第 1 / 25 帧 · 0.8 ps');
  assert.equal(C.frameLabel(4, 5, null), '第 5 / 5 帧');
  assert.equal(C.frameLabel(0, 25, 0.8, true), 'Frame 1 / 25 · 0.8 ps');
});

test('Jacobi eigenvalues of a symmetric matrix', () => {
  const A = [[4, 1, 0], [1, 3, 1], [0, 1, 2]], { values, vectors } = C.eigSym(A);
  assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) - 9) < 1e-10, 'trace');
  for (let k = 0; k < 3; k++) {
    const Av = A.map((row) => row.reduce((s, v, j) => s + v * vectors[k][j], 0));
    Av.forEach((v, i) => assert.ok(Math.abs(v - values[k] * vectors[k][i]) < 1e-9));
  }
  assert.ok(values[0] <= values[1] && values[1] <= values[2]);
});

test('ANM: Hessian rows sum to zero, six zero modes (translations and rotations), the helix ends move most', () => {
  const xyz = C.helixCa(16);
  for (let i = 1; i < 16; i++) { const d = Math.hypot(...[0, 1, 2].map((a) => xyz[i][a] - xyz[i - 1][a])); assert.ok(Math.abs(d - 3.8) < 0.1, `Cα–Cα ${d}`); }
  const H = C.anmHessian(xyz);
  for (let r = 0; r < H.length; r++) for (let a = 0; a < 3; a++) {
    let s = 0; for (let j = 0; j < 16; j++) s += H[r][3 * j + a];
    assert.ok(Math.abs(s) < 1e-12, 'translation is a zero mode');
  }
  const { values } = C.eigSym(H);
  assert.equal(values.filter((v) => Math.abs(v) < 1e-8).length, 6);
  assert.ok(values[6] > 1e-4);
  const d = C.helixDemo(16, { frames: 30 });
  assert.equal(d.frames.length, 30); assert.equal(d.residues.length, 16);
  assert.equal(d.residues[0].resn, 'GLY'); assert.equal(d.residues[5].resn, 'ALA');
  const mid = d.rmsf[8], ends = Math.max(d.rmsf[0], d.rmsf[15]);
  assert.ok(ends > mid, `ends ${ends} vs middle ${mid}`);
  const th = d.rmsfTheory;
  assert.ok(Math.max(th[0], th[15]) > th[8], 'the analytic ANM fluctuation agrees: ends > middle');
  const pdb = C.framesToPdb(d, d.rmsf);
  assert.equal(C.parseModels(pdb).length, 30);
  assert.equal(C.withRmsf(pdb, d.residues.map((r, i) => ({ chain: 'A', res: `${r.resn}${r.resi}`, a: d.rmsf[i] }))).matched, 16);
});

test('the viewer pins one Mol* version everywhere: core, page loader, e2e package', () => {
  assert.match(C.VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(C.SRC, `https://cdn.jsdelivr.net/npm/molstar@${C.VERSION}/build/viewer/molstar.js`);
  assert.match(C.css(true), /theme\/dark\.css$/);
  assert.equal(JSON.parse(read('tools/e2e/package.json')).devDependencies.molstar, C.VERSION);
  const lic = read('public/viewer/THIRD-PARTY-molstar.md');
  assert.match(lic, /MIT/); assert.match(lic, new RegExp(C.VERSION.replace(/\./g, '\\.')));
  const pkg = new URL('tools/e2e/node_modules/molstar/package.json', root);
  if (existsSync(pkg)) assert.equal(JSON.parse(readFileSync(pkg, 'utf8')).version, C.VERSION, 'npm install --prefix tools/e2e');
});
