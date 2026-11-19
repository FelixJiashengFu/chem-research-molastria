// Tests for the Code Desk's quacc tab (public/code/quacc-core.js): the molecule list, which recipe and engine run
// online, the request body and its cost, the result tables and CSV, and the quacc scripts it hands out. The limits
// are checked against the two other places that hold them: the account service (deploy/account-worker.js) and the
// model server (tools/uma-server/quacc_backend.py, server.py). Every script is compiled by python3; when a Python
// with quacc is found (QUACC_PYTHON, or python3 on PATH) the EMT script and, with tblite installed, the GFN2 scripts
// run for real and their numbers are checked.
//   node --test tools/quacc-test.mjs        (QUACC_SKIP_PYTHON=1 skips the Python part)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/code/quacc-core.js', import.meta.url), 'utf8'), box);
const Q = box.window.MolAstriaQuacc;
const plain = (v) => JSON.parse(JSON.stringify(v));
const worker = readFileSync(new URL('../deploy/account-worker.js', import.meta.url), 'utf8');
const backend = readFileSync(new URL('./uma-server/quacc_backend.py', import.meta.url), 'utf8');
const server = readFileSync(new URL('./uma-server/server.py', import.meta.url), 'utf8');
const pyTuple = (name) => [...backend.match(new RegExp(`^${name} = \\(([^)]*)\\)`, 'm'))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

test('parseList: SMILES then a name, comments and blank lines skipped, bad SMILES and the cap reported', () => {
  const r = Q.parseList('# set\nCCO ethanol\n\n  O  \nC; rm bad\n[CH3] methyl radical\n', 2);
  assert.deepEqual(plain(r.items), [{ line: 2, smiles: 'CCO', name: 'ethanol' }, { line: 4, smiles: 'O', name: '' }]);
  assert.deepEqual(plain(r.bad), [5]);
  assert.deepEqual(plain(r.extra), [6]);
  assert.equal(Q.parseList(Q.SAMPLES.molecules).items.length, 5);
});

test('the same limits as the account service and the model server', () => {
  assert.equal(Number(worker.match(/const QUACC_MAX_ITEMS = (\d+)/)[1]), Q.MAX_ITEMS);
  assert.equal(Number(backend.match(/^MAX_ITEMS = (\d+)/m)[1]), Q.MAX_ITEMS);
  assert.deepEqual(pyTuple('EMT_METALS'), plain(Q.EMT_METALS));
  assert.deepEqual(pyTuple('PSI4_METHODS'), plain(Q.PSI4_METHODS));
  assert.deepEqual(pyTuple('PSI4_BASES'), plain(Q.PSI4_BASES));
  assert.deepEqual(pyTuple('RECIPES').sort(), plain(Q.RECIPES.map((r) => r[0]).filter((r) => r !== 'slabs')).sort());
  assert.ok(worker.includes(`qslab: { element: pone(${Q.EMT_METALS.map((m) => `'${m}'`).join(', ')})`), 'the worker lists the same metals');
  assert.ok(worker.includes(`method: pone(${Q.PSI4_METHODS.map((m) => `'${m}'`).join(', ')})`));
  assert.ok(worker.includes(`basis: pone(${Q.PSI4_BASES.map((m) => `'${m}'`).join(', ')})`));
  const wc = Function(`return ${worker.match(/const QUACC_ITEM_COST = (\{[^}]+\})/)[1]}`)();
  assert.deepEqual(wc, plain(Q.ITEM_COST));
  const pc = Function(`return ${backend.match(/^ITEM_COST = (\{[^}]+\})/m)[1].replace(/"/g, "'")}`)();
  assert.deepEqual(pc, plain(Q.ITEM_COST));
  assert.equal(Number(backend.match(/^PSI4_MAX_HEAVY = (\d+)/m)[1]), Q.HEAVY.psi4);
  assert.equal(Number(server.match(/MAX_HEAVY, MAX_ATOMS, MAX_QUEUE = (\d+)/)[1]), Q.HEAVY.tblite);
  for (const e of Q.ENGINES.filter((x) => x.model)) assert.ok(worker.includes(`'${e.model}': 'open'`), e.model);
});

test('which combinations run online, the request body and what it costs', () => {
  const items = [{ smiles: 'CCO' }, { smiles: 'O' }, { smiles: '[CH3]' }];
  assert.equal(Q.online('relax_freq', 'tblite'), true);
  assert.equal(Q.online('relax', 'psi4'), false, 'Psi4 through quacc: single points only');
  assert.equal(Q.online('static', 'orca'), false, 'ORCA is academic-only: never on the shared computer');
  assert.equal(Q.online('slabs', 'tblite'), true, 'slabs always use EMT');
  assert.deepEqual(plain(Q.body({ recipe: 'relax_freq', engine: 'tblite', items, fmax: 0.02, temperature: 350 })),
    { model: 'quacc-gfn2', job: 'qflow', params: { items: ['CCO', 'O', '[CH3]'], recipe: 'relax_freq', fmax: 0.02, temperature: 350 } });
  assert.deepEqual(plain(Q.body({ recipe: 'static', engine: 'tblite', items, fmax: 0.02, temperature: 350 })).params, { items: ['CCO', 'O', '[CH3]'], recipe: 'static' });
  assert.deepEqual(plain(Q.body({ recipe: 'static', engine: 'psi4', items: [{ smiles: 'O' }], method: 'hf', basis: 'nope' })),
    { model: 'quacc-psi4', job: 'qflow', params: { items: ['O'], recipe: 'static', method: 'hf', basis: 'def2-svp' } });
  assert.deepEqual(plain(Q.body({ recipe: 'slabs', engine: 'tblite', element: 'Pt', max_index: 2 })), { model: 'quacc-emt', job: 'qslab', params: { element: 'Pt', max_index: 2 } });
  assert.throws(() => Q.body({ recipe: 'slabs', element: 'Fe' }), /七种金属/);
  assert.throws(() => Q.body({ recipe: 'relax', engine: 'tblite', items: [] }), /至少一个/);
  assert.throws(() => Q.body({ recipe: 'relax', engine: 'tblite', items: Array(9).fill({ smiles: 'C' }) }), /最多 8 个/);
  assert.throws(() => Q.body({ recipe: 'relax', engine: 'orca', items }), /自己的电脑/);
  assert.equal(Q.cost({ recipe: 'relax_freq', engine: 'tblite', items }), 9);
  assert.equal(Q.cost({ recipe: 'relax', engine: 'tblite', items }), 3);
  assert.equal(Q.cost({ recipe: 'static', engine: 'psi4', items }), 6);
  assert.equal(Q.cost({ recipe: 'slabs', max_index: 1 }), 3);
  assert.equal(Q.cost({ recipe: 'slabs', max_index: 2 }), 5);
});

test('result tables and CSV', () => {
  const result = { recipe: 'relax_freq', items: [
    { smiles: 'O', formula: 'H2O', charge: 0, spin: 1, ok: true, energy_ev: -137.97, converged: true, steps: 3, fmax_ev_a: 0.003, n_imag: 0, zpe_ev: 0.55, h_ev: -137.33, s_ev_k: 0.00195, g_ev: -137.91, point_group: 'C2v', symmetry_number: 2, frequencies_cm1: [1539, 3643, 3651], xyz: '3\nx\nO 0 0 0\nH 0 0 1\nH 0 1 0\n' },
    { smiles: 'C,C', formula: '', ok: false, error: 'RuntimeError: "no"' },
  ] };
  const r = Q.rows(result, { O: 'water' });
  assert.equal(r[0].name, 'water');
  assert.equal(r[0].atoms, 3);
  assert.equal(r[1].error, 'RuntimeError: "no"');
  const text = Q.csv(result, { O: 'water' }).split('\n');
  assert.equal(text[0].split(',').length, 18);
  assert.equal(text[1], 'O,water,H2O,0,1,true,-137.97,true,3,0.003,0,0.55,-137.33,0.00195,-137.91,C2v,2,');
  assert.ok(text[2].startsWith('"C,C",'), 'a comma inside a cell is quoted');
  assert.ok(text[2].endsWith('"RuntimeError: ""no"""'));
  const slabs = { element: 'Cu', slabs: [
    { miller: [1, 0, 0], family: [1, 0, 0], atoms: 72, area_a2: 77.3, gamma_j_m2: 1.1339, gamma_ev_a2: 0.0708, converged: true, steps: 0 },
    { miller: [1, 1, 1], family: [1, 1, 1], atoms: 80, area_a2: 89.3, gamma_j_m2: 1.0441, gamma_ev_a2: 0.0652, converged: true, steps: 2 },
  ] };
  const s = Q.slabRows(slabs);
  assert.deepEqual(plain(s.map((x) => x.hkl)), ['(111)', '(100)']);
  assert.equal(s[0].ratio, 1);
  assert.ok(Math.abs(s[1].ratio - 1.1339 / 1.0441) < 1e-12);
  assert.equal(Q.csv(slabs).split('\n')[1], 'Cu,(111),80,89.3,1.0441,0.0652,true,2');
});

test('scripts: the right quacc recipe, the molecules, the licence notes; comments in English', () => {
  const items = [{ smiles: 'CCO' }, { smiles: 'O' }];
  const t = Q.script({ recipe: 'relax_freq', engine: 'tblite', items, fmax: 0.02, temperature: 350 });
  assert.match(t, /from quacc\.recipes\.tblite\.core import freq_job, relax_job/);
  assert.match(t, /opt_params=\{"fmax": 0\.02\}/);
  assert.match(t, /temperature=350\b/);
  assert.match(t, /"CCO",\n {4}"O",/);
  const p = Q.script({ recipe: 'static', engine: 'psi4', items, method: 'pbe0', basis: '6-31g*' });
  assert.match(p, /method="pbe0", basis="6-31g\*"/);
  assert.match(Q.script({ recipe: 'relax_freq', engine: 'orca', items }), /run_freq=True[\s\S]*/);
  assert.match(Q.script({ recipe: 'static', engine: 'orca', items }), /free for academic use only/);
  assert.match(Q.script({ recipe: 'slabs', element: 'Au', max_index: 2 }), /bulk\("Au", "fcc", cubic=True\)[\s\S]*"max_index": 2/);
  for (const s of [t, p, Q.script({ recipe: 'slabs', element: 'Cu' }), Q.script({ recipe: 'relax', engine: 'orca', items })]) {
    assert.ok(!/[一-鿿]/.test(s), 'no Chinese in a script (the page does not translate <pre>)');
    assert.match(s, /BSD-3-Clause/);
  }
  const evil = Q.script({ recipe: 'static', engine: 'tblite', items: [{ smiles: 'C"\nimport os' }] });
  assert.ok(evil.includes('"C\\"\\nimport os"'), 'a SMILES cannot break out of its string');
});

// ── the scripts, run ──
function python() {
  if (process.env.QUACC_SKIP_PYTHON) return null;
  for (const exe of [process.env.QUACC_PYTHON, 'python3', 'python'].filter(Boolean)) {
    const r = spawnSync(exe, ['-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8' });
    if (r.status === 0) return exe;
  }
  return null;
}
const PY = python();
const has = (mod) => PY && spawnSync(PY, ['-c', `import ${mod}`], { encoding: 'utf8' }).status === 0;
function run(code, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'molastria-quacc-'));
  try {
    writeFileSync(join(dir, 'job.py'), code);
    const r = spawnSync(PY, ['-I', ...args, join(dir, 'job.py')], { cwd: dir, encoding: 'utf8', timeout: 600000, env: { ...process.env, QUACC_RESULTS_DIR: dir } });
    return r;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('every script compiles', { skip: !PY && 'no python3' }, () => {
  const items = [{ smiles: 'CCO' }];
  for (const s of [
    { recipe: 'relax', engine: 'tblite', items }, { recipe: 'relax_freq', engine: 'tblite', items }, { recipe: 'static', engine: 'tblite', items },
    { recipe: 'static', engine: 'psi4', items }, { recipe: 'relax', engine: 'orca', items }, { recipe: 'relax_freq', engine: 'orca', items }, { recipe: 'static', engine: 'orca', items },
    { recipe: 'slabs', element: 'Ni', max_index: 2 },
  ]) {
    const r = run(Q.script(s), ['-m', 'py_compile']);
    assert.equal(r.status, 0, `${s.recipe} ${s.engine}: ${r.stderr}`);
  }
});

test('the EMT slab script gives the same surface energies as the online run', { skip: !has('quacc') && 'no quacc in this Python' }, () => {
  const r = run(Q.script({ recipe: 'slabs', element: 'Cu', max_index: 1 }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /a = 3\.589\d A/);
  const gammas = Object.fromEntries([...r.stdout.matchAll(/\((\d), (-?\d), (-?\d)\) \d+ ([\d.]+) J\/m\^2/g)].map((m) => [[m[1], m[2], m[3]].map((x) => Math.abs(+x)).sort().reverse().join(''), +m[4]]));
  assert.deepEqual(Object.keys(gammas).sort(), ['100', '110', '111']);
  assert.ok(Math.abs(gammas['111'] - 1.0441) < 2e-3 && Math.abs(gammas['100'] - 1.1339) < 2e-3 && Math.abs(gammas['110'] - 1.2305) < 2e-3, JSON.stringify(gammas));
});

test('the GFN2 scripts run with tblite: water and ethanol', { skip: !(has('quacc') && has('tblite') && has('rdkit')) && 'needs quacc, tblite and rdkit' }, () => {
  const items = [{ smiles: 'O' }, { smiles: 'CCO' }];
  const r = run(Q.script({ recipe: 'relax_freq', engine: 'tblite', items, fmax: 0.01, temperature: 298.15 }));
  assert.equal(r.status, 0, r.stderr);
  const e = [...r.stdout.matchAll(/^(\S+) E = (-?[\d.]+) eV converged/gm)].map((m) => [m[1], +m[2]]);
  assert.deepEqual(e.map((x) => x[0]), ['O', 'CCO']);
  // GFN2-xTB total energies (tblite): water -5.0705 Eh = -137.98 eV, ethanol -11.394 Eh = -310.06 eV
  assert.ok(Math.abs(e[0][1] - -137.977) < 0.01 && Math.abs(e[1][1] - -310.056) < 0.02, JSON.stringify(e));
  assert.match(r.stdout, /imaginary: 0\n[\s\S]*imaginary: 0/);
  const s = run(Q.script({ recipe: 'static', engine: 'tblite', items: [{ smiles: 'O' }] }));
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /^O E = -13\d\.\d+ eV/m);
});
