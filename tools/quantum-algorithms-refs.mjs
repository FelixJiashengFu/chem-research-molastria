// Checks the references of the Quantum Algorithms section (public/quantum/algorithms/qa-data.js): every DOI must resolve and its
// year, first author and title must match; every arXiv id must exist with the same title and first author.
// DOIs are looked up on OpenAlex (Crossref's data, reachable from more networks); add --crossref to ask Crossref directly.
//   node tools/quantum-algorithms-refs.mjs            (NODE_USE_SYSTEM_CA=1 behind antivirus HTTPS inspection)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/quantum/algorithms/qa-data.js', import.meta.url), 'utf8'), box);
const refs = box.window.MOLASTRIA_QA.refs;
const crossref = process.argv.includes('--crossref');
const UA = { 'User-Agent': 'MolAstria-reference-check/1.0 (https://molastria.com)' };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const norm = (s) => String(s || '').normalize('NFKD').replace(/<[^>]+>/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
// Some records lose ü, ß or Ä to U+FFFD; each such character may stand for one letter or none.
const sameTitle = (ours, theirs) => {
  const t = String(theirs || '').normalize('NFKD').replace(/<[^>]+>/g, '').toLowerCase().replace(/�/g, '\u0001').replace(/[^a-z0-9\u0001]/g, '');
  const o = norm(ours);
  return new RegExp(`^${t.replace(/\u0001/g, '.?')}`).test(o) || o.startsWith(t.replace(/\u0001/g, ''));
};
const get = async (url) => {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status !== 429 && res.status < 500) return res;
    await wait(4000 * (i + 1));
  }
  return fetch(url, { headers: UA });
};
const lastName = (s) => norm(String(s).split(/\s+/).pop());

let bad = 0;
for (const r of refs) {
  const problems = [];
  if (r.doi) {
    await wait(crossref ? 1200 : 300);
    const res = await get(crossref ? `https://api.crossref.org/works/${encodeURIComponent(r.doi)}` : `https://api.openalex.org/works/doi:${encodeURIComponent(r.doi)}`);
    if (!res.ok) { console.log(`FAIL ${r.id}: DOI ${r.doi} → HTTP ${res.status}`); bad++; continue; }
    const j = await res.json();
    const m = crossref ? j.message : j;
    const title = crossref ? m.title?.[0] : m.title;
    const years = crossref ? [m.issued, m['published-print'], m['published-online']].map((d) => d?.['date-parts']?.[0]?.[0]).filter(Boolean) : [m.publication_year];
    const first = crossref ? (m.author?.[0]?.family || m.author?.[0]?.name) : m.authorships?.[0]?.author?.display_name;
    // books: the DOI's record may carry the e-book date, so allow two years
    if (!years.some((y) => Math.abs(y - r.year) <= (r.kind === 'book' ? 2 : 0))) problems.push(`year ${r.year} vs ${years.join('/')}`);
    const firstOk = !first || /collaborators|quantum/i.test(first) || norm(r.authors).includes(lastName(first)) || norm(r.authors).includes(norm(first));
    if (!firstOk) problems.push(`first author ${first}`);
    if (!sameTitle(r.title, title)) problems.push(`title "${title}"`);
    const vol = crossref ? m.volume : m.biblio?.volume;
    if (r.vol && vol && String(vol) !== r.vol) problems.push(`volume ${r.vol} vs ${vol}`);
  } else if (r.arxiv) {
    await wait(3500);
    const res = await get(`https://export.arxiv.org/api/query?id_list=${r.arxiv}`);
    const xml = res.ok ? await res.text() : '';
    const entry = xml.split('<entry>')[1] || '';
    const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const first = (entry.match(/<name>([\s\S]*?)<\/name>/) || [])[1];
    const year = +((entry.match(/<published>(\d{4})/) || [])[1]);
    if (!title) problems.push(`arXiv ${r.arxiv} not found`);
    else {
      if (!sameTitle(r.title, title.replace(/\s+/g, ' '))) problems.push(`title "${title.trim()}"`);
      if (first && !norm(r.authors).includes(lastName(first))) problems.push(`first author ${first}`);
      if (year !== r.year) problems.push(`year ${r.year} vs ${year}`);
    }
  } else {
    console.log(`skip ${r.id}: web page ${r.url} (check by hand)`);
    continue;
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${r.id}${problems.length ? ': ' + problems.join('; ') : ''}`);
  if (problems.length) bad++;
}
console.log(bad ? `\n${bad} of ${refs.length} references need attention` : `\nall ${refs.length} references with a DOI or arXiv id match`);
process.exit(bad ? 1 : 0);
