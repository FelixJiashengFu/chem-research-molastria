// Tests for the Code Desk cheminformatics tab's pure logic (public/code/cheminf-core.js): the molecule list reader,
// Lipinski and Veber, Tanimoto, the substructure-match normaliser, the CSV, and the RDKit Python script it hands out.
// When a python3 with rdkit and pandas is found (CHEMINF_PYTHON, or python3 on PATH), that script is run for real
// and its numbers are checked against RDKit's own values for aspirin, caffeine and benzene.
//   node --test tools/cheminf-test.mjs        (CHEMINF_SKIP_PYTHON=1 skips the Python part)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/code/cheminf-core.js', import.meta.url), 'utf8'), box);
const C = box.window.MolAstriaChemInf;
const plain = (v) => JSON.parse(JSON.stringify(v));

test('parseList: SMILES then an optional name with spaces, comments and blank lines skipped, the 200 cap', () => {
  const { mols, skipped } = C.parseList('# my set\r\nCCO ethanol\n\n  c1ccccc1  \nOC(=O)c1ccccc1O\tsalicylic acid\nCC(=O)O, acetic acid\n');
  assert.deepEqual(plain(mols), [
    { line: 2, smiles: 'CCO', name: 'ethanol' },
    { line: 4, smiles: 'c1ccccc1', name: '' },
    { line: 5, smiles: 'OC(=O)c1ccccc1O', name: 'salicylic acid' },
    { line: 6, smiles: 'CC(=O)O,', name: 'acetic acid' },
  ]);
  assert.deepEqual(plain(skipped), []);
  const many = C.parseList(Array.from({ length: 205 }, (_, i) => `C${'C'.repeat(i)}`).join('\n'));
  assert.equal(many.mols.length, C.MAX_MOLS);
  assert.deepEqual(plain(many.skipped), [201, 202, 203, 204, 205]);
  assert.equal(C.parseList('').mols.length, 0);
  assert.equal(C.parseList(null).mols.length, 0);
});

test('Lipinski: one violation still passes, two fail; Veber needs both', () => {
  const ok = { amw: 180.16, CrippenClogP: 1.31, lipinskiHBD: 1, lipinskiHBA: 4, NumRotatableBonds: 2, tpsa: 63.6 };
  assert.deepEqual(plain(C.lipinski(ok)), { broken: [], pass: true });
  assert.deepEqual(plain(C.lipinski({ ...ok, amw: 501 })), { broken: ['mw'], pass: true });
  assert.deepEqual(plain(C.lipinski({ ...ok, amw: 501, CrippenClogP: 5.2 })), { broken: ['mw', 'logp'], pass: false });
  assert.deepEqual(plain(C.lipinski({ ...ok, lipinskiHBD: 6, lipinskiHBA: 11 })).broken, ['hbd', 'hba']);
  assert.equal(C.lipinski({ ...ok, amw: 500, CrippenClogP: 5, lipinskiHBD: 5, lipinskiHBA: 10 }).pass, true, 'the limits themselves are allowed');
  assert.deepEqual(plain(C.veber(ok)), { broken: [], pass: true });
  assert.deepEqual(plain(C.veber({ ...ok, NumRotatableBonds: 11 })), { broken: ['rotb'], pass: false });
  assert.deepEqual(plain(C.veber({ ...ok, tpsa: 140.1 })).broken, ['tpsa']);
});

test('tanimoto on bit strings: hand-counted cases, symmetry, bad input', () => {
  assert.equal(C.tanimoto('1100', '1010'), 1 / 3);
  assert.equal(C.tanimoto('1111', '1111'), 1);
  assert.equal(C.tanimoto('1000', '0100'), 0);
  assert.equal(C.tanimoto('0000', '0000'), 0, 'two empty fingerprints');
  const a = '1011001110', b = '0011101010';
  assert.equal(C.tanimoto(a, b), C.tanimoto(b, a));
  assert.equal(C.tanimoto(a, b), 4 / 7);
  assert.ok(Number.isNaN(C.tanimoto('10', '100')));
  assert.ok(Number.isNaN(C.tanimoto(null, '1')));
});

test('matches: RDKit.js gives an object for one match and an array for several', () => {
  assert.deepEqual(plain(C.matches('{"atoms":[1,2,3],"bonds":[0,1]}')), [{ atoms: [1, 2, 3], bonds: [0, 1] }]);
  assert.equal(C.matches('[{"atoms":[1],"bonds":[]},{"atoms":[4],"bonds":[]}]').length, 2);
  assert.deepEqual(plain(C.matches('{}')), [], 'no match');
  assert.deepEqual(plain(C.matches('')), []);
  assert.deepEqual(plain(C.matches('not json')), []);
});

test('columns and descriptor labels are unique RDKit.js keys', () => {
  const keys = C.COLUMNS.map((c) => c[0]);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of keys) assert.ok(!(k in C.MORE), `${k} is both a column and a detail row`);
  for (const [, name, dp] of C.COLUMNS) { assert.ok(name); assert.ok(Number.isInteger(dp) && dp >= 0); }
  assert.ok(C.SMARTS.length >= 8 && C.SMARTS.every(([n, s]) => n && s));
  const zh = C.parseList(C.SAMPLES).mols, en = C.parseList(C.SAMPLES_EN).mols;
  assert.deepEqual(zh.map((m) => m.smiles), en.map((m) => m.smiles), 'the two sample lists are the same molecules');
  assert.ok(en.every((m) => /^[a-z ]+$/.test(m.name)));
});

test('csv: English header, quoting, an invalid row, the optional similarity and match columns', () => {
  const d = { amw: 46.069, exactmw: 46.0419, CrippenClogP: -0.0014, tpsa: 20.23, lipinskiHBD: 1, lipinskiHBA: 1, NumRotatableBonds: 0, NumHeavyAtoms: 3, NumRings: 0, NumAromaticRings: 0, FractionCSP3: 1, NumAtomStereoCenters: 0 };
  const rows = [
    { name: 'ethanol, "absolute"', smiles: 'CCO', canonical: 'CCO', formula: 'C2H6O', inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N', d, sim: 0.123456, hits: 1 },
    { name: 'broken', smiles: 'C1CC' },
  ];
  const text = C.csv(rows, { sim: true, hits: true });
  const lines = text.trimEnd().split('\n');
  assert.equal(lines[0], 'name,input_smiles,canonical_smiles,formula,inchikey,amw,exactmw,CrippenClogP,tpsa,lipinskiHBD,lipinskiHBA,NumRotatableBonds,NumHeavyAtoms,NumRings,NumAromaticRings,FractionCSP3,NumAtomStereoCenters,lipinski_violations,veber_pass,tanimoto,substructure_matches');
  assert.equal(lines[1], '"ethanol, ""absolute""",CCO,CCO,C2H6O,LFQSCWFLJHTTHZ-UHFFFAOYSA-N,46.069,46.0419,-0.0014,20.23,1,1,0,3,0,0,1,0,0,true,0.1235,1');
  assert.equal(lines[2], 'broken,C1CC,invalid');
  assert.ok(text.endsWith('\n'));
  assert.ok(!C.csv(rows).split('\n')[0].includes('tanimoto'));
});

test('python: the script lists every molecule and only adds SMARTS / similarity when asked', () => {
  const mols = [{ smiles: 'CCO', name: 'ethanol' }, { smiles: 'c1ccccc1', name: 'say "hi"' }];
  const bare = C.python(mols);
  assert.ok(bare.includes('    ("CCO", "ethanol"),'));
  assert.ok(bare.includes('    ("c1ccccc1", "say \\"hi\\""),'));
  assert.ok(!bare.includes('MolFromSmarts') && !bare.includes('ref_fp'));
  const full = C.python(mols, { smarts: '[OX2H]', ref: 'CCO' });
  assert.ok(full.includes('pattern = Chem.MolFromSmarts("[OX2H]")'));
  assert.ok(full.includes('GetMorganGenerator(radius=2, fpSize=2048)'));
  assert.ok(full.includes('sort_values("tanimoto", ascending=False)'));
});

// ── the Python script, run with RDKit ─────────────────────────────────────
const PY = process.env.CHEMINF_PYTHON || 'python3';
const hasRdkit = !process.env.CHEMINF_SKIP_PYTHON && spawnSync(PY, ['-c', 'import rdkit, pandas'], { encoding: 'utf8' }).status === 0;

test('python: the script runs with RDKit and gives the expected numbers', { skip: hasRdkit ? false : `no ${PY} with rdkit and pandas` }, () => {
  const mols = C.parseList(C.SAMPLES_EN).mols.concat([{ smiles: 'C1CC', name: 'broken' }]);
  const dir = mkdtempSync(join(tmpdir(), 'molastria-cheminf-'));
  try {
    const r = spawnSync(PY, ['-c', C.python(mols, { smarts: '[CX3](=O)[OX2H1]', ref: 'OC(=O)c1ccccc1O' })], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const [head, ...body] = readFileSync(join(dir, 'molastria-descriptors.csv'), 'utf8').trimEnd().split('\n');
    const cols = head.split(',');
    const rows = Object.fromEntries(body.map((ln) => { const v = ln.split(','); return [v[cols.indexOf('name')], Object.fromEntries(cols.map((c, i) => [c, v[i]]))]; }));
    const asp = rows.aspirin;
    assert.equal(asp.inchikey, 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N');
    assert.equal(asp.formula, 'C9H8O4');
    assert.ok(Math.abs(+asp.amw - 180.159) < 0.01);
    assert.ok(Math.abs(+asp.CrippenClogP - 1.31) < 0.01);
    assert.ok(Math.abs(+asp.tpsa - 63.6) < 0.05);
    assert.equal(+asp.lipinski_violations, 0); // pandas writes 0.0 because the invalid row leaves a gap
    assert.equal(+asp.substructure_matches, 1);
    assert.equal(+rows['salicylic acid'].tanimoto, 1, 'the reference itself');
    assert.equal(+rows.benzene.substructure_matches, 0);
    assert.equal(rows.caffeine.formula, 'C8H10N4O2');
    assert.equal(rows.broken.error, 'invalid SMILES');
    assert.equal(body[0].split(',')[cols.indexOf('name')], 'salicylic acid', 'sorted by similarity');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('PubChem structure search: request shapes, CIDs, properties with old and new SMILES field names', () => {
  const sim = C.pubchemSearch('similarity', ' CC(=O)Oc1ccccc1C(=O)O ', { threshold: 95, max: 10 });
  assert.equal(sim.url, 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsimilarity_2d/smiles/cids/JSON?MaxRecords=10&Threshold=95');
  assert.equal(sim.body, 'smiles=CC(%3DO)Oc1ccccc1C(%3DO)O', 'SMILES travel in the form body, = and # escaped');
  assert.equal(C.pubchemSearch('substructure', 'c1ccccc1').url, 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsubstructure/smiles/cids/JSON?MaxRecords=20');
  assert.match(C.pubchemSearch('identity', 'C#N').url, /fastidentity\/smiles\/cids\/JSON\?MaxRecords=20&identity_type=same_connectivity$/);
  assert.equal(C.pubchemSearch('identity', 'C#N').body, 'smiles=C%23N');
  assert.equal(C.pubchemSearch('nonsense', 'C').mode, 'similarity');
  assert.deepEqual([C.pubchemSearch('similarity', 'C', { threshold: 10, max: 999 }).threshold, C.pubchemSearch('similarity', 'C', { threshold: 10, max: 999 }).max], [70, 50]);
  assert.deepEqual(plain(C.pubchemCids({ IdentifierList: { CID: [2244, '1983', 2244, -1, 'x'] } })), [2244, 1983]);
  assert.deepEqual(plain(C.pubchemCids({ Fault: { Code: 'PUGREST.NotFound', Message: 'No CID found' } })), []);
  assert.throws(() => C.pubchemCids({ Fault: { Code: 'PUGREST.BadRequest', Message: 'Unable to standardize the given structure' } }), /standardize/);
  assert.equal(C.pubchemPropsUrl([2244, 1983]), 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244,1983/property/Title,MolecularFormula,MolecularWeight,SMILES,ConnectivitySMILES,IUPACName/JSON');
  const rows = C.pubchemRows({ PropertyTable: { Properties: [
    { CID: 1983, MolecularFormula: 'C8H9NO2', MolecularWeight: '151.16', CanonicalSMILES: 'CC(=O)NC1=CC=C(C=C1)O', Title: 'Acetaminophen' },
    { CID: 2244, MolecularFormula: 'C9H8O4', MolecularWeight: '180.16', SMILES: 'CC(=O)OC1=CC=CC=C1C(=O)O', ConnectivitySMILES: 'CC(=O)OC1=CC=CC=C1C(=O)O', IUPACName: '2-acetyloxybenzoic acid', Title: 'Aspirin' },
  ] } }, [2244, 1983, 5]);
  assert.deepEqual(plain(rows.map((r) => [r.cid, r.title, r.mw, r.smiles])), [[2244, 'Aspirin', 180.16, 'CC(=O)OC1=CC=CC=C1C(=O)O'], [1983, 'Acetaminophen', 151.16, 'CC(=O)NC1=CC=C(C=C1)O']], 'search order kept, a CID without properties dropped');
  assert.equal(rows[0].url, 'https://pubchem.ncbi.nlm.nih.gov/compound/2244');
});
