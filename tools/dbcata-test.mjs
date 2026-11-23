// Tests for the models page's DBCata window (public/models/dbcata-core.js): the lists it offers, the canonical form and
// cost of a request, the result table, frames and CSV. The lists and costs are checked against the two other places
// that hold them: the model server (tools/uma-server/dbcata_core.py) and the account service (deploy/account-worker.js).
// With python3 and numpy, the page's canonical form is compared with dbcata_core.check() itself, and the table is
// built from a real result of the worker's toy engine. DBCata itself is never run here.
//   node --test tools/dbcata-test.mjs        (DBCATA_SKIP_PYTHON=1 skips the Python part)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const box = { window: {} };
vm.runInNewContext(read('../public/models/dbcata-core.js'), box);
const C = box.window.MolAstriaDbcataCore;
const plain = (v) => JSON.parse(JSON.stringify(v));
const core = read('./uma-server/dbcata_core.py');
const worker = read('../deploy/account-worker.js');
const pyTuple = (name) => [...core.match(new RegExp(`^${name} = \\(([^)]*)\\)`, 'm'))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const jsList = (name) => [...worker.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const fixture = JSON.parse(read('./e2e/dbcata-result.json'));

test('the lists are the same on the page, on the computer and in the account service', () => {
  const metals = ['METALS_3D', 'METALS_4D', 'METALS_5D', 'METALS_P'].flatMap(pyTuple);
  assert.deepEqual(plain(C.METALS), metals);
  assert.deepEqual(jsList('DBCATA_METALS'), metals);
  assert.deepEqual(plain(C.ADSORBATES), pyTuple('ADSORBATES'));
  assert.deepEqual(jsList('DBCATA_ADSORBATES'), pyTuple('ADSORBATES'));
  assert.deepEqual(plain(C.FACETS), pyTuple('FACETS'));
  assert.deepEqual(plain(C.LATTICES), pyTuple('LATTICE'));
  assert.deepEqual(plain([...C.RATIOS].sort()), core.match(/^RATIOS = \(([^)]*)\)/m)[1].split(',').map(Number).sort());
  assert.deepEqual(plain(C.STEPS), core.match(/^STEPS = \(([^)]*)\)/m)[1].split(',').map(Number));
  assert.match(worker, /const DBCATA_RATIOS = \[0\.25, 0\.5, 0\.75\], DBCATA_STEPS = \[20, 50, 100\];/);
  // costs: 3 without the UMA polish, 5 with it (the default), in all three places
  assert.match(core, /^COST = \{False: 3, True: 5\}/m);
  assert.match(worker, /const dbcataCost = \(params\) => \(params\.polish === false \? 3 : 5\);/);
  assert.deepEqual(plain(C.COST), { lean: 3, polish: 5 });
  // OC20's gas references
  const refs = Object.fromEntries([...core.match(/^OC20_REFS = \{([^}]*)\}/m)[1].matchAll(/"(\w)": (-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
  assert.deepEqual(plain(C.OC20_REFS), refs);
  assert.equal(C.METALS.length, 31);
  assert.equal(C.ADSORBATES.length, 12);
});

test('check: the canonical form, case and brackets, and every way out of the domain', () => {
  assert.deepEqual(plain(C.check({ metal_a: 'Pt', metal_b: 'Ni', ratio: 0.75, facet: '111', adsorbate: 'OH' })),
    { params: { metal_a: 'Ni', metal_b: 'Pt', ratio: 0.25, facet: '111', adsorbate: 'OH', polish: true, steps: 20, lattice: 'uma' } });
  assert.deepEqual(plain(C.check({ metal_a: 'cu', metal_b: 'AU', ratio: '0.5', facet: '(110)', adsorbate: 'h2o', polish: false, steps: 50, lattice: 'vegard' })).params,
    { metal_a: 'Au', metal_b: 'Cu', ratio: 0.5, facet: '110', adsorbate: 'H2O', polish: false, steps: 50, lattice: 'vegard' });
  for (const [raw, zh] of [
    [{ metal_a: 'Tc', metal_b: 'Pt' }, '列表'], [{ metal_a: 'Pt', metal_b: 'Pt' }, '不同'], [{ metal_a: 'Pt', metal_b: 'Ni', ratio: 0.3 }, '比例'],
    [{ metal_a: 'Pt', metal_b: 'Ni', ratio: 0.5, facet: '100' }, '晶面'], [{ metal_a: 'Pt', metal_b: 'Ni', ratio: 0.5, facet: '111', adsorbate: 'CO' }, '12 种'],
  ]) {
    const r = C.check(raw);
    assert.ok(r.error && !r.params, JSON.stringify(raw));
    assert.match(r.error.zh, new RegExp(zh));
    assert.match(r.error.en, /^[A-Z]/);
  }
  assert.ok(C.check(null).error);
  assert.equal(C.cost({ polish: false }), 3);
  assert.equal(C.cost({ polish: true }), 5);
  assert.equal(C.cost({}), 5);
  assert.equal(C.formula('Pt', 'Ni', 0.75), 'Pt3Ni');
  assert.equal(C.formula('Pt', 'Ni', 0.25, true), 'PtNi₃');
  assert.equal(C.structure(0.5), 'L1₀');
});

test('body: only the five choices and what differs from the defaults', () => {
  const p = C.check({ metal_a: 'Pt', metal_b: 'Ni', ratio: 0.75, facet: '111', adsorbate: 'OH' }).params;
  assert.deepEqual(plain(C.body(p)), { model: 'dbcata', job: 'adsgen', params: { metal_a: 'Ni', metal_b: 'Pt', ratio: 0.25, facet: '111', adsorbate: 'OH' } });
  assert.deepEqual(plain(C.body({ ...p, polish: false, steps: 100, lattice: 'vegard' })).params,
    { metal_a: 'Ni', metal_b: 'Pt', ratio: 0.25, facet: '111', adsorbate: 'OH', polish: false, steps: 100, lattice: 'vegard' });
});

test('rows, frames and CSV of the stand-in result', () => {
  const rows = C.rows(fixture);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].id, fixture.best, 'the best site first');
  assert.ok(rows[0].best);
  assert.equal(rows.at(-1).ok, false, 'flagged sites last');
  assert.deepEqual(plain(rows.at(-1).flags), ['desorbed']);
  for (let i = 1; i < rows.length - 1; i++) assert.ok(rows[i].energy >= rows[i - 1].energy, 'sorted by energy');
  assert.equal(rows[0].top, fixture.slabs[0].top);
  assert.equal(rows[0].energy, fixture.sites.find((s) => s.id === fixture.best).e_ads_ev, 'E_ads when OC20 has the references');
  const fr = C.frames(fixture.sites[0].xyz);
  assert.deepEqual(plain(fr.map((f) => f.label)), ['initial', 'DBCata', 'DBCata+UMA']);
  assert.equal(Number(fr[0].text.split('\n')[0]), 14, 'NiPt3 slab of 12 atoms + OH');
  for (const f of fr) assert.ok(C.FRAME_NAMES[f.label], f.label);
  const csv = C.csv(fixture).trim().split('\n');
  assert.equal(csv.length, 5);
  assert.match(csv[0], /^formula,facet,adsorbate,site_id/);
  assert.match(csv[1], /^NiPt3,111,OH,3,NiPt3,hollow-fcc,Pt-Pt-Pt,/);
  assert.match(csv[4], /,desorbed,0$/);
  for (const k of new Set(fixture.sites.map((s) => s.kind))) assert.ok(C.KINDS[k], k);
  const sulfur = { ...fixture, reference: { ...fixture.reference, available: false } };
  assert.equal(C.rows(sulfur)[0].energy, sulfur.sites.find((s) => s.id === C.rows(sulfur)[0].id).e_bind_raw_ev, 'E - E_slab for S');
  assert.equal(C.refsAvailable('SH'), false);
  assert.equal(C.refsAvailable('CH3'), true);
  assert.match(C.citation(true), /10\.1038\/s41467-026-79243-9/);
});

test('the page loads the window before models.js and the account service gates it', () => {
  const html = read('../public/models/index.html');
  const order = ['dbcata-core.js', 'dbcata.js', 'models.js'].map((f) => html.indexOf(`<script src="${f}"`));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), 'dbcata-core.js, dbcata.js, then models.js');
  assert.match(html, /href="dbcata\.css"/);
  assert.match(worker, /const dbcataOn = \(env\) => env\.DBCATA_ENABLED === '1';/);
  assert.match(read('../deploy/wrangler.toml'), /^DBCATA_ENABLED = "0"/m, 'closed until the site owner opens it');
  const ui = read('../public/models/dbcata.js');
  assert.match(ui, /GPL-3\.0/);
  assert.match(ui, /C\.DOI|doi\.org/);
});

const PY = process.env.DBCATA_SKIP_PYTHON ? null : ['python3', 'python'].find((p) => spawnSync(p, ['-c', 'import numpy'], { stdio: 'ignore' }).status === 0);
test('the canonical form is the computer\'s (python3 + numpy)', { skip: !PY && 'no python3 with numpy' }, () => {
  const raws = [];
  for (const a of ['Pt', 'ni', 'Au']) for (const b of ['Ni', 'CU', 'Tl']) for (const x of C.RATIOS) raws.push({ metal_a: a, metal_b: b, ratio: x, facet: x === 0.5 ? '(110)' : '111', adsorbate: x === 0.25 ? 'ch3' : 'S', polish: x !== 0.5 });
  const script = `import json, sys\nsys.path.insert(0, 'tools/uma-server')\nimport dbcata_core as c\nout = []\nfor r in json.load(sys.stdin):\n    try: out.append(c.check(r))\n    except c.DomainError as e: out.append({'error': str(e)})\nprint(json.dumps(out))`;
  const res = spawnSync(PY, ['-c', script], { input: JSON.stringify(raws), cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const want = JSON.parse(res.stdout);
  raws.forEach((raw, i) => {
    const mine = C.check(raw);
    if (want[i].error) assert.ok(mine.error, `${JSON.stringify(raw)}: the computer refuses (${want[i].error})`);
    else assert.deepEqual(plain(mine.params), want[i], JSON.stringify(raw));
  });
});

test('a whole toy result from the worker turns into rows and frames (python3 + numpy)', { skip: !PY && 'no python3 with numpy' }, () => {
  const lines = [{ op: 'run', params: { metal_a: 'Ga', metal_b: 'Pd', ratio: 0.25, facet: '110', adsorbate: 'SH', polish: false, steps: 20, lattice: 'vegard' } }];
  const res = spawnSync(PY, ['-X', 'utf8', 'tools/uma-server/dbcata_worker.py'], { input: lines.map((l) => JSON.stringify(l)).join('\n') + '\n', cwd: new URL('..', import.meta.url),
    encoding: 'utf8', env: { ...process.env, MOLASTRIA_DBCATA_TOY: '1', PYTHONUTF8: '1' } });
  assert.equal(res.status, 0, res.stderr);
  const reply = JSON.parse(res.stdout.trim().split('\n').at(-1));
  assert.ok(reply.ok, reply.error);
  const r = reply.result, rows = C.rows(r);
  assert.equal(rows.length, r.sites.length);
  assert.equal(r.reference.available, false);
  assert.ok(rows.every((x) => Number.isFinite(x.energy)), 'E - E_slab for SH');
  assert.deepEqual(plain(C.frames(r.sites[0].xyz).map((f) => f.label)), ['initial', 'DBCata']);
  assert.equal(C.csv(r).trim().split('\n').length, rows.length + 1);
});
