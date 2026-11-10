'use strict';
// 量子嘉年华 · 量子物理：把 qp-data.js 画成页面（三幕、时间线、四个交互演示、十二章详解、起步自测、书目库）。
// 内容是中英两版，按站点语言取用，标 translate="no"；页面上的固定文字也在这里成对写出，所以英文页不依赖词典。
// 地址：#c-<章> 打开对应的一章，#d-<演示> 跳到演示。自测勾选存在 localStorage 的 molastria-qp-progress。
(() => {
  const D = window.MOLASTRIA_QP, MATH = window.MOLASTRIA_QP_MATH || {}, M = window.MOLASTRIA_QP_MODELS;
  if (!D || !M) return;
  const SEC = Object.fromEntries((window.MOLASTRIA_QUANTUM_SECTIONS || []).map((s) => [s.id, s]));
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  // 正文里的 x^{…}、e^{−iEt/ħ}、E_h、a_k 之类写成上下标
  const rich = (s) => esc(s)
    .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>')
    .replace(/([\p{L}0-9ħ])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/gu, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(esc(en ? e : zh));
  const R = (t, tag = 'span', cls = '') => C(rich(tx(t)), tag, cls);
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };

  const CH = Object.fromEntries(D.chapters.map((c) => [c.id, c]));
  const B = Object.fromEntries(D.books.map((b) => [b.id, b]));
  const P = Object.fromEntries(D.papers.map((p) => [p.id, p]));
  const V = Object.fromEntries(D.videos.map((v) => [v.id, v]));
  const stageOf = (id) => D.stages.find((s) => s.id === CH[id].stage);
  const num = (id) => D.chapters.findIndex((c) => c.id === id) + 1;
  const short = {
    birth: ['量子的诞生', 'Birth of the quantum'], wave: ['薛定谔方程', 'Schrödinger equation'], ops: ['态与测量', 'States & measurement'], ang: ['角动量与氢原子', 'Angular momentum'],
    approx: ['近似方法', 'Approximations'], ident: ['全同粒子', 'Identical particles'], ent: ['纠缠与 Bell', 'Entanglement & Bell'], open: ['退相干', 'Decoherence'], scat: ['散射', 'Scattering'],
    rel: ['相对论与量子场', 'Relativity & fields'], cond: ['凝聚态', 'Condensed matter'], optics: ['量子光学与冷原子', 'Quantum optics'],
  };
  const sn = (id) => (en ? short[id][1] : short[id][0]);
  const chip = (id) => `<a class="fm-chip" data-tier="${CH[id].stage}" href="#c-${id}" data-open="${id}" translate="no" lang="${lang}">${num(id)} · ${esc(sn(id))}</a>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const hall = (id, hash = '') => {
    const s = SEC[id]; if (!s) return '';
    const name = esc(tx(s.title));
    return s.live ? `<a class="qp-hall" data-hall="${id}" href="../${esc(s.path)}${hash ? `#${esc(hash)}` : ''}" translate="no" lang="${lang}">${name} ${ext}</a>` : `<span class="qp-hall" data-hall="${id}" data-soon translate="no" lang="${lang}">${name}${L('（即将上线）', ' (coming soon)')}</span>`;
  };
  const progress = new Set(store.get('molastria-qp-progress', []));
  const saveProgress = () => store.set('molastria-qp-progress', [...progress]);

  if (en) document.title = 'Quantum Physics · Quantum Carnival · MolAstria';

  // ── 首屏 ──────────────────────────────────────────────────────────────
  $('#qp-crumbs').innerHTML = `<a href="../index.html">${L('量子嘉年华', 'Quantum Carnival')}</a><span aria-hidden="true">/</span>${L('量子物理', 'Quantum Physics')}`;
  $('#qp-quote').innerHTML = C(esc(tx(D.hero.quote))) + `<span class="fs-q-en" lang="en" translate="no">${en ? '' : `${esc(D.hero.quote.en)} · `}${esc(D.hero.quoteBy)}</span>`;
  $('#qp-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#qp-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  const freeN = D.books.filter((b) => b.free).length;
  $('#qp-stats').innerHTML = [
    [D.chapters.length, '章', 'chapters'], [4, '个交互演示', 'interactive demos'], [D.papers.length, '篇原始论文', 'original papers'],
    [D.books.length, '本教材与讲义', 'textbooks & notes'], [freeN, '份可合法免费阅读', 'free to read legally'], [D.videos.length, '门课程与视频', 'courses & videos'],
  ].map(([n, zh, e]) => `<div><dt translate="no">${n}</dt><dd>${L(zh, e)}</dd></div>`).join('');
  $('#qp-jump').innerHTML = [
    ['#qp-chapters', '十二章详解', 'The twelve chapters', true], ['#qp-lab', '交互演示', 'Interactive demos'], ['#qp-timeline', '关键实验时间线', 'Timeline of key experiments'],
    ['#qp-start', '从哪里开始', 'Where to start'], ['#qp-library', '论文、教材与课程', 'Papers, books & courses'],
  ].map(([h, zh, e, p]) => `<a class="button${p ? ' primary' : ''}" href="${h}">${L(zh, e)}</a>`).join('');

  // ── 三幕 ──────────────────────────────────────────────────────────────
  $('#qp-acts-h').innerHTML = L('三幕十二章', 'Twelve chapters in three acts');
  $('#qp-acts-note').innerHTML = L('第一幕按顺序读；第二幕和第三幕可以按兴趣挑。点章名直接打开详解。', 'Read Act I in order; pick from Acts II and III by interest. Click a chapter to open it.');
  $('#qp-act-grid').innerHTML = D.stages.map((t) => `<article class="fm-tier" data-tier="${t.id}">
      <p class="fm-tier-n">${R(t.name)}</p><h3>${R(t.tag)}</h3><p>${R(t.desc)}</p>
      <ul>${D.chapters.filter((c) => c.stage === t.id).map((c) => `<li><a href="#c-${c.id}" data-open="${c.id}"><span class="fm-glyph" aria-hidden="true">${esc(c.glyph)}</span>${C(`${num(c.id)}. ${esc(tx(c.name))}`)}</a>${C(rich(tx(c.tagline)), 'small')}</li>`).join('')}</ul>
    </article>`).join('');

  // ── 时间线 ────────────────────────────────────────────────────────────
  $('#qp-timeline-h').innerHTML = L('关键实验与理论的时间线', 'Timeline of key experiments and ideas');
  $('#qp-timeline-note').innerHTML = L('每一条都连到原始论文（DOI 在 Crossref 核对过）和讲它的那一章。横向滑动看完整的一百多年。', 'Each entry links to the original paper (DOI checked against Crossref) and to the chapter that covers it. Scroll sideways for the whole century and more.');
  $('#qp-time-list').innerHTML = D.timeline.map((e) => { const p = P[e.paper]; return `<li data-tier="${CH[e.ch].stage}"><span class="qp-year" translate="no">${e.y}</span>${R(e.t, 'p')}
      <p class="qp-time-ref"><a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(p.au.split(',')[0].replace(/ et al\.$/, ''))}${p.au.includes(',') || / et al\.$/.test(p.au) ? ' et al.' : ''}, ${esc(p.j)} ${esc(p.v)}, ${esc(p.p)} (${p.y}) ${ext}</a></p>${chip(e.ch)}</li>`; }).join('');

  // ── 画图工具 ──────────────────────────────────────────────────────────
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent-text'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok'), danger: g('--danger'), paper: g('--paper'), surface: g('--surface'), violet: g('--violet') }; };
  const fit = (cv) => {
    const ratio = Number(cv.dataset.ratio || (cv.dataset.ratio = cv.height / cv.width));
    const w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * ratio), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  };
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  const sup = (s) => String(s).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  const fmt = (v, d = 3) => (!Number.isFinite(v) ? '—' : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`) : Number(v.toPrecision(d)).toString());
  const ticks = (a, b, n = 5) => { const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(10))); return out; };
  // 坐标轴框架：返回坐标换算和画布
  const axes = (cv, o) => {
    const { ctx, w, h } = fit(cv), c = css();
    const pad = { l: 50, r: 12, t: 26, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const X = (v) => pad.l + ((v - o.x0) / (o.x1 - o.x0)) * W, Y = (v) => pad.t + H - ((v - o.y0) / (o.y1 - o.y0)) * H;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    for (const t of o.xt) { ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), pad.t + H); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(o.xf ? o.xf(t) : t, X(t), pad.t + H + 15); }
    for (const t of o.yt) { ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + W, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(o.yf ? o.yf(t) : t, pad.l - 6, Y(t) + 4); }
    ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = 'center'; ctx.fillText(o.xl, pad.l + W / 2, h - 4);
    ctx.save(); ctx.translate(12, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore();
    const line = (xs, ys, color, width = 2, dash = []) => { ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip(); ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(ys[i])) : ctx.moveTo(X(x), Y(ys[i])))); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.restore(); };
    const legend = (items) => { let lx = pad.l + 6; ctx.font = font(11.5); for (const [label, color, dash] of items) { ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(lx, 12); ctx.lineTo(lx + 18, 12); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(label, lx + 22, 16); lx += 32 + ctx.measureText(label).width; } };
    return { ctx, c, X, Y, pad, W, H, line, legend };
  };
  const readout = (el, rows) => { el.innerHTML = rows.map(([zh, e, v, big]) => `<dt>${L(zh, e)}</dt><dd${big ? ' class="fs-big"' : ''} translate="no">${v}</dd>`).join(''); };
  const slider = (id, zh, e, min, max, step, value) => `<label>${L(zh, e)}<span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><output id="${id}-v"></output></span></label>`;
  const demo = (n, id, zh, e, introZh, introEn, mathKey, controls, figure, notesZh, notesEn) => `<article class="fs-demo" id="d-${id}" aria-labelledby="d-${id}-h" tabindex="-1">
      <header><p class="fs-demo-n">${L(`演示 ${n}`, `Demo ${n}`)}</p><h3 id="d-${id}-h">${L(zh, e)}</h3><p class="muted">${C(rich(en ? introEn : introZh))}</p></header>
      ${mathKey ? formula(mathKey) : ''}
      <div class="fs-demo-body"><div class="fs-controls">${controls}</div>${figure}</div>
      <details class="fs-notes"><summary>${L('模型说明与局限', 'About the model and its limits')}</summary><p>${C(rich(en ? notesEn : notesZh))}</p></details>
    </article>`;

  // ── 交互演示 ──────────────────────────────────────────────────────────
  $('#qp-lab-h').innerHTML = L('交互演示', 'Interactive demos');
  $('#qp-lab-note').innerHTML = L('四个演示都在浏览器里直接计算：曲线和数字随参数实时重算，不是预先画好的动画。每个演示下方写明了模型省略了什么。', 'All four demos compute in your browser: curves and numbers are recalculated live as you move the controls, not pre-drawn animations. Each says below what the model leaves out.');
  const KINDS = [['harmonic', '谐振子', 'Harmonic oscillator'], ['well', '有限深方势阱', 'Finite square well'], ['double', '双势阱（隧穿劈裂）', 'Double well (tunnelling splitting)'], ['morse', 'Morse 势（化学键）', 'Morse potential (a chemical bond)']];
  const PARTICLES = [['e', '电子', 'electron'], ['mu', 'μ 子', 'muon'], ['p', '质子（H）', 'proton (H)'], ['d', '氘核（D）', 'deuteron (D)']];
  $('#qp-demos').innerHTML = [
    demo(1, 'states', '一维定态：能级与波函数', 'Stationary states in one dimension: levels and wavefunctions',
      '选一个势能，浏览器用有限差分把定态薛定谔方程离散成矩阵，再用 Sturm 序列二分法求最低六个能级和波函数。谐振子和 Morse 势有解析解，可以直接对照误差。',
      'Pick a potential; the browser discretises the time-independent Schrödinger equation by finite differences and finds the lowest six levels and wavefunctions by Sturm-sequence bisection. The harmonic oscillator and Morse potential have exact solutions to compare against.',
      null,
      `<label>${L('势能', 'Potential')}<select id="d1-kind" translate="no">${KINDS.map(([k, zh, e]) => `<option value="${k}">${esc(en ? e : zh)}</option>`).join('')}</select></label>
       ${slider('d1-p', '势的参数', 'Potential parameter', 0, 100, 1, 50)}
       <dl class="fs-readout" id="d1-read" aria-live="polite"></dl>`,
      `<figure class="fs-figure"><canvas id="d1-canvas" width="720" height="420" role="img"></canvas><figcaption id="d1-cap"></figcaption></figure>`,
      '单位取 ħ = m = 1，网格 700 点、范围 −7 到 7，两端波函数强制为零（相当于外面再套一个无限深势阱），所以接近势阱顶部的能级会受盒子大小影响。有限差分的误差随格点间距平方减小；谐振子最低六个能级的误差在 10⁻³ 以内。双势阱里最低两个能级的差就是隧穿劈裂，势垒越高它越小（氨分子的翻转频率就是这个劈裂）。Morse 势的能级间距随 n 减小，模拟的是真实化学键的非谐性。',
      'Units are ħ = m = 1 on a 700-point grid from −7 to 7, with the wavefunction forced to zero at the ends (an infinite wall outside), so levels near the top of a well feel the size of the box. The finite-difference error shrinks as the square of the grid spacing; for the lowest six oscillator levels it is below 10⁻³. In the double well the gap between the lowest two levels is the tunnelling splitting, which shrinks as the barrier rises (the inversion frequency of ammonia is this splitting). Morse levels get closer together as n grows, mimicking the anharmonicity of a real chemical bond.'),
    demo(2, 'tunnel', '隧穿：透射率与波包', 'Tunnelling: transmission and a wave packet',
      '方势垒的透射率 T(E) 用精确公式计算，单位是 eV 和 Å。换成质子或氘核，透射率掉几个数量级：这就是隧穿对同位素效应的贡献。点“发射波包”，看一个高斯波包撞上同样形状的势垒，一部分反射、一部分穿过去。',
      'The transmission T(E) of a square barrier is computed from the exact formula, in eV and Å. Switch to a proton or deuteron and it drops by orders of magnitude: tunnelling\'s contribution to isotope effects. Press "Fire a wave packet" to watch a Gaussian packet hit a barrier of the same shape and split into reflected and transmitted parts.',
      'waveTunnel',
      `<label>${L('粒子', 'Particle')}<select id="d2-m" translate="no">${PARTICLES.map(([k, zh, e]) => `<option value="${k}">${esc(en ? e : zh)}</option>`).join('')}</select></label>
       ${slider('d2-v', '势垒高度 V₀（eV）', 'Barrier height V₀ (eV)', 0.1, 3, 0.05, 1)}
       ${slider('d2-a', '势垒宽度 a（Å）', 'Barrier width a (Å)', 0.1, 10, 0.1, 3)}
       ${slider('d2-e', '粒子能量 E / V₀', 'Particle energy E / V₀', 0.05, 2, 0.01, 0.5)}
       <div class="fs-btns"><button type="button" class="button primary" id="d2-go">${L('发射波包', 'Fire a wave packet')}</button><button type="button" class="button" id="d2-stop">${L('停止', 'Stop')}</button></div>
       <dl class="fs-readout" id="d2-read" aria-live="polite"></dl>`,
      `<div class="qp-figs"><figure class="fs-figure"><canvas id="d2-canvas" width="720" height="300" role="img"></canvas><figcaption id="d2-cap"></figcaption></figure>
       <figure class="fs-figure"><canvas id="d2-packet" width="720" height="220" role="img"></canvas><figcaption id="d2-pcap"></figcaption></figure></div>`,
      '透射率是一维方势垒对单一能量平面波的精确结果；真实的化学反应势垒是光滑的、多维的，隧穿还和振动、溶剂重组耦合在一起，所以这里的数字只说明量级和趋势。WKB 曲线是 e^{−2κa} 的粗估，只在 κa ≫ 1 时可靠。波包演示用 ħ = m = 1 的无量纲单位，势垒的“强度” κ₀a 与上面的设置相同，用 Crank–Nicolson 方法逐步演化（保持归一化）；波包含有一段能量分布，所以它的透射比例是 T(E) 在这段能量上的平均，readout 里同时给出这个平均值作对照。',
      'The transmission is the exact result for a single-energy plane wave on a 1D square barrier; real reaction barriers are smooth and many-dimensional, and tunnelling couples to vibrations and solvent reorganisation, so these numbers show orders of magnitude and trends only. The WKB curve is the crude estimate e^{−2κa}, reliable only when κa ≫ 1. The packet uses dimensionless units ħ = m = 1 with the same barrier "strength" κ₀a as above and is evolved by Crank–Nicolson (which preserves the norm); a packet carries a spread of energies, so its transmitted fraction is T(E) averaged over that spread, and the readout shows that average for comparison.'),
    demo(3, 'sg', 'Stern–Gerlach 串联', 'Stern–Gerlach in series',
      '第一台装置挑出沿 z 向上的原子；第二台和第三台可以转到任意角度，每一台只让“向上”的那一束继续往下走。把第二台转到 90°（x 方向），第三台转回 0°：被第一台挑干净的“向下”又出现了。',
      'The first device selects atoms with spin up along z; the second and third can be turned to any angle, and each passes only its "up" beam onward. Turn the second to 90° (along x) and the third back to 0°: the "down" atoms the first device removed come back.',
      null,
      `${slider('d3-b', '第二台的角度 θ₂', 'Angle of device 2, θ₂', 0, 180, 5, 90)}
       ${slider('d3-c', '第三台的角度 θ₃', 'Angle of device 3, θ₃', 0, 180, 5, 0)}
       <div class="fs-btns"><button type="button" class="button primary" id="d3-go">${L('发射 1000 个原子', 'Send 1000 atoms')}</button><button type="button" class="button" id="d3-x">${L('经典的“擦除”设置', 'The classic "erasure" setting')}</button></div>
       <dl class="fs-readout" id="d3-read" aria-live="polite"></dl>`,
      `<figure class="fs-figure"><div class="qp-sg" id="d3-chain" role="img"></div><figcaption id="d3-cap"></figcaption></figure>`,
      '每台装置的“向上”概率是 cos²(Δθ/2)，Δθ 是自旋方向和装置方向的夹角；通过之后自旋就沿装置的方向。原子数按这个概率随机抽样，所以每次计数有统计涨落（约 √N）。真实的银原子还有轨道和核自旋，磁场梯度也不完美，这里只保留了自旋 ½ 这一个自由度。',
      'Each device passes "up" with probability cos²(Δθ/2), where Δθ is the angle between the spin and the device; after passing, the spin points along the device. Atom counts are drawn at random with these probabilities, so each run fluctuates (by about √N). Real silver atoms also have orbital and nuclear spin and the field gradient is imperfect; only the spin-½ degree of freedom is kept here.'),
    demo(4, 'bell', 'Bell 不等式：CHSH 实验', 'Bell\'s inequality: a CHSH experiment',
      '一对处在自旋单态的粒子飞向 Alice 和 Bob，两人各从两个方向中选一个测量。量子力学预言关联 E = −cos(a − b)；一个最简单的定域隐变量模型给出折线。选好四个角度，比较两者的 S 值，再“做实验”看有统计误差的结果。',
      'A pair of particles in the spin singlet flies to Alice and Bob, who each measure along one of two directions. Quantum mechanics predicts the correlation E = −cos(a − b); one of the simplest local hidden-variable models gives a zigzag. Choose four angles, compare the S values, then "run the experiment" to see a result with statistical error.',
      'entCHSH',
      `${slider('d4-a', 'Alice 的方向 a', 'Alice\'s setting a', 0, 180, 1, 0)}
       ${slider('d4-a2', 'Alice 的方向 a′', 'Alice\'s setting a′', 0, 180, 1, 90)}
       ${slider('d4-b', 'Bob 的方向 b', 'Bob\'s setting b', 0, 180, 1, 45)}
       ${slider('d4-b2', 'Bob 的方向 b′', 'Bob\'s setting b′', 0, 180, 1, 135)}
       <div class="fs-btns"><button type="button" class="button primary" id="d4-go">${L('每组设置测 2000 对', 'Measure 2000 pairs per setting')}</button><button type="button" class="button" id="d4-best">${L('最优角度', 'Optimal angles')}</button></div>
       <dl class="fs-readout" id="d4-read" aria-live="polite"></dl>`,
      `<figure class="fs-figure"><canvas id="d4-canvas" width="720" height="360" role="img"></canvas><figcaption id="d4-cap"></figcaption></figure>`,
      '隐变量模型：每对粒子带一个随机角度 λ，Alice 的结果是 cos(a − λ) 的符号，Bob 的结果是 −cos(b − λ) 的符号。它在 a = b 时完美反关联，但关联随角度线性变化，|S| 永远不超过 2；任何定域隐变量模型都逃不过这个上限，这正是 Bell 定理。模拟实验按量子概率抽样；真实实验还要处理探测效率、定域性（设置的选择要在光传过去之前完成）和随机数来源，2015 年的无漏洞实验同时满足了这些条件。',
      'The hidden-variable model: each pair carries a random angle λ; Alice\'s result is the sign of cos(a − λ) and Bob\'s the sign of −cos(b − λ). It is perfectly anticorrelated at a = b, but its correlation changes linearly with angle and |S| never exceeds 2; no local hidden-variable model can beat that bound, which is Bell\'s theorem. The simulated experiment samples the quantum probabilities; real experiments must also deal with detection efficiency, locality (settings chosen before light could carry the news) and the source of randomness, all of which the 2015 loophole-free tests satisfied together.'),
  ].join('');
  for (const el of document.querySelectorAll('#qp-demos select')) el.setAttribute('translate', 'no');

  // 演示 1
  const D1 = { harmonic: { key: 'omega', lo: 0.4, hi: 2, zh: '角频率 ω', en: 'angular frequency ω' }, well: { key: 'V0', lo: 2, hi: 24, zh: '阱深 V₀（阱宽 2）', en: 'depth V₀ (width 2)' }, double: { key: 'b', lo: 1, hi: 2.2, zh: '两阱间距的一半 b', en: 'half-separation b' }, morse: { key: 'D', lo: 3, hi: 16, zh: '解离能 D', en: 'dissociation energy D' } };
  const draw1 = () => {
    const kind = $('#d1-kind').value, cfg = D1[kind], t = Number($('#d1-p').value) / 100, val = cfg.lo + (cfg.hi - cfg.lo) * t, p = { [cfg.key]: val };
    $('#d1-p-v').textContent = `${en ? cfg.en : cfg.zh} = ${fmt(val)}`;
    const { x, V, states } = M.states(kind, p, 6, 7, 700);
    const top = states[5].E, ymax = Math.max(top * 1.18, 1), ymin = Math.min(0, ...V) - 0.04 * ymax, scale = Math.min(0.5, (states[1].E - states[0].E) * 0.45) * 1.6;
    const cv = $('#d1-canvas'), a = axes(cv, { x0: -7, x1: 7, y0: ymin, y1: ymax, xt: ticks(-7, 7, 7), yt: ticks(0, ymax, 5), yf: (v) => fmt(v, 2), xl: en ? 'position x (ħ = m = 1)' : '位置 x（ħ = m = 1）', yl: en ? 'energy' : '能量' });
    a.line(x, V.map((v) => Math.min(v, ymax * 2)), a.c.ink2, 2.2);
    const cols = [a.c.gold, a.c.info, a.c.violet, a.c.ok, a.c.danger, a.c.accent];
    states.forEach((s, n) => { a.line([x[0], x[x.length - 1]], [s.E, s.E], a.c.line, 1, [4, 4]); a.line(x, s.psi.map((v) => s.E + v * scale), cols[n], 1.8); a.ctx.fillStyle = cols[n]; a.ctx.font = font(11, 600); a.ctx.textAlign = 'left'; a.ctx.fillText(`n=${n}`, a.pad.l + a.W - 34, a.Y(s.E) - 4); });
    a.legend([[en ? 'V(x)' : '势能 V(x)', a.c.ink2], [en ? 'ψₙ(x), drawn at height Eₙ' : 'ψₙ(x)，画在 Eₙ 的高度', a.c.gold]]);
    const ex = M.exact[kind];
    const rows = states.map((s, n) => [`E${n}`, `E${n}`, ex ? `${fmt(s.E, 5)}  (${en ? 'exact' : '解析'} ${fmt(ex(n, p), 5)})` : fmt(s.E, 5), n === 0]);
    if (kind === 'double') rows.push(['隧穿劈裂 E₁ − E₀', 'Tunnelling splitting E₁ − E₀', fmt(states[1].E - states[0].E), true]);
    else rows.push(['间距 E₁ − E₀ / E₅ − E₄', 'Spacing E₁ − E₀ / E₅ − E₄', `${fmt(states[1].E - states[0].E)} / ${fmt(states[5].E - states[4].E)}`]);
    readout($('#d1-read'), rows.map(([zh, e, v, b]) => [zh, e, v, b]));
    const cap = en ? `Lowest six levels of the ${KINDS.find((k) => k[0] === kind)[2].toLowerCase()}; ground state E₀ = ${fmt(states[0].E, 4)}.` : `${KINDS.find((k) => k[0] === kind)[1]}的最低六个能级；基态 E₀ = ${fmt(states[0].E, 4)}。`;
    $('#d1-cap').innerHTML = C(esc(cap)); cv.setAttribute('aria-label', cap);
  };
  $('#d1-kind').addEventListener('change', draw1); $('#d1-p').addEventListener('input', draw1);

  // 演示 2
  let anim = null;
  const d2params = () => { const m = M.MASS[$('#d2-m').value], V0 = Number($('#d2-v').value), a = Number($('#d2-a').value), r = Number($('#d2-e').value); return { m, V0, a, r, E: r * V0 }; };
  const draw2 = () => {
    const { m, V0, a, r, E } = d2params();
    $('#d2-v-v').textContent = `${fmt(V0)} eV`; $('#d2-a-v').textContent = `${fmt(a)} Å`; $('#d2-e-v').textContent = `${fmt(r)} (${fmt(E)} eV)`;
    const Es = Array.from({ length: 400 }, (_, i) => (2 * V0 * (i + 1)) / 400), T = Es.map((e) => M.transmission(e, V0, a, m));
    const lo = Math.max(-30, Math.floor(Math.log10(Math.max(1e-30, Math.min(...T))))), cv = $('#d2-canvas');
    const ax = axes(cv, { x0: 0, x1: 2 * V0, y0: lo, y1: 0.3, xt: ticks(0, 2 * V0, 6), yt: ticks(lo, 0, 6).filter((v) => Number.isInteger(v)), yf: (v) => `10${sup(v)}`, xl: en ? 'particle energy E (eV)' : '粒子能量 E（eV）', yl: en ? 'transmission T' : '透射率 T' });
    const lg = (v) => Math.log10(Math.max(v, 1e-30));
    ax.line([V0, V0], [lo, 0.3], ax.c.muted, 1, [3, 3]);
    const below = Es.filter((e) => e < V0);
    ax.line(below, below.map((e) => lg(M.wkb(e, V0, a, m))), ax.c.violet, 1.6, [6, 4]);
    ax.line(Es, T.map(lg), ax.c.gold, 2.4);
    const t = M.transmission(E, V0, a, m); ax.ctx.fillStyle = ax.c.danger; ax.ctx.beginPath(); ax.ctx.arc(ax.X(E), ax.Y(lg(t)), 4.5, 0, 2 * Math.PI); ax.ctx.fill();
    ax.legend([[en ? 'exact T(E)' : '精确 T(E)', ax.c.gold], [en ? 'WKB e^(−2κa)' : 'WKB 粗估 e^(−2κa)', ax.c.violet, [6, 4]]]);
    const tH = M.transmission(E, V0, a, M.MASS.p), tD = M.transmission(E, V0, a, M.MASS.d);
    readout($('#d2-read'), [['透射率 T', 'Transmission T', fmt(t), true], ['WKB 粗估', 'WKB estimate', fmt(M.wkb(E, V0, a, m))], ['同样条件下 T(H) / T(D)', 'T(H) / T(D), same barrier', fmt(tH / tD)], ['κa（势垒的“厚度”）', 'κa (barrier "thickness")', E < V0 ? fmt(Math.sqrt((V0 - E) * m / M.HB2M) * a) : '—']]);
    const cap = en ? `Transmission of a ${PARTICLES.find((p) => p[0] === $('#d2-m').value)[2]} through a ${fmt(V0)} eV, ${fmt(a)} Å barrier: T = ${fmt(t)} at E = ${fmt(E)} eV.` : `${PARTICLES.find((p) => p[0] === $('#d2-m').value)[1]}穿过高 ${fmt(V0)} eV、宽 ${fmt(a)} Å 的势垒：E = ${fmt(E)} eV 时 T = ${fmt(t)}。`;
    $('#d2-cap').innerHTML = C(esc(cap)); cv.setAttribute('aria-label', cap);
    if (!anim) drawPacket(null);
  };
  // 波包：无量纲单位，V₀ = 1，宽度按 κ₀a 换算
  const packetSetup = () => {
    const { m, V0, a, r } = d2params();
    const aau = Math.min(6, Math.max(0.15, (a * Math.sqrt((m * V0) / M.HB2M)) / Math.SQRT2));
    const x = M.grid(90, 1800), V = x.map((v) => (Math.abs(v) <= aau / 2 ? 1 : 0)), k0 = Math.sqrt(2 * r), sigma = 5;
    return { x, V, aau, k0, sigma, psi: M.packet(x, -30, k0, sigma), step: M.cnStepper(x, V, 0.04), t: 0, avg: M.packetTransmission(k0, sigma, 1, aau) };
  };
  const drawPacket = (s) => {
    const cv = $('#d2-packet'), st = s || packetSetup();
    const dens = st.x.map((_, i) => st.psi[2 * i] ** 2 + st.psi[2 * i + 1] ** 2), peak = Math.max(0.12, ...dens) * 1.1;
    const ax = axes(cv, { x0: -60, x1: 60, y0: 0, y1: peak, xt: ticks(-60, 60, 6), yt: [], xl: en ? 'position (ħ = m = 1)' : '位置（ħ = m = 1）', yl: '|ψ|²' });
    ax.ctx.fillStyle = `color-mix(in srgb, ${ax.c.muted} 25%, transparent)`;
    ax.ctx.fillRect(ax.X(-st.aau / 2), ax.pad.t, Math.max(2, ax.X(st.aau / 2) - ax.X(-st.aau / 2)), ax.H);
    ax.line(st.x, dens, ax.c.info, 2);
    const right = M.weightRight(st.x, st.psi, st.aau / 2);
    $('#d2-pcap').innerHTML = C(esc(en ? `Wave packet (grey band = barrier). Probability beyond the barrier: ${fmt(right)}; T(E) averaged over the packet: ${fmt(st.avg)}.` : `波包（灰色带是势垒）。已穿过势垒的概率：${fmt(right)}；T(E) 在波包能量分布上的平均：${fmt(st.avg)}。`));
    cv.setAttribute('aria-label', en ? 'Wave packet hitting the barrier' : '波包撞上势垒');
  };
  const stopAnim = () => { if (anim) cancelAnimationFrame(anim.raf); anim = null; };
  $('#d2-go').addEventListener('click', () => {
    stopAnim(); const s = packetSetup(); anim = { s, raf: 0 };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => { if (!anim) return; s.step(s.psi, reduce ? 400 : 12); s.t += reduce ? 400 : 12; drawPacket(s); if (s.t < 1600 * (1.3 / Math.max(0.3, s.k0)) && !reduce) anim.raf = requestAnimationFrame(tick); else anim = null; };
    tick();
  });
  $('#d2-stop').addEventListener('click', stopAnim);
  for (const id of ['d2-m', 'd2-v', 'd2-a', 'd2-e']) $(`#${id}`).addEventListener('input', () => { stopAnim(); draw2(); });

  // 演示 3
  let seed = 7;
  const draw3 = (counts) => {
    const b = Number($('#d3-b').value), c = Number($('#d3-c').value), r = Math.PI / 180, angles = [0, b * r, c * r];
    $('#d3-b-v').textContent = `${b}°`; $('#d3-c-v').textContent = `${c}°`;
    const p2 = M.pass(0, b * r), p3 = M.pass(b * r, c * r), all = M.chain(angles);
    const box = (n, ang, pin, cnt) => `<div class="qp-sg-dev"><span class="qp-sg-n">${L(`装置 ${n}`, `Device ${n}`)}</span><span class="qp-sg-ang" translate="no" style="--ang:${ang}deg"><i></i></span><b translate="no">${ang}°</b>${pin != null ? `<small>${L(`向上的概率 ${fmt(pin)}`, `P(up) = ${fmt(pin)}`)}</small>` : `<small>${L('只留向上的一束', 'keeps the up beam')}</small>`}${cnt != null ? `<span class="qp-sg-count" translate="no">${cnt}</span>` : ''}</div>`;
    $('#d3-chain').innerHTML = `<div class="qp-sg-src">${L('原子炉', 'Oven')}${counts ? `<span class="qp-sg-count" translate="no">${counts[0]}</span>` : ''}</div><span class="qp-sg-arrow" aria-hidden="true"></span>${box(1, 0, null, counts ? counts[0] : null)}<span class="qp-sg-arrow" aria-hidden="true"></span>${box(2, b, p2, counts ? counts[1] : null)}<span class="qp-sg-arrow" aria-hidden="true"></span>${box(3, c, p3, counts ? counts[2] : null)}`;
    readout($('#d3-read'), [['第二台通过的比例', 'Fraction through device 2', fmt(p2)], ['第三台通过的比例', 'Fraction through device 3', fmt(p3)], ['穿过全部三台', 'Through all three', fmt(all), true], ...(counts ? [['这次实验：穿过全部三台', 'This run: through all three', `${counts[2]} / ${counts[0]}`]] : [])]);
    const cap = en ? `Devices at 0°, ${b}°, ${c}°: ${fmt(all * 100)}% of the selected atoms pass all three.` : `三台装置分别在 0°、${b}°、${c}°：被选出的原子中有 ${fmt(all * 100)}% 穿过全部三台。`;
    $('#d3-cap').innerHTML = C(esc(cap)); $('#d3-chain').setAttribute('aria-label', cap);
  };
  $('#d3-b').addEventListener('input', () => draw3()); $('#d3-c').addEventListener('input', () => draw3());
  $('#d3-go').addEventListener('click', () => { const r = Math.PI / 180; draw3(M.runChain([0, Number($('#d3-b').value) * r, Number($('#d3-c').value) * r], 1000, M.rng(seed++))); });
  $('#d3-x').addEventListener('click', () => { $('#d3-b').value = 90; $('#d3-c').value = 180; draw3(); });

  // 演示 4
  const draw4 = (sim) => {
    const deg = (id) => Number($(`#${id}`).value), r = Math.PI / 180, [a, a2, b, b2] = ['d4-a', 'd4-a2', 'd4-b', 'd4-b2'].map(deg);
    for (const id of ['d4-a', 'd4-a2', 'd4-b', 'd4-b2']) $(`#${id}-v`).textContent = `${deg(id)}°`;
    const Sq = M.S(M.Eqm, a * r, a2 * r, b * r, b2 * r), Sl = M.S(M.Elhv, a * r, a2 * r, b * r, b2 * r);
    const cv = $('#d4-canvas'), ax = axes(cv, { x0: 0, x1: 180, y0: -1.1, y1: 1.1, xt: [0, 45, 90, 135, 180], yt: [-1, -0.5, 0, 0.5, 1], xf: (v) => `${v}°`, xl: en ? 'angle between the two settings' : '两边测量方向的夹角', yl: en ? 'correlation E' : '关联 E' });
    const th = Array.from({ length: 181 }, (_, i) => i);
    ax.line(th, th.map((t) => M.Elhv(0, t * r)), ax.c.violet, 2, [6, 4]);
    ax.line(th, th.map((t) => M.Eqm(0, t * r)), ax.c.gold, 2.4);
    const pairs = [[a, b, 'ab'], [a, b2, "ab′"], [a2, b, "a′b"], [a2, b2, "a′b′"]];
    const dOf = (x, y) => Math.abs(x - y), groups = new Map();
    pairs.forEach(([x, y, lab], i) => { const d = dOf(x, y); groups.set(d, [...(groups.get(d) || []), lab]); if (sim) { ax.ctx.strokeStyle = ax.c.info; ax.ctx.lineWidth = 2; ax.ctx.strokeRect(ax.X(d) - 4, ax.Y(sim.E[i]) - 4, 8, 8); } });
    for (const [d, labs] of groups) { const y = ax.Y(M.Eqm(0, d * r)); ax.ctx.fillStyle = ax.c.danger; ax.ctx.beginPath(); ax.ctx.arc(ax.X(d), y, 4, 0, 2 * Math.PI); ax.ctx.fill(); ax.ctx.font = font(11, 600); ax.ctx.textAlign = d > 150 ? 'right' : d < 30 ? 'left' : 'center'; ax.ctx.fillText(labs.join(', '), ax.X(d) + (d > 150 ? -8 : d < 30 ? 8 : 0), y + (M.Eqm(0, d * r) > 0 ? 16 : -10)); }
    ax.legend([[en ? 'quantum: −cos θ' : '量子力学：−cos θ', ax.c.gold], [en ? 'local hidden variables' : '定域隐变量模型', ax.c.violet, [6, 4]]]);
    const rows = [['量子力学的 S', 'Quantum S', fmt(Sq, 4), true], ['隐变量模型的 S', 'Hidden-variable S', fmt(Sl, 4)], ['定域理论的上限 |S|', 'Local bound on |S|', '2'], ['量子力学的上限 |S|', 'Quantum bound on |S|', `2√2 ≈ ${fmt(2 * Math.SQRT2, 4)}`]];
    if (sim) rows.push(['模拟实验的 S', 'Simulated S', `${fmt(sim.S, 4)} ± ${fmt(sim.err, 2)}`, true]);
    readout($('#d4-read'), rows);
    const cap = en ? `With a = ${a}°, a′ = ${a2}°, b = ${b}°, b′ = ${b2}°: quantum |S| = ${fmt(Math.abs(Sq), 4)}, hidden variables |S| = ${fmt(Math.abs(Sl), 4)}${Math.abs(Sq) > 2 ? ', a violation of the local bound 2' : ''}.` : `a = ${a}°、a′ = ${a2}°、b = ${b}°、b′ = ${b2}° 时：量子力学 |S| = ${fmt(Math.abs(Sq), 4)}，隐变量模型 |S| = ${fmt(Math.abs(Sl), 4)}${Math.abs(Sq) > 2 ? '，超过了定域理论的上限 2' : ''}。`;
    $('#d4-cap').innerHTML = C(esc(cap)); cv.setAttribute('aria-label', cap);
  };
  for (const id of ['d4-a', 'd4-a2', 'd4-b', 'd4-b2']) $(`#${id}`).addEventListener('input', () => draw4());
  $('#d4-best').addEventListener('click', () => { [['d4-a', 0], ['d4-a2', 90], ['d4-b', 45], ['d4-b2', 135]].forEach(([id, v]) => { $(`#${id}`).value = v; }); draw4(); });
  $('#d4-go').addEventListener('click', () => {
    const r = Math.PI / 180, [a, a2, b, b2] = ['d4-a', 'd4-a2', 'd4-b', 'd4-b2'].map((id) => Number($(`#${id}`).value) * r), rand = M.rng(seed++), n = 2000;
    const E = [[a, b], [a, b2], [a2, b], [a2, b2]].map(([x, y]) => M.sampleE(x, y, n, rand));
    draw4({ E, S: E[0] - E[1] + E[2] + E[3], err: Math.sqrt(E.reduce((s, e) => s + (1 - e * e) / n, 0)) });
  });

  // ── 十二章详解 ────────────────────────────────────────────────────────
  $('#qp-chapters-h').innerHTML = L('十二章详解', 'The twelve chapters');
  $('#qp-side').innerHTML = D.stages.map((t) => `<div class="fm-side-g" data-tier="${t.id}"><p>${R(t.name)} · ${R(t.tag)}</p>${D.chapters.filter((c) => c.stage === t.id).map((c) => `<button type="button" class="fm-side-b" data-sub="${c.id}" aria-controls="c-${c.id}"><span class="fm-glyph" aria-hidden="true">${esc(c.glyph)}</span>${C(`${num(c.id)}. ${esc(sn(c.id))}`)}<span class="fm-side-p" data-p="${c.id}"></span></button>`).join('')}</div>`).join('');
  const bookCard = (b) => {
    const zh = b.role === 'zh', l = zh ? 'zh-CN' : 'en';
    const links = [b.doi ? `<a href="https://doi.org/${esc(b.doi)}" target="_blank" rel="noopener noreferrer" translate="no">DOI ${esc(b.doi)} ${ext}</a>` : '', b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${b.free ? L('免费阅读', 'Read free') : L('主页', 'Website')} ${ext}</a>` : ''].filter(Boolean).join('');
    return `<li class="fm-book" data-role="${b.role}">
      <div class="fm-tags"><span class="fm-tag" data-role="${b.role}">${R(D.roles[b.role])}</span><span class="fm-tag">${R(D.levels[b.level])}</span>${b.free ? `<span class="fm-tag fm-free">${L('合法免费', 'Free & legal')}</span>` : ''}</div>
      <p class="fm-cite" translate="no" lang="${l}"><b class="fm-title">${esc(b.title)}</b>${b.ed ? ` <span class="fm-ed" lang="${lang}">${esc(tx(b.ed))}</span>` : ''}<br><span class="fm-au">${esc(b.authors)}</span> · ${esc(b.pub)}${b.year ? ` · ${esc(b.year)}` : ''}</p>
      ${R(b.note, 'p', 'fm-note')}${links ? `<p class="fm-links">${links}</p>` : ''}</li>`;
  };
  const paperCard = (p) => `<li class="fm-book" data-role="paper"><div class="fm-tags"><span class="fm-tag" data-role="paper">${L('原始论文', 'Original paper')}</span><span class="fm-tag" translate="no">${p.y}</span></div>
      <p class="fm-cite" translate="no" lang="${/[äöüß]/i.test(p.title) ? 'de' : 'en'}"><b class="fm-title">${esc(p.title)}</b><br><span class="fm-au">${esc(p.au)}</span> · <i>${esc(p.j)}</i> ${esc(p.v)}, ${esc(p.p)} (${p.y})</p>
      <p class="fm-links"><a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener noreferrer" translate="no">DOI ${esc(p.doi)} ${ext}</a></p></li>`;
  const plat = { yt: 'YouTube', bili: en ? 'Bilibili' : '哔哩哔哩', ocw: 'MIT OpenCourseWare' };
  const videoCard = (v) => `<li class="fm-video" data-p="${v.p}">
      <div class="fm-tags"><span class="fm-tag fm-plat" data-p="${v.p}" translate="no">${esc(plat[v.p])}</span><span class="fm-tag">${R(D.levels[v.level])}</span><span class="fm-tag">${v.lang === 'zh' ? L('中文', 'Chinese') : L('英文', 'English')}</span>${v.parts ? `<span class="fm-tag">${L(`共 ${v.parts} 集`, `${v.parts} parts`)}</span>` : ''}${v.re ? `<span class="fm-tag fm-re">${L('转载', 'Reupload')}</span>` : ''}</div>
      <p class="fm-cite"><a class="fm-title" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" translate="no" lang="${v.lang === 'zh' || /[㐀-鿿]/.test(v.title) ? 'zh-CN' : 'en'}">${esc(v.title)} ${ext}</a><br><span class="fm-au" translate="no">${esc(v.by)}</span></p>
      ${R(v.note, 'p', 'fm-note')}</li>`;
  const DEMO_NAME = { d1: ['演示 1：一维定态', 'Demo 1: stationary states'], d2: ['演示 2：隧穿', 'Demo 2: tunnelling'], d3: ['演示 3：Stern–Gerlach 串联', 'Demo 3: Stern–Gerlach in series'], d4: ['演示 4：CHSH 实验', 'Demo 4: a CHSH experiment'] };
  const DEMO_ID = { d1: 'states', d2: 'tunnel', d3: 'sg', d4: 'bell' };
  // 能在浏览器里运行的 Python（viewer/pyrun.js 运行，程序在 viewer/py-examples.js），按章挂在“动手练习”后面
  const PYEX = window.MOLASTRIA_PY_EXAMPLES || {};
  const PY = window.MolAstriaPy ? {
    wave: { example: 'schrodinger',
      title: ['自己写一个一维薛定谔方程求解器', 'Write your own 1D Schrödinger solver'],
      body: ['把哈密顿量在格点上写成对称矩阵，numpy.linalg.eigh 一次给出全部能级和波函数。改第 5 行的 POTENTIAL 换势能（harmonic、well、double、morse），程序把最低六个能级和解析解（谐振子 n + ½，Morse 的闭式）并排打印，再画出最低四个波函数。势能参数和演示 1 相同，可以互相对照。程序只在你的浏览器里运行，不上传。',
        'The Hamiltonian becomes a symmetric matrix on a grid, and numpy.linalg.eigh gives every level and wavefunction at once. Change POTENTIAL on line 5 to switch potentials (harmonic, well, double, morse); the program prints the lowest six levels next to the exact ones (n + ½ for the oscillator, the closed form for Morse) and draws the lowest four wavefunctions. The potentials have the same parameters as demo 1, so you can check one against the other. The program runs only in your browser and nothing is uploaded.'],
      credit: ['写法参照 qmsolve（BSD-3-Clause），代码是我们自己写的。', 'Modelled on qmsolve (BSD-3-Clause); the code is our own.'], link: 'https://github.com/quantum-visualizations/qmsolve' },
  } : {};
  const pyBlock = (id) => {
    const p = PY[id];
    if (!p || !PYEX[p.example]) return '';
    return `<h4>${L('在浏览器里运行', 'Run it in your browser')}</h4><div class="fm-practice qp-py"><p class="fm-practice-t">${L(...p.title)}</p>${C(esc(en ? p.body[1] : p.body[0]), 'p')}
          <div class="qp-py-run" data-py="${id}"></div><p class="qp-py-note">${L(...p.credit)} <a href="${p.link}" target="_blank" rel="noopener noreferrer" translate="no">qmsolve ${ext}</a></p></div>`;
  };
  $('#qp-panels').innerHTML = D.chapters.map((s, i) => `<article class="fm-panel" id="c-${s.id}" data-tier="${s.stage}" tabindex="-1"${i ? ' hidden' : ''}>
      <header class="fm-sub-h"><span class="fm-big-glyph" aria-hidden="true">${esc(s.glyph)}</span><div>
        <p class="fm-panel-k" data-tier="${s.stage}">${L(`第 ${num(s.id)} 章`, `Chapter ${num(s.id)}`)} · ${R(stageOf(s.id).name)} · ${R(stageOf(s.id).tag)} · ${L(`约 ${s.weeks} 周`, `about ${s.weeks} weeks`)}</p>
        <h3>${R(s.name)}</h3>${R(s.tagline, 'p', 'fm-tagline')}</div></header>
      ${(s.demos || []).length || (s.links || []).length ? `<div class="qp-try">${(s.demos || []).map((d) => `<a class="button" href="#d-${DEMO_ID[d]}">${L(...DEMO_NAME[d])} <i class="ico-ext ico-down" aria-hidden="true"></i></a>`).join('')}${(s.links || []).map(([id, hash, t]) => `<span class="qp-link">${L('别的展馆：', 'Another pavilion: ')}${hall(id, hash)}${C(` · ${esc(tx(t))}`)}</span>`).join('')}</div>` : ''}
      <div class="fm-cols"><div class="fm-col-main">
        <h4>${L('讲解', 'Explanation')}</h4><div class="fs-prose">${s.explain.map((p) => R(p, 'p')).join('')}</div>
        <h4>${L('关键公式', 'Key formulas')}</h4>${s.formulas.map(formula).join('')}
        <h4>${L('在化学里出现在哪里', 'Where it shows up in chemistry')}</h4><ul class="fm-bul">${s.inChem.map((t) => R(t, 'li')).join('')}</ul>
        <h4>${L('动手练习', 'Hands-on exercise')}</h4><div class="fm-practice"><p class="fm-practice-t">${R(s.practice.title)}</p>${R(s.practice.body, 'p')}
          <div class="fm-code"><button type="button" class="button fm-copy" data-copy="${s.id}">${L('复制代码', 'Copy code')}</button><pre translate="no"><code>${esc(s.practice.code)}</code></pre></div></div>
        ${pyBlock(s.id)}
        <h4>${L('常见误区', 'Common pitfalls')}</h4><ul class="fm-bul fm-pit">${s.pitfalls.map((t) => R(t, 'li')).join('')}</ul>
      </div><aside class="fm-col-side">
        <h4>${L('分周大纲', 'Week-by-week outline')}</h4><ol class="fm-outline">${s.outline.map(([t, w]) => `<li><span class="fm-wk">${L(`第 ${w} 周`, `Wk ${w}`)}</span>${R(t)}</li>`).join('')}</ol>
        <h4>${L('过关自测', 'Self-check')}</h4><ul class="fm-checks">${s.checks.map((t, k) => `<li><label><input type="checkbox" data-check="${s.id}:${k}"${progress.has(`${s.id}:${k}`) ? ' checked' : ''}>${R(t)}</label></li>`).join('')}</ul>
        ${s.papers.length ? `<h4>${L('原始论文', 'Original papers')}</h4><ul class="qp-papers">${s.papers.map((id) => { const p = P[id]; return `<li><a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(p.au)} (${p.y}) ${ext}</a><span translate="no">${esc(p.title)}</span></li>`; }).join('')}</ul>` : ''}
      </aside></div>
      <div class="fq" data-fq="MOLASTRIA_QP_QUIZ" data-fq-item="${s.id}" data-fq-store="molastria-qp-quiz"></div>
      <div class="fm-res"><div><h4>${L('教材与讲义', 'Textbooks & notes')}</h4><ul class="fm-cards">${s.books.map((id) => bookCard(B[id])).join('')}</ul></div>
        <div><h4>${L('课程与视频', 'Courses & videos')}</h4>${s.videos.length ? `<ul class="fm-cards">${s.videos.map((id) => videoCard(V[id])).join('')}</ul>` : `<p class="muted">${L('这一章没有我们核对过、值得推荐的完整视频课；Tong 的量子霍尔讲义和 Ashcroft–Mermin 是更好的起点。', 'We found no complete video course for this chapter that we could verify and recommend; Tong\'s quantum Hall notes and Ashcroft–Mermin are better starting points.')}</p>`}</div></div>
    </article>`).join('');
  for (const el of document.querySelectorAll('.qp-py-run')) {
    const ex = PYEX[PY[el.dataset.py].example];
    window.MolAstriaPy.mount(el, { code: ex.code, packages: ex.packages, name: ex.name, plot: true, lang: en ? 'en' : 'zh' });
  }
  const side = $('#qp-side');
  const selectChapter = (id, { scroll = false } = {}) => {
    if (!CH[id]) return false;
    for (const p of document.querySelectorAll('#qp-panels .fm-panel')) p.hidden = p.id !== `c-${id}`;
    for (const b of side.querySelectorAll('.fm-side-b')) b.setAttribute('aria-current', String(b.dataset.sub === id));
    if (scroll) $('#qp-chapters').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    return true;
  };
  side.addEventListener('click', (e) => { const b = e.target.closest('.fm-side-b'); if (!b) return; selectChapter(b.dataset.sub); history.replaceState(null, '', `#c-${b.dataset.sub}`); });
  document.addEventListener('click', (e) => { const a = e.target.closest('a[data-open]'); if (!a) return; e.preventDefault(); selectChapter(a.dataset.open, { scroll: true }); history.replaceState(null, '', `#c-${a.dataset.open}`); });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.fm-copy'); if (!b) return;
    try { await navigator.clipboard.writeText(CH[b.dataset.copy].practice.code); b.innerHTML = L('已复制', 'Copied'); } catch { b.innerHTML = L('请手动选中复制', 'Select and copy by hand'); }
    setTimeout(() => { b.innerHTML = L('复制代码', 'Copy code'); }, 1600);
  });

  // ── 从哪里开始 ────────────────────────────────────────────────────────
  $('#qp-start-h').innerHTML = L('从哪里开始', 'Where to start');
  $('#qp-start-note').innerHTML = L('在每章的“过关自测”里勾选你已经能做到的事，这里按章节顺序建议下一步。勾选只保存在这台设备的浏览器里。', 'Tick what you can already do in each chapter\'s self-check; this box suggests your next step in chapter order. Ticks are stored only in this browser.');
  const pct = (id) => { const n = CH[id].checks.length; let k = 0; for (let i = 0; i < n; i++) if (progress.has(`${id}:${i}`)) k++; return k / n; };
  const drawStart = () => {
    const next = D.chapters.find((c) => pct(c.id) < 0.75);
    $('#qp-start-box').innerHTML = `<div class="fm-next">${next
      ? `<p class="fm-panel-k">${R(stageOf(next.id).name)} · ${R(stageOf(next.id).tag)}</p><h3>${L('建议下一步', 'Suggested next step')}：${C(`${num(next.id)}. ${esc(tx(next.name))}`)}</h3>${R(next.tagline, 'p')}<p><a class="button primary" href="#c-${next.id}" data-open="${next.id}">${L('打开这一章', 'Open this chapter')} <i class="ico-ext ico-down" aria-hidden="true"></i></a> <button type="button" class="button" id="qp-reset">${L('清除全部勾选', 'Clear all ticks')}</button></p>`
      : `<h3>${L('十二章的自测都已过关', 'Every self-check is done')}</h3><p>${L('可以去量子嘉年华的其他展馆，或者读“进一步基础科学发现”里的研究文献。', 'Visit the other pavilions of the Quantum Carnival, or read the research literature in Advancing Fundamental Science.')}</p><p><button type="button" class="button" id="qp-reset">${L('清除全部勾选', 'Clear all ticks')}</button></p>`}</div>
      <ul class="fm-meters">${D.chapters.map((c) => `<li data-tier="${c.stage}"><a href="#c-${c.id}" data-open="${c.id}" translate="no" lang="${lang}">${num(c.id)}. ${esc(sn(c.id))}</a><span class="fm-meter"><i style="width:${Math.round(pct(c.id) * 100)}%"></i></span><span class="fm-meter-n" translate="no">${Math.round(pct(c.id) * c.checks.length)}/${c.checks.length}</span></li>`).join('')}</ul>`;
    for (const el of document.querySelectorAll('.fm-side-p')) { const p = pct(el.dataset.p); el.style.setProperty('--p', p); el.title = `${Math.round(p * 100)}%`; }
  };
  document.addEventListener('change', (e) => { const c = e.target.closest('input[data-check]'); if (!c) return; if (c.checked) progress.add(c.dataset.check); else progress.delete(c.dataset.check); saveProgress(); drawStart(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#qp-reset')) return; progress.clear(); saveProgress(); for (const c of document.querySelectorAll('input[data-check]')) c.checked = false; drawStart(); });
  drawStart();

  // ── 论文、教材与课程 ──────────────────────────────────────────────────
  $('#qp-library-h').innerHTML = L('论文、教材与课程', 'Papers, books & courses');
  $('#qp-lib-note').innerHTML = L(`全部 ${D.papers.length} 篇原始论文、${D.books.length} 本教材与讲义、${D.videos.length} 门课程与视频，${D.checked} 核对。有 DOI 的条目在 Crossref 核对过题名、作者、期刊、卷页与年份；没有 DOI 的书以出版社最新版为准；公开讲义在作者主页核对过。`, `All ${D.papers.length} original papers, ${D.books.length} books and notes and ${D.videos.length} courses and videos, checked on ${D.checked}. Entries with a DOI were checked against Crossref for title, authors, journal, volume, pages and year; for books without a DOI use the publisher's latest edition; open lecture notes were checked on the authors' pages.`);
  $('#qp-lib-filters').innerHTML = `<label>${L('章节', 'Chapter')}<select id="qp-f-ch"><option value="">${esc(en ? 'All chapters' : '全部章节')}</option>${D.chapters.map((c) => `<option value="${c.id}">${num(c.id)}. ${esc(tx(c.name))}</option>`).join('')}</select></label>
    <label>${L('类型', 'Type')}<select id="qp-f-type"><option value="">${esc(en ? 'All types' : '全部类型')}</option><option value="paper">${esc(en ? 'Original papers' : '原始论文')}</option><option value="book">${esc(en ? 'Textbooks & notes' : '教材与讲义')}</option><option value="video">${esc(en ? 'Courses & videos' : '课程与视频')}</option></select></label>
    <label class="fm-f-check"><input type="checkbox" id="qp-f-free">${L('只看可免费阅读 / 观看', 'Free to read or watch only')}</label>`;
  for (const el of document.querySelectorAll('#qp-lib-filters select')) el.setAttribute('translate', 'no');
  const drawLib = () => {
    const ch = $('#qp-f-ch').value, type = $('#qp-f-type').value, free = $('#qp-f-free').checked;
    const inCh = (list) => (id) => !ch || CH[ch][list].includes(id);
    const papers = type && type !== 'paper' || free ? [] : D.papers.filter((p) => inCh('papers')(p.id));
    const books = type && type !== 'book' ? [] : D.books.filter((b) => inCh('books')(b.id) && (!free || b.free));
    const vids = type && type !== 'video' ? [] : D.videos.filter((v) => inCh('videos')(v.id));
    $('#qp-lib-count').innerHTML = L(`共 ${papers.length} 篇论文、${books.length} 本教材与讲义、${vids.length} 门课程`, `${papers.length} papers, ${books.length} books & notes, ${vids.length} courses`);
    $('#qp-lib').innerHTML = (papers.length ? `<div class="fm-lib-g"><h3>${L('原始论文（按年份）', 'Original papers (by year)')}</h3><ul class="fm-cards">${papers.map(paperCard).join('')}</ul></div>` : '')
      + (books.length ? `<div class="fm-lib-g"><h3>${L('教材与讲义', 'Textbooks & notes')}</h3><ul class="fm-cards">${books.map(bookCard).join('')}</ul></div>` : '')
      + (vids.length ? `<div class="fm-lib-g"><h3>${L('课程与视频', 'Courses & videos')}</h3><ul class="fm-cards">${vids.map(videoCard).join('')}</ul></div>` : '');
  };
  $('#qp-lib-filters').addEventListener('change', drawLib);
  drawLib();

  $('#qp-foot').innerHTML = `<strong>${L('MolAstria · 量子嘉年华 · 量子物理', 'MolAstria · Quantum Carnival · Quantum Physics')}</strong>
    <p>${L('讲解、大纲、练习和演示由 MolAstria 编写；论文、书目与课程只收录核对过、真实存在的条目，不代表作者或平台认可本站。', 'Explanations, outlines, exercises and demos are written by MolAstria; papers, books and courses are limited to entries we checked and that exist, and imply no endorsement by authors or platforms.')}</p>
    <p><a href="../index.html">${L('回到量子嘉年华', 'Back to the Quantum Carnival')}</a> · <a href="../../fundamental-science/index.html">${L('进一步基础科学发现', 'Advancing Fundamental Science')}</a> · <a href="../../physics-realms/index.html#n-qm">${L('物理疆界图', 'Realms of Physics')}</a> · <a href="../../fundamental-science/math/index.html">${L('数学基础与探索', 'Mathematical Foundations & Exploration')}</a> · <a href="../../qchem/index.html#lab">${L('浏览器里的量子化学计算器', 'Quantum chemistry calculator in the browser')}</a> · <a href="#qp-h1">${L('回到顶部', 'Back to top')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p>`;

  // ── 地址与重绘 ────────────────────────────────────────────────────────
  const drawAll = () => { draw1(); draw2(); draw3(); draw4(); };
  drawAll();
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { draw1(); draw2(); draw4(); }, 150); });
  new MutationObserver(() => { draw1(); draw2(); draw4(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const fromHash = () => { const h = location.hash.slice(1); if (h.startsWith('c-') && selectChapter(h.slice(2))) setTimeout(() => $('#qp-chapters').scrollIntoView({ block: 'start' }), 60); };
  window.addEventListener('hashchange', fromHash);
  selectChapter(D.chapters[0].id);
  fromHash();
})();
