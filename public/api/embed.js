/* MolAstria 嵌入卡片：把一段搜索结果放到任何网页上（课程主页、课题组 wiki、博客）。

     <script async src="https://molastria.com/api/embed.js" data-q="DFT" data-dataset="resources" data-limit="5"></script>

   data-q        关键词（中英文都行，同义词互通）；不写就是按目录顺序的前几条
   data-dataset  resources / journals / scimodels / videos，逗号分隔；不写是全部
   data-limit    条数，1–20，默认 5
   data-lang     zh / en；不写跟随所在页面的 <html lang>
   data-theme    light / dark；不写跟随系统
   data-title    卡片标题；不写用默认的
   卡片画在 shadow DOM 里，不受所在页面样式影响，也不影响它。数据来自开放数据接口（CC BY 4.0），卡片底部带署名。
   Public API: MolAstriaEmbed.render(element, { q, dataset, limit, lang, theme, title }) -> Promise */
(() => {
  'use strict';
  const script = document.currentScript;
  const api = new URL('.', script?.src || location.href); // …/api/
  const STR = {
    zh: { title: 'MolAstria · 计算化学资源', loading: '正在读取…', none: '没有找到相关条目', fail: '数据没有读到，请稍后再试', page: '详情', more: (n) => `在 MolAstria 查看全部 ${n} 条`, credit: '数据：MolAstria 开放数据接口',
      sets: { resources: '资源', journals: '期刊', scimodels: '科学大模型', videos: '视频' } },
    en: { title: 'MolAstria · computational chemistry', loading: 'Loading…', none: 'Nothing matches', fail: 'Could not load the data; please try again later', page: 'Details', more: (n) => `See all ${n} on MolAstria`, credit: 'Data: MolAstria open data API',
      sets: { resources: 'Resource', journals: 'Journal', scimodels: 'Science model', videos: 'Video' } },
  };
  const CSS = `
    :host{display:block;max-width:560px;margin:16px 0;font:14px/1.6 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;text-align:left;
      --bg:#fffdf8;--ink:#17231f;--ink2:#3c4a45;--muted:#6b7772;--line:#e2ddd0;--accent:#173f34;--gold:#9a7424;--chip:#f1ecdf}
    :host([data-theme=dark]){--bg:#111a17;--ink:#eef2ee;--ink2:#c5cfc9;--muted:#8d9a94;--line:#27332e;--accent:#9ed3bd;--gold:#d9b25c;--chip:#1b2622}
    @media(prefers-color-scheme:dark){:host(:not([data-theme=light])){--bg:#111a17;--ink:#eef2ee;--ink2:#c5cfc9;--muted:#8d9a94;--line:#27332e;--accent:#9ed3bd;--gold:#d9b25c;--chip:#1b2622}}
    *{box-sizing:border-box}
    .card{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:12px;overflow:hidden}
    header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);font-weight:650}
    header svg{width:20px;height:20px;flex:none;color:var(--gold)}
    header span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ol{list-style:none;margin:0;padding:0}
    li{padding:12px 16px;border-bottom:1px solid var(--line)}
    .top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
    a{color:var(--accent);text-decoration:none}
    a:hover,a:focus-visible{text-decoration:underline}
    .t{font-weight:650;font-size:14.5px;overflow-wrap:anywhere}
    .k{font-size:11px;font-weight:650;color:var(--gold);background:var(--chip);border-radius:999px;padding:1px 8px;white-space:nowrap}
    .s{font-size:12.5px;color:var(--muted)}
    p{margin:4px 0 0;font-size:13px;color:var(--ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .d{font-size:12px;margin-left:auto;white-space:nowrap}
    .state{padding:18px 16px;color:var(--muted);font-size:13px}
    footer{display:flex;justify-content:space-between;gap:6px 14px;flex-wrap:wrap;padding:10px 16px;font-size:12px;color:var(--muted)}
  `;
  const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3.5 19.4 7.75v8.5L12 20.5l-7.4-4.25v-8.5z"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>';
  const SETS = ['resources', 'journals', 'scimodels', 'videos'];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const web = (u) => (/^https?:\/\//.test(u || '') ? u : null);
  let sdk;

  async function render(host, opts = {}) {
    const lang = opts.lang === 'en' || opts.lang === 'zh' ? opts.lang : (/^en/i.test(document.documentElement.lang) ? 'en' : 'zh');
    const t = STR[lang];
    const picked = String(opts.dataset || '').split(',').map((s) => s.trim()).filter((s) => SETS.includes(s));
    const datasets = picked.length ? picked : SETS;
    const limit = Math.min(20, Math.max(1, parseInt(opts.limit, 10) || 5));
    const q = String(opts.q || '').trim();
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    if (opts.theme === 'dark' || opts.theme === 'light') host.dataset.theme = opts.theme; else delete host.dataset.theme;
    host.lang = lang === 'en' ? 'en' : 'zh-CN';

    const card = el('section', 'card');
    const head = el('header');
    head.innerHTML = MARK;
    head.append(el('span', '', opts.title || t.title));
    const body = el('div', 'state', t.loading);
    body.setAttribute('role', 'status');
    const foot = el('footer');
    const credit = el('a', '', t.credit);
    credit.href = 'https://molastria.com/api/';
    const lic = el('a', '', 'CC BY 4.0');
    lic.href = 'https://creativecommons.org/licenses/by/4.0/';
    foot.append(credit, lic);
    for (const a of [credit, lic]) { a.target = '_blank'; a.rel = 'noopener'; }
    card.append(head, body, foot);
    const style = el('style', '', CSS);
    root.replaceChildren(style, card);

    try {
      sdk ||= import(new URL('v1/molastria.mjs', api));
      const { total, hits } = await (await sdk).search(q, { datasets, limit });
      if (!hits.length) { body.textContent = t.none; return { total }; }
      const list = el('ol');
      for (const h of hits) {
        const li = el('li'), top = el('div', 'top');
        const title = el('a', 't', h.title);
        title.href = web(h.url) || web(h.page) || 'https://molastria.com/';
        const more = el('a', 'd', t.page);
        more.href = web(h.page) || 'https://molastria.com/';
        for (const a of [title, more]) { a.target = '_blank'; a.rel = 'noopener'; }
        top.append(title, el('span', 'k', t.sets[h.dataset]));
        if (h.subtitle?.[lang]) top.append(el('span', 's', h.subtitle[lang]));
        top.append(more);
        li.append(top);
        if (h.summary?.[lang]) li.append(el('p', '', h.summary[lang]));
        list.append(li);
      }
      body.replaceWith(list);
      if (total > hits.length) {
        const all = el('a', '', t.more(total));
        all.href = `https://molastria.com/api/#q=${encodeURIComponent(q)}${picked.length ? `&in=${picked.join(',')}` : ''}`;
        all.target = '_blank'; all.rel = 'noopener';
        foot.prepend(all);
      }
      return { total };
    } catch (e) {
      body.textContent = t.fail;
      return { error: String(e?.message || e) };
    }
  }

  window.MolAstriaEmbed = { render };
  // A script tag that says what to show draws its card right after itself.
  if (script && ['q', 'dataset', 'limit', 'title'].some((k) => k in script.dataset)) {
    const host = document.createElement('div');
    host.className = 'molastria-embed';
    script.after(host);
    render(host, script.dataset);
  }
})();
