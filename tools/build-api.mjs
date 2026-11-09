// MolAstria 开放数据接口：把各栏目的数据文件整理成带版本号的静态 JSON（public/api/v1/），
// 并生成 chemdb-agent 随包的资源目录（同一份来源，不会再差出一截）。
//
//   node tools/build-api.mjs           写文件
//   node tools/build-api.mjs --check   只比对，不写；有出入就以非零状态退出（tools/api-test.mjs 用）
//
// 输出只取决于仓库里的数据，不带生成时间：同样的源码得到同样的文件。日期用各数据文件自己的核对日期。
// 改接口的字段时：加字段不用动版本；删字段、改字段含义要出 v2（新目录），v1 保留。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'public/api/v1';
const SITE = 'https://molastria.com';
const BASE = `${SITE}/api/v1`;
const COMPUTE = 'https://api.molastria.com/v1'; // the compute API for programs (deploy/account-worker.js), described in llms.txt
const SCHEMA = '1.0';

const LICENSE = {
  id: 'CC-BY-4.0',
  name: 'Creative Commons Attribution 4.0 International',
  url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'MolAstria (https://molastria.com)',
  scope: {
    zh: '适用于 MolAstria 自己整理和撰写的内容：条目的选取与分类、中英文说明、核对记录。第三方的名称、标题、链接和价格属于各自的权利人，这里只作事实引用。',
    en: 'Covers what MolAstria compiled and wrote: the selection and classification of entries, the Chinese and English descriptions, and the verification records. Third-party names, titles, links and prices belong to their owners and are cited here as facts.',
  },
};

/** Load browser data files (`window.X = …`) without a DOM. */
function load(...files) {
  const window = {};
  for (const f of files) new Function('window', readFileSync(join(ROOT, f), 'utf8'))(window);
  return window;
}

const en = JSON.parse(readFileSync(join(ROOT, 'i18n/en.json'), 'utf8'));
/** { zh, en } for interface text whose English lives in i18n/en.json; `en` is left out when there is no translation. */
const both = (zh) => (en[zh] ? { zh, en: en[zh] } : { zh });
const pair = ([zh, e]) => ({ zh, en: e });
const table = (obj) => Object.entries(obj).map(([id, v]) => ({ id, ...pair(v) }));
const rows = (list) => list.map(([id, zh, e]) => ({ id, zh, en: e }));
/** Drop undefined values so optional fields simply do not appear. */
const tidy = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function resources() {
  const { CHEMDB_CONTENT: c } = load('public/atlas/content.js');
  const cats = new Map();
  for (const r of c.resources) {
    const cat = cats.get(r.category_code) || { code: r.category_code, ...both(r.category), count: 0 };
    cat.count++;
    cats.set(r.category_code, cat);
  }
  const items = c.resources.map((r) => ({
    number: r.number,
    name: r.name,
    url: r.url,
    page: `${SITE}/atlas/#resources/${r.number}`,
    category_code: r.category_code,
    description: both(r.description),
    access: both(r.access),
    // How chemdb-agent (the MCP server) reaches this resource: adapter / optimade = queryable, catalog = listed only.
    agent_integration: r.integration,
  }));
  return {
    body: {
      updated: c.date,
      count: items.length,
      categories: [...cats.values()].sort((a, b) => a.code.localeCompare(b.code)),
      items,
    },
    // Same order and fields the agent has always used (Chinese, with its own integration notes).
    agent: { source: `${BASE}/resources.json`, updated: c.date, resources: c.resources },
    title: { zh: '资源目录：数据库、软件、数据集与课程', en: 'Resource catalogue: databases, software, datasets and courses' },
    page: `${SITE}/atlas/`,
  };
}

function journals() {
  const { MOLASTRIA_JOURNALS: j } = load('public/journals/journals-data.js');
  const ISSN = { p: 'print', e: 'electronic' };
  const items = j.journals.map((x) => tidy({
    id: x.id,
    name: x.name,
    name_zh: x.zh,
    abbreviation: x.abbr,
    short: x.short,
    page: `${SITE}/journals/#${encodeURIComponent(x.id)}`,
    category: x.cat,
    publisher: x.pub,
    issn: x.issn?.map(([t, value]) => ({ type: ISSN[t] || t, value })),
    open_access: x.oa,
    article_types: x.types,
    links: x.links,
    // Each note names the official pages it was taken from.
    guidance: Object.fromEntries(Object.entries(x.f || {}).map(([k, f]) => [k, tidy({
      zh: f.zh,
      en: f.en,
      sources: (f.src || []).map((s) => (x.links?.[s] ? { link: s, url: x.links[s] } : { id: s, zh: j.sources[s][0], en: j.sources[s][1], url: j.sources[s][2] })),
    })])),
  }));
  return {
    body: {
      updated: j.checked,
      count: items.length,
      categories: rows(j.categories),
      publishers: table(j.publishers),
      open_access_models: table(j.oaModels),
      article_types: table(j.types),
      guidance_fields: rows(j.fields),
      link_names: table(j.linkNames),
      items,
    },
    title: { zh: '期刊投稿指南：计算化学相关期刊与预印本平台', en: 'Journal guide: computational-chemistry journals and preprint servers' },
    page: `${SITE}/journals/`,
  };
}

function scimodels() {
  const { MOLASTRIA_SCIMODELS: s } = load('public/scimodels/scimodels-data.js');
  const items = s.models.map((m) => tidy({
    id: m.slug,
    resource_number: m.n,
    name: m.name,
    name_en: m.nameEn,
    page: `${SITE}/scimodels/#${encodeURIComponent(m.slug)}`,
    group: m.group,
    organisation: m.org,
    year: m.year,
    size: m.size,
    licence: m.licence,
    access: m.access,
    cost: m.cost,
    what: m.what,
    special: m.special,
    input: m.input,
    output: m.output,
    limits: m.limits,
    links: tidy({ hugging_face: m.hf, more_hugging_face: m.hfMore, code: m.code, announcement: m.announce }),
    try_online: m.try,
    try_online_none: m.tryNone,
  }));
  const prices = {
    updated: s.prices.checked,
    unit: { zh: '每百万 token 的官方标准价', en: 'Official list price per million tokens' },
    exchange_rate: { cny_per_usd: s.prices.rate.cny, date: s.prices.rate.date, source: s.prices.rate.src, label: s.prices.rate.label },
    items: s.prices.rows.map((p) => tidy({
      id: p.id,
      model: p.model,
      model_en: p.modelEn,
      science_model: p.slug,
      provider: p.provider,
      tier: p.tier,
      currency: p.cur,
      input: p.in,
      output: p.out,
      note: p.note,
      source: p.src,
    })),
  };
  return {
    body: { updated: s.checked, count: items.length, groups: rows(s.groups), access_kinds: table(s.access), items, prices },
    title: { zh: '科学大模型：模型卡与官方价格对比', en: 'Science foundation models: model cards and official prices' },
    page: `${SITE}/scimodels/`,
  };
}

function videos() {
  const { MOLASTRIA_VIDEOS: v } = load('public/videos/videos-data.js');
  const PLATFORM = { yt: 'youtube', bili: 'bilibili' };
  const link = (x) => (x.p === 'yt'
    ? (x.k === 'playlist' ? `https://www.youtube.com/playlist?list=${encodeURIComponent(x.id)}` : `https://www.youtube.com/watch?v=${encodeURIComponent(x.id)}`)
    : `https://www.bilibili.com/video/${encodeURIComponent(x.id)}/`);
  const items = v.items.map((x) => tidy({
    id: x.id,
    platform: PLATFORM[x.p] || x.p,
    kind: x.k,
    url: link(x),
    page: `${SITE}/videos/#v-${encodeURIComponent(x.id)}`,
    title: x.title,
    channel: x.channel,
    topic: x.topic,
    language: x.lang,
    subtitles: x.subs,
    level: x.level,
    parts: x.parts,
    duration: x.duration,
    year: x.year,
    official_upload: x.official,
    reupload: x.reupload,
    original: x.original,
    software: x.sw,
    embeddable: x.embed === false ? false : undefined,
    note: x.note,
  }));
  return {
    body: { updated: v.checked, count: items.length, topics: v.topics.map(({ id, zh, en: e }) => ({ id, zh, en: e })), items },
    title: { zh: '教学视频：YouTube 与哔哩哔哩上的课程和教程', en: 'Teaching videos: courses and tutorials on YouTube and Bilibili' },
    page: `${SITE}/videos/`,
  };
}

function terms() {
  const { MolAstriaTerms: t } = load('public/search-terms.js');
  const { CHEMDB_CONTENT: c } = load('public/atlas/content.js');
  return {
    // No date of its own: it changes with the catalogue it serves.
    body: { updated: c.date, count: t.groups.length, items: t.groups.map((g) => ({ terms: g })) },
    title: { zh: '中英术语表：互为同义的计算化学术语', en: 'Term table: computational-chemistry synonyms in Chinese and English' },
    page: `${SITE}/`,
  };
}

/** JSON Schema inferred from the data itself, so the description cannot drift from what is served. */
function schemaOf(samples, depth = 0) {
  const kinds = new Set(samples.map((v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v)));
  if (kinds.has('integer') && kinds.has('number')) kinds.delete('integer');
  if (kinds.size > 1) return { type: [...kinds].sort() };
  const [kind] = kinds;
  if (kind === 'array') {
    const inner = samples.flat();
    return inner.length && depth < 6 ? { type: 'array', items: schemaOf(inner, depth + 1) } : { type: 'array' };
  }
  if (kind === 'object') {
    if (depth >= 6) return { type: 'object' };
    const keys = [...new Set(samples.flatMap(Object.keys))];
    // Maps keyed by an id (journal links, guidance fields) would list every id: describe their values instead.
    if (keys.length > 24) return { type: 'object', additionalProperties: schemaOf(samples.flatMap(Object.values), depth + 1) };
    const required = keys.filter((k) => samples.every((o) => k in o));
    return tidy({
      type: 'object',
      properties: Object.fromEntries(keys.map((k) => [k, schemaOf(samples.filter((o) => k in o).map((o) => o[k]), depth + 1)])),
      required: required.length ? required : undefined,
    });
  }
  return { type: kind };
}

function openapi(index, data) {
  const ok = (ref) => ({ description: 'OK', content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });
  const paths = { '/index.json': { get: { operationId: 'listDatasets', summary: 'List every dataset with its entry count and check date', responses: { 200: ok('index') } } } };
  const schemas = { index: schemaOf([index]) };
  for (const e of index.endpoints) {
    paths[`/${e.id}.json`] = { get: { operationId: `get_${e.id}`, summary: `${e.title.en} (${e.count} entries, whole file)`, responses: { 200: ok(e.id) } } };
    schemas[e.id] = schemaOf([data[e.id]]);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'MolAstria open data API',
      version: SCHEMA,
      description: 'Static, read-only JSON: no key, no sign-up, no rate limit, CORS open. Each dataset is one whole file; filter on your side. Text fields are bilingual objects { zh, en }. Schemas are inferred from the published data.',
      license: { name: LICENSE.name, identifier: LICENSE.id },
      contact: { url: `${SITE}/api/` },
    },
    servers: [{ url: BASE }],
    paths,
    components: { schemas },
  };
}

function llms(index) {
  const lines = [
    '# MolAstria',
    '',
    '> MolAstria (molastria.com) is a free research navigator for computational chemistry: a curated, bilingual (Chinese and English) catalogue of databases, software, datasets, courses, journals, science foundation models and teaching videos. All content is free to read; the data is open under CC BY 4.0.',
    '',
    `Programs and AI agents should read the open data API instead of scraping pages. It is static JSON: no key, no sign-up, CORS open. Each dataset is one whole file with \`count\`, \`updated\` (the date it was last checked) and \`items\`; bilingual text is \`{ "zh": …, "en": … }\`. When you use it, credit "${LICENSE.attribution}".`,
    '',
    '## Open data API',
    '',
    `- [Index](${BASE}/index.json): every dataset with its entry count and check date`,
    ...index.endpoints.map((e) => `- [${e.title.en}](${e.url}): ${e.count} entries, checked ${e.updated}`),
    `- [OpenAPI description](${BASE}/openapi.json): paths and JSON Schemas`,
    `- [JavaScript client](${BASE}/molastria.mjs): zero-dependency ES module with a bilingual search across the datasets`,
    `- [Documentation](${SITE}/api/): conventions, licence, live explorer, embeddable widget`,
    '',
    '## Compute API (needs a free API key)',
    '',
    `- Base: ${COMPUTE}. Submit machine-learned-potential calculations (UMA, eSEN, AllScAIP, ANI-2x: single points, optimisations, frequencies, conformers, scans, molecular dynamics, reaction and ionisation energies) with \`POST /jobs\`, then poll \`GET /jobs/{id}\` until \`status\` is \`done\` or \`error\`. \`GET /models\` lists models, jobs and what each costs; \`GET /me\` shows what is left today.`,
    `- Auth: \`Authorization: Bearer mola_…\`. A person makes the key on ${SITE}/pro/account.html after signing in with an email; a program cannot sign up by itself. A free account has 100 uses a day, Pro supporters 200.`,
    "- The compute is the RTX 2080 in the site owner's computer: best effort, and it may be offline. Do not rely on it for anything with a deadline. The MACE models (Academic Software License) are not offered through the API.",
    `- [Documentation](${SITE}/api/#compute): fields, costs, rules, error codes, examples in Python, JavaScript and curl`,
    '',
    '## Pages for people',
    '',
    ...index.endpoints.filter((e) => e.page !== `${SITE}/`).map((e) => `- [${e.title.en}](${e.page})`),
    `- [Explainer handbook](${SITE}/manual/): 20 chapters on how to choose and use these resources`,
    `- [Online models](${SITE}/models/): UMA, MACE and ANI-2x calculations in the browser`,
    '',
    '## Optional',
    '',
    `- [chemdb-agent](${SITE}/atlas/#agent): an MCP server that searches crystal, molecular and quantum-chemistry databases; it ships the same resource catalogue`,
    `- [About](${SITE}/about/): who runs MolAstria`,
    '',
  ];
  return lines.join('\n');
}

export function build() {
  const sets = { resources: resources(), journals: journals(), scimodels: scimodels(), videos: videos(), terms: terms() };
  const head = { api: 'molastria-open-data', schema: SCHEMA, license: LICENSE.id, attribution: LICENSE.attribution, docs: `${SITE}/api/` };
  const files = {};
  const endpoints = [];
  for (const [id, s] of Object.entries(sets)) {
    files[`${OUT}/${id}.json`] = { ...head, dataset: id, ...s.body };
    endpoints.push({ id, url: `${BASE}/${id}.json`, title: s.title, count: s.body.count, updated: s.body.updated, page: s.page });
  }
  files[`${OUT}/index.json`] = {
    ...head,
    license: LICENSE,
    updated: endpoints.map((e) => e.updated).sort().at(-1),
    endpoints,
    client: { javascript: `${BASE}/molastria.mjs`, embed: `${SITE}/api/embed.js` },
    openapi: `${BASE}/openapi.json`,
    agent: { name: 'chemdb-agent', kind: 'MCP server', download: `${SITE}/atlas/downloads/chemdb-agent.zip`, page: `${SITE}/atlas/#agent` },
  };
  const index = files[`${OUT}/index.json`];
  files[`${OUT}/openapi.json`] = openapi(index, Object.fromEntries(endpoints.map((e) => [e.id, files[`${OUT}/${e.id}.json`]])));
  files['agent/chemdb-agent/src/chemdb_agent/catalog/resources.json'] = sets.resources.agent;
  const out = Object.fromEntries(Object.entries(files).map(([path, data]) => [path, JSON.stringify(data, null, 1) + '\n']));
  out['public/llms.txt'] = llms(index);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [path, text] of Object.entries(build())) {
    const full = join(ROOT, path);
    const same = existsSync(full) && readFileSync(full, 'utf8') === text;
    if (check) { if (!same) stale.push(path); continue; }
    if (!same) { mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, text); }
    console.log(`${same ? '  =' : '  +'} ${path} (${(text.length / 1024).toFixed(0)} KB)`);
  }
  if (stale.length) {
    console.error(`开放数据接口的文件和数据不一致，运行 node tools/build-api.mjs：\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  if (check) console.log('开放数据接口：文件与数据一致');
}
