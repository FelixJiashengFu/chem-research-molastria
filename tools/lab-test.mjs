// Unit tests for the RDKit-free parts of public/lab/chem.js:  node --test tools/lab-test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

new Function(readFileSync(new URL('../public/lab/chem.js', import.meta.url), 'utf8'))();
const L = globalThis.ChemLab;
const cfg = { priorIP: 0.44, priorEA: 0.439, disagreeIP: 0.3, disagreeEA: 0.3, disagreeLi: 0.15, simMin: 0.3, tieWithPrior: true, liWindow: [-2.2, -1.6], credits: { t3: 20 }, roundBudget: 60, maxDFT: 3 };
const mol = (key, ip, ea, li = -1.9, extra = {}) => ({ key, origin: 'ai', round: 1, props: { ip_s: ip, ea_s: ea, li_s: li, ip_m: ip, ea_m: ea, li_m: li }, filter: { sim: 0.6, info: { elements: ['C', 'H', 'O'], heavy: 8 } }, ...extra });

test('tanimoto on bit strings', () => {
  assert.equal(L.tanimoto('1100', '1100'), 1);
  assert.equal(L.tanimoto('1100', '0011'), 0);
  assert.equal(L.tanimoto('1110', '0111'), 0.5);
});

test('strict Pareto front: high IP, low EA', () => {
  const ms = [mol('a', 11, -0.5), mol('b', 10, -0.6), mol('c', 10, -0.4), mol('d', 11.5, 0)];
  const front = L.strictFront(ms, cfg).map((m) => m.key).sort();
  assert.deepEqual(front, ['a', 'b', 'd']); // c is dominated by a
});

test('rule 1: gaps inside the prior error are ties', () => {
  const ms = [mol('a', 11, -0.5), mol('c', 10.8, -0.3)];
  assert.deepEqual(L.strictFront(ms, cfg).map((m) => m.key), ['a']);
  assert.deepEqual(L.paretoFront(ms, cfg).map((m) => m.key).sort(), ['a', 'c']);
});

test('Li⁺ window acts as a constraint', () => {
  const ms = [mol('in', 11, -0.5, -1.9), mol('out', 12, -1, -2.6)];
  assert.deepEqual(L.strictFront(ms, cfg).map((m) => m.key), ['in']);
});

test('hypervolume grows when the front advances', () => {
  const ref = { ip: 10, ea: 0 };
  const before = L.hypervolume([mol('a', 11, -0.5)], ref);
  const after = L.hypervolume([mol('a', 11, -0.5), mol('b', 12, -0.2)], ref);
  assert.equal(before, 0.5);
  assert.ok(Math.abs(after - (2 * 0.2 + 1 * 0.3)) < 1e-9);
});

test('reliability: model disagreement and reference distance', () => {
  assert.equal(L.reliability(mol('ok', 11, -0.5), cfg).level, 'trusted');
  const split = mol('split', 11, -0.5); split.props.ip_m = 10.3;
  const r = L.reliability(split, cfg);
  assert.equal(r.level, 'doubtful');
  assert.match(r.reasons[0], /UMA-S 与 UMA-M 不一致/);
  const far = mol('far', 11, -0.5); far.filter.sim = 0.1;
  assert.notEqual(L.reliability(far, cfg).level, 'trusted');
  const warned = mol('warn', 11, -0.5, -1.9); warned.props.warn = 'fragmented';
  assert.equal(L.reliability(warned, cfg).level, 'doubtful');
  assert.equal(L.reliability({ key: 'x', origin: 'ai', props: {} }, cfg).level, 'pending');
});

test('DFT verdict confirms within the prior and overturns beyond it', () => {
  const a = mol('a', 11, -0.5); a.props.ip_dft = 11.2; a.props.ea_dft = -0.4;
  const b = mol('b', 11, -0.5); b.props.ip_dft = 10.2;
  assert.equal(L.verdict(a, cfg).confirmed, true);
  assert.equal(L.verdict(b, cfg).confirmed, false);
  assert.equal(L.verdict(mol('c', 11, -0.5), cfg), null);
});

test('calibration and Spearman correlation', () => {
  const ms = [1, 2, 3, 4].map((i) => { const m = mol(`m${i}`, 10 + i, -0.5); m.props.ip_dft = 10 + i + 0.1; return m; });
  const cal = L.calibrate(ms);
  assert.equal(cal.ip.n, 4);
  assert.ok(Math.abs(cal.ip.mae - 0.1) < 1e-9);
  assert.equal(cal.ip.rho, 1);
  assert.equal(cal.ea, null);
  assert.equal(L.spearman([[1, 3], [2, 2], [3, 1]]), -1);
});

test('DFT picks stay within the round budget and prefer doubtful front members', () => {
  const ms = [mol('a', 12, -0.5), mol('b', 11.9, -0.45), mol('c', 11.8, -0.4), mol('d', 11.7, -0.35), mol('e', 9, 1)];
  ms[1].props.ip_m = 11.2; // doubtful, on the front
  const { picks, spent } = L.pickForDFT(ms, cfg, (m) => L.reliability(m, cfg));
  assert.ok(spent <= cfg.roundBudget);
  assert.ok(picks.length <= cfg.maxDFT);
  assert.equal(picks[0].m.key, 'b');
});

test('Rowan tier-2 script follows the documented example', () => {
  const py = L.rowanScript('t2', [{ key: 'EC', label: 'EC', smiles: 'O=C1OCCO1' }], { redoxMode: 'RAPID', roundBudget: 60 });
  assert.match(py, /rowan\.submit_redox_potential_workflow\(/);
  assert.match(py, /initial_molecule=rowan\.Molecule\.from_smiles\(smiles\)/);
  assert.match(py, /mode=rowan\.Mode\.RAPID/);
  assert.match(py, /\("EC", "O=C1OCCO1"\)/);
});

test('seed solvents: nine, unique, C/H/O/F only', () => {
  assert.equal(L.SEEDS.length, 9);
  assert.equal(new Set(L.SEEDS.map((s) => s.smiles)).size, 9);
  for (const s of L.SEEDS) assert.match(s.smiles, /^[CHOF0-9()=]+$/i);
});
