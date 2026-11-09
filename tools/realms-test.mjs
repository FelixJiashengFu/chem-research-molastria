// Tests for 物理疆界图 (Realms of Physics): the content's integrity. Every link joins two existing nodes, every theory
// says where it works and where it breaks, every solved problem has a theory that explains it, and both languages are filled.
//   node --test tools/realms-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/physics-realms/pr-data.js', import.meta.url), 'utf8'), box);
const D = box.window.MOLASTRIA_REALMS;
const nodes = [...D.theories, ...D.problems];
const ids = new Map(nodes.map((n) => [n.id, n]));
const both = (t, where) => { assert.ok(t && t.zh?.trim() && t.en?.trim(), `${where}: both languages`); assert.ok(!/[一-鿿]/.test(t.en), `${where}: no Chinese in the English text`); };

test('ids are unique and every node belongs to a known branch with a known status', () => {
  assert.equal(ids.size, nodes.length, 'unique ids');
  const branches = new Set(D.branches.map((b) => b.id));
  for (const t of D.theories) { assert.ok(branches.has(t.b), `${t.id}: branch`); assert.ok(D.status[t.st], `${t.id}: status`); }
  for (const p of D.problems) { assert.ok(branches.has(p.b), `${p.id}: branch`); assert.ok(D.pstatus[p.st], `${p.id}: status`); assert.ok(p.id.startsWith('p-'), `${p.id}: problem ids start with p-`); }
});

test('every theory states its domain and its frontier in both languages', () => {
  for (const t of D.theories) for (const k of ['name', 'gist', 'works', 'breaks']) both(t[k], `${t.id}.${k}`);
  for (const p of D.problems) for (const k of ['name', 'desc']) both(p[k], `${p.id}.${k}`);
  for (const b of D.branches) both(b.name, `branch ${b.id}`);
  for (const c of D.cube) { both(c.name, 'cube'); both(c.note, 'cube'); }
});

test('links join existing nodes, theory–theory links only between theories, and no duplicates', () => {
  const kinds = new Set(['explains', 'partial', 'fails', 'candidate', 'limit', 'builds', 'replaces']), seen = new Set();
  for (const l of D.links) {
    assert.ok(ids.has(l.a) && ids.has(l.b), `${l.a} → ${l.b}: both ends exist`);
    assert.ok(kinds.has(l.type), `${l.a} → ${l.b}: type ${l.type}`);
    const key = `${l.a}|${l.b}`; assert.ok(!seen.has(key), `${key}: duplicate`); seen.add(key);
    const tt = ['limit', 'builds', 'replaces'].includes(l.type);
    assert.equal(l.a.startsWith('p-'), false, `${key}: links start at a theory`);
    assert.equal(l.b.startsWith('p-'), !tt, `${key}: ${l.type} ends at a ${tt ? 'theory' : 'problem'}`);
    if (l.note) both(l.note, `${key} note`);
    if (l.type === 'limit') assert.ok(l.note, `${key}: a limit names its condition`);
  }
});

test('every node is connected; solved problems are explained, open ones are not', () => {
  const deg = new Map();
  for (const l of D.links) { deg.set(l.a, (deg.get(l.a) || 0) + 1); deg.set(l.b, (deg.get(l.b) || 0) + 1); }
  for (const n of nodes) assert.ok(deg.get(n.id), `${n.id}: connected`);
  for (const p of D.problems) {
    const explained = D.links.some((l) => l.b === p.id && l.type === 'explains');
    if (p.st === 'solved') assert.ok(explained, `${p.id}: a solved problem has an explaining theory`);
    if (p.st === 'open') assert.ok(D.links.some((l) => l.b === p.id && ['fails', 'partial', 'candidate'].includes(l.type)), `${p.id}: an open problem shows where theories stop`);
  }
  // Candidate theories never "explain" anything outright: they are not confirmed.
  for (const l of D.links) if (l.type === 'explains') assert.ok(!['candidate'].includes(ids.get(l.a).st), `${l.a} → ${l.b}: a candidate theory cannot explain`);
});

test('the limit graph has no cycles, so "reduces to" always points to a smaller theory', () => {
  const out = new Map();
  for (const l of D.links) if (l.type === 'limit') (out.get(l.a) || out.set(l.a, []).get(l.a)).push(l.b);
  const state = new Map();
  const visit = (v) => { assert.notEqual(state.get(v), 1, `cycle through ${v}`); if (state.get(v) === 2) return; state.set(v, 1); for (const w of out.get(v) || []) visit(w); state.set(v, 2); };
  for (const v of out.keys()) visit(v);
});

test('the ħ-c-G cube has its eight corners, each pointing at a node when it names one', () => {
  assert.equal(D.cube.length, 8);
  assert.equal(new Set(D.cube.map((c) => c.k.join(''))).size, 8, 'eight distinct corners');
  for (const c of D.cube) if (c.node) assert.ok(ids.has(c.node), `cube → ${c.node}`);
});
