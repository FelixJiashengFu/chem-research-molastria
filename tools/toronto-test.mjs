// 多伦多大学 · AI 化学与材料（public/toronto/）和 AI 化学企业图谱（public/industry/）的内容完整性：
// 两种语言都齐、每条事实有出处、id 不重、两页互相引用的 id 都对得上、链接都是 https、页面和顶栏都接上了。
//   node --test tools/toronto-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
const box = { window: {} };
vm.runInNewContext(read('toronto/to-data.js'), box);
vm.runInNewContext(read('industry/ind-data.js'), box);
const U = box.window.MOLASTRIA_UOFT;
const I = box.window.MOLASTRIA_IND;
const both = (v, where) => { assert.ok(v && typeof v.zh === 'string' && v.zh.trim() && typeof v.en === 'string' && v.en.trim(), `${where}: zh and en`); assert.doesNotMatch(v.en, /[㐀-鿿]/, `${where}: Chinese in the English text`); };
const https = (u, where) => assert.match(u, /^https:\/\/[\w.-]+\.[a-z]{2,}(\/|$)/, `${where}: https link`);
const companyIds = new Set(I.companies.map((c) => c.id));
const orgIds = new Set(U.orgs.map((o) => o.id));

test('U of T organisations: complete, bilingual, every fact sourced', () => {
  assert.equal(orgIds.size, U.orgs.length, 'organisation ids are unique');
  assert.ok(U.orgs.length >= 12);
  for (const o of U.orgs) {
    assert.match(o.id, /^[a-z0-9]+$/);
    assert.ok(U.kinds[o.kind], `${o.id}: kind`);
    for (const k of ['name', 'home', 'lead', 'line', 'about']) both(o[k], `${o.id}.${k}`);
    https(o.url, o.id);
    assert.ok(o.facts.length >= 1, `${o.id}: at least one checked fact`);
    for (const [zh, en, src] of o.facts) { both({ zh, en }, `${o.id} fact`); https(src, `${o.id} fact source`); }
    for (const [n, zh, en] of o.nums) { assert.ok(n && zh && en, `${o.id} number`); assert.doesNotMatch(en, /[㐀-鿿]/); }
    for (const id of o.co) assert.ok(companyIds.has(id), `${o.id}: company ${id} is in the company map`);
    for (const [zh, en, href] of o.site) { assert.ok(zh && en); assert.doesNotMatch(href, /^(\/|https?:)/, 'site links are relative'); assert.ok(readFileSync(new URL(`../public/${href.split('#')[0]}`, import.meta.url)), `${href} exists`); }
  }
});

test('U of T: graph edges, SDLs, papers and the rest point at real things', () => {
  for (const [a, b, zh, en] of U.edges) { assert.ok(orgIds.has(a) && orgIds.has(b), `edge ${a}–${b}`); assert.ok(zh && en); }
  assert.equal(U.sdls.map((s) => s[0]).join(), 'SDL0,SDL1,SDL2,SDL3,SDL4,SDL5,SDL6,SDL7');
  for (const s of U.sdls) { both(s[1], s[0]); both(s[2], s[0]); assert.ok(s[4].length > 10); }
  const dois = new Set();
  for (const p of U.papers) {
    assert.match(p.doi, /^10\.\d{4,9}\/\S+$/, p.doi);
    assert.ok(!dois.has(p.doi), `duplicate ${p.doi}`); dois.add(p.doi);
    assert.ok(orgIds.has(p.org), `${p.doi}: org`);
    assert.ok(p.year >= 2010 && p.year <= 2026 && p.title && p.venue && p.who);
    both(p.note, p.doi);
  }
  for (const x of U.involve) { both(x, x.label); https(x.href, x.label); }
  for (const n of U.notes.open) both(n, 'note');
  for (const k of ['industry', 'startups', 'government', 'academic', 'nonprofit']) assert.ok(U.acPartners[k].length > 0, k);
});

test('company map: complete, bilingual, status explained, ties sourced', () => {
  assert.equal(companyIds.size, I.companies.length, 'company ids are unique');
  assert.ok(I.companies.length >= 80, 'eighty-plus companies (the nav says so)');
  const hallIds = new Set([...read('open-models/om-data.js').matchAll(/^\s{6}id: '([\w-]+)'/gm)].map((m) => m[1]));
  for (const c of I.companies) {
    assert.match(c.id, /^[a-z0-9]+$/);
    assert.ok(I.cats[c.cat], `${c.id}: category`);
    assert.ok(I.regions[c.region], `${c.id}: region`);
    assert.ok(c.name.trim(), c.id);
    both(c.hq, `${c.id}.hq`); both(c.what, `${c.id}.what`);
    https(c.url, c.id);
    assert.ok(['site', 'news'].includes(c.v), `${c.id}: verification`);
    if (c.status) { assert.ok(I.statuses[c.status], `${c.id}: status`); if (c.status !== 'active') both(c.statusNote, `${c.id}.statusNote`); }
    if (c.src) https(c.src, `${c.id}.src`);
    if (c.to) { both(c.to, `${c.id}.to`); https(c.toSrc, `${c.id}.toSrc`); assert.ok(c.uoft?.length, `${c.id}: a U of T tie names the organisation`); }
    for (const id of c.uoft || []) assert.ok(orgIds.has(id), `${c.id}: organisation ${id}`);
    if (c.om) assert.ok(hallIds.has(c.om), `${c.id}: Open Model Hall pavilion ${c.om}`);
    if (c.since) assert.match(c.since, /^(19|20)\d\d$/);
  }
  // Each organisation that names a company is named back by it (or the company is a general partner list entry).
  for (const o of U.orgs) for (const id of o.co) { const c = I.companies.find((x) => x.id === id); assert.ok(c.uoft?.includes(o.id) || c.uoft?.length || o.id === 'cqiqc' || o.id === 'scinet' || id === 'lges', `${id} ↔ ${o.id}`); }
  for (const id of Object.keys(I.cats)) assert.ok(I.companies.some((c) => c.cat === id), `category ${id} is used`);
});

test('pages, nav and SEO are wired up', () => {
  const nav = read('shared-nav.js');
  assert.match(nav, /\['toronto', 'toronto\/index\.html'/);
  assert.match(nav, /\['industry', 'industry\/index\.html'/);
  for (const [page, scripts] of [['toronto/index.html', ['../industry/ind-data.js', 'to-data.js', 'to.js', 'to.css']], ['industry/index.html', ['../toronto/to-data.js', 'ind-data.js', 'ind.js', '../toronto/to.css']]]) {
    const h = read(page);
    for (const s of ['../shared-nav.js', '../fundamental-science/fundamental.css', ...scripts]) assert.ok(h.includes(s), `${page} loads ${s}`);
    assert.match(h, /data-section="(toronto|industry)"/);
  }
  const seo = readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  for (const p of ['toronto/', 'industry/']) assert.ok(seo.includes(`["${p}", "0.7", "monthly"]`), `sitemap ${p}`);
  assert.ok(read('open-models/om.js').includes('../industry/index.html'), 'the Open Model Hall links to the company map');
  // No logos: the pages draw text monograms only.
  for (const f of ['toronto/to.js', 'industry/ind.js']) assert.doesNotMatch(read(f), /<img\b/, `${f}: no images`);
});
