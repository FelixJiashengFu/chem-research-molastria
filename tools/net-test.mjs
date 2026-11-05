// Tests for the network query engine (public/hub/net-engine.js) on the real catalogue snapshot.
// Run: node --test tools/net-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const window = {};
for (const f of ['search-terms.js', 'atlas/content.js', 'merged-data.js', 'hub/net-engine.js']) new Function('window', readFileSync(new URL(f, root), 'utf8'))(window);
const net = window.MolAstriaNet.build(window.CHEMRESEARCH_DATA, window.CHEMDB_CONTENT.guides, window.MolAstriaTerms);
const names = (list) => list.map((x) => (x.entity || x).name);

test('every catalogue entry and handbook chapter is a document', () => {
  assert.equal(net.docs.length, window.CHEMRESEARCH_DATA.items.length + window.CHEMDB_CONTENT.guides.length);
  assert.ok(net.entities.length > 300);
});

test('a program known only from blog titles becomes the centre, with its relations', () => {
  for (const q of ['Shermo', 'shermo', ' SHERMO ']) {
    const r = net.query(q);
    assert.equal(r.mode, 'entity');
    assert.equal(r.center.name, 'Shermo');
  }
  const r = net.query('Shermo');
  assert.ok(net.dedupe(r.primary).length >= 2);
  assert.ok(names(r.related).includes('热力学'));
  assert.ok(names(r.related).includes('配分函数'));
  assert.ok(r.extended.length > 0, 'further reading about the related concepts');
});

test('synonyms, partial names and misspellings resolve to the same node', () => {
  assert.equal(net.query('electrostatic potential').center.name, '静电势');
  assert.equal(net.query('Multiwf').center.name, 'Multiwfn');
  const typo = net.query('Gaussain');
  assert.equal(typo.center.name, 'Gaussian');
  assert.equal(typo.corrected, 'gaussian');
});

test('free text without a node falls back to ranked full-text search', () => {
  const r = net.query('锂电池 电解液');
  assert.equal(r.mode, 'text');
  assert.ok(r.primary.length >= 1);
  for (const x of r.primary) assert.match(x.doc.title + x.doc.excerpt, /电解|electrolyte/i);
  assert.ok(names(r.related).includes('电解液'));
});

test('catalogue software brings its siblings, and spellings of one thing are not relations', () => {
  assert.ok(names(net.query('ORCA').siblings).includes('Gaussian'));
  const dft = net.query('DFT');
  assert.ok(!names(dft.related).includes('密度泛函'));
});

test('a Sobereva post and its forum mirror are one result', () => {
  const r = net.dedupe(net.query('Shermo').primary);
  const both = r.find((x) => x.also.length);
  assert.ok(both, 'merged pair');
  assert.deepEqual(new Set([both.doc.source, ...both.also.map((d) => d.source)]), new Set(['sobereva', 'keinsci']));
});

test('suggestions complete names and say which kind they are', () => {
  const s = net.suggest('multi');
  assert.equal(s[0].entity.name, 'Multiwfn');
  assert.ok(net.suggest('静电').some((x) => x.entity.name === '静电势'));
});
