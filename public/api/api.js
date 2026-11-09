/* 开放数据接口说明页。搜索台、代码示例和嵌入预览都只用公开的接口（v1/molastria.mjs 和 embed.js），
   和别人在自己网页上能做到的完全一样；数据集列表读自 v1/index.json，所以条数和日期不会写死在页面里。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const web = (u) => (/^https?:\/\//.test(u || '') ? u : '#');
  const SETS = [['resources', '资源目录'], ['journals', '期刊'], ['scimodels', '科学大模型'], ['videos', '教学视频']];
  const TRIES = ['密度泛函', 'ORCA', 'machine learning potential', '开放获取 期刊', 'Gaussian 教程', '激发态'];
  const LIMIT = 6;
  const PUBLIC = 'https://molastria.com/api/v1/';
  const sdk = import('./v1/molastria.mjs');

  // ── state, kept in the address (#q=…&in=…) so a search can be shared; embed cards link here too ──
  const state = { q: '', sets: new Set(), tab: 'js' };
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.has('q') && !h.has('in')) return false;
    state.q = h.get('q') || '';
    state.sets = new Set((h.get('in') || '').split(',').filter((s) => SETS.some(([id]) => id === s)));
    return true;
  }
  function writeHash() {
    const h = new URLSearchParams();
    if (state.q) h.set('q', state.q);
    if (state.sets.size) h.set('in', [...state.sets].join(','));
    const next = h.toString();
    history.replaceState(null, '', next ? `#${next}` : location.pathname + location.search);
  }
  const chosen = () => (state.sets.size ? SETS.map(([id]) => id).filter((id) => state.sets.has(id)) : SETS.map(([id]) => id));

  // ── search ──
  let last = null, turn = 0;
  async function run() {
    const mine = ++turn;
    try {
      const { search } = await sdk;
      // Counts are for the query over every dataset, so the chips show where else it matches.
      const [all, shown] = await Promise.all([search(state.q, { limit: 1 }), search(state.q, { datasets: chosen(), limit: LIMIT })]);
      if (mine !== turn) return;
      last = { all, shown };
    } catch {
      if (mine !== turn) return;
      last = null;
      $('api-status').textContent = '数据没有读到，请稍后再试。';
    }
    draw();
  }

  function draw() {
    const L = lang();
    $('api-in').innerHTML = SETS.map(([id, name]) => `<button type="button" aria-pressed="${state.sets.has(id)}" data-set="${id}">${name}<b translate="no">${last ? last.all.counts[id] : ''}</b></button>`).join('');
    drawCode();
    if (!last) return;
    const { total, hits } = last.shown;
    $('api-status').textContent = !total ? '没有找到，换个词试试。' : total > hits.length ? `共 ${total} 条，显示前 ${hits.length} 条` : `共 ${total} 条结果`;
    $('api-hits').innerHTML = hits.map((h) => `
      <li class="api-hit">
        <div class="api-hit-top">
          <a class="api-hit-title" href="${esc(web(h.url))}" target="_blank" rel="noopener">${esc(h.title)}</a>
          <span class="api-kind" data-kind="${h.dataset}">${esc(h.dataset)}</span>
          ${h.subtitle?.[L] ? `<span class="api-sub">${esc(h.subtitle[L])}</span>` : ''}
        </div>
        ${h.summary?.[L] ? `<p>${esc(h.summary[L])}</p>` : ''}
        <details><summary>JSON</summary><pre class="api-code"><code>${esc(JSON.stringify(h.item, null, 2))}</code></pre></details>
      </li>`).join('');
  }

  // ── code for the current search ──
  const jsStr = (s) => JSON.stringify(s);
  const shStr = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  function code(tab) {
    const q = state.q.trim(), sets = chosen(), some = state.sets.size > 0;
    if (tab === 'js') {
      const opts = [some ? `datasets: ${JSON.stringify(sets)}` : '', `limit: ${LIMIT}`].filter(Boolean).join(', ');
      return `import { search } from '${PUBLIC}molastria.mjs';\n\n// Chinese and English synonyms are interchangeable (terms.json).\nconst { total, hits } = await search(${jsStr(q)}, { ${opts} });\nfor (const h of hits) console.log(h.dataset, h.title, h.url);`;
    }
    if (tab === 'py') {
      return `import json, urllib.request\n\nBASE = "${PUBLIC}"\nwords = ${jsStr(q)}.lower().split()\n\nfor name in ${JSON.stringify(sets)}:\n    data = json.load(urllib.request.urlopen(BASE + name + ".json"))\n    for item in data["items"]:\n        text = json.dumps(item, ensure_ascii=False).lower()\n        if all(w in text for w in words):\n            print(name, item.get("name") or item.get("title"), item["url"] if "url" in item else item["page"])\n\n# Plain substring match. For Chinese/English synonyms, expand the words with terms.json first.`;
    }
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const args = words.map((w, i) => ` --arg w${i} ${shStr(w)}`).join('');
    const test = words.length ? ` | select((tostring | ascii_downcase) as $t | ${words.map((_, i) => `($t | contains($w${i}))`).join(' and ')})` : '';
    return sets.map((name) => `curl -s ${PUBLIC}${name}.json | jq -r${args} '.items[]${test} | .name // .title'`).join('\n');
  }
  function drawCode() {
    for (const t of document.querySelectorAll('.api-tabs [role=tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === state.tab));
    $('api-code').firstElementChild.textContent = code(state.tab);
  }

  // ── datasets ──
  let index = null;
  function drawSets() {
    if (!index) return;
    const L = lang();
    $('api-updated').textContent = `最近核对 ${index.updated}`;
    $('api-sets').innerHTML = index.endpoints.map((e) => `
      <article class="api-set">
        <div><h3 translate="no">${esc(e.title[L])}</h3><p>共 ${e.count} 条 · 核对于 ${esc(e.updated)}</p></div>
        <div class="api-links">
          <a class="btn" href="v1/${esc(e.id)}.json">JSON<i class="ico-ext" aria-hidden="true"></i></a>
          <a class="btn" href="${esc(e.page.replace('https://molastria.com/', '../'))}index.html">网页版<i class="ico-ext" aria-hidden="true"></i></a>
        </div>
        <a class="api-url" translate="no" href="v1/${esc(e.id)}.json">${esc(e.url)}</a>
      </article>`).join('');
  }
  fetch('v1/index.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).then((data) => { index = data; drawSets(); })
    .catch(() => { $('api-sets').innerHTML = '<p class="muted">数据集列表没有读到，请直接打开 <a href="v1/index.json">v1/index.json</a></p>'; });

  // ── embed builder ──
  const form = $('api-embed-form');
  function embed() {
    const o = Object.fromEntries(new FormData(form));
    o.limit = Math.min(20, Math.max(1, parseInt(o.limit, 10) || 5));
    window.MolAstriaEmbed?.render($('api-preview'), { ...o, lang: o.lang || lang() });
    const attrs = [['q', o.q], ['dataset', o.dataset], ['limit', o.limit], ['lang', o.lang], ['theme', o.theme]].filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
    $('api-snippet').firstElementChild.textContent = `<script async src="https://molastria.com/api/embed.js"${attrs}></script>`;
  }

  // ── wiring ──
  let timer = 0;
  $('api-q').addEventListener('input', (e) => {
    state.q = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => { writeHash(); run(); }, 120);
  });
  $('api-in').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    if (state.sets.has(b.dataset.set)) state.sets.delete(b.dataset.set); else state.sets.add(b.dataset.set);
    writeHash(); run();
  });
  $('api-tries').insertAdjacentHTML('beforeend', TRIES.map((t) => `<button type="button" data-try>${esc(t)}</button>`).join(''));
  $('api-tries').addEventListener('click', (e) => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    state.q = $('api-q').value = b.textContent.trim(); // the chip as shown, so English pages try English words
    writeHash(); run();
  });
  document.querySelector('.api-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[role=tab]');
    if (t) { state.tab = t.dataset.tab; drawCode(); }
  });
  for (const b of document.querySelectorAll('.api-copy')) {
    b.addEventListener('click', async () => {
      const text = $(b.dataset.copy).textContent;
      try { await navigator.clipboard.writeText(text); } catch {
        const r = document.createRange(); r.selectNodeContents($(b.dataset.copy)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); // let the reader press Ctrl+C
        return;
      }
      b.dataset.done = '1';
      b.textContent = '已复制';
      setTimeout(() => { b.textContent = '复制代码'; delete b.dataset.done; }, 1600);
    });
  }
  let embedTimer = 0;
  form.addEventListener('input', () => { clearTimeout(embedTimer); embedTimer = setTimeout(embed, 200); });
  form.addEventListener('submit', (e) => e.preventDefault());
  window.addEventListener('hashchange', () => { if (readHash()) { $('api-q').value = state.q; run(); } });
  // Titles and descriptions come from the data in the page's language: redraw when the language is applied.
  document.addEventListener('chemhub:i18n', () => { draw(); drawSets(); embed(); });

  if (!readHash()) state.q = lang() === 'en' ? 'density functional' : TRIES[0];
  $('api-q').value = state.q;
  draw(); run(); embed();
})();
