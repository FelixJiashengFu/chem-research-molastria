/* 模型接口页“过渡态与 IRC”两项计算（ts、neb）的纯逻辑（MolAstriaTS）：上限和次数、读 XYZ、核对反应物和产物、
   请求参数、把结果整理成能量曲线、表格、CSV，以及把虚频振动做成多帧 XYZ 动画。不碰 DOM，也不发请求。
   在线部分由站长电脑上的 tools/uma-server/tsjobs.py 执行（Sella 找鞍点和做 IRC，ASE 的 NEB），规则和那边、和
   账号服务 deploy/account-worker.js 是同一套（tools/ts-test.mjs 核对三处的上限和次数）。 */
(function (root) {
  'use strict';

  const MAX_ATOMS = 50; // tsjobs.MAX_ATOMS；账号服务 TS_MAX_ATOMS
  const COST = { ts: 5, neb: 8 }; // 账号服务 UMA_COST
  const FMAX = { lo: 0.001, hi: 0.05, def: 0.01 }; // eV/Å，鞍点的收敛判据
  const IRC_STEPS = { lo: 10, hi: 200, def: 60 }; // 每个方向最多几步（每步 0.1 √amu·Å）
  const IMAGES = { lo: 3, hi: 11, def: 7 }; // NEB 的中间图像数
  const KCAL = 23.0605; // kcal/mol per eV

  /** XYZ 文本 → { symbols, positions } 或 { error }。和账号服务的检查一样：原子数、注释行、每行“元素 x y z”。 */
  function readXyz(text) {
    const v = String(text ?? '').replace(/\r/g, '');
    if (!v.trim()) return { error: '先粘贴或上传一个 XYZ 结构。' };
    const lines = v.replace(/^\s*\n/, '').split('\n');
    const n = Number(lines[0].trim());
    if (!Number.isInteger(n) || n < 1) return { error: 'XYZ 的第一行要是原子数。' };
    const rows = lines.slice(2, 2 + n).map((l) => l.trim().split(/\s+/));
    if (rows.length !== n || !rows.every((f) => f.length >= 4 && /^[A-Z][a-z]?$/.test(f[0]) && f.slice(1, 4).every((x) => x !== '' && Number.isFinite(Number(x))))) return { error: 'XYZ 的原子行要写成“元素符号 x y z”，行数要和第一行的原子数一致。' };
    return { symbols: rows.map((f) => f[0]), positions: rows.map((f) => f.slice(1, 4).map(Number)) };
  }

  /** 过渡态计算能不能用这个结构：原子数 2–50。返回中文的原因，没问题是 ''。 */
  function checkAtoms(n) {
    if (n < 2) return '过渡态计算至少要 2 个原子。';
    if (n > MAX_ATOMS) return `过渡态计算最多 ${MAX_ATOMS} 个原子（要算 Hessian 和两个方向的 IRC），这个结构有 ${n} 个。`;
    return '';
  }

  /** NEB 的反应物和产物：同样的原子、同样的顺序。返回中文的原因，没问题是 ''。 */
  function checkPair(reactText, productText) {
    const r = readXyz(reactText), p = readXyz(productText);
    if (r.error) return `反应物：${r.error}`;
    if (!String(productText ?? '').trim()) return '再给出产物的 XYZ（和反应物同样的原子、同样的顺序）。';
    if (p.error) return `产物：${p.error}`;
    if (p.symbols.length !== r.symbols.length) return `产物有 ${p.symbols.length} 个原子，反应物有 ${r.symbols.length} 个；两边要一样多。`;
    const k = r.symbols.findIndex((s, i) => s !== p.symbols[i]);
    if (k >= 0) return `第 ${k + 1} 个原子在反应物里是 ${r.symbols[k]}，在产物里是 ${p.symbols[k]}：两边的原子要按同样的顺序排。`;
    const moved = Math.max(...r.positions.map((a, i) => Math.hypot(...a.map((x, d) => x - p.positions[i][d]))));
    if (moved < 0.05) return '产物和反应物几乎一样，没有可以连起来的反应路径。';
    return checkAtoms(r.symbols.length);
  }

  /** 请求的 params（只放和默认值不同的也可以，这里全部写上，和页面上看到的一致）。 */
  function params(job, v = {}) {
    const out = { fmax: v.fmax ?? FMAX.def, irc: v.irc ?? true, irc_steps: v.irc_steps ?? IRC_STEPS.def };
    if (job === 'neb') Object.assign(out, { images: v.images ?? IMAGES.def, product_xyz: String(v.product_xyz ?? '').replace(/\r/g, '') });
    return out;
  }

  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN);

  /** 结果 → 能量曲线 [[s, kcal/mol]]（相对过渡态），以及两端相对能量最低一端的曲线（反应能图常用这种画法）。 */
  function profile(r) {
    const p = Array.isArray(r?.profile) ? r.profile : [];
    const pts = p.map((x) => [num(x.s), num(x.rel_kcal)]).filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e));
    if (!pts.length) return { pts: [], fromLow: [] };
    const low = Math.min(...pts.map((x) => x[1]));
    return { pts, fromLow: pts.map(([s, e]) => [s, e - low]) };
  }

  /** NEB 的能带：[[图像编号, kcal/mol（相对反应物）]]。 */
  function band(r) {
    const e = r?.neb?.energies_rel_kcal;
    return Array.isArray(e) ? e.map((x, i) => [i, num(x)]).filter(([, y]) => Number.isFinite(y)) : [];
  }

  /** 两个方向的能垒和反应能（kcal/mol）。reverse 一端是曲线左边（s < 0），forward 是右边。 */
  function barriers(r) {
    const f = r?.irc?.forward, b = r?.irc?.reverse;
    return { left: num(b?.barrier_kcal), right: num(f?.barrier_kcal), reaction: num(r?.reaction_energy_kcal) };
  }

  /** 这个结构是不是一阶鞍点、该提醒什么：返回 [种类, 中文] 的列表，种类是 ok / warn。
      中文由 i18n.js 按 i18n/en.json 译成英文（tools/i18n-extract.ts 抽这个文件），所以字面量里不写 < 和 >：抽取时会当成标签切掉。 */
  function verdict(r) {
    const out = [];
    if (r?.ts_converged === false) out.push(['warn', `鞍点搜索没有收敛（${r.ts_steps ?? '?'} 步后最大受力 ${num(r.ts_fmax_ev_a).toFixed(3)} eV/Å），下面的结构只是最后一步。`]);
    const big = Number(r?.n_imag_significant);
    if (big === 1) out.push(['ok', `一个虚频 ${num(r.imag_cm1).toFixed(0)} cm⁻¹：是一阶鞍点（过渡态）。`]);
    else if (big === 0) out.push(['warn', '没有明显的虚频：这个结构更像能量极小点，不是过渡态。换一个更靠近过渡态的猜测结构再试。']);
    else if (big > 1) out.push(['warn', `有 ${big} 个明显的虚频：这是高阶鞍点，不是过渡态。沿多出来的虚频方向扰动结构后再算一次。`]);
    for (const [d, name] of [['reverse', '左端（s 为负）'], ['forward', '右端（s 为正）']]) {
      const e = r?.irc?.[d];
      if (e && e.irc_converged === false && e.irc_note) out.push(['warn', `${name}的 IRC 在第 ${e.irc_steps} 步停下（${e.irc_note}），之后直接优化到极小点。`]);
      if (e && e.relax_converged === false) out.push(['warn', `${name}的终点没有优化到收敛。`]);
    }
    return out;
  }

  /** 沿虚频振动方向来回摆动的多帧 XYZ（amp Å 的最大位移，frames 帧一个周期），给 3D 查看器做动画。 */
  function modeFrames(tsXyz, mode, frames = 16, amp = 0.35) {
    const t = readXyz(tsXyz);
    if (t.error || !Array.isArray(mode) || mode.length !== t.symbols.length) return '';
    let out = '';
    for (let k = 0; k < frames; k++) {
      const c = amp * Math.sin((2 * Math.PI * k) / frames);
      out += `${t.symbols.length}\nimaginary mode ${k + 1}/${frames}\n` + t.symbols.map((s, i) => `${s} ${t.positions[i].map((x, d) => (x + c * num(mode[i][d] ?? 0)).toFixed(5)).join(' ')}`).join('\n') + '\n';
    }
    return out;
  }

  /** CSV：路径上每一点，再加一段汇总。 */
  function csv(r) {
    const head = 's_sqrt_amu_angstrom,energy_ev,rel_kcal';
    const rows = (Array.isArray(r?.profile) ? r.profile : []).map((x) => [x.s, x.energy_ev, x.rel_kcal].join(','));
    const b = barriers(r);
    const sum = [['ts_energy_ev', r?.ts_energy_ev], ['imag_cm1', r?.imag_cm1], ['n_imag_significant', r?.n_imag_significant], ['barrier_left_kcal', b.left], ['barrier_right_kcal', b.right], ['reaction_energy_kcal', b.reaction]]
      .map(([k, v]) => `${k},${v ?? ''}`);
    return [head, ...rows, '', 'quantity,value', ...sum].join('\n') + '\n';
  }

  // 示例：HCN ⇌ HNC 异构化（氢从碳绕到氮），过渡态的猜测结构和两个异构体（原子顺序一致：H、C、N）
  const SAMPLES = {
    ts: '3\nHCN <-> HNC TS guess (H bridging C and N)\nH 0.600 1.000 0.000\nC 0.000 0.000 0.000\nN 1.170 0.000 0.000\n',
    reactant: '3\nHCN\nH -1.000 0.300 0.000\nC 0.000 0.000 0.000\nN 1.160 0.000 0.000\n',
    product: '3\nHNC\nH 2.100 0.300 0.000\nC 0.000 0.000 0.000\nN 1.170 0.000 0.000\n'
  };

  const api = { MAX_ATOMS, COST, FMAX, IRC_STEPS, IMAGES, KCAL, SAMPLES, readXyz, checkAtoms, checkPair, params, profile, band, barriers, verdict, modeFrames, csv };
  root.MolAstriaTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
