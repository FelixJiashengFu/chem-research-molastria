// 书架（/shelf/）的站内书目：从各栏目已经核对过的书单里取出书，去重、分到几层书架，写成 public/shelf/shelf-books.js。
//   node tools/build-shelf.mjs          重新生成
//   node tools/build-shelf.mjs --check  只检查生成的文件是不是最新的（tools/shelf-test.mjs 也查）
// 来源：数学基础 fm-data.js 的 books、量子物理 qp-data.js 的 books、量子算法 qa-data.js 里 kind 为 book 的条目、
// 讲解手册 25 章（标题在 manual/app.js 和 atlas/guides-en.js），外加下面 CLASSICS 这一排计算化学经典
// （DOI 在 OpenAlex 核对过，2026-11-12；Szabo–Ostlund 没有 DOI，ISBN 照讲解手册第 15 类那一章）。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/shelf/shelf-books.js');
const T = (zh, en) => ({ zh, en });

const CLASSICS = [
  { id: 'szabo-ostlund', authors: 'A. Szabo, N. S. Ostlund', title: 'Modern Quantum Chemistry: Introduction to Advanced Electronic Structure Theory', pub: 'Dover', year: 1996, isbn: '9780486691862', level: 'core',
    note: T('自己写 Hartree–Fock 程序最常用的参考书，记号被无数练习沿用。Dover 平装重印，价格很低。', 'The usual reference for writing your own Hartree–Fock code; countless exercises use its notation. An inexpensive Dover paperback reprint.') },
  { id: 'helgaker', authors: 'T. Helgaker, P. Jørgensen, J. Olsen', title: 'Molecular Electronic-Structure Theory', pub: 'Wiley', year: 2000, doi: '10.1002/9781119019572', level: 'adv',
    note: T('波函数方法的研究生参考书：二次量子化、积分、耦合簇、多组态，推导完整。', 'The graduate reference for wavefunction methods: second quantisation, integrals, coupled cluster and multiconfigurational theory, fully derived.') },
  { id: 'shavitt-bartlett', authors: 'I. Shavitt, R. J. Bartlett', title: 'Many-Body Methods in Chemistry and Physics: MBPT and Coupled-Cluster Theory', pub: 'Cambridge University Press', year: 2009, doi: '10.1017/CBO9780511596834', level: 'adv',
    note: T('微扰理论和耦合簇的图形技巧讲得最系统的一本，写 CC 程序时查。', 'The most systematic treatment of diagrammatic perturbation and coupled-cluster theory; look things up here when writing CC code.') },
  { id: 'parr-yang', authors: 'R. G. Parr, W. Yang', title: 'Density-Functional Theory of Atoms and Molecules', pub: 'Oxford University Press', year: 1989, doi: '10.1093/oso/9780195092769.001.0001', level: 'adv',
    note: T('密度泛函理论的经典专著，Hohenberg–Kohn 定理、Kohn–Sham 方法和化学概念（电负性、硬度）都从这里来。', 'The classic monograph on density-functional theory: the Hohenberg–Kohn theorems, the Kohn–Sham method and chemical concepts such as electronegativity and hardness.') },
  { id: 'koch-holthausen', authors: 'W. Koch, M. C. Holthausen', title: "A Chemist's Guide to Density Functional Theory", ed: T('第 2 版', '2nd ed.'), pub: 'Wiley-VCH', year: 2001, doi: '10.1002/3527600043', level: 'intro',
    note: T('写给化学家的 DFT 入门：少推导、多讲泛函在几何、能量、光谱上的实际表现。', 'DFT for chemists: little derivation, much on how functionals actually perform for geometries, energies and spectra.') },
  { id: 'sholl-steckel', authors: 'D. S. Sholl, J. A. Steckel', title: 'Density Functional Theory: A Practical Introduction', pub: 'Wiley', year: 2009, doi: '10.1002/9780470447710', level: 'intro',
    note: T('平面波 DFT 的上手书：k 点、截断能、表面和吸附怎么设，适合第一次算周期体系。', 'A hands-on start to plane-wave DFT: k-points, cut-offs, surfaces and adsorption; good for your first periodic calculation.') },
  { id: 'engel-dreizler', authors: 'E. Engel, R. M. Dreizler', title: 'Density Functional Theory: An Advanced Course', pub: 'Springer', year: 2011, doi: '10.1007/978-3-642-14090-7', level: 'adv',
    note: T('DFT 的严格一面：精确交换、轨道泛函、相对论 DFT，适合读完入门书之后。', 'The rigorous side of DFT: exact exchange, orbital functionals and relativistic DFT, for after the introductory books.') },
  { id: 'martin-es', authors: 'R. M. Martin', title: 'Electronic Structure: Basic Theory and Practical Methods', ed: T('第 2 版', '2nd ed.'), pub: 'Cambridge University Press', year: 2020, doi: '10.1017/9781108555586', level: 'core',
    note: T('固体电子结构的标准教材：能带、赝势、平面波和局域基组都讲到。', 'The standard text on electronic structure of solids: bands, pseudopotentials, plane waves and local basis sets.') },
  { id: 'kohanoff', authors: 'J. Kohanoff', title: 'Electronic Structure Calculations for Solids and Molecules: Theory and Computational Methods', pub: 'Cambridge University Press', year: 2006, doi: '10.1017/CBO9780511755613', level: 'core',
    note: T('把分子和固体放在一起讲的计算方法书，第一性原理分子动力学一章尤其好。', 'Computational methods for molecules and solids side by side; the chapter on first-principles molecular dynamics is especially good.') },
  { id: 'frenkel-smit', authors: 'D. Frenkel, B. Smit', title: 'Understanding Molecular Simulation: From Algorithms to Applications', ed: T('第 3 版', '3rd ed.'), pub: 'Academic Press', year: 2023, doi: '10.1016/C2009-0-63921-0', level: 'core',
    note: T('蒙特卡罗和分子动力学的算法书：系综、自由能、稀有事件，每个方法都讲为什么对。', 'The algorithms book for Monte Carlo and molecular dynamics: ensembles, free energies and rare events, with why each method is correct.') },
  { id: 'allen-tildesley', authors: 'M. P. Allen, D. J. Tildesley', title: 'Computer Simulation of Liquids', ed: T('第 2 版', '2nd ed.'), pub: 'Oxford University Press', year: 2017, doi: '10.1093/oso/9780198803195.001.0001', level: 'core',
    note: T('分子模拟的老牌教科书，第 2 版加了大量新方法；配套代码在 GitHub 上开源。', 'The long-standing textbook of molecular simulation; the 2nd edition adds many newer methods, and its example code is open on GitHub.') },
  { id: 'tuckerman', authors: 'M. E. Tuckerman', title: 'Statistical Mechanics: Theory and Molecular Simulation', ed: T('第 2 版', '2nd ed.'), pub: 'Oxford University Press', year: 2023, doi: '10.1093/oso/9780198825562.001.0001', level: 'adv',
    note: T('统计力学和模拟方法一起讲：积分器、恒温器、路径积分，推导严谨。', 'Statistical mechanics taught together with simulation: integrators, thermostats and path integrals, rigorously derived.') },
];

function load(file, name) {
  const ctx = { window: {} };
  ctx.self = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  return JSON.parse(JSON.stringify(ctx.window[name]));
}

const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
const isJournal = (pub) => /\d+\s*,\s*\d|\d+\s*[–-]\s*\d+$/.test(String(pub || ''));
const tidy = (b) => {
  const o = { t: b.title, a: b.authors || '' };
  if (b.ed) o.ed = b.ed;
  if (b.pub) o.pub = b.pub;
  if (b.year) o.y = b.year;
  if (b.doi) o.doi = b.doi;
  if (b.isbn) o.isbn = b.isbn;
  if (b.url) o.url = b.url;
  if (b.free) o.free = 1;
  if (b.level) o.lv = b.level;
  if (b.note) o.note = b.note;
  return o;
};

export function build() {
  const FM = load('public/fundamental-science/math/fm-data.js', 'MOLASTRIA_FM');
  const QP = load('public/quantum/physics/qp-data.js', 'MOLASTRIA_QP');
  const QA = load('public/quantum/algorithms/qa-data.js', 'MOLASTRIA_QA');
  const books = {};
  const byKey = new Map(); // doi 或书名 → id
  const shelves = [];
  // 加一本书；已经有了（同一个 DOI 或同一个书名）就只记下又一处推荐。返回它的 id，新书才进这一层。
  function add(shelf, raw, id, from) {
    const keys = [raw.doi && 'doi:' + raw.doi.toLowerCase(), 't:' + norm(raw.title)].filter(Boolean);
    const old = keys.map((k) => byKey.get(k)).find(Boolean);
    if (old) {
      const b = books[old];
      if (from && !b.from.some((f) => f.href === from.href)) b.from.push(from);
      return;
    }
    const o = tidy(raw);
    o.from = from ? [from] : [];
    books[id] = o;
    keys.forEach((k) => byKey.set(k, id));
    shelf.books.push(id);
  }

  const cc = { id: 'chem', zh: '计算化学经典', en: 'Computational chemistry classics', hint: T('写程序、选方法、做模拟时会反复翻的几本', 'The books you keep reopening when writing code, choosing methods and running simulations'), motif: 'hex', books: [] };
  shelves.push(cc);
  // 讲解手册第 15 类（课程教材）那一章写到了 Szabo–Ostlund 和 Helgaker
  const hb15 = { zh: '讲解手册 · 量子力学与量子化学课程', en: 'Handbook · Quantum courses & textbooks', href: 'manual/index.html#p14e-cat15' };
  CLASSICS.forEach((b) => add(cc, b, b.id, ['szabo-ostlund', 'helgaker'].includes(b.id) ? hb15 : null));

  const qp = { id: 'qp', zh: '量子物理', en: 'Quantum physics', hint: T('量子嘉年华 · 量子物理展馆十二章推荐的教材', 'Textbooks recommended across the twelve chapters of the Quantum Physics pavilion'), motif: 'orbit', books: [] };
  shelves.push(qp);
  const qpFrom = {};
  QP.chapters.forEach((c) => (c.books || []).forEach((bid) => { (qpFrom[bid] ||= []).push({ zh: '量子物理 · ' + c.name.zh, en: 'Quantum physics · ' + c.name.en, href: 'quantum/physics/index.html#c-' + c.id }); }));
  QP.books.filter((b) => b.role !== 'paper' && !isJournal(b.pub)).forEach((b) => {
    const fr = qpFrom[b.id] || [{ zh: '量子物理展馆', en: 'Quantum Physics pavilion', href: 'quantum/physics/index.html' }];
    add(qp, b, 'qp-' + b.id, fr[0]);
    fr.slice(1).forEach((f) => add(qp, b, 'qp-' + b.id, f));
  });

  const qa = { id: 'qa', zh: '量子计算与算法', en: 'Quantum computing & algorithms', hint: T('量子算法展馆引用的教材和讲义', 'Textbooks and lecture notes cited in the Quantum Algorithms pavilion'), motif: 'circuit', books: [] };
  shelves.push(qa);
  const algoName = Object.fromEntries(QA.algos.map((a) => [a.id, a.name]));
  QA.refs.filter((r) => r.kind === 'book' && !/^(Website|MIT OpenCourseWare)$/.test(r.venue)).forEach((r) => {
    const raw = { ...r, pub: r.venue };
    const algos = (r.algos || []).filter((a) => algoName[a]);
    const fr = algos.length ? algos.map((a) => ({ zh: '量子算法 · ' + algoName[a].zh, en: 'Quantum algorithms · ' + algoName[a].en, href: 'quantum/algorithms/index.html#a-' + a })) : [{ zh: '量子算法展馆', en: 'Quantum Algorithms pavilion', href: 'quantum/algorithms/index.html' }];
    fr.forEach((f) => add(qa, raw, 'qa-' + r.id, f));
  });

  // 数学基础按三档分三层（“离不开”“前沿要用”“看方向”）
  const subj = Object.fromEntries(FM.subjects.map((s) => [s.id, s]));
  const tierName = (t) => FM.tiers.find((x) => x.id === t);
  [1, 2, 3].forEach((t) => {
    const tn = tierName(t);
    const sh = { id: 'math' + t, zh: '数学基础 · ' + tn.tag.zh, en: 'Mathematics · ' + tn.tag.en, hint: T('数学基础与探索' + tn.name.zh + '：' + FM.subjects.filter((s) => s.tier === t).map((s) => s.name.zh).join('、'), 'Mathematical foundations, ' + tn.name.en + ': ' + FM.subjects.filter((s) => s.tier === t).map((s) => s.name.en).join(', ')), motif: 'grid', books: [] };
    FM.books.filter((b) => b.role !== 'paper' && !isJournal(b.pub) && subj[b.subj]?.tier === t).forEach((b) => {
      const s = subj[b.subj];
      add(sh, b, 'fm-' + b.id, { zh: '数学基础 · ' + s.name.zh, en: 'Mathematics · ' + s.name.en, href: 'fundamental-science/math/index.html#m-' + s.id });
    });
    if (sh.books.length) shelves.push(sh);
  });

  // 讲解手册：一套 25 册的“丛书”，书脊统一
  const appJs = fs.readFileSync(path.join(ROOT, 'public/manual/app.js'), 'utf8');
  const zhLabels = JSON.parse(appJs.match(/const guideLabels = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const content = load('public/atlas/content.js', 'CHEMDB_CONTENT');
  const enG = load('public/atlas/guides-en.js', 'CHEMDB_GUIDES_EN');
  if (zhLabels.length !== content.guides.length || enG.labels.length !== content.guides.length) throw new Error('讲解手册的章数对不上');
  const hb = { id: 'handbook', zh: 'MolAstria 讲解手册', en: 'The MolAstria Handbook', hint: T('本站自己写的 25 章，中英双语，点开就读', 'Our own 25 bilingual chapters; open one and start reading'), motif: 'star', series: 1, books: [] };
  shelves.push(hb);
  content.guides.forEach((g, i) => {
    const id = 'hb-' + g.id;
    books[id] = { t: zhLabels[i], tEn: enG.labels[i], sub: T(g.title, (enG.guides[i]?.title) || enG.labels[i]), a: 'MolAstria', pub: 'molastria.com', free: 1, vol: i + 1, url: 'manual/index.html#' + g.id, from: [] };
    hb.books.push(id);
  });

  return { checked: '2026-11-12', shelves, books };
}

export function render(data) {
  return '// 生成的文件，不要手改：node tools/build-shelf.mjs（数据来自各栏目的书单和讲解手册，见那个脚本开头）。\n'
    + 'window.MOLASTRIA_SHELF_BOOKS = ' + JSON.stringify(data) + ';\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = render(build());
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== out) { console.error('public/shelf/shelf-books.js 不是最新的：运行 node tools/build-shelf.mjs'); process.exit(1); }
    console.log('shelf-books.js 是最新的');
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, out);
    const d = build();
    console.log(d.shelves.map((s) => `${s.id} ${s.zh}: ${s.books.length}`).join('\n'), '\n合计', Object.keys(d.books).length, '本，', (out.length / 1024).toFixed(1), 'KB');
  }
}
