// 书架（public/shelf/shelf-core.js）的纯逻辑，以及生成的站内书目 shelf-books.js 是不是最新的、内容齐不齐。
// node --test tools/shelf-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build, render } from './build-shelf.mjs';

const require = createRequire(import.meta.url);
const C = require('../public/shelf/shelf-core.js');
const T0 = Date.UTC(2026, 10, 12, 12);

const catText = readFileSync(new URL('../public/shelf/shelf-books.js', import.meta.url), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(catText, ctx);
const CAT = JSON.parse(JSON.stringify(ctx.window.MOLASTRIA_SHELF_BOOKS));

test('站内书目：生成的文件是最新的（改了各栏目书单后要跑 node tools/build-shelf.mjs）', () => {
  assert.equal(catText, render(build()));
});

test('站内书目：每层有书，每本书只在一层，字段齐全，链接指向站内', () => {
  const seen = new Set();
  assert.ok(CAT.shelves.length >= 6);
  for (const s of CAT.shelves) {
    assert.ok(s.zh && s.en && s.books.length, s.id);
    for (const id of s.books) {
      assert.ok(!seen.has(id), `${id} 在两层`);
      seen.add(id);
      const b = CAT.books[id];
      assert.ok(b && b.t && b.a, id);
      assert.match(id, /^[a-z0-9][a-z0-9-]{0,63}$/);
      if (b.doi) assert.equal(C.normDoi(b.doi), b.doi, id);
      if (b.isbn) assert.ok(C.normIsbn(b.isbn), id);
      if (b.note) assert.ok(b.note.zh && b.note.en, id);
      for (const f of b.from) { assert.ok(f.zh && f.en, id); assert.match(f.href, /^[a-z-]+(\/[a-z-]+)*\/index\.html(#[\w-]+)?$/, id); }
    }
  }
  assert.equal(seen.size, Object.keys(CAT.books).length);
  // 同一本书（同一个 DOI）只出现一次
  const dois = Object.values(CAT.books).map((b) => b.doi?.toLowerCase()).filter(Boolean);
  assert.equal(new Set(dois).size, dois.length);
  // 讲解手册 25 册，中英标题都有，链接到对应的章
  const hb = CAT.shelves.find((s) => s.id === 'handbook');
  assert.equal(hb.books.length, 25);
  hb.books.forEach((id, i) => { const b = CAT.books[id]; assert.equal(b.vol, i + 1); assert.ok(b.tEn); assert.equal(b.url, 'manual/index.html#' + id.slice(3)); });
  // 计算化学经典在第一层；数学基础的论文（role paper、期刊卷页）不算书
  assert.equal(CAT.shelves[0].id, 'chem');
  assert.ok(CAT.books['szabo-ostlund'].from.length >= 2, 'Szabo 同时是数学基础的推荐');
  assert.ok(!Object.values(CAT.books).some((b) => /Annu\. Rev\.|J\. Chem\. Phys\. \d/.test(b.pub || '')));
  // 站内链接对应的文件都在
  for (const b of Object.values(CAT.books)) for (const f of [...b.from, ...(b.vol ? [{ href: b.url }] : [])]) readFileSync(new URL('../public/' + f.href.split('#')[0], import.meta.url));
});

test('存档：坏数据、未知状态、超长笔记、重复和非法 id 都整理掉', () => {
  assert.deepEqual(C.parse('not json'), C.empty());
  assert.deepEqual(C.parse('[1]'), C.empty());
  const s = C.parse(JSON.stringify({
    items: { helgaker: { s: 'reading', r: 9, n: 'x'.repeat(3000), at: T0 }, 'Bad Id': { s: 'done' }, empty: { s: 'nope' } },
    mine: [{ id: 'u-1', t: ' A\nbook ', y: '1999', doi: 'https://doi.org/10.1000/xyz.', isbn: '0-486-69186-1', url: 'javascript:alert(1)' }, { id: 'u-1', t: 'dup' }, { id: 'x-2', t: 'no u- prefix' }, { id: 'u-3' }],
    order: ['helgaker', 'helgaker', 'Bad Id', 7],
  }));
  assert.deepEqual(Object.keys(s.items), ['helgaker']);
  assert.equal(s.items.helgaker.r, undefined);
  assert.equal(s.items.helgaker.n.length, C.MAX_NOTE);
  assert.equal(s.mine.length, 1);
  assert.deepEqual(s.mine[0], { id: 'u-1', t: 'A book', y: 1999, doi: '10.1000/xyz', isbn: '9780486691862' });
  assert.deepEqual(s.order, ['helgaker', 'u-1'], '自己加的书一定在架上');
  assert.equal(C.serialize(C.empty()), null);
});

test('状态、评分、笔记：标了状态就放上我的书架，清空就删掉这一条', () => {
  let s = C.setStatus(C.empty(), 'helgaker', 'reading', T0);
  assert.deepEqual(s.items.helgaker, { s: 'reading', at: T0 });
  assert.deepEqual(s.order, ['helgaker']);
  s = C.setRating(s, 'helgaker', 4, T0); assert.equal(s.items.helgaker.r, 4);
  s = C.setNote(s, 'helgaker', '  第 9 章  ', T0); assert.equal(s.items.helgaker.n, '第 9 章');
  s = C.setStatus(s, 'helgaker', 'bogus', T0); assert.equal(s.items.helgaker.s, undefined);
  assert.ok(C.onMine(s, 'helgaker'), '取消状态不拿下来');
  s = C.setRating(C.setNote(s, 'helgaker', '', T0), 'helgaker', 0, T0);
  assert.equal(s.items.helgaker, undefined);
  assert.deepEqual(C.counts(C.setStatus(C.setStatus(C.empty(), 'a', 'done'), 'b', 'done')), { want: 0, reading: 0, done: 2, mine: 2 });
});

test('我的书架：加书去重、拿下、删掉自己的书、挪位置', () => {
  let s = C.addToMine(C.addToMine(C.addToMine(C.empty(), 'a'), 'b'), 'a');
  assert.deepEqual(s.order, ['a', 'b']);
  let r = C.addCustom(s, { t: 'Essentials of Computational Chemistry', a: 'C. J. Cramer', isbn: '978-0-470-09182-1' }, CAT, T0);
  assert.ok(r.id.startsWith('u-'));
  s = r.state;
  assert.deepEqual(s.order, ['a', 'b', r.id]);
  // 同一个 ISBN 不再加；和站内书目同一个 DOI 时直接把站内那本放上来
  assert.equal(C.addCustom(s, { t: 'again', isbn: '0470091827' }, CAT, T0).id, r.id);
  const dup = C.addCustom(s, { t: 'Helgaker', doi: '10.1002/9781119019572' }, CAT, T0);
  assert.ok(dup.existed); assert.equal(dup.id, 'helgaker'); assert.ok(dup.state.order.includes('helgaker'));
  assert.equal(C.addCustom(s, { t: '  ' }, CAT).error, 'title');
  s = C.moveTo(s, r.id, 0); assert.deepEqual(s.order, [r.id, 'a', 'b']);
  s = C.moveBy(s, r.id, -5); assert.equal(s.order[0], r.id);
  s = C.moveBy(s, 'a', 9); assert.deepEqual(s.order, [r.id, 'b', 'a']);
  s = C.setNote(s, r.id, 'note');
  s = C.removeFromMine(s, r.id);
  assert.deepEqual(s.order, ['b', 'a']); assert.equal(s.mine.length, 0); assert.equal(s.items[r.id], undefined);
  s = C.removeFromMine(s, 'b'); assert.deepEqual(s.order, ['a']);
});

test('DOI / ISBN：识别、校验位、10 位转 13 位', () => {
  assert.equal(C.normDoi('https://doi.org/10.1002/9781119019572'), '10.1002/9781119019572');
  assert.equal(C.normDoi('doi: 10.1017/CBO9780511596834.'), '10.1017/CBO9780511596834');
  assert.equal(C.normDoi('11.1/x'), '');
  assert.equal(C.normIsbn('0-486-69186-1'), '9780486691862');
  assert.equal(C.normIsbn('ISBN 978-0-486-69186-2'), '9780486691862');
  assert.equal(C.normIsbn('978-0-486-69186-3'), '', '校验位错');
  assert.equal(C.normIsbn('0-8044-2957-X'), '9780804429573');
  assert.equal(C.hyphenIsbn('9780486691862'), '978-0-48669-186-2');
  assert.deepEqual(C.detect('10.1002/3527600043'), { kind: 'doi', value: '10.1002/3527600043' });
  assert.deepEqual(C.detect('978-0-486-69186-2'), { kind: 'isbn', value: '9780486691862' });
  assert.deepEqual(C.detect('978-0-486-69186-9'), { kind: 'bad-isbn' });
  assert.deepEqual(C.detect('Szabo Ostlund'), { kind: 'title', value: 'Szabo Ostlund' });
  assert.deepEqual(C.detect(' '), { kind: 'empty' });
  assert.match(C.lookupUrls(C.detect('10.1002/3527600043'))[0][1], /^https:\/\/api\.openalex\.org\/works\/doi:10\.1002%2F3527600043$/);
  assert.deepEqual(C.lookupUrls(C.detect('9780486691862')).map((x) => x[0]), ['openlibrary', 'crossref']);
  assert.match(C.lookupUrls(C.detect('modern quantum'))[0][1], /filter=type:book/);
});

test('三家的返回值整理成书', () => {
  const oa = { display_name: 'A Chemist’s Guide to Density Functional Theory', publication_year: 2001, doi: 'https://doi.org/10.1002/3527600043',
    authorships: [{ author: { display_name: 'Wolfram Koch' } }, { author: { display_name: 'Max C. Holthausen' } }], primary_location: { source: { host_organization_name: 'Wiley' } } };
  assert.deepEqual(C.results('openalex', oa, C.detect('10.1002/3527600043')), [{ id: '', t: oa.display_name, a: 'Wolfram Koch, Max C. Holthausen', y: 2001, pub: 'Wiley', doi: '10.1002/3527600043' }]);
  assert.equal(C.results('openalex', { results: [oa, { nope: 1 }, oa] }).length, 2);
  const cr = { message: { items: [{ title: ['Modern Quantum Chemistry'], subtitle: ['Introduction to Advanced Electronic Structure Theory'], author: [{ given: 'Attila', family: 'Szabo' }], publisher: 'Dover', issued: { 'date-parts': [[1996]] }, ISBN: ['0486691861'] }] } };
  const b = C.results('crossref', cr, C.detect('9780486691862'))[0];
  assert.equal(b.t, 'Modern Quantum Chemistry: Introduction to Advanced Electronic Structure Theory');
  assert.equal(b.isbn, '9780486691862'); assert.equal(b.y, 1996); assert.equal(b.a, 'Attila Szabo');
  const ol = { 'ISBN:9780486691862': { title: 'Modern quantum chemistry', authors: [{ name: 'Attila Szabo' }, { name: 'Neil S. Ostlund' }], publishers: [{ name: 'Dover Publications' }], publish_date: 'July 1, 1996', url: 'https://openlibrary.org/books/OL1M' } };
  assert.deepEqual(C.results('openlibrary', ol, C.detect('9780486691862')), [{ id: '', t: 'Modern quantum chemistry', a: 'Attila Szabo, Neil S. Ostlund', y: 1996, pub: 'Dover Publications', isbn: '9780486691862', url: 'https://openlibrary.org/books/OL1M' }]);
  assert.deepEqual(C.results('openlibrary', {}, C.detect('9780486691862')), []);
  assert.deepEqual(C.results('crossref', null), []);
});

test('BibTeX：字段、转义、引用键不重复', () => {
  const out = C.bibtex([
    { t: 'Modern Quantum Chemistry', a: 'A. Szabo, N. S. Ostlund', pub: 'Dover', y: 1996, isbn: '9780486691862' },
    { t: 'Modern Quantum {Chemistry} & more_', a: 'A. Szabo', y: 1996, doi: '10.1/x', url: 'https://x' },
    { t: '量子力学', a: '曾谨言', pub: '科学出版社' },
  ]);
  assert.match(out, /@book\{szabo1996modern,\n  title +=  ?\{Modern Quantum Chemistry\},\n  author += \{A\. Szabo and N\. S\. Ostlund\}/);
  assert.match(out, /@book\{szabo1996modernb,/);
  assert.match(out, /title += \{Modern Quantum Chemistry \\& more\\_\}/);
  assert.match(out, /isbn += \{978-0-48669-186-2\}/);
  assert.ok(!/url/.test(out.split('@book').filter(Boolean)[1].split('\n').filter((l) => l.includes('doi')).join('')));
  assert.match(out, /@book\{book,\n  title += \{量子力学\}/);
  assert.equal(C.bibtex([]), '');
});

test('书脊：同一本书永远一样，尺寸在范围里，筛选按词和状态', () => {
  const a = C.spine('helgaker', CAT.books.helgaker), b = C.spine('helgaker', CAT.books.helgaker);
  assert.deepEqual(a, b);
  for (const [id, bk] of Object.entries(CAT.books)) { const s = C.spine(id, bk); assert.ok(s.w >= 30 && s.w <= 58 && s.h >= 170 && s.h < 200, id); }
  const colours = new Set(Object.keys(CAT.books).map((id) => C.spine(id, {}).bg));
  assert.ok(colours.size >= 8, '颜色要分得开');
  const hk = { ...CAT.books.helgaker };
  assert.ok(C.matches(hk, null, 'helgaker olsen', 'all'));
  assert.ok(C.matches(hk, null, 'jorgensen', 'all'), '去掉重音也能搜到');
  assert.ok(!C.matches(hk, null, 'helgaker nope', 'all'));
  assert.ok(C.matches(hk, { s: 'reading' }, '', 'reading'));
  assert.ok(!C.matches(hk, { s: 'want' }, '', 'reading'));
  assert.ok(C.matches(hk, { n: '第 9 章' }, '第 9', 'noted'));
  assert.ok(!C.matches(hk, null, '', 'free'));
  assert.ok(C.matches(CAT.books['fm-axler-ladr'], null, '', 'free'));
});

test('奇怪的 id（__proto__、constructor）写不进存档，也碰不到 Object.prototype', () => {
  const before = C.empty();
  for (const id of ['__proto__', 'constructor', 'toString', 'A', '']) {
    assert.equal(C.setStatus(before, id, 'done'), before, id);
    assert.equal(C.setNote(before, id, 'x'), before, id);
    assert.equal(C.setRating(before, id, 3), before, id);
    assert.equal(C.addToMine(before, id), before, id);
  }
  assert.equal(({}).s, undefined);
  const s = C.parse('{"items":{"__proto__":{"s":"done"}},"order":["__proto__"]}');
  assert.equal(Object.getPrototypeOf(s.items), Object.prototype);
  assert.deepEqual(s.order, []);
});
