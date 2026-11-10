// 3D 分子查看器（public/viewer/mol3d.js）的纯函数：多帧 XYZ 拆分与拼回、PDB 编号、化学式、样式。
//   node --test tools/mol3d-test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../public/viewer/mol3d.js');

const water = '3\nwater\nO 0.000 0.000 0.000\nH 0.000 0.000 0.960\nH 0.930 0.000 -0.240\n';
test('one frame of XYZ', () => {
  const f = M.splitXyz(water);
  assert.equal(f.length, 1);
  assert.equal(f[0].n, 3);
  assert.equal(f[0].comment, 'water');
  assert.deepEqual(f[0].atoms[1], ['H', 0, 0, 0.96]);
  assert.equal(M.formula(f[0].atoms), 'H2O');
});
test('several frames, CRLF and blank lines between them', () => {
  const two = (water + '\n' + water.replace('water', 'second')).replace(/\n/g, '\r\n');
  const f = M.splitXyz(two);
  assert.deepEqual(f.map((x) => x.comment), ['water', 'second']);
  assert.deepEqual(M.splitXyz(M.joinXyz(f)).map((x) => x.atoms), f.map((x) => x.atoms), 'join then split gives the same atoms');
});
test('a broken frame stops the reading, earlier frames are kept', () => {
  assert.equal(M.splitXyz(water + '2\ncut\nO 0 0 0\n').length, 1, 'one atom line missing');
  assert.equal(M.splitXyz(water + '2\nbad\nO 0 0 x\nH 0 0 1\n').length, 1, 'a coordinate that is not a number');
  assert.equal(M.splitXyz('').length, 0);
  assert.equal(M.splitXyz('hello\nworld').length, 0);
});
test('Hill order: C and H first when there is carbon, otherwise alphabetical', () => {
  assert.equal(M.formula([['O'], ['C'], ['H'], ['H'], ['H'], ['H']]), 'CH4O');
  assert.equal(M.formula([['Cl'], ['Na']]), 'ClNa');
  assert.equal(M.formula([['H'], ['Cl']]), 'ClH');
});
test('PDB ids', () => {
  assert.equal(M.cleanPdbId(' 3eni '), '3ENI');
  assert.equal(M.cleanPdbId('pdb_00003eni'), 'PDB_00003ENI');
  for (const bad of ['0ABC', '3EN', '3ENI1', '../x', '3E I', '']) assert.equal(M.cleanPdbId(bad), '', bad);
});
test('every style is a 3Dmol style object', () => {
  for (const k of ['ballstick', 'stick', 'sphere', 'line', 'cartoon', 'anything']) assert.ok(Object.keys(M.styleOf(k)).length >= 1, k);
  assert.match(M.SRC, /^https:\/\/cdn\.jsdelivr\.net\/npm\/3dmol@\d+\.\d+\.\d+\//, 'pinned version from jsDelivr');
});
