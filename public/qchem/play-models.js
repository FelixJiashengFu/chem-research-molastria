/* 游乐场 · 互动小游戏的物理模型（纯函数，不碰 DOM；tools/play-test.mjs 用已知结果检验）。
   粒子在盒子里、氢原子轨道、基态电子排布、方势垒隧穿、Hückel 环、氢原子谱线。 */
(() => {
  'use strict';
  const P = {};
  // CODATA 2018
  const h = 6.62607015e-34, c = 2.99792458e8, me = 9.1093837015e-31, eV = 1.602176634e-19, hbar = h / (2 * Math.PI), mp = 1.67262192369e-27;
  P.const = { h, c, me, eV, hbar, mp };

  // ── 粒子在盒子里（自由电子模型）──────────────────────────────────────────
  // E_n = n²h²/(8mL²)；N 个 π 电子填满 N/2 个能级，HOMO→LUMO：ΔE = (N+1)h²/(8mL²)，λ = 8mcL²/(h(N+1))
  P.boxLevel = (n, Lnm) => (n * n * h * h) / (8 * me * (Lnm * 1e-9) ** 2) / eV; // eV
  P.boxLambda = (Lnm, N) => ((8 * me * c * (Lnm * 1e-9) ** 2) / (h * (N + 1))) * 1e9; // nm
  P.boxLengthFor = (lambdaNm, N) => Math.sqrt((lambdaNm * 1e-9 * h * (N + 1)) / (8 * me * c)) * 1e9; // nm
  // 可见光波长 → 近似 RGB（Dan Bruton 的分段近似，只用来上色）
  P.wavelengthRGB = (nm) => {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else if (nm <= 780) { r = 1; }
    const f = nm < 380 || nm > 780 ? 0 : nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
    return [r, g, b].map((v) => Math.round(255 * (v * f) ** 0.8));
  };
  // 吸收某个波长时，人眼看到的大致是它的互补色（色轮上相对的颜色）
  P.seenColour = (nm) => { const [r, g, b] = P.wavelengthRGB(nm); return [255 - r, 255 - g, 255 - b].map((v) => Math.round(v * 0.85 + 20)); };

  // ── 氢原子轨道（实形式，原子单位 a0 = 1，未归一化：只用来画形状和节面）──────────
  const R = {
    '10': (r) => Math.exp(-r),
    '20': (r) => (2 - r) * Math.exp(-r / 2),
    '21': (r) => r * Math.exp(-r / 2),
    '30': (r) => (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3),
    '31': (r) => (6 - r) * r * Math.exp(-r / 3),
    '32': (r) => r * r * Math.exp(-r / 3),
  };
  // 实球谐函数的角向部分，用 x、z（y = 0 的截面）和 r 写出
  const A = { s: () => 1, pz: (x, z, r) => z / r, px: (x, z, r) => x / r, dz2: (x, z, r) => (3 * z * z - r * r) / (r * r), dxz: (x, z, r) => (x * z) / (r * r), dx2y2: (x, z, r) => (x * x) / (r * r) };
  P.orbitals = [
    { id: '1s', n: 1, l: 0, ang: 's', extent: 5 }, { id: '2s', n: 2, l: 0, ang: 's', extent: 13 },
    { id: '2pz', n: 2, l: 1, ang: 'pz', extent: 12 }, { id: '2px', n: 2, l: 1, ang: 'px', extent: 12 },
    { id: '3s', n: 3, l: 0, ang: 's', extent: 24 }, { id: '3pz', n: 3, l: 1, ang: 'pz', extent: 24 },
    { id: '3px', n: 3, l: 1, ang: 'px', extent: 24 }, { id: '3dz2', n: 3, l: 2, ang: 'dz2', extent: 22 },
    { id: '3dxz', n: 3, l: 2, ang: 'dxz', extent: 22 }, { id: '3dx2y2', n: 3, l: 2, ang: 'dx2y2', extent: 22 },
  ];
  P.orbitalLabel = { '1s': '1s', '2s': '2s', '2pz': '2pz', '2px': '2px', '3s': '3s', '3pz': '3pz', '3px': '3px', '3dz2': '3dz²', '3dxz': '3dxz', '3dx2y2': '3dx²−y²' };
  P.psi = (o, x, z) => { const r = Math.hypot(x, z) || 1e-9; return R[`${o.n}${o.l}`](r) * A[o.ang](x, z, r); };
  P.nodes = (o) => ({ radial: o.n - o.l - 1, angular: o.l });

  // ── 基态电子排布（Z ≤ 36）：Madelung 顺序，Cr、Cu 例外 ─────────────────────
  P.subshells = [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6]];
  P.config = (Z) => {
    const occ = {};
    let left = Z;
    for (const [s, cap] of P.subshells) { occ[s] = Math.min(cap, left); left -= occ[s]; }
    if (Z === 24) { occ['4s'] = 1; occ['3d'] = 5; }
    if (Z === 29) { occ['4s'] = 1; occ['3d'] = 10; }
    return occ;
  };
  P.elements = [null, ['H', '氢', 'Hydrogen'], ['He', '氦', 'Helium'], ['Li', '锂', 'Lithium'], ['Be', '铍', 'Beryllium'], ['B', '硼', 'Boron'], ['C', '碳', 'Carbon'], ['N', '氮', 'Nitrogen'], ['O', '氧', 'Oxygen'], ['F', '氟', 'Fluorine'], ['Ne', '氖', 'Neon'],
    ['Na', '钠', 'Sodium'], ['Mg', '镁', 'Magnesium'], ['Al', '铝', 'Aluminium'], ['Si', '硅', 'Silicon'], ['P', '磷', 'Phosphorus'], ['S', '硫', 'Sulfur'], ['Cl', '氯', 'Chlorine'], ['Ar', '氩', 'Argon'], ['K', '钾', 'Potassium'], ['Ca', '钙', 'Calcium'],
    ['Sc', '钪', 'Scandium'], ['Ti', '钛', 'Titanium'], ['V', '钒', 'Vanadium'], ['Cr', '铬', 'Chromium'], ['Mn', '锰', 'Manganese'], ['Fe', '铁', 'Iron'], ['Co', '钴', 'Cobalt'], ['Ni', '镍', 'Nickel'], ['Cu', '铜', 'Copper'], ['Zn', '锌', 'Zinc'],
    ['Ga', '镓', 'Gallium'], ['Ge', '锗', 'Germanium'], ['As', '砷', 'Arsenic'], ['Se', '硒', 'Selenium'], ['Br', '溴', 'Bromine'], ['Kr', '氪', 'Krypton']];
  // 玩家填的格子：{ '2p': [2,1,1], ... }（每格 0 / 1 / 2 个电子；1 表示单电子，自旋都朝上）→ 检查并给出原因
  P.checkConfig = (Z, boxes) => {
    const want = P.config(Z), problems = [];
    let total = 0;
    for (const [s] of P.subshells) total += (boxes[s] || []).reduce((t, v) => t + v, 0);
    if (total !== Z) return { ok: false, rule: 'count', total };
    for (const [s] of P.subshells) {
      const got = (boxes[s] || []).reduce((t, v) => t + v, 0);
      if (got !== want[s]) problems.push(['aufbau', s, got, want[s]]);
    }
    if (problems.length) return { ok: false, rule: 'aufbau', problems };
    for (const [s] of P.subshells) { // Hund：同一亚层先每格放一个，再成对
      const b = boxes[s] || [], n = b.reduce((t, v) => t + v, 0), cap = b.length;
      if (n > 0 && n < 2 * cap) { const singles = b.filter((v) => v === 1).length, need = n <= cap ? n : 2 * cap - n; if (singles !== need) return { ok: false, rule: 'hund', subshell: s }; }
    }
    return { ok: true };
  };
  P.configText = (Z) => { const o = P.config(Z); return P.subshells.filter(([s]) => o[s]).map(([s]) => `${s}${o[s]}`).join(' '); };

  // ── 方势垒隧穿：精确解（区域 I 入射 + 反射，II 势垒内，III 透射）──────────────────
  const C = (re, im = 0) => ({ re, im });
  const add = (a, b) => C(a.re + b.re, a.im + b.im), sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const cexp = (z) => { const m = Math.exp(z.re); return C(m * Math.cos(z.im), m * Math.sin(z.im)); };
  // E、V0 以 eV 计，宽度 a 以 nm 计，质量以 kg 计。返回 T、R 和 ψ(x)（x 以 nm 计，入射振幅为 1）
  P.barrier = (E, V0, aNm, m = me) => {
    const a = aNm * 1e-9, k = Math.sqrt(2 * m * E * eV) / hbar;
    const q = E < V0 ? C(Math.sqrt(2 * m * (V0 - E) * eV) / hbar, 0) : C(0, Math.sqrt(2 * m * (E - V0) * eV) / hbar); // 势垒内 e^{±qx}
    const ik = C(0, k);
    // 在 x = a 处由透射波 t e^{ika} 反推势垒内系数 A e^{qx} + B e^{-qx}（取 t = 1，最后统一归一）
    const ea = cexp(mul(ik, C(a))), eqa = cexp(mul(q, C(a))), emqa = cexp(mul(C(-q.re, -q.im), C(a)));
    const Acoef = div(mul(ea, add(q, ik)), mul(C(2), mul(q, eqa)));
    const Bcoef = div(mul(ea, sub(q, ik)), mul(C(2), mul(q, emqa)));
    // x = 0：1 + r = A + B，ik(1 − r) = q(A − B) → 入射振幅 inc = ((A + B) + q(A − B)/(ik))/2
    const AB = add(Acoef, Bcoef), qAB = div(mul(q, sub(Acoef, Bcoef)), ik);
    const inc = mul(C(0.5), add(AB, qAB)), ref = mul(C(0.5), sub(AB, qAB));
    const t = div(C(1), inc), r = div(ref, inc), A2 = div(Acoef, inc), B2 = div(Bcoef, inc);
    const T = t.re * t.re + t.im * t.im, Rr = r.re * r.re + r.im * r.im;
    const psi = (xNm) => {
      const x = xNm * 1e-9;
      if (x < 0) return add(cexp(mul(ik, C(x))), mul(r, cexp(mul(C(0, -k), C(x)))));
      if (x <= a) return add(mul(A2, cexp(mul(q, C(x)))), mul(B2, cexp(mul(C(-q.re, -q.im), C(x)))));
      return mul(t, cexp(mul(ik, C(x))));
    };
    return { T, R: Rr, psi, k };
  };
  // 解析式对照：E < V0 时 T = [1 + V0² sinh²(κa) / (4E(V0 − E))]⁻¹
  P.barrierT = (E, V0, aNm, m = me) => {
    const a = aNm * 1e-9;
    if (E < V0) { const kap = Math.sqrt(2 * m * (V0 - E) * eV) / hbar; return 1 / (1 + (V0 * V0 * Math.sinh(kap * a) ** 2) / (4 * E * (V0 - E))); }
    if (E === V0) return 1 / (1 + (m * a * a * V0 * eV) / (2 * hbar * hbar));
    const k2 = Math.sqrt(2 * m * (E - V0) * eV) / hbar;
    return 1 / (1 + (V0 * V0 * Math.sin(k2 * a) ** 2) / (4 * E * (E - V0)));
  };

  // ── Hückel 单环：E_k = α + 2β cos(2πk/N)；β < 0，所以系数越大越稳定 ──────────────
  P.huckelRing = (N) => Array.from({ length: N }, (_, k) => 2 * Math.cos((2 * Math.PI * k) / N)).sort((a, b) => b - a); // 以 β 为单位，从低到高能量
  // 按能量从低到高填电子；简并能级先各放一个（Hund）。返回每个能级的占据数、π 能量（β 的系数）和是否开壳层
  P.huckelFill = (N, Ne) => {
    const x = P.huckelRing(N), occ = x.map(() => 0);
    let left = Ne, i = 0;
    while (left > 0 && i < x.length) {
      let j = i;
      while (j + 1 < x.length && Math.abs(x[j + 1] - x[i]) < 1e-9) j++;
      const deg = j - i + 1, put = Math.min(left, 2 * deg);
      for (let s = 0; s < put; s++) occ[i + (s % deg)]++;
      left -= put; i = j + 1;
    }
    const energy = occ.reduce((t, o, k) => t + o * x[k], 0);
    const open = occ.some((o) => o === 1);
    // 定域参照：尽量多的孤立双键（每个 2α + 2β），其余电子留在非键 p 轨道（α）
    const dbl = Math.min(Math.floor(N / 2), Math.floor(Ne / 2));
    return { levels: x, occ, energy, open, delocalization: energy - 2 * dbl };
  };
  P.huckelRule = (Ne) => (Ne % 4 === 2 ? 'aromatic' : 'antiaromatic');
  P.rings = [
    { N: 3, charge: 1, zh: '环丙烯正离子', en: 'Cyclopropenyl cation' }, { N: 3, charge: -1, zh: '环丙烯负离子', en: 'Cyclopropenyl anion' },
    { N: 4, charge: 0, zh: '环丁二烯', en: 'Cyclobutadiene' }, { N: 4, charge: 2, zh: '环丁二烯双正离子', en: 'Cyclobutadiene dication' },
    { N: 5, charge: -1, zh: '环戊二烯负离子', en: 'Cyclopentadienyl anion' }, { N: 5, charge: 1, zh: '环戊二烯正离子', en: 'Cyclopentadienyl cation' },
    { N: 6, charge: 0, zh: '苯', en: 'Benzene' }, { N: 7, charge: 1, zh: '草鎓离子（环庚三烯正离子）', en: 'Tropylium cation' },
    { N: 7, charge: -1, zh: '环庚三烯负离子', en: 'Cycloheptatrienyl anion' }, { N: 8, charge: 0, zh: '平面的环辛四烯', en: 'Planar cyclooctatetraene' },
    { N: 8, charge: -2, zh: '环辛四烯双负离子', en: 'Cyclooctatetraene dianion' },
  ];
  P.ringElectrons = (ring) => ring.N - ring.charge; // 每个碳一个 p 电子，正电荷少一个，负电荷多一个

  // ── 氢原子谱线：1/λ = R_H (1/n_l² − 1/n_u²)，R_H 含约化质量修正；给出真空波长 ──────
  P.RH = 10967758.34; // m⁻¹
  P.lineNm = (nu, nl) => 1e9 / (P.RH * (1 / (nl * nl) - 1 / (nu * nu)));
  P.levelEV = (n) => -13.598434 / (n * n); // 氢原子（约化质量）能级
  P.series = { 1: ['莱曼系', 'Lyman', 'UV'], 2: ['巴耳末系', 'Balmer', 'visible'], 3: ['帕邢系', 'Paschen', 'IR'] };

  if (typeof window !== 'undefined') window.MOLASTRIA_PLAY = P;
  if (typeof module !== 'undefined') module.exports = P;
})();
