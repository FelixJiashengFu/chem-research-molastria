// 联网搜索的纯逻辑（public/websearch/web-core.js）：查询改写、请求地址、各家返回值的整理、排序、去重、资源库已收录。
//   node --test tools/websearch-test.mjs
// 返回值是照各家接口文档的格式写的小样本，不联网。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const W = require('../public/websearch/web-core.js');
const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/search-terms.js', import.meta.url), 'utf8'), box);
const G = box.window.MolAstriaTerms.groups;

test('plan: Chinese glossary terms become English, other Chinese stays for the Chinese wiki', () => {
  const a = W.plan('电解液', G);
  assert.equal(a.english, 'electrolyte');
  assert.equal(a.zh, '电解液');
  assert.equal(a.compound, '', 'a glossary concept is not a compound name');
  const b = W.plan('密度泛函 教程', G);
  assert.match(b.english, /density functional/);
  assert.match(b.english, /tutorial/);
  const c = W.plan('怎么用分子动力学模拟蛋白质', G);
  assert.match(c.english, /molecular dynamics/);
  assert.ok(!/怎么/.test(c.zh), 'question words dropped');
  const d = W.plan('阿司匹林', G);
  assert.equal(d.english, '');
  assert.equal(d.zh, '阿司匹林');
  assert.equal(W.plan('中子星', G).zh, '中子星', 'single characters such as 中 are kept');
  const e = W.plan('aspirin', G);
  assert.equal(e.compound, 'aspirin');
  assert.equal(W.plan('  ', G).english, '');
});

test('urls: who gets asked', () => {
  const s = (p, o) => W.urls(p, o).map(([x]) => x);
  assert.deepEqual(s(W.plan('aspirin', G)), ['openalex', 'wikipedia', 'pubchem', 'github']);
  assert.deepEqual(s(W.plan('aspirin', G), { openalexFailed: true }), ['crossref', 'wikipedia', 'pubchem', 'github']);
  assert.deepEqual(s(W.plan('阿司匹林', G)), ['wikipedia-zh'], 'Chinese the glossary does not know: the Chinese wiki first');
  assert.deepEqual(s(W.plan('电解液', G)), ['openalex', 'wikipedia', 'wikipedia-zh', 'github']);
  const bridged = W.withEnglish(W.plan('阿司匹林', G), 'Aspirin');
  assert.deepEqual(s(bridged), ['openalex', 'wikipedia', 'pubchem', 'github'], 'after the bridge, no second Chinese-wiki request');
  for (const [, u] of W.urls(W.plan('C# "x" & y', G))) assert.doesNotThrow(() => new URL(u));
  const [, oa] = W.urls(W.plan('orca', G))[0];
  assert.match(oa, /^https:\/\/api\.openalex\.org\/works\?search=orca&/);
});

test('parse: each source becomes the same shape; bad JSON gives nothing', () => {
  const oa = W.parse('openalex', { results: [{ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1000/ABC', display_name: 'Aspirin <i>in</i> water', publication_year: 2020, cited_by_count: 99, primary_location: { source: { display_name: 'J. Chem.' } } }, { id: '', display_name: '' }] });
  assert.equal(oa.length, 1);
  assert.deepEqual([oa[0].title, oa[0].url, oa[0].doi, oa[0].snippet], ['Aspirin in water', 'https://doi.org/10.1000/abc', '10.1000/abc', 'J. Chem. · 2020']);
  const cr = W.parse('crossref', { message: { items: [{ DOI: '10.2/X', title: ['Electrolytes'], 'container-title': ['Nature'], issued: { 'date-parts': [[2019]] }, 'is-referenced-by-count': 5 }] } });
  assert.equal(cr[0].url, 'https://doi.org/10.2/x');
  const wz = W.parse('wikipedia-zh', { query: { pages: [{ title: '乙酰水杨酸', index: 1, extract: '一种药物。', langlinks: [{ lang: 'en', title: 'Aspirin' }] }] } });
  assert.equal(wz[0].url, 'https://zh.wikipedia.org/wiki/%E4%B9%99%E9%85%B0%E6%B0%B4%E6%9D%A8%E9%85%B8');
  assert.equal(wz[0].source, 'wikipedia');
  assert.equal(W.bridge({ query: { pages: [{ title: 'b', index: 2, langlinks: [{ title: 'Second' }] }, { title: 'a', index: 1, langlinks: [{ title: 'Aspirin' }] }] } }), 'Aspirin');
  assert.equal(W.bridge({}), '');
  const pc = W.parse('pubchem', { PropertyTable: { Properties: [{ CID: 2244, Title: 'Aspirin', MolecularFormula: 'C9H8O4', MolecularWeight: '180.16' }] } });
  assert.equal(pc[0].url, 'https://pubchem.ncbi.nlm.nih.gov/compound/2244');
  assert.match(pc[0].snippet, /C9H8O4 · 180\.16 g\/mol/);
  const gh = W.parse('github', { items: [{ full_name: 'pyscf/pyscf', html_url: 'https://github.com/pyscf/pyscf', description: 'Python SCF', stargazers_count: 1500, language: 'Python' }, { full_name: 'evil', html_url: 'javascript:alert(1)' }] });
  assert.equal(gh.length, 1, 'only github.com addresses');
  assert.equal(gh[0].meta, '★ 1500 · Python');
  for (const s of ['openalex', 'crossref', 'wikipedia', 'pubchem', 'github', 'nope']) { assert.deepEqual(W.parse(s, null), []); assert.deepEqual(W.parse(s, { results: 'x', items: 3 }), []); }
});

test('rank: title matches first, exact names on top, duplicates merged, at most three per source up top', () => {
  const p = W.plan('aspirin', G);
  const r = W.rank([
    { source: 'openalex', title: 'A study of something else', url: 'https://doi.org/10.1/a', doi: '10.1/a', signal: 3, pos: 0 },
    { source: 'openalex', title: 'Aspirin and platelets', url: 'https://doi.org/10.1/b', doi: '10.1/b', signal: 2, pos: 1 },
    { source: 'crossref', title: 'Aspirin and platelets', url: 'https://doi.org/10.1/B', doi: '10.1/b', signal: 0, pos: 4 },
    { source: 'pubchem', title: 'Aspirin', url: 'https://pubchem.ncbi.nlm.nih.gov/compound/2244', signal: 2, pos: 0 },
  ], p);
  assert.equal(r[0].source, 'pubchem', 'exact compound name first');
  assert.equal(r.filter((x) => x.doi === '10.1/b').length, 1, 'same DOI once');
  assert.ok(!r.some((x) => x.doi === '10.1/a'), 'nothing in common with the query: dropped');
  const many = Array.from({ length: 6 }, (_, i) => ({ source: 'github', title: `aspirin-${i}`, url: `https://github.com/a/${i}`, signal: 1, pos: i }));
  const mixed = W.rank([...many, { source: 'wikipedia', title: 'Aspirin tablets', url: 'https://en.wikipedia.org/wiki/Aspirin_tablets', signal: 0.6, pos: 2 }], p, { limit: 4 });
  assert.deepEqual(mixed.map((x) => x.source), ['github', 'github', 'github', 'wikipedia']);
});

test('catalogue: a web result that is already in the catalogue is marked', () => {
  const index = W.catalogIndex([{ id: 'x1', url: 'https://www.github.com/pyscf/pyscf/' }, { id: 'x2', url: 'https://doi.org/10.1/ABC' }]);
  assert.equal(W.inCatalog({ url: 'https://github.com/pyscf/pyscf' }, index).id, 'x1');
  assert.equal(W.inCatalog({ url: 'http://doi.org/10.1/abc' }, index).id, 'x2');
  assert.equal(W.inCatalog({ url: 'https://github.com/other/repo' }, index), null);
  assert.equal(W.normURL('not a url'), '');
  const ranked = W.rank([{ source: 'github', title: 'pyscf/pyscf', url: 'https://github.com/pyscf/pyscf', signal: 2, pos: 0 }], W.plan('pyscf', G), { index });
  assert.equal(ranked[0].catalog.id, 'x1');
});
