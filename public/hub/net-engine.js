/* MolAstria 网状查询引擎：把合并目录的全部条目、说明讲解手册各章和中英术语表织成一张实体网。
   实体：目录里的软件与数据库、标题里反复出现的程序/方法名（如 Shermo、IGMH）、术语表里的概念、主题标签、资源分类。
   关系：同一条目里共同出现，按余弦加权（标题、标签算 3，摘要和正文算 1）；目录里的同类归属。
   查询：先把关键词解析成实体（精确、别名、同义、拼写近似），解析不到就按全文相关度排序，再用命中条目里的实体织出以查询为中心的网。
   这里没有 DOM，Node 里也能跑（tools/net-test.mjs）。
   Public API: MolAstriaNet.build(data, guides, terms) -> { docs, entities, sources, suggest(), query(), source(), overview(), relation() } */
(() => {
  'use strict';

  // Tags that describe what an entry is, not what it is about.
  const META_TAGS = new Set(['站长随笔', '论坛问答', '文献频道', '预印本', '期刊论文', '开源项目', '学术会议', '学术招聘', '软件归档', '邮件列表归档', '培训与公告', '平台工具', '资源索引', '硬件与购机']);
  // Latin words in titles that are not names of programs, methods or systems.
  const NOT_NAMES = new Set(('a an and the of for in on to by with from via vs using new part part1 part2 pics project comment odd ma link center gap surface electron density carbon cyclo beta quantum ' +
    'chemistry nature chem res mater acc angew live bond excess benchmark donor acceptor quantities information-theoretic downhill sphericity planarity alternation length order br co tv cosplay ' +
    'lovelive comiket animania comicvertex mycomic beijing windows linux centos vmware photoshop cpu gpu gb rtx nvidia epyc ai pi n-h c3 c6 version online update ver www http https com org cn ' +
    'pccp jcp jcc jctc jpca jpcb jpcc cpl cej jacs acs rsc wiley elsevier mol model phys j').split(' '));
  // Ordinary English words that are also program names: matched only with their own capitals.
  const CASED = new Set(['exciting', 'elk', 'octopus', 'amber', 'dalton', 'casino', 'rowan', 'sparrow', 'tequila', 'bagel', 'siesta', 'molden', 'block2', 'ase',
    'aim', 'crystal', 'dirac', 'respect', 'zinc', 'lobster']);
  // Program names that are also an ordinary term in English papers: these phrases are not a mention of the program.
  const OTHER_SENSE = { gaussian: /gaussian[- ]?(?:process|basis|type|function|orbital|smearing|distribution|mixture|kernel|regression|noise|broadening|charge|wave|width)\w*/g };
  // Concepts so broad that they say little about a relation (still searchable and usable as a centre).
  const BROAD = new Set(['教程', '安装', '报错', '安装与报错', '开源', '数据库', '数据集', '软件', '可视化', '综述', '预印本', '招聘', '会议', '材料', '表面', '溶剂', '纳米', '小分子', '量子化学']);
  const KIND_RANK = { software: 6, database: 6, name: 5, concept: 4, topic: 3, category: 2 };
  const TYPE_RANK = { tutorial: 3, database: 3, software: 3, handbook: 3, tool: 2, qa: 2, paper: 2, preprint: 2, repo: 2, resource: 1, discipline: 0, archive: 1, job: 0, conference: 0, announcement: 0 };

  const HAN = /[㐀-鿿]/;
  const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const latinTokens = (s) => s.split(/[^a-z0-9+]+/).filter(Boolean);
  const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const strip = (html) => String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

  /** Edit distance with transpositions, stopping early once it exceeds max. */
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }

  function build(data, guides = [], terms = null) {
    const sources = [...(data.sources || []).map((s) => ({ ...s }))];
    if (guides.length) sources.push({ id: 'handbook', name: '说明讲解手册', color: '#b08a4f', role: `本站 ${guides.length} 章讲解`, url: '../manual/index.html' });
    const sourceById = new Map(sources.map((s) => [s.id, s]));

    // ---------- documents ----------
    const excerptCount = new Map();
    for (const it of data.items) if (it.excerpt) excerptCount.set(it.excerpt, (excerptCount.get(it.excerpt) || 0) + 1);
    const docs = data.items.map((it, i) => {
      const official = it.source === 'resdir' || (it.origins || []).includes('atlas');
      // An excerpt repeated across many entries is a crawler note, not content.
      const excerpt = it.excerpt && excerptCount.get(it.excerpt) < 5 ? it.excerpt : '';
      return {
        i, id: it.id, title: strip(it.title), excerpt: strip(it.excerpt), url: it.url || '', source: it.source,
        sources: [...new Set(it.sourceIds?.length ? it.sourceIds : [it.source])], type: it.type || 'resource',
        tags: it.tags || [], category: it.category || '', date: it.date || '', metric: it.metric || '', authors: it.authors || '',
        official, essay: (it.tags || []).includes('站长随笔'),
        raw: { title: strip(it.title), tags: (it.tags || []).join(' | '), body: [strip(excerpt), it.category || '', it.authors || ''].join(' ') },
      };
    });
    guides.forEach((g, k) => {
      const lead = strip((g.html.match(/<p class="lead">([\s\S]*?)<\/p>/) || g.html.match(/<div class="deck">([\s\S]*?)<\/div>/) || [])[1] || '');
      docs.push({
        i: docs.length, id: 'guide:' + g.id, title: `说明讲解手册 · ${String(k + 1).padStart(2, '0')} ${g.title}`, excerpt: lead,
        url: '../manual/index.html#' + g.id, source: 'handbook', sources: ['handbook'], type: 'handbook', tags: [], category: '说明讲解手册',
        date: '', metric: '', authors: '', official: false, essay: false, raw: { title: g.title, tags: '', body: strip(g.html) },
      });
    });
    for (const d of docs) {
      d.low = { title: norm(d.raw.title), tags: norm(d.raw.tags), body: norm(d.raw.body) };
      d.tok = { title: new Set(latinTokens(d.low.title)), tags: new Set(latinTokens(d.low.tags)), body: new Set(latinTokens(d.low.body)) };
      d.ents = new Map();
      // English entries get their topic tags from keyword rules over their own text (maintenance/crawler.py):
      // for them only a whole tag counts as a mention, not a name inside a tag label (VASP in "VASP/第一性原理", 碳环 in "碳环与材料").
      d.autoTags = !d.official && d.type !== 'handbook' && !HAN.test(d.title);
      d.tagSet = new Set(d.tags.map(norm));
    }

    // ---------- entities ----------
    const entities = [], byKey = new Map(), byAlias = new Map();
    function addEntity(e) {
      const key = norm(e.name);
      if (!key || key.length < 2 && !HAN.test(key)) return null;
      let ent = byKey.get(key);
      if (!ent) {
        ent = { idx: entities.length, key, name: e.name, nameEn: e.nameEn || '', kind: e.kind, aliases: new Set([key]), desc: '', url: '', category: '', item: null, docs: new Map(), W: 0, cased: false };
        entities.push(ent); byKey.set(key, ent);
      } else if ((KIND_RANK[e.kind] || 0) > (KIND_RANK[ent.kind] || 0)) { ent.kind = e.kind; ent.name = e.name; }
      for (const a of e.aliases || []) { const n = norm(a); if (n.length >= 2 || HAN.test(n)) ent.aliases.add(n); }
      if (e.desc && !ent.desc) ent.desc = e.desc;
      if (e.url && !ent.url) ent.url = e.url;
      if (e.category && !ent.category) ent.category = e.category;
      if (e.item && !ent.item) ent.item = e.item;
      if (e.nameEn && !ent.nameEn) ent.nameEn = e.nameEn;
      if (e.cased) ent.cased = true;
      return ent;
    }

    const categories = new Set(docs.filter((d) => d.official && d.category).map((d) => d.category));
    // 1. Catalogue: software and databases with their own page and description.
    for (const d of docs.filter((x) => x.official)) {
      const parts = d.title.split(/\s+\/\s+/);
      const aliases = parts.flatMap((p) => [p, p.replace(/\s+v?\d+(\.\d+)*$/i, ''), p.replace(/\s+DB$/, '')]);
      const ent = addEntity({ name: d.title, kind: d.type === 'database' ? 'database' : 'software', aliases, desc: d.excerpt, url: d.url, category: d.category, item: d, cased: CASED.has(norm(d.title)) });
      if (ent) ent.docs.set(d.i, 3);
    }
    // 2. Names that recur in titles: programs, methods, molecules (Shermo, IGMH, sobEDA, C18 ...).
    const seen = new Map();
    for (const d of docs) {
      if (d.essay || !HAN.test(d.title)) continue;
      const found = new Set();
      for (const m of d.title.normalize('NFKC').matchAll(/[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9]|[A-Za-z]{2,}/g)) {
        const w = m[0].replace(/-+$/, ''), k = w.toLowerCase();
        if ((k.length < 3 && !/^[A-Z]{2}$/.test(w)) || NOT_NAMES.has(k) || /^comicdive/.test(k) || /^\d/.test(k)) continue;
        if (found.has(k)) continue; found.add(k);
        const s = seen.get(k) || { n: 0, forms: new Map() };
        s.n++; s.forms.set(w, (s.forms.get(w) || 0) + 1); seen.set(k, s);
      }
    }
    for (const [k, s] of seen) {
      if (s.n < 2 || byKey.has(k)) continue;
      const name = [...s.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
      addEntity({ name, kind: 'name', aliases: [k], cased: CASED.has(k) });
    }
    // 3. Concepts from the shared Chinese–English term table.
    for (const g of terms?.groups || []) {
      const en = g.find((t) => !HAN.test(t)) || '';
      addEntity({ name: g[0], nameEn: en, kind: 'concept', aliases: g });
    }
    // 4. Topic tags and catalogue categories.
    const tagCount = new Map();
    for (const d of docs) for (const t of d.tags) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    for (const [t, n] of tagCount) {
      if (META_TAGS.has(t) || n < 2) continue;
      addEntity({ name: t, kind: categories.has(t) ? 'category' : 'topic', aliases: t.split('/').filter((x) => x.length > 1) });
    }
    for (const c of categories) addEntity({ name: c, kind: 'category' });
    for (const e of entities) for (const a of e.aliases) { if (!byAlias.has(a)) byAlias.set(a, []); byAlias.get(a).push(e); }

    // ---------- who mentions whom ----------
    const boundary = new Map();
    const casedRe = new Map();
    // An alias is checked against every document, so its tokens are worked out once (this alone was half of build() on a phone).
    const aliasToks = new Map();
    function latinHit(field, set, alias) {
      let toks = aliasToks.get(alias);
      if (!toks) aliasToks.set(alias, (toks = latinTokens(alias)));
      if (!toks.length || !toks.every((t) => set.has(t))) return false;
      if (toks.length === 1 && toks[0] === alias) return true;
      if (!boundary.has(alias)) boundary.set(alias, new RegExp(`(^|[^a-z0-9])${reEscape(alias)}($|[^a-z0-9])`));
      return boundary.get(alias).test(field);
    }
    function hit(d, field, ent, alias) {
      if (field === 'tags' && d.autoTags) return d.tagSet.has(alias);
      if (HAN.test(alias)) return d.low[field].includes(alias);
      if (!latinHit(d.low[field], d.tok[field], alias)) return false;
      const other = OTHER_SENSE[ent.key];
      if (other) {
        const rest = d.low[field].replace(other, ' ');
        if (!latinHit(rest, new Set(latinTokens(rest)), alias)) return false;
      }
      if (!ent.cased) return true;
      if (!casedRe.has(ent.name)) casedRe.set(ent.name, new RegExp(`(^|[^A-Za-z0-9])${reEscape(ent.name)}($|[^A-Za-z0-9])`));
      return casedRe.get(ent.name).test(d.raw[field]);
    }
    const tokenDocs = new Map();
    for (const d of docs) for (const f of ['title', 'tags', 'body']) for (const t of d.tok[f]) { if (!tokenDocs.has(t)) tokenDocs.set(t, new Set()); tokenDocs.get(t).add(d); }
    for (const ent of entities) {
      const tagEntity = ent.kind === 'topic' || ent.kind === 'category';
      let pool = null;
      if (!tagEntity && ![...ent.aliases].some((a) => HAN.test(a))) {
        pool = new Set();
        for (const a of ent.aliases) for (const d of tokenDocs.get(latinTokens(a)[0]) || []) pool.add(d);
      }
      for (const d of pool || docs) {
        let w = 0;
        if (tagEntity && d.tags.includes(ent.name)) w = 3;
        else if (ent.kind === 'category' && d.category === ent.name) w = 2;
        for (const a of ent.aliases) {
          if (w >= 3) break;
          if (hit(d, 'title', ent, a)) w = 3;
          else if (w < 2 && hit(d, 'tags', ent, a)) w = 2;
          else if (w < 1 && hit(d, 'body', ent, a)) w = 1;
        }
        if (w > (ent.docs.get(d.i) || 0)) ent.docs.set(d.i, w);
      }
      for (const [i, w] of ent.docs) { docs[i].ents.set(ent.idx, w); ent.W += w; }
    }
    const N = docs.length;
    const live = entities.filter((e) => e.docs.size > 0);
    for (const e of entities) e.broad = BROAD.has(e.key) || e.docs.size > N * 0.12;
    // Two entities that are spellings of each other (DFT / 密度泛函) are twins, not relations.
    const twins = (a, b) => a.aliases.has(b.key) || b.aliases.has(a.key);

    // ---------- relations ----------
    function relation(a, b) {
      if (a === b || !a.W || !b.W) return 0;
      const [small, big] = a.docs.size < b.docs.size ? [a, b] : [b, a];
      let co = 0;
      for (const [i, w] of small.docs) { const v = big.docs.get(i); if (v) co += Math.min(w, v); }
      return co / Math.sqrt(a.W * b.W);
    }
    function related(center, docSet, limit, exclude = new Set()) {
      const co = new Map();
      for (const [i, w] of docSet) for (const [k, v] of docs[i].ents) {
        if (k === center?.idx) continue;
        co.set(k, (co.get(k) || 0) + Math.min(w, v));
      }
      let W = 0; for (const [, w] of docSet) W += w;
      const minCo = docSet.size <= 3 ? 1 : 2;
      const out = [];
      for (const [k, c] of co) {
        const e = entities[k];
        if (c < minCo || exclude.has(k) || (center && twins(center, e))) continue;
        let score = c / Math.sqrt(Math.max(1, W) * e.W);
        if (e.broad) score *= 0.35;
        if (score > 0.02) out.push({ entity: e, score, co: c });
      }
      return out.sort((a, b) => b.score - a.score).slice(0, limit);
    }

    // ---------- text search ----------
    function expand(q) {
      const toks = terms?.tokens ? terms.tokens(q) : norm(q).split(' ').filter(Boolean);
      return toks.map((t) => {
        const group = terms?.groups?.find((g) => g.includes(t));
        return { t, syn: group ? group.filter((x) => x !== t) : [] };
      });
    }
    function fieldScore(d, t) {
      const latin = !HAN.test(t);
      const inField = (f) => latin ? latinHit(d.low[f], d.tok[f], t) || (t.length >= 3 && d.low[f].includes(t)) : d.low[f].includes(t);
      return inField('title') ? 6 : inField('tags') ? 4 : inField('body') ? (d.type === 'handbook' ? 1 : 1.5) : 0;
    }
    function textSearch(q) {
      const parts = expand(q);
      if (!parts.length) return [];
      const whole = norm(q);
      const scored = [];
      for (const d of docs) {
        let total = 0, matched = 0;
        for (const p of parts) {
          let s = fieldScore(d, p.t);
          if (!s) for (const y of p.syn) { s = Math.max(s, fieldScore(d, y) * 0.6); if (s >= 3.6) break; }
          if (s) { matched++; total += s; }
        }
        if (!matched) continue;
        if (whole.length > 1 && d.low.title.includes(whole)) total += 6;
        scored.push({ doc: d, score: total, all: matched === parts.length });
      }
      const all = scored.filter((x) => x.all);
      return (all.length ? all : scored).sort((a, b) => b.score - a.score || rankDoc(b.doc) - rankDoc(a.doc));
    }
    const rankDoc = (d) => (TYPE_RANK[d.type] ?? 1) + (d.excerpt ? 0.3 : 0) + (d.date ? Math.min(0.3, Math.max(0, (Date.parse(d.date) - Date.parse('2025-01-01')) / 1e11)) : 0);

    // ---------- resolving a query to an entity ----------
    function suggest(q, limit = 8) {
      const n = norm(q);
      if (!n) return [];
      const out = new Map();
      for (const e of live) {
        let s = 0, via = '';
        for (const a of e.aliases) {
          const v = a === n ? 100 : a.startsWith(n) ? 60 - Math.min(20, a.length - n.length) : n.length >= 2 && a.includes(n) ? 25 : 0;
          if (v > s) { s = v; via = a; }
        }
        if (s) out.set(e.idx, { entity: e, score: s + Math.log2(1 + e.docs.size) * 4 + (KIND_RANK[e.kind] || 0), via });
      }
      const list = [...out.values()].sort((a, b) => b.score - a.score).slice(0, limit);
      if (!list.length && /^[a-z0-9+-]{4,}$/.test(n)) {
        const max = n.length >= 8 ? 2 : 1;
        for (const e of live) for (const a of e.aliases) {
          if (HAN.test(a)) continue;
          const dist = distance(n, a, max);
          if (dist <= max) { list.push({ entity: e, score: 40 - dist * 10 + Math.log2(1 + e.docs.size), via: a, fuzzy: true }); break; }
        }
        list.sort((a, b) => b.score - a.score).splice(limit);
      }
      return list;
    }
    function resolve(q) {
      const n = norm(q);
      if (!n) return null;
      const exact = (byAlias.get(n) || []).filter((e) => e.docs.size);
      if (exact.length) {
        exact.sort((a, b) => (b.key === n) - (a.key === n) || (KIND_RANK[b.kind] || 0) - (KIND_RANK[a.kind] || 0) || b.docs.size - a.docs.size);
        return { entity: exact[0] };
      }
      const s = suggest(n, 3);
      if (s[0]?.fuzzy) return { entity: s[0].entity, corrected: s[0].via };
      if (s[0] && n.length >= 4 && s[0].via.startsWith(n) && n.length >= s[0].via.length * 0.6 && (!s[1] || s[0].score - s[1].score >= 8)) return { entity: s[0].entity, corrected: s[0].via };
      return null;
    }

    // ---------- the views ----------
    function grow(center, docSet, primary, opts = {}) {
      const firstRing = related(center, docSet, opts.ring1 || 12);
      const shown = new Set([center?.idx, ...firstRing.map((r) => r.entity.idx)].filter((x) => x != null));
      // Second hop: the strongest neighbours of the first ring that are not already shown.
      const secondRing = [];
      const perHop = firstRing.length <= 4 ? 4 : 2;
      for (const r of firstRing.slice(0, 6)) {
        const next = related(r.entity, r.entity.docs, 10, shown).filter((x) => !x.entity.broad && x.entity.docs.size >= 2).sort((a, b) => b.co * b.score - a.co * a.score).slice(0, perHop);
        for (const x of next) { shown.add(x.entity.idx); secondRing.push({ ...x, via: r.entity }); }
      }
      // Further reading: entries about the strongest relations that do not mention the centre itself.
      const inPrimary = new Set(primary.map((p) => p.doc.i));
      const further = new Map();
      for (const r of firstRing.slice(0, 6)) {
        if (r.entity.broad) continue;
        for (const [i, w] of r.entity.docs) {
          if (inPrimary.has(i) || docs[i].essay) continue;
          further.set(i, (further.get(i) || 0) + r.score * w);
        }
      }
      const extended = [...further.entries()].map(([i, s]) => ({ doc: docs[i], score: s })).sort((a, b) => b.score - a.score || rankDoc(b.doc) - rankDoc(a.doc)).slice(0, 12);
      return { related: firstRing, second: secondRing, extended };
    }
    function query(q) {
      const text = String(q || '').trim();
      if (!text) return overview();
      const r = resolve(text);
      if (r) {
        const e = r.entity;
        const primary = [...e.docs.entries()].map(([i, w]) => ({ doc: docs[i], score: w * 2 + rankDoc(docs[i]) + (docs[i] === e.item ? 10 : 0) + (docs[i].tags.some((t) => norm(t) === e.key) ? 1.5 : 0) }));
        // Entries that mention the query in a form the alias table does not know still belong here.
        const seenDocs = new Set(primary.map((p) => p.doc.i));
        if (!r.corrected) for (const x of textSearch(text)) if (!seenDocs.has(x.doc.i) && x.score >= 6) primary.push({ doc: x.doc, score: x.score / 2 });
        primary.sort((a, b) => b.score - a.score);
        const docSet = new Map(primary.map((p) => [p.doc.i, p.doc.ents.get(e.idx) || 1]));
        const siblings = e.category && (e.kind === 'software' || e.kind === 'database')
          ? live.filter((x) => x !== e && x.category === e.category && (x.kind === 'software' || x.kind === 'database')).sort((a, b) => relation(e, b) - relation(e, a) || b.docs.size - a.docs.size).slice(0, 4)
          : [];
        return { mode: 'entity', q: text, center: e, corrected: r.corrected || '', primary, siblings, category: e.category ? byKey.get(norm(e.category)) : null, ...grow(e, docSet, primary) };
      }
      const primary = textSearch(text);
      const top = primary.slice(0, 40);
      const docSet = new Map(top.map((p) => [p.doc.i, Math.min(3, Math.max(1, Math.round(p.score / 3)))]));
      return { mode: 'text', q: text, center: null, corrected: '', primary, siblings: [], category: null, suggestions: primary.length ? [] : suggest(text, 5), ...grow(null, docSet, primary) };
    }
    function source(id) {
      const s = sourceById.get(id);
      if (!s) return overview();
      const primary = docs.filter((d) => d.sources.includes(id)).map((d) => ({ doc: d, score: rankDoc(d) }));
      const docSet = new Map(primary.map((p) => [p.doc.i, 1]));
      return { mode: 'source', q: '', center: null, source: s, corrected: '', primary, siblings: [], category: null, ...grow(null, docSet, primary, { ring1: 14 }) };
    }
    function overview() {
      const pick = (kinds, n) => live.filter((e) => kinds.includes(e.kind) && !e.broad).sort((a, b) => b.docs.size - a.docs.size).slice(0, n);
      const sourceNames = new Set(sources.map((s) => norm(s.name)).concat(['x-mol', 'ccl', '计算化学公社', 'sobereva 思想家公社', 'molssi']));
      const hubs = [...pick(['software', 'database', 'name'], 14).filter((x) => !sourceNames.has(x.key)).slice(0, 10), ...pick(['concept', 'topic'], 8), ...pick(['category'], 4)];
      return { mode: 'overview', q: '', center: null, corrected: '', primary: docs.map((d) => ({ doc: d, score: rankDoc(d) })), siblings: [], category: null,
        related: hubs.map((e) => ({ entity: e, score: Math.log2(1 + e.docs.size) / 10, co: e.docs.size })), second: [], extended: [] };
    }

    function dedupe(list) {
      const byTitle = new Map(), out = [];
      for (const x of list) {
        const k = norm(x.doc.title);
        const first = byTitle.get(k);
        if (first) { first.also.push(x.doc); continue; }
        const y = { ...x, also: [] }; byTitle.set(k, y); out.push(y);
      }
      return out;
    }

    return { dedupe, docs, entities: live, sources, sourceById, N, suggest, resolve, query, source, overview, relation, twins, textSearch, norm };
  }

  window.MolAstriaNet = { build, distance };
})();
