/* 文献信息抽取的界面：读图（图片、截图、PDF 的一页，可以框选一块）、按 extract-core.js 的流水线逐个调模型
   （ai/ai.js 的 ChemAI：访客自己的 key 或托管额度）、PubChem 查名字、RDKit 校验和画结构、可编辑的反应表、导出。
   页面文字自带中英两版（整页 translate="no"）。图和文字只发给访客选的 AI 服务；PubChem 只收到化学名。
   思路来自 ChemEAGLE（arXiv:2507.20230，github.com/CYF2000127/ChemEagle，MIT），代码是自己写的。 */
(function () {
  'use strict';
  const X = window.MolAstriaExtract, DEMO = window.MOLASTRIA_EXTRACT_DEMO, O = window.MolAstriaOCSR;
  const app = document.getElementById('ex');
  if (!X || !app) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const STORE = 'molastria-extract';
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/';
  const MAX_SIDE = 2400, MAX_LOOKUPS = 16;

  /** Element builder: text goes in as textContent, never as HTML. */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const ico = (dir = '') => h('i', { class: `ico-ext${dir ? ' ico-' + dir : ''}`, 'aria-hidden': 'true' });
  const opts = (() => { try { return { net: true, verify: false, ocsr: true, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return { net: true, verify: false, ocsr: true }; } })();
  const saveOpts = () => { try { localStorage.setItem(STORE, JSON.stringify({ net: opts.net, verify: opts.verify, ocsr: opts.ocsr })); } catch { /* private mode */ } };

  const state = { src: null, name: '', crop: null, pdf: null, page: 1, pages: 0, running: false, ctl: null, steps: {}, result: null, demo: false, model: '', calls: 0, started: 0 };

  // ── 页面骨架 ─────────────────────────────────────────────────────────────
  const agentName = (a) => L(a.zh, a.en);
  app.replaceChildren(
    h('header', { class: 'ex-mast' },
      h('p', { class: 'ex-eyebrow', text: 'MOLASTRIA · LITERATURE EXTRACTOR' }),
      h('h1', {}, L('文献信息抽取', 'Literature Extractor'), en ? null : h('span', { lang: 'en', text: 'Literature Extractor' })),
      h('p', { class: 'ex-lead', text: L('把论文里的一张反应图、底物表或一页 PDF 交给一组分工的智能体：先看图里有什么，再分别读反应式、单独的分子、底物表、条件和图注，最后由规则拼成一张反应表，逐条核对、打分。表里每一格都能改，改完导出 JSON 或 CSV。',
        'Hand a reaction figure, a scope table or a PDF page from a paper to a team of agents with one job each: one looks at what the figure holds, others read the scheme, standalone molecules, the scope table, the conditions and the caption, and rules assemble, check and score the reactions. Every cell of the table can be edited before you export JSON or CSV.') }),
      h('p', { class: 'ex-credit' }, L('思路来自 ', 'After '), h('a', { href: 'https://arxiv.org/abs/2507.20230', target: '_blank', rel: 'noopener', text: 'ChemEAGLE' }), L('（Chen 等，arXiv:2507.20230，代码 MIT 许可）。这里是 MolAstria 自己写的浏览器版本，不是原版程序。', ' (Chen et al., arXiv:2507.20230, code under MIT). This is MolAstria’s own browser version, not the original program.'))
    ),
    h('section', { class: 'ex-card ex-input', 'aria-labelledby': 'ex-in-h' },
      h('h2', { class: 'ex-h2', id: 'ex-in-h', text: L('一、给它一张图', '1 · Give it a figure') }),
      h('div', { class: 'ex-grid' },
        h('div', { class: 'ex-left' },
          h('div', { class: 'ex-drop', id: 'ex-drop', tabindex: '0', role: 'button', 'aria-label': L('选择或拖入图片、PDF', 'Choose or drop an image or PDF') },
            h('canvas', { id: 'ex-canvas', hidden: true, 'aria-label': L('图的预览，可以拖一个框只读其中一块', 'Figure preview; drag a box to read only part of it') }),
            h('div', { class: 'ex-sel', id: 'ex-sel', hidden: true }),
            h('div', { class: 'ex-drop-hint', id: 'ex-drop-hint' },
              h('b', { text: L('把图拖到这里、粘贴截图，或点这里选文件', 'Drop a figure here, paste a screenshot, or click to choose a file') }),
              h('small', { text: L('PNG、JPG、WebP 或 PDF。一张图里最好只有一个反应式和它的底物表。', 'PNG, JPG, WebP or PDF. One scheme with its scope table per figure works best.') })),
            h('input', { type: 'file', id: 'ex-file', accept: 'image/*,.pdf,application/pdf', hidden: true })
          ),
          h('div', { class: 'ex-tools' },
            h('span', { class: 'ex-pdfnav', id: 'ex-pdfnav', hidden: true },
              h('button', { type: 'button', class: 'ex-btn', id: 'ex-prev', 'aria-label': L('上一页', 'Previous page') }, ico('left')),
              h('span', { id: 'ex-pageno' }),
              h('button', { type: 'button', class: 'ex-btn', id: 'ex-next', 'aria-label': L('下一页', 'Next page') }, ico('right')),
              h('button', { type: 'button', class: 'ex-btn', id: 'ex-pagetext', text: L('用这一页的文字', 'Use this page’s text') })),
            h('button', { type: 'button', class: 'ex-btn', id: 'ex-clearsel', hidden: true, text: L('取消框选', 'Clear the box') }),
            h('button', { type: 'button', class: 'ex-btn', id: 'ex-clear', hidden: true, text: L('换一张', 'Remove') })
          ),
          h('p', { class: 'ex-small', id: 'ex-imgnote', text: L('在预览上拖一个框，只把框里的部分交给模型（适合整页 PDF）。', 'Drag a box on the preview to send only that part to the model (handy for a whole PDF page).') }),
          h('div', { class: 'ex-samples' },
            h('button', { type: 'button', class: 'ex-btn', id: 'ex-demo', text: L('看示范（不用 AI）', 'Watch the demo (no AI)') }),
            h('button', { type: 'button', class: 'ex-btn', id: 'ex-sample', text: L('载入示范图', 'Load the sample figure') }))
        ),
        h('div', { class: 'ex-right' },
          h('label', { class: 'ex-field', for: 'ex-text' }, L('图注或正文（可选）', 'Caption or paragraph (optional)')),
          h('textarea', { id: 'ex-text', rows: '7', placeholder: L('例如 “Scheme 2. Substrate scope. Conditions: 1 (0.2 mmol), …”。“文字”智能体会从这里读反应和化合物。', 'e.g. “Scheme 2. Substrate scope. Conditions: 1 (0.2 mmol), …”. The text agent reads reactions and compounds from here.') }),
          h('div', { class: 'ex-checks' },
            h('label', {}, h('input', { type: 'checkbox', id: 'ex-net', checked: opts.net }), L('联网查化学名（只把名字发给 PubChem）', 'Look up chemical names (only the names go to PubChem)')),
            h('label', {}, h('input', { type: 'checkbox', id: 'ex-verify', checked: opts.verify }), L('最后让模型对着原图复核一遍（多一次调用）', 'Have the model review the result against the figure (one more call)')),
            O ? h('label', {}, h('input', { type: 'checkbox', id: 'ex-ocsr', checked: opts.ocsr }), L('结构先交给 MolNexTR 识别，视觉模型的答案作对照（站长的电脑，每个结构用掉 1 次在线计算）', 'Read structures with MolNexTR first, the vision model’s answer as the cross-check (the site owner’s computer; one online run per structure)')) : null),
          O ? h('div', { class: 'ex-ocsr', id: 'ex-ocsr-box' },
            h('p', { class: 'ex-small', id: 'ex-ocsr-state' }, L('正在看站长的电脑在不在线…', 'Checking whether the site owner’s computer is online…')),
            h('button', { type: 'button', class: 'ex-btn', id: 'ex-ocsr-one', disabled: true, text: L('识别框里的结构（MolNexTR）', 'Read the boxed structure (MolNexTR)') })) : null,
          h('p', { class: 'ex-model', id: 'ex-model' }),
          h('div', { class: 'ex-go' },
            h('button', { type: 'button', class: 'ex-btn primary', id: 'ex-run', text: L('开始抽取', 'Extract') }),
            h('button', { type: 'button', class: 'ex-btn', id: 'ex-stop', hidden: true, text: L('停止', 'Stop') }),
            h('button', { type: 'button', class: 'ex-btn', id: 'ex-settings', text: L('AI 设置', 'AI settings') })),
          h('p', { class: 'ex-status', id: 'ex-status', role: 'status', 'aria-live': 'polite' }),
          h('p', { class: 'ex-small', text: L('一次抽取大约调用模型 4 到 8 次（每个智能体一次），用的是你在 AI 设置里选的服务，要选能看图的模型。图和文字只发给那个服务。', 'One extraction calls the model about 4–8 times (once per agent), through the service chosen in AI settings; pick a model that reads images. The figure and text go only to that service.') }))
      )
    ),
    h('section', { class: 'ex-card', 'aria-labelledby': 'ex-steps-h' },
      h('h2', { class: 'ex-h2', id: 'ex-steps-h', text: L('二、智能体分工', '2 · The agents') }),
      h('ol', { class: 'ex-steps', id: 'ex-steps' })
    ),
    h('section', { class: 'ex-card', id: 'ex-out-card', 'aria-labelledby': 'ex-out-h' },
      h('div', { class: 'ex-out-head' },
        h('h2', { class: 'ex-h2', id: 'ex-out-h', text: L('三、反应表', '3 · Reactions') }),
        h('div', { class: 'ex-exports', id: 'ex-exports', hidden: true },
          h('button', { type: 'button', class: 'ex-btn', id: 'ex-json', text: L('导出 JSON', 'Export JSON') }),
          h('button', { type: 'button', class: 'ex-btn', id: 'ex-csv', text: L('导出 CSV', 'Export CSV') }),
          h('button', { type: 'button', class: 'ex-btn', id: 'ex-copy', text: L('复制反应 SMILES', 'Copy reaction SMILES') }))),
      h('div', { id: 'ex-out' }, h('p', { class: 'ex-empty', text: L('还没有结果。载入一张图点“开始抽取”，或者先看示范。', 'No result yet. Load a figure and press Extract, or watch the demo first.') }))
    ),
    h('section', { class: 'ex-card ex-about', 'aria-labelledby': 'ex-about-h' },
      h('h2', { class: 'ex-h2', id: 'ex-about-h', text: L('它怎么工作，哪里会错', 'How it works, and where it goes wrong') }),
      h('div', { class: 'ex-about-grid' },
        h('div', {},
          h('h3', { text: L('分工', 'Who does what') }),
          h('p', { text: L('和 ChemEAGLE 一样，一个“规划”先看图，判断里面有哪些部分，再只叫用得上的智能体。不同的是：原版靠 MolScribe、RxnScribe 这类要 GPU 的识图模型，这里识图交给能看图的大模型；凡是能用确定规则做的事都不交给模型。', 'As in ChemEAGLE, a planner looks at the figure first and only the agents it needs are called. The difference: the original reads structures with GPU recognisers such as MolScribe and RxnScribe; here a vision-language model reads the figure, and everything that a fixed rule can do is kept away from the model.') }),
          h('ul', {},
            h('li', { text: L('计划核对：两种 R 基团表不同时用；有反应式就要读条件；有底物表就要有通式。', 'Plan check: never both R-group agents; a scheme always gets its conditions; a scope table always gets its general scheme.') }),
            h('li', { text: L('R 基团代入：表里的 “4-MeOC6H4”“3,5-(CF3)2C6H3”“2-thienyl” 由内置的取代基表转成片段，再拼进通式，产物由规则枚举，不让模型自己写。', 'R-group substitution: table entries such as “4-MeOC6H4”, “3,5-(CF3)2C6H3” or “2-thienyl” become fragments from a built-in table and are joined into the general structure; the products are enumerated by rule, not written by the model.') }),
            h('li', { text: L('条件：拆分、归类（催化剂、碱、溶剂、温度……）和常见试剂的结构来自一张一百多种试剂的表；不认识的名字再问 PubChem。', 'Conditions: splitting, roles (catalyst, base, solvent, temperature …) and structures of common reagents come from a table of 100-plus reagents; unknown names go to PubChem.') }),
            h('li', { text: L('核对：RDKit 解析每个 SMILES，检查 R 基团是否代完、产物的元素是否都有来处、产率是否合理、编号是否重复。', 'Checks: RDKit parses every SMILES; R groups filled, every product element accounted for, sane yields, no duplicate labels.') }))),
        h('div', {},
          h('h3', { text: L('分数是什么', 'What the score means') }),
          h('p', { text: L('每条反应从 1 分起，每个问题乘一个系数（SMILES 解析不了 ×0.3，R 基团没代完 ×0.4，产物有来路不明的元素 ×0.6……），0.85 以上算“高”、0.5 以上算“中”。阈值照 ChemEAGLE，但原文的分数是在基准集上校准过的概率，这里只是规则分，不能当成“正确的概率”。', 'Each reaction starts at 1 and every problem multiplies it (unparsable SMILES ×0.3, unfilled R group ×0.4, a product element from nowhere ×0.6 …); 0.85 and up is “high”, 0.5 and up “medium”. The thresholds follow ChemEAGLE, but the paper’s score is a probability calibrated on a benchmark; this one is a rule score, not a chance of being right.') }),
          h('h3', { text: L('会错的地方', 'Where it fails') }),
          h('ul', {},
            h('li', { text: L('复杂的结构（多环、立体化学、金属配合物）大模型常画错，一定要看缩略图。', 'Complex structures (polycycles, stereochemistry, metal complexes) are often misread by the model: always look at the thumbnails.') }),
            h('li', { text: L('分数高只说明内部自洽，不说明和原图一致；打开“复核”能多一道检查。', 'A high score means the result is self-consistent, not that it matches the figure; the review option adds one more check.') }),
            h('li', { text: L('示范图的产率是编的，只用来演示流程。', 'The yields in the sample figure are made up; it only demonstrates the pipeline.') })),
          h('p', { class: 'ex-small' }, L('原论文：', 'Paper: '), h('a', { href: 'https://arxiv.org/abs/2507.20230', target: '_blank', rel: 'noopener', text: 'Chen et al., A Multi-Agent System Enables Versatile Information Extraction from the Chemical Literature, arXiv:2507.20230' }), L('。原版代码：', '. Original code: '), h('a', { href: 'https://github.com/CYF2000127/ChemEagle', target: '_blank', rel: 'noopener', text: 'github.com/CYF2000127/ChemEagle' }), L('（MIT，Copyright © 2025 Yufan Chen）。', ' (MIT, Copyright © 2025 Yufan Chen).')))
      )
    )
  );
  const $ = (id) => document.getElementById(id);
  const canvas = $('ex-canvas'), sel = $('ex-sel'), drop = $('ex-drop');
  const status = (msg, bad = false) => { const s = $('ex-status'); s.textContent = msg || ''; s.dataset.bad = bad ? 'true' : 'false'; };

  // ── 智能体列表 ───────────────────────────────────────────────────────────
  const STATUS = { wait: ['等待', 'Waiting'], run: ['进行中', 'Running'], done: ['完成', 'Done'], skip: ['跳过', 'Skipped'], fail: ['失败', 'Failed'], off: ['没开', 'Off'] };
  function paintSteps() {
    const ol = $('ex-steps');
    ol.replaceChildren(...X.AGENTS.map((a, i) => {
      const st = state.steps[a.id] || { status: a.optional && !opts.verify ? 'off' : 'wait' };
      const li = h('li', { class: 'ex-step', 'data-step': a.id, 'data-status': st.status },
        h('span', { class: 'ex-step-n', text: String(i + 1) }),
        h('div', { class: 'ex-step-body' },
          h('div', { class: 'ex-step-top' },
            h('b', { text: agentName(a) }),
            h('span', { class: 'ex-kind', text: a.llm ? L('模型', 'model') : L('规则', 'rule') }),
            h('span', { class: 'ex-chip', 'data-status': st.status, text: L(...STATUS[st.status]) }),
            st.ms ? h('span', { class: 'ex-ms', text: `${(st.ms / 1000).toFixed(1)} s` }) : null),
          h('p', { text: L(a.dz, a.de) }),
          st.note ? h('p', { class: 'ex-step-note', text: st.note }) : null,
          st.error ? h('p', { class: 'ex-step-err', text: st.error }) : null,
          st.reply != null ? h('details', {}, h('summary', { text: a.llm ? L('看原始回答', 'Raw reply') : L('看结果', 'Output') }), h('pre', { class: 'ex-pre', text: typeof st.reply === 'string' ? st.reply : JSON.stringify(st.reply, null, 2) })) : null));
      return li;
    }));
  }
  const step = (id, patch) => { state.steps[id] = { ...(state.steps[id] || {}), ...patch }; paintSteps(); };
  paintSteps();

  // ── 模型那一行 ───────────────────────────────────────────────────────────
  function paintModel() {
    const AI = window.ChemAI, line = $('ex-model');
    if (!AI) { line.textContent = L('AI 模块还没载入。', 'The AI module has not loaded yet.'); return; }
    const s = AI.settings(), p = AI.providers[s.provider];
    const vm = AI.visionModel();
    const ready = AI.isReady();
    line.replaceChildren(h('span', { class: 'ex-dot', 'data-ready': ready && vm ? 'true' : 'false' }),
      `${L('模型：', 'Model: ')}${p ? p.label : s.provider}${vm ? ' · ' + vm : ''}`,
      !ready ? h('em', { text: L('（还没配置，点“AI 设置”）', ' (not set up: open AI settings)') }) : !vm ? h('em', { text: L('（这个服务不能看图，只能读文字）', ' (this service cannot read images; text only)') }) : null);
  }
  window.addEventListener('load', paintModel);
  setTimeout(paintModel, 300);
  $('ex-settings').addEventListener('click', () => { window.ChemAI?.openSettings?.(); });
  window.addEventListener('focus', paintModel);
  window.addEventListener('storage', paintModel);

  // ── MolNexTR（站长电脑上的结构识别，账号服务 /uma/jobs）──────────────────────
  const ocsr = { health: null, busy: false };
  const token = () => { try { return localStorage.getItem('molastria-session') || ''; } catch { return ''; } };
  const api = () => String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  async function umaCall(path, init = {}) {
    const t = token();
    const res = await fetch(api() + path, { ...init, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // the site path of the account service answers in Chinese only (data.error); the English line is made here
      const zh = String(data.error?.message_zh || data.error?.message || data.error || `HTTP ${res.status}`);
      const enMsg = data.error?.message_zh ? data.error.message : O ? O.errorEn(res.status, zh) : zh;
      throw Object.assign(new Error(zh), { status: res.status, en: enMsg });
    }
    return data;
  }
  /** An error's text in the page language: errors from umaCall and ocsr-core carry an English line in e.en. */
  const errText = (e) => (en && e?.en ? e.en : e?.message || String(e));
  const laneReady = () => !!(O && ocsr.health?.online && ocsr.health.models?.[O.MODEL]?.ready);
  function paintOcsr() {
    const line = $('ex-ocsr-state'), one = $('ex-ocsr-one');
    if (!line) return;
    const hl = ocsr.health;
    line.dataset.ready = laneReady() ? 'true' : 'false';
    line.textContent = hl === null ? L('正在看站长的电脑在不在线…', 'Checking whether the site owner’s computer is online…')
      : !hl.online ? L('MolNexTR：站长的电脑现在离线，结构只由视觉模型读。', 'MolNexTR: the site owner’s computer is offline; structures are read by the vision model only.')
      : !laneReady() ? L('MolNexTR：站长的电脑在线，但还没装 MolNexTR，结构只由视觉模型读。', 'MolNexTR: the computer is online but MolNexTR is not set up there; structures are read by the vision model only.')
      : L(`MolNexTR 在线${hl.models[O.MODEL].queue ? `，前面排着 ${hl.models[O.MODEL].queue} 个任务` : ''}。在预览上框住一个结构，可以不经过 AI 直接识别。`, `MolNexTR is online${hl.models[O.MODEL].queue ? `, ${hl.models[O.MODEL].queue} jobs ahead` : ''}. Box one structure on the preview to read it without the AI.`);
    one.disabled = !laneReady() || ocsr.busy || state.running || !state.src || !state.crop;
  }
  async function refreshOcsr() {
    if (!O) return;
    if (!api()) ocsr.health = { online: false };
    else { try { ocsr.health = await umaCall('/uma/health'); } catch { ocsr.health = { online: false }; } }
    paintOcsr();
  }
  window.addEventListener('load', refreshOcsr);

  /** One region of the full-resolution source as bare base64 PNG (JPEG when the PNG is over the size limit). */
  function cropB64(rect, maxBytes = O.LIMITS.maxBytes, side = O.CROP_SIDE) {
    const fit = O.fitSize(rect.sw, rect.sh, side);
    if (!fit) return null;
    const c = document.createElement('canvas');
    c.width = fit.w; c.height = fit.h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(state.src, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, c.width, c.height);
    for (const [type, q] of [['image/png'], ['image/jpeg', 0.92], ['image/jpeg', 0.8], ['image/jpeg', 0.6]]) {
      const d = O.fromDataUrl(c.toDataURL(type, q));
      if (d && d.bytes <= maxBytes) return d.b64;
    }
    return null;
  }
  /** Send crops, wait for the computer, return MolNexTR's items in the same order. */
  async function recognise(images, signal, say) {
    let r = await umaCall('/uma/jobs', { method: 'POST', body: JSON.stringify(O.body(images)), signal });
    const until = Date.now() + 5 * 60 * 1000;
    while (r.status !== 'done' && r.status !== 'error') {
      say?.(r.status === 'running' ? L('MolNexTR 正在识别结构…', 'MolNexTR is reading the structures…') : L(`MolNexTR 排队中，前面还有 ${Math.max(0, (r.position || 1) - 1)} 个任务…`, `MolNexTR: queued, ${Math.max(0, (r.position || 1) - 1)} jobs ahead…`));
      if (Date.now() > until) throw new Error(L('MolNexTR 等了 5 分钟还没结果。', 'No answer from MolNexTR after 5 minutes.'));
      await sleep(1200, signal);
      r = await umaCall(`/uma/jobs/${r.id}`, { signal });
    }
    if (r.status === 'error') throw new Error(r.error || L('MolNexTR 识别失败。', 'MolNexTR failed.'));
    return { items: r.result?.items || [], fake: !!r.result?.fake, cached: !!r.cached };
  }
  /** RDKit's canonical SMILES (null without RDKit or for what it cannot read): two answers agree when these match. */
  function canon(smiles) {
    if (!R || !smiles) return null;
    let m = null;
    try { m = R.get_mol(String(smiles)); return m && (!m.is_valid || m.is_valid()) ? m.get_smiles() : null; } catch { return null; } finally { m?.delete?.(); }
  }
  const sameMol = (a, b) => { const x = canon(a), y = canon(b); return x != null && x === y; };
  /** The structure step of a run: crop every boxed molecule, one MolNexTR job, then decide molecule by molecule. */
  async function structureStep(result, signal) {
    const { targets, skipped } = O.targets(result);
    if (!targets.length) { result.notes.push({ zh: 'MolNexTR 没有用上：模型没给出结构的位置。', en: 'MolNexTR was not used: the model gave no positions for the structures.' }); return; }
    // crops that do not fit what is left of one job's size limit are tried again smaller; the rest are counted
    const { sent, images, dropped } = O.pack(targets, (t, maxBytes, side) => cropB64(O.toPixels(O.padBox(O.normBox(t.box)), state.crop, state.src.width, state.src.height), maxBytes, side));
    const leftZh = [skipped ? `另有 ${skipped} 个超出一次的上限` : '', dropped ? `${dropped} 个裁不出来或超出一次的大小上限` : ''].filter(Boolean).join('，');
    const leftEn = [skipped ? `${skipped} more were over one job’s limit` : '', dropped ? `${dropped} could not be cropped or did not fit one job’s size limit` : ''].filter(Boolean).join('; ');
    if (!images.length) { result.notes.push({ zh: `MolNexTR 没有用上：${leftZh}，没送。结构用的是视觉模型的答案。`, en: `MolNexTR was not used: ${leftEn}, so nothing was sent. The structures are the vision model’s.` }); return; }
    status(L(`正在把 ${images.length} 个结构交给 MolNexTR…`, `Sending ${images.length} structures to MolNexTR…`));
    await rdkit();
    const got = await recognise(images, signal, status);
    sent.forEach((t, i) => { for (const m of t.mols) O.apply(m, O.decide(m.smiles, got.items[i], sameMol), got.items[i]); });
    // every other molecule says where its SMILES came from too
    for (const rx of result.reactions) for (const m of [...rx.reactants, ...rx.products]) if (!m.source) m.source = rx.source === 'rtable' && rx.kind === 'variant' ? 'rule' : m.from ? 'pubchem' : 'vision';
    for (const m of result.molecules) if (!m.source) m.source = m.from ? 'pubchem' : 'vision';
    const n = O.tally(sent.map((t) => t.mols[0])); // per structure sent, not per copy in the table
    result.notes.push({ zh: `MolNexTR 识别了 ${images.length} 个结构${leftZh ? `（${leftZh}，没送）` : ''}：两者一致 ${n.both} 个，用 MolNexTR 的 ${n.molnextr} 个，保留视觉模型的 ${n.vision} 个${n.disagree ? `，其中 ${n.disagree} 个两边不一样，表里标出来了` : ''}。${got.fake ? '（测试用的假结果）' : ''}`,
      en: `MolNexTR read ${images.length} structures${leftEn ? ` (${leftEn}; not sent)` : ''}: ${n.both} agree, ${n.molnextr} use MolNexTR, ${n.vision} keep the vision model’s answer${n.disagree ? `; ${n.disagree} differ and are flagged in the table` : ''}.${got.fake ? ' (fake test results)' : ''}` });
  }

  // ── 读图 ────────────────────────────────────────────────────────────────
  function showCanvas(src, name) {
    state.src = src; state.name = name; state.crop = null;
    const k = Math.min(1, 1200 / Math.max(src.width, src.height));
    canvas.width = Math.round(src.width * k); canvas.height = Math.round(src.height * k);
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(src, 0, 0, canvas.width, canvas.height);
    canvas.hidden = false; $('ex-drop-hint').hidden = true; sel.hidden = true;
    $('ex-clear').hidden = false; $('ex-clearsel').hidden = true;
    drop.dataset.has = 'true';
    paintOcsr();
  }
  function toCanvas(img, w, h0) {
    const k = Math.min(1, MAX_SIDE / Math.max(w, h0));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h0 * k));
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const loadImg = (url) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(L('这张图读不出来，换成 PNG 或 JPG 试试。', 'This image could not be read; try PNG or JPG.'))); im.src = url; });
  let pdfLib = null;
  const loadPdfLib = () => pdfLib || (pdfLib = import(`${PDFJS}pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`; return m; }, () => { pdfLib = null; throw new Error(L('PDF 阅读器载入失败（需要联网访问 cdn.jsdelivr.net）。', 'The PDF reader did not load (it needs cdn.jsdelivr.net).')); }));
  async function renderPage(n) {
    const page = await state.pdf.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, MAX_SIDE / Math.max(v1.width, v1.height)) });
    const c = document.createElement('canvas');
    c.width = Math.ceil(viewport.width); c.height = Math.ceil(viewport.height);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, canvas: c, viewport }).promise;
    page.cleanup();
    state.page = n;
    showCanvas(c, `${state.name.replace(/ · p\.\d+$/, '')} · p.${n}`);
    paintOcsr();
    $('ex-pageno').textContent = `${n} / ${state.pages}`;
    $('ex-prev').disabled = n <= 1; $('ex-next').disabled = n >= state.pages;
  }
  async function pageText(n) {
    const page = await state.pdf.getPage(n);
    const tc = await page.getTextContent();
    page.cleanup();
    return tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim();
  }
  async function takeFile(file) {
    if (!file) return;
    status(L('正在读文件…', 'Reading the file…'));
    try {
      if (/\.pdf$/i.test(file.name || '') || file.type === 'application/pdf') {
        const lib = await loadPdfLib();
        const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise.catch((e) => { throw new Error(e?.name === 'PasswordException' ? L('这个 PDF 设了密码。', 'This PDF is password-protected.') : L('这个 PDF 读不出来。', 'This PDF could not be read.')); });
        state.pdf?.destroy?.();
        state.pdf = doc; state.pages = doc.numPages; state.name = file.name || 'PDF';
        $('ex-pdfnav').hidden = false;
        await renderPage(1);
        status(L(`PDF 共 ${doc.numPages} 页。翻到有图的那页，拖一个框选中图。`, `The PDF has ${doc.numPages} pages. Go to the page with the figure and drag a box around it.`));
        return;
      }
      if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name || '')) throw new Error(L('只认图片和 PDF。', 'Only images and PDFs are read.'));
      const url = URL.createObjectURL(file);
      try { const im = await loadImg(url); showCanvas(toCanvas(im, im.naturalWidth || im.width, im.naturalHeight || im.height), file.name || 'image'); } finally { URL.revokeObjectURL(url); }
      state.pdf = null; $('ex-pdfnav').hidden = true;
      status('');
    } catch (e) { status(e.message || String(e), true); }
  }
  async function takeSample() {
    const im = await loadImg(DEMO.image);
    state.pdf = null; $('ex-pdfnav').hidden = true;
    showCanvas(toCanvas(im, 1800, 1200), 'sample-suzuki.svg');
    if (!$('ex-text').value.trim()) $('ex-text').value = DEMO.caption;
  }
  drop.addEventListener('click', (e) => { if (!state.src && e.target !== $('ex-file')) $('ex-file').click(); });
  drop.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !state.src) { e.preventDefault(); $('ex-file').click(); } });
  $('ex-file').addEventListener('change', (e) => { takeFile(e.target.files[0]); e.target.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.over = 'true'; });
  drop.addEventListener('dragleave', () => { delete drop.dataset.over; });
  drop.addEventListener('drop', (e) => { e.preventDefault(); delete drop.dataset.over; takeFile(e.dataTransfer?.files?.[0]); });
  document.addEventListener('paste', (e) => {
    if (e.target.closest?.('textarea, input')) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type)) || [...(e.clipboardData?.items || [])].find((it) => it.kind === 'file' && /^image\//.test(it.type))?.getAsFile();
    if (f) { e.preventDefault(); takeFile(f); }
  });
  $('ex-clear').addEventListener('click', () => {
    state.src = null; state.crop = null; state.pdf?.destroy?.(); state.pdf = null;
    canvas.hidden = true; sel.hidden = true; $('ex-drop-hint').hidden = false; $('ex-clear').hidden = true; $('ex-clearsel').hidden = true; $('ex-pdfnav').hidden = true; delete drop.dataset.has;
    paintOcsr();
  });
  $('ex-prev').addEventListener('click', () => state.page > 1 && renderPage(state.page - 1));
  $('ex-next').addEventListener('click', () => state.page < state.pages && renderPage(state.page + 1));
  $('ex-pagetext').addEventListener('click', async () => { const t = await pageText(state.page); $('ex-text').value = t.slice(0, 12000); status(L(`已填入第 ${state.page} 页的文字（${t.length} 字），可以删到只剩图注。`, `Page ${state.page}’s text is in (${t.length} characters); trim it to the caption if you like.`)); });
  $('ex-sample').addEventListener('click', () => takeSample().catch((e) => status(e.message, true)));

  // 框选：在预览上拖一个矩形
  let dragFrom = null;
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  function paintSel() {
    if (!state.crop) { sel.hidden = true; $('ex-clearsel').hidden = true; paintOcsr(); return; }
    const { x, y, w, h: hh } = state.crop;
    Object.assign(sel.style, { left: `${canvas.offsetLeft + x * canvas.offsetWidth}px`, top: `${canvas.offsetTop + y * canvas.offsetHeight}px`, width: `${w * canvas.offsetWidth}px`, height: `${hh * canvas.offsetHeight}px` });
    sel.hidden = false; $('ex-clearsel').hidden = false;
    paintOcsr();
  }
  canvas.addEventListener('pointerdown', (e) => { if (state.running) return; e.preventDefault(); dragFrom = rel(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragFrom) return;
    const p = rel(e);
    state.crop = { x: Math.min(dragFrom.x, p.x), y: Math.min(dragFrom.y, p.y), w: Math.abs(p.x - dragFrom.x), h: Math.abs(p.y - dragFrom.y) };
    paintSel();
  });
  canvas.addEventListener('pointerup', () => { dragFrom = null; if (state.crop && (state.crop.w < 0.03 || state.crop.h < 0.03)) state.crop = null; paintSel(); });
  window.addEventListener('resize', paintSel);
  $('ex-clearsel').addEventListener('click', () => { state.crop = null; paintSel(); });

  /** The figure (or the boxed part) as a JPEG data URL for the model. */
  async function figureUrl() {
    const src = state.src, c = state.crop;
    const sx = c ? Math.round(c.x * src.width) : 0, sy = c ? Math.round(c.y * src.height) : 0;
    const sw = c ? Math.max(1, Math.round(c.w * src.width)) : src.width, sh = c ? Math.max(1, Math.round(c.h * src.height)) : src.height;
    const out = document.createElement('canvas');
    out.width = sw; out.height = sh;
    const g = out.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, sw, sh);
    g.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.9));
    const pic = await window.ChemAI.readImage(new File([blob], 'figure.jpg', { type: 'image/jpeg' }), { max: 1600, quality: 0.88 });
    return pic.url;
  }

  // ── RDKit ───────────────────────────────────────────────────────────────
  let R = null;
  async function rdkit() {
    if (R) return R;
    if (!window.ChemLab?.loadRDKit) return null;
    try { R = await window.ChemLab.loadRDKit(); } catch { R = null; }
    return R;
  }
  function validate(smiles) {
    if (!R) return { ok: X.syntaxOk(smiles) };
    let m = null;
    try { m = R.get_mol(String(smiles)); return { ok: !!m && (!m.is_valid || m.is_valid()) }; } catch { return { ok: false }; } finally { m?.delete?.(); }
  }
  function structureSvg(smiles) {
    if (!R || !smiles) return null;
    let m = null;
    try {
      m = R.get_mol(String(smiles));
      if (!m || (m.is_valid && !m.is_valid())) return null;
      return m.get_svg(150, 104);
    } catch { return null; } finally { m?.delete?.(); }
  }

  // ── 跑一遍 ──────────────────────────────────────────────────────────────
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const sleep = (ms, signal) => new Promise((resolve, reject) => { const t = setTimeout(resolve, ms); signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); });
  async function lookupNames(result, signal) {
    const want = new Map();
    const need = (o) => o && !o.smiles && (o.name || o.text) && !/^(?:\d|[a-z]?\d+[a-z]?$)/i.test(o.name || '');
    for (const rx of result.reactions) {
      for (const c of rx.conditions) if (need(c) && ['catalyst', 'ligand', 'reagent', 'base', 'acid', 'oxidant', 'reductant', 'additive', 'solvent'].includes(c.role)) want.set(c.name || c.text, null);
      for (const m of [...rx.reactants, ...rx.products]) if (!m.smiles && m.name) want.set(m.name, null);
    }
    for (const m of result.molecules) if (!m.smiles && m.name) want.set(m.name, null);
    let n = 0;
    for (const name of [...want.keys()].slice(0, MAX_LOOKUPS)) {
      if (signal.aborted) break;
      try {
        const r = await fetch(X.pubchemNameUrl(name), { signal });
        const j = await r.json().catch(() => null);
        const hit = r.ok ? X.pubchemName(j) : null;
        if (hit) { want.set(name, hit); n++; }
      } catch (e) { if (e.name === 'AbortError') throw e; }
    }
    const fill = (o, key) => { const hit = want.get(key); if (hit && !o.smiles) { o.smiles = hit.smiles; o.from = `PubChem CID ${hit.cid}`; } };
    for (const rx of result.reactions) {
      for (const c of rx.conditions) if (c.name || c.text) fill(c, c.name || c.text);
      for (const m of [...rx.reactants, ...rx.products]) if (m.name) fill(m, m.name);
    }
    for (const m of result.molecules) if (m.name) fill(m, m.name);
    return { asked: Math.min(want.size, MAX_LOOKUPS), found: n };
  }

  async function run(demo) {
    if (state.running) return;
    const AI = window.ChemAI;
    const text = $('ex-text').value.trim();
    if (demo) { await takeSample(); }
    if (!state.src && !text) { status(L('先给一张图，或者贴一段文字。', 'Give it a figure or paste some text first.'), true); return; }
    if (!demo) {
      if (!AI) { status(L('AI 模块还没载入，稍等一下再试。', 'The AI module has not loaded yet; try again in a moment.'), true); return; }
      if (!AI.isReady()) { status(L('还没有配置 AI。点“AI 设置”填一个 key，或者登录后用托管额度。', 'AI is not set up. Open AI settings and add a key, or sign in to use the hosted allowance.'), true); AI.openSettings?.(); return; }
      if (state.src && !AI.visionModel()) { status(L('现在选的 AI 服务不能看图。在 AI 设置里换成 DeepSeek V4.1 Flash 或 Meta Muse Spark。', 'The chosen AI service cannot read images. Switch to DeepSeek V4.1 Flash or Meta Muse Spark in AI settings.'), true); return; }
    }
    state.running = true; state.demo = demo; state.calls = 0; state.started = Date.now(); state.steps = {}; state.result = null;
    state.ctl = new AbortController();
    const signal = state.ctl.signal;
    $('ex-run').disabled = true; $('ex-demo').disabled = true; $('ex-stop').hidden = false;
    for (const a of X.AGENTS) state.steps[a.id] = { status: a.optional && (!opts.verify || demo) ? 'off' : 'wait' };
    paintSteps();
    $('ex-out').replaceChildren(h('p', { class: 'ex-empty', text: L('正在抽取…', 'Extracting…') })); $('ex-exports').hidden = true;
    let image = '';
    const useOcsr = !demo && !!state.src && !!opts.ocsr && laneReady();
    const ctx = { text, caption: text, boxes: useOcsr };
    const call = async (id, extra = {}) => {
      const t0 = performance.now();
      step(id, { status: 'run' });
      try {
        let reply;
        if (demo) { await sleep(450, signal); reply = clone(DEMO.replies[id]); }
        else {
          const agent = X.AGENTS.find((a) => a.id === id);
          const p = X.prompt(id, { ...ctx, ...extra });
          const content = agent.image && image ? AI.withImages(p.user, [image]) : p.user;
          const r = await AI.chat({ messages: [{ role: 'system', content: p.system }, { role: 'user', content }], json: true, maxTokens: id === 'planner' ? 800 : 6000, temperature: 0, signal });
          state.calls++; state.model = r.model || state.model;
          try { reply = X.parseReply(r.text); } catch { step(id, { status: 'fail', ms: performance.now() - t0, reply: r.text, error: L('回答里没有能读的 JSON。', 'The reply has no readable JSON.') }); return null; }
        }
        step(id, { status: 'done', ms: performance.now() - t0, reply });
        return reply;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        step(id, { status: 'fail', ms: performance.now() - t0, error: e.message || String(e) });
        if (e.code === 'no-key' || e.code === 'no-vision' || e.status === 401 || e.status === 402 || e.status === 429) throw e;
        return null;
      }
    };
    try {
      if (state.src && !demo) { status(L('正在准备图…', 'Preparing the figure…')); image = await figureUrl(); }
      status(L('规划在看图…', 'The planner is looking at the figure…'));
      let planned = null;
      if (state.src) planned = await call('planner');
      else step('planner', { status: 'skip', note: L('没有图：直接读文字。', 'No figure: the text is read directly.') });
      const pl = X.plan(planned?.components || {}, { hasText: !!text, hasImage: !!state.src });
      step('observer', { status: 'done', reply: { components: pl.components || {}, agents: pl.agents }, note: [L(`要叫的智能体：${pl.agents.map((id) => agentName(X.AGENTS.find((a) => a.id === id))).join('、') || '无'}`, `Agents to call: ${pl.agents.map((id) => agentName(X.AGENTS.find((a) => a.id === id))).join(', ') || 'none'}`), ...pl.notes.map((n) => L(n.zh, n.en))].join(' ') });
      for (const id of X.EXTRACTORS) if (!pl.agents.includes(id)) step(id, { status: 'skip' });
      const out = {};
      if (pl.agents.includes('template')) { status(L('正在读反应式…', 'Reading the scheme…')); out.template = await call('template'); }
      const rest = pl.agents.filter((id) => id !== 'template');
      status(L('其余智能体在读…', 'The other agents are reading…'));
      // two at a time: fast enough, and gentle on rate limits
      const queue = [...rest];
      await Promise.all([0, 1].map(async () => { while (queue.length) { const id = queue.shift(); out[id] = await call(id, { template: out.template }); } }));
      // assemble
      const t0 = performance.now();
      step('merge', { status: 'run' });
      const result = X.assemble(Object.fromEntries(Object.entries(out).filter(([, v]) => v)));
      if (opts.net && !demo) {
        status(L('正在向 PubChem 查化学名…', 'Looking up names in PubChem…'));
        const got = await lookupNames(result, signal).catch((e) => { if (e.name === 'AbortError') throw e; return null; });
        if (got?.asked) result.notes.push({ zh: `PubChem 查了 ${got.asked} 个名字，找到 ${got.found} 个。`, en: `Looked up ${got.asked} names in PubChem; ${got.found} found.` });
      }
      if (useOcsr) {
        try { await structureStep(result, signal); } catch (e) {
          if (e.name === 'AbortError') throw e;
          result.notes.push({ zh: `MolNexTR 这一步没成：${e.message}。结构用的是视觉模型的答案。`, en: `The MolNexTR step failed: ${e.en || e.message}. The structures are the vision model’s.` });
        }
      }
      step('merge', { status: 'done', ms: performance.now() - t0, reply: X.toJSON(result), note: [L(`${result.reactions.length} 条反应，${result.molecules.length} 个单独的分子。`, `${result.reactions.length} reactions, ${result.molecules.length} standalone molecules.`), ...result.notes.map((n) => L(n.zh, n.en))].join(' ') });
      let review = null;
      if (opts.verify && !demo && state.src && result.reactions.length) { status(L('模型在复核…', 'The model is reviewing…')); review = await call('verify', { reactions: result.reactions }); }
      step('check', { status: 'run' });
      status(L('正在载入 RDKit 核对结构（第一次约 7 MB）…', 'Loading RDKit to check structures (about 7 MB the first time)…'));
      const t1 = performance.now();
      await rdkit();
      X.check(result, { validate, review });
      const s = result.summary;
      step('check', { status: 'done', ms: performance.now() - t1, note: L(`高 ${s.high}、中 ${s.medium}、低 ${s.low}。${R ? '' : 'RDKit 没载入，只做了语法检查。'}`, `High ${s.high}, medium ${s.medium}, low ${s.low}.${R ? '' : ' RDKit did not load; syntax checks only.'}`) });
      state.result = result;
      paintResult();
      const secs = Math.round((Date.now() - state.started) / 1000);
      status(demo ? L('示范跑完了：模型那几步用的是事先写好的回答，其余都是现算的。', 'Demo done: the model steps used prewritten replies; everything else was computed now.')
        : L(`完成：调用模型 ${state.calls} 次，用时 ${secs} 秒。`, `Done: ${state.calls} model calls in ${secs} s.`));
    } catch (e) {
      if (e.name === 'AbortError') status(L('已停止。', 'Stopped.'), true);
      else status(e.message || String(e), true);
      for (const a of X.AGENTS) if (state.steps[a.id]?.status === 'run' || state.steps[a.id]?.status === 'wait') state.steps[a.id].status = 'skip';
      paintSteps();
    } finally {
      state.running = false; state.ctl = null;
      $('ex-run').disabled = false; $('ex-demo').disabled = false; $('ex-stop').hidden = true;
      paintOcsr();
    }
  }
  $('ex-run').addEventListener('click', () => run(false));
  $('ex-demo').addEventListener('click', () => run(true));
  $('ex-stop').addEventListener('click', () => state.ctl?.abort());
  $('ex-net').addEventListener('change', (e) => { opts.net = e.target.checked; saveOpts(); });
  $('ex-ocsr')?.addEventListener('change', (e) => { opts.ocsr = e.target.checked; saveOpts(); });
  // one boxed structure straight to MolNexTR: no AI key needed; the answer joins the standalone molecules
  $('ex-ocsr-one')?.addEventListener('click', async () => {
    if (!laneReady() || !state.src || !state.crop || ocsr.busy) return;
    ocsr.busy = true; paintOcsr();
    try {
      const b64 = cropB64(O.toPixels({ x: 0, y: 0, w: 1, h: 1 }, state.crop, state.src.width, state.src.height));
      if (!b64) throw new Error(L('框太小了，或者图太大，换一个框试试。', 'The box is too small or the image too large; try another box.'));
      status(L('正在交给 MolNexTR…', 'Sending to MolNexTR…'));
      await rdkit();
      const got = await recognise([b64], null, status);
      const it = got.items[0];
      if (!it?.ok || it.valid === false) throw new Error(L(`MolNexTR 没读出这个结构${it?.error ? `：${it.error}` : ''}。`, `MolNexTR could not read this structure${it?.error ? `: ${it.error}` : ''}.`));
      if (!state.result) state.result = { reactions: [], molecules: [], entities: [], notes: [] };
      // asked for by hand: MolNexTR's answer is used whatever its score (the score is shown next to it)
      const m = O.apply({ label: '', smiles: '', name: '', role: 'other' }, { source: 'molnextr', smiles: it.canonical || it.smiles, alt: '', disagree: false, confidence: Number.isFinite(it.confidence) ? it.confidence : null, reason: 'boxed' }, it);
      state.result.molecules.push(m);
      X.check(state.result, { validate });
      paintResult();
      status(L(`MolNexTR 读出 ${it.canonical || it.smiles}（${it.formula || ''}，置信度 ${it.confidence != null ? it.confidence.toFixed(2) : '—'}）。加到了“单独的分子”里。${got.fake ? '（测试用的假结果）' : ''}`,
        `MolNexTR read ${it.canonical || it.smiles} (${it.formula || ''}, confidence ${it.confidence != null ? it.confidence.toFixed(2) : '—'}); added to the standalone molecules.${got.fake ? ' (fake test result)' : ''}`));
      window.MolAstriaActivity?.('practice');
    } catch (e) { status(errText(e), true); } finally { ocsr.busy = false; paintOcsr(); refreshOcsr(); }
  });
  $('ex-verify').addEventListener('change', (e) => { opts.verify = e.target.checked; saveOpts(); if (!state.running) { state.steps.verify = { status: opts.verify ? 'wait' : 'off' }; paintSteps(); } });

  // ── 结果表 ──────────────────────────────────────────────────────────────
  const LEVEL = { high: ['高', 'High'], medium: ['中', 'Medium'], low: ['低', 'Low'] };
  const KIND = { template: ['通式', 'Template'], scheme: ['反应式', 'Scheme'], variant: ['底物', 'Substrate'], text: ['文字', 'Text'], manual: ['手加', 'Added'] };
  const ROLE = { catalyst: ['催化剂', 'catalyst'], ligand: ['配体', 'ligand'], reagent: ['试剂', 'reagent'], base: ['碱', 'base'], acid: ['酸', 'acid'], oxidant: ['氧化剂', 'oxidant'], reductant: ['还原剂', 'reductant'], additive: ['添加剂', 'additive'], solvent: ['溶剂', 'solvent'], temperature: ['温度', 'temperature'], time: ['时间', 'time'], atmosphere: ['气氛', 'atmosphere'], light: ['光照', 'light'], yield: ['产率', 'yield'], other: ['其他', 'other'] };
  function recheck() { if (state.result) X.check(state.result, { validate }); }
  function molEditor(rx, list, i, ri) {
    const m = list[i];
    const after = () => { recheck(); if (ri >= 0) paintRow(ri); else paintResult(); paintSummary(); };
    const svg = structureSvg(m.smiles);
    const thumb = h('div', { class: 'ex-thumb', 'data-empty': svg ? 'false' : 'true' });
    if (svg) thumb.innerHTML = svg; // RDKit's own SVG of a SMILES (no user markup reaches innerHTML: RDKit writes the element names)
    else thumb.textContent = m.smiles ? L('画不出', 'no drawing') : '—';
    const lab = h('input', { type: 'text', class: 'ex-lab', value: m.label, 'aria-label': L('编号', 'Label'), placeholder: L('编号', 'label') });
    const smi = h('input', { type: 'text', class: 'ex-smi', value: m.smiles, 'aria-label': 'SMILES', placeholder: 'SMILES', spellcheck: 'false' });
    lab.addEventListener('change', () => { m.label = lab.value.trim(); after(); });
    smi.addEventListener('change', () => { m.smiles = X.normalizeR(smi.value); if (m.source) m.source = 'manual'; after(); });
    const del = h('button', { type: 'button', class: 'ex-x', 'aria-label': L('删掉这个分子', 'Remove this molecule'), title: L('删掉', 'Remove'), text: '×', onclick: () => { list.splice(i, 1); after(); } });
    const o = m.ocsr;
    const src = m.source && O ? h('div', { class: 'ex-src', 'data-src': m.source, 'data-disagree': o?.disagree && m.source !== 'both' && m.source !== 'manual' ? 'true' : 'false' },
      h('span', { class: 'ex-srctag', title: L('这个 SMILES 是谁给的', 'Where this SMILES came from'), text: O.sourceText(m.source, en) + (o?.confidence != null && m.source !== 'vision' && m.source !== 'manual' ? ` · ${o.confidence.toFixed(2)}` : '') }),
      o?.alt ? h('button', { type: 'button', class: 'ex-swap', title: o.alt, text: m.source === 'molnextr' ? L('换回视觉模型的', 'Use the vision model’s') : L('换成 MolNexTR 的', 'Use MolNexTR’s'), onclick: () => { O.swap(m); after(); } }) : null,
      o?.reason === 'failed' ? h('small', { text: L('MolNexTR 没读出来', 'MolNexTR could not read it') }) : null) : null;
    return h('div', { class: 'ex-mol' }, thumb, h('div', { class: 'ex-mol-f' }, h('div', { class: 'ex-mol-top' }, lab, del), smi, src, m.name ? h('small', { text: m.name }) : null, m.from ? h('small', { class: 'ex-from', text: m.from }) : null));
  }
  function condEditor(rx, i, ri) {
    const c = rx.conditions[i];
    const role = h('select', { 'aria-label': L('角色', 'Role') }, ...X.ROLES.filter((r) => r !== 'yield').map((r) => h('option', { value: r, selected: r === c.role, text: L(...(ROLE[r] || [r, r])) })));
    const txt = h('input', { type: 'text', value: c.text || [c.name, c.amount].filter(Boolean).join(' '), 'aria-label': L('条件', 'Condition') });
    const smi = h('input', { type: 'text', class: 'ex-smi', value: c.smiles || '', placeholder: ['temperature', 'time', 'atmosphere', 'light'].includes(c.role) ? '' : 'SMILES', 'aria-label': 'SMILES', spellcheck: 'false', hidden: ['temperature', 'time', 'atmosphere', 'light'].includes(c.role) });
    role.addEventListener('change', () => { c.role = role.value; smi.hidden = ['temperature', 'time', 'atmosphere', 'light'].includes(c.role); recheck(); paintRow(ri); paintSummary(); });
    txt.addEventListener('change', () => { const k = X.classify(txt.value, c.role); c.text = txt.value.trim(); c.name = k.name || ''; c.amount = k.amount || ''; if (!c.smiles && k.smiles) { c.smiles = k.smiles; smi.value = k.smiles; } recheck(); paintRow(ri); paintSummary(); });
    smi.addEventListener('change', () => { c.smiles = smi.value.trim(); recheck(); paintRow(ri); paintSummary(); });
    const del = h('button', { type: 'button', class: 'ex-x', 'aria-label': L('删掉这个条件', 'Remove this condition'), text: '×', onclick: () => { rx.conditions.splice(i, 1); recheck(); paintRow(ri); paintSummary(); } });
    return h('div', { class: 'ex-cond' }, role, txt, smi, del);
  }
  const opened = new WeakSet();
  const condKey = (cs) => JSON.stringify(cs.map((c) => [c.role, c.text, c.name, c.amount, c.smiles || '']));
  /** A substrate row whose conditions are exactly the template's: shown folded, so the table stays readable. */
  function sharedWith(rx) {
    if (rx.kind !== 'variant' || !rx.conditions.length) return null;
    const t = state.result.reactions.find((r) => r.kind === 'template' || r.kind === 'scheme');
    return t && t !== rx && condKey(t.conditions) === condKey(rx.conditions) ? t : null;
  }
  function paintRow(ri) {
    const rx = state.result.reactions[ri];
    const tr = document.querySelector(`#ex-table tr[data-row="${ri}"]`);
    if (!rx || !tr) return;
    const conf = rx.confidence || { score: 1, level: 'high', flags: [] };
    const add = (label, fn) => h('button', { type: 'button', class: 'ex-add', text: `+ ${label}`, onclick: fn });
    const yIn = h('input', { type: 'text', value: rx.yield?.text || '', 'aria-label': L('产率', 'Yield'), placeholder: '%' });
    yIn.addEventListener('change', () => { rx.yield = X.parseYield(yIn.value); recheck(); paintRow(ri); paintSummary(); });
    tr.replaceChildren(
      h('td', { class: 'ex-c-id', 'data-h': 'ID' }, h('b', { text: rx.id }), h('span', { class: 'ex-kindtag', text: L(...(KIND[rx.kind] || [rx.kind, rx.kind])) }),
        rx.rvalues ? h('small', { class: 'ex-rv', text: Object.entries(rx.rvalues).map(([k, v]) => `${k} = ${v}`).join(', ') }) : null,
        h('button', { type: 'button', class: 'ex-delrow', text: L('删掉这条', 'Delete row'), onclick: () => { state.result.reactions.splice(ri, 1); recheck(); paintResult(); } })),
      h('td', { 'data-h': L('反应物', 'Reactants') }, ...rx.reactants.map((_, i) => molEditor(rx, rx.reactants, i, ri)), add(L('反应物', 'reactant'), () => { rx.reactants.push({ label: '', smiles: '', name: '' }); recheck(); paintRow(ri); })),
      h('td', { 'data-h': L('条件', 'Conditions') }, ...(sharedWith(rx) && !opened.has(rx)
        ? [h('div', { class: 'ex-condsum' }, ...rx.conditions.map((c) => h('span', {}, h('small', { text: L(...(ROLE[c.role] || [c.role, c.role])) }), ' ', c.name || c.text)),
            h('button', { type: 'button', class: 'ex-add', text: L(`和 ${sharedWith(rx).id} 相同 · 展开编辑`, `Same as ${sharedWith(rx).id} · expand to edit`), onclick: () => { opened.add(rx); paintRow(ri); } }))]
        : [...rx.conditions.map((_, i) => condEditor(rx, i, ri)), add(L('条件', 'condition'), () => { rx.conditions.push({ text: '', role: 'reagent', name: '', amount: '' }); opened.add(rx); paintRow(ri); })])),
      h('td', { 'data-h': L('产物', 'Products') }, ...rx.products.map((_, i) => molEditor(rx, rx.products, i, ri)), add(L('产物', 'product'), () => { rx.products.push({ label: '', smiles: '', name: '' }); recheck(); paintRow(ri); })),
      h('td', { class: 'ex-c-y', 'data-h': L('产率', 'Yield') }, yIn, rx.yield?.ee ? h('small', { text: `ee ${rx.yield.ee}` }) : null, rx.yield?.dr ? h('small', { text: `dr ${rx.yield.dr}` }) : null),
      h('td', { class: 'ex-c-conf', 'data-h': L('核对', 'Checks') },
        h('span', { class: 'ex-level', 'data-level': conf.level, text: `${L(...LEVEL[conf.level])} · ${conf.score.toFixed(2)}` }),
        conf.flags.length ? h('ul', { class: 'ex-flags' }, ...conf.flags.map((f) => h('li', { text: X.flagText(f, en) }))) : h('small', { class: 'ex-okay', text: L('没发现问题', 'No problems found') }),
        rx.sentence ? h('small', { class: 'ex-sent', text: `“${rx.sentence}”` }) : null)
    );
  }
  function paintSummary() {
    const s = state.result?.summary;
    const box = $('ex-sum');
    if (!s || !box) return;
    box.replaceChildren(
      h('span', {}, h('b', { text: String(s.reactions) }), L(' 条反应', ' reactions')),
      h('span', { class: 'ex-level', 'data-level': 'high', text: `${L('高', 'High')} ${s.high}` }),
      h('span', { class: 'ex-level', 'data-level': 'medium', text: `${L('中', 'Medium')} ${s.medium}` }),
      h('span', { class: 'ex-level', 'data-level': 'low', text: `${L('低', 'Low')} ${s.low}` }),
      state.demo ? h('span', { class: 'ex-demo-tag', text: L('示范：产率是编的', 'Demo: made-up yields') }) : null);
  }
  function paintResult() {
    const r = state.result;
    const out = $('ex-out');
    if (!r) return;
    $('ex-exports').hidden = !r.reactions.length;
    const parts = [h('div', { class: 'ex-sum', id: 'ex-sum' })];
    if (!r.reactions.length) parts.push(h('p', { class: 'ex-empty', text: L('没有读出反应。看看上面每个智能体的原始回答，或者框小一点再试。', 'No reactions were read. Look at each agent’s raw reply above, or draw a tighter box and try again.') }));
    else {
      const table = h('table', { class: 'ex-table', id: 'ex-table' },
        h('thead', {}, h('tr', {}, ...['ID', L('反应物', 'Reactants'), L('条件', 'Conditions'), L('产物', 'Products'), L('产率', 'Yield'), L('核对', 'Checks')].map((t) => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, ...r.reactions.map((_, i) => h('tr', { 'data-row': String(i) }))));
      parts.push(h('div', { class: 'ex-tablewrap' }, table));
    }
    parts.push(h('button', { type: 'button', class: 'ex-btn ex-addrow', text: L('+ 加一条反应', '+ Add a reaction'), onclick: () => { r.reactions.push({ id: `m${r.reactions.length + 1}`, kind: 'manual', reactants: [{ label: '', smiles: '', name: '' }], products: [{ label: '', smiles: '', name: '' }], conditions: [], yield: X.parseYield('') }); recheck(); paintResult(); } }));
    if (r.molecules.length) {
      parts.push(h('h3', { class: 'ex-h3', text: L('图里单独画的分子', 'Standalone molecules in the figure') }),
        h('div', { class: 'ex-mols' }, ...r.molecules.map((m, i) => { const el = molEditor({}, r.molecules, i, -1); el.append(h('small', { class: 'ex-role', text: L(...(ROLE[m.role] || [m.role, m.role])) })); return el; })));
    }
    if (r.entities?.length) parts.push(h('h3', { class: 'ex-h3', text: L('文字里提到的', 'Named in the text') }), h('p', { class: 'ex-ents' }, ...r.entities.map((e) => h('span', { class: 'ex-ent', 'data-type': e.type, text: e.text }))));
    out.replaceChildren(...parts);
    r.reactions.forEach((_, i) => paintRow(i));
    paintSummary();
  }

  // ── 导出 ────────────────────────────────────────────────────────────────
  function download(name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  $('ex-json').addEventListener('click', () => state.result && download(`molastria-extract-${stamp()}.json`, JSON.stringify(X.toJSON(state.result, { date: new Date().toISOString(), model: state.demo ? 'demo (prewritten replies)' : state.model }), null, 2), 'application/json'));
  $('ex-csv').addEventListener('click', () => state.result && download(`molastria-extract-${stamp()}.csv`, String.fromCharCode(0xfeff) + X.toCSV(state.result), 'text/csv;charset=utf-8'));
  $('ex-copy').addEventListener('click', async () => {
    if (!state.result) return;
    const t = state.result.reactions.map((r) => `${X.rxnSmiles(r)} ${r.id}`).join('\n');
    try { await navigator.clipboard.writeText(t); status(L(`已复制 ${state.result.reactions.length} 条反应 SMILES。`, `Copied ${state.result.reactions.length} reaction SMILES.`)); } catch { status(L('浏览器不让复制，请改用导出。', 'The browser blocked copying; use an export instead.'), true); }
  });

  window.MolAstriaExtractPage = { state, run, takeFile };
})();
