/* 红外光谱：把频率计算的棒状谱（每个模式的频率 cm⁻¹ 和强度 km/mol）展宽成连续谱，读实验谱（JCAMP-DX 或两列 CSV）来叠着比。
   纯函数，没有 DOM（tools/ir-test.mjs 测）。浏览器：window.MOLASTRIA_IR_CORE；node：module.exports。

   单位：积分强度 A（km/mol）乘以面积为 1 的线型 g(ν)（单位 cm），得到摩尔吸光系数
     ε(ν) = 100 · A · g(ν)   [L mol⁻¹ cm⁻¹]，因为 1 km/mol = 100 L mol⁻¹ cm⁻²。
   所以展宽后的谱对 ν 积分，每个峰的面积就是 100·A，和半高宽、线型无关（测试里核对）。 */
(function (root) {
  'use strict';

  const LN2 = Math.log(2);
  const SHAPES = ['lorentz', 'gauss'];

  /** 线型 g(ν − ν0)，面积为 1（cm）。fwhm 是半高全宽（cm⁻¹）。 */
  function lineShape(d, fwhm, shape) {
    if (shape === 'gauss') { const s = fwhm / Math.sqrt(8 * LN2); return Math.exp(-(d * d) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); }
    const g = fwhm / 2;
    return g / (Math.PI * (d * d + g * g));
  }

  /**
   * 展宽。ir: [{ freq, int }]（虚频和强度不是正数的跳过）。opts: { fwhm = 20, shape = 'lorentz', scale = 1, from = 400, to = 4000, step = 2 }。
   * 返回 { x: [...], y: [...]（ε，L mol⁻¹ cm⁻¹）, sticks: [{ freq（乘过 scale）, int }], max }。
   */
  function broaden(ir, opts = {}) {
    const fwhm = clamp(Number(opts.fwhm) || 20, 0.5, 500);
    const shape = SHAPES.includes(opts.shape) ? opts.shape : 'lorentz';
    const scale = clamp(Number(opts.scale) || 1, 0.5, 1.5);
    const from = Number.isFinite(opts.from) ? opts.from : 400, to = Number.isFinite(opts.to) ? opts.to : 4000;
    const step = clamp(Number(opts.step) || 2, 0.1, 50);
    const sticks = (ir || []).filter((m) => m && m.freq > 0 && m.int > 0).map((m) => ({ freq: m.freq * scale, int: m.int }));
    const n = Math.max(2, Math.round((to - from) / step) + 1);
    const x = new Array(n), y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) x[i] = from + ((to - from) * i) / (n - 1);
    const cut = shape === 'gauss' ? fwhm * 4 : fwhm * 60; // 洛伦兹的尾巴长，截得远一点
    for (const s of sticks) {
      const lo = Math.max(0, Math.floor(((s.freq - cut - from) / (to - from)) * (n - 1)));
      const hi = Math.min(n - 1, Math.ceil(((s.freq + cut - from) / (to - from)) * (n - 1)));
      for (let i = lo; i <= hi; i++) y[i] += 100 * s.int * lineShape(x[i] - s.freq, fwhm, shape);
    }
    return { x, y, sticks, max: Math.max(0, ...y) };
  }

  /** 最强的几个峰（按强度），给图上标数字用。 */
  function strongest(sticks, k = 6, minFrac = 0.08) {
    const top = Math.max(0, ...sticks.map((s) => s.int));
    return sticks.filter((s) => s.int >= top * minFrac).sort((a, b) => b.int - a.int).slice(0, k);
  }

  /** 梯形积分（测试用，也可以给页面报面积）。 */
  function integrate(x, y) { let a = 0; for (let i = 1; i < x.length; i++) a += ((y[i] + y[i - 1]) / 2) * (x[i] - x[i - 1]); return a; }

  // ── 实验谱 ──
  const num = (s) => { const v = Number(String(s).trim().replace(/^\+/, '')); return Number.isFinite(v) ? v : NaN; };

  /** JCAMP-DX（AFFN 明文数字：(X++(Y..Y)) 或 (XY..XY)）。压缩的 SQZ/DIF 格式不认，返回 why。 */
  function parseJcamp(text) {
    const t = String(text).replace(/\r/g, '');
    const lab = (k) => { const m = new RegExp(`^##${k}=\\s*(.*)$`, 'mi').exec(t); return m ? m[1].trim() : ''; };
    const xf = num(lab('XFACTOR')) || 1, yf = num(lab('YFACTOR')) || 1;
    const xunits = lab('XUNITS').toUpperCase(), yunits = lab('YUNITS').toUpperCase();
    const first = num(lab('FIRSTX')), last = num(lab('LASTX')), npts = num(lab('NPOINTS'));
    const title = lab('TITLE');
    const block = /^##(XYDATA|PEAK TABLE|XYPOINTS)=\s*([^\n]*)\n([\s\S]*?)(?=^##)/mi.exec(t + '\n##END=');
    if (!block) return { ok: false, why: 'nodata' };
    const kind = block[2].replace(/\s/g, '').toUpperCase();
    const body = block[3].split('\n').map((l) => l.replace(/\$\$.*$/, '').trim()).filter(Boolean);
    if (body.some((l) => /[@A-Za-z%]/.test(l.replace(/[eE][+-]?\d/g, '')))) return { ok: false, why: 'compressed' };
    let x = [], y = [];
    if (kind.startsWith('(X++(Y..Y))')) {
      const rows = body.map((l) => l.split(/[\s,;]+/).map(num));
      const pts = [];
      for (const r of rows) { if (r.some(Number.isNaN)) return { ok: false, why: 'bad' }; for (let i = 1; i < r.length; i++) pts.push([r[0], i - 1, r[i]]); }
      // X 只在行首给出，同一行里的点按 DELTAX 往后推
      const dx = Number.isFinite(first) && Number.isFinite(last) && npts > 1 ? (last - first) / (npts - 1) / xf : rows.length > 1 && rows[0].length > 1 ? (rows[1][0] - rows[0][0]) / (rows[0].length - 1) : 1;
      for (const [x0, k, yy] of pts) { x.push((x0 + k * dx) * xf); y.push(yy * yf); }
    } else {
      for (const l of body) { const v = l.split(/[\s,;]+/).map(num).filter((n) => !Number.isNaN(n)); for (let i = 0; i + 1 < v.length; i += 2) { x.push(v[i] * xf); y.push(v[i + 1] * yf); } }
    }
    if (x.length < 2) return { ok: false, why: 'bad' };
    if (/MICROMET/.test(xunits)) x = x.map((v) => 1e4 / v);
    return finish(x, y, /TRANSMIT/.test(yunits) ? 'T' : /ABSORB/.test(yunits) ? 'A' : '', title);
  }

  /** 两列文字（逗号、分号、制表符或空格分开；表头和注释行跳过）。第一列是波数，第二列是吸光度或透过率。 */
  function parseColumns(text) {
    const x = [], y = [];
    let header = '';
    for (const line of String(text).replace(/\r/g, '').split('\n')) {
      const l = line.trim();
      if (!l || l.startsWith('#')) continue;
      const v = l.split(/[\s,;]+/).map(num);
      if (v.length >= 2 && !Number.isNaN(v[0]) && !Number.isNaN(v[1])) { x.push(v[0]); y.push(v[1]); } else if (!x.length) header += ` ${l}`;
    }
    if (x.length < 2) return { ok: false, why: 'bad' };
    const h = header.toLowerCase();
    return finish(x, y, /transmit|%t\b|\bt\s*%/.test(h) ? 'T' : /absorb|\babs\b/.test(h) ? 'A' : '', '');
  }

  /** 统一成“越大越吸收”、按波数从小到大、最大值为 1。透过率先换成吸光度 A = −log10(T)（百分数先除以 100）。 */
  function finish(x, y, units, title) {
    let pts = x.map((v, i) => [v, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (!units) {
      // 没写单位：数值都在 0–1.2 或 0–120 之间、而且大部分接近上限，多半是透过率
      const ys = pts.map((p) => p[1]).sort((a, b) => a - b), med = ys[Math.floor(ys.length / 2)], top = ys[ys.length - 1];
      units = ys[0] >= 0 && (top <= 1.2 || (top <= 120 && top > 2)) && med > 0.6 * top ? 'T' : 'A';
    }
    if (units === 'T') {
      const pct = Math.max(...pts.map((p) => p[1])) > 2;
      pts = pts.map(([a, b]) => [a, -Math.log10(Math.max(1e-4, pct ? b / 100 : b))]);
    }
    pts.sort((a, b) => a[0] - b[0]);
    const lo = Math.min(...pts.map((p) => p[1]));
    const shifted = pts.map(([a, b]) => [a, b - Math.min(0, lo)]);
    const top = Math.max(...shifted.map((p) => p[1])) || 1;
    return { ok: true, x: shifted.map((p) => p[0]), y: shifted.map((p) => p[1] / top), units, title, from: shifted[0][0], to: shifted[shifted.length - 1][0] };
  }

  /** 实验谱：认 JCAMP-DX（有 ##TITLE= 或 ##JCAMP），其余按两列文字读。 */
  function parseExperimental(text) {
    return /^##(TITLE|JCAMP)/mi.test(String(text)) ? parseJcamp(text) : parseColumns(text);
  }

  /** 展宽结果写成 CSV。 */
  function toCSV(spec, label = 'epsilon_L_per_mol_cm') {
    return `wavenumber_cm-1,${label}\n` + spec.x.map((v, i) => `${v.toFixed(2)},${spec.y[i].toPrecision(6)}`).join('\n') + '\n';
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  const API = { SHAPES, lineShape, broaden, strongest, integrate, parseJcamp, parseColumns, parseExperimental, toCSV };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_IR_CORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
