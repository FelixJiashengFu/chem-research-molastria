// Tests for the transition-state jobs on the models page (public/models/ts-core.js): reading and pairing XYZ, the
// params, the profile, barriers and verdicts, the imaginary-mode animation and the CSV. The limits and costs are
// checked against the two other places that hold them: the account service (deploy/account-worker.js) and the model
// server (tools/uma-server/tsjobs.py, server.py). When python3 has Sella and tblite, a real HCN <-> HNC run of
// tsjobs.py goes through ts-core.js as the page would show it.
//   node --test tools/ts-test.mjs        (TS_SKIP_PYTHON=1 skips the Python part)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/models/ts-core.js', import.meta.url), 'utf8'), box);
const T = box.window.MolAstriaTS;
const plain = (v) => JSON.parse(JSON.stringify(v));
const worker = readFileSync(new URL('../deploy/account-worker.js', import.meta.url), 'utf8');
const tsjobs = readFileSync(new URL('./uma-server/tsjobs.py', import.meta.url), 'utf8');
const server = readFileSync(new URL('./uma-server/server.py', import.meta.url), 'utf8');
const page = readFileSync(new URL('../public/models/models.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/models/index.html', import.meta.url), 'utf8');
const pyNum = (name) => Number(tsjobs.match(new RegExp(`^${name} = ([0-9.]+)`, 'm'))[1]);

test('the limits are the same in the page, the account service and the model server', () => {
  assert.equal(T.MAX_ATOMS, pyNum('MAX_ATOMS'));
  assert.equal(T.MAX_ATOMS, Number(worker.match(/const TS_MAX_ATOMS = (\d+);/)[1]));
  const cost = worker.match(/const UMA_COST = \{([^}]*)\}/)[1];
  assert.equal(T.COST.ts, Number(cost.match(/\bts: (\d+)/)[1]));
  assert.equal(T.COST.neb, Number(cost.match(/\bneb: (\d+)/)[1]));
  // the ranges: worker UMA_PARAMS, server job_params, tsjobs defaults
  const wTs = worker.match(/^  ts: \{ fmax: pnum\(([\d.]+), ([\d.]+)\), irc: pbool, irc_steps: pnum\((\d+), (\d+), true\) \},$/m);
  assert.ok(wTs, 'worker ts params');
  assert.deepEqual(wTs.slice(1).map(Number), [T.FMAX.lo, T.FMAX.hi, T.IRC_STEPS.lo, T.IRC_STEPS.hi]);
  assert.match(worker, new RegExp(`images: pnum\\(${T.IMAGES.lo}, ${T.IMAGES.hi}, true\\)`));
  assert.match(server, new RegExp(`_number\\(raw, "fmax", ${T.FMAX.lo}, ${T.FMAX.hi}, tj.TS_FMAX\\)`));
  assert.match(server, new RegExp(`_number\\(raw, "irc_steps", ${T.IRC_STEPS.lo}, tj.IRC_STEPS_MAX, tj.IRC_STEPS, True\\)`));
  assert.equal(T.FMAX.def, pyNum('TS_FMAX'));
  assert.equal(T.IRC_STEPS.def, pyNum('IRC_STEPS'));
  assert.equal(T.IRC_STEPS.hi, pyNum('IRC_STEPS_MAX'));
  assert.equal(T.IMAGES.def, pyNum('NEB_IMAGES'));
  assert.deepEqual([T.IMAGES.lo, T.IMAGES.hi], [pyNum('NEB_IMAGES_MIN'), pyNum('NEB_IMAGES_MAX')]);
  // every model with forces does both jobs, on all three sides
  assert.match(worker, /const UMA_GEOM = \['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn', 'ts', 'neb'\];/);
  assert.match(server, /^B_JOBS = \("sp", "opt", "freq", "conf", "scan", "md", "rxn", "ts", "neb"\)$/m);
  assert.match(page, /const GEOM = \['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn', 'ts', 'neb'\];/);
  // the quota table on the page says the same costs
  assert.match(html, new RegExp(`<td>过渡态搜索与 IRC</td><td>${T.COST.ts} 次</td>`));
  assert.match(html, new RegExp(`<td>NEB 找过渡态与 IRC</td><td>${T.COST.neb} 次</td>`));
  // and the page loads ts-core.js before models.js
  assert.ok(html.indexOf('ts-core.js') > 0 && html.indexOf('ts-core.js') < html.indexOf('src="models.js"'));
});

test('readXyz, checkAtoms and checkPair', () => {
  const r = T.readXyz(T.SAMPLES.ts);
  assert.deepEqual(plain(r.symbols), ['H', 'C', 'N']);
  assert.deepEqual(plain(r.positions[2]), [1.17, 0, 0]);
  assert.ok(T.readXyz('').error);
  assert.ok(T.readXyz('2\n\nH 0 0 0\n').error);
  assert.ok(T.readXyz('1\n\nh 0 0 0\n').error);
  assert.equal(T.checkAtoms(3), '');
  assert.match(T.checkAtoms(1), /至少要 2 个/);
  assert.match(T.checkAtoms(51), /最多 50 个原子/);
  assert.equal(T.checkPair(T.SAMPLES.reactant, T.SAMPLES.product), '');
  assert.equal(T.checkPair(T.SAMPLES.reactant.replace(/\n/g, '\r\n'), T.SAMPLES.product), '');
  assert.match(T.checkPair(T.SAMPLES.reactant, ''), /再给出产物/);
  assert.match(T.checkPair(T.SAMPLES.reactant, '2\n\nH 0 0 0\nC 0 0 1\n'), /两边要一样多/);
  assert.match(T.checkPair(T.SAMPLES.reactant, '3\n\nC 0 0 0\nH 2 0 0\nN 1.2 0 0\n'), /第 1 个原子.*同样的顺序/);
  assert.match(T.checkPair(T.SAMPLES.reactant, T.SAMPLES.reactant), /几乎一样/);
  assert.match(T.checkPair('x', T.SAMPLES.product), /^反应物：/);
  assert.match(T.checkPair(T.SAMPLES.reactant, '3\n\nH 0 0 x\nC 0 0 0\nN 1 0 0\n'), /^产物：/);
});

test('params: the defaults, and the product only for neb', () => {
  assert.deepEqual(plain(T.params('ts')), { fmax: 0.01, irc: true, irc_steps: 60 });
  assert.deepEqual(plain(T.params('neb', { product_xyz: 'a\r\nb', images: 5, irc: false })), { fmax: 0.01, irc: false, irc_steps: 60, images: 5, product_xyz: 'a\nb' });
});

const FAKE = { // the shape tsjobs.py returns (tools/account-local.ts fakeTs uses the same)
  ts_energy_ev: -146.5979, ts_converged: true, ts_steps: 5, ts_fmax_ev_a: 0.005, imag_cm1: -1426.2, n_imag_significant: 1,
  frequencies_cm1: [-1426.2, 2001, 2386.3], ts_xyz: T.SAMPLES.ts, imag_mode: [[-0.97, 0.24, 0], [0.06, 0.06, 0], [0.02, -0.07, 0]],
  irc: { forward: { irc_steps: 22, irc_converged: true, irc_note: '', barrier_kcal: 53.2, relax_converged: true }, reverse: { irc_steps: 19, irc_converged: false, irc_note: 'IRCInnerLoopConvergenceFailure', barrier_kcal: 73.2, relax_converged: true } },
  reaction_energy_kcal: 20.0,
  profile: [{ s: -2, energy_ev: -149.77, rel_kcal: -73.2 }, { s: 0, energy_ev: -146.6, rel_kcal: 0 }, { s: 1.5, energy_ev: -148.9, rel_kcal: -53.2 }],
  neb: { energies_rel_kcal: [0, 40, 73.2, 50, 20] }
};

test('profile, band, barriers', () => {
  const p = T.profile(FAKE);
  assert.deepEqual(plain(p.pts), [[-2, -73.2], [0, 0], [1.5, -53.2]]);
  assert.deepEqual(plain(p.fromLow).map((x) => +x[1].toFixed(6)), [0, 73.2, 20]);
  assert.deepEqual(plain(T.profile({})), { pts: [], fromLow: [] });
  assert.deepEqual(plain(T.band(FAKE)).map((x) => x[1]), [0, 40, 73.2, 50, 20]);
  assert.deepEqual(plain(T.band({})), []);
  assert.deepEqual(plain(T.barriers(FAKE)), { left: 73.2, right: 53.2, reaction: 20 });
});

test('verdict: first-order saddle, minimum, higher-order saddle, unconverged', () => {
  const v = plain(T.verdict(FAKE));
  assert.equal(v[0][0], 'ok');
  assert.match(v[0][1], /-1426 cm⁻¹/);
  assert.ok(v.some(([k, t]) => k === 'warn' && /左端.*第 19 步/.test(t)), 'the IRC that stopped early');
  assert.match(T.verdict({ ...FAKE, n_imag_significant: 0, irc: null })[0][1], /极小点/);
  assert.match(T.verdict({ ...FAKE, n_imag_significant: 2, irc: null })[0][1], /高阶鞍点/);
  assert.match(T.verdict({ ...FAKE, ts_converged: false, irc: null })[0][1], /没有收敛/);
});

test('modeFrames: one period of the imaginary mode, the largest displacement amp', () => {
  const xyz = T.modeFrames(FAKE.ts_xyz, FAKE.imag_mode, 8, 0.3);
  const frames = xyz.trim().split(/\n(?=3\n)/);
  assert.equal(frames.length, 8);
  const h = (k) => frames[k].split('\n')[2].split(' ').slice(1).map(Number);
  assert.deepEqual(h(0), [0.6, 1, 0]);
  assert.ok(Math.abs(h(2)[0] - (0.6 + 0.3 * -0.97)) < 1e-5, 'a quarter period: full amplitude');
  assert.equal(T.modeFrames(FAKE.ts_xyz, [[0, 0, 0]]), '', 'a mode of the wrong size');
});

test('csv: the path, then the summary', () => {
  const c = T.csv(FAKE).split('\n');
  assert.equal(c[0], 's_sqrt_amu_angstrom,energy_ev,rel_kcal');
  assert.equal(c[2], '0,-146.6,0');
  assert.ok(c.includes('barrier_left_kcal,73.2') && c.includes('imag_cm1,-1426.2'));
});

const PY = process.env.TS_PYTHON || 'python3';
const hasPy = !process.env.TS_SKIP_PYTHON && spawnSync(PY, ['-c', 'import sella, tblite.ase, rdkit'], { encoding: 'utf8' }).status === 0;
test('a real tsjobs.py run (GFN2-xTB through tblite) reads well in ts-core.js', { skip: hasPy ? false : 'python3 without sella / tblite' }, () => {
  const script = `
import json, sys
sys.path.insert(0, 'tools/uma-server')
import chemjobs as cj, tsjobs as tj
from ase import Atoms
from tblite.ase import TBLite
def ef(sym, pos, q, s):
    a = Atoms(sym, positions=pos); a.calc = TBLite(method="GFN2-xTB", charge=q, multiplicity=s, verbosity=0)
    return a.get_potential_energy(), a.get_forces()
sym, pos = cj.parse_xyz(sys.argv[1])
print(json.dumps(tj.run_ts(cj.Structure(sym, pos), cj.EFCalculator(ef), cj.Budget(300), "HCN")))
`;
  const out = spawnSync(PY, ['-c', script, T.SAMPLES.ts], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 300000 });
  assert.equal(out.status, 0, out.stderr);
  const r = JSON.parse(out.stdout.trim().split('\n').at(-1));
  assert.equal(T.verdict(r)[0][0], 'ok');
  const p = T.profile(r);
  assert.ok(p.pts.length > 10);
  assert.equal(Math.max(...p.pts.map((x) => x[1])), 0, 'the TS is the top of its own IRC');
  const b = T.barriers(r);
  assert.ok(b.left > 10 && b.right > 10);
  assert.ok(Math.abs(Math.abs(b.left - b.right) - Math.abs(b.reaction)) < 0.01, 'barriers differ by the reaction energy');
  const frames = T.modeFrames(r.ts_xyz, r.imag_mode).trim().split(/\n(?=3\n)/);
  assert.equal(frames.length, 16);
});
