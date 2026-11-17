'use strict';
// 群论（/group-theory/）的十四个演示。数学都在 gt-models.js（纯函数，tools/group-test.mjs 测）。gt.js 用 window.MOLASTRIA_GROUP_DEMOS(K, DEMOS) 把它们登记进去。
// 写法同准粒子的 quasi-demos.js：title，kind，intro，sel，ctl，chk，btn，state，autoplay，fps + tick(s)，changed，figs，note，draw(s, 图, 颜色) 返回读数。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。'html' 图里的内容也只用这里的固定文字和算出来的数字拼。
// 点群流程图是照 Harris & Bertolucci《Symmetry and Spectroscopy》图 1-33 的判定顺序自己重画的（SVG），不是扫描图。
window.MOLASTRIA_GROUP_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_GROUP_MODELS;
  const { L, fix, fmt, plot, fit, lin, font, esc, en } = K;
  const PI = Math.PI, TAU = 2 * PI;
  const subH = (s) => esc(s).replace(/_\(([^)]+)\)/g, '<sub>$1</sub>').replace(/_([0-9a-z]+)/g, '<sub>$1</sub>');
  const irr = M.fmtIrrep;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ── 三维分子的画法（正交投影加一点透视，拖动旋转）──────────────────
  const CPK = { H: '#f1f3f5', B: '#f4a3a3', C: '#5c636a', N: '#4263eb', O: '#e03131', F: '#94d82d', P: '#f08c00', S: '#fcc419', Cl: '#2f9e44', Br: '#a5432a', Xe: '#7048e8', Fe: '#e8590c', Co: '#d6336c', Pt: '#adb5bd' };
  const RAD = (el) => (el === 'H' ? 0.27 : ['Br', 'Xe', 'Pt', 'Fe', 'Co'].includes(el) ? 0.5 : 0.4);
  function camera(s, w, h, ext) {
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch), k = (0.4 * Math.min(w, h)) / Math.max(ext, 1.2), D = 14;
    return (p) => { const x1 = cy * p[0] - sy * p[1], y1 = sy * p[0] + cy * p[1], z = p[2]; const d = y1 * cp - z * sp, Y = y1 * sp + z * cp, f = D / (D + d); return { x: w / 2 + x1 * k * f, y: h / 2 - Y * k * f, d, f, k: k * f }; };
  }
  function draggable(cv, s) {
    cv.classList.add('gt-drag');
    cv.onpointerdown = (e) => {
      const x0 = e.clientX, y0 = e.clientY, a0 = s.yaw, b0 = s.pitch;
      try { cv.setPointerCapture(e.pointerId); } catch { /* 旧浏览器 */ }
      cv.onpointermove = (ev) => { s.yaw = a0 + (ev.clientX - x0) * 0.012; s.pitch = clamp(b0 + (ev.clientY - y0) * 0.012, -1.5, 1.5); s.redraw(); };
      cv.onpointerup = cv.onpointercancel = () => { cv.onpointermove = null; };
    };
  }
  // atoms: [{ el, r }]；opt：{ bonds, ghost（原位置）, els（对称元素）, sel, hi（高亮的原子下标集合）, arrows（[[i, 向量]]）}
  function drawMolecule(cv, s, atoms, c, opt = {}) {
    const { ctx, w, h } = fit(cv);
    const ext = Math.max(1.4, ...(opt.ghost || atoms).map((a) => M.norm(a.r))) * 1.05, P = camera(s, w, h, ext), Lx = ext * 1.25;
    ctx.lineCap = 'round';
    const elColor = (e) => (e.kind === 'C' ? c.gold : e.kind === 's' ? c.accent : e.kind === 'S' ? c.violet || c.info : c.danger);
    const drawEl = (e, strong) => {
      const col = elColor(e);
      ctx.globalAlpha = strong ? 1 : 0.35;
      if (e.kind === 'C' || e.kind === 'S') {
        const a = P(M.scale(e.ax, -Lx)), b = P(M.scale(e.ax, Lx));
        ctx.strokeStyle = col; ctx.lineWidth = strong ? 2.4 : 1.2; ctx.setLineDash(e.kind === 'S' ? [3, 4] : strong ? [] : [6, 5]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        if (strong) { ctx.fillStyle = col; ctx.font = font(13, 700); ctx.textAlign = 'left'; ctx.fillText(elLabel(e), b.x + 5, b.y - 4); }
      } else if (e.kind === 's') {
        const n = e.nrm, t = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e1 = M.unit(M.cross(n, t)), e2 = M.cross(n, e1);
        const q = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => P(M.add(M.scale(e1, u * Lx), M.scale(e2, v * Lx))));
        ctx.fillStyle = col; ctx.globalAlpha = strong ? 0.16 : 0.05; ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = strong ? 0.8 : 0.25; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
        if (strong) { ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.font = font(13, 700); ctx.textAlign = 'left'; ctx.fillText(elLabel(e), q[0].x + 4, q[0].y); }
      } else if (e.kind === 'i') {
        const o = P([0, 0, 0]); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, 7, 0, TAU); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(o.x, o.y, 2.5, 0, TAU); ctx.fill();
        if (strong) { ctx.font = font(13, 700); ctx.textAlign = 'left'; ctx.fillText('i', o.x + 9, o.y - 8); }
      }
      ctx.globalAlpha = 1;
    };
    if (opt.els) opt.els.forEach((e, k) => { if (k !== opt.sel && opt.showAll) drawEl(e, false); });
    if (opt.els && opt.sel >= 0 && opt.els[opt.sel]) drawEl(opt.els[opt.sel], true);
    const ball = (p, el, alpha, ring) => {
      const r = RAD(el) * p.k;
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, CPK[el] || '#999'); g.addColorStop(1, shade(CPK[el] || '#999'));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = ring || 'rgba(0,0,0,.35)'; ctx.lineWidth = ring ? 2.5 : 0.8; ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (opt.ghost) for (const a of opt.ghost) { const p = P(a.r); ctx.globalAlpha = 0.28; ctx.strokeStyle = c.ink2; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, RAD(a.el) * p.k, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    const pr = atoms.map((a) => P(a.r));
    ctx.strokeStyle = c.ink2; ctx.lineWidth = 3;
    for (const [i, j] of opt.bonds || []) { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(pr[i].x, pr[i].y); ctx.lineTo(pr[j].x, pr[j].y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const order = atoms.map((_, i) => i).sort((i, j) => pr[j].d - pr[i].d);
    for (const i of order) ball(pr[i], atoms[i].el, 1, opt.hi?.has(i) ? c.gold : null);
    for (const [i, v] of opt.arrows || []) { const a = pr[i], b = P(M.add(atoms[i].r, v)); K.arrow(ctx, a.x, a.y, b.x, b.y, c.danger, 2); }
    if (opt.labels) { ctx.font = font(11, 600); ctx.fillStyle = c.ink; ctx.textAlign = 'center'; for (const i of order) if (atoms[i].el !== 'H' && atoms[i].el !== 'C') ctx.fillText(atoms[i].el, pr[i].x, pr[i].y + 4); }
    ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'right'; ctx.fillText(L('拖动旋转', 'drag to rotate'), w - 6, h - 6);
    draggable(cv, s);
    return { ctx, w, h };
  }
  function shade(hex) { const n = parseInt(hex.slice(1), 16), f = 0.55; return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`; }
  const SUBD = (n) => (Number.isFinite(n) ? String(n).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[d]).join('') : '∞');
  const ROLE = { principal: L('主轴', 'principal axis'), perp: '⊥', σh: 'σₕ', σv: 'σᵥ', σd: 'σd', plane: 'σ' };
  function elLabel(e) {
    if (e.kind === 'C') return `C${SUBD(e.n)}${e.role === 'principal' ? `（${ROLE.principal}）` : e.role === 'perp' ? ' ⊥' : ''}`.replace('（', en ? ' (' : '（').replace('）', en ? ')' : '）');
    if (e.kind === 'S') return `S${SUBD(e.n)}`;
    if (e.kind === 's') return ROLE[e.role] || 'σ';
    return 'i';
  }

  // ── 1. 群的乘法表 ──────────────────────────────────────────────
  let curG = null;
  DEMOS.cayley = {
    title: L('乘法表：一个群的全部信息在一张方格里', 'The multiplication table: everything about a group in one grid'), kind: 'exact',
    intro: L('行乘列（先做列，再做行）。每一行、每一列都恰好把每个元素用一次（拉丁方），这等价于“每个元素都有逆”。点一个格子选中那一行的元素，看它的阶、它的共轭类和它生成的循环子群。下面的滑杆挑一个子群，按左陪集给格子上色：陪集一样大，所以子群的阶整除群的阶（Lagrange 定理）。', 'Row times column (do the column first, then the row). Every row and every column uses each element exactly once (a Latin square), which is the same as saying every element has an inverse. Click a cell to select the element of that row and see its order, its conjugacy class and the cyclic subgroup it generates. The slider picks a subgroup and colours the table by left cosets: cosets are all the same size, so the order of a subgroup divides the order of the group (Lagrange’s theorem).'),
    sel: [['g', L('群', 'Group'), Object.keys(M.FINITE).map((id) => [id, en ? M.FINITE[id].en : M.FINITE[id].zh]), 'D3'], ['view', L('上色', 'Colour by'), [['el', L('元素', 'element')], ['class', L('共轭类', 'conjugacy class')], ['coset', L('所选子群的陪集', 'cosets of the chosen subgroup')]], 'el']],
    ctl: [['sub', L('子群', 'Subgroup'), 0, 40, 1, 3, (v) => (curG ? `#${Math.min(v, curG.subgroups.length - 1) + 1} / ${curG.subgroups.length}` : String(v))]],
    state: () => ({ a: 1 }),
    changed(s, k) { if (k === 'g' || k === '' || !curG) { curG = M.finiteGroup(s.g); s.a = Math.min(s.a, curG.n - 1); } s.sub = Math.min(s.sub, curG.subgroups.length - 1); },
    figs: [[1, L('乘法表（行 × 列）。金框是所选元素的那一行；它的幂（生成的循环子群）在表头上标成金色。', 'Multiplication table (row × column). The gold frame is the row of the selected element; its powers (the cyclic subgroup it generates) are marked gold in the headers.')]],
    note: L('群由置换生成（比如 D₃ 由三角形顶点的转动 r = (0 1 2) 和反射 s = (1 2) 生成），元素按最短的字排列，名字就是那个字（r²s 表示先做 s，再做两次 r）。共轭类 {g a g⁻¹}，子群是由一两个元素生成的全部子群（这些群都不超过 24 阶，每个子群都能由两个元素生成）。群公理逐条用乘法表核对。', 'Each group is generated by permutations (D₃ by the rotation r = (0 1 2) and the reflection s = (1 2) of a triangle’s vertices); elements are listed by shortest word and named by it (r²s means do s, then r twice). Conjugacy classes are {g a g⁻¹}; the subgroups are all those generated by one or two elements (every group here has order at most 24, and each of its subgroups is generated by two elements). The group axioms are checked one by one from the table.'),
    draw(s, [cv], c) {
      const g = curG || (curG = M.finiteGroup(s.g)), n = g.n, H = g.subgroups[Math.min(s.sub, g.subgroups.length - 1)];
      const { ctx, w, h } = fit(cv), pad = Math.min(46, w * 0.09), cell = (Math.min(w, h) - pad - 4) / n;
      const hue = (i, m) => `hsl(${Math.round((360 * i) / m)} 55% ${document.documentElement.dataset.theme === 'dark' ? 38 : 72}%)`;
      const cosetOf = new Array(n).fill(0); M.cosets(g, H).forEach((C, k) => C.forEach((x) => { cosetOf[x] = k; }));
      const nC = s.view === 'class' ? g.classes.length : s.view === 'coset' ? n / H.length : n;
      const colorOf = (x) => hue(s.view === 'class' ? g.classOf[x] : s.view === 'coset' ? cosetOf[x] : x, nC);
      const pow = new Set(); { let x = 0; do { pow.add(x); x = g.table[x][s.a]; } while (x !== 0); }
      ctx.font = font(Math.max(8, Math.min(13, cell * 0.42)), 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = g.table[i][j]; ctx.fillStyle = colorOf(x); ctx.fillRect(pad + j * cell, pad + i * cell, cell - 0.5, cell - 0.5); if (cell > 18) { ctx.fillStyle = c.ink; ctx.fillText(g.names[x], pad + (j + 0.5) * cell, pad + (i + 0.5) * cell); } }
      for (let i = 0; i < n; i++) { ctx.fillStyle = pow.has(i) ? c.gold : c.ink2; if (cell > 10) { ctx.fillText(g.names[i], pad / 2, pad + (i + 0.5) * cell); ctx.fillText(g.names[i], pad + (i + 0.5) * cell, pad / 2); } }
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2.5; ctx.strokeRect(pad, pad + s.a * cell, n * cell, cell);
      cv.style.cursor = 'pointer';
      cv.onclick = (e) => { const r = cv.getBoundingClientRect(), y = ((e.clientY - r.top) / r.height) * h, i = Math.floor((y - pad) / cell); if (i >= 0 && i < n) { s.a = i; s.redraw(); } };
      const ax = M.checkAxioms(g), all = Object.values(ax).every(Boolean), normal = g.normal(H);
      return [
        [L('阶 |G|', 'Order |G|'), String(n), true],
        [L('交换群？', 'Abelian?'), g.abelian ? L('是', 'yes') : L('不是', 'no')],
        [L('共轭类的大小', 'Class sizes'), g.classes.map((C) => C.length).join(' + ')],
        [L('中心', 'Centre'), g.center.map((x) => g.names[x]).join(', ')],
        [L(`所选元素 ${g.names[s.a]} 的阶`, `Order of the selected ${g.names[s.a]}`), String(g.order[s.a])],
        [L('它的共轭类', 'Its conjugacy class'), g.classes[g.classOf[s.a]].map((x) => g.names[x]).join(', ')],
        [L('子群（陪集上色用）', 'Subgroup (for cosets)'), `{${H.map((x) => g.names[x]).join(', ')}}`],
        [L('子群的阶、指数', 'Subgroup order, index'), `${H.length} · ${n / H.length}${normal ? L('（正规）', ' (normal)') : ''}`],
        [L('群公理（封闭、结合、单位元、逆元）', 'Group axioms (closure, associativity, identity, inverses)'), all ? L('全部成立', 'all hold') : L('有一条不成立', 'one fails')],
      ];
    },
  };

  // ── 2. 点群流程图（可点）+ 三维分子 ───────────────────────────────
  const NODES = {
    special: { x: 150, y: 46, w: 196, h: 58, q: [L('特殊点群？', 'Special group?'), 'C∞ᵥ D∞ₕ T T_d Tₕ O Oₕ I Iₕ'] },
    specialEnd: { x: 430, y: 46, t: L('完成', 'done') },
    cn: { x: 150, y: 132, w: 150, h: 40, q: [L('有 Cₙ（n > 1）？', 'Any Cₙ (n > 1)?')] },
    sigmaA: { x: 335, y: 132, w: 96, h: 40, q: [L('有 σ？', 'Any σ?')] },
    Cs: { x: 485, y: 100, t: 'Cₛ' },
    inv: { x: 430, y: 196, w: 96, h: 40, q: [L('有 i？', 'Any i?')] },
    Ci: { x: 565, y: 168, t: 'Cᵢ' },
    C1: { x: 565, y: 240, t: 'C₁' },
    sigmaB: { x: 150, y: 228, w: 110, h: 40, q: [L('有 σ？', 'Any σ?')] },
    s2n: { x: 335, y: 228, w: 160, h: 40, q: [L('有共轴的 S₂ₙ？', 'Collinear S₂ₙ?')] },
    S2n: { x: 520, y: 300, t: 'S₂ₙ' },
    perpC2: { x: 255, y: 318, w: 170, h: 40, q: [L('有 n 条 ⊥C₂？', 'n C₂ axes ⊥ Cₙ?')] },
    sigmaHD: { x: 150, y: 408, w: 104, h: 40, q: [L('有 σₕ？', 'Any σₕ?')] },
    Dnh: { x: 40, y: 408, t: 'Dₙₕ' },
    sigmaVD: { x: 150, y: 484, w: 104, h: 40, q: [L('有 σ_d？', 'Any σ_d?')] },
    Dnd: { x: 40, y: 484, t: 'Dₙ_d' },
    Dn: { x: 150, y: 560, t: 'Dₙ' },
    sigmaHC: { x: 375, y: 408, w: 104, h: 40, q: [L('有 σₕ？', 'Any σₕ?')] },
    Cnh: { x: 500, y: 408, t: 'Cₙₕ' },
    sigmaVC: { x: 375, y: 484, w: 104, h: 40, q: [L('有 σᵥ？', 'Any σᵥ?')] },
    Cnv: { x: 500, y: 484, t: 'Cₙᵥ' },
    Cn: { x: 375, y: 560, t: 'Cₙ' },
  };
  const EDGES = [['special', 'specialEnd', 1], ['special', 'cn', 0], ['cn', 'sigmaA', 0], ['sigmaA', 'Cs', 1], ['sigmaA', 'inv', 0], ['inv', 'Ci', 1], ['inv', 'C1', 0], ['cn', 'sigmaB', 1], ['sigmaB', 's2n', 0], ['s2n', 'S2n', 1], ['s2n', 'perpC2', 0], ['sigmaB', 'perpC2', 1],
    ['perpC2', 'sigmaHD', 1], ['perpC2', 'sigmaHC', 0], ['sigmaHD', 'Dnh', 1], ['sigmaHD', 'sigmaVD', 0], ['sigmaVD', 'Dnd', 1], ['sigmaVD', 'Dn', 0], ['sigmaHC', 'Cnh', 1], ['sigmaHC', 'sigmaVC', 0], ['sigmaVC', 'Cnv', 1], ['sigmaVC', 'Cn', 0]];
  const END_NODE = { special: 'specialEnd', Cs: 'Cs', Ci: 'Ci', C1: 'C1', S2n: 'S2n', Dnh: 'Dnh', Dnd: 'Dnd', Dn: 'Dn', Cnh: 'Cnh', Cnv: 'Cnv', Cn: 'Cn' };
  // 从节点中心向另一点的连线，在方框或圆的边上截断
  const edgePt = (nd, tx, ty) => {
    const dx = tx - nd.x, dy = ty - nd.y;
    if (nd.t) { const r = 27, l = Math.hypot(dx, dy) || 1; return [nd.x + (dx / l) * r, nd.y + (dy / l) * r]; }
    const sx = nd.w / 2 / Math.abs(dx || 1e-9), sy = nd.h / 2 / Math.abs(dy || 1e-9), k = Math.min(sx, sy);
    return [nd.x + dx * k, nd.y + dy * k];
  };
  function flowSVG(res, c, focus) {
    const visited = new Set(res.steps.map((st) => st.node)), endNode = END_NODE[res.end];
    const taken = new Set();
    res.steps.forEach((st, i) => { const next = res.steps[i + 1] ? res.steps[i + 1].node : endNode; taken.add(`${st.node}>${next}`); });
    const out = [`<svg class="gt-flow" viewBox="0 0 610 592" role="img" aria-label="${esc(L('点群判定流程图', 'Point-group flow chart'))}">`, '<defs><marker id="gt-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="context-stroke"/></marker></defs>'];
    for (const [a, b, yes] of EDGES) {
      const A = NODES[a], B = NODES[b], [x1, y1] = edgePt(A, B.x, B.y), [x2, y2] = edgePt(B, A.x, A.y), on = taken.has(`${a}>${b}`);
      out.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${on ? c.gold : c.line}" stroke-width="${on ? 3 : 1.4}" marker-end="url(#gt-ar)"/>`);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, horiz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
      out.push(`<text x="${(mx + (horiz ? 0 : 8)).toFixed(1)}" y="${(my + (horiz ? -6 : 4)).toFixed(1)}" font-size="11" font-weight="600" fill="${on ? c.gold : c.muted}" text-anchor="${horiz ? 'middle' : 'start'}">${yes ? L('是', 'YES') : L('否', 'NO')}</text>`);
    }
    const subT = (t) => esc(t).replace(/_([a-z])/g, '<tspan baseline-shift="sub" font-size="75%">$1</tspan>');
    for (const [id, nd] of Object.entries(NODES)) {
      const on = visited.has(id) || id === endNode, here = id === focus;
      if (nd.t) {
        const final = id === endNode, label = final ? (res.end === 'special' ? M.pretty(res.pg) : M.pretty(res.pg)) : nd.t;
        out.push(`<g data-node="${id}" class="gt-node${final ? ' is-end' : ''}"><circle cx="${nd.x}" cy="${nd.y}" r="26" fill="${final ? c.accent : c.surface || 'transparent'}" stroke="${final ? c.accent : on ? c.gold : c.line}" stroke-width="${final ? 3 : 1.4}"/><text x="${nd.x}" y="${nd.y + 5}" font-size="${final ? 15 : 13}" font-weight="700" text-anchor="middle" fill="${final ? c.paper || '#fff' : c.ink}">${subT(label)}</text></g>`);
      } else {
        const st = res.steps.find((x) => x.node === id);
        out.push(`<g data-node="${id}" class="gt-node${st ? ' is-on' : ''}" tabindex="${st ? 0 : -1}"><rect x="${nd.x - nd.w / 2}" y="${nd.y - nd.h / 2}" width="${nd.w}" height="${nd.h}" rx="7" fill="${here ? c.gold : st ? (st.ans ? 'rgba(212,160,23,.14)' : 'rgba(128,128,128,.10)') : 'transparent'}" stroke="${on ? c.gold : c.line}" stroke-width="${on ? 2 : 1.2}"/>`
          + nd.q.map((t, i) => `<text x="${nd.x}" y="${nd.y + (nd.q.length > 1 ? (i ? 15 : -5) : 5)}" font-size="${i ? 11 : 13}" font-weight="${i ? 500 : 600}" text-anchor="middle" fill="${here ? '#1b1b1b' : c.ink}">${subT(t)}</text>`).join('')
          + (st ? `<text x="${nd.x + nd.w / 2 - 4}" y="${nd.y - nd.h / 2 + 12}" font-size="10" font-weight="700" text-anchor="end" fill="${st.ans ? c.gold : c.muted}">${st.ans ? '✓' : '✗'}</text>` : '') + '</g>');
      }
    }
    out.push('</svg>');
    return out.join('');
  }
  const count = (list, f) => list.filter(f).length;
  function stepText(st, res) {
    const S = res.S, n = res.n, E = res.els;
    const used = st.use.map((k) => E[k]);
    switch (st.node) {
      case 'special':
        if (!st.ans) return L('不是线形、立方或二十面体分子：n ≥ 3 的转动轴最多只有一条。', 'Not linear, cubic or icosahedral: at most one rotation axis with n ≥ 3.');
        if (S.linear) return S.inv ? L('分子是直线形，而且有对称中心：D∞ₕ。', 'The molecule is linear and has a centre of symmetry: D∞h.') : L('分子是直线形，没有对称中心：C∞ᵥ。', 'The molecule is linear with no centre of symmetry: C∞v.');
        return L(`有 ${used.length} 条 n ≥ 3 的轴（${[...new Set(used.map((e) => `C${SUBD(e.n)}`))].join('、')}），属于立方或二十面体点群：${M.pretty(res.pg)}。`, `There are ${used.length} axes with n ≥ 3 (${[...new Set(used.map((e) => `C${SUBD(e.n)}`))].join(', ')}): a cubic or icosahedral group, ${M.pretty(res.pg)}.`);
      case 'cn': return st.ans ? L(`有。最高的是 C${SUBD(n)}，把它定为主轴。`, `Yes. The highest is C${SUBD(n)}; it becomes the principal axis.`) : L('没有任何真转动轴（除了恒等）。', 'No proper rotation axis at all (apart from the identity).');
      case 'sigmaA': return st.ans ? L('有一个镜面：Cₛ。', 'There is a mirror plane: Cs.') : L('没有镜面。', 'No mirror plane.');
      case 'inv': return st.ans ? L('有对称中心：Cᵢ。', 'There is a centre of symmetry: Ci.') : L('也没有对称中心，只剩恒等操作：C₁。', 'No centre of symmetry either; only the identity is left: C1.');
      case 'sigmaB': return st.ans ? L(`有镜面（一共 ${S.planes.length} 个）。`, `There are mirror planes (${S.planes.length} in all).`) : L('没有镜面。', 'No mirror plane.');
      case 's2n': return st.ans ? L(`有和主轴重合的 S${SUBD(2 * n)}，而且没有 ⊥C₂：S${SUBD(2 * n)}。`, `There is an S${SUBD(2 * n)} along the principal axis and no ⊥C₂: S${SUBD(2 * n)}.`) : L(`没有和主轴重合的 S${SUBD(2 * n)}。`, `No S${SUBD(2 * n)} along the principal axis.`);
      case 'perpC2': return st.ans ? L(`有 ${used.length} 条垂直于主轴的 C₂：进入 D 族。`, `There are ${used.length} C₂ axes perpendicular to the principal axis: the D family.`) : L('没有垂直于主轴的 C₂：进入 C 族。', 'No C₂ perpendicular to the principal axis: the C family.');
      case 'sigmaHD': case 'sigmaHC': return st.ans ? L(`有水平镜面 σₕ：${M.pretty(res.pg)}。`, `There is a horizontal mirror σh: ${M.pretty(res.pg)}.`) : L('没有水平镜面 σₕ。', 'No horizontal mirror σh.');
      case 'sigmaVD': return st.ans ? L(`有 ${used.length} 个竖直镜面，它们夹在两条 C₂ 之间（σd）：${M.pretty(res.pg)}。`, `There are ${used.length} vertical mirrors bisecting pairs of C₂ axes (σd): ${M.pretty(res.pg)}.`) : L(`没有任何镜面：${M.pretty(res.pg)}。`, `No mirror planes at all: ${M.pretty(res.pg)}.`);
      case 'sigmaVC': return st.ans ? L(`有 ${used.length} 个竖直镜面 σᵥ：${M.pretty(res.pg)}。`, `There are ${used.length} vertical mirrors σv: ${M.pretty(res.pg)}.`) : L(`没有任何镜面：${M.pretty(res.pg)}。`, `No mirror planes at all: ${M.pretty(res.pg)}.`);
      default: return '';
    }
  }
  const molCache = {};
  const molInfo = (id) => { if (!molCache[id]) { const m = M.molecule(id), atoms = M.centred(m); molCache[id] = { m, atoms, bonds: M.bonds(atoms), res: M.classify(atoms) }; } return molCache[id]; };
  DEMOS.flow = {
    title: L('点群流程图：一步一步找出分子的点群', 'The point-group flow chart, one question at a time'), kind: 'exact',
    intro: L('判定点群只要按顺序回答几个“有没有”：特殊点群吗？有转动轴吗？有镜面吗？有垂直于主轴的 C₂ 吗？有水平镜面吗？……选一个分子，程序从原子坐标里把全部对称元素找出来，再沿流程图走一遍，走过的路径标成金色。点流程图里亮着的方框或下面的某一步，就在三维图里画出它用到的对称元素；拖“执行操作”的滑杆（或按播放），看这个操作把分子变到哪里：做完以后每个原子都落在同种原子原来的位置上（虚线圈），这就是“对称”的意思。', 'Finding a point group just means answering a few yes/no questions in order: a special group? any rotation axis? any mirror? any C₂ perpendicular to the principal axis? a horizontal mirror? … Pick a molecule: the program finds every symmetry element from the atomic coordinates, then walks the flow chart, and the path taken turns gold. Click a lit box in the chart or a step below it to draw the symmetry element it used in the 3D view; drag “Perform the operation” (or press Play) to watch where the operation sends the molecule: at the end every atom lands on the old position of an atom of the same element (the dashed circles). That is what “symmetry” means.'),
    sel: [['mol', L('分子', 'Molecule'), M.MOLS.map((m) => [m.id, `${m.f} · ${en ? m.en : m.zh}`]), 'chbrcl']],
    ctl: [['t', L('执行操作', 'Perform the operation'), 0, 1, 0.01, 0, (v) => `${Math.round(v * 100)} %`]],
    chk: [['all', L('同时淡淡地画出全部对称元素', 'Also show every symmetry element faintly'), false]],
    btn: [[L('例一：反式 1-溴-2-氯乙烯', 'Example 1: trans-1-bromo-2-chloroethylene'), { mol: 'chbrcl' }], [L('例二：二氯甲烷', 'Example 2: dichloromethane'), { mol: 'ch2cl2' }], [L('苯', 'Benzene'), { mol: 'benzene' }], [L('甲烷', 'Methane'), { mol: 'ch4' }]],
    state: () => ({ yaw: 0.55, pitch: 0.42, el: -1, step: -1 }),
    fps: 25,
    tick(s) { if (s.t >= 1) s.t = 0; s.t = Math.min(1, s.t + 0.02); return s.t < 1; },
    changed(s, k) {
      if (k === 'mol' || k === '') {
        const { res } = molInfo(s.mol);
        // 默认选中最后一个“是”的步骤用到的元素
        const lastYes = [...res.steps].reverse().find((st) => st.ans && st.use.length);
        s.step = lastYes ? res.steps.indexOf(lastYes) : -1; s.el = lastYes ? lastYes.use[0] : -1; s.t = 0;
      }
    },
    figs: [[0.8, L('三维分子（拖动旋转）。金线是转动轴，绿色的面是镜面，红点是对称中心，紫色虚线是象转轴；虚线圈是操作之前的原子。', 'The molecule in 3D (drag to rotate). Gold lines are rotation axes, green sheets mirror planes, the red dot the centre of symmetry, violet dashes improper axes; dashed circles are the atoms before the operation.')], ['html', L('流程图（照 Harris 和 Bertolucci 教材里的判定顺序重画）。点亮着的方框或下面的步骤，左边就画出用到的对称元素。', 'Flow chart (redrawn following the order of questions in Harris and Bertolucci’s textbook). Click a lit box or a step below to draw the symmetry element used.')]],
    note: L('找对称元素的办法：候选轴取原子方向、同种原子对的中点和叉积、惯量主轴，对每条轴试 n = 2…12 的转动；候选镜面取同种原子对的连线方向和由轴生成的方向；再试反演和 Sₙ（n ≤ 24）。“对称”指每个原子在 0.02 Å 之内落到同种原子上。分子是理想几何（键长取常见值），所以对称性是精确的；真实分子在振动中会暂时偏离。流程图里“有 σ？”之后先问共轴的 S₂ₙ，这一步只对没有镜面的分子有意义（S₄、S₆ 等）。测试把每个分子判出来的点群和教科书核对，并用找到的元素生成整个群，阶数和点群的阶一致。', 'How the elements are found: candidate axes are atom directions, midpoints and cross products of pairs of like atoms, and the principal axes of inertia, each tried for rotations n = 2…12; candidate mirrors are directions joining like atoms and directions built from the axes; then inversion and Sₙ (n ≤ 24) are tried. “Symmetric” means every atom lands on a like atom within 0.02 Å. Geometries are idealised (typical bond lengths), so the symmetry is exact; real molecules leave it momentarily as they vibrate. After “any σ?” the chart asks about a collinear S₂ₙ, which only matters for molecules with no mirror (S₄, S₆ and so on). The tests check every molecule’s group against the textbook and regenerate the whole group from the elements found; its order matches the order of the point group.'),
    draw(s, [cv, box], c) {
      const { atoms, bonds, res, m } = molInfo(s.mol);
      const el = res.els[s.el];
      const R = el ? M.partial(el, s.t) : M.I3();
      const moved = atoms.map((a) => ({ el: a.el, r: M.mv(R, a.r) }));
      drawMolecule(cv, s, moved, c, { bonds, ghost: s.t > 0.001 && el ? atoms : null, els: res.els, sel: s.el, showAll: s.all });
      const focus = res.steps[s.step]?.node;
      const elChips = res.els.map((e, k) => `<button type="button" class="gt-chip${k === s.el ? ' is-on' : ''}" data-el="${k}">${esc(elLabel(e))}</button>`).join('');
      const key = `${s.mol}|${s.el}|${s.step}|${c.gold}|${c.ink}`;
      if (box.dataset.key !== key) { box.dataset.key = key; box.innerHTML = `<div class="gt-flow-wrap">${flowSVG(res, c, focus)}</div>
        <ol class="gt-steps">${res.steps.map((st, i) => `<li${i === s.step ? ' class="is-on"' : ''}><button type="button" data-step="${i}">${esc(stepText(st, res))}</button></li>`).join('')}</ol>
        <p class="gt-chips-h">${esc(L(`找到的对称元素（${res.els.length} 个，点一个画出来）`, `Symmetry elements found (${res.els.length}; click one to draw it)`))}</p><div class="gt-chips">${elChips}</div>`; }
      box.onclick = (e) => {
        const b = e.target.closest('[data-step],[data-el],[data-node]');
        if (!b) return;
        if (b.dataset.step) { const st = res.steps[+b.dataset.step]; s.step = +b.dataset.step; if (st.use.length) s.el = st.use[0]; s.t = 0; }
        else if (b.dataset.el) { s.el = +b.dataset.el; s.t = 0; }
        else if (b.dataset.node) { const i = res.steps.findIndex((st) => st.node === b.dataset.node); if (i >= 0) { s.step = i; if (res.steps[i].use.length) s.el = res.steps[i].use[0]; s.t = 0; } }
        s.redraw();
      };
      const nC = count(res.els, (e) => e.kind === 'C'), nS = count(res.els, (e) => e.kind === 's'), ord = M.groupOrder(res.pg);
      const ok = el ? !!M.mapAtoms(atoms, M.partial(el, 1)) : true;
      return [
        [L('点群', 'Point group'), esc(M.pretty(res.pg)), true],
        [L('群的阶（操作个数）', 'Order (number of operations)'), Number.isFinite(ord) ? String(ord) : '∞'],
        [L('转动轴 · 镜面 · 对称中心', 'Axes · mirrors · centre'), `${nC} · ${nS} · ${res.S.inv ? L('有', 'yes') : L('无', 'no')}`],
        [L('选中的元素', 'Selected element'), el ? esc(elLabel(el)) : '—'],
        [L('做完后原子都落到同种原子上', 'After the operation every atom lands on a like atom'), el ? (ok ? L('是', 'yes') : L('否', 'no')) : '—'],
        [L('分子', 'Molecule'), esc(m.f)],
      ];
    },
  };

  // ── 3. 特征标表 ────────────────────────────────────────────────
  let curT = null;
  DEMOS.chartable = {
    title: L('特征标表：点一行，再点一行', 'Character tables: click one row, then another'), kind: 'exact',
    intro: L('每一行是一个不可约表示，每一列是一个共轭类，格子里是那个表示的矩阵的迹（特征标）。右边两列告诉你哪些函数按这个表示变换：x、y、z 决定红外活性，二次函数决定拉曼活性。点一行选中 Γₐ，再点一行选中 Γ_b：读数里给出两行的内积（不同的行正交，同一行和自己的内积是 1）和直积 Γₐ ⊗ Γ_b 分解成哪些不可约表示。', 'Each row is an irreducible representation and each column a conjugacy class; the entries are the traces (characters) of that representation’s matrices. The last two columns say which functions transform as the representation: x, y, z decide IR activity and quadratic functions decide Raman activity. Click a row to select Γa, then another to select Γb: the readout gives the inner product of the two rows (different rows are orthogonal; a row with itself gives 1) and how the direct product Γa ⊗ Γb splits into irreducible representations.'),
    sel: [['g', L('点群', 'Point group'), M.tableIds.map((id) => [id, M.pretty(id)]), 'C3v']],
    state: () => ({ a: 2, b: 2, turn: 0 }),
    changed(s, k) { if (k === 'g' || k === '') { curT = M.TABLES[s.g]; s.a = Math.min(s.a, curT.irreps.length - 1); s.b = Math.min(s.b, curT.irreps.length - 1); } },
    figs: [['html', L('特征标表。金色是 Γₐ，绿色是 Γ_b；最下面一行是它们的直积。', 'Character table. Gold is Γa, green Γb; the last row is their direct product.')]],
    note: L('表的写法照 Cotton 和 Mulliken 的约定（坐标轴的取法见每个类的名字）。测试对每张表核对：行数等于类数，维数平方和等于群的阶，行与行按类的大小加权正交；x、y、z 和转动、二次函数的标记都由代表操作的矩阵独立算出来再约化，结果和表里写的一致；还用每个类的代表矩阵生成整个群，核对每个类有几个元素。', 'Tables follow the conventions of Cotton and Mulliken (the axis choices appear in the class names). The tests check every table: as many rows as classes, squared dimensions summing to the group order, rows orthogonal when weighted by class sizes; the x, y, z, rotation and quadratic labels are computed independently from the representative matrices and reduced, and agree with the table; and the representative matrices regenerate the whole group to check how many elements each class holds.'),
    draw(s, [box]) {
      const T = curT || (curT = M.TABLES[s.g]), A = T.irreps[s.a], B = T.irreps[s.b], P = M.product(T, A[1], B[1]);
      const head = `<tr><th>${esc(M.pretty(s.g))}</th>${T.classes.map((c) => `<th>${subH(c[0])}</th>`).join('')}<th>${L('线性、转动', 'linear, rotations')}</th><th>${L('二次', 'quadratic')}</th></tr>`;
      const rows = T.irreps.map((ir, i) => `<tr data-row="${i}" class="${i === s.a ? 'is-a' : ''}${i === s.b ? ' is-b' : ''}"><th>${subH(ir[0])}</th>${ir[1].map((x) => `<td class="num">${String(x).replace('-', '−')}</td>`).join('')}<td>${ir[2].map(subH).join(', ')}</td><td>${ir[3].map(subH).join(', ')}</td></tr>`).join('');
      const prod = `<tr class="gt-prod"><th>${subH(A[0])} ⊗ ${subH(B[0])}</th>${P.map((x) => `<td class="num">${String(x).replace('-', '−')}</td>`).join('')}<td colspan="2">= ${esc(M.decompName(T, M.reduce(T, P)))}</td></tr>`;
      box.innerHTML = `<div class="chm-wrap"><table class="chm-table gt-ct">${head}${rows}${prod}</table></div>`;
      box.onclick = (e) => { const r = e.target.closest('tr[data-row]'); if (!r) return; const i = +r.dataset.row; if (s.turn % 2 === 0) s.a = i; else s.b = i; s.turn++; s.redraw(); };
      const h = M.tableOrder(T), sq = T.irreps.reduce((t, ir) => t + ir[1][0] ** 2, 0);
      return [
        [L('群的阶 h', 'Order h'), String(h), true],
        [L('类数 = 不可约表示数', 'Classes = irreps'), `${T.classes.length} = ${T.irreps.length}`],
        [L('维数平方和', 'Sum of squared dimensions'), `${T.irreps.map((ir) => `${ir[1][0]}²`).join(' + ')} = ${sq}`],
        [L('⟨Γₐ | Γ_b⟩', '⟨Γa | Γb⟩'), fix(M.inner(T, A[1], B[1]), 3)],
        [L('直积', 'Direct product'), esc(M.decompName(T, M.reduce(T, P)))],
        [L('直积含全对称表示？', 'Contains the totally symmetric irrep?'), Math.round(M.reduce(T, P)[0]) ? L('含：⟨a|Ô|b⟩ 这类积分可以不为零', 'yes: integrals like ⟨a|Ô|b⟩ may be non-zero') : L('不含', 'no')],
      ];
    },
  };

  // ── 4. 约化公式 ────────────────────────────────────────────────
  const CASES = [
    ['h2o3n', 'C2v', [9, -1, 1, 3], L('水分子 9 个笛卡儿位移（Γ₃N，分子在 yz 平面里）', 'The 9 Cartesian displacements of water (Γ3N, molecule in the yz plane)')],
    ['nh3h', 'C3v', [3, 0, 1], L('氨分子的三个 H 1s 轨道', 'The three H 1s orbitals of ammonia')],
    ['ch4s', 'Td', [4, 1, 0, 0, 2], L('甲烷的四根 C–H σ 键', 'The four C–H σ bonds of methane')],
    ['bf3s', 'D3h', [3, 0, 1, 3, 0, 1], L('BF₃ 的三根 σ 键', 'The three σ bonds of BF₃')],
    ['ptcl4s', 'D4h', [4, 0, 0, 2, 0, 0, 0, 4, 2, 0], L('平面正方形 [PtCl₄]²⁻ 的四根 σ 键', 'The four σ bonds of square-planar [PtCl₄]²⁻')],
    ['sf6s', 'Oh', [6, 0, 0, 2, 2, 0, 0, 0, 4, 2], L('八面体 SF₆ 的六根 σ 键', 'The six σ bonds of octahedral SF₆')],
    ['doh', 'Oh', [5, -1, 1, -1, 1, 5, -1, -1, 1, 1], L('八面体场里的五个 d 轨道', 'The five d orbitals in an octahedral field')],
    ['pzbenz', 'D6h', [6, 0, 0, 0, -2, 0, 0, 0, 0, -6, 0, 2], L('苯的六个 p_z 轨道（π 体系）', 'The six p_z orbitals of benzene (the π system)')],
  ];
  DEMOS.reduce = {
    title: L('约化公式：把一个可约表示拆开', 'The reduction formula: taking a reducible representation apart'), kind: 'exact',
    intro: L('拿一组东西（键、轨道、原子的位移），看每个对称操作把它们变成什么，数出每个类的特征标，得到一个可约表示 Γ。约化公式 nᵢ = (1/h) Σ g_c χ(c) χᵢ(c) 告诉你 Γ 里含几个第 i 个不可约表示。下表把每一项乘积都摊开写出来，n 一定是非负整数，这本身就是一个检验。', 'Take a set of objects (bonds, orbitals, atomic displacements), see what each symmetry operation does to them, count the character for each class and you have a reducible representation Γ. The reduction formula nᵢ = (1/h) Σ g_c χ(c) χᵢ(c) says how many times the i-th irreducible representation occurs in Γ. The table spells out every product; n must come out a non-negative integer, which is itself a check.'),
    sel: [['c', L('例子', 'Example'), CASES.map(([id, , , t]) => [id, t]), 'ch4s']],
    figs: [['html', L('每一格是 g_c · χ(c) · χᵢ(c)，一行加起来除以 h 就是 nᵢ。', 'Each cell is g_c · χ(c) · χᵢ(c); a row summed and divided by h gives nᵢ.')], [0.32, L('每个不可约表示出现几次（条的高度）。', 'How many times each irreducible representation occurs (bar height).')]],
    note: L('Γ 的特征标是按“不动的对象才贡献”的规则手算的（键和轨道：不动记 1；p_z 被翻过来记 −1；d 轨道在转动 θ 下的特征标是 sin(5θ/2)/sin(θ/2)），测试核对每个例子约化出来都是整数，并和教科书的结果一致（CH₄：A₁ + T₂；SF₆：A₁g + E_g + T₁u；苯的 π：A₂u + B₂g + E₁g + E₂u）。', 'The characters of Γ were counted by hand with the rule that only objects left in place contribute (bonds and orbitals: 1 if unmoved; a p_z turned over counts −1; d orbitals under a rotation by θ have character sin(5θ/2)/sin(θ/2)). The tests check that each example reduces to integers and matches the textbook (CH₄: A₁ + T₂; SF₆: A₁g + E_g + T₁u; benzene π: A₂u + B₂g + E₁g + E₂u).'),
    draw(s, [box, cv], c) {
      const [, gid, chars] = CASES.find((x) => x[0] === s.c), T = M.TABLES[gid], h = M.tableOrder(T), mult = M.reduce(T, chars);
      const head = `<tr><th>${esc(M.pretty(gid))}</th>${T.classes.map((cl) => `<th>${subH(cl[0])}</th>`).join('')}<th>Σ / h</th></tr>`;
      const gam = `<tr class="gt-gamma"><th>Γ</th>${chars.map((x) => `<td class="num">${String(x).replace('-', '−')}</td>`).join('')}<td></td></tr>`;
      const rows = T.irreps.map((ir, i) => `<tr${Math.round(mult[i]) ? ' class="is-a"' : ''}><th>${subH(ir[0])}</th>${T.classes.map((cl, k) => `<td class="num">${String(cl[1] * chars[k] * ir[1][k]).replace('-', '−')}</td>`).join('')}<td class="num"><b>${fix(mult[i], 0)}</b></td></tr>`).join('');
      box.innerHTML = `<div class="chm-wrap"><table class="chm-table gt-ct">${head}${gam}${rows}</table></div>`;
      plot(cv, { x: [-0.6, T.irreps.length - 0.4], y: [0, Math.max(2, ...mult) + 0.3], xt: T.irreps.map((_, i) => i), xf: (i) => irr(T.irreps[i]?.[0] || ''), yl: 'n', yt: [0, 1, 2, 3].filter((v) => v <= Math.max(2, ...mult) + 0.3), series: [{ xs: T.irreps.map((_, i) => i), ys: mult, bars: 0.6, color: c.gold }] });
      const dim = chars[0], back = mult.reduce((t, m, i) => t + m * T.irreps[i][1][0], 0);
      return [[L('结果', 'Result'), `Γ = ${esc(M.decompName(T, mult))}`, true], [L('维数核对', 'Dimension check'), `${dim} = ${fix(back, 0)}`], [L('群的阶 h', 'Order h'), String(h)]];
    },
  };

  // ── 5. 环状 π 体系 ─────────────────────────────────────────────
  DEMOS.huckel = {
    title: L('对称性直接给出分子轨道：环状共轭分子和 Frost 圆', 'Symmetry hands you the orbitals: cyclic π systems and the Frost circle'), kind: 'exact',
    intro: L('CₙHₙ 环有 Cₙ 对称性，所以分子轨道必须是 Cₙ 的不可约表示：系数 cⱼ = e^{2πikj/n}，不用解方程就知道。能量 E = α + 2β cos(2πk/n) 正好是一个半径 2|β| 的圆内接正 n 边形的顶点高度（Frost 圆）。填进 π 电子：4N + 2 个电子时成键轨道正好填满（芳香），4N 个时最高的一对简并轨道各一个电子（反芳香）。下面的图画出所选轨道在每个碳上的系数：圆的大小是 |c|，颜色是正负号。', 'A CₙHₙ ring has Cₙ symmetry, so its molecular orbitals must be irreducible representations of Cₙ: coefficients cⱼ = e^{2πikj/n}, known without solving anything. The energies E = α + 2β cos(2πk/n) are exactly the heights of the vertices of a regular n-gon inscribed in a circle of radius 2|β| (the Frost circle). Fill in the π electrons: with 4N + 2 the bonding orbitals are exactly full (aromatic); with 4N the top degenerate pair holds one electron each (antiaromatic). The lower figure draws the chosen orbital’s coefficient on each carbon: circle size is |c|, colour the sign.'),
    ctl: [['n', L('环的大小 n', 'Ring size n'), 3, 8, 1, 6, (v) => String(v)], ['ne', L('π 电子数', 'π electrons'), 0, 16, 1, 6, (v) => String(v)], ['k', L('看第几个轨道（从低到高）', 'Orbital to show (lowest first)'), 1, 8, 1, 1, (v) => String(v)]],
    btn: [[L('苯 C₆H₆', 'Benzene C₆H₆'), { n: 6, ne: 6 }], [L('环丁二烯 C₄H₄', 'Cyclobutadiene C₄H₄'), { n: 4, ne: 4 }], [L('环戊二烯负离子', 'Cyclopentadienyl anion'), { n: 5, ne: 6 }], [L('环丙烯正离子', 'Cyclopropenyl cation'), { n: 3, ne: 2 }]],
    changed(s) { s.ne = Math.min(s.ne, 2 * s.n); s.k = Math.min(s.k, s.n); },
    figs: [[0.62, L('左：Frost 圆和能级（β < 0，越往下能量越低）；右：填进电子以后。', 'Left: the Frost circle and the levels (β < 0, so lower is more stable); right: after filling in the electrons.')], [0.5, L('所选轨道在每个碳上的系数（圆的大小 ∝ |c|，金色正、蓝色负）。简并的一对取 cos 和 sin 的组合。', 'The chosen orbital’s coefficient on each carbon (circle size ∝ |c|, gold positive, blue negative). Degenerate pairs are shown as the cos and sin combinations.')]],
    note: L('简单 Hückel 模型：只有相邻碳之间的共振积分 β，重叠忽略。能级同时用对称性公式和直接对角化 n × n 矩阵算，两者一致（测试核对）。离域能 = E_π − (电子数 × β)，以孤立的乙烯式双键为参照；对 n 是奇数的离子也照这个定义。苯的标记 a₂u、e₁g、e₂u、b₂g 是 D₆ₕ 的不可约表示。', 'Simple Hückel model: only the resonance integral β between neighbouring carbons, overlap neglected. The levels are computed both from the symmetry formula and by diagonalising the n × n matrix directly; they agree (checked by the tests). Delocalisation energy = E_π − (number of electrons × β), relative to isolated ethylene-like double bonds, and defined the same way for odd-n ions. Benzene’s labels a₂u, e₁g, e₂u, b₂g are irreducible representations of D₆h.'),
    draw(s, [cv, cv2], c) {
      const n = s.n, F = M.huckelFill(n, s.ne), Lv = F.levels;
      const { ctx, w, h } = fit(cv), cx = w * 0.27, cy = h / 2, R = Math.min(w * 0.22, h * 0.4);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= n; k++) { const a = PI / 2 + PI + (TAU * k) / n, x = cx + R * Math.cos(a), y = cy - R * Math.sin(a); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.muted; ctx.beginPath(); ctx.moveTo(cx - R - 10, cy); ctx.lineTo(w - 10, cy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText('α', w - 22, cy - 5);
      // 能级（右边）
      const yOf = (x) => cy + (x * R) / 2, xs0 = w * 0.6;
      const shells = M.degeneracies(Lv.map((l) => -l.x), 1e-9);
      let idx = 0;
      for (const [negx, d] of shells) {
        const y = yOf(-negx);
        for (let q = 0; q < d; q++) {
          const x0 = xs0 + (q - (d - 1) / 2) * 56, i = idx + q, on = i === s.k - 1;
          ctx.strokeStyle = on ? c.gold : c.ink; ctx.lineWidth = on ? 3 : 2; ctx.beginPath(); ctx.moveTo(x0 - 20, y); ctx.lineTo(x0 + 20, y); ctx.stroke();
          const o = F.occ[i];
          ctx.strokeStyle = c.danger; ctx.lineWidth = 1.8;
          for (let e = 0; e < o; e++) { const ex = x0 + (e ? 6 : -6), up = !e; ctx.beginPath(); ctx.moveTo(ex, y + 9); ctx.lineTo(ex, y - 9); ctx.stroke(); ctx.beginPath(); if (up) { ctx.moveTo(ex - 3, y - 5); ctx.lineTo(ex, y - 9); ctx.lineTo(ex + 3, y - 5); } else { ctx.moveTo(ex - 3, y + 5); ctx.lineTo(ex, y + 9); ctx.lineTo(ex + 3, y + 5); } ctx.stroke(); }
        }
        ctx.fillStyle = c.ink2; ctx.textAlign = 'left'; ctx.font = font(11);
        const lab = `α ${-negx >= 0 ? '+' : '−'} ${fix(Math.abs(-negx), 3)}β`;
        ctx.fillText(lab + (n === 6 ? `  ${irr(M.BENZENE_PI[Math.abs(Lv[idx].k)])}` : ''), xs0 + 28 + ((d - 1) / 2) * 56, y + 4);
        // 圆上的点
        ctx.fillStyle = c.accent; for (let q = 0; q < d; q++) { const yy = y; const xx = cx + (q - (d - 1) / 2) * 2 * Math.sqrt(Math.max(0, R * R - (yy - cy) ** 2)); ctx.beginPath(); ctx.arc(xx, yy, 3.5, 0, TAU); ctx.fill(); }
        idx += d;
      }
      // 轨道系数
      const sel = Lv[s.k - 1], prev = Lv.findIndex((l) => Math.abs(l.x - sel.x) < 1e-9), useSin = s.k - 1 > prev;
      const coef = M.huckelCoeffs(n, Math.abs(sel.k), useSin && sel.k !== 0);
      const g = fit(cv2), X0 = g.w / 2, Y0 = g.h / 2, RR = Math.min(g.w, g.h) * 0.3;
      g.ctx.strokeStyle = c.ink2; g.ctx.lineWidth = 2; g.ctx.beginPath();
      for (let j = 0; j <= n; j++) { const a = PI / 2 + (TAU * j) / n, x = X0 + RR * Math.cos(a), y = Y0 - RR * Math.sin(a); if (j) g.ctx.lineTo(x, y); else g.ctx.moveTo(x, y); }
      g.ctx.stroke();
      coef.forEach((cc, j) => { const a = PI / 2 + (TAU * j) / n, x = X0 + RR * Math.cos(a), y = Y0 - RR * Math.sin(a); g.ctx.globalAlpha = 0.85; g.ctx.fillStyle = cc >= 0 ? c.gold : c.info; g.ctx.beginPath(); g.ctx.arc(x, y, Math.max(1.5, Math.abs(cc) * RR * 0.75), 0, TAU); g.ctx.fill(); g.ctx.globalAlpha = 1; });
      const loc = s.ne, deloc = F.E - loc, kind = s.ne % 4 === 2 && !F.unpaired ? L('芳香（4N + 2，闭壳层）', 'aromatic (4N + 2, closed shell)') : F.unpaired ? L(`反芳香或自由基（${F.unpaired} 个未配对电子）`, `antiaromatic or radical (${F.unpaired} unpaired)`) : L('闭壳层', 'closed shell');
      return [[L('π 电子能量', 'π energy'), `${s.ne}α ${F.E >= 0 ? '+' : '−'} ${fix(Math.abs(F.E), 3)}β`, true], [L('离域能', 'Delocalisation energy'), `${fix(deloc, 3)} β`], [L('判断', 'Verdict'), kind], [L('所选轨道', 'Chosen orbital'), `k = ${sel.k} · α ${sel.x >= 0 ? '+' : '−'} ${fix(Math.abs(sel.x), 3)}β`]];
    },
  };

  // ── 6. 振动：数一数不动的原子 ─────────────────────────────────────
  const VIB_MOLS = M.MOLS.filter((m) => m.tbl);
  DEMOS.vib = {
    title: L('数不动的原子：振动模式、红外和拉曼', 'Counting atoms that stay put: vibrations, IR and Raman'), kind: 'exact',
    intro: L('3N 个笛卡儿位移构成一个表示 Γ₃N。它的特征标只要数“不动的原子”：每个不动的原子贡献这个操作的 3 × 3 矩阵的迹（E：3，Cₙ：1 + 2cos θ，σ：1，i：−3，Sₙ：−1 + 2cos θ）。减掉平移（x, y, z）和转动（R）就是振动 Γ_vib。按 x、y、z 变换的模式有红外吸收，按二次函数变换的有拉曼散射。点表头的一列，左边的分子就画出那个操作的对称元素，不动的原子描成金边。', 'The 3N Cartesian displacements form a representation Γ3N. Its characters only require counting atoms that stay put: each unmoved atom contributes the trace of the operation’s 3 × 3 matrix (E: 3, Cₙ: 1 + 2cos θ, σ: 1, i: −3, Sₙ: −1 + 2cos θ). Subtract translations (x, y, z) and rotations (R) and you have the vibrations Γvib. Modes that transform like x, y or z absorb in the infrared; modes that transform like quadratic functions scatter in Raman. Click a column header to draw that operation’s symmetry element on the molecule and outline the unmoved atoms in gold.'),
    sel: [['mol', L('分子', 'Molecule'), VIB_MOLS.map((m) => [m.id, `${m.f} · ${M.pretty(m.tbl)}`]), 'h2o']],
    state: () => ({ yaw: 0.6, pitch: 0.38, col: 1 }),
    changed(s, k) { if (k === 'mol') s.col = 1; },
    figs: [[0.7, L('分子和所选操作的对称元素；金边的原子在这个操作下不动。', 'The molecule and the selected operation’s element; atoms outlined in gold stay put under it.')], ['html', L('数不动的原子，得到 Γ₃N，再减去平移和转动。点表头选一个操作。', 'Count the unmoved atoms to get Γ3N, then subtract translations and rotations. Click a header to pick an operation.')]],
    note: L('分子按特征标表的标准取向放好（主轴是 z；平面分子按 Mulliken 的约定放在 yz 面里，所以水的反对称伸缩是 B₂）。线形分子属于无限群，这里没有收。测试核对 H₂O（2A₁ + B₂）、NH₃（2A₁ + 2E）、CH₄（A₁ + E + 2T₂）、BF₃（A₁′ + A₂″ + 2E′）、SF₆（A₁g + E_g + 2T₁u + T₂g + T₂u）、苯的 30 个模式和丙二烯的 15 个模式。', 'Molecules are placed in the standard orientation of their character table (principal axis z; planar molecules in the yz plane, Mulliken’s convention, so water’s antisymmetric stretch is B₂). Linear molecules belong to infinite groups and are not included. The tests check H₂O (2A₁ + B₂), NH₃ (2A₁ + 2E), CH₄ (A₁ + E + 2T₂), BF₃ (A₁′ + A₂″ + 2E′), SF₆ (A₁g + E_g + 2T₁u + T₂g + T₂u), benzene’s 30 modes and allene’s 15.'),
    draw(s, [cv, box], c) {
      const m = M.molecule(s.mol), atoms = M.centred(m), V = M.gammaVib(m), T = V.T, col = Math.min(s.col, T.classes.length - 1);
      const op = T.classes[col][2], R = M.opMatrix(op);
      const hi = new Set(atoms.map((a, i) => (M.norm(M.sub(M.mv(R, a.r), a.r)) < 1e-3 ? i : -1)).filter((i) => i >= 0));
      const el = op.t === 'C' ? { kind: 'C', n: op.n, ax: M.unit(op.ax) } : op.t === 'S' ? { kind: 'S', n: op.n, ax: M.unit(op.ax) } : op.t === 's' ? { kind: 's', nrm: M.unit(op.nrm), role: 'plane' } : op.t === 'i' ? { kind: 'i' } : null;
      drawMolecule(cv, s, atoms, c, { bonds: M.bonds(atoms), hi, els: el ? [el] : [], sel: el ? 0 : -1 });
      const row = (name, arr, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}><th>${name}</th>${arr.map((x, k) => `<td class="num${k === col ? ' is-col' : ''}">${String(Math.round(x * 1000) / 1000).replace('-', '−')}</td>`).join('')}</tr>`;
      const per = T.classes.map((cl) => M.tr(M.opMatrix(cl[2])));
      box.innerHTML = `<div class="chm-wrap"><table class="chm-table gt-ct"><tr><th>${esc(M.pretty(m.tbl))}</th>${T.classes.map((cl, k) => `<th class="${k === col ? 'is-col' : ''}"><button type="button" data-col="${k}">${subH(cl[0])}</button></th>`).join('')}</tr>
        ${row(L('不动的原子', 'unmoved atoms'), V.unmoved)}${row(L('每个原子的贡献', 'per unmoved atom'), per)}${row('Γ₃N', V.g3N, 'gt-gamma')}${row(L('− 平移', '− translations'), V.gt.map((x) => -x))}${row(L('− 转动', '− rotations'), V.gr.map((x) => -x))}${row('Γ_vib', V.gv, 'is-a')}</table></div>
        <p class="gt-result">Γ<sub>vib</sub> = ${esc(M.decompName(T, V.mult))}</p>`;
      box.onclick = (e) => { const b = e.target.closest('[data-col]'); if (b) { s.col = +b.dataset.col; s.redraw(); } };
      const irAct = T.irreps.map((ir, i) => (V.ir[i] && V.mult[i] ? irr(ir[0]) : null)).filter(Boolean), raAct = T.irreps.map((ir, i) => (V.ra[i] && V.mult[i] ? irr(ir[0]) : null)).filter(Boolean);
      const nIR = T.irreps.reduce((t, ir, i) => t + (V.ir[i] ? V.mult[i] : 0), 0), nRa = T.irreps.reduce((t, ir, i) => t + (V.ra[i] ? V.mult[i] : 0), 0), both = T.irreps.some((ir, i) => V.ir[i] && V.ra[i] && V.mult[i]);
      const centro = T.classes.some((cl) => cl[2].t === 'i');
      return [
        [L('振动模式数 3N − 6', 'Number of modes 3N − 6'), String(V.nModes), true],
        [L('红外活性（基频谱带数）', 'IR active (fundamental bands)'), `${nIR} · ${esc(irAct.join(', ') || '—')}`],
        [L('拉曼活性（谱带数）', 'Raman active (bands)'), `${nRa} · ${esc(raAct.join(', ') || '—')}`],
        [L('有对称中心？', 'Centre of symmetry?'), centro ? L(`有：互斥规则成立，红外和拉曼没有共同的谱带${both ? '（错误！）' : ''}`, `yes: the mutual-exclusion rule holds, no band is both IR and Raman active${both ? ' (error!)' : ''}`) : L('没有：有的模式两边都活性', 'no: some modes are active in both')],
      ];
    },
  };

  // ── 7. 简正模：真的算出来，再按对称性分类 ─────────────────────────
  const MODE_IDS = Object.keys(M.FF);
  const modeCache = {};
  const modesOf = (id) => (modeCache[id] ||= M.normalModes(id));
  DEMOS.modes = {
    title: L('简正模：解出来的振动，每一个都属于一个不可约表示', 'Normal modes: solve for the vibrations, and each one belongs to an irreducible representation'), kind: 'toy',
    intro: L('用一个最简单的价力场（键伸缩加键角弯曲）写出势能，对角化质量加权的 Hessian 矩阵，得到 3N − 6 个简正模。然后对每个模式做一遍每个对称操作，量出它变成了自己的几倍（特征标），就能对上特征标表的一行：对称性从来没有输入到计算里，却自动出现在答案里。简并的模式（E、T）频率完全相同。播放看振动；下图把算出的频率和实验值并排画出来。', 'Write the potential with the simplest valence force field (bond stretches plus angle bends), diagonalise the mass-weighted Hessian and get 3N − 6 normal modes. Then apply every symmetry operation to each mode and measure what multiple of itself it becomes (the character): each mode matches a row of the character table. Symmetry was never put into the calculation, yet it appears in the answer. Degenerate modes (E, T) have exactly equal frequencies. Press Play to watch a vibration; the lower figure plots computed frequencies beside the experimental ones.'),
    sel: [['mol', L('分子', 'Molecule'), MODE_IDS.map((id) => [id, `${M.molecule(id).f} · ${en ? M.molecule(id).en : M.molecule(id).zh}`]), 'h2o']],
    ctl: [['mode', L('第几个模式（频率从高到低）', 'Mode (highest frequency first)'), 1, 12, 1, 1, (v) => String(v)], ['amp', L('振幅', 'Amplitude'), 0.1, 1, 0.05, 0.5, (v) => v.toFixed(2)]],
    state: () => ({ yaw: 0.6, pitch: 0.38, ph: 0 }),
    autoplay: true, fps: 30,
    tick(s) { s.ph += 0.22; return true; },
    changed(s) { s.mode = Math.min(s.mode, modesOf(s.mol).modes.length); },
    figs: [[0.72, L('所选模式在振动（红箭头是位移方向）。', 'The chosen mode vibrating (red arrows show the displacement).')], [0.36, L('竖线：模型算出的频率（金色红外活性，灰色红外不活性）；圆点：实验基频。', 'Sticks: model frequencies (gold IR active, grey IR inactive); dots: experimental fundamentals.')]],
    note: L('力常数（mdyn/Å 和 mdyn·Å/rad²）是按实验频率粗调的整数级数值，没有交叉项，所以频率和实验差 5–20 %；平面 BF₃ 加了一个面外弯曲项。对称类别和简并度不受这些数值影响，是精确的。平衡构型下 Hessian = Σ k (∇q)(∇q)ᵀ，内坐标的梯度用中心差分；6 个零频率（平移和转动）被去掉。实验值：Shimanouchi 1972 的表（BF₃ 是 ¹¹BF₃）。', 'Force constants (mdyn/Å and mdyn·Å/rad²) are round numbers roughly tuned to experiment, with no cross terms, so frequencies are off by 5–20 %; planar BF₃ gets an out-of-plane bend term. Symmetry species and degeneracies do not depend on these values and are exact. At equilibrium the Hessian is Σ k (∇q)(∇q)ᵀ, with internal-coordinate gradients by central differences; the six zero frequencies (translations and rotations) are removed. Experiment: Shimanouchi’s 1972 tables (BF₃ is ¹¹BF₃).'),
    draw(s, [cv, cv2], c) {
      const r = modesOf(s.mol), md = r.modes[Math.min(s.mode, r.modes.length) - 1], N = r.atoms.length;
      const smax = Math.max(...r.atoms.map((_, i) => Math.hypot(md.cart[3 * i], md.cart[3 * i + 1], md.cart[3 * i + 2])));
      const f = (s.amp * 0.45 * Math.sin(s.ph)) / smax;
      const moved = r.atoms.map((a, i) => ({ el: a.el, r: [a.r[0] + f * md.cart[3 * i], a.r[1] + f * md.cart[3 * i + 1], a.r[2] + f * md.cart[3 * i + 2]] }));
      const arrows = r.atoms.map((_, i) => [i, [0, 1, 2].map((d) => (md.cart[3 * i + d] / smax) * 0.7 * s.amp)]);
      drawMolecule(cv, s, moved, c, { bonds: r.bonds, arrows: arrows.filter(([, v]) => M.norm(v) > 0.05), labels: false });
      const T = r.T, irIdx = (name) => T.irreps.findIndex((ir) => ir[0] === name), isIR = (name) => { const ir = T.irreps[irIdx(name)]; return ir && ir[2].some((x) => !/R/.test(x)); }, isRa = (name) => { const ir = T.irreps[irIdx(name)]; return ir && ir[3].length > 0; };
      const wmax = Math.max(...r.modes.map((x) => x.wn), ...(M.EXP[s.mol] || []).map((x) => x[1])) * 1.1;
      const exp = M.EXP[s.mol] || [];
      plot(cv2, { x: [0, wmax], y: [0, 1.32], xl: L('波数（cm⁻¹）', 'wavenumber (cm⁻¹)'), yt: [], series: [
        { xs: r.groups.map((g) => g.wn), ys: r.groups.map(() => 1), sticks: true, color: c.muted, width: 2 },
        { xs: r.groups.filter((g) => isIR(g.irrep)).map((g) => g.wn), ys: r.groups.filter((g) => isIR(g.irrep)).map(() => 1), sticks: true, color: c.gold, width: 3, label: L('模型', 'model') },
        { xs: exp.map((x) => x[1]), ys: exp.map(() => 0.55), dots: 4, color: c.accent, label: L('实验', 'experiment') }], marks: [{ x: md.wn, color: c.danger }],
        texts: (() => { const lo = []; return r.groups.map((g, i, a) => { lo[i] = i > 0 && !lo[i - 1] && Math.abs(a[i - 1].wn - g.wn) < wmax * 0.06; return { x: g.wn, y: lo[i] ? 1.2 : 1.08, s: irr(g.irrep), align: 'center', color: c.ink2 }; }); })() });
      const g = r.groups.find((x) => x.modes.includes(md)), e = exp.filter((x) => x[0] === md.irrep).map((x) => x[1]);
      return [
        [L('不可约表示', 'Irreducible representation'), esc(irr(md.irrep)) + (g.modes.length > 1 ? L(`（${g.modes.length} 重简并）`, ` (${g.modes.length}-fold degenerate)`) : ''), true],
        [L('模型频率', 'Model frequency'), `${fix(md.wn, 0)} cm⁻¹`],
        [L('同一对称类的实验值', 'Experiment, same species'), e.length ? `${e.join(', ')} cm⁻¹` : '—'],
        [L('红外 · 拉曼', 'IR · Raman'), `${isIR(md.irrep) ? L('活性', 'active') : L('不活性', 'inactive')} · ${isRa(md.irrep) ? L('活性', 'active') : L('不活性', 'inactive')}`],
        [L('零频率（平移 + 转动）', 'Zero frequencies (translation + rotation)'), String(r.zero)],
        [L('全部模式', 'All modes'), esc(r.groups.map((x) => irr(x.irrep) + (x.modes.length > 1 ? `×${x.modes.length}` : '')).join(' · '))],
      ];
    },
  };

  // ── 8. 角重叠模型 ──────────────────────────────────────────────
  const DLAB = {
    oh: { 'xy': 't₂g', 'xz': 't₂g', 'yz': 't₂g', 'z²': 'e_g', 'x²−y²': 'e_g' }, td: { 'z²': 'e', 'x²−y²': 'e', 'xy': 't₂', 'xz': 't₂', 'yz': 't₂' },
    d4h: { 'xy': 'b₂g', 'xz': 'e_g', 'yz': 'e_g', 'z²': 'a₁g', 'x²−y²': 'b₁g' }, sp: { 'xy': 'b₂g', 'xz': 'e_g', 'yz': 'e_g', 'z²': 'a₁g', 'x²−y²': 'b₁g' }, tbp: { 'xz': 'e″', 'yz': 'e″', 'xy': 'e′', 'x²−y²': 'e′', 'z²': 'a₁′' },
    spy: { 'xz': 'e', 'yz': 'e', 'xy': 'b₂', 'z²': 'a₁', 'x²−y²': 'b₁' }, lin: { 'xy': 'δ_g', 'x²−y²': 'δ_g', 'xz': 'π_g', 'yz': 'π_g', 'z²': 'σ_g⁺' },
  };
  DEMOS.aom = {
    title: L('配位场：d 轨道怎样按对称性分裂', 'Ligand fields: how d orbitals split by symmetry'), kind: 'approx',
    intro: L('金属周围的配体排成什么形状，就决定了五个 d 轨道分成几组、谁高谁低：组的个数和简并度完全由点群决定（d 轨道约化成哪几个不可约表示），具体的间距要靠模型。这里用角重叠模型（只算 σ 作用，每个配体把指向它的 d 轨道抬高 e_σ × 角向因子²）。拉伸轴向配体（Jahn–Teller 畸变）看 e_g 怎样再分裂；改 d 电子数和成对能，看高自旋和低自旋谁更低。', 'The shape the ligands make around the metal decides how the five d orbitals split into sets and which lie higher: the number of sets and their degeneracies are fixed entirely by the point group (which irreducible representations the d orbitals reduce to), while the actual spacings need a model. Here it is the angular overlap model (σ interactions only: each ligand raises the d orbitals pointing at it by e_σ times the square of an angular factor). Stretch the axial ligands (a Jahn–Teller distortion) to see e_g split further; change the d-electron count and pairing energy to see whether high or low spin wins.'),
    sel: [['geom', L('配位构型', 'Geometry'), Object.keys(M.GEOMS).map((id) => [id, `${en ? M.GEOMS[id].en : M.GEOMS[id].zh} · ${M.pretty(M.GEOMS[id].pg)}`]), 'oh']],
    ctl: [['ax', L('轴向配体的 e_σ（相对）', 'Axial ligand e_σ (relative)'), 0.4, 1.4, 0.01, 1, (v) => v.toFixed(2)], ['nd', L('d 电子数', 'd electrons'), 0, 10, 1, 6, (v) => `d${['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '¹⁰'][v]}`], ['P', L('成对能 P（单位 e_σ）', 'Pairing energy P (units of e_σ)'), 0, 4, 0.05, 1.5, (v) => v.toFixed(2)]],
    btn: [[L('八面体 d⁶：低自旋 Co(III)', 'Octahedral d⁶: low-spin Co(III)'), { geom: 'oh', nd: 6, P: 1.5, ax: 1 }], [L('Cu(II) d⁹ 的 Jahn–Teller 拉长', 'Jahn–Teller elongation of Cu(II) d⁹'), { geom: 'oh', nd: 9, ax: 0.75 }], [L('平面正方形 d⁸：Pt(II)', 'Square planar d⁸: Pt(II)'), { geom: 'sp', nd: 8, P: 1.5 }]],
    figs: [[0.62, L('五个 d 轨道的能级（单位 e_σ），标着它们在这个点群里的不可约表示；箭头是电子（基态那一种自旋排布）。', 'The five d levels (units of e_σ), labelled by their irreducible representations in this point group; arrows are electrons (whichever spin arrangement is the ground state).')]],
    note: L('角重叠模型：H_ij = Σ_L e_σ F_i(L) F_j(L)，F 是 d 轨道在配体方向上的角向值（z² 是 (3z² − 1)/2，x² − y² 是 √3(x² − y²)/2，xy 是 √3xy……）。只算 σ，所以八面体 t₂g 正好在 0，Δ_o = 3e_σ，四面体 Δ_t = (4/3)e_σ = (4/9)Δ_o；π 作用（会把 t₂g 抬高或压低）没有算。成对能和 e_σ 都只是相对单位，真实的 e_σ 大约几千 cm⁻¹。高、低自旋按总能量（相对重心的 CFSE 加上成对能）比较，没有考虑交换能的细节。', 'Angular overlap model: H_ij = Σ_L e_σ F_i(L) F_j(L), where F is the d orbital’s angular value in the ligand’s direction (z²: (3z² − 1)/2, x² − y²: √3(x² − y²)/2, xy: √3xy, …). Only σ is included, so octahedral t₂g sits exactly at 0, Δ_o = 3e_σ and tetrahedral Δ_t = (4/3)e_σ = (4/9)Δ_o; π interactions (which raise or lower t₂g) are left out. Pairing energy and e_σ are relative units; real e_σ values are a few thousand cm⁻¹. High and low spin are compared by total energy (CFSE relative to the barycentre plus pairing energy), without the finer details of exchange.'),
    draw(s, [cv], c) {
      const levels = M.aom(s.geom, s.ax), hs = M.dFill(levels, s.nd, s.P, false), ls = M.dFill(levels, s.nd, s.P, true), best = ls.E < hs.E - 1e-9 ? ls : hs;
      const labs = s.geom === 'oh' && Math.abs(s.ax - 1) > 1e-6 ? DLAB.d4h : DLAB[s.geom];
      const { ctx, w, h } = fit(cv), y0 = h - 30, top = 30, emax = Math.max(3.2, ...levels.map((l) => l.e)), Y = (e) => y0 - ((e + 0.3) / (emax + 0.6)) * (y0 - top);
      ctx.strokeStyle = c.line; ctx.setLineDash([3, 4]); const bary = levels.reduce((t, l) => t + l.e, 0) / 5; ctx.beginPath(); ctx.moveTo(40, Y(bary)); ctx.lineTo(w - 10, Y(bary)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText(L('重心', 'barycentre'), 6, Y(bary) - 4);
      const shells = M.degeneracies(levels.map((l) => l.e), 1e-6);
      let i0 = 0;
      for (const [e, d] of shells) {
        for (let q = 0; q < d; q++) {
          const x0 = w * 0.42 + (q - (d - 1) / 2) * 58, i = i0 + q, y = Y(e);
          ctx.strokeStyle = c.ink; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x0 - 22, y); ctx.lineTo(x0 + 22, y); ctx.stroke();
          ctx.fillStyle = c.ink2; ctx.font = font(10); ctx.textAlign = 'center'; ctx.fillText(levels[i].main, x0, y + 14);
          ctx.strokeStyle = c.danger; ctx.lineWidth = 1.8;
          for (let k = 0; k < best.occ[i]; k++) { const ex = x0 + (k ? 6 : -6), up = !k; ctx.beginPath(); ctx.moveTo(ex, y + 9); ctx.lineTo(ex, y - 9); ctx.stroke(); ctx.beginPath(); if (up) { ctx.moveTo(ex - 3, y - 5); ctx.lineTo(ex, y - 9); ctx.lineTo(ex + 3, y - 5); } else { ctx.moveTo(ex - 3, y + 5); ctx.lineTo(ex, y + 9); ctx.lineTo(ex + 3, y + 5); } ctx.stroke(); }
        }
        ctx.fillStyle = c.gold; ctx.font = font(12, 700); ctx.textAlign = 'left'; ctx.fillText(`${labs[levels[i0].main] || ''}  ${fix(e, 3)}`, w * 0.42 + ((d - 1) / 2) * 58 + 30, Y(e) + 4);
        i0 += d;
      }
      const gap = shells.length > 1 ? shells[shells.length - 1][0] - shells[shells.length - 2][0] : 0;
      return [
        [L('能级组（简并度）', 'Level sets (degeneracy)'), shells.map(([, d]) => d).join(' + '), true],
        [L('最高两组的间距', 'Gap between the top two sets'), `${fix(gap, 3)} e_σ`],
        [L('基态', 'Ground state'), best === ls && ls.unpaired !== hs.unpaired ? L('低自旋', 'low spin') : best === hs && ls.unpaired !== hs.unpaired ? L('高自旋', 'high spin') : L('高、低自旋相同', 'high and low spin coincide')],
        [L('未配对电子', 'Unpaired electrons'), String(best.unpaired)],
        [L('能量（CFSE + 成对能）高自旋 · 低自旋', 'Energy (CFSE + pairing) high · low spin'), `${fix(hs.E, 2)} · ${fix(ls.E, 2)} e_σ`],
      ];
    },
  };

  // ── 9. 十七种壁纸群 ────────────────────────────────────────────
  const MOTIF = [[0.08, 0.06], [0.3, 0.1], [0.32, 0.18], [0.16, 0.16], [0.18, 0.3], [0.1, 0.3]];
  // 含滑移反射的十个壁纸群（国际晶体学表 A 卷）
  const GLIDE = new Set(['pg', 'cm', 'p2mg', 'p2gg', 'c2mm', 'p4mm', 'p4gm', 'p3m1', 'p31m', 'p6mm']);
  const LATNAME = { oblique: L('斜方', 'oblique'), rect: L('矩形', 'rectangular'), square: L('正方', 'square'), hex: L('六方', 'hexagonal') };
  DEMOS.wallpaper = {
    title: L('十七种壁纸群：平面上能重复的花样只有这么多种', 'The seventeen wallpaper groups: the only ways to repeat a pattern in the plane'), kind: 'exact',
    intro: L('把一个不对称的小图案（像一面旗）放进晶胞，用这个群的全部操作复制，再按格子平移铺满平面。转动、镜面、滑移（反射加半个平移）和平移能组合出的方式恰好是 17 种（Fedorov 1891、Pólya 1924）。三维的对应物是 230 个空间群。“按操作上色”时，同一个操作生成的旗子同色。', 'Put an asymmetric little motif (like a flag) into the cell, copy it with every operation of the group, then tile the plane with lattice translations. Rotations, mirrors, glides (a reflection plus half a translation) and translations combine in exactly 17 ways (Fedorov 1891, Pólya 1924). The three-dimensional counterpart is the 230 space groups. With “colour by operation”, flags produced by the same operation share a colour.'),
    sel: [['g', L('壁纸群', 'Wallpaper group'), Object.keys(M.WALL).map((id) => [id, id]), 'p4gm']],
    chk: [['cell', L('画出晶胞', 'Show the unit cell'), true], ['col', L('按操作上色', 'Colour by operation'), true]],
    figs: [[0.78, L('壁纸群生成的花样。黑框是一个晶胞（c 心格子的晶胞里有两个格点）。', 'The pattern generated by the wallpaper group. The frame is one unit cell (a centred cell holds two lattice points).')]],
    note: L('操作取自国际晶体学表 A 卷的一般位置（分数坐标），c 心的群另加 (½, ½) 平移。测试核对每个群的操作对乘法封闭（模格子平移），个数等于点群的阶乘上心的格点数。名字用完整的国际符号（p2mm 即常说的 pmm）。', 'Operations come from the general positions in International Tables volume A (fractional coordinates); the centred groups add the (½, ½) translation. The tests check that each group’s operations are closed under multiplication (modulo lattice translations) and number the point-group order times the lattice points per cell. Names are full international symbols (p2mm is the usual pmm).'),
    draw(s, [cv], c) {
      const W = M.WALL[s.g], ops = M.wallOps(s.g), { ctx, w, h } = fit(cv), lat = W.lat, sc = Math.min(w, h) / 3.2;
      const [a, b] = M.LATTICE[lat], toS = ([u, v]) => { const p = M.toCart(lat, [u, v]); return [w / 2 + (p[0] - (a[0] + b[0]) / 2) * sc, h / 2 - (p[1] - (a[1] + b[1]) / 2) * sc]; };
      const hue = (k) => `hsl(${Math.round((360 * k) / ops.length)} 60% ${document.documentElement.dataset.theme === 'dark' ? 55 : 45}%)`;
      ctx.lineJoin = 'round';
      for (let i = -3; i <= 4; i++) for (let j = -3; j <= 4; j++) ops.forEach((op, k) => {
        const pts = MOTIF.map((p) => { const q = M.applyAff(op, p); return toS([q[0] + i, q[1] + j]); });
        if (pts.every(([x, y]) => x < -20 || x > w + 20 || y < -20 || y > h + 20)) return;
        ctx.beginPath(); pts.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
        ctx.fillStyle = s.col ? hue(k) : c.accent; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = c.ink2; ctx.lineWidth = 0.8; ctx.stroke();
      });
      if (s.cell) { const q = [[0, 0], [1, 0], [1, 1], [0, 1]].map(toS); ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); q.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); }
      const hasM = /m/.test(s.g), hasG = GLIDE.has(s.g), rotN = { '1': 1, '2': 2, 'm': 1, '2mm': 2, '4': 4, '4mm': 4, '3': 3, '3m': 3, '6': 6, '6mm': 6 }[W.pt];
      return [[L('格子', 'Lattice'), `${LATNAME[lat]}${W.center ? L('（c 心）', ' (centred)') : ''}`, true], [L('点群', 'Point group'), W.pt], [L('每个晶胞的操作数', 'Operations per cell'), String(ops.length)], [L('最高转动', 'Highest rotation'), rotN > 1 ? `${rotN} ${L('次', '-fold')}` : L('无', 'none')], [L('镜面 · 滑移', 'Mirrors · glides'), `${hasM ? L('有', 'yes') : L('无', 'no')} · ${hasG ? L('有', 'yes') : L('无', 'no')}`]];
    },
  };

  // ── 10. 晶体学限制 ─────────────────────────────────────────────
  DEMOS.restrict = {
    title: L('为什么晶体没有五次轴：晶体学限制定理', 'Why crystals have no five-fold axes: the crystallographic restriction'), kind: 'exact',
    intro: L('把一个格子转 2π/n，转完的点（金色）还要和原来的格点（灰色）全部重合，才能算格子的对称操作。在格子自己的基底里，这个转动是整数矩阵，所以它的迹 2cos(2π/n) 必须是整数：只有 n = 1、2、3、4、6 行。拖到 5、7、8 看看：只有中心那一个点重合。1984 年发现的准晶有五次（二十面体）对称的衍射图，但它们没有平移周期。', 'Rotate a lattice by 2π/n: for this to be a symmetry, every rotated point (gold) must land on an original lattice point (grey). In the lattice’s own basis the rotation is an integer matrix, so its trace 2cos(2π/n) must be an integer: only n = 1, 2, 3, 4, 6 work. Drag to 5, 7 or 8: only the centre point coincides. The quasicrystals found in 1984 show five-fold (icosahedral) symmetry in diffraction, but they have no translational period.'),
    ctl: [['n', L('转动的次数 n', 'Rotation order n'), 2, 12, 1, 5, (v) => `n = ${v}`]],
    figs: [[0.8, L('灰点：格子（n = 3、6、12 用六方格子，其他用正方格子）；金点：转过 2π/n 以后。', 'Grey: the lattice (hexagonal for n = 3, 6, 12, square otherwise); gold: after rotating by 2π/n.')]],
    note: L('格子的矩阵在格子基底里是整数矩阵，换到笛卡儿基底是一个相似变换，迹不变：tr R = 2cos(2π/n)（二维；三维再加 1）。只有 cos 取 0、±½、±1 时迹是整数。圆圈内重合点的个数用 0.01 的容差数。', 'The rotation is an integer matrix in the lattice basis; changing to the Cartesian basis is a similarity transformation, which leaves the trace unchanged: tr R = 2cos(2π/n) (in 2D; add 1 in 3D). The trace is an integer only when cos is 0, ±½ or ±1. Coinciding points inside the circle are counted with a tolerance of 0.01.'),
    draw(s, [cv], c) {
      const n = s.n, hex = [3, 6, 12].includes(n), A = hex ? [[1, 0], [0.5, Math.sqrt(3) / 2]] : [[1, 0], [0, 1]];
      const { ctx, w, h } = fit(cv), sc = Math.min(w, h) / 9, Rmax = 4, th = TAU / n, cs = Math.cos(th), sn = Math.sin(th);
      const pts = []; for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) { const x = i * A[0][0] + j * A[1][0], y = i * A[0][1] + j * A[1][1]; if (Math.hypot(x, y) <= Rmax + 1e-9) pts.push([x, y]); }
      const P = ([x, y]) => [w / 2 + x * sc, h / 2 - y * sc];
      ctx.strokeStyle = c.line; ctx.beginPath(); ctx.arc(w / 2, h / 2, Rmax * sc, 0, TAU); ctx.stroke();
      let hit = 0;
      for (const p of pts) { const [x, y] = P(p); ctx.fillStyle = c.muted; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
      for (const p of pts) { const q = [cs * p[0] - sn * p[1], sn * p[0] + cs * p[1]], on = pts.some((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 0.01); if (on) hit++; const [x, y] = P(q); ctx.strokeStyle = on ? c.accent : c.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke(); }
      const t = M.restrictionTrace(n), ok = M.allowedRotation(n);
      return [[L('迹 2cos(2π/n)', 'Trace 2cos(2π/n)'), fix(t, 4), true], [L('是整数？', 'An integer?'), ok ? L('是：允许的晶体对称', 'yes: an allowed crystal symmetry') : L('不是：周期晶体不可能有这种轴', 'no: impossible in a periodic crystal')], [L('圆内重合的点', 'Points that coincide (inside the circle)'), `${hit} / ${pts.length}`]];
    },
  };

  // ── 11. SU(2) 和 SO(3) ────────────────────────────────────────
  DEMOS.su2 = {
    title: L('转 360° 不等于没转：自旋 ½ 和 SU(2)', 'Turning 360° is not the same as not turning: spin ½ and SU(2)'), kind: 'exact',
    intro: L('一个普通的物体（左图的三根坐标轴）转 2π 回到原样：三维转动群 SO(3) 里 R(2π) = 1。自旋 ½ 的态按 SU(2) 变换：U(θ) = cos(θ/2) − i sin(θ/2) n·σ，转 2π 得到 U = −1，波函数变号，要转 4π 才回来。每个转动 R 对应两个 U（±U），SU(2) 是 SO(3) 的“双重覆盖”。这个负号在 1975 年被中子干涉实验直接测到。', 'An ordinary object (the three axes on the left) comes back to itself after a 2π turn: in the rotation group SO(3), R(2π) = 1. A spin-½ state transforms under SU(2): U(θ) = cos(θ/2) − i sin(θ/2) n·σ, and a 2π turn gives U = −1, flipping the sign of the wavefunction; it takes 4π to come back. Each rotation R corresponds to two matrices ±U: SU(2) is the “double cover” of SO(3). The minus sign was measured directly by neutron interferometry in 1975.'),
    sel: [['axis', L('转轴', 'Axis'), [['z', 'z'], ['x', 'x'], ['d', '(1, 1, 1)']], 'z']],
    ctl: [['th', L('转角 θ', 'Angle θ'), 0, 4, 0.01, 1.3, (v) => `${v.toFixed(2)}π`]],
    btn: [[L('θ = 2π', 'θ = 2π'), { th: 2 }], [L('θ = 4π', 'θ = 4π'), { th: 4 }]],
    state: () => ({ yaw: 0.6, pitch: 0.35 }),
    fps: 30, tick(s) { s.th = (s.th + 0.02) % 4; return true; },
    figs: [[0.6, L('左：一个物体转 θ 以后（SO(3)）。右：自旋向上态 |↑⟩ 转 θ 以后的振幅 ⟨↑|U|↑⟩ 在复平面上走过的路径，从 1 出发，2π 时到 −1，4π 时回到 1。', 'Left: an object after turning by θ (SO(3)). Right: the amplitude ⟨↑|U|↑⟩ of the spin-up state after turning by θ, traced in the complex plane: it starts at 1, reaches −1 at 2π and returns to 1 at 4π.')]],
    note: L('R 由 U 按 R_ij = ½ tr(σ_i U σ_j U†) 算出，测试核对它和 Rodrigues 公式给出的转动矩阵逐元一致，而且 U 和 −U 给出同一个 R。沿 z 轴转时 ⟨↑|U|↑⟩ = e^{−iθ/2}，沿 x 轴转时是 cos(θ/2)（只在实轴上来回）。', 'R is computed from U by R_ij = ½ tr(σ_i U σ_j U†); the tests check that it agrees element by element with the Rodrigues rotation matrix and that U and −U give the same R. For a turn about z, ⟨↑|U|↑⟩ = e^{−iθ/2}; about x it is cos(θ/2) (moving back and forth along the real axis).'),
    draw(s, [cv], c) {
      const n = s.axis === 'z' ? [0, 0, 1] : s.axis === 'x' ? [1, 0, 0] : [1, 1, 1], th = s.th * PI, U = M.su2(n, th), R = M.so3FromSu2(U);
      const { ctx, w, h } = fit(cv), half = w / 2;
      // 左：坐标轴
      const P = camera(s, half, h, 1.5);
      const o = P([0, 0, 0]), na = M.unit(n);
      ctx.strokeStyle = c.line; ctx.setLineDash([5, 4]); const a1 = P(M.scale(na, -1.6)), a2 = P(M.scale(na, 1.6)); ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.stroke(); ctx.setLineDash([]);
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, k) => { const p = P(M.mv(R, M.scale(e, 1.2))); K.arrow(ctx, o.x, o.y, p.x, p.y, [c.danger, c.accent, c.gold][k], 3); ctx.fillStyle = [c.danger, c.accent, c.gold][k]; ctx.font = font(12, 700); ctx.fillText(['x′', 'y′', 'z′'][k], p.x + 4, p.y - 4); });
      draggable(cv, s);
      // 右：复平面
      const cx = half + half / 2, cy = h / 2, rr = Math.min(half, h) * 0.36;
      ctx.strokeStyle = c.line; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - rr - 10, cy); ctx.lineTo(cx + rr + 10, cy); ctx.moveTo(cx, cy - rr - 10); ctx.lineTo(cx, cy + rr + 10); ctx.stroke();
      ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'center'; ctx.fillText('1', cx + rr + 2, cy + 14); ctx.fillText('−1', cx - rr - 4, cy + 14); ctx.fillText('Re', cx + rr + 14, cy - 4); ctx.fillText('Im', cx + 10, cy - rr - 4);
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let k = 0; k <= 200; k++) { const t = (th * k) / 200, u = M.su2(n, t)[0][0], x = cx + u[0] * rr, y = cy - u[1] * rr; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      const u = U[0][0]; ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(cx + u[0] * rr, cy - u[1] * rr, 5, 0, TAU); ctx.fill();
      const isI = M.sameM(R, M.I3(), 1e-9), trU = 2 * Math.cos(th / 2), trR = M.tr(R);
      return [[L('tr R = 1 + 2cos θ', 'tr R = 1 + 2cos θ'), fix(trR, 3)], [L('tr U = 2cos(θ/2)', 'tr U = 2cos(θ/2)'), fix(trU, 3), true], [L('R 是单位矩阵？', 'Is R the identity?'), isI ? L('是', 'yes') : L('否', 'no')], [L('U', 'U'), Math.abs(trU - 2) < 1e-6 ? '+1' : Math.abs(trU + 2) < 1e-6 ? '−1' : L('不是 ±1', 'not ±1')]];
    },
  };

  // ── 12. Clebsch–Gordan 系数 ────────────────────────────────────
  // 把系数写成 ±√(p/q)
  const ratio = (v) => { const x = v * v; for (let q = 1; q <= 2000; q++) { const p = Math.round(x * q); if (Math.abs(p / q - x) < 1e-9) { const g = (a, b) => (b ? g(b, a % b) : a), d = g(p, q); return { p: p / d, q: q / d }; } } return null; };
  const surd = (v) => { if (Math.abs(v) < 1e-12) return '0'; const r = ratio(v), sg = v < 0 ? '−' : ''; if (!r) return fix(v, 4); if (r.q === 1) return `${sg}${Math.sqrt(r.p) % 1 === 0 ? Math.sqrt(r.p) : `√${r.p}`}`; return `${sg}√(${r.p}/${r.q})`; };
  const JS = [0.5, 1, 1.5, 2, 2.5, 3];
  let curM = [];
  DEMOS.cg = {
    title: L('把两个角动量加起来：Clebsch–Gordan 系数', 'Adding two angular momenta: Clebsch–Gordan coefficients'), kind: 'exact',
    intro: L('两个角动量 j₁、j₂ 的直积 D^{j₁} ⊗ D^{j₂} 可以约化成 J = |j₁ − j₂| … j₁ + j₂ 的不可约表示，每个出现一次。换基底的系数 ⟨j₁m₁ j₂m₂|JM⟩ 就是 CG 系数，它们组成一个正交矩阵（每个 M 一块）。这张表和讲解手册、NequIP 里的张量积是同一样东西：等变神经网络把特征按 l 分开，用 CG 系数把它们乘在一起。', 'The direct product D^{j₁} ⊗ D^{j₂} of two angular momenta reduces into irreducible representations J = |j₁ − j₂| … j₁ + j₂, each once. The change-of-basis coefficients ⟨j₁m₁ j₂m₂|JM⟩ are the CG coefficients, and they form an orthogonal matrix (one block per M). This table is the same object as the tensor product in NequIP: equivariant neural networks split features by l and multiply them with CG coefficients.'),
    sel: [['j1', 'j₁', JS.map((j) => [j, M.half(j)]), 1], ['j2', 'j₂', JS.slice(0, 4).map((j) => [j, M.half(j)]), 0.5]],
    ctl: [['mi', L('M（总磁量子数）', 'M (total magnetic quantum number)'), 0, 12, 1, 0, (v) => (curM.length ? M.half(curM[Math.min(v, curM.length - 1)]) : String(v))]],
    changed(s) { const j1 = Number(s.j1), j2 = Number(s.j2); curM = M.mList(j1 + j2); if (s.mi > curM.length - 1) s.mi = curM.length - 1; },
    figs: [['html', L('一个 M 块：行是 (m₁, m₂)，列是 J。每一列、每一行的平方和都是 1。', 'One M block: rows are (m₁, m₂), columns are J. Squares sum to 1 along every row and column.')]],
    note: L('用 Racah 的闭合公式算（Condon–Shortley 相位约定），系数写成 ±√(p/q)。测试对照 ⟨½ ½ ½ −½|1 0⟩ = 1/√2、⟨1 1 1 −1|0 0⟩ = 1/√3、⟨1 0 1 0|2 0⟩ = √(2/3)、⟨1 0 1 0|1 0⟩ = 0 等已知值，并核对每个 M 块都是正交矩阵。', 'Computed with Racah’s closed formula (Condon–Shortley phase convention), coefficients written as ±√(p/q). The tests compare with known values ⟨½ ½ ½ −½|1 0⟩ = 1/√2, ⟨1 1 1 −1|0 0⟩ = 1/√3, ⟨1 0 1 0|2 0⟩ = √(2/3), ⟨1 0 1 0|1 0⟩ = 0, and check that every M block is an orthogonal matrix.'),
    draw(s, [box]) {
      const j1 = Number(s.j1), j2 = Number(s.j2), Mv = curM[Math.min(s.mi, curM.length - 1)];
      const Js = M.jList(j1, j2).filter((J) => J >= Math.abs(Mv) - 1e-9), rows = [];
      for (const m1 of M.mList(j1)) { const m2 = Mv - m1; if (Math.abs(m2) <= j2 + 1e-9 && Math.abs(Math.round(2 * (j2 - m2)) - 2 * (j2 - m2)) < 1e-9) rows.push([m1, m2]); }
      const C = rows.map(([m1, m2]) => Js.map((J) => M.cg(j1, m1, j2, m2, J, Mv)));
      let err = 0; for (let a = 0; a < Js.length; a++) for (let b = 0; b < Js.length; b++) { const d = rows.reduce((t, _, r) => t + C[r][a] * C[r][b], 0); err = Math.max(err, Math.abs(d - (a === b ? 1 : 0))); }
      box.innerHTML = `<div class="chm-wrap"><table class="chm-table gt-ct"><tr><th>(m₁, m₂) \\ J</th>${Js.map((J) => `<th>${M.half(J)}</th>`).join('')}</tr>${rows.map(([m1, m2], r) => `<tr><th>(${M.half(m1)}, ${M.half(m2)})</th>${C[r].map((v) => `<td class="num">${surd(v)}</td>`).join('')}</tr>`).join('')}</table></div>`;
      const dimL = (2 * j1 + 1) * (2 * j2 + 1), dimR = M.jList(j1, j2).reduce((t, J) => t + 2 * J + 1, 0);
      return [[L('J 的取值', 'Allowed J'), M.jList(j1, j2).map(M.half).join(', '), true], [L('维数', 'Dimensions'), `${M.half(2 * j1 + 1)} × ${M.half(2 * j2 + 1)} = ${dimL} = ${M.jList(j1, j2).map((J) => 2 * J + 1).join(' + ')} = ${dimR}`], [L('这一块的大小', 'Size of this block'), `${rows.length} × ${Js.length}`], [L('正交性误差', 'Orthogonality error'), err < 1e-12 ? '< 10⁻¹²' : fmt(err, 2)]];
    },
  };

  // ── 13. 能带的对称性 ───────────────────────────────────────────
  const PATH = M.bzPath(40);
  DEMOS.bands = {
    title: L('平移对称给出能带，点群对称给出简并：二维近自由电子', 'Translations give bands, the point group gives degeneracies: nearly free electrons in 2D'), kind: 'exact',
    intro: L('正方格子里的电子：没有势场时（空格子），能带就是折回第一布里渊区的抛物线 |k + G|²，在高对称点上大量简并。打开周期势 V，布里渊区边界（X 点）上的简并被劈开，开出能隙 ≈ 2|V|；但在 M 点和 Γ 点，有些二重简并留了下来，怎么调 V 都劈不开：那里的“小群”C₄ᵥ 有二维不可约表示 E。哪些简并保得住，由对称性说了算。', 'Electrons on a square lattice: with no potential (the empty lattice) the bands are just parabolas |k + G|² folded back into the first Brillouin zone, heavily degenerate at the high-symmetry points. Switch on a periodic potential V and the degeneracy at the zone boundary (X) splits, opening a gap ≈ 2|V|; but at M and Γ some two-fold degeneracies survive however you tune V: the “little group” there, C₄v, has a two-dimensional irreducible representation E. Symmetry decides which degeneracies are protected.'),
    ctl: [['v10', L('V₁₀（最短倒格矢）', 'V₁₀ (shortest reciprocal vector)'), -0.3, 0.3, 0.01, 0.08, (v) => v.toFixed(2)], ['v11', L('V₁₁（次短）', 'V₁₁ (next shortest)'), -0.3, 0.3, 0.01, 0.04, (v) => v.toFixed(2)]],
    chk: [['empty', L('叠上空格子的能带', 'Overlay the empty-lattice bands'), true]],
    btn: [[L('空格子 V = 0', 'Empty lattice V = 0'), { v10: 0, v11: 0 }]],
    figs: [[0.7, L('沿 Γ → X → M → Γ 的能带（单位 ħ²(2π/a)²/2m）。虚线是空格子。', 'Bands along Γ → X → M → Γ (units of ħ²(2π/a)²/2m). Dashed: the empty lattice.')]],
    note: L('平面波展开：H_GG′ = |k + G|² δ + V(G − G′)，取 |G| 的分量不超过 3 的 49 个平面波，只保留最短（V₁₀）和次短（V₁₁）两种傅里叶分量。势场有正方格子的全部对称性（C₄ᵥ），所以 M 点的 E 简并被保护。测试核对 V = 0 时和空格子公式一致、X 点能隙在小 V 时等于 2|V₁₀|（一阶微扰）、M 点保留二重简并。', 'Plane-wave expansion: H_GG′ = |k + G|² δ + V(G − G′), with the 49 plane waves whose components are at most 3 in size, keeping only the shortest (V₁₀) and next-shortest (V₁₁) Fourier components. The potential has the full symmetry of the square lattice (C₄v), so the E degeneracy at M is protected. The tests check agreement with the empty-lattice formula at V = 0, a gap of 2|V₁₀| at X for small V (first-order perturbation theory) and the surviving two-fold degeneracy at M.'),
    draw(s, [cv], c) {
      const nb = 6, B = PATH.pts.map((p) => M.nfeBands(p.k, s.v10, s.v11, 3, nb)), E0 = PATH.pts.map((p) => M.emptyLattice(p.k, 3, nb)), xs = PATH.pts.map((p) => p.s);
      const series = [];
      if (s.empty) for (let b = 0; b < nb; b++) series.push({ xs, ys: E0.map((e) => e[b]), color: c.muted, dash: [4, 4], width: 1.2 });
      for (let b = 0; b < nb; b++) series.push({ xs, ys: B.map((e) => e[b]), color: [c.accent, c.gold, c.info, c.danger, c.accent, c.gold][b], width: 2.2 });
      plot(cv, { x: [0, PATH.ticks[3]], y: [Math.min(-0.3, ...B.map((e) => e[0])), 2.1], xt: PATH.ticks, xf: (t) => PATH.labels[PATH.ticks.indexOf(t)] || '', yl: L('能量', 'energy'), series, marks: PATH.ticks.slice(1, 3).map((x) => ({ x, color: c.line })) });
      const X = M.nfeBands([0.5, 0], s.v10, s.v11, 3, nb), Mp = M.degeneracies(M.nfeBands([0.5, 0.5], s.v10, s.v11, 3, nb), 1e-7), G = M.degeneracies(M.nfeBands([0, 0], s.v10, s.v11, 3, nb), 1e-7);
      return [[L('X 点最低的能隙', 'Lowest gap at X'), fix(X[1] - X[0], 4), true], [L('2|V₁₀|', '2|V₁₀|'), fix(2 * Math.abs(s.v10), 4)], [L('M 点的能级（简并度）', 'Levels at M (degeneracy)'), Mp.slice(0, 4).map(([e, d]) => `${fix(e, 3)}${d > 1 ? `×${d}` : ''}`).join(' · ')], [L('Γ 点的能级（简并度）', 'Levels at Γ (degeneracy)'), G.slice(0, 4).map(([e, d]) => `${fix(e, 3)}${d > 1 ? `×${d}` : ''}`).join(' · ')]];
    },
  };

  // ── 14. 对称性破缺：Landau 自由能 ──────────────────────────────────
  DEMOS.landau = {
    title: L('对称性自发破缺：方程对称，基态不对称', 'Spontaneous symmetry breaking: a symmetric equation, an asymmetric ground state'), kind: 'toy',
    intro: L('自由能 f(m) = a(T − T_c)m² + bm⁴ 在 m → −m 下不变（Z₂ 对称）。T > T_c 时只有一个极小 m = 0，对称的；T < T_c 时 m = 0 变成极大，两个极小 ±m₀ 互为镜像，系统只能挑一个：对称性被基态“自发”破坏了。加一点外场 h 就决定了挑哪一个。铁磁体、超导体、液晶，以及粒子物理的 Higgs 机制，都是这个故事。', 'The free energy f(m) = a(T − T_c)m² + bm⁴ is unchanged under m → −m (Z₂ symmetry). Above T_c there is a single minimum m = 0, symmetric; below T_c, m = 0 becomes a maximum and two minima ±m₀, mirror images of each other, appear: the system has to pick one, and the ground state breaks the symmetry “spontaneously”. A small field h decides which. Ferromagnets, superconductors, liquid crystals and the Higgs mechanism of particle physics all tell this story.'),
    ctl: [['t', L('温度 T / T_c', 'Temperature T / T_c'), 0.1, 1.6, 0.01, 0.6, (v) => v.toFixed(2)], ['h', L('外场 h', 'Field h'), -0.2, 0.2, 0.005, 0, (v) => v.toFixed(3)]],
    btn: [[L('高温', 'Hot'), { t: 1.4, h: 0 }], [L('低温、没有外场', 'Cold, no field'), { t: 0.5, h: 0 }], [L('低温、小外场', 'Cold, small field'), { t: 0.5, h: 0.03 }]],
    figs: [[0.5, L('自由能 f(m)；红点是整体最小。', 'Free energy f(m); the red dot is the global minimum.')], [0.42, L('序参量 m₀(T)：在 T_c 处按 (T_c − T)^{1/2} 长出来（平均场的临界指数 β = ½）。', 'Order parameter m₀(T): it grows as (T_c − T)^{1/2} below T_c (the mean-field exponent β = ½).')]],
    note: L('取 a = b = 1。这是平均场（Landau）理论：忽略涨落，临界指数 β = ½；真实的三维 Ising 系统 β ≈ 0.326，二维 Ising β = 1/8。h = 0 时两个极小一样深，程序挑格点扫描先遇到的那一个，真实系统由微小的扰动决定。', 'With a = b = 1. This is mean-field (Landau) theory: fluctuations are ignored and β = ½; the real 3D Ising system has β ≈ 0.326, the 2D Ising β = 1/8. At h = 0 both minima are equally deep and the program takes whichever its grid scan meets first; a real system is decided by tiny perturbations.'),
    draw(s, [cv, cv2], c) {
      const ms = lin(-1.1, 1.1, 300), f = ms.map((m) => M.landauF(m, s.t, s.h)), m0 = M.landauMin(s.t, s.h);
      plot(cv, { x: [-1.1, 1.1], y: [Math.min(...f) - 0.05, Math.max(0.3, Math.min(1, Math.max(...f)))], xl: 'm', yl: 'f(m)', series: [{ xs: ms, ys: f, color: c.accent, width: 2.4 }], marks: [{ x: m0, y: M.landauF(m0, s.t, s.h), color: c.danger }] });
      const ts = lin(0.05, 1.6, 200);
      plot(cv2, { x: [0, 1.6], y: [-0.05, 0.75], xl: 'T / T_c', yl: 'm₀', series: [{ xs: ts, ys: ts.map((t) => M.landauM0(t)), color: c.gold, width: 2.2, label: 'h = 0' }, ...(Math.abs(s.h) > 1e-9 ? [{ xs: ts, ys: ts.map((t) => Math.abs(M.landauMin(t, s.h))), color: c.info, dash: [5, 4], label: `h = ${fix(s.h, 3)}` }] : [])], marks: [{ x: s.t, y: Math.abs(m0), color: c.danger }, { x: 1, color: c.line }] });
      const broken = s.t < 1 && Math.abs(s.h) < 1e-9;
      return [[L('平衡的 m', 'Equilibrium m'), fix(m0, 4), true], [L('m₀ = √((1 − T/T_c)/2)', 'm₀ = √((1 − T/T_c)/2)'), fix(M.landauM0(s.t), 4)], [L('对称性', 'Symmetry'), s.t >= 1 ? (Math.abs(s.h) < 1e-9 ? L('保持（唯一的极小在 m = 0）', 'kept (single minimum at m = 0)') : L('被外场明显破坏', 'broken explicitly by the field')) : broken ? L('自发破缺（两个等深的极小）', 'spontaneously broken (two equal minima)') : L('外场挑出了一个极小', 'the field picks one minimum')]];
    },
  };
};
