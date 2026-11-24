/* 论文工坊的投稿体检（po-audit.js）：没有 DOM，tools/paper-test.mjs 测（中文的结论逐字对照 Python 原版跑出的结果）。
   照 PaperOrchestra Studio（Apache-2.0）的 tools/submission_tools.py 和 tools/latex_copilot.py 移植：
   · 注释：comment_start / strip_comments / code_lines（\verb、\url、verbatim、comment 环境里的 % 不算）；
   · \input / \include 合并；
   · 六项稿件体检（字数、AI 写作痕迹和标点节奏、图表引用和图注、草稿标记、统计报告、期刊声明）；
     AI 节奏的几条规则改编自 Best-Paper-Writing-Skill（CC BY 4.0）；
   · 双盲检查（照 Lattice 的 submission_review.rs，Apache-2.0）；
   · 编译日志诊断（照 Lattice 的 build_log.rs）；
   · arXiv 打包（浏览器里不能编译：删注释、合并输入、查图和 .bbl）；
   · 摘要的七个要素（不调用模型）和摘要 / 引言的文风体检 audit_text_draft。
   每一行结论是 { id, state: ok | warn | fail, label: [中, 英], detail: [中, 英], items: [[中, 英], …] }。 */
(function (root) {
  'use strict';
  const L2 = (zh, en) => [zh, en == null ? zh : en];
  const row = (id, state, label, detail = L2(''), items = []) => ({ id, state, label, detail, items });
  // Python 的 str.splitlines：\r\n、\r、\n 以外，\v \f \x1c–\x1e \x85 \u2028 \u2029 也算换行；空串没有行，结尾的换行不多出一行。
  const LB = '\\n\\r\\v\\f\\x1c\\x1d\\x1e\\x85\\u2028\\u2029';
  const LINES_KEEP = new RegExp(`[^${LB}]*(?:\\r\\n|[${LB}])|[^${LB}]+$`, 'g'), LINE_END = new RegExp(`(?:\\r\\n|[${LB}])$`);
  const splitKeep = (s) => String(s ?? '').match(LINES_KEEP) || [];
  const splitLines = (s) => splitKeep(s).map((l) => l.replace(LINE_END, ''));
  /** Python 的 s[:n]：按码点截。 */
  const cut = (s, n) => { const t = String(s ?? ''); return t.length <= n ? t : Array.from(t).slice(0, n).join(''); };
  const words = (s) => String(s ?? '').split(/\s+/).filter(Boolean);
  const isAlphaAscii = (c) => /[A-Za-z]/.test(c);
  const pyFloat = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
  const pct0 = (v) => `${(v * 100).toFixed(0)}%`;
  const round = (v, n) => Number(v.toFixed(n));
  const pyList = (a) => `[${a.join(', ')}]`;

  // ── 注释 ──────────────────────────────────────────────────────────────
  const VERBATIM_ENVS = ['verbatim', 'verbatim*', 'Verbatim', 'Verbatim*', 'BVerbatim', 'LVerbatim', 'lstlisting', 'minted', 'alltt', 'filecontents', 'filecontents*'];
  const VERBATIM_ARG_CMDS = new Set(['url', 'href', 'path']);
  const todoTest = (s) => /\btodo\b|\bfixme\b/i.test(s) || /\bXXX\b/.test(s);

  function verbatimArgEnd(line, bs) {
    const n = line.length;
    let j = bs + 1;
    while (j < n && isAlphaAscii(line[j])) j++;
    const name = line.slice(bs + 1, j);
    if (name === 'verb') {
      const k = j < n && line[j] === '*' ? j + 1 : j;
      if (k >= n) return null;
      const close = line.indexOf(line[k], k + 1);
      return close < 0 ? n : close + 1;
    }
    if (!VERBATIM_ARG_CMDS.has(name)) return null;
    let k = j;
    while (k < n && /\s/.test(line[k])) k++;
    if (k >= n || line[k] !== '{') return null;
    let depth = 0;
    for (let at = k; at < n; at++) {
      if (line[at] === '{') depth++;
      else if (line[at] === '}') { depth--; if (depth === 0) return at + 1; }
    }
    return n;
  }
  /** 第一个不是转义、也不在 \verb / \url / \href / \path 里的 %。 */
  function commentStart(line) {
    let at = 0;
    const n = line.length;
    while (at < n) {
      const c = line[at];
      if (c === '%') return at;
      if (c === '\\') { const end = verbatimArgEnd(line, at); at = end != null ? end : at + 2; }
      else at++;
    }
    return null;
  }
  /** 去掉 % 注释后的源码，和删掉的注释（行号、内容、是不是 TODO）。 */
  function stripComments(source) {
    const out = [], comments = [];
    let verbatim = null, inCommentEnv = false;
    splitKeep(source).forEach((line, idx) => {
      const number = idx + 1;
      const body = line.replace(/[\r\n]+$/, '');
      const ending = line.slice(body.length);
      const note = (said) => { said = said.trim(); if (said) comments.push({ line: number, text: cut(said, 200), todo: todoTest(said) }); };
      if (verbatim) { if (body.includes(`\\end{${verbatim}}`)) verbatim = null; out.push(line); return; }
      if (inCommentEnv) { if (body.includes('\\end{comment}')) inCommentEnv = false; note(body.replace('\\end{comment}', '')); return; }
      const cs = commentStart(body);
      const code = cs == null ? body : body.slice(0, cs);
      if (code.trimStart().startsWith('\\begin{comment}')) {
        inCommentEnv = !code.includes('\\end{comment}');
        note(body.split('\\begin{comment}').join('').split('\\end{comment}').join(''));
        return;
      }
      const opened = VERBATIM_ENVS.filter((e) => code.includes(`\\begin{${e}}`)).map((e) => [code.indexOf(`\\begin{${e}}`) + `\\begin{${e}}`.length, e]);
      if (opened.length) {
        opened.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
        const [pos, env] = opened[0];
        if (!body.slice(pos).includes(`\\end{${env}}`)) verbatim = env;
        out.push(line);
        return;
      }
      if (cs == null) { out.push(line); return; }
      const said = body.slice(cs + 1);
      if (!said.trim()) { out.push(line); return; }
      note(said);
      if (body.slice(0, cs).trim()) out.push(body.slice(0, cs + 1) + ending);
    });
    return { text: out.join(''), comments };
  }
  /** TeX 当命令读的行：[行号, 去掉注释的内容]。 */
  function codeLines(source) {
    const result = [];
    let verbatim = null, inCommentEnv = false;
    splitLines(source).forEach((line, idx) => {
      const number = idx + 1;
      if (verbatim) { if (line.includes(`\\end{${verbatim}}`)) verbatim = null; return; }
      if (inCommentEnv) { if (line.includes('\\end{comment}')) inCommentEnv = false; return; }
      const cs = commentStart(line);
      const code = cs == null ? line : line.slice(0, cs);
      if (code.trimStart().startsWith('\\begin{comment}')) { inCommentEnv = !code.includes('\\end{comment}'); return; }
      for (const e of VERBATIM_ENVS) if (code.includes(`\\begin{${e}}`) && !code.includes(`\\end{${e}}`)) verbatim = e;
      if (code.trim()) result.push([number, code]);
    });
    return result;
  }

  // ── \input 合并：files 是 { 路径: 文本 } ─────────────────────────────────
  const INPUT_RE = /\\(input|include)\s*\{([^{}]+)\}/;
  function normPath(p) {
    const parts = [];
    for (const seg of String(p).replace(/\\/g, '/').split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(seg);
    }
    return parts.join('/');
  }
  function mergeInputs(text, files, depth = 0, merged = []) {
    if (depth > 16) return { text, merged };
    const out = [];
    for (const line of splitKeep(text)) {
      const cs = commentStart(line);
      const code = cs == null ? line : line.slice(0, cs);
      const m = code.match(INPUT_RE);
      if (!m) { out.push(line); continue; }
      const name = m[2].trim();
      const rel = normPath(name.toLowerCase().endsWith('.tex') ? name : name + '.tex');
      if (!rel || !(rel in files)) { out.push(line); continue; }
      let inner = mergeInputs(files[rel], files, depth + 1, merged).text;
      inner = inner.split(/\\endinput(?![A-Za-z0-9_])/)[0];
      if (!merged.includes(rel)) merged.push(rel);
      const before = code.slice(0, m.index), after = line.slice(m.index + m[0].length);
      const prefix = m[1] === 'include' ? '\\clearpage\n' : '';
      out.push(before + prefix + inner.replace(/\n+$/, '') + '\n' + (after.trim() ? after : ''));
    }
    return { text: out.join(''), merged };
  }
  function bracedArg(text, start) {
    const i = text.indexOf('{', start);
    if (i < 0) return ['', start];
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') { depth--; if (depth === 0) return [text.slice(i + 1, j), j + 1]; }
    }
    return [text.slice(i + 1), text.length];
  }

  // ── 稿件体检 ──────────────────────────────────────────────────────────
  const RARE = [
    ['delve', /\bdelv(?:e|es|ed|ing)\b/gi], ['tapestry/realm', /\b(?:tapestry|tapestries|realms?)\b/gi], ['holistic', /\bholistic(?:ally)?\b/gi],
    ['in its own right', /\bin (?:its|their) own right\b/gi], ['not merely / more than just', /\b(?:not merely|more than just|not simply)\b/gi],
    ['underscore', /\bunderscor(?:e|es|ed|ing)\b/gi], ['shed light', /\bshed(?:s|ding)? (?:new )?light\b/gi], ['unlock', /\bunlock(?:s|ed|ing)?\b/gi],
    ['paradigm', /\bparadigm(?:s|atic)?\b/gi], ['seamless', /\bseamless(?:ly)?\b/gi], ['pivotal', /\bpivotal\b/gi], ['harness', /\bharness(?:es|ed|ing)?\b/gi],
    ['intricate', /\bintricate(?:ly)?\b/gi], ['it is worth noting', /\b(?:it is worth not(?:ing|e)|it should be noted|it is important to note)\b/gi],
    ['In this way,', /\bIn this way,/g], ['crucially/critically', /\b(?:crucially|critically)\b/gi],
    ['this highlights/underscores', /\b(?:This|These|which) (?:further )?(?:highlight|underscore)s?\b/gi],
    ['paves the way / opens avenues', /\b(?:motivat\w+ (?:future|further)|open\w* (?:new )?avenues|future work (?:could|should|will)|paves? the way|paved the way)\b/gi],
  ];
  const DENSE = [
    ['ultimately', /\bultimately\b/gi, 0.30], ['fundamental(ly)', /\bfundamental(?:ly)?\b/gi, 0.40], ['importantly', /\bimportantly\b/gi, 0.79],
    ['remarkable/strikingly', /\b(?:remarkabl[ey]|strikingly)\b/gi, 0.27], ['indeed', /\bindeed\b/gi, 1.34], ['notably', /\bnotably\b/gi, 1.77],
    ['not only ... but', /\bnot only\b[^.]{0,120}?\bbut\b/gi, 0.40], ['Taken together/Collectively,', /\b(?:Together|Taken together|Collectively),/g, 0.70],
    ['coined compound modifier', /\b[a-z]{3,}-(?:available|aware|centric|agnostic|native|grounded|ready|oriented|first)\b/gi, 1.22],
  ];
  const DRAFT_MACROS = ['TODO', 'note', 'directive', 'superseded', 'draftfig'];
  const DROP_CMD = /\\(?:cite\w*|ref|eqref|autoref|cref|Cref|label|url|href|includegraphics|bibliographystyle|bibliography)\*?(?:\[[^\]]*\])*\{[^}]*\}/g;
  const MATH = /\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\[[\s\S]*?\\\]/g;
  const WORD = /[A-Za-z][A-Za-z0-9'-]*/g;
  const BOLD = /\\textbf\{([^{}]*)\}/g;
  const FIG_REF = /(?<!\w)(?<kind>Extended\s+Data\s+(?:Figs?\.|Figures?)|Supplementary\s+(?:Figs?\.|Figures?)|(?:Figs?\.|Figures?))\s*(?<num>\d+)(?<panels>[a-z](?:\s*[-\u2013]\s*[a-z])?)?(?:\s*[-\u2013]\s*(?<end>\d+))?/gi;
  const STUBS = ['Abstract here.', 'Introduction here.', 'Results here.', 'Discussion here.', 'Methods here.', 'Data availability here.', 'Code availability here.', 'Acknowledgements here.', 'Author contributions here.', 'Competing interests here.', 'Supplementary information here.'];
  const MARKERS = [
    [L2('TODO/FIXME 标记', 'TODO/FIXME marker'), (s) => /\\(?:TODO|note|directive|superseded|draftfig)\s*\{|\b(?:TODO|FIXME|TBD|XXX)\b/.test(s)],
    [L2('待补充占位符', 'placeholder'), (s) => /\[citation needed\]|\?\?\?|To be completed by the authors/i.test(s)],
  ];
  const STATS_CLAIM = /\bp\s*[<>=]\s*0?\.\d+|\bp[- ]values?\b|\bstatistically significant\b|\bANOVA\b|\bt[- ]tests?\b|\bMann[- ]Whitney\b|\bWilcoxon\b|\bchi[- ]square\b/gi;
  const SAMPLE_SIZE = /\bn\s*=\s*\d+|\bsample sizes?\b|\breplicates?\b|\btrials?\b|\bsamples?\b|\bfolds?\b|\bseeds?\b|\bsubjects?\b|\bpatients?\b|\bcells?\b|\bruns?\b/i;
  const UNCERTAINTY = /\bCI\b|confidence interval|\bs\.d\.|\bs\.e\.m\.|\bSD\b|\bSEM\b|±|\\pm\b|\bIQR\b|\bRMSE\b|\bMAE\b|\bAUC\b|\bCohen|effect size|\bR\^2\b|\br\s*=/i;
  const P_BARE = /\bp\s*<\s*0?\.(?:05|01|001)\b/i;
  const P_EXACT = /\bp\s*=\s*0?\.\d+/i;
  const AI_FIG = /\b(?:Midjourney|DALL[\s-]?E|Stable Diffusion|generated (?:by|with|using) (?:generative )?AI|AI-generated (?:figure|image|illustration))\b/i;
  const PARTICIPLE_TAIL = /,\s+(?:thereby\s+)?(?!during|including|according|following|using|regarding|concerning|excluding|notwithstanding)[a-z]{3,}ing\b/;
  const ANTITHESIS = /\b(?:is|are|does|do|was|were) not\b|\bnot yet\b|\bnot the same\b|\brather than\b|\binstead of\b|\bneed not\b|\bisn't\b|\baren't\b/i;
  const CONNECTOR = /\b(?:however|furthermore|moreover|additionally|therefore|thus|hence|consequently|nevertheless|nonetheless|meanwhile|in addition|in contrast|as a result|on the other hand)\b/gi;
  const WORKFLOW = [
    [L2('工作流泄露 (supplied)', 'workflow leak (supplied)'), /\bsupplied\b/gi],
    [L2('工作流泄露 (the provided ...)', 'workflow leak (the provided ...)'), /\bprovided (?:results|evaluation|numbers|data|facts|input)\b|\bthe provided\b/gi],
    [L2('工作流泄露 (according to the input/notes)', 'workflow leak (according to the input/notes)'), /\baccording to the (?:input|user|notes)\b/gi],
    [L2('残留写作步骤标签', 'leftover writing-step tag'), /\[(?:intro|abstract|relwork|method|exp)\.[a-z\-.]+\]/g],
  ];
  const FRONT = [
    [L2('摘要/引言防御性免责 (does not establish/prove)', 'defensive disclaimer in abstract/intro (does not establish/prove)'), /\bdoes not (?:establish|imply|guarantee|isolate|prove)\b|\bdo not (?:establish|imply|isolate|prove)\b/i],
    [L2('摘要/引言遗留 future-work 退缩表述', 'future-work retreat in abstract/intro'), /\bremains? to be (?:evaluated|tested|seen|explored)\b|\bleave [^.]* (?:for|to) future work\b/i],
    [L2('摘要/引言出现局限性声明 (应放 Limitations)', 'limitation statement in abstract/intro (belongs in Limitations)'), /\bone limitation\b|\blimitations? of (?:our|this)\b|\bour (?:method|approach|model) (?:still )?(?:fails|is limited)\b/i],
    [L2('摘要/引言出现协议防御性限定 (应放 Experiments)', 'protocol hedging in abstract/intro (belongs in Experiments)'), /\bin our comparisons?\b|\bwithin the tested\b|\bunder the tested\b|\bin the evaluated setting\b|\bunder identical hyperparameters\b/i],
    [L2('核心洞察降格为猜测', 'key insight downgraded to a guess'), /\bour hypothesis is\b|\bwe take the view\b|\bwe conjecture\b/i],
  ];
  const PLOT_RASTER = /(plot|curve|chart|graph|bar|loss|scaling|ablation|hist)/i;
  const ABS_WIDTH = /\b(?:width|height)\s*=\s*\d+(?:\.\d+)?\s*(?:cm|mm|in|pt|bp)\b/i;
  const NUMBER_TOKEN = /(?<![A-Za-z\d.])\d+(?:[.,]\d+)*(?![A-Za-z\d])/g;
  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/g;

  const count = (re, s) => (String(s).match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
  const wordCount = (s) => count(WORD, s);
  function mostlyCJK(text) { const s = String(text || '').replace(/\s+/g, ''); if (!s) return false; return count(CJK, s) / [...s].length >= 0.15; }

  function splitSentences(text) {
    const cleaned = words(text).join(' ');
    if (!cleaned) return [];
    let prot = cleaned;
    for (const re of [/\b(?:e\.g\.|i\.e\.|w\.r\.t\.|i\.i\.d\.)/gi, /\bet al\./gi, /\b(?:Fig|Figs|Tab|Eq|Eqs|Sec|cf|vs|etc|resp|approx)\./gi, /(?<=\d)\.(?=\d)/gi]) prot = prot.replace(re, (m) => m.replace(/\./g, '\uE000'));
    const out = [];
    let start = 0;
    for (const m of prot.matchAll(/[.!?][”’")\]]*(?=\s|$)/g)) {
      const seg = cleaned.slice(start, m.index + m[0].length).trim();
      if (seg) out.push(seg);
      start = m.index + m[0].length;
    }
    const tail = cleaned.slice(start).trim();
    if (tail) out.push(tail);
    return out;
  }
  function cleanProse(text) {
    let c = String(text || '').replace(DROP_CMD, ' [c] ');
    c = c.replace(MATH, ' x ');
    c = c.split('---').join('\u2014');
    c = c.replace(/\\(?:begin|end)\{[^}]*\}(?:\[[^\]]*\])?/g, ' ');
    c = c.replace(/\\(?:textbf|textit|emph|underline|texttt)\{([^{}]*)\}/g, '$1');
    c = c.replace(/\\[A-Za-z@]+\*?(?:\[[^\]]*\])?/g, ' ');
    return c.replace(/[{}~]/g, ' ');
  }
  function introBlock(body) {
    const m = String(body || '').match(/\\section\*?\{\s*Introduction\s*\}/i);
    if (!m) return '';
    const rest = body.slice(m.index + m[0].length);
    const nx = rest.search(/\\section\*?\{/);
    return nx >= 0 ? rest.slice(0, nx) : rest;
  }
  const UNIT_OK = new Set(['Hz', 'kHz', 'MHz', 'GHz', 'fps', 's', 'ms', 'cm', 'mm', 'k', 'M', 'B', 'x']);
  function proseNumbers(text) {
    let c = String(text || '').replace(DROP_CMD, ' ');
    c = c.replace(/\([^)]*\)/g, (m) => m.replace(/\b(?:19|20)\d{2}\b/g, ' '));
    c = c.replace(/\b[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*\b/g, (m) => (/\d/.test(m) ? ' ' : m));
    c = c.replace(/\b\d+([A-Za-z][A-Za-z0-9-]*)\b/g, (m, u) => (UNIT_OK.has(u) ? m : ' '));
    return count(NUMBER_TOKEN, c);
  }
  function syntactic(paragraphs) {
    const sents = [];
    let runMax = 0;
    for (const p of paragraphs) {
      const ps = splitSentences(p);
      sents.push(...ps);
      let cur = 0;
      for (const s of ps) { cur = wordCount(s) < 15 ? cur + 1 : 0; runMax = Math.max(runMax, cur); }
    }
    const w = sents.reduce((a, s) => a + wordCount(s), 0);
    const n = Math.max(sents.length, 1);
    const part = sents.filter((s) => PARTICIPLE_TAIL.test(s)).length;
    const anti = sents.filter((s) => ANTITHESIS.test(s)).length;
    const conn = sents.reduce((a, s) => a + count(CONNECTOR, s), 0);
    return { words: w, sentences: sents.length, participleTailRatio: sents.length ? round(part / n, 3) : 0, antithesisRatio: sents.length ? round(anti / n, 3) : 0, connectorPer100w: w ? round((conn / Math.max(w, 1)) * 100, 2) : 0, shortRunMax: runMax };
  }

  /** 摘要 / 引言一段文字的文风体检（latex_copilot 的润色摘要和单独的文风检查都用它）。 */
  function auditTextDraft(text, section = 'abstract') {
    const raw = text || '';
    const clean = cleanProse(raw);
    let paras = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (!paras.length && clean.trim()) paras = [clean.trim()];
    const metrics = syntactic(paras);
    const nums = proseNumbers(raw);
    const em = clean.split('\u2014').length - 1, semi = clean.split(';').length - 1;
    Object.assign(metrics, { numbers: nums, emDashes: em, semicolons: semi });
    const issues = [];
    for (const [key, re] of RARE) if (new RegExp(re.source, re.flags.replace('g', '')).test(clean)) issues.push(L2(`含高频 AI 套话 [${key}]`, `stock AI phrase [${key}]`));
    for (const [label, re] of WORKFLOW) if (new RegExp(re.source, re.flags.replace('g', '')).test(clean)) issues.push(L2(`含${label[0]}`, `contains ${label[1]}`));
    const sec = section.trim().toLowerCase();
    if (sec === 'abstract' || sec === 'introduction') for (const [label, re] of FRONT) if (re.test(clean)) issues.push(label);
    if (sec === 'abstract') {
      if (em) issues.push(L2(`摘要含 ${em} 个长破折号（顶会与 Nature 均建议摘要 0 个）`, `abstract has ${em} em-dash(es) (top venues and Nature: none)`));
      if (semi) issues.push(L2(`摘要含 ${semi} 个分号（建议 0 个）`, `abstract has ${semi} semicolon(s) (aim for none)`));
    }
    if (!mostlyCJK(clean)) {
      if (metrics.sentences >= 6 && metrics.participleTailRatio > 0.22) issues.push(L2(`句尾分词短语占比 ${pct0(metrics.participleTailRatio)} 偏高（', making/enabling ...'；获奖论文约 8%，AI 草稿常见 30%+）`, `trailing participle phrases in ${pct0(metrics.participleTailRatio)} of sentences (', making/enabling ...'; award papers ~8%, AI drafts often 30%+)`));
      if (metrics.sentences >= 6 && metrics.antithesisRatio > 0.25) issues.push(L2(`对比/警句排比句占比 ${pct0(metrics.antithesisRatio)} 偏高（'X is not Y / rather than' 过度堆砌）`, `"X is not Y / rather than" contrasts in ${pct0(metrics.antithesisRatio)} of sentences: too many`));
      if (metrics.shortRunMax >= 4) issues.push(L2(`连续 ${metrics.shortRunMax} 个短句堆砌（建议合并因果或对比关系）`, `${metrics.shortRunMax} short sentences in a row (merge the cause or contrast)`));
      if (metrics.words >= 120 && metrics.connectorPer100w > 2.5) issues.push(L2(`显式逻辑连接词每百词 ${pyFloat(metrics.connectorPer100w)} 个偏高（顶会获奖论文通常 ≤ 2.0）`, `${pyFloat(metrics.connectorPer100w)} explicit connectors per 100 words (award papers usually ≤ 2.0)`));
      if (sec === 'abstract' && nums > 6) issues.push(L2(`摘要含 ${nums} 个数字（获奖论文摘要中位数 1 个、p90 ≤ 6 个，仅保留核心头条数字）`, `abstract has ${nums} numbers (award papers: median 1, p90 ≤ 6; keep the headline ones)`));
      else if (sec === 'introduction' && nums > 16) issues.push(L2(`引言含 ${nums} 个数字（获奖论文引言 p90 ≤ 14 个，细节数据请留给正文表格）`, `introduction has ${nums} numbers (award papers: p90 ≤ 14; move details to tables)`));
    }
    return { ok: issues.length === 0, section: sec, metrics, issues };
  }

  function stripMacro(text, name) {
    const out = [];
    let i = 0;
    const tag = '\\' + name + '{';
    for (;;) {
      const j = text.indexOf(tag, i);
      if (j < 0) { out.push(text.slice(i)); return out.join(''); }
      out.push(text.slice(i, j));
      let k = j + tag.length, depth = 1;
      while (k < text.length && depth > 0) {
        if (text[k] === '\\' && k + 1 < text.length) { k += 2; continue; }
        if (text[k] === '{') depth++; else if (text[k] === '}') depth--;
        k++;
      }
      if (depth > 0) { out.push(text.slice(j)); return out.join(''); }
      i = k;
    }
  }
  const stripFloats = (t) => t.replace(/\\begin\{figure\*?}[\s\S]*?\\end\{figure\*?}/g, ' ').replace(/\\begin\{table\*?}[\s\S]*?\\end\{table\*?}/g, ' ');
  function proseWords(text) {
    let c = String(text).replace(DROP_CMD, ' ').replace(MATH, ' ');
    c = c.replace(/\\(?:begin|end)\{[^}]*\}(?:\[[^\]]*\])?/g, ' ').replace(/\\[A-Za-z@]+\*?/g, ' ').replace(/[{}~]/g, ' ');
    return c.match(WORD) || [];
  }
  function bodyLines(lines) {
    const out = [];
    let started = false;
    for (const [num, code] of lines) {
      if (!started) {
        const m = code.match(/\\begin\{document\}/);
        if (!m) continue;
        started = true;
        const tail = code.slice(m.index + m[0].length);
        if (tail.trim()) out.push([num, tail]);
        continue;
      }
      if (/\\end\{document\}/.test(code)) { const head = code.slice(0, code.indexOf('\\end{document}')); if (head.trim()) out.push([num, head]); break; }
      out.push([num, code]);
    }
    return started ? out : lines;
  }
  function abstractBlock(body) {
    const m = body.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
    if (m) return m[1];
    const a = body.match(/\\abstract(?![A-Za-z0-9_])/);
    return a ? bracedArg(body, a.index + a[0].length)[0] : '';
  }

  function auditWordcount(body, abstractRaw, venue, isJournal) {
    let s = body;
    for (const m of DRAFT_MACROS) s = stripMacro(s, m);
    s = stripFloats(s).replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, ' ');
    const bodyWords = proseWords(s).length, absWords = proseWords(abstractRaw).length;
    let limit = 200;
    if (venue) { const m = String(venue.abstract_limit ?? '').match(/(\d{2,3})\s*words/i); if (m) limit = Number(m[1]); }
    else if (!isJournal) limit = 250;
    const items = [];
    let state = 'ok';
    if (abstractRaw && absWords > limit) { state = 'warn'; items.push(L2(`摘要共 ${absWords} 词，超过建议上限 ${limit} 词`, `abstract is ${absWords} words, over the suggested ${limit}`)); }
    else if (!abstractRaw) { state = 'warn'; items.push(L2('未检测到 abstract 环境或 \\abstract', 'no abstract environment or \\abstract found')); }
    const detail = L2(`正文约 ${bodyWords} 词，摘要 ${absWords} 词`, `body ≈ ${bodyWords} words, abstract ${absWords}`);
    if (isJournal || venue) { detail[0] += `（摘要上限 ${limit} 词）`; detail[1] += ` (abstract limit ${limit})`; }
    return row('prose_wordcount', state, L2('正文与摘要字数', 'Word counts'), detail, items);
  }

  function auditAiTells(bLines, abstractRaw, body = '') {
    const cleaned = bLines.map(([n, code]) => [n, code.replace(DROP_CMD, ' ').replace(MATH, ' ').split('---').join('\u2014')]);
    const w = cleaned.reduce((a, [, t]) => a + wordCount(t), 0);
    const f = [];
    const ctx = (line, m, a, b) => line.slice(Math.max(0, m.index - a), Math.min(line.length, m.index + m[0].length + b)).trim();
    for (const [key, re] of RARE) for (const [n, line] of cleaned) for (const m of line.matchAll(re)) f.push(L2(`第 ${n} 行 [${key}]：${ctx(line, m, 30, 30)}`, `line ${n} [${key}]: ${ctx(line, m, 30, 30)}`));
    for (const [label, re] of WORKFLOW) for (const [n, line] of cleaned) for (const m of line.matchAll(re)) f.push(L2(`第 ${n} 行 [${label[0]}]：${ctx(line, m, 25, 25)}`, `line ${n} [${label[1]}]: ${ctx(line, m, 25, 25)}`));
    if (w >= 1000) {
      for (const [key, re, base] of DENSE) {
        const hits = [];
        for (const [n, line] of cleaned) for (const m of line.matchAll(re)) hits.push([n, m, line]);
        const rate = w ? (1e4 * hits.length) / w : 0;
        if (hits.length >= 2 && rate >= 3 * base) for (const [n, m, line] of hits.slice(0, 3)) f.push(L2(`第 ${n} 行 [${key} 偏密 ${(rate / base).toFixed(1)}x]：${ctx(line, m, 25, 25)}`, `line ${n} [${key}, ${(rate / base).toFixed(1)}x the usual rate]: ${ctx(line, m, 25, 25)}`));
      }
    }
    if (abstractRaw) {
      const a = abstractRaw.replace(DROP_CMD, ' ').replace(MATH, ' ').split('---').join('\u2014');
      const d = a.split('\u2014').length - 1, s = a.split(';').length - 1;
      if (d) f.push(L2(`摘要含 ${d} 个长破折号（Nature 与顶会风格均建议摘要 0 个）`, `abstract has ${d} em-dash(es) (Nature and top venues: none)`));
      if (s) f.push(L2(`摘要含 ${s} 个分号（Nature 风格建议摘要 0 个）`, `abstract has ${s} semicolon(s) (Nature style: none)`));
    }
    let pStart = null, buf = [];
    const paras = [];
    for (const [n, line] of [...cleaned, [0, '']]) {
      const s = line.trim();
      if (s && !s.startsWith('\\section') && !s.startsWith('\\subsection')) { pStart = pStart || n; buf.push(s); }
      else if (buf.length) { paras.push([pStart || n, buf.join(' ')]); pStart = null; buf = []; }
    }
    for (const [pn, para] of paras) {
      const d = para.split('\u2014').length - 1, s = para.split(';').length - 1;
      if (d > 1) f.push(L2(`第 ${pn} 行起段落含 ${d} 个长破折号（建议每段最多 1 个，避免成对破折号）`, `paragraph from line ${pn} has ${d} em-dashes (at most 1 per paragraph, no pairs)`));
      if (s > 1) f.push(L2(`第 ${pn} 行起段落含 ${s} 个分号（建议每段最多 1 个）`, `paragraph from line ${pn} has ${s} semicolons (at most 1 per paragraph)`));
    }
    for (const [n, code] of bLines) {
      if (/\\(?:caption|section|subsection|subsubsection|paragraph|title)(?![A-Za-z0-9_])/.test(code)) continue;
      for (const m of code.matchAll(BOLD)) if (wordCount(m[1]) >= 6) f.push(L2(`第 ${n} 行 [正文长粗体句]：${cut(m[1].trim(), 80)}`, `line ${n} [long bold sentence in body]: ${cut(m[1].trim(), 80)}`));
    }
    const intro = body ? introBlock(body) : '';
    const absN = abstractRaw ? proseNumbers(abstractRaw) : 0, introN = intro ? proseNumbers(intro) : 0;
    const metrics = syntactic(paras.map(([, p]) => cleanProse(p)));
    metrics.abstractNumbers = absN;
    metrics.introNumbers = introN;
    if (!mostlyCJK(body || abstractRaw)) {
      for (const [lz, le, raw] of [['摘要', 'abstract', abstractRaw], ['引言', 'introduction', intro]]) {
        if (!raw) continue;
        const c = cleanProse(raw);
        for (const [label, re] of FRONT) {
          const m = c.match(re);
          if (m) { const x = c.slice(Math.max(0, m.index - 20), Math.min(c.length, m.index + m[0].length + 30)).trim(); f.push(L2(`${lz} [${label[0]}]：${x}`, `${le} [${label[1]}]: ${x}`)); }
        }
      }
      const front = [abstractRaw, intro].filter((b) => b && b.trim()).map(cleanProse);
      const fm = front.length ? syntactic(front) : metrics;
      const t = fm.sentences >= 8 ? fm : metrics;
      if (t.sentences >= 8 && t.participleTailRatio > 0.22) f.push(L2(`句尾分词短语（', making/enabling ...'）占比 ${pct0(t.participleTailRatio)} 偏高（顶会获奖论文约 8%，AI 草稿常见 30%+）`, `trailing participles (', making/enabling ...') in ${pct0(t.participleTailRatio)} of sentences (award papers ~8%, AI drafts often 30%+)`));
      if (t.sentences >= 8 && t.antithesisRatio > 0.25) f.push(L2(`对比/警句排比句（'X is not Y / rather than'）占比 ${pct0(t.antithesisRatio)} 偏高`, `"X is not Y / rather than" contrasts in ${pct0(t.antithesisRatio)} of sentences: too many`));
      if (t.shortRunMax >= 4) f.push(L2(`存在连续 ${t.shortRunMax} 个短句（<15 词）堆砌，建议合并因果/对比逻辑`, `${t.shortRunMax} short sentences (<15 words) in a row: merge the cause or contrast`));
      if (t.words >= 150 && t.connectorPer100w > 2.5) f.push(L2(`显式连接词密度 ${pyFloat(t.connectorPer100w)} / 百词偏高（建议控制在 ≤ 2.0）`, `${pyFloat(t.connectorPer100w)} explicit connectors per 100 words (keep ≤ 2.0)`));
      if (abstractRaw && absN > 6) f.push(L2(`摘要含 ${absN} 个数字（获奖论文摘要中位数 1 个、p90 ≤ 6 个，仅保留核心头条数字）`, `abstract has ${absN} numbers (award papers: median 1, p90 ≤ 6)`));
      if (intro && introN > 16) f.push(L2(`引言含 ${introN} 个数字（获奖论文引言 p90 ≤ 14 个，详细指标请移入正文表格）`, `introduction has ${introN} numbers (award papers: p90 ≤ 14; move details to tables)`));
    }
    const r = row('ai_tells', f.length ? 'warn' : 'ok', L2('AI 写作痕迹与标点节奏', 'AI tells and punctuation rhythm'),
      f.length ? L2(`发现 ${f.length} 处可优化表述/标点节奏`, `${f.length} phrases or punctuation habits to improve`) : L2(`已检查约 ${w} 词，未检出明显 AI 腔与标点滥用`, `checked ≈ ${w} words: no obvious AI tells or punctuation habits`), f.slice(0, 20));
    r.metrics = metrics;
    return r;
  }

  function auditFigureRefs(body, isJournal, code = '') {
    const oneCol = isJournal || /\\usepackage(?:\[[^\]]*\])?\{neurips/.test(code || '');
    const labels = new Set([...body.matchAll(/\\label\{([^}]+)\}/g)].map((m) => m[1]));
    const REF = /\\(?:autoref|cref|Cref|ref)\*?\{([^}]+)\}/g;
    const refs = new Set([...body.matchAll(REF)].flatMap((m) => m[1].split(',').map((t) => t.trim())));
    const secStarts = [...body.matchAll(/\\section\*?\{/g)].map((m) => m.index);
    const secIdx = (pos) => secStarts.filter((sp) => sp <= pos).length;
    const floats = [...body.matchAll(/\\begin\{(?:figure|table)\*?\}[\s\S]*?\\end\{(?:figure|table)\*?\}/g)].map((m) => [m.index, m.index + m[0].length]);
    const inFloat = (pos) => floats.some(([s, e]) => s <= pos && pos <= e);
    const firstRef = new Map();
    for (const m of body.matchAll(REF)) { if (inFloat(m.index)) continue; for (const t0 of m[1].split(',')) { const t = t0.trim(); if (t && !firstRef.has(t)) firstRef.set(t, m.index); } }
    const figs = [...body.matchAll(/\\begin\{figure\*?\}([\s\S]*?)\\end\{figure\*?\}/g)];
    const defined = [], cap = [];
    figs.forEach((fm, i) => {
      const idx = i + 1, block = fm[1], fsec = secIdx(fm.index);
      for (const m of block.matchAll(/\\label\{([^}]+)\}/g)) defined.push([idx, fsec, m[1]]);
      const cm = block.match(/\\caption(?![A-Za-z0-9_])/);
      if (cm) {
        const capText = bracedArg(block, cm.index + cm[0].length)[0];
        const cw = proseWords(capText).length;
        if (cw > 350) cap.push(L2(`Fig. ${idx} 图注约 ${cw} 词（Nature 风格建议 ≤ 350 词）`, `Fig. ${idx} caption ≈ ${cw} words (Nature style: ≤ 350)`));
        if (isJournal && capText.trim() && !/^\s*\\textbf\{/.test(capText)) cap.push(L2(`Fig. ${idx} 图注未以加粗一句话总标题（\\textbf{...}）开头`, `Fig. ${idx} caption does not open with a bold one-line title (\\textbf{...})`));
        if (!mostlyCJK(capText)) {
          const cs = splitSentences(cleanProse(capText));
          if (cs.length) { const fw = wordCount(cs[0]); if (fw > 25) cap.push(L2(`Fig. ${idx} 图注首句共 ${fw} 词（获奖论文建议首句 ≤ 20 词直接点明一句话结论）`, `Fig. ${idx} caption's first sentence is ${fw} words (award papers: ≤ 20 words stating the finding)`)); }
          if (!isJournal) {
            const max = idx === 1 ? (oneCol ? 155 : 110) : (oneCol ? 105 : 95);
            if (cw > max) cap.push(L2(`Fig. ${idx} 图注约 ${cw} 词，超过顶会获奖论文 p90 上限（${max} 词）`, `Fig. ${idx} caption ≈ ${cw} words, over the award-paper p90 (${max})`));
          }
        }
      }
      for (const gm of block.matchAll(/\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g)) {
        const opts = gm[1] || '', gp = gm[2].trim();
        if (opts && ABS_WIDTH.test(opts)) cap.push(L2(`Fig. ${idx} 使用了绝对尺寸参数（${cut(gm[0], 48)}），建议改用相对宽度 \\linewidth / \\textwidth`, `Fig. ${idx} uses an absolute size (${cut(gm[0], 48)}); use \\linewidth / \\textwidth`));
        const low = gp.toLowerCase();
        if (/\.(png|jpg|jpeg)$/.test(low) && PLOT_RASTER.test(low)) { const base = gp.split('/').pop(); cap.push(L2(`Fig. ${idx} 的数据/曲线图 ${base} 为栅格格式，顶会排版建议优先使用矢量 PDF/EPS`, `Fig. ${idx}: the data plot ${base} is a raster image; prefer vector PDF/EPS`)); }
      }
    });
    const plain = stripFloats(body);
    const cited = new Set();
    for (const m of plain.matchAll(FIG_REF)) {
      const kind = words(m.groups.kind.toLowerCase()).join(' ');
      if (kind.startsWith('extended data') || kind.startsWith('supplementary')) continue;
      const s = Number(m.groups.num), e = Number(m.groups.end || s);
      for (let n = s; n <= Math.min(e, s + 50); n++) cited.add(n);
    }
    const issues = [];
    for (const [idx, fsec, lbl] of defined) {
      if (!refs.has(lbl) && !cited.has(idx)) issues.push(L2(`已定义图标签 \\label{${lbl}}（Fig. ${idx}）在正文中未被引用`, `figure label \\label{${lbl}} (Fig. ${idx}) is never referenced in the text`));
      else if (firstRef.has(lbl) && fsec > 0 && secIdx(firstRef.get(lbl)) > fsec) issues.push(L2(`Fig. ${idx}（\\label{${lbl}}）首次被正文引用位于更靠后的章节，建议提前在同章或更早章节首次引用`, `Fig. ${idx} (\\label{${lbl}}) is first referenced in a later section; reference it in its own section or earlier`));
    }
    for (const r of [...refs].sort()) if (r.toLowerCase().startsWith('fig:') && !labels.has(r)) issues.push(L2(`正文引用 \\ref{${r}} 找不到对应的 \\label`, `\\ref{${r}} has no matching \\label`));
    const citedSorted = [...cited].sort((a, b) => a - b);
    if (figs.length) for (const n of citedSorted) if (n > figs.length) issues.push(L2(`正文提到 Fig. ${n}，但文档只定义了 ${figs.length} 个 figure 环境`, `the text mentions Fig. ${n} but only ${figs.length} figure environments exist`));
    if (!isJournal) {
      const main = body.split(/\\(?:appendix|bibliography(?![A-Za-z0-9_])|begin\{thebibliography\})/)[0];
      const nf = count(/\\begin\{figure\*?\}/g, main), nt = count(/\\begin\{table\*?\}/g, main);
      const mf = oneCol ? 6 : 9, mt = oneCol ? 2 : 5;
      if (nf > mf) issues.push(L2(`顶会正文含 ${nf} 张图，超过获奖论文 p90 上限（${mf} 张，次要图可移入 Appendix）`, `${nf} figures in the main text, over the award-paper p90 (${mf}); move minor ones to the appendix`));
      if (nt > mt) issues.push(L2(`顶会正文含 ${nt} 张表，超过获奖论文 p90 上限（${mt} 张，细节消融可移入 Appendix）`, `${nt} tables in the main text, over the award-paper p90 (${mt}); move ablations to the appendix`));
    }
    issues.push(...cap);
    const detail = L2(`共 ${figs.length} 个图环境，正文引用编号 ${citedSorted.length ? pyList(citedSorted) : '无'}`, `${figs.length} figure environments; figure numbers cited in text: ${citedSorted.length ? pyList(citedSorted) : 'none'}`);
    if (issues.length) { detail[0] += `；发现 ${issues.length} 项需核对`; detail[1] += `; ${issues.length} to check`; }
    return row('figure_refs', issues.length ? 'warn' : 'ok', L2('图表与图注一致性', 'Figures, references and captions'), detail, issues.slice(0, 20));
  }

  function auditDraftMarkers(bLines) {
    const stubs = [], marks = [];
    for (const [n, code] of bLines) {
      for (const s of STUBS) if (code.includes(s)) stubs.push(L2(`第 ${n} 行残留模板占位句：${s}`, `line ${n}: template placeholder left: ${s}`));
      for (const [label, test] of MARKERS) if (test(code)) marks.push(L2(`第 ${n} 行 [${label[0]}]：${cut(code.trim(), 100)}`, `line ${n} [${label[1]}]: ${cut(code.trim(), 100)}`));
    }
    const label = L2('草稿标记与占位符', 'Draft markers and placeholders');
    if (stubs.length) return row('draft_markers', 'fail', label, L2(`发现 ${stubs.length} 处未替换的模板占位文本`, `${stubs.length} template placeholders not replaced`), [...stubs, ...marks].slice(0, 20));
    if (marks.length) return row('draft_markers', 'warn', label, L2(`发现 ${marks.length} 处待补全或草稿标记`, `${marks.length} draft markers or gaps to fill`), marks.slice(0, 20));
    return row('draft_markers', 'ok', label, L2('没有残留模板占位符或 TODO 标记', 'no template placeholders or TODO markers'));
  }
  function auditStats(body) {
    const plain = stripFloats(body);
    const hits = plain.match(STATS_CLAIM) || [];
    const label = L2('统计报告规范', 'Statistical reporting');
    if (!hits.length) return row('stats_reporting', 'ok', label, L2('正文未出现显著性检验（p 值 / ANOVA / t-test 等）表述', 'no significance tests (p values, ANOVA, t-tests …) in the text'));
    const items = [];
    if (!SAMPLE_SIZE.test(body)) items.push(L2('正文与 Methods 未检测到样本量（n = ... / replicates / samples）说明', 'no sample size (n = … / replicates / samples) in the text or Methods'));
    if (!UNCERTAINTY.test(body)) items.push(L2('未检测到误差棒或效应量/置信区间指标（SD / SEM / CI / ± / RMSE / MAE 等）', 'no error bars, effect sizes or confidence intervals (SD / SEM / CI / ± / RMSE / MAE …)'));
    if (P_BARE.test(plain) && !P_EXACT.test(plain)) items.push(L2('存在阈值型 p < 0.05/0.01 表述，建议尽量同时给出精确 p 值与效应量', 'threshold p < 0.05/0.01 only: give exact p values and effect sizes'));
    const detail = items.length ? L2(`检测到 ${hits.length} 处统计检验表述，有 ${items.length} 项建议补充`, `${hits.length} statistical test mentions; ${items.length} things to add`) : L2(`检测到 ${hits.length} 处统计检验表述，样本量与不确定度要素齐全`, `${hits.length} statistical test mentions; sample size and uncertainty are reported`);
    return row('stats_reporting', items.length ? 'warn' : 'ok', label, detail, items);
  }
  function auditBackMatter(body, code, isJournal, venue) {
    const items = [];
    const label = L2('期刊必备声明与合规', 'Journal statements and compliance');
    if (AI_FIG.test(code)) items.push(L2('检测到疑似声明图件由生成式 AI 直接生成的文字（Nature 系列要求最终数据图/示意图须由代码或人工绘制）', 'text suggests a figure was made by generative AI (Nature journals require data figures and schematics drawn by code or by hand)'));
    if (!isJournal) return row('back_matter', items.length ? 'warn' : 'ok', label, items.length ? L2('检测到潜在 AI 生图合规提示', 'possible AI-generated figure') : L2('当前为会议模板，不强制期刊后置声明', 'conference template: journal statements not required'), items);
    const req = ['Methods', 'Data availability', 'Code availability', 'Author contributions', 'Competing interests'];
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const missing = req.filter((s) => !new RegExp(`\\\\section\\*?\\s*\\{\\s*${esc(s)}\\s*\\}`, 'i').test(body));
    for (const s of missing) items.push(L2(`缺少期刊章节 \\section*{${s}}`, `missing journal section \\section*{${s}}`));
    if (body.includes('To be completed by the authors')) items.push(L2('部分声明写为 "To be completed by the authors."（投稿前请由作者补全）', 'some statements say "To be completed by the authors." (fill them in before submitting)'));
    const vl = venue ? (venue.short_name || venue.venue_name) : null;
    return row('back_matter', items.length ? 'warn' : 'ok', label, L2(`按 ${vl || 'Nature 风格期刊'} 规范核对：${req.length - missing.length}/${req.length} 个核心板块完整`, `checked against ${vl || 'Nature-style journal'} rules: ${req.length - missing.length}/${req.length} core sections present`), items);
  }

  /** cmd_manuscript_audit：tex 是主文档（已合并 \input），venue 是模板的 venue.json（没有就 null）。 */
  function manuscriptAudit(tex, venue = null) {
    const lines = codeLines(tex);
    const code = lines.map(([, c]) => c).join('\n');
    const bl = bodyLines(lines);
    const body = bl.map(([, c]) => c).join('\n');
    const abs = abstractBlock(body);
    const isJournal = !!(venue || /\\bibliographystyle\s*\{\s*naturemag\s*\}/.test(code) || (/\\section\*\s*\{\s*Methods\s*\}/i.test(body) && /\\section\*\s*\{\s*Data availability\s*\}/i.test(body)));
    const checks = [auditWordcount(body, abs, venue, isJournal), auditAiTells(bl, abs, body), auditFigureRefs(body, isJournal, code), auditDraftMarkers(bl), auditStats(body), auditBackMatter(body, code, isJournal, venue)];
    const warns = checks.filter((c) => c.state === 'warn').length, fails = checks.filter((c) => c.state === 'fail').length;
    const vz = venue ? (venue.short_name || venue.venue_name) : isJournal ? '期刊模式' : '会议模式';
    const ve = venue ? (venue.short_name || venue.venue_name) : isJournal ? 'Journal mode' : 'Conference mode';
    const summary = !fails && !warns ? L2(`${vz} · 6 项体检全部通过`, `${ve} · all 6 checks passed`) : L2(`${vz} · ${fails} 项阻塞 / ${warns} 项待优化`, `${ve} · ${fails} blocking / ${warns} to improve`);
    return { kind: 'manuscript-audit', summary, checks, isJournal };
  }

  // ── 双盲检查 ──────────────────────────────────────────────────────────
  const ACK_RE = /\\(?:(?:sub)*section|paragraph|chapter)\*?\s*(?:\[[^\]]*\])?\s*\{\s*acknowledge?ments?\b|\\begin\s*\{\s*(?:acknowledge?ments?|acks?)\s*\}/i;
  const ACCOUNT_RE = /(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|huggingface\.co)\/([A-Za-z0-9][A-Za-z0-9_.-]*)[^\s{}\\%,;)]*|https?:\/\/[^\s{}\\%]*\/~[A-Za-z][^\s{}\\%,;)]*/i;
  const SELF_CITE_RE = /\b(?:our|my)\s+(?:own\s+)?(?:previous|prior|earlier|recent|past|preceding)\s+(?:work|paper|stud(?:y|ies)|publication|research|approach|method|system)s?\b|\bwe\s+(?:have\s+)?(?:previously|earlier)\s+(?:show|shown|showed|propose|proposed|introduce|introduced|present|presented|report|reported|demonstrate|demonstrated|describe|described)\b|我们(?:之前|先前|此前|以前)的(?:工作|论文|研究)/i;
  const PACKAGE_RE = /\\(?:usepackage|documentclass)\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/g;
  const ANON_NAMES = /anonymous|ambitious ai researcher|author names? withheld|paper id|\\cvprPaperID/i;
  /** [会议, 是否双盲, 原因（中、英）]。 */
  function detectVenue(code) {
    for (const m of code.matchAll(PACKAGE_RE)) {
      const opts = (m[1] || '').toLowerCase();
      for (const pkg of m[2].split(',').map((p) => p.trim().toLowerCase())) {
        if (pkg.startsWith('iclr') && pkg.includes('conference')) { const fin = code.includes('\\iclrfinalcopy') && !/%\s*\\iclrfinalcopy/.test(code); return ['ICLR', !fin, fin ? L2('已开 \\iclrfinalcopy（正式版）', '\\iclrfinalcopy is on (camera-ready)') : L2('审稿版', 'review version')]; }
        if (pkg.startsWith('neurips')) { const fin = ['final', 'preprint'].some((o) => opts.includes(o)); return ['NeurIPS', !fin, fin ? L2(`选项 [${opts}]`, `option [${opts}]`) : L2('审稿版', 'review version')]; }
        if (pkg.startsWith('icml')) { const fin = opts.includes('accepted'); return ['ICML', !fin, fin ? L2('选项 [accepted]', 'option [accepted]') : L2('审稿版', 'review version')]; }
        if (['cvpr', 'iccv', 'eccv', 'wacv'].includes(pkg)) { const rv = opts.includes('review') || opts.includes('rebuttal'); return [pkg.toUpperCase(), rv, rv ? L2('选项 [review]', 'option [review]') : L2('没开 [review]，按正式版处理', 'no [review] option: treated as camera-ready')]; }
        if (pkg.startsWith('aaai')) { const an = opts.includes('anonymous') || opts.includes('submission'); return ['AAAI', an, an ? L2('选项 [submission]', 'option [submission]') : L2('正式版', 'camera-ready')]; }
        if (pkg === 'acmart') { const an = opts.includes('anonymous'); return ['ACM', an, an ? L2('选项 [anonymous]', 'option [anonymous]') : L2('没开 [anonymous]，按正式版处理', 'no [anonymous] option: treated as camera-ready')]; }
        if (pkg === 'ieeetran') return ['IEEE', false, L2('IEEE 会议通常单盲', 'IEEE conferences are usually single-blind')];
        if (['acl', 'acl2023', 'acl2024', 'acl2025', 'naacl', 'emnlp'].includes(pkg)) { const rv = opts.includes('review'); return ['ACL', rv, rv ? L2('选项 [review]', 'option [review]') : L2('正式版', 'camera-ready')]; }
      }
    }
    return [null, false, L2('')];
  }
  /** cmd_blind：tex 已合并 \input；pdfAuthor 是浏览器用 pdf.js 读出的 PDF 作者字段（没有 PDF 就 undefined）。PDF 字体检查浏览器里不做。 */
  function blindCheck(tex, pdfAuthor) {
    const lines = codeLines(tex);
    const code = lines.map(([, c]) => c).join('\n');
    const [venue, blind, why] = detectVenue(code);
    const checks = [];
    const hits = (re) => lines.filter(([, c]) => re.test(c)).map(([n, c]) => L2(`第 ${n} 行：${cut(c.trim(), 120)}`, `line ${n}: ${cut(c.trim(), 120)}`));
    if (venue && blind) {
      const m = code.match(/\\author(?![A-Za-z0-9_])/);
      const authors = m ? bracedArg(code, m.index + m[0].length)[0] : '';
      const plain = authors.replace(/\\[A-Za-z@]+|[{}\\]/g, ' ');
      if (authors && !ANON_NAMES.test(authors) && plain.trim()) checks.push(row('authors', 'fail', L2('作者信息', 'Authors'), L2('审稿版里 \\author 写了真实信息', '\\author has real names in the review version'), [L2(cut(plain.trim(), 200))]));
      else checks.push(row('authors', 'ok', L2('作者信息', 'Authors'), L2('作者是匿名或占位符', 'anonymous or placeholder authors')));
      const th = hits(/\\thanks\s*\{/);
      checks.push(row('thanks', th.length ? 'fail' : 'ok', L2('脚注致谢 \\thanks', 'Footnote \\thanks'), th.length ? L2(`找到 ${th.length} 处`, `${th.length} found`) : L2('没有', 'none'), th));
      const ack = hits(ACK_RE);
      checks.push(row('ack', ack.length ? 'fail' : 'ok', L2('致谢段落', 'Acknowledgements'), ack.length ? L2('审稿版不应有致谢（会暴露基金和单位）', 'no acknowledgements in a review version (they reveal funding and affiliations)') : L2('没有', 'none'), ack));
      const ln = hits(ACCOUNT_RE);
      checks.push(row('links', ln.length ? 'warn' : 'ok', L2('个人主页 / 代码仓库链接', 'Personal or repository links'), ln.length ? L2('这些链接可能指向你的账号，审稿版请换成匿名链接（如 anonymous.4open.science）', 'these may point to your accounts; use anonymous links (e.g. anonymous.4open.science)') : L2('没有', 'none'), ln));
      const sc = hits(SELF_CITE_RE);
      checks.push(row('self-cite', sc.length ? 'warn' : 'ok', L2('「我们之前的工作」', '"Our previous work"'), sc.length ? L2('用第三人称引用自己的工作', 'cite your own work in the third person') : L2('没有', 'none'), sc));
      const pa = hits(/pdfauthor\s*=/);
      if (pa.length) checks.push(row('pdfauthor', 'fail', L2('hyperref 的 pdfauthor', 'hyperref pdfauthor'), L2('会把名字写进 PDF 元数据', 'writes names into the PDF metadata'), pa));
      if (pdfAuthor !== undefined) {
        const a = String(pdfAuthor || '').trim();
        if (a && !ANON_NAMES.test(a)) checks.push(row('pdf-meta', 'fail', L2('PDF 元数据', 'PDF metadata'), L2(`PDF 的「作者」字段写着「${a}」，审稿人能看到`, `the PDF author field says "${a}"; reviewers can see it`)));
        else checks.push(row('pdf-meta', 'ok', L2('PDF 元数据', 'PDF metadata'), L2('PDF 的作者字段里没有名字', 'no name in the PDF author field')));
      }
    }
    const summary = venue && blind ? L2(`${venue} 模板，${why[0]}：按双盲审稿检查`, `${venue} template, ${why[1]}: checked for double-blind review`)
      : venue ? L2(`${venue} 模板，${why[0]}：不需要匿名`, `${venue} template, ${why[1]}: no anonymity needed`)
      : L2('没认出会议模板，不需要匿名检查', 'no conference template recognised: no anonymity check');
    return { kind: 'blind', venue, doubleBlind: blind, summary, checks };
  }

  // ── 编译日志 ──────────────────────────────────────────────────────────
  const HINTS = [
    [/Undefined control sequence/, L2('用了没定义的命令：拼写错了，或者少加载了宏包', 'an undefined command: a typo, or a missing package')],
    [/Missing \$ inserted/, L2('数学符号写在了正文里：给公式加上 $...$', 'maths in running text: wrap it in $...$')],
    [/Missing \\begin\{document\}/, L2('导言区有正文内容或乱码', 'text or garbage in the preamble')],
    [/Missing \} inserted|Extra \}|Too many \}'s/, L2('花括号没配对', 'unbalanced braces')],
    [/Environment (\S+) undefined/, L2('这个环境没定义：少加载了宏包', 'undefined environment: a missing package')],
    [/File [`'](.+?)[`'] not found/, L2('缺文件', 'missing file')],
    [/Misplaced alignment tab character &/, L2('& 用在了表格外：正文里写 \\&', '& outside a table: write \\& in text')],
    [/Illegal unit of measure/, L2('长度缺单位（如 0.5 应写 0.5\\linewidth 或 3pt）', 'a length without a unit (write 0.5\\linewidth or 3pt)')],
    [/There's no line here to end/, L2('\\\\ 用在了段落开头或空行后', '\\\\ at the start of a paragraph or after a blank line')],
    [/Float\(s\) lost/, L2('浮动体放在了不允许的位置（如 minipage 里放 figure）', 'a float where floats are not allowed (e.g. a figure in a minipage)')],
    [/Unicode character (.+?) \(U\+/, L2('有 pdfLaTeX 不支持的字符（中文、特殊符号）：换成 LaTeX 命令或改用 XeLaTeX', 'a character pdfLaTeX cannot typeset (Chinese, symbols): use a LaTeX command or XeLaTeX')],
    [/Emergency stop/, L2('编译中断', 'compilation stopped')],
    [/Dimension too large/, L2('尺寸太大，常见于图片缩放或 pgfplots 数据', 'dimension too large: often image scaling or pgfplots data')],
  ];
  const hintFor = (msg) => (HINTS.find(([re]) => re.test(msg)) || [null, L2('', '')])[1];
  function unwrapLog(log) { const out = []; for (const line of splitLines(log)) { out.push(line); if ([...line].length !== 79) out.push('\n'); } return out.join(''); }
  function parseLog(log0, main = 'main.tex') {
    const log = unwrapLog(log0);
    const errors = [], warnings = [], seen = new Set();
    for (const m of log.matchAll(/^(\.?\/?[^\s:]+\.(?:tex|sty|cls|bbl)):(\d+):\s*(.+)$/gm)) {
      const msg = m[3].trim(), key = `${m[1]}\u0000${m[2]}\u0000${msg}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({ file: m[1].replace(/^[./]+/, ''), line: Number(m[2]), message: msg, hint: hintFor(msg) });
    }
    for (const m of log.matchAll(/^! (.+)$/gm)) {
      const msg = m[1].trim();
      if (errors.some((e) => e.message === msg)) continue;
      const tail = log.slice(m.index + m[0].length, m.index + m[0].length + 600);
      const ln = tail.match(/^l\.(\d+)/m);
      errors.push({ file: main, line: ln ? Number(ln[1]) : null, message: msg, hint: hintFor(msg) });
    }
    const uniq = (re) => [...new Set([...log.matchAll(re)].map((m) => m[1]))].sort();
    const over = [...log.matchAll(/Overfull \\hbox \(([\d.]+)pt/g)].map((m) => Number(m[1]));
    for (const m of log.matchAll(/^(?:LaTeX|Package (\S+)|Class (\S+)) Warning:\s*(.+)$/gm)) {
      const w = m[3].trim();
      if (w.includes('Citation') || w.includes('Reference') || w.includes('Label(s) may have changed')) continue;
      warnings.push(w.slice(0, 200));
    }
    return { errors, undefinedCitations: uniq(/Citation [`']([^`']+)[`'] (?:on page \d+ )?undefined/g), undefinedReferences: uniq(/Reference [`']([^`']+)[`'] (?:on page \d+ )?undefined/g), missingFiles: uniq(/File [`']([^`']+\.(?:sty|cls|bst|bbx|cbx|def|cfg|fd|tex))[`'] not found/g), overfull: over.length, bigOverfull: over.filter((x) => x > 10).length, warnings: [...new Set(warnings)].sort().slice(0, 30) };
  }
  function diagnoseLog(log, main = 'main.tex') {
    const p = parseLog(log, main), checks = [];
    const at = (e) => `${e.file}:${e.line ?? '?'}  ${e.message}`;
    if (p.errors.length) checks.push(row('errors', 'fail', L2('编译错误', 'Compile errors'), L2(`${p.errors.length} 处`, `${p.errors.length}`), p.errors.slice(0, 40).map((e) => L2(at(e) + (e.hint[0] ? `（${e.hint[0]}）` : ''), at(e) + (e.hint[1] ? ` (${e.hint[1]})` : '')))));
    else checks.push(row('errors', 'ok', L2('编译错误', 'Compile errors'), L2('没有', 'none')));
    if (p.missingFiles.length) checks.push(row('missing', 'fail', L2('缺少的宏包 / 文件', 'Missing packages / files'), L2(`${p.missingFiles.length} 个`, `${p.missingFiles.length}`), p.missingFiles.map((f) => L2(`${f}：可能是模板自带的文件没放进来，或要用 TeX Live 管理器安装`, `${f}: a template file left out, or install it with the TeX Live manager`))));
    if (p.undefinedCitations.length) checks.push(row('cites', 'fail', L2('未定义的引用', 'Undefined citations'), L2('PDF 里会显示成 [?]，.bib 里缺这些条目', 'they show as [?]; the .bib lacks these entries'), p.undefinedCitations.map((x) => L2(x))));
    else checks.push(row('cites', 'ok', L2('未定义的引用', 'Undefined citations'), L2('没有', 'none')));
    if (p.undefinedReferences.length) checks.push(row('refs', 'warn', L2('未定义的交叉引用', 'Undefined references'), L2('PDF 里会显示成 ??，\\ref 的标签不存在', 'they show as ??; the \\ref labels do not exist'), p.undefinedReferences.map((x) => L2(x))));
    else checks.push(row('refs', 'ok', L2('未定义的交叉引用', 'Undefined references'), L2('没有', 'none')));
    if (p.bigOverfull) checks.push(row('overfull', 'warn', L2('超出版心的行', 'Overfull lines'), L2(`${p.overfull} 处 Overfull，其中 ${p.bigOverfull} 处超出 10pt，能明显看到文字伸出页边`, `${p.overfull} overfull boxes, ${p.bigOverfull} over 10 pt: text visibly runs into the margin`)));
    else checks.push(row('overfull', 'ok', L2('超出版心的行', 'Overfull lines'), p.overfull ? L2(`${p.overfull} 处轻微 Overfull，看不出来`, `${p.overfull} slight overfull boxes, not visible`) : L2('没有', 'none')));
    if (p.warnings.length) checks.push(row('warnings', 'warn', L2('其他警告', 'Other warnings'), L2(`${p.warnings.length} 条`, `${p.warnings.length}`), p.warnings.map((x) => L2(x))));
    return { kind: 'diagnose', checks, parsed: p };
  }

  // ── arXiv 打包（浏览器版）──────────────────────────────────────────────
  // files: { 路径: string | Uint8Array }。不能编译，所以：主文档和 .tex 删注释，可选合并 \input，查 \includegraphics 的图在不在、
  // 用了 \bibliography 时有没有 .bbl（arXiv 不跑 BibTeX），算大小。
  const GRAPHIC_EXT = ['', '.pdf', '.png', '.jpg', '.jpeg', '.eps'];
  function arxivPackage(files, main = 'main.tex', opts = {}) {
    const text = (k) => (typeof files[k] === 'string' ? files[k] : '');
    const texFiles = Object.fromEntries(Object.entries(files).filter(([k, v]) => typeof v === 'string' && /\.tex$/i.test(k)));
    const out = { ...files }, checks = [], commentsAll = [];
    let merged = [];
    if (opts.mergeInputs) {
      const r = mergeInputs(text(main), texFiles);
      out[main] = r.text;
      merged = r.merged;
      for (const m of merged) delete out[m];
    }
    for (const [k, v] of Object.entries(out)) {
      if (typeof v !== 'string' || !/\.(tex|tikz|pgf|ltx|inc)$/i.test(k)) continue;
      const s = stripComments(v);
      for (const c of s.comments) commentsAll.push({ ...c, file: k });
      if (!opts.keepComments) out[k] = s.text;
    }
    // 不进包：编译出来的文件、.bib（有 .bbl 就够了）、隐藏文件
    for (const k of Object.keys(out)) if (/\.(aux|log|out|toc|lof|lot|fls|fdb_latexmk|synctex\.gz|blg|bcf|run\.xml)$/i.test(k) || /(^|\/)\./.test(k)) delete out[k];
    // 主文档编译出的 PDF 不要
    delete out[main.replace(/\.tex$/i, '.pdf')];
    const allCode = Object.entries(out).filter(([k, v]) => typeof v === 'string' && /\.tex$/i.test(k)).map(([, v]) => codeLines(v).map(([, c]) => c).join('\n')).join('\n');
    const missing = [];
    for (const m of allCode.matchAll(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)) {
      const g = normPath(m[1].trim());
      if (g && !GRAPHIC_EXT.some((e) => (g + e) in out)) missing.push(m[1].trim());
    }
    const usesBib = /\\(?:bibliography\s*\{|printbibliography\b)/.test(allCode);
    const bbl = main.replace(/\.tex$/i, '.bbl');
    const hasBbl = bbl in out;
    if (hasBbl) for (const k of Object.keys(out)) if (/\.bib$/i.test(k)) delete out[k];
    const size = (v) => (typeof v === 'string' ? new TextEncoder().encode(v).length : v.length);
    const sizes = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, size(v)]));
    const total = Object.values(sizes).reduce((a, b) => a + b, 0);
    const figures = Object.keys(out).filter((k) => /\.(pdf|png|jpe?g|eps|ps|svg|gif|tiff?|mps)$/i.test(k));
    if (missing.length) checks.push(row('figures', 'fail', L2('图片和输入文件', 'Figures and inputs'), L2(`有 ${missing.length} 个文件找不到`, `${missing.length} files not found`), [...new Set(missing)].map((x) => L2(x))));
    else checks.push(row('figures', 'ok', L2('图片和输入文件', 'Figures and inputs'), L2(`${figures.length} 张图片、${Object.keys(out).length} 个文件都在包里`, `${figures.length} figures and ${Object.keys(out).length} files in the package`)));
    if (!usesBib) checks.push(row('bibliography', 'ok', L2('参考文献', 'Bibliography'), L2('论文没有用 BibTeX，不需要 .bbl', 'no BibTeX, so no .bbl needed')));
    else if (hasBbl) checks.push(row('bibliography', 'ok', L2('参考文献', 'Bibliography'), L2(`已带上 ${bbl}（arXiv 不运行 BibTeX）`, `${bbl} included (arXiv does not run BibTeX)`)));
    else checks.push(row('bibliography', 'fail', L2('参考文献', 'Bibliography'), L2(`论文用了 \\bibliography，但没有 ${bbl}，arXiv 上参考文献会是空的：在 Overleaf 编译后从“日志和输出文件”里下载 ${bbl}，加进来再打包`, `the paper uses \\bibliography but has no ${bbl}, so arXiv will show no references: compile in Overleaf, download ${bbl} from "Logs and output files", add it and package again`)));
    checks.push(row('compile', 'warn', L2('单独编译', 'Stand-alone compile'), L2('浏览器里不能编译：在 Overleaf 上传这个压缩包编译一次，确认能单独编出来', 'the browser cannot compile: upload this zip to Overleaf once to check it builds on its own')));
    const todos = commentsAll.filter((c) => c.todo);
    const list = (todos.length ? todos : commentsAll).slice(0, 50).map((c) => L2(`${c.file}:${c.line}  ${c.text}`));
    if (opts.keepComments) checks.push(row('comments', commentsAll.length ? 'warn' : 'ok', L2('注释', 'Comments'), commentsAll.length ? L2(`保留了 ${commentsAll.length} 条 % 注释，arXiv 会公开它们` + (todos.length ? `，其中 ${todos.length} 条 TODO` : ''), `kept ${commentsAll.length} % comments; arXiv makes them public` + (todos.length ? `, ${todos.length} of them TODO` : '')) : L2('没有注释', 'no comments'), list));
    else checks.push(row('comments', todos.length ? 'warn' : 'ok', L2('注释', 'Comments'), commentsAll.length ? L2(`已删掉 ${commentsAll.length} 条 % 注释` + (todos.length ? `，其中 ${todos.length} 条是 TODO，确认都处理完了` : ''), `removed ${commentsAll.length} % comments` + (todos.length ? `; ${todos.length} were TODO, make sure they are done` : '')) : L2('没有注释', 'no comments'), list));
    const LIMIT = 50e6;
    checks.push(total > LIMIT ? row('size', 'fail', L2('大小', 'Size'), L2(`${(total / 1e6).toFixed(1)} MB，超过 arXiv 的 50 MB 上限`, `${(total / 1e6).toFixed(1)} MB, over arXiv's 50 MB limit`)) : row('size', 'ok', L2('大小', 'Size'), L2(`${(total / 1e6).toFixed(2)} MB（上限 50 MB）`, `${(total / 1e6).toFixed(2)} MB (limit 50 MB)`)));
    if (merged.length) checks.push(row('merged', 'ok', L2('合并输入文件', 'Merged inputs'), L2(`已把 ${merged.length} 个 \\input 文件并进主文档`, `merged ${merged.length} \\input files into the main document`), merged.map((x) => L2(x))));
    return { kind: 'arxiv', files: out, sizes, total, checks, blocked: checks.some((c) => c.state === 'fail') };
  }

  // ── 摘要的七个要素（_diagnose_abstract_fields，不调用模型）──────────────
  function abstractFields(abstractText) {
    const txt = words(abstractText).join(' ');
    const low = txt.toLowerCase();
    const sents = txt.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const checks = [
      ['task', L2('研究任务 / 问题域', 'Task / problem'), /\b(task|problem|predict|estimat|reconstruct|generat|optimiz|simulat|detect|classify|benchmark|model|study)\b/.test(low) || sents.length >= 1, sents.length ? cut(sents[0], 110) : '', L2('首句清晰点明具体任务场景，避免泛泛背景开篇。', 'Open with the concrete task, not general background.')],
      ['prior_approach', L2('现有主流方法 / 前人工作', 'Prior approach'), /\b(existing|prior|previous|conventional|traditional|current|recent|rely on|standard)\b/.test(low), '', L2('点明具体主流方法类别（而非笼统写 \'existing work\'）。', "Name the specific class of methods, not just 'existing work'.")],
      ['concrete_gap_and_cause', L2('具体缺口及其原因', 'Concrete gap and its cause'), /\b(however|but|fail|suffer|limit|bottleneck|costly|slow|struggle|cannot|inaccurate|unable)\b/.test(low) && /\b(because|since|due to|when|under|as |since)\b/.test(low), '', L2('补充现有方法在什么条件下失效、以及背后的机制原因。', 'Say when the current methods fail and why.')],
      ['key_insight', L2('核心洞察 (Key Insight)', 'Key insight'), /\b(observ|insight|key idea|leverag|exploit|posit|show that|reveal|crucial)\b/.test(low), '', L2('用一句话直白说出从问题本质推导出的核心洞察。', 'State the key insight plainly in one sentence.')],
      ['method_mechanism', L2('方法核心机制', 'Method mechanism'), /\b(we (?:propose|present|introduce|develop)|our (?:method|framework|approach|model)|consists of|architecture|algorithm|via )\b/.test(low), '', L2('写清组件之间如何因果衔接（而非并排罗列模块名）。', 'Explain how the parts connect causally, not a list of module names.')],
      ['headline_numbers', L2('头条定量结果', 'Headline numbers'), /\d+(?:\.\d+)?\s*(?:%|x|×|dB|FPS|ms|s\b|fold)|\b(?:outperform|reduc|improv|achiev)\w*[^.]{0,40}\d/.test(low), '', L2('保留 1–2 个最核心的头条数字支撑主张，其余留给正文表格。', 'Keep one or two headline numbers; leave the rest to tables.')],
      ['closest_work', L2('对比基线 / 最近工作定位', 'Closest work / baseline'), /\b(compar|outperform|surpass|over |baseline|state-of-the-art|sota|strongest)\b/.test(low), '', L2('点明与最相近强基线的一个可核查差异。', 'Give one checkable difference from the strongest close baseline.')],
    ];
    return checks.map(([key, label, ok, ev0, sug]) => {
      let status = ok ? 'present' : 'missing';
      if (key === 'concrete_gap_and_cause' && !ok && /\b(however|but|fail|limit|costly|slow)\b/.test(low)) status = 'vague';
      if (key === 'headline_numbers' && !ok && /\b\d+(?:\.\d+)?\b/.test(txt)) status = 'vague';
      let ev = ev0;
      if (!ev && ok) {
        for (const s of sents) {
          if (key === 'headline_numbers' && /\d/.test(s)) { ev = cut(s, 110); break; }
          if (key === 'concrete_gap_and_cause' && /\b(however|but|fail|limit)\b/.test(s.toLowerCase())) { ev = cut(s, 110); break; }
          if (key === 'method_mechanism' && /\b(propose|present|introduce|our )\b/.test(s.toLowerCase())) { ev = cut(s, 110); break; }
        }
      }
      return { field: key, label, status, evidence: ev, suggestion: status === 'present' ? L2('', '') : sug };
    });
  }
  /** 从 LaTeX 里取摘要和引言（润色摘要用）。 */
  function abstractAndIntro(tex) {
    const a = abstractBlock(tex), i = introBlock(tex);
    return { abstract: a ? cleanProse(a).trim() : '', intro: i ? cleanProse(i).trim() : '' };
  }

  const pure = {
    commentStart, stripComments, codeLines, mergeInputs, bracedArg, splitSentences, cleanProse, introBlock, proseNumbers, syntactic, auditTextDraft,
    bodyLines, abstractBlock, manuscriptAudit, detectVenue, blindCheck, parseLog, diagnoseLog, unwrapLog, arxivPackage, abstractFields, abstractAndIntro, mostlyCJK, normPath,
  };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaPaperAudit = pure;
})(typeof self !== 'undefined' ? self : this);
