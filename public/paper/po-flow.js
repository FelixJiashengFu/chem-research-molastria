/* 论文工坊的流水线（po-flow.js）：没有 DOM，模型调用和学术检索由调用方传进来，tools/paper-test.mjs 用假的模型和检索整条跑一遍。
   照 PaperOrchestra Studio（Apache-2.0）的 methods/paper_writer_with_plotting.py 和五个智能体：
     ① 大纲（OutlineAgent）→ ② 找文献并写引言与相关工作（HybridLiteratureAgent 的学术接口路线）和 ③ 画图（同时进行）
     → ④ 写其余各节（SectionWritingAgent）→ ⑤ 审稿与修改（ContentRefinementAgent + AgentReview 审稿），
   每一步的提示词拼法和原版一样（提示词原文在 po-prompts.js）。和原版不同的地方（浏览器里做不到的）：
   · 原版先编译成 PDF 再审稿、修改时把 PDF 也交给模型；这里审稿人读的是 LaTeX 源码，修改时只给源码；
   · 原版的画图由图像模型和代码执行完成；这里让模型给出“图的规格”（数据只能来自实验记录），浏览器画成 PNG；
   · 原版找到候选题目后再到 Semantic Scholar 逐条补全；这里直接用检索结果里的信息，缺摘要的才按题目再查一次。
   ctx 里的 llm(task, { system, prompt, temperature, images, label }) 返回模型回答的文字；
   search(source, query, n, cutoff) 返回 po-core 的 normalize() 整理过的条目；lookup(title, cutoff) 返回一条或 null。 */
(function (root) {
  'use strict';
  const P = typeof module === 'object' && module.exports ? require('./po-core.js') : root.MolAstriaPaper;
  const PROMPTS = typeof module === 'object' && module.exports ? require('./po-prompts.js') : root.MOLASTRIA_PAPER_PROMPTS;

  // ── Python 的 json.dumps ──────────────────────────────────────────────
  /** 数字照 Python 写：整数（小于 1e16）照写，其余按 float 的 repr（指数在 -4 到 16 之外时写成 1e-07、1.5e+21）。
      JS 分不出 3 和 3.0，整数一律当 int。 */
  function pyNumber(x) {
    if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : x < 0 ? '-Infinity' : 'NaN';
    if (Number.isInteger(x) && Math.abs(x) < 1e16) return Object.is(x, -0) ? '0' : String(x);
    const [mant, ex] = x.toExponential().split('e');
    const e = Number(ex);
    if (e < -4 || e >= 16) return `${mant}e${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
    return String(x);
  }
  /** json.dumps(v, indent=None|n, ensure_ascii=True|False)：不缩进时分隔符是 ", " 和 ": "。
      floats：这些键的值在 Python 里是 float（整数值也写成 0.0），JS 分不出来，只能由调用方说明。 */
  function pyJSON(v, { indent = null, ascii = true, floats = [] } = {}) {
    const floatKeys = new Set(floats);
    const asc = (s) => (ascii ? s.replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) : s);
    const str = (s) => asc(JSON.stringify(s));
    const pad = (d) => (indent == null ? '' : '\n' + ' '.repeat(indent * d));
    const walk = (x, d, key) => {
      if (x === null || x === undefined) return 'null';
      if (typeof x === 'string') return str(x);
      if (typeof x === 'number') return floatKeys.has(key) && Number.isInteger(x) && Math.abs(x) < 1e16 ? `${pyNumber(x)}.0` : pyNumber(x);
      if (typeof x === 'boolean') return x ? 'true' : 'false';
      if (Array.isArray(x)) {
        if (!x.length) return '[]';
        return '[' + x.map((y) => pad(d + 1) + walk(y, d + 1)).join(indent == null ? ', ' : ',') + pad(d) + ']';
      }
      const ks = Object.keys(x).filter((k) => x[k] !== undefined);
      if (!ks.length) return '{}';
      return '{' + ks.map((k) => pad(d + 1) + str(k) + ': ' + walk(x[k], d + 1, k)).join(indent == null ? ', ' : ',') + pad(d) + '}';
    };
    return walk(v, 0);
  }
  /** Python 的 s[:n]：按码点截，不会把一个表情字符切成两半。 */
  const pySlice = (s, n) => { const t = String(s ?? ''); return t.length <= n ? t : Array.from(t).slice(0, n).join(''); };
  /** Python 用文本方式读文件时把 \r\n 和 \r 都换成 \n（universal newlines）；浏览器里读进来的文件先照样换。 */
  const pyText = (s) => String(s ?? '').replace(/\r\n?/g, '\n');
  const hasBench = (b) => !!b && typeof b === 'object' && Object.keys(b).length > 0;
  /** po-prompts.js 里 f-string 的代入：parts 是 [{t}|{x}]，env 按 Python 表达式的源码给值；缺一个就报错（原版改了写法时测试会发现）。 */
  function render(parts, env) {
    return parts.map((p) => {
      if ('t' in p) return p.t;
      if (!(p.x in env)) throw new Error(`prompt-expr:${p.x}`);
      const v = env[p.x];
      return typeof v === 'number' ? String(v) : v;
    }).join('');
  }
  const pyNum = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));

  // ── 每一步的提示词（和原版一样拼）──────────────────────────────────────
  function outlineMessages(c) {
    return {
      system: P.fill(PROMPTS.outline, { cutoff_date: c.cutoff }) + P.venueNote(c.venue, 'outline'),
      prompt: ["'idea.md':\n" + c.idea, "'experimental_log.md':\n" + c.log, "'template.tex':\n" + c.templateTex, c.guidelines].join('\n\n'),
    };
  }
  function queryMessages(task, coreProblem, cutoff) {
    return { prompt: render(PROMPTS.queryGeneration, { "task.get('search_type', 'open')": task.type || 'open', "task['focus']": task.focus, "task['context']": task.context, core_problem: coreProblem, cutoff_date: cutoff }), temperature: 0.2 };
  }
  function relevanceMessages(idea, problem, listing) {
    return { prompt: P.fill(PROMPTS.relevance, { idea: String(idea || '').slice(0, 6000) || '(not provided)', problem: String(problem || '(not provided)').slice(0, 2000), candidates: pyJSON(listing, { indent: 1, ascii: false }) }), temperature: 0 };
  }
  /** PaperData.model_dump() 的字段和顺序。 */
  const dump = (p) => ({ citation_key: p.key, title: p.title, authors: p.authors, venue: p.venue || 'arXiv', year: p.year, abstract: p.abstract, citation_count: p.citations || 0, found_in_section: p.section, reason: p.reason || '', journal: p.journal || null, volume: p.volume || null, pages: p.pages || null, publication_date: p.date || null });
  function literatureMessages(c, outline, papers) {
    const payload = { 'template.tex': c.templateTex, intro_related_work_plan: outline.intro_related_work_plan || {}, project_idea: c.idea, project_experimental_log: c.log, citation_checklist: papers.map((p) => p.key), collected_papers: papers.map(dump) };
    const task = c.venue ? 'Generate the LaTeX for the Introduction section, which carries the related-work discussion (template.tex has no Related Work section).' : 'Generate the LaTeX for Introduction and Related Work sections.';
    return { system: P.fill(PROMPTS.literature, { paper_count: papers.length, min_cite_paper_count: Math.floor(papers.length * 0.9), cutoff_date: c.cutoff }) + P.venueNote(c.venue, 'literature'), prompt: task + '\n\n' + pyJSON(payload) };
  }
  /** section_writing_agent 的 _format_citation_library（作者只列前三位）。 */
  function citationLibrary(map) {
    const entries = Object.entries(map || {});
    if (!entries.length) return 'No citation data provided.';
    let s = '### REFERENCE LIBRARY (Use these keys for \\cite{})\n';
    for (const [key, d] of entries) {
      const list = d.authors || [];
      let authors = list.slice(0, 3).join(', ');
      if (list.length > 3) authors += ' et al.';
      s += `--- Key: ${key} ---\nTitle: ${d.title ?? 'Unknown Title'}\nAuthors: ${authors} (${d.year ?? 'N/A'})\nAbstract: ${d.abstract ?? 'No abstract available.'}\n\n`;
    }
    return s;
  }
  const figName = (n, i) => { let name = n || `figure_${i}.jpg`; if (name && !/\.(png|jpg|pdf)$/.test(name)) name += '.png'; return name; };
  function figuresContext(figs) {
    if (!figs?.length) return 'No figures provided.';
    let s = '### AVAILABLE FIGURES LIST\n';
    figs.forEach((f, i) => { s += `Item ${i + 1}:\n  - Filename: ${figName(f.name, i + 1)}\n  - Caption: ${f.caption ?? 'No caption provided.'}\n--------------------------------------------------\n`; });
    return s;
  }
  function sectionMessages(c, outlineText, citationMap, figures, templateTex) {
    const prompt = `
Here are the input materials for the paper.

--- INPUT: outline.json (Structure & Citation Candidates) ---
${outlineText}

--- INPUT: citation_map.json (Reference Library) ---
${citationLibrary(citationMap)}

--- INPUT: idea.md (Technical Method Details) ---
${c.idea}

--- INPUT: experimental_log.md (Raw Data for Tables) ---
${c.log}

--- INPUT: figures_list (Available Figure Files) ---
${figuresContext(figures)}

--- INPUT: conference_guidelines.md ---
${c.guidelines}

--- INPUT: template.tex (DO NOT CHANGE EXISTING TEXT. FILL MISSING SECTIONS.) ---
${templateTex}

**INSTRUCTION**:
1. Identify missing sections in \`template.tex\`.
2. Generate LaTeX content for those sections based on \`outline.json\`.
3. Construct tables using data from \`experimental_log.md\`.
4. Insert figures using the filenames from the 'figures_list' input.
5. Use citations from the Reference Library.
6. Return the **full** compilable LaTeX file.
`;
    return { system: PROMPTS.sectionWriting + P.venueNote(c.venue, 'writing'), prompt, temperature: 0.7 };
  }
  function reviewMessages(c, text) {
    return { system: P.reviewerSystem(PROMPTS.reviewScores) + P.venueNote(c.venue, 'review'), prompt: PROMPTS.reviewInstructions + `\nHere is the paper you are asked to review:\n\`\`\`\n${text}\n\`\`\``, temperature: 0.75 };
  }
  function metaMessages(c, reviews) {
    let t = '';
    reviews.forEach((r, i) => { t += `\nReview ${i + 1}/${reviews.length}:\n\`\`\`\n${pyJSON(r)}\n\`\`\`\n`; });
    return { system: P.fill(PROMPTS.metaReviewer, { reviewer_count: reviews.length }) + P.venueNote(c.venue, 'meta_review'), prompt: PROMPTS.reviewInstructions + t, temperature: 0.75 };
  }
  function refineMessages(c, i, worklogs, score, review, citationMapText, tex) {
    const prev = Object.keys(worklogs).length ? pyJSON(worklogs, { indent: 4 }) : 'None';
    const prompt = `
REFLECTION ITERATION ${i + 1}.

--- PREVIOUS ITERATION LOG ---
${prev}

--- CURRENT REVIEWER FEEDBACK (Score: ${pyNum(score)}) ---
${pyJSON(review, { indent: 2 })}

--- CONFERENCE GUIDELINES ---
${c.guidelines}

--- EXPERIMENTAL LOG (Data Truth) ---
${c.log}

--- CITATION MAP (Reference Truth) ---
${citationMapText}

--- CURRENT LATEX SOURCE ---
${tex}

INSTRUCTION:
1. Your goal is to IMPROVE the reviewer score (Current: ${pyNum(score)}).
2. Address the 'Weaknesses' and 'Questions' in the Reviewer Feedback above.
3. Output the JSON Worklog first, then the Full Revised LaTeX.
`;
    return { system: PROMPTS.refinement + P.venueNote(c.venue, 'refinement'), prompt };
  }
  /** 画图：这一段提示词是 MolAstria 自己写的（原版用图像模型和代码执行，浏览器里没有）。 */
  function chartMessages(c, plan) {
    const style = c.venue ? [c.venue.figure_style || '', 'Publication figure discipline (Nature-style): clean Arial/Helvetica sans-serif typography (5-8 pt at final print size), zero overlapping labels, explicit axis labels with SI units, colorblind-safe Okabe-Ito or viridis palette (never rainbow or red-green contrast), lowercase bold panel tags (a, b, c) for multi-panel layouts, and white background.'].filter(Boolean).join('\n') : '';
    const prompt = `You turn one planned figure of a research paper into a chart specification that a plotting program draws.

PLANNED FIGURE (from outline.json):
${JSON.stringify(plan, null, 2)}

experimental_log.md (the ONLY allowed source of numbers):
${c.log}

RULES:
1. Every number in "series" must appear in experimental_log.md. Never invent, interpolate, round differently or estimate a value. If the log does not hold the data this figure needs, return {"skip": true, "reason": "..."}.
2. Pick the simplest honest chart: "line" (ordered x such as time, temperature, size), "scatter" (x-y pairs), "bar" (categories) or "hbar" (long category names). No pie, radar or 3-D charts.
3. Axis labels carry units, e.g. "Temperature (K)". Use log scale only when values span more than two orders of magnitude.
4. Error bars only when the log gives them; put them in "err" with the same length as "y".
5. The caption starts with a one-sentence finding in bold-worthy form, then says what is plotted, the sample size or number of runs if the log gives it, and what error bars mean.
${style ? `6. Venue figure style:\n${style}\n` : ''}
Return only JSON in a \`\`\`json block:
{"type": "line|scatter|bar|hbar", "title": "...", "xLabel": "...", "yLabel": "...", "logX": false, "logY": false,
 "categories": ["only for bar/hbar"], "series": [{"name": "...", "x": [..numbers, omit for bar..], "y": [..], "err": [..optional..]}],
 "caption": "..."}`;
    return { prompt, temperature: 0.2 };
  }
  /** LaTeX 助手：选中几行或整个文件（latex_copilot.cmd_edit）。lines 从 1 数，包含两端。 */
  /** Python 的 str.splitlines(keepends=True)：\r\n、\r、\n 以外，\v \f \x1c–\x1e \x85 \u2028 \u2029 也算换行。 */
  const LB = '\\n\\r\\v\\f\\x1c\\x1d\\x1e\\x85\\u2028\\u2029';
  const LINES_KEEP = new RegExp(`[^${LB}]*(?:\\r\\n|[${LB}])|[^${LB}]+$`, 'g');
  const splitKeep = (s) => String(s || '').match(LINES_KEEP) || [];
  /** str.splitlines()：不带换行符。 */
  const splitLines = (s) => splitKeep(s).map((l) => l.replace(new RegExp(`(?:\\r\\n|[${LB}])$`), ''));
  /** latex_copilot.cmd_edit：sel 是 { start, end }（从 1 数的行号）；返回提示词、apply(回答) → 改好的全文、summary。 */
  function copilotMessages(fileName, source, instruction, sel, errorLog) {
    instruction = String(instruction || '').trim();
    source = pyText(source);
    const lines = splitKeep(source);
    const scoped = sel && sel.start != null && sel.end != null && sel.start >= 1 && sel.start <= sel.end && sel.end <= lines.length;
    const errHint = errorLog ? `\nCompiler error log context:\n${pySlice(errorLog, 3000)}\n` : '';
    if (scoped) {
      const env = { instruction, err_hint: errHint, ctx_before: lines.slice(Math.max(0, sel.start - 15), sel.start - 1).join(''), sel_start: sel.start, sel_end: sel.end, target_slice: lines.slice(sel.start - 1, sel.end).join(''), ctx_after: lines.slice(sel.end, Math.min(lines.length, sel.end + 15)).join('') };
      return { scoped: true, summary: [`已修改第 ${sel.start}-${sel.end} 行：${instruction}`, `Edited lines ${sel.start}-${sel.end}: ${instruction}`], system: PROMPTS.copilotSystem, prompt: render(PROMPTS.copilotScoped, env), apply(reply) {
        let rep = stripTexFences(reply);
        if (rep && !rep.endsWith('\n') && env.target_slice.endsWith('\n')) rep += '\n';
        return lines.slice(0, sel.start - 1).join('') + rep + lines.slice(sel.end).join('');
      } };
    }
    return { scoped: false, summary: [`已按指令生成修订稿：${instruction}`, `Revised the file: ${instruction}`], system: PROMPTS.copilotSystem, prompt: render(PROMPTS.copilotWhole, { instruction, err_hint: errHint, 'os.path.basename(tex_path)': fileName, original: source }), apply(reply) {
      let rev = stripTexFences(reply);
      if (!rev.trim()) throw new Error('empty-latex');
      if (source.endsWith('\n') && !rev.endsWith('\n')) rev += '\n';
      return rev;
    } };
  }
  function stripTexFences(raw) { const t = String(raw || '').trim(); const m = t.match(/```(?:latex|tex)?\s*\n([\s\S]*?)\n```/i); return m ? m[1] : t; }
  const AUDIT_FLOATS = ['participleTailRatio', 'antithesisRatio', 'connectorPer100w']; // submission_tools.audit_text_draft 里是 round(…) 或 0.0
  /** latex_copilot.cmd_polish_abstract 的改写：beforeAudit 是 po-audit.js 的 auditTextDraft（问题是 [中, 英]，原版只有中文那句）。 */
  function polishMessages(abs, intro, beforeAudit) {
    abs = String(abs || '').trim(); intro = String(intro || '').trim();
    const audit = { ...beforeAudit, issues: (beforeAudit?.issues || []).map((x) => (Array.isArray(x) ? x[0] : x)) };
    const env = { abs_raw: abs, "f'Current Introduction Context (read-only):\\n{intro_raw[:2500]}\\n\\n' if intro_raw else ''": intro ? `Current Introduction Context (read-only):\n${pySlice(intro, 2500)}\n\n` : '', 'json.dumps(before_audit, ensure_ascii=False)': pyJSON(audit, { ascii: false, floats: AUDIT_FLOATS }) };
    return { system: PROMPTS.polishSystem, prompt: render(PROMPTS.polishAbstract, env) };
  }

  // ── 科研工坊的五个 SOP（research_studio.cmd_run_sop）────────────────────
  const SOP_IDS = ['paper_reading', 'lit_review', 'topic_ideation', 'reproduction', 'math_modeling'];
  /** o: { topic, notes, prefs, attached（附件的文字）, manifest（附件清单）, pool（来源池）, extra, bench }。 */
  function sopMessages(sop, o) {
    const prefsMd = String(o.prefs || '').trim();
    const prefs = prefsMd ? `\n\n### Persistent Research Preferences & Long-Term Memory\n${prefsMd}\n` : '';
    const att = o.attached || '', pool = o.pool || [], extra = o.extra || {};
    const topic = String(o.topic || '').trim();
    const env = { notes: String(o.notes || '').trim(), prefs_block: prefs, topic };
    env["topic or '全面精读'"] = topic || '全面精读';
    env["topic or 'Literature Synthesis'"] = topic || 'Literature Synthesis';
    for (const n of [72000, 10000, 14000, 60000, 16000]) env[`attached_text[:${n}]`] = pySlice(att, n);
    env['len(lit_pool)'] = pool.length;
    env["json.dumps([{'idx': i + 1, **{k: v for k, v in p.items() if k != 'bibtex'}} for i, p in enumerate(lit_pool)], ensure_ascii=False, indent=2)[:28000]"] = pySlice(pyJSON(pool.map((p, i) => { const { bibtex, ...rest } = p; return { idx: i + 1, ...rest }; }), { indent: 2, ascii: false }), 28000);
    env["json.dumps([{'idx': i + 1, 'title': p['title'], 'year': p['year'], 'venue': p['venue'], 'readDepth': p['readDepth'], 'abstract': p['abstract'][:400]} for i, p in enumerate(lit_pool)], ensure_ascii=False, indent=2)[:16000]"] = pySlice(pyJSON(pool.map((p, i) => ({ idx: i + 1, title: p.title, year: p.year, venue: p.venue, readDepth: p.readDepth, abstract: pySlice(p.abstract || '', 400) })), { indent: 2, ascii: false }), 16000);
    env.timeframe = extra.timeframe || '2-3 周';
    env.discipline = extra.discipline || '';
    env.equipment = extra.equipment || '';
    env.target_level = extra.targetLevel || '重新实现核心算法并用可控/替代基准定量验证';
    env.repo_url = extra.repoUrl || '';
    env['json.dumps(resource_manifest, ensure_ascii=False, indent=2)'] = pyJSON(o.manifest || [], { indent: 2, ascii: false });
    env["json.dumps(bench, ensure_ascii=False, indent=2) if bench else 'No tabular CSV/XLSX data uploaded yet — design the exact modeling formulation and testable benchmark pipeline clearly.'"] = hasBench(o.bench) ? pyJSON(o.bench, { indent: 2, ascii: false }) : 'No tabular CSV/XLSX data uploaded yet — design the exact modeling formulation and testable benchmark pipeline clearly.';
    return { system: PROMPTS.sopSystem, prompt: render(PROMPTS.sop[sop], env) };
  }
  /** SOP 推荐交给写论文的模板，和写论文的交接内容（workspace_handoff.json）。 */
  function sopHandoff(sop, o, report) {
    const extra = o.extra || {};
    const template = sop === 'lit_review' ? (extra.language === 'zh' ? 'journal-chinese-gb7714' : 'journal-nature') : sop === 'math_modeling' ? (extra.contest === 'cumcm' ? 'math-modeling-cumcm' : 'math-modeling-mcm') : 'journal-nature';
    let log = report;
    if (hasBench(o.bench)) log += `\n\n## Verified Computational Benchmark JSON\n\`\`\`json\n${pyJSON(o.bench, { indent: 2, ascii: false })}\n\`\`\`\n`;
    return { title: (o.topic || '').slice(0, 80) || `Research Studio - ${sop}`, recommendedTemplate: template, ideaMarkdown: `# Topic & Research Scope\n${o.topic || sop}\n\n${o.notes || ''}\n`, experimentalLogMarkdown: log };
  }
  /** 来源池里的一条（_gather_lit_context 的字段）。 */
  function poolItem(p, readDepth = 'abstract_only') {
    return { title: p.title, authors: (p.authors || []).join(', '), year: p.year, venue: p.venue || '', doi: p.doi || '', url: p.url || '', abstract: String(p.abstract || '').slice(0, 900), notes: p.notes || '', readDepth, gb7714: gb7714(p), bibtex: p.bibtex || '' };
  }
  /** GB/T 7714-2015 的著录（期刊 [J]、会议 [C]、预印本 [EB/OL]）。作者超过三位写前三位加“等”或 et al.。 */
  function gb7714(p) {
    const au = (p.authors || []).map((a) => {
      if (/[\u3400-\u9fff]/.test(a)) return a;
      const parts = String(a).trim().split(/\s+/);
      if (parts.length < 2) return a.toUpperCase();
      const last = parts.pop().toUpperCase();
      return `${last} ${parts.map((x) => x[0].toUpperCase()).join(' ')}`;
    });
    const cjk = (p.authors || []).some((a) => /[\u3400-\u9fff]/.test(a));
    const names = au.length > 3 ? `${au.slice(0, 3).join(', ')}, ${cjk ? '等' : 'et al'}` : au.join(', ');
    const arxiv = /arxiv/i.test(p.venue || '') || (p.arxiv && !p.journal);
    const kind = arxiv ? 'EB/OL' : p.journal ? 'J' : 'C';
    let s = `${names || 'Anon'}. ${p.title}[${kind}]. `;
    if (arxiv) s += `arXiv${p.arxiv ? ': ' + p.arxiv : ''}, ${p.year || ''}`;
    else s += `${p.journal || p.venue || ''}, ${p.year || ''}${p.volume ? `, ${p.volume}` : ''}${p.pages ? `: ${String(p.pages).replace('--', '-')}` : ''}`;
    s += '.';
    if (p.doi) s += ` DOI: ${p.doi}.`;
    return s.replace(/\s+/g, ' ').replace(/ ,/g, ',');
  }

  // ── 流水线的五步 ───────────────────────────────────────────────────────
  const stepIds = ['outline', 'literature', 'plots', 'sections', 'refine'];
  /** 一组任务按并发上限跑（找文献时不要一下子打几十个请求）。 */
  async function pool(items, limit, fn, signal) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => { while (next < items.length) { if (signal?.aborted) throw new DOMException('aborted', 'AbortError'); const i = next++; out[i] = await fn(items[i], i); } };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  async function stepOutline(c) {
    const m = outlineMessages(c);
    const text = await c.llm('outline', { ...m, label: 'outline' });
    const outline = P.extractJSON(text);
    const problems = P.checkOutline(outline);
    if (!outline || problems.includes('not-object')) throw Object.assign(new Error('outline-json'), { raw: text });
    return { outline, problems };
  }

  /** 找文献：每个检索任务 → 模型给检索词 → 各家学术接口 → 候选 → 去重、截止日期、要有摘要 → 筛掉无关的 → 引用键、BibTeX → 写回大纲 → 写引言与相关工作。 */
  async function stepLiterature(c, outline) {
    const log = c.log_ || (() => {});
    const tasks = P.searchTasks(outline);
    const strategy = outline?.intro_related_work_plan?.introduction_strategy || {};
    const core = strategy.problem_gap_hypothesis || '';
    const registry = new Map();
    const sources = c.sources || ['s2', 'openalex', 'crossref', 'arxiv'];
    const seenTask = new Set();
    const uniqueTasks = tasks.filter((t) => { const id = `${t.section}:${t.focus}`; if (seenTask.has(id)) return false; seenTask.add(id); return true; });
    log({ kind: 'tasks', n: uniqueTasks.length });
    const found = await pool(uniqueTasks, c.concurrency || 3, async (task) => {
      let queries = [task.focus], titles = [];
      try {
        const reply = await c.llm('literature_query', { ...queryMessages(task, core, c.cutoff), label: 'query' });
        const j = P.extractJSON(reply);
        if (j && typeof j === 'object') {
          const q = (j.queries || []).filter((x) => typeof x === 'string' && x.trim());
          if (q.length) queries = q;
          titles = (j.likely_titles || []).filter((x) => typeof x === 'string' && x.trim());
        }
      } catch (e) { if (e?.name === 'AbortError') throw e; log({ kind: 'query-fallback', task: task.focus, error: String(e?.message || e) }); }
      const cands = [], seen = new Set();
      const add = (hit, reason) => { const k = (hit.title || '').trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); cands.push({ ...hit, reason }); } };
      if (c.lookup) for (const t of titles.slice(0, 3)) { const hit = await c.lookup(t, c.cutoff).catch(() => null); if (hit?.title) add(hit, `Targeted ${hit.source || 'scholar'} match for ${task.focus}`); }
      for (const q of queries.slice(0, 2)) {
        for (const src of sources) {
          if (cands.length >= 4 && src !== sources[0]) break;
          const hits = await c.search(src, q, 6, c.cutoff).catch((e) => { log({ kind: 'search-error', source: src, error: String(e?.message || e) }); return []; });
          for (const h of hits) add(h, `${P.SCHOLAR[src]?.label || src} match for query: ${q}`);
        }
      }
      return { task, cands: cands.slice(0, task.type === 'targeted' ? 1 : 12) };
    }, c.signal);
    for (const { task, cands } of found) {
      for (const cand of cands) {
        const nk = P.normKey(cand.title);
        if (!nk || registry.has(nk)) continue;
        let rec = cand;
        if (!rec.abstract && c.lookup) { const more = await c.lookup(cand.title, c.cutoff).catch(() => null); if (more?.abstract && P.similarity(more.title, cand.title) >= 0.9) rec = { ...more, reason: cand.reason }; }
        if (!P.allowedByCutoff(rec, c.cutoff) || !rec.abstract) continue;
        const nk2 = P.normKey(rec.title);
        if (registry.has(nk2)) continue;
        registry.set(nk2, { ...rec, abstract: P.trimAbstract(rec.abstract), venue: rec.venue || 'arXiv', section: task.section, key: P.citeKey(rec.authors, rec.year, rec.title) });
      }
    }
    log({ kind: 'found', n: registry.size });
    // 筛掉明显无关的（_screen_relevance：保守，只删模型点名的；一批全被点名时整批留下；出错全留下）
    const dropped = [];
    if (c.relevance !== false) {
      const entries = [...registry.entries()].filter(([, p]) => !String(p.reason || '').startsWith('Targeted '));
      if (entries.length >= 2) {
        const nb = Math.ceil(entries.length / 30), size = Math.ceil(entries.length / nb);
        for (let s = 0; s < entries.length; s += size) {
          const batch = entries.slice(s, s + size);
          const listing = batch.map(([, p], i) => ({ id: i, title: p.title, year: p.year, venue: p.venue, abstract: String(p.abstract || '').slice(0, 700), section: p.section, found_by: String(p.reason || '').slice(0, 200) }));
          let verdicts;
          try { verdicts = P.extractJSON(await c.llm('relevance_screen', { ...relevanceMessages(c.idea, core, listing), label: 'relevance' }))?.irrelevant; } catch (e) { if (e?.name === 'AbortError') throw e; continue; }
          if (!Array.isArray(verdicts)) continue;
          const flagged = new Map();
          for (const v of verdicts) {
            if (!v || typeof v !== 'object') continue;
            const i = Number.parseInt(v.id, 10);
            if (!Number.isInteger(i)) continue;
            const why = String(v.reason || '').trim();
            if (['short reason', '<why it is off-topic>', 'why it is off-topic'].includes(why.toLowerCase().replace(/^[<>"' .]+|[<>"' .]+$/g, ''))) continue;
            if (i >= 0 && i < batch.length) flagged.set(i, why.slice(0, 160));
          }
          if (flagged.size && flagged.size >= batch.length) continue;
          for (const [i, why] of [...flagged].sort((a, b) => a[0] - b[0])) dropped.push({ key: batch[i][0], title: batch[i][1].title, why });
        }
        for (const d of dropped) registry.delete(d.key);
      }
    }
    const papers = P.uniqueKeys([...registry.values()]);
    const bib = P.bibtex(papers), cmap = P.citationMap(papers), meta = P.referencesMeta(papers);
    const outlineV1 = P.injectCitations(outline, papers);
    const m = literatureMessages(c, outlineV1, papers);
    const reply = await c.llm('literature_write', { ...m, label: 'literature' });
    const tex = parseLatex(reply);
    return { papers, dropped, bib, citationMap: cmap, meta, outline: outlineV1, templateTex: tex || c.templateTex, wroteIntro: !!tex };
  }
  /** parse_gemini_latex_results：```latex 块，没有就整段。 */
  function parseLatex(reply) { const m = String(reply || '').trim().match(/```latex\s*([\s\S]*?)\s*```/); return m ? m[1] : P.extractLatex(reply) || String(reply || ''); }

  /** 画图：plotting_plan 里 plot_type 是 plot 的每一张。示意图（diagram）不画，留给作者上传。 */
  async function stepPlots(c, outline) {
    const plan = (outline.plotting_plan || []).filter((f) => f && f.figure_id);
    const out = await pool(plan, 2, async (f) => {
      if (f.plot_type !== 'plot') return { id: f.figure_id, plan: f, skipped: 'diagram' };
      try {
        const spec = P.extractJSON(await c.llm('plot_code', { ...chartMessages(c, f), label: `figure:${f.figure_id}` }));
        if (!spec || spec.skip) return { id: f.figure_id, plan: f, skipped: spec?.reason || 'no-data' };
        const problems = P.checkChart(spec);
        if (problems.length) return { id: f.figure_id, plan: f, skipped: 'bad-spec', problems, spec };
        return { id: f.figure_id, plan: f, spec, unverified: P.unverifiedNumbers(spec, c.log) };
      } catch (e) { if (e?.name === 'AbortError') throw e; return { id: f.figure_id, plan: f, skipped: 'error', error: String(e?.message || e) }; }
    }, c.signal);
    return out;
  }

  async function stepSections(c, outlineV1, citationMap, figures, templateTex) {
    const m = sectionMessages(c, pyJSON(outlineV1, { indent: 4 }), citationMap, figures.map((f) => ({ name: f.name, caption: f.caption })), templateTex);
    const images = figures.filter((f) => f.image).map((f) => f.image);
    const reply = await c.llm('section_writing', { ...m, images, label: 'sections' });
    const tex = parseLatex(reply);
    return { tex, complete: P.latexComplete(tex) };
  }

  /** 一次审稿：几份独立审稿 + 元审稿，分数取平均（perform_review_agentreview）。失败返回 { Error }。 */
  async function review(c, text, n = 3) {
    const m = reviewMessages(c, text);
    const reviews = [];
    for (let i = 0; i < n; i++) {
      const r = P.extractJSON(await c.llm('peer_review', { ...m, label: `review ${i + 1}/${n}` }));
      if (r && typeof r === 'object') reviews.push(r);
    }
    if (!reviews.length) return { Error: 'no-review', Overall: 0 };
    if (n === 1) return reviews[0];
    let meta = null;
    try { meta = P.extractJSON(await c.llm('peer_review', { ...metaMessages(c, reviews), label: 'meta-review' })); } catch (e) { if (e?.name === 'AbortError') throw e; }
    return P.mergeReviews(meta && typeof meta === 'object' ? meta : null, reviews);
  }
  async function reviewWithRetry(c, text, n) {
    let r;
    try { r = await review(c, text, n); } catch (e) { if (e?.name === 'AbortError') throw e; r = { Error: String(e?.message || e), Overall: 0 }; }
    if ('Error' in r) { try { r = await review(c, text, n); } catch (e) { if (e?.name === 'AbortError') throw e; r = { Error: String(e?.message || e), Overall: 0 }; } }
    return r;
  }
  /** 审稿与修改（ContentRefinementAgent.run 的内容修改部分）。onRound 每轮回调一次，界面用它画进度。 */
  async function stepRefine(c, tex0, citationMap) {
    const rounds = c.maxRounds ?? 3, n = c.reviewers ?? 3;
    const cmText = pyJSON(citationMap || {}, { indent: 4 });
    let tex = tex0;
    let current = await reviewWithRetry(c, tex, n);
    const initial = current;
    const worklogs = {}, versions = [{ v: 0, tex, review: current }];
    c.onRound?.({ v: 0, review: current });
    for (let i = 0; i < rounds; i++) {
      if (c.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const score = Number.parseFloat(current.Overall) || 0;
      const reply = await c.llm('content_refinement', { ...refineMessages(c, i, worklogs, score, current, cmText, tex), label: `refine v${i + 1}` });
      const plan = P.extractJSON(reply);
      const newTex = parseLatexStrict(reply);
      if (!newTex) { worklogs[`v${i + 1}`] = { round: i + 1, agent_plan: plan, outcome: 'NO_LATEX' }; break; }
      const nr = await reviewWithRetry(c, newTex, n);
      versions.push({ v: i + 1, tex: newTex, review: nr, plan });
      if ('Error' in nr && !('Error' in current)) {
        worklogs[`v${i + 1}`] = { round: i + 1, agent_plan: plan, scores_before: P.scores(current), review_error: String(nr.Error), unreviewed_revision: `refined_paper_v${i + 1}.tex`, outcome: 'REVIEW_FAILED_KEPT_PREVIOUS' };
        c.onRound?.({ v: i + 1, review: nr, outcome: 'REVIEW_FAILED_KEPT_PREVIOUS' });
        break;
      }
      const d = P.decide(current, nr);
      worklogs[`v${i + 1}`] = { round: i + 1, agent_plan: plan, scores_before: d.before, scores_after: d.after, deltas: d.deltas, total_gain: d.gain, total_drop: d.drop, outcome: d.outcome };
      c.onRound?.({ v: i + 1, review: nr, outcome: d.outcome, deltas: d.deltas });
      if (d.accept) { tex = newTex; current = nr; }
      if (d.stop) break;
    }
    return { tex, review: current, initial, worklogs, versions };
  }
  /** parse_gemini_json_latex_response 的 LaTeX 部分。 */
  function parseLatexStrict(reply) { const m = String(reply || '').match(/```latex\s*([\s\S]*?)\s*```/); if (m) return m[1]; const x = P.extractLatex(reply); return x && /\\documentclass|\\section/.test(x) ? x : ''; }

  const pure = {
    pyJSON, pyNumber, pySlice, pyText, splitKeep, splitLines, render, outlineMessages, queryMessages, relevanceMessages, literatureMessages, citationLibrary, figuresContext, sectionMessages, reviewMessages, metaMessages, refineMessages, chartMessages, copilotMessages, polishMessages, stripTexFences,
    SOP_IDS, sopMessages, sopHandoff, poolItem, gb7714, stepIds, pool, stepOutline, stepLiterature, stepPlots, stepSections, review, reviewWithRetry, stepRefine, parseLatex, parseLatexStrict,
  };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaPaperFlow = pure;
})(typeof self !== 'undefined' ? self : this);
