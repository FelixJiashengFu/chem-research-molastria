/* 浏览器里运行 Python：给任何页面一个能改、能跑的代码框，带输出和一张简单的折线图。
   Python 用 Pyodide（MPL-2.0，https://pyodide.org，源码 https://github.com/pyodide/pyodide），第一次点“运行”时才从 jsDelivr 载入，
   跑在 Web Worker 里，页面不会卡住；“停止”直接结束这个 Worker。图是本文件在 canvas 上画的（不用 matplotlib，它太大）。
   用法：MolAstriaPy.mount(el, { code, packages: ['numpy'], plot: true, name: 'x.py', lang: 'zh' | 'en' })，返回 { run, stop, reset, destroy }。
   画图：程序给全局变量 chart（plot 传字符串时用那个名字）赋一个字典，运行结束后就画出来：
     chart = {"title": …, "xlabel": …, "ylabel": …, "x": [...], "series": [{"name": …, "y": [...], "color"?: "gold", "dash"?: True}],
              "points"?: [{"x": …, "y": …, "label": …}], "xlim"?: [lo, hi], "ylim"?: [lo, hi]}   （numpy 数组可以直接放）
   界面文字自带中英两版：跟 opts.lang，缺省看 <html lang>；整块标 translate="no"，不走站点词典（和 api/embed.js 一样），
   所以讲解手册（站点词典）和量子嘉年华（页面内双语）里表现一致。
   window.MolAstriaPy；在 node 里 module.exports 只导出纯函数（tools/pyrun-test.mjs 测）。 */
(function (root) {
  'use strict';

  const VERSION = '314.0.7'; // Pyodide 314.0.7（Python 3.14.2，numpy 2.4.6），npm 上 2026-09-14 发布
  const BASE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
  // 第一次运行实际下载的字节数（Chrome 里量的 transferSize 之和：pyodide.mjs、pyodide.asm.mjs、pyodide.asm.wasm、
  // python_stdlib.zip、pyodide-lock.json、numpy 的 wheel，jsDelivr 用 brotli 压缩）。换版本要重新量。
  const DOWNLOAD = { core: 6239377, numpy: 2930185 }; // 量于 2026-11-10，合计 9 169 562 字节
  const COLORS = ['gold', 'info', 'violet', 'ok', 'danger', 'accent', 'ink', 'muted'];
  const CYCLE = ['gold', 'info', 'violet', 'ok', 'danger', 'accent'];
  const MAX_OUT = 200000;

  const STR = {
    code: ['Python 代码', 'Python code'],
    run: ['运行', 'Run'],
    stop: ['停止', 'Stop'],
    reset: ['恢复原代码', 'Reset code'],
    hint: ['Ctrl + Enter 运行 · Tab 缩进 · 先按 Esc 再按 Tab 离开编辑框', 'Ctrl + Enter runs · Tab indents · press Esc, then Tab, to leave the editor'],
    first: ['第一次运行要从 cdn.jsdelivr.net 下载 Pyodide（浏览器里的 Python {0}，{1}），之后由浏览器缓存。程序只在你的浏览器里运行，不上传。', 'The first run downloads Pyodide (Python {0} in the browser, {1}) from cdn.jsdelivr.net; your browser caches it after that. The program runs only in your browser and is not uploaded.'],
    sizeWith: ['约 {0} MB，含 {1}', 'about {0} MB including {1}'],
    size: ['约 {0} MB', 'about {0} MB'],
    offline: ['现在离线：运行 Python 要联网从 cdn.jsdelivr.net 下载 Pyodide。代码可以先改，联网后再点运行。', 'You are offline: running Python needs to download Pyodide from cdn.jsdelivr.net. You can edit the code now and run it once you are back online.'],
    boot: ['正在下载并启动 Python…', 'Downloading and starting Python…'],
    restart: ['正在启动 Python…', 'Starting Python…'],
    packages: ['正在载入 {0}…', 'Loading {0}…'],
    running: ['正在运行…', 'Running…'],
    done: ['运行完成，用时 {0} 秒。', 'Finished in {0} s.'],
    fetched: ['这次下载了 {0} MB。', 'Downloaded {0} MB this time.'],
    error: ['程序出错了，错误信息在下面。', 'The program stopped with an error; see below.'],
    stopped: ['已停止。再点运行会重新启动 Python（几秒）。', 'Stopped. Running again restarts Python (a few seconds).'],
    loadFail: ['Pyodide 载入失败（需要联网访问 cdn.jsdelivr.net）。{0}', 'Pyodide failed to load (it needs cdn.jsdelivr.net). {0}'],
    noWorker: ['这个浏览器不支持在后台线程里运行 Python（需要 module Web Worker）。', 'This browser cannot run Python in a background thread (module Web Workers are needed).'],
    noOutput: ['（程序没有输出）', '(no output)'],
    cut: ['（输出太长，后面的省略了）', '(output too long; the rest is left out)'],
    chartBad: ['chart 的格式不对，没有画图。', 'chart is not in the expected format, so nothing was drawn.'],
    output: ['输出', 'Output'],
    chart: ['程序画的图', 'Chart from the program'],
    credit: ['Python 运行环境：', 'Python runtime:'],
  };

  // ── 纯函数 ──────────────────────────────────────────────────────────────
  const fill = (s, args) => s.replace(/\{(\d)\}/g, (_, i) => String(args[i] ?? ''));
  /** 界面文字：t('done', 'en', 1.2) */
  const t = (key, lang, ...args) => fill(STR[key][lang === 'en' ? 1 : 0], args);
  /** 字节数写成 MB，保留一位小数。 */
  const mb = (bytes) => (Math.round((bytes / 1e6) * 10) / 10).toFixed(1);
  /** 第一次运行前的下载说明。 */
  function downloadNote(packages, lang) {
    const pk = (packages || []).filter((p) => DOWNLOAD[p]);
    const total = DOWNLOAD.core + pk.reduce((s, p) => s + DOWNLOAD[p], 0);
    const size = pk.length ? t('sizeWith', lang, mb(total), pk.join(lang === 'en' ? ', ' : '、')) : t('size', lang, mb(total));
    return t('first', lang, '3.14', size);
  }

  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const nums = (v) => (Array.isArray(v) ? v.map(num) : null);
  const label = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, 120) : '');
  /** 把程序给的 chart 整理成能画的样子；画不了时返回 null。非有限数当成断点。 */
  function chartData(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const X = nums(raw.x);
    const list = Array.isArray(raw.series) ? raw.series : raw.y ? [{ y: raw.y, name: raw.name }] : [];
    const series = list.slice(0, 12).map((s, i) => {
      const y = nums(s && s.y), x = nums(s && s.x) || X;
      if (!y || !x) return null;
      const n = Math.min(x.length, y.length, 20000);
      return { name: label(s.name) || `y${i + 1}`, x: x.slice(0, n), y: y.slice(0, n), color: COLORS.includes(s.color) ? s.color : null, dash: !!s.dash };
    }).filter((s) => s && s.y.some((v, i) => v !== null && s.x[i] !== null));
    let k = 0;
    for (const s of series) if (!s.color) s.color = CYCLE[k++ % CYCLE.length];
    const points = (Array.isArray(raw.points) ? raw.points : []).slice(0, 50)
      .filter((p) => p && num(p.x) !== null && num(p.y) !== null).map((p) => ({ x: p.x, y: p.y, label: label(p.label) }));
    if (!series.length && !points.length) return null;
    const span = (lim, vals, pad) => {
      const L = nums(lim);
      if (L && L.length === 2 && L[0] !== null && L[1] !== null && L[0] < L[1]) return [L[0], L[1]];
      let lo = Infinity, hi = -Infinity;
      for (const v of vals) if (v !== null) { if (v < lo) lo = v; if (v > hi) hi = v; }
      if (!(lo <= hi)) return [0, 1];
      if (lo === hi) { const d = Math.abs(lo) * 0.1 || 1; return [lo - d, hi + d]; }
      const d = (hi - lo) * pad;
      return [lo - d, hi + d];
    };
    const xr = span(raw.xlim, [...series.flatMap((s) => s.x), ...points.map((p) => p.x)], 0);
    const inX = (x) => x !== null && x >= xr[0] && x <= xr[1];
    const yr = span(raw.ylim, [...series.flatMap((s) => s.y.filter((_, i) => inX(s.x[i]))), ...points.filter((p) => inX(p.x)).map((p) => p.y)], 0.06);
    return { title: label(raw.title), xlabel: label(raw.xlabel), ylabel: label(raw.ylabel), series, points, xr, yr };
  }
  /** 坐标轴刻度：1、2、5 × 10ⁿ 的整齐数。 */
  function ticks(lo, hi, n = 5) {
    if (!(hi > lo)) return [lo];
    const raw = (hi - lo) / n, p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].find((m) => m * p >= raw) * p;
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
    return out;
  }
  /** 刻度文字：小数位数跟着步长走，负号用 −。 */
  function tickLabel(v, step) {
    const d = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
    const s = Math.abs(v) < step * 1e-6 ? (0).toFixed(d) : v.toFixed(d);
    return s.replace('-', '−');
  }
  /** Pyodide 的报错里先是它自己的几层调用（/lib/python…/_pyodide/），学的人用不着，去掉。 */
  function cleanTraceback(text) {
    const lines = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
    const out = [];
    let skip = false;
    for (const line of lines) {
      const m = line.match(/^ {2}File "([^"]*)"/);
      if (m) { skip = /\/_pyodide\//.test(m[1]); if (!skip) out.push(line); continue; }
      if (skip && /^ {4}/.test(line)) continue;
      skip = false;
      out.push(line);
    }
    return out.join('\n');
  }
  /** 编辑框里的 Tab、Shift+Tab 和回车。返回要把 [from, to) 换成 insert，以及换完后的选区；不用改时返回 null。 */
  function editKey(value, start, end, key) {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    if (key === 'enter') {
      const line = value.slice(lineStart, start);
      const indent = line.match(/^[ ]*/)[0] + (/:\s*$/.test(line) ? '    ' : '');
      const insert = `\n${indent}`;
      return { from: start, to: end, insert, start: start + insert.length, end: start + insert.length };
    }
    const multi = value.slice(start, end).includes('\n');
    if (key === 'tab' && !multi) {
      const col = start - lineStart, insert = ' '.repeat(4 - (col % 4));
      return { from: start, to: end, insert, start: start + insert.length, end: start + insert.length };
    }
    // 多行缩进，或者反缩进：作用在选区经过的每一整行上（选区停在行首时不算那一行）
    const lastEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
    let to = value.indexOf('\n', lastEnd);
    if (to < 0) to = value.length;
    const block = value.slice(lineStart, to).split('\n');
    const changed = block.map((l) => (key === 'tab' ? (l ? `    ${l}` : l) : l.replace(/^ {1,4}/, '')));
    const insert = changed.join('\n');
    if (insert === value.slice(lineStart, to)) return null;
    const ns = start === lineStart && start !== end ? lineStart : Math.max(lineStart, start + changed[0].length - block[0].length);
    const ne = start === end ? ns : Math.max(ns, end + insert.length - (to - lineStart));
    return { from: lineStart, to, insert, start: ns, end: ne };
  }

  // 把程序给的 chart 变成 JSON：numpy 数组转成列表，NaN 和无穷大写成 null。在 Worker 里运行，tools/pyrun-test.mjs 也用它。
  const PY_HELPER = [
    'import json, math',
    'def _clean(o):',
    '    if isinstance(o, dict): return {str(k): _clean(v) for k, v in o.items()}',
    '    if isinstance(o, (list, tuple)): return [_clean(v) for v in o]',
    '    if hasattr(o, "tolist"): return _clean(o.tolist())',
    '    if isinstance(o, float) and not math.isfinite(o): return None',
    '    if o is None or isinstance(o, (bool, int, float, str)): return o',
    '    return str(o)',
    'def to_json(o): return json.dumps(_clean(o))',
  ].join('\n');

  const pure = { VERSION, BASE, DOWNLOAD, STR, PY_HELPER, t, mb, downloadNote, chartData, ticks, tickLabel, cleanTraceback, editKey };
  if (typeof module === 'object' && module.exports) { module.exports = pure; return; }

  // ── Worker（这个函数被转成文本，在 Worker 里运行）────────────────────────
  function workerMain() {
    let py = null, booting = null, toJson = null, seen = 0;
    const post = (type, data = {}) => self.postMessage({ type, ...data });
    // 这次运行新下载的字节数（jsDelivr 回 Timing-Allow-Origin: *，所以 transferSize 读得到；从缓存读的是 0）
    const fetched = () => { const all = performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0); const d = all - seen; seen = all; return d; };
    async function boot(base) {
      const { loadPyodide } = await import(`${base}pyodide.mjs`);
      py = await loadPyodide({ indexURL: base });
      py.setStdout({ batched: (s) => post('out', { text: `${s}\n` }) });
      py.setStderr({ batched: (s) => post('err', { text: `${s}\n` }) });
      try { py.setStdin({ error: true }); } catch { /* 旧版本没有 */ }
      const ns = py.globals.get('dict')();
      py.runPython(PY_HELPER, { globals: ns }); // PY_HELPER 由 spawn() 写在 Worker 源码的最前面
      toJson = ns.get('to_json');
    }
    self.onmessage = async (e) => {
      const m = e.data || {};
      if (m.type !== 'run') return;
      const quiet = { messageCallback: () => {}, errorCallback: (s) => post('err', { text: `${s}\n` }) };
      try {
        if (!py) { post('stage', { stage: 'boot' }); await (booting || (booting = boot(m.base))); }
        const need = m.packages.filter((p) => !py.loadedPackages[p]);
        if (need.length) {
          post('stage', { stage: 'packages', what: need.join(', ') });
          await py.loadPackage(need, quiet);
          const missing = need.filter((p) => !py.loadedPackages[p]);
          if (missing.length) throw new Error(`${missing.join(', ')}`);
        }
      } catch (err) {
        if (!toJson) { booting = null; py = null; }
        post('fail', { stage: 'load', message: String((err && err.message) || err) });
        return;
      }
      // 程序里 import 的别的包（Pyodide 自带的那些）也顺手载入；代码有语法错时这里不管，留给下面运行时报
      try { await py.loadPackagesFromImports(m.code, quiet); } catch { /* 运行时会报出来 */ }
      post('stage', { stage: 'run' });
      const ns = py.globals.get('dict')();
      const t0 = performance.now();
      try {
        await py.runPythonAsync(m.code, { globals: ns, filename: m.filename });
        let chart = null;
        if (m.plot && ns.has(m.plot)) {
          const c = ns.get(m.plot);
          try { chart = toJson(c); } catch (err) { post('err', { text: `${String((err && err.message) || err)}\n` }); }
          if (c && typeof c.destroy === 'function') c.destroy();
        }
        post('done', { ms: performance.now() - t0, chart, fetched: fetched() });
      } catch (err) {
        post('fail', { stage: 'run', message: String((err && err.message) || err), fetched: fetched() });
      } finally {
        ns.destroy();
      }
    };
  }
  let workerUrl = null;
  function spawn() {
    if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([`const PY_HELPER = ${JSON.stringify(PY_HELPER)};\n(${workerMain.toString()})();\n`], { type: 'text/javascript' }));
    return new Worker(workerUrl, { type: 'module', name: 'molastria-python' });
  }

  // ── 画图 ────────────────────────────────────────────────────────────────
  function draw(canvas, data, box) {
    const cs = getComputedStyle(box), v = (n) => cs.getPropertyValue(n).trim();
    const col = { gold: v('--gold'), info: v('--info'), violet: v('--violet') || v('--info'), ok: v('--ok'), danger: v('--danger'), accent: v('--accent-text'), ink: v('--ink-2') || v('--ink'), muted: v('--muted') };
    const w = Math.max(240, canvas.clientWidth || canvas.parentElement.clientWidth);
    const h = Math.round(Math.max(220, Math.min(380, w * 0.58)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const font = (px, weight = 500) => `${weight} ${px}px ${cs.fontFamily}`;
    const pad = { l: 62, r: 14, t: 12, b: 40 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const [x0, x1] = data.xr, [y0, y1] = data.yr;
    const X = (x) => pad.l + ((x - x0) / (x1 - x0)) * W, Y = (y) => pad.t + H - ((y - y0) / (y1 - y0)) * H;
    const xt = ticks(x0, x1, w < 420 ? 4 : 6), yt = ticks(y0, y1, 5);
    const xs = xt.length > 1 ? xt[1] - xt[0] : 1, ys = yt.length > 1 ? yt[1] - yt[0] : 1;
    ctx.lineWidth = 1; ctx.strokeStyle = v('--line'); ctx.fillStyle = v('--muted'); ctx.font = font(11);
    ctx.textAlign = 'center';
    for (const x of xt) { ctx.beginPath(); ctx.moveTo(X(x), pad.t); ctx.lineTo(X(x), pad.t + H); ctx.stroke(); ctx.fillText(tickLabel(x, xs), X(x), pad.t + H + 15); }
    ctx.textAlign = 'right';
    for (const y of yt) { ctx.beginPath(); ctx.moveTo(pad.l, Y(y)); ctx.lineTo(pad.l + W, Y(y)); ctx.stroke(); ctx.fillText(tickLabel(y, ys), pad.l - 6, Y(y) + 4); }
    ctx.strokeStyle = v('--ink-2'); ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
    ctx.fillStyle = v('--ink-2'); ctx.font = font(12); ctx.textAlign = 'center';
    if (data.xlabel) ctx.fillText(data.xlabel, pad.l + W / 2, h - 6);
    if (data.ylabel) { ctx.save(); ctx.translate(13, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(data.ylabel, 0, 0); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
    for (const s of data.series) {
      ctx.beginPath();
      let pen = false;
      s.y.forEach((y, i) => {
        const x = s.x[i];
        if (y === null || x === null) { pen = false; return; }
        if (pen) ctx.lineTo(X(x), Y(y)); else { ctx.moveTo(X(x), Y(y)); pen = true; }
      });
      ctx.setLineDash(s.dash ? [6, 4] : []); ctx.strokeStyle = col[s.color] || col.gold; ctx.lineWidth = s.color === 'ink' ? 2.2 : 1.9; ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const p of data.points) {
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4.5, 0, 2 * Math.PI); ctx.fillStyle = col.danger; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = v('--surface'); ctx.stroke();
      if (p.label) {
        ctx.font = font(11.5, 600); ctx.fillStyle = v('--ink');
        const right = X(p.x) > pad.l + W - 90;
        ctx.textAlign = right ? 'right' : 'left';
        const lx = X(p.x) + (right ? -9 : 9), ly = Math.max(pad.t + 12, Y(p.y) - 8);
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = v('--surface'); ctx.strokeText(p.label, lx, ly); // 底色描边，压在曲线上也看得清
        ctx.fillText(p.label, lx, ly);
      }
    }
    ctx.restore();
  }

  // ── 界面 ────────────────────────────────────────────────────────────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pageLang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');

  /** 在 el 里放一个代码框。opts 见文件头。 */
  function mount(el, opts = {}) {
    if (!el) throw new Error('mount: 没有容器');
    const lang = opts.lang === 'en' || opts.lang === 'zh' ? opts.lang : pageLang();
    const T = (key, ...args) => t(key, lang, ...args);
    const original = `${String(opts.code ?? '').replace(/\r\n?/g, '\n').replace(/\s+$/, '')}\n`;
    const packages = (Array.isArray(opts.packages) ? opts.packages : []).filter((p) => /^[\w.-]+$/.test(p));
    const plot = opts.plot ? (typeof opts.plot === 'string' && /^[A-Za-z_]\w*$/.test(opts.plot) ? opts.plot : 'chart') : '';
    const filename = /^[\w.-]+\.py$/.test(opts.name || '') ? opts.name : 'exercise.py';
    el.classList.add('py-box');
    el.setAttribute('translate', 'no');
    el.lang = lang === 'en' ? 'en' : 'zh-CN';
    el.innerHTML = `<textarea class="py-code" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="${esc(T('code'))}"></textarea>`
      + `<div class="py-bar"><button type="button" class="py-btn primary py-run">${esc(T('run'))}</button><button type="button" class="py-btn py-stop" disabled>${esc(T('stop'))}</button>`
      + `<button type="button" class="py-btn py-reset">${esc(T('reset'))}</button><span class="py-hint">${esc(T('hint'))}</span></div>`
      + `<p class="py-status" role="status" aria-live="polite"></p>`
      + `<pre class="py-out" tabindex="0" aria-label="${esc(T('output'))}" hidden></pre>`
      + `<figure class="py-chart" hidden><figcaption></figcaption><canvas role="img" aria-label="${esc(T('chart'))}"></canvas><ul class="py-legend"></ul></figure>`
      + `<p class="py-foot">${esc(T('credit'))} <a href="https://pyodide.org/" target="_blank" rel="noopener noreferrer">Pyodide ${VERSION} <i class="ico-ext" aria-hidden="true"></i></a> (MPL-2.0)</p>`;
    const ta = el.querySelector('.py-code'), runBtn = el.querySelector('.py-run'), stopBtn = el.querySelector('.py-stop'), resetBtn = el.querySelector('.py-reset');
    const status = el.querySelector('.py-status'), out = el.querySelector('.py-out');
    const fig = el.querySelector('.py-chart'), canvas = fig.querySelector('canvas'), legend = fig.querySelector('.py-legend'), caption = fig.querySelector('figcaption');
    ta.value = original;
    // 高度跟着行数走（12.5px × 1.6 一行，加上内边距），太长的在框里滚动，可以往下拖大
    ta.style.height = `${Math.max(140, Math.min(420, original.split('\n').length * 20 + 26))}px`;

    let worker = null, ready = false, busy = false, chart = null, startedAt = 0, outLen = 0;
    const setState = (s) => { el.dataset.state = s; };
    const say = (text, tone = '') => { status.textContent = text; if (tone) status.dataset.tone = tone; else delete status.dataset.tone; };
    const offline = () => navigator.onLine === false;
    const idleNote = () => (offline() && !ready ? say(T('offline'), 'warn') : ready ? say('') : say(downloadNote(packages, lang)));
    idleNote();
    setState('idle');

    // 输出：攒一帧再写进去
    let queued = [], frame = 0;
    const flush = () => {
      frame = 0;
      const frag = document.createDocumentFragment();
      for (const [kind, text] of queued) {
        if (kind === 'err') { const s = document.createElement('span'); s.className = 'py-err'; s.textContent = text; frag.append(s); } else frag.append(text);
      }
      queued = [];
      out.append(frag);
      out.scrollTop = out.scrollHeight;
    };
    const write = (kind, text) => {
      if (outLen > MAX_OUT) return;
      outLen += text.length;
      if (outLen > MAX_OUT) text = `${text.slice(0, Math.max(0, text.length - (outLen - MAX_OUT)))}\n${T('cut')}\n`;
      out.hidden = false;
      queued.push([kind, text]);
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const legendHtml = (d) => d.series.map((s) => `<li style="--c:var(--${s.color === 'ink' ? 'ink-2' : s.color === 'accent' ? 'accent-text' : s.color})"${s.dash ? ' data-dash' : ''}>${esc(s.name)}</li>`).join('');
    const paint = () => { if (chart && !fig.hidden) draw(canvas, chart, el); };
    const showChart = (json) => {
      chart = null; fig.hidden = true;
      if (!json) return;
      let raw = null;
      try { raw = JSON.parse(json); } catch { /* 下面按格式不对处理 */ }
      const d = chartData(raw);
      if (!d) { write('err', `${T('chartBad')}\n`); return; }
      chart = d;
      caption.textContent = d.title;
      caption.hidden = !d.title;
      legend.innerHTML = legendHtml(d);
      canvas.setAttribute('aria-label', [d.title, d.xlabel && d.ylabel ? `${d.ylabel} – ${d.xlabel}` : '', d.series.map((s) => s.name).join(', ')].filter(Boolean).join(' · '));
      fig.hidden = false;
      paint();
    };

    const finish = () => {
      busy = false;
      runBtn.disabled = false; stopBtn.disabled = true;
    };
    const onMessage = (e) => {
      const m = e.data || {};
      if (m.type === 'out' || m.type === 'err') write(m.type, m.text);
      else if (m.type === 'stage') {
        if (m.stage === 'boot') { say(T(el.dataset.runs ? 'restart' : 'boot')); setState('loading'); }
        else if (m.stage === 'packages') say(T('packages', m.what));
        else { ready = true; say(T('running')); setState('running'); startedAt = performance.now(); }
      } else if (m.type === 'done') {
        if (frame) { cancelAnimationFrame(frame); flush(); }
        if (!outLen) write('out', `${T('noOutput')}\n`);
        const sec = (m.ms / 1000).toFixed(m.ms < 10000 ? 1 : 0);
        say(T('done', sec) + (m.fetched > 2e5 ? `${lang === 'en' ? ' ' : ''}${T('fetched', mb(m.fetched))}` : ''));
        el.dataset.fetched = String(m.fetched || 0);
        showChart(m.chart);
        el.dataset.runs = String(Number(el.dataset.runs || 0) + 1);
        setState('done');
        finish();
      } else if (m.type === 'fail') {
        if (m.stage === 'load') {
          ready = false;
          say(offline() ? T('offline') : T('loadFail', m.message ? `(${m.message.split('\n')[0].slice(0, 160)})` : ''), 'bad');
          worker?.terminate(); worker = null;
          setState('offline');
        } else {
          write('err', `${cleanTraceback(m.message)}\n`);
          say(T('error'), 'bad');
          el.dataset.runs = String(Number(el.dataset.runs || 0) + 1);
          setState('error');
        }
        finish();
      }
    };

    function run() {
      if (busy) return;
      if (!worker && offline()) { say(T('offline'), 'bad'); setState('offline'); return; }
      busy = true; runBtn.disabled = true; stopBtn.disabled = false;
      out.textContent = ''; out.hidden = true; outLen = 0; queued = [];
      fig.hidden = true; chart = null;
      if (!worker) {
        try { worker = spawn(); } catch { say(T('noWorker'), 'bad'); setState('error'); finish(); return; }
        worker.onmessage = onMessage;
        worker.onerror = (ev) => { ev.preventDefault?.(); onMessage({ data: { type: 'fail', stage: 'load', message: ev.message || '' } }); };
        say(T(el.dataset.runs ? 'restart' : 'boot')); setState('loading');
      } else { say(T('running')); setState('running'); }
      worker.postMessage({ type: 'run', base: BASE, code: ta.value, packages, plot, filename });
    }
    function stop() {
      if (!worker) return;
      worker.terminate(); worker = null; ready = false;
      if (frame) { cancelAnimationFrame(frame); flush(); }
      if (busy) { say(T('stopped')); setState('stopped'); }
      finish();
    }
    function reset() {
      ta.focus();
      ta.select();
      if (!document.execCommand?.('insertText', false, original)) ta.value = original;
      ta.setSelectionRange(0, 0);
      ta.scrollTop = 0;
    }
    runBtn.addEventListener('click', run);
    stopBtn.addEventListener('click', stop);
    resetBtn.addEventListener('click', reset);

    // 编辑框：Tab 缩进、Shift+Tab 反缩进、回车保留缩进；Esc 之后的一次 Tab 照常移走焦点
    let release = false;
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
      if (e.key === 'Escape') { release = true; return; }
      if (e.key === 'Tab' && release) { release = false; return; }
      release = false;
      const key = e.key === 'Tab' ? (e.shiftKey ? 'outdent' : 'tab') : e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing ? 'enter' : '';
      if (!key) return;
      e.preventDefault();
      const r = editKey(ta.value, ta.selectionStart, ta.selectionEnd, key);
      if (!r) return;
      ta.setSelectionRange(r.from, r.to);
      const ok = r.insert ? document.execCommand?.('insertText', false, r.insert) : document.execCommand?.('delete');
      if (!ok) ta.setRangeText(r.insert, r.from, r.to, 'end');
      ta.setSelectionRange(r.start, r.end);
    });

    // 网络状态、主题和大小变化
    const onNet = () => { if (!busy && !ready) idleNote(); };
    window.addEventListener('online', onNet); window.addEventListener('offline', onNet);
    const mo = new MutationObserver(paint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', paint);
    let rt = 0;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { cancelAnimationFrame(rt); rt = requestAnimationFrame(paint); }) : null;
    ro?.observe(fig);

    el.dataset.ready = 'true';
    const api = {
      run, stop, reset,
      get code() { return ta.value; },
      set code(v) { ta.value = String(v ?? ''); },
      destroy() {
        stop(); mo.disconnect(); ro?.disconnect(); mq.removeEventListener?.('change', paint);
        window.removeEventListener('online', onNet); window.removeEventListener('offline', onNet);
        el.innerHTML = ''; delete el.dataset.ready; delete el.dataset.state; delete el.py;
      },
    };
    el.py = api;
    return api;
  }

  root.MolAstriaPy = { ...pure, mount };
})(typeof window !== 'undefined' ? window : globalThis);
