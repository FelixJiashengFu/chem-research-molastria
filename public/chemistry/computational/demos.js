'use strict';
// 化学学科馆 06 · 量子与计算化学的四个演示：势箱里的 π 电子、Morse 振子、Hückel 分子轨道、二维 Lennard-Jones 分子动力学。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, plot, levels, fit, font } = K;
  const eV = (J) => J / M.e, CM = 8065.544; // cm⁻¹ per eV

  // ── 势箱和共轭多烯 ──────────────────────────────────────────────────────
  D.box = {
    kind: 'model',
    title: ['势箱里的 π 电子：共轭链越长，颜色越红', 'π electrons in a box: longer conjugation, redder colour'],
    intro: ['把共轭多烯的 π 电子看成长 L 的一维势箱里的自由电子。调双键数，看能级、波函数和 HOMO → LUMO 的吸收波长。', 'Treat the π electrons of a conjugated polyene as free electrons in a one-dimensional box of length L. Change the number of double bonds to see the levels, wavefunctions and the HOMO → LUMO absorption wavelength.'],
    ctl: [['k', ['共轭双键数', 'Conjugated double bonds'], 1, 15, 1, 2, (v) => `${v}`], ['l', ['每个 C–C 键长（平均）', 'Average C–C bond length'], 120, 160, 1, 140, (v) => `${v} pm`]],
    btn: [[['乙烯', 'Ethylene'], { k: 1 }], [['丁二烯', 'Butadiene'], { k: 2 }], [['β-胡萝卜素（11 个）', 'β-Carotene (11)'], { k: 11 }]],
    figs: [[0.6, ['势箱的能级和波函数。实线是占据的轨道，虚线是空轨道；箭头是最低的吸收。', 'Levels and wavefunctions in the box. Solid: occupied orbitals; dashed: empty; the arrow is the lowest absorption.']], [0.55, ['吸收波长对双键数：曲线是势箱模型，点是两个实测值。', 'Absorption wavelength against number of double bonds: the curve is the box model, the dots two measured values.']]],
    note: ['2k 个碳的多烯取 L = 2k × 键长（两端各多算半个键）。势箱模型对丁二烯只差约 5 %，但链越长越离谱：真实多烯有单双键交替，能隙不会随链长趋于零，β-胡萝卜素实测吸收约 450 nm，而模型给出一千多纳米。Kuhn 当年指出，花菁染料没有键长交替，所以势箱模型对它们很准。实测值（丁二烯约 217 nm、β-胡萝卜素约 450 nm，溶液中）由编者录入，未逐条复核。', 'For a polyene of 2k carbons, L = 2k × bond length (half a bond added at each end). The box is only about 5 % off for butadiene but drifts badly as the chain grows: real polyenes alternate single and double bonds, so their gap does not close with length; β-carotene absorbs near 450 nm, while the model gives over a thousand. Kuhn pointed out that cyanine dyes have no bond alternation, which is why the box works well for them. The measured values (about 217 nm for butadiene and 450 nm for β-carotene, in solution) were typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const N = 2 * s.k, Lpm = N * s.l, homo = N / 2, top = homo + 2, xs = K.lin(0, Lpm, 160);
      const En = (n) => eV(M.boxE(n, Lpm)), gap = En(homo + 1) - En(homo), amp = 0.32 * Math.max(gap, En(2) - En(1));
      const series = [];
      for (let n = 1; n <= top; n++) {
        const occ = n <= homo;
        series.push({ xs: [0, Lpm], ys: [En(n), En(n)], color: c.line, width: 1 });
        series.push({ xs, ys: xs.map((x) => En(n) + amp * Math.sin((n * Math.PI * x) / Lpm)), color: occ ? c.accent : c.muted, width: 2, dash: occ ? [] : [5, 4] });
      }
      const emax = En(top) + amp * 1.3;
      plot(f[0], { x: [-Lpm * 0.05, Lpm * 1.05], y: [0, emax], xl: 'x / pm', yl: 'E / eV', series, bands: [{ x0: -Lpm * 0.05, x1: 0, color: c.ink2, alpha: 0.25 }, { x0: Lpm, x1: Lpm * 1.05, color: c.ink2, alpha: 0.25 }], arrows: [{ from: [Lpm * 0.5, En(homo)], to: [Lpm * 0.5, En(homo + 1)], color: c.gold }] });
      const ks = K.lin(1, 15, 15), lam = ks.map((k) => M.boxLambda(2 * k, 2 * k * s.l));
      plot(f[1], { x: [0.5, 15.5], y: [0, Math.max(...lam) * 1.1], xl: L('共轭双键数', 'Conjugated double bonds'), yl: 'λ / nm', series: [{ xs: ks, ys: lam, color: c.accent, width: 2, dots: 3, line: true, label: L('势箱模型', 'Box model') }, { xs: [2, 11], ys: [217, 450], color: c.danger, dots: 5, label: L('实测', 'Measured') }], marks: [{ x: s.k, y: M.boxLambda(N, Lpm), color: c.gold }], hbands: [{ y0: 380, y1: 750, color: c.gold, alpha: 0.1 }] });
      const l = M.boxLambda(N, Lpm);
      return [[['π 电子数 N', 'π electrons N'], String(N)], [['箱长 L', 'Box length L'], `${Lpm} pm`], [['HOMO → LUMO', 'HOMO → LUMO'], `n = ${homo} → ${homo + 1}`], [['能隙', 'Gap'], `${fix(gap, 2)} eV`], [['吸收波长', 'Absorption wavelength'], `${fix(l, 0)} nm${l >= 380 && l <= 750 ? L('（可见光）', ' (visible)') : l < 380 ? L('（紫外）', ' (UV)') : L('（红外）', ' (IR)')}`, 1]];
    },
  };

  // ── Morse 振子 ──────────────────────────────────────────────────────────
  // [显示名, ωe, ωexe（cm⁻¹）, re（pm）, 约化质量（amu）, D0（eV）]：Huber 和 Herzberg 的光谱常数，编者录入
  const DI = { H2: ['H₂', 4401.21, 121.34, 74.14, 0.50391, 4.478], HCl: ['H³⁵Cl', 2990.95, 52.82, 127.46, 0.97959, 4.434], CO: ['¹²C¹⁶O', 2169.81, 13.29, 112.83, 6.8562, 11.09], N2: ['N₂', 2358.57, 14.32, 109.77, 7.0034, 9.759], I2: ['I₂', 214.50, 0.614, 266.6, 63.452, 1.542] };
  D.morse = {
    kind: 'model',
    title: ['Morse 振子：会断的化学键', 'The Morse oscillator: a bond that can break'],
    intro: ['选一个双原子分子，比较 Morse 势和谐振子：振动能级越往上越密，最后在解离能处汇聚。', 'Choose a diatomic to compare the Morse potential with the harmonic oscillator: the vibrational levels crowd together going up and converge at the dissociation energy.'],
    sel: [['m', ['分子', 'Molecule'], Object.entries(DI).map(([k, v]) => [k, [v[0], v[0]]]), 'HCl']],
    chk: [['harm', ['叠上同频率的谐振子', 'Overlay the harmonic oscillator of the same frequency'], true]],
    btn: [[['H₂：轻、能级少', 'H₂: light, few levels'], { m: 'H2' }], [['CO：键最强', 'CO: the strongest bond'], { m: 'CO' }], [['I₂：重、能级密', 'I₂: heavy, dense levels'], { m: 'I2' }]],
    figs: [[0.62, ['势能曲线和振动能级（横线画在经典转折点之间）。虚线是谐振子。', 'The potential and vibrational levels (drawn between classical turning points). Dashed: the harmonic oscillator.']]],
    note: ['Morse 势的三个参数由光谱常数 ωe、ωexe 和约化质量定出：De = ωe²/(4ωexe)。它只是一个近似：从光谱常数推出的 Morse 解离能和真实解离能（D0 加上零点能）可以差 5–15 %，因为真实势能曲线的长程部分并不是指数形式。光谱常数是 Huber 和 Herzberg 汇编里的值，由编者录入，未逐条复核。', 'The Morse potential’s three parameters follow from the spectroscopic constants ωe and ωexe and the reduced mass: De = ωe²/(4ωexe). It is only an approximation: the Morse dissociation energy from spectroscopic constants can differ from the true one (D0 plus zero-point energy) by 5–15 %, because the long-range part of a real potential is not exponential. The constants are values from Huber and Herzberg’s compilation, typed in by the editor and not rechecked.'],
    draw(s, f, c) {
      const [nm, we, wexe, re, mu, D0] = DI[s.m], p = M.morseParams(we, wexe, mu), De = p.De / CM, a = p.a, k = (4 * Math.PI ** 2 * (M.c * 100 * we) ** 2 * mu * M.amu) / M.e * 1e-24;
      const r0 = re - Math.log(2.6) / a, r1 = re + 5.5 / a, rs = K.lin(r0, r1, 400);
      const series = [{ xs: rs, ys: rs.map((r) => M.morseV(r, re, De, a)), color: c.accent, width: 2.4 }];
      if (s.harm) series.push({ xs: rs, ys: rs.map((r) => 0.5 * k * (r - re) ** 2), color: c.muted, width: 1.4, dash: [5, 4] });
      const nshow = Math.min(p.vmax, 60);
      for (let v = 0; v <= nshow; v++) { const E = M.morseG(v, we, wexe) / CM, q = Math.sqrt(Math.min(1, E / De)); series.push({ xs: [re - Math.log(1 + q) / a, q < 1 ? re - Math.log(1 - q) / a : r1], ys: [E, E], color: v === 0 ? c.gold : c.ink2, width: v === 0 ? 2 : 1 }); }
      plot(f[0], { x: [r0, r1], y: [0, De * 1.25], xl: 'r / pm', yl: 'E / eV', series, hmarks: [{ y: De, color: c.danger }], texts: [{ x: r1, y: De, s: L('Morse 解离能', 'Morse De'), align: 'right', dy: -6, color: c.danger }] });
      const zpe = M.morseG(0, we, wexe), nu01 = M.morseG(1, we, wexe) - zpe, nu02 = M.morseG(2, we, wexe) - zpe;
      return [[['束缚的振动能级数', 'Bound vibrational levels'], String(p.vmax + 1)], [['零点能 G(0)', 'Zero-point energy G(0)'], `${fix(zpe, 0)} cm⁻¹`], [['基频 0 → 1', 'Fundamental 0 → 1'], `${fix(nu01, 1)} cm⁻¹`, 1], [['第一倍频 0 → 2（比 2 倍基频小）', 'First overtone 0 → 2 (below twice the fundamental)'], `${fix(nu02, 1)} cm⁻¹`], [['Morse 解离能', 'Morse dissociation energy'], `${fix(De, 2)} eV`, 1], [['实际 De = D0 + G(0)', 'Actual De = D0 + G(0)'], `${fix(D0 + zpe / CM, 2)} eV（${(100 * (De / (D0 + zpe / CM) - 1)).toFixed(0).replace('-', '−')} %）`]];
    },
  };

  // ── Hückel ──────────────────────────────────────────────────────────────
  const poly = (n, R, cx, cy, a0) => Array.from({ length: n }, (_, k) => [cx + R * Math.cos(a0 + (2 * Math.PI * k) / n), cy + R * Math.sin(a0 + (2 * Math.PI * k) / n)]);
  const ring = (n) => poly(n, 1 / (2 * Math.sin(Math.PI / n)), 0, 0, Math.PI / 2);
  const chain = (n) => Array.from({ length: n }, (_, i) => [i * 0.866, (i % 2) * 0.5]);
  const merge = (...sets) => { const out = []; for (const p of sets.flat()) if (!out.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05)) out.push(p); return out; };
  const R5 = 1 / (2 * Math.sin(Math.PI / 5)), R6 = 1, R7 = 1 / (2 * Math.sin(Math.PI / 7));
  const naph = merge(poly(6, R6, -0.866, 0, Math.PI / 6), poly(6, R6, 0.866, 0, Math.PI / 6));
  const azul = merge(poly(7, R7, -R7 * Math.cos(Math.PI / 7), 0, Math.PI / 7), poly(5, R5, R5 * Math.cos(Math.PI / 5), 0, Math.PI - Math.PI / 5));
  const fulv = (() => { const r = poly(5, R5, 0, 0, Math.PI); return [...r, [r[0][0] - 1, r[0][1]]]; })();
  // [名字, 坐标, π 电子数, Kekulé 结构里定域 π 键数, 杂原子 { 原子序号: { h } }]
  const HM = {
    ethylene: [['乙烯', 'Ethylene'], chain(2), 2, 1], allylp: [['烯丙基正离子', 'Allyl cation'], chain(3), 2, 1], allyl: [['烯丙基自由基', 'Allyl radical'], chain(3), 3, 1], allylm: [['烯丙基负离子', 'Allyl anion'], chain(3), 4, 1],
    butadiene: [['丁二烯', 'Butadiene'], chain(4), 4, 2], hexatriene: [['己三烯', 'Hexatriene'], chain(6), 6, 3], cbd: [['环丁二烯', 'Cyclobutadiene'], ring(4), 4, 2],
    cpm: [['环戊二烯负离子', 'Cyclopentadienyl anion'], ring(5), 6, 2], cpp: [['环戊二烯正离子', 'Cyclopentadienyl cation'], ring(5), 4, 2], benzene: [['苯', 'Benzene'], ring(6), 6, 3],
    pyridine: [['吡啶', 'Pyridine'], ring(6), 6, 3, { 0: { h: 0.5 } }], trop: [['草鎓离子', 'Tropylium'], ring(7), 6, 3], cot: [['环辛四烯（假设平面）', 'Cyclooctatetraene (if planar)'], ring(8), 8, 4],
    fulvene: [['富烯', 'Fulvene'], fulv, 6, 3], naph: [['萘', 'Naphthalene'], naph, 10, 5], azulene: [['薁', 'Azulene'], azul, 10, 5],
  };
  const hk = (key) => { const [, xy, nel, kek, het = {}] = HM[key], bonds = []; for (let i = 0; i < xy.length; i++) for (let j = i + 1; j < xy.length; j++) if (Math.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]) < 1.08) bonds.push([i, j]); return { xy, bonds, nel, kek, het, r: M.huckel(xy.length, bonds, nel, het) }; };
  const xb = (x) => `α ${x >= 0 ? '+' : '−'} ${fix(Math.abs(x), 3)}β`;
  D.huckel = {
    kind: 'exact',
    title: ['Hückel 分子轨道：芳香性和离域', 'Hückel MOs: aromaticity and delocalisation'],
    intro: ['选一个共轭分子，程序当场对角化 Hückel 矩阵，给出能级、电子填充和你选的那个轨道的系数。', 'Choose a conjugated molecule; the Hückel matrix is diagonalised on the spot, giving the levels, the electron filling and the coefficients of the orbital you pick.'],
    sel: [['m', ['分子', 'Molecule'], Object.entries(HM).map(([k, v]) => [k, v[0]]), 'benzene'], ['orb', ['画哪个轨道', 'Orbital to draw'], [['homo', ['HOMO', 'HOMO']], ['lumo', ['LUMO', 'LUMO']], ['low', ['最低的轨道', 'Lowest orbital']], ['dens', ['π 电荷（全部占据轨道）', 'π charges (all occupied)']]], 'homo']],
    btn: [[['苯：6 个 π 电子', 'Benzene: 6 π electrons'], { m: 'benzene', orb: 'homo' }], [['环丁二烯：反芳香', 'Cyclobutadiene: antiaromatic'], { m: 'cbd', orb: 'homo' }], [['薁为什么有偶极', 'Why azulene is polar'], { m: 'azulene', orb: 'dens' }], [['烯丙基的非键轨道', 'Allyl’s non-bonding orbital'], { m: 'allyl', orb: 'homo' }]],
    figs: [[0.9, ['能级（E = α + xβ，β < 0，越往下能量越低）和电子。', 'Levels (E = α + xβ, with β < 0, lower is more stable) and electrons.']], [0.9, ['所选轨道的系数：圆的大小正比于 |c|，颜色表示正负。选 π 电荷时，数字是每个原子上的 π 电子数。', 'Coefficients of the chosen orbital: circle size ∝ |c|, colour gives the sign. With π charges, numbers are π electrons per atom.']]],
    note: ['在 Hückel 近似之内是精确的数值对角化（Jacobi 方法）。近似本身很粗：只有 π 电子、忽略重叠、所有 C–C 的 β 相同。吡啶的氮用常见的经验参数 α_N = α + 0.5β。简并轨道按 Hund 规则单占；“HOMO”在简并时只画其中一个，简并轨道的任意线性组合同样正确。离域能 = π 能量 − 2β × Kekulé 结构里的定域 π 键数。', 'Exact numerical diagonalisation (the Jacobi method) within the Hückel approximation. The approximation itself is crude: π electrons only, overlap neglected, the same β for every C–C bond. Pyridine’s nitrogen uses the common empirical parameter α_N = α + 0.5β. Degenerate orbitals are singly occupied following Hund’s rule; when the HOMO is degenerate only one member is drawn, and any linear combination of degenerate orbitals is equally valid. Delocalisation energy = π energy − 2β × the number of localised π bonds in a Kekulé structure.'],
    draw(s, f, c) {
      const h = hk(s.m), { r } = h, n = h.xy.length;
      const groups = []; r.x.forEach((x, k) => { const g = groups.find((q) => Math.abs(q.x - x) < 1e-6); if (g) { g.ks.push(k); } else groups.push({ x, ks: [k] }); });
      const lv = groups.map((g) => ({ e: -g.x, n: g.ks.length, spins: g.ks.map((k) => r.occ[k]), label: xb(g.x), color: g.x > 1e-6 ? c.accent : g.x < -1e-6 ? c.danger : c.muted }));
      levels(f[0], { y: [-2.6, 2.6], yl: L('(E − α)/|β|', '(E − α)/|β|'), levels: lv });
      const lumo = r.homo + 1 < n ? r.homo + 1 : r.homo, kSel = { homo: r.homo, lumo, low: 0 }[s.orb];
      const charge = h.xy.map((_, i) => r.vectors.reduce((q, v, k) => q + r.occ[k] * v[i] ** 2, 0));
      const { ctx, w, h: H } = fit(f[1]), xs = h.xy.map((p) => p[0]), ys = h.xy.map((p) => p[1]), x0 = Math.min(...xs) - 0.8, x1 = Math.max(...xs) + 0.8, y0 = Math.min(...ys) - 0.8, y1 = Math.max(...ys) + 0.8, sc = Math.min(w / (x1 - x0), H / (y1 - y0)), ox = (w - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
      const P = (p) => [ox + (p[0] - x0) * sc, H - oy - (p[1] - y0) * sc];
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 2;
      for (const [i, j] of h.bonds) { const A = P(h.xy[i]), B = P(h.xy[j]); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
      h.xy.forEach((p, i) => {
        const [X, Y] = P(p);
        if (s.orb === 'dens') {
          const d = charge[i] - 1; ctx.fillStyle = d > 0.005 ? c.info : d < -0.005 ? c.danger : c.muted; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(X, Y, Math.max(5, sc * (0.12 + Math.min(0.4, Math.abs(d)))), 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = c.ink; ctx.font = font(12, 600); ctx.textAlign = 'center'; ctx.fillText(fix(charge[i], 2), X, Y + 4);
        } else {
          const v = r.vectors[kSel][i], rad = Math.abs(v) * sc * 0.75;
          if (rad > 0.5) { ctx.fillStyle = v > 0 ? c.accent : c.gold; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(X, Y, rad, 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1; }
          ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(X, Y, 3, 0, 2 * Math.PI); ctx.fill();
        }
        if (h.het[i]) { ctx.fillStyle = c.danger; ctx.font = font(13, 700); ctx.textAlign = 'center'; ctx.fillText('N', X, Y - 10); }
      });
      const deloc = r.Epi - 2 * h.kek, isRing = h.bonds.length === n && n > 2 && !['fulvene', 'naph', 'azulene'].includes(s.m), rule = isRing ? (h.nel % 4 === 2 ? L(`${h.nel} = 4n + 2：芳香`, `${h.nel} = 4n + 2: aromatic`) : L(`${h.nel} = 4n：反芳香`, `${h.nel} = 4n: antiaromatic`)) : L('不是单环', 'not a monocycle');
      const unp = r.occ.filter((o) => o === 1).length, dip = Math.max(...charge) - Math.min(...charge);
      return [[['π 电子数', 'π electrons'], String(h.nel)], [['π 能量', 'π energy'], `${h.nel}α + ${fix(r.Epi, 3)}β`, 1], [['离域能', 'Delocalisation energy'], `${fix(deloc, 3)}β`, 1], [['HOMO–LUMO 能隙', 'HOMO–LUMO gap'], Number.isFinite(r.gap) ? `${fix(r.gap, 3)}|β|` : '—'], [['未成对电子', 'Unpaired electrons'], String(unp)], [['Hückel 规则', 'Hückel’s rule'], rule], [['π 电荷的最大差', 'Largest π-charge difference'], fix(dip, 3)]];
    },
  };

  // ── 二维 Lennard-Jones 分子动力学 ───────────────────────────────────────
  D.md = {
    kind: 'model',
    title: ['分子动力学：二维 Lennard-Jones 流体', 'Molecular dynamics: a 2D Lennard-Jones fluid'],
    intro: ['在周期边界的盒子里放一些 Lennard-Jones 粒子，用速度 Verlet 积分 Newton 方程。调密度和温度看气、液、固，调时间步长看能量守不守恒。', 'Put Lennard-Jones particles in a periodic box and integrate Newton’s equations with velocity Verlet. Change density and temperature to see gas, liquid and solid; change the time step to see whether energy is conserved.'],
    sel: [['N', ['粒子数', 'Particles'], [['36', ['36', '36']], ['64', ['64', '64']], ['100', ['100', '100']]], '64']],
    ctl: [['rho', ['数密度 ρσ²', 'Number density ρσ²'], 0.05, 0.95, 0.01, 0.7, (v) => fix(v, 2)], ['T', ['初始温度 k_BT/ε', 'Initial temperature k_BT/ε'], 0.1, 2.5, 0.05, 1.0, (v) => fix(v, 2)], ['dt', ['时间步长 Δt/τ', 'Time step Δt/τ'], 0.001, 0.03, 0.001, 0.005, (v) => fix(v, 3)], ['steps', ['步数', 'Steps'], 200, 3000, 100, 1500, (v) => `${v}`]],
    btn: [[['液体', 'Liquid'], { rho: 0.7, T: 1.0, dt: 0.005 }], [['固体（六方排列）', 'Solid (hexagonal order)'], { rho: 0.9, T: 0.3, dt: 0.005 }], [['气体', 'Gas'], { rho: 0.1, T: 1.5, dt: 0.005 }], [['步长太大', 'Time step too large'], { rho: 0.7, T: 1.0, dt: 0.025 }]],
    figs: [[0.9, ['最后一刻的位置（周期盒子）。', 'Positions at the final step (periodic box).']], [0.6, ['每个粒子的动能、势能和总能量随时间（约化单位）。', 'Kinetic, potential and total energy per particle over time (reduced units).']], [0.6, ['后半段的径向分布函数 g(r)。', 'Radial distribution function g(r) over the second half.']]],
    note: ['确定的模拟：同样的设置总给出同样的结果（固定随机种子）。约化单位 σ = ε = m = 1，势能在 2.5σ 截断并整体平移，使截断处连续。没有恒温器（微正则系综），所以平衡后的温度会偏离初始值。二维、粒子少，相图和三维不同，只看定性：液体的 g(r) 有几个衰减的峰，固体的峰尖锐且分裂，气体几乎没有结构。', 'A deterministic simulation: the same settings always give the same result (fixed random seed). Reduced units σ = ε = m = 1; the potential is cut at 2.5σ and shifted so it is continuous there. There is no thermostat (microcanonical ensemble), so the temperature drifts from its initial value as the system equilibrates. Two dimensions and few particles give a different phase diagram from 3D; read it qualitatively: a liquid’s g(r) has a few decaying peaks, a solid’s are sharp and split, a gas shows almost no structure.'],
    draw(s, f, c) {
      const N = Number(s.N), o = M.ljMD({ N, rho: s.rho, T: s.T, dt: s.dt, steps: s.steps });
      plot(f[0], { x: [0, o.L], y: [0, o.L], eq: true, xt: [], yt: [], series: [{ xs: o.x, ys: o.y, color: c.accent, dots: Math.max(3, Math.min(12, (0.45 * (f[0].clientWidth || 400)) / o.L)) }] });
      const lo = Math.min(...o.U, ...o.E), hi = Math.max(...o.K, ...o.E);
      plot(f[1], { x: [0, o.t[o.t.length - 1]], y: [lo - 0.2 * (hi - lo), hi + 0.2 * (hi - lo)], xl: 't / τ', yl: L('每个粒子的能量 / ε', 'Energy per particle / ε'), series: [{ xs: o.t, ys: o.K, color: c.info, width: 1.6, label: L('动能', 'Kinetic') }, { xs: o.t, ys: o.U, color: c.danger, width: 1.6, label: L('势能', 'Potential') }, { xs: o.t, ys: o.E, color: c.ink, width: 2.2, label: L('总能量', 'Total') }] });
      plot(f[2], { x: [0, o.grR[o.grR.length - 1] + 0.05], y: [0, Math.max(3, ...o.gr) * 1.1], xl: 'r / σ', yl: 'g(r)', series: [{ xs: o.grR, ys: o.gr, color: c.accent, width: 2 }], hmarks: [{ y: 1, color: c.muted }] });
      const E0 = o.E[0], dE = Math.max(...o.E.map((e) => Math.abs(e - E0))), Kbar = o.K.reduce((a, b) => a + b, 0) / o.K.length, rel = dE / Math.max(1e-9, Kbar);
      return [[['盒子边长', 'Box side'], `${fix(o.L, 2)} σ`], [['后半段平均温度', 'Mean temperature (second half)'], fix(o.Tmean, 3), 1], [['总能量的最大漂移', 'Largest total-energy drift'], `${fmt(dE, 2)} ε${L('（每个粒子）', ' per particle')}`], [['漂移 / 平均动能', 'Drift / mean kinetic energy'], `${fix(100 * rel, 2)} %${rel < 0.01 ? L('：守恒得好', ': well conserved') : rel < 0.1 ? L('：可以接受', ': acceptable') : L('：步长太大', ': step too large')}`, 1], [['模拟时长', 'Simulated time'], `${fix(s.steps * s.dt, 1)} τ`]];
    },
  };
});
