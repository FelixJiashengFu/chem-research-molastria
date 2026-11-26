/* 逐步解谱讲解（nmr/walkthrough/）的界面。纯逻辑在 nw-core.js（MolAstriaNMRWalk），讲解方法和示例在 nw-guide.js（生成的），
   模型请求的拼法借用论文工坊的 ../../paper/po-core.js（MolAstriaPaper）。
   - 播放：player.html（站长的 nmr-walkthrough 的播放器，生成的）填好描述，放进 sandbox="allow-scripts" 的 iframe（srcdoc）：
     模型写的内容跑在一个没有本站来源的框里，读不到这一页存的 key。
   - 生成：用户贴峰表（可以加图片），选服务商、填自己的 API key，浏览器直接问服务商（credentials omit、no-referrer）。
     回答取出 JSON → 校验（没过就把错误交回去改，最多两次）→ 和用户的数据逐个核对（找不到的改标 ≈ / *）→ 来源换成用户的数据。
   - key 存 molastria-nmrw-keys（勾“记住”在 localStorage，否则 sessionStorage），不经过 MolAstria 的服务器、不进云同步；
     偏好存 molastria-nmrw；没发出去的表单和最近一份讲解存 sessionStorage 的 molastria-nmrw-draft。
   文字自带中英两版（整页 translate="no"）。 */
(() => {
  'use strict';
  const W = window.MolAstriaNMRWalk, G = window.MOLASTRIA_NMRW_GUIDE, P = window.MolAstriaPaper;
  const $ = (s, r = document) => r.querySelector(s);
  const main = $('#nw-main');
  if (!W || !G || !P || !main) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const T = (v) => (v && typeof v === 'object' ? (en ? v.en || v.zh : v.zh || v.en) : String(v ?? ''));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (s) => esc(s).replace(/_\{(.+?)\}/g, '<sub>$1</sub>').replace(/\^\{(.+?)\}/g, '<sup>$1</sup>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  let LS = null, SS = null;
  try { LS = window.localStorage; SS = window.sessionStorage; } catch { /* 存储被禁用：只在内存里 */ }
  const readJSON = (s, k) => { try { const v = JSON.parse(s?.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
  const writeJSON = (s, k, v) => { try { s?.setItem(k, JSON.stringify(v)); } catch { /* 存不下 */ } };

  const PREF = 'molastria-nmrw', KEYS = 'molastria-nmrw-keys', DRAFT = 'molastria-nmrw-draft', PAPER_KEYS = 'molastria-paper-keys';
  const prefs = { provider: 'deepseek', models: {}, bases: {}, ...(readJSON(LS, PREF) || {}) };
  if (!P.PROVIDERS[prefs.provider]) prefs.provider = 'deepseek';
  const savedLocal = readJSON(LS, KEYS);
  const vault = { remember: !!savedLocal, keys: { ...((savedLocal || readJSON(SS, KEYS) || {}).keys || {}) } };
  const savePrefs = () => writeJSON(LS, PREF, { provider: prefs.provider, models: prefs.models, bases: prefs.bases });
  function saveKeys() {
    const s = { keys: vault.keys };
    try {
      if (vault.remember) { LS?.setItem(KEYS, JSON.stringify(s)); SS?.removeItem(KEYS); }
      else { SS?.setItem(KEYS, JSON.stringify(s)); LS?.removeItem(KEYS); }
    } catch { /* 存不下：这次会话内仍然在内存里 */ }
  }
  const paperKeys = () => (readJSON(LS, PAPER_KEYS) || readJSON(SS, PAPER_KEYS) || {}).keys || {};

  // ── 页面骨架 ──────────────────────────────────────────────────────────
  const MAIN = ['deepseek', 'anthropic', 'openai', 'gemini', 'openrouter', 'qwen', 'moonshot', 'zhipu', 'siliconflow'];
  const order = [...MAIN, ...Object.keys(P.PROVIDERS).filter((p) => !MAIN.includes(p))];
  const EN_LABEL = { qwen: 'Qwen (Alibaba)', moonshot: 'Kimi (Moonshot)', zhipu: 'Zhipu GLM', siliconflow: 'SiliconFlow', hunyuan: 'Tencent Hunyuan', qianfan: 'Baidu Qianfan (ERNIE)', ollama: 'Ollama (local)', lmstudio: 'LM Studio (local)', vllm: 'vLLM (local)' };
  const provLabel = (id) => (id === 'custom' ? L('其他兼容接口 / 中转站', 'Other compatible API / relay') : (en && EN_LABEL[id]) || P.PROVIDERS[id].label);
  const draft = readJSON(SS, DRAFT) || {};
  const f0 = draft.form || {};

  main.innerHTML = `
  <section class="nw-hero" aria-labelledby="nw-h1">
    <p class="eyebrow"><a href="../index.html">${L('核磁共振', 'NMR')}</a> · ${L('逐步解谱讲解', 'Step-by-step walkthroughs')}</p>
    <h1 id="nw-h1">${L('逐步解谱讲解', 'Step-by-step NMR walkthroughs')}<span class="nw-h1-en" lang="en">${en ? '' : 'Click-to-advance NMR'}</span></h1>
    <p class="lead">${L('点一下，动一步：谱图放大并高亮一个信号，结构多长出一块，旁边给出“观察、依据、结论、核对”四句讲解。先看三个用实测数据做的示例；再贴上你自己的峰表，用你自己的大模型 API key 生成一份新的。',
      'One click, one step: the spectrum zooms to one signal, the structure grows by one piece, and four short beats (Observe, Rule, So, Check) explain it. Start with three examples built on measured data, then paste your own peak lists and generate a new one with your own model API key.')}</p>
    <ul class="nw-rules">
      <li><b>${L('数据必须真实。', 'Real data only.')}</b> ${L('讲解里的每个位移、J 值和相关峰都要来自你给的数据。生成后网页会逐个核对，你的数据里找不到的数一律标成 ≈（位移、J）或 *（二维峰），不当实测显示。', 'Every shift, J value and cross peak must come from the data you give. After generating, the page checks each number; any it cannot find in your data is marked ≈ (shifts, J) or * (2D peaks) and never shown as measured.')}</li>
      <li><b>${L('key 只在你的浏览器里。', 'Your key stays in your browser.')}</b> ${L('浏览器直接把请求发给你选的服务商，不经过 MolAstria 的服务器，也不进云同步。', 'The browser sends the request straight to the provider you choose, never through MolAstria’s servers, and the key is not synced.')}</li>
      <li><b>${L('谱线是示意图。', 'Line shapes are schematic.')}</b> ${L('按峰表画的洛伦兹线形加一级裂分：位移是真的，峰形不是原始谱。', 'Lorentzian lines with first-order splitting drawn from the peak list: the shifts are real, the shapes are not the raw spectrum.')}</li>
    </ul>
    <nav class="fs-jump" aria-label="${L('本页内容', 'On this page')}">
      <a class="button primary" href="#nw-examples">${L('看示例', 'Examples')}</a>
      <a class="button" href="#nw-make">${L('用自己的数据生成', 'Generate from your data')}</a>
      <a class="button" href="#nw-load">${L('打开已有的讲解', 'Open a walkthrough')}</a>
      <a class="button" href="#nw-about">${L('来源与许可', 'Source and licence')}</a>
    </nav>
  </section>

  <section class="nw-block" id="nw-examples" aria-labelledby="nw-ex-h" tabindex="-1">
    <h2 id="nw-ex-h">${L('三个示例', 'Three examples')}</h2>
    <p class="muted">${L('数据来源写在每个示例的归属表下面（两份是大学的学生实验报告，对不上的地方都已注明）。', 'The sources are listed under each example’s assignment table (two are university lab reports; every mismatch is noted).')}</p>
    <div class="nw-cards" id="nw-ex-cards"></div>
  </section>

  <section class="nw-block nw-stage-block" id="nw-stage-block" aria-labelledby="nw-stage-h" tabindex="-1">
    <div class="nw-stage-head">
      <h2 id="nw-stage-h"><span id="nw-stage-title">${L('讲解', 'Walkthrough')}</span></h2>
      <div class="nw-btns">
        <button type="button" class="button" id="nw-full">${L('全屏', 'Full screen')}</button>
        <button type="button" class="button" id="nw-dl-html">${L('下载网页', 'Download page')}</button>
        <button type="button" class="button" id="nw-dl-json">${L('下载 JSON', 'Download JSON')}</button>
      </div>
    </div>
    <p class="nw-hint muted">${L('在框里点谱图或“下一步”往下走；键盘的 → 和空格也行。框里能换中文、English、双语和朗读。', 'Click the spectrum or Next inside the frame to advance; the → key and Space work too. The frame switches between Chinese, English and both, and can read aloud.')}</p>
    <div class="nw-report" id="nw-report" hidden></div>
    <div class="nw-frame-box" id="nw-frame-box"><iframe class="nw-frame" id="nw-frame" title="${L('逐步解谱讲解', 'NMR walkthrough')}" sandbox="allow-scripts"></iframe></div>
  </section>

  <section class="nw-block" id="nw-make" aria-labelledby="nw-make-h" tabindex="-1">
    <h2 id="nw-make-h">${L('用自己的数据生成', 'Generate from your own data')}</h2>
    <p class="muted">${L('贴上你测的（或讲义上给的）峰表，模型照上面三个示例的写法写一份讲解。没有数据只有化合物名字的话请先去找有出处的实测数据：这里不让模型凭记忆写数字。', 'Paste the peak lists you measured (or that your handout gives); the model writes a walkthrough in the style of the examples above. If you only have a compound name, find measured data with a source first: the model is not allowed to write numbers from memory here.')}</p>
    <form class="nw-form" id="nw-form" autocomplete="off">
      <div class="nw-grid">
        <label>${L('题目或化合物（可选）', 'Problem or compound (optional)')}<input id="nw-f-name" maxlength="160" value="${esc(f0.name || '')}" placeholder="${L('例如：CHMD11 第 2 题', 'e.g. Problem 2, week 3')}"></label>
        <label>${L('分子式', 'Molecular formula')}<input id="nw-f-formula" maxlength="60" value="${esc(f0.formula || '')}" placeholder="C8H8O3"></label>
        <label>${L('溶剂', 'Solvent')}<input id="nw-f-solvent" maxlength="40" value="${esc(f0.solvent || '')}" placeholder="CDCl3"></label>
        <label>${L('场强（¹H，MHz）', 'Field (¹H, MHz)')}<input id="nw-f-mhz" inputmode="numeric" maxlength="6" value="${esc(f0.mhz || '')}" placeholder="400"></label>
      </div>
      <label class="nw-wide">${L('峰表（必填，原样贴上：¹H、¹³C、DEPT、COSY、HSQC、HMBC……）', 'Peak lists (required, paste as given: ¹H, ¹³C, DEPT, COSY, HSQC, HMBC …)')}
        <textarea id="nw-f-data" rows="9" spellcheck="false" placeholder="${esc(L('¹H NMR (400 MHz, CDCl3): δ 6.97 (dq, J = 15.6, 6.9 Hz, 1H), 5.84 (dq, J = 15.6, 1.7 Hz, 1H), 4.18 (q, J = 7.1 Hz, 2H), 1.88 (dd, J = 6.9, 1.7 Hz, 3H), 1.28 (t, J = 7.1 Hz, 3H)\n¹³C NMR: δ 166.6, 144.5, 122.8, 60.1, 18.0, 14.3\nHMBC: 4.18 / 166.6; 1.88 / 144.5, 122.8',
          '¹H NMR (400 MHz, CDCl3): δ 6.97 (dq, J = 15.6, 6.9 Hz, 1H), 5.84 (dq, J = 15.6, 1.7 Hz, 1H), 4.18 (q, J = 7.1 Hz, 2H), 1.88 (dd, J = 6.9, 1.7 Hz, 3H), 1.28 (t, J = 7.1 Hz, 3H)\n¹³C NMR: δ 166.6, 144.5, 122.8, 60.1, 18.0, 14.3\nHMBC: 4.18 / 166.6; 1.88 / 144.5, 122.8'))}">${esc(f0.data || '')}</textarea></label>
      <div class="nw-grid">
        <label>${L('数据从哪里来（显示在归属表下面）', 'Where the data come from (shown under the table)')}<input id="nw-f-label" maxlength="200" value="${esc(f0.label || '')}" placeholder="${L('例如：我自己测的谱，2026-11-20；或讲义名', 'e.g. my own spectra, 2026-11-20; or the handout name')}"></label>
        <label>${L('已知答案（可选，给了就朝它讲）', 'Known answer (optional; the walkthrough explains towards it)')}<input id="nw-f-answer" maxlength="200" value="${esc(f0.answer || '')}" placeholder="${L('例如：(E)-丁-2-烯酸乙酯', 'e.g. ethyl (E)-but-2-enoate')}"></label>
      </div>
      <label class="nw-wide">${L('补充说明（可选）', 'Notes (optional)')}<input id="nw-f-notes" maxlength="400" value="${esc(f0.notes || '')}" placeholder="${L('例如：7.26 是溶剂峰；重点讲 HMBC', 'e.g. 7.26 is solvent; focus on the HMBC')}"></label>
      <div class="nw-imgs">
        <label class="button nw-file">${L('加谱图照片（可选，最多 4 张）', 'Add spectrum photos (optional, up to 4)')}<input type="file" id="nw-f-img" accept="image/*" multiple></label>
        <span class="muted" id="nw-img-list"></span>
        <p class="muted nw-small">${L('图片要用能看图的模型。图片里读出的数没法逐个核对，页面会注明；能贴文字就贴文字。', 'Images need a vision-capable model. Numbers read from images cannot be checked one by one and the page says so; paste text when you can.')}</p>
      </div>

      <fieldset class="nw-model">
        <legend>${L('模型和 API key', 'Model and API key')}</legend>
        <div class="nw-grid">
          <label>${L('服务商', 'Provider')}<select id="nw-prov">${order.map((id) => `<option value="${id}"${id === prefs.provider ? ' selected' : ''}>${esc(provLabel(id))}</option>`).join('')}</select></label>
          <label>${L('模型', 'Model')}<input id="nw-model" list="nw-models" spellcheck="false"><datalist id="nw-models"></datalist></label>
          <label class="nw-base" id="nw-base-wrap">${L('接口地址', 'Base URL')}<input id="nw-base" spellcheck="false" placeholder="https://…/v1"></label>
          <label>API key<input id="nw-key" type="password" spellcheck="false" autocomplete="off" placeholder="sk-…"></label>
        </div>
        <div class="nw-keyrow">
          <label class="nw-check"><input type="checkbox" id="nw-remember"${vault.remember ? ' checked' : ''}> ${L('在这台设备上记住 key', 'Remember the key on this device')}</label>
          <a id="nw-keyurl" target="_blank" rel="noopener">${L('去哪里拿 key', 'Get a key')} ${ext}</a>
          <button type="button" class="button" id="nw-import" hidden>${L('用论文工坊里存的 key', 'Use the key saved in Paper Studio')}</button>
          <button type="button" class="button" id="nw-clear">${L('清除 key', 'Forget keys')}</button>
        </div>
        <p class="muted nw-small">${L('一份讲解的回答约一两万 token，提示词约两万 token；花费按你的服务商计。key 不勾“记住”时只存在这个标签页里，关掉就没了。有的服务商不允许网页直接调用（CORS），遇到时换一家或用 OpenRouter。', 'One walkthrough is roughly 10–20k output tokens plus a ~20k-token prompt, billed by your provider. Unless you tick Remember, the key lives only in this tab. Some providers refuse calls from web pages (CORS); if so, try another one or OpenRouter.')}</p>
      </fieldset>

      <div class="nw-go">
        <button type="submit" class="button primary" id="nw-gen">${L('生成讲解', 'Generate walkthrough')}</button>
        <button type="button" class="button" id="nw-stop" hidden>${L('停止', 'Stop')}</button>
        <p class="nw-status" id="nw-status" role="status" aria-live="polite"></p>
      </div>
    </form>
  </section>

  <section class="nw-block" id="nw-load" aria-labelledby="nw-load-h" tabindex="-1">
    <h2 id="nw-load-h">${L('打开已有的讲解', 'Open a walkthrough you already have')}</h2>
    <p class="muted">${L('用 nmr-walkthrough 的 MCP 版本（编程助手写的）或者这一页下载的 JSON，都能在这里重新播放，不要 key。打开时同样校验，没有数据来源的不播放。', 'A JSON spec from the nmr-walkthrough MCP version (written by your coding agent) or downloaded from this page plays here too, no key needed. It is validated the same way; a spec without data sources is not played.')}</p>
    <div class="nw-btns"><label class="button nw-file">${L('选一个 .json 文件', 'Choose a .json file')}<input type="file" id="nw-load-file" accept=".json,application/json"></label></div>
    <p class="nw-status" id="nw-load-status" role="status" aria-live="polite"></p>
  </section>

  <section class="nw-block" id="nw-about" aria-labelledby="nw-about-h" tabindex="-1">
    <h2 id="nw-about-h">${L('来源与许可', 'Source and licence')}</h2>
    <p>${L(`这一页是站长的开源项目 <a href="${esc(G.upstream.repo)}" target="_blank" rel="noopener">nmr-walkthrough ${ext}</a>（MIT，版本 ${esc(G.upstream.version)}）的网页版：播放器、讲解方法、数据格式和三个示例都原样取自那个仓库。原版是一个 MCP 服务器加一个 Skill，让 Claude Code、Codex 等编程助手写讲解；这里改成用你自己的 API key 在浏览器里生成。`,
      `This page is the web version of the site owner’s open-source <a href="${esc(G.upstream.repo)}" target="_blank" rel="noopener">nmr-walkthrough ${ext}</a> (MIT, version ${esc(G.upstream.version)}): the player, the teaching method, the data format and the three examples are taken unchanged from that repository. The original is an MCP server plus a skill for coding agents such as Claude Code and Codex; here it runs in your browser with your own API key.`)}</p>
    <p>${L('讲解的写法学自 nmr.tips 的解答方式（一次只讲一个推理动作，先观察再下结论），只借鉴方法，没有用它的题目、文字或图片。', 'The way the steps are written follows how nmr.tips writes its solutions (one reasoning move at a time, observe before concluding); only the method is borrowed, none of its problems, text or figures.')}</p>
    <p><a href="LICENSE.txt" target="_blank" rel="noopener">${L('许可证（MIT）', 'Licence (MIT)')}</a> · <a href="../index.html">${L('核磁共振栏目', 'NMR section')}</a> · <a href="../nmrium/index.html">${L('NMRium 谱图处理', 'NMRium processing')}</a> · <a href="../../spectra/index.html#sp-practice">${L('谱图馆：练习题', 'Spectra Hall: practice problems')}</a> · <a href="../../paper/index.html">${L('论文工坊（同样用自己的 key）', 'Paper Studio (also bring your own key)')}</a></p>
  </section>`;

  // ── 播放 ──────────────────────────────────────────────────────────────
  const frame = $('#nw-frame');
  let template = null, current = null, currentReport = null;
  const theme = () => {
    const t = document.documentElement.dataset.theme;
    if (t === 'dark' || t === 'light') return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  async function loadTemplate() {
    if (template) return template;
    const r = await fetch('player.html');
    if (!r.ok) throw new Error(`player.html: HTTP ${r.status}`);
    template = await r.text();
    return template;
  }
  const clearHash = () => { if (/^#ex=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); };
  async function play(spec, { scroll = true, report = null } = {}) {
    const tpl = await loadTemplate();
    const withLang = { ...spec, lang: spec.lang || (en ? 'en' : 'both') };
    const { html } = W.standalone(tpl, withLang, { theme: theme() });
    frame.srcdoc = html;
    current = spec; currentReport = report;
    $('#nw-stage-title').innerHTML = fmt(T(spec.title));
    main.dataset.playing = W.slug(spec);
    renderReport(report);
    if (scroll) $('#nw-stage-block').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  new MutationObserver(() => { if (current) play(current, { scroll: false, report: currentReport }); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function renderReport(r) {
    const box = $('#nw-report');
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    const kind = { shift: L('位移', 'shift'), J: 'J', cross: L('二维峰', '2D peak') };
    const items = r.flagged.map((x) => `<li><code>${esc(x.id)}</code> · ${esc(kind[x.kind])} ${esc(x.value)} <span class="muted">(${esc(x.where)})</span></li>`).join('');
    box.hidden = false;
    box.dataset.kind = r.flagged.length ? 'warn' : 'ok';
    box.innerHTML = `<p><b>${r.flagged.length
      ? L(`核对：${r.checked} 个数里有 ${r.flagged.length} 个在你的数据里找不到，已改标成 ≈ / *，页面上不当实测显示。`, `Check: ${r.flagged.length} of ${r.checked} numbers are not in your data; they are now marked ≈ / * and not shown as measured.`)
      : L(`核对：${r.checked} 个数都能在你的数据里找到。`, `Check: all ${r.checked} numbers were found in your data.`)}</b>
      ${r.images ? L('你还附了图片：从图片读出的数只能和文字里的数对，没有文字时请对照原图看一遍。', 'You also attached images: numbers read from them can only be matched against your text, so compare with the originals.') : ''}
      ${L(`模型：${esc(r.model)}，约 ${r.tokens} token。`, `Model: ${esc(r.model)}, about ${r.tokens} tokens.`)}</p>
      ${items ? `<details><summary>${L('找不到的数', 'Numbers not found')}</summary><ul>${items}</ul></details>` : ''}
      ${r.warnings.length ? `<details><summary>${L(`写法上的提示（${r.warnings.length} 条，英文）`, `Teaching-quality hints (${r.warnings.length})`)}</summary><ul lang="en">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}`;
  }

  // 示例卡片
  $('#nw-ex-cards').innerHTML = G.examples.map((e) => {
    const s = e.spec, n = s.steps.length, sp = s.spectra.map((x) => (x.kind === '2d' ? x.type : String(x.nucleus).replace(/^(\d+)/, (d) => [...d].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')))).join(' · ');
    return `<article class="nw-card"><h3>${fmt(T(s.title))}</h3><p class="nw-formula">${esc(s.formula || '')}</p>
      <p class="muted">${esc(sp)} · ${L(`${n} 步`, `${n} steps`)}</p>
      <button type="button" class="button primary" data-ex="${esc(e.id)}">${L('播放', 'Play')}</button></article>`;
  }).join('');
  main.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ex]');
    if (!b) return;
    const e = G.examples.find((x) => x.id === b.dataset.ex);
    if (e) { play(e.spec).catch(fail); history.replaceState(null, '', `#ex=${e.id}`); }
  });
  function fail(e) { $('#nw-status').textContent = String(e?.message || e); $('#nw-status').dataset.kind = 'error'; }

  // 下载、全屏
  const download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  $('#nw-dl-html').addEventListener('click', async () => { if (current) download(W.slug(current) + '.html', W.standalone(await loadTemplate(), current).html, 'text/html'); });
  $('#nw-dl-json').addEventListener('click', () => { if (current) download(W.slug(current) + '.json', JSON.stringify(current, null, 1), 'application/json'); });
  $('#nw-full').addEventListener('click', () => { const b = $('#nw-frame-box'); (b.requestFullscreen || b.webkitRequestFullscreen)?.call(b); });

  // ── 打开已有的讲解 ─────────────────────────────────────────────────────
  $('#nw-load-file').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    const st = $('#nw-load-status');
    if (!file) return;
    try {
      const spec = JSON.parse(await file.text());
      const v = W.validate(spec);
      if (v.errors.length) { st.dataset.kind = 'error'; st.textContent = L('打不开：', 'Cannot open: ') + v.errors.slice(0, 4).join('; '); return; }
      st.dataset.kind = 'ok';
      st.textContent = L(`已打开：${file.name}`, `Opened: ${file.name}`) + (spec.unverified ? L('（作者注明数据未核对，页面上有红色提示）', ' (marked unverified by its author; the page shows a red notice)') : '');
      clearHash();
      await play(spec);
    } catch (e) { st.dataset.kind = 'error'; st.textContent = L('不是有效的 JSON：', 'Not valid JSON: ') + e.message; }
    ev.target.value = '';
  });

  // ── 模型和 key ─────────────────────────────────────────────────────────
  const provSel = $('#nw-prov'), modelIn = $('#nw-model'), keyIn = $('#nw-key'), baseIn = $('#nw-base');
  function syncProvider() {
    const id = provSel.value, d = P.PROVIDERS[id];
    $('#nw-models').innerHTML = d.models.map((m) => `<option value="${esc(m)}">`).join('');
    modelIn.value = prefs.models[id] || d.models[0] || '';
    keyIn.value = vault.keys[id] || '';
    keyIn.placeholder = d.keyOptional ? L('本机服务可以不填', 'optional for a local server') : 'sk-…';
    const needBase = d.custom || d.local;
    $('#nw-base-wrap').hidden = !needBase;
    baseIn.value = prefs.bases[id] || (d.custom ? '' : d.base);
    const ku = $('#nw-keyurl');
    ku.hidden = !d.keyUrl; if (d.keyUrl) ku.href = d.keyUrl;
    const pk = paperKeys()[id];
    $('#nw-import').hidden = !pk || pk === vault.keys[id];
  }
  syncProvider();
  provSel.addEventListener('change', () => { prefs.provider = provSel.value; savePrefs(); syncProvider(); });
  modelIn.addEventListener('change', () => { prefs.models[provSel.value] = modelIn.value.trim(); savePrefs(); });
  baseIn.addEventListener('change', () => { prefs.bases[provSel.value] = baseIn.value.trim(); savePrefs(); });
  keyIn.addEventListener('change', () => { const k = keyIn.value.trim(); if (k) vault.keys[provSel.value] = k; else delete vault.keys[provSel.value]; saveKeys(); syncProvider(); });
  $('#nw-remember').addEventListener('change', (ev) => { vault.remember = ev.target.checked; saveKeys(); });
  $('#nw-import').addEventListener('click', () => { const k = paperKeys()[provSel.value]; if (k) { vault.keys[provSel.value] = k; saveKeys(); syncProvider(); } });
  $('#nw-clear').addEventListener('click', () => { vault.keys = {}; try { LS?.removeItem(KEYS); SS?.removeItem(KEYS); } catch { /* 无 */ } syncProvider(); });

  // ── 图片 ──────────────────────────────────────────────────────────────
  let images = [];
  async function readImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(file.name)); i.src = url; });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return { name: file.name, mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.88).split(',')[1] };
    } finally { URL.revokeObjectURL(url); }
  }
  $('#nw-f-img').addEventListener('change', async (ev) => {
    const files = [...(ev.target.files || [])].slice(0, 4);
    images = [];
    for (const f of files) { try { images.push(await readImage(f)); } catch { /* 读不了的图跳过 */ } }
    $('#nw-img-list').textContent = images.length ? images.map((i) => i.name).join('、') : '';
    ev.target.value = '';
  });

  // ── 表单草稿 ───────────────────────────────────────────────────────────
  const FIELDS = ['name', 'formula', 'solvent', 'mhz', 'data', 'label', 'answer', 'notes'];
  const form = () => Object.fromEntries(FIELDS.map((k) => [k, $(`#nw-f-${k}`).value.trim()]));
  const saveDraft = (extra = {}) => writeJSON(SS, DRAFT, { ...(readJSON(SS, DRAFT) || {}), form: form(), ...extra });
  $('#nw-form').addEventListener('input', () => saveDraft());

  // ── 调用模型 ───────────────────────────────────────────────────────────
  const ERRS = {
    'no-key': ['这个服务商还没有填 API key。', 'This provider has no API key yet.'],
    'no-base': ['这个服务商要先填接口地址。', 'This provider needs a base URL first.'],
    auth: ['API key 不对，或者没有这个模型的权限（服务商返回 401 / 403）。', 'The API key was rejected, or it may not use this model (401 / 403).'],
    model: ['服务商说没有这个模型：换一个模型名。', 'The provider does not know this model: try another model name.'],
    quota: ['额度用完了或者请求太频繁（429）：稍后再试，或者看看服务商账户的余额。', 'Out of quota or rate-limited (429): try later, or check your provider balance.'],
    length: ['超出了这个模型的上下文或输出上限：换一个上下文更长的模型。', 'Too long for this model’s context or output limit: pick a model with a longer context.'],
    server: ['服务商那边出错了（5xx），稍后再试。', 'The provider had an error (5xx); try again later.'],
    network: ['连不上服务商：检查网络和接口地址。有的服务商不允许网页直接调用（CORS），可以换一家或用 OpenRouter；本机的 Ollama 要设置 OLLAMA_ORIGINS。', 'Could not reach the provider: check the network and base URL. Some providers refuse calls from web pages (CORS): try another or OpenRouter; a local Ollama needs OLLAMA_ORIGINS.'],
    empty: ['模型返回了空内容。', 'The model returned nothing.'],
    'no-json': ['模型的回答里没有 JSON。', 'The model’s answer contained no JSON.'],
    'bad-json': ['模型给的 JSON 不完整（可能被截断了）：换一个输出上限更大的模型再试。', 'The model’s JSON is incomplete (maybe cut off): try a model with a larger output limit.'],
    invalid: ['改了两次仍然没通过校验：', 'Still invalid after two fixes: '],
    'no-data': ['先贴上峰表（或者至少加一张谱图照片）。', 'Paste your peak lists first (or at least add a spectrum photo).'],
    other: ['调用失败。', 'The call failed.'],
  };
  const codeErr = (code, detail = '') => Object.assign(new Error(code), { code, detail });
  const scrub = (s) => { let t = String(s || ''); for (const k of Object.values(vault.keys)) if (k && k.length >= 8) t = t.split(k).join('***'); return t.replace(/\b(sk|key|AIza)[-_A-Za-z0-9]{16,}/g, '***'); };
  const explain = (e) => (e?.name === 'AbortError' ? L('已停止。', 'Stopped.') : (ERRS[e?.code] ? L(...ERRS[e.code]) : String(e?.message || e)) + (e?.detail ? ` ${e.detail}` : ''));
  const status = (text, kind = '') => { const s = $('#nw-status'); s.textContent = text; if (kind) s.dataset.kind = kind; else delete s.dataset.kind; };

  async function llm(messages, o) {
    const id = provSel.value, d = P.PROVIDERS[id];
    let maxTokens = 32000;
    for (let attempt = 0; ; attempt++) {
      let req;
      try { req = P.request({ provider: id, base: (d.custom || d.local) ? baseIn.value.trim() : '', key: vault.keys[id] || keyIn.value.trim(), model: modelIn.value.trim(), system: o.system, messages, images: o.images, maxTokens, temperature: 0.2, stream: true }); }
      catch (e) { throw codeErr(e.message); }
      let res;
      try { res = await fetch(req.url, { ...req.init, signal: o.signal, referrerPolicy: 'no-referrer', credentials: 'omit' }); }
      catch (e) { if (e?.name === 'AbortError') throw e; throw codeErr('network'); }
      if (!res.ok) {
        const body = scrub(await res.text().catch(() => ''));
        const code = P.errorCode(res.status, body);
        if (code === 'length' && maxTokens > 8192) { maxTokens = maxTokens > 16000 ? 16000 : 8192; continue; }
        if ((res.status === 429 || res.status >= 500) && attempt < 1 && !/insufficient|balance|credit|billing/i.test(body)) { await new Promise((r) => setTimeout(r, 3000)); continue; }
        throw codeErr(code, `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 200)}`);
      }
      const ct = res.headers.get('content-type') || '';
      let text = '', usage = { input: 0, output: 0, cacheRead: 0 };
      if (/json/i.test(ct) || !res.body) {
        const r = P.parseReply(d.kind, await res.json());
        text = r.text; usage = r.usage;
      } else {
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          buf += done ? dec.decode() : dec.decode(value, { stream: true });
          const { events, rest } = P.sseSplit(done ? buf + '\n\n' : buf);
          buf = rest;
          for (const ev of events) {
            const x = P.streamDelta(d.kind, ev);
            if (x.error) throw codeErr(P.errorCode(0, x.error), scrub(x.error).slice(0, 200));
            if (x.text) text += x.text;
            if (x.usage) usage = P.addUsage(usage, x.usage);
          }
          o.onText?.(text);
          if (done) break;
        }
      }
      if (!text.trim()) throw codeErr('empty');
      return { text, tokens: (usage.input || W.estTokens(o.system + JSON.stringify(messages))) + (usage.output || W.estTokens(text)) };
    }
  }

  let ctrl = null;
  $('#nw-stop').addEventListener('click', () => ctrl?.abort());
  $('#nw-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (ctrl) return;
    const f = form();
    if (!f.data && !images.length) { status(L(...ERRS['no-data']), 'error'); $('#nw-f-data').focus(); return; }
    const id = provSel.value, d = P.PROVIDERS[id];
    if (keyIn.value.trim() && keyIn.value.trim() !== vault.keys[id]) { vault.keys[id] = keyIn.value.trim(); saveKeys(); }
    if (!vault.keys[id] && !d.keyOptional && !d.custom) { status(L(...ERRS['no-key']), 'error'); keyIn.focus(); return; }
    if (!modelIn.value.trim()) { status(L('先填模型名。', 'Enter a model name first.'), 'error'); modelIn.focus(); return; }
    prefs.models[id] = modelIn.value.trim(); savePrefs(); saveDraft();
    ctrl = new AbortController();
    $('#nw-gen').disabled = true; $('#nw-stop').hidden = false;
    const t0 = Date.now();
    const system = W.systemPrompt(G);
    const messages = [{ role: 'user', content: W.userPrompt({ ...f, images: images.length }) }];
    const model = `${provLabel(id)} · ${modelIn.value.trim()}`;
    let tokens = 0;
    const onText = (t) => status(L(`正在写… 已收到 ${t.length.toLocaleString()} 个字符（${Math.round((Date.now() - t0) / 1000)} 秒）`, `Writing… ${t.length.toLocaleString()} characters received (${Math.round((Date.now() - t0) / 1000)} s)`));
    try {
      status(L('正在发给模型…', 'Sending to the model…'));
      let spec = null, v = null;
      for (let round = 0; round < 3; round++) {
        const r = await llm(messages, { system, images: round === 0 ? images : [], signal: ctrl.signal, onText });
        tokens += r.tokens;
        messages.push({ role: 'assistant', content: r.text });
        try { spec = W.extractJSON(r.text); }
        catch (e) {
          if (round === 2) throw codeErr(e.code || 'no-json');
          messages.push({ role: 'user', content: 'Your answer was not one valid JSON object. Output the complete spec as one valid JSON object only.' });
          status(L('回答不是有效的 JSON，请模型重写…', 'The answer was not valid JSON; asking the model to rewrite…'));
          continue;
        }
        v = W.validate(W.finalize(spec, {}));
        if (!v.errors.length) break;
        if (round === 2) throw codeErr('invalid', v.errors.slice(0, 5).join('; '));
        messages.push({ role: 'user', content: W.repairPrompt(v.errors, v.warnings) });
        status(L(`有 ${v.errors.length} 处没通过校验，请模型修改（第 ${round + 1} 次）…`, `${v.errors.length} validation errors; asking the model to fix them (round ${round + 1})…`));
      }
      const g = W.ground(spec, [f.data, f.formula, f.mhz, f.notes].join('\n'));
      const out = W.finalize(g.spec, { label: f.label, model, flagged: g.flagged, checked: g.checked, images: images.length, answerGiven: !!f.answer });
      const fin = W.validate(out);
      if (fin.errors.length) throw codeErr('invalid', fin.errors.slice(0, 5).join('; '));
      const report = { flagged: g.flagged, checked: g.checked, warnings: fin.warnings, images: images.length, model, tokens };
      saveDraft({ spec: out, report });
      status(L(`写好了：${out.steps.length} 步，用了 ${Math.round((Date.now() - t0) / 1000)} 秒。`, `Done: ${out.steps.length} steps in ${Math.round((Date.now() - t0) / 1000)} s.`), 'ok');
      clearHash();
      await play(out, { report });
    } catch (e) {
      status(explain(e), e?.name === 'AbortError' ? '' : 'error');
    } finally {
      ctrl = null;
      $('#nw-gen').disabled = false; $('#nw-stop').hidden = true;
    }
  });

  // ── 打开时 ─────────────────────────────────────────────────────────────
  const hash = location.hash.match(/^#ex=([\w-]+)/);
  const first = (hash && G.examples.find((e) => e.id === hash[1])) || null;
  if (first) play(first.spec, { scroll: false }).then(() => $('#nw-stage-block').scrollIntoView()).catch(fail);
  else if (draft.spec && !W.validate(draft.spec).errors.length) play(draft.spec, { scroll: false, report: draft.report || null }).catch(fail);
  else play(G.examples[0].spec, { scroll: false }).catch(fail);
})();
