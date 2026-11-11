/* 联网搜索的界面：搜索框停下来约 0.7 秒后，从访客自己的浏览器去问 OpenAlex、Wikipedia、PubChem、GitHub，
   把结果按和查询的匹配程度排在一起，画在站内结果上面的“网上最匹配”一块里；资源库已收录的标出来并能打开站内详情。
   纯逻辑在 web-core.js。开关存 molastria-web-search（'off' 是关）。没有托管服务、不要 key、不计 AI 额度。
   Public API: MolAstriaWebSearch.mount(box, {catalog, detail}) → {update(query, catalogCount)} */
(() => {
  'use strict';
  const W = window.MolAstriaWeb;
  if (!W) return;
  const KEY = 'molastria-web-search';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safe = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : '#'; } catch { return '#'; } };
  const enabled = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
  const setEnabled = (on) => { try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, 'off'); } catch { /* this visit only */ } };
  const groups = () => window.MolAstriaTerms?.groups || [];
  const NAMES = { openalex: 'OpenAlex', crossref: 'Crossref', wikipedia: 'Wikipedia', 'wikipedia-zh': '中文维基', pubchem: 'PubChem', github: 'GitHub' };
  const cache = new Map();
  let openalexOut = false; // OpenAlex said the free daily budget for this IP is used up: ask Crossref for papers instead

  async function get(url, signal) {
    const ctl = new AbortController();
    const stop = () => ctl.abort();
    signal.addEventListener('abort', stop, { once: true });
    const t = setTimeout(stop, 9000);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' });
      const body = await r.text(); // always read the body (an unread response keeps the request open in Chromium)
      if (!r.ok) return { status: r.status };
      try { return { status: r.status, json: JSON.parse(body) }; } catch { return { status: 0 }; }
    } catch { return { status: signal.aborted ? -1 : 0 }; }
    finally { clearTimeout(t); signal.removeEventListener('abort', stop); }
  }

  /** Runs one search; onUpdate(results, status) is called each time a source answers. */
  async function search(query, onUpdate, signal) {
    let plan = W.plan(query, groups());
    const status = {}, results = [];
    const ask = async (source, url) => {
      status[source] = 'wait';
      let r = await get(url, signal);
      if (signal.aborted) return;
      if (source === 'openalex' && r.status === 429) { // free budget used up: papers from Crossref
        openalexOut = true; delete status.openalex;
        const [, alt] = W.urls(plan, { openalexFailed: true }).find(([s]) => s === 'crossref') || [];
        if (alt) return ask('crossref', alt);
        return;
      }
      if (source === 'pubchem' && r.status === 404) { delete status.pubchem; onUpdate(results, status); return; } // not a compound name: say nothing
      status[source] = r.json ? 'ok' : r.status === 403 || r.status === 429 ? 'busy' : 'fail';
      if (r.json) {
        results.push(...W.parse(source, r.json));
        if (source === 'wikipedia-zh' && !plan.english) {
          const en = W.bridge(r.json);
          if (en) { plan = W.withEnglish(plan, en); await Promise.all(W.urls(plan, { openalexFailed: openalexOut }).map(([s, u]) => ask(s, u))); return; }
        }
      }
      onUpdate(results, status, plan);
    };
    const first = W.urls(plan, { openalexFailed: openalexOut });
    onUpdate(results, Object.fromEntries(first.map(([s]) => [s, 'wait'])), plan);
    await Promise.all(first.map(([s, u]) => ask(s, u)));
    return { results, status, plan };
  }

  function mount(box, { catalog = [], detail = null } = {}) {
    const index = W.catalogIndex(catalog);
    box.innerHTML = `<div class="wr-head"><h3 id="wr-h"><span class="wr-dot" aria-hidden="true"></span>网上最匹配</h3><p class="wr-status" role="status" aria-live="polite"></p><label class="wr-toggle"><input type="checkbox"> 联网搜索</label></div><ol class="wr-list"></ol><div class="wr-foot"><button type="button" class="wr-more button" hidden></button><p class="wr-links"></p><p class="wr-note">查询词由你的浏览器直接发给 OpenAlex、Wikipedia、PubChem 和 GitHub，不经过本站服务器，也不计 AI 额度。外部结果按和查询的匹配程度排序，没有经过本站核对。</p></div>`;
    box.setAttribute('aria-labelledby', 'wr-h');
    const $ = (s) => box.querySelector(s);
    const toggle = $('.wr-toggle input');
    toggle.checked = enabled();
    let ctl = null, timer = 0, current = '', shown = 0, full = false, last = { list: [], status: {}, plan: null };

    // Each piece of the status line is its own element, so i18n.js can translate it as one string.
    const statusParts = (st) => {
      const parts = Object.entries(st).filter(([, v]) => v === 'busy' || v === 'fail').map(([s, v]) => v === 'busy' ? `${NAMES[s] || s} 暂时限流` : `${NAMES[s] || s} 连不上`);
      return Object.values(st).includes('wait') ? ['正在联网搜索…', ...parts] : parts;
    };
    function draw() {
      const { list, status, plan } = last;
      const limit = full ? list.length : shown;
      $('.wr-list').innerHTML = list.slice(0, limit).map((r) => `<li class="wr-item"><span class="wr-kind">${esc(r.kind)}</span><div class="wr-main"><a class="wr-title" translate="no" href="${esc(safe(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title)} <i class="ico-ext" aria-hidden="true"></i></a>${r.snippet ? `<p class="wr-snippet" translate="no">${esc(r.snippet)}</p>` : ''}<p class="wr-meta"><span class="wr-src">${esc(W.SOURCES[r.source]?.name || r.source)}</span>${r.meta ? `<span>${esc(r.meta)}</span>` : ''}${r.catalog ? `<button type="button" class="wr-in" data-detail="${esc(r.catalog.id)}">资源库已收录</button>` : ''}</p></div></li>`).join('');
      const waiting = Object.values(status).includes('wait');
      const done = !waiting;
      const parts = [...(list.length ? [`共 ${list.length} 条`] : done ? ['网上也没有找到匹配的资源'] : []), ...statusParts(status)];
      $('.wr-status').innerHTML = parts.map((x) => `<span>${esc(x)}</span>`).join(' · ');
      const more = $('.wr-more');
      more.hidden = full || list.length <= shown;
      more.textContent = `再看 ${list.length - shown} 条`;
      const q = plan?.english || plan?.zh || current;
      $('.wr-links').innerHTML = q ? `<span>在来源看更多：</span>${['openalex', 'wikipedia', 'pubchem', 'github'].map((s) => `<a href="${esc(W.SOURCES[s].home(s === 'wikipedia' && !plan?.english ? plan?.zh || q : q, s === 'wikipedia' && !plan?.english))}" target="_blank" rel="noopener noreferrer">${W.SOURCES[s].name}</a>`).join(' · ')}` : '';
    }
    async function run(q, catalogCount) {
      ctl?.abort();
      if (!q || q.length < 2 || !enabled()) { box.hidden = !q || q.length < 2; if (!box.hidden) { $('.wr-list').innerHTML = ''; $('.wr-status').innerHTML = '<span>联网搜索已关闭</span>'; $('.wr-more').hidden = true; $('.wr-links').innerHTML = ''; } return; }
      box.hidden = false;
      // Few catalogue hits: the web list opens wider, since it is then the main answer.
      shown = catalogCount >= 5 ? 3 : 6; full = false;
      if (cache.has(q)) { last = cache.get(q); draw(); return; }
      ctl = new AbortController();
      const signal = ctl.signal;
      last = { list: [], status: {}, plan: null }; draw();
      const out = await search(q, (results, status, plan) => {
        if (signal.aborted) return;
        last = { list: W.rank(results, plan || W.plan(q, groups()), { index }), status: { ...status }, plan };
        draw();
      }, signal);
      if (signal.aborted) return;
      last = { list: W.rank(out.results, out.plan, { index }), status: out.status, plan: out.plan };
      // Keep a finished search for the visit, unless a source failed (then try again next time).
      if (!Object.values(out.status).some((v) => v !== 'ok')) cache.set(q, last);
      draw();
    }
    $('.wr-more').addEventListener('click', () => { full = true; draw(); });
    toggle.addEventListener('change', () => { setEnabled(toggle.checked); run(current, 0); });
    if (detail) box.addEventListener('click', (e) => { const b = e.target.closest('.wr-in'); if (b) { e.stopPropagation(); detail(b.dataset.detail); } });
    return {
      /** Called after each catalogue redraw. Waits until typing pauses (700 ms), so a word is searched once, not per key. */
      update(query, catalogCount = 0, { now = false } = {}) {
        const q = String(query || '').trim();
        if (q === current && !now) return;
        current = q;
        clearTimeout(timer);
        if (now) run(q, catalogCount); else timer = setTimeout(() => run(q, catalogCount), 700);
      },
    };
  }
  window.MolAstriaWebSearch = { mount, search };
})();
