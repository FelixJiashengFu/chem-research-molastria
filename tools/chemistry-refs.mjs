// 化学学科馆的文献核对：十五个展馆（public/chemistry/<id>/data.js）的每一篇文献都要能按 DOI 在 OpenAlex（数据来自 Crossref）查到，
// 年份、第一作者、题目和卷号要对得上。年份允许差一年（网络版和印刷版）；题目允许是记录里的前缀或后缀（老记录会丢掉上下标）。
//   node tools/chemistry-refs.mjs                 核对全部（NODE_USE_SYSTEM_CA=1 用于本机杀毒软件拦截 HTTPS 时）
//   node tools/chemistry-refs.mjs organic         只核对一个展馆
//   node tools/chemistry-refs.mjs --lookup id=doi id=doi …   按 DOI 查出条目，打印成 data.js 里的写法（加新文献时用）
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const UA = { 'User-Agent': 'MolAstria-reference-check/1.0 (https://molastria.com)' };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const untag = (s) => { let prev; do { prev = s; s = s.replace(/<[^>]*>/g, ''); } while (s !== prev); return s; };
// 比较时去掉标签、空格和标点。有的老记录把变音字母存成了替换字符（Hückel → H\uFFFDckel），有的直接写成不带变音的字母（Pyykkö → Pyykko），
// 所以两种写法都试：先分解变音再去掉非 ASCII（ö → o），或者把非 ASCII 字母整个去掉（ü → 空）
const forms = (s) => { const t = untag(String(s || '')); return [t.normalize('NFKD'), t].map((x) => x.replace(/[^\x00-\x7f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()); };
const sameTitle = (ours, theirs) => forms(ours).some((o, i) => { const t = forms(theirs)[i]; return t.length > 8 && (o === t || o.startsWith(t) || o.endsWith(t) || t.startsWith(o) || t.endsWith(o)); });
const get = async (url) => {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status !== 429 && res.status < 500) return res;
    } catch { /* 网络抖动，重试 */ }
    await wait(3000 * (i + 1));
  }
  return fetch(url, { headers: UA });
};
const work = async (doi) => {
  const res = await get(`https://api.openalex.org/works/doi:${encodeURIComponent(doi).replace(/%2F/g, '/')}`);
  return res.ok ? res.json() : { error: res.status };
};
const initials = (full) => {
  const parts = String(full).replace(/\s+/g, ' ').trim().split(' ');
  if (parts.length < 2) return full;
  const last = parts.pop();
  return `${parts.map((p) => (/^[a-z]/.test(p) ? p : p.split('-').map((q) => `${q[0]}.`).join('-'))).join(' ')} ${last}`;
};

if (process.argv[2] === '--lookup') {
  for (const arg of process.argv.slice(3)) {
    const [id, doi] = arg.includes('=') ? arg.split('=') : ['x', arg];
    await wait(250);
    const m = await work(doi);
    if (m.error) { console.log(`// FAIL ${id}: ${doi} → HTTP ${m.error}`); continue; }
    const names = (m.authorships || []).map((a) => initials(a.author?.display_name || a.raw_author_name || ''));
    const authors = names.length > 3 ? `${names.slice(0, 3).join(', ')} et al.` : names.join(', ');
    const b = m.biblio || {}, pages = b.first_page ? (b.last_page && b.last_page !== b.first_page ? `${b.first_page}–${b.last_page}` : b.first_page) : '';
    const entry = { id, authors, year: m.publication_year, title: untag(m.title || '').replace(/\s+/g, ' ').trim(), journal: m.primary_location?.source?.display_name || '', vol: b.volume || '', pages, doi: doi.toLowerCase() };
    console.log(`      ${JSON.stringify(entry).replace(/"(\w+)":/g, '$1: ').replace(/,(\w+): /g, ', $1: ').replace(/^\{/, '{ ').replace(/\}$/, ' }')},`);
  }
  process.exit(0);
}

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/chemistry/chem-subjects.js', import.meta.url), 'utf8'), box);
const only = process.argv[2] || '';
let bad = 0, n = 0;
for (const [sid] of box.window.MOLASTRIA_CHEM_SUBJECTS.subjects) {
  if (only && sid !== only) continue;
  const file = new URL(`../public/chemistry/${sid}/data.js`, import.meta.url);
  if (!existsSync(file)) { console.log(`skip ${sid}: no data.js yet`); continue; }
  const b = { window: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), b);
  for (const r of b.window.MOLASTRIA_CHEM.refs) {
    n++;
    await wait(250);
    const m = await work(r.doi);
    if (m.error) { console.log(`FAIL ${sid}/${r.id}: DOI ${r.doi} → HTTP ${m.error}`); bad++; continue; }
    const problems = [];
    if (Math.abs(m.publication_year - r.year) > 1) problems.push(`year ${r.year} vs ${m.publication_year}`);
    const first = m.authorships?.[0]?.raw_author_name || m.authorships?.[0]?.author?.display_name || '';
    const okAuthor = [0, 1].some((i) => { const o = forms(r.authors.split(',')[0])[i], fa = forms(first.split(',')[0].trim().split(/\s+/).pop())[i], ff = forms(first.split(/[\s,]+/)[0])[i]; return o.endsWith(fa) || o.endsWith(ff); });
    if (first && !okAuthor) problems.push(`first author ${first}`);
    if (!sameTitle(r.title, m.title)) problems.push(`title "${m.title}"`);
    const vol = m.biblio?.volume;
    // OpenAlex 给 Zeitschrift für Physikalische Chemie 早年各卷加了一个 U（如 4U、50U），比较时去掉
    if (r.vol && vol && String(vol).replace(/^(\d+)U$/, '$1') !== String(r.vol)) problems.push(`volume ${r.vol} vs ${vol}`);
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${sid}/${r.id}${problems.length ? ': ' + problems.join('; ') : ''}`);
    if (problems.length) bad++;
  }
}
console.log(bad ? `\n${bad} of ${n} references need attention` : `\nall ${n} references match their DOI record`);
process.exit(bad ? 1 : 0);
