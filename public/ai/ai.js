/* ChemAI — DeepSeek / Meta Muse / OpenAI 兼容接口的浏览器端接入层与「AI 研究助手」抽屉。
   API key 只保存在当前浏览器（默认仅本次会话），请求直接发往所选服务商；配置了站点代理时改发代理；
   登录了 MolAstria Pro（pay/account.js）时多一个「MolAstria Pro」服务商，走账号服务的托管额度。
   Public API: ChemAI.chat(), ChemAI.retrieve(), ChemAI.openDrawer(), ChemAI.openSettings(), ChemAI.isReady(). */
(() => {
  'use strict';
  if (window.ChemAI) return;
  const SITE = window.CHEMHUB_AI_CONFIG || {};
  const link = (path) => (window.ChemHub?.link ? window.ChemHub.link(path) : new URL(path, new URL('..', document.currentScript?.src || location.href)).href);

  // ── providers ───────────────────────────────────────────────────────────
  // Prices: USD per 1M tokens, from Muse's own model catalog (2026-10). DeepSeek prices are not listed here.
  const PROVIDERS = {
    deepseek: {
      label: 'DeepSeek', base: 'https://api.deepseek.com', keyUrl: 'https://platform.deepseek.com/api_keys', keyHint: 'sk-…',
      models: [['deepseek-flash', 'DeepSeek V4.1 Flash · 快速'], ['deepseek-v4-pro', 'DeepSeek V4 Pro · 深度推理']],
      efforts: ['off', 'low', 'high', 'max'], json: true
    },
    muse: {
      label: 'Meta Muse', base: 'https://api.meta.ai/v1', keyUrl: 'https://dev.meta.ai/', keyHint: 'Meta Model API key',
      models: [['muse-spark-1.3', 'Muse Spark 1.3 · 通用'], ['muse-wonder-1.0', 'Muse Wonder 1.0 · 化学家（最强）'], ['muse-spark-1.2', 'Muse Spark 1.2']],
      efforts: ['off', 'low', 'medium', 'high', 'xhigh', 'max'], json: false,
      prices: { 'muse-wonder-1.0': [4, 20], 'muse-spark-1.3': [1.25, 4.25], 'muse-spark-1.2': [1.25, 4.25] }
    },
    custom: {
      label: '其他兼容接口', base: '', keyUrl: '', keyHint: 'API key', models: [], efforts: ['auto'], json: false
    }
  };
  if (SITE.proxy) PROVIDERS.proxy = { label: SITE.proxyLabel || '站点代理', base: SITE.proxy, models: [...PROVIDERS.deepseek.models, ...PROVIDERS.muse.models], efforts: ['off', 'low', 'high'], json: false, proxy: true };
  const EFFORT_LABEL = { off: '关闭思考（最快）', low: '低', medium: '中', high: '高', xhigh: '很高', max: '最高', auto: '由服务商决定' };

  // ── settings ────────────────────────────────────────────────────────────
  const STORE = 'chemhub-ai';
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
  // Hosted quota for signed-in Pro accounts; follows sign-in and sign-out without a reload.
  const proToken = () => safe(() => localStorage.getItem('molastria-session'), '') || '';
  const proAccount = () => (proToken() ? safe(() => JSON.parse(localStorage.getItem('molastria-account') || 'null'), null) : null);
  function syncHosted() {
    const a = proAccount();
    if (!a?.pro || !a.api) { delete PROVIDERS.hosted; return; }
    const names = Object.fromEntries([...PROVIDERS.deepseek.models, ...PROVIDERS.muse.models]);
    const models = (a.models || ['deepseek-flash']).map((id) => [id, names[id] || id]);
    PROVIDERS.hosted = { label: 'MolAstria Pro', base: `${a.api}/ai/chat`, models, efforts: ['off', 'low', 'high'], json: models.every(([id]) => id.startsWith('deepseek')), proxy: true, hosted: true, usage: a.usage };
  }
  syncHosted();
  document.addEventListener('molastria:account', syncHosted);
  // The account service reports "used/limit" after each hosted call; keep the cached account in step.
  function noteUsage(header) {
    const [asks, limit] = header.split('/').map(Number);
    const a = proAccount();
    if (!a || !Number.isFinite(asks) || !Number.isFinite(limit)) return;
    a.usage = { ...(a.usage || {}), asks, limit };
    safe(() => localStorage.setItem('molastria-account', JSON.stringify(a)));
    document.dispatchEvent(new CustomEvent('molastria:account', { detail: a })); // the account page's meter follows
  }
  const hostedLine = () => { const u = PROVIDERS.hosted?.usage; return u ? `免配 key · 本月剩余 ${Math.max(0, u.limit - u.asks)} 次` : '免配 key'; };
  function settings() {
    const saved = safe(() => JSON.parse(localStorage.getItem(STORE) || 'null'), null) || {};
    const provider = PROVIDERS[saved.provider] ? saved.provider : (PROVIDERS.hosted ? 'hosted' : SITE.proxy ? 'proxy' : (PROVIDERS[SITE.defaultProvider] ? SITE.defaultProvider : 'deepseek'));
    const s = {
      provider,
      models: Object.assign({ deepseek: 'deepseek-flash', muse: 'muse-spark-1.3', custom: '', proxy: 'deepseek-flash', hosted: 'deepseek-flash' }, saved.models || {}),
      customBase: saved.customBase || '',
      effort: Object.assign({ deepseek: 'low', muse: 'low', custom: 'auto', proxy: 'low', hosted: 'low' }, saved.effort || {}),
      remember: !!saved.remember,
      keys: saved.remember ? Object.assign({}, saved.keys || {}) : {}
    };
    // A Pro account beats a provider that has no key yet.
    if (PROVIDERS.hosted && s.provider !== 'hosted' && !isReady(s)) s.provider = 'hosted';
    return s;
  }
  function keyFor(s, provider = s.provider) {
    if (PROVIDERS[provider]?.proxy) return '';
    return s.keys[provider] || safe(() => sessionStorage.getItem(`${STORE}-key:${provider}`), '') || '';
  }
  function save(s, keyUpdates = {}) {
    for (const [p, k] of Object.entries(keyUpdates)) {
      safe(() => k ? sessionStorage.setItem(`${STORE}-key:${p}`, k) : sessionStorage.removeItem(`${STORE}-key:${p}`));
      if (k) s.keys[p] = k; else delete s.keys[p];
    }
    // Keys reach localStorage only while "remember" is ticked; unticking it rewrites the record without them.
    const keys = {};
    if (s.remember) for (const p of Object.keys(PROVIDERS)) { const k = keyFor(s, p); if (k) keys[p] = k; }
    safe(() => localStorage.setItem(STORE, JSON.stringify({ provider: s.provider, models: s.models, customBase: s.customBase, effort: s.effort, remember: s.remember, keys })));
    // Flag read by shared-nav.js for the header's status dot.
    safe(() => isReady(s) ? sessionStorage.setItem(`${STORE}-key`, '1') : sessionStorage.removeItem(`${STORE}-key`));
    document.dispatchEvent(new Event('chemhub:ai-config'));
  }
  const isReady = (s = settings()) => !!PROVIDERS[s.provider]?.proxy || (!!keyFor(s) && (s.provider !== 'custom' || (!!s.customBase && !!s.models.custom)));
  const modelOf = (s) => s.models[s.provider] || PROVIDERS[s.provider].models[0]?.[0] || '';
  function priceOf(model) {
    for (const p of Object.values(PROVIDERS)) if (p.prices?.[model]) return p.prices[model];
    return null;
  }
  function costOf(model, usage) {
    const p = priceOf(model);
    if (!p || !usage) return null;
    return (usage.prompt_tokens || 0) * p[0] / 1e6 + (usage.completion_tokens || 0) * p[1] / 1e6;
  }

  // ── transport ───────────────────────────────────────────────────────────
  function endpoint(s) {
    const p = PROVIDERS[s.provider];
    if (p.proxy) return p.base;
    const base = (s.provider === 'custom' ? s.customBase : p.base).trim().replace(/\/+$/, '');
    if (!/^https:\/\//i.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(base)) throw new Error('接口地址必须是 https:// 开头（本机调试可用 http://localhost）');
    return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  }
  function effortParams(provider, effort) {
    if (provider === 'deepseek' || provider === 'proxy' || provider === 'hosted') {
      if (effort === 'off') return { thinking: { type: 'disabled' } };
      return { reasoning_effort: effort === 'medium' ? 'high' : (['low', 'high', 'max'].includes(effort) ? effort : 'low') };
    }
    if (provider === 'muse') return { reasoning_effort: effort === 'off' ? 'minimal' : effort };
    return {};
  }
  function friendly(status, message) {
    const m = String(message || '').slice(0, 300);
    if (status === 401 || status === 403) return `API key 无效、已过期或没有该模型的权限（${status}）。${m}`;
    if (status === 402) return `账户余额不足（402）。${m}`;
    if (status === 404) return `接口地址或模型名不存在（404）。${m}`;
    if (status === 429) return `请求太频繁或额度已用尽（429），稍后再试。${m}`;
    if (status >= 500) return `服务商暂时不可用（${status}），稍后再试。${m}`;
    return `请求失败（${status}）。${m}`;
  }
  async function* sse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, cut).replace(/\r$/, '');
        buffer = buffer.slice(cut + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try { yield JSON.parse(data); } catch { /* keep-alive or partial noise */ }
      }
    }
  }

  /**
   * One chat completion, streamed.
   * @param {object} o - {messages, json, effort, maxTokens, temperature, signal, onDelta(text, full), onReasoning(text, full), provider, model}
   * @returns {Promise<{text, reasoning, usage, model, provider, cost, ms}>}
   */
  async function chat(o) {
    const s = settings();
    const provider = o.provider || s.provider;
    if (!PROVIDERS[provider]) throw new Error('未知的 AI 服务');
    const conf = { ...s, provider };
    if (!isReady(conf)) throw Object.assign(new Error('还没有配置 API key。点右上角「AI 助手」→ 设置，填入 DeepSeek 或 Muse 的 key。'), { code: 'no-key' });
    const model = o.model || modelOf(conf);
    const effort = o.effort || s.effort[provider];
    const body = { model, messages: o.messages, stream: true, stream_options: { include_usage: true }, max_tokens: o.maxTokens || 4096 };
    if (o.temperature !== undefined) body.temperature = o.temperature;
    const optional = { ...effortParams(provider, effort) };
    if (o.json && PROVIDERS[provider].json) optional.response_format = { type: 'json_object' };
    if (PROVIDERS[provider].proxy) body.provider = model.startsWith('muse') ? 'muse' : 'deepseek';
    const headers = { 'Content-Type': 'application/json' };
    const key = PROVIDERS[provider].hosted ? proToken() : keyFor(conf);
    if (key) headers.Authorization = `Bearer ${key}`;
    const url = endpoint(conf);
    const started = performance.now();
    let response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...body, ...optional }), signal: o.signal });
    if (response.status === 400 && Object.keys(optional).length) {
      // Some gateways reject the reasoning / JSON-mode fields; ask once more without them.
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: o.signal });
    }
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      const message = detail?.error?.message || detail?.message || '';
      // The account service writes its own plain-language errors (quota used up, signed out…).
      if (PROVIDERS[provider].hosted && message) throw Object.assign(new Error(T(message)), { status: response.status });
      throw Object.assign(new Error(friendly(response.status, message)), { status: response.status });
    }
    const used = response.headers.get('X-MolAstria-Usage');
    if (used) noteUsage(used);
    let text = '', reasoning = '', usage = null, served = model;
    const type = response.headers.get('content-type') || '';
    if (!type.includes('event-stream')) {
      const j = await response.json();
      text = j.choices?.[0]?.message?.content || '';
      reasoning = j.choices?.[0]?.message?.reasoning_content || j.choices?.[0]?.message?.reasoning || '';
      usage = j.usage || null; served = j.model || model;
      o.onDelta?.(text, text);
    } else {
      for await (const chunk of sse(response)) {
        if (chunk.error) throw new Error(chunk.error.message || '服务端返回错误');
        if (chunk.model) served = chunk.model;
        if (chunk.usage) usage = chunk.usage;
        const d = chunk.choices?.[0]?.delta;
        if (!d) continue;
        const r = d.reasoning_content ?? d.reasoning;
        if (r) { reasoning += r; o.onReasoning?.(r, reasoning); }
        if (d.content) { text += d.content; o.onDelta?.(d.content, text); }
      }
    }
    return { text, reasoning, usage, model: served, provider, cost: costOf(served, usage), ms: Math.round(performance.now() - started) };
  }

  /** Pull the first JSON object or array out of a model reply (code fences and prose tolerated). */
  function parseJSON(text) {
    const t = String(text || '').replace(/^﻿/, '');
    try { return JSON.parse(t); } catch {}
    const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) try { return JSON.parse(fenced[1]); } catch {}
    const start = t.search(/[[{]/);
    if (start < 0) throw new Error('回复中没有 JSON');
    const open = t[start], close = open === '{' ? '}' : ']';
    for (let end = t.lastIndexOf(close); end > start; end = t.lastIndexOf(close, end - 1)) {
      try { return JSON.parse(t.slice(start, end + 1)); } catch {}
    }
    throw new Error('无法解析模型返回的 JSON');
  }

  // ── retrieval over the site catalog ─────────────────────────────────────
  let catalogPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = () => reject(new Error(`无法载入 ${src}`));
      document.head.append(el);
    });
  }
  function ensureCatalog() {
    if (window.CHEMRESEARCH_DATA?.items) return Promise.resolve(window.CHEMRESEARCH_DATA);
    if (!catalogPromise) catalogPromise = loadScript(link('merged-data.js')).then(() => window.CHEMRESEARCH_DATA).catch((e) => { catalogPromise = null; throw e; });
    return catalogPromise;
  }
  let index = null;
  function buildIndex(data) {
    const names = new Map(data.sources.map((s) => [s.id, s.name]));
    return data.items.map((i) => ({
      item: i,
      sources: i.sourceIds.map((id) => names.get(id) || id),
      title: String(i.title || '').toLowerCase(),
      tags: [...(i.tags || []), i.category || '', ...(i.atlasRecords || []).map((r) => r.category)].join(' ').toLowerCase(),
      body: [i.excerpt, ...(i.atlasRecords || []).flatMap((r) => [r.name, r.description, r.detail])].join(' ').toLowerCase()
    }));
  }
  /** Latin words plus CJK bigrams, so "怎么分析静电势" still meets "静电势". */
  function terms(query) {
    const q = String(query || '').toLowerCase();
    const out = new Set(q.match(/[a-z0-9][a-z0-9+#.\-]{1,}/g) || []);
    for (const run of q.match(/[㐀-鿿]+/g) || []) {
      if (run.length <= 2) out.add(run);
      for (let i = 0; i + 2 <= run.length; i++) out.add(run.slice(i, i + 2));
      if (run.length >= 3) for (let i = 0; i + 3 <= run.length; i++) out.add(run.slice(i, i + 3));
    }
    const stop = new Set(['怎么', '如何', '什么', '哪些', '可以', '一个', '我们', '用什么', '推荐', '的是', '是什', '有哪', 'the', 'and', 'for', 'how', 'what', 'with']);
    return [...out].filter((t) => !stop.has(t));
  }
  async function retrieve(query, k = 12) {
    const data = await ensureCatalog();
    if (!index) index = buildIndex(data);
    const ts = terms(query);
    if (!ts.length) return [];
    const scored = [];
    for (const row of index) {
      let score = 0;
      for (const t of ts) {
        const w = t.length >= 3 ? 1.6 : 1;
        if (row.title.includes(t)) score += 5 * w;
        if (row.tags.includes(t)) score += 2.5 * w;
        if (row.body.includes(t)) score += 1 * w;
      }
      if (score > 0) {
        if (row.item.origins?.includes('atlas')) score *= 1.15;
        scored.push({ score, row });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(({ row }) => ({
      id: row.item.id, title: row.item.title, url: row.item.url, type: row.item.type, date: row.item.date || '',
      sources: row.sources, excerpt: String(row.item.excerpt || row.item.atlasRecords?.[0]?.description || '').slice(0, 260)
    }));
  }

  // ── tiny, safe markdown ─────────────────────────────────────────────────
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeURL = (v) => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
  function inline(text, refs) {
    let h = esc(text);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${esc(safeURL(u.replace(/&amp;/g, '&')))}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    if (refs) h = h.replace(/\[(\d{1,2}(?:\s*[,，]\s*\d{1,2})*)\]/g, (m, list) => list.split(/[,，]/).map((n) => {
      const r = refs[Number(n.trim()) - 1];
      return r ? `<a class="cai-cite" href="${esc(safeURL(r.url))}" target="_blank" rel="noopener noreferrer" title="${esc(r.title)}">${Number(n)}</a>` : esc(`[${n.trim()}]`);
    }).join(''));
    return h;
  }
  function markdown(src, refs) {
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    let html = '', list = null, code = null;
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const line of lines) {
      if (code !== null) {
        if (/^```/.test(line)) { html += `<pre><code>${esc(code)}</code></pre>`; code = null; } else code += (code ? '\n' : '') + line;
        continue;
      }
      if (/^```/.test(line)) { closeList(); code = ''; continue; }
      const h = line.match(/^(#{1,4})\s+(.*)/);
      if (h) { closeList(); html += `<h4>${inline(h[2], refs)}</h4>`; continue; }
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/);
      if (ul || ol) {
        const tag = ul ? 'ul' : 'ol';
        if (list !== tag) { closeList(); html += `<${tag}>`; list = tag; }
        html += `<li>${inline((ul || ol)[1], refs)}</li>`;
        continue;
      }
      closeList();
      if (line.trim()) html += `<p>${inline(line, refs)}</p>`;
    }
    if (code !== null) html += `<pre><code>${esc(code)}</code></pre>`;
    closeList();
    return html;
  }

  // ── styles ──────────────────────────────────────────────────────────────
  const CSS = `
.cai-drawer{position:fixed;top:0;right:0;bottom:0;z-index:80;width:min(460px,100vw);display:flex;flex-direction:column;background:var(--surface);color:var(--ink);border-left:1px solid var(--line);box-shadow:-18px 0 48px rgb(0 0 0/.12);font:14px/1.7 var(--font-sans);transform:translateX(102%);transition:transform .22s ease;visibility:hidden}
.cai-drawer[data-open=true]{transform:none;visibility:visible}
.cai-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}
.cai-head h2{margin:0;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.cai-chip{font-size:11.5px;color:var(--muted);border:1px solid var(--line);border-radius:3px;padding:1px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;background:var(--paper);cursor:pointer;font-family:inherit}
.cai-head .cai-sp{flex:1}
.cai-ib{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--muted);cursor:pointer;font-size:18px;line-height:1}
.cai-ib:hover{background:var(--surface-2);color:var(--ink)}
.cai-modes{display:flex;gap:4px;padding:10px 16px 0}
.cai-modes button{flex:1;font:600 12.5px/1 var(--font-sans);padding:9px 8px;border:1px solid var(--line);background:var(--paper);color:var(--muted);border-radius:4px;cursor:pointer}
.cai-modes button[aria-selected=true]{background:var(--accent-soft);color:var(--ink);border-color:var(--line-strong)}
.cai-log{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:14px;overscroll-behavior:contain}
.cai-msg{max-width:100%}
.cai-msg.user{align-self:flex-end;max-width:88%;background:var(--accent-soft);border:1px solid var(--line);border-radius:8px 8px 2px 8px;padding:8px 12px;white-space:pre-wrap;overflow-wrap:anywhere}
.cai-msg.bot{overflow-wrap:anywhere}
.cai-msg.bot p{margin:0 0 8px}.cai-msg.bot ul,.cai-msg.bot ol{margin:0 0 8px;padding-left:20px}.cai-msg.bot li{margin:2px 0}
.cai-msg.bot h4{margin:10px 0 6px;font-size:14px}
.cai-msg.bot pre{background:var(--paper);border:1px solid var(--line);border-radius:4px;padding:10px;overflow:auto;font:12px/1.6 var(--font-mono)}
.cai-msg.bot code{font-family:var(--font-mono);font-size:.92em;background:var(--surface-2);padding:0 4px;border-radius:3px}
.cai-msg.bot pre code{background:none;padding:0}
.cai-msg.bot a{color:var(--accent-text)}
.cai-who{font-size:11px;letter-spacing:.06em;color:var(--faint);margin-bottom:4px;display:flex;gap:8px;align-items:center}
.cai-cite{display:inline-grid;place-items:center;min-width:17px;height:17px;padding:0 4px;margin:0 1px;border-radius:9px;background:var(--accent-soft);color:var(--accent-text)!important;font-size:10.5px;font-weight:700;text-decoration:none;vertical-align:2px}
.cai-cite:hover{background:var(--accent);color:var(--accent-ink)!important}
.cai-think{font-size:12px;color:var(--muted);border-left:2px solid var(--line-strong);padding-left:10px;margin-bottom:8px}
.cai-think summary{cursor:pointer;color:var(--faint)}
.cai-think div{white-space:pre-wrap;max-height:180px;overflow:auto}
.cai-refs{margin-top:8px;border-top:1px dashed var(--line);padding-top:8px;display:grid;gap:4px;font-size:12px}
.cai-refs a{color:var(--ink-2);text-decoration:none;display:flex;gap:6px}
.cai-refs a:hover{color:var(--accent-text)}
.cai-refs b{color:var(--accent-text);min-width:18px}
.cai-refs small{color:var(--faint);margin-left:auto;white-space:nowrap}
.cai-usage{font-size:11px;color:var(--faint);margin-top:6px}
.cai-err{color:var(--danger);font-size:13px;border:1px solid color-mix(in srgb,var(--danger) 35%,transparent);background:color-mix(in srgb,var(--danger) 7%,transparent);padding:8px 10px;border-radius:4px}
.cai-welcome{border:1px dashed var(--line-strong);border-radius:6px;padding:14px;color:var(--muted);font-size:13px}
.cai-welcome strong{color:var(--ink)}
.cai-sugs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.cai-sugs button{font:12px/1.4 var(--font-sans);border:1px solid var(--line);background:var(--paper);color:var(--ink-2);border-radius:3px;padding:6px 9px;cursor:pointer;text-align:left}
.cai-sugs button:hover{border-color:var(--line-strong);background:var(--surface-2)}
.cai-compose{border-top:1px solid var(--line);padding:10px 12px 12px;display:grid;gap:8px}
.cai-compose textarea{width:100%;box-sizing:border-box;resize:none;min-height:64px;max-height:200px;border:1px solid var(--line-strong);border-radius:6px;background:var(--paper);color:var(--ink);font:14px/1.6 var(--font-sans);padding:9px 11px}
.cai-compose textarea:focus{outline:2px solid color-mix(in srgb,var(--accent-2) 55%,transparent);outline-offset:0}
.cai-row{display:flex;align-items:center;gap:8px}
.cai-row small{color:var(--faint);font-size:11px;margin-right:auto}
.cai-btn{font:600 12.5px/1 var(--font-sans);height:34px;padding:0 14px;border-radius:4px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.cai-btn:hover{background:var(--surface-2)}
.cai-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.cai-btn.primary:hover{background:var(--accent-hover)}
.cai-btn.danger{color:var(--danger)}
.cai-btn:disabled{opacity:.5;cursor:default}
.cai-settings{border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);padding:0;width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 32px);font:14px/1.7 var(--font-sans)}
.cai-settings::backdrop{background:rgb(10 20 15/.45);backdrop-filter:blur(2px)}
.cai-settings form{padding:22px 24px 20px;display:grid;gap:16px}
.cai-settings h2{margin:0;font-size:18px}
.cai-settings p.cai-note{margin:-8px 0 0;font-size:12.5px;color:var(--muted)}
.cai-prov{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.cai-prov label{border:1px solid var(--line);border-radius:6px;padding:10px 12px;cursor:pointer;background:var(--paper);display:grid;gap:2px}
.cai-prov label:has(input:checked){border-color:var(--accent-2);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent-2)}
.cai-prov input{position:absolute;opacity:0;pointer-events:none}
.cai-prov b{font-size:13.5px}.cai-prov small{font-size:11px;color:var(--muted)}
.cai-prov label:focus-within{outline:2px solid var(--gold);outline-offset:2px}
.cai-field{display:grid;gap:5px;font-size:12.5px;color:var(--muted)}
.cai-field input[type=text],.cai-field input[type=password],.cai-field input[type=url],.cai-field select{font:14px var(--font-sans);color:var(--ink);background:var(--paper);border:1px solid var(--line-strong);border-radius:4px;padding:9px 11px;min-height:40px;width:100%;box-sizing:border-box}
.cai-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cai-key{display:flex;gap:6px}.cai-key input{flex:1}
.cai-check{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--muted)}
.cai-check input{margin-top:4px}
.cai-status{font-size:12.5px;min-height:20px}
.cai-status[data-tone=ok]{color:var(--ok)}.cai-status[data-tone=err]{color:var(--danger)}
.cai-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cai-actions .cai-sp{flex:1}
.cai-fineprint{font-size:11.5px;color:var(--faint);line-height:1.7;border-top:1px solid var(--line);padding-top:12px}
@media(max-width:560px){.cai-two{grid-template-columns:1fr}.cai-drawer{width:100vw}}
@media(prefers-reduced-motion:reduce){.cai-drawer{transition:none}}
`;
  function installStyles() {
    if (document.getElementById('cai-style')) return;
    const style = document.createElement('style');
    style.id = 'cai-style';
    style.textContent = CSS;
    document.head.append(style);
  }

  // ── settings dialog ─────────────────────────────────────────────────────
  let dialog = null;
  function openSettings() {
    installStyles();
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'cai-settings';
      dialog.setAttribute('aria-labelledby', 'cai-settings-title');
      document.body.append(dialog);
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    }
    const s = settings();
    const providerCards = Object.entries(PROVIDERS).map(([id, p]) => `<label><input type="radio" name="provider" value="${id}" ${id === s.provider ? 'checked' : ''}><b>${esc(p.label)}</b><small>${id === 'deepseek' ? 'V4 Flash / V4 Pro' : id === 'muse' ? 'Spark / Wonder' : id === 'hosted' ? hostedLine() : id === 'proxy' ? '无需自备 key' : '填写接口地址'}</small></label>`).join('');
    dialog.innerHTML = `<form method="dialog" novalidate>
      <div><h2 id="cai-settings-title">AI 设置</h2></div>
      <p class="cai-note" data-note="own">选择服务商并填入你自己的 API key。key 只存在当前浏览器，请求从浏览器直接发往服务商，本站没有服务器经手。</p>
      <p class="cai-note" data-note="hosted" hidden>MolAstria Pro 托管额度：不需要 key，请求经 MolAstria 账号服务转发给 DeepSeek，账号服务只计次数、不保存对话。每次带出处的问答计 1 次，每月 1 日重置。</p>
      <fieldset class="cai-prov" style="border:0;padding:0;margin:0"><legend class="cai-field" style="margin-bottom:6px">服务商</legend>${providerCards}</fieldset>
      <div class="cai-two">
        <label class="cai-field">模型<select name="model"></select></label>
        <label class="cai-field">思考强度<select name="effort"></select></label>
      </div>
      <label class="cai-field" data-for="custom">接口地址（OpenAI 兼容，到 /v1 为止）<input type="url" name="customBase" placeholder="https://example.com/v1" value="${esc(s.customBase)}"></label>
      <label class="cai-field" data-for="custom">模型 ID<input type="text" name="customModel" placeholder="例如 qwen-max" value="${esc(s.models.custom)}"></label>
      <label class="cai-field" data-for="key">API key <span class="cai-key"><input type="password" name="key" autocomplete="off" spellcheck="false"><button type="button" class="cai-btn" data-act="reveal">显示</button></span><a data-keyurl target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--accent-text)"></a></label>
      <label class="cai-check" data-for="key"><input type="checkbox" name="remember" ${s.remember ? 'checked' : ''}><span>在这台设备上记住 key（存入本浏览器的 localStorage）。不勾选时，关掉标签页后 key 即清除。公用电脑请不要勾选。</span></label>
      <div class="cai-status" role="status" aria-live="polite"></div>
      <div class="cai-actions"><button type="button" class="cai-btn" data-act="test">测试连接</button><button type="button" class="cai-btn danger" data-act="clear">清除 key</button><span class="cai-sp"></span><button type="button" class="cai-btn" data-act="cancel">取消</button><button type="submit" class="cai-btn primary" data-act="save">保存</button></div>
      <div class="cai-fineprint">费用由你的服务商账户结算。参考价（美元 / 百万 token，输入 / 输出）：Muse Wonder 1.0 为 4 / 20，Muse Spark 1.3 为 1.25 / 4.25；DeepSeek 以官方价目为准。实验室里的「提出候选」每轮约 1 万 token。</div>
    </form>`;
    const f = dialog.querySelector('form');
    const status = dialog.querySelector('.cai-status');
    const setStatus = (text, tone = '') => { status.textContent = text; status.dataset.tone = tone; };
    const current = () => f.provider.value;
    const sync = () => {
      const id = current(), p = PROVIDERS[id];
      f.model.innerHTML = p.models.map(([v, l]) => `<option value="${esc(v)}" ${v === s.models[id] ? 'selected' : ''}>${esc(l)}</option>`).join('') || '<option value="">（在下方填写模型 ID）</option>';
      f.model.disabled = !p.models.length;
      f.effort.innerHTML = p.efforts.map((e) => `<option value="${e}" ${e === s.effort[id] ? 'selected' : ''}>${EFFORT_LABEL[e]}</option>`).join('');
      dialog.querySelectorAll('[data-for=custom]').forEach((el) => { el.hidden = id !== 'custom'; });
      dialog.querySelectorAll('[data-for=key]').forEach((el) => { el.hidden = !!p.proxy; });
      dialog.querySelector('[data-act=clear]').hidden = !!p.proxy;
      dialog.querySelector('[data-note=own]').hidden = !!p.hosted;
      dialog.querySelector('[data-note=hosted]').hidden = !p.hosted;
      f.key.value = keyFor(s, id);
      f.key.placeholder = p.keyHint || '';
      const a = dialog.querySelector('[data-keyurl]');
      a.hidden = !p.keyUrl; a.href = p.keyUrl || '#'; a.textContent = p.keyUrl ? `在 ${p.label} 控制台创建 key ↗` : '';
      setStatus('');
    };
    const collect = () => {
      const id = current();
      s.provider = id;
      if (PROVIDERS[id].models.length) s.models[id] = f.model.value;
      if (id === 'custom') { s.customBase = f.customBase.value.trim(); s.models.custom = f.customModel.value.trim(); }
      s.effort[id] = f.effort.value;
      s.remember = f.remember.checked;
      return { [id]: PROVIDERS[id].proxy ? '' : f.key.value.trim() };
    };
    f.addEventListener('change', (e) => { if (e.target.name === 'provider') { collect(); sync(); } });
    sync();
    f.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act || act === 'save') return;
      if (act === 'cancel') { dialog.close(); return; }
      if (act === 'reveal') { f.key.type = f.key.type === 'password' ? 'text' : 'password'; e.target.textContent = f.key.type === 'password' ? '显示' : '隐藏'; return; }
      if (act === 'clear') { f.key.value = ''; const id = current(); save(s, { [id]: '' }); setStatus('已清除这个服务商的 key。', 'ok'); return; }
      if (act === 'test') {
        save(s, collect());
        setStatus('正在测试…');
        try {
          const r = await chat({ messages: [{ role: 'user', content: 'Reply with the single word: ok' }], maxTokens: 40, effort: 'off' });
          setStatus(`连接成功：${r.model}，${r.ms} ms${r.usage ? `，用量 ${r.usage.total_tokens ?? '?'} token` : ''}。`, 'ok');
        } catch (err) { setStatus(err.message, 'err'); }
      }
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const keys = collect();
      if (s.provider === 'custom' && (!s.customBase || !s.models.custom)) { setStatus('自定义接口需要填写接口地址和模型 ID。', 'err'); return; }
      save(s, keys);
      dialog.close();
      refreshDrawer();
    });
    dialog.showModal();
    (PROVIDERS[current()].proxy ? f.model : f.key).focus();
  }

  // ── drawer ──────────────────────────────────────────────────────────────
  let drawer = null, mode = 'catalog', busy = null, lastFocus = null;
  const HISTORY = 'chemhub-ai-history';
  let history = safe(() => JSON.parse(sessionStorage.getItem(HISTORY) || 'null'), null) || { catalog: [], free: [] };
  const persist = () => safe(() => sessionStorage.setItem(HISTORY, JSON.stringify({ catalog: history.catalog.slice(-20), free: history.free.slice(-20) })));
  // Answers follow the page language; the catalogue itself is mostly Chinese, so English answers translate titles.
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const LANG_NOTE = () => document.documentElement.lang === 'en' ? '\n\nThe reader is using the English version of the site: answer in English (translate Chinese resource titles into English, keeping the [n] citations).' : '';
  const SUGGEST = {
    catalog: ['分析分子静电势用什么软件，有哪些教程？', '想查晶体结构，应该从哪些数据库开始？', '机器学习势函数有哪些开源训练数据集？', 'ORCA 计算激发态的入门资料'],
    free: ['电解液溶剂的氧化稳定性和 HOMO 有什么关系？', '解释 ωB97M-V 与 r²SCAN-3c 的差别和适用场景', '为什么 SCE 电位要换算到 Li/Li⁺？怎么换算？', '帮我写一段 RDKit 代码：按 InChIKey 去重 SMILES 列表']
  };
  const SYSTEM = {
    catalog: '你是 MolAstria（计算化学研究导航）的研究助手。用户提问后，系统会附上从本站目录检索到的条目，编号为 [1]、[2]…。\n规则：\n1. 推荐资源、教程、数据库、软件时，只能引用附上的条目，并在句末用 [编号] 标注出处；不要编造链接或条目。\n2. 附上的条目不足以回答时直接说明“本站目录里没有直接对应的条目”，可以补充一般性知识，但要标明“（目录外的一般知识）”。\n3. 用简体中文，先给结论，再分点说明；保持简洁，不超过 300 字，除非用户要求详细。',
    free: '你是一位严谨的计算化学与电化学研究助手，服务于 MolAstria 的访客。用简体中文回答；公式、方法名保留英文。给出可核查的依据，对不确定的数值明确说明不确定，不要编造文献、DOI 或数据。'
  };

  function buildDrawer() {
    installStyles();
    drawer = document.createElement('aside');
    drawer.className = 'cai-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'false');
    drawer.setAttribute('aria-labelledby', 'cai-title');
    drawer.innerHTML = `<div class="cai-head"><h2 id="cai-title"><span aria-hidden="true" style="color:var(--gold)">✦</span>AI 研究助手</h2><button type="button" class="cai-chip" data-act="settings" title="切换服务商或模型"></button><span class="cai-sp"></span><button type="button" class="cai-ib" data-act="clear" title="清空对话" aria-label="清空对话">⟲</button><button type="button" class="cai-ib" data-act="settings" title="AI 设置" aria-label="AI 设置">⚙</button><button type="button" class="cai-ib" data-act="close" aria-label="关闭">×</button></div>
      <div class="cai-modes" role="tablist" aria-label="提问方式"><button type="button" role="tab" data-mode="catalog">问目录（带出处）</button><button type="button" role="tab" data-mode="free">自由提问</button></div>
      <div class="cai-log" aria-live="polite"></div>
      <form class="cai-compose"><label class="sr-only" for="cai-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">输入问题</label><textarea id="cai-input" rows="2" placeholder="输入问题，回车发送，Shift+回车换行"></textarea><div class="cai-row"><small data-hint></small><button type="button" class="cai-btn danger" data-act="stop" hidden>停止</button><button type="submit" class="cai-btn primary">发送</button></div></form>`;
    document.body.append(drawer);
    drawer.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') closeDrawer();
      else if (act === 'settings') openSettings();
      else if (act === 'stop') busy?.abort();
      else if (act === 'clear') { history[mode] = []; persist(); renderLog(); }
      const m = e.target.closest('[data-mode]')?.dataset.mode;
      if (m) { mode = m; renderLog(); }
      const sug = e.target.closest('[data-sug]');
      if (sug) ask(sug.dataset.sug);
    });
    const input = drawer.querySelector('textarea');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); drawer.querySelector('form').requestSubmit(); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(200, input.scrollHeight)}px`; });
    drawer.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { input.value = ''; input.style.height = ''; ask(q); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.dataset.open === 'true' && !document.querySelector('dialog[open]')) closeDrawer(); });
    document.addEventListener('chemhub:ai-config', refreshDrawer);
  }
  function refreshDrawer() {
    if (!drawer) return;
    const s = settings();
    const chip = drawer.querySelector('.cai-chip');
    chip.textContent = isReady(s) ? `${PROVIDERS[s.provider].label} · ${modelOf(s)}` : '未配置 · 点此设置';
    drawer.querySelector('[data-hint]').textContent = mode === 'catalog' ? '先检索本站目录，再由 AI 作答并标注出处' : '直接与模型对话，不检索目录';
    renderLog();
  }
  function renderLog() {
    if (!drawer) return;
    drawer.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    drawer.querySelector('[data-hint]').textContent = mode === 'catalog' ? '先检索本站目录，再由 AI 作答并标注出处' : '直接与模型对话，不检索目录';
    const log = drawer.querySelector('.cai-log');
    const ready = isReady();
    const welcome = `<div class="cai-welcome">${ready ? '' : '<p style="margin:0 0 8px"><strong>先配置一个 AI 服务。</strong>支持 DeepSeek、Meta Muse 或任意 OpenAI 兼容接口，key 只保存在你的浏览器。</p><button type="button" class="cai-btn primary" data-act="settings">配置 API key</button>'}${ready ? `<strong>${mode === 'catalog' ? '问目录' : '自由提问'}</strong>：${mode === 'catalog' ? '从 1,465 条资源里找出处，再让 AI 组织回答。' : '直接向模型提问，适合概念与方法问题。'}` : ''}<div class="cai-sugs">${SUGGEST[mode].map((q) => `<button type="button" data-sug="${esc(T(q))}">${esc(T(q))}</button>`).join('')}</div></div>`;
    log.innerHTML = history[mode].length ? history[mode].map(renderMsg).join('') : welcome;
    log.scrollTop = log.scrollHeight;
  }
  function usageLine(m) {
    if (!m.usage) return '';
    const cost = m.cost != null ? ` · 约 $${m.cost < 0.01 ? m.cost.toFixed(4) : m.cost.toFixed(3)}` : '';
    return `<div class="cai-usage">${esc(m.model || '')} · 输入 ${m.usage.prompt_tokens ?? '?'} / 输出 ${m.usage.completion_tokens ?? '?'} token${cost}${m.ms ? ` · ${(m.ms / 1000).toFixed(1)} s` : ''}</div>`;
  }
  function renderMsg(m) {
    if (m.role === 'user') return `<div class="cai-msg user">${esc(m.content)}</div>`;
    if (m.error) return `<div class="cai-err">${esc(m.error)}${m.code === 'no-key' ? ' <button type="button" class="cai-btn" data-act="settings" style="margin-left:6px;height:28px">去设置</button>' : ''}</div>`;
    const cited = new Set([...String(m.content).matchAll(/\[(\d{1,2}(?:\s*[,，]\s*\d{1,2})*)\]/g)].flatMap((x) => x[1].split(/[,，]/).map((n) => Number(n.trim()))));
    const refs = (m.refs || []).map((r, i) => ({ ...r, n: i + 1 })).filter((r) => cited.has(r.n));
    return `<div class="cai-msg bot"><div class="cai-who">${m.refs ? `检索到 ${m.refs.length} 条目录资源` : 'AI'}${m.pending ? ' · 生成中…' : ''}</div>${m.reasoning ? `<details class="cai-think"><summary>思考过程（${m.reasoning.length} 字）</summary><div class="cai-body">${esc(m.reasoning)}</div></details>` : ''}<div class="cai-body">${markdown(m.content || (m.pending ? '…' : ''), m.refs)}</div>${refs.length ? `<div class="cai-refs">${refs.map((r) => `<a href="${esc(safeURL(r.url))}" target="_blank" rel="noopener noreferrer"><b>${r.n}</b><span>${esc(r.title)}</span><small>${esc(r.sources[0] || '')}</small></a>`).join('')}</div>` : ''}${usageLine(m)}</div>`;
  }
  async function ask(question) {
    if (busy) return;
    const list = history[mode];
    list.push({ role: 'user', content: question });
    const bot = { role: 'assistant', content: '', pending: true };
    list.push(bot);
    renderLog();
    const controller = new AbortController();
    busy = controller;
    const stop = drawer.querySelector('[data-act=stop]');
    stop.hidden = false;
    let frame = 0;
    const paint = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderLog(); }); };
    try {
      let messages;
      if (mode === 'catalog') {
        // The catalogue is mostly Chinese: an English question first gets bilingual search keywords.
        let query = question;
        if (!/[㐀-鿿]/.test(question)) {
          try {
            const k = await chat({ json: true, effort: 'off', maxTokens: 300, signal: controller.signal, messages: [{ role: 'system', content: 'Return JSON {"keywords":[...]} with 4-10 short search keywords for a Chinese computational-chemistry resource catalogue: Chinese terms plus English software/method names. No other text.' }, { role: 'user', content: question }] });
            const kw = parseJSON(k.text).keywords;
            if (Array.isArray(kw)) query = `${question} ${kw.join(' ')}`;
          } catch (e) { if (e.name === 'AbortError') throw e; }
        }
        const refs = await retrieve(query, 12);
        bot.refs = refs;
        const context = refs.length ? refs.map((r, i) => `[${i + 1}] ${r.title}\n来源：${r.sources.join(' / ')}${r.date ? ` · ${r.date}` : ''}\n链接：${r.url}\n摘要：${r.excerpt}`).join('\n\n') : '（没有检索到相关条目）';
        const prior = list.slice(0, -2).filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, content: m.content }));
        messages = [{ role: 'system', content: SYSTEM.catalog + LANG_NOTE() }, ...prior, { role: 'user', content: `问题：${question}\n\n本站目录检索结果：\n${context}` }];
      } else {
        const prior = list.slice(0, -1).filter((m) => !m.error && !m.pending).slice(-10).map((m) => ({ role: m.role, content: m.content }));
        messages = [{ role: 'system', content: SYSTEM.free + LANG_NOTE() }, ...prior];
      }
      const r = await chat({ messages, signal: controller.signal, maxTokens: 4096, onDelta: (_, full) => { bot.content = full; paint(); }, onReasoning: (_, full) => { bot.reasoning = full; paint(); } });
      Object.assign(bot, { content: r.text || '（模型没有返回正文，可以把思考强度调低后重试）', reasoning: r.reasoning, usage: r.usage, cost: r.cost, model: r.model, ms: r.ms });
    } catch (err) {
      if (err.name === 'AbortError') bot.content = (bot.content || '') + '\n\n（已停止）';
      else { list.pop(); list.push({ role: 'assistant', error: err.message, code: err.code }); }
    } finally {
      delete bot.pending;
      busy = null;
      stop.hidden = true;
      persist();
      renderLog();
    }
  }
  function openDrawer(opts = {}) {
    if (!drawer) buildDrawer();
    if (opts.mode) mode = opts.mode;
    // e.g. the account page's quota card asks for the hosted quota even when an own key is saved
    if (PROVIDERS[opts.provider]) { const s = settings(); if (s.provider !== opts.provider) { s.provider = opts.provider; save(s); } }
    lastFocus = document.activeElement;
    drawer.dataset.open = 'true';
    refreshDrawer();
    const input = drawer.querySelector('textarea');
    if (opts.question) {
      if (opts.autoSend && isReady()) ask(opts.question); else input.value = opts.question;
    }
    setTimeout(() => input.focus(), 60);
    if (!isReady() && opts.question) openSettings();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.dataset.open = 'false';
    if (lastFocus?.isConnected) lastFocus.focus();
  }

  window.ChemAI = { chat, parseJSON, retrieve, openDrawer, closeDrawer, openSettings, settings, isReady: () => isReady(), providers: PROVIDERS, markdown, costOf };
  document.dispatchEvent(new Event('chemhub:ai-ready'));
})();
