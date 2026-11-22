// AIMNet2 as an online model: the same elements, jobs and closed-shell rule in every place that holds them — the
// model server (tools/uma-server/server.py, aimnet_worker.py), the account service (deploy/account-worker.js), the
// models page (public/models/models.js), the compute API page (public/api/compute.js), openapi.json and chemdb-agent.
// When python3 can import the server, its own tables are read too. The real model is tested by
// tools/uma-server/test_aimnet_worker.py (needs MOLASTRIA_AIMNET_PYTHON) and aimnet_selftest.py.
//   node --test tools/aimnet-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const worker = read('../deploy/account-worker.js');
const server = read('./uma-server/server.py');
const aimw = read('./uma-server/aimnet_worker.py');
const page = read('../public/models/models.js');
const api = read('../public/api/compute.js');
const openapi = JSON.parse(read('../public/api/v1/openapi.json'));
const agent = read('../agent/chemdb-agent/src/chemdb_agent/adapters/molastria_compute.py');
const quoted = (s) => [...s.matchAll(/["']([A-Za-z]{1,2})["']/g)].map((m) => m[1]);
const GEOM = ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn', 'ts', 'neb'];

test('the fourteen elements are the same in the worker, the server and the page', () => {
  const w = quoted(aimw.match(/^ELEMENTS = \(([^)]*)\)/m)[1]);
  assert.deepEqual(w, ['H', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'As', 'Se', 'Br', 'I']);
  assert.deepEqual(quoted(server.match(/^AIMNET_ELEMENTS = \(([^)]*)\)/m)[1]), w);
  assert.deepEqual(quoted(page.match(/const AIMNET = \[([^\]]*)\]/)[1]), w);
  // the model card says the same list in words
  assert.match(page, new RegExp(w.join(' ')));
});

test('jobs: geometry jobs and the proton affinity, nothing that needs a radical', () => {
  const want = [...GEOM, 'pa'];
  assert.match(server, /^I_JOBS = B_JOBS \+ \("pa",\)$/m);
  assert.match(server, /"aimnet2": \{"name": "AIMNet2 \(wB97M-D3\)", "lane": "aimnet", "jobs": I_JOBS, "charged": True, "closed": True,/);
  assert.match(worker, /UMA_CLOSED\.has\(model\) \? \[\.\.\.UMA_GEOM, 'pa'\]/);
  assert.match(api, /const IONS = \[\.\.\.GEOM, 'pa'\];/);
  assert.match(api, /\['aimnet2', IONS\]/);
  for (const j of ['ipea', 'spin', 'bde']) assert.ok(!want.includes(j));
  // MIT: the open tier, in /v1 too (not academic-only like MACE)
  assert.match(worker, /'aimnet2': 'open'/);
  assert.match(worker, /const UMA_CLOSED = new Set\(\['aimnet2'\]\);/);
  assert.ok(worker.match(/const UMA_CHARGED = new Set\(\[([^\]]*)\]\)/)[1].includes("'aimnet2'"));
  assert.ok(openapi.components.schemas.ComputeJobRequest.properties.model.enum.includes('aimnet2'));
  assert.ok(agent.includes('"aimnet2"'));
});

test('closed-shell: the page, the account service, the server and the worker each refuse a radical', () => {
  assert.match(page, /aimnet2: \{ name: 'AIMNet2', tier: 'open', closed: true,/);
  assert.match(page, /if \(shut && G\(\)\.charged && spin\(\) !== 1\)/);
  assert.match(page, /charged: \{[^}]*models: \[[^\]]*'aimnet2'\]/);
  assert.match(worker, /if \(UMA_CLOSED\.has\(model\) && \(out\.spin \?\? 1\) !== 1\) throw fail\(400, '[^']+', '[^']+'\);/);
  assert.equal((server.match(/if m\.get\("closed"\) and/g) || []).length, 3, 'SMILES, XYZ and reaction species');
  assert.match(server, /if m\.get\("closed"\) and sp\["spin"\] != 1:/);
  assert.match(aimw, /if req\.get\("model"\) in CLOSED and spin != 1:/);
});

test('the server\'s own tables, when python3 can import it', (t) => {
  const r = spawnSync('python3', ['-X', 'utf8', '-c', [
    'import json, sys; sys.path.insert(0, "tools/uma-server")',
    'import server, aimnet_worker',
    'm = server.MODELS["aimnet2"]',
    'print(json.dumps({"jobs": list(m["jobs"]), "elements": list(m["elements"]), "worker": list(aimnet_worker.ELEMENTS), "closed": m["closed"], "lane": m["lane"]}), file=sys.__stdout__)'  // aimnet_worker sends prints to stderr
  ].join('\n')], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  if (r.status !== 0) { t.skip(`python3 cannot import server.py here: ${(r.stderr || '').trim().split('\n').at(-1)}`); return; }
  const v = JSON.parse(r.stdout.trim().split('\n').at(-1));
  assert.deepEqual(v.jobs, [...GEOM, 'pa']);
  assert.deepEqual(v.elements, v.worker);
  assert.equal(v.closed, true);
  assert.equal(v.lane, 'aimnet');
});
