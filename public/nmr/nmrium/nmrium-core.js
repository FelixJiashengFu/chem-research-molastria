/* NMRium 谱图处理台的纯逻辑（MolAstriaNMRium）：不碰 DOM，不联网。
   NMRium（github.com/cheminfo/nmrium，MIT）由 NFDI4Chem 的 nmrium-react-wrapper（MIT）包成独立的页面，
   tools/vendor-nmrium.mjs 把它构建进 app/（生成的，不要手改），nmrium.js 用 iframe 嵌入、用 postMessage 把文件交给它。
   这里是两边对接的规则和数据：
   - 示例数据 SAMPLES（samples/ 里的实测谱，许可证见 samples/NOTICE.txt），
   - 认文件 classify / pick（能交给 NMRium 的格式、Bruker 实验文件夹、太大的文件），
   - 把一个 Bruker 实验文件夹打成不压缩的 zip（zip、crc32：postMessage 传 File 时丢掉 webkitRelativePath，
     NMRium 认不出散开的 fid / acqus，打成一个 zip 就认得），
   - 和包装页面之间的消息（loadMessage、actionMessage、readMessage；命名空间 nmr-wrapper），
   - 谱图馆练习题的一维谱转成 JCAMP-DX（practiceSpectrum、toJcamp：按题目给的峰位重画，不是实测，标题里写明）。
   tools/nmrium-test.mjs 测。 */
(function (root) {
  'use strict';
  const T = (zh, en) => ({ zh, en });

  /** 嵌进来的 NMRium 版本（和 tools/vendor-nmrium.mjs、app/VERSION.txt 对得上，测试核对）。 */
  const BUILD = { wrapper: 'v0.8.0', nmrium: '0.56.0', app: 'app/index.html' };
  const NS = 'nmr-wrapper';

  // ── 示例数据 ──────────────────────────────────────────────────────────
  const SAMPLES = [
    {
      id: 'aspirin', files: ['aspirin-1h.zip'], tab: '1H', kind: T('Bruker 原始 FID', 'Bruker raw FID'),
      name: T('阿司匹林 ¹H', 'Aspirin ¹H'),
      what: T('一维 ¹H 的原始自由感应衰减（fid + acqus）。打开时 NMRium 自动做傅里叶变换；可以自己改窗函数、调相位、校基线、积分、找峰。',
        'A 1D ¹H raw free-induction decay (fid + acqus). NMRium Fourier-transforms it on load; try your own window function, phasing, baseline, integrals and peak picking.'),
    },
    {
      id: 'indometacin', files: ['indometacin-1h.dx', 'indometacin.mol'], tab: '1H', kind: T('JCAMP-DX + 结构', 'JCAMP-DX + structure'),
      name: T('吲哚美辛 ¹H（400 MHz，DMSO-d₆）', 'Indometacin ¹H (400 MHz, DMSO-d₆)'),
      what: T('处理好的一维谱（JCAMP-DX）和分子结构（molfile）一起载入：在“Ranges”里自动找多重峰，再把每组峰归属到结构上的氢。',
        'A processed 1D spectrum (JCAMP-DX) loaded together with the structure (molfile): auto-detect multiplets under Ranges, then assign each to hydrogens on the structure.'),
    },
    {
      id: 'cyclosporin', files: ['cyclosporin-1h.zip', 'cyclosporin-cosy.zip'], tab: '1H,1H', kind: T('Bruker 一维 + 二维 COSY', 'Bruker 1D + 2D COSY'),
      name: T('环孢素 ¹H 和 H,H-COSY', 'Cyclosporin ¹H and H,H-COSY'),
      what: T('一维 ¹H 和二维 COSY 的原始数据（ser）。二维谱在“1H,1H”标签里，可以调等高线、找交叉峰、和一维谱对照。',
        'Raw ¹H and 2D COSY data (ser). The 2D spectrum is under the 1H,1H tab: adjust contour levels, pick cross peaks and compare with the 1D trace.'),
    },
  ];

  // ── 认文件 ────────────────────────────────────────────────────────────
  /** 单个文件交给 NMRium 时认成什么；不认识的返回 null。 */
  function classify(name) {
    const n = String(name || '').toLowerCase().split('/').pop();
    if (/\.(jdx|dx|jcamp|jdf)$/.test(n)) return /\.jdf$/.test(n) ? 'jeol' : 'jcamp';
    if (/\.zip$/.test(n)) return 'zip';
    if (/\.nmrium$/.test(n) || /\.json$/.test(n)) return 'nmrium';
    if (/\.(mol|sdf)$/.test(n)) return 'molecule';
    if (/\.(csv|tsv|txt)$/.test(n)) return 'text';
    if (/^(fid|ser|acqus|acqu|acqu2s|acqu2|procs|proc|proc2s|1r|1i|2rr|2ii|2ri|2ir|pulseprogram)$/.test(n)) return 'bruker-part';
    return null;
  }
  const MAX_BYTES = 300 * 1024 * 1024;
  /**
   * files: [{ name, size, path? }]（path 是文件夹里的相对路径 webkitRelativePath）→ { send, bruker, skipped, big }。
   * send 是能直接交给 NMRium 的文件；bruker 为真时，整批是一个（或几个）Bruker 实验文件夹，要先 zip 再交。
   */
  function pick(files) {
    const list = [...(files || [])];
    const bruker = list.some((f) => f.path && f.path.includes('/') && /^(fid|ser|acqus)$/i.test(String(f.name)));
    const big = list.filter((f) => f.size > MAX_BYTES).map((f) => f.name);
    if (bruker) return { send: list.filter((f) => f.size <= MAX_BYTES), bruker: true, skipped: [], big };
    const send = [], skipped = [];
    for (const f of list) {
      const k = classify(f.name);
      if (!k || k === 'bruker-part') skipped.push(f.name);
      else if (f.size > MAX_BYTES) continue;
      else send.push(f);
    }
    return { send, bruker: false, skipped, big };
  }
  /** Bruker 文件夹里的相对路径：去掉选中的那一层以上（"上传/aspirin/1/fid" 保留 "aspirin/1/fid"）。 */
  function zipPath(path) {
    const p = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    return p.split('/').filter((s) => s && s !== '.' && s !== '..').join('/');
  }

  // ── 不压缩的 zip ──────────────────────────────────────────────────────
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const utf8 = (s) => new TextEncoder().encode(s);
  /** entries: [{ name, data: Uint8Array }] → Uint8Array。只存不压（NMR 的二进制数据本来就压不了多少），文件名 UTF-8。 */
  function zip(entries) {
    const parts = [], central = [];
    let off = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff], u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    for (const e of entries) {
      const name = utf8(zipPath(e.name)), data = e.data, crc = crc32(data);
      if (data.length > 0xffffffff - 1) throw new Error('file too large for zip32');
      const head = [0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(Uint8Array.from(head), name, data);
      central.push(Uint8Array.from([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += head.length + name.length + data.length;
    }
    const csize = central.reduce((s, p) => s + p.length, 0);
    const end = Uint8Array.from([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(csize), ...u32(off), ...u16(0)]);
    const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
    let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }
  /** 文件夹打包后的名字：取最上一层文件夹名（没有就 bruker）。 */
  function zipName(paths) {
    const top = [...new Set((paths || []).map((p) => zipPath(p).split('/')[0]).filter(Boolean))];
    const base = (top.length === 1 ? top[0] : 'bruker').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'bruker';
    return `${base}.zip`;
  }

  // ── 和包装页面之间的消息 ──────────────────────────────────────────────
  /** 交文件：files 是 File 对象（postMessage 会复制它们）；tab 是打开后选中的标签，例如 1H、13C、1H,1H。 */
  function loadMessage(files, tab) {
    const data = { type: 'file', data: [...files] };
    if (tab) data.activeTab = String(tab);
    return { type: `${NS}:load`, data };
  }
  function actionMessage(type) { return { type: `${NS}:action-request`, data: { type } }; }
  /** 读 NMRium 发来的消息：{ kind: 'ready' | 'error' | 'data-change' | 'action-response', data } 或者 null（不是它的）。 */
  function readMessage(msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string' || !msg.type.startsWith(`${NS}:`)) return null;
    const kind = msg.type.slice(NS.length + 1);
    if (!['ready', 'error', 'data-change', 'action-response'].includes(kind)) return null;
    return { kind, data: msg.data };
  }
  /** data-change 里的谱数：只数，不读谱的内容。 */
  function spectraCount(data) {
    const s = data && data.state && data.state.data && data.state.data.spectra;
    return Array.isArray(s) ? s.length : null;
  }
  /** 报错的一句话（NMRium 发来的是 Error 的结构化复制，可能只剩 message）。 */
  function errorText(data) {
    if (!data) return '';
    const m = typeof data === 'string' ? data : data.message || '';
    return String(m).slice(0, 300);
  }
  /** iframe 的地址：工作区（default、process1D、assignment 等）和空白时的提示文字。 */
  function frameSrc(opts = {}) {
    const q = new URLSearchParams();
    if (opts.workspace) q.set('workspace', opts.workspace);
    if (opts.empty) q.set('defaultEmptyMessage', opts.empty);
    const s = q.toString();
    return BUILD.app + (s ? `?${s}` : '');
  }
  /** 本页地址里的 #sample=<id> 或 #practice=<题>-<图>；别的返回 null。 */
  function parseHash(hash) {
    const h = String(hash || '').replace(/^#/, '');
    let m = /^sample=([a-z0-9-]+)$/.exec(h);
    if (m) return SAMPLES.some((s) => s.id === m[1]) ? { sample: m[1] } : null;
    m = /^practice=([a-z0-9]+)-(\d{1,2})$/.exec(h);
    if (m) return { practice: m[1], fig: +m[2] };
    return null;
  }

  // ── 练习题的一维谱 → JCAMP-DX ─────────────────────────────────────────
  // 和 spectra/sp-practice.js 的 prLines 用同一组参数：groups（Hz 读数或单峰的 ppm）、sticks（¹³C 线）、bars（每个信号一根峰）。
  // 线形是 Lorentz；同一张谱里所有线宽相同，所以面积和峰高成正比，NMRium 积分出来就是题目给的氢数之比。
  const NOMINAL = { '1H': 400.13, '13C': 100.61 };
  /** 题目的一张一维图 → { nucleus, mhz, nominal, lines: [{ ppm, a }], hwhm（Hz）, range: [lo, hi] ppm, solvent }；不能转的返回 null。 */
  function practiceLines(args) {
    if (!args || !Array.isArray(args.x)) return null;
    const nucleus = args.c13 ? '13C' : '1H';
    const nominal = !(args.mhz > 0);
    const mhz = nominal ? NOMINAL[nucleus] : +args.mhz;
    const lines = [];
    if (args.c13) {
      for (const [x, y] of args.sticks || []) lines.push({ ppm: +x, a: +y });
      if (args.solvent) for (const k of [-1, 0, 1]) lines.push({ ppm: args.solvent + k * 0.25, a: 0.18 });
    } else if (args.bars) {
      for (const [x, n] of args.bars) lines.push({ ppm: +x, a: +n });
    } else if (args.groups) {
      for (const g of args.groups) {
        if (g.hz) { const w = g.w || g.hz.map(() => 1), sw = w.reduce((s, v) => s + v, 0); g.hz.forEach((v, i) => lines.push({ ppm: v / mhz, a: (g.n * w[i]) / sw })); }
        else lines.push({ ppm: +g.ppm, a: +g.n });
      }
    } else return null;
    if (!lines.length || lines.some((l) => !Number.isFinite(l.ppm) || !Number.isFinite(l.a))) return null;
    const hwhm = args.c13 ? 1.5 : args.bars ? 1.2 : 0.3;
    return { nucleus, mhz, nominal, lines, hwhm, range: [Math.min(args.x[0], args.x[1]), Math.max(args.x[0], args.x[1])] };
  }
  /** 在等间距的频率格点上把线加起来：返回 { hz（从高到低）, y }。点数是 2 的幂，间距不超过半高半宽的 1/3。 */
  function practiceSpectrum(args) {
    const L = practiceLines(args);
    if (!L) return null;
    const [lo, hi] = L.range, span = (hi - lo) * L.mhz;
    let n = 1024;
    while (span / (n - 1) > L.hwhm / 3 && n < 262144) n *= 2;
    const hz = new Float64Array(n), y = new Float64Array(n), d = span / (n - 1), h2 = L.hwhm * L.hwhm;
    for (let i = 0; i < n; i++) hz[i] = hi * L.mhz - i * d;
    for (const l of L.lines) {
      const c = l.ppm * L.mhz;
      for (let i = 0; i < n; i++) { const dx = hz[i] - c; y[i] += (l.a * h2) / (dx * dx + h2); }
    }
    return { ...L, hz, y };
  }
  const fmt = (v, d) => { const s = v.toFixed(d); return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };
  /**
   * 写 JCAMP-DX 5.01 的 NMR SPECTRUM（XYDATA=(X++(Y..Y))，X 是 Hz，Y 是整数）。
   * spec 来自 practiceSpectrum；meta: { title, solvent, origin }。标题和 ORIGIN 都写明是按峰位重画的，不是实测。
   */
  function toJcamp(spec, meta = {}) {
    const { hz, y } = spec, n = hz.length;
    let top = 0;
    for (let i = 0; i < n; i++) if (y[i] > top) top = y[i];
    const scale = top > 0 ? 1e6 / top : 1;
    const Y = Array.from(y, (v) => Math.round(v * scale));
    const nuc = spec.nucleus === '13C' ? '^13C' : '^1H';
    const clean = (s) => String(s || '').replace(/[\r\n#]+/g, ' ').trim();
    const head = [
      `##TITLE=${clean(meta.title) || 'MolAstria practice spectrum'}`,
      '##JCAMP-DX=5.01',
      '##DATA TYPE=NMR SPECTRUM',
      '##DATA CLASS=XYDATA',
      `##ORIGIN=${clean(meta.origin) || 'MolAstria, redrawn from the peak list of a practice problem (not measured)'}`,
      '##OWNER=MolAstria',
      `##.OBSERVE FREQUENCY=${fmt(spec.mhz, 4)}`,
      `##.OBSERVE NUCLEUS=${nuc}`,
      ...(meta.solvent ? [`##.SOLVENT NAME=${clean(meta.solvent)}`] : []),
      '##XUNITS=HZ',
      '##YUNITS=ARBITRARY UNITS',
      '##XFACTOR=1',
      '##YFACTOR=1',
      `##FIRSTX=${fmt(hz[0], 6)}`,
      `##LASTX=${fmt(hz[n - 1], 6)}`,
      `##DELTAX=${fmt((hz[n - 1] - hz[0]) / (n - 1), 8)}`,
      '##MAXY=1000000',
      '##MINY=0',
      `##NPOINTS=${n}`,
      `##FIRSTY=${Y[0]}`,
      '##XYDATA=(X++(Y..Y))',
    ];
    const body = [];
    for (let i = 0; i < n; i += 10) body.push(`${fmt(hz[i], 6)} ${Y.slice(i, i + 10).join(' ')}`);
    return `${head.join('\n')}\n${body.join('\n')}\n##END=\n`;
  }
  /** 读回 toJcamp 写的 X++(Y..Y)（测试和自检用）：→ { hz, y, mhz, npoints }。 */
  function readJcamp(text) {
    const get = (k) => { const m = new RegExp(`^##${k.replace(/[.$]/g, '\\$&')}=\\s*(.*)$`, 'm').exec(text); return m ? m[1].trim() : null; };
    const start = text.indexOf('##XYDATA=(X++(Y..Y))');
    if (start < 0) return null;
    const lines = text.slice(start).split('\n').slice(1), hz = [], y = [];
    const first = +get('FIRSTX'), dx = +get('DELTAX');
    for (const l of lines) {
      if (l.startsWith('##')) break;
      const v = l.trim().split(/\s+/).map(Number);
      if (v.length < 2) continue;
      for (let k = 1; k < v.length; k++) { hz.push(v[0] + (k - 1) * dx); y.push(v[k]); }
    }
    return { hz, y, mhz: +get('.OBSERVE FREQUENCY'), npoints: +get('NPOINTS'), firstx: first };
  }
  /** 练习题里哪些图能交给 NMRium（一维的 prLines）。problems 是 MOLASTRIA_SPECTRA_PRACTICE.problems。 */
  function practiceFigures(problems) {
    const out = [];
    for (const p of problems || []) (p.figs || []).forEach((f, i) => { if (f.gen === 'prLines' && practiceLines(f.args)) out.push({ problem: p.id, fig: i, title: f.title, args: f.args }); });
    return out;
  }
  /** 一张练习图 → File 用的 { name, text, tab }。 */
  function practiceFile(problem, fig, lang) {
    const f = problem && problem.figs && problem.figs[fig];
    if (!f || f.gen !== 'prLines') return null;
    const spec = practiceSpectrum(f.args);
    if (!spec) return null;
    const title = `${problem.id} fig ${fig + 1}: ${(f.title && (f.title.en || f.title.zh)) || ''} - redrawn from the stated peak positions, not measured${spec.nominal ? `; spectrometer frequency not given, ${spec.mhz} MHz assumed` : ''}`;
    const solvent = /CDCl/.test(JSON.stringify(f.title || '')) ? 'CDCl3' : '';
    return { name: `molastria-${problem.id}-${fig + 1}-${spec.nucleus}.jdx`, text: toJcamp(spec, { title, solvent }), tab: spec.nucleus, nominal: spec.nominal, mhz: spec.mhz, lang };
  }

  // ── 界面文字（自带中英两版） ──────────────────────────────────────────
  const TEXT = {
    loading: T('正在载入 NMRium（约 11 MB，只在第一次）……', 'Loading NMRium (about 11 MB, first time only)…'),
    ready: T('NMRium 准备好了。选一个示例，或者处理自己的数据。', 'NMRium is ready. Pick a sample, or process your own data.'),
    sending: T('正在交给 NMRium：', 'Handing to NMRium: '),
    sent: T('已载入：', 'Loaded: '),
    zipping: T('正在把 Bruker 文件夹打包……', 'Packing the Bruker folder…'),
    skipped: T('这些文件 NMRium 认不出，没有交过去：', 'NMRium cannot read these files, so they were not sent: '),
    big: T('文件太大（超过 300 MB），没有交过去：', 'Too large (over 300 MB), not sent: '),
    none: T('没有可以交给 NMRium 的文件。支持 JCAMP-DX（.jdx .dx）、Bruker 的 zip 或实验文件夹、JEOL（.jdf）、.nmrium、molfile。', 'No file NMRium can read. Supported: JCAMP-DX (.jdx .dx), a Bruker zip or experiment folder, JEOL (.jdf), .nmrium, molfile.'),
    error: T('NMRium 报错：', 'NMRium reported an error: '),
    fail: T('NMRium 没有载入。刷新页面再试，或者直接打开', 'NMRium did not load. Reload the page, or open'),
    practice: T('练习题的谱（按题目给的峰位重画，不是实测）：', 'Practice spectrum (redrawn from the stated peak positions, not measured): '),
    nominal: T('原题没写谱仪频率，按 {0} MHz 换算。', 'The problem gives no spectrometer frequency; {0} MHz assumed.'),
    nopractice: T('没找到这道练习题的谱。', 'This practice spectrum was not found.'),
  };

  const API = { BUILD, NS, SAMPLES, classify, pick, zipPath, zipName, MAX_BYTES, crc32, zip, loadMessage, actionMessage, readMessage, spectraCount, errorText, frameSrc, parseHash, NOMINAL, practiceLines, practiceSpectrum, toJcamp, readJcamp, practiceFigures, practiceFile, TEXT };
  root.MolAstriaNMRium = API;
})(typeof window !== 'undefined' ? window : globalThis);
