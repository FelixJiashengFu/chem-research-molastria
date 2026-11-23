/* 量子化学模型接口“⑦ 合金表面吸附结构（DBCata）”窗口的纯逻辑（MolAstriaDbcataCore）：能选的金属、比例、晶面和
   吸附物（DBCata 的训练范围，和站长电脑上的 tools/uma-server/dbcata_core.py、账号服务 deploy/account-worker.js 是同一套，
   tools/dbcata-test.mjs 核对三处一致）、请求体和花费、把结果整理成表格、多帧结构和 CSV。不碰 DOM，也不发请求。
   DBCata（Huo & Cao, Nat. Commun. 2026，github.com/Songze1019/DBCata，GPL-3.0）只在站长电脑上作为独立程序运行，
   这里没有它的任何代码；文字自带中英两版。 */
(function (root) {
  'use strict';

  const METAL_GROUPS = [
    ['3d', ['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn']],
    ['4d', ['Y', 'Zr', 'Nb', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd']],
    ['5d', ['Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au']],
    ['p', ['Al', 'Ga', 'In', 'Tl']],
  ];
  const METALS = METAL_GROUPS.flatMap(([, m]) => m);
  const RATIOS = [0.75, 0.5, 0.25]; // metal_a 的原子分数：A3B、AB、AB3
  const FACETS = ['111', '110'];
  const ADSORBATES = ['H', 'C', 'CH', 'CH2', 'CH3', 'N', 'NH', 'O', 'OH', 'H2O', 'S', 'SH'];
  const STEPS = [20, 50, 100];
  const LATTICES = ['uma', 'vegard'];
  const COST = { lean: 3, polish: 5 };
  const OC20_REFS = { H: -3.477, C: -7.282, N: -8.083, O: -7.204 };
  const DOI = '10.1038/s41467-026-79243-9';
  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
  const sub = (s) => String(s).replace(/\d/g, (d) => SUB[d]);

  const T = (zh, en) => ({ zh, en });
  const KINDS = {
    top: T('顶位', 'top'), bridge: T('桥位', 'bridge'), 'long-bridge': T('长桥位', 'long bridge'),
    'hollow-fcc': T('fcc 空位', 'fcc hollow'), 'hollow-hcp': T('hcp 空位', 'hcp hollow'), hollow: T('三重空位', 'threefold hollow'),
    'hollow-4': T('四重空位', 'fourfold hollow'),
  };
  const FLAGS = {
    collision: T('原子相撞：两个原子比共价半径之和的 0.8 倍还近', 'collision: two atoms closer than 0.8 × the sum of their covalent radii'),
    dissociated: T('吸附物解离：吸附物分成了几块', 'dissociated: the adsorbate broke apart'),
    desorbed: T('脱附：吸附物和表面没有任何接触', 'desorbed: the adsorbate no longer touches the surface'),
    reconstructed: T('表面重构：表面原子之间的成键变了', 'reconstructed: bonds between surface atoms changed'),
  };
  const FLAG_SHORT = { collision: T('相撞', 'collision'), dissociated: T('解离', 'dissociated'), desorbed: T('脱附', 'desorbed'), reconstructed: T('重构', 'reconstructed') };

  /** Pt3Ni / PtNi / PtNi3 with metal_a first; sub=true writes Pt₃Ni. */
  function formula(a, b, x, subscript = false) {
    const f = { 0.75: `${a}3${b}`, 0.5: `${a}${b}`, 0.25: `${a}${b}3` }[x] || `${a}${b}`;
    return subscript ? sub(f) : f;
  }
  const structure = (x) => (x === 0.5 ? 'L1₀' : 'L1₂');

  function metal(v) {
    const s = typeof v === 'string' ? v.trim() : '';
    return s.slice(0, 1).toUpperCase() + s.slice(1).toLowerCase();
  }
  /** The form's choices -> { params } in the computer's canonical form (metals in alphabetical order, ratio the
      fraction of metal_a), or { error: {zh, en} } when anything is outside DBCata's training domain. */
  function check(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    let a = metal(r.metal_a), b = metal(r.metal_b);
    if (!METALS.includes(a) || !METALS.includes(b)) return { error: T('两种金属都要从列表里选：DBCata 只学过 3d、4d、5d 过渡金属和 Al、Ga、In、Tl 组成的 fcc 二元合金。', 'Pick both metals from the list: DBCata was trained only on fcc binary alloys of the 3d, 4d and 5d transition metals and Al, Ga, In, Tl.') };
    if (a === b) return { error: T('两种金属要不同：DBCata 学的是二元合金（A₃B、AB、AB₃），不是纯金属。', 'Pick two different metals: DBCata was trained on binary alloys (A₃B, AB, AB₃), not on pure metals.') };
    let x = Number(r.ratio);
    if (!RATIOS.includes(x)) return { error: T('比例只能是 A₃B、AB 或 AB₃。', 'The composition must be A₃B, AB or AB₃.') };
    const facet = String(r.facet ?? '').replace(/[()]/g, '').trim();
    if (!FACETS.includes(facet)) return { error: T('晶面只能是 (111) 或 (110)。', 'The facet must be (111) or (110).') };
    const ads = ADSORBATES.find((n) => typeof r.adsorbate === 'string' && n.toLowerCase() === r.adsorbate.trim().toLowerCase());
    if (!ads) return { error: T('吸附物只能从 12 种里选。', 'Pick one of the 12 adsorbates.') };
    const polish = r.polish !== false;
    const steps = STEPS.includes(Number(r.steps)) ? Number(r.steps) : 20;
    const lattice = LATTICES.includes(r.lattice) ? r.lattice : 'uma';
    if (a > b) [a, b, x] = [b, a, 1 - x];
    return { params: { metal_a: a, metal_b: b, ratio: x, facet, adsorbate: ads, polish, steps, lattice } };
  }
  const cost = (p) => (p && p.polish === false ? COST.lean : COST.polish);
  /** What the page sends to /uma/jobs: only what differs from the computer's defaults besides the five choices. */
  function body(p) {
    const params = { metal_a: p.metal_a, metal_b: p.metal_b, ratio: p.ratio, facet: p.facet, adsorbate: p.adsorbate };
    if (p.polish === false) params.polish = false;
    if (p.steps && p.steps !== 20) params.steps = p.steps;
    if (p.lattice && p.lattice !== 'uma') params.lattice = p.lattice;
    return { model: 'dbcata', job: 'adsgen', params };
  }
  const refsAvailable = (ads) => /^[CHNO0-9]+$/.test(ads) && !ads.includes('S');
  /** The energy each site is ranked by: E_ads with OC20's references, or E(adslab) - E(slab) for S and SH. */
  const energyOf = (site, result) => (result?.reference?.available ? site.e_ads_ev : site.e_bind_raw_ev);

  /** The sites as table rows, lowest energy first among the sites without problems, the flagged ones after. */
  function rows(result) {
    const slabs = result?.slabs || [];
    const out = (result?.sites || []).map((s) => {
      const flags = [...new Set([...(s.flags || []), ...(s.flags_polished || [])])];
      return {
        id: s.id, best: s.id === result.best, kind: s.kind, atoms: s.atoms, multiplicity: s.multiplicity,
        termination: s.termination, top: slabs[s.termination]?.top || '', energy: energyOf(s, result), rel: s.rel_ev,
        dmae: s.dmae_init_gen, dmaeFinal: s.dmae_gen_final ?? null, confidence: s.confidence ?? null, flags, ok: !!s.ok,
        steps: s.steps ?? null, converged: s.converged ?? null,
      };
    });
    const e = (r) => (Number.isFinite(r.energy) ? r.energy : Infinity);
    out.sort((p, q) => (q.ok - p.ok) || (e(p) - e(q)) || (p.id - q.id));
    return out;
  }
  /** The multi-frame extended XYZ of one site -> [{ label, text }]; labels from frame="…" on each comment line. */
  function frames(xyz) {
    const lines = String(xyz || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    for (let i = 0; i < lines.length;) {
      const n = Number(lines[i].trim());
      if (!Number.isInteger(n) || n < 1) { i++; continue; }
      const block = lines.slice(i, i + 2 + n);
      if (block.length < 2 + n) break;
      const label = (block[1].match(/frame="([^"]*)"/) || [])[1] || `frame ${out.length + 1}`;
      out.push({ label, text: block.join('\n') + '\n' });
      i += 2 + n;
    }
    return out;
  }
  const FRAME_NAMES = { initial: T('初始结构（吸附物放在位点上方 1.5 Å）', 'initial (adsorbate 1.5 Å above the site)'), DBCata: T('DBCata 生成', 'DBCata generated'), 'DBCata+UMA': T('DBCata + UMA 短程优化', 'DBCata + short UMA relaxation') };
  const num = (v, d) => (Number.isFinite(v) ? Number(v).toFixed(d) : '');
  /** One CSV line per site, with the system in the first columns. */
  function csv(result) {
    const sys = result?.system || {};
    const head = ['formula', 'facet', 'adsorbate', 'site_id', 'termination_top', 'kind', 'atoms', 'multiplicity', 'energy_ev', 'energy_kind', 'rel_ev', 'dmae_init_gen_a', 'dmae_gen_final_a', 'confidence', 'flags', 'ok'];
    const kind = result?.reference?.available ? 'E_ads (OC20 refs)' : 'E(adslab)-E(slab)';
    const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const body = rows(result).map((r) => [sys.formula, sys.facet, sys.adsorbate, r.id, r.top, r.kind, r.atoms, r.multiplicity, num(r.energy, 4), kind, num(r.rel, 4),
      num(r.dmae, 4), num(r.dmaeFinal, 4), num(r.confidence, 3), r.flags.join(' '), r.ok ? 1 : 0].map(q).join(','));
    return [head.join(','), ...body].join('\n') + '\n';
  }
  /** The text to cite, in the page's language. */
  function citation(en) {
    return en
      ? `S. Huo, X.-M. Cao, Accelerating high-throughput catalyst screening by direct generation of equilibrium adsorption structures, Nat. Commun. (2026), doi:${DOI}`
      : `Huo S., Cao X.-M. Accelerating high-throughput catalyst screening by direct generation of equilibrium adsorption structures. Nat. Commun. 2026. doi:${DOI}`;
  }

  root.MolAstriaDbcataCore = {
    METAL_GROUPS, METALS, RATIOS, FACETS, ADSORBATES, STEPS, LATTICES, COST, OC20_REFS, DOI, KINDS, FLAGS, FLAG_SHORT, FRAME_NAMES,
    formula, structure, sub, check, cost, body, refsAvailable, energyOf, rows, frames, csv, citation, num,
  };
})(typeof window !== 'undefined' ? window : globalThis);
