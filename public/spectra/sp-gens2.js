'use strict';
// 谱图馆 · 交互演示（下）：原子光谱、电化学、色谱、热分析、X 射线与散射、其他方法。写法同 sp-gens.js。
(() => {
  const K = window.MOLASTRIA_SPECTRA_KIT, M = window.MOLASTRIA_SPECTRA_MODELS, ATLAS = window.MOLASTRIA_SPECTRA_ATLAS, TABLES = window.MOLASTRIA_SPECTRA_TABLES, G = window.MOLASTRIA_SPECTRA_GENS, MS = window.MOLASTRIA_SPECTRA_MS;
  const MEAS = window.MOLASTRIA_SPECTRA_MEASURED || { ms: {} };
  if (!K || !M || !G || !ATLAS) return;
  const { L, tx, esc, num, fix, chem, ctl, lin, logs, gauss } = K;
  const nm1 = (id) => MS.msName(id).split(' · ')[0];
  const F = M.K.F, R = M.K.R, T0 = 298.15;
  const area = (x, x0, sd) => Math.exp(-((x - x0) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
  const argmax = (ys) => ys.reduce((b, y, i) => (y > ys[b] ? i : b), 0);
  const sci = (v, d = 2) => { const e = Math.floor(Math.log10(Math.abs(v))), m = v / 10 ** e; return `${fix(m, d)} × 10${String(e).replace(/-/, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`; };

  // ── 原子光谱 ──────────────────────────────────────────────────────────
  G.hydrogen = () => ({
    ctl: [ctl.seg('n1', L('线系', 'Series'), [[1, L('Lyman（落到 n = 1）', 'Lyman (down to n = 1)')], [2, L('Balmer（落到 n = 2）', 'Balmer (down to n = 2)')], [3, L('Paschen（落到 n = 3）', 'Paschen (down to n = 3)')]], 2)],
    draw: (s) => {
      const n1 = +s.n1, name = ['Ly', 'H', 'Pa'][n1 - 1], gr = 'αβγδεζηθ', lines = [];
      for (let n2 = n1 + 1; n2 <= n1 + 12; n2++) lines.push({ n2, ...M.hydrogenLine(n1, n2) });
      const limit = 1e7 / (M.K.RH / (n1 * n1)), lim = limit > 200 ? M.conv.vacToAir(limit) : limit, hi = lines[0].air * 1.06, lo = lim * 0.97;
      const sticks = lines.map((l, i) => ({ x: l.air, y: 1 / (1 + i * 0.35), color: K.nmColor(l.air), c: 5, w: 2.2, label: i < 4 ? `${name}${n1 === 2 ? '' : '-'}${gr[i]} ${l.air.toFixed(2)}` : '', tip: `n = ${l.n2} → ${n1} · ${l.air.toFixed(3)} nm · ${l.nu.toFixed(1)} cm⁻¹` }));
      return { plots: [{ x: [lo, hi], y: [0, 1.35], noy: true, sticks, vlines: [{ x: lim, label: L(`系限 ${lim.toFixed(1)}`, `limit ${lim.toFixed(1)}`), c: 5 }], xl: n1 === 1 ? L('波长（nm，真空）', 'wavelength (nm, vacuum)') : L('波长（nm，空气）', 'wavelength (nm, air)'), yl: L('高度只是示意', 'heights are schematic'), h: 250, curfmt: (v) => `${v.toFixed(1)} nm` }],
        out: [...lines.slice(0, 5).map((l) => [`n = ${l.n2} → ${n1}`, `${l.air.toFixed(2)} nm · ${l.nu.toFixed(1)} cm⁻¹ · ${fix(M.conv.nmToEv(l.vac), 3)} eV`]), [L('系限', 'Series limit'), `${lim.toFixed(2)} nm · ${fix(M.conv.nmToEv(limit), 3)} eV`]] };
    },
  });

  G.flame = (a) => {
    const els = Object.keys(ATLAS.ALINES).filter((e) => ATLAS.ALINES[e].flame || ATLAS.ALINES[e].bands);
    return {
      ctl: [ctl.checks('on', L('元素', 'Elements'), els.map((e) => [e, e]), a.on)],
      draw: (s) => {
        const sticks = [], bands = [], out = [];
        for (const e of s.on) {
          const z = ATLAS.ALINES[e];
          for (const nm of z.flame || []) if (nm >= 380 && nm <= 800) sticks.push({ x: nm, y: 1, color: K.nmColor(nm), w: 2.6, label: `${e} ${nm}`, tip: `${e} ${nm} nm` });
          for (const [x0, x1] of z.bands || []) bands.push({ x0, x1, color: K.nmColor((x0 + x1) / 2), op: 0.45, label: e });
          out.push([`${e} · ${tx(z.name)}`, `${z.color ? L(`焰色：${tx(z.color)}`, `flame colour: ${tx(z.color)}`) : ''}${z.flame ? ` · ${z.flame.join(', ')} nm` : ''}${z.bands ? ` · ${L('分子谱带', 'molecular bands')} ${z.bands.map((b) => b.join('–')).join(', ')} nm` : ''}`]);
        }
        return { plots: [{ x: [380, 800], y: [0, 1.4], noy: true, sticks, bands, xl: L('波长（nm）', 'wavelength (nm)'), h: 230, curfmt: (v) => `${v.toFixed(0)} nm`,
          strip: (sx, box) => { let g = ''; for (let nm = 380; nm < 780; nm += 4) g += `<rect x="${sx(nm).toFixed(1)}" y="${box.b + 20}" width="${(sx(nm + 4) - sx(nm) + 0.6).toFixed(1)}" height="5" fill="${K.nmColor(nm + 2)}"/>`; return g; } }], out };
      },
    };
  };

  G.icplines = (a) => {
    const els = Object.keys(ATLAS.ALINES).filter((e) => ATLAS.ALINES[e].icp);
    return {
      ctl: [ctl.checks('on', L('元素', 'Elements'), els.map((e) => [e, e]), a.on)],
      draw: (s) => {
        const sticks = [], out = [];
        s.on.forEach((e, i) => { const z = ATLAS.ALINES[e]; for (const [nm, st] of z.icp) sticks.push({ x: nm, y: st === 'II' ? 1 : 0.8, c: i % 5, label: `${e} ${st} ${nm.toFixed(1)}`, tip: `${e} ${st} ${nm.toFixed(3)} nm` }); out.push([`${e} · ${tx(z.name)}`, z.icp.map(([nm, st]) => `${st} ${nm.toFixed(3)}`).join(' · ') + ' nm']); });
        return { plots: [{ x: [160, 800], y: [0, 1.6], noy: true, sticks, bands: [{ x0: 160, x1: 190, c: 5, op: 0.1 }], xl: L('波长（nm）', 'wavelength (nm)'), h: 250, curfmt: (v) => `${v.toFixed(1)} nm` }], out, note: L('左边灰色的一段（190 nm 以下）要吹扫或抽真空的光路才看得到。', 'The grey strip on the left (below 190 nm) needs a purged or evacuated optical path.') };
      },
    };
  };

  // ── 电化学 ────────────────────────────────────────────────────────────
  const cvCache = {};
  G.cv = (a) => ({
    ctl: a.free ? [ctl.seg('n', L('电子数 n', 'Electrons n'), [[1, 'n = 1'], [2, 'n = 2']], 1), ctl.log('v', L('扫描速率', 'Scan rate'), 0.005, 5, 0.1, (v) => `${num(+v.toPrecision(2), 3)} V/s`), ctl.log('C', L('浓度', 'Concentration'), 0.05, 20, 1, (v) => `${num(+v.toPrecision(2), 2)} mmol/L`), ctl.log('D', L('扩散系数', 'Diffusion coefficient'), 1e-6, 5e-5, 1e-5, (v) => `${sci(v, 1)} cm²/s`)] : [],
    draw: (s) => {
      const n = +s.n || 1, A = 0.071, C = (s.C || 1) * 1e-6, Dc = s.D || 1e-5, cv = (cvCache[n] ||= M.cyclicVoltammogram({ n, Ei: 0.3, Es: -0.3, pts: 400 }));
      const vs = a.free ? [s.v] : [0.025, 0.05, 0.1, 0.2, 0.4], cur = (v) => cv.psi.map((p) => -p * n * F * A * C * Math.sqrt((n * F * v * Dc) / (R * T0)) * 1e6);
      const series = vs.map((v, i) => ({ xs: cv.E, ys: cur(v), c: i, label: a.free ? '' : `${v * 1000} mV/s` })), y = series[series.length - 1].ys, ic = Math.min(...y), ia = Math.max(...y), Ec = cv.E[y.indexOf(ic)], Ea = cv.E[y.indexOf(ia)];
      const ip = M.randlesSevcik(n, A, Dc, C, vs[vs.length - 1]) * 1e6, pad = Math.max(-ic, ia) * 1.18;
      return { plots: [{ x: [-0.3, 0.3], y: [-pad, pad], zero: true, series, vlines: [{ x: 0, label: "E°′", c: 5 }], xl: L('电位 E − E°′（V）', 'potential E − E°′ (V)'), yl: L('电流（μA，氧化为正）', 'current (μA, oxidation positive)'), h: 320, curfmt: (v) => `${(v * 1000).toFixed(0)} mV` }],
        out: [[L('还原峰（数值解）', 'Reduction peak (numerical)'), `${fix(ic, 2)} μA @ ${(Ec * 1000).toFixed(0)} mV`], [L('Randles–Ševčík 峰电流', 'Randles–Ševčík peak current'), `${fix(ip, 2)} μA`], [L('峰间距 ΔE_p', 'Peak separation ΔE_p'), `${((Ea - Ec) * 1000).toFixed(0)} mV (${L('理论', 'theory')} ≈ ${(59 / n).toFixed(0)} mV + ${L('换向电位的影响', 'the effect of the switching potential')})`], [L('条件', 'Conditions'), `n = ${n} · A = 0.071 cm² · ${num(C * 1e6, 2)} mmol/L · D = ${sci(Dc, 1)} cm²/s`]] };
    },
  });

  G.rde = () => ({
    ctl: [ctl.seg('n', L('电子数', 'Electrons'), [[4, L('n = 4（生成 OH⁻）', 'n = 4 (to OH⁻)')], [2, L('n = 2（生成 HO₂⁻）', 'n = 2 (to HO₂⁻)')]], 4), ctl.log('j0', L('交换电流密度 j₀', 'Exchange current density j₀'), 1e-11, 1e-7, 1e-9, (v) => `${sci(v, 1)} A/cm²`)],
    draw: (s) => {
      const n = +s.n, Dc = 1.9e-5, nu = 0.01, C = 1.2e-6, f = F / (R * T0), rpms = [400, 900, 1600, 2500], Es = lin(0.2, 1.1, 300);
      const jL = (rpm) => 0.62 * n * F * Dc ** (2 / 3) * nu ** (-1 / 6) * C * Math.sqrt((rpm * 2 * Math.PI) / 60) * 1000, jk = (E) => s.j0 * Math.exp(f * (1.229 - E)) * 1000, j = (E, rpm) => -(jk(E) * jL(rpm)) / (jk(E) + jL(rpm));
      let Eh = 0.2; for (const E of Es) if (-j(E, 1600) > jL(1600) / 2) Eh = E;
      const kl = rpms.map((r) => ({ x: 1 / Math.sqrt((r * 2 * Math.PI) / 60), y: -1 / j(0.75, r), c: 1 })), x1 = kl[0].x * 1.15;
      return { plots: [{ x: [0.2, 1.1], series: rpms.map((r, i) => ({ xs: Es, ys: Es.map((E) => j(E, r)), c: i, label: L(`${r} 转/分`, `${r} rpm`) })), zero: true, y: [-jL(2500) * 1.12, jL(2500) * 0.06], xl: L('电位（V，相对 RHE）', 'potential (V vs RHE)'), yl: L('电流密度（mA/cm²）', 'current density (mA/cm²)'), h: 300 },
        { title: L('Koutecký–Levich 图（0.75 V）', 'Koutecký–Levich plot (0.75 V)'), x: [0, x1], y: [0, kl[0].y * 1.25], pts: kl, series: [{ xs: [0, x1], ys: [1 / jk(0.75), 1 / jk(0.75) + (x1 / kl[0].x) * (1 / jL(400))], c: 1 }], xl: 'ω⁻¹ᐟ² (rad/s)⁻¹ᐟ²', yl: L('1/|j|（cm²/mA）', '1/|j| (cm²/mA)'), h: 230 }],
        out: [[L('1600 转/分的极限电流密度', 'Limiting current density at 1600 rpm'), `${fix(jL(1600), 2)} mA/cm²`], [L('半波电位（1600 转/分）', 'Half-wave potential (1600 rpm)'), `${fix(Eh, 3)} V`], [L('0.90 V 的动力学电流密度', 'Kinetic current density at 0.90 V'), `${num(jk(0.9), 3)} mA/cm²`], [L('用到的常数', 'Constants used'), `D = 1.9 × 10⁻⁵ cm²/s · ν = 0.01 cm²/s · c(O₂) = 1.2 mmol/L`]] };
    },
  });

  G.nyquist = () => ({
    ctl: [ctl.range('Rs', L('溶液电阻 R_s', 'Solution resistance R_s'), 0, 60, 1, 10, (v) => `${v} Ω`), ctl.range('Rct', L('电荷转移电阻 R_ct', 'Charge-transfer resistance R_ct'), 10, 500, 5, 100, (v) => `${v} Ω`), ctl.log('Cdl', L('双电层电容 C_dl', 'Double-layer capacitance C_dl'), 1e-6, 2e-4, 2e-5, (v) => `${num(v * 1e6, 2)} μF`), ctl.range('sg', L('Warburg 系数 σ', 'Warburg coefficient σ'), 0, 60, 1, 15, (v) => `${v} Ω s⁻¹ᐟ²`)],
    draw: (s) => {
      const p = { Rs: s.Rs, Rct: s.Rct, Cdl: s.Cdl, sigma: s.sg }, fs = logs(1e5, 0.01, 240), z = fs.map((f) => M.randlesImpedance(f, p)), h = 380, ratio = (h - 58) / 646;
      const X = Math.max(Math.max(...z.map((q) => q.re)) * 1.06, (Math.max(...z.map((q) => -q.im)) * 1.1) / ratio);
      const pts = [1e5, 1e4, 1e3, 100, 10, 1, 0.1, 0.01].map((f) => { const q = M.randlesImpedance(f, p); return { x: q.re, y: -q.im, c: 1, label: f >= 1000 ? `${f / 1000} kHz` : f >= 1 ? `${f} Hz` : `${f * 1000} mHz` }; });
      return { plots: [{ x: [0, X], y: [0, X * ratio], series: [{ xs: z.map((q) => q.re), ys: z.map((q) => -q.im), c: 0 }], pts, xl: "Z′ (Ω)", yl: "−Z″ (Ω)", h }],
        out: [[L('高频截距', 'High-frequency intercept'), `R_s = ${s.Rs} Ω`], [L('半圆的直径', 'Diameter of the semicircle'), `R_ct = ${s.Rct} Ω`], [L('半圆顶点的频率', 'Frequency at the top of the semicircle'), `1 / (2π R_ct C_dl) = ${num(1 / (2 * Math.PI * s.Rct * s.Cdl), 3)} Hz`], [L('两条坐标轴的比例相同', 'Both axes share one scale'), L('所以半圆是真的圆，Warburg 线是 45°', 'so the semicircle is a true circle and the Warburg line sits at 45°')]] };
    },
  });

  G.titration = () => ({
    ctl: [ctl.range('pKa', 'pK_a', 2, 11, 0.05, 4.76, (v) => fix(v, 2)), ctl.log('c', L('酸和碱的浓度', 'Concentration of acid and base'), 0.0005, 1, 0.1, (v) => `${num(+v.toPrecision(2), 4)} mol/L`)],
    draw: (s) => {
      const o = { ca: s.c, cb: s.c, Va: 25, pKa: s.pKa }, xs = lin(0, 50, 501), ys = xs.map((v) => M.titrationPH(v, o)), dy = xs.map((v, i) => (i && i < 500 ? (ys[i + 1] - ys[i - 1]) / 0.2 : NaN));
      const jump = M.titrationPH(25.025, o) - M.titrationPH(24.975, o);
      return { plots: [{ x: [0, 50], y: [0, 14], series: [{ xs, ys, c: 0 }], vlines: [{ x: 12.5, label: L('半等当点', 'half-equivalence'), c: 5 }, { x: 25, label: L('等当点', 'equivalence'), c: 1 }], xl: L('加入的碱（mL）', 'base added (mL)'), yl: 'pH', h: 290 }, { x: [0, 50], series: [{ xs, ys: dy, c: 1 }], xl: L('加入的碱（mL）', 'base added (mL)'), yl: 'dpH/dV', h: 150, noy: true }],
        out: [[L('起点的 pH', 'Initial pH'), fix(ys[0], 2)], [L('半等当点的 pH', 'pH at half-equivalence'), `${fix(M.titrationPH(12.5, o), 2)} (pK_a = ${fix(s.pKa, 2)})`], [L('等当点的 pH', 'pH at equivalence'), fix(M.titrationPH(25, o), 2)], [L('等当点前后 ±0.1 % 的突跃', 'Jump across ±0.1 % around equivalence'), L(`${fix(jump, 2)} 个 pH 单位`, `${fix(jump, 2)} pH units`)]] };
    },
  });

  // ── 色谱 ──────────────────────────────────────────────────────────────
  G.vandeemter = (a) => ({
    draw: () => {
      if (a.mode === 'gc') {
        const gas = [[L('氮气', 'Nitrogen'), 1.43, 0.00846], [L('氦气', 'Helium'), 3.5, 0.0056], [L('氢气', 'Hydrogen'), 6.0, 0.00375]], xs = lin(4, 100, 300);
        return { plots: [{ x: [0, 100], y: [0, 1.2], series: gas.map(([n, B, C], i) => ({ xs, ys: xs.map((u) => M.vanDeemter(u, 0, B, C)), c: i, label: n })), pts: gas.map(([, B, C], i) => { const o = M.vanDeemterOpt(0, B, C); return { x: o.u, y: o.H, c: i }; }), xl: L('载气的平均线速度（cm/s）', 'average carrier-gas velocity (cm/s)'), yl: L('塔板高度 H（mm）', 'plate height H (mm)'), h: 290 }],
          out: gas.map(([n, B, C]) => { const o = M.vanDeemterOpt(0, B, C); return [n, L(`最佳线速度 ${fix(o.u, 0)} cm/s，最小塔板高度 ${fix(o.H, 2)} mm；开到 60 cm/s 时 ${fix(M.vanDeemter(60, 0, B, C), 2)} mm`, `optimum ${fix(o.u, 0)} cm/s, minimum plate height ${fix(o.H, 2)} mm; at 60 cm/s it is ${fix(M.vanDeemter(60, 0, B, C), 2)} mm`)]; }) };
      }
      const xs = lin(0.15, 8, 300), dps = [5, 3, 1.7];
      return { plots: [{ x: [0, 8], y: [0, 30], series: dps.map((dp, i) => ({ xs, ys: xs.map((u) => M.vanDeemter(u, dp, 2 / 1, 0.08 * dp * dp)), c: i, label: `${dp} μm` })), pts: dps.map((dp, i) => { const o = M.vanDeemterOpt(dp, 2, 0.08 * dp * dp); return { x: o.u, y: o.H, c: i }; }), xl: L('流动相线速度（mm/s）', 'mobile-phase velocity (mm/s)'), yl: L('塔板高度 H（μm）', 'plate height H (μm)'), h: 290 }],
        out: dps.map((dp) => { const o = M.vanDeemterOpt(dp, 2, 0.08 * dp * dp); return [`${dp} μm`, L(`最佳线速度 ${fix(o.u, 2)} mm/s，最小塔板高度 ${fix(o.H, 1)} μm，相当于每米 ${num(Math.round(1e6 / o.H / 1000) * 1000, 0)} 块塔板`, `optimum ${fix(o.u, 2)} mm/s, minimum plate height ${fix(o.H, 1)} μm, i.e. ${num(Math.round(1e6 / o.H / 1000) * 1000, 0)} plates per metre`)]; }) };
    },
  });

  G.resolution = () => ({
    ctl: [ctl.log('N', L('理论塔板数 N', 'Plate number N'), 500, 200000, 10000, (v) => num(+v.toPrecision(2), 0)), ctl.range('al', L('选择性因子 α', 'Selectivity α'), 1.01, 1.5, 0.005, 1.1, (v) => fix(v, 3)), ctl.range('k', L('保留因子 k（后一个峰）', 'Retention factor k (second peak)'), 0.2, 20, 0.1, 3, (v) => fix(v, 1))],
    draw: (s) => {
      const t2 = 1 + s.k, t1 = 1 + s.k / s.al, sd = t2 / Math.sqrt(s.N), lo = Math.max(0, t1 - 8 * sd - 0.05), hi = t2 + 8 * sd + 0.05, c = M.chromatogram([{ tr: t1 }, { tr: t2 }], { t0: lo, t1: hi, N: s.N, n: 700 }), Rs = M.resolution(t1, t2, s.N);
      return { plots: [{ x: [lo, hi], noy: true, series: [{ xs: c.ts, ys: c.ys, c: 0, fill: true }], xl: L('保留时间（以死时间 t₀ 为单位）', 'retention time (in units of the dead time t₀)'), yl: L('检测器信号', 'detector signal'), h: 260 }],
        out: [[L('分离度 R_s', 'Resolution R_s'), `${fix(Rs, 2)} ${Rs >= 1.5 ? L('（基线分离）', '(baseline separated)') : Rs >= 1 ? L('（基本分开，重叠约 2 %）', '(mostly resolved, about 2 % overlap)') : L('（没分开）', '(not resolved)')}`], [L('Purnell 方程的三项', 'The three Purnell terms'), `√N/4 = ${fix(Math.sqrt(s.N) / 4, 1)} · (α − 1)/α = ${fix((s.al - 1) / s.al, 3)} · k/(1 + k) = ${fix(s.k / (1 + s.k), 3)} → ${fix(M.purnell(s.N, s.al, s.k), 2)}`], [L('要到 R_s = 1.5 需要的塔板数', 'Plates needed for R_s = 1.5'), num(Math.round(36 * (s.al / (s.al - 1)) ** 2 * ((1 + s.k) / s.k) ** 2 / 100) * 100, 0)]] };
    },
  });

  G.ritable = (a) => ({
    draw: () => {
      const rows = a.ids.map((id) => [id, MEAS.ms[id]]).filter((r) => r[1]).sort((p, q) => p[1].ri - q[1].ri), alk = /^(ethane|propane|hexane|heptane|decane)$/i;
      return { plots: [{ html: `<div class="sp-scroll"><table class="sp-table"><thead><tr><th>${L('化合物', 'Compound')}</th><th>${L('分子式', 'Formula')}</th><th>${L('保留指数', 'Retention index')}</th><th>${L('基峰 m/z', 'Base peak m/z')}</th><th>MassBank</th></tr></thead><tbody>${rows.map(([id, r]) => { const b = r.peaks.reduce((x, y) => (y[1] > x[1] ? y : x)); return `<tr${alk.test(r.names[0]) ? ' class="is-ref"' : ''}><td>${esc(MS.msName(id))}</td><td>${chem(r.formula)}</td><td>${r.ri}</td><td>${b[0].toFixed(3)}</td><td><a href="${esc(MEAS.sources.massbank.record + r.acc)}" target="_blank" rel="noopener noreferrer">${esc(r.acc)}</a></td></tr>`; }).join('')}</tbody></table></div>` }] };
    },
  });

  const eic = (r, mz, tol) => { const tot = r.peaks.reduce((x, p) => x + p[1], 0); return r.peaks.filter((p) => Math.abs(p[0] - mz) <= tol).reduce((x, p) => x + p[1], 0) / tot; };
  G.gcms = (a) => {
    const ids = a.ids.filter((id) => MEAS.ms[id]).sort((p, q) => MEAS.ms[p].ri - MEAS.ms[q].ri);
    return {
      ctl: [ctl.seg('tr', L('画哪一条', 'Trace'), [['tic', L('总离子流', 'Total ion current')], [91, 'm/z 91'], [112, 'm/z 112'], [57, 'm/z 57']], 'tic'), ctl.select('sel', L('看哪个化合物的质谱', 'Mass spectrum of'), ids.map((id) => [id, `${MEAS.ms[id].ri} · ${nm1(id)}`]), 'ei-toluene')],
      pick: (st, s, api) => api.set({ sel: st.data }),
      draw: (s) => {
        const w = 5, hts = ids.map((id) => (s.tr === 'tic' ? 1 : eic(MEAS.ms[id], +s.tr, 0.3))), top = s.tr === 'tic' ? 1 : Math.max(...hts) || 1, xs = lin(150, 1050, 1800);
        const ys = xs.map((x) => ids.reduce((y, id, i) => y + (Math.abs(x - MEAS.ms[id].ri) < 30 ? hts[i] * Math.exp(-((x - MEAS.ms[id].ri) ** 2) / (2 * w * w)) : 0), 0));
        const sticks = ids.map((id, i) => ({ x: MEAS.ms[id].ri, y: hts[i], c: id === s.sel ? 3 : 0, w: id === s.sel ? 2 : 0.6, data: id, label: id === s.sel || hts[i] > 0.25 * top && s.tr !== 'tic' ? nm1(id) : '', tip: `${nm1(id)} · RI ${MEAS.ms[id].ri}` }));
        return { plots: [{ x: [150, 1050], y: [0, Math.max(...ys) * 1.3], noy: true, series: [{ xs, ys, c: 0 }], sticks, xl: L('保留指数（GasPro 柱，实测）', 'retention index (GasPro column, measured)'), yl: s.tr === 'tic' ? L('总离子流（每个化合物等量）', 'total ion current (equal amounts)') : L(`m/z ${s.tr} 的提取离子流`, `extracted ion current, m/z ${s.tr}`), h: 250, curfmt: (v) => `RI ${v.toFixed(0)}` }, { ...MS.msPlot(s.sel), title: L(`${nm1(s.sel)} 的电子电离质谱（实测）`, `Electron-ionisation mass spectrum of ${nm1(s.sel)} (measured)`) }], out: MS.msOut(s.sel), html: MS.msSrc(s.sel) };
      },
    };
  };

  G.lcms = (a) => {
    const ids = a.ids.filter((id) => MEAS.ms[id]).sort((p, q) => MEAS.ms[p].rt - MEAS.ms[q].rt), short = (id) => nm1(id);
    const chrom = (hts) => { const xs = lin(0, 20, 2400), sd = 0.045; return { xs, ys: xs.map((x) => ids.reduce((y, id, i) => y + (Math.abs(x - MEAS.ms[id].rt) < 0.4 ? hts[i] * Math.exp(-((x - MEAS.ms[id].rt) ** 2) / (2 * sd * sd)) : 0), 0)) }; };
    if (a.mode === 'uv') return { draw: () => { const c = chrom(ids.map(() => 1)); return { plots: [{ x: [0, 20], y: [0, 1.75], noy: true, series: [{ xs: c.xs, ys: c.ys, c: 0 }], sticks: ids.map((id) => ({ x: MEAS.ms[id].rt, y: 1, w: 0.6, c: 0, label: short(id), tip: `${short(id)} · ${MEAS.ms[id].rt} min` })), xl: L('保留时间（min，实测）', 'retention time (min, measured)'), yl: L('检测器信号（等响应的模型）', 'detector signal (equal-response model)'), h: 290, curfmt: (v) => `${v.toFixed(2)} min` }],
      out: [[L('色谱条件', 'Conditions'), `${MEAS.ms[ids[0]].column} · ${MEAS.ms[ids[0]].gradient}`], [L('最接近的一对', 'Closest pair'), (() => { let b = [9, '', '']; for (let i = 1; i < ids.length; i++) { const d = MEAS.ms[ids[i]].rt - MEAS.ms[ids[i - 1]].rt; if (d < b[0]) b = [d, ids[i - 1], ids[i]]; } return `${short(b[1])} / ${short(b[2])} · Δt = ${fix(b[0], 3)} min`; })()]] }; } };
    const targets = [181.072, 296.024, 315.2319, 205.1234];
    return {
      ctl: [ctl.seg('tr', L('画哪一条', 'Trace'), [['tic', L('总离子流', 'Total ion current')], ...targets.map((t) => [t, `m/z ${t.toFixed(4)}`])], 'tic'), ctl.select('sel', L('看哪个化合物的二级质谱', 'MS² spectrum of'), ids.map((id) => [id, `${MEAS.ms[id].rt} min · ${short(id)}`]), 'esi-caffeine-30')],
      pick: (st, s, api) => api.set({ sel: st.data }),
      draw: (s) => {
        const hts = ids.map((id) => (s.tr === 'tic' || Math.abs(MEAS.ms[id].prec - +s.tr) < 0.005 ? 1 : 0)), c = chrom(hts), r = MEAS.ms[s.sel];
        return { plots: [{ x: [0, 20], y: [0, 1.75], noy: true, series: [{ xs: c.xs, ys: c.ys, c: 0 }], sticks: ids.map((id, i) => ({ x: MEAS.ms[id].rt, y: hts[i], w: id === s.sel ? 2 : 0.6, c: id === s.sel ? 3 : 0, data: id, label: hts[i] ? short(id) : '', tip: `${short(id)} · ${MEAS.ms[id].rt} min · ${MEAS.ms[id].adduct} ${MEAS.ms[id].prec}` })), xl: L('保留时间（min，实测）', 'retention time (min, measured)'), yl: s.tr === 'tic' ? L('总离子流（等响应的模型）', 'total ion current (equal-response model)') : L(`m/z ${(+s.tr).toFixed(4)} ± 0.005 的提取离子流`, `extracted ion current, m/z ${(+s.tr).toFixed(4)} ± 0.005`), h: 260, curfmt: (v) => `${v.toFixed(2)} min` },
          { ...MS.msPlot(s.sel), title: L(`${short(s.sel)} 的二级质谱（实测，母离子 ${r.adduct} m/z ${r.prec}）`, `MS² spectrum of ${short(s.sel)} (measured; precursor ${r.adduct} m/z ${r.prec})`) }], out: MS.msOut(s.sel), html: MS.msSrc(s.sel) };
      },
    };
  };

  G.suppression = () => ({
    ctl: [ctl.range('rt', L('分析物的保留时间', 'Retention time of the analyte'), 0.3, 10, 0.1, 4.5, (v) => `${fix(v, 1)} min`)],
    draw: (s) => {
      const f = (t) => 1 - 0.85 * Math.exp(-((t - 0.8) ** 2) / (2 * 0.25 ** 2)) - 0.6 * Math.exp(-((t - 7.6) ** 2) / (2 * 0.5 ** 2)) - 0.35 * Math.exp(-((t - 8.7) ** 2) / (2 * 0.35 ** 2)) + 0.012 * Math.sin(t * 37) * Math.cos(t * 11), xs = lin(0, 10, 800), v = f(s.rt);
      return { plots: [{ x: [0, 10], y: [0, 1.25], series: [{ xs, ys: xs.map(f), c: 0, label: L('进空白基质后的柱后注入信号', 'post-column infusion signal after injecting blank matrix') }, { xs: [0, 10], ys: [1, 1], c: 5, dash: true, label: L('进纯溶剂', 'after injecting pure solvent') }], bands: [{ x0: 0.4, x1: 1.3, c: 3, label: L('盐', 'salts') }, { x0: 6.8, x1: 9.3, c: 3, label: L('磷脂', 'phospholipids') }], vlines: [{ x: s.rt, label: L('分析物', 'analyte'), c: 1 }], xl: L('时间（min）', 'time (min)'), yl: L('相对信号', 'relative signal'), h: 280 }],
        out: [[L('分析物出峰处剩下的信号', 'Signal left where the analyte elutes'), `${fix(100 * v, 0)} %`], [L('判断', 'Verdict'), v > 0.9 ? L('在干净的窗口里', 'in a clean window') : v > 0.7 ? L('有轻微抑制，要用同位素内标校正', 'mild suppression; correct with an isotope-labelled internal standard') : L('落在抑制区里，应当改梯度或改净化方法', 'inside a suppression zone; change the gradient or the clean-up')]] };
    },
  });

  G.sec = () => ({
    draw: () => {
      const V = lin(10, 22, 500), Mv = (v) => 10 ** (9.0 - 0.3 * v), set = [[1.05, 0], [2.0, 1]].map(([d, c]) => { const sz = M.schulzZimm(50000, d), ys = V.map((v) => sz.w(Mv(v)) * Mv(v)), top = Math.max(...ys); return { xs: V, ys: ys.map((y) => y / top), c, label: `Đ = ${fix(d, 2)}`, vp: V[argmax(ys)], sz }; });
      return { plots: [{ x: [10, 22], y: [0, 1.2], noy: true, series: set, xl: L('流出体积（mL）', 'elution volume (mL)'), yl: L('示差折光信号（归一化）', 'refractive-index signal (normalised)'), h: 260,
        strip: (sx, box) => [6, 5, 4, 3].map((e) => { const v = (9 - e) / 0.3; return `<text class="sp-tick" x="${sx(v).toFixed(1)}" y="${box.b + 28}" text-anchor="middle">M = 10${'⁰¹²³⁴⁵⁶'[e]}</text>`; }).join('') }],
        out: set.map((q) => [q.label, `M_n = ${num(q.sz.Mn, 0)} · M_w = ${num(q.sz.Mw, 0)} · ${L('峰顶', 'peak')} ${fix(q.vp, 2)} mL (M_p ≈ ${num(+Mv(q.vp).toPrecision(3), 0)})`]).concat([[L('校正曲线', 'Calibration'), 'log M = 9.0 − 0.30 V']]) };
    },
  });

  G.chiral = () => ({
    ctl: [ctl.range('ee', L('对映体过量 ee', 'Enantiomeric excess ee'), 0, 99.8, 0.2, 90, (v) => `${fix(v, 1)} %`)],
    draw: (s) => {
      const a1 = (1 + s.ee / 100) / 2, a2 = 1 - a1, c = M.chromatogram([{ tr: 8, area: a1 }, { tr: 9.2, area: a2 }], { t0: 6.5, t1: 11, N: 8000, n: 900 }), top = Math.max(...c.ys);
      return { plots: [{ x: [6.5, 11], y: [0, 1.15], noy: true, series: [{ xs: c.ts, ys: c.ys.map((y) => y / top), c: 0, fill: true }], marks: [[8, L('主', 'major'), 1], [9.2, L('次', 'minor'), (a2 / a1) * (8 / 9.2)]], xl: L('保留时间（min）', 'retention time (min)'), yl: L('检测器信号', 'detector signal'), h: 260 }],
        out: [[L('面积比', 'Area ratio'), `${fix(100 * a1, 2)} : ${fix(100 * a2, 2)}`], [L('由面积反算的 ee', 'ee from the areas'), `${fix(M.ee(a1, a2), 1)} %`], [L('小峰是大峰的', 'Minor peak relative to major'), `${num(+(100 * a2 / a1).toPrecision(3), 3)} %`], [L('分离度', 'Resolution'), fix(M.resolution(8, 9.2, 8000), 2)]] };
    },
  });

  G.tlc = () => ({
    draw: () => {
      const y = (rf) => 300 - rf * 240, spot = (x, rf, rx, ry, op, c) => `<ellipse class="sp-spot sp-c${c}" cx="${x}" cy="${y(rf)}" rx="${rx}" ry="${ry}" opacity="${op}"/>`, lane = [250, 340, 430];
      const t = (x, yy, s2, anchor = 'middle', cls = 'sp-lbl') => `<text class="${cls}" x="${x}" y="${yy}" text-anchor="${anchor}">${esc(s2)}</text>`;
      return { plots: [{ html: `<svg class="sp-plot sp-diagram" viewBox="0 0 720 360" role="img" aria-label="TLC">
        <rect class="sp-plate" x="200" y="30" width="280" height="300" rx="3"/>
        <line class="sp-vl sp-c5" stroke-dasharray="5 4" x1="200" x2="480" y1="60" y2="60"/><line class="sp-vl sp-c5" x1="200" x2="480" y1="300" y2="300"/>
        ${t(490, 64, tx(L('溶剂前沿', 'solvent front')), 'start')}${t(490, 304, tx(L('原点', 'origin')), 'start')}
        ${spot(lane[0], 0.55, 11, 8, 0.9, 0)}${spot(lane[1], 0.55, 11, 8, 0.9, 0)}${spot(lane[1], 0.30, 12, 9, 0.9, 1)}${spot(lane[1], 0.03, 9, 5, 0.6, 3)}
        ${spot(lane[2], 0.55, 9, 6, 0.22, 0)}${spot(lane[2], 0.30, 12, 9, 0.9, 1)}${spot(lane[2], 0.03, 9, 5, 0.6, 3)}
        ${[tx(L('原料', 'SM')), tx(L('混合点', 'co-spot')), tx(L('反应液', 'reaction'))].map((n, i) => t(lane[i], 348, n, 'middle', 'sp-axis')).join('')}
        ${[[0.55, L('原料 R_f = 0.55', 'starting material, R_f = 0.55')], [0.30, L('产物 R_f = 0.30', 'product, R_f = 0.30')], [0.03, L('副产物（留在原点）', 'by-product (stays at the origin)')]].map(([rf, n]) => `<line class="sp-vl sp-c5" x1="150" x2="192" y1="${y(rf)}" y2="${y(rf)}"/>${t(144, y(rf) + 4, tx(n).replace('R_f', 'Rf'), 'end')}`).join('')}
      </svg>` }], out: [['R_f', L('斑点走的距离 ÷ 溶剂前沿走的距离，都从原点量起', 'distance travelled by the spot ÷ distance travelled by the solvent front, both from the origin')]] };
    },
  });

  G.gcxgc = () => ({
    draw: () => {
      const pts = [], cls = [[L('正构烷烃和支链烷烃', 'n- and branched alkanes'), 0, 0.9, 0.012], [L('环烷烃', 'Cycloalkanes'), 2, 1.55, 0.02], [L('单环芳烃', 'Monoaromatics'), 1, 2.7, 0.03], [L('双环芳烃', 'Diaromatics'), 3, 4.3, 0.04]];
      cls.forEach(([, c, y0, sl], ci) => { for (let n = 8 + ci * (ci === 3 ? 1 : 0.67) | 0; n <= 24; n++) { const x = 4 + 2.25 * (n - 8) + ci * 2.2; for (let k = 0; k < (ci ? 4 : 3); k++) pts.push({ x: x - k * 0.55, y: y0 + sl * (n - 8) - k * (ci ? 0.11 : 0.04) + (ci ? 0.08 * Math.sin(n * 2.1 + k) : 0), c, r: k ? 2.2 : 3.6 }); } });
      return { plots: [{ x: [0, 46], y: [0, 6], pts, xl: L('第一维保留时间（min，非极性柱：按沸点）', 'first-dimension retention time (min, non-polar column: by boiling point)'), yl: L('第二维保留时间（s，极性柱）', 'second-dimension retention time (s, polar column)'), legend: cls.map(([t, c]) => ({ c, t, dot: true })), h: 330 }] };
    },
  });

  // ── 热分析 ────────────────────────────────────────────────────────────
  G.tga = (a) => ({
    ctl: [ctl.select('p', L('样品', 'Sample'), a.presets.map((p, i) => [i, tx(p.name)]), 0)],
    draw: (s) => {
      const p = a.presets[+s.p], left = M.tgaSteps(p.formulas), c = M.tgaCurve(left.slice(1).map((to, i) => ({ T: p.temps[i], to, w: p.widths[i] })), { from: 25, to: 1000, n: 800 }), dtg = c.xs.map((x, i) => (i && i < c.xs.length - 1 ? -(c.ys[i + 1] - c.ys[i - 1]) / (c.xs[i + 1] - c.xs[i - 1]) : 0));
      return { plots: [{ x: [25, 1000], y: [Math.floor(left[left.length - 1] / 10) * 10 - 5, 104], series: [{ xs: c.xs, ys: c.ys, c: 0 }], hlines: left.slice(1).map((y) => ({ y, c: 5 })), marks: p.temps.map((T, i) => [T, `− ${p.lost[i]}`, (left[i] + left[i + 1]) / 2 + 4]), xl: L('温度（°C）', 'temperature (°C)'), yl: L('剩余质量（%）', 'mass remaining (%)'), h: 290, curfmt: (v) => `${v.toFixed(0)} °C` }, { x: [25, 1000], noy: true, series: [{ xs: c.xs, ys: dtg, c: 1 }], xl: L('温度（°C）', 'temperature (°C)'), yl: 'DTG (−dm/dT)', h: 140 }],
        out: p.lost.map((l, i) => [L(`第 ${i + 1} 步：失去 ${l}`, `Step ${i + 1}: loss of ${l}`), L(`失重 ${fix(left[i] - left[i + 1], 2)} %，剩 ${fix(left[i + 1], 2)} %（${chem(p.formulas[i + 1])}）`, `${fix(left[i] - left[i + 1], 2)} % lost, ${fix(left[i + 1], 2)} % left (${chem(p.formulas[i + 1])})`)]) };
    },
  });

  G.dsc = () => ({
    ctl: [ctl.range('xc', L('原有结晶度', 'Initial crystallinity'), 0, 40, 1, 0, (v) => `${v} %`)],
    draw: (s) => {
      const xc = s.xc / 100, xmax = Math.max(0.35, xc), rate = 10 / 60, dHm = xmax * 140, dHcc = (xmax - xc) * 140, xs = lin(30, 300, 900);
      const q = (T) => 0.05 + 0.0004 * (T - 30) + (0.058 * (1 - xc / 0.6)) / (1 + Math.exp(-(T - 78) / 2.2)) - dHcc * rate * area(T, 135, 6) + dHm * rate * area(T, 252, 5.5);
      return { plots: [{ x: [30, 300], series: [{ xs, ys: xs.map(q), c: 0 }], marks: [[78, 'T_g', q(84)], ...(dHcc > 1 ? [[135, L('冷结晶', 'cold crystallisation'), q(120)]] : []), [252, L('熔融', 'melting')]], xl: L('温度（°C，10 K/min）', 'temperature (°C, 10 K/min)'), yl: L('热流（W/g，吸热向上）', 'heat flow (W/g, endo up)'), h: 300, curfmt: (v) => `${v.toFixed(0)} °C` }],
        out: [[L('熔融焓', 'Enthalpy of fusion'), `${fix(dHm, 1)} J/g`], [L('冷结晶焓', 'Enthalpy of cold crystallisation'), `${fix(dHcc, 1)} J/g`], [L('原有结晶度', 'Initial crystallinity'), `(${fix(dHm, 1)} − ${fix(dHcc, 1)}) / 140 = ${fix((100 * (dHm - dHcc)) / 140, 0)} %`], [L('用到的参考值', 'Reference value used'), L('100 % 结晶的 PET 熔融焓取 140 J/g', 'enthalpy of fusion of 100 % crystalline PET taken as 140 J/g')]] };
    },
  });

  G.dma = () => ({
    ctl: [ctl.log('f', L('频率', 'Frequency'), 0.1, 100, 1, (v) => `${num(+v.toPrecision(2), 2)} Hz`)],
    draw: (s) => {
      const Eg = 3e9, Er = 3e6, al = 0.5, xs = lin(60, 200, 500), mod = (T, f) => { const tau = 100 * 10 ** ((-17.44 * (T - 100)) / (51.6 + T - 100)), r = (2 * Math.PI * f * tau) ** al, zr = r * Math.cos((al * Math.PI) / 2), zi = r * Math.sin((al * Math.PI) / 2), den = (1 + zr) ** 2 + zi * zi; return { e1: Er + ((Eg - Er) * (zr * (1 + zr) + zi * zi)) / den, e2: ((Eg - Er) * zi) / den }; };
      const cur = xs.map((T) => mod(T, s.f)), ref = xs.map((T) => mod(T, 1)), td = cur.map((m) => m.e2 / m.e1), Tp = xs[argmax(td)], Tl = xs[argmax(cur.map((m) => m.e2))];
      return { plots: [{ x: [60, 200], y: [1e6, 1e10], logy: true, series: [{ xs, ys: cur.map((m) => m.e1), c: 0, label: "E′" }, { xs, ys: cur.map((m) => m.e2), c: 1, label: "E″" }, { xs, ys: ref.map((m) => m.e1), c: 5, dash: true, label: L("1 Hz 时的 E′", "E′ at 1 Hz") }], xl: L('温度（°C）', 'temperature (°C)'), yl: L('模量（Pa）', 'modulus (Pa)'), h: 290 }, { x: [60, 200], series: [{ xs, ys: td, c: 3, label: 'tan δ' }], vlines: [{ x: Tp, label: `${fix(Tp, 1)} °C`, c: 3 }], xl: L('温度（°C）', 'temperature (°C)'), yl: 'tan δ', h: 170 }],
        out: [[L('tan δ 峰的温度', 'Temperature of the tan δ peak'), `${fix(Tp, 1)} °C`], [L("E″ 峰的温度", "Temperature of the E″ peak"), `${fix(Tl, 1)} °C`], [L('说明', 'Note'), L("同一个转变，按 E′ 的拐点、E″ 的峰还是 tan δ 的峰读，T_g 可以差十几度；报告时要写明用的是哪一个和频率。", "For one and the same transition, T_g read from the E′ onset, the E″ peak or the tan δ peak can differ by more than ten degrees; state which was used, and the frequency.")]] };
    },
  });

  G.tpd = () => ({
    ctl: [ctl.range('E', L('脱附活化能', 'Activation energy of desorption'), 60, 200, 1, 120, (v) => `${v} kJ/mol`), ctl.log('b', L('升温速率 β', 'Heating rate β'), 0.2, 50, 2, (v) => `${num(+v.toPrecision(2), 2)} K/s`)],
    draw: (s) => {
      const nu = 1e13, E = s.E * 1000, red = (() => { let T = 500; for (let i = 0; i < 60; i++) T = E / (R * Math.log((nu * T * T * R) / (s.b * E))); return T; })();
      const lo = Math.max(100, Math.round(red * 0.6)), hi = Math.round(red * 1.35), dT = (hi - lo) / 1400;
      const run = (th0, ord) => { const f = (T, th) => -(nu / s.b) * Math.max(th, 0) ** ord * Math.exp(-E / (R * T)), xs = [], ys = []; let th = th0; for (let T = lo; T <= hi; T += dT) { xs.push(T); ys.push(-f(T, th)); const k1 = f(T, th), k2 = f(T + dT / 2, th + (k1 * dT) / 2), k3 = f(T + dT / 2, th + (k2 * dT) / 2), k4 = f(T + dT, th + k3 * dT); th = Math.max(0, th + (dT * (k1 + 2 * k2 + 2 * k3 + k4)) / 6); } return { xs, ys }; };
      const cov = [0.25, 0.5, 0.75, 1], mk = (ord) => cov.map((c, i) => ({ ...run(c, ord), c: i, label: `θ₀ = ${c}` })), s1 = mk(1), s2 = mk(2), pk = (q) => q.xs[argmax(q.ys)];
      return { plots: [{ title: L('一级脱附（分子直接脱附）', 'First order (molecular desorption)'), x: [lo, hi], noy: true, series: s1, vlines: [{ x: red, label: `Redhead ${fix(red, 0)} K`, c: 5 }], xl: L('温度（K）', 'temperature (K)'), yl: L('脱附速率', 'desorption rate'), h: 240 }, { title: L('二级脱附（两个原子复合后脱附）', 'Second order (recombinative desorption)'), x: [lo, hi], noy: true, series: s2, xl: L('温度（K）', 'temperature (K)'), yl: L('脱附速率', 'desorption rate'), h: 240 }],
        out: [[L('一级的峰温（四个覆盖度）', 'First-order peak temperatures (four coverages)'), s1.map((q) => fix(pk(q), 0)).join(', ') + ' K'], [L('二级的峰温', 'Second-order peak temperatures'), s2.map((q) => fix(pk(q), 0)).join(', ') + ' K'], [L('Redhead 公式（一级）', 'Redhead equation (first order)'), `E/(R T_p²) = (ν/β) exp(−E/RT_p) → T_p = ${fix(red, 1)} K`]] };
    },
  });

  // ── X 射线与散射 ──────────────────────────────────────────────────────
  const ppCache = {};
  G.pxrd = (a) => {
    const ids = a.pick === 'all' ? Object.keys(M.CRYSTALS) : a.pick, defs = [{ ...ctl.select('cr', L('晶体', 'Crystal'), ids.map((k) => [k, `${M.CRYSTALS[k].name} · ${M.CRYSTALS[k].type}`]), ids[0]), apply: () => ({ sel: null }) }];
    if (a.wavelengths) defs.push({ ...ctl.select('wl', L('X 射线', 'Radiation'), Object.entries(M.WAVELENGTHS).map(([k, v]) => [k, `${k} · ${v} Å`]), 'Cu Kα1'), apply: () => ({ sel: null }) });
    defs.push(ctl.log('size', L('晶粒尺寸', 'Crystallite size'), 2, 500, 100, (v) => `${num(+v.toPrecision(2), 0)} nm`));
    return {
      ctl: defs,
      pick: (st, s, api) => api.set({ sel: st.data }),
      draw: (s) => {
        const wl = s.wl || 'Cu Kα1', lam = M.WAVELENGTHS[wl], cr = M.CRYSTALS[s.cr], pk = (ppCache[`${s.cr}|${wl}`] ||= M.powderPattern(cr, { lambda: lam, tmin: 8, tmax: 100 }));
        const xs = lin(8, 100, 2600), fw = (tt) => Math.hypot(M.scherrerWidth(s.size, tt, lam), 0.06), ys = new Array(xs.length).fill(0);
        for (const p of pk) { const w = fw(p.tt), amp = p.I * (fw(pk[0].tt) / w) ** 0 ; xs.forEach((x, i) => { if (Math.abs(x - p.tt) < 4 * w) ys[i] += (amp * 0.06 / w) * gauss(x, p.tt, w); }); }
        const top = Math.max(...ys) || 1, sel = pk.find((p) => p.d.toFixed(4) === s.sel) || pk.reduce((x, y) => (y.I > x.I ? y : x)), hk = (p) => `(${p.hkl.map((v) => (v < 0 ? `${-v}̅` : v)).join(p.hkl.some((v) => Math.abs(v) > 9) ? ' ' : '')})`;
        const sticks = pk.map((p) => ({ x: p.tt, y: 0, data: p.d.toFixed(4), tip: `${hk(p)} · 2θ ${p.tt.toFixed(2)}° · d ${p.d.toFixed(4)} Å · I ${fix(p.I, 1)}` }));
        const marks = pk.filter((p) => p.I > 4 || p === sel).slice(0, 24).map((p) => [p.tt, hk(p)]);
        return { plots: [{ x: [8, 100], y: [0, 125], series: [{ xs, ys: ys.map((y) => (100 * y) / top), c: 0 }], sticks, marks, vlines: [{ x: sel.tt, c: 3 }], xl: `2θ (°, ${wl})`, yl: L('相对强度', 'relative intensity'), h: 320, curfmt: (v) => `2θ ${v.toFixed(2)}°` }],
          out: [[L('选中的峰', 'Selected reflection'), `${hk(sel)} · 2θ = ${sel.tt.toFixed(3)}° · d = ${sel.d.toFixed(4)} Å · ${L('多重性', 'multiplicity')} ${sel.m} · I = ${fix(sel.I, 1)}`], [L('这个峰的 Scherrer 展宽', 'Scherrer broadening of this peak'), `${fix(M.scherrerWidth(s.size, sel.tt, lam), 3)}° (2θ)`], [L('晶胞', 'Unit cell'), `a = ${cr.cell.a} Å${cr.cell.c ? ` · c = ${cr.cell.c} Å` : ''} · ${L(`晶胞里 ${cr.atoms.length} 个原子`, `${cr.atoms.length} atoms per cell`)}`], [L('8°–100° 之间的衍射峰', 'Reflections between 8° and 100°'), `${pk.length}`]] };
      },
    };
  };

  G.fourier1d = () => ({
    ctl: [ctl.range('h', L('用到的最高衍射级次', 'Highest diffraction order used'), 1, 40, 1, 6, (v) => `${v}`)],
    draw: (s) => {
      const atoms = [[0.18, 6, 'C'], [0.31, 8, 'O'], [0.68, 17, 'Cl']], a = 10, xs = lin(0, 1, 600), Fh = [];
      for (let h = 0; h <= 40; h++) { let re = 0, im = 0; for (const [x, z] of atoms) { const f = z * Math.exp(-0.9 * (h / (2 * a)) ** 2 * 4); re += f * Math.cos(2 * Math.PI * h * x); im += f * Math.sin(2 * Math.PI * h * x); } Fh.push([re, im]); }
      const rho = xs.map((x) => { let v = Fh[0][0]; for (let h = 1; h <= s.h; h++) v += 2 * (Fh[h][0] * Math.cos(2 * Math.PI * h * x) + Fh[h][1] * Math.sin(2 * Math.PI * h * x)); return v / a; });
      return { plots: [{ x: [0, a], series: [{ xs: xs.map((x) => x * a), ys: rho, c: 0, fill: true }], vlines: atoms.map(([x, , el]) => ({ x: x * a, label: el, c: 1 })), zero: true, xl: L('沿晶胞的位置（Å）', 'position along the cell (Å)'), yl: L('电子密度（e/Å）', 'electron density (e/Å)'), h: 270 }, { x: [-0.5, 40.5], noy: true, sticks: Fh.map(([re, im], h) => ({ x: h, y: Math.hypot(re, im), c: h <= s.h ? 0 : 5, tip: `h = ${h} · |F| = ${fix(Math.hypot(re, im), 2)}` })), xl: L('衍射级次 h（绿色的用上了）', 'diffraction order h (green ones are used)'), yl: '|F(h)|', h: 150 }],
        out: [[L('分辨率 d_min = a / h_max', 'Resolution d_min = a / h_max'), `${fix(a / s.h, 2)} Å`], [L('碳和氧相距', 'Carbon–oxygen separation'), L(`1.30 Å：分辨率好于这个数它们才分得开`, `1.30 Å: they separate only once the resolution is better than this`)]] };
    },
  });

  G.xrf = (a) => ({
    ctl: [ctl.checks('on', L('元素', 'Elements'), a.pick.map((e) => [e, e]), a.on)],
    draw: (s) => {
      const lines = [];
      s.on.forEach((e, i) => { const z = ATLAS.XLINES[e]; if (z.ka && z.ka < 30) lines.push([z.ka, 1, `${e} Kα`, i], [z.kb, 0.15, `${e} Kβ`, i]); else lines.push([z.la, 1, `${e} Lα`, i], [z.lb, 0.7, `${e} Lβ`, i]); if (z.ka && z.ka < 30 && z.la && z.la > 1) lines.push([z.la, 0.25, `${e} Lα`, i]); });
      const xs = lin(1, 30, 2400), fw = (E) => Math.sqrt(130 ** 2 + 2330 * (E - 5.9)) / 1000, ys = xs.map((x) => lines.reduce((y, [E, h]) => { const w = fw(E); return Math.abs(x - E) < 4 * w ? y + h * (fw(5.9) / w) * gauss(x, E, w) : y; }, 0));
      return { plots: [{ x: [1, 30], y: [0, 1.5], noy: true, series: [{ xs, ys, c: 5 }], sticks: lines.filter((l) => l[0] >= 1).map(([E, h, label, i]) => ({ x: E, y: h * (fw(5.9) / fw(E)), c: i % 5, w: 0.8, label, tip: `${label} ${E.toFixed(3)} keV` })), xl: L('能量（keV）', 'energy (keV)'), yl: L('计数（示意）', 'counts (schematic)'), h: 290, curfmt: (v) => `${v.toFixed(2)} keV` }],
        out: s.on.map((e) => { const z = ATLAS.XLINES[e]; return [`${e} (Z = ${z.Z})`, [z.ka && `Kα ${z.ka}`, z.kb && `Kβ ${z.kb}`, z.la && `Lα ${z.la}`, z.lb && `Lβ ${z.lb}`].filter(Boolean).join(' · ') + ' keV']; }) };
    },
  });

  G.moseley = () => ({
    draw: () => {
      const els = Object.entries(ATLAS.XLINES).filter(([, z]) => z.ka).sort((p, q) => p[1].Z - q[1].Z), zs = lin(5, 60, 2);
      const worst = els.reduce((b, [e, z]) => { const d = (100 * (M.moseleyKa(z.Z) - z.ka)) / z.ka; return Math.abs(d) > Math.abs(b[1]) ? [e, d] : b; }, ['', 0]);
      return { plots: [{ x: [5, 60], y: [0, 6], pts: els.map(([e, z], i) => ({ x: z.Z, y: Math.sqrt(z.ka), c: 0, label: i % 3 === 0 ? e : '' })), series: [{ xs: zs, ys: zs.map((Z) => Math.sqrt(M.moseleyKa(Z))), c: 1, label: 'E = 10.2 eV × (Z − 1)²' }], xl: L('原子序数 Z', 'atomic number Z'), yl: '√E (keV¹ᐟ²)', h: 300 }],
        out: [[L('画了多少种元素', 'Elements plotted'), `${els.length}`], [L('偏离直线最多的', 'Largest deviation from the line'), `${worst[0]}: ${fix(worst[1], 1)} %`], [L('例', 'Example'), `Cu (Z = 29): 10.2 eV × 28² = ${fix(M.moseleyKa(29), 2)} keV · ${L('实测', 'measured')} ${ATLAS.XLINES.Cu.ka} keV`]] };
    },
  });

  G.exafs = () => ({
    ctl: [ctl.range('R1', L('第一层的距离 R₁', 'First-shell distance R₁'), 1.6, 2.8, 0.01, 2.0, (v) => `${fix(v, 2)} Å`), ctl.range('N1', L('配位数 N₁', 'Coordination number N₁'), 1, 12, 1, 6, (v) => `${v}`), ctl.range('s2', L('无序度 σ²', 'Disorder σ²'), 0.001, 0.02, 0.0005, 0.005, (v) => `${fix(v, 4)} Å²`), ctl.check('two', L('加上第二层近邻（3.05 Å，N = 6）', 'Add a second shell (3.05 Å, N = 6)'), false)],
    draw: (s) => {
      const shells = [[s.R1, s.N1, s.s2, 1], ...(s.two ? [[3.05, 6, s.s2 * 1.6, 1.4]] : [])], ks = lin(2, 14, 480), dk = ks[1] - ks[0];
      const chi = ks.map((k) => shells.reduce((y, [Rr, N, s2, amp]) => y + ((N * amp) / (k * Rr * Rr)) * Math.exp(-2 * s2 * k * k) * Math.exp((-2 * Rr) / 6) * Math.exp(-((k - 5) ** 2) / 60) * Math.sin(2 * k * Rr - 0.7 * k + 1.0), 0)), k2 = chi.map((c, i) => c * ks[i] ** 2);
      const Rs = lin(0, 6, 360), ft = Rs.map((Rr) => { let re = 0, im = 0; ks.forEach((k, i) => { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (ks.length - 1)); re += k2[i] * w * Math.cos(2 * k * Rr); im += k2[i] * w * Math.sin(2 * k * Rr); }); return (Math.hypot(re, im) * dk) / Math.sqrt(Math.PI); }), pkR = Rs[argmax(ft)];
      return { plots: [{ x: [2, 14], series: [{ xs: ks, ys: k2, c: 0 }], zero: true, xl: 'k (Å⁻¹)', yl: 'k²χ(k) (Å⁻²)', h: 240 }, { x: [0, 6], series: [{ xs: Rs, ys: ft, c: 1, fill: true }], vlines: shells.map(([Rr], i) => ({ x: Rr, label: L(`设定 R${K.sub(i + 1)}`, `set R${K.sub(i + 1)}`), c: 5 })), xl: L('R（Å，未做相移校正）', 'R (Å, not phase-corrected)'), yl: '|FT[k²χ(k)]|', h: 240 }],
        out: [[L('傅里叶变换的最高峰', 'Tallest peak of the Fourier transform'), `${fix(pkR, 2)} Å`], [L('比设定的距离短', 'Shorter than the set distance by'), `${fix(s.R1 - pkR, 2)} Å (${L('模型里相移的斜率是 −0.7，一半就是 0.35 Å', 'the model phase has a slope of −0.7; half of it is 0.35 Å')})`], [L('振荡的周期', 'Period of the oscillation'), `Δk ≈ π / R = ${fix(Math.PI / s.R1, 2)} Å⁻¹`]] };
    },
  });

  G.saxs = () => ({
    ctl: [ctl.log('R', L('球的半径', 'Sphere radius'), 1, 30, 5, (v) => `${num(+v.toPrecision(2), 1)} nm`), ctl.range('pd', L('多分散度（标准差 ÷ 平均半径）', 'Polydispersity (standard deviation ÷ mean radius)'), 0, 0.3, 0.01, 0.05, (v) => `${fix(100 * v, 0)} %`)],
    draw: (s) => {
      const qs = logs(0.02, 6, 500), n = s.pd > 0 ? 41 : 1, rs = n === 1 ? [s.R] : lin(Math.max(0.05, s.R * (1 - 3 * s.pd)), s.R * (1 + 3 * s.pd), n), ws = rs.map((r) => (n === 1 ? 1 : Math.exp(-((r - s.R) ** 2) / (2 * (s.pd * s.R) ** 2))) * r ** 6), wsum = ws.reduce((x, y) => x + y, 0);
      const I = qs.map((q) => rs.reduce((y, r, i) => y + ws[i] * M.sphereForm(q, r), 0) / wsum), Rg = Math.sqrt((0.6 * rs.reduce((y, r, i) => y + ws[i] * r * r, 0)) / wsum);
      return { plots: [{ x: [0.02, 6], y: [1e-7, 3], logx: true, logy: true, series: [{ xs: qs, ys: I, c: 0, label: L('球的形状因子', 'sphere form factor') }, { xs: qs, ys: qs.map((q) => M.guinier(q, Rg)), c: 1, dash: true, label: L('Guinier 近似', 'Guinier approximation') }, { xs: [1.5, 6], ys: [1.5, 6].map((q) => 4.5 / (q * s.R) ** 4), c: 5, dash: true, label: 'q⁻⁴ (Porod)' }], vlines: [{ x: 1.3 / Rg, label: 'q·R_g = 1.3', c: 5 }], xl: 'q (nm⁻¹)', yl: 'I(q) / I(0)', h: 320 }],
        out: [[L('回转半径 R_g', 'Radius of gyration R_g'), `${fix(Rg, 2)} nm${s.pd ? L('（按强度加权）', ' (intensity-weighted)') : ` = √(3/5) × ${num(+s.R.toPrecision(2), 1)} nm`}`], [L('第一个极小值', 'First minimum'), `q = 4.493 / R = ${fix(4.493 / s.R, 3)} nm⁻¹`], [L('Guinier 近似能用到', 'Guinier approximation holds up to'), `q < 1.3 / R_g = ${fix(1.3 / Rg, 3)} nm⁻¹`]] };
    },
  });

  G.eels = () => ({
    draw: () => {
      const xs = lin(-5, 340, 1400), f = (E) => 1e6 * Math.exp(-(E * E) / (2 * 0.45 ** 2)) + (2.2e4 * 8 ** 2) / ((E - 25) ** 2 + 8 ** 2) * (E > 0 ? 1 : 0) + (1.4e3 * 10 ** 2) / ((E - 50) ** 2 + 10 ** 2) * (E > 0 ? 1 : 0) + (E > 12 ? 2.5e8 * E ** -3.2 : 0) + (E > 283.5 ? 9 * (E / 284) ** -4 * (1 / (1 + Math.exp(-(E - 286) / 1.2))) + 14 * Math.exp(-((E - 285.4) ** 2) / (2 * 0.7 ** 2)) + 9 * Math.exp(-((E - 292.5) ** 2) / (2 * 3 ** 2)) : 0) + 0.02;
      return { plots: [{ x: [-5, 340], y: [0.5, 3e6], logy: true, noy: true, series: [{ xs, ys: xs.map(f), c: 0 }], marks: [[0, L('零损失峰', 'zero-loss peak'), 1e6], [25, L('等离激元', 'plasmon'), 3e4], [50, L('二次等离激元', 'double plasmon'), 2.5e3], [285.4, 'π*', 30], [292.5, 'σ*', 14]], vlines: [{ x: 284, label: L('C K 边 284 eV', 'C K edge, 284 eV'), c: 5 }], xl: L('能量损失（eV）', 'energy loss (eV)'), yl: L('强度（对数，示意）', 'intensity (log, schematic)'), h: 300, curfmt: (v) => `${v.toFixed(0)} eV` }] };
    },
  });

  // ── 其他方法 ──────────────────────────────────────────────────────────
  G.dls = () => ({
    ctl: [ctl.log('r', L('流体力学半径', 'Hydrodynamic radius'), 1, 1000, 50, (v) => `${num(+v.toPrecision(2), 0)} nm`), ctl.range('big', L('十倍大的颗粒占散射强度的比例', 'Share of scattered intensity from ten-fold larger particles'), 0, 60, 1, 0, (v) => `${v} %`)],
    draw: (s) => {
      const d1 = M.dls(s.r), d2 = M.dls(s.r * 10), f2 = s.big / 100, ts = logs(1e-7, 10, 400), g = (t) => ((1 - f2) * Math.exp(-d1.gamma * t) + f2 * Math.exp(-d2.gamma * t)) ** 2, gm = (1 - f2) * d1.gamma + f2 * d2.gamma;
      return { plots: [{ x: [1e-7, 10], y: [0, 1.08], logx: true, series: [{ xs: ts, ys: ts.map(g), c: 0, label: L('这个样品', 'this sample') }, ...(f2 ? [{ xs: ts, ys: ts.map((t) => Math.exp(-2 * d1.gamma * t)), c: 5, dash: true, label: L('只有小颗粒时', 'small particles only') }] : [])], vlines: [{ x: 1 / d1.gamma, label: '1/Γ', c: 1 }], xl: L('延迟时间 τ（s）', 'delay time τ (s)'), yl: 'g₂(τ) − 1', h: 290 }],
        out: [[L('扩散系数', 'Diffusion coefficient'), `${sci(d1.D, 2)} m²/s`], [L('衰减率 Γ = D q²', 'Decay rate Γ = D q²'), `${num(+d1.gamma.toPrecision(3), 3)} s⁻¹ (q = ${fix(d1.q / 1e9, 4)} nm⁻¹)`], [L('特征衰减时间 1/Γ', 'Characteristic decay time 1/Γ'), `${num(+(1e6 / d1.gamma).toPrecision(3), 3)} μs`], [L('按平均衰减率反算的半径（z 均）', 'Radius from the mean decay rate (z-average)'), `${num(+((s.r * d1.gamma) / gm).toPrecision(3), 3)} nm`]] };
    },
  });

  G.gamma = () => ({
    ctl: [ctl.seg('det', L('探测器', 'Detector'), [['both', L('两种对比', 'Compare both')], ['nai', L('碘化钠 NaI(Tl)', 'Sodium iodide NaI(Tl)')], ['ge', L('高纯锗 HPGe', 'High-purity germanium HPGe')]], 'both')],
    draw: (s) => {
      const E0 = 661.66, eps = E0 / 510.99895, cm = M.compton(E0), step = 0.5, grid = lin(0, 800, 1601), ideal = grid.map((T) => { if (T <= 1 || T >= cm.edge) return 0; const q = T / E0; return 2 + (q * q) / (eps * eps * (1 - q) ** 2) + (q / (1 - q)) * (q - 2 / eps); });
      const csum = ideal.reduce((x, y) => x + y, 0) * step; ideal.forEach((v, i) => { ideal[i] = (2.4 * v) / csum + 0.25 * area(grid[i], cm.backscatter, 14); });
      const lines = [[E0, 1], [32.2, 0.12]], fwhm = { nai: (E) => 0.07 * E0 * Math.sqrt(Math.max(E, 5) / E0), ge: (E) => 0.6 + 0.7 * Math.sqrt(Math.max(E, 5) / E0) };
      const spec = (det) => grid.map((x) => { const sd = fwhm[det](x) / 2.35482, span = Math.ceil((4 * sd) / step), i0 = Math.round(x / step); let y = 0; for (let j = Math.max(0, i0 - span); j <= Math.min(1600, i0 + span); j++) if (ideal[j]) y += ideal[j] * area(x, grid[j], sd) * step; for (const [E, w] of lines) y += w * area(x, E, fwhm[det](E) / 2.35482); return y + 2e-5; });
      const dets = s.det === 'both' ? ['nai', 'ge'] : [s.det], nm = { nai: 'NaI(Tl)', ge: 'HPGe' };
      return { plots: [{ x: [0, 800], y: [1e-4, 3], logy: true, noy: true, series: dets.map((d) => ({ xs: grid, ys: spec(d), c: d === 'nai' ? 1 : 0, label: nm[d] })), vlines: [{ x: cm.edge, label: L(`Compton 边 ${fix(cm.edge, 1)}`, `Compton edge ${fix(cm.edge, 1)}`), c: 5 }, { x: cm.backscatter, label: L(`反散射 ${fix(cm.backscatter, 1)}`, `backscatter ${fix(cm.backscatter, 1)}`), c: 5 }], marks: [[E0, L('全能峰 661.7', 'full-energy peak 661.7'), 1.2], [32.2, 'Ba Kα', 0.3]], xl: L('能量（keV）', 'energy (keV)'), yl: L('每 keV 的计数（对数，归一化）', 'counts per keV (log, normalised)'), h: 320, curfmt: (v) => `${v.toFixed(0)} keV` }],
        out: [[L('Compton 边', 'Compton edge'), `${fix(cm.edge, 1)} keV`], [L('反散射峰', 'Backscatter peak'), `${fix(cm.backscatter, 1)} keV`], [L('全能峰的半高宽', 'Width of the full-energy peak (FWHM)'), `NaI(Tl) ${fix(fwhm.nai(E0), 0)} keV · HPGe ${fix(fwhm.ge(E0), 1)} keV`]] };
    },
  });

  G.chn = (a) => ({
    ctl: [ctl.text('f', L('分子式', 'Formula'), a.formula, a.formula), ctl.range('w', L('每个分子带的结晶水', 'Water per formula unit'), 0, 3, 0.25, 0, (v) => `${fix(v, 2)} H₂O`), ctl.num('fc', L('实测 C（%）', 'Found C (%)'), null, 0.01, '49.48'), ctl.num('fh', L('实测 H（%）', 'Found H (%)'), null, 0.01, '5.19'), ctl.num('fn', L('实测 N（%）', 'Found N (%)'), null, 0.01, '28.85')],
    draw: (s) => {
      const f = { ...M.parseFormula(s.f || a.formula) }; f.H = (f.H || 0) + 2 * s.w; f.O = (f.O || 0) + s.w; if (!f.O) delete f.O;
      const mass = Object.entries(f).reduce((x, [e, n]) => x + TABLES.isotopes[e].m * n, 0), found = { C: s.fc, H: s.fh, N: s.fn }, order = ['C', 'H', 'N', ...Object.keys(f).filter((e) => !'CHN'.includes(e) || e.length > 1).filter((e) => !['C', 'H', 'N'].includes(e))].filter((e) => f[e]);
      const rows = order.map((e) => { const calc = (100 * TABLES.isotopes[e].m * f[e]) / mass, fd = found[e], d = fd == null || Number.isNaN(fd) ? null : fd - calc; return `<tr><th>${e}</th><td>${calc.toFixed(2)}</td><td>${d == null ? '' : fd.toFixed(2)}</td><td>${d == null ? '' : (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2)}</td><td>${d == null ? '' : Math.abs(d) <= 0.4 ? `<b class="sp-ok">${L('合格', 'within')}</b>` : `<b class="sp-bad">${L('超出', 'outside')}</b>`}</td></tr>`; });
      return { plots: [{ html: `<div class="sp-scroll"><table class="sp-table sp-mini"><thead><tr><th>${L('元素', 'Element')}</th><th>${L('理论值（%）', 'Calculated (%)')}</th><th>${L('实测值（%）', 'Found (%)')}</th><th>${L('差值', 'Difference')}</th><th>±0.4</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` }],
        out: [[L('摩尔质量', 'Molar mass'), `${mass.toFixed(3)} g/mol${s.w ? ` (${chem(s.f || a.formula)} · ${fix(s.w, 2)} H₂O)` : ''}`]] };
    },
  });

  G.bet = () => ({
    ctl: [ctl.log('c', L('BET 常数 c', 'BET constant c'), 2, 1000, 100, (v) => num(+v.toPrecision(2), 0)), ctl.range('vm', L('单层吸附量 v_m', 'Monolayer capacity v_m'), 5, 200, 1, 50, (v) => `${v} cm³/g`)],
    draw: (s) => {
      const v = (x) => (s.vm * s.c * x) / ((1 - x) * (1 + (s.c - 1) * x)), xs = lin(0.001, 0.92, 400), bx = lin(0.05, 0.3, 6), by = (x) => x / (v(x) * (1 - x)), xm = 1 / (1 + Math.sqrt(s.c));
      return { plots: [{ x: [0, 0.95], y: [0, s.vm * 6], series: [{ xs, ys: xs.map(v), c: 0 }], hlines: [{ y: s.vm, c: 1 }], pts: [{ x: xm, y: v(xm), c: 1, r: 4.5, label: L('单层铺满', 'monolayer complete') }], xl: L('相对压力 p/p₀', 'relative pressure p/p₀'), yl: L('吸附量（cm³/g，标准状况）', 'amount adsorbed (cm³/g STP)'), h: 270 }, { title: L('BET 图（p/p₀ = 0.05–0.30）', 'BET plot (p/p₀ = 0.05–0.30)'), x: [0, 0.35], y: [0, by(0.3) * 1.25], series: [{ xs: [0, 0.35], ys: [1 / (s.vm * s.c), 1 / (s.vm * s.c) + ((s.c - 1) / (s.vm * s.c)) * 0.35], c: 1 }], pts: bx.map((x) => ({ x, y: by(x), c: 0 })), xl: 'p/p₀', yl: '(p/p₀) / [v (1 − p/p₀)]', h: 220 }],
        out: [[L('斜率 / 截距', 'Slope / intercept'), `${num(+((s.c - 1) / (s.vm * s.c)).toPrecision(3), 5)} / ${num(+(1 / (s.vm * s.c)).toPrecision(3), 6)} g/cm³`], [L('比表面积', 'Specific surface area'), `${s.vm} × 4.353 = ${fix(s.vm * 4.353, 0)} m²/g (N₂, 0.162 nm²)`], [L('单层铺满时的相对压力', 'Relative pressure at monolayer completion'), `1 / (1 + √c) = ${fix(xm, 3)}`]] };
    },
  });

  G.itc = () => ({
    ctl: [ctl.log('kd', L('解离常数 K_d', 'Dissociation constant K_d'), 1e-9, 1e-4, 1e-6, (v) => (v < 1e-6 ? `${num(+(v * 1e9).toPrecision(2), 1)} nmol/L` : `${num(+(v * 1e6).toPrecision(2), 1)} μmol/L`)), ctl.range('dh', L('结合焓 ΔH', 'Binding enthalpy ΔH'), -80, -5, 1, -40, (v) => `${v} kJ/mol`)],
    draw: (s) => {
      const V0 = 200e-6, vi = 2e-6, P0 = 20e-6, Ls = 200e-6, pts = [], bound = (P, Lg) => (P + Lg + s.kd - Math.sqrt((P + Lg + s.kd) ** 2 - 4 * P * Lg)) / 2;
      let P = P0, Lt = 0, prev = 0;
      for (let i = 1; i <= 19; i++) { const dil = 1 - vi / V0; P *= dil; Lt = Lt * dil + (Ls * vi) / V0; const b = bound(P, Lt); pts.push({ x: Lt / P, y: (s.dh * V0 * (b - prev * dil)) / (Ls * vi), c: 0 }); prev = b; }
      const dG = (R * T0 * Math.log(s.kd)) / 1000;
      return { plots: [{ x: [0, 2.1], y: [s.dh * 1.1, -s.dh * 0.06], pts, series: [{ xs: pts.map((p) => p.x), ys: pts.map((p) => p.y), c: 0 }], vlines: [{ x: 1, label: 'n = 1', c: 5 }], zero: true, xl: L('摩尔比（配体 ÷ 蛋白）', 'molar ratio (ligand ÷ protein)'), yl: L('每摩尔注入物的热量（kJ/mol）', 'heat per mole of injectant (kJ/mol)'), h: 290 }],
        out: [[L('c 值 = 池内浓度 ÷ K_d', 'c value = cell concentration ÷ K_d'), `${num(+(P0 / s.kd).toPrecision(2), 2)} ${P0 / s.kd < 5 ? L('（太小，K_d 和 n 定不准）', '(too low: K_d and n are poorly determined)') : P0 / s.kd > 1000 ? L('（太大，只能给出 K_d 的上限）', '(too high: only an upper bound on K_d)') : L('（合适的范围 10–500）', '(inside the useful window of 10–500)')}`], ['ΔG = RT ln K_d', `${fix(dG, 1)} kJ/mol`], ['−TΔS = ΔG − ΔH', `${fix(dG - s.dh, 1)} kJ/mol`]] };
    },
  });

  G.spr = () => ({
    ctl: [ctl.log('ka', 'k_a', 1e4, 1e7, 1e5, (v) => `${sci(v, 1)} L mol⁻¹ s⁻¹`), ctl.log('kd', 'k_d', 1e-4, 1e-1, 1e-3, (v) => `${sci(v, 1)} s⁻¹`)],
    draw: (s) => {
      const KD = s.kd / s.ka, cs = [1.1, 3.3, 10, 30, 90], ts = lin(0, 300, 400);
      const series = cs.map((c, i) => { const C = c * 1e-9, req = (100 * C) / (C + KD), ko = s.ka * C + s.kd, r120 = req * (1 - Math.exp(-ko * 120)); return { xs: ts, ys: ts.map((t) => (t <= 120 ? req * (1 - Math.exp(-ko * t)) : r120 * Math.exp(-s.kd * (t - 120)))), c: i, label: `${c} nmol/L` }; });
      return { plots: [{ x: [0, 300], y: [0, 105], series, vlines: [{ x: 120, label: L('换成缓冲液', 'switch to buffer'), c: 5 }], xl: L('时间（s）', 'time (s)'), yl: L('响应（RU，R_max = 100）', 'response (RU, R_max = 100)'), h: 300 }],
        out: [['K_D = k_d / k_a', KD < 1e-6 ? `${num(+(KD * 1e9).toPrecision(3), 2)} nmol/L` : `${num(+(KD * 1e6).toPrecision(3), 2)} μmol/L`], [L('复合物的半衰期 ln 2 / k_d', 'Half-life of the complex, ln 2 / k_d'), `${num(+(Math.LN2 / s.kd).toPrecision(3), 1)} s`], [L('最高浓度下的平衡响应', 'Equilibrium response at the highest concentration'), `${fix((100 * 90e-9) / (90e-9 + KD), 1)} RU`]] };
    },
  });
})();
