/* 热化学校正（纯逻辑，没有 DOM，tools/thermo-test.mjs 对照真的 GoodVibes 4.4.0 测）：
   从一份频率计算的输出（电子能、振动频率、结构、自旋多重度）算零点能 ZPE、焓 H、熵项 T·S 和吉布斯自由能 G。
   模型是刚性转子–谐振子（RRHO），另有 Grimme 的准 RRHO 熵、Head-Gordon 的准谐焓、Truhlar 的低频抬高（只用于熵，和 GoodVibes 一样）、
   标准态换算（1 atm 理想气体或 1 mol/L）、温度、频率校正因子、转动对称数、直线形分子、单原子和虚频的处理。

   这是 GoodVibes（github.com/patonlab/GoodVibes，thermo.py 和 io.py 里的热化学部分）的 JavaScript 移植，常数、公式和取舍都照它写，
   GoodVibes 的许可证如下（另见 public/code/THIRD-PARTY-goodvibes.md）：

   Copyright 2017 Robert Paton, University of Oxford

   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
   (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge,
   publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
   subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
   FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
   WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

   浏览器里是 window.MolAstriaThermo，node 里是 module.exports。 */
(function (root) {
  'use strict';

  // ── 常数：和 GoodVibes 一字不差（它用的是 CODATA 2010 一带的值），这样结果能逐位对上 ──
  const R = 8.3144621; // J / K / mol
  const H_PLANCK = 6.62606957e-34; // J s
  const KB = 1.3806488e-23; // J / K
  const C_CM = 2.99792458e10; // cm / s
  const NA = 6.0221415e23; // 1 / mol
  const AMU_KG = 1.66053886e-27;
  const J_TO_AU = 4.184 * 627.509541 * 1000.0; // 1 Eh 等于多少 J/mol
  const KCAL = 627.509541; // 1 Eh 等于多少 kcal/mol（GoodVibes 的值）
  const GRIMME_BAV = 1.0e-44; // Grimme 的平均转动惯量（kg m²）
  const HC_OVER_KB = 1.4387768775; // K / cm⁻¹
  const INERTIA_TO_CM = 16.857629; // B（cm⁻¹）= 16.857629 / I（amu Å²）
  const ATM_KPA = 101.325;

  // 每种元素丰度最高的同位素的质量（GoodVibes io.py 的 ATOMIC_MASSES，没列的元素用 MASS_AVG 补）
  const MASS = {
    H: 1.00782503207, He: 4.002602, Li: 7.0160034366, Be: 9.012183065, B: 11.00930536, C: 12.0, N: 14.0030740048, O: 15.99491461957,
    F: 18.998403163, Ne: 19.9924401762, Na: 22.989769282, Mg: 23.985041697, Al: 26.98153853, Si: 27.97692653465, P: 30.97376199842,
    S: 31.9720711744, Cl: 34.968852682, Ar: 39.9623831237, K: 38.96370648, Ca: 39.96259098, Sc: 44.95590828, Ti: 47.94794198,
    V: 50.94395704, Cr: 51.94050623, Mn: 54.93804451, Fe: 55.93493633, Co: 58.93319429, Ni: 57.93534241, Cu: 62.92959772, Zn: 63.92914201,
    Ga: 68.9255735, Ge: 73.921177761, As: 74.92159457, Se: 79.9165218, Br: 78.9183376, Kr: 83.9114977282, Rb: 84.91178974, Sr: 87.9056125,
    Y: 88.9058403, Zr: 89.9046977, Nb: 92.906373, Mo: 97.90540482, Tc: 98.9062508, Ru: 101.9043441, Rh: 102.905498, Pd: 105.9034804,
    Ag: 106.9050916, Cd: 113.90336509, In: 114.903878776, Sn: 119.90220163, Sb: 120.903812, Te: 129.906222748, I: 126.9044719, Xe: 131.9041550856,
  };
  // 第六周期：最常见同位素（AME2020）
  const MASS_AVG = { Cs: 132.905451961, Ba: 137.905247, La: 138.9063563, Hf: 179.946557, Ta: 180.9479958, W: 183.95093092, Re: 186.9557501,
    Os: 191.961477, Ir: 192.9629216, Pt: 194.9647917, Au: 196.96656879, Hg: 201.9706434, Tl: 204.9744278, Pb: 207.9766525, Bi: 208.9803991 };
  const massOf = (el) => MASS[el] ?? MASS_AVG[el] ?? 0;

  /** 点群 → 转动对称数 σ（纯转动子群的阶）。认 C2v、D3h、D∞h、Dinfh、D*H 这些写法；认不出返回 null。
      注意：GoodVibes 的表里 S4、S6、S8、T、O、I 六个是错的（写成 4、6、8、6、12、30），这里用正确的 2、3、4、12、24、60。 */
  function symmetryNumber(pg) {
    const s = String(pg || '').trim().replace(/[∞*]|inf/gi, '∞').replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d))).replace(/ᵥ/g, 'v').replace(/ₕ/g, 'h').replace(/ₛ/g, 's').replace(/ᵢ/g, 'i');
    const u = s.toUpperCase();
    if (u === 'D∞H') return 2;
    if (u === 'C∞V' || u === 'KH') return 1;
    if (['C1', 'CS', 'CI'].includes(u)) return 1;
    if (u === 'T' || u === 'TD' || u === 'TH') return 12;
    if (u === 'O' || u === 'OH') return 24;
    if (u === 'I' || u === 'IH') return 60;
    const m = /^([CDS])(\d+)([HVD]?)$/.exec(u);
    if (!m) return null;
    const n = Number(m[2]);
    if (m[1] === 'S') return n % 2 === 0 ? n / 2 : null;
    if (m[1] === 'C') return m[3] === 'D' ? null : n;
    return 2 * n;
  }

  // ── 转动惯量 ──────────────────────────────────────────────────────────
  /** 3×3 对称矩阵的本征值（Jacobi 旋转），从小到大。 */
  function eig3(A) {
    const a = A.map((r) => r.slice());
    for (let sweep = 0; sweep < 60; sweep++) {
      const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
      if (off < 1e-30) break;
      for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      }
    }
    return [a[0][0], a[1][1], a[2][2]].sort((x, y) => x - y);
  }

  /** 结构（[{el,x,y,z}]，Å）和每个原子的质量（可省，默认最常见同位素）→ { mass（amu）, moments（amu Å²，从小到大）, rotTemps（K）, linear, monatomic }。 */
  function rotor(atoms, masses) {
    const ms = atoms.map((a, i) => (masses && Number.isFinite(masses[i]) ? masses[i] : massOf(a.el)));
    const M = ms.reduce((s, m) => s + m, 0);
    if (!atoms.length || M <= 0) return { mass: M, moments: [0, 0, 0], rotTemps: [], linear: false, monatomic: atoms.length === 1 };
    const com = [0, 0, 0];
    atoms.forEach((a, i) => { com[0] += ms[i] * a.x; com[1] += ms[i] * a.y; com[2] += ms[i] * a.z; });
    com.forEach((v, k) => { com[k] = v / M; });
    const I = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    atoms.forEach((a, i) => {
      const r = [a.x - com[0], a.y - com[1], a.z - com[2]], m = ms[i];
      I[0][0] += m * (r[1] ** 2 + r[2] ** 2); I[1][1] += m * (r[0] ** 2 + r[2] ** 2); I[2][2] += m * (r[0] ** 2 + r[1] ** 2);
      I[0][1] -= m * r[0] * r[1]; I[0][2] -= m * r[0] * r[2]; I[1][2] -= m * r[1] * r[2];
    });
    I[1][0] = I[0][1]; I[2][0] = I[0][2]; I[2][1] = I[1][2];
    const moments = eig3(I).map((v) => Math.max(v, 0));
    const monatomic = atoms.length === 1;
    const big = moments[2];
    const linear = !monatomic && big > 0 && moments[0] < 1e-3 * Math.max(1, big * 1e-3) && moments[0] / big < 1e-4;
    const rotTemps = monatomic ? [] : linear ? [HC_OVER_KB * INERTIA_TO_CM / big] : moments.map((v) => HC_OVER_KB * INERTIA_TO_CM / v);
    return { mass: M, moments, rotTemps, linear, monatomic };
  }

  // ── 各项贡献（全部是 GoodVibes thermo.py 里同名函数的移植，单位 J/mol 或 J/(mol K)） ──
  const factor = (nu, T, s) => (H_PLANCK * nu * C_CM * s) / (KB * T);
  const uTrans = (T) => 1.5 * R * T;
  const uRot = (T, monatomic, linear) => (monatomic ? 0 : linear ? R * T : 1.5 * R * T);
  const uVib = (T, f, s) => f.reduce((sum, nu) => { const x = factor(nu, T, s); return sum + x * R * T * (0.5 + 1 / Math.expm1(x)); }, 0);
  const zpe = (f, s) => f.reduce((sum, nu) => sum + 0.5 * ((H_PLANCK * nu * C_CM * s) / KB) * R, 0);
  /** 平动熵（Sackur–Tetrode）；conc 是 mol/L。 */
  function sTrans(mass, conc, T) {
    const lambda = Math.sqrt(2 * Math.PI * mass * AMU_KG * KB * T) / H_PLANCK;
    const ndens = conc * 1000 * NA;
    return R * (2.5 + Math.log(lambda ** 3 / ndens));
  }
  const sElec = (mult) => R * Math.log(mult);
  function sRot(T, rotTemps, sigma, monatomic, linear) {
    if (monatomic) return 0;
    if (linear) return R * (Math.log(T / rotTemps[0] / sigma) + 1);
    const q = Math.sqrt((Math.PI * T ** 3) / (rotTemps[0] * rotTemps[1] * rotTemps[2]));
    return R * (Math.log(q / sigma) + 1.5);
  }
  const sRRHO = (T, f, s) => f.map((nu) => { const x = factor(nu, T, s); return (x * R) / Math.expm1(x) - R * Math.log(1 - Math.exp(-x)); });
  function sFreeRot(T, f, bav, s) {
    return f.map((nu) => {
      const mu = H_PLANCK / (8 * Math.PI ** 2 * nu * C_CM * s);
      const mup = (mu * bav) / (mu + bav);
      const x = (8 * Math.PI ** 3 * mup * KB * T) / H_PLANCK ** 2;
      return (0.5 + Math.log(Math.sqrt(x))) * R;
    });
  }
  const damp = (f, cutoff, alpha = 4) => f.map((nu) => 1 / (1 + (cutoff / nu) ** alpha));
  const uQRRHO = (T, f, s) => f.map((nu) => {
    const e = H_PLANCK * nu * C_CM * s, x = e / (KB * T);
    return 0.5 * NA * e + (R * T * x * Math.exp(-x)) / (1 - Math.exp(-x));
  });
  /** Grimme 的 Bav 可以按分子自己的转动惯量取（GoodVibes 的 --bav conf）：三个主转动惯量的平均（kg m²）。 */
  const bavOf = (moments) => { const pos = moments.filter((v) => v > 1e-3); return pos.length ? (pos.reduce((s, v) => s + v, 0) / pos.length) * AMU_KG * 1e-20 : GRIMME_BAV; };

  /** 1 atm 理想气体在温度 T 下的浓度（mol/L）。 */
  const gasConc = (T) => ATM_KPA / (R * T);

  const DEFAULTS = { T: 298.15, conc: null, qs: 'grimme', qh: false, sCutoff: 100, hCutoff: 100, alpha: 4, scale: 1, zpeScale: null, invert: null, bav: 'global' };

  /**
   * 算热化学。mol：{ energy（Eh）, freqs（cm⁻¹，虚频为负）, atoms（[{el,x,y,z}]）或直接给 rotTemps / mass / linear / monatomic,
   *   masses（每个原子，可省）, mult（默认 1）, sigma（转动对称数，默认 1） }。
   * o：{ T（K）, conc（mol/L；null 是 1 atm 理想气体）, qs（'grimme' | 'truhlar' | 'rrho'）, qh（Head-Gordon 准谐焓）, sCutoff、hCutoff（cm⁻¹）,
   *   alpha（阻尼指数，默认 4）, scale（频率校正因子）, zpeScale（ZPE 单独的校正因子，默认同 scale）, invert（null 不动虚频；数字：比它大的虚频翻成正的）,
   *   bav（'global' 用 1e-44 kg m²；'mol' 用分子自己的转动惯量） }。
   * 返回能量都以 Eh 计：zpe, H, qhH, TS, qhTS, G, qhG（qhG 用准谐的 S，开了 qh 时也用准谐的 H），S、qhS（Eh/K），以及每一项的分解和提醒。
   */
  function compute(mol, opts) {
    const o = { ...DEFAULTS, ...(opts || {}) };
    const T = Number(o.T);
    const warn = [];
    if (!(T > 0)) throw new Error('温度要大于 0 K');
    const scale = Number(o.scale) || 1;
    const zpeScale = o.zpeScale == null || o.zpeScale === '' ? scale : Number(o.zpeScale) || scale;
    const conc = o.conc == null || o.conc === '' ? gasConc(T) : Number(o.conc);
    if (!(conc > 0)) throw new Error('浓度要大于 0');
    const raw = (mol.freqs || []).filter((v) => Number.isFinite(v) && v !== 0);
    // 虚频：GoodVibes 默认把它们从热化学里拿掉；--invert 给一个阈值时，比阈值大（离 0 近）的虚频翻成正的
    const freqs = raw.filter((v) => v > 0);
    const imaginary = [], inverted = [];
    for (const v of raw.filter((x) => x < 0)) {
      if (o.invert != null && o.invert !== '' && v > Number(o.invert)) { freqs.push(-v); inverted.push(v); } else imaginary.push(v);
    }
    let rot = mol.rotTemps ? { mass: mol.mass, rotTemps: mol.rotTemps, linear: !!mol.linear, monatomic: !!mol.monatomic, moments: mol.moments || [] } : rotor(mol.atoms || [], mol.masses);
    if (mol.mass > 0) rot = { ...rot, mass: mol.mass };
    if (mol.linear != null) rot = { ...rot, linear: !!mol.linear };
    if (mol.monatomic != null) rot = { ...rot, monatomic: !!mol.monatomic };
    if (!(rot.mass > 0)) throw new Error('没有结构，算不了平动和转动');
    const mult = Math.max(1, Math.round(Number(mol.mult) || 1));
    const sigma = Math.max(1, Math.round(Number(mol.sigma) || 1));
    const nAtoms = (mol.atoms || []).length;
    if (nAtoms > 1) {
      const want = 3 * nAtoms - (rot.linear ? 5 : 6);
      const got = freqs.length + imaginary.length;
      if (got !== want) warn.push({ id: 'count', zh: `振动模式应有 ${want} 个，读到 ${got} 个：可能有被程序丢掉或重复的模式，结果要核对。`, en: `Expected ${want} vibrational modes but found ${got}: some modes may be missing or duplicated, so check the result.` });
    }
    if (imaginary.length) warn.push({ id: 'imag', zh: `有 ${imaginary.length} 个虚频（${imaginary.map((v) => `${Math.abs(v).toFixed(1)}i`).join('、')}），没有计入热化学。过渡态的那一个本来就不算；极小点有虚频的话，结构还没优化到底，G 不可靠。`, en: `${imaginary.length} imaginary frequenc${imaginary.length > 1 ? 'ies' : 'y'} (${imaginary.map((v) => `${Math.abs(v).toFixed(1)}i`).join(', ')}) left out of the thermochemistry. For a transition state that mode is excluded anyway; for a minimum it means the geometry is not converged and G is unreliable.` });
    if (inverted.length) warn.push({ id: 'inverted', zh: `${inverted.length} 个小虚频按绝对值当成实频计入。`, en: `${inverted.length} small imaginary frequenc${inverted.length > 1 ? 'ies were' : 'y was'} treated as real (absolute value).` });

    const Ut = uTrans(T), St = sTrans(rot.mass, conc, T), Se = sElec(mult);
    let Z = 0, Ur = 0, Uv = 0, Sr = 0, SvH = 0, SvQ = 0, UvQ = 0;
    const modes = [];
    if (freqs.length) {
      Z = zpe(freqs, zpeScale);
      Ur = uRot(T, rot.monatomic, rot.linear);
      Uv = uVib(T, freqs, scale);
      Sr = sRot(T, rot.rotTemps, sigma, rot.monatomic, rot.linear);
      const sH = sRRHO(T, freqs, scale);
      const sCut = o.sCutoff > 0 ? sRRHO(T, freqs.map(() => Number(o.sCutoff)), scale) : sH;
      const bav = o.bav === 'mol' && rot.moments && rot.moments.length ? bavOf(rot.moments) : GRIMME_BAV;
      const sF = sFreeRot(T, freqs, bav, scale);
      const wS = damp(freqs, Number(o.sCutoff), Number(o.alpha) || 4);
      const uQ = o.qh ? uQRRHO(T, freqs, scale) : null;
      const wH = o.qh ? damp(freqs, Number(o.hCutoff), Number(o.alpha) || 4) : null;
      freqs.forEach((nu, j) => {
        let s;
        if (o.qs === 'truhlar') s = o.sCutoff > 0 && nu <= o.sCutoff ? sCut[j] : sH[j];
        else if (o.qs === 'rrho') s = sH[j];
        else s = sH[j] * wS[j] + (1 - wS[j]) * sF[j];
        const u = o.qh ? wH[j] * uQ[j] + (1 - wH[j]) * 0.5 * R * T : null;
        SvQ += s; if (o.qh) UvQ += u;
        modes.push({ freq: nu, sRRHO: sH[j], sFree: sF[j], weight: wS[j], s, u });
      });
      SvH = sH.reduce((a, b) => a + b, 0);
    }
    const E = mol.energy == null || mol.energy === '' ? NaN : Number(mol.energy); // Number(null) 是 0，不能当成读到了电子能
    const hasE = Number.isFinite(E);
    const corrH = (Ut + Ur + Uv + R * T) / J_TO_AU;
    const corrQH = o.qh ? (Ut + Ur + UvQ + R * T) / J_TO_AU : corrH;
    const S = (St + Sr + SvH + Se) / J_TO_AU, qhS = (St + Sr + SvQ + Se) / J_TO_AU;
    const base = hasE ? E : 0;
    const H = base + corrH, qhH = base + corrQH;
    const low = freqs.filter((v) => v < Math.max(Number(o.sCutoff) || 0, 100)).length;
    if (low && o.qs === 'rrho') warn.push({ id: 'low', zh: `有 ${low} 个低于 100 cm⁻¹ 的模式：纯谐振子会高估它们的熵，建议用准 RRHO。`, en: `${low} modes below 100 cm⁻¹: the pure harmonic model overestimates their entropy; a quasi-RRHO treatment is recommended.` });
    return {
      T, conc, standard: o.conc == null || o.conc === '' ? '1atm' : 'conc', mult, sigma, linear: rot.linear, monatomic: rot.monatomic, mass: rot.mass, rotTemps: rot.rotTemps,
      energy: hasE ? E : null, zpe: Z / J_TO_AU, H, qhH, TS: T * S, qhTS: T * qhS, S, qhS, G: H - T * S, qhG: (o.qh ? qhH : H) - T * qhS,
      corr: { zpe: Z / J_TO_AU, H: corrH, qhH: corrQH, G: corrH - T * S, qhG: corrQH - T * qhS },
      terms: { trans: { U: Ut, S: St }, rot: { U: Ur, S: Sr }, vib: { U: Uv, qhU: o.qh ? UvQ : Uv, S: SvH, qhS: SvQ }, elec: { U: 0, S: Se } }, // J/mol、J/(mol K)
      freqs, imaginary, inverted, low, modes, warnings: warn, opts: o,
    };
  }

  /** 1 atm 理想气体换到 1 mol/L（或别的浓度）对 G 的修正（Eh）：RT ln(c / c_gas)。 */
  const concCorrection = (T, conc = 1) => (R * T * Math.log(conc / gasConc(T))) / J_TO_AU;

  // ── 从输出里读热化学要用的东西 ──────────────────────────────────────────
  const lastMatch = (re, t) => { let m, out = null; re.lastIndex = 0; while ((m = re.exec(t))) out = m; return out; };
  /**
   * 读输出里程序自己印的热化学信息：自旋多重度、转动对称数、点群、每个原子的质量、总质量、转动常数。
   * 程序印了就用它的（Gaussian 的 iso= 同位素、ORCA 的平均原子量都照它），没印就按结构算。
   * parsed 是 MolAstriaCode.parseOutput 的结果（频率、结构、能量从它那里来）。
   */
  function fromOutput(text, parsed) {
    const t = String(text || '').replace(/\r/g, '');
    const p = (parsed && parsed.program) || '';
    const atoms = parsed && parsed.geoms && parsed.geoms.length ? parsed.geoms[parsed.geoms.length - 1] : [];
    const out = { program: p, energy: parsed ? parsed.energy : null, energyLabel: parsed ? parsed.energyLabel : '', freqs: parsed ? parsed.freqs.slice() : [], atoms, mult: null, sigma: null, pointGroup: '', masses: null, mass: null, rotTemps: null, linear: null, from: [] };
    let m;
    if (p === 'gaussian') {
      if ((m = lastMatch(/Multiplicity\s*=\s*(\d+)/g, t))) out.mult = Number(m[1]);
      if ((m = lastMatch(/Rotational symmetry number\s+(\d+)/g, t))) { out.sigma = Number(m[1]); out.from.push('sigma'); }
      if ((m = lastMatch(/Full point group\s+(\S+)/g, t))) out.pointGroup = m[1];
      const ms = [...t.matchAll(/Atom\s+\d+ has atomic number\s+\d+ and mass\s+(\d+\.\d+)/g)].map((x) => Number(x[1]));
      if (atoms.length && ms.length >= atoms.length) { out.masses = ms.slice(-atoms.length); out.from.push('masses'); }
      else if ((m = lastMatch(/Molecular mass:\s+(\d+\.\d+)/g, t))) { out.mass = Number(m[1]); out.from.push('mass'); }
    } else if (p === 'orca') {
      if ((m = lastMatch(/Multiplicity\s+Mult\s+\.+\s+(\d+)/g, t))) out.mult = Number(m[1]);
      if ((m = lastMatch(/Point Group:\s+(\S+?),\s+Symmetry Number:\s+(\d+)/g, t))) { out.pointGroup = m[1]; out.sigma = Number(m[2]); out.from.push('sigma'); }
      if ((m = lastMatch(/Total Mass\s+\.\.\.\s+(\d+\.\d+)\s+AMU/g, t))) { out.mass = Number(m[1]); out.from.push('mass'); }
      if ((m = lastMatch(/Rotational constants in cm-1:\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/g, t))) {
        const b = [1, 2, 3].map((k) => Number(m[k]));
        const pos = b.filter((x) => x > 1e-10);
        if (pos.length === 2 || (pos.length === 3 && atoms.length === 2)) { out.linear = true; out.rotTemps = [HC_OVER_KB * pos[pos.length - 1]]; }
        else if (pos.length === 3) out.rotTemps = b.map((x) => HC_OVER_KB * x);
        if (out.rotTemps) out.from.push('rot');
      }
    } else if (p === 'nwchem') {
      if ((m = lastMatch(/Spin multiplicity:\s+(\d+)/g, t))) out.mult = Number(m[1]);
      if ((m = lastMatch(/symmetry #\s*=\s*(\d+)/g, t))) { out.sigma = Number(m[1]); out.from.push('sigma'); }
      if ((m = lastMatch(/mol\. weight\s*=\s*(\d+\.\d+)/g, t))) { out.mass = Number(m[1]); out.from.push('mass'); }
      const at = t.lastIndexOf('Rotational Constants');
      if (at >= 0) {
        const blk = t.slice(at, at + 600);
        const th = ['A', 'B', 'C'].map((k) => { const r = new RegExp(`^\\s*${k}=\\s*\\S+\\s+cm-1\\s+\\(\\s*\\S+\\s+K\\)|^\\s*${k}=\\s*\\S+\\s+cm-1\\s+\\S+\\s+(\\S+)\\s+K`, 'm').exec(blk); return r && r[1] ? Number(r[1]) : null; });
        if (th.every((x) => x > 0)) { out.rotTemps = th; out.from.push('rot'); }
      }
    } else if (p === 'qchem') {
      if ((m = lastMatch(/\$molecule\s*\n\s*-?\d+\s+(\d+)/gi, t))) out.mult = Number(m[1]);
      if ((m = lastMatch(/Rotational Symmetry Number is\s+(\d+)/g, t))) { out.sigma = Number(m[1]); out.from.push('sigma'); }
    } else if (p === 'psi4') {
      if ((m = lastMatch(/Multiplicity\s*=\s*(\d+)/g, t))) out.mult = Number(m[1]);
      if ((m = lastMatch(/Rotational symmetry number\s*=\s*(\d+)/gi, t))) { out.sigma = Number(m[1]); out.from.push('sigma'); }
    } else if (p === 'xtb') {
      if ((m = lastMatch(/symmetry number\s*:?\s*(\d+)/gi, t)) || (m = lastMatch(/rotational number\s+(\d+)/gi, t))) { out.sigma = Number(m[1]); out.from.push('sigma'); }
      if ((m = lastMatch(/--uhf\s+(\d+)/g, t))) out.mult = Number(m[1]) + 1;
    } else if (p === 'cp2k') {
      if ((m = lastMatch(/MULTIPLICITY\s+(\d+)/gi, t)) || (m = lastMatch(/Multiplicity\s+(\d+)/g, t))) out.mult = Number(m[1]);
    } else if (p === 'pyscf') {
      if ((m = lastMatch(/spin\s*=\s*(\d+)/g, t))) out.mult = Number(m[1]) + 1;
    }
    return out;
  }

  /** fromOutput 的结果 + 用户在面板里改的（mult、sigma 覆盖）→ compute 要的 mol。 */
  function molOf(info, override) {
    const ov = override || {};
    const mol = { energy: ov.energy != null ? ov.energy : info.energy, freqs: info.freqs, atoms: info.atoms, masses: info.masses, mult: ov.mult || info.mult || 1, sigma: ov.sigma || info.sigma || 1 };
    const r = rotor(info.atoms || [], info.masses);
    if (info.rotTemps) Object.assign(mol, { rotTemps: info.rotTemps, linear: info.linear != null ? info.linear : r.linear, monatomic: r.monatomic, moments: r.moments, mass: info.mass || r.mass });
    else if (info.mass) mol.mass = info.mass;
    if (ov.linear != null) mol.linear = ov.linear;
    return mol;
  }

  /** 这份输出够不够算热化学：要有频率，还要有结构或程序印的总质量（只有频率的摘录算不了平动和转动）。 */
  // 要么有结构，要么程序印了质量和转动常数（只有质量没有转动常数时转动熵算不出来）
  const usable = (info) => !!(info && info.freqs && info.freqs.length && ((info.atoms || []).length || (info.mass > 0 && Array.isArray(info.rotTemps) && info.rotTemps.length > 0 && info.rotTemps.every((x) => x > 0))));

  const pure = { R, J_TO_AU, KCAL, GRIMME_BAV, HC_OVER_KB, MASS, massOf, symmetryNumber, eig3, rotor, gasConc, concCorrection, compute, fromOutput, molOf, usable, DEFAULTS,
    terms: { uTrans, uRot, uVib, zpe, sTrans, sElec, sRot, sRRHO, sFreeRot, damp, uQRRHO, bavOf } };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaThermo = pure;
})(typeof window !== 'undefined' ? window : globalThis);
