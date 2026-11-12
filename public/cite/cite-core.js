/* 导出引用：把站内各种写法的条目（首页目录、量子物理的论文和书、量子算法 / 基础科学 / 量子生物学的文献）整理成一种记录，
   再写成 BibTeX、RIS（Zotero、EndNote、Mendeley 都能导入）或一行参考文献。纯函数，没有 DOM（tools/cite-test.mjs 测）。
   记录：{ kind: 'article' | 'book' | 'preprint' | 'software' | 'dataset' | 'web', title, authors: [..], year, month, journal, volume,
           pages, doi, url, publisher, edition, accessed: 'YYYY-MM-DD', note }
   浏览器：window.MOLASTRIA_CITE_CORE；node：module.exports。 */
(function (root) {
  'use strict';

  const str = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  const pick = (o, ...keys) => { for (const k of keys) { const v = o[k]; if (v != null && v !== '') return typeof v === 'object' && !Array.isArray(v) ? str(v.en || v.zh) : v; } return ''; };
  const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+)/i;

  /** 从任何字符串里取出 DOI（去掉结尾的标点）。 */
  function doiOf(...vals) {
    for (const v of vals) {
      const m = DOI_RE.exec(String(v || ''));
      if (m) return m[1].replace(/[.,;)\]]+$/, '');
    }
    return '';
  }

  /** 作者字符串拆成人名数组。认 “、”“；”“;”“ and ”“&”，没有这些时按逗号拆（“Planck, M.” 这种姓在前的两段除外）。 */
  function splitAuthors(v) {
    if (Array.isArray(v)) return v.map(str).filter(Boolean);
    let s = str(v).replace(/\bet al\.?$/i, '').replace(/等$/, '').trim().replace(/[,;、]$/, '');
    if (!s) return [];
    let parts = s.split(/\s*(?:、|；|;|\s&\s|\sand\s)\s*/);
    if (parts.length === 1 && s.includes(',')) {
      const c = s.split(/\s*,\s*/);
      const initialsOnly = (x) => /^([A-Z][a-z]?\.\s*-?)+$/.test(x);
      parts = c.length === 2 && initialsOnly(c[1]) ? [s] : c;
    }
    return parts.map(str).filter(Boolean);
  }

  /** "Vázquez-Hernández" 这种姓：拆出“姓, 名”。已经带逗号的原样；中文名整个当姓；单个词当姓。 */
  function nameParts(name) {
    const n = str(name);
    if (n.includes(',')) { const [last, ...rest] = n.split(','); return { last: str(last), first: str(rest.join(',')) }; }
    if (/[\u3400-\u9fff]/.test(n) && !/\s/.test(n)) return { last: n, first: '' };
    const w = n.split(' ');
    if (w.length === 1) return { last: n, first: '' };
    // 带 van / von / de 这类前缀的姓一起算
    let i = w.length - 1;
    while (i > 1 && /^(van|von|der|de|da|del|di|du|le|la|ter|den)$/i.test(w[i - 1])) i--;
    return { last: w.slice(i).join(' '), first: w.slice(0, i).join(' ') };
  }

  const yearOf = (v) => { const m = /\b(1[6-9]\d\d|20\d\d|21\d\d)\b/.exec(String(v ?? '')); return m ? Number(m[1]) : 0; };
  const monthOf = (v) => { const m = /^\d{4}-(\d{2})/.exec(String(v ?? '')); return m ? Number(m[1]) : 0; };

  /** 首页目录（merged-data.js）的一条。 */
  function fromCatalogue(i, accessed = '') {
    const type = String(i.type || '');
    const doi = doiOf(i.metric, i.url);
    const kind = type === 'paper' ? 'article' : type === 'preprint' ? 'preprint' : type === 'software' || type === 'repo' || type === 'tool' ? 'software' : type === 'database' ? 'dataset' : 'web';
    const journal = kind === 'article' || kind === 'preprint' ? str(i.category) : '';
    return clean({
      kind, title: i.title, authors: splitAuthors(i.authors), year: yearOf(i.date), month: monthOf(i.date), journal, doi,
      url: doi ? `https://doi.org/${doi}` : i.url, publisher: kind === 'dataset' || kind === 'software' || kind === 'web' ? hostOf(i.url) : '',
      accessed: kind === 'article' ? '' : accessed
    });
  }

  /** 各栏目数据文件里的文献（qp papers / books、qa refs、fs refs、qb refs……字段名各不相同，这里统一认）。 */
  function fromRef(r, accessed = '') {
    const doi = doiOf(r.doi, r.url);
    const isBook = !!(r.pub || r.publisher || r.isbn || r.ed || r.kind === 'book' || r.type === 'book') && !pick(r, 'j', 'journal', 'venue');
    const venue = str(pick(r, 'j', 'journal', 'venue', 'container'));
    const arxiv = /arxiv/i.test(venue) || /arxiv\.org/.test(String(r.url || '')) || /^10\.48550\//.test(doi);
    return clean({
      kind: isBook ? 'book' : arxiv ? 'preprint' : venue || doi ? 'article' : 'web',
      title: pick(r, 'title', 't'), authors: splitAuthors(pick(r, 'au', 'authors', 'author')), year: yearOf(pick(r, 'y', 'year', 'date')),
      journal: venue, volume: pick(r, 'v', 'vol', 'volume'), pages: pick(r, 'p', 'pages', 'page'), doi,
      url: doi ? `https://doi.org/${doi}` : pick(r, 'url', 'link'), publisher: pick(r, 'pub', 'publisher'), edition: pick(r, 'ed', 'edition'),
      accessed: doi ? '' : accessed
    });
  }

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

  function clean(o) {
    const out = { kind: o.kind || 'web' };
    for (const k of ['title', 'journal', 'volume', 'pages', 'doi', 'url', 'publisher', 'edition', 'accessed', 'note']) { const v = str(o[k]); if (v) out[k] = v; }
    out.authors = (o.authors || []).map(str).filter(Boolean).slice(0, 60);
    if (o.year) out.year = o.year;
    if (o.month) out.month = o.month;
    if (out.url && !/^https?:\/\//i.test(out.url)) delete out.url;
    return out;
  }

  // ── BibTeX ──
  const ASCII = { ä: 'a', á: 'a', à: 'a', â: 'a', ã: 'a', å: 'a', ö: 'o', ó: 'o', ò: 'o', ô: 'o', ø: 'o', ü: 'u', ú: 'u', ù: 'u', û: 'u', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ñ: 'n', ç: 'c', ß: 'ss', š: 's', ž: 'z', č: 'c', ł: 'l', ő: 'o', ű: 'u' };
  const asciiWord = (s) => String(s || '').toLowerCase().replace(/[^\x00-\x7f]/g, (c) => ASCII[c] ?? '').replace(/[^a-z0-9]/g, '');
  const STOP = new Set(['a', 'an', 'the', 'on', 'of', 'in', 'for', 'and', 'to', 'with', 'from', 'by', 'at', 'via', 'uber', 'zur', 'der', 'die', 'das']);

  /** 引用键：第一作者的姓 + 年份 + 标题第一个实词，例如 planck1901gesetz。没有作者时用标题。 */
  function keyOf(rec) {
    const last = rec.authors[0] ? asciiWord(nameParts(rec.authors[0]).last) : '';
    const words = String(rec.title || '').split(/\s+/).map(asciiWord).filter((w) => w && !STOP.has(w));
    const head = (last || words.shift() || 'ref').slice(0, 20);
    return head + (rec.year || '') + (words[0] || '').slice(0, 16);
  }
  const BIB_SPECIAL = { '\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', $: '\\$', '#': '\\#', _: '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' };
  const bibEsc = (s) => {
    // 一遍替换（反斜杠也在同一张表里），免得先后顺序把前一步加的反斜杠又转一次
    const t = String(s).replace(/[\\&%$#_~^]/g, (c) => BIB_SPECIAL[c]);
    // 去掉不成对的花括号，免得整份文件读不进去
    let depth = 0, out = '';
    for (const ch of t) { if (ch === '{') depth++; if (ch === '}') { if (!depth) continue; depth--; } out += ch; }
    return out + '}'.repeat(depth);
  };
  const BIB_TYPE = { article: 'article', book: 'book', preprint: 'misc', software: 'software', dataset: 'dataset', web: 'online' };

  function toBibTeX(recs) {
    const used = new Map();
    return recs.map((r) => {
      const base = keyOf(r);
      let key = base;
      for (let n = 1; used.has(key); n++) key = base + (n < 26 ? String.fromCharCode(97 + n) : String(n)); // b, c, … z, 26, 27 …
      used.set(key, 1);
      const f = [];
      const add = (k, v) => { if (v !== '' && v != null) f.push(`  ${k} = {${bibEsc(v)}}`); };
      if (r.title) f.push(`  title = {{${bibEsc(r.title)}}}`);
      add('author', r.authors.map((a) => { const p = nameParts(a); return p.first ? `${p.last}, ${p.first}` : `{${p.last}}`; }).join(' and '));
      if (r.kind === 'article') add('journal', r.journal);
      else if (r.kind === 'preprint') add('howpublished', r.journal);
      add('year', r.year || '');
      add('month', r.month || '');
      add('volume', r.volume);
      add('pages', r.pages ? String(r.pages).replace(/\s*[-–]\s*/, '--') : '');
      add('edition', r.edition);
      add('publisher', r.publisher);
      add('doi', r.doi);
      add('url', r.url);
      add('urldate', r.accessed);
      return `@${BIB_TYPE[r.kind] || 'misc'}{${key},\n${f.join(',\n')}\n}`;
    }).join('\n\n') + '\n';
  }

  // ── RIS ──
  const RIS_TYPE = { article: 'JOUR', book: 'BOOK', preprint: 'JOUR', software: 'COMP', dataset: 'DATA', web: 'ELEC' };
  function toRIS(recs) {
    return recs.map((r) => {
      const L = [`TY  - ${RIS_TYPE[r.kind] || 'GEN'}`];
      const add = (tag, v) => { if (v !== '' && v != null) L.push(`${tag}  - ${String(v).replace(/[\r\n]+/g, ' ')}`); };
      add('TI', r.title);
      for (const a of r.authors) { const p = nameParts(a); add('AU', p.first ? `${p.last}, ${p.first}` : p.last); }
      add('T2', r.journal);
      if (r.year) add('PY', r.month ? `${r.year}/${String(r.month).padStart(2, '0')}//` : String(r.year));
      add('VL', r.volume);
      if (r.pages) { const [sp, ep] = String(r.pages).split(/\s*[-–]+\s*/); add('SP', sp); add('EP', ep); }
      add('ET', r.edition);
      add('PB', r.publisher);
      add('DO', r.doi);
      add('UR', r.url);
      add('Y2', r.accessed);
      if (r.kind === 'preprint') add('M3', 'Preprint');
      L.push('ER  - ');
      return L.join('\r\n');
    }).join('\r\n\r\n') + '\r\n';
  }

  // ── 一行参考文献（作者–年份，接近 ACS / APA 的混合写法，给人看的） ──
  function toText(r) {
    const au = r.authors.length > 6 ? `${r.authors.slice(0, 6).join('; ')}; et al.` : r.authors.join('; ');
    const bits = [];
    if (au) bits.push(au);
    if (r.year) bits.push(`(${r.year})`);
    let s = bits.join(' ');
    s += (s ? '. ' : '') + (r.title || '');
    if (r.journal) s += `. ${r.journal}${r.volume ? ` ${r.volume}` : ''}${r.pages ? `, ${r.pages}` : ''}`;
    else if (r.publisher) s += `. ${r.publisher}`;
    if (r.edition) s += `, ${r.edition}`;
    s += '.';
    if (r.doi) s += ` https://doi.org/${r.doi}`;
    else if (r.url) s += ` ${r.url}${r.accessed ? ` (accessed ${r.accessed})` : ''}`;
    return s.replace(/\.\./g, '.');
  }

  const API = { doiOf, splitAuthors, nameParts, fromCatalogue, fromRef, keyOf, toBibTeX, toRIS, toText };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_CITE_CORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
