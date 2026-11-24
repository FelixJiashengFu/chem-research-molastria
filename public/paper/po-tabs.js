/* 论文工坊的三个标签（po-tabs.js）：科研工坊、投稿体检、LaTeX 助手。往 window.MOLASTRIA_PO_TABS 里登记 { id, n, zh, en, build(A, panel) }，
   A 是 po-app.js 给的公共工具（元素、模型调用、检索、读文件、导出……）。
   · 科研工坊：PaperOrchestra Studio 的 research_studio 五个 SOP（论文精读、文献综述、选题、复现、数学建模），报告可以交给“写论文”；
   · 投稿体检：submission_tools 的稿件体检、双盲、编译日志、引用核对（离线 + 联网逐条）、摘要七要素、arXiv 打包；
   · LaTeX 助手：latex_copilot 的按指令改写（整篇或选几行，先看改动再决定要不要）和摘要的诊断与逐句改写。
   页面文字自带中英两版（整页 translate="no"）。 */
(function () {
  'use strict';
  const TABS = (window.MOLASTRIA_PO_TABS = window.MOLASTRIA_PO_TABS || []);

  // ── 科研工坊 ──────────────────────────────────────────────────────────
  const SOPS = {
    paper_reading: ['论文精读', 'Close reading', '附上一篇论文（PDF / LaTeX / Markdown），得到逐节精读：问题、方法、证据、局限、可以复现和延伸的地方。', 'Attach one paper (PDF / LaTeX / Markdown) for a section-by-section reading: problem, method, evidence, limits, what to reproduce and extend.'],
    lit_review: ['文献综述', 'Literature review', '写一个主题，从下面的检索里挑文献放进来源池（也可以附上 PDF），得到带引用的综述。', 'Give a topic, add papers to the source pool from the search below (or attach PDFs), and get a cited review.'],
    topic_ideation: ['选题', 'Topic ideas', '写方向、学科和条件，得到几个可做的选题、各自的风险和第一步。', 'Describe the direction, discipline and resources for a few feasible topics, their risks and first steps.'],
    reproduction: ['复现', 'Reproduction', '附上论文和代码仓库地址，得到复现计划：环境、数据、每一步怎么核对、预期偏差。', 'Attach the paper and the code repository for a reproduction plan: environment, data, checks per step, expected deviations.'],
    math_modeling: ['数学建模', 'Mathematical modelling', '附上题目和数据（CSV），浏览器先跑三个基准模型（线性、二次、岭回归），再写建模方案。', 'Attach the problem and data (CSV); the browser first runs three baseline models (linear, quadratic, ridge), then the model writes a modelling plan.'],
  };
  TABS.push({ id: 'studio', n: 2, zh: '科研工坊', en: 'Research studio', build(A, panel) {
    const { h, L, P, W, btn, field, sel, card, pre, status } = A;
    const st = { pool: [], files: [], bench: null };
    const sopSel = sel(Object.entries(SOPS).map(([k, v]) => [k, L(v[0], v[1])]), A.prefs.sop || 'paper_reading', { 'aria-label': L('任务', 'Task') });
    const sopNote = h('p', { class: 'po-small' });
    const topicIn = h('input', { type: 'text', placeholder: L('主题或研究问题', 'Topic or research question') });
    const notesIn = h('textarea', { rows: 4, placeholder: L('补充说明（可选）：你关心什么、已经知道什么。', 'Notes (optional): what you care about, what you already know.') });
    const prefsIn = h('textarea', { rows: 3, placeholder: L('长期偏好（可选，存在这台设备）：例如“用 SI 单位”“偏计算化学”。每次都会带上。', 'Standing preferences (optional, kept on this device), e.g. “SI units”, “computational chemistry”. Sent every time.') });
    prefsIn.value = A.prefs.studioPrefs || '';
    prefsIn.addEventListener('change', () => A.savePrefs({ studioPrefs: prefsIn.value }));
    const ex = {
      timeframe: h('input', { type: 'text', placeholder: L('2-3 周', '2-3 weeks') }), discipline: h('input', { type: 'text', placeholder: L('例如 计算化学', 'e.g. computational chemistry') }),
      equipment: h('input', { type: 'text', placeholder: L('例如 一块 24 GB 显卡', 'e.g. one 24 GB GPU') }), targetLevel: h('input', { type: 'text', placeholder: L('重新实现核心算法并定量验证', 'reimplement the core and verify quantitatively') }),
      repoUrl: h('input', { type: 'url', placeholder: 'https://github.com/…' }),
      language: A.sel([['en', 'English'], ['zh', L('中文（GB/T 7714）', 'Chinese (GB/T 7714)')]], 'en'), contest: A.sel([['mcm', L('美赛 MCM / ICM', 'MCM / ICM')], ['cumcm', L('国赛 CUMCM', 'CUMCM')]], 'mcm'),
    };
    const exRow = h('div', { class: 'po-row' });
    const SHOW = { paper_reading: [], lit_review: ['language'], topic_ideation: ['discipline', 'timeframe', 'equipment'], reproduction: ['repoUrl', 'timeframe', 'equipment', 'targetLevel'], math_modeling: ['contest', 'timeframe'] };
    const EXL = { timeframe: ['时间', 'Time frame'], discipline: ['学科', 'Discipline'], equipment: ['条件 / 设备', 'Resources'], targetLevel: ['复现到什么程度', 'Target level'], repoUrl: ['代码仓库', 'Code repository'], language: ['综述语言', 'Review language'], contest: ['竞赛', 'Contest'] };
    const fileList = h('div', { class: 'po-files' });
    const fst = h('p', { class: 'po-status', 'aria-live': 'polite' });
    const benchBox = h('div', {});
    const drawFiles = () => fileList.replaceChildren(...st.files.map((f, i) => h('span', { class: 'po-chip' }, h('span', { text: `${f.name} · ${A.fmtK(f.text.length)} ${L('字符', 'chars')}` }), h('button', { type: 'button', 'aria-label': L(`去掉 ${f.name}`, `Remove ${f.name}`), onclick: () => { st.files.splice(i, 1); drawFiles(); } }, '×'))));
    const filesBox = A.fileBox({ multiple: true, accept: '.pdf,.tex,.md,.txt,.docx,.pptx,.csv,.tsv,.json,.py,.ipynb', title: L('附件：论文、讲义、数据、代码', 'Attachments: papers, notes, data, code'), hint: L('PDF、Word、LaTeX、Markdown、CSV……只在你的浏览器里读成文字', 'PDF, Word, LaTeX, Markdown, CSV… read into text in your browser only'), onFiles: async (files) => {
      for (const f of files) {
        try {
          const d = await A.readText(f);
          const sha = await A.sha16(await f.arrayBuffer());
          st.files.push({ name: d.name, text: d.text, size: f.size, sha, kind: d.kind });
          if (/\.(csv|tsv)$/i.test(f.name)) { st.bench = P.mathBenchmark(P.parseCSV(d.text), f.name); drawBench(); }
        } catch (e) { status(fst, String(e?.message || e), 'bad'); }
      }
      drawFiles();
    } });
    function drawBench() {
      benchBox.replaceChildren();
      if (!st.bench) return;
      const b = st.bench;
      benchBox.append(h('h3', { class: 'po-h3', text: L(`数据基准：${b.dataset}（目标列 ${b.targetColumn}，训练 ${b.trainRows} 行 / 测试 ${b.testRows} 行）`, `Data baseline: ${b.dataset} (target ${b.targetColumn}, ${b.trainRows} train / ${b.testRows} test rows)`) }),
        h('div', { class: 'po-table' }, h('table', {}, h('thead', {}, h('tr', {}, [L('模型', 'Model'), 'MAE', 'RMSE', 'MAPE %', 'R²'].map((x) => h('th', { text: x })))),
          h('tbody', {}, Object.entries(b.models || {}).map(([k, m]) => h('tr', {}, h('td', { text: k }), ['MAE', 'RMSE', 'MAPE_pct', 'R2'].map((x) => h('td', { class: 'num', text: String(m[x] ?? '—') }))))))),
        h('p', { class: 'po-small', text: L('照原版的 numpy 基准移植，数字和 Python 跑的一样（tools/paper-test.mjs 核对过）。只用前 80% 训练、后 20% 测试，不打乱。', 'Ported from the original numpy baseline; the numbers match Python (checked by tools/paper-test.mjs). First 80 % train, last 20 % test, no shuffling.') }));
    }
    // 来源池
    const qIn = h('input', { type: 'search', placeholder: L('检索文献：关键词或题目', 'Search literature: keywords or a title') });
    const srcSel = sel(A.SOURCES.map((s) => [s, P.SCHOLAR[s].label]), 'openalex', { 'aria-label': L('数据库', 'Database') });
    const hits = h('div', {}), poolBox = h('div', {}), qst = h('p', { class: 'po-status', 'aria-live': 'polite' });
    const paperLine = (p, action) => h('div', { class: 'po-ck', 'data-state': 'ok' }, h('b', { text: p.title }), h('p', { text: [p.authors.slice(0, 3).join(', ') + (p.authors.length > 3 ? ' et al.' : ''), p.year, p.venue].filter(Boolean).join(' · ') }), h('div', { class: 'po-row' }, action, p.url ? A.extLink(p.url, L('打开', 'Open')) : null));
    function drawPool() {
      poolBox.replaceChildren(h('h3', { class: 'po-h3', text: L(`来源池（${st.pool.length} 篇）`, `Source pool (${st.pool.length})`) }),
        ...st.pool.map((p, i) => paperLine(p, btn(L('移出', 'Remove'), () => { st.pool.splice(i, 1); drawPool(); }, 'small'))));
    }
    async function doSearch() {
      const q = qIn.value.trim();
      if (!q) return;
      status(qst, L('正在检索…', 'Searching…'));
      try {
        const r = await A.search(srcSel.value, q, 10, '');
        hits.replaceChildren(...r.map((p) => paperLine(p, btn(L('加入来源池', 'Add to pool'), (e) => { if (!st.pool.some((x) => P.normKey(x.title) === P.normKey(p.title))) { st.pool.push(p); drawPool(); } e.target.disabled = true; }, 'small'))));
        status(qst, r.length ? L(`${r.length} 条结果`, `${r.length} results`) : L('没有结果', 'No results'), r.length ? '' : 'warn');
      } catch (e) { status(qst, String(e?.message || e), 'bad'); }
    }
    qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    const drawSop = () => {
      const k = sopSel.value;
      sopNote.textContent = L(SOPS[k][2], SOPS[k][3]);
      exRow.replaceChildren(...SHOW[k].map((x) => field(L(...EXL[x]), ex[x], 'grow')));
      A.savePrefs({ sop: k });
    };
    sopSel.addEventListener('change', drawSop);
    // 运行
    const runBtn = btn(L('开始', 'Run'), () => run(), 'primary');
    const stopBtn = btn(L('停止', 'Stop'), () => ctl?.abort(), 'danger', { disabled: true });
    const rst = h('p', { class: 'po-status', 'aria-live': 'polite' });
    const report = h('div', { class: 'po-md' });
    const after = h('div', { class: 'po-row' });
    let ctl = null, last = null;
    function inputs() {
      const k = sopSel.value;
      const att = st.files.map((f) => {
        const excerpt = f.kind === 'pdf' ? W.pySlice(f.text, 80000) : /\.(csv|tsv|json)$/i.test(f.name) ? W.pySlice(f.text, 12000) : W.pySlice(f.text, 40000);
        return `### File: \`${f.name}\` (sha256:${f.sha}..., depth=full_read)\n${excerpt}\n`;
      }).join('\n\n');
      const extra = {};
      for (const x of SHOW[k]) if (ex[x].value.trim()) extra[x] = ex[x].value.trim();
      return { sop: k, o: { topic: topicIn.value, notes: notesIn.value, prefs: prefsIn.value, attached: att, manifest: st.files.map((f) => ({ name: f.name, sizeBytes: f.size, sha256Prefix: f.sha, readDepth: 'full_read' })), pool: st.pool.map((p) => W.poolItem(p)), extra, bench: k === 'math_modeling' ? st.bench : null } };
    }
    async function run() {
      if (ctl) return;
      if (!A.ready()) { status(rst, L('还没有可用的模型：先在“设置”里填一个 API key。', 'No model yet: add an API key under Settings.'), 'bad'); return; }
      const { sop, o } = inputs();
      if (sop === 'paper_reading' && !o.attached) { status(rst, L('论文精读要先附上一篇论文。', 'Attach a paper for close reading first.'), 'bad'); return; }
      if (sop === 'lit_review' && !o.pool.length && !o.attached) { status(rst, L('文献综述要先往来源池里加文献，或者附上论文。', 'Add papers to the source pool, or attach papers, first.'), 'bad'); return; }
      if (!String(o.topic).trim() && !o.attached && sop !== 'paper_reading') { status(rst, L('先写主题。', 'Write a topic first.'), 'bad'); return; }
      ctl = new AbortController();
      runBtn.disabled = true; stopBtn.disabled = false; after.replaceChildren();
      status(rst, L('模型在写…', 'The model is writing…'));
      try {
        const m = W.sopMessages(sop, o);
        let lastDraw = 0;
        const text = await A.llm('studio', { ...m, label: sop, signal: ctl.signal, step: 'studio', onText: (t) => { if (performance.now() - lastDraw > 400) { lastDraw = performance.now(); A.renderMarkdown(report, t); } } });
        A.renderMarkdown(report, text);
        last = { sop, o, text };
        status(rst, L('写好了。报告是模型写的，引用和数字要自己核对。', 'Done. The report is model-written; check its citations and numbers.'));
        after.append(btn(L('下载 report.md', 'Download report.md'), () => A.download(`${A.safeName(o.topic || sop)}.md`, text), 'small'),
          btn(L('复制', 'Copy'), (e) => A.copyText(text, e.target), 'small'),
          btn(L('交给“写论文”', 'Hand over to “Write a paper”'), () => { A.go('write'); A.emit('handoff', W.sopHandoff(sop, o, text)); }, 'small'));
      } catch (e) { status(rst, A.explain(e), e?.name === 'AbortError' ? 'warn' : 'bad'); }
      finally { ctl = null; runBtn.disabled = false; stopBtn.disabled = true; }
    }
    panel.append(h('div', { class: 'po-grid' },
      h('div', {},
        card(L('任务', 'Task'), h('div', { class: 'po-row' }, field(L('做什么', 'What to do'), sopSel, 'grow')), sopNote,
          h('div', { class: 'po-row' }, field(L('主题', 'Topic'), topicIn, 'full')), exRow,
          h('h3', { class: 'po-h3', text: L('补充说明', 'Notes') }), notesIn,
          h('h3', { class: 'po-h3', text: L('长期偏好', 'Standing preferences') }), prefsIn),
        card(L('附件', 'Attachments'), filesBox, fileList, fst, benchBox)),
      card(L('来源池', 'Source pool'), h('div', { class: 'po-row' }, field(L('检索', 'Search'), qIn, 'grow'), field(L('数据库', 'Database'), srcSel, 'm'), btn(L('检索', 'Search'), doSearch)), qst, hits, poolBox)),
    card(L('报告', 'Report'), h('div', { class: 'po-row' }, runBtn, stopBtn), rst, report, after));
    drawSop(); drawPool();
  } });

  // ── 投稿体检 ──────────────────────────────────────────────────────────
  TABS.push({ id: 'audit', n: 3, zh: '投稿体检', en: 'Submission check', build(A, panel) {
    const { h, L, T, P, AU, btn, field, sel, card, status } = A;
    const files = {}; // 名字 → 文字或 Uint8Array
    let pdf = null;
    const fileList = h('div', { class: 'po-files' });
    const fst = h('p', { class: 'po-status', 'aria-live': 'polite' });
    const mainSel = h('select', { 'aria-label': L('主文档', 'Main document') });
    const pasteIn = h('textarea', { rows: 8, class: 'mono', spellcheck: 'false', placeholder: L('或者直接把 main.tex 贴在这里', 'or paste main.tex here') });
    const bibIn = h('textarea', { rows: 4, class: 'mono', spellcheck: 'false', placeholder: L('references.bib（可选）', 'references.bib (optional)') });
    const logIn = h('textarea', { rows: 4, class: 'mono', spellcheck: 'false', placeholder: L('编译日志 main.log（可选，从 Overleaf 的“日志和输出文件”里复制）', 'Compile log main.log (optional; copy it from Overleaf’s “Logs and output files”)') });
    const venueSel = sel([['', L('自动判断', 'Detect automatically')], ...A.TEMPLATES.filter((t) => t.venue).map((t) => [t.id, L(t.zh, t.en)])], '', { 'aria-label': L('期刊要求', 'Venue') });
    const BIN = /\.(pdf|png|jpe?g|eps|gif|tiff?|svg)$/i;
    const drawFiles = () => {
      fileList.replaceChildren(...Object.keys(files).map((n) => h('span', { class: 'po-chip' }, h('span', { text: n }), h('button', { type: 'button', 'aria-label': L(`去掉 ${n}`, `Remove ${n}`), onclick: () => { delete files[n]; if (pdf?.name === n) pdf = null; drawFiles(); } }, '×'))));
      const texs = Object.keys(files).filter((n) => /\.tex$/i.test(n));
      const keep = mainSel.value;
      mainSel.replaceChildren(...texs.map((n) => h('option', { value: n, text: n })));
      mainSel.value = texs.includes(keep) ? keep : texs.find((n) => /\\documentclass/.test(files[n])) || texs[0] || '';
      pasteIn.hidden = !!texs.length;
    };
    const box = A.fileBox({ multiple: true, accept: '.tex,.bib,.bbl,.log,.sty,.cls,.bst,.pdf,.png,.jpg,.jpeg,.eps', title: L('把论文的文件拖进来：.tex、.bib、.bbl、.log、图、编译好的 PDF', 'Drop the paper’s files: .tex, .bib, .bbl, .log, figures, the compiled PDF'), hint: L('只在你的浏览器里检查，不上传', 'Checked in your browser only, nothing is uploaded'), onFiles: async (list) => {
      for (const f of list) {
        try {
          if (BIN.test(f.name)) { files[f.name] = new Uint8Array(await f.arrayBuffer()); if (/\.pdf$/i.test(f.name)) pdf = f; }
          else {
            const t = A.W.pyText(await f.text());
            if (/\.bib$/i.test(f.name)) bibIn.value = bibIn.value ? `${bibIn.value}\n${t}` : t;
            if (/\.log$/i.test(f.name)) logIn.value = t;
            files[f.name] = t;
          }
        } catch { status(fst, L(`${f.name} 读不出来`, `Could not read ${f.name}`), 'bad'); }
      }
      drawFiles();
    } });
    const texts = () => Object.fromEntries(Object.entries(files).filter(([, v]) => typeof v === 'string'));
    function merged() {
      const main = mainSel.value;
      if (!main) return { name: 'main.tex', tex: A.W.pyText(pasteIn.value) };
      const r = AU.mergeInputs(files[main], Object.fromEntries(Object.entries(texts()).filter(([n]) => /\.tex$/i.test(n))));
      return { name: main, tex: r.text };
    }
    const out = h('div', {});
    const section = (title, ...kids) => h('div', { class: 'po-card' }, h('h2', { class: 'po-h2', text: title }), ...kids);
    async function runAll() {
      const { name, tex } = merged();
      out.replaceChildren();
      if (!tex.trim()) { out.append(h('p', { class: 'po-status', 'data-bad': 'true', text: L('先放进 .tex 文件，或者贴上 main.tex。', 'Add a .tex file or paste main.tex first.') })); return; }
      const tpl = A.TEMPLATES.find((t) => t.id === venueSel.value);
      const ms = AU.manuscriptAudit(tex, tpl?.venue || null);
      out.append(section(L('稿件体检', 'Manuscript check'), h('p', { class: 'po-p', text: T(ms.summary) }), A.renderChecks(ms.checks)));
      let author;
      if (pdf) { try { author = await A.pdfAuthor(pdf); } catch { author = undefined; } }
      const bl = AU.blindCheck(tex, author);
      out.append(section(L('双盲', 'Double-blind'), h('p', { class: 'po-p', text: T(bl.summary) }), A.renderChecks(bl.checks), pdf && author === undefined ? h('p', { class: 'po-small', text: L('PDF 阅读器没有载入，PDF 的作者字段没查。', 'The PDF reader did not load, so the PDF author field was not checked.') }) : null));
      if (logIn.value.trim()) { const lg = AU.diagnoseLog(logIn.value, name); out.append(section(L('编译日志', 'Compile log'), A.renderChecks(lg.checks))); }
      const bib = bibIn.value;
      const ca = P.citationAudit(tex, bib);
      const s = ca.summary;
      const online = h('div', {});
      out.append(section(L('引用核对', 'Citations'),
        h('p', { class: 'po-p', text: L(`正文引用 ${s.cited} 个键，.bib 有 ${s.bib_entries} 条（被引用 ${s.in_bibliography} 条），${s.with_doi} 条带 DOI。`, `${s.cited} cited keys; the .bib has ${s.bib_entries} entries (${s.in_bibliography} cited), ${s.with_doi} with a DOI.`) }),
        A.renderChecks([
          { state: ca.missing_in_bib.length ? 'fail' : 'ok', label: [`.bib 里缺的键`, 'Keys missing from the .bib'], detail: [ca.missing_in_bib.length ? `${ca.missing_in_bib.length} 个，PDF 里会显示成 [?]` : '没有', ca.missing_in_bib.length ? `${ca.missing_in_bib.length}; they print as [?]` : 'none'], items: ca.missing_in_bib.map((k) => [k, k]) },
          { state: ca.uncited.length ? 'warn' : 'ok', label: ['没被引用的条目', 'Uncited entries'], detail: [ca.uncited.length ? `${ca.uncited.length} 条（用 natbib / BibTeX 时不会印出来）` : '没有', ca.uncited.length ? `${ca.uncited.length} (BibTeX will not print them)` : 'none'], items: ca.uncited.map((k) => [k, k]) },
        ]),
        h('div', { class: 'po-row' }, btn(L('联网逐条核对文献是不是真的', 'Check online that each reference is real'), () => checkOnline(tex, bib, online), '', { disabled: !ca.entries.length }),
          ca.entries.length ? btn(L('只留被引用的条目，下载 .bib', 'Download a .bib with only the cited entries'), () => A.download('references-cited.bib', P.citedBib(bib, tex)), 'small') : null),
        online));
      const ai = AU.abstractAndIntro(tex);
      if (ai.abstract) {
        const f = AU.abstractFields(ai.abstract), d = AU.auditTextDraft(ai.abstract, 'abstract');
        out.append(section(L('摘要', 'Abstract'),
          h('p', { class: 'po-p', text: L(`七个要素齐了 ${f.filter((x) => x.status === 'present').length} 个；文风问题 ${d.issues.length} 条（${d.metrics.words} 词，${d.metrics.sentences} 句）。`, `${f.filter((x) => x.status === 'present').length} of 7 elements present; ${d.issues.length} style issues (${d.metrics.words} words, ${d.metrics.sentences} sentences).`) }),
          A.renderChecks([...f.map((x) => ({ state: x.status === 'present' ? 'ok' : x.status === 'vague' ? 'warn' : 'fail', label: x.label, detail: x.status === 'present' ? [x.evidence, x.evidence] : x.suggestion })),
            ...(d.issues.length ? [{ state: 'warn', label: ['文风', 'Style'], detail: ['', ''], items: d.issues }] : [])]),
          h('p', { class: 'po-small', text: L('要模型逐句改写，用“LaTeX 助手”里的“改写摘要”。', 'For a sentence-by-sentence rewrite, use “Rewrite the abstract” in the LaTeX copilot.') })));
      }
    }
    async function checkOnline(tex, bib, box) {
      const entries = Object.entries(P.parseBib(bib));
      const cited = new Set(P.citedKeys(tex).keys.map((k) => k.toLowerCase()));
      const list = entries.filter(([k]) => cited.has(k.toLowerCase()) || P.citedKeys(tex).star).slice(0, 120);
      const prog = h('p', { class: 'po-status', 'aria-live': 'polite' });
      const tbody = h('tbody', {});
      box.replaceChildren(prog, h('div', { class: 'po-table' }, h('table', {}, h('thead', {}, h('tr', {}, ['key', L('结论', 'Verdict'), L('说明', 'Notes')].map((x) => h('th', { text: x })))), tbody)));
      const WHERE = ['Crossref', 'OpenAlex', 'Semantic Scholar'];
      const VERD = { verified: ['对得上', 'verified', 'ok'], fix: ['要改', 'fix', 'warn'], mismatch: ['只找到相近的', 'similar only', 'warn'], not_found: ['没找到', 'not found', 'fail'], error: ['没查成', 'error', 'warn'], skipped: ['跳过', 'skipped', 'warn'] };
      let done = 0;
      for (const [key, f] of list) {
        status(prog, L(`核对中 ${done}/${list.length}…（Crossref、OpenAlex、Semantic Scholar 逐条问，比较慢）`, `Checking ${done}/${list.length}… (asking Crossref, OpenAlex and Semantic Scholar one by one)`));
        const title = P.cleanLatexText(f.title || ''), doi = String(f.doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
        const cands = [], fails = [];
        const take = async (label, fn) => { try { for (const c of await fn()) cands.push({ ...c, source: label }); } catch (e) { fails.push(`${label}: ${e?.message || e}`); } };
        if (doi) await take('Crossref', async () => { const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { referrerPolicy: 'no-referrer', credentials: 'omit' }); if (r.status === 404) return []; if (!r.ok) throw new Error(`HTTP ${r.status}`); return P.normalize('crossref', await r.json()).map((x) => ({ ...x, viaDoi: true })); });
        if (title) {
          await take('Crossref', () => A.search('crossref', title, 3, ''));
          await take('OpenAlex', () => A.search('openalex', title, 3, ''));
          if (!cands.some((c) => P.similarity(c.title, title) >= 0.9)) await take('Semantic Scholar', async () => { const hit = await A.lookup(title, ''); return hit ? [hit] : []; });
        }
        const res = P.judgeEntry(key, f, cands, fails, WHERE);
        const v = VERD[res.status] || [res.status, res.status, 'warn'];
        tbody.append(h('tr', {}, h('td', { class: 'mono', text: key }), h('td', {}, A.tag(L(v[0], v[1]), v[2])),
          h('td', {}, [...res.notes, ...res.suggestions].map((n) => h('div', { text: T(n) })), res.found?.url ? A.extLink(res.found.url, res.found.title.slice(0, 80)) : null)));
        done++;
      }
      status(prog, L(`核对完 ${list.length} 条${entries.length > list.length ? `（只核对被引用的${list.length >= 120 ? '前 120 条' : ''}）` : ''}。“没找到”不一定是编的（书、学位论文、很新的文章常查不到），但要人工看一眼。`, `Checked ${list.length}${entries.length > list.length ? ' (cited entries only)' : ''}. “Not found” is not proof of a made-up reference (books, theses and very new papers are often missing), but look at it by hand.`));
    }
    // arXiv 打包
    const mergeChk = A.check(L('把 \\input 的文件并进主文档', 'Merge \\input files into the main document'), false, () => {});
    const keepChk = A.check(L('保留 % 注释（arXiv 会公开它们）', 'Keep % comments (arXiv makes them public)'), false, () => {});
    const pkgOut = h('div', {});
    function pack() {
      const main = mainSel.value;
      const fs = { ...files };
      let mainName = main;
      if (!main) { if (!pasteIn.value.trim()) { pkgOut.replaceChildren(h('p', { class: 'po-status', 'data-bad': 'true', text: L('先放进论文的文件。', 'Add the paper’s files first.') })); return; } mainName = 'main.tex'; fs[mainName] = A.W.pyText(pasteIn.value); if (bibIn.value && !Object.keys(fs).some((n) => /\.bib$/i.test(n))) fs['references.bib'] = bibIn.value; }
      const r = AU.arxivPackage(fs, mainName, { mergeInputs: mergeChk.querySelector('input').checked, keepComments: keepChk.querySelector('input').checked });
      pkgOut.replaceChildren(A.renderChecks(r.checks), h('div', { class: 'po-row' }, btn(L(`下载 arXiv 包（${Object.keys(r.files).length} 个文件）`, `Download the arXiv package (${Object.keys(r.files).length} files)`), () => A.exportZip('arxiv', Object.entries(r.files).map(([name, data]) => ({ name, data }))), r.blocked ? '' : 'primary'),
        r.blocked ? h('span', { class: 'po-small', style: 'margin:0', text: L('有阻塞项：先改，不然 arXiv 上很可能编不过。', 'There are blocking items: fix them first, or arXiv will likely fail to build it.') }) : null));
    }
    A.on('to-audit', (d) => {
      for (const k of Object.keys(files)) delete files[k];
      pdf = null; files['main.tex'] = d.tex; bibIn.value = d.bib || ''; logIn.value = '';
      if (d.bib) files['references.bib'] = d.bib;
      const t = A.TEMPLATES.find((x) => x.id === d.template);
      venueSel.value = t?.venue ? t.id : '';
      drawFiles(); runAll();
    });
    panel.append(
      card(L('论文的文件', 'The paper’s files'), box, fileList, fst,
        h('div', { class: 'po-row' }, field(L('主文档', 'Main document'), mainSel, 'grow'), field(L('按哪家的要求查', 'Check against'), venueSel, 'grow')),
        pasteIn,
        h('details', {}, h('summary', { text: L('.bib 和编译日志', '.bib and compile log') }), h('h3', { class: 'po-h3', text: 'references.bib' }), bibIn, h('h3', { class: 'po-h3', text: L('编译日志', 'Compile log') }), logIn),
        h('div', { class: 'po-row' }, btn(L('检查', 'Check'), runAll, 'primary')),
        h('p', { class: 'po-small', text: L('照 PaperOrchestra Studio 的投稿工具（部分改编自 Lattice 和 Nature-Paper-Skills）。浏览器里不能编译，也不查 PDF 的字体；字数、图表引用、AI 写作痕迹、统计报告、期刊声明、双盲、编译错误、引用都在这里查。', 'Follows PaperOrchestra Studio’s submission tools (partly adapted from Lattice and Nature-Paper-Skills). The browser cannot compile or check PDF fonts; word counts, figure references, AI tells, statistics, statements, anonymity, compile errors and citations are checked here.') })),
      out,
      card(L('arXiv 打包', 'arXiv package'), h('p', { class: 'po-p', text: L('删掉注释、去掉编译出来的文件、查图和 .bbl，打成能直接上传 arXiv 的 zip。', 'Strip comments, drop build files, check figures and the .bbl, and zip it for arXiv.') }),
        h('div', { class: 'po-row' }, mergeChk, keepChk, btn(L('打包', 'Package'), pack)), pkgOut));
    drawFiles();
  } });

  // ── LaTeX 助手 ────────────────────────────────────────────────────────
  TABS.push({ id: 'copilot', n: 4, zh: 'LaTeX 助手', en: 'LaTeX copilot', build(A, panel) {
    const { h, L, T, P, W, AU, btn, field, card, status } = A;
    const nameIn = h('input', { type: 'text', value: 'main.tex', class: 'mono', 'aria-label': L('文件名', 'File name') });
    const src = h('textarea', { rows: 20, class: 'mono', spellcheck: 'false', placeholder: L('把 .tex 贴在这里，或者读一个文件', 'Paste a .tex here, or load a file'), 'aria-label': L('LaTeX 源码', 'LaTeX source') });
    const history = [];
    const undoBtn = btn(L('撤销上一次', 'Undo last change'), () => { if (history.length) { src.value = history.pop(); undoBtn.disabled = !history.length; } }, 'small', { disabled: true });
    const box = A.fileBox({ accept: '.tex,.txt,.md,.bib', title: L('读一个 .tex 文件', 'Load a .tex file'), onFiles: async ([f]) => { src.value = W.pyText(await f.text()); nameIn.value = f.name; } });
    const instr = h('textarea', { rows: 3, placeholder: L('要怎么改，例如“把第二段改得更简洁，不要改数字”“修好编译错误”“把表格改成 booktabs”', 'What to change, e.g. “tighten the second paragraph, keep every number”, “fix the compile error”, “use booktabs for the table”') });
    const fromIn = h('input', { type: 'number', min: 1, step: 1, placeholder: L('整篇', 'whole') }), toIn = h('input', { type: 'number', min: 1, step: 1, placeholder: L('整篇', 'whole') });
    const errIn = h('textarea', { rows: 3, class: 'mono', placeholder: L('编译报错（可选）', 'Compile errors (optional)') });
    const pickSel = btn(L('用选中的行', 'Use the selected lines'), () => {
      const a = src.value.slice(0, src.selectionStart), b = src.value.slice(0, src.selectionEnd);
      fromIn.value = String(W.splitKeep(a + 'x').length); toIn.value = String(W.splitKeep(b.replace(/\n$/, '') + 'x').length);
    }, 'small');
    const st = h('p', { class: 'po-status', 'aria-live': 'polite' });
    const diffBox = h('div', {});
    let ctl = null;
    const runBtn = btn(L('让模型改', 'Ask the model'), edit, 'primary');
    const stopBtn = btn(L('停止', 'Stop'), () => ctl?.abort(), 'danger', { disabled: true });
    function propose(before, afterText, summary) {
      diffBox.replaceChildren(h('p', { class: 'po-p', text: summary }), A.diffView(before, afterText, nameIn.value, `${nameIn.value} (${L('改后', 'revised')})`),
        h('div', { class: 'po-row' }, btn(L('采用这些改动', 'Apply these changes'), () => { history.push(src.value); undoBtn.disabled = false; src.value = afterText; diffBox.replaceChildren(); status(st, L('已采用。', 'Applied.')); }, 'primary'),
          btn(L('不要', 'Discard'), () => { diffBox.replaceChildren(); status(st, ''); })));
    }
    async function edit() {
      if (ctl) return;
      if (!A.ready()) { status(st, L('还没有可用的模型：先在“设置”里填一个 API key。', 'No model yet: add an API key under Settings.'), 'bad'); return; }
      if (!src.value.trim() || !instr.value.trim()) { status(st, L('先放进源码，再写要怎么改。', 'Add the source and say what to change.'), 'bad'); return; }
      const a = Number(fromIn.value), b = Number(toIn.value);
      const selr = a >= 1 && b >= a ? { start: a, end: b } : null;
      const before = W.pyText(src.value);
      const m = W.copilotMessages(nameIn.value || 'main.tex', before, instr.value, selr, errIn.value);
      if (selr && !m.scoped) { status(st, L('行号超出了文件的范围。', 'The line numbers are outside the file.'), 'bad'); return; }
      ctl = new AbortController(); runBtn.disabled = true; stopBtn.disabled = false;
      status(st, L('模型在改…', 'The model is editing…'));
      try {
        const reply = await A.llm('copilot', { system: m.system, prompt: m.prompt, label: 'copilot', signal: ctl.signal, step: 'copilot' });
        const out = m.apply(reply);
        status(st, '');
        propose(before, out, T(m.summary));
      } catch (e) { status(st, e?.message === 'empty-latex' ? L('模型没有给出 LaTeX。', 'The model returned no LaTeX.') : A.explain(e), e?.name === 'AbortError' ? 'warn' : 'bad'); }
      finally { ctl = null; runBtn.disabled = false; stopBtn.disabled = true; }
    }
    // 摘要
    const absOut = h('div', {});
    const ast = h('p', { class: 'po-status', 'aria-live': 'polite' });
    function diagnose() {
      const { abstract, intro } = AU.abstractAndIntro(src.value);
      absOut.replaceChildren();
      if (!abstract) { status(ast, L('没找到 \\begin{abstract}…\\end{abstract}。', 'No \\begin{abstract}…\\end{abstract} found.'), 'bad'); return null; }
      status(ast, '');
      const f = AU.abstractFields(abstract), d = AU.auditTextDraft(abstract, 'abstract');
      absOut.append(h('p', { class: 'po-p', text: L(`摘要字段完备度 ${f.filter((x) => x.status === 'present').length}/${f.length} · 文风体检问题 ${d.issues.length} 条`, `Abstract elements ${f.filter((x) => x.status === 'present').length}/${f.length} · ${d.issues.length} style issues`) }),
        A.renderChecks([...f.map((x) => ({ state: x.status === 'present' ? 'ok' : x.status === 'vague' ? 'warn' : 'fail', label: x.label, detail: x.status === 'present' ? [x.evidence, x.evidence] : x.suggestion })), ...(d.issues.length ? [{ state: 'warn', label: ['文风', 'Style'], detail: ['', ''], items: d.issues }] : [])]));
      return { abstract, intro, before: d };
    }
    async function polish() {
      if (ctl) return;
      if (!A.ready()) { status(ast, L('还没有可用的模型：先在“设置”里填一个 API key。', 'No model yet: add an API key under Settings.'), 'bad'); return; }
      const dg = diagnose();
      if (!dg) return;
      ctl = new AbortController();
      status(ast, L('模型在逐句改写…', 'Rewriting sentence by sentence…'));
      try {
        const m = W.polishMessages(dg.abstract, dg.intro, dg.before);
        const j = P.extractJSON(await A.llm('copilot', { system: m.system, prompt: m.prompt, label: 'polish-abstract', signal: ctl.signal, step: 'copilot' }));
        const rev = String(j?.revisedAbstract || '').trim();
        if (!rev) throw new Error(L('模型没有给出改写后的摘要。', 'The model returned no revised abstract.'));
        const after = AU.auditTextDraft(rev, 'abstract');
        status(ast, L(`已完成逐句改写（${(j.changeTable || []).length} 条对照）· 问题数 ${dg.before.issues.length} → ${after.issues.length}`, `Rewritten (${(j.changeTable || []).length} changes) · issues ${dg.before.issues.length} → ${after.issues.length}`));
        const rows = (j.changeTable || []).map((c) => h('tr', {}, ['original', 'revised', 'reason', 'pattern'].map((k) => h('td', { text: String(c?.[k] ?? '') }))));
        const list = (x) => (Array.isArray(x) ? x : []).map((s) => h('li', { text: String(s) }));
        A.add(absOut, h('h3', { class: 'po-h3', text: L(`改写后（${j.paperType || ''} ${j.motivationType || ''}）`, `Revised (${j.paperType || ''} ${j.motivationType || ''})`) }), A.pre(rev),
          rows.length ? h('div', { class: 'po-table' }, h('table', {}, h('thead', {}, h('tr', {}, [L('原句', 'Original'), L('改成', 'Revised'), L('原因', 'Reason'), L('模式', 'Pattern')].map((x) => h('th', { text: x })))), h('tbody', {}, rows))) : null,
          j.missingQuestions?.length ? [h('h3', { class: 'po-h3', text: L('要你补的信息', 'Information to add') }), h('ul', {}, list(j.missingQuestions))] : null,
          j.limitationsNotes?.length ? [h('h3', { class: 'po-h3', text: L('放到局限一节的', 'For the limitations section') }), h('ul', {}, list(j.limitationsNotes))] : null,
          h('div', { class: 'po-row' }, btn(L('换进源码（先看改动）', 'Put it into the source (review first)'), () => {
            const before = src.value, m2 = before.match(/(\\begin\{abstract\})([\s\S]*?)(\\end\{abstract\})/);
            if (!m2) return;
            propose(before, before.replace(m2[0], () => `${m2[1]}\n${rev}\n${m2[3]}`), L('把摘要换成改写后的版本', 'Replace the abstract with the revision'));
            diffBox.scrollIntoView({ block: 'nearest' });
          }, 'small')));
      } catch (e) { status(ast, A.explain(e), e?.name === 'AbortError' ? 'warn' : 'bad'); }
      finally { ctl = null; }
    }
    A.on('to-copilot', (d) => { if (src.value && src.value !== d.tex) { history.push(src.value); undoBtn.disabled = false; } src.value = d.tex; nameIn.value = d.name || 'main.tex'; });
    panel.append(h('div', { class: 'po-grid' },
      card(L('源码', 'Source'), h('div', { class: 'po-row' }, field(L('文件名', 'File name'), nameIn, 'grow'), undoBtn, btn(L('下载', 'Download'), () => A.download(nameIn.value || 'main.tex', src.value), 'small')), box, src),
      h('div', {},
        card(L('按指令改', 'Edit by instruction'), instr,
          h('div', { class: 'po-row' }, field(L('从第几行', 'From line'), fromIn, 's'), field(L('到第几行', 'To line'), toIn, 's'), pickSel),
          h('details', {}, h('summary', { text: L('附上编译报错', 'Attach compile errors') }), errIn),
          h('div', { class: 'po-row' }, runBtn, stopBtn), st, diffBox,
          h('p', { class: 'po-small', text: L('只给行号时，模型只看到那几行和前后各 15 行，只改那几行；不给就改整篇。改动先列出来，你点“采用”才写进去。', 'With line numbers the model sees only those lines plus 15 on each side and edits only them; without, it edits the whole file. Changes are shown first and only applied when you click “Apply”.') })),
        card(L('摘要', 'Abstract'), h('p', { class: 'po-p', text: L('诊断不调用模型：七个要素（任务、前人方法、缺口和原因、核心洞察、方法、结果、意义）和文风。改写按 Best-Paper-Writing-Skill（CC BY 4.0）的规则逐句改，不编数字。', 'Diagnosis uses no model: seven elements (task, prior approach, gap and cause, key insight, method, results, significance) and style. The rewrite follows Best-Paper-Writing-Skill (CC BY 4.0) sentence by sentence, inventing no numbers.') }),
          h('div', { class: 'po-row' }, btn(L('诊断摘要', 'Diagnose the abstract'), () => diagnose()), btn(L('改写摘要', 'Rewrite the abstract'), polish, 'primary')), ast, absOut))));
  } });
})();
