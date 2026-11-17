// 化学机器学习（/chem-ml/）：把 tools/chemml/ 的源文件拼成页面读的两份内容 public/chem-ml/cml-zh.js 和 cml-en.js。
//   node tools/chemml-build.mjs           （第一次要联网，用 npx 取 katex@0.16.11，把公式转成 MathML）
//   node tools/chemml-build.mjs --check   只检查生成的文件是不是最新的（不需要 katex，tools/chemml-test.mjs 也做这一步）
// 源文件：tools/chemml/index.mjs（封面、时间线、自测、书目、开放问题）、tools/chemml/ch/*.mjs（十章，每段 [中文, English]）、
// tools/chemml/refs.json（文献，tools/chemml-refs.mjs 在 OpenAlex / arXiv 重查）。演示的定义在 public/chem-ml/cml-demos.js，这里只核对章里提到的演示都在。
// 文字标记：[@id, id] 引用 · $tex$ 行内公式 · {{ch:id}} 章节链接 · **粗体** · *斜体* · [[站内地址|文字]]（从站点根写起）或 [[https://…|文字]]。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/chemml'), OUT = path.join(ROOT, 'public/chem-ml');
const KATEX = 'katex@0.16.11';

// 输入的指纹：生成的文件开头记着它，--check 和测试据此判断是不是最新的
export function inputHash() {
  const files = ['index.mjs', 'refs.json', ...fs.readdirSync(path.join(SRC, 'ch')).filter((f) => f.endsWith('.mjs')).sort().map((f) => `ch/${f}`)];
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(`${f}\n`).update(fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n/g, '\n'));
  h.update(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
  return h.digest('hex').slice(0, 16);
}
export const outFile = (lang) => path.join(OUT, `cml-${lang}.js`);
export const stamp = (file) => (fs.existsSync(file) ? (fs.readFileSync(file, 'utf8').match(/inputs ([0-9a-f]{16})/) || [])[1] : '');

function findKatex() {
  if (process.env.KATEX_DIR) return createRequire(path.join(process.env.KATEX_DIR, 'x.js'))('katex');
  try { return createRequire(path.join(ROOT, 'tools/e2e/x.js'))('katex'); } catch { /* 往下试 npx */ }
  // npx 把 katex 装进自己的缓存，再从它放进 PATH 的 .bin 目录找回包的位置
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(`${npx} -y -p ${KATEX} -c "node -e \\"console.log(process.env.PATH)\\""`, { encoding: 'utf8', shell: true });
  for (const dir of (r.stdout || '').trim().split(path.delimiter)) {
    if (dir.endsWith(`node_modules${path.sep}.bin`) && fs.existsSync(path.join(dir, '..', 'katex', 'package.json'))) return createRequire(path.join(dir, '..', 'x.js'))('katex');
  }
  throw new Error(`找不到 katex：联网后再试，或者设 KATEX_DIR 指向装了 ${KATEX} 的目录`);
}

async function build() {
  const katex = findKatex();
  if (katex.version !== KATEX.split('@')[1]) console.warn(`注意：用的是 katex ${katex.version}，不是 ${KATEX}`);
  const problems = [];
  const bad = (m) => problems.push(m);
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mathml = (tex, display) => {
    try {
      const h = katex.renderToString(tex, { output: 'mathml', displayMode: !!display, throwOnError: true, strict: false });
      return h.replace(/^<span class="katex">/, '').replace(/<\/span>$/, '').replace(/<annotation encoding="application\/x-tex">[\s\S]*?<\/annotation>/, '');
    } catch (e) { bad(`KaTeX: ${tex} → ${e.message}`); return esc(tex); }
  };
  const imp = async (f) => (await import(`${pathToFileURL(path.join(SRC, f)).href}?t=${Date.now()}`)).default;

  // 文献
  const REFS = JSON.parse(fs.readFileSync(path.join(SRC, 'refs.json'), 'utf8'));
  const refs = Object.fromEntries(REFS.map((r) => [r.id, r]));
  for (const r of REFS) if (!r.title || !r.authors || !r.year || !r.short || !(r.doi || r.arxiv || r.url)) bad(`文献 ${r.id} 不完整`);

  // 章节
  const INDEX = await imp('index.mjs');
  const CH = [];
  for (const f of fs.readdirSync(path.join(SRC, 'ch')).filter((x) => x.endsWith('.mjs')).sort()) CH.push(await imp(`ch/${f}`));
  const chapterIndex = {};
  CH.forEach((c, i) => { c.n = String(i + 1).padStart(2, '0'); chapterIndex[c.id] = c; });

  // 演示：章里提到的都要在 cml-demos.js 里登记过
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(OUT, 'cml-models.js'), 'utf8') + '\n' + fs.readFileSync(path.join(OUT, 'cml-demos.js'), 'utf8'), sandbox);
  const DEMOS = {};
  const K = new Proxy({}, { get: (_, k) => (k === 'L' ? (zh) => zh : k === 'en' ? false : () => '') });
  sandbox.window.MOLASTRIA_CHEMML_DEMOS(K, DEMOS);

  let curChapter = '', used = {};
  const cite = (id) => {
    if (!refs[id]) { bad(`没有这篇文献 [@${id}]（${curChapter || '封面'}）`); return ''; }
    (used[id] ||= new Set()).add(curChapter || '');
    return `<a href="#ref-${id}" data-ref="${id}">${esc(refs[id].short)}</a>`;
  };
  function rich(s, lang) {
    if (s === undefined || s === null) return '';
    if (Array.isArray(s)) s = s[lang === 'en' ? 1 : 0];
    if (typeof s !== 'string') { bad(`不是文字（${curChapter}）：${String(JSON.stringify(s)).slice(0, 80)}`); return ''; }
    const keep = [];
    const hold = (h) => { keep.push(h); return `@@K${keep.length - 1}@@`; };
    s = s.replace(/\\`/g, '`').replace(/`([^`]+)`/g, (_, code) => hold(`<code>${esc(code)}</code>`));
    s = s.replace(/\$([^$]+)\$/g, (_, tex) => hold(mathml(tex)));
    s = esc(s)
      .replace(/\[@([\w-]+(?:\s*,\s*[\w-]+)*)\]/g, (_, list) => `<span class="chm-cites">[${list.split(',').map((x) => cite(x.trim())).filter(Boolean).join('; ')}]</span>`)
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, p, t) => {
        if (/^https?:/.test(p)) return `<a href="${p}" target="_blank" rel="noopener noreferrer">${t}</a>`;
        const file = path.join(ROOT, 'public', p.replace(/#.*$/, ''), p.replace(/#.*$/, '').endsWith('/') ? 'index.html' : '');
        if (!fs.existsSync(file)) bad(`站内链接不存在：${p}`);
        return `<a href="../${p}">${t}</a>`;
      })
      .replace(/\{\{ch:([\w-]+)\}\}/g, (_, id) => { const c = chapterIndex[id]; if (!c) { bad(`没有这一章 {{ch:${id}}}（${curChapter}）`); return ''; } return `<a href="#c-${id}" data-open="${id}">${c.n} · ${esc(c.title[lang === 'en' ? 1 : 0])}</a>`; })
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*\s][^*]*)\*/g, '<i>$1</i>');
    return s.replace(/@@K(\d+)@@/g, (_, i) => keep[Number(i)]);
  }

  function chapter(c, lang) {
    const r = (s) => rich(s, lang);
    curChapter = c.id;
    const block = (b) => {
      if (typeof b === 'string' || Array.isArray(b)) return { p: r(b) };
      if (b.h) return { h: r(b.h) };
      if (b.list) return { list: b.list.map(r) };
      if (b.steps) return { steps: b.steps.map(r) };
      if (b.quote) return { quote: r(b.quote), by: b.by ? r(b.by) : '' };
      if (b.note) return { note: r(b.note), kind: b.kind || 'info' };
      if (b.table) return { table: { head: b.table.head.map(r), rows: b.table.rows.map((row) => row.map(r)), cap: b.table.cap ? r(b.table.cap) : '' } };
      if (b.math) return { math: mathml(b.math, true), cap: b.cap ? r(b.cap) : '' };
      if (b.demo) { if (!DEMOS[b.demo]) bad(`第 ${c.id} 章：没有演示 ${b.demo}`); return { demo: b.demo }; }
      bad(`第 ${c.id} 章：不认识的块 ${JSON.stringify(b).slice(0, 60)}`); return { p: '' };
    };
    const out = { id: c.id, body: c.body.map(block) };
    if (c.points) out.points = c.points.map(([h, p, st]) => { if (st && !INDEX.levels[st]) bad(`第 ${c.id} 章：没有这种身份 ${st}`); return { h: r(h), p: r(p), st: st || '' }; });
    if (c.math) out.math = c.math.map(([tex, cap]) => ({ m: mathml(tex, true), cap: cap ? r(cap) : '' }));
    if (c.example) out.example = { q: r(c.example.q), steps: c.example.steps.map(r), a: r(c.example.a) };
    for (const id of c.refs || []) cite(id);
    const mine = Object.keys(used).filter((id) => used[id].has(c.id)).sort((a, b) => refs[a].year - refs[b].year || a.localeCompare(b));
    out.cites = mine.map((id) => `<a href="#ref-${id}" data-ref="${id}">${esc(refs[id].short)}</a>`).join(' · ');
    for (const d of c.demos || []) if (!DEMOS[d]) bad(`第 ${c.id} 章：没有演示 ${d}`);
    if (!INDEX.levels[c.level]) bad(`第 ${c.id} 章：没有这种身份 ${c.level}`);
    curChapter = '';
    return out;
  }

  const hash = inputHash(), files = {};
  for (const lang of ['zh', 'en']) {
    const r = (s) => rich(s, lang), k = lang === 'en' ? 1 : 0;
    used = {};
    const chapters = {};
    for (const c of CH) chapters[c.id] = chapter(c, lang);
    curChapter = '';
    const pairObj = (o) => Object.fromEntries(Object.entries(o).map(([key, v]) => [key, [v[0][k], v[1][k]]]));
    const index = {
      title: INDEX.title[k], sub: INDEX.sub[k], eyebrow: INDEX.eyebrow,
      h1: lang === 'en' ? esc(INDEX.title[1]) : `${esc(INDEX.title[0])}<span class="fs-h1-en" lang="en">${esc(INDEX.title[1])}</span>`,
      question: r(INDEX.question), lead: r(INDEX.lead), scope: r(INDEX.scope), levels: pairObj(INDEX.levels), demoKinds: pairObj(INDEX.demoKinds),
      groups: INDEX.groups.length > 1 ? INDEX.groups.map((g) => ({ title: g.title[k], ids: g.ids })) : [],
      chapters: CH.map((c) => ({ id: c.id, n: c.n, title: esc(c.title[k]), summary: r(c.summary), level: c.level, demos: c.demos || [] })),
      milestones: INDEX.milestones.map((m) => ({ year: m.year, text: r(m.text) })),
      quiz: INDEX.quiz.map((q) => ({ q: r(q.q), opts: q.opts.map(r), a: q.a, why: r(q.why), ch: q.ch })),
      books: INDEX.books.map((b) => ({ title: b.title, authors: b.authors, note: r(b.note) })),
      open: INDEX.open.map((o) => ({ q: r(o.q), ch: o.ch })),
    };
    const list = REFS.filter((x) => used[x.id]).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
    index.notes = { map: r(INDEX.notes.map), history: r(INDEX.notes.history), path: r(INDEX.notes.path), library: r(INDEX.notes.library).replace('{n}', String(list.length)) };
    for (const id of Object.keys(DEMOS)) if (!INDEX.demoKinds[DEMOS[id].kind || 'model']) bad(`演示 ${id} 的类别 ${DEMOS[id].kind} 没有说明`);
    for (const q of INDEX.quiz) { if (q.ch && !chapterIndex[q.ch]) bad(`自测：没有这一章 ${q.ch}`); if (!(q.a >= 0 && q.a < q.opts.length)) bad(`自测：答案越界 ${q.q[0]}`); }
    for (const o of INDEX.open) if (o.ch && !chapterIndex[o.ch]) bad(`开放问题：没有这一章 ${o.ch}`);
    for (const g of INDEX.groups) for (const id of g.ids) if (!chapterIndex[id]) bad(`分组：没有这一章 ${id}`);
    const refsOut = list.map((x) => ({ id: x.id, authors: x.authors, year: x.year, title: x.title, journal: x.journal, vol: x.vol, pages: x.pages, doi: x.doi, arxiv: x.arxiv, url: x.url, note: x.note ? x.note[k] : '', used: CH.filter((c) => used[x.id].has(c.id)).map((c) => c.id) }));
    if (lang === 'zh') { const unused = REFS.filter((x) => !used[x.id]).map((x) => x.id); if (unused.length) bad(`没有被引用的文献：${unused.join(' ')}`); }
    const data = { index, refs: refsOut, chapters };
    // 英文版里不能有汉字
    if (lang === 'en') { const t = JSON.stringify(data), m = /[㐀-鿿]/.exec(t); if (m) bad(`英文版里有汉字：…${t.slice(Math.max(0, m.index - 40), m.index + 20)}…`); }
    files[lang] = `/* 生成的文件，不要手改：node tools/chemml-build.mjs 从 tools/chemml/ 生成（inputs ${hash}，公式由 ${KATEX} 转成 MathML）。 */\nwindow.MOLASTRIA_CHEMML = ${JSON.stringify(data)};\n`;
  }
  if (problems.length) { console.error(`${problems.length} 个问题：\n${[...new Set(problems)].map((p) => ` - ${p}`).join('\n')}`); process.exitCode = 1; return; }
  for (const lang of ['zh', 'en']) fs.writeFileSync(outFile(lang), files[lang]);
  console.log(`${CH.length} 章 · ${Object.keys(DEMOS).length} 个演示 · ${REFS.length} 篇文献 · zh ${(files.zh.length / 1024).toFixed(0)} KB · en ${(files.en.length / 1024).toFixed(0)} KB · inputs ${hash}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const h = inputHash(), stale = ['zh', 'en'].filter((l) => stamp(outFile(l)) !== h);
    if (stale.length) { console.error(`public/chem-ml/cml-${stale.join('/')}.js 不是最新的：运行 node tools/chemml-build.mjs`); process.exitCode = 1; } else console.log('public/chem-ml/cml-zh.js 和 cml-en.js 是最新的');
  } else await build();
}
