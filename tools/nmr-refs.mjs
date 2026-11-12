// Checks the references of the NMR section (public/nmr/nmr-data.js): every DOI must resolve on OpenAlex (Crossref's data) and its
// year, first author, title and volume must match. Years may differ by one (online vs print year); a title may be a
// prefix or a suffix of the record's (old records drop superscripts such as "13C–1H").
//   node tools/nmr-refs.mjs            (NODE_USE_SYSTEM_CA=1 behind antivirus HTTPS inspection)
//   node tools/nmr-refs.mjs bax        (only ids containing "bax")
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/nmr/nmr-data.js', import.meta.url), 'utf8'), box);
const only = process.argv[2] || '';
const refs = box.window.MOLASTRIA_NMR.refs.filter((r) => r.id.includes(only));
const UA = { 'User-Agent': 'MolAstria-reference-check/1.0 (https://molastria.com)' };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
// Titles in the records carry markup such as <i>…</i>: drop the tags (repeatedly, so nothing tag-like is left), then keep letters and digits only.
const untag = (s) => { let prev; do { prev = s; s = s.replace(/<[^>]*>/g, ''); } while (s !== prev); return s; };
const norm = (s) => untag(String(s || '').normalize('NFKD')).replace(/[^a-z0-9]/gi, '').toLowerCase();
const sameTitle = (ours, theirs) => { const o = norm(ours), t = norm(theirs); return t.length > 8 && (o === t || o.startsWith(t) || o.endsWith(t) || t.startsWith(o) || t.endsWith(o)); };
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
  const res = await get(`https://api.openalex.org/works/doi:${encodeURIComponent(r.doi).replace(/%2F/g, '/')}`);
  if (!res.ok) { console.log(`FAIL ${r.id}: DOI ${r.doi} → HTTP ${res.status}`); bad++; continue; }
  const m = await res.json(), problems = [];
  if (Math.abs(m.publication_year - r.year) > 1) problems.push(`year ${r.year} vs ${m.publication_year}`);
  const first = m.authorships?.[0]?.raw_author_name || m.authorships?.[0]?.author?.display_name || '';
  const ours = norm(r.authors.split(',')[0]), family = norm(first.split(',')[0].trim().split(/\s+/).pop()), familyFirst = norm(first.split(/[\s,]+/)[0]);
  if (first && !(ours.endsWith(family) || ours.endsWith(familyFirst))) problems.push(`first author ${first}`);
  if (!sameTitle(r.title, m.title)) problems.push(`title "${m.title}"`);
  const vol = m.biblio?.volume;
  if (r.vol && vol && String(vol) !== String(r.vol)) problems.push(`volume ${r.vol} vs ${vol}`);
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${r.id}${problems.length ? ': ' + problems.join('; ') : ''}`);
  if (problems.length) bad++;
}
console.log(bad ? `\n${bad} of ${refs.length} references need attention` : `\nall ${refs.length} references match their DOI record`);
process.exit(bad ? 1 : 0);
