// 导出引用（public/cite/cite-core.js）：作者拆分、首页目录和各栏目文献的整理、BibTeX / RIS / 文字三种写法；
// 站内全部文献（首页目录 2,600 多条、四个栏目的文献库）都过一遍，每条都要能写出括号成对的 BibTeX 和完整的 RIS。
//   node --test tools/cite-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const C = require('../public/cite/cite-core.js');
const load = (file, name) => { const ctx = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8'), ctx); return ctx.window[name]; };

test('splitAuthors handles the separators used across the site', () => {
  assert.deepEqual(C.splitAuthors('Hazel Vázquez-Hernández、Joel Ireta'), ['Hazel Vázquez-Hernández', 'Joel Ireta']);
  assert.deepEqual(C.splitAuthors('D. J. Griffiths, D. F. Schroeter'), ['D. J. Griffiths', 'D. F. Schroeter']);
  assert.deepEqual(C.splitAuthors('A. Einstein; B. Podolsky; N. Rosen'), ['A. Einstein', 'B. Podolsky', 'N. Rosen']);
  assert.deepEqual(C.splitAuthors('M. Born and R. Oppenheimer'), ['M. Born', 'R. Oppenheimer']);
  assert.deepEqual(C.splitAuthors('M. Planck'), ['M. Planck']);
  assert.deepEqual(C.splitAuthors('Planck, M.'), ['Planck, M.']);
  assert.deepEqual(C.splitAuthors('R. P. Feynman et al.'), ['R. P. Feynman']);
  assert.deepEqual(C.splitAuthors(''), []);
  assert.deepEqual(C.splitAuthors(['x', ' ', 'y']), ['x', 'y']);
});

test('nameParts: family name last, particles kept, Chinese names whole', () => {
  assert.deepEqual(C.nameParts('Johannes Diderik van der Waals'), { last: 'van der Waals', first: 'Johannes Diderik' });
  assert.deepEqual(C.nameParts('D. J. Griffiths'), { last: 'Griffiths', first: 'D. J.' });
  assert.deepEqual(C.nameParts('Planck, M.'), { last: 'Planck', first: 'M.' });
  assert.deepEqual(C.nameParts('卢天'), { last: '卢天', first: '' });
  assert.deepEqual(C.nameParts('Sobereva'), { last: 'Sobereva', first: '' });
});

test('a catalogue paper becomes a journal article with its DOI; a database becomes a dataset with an access date', () => {
  const paper = C.fromCatalogue({ type: 'paper', title: 'Rigid Molecule Packing Similarity Index Based on Dual Quaternions', url: 'https://doi.org/10.1021/acs.jctc.6c01293', date: '2026-11-06', category: 'Journal of Chemical Theory and Computation', authors: 'Hazel Vázquez-Hernández、Joel Ireta', metric: 'DOI:10.1021/acs.jctc.6c01293' }, '2026-11-12');
  assert.equal(paper.kind, 'article'); assert.equal(paper.doi, '10.1021/acs.jctc.6c01293'); assert.equal(paper.year, 2026); assert.equal(paper.month, 11);
  assert.equal(paper.journal, 'Journal of Chemical Theory and Computation'); assert.ok(!paper.accessed);
  const bib = C.toBibTeX([paper]);
  assert.match(bib, /^@article\{vazquezhernandez2026rigid,/);
  assert.match(bib, /author = \{Vázquez-Hernández, Hazel and Ireta, Joel\}/);
  assert.match(bib, /doi = \{10\.1021\/acs\.jctc\.6c01293\}/);
  const db = C.fromCatalogue({ type: 'database', title: 'Basis Set Exchange', url: 'https://www.basissetexchange.org/', date: '' }, '2026-11-12');
  assert.deepEqual(db, { kind: 'dataset', title: 'Basis Set Exchange', url: 'https://www.basissetexchange.org/', publisher: 'basissetexchange.org', accessed: '2026-11-12', authors: [] });
  assert.match(C.toBibTeX([db]), /^@dataset\{basis/);
  assert.match(C.toRIS([db]), /^TY {2}- DATA\r\nTI {2}- Basis Set Exchange\r\n/);
  assert.match(C.toRIS([db]), /Y2 {2}- 2026-11-12/);
});

test('refs from the section data files: papers, books, arXiv preprints', () => {
  const planck = C.fromRef({ id: 'planck1901', au: 'M. Planck', title: 'Ueber das Gesetz der Energieverteilung im Normalspectrum', j: 'Annalen der Physik', v: '309', p: '553', y: 1901, doi: '10.1002/andp.19013090310' });
  assert.equal(planck.kind, 'article');
  assert.equal(C.keyOf(planck), 'planck1901ueber');
  assert.equal(C.toText(planck), 'M. Planck (1901). Ueber das Gesetz der Energieverteilung im Normalspectrum. Annalen der Physik 309, 553. https://doi.org/10.1002/andp.19013090310');
  const book = C.fromRef({ title: 'Introduction to Quantum Mechanics', ed: { zh: '第 3 版', en: '3rd ed.' }, authors: 'D. J. Griffiths, D. F. Schroeter', pub: 'Cambridge University Press', year: 2018, doi: '10.1017/9781316995433' });
  assert.equal(book.kind, 'book'); assert.equal(book.edition, '3rd ed.');
  assert.match(C.toBibTeX([book]), /@book\{griffiths2018introduction,[\s\S]*edition = \{3rd ed\.\}[\s\S]*publisher = \{Cambridge University Press\}/);
  const ris = C.toRIS([book]);
  assert.match(ris, /TY {2}- BOOK/); assert.match(ris, /AU {2}- Griffiths, D\. J\.\r\nAU {2}- Schroeter, D\. F\./); assert.match(ris, /ER {2}- $/m);
  const arx = C.fromRef({ authors: 'A. Author', title: 'Quantum things', venue: 'arXiv', year: 2024, url: 'https://arxiv.org/abs/2401.00001' });
  assert.equal(arx.kind, 'preprint');
  assert.match(C.toBibTeX([arx]), /@misc\{author2024quantum,[\s\S]*howpublished = \{arXiv\}/);
  const pages = C.toRIS([C.fromRef({ title: 'X', j: 'J', pages: '100–120', y: 2000 })]);
  assert.match(pages, /SP {2}- 100\r\nEP {2}- 120/);
});

test('BibTeX escapes LaTeX specials, keeps keys unique and braces balanced', () => {
  const r = { kind: 'web', title: 'R&D: 50% of $costs_in #C {broken', authors: ['A B'], year: 2020 };
  const bib = C.toBibTeX([r, r, r]);
  assert.match(bib, /R\\&D: 50\\% of \\\$costs\\_in \\#C/);
  const keys = [...bib.matchAll(/^@\w+\{([^,]+),/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['b2020rd', 'b2020rdb', 'b2020rdc']);
  assert.ok(balanced(bib));
});

function balanced(s) { let d = 0; for (const ch of s.replace(/\\[{}]/g, '')) { if (ch === '{') d++; if (ch === '}') d--; if (d < 0) return false; } return d === 0; }

test('every reference on the site exports cleanly', () => {
  const sets = {
    catalogue: load('merged-data.js', 'CHEMRESEARCH_DATA').items.map((i) => C.fromCatalogue(i, '2026-11-12')),
    qpPapers: load('quantum/physics/qp-data.js', 'MOLASTRIA_QP').papers.map((r) => C.fromRef(r)),
    qpBooks: load('quantum/physics/qp-data.js', 'MOLASTRIA_QP').books.map((r) => C.fromRef(r)),
    qa: load('quantum/algorithms/qa-data.js', 'MOLASTRIA_QA').refs.map((r) => C.fromRef(r)),
    fs: load('fundamental-science/fs-data.js', 'MOLASTRIA_FS').refs.map((r) => C.fromRef(r)),
    qb: load('quantum/biology/qb-data.js', 'MOLASTRIA_QB').refs.map((r) => C.fromRef(r))
  };
  for (const [name, recs] of Object.entries(sets)) {
    assert.ok(recs.length > 10, name);
    for (const r of recs) assert.ok(r.title, `${name}: every record has a title`);
    const bib = C.toBibTeX(recs);
    assert.ok(balanced(bib), `${name}: balanced braces`);
    const keys = [...bib.matchAll(/^@\w+\{([^,]+),/gm)].map((m) => m[1]);
    assert.equal(keys.length, recs.length, `${name}: one entry per record`);
    assert.equal(new Set(keys).size, keys.length, `${name}: unique keys`);
    for (const k of keys) assert.match(k, /^[a-z0-9]+$/, `${name}: ascii key ${k}`);
    const ris = C.toRIS(recs);
    assert.equal((ris.match(/^TY {2}- /gm) || []).length, recs.length);
    assert.equal((ris.match(/^ER {2}- /gm) || []).length, recs.length);
  }
  // the section papers all carry DOIs, authors and years
  for (const name of ['qpPapers', 'fs', 'qb']) for (const r of sets[name]) { assert.ok(r.doi, `${name} ${r.title} has a DOI`); assert.ok(r.authors.length && r.year, `${name} ${r.title}`); }
});
