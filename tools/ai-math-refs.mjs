// Checks the references of the Frontier AI Mathematics section (public/ai-math/aim-data.js): every arXiv id must exist
// with the same title and first author, and every DOI must resolve on OpenAlex with the same title and year (±1).
//   node tools/ai-math-refs.mjs            (NODE_USE_SYSTEM_CA=1 behind antivirus HTTPS inspection)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/ai-math/aim-data.js', import.meta.url), 'utf8'), box);
const refs = box.window.MOLASTRIA_AIM.refs;
const UA = { 'User-Agent': 'MolAstria-reference-check/1.0 (https://molastria.com)' };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const untag = (s) => { let prev; do { prev = s; s = s.replace(/<[^>]*>/g, ''); } while (s !== prev); return s; }; // OpenAlex titles sometimes carry <i>…</i>
const norm = (s) => untag(String(s || '').normalize('NFKD')).replace(/[^a-z0-9]/gi, '').toLowerCase();
const get = async (url) => {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status !== 429 && res.status < 500) return res;
    await wait(4000 * (i + 1));
  }
  return fetch(url, { headers: UA });
};
const firstAuthor = (s) => norm(String(s).split(',')[0]);

let bad = 0, checked = 0, skipped = 0;
const fail = (r, why) => { console.log(`FAIL ${r.id}: ${why}`); bad++; };
// arXiv：一次问完（id_list 最多几十个）
const ax = refs.filter((r) => r.arxiv);
const res = await get(`https://export.arxiv.org/api/query?max_results=${ax.length}&id_list=${ax.map((r) => r.arxiv).join(',')}`);
if (!res.ok) { console.log(`arXiv API → HTTP ${res.status}`); process.exit(1); }
const entries = (await res.text()).split('<entry>').slice(1);
for (const r of ax) {
  const e = entries.find((x) => new RegExp(`arxiv\\.org/abs/${r.arxiv.replace('.', '\\.')}(v\\d+)?<`).test(x));
  if (!e) { fail(r, `arXiv ${r.arxiv} not found`); continue; }
  const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1], author = (e.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || '';
  if (norm(title) !== norm(r.title)) fail(r, `title differs: “${String(title).replace(/\s+/g, ' ')}”`);
  else if (!norm(author).includes(firstAuthor(r.authors))) fail(r, `first author differs: ${author}`);
  else checked++;
}
for (const r of refs.filter((x) => x.doi)) {
  await wait(300);
  const d = await get(`https://api.openalex.org/works/doi:${encodeURIComponent(r.doi)}`);
  if (!d.ok) { fail(r, `DOI ${r.doi} → HTTP ${d.status}`); continue; }
  const j = await d.json();
  if (norm(j.title) !== norm(r.title)) fail(r, `title differs: “${j.title}”`);
  else if (Math.abs(j.publication_year - r.year) > 1) fail(r, `year ${j.publication_year}, ours ${r.year}`);
  else checked++;
}
for (const r of refs.filter((x) => !x.arxiv && !x.doi)) { console.log(`SKIP ${r.id}: only a web address (${r.url}), not checked by this script`); skipped++; }
console.log(`${checked} of ${refs.length} references confirmed, ${skipped} skipped, ${bad} failed`);
process.exit(bad ? 1 : 0);
