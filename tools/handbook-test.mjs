// 讲解手册 12–16 类五章（public/atlas/content.js 中文、guides-en.js 英文）的测试：node --test tools/handbook-test.mjs
// 一、结构：中英两版章节顺序一致，阅读器和 SEO 页的标签齐全，章内的相对链接都存在，中英文的文献链接一一对应。
// 二、目录对得上：每章说的“收录 N 个、编号 a–b”和表格里的编号，与 content.js 里该类的条目逐条一致。
//     以后给这几类加了条目，这里会失败，提醒同时改章节。
// 三、数字对得上：正文里的算例数字（REF）在中英两版里都出现；本机装了 PySCF 时，真的跑 tools/handbook-calcs.py，
//     对照 REF（约 4 分钟，HANDBOOK_SKIP_PYTHON=1 跳过）；HANDBOOK_SOLID=1 时再算第 13 章的硅能带（约 20 分钟）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../public/', import.meta.url);
const window = {};
for (const f of ['atlas/content.js', 'atlas/guides-en.js']) new Function('window', readFileSync(new URL(f, root), 'utf8'))(window);
const ZH = window.CHEMDB_CONTENT.guides;
const EN = window.CHEMDB_GUIDES_EN.guides;
const RES = window.CHEMDB_CONTENT.resources;

// id、类别代码、两种语言的标签
const CHAPTERS = [
  { id: 'p14b-cat12', cat: '12', zh: '12 · 量子化学程序与方法库', en: '12 · Quantum chemistry programs & method libraries' },
  { id: 'p14c-cat13', cat: '13', zh: '13 · 周期体系与凝聚态', en: '13 · Periodic systems & condensed matter' },
  { id: 'p14d-cat14', cat: '14', zh: '14 · 波函数分析与动力学', en: '14 · Wavefunction analysis & dynamics' },
  { id: 'p14e-cat15', cat: '15', zh: '15 · 量子力学与量子化学课程', en: '15 · Quantum courses & textbooks' },
  { id: 'p14f-cat16', cat: '16', zh: '16 · 量子计算与量子化学算法', en: '16 · Quantum computing & algorithms' },
];
const html = (list, id) => list.find((g) => g.id === id).html;
// 只用来比对文字，不当 HTML 显示。标签和实体在同一遍里处理：解出来的 < 不会再被当成标签，&amp;lt; 只解一层（得到 &lt;）；
// 没闭合的尖括号一直去到结尾
const ENTITY = { amp: '&', lt: '<', gt: '>' };
const plain = (s) => s.replace(/<[^>]*(?:>|$)|&(amp|lt|gt);/g, (m, e) => (e ? ENTITY[e] : ''));

test('中英两版：25 章、顺序一致，五章接在第 11 类之后，阅读器和 SEO 页的标签齐全', () => {
  assert.equal(ZH.length, EN.length);
  assert.deepEqual(EN.map((g) => g.id), ZH.map((g) => g.id));
  assert.equal(window.CHEMDB_GUIDES_EN.labels.length, EN.length);
  const at = ZH.findIndex((g) => g.id === 'p14-cat11');
  assert.deepEqual(ZH.slice(at + 1, at + 6).map((g) => g.id), CHAPTERS.map((c) => c.id));
  const labelsIn = (file, pattern) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8').match(pattern)[1].replace(/'/g, '"'));
  const reader = labelsIn('../public/manual/app.js', /const guideLabels = (\[[^\]]+\])/);
  const seo = labelsIn('./build-seo.ts', /const LABELS = (\[[^\]]+\])/);
  assert.equal(reader.length, ZH.length);
  assert.deepEqual(seo, reader);
  for (const c of CHAPTERS) {
    const i = ZH.findIndex((g) => g.id === c.id);
    assert.equal(reader[i], c.zh);
    assert.equal(window.CHEMDB_GUIDES_EN.labels[i], c.en);
    assert.ok(EN[i].title && ZH[i].title, c.id);
    assert.equal(plain(html(ZH, c.id).match(/<h1>([\s\S]*?)<\/h1>/)[1]), ZH[i].title);
    assert.equal(plain(html(EN, c.id).match(/<h1>([\s\S]*?)<\/h1>/)[1]), EN[i].title);
  }
});

test('五章的链接：相对链接指向存在的页面，中英两版引用同一组文献', () => {
  for (const c of CHAPTERS) {
    const links = (h) => [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const zh = links(html(ZH, c.id)), en = links(html(EN, c.id));
    for (const href of [...zh, ...en]) {
      if (/^https:\/\//.test(href)) continue;
      assert.ok(!/^(http:|javascript:|\/\/)/i.test(href), `${c.id}: ${href}`);
      assert.ok(existsSync(new URL(href.replace(/[#?].*$/, ''), new URL('manual/', root))), `${c.id}: ${href} 不存在`);
    }
    const doi = (list) => [...new Set(list.filter((h) => /doi\.org|arxiv\.org/.test(h)))].sort();
    assert.ok(doi(zh).length > 0, c.id);
    assert.deepEqual(doi(en), doi(zh), `${c.id}: 中英文引用的文献不同`);
  }
});

// 编号列表写成区间：[104..128, 229, 230, 231] → ['104–128', '229–231']；只差一的两个号分开写：[219, 220] → ['219', '220']
const ranges = (nums) => {
  const out = [];
  for (const n of nums) { const last = out.at(-1); if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]); }
  return out.flatMap(([a, b]) => (a === b ? [String(a)] : b === a + 1 ? [String(a), String(b)] : [`${a}–${b}`]));
};
const enList = (parts) => (parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);

test('五章和目录对得上：收录条数、编号区间、表格里的每一条', () => {
  for (const c of CHAPTERS) {
    const items = RES.filter((r) => r.category_code === c.cat).sort((a, b) => a.number - b.number);
    const nums = items.map((r) => r.number);
    const zh = html(ZH, c.id), en = html(EN, c.id);
    const zr = ranges(nums).join('、');
    const m = zh.match(/收录 (\d+) [^（]*（编号 ([^）]+)）/);
    assert.ok(m, `${c.id}: 找不到“收录 N …（编号 …）”`);
    assert.equal(Number(m[1]), items.length, `${c.id}: 正文说收录 ${m[1]} 条，目录第 ${c.cat} 类现在有 ${items.length} 条，请同时改章节`);
    assert.equal(m[2], zr, `${c.id}: 编号区间应为 ${zr}`);
    const er = enList(ranges(nums));
    const me = en.match(/(\d+) [a-z ]+\(Nos\. ([^)]+)\)/);
    assert.ok(me, `${c.id}: no "N entries (Nos. …)" in the English chapter`);
    assert.equal(Number(me[1]), items.length, `${c.id}: English count`);
    assert.equal(me[2], er, `${c.id}: English ranges should be ${er}`);
    // 条目表的每一行 <td class="n">编号</td><td><b>名字</b> 是这一类的条目，各出现一次；不在表里的条目要在正文里讲到（按名字的第一个词找）
    for (const [lang, h] of [['zh', zh], ['en', en]]) {
      const rows = [...h.matchAll(/<tr><td class="n">(\d+)<\/td><td><b>([^<]+)<\/b>/g)].map((x) => ({ n: Number(x[1]), name: plain(x[2]) }));
      const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const r of rows) {
        const item = items.find((x) => x.number === r.n);
        assert.ok(item, `${c.id} ${lang}: 表里的 #${r.n} 不在第 ${c.cat} 类`);
        assert.ok(key(item.name).includes(key(r.name).slice(0, 5)) || key(r.name).includes(key(item.name).slice(0, 5)), `${c.id} ${lang}: #${r.n} 表里是“${r.name}”，目录里是“${item.name}”`);
      }
      assert.equal(new Set(rows.map((r) => r.n)).size, rows.length, `${c.id} ${lang}: 表里有重复的编号`);
      const text = plain(h).toLowerCase();
      const missing = items.filter((x) => !rows.some((r) => r.n === x.number) && !text.includes(x.name.toLowerCase().split(/[\s(（:：,，/]+/)[0]));
      assert.deepEqual(missing.map((x) => `#${x.number} ${x.name}`), [], `${c.id} ${lang}: 这些条目在章里没有讲到`);
    }
  }
});

// 正文里引用的算例数字，来自 tools/handbook-calcs.py（PySCF 2.15.0）
const REF = {
  ladder: {
    eq: { hf: -75.98399748237867, mp2: -76.11279298442425, ccsd: -76.11931969551974, ccsdt: -76.12031366020028, fci: -76.12083744820617, t1: 0.008470927524467101 },
    stretched: { hf: -75.5887912750049, mp2: -75.83512951248163, ccsd: -75.87059338269593, ccsdt: -75.88536440165501, fci: -75.88053512446555, t1: 0.049214959393871695 },
  },
  charges: [
    { basis: 'sto-3g', nao: 7, mulliken_O: -0.368711274407568, lowdin_O: -0.2539683546031206, iao_O: -0.4731735445252401, dipole_D: 1.679203809045683 },
    { basis: 'def2-svp', nao: 24, mulliken_O: -0.2895774366537438, lowdin_O: -0.14068553801992323, iao_O: -0.6755811613118041, dipole_D: 1.981105048726823 },
    { basis: 'def2-tzvp', nao: 43, mulliken_O: -0.6274313827722455, lowdin_O: -0.3045602277034707, iao_O: -0.724501838297229, dipole_D: 2.0721089203342538 },
    { basis: 'aug-cc-pvtz', nao: 92, mulliken_O: -0.34566503194845843, lowdin_O: 1.042763322196838, iao_O: -0.7386026115502986, dipole_D: 1.8534503262932043 },
    { basis: 'aug-cc-pvqz', nao: 172, mulliken_O: -0.5841992906525348, lowdin_O: 1.5929502089833978, iao_O: -0.738480456333166, dipole_D: 1.8531368565874067 },
  ],
  crawford: { e_scf: -74.94207992819237, e_mp2_corr: -0.04914963604119186, b3lyp_diff_mEh: -36.96038556519454 },
  jw: {
    H2: { qubits: 4, pauli_terms: 15, lam: 1.8871072168964462, fci: -1.1372838344885023, lowest_eig: -1.1372838344885015 },
    LiH: { qubits: 12, pauli_terms: 631, lam: 12.34246545979275, fci: -7.882403410335502, lowest_eig: -7.882403410335558 },
    H2O: { qubits: 14, pauli_terms: 1086, lam: 71.99911518923119 },
  },
  // gth-dzvp 4×4×4、gth-dzvp 6×6×6、gth-tzv2p 4×4×4
  silicon: [
    { kmesh: 4, indirect_gap_eV: 0.6020742033407398, cbm_fraction_GX: 0.85 },
    { kmesh: 6, indirect_gap_eV: 0.6179506982742247, cbm_fraction_GX: 0.85 },
    { kmesh: 4, indirect_gap_eV: 0.5655191939579813, cbm_fraction_GX: 0.85 },
  ],
};

const KCAL = 627.5094740631; // kcal/mol per hartree
const num = (x, d, sign = false) => (x < 0 ? '−' : sign ? '+' : '') + Math.abs(x).toFixed(d);
const sci = (x) => { const e = Math.floor(Math.log10(x)); const m = x / 10 ** e; const sup = String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).replace('-', '⁻'); return { lead: m.toFixed(1), one: Math.round(m), sup }; };

// 每章应该出现的数字（中英两版都要有）
function expected(R) {
  const out = { 'p14b-cat12': [], 'p14c-cat13': [], 'p14d-cat14': [], 'p14e-cat15': [], 'p14f-cat16': [] };
  const L = out['p14b-cat12'];
  for (const g of ['eq', 'stretched']) {
    const r = R.ladder[g];
    L.push(`${num(r.hf, 5)} hartree`, `${num(r.fci, 5)} hartree`, num(r.t1, 3));
    for (const k of ['mp2', 'ccsd', 'ccsdt']) {
      const d = (r[k] - r.fci) * 1000;
      L.push(`${num(d, 2, true)} mEh`, `${num(d * KCAL / 1000, 2, true)} kcal/mol`);
    }
  }
  const C = out['p14d-cat14'];
  for (const r of R.charges) {
    const d = r.basis.startsWith('aug') ? 3 : 2; // 弥散基组的 IAO 和偶极矩多给一位，显出已经收敛
    C.push(`<td class="n">${r.nao}</td><td class="n">${num(r.mulliken_O, 2, true)}</td><td class="n">${num(r.lowdin_O, 2, true)}</td><td class="n">${num(r.iao_O, d, true)}</td><td class="n">${num(r.dipole_D, d)}</td>`);
  }
  const W = out['p14e-cat15'];
  W.push(num(R.crawford.e_scf, 13));
  const dm = Math.abs(R.crawford.e_mp2_corr - -0.049149636120); // Crawford 项目 4 的参考值
  W.push(`${sci(dm).one}×10${sci(dm).sup}`);
  W.push(`${Math.round(Math.abs(R.crawford.b3lyp_diff_mEh))} mEh`, `${Math.round(Math.abs(R.crawford.b3lyp_diff_mEh) * KCAL / 1000)} kcal/mol`);
  const Q = out['p14f-cat16'];
  const eps = 1.6e-3; // 目标精度 1.6 mEh
  for (const [name, r] of Object.entries(R.jw)) {
    const lam = r.lam.toFixed(r.lam < 10 ? 2 : 1);
    const n = sci((r.lam / eps) ** 2);
    const shots = name === 'H2' ? `${n.lead}×10${n.sup}` : `${n.one}×10${n.sup}`;
    Q.push(`<td class="n">${r.qubits}</td><td class="n">${r.pauli_terms}</td><td class="n">${lam}</td>`, shots);
    if (r.lowest_eig !== undefined) Q.push(`${num(r.lowest_eig, 6)} Eh`);
  }
  if (R.silicon) {
    const [d4, d6, t4] = R.silicon.map((s) => s.indirect_gap_eV);
    out['p14c-cat13'].push(`${t4.toFixed(2)}–${d6.toFixed(2)}`, `${Math.abs(d4 - t4).toFixed(2)} eV`, `${Math.abs(d6 - d4).toFixed(2)} eV`, `${Math.round(R.silicon[1].cbm_fraction_GX * 100)}%`);
  }
  return out;
}

test('正文里的算例数字：中英两版都写着 REF 算出来的值', () => {
  const E = expected(REF);
  // 英文用半角括号，表格单元格两版相同
  for (const [id, list] of Object.entries(E)) {
    for (const s of list) {
      assert.ok(html(ZH, id).includes(s), `${id} 中文缺少 “${s}”`);
      assert.ok(html(EN, id).includes(s), `${id} English is missing “${s}”`);
    }
  }
  // 几处由数字推出的说法
  const lam = REF.jw.LiH.lowest_eig - REF.jw.LiH.fci;
  assert.ok(Math.abs(lam) < 1e-12, 'LiH 的最低本征值和 FCI 应在 10⁻¹³ 量级一致');
  assert.ok(Math.abs(REF.jw.H2.lowest_eig - REF.jw.H2.fci) < 1e-14);
  assert.ok(REF.ladder.stretched.ccsdt < REF.ladder.stretched.fci, '拉长后 CCSD(T) 掉到精确值下面');
  assert.ok(REF.ladder.eq.t1 < 0.02 && REF.ladder.stretched.t1 > 0.02);
  const iao = REF.charges.slice(2).map((r) => r.iao_O);
  assert.ok(iao.every((q) => q <= -0.72 && q >= -0.74), '三重 ζ 起 IAO 在 −0.72 到 −0.74');
  assert.ok(REF.charges.slice(3).every((r) => r.lowdin_O > 1), '加弥散函数后 Löwdin 变成正一以上');
});

let hasPyscf = false;
if (!process.env.HANDBOOK_SKIP_PYTHON) {
  try { execFileSync('python3', ['-c', 'import pyscf'], { stdio: 'ignore' }); hasPyscf = true; } catch { /* 没装 */ }
}
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: 算出 ${a}，REF ${b}`);
const compare = (got, ref, path = '') => {
  if (typeof ref === 'number') {
    const tol = /nao|qubits|pauli_terms|kmesh/.test(path) ? 0 : /charges|dipole|gap|lam|t1|diff/.test(path) ? 2e-4 : /fraction/.test(path) ? 1e-9 : 2e-7;
    close(got, ref, tol, path);
  } else if (Array.isArray(ref)) ref.forEach((x, i) => compare(got[i], x, `${path}[${i}]`));
  else if (ref && typeof ref === 'object') for (const k of Object.keys(ref)) { if (k !== 'basis') compare(got[k], ref[k], `${path}.${k}`); }
};

test('复现：tools/handbook-calcs.py 用本机的 PySCF 算出同样的数字', { skip: !hasPyscf && (process.env.HANDBOOK_SKIP_PYTHON ? 'HANDBOOK_SKIP_PYTHON=1' : '本机没装 PySCF（pip install pyscf）'), timeout: 3600000 }, () => {
  const parts = ['ladder', 'charges', 'crawford', 'jw', ...(process.env.HANDBOOK_SOLID ? ['silicon'] : [])];
  const out = JSON.parse(execFileSync('python3', ['-I', new URL('handbook-calcs.py', import.meta.url).pathname, ...parts], { encoding: 'utf8', timeout: 3600000, maxBuffer: 1 << 24 }));
  for (const p of parts) compare(out[p], REF[p], p);
  // 用新算的数字再生成一遍正文应有的字符串，和 REF 生成的一样。
  // 第 15 类的 SCF 能量在正文里写到 13 位小数（对照 Crawford 的参考值），最后一位是 BLAS 多线程求和的舍入噪声
  // （CI 上同一份代码先后算出 …281924 和 …281923），这里只比到小数点后 10 位，数值本身上面已按 2e-7 核对过。
  const coarse = (o) => ({ ...o, 'p14e-cat15': o['p14e-cat15'].map((s, i) => (i === 0 ? s.slice(0, -3) : s)) });
  assert.deepEqual(coarse(expected({ ...REF, ...out })), coarse(expected(REF)));
});
