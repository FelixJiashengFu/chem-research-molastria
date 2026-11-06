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

test('English entries mention a program in their own text, not through a topic tag label', () => {
  const vasp = net.entities.find((e) => e.name === 'VASP');
  const english = [...vasp.docs.keys()].map((i) => net.docs[i]).filter((d) => !d.official && d.type !== 'handbook' && !/[㐀-鿿]/.test(d.title));
  assert.ok(english.length > 0, 'English entries about VASP');
  for (const d of english) assert.match(d.raw.title + ' ' + d.raw.body, /vasp/i, d.title); // not just tagged "VASP/第一性原理"
});

test('ordinary English words are not names, and the overview hubs are real programs', () => {
  const aim = net.entities.find((e) => e.name === 'AIM');
  for (const [i] of aim.docs) assert.match(net.docs[i].raw.title + ' ' + net.docs[i].raw.body, /\bAIM\b|原子|分子中的原子/, net.docs[i].title);
  const gaussian = net.entities.find((e) => e.name === 'Gaussian');
  for (const [i] of gaussian.docs) {
    const d = net.docs[i];
    const rest = (d.raw.title + ' ' + d.raw.body).replace(/gaussian[- ]?(?:process|basis|type|function|orbital|smearing|distribution|mixture|kernel|regression|noise|broadening|charge|wave|width)\w*/gi, '');
    assert.ok(/gaussian|高斯/i.test(rest) || d.tags.includes('Gaussian'), d.title);
  }
  const hubs = net.overview().related.map((r) => r.entity).filter((e) => ['software', 'database', 'name'].includes(e.kind));
  assert.ok(hubs.length >= 8);
  for (const e of hubs) assert.match(e.name, /[A-Z0-9]|[㐀-鿿]/, `${e.name} looks like an ordinary word`);
});

test('suggestions complete names and say which kind they are', () => {
  const s = net.suggest('multi');
  assert.equal(s[0].entity.name, 'Multiwfn');
  assert.ok(net.suggest('静电').some((x) => x.entity.name === '静电势'));
});
