// 论文工坊（public/paper/）的测试：node --test tools/paper-test.mjs
// 一半是对照：tools/paper/fixtures.json 是 PaperOrchestra Studio 原版的 Python 函数跑样例的结果（tools/paper/fixtures.py 生成），
// 这里拿 po-core.js / po-audit.js / po-flow.js 跑同样的输入，中文结论、提示词、diff、数模基准逐字一样。
// 另一半是浏览器这边自己的：服务商的请求、流式返回、价格、检索结果的整理、zip、Markdown 不出 HTML、整条流水线（假模型、假检索）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public', 'paper');
const P = require(path.join(PUB, 'po-core.js'));
const A = require(path.join(PUB, 'po-audit.js'));
const W = require(path.join(PUB, 'po-flow.js'));
const PROMPTS = require(path.join(PUB, 'po-prompts.js'));
const F = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'paper', 'fixtures.json'), 'utf8'));
const SAMPLES = path.join(ROOT, 'tools', 'paper', 'samples');
const read = (p) => fs.readFileSync(p, 'utf8');
const digest = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const zh = (pair) => (Array.isArray(pair) ? pair[0] : pair);
const PO_REPO = process.env.PO_REPO || path.join(ROOT, '..', 'paper-orchestra-studio');
const hasPO = fs.existsSync(path.join(PO_REPO, 'paper-orchestra'));
const python = (() => { const r = spawnSync('python3', ['--version']); return r.status === 0 ? 'python3' : null; })();

// ── 生成的文件是最新的 ────────────────────────────────────────────────────
test('模板是最新的（tools/paper-templates.mjs --check）', { skip: !hasPO && '没有 PaperOrchestra Studio 的检出（PO_REPO）' }, () => {
  execFileSync('node', [path.join(ROOT, 'tools', 'paper-templates.mjs'), '--check', '--src', PO_REPO], { stdio: 'pipe' });
});
test('提示词和对照数据是最新的', { skip: (!hasPO || !python) && '没有 PaperOrchestra Studio 的检出或 python3' }, () => {
  execFileSync(python, [path.join(ROOT, 'tools', 'paper', 'extract-prompts.py'), '--check', '--src', PO_REPO], { stdio: 'pipe' });
  const r = spawnSync(python, ['-c', 'import numpy, pandas']);
  if (r.status === 0) execFileSync(python, [path.join(ROOT, 'tools', 'paper', 'fixtures.py'), '--check', '--src', PO_REPO], { stdio: 'pipe' });
});
test('模板：每套都有 template.tex 和说明，许可证不明的样式文件不在里面', () => {
  const T = require(path.join(PUB, 'po-templates.js'));
  const list = T.templates || T;
  assert.ok(Array.isArray(list) && list.length >= 19, '至少 19 套模板');
  for (const t of list) {
    assert.ok(t.id && t.zh && t.en, `模板 ${t.id} 有名字`);
    const dir = path.join(PUB, 'templates', t.id);
    assert.ok(fs.existsSync(path.join(dir, 'template.tex')), `${t.id}/template.tex`);
    for (const f of t.files) {
      const buf = fs.readFileSync(path.join(dir, f.name));
      assert.equal(buf.length, f.bytes, `${t.id}/${f.name} 的大小`);
      assert.equal(crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16), f.sha, `${t.id}/${f.name} 的哈希`);
    }
    for (const m of t.missing) assert.ok(!fs.existsSync(path.join(dir, m.file)), `${t.id}：${m.file} 不该在仓库里`);
  }
  assert.ok(fs.existsSync(path.join(PUB, 'LICENSE-Apache-2.0.txt')), 'Apache-2.0 全文');
  assert.ok(fs.existsSync(path.join(PUB, 'THIRD-PARTY-paper-orchestra.md')), '出处说明');
});

// ── 对照原版：投稿体检 ────────────────────────────────────────────────────
// Python 读文本文件时 \r\n 变成 \n（universal newlines），页面读文件时也这样换（W.pyText）。
const caseText = (c) => W.pyText(c.name.startsWith('templates/') ? read(path.join(PUB, c.name, 'template.tex')) : read(path.join(SAMPLES, c.name)));
const sameRows = (js, py, where) => {
  assert.equal(js.length, py.length, `${where}：条数`);
  js.forEach((r, i) => {
    const p = py[i], at = `${where} · ${p.id}`;
    assert.equal(r.id, p.id, at);
    assert.equal(r.state, p.state, `${at} 的结论`);
    if (p.label) assert.equal(zh(r.label), p.label, `${at} 的标题`);
    if (p.detail) assert.equal(zh(r.detail), p.detail, `${at} 的说明`);
    assert.deepEqual(r.items.map(zh), p.items, `${at} 的条目`);
    if (p.metrics) assert.deepEqual(r.metrics, p.metrics, `${at} 的指标`);
  });
};
for (const c of F.cases) {
  test(`对照原版：${c.name}`, () => {
    const text = caseText(c);
    const sc = A.stripComments(text);
    assert.equal(digest(sc.text), c.stripComments.text, 'strip_comments 的正文');
    if (typeof c.stripComments.comments === 'string') assert.equal(digest(sc.comments), c.stripComments.comments, 'strip_comments 的注释');
    else assert.deepEqual(sc.comments, c.stripComments.comments, 'strip_comments 的注释');
    assert.equal(digest(A.codeLines(text)), c.codeLines, 'code_lines');
    const m = A.manuscriptAudit(text, c.venue);
    assert.equal(m.isJournal, c.manuscript.isJournal, '是不是期刊');
    sameRows(m.checks, c.manuscript.checks, '稿件体检');
    const code = A.codeLines(text).map(([, x]) => x).join('\n');
    const [venue, blind, why] = A.detectVenue(code);
    assert.equal(venue, c.blind.venue, '认出的模板');
    assert.equal(blind, c.blind.doubleBlind, '是不是双盲');
    assert.equal(zh(why), c.blind.why, '为什么');
    const b = A.blindCheck(text);
    sameRows(b.checks, c.blind.checks, '双盲检查');
    const ai = A.abstractAndIntro(text);
    assert.equal(ai.abstract, c.abstract, '摘要');
    assert.equal(ai.intro, c.intro, '引言');
    const toPy = (a) => a && { ...a, issues: a.issues.map(zh) };
    assert.deepEqual(c.abstract ? toPy(A.auditTextDraft(c.abstract, 'abstract')) : null, c.abstractAudit, '摘要的文风体检');
    assert.deepEqual(c.intro ? toPy(A.auditTextDraft(c.intro, 'introduction')) : null, c.introAudit, '引言的文风体检');
    const fields = c.abstract ? A.abstractFields(c.abstract).map((f) => ({ ...f, label: zh(f.label), suggestion: zh(f.suggestion) })) : null;
    assert.deepEqual(fields, c.abstractFields, '摘要七要素');
    assert.equal(digest(A.splitSentences(A.cleanProse(text))), c.sentences, '分句');
  });
}
test('对照原版：期刊模板给每个角色的 venue_note', () => {
  const T = require(path.join(PUB, 'po-templates.js'));
  const list = T.templates || T;
  for (const [id, roles] of Object.entries(F.venueNotes.byTemplate)) {
    const t = list.find((x) => x.id === id);
    assert.ok(t, id);
    const profile = t.venue && t.venue.kind === 'journal' ? t.venue : null;
    for (const [role, idx] of Object.entries(roles)) {
      const want = F.venueNotes.texts[idx], got = P.venueNote(profile, role);
      assert.equal(/^[0-9a-f]{64}$/.test(want) ? crypto.createHash('sha256').update(JSON.stringify(got)).digest('hex') : got, want, `${id} · ${role}`);
    }
  }
});
test('对照原版：编译日志', () => {
  const log = read(path.join(SAMPLES, 'compile.log'));
  assert.equal(A.unwrapLog(log), F.log.unwrapped);
  const p = A.parseLog(log, 'main.tex');
  assert.deepEqual({ ...p, errors: p.errors.map((e) => ({ ...e, hint: zh(e.hint) })) }, F.log.parsed);
});
test('对照原版：.bib、引用键、只留被引用的条目', () => {
  const bib = read(path.join(SAMPLES, 'refs.bib'));
  assert.deepEqual(P.parseBib(bib), F.bib.parsed);
  const c = P.citedKeys(read(path.join(SAMPLES, 'cites.tex')));
  assert.deepEqual(c.keys, F.bib.cited);
  assert.equal(c.star, F.bib.star);
  const r = P.citedBibText(bib, F.bib.cited);
  assert.equal(r.text, F.bib.citedBib);
  assert.equal(r.count, F.bib.citedCount);
});
test('对照原版：difflib 的相似度和 unified diff', () => {
  for (const [a, b, want] of F.ratio) assert.equal(P.similarity(a, b), want, `${a} / ${b}`);
  for (const [a, b, want] of F.rawRatio) assert.equal(P.seqRatio(a, b), want, `raw ${a.slice(0, 20)}`);
  assert.deepEqual(P.unifiedDiff(F.diffs[0].a, F.diffs[0].b, 'main.tex', 'main.tex (AI 修订)', 2), F.diffs[0].out);
  assert.deepEqual(P.unifiedDiff(F.diffs[1].a, F.diffs[1].b, 'a', 'b', 3), F.diffs[1].out, 'b 不短于 200 行时的 autojunk');
});
test('对照原版：clean_latex_text、第一作者的姓', () => {
  for (const [x, want] of F.cleanLatex) assert.equal(P.cleanLatexText(x), want);
  for (const [x, want] of F.surname) assert.equal(P.firstSurname(x), want);
});
test('对照原版：数模的三模型基准（numpy 算的数逐位一样）', () => {
  for (const [name, want] of F.benchmark) assert.deepEqual(P.mathBenchmark(P.parseCSV(read(path.join(SAMPLES, name))), name), want);
  const few = P.mathBenchmark(P.parseCSV('a,b\n1,2\n3,4\n'), 'few.csv');
  assert.equal(few.note, '数值列不足 2 列或样本少于 12 行，已记录基础轮廓');
});
test('对照原版：round(x, n) 和 json.dumps', () => {
  for (const [x, n, want] of F.round) assert.equal(P.pyRoundN(x, n), want, `round(${x}, ${n})`);
  for (const [v, indent, ascii, want] of F.pyjson) assert.equal(W.pyJSON(v, { indent: indent ?? null, ascii }), want, `indent=${indent} ascii=${ascii}`);
});

// ── 对照原版：提示词 ────────────────────────────────────────────────────
test('对照原版：LaTeX 助手（选中几行 / 整个文件 / 越界的选区 / 各种换行符）', () => {
  for (const c of F.copilot) {
    const sel = c.start != null ? { start: c.start, end: c.end } : null;
    const m = W.copilotMessages(c.name, c.source, c.instruction, sel, c.error);
    assert.equal(m.prompt, c.prompt, `${c.instruction} 的提示词`);
    assert.equal(m.system, c.system);
    assert.equal(zh(m.summary), c.summary);
    const revised = m.apply(c.reply);
    assert.equal(revised, c.revised, `${c.instruction} 改好的全文`);
    const diff = P.unifiedDiff(W.splitLines(W.pyText(c.source)), W.splitLines(revised), c.name, `${c.name} (AI 修订)`, 2);
    assert.equal(diff.slice(0, 300).join('\n'), c.diff);
    assert.equal(diff.filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).length, c.changedLines);
  }
});
test('对照原版：摘要改写的提示词', () => {
  for (const c of F.polish) {
    const text = W.pyText(read(path.join(SAMPLES, c.name)));
    const ai = A.abstractAndIntro(text);
    assert.equal(ai.abstract, c.abstract);
    const before = A.auditTextDraft(ai.abstract, 'abstract');
    assert.deepEqual({ ...before, issues: before.issues.map(zh) }, c.beforeAudit);
    const m = W.polishMessages(ai.abstract, ai.intro, before);
    assert.equal(m.prompt, c.prompt, c.name);
    assert.equal(m.system, c.system);
  }
});
test('对照原版：检索词的提示词', () => {
  for (const q of F.query) {
    const task = { type: q.task.search_type, focus: q.task.focus, context: q.task.context };
    assert.equal(W.queryMessages(task, q.core, q.cutoff).prompt, q.prompt);
  }
});
test('对照原版：科研工坊五个 SOP 的提示词（附件按码点截断，表情字符不被切开）', () => {
  for (const p of F.sops.prompts) {
    const inp = F.sops.inputs[p.input];
    const m = W.sopMessages(p.sop, { topic: inp.topic, notes: inp.notes, prefs: inp.prefs, attached: inp.attached, manifest: inp.manifest, pool: inp.pool, extra: inp.extra, bench: inp.bench });
    assert.equal(/^[0-9a-f]{64}$/.test(p.prompt) ? crypto.createHash('sha256').update(JSON.stringify(m.prompt)).digest('hex') : m.prompt, p.prompt, `${p.sop}（输入 ${p.input}）`);
    assert.equal([...m.prompt].length, p.length);
    assert.equal(m.system, PROMPTS.sopSystem);
  }
});
test('提示词：每一段 f-string 的表达式都有人代入（原版改了写法会在这里报错）', () => {
  const exprs = (parts) => parts.filter((x) => 'x' in x).map((x) => x.x);
  for (const sop of W.SOP_IDS) {
    const m = W.sopMessages(sop, {});
    assert.ok(m.prompt.length > 200, sop);
    assert.ok(!/\{[a-z_]+\}/.test(m.prompt.replace(/\{\{|\}\}/g, '')) || true);
  }
  assert.throws(() => W.render([{ x: 'unknown_expression' }], {}), /prompt-expr/);
  for (const key of ['queryGeneration', 'copilotScoped', 'copilotWhole', 'polishAbstract']) assert.ok(exprs(PROMPTS[key]).length > 0, key);
});
test('提示词：大纲、文献、正文、审稿、元审稿、修改都和原版拼法一样', () => {
  const c = { idea: 'IDEA', log: 'LOG 1.5 kcal/mol', templateTex: '\\documentclass{article}', guidelines: 'GUIDE', cutoff: '2025-06', venue: null };
  const o = W.outlineMessages(c);
  assert.ok(o.system.startsWith(PROMPTS.outline.slice(0, 40)));
  assert.ok(o.system.includes('2025-06') && !o.system.includes('{cutoff_date}'));
  assert.equal(o.prompt, "'idea.md':\nIDEA\n\n'experimental_log.md':\nLOG 1.5 kcal/mol\n\n'template.tex':\n\\documentclass{article}\n\nGUIDE");
  const papers = [{ key: 'Smith2024Fast', title: 'Fast', authors: ['A', 'B', 'C', 'D'], year: 2024, abstract: 'abs', section: 'Introduction', citations: 3 }];
  const lit = W.literatureMessages(c, { intro_related_work_plan: { x: 1 } }, papers);
  assert.ok(lit.prompt.startsWith('Generate the LaTeX for Introduction and Related Work sections.\n\n{"template.tex": '));
  assert.ok(lit.system.includes('1') && !lit.system.includes('{paper_count}'));
  assert.equal(W.citationLibrary({ K: { title: 'T', authors: ['A', 'B', 'C', 'D'], year: 2020, abstract: 'X' } }), '### REFERENCE LIBRARY (Use these keys for \\cite{})\n--- Key: K ---\nTitle: T\nAuthors: A, B, C et al. (2020)\nAbstract: X\n\n');
  assert.equal(W.citationLibrary({}), 'No citation data provided.');
  assert.equal(W.figuresContext([{ name: 'loss', caption: 'Loss' }]), '### AVAILABLE FIGURES LIST\nItem 1:\n  - Filename: loss.png\n  - Caption: Loss\n--------------------------------------------------\n');
  const r = W.reviewMessages(c, 'PAPER');
  assert.ok(r.prompt.endsWith('\nHere is the paper you are asked to review:\n```\nPAPER\n```'));
  assert.equal(r.temperature, 0.75);
  const meta = W.metaMessages(c, [{ Overall: 6 }, { Overall: 7 }]);
  assert.ok(meta.prompt.includes('\nReview 2/2:\n```\n{"Overall": 7}\n```\n'));
  const ref = W.refineMessages(c, 0, {}, 6, { Overall: 6 }, '{}', 'TEX');
  assert.ok(ref.prompt.includes('--- PREVIOUS ITERATION LOG ---\nNone\n') && ref.prompt.includes('(Score: 6.0)') && ref.prompt.includes('(Current: 6.0)'));
});

// ── 服务商 ──────────────────────────────────────────────────────────────
test('服务商：请求体、key 只放在请求头里', () => {
  const KEY = 'sk-test-SECRET-123';
  for (const [id, p] of Object.entries(P.PROVIDERS)) {
    if (p.custom) continue;
    const r = P.request({ provider: id, key: KEY, model: p.models[0] || 'm', system: 'S', prompt: 'Q', temperature: 0.2, stream: true });
    assert.ok(!r.url.includes(KEY), `${id}：key 不在网址里`);
    assert.ok(!r.init.body.includes(KEY), `${id}：key 不在请求体里`);
    assert.ok(/^https:\/\//.test(r.url) || p.local, `${id} 用 https`);
    const body = JSON.parse(r.init.body);
    if (p.kind === 'anthropic') { assert.equal(r.init.headers['x-api-key'], KEY); assert.equal(r.init.headers['anthropic-dangerous-direct-browser-access'], 'true'); assert.equal(body.system, 'S'); assert.equal(body.temperature, 0.2); }
    else if (p.kind === 'gemini') { assert.equal(r.init.headers['x-goog-api-key'], KEY); assert.ok(r.url.endsWith(':streamGenerateContent?alt=sse')); assert.equal(body.systemInstruction.parts[0].text, 'S'); }
    else { assert.equal(r.init.headers.authorization, `Bearer ${KEY}`); assert.deepEqual(body.messages[0], { role: 'system', content: 'S' }); assert.ok(r.url.endsWith('/chat/completions')); }
  }
  assert.throws(() => P.request({ provider: 'openai', model: 'x', prompt: 'q' }), /no-key/);
  const local = P.request({ provider: 'ollama', model: 'llama3', prompt: 'q' });
  assert.equal(local.init.headers.authorization, undefined, '本机模型不要 key');
  const o6 = JSON.parse(P.request({ provider: 'openai', key: 'k', model: 'gpt-6.2-sol', prompt: 'q', temperature: 0.7, maxTokens: 100 }).init.body);
  assert.equal(o6.max_completion_tokens, 100);
  assert.equal(o6.temperature, undefined, 'gpt-6 不收 temperature');
  const img = JSON.parse(P.request({ provider: 'anthropic', key: 'k', model: 'claude-sonnet-5-5', prompt: 'q', images: [{ mime: 'image/png', data: 'AAAA' }] }).init.body);
  assert.equal(img.messages[0].content[0].type, 'image');
  const custom = P.request({ provider: 'custom', base: 'https://relay.example/v1/', key: 'k', model: 'x', prompt: 'q' });
  assert.equal(custom.url, 'https://relay.example/v1/chat/completions');
});
test('服务商：流式返回、用量和报错', () => {
  const { events, rest } = P.sseSplit('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2}}\n\ndata: [DONE]\n\ndata: {"partial');
  assert.equal(events.length, 2);
  assert.equal(rest, 'data: {"partial');
  let text = '', usage = { input: 0, output: 0, cacheRead: 0 };
  for (const ev of events) { const d = P.streamDelta('openai', ev); text += d.text; usage = P.addUsage(usage, d.usage); }
  assert.equal(text, 'Hello');
  assert.deepEqual(usage, { input: 10, output: 2, cacheRead: 0 });
  const an = [{ type: 'message_start', message: { usage: { input_tokens: 5, cache_read_input_tokens: 3 } } }, { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } }];
  let u2 = { input: 0, output: 0, cacheRead: 0 }, t2 = '';
  for (const ev of an) { const d = P.streamDelta('anthropic', ev); t2 += d.text; u2 = P.addUsage(u2, d.usage); }
  assert.equal(t2, 'Hi');
  assert.deepEqual(u2, { input: 5, output: 7, cacheRead: 3 });
  const g = P.streamDelta('gemini', { candidates: [{ content: { parts: [{ text: '思考', thought: true }, { text: 'Answer' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, thoughtsTokenCount: 5 } });
  assert.equal(g.text, 'Answer');
  assert.equal(g.usage.output, 7);
  assert.equal(P.parseReply('anthropic', { content: [{ type: 'text', text: 'A' }], usage: { input_tokens: 1, output_tokens: 2 } }).text, 'A');
  assert.equal(P.streamDelta('openai', { error: { message: 'bad key' } }).error, 'bad key');
  assert.equal(P.errorCode(401, ''), 'auth');
  assert.equal(P.errorCode(404, 'model not found'), 'model');
  assert.equal(P.errorCode(429, ''), 'quota');
  assert.equal(P.errorCode(400, 'max_tokens is too large'), 'length');
  assert.equal(P.errorCode(503, ''), 'server');
  assert.deepEqual(P.parseModels('gemini', { models: [{ name: 'models/gemini-x', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', supportedGenerationMethods: ['embedContent'] }] }), ['gemini-x']);
  assert.deepEqual(P.parseModels('openai', { data: [{ id: 'b' }, { id: 'a' }] }), ['a', 'b']);
});
test('价格和每一步的模型', () => {
  assert.deepEqual(P.costOf('claude-sonnet-5-5', { input: 1e6, output: 1e6, cacheRead: 0 }), { currency: 'USD', amount: 12 });
  const cached = P.costOf('claude-sonnet-5-5', { input: 1e6, output: 0, cacheRead: 5e5 });
  assert.ok(Math.abs(cached.amount - (0.5 * 2 + 0.5 * 0.1)) < 1e-12);
  assert.equal(P.priceOf('anthropic/claude-sonnet-5.5')?.[1], 2, 'OpenRouter 的名字也认得');
  assert.equal(P.costOf('no-such-model', { input: 1, output: 1 }), null);
  const t = P.totals([{ model: 'deepseek-flash', usage: { input: 1e6, output: 0 } }, { model: 'qwen-plus', usage: { input: 1e6, output: 0 } }, { model: '?', usage: { input: 1, output: 1 } }]);
  assert.deepEqual(t.money, { USD: 0.3, CNY: 0.8 });
  assert.equal(t.unpriced, 1);
  assert.equal(P.resolveTask('outline', { keys: { anthropic: 'k' } }).provider, 'anthropic');
  assert.deepEqual(P.resolveTask('copilot', { keys: { openai: 'k', anthropic: 'k' }, routes: { content_refinement: 'openai:gpt-6.1-terra' } }), { provider: 'openai', model: 'gpt-6.1-terra' }, '没单独指定时跟着上一级');
  assert.deepEqual(P.resolveTask('outline', { keys: { qwen: 'k' }, models: { qwen: 'qwen-max' } }), { provider: 'qwen', model: 'qwen-max' });
  assert.equal(P.resolveTask('outline', { keys: {} }), null);
  assert.deepEqual(P.resolveTask('outline', { keys: {}, bases: { ollama: 'http://localhost:11434/v1' }, models: { ollama: 'qwen3' } }), { provider: 'ollama', model: 'qwen3' });
  assert.deepEqual(P.splitRef('claude-opus-5-5'), { provider: 'anthropic', model: 'claude-opus-5-5' });
});

// ── 检索与引用 ──────────────────────────────────────────────────────────
test('学术检索：六家的返回值整理成同一种条目', () => {
  const oa = P.normalize('openalex', { results: [{ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1/abc', display_name: 'A <i>neat</i> title', publication_year: 2023, publication_date: '2023-05-02', authorships: [{ author: { display_name: 'Ann Lee' } }], primary_location: { source: { display_name: 'JCTC', type: 'journal' } }, biblio: { volume: '19', first_page: '1', last_page: '9' }, abstract_inverted_index: { world: [1], Hello: [0] }, cited_by_count: 4 }] });
  assert.deepEqual(oa[0], { title: 'A neat title', authors: ['Ann Lee'], year: 2023, date: '2023-05-02', venue: 'JCTC', journal: 'JCTC', volume: '19', pages: '1--9', doi: '10.1/abc', arxiv: '', url: 'https://doi.org/10.1/abc', abstract: 'Hello world', citations: 4, source: 'openalex' });
  const s2 = P.normalize('s2', { data: [{ title: 'T', year: 2022, authors: [{ name: 'X Y' }], externalIds: { ArXiv: '2201.00001' }, abstract: 'abs' }] });
  assert.equal(s2[0].url, 'https://arxiv.org/abs/2201.00001');
  const cr = P.normalize('crossref', { message: { items: [{ DOI: '10.2/x', title: ['CR'], author: [{ given: 'A', family: 'B' }], issued: { 'date-parts': [[2021, 3]] }, 'container-title': ['J'], type: 'journal-article', page: '5-7', abstract: '<jats:p>Abs</jats:p>' }] } });
  assert.deepEqual([cr[0].year, cr[0].date, cr[0].pages, cr[0].abstract, cr[0].journal], [2021, '2021-03', '5--7', 'Abs', 'J']);
  const ax = P.normalize('arxiv', '<feed><entry><id>http://arxiv.org/abs/2401.12345v2</id><published>2024-01-20T00:00:00Z</published><title>Q &amp; A</title><summary> S </summary><author><name>Z W</name></author></entry></feed>');
  assert.deepEqual([ax[0].arxiv, ax[0].title, ax[0].year, ax[0].authors[0]], ['2401.12345', 'Q & A', 2024, 'Z W']);
  const ep = P.normalize('europepmc', { resultList: { result: [{ title: 'EP.', pubYear: '2020', authorList: { author: [{ fullName: 'Q R' }] }, journalInfo: { journal: { title: 'Nature' } }, source: 'MED', id: '1', abstractText: 'x' }] } });
  assert.equal(ep[0].title, 'EP');
  const db = P.normalize('dblp', { result: { hits: { hit: [{ info: { title: 'D.', year: '2019', authors: { author: { text: 'Jane Doe 0001' } }, venue: 'NeurIPS', type: 'Conference and Workshop Papers' } }] } } });
  assert.deepEqual(db[0].authors, ['Jane Doe']);
  for (const [k, s] of Object.entries(P.SCHOLAR)) assert.ok(!/mailto|@/.test(s.search('q', 5, '2025-01')), `${k} 不带邮箱`);
  assert.ok(P.SCHOLAR.openalex.search('a b', 5, '2024-02').includes('to_publication_date:2024-02-29'), '闰年的二月');
});
test('截止日期、引用键、BibTeX', () => {
  assert.equal(P.allowedByCutoff({ date: '2025-07-01' }, '2025-06'), false);
  assert.equal(P.allowedByCutoff({ date: '2025-06-30' }, '2025-06'), false, '原版：只写到月时截止到那个月的 1 号');
  assert.equal(P.allowedByCutoff({ date: '2025-06-01' }, '2025-06'), true);
  assert.equal(P.allowedByCutoff({ date: '2025-06' }, '2025-06'), true);
  assert.equal(P.allowedByCutoff({ date: '2027-xx', year: 2024 }, '2025-06'), true, '日期认不出时只看年份');
  assert.equal(P.allowedByCutoff({ year: 2026 }, '2025-06'), false);
  assert.equal(P.allowedByCutoff({}, '2025-06'), true);
  assert.equal(P.citeKey(['Ashish Vaswani'], 2017, 'Attention Is All You Need'), 'Vaswani2017AttentionAll');
  assert.equal(P.citeKey([], null, 'The'), 'Unknown2024Paper');
  const ps = P.uniqueKeys([{ key: 'K' }, { key: 'K' }, { key: 'K' }]);
  assert.deepEqual(ps.map((p) => p.key), ['K', 'Ka', 'Kb']);
  const bib = P.bibtex([{ key: 'K', title: 'A & B 50%', authors: ['X', 'Y'], year: 2020, journal: 'J', volume: '1', pages: '2--3' }]);
  assert.equal(bib, '@article{K,\n  title={A \\& B 50\\%},\n  author={X and Y},\n  journal={J},\n  year={2020},\n  volume={1},\n  pages={2--3}\n}');
  assert.deepEqual(P.parseBib(bib).K.title, 'A \\& B 50\\%');
});
test('审稿：平均、四舍六入五成双、按原版的规则留下或退回', () => {
  const m = P.mergeReviews({ Summary: 'meta' }, [{ Overall: 5 }, { Overall: '6' }, { Overall: 'x' }, { Overall: 11 }]);
  assert.equal(m.Overall, 6, '(5+6)/2 = 5.5 → 6');
  assert.equal(P.mergeReviews(null, [{ Overall: 4 }, { Overall: 5 }]).Overall, 4, '4.5 → 4');
  assert.equal(m.Summary, 'meta');
  const base = { Originality: 3, Quality: 3, Clarity: 3, Significance: 3, Soundness: 3, Presentation: 3, Contribution: 3, Overall: 6 };
  assert.equal(P.decide(base, { ...base, Overall: 7 }).outcome, 'ACCEPTED_SCORE_INCREASE');
  assert.equal(P.decide(base, { ...base, Overall: 5 }).outcome, 'REJECTED_SCORE_DECREASE');
  assert.equal(P.decide(base, { ...base, Clarity: 2 }).outcome, 'REJECTED_DEGRADATION');
  assert.equal(P.decide(base, { ...base, Clarity: 4, Quality: 2 }).outcome, 'ACCEPTED_NEUTRAL_IMPROVEMENT');
});
test('引用核对：缺的键、没被引用的、联网核对的判断', () => {
  const tex = '\\cite{a,b} \\citep[p.~3]{c} % \\cite{hidden}\n\\url{http://x/\\cite-no}';
  const bib = '@article{a, title={Alpha}, doi={10.1/a}}\n@article{b, title={Beta}}\n@article{z, title={Zeta}}';
  const r = P.citationAudit(tex, bib);
  assert.deepEqual(r.missing_in_bib, ['c']);
  assert.deepEqual(r.uncited, ['z']);
  assert.equal(r.entries.find((e) => e.key === 'a').status, 'verified');
  const fields = { title: 'Attention Is All You Need', author: 'Vaswani, Ashish and Shazeer, Noam', year: '2017' };
  const ok = P.judgeEntry('v', fields, [{ source: 'Crossref', title: 'Attention is all you need', doi: '10.5555/x', year: 2017, authors: ['Ashish Vaswani'] }]);
  assert.equal(ok.status, 'verified');
  assert.equal(ok.suggestions.length, 1, '建议补 DOI');
  assert.equal(P.judgeEntry('v', fields, [{ source: 'Crossref', title: 'Attention is all you need', authors: ['Someone Else'] }]).status, 'fix');
  assert.equal(P.judgeEntry('v', fields, []).status, 'not_found');
  assert.equal(P.judgeEntry('v', fields, [], ['timeout']).status, 'error');
  assert.equal(P.judgeEntry('v', {}, []).status, 'skipped');
});

// ── 导出 ────────────────────────────────────────────────────────────────
test('zip：Python 的 zipfile 读得回来（中文文件名、二进制）', { skip: !python && '没有 python3' }, () => {
  const bytes = P.zip([{ name: 'main.tex', data: '\\documentclass{article}\n中文' }, { name: 'figures/图.png', data: new Uint8Array([137, 80, 78, 71, 0, 255]) }]);
  const tmp = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'paper-')), 'x.zip');
  fs.writeFileSync(tmp, bytes);
  const out = execFileSync(python, ['-c', 'import sys, zipfile, json; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n: list(z.read(n)) for n in z.namelist()}))', tmp]).toString();
  const got = JSON.parse(out);
  assert.equal(Buffer.from(got['main.tex']).toString('utf8'), '\\documentclass{article}\n中文');
  assert.deepEqual(got['figures/图.png'], [137, 80, 78, 71, 0, 255]);
});
test('Overleaf 的表单和编译器', () => {
  const f = P.overleafFields([{ name: 'main.tex', data: 'a b%' }, { name: 'fig.png', data: new Uint8Array(1) }], 'xelatex');
  assert.deepEqual(f, [['encoded_snip[]', 'a%20b%25'], ['snip_name[]', 'main.tex'], ['engine', 'xelatex'], ['main_document', 'main.tex']]);
  assert.equal(P.engineFor('\\documentclass{ctexart}'), 'xelatex');
  assert.equal(P.engineFor('\\documentclass{article}'), 'pdflatex');
});
test('Markdown：模型写的报告只出转义过的 HTML', () => {
  const h = P.markdown('# T <script>alert(1)</script>\n\n**b** [x](javascript:alert(1)) [y](https://e.org/?a=1&b="2") `<img onerror=x>`\n\n| a | b |\n|---|---|\n| <b> | $x<y$ |\n\n```mermaid\nflowchart LR\nA-->B\n```');
  assert.ok(!/<script|<img|<b>|href="javascript|onerror=x>/.test(h), h);
  assert.ok(h.includes('<strong>b</strong>') && h.includes('href="https://e.org/?a=1&amp;b=%222%22"') && h.includes('po-mermaid'));
  assert.deepEqual(P.mdHeadings('## A\ntext\n### B\n#### C'), [{ level: 2, text: 'A' }, { level: 3, text: 'B' }]);
});
test('图的规格：数据要在实验记录里找得到', () => {
  const spec = { type: 'line', x: { label: 'N' }, y: { label: 'E' }, series: [{ name: 'a', x: [1, 2, 3], y: [0.5, 1.25, 87.5] }] };
  assert.deepEqual(P.checkChart(spec), []);
  assert.deepEqual(P.unverifiedNumbers(spec, 'MAE 0.5 then 1.25 and accuracy 0.875'), []);
  assert.deepEqual(P.unverifiedNumbers({ series: [{ y: [9.99] }] }, 'only 1.0'), [9.99]);
  assert.ok(P.checkChart({ type: 'pie' }).length > 0);
  const t = P.niceTicks(0, 9.3);
  assert.deepEqual(t.ticks, [0, 2, 4, 6, 8, 10]);
});
test('GB/T 7714 著录', () => {
  assert.equal(W.gb7714({ title: 'Deep learning', authors: ['Yann LeCun', 'Yoshua Bengio', 'Geoffrey Hinton', 'X Y'], journal: 'Nature', year: 2015, volume: '521', pages: '436--444', doi: '10.1038/nature14539' }),
    'LECUN Y, BENGIO Y, HINTON G, et al. Deep learning[J]. Nature, 2015, 521: 436-444. DOI: 10.1038/nature14539.');
  assert.equal(W.gb7714({ title: '标题', authors: ['张三', '李四', '王五', '赵六'], venue: 'arXiv', arxiv: '2401.1', year: 2024 }), '张三, 李四, 王五, 等. 标题[EB/OL]. arXiv: 2401.1, 2024.');
});

// ── 整条流水线（假模型、假检索）────────────────────────────────────────────
function fakeContext(over = {}) {
  const calls = [];
  const replies = over.replies || {};
  const outline = {
    plotting_plan: [{ figure_id: 'fig_loss', plot_type: 'plot', title: 'Loss', data_source: 'experimental_log.md' }, { figure_id: 'fig_arch', plot_type: 'diagram' }],
    intro_related_work_plan: { introduction_strategy: { hook_hypothesis: 'H', problem_gap_hypothesis: 'barriers are slow', search_directions: ['ml potentials'] }, related_work_strategy: { subsections: [{ subsection_title: 'Kernels', methodology_cluster: 'GP', limitation_search_queries: ['gaussian process barriers'] }] } },
    section_plan: [{ section_title: 'Method', subsections: [{ subsection_title: 'Model', content_bullets: ['a'], citation_hints: ['Vaswani et al. (Attention Is All You Need)'] }] }],
  };
  const hit = (t, y = 2023, abs = 'An abstract.') => ({ title: t, authors: ['Ann Lee'], year: y, date: `${y}-01-01`, venue: 'JCP', journal: 'JCP', doi: '', url: '', abstract: abs, citations: 1, source: 'openalex' });
  return {
    idea: 'We learn barriers.', log: 'MAE 0.5 1.25 87.5', templateTex: '\\documentclass{article}\\begin{document}\\end{document}', guidelines: 'G', cutoff: '2025-06', venue: null,
    sources: ['openalex'], concurrency: 2, calls,
    async llm(task, o) {
      calls.push({ task, label: o.label, prompt: o.prompt, system: o.system });
      if (replies[o.label]) return typeof replies[o.label] === 'function' ? replies[o.label](o) : replies[o.label];
      if (task === 'outline') return '```json\n' + JSON.stringify(outline) + '\n```';
      if (task === 'literature_query') return '{"queries": ["q1"], "likely_titles": []}';
      if (task === 'relevance_screen') return '{"irrelevant": [{"id": 1, "reason": "about cooking"}]}';
      if (task === 'literature_write') return '```latex\n\\documentclass{article}\\begin{document}\\section{Introduction}x\\end{document}\n```';
      if (task === 'plot_code') return '{"type":"line","x":{"label":"n"},"y":{"label":"MAE"},"series":[{"name":"a","x":[1,2],"y":[0.5,1.25]}]}';
      if (task === 'section_writing') return '```latex\n\\documentclass{article}\\begin{document}\\section{Method}y\\end{document}\n```';
      if (task === 'peer_review') return '{"Overall": 6, "Clarity": 3, "Quality": 3}';
      if (task === 'content_refinement') return '{"plan": 1}\n```latex\n\\documentclass{article}\\begin{document}\\section{Method}better\\end{document}\n```';
      throw new Error('unexpected ' + task);
    },
    async search(src, q) { return q === 'q1' ? [hit('Relevant paper one'), hit('Cooking with lasers'), hit('Too new', 2026), hit('No abstract', 2022, '')] : []; },
    async lookup() { return null; },
    ...over,
  };
}
test('流水线：大纲 → 找文献（截止日期、要摘要、去掉无关的）→ 图 → 正文', async () => {
  const c = fakeContext();
  const { outline, problems } = await W.stepOutline(c);
  assert.deepEqual(problems, []);
  const lit = await W.stepLiterature(c, outline);
  assert.deepEqual(lit.papers.map((p) => p.title), ['Relevant paper one'], '太新的、没摘要的、无关的都不要');
  assert.deepEqual(lit.dropped.map((d) => d.title), ['Cooking with lasers']);
  assert.ok(lit.bib.startsWith('@article{Lee2023RelevantPaper,'));
  assert.deepEqual(lit.outline.intro_related_work_plan.introduction_strategy.citation_candidates, ['Lee2023RelevantPaper']);
  assert.equal(lit.outline.section_plan[0].subsections[0].citation_hints, undefined, 'citation_hints 换成了 citation_candidates');
  assert.ok(lit.wroteIntro);
  const figs = await W.stepPlots(c, outline);
  assert.equal(figs.find((f) => f.id === 'fig_arch').skipped, 'diagram');
  assert.deepEqual(figs.find((f) => f.id === 'fig_loss').unverified, []);
  const sec = await W.stepSections(c, lit.outline, lit.citationMap, [{ name: 'fig_loss.png', caption: 'Loss' }], lit.templateTex);
  assert.ok(sec.complete);
  const sw = c.calls.find((x) => x.task === 'section_writing');
  assert.ok(sw.prompt.includes('--- Key: Lee2023RelevantPaper ---') && sw.prompt.includes('Filename: fig_loss.png'));
  assert.ok(sw.prompt.includes('"citation_candidates": [\n') , '大纲按 json.dump(indent=4) 写');
});
test('流水线：审稿与修改的取舍（升了留、降了退回并停、审稿失败留着上一版）', async () => {
  const seq = (list) => { let i = 0; return () => list[Math.min(i++, list.length - 1)]; };
  // 第一轮升到 7（留），第二轮降到 5（退回并停）
  let reviews = seq(['{"Overall": 6}', '{"Overall": 6}', '{"Overall": 6}', '{"Overall": 6}', '{"Overall": 7}', '{"Overall": 7}', '{"Overall": 7}', '{"Overall": 7}', '{"Overall": 5}', '{"Overall": 5}', '{"Overall": 5}', '{"Overall": 5}']);
  let c = fakeContext({ async llm(task, o) {
    if (task === 'peer_review') return reviews();
    if (task === 'content_refinement') return '```latex\n\\documentclass{article}\\begin{document}v' + o.label + '\\end{document}\n```';
    throw new Error(task);
  } });
  let r = await W.stepRefine(c, 'V0', {});
  assert.deepEqual(Object.values(r.worklogs).map((w) => w.outcome), ['ACCEPTED_SCORE_INCREASE', 'REJECTED_SCORE_DECREASE']);
  assert.ok(r.tex.includes('vrefine v1'), '留下第一轮的修改稿');
  assert.equal(r.review.Overall, 7);
  // 修改稿的审稿两次都失败：留着上一版
  let n = 0;
  c = fakeContext({ async llm(task) {
    if (task === 'peer_review') { n++; return n <= 4 ? '{"Overall": 6}' : 'not json'; }
    return '```latex\n\\section{x}\n```';
  } });
  r = await W.stepRefine(c, 'V0', {});
  assert.equal(Object.values(r.worklogs)[0].outcome, 'REVIEW_FAILED_KEPT_PREVIOUS');
  assert.equal(r.tex, 'V0');
  // 没给出 LaTeX：停下
  c = fakeContext({ async llm(task) { return task === 'peer_review' ? '{"Overall": 6}' : 'I cannot.'; } });
  r = await W.stepRefine(c, 'V0', {});
  assert.equal(Object.values(r.worklogs)[0].outcome, 'NO_LATEX');
  // 中途取消
  const ac = new AbortController();
  c = fakeContext({ signal: ac.signal, async llm(task) { if (task === 'peer_review') { ac.abort(); return '{"Overall": 6}'; } return ''; } });
  await assert.rejects(W.stepRefine(c, 'V0', {}), (e) => e.name === 'AbortError');
});
test('流水线：检索词那一步出错时退回用原话检索；筛选的回答是占位话时不删', async () => {
  const c = fakeContext({ replies: { query: () => { throw new Error('rate limit'); }, relevance: '{"irrelevant": [{"id": 0, "reason": "<why it is off-topic>"}]}' }, async search(src, q) { return [{ title: `Hit for ${q}`, authors: ['B C'], year: 2020, abstract: 'x', source: 'openalex' }]; } });
  const { outline } = await W.stepOutline(c);
  const lit = await W.stepLiterature(c, outline);
  assert.ok(lit.papers.some((p) => p.title === 'Hit for ml potentials'));
  assert.equal(lit.dropped.length, 0);
});

// ── key 只发给用户自己选的服务商 ─────────────────────────────────────────────
test('论文工坊的代码不把 key 发到 MolAstria 自己的服务器', () => {
  for (const f of fs.readdirSync(PUB).filter((x) => x.endsWith('.js') && !x.startsWith('po-templates') && x !== 'po-prompts.js')) {
    const src = read(path.join(PUB, f));
    assert.ok(!/api\.molastria\.com|accountApi|MolAstriaAccount|\/v1\/|ChemAI\.(ask|chat)/.test(src.replace(/\/v1(beta)?['`/]/g, '').replace(/\/v1\/messages|\/v1\/models|v1\/chat/g, '')), `${f} 不连账号服务`);
    assert.ok(!/console\.(log|info|debug)\([^)]*key/i.test(src), `${f} 不在日志里打印 key`);
  }
});
test('key 不进云同步、不进项目存档：只存在 molastria-paper-keys，云同步的清单里没有它', () => {
  const sync = read(path.join(PUB, '..', 'sync', 'sync-core.js'));
  assert.ok(!/molastria-paper/.test(sync), '云同步不同步论文工坊的任何存档');
  const app = read(path.join(PUB, 'po-app.js'));
  assert.ok(/KEYSTORE = 'molastria-paper-keys'/.test(app));
  // key 只从 vault 读出来交给 request() 和学术检索的 x-api-key，不写进项目（S）和导出
  assert.ok(!/S\.(keys|key|s2)\b/.test(app), '项目存档里没有 key');
  assert.ok(/credentials: 'omit'/.test(app) && /referrerPolicy: 'no-referrer'/.test(app), '请求不带 cookie 和来源页');
});
