/* 书架（/shelf/）的纯逻辑，没有 DOM：存档的读写和整理、加书和排序、DOI / ISBN 的识别和校验、
   OpenAlex / Crossref / Open Library 返回值整理成一本书、BibTeX 导出、书脊的颜色和尺寸、筛选。
   tools/shelf-test.mjs 测。浏览器里是 window.MolAstriaShelfCore，Node 里 require。
   存档 localStorage 的 molastria-shelf（在云同步的清单里）：
   { v: 1, items: { <书的 id>: { s: 'want'|'reading'|'done', n: 笔记, r: 0–5 星, at: 时间 } },
     mine: [ 自己加的书 { id: 'u-…', t, a, y, pub, doi, isbn, url } ], order: [ 我的书架上的书，按摆放顺序 ] } */
(function (root) {
  'use strict';
  const KEY = 'molastria-shelf';
  const STATUS = ['want', 'reading', 'done'];
  const MAX_MINE = 300, MAX_ORDER = 600, MAX_NOTE = 2000, MAX_FIELD = 300;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max = MAX_FIELD) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

  function empty() { return { v: 1, items: {}, mine: [], order: [] }; }

  /** 自己加的一本书，只留认识的字段。没有书名就不算一本书。 */
  function cleanBook(b) {
    if (!isObj(b)) return null;
    const t = str(b.t);
    if (!t) return null;
    const o = { id: ID_RE.test(String(b.id || '')) && String(b.id).startsWith('u-') ? String(b.id) : '', t };
    const a = str(b.a); if (a) o.a = a;
    const y = parseInt(b.y, 10); if (y >= 1000 && y <= 2100) o.y = y;
    const pub = str(b.pub); if (pub) o.pub = pub;
    const doi = normDoi(b.doi); if (doi) o.doi = doi;
    const isbn = normIsbn(b.isbn); if (isbn) o.isbn = isbn;
    const url = str(b.url, 500); if (/^https?:\/\/[^\s]+$/i.test(url)) o.url = url;
    return o;
  }

  /** 读存档：坏数据、旧版本、多出来的字段都整理掉，永远返回一份能用的。 */
  function parse(raw) {
    let v = raw;
    if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return empty(); } }
    if (!isObj(v)) return empty();
    const out = empty();
    if (isObj(v.items)) {
      for (const [id, it] of Object.entries(v.items)) {
        if (!okId(id) || !isObj(it)) continue;
        const o = {};
        if (STATUS.includes(it.s)) o.s = it.s;
        const n = str(it.n, MAX_NOTE); if (n) o.n = n;
        const r = Math.round(+it.r); if (r >= 1 && r <= 5) o.r = r;
        const at = +it.at; if (at > 0) o.at = at;
        if (o.s || o.n || o.r) out.items[id] = o;
      }
    }
    const seen = new Set();
    if (Array.isArray(v.mine)) {
      for (const b of v.mine) {
        const c = cleanBook(b);
        if (!c || !c.id || seen.has(c.id)) continue;
        seen.add(c.id); out.mine.push(c);
        if (out.mine.length >= MAX_MINE) break;
      }
    }
    if (Array.isArray(v.order)) {
      const o = new Set();
      for (const id of v.order) if (okId(id) && !o.has(id)) { o.add(id); out.order.push(id); }
      out.order = out.order.slice(0, MAX_ORDER);
    }
    // 自己加的书一定在“我的书架”上
    for (const b of out.mine) if (!out.order.includes(b.id)) out.order.push(b.id);
    return out;
  }

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const isEmpty = (s) => !Object.keys(s.items).length && !s.mine.length && !s.order.length;
  /** 要写回去的字符串；空存档返回 null（删掉这个键）。 */
  const serialize = (s) => (isEmpty(s) ? null : JSON.stringify(s));

  /** 书的 id 只能是小写字母、数字和连字符（挡住 __proto__ 这类键）。 */
  /** 一本书的记录（只认自己的键，不会读到 Object 原型上的东西）。 */
  const item = (s, id) => (Object.hasOwn(s.items, id) ? s.items[id] : {});
  const okId = (id) => typeof id === 'string' && ID_RE.test(id) && !(id in Object.prototype);
  function touch(s, id, now) {
    const it = item(s, id);
    it.at = now || Date.now();
    s.items[id] = it;
    if (!it.s && !it.n && !it.r) delete s.items[id];
    return s;
  }
  function setStatus(state, id, status, now) {
    if (!okId(id)) return state;
    const s = clone(state);
    const it = item(s, id);
    if (STATUS.includes(status)) it.s = status; else delete it.s;
    s.items[id] = it;
    // 标了状态就放到我的书架上（取消状态不拿下来）
    if (it.s && !s.order.includes(id)) s.order.push(id);
    return touch(s, id, now);
  }
  function setNote(state, id, note, now) {
    if (!okId(id)) return state;
    const s = clone(state);
    const it = item(s, id);
    const n = str(note, MAX_NOTE);
    if (n) it.n = n; else delete it.n;
    s.items[id] = it;
    return touch(s, id, now);
  }
  function setRating(state, id, r, now) {
    if (!okId(id)) return state;
    const s = clone(state);
    const it = item(s, id);
    const v = Math.round(+r);
    if (v >= 1 && v <= 5) it.r = v; else delete it.r;
    s.items[id] = it;
    return touch(s, id, now);
  }
  const onMine = (state, id) => state.order.includes(id);
  function addToMine(state, id) {
    if (!okId(id)) return state;
    const s = clone(state);
    if (!s.order.includes(id) && s.order.length < MAX_ORDER) s.order.push(id);
    return s;
  }
  /** 从我的书架拿下来；自己加的书就整本删掉（连同笔记）。 */
  function removeFromMine(state, id) {
    if (!okId(id)) return state;
    const s = clone(state);
    s.order = s.order.filter((x) => x !== id);
    if (id.startsWith('u-')) { s.mine = s.mine.filter((b) => b.id !== id); delete s.items[id]; }
    return s;
  }
  /** 把 id 挪到 order 里的第 to 位（0 起，超出就放到两头）。 */
  function moveTo(state, id, to) {
    if (!okId(id)) return state;
    const s = clone(state);
    const i = s.order.indexOf(id);
    if (i < 0) return s;
    s.order.splice(i, 1);
    const j = Math.max(0, Math.min(s.order.length, Math.round(to)));
    s.order.splice(j, 0, id);
    return s;
  }
  const moveBy = (state, id, d) => moveTo(state, id, state.order.indexOf(id) + d);

  function newId(seed) {
    const r = (typeof seed === 'number' ? seed : Date.now()).toString(36);
    return 'u-' + r + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  }
  /** 加一本自己的书。同一个 DOI / ISBN 已经在（站内书目或自己加过）时不重复加，返回已有的 id。 */
  function addCustom(state, book, catalog, now) {
    const c = cleanBook(book);
    if (!c) return { state, id: null, error: 'title' };
    const dup = findDuplicate(c, state, catalog);
    if (dup) return { state: addToMine(state, dup), id: dup, existed: true };
    const s = clone(state);
    if (s.mine.length >= MAX_MINE) return { state, id: null, error: 'full' };
    c.id = newId(now);
    while (s.mine.some((b) => b.id === c.id)) c.id = newId((now || Date.now()) + 1);
    s.mine.push(c);
    s.order.push(c.id);
    return { state: s, id: c.id };
  }
  function findDuplicate(book, state, catalog) {
    const doi = book.doi && book.doi.toLowerCase(), isbn = book.isbn;
    const hit = (b) => (doi && b.doi && b.doi.toLowerCase() === doi) || (isbn && b.isbn && normIsbn(b.isbn) === isbn);
    if (catalog) for (const [id, b] of Object.entries(catalog.books || {})) if (okId(id) && hit(b)) return id;
    for (const b of state.mine) if (hit(b)) return b.id;
    return null;
  }

  // ── DOI / ISBN ───────────────────────────────────────────────────────
  function normDoi(s) {
    const m = String(s || '').trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').match(/^10\.\d{4,9}\/\S+$/);
    return m ? m[0].replace(/[.,;]+$/, '') : '';
  }
  function isbn10ok(d) {
    let sum = 0;
    for (let i = 0; i < 10; i++) { const c = d[i] === 'X' ? 10 : +d[i]; if (i < 9 && c === 10) return false; sum += c * (10 - i); }
    return sum % 11 === 0;
  }
  function isbn13ok(d) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += +d[i] * (i % 2 ? 3 : 1);
    return sum % 10 === 0;
  }
  /** 校验位对的 ISBN 统一成 13 位；不对返回空字符串。 */
  function normIsbn(s) {
    const d = String(s || '').toUpperCase().replace(/^ISBN(-1[03])?:?\s*/, '').replace(/[\s-]/g, '');
    if (/^\d{9}[\dX]$/.test(d) && isbn10ok(d)) {
      const b = '978' + d.slice(0, 9);
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += +b[i] * (i % 2 ? 3 : 1);
      return b + ((10 - (sum % 10)) % 10);
    }
    if (/^97[89]\d{10}$/.test(d) && isbn13ok(d)) return d;
    return '';
  }
  const hyphenIsbn = (d) => (d && d.length === 13 ? `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9, 12)}-${d.slice(12)}` : d || '');

  /** 加书框里输入的是什么：DOI、ISBN、看着像 ISBN 但校验位不对，或者书名。 */
  function detect(q) {
    const s = String(q || '').trim();
    if (!s) return { kind: 'empty' };
    const doi = normDoi(s);
    if (doi) return { kind: 'doi', value: doi };
    const isbn = normIsbn(s);
    if (isbn) return { kind: 'isbn', value: isbn };
    if (/^(ISBN[-:\s]*)?[\d\s-]{9,17}X?$/i.test(s) && s.replace(/\D/g, '').length >= 9) return { kind: 'bad-isbn' };
    if (s.length < 2) return { kind: 'empty' };
    return { kind: 'title', value: s.slice(0, 200) };
  }
  /** 查一本书要问哪几家（按顺序问，第一家有结果就停）。 */
  function lookupUrls(d) {
    if (d.kind === 'doi') return [['openalex', `https://api.openalex.org/works/doi:${encodeURIComponent(d.value)}`], ['crossref', `https://api.crossref.org/works/${encodeURIComponent(d.value)}`]];
    if (d.kind === 'isbn') return [['openlibrary', `https://openlibrary.org/api/books?bibkeys=ISBN:${d.value}&format=json&jscmd=data`], ['crossref', `https://api.crossref.org/works?filter=isbn:${d.value}&rows=3`]];
    if (d.kind === 'title') return [['openalex', `https://api.openalex.org/works?search=${encodeURIComponent(d.value)}&filter=type:book&per-page=6&select=id,doi,display_name,publication_year,authorships,primary_location`]];
    return [];
  }
  const names = (list) => list.filter(Boolean).slice(0, 6).join(', ') + (list.length > 6 ? ' et al.' : '');
  function fromOpenAlexWork(w) {
    if (!isObj(w) || !w.display_name) return null;
    return cleanBook({
      t: w.display_name,
      a: names((w.authorships || []).map((x) => x?.author?.display_name)),
      y: w.publication_year,
      pub: w.primary_location?.source?.host_organization_name || w.primary_location?.source?.display_name || '',
      doi: normDoi(w.doi || ''),
    });
  }
  function fromCrossrefWork(m) {
    if (!isObj(m)) return null;
    const t = [].concat(m.title || [])[0];
    if (!t) return null;
    const sub = [].concat(m.subtitle || [])[0];
    const y = (m.issued?.['date-parts'] || m.published?.['date-parts'] || [[]])[0][0];
    const isbn = [].concat(m.ISBN || []).map(normIsbn).find(Boolean) || '';
    return cleanBook({ t: sub && !t.includes(sub) ? `${t}: ${sub}` : t, a: names((m.author || m.editor || []).map((p) => [p.given, p.family].filter(Boolean).join(' ') || p.name)), y, pub: m.publisher, doi: m.DOI, isbn });
  }
  /** 把一家的返回值整理成候选书的列表（最多 6 本）。 */
  function results(source, json, d) {
    try {
      if (source === 'openalex') {
        const list = Array.isArray(json?.results) ? json.results : [json];
        return list.map(fromOpenAlexWork).filter(Boolean).slice(0, 6);
      }
      if (source === 'crossref') {
        const m = json?.message;
        const list = Array.isArray(m?.items) ? m.items : [m];
        return list.map(fromCrossrefWork).filter(Boolean).map((b) => (d?.kind === 'isbn' && !b.isbn ? { ...b, isbn: d.value } : b)).slice(0, 6);
      }
      if (source === 'openlibrary') {
        const v = json && Object.values(json)[0];
        if (!isObj(v) || !v.title) return [];
        const y = String(v.publish_date || '').match(/\d{4}/);
        const b = cleanBook({ t: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title, a: names((v.authors || []).map((x) => x.name)), y: y ? y[0] : '', pub: (v.publishers || [])[0]?.name, isbn: d?.value, url: v.url });
        return b ? [b] : [];
      }
    } catch { /* fall through */ }
    return [];
  }

  // ── BibTeX ───────────────────────────────────────────────────────────
  const bibEsc = (s) => String(s || '').replace(/[{}\\]/g, '').replace(/([&%$#_])/g, '\\$1');
  function citeKey(b, used) {
    const first = String(b.a || 'anon').split(/,| and |、|，/)[0].trim().split(/\s+/).pop() || 'anon';
    const word = String(b.t || '').toLowerCase().match(/[a-z]{4,}/);
    let k = (first.normalize('NFKD').replace(/[^A-Za-z]/g, '').toLowerCase() || 'book') + (b.y || '') + (word ? word[0] : '');
    let n = k, i = 1;
    while (used.has(n)) n = k + String.fromCharCode(96 + ++i);
    used.add(n);
    return n;
  }
  function bibtex(list) {
    const used = new Set();
    return list.map((b) => {
      const f = [['title', `{${bibEsc(b.t)}}`]];
      if (b.a) f.push(['author', `{${String(b.a).split(/,\s*(?![^()]*\))|、|，/).map((x) => x.trim()).filter((x) => x && x !== 'et al.').map(bibEsc).join(' and ')}}`]);
      if (b.pub) f.push(['publisher', `{${bibEsc(b.pub)}}`]);
      if (b.y) f.push(['year', `{${String(b.y).match(/\d{4}/)?.[0] || bibEsc(b.y)}}`]);
      if (b.edEn) f.push(['edition', `{${bibEsc(b.edEn)}}`]);
      if (b.doi) f.push(['doi', `{${b.doi}}`]);
      if (b.isbn) f.push(['isbn', `{${hyphenIsbn(b.isbn)}}`]);
      if (b.url && !b.doi) f.push(['url', `{${b.url}}`]);
      return `@book{${citeKey(b, used)},\n${f.map(([k, v]) => `  ${k.padEnd(9)} = ${v}`).join(',\n')}\n}`;
    }).join('\n\n') + (list.length ? '\n' : '');
  }

  // ── 书脊 ─────────────────────────────────────────────────────────────
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }
  // 布面颜色：墨绿、酒红、藏青、赭石、灰蓝、深紫、橄榄、栗色、石青、象牙（每种是 [底色, 亮一点的高光]）
  const CLOTHS = [
    ['#1f4a3a', '#2f6a53'], ['#6b2230', '#8c3443'], ['#1d2f55', '#2c4677'], ['#8a5a1e', '#ad7633'], ['#3e5566', '#56758a'],
    ['#3d2a55', '#57407a'], ['#4d5524', '#687434'], ['#5a2e1f', '#7a4330'], ['#1f4f5a', '#2e6d7b'], ['#d9cdb2', '#ebe2cc'],
  ];
  /** 一本书的书脊：布面颜色、宽、高（px），同一本书永远一样。厚书（书名长、多卷）宽一点。 */
  function spine(id, b) {
    const h = hash(String(id));
    const cloth = CLOTHS[h % CLOTHS.length];
    const len = String(b?.t || '').length;
    const w = Math.round(30 + (h >>> 4) % 14 + Math.min(10, len / 9) + (/vol\.|卷|i–iv/i.test(b?.t || '') ? 6 : 0));
    const ht = Math.round(170 + (h >>> 9) % 30);
    return { bg: cloth[0], hi: cloth[1], light: cloth === CLOTHS[9], w: Math.min(w, 58), h: ht, band: (h >>> 14) % 3 };
  }

  // ── 筛选 ─────────────────────────────────────────────────────────────
  const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[øœæßłđ]/g, (c) => ({ ø: 'o', œ: 'oe', æ: 'ae', ß: 'ss', ł: 'l', đ: 'd' }[c]));
  /** 这本书符不符合搜索词（书名、作者、出版社、推荐它的栏目，空格分开的每个词都要命中）和状态筛选。 */
  function matches(b, item, q, filter) {
    if (filter === 'free' && !b.free) return false;
    if (STATUS.includes(filter) && item?.s !== filter) return false;
    if (filter === 'noted' && !item?.n) return false;
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = fold([b.t, b.tEn, b.sub?.zh, b.sub?.en, b.a, b.pub, b.y, b.doi, b.isbn, (b.from || []).map((f) => f.zh + ' ' + f.en).join(' '), item?.n].join(' '));
    return words.every((w) => hay.includes(w));
  }
  function counts(state) {
    const c = { want: 0, reading: 0, done: 0, mine: state.order.length };
    for (const it of Object.values(state.items)) if (it.s) c[it.s]++;
    return c;
  }

  const api = { okId, item, KEY, STATUS, MAX_MINE, MAX_NOTE, empty, parse, serialize, cleanBook, setStatus, setNote, setRating, onMine, addToMine, removeFromMine, moveTo, moveBy, addCustom, findDuplicate,
    normDoi, normIsbn, hyphenIsbn, detect, lookupUrls, results, bibtex, citeKey, spine, hash, CLOTHS, matches, counts };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MolAstriaShelfCore = api;
})(typeof self !== 'undefined' ? self : this);
