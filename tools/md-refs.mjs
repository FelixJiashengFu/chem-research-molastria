// Checks the references of NequIP (tools/md/refs.json): every DOI must resolve on OpenAlex (Crossref's data) and its
// year, first author, title and volume must match (years may differ by one: online vs print year). A reference without a DOI
// is checked against its arXiv record instead (title and first author). A volume such as "s3-34" (series 3, vol. 34) matches "34".
//   node tools/md-refs.mjs            (NODE_USE_SYSTEM_CA=1 behind antivirus HTTPS inspection)
//   node tools/md-refs.mjs young    (only ids containing "young")
import { readFileSync } from 'node:fs';

const only = process.argv[2] || '';
const refs = JSON.parse(readFileSync(new URL('md/refs.json', import.meta.url), 'utf8')).filter((r) => r.id.includes(only));
const UA = { 'User-Agent': 'MolAstria-reference-check/1.0 (https://molastria.com)' };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
// Titles in the records carry markup such as <i>…</i>: drop the tags (repeatedly, so nothing tag-like is left), then keep letters and digits only.
const untag = (s) => { let prev; do { prev = s; s = s.replace(/<[^>]*>/g, ''); } while (s !== prev); return s; };
const norm = (s) => untag(String(s || '').normalize('NFKD')).replace(/[^a-z0-9]/gi, '').toLowerCase();
const sameTitle = (ours, theirs) => { const o = norm(ours), t = norm(theirs); return t.length > 8 && (o === t || o.startsWith(t) || o.endsWith(t) || t.startsWith(o) || t.endsWith(o) || (o.length > 20 && t.includes(o))); }; // old records wrap the title, e.g. "IX. On the laws … In a letter addressed to …"
const get = async (url) => {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status !== 429 && res.status < 500) return res;
    await wait(4000 * (i + 1));
  }
  return fetch(url, { headers: UA });
};

let bad = 0;
for (const r of refs) {
  await wait(300);
  if (!r.doi) {
    const res = await get(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(r.arxiv)}`), xml = res.ok ? await res.text() : '';
    const entry = xml.split('<entry>')[1] || '', title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '', first = (entry.match(/<name>([^<]+)<\/name>/) || [])[1] || '';
    const ok = title && sameTitle(r.title, title) && norm(r.authors.split(',')[0]).endsWith(norm(first.split(/\s+/).pop()));
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.id} (arXiv:${r.arxiv})${ok ? '' : `: "${title.trim()}" by ${first}`}`);
    if (!ok) bad++;
    continue;
  }
  const res = await get(`https://api.openalex.org/works/doi:${encodeURIComponent(r.doi).replace(/%2F/g, '/')}`);
  if (!res.ok) { console.log(`FAIL ${r.id}: DOI ${r.doi} → HTTP ${res.status}`); bad++; continue; }
  const m = await res.json(), problems = [];
  if (Math.abs(m.publication_year - (r.recordYear || r.year)) > 1) problems.push(`year ${r.recordYear || r.year} vs ${m.publication_year}`); // recordYear: the DOI points to a later reprint (see the note)
  // recordFirst: the record's author order is wrong (see the note), so compare against the name it puts first
  const first = m.authorships?.[0]?.raw_author_name || m.authorships?.[0]?.author?.display_name || '';
  const ours = norm(r.recordFirst || r.authors.split(',')[0].replace(/\s+et al\.?$/, '')) , family = norm(first.split(',')[0].trim().split(/\s+/).pop()), familyFirst = norm(first.split(/[\s,]+/)[0]);
  if (first && !r.garbled && !(ours.includes(family) || ours.includes(familyFirst))) problems.push(`first author ${first}`);
  if (!r.garbled && !sameTitle(r.title, m.title)) problems.push(`title "${m.title}"`); // garbled: the record's non-ASCII letters are broken, so only year and volume can be compared
  const vol = m.biblio?.volume;
  if (r.vol && vol && String(vol) !== String(r.vol) && !String(vol).endsWith(`-${r.vol}`)) problems.push(`volume ${r.vol} vs ${vol}`);
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${r.id}${problems.length ? ': ' + problems.join('; ') : ''}`);
  if (problems.length) bad++;
}
console.log(bad ? `\n${bad} of ${refs.length} references need attention` : `\nall ${refs.length} references match their DOI record`);
process.exit(bad ? 1 : 0);
