// 逐步解谱讲解（public/nmr/walkthrough/）：nw-core.js 的纯逻辑和生成的文件。
// 照 nmr-walkthrough 自己的 scripts/test.mjs：每个示例校验没有警告、没有来源就拒绝；另外核对“数据必须真实”的两道关
// （ground 把用户数据里找不到的数改标成 ≈ / *，finalize 换掉模型写的来源）、提示词、取 JSON，以及页面接上了顶栏、SEO 和最近更新。
// 设 NMRW_SRC=<nmr-walkthrough 的路径> 时，再对照上游的 lib/build.mjs：校验结果和生成的网页逐字一样。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public/nmr/walkthrough');
const require = createRequire(import.meta.url);
const W = require(join(DIR, 'nw-core.js'));
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(DIR, 'nw-guide.js'), 'utf8'), ctx);
const G = JSON.parse(JSON.stringify(ctx.window.MOLASTRIA_NMRW_GUIDE));
const TPL = readFileSync(join(DIR, 'player.html'), 'utf8');
const ex = (id) => JSON.parse(JSON.stringify(G.examples.find((e) => e.id === id).spec));

test('generated files: player.html matches the fingerprint, every upstream example in order, guide and schema, MIT licence', () => {
  assert.equal(createHash('sha256').update(TPL).digest('hex').slice(0, 16), G.upstream.playerSha, 'player.html edited by hand: run node tools/nmr-walkthrough-sync.mjs --src …');
  assert.ok(TPL.includes('/*__SPEC__*/null') && TPL.includes('__TITLE__'));
  assert.deepEqual(G.examples.map((e) => e.id), ['ethyl-crotonate', 'estragole', 'pulegone', 'vanillin', 'melatonin', 'ibuprofen']);
  // 三个多谱联用的示例（上游 dcaf255）：¹H、¹³C 加二维谱
  for (const id of ['estragole', 'pulegone', 'melatonin']) {
    const k = ex(id).spectra.map((sp) => sp.nucleus || sp.type);
    assert.ok(k.includes('1H') && k.includes('13C') && ex(id).spectra.filter((sp) => sp.kind === '2d').length >= 2, id);
  }
  assert.match(G.guide, /数据必须真实/);
  assert.match(G.schema, /sources/);
  assert.match(readFileSync(join(DIR, 'LICENSE.txt'), 'utf8'), /^MIT License/);
  assert.equal(G.upstream.license, 'MIT');
});

test('every example validates with no warnings and builds; no sources is an error, unverified downgrades it', () => {
  for (const e of G.examples) {
    const v = W.validate(e.spec);
    assert.deepEqual(v, { errors: [], warnings: [] }, e.id);
    assert.ok(e.spec.sources.length && e.spec.sources.every((s) => s.url || s.label), `${e.id} has sources`);
    const { html } = W.standalone(TPL, e.spec);
    assert.ok(html.startsWith('<!doctype html>') && html.length > 20000, e.id);
    assert.ok(!html.includes('/*__SPEC__*/null'));
    const bare = { ...e.spec, sources: undefined };
    assert.ok(W.validate(bare).errors.some((m) => m.startsWith('no sources')), `${e.id} rejected without sources`);
    assert.equal(W.validate({ ...bare, unverified: true }).errors.length, 0);
  }
  assert.throws(() => W.build(TPL, { ...ex('vanillin'), sources: [] }), /no sources/);
});

test('validate catches the usual mistakes', () => {
  const s = ex('ethyl-crotonate');
  s.steps[1].peaks = ['nope'];
  s.steps[2].reveal = { atoms: ['ghost'] };
  s.spectra[0].peaks[1].id = s.spectra[0].peaks[0].id;
  const { errors } = W.validate(s);
  assert.ok(errors.some((m) => /unknown peak "nope"/.test(m)));
  assert.ok(errors.some((m) => /unknown atom "ghost"/.test(m)));
  assert.ok(errors.some((m) => /duplicate peak id/.test(m)));
  assert.deepEqual(W.validate(null).errors, ['spec must be an object']);
});

test('the page HTML: theme goes on <html>, "<" in text cannot close the script, title escaped', () => {
  const s = ex('ethyl-crotonate');
  s.shortTitle = 'a <b> & c';
  s.steps[0].text = { zh: '</script><script>alert(1)</script>', en: 'x' };
  const { html } = W.standalone(TPL, s, { theme: 'dark' });
  assert.match(html, /^<!doctype html>\n<html lang="zh" data-theme="dark">/);
  assert.ok(!html.includes('</script><script>alert(1)'));
  assert.ok(html.includes('<title>a &lt;b&gt; &amp; c</title>'));
  assert.doesNotMatch(W.standalone(TPL, s, { theme: 'evil" onload="x' }).html, /onload/);
});

test('numbersIn reads numbers, decimal commas and ranges', () => {
  const { nums, ranges } = W.numbersIn('δ 7,26 (s); 7.20–7.35 (m, 5H)，J = 15.6 Hz; 2.1 ~ 2.4');
  assert.ok(nums.includes(7.26) && nums.includes(15.6) && nums.includes(5));
  assert.deepEqual(ranges, [[7.2, 7.35], [2.1, 2.4]]);
});

test('ground: numbers in the user data pass; made-up ones are marked ≈ / * and listed', () => {
  const s = ex('ethyl-crotonate');
  // the user's data: every 1D shift and J of the example, written as a peak list
  const lines = s.spectra.filter((sp) => sp.kind !== '2d').map((sp) => `${sp.nucleus}: ` + sp.peaks.map((p) => `${p.ppm}${p.J ? ` (J = ${p.J.join(', ')} Hz)` : ''}`).join(', '));
  const data = lines.join('\n');
  const clean = W.ground({ ...s, spectra: s.spectra.map((sp) => ({ ...sp, peaks: sp.peaks.map((p) => { const q = { ...p }; delete q.est; delete q.Jest; delete q.expected; return q; }) })) }, data);
  // 2D peaks sit on 1D shifts, so they pass too
  assert.deepEqual(clean.flagged, [], JSON.stringify(clean.flagged));
  assert.ok(clean.checked > 10);
  // now the model "remembers" a shift and a J value that the user never gave, and adds a cross peak
  const bad = JSON.parse(JSON.stringify(s));
  const h = bad.spectra.find((sp) => sp.nucleus === '1H');
  const p0 = h.peaks[0];
  delete p0.est; delete p0.Jest;
  p0.ppm = +(p0.ppm + 0.37).toFixed(2);
  p0.J = [11.3];
  const two = bad.spectra.find((sp) => sp.kind === '2d');
  two.peaks.push({ id: 'made-up', x: 9.99, y: 199.9 });
  const g = W.ground(bad, data);
  assert.ok(g.flagged.some((f) => f.kind === 'shift' && f.id === p0.id));
  assert.ok(g.flagged.some((f) => f.kind === 'J' && f.id === p0.id));
  assert.ok(g.flagged.some((f) => f.kind === 'cross' && f.id === 'made-up'));
  const q = g.spec.spectra.find((sp) => sp.nucleus === '1H').peaks[0];
  assert.equal(q.est, true); assert.equal(q.Jest, true);
  assert.equal(g.spec.spectra.find((sp) => sp.kind === '2d').peaks.at(-1).expected, true);
  assert.equal(bad.spectra[0].peaks[0].est, undefined, 'the input spec is not changed');
  // a multiplet centre inside a range the user wrote counts as found
  const r = W.ground({ spectra: [{ id: 'h', kind: '1d', nucleus: '1H', range: [8, 0], peaks: [{ id: 'm', ppm: 7.28, mult: 'm' }] }] }, '7.20–7.35 (m, 5H)');
  assert.deepEqual(r.flagged, []);
});

test('ground on each example: a user who pastes the example\'s own numbers gets nothing re-flagged', () => {
  for (const e of G.examples) {
    const s = ex(e.id);
    const lines = s.spectra.map((sp) => (sp.kind === '2d'
      ? `${sp.type}: ` + sp.peaks.filter((p) => !p.expected).map((p) => `${p.x}/${p.y}`).join(', ')
      : `${sp.nucleus}: ` + sp.peaks.filter((p) => !p.est).map((p) => `${p.ppm}${p.J && !p.Jest ? ` (J = ${p.J.join(', ')} Hz)` : ''}`).join(', ')));
    const g = W.ground(s, lines.join('\n'));
    assert.deepEqual(g.flagged, [], `${e.id}: ${JSON.stringify(g.flagged)}`);
    assert.ok(g.checked > 10, e.id);
  }
});

test('finalize: the user data is the only source, unverified is dropped, the note is honest', () => {
  const s = ex('vanillin');
  s.unverified = true;
  s.sources.push({ label: 'A paper the model remembered', url: 'https://doi.org/10.0000/fake' });
  const out = W.finalize(s, { label: 'My spectra, 2026-11-20', model: 'DeepSeek · deepseek-v4-pro', flagged: [{}, {}], checked: 31, answerGiven: false, lang: 'en' });
  assert.equal(out.sources.length, 1);
  assert.equal(out.sources[0].label, 'My spectra, 2026-11-20');
  assert.ok(!JSON.stringify(out.sources).includes('fake'));
  assert.equal(out.unverified, undefined);
  assert.match(out.sources[0].covers.zh, /31 个数，2 个在用户的数据里找不到/);
  assert.match(out.note.en, /deduced by the model/);
  assert.equal(out.lang, 'en');
  assert.equal(s.sources.length, 3, 'input untouched');
  assert.match(W.finalize(s, {}).sources[0].label, /用户提供/);
  assert.deepEqual(W.validate(out).errors, []);
});

test('prompts: rules, method, schema and one example; the user data are fenced; repair lists the errors', () => {
  const sys = W.systemPrompt(G);
  assert.match(sys, /Use ONLY the numbers the user gives you/);
  assert.match(sys, /Do not write a "sources" field/);
  assert.ok(sys.includes(G.guide) && sys.includes(G.schema));
  assert.ok(sys.includes(JSON.stringify(ex('ethyl-crotonate'))));
  assert.ok(W.estTokens(sys) < 30000, `system prompt ${W.estTokens(sys)} tokens`);
  const u = W.userPrompt({ formula: 'C6H10O2', data: '1H: 6.97 (dq)', answer: '', images: 2 });
  assert.match(u, /Molecular formula: C6H10O2/);
  assert.match(u, /deduce it from the data/);
  assert.match(u, /attached 2 image/);
  assert.match(u, /--- USER DATA[\s\S]*6\.97 \(dq\)[\s\S]*--- END OF USER DATA ---/);
  assert.match(W.userPrompt({ data: 'x', answer: 'vanillin' }), /Expected answer given by the user[^\n]*vanillin/);
  assert.match(W.repairPrompt(['step 2: unknown peak "x"'], ['w']), /unknown peak "x"[\s\S]*Also/);
});

test('extractJSON: fenced, bare, trailing commas; refuses prose', () => {
  assert.deepEqual(W.extractJSON('Here:\n```json\n{"a": 1}\n```\nthanks'), { a: 1 });
  assert.deepEqual(W.extractJSON('sure {"a": [1, 2,], } done'), { a: [1, 2] });
  assert.throws(() => W.extractJSON('no json here'), /no-json/);
  assert.throws(() => W.extractJSON('{"a": '), /bad-json/);
  assert.equal(W.slug(ex('vanillin')), 'c8h8o3-nmr-walkthrough');
  assert.equal(W.slug({ title: { zh: '中文' } }), 'nmr-walkthrough');
});

test('the page: key handling stays in the browser, sandboxed frame, nav / SEO / updates / CI wired up', () => {
  const page = readFileSync(join(DIR, 'index.html'), 'utf8');
  const js = readFileSync(join(DIR, 'nw.js'), 'utf8');
  assert.match(page, /data-section="nmr"/);
  for (const s of ['../../paper/po-core.js', 'nw-guide.js', 'nw-core.js', 'nw.js']) assert.ok(page.includes(`src="${s}"`), s);
  assert.match(js, /sandbox="allow-scripts"/);
  assert.doesNotMatch(js, /allow-same-origin/);
  assert.match(js, /credentials: 'omit'/);
  assert.match(js, /referrerPolicy: 'no-referrer'/);
  assert.doesNotMatch(js, /accountApi|api\.molastria\.com|MolAstriaSync/);
  // the key store is not in the cloud sync list
  const sync = readFileSync(join(ROOT, 'public/sync/sync-core.js'), 'utf8');
  assert.doesNotMatch(sync, /molastria-nmrw/);
  const nav = readFileSync(join(ROOT, 'public/shared-nav.js'), 'utf8');
  assert.match(nav, /nmr\/walkthrough\/index\.html/);
  assert.match(readFileSync(join(ROOT, 'tools/build-seo.ts'), 'utf8'), /"nmr\/walkthrough\/"/);
  assert.match(readFileSync(join(ROOT, 'public/updates/updates-data.js'), 'utf8'), /path: 'nmr\/walkthrough\/index\.html'/);
  assert.match(readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8'), /tools\/nmr-walkthrough-test\.mjs/);
  assert.match(readFileSync(join(ROOT, 'public/nmr/index.html'), 'utf8'), /walkthrough\/index\.html/);
  for (const ch of ['↗', '→', '←']) assert.ok(!js.includes(ch + '<') && !page.includes(ch), `no ${ch} arrow characters on buttons`);
});

const SRC = process.env.NMRW_SRC;
test('against the upstream nmr-walkthrough (NMRW_SRC)', { skip: !SRC || !existsSync(join(SRC || '.', 'lib/build.mjs')) }, async () => {
  const up = await import(pathToFileURL(join(SRC, 'lib/build.mjs')).href);
  for (const e of G.examples) {
    assert.equal(W.standalone(TPL, e.spec).html, up.build(e.spec, { format: 'standalone' }).html, e.id);
    const broken = { ...e.spec, sources: undefined, steps: [...e.spec.steps.slice(0, 3), { title: 'x', peaks: ['?'] }] };
    assert.deepEqual(W.validate(broken), up.validate(broken), e.id);
  }
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [join(ROOT, 'tools/nmr-walkthrough-sync.mjs'), '--src', SRC, '--check'], { stdio: 'pipe' });
});
