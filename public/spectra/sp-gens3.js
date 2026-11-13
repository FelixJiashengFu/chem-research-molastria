'use strict';
// 谱图馆 · 交互演示（三）：大分子与高分子一族。数学在 sp-macro.js（纯函数），写法同 sp-gens.js。
(() => {
  const K = window.MOLASTRIA_SPECTRA_KIT, M = window.MOLASTRIA_SPECTRA_MODELS, X = window.MOLASTRIA_SPECTRA_MACRO, ATLAS = window.MOLASTRIA_SPECTRA_ATLAS, G = window.MOLASTRIA_SPECTRA_GENS;
  if (!K || !M || !X || !G || !ATLAS) return;
  const { L, esc, num, fix, chem, ctl, lin, logs, gauss } = K;
  const lor = (x, x0, fwhm) => 1 / (1 + (2 * (x - x0) / fwhm) ** 2);
  const sci = (v, d = 2) => { if (!v) return '0'; const e = Math.floor(Math.log10(Math.abs(v))), m = v / 10 ** e; return `${fix(m, d)} × 10${String(e).replace(/-/, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`; };
  const jitter = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }; // 固定的伪随机数，0–1
  const neg = (v) => num(-v, 4); // 二维核磁和凝胶的纵轴向下增大：画 −y，刻度写正数
  const svgT = (x, y, t, cls = 'sp-lbl sp-c5', anchor = 'middle', extra = '') => `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" ${extra}>${K.svgRich(t)}</text>`;

  // ── 冷冻电镜 ──────────────────────────────────────────────────────────
  G.ctf = () => ({
    ctl: [ctl.seg('kV', L('加速电压', 'Accelerating voltage'), [[200, '200 kV'], [300, '300 kV']], 300), ctl.range('df', L('欠焦量 Δf', 'Defocus Δf'), 0.3, 4, 0.05, 1.5, (v) => `${fix(v, 2)} μm`), ctl.range('B', L('包络 B 因子', 'Envelope B factor'), 0, 300, 5, 60, (v) => `${v} Å²`)],
    draw: (s) => {
      const o = { kV: +s.kV, df: s.df, cs: 2.7, ac: 0.07, B: s.B }, ks = lin(0.002, 0.5, 1600), zeros = X.ctfZeros(o, 5);
      return { plots: [{ x: [0, 0.5], y: [-1.1, 1.1], zero: true, series: [{ xs: ks, ys: ks.map((k) => X.ctf(k, o)), c: 0, label: 'CTF' }, { xs: ks, ys: ks.map((k) => Math.exp((-s.B * k * k) / 4)), c: 5, dash: true, label: L('包络', 'envelope') }],
        vlines: zeros.slice(0, 3).map((k, i) => ({ x: k, c: 1, label: i ? '' : L(`第一个零点 ${fix(1 / k, 1)} Å`, `first zero ${fix(1 / k, 1)} Å`) })), xl: L('空间频率 k（Å⁻¹）', 'spatial frequency k (Å⁻¹)'), yl: L('衬度传递', 'contrast transfer'), h: 280, curfmt: (v) => `${v.toFixed(3)} Å⁻¹ · ${fix(1 / v, 2)} Å` }],
        out: [[L('电子波长', 'Electron wavelength'), `${fix(X.electronWavelength(+s.kV), 4)} pm`], [L('前几个零点对应的分辨率', 'Resolution of the first zeros'), zeros.map((k) => `${fix(1 / k, 1)} Å`).join(' · ')], [L('包络降到 1/e 处', 'Envelope falls to 1/e at'), s.B ? `k = 2/√B = ${fix(2 / Math.sqrt(s.B), 3)} Å⁻¹ (${fix(Math.sqrt(s.B) / 2, 2)} Å)` : L('不衰减', 'no decay')]] };
    },
  });

  // ── 电子显微镜与能谱 ──────────────────────────────────────────────────
  const LIGHT = { C: { Z: 6, ka: 0.277 }, N: { Z: 7, ka: 0.392 }, O: { Z: 8, ka: 0.525 } };
  const EDS_SAMPLES = [
    { id: 'steel', name: L('304 不锈钢', '304 stainless steel'), w: { Fe: 70, Cr: 18.5, Ni: 9, Mn: 1.5, Si: 0.7 } },
    { id: 'mos2', name: L('二硫化钼 MoS₂（S Kα 和 Mo Lα 重叠）', 'Molybdenum disulfide MoS₂ (S Kα overlaps Mo Lα)'), w: { Mo: 60, S: 40 } },
    { id: 'glass', name: L('钠钙玻璃', 'Soda-lime glass'), w: { O: 46, Si: 34, Na: 10, Ca: 7, Mg: 2, Al: 1 } },
    { id: 'brass', name: L('黄铜（Cu Kβ 和 Zn Kα 相邻）', 'Brass (Cu Kβ next to Zn Kα)'), w: { Cu: 65, Zn: 35 } },
  ];
  G.eds = () => ({
    ctl: [ctl.select('smp', L('样品', 'Sample'), EDS_SAMPLES.map((x) => [x.id, x.name]), 'steel'), ctl.seg('det', L('谱仪', 'Spectrometer'), [['eds', L('能量色散 EDS（129 eV）', 'Energy-dispersive EDS (129 eV)')], ['wds', L('波长色散 WDS（约 10 eV）', 'Wavelength-dispersive WDS (about 10 eV)')]], 'eds')],
    draw: (s) => {
      const smp = EDS_SAMPLES.find((x) => x.id === s.smp) || EDS_SAMPLES[0], E0 = 20, step = 0.002, xs = lin(0.1, 10.5, Math.round(10.4 / step) + 1);
      const lines = [];
      for (const [el, w] of Object.entries(smp.w)) {
        const z = ATLAS.XLINES[el] || LIGHT[el];
        const kfac = (Ec) => (E0 > Ec ? (E0 / Ec - 1) ** 1.67 / (E0 / Ec) : 0) * (Ec < 1 ? 0.35 : 1); // 过压比和轻元素的低荧光产额（示意）
        if (z.ka) { const f = w * kfac(z.ka * 1.1); lines.push({ el, t: 'Kα', E: z.ka, a: f }); if (z.kb) lines.push({ el, t: 'Kβ', E: z.kb, a: f * (z.Z < 22 ? 0.06 : 0.13) }); }
        if (z.la && z.la > 0.2) { const f = w * 0.55 * kfac(z.la * 1.15); lines.push({ el, t: 'Lα', E: z.la, a: f }); if (z.lb) lines.push({ el, t: 'Lβ', E: z.lb, a: f * 0.5 }); }
      }
      const fw = (E) => (s.det === 'wds' ? 10 : X.edsFwhm(E)) / 1000, Zbar = Object.entries(smp.w).reduce((a, [el, w]) => a + w * (ATLAS.XLINES[el] || LIGHT[el]).Z, 0) / 100;
      const cont = (E) => 0.012 * Zbar * Math.max(E0 - E, 0) / E * Math.exp(-((0.65 / E) ** 3)); // Kramers 加上探测器窗口在低能的吸收（示意）
      const ys = xs.map((E) => cont(E) + lines.reduce((y, l) => y + l.a * gauss(E, l.E, fw(l.E)) * (0.129 / fw(l.E)) * 0.02, 0));
      const top = Math.max(...ys), marks = lines.filter((l) => l.a > 0.4 && l.t !== 'Lβ').map((l) => [l.E, `${l.el} ${l.t}`, null]);
      return { plots: [{ x: [0.1, 10.5], y: [0, 1.25], noy: true, series: [{ xs, ys: ys.map((y) => y / top), c: 0, fill: true }], marks: marks.map(([x, t]) => [x, t]), xl: L('X 射线能量（keV）', 'X-ray energy (keV)'), yl: L('计数（归一化，示意）', 'counts (normalised, schematic)'), h: 300, curfmt: (v) => `${v.toFixed(3)} keV` }],
        out: [[L('峰宽（半高宽）', 'Peak width (FWHM)'), s.det === 'wds' ? L('约 10 eV（各能量相近）', 'about 10 eV (similar at all energies)') : `O Kα ${fix(X.edsFwhm(0.525), 0)} · Si Kα ${fix(X.edsFwhm(1.74), 0)} · Mn Kα ${fix(X.edsFwhm(5.895), 0)} · Cu Kα ${fix(X.edsFwhm(8.048), 0)} eV`],
          [L('最难分开的一对', 'Hardest pair to separate'), ({ steel: L('Mn Kβ 6.490 和 Fe Kα 6.404：差 86 eV', 'Mn Kβ 6.490 and Fe Kα 6.404: 86 eV apart'), mos2: L('S Kα 2.308 和 Mo Lα 2.293：差 15 eV，EDS 分不开', 'S Kα 2.308 and Mo Lα 2.293: 15 eV apart, unresolved by EDS'), glass: L('Na Kα 1.041 和 Mg Kα 1.254 之间还清楚', 'Na Kα 1.041 and Mg Kα 1.254 are still distinct'), brass: L('Cu Kβ 8.905 和 Zn Kα 8.639：差 266 eV', 'Cu Kβ 8.905 and Zn Kα 8.639: 266 eV apart') })[smp.id]],
          [L('加速电压', 'Accelerating voltage'), `${E0} kV`]] };
    },
  });
  G.ewave = () => ({
    draw: () => {
      const kv = logs(1, 1000, 300);
      return { plots: [{ x: [1, 1000], logx: true, logy: true, y: [0.5, 50], series: [{ xs: kv, ys: kv.map((v) => X.electronWavelength(v)), c: 0, label: L('含相对论修正', 'relativistic') }, { xs: kv, ys: kv.map((v) => X.electronWavelength(v, false)), c: 5, dash: true, label: L('不修正', 'non-relativistic') }],
        pts: [10, 100, 200, 300].map((v) => ({ x: v, y: X.electronWavelength(v), c: 0, label: v === 200 ? undefined : `${v} kV: ${fix(X.electronWavelength(v), 2)} pm` })), xl: L('加速电压（kV）', 'accelerating voltage (kV)'), yl: L('波长（pm）', 'wavelength (pm)'), h: 260 }],
        out: [10, 100, 200, 300].map((v) => [`${v} kV`, `${fix(X.electronWavelength(v), 3)} pm · ${L('不修正', 'non-relativistic')} ${fix(X.electronWavelength(v, false), 3)} pm`]) };
    },
  });

  // ── 蛋白质核磁：三共振条带 ────────────────────────────────────────────
  G.strips = () => ({
    ctl: [ctl.text('seq', L('序列（单字母）', 'Sequence (one-letter)'), 'KGASTLEV', 'KGASTLEV'), ctl.seg('sec', L('二级结构', 'Secondary structure'), [['c', L('无规卷曲', 'Random coil')], ['h', L('α 螺旋', 'α-Helix')], ['e', L('β 折叠', 'β-Strand')]], 'c')],
    draw: (s) => {
      const seq = String(s.seq || 'KGASTLEV').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 14), st = X.strips(seq, s.sec.repeat(seq.length)), n = st.length;
      if (!n) return { out: [[L('序列', 'Sequence'), L('至少要两个残基', 'At least two residues are needed')]] };
      const mk = (withOwn) => ({ x: [0.4, n + 0.6], y: [10, 75], xticks: st.map((_, i) => i + 1), xfmt: (v) => { const r = st[Math.round(v) - 1]; return r ? `${r.res}${r.i}` : ''; }, yfmt: (v) => num(v, 0),
        pts: st.flatMap((r, i) => [...(withOwn ? [{ x: i + 1 - 0.12, y: r.own[0], c: 0, r: 4.2 }, ...(r.own[1] != null ? [{ x: i + 1 - 0.12, y: r.own[1], c: 3, r: 4.2, open: true }] : [])] : []), { x: i + 1 + (withOwn ? 0.12 : 0), y: r.prev[0], c: 0, r: withOwn ? 2.6 : 4.2 }, ...(r.prev[1] != null ? [{ x: i + 1 + (withOwn ? 0.12 : 0), y: r.prev[1], c: 3, r: withOwn ? 2.6 : 4.2, open: true }] : [])]),
        extra: (sx, sy) => { let g = ''; for (let i = 0; i < n; i++) g += `<rect class="sp-band sp-c5" opacity=".07" x="${(sx(i + 0.62)).toFixed(1)}" y="${sy(75)}" width="${(sx(i + 1.38) - sx(i + 0.62)).toFixed(1)}" height="${(sy(10) - sy(75)).toFixed(1)}"/>`;
          if (withOwn) for (let i = 1; i < n; i++) if (st[i].i === st[i - 1].i + 1) for (const k of [0, 1]) { const y = st[i].prev[k]; if (y == null) continue; g += `<line class="sp-vl sp-c1" stroke-dasharray="4 3" x1="${sx(i - 0.12 + 0).toFixed(1)}" x2="${sx(i + 1 + 0.12).toFixed(1)}" y1="${sy(y).toFixed(1)}" y2="${sy(y).toFixed(1)}"/>`; }
          return g; },
        xl: L('每个残基 N–H 的条带', 'strip at each residue’s N–H'), yl: L('¹³C 化学位移（ppm）', '¹³C chemical shift (ppm)'), h: 300, title: withOwn ? 'HNCACB (CBCANH)' : 'CBCA(CO)NH' });
      return { plots: [mk(true), mk(false)],
        out: [[L('条带数', 'Strips'), L(`${n} 条（N 端第一个残基和脯氨酸没有）`, `${n} (none for the first residue or for prolines)`)], ...st.slice(0, 8).map((r) => [`${r.res}${r.i}`, `${L('自己', 'own')} Cα ${fix(r.own[0], 1)}${r.own[1] != null ? ` / Cβ ${fix(r.own[1], 1)}` : ' / –'} · ${L('前一个', 'previous')} (${r.prevRes}) Cα ${fix(r.prev[0], 1)}${r.prev[1] != null ? ` / Cβ ${fix(r.prev[1], 1)}` : ' / –'}`])],
        note: L('实心：Cα；空心：Cβ。上图大的点是自己的，小的点是前一个残基的；虚线就是顺序行走。', 'Filled: Cα; open: Cβ. In the top panel large marks are the residue’s own and small ones the previous residue’s; the dashed lines are the sequential walk.') };
    },
  });

  // ── 二维核磁 ──────────────────────────────────────────────────────────
  const EA = { h: { a: 2.05, b: 4.12, c: 1.26 }, c: { co: 171.1, b: 60.4, a: 21.0, c: 14.2 } };
  G.nmr2d = () => ({
    ctl: [ctl.seg('x', L('实验', 'Experiment'), [['cosy', 'COSY'], ['hsqc', 'HSQC'], ['hmbc', 'HMBC']], 'cosy')],
    draw: (s) => {
      const H = EA.h, C = EA.c, homo = s.x === 'cosy';
      const peaks = homo ? [[H.a, H.a, 1, ''], [H.b, H.b, 1, ''], [H.c, H.c, 1, ''], [H.b, H.c, 0.8, 'CH₂–CH₃'], [H.c, H.b, 0.8, '']]
        : s.x === 'hsqc' ? [[H.b, C.b, 1, 'OCH₂ / 60.4'], [H.a, C.a, 1, 'CH₃CO / 21.0'], [H.c, C.c, 1, 'CH₃ / 14.2']]
          : [[H.a, C.co, 1, '²J: CH₃ → C=O'], [H.b, C.co, 0.8, '³J: OCH₂ → C=O'], [H.b, C.c, 0.7, '²J'], [H.c, C.b, 0.7, '²J']];
      const yr = homo ? [-4.6, -0.7] : s.x === 'hsqc' ? [-70, 0] : [-185, 0];
      const extra = (sx, sy) => {
        let g = homo ? `<line class="sp-vl sp-c5" stroke-dasharray="5 4" x1="${sx(4.6)}" y1="${sy(-4.6)}" x2="${sx(0.7)}" y2="${sy(-0.7)}"/>` : '';
        for (const [x, y, a] of peaks) for (const k of [1, 0.62, 0.3]) g += `<ellipse class="sp-line sp-c0" opacity="${(0.3 + 0.7 * a).toFixed(2)}" cx="${sx(x).toFixed(1)}" cy="${sy(-y).toFixed(1)}" rx="${(9 * k).toFixed(1)}" ry="${(homo ? 9 : 7) * k}"/>`;
        for (const [x, y, , t] of peaks) if (t) g += svgT(sx(x) + 13, sy(-y) - 9, t, 'sp-lbl sp-c1', 'start');
        return g;
      };
      const proj = [[H.b, 'OCH₂ 4.12 (q)'], [H.a, 'CH₃CO 2.05 (s)'], [H.c, 'CH₃ 1.26 (t)']];
      return { plots: [{ x: [0.7, 4.6], rev: true, y: yr, yfmt: neg, xl: L('¹H 化学位移（ppm）', '¹H chemical shift (ppm)'), yl: homo ? L('¹H 化学位移（ppm）', '¹H chemical shift (ppm)') : L('¹³C 化学位移（ppm）', '¹³C chemical shift (ppm)'), h: 380, extra }],
        out: [[L('¹H 一维', '¹H (1D)'), proj.map((p) => p[1]).join(' · ')], [L('¹³C', '¹³C'), 'C=O 171.1 · OCH₂ 60.4 · CH₃CO 21.0 · CH₃ 14.2'], [L('这张图说明什么', 'What it shows'), ({ cosy: L('只有乙基的 CH₂ 和 CH₃ 之间有交叉峰：乙酰基的甲基是孤立的单峰，和别的氢没有可见的耦合。', 'Only the ethyl CH₂ and CH₃ give a cross peak: the acetyl methyl is an isolated singlet with no visible coupling to other hydrogens.'), hsqc: L('每组氢放到它直接连着的碳上；没有氢的羰基碳在 HSQC 里看不到。', 'Each hydrogen group sits on its directly bonded carbon; the carbonyl carbon carries no hydrogen and is invisible in HSQC.'), hmbc: L('乙酰基甲基（²J）和 OCH₂（³J，穿过酯氧）都连到 171 ppm 的羰基：两个片段在酯基处接在一起。', 'The acetyl methyl (²J) and the OCH₂ (³J, through the ester oxygen) both reach the carbonyl at 171 ppm: the two fragments join at the ester.') })[s.x]]] };
    },
  });

  // ── 糖：Karplus 与异头区 ──────────────────────────────────────────────
  G.karplus = () => ({
    ctl: [ctl.range('a', L('α 异头物的比例', 'Fraction of α anomer'), 0, 100, 1, 36, (v) => `${v} %`), ctl.seg('mhz', L('谱仪频率', 'Spectrometer frequency'), [[400, '400 MHz'], [600, '600 MHz']], 600)],
    draw: (s) => {
      const ph = lin(0, 180, 361), mhz = +s.mhz, fw = 1.2 / mhz, xs = lin(4.4, 5.45, 2400), a = s.a / 100;
      const dbl = (d, J, w) => xs.map((x) => w * (lor(x, d - J / (2 * mhz), fw) + lor(x, d + J / (2 * mhz), fw)));
      const al = dbl(5.22, 3.7, a), be = dbl(4.64, 8.0, 1 - a), sum = al.map((v, i) => v + be[i]), top = Math.max(...sum, 1e-9);
      return { plots: [{ x: [0, 180], y: [-1, 10.5], zero: true, series: [{ xs: ph, ys: ph.map(X.karplus), c: 0, label: L('Karplus 1959', 'Karplus 1959') }], pts: [{ x: 60, y: X.karplus(60), c: 1, label: L(`直立–平伏 60°：${fix(X.karplus(60), 1)} Hz`, `axial–equatorial 60°: ${fix(X.karplus(60), 1)} Hz`) }, { x: 180, y: X.karplus(180), c: 3, label: L(`直立–直立 180°：${fix(X.karplus(180), 1)} Hz`, `axial–axial 180°: ${fix(X.karplus(180), 1)} Hz`) }], xl: L('二面角 φ（度）', 'dihedral angle φ (degrees)'), yl: '³J(H,H) (Hz)', h: 250, xticks: [0, 30, 60, 90, 120, 150, 180] },
        { x: [4.4, 5.45], rev: true, y: [0, 1.3], noy: true, series: [{ xs, ys: sum.map((y) => y / top), c: 0 }], marks: [[5.22, L(`α-H1 5.22，J 3.7 Hz`, `α-H1 5.22, J 3.7 Hz`)], [4.64, L(`β-H1 4.64，J 8.0 Hz`, `β-H1 4.64, J 8.0 Hz`)]], xl: L('化学位移 δ（ppm）', 'chemical shift δ (ppm)'), h: 230, curfmt: (v) => `${v.toFixed(3)} ppm` }],
        out: [[L('α : β（面积比）', 'α : β (area ratio)'), `${s.a} : ${100 - s.a}`], [L('裂分（ppm）', 'Splitting (ppm)'), `α ${fix(3.7 / mhz, 4)} · β ${fix(8.0 / mhz, 4)} ppm @ ${mhz} MHz`], [L('判断', 'Reading'), L('³J 约 8 Hz：H-1 和 H-2 都在直立键上，β；约 3.5 Hz：H-1 平伏，α（葡萄糖型的糖）。', '³J about 8 Hz: H-1 and H-2 both axial, β; about 3.5 Hz: H-1 equatorial, α (gluco-type sugars).')]] };
    },
  });

  // ── ³¹P：肌肉谱和细胞内 pH ───────────────────────────────────────────
  G.p31 = () => ({
    ctl: [ctl.range('pH', L('细胞内 pH', 'Intracellular pH'), 6.0, 7.6, 0.01, 7.05, (v) => fix(v, 2)), ctl.range('e', L('疲劳程度（PCr 转成 Pi）', 'Fatigue (PCr converted to Pi)'), 0, 1, 0.01, 0, (v) => `${Math.round(v * 100)} %`)],
    draw: (s) => {
      const r = 10 ** (s.pH - 6.75), dPi = (3.27 + r * 5.69) / (1 + r), J = 19 / 202.4, fw = 0.14, xs = lin(-20, 8, 3000);
      const pk = [[dPi, [[0, 1]], 0.7 + 2.3 * s.e, 'Pi'], [0, [[0, 1]], 3.0 * (1 - 0.75 * s.e), 'PCr'], [-2.5, [[-J / 2, 0.5], [J / 2, 0.5]], 1 - 0.15 * s.e, 'γ-ATP'], [-7.5, [[-J / 2, 0.5], [J / 2, 0.5]], 1 - 0.15 * s.e, 'α-ATP'], [-16.0, [[-J, 0.25], [0, 0.5], [J, 0.25]], 1 - 0.15 * s.e, 'β-ATP']];
      const ys = xs.map((x) => pk.reduce((y, [d, ms, a]) => y + a * ms.reduce((t, [o, w]) => t + w * lor(x, d + o, fw), 0), 0)), top = Math.max(...ys);
      return { plots: [{ x: [-20, 8], rev: true, y: [0, 1.3], noy: true, series: [{ xs, ys: ys.map((y) => y / top), c: 0 }], marks: pk.map(([d, , , t]) => [d, t]), xl: L('化学位移（ppm，以 PCr 为 0）', 'chemical shift (ppm, PCr = 0)'), h: 280, curfmt: (v) => `${v.toFixed(2)} ppm` }],
        out: [[L('无机磷酸 Pi 的位置', 'Position of Pi'), `${fix(dPi, 3)} ppm`], [L('由 Pi 反算的 pH', 'pH from Pi'), `pH = 6.75 + log[(${fix(dPi, 2)} − 3.27)/(5.69 − ${fix(dPi, 2)})] = ${fix(s.pH, 2)}`], [L('PCr / Pi（峰面积比）', 'PCr / Pi (area ratio)'), fix((3.0 * (1 - 0.75 * s.e)) / (0.7 + 2.3 * s.e), 2)], [L('ATP 的 ²J(P,P)', '²J(P,P) of ATP'), L('19 Hz，在 202 MHz（11.7 T）下是 0.094 ppm', '19 Hz, i.e. 0.094 ppm at 202 MHz (11.7 T)')]] };
    },
  });

  // ── 桑格测序 ──────────────────────────────────────────────────────────
  const BASE_COLOR = { A: '#2e9d4a', C: '#2f6fd6', G: 'var(--ink)', T: '#d23c3c' }, COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };
  G.sanger = () => ({
    ctl: [ctl.text('t', L('模板链（3′→5′，A/C/G/T）', 'Template strand (3′→5′, A/C/G/T)'), 'TACCGATCGTTTCCTCTTCTTGAAAAGTGACCTCAACAGGGTTAAGAACAACTTAATC', 'TACCGATCG…'), ctl.range('from', L('从第几个碱基看起', 'Start at base'), 1, 200, 1, 1, (v) => `${v}`)],
    draw: (s) => {
      const tpl = String(s.t || '').toUpperCase().replace(/[^ACGT]/g, '').slice(0, 240);
      if (tpl.length < 5) return { out: [[L('模板', 'Template'), L('至少输入五个碱基', 'Enter at least five bases')]] };
      const read = [...tpl].map((b) => COMP[b]).join(''), n = read.length, from = Math.max(1, Math.min(s.from, Math.max(1, n - 10))), to = Math.min(n + 0.8, from + 40);
      const peaks = [...read].map((b, i) => ({ b, x: i + 1, w: 0.17 + 0.0015 * i, h: (0.45 + 0.55 * jitter(i + 3)) * (i < 3 ? 0.6 : 1) * Math.exp(-i / 600) }));
      const xs = lin(from - 0.5, to, Math.round((to - from + 0.5) * 30));
      const trace = (b) => xs.map((x) => peaks.reduce((y, p) => (p.b === b && Math.abs(x - p.x) < 1.2 ? y + p.h * Math.exp(-((x - p.x) ** 2) / (2 * p.w * p.w)) : y), 0));
      const tr = Object.fromEntries('ACGT'.split('').map((b) => [b, trace(b)]));
      const extra = (sx, sy) => {
        let g = '';
        for (const b of 'ACGT') { let d = ''; xs.forEach((x, i) => { d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(tr[b][i]).toFixed(1)}`; }); g += `<path d="${d}" fill="none" stroke-width="1.6" style="stroke:${BASE_COLOR[b]}"/>`; }
        for (const p of peaks) if (p.x >= from - 0.4 && p.x <= to) g += `<text class="sp-lbl" x="${sx(p.x).toFixed(1)}" y="${(sy(1.12)).toFixed(1)}" text-anchor="middle" style="fill:${BASE_COLOR[p.b]}">${p.b}</text>`;
        return g;
      };
      return { plots: [{ x: [from - 0.5, to], y: [0, 1.2], noy: true, extra, xl: L('碱基位置（从引物算起）', 'base position (from the primer)'), yl: L('荧光', 'fluorescence'), h: 250 }],
        note: L('A 绿、C 蓝、G 黑（深色主题里是浅色）、T 红。', 'A green, C blue, G black (light in the dark theme), T red.'),
        out: [[L('读出的序列（新合成链 5′→3′）', 'Read (new strand, 5′→3′)'), { html: `<code translate="no">${esc(read)}</code>` }], [L('模板（3′→5′）', 'Template (3′→5′)'), { html: `<code translate="no">${esc(tpl)}</code>` }], [L('长度', 'Length'), L(`${n} 个碱基`, `${n} bases`)]] };
    },
  });

  // ── 纤维衍射 ──────────────────────────────────────────────────────────
  G.helix = () => ({
    ctl: [ctl.seg('off', L('两条链沿轴错开', 'Axial offset of the two strands'), [['0.375', '3/8 (B-DNA)'], ['0.5', '1/2'], ['single', L('只有一条链', 'one strand')]], '0.375'), ctl.range('P', L('螺距 P', 'Pitch P'), 24, 44, 0.5, 34, (v) => `${fix(v, 1)} Å`), ctl.range('r', L('半径 r', 'Radius r'), 5, 12, 0.5, 10, (v) => `${fix(v, 1)} Å`)],
    draw: (s) => {
      const o = { r: s.r, u: 10, offset: s.off === 'single' ? null : +s.off }, P = s.P, h = P / 10, Zmax = 1.12 / h, Rmax = 0.3, ls = [];
      for (let l = 0; l * (1 / P) <= Zmax; l++) ls.push(l);
      const cells = [], Rs = lin(-Rmax, Rmax, 121);
      let top = 0;
      for (const l of ls) { const half = new Map(); for (const R of Rs) { const key = Math.abs(R).toFixed(6); if (!half.has(key)) half.set(key, l === 0 && Math.abs(R) < 0.012 ? 0 : X.helixIntensity(l, R, o)); const I = half.get(key); if (I > top) top = I; cells.push([l, R, I]); } }
      const missing = ls.filter((l) => l && l < 10 && o.offset != null && Math.cos(Math.PI * l * o.offset) ** 2 < 1e-6);
      const extra = (sx, sy) => {
        const dw = Math.abs(sx(Rs[1]) - sx(Rs[0])) + 0.6, dh = 4.2;
        let g = `<rect x="${sx(-Rmax).toFixed(1)}" y="${sy(Zmax).toFixed(1)}" width="${(sx(Rmax) - sx(-Rmax)).toFixed(1)}" height="${(sy(-Zmax) - sy(Zmax)).toFixed(1)}" style="fill:var(--paper)"/>`;
        for (const [l, R, I] of cells) { const v = Math.sqrt(I / top); if (v < 0.04) continue; for (const z of l ? [l / P, -l / P] : [0]) g += `<rect x="${(sx(R) - dw / 2).toFixed(1)}" y="${(sy(z) - dh / 2).toFixed(1)}" width="${dw.toFixed(1)}" height="${dh}" style="fill:var(--ink)" opacity="${Math.min(1, v).toFixed(2)}"/>`; }
        return g;
      };
      const angle = (Math.atan(P / (2 * Math.PI * s.r)) * 180) / Math.PI;
      return { plots: [{ x: [-Rmax, Rmax], y: [-Zmax, Zmax], extra, xl: L('R：垂直于纤维轴（Å⁻¹，赤道方向）', 'R: perpendicular to the fibre axis (Å⁻¹, equatorial)'), yl: L('Z：沿纤维轴（Å⁻¹，子午线）', 'Z: along the fibre axis (Å⁻¹, meridional)'), h: 420, yfmt: (v) => fix(v, 2), xfmt: (v) => fix(v, 2) }],
        out: [[L('层线间距 1/P', 'Layer-line spacing 1/P'), `${fix(1 / P, 4)} Å⁻¹ (P = ${fix(P, 1)} Å)`], [L('子午线上的强反射', 'Strong meridional reflection'), L(`第 10 层线，1/h，h = ${fix(h, 2)} Å（碱基堆积）`, `layer line 10, 1/h, h = ${fix(h, 2)} Å (base stacking)`)], [L('消失的层线（l < 10）', 'Missing layer lines (l < 10)'), missing.length ? missing.join(', ') : L('没有', 'none')], [L('螺旋倾角 tan⁻¹(P / 2πr)', 'Pitch angle tan⁻¹(P / 2πr)'), `${fix(angle, 1)}°`]] };
    },
  });

  // ── 凝胶电泳 ──────────────────────────────────────────────────────────
  const LADDER = [250, 150, 100, 75, 50, 37, 25, 20, 15, 10];
  G.gel = () => ({
    ctl: [ctl.range('rf', L('未知样品的 Rf', 'Rf of the unknown'), 0.02, 0.98, 0.005, 0.52, (v) => fix(v, 3))],
    draw: (s) => {
      const ladder = LADDER.map((m, i) => ({ m, rf: (Math.log10(300) - Math.log10(m)) / 1.62 + 0.012 * (jitter(i + 11) - 0.5) }));
      const cal = X.gelCalibration(ladder), Mu = cal.mass(s.rf), lo = Math.min(...ladder.map((l) => l.rf)), hi = Math.max(...ladder.map((l) => l.rf)), out = s.rf < lo || s.rf > hi;
      const band = (sx, sy, lane, rf, t, cls = 'sp-c0') => `<rect class="sp-band ${cls}" x="${sx(lane - 0.32).toFixed(1)}" y="${(sy(-rf) - 3).toFixed(1)}" width="${(sx(lane + 0.32) - sx(lane - 0.32)).toFixed(1)}" height="6" rx="2"/>${t ? svgT(sx(lane - 0.4), sy(-rf) + 4, t, 'sp-tick', 'end') : ''}`;
      const extra = (sx, sy) => `${[1, 2].map((ln) => `<rect class="sp-band sp-c5" opacity=".08" x="${sx(ln - 0.42).toFixed(1)}" y="${sy(0).toFixed(1)}" width="${(sx(ln + 0.42) - sx(ln - 0.42)).toFixed(1)}" height="${(sy(-1) - sy(0)).toFixed(1)}"/>`).join('')}${ladder.map((l) => band(sx, sy, 1, l.rf, String(l.m), 'sp-c5')).join('')}${band(sx, sy, 2, s.rf, '', 'sp-c0')}${svgT(sx(1), sy(0) - 6, L('标准品（kDa）', 'markers (kDa)'), 'sp-lbl sp-c5')}${svgT(sx(2), sy(0) - 6, L('样品', 'sample'), 'sp-lbl sp-c0')}`;
      const fx = lin(0, 1, 50);
      return { plots: [{ x: [0.2, 2.6], y: [-1, 0.06], noy: false, yfmt: (v) => fix(-v, 1), xticks: [], extra, yl: 'Rf', h: 330 },
        { x: [0, 1], logy: true, y: [6, 400], series: [{ xs: fx, ys: fx.map(cal.mass), c: 5, dash: true, label: L('最小二乘直线', 'least-squares line') }], pts: [...ladder.map((l) => ({ x: l.rf, y: l.m, c: 5 })), { x: s.rf, y: Mu, c: 0, r: 5, label: `${fix(Mu, 1)} kDa` }], xl: 'Rf', yl: L('分子量（kDa，对数）', 'molecular weight (kDa, log)'), h: 260 }],
        out: [[L('未知样品的分子量', 'Mass of the unknown'), `${fix(Mu, 1)} kDa`], [L('校准线', 'Calibration'), `log₁₀M = ${fix(cal.a, 3)} − ${fix(-cal.b, 3)}·Rf`], ...(out ? [[L('注意', 'Caution'), L('超出标准品的范围，外推不可靠。', 'Outside the range of the markers: extrapolation is unreliable.')]] : [])] };
    },
  });

  // ── 氢氘交换 ──────────────────────────────────────────────────────────
  const PF_SETS = { exp: () => 1, part: (i, n) => 10 ** ((3 * i) / Math.max(1, n - 1)), prot: (i, n) => (i === 0 || i === n - 1 ? 3 : 10 ** (3 + (3 * i) / Math.max(1, n - 1))) };
  G.hdx = () => ({
    ctl: [ctl.text('seq', L('肽段序列', 'Peptide sequence'), 'VLSEGEWQLV', 'VLSEGEWQLV'), ctl.seg('pf', L('这段肽的保护程度', 'Protection of this peptide'), [['exp', L('暴露（PF = 1）', 'Exposed (PF = 1)')], ['part', L('部分保护（PF 1–10³）', 'Partly protected (PF 1–10³)')], ['prot', L('强保护（PF 10³–10⁶）', 'Strongly protected (PF 10³–10⁶)')]], 'part'), ctl.log('t', L('标记时间', 'Labelling time'), 1, 1e5, 60, (v) => (v < 120 ? `${fix(v, 0)} s` : v < 7200 ? `${fix(v / 60, 1)} min` : `${fix(v / 3600, 1)} h`))],
    draw: (s) => {
      const seq = String(s.seq || 'VLSEGEWQLV').toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '').slice(0, 30);
      if (seq.length < 4) return { out: [[L('序列', 'Sequence'), L('至少四个残基', 'At least four residues')]] };
      const n = X.exchangeableAmides(seq), pfs = (k) => Array.from({ length: n }, (_, i) => PF_SETS[k](i, n)), ts = logs(1, 1e5, 300);
      const curves = ['exp', 'part', 'prot'].map((k, i) => ({ xs: ts, ys: ts.map((t) => X.hdxUptake(t, pfs(k))), c: [3, 0, 2][i], label: [L('暴露', 'exposed'), L('部分保护', 'partly protected'), L('强保护', 'strongly protected')][i], w: k === s.pf ? 2.6 : 1.2 }));
      const formula = X.peptideFormula(seq), nat = M.isotopePattern(formula, { resolution: 0.3, min: 1e-4 }), mono = nat[0].mass;
      const ps = pfs(s.pf).map((p) => 0.9 * 0.75 * (1 - Math.exp((-3 * s.t) / p))), dd = X.deuteriumDist(ps), z = 2, mp = 1.007276466621;
      const env = (withD) => { const m = new Map(); for (const a of nat) (withD ? dd : [1]).forEach((w, j) => { const mass = a.mass + j * X.D_MINUS_H, key = Math.round(mass * 50); const v = m.get(key) || [0, 0]; v[0] += w * a.p * mass; v[1] += w * a.p; m.set(key, v); }); return [...m.values()].map(([s1, w]) => ({ mz: (s1 / w + z * mp) / z, p: w })); };
      const e0 = env(false), e1 = env(true), top0 = Math.max(...e0.map((x) => x.p)), top1 = Math.max(...e1.map((x) => x.p)), cen = (e) => e.reduce((a, x) => a + x.mz * x.p, 0) / e.reduce((a, x) => a + x.p, 0);
      const lo = (mono + z * mp) / z - 1, hi = lo + (n + 6) / z + 1;
      return { plots: [{ x: [1, 1e5], logx: true, y: [0, n * 0.75], series: curves, vlines: [{ x: s.t, c: 1, label: '' }], xl: L('标记时间（s）', 'labelling time (s)'), yl: L('吸收的氘（Da）', 'deuterium uptake (Da)'), h: 260 },
        { x: [lo, hi], y: [0, 125], sticks: [...e0.filter((x) => x.p > top0 * 0.01).map((x) => ({ x: x.mz - 0.04, y: (100 * x.p) / top0, c: 5, dash: true })), ...e1.filter((x) => x.p > top1 * 0.01).map((x) => ({ x: x.mz + 0.04, y: (100 * x.p) / top1, c: 0, w: 2.4, tip: `m/z ${x.mz.toFixed(3)}` }))], xl: `m/z (z = ${z})`, yl: L('相对强度', 'relative intensity'), h: 240, legend: [{ c: 5, dash: true, t: L('未标记', 'undeuterated') }, { c: 0, t: L('标记后', 'after labelling') }] }],
        out: [[L('分子式', 'Formula'), `${chem(formula)} · ${L('单同位素', 'monoisotopic')} ${mono.toFixed(4)}`], [L('能观察的酰胺', 'Observable amides'), L(`${n} 个（去掉 N 端两个和脯氨酸）`, `${n} (excluding the first two and prolines)`)], [L('此刻吸收的氘', 'Uptake at this time'), `${fix(X.hdxUptake(s.t, pfs(s.pf)), 2)} Da`], [L('包络质心移动', 'Shift of the envelope centroid'), `${fix((cen(e1) - cen(e0)) * z, 2)} Da (${fix(cen(e1) - cen(e0), 3)} m/z)`]] };
    },
  });

  // ── 高分子立构 ────────────────────────────────────────────────────────
  G.tacticity = () => ({
    ctl: [{ ...ctl.select('pre', L('例子', 'Examples'), [['0.22', L('自由基聚合的 PMMA', 'Free-radical PMMA')], ['0.5', L('无规（Pm = 0.5）', 'Atactic (Pm = 0.5)')], ['0.95', L('高度全同的 PMMA', 'Highly isotactic PMMA')]], '0.22'), apply: (v) => ({ pm: +v }) }, ctl.range('pm', L('内消旋二元组的概率 P_m', 'Meso diad probability P_m'), 0, 1, 0.01, 0.22, (v) => fix(v, 2))],
    draw: (s) => {
      const t = X.triads(s.pm), xs = lin(0.6, 1.45, 1200), pk = [[1.21, t.mm, 'mm'], [1.02, t.mr, 'mr'], [0.85, t.rr, 'rr']];
      const ys = xs.map((x) => pk.reduce((y, [d, a]) => y + a * gauss(x, d, 0.05), 0)), top = Math.max(...ys, 1e-9);
      const pmBack = t.mm + t.mr / 2;
      return { plots: [{ x: [0.6, 1.45], rev: true, y: [0, 1.3], noy: true, series: [{ xs, ys: ys.map((y) => y / top), c: 0 }], marks: pk.map(([d, a, n]) => [d, `${n} ${fix(100 * a, 1)} %`]), xl: L('化学位移 δ（ppm），PMMA 的 α-甲基', 'chemical shift δ (ppm), α-methyl of PMMA'), h: 260, curfmt: (v) => `${v.toFixed(3)} ppm` }],
        out: [['mm / mr / rr', `${fix(100 * t.mm, 1)} / ${fix(100 * t.mr, 1)} / ${fix(100 * t.rr, 1)} %`], [L('由三元组反算 P_m = mm + mr/2', 'P_m back from triads = mm + mr/2'), fix(pmBack, 3)], [L('Bernoulli 检验 4·mm·rr / mr²', 'Bernoulli test 4·mm·rr / mr²'), t.mr > 1e-9 ? L(`${fix((4 * t.mm * t.rr) / (t.mr * t.mr), 3)}（Bernoulli 统计严格等于 1；实测偏离 1 说明链增长有“记忆”）`, `${fix((4 * t.mm * t.rr) / (t.mr * t.mr), 3)} (exactly 1 under Bernoulli statistics; measured deviations mean chain growth has "memory")`) : '–']] };
    },
  });

  // ── 静态光散射：Zimm 图 ───────────────────────────────────────────────
  G.zimm = () => ({
    ctl: [ctl.log('Mw', L('重均分子量 M_w', 'Weight-average molar mass M_w'), 2e4, 5e6, 2e5, (v) => `${num(Math.round(v / 1000), 0)} kg/mol`), ctl.range('Rg', L('回转半径 R_g', 'Radius of gyration R_g'), 10, 80, 1, 25, (v) => `${v} nm`), ctl.range('A2', L('第二维里系数 A₂', 'Second virial coefficient A₂'), -2, 8, 0.1, 3, (v) => `${fix(v, 1)} × 10⁻⁴ mol·mL/g²`)],
    draw: (s) => {
      const o = { Mw: s.Mw, Rg: s.Rg, A2: s.A2 * 1e-4 }, cs = [0.5e-3, 1e-3, 1.5e-3, 2e-3], ths = [30, 45, 60, 75, 90, 105, 120, 135, 150], k = 200, pts = [];
      cs.forEach((c, i) => ths.forEach((th, j) => pts.push({ c, theta: th, y: X.zimmY(c, th, o) * (1 + 0.003 * (2 * jitter(i * 17 + j) - 1)) })));
      const f = X.zimmFit(pts), x = (p) => Math.sin((p.theta * Math.PI) / 360) ** 2 + k * p.c, sc = 1e6;
      const series = cs.map((c, i) => { const ps = pts.filter((p) => p.c === c); return { xs: ps.map(x), ys: ps.map((p) => p.y * sc), c: 5, w: 1 }; });
      const s0 = lin(0, 1, 20), c0 = lin(0, 2e-3, 20);
      series.push({ xs: s0, ys: s0.map((u) => (f.a + f.b * u) * sc), c: 0, label: L('外推到 c = 0', 'extrapolated to c = 0') }, { xs: c0.map((c) => k * c), ys: c0.map((c) => (f.a + f.d * c) * sc), c: 1, label: L('外推到 θ = 0', 'extrapolated to θ = 0') });
      const all = pts.map((p) => p.y * sc), ymax = Math.max(...all) * 1.08, ymin = Math.min(f.a * sc, ...all) * 0.9;
      return { plots: [{ x: [0, 1 + k * 2e-3 + 0.05], y: [Math.max(0, ymin), ymax], series, pts: [...pts.map((p) => ({ x: x(p), y: p.y * sc, c: 5, r: 2.6 })), { x: 0, y: f.a * sc, c: 0, r: 4.5, label: L('截距 1/M_w', 'intercept 1/M_w') }], xl: `sin²(θ/2) + ${k}·c`, yl: L('Kc/R_θ（10⁻⁶ mol/g）', 'Kc/R_θ (10⁻⁶ mol/g)'), h: 320 }],
        out: [[L('拟合 M_w', 'Fitted M_w'), `${fix(f.Mw / 1000, 1)} kg/mol ${L("（设定", "(set")} ${fix(s.Mw / 1000, 1)}${L("）", ")")}`], [L('拟合 R_g', 'Fitted R_g'), `${fix(f.Rg, 1)} nm ${L('（设定', '(set')} ${s.Rg}${L('）', ')')}`], [L('拟合 A₂', 'Fitted A₂'), `${fix(f.A2 * 1e4, 2)} × 10⁻⁴ mol·mL/g² ${L('（设定', '(set')} ${fix(s.A2, 1)}${L('）', ')')}`], [L('光学常数 K（PS / 甲苯，dn/dc 0.110 mL/g）', 'Optical constant K (PS / toluene, dn/dc 0.110 mL/g)'), `${sci(X.lsK(1.496, 0.11, 658), 3)} mol·cm²/g²`]] };
    },
  });

  // ── 黏度法 ────────────────────────────────────────────────────────────
  G.visc = () => ({
    ctl: [ctl.range('eta', L('特性黏数 [η]（设定）', 'Intrinsic viscosity [η] (set)'), 20, 400, 1, 120, (v) => `${v} mL/g`), ctl.range('kH', L('Huggins 常数 k_H', 'Huggins constant k_H'), 0.25, 0.8, 0.01, 0.35, (v) => fix(v, 2))],
    draw: (s) => {
      const cs = [1, 2, 3, 4, 5].map((v) => v * 1e-3 * (120 / s.eta) * 0.9), er = cs.map((c) => X.viscRel(c, s.eta, s.kH) * (1 + 0.0008 * (2 * jitter(c * 1e5) - 1)));
      const hy = er.map((e, i) => (e - 1) / cs[i]), kr = er.map((e, i) => Math.log(e) / cs[i]), fh = X.linfit(cs, hy), fk = X.linfit(cs, kr), cx = lin(0, cs[4] * 1.05, 20);
      const eta = (fh.a + fk.a) / 2, kH = fh.b / (fh.a * fh.a), kK = -fk.b / (fk.a * fk.a), Mv = X.markHouwinkM(eta, 0.011, 0.725);
      return { plots: [{ x: [0, cs[4] * 1.08], series: [{ xs: cx, ys: cx.map((c) => fh.a + fh.b * c), c: 0, dash: true, label: 'Huggins: η_sp/c' }, { xs: cx, ys: cx.map((c) => fk.a + fk.b * c), c: 1, dash: true, label: 'Kraemer: ln η_r/c' }], pts: [...cs.map((c, i) => ({ x: c, y: hy[i], c: 0, r: 4 })), ...cs.map((c, i) => ({ x: c, y: kr[i], c: 1, r: 4, open: true }))], xfmt: (v) => fix(v * 1000, 1), xl: L('浓度 c（mg/mL）', 'concentration c (mg/mL)'), yl: 'mL/g', h: 280 }],
        out: [[L('外推得到的 [η]', 'Extrapolated [η]'), `${fix(fh.a, 1)} (Huggins) · ${fix(fk.a, 1)} (Kraemer) mL/g`], ['k_H · k_K · k_H + k_K', `${fix(kH, 3)} · ${fix(kK, 3)} · ${fix(kH + kK, 3)}`], [L('相对黏度的范围', 'Range of relative viscosity'), `${fix(er[0], 3)} – ${fix(er[4], 3)}`], [L('M_v（示例参数 K = 0.011 mL/g，a = 0.725）', 'M_v (example K = 0.011 mL/g, a = 0.725)'), `${num(Math.round(Mv / 1000), 0)} kg/mol`]] };
    },
  });

  // ── 分析超速离心 ──────────────────────────────────────────────────────
  G.auc = () => ({
    ctl: [ctl.range('s', L('沉降系数 s', 'Sedimentation coefficient s'), 1, 20, 0.1, 4.3, (v) => `${fix(v, 1)} S`), ctl.log('D', L('扩散系数 D', 'Diffusion coefficient D'), 5e-8, 1.5e-6, 5.9e-7, (v) => `${fix(v * 1e7, 2)} × 10⁻⁷ cm²/s`), ctl.seg('rpm', L('转速', 'Rotor speed'), [[40000, '40 000 rpm'], [50000, '50 000 rpm'], [60000, '60 000 rpm']], 50000)],
    draw: (s) => {
      const o = { s: s.s, D: s.D, rpm: +s.rpm, rm: 6.0 }, rs = lin(5.9, 7.2, 400), times = Array.from({ length: 12 }, (_, i) => (i + 1) * 1200);
      const series = times.map((t, i) => ({ xs: rs, ys: rs.map((r) => X.svProfile(r, t, o)), c: i % 2 ? 0 : 2, w: 1.3 }));
      const Mk = X.svedberg(s.s, s.D, 0.734, 0.9982, 293.15), g = ((2 * Math.PI * o.rpm) / 60) ** 2 * 0.065 / 9.80665;
      return { plots: [{ x: [5.9, 7.2], y: [0, 1.08], series, vlines: [{ x: 6.0, c: 5, label: L('弯月面', 'meniscus') }, { x: 7.2, c: 5, label: '' }], xl: L('半径（cm）', 'radius (cm)'), yl: L('浓度（相对初始值）', 'concentration (relative to start)'), h: 290 }],
        out: [[L('Svedberg 方程的分子量（v̄ 0.734，水 20 °C）', 'Mass from the Svedberg equation (v̄ 0.734, water 20 °C)'), `${fix(Mk, 1)} kg/mol`], [L('界面位置', 'Boundary position'), `1 h ${fix(X.svBoundary(3600, o), 3)} cm · 4 h ${fix(X.svBoundary(14400, o), 3)} cm`], [L('扩散展宽 √(4Dt)，1 h', 'Diffusional width √(4Dt) at 1 h'), `${fix(Math.sqrt(4 * s.D * 3600) * 10, 2)} mm`], [L('6.5 cm 处的离心加速度', 'Centrifugal acceleration at 6.5 cm'), `${num(Math.round(g / 1000) * 1000, 0)} g`]],
        note: L('每 20 分钟一条扫描，共 4 小时。', 'One scan every 20 minutes for 4 hours.') };
    },
  });

  // ── 热迁移 ────────────────────────────────────────────────────────────
  G.melt = () => ({
    ctl: [ctl.range('L', L('配体浓度', 'Ligand concentration'), 0, 200, 1, 50, (v) => `${v} μM`), ctl.log('Kd', L('配体的解离常数 K_d', 'Ligand dissociation constant K_d'), 1e-8, 1e-3, 1e-6, (v) => (v < 1e-6 ? `${fix(v * 1e9, 0)} nM` : v < 1e-3 ? `${fix(v * 1e6, 1)} μM` : `${fix(v * 1e3, 2)} mM`))],
    draw: (s) => {
      const Ts = lin(20, 90, 701), base = { Tm: 328.15, dH: 400e3, dCp: 8e3 }, lig = { ...base, L: s.L * 1e-6, Kd: s.Kd };
      const F = (T, o) => { const fu = X.fracUnfolded(T + 273.15, o); return (1 - fu) * (0.08 + 0.0006 * (T - 20)) + fu * (1.0 - 0.004 * (T - 20)); };
      const f0 = Ts.map((T) => F(T, base)), f1 = Ts.map((T) => F(T, lig)), d = (f) => f.map((v, i) => (i && i < f.length - 1 ? (f[i + 1] - f[i - 1]) / (Ts[i + 1] - Ts[i - 1]) : 0));
      const tm0 = X.apparentTm(base) - 273.15, tm1 = X.apparentTm(lig) - 273.15;
      return { plots: [{ x: [20, 90], y: [0, 1.05], series: [{ xs: Ts, ys: f0, c: 5, dash: true, label: L('不加配体', 'no ligand') }, { xs: Ts, ys: f1, c: 0, label: L('加配体', 'with ligand') }], vlines: [{ x: tm1, c: 1, label: `Tm ${fix(tm1, 1)} °C` }], xl: L('温度（°C）', 'temperature (°C)'), yl: L('荧光（示意）', 'fluorescence (schematic)'), h: 250 },
        { x: [20, 90], series: [{ xs: Ts, ys: d(f0), c: 5, dash: true }, { xs: Ts, ys: d(f1), c: 0 }], xl: L('温度（°C）', 'temperature (°C)'), yl: 'dF/dT', h: 200 }],
        out: [[L('不加配体的 Tm', 'Tm without ligand'), `${fix(tm0, 2)} °C`], [L('加配体后的 Tm', 'Tm with ligand'), `${fix(tm1, 2)} °C`], ['ΔTm', `${tm1 - tm0 >= 0 ? '+' : '−'}${fix(Math.abs(tm1 - tm0), 2)} °C`], [L('25 °C 的稳定性 ΔG_u', 'Stability ΔG_u at 25 °C'), `${fix(X.unfoldDG(298.15, base) / 1000, 1)} → ${fix(X.unfoldDG(298.15, lig) / 1000, 1)} kJ/mol`]] };
    },
  });
})();
