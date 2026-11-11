/* 联网搜索的纯逻辑：把查询改写成英文、拼各家公开接口的地址、把返回值整理成同一种结果、打分排序、标出资源库里已有的。
   没有 DOM，没有网络：web.js 负责发请求和画界面，tools/websearch-test.mjs 测这里。
   来源都是浏览器能直接问、不要 key 的公开接口（CORS 放行），查询词从访客自己的浏览器发出，不经过本站服务器：
     OpenAlex（论文，按访客 IP 每天有免费额度，用完了改问 Crossref）、Wikipedia（概念）、PubChem（化合物）、GitHub（开源代码）。
   Public API: MolAstriaWeb.{plan(), urls(), parse(), bridge(), withEnglish(), rank(), catalogIndex(), inCatalog(), normURL(), SOURCES} */
(function (root) {
  'use strict';
  const HAN = /[㐀-鿿]/;
  const SOURCES = {
    openalex: { name: 'OpenAlex', kind: '论文', home: (q) => `https://openalex.org/works?search=${encodeURIComponent(q)}` },
    crossref: { name: 'Crossref', kind: '论文', home: (q) => `https://search.crossref.org/search/works?q=${encodeURIComponent(q)}&from_ui=yes` },
    wikipedia: { name: 'Wikipedia', kind: '百科', home: (q, zh) => `https://${zh ? 'zh' : 'en'}.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
    pubchem: { name: 'PubChem', kind: '化合物', home: (q) => `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(q)}` },
    github: { name: 'GitHub', kind: '开源代码', home: (q) => `https://github.com/search?type=repositories&q=${encodeURIComponent(q)}` },
    // General web results (Brave Search) come through the account service, for Pro supporters only (POST /web/search).
    web: { name: 'Brave', kind: '网页', home: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
  };
  const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'for', 'in', 'on', 'to', 'with', 'how', 'what', 'which', 'is', 'are', 'do', 'does', 'use', 'using']);
  // Question words only: single characters such as 中 or 的 are left alone, since they are also parts of terms (中子, 目的).
  const QSTOP = /怎么样|怎么|如何|什么|哪些|哪个|有没有|请问|一下|[吗呢呀][？?]?$/g;
  // Source text to plain text (it is HTML-escaped again when drawn): entities decoded in one pass, so &amp;lt; stays the
  // text "&lt;", then tags removed until none are left and any stray angle bracket dropped.
  const ENT = { '&quot;': '"', '&#39;': "'", '&#039;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
  const strip = (s) => {
    let t = String(s ?? '').replace(/&(?:quot|#0?39|amp|lt|gt|nbsp);/g, (m) => ENT[m]);
    for (let prev = ''; prev !== t;) { prev = t; t = t.replace(/<[^<>]*>/g, ''); }
    return t.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  };
  const words = (s) => (String(s || '').toLowerCase().match(/[a-z0-9][a-z0-9+#.\-]*/g) || []).filter((w) => !STOP.has(w));

  /** Turns the visitor's query into what each source can use. Chinese terms the glossary knows become their English
   *  name (电解液 → electrolyte), because OpenAlex, PubChem and GitHub are mostly English; other Chinese is dropped
   *  from the English query and kept for the Chinese Wikipedia. groups = MolAstriaTerms.groups (may be empty). */
  function plan(query, groups = []) {
    const raw = String(query || '').trim().replace(/\s+/g, ' ').slice(0, 200);
    let rest = raw.toLowerCase();
    const en = [], zhHit = [];
    const zhTerms = groups.flatMap((g) => g.filter((t) => HAN.test(t)).map((t) => [t, g])).sort((a, b) => b[0].length - a[0].length);
    for (const [t, g] of zhTerms) {
      if (!rest.includes(t)) continue;
      // The longest English name reads best to a search engine (density functional, not dft).
      const latin = g.filter((x) => !HAN.test(x)).sort((a, b) => b.length - a.length)[0];
      if (latin) en.push(latin);
      zhHit.push(t);
      rest = rest.split(t).join(' ');
    }
    const latinLeft = rest.replace(/[㐀-鿿]+/g, ' ').replace(/[^\p{L}\p{N}+#.\-\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const english = [...new Set([...en, latinLeft].filter(Boolean))].join(' ').trim();
    const zh = HAN.test(raw) ? raw.replace(QSTOP, ' ').replace(/[？?！!，,。]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const tokens = [...new Set([...words(english), ...zhHit, ...(zh ? zh.split(' ') : [])])].filter(Boolean);
    // PubChem looks up a compound by its exact name or formula: only worth asking for a short name the visitor typed
    // themselves (not a glossary concept such as molecular dynamics).
    const compound = latinLeft && !en.length && latinLeft.split(' ').length <= 3 ? latinLeft : '';
    return { raw, english, zh, tokens, compound };
  }

  // Wikipedia: search as a generator so one request also gives a one-sentence extract and, for the Chinese wiki, the
  // English title of each article (阿司匹林 → Aspirin), which the other sources can then search for.
  const wiki = (lang, q) => `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=extracts${lang === 'zh' ? '|langlinks&lllang=en' : ''}&exintro=1&explaintext=1&exsentences=2&exlimit=3&redirects=1&format=json&formatversion=2&origin=*`;
  /** The Chinese wiki's best match in English, for a Chinese query the glossary could not translate. */
  function bridge(json) {
    const pages = [...(json?.query?.pages || [])].sort((a, b) => (a.index || 0) - (b.index || 0));
    const en = pages.map((x) => x.langlinks?.[0]?.title || x.langlinks?.[0]?.['*']).find(Boolean);
    return en ? strip(en) : '';
  }
  /** The plan again with an English query found through the Chinese wiki. */
  function withEnglish(p, english) {
    const tokens = [...new Set([...words(english), ...p.tokens])];
    return { ...p, english, tokens, compound: english.split(' ').length <= 3 ? english : '', bridged: true };
  }

  /** The request each source gets for this plan (only sources with something to search). */
  function urls(p, { openalexFailed = false, per = 5 } = {}) {
    const out = [];
    const q = p.english;
    if (q && !openalexFailed) out.push(['openalex', `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${per}&select=id,doi,display_name,publication_year,cited_by_count,type,primary_location,relevance_score`]);
    if (q && openalexFailed) out.push(['crossref', `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${per}&select=DOI,title,container-title,issued,is-referenced-by-count,type,URL`]);
    if (q) out.push(['wikipedia', wiki('en', q)]);
    if (p.zh && !p.bridged) out.push(['wikipedia-zh', wiki('zh', p.zh)]);
    if (p.compound) out.push(['pubchem', `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(p.compound)}/property/Title,MolecularFormula,MolecularWeight,IUPACName/JSON`]);
    if (q) out.push(['github', `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=4`]);
    return out;
  }

  /** One source's JSON → results {source, kind, title, url, snippet, meta, signal, pos, doi?}. Bad shapes give []. */
  function parse(source, json) {
    try {
      if (source === 'openalex') return (json.results || []).map((w, pos) => {
        const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, '').toLowerCase() : '';
        const venue = w.primary_location?.source?.display_name || '';
        return { source, kind: '论文', title: strip(w.display_name), url: doi ? `https://doi.org/${doi}` : String(w.id || ''), doi,
          snippet: [venue, w.publication_year].filter(Boolean).join(' · '), meta: `被引 ${Number(w.cited_by_count) || 0} 次`, signal: Math.log10((Number(w.cited_by_count) || 0) + 1), pos };
      }).filter((r) => r.title && r.url);
      if (source === 'crossref') return (json.message?.items || []).map((w, pos) => {
        const doi = String(w.DOI || '').toLowerCase();
        const year = w.issued?.['date-parts']?.[0]?.[0];
        return { source, kind: '论文', title: strip((w.title || [])[0]), url: doi ? `https://doi.org/${doi}` : String(w.URL || ''), doi,
          snippet: [(w['container-title'] || [])[0], year].filter(Boolean).join(' · '), meta: `被引 ${Number(w['is-referenced-by-count']) || 0} 次`, signal: Math.log10((Number(w['is-referenced-by-count']) || 0) + 1), pos };
      }).filter((r) => r.title && r.url);
      if (source === 'wikipedia' || source === 'wikipedia-zh') {
        const host = source === 'wikipedia' ? 'en' : 'zh';
        return [...(json.query?.pages || [])].sort((a, b) => (a.index || 0) - (b.index || 0)).map((x, pos) => ({ source: 'wikipedia', kind: '百科', title: strip(x.title),
          url: `https://${host}.wikipedia.org/wiki/${encodeURIComponent(String(x.title).replace(/ /g, '_'))}`, snippet: strip(x.extract).slice(0, 240), meta: host === 'zh' ? '中文维基百科' : 'English Wikipedia', signal: 0.6, pos }))
          .filter((r) => r.title);
      }
      if (source === 'pubchem') return (json.PropertyTable?.Properties || []).slice(0, 1).map((c) => ({ source, kind: '化合物', title: strip(c.Title || c.IUPACName || `CID ${c.CID}`),
        url: `https://pubchem.ncbi.nlm.nih.gov/compound/${Number(c.CID)}`, snippet: [c.MolecularFormula, c.MolecularWeight && `${c.MolecularWeight} g/mol`, c.IUPACName].filter(Boolean).join(' · '), meta: `CID ${Number(c.CID)}`, signal: 2, pos: 0 }));
      if (source === 'web') return (json.results || []).map((r, pos) => {
        let url = '';
        try { const u = new URL(r.url); if (u.protocol === 'https:' || u.protocol === 'http:') url = u.href; } catch { /* dropped */ }
        return { source, kind: '网页', title: strip(r.title), url, snippet: strip(r.snippet), meta: strip(r.site), signal: 1, pos };
      }).filter((r) => r.title && r.url);
      if (source === 'github') return (json.items || []).map((r, pos) => ({ source, kind: '开源代码', title: strip(r.full_name), url: String(r.html_url || ''),
        snippet: strip(r.description), meta: `★ ${Number(r.stargazers_count) || 0}${r.language ? ' · ' + strip(r.language) : ''}`, signal: Math.log10((Number(r.stargazers_count) || 0) + 1) * 0.8, pos }))
        .filter((r) => /^https:\/\/github\.com\//.test(r.url));
    } catch { /* fall through */ }
    return [];
  }

  /** How well a result answers the query: share of query words in the title (most), then the snippet, the source's own
   *  order, and a little popularity (citations, stars). An exact title match (PubChem's compound, a Wikipedia article
   *  called the query) goes first. */
  function score(r, p) {
    const title = r.title.toLowerCase(), body = `${title} ${String(r.snippet || '').toLowerCase()}`;
    const toks = p.tokens.length ? p.tokens : words(p.raw);
    if (!toks.length) return 0;
    const inTitle = toks.filter((t) => title.includes(t)).length / toks.length;
    const inBody = toks.filter((t) => body.includes(t)).length / toks.length;
    if (!inBody) return 0; // the source matched on something we cannot see (full text): not a best match
    const exact = [p.english, p.zh, p.raw].some((q) => q && title.replace(/\s*\(.*\)$/, '') === q.toLowerCase()) ? 3 : 0;
    return +(inTitle * 6 + inBody * 2 + exact + Math.min(r.signal || 0, 4) * 0.5 + (5 - Math.min(r.pos || 0, 5)) * 0.3).toFixed(3);
  }

  /** Normalised address for comparing a web result with catalogue entries: no scheme, no www., no trailing slash or fragment. */
  function normURL(u) {
    try {
      const x = new URL(u);
      if (/(^|\.)doi\.org$/.test(x.hostname)) return 'doi:' + decodeURIComponent(x.pathname.slice(1)).toLowerCase();
      return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + (x.search || '')).toLowerCase();
    } catch { return ''; }
  }
  /** Index of catalogue addresses: items are [{id, title, url}]. */
  function catalogIndex(items) {
    const m = new Map();
    for (const i of items || []) { const k = normURL(i.url); if (k && !m.has(k)) m.set(k, i); }
    return m;
  }
  const inCatalog = (r, index) => index.get(normURL(r.url)) || null;

  /** All sources' results → one list, best first, duplicates (same address or DOI) merged, capped at `limit`. */
  function rank(results, p, { limit = 8, index = null } = {}) {
    const seen = new Map();
    for (const r of results) {
      const k = r.doi ? 'doi:' + r.doi : normURL(r.url);
      if (!k) continue;
      const s = score(r, p);
      const prev = seen.get(k);
      if (!prev || s > prev.score) seen.set(k, { ...r, score: s, catalog: index ? inCatalog(r, index) : null });
    }
    // At most three from one source in the top list, so one chatty source does not crowd out the rest.
    const sorted = [...seen.values()].filter((r) => r.score > 0.9).sort((a, b) => b.score - a.score);
    const per = new Map(), out = [], spill = [];
    for (const r of sorted) { const n = per.get(r.source) || 0; if (n < 3) { out.push(r); per.set(r.source, n + 1); } else spill.push(r); }
    return [...out, ...spill].slice(0, limit);
  }

  const api = { plan, urls, parse, bridge, withEnglish, wiki, rank, score, catalogIndex, inCatalog, normURL, SOURCES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MolAstriaWeb = api;
})(typeof window !== 'undefined' ? window : globalThis);
