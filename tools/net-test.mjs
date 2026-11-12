// Tests for the network query engine (public/hub/net-engine.js) on the real catalogue snapshot.
// Run: node --test tools/net-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const window = {};
for (const f of ['search-terms.js', 'atlas/content.js', 'merged-data.js', 'hub/net-engine.js', 'hub/net-misses.js']) new Function('window', readFileSync(new URL(f, root), 'utf8'))(window);
const net = window.MolAstriaNet.build(window.CHEMRESEARCH_DATA, window.CHEMDB_CONTENT.guides, window.MolAstriaTerms);
const names = (list) => list.map((x) => (x.entity || x).name);

test('every catalogue entry and handbook chapter is a document', () => {
  assert.equal(net.docs.length, window.CHEMRESEARCH_DATA.items.length + window.CHEMDB_CONTENT.guides.length);
  assert.ok(net.entities.length > 300);
});

test('a program known only from blog titles becomes the centre, with its relations', () => {
  for (const q of ['Shermo', 'shermo', ' SHERMO ']) {
    const r = net.query(q);
    assert.equal(r.mode, 'entity');
    assert.equal(r.center.name, 'Shermo');
  }
  const r = net.query('Shermo');
  assert.ok(net.dedupe(r.primary).length >= 2);
  assert.ok(names(r.related).includes('热力学'));
  assert.ok(names(r.related).includes('配分函数'));
  assert.ok(r.extended.length > 0, 'further reading about the related concepts');
});

test('synonyms, partial names and misspellings resolve to the same node', () => {
  assert.equal(net.query('electrostatic potential').center.name, '静电势');
  assert.equal(net.query('Multiwf').center.name, 'Multiwfn');
  const typo = net.query('Gaussain');
  assert.equal(typo.center.name, 'Gaussian');
  assert.equal(typo.corrected, 'gaussian');
});

test('free text without a node falls back to ranked full-text search', () => {
  const r = net.query('锂电池 电解液');
  assert.equal(r.mode, 'text');
  assert.ok(r.primary.length >= 1);
  for (const x of r.primary) assert.match(x.doc.title + x.doc.excerpt, /电解|electrolyte/i);
  assert.ok(names(r.related).includes('电解液'));
});

test('catalogue software brings its siblings, and spellings of one thing are not relations', () => {
  assert.ok(names(net.query('ORCA').siblings).includes('Gaussian'));
  const dft = net.query('DFT');
  assert.ok(!names(dft.related).includes('密度泛函'));
});

test('a Sobereva post and its forum mirror are one result', () => {
  const r = net.dedupe(net.query('Shermo').primary);
  const both = r.find((x) => x.also.length);
  assert.ok(both, 'merged pair');
  assert.deepEqual(new Set([both.doc.source, ...both.also.map((d) => d.source)]), new Set(['sobereva', 'keinsci']));
});

test('English entries mention a program in their own text, not through a topic tag label', () => {
  const vasp = net.entities.find((e) => e.name === 'VASP');
  const english = [...vasp.docs.keys()].map((i) => net.docs[i]).filter((d) => !d.official && d.type !== 'handbook' && !/[㐀-鿿]/.test(d.title));
  assert.ok(english.length > 0, 'English entries about VASP');
  for (const d of english) assert.match(d.raw.title + ' ' + d.raw.body, /vasp/i, d.title); // not just tagged "VASP/第一性原理"
});

test('ordinary English words are not names, and the overview hubs are real programs', () => {
  const aim = net.entities.find((e) => e.name === 'AIM');
  for (const [i] of aim.docs) assert.match(net.docs[i].raw.title + ' ' + net.docs[i].raw.body, /\bAIM\b|原子|分子中的原子/, net.docs[i].title);
  const gaussian = net.entities.find((e) => e.name === 'Gaussian');
  for (const [i] of gaussian.docs) {
    const d = net.docs[i];
    const rest = (d.raw.title + ' ' + d.raw.body).replace(/gaussian[- ]?(?:process|basis|type|function|orbital|smearing|distribution|mixture|kernel|regression|noise|broadening|charge|wave|width)\w*/gi, '');
    assert.ok(/gaussian|高斯/i.test(rest) || d.tags.includes('Gaussian'), d.title);
  }
  const hubs = net.overview().related.map((r) => r.entity).filter((e) => ['software', 'database', 'name'].includes(e.kind));
  assert.ok(hubs.length >= 8);
  for (const e of hubs) assert.match(e.name, /[A-Z0-9]|[㐀-鿿]/, `${e.name} looks like an ordinary word`);
});

test('suggestions complete names and say which kind they are', () => {
  const s = net.suggest('multi');
  assert.equal(s[0].entity.name, 'Multiwfn');
  assert.ok(net.suggest('静电').some((x) => x.entity.name === '静电势'));
});

// ── 没找到的词（hub/net-misses.js）：只记术语表认不出、只能全文检索的查询 ──
const M = window.MolAstriaNetMisses;

test('没找到的词：认出来的、拼错纠正的不记，认不出的记下命中条数', () => {
  assert.equal(M.missOf(net.query('Multiwfn')), null);
  assert.equal(M.missOf(net.query('Gaussain')), null, '拼写纠错认出了 Gaussian，不算缺词');
  assert.equal(M.missOf(net.query('')), null, '空查询是全网概览');
  assert.equal(M.missOf(net.source(net.sources[0].id)), null);
  assert.deepEqual(M.missOf(net.query('qwertyzz')), { hits: 0 });
  const t = net.query('Jensen');
  assert.equal(t.mode, 'text');
  assert.equal(M.missOf(t).hits, t.primary.length);
  assert.ok(t.primary.length > 0, '全文检索能找到条目，但术语表不认识这个词');
});

test('没找到的词：讲解手册新章节的术语现在都能认出来', () => {
  for (const q of ['平面波', '准粒子', 'GW', '面跳跃', '活性空间', 'Jordan-Wigner', '自旋轨道耦合', '锥形交叉', 'VQE', 'Hartree-Fock', 'QTAIM', 'Mulliken', '量子比特', 'DMRG', 'PAW']) {
    const r = net.query(q);
    assert.equal(r.mode, 'entity', q);
    assert.equal(M.missOf(r), null, q);
  }
});

test('没找到的词：站长看板上报过的词（2026-11-11）补进术语表后都能认出来，RAG 不再命中 fragment', () => {
  const want = { CsPbI3: '钙钛矿', Cu: '铜', wiki: '百科', rag: '检索增强生成', RAG: '检索增强生成', 知识库: '知识库', votca: 'VOTCA' }; // 2026-11-12：目录收了 VOTCA（#253），它自己就是实体
  for (const [q, center] of Object.entries(want)) {
    const r = net.query(q);
    assert.equal(r.mode, 'entity', q);
    assert.equal(r.center.name, center, q);
    assert.equal(M.missOf(r), null, q);
  }
  const rag = net.query('rag').primary.map((p) => p.doc.title);
  assert.ok(rag.includes('OpenScholar'));
  assert.ok(!rag.some((t) => /fragment|average/i.test(t)), 'a known short word is matched as a word, not inside other words');
  // No entity for these words: the handbook's chapter 13 now explains them in prose, but the term table has no entry, so they stay misses and the board keeps counting.
  for (const q of ['台阶能', '铜水界面']) assert.equal(net.query(q).mode, 'text', q);
});

test('没找到的词：记录、计数、排序、上限和删除', () => {
  let s = M.parse(null);
  assert.deepEqual(s, { v: 1, off: false, share: true, items: [] });
  const miss = net.query('qwertyzz');
  s = M.record(s, '  qwertyzz ', miss, 1000);
  s = M.record(s, 'QWERTYZZ', miss, 2000);
  s = M.record(s, 'Multiwfn', net.query('Multiwfn'), 3000);
  assert.deepEqual(s.items, [{ q: 'QWERTYZZ', n: 2, hits: 0, first: 1000, last: 2000 }], '同一个词不分大小写算一次，认出来的不记');
  s = M.record(s, 'Jensen', net.query('Jensen'), 4000);
  assert.deepEqual(M.ranked(s).map((x) => x.q), ['QWERTYZZ', 'Jensen'], '查得多的在前');
  assert.deepEqual(s.items.map((x) => x.q), ['Jensen', 'QWERTYZZ'], '存的时候最近的在前');
  let big = M.parse(null);
  for (let i = 0; i < M.MAX + 5; i++) big = M.record(big, `zzq${i}x`, miss, i);
  assert.equal(big.items.length, M.MAX);
  assert.ok(!big.items.some((x) => x.q === 'zzq0x'), '超出上限时丢掉最久没查的');
  s = M.remove(s, 'qwertyzz');
  assert.deepEqual(s.items.map((x) => x.q), ['Jensen']);
  assert.deepEqual(M.clear(s).items, []);
});

test('没找到的词：网址、邮箱、长串数字、太短太长的输入不记；关掉记录会清空', () => {
  const miss = net.query('qwertyzz');
  for (const q of ['x', 'https://example.org/a', 'www.example.org', 'someone@example.org', '10.1021/acs.jctc.0c00001', '13912345678', '1391 2345 678', 'a'.repeat(M.MAXLEN + 1)]) {
    assert.deepEqual(M.record(M.parse(null), q, miss).items, [], q);
  }
  assert.deepEqual(M.record(M.parse(null), '7732-18-5', miss).items, [], 'CAS 号这样的编号也不记，它不是术语');
  assert.equal(M.record(M.parse(null), 'ωB97X-D3', miss).items.length, 1, '带数字的方法名照常记');
  let s = M.record(M.parse(null), 'qwertyzz', miss);
  s = M.setOff(s, true);
  assert.deepEqual(s, { v: 1, off: true, share: true, items: [] });
  assert.deepEqual(M.record(s, 'qwertyzz', miss).items, [], '关着时不记');
  assert.equal(M.setOff(s, false).off, false);
});

test('没找到的词：坏数据当成空的；复制文本和 GitHub Issue 地址', () => {
  for (const raw of ['{', 'null', '[]', '"x"', JSON.stringify({ items: [{ q: 3 }, null, { q: '  ' }] })]) assert.deepEqual(M.parse(raw).items, [], raw);
  const s = M.parse(JSON.stringify({ off: 'yes', items: [{ q: 'qwertyzz', n: '3', hits: -2, first: 5 }, { q: 'QWERTYZZ', n: 9 }, { q: 'Jensen', n: 1, hits: 90, last: 9 }] }));
  assert.equal(s.off, false, '只有 true 才算关掉');
  assert.equal(s.share, true, '只有 false 才算不报');
  assert.deepEqual(s.items, [{ q: 'qwertyzz', n: 3, hits: 0, first: 5, last: 5 }, { q: 'Jensen', n: 1, hits: 90, first: 0, last: 9 }], '重复的词只留第一个');
  assert.equal(M.toText(s), 'qwertyzz\t3 次\t0 条全文命中\nJensen\t1 次\t90 条全文命中');
  const { url, included, total } = M.issueUrl(s);
  assert.equal(included, 2); assert.equal(total, 2);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://github.com/FelixJiashengFu/chem-research-molastria/issues/new');
  assert.match(u.searchParams.get('title'), /术语表/);
  assert.match(u.searchParams.get('body'), /- qwertyzz（3 次，全文命中 0 条）\n- Jensen（1 次，全文命中 90 条）/);
  let many = M.parse(null);
  for (let i = 0; i < 100; i++) many = M.record(many, `长长的没有命中的查询词第${i}个`, net.query('qwertyzz'), i);
  const cut = M.issueUrl(many, { limit: 2000 });
  assert.ok(cut.url.length <= 2000 && cut.included < cut.total && cut.included > 0, '地址太长时只放一部分');
});

test('没找到的词：每个浏览器每个词只匿名报一次，只发这个词；关掉上报或记录就不报', () => {
  const miss = net.query('Jensen');
  let s = M.parse(null);
  assert.deepEqual(M.reportOf(s, '  Jensen ', miss), { q: 'Jensen', hits: miss.primary.length }, '只有词和全文命中数');
  s = M.record(s, 'Jensen', miss);
  assert.equal(M.reportOf(s, 'JENSEN', miss), null, '列表里已经有了，不再报');
  assert.equal(M.reportOf(M.parse(null), 'Multiwfn', net.query('Multiwfn')), null, '术语表认得的不报');
  for (const q of ['x', 'someone@example.org', '13912345678', 'https://example.org']) assert.equal(M.reportOf(M.parse(null), q, net.query('qwertyzz')), null, q);
  const quiet = M.setShare(M.parse(null), false);
  assert.deepEqual(quiet, { v: 1, off: false, share: false, items: [] });
  assert.equal(M.reportOf(quiet, 'qwertyzz', net.query('qwertyzz')), null, '取消了“匿名报给站长”');
  assert.equal(M.record(quiet, 'qwertyzz', net.query('qwertyzz')).items.length, 1, '本机照样记');
  assert.equal(M.setOff(quiet, true).share, false, '关掉记录时保留上报的选择');
  assert.equal(M.reportOf(M.setOff(M.parse(null), true), 'qwertyzz', net.query('qwertyzz')), null, '记录关着时也不报');
  assert.equal(M.parse(JSON.stringify({ v: 1, share: false, items: [] })).share, false);
  assert.equal(M.parse(JSON.stringify({ v: 1, off: false, items: [] })).share, true, '旧存档默认上报');
});

test('没找到的词：浏览器和账号服务用同一套规则判断哪些词不记', () => {
  const src = readFileSync(new URL('../deploy/account-worker.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function missWorth('), src.indexOf('async function missList('));
  const worth = new Function(`const MISS_LEN = 60; const missText = (q) => String(q ?? '').replace(/\\s+/g, ' ').trim(); ${body}; return missWorth;`)();
  for (const q of ['x', 'ab', 'qwertyzz', 'ωB97X-D3', 'https://example.org/a', 'www.example.org', 'someone@example.org', '10.1021/acs', 'a\\b', '7732-18-5', '13912345678', '1391 2345 678', 'a'.repeat(60), 'a'.repeat(61), '平面', '平']) {
    assert.equal(worth(q), M.worthKeeping(q), q);
  }
});
