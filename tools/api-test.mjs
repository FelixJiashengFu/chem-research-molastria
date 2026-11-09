// 开放数据接口（public/api/v1/）：生成的内容完整、双语齐全、条数和栏目数据对得上。
//   node --test tools/api-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from './build-api.mjs';
import { client, clauses, DATASETS } from '../public/api/v1/molastria.mjs';

const built = build();
const files = Object.fromEntries(Object.entries(built).filter(([p]) => p.endsWith('.json')).map(([p, text]) => [p, JSON.parse(text)]));
const api = (name) => files[`public/api/v1/${name}.json`];
const index = api('index');
const http = (u) => /^https?:\/\/[^\s]+$/.test(u);
const bilingual = (v, where) => { assert.ok(v && v.zh && v.en, `${where}: 缺中文或英文`); };

test('总入口列出每个数据集，条数和日期与文件一致', () => {
  assert.equal(index.schema, '1.0');
  assert.equal(index.license.id, 'CC-BY-4.0');
  assert.deepEqual(index.endpoints.map((e) => e.id), ['resources', 'journals', 'scimodels', 'videos', 'terms']);
  for (const e of index.endpoints) {
    const d = api(e.id);
    assert.ok(d, e.id);
    assert.equal(e.url, `https://molastria.com/api/v1/${e.id}.json`);
    assert.equal(d.count, d.items.length, e.id);
    assert.equal(e.count, d.count, e.id);
    assert.equal(e.updated, d.updated, e.id);
    assert.match(d.updated, /^\d{4}-\d{2}-\d{2}$/, e.id);
    assert.equal(d.schema, index.schema);
    assert.equal(d.license, 'CC-BY-4.0');
    bilingual(e.title, e.id);
    assert.ok(d.count > 0, e.id);
  }
  assert.equal(index.updated, index.endpoints.map((e) => e.updated).sort().at(-1));
});

test('资源目录：编号连续，每条有链接、双语说明和已知的类别', () => {
  const d = api('resources');
  assert.deepEqual(d.items.map((r) => r.number), d.items.map((_, i) => i + 1));
  const codes = new Set(d.categories.map((c) => c.code));
  assert.equal(d.categories.reduce((n, c) => n + c.count, 0), d.count);
  for (const c of d.categories) bilingual(c, `category ${c.code}`);
  for (const r of d.items) {
    assert.ok(r.name && http(r.url), `#${r.number}`);
    assert.ok(codes.has(r.category_code), `#${r.number}`);
    bilingual(r.description, `#${r.number} description`);
    bilingual(r.access, `#${r.number} access`);
    assert.ok(['adapter', 'optimade', 'catalog'].includes(r.agent_integration), `#${r.number}`);
  }
});

test('chemdb-agent 随包的目录和接口是同一批条目', () => {
  const agent = files['agent/chemdb-agent/src/chemdb_agent/catalog/resources.json'];
  const d = api('resources');
  assert.equal(agent.updated, d.updated);
  assert.deepEqual(agent.resources.map((r) => [r.number, r.name, r.url]), d.items.map((r) => [r.number, r.name, r.url]));
});

test('期刊：代号都能在对照表里查到，每条说明带出处链接', () => {
  const d = api('journals');
  const ids = (list) => new Set(list.map((x) => x.id));
  const cats = ids(d.categories), pubs = ids(d.publishers), oa = ids(d.open_access_models), types = ids(d.article_types), fields = ids(d.guidance_fields);
  assert.equal(new Set(d.items.map((j) => j.id)).size, d.count);
  for (const j of d.items) {
    assert.ok(j.name && cats.has(j.category), j.id);
    if (j.publisher) assert.ok(pubs.has(j.publisher), j.id);
    if (j.open_access) assert.ok(oa.has(j.open_access), j.id);
    for (const t of j.article_types || []) assert.ok(types.has(t), `${j.id} ${t}`);
    for (const u of Object.values(j.links)) assert.ok(http(u), j.id);
    for (const [k, g] of Object.entries(j.guidance)) {
      assert.ok(fields.has(k), `${j.id} ${k}`);
      bilingual(g, `${j.id} ${k}`);
      assert.ok(g.sources.length, `${j.id} ${k}: 没有出处`);
      for (const s of g.sources) assert.ok(http(s.url), `${j.id} ${k}`);
    }
  }
});

test('科学大模型：模型卡双语，价格是数字并带官方出处', () => {
  const d = api('scimodels');
  const groups = new Set(d.groups.map((g) => g.id)), kinds = new Set(d.access_kinds.map((a) => a.id));
  const slugs = new Set(d.items.map((m) => m.id));
  assert.equal(slugs.size, d.count);
  for (const m of d.items) {
    assert.ok(groups.has(m.group), m.id);
    for (const a of m.access) assert.ok(kinds.has(a), `${m.id} ${a}`);
    for (const k of ['organisation', 'what', 'limits']) bilingual(m[k], `${m.id} ${k}`);
  }
  assert.ok(d.prices.exchange_rate.cny_per_usd > 1);
  for (const p of d.prices.items) {
    assert.ok(typeof p.input === 'number' && typeof p.output === 'number' && ['USD', 'CNY'].includes(p.currency), p.id);
    assert.ok(http(p.source), p.id);
    if (p.science_model) assert.ok(slugs.has(p.science_model), p.id);
  }
});

test('教学视频：每条有平台链接、已知主题和双语说明', () => {
  const d = api('videos');
  const topics = new Set(d.topics.map((t) => t.id));
  assert.equal(new Set(d.items.map((v) => `${v.platform}:${v.id}`)).size, d.count);
  for (const v of d.items) {
    assert.ok(['youtube', 'bilibili'].includes(v.platform), v.id);
    assert.match(v.url, v.platform === 'youtube' ? /^https:\/\/www\.youtube\.com\/(watch\?v=|playlist\?list=)/ : /^https:\/\/www\.bilibili\.com\/video\/BV/, v.id);
    assert.ok(v.title && v.channel && topics.has(v.topic), v.id);
    bilingual(v.note, v.id);
  }
});

test('没有把内部字段或本地路径带出去', () => {
  const text = Object.entries(built).filter(([p]) => p.startsWith('public/')).map(([, t]) => t).join('\n');
  assert.doesNotMatch(text, /chemdb_agent\.adapters|[A-Za-z]:\\\\|\/Users\/|\/home\//);
  assert.doesNotMatch(text, /"href": "\.\.\//);
});

test('每条都有指回 MolAstria 的页面地址', () => {
  const at = { resources: /\/atlas\/#resources\/\d+$/, journals: /\/journals\/#[\w-]+$/, scimodels: /\/scimodels\/#[\w.-]+$/, videos: /\/videos\/#v-[\w-]+$/ };
  for (const [id, re] of Object.entries(at)) for (const x of api(id).items) assert.match(x.page, re, `${id} ${x.id ?? x.number}`);
});

test('OpenAPI 与 llms.txt：每个数据集都有路径和结构，链接指向接口', () => {
  const o = api('openapi');
  assert.equal(o.openapi, '3.1.0');
  assert.equal(o.servers[0].url, 'https://molastria.com/api/v1');
  for (const e of index.endpoints) {
    assert.ok(o.paths[`/${e.id}.json`]?.get.operationId, e.id);
    const schema = o.components.schemas[e.id];
    assert.deepEqual(schema.properties.items.type, 'array', e.id);
    assert.ok(schema.required.includes('count') && schema.required.includes('updated'), e.id);
  }
  // Fields every entry has are required; optional ones are not.
  const video = o.components.schemas.videos.properties.items.items;
  assert.ok(video.required.includes('url') && !video.required.includes('duration'));
  const llms = built['public/llms.txt'];
  assert.match(llms, /^# MolAstria\n\n> /);
  for (const e of index.endpoints) assert.ok(llms.includes(`(${e.url}): ${e.count} entries`), e.id);
  assert.ok(llms.includes('CC BY 4.0'));
});

// ── the JS client (public/api/v1/molastria.mjs), reading the files as they would be served ──
const served = (url) => {
  const path = `public/api/v1/${String(url).split('/').pop()}`;
  return Promise.resolve(path in built ? { ok: true, json: async () => JSON.parse(built[path]) } : { ok: false, status: 404 });
};
const m = client({ base: 'https://molastria.com/api/v1/', fetch: served });
const titles = (r) => r.hits.map((h) => h.title);

test('JS 库：读取数据集，不存在的给出明确的错误', async () => {
  assert.equal((await m.load('journals')).count, api('journals').count);
  assert.equal((await m.index()).endpoints.length, index.endpoints.length);
  await assert.rejects(m.load('nope'), /404/);
  await assert.rejects(m.entries('terms'), /no dataset/);
});

test('JS 库：搜索中英同义词互通，标题命中排在前面', async () => {
  const zh = await m.search('密度泛函', { limit: 0 }), en = await m.search('DFT', { limit: 0 });
  assert.ok(zh.total > 20);
  assert.deepEqual(titles(zh), titles(en), '“密度泛函”和 “DFT” 找到同一批条目');
  assert.deepEqual(titles(await m.search('机器学习势', { limit: 0 })), titles(await m.search('machine learning potential', { limit: 0 })));
  const orca = await m.search('orca');
  assert.equal(orca.hits[0].title, 'ORCA');
  assert.equal(orca.hits[0].dataset, 'resources');
  assert.ok(orca.hits[0].score > orca.hits[1].score);
  assert.ok(orca.counts.videos > 0, 'ORCA 的教学视频也在结果里');
  assert.equal(Object.values(orca.counts).reduce((a, b) => a + b, 0), orca.total);
});

test('JS 库：每个词都要命中，空查询返回全部，可按数据集和条件筛', async () => {
  const all = await m.search('', { limit: 0 });
  assert.equal(all.total, DATASETS.reduce((n, d) => n + api(d).count, 0));
  assert.equal((await m.search('zzzz-not-a-word')).total, 0);
  const both = await m.search('gaussian 教程', { limit: 0 }), one = await m.search('gaussian', { limit: 0 });
  assert.ok(both.total > 0 && both.total < one.total);
  const j = await m.search('JCTC', { datasets: ['journals'] });
  assert.equal(j.hits[0].item.id, 'jctc');
  assert.deepEqual(Object.keys(j.counts), ['journals']);
  const free = await m.search('', { datasets: 'resources', limit: 0, where: (r) => r.access.en === 'Free' });
  assert.ok(free.total > 50 && free.hits.every((h) => h.item.access.zh === '免费'));
  assert.equal((await m.search('dft', { limit: 3 })).hits.length, 3);
  // "md" is a word, not a fragment of "cmd" or "amd".
  for (const h of (await m.search('md', { limit: 0 })).hits) assert.match(JSON.stringify([h.title, h.subtitle, h.summary, h.item]).toLowerCase(), /(^|[^a-z0-9])md/);
});

test('JS 库：结果的形状固定，原始条目原样带回，可以转成 JSON', async () => {
  for (const d of DATASETS) {
    const [h] = (await m.search('', { datasets: [d], limit: 1 })).hits;
    assert.deepEqual(Object.keys(h), ['dataset', 'id', 'title', 'subtitle', 'summary', 'url', 'page', 'item', 'score'], d);
    assert.ok(h.title && http(h.url) && http(h.page), d);
    bilingual(h.summary, d);
    assert.deepEqual(h.item, api(d).items[0], d);
    assert.ok(JSON.stringify(h).length > 50);
  }
});

test('JS 库：查询按术语表拆成子句，长的术语优先', () => {
  const groups = api('terms').items.map((x) => x.terms);
  const c = clauses('Time-Dependent Density Functional 激发态 foo', groups);
  assert.equal(c.length, 3);
  assert.ok(c[0].includes('tddft') && !c[0].includes('dft'));
  assert.ok(c[1].includes('excited state'));
  assert.deepEqual(c[2], ['foo']);
  assert.deepEqual(clauses('  ', groups), []);
});

test('JS 库和嵌入脚本不依赖别的文件，也不用本站以外的地址', () => {
  const sdk = readFileSync(new URL('../public/api/v1/molastria.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(sdk, /^import\s/m);
  assert.doesNotMatch(sdk, /\bdocument\b|\bwindow\b|localStorage/);
  const embed = readFileSync(new URL('../public/api/embed.js', import.meta.url), 'utf8');
  for (const u of embed.match(/https?:\/\/[^\s'"`<>)]+/g)) assert.match(u, /^https:\/\/(molastria\.com|creativecommons\.org)\//, u);
  assert.doesNotMatch(embed, /innerHTML\s*=(?!\s*MARK;)/, '嵌入卡片里的数据只用 textContent 写入');
});
