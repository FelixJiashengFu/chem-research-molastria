// Tests for the structure step of the Literature Extractor (public/extract/ocsr-core.js: boxes, crops, the request,
// which answer each molecule keeps) and its hooks in extract-core.js (boxes kept, the box rule in the prompts, the
// disagreement flag, the export). The limits are compared with deploy/account-worker.js (OCSR, UMA_COST.ocsr) and
// tools/uma-server/ocsr_backend.py, which must hold the same numbers.
//   node --test tools/ocsr-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const box = { window: {} };
vm.runInNewContext(readFileSync(`${ROOT}public/extract/extract-core.js`, 'utf8'), box);
vm.runInNewContext(readFileSync(`${ROOT}public/extract/ocsr-core.js`, 'utf8'), box);
const X = box.window.MolAstriaExtract, O = box.window.MolAstriaOCSR;
const plain = (v) => JSON.parse(JSON.stringify(v));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('the limits are the same in the page, the account service and the owner computer', () => {
  const worker = readFileSync(`${ROOT}deploy/account-worker.js`, 'utf8');
  const w = /const OCSR = \{ maxImages: (\d+), maxBytes: (\d+), maxTotal: (\d+) \};/.exec(worker);
  assert.ok(w, 'deploy/account-worker.js defines OCSR');
  assert.deepEqual([+w[1], +w[2], +w[3]], [O.LIMITS.maxImages, O.LIMITS.maxBytes, O.LIMITS.maxTotal]);
  assert.equal(+/UMA_COST = \{[^}]*\bocsr: (\d+)/.exec(worker)[1], O.COST, 'one use per image');
  assert.match(worker, /'molnextr': 'open'/, 'MolNexTR is Apache-2.0: open to the API too');
  assert.match(worker, /model === 'molnextr'\) return \['ocsr'\]|molnextr[^\n]*\['ocsr'\]/);
  const py = readFileSync(`${ROOT}tools/uma-server/ocsr_backend.py`, 'utf8');
  const num = (name) => +new RegExp(`^${name} = (\\d+)`, 'm').exec(py)[1];
  assert.deepEqual([num('MAX_IMAGES'), num('MAX_BYTES'), num('MAX_TOTAL'), num('MAX_SIDE'), num('MIN_SIDE'), num('ITEM_COST')],
    [O.LIMITS.maxImages, O.LIMITS.maxBytes, O.LIMITS.maxTotal, O.LIMITS.maxSide, O.LIMITS.minSide, O.COST]);
  assert.match(py, /^MODEL = "molnextr"/m);
  assert.equal(O.MODEL, 'molnextr');
  assert.equal(O.JOB, 'ocsr');
  assert.ok(O.CROP_SIDE <= O.LIMITS.maxSide);
  // the server takes a larger body only for this job, sized for maxTotal in base64
  const server = readFileSync(`${ROOT}tools/uma-server/server.py`, 'utf8');
  assert.match(server, /OCSR_BODY = \(ocb\.MAX_TOTAL \+ 2\) \/\/ 3 \* 4 \+ 8192/);
  assert.match(worker, /const OCSR_BODY = Math\.ceil\(OCSR\.maxTotal \/ 3\) \* 4 \+ 8192;/);
  // the page loads the account address and the structure logic
  const html = readFileSync(`${ROOT}public/extract/index.html`, 'utf8');
  assert.ok(html.indexOf('../pay/config.js') > 0 && html.indexOf('ocsr-core.js') > html.indexOf('extract-core.js') && html.indexOf('ocsr-core.js') < html.indexOf('extract.js"'));
});

test('boxes: thousandths or fractions, either corner order; nonsense refused', () => {
  assert.deepEqual(plain(O.normBox([100, 200, 300, 600])), { x: 0.1, y: 0.2, w: 0.2, h: 0.4 });
  assert.deepEqual(plain(O.normBox([300, 600, 100, 200])), { x: 0.1, y: 0.2, w: 0.2, h: 0.4 });
  const f = O.normBox([0.1, 0.2, 0.3, 0.6]);
  near(f.w, 0.2, 'w'); near(f.h, 0.4, 'h');
  assert.deepEqual(plain(O.normBox({ x: 0.5, y: 0.5, w: 0.25, h: 0.25 })), { x: 0.5, y: 0.5, w: 0.25, h: 0.25 });
  assert.deepEqual(plain(O.normBox(['100', '200', '300', '600'])), { x: 0.1, y: 0.2, w: 0.2, h: 0.4 }, 'numbers as strings');
  for (const bad of [null, [], [1, 2, 3], [0, 0, 5, 5], [-10, 0, 100, 100], [0, 0, 2000, 100], ['a', 0, 1, 1], [NaN, 0, 1, 1], 'box', [100, 100, 100, 400]]) assert.equal(O.normBox(bad), null, JSON.stringify(bad));
  // padding stays inside the image
  const p = O.padBox({ x: 0, y: 0.9, w: 0.2, h: 0.1 });
  assert.ok(p.x === 0 && p.y < 0.9 && p.y + p.h <= 1 + 1e-12 && p.w > 0.2);
});

test('a box on the boxed part of the figure maps to the right pixels of the source', () => {
  // the visitor boxed the right half; the model saw that half and put the molecule in its top-left quarter
  assert.deepEqual(plain(O.toPixels({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 1 }, 2000, 1000)), { sx: 1000, sy: 0, sw: 500, sh: 500 });
  assert.deepEqual(plain(O.toPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, null, 800, 400)), { sx: 200, sy: 200, sw: 400, sh: 100 });
  assert.deepEqual(plain(O.fitSize(2400, 600)), { w: 1024, h: 256, k: 1024 / 2400 });
  assert.deepEqual(plain(O.fitSize(300, 200)), { w: 300, h: 200, k: 1 }, 'never upscaled');
  assert.equal(O.fitSize(4000, 30), null, 'a sliver ends up under the minimum side');
});

test('the request: bare PNG / JPEG base64 under the limits, one use per image', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  assert.deepEqual(plain(O.fromDataUrl('data:image/png;base64,' + png)), { format: 'png', b64: png, bytes: 70 });
  assert.equal(O.fromDataUrl('data:image/webp;base64,UklGRg=='), null);
  assert.equal(O.fromDataUrl('data:image/png;base64,<svg>'), null);
  assert.deepEqual(plain(O.body([png, png])), { model: 'molnextr', job: 'ocsr', params: { images: [png, png] } });
  assert.equal(O.cost(3), 3);
  const fails = (images, code) => assert.throws(() => O.body(images), (e) => e.code === code, code);
  fails([], 'none');
  fails(Array(9).fill(png), 'many');
  fails(['R0lGODlhAQABAAAAACw='], 'format');
  fails(['data:image/png;base64,' + png], 'format');
  fails([png + 'A'], 'format');
  fails(['iVBORw0KGgo' + 'A'.repeat(200001)], 'big');
  fails(Array(4).fill('iVBORw0KGgo' + 'A'.repeat(133468 - 11)), 'total');
  assert.equal(O.b64Bytes('iVBORw0KGgo' + 'A'.repeat(133332 - 11)), 99999);
});

const result = () => ({
  reactions: [
    { id: '0_1', kind: 'scheme', source: 'template', reactants: [{ label: '1', smiles: 'CC(=O)c1ccc(Br)cc1', name: '', box: [50, 100, 250, 300] }, { label: '2', smiles: 'OB(O)c1ccccc1', name: '', box: [300, 100, 450, 300] }], products: [{ label: '3', smiles: 'CC(=O)c1ccc(-c2ccccc2)cc1', name: '', box: [700, 100, 950, 300] }], conditions: [], yield: X.parseYield('') },
    { id: '1_1', kind: 'variant', source: 'scope', reactants: [{ label: '1', smiles: 'CC(=O)c1ccc(Br)cc1', name: '', box: [50, 100, 250, 300] }], products: [{ label: '3b', smiles: 'CC(=O)c1ccc(-c2ccc(C)cc2)cc1', name: '' }], conditions: [], yield: X.parseYield('') }
  ],
  molecules: [{ label: 'L1', smiles: '', name: 'SPhos', role: 'ligand', box: [0, 600, 200, 900] }, { label: 'x', smiles: 'C', name: '', role: 'other', box: [0, 0, 3, 3] }],
  entities: [], notes: []
});

test('targets: every boxed molecule once, shared boxes share a crop, the cap respected', () => {
  const r = result();
  const { targets, skipped } = O.targets(r);
  assert.equal(targets.length, 4, '1, 2, 3 and L1; the 3-thousandths box is too small');
  assert.equal(skipped, 0);
  assert.equal(targets[0].mols.length, 2, "reactant 1 of the scheme and of the scope row share one crop");
  const few = O.targets(r, 2);
  assert.deepEqual([few.targets.length, few.skipped], [2, 2]);
  assert.deepEqual(plain(O.targets({ reactions: [], molecules: [] })), { targets: [], skipped: 0 });
});

test('decide: who keeps the structure', () => {
  const ok = (smiles, confidence, extra = {}) => ({ ok: true, valid: true, smiles, canonical: smiles, confidence, ...extra });
  const same = (a, b) => a.replace(/[()]/g, '') === b.replace(/[()]/g, ''); // a stand-in for RDKit's canonical forms
  let d = O.decide('CC(=O)c1ccc(Br)cc1', ok('CC(=O)c1ccc(Br)cc1', 0.6), same);
  assert.deepEqual([d.source, d.disagree, d.reason], ['both', false, 'agree'], 'agreement wins whatever the score');
  d = O.decide('CC(=O)c1ccc(Cl)cc1', ok('CC(=O)c1ccc(Br)cc1', 0.93), same);
  assert.deepEqual([d.source, d.smiles, d.alt, d.disagree], ['molnextr', 'CC(=O)c1ccc(Br)cc1', 'CC(=O)c1ccc(Cl)cc1', true], 'confident MolNexTR replaces, the vision answer kept');
  d = O.decide('CC(=O)c1ccc(Cl)cc1', ok('CC(=O)c1ccc(Br)cc1', 0.7), same);
  assert.deepEqual([d.source, d.smiles, d.alt, d.disagree], ['vision', 'CC(=O)c1ccc(Cl)cc1', 'CC(=O)c1ccc(Br)cc1', true], 'unsure MolNexTR only cross-checks');
  d = O.decide('', ok('c1ccccc1', 0.6), same);
  assert.deepEqual([d.source, d.smiles, d.disagree], ['molnextr', 'c1ccccc1', false], 'an empty vision answer is filled from MID up');
  d = O.decide('', ok('c1ccccc1', 0.3), same);
  assert.deepEqual([d.source, d.smiles, d.alt], ['vision', '', 'c1ccccc1']);
  d = O.decide('[*:1]c1ccc(Br)cc1', ok('*c1ccc(Br)cc1', 0.99), same);
  assert.deepEqual([d.source, d.smiles, d.alt, d.reason, d.disagree], ['vision', '[*:1]c1ccc(Br)cc1', '*c1ccc(Br)cc1', 'rgroups', false], 'R names stay; MolNexTR also saw an R group');
  d = O.decide('[*:1]c1ccc(Br)cc1', ok('Cc1ccc(Br)cc1', 0.99), same);
  assert.equal(d.disagree, true, 'MolNexTR read no R group where the vision model wrote one');
  for (const bad of [null, { ok: false, error: 'too large' }, ok('C1CC', 0.9, { valid: false }), { ok: true, valid: true, smiles: '' }]) {
    d = O.decide('CCO', bad, same);
    assert.deepEqual([d.source, d.smiles, d.reason], ['vision', 'CCO', 'failed']);
  }
  d = O.decide('CCO', ok('CCN', null), same);
  assert.deepEqual([d.source, d.reason], ['vision', 'unscored']);
  d = O.decide('CCO', ok('OCC', 0.9), () => { throw new Error('RDKit broke'); });
  assert.equal(d.source, 'molnextr', 'a failing comparison counts as different');
});

test('apply, swap and tally; the disagreement shows in the check and the export', () => {
  const r = result();
  const item = { ok: true, valid: true, smiles: 'CC(=O)c1ccc(Cl)cc1', canonical: 'CC(=O)c1ccc(Cl)cc1', confidence: 0.95, min_confidence: 0.81 };
  const [m] = r.reactions[0].reactants;
  O.apply(m, O.decide(m.smiles, item), item);
  assert.deepEqual([m.smiles, m.source, m.ocsr.alt, m.ocsr.min, m.ocsr.disagree], ['CC(=O)c1ccc(Cl)cc1', 'molnextr', 'CC(=O)c1ccc(Br)cc1', 0.81, true]);
  X.check(r);
  assert.ok(r.reactions[0].confidence.flags.some((f) => f.code === 'ocsrDisagree' && f.detail === '1'));
  near(r.reactions[0].confidence.score, X.PENALTY.ocsrDisagree * (r.reactions[0].confidence.flags.length > 1 ? r.reactions[0].confidence.flags.filter((f) => f.code !== 'ocsrDisagree').reduce((s, f) => s * X.PENALTY[f.code], 1) : 1), 'one factor of 0.85');
  assert.match(X.flagText({ code: 'ocsrDisagree', detail: '1' }, false), /MolNexTR 和视觉模型/);
  assert.match(X.flagText({ code: 'ocsrDisagree', detail: '1' }, true), /^MolNexTR and the vision model/);
  const j = X.toJSON(r);
  assert.deepEqual(plain(j.reactions[0].reactants[0]), { label: '1', smiles: 'CC(=O)c1ccc(Cl)cc1', source: 'molnextr', molnextr: { smiles: 'CC(=O)c1ccc(Cl)cc1', confidence: 0.95, other: 'CC(=O)c1ccc(Br)cc1', agrees: false } });
  assert.equal(j.reactions[0].reactants[1].source, undefined, 'molecules MolNexTR never saw carry nothing extra');
  assert.equal(j.reactions[0].reactants[0].box, undefined, 'boxes stay out of the export');
  O.swap(m);
  assert.deepEqual([m.smiles, m.source, m.ocsr.alt], ['CC(=O)c1ccc(Br)cc1', 'vision', 'CC(=O)c1ccc(Cl)cc1']);
  O.swap(m);
  assert.equal(m.source, 'molnextr');
  m.source = 'manual';
  X.check(r);
  assert.ok(!r.reactions[0].confidence.flags.some((f) => f.code === 'ocsrDisagree'), 'a hand edit settles it');
  assert.deepEqual(plain(O.tally([m, { source: 'both', ocsr: { disagree: false } }, { source: 'vision', ocsr: { disagree: false, reason: 'failed' } }, { source: 'vision' }])), { both: 1, molnextr: 0, vision: 1, disagree: 1, failed: 1, manual: 1 });
  for (const s of ['vision', 'molnextr', 'both', 'manual', 'pubchem', 'rule']) assert.ok(O.sourceText(s, false) && O.sourceText(s, true) && !/[一-鿿]/.test(O.sourceText(s, true)), s);
});

test('extract-core keeps the boxes the models give and asks for them only when the lane is on', () => {
  const out = X.assemble({
    template: { reactants: [{ label: '1', smiles: 'CCO', box: [1, 2, 300, 400] }, { label: '2', smiles: 'CC', box: [1, 2, 'x', 4] }], products: [{ label: '3', smiles: 'CCOC(C)=O', box: [] }], arrow_text: [] },
    scope: { entries: [{ label: '3a', product_smiles: 'CCOC', box: [500, 500, 700, 700] }] },
    molecules: { molecules: [{ label: 'L', smiles: 'P', role: 'ligand', box: [0, 0, 100, 100] }] }
  });
  assert.deepEqual(plain(out.reactions[0].reactants[0].box), [1, 2, 300, 400]);
  assert.equal(out.reactions[0].reactants[1].box, undefined, 'a broken box is dropped');
  assert.equal(out.reactions[0].products[0].box, undefined);
  assert.deepEqual(plain(out.reactions[1].products[0].box), [500, 500, 700, 700], 'scope cells keep their box on the product');
  assert.deepEqual(plain(out.molecules[0].box), [0, 0, 100, 100]);
  for (const id of ['template', 'molecules', 'scope']) {
    assert.match(X.prompt(id, { boxes: true }).user, /"box": \[x0, y0, x1, y1\][\s\S]*thousandths/, id);
    assert.doesNotMatch(X.prompt(id, {}).user, /"box"/, `${id} without the lane`);
  }
  for (const id of ['planner', 'rtable', 'conditions', 'verify']) assert.doesNotMatch(X.prompt(id, { boxes: true, template: {} }).user, /"box"/, id);
});

test('the licence notice and the self-test script are in place', () => {
  const notice = readFileSync(`${ROOT}tools/uma-server/THIRD-PARTY-molnextr.md`, 'utf8');
  assert.match(notice, /Apache License,? Version 2\.0/);
  assert.match(notice, /6f6502b4ed9733dba8b1ee45d2da474576683194/);
  const self = readFileSync(`${ROOT}tools/uma-server/molnextr_selftest.py`, 'utf8');
  assert.match(self, /--download/);
  assert.match(self, /6f6502b4ed9733dba8b1ee45d2da474576683194/);
  const worker = readFileSync(`${ROOT}tools/uma-server/molnextr_worker.py`, 'utf8');
  assert.doesNotMatch(worker, /pystow\.ensure|hf_hub_download|urlopen/, 'the service never downloads weights');
});
