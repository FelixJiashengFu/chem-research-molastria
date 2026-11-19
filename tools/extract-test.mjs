// Tests for the Literature Extractor's pure logic (public/extract/extract-core.js) and its demo (extract-demo.js).
// Chemistry is checked with OpenChemLib (installed by npm ci --prefix tools/e2e): every built-in reagent's SMILES has
// the formula written next to it, every substituent attaches without losing atoms, and enumerated products are the
// molecules they should be (compared by OCL's canonical idcode). Without OpenChemLib those parts are skipped.
//   node --test tools/extract-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const box = { window: {} };
vm.runInNewContext(readFileSync(`${ROOT}public/extract/extract-core.js`, 'utf8'), box);
vm.runInNewContext(readFileSync(`${ROOT}public/extract/extract-demo.js`, 'utf8'), box);
const X = box.window.MolAstriaExtract;
const DEMO = box.window.MOLASTRIA_EXTRACT_DEMO;
const plain = (v) => JSON.parse(JSON.stringify(v));

let OCL = null;
try { if (existsSync(`${ROOT}tools/e2e/node_modules/openchemlib`)) OCL = createRequire(`${ROOT}tools/e2e/package.json`)('openchemlib'); } catch { OCL = null; }
const noOCL = !OCL && 'openchemlib is not installed (npm ci --prefix tools/e2e)';
/** Element counts of an OCL formula or a Hill string, H and D merged as H. */
function counts(formula) {
  const out = {};
  for (const [, el, n] of String(formula).matchAll(/([A-Z][a-z]?)(\d*)/g)) { const e = el === 'D' ? 'H' : el; out[e] = (out[e] || 0) + (n ? +n : 1); }
  return out;
}
const sortObj = (o) => Object.fromEntries(Object.entries(o).sort());
const oclFormula = (s) => sortObj(counts(OCL.Molecule.fromSmiles(s).getMolecularFormula().formula));
const idcode = (s) => OCL.Molecule.fromSmiles(s).getIDCode();
const charge = (s) => { const m = OCL.Molecule.fromSmiles(s); let q = 0; for (let i = 0; i < m.getAllAtoms(); i++) q += m.getAtomCharge(i); return q; };
const validate = (s) => { try { OCL.Molecule.fromSmiles(s); return { ok: true }; } catch { return { ok: false }; } };

test('agents: eleven steps in order, every model step has a prompt with its JSON shape and the shared rules', () => {
  assert.deepEqual(plain(X.AGENTS.map((a) => a.id)), ['planner', 'observer', 'template', 'molecules', 'scope', 'rtable', 'conditions', 'text', 'merge', 'verify', 'check']);
  for (const a of X.AGENTS) {
    assert.ok(a.zh && a.en && a.dz && a.de, `${a.id} has both languages`);
    if (!a.llm) continue;
    const p = X.prompt(a.id, { text: 'Compound 3a was made.', template: DEMO.replies.template, reactions: [] });
    assert.ok(p.system.length > 80 && /JSON/.test(p.user) && /\[\*:n\]/.test(p.user), `${a.id} prompt`);
  }
  assert.match(X.prompt('text', { text: 'hello there' }).user, /TEXT:\nhello there/);
  assert.match(X.prompt('rtable', { template: DEMO.replies.template }).user, /Use the same R names/);
  assert.match(X.prompt('conditions', { template: DEMO.replies.template }).user, /Pd\(PPh3\)4 \(5 mol%\)/);
  assert.throws(() => X.prompt('nope'));
});

test('plan: the observer rules (never both R-group agents, a scheme gets conditions, a table gets its scheme, text only when pasted)', () => {
  let p = X.plan({ scheme: true, scope_panel: true, rgroup_table: true, conditions: true }, { hasText: false });
  assert.deepEqual(plain(p.agents), ['template', 'scope', 'conditions']);
  assert.equal(p.notes.length, 1);
  p = X.plan({ scheme: true }, {});
  assert.deepEqual(plain(p.agents), ['template', 'conditions']);
  p = X.plan({ rgroup_table: true, conditions: true }, {});
  assert.deepEqual(plain(p.agents), ['template', 'rtable', 'conditions']);
  p = X.plan({ standalone: true, text: true }, { hasText: false });
  assert.deepEqual(plain(p.agents), ['molecules']);
  p = X.plan({}, { hasText: true });
  assert.deepEqual(plain(p.agents), ['text']);
  p = X.plan({}, {});
  assert.deepEqual(plain(p.agents), ['molecules'], 'nothing found: read as molecules');
  assert.deepEqual(plain(X.plan({ scheme: true }, { hasImage: false, hasText: true }).agents), ['text']);
  assert.deepEqual(plain(X.plan({}, { hasImage: false, hasText: false }).agents), []);
});

test('SMILES helpers: tokens, syntax check, elements, R normalisation', () => {
  assert.deepEqual(plain(X.tokens('C[C@H](Cl)c1ccccc1%10').map((t) => t.type)), ['atom', 'atom', 'open', 'atom', 'close', 'atom', 'ring', 'atom', 'atom', 'atom', 'atom', 'atom', 'ring', 'ring']);
  for (const s of ['CCO', 'c1ccccc1', 'O=C([O-])[O-].[K+].[K+]', 'C1CC1(C)C', '[*:1]c1ccccc1']) assert.ok(X.syntaxOk(s), s);
  for (const s of ['', 'C(C', 'c1cccc', 'C)C', 'C$$?', '(C)C']) assert.ok(!X.syntaxOk(s), s);
  assert.deepEqual(plain(X.elements('Brc1ccc([Si](C)(C)C)cc1.[Na+].[2H]C.Clc1sccn1')).sort(), ['Br', 'C', 'Cl', 'N', 'Na', 'S', 'Si']);
  assert.deepEqual(plain(X.elements('[nH]1cccc1')), ['N', 'C']);
  assert.equal(X.normalizeR('[R1]c1ccc([R2])cc1[R]'), '[*:1]c1ccc([*:2])cc1[*:0]');
  assert.equal(X.normalizeR('[Rb+].[Ru]'), '[Rb+].[Ru]', 'elements that start with R stay');
  assert.ok(X.hasDummy('C[*:2]') && X.hasDummy('C*') && X.hasDummy('[3*]C') && X.hasDummy('C[R1]') && !X.hasDummy('C[Rh]'));
});

test('substitute: attaches fragments in every position of the core, keeps bonds, renumbers rings', () => {
  const s = (core, v) => X.substitute(core, v).smiles;
  assert.equal(s('c1ccc([*:1])cc1', { 1: '*OC' }), 'c1ccc(OC)cc1');
  assert.equal(s('[*:1]c1ccccc1', { 1: '*OC' }), 'O(C)c1ccccc1', 'a dummy at the start: the rest goes in a branch');
  assert.equal(s('[*:1]c1ccccc1', { 1: '*C(F)(F)F' }), 'C(F)(F)(F)c1ccccc1', 'leading branches stay branches');
  assert.equal(s('c1ccccc1[*:1]', { 1: '*c1ccccc1' }), 'c1ccccc1c2ccccc2', 'ring numbers do not clash');
  assert.equal(s('C([*:1])=O', { 1: '*=O' }), 'C(=O)=O');
  assert.equal(s('CC(=O)[*:2]', { 2: '*[H]' }), 'CC(=O)[H]');
  assert.equal(s('[*:1]C[*:2]', { 1: '*Cl', 2: '*Br' }), 'ClCBr');
  assert.equal(s('C*', { 0: '*N' }), 'CN', 'an unnumbered * is R number 0');
  const r = X.substitute('[*:1]c1ccc([*:2])cc1', { 1: '*C' });
  assert.deepEqual(plain(r.missing), [2]);
  assert.equal(r.smiles, 'C(c1ccc([*:2])cc1)'.replace('C(c1ccc([*:2])cc1)', 'Cc1ccc([*:2])cc1'));
  const bad = X.substitute('C[*:1]', { 1: 'OC*' });
  assert.deepEqual(plain(bad.failed), [1], 'a fragment whose * is not first is refused, not mangled');
  assert.equal(X.substitute('C1CC[*:1]1', { 1: '*C' }).failed.length, 1, 'a ring-closing dummy is refused');
});

test('substitute (OpenChemLib): every substituent attaches without losing atoms, and the products are the right molecules', { skip: noOCL }, () => {
  for (const [name, f] of Object.entries(X.SUBSTITUENTS)) {
    if (name === 'D') { assert.equal(idcode(X.substitute('[*:1]c1ccccc1', { 1: f }).smiles), idcode('[2H]c1ccccc1')); continue; }
    const p = X.substitute('[*:1]c1ccccc1', { 1: f });
    assert.equal(p.missing.length + p.failed.length, 0, name);
    const parent = counts(OCL.Molecule.fromSmiles(f.replace(/^\*/, '[H]')).getMolecularFormula().formula);
    parent.H -= 1; parent.C = (parent.C || 0) + 6; parent.H += 5;
    for (const k of Object.keys(parent)) if (!parent[k]) delete parent[k];
    assert.deepEqual(oclFormula(p.smiles), sortObj(parent), `${name}: ${p.smiles} vs ${f}`);
    // the same fragment in the middle of a chain and at the start of a SMILES
    assert.equal(idcode(X.substitute('CC([*:1])C', { 1: f }).smiles), idcode(X.substitute('[*:1]C(C)C', { 1: f }).smiles), `${name} placement`);
  }
  // a few groups checked against their parent compounds by name
  const parents = { '2-naphthyl': 'c1ccc2ccccc2c1', '1-naphthyl': 'c1ccc2ccccc2c1', Ad: 'C1C2CC3CC1CC(C2)C3', Mes: 'Cc1cc(C)cc(C)c1', TIPS: 'CC(C)[SiH](C(C)C)C(C)C', Fmoc: 'O=COCC1c2ccccc2-c2ccccc12', NO2: '[O-][N+](=O)[H]', '2-thienyl': 'c1ccsc1', Bpin: 'CC1(C)OBOC1(C)C' };
  for (const [n, parentSmiles] of Object.entries(parents)) assert.equal(idcode(X.substitute('[*:1][H]', { 1: X.SUBSTITUENTS[n] }).smiles), idcode(parentSmiles), n);
  // positions: 1- vs 2-naphthyl are different molecules
  assert.notEqual(idcode(X.substitute('C[*:1]', { 1: X.SUBSTITUENTS['1-naphthyl'] }).smiles), idcode(X.substitute('C[*:1]', { 1: X.SUBSTITUENTS['2-naphthyl'] }).smiles));
  assert.equal(idcode(X.substitute('C[*:1]', { 1: X.SUBSTITUENTS['2-naphthyl'] }).smiles), idcode('Cc1ccc2ccccc2c1'), '2-methylnaphthalene');
  assert.equal(idcode(X.substitute('C[*:1]', { 1: X.SUBSTITUENTS['3-pyridyl'] }).smiles), idcode('Cc1cccnc1'), '3-picoline');
});

test('fragment: abbreviations, aliases, substituted phenyls, alkyl formulas, drawn fragments', () => {
  assert.equal(X.fragment('Me'), '*C');
  assert.equal(X.fragment(' MeO '), '*OC');
  assert.equal(X.fragment('t-Bu'), '*C(C)(C)C');
  assert.equal(X.fragment('CO2Et'), X.fragment('EtO2C'));
  assert.equal(X.fragment('n-C5H11'), '*CCCCC');
  assert.equal(X.fragment('C3H7'), '*CCC');
  assert.equal(X.fragment('C6H5'), X.SUBSTITUENTS.Ph);
  assert.equal(X.fragment('4-MeOC6H4'), '*c1ccc(OC)cc1');
  assert.equal(X.fragment('p-MeOC6H4'), '*c1ccc(OC)cc1');
  assert.equal(X.fragment('4-F-C6H4'), '*c1ccc(F)cc1');
  assert.equal(X.fragment('2-ClC6H4'), '*c1c(Cl)cccc1');
  assert.equal(X.fragment('3-CF3C6H4'), '*c1cc(C(F)(F)F)ccc1');
  assert.equal(X.fragment('3,5-Me2C6H3'), '*c1cc(C)cc(C)c1');
  assert.equal(X.fragment('3,5-(CF3)2C6H3'), '*c1cc(C(F)(F)F)cc(C(F)(F)F)c1');
  assert.equal(X.fragment('4-PhC6H4'), '*c1ccc(c2ccccc2)cc1', 'a ring inside the substituent gets its own number');
  assert.equal(X.fragment('4-MeOPh'), '*c1ccc(OC)cc1');
  assert.equal(X.fragment('4–NO₂C₆H₄'), '*c1ccc([N+](=O)[O-])cc1', 'en dash and subscript digits');
  assert.equal(X.fragment('*c1ccco1'), '*c1ccco1', 'a drawn fragment given as SMILES');
  assert.equal(X.fragment('cyclohexyl'), X.SUBSTITUENTS.Cy);
  assert.equal(X.fragment('3,5-MeC6H3'), null, 'two positions but one group');
  assert.equal(X.fragment('7-MeC6H4'), null);
  assert.equal(X.fragment('unobtainium'), null);
  assert.equal(X.fragment(''), null);
  assert.equal(X.fragment('C1CC*1'), null, 'a SMILES whose * is not first is not guessed');
});

test('fragment (OpenChemLib): substituted phenyls are the intended isomers', { skip: noOCL }, () => {
  const on = (v) => idcode(X.substitute('C(=O)(C)[*:1]', { 1: X.fragment(v) }).smiles);
  assert.equal(on('4-MeOC6H4'), idcode('COc1ccc(C(C)=O)cc1'), '4-methoxyacetophenone');
  assert.equal(on('2-MeOC6H4'), idcode('COc1ccccc1C(C)=O'));
  assert.equal(on('3-MeOC6H4'), idcode('COc1cccc(C(C)=O)c1'));
  assert.equal(on('3,5-(CF3)2C6H3'), idcode('CC(=O)c1cc(C(F)(F)F)cc(C(F)(F)F)c1'));
  assert.equal(on('2,4,6-Me3C6H2'), idcode('CC(=O)c1c(C)cc(C)cc1C'), 'mesityl by positions');
});

test('reagents (OpenChemLib): every SMILES has the formula written next to it, salts are neutral overall, names are unique', { skip: noOCL }, () => {
  const names = new Map();
  for (const [smiles, formula, ...aliases] of X.REAGENTS) {
    assert.deepEqual(oclFormula(smiles), sortObj(counts(formula)), `${aliases[0]}: ${smiles}`);
    assert.equal(charge(smiles), 0, `${aliases[0]} is neutral`);
    for (const a of aliases) {
      const k = a.toLowerCase().replace(/[\s·•.]+/g, '');
      if (names.has(k)) assert.equal(names.get(k), smiles, `${a} means one thing`);
      names.set(k, smiles);
    }
  }
  assert.ok(X.REAGENTS.length >= 100, `${X.REAGENTS.length} reagents`);
});

test('reagent names: case, spacing, dots and subscripts do not matter', () => {
  assert.equal(X.reagent('thf').smiles, 'C1CCOC1');
  assert.equal(X.reagent('K₂CO₃').smiles, X.reagent('K2CO3').smiles);
  assert.equal(X.reagent('BF3 · OEt2').smiles, 'FB(F)F.CCOCC');
  assert.equal(X.reagent('t‐BuOK').smiles, X.reagent('KOtBu').smiles);
  assert.equal(X.reagent('Hunig base'), null);
  assert.equal(X.reagent(''), null);
});

test('conditions: split at top-level commas, classify roles, read amounts, split solvent mixtures', () => {
  assert.deepEqual(plain(X.splitConditions('Pd(OAc)2 (5 mol%, 2 h), SPhos; K3PO4\ntoluene')), ['Pd(OAc)2 (5 mol%, 2 h)', 'SPhos', 'K3PO4', 'toluene']);
  const c = (t, r) => plain(X.classify(t, r));
  assert.equal(c('80 °C').role, 'temperature');
  assert.equal(c('rt').role, 'temperature');
  assert.equal(c('−78 ℃').role, 'temperature');
  assert.equal(c('reflux').role, 'temperature');
  assert.equal(c('12 h').role, 'time');
  assert.equal(c('30 min').role, 'time');
  assert.equal(c('overnight').role, 'time');
  assert.equal(c('N2').role, 'atmosphere');
  assert.equal(c('H2 (1 atm)').role, 'atmosphere');
  assert.equal(c('blue LEDs (450 nm)').role, 'light');
  assert.equal(c('92% yield').role, 'yield');
  let x = c('Pd(PPh3)4 (5 mol%)');
  assert.deepEqual([x.role, x.name, x.amount, !!x.smiles], ['catalyst', 'Pd(PPh3)4', '5 mol%', true]);
  x = c('L1 (10 mol%)', 'ligand');
  assert.deepEqual([x.role, x.name, x.amount], ['ligand', 'L1', '10 mol%']);
  x = c('K2CO3 (2.0 equiv)', 'base');
  assert.deepEqual([x.role, x.name, x.amount, x.smiles], ['base', 'K2CO3', '2.0 equiv', 'O=C([O-])[O-].[K+].[K+]']);
  x = c('DMF (0.2 M)');
  assert.deepEqual([x.role, x.name, x.amount], ['solvent', 'DMF', '0.2 M']);
  x = c('cat. DMAP');
  assert.deepEqual([x.role, x.name], ['reagent', 'DMAP']);
  const mix = X.splitMixture(X.classify('toluene/H2O (4:1)', 'solvent'));
  assert.deepEqual(plain(mix.map((m) => [m.role, m.name, m.amount, m.smiles])), [['solvent', 'toluene', '4:1', 'Cc1ccccc1'], ['solvent', 'H2O', '4:1', 'O']]);
  assert.equal(X.splitMixture(X.classify('MeOH/unknownium (1:1)', 'solvent')).length, 1, 'an unknown part keeps the entry whole');
});

test('yields: percent, bare numbers, ee / er / dr, trace and n.d.', () => {
  const y = (s) => plain(X.parseYield(s));
  assert.equal(y('92%').value, 92);
  assert.equal(y('92').value, 92);
  assert.equal(y('85 (92% ee)').value, 85);
  assert.equal(y('85 (92% ee)').ee, '92%');
  assert.deepEqual([y('71%, 95:5 er').value, y('71%, 95:5 er').ee], [71, '95:5 er']);
  assert.deepEqual([y('88% yield, >20:1 dr').value, y('88% yield, >20:1 dr').dr], [88, '>20:1']);
  assert.deepEqual([y('63% (dr = 3:1)').value, y('63% (dr = 3:1)').dr], [63, '3:1']);
  assert.equal(y('trace').value, 0);
  assert.equal(y('n.d.').value, 0);
  assert.equal(y('see SI').value, null);
  assert.equal(y('').text, '');
});

test('relabel: variable reactants follow the row, the product takes the row label', () => {
  assert.equal(X.relabel('1', '3a', '3'), '1a');
  assert.equal(X.relabel('2', '3ab', '3'), '2ab');
  assert.equal(X.relabel('1', '4b', '3'), '1b');
  assert.equal(X.relabel('1', 'b', '3'), '1b');
  assert.equal(X.relabel('1', 'entry 4', '3'), '1 (entry 4)');
  assert.equal(X.relabel('', '3a', '3'), '');
  assert.equal(X.relabel('1', '', '3'), '1');
});

test('assemble: the demo enumerates six products from the Ar table, keeps the fixed reactant, shares the conditions', () => {
  const r = X.assemble(plain(DEMO.replies));
  assert.equal(r.reactions.length, 7, 'template + 6 rows');
  const [t, ...v] = r.reactions;
  assert.deepEqual([t.id, t.kind], ['0_1', 'template']);
  assert.deepEqual(plain(v.map((x) => x.products[0].label)), ['3a', '3b', '3c', '3d', '3e', '3f']);
  assert.deepEqual(plain(v.map((x) => x.reactants.map((m) => m.label))), [['1', '2a'], ['1', '2b'], ['1', '2c'], ['1', '2d'], ['1', '2e'], ['1', '2f']]);
  assert.deepEqual(plain(v.map((x) => x.yield.value)), [95, 92, 88, 90, 84, 76]);
  assert.deepEqual(plain(t.conditions.map((c) => [c.role, c.name])), [['catalyst', 'Pd(PPh3)4'], ['base', 'K2CO3'], ['solvent', 'toluene'], ['solvent', 'H2O'], ['temperature', ''], ['time', '']]);
  assert.ok(v.every((x) => x.conditions.length === 6 && x.conditions.every((c) => c.role === 'temperature' || c.role === 'time' || c.smiles)), 'every molecule in the conditions has a SMILES');
  assert.deepEqual(plain(v[1].rvalues), { Ar: '4-MeOC6H4' });
  assert.equal(r.entities.length, 8);
});

test('assemble + check (OpenChemLib): the demo products are the right biaryls and every reaction scores high', { skip: noOCL }, () => {
  const r = X.check(X.assemble(plain(DEMO.replies)), { validate });
  const want = ['CC(=O)c1ccc(-c2ccccc2)cc1', 'CC(=O)c1ccc(-c2ccc(OC)cc2)cc1', 'CC(=O)c1ccc(-c2ccc(F)cc2)cc1', 'CC(=O)c1ccc(-c2cc(C)cc(C)c2)cc1', 'CC(=O)c1ccc(-c2ccc3ccccc3c2)cc1', 'CC(=O)c1ccc(-c2cccs2)cc1'];
  assert.deepEqual(plain(r.reactions.slice(1).map((x) => idcode(x.products[0].smiles))), want.map(idcode));
  assert.deepEqual(plain(r.reactions.slice(1).map((x) => idcode(x.reactants[1].smiles))), want.map((s) => idcode(s.replace(/^CC\(=O\)c1ccc\(-(.*)\)cc1$/, (m, ar) => ar.replace(/^c2/, 'OB(O)c2')))), 'boronic acids 2a–2f');
  assert.deepEqual(plain(r.reactions.map((x) => x.confidence.level)), Array(7).fill('high'));
  assert.deepEqual(plain(r.summary), { reactions: 7, high: 7, medium: 0, low: 0, molecules: 0 });
});

test('assemble: scope panels, molecule labels in the conditions, text reactions, an R table without a scheme', () => {
  const r = X.assemble({
    template: { reactants: [{ label: '1', smiles: '[*:1]C=O' }, { label: '2', smiles: 'CN' }], products: [{ label: '3', smiles: '[*:1]CNC' }], rgroups: [{ name: 'R', map: 1 }] },
    molecules: { molecules: [{ label: 'L1', smiles: 'c1ccc(P(c2ccccc2)c2ccccc2)cc1', role: 'ligand' }, { label: '7', smiles: 'CCO' }] },
    scope: { entries: [{ label: '3a', product_smiles: 'c1ccccc1CNC', reactants: [{ label: '1a', smiles: 'O=Cc1ccccc1' }], yield: '81%', ee: '90%' }, { label: '3b', product_smiles: 'CCCNC', yield: 'trace' }] },
    conditions: { conditions: [{ text: 'L1 (10 mol%)', role: 'ligand', name: 'L1' }, { text: 'NaBH4', role: 'reductant' }, { text: 'MeOH, 0 °C to rt' }] },
    text: { reactions: [{ reactants: [{ name: 'ethanol' }], products: [{ label: '7' }], conditions: [{ text: '25 °C' }], yield: '50%', sentence: 'Ethanol gave 7.' }] }
  });
  const [t, a, b, tx] = r.reactions;
  assert.deepEqual(plain(t.conditions.map((c) => [c.role, c.name || c.text, !!c.smiles])), [['ligand', 'L1', true], ['reductant', 'NaBH4', true], ['solvent', 'MeOH', true], ['temperature', '0 °C to rt', false]]);
  assert.equal(t.conditions[0].label, 'L1', 'a labelled molecule fills the ligand');
  assert.deepEqual(plain(a.reactants.map((m) => m.label)), ['1a', '2'], 'the fixed amine is added to the cell');
  assert.deepEqual([a.yield.value, a.yield.ee], [81, '90%']);
  assert.equal(b.yield.value, 0);
  assert.deepEqual(plain(b.reactants.map((m) => m.label)), ['2'], 'no variable reactant given: only the fixed one');
  assert.deepEqual([tx.kind, tx.reactants[0].smiles, tx.products[0].smiles, tx.yield.value], ['text', 'CCO', 'CCO', 50]);
  const lonely = X.assemble({ rtable: { columns: ['R'], rows: [{ label: '3a', values: { R: 'Me' } }] } });
  assert.equal(lonely.notes.length, 1, 'an R table without a scheme says so');
});

test('assemble: unknown substituents are listed, a lone * takes the only R column, arrow text stands in for the conditions agent', () => {
  const r = X.assemble({
    template: { reactants: [{ label: '1', smiles: 'Brc1ccc(*)cc1' }], products: [{ label: '2', smiles: 'Nc1ccc(*)cc1' }], arrow_text: ['NH3, CuI (10 mol%)', '100 °C, 24 h'] },
    rtable: { columns: ['R'], rows: [{ label: '2a', values: { R: 'OMe' }, yield: '70' }, { label: '2b', values: { R: 'pentafluorosulfanyl-ish' }, yield: '40' }] }
  });
  const [t, a, b] = r.reactions;
  assert.deepEqual(plain(t.conditions.map((c) => c.role)), ['reagent', 'catalyst', 'temperature', 'time']);
  assert.equal(a.products[0].smiles, 'Nc1ccc(OC)cc1');
  assert.deepEqual(plain(b.unresolved), ['R = pentafluorosulfanyl-ish']);
  const checked = X.check(r, {});
  assert.equal(checked.reactions[2].confidence.level, 'low');
  assert.deepEqual(plain(checked.reactions[2].confidence.flags.map((f) => f.code)), ['unfilled', 'unfilled', 'unresolved']);
});

test('check: invalid SMILES, missing products, unexplained elements, odd yields, duplicate labels, model review', () => {
  const rx = (o) => ({ id: o.id || 'x', kind: o.kind || 'variant', reactants: o.reactants || [{ label: '1', smiles: 'CCO' }], products: o.products || [{ label: 'p', smiles: 'CCOC' }], conditions: o.conditions || [], yield: X.parseYield(o.y || '') });
  const result = { reactions: [
    rx({ id: 'a', products: [{ label: 'p', smiles: 'C1CC' }] }),
    rx({ id: 'b', products: [] }),
    rx({ id: 'c', products: [{ label: 'q', smiles: 'CCOCCl' }] }),
    rx({ id: 'd', products: [{ label: 'r', smiles: 'CCOCCl' }], conditions: [{ role: 'reagent', name: 'mystery', text: 'mystery' }] }),
    rx({ id: 'e', products: [{ label: 's', smiles: 'CCOCCl' }], conditions: [{ role: 'reagent', name: 'SOCl2', text: 'SOCl2', smiles: 'O=S(Cl)Cl' }], y: '120%' }),
    rx({ id: 'f', products: [{ label: 'p', smiles: 'CCC' }] }),
    rx({ id: 'g', kind: 'template', reactants: [{ label: '1', smiles: '[*:1]C' }], products: [{ label: '2', smiles: '[*:1]CC' }] })
  ], molecules: [] };
  X.check(result, { review: { reactions: [{ id: 'f', products: 'no', yield: 'unsure', note: 'wrong ring' }] } });
  const codes = Object.fromEntries(result.reactions.map((r) => [r.id, r.confidence.flags.map((f) => f.code)]));
  assert.deepEqual(plain(codes), {
    a: ['invalid', 'dupLabel'], b: ['noProduct'], c: ['element'], d: ['elementSoft', 'noSmiles'], e: ['yieldOdd'],
    f: ['dupLabel', 'review_no', 'review_unsure'], g: []
  });
  assert.equal(result.reactions[0].confidence.level, 'low');
  assert.equal(result.reactions[6].confidence.score, 1, 'a general template may keep its R groups');
  assert.equal(result.reactions[4].confidence.level, 'medium');
  assert.equal(X.flagText(result.reactions[2].confidence.flags[0], false), '产物里的 Cl 不在任何反应物或试剂里');
  assert.equal(X.flagText(result.reactions[2].confidence.flags[0], true), 'Product has Cl, which no reactant or reagent brings');
  assert.deepEqual(plain(result.summary), { reactions: 7, high: 1, medium: 3, low: 3, molecules: 0 });
  assert.equal([X.level(0.85), X.level(0.849), X.level(0.5), X.level(0.49)].join(), 'high,medium,medium,low');
});

test('exports: reaction SMILES, JSON in ChemEAGLE’s shape, CSV that spreadsheets cannot run', () => {
  const r = X.check(X.assemble(plain(DEMO.replies)), {});
  assert.equal(X.rxnSmiles(r.reactions[1]), 'CC(=O)c1ccc(Br)cc1.OB(O)c1ccccc1>' + r.reactions[1].conditions.map((c) => c.smiles).filter(Boolean).join('.') + '>CC(=O)c1ccc(c1ccccc1)cc1'.replace('c(c1ccccc1)cc1', 'c(c2ccccc2)cc1'));
  const j = X.toJSON(r, { date: '2026-11-19', model: 'demo' });
  assert.equal(j.format, 'molastria-extract/1');
  assert.equal(j.reactions.length, 7);
  assert.deepEqual(Object.keys(j.reactions[1]).slice(0, 5), ['reaction_id', 'kind', 'reactants', 'conditions', 'products']);
  assert.deepEqual(plain(j.reactions[1].conditions.at(-1)), { role: 'yield', text: '95' });
  assert.equal(j.reactions[1].yield_percent, 95);
  assert.equal(j.reactions[1].confidence.level, 'high');
  const csv = X.toCSV(r);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 8);
  assert.equal(lines[0], X.CSV_COLS.join(','));
  assert.match(lines[2], /^1_1,variant,1; 2a,/);
  const evil = X.toCSV({ reactions: [{ id: '=HYPERLINK("x")', kind: 'text', reactants: [], products: [{ label: '+1', smiles: '-C' }], conditions: [{ role: 'solvent', name: 'a, "b"', text: '' }], yield: X.parseYield('') }], molecules: [] });
  assert.match(evil, /^.*\r\n"'=HYPERLINK\(""x""\)",text,,,"'\+1","'-C",,,"a, ""b""",/);
});

test('parseReply and PubChem helpers', () => {
  assert.deepEqual(plain(X.parseReply('{"a":1}')), { a: 1 });
  assert.deepEqual(plain(X.parseReply('Sure!\n```json\n{"a":[1,2]}\n```')), { a: [1, 2] });
  assert.deepEqual(plain(X.parseReply('Here: {"a":{"b":2}} hope it helps}')), { a: { b: 2 } });
  assert.throws(() => X.parseReply('no json here'));
  assert.equal(X.pubchemNameUrl('4-bromo acetophenone'), 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/4-bromo%20acetophenone/property/SMILES,ConnectivitySMILES,MolecularFormula/JSON');
  assert.deepEqual(plain(X.pubchemName({ PropertyTable: { Properties: [{ CID: 7466, SMILES: 'CC(=O)C1=CC=C(C=C1)Br', MolecularFormula: 'C8H7BrO' }] } })), { cid: 7466, smiles: 'CC(=O)C1=CC=C(C=C1)Br', formula: 'C8H7BrO' });
  assert.equal(X.pubchemName({}), null);
});

test('the sample figure is up to date and says its yields are made up', { skip: noOCL }, () => {
  const svg = readFileSync(`${ROOT}public/extract/sample-suzuki.svg`, 'utf8');
  assert.match(svg, /yields are made up/);
  const run = spawnSync(process.execPath, [`${ROOT}tools/extract-sample.mjs`, '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
