// Checks the Research Library of the Fundamental Science section against Crossref: for every reference in
// public/fundamental-science/fs-data.js the DOI must resolve, and the year, volume, first author and title must match.
// Run it after adding references; it waits between requests to respect Crossref's rate limit.
//   NODE_USE_SYSTEM_CA=1 node tools/fundamental-refs.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/fundamental-science/fs-data.js', import.meta.url), 'utf8'), sandbox);
const refs = sandbox.window.MOLASTRIA_FS.refs;
const UA = { 'User-Agent': 'MolAstria-reference-check/1.0 (https://molastria.com)' };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const norm = (s) => String(s || '').normalize('NFKD').replace(/<[^>]+>/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
// Some Crossref records carry U+FFFD where the publisher's ü or ß was lost; each such character may stand for one letter or none.
const sameTitle = (ours, theirs) => {
  const t = String(theirs || '').normalize('NFKD').replace(/<[^>]+>/g, '').toLowerCase().replace(/�/g, '\u0001').replace(/[^a-z0-9\u0001]/g, '');
  return new RegExp(`^${t.replace(/\u0001/g, '.?')}$`).test(norm(ours));
};
let bad = 0;
for (const r of refs) {
  await wait(1200);
  let res;
  for (let i = 0; i < 5; i++) {
    res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(r.doi)}`, { headers: UA });
    if (res.status !== 429) break;
    await wait(4000 * (i + 1));
  }
  if (!res.ok) { console.log(`FAIL ${r.id}: DOI ${r.doi} → HTTP ${res.status}`); bad++; continue; }
  const m = (await res.json()).message;
  const years = [m.issued, m['published-print'], m['published-online']].map((d) => d?.['date-parts']?.[0]?.[0]).filter(Boolean);
  const first = norm(m.author?.[0]?.family || m.author?.[0]?.name);
  const problems = [];
  if (!years.includes(r.year)) problems.push(`year ${r.year} vs ${years.join('/')}`);
  if (m.volume && String(m.volume) !== r.vol) problems.push(`volume ${r.vol} vs ${m.volume}`);
  if (first && !norm(r.authors).includes(first)) problems.push(`first author ${m.author?.[0]?.family}`);
  if (!sameTitle(r.title, m.title?.[0])) problems.push(`title "${m.title?.[0]}"`);
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${r.id}${problems.length ? ': ' + problems.join('; ') : ''}`);
  if (problems.length) bad++;
}
console.log(bad ? `\n${bad} of ${refs.length} references need attention` : `\nall ${refs.length} references match Crossref`);
process.exit(bad ? 1 : 0);
