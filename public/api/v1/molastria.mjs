/* MolAstria open data: a zero-dependency client for https://molastria.com/api/v1/
   Works wherever ES modules and fetch do: browsers, Deno, Bun, Node 18+ (copy this file, or pass { base }).

     import { search, load } from 'https://molastria.com/api/v1/molastria.mjs';
     const { hits } = await search('密度泛函 基准');       // also finds entries that only say "DFT benchmark"
     const journals = await load('journals');             // the whole dataset, as served

   Search is bilingual: the term table (terms.json) makes Chinese and English synonyms interchangeable.
   Data: CC BY 4.0, credit "MolAstria (https://molastria.com)". This file: MIT.
   The functions below `client()` use the default client, which reads from wherever this file was loaded. */

export const DATASETS = ['resources', 'journals', 'scimodels', 'videos'];
export const ATTRIBUTION = 'MolAstria (https://molastria.com)';

const HAN = /[㐀-鿿]/;
const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byId = (list) => new Map((list || []).map((x) => [x.id ?? x.code, x]));
const label = (x) => (x ? { zh: x.zh, en: x.en } : undefined);
const same = (s) => ({ zh: s, en: s });

/** One shape for every dataset, so a result list can mix them. `item` is the entry exactly as served. */
const SHAPE = {
  resources(d) {
    const cats = byId(d.categories);
    return d.items.map((r) => ({
      id: r.number, title: r.name, subtitle: label(cats.get(r.category_code)), summary: r.description, url: r.url, page: r.page,
      tags: [r.access?.zh, r.access?.en], item: r,
    }));
  },
  journals(d) {
    const cats = byId(d.categories), pubs = byId(d.publishers), oa = byId(d.open_access_models);
    return d.items.map((j) => ({
      id: j.id, title: j.name, subtitle: label(pubs.get(j.publisher)) || label(cats.get(j.category)), summary: j.guidance?.scope, url: j.links?.home, page: j.page,
      tags: [j.short, j.abbreviation, j.name_zh, cats.get(j.category)?.zh, cats.get(j.category)?.en, oa.get(j.open_access)?.zh, oa.get(j.open_access)?.en], item: j,
    }));
  },
  scimodels(d) {
    const groups = byId(d.groups);
    return d.items.map((m) => ({
      id: m.id, title: m.name, subtitle: m.organisation, summary: m.what, url: m.links?.hugging_face || m.try_online?.[0]?.url || m.page, page: m.page,
      tags: [m.name_en, groups.get(m.group)?.zh, groups.get(m.group)?.en], more: [m.special?.zh, m.special?.en], item: m,
    }));
  },
  videos(d) {
    const topics = byId(d.topics);
    return d.items.map((v) => ({
      id: v.id, title: v.title, subtitle: same(v.channel), summary: v.note, url: v.url, page: v.page,
      tags: [topics.get(v.topic)?.zh, topics.get(v.topic)?.en, v.platform, v.level, ...(v.software || [])], item: v,
    }));
  },
};

/** Does `text` (already normalised) mention `term`? Latin terms must start at a word boundary, so "md" does not hit "cmd". */
function mentions(text, term) {
  if (HAN.test(term)) return text.includes(term);
  return new RegExp(`(^|[^a-z0-9])${escapeRe(term)}`).test(text);
}

/** Split a query into clauses; each clause is a list of interchangeable terms (a synonym group, or the word itself). */
export function clauses(query, groups = []) {
  let rest = ` ${norm(query)} `;
  const out = [];
  // Longest terms first, so "time-dependent density functional" wins over "density functional".
  const known = groups.flatMap((g) => g.map((t) => [norm(t), g])).sort((a, b) => b[0].length - a[0].length);
  for (const [term, group] of known) {
    const at = HAN.test(term) ? rest.indexOf(term) : rest.search(new RegExp(`(?<=[^a-z0-9])${escapeRe(term)}(?=[^a-z0-9])`));
    if (at < 0) continue;
    rest = `${rest.slice(0, at)} ${rest.slice(at + term.length)}`;
    const terms = [...new Set(group.map(norm))];
    if (!out.some((c) => c.join() === terms.join())) out.push(terms);
  }
  for (const word of rest.split(' ').filter(Boolean)) out.push([word]);
  return out;
}

export function client({ base = new URL('.', import.meta.url), fetch: fetcher = globalThis.fetch } = {}) {
  const cache = new Map();

  /** A dataset exactly as served ('resources', 'journals', 'scimodels', 'videos', 'terms', 'index'). Fetched once. */
  function load(name) {
    if (!cache.has(name)) {
      const url = new URL(`${name}.json`, base);
      const job = fetcher(url).then((r) => {
        if (!r.ok) throw new Error(`MolAstria: ${url} answered ${r.status}`);
        return r.json();
      });
      job.catch(() => cache.delete(name)); // a failed fetch may be retried
      cache.set(name, job);
    }
    return cache.get(name);
  }

  const shaped = new Map();
  /** Every entry of one dataset in the common shape { dataset, id, title, subtitle, summary, url, page, item }. */
  async function entries(name) {
    if (!SHAPE[name]) throw new Error(`MolAstria: no dataset "${name}" (have ${DATASETS.join(', ')})`);
    if (!shaped.has(name)) {
      const list = SHAPE[name](await load(name)).map((e) => {
        const { tags, more, ...entry } = e;
        const text = [e.summary?.zh, e.summary?.en, e.subtitle?.zh, e.subtitle?.en, e.url, ...(more || [])];
        // What search reads: title, tags, everything else. Not enumerable, so it stays out of JSON and of copies.
        return Object.defineProperty({ dataset: name, ...entry }, '_text', {
          value: [norm(e.title), norm(tags.filter(Boolean).join(' · ')), norm(text.filter(Boolean).join(' · '))],
        });
      });
      shaped.set(name, list);
    }
    return shaped.get(name);
  }

  /**
   * Search across datasets. Every clause of the query must match (synonyms count); entries rank by where they match:
   * title 6, tags 3, description 1, plus 10 when the title is the query. An empty query returns everything in catalogue order.
   * Options: datasets (default all four), limit (default 20, 0 = no limit), where (a function on the served entry).
   * Returns { query, total, counts: { dataset: n }, hits: [{ dataset, id, title, subtitle, summary, url, page, score, item }] }.
   */
  async function search(query = '', { datasets = DATASETS, limit = 20, where } = {}) {
    const names = [].concat(datasets);
    const [terms, ...lists] = await Promise.all([load('terms').then((t) => t.items.map((x) => x.terms), () => []), ...names.map(entries)]);
    const q = norm(query), parts = clauses(q, terms);
    const hits = [];
    for (const list of lists) {
      for (const entry of list) {
        if (where && !where(entry.item, entry)) continue;
        const [title, tags, text] = entry._text;
        let score = 0, all = true;
        for (const alternatives of parts) {
          let best = 0;
          for (const term of alternatives) {
            const s = mentions(title, term) ? 6 : mentions(tags, term) ? 3 : mentions(text, term) ? 1 : 0;
            if (s > best) best = s;
          }
          if (!best) { all = false; break; }
          score += best;
        }
        if (!all) continue;
        if (q && title === q) score += 10;
        hits.push({ ...entry, score });
      }
    }
    // Stable sort: equal scores stay in dataset, then catalogue, order.
    hits.sort((a, b) => b.score - a.score);
    const counts = Object.fromEntries(names.map((n) => [n, 0]));
    for (const h of hits) counts[h.dataset]++;
    return { query: String(query), total: hits.length, counts, hits: limit ? hits.slice(0, limit) : hits };
  }

  /** The list of datasets with entry counts and check dates (index.json). */
  const index = () => load('index');

  return { load, entries, search, index };
}

const main = client();
export const { load, entries, search, index } = main;
export default main;
