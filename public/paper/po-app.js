/* 论文工坊的界面外壳（po-app.js）：页头、标签、用量和花费、设置（API key 只存在这台设备的浏览器里）、模型调用、学术检索、
   项目存档（IndexedDB），以及“写论文”标签。po-tabs.js 往 window.MOLASTRIA_PO_TABS 里登记科研工坊、投稿体检、LaTeX 助手三个标签，
   每个是 { id, n, zh, en, build(A, panel) }，A 是这里给的公共工具。
   key 只在 llm() 里交给 po-core.js 的 request()，请求由浏览器直接发给用户选的服务商；不经过 MolAstria 的账号服务，不进云同步，不写日志。
   页面文字自带中英两版（整页 translate="no"）。 */
(function () {
  'use strict';
  const P = window.MolAstriaPaper, W = window.MolAstriaPaperFlow, AU = window.MolAstriaPaperAudit;
  const PROMPTS = window.MOLASTRIA_PAPER_PROMPTS, TEMPLATES = window.MOLASTRIA_PAPER_TEMPLATES;
  const app = document.getElementById('po');
  if (!P || !W || !AU || !PROMPTS || !TEMPLATES || !app) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const T = (pair) => (Array.isArray(pair) ? (en ? pair[1] : pair[0]) : String(pair ?? ''));
  const STORE = 'molastria-paper', KEYSTORE = 'molastria-paper-keys';

  // ── 小工具 ───────────────────────────────────────────────────────────
  /** Element builder: text goes in as textContent, never as HTML. `value` is set after the children (so a <select> keeps it). */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    let value;
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    if (value !== undefined) el.value = value;
    return el;
  }
  /** append() 不认 null 和数组：这里先摊平、去掉空的。 */
  const add = (el, ...kids) => { for (const k of kids.flat(Infinity)) if (k != null && k !== false && k !== '') el.append(k.nodeType ? k : String(k)); return el; };
  const ico = (dir = '') => h('i', { class: `ico-ext${dir ? ' ico-' + dir : ''}`, 'aria-hidden': 'true' });
  const btn = (text, onclick, cls = '', attrs = {}) => h('button', { type: 'button', class: `po-btn ${cls}`.trim(), onclick, ...attrs }, text);
  const field = (label, control, cls = '') => h('label', { class: `po-f ${cls}`.trim() }, h('span', { text: label }), control);
  const sel = (options, value, attrs = {}) => h('select', { ...attrs, value: String(value ?? '') }, options.map(([v, t]) => h('option', { value: String(v), text: t })));
  const check = (label, checked, onchange, attrs = {}) => h('label', { class: 'po-check' }, h('input', { type: 'checkbox', checked: !!checked, onchange, ...attrs }), label);
  const card = (title, ...kids) => h('section', { class: 'po-card' }, title ? h('h2', { class: 'po-h2' }, title) : null, ...kids);
  const pre = (text, cls = 'po-pre') => h('pre', { class: cls, text });
  const tag = (text, kind) => h('span', { class: 'po-tag', 'data-kind': kind || null, text });
  const extLink = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text, ' ', ico());
  function status(el, msg, kind) {
    el.textContent = msg || '';
    el.dataset.bad = String(kind === 'bad');
    el.dataset.warn = String(kind === 'warn');
  }
  const wait = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
  const safeName = (s, d = 'paper') => String(s || d).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || d;
  function download(name, data, type = 'text/plain;charset=utf-8') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function copyText(text, el) {
    try { await navigator.clipboard.writeText(text); if (el) { const t = el.textContent; el.textContent = L('已复制', 'Copied'); setTimeout(() => (el.textContent = t), 1400); } } catch { /* 剪贴板不可用 */ }
  }
  const fmtK = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(n || 0));
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  async function sha16(bytes) { try { return hex(await crypto.subtle.digest('SHA-256', bytes)).slice(0, 16); } catch { return ''; } }

  // ── 存储：偏好在 localStorage；key 勾了“记住”在 localStorage，否则在 sessionStorage（关掉标签页就没了）──────
  const store = (name) => { try { const s = window[name]; s.getItem('x'); return s; } catch { return null; } };
  const LS = store('localStorage'), SS = store('sessionStorage');
  const readJSON = (s, k) => { try { const v = s && JSON.parse(s.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
  const prefs = readJSON(LS, STORE) || {};
  for (const k of ['bases', 'models', 'routes']) if (!prefs[k] || typeof prefs[k] !== 'object') prefs[k] = {};
  function savePrefs(patch) {
    Object.assign(prefs, patch || {});
    try { LS?.setItem(STORE, JSON.stringify(prefs)); } catch { /* 隐私模式或存满了：只是下次不复原 */ }
  }
  const savedLocal = readJSON(LS, KEYSTORE);
  const vault = { remember: !!savedLocal, ...(savedLocal || readJSON(SS, KEYSTORE) || {}) };
  if (!vault.keys || typeof vault.keys !== 'object') vault.keys = {};
  function saveKeys() {
    const s = JSON.stringify({ keys: vault.keys, s2: vault.s2 || '' });
    try {
      if (vault.remember) { LS?.setItem(KEYSTORE, s); SS?.removeItem(KEYSTORE); }
      else { SS?.setItem(KEYSTORE, s); LS?.removeItem(KEYSTORE); }
    } catch { /* 存不下：这次会话内仍然在内存里 */ }
    emit('settings');
  }
  function clearKeys() {
    vault.keys = {}; vault.s2 = '';
    try { LS?.removeItem(KEYSTORE); SS?.removeItem(KEYSTORE); } catch { /* 无 */ }
    emit('settings');
  }
  const routeSettings = () => ({ keys: vault.keys, bases: prefs.bases, routes: prefs.routes, fallback: prefs.fallback || '', models: prefs.models });
  const configured = () => Object.keys(P.PROVIDERS).filter((p) => { const d = P.PROVIDERS[p]; return !!vault.keys[p] || ((d.keyOptional || d.custom) && !!prefs.bases[p]); });
  const ready = () => !!P.resolveTask('outline', routeSettings());

  // ── 消息 ──────────────────────────────────────────────────────────────
  const handlers = {};
  const on = (name, fn) => (handlers[name] = handlers[name] || []).push(fn);
  function emit(name, data) { for (const fn of handlers[name] || []) { try { fn(data); } catch (e) { console.error(e); } } }

  // ── 模型调用 ───────────────────────────────────────────────────────────
  const ERRS = {
    'no-provider': ['还没有可用的模型：先在“设置”里填一个服务商的 API key。', 'No model yet: add an API key for a provider under Settings.'],
    'no-key': ['这个服务商还没有填 API key。', 'This provider has no API key yet.'],
    'no-base': ['这个服务商要先填接口地址。', 'This provider needs a base URL first.'],
    auth: ['API key 不对，或者没有这个模型的权限（服务商返回 401 / 403）。', 'The API key was rejected, or it may not use this model (401 / 403).'],
    model: ['服务商说没有这个模型：在“设置”里换一个模型名，或者点“测试连接”列出能用的模型。', 'The provider does not know this model: pick another under Settings, or use “Test connection” to list them.'],
    quota: ['额度用完了或者请求太频繁（429）：稍后再试，或者看看服务商账户的余额。', 'Out of quota or rate-limited (429): try later, or check the balance on the provider account.'],
    length: ['内容超出了这个模型的上下文或输出上限：换一个上下文更长的模型。', 'Too long for this model’s context or output limit: pick a model with a longer context.'],
    server: ['服务商那边出错了（5xx），稍后再试。', 'The provider had an error (5xx); try again later.'],
    network: ['连不上服务商：检查网络和接口地址。有的服务商不允许网页直接调用（CORS）；本机的 Ollama 要设置 OLLAMA_ORIGINS 允许这个网站。', 'Could not reach the provider: check the network and base URL. Some providers do not allow calls from a web page (CORS); a local Ollama needs OLLAMA_ORIGINS to allow this site.'],
    empty: ['模型返回了空内容。', 'The model returned nothing.'],
    other: ['调用失败。', 'The call failed.'],
  };
  function codeError(code, detail = '', route = null) {
    const e = new Error(code);
    e.code = code; e.detail = detail; e.route = route;
    return e;
  }
  /** 报错写成一句人话（不含 key）。 */
  function explain(e) {
    if (e?.name === 'AbortError') return L('已停止。', 'Stopped.');
    const base = ERRS[e?.code] ? T(ERRS[e.code]) : String(e?.message || e);
    const where = e?.route ? ` [${e.route.provider}:${e.route.model}]` : '';
    return base + where + (e?.detail ? ` ${e.detail}` : '');
  }
  /** 服务商的报错有时会把 key 原样带回来：显示之前抹掉。 */
  function scrub(text) {
    let s = String(text || '');
    for (const k of [...Object.values(vault.keys), vault.s2]) if (k && k.length >= 8) s = s.split(k).join('***');
    return s.replace(/\b(sk|key|AIza)[-_A-Za-z0-9]{16,}/g, '***');
  }
  const calls = [];
  async function readReply(res, kind, onText) {
    const ct = res.headers.get('content-type') || '';
    if (/json/i.test(ct) || !res.body) {
      const r = P.parseReply(kind, await res.json());
      onText?.(r.text);
      return { text: r.text, usage: r.usage };
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', usage = { input: 0, output: 0, cacheRead: 0 }, last = 0;
    for (;;) {
      const { value, done } = await reader.read();
      buf += done ? dec.decode() : dec.decode(value, { stream: true });
      const { events, rest } = P.sseSplit(done ? buf + '\n\n' : buf);
      buf = rest;
      for (const ev of events) {
        const d = P.streamDelta(kind, ev);
        if (d.error) throw codeError(P.errorCode(0, d.error), scrub(d.error).slice(0, 300));
        if (d.text) text += d.text;
        if (d.usage) usage = P.addUsage(usage, d.usage);
      }
      if (onText && (done || performance.now() - last > 120)) { last = performance.now(); onText(text); }
      if (done) break;
    }
    return { text, usage };
  }
  /** 一次模型调用。o: { system, prompt, temperature, images, maxTokens, label, signal, onText, step }。返回回答的文字。 */
  async function llm(task, o = {}) {
    const route = P.resolveTask(task, routeSettings());
    if (!route) throw codeError('no-provider');
    const prov = P.PROVIDERS[route.provider];
    let maxTokens = o.maxTokens || 16000;
    for (let attempt = 0; ; attempt++) {
      let req;
      try { req = P.request({ provider: route.provider, base: prefs.bases[route.provider] || '', key: vault.keys[route.provider] || '', model: route.model, system: o.system, prompt: o.prompt, temperature: o.temperature, images: o.images, maxTokens, stream: true }); }
      catch (e) { throw codeError(e.message, '', route); }
      const t0 = performance.now();
      let res;
      try { res = await fetch(req.url, { ...req.init, signal: o.signal, referrerPolicy: 'no-referrer', credentials: 'omit' }); }
      catch (e) {
        if (e?.name === 'AbortError') throw e;
        if (attempt < 1) { await wait(2000, o.signal); continue; }
        throw codeError('network', '', route);
      }
      if (!res.ok) {
        const body = scrub(await res.text().catch(() => ''));
        const code = P.errorCode(res.status, body);
        if (code === 'length' && maxTokens > 8192) { maxTokens = 8192; continue; }
        if ((res.status === 429 || res.status >= 500) && attempt < 2 && !/insufficient|balance|credit|billing/i.test(body)) { await wait(attempt ? 9000 : 3000, o.signal); continue; }
        throw codeError(code, `HTTP ${res.status} ${body.replace(/\s+/g, ' ').slice(0, 240)}`, route);
      }
      const out = await readReply(res, prov.kind, o.onText);
      const usage = { ...out.usage };
      let est = false;
      if (!usage.input) { usage.input = P.estTokens((o.system || '') + (o.prompt || '')); est = true; }
      if (!usage.output) { usage.output = P.estTokens(out.text); est = true; }
      calls.push({ task, label: o.label || task, step: o.step || task, run: o.run || '', provider: route.provider, model: route.model, usage, est, ms: Math.round(performance.now() - t0) });
      emit('usage');
      if (!out.text.trim()) { if (attempt < 1) continue; throw codeError('empty', '', route); }
      return out.text;
    }
  }

  // ── 学术检索（浏览器直接问，不要 key；Semantic Scholar 可以填自己的 key 提高限额）──────────────
  const SOURCES = P.SCHOLAR_ORDER.filter((s) => P.SCHOLAR[s].browser !== false);
  const GAP = { s2: 1100, crossref: 150, openalex: 120, europepmc: 150, dblp: 700 };
  const lastAt = {}, chain = {};
  function slot(src) {
    const p = (chain[src] || Promise.resolve()).then(async () => {
      const gap = src === 's2' && vault.s2 ? 350 : GAP[src] || 250;
      const d = (lastAt[src] || 0) + gap - Date.now();
      if (d > 0) await wait(d);
      lastAt[src] = Date.now();
    });
    chain[src] = p.catch(() => {});
    return p;
  }
  async function scholarFetch(src, url, signal) {
    for (let i = 0; ; i++) {
      await slot(src);
      const r = await fetch(url, { headers: src === 's2' && vault.s2 ? { 'x-api-key': vault.s2 } : {}, signal, referrerPolicy: 'no-referrer', credentials: 'omit' });
      if (r.status === 429 && i < 2) { await wait(3000 * (i + 1), signal); continue; }
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${P.SCHOLAR[src]?.label || src} HTTP ${r.status}`);
      return src === 'arxiv' ? r.text() : r.json();
    }
  }
  async function search(src, q, n = 6, cutoff = '', signal) {
    const d = await scholarFetch(src, P.SCHOLAR[src].search(q, n, cutoff), signal);
    return d ? P.normalize(src, d) : [];
  }
  /** 按标题找一篇：先问 Semantic Scholar 的 match，再问 OpenAlex。标题相似度 ≥ 0.9 才算。 */
  async function lookup(title, cutoff = '', signal) {
    try { const d = await scholarFetch('s2', P.SCHOLAR.s2.match(title), signal); const hit = d && P.normalize('s2', d)[0]; if (hit && P.similarity(hit.title, title) >= 0.9) return hit; } catch (e) { if (e?.name === 'AbortError') throw e; }
    try { const hits = await search('openalex', title, 3, cutoff, signal); const best = hits.find((x) => P.similarity(x.title, title) >= 0.9); if (best) return best; } catch (e) { if (e?.name === 'AbortError') throw e; }
    return null;
  }

  // ── 读文件 ────────────────────────────────────────────────────────────
  const TEXT_EXT = /\.(tex|bib|bbl|md|markdown|txt|log|csv|tsv|json|sty|cls|bst|cfg|py|m|r|jl|ya?ml|ipynb)$/i;
  /** 文字文件直接读；PDF / Word / PowerPoint / Excel 借用 AI 助手的读文件功能（第一次用时载入）。→ { name, text, kind, pages? } */
  async function readText(file) {
    if (TEXT_EXT.test(file.name) || /^text\//.test(file.type)) {
      if (file.size > 25e6) throw new Error(L(`“${file.name}”太大（超过 25 MB）`, `“${file.name}” is too large (over 25 MB)`));
      return { name: file.name, text: W.pyText(await file.text()), kind: 'text' };
    }
    const ai = await (window.ChemHub?.loadAI ? window.ChemHub.loadAI() : Promise.reject(new Error(L('读这种文件要联网载入阅读器', 'Reading this file type needs the reader, which did not load'))));
    const d = await ai.readFile(file);
    if (!d.text) throw new Error(L(`“${file.name}”是扫描件，没有文字层`, `“${file.name}” is a scan with no text layer`));
    return { name: d.name, text: d.text, kind: d.kind, pages: d.pages };
  }
  /** PDF 的作者字段（双盲检查用）。pdf.js 和 AI 助手用同一个版本。 */
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/';
  let pdfLib = null;
  async function pdfAuthor(file) {
    pdfLib = pdfLib || import(`${PDFJS}pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`; return m; }).catch((e) => { pdfLib = null; throw e; });
    const lib = await pdfLib;
    const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    try { const doc = await task.promise; const meta = await doc.getMetadata(); return String(meta?.info?.Author || ''); } finally { task.destroy?.(); }
  }
  /** 选文件 / 拖进来。onFiles(File[])。 */
  function fileBox({ accept = '', title, hint, onFiles, multiple = false, id }) {
    const input = h('input', { type: 'file', accept, hidden: true, multiple, id });
    const box = h('div', { class: 'po-drop', tabindex: '0', role: 'button', 'aria-label': title || L('选择文件', 'Choose a file') },
      h('b', { text: title || L('选择文件，或者拖到这里', 'Choose a file, or drop it here') }), hint ? h('small', { text: hint }) : null, input);
    box.addEventListener('click', () => input.click());
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.dataset.over = 'true'; });
    box.addEventListener('dragleave', () => { box.dataset.over = 'false'; });
    box.addEventListener('drop', (e) => { e.preventDefault(); box.dataset.over = 'false'; const f = [...(e.dataTransfer?.files || [])]; if (f.length) onFiles(multiple ? f : f.slice(0, 1)); });
    return box;
  }
  /** 图片缩到 ≤ max px 的 JPEG（给能看图的模型）→ { mime, data(base64) }。 */
  async function visionCopy(blob, max = 1280) {
    const img = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = h('canvas', { width: Math.max(1, Math.round(img.width * k)), height: Math.max(1, Math.round(img.height * k)) });
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    img.close?.();
    return { mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
  }

  // ── 模板 ──────────────────────────────────────────────────────────────
  const tplCache = {};
  /** 一个模板的全部文件（文字）。 */
  async function templateFiles(id) {
    if (tplCache[id]) return tplCache[id];
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) throw new Error(`template ${id}`);
    const out = {};
    await Promise.all(t.files.map(async (f) => {
      const r = await fetch(`templates/${id}/${f.name}`);
      if (!r.ok) throw new Error(L(`模板文件 ${f.name} 没有载入（HTTP ${r.status}）`, `Template file ${f.name} did not load (HTTP ${r.status})`));
      out[f.name] = W.pyText(await r.text());
    }));
    return (tplCache[id] = out);
  }
  const tplLabel = (t) => `${L(t.zh, t.en)}${t.missing.length ? L('（要自己下载会议样式文件）', ' (needs the venue style file)') : ''}`;
  const tplOptions = () => {
    const groups = [['journal', L('期刊', 'Journals')], ['conference', L('会议', 'Conferences')], ['contest', L('数学建模竞赛', 'Modelling contests')]];
    return groups.map(([k, label]) => h('optgroup', { label }, TEMPLATES.filter((t) => t.kind === k).map((t) => h('option', { value: t.id, text: tplLabel(t) }))));
  };

  /** 导出：zip 下载，或者在 Overleaf 开一个新项目（只能带文字文件）。files: [{ name, data }]。 */
  function exportZip(name, files) { download(`${safeName(name)}.zip`, new Blob([P.zip(files)], { type: 'application/zip' })); }
  function openOverleaf(files, mainTex) {
    const textFiles = files.filter((f) => typeof f.data === 'string' && !f.name.includes('/'));
    const form = h('form', { method: 'POST', action: 'https://www.overleaf.com/docs', target: '_blank', hidden: true });
    for (const [k, v] of P.overleafFields(textFiles, P.engineFor(mainTex))) form.append(h('input', { type: 'hidden', name: k, value: v }));
    document.body.append(form); form.submit(); form.remove();
    return files.filter((f) => typeof f.data !== 'string').length;
  }
  /** 一组体检结论 → 卡片。 */
  function renderChecks(rows) {
    return h('div', { class: 'po-checks' }, (rows || []).map((r) => h('div', { class: 'po-ck', 'data-state': r.state },
      h('b', {}, `${r.state === 'ok' ? L('通过', 'OK') : r.state === 'warn' ? L('待优化', 'Improve') : L('阻塞', 'Blocking')} · ${T(r.label)}`),
      T(r.detail) ? h('p', { text: T(r.detail) }) : null,
      r.items?.length ? h('ul', {}, r.items.slice(0, 60).map((x) => h('li', { text: T(x) }))) : null)));
  }
  function renderMarkdown(el, src) {
    el.innerHTML = P.markdown(src); // markdown() 只出转义过的 HTML（tools/paper-test.mjs 测了 XSS）
    for (const m of el.querySelectorAll('.po-mermaid')) m.title = L('Mermaid 流程图，按源码显示；可以贴到 mermaid.live 里看图', 'Mermaid diagram shown as source; paste it into mermaid.live to draw it');
    return el;
  }
  function diffView(a, b, from = 'before', to = 'after') {
    const lines = P.unifiedDiff(W.splitKeep(a), W.splitKeep(b), from, to);
    const box = h('div', { class: 'po-diff', role: 'region', 'aria-label': L('改动对照', 'Changes') });
    if (!lines.length) box.append(h('div', { text: L('（没有改动）', '(no changes)') }));
    for (const l of lines) box.append(h('div', { class: /^@@/.test(l) ? 'hunk' : /^\+(?!\+\+)/.test(l) ? 'add' : /^-(?!--)/.test(l) ? 'del' : null, text: l.replace(/\n$/, '') }));
    return box;
  }

  // ── 项目存档（IndexedDB；没有就只在这次打开的页面里）────────────────────────
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((resolve, reject) => {
      try {
        const r = indexedDB.open('molastria-paper', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'id' });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      } catch (e) { reject(e); }
    });
    return dbp;
  }
  async function dbDo(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('projects', mode), st = tx.objectStore('projects'), req = fn(st);
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const projects = {
    all: () => dbDo('readonly', (s) => s.getAll()).catch(() => []),
    put: (p) => dbDo('readwrite', (s) => s.put(p)).catch(() => {}),
    del: (id) => dbDo('readwrite', (s) => s.delete(id)).catch(() => {}),
  };

  // ── 页面骨架 ──────────────────────────────────────────────────────────
  const A = { h, add, L, T, en, ico, btn, field, sel, check, card, pre, tag, extLink, status, wait, download, copyText, safeName, fmtK, sha16,
    P, W, AU, PROMPTS, TEMPLATES, prefs, savePrefs, llm, explain, search, lookup, SOURCES, ready, configured, routeSettings,
    readText, pdfAuthor, fileBox, visionCopy, templateFiles, tplOptions, exportZip, openOverleaf, renderChecks, renderMarkdown, diffView, on, emit, calls };
  const tabs = [
    { id: 'write', n: 1, zh: '写论文', en: 'Write a paper', build: buildWrite },
    ...(window.MOLASTRIA_PO_TABS || []),
    { id: 'settings', n: 9, zh: '设置与 API key', en: 'Settings & API keys', build: buildSettings },
  ].sort((a, b) => a.n - b.n);

  app.append(
    h('header', { class: 'po-mast' },
      h('p', { class: 'po-eyebrow', text: 'PAPER STUDIO · BYOK' }),
      h('h1', {}, L('论文工坊', 'Paper Studio'), h('span', { text: L('Paper Studio', 'write · review · submit') })),
      h('p', { class: 'po-lead', text: L('用你自己的 API key，在浏览器里把一份想法和实验记录写成 LaTeX 论文：大纲、找真实文献并逐条核对、画图、写全文、几位“审稿人”打分，再按意见修改。另外有科研工坊（论文精读、文献综述、选题、复现、数学建模）、投稿体检和 LaTeX 助手。',
        'Bring your own API key and turn an idea and an experimental log into a LaTeX paper in the browser: outline, real literature found and checked, figures, the full text, a panel of reviewers, and revisions. Also: a research studio (close reading, literature review, topic ideas, reproduction, mathematical modelling), a submission check and a LaTeX copilot.') }),
      h('p', { class: 'po-credit' }, L('流程和提示词照 ', 'Pipeline and prompts follow '), extLink('https://github.com/FelixJiashengFu/paper-orchestra-studio', 'PaperOrchestra Studio'),
        L('（Apache-2.0，源自 Google Research 的 PaperOrchestra）在浏览器里重写；', ' (Apache-2.0, from Google Research’s PaperOrchestra), rebuilt for the browser; '),
        h('a', { href: 'THIRD-PARTY-paper-orchestra.md', target: '_blank', rel: 'noopener' }, L('来源和许可证', 'sources and licences')), L('。', '.')),
      h('div', { class: 'po-keynote' }, h('span', {}, h('b', { text: L('key 只在你的浏览器里。', 'Your key stays in your browser. ') }),
        L('调用由浏览器直接发给你选的服务商，不经过 MolAstria 的服务器，也不进云同步；花的是你自己账户的额度。生成的论文要你自己核对每一句和每个数字。',
          'Calls go straight from this page to the provider you pick, never through MolAstria’s servers or cloud sync, and use your own account’s credit. Check every sentence and number of the generated paper yourself.')))),
  );
  const tabBar = h('div', { class: 'po-tabs', role: 'tablist', 'aria-label': L('论文工坊', 'Paper Studio') });
  const meterEl = h('div', { class: 'po-meter', 'aria-live': 'polite', title: L(`价格按各家的列表价估算（核对于 ${P.PRICES_CHECKED}），不算免费额度和折扣`, `Estimated at list prices (checked ${P.PRICES_CHECKED}); free tiers and discounts not counted`) });
  app.append(h('div', { class: 'po-bar' }, tabBar, meterEl));
  const panels = {};
  for (const t of tabs) {
    const b = h('button', { type: 'button', class: 'po-tab', role: 'tab', id: `po-t-${t.id}`, 'aria-controls': `po-p-${t.id}`, 'aria-selected': 'false', onclick: () => show(t.id, true) }, h('b', { text: String(tabs.indexOf(t) + 1) }), L(t.zh, t.en));
    tabBar.append(b);
    const panel = h('section', { class: 'po-panel', id: `po-p-${t.id}`, role: 'tabpanel', 'aria-labelledby': `po-t-${t.id}`, hidden: true });
    app.append(panel);
    panels[t.id] = { t, b, panel, built: false };
  }
  function show(id, push) {
    if (!panels[id]) id = 'write';
    for (const [k, x] of Object.entries(panels)) { x.b.setAttribute('aria-selected', String(k === id)); x.panel.hidden = k !== id; }
    const x = panels[id];
    if (!x.built) { x.built = true; try { x.t.build(A, x.panel); } catch (e) { console.error(e); x.panel.append(h('p', { class: 'po-status', 'data-bad': 'true', text: String(e?.message || e) })); } }
    if (push && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    savePrefs({ tab: id });
    emit('tab', id);
  }
  A.go = (id) => { show(id, true); panels[id]?.panel.scrollIntoView({ block: 'start' }); };
  function meter() {
    const t = P.totals(calls);
    meterEl.dataset.none = String(!ready());
    meterEl.replaceChildren();
    if (!ready()) { meterEl.append(h('a', { href: '#settings', onclick: (e) => { e.preventDefault(); A.go('settings'); } }, L('还没有 API key：去设置', 'No API key yet: open Settings'))); return; }
    const money = P.fmtMoney(t.money);
    meterEl.append(L('本次打开 ', 'This visit '), h('b', { text: String(t.calls) }), L(' 次调用 · ', ' calls · '), h('b', { text: fmtK(t.input) }), ' / ', h('b', { text: fmtK(t.output) }), ' tokens',
      ...(money ? [' · ≈ ', h('b', { text: money })] : []), t.unpriced ? L(`（${t.unpriced} 次的模型不在价格表里）`, ` (${t.unpriced} unpriced)`) : '');
  }
  on('usage', meter);
  on('settings', meter);
  meter();

  // ── 设置 ──────────────────────────────────────────────────────────────
  function buildSettings(A, panel) {
    const MAIN = ['openai', 'anthropic', 'gemini', 'deepseek'];
    const cards = {};
    const provCard = (id) => {
      const d = P.PROVIDERS[id];
      const local = !!d.keyOptional, custom = !!d.custom;
      const keyIn = h('input', { type: 'password', class: 'mono', autocomplete: 'off', spellcheck: 'false', 'data-provider': id, placeholder: local ? L('本机服务一般不要 key', 'usually none for a local server') : L('粘贴你的 key', 'Paste your key'), value: vault.keys[id] || '', 'aria-label': `${d.label} API key` });
      const baseIn = h('input', { type: 'url', class: 'mono', spellcheck: 'false', placeholder: d.base || 'https://…/v1', value: prefs.bases[id] || '', 'aria-label': `${d.label} base URL` });
      const list = h('datalist', { id: `po-models-${id}` }, d.models.map((m) => h('option', { value: m })));
      const modelIn = h('input', { type: 'text', class: 'mono', list: `po-models-${id}`, spellcheck: 'false', placeholder: d.models[0] || L('模型名', 'model id'), value: prefs.models[id] || '', 'aria-label': L(`${d.label} 默认模型`, `${d.label} default model`) });
      const st = h('p', { class: 'po-status', 'aria-live': 'polite' });
      const useLocal = local ? check(L(`使用 ${d.label}`, `Use ${d.label}`), !!prefs.bases[id], (e) => { prefs.bases[id] = e.target.checked ? (baseIn.value.trim() || d.base) : ''; if (e.target.checked && !baseIn.value) baseIn.value = d.base; savePrefs(); emit('settings'); refresh(); }) : null;
      keyIn.addEventListener('change', () => { const v = keyIn.value.trim(); if (v) vault.keys[id] = v; else delete vault.keys[id]; saveKeys(); refresh(); });
      baseIn.addEventListener('change', () => { prefs.bases[id] = baseIn.value.trim(); savePrefs(); emit('settings'); refresh(); });
      modelIn.addEventListener('change', () => { prefs.models[id] = modelIn.value.trim(); savePrefs(); emit('settings'); });
      const test = async () => {
        status(st, L('正在连接…', 'Connecting…'));
        try {
          const m = P.modelsRequest(id, prefs.bases[id] || '', vault.keys[id] || '');
          const r = await fetch(m.url, { ...m.init, referrerPolicy: 'no-referrer', credentials: 'omit' });
          if (!r.ok) throw codeError(P.errorCode(r.status, await r.text().catch(() => '')), `HTTP ${r.status}`);
          const names = P.parseModels(id, await r.json());
          list.replaceChildren(...[...new Set([...d.models, ...names])].map((x) => h('option', { value: x })));
          status(st, L(`连上了，这个 key 能用 ${names.length} 个模型（填模型名时可以从下拉里选）。`, `Connected: ${names.length} models available (pick one from the list).`));
        } catch (e) { status(st, e?.code ? explain(e) : T(ERRS.network), 'bad'); }
      };
      const el = h('div', { class: 'po-pv' },
        h('header', {}, h('b', { text: d.label }), h('span', { class: 'po-tag-slot' }), d.keyUrl ? extLink(d.keyUrl, L('去拿 key', 'Get a key')) : null),
        h('div', { class: 'po-row' },
          local ? h('div', { class: 'po-f grow' }, useLocal) : field('API key', keyIn, 'grow'),
          field(L('默认模型', 'Default model'), modelIn, 'grow'), list,
          btn(L('测试连接', 'Test connection'), test, 'small')),
        (custom || local) ? h('div', { class: 'po-row' }, field(L('接口地址（OpenAI 兼容，到 /v1 为止）', 'Base URL (OpenAI-compatible, up to /v1)'), baseIn, 'full')) :
          h('details', {}, h('summary', { text: L('改接口地址（用代理或企业网关时）', 'Change the base URL (proxy or gateway)') }), h('div', { class: 'po-row' }, field(L('接口地址', 'Base URL'), baseIn, 'full'))),
        local ? h('p', { class: 'po-small', text: L(`本机服务要允许这个网站跨域访问，例如 Ollama 先设 OLLAMA_ORIGINS=${location.origin} 再启动。`, `A local server must allow this site (CORS); for Ollama set OLLAMA_ORIGINS=${location.origin} before starting it.`) }) : null,
        st);
      cards[id] = el;
      return el;
    };
    const rememberBox = check(L('在这台设备上记住 key（存在浏览器的 localStorage；公用电脑不要勾）', 'Remember keys on this device (browser localStorage; not on a shared computer)'), vault.remember, (e) => { vault.remember = e.target.checked; saveKeys(); });
    const s2In = h('input', { type: 'password', class: 'mono', autocomplete: 'off', spellcheck: 'false', value: vault.s2 || '', placeholder: L('可不填', 'optional'), 'aria-label': 'Semantic Scholar API key' });
    s2In.addEventListener('change', () => { vault.s2 = s2In.value.trim(); saveKeys(); });
    const others = Object.keys(P.PROVIDERS).filter((x) => !MAIN.includes(x));
    panel.append(
      card(L('你的 key 去了哪里', 'Where your key goes'),
        h('p', { class: 'po-p', text: L('key 只存在这台设备的浏览器里：勾了下面的“记住”存在 localStorage，不勾就只存在这个标签页（关掉就清掉）。调用模型时，浏览器把请求直接发给你选的服务商；MolAstria 的服务器收不到 key，也收不到你的论文。key 不进云同步、不写进项目存档和导出的文件。',
          'Keys live only in this browser: in localStorage if you tick “Remember”, otherwise only in this tab (gone when you close it). The browser sends each call straight to the provider you chose; MolAstria’s servers never see the key or your paper. Keys are not cloud-synced and are not saved in projects or exports.') }),
        h('div', { class: 'po-row' }, rememberBox, btn(L('清除全部 key', 'Clear all keys'), () => { clearKeys(); for (const i of panel.querySelectorAll('input[type=password]')) i.value = ''; refresh(); }, 'danger small')),
        h('p', { class: 'po-small', text: L('Anthropic 的接口在网页里调用要带 anthropic-dangerous-direct-browser-access 头（已经带上）：这表示 key 在你自己的浏览器里，别人打开这个页面拿不到。', 'Anthropic calls from a web page carry the anthropic-dangerous-direct-browser-access header (already set): it means the key sits in your own browser; nobody else opening this page can read it.') })),
      card(L('服务商', 'Providers'),
        h('p', { class: 'po-p', text: L('填一家就能用。每一步默认用哪个模型照 PaperOrchestra Studio 的路由（下面可以逐步改）。有的服务商不允许网页直接调用，“测试连接”会告诉你。', 'One provider is enough. Each step’s default model follows PaperOrchestra Studio’s routing (change it per step below). Some providers refuse calls from web pages; “Test connection” tells you.') }),
        h('div', { class: 'po-prov' }, MAIN.map(provCard)),
        h('details', {}, h('summary', { text: L(`更多服务商（${others.length} 家，含本机的 Ollama、LM Studio、vLLM 和中转站）`, `More providers (${others.length}, including local Ollama, LM Studio, vLLM and custom endpoints)`) }),
          h('div', { class: 'po-prov', style: 'margin-top:10px' }, others.map(provCard)))),
    );
    // 每一步用哪个模型
    const routeBox = h('div', { class: 'po-routes' });
    const allModels = h('datalist', { id: 'po-models-all' });
    const fallbackIn = h('input', { type: 'text', class: 'mono', list: 'po-models-all', spellcheck: 'false', value: prefs.fallback || '', placeholder: L('例如 deepseek:deepseek-v4-pro', 'e.g. deepseek:deepseek-v4-pro'), 'aria-label': L('所有步骤用同一个模型', 'One model for every step') });
    fallbackIn.addEventListener('change', () => { savePrefs({ fallback: fallbackIn.value.trim() }); emit('settings'); refresh(); });
    panel.append(card(L('每一步用哪个模型', 'Model for each step'),
      h('p', { class: 'po-p', text: L('写成“服务商:模型”，例如 anthropic:claude-sonnet-5-5；空着就自动选（灰字是现在会用的）。写作和修改用强一点的模型，检索词和筛选用便宜的就够。', 'Write “provider:model”, e.g. anthropic:claude-sonnet-5-5; leave empty for automatic (the grey text shows what would be used). Use a strong model for writing and revision; a cheap one is fine for search queries and screening.') }),
      h('div', { class: 'po-row' }, field(L('所有步骤都用这一个（逐步写的优先）', 'Use this one for every step (per-step entries win)'), fallbackIn, 'full')),
      routeBox, allModels,
      h('p', { class: 'po-small', text: L(`价格表照 PaperOrchestra Studio，核对于 ${P.PRICES_CHECKED}；顶上的花费只是估算。`, `Prices follow PaperOrchestra Studio, checked ${P.PRICES_CHECKED}; the cost at the top is an estimate.`) })));
    panel.append(card(L('学术检索', 'Literature search'),
      h('p', { class: 'po-p', text: L('找文献由浏览器直接问 OpenAlex、Semantic Scholar、Crossref、Europe PMC、dblp，不要 key。Semantic Scholar 没有 key 时一秒最多一次、常被限流，填了自己的 key 会快很多（semanticscholar.org/product/api 免费申请）。arXiv 的接口不许网页跨域读，OpenAlex 里已经有 arXiv 的预印本。', 'Search goes straight from the browser to OpenAlex, Semantic Scholar, Crossref, Europe PMC and dblp, no key needed. Without a key Semantic Scholar allows about one request a second and often rate-limits; your own free key (semanticscholar.org/product/api) is much faster. arXiv’s API cannot be read from a web page, but OpenAlex already lists arXiv preprints.') }),
      h('div', { class: 'po-row' }, field('Semantic Scholar API key', s2In, 'grow'))));
    function refresh() {
      for (const [id, el] of Object.entries(cards)) {
        const on = configured().includes(id);
        el.dataset.on = String(on);
        el.querySelector('.po-tag-slot').replaceChildren(on ? tag(L('已配置', 'set'), 'ok') : P.PROVIDERS[id].local ? tag(L('本机', 'local')) : '');
      }
      const opts = [];
      for (const p of configured()) for (const m of new Set([prefs.models[p], ...P.PROVIDERS[p].models].filter(Boolean))) opts.push(`${p}:${m}`);
      allModels.replaceChildren(...opts.map((v) => h('option', { value: v })));
      routeBox.replaceChildren();
      for (const t of P.TASKS) {
        const auto = P.resolveTask(t.id, { ...routeSettings(), routes: { ...prefs.routes, [t.id]: '' } });
        const inp = h('input', { type: 'text', class: 'mono', list: 'po-models-all', spellcheck: 'false', value: prefs.routes[t.id] || '', placeholder: auto ? `${L('自动', 'auto')}: ${auto.provider}:${auto.model}` : L('还没有可用的模型', 'no model yet'), 'aria-label': L(t.zh, t.en) });
        inp.addEventListener('change', () => { prefs.routes[t.id] = inp.value.trim(); savePrefs(); emit('settings'); refresh(); });
        routeBox.append(h('span', { text: L(t.zh, t.en) }), inp);
      }
    }
    refresh();
  }

  // ── 写论文 ────────────────────────────────────────────────────────────
  const EXAMPLE = {
    template: 'journal-acs-jctc-jpc-jcim',
    idea: `# Idea: a delta-learned correction for barrier heights of hydrogen-transfer reactions

NOTE: illustrative example input for trying the tool. The method and numbers below are made up, not real results.

## Problem
Semi-empirical GFN2-xTB barrier heights for hydrogen-atom transfer (HAT) are fast but carry errors of several kcal/mol against coupled-cluster references, which limits high-throughput screening of HAT catalysts.

## Method
- Train a small equivariant message-passing network to predict the difference between DLPNO-CCSD(T)/def2-TZVP and GFN2-xTB energies (delta learning) at reactant, transition-state and product geometries.
- Geometries from GFN2-xTB; transition states from a nudged-elastic-band search followed by a saddle-point refinement.
- Train on 1,200 reactions, validate on 150, test on 150, with a scaffold split so test reactions share no donor-acceptor pair with training.

## Claim
The correction brings barrier errors close to chemical accuracy while keeping the cost dominated by GFN2-xTB.
`,
    log: `# Experimental log

NOTE: illustrative example data for trying the tool, not real measurements.

## Test set (150 reactions), forward barrier heights vs DLPNO-CCSD(T)/def2-TZVP
| method | MAE (kcal/mol) | RMSE (kcal/mol) | max error (kcal/mol) |
|---|---|---|---|
| GFN2-xTB | 6.8 | 8.9 | 27.4 |
| GFN2-xTB + delta network | 1.4 | 1.9 | 7.2 |
| r2SCAN-3c | 2.9 | 3.7 | 12.1 |

## Learning curve (test MAE, kcal/mol) against number of training reactions
| training reactions | MAE |
|---|---|
| 100 | 3.9 |
| 200 | 2.9 |
| 400 | 2.2 |
| 800 | 1.7 |
| 1200 | 1.4 |

## Cost per reaction (wall time on one CPU core, seconds)
- GFN2-xTB geometries and NEB: 41
- delta network inference: 0.3
- DLPNO-CCSD(T) single points (reference): 5400
`,
  };
  const STEP_TITLES = {
    outline: ['大纲：章节、图、要找的文献', 'Outline: sections, figures, literature to find'],
    literature: ['找文献、核对、写引言与相关工作', 'Find and check literature, write the introduction and related work'],
    plots: ['画图（数据只取自实验记录）', 'Figures (numbers only from the experimental log)'],
    sections: ['写其余各节', 'Write the remaining sections'],
    refine: ['审稿与修改', 'Review and revise'],
  };
  function buildWrite(A, panel) {
    const blank = () => ({ id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: L('未命名论文', 'Untitled paper'), template: 'journal-nature', idea: '', log: '', guidelines: '', guidelinesEdited: false, cutoff: new Date().toISOString().slice(0, 7), sources: ['s2', 'openalex', 'crossref'], relevance: true, rounds: 2, reviewers: 3, figures: [], run: {}, finalTex: '', updated: Date.now() });
    let S = blank();
    let busy = null; // AbortController
    let saveTimer = 0;
    const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { S.updated = Date.now(); projects.put(S).then(listProjects); savePrefs({ project: S.id }); }, 600); };

    // 项目条
    const projSel = h('select', { 'aria-label': L('项目', 'Project') });
    const nameIn = h('input', { type: 'text', 'aria-label': L('项目名', 'Project name') });
    nameIn.addEventListener('input', () => { S.name = nameIn.value; persist(); });
    async function listProjects() {
      const all = (await projects.all()).sort((a, b) => b.updated - a.updated);
      if (!all.some((p) => p.id === S.id)) all.unshift(S);
      projSel.replaceChildren(...all.map((p) => h('option', { value: p.id, text: `${p.name || L('未命名', 'Untitled')} · ${new Date(p.updated).toLocaleDateString(en ? 'en' : 'zh-CN')}` })));
      projSel.value = S.id;
    }
    projSel.addEventListener('change', async () => { const p = (await projects.all()).find((x) => x.id === projSel.value); if (p) load(p); });
    panel.append(card(null, h('div', { class: 'po-row' },
      field(L('项目（存在这台设备的浏览器里）', 'Project (kept in this browser)'), projSel, 'grow'), field(L('名字', 'Name'), nameIn, 'grow'),
      btn(L('新建', 'New'), () => { if (!busy) load(blank()); }, 'small'),
      btn(L('删除这个项目', 'Delete project'), async () => { if (busy) return; await projects.del(S.id); const rest = (await projects.all()).sort((a, b) => b.updated - a.updated); load(rest[0] || blank()); }, 'small danger'))));

    // 输入
    const tplSel = h('select', { 'aria-label': L('模板', 'Template') }, tplOptions());
    const tplNote = h('p', { class: 'po-small' });
    const ideaIn = h('textarea', { rows: 9, placeholder: L('idea.md：要解决什么问题、方法、主要的说法。可以用中文写，论文会按模板的语言写。', 'idea.md: the problem, the method, the main claims.') });
    const logIn = h('textarea', { rows: 9, class: 'mono', placeholder: L('experimental_log.md：实验或计算的结果、表格、数字。论文里的每个数字都只能来自这里。', 'experimental_log.md: results, tables, numbers. Every number in the paper must come from here.') });
    const guideIn = h('textarea', { rows: 5, class: 'mono', placeholder: L('写作要求（默认是模板自带的 guidelines.md）', 'Writing guidelines (defaults to the template’s guidelines.md)') });
    const cutoffIn = h('input', { type: 'month' });
    const roundsSel = sel([[0, L('不修改', 'none')], [1, '1'], [2, '2'], [3, '3']], 2, { 'aria-label': L('修改轮数', 'Revision rounds') });
    const revSel = sel([[0, L('不审稿', 'no review')], [1, '1'], [2, '2'], [3, '3']], 3, { 'aria-label': L('审稿人数', 'Reviewers') });
    const srcBox = h('div', { class: 'po-row' });
    const relBox = check(L('让模型筛掉明显无关的文献', 'Let the model drop clearly off-topic papers'), true, (e) => { S.relevance = e.target.checked; persist(); });
    const figList = h('div', { class: 'po-files' });
    const inStatus = h('p', { class: 'po-status', 'aria-live': 'polite' });
    const loadInto = (ta, key) => fileBox({ accept: '.md,.txt,.tex,.pdf,.docx,.csv,.json', title: L('或者读一个文件', 'or load a file'), hint: L('.md .txt .tex .pdf .docx', '.md .txt .tex .pdf .docx'), onFiles: async ([f]) => {
      try { const d = await readText(f); ta.value = d.text; S[key] = d.text; persist(); status(inStatus, L(`已读入 ${d.name}（${d.text.length} 字符）`, `Loaded ${d.name} (${d.text.length} characters)`)); } catch (e) { status(inStatus, String(e?.message || e), 'bad'); }
    } });
    ideaIn.addEventListener('input', () => { S.idea = ideaIn.value; persist(); });
    logIn.addEventListener('input', () => { S.log = logIn.value; persist(); });
    guideIn.addEventListener('input', () => { S.guidelines = guideIn.value; S.guidelinesEdited = true; persist(); });
    cutoffIn.addEventListener('change', () => { S.cutoff = cutoffIn.value; persist(); });
    roundsSel.addEventListener('change', () => { S.rounds = Number(roundsSel.value); persist(); });
    revSel.addEventListener('change', () => { S.reviewers = Number(revSel.value); persist(); });
    async function applyTemplate(fromUser) {
      const t = TEMPLATES.find((x) => x.id === tplSel.value) || TEMPLATES[0];
      S.template = t.id;
      tplNote.replaceChildren(); add(tplNote, t.venue ? L(`${t.venue.venue_name}：${t.venue.review_model || ''}，章节 ${(t.venue.section_order || []).join(' / ')}`, `${t.venue.venue_name}: ${t.venue.review_model || ''}, sections ${(t.venue.section_order || []).join(' / ')}`) : '',
        t.missing.length ? h('span', {}, ' ', L('没有放进来的会议样式文件（没有公开许可证），导出后自己下载：', 'Venue style files not bundled (no public licence); download them yourself: '), t.missing.map((m, i) => [i ? '、' : '', extLink(m.url, m.file)])) : null);
      if (fromUser || !S.guidelinesEdited) {
        try { const files = await templateFiles(t.id); { guideIn.value = files['guidelines.md'] || ''; S.guidelines = guideIn.value; S.guidelinesEdited = false; } } catch (e) { status(inStatus, String(e?.message || e), 'bad'); }
      }
      persist();
    }
    tplSel.addEventListener('change', () => applyTemplate(true));
    function drawSources() {
      srcBox.replaceChildren(h('span', { class: 'po-small', style: 'margin:0', text: L('检索：', 'Search: ') }), ...SOURCES.map((s) => check(P.SCHOLAR[s].label, S.sources.includes(s), (e) => { S.sources = SOURCES.filter((x) => (x === s ? e.target.checked : S.sources.includes(x))); persist(); })));
    }
    function drawFigs() {
      figList.replaceChildren(...S.figures.map((f, i) => h('span', { class: 'po-chip' }, h('span', { text: f.name }),
        h('input', { type: 'text', value: f.caption || '', placeholder: L('图注', 'caption'), 'aria-label': L(`${f.name} 的图注`, `Caption of ${f.name}`), style: 'width:220px;min-height:26px', oninput: (e) => { f.caption = e.target.value; persist(); } }),
        h('button', { type: 'button', 'aria-label': L(`去掉 ${f.name}`, `Remove ${f.name}`), onclick: () => { S.figures.splice(i, 1); drawFigs(); persist(); } }, '×'))));
    }
    const figBox = fileBox({ accept: 'image/png,image/jpeg,application/pdf', multiple: true, title: L('自己的图（示意图、照片等）', 'Your own figures (diagrams, photos)'), hint: L('PNG / JPG 会给模型看；PDF 只放进导出包。文件名就是论文里 \\includegraphics 用的名字。', 'PNG / JPG are shown to the model; PDFs only go into the export. The file name is what \\includegraphics uses.'), onFiles: async (files) => {
      for (const f of files) {
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const vision = /^image\//.test(f.type) ? await visionCopy(f) : null;
          S.figures = S.figures.filter((x) => x.name !== f.name).concat({ name: f.name.replace(/[^\w.-]+/g, '_'), caption: '', mime: f.type, bytes, vision });
        } catch (e) { status(inStatus, L(`${f.name} 读不出来`, `Could not read ${f.name}`), 'bad'); }
      }
      drawFigs(); persist();
    } });
    panel.append(h('div', { class: 'po-grid' },
      card(L('① 想法和实验记录', '① Idea and experimental log'),
        h('div', { class: 'po-row' }, field(L('模板', 'Template'), tplSel, 'grow'), btn(L('填入示例', 'Fill in an example'), () => { if (busy) return; S.template = EXAMPLE.template; tplSel.value = S.template; ideaIn.value = S.idea = EXAMPLE.idea; logIn.value = S.log = EXAMPLE.log; if (!S.name || /未命名|Untitled/.test(S.name)) { S.name = L('示例：HAT 能垒的 delta 学习', 'Example: delta-learned HAT barriers'); nameIn.value = S.name; } applyTemplate(true); status(inStatus, L('示例里的方法和数字都是编的，只用来试一试流程。', 'The example’s method and numbers are made up, only for trying the pipeline.'), 'warn'); }, 'small')),
        tplNote,
        h('h3', { class: 'po-h3', text: L('想法（idea.md）', 'Idea (idea.md)') }), ideaIn, loadInto(ideaIn, 'idea'),
        h('h3', { class: 'po-h3', text: L('实验记录（experimental_log.md）', 'Experimental log (experimental_log.md)') }), logIn, loadInto(logIn, 'log'),
        inStatus),
      h('div', {},
        card(L('② 写作要求和选项', '② Guidelines and options'),
          guideIn,
          h('div', { class: 'po-row' }, field(L('文献截止（年-月）', 'Literature cutoff (year-month)'), cutoffIn, 'm'), field(L('修改轮数', 'Revision rounds'), roundsSel, 's'), field(L('审稿人', 'Reviewers'), revSel, 's')),
          srcBox, h('div', { class: 'po-row' }, relBox),
          h('p', { class: 'po-small', text: L('一篇论文大约调用模型 20–60 次（看检索任务和修改轮数），用强模型写一篇通常在几美元以内；顶上实时显示花了多少。', 'A paper takes roughly 20–60 model calls (depending on search tasks and rounds); with a strong model that is usually a few US dollars. The bar at the top shows the running cost.') })),
        card(L('③ 自己的图（可选）', '③ Your own figures (optional)'), figBox, figList))));

    // 运行
    const runBtn = btn(L('开始写', 'Start writing'), () => run('outline'), 'primary');
    const stopBtn = btn(L('停止', 'Stop'), () => busy?.abort(), 'danger', { disabled: true });
    const runStatus = h('p', { class: 'po-status', 'aria-live': 'polite' });
    const steps = {};
    const stepsBox = h('div', { class: 'po-steps' });
    W.stepIds.forEach((id, i) => {
      const info = h('span', { class: 'po-stepinfo' });
      const again = btn(L('从这一步重跑', 'Rerun from here'), () => run(id === 'plots' ? 'literature' : id), 'small', { hidden: true });
      const body = h('div', { class: 'po-stepbody' });
      const el = h('article', { class: 'po-step', 'data-state': 'idle', id: `po-step-${id}` }, h('header', {}, h('h3', {}, h('b', { text: String(i + 1) }), T(STEP_TITLES[id])), info, again), body);
      steps[id] = { el, info, again, body };
      stepsBox.append(el);
    });
    const result = h('div', {});
    panel.append(card(L('④ 生成', '④ Generate'), h('div', { class: 'po-row' }, runBtn, stopBtn), runStatus, h('div', { style: 'margin-top:12px' }, stepsBox)), result);

    const stepCost = (id) => { const t = P.totals(calls.filter((c) => c.step === id && c.run === S.id)); return t.calls ? `${t.calls} ${L('次', 'calls')} · ${fmtK(t.input + t.output)} tokens${P.fmtMoney(t.money) ? ' · ≈ ' + P.fmtMoney(t.money) : ''}` : ''; };
    function setStep(id, state, info) {
      const s = steps[id];
      s.el.dataset.state = state;
      s.info.textContent = info ?? (state === 'running' ? L('进行中…', 'running…') : state === 'skipped' ? L('跳过', 'skipped') : stepCost(id));
      s.again.hidden = !!busy || !(state === 'done' || state === 'error');
    }
    const live = (id) => { let box = null; return (text) => { if (!box) { box = pre('', 'po-live'); steps[id].body.replaceChildren(box); } box.textContent = text.slice(-1600); box.scrollTop = box.scrollHeight; }; };

    // 每一步的结果
    function drawOutline() {
      const o = S.run.outline;
      const b = steps.outline.body;
      b.replaceChildren();
      if (!o) return;
      const ta = h('textarea', { rows: 12, class: 'mono', 'aria-label': 'outline.json' }, '');
      ta.value = JSON.stringify(o.outline, null, 2);
      const st = h('p', { class: 'po-status' });
      ta.addEventListener('change', () => { try { const v = JSON.parse(ta.value); S.run.outline = { outline: v, problems: P.checkOutline(v) }; status(st, L('大纲已改：从下一步重跑就会用改过的大纲。', 'Outline changed: rerun from the next step to use it.')); persist(); } catch { status(st, L('不是合法的 JSON，没有保存。', 'Not valid JSON; not saved.'), 'bad'); } });
      const secs = (o.outline.section_plan || []).map((s) => s.section_title || s.title || '').filter(Boolean);
      const figs = (o.outline.plotting_plan || []).length, tasks = P.searchTasks(o.outline).length;
      add(b, h('p', { class: 'po-p', text: L(`${secs.length} 节（${secs.join(' / ')}），${figs} 张图，${tasks} 个文献检索任务。`, `${secs.length} sections (${secs.join(' / ')}), ${figs} figures, ${tasks} literature search tasks.`) }),
        o.problems?.length ? h('p', { class: 'po-status', 'data-warn': 'true', text: L(`大纲不完整：${o.problems.join('，')}`, `Outline incomplete: ${o.problems.join(', ')}`) }) : null,
        h('details', {}, h('summary', { text: L('看 / 改 outline.json', 'View / edit outline.json') }), ta, st));
    }
    function drawLiterature() {
      const r = S.run.literature, b = steps.literature.body;
      b.replaceChildren();
      if (!r) return;
      const rows = r.papers.map((p) => h('tr', {}, h('td', { class: 'mono', text: p.key }), h('td', {}, p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer', text: p.title }) : p.title), h('td', { class: 'num', text: String(p.year || '') }), h('td', { text: p.venue || '' }), h('td', { text: p.section || '' })));
      add(b, h('p', { class: 'po-p', text: L(`找到并核对了 ${r.papers.length} 篇（每篇都来自检索结果，有摘要、在截止日期以前）${r.dropped.length ? `，模型筛掉 ${r.dropped.length} 篇无关的` : ''}。${r.wroteIntro ? '' : '引言没有写出来，下一步会一起写。'}`, `${r.papers.length} papers found and kept (all from search results, with abstracts, before the cutoff)${r.dropped.length ? `; ${r.dropped.length} off-topic ones dropped` : ''}.${r.wroteIntro ? '' : ' The introduction was not written; the next step writes it.'}`) }),
        h('details', {}, h('summary', { text: L('文献表', 'Reference list') }), h('div', { class: 'po-table' }, h('table', {}, h('thead', {}, h('tr', {}, ['key', L('题目', 'Title'), L('年', 'Year'), L('来源', 'Venue'), L('用在', 'Section')].map((x) => h('th', { text: x })))), h('tbody', {}, rows)))),
        r.dropped.length ? h('details', {}, h('summary', { text: L('被筛掉的', 'Dropped') }), h('ul', {}, r.dropped.map((d) => h('li', { text: `${d.title} — ${d.why}` })))) : null,
        h('div', { class: 'po-row' }, btn(L('下载 references.bib', 'Download references.bib'), () => download('references.bib', r.bib), 'small')));
    }
    function drawPlots() {
      const r = S.run.plots, b = steps.plots.body;
      b.replaceChildren();
      if (!r) return;
      const grid = h('div', { class: 'po-figs' });
      for (const f of r) {
        if (f.png) {
          const url = URL.createObjectURL(new Blob([f.png], { type: 'image/png' }));
          grid.append(h('figure', { class: 'po-fig' }, h('img', { src: url, alt: f.spec?.title || f.id }), h('figcaption', {}, h('b', { text: `${f.id}.png` }), ' ', f.spec?.caption || '',
            f.unverified?.length ? h('div', { class: 'po-warnline', text: L(`这些数字在实验记录里找不到，核对一下：${f.unverified.join(', ')}`, `Numbers not found in the log, check them: ${f.unverified.join(', ')}`) }) : null)));
        } else {
          const why = f.skipped === 'diagram' ? L('示意图：自己画好，用这个文件名上传到 ③', 'A diagram: draw it yourself and upload it under ③ with this file name') : f.skipped === 'bad-spec' ? L(`图的规格不对（${(f.problems || []).join(', ')}）`, `Bad chart spec (${(f.problems || []).join(', ')})`) : f.skipped === 'error' ? `${L('出错', 'Error')}: ${f.error}` : L(`实验记录里没有这张图要的数据：${f.skipped}`, `The log lacks the data for this figure: ${f.skipped}`);
          grid.append(h('figure', { class: 'po-fig' }, h('figcaption', {}, h('b', { text: f.id }), ' ', f.plan?.title || f.plan?.objective || '', h('div', { class: 'po-warnline', text: why }))));
        }
      }
      add(b, r.length ? grid : h('p', { class: 'po-p', text: L('大纲里没有要画的图。', 'The outline plans no figures.') }));
    }
    function drawSections() {
      const r = S.run.sections, b = steps.sections.body;
      b.replaceChildren();
      if (!r) return;
      add(b, h('p', { class: r.complete ? 'po-p' : 'po-status', 'data-warn': r.complete ? null : 'true', text: r.complete ? L(`全文 ${r.tex.length} 字符，有 \\end{document}。`, `Full text, ${r.tex.length} characters, ends with \\end{document}.`) : L('回答可能被截断了（没有 \\end{document}）：换一个输出上限更大的模型，或者从这一步重跑。', 'The reply may be cut off (no \\end{document}): use a model with a larger output limit, or rerun this step.') }));
    }
    function reviewTable(versions) {
      const axes = P.AXES.map(([a]) => a);
      return h('div', { class: 'po-table' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { text: L('版本', 'Version') }), axes.map((a) => h('th', { text: a })), h('th', { text: L('结果', 'Outcome') }))),
        h('tbody', {}, versions.map((v) => h('tr', {}, h('td', { text: `v${v.v}` }), axes.map((a) => h('td', { class: 'num', text: v.review && !('Error' in v.review) ? String(v.review[a] ?? '') : '—' })), h('td', { text: v.outcome || (v.v === 0 ? L('初稿', 'draft') : '') }))))));
    }
    const OUTCOME = { ACCEPTED_SCORE_INCREASE: ['留下：总分提高', 'kept: overall up'], ACCEPTED_NEUTRAL_IMPROVEMENT: ['留下：总分持平，分项涨的不少于跌的', 'kept: overall tied, sub-scores no worse'], REJECTED_SCORE_DECREASE: ['退回：总分下降，停止修改', 'reverted: overall down, stopped'], REJECTED_DEGRADATION: ['退回：总分持平但分项变差，停止修改', 'reverted: overall tied, sub-scores worse, stopped'], NO_LATEX: ['模型没有给出 LaTeX', 'no LaTeX from the model'], REVIEW_FAILED_KEPT_PREVIOUS: ['审稿失败，留上一版', 'review failed, kept previous'] };
    function drawRefine() {
      const r = S.run.refine, b = steps.refine.body;
      b.replaceChildren();
      if (!r) return;
      const vs = r.versions.map((v) => ({ ...v, outcome: v.v ? T(OUTCOME[r.worklogs?.[`v${v.v}`]?.outcome] || [r.worklogs?.[`v${v.v}`]?.outcome || '', '']) : '' }));
      const rev = r.review || {};
      const list = (x) => (Array.isArray(x) ? x : x ? [x] : []).map((s) => h('li', { text: typeof s === 'string' ? s : JSON.stringify(s) }));
      add(b, reviewTable(vs),
        'Error' in rev ? h('p', { class: 'po-status', 'data-bad': 'true', text: L(`审稿没有成功：${rev.Error}`, `Review failed: ${rev.Error}`) }) : null,
        rev.Weaknesses ? h('details', {}, h('summary', { text: L('最后一版的审稿意见', 'Review of the final version') }),
          rev.Summary ? h('p', { class: 'po-p', text: String(rev.Summary) }) : null,
          h('h3', { class: 'po-h3', text: 'Strengths' }), h('ul', {}, list(rev.Strengths)),
          h('h3', { class: 'po-h3', text: 'Weaknesses' }), h('ul', {}, list(rev.Weaknesses)),
          rev.Questions ? [h('h3', { class: 'po-h3', text: 'Questions' }), h('ul', {}, list(rev.Questions))] : null) : null,
        h('p', { class: 'po-small', text: L('审稿人读的是 LaTeX 源码（浏览器里不能编译 PDF），分数只是参考：它说明不了结论对不对。', 'Reviewers read the LaTeX source (the browser cannot compile a PDF); the scores are a guide, not a judgement of correctness.') }));
    }
    const finalTex = () => S.finalTex || S.run.refine?.tex || S.run.sections?.tex || '';
    async function exportFiles() {
      const tpl = TEMPLATES.find((t) => t.id === S.template);
      const tfiles = await templateFiles(S.template);
      const tex = finalTex();
      const files = [{ name: 'main.tex', data: tex }];
      const bib = S.run.literature?.bib || tfiles['references.bib'] || '';
      files.push({ name: 'references.bib', data: bib });
      for (const [n, d] of Object.entries(tfiles)) if (!['template.tex', 'guidelines.md', 'venue.json', 'references.bib'].includes(n)) files.push({ name: n, data: d });
      for (const f of S.run.plots || []) if (f.png) files.push({ name: `${f.id}.png`, data: f.png });
      for (const f of S.figures) files.push({ name: f.name, data: f.bytes });
      const runInfo = { template: S.template, cutoff: S.cutoff, outline: S.run.literature?.outline || S.run.outline?.outline || null, citation_map: S.run.literature?.citationMap || {}, worklog: S.run.refine?.worklogs || {}, reviews: (S.run.refine?.versions || []).map((v) => ({ version: v.v, review: v.review })), calls: calls.filter((c) => c.run === S.id).map(({ task, label, provider, model, usage, est }) => ({ task, label, provider, model, usage, estimated: est })) };
      files.push({ name: 'paperorchestra/run.json', data: JSON.stringify(runInfo, null, 2) });
      if (tpl?.missing?.length) files.push({ name: 'README-missing-files.txt', data: `This template needs these venue style files, which are not redistributable here. Download them and put them next to main.tex:\n\n${tpl.missing.map((m) => `${m.file}: ${m.url}`).join('\n')}\n` });
      return files;
    }
    function drawResult() {
      result.replaceChildren();
      const tex = finalTex();
      if (!tex) return;
      const ta = h('textarea', { rows: 22, class: 'mono', spellcheck: 'false', 'aria-label': 'main.tex' });
      ta.value = tex;
      ta.addEventListener('input', () => { S.finalTex = ta.value; persist(); });
      const st = h('p', { class: 'po-status', 'aria-live': 'polite' });
      const audit = P.citationAudit(tex, S.run.literature?.bib || '', S.run.literature?.meta || {});
      const sum = audit.summary;
      result.append(card(L('⑤ 论文', '⑤ The paper'),
        h('p', { class: 'po-p', text: L(`引用 ${sum.cited} 处，.bib 有 ${sum.bib_entries} 条，其中 ${sum.verified} 条带 DOI 或链接；${sum.missing_in_bib ? `${sum.missing_in_bib} 个引用键在 .bib 里找不到：${audit.missing_in_bib.join(', ')}` : '每个引用键都在 .bib 里'}。`, `${sum.cited} citations; the .bib has ${sum.bib_entries} entries, ${sum.verified} with a DOI or link; ${sum.missing_in_bib ? `${sum.missing_in_bib} keys missing from the .bib: ${audit.missing_in_bib.join(', ')}` : 'every key is in the .bib'}.`) }),
        ta,
        h('div', { class: 'po-row' },
          btn(L('下载 zip（LaTeX、.bib、模板文件、图）', 'Download zip (LaTeX, .bib, template files, figures)'), async () => { try { exportZip(S.name || 'paper', await exportFiles()); } catch (e) { status(st, String(e?.message || e), 'bad'); } }, 'primary'),
          btn(h('span', {}, L('在 Overleaf 打开', 'Open in Overleaf'), ' ', ico()), async () => { try { const left = openOverleaf(await exportFiles(), finalTex()); status(st, left ? L(`已在新标签页打开 Overleaf。图片不能这样带过去（${left} 个），在 Overleaf 里上传 zip 里的图。`, `Opened Overleaf in a new tab. Images cannot be sent this way (${left}); upload them from the zip.`) : L('已在新标签页打开 Overleaf。', 'Opened Overleaf in a new tab.'), left ? 'warn' : ''); } catch (e) { status(st, String(e?.message || e), 'bad'); } }),
          btn(L('送去投稿体检', 'Send to submission check'), () => { A.go('audit'); emit('to-audit', { tex: finalTex(), bib: S.run.literature?.bib || '', name: S.name, template: S.template }); }),
          btn(L('送去 LaTeX 助手', 'Send to the LaTeX copilot'), () => { A.go('copilot'); emit('to-copilot', { tex: finalTex(), name: 'main.tex' }); }),
          S.finalTex ? btn(L('撤销手改', 'Discard my edits'), () => { S.finalTex = ''; persist(); drawResult(); }, 'small') : null),
        st,
        h('p', { class: 'po-small', text: L('这是模型写的初稿。投出去之前，自己逐句核对每个说法、每个数字和每条文献；很多期刊要求声明用了 AI 写作工具。', 'This is a model-written draft. Before submitting, check every claim, number and reference yourself; many journals require you to declare AI writing tools.') })));
    }
    const drawAll = () => { drawOutline(); drawLiterature(); drawPlots(); drawSections(); drawRefine(); drawResult(); for (const id of W.stepIds) setStep(id, S.run[id] ? 'done' : 'idle', S.run[id] ? undefined : ''); };

    // 图：照期刊插图的画法（白底、坐标轴、刻度、Okabe–Ito 配色）
    async function drawChart(spec) {
      const Wd = 1320, Ht = 930, s = 3; // 打印成单栏宽（约 8.4 cm）时字号约 6–7 pt
      const c = h('canvas', { width: Wd, height: Ht });
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, Ht);
      g.scale(s, s);
      const w = Wd / s, ht = Ht / s, font = (px, bold) => `${bold ? '600 ' : ''}${px}px Helvetica, Arial, sans-serif`;
      const bar = spec.type === 'bar' || spec.type === 'hbar', horiz = spec.type === 'hbar';
      const series = spec.series || [];
      const cats = bar ? (spec.categories || []).map(String) : [];
      const m = { l: horiz ? 24 + Math.min(140, 5.2 * Math.max(0, ...cats.map((x) => x.length))) : 54, r: 12, t: spec.title ? 28 : 12, b: 42 };
      const pw = w - m.l - m.r, ph = ht - m.t - m.b;
      const tr = (log) => (v) => (log ? Math.log10(v) : v);
      const ys = series.flatMap((x) => (x.y || []).map((v, i) => [Number(v) - Number(x.err?.[i] || 0), Number(v) + Number(x.err?.[i] || 0)]).flat()).filter(Number.isFinite);
      const vy = tr(spec.logY);
      let yl = Math.min(...ys.map((v) => (spec.logY ? vy(Math.max(v, 1e-12)) : v))), yh = Math.max(...ys.map((v) => (spec.logY ? vy(Math.max(v, 1e-12)) : v)));
      if (bar && !spec.logY) { yl = Math.min(0, yl); yh = Math.max(0, yh); }
      const logTicks = (lo, hi) => { const a = Math.floor(lo + 1e-9), b = Math.ceil(hi - 1e-9); const ticks = []; for (let v = a; v <= Math.max(b, a + 1); v++) ticks.push(v); return { ticks, lo: a, hi: Math.max(b, a + 1) }; };
      const yt = spec.logY ? logTicks(yl, yh) : P.niceTicks(yl, yh, 5);
      let xt = null, vx = tr(spec.logX);
      if (!bar) { const xs = series.flatMap((x) => (x.x || []).map(Number)).filter(Number.isFinite).map((v) => (spec.logX ? vx(Math.max(v, 1e-12)) : v)); xt = spec.logX ? logTicks(Math.min(...xs), Math.max(...xs)) : P.niceTicks(Math.min(...xs), Math.max(...xs), 6); }
      const Y = (v) => { const t = (spec.logY ? vy(Math.max(v, 1e-12)) : v); return horiz ? m.l + ((t - yt.lo) / (yt.hi - yt.lo)) * pw : m.t + ph - ((t - yt.lo) / (yt.hi - yt.lo)) * ph; };
      const X = (v) => m.l + (((spec.logX ? vx(Math.max(v, 1e-12)) : v) - xt.lo) / (xt.hi - xt.lo)) * pw;
      const tickLabel = (v, log) => (log ? (v >= -3 && v <= 4 ? String(10 ** v >= 1 ? 10 ** v : Number((10 ** v).toPrecision(1))) : `1e${v}`) : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v) ? v.toExponential(1) : String(Number(v.toPrecision(6))));
      g.strokeStyle = '#222'; g.fillStyle = '#222'; g.lineWidth = 0.8; g.font = font(9.5);
      // 坐标轴和刻度
      g.beginPath(); g.moveTo(m.l, m.t); g.lineTo(m.l, m.t + ph); g.lineTo(m.l + pw, m.t + ph); g.stroke();
      g.textAlign = horiz ? 'center' : 'right'; g.textBaseline = horiz ? 'top' : 'middle';
      for (const v of yt.ticks) {
        const p = horiz ? m.l + ((v - yt.lo) / (yt.hi - yt.lo)) * pw : m.t + ph - ((v - yt.lo) / (yt.hi - yt.lo)) * ph;
        g.beginPath(); if (horiz) { g.moveTo(p, m.t + ph); g.lineTo(p, m.t + ph + 4); } else { g.moveTo(m.l - 3, p); g.lineTo(m.l, p); } g.stroke();
        if (horiz) g.fillText(tickLabel(v, spec.logY), p, m.t + ph + 5); else g.fillText(tickLabel(v, spec.logY), m.l - 5, p);
      }
      const n = series.length || 1;
      if (bar) {
        const band = (horiz ? ph : pw) / Math.max(1, cats.length), bw = (band * 0.72) / n;
        g.textAlign = horiz ? 'right' : 'center'; g.textBaseline = horiz ? 'middle' : 'top';
        cats.forEach((cat, i) => { const p = (horiz ? m.t : m.l) + band * (i + 0.5); if (horiz) g.fillText(cat.slice(0, 32), m.l - 7, p); else g.fillText(cat.slice(0, 18), p, m.t + ph + 7); });
        series.forEach((sr, k) => {
          g.fillStyle = P.PALETTE[k % P.PALETTE.length]; g.strokeStyle = '#222';
          (sr.y || []).forEach((v, i) => {
            if (v == null) return;
            const o = (horiz ? m.t : m.l) + band * i + band * 0.14 + bw * k, z = Y(spec.logY ? Math.max(1e-12, 10 ** yt.lo) : 0), p = Y(Number(v));
            if (horiz) g.fillRect(Math.min(z, p), o, Math.abs(p - z), bw); else g.fillRect(o, Math.min(z, p), bw, Math.abs(p - z));
            const e = Number(sr.err?.[i] || 0);
            if (e) { g.beginPath(); const a = Y(Number(v) - e), b = Y(Number(v) + e), cmid = o + bw / 2; if (horiz) { g.moveTo(a, cmid); g.lineTo(b, cmid); g.moveTo(a, cmid - 3); g.lineTo(a, cmid + 3); g.moveTo(b, cmid - 3); g.lineTo(b, cmid + 3); } else { g.moveTo(cmid, a); g.lineTo(cmid, b); g.moveTo(cmid - 3, a); g.lineTo(cmid + 3, a); g.moveTo(cmid - 3, b); g.lineTo(cmid + 3, b); } g.stroke(); }
          });
        });
      } else {
        g.textAlign = 'center'; g.textBaseline = 'top';
        for (const v of xt.ticks) { const p = m.l + ((v - xt.lo) / (xt.hi - xt.lo)) * pw; g.beginPath(); g.moveTo(p, m.t + ph); g.lineTo(p, m.t + ph + 3); g.stroke(); g.fillText(tickLabel(v, spec.logX), p, m.t + ph + 5); }
        series.forEach((sr, k) => {
          const col = P.PALETTE[k % P.PALETTE.length];
          const pts = (sr.x || []).map((x, i) => [Number(x), sr.y?.[i] == null ? null : Number(sr.y[i]), Number(sr.err?.[i] || 0)]).filter((p) => Number.isFinite(p[0]) && p[1] != null);
          g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.2;
          if (spec.type === 'line') { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); }
          g.lineWidth = 0.8;
          for (const [x, y, e] of pts) {
            if (e) { g.beginPath(); g.moveTo(X(x), Y(y - e)); g.lineTo(X(x), Y(y + e)); g.moveTo(X(x) - 3, Y(y - e)); g.lineTo(X(x) + 3, Y(y - e)); g.moveTo(X(x) - 3, Y(y + e)); g.lineTo(X(x) + 3, Y(y + e)); g.stroke(); }
            g.beginPath(); g.arc(X(x), Y(y), 2.2, 0, 2 * Math.PI); g.fill();
          }
        });
      }
      // 坐标轴标题、图题、图例
      g.fillStyle = '#222'; g.font = font(10.5);
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const xLab = horiz ? spec.yLabel : spec.xLabel, yLab = horiz ? spec.xLabel : spec.yLabel;
      if (xLab) g.fillText(String(xLab).slice(0, 90), m.l + pw / 2, ht - 8);
      if (yLab) { g.save(); g.translate(11, m.t + ph / 2); g.rotate(-Math.PI / 2); g.fillText(String(yLab).slice(0, 70), 0, 0); g.restore(); }
      if (spec.title) { g.font = font(10.5, true); g.fillText(String(spec.title).slice(0, 90), m.l + pw / 2, 16); }
      if (series.length > 1) {
        g.font = font(9); g.textAlign = 'left'; g.textBaseline = 'middle';
        series.forEach((sr, k) => { const y0 = m.t + 8 + k * 13; g.fillStyle = P.PALETTE[k % P.PALETTE.length]; g.fillRect(m.l + pw - 118, y0 - 4, 9, 8); g.fillStyle = '#222'; g.fillText(String(sr.name || `series ${k + 1}`).slice(0, 22), m.l + pw - 105, y0); });
      }
      const png = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
      return { png, vision: { mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] } };
    }

    // 跑：from 是从哪一步开始（前面的结果留着）
    async function run(from) {
      if (busy) return;
      if (!ready()) { status(runStatus, T(ERRS['no-provider']), 'bad'); return; }
      if (!S.idea.trim() || !S.log.trim()) { status(runStatus, L('先写想法和实验记录（可以点“填入示例”试试）。', 'Write the idea and the experimental log first (or try “Fill in an example”).'), 'bad'); return; }
      const order = W.stepIds;
      const startAt = order.indexOf(from);
      if (startAt > 0 && !S.run.outline) return run('outline');
      if (startAt > 2 && !S.run.literature) return run('literature');
      if (startAt > 3 && !S.run.sections) return run('sections');
      for (const id of order.slice(startAt)) delete S.run[id];
      S.finalTex = '';
      busy = new AbortController();
      const signal = busy.signal;
      runBtn.disabled = true; stopBtn.disabled = false;
      drawAll();
      const t0 = Date.now();
      const tfiles = await templateFiles(S.template).catch((e) => { status(runStatus, String(e?.message || e), 'bad'); return null; });
      if (!tfiles) { busy = null; runBtn.disabled = false; stopBtn.disabled = true; return; }
      const tpl = TEMPLATES.find((t) => t.id === S.template);
      let cur = from;
      const c = {
        idea: S.idea.trim(), log: S.log.trim(), guidelines: S.guidelines || tfiles['guidelines.md'] || '', templateTex: tfiles['template.tex'] || '', venue: tpl?.venue || null,
        cutoff: S.cutoff || new Date().toISOString().slice(0, 7), sources: S.sources.length ? S.sources : ['openalex'], relevance: S.relevance, concurrency: 3,
        maxRounds: S.rounds, reviewers: S.reviewers || 1, signal,
        llm: (task, o) => { const step = cur; const push = live(step); return llm(task, { ...o, signal, step, run: S.id, onText: (t) => { if (step === cur) push(t); } }); },
        search: (src, q, n, cut) => search(src, q, n, cut, signal),
        lookup: (t, cut) => lookup(t, cut, signal),
        log_: (e) => { if (e.kind === 'found') status(runStatus, L(`检索到 ${e.n} 篇候选，正在筛选…`, `${e.n} candidates found, screening…`)); else if (e.kind === 'tasks') status(runStatus, L(`${e.n} 个检索任务…`, `${e.n} search tasks…`)); },
        onRound: ({ v, review, outcome }) => status(runStatus, v ? L(`第 ${v} 轮修改：${T(OUTCOME[outcome] || [outcome, outcome])}，Overall ${review?.Overall ?? '—'}`, `Round ${v}: ${T(OUTCOME[outcome] || [outcome, outcome])}, Overall ${review?.Overall ?? '—'}`) : L(`初稿审稿：Overall ${review?.Overall ?? '—'}`, `Draft review: Overall ${review?.Overall ?? '—'}`)),
      };
      const step = async (id, fn, draw) => { cur = id; setStep(id, 'running'); status(runStatus, T(STEP_TITLES[id]) + L('…', '…')); const r = await fn(); S.run[id] = r; draw(); setStep(id, 'done'); persist(); return r; };
      try {
        if (startAt <= 0) await step('outline', () => W.stepOutline(c), drawOutline);
        const outline = S.run.outline.outline;
        if (startAt <= 2) {
          setStep('plots', 'running');
          const plotsP = (async () => {
            const r = await W.stepPlots({ ...c, llm: (task, o) => llm(task, { ...o, signal, step: 'plots', run: S.id }) }, outline);
            for (const f of r) if (f.spec) Object.assign(f, await drawChart(f.spec));
            S.run.plots = r; drawPlots(); setStep('plots', 'done');
          })();
          await step('literature', () => W.stepLiterature(c, outline), drawLiterature);
          await plotsP;
        }
        const lit = S.run.literature;
        if (startAt <= 3) {
          const figs = [...(S.run.plots || []).filter((f) => f.png).map((f) => ({ name: `${f.id}.png`, caption: f.spec.caption, image: f.vision })), ...S.figures.map((f) => ({ name: f.name, caption: f.caption || '', image: f.vision }))];
          await step('sections', () => W.stepSections(c, lit.outline, lit.citationMap, figs, lit.templateTex), drawSections);
        }
        if (S.reviewers > 0) await step('refine', () => W.stepRefine(c, S.run.sections.tex, lit.citationMap), drawRefine);
        else { setStep('refine', 'skipped'); }
        const t = P.totals(calls.filter((x) => x.run === S.id));
        status(runStatus, L(`写完了，用时 ${Math.round((Date.now() - t0) / 60000)} 分钟，${t.calls} 次调用${P.fmtMoney(t.money) ? '，约 ' + P.fmtMoney(t.money) : ''}。`, `Done in ${Math.round((Date.now() - t0) / 60000)} min, ${t.calls} calls${P.fmtMoney(t.money) ? ', about ' + P.fmtMoney(t.money) : ''}.`));
      } catch (e) {
        if (e?.name !== 'AbortError') console.error(e);
        setStep(cur, 'error', '');
        if (e?.message === 'outline-json') status(runStatus, L('模型给的大纲不是 JSON：从头重跑，或者换一个模型。', 'The outline was not JSON: rerun, or use another model.'), 'bad');
        else status(runStatus, explain(e), e?.name === 'AbortError' ? 'warn' : 'bad');
        for (const id of W.stepIds) if (steps[id].el.dataset.state === 'running') setStep(id, 'error', '');
      } finally {
        busy = null; runBtn.disabled = false; stopBtn.disabled = true;
        for (const id of W.stepIds) { const st = steps[id].el.dataset.state; setStep(id, st, st === 'done' ? undefined : st === 'idle' ? '' : steps[id].info.textContent); }
        drawResult(); persist();
      }
    }

    function load(p) {
      if (busy) return;
      S = { ...blank(), ...p, run: p.run || {}, figures: p.figures || [] };
      nameIn.value = S.name; tplSel.value = S.template; ideaIn.value = S.idea; logIn.value = S.log; guideIn.value = S.guidelines; cutoffIn.value = S.cutoff;
      roundsSel.value = String(S.rounds); revSel.value = String(S.reviewers); relBox.querySelector('input').checked = S.relevance !== false;
      drawSources(); drawFigs(); drawAll(); status(runStatus, ''); status(inStatus, '');
      if (!S.guidelines) applyTemplate(false);
      savePrefs({ project: S.id });
      listProjects();
    }
    let handed = false;
    on('handoff', (d) => {
      if (busy) return;
      handed = true;
      load({ ...blank(), name: d.title || blank().name, template: TEMPLATES.some((t) => t.id === d.recommendedTemplate) ? d.recommendedTemplate : 'journal-nature', idea: d.ideaMarkdown || '', log: d.experimentalLogMarkdown || '' });
      applyTemplate(true);
      status(inStatus, L('已从科研工坊交过来：检查一下想法和实验记录，再开始写。', 'Handed over from the research studio: check the idea and log, then start.'));
    });
    projects.all().then((all) => { if (handed) return listProjects(); const last = all.find((x) => x.id === prefs.project) || all.sort((a, b) => b.updated - a.updated)[0]; load(last || blank()); });
  }

  const start = (location.hash || '').slice(1) || prefs.tab || 'write';
  show(panels[start] ? start : 'write', false);
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (panels[id]) show(id, false); });
  // 顶栏脚本先跑，把版权那一行放进了 <main>：挪回最后
  const legal = app.querySelector(':scope > .cr-legal');
  if (legal) app.append(legal);
  document.body.classList.remove('js-render');
})();
