// Tests for 研习台的站内内容来源 (public/learn/learn-sources.js): every source's data file loads through load() in a fake
// browser (node:vm), turns into at least one chapter with real text in both languages and a link to the chapter on its page,
// and every entry of the demo whitelist points to an existing page whose code really handles that anchor.
//   node --test tools/learn-sources-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const PUB = new URL('../public/', import.meta.url);
const SITE = 'https://site.test/';
const read = (rel) => readFileSync(new URL(rel, PUB), 'utf8');
const HAN = /[㐀-鿿]/;

// A fake browser: window is the global, document.currentScript is learn-sources.js, and appending a <script> runs the file
// from public/ in the same context, then fires onload (or onerror when the file is missing).
function browser({ chemHub } = {}) {
  const appended = [];
  const ctx = { console, URL, setTimeout, Promise };
  ctx.window = ctx;
  ctx.location = { href: `${SITE}learn/index.html` };
  if (chemHub) ctx.ChemHub = chemHub;
  ctx.document = {
    currentScript: { src: `${SITE}learn/learn-sources.js` },
    createElement: (tag) => ({ tag }),
    head: {
      appendChild(el) {
        appended.push(el.src);
        setTimeout(() => {
          const rel = String(el.src).startsWith(SITE) ? String(el.src).slice(SITE.length) : null;
          if (!rel || !existsSync(new URL(rel, PUB))) { el.onerror?.(); return; }
          vm.runInContext(read(rel), ctx, { filename: rel });
          el.onload?.();
        }, 0);
        return el;
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(read('learn/learn-sources.js'), ctx, { filename: 'learn/learn-sources.js' });
  return { ctx, S: ctx.MOLASTRIA_LEARN_SOURCES, appended };
}

// The page's own code: its index.html plus the .js files next to it (not sub-folders such as qchem/app/).
const codeCache = new Map();
function pageCode(page) {
  if (codeCache.has(page)) return codeCache.get(page);
  const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  const files = readdirSync(new URL(dir || '.', PUB), { withFileTypes: true }).filter((f) => f.isFile() && f.name.endsWith('.js')).map((f) => dir + f.name);
  const code = { html: read(page), js: files.map(read).join('\n') };
  codeCache.set(page, code);
  return code;
}

// Is `hash` an anchor the page really handles? Either a static id in the page, or a prefix the page's script routes
// (startsWith('play-') / id="d-${…}") together with the suffix being registered there ('states', games.box = …),
// or an exact hash the router compares against (h === 'lab').
function handled(page, hash) {
  const { html, js } = pageCode(page);
  const all = `${html}\n${js}`;
  if (all.includes(`id="${hash}"`)) return 'static id';
  if (js.includes(`=== '${hash}'`)) return 'exact route';
  const m = /^([a-z]+-)(.+)$/.exec(hash);
  if (m) {
    const [, pre, rest] = m;
    const routed = js.includes(`startsWith('${pre}')`) || js.includes(`id="${pre}\${`);
    const known = js.includes(`'${rest}'`) || js.includes(`games.${rest} =`) || js.includes(`id: '${rest}'`);
    if (routed && known) return 'routed prefix';
  }
  return null;
}

const both = (t, where) => {
  assert.ok(t && typeof t.zh === 'string' && t.zh.trim() && typeof t.en === 'string' && t.en.trim(), `${where}: both languages`);
  assert.ok(!HAN.test(t.en), `${where}: no Chinese in the English text (${t.en})`);
};

test('the six sources are declared with a data file, a global and a page that exist', () => {
  const { S } = browser();
  assert.deepEqual([...S.sources.map((s) => s.id)], ['qp', 'fm', 'qa', 'qc', 'qb', 'fs']);
  for (const s of S.sources) {
    both(s.label, `source ${s.id}`);
    assert.ok(existsSync(new URL(s.script, PUB)), `${s.id}: ${s.script} exists`);
    assert.ok(existsSync(new URL(s.page, PUB)), `${s.id}: ${s.page} exists`);
    assert.ok(read(s.script).includes(`window.${s.global} =`), `${s.id}: ${s.script} defines window.${s.global}`);
    assert.ok(pageCode(s.page).js.includes(`startsWith('${s.anchor}')`), `${s.id}: the page routes #${s.anchor}…`);
  }
});

test('every source loads on demand and yields chapters with text in both languages and a working link', async () => {
  const { S, appended } = browser();
  for (const s of S.sources) {
    const data = await S.load(s.id);
    assert.ok(data && typeof data === 'object', `${s.id}: load() resolves to the data`);
    assert.equal(appended.at(-1), `${SITE}${s.script}`, `${s.id}: script path resolved from the site root`);
    const list = S.chapters(s.id, data);
    assert.ok(list.length >= 1, `${s.id}: at least one chapter`);
    assert.equal(new Set(list.map((c) => c.id)).size, list.length, `${s.id}: unique chapter ids`);
    assert.equal(S.chapters(s.id).length, list.length, `${s.id}: chapters() also reads the loaded global`);
    for (const c of list) {
      const where = `${s.id}:${c.id}`;
      both(c.name, `${where} name`);
      const zh = c.text('zh'), en = c.text('en');
      assert.ok(zh.length > 200 && HAN.test(zh), `${where}: Chinese text (${zh.length} chars)`);
      assert.ok(en.length > 200, `${where}: English text (${en.length} chars)`);
      assert.ok(!HAN.test(en), `${where}: no Chinese in the English text: ${(en.match(/.{0,30}[㐀-鿿].{0,30}/) || [''])[0]}`);
      assert.ok(!/<[a-z][^>]*>/i.test(zh + en), `${where}: plain text, no HTML`);
      assert.ok(zh.includes(c.name.zh) && en.includes(c.name.en), `${where}: text starts from the chapter's name`);
      assert.equal(c.path, `${s.page}#${s.anchor}${c.id}`, `${where}: path`);
      assert.equal(c.href, `${SITE}${c.path}`, `${where}: href resolved from the site root`);
      assert.ok(handled(s.page, `${s.anchor}${c.id}`), `${where}: #${s.anchor}${c.id} is handled by ${s.page}`);
      for (const d of c.demos) assert.ok(S.isDemo(d), `${where}: demo ${d} is on the whitelist`);
    }
  }
});

test('the loaded chapter text carries the verified content (explanations, checks, questions)', async () => {
  const { S } = browser();
  const qp = await S.load('qp');
  const birth = S.chapters('qp', qp).find((c) => c.id === 'birth');
  for (const t of [...qp.chapters[0].explain, ...qp.chapters[0].checks, ...qp.chapters[0].pitfalls]) {
    assert.ok(birth.text('zh').includes(t.zh.trim().slice(0, 20)), 'qp zh carries explain/checks/pitfalls');
    assert.ok(birth.text('en').includes(t.en.trim().slice(0, 20)), 'qp en carries explain/checks/pitfalls');
  }
  const qc = await S.load('qc');
  const sec = qc.sections[0];
  const ch = S.chapters('qc', qc).find((c) => c.id === sec.id);
  assert.ok(ch.text('en').includes(sec.questions[0][1].en.slice(0, 20)), 'qc carries the answers to its questions');
  assert.ok(ch.text('en').includes(sec.topics[0][2].en.slice(0, 20)), 'qc carries its key points');
  assert.ok(ch.text('en').includes('(Established)'), 'qc marks the research status of a point');
});

test('load() caches, finds chapters and rejects unknown sources or missing files', async () => {
  const { S, appended, ctx } = browser();
  const a = await S.load('qa');
  const n = appended.length;
  assert.equal(await S.load('qa'), a, 'same data the second time');
  assert.equal(appended.length, n, 'no second script tag');
  const f = await S.find('qa', 'shor');
  assert.equal(f && f.id, 'shor');
  assert.equal(await S.find('qa', 'nope'), null);
  await assert.rejects(S.load('zz'), (e) => /未知/.test(e.message) && e.code === 'unknown-source' && /Unknown/.test(e.en) && !HAN.test(e.en));
  S.sources.push({ id: 'xx', label: { zh: '测试', en: 'Test' }, page: 'x.html', script: 'missing/nope.js', global: 'MOLASTRIA_NOPE', anchor: 'x-' });
  await assert.rejects(S.load('xx'), /加载失败|未知/);
  S.sources.pop();
  assert.ok(ctx.MOLASTRIA_QA, 'the data file defined its global');
});

test('parseRef reads goal links such as qp:birth', () => {
  const { S } = browser();
  assert.deepEqual({ ...S.parseRef('qp:birth') }, { source: 'qp', chapter: 'birth' });
  assert.deepEqual({ ...S.parseRef(' fm:la ') }, { source: 'fm', chapter: 'la' });
  for (const bad of ['', 'qp', 'zz:birth', 'qp:', 'qp:a b', 'qp:<x>', null, undefined]) assert.equal(S.parseRef(bad), null, String(bad));
});

test('every demo on the whitelist has both languages, keywords and an anchor its page handles', () => {
  const { S } = browser();
  assert.ok(S.demos.length >= 15 && S.demos.length <= 40, `${S.demos.length} demos`);
  assert.equal(new Set(S.demos.map((d) => d.id)).size, S.demos.length, 'unique ids');
  for (const d of S.demos) {
    assert.match(d.id, /^[a-z]+-[a-z0-9]+$/, `${d.id}: id shape`);
    both(d.label, `${d.id} label`);
    both(d.desc, `${d.id} desc`);
    assert.ok(Array.isArray(d.keywords) && d.keywords.length >= 3, `${d.id}: keywords`);
    const [file, hash] = d.path.split('#');
    assert.ok(existsSync(new URL(file, PUB)), `${d.id}: ${file} exists`);
    assert.ok(hash, `${d.id}: has an anchor`);
    assert.ok(handled(file, hash), `${d.id}: #${hash} is handled by ${file}`);
    assert.equal(d.href, `${SITE}${d.path}`, `${d.id}: href resolved from the site root`);
    assert.equal(S.demo(d.id), d);
  }
  assert.equal(S.demo('nope'), null);
  assert.equal(S.isDemo('toString'), false, 'no prototype keys');
});

test('the anchor checker itself rejects anchors a page does not handle', () => {
  assert.equal(handled('qchem/index.html', 'play-nothing'), null);
  assert.equal(handled('quantum/physics/index.html', 'd-nothing'), null);
  assert.equal(handled('quantum/algorithms/index.html', 'demo-nothing'), null);
  assert.ok(handled('qchem/index.html', 'play-box'));
  assert.ok(handled('qchem/index.html', 'lab'));
});

test('links use ChemHub.link when shared-nav.js provides it', () => {
  const { S } = browser({ chemHub: { link: (p) => `https://other.test/sub/${p}` } });
  assert.equal(S.demo('play-box').href, 'https://other.test/sub/qchem/index.html#play-box');
  assert.equal(S.link('learn/index.html'), 'https://other.test/sub/learn/index.html');
});

test('matchDemos ranks demos by keywords and demoCatalog lists them for a prompt', () => {
  const { S } = browser();
  const m = S.matchDemos('Why does tunnelling through a barrier depend so strongly on mass? 隧穿', 4);
  assert.ok(m.length >= 1 && m.length <= 4);
  assert.ok(m.some((d) => /tunnel/.test(d.id)), m.map((d) => d.id).join(','));
  assert.equal(S.matchDemos('', 5).length, 0);
  assert.equal(S.matchDemos('Grover', 3, ['fs-ci'])[0].id, 'fs-ci', 'preferred ids come first');
  const cat = S.demoCatalog('en', S.demos.slice(0, 3));
  assert.equal(cat.split('\n').length, 3);
  assert.ok(cat.startsWith('play-box: Particle in a box'));
  assert.ok(!HAN.test(S.demoCatalog('en')), 'English catalog has no Chinese');
  assert.ok(HAN.test(S.demoCatalog('zh')));
});

test('demo() only returns whitelist entries, never inherited Object members', () => {
  const { S } = browser();
  for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(S.demo(id), null, id);
    assert.equal(S.isDemo(id), false, id);
  }
  assert.ok(S.demo(S.demos[0].id));
});
