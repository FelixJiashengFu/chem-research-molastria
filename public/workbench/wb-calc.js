/* 计算工作台 · 计算相关的纯函数：反应路径的输入（扫描、过渡态、IRC、NEB / QST2、受限优化；xTB、ORCA、Gaussian）、
   读路径结果（多帧 XYZ 带能量、ORCA 的 NEB / IRC / 弛豫扫描表、Gaussian 的 IRC / 扫描）、能量曲线（相对能量、单位、能垒、样条找最高点）、
   紫外（TDDFT）和拉曼光谱的读法和展宽、轨道能级、优化收敛曲线、作业脚本（Slurm / PBS / bash / Windows）、不压缩的 zip、文献导出。
   没有 DOM。浏览器里是 window.MolAstriaWBCalc，node 里是 module.exports（tools/workbench-test.mjs 测）。
   生成的输入和脚本里的注释一律写英文（和开源代码台一样，<pre> 不翻译）。 */
(function (root) {
  'use strict';

  const HARTREE_KCAL = 627.509474, HARTREE_EV = 27.211386245988, HARTREE_KJ = 2625.4996394799, HARTREE_CM = 219474.6313632;
  const EV_CM = 8065.543937; // 1 eV in cm⁻¹
  const UNITS = { kcal: HARTREE_KCAL, kj: HARTREE_KJ, ev: HARTREE_EV, eh: 1, cm: HARTREE_CM };
  const fromEh = (e, unit) => e * (UNITS[unit] ?? HARTREE_KCAL);
  const all = (re, t) => [...String(t).matchAll(re)];
  const last = (a) => (a.length ? a[a.length - 1] : null);
  const nums = (s) => (String(s).match(/-?\d+\.\d+(?:[eEdD][-+]?\d+)?/g) || []).map((x) => Number(x.replace(/[dD]/, 'e')));
  const f6 = (v) => (v < 0 ? '' : ' ') + v.toFixed(6);
  const coord = (atoms) => atoms.map((a) => `${a.el.padEnd(2)} ${f6(a.x)} ${f6(a.y)} ${f6(a.z)}`).join('\n');

  // ── 反应路径的输入 ────────────────────────────────────────────────────
  /** 25 种 ALPB 溶剂（xTB 的名字）和 298 K 的参考介电常数，给页面列出来。 */
  const ALPB = [['water', 78.36], ['acetonitrile', 35.69], ['methanol', 32.61], ['ethanol', 24.85], ['acetone', 20.49], ['dmso', 46.83], ['dmf', 37.22],
    ['thf', 7.43], ['dichloromethane', 8.93], ['chloroform', 4.71], ['toluene', 2.37], ['benzene', 2.27], ['hexane', 1.88], ['diethylether', 4.24],
    ['ethylacetate', 5.99], ['nitromethane', 36.56], ['dioxane', 2.21], ['octanol', 9.86], ['woctanol', 9.86], ['furane', 2.94], ['phenol', 12.40],
    ['aniline', 6.89], ['benzaldehyde', 18.22], ['cs2', 2.61], ['hexadecane', 2.04]];
  const ORCA_SOLV = { water: 'Water', acetonitrile: 'Acetonitrile', methanol: 'Methanol', ethanol: 'Ethanol', acetone: 'Acetone', dmso: 'DMSO', dmf: 'DMF', thf: 'THF', dichloromethane: 'CH2Cl2', chloroform: 'Chloroform', toluene: 'Toluene', benzene: 'Benzene', hexane: 'Hexane' };
  const G_SOLV = { water: 'Water', acetonitrile: 'Acetonitrile', methanol: 'Methanol', ethanol: 'Ethanol', acetone: 'Acetone', dmso: 'DiMethylSulfoxide', dmf: 'N,N-DiMethylFormamide', thf: 'TetraHydroFuran', dichloromethane: 'Dichloromethane', chloroform: 'Chloroform', toluene: 'Toluene', benzene: 'Benzene', hexane: 'n-Hexane' };
  const TYPE_N = { bond: 2, angle: 3, dihedral: 4 };
  const PATH_TASKS = ['constrain', 'scan', 'ts', 'irc', 'neb'];

  /** 内坐标的现值（从 0 开始的原子编号）。 */
  function coordValue(atoms, c) {
    const P = (i) => [atoms[i].x, atoms[i].y, atoms[i].z];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const nrm = (a) => Math.hypot(...a), cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const [i, j, k, l] = c.atoms.map((n) => n - 1);
    if (c.type === 'bond') return nrm(sub(P(i), P(j)));
    if (c.type === 'angle') { const a = sub(P(i), P(j)), b = sub(P(k), P(j)); return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (nrm(a) * nrm(b))))) * 180 / Math.PI; }
    const b0 = sub(P(i), P(j)), b1 = sub(P(k), P(j)), b2 = sub(P(l), P(k));
    const u = b1.map((x) => x / nrm(b1)), v = sub(b0, u.map((x) => x * dot(b0, u))), w = sub(b2, u.map((x) => x * dot(b2, u)));
    return Math.atan2(dot(cr(u, v), w), dot(v, w)) * 180 / Math.PI;
  }
  /** 检查一组内坐标定义：原子个数对得上、编号在范围内、不重复。返回出错的代号列表。 */
  function checkCoords(atoms, coords) {
    const bad = [];
    coords.forEach((c, n) => {
      const need = TYPE_N[c.type];
      if (!need || c.atoms.length !== need) bad.push(`${n + 1}:count`);
      else if (c.atoms.some((a) => !Number.isInteger(a) || a < 1 || a > atoms.length)) bad.push(`${n + 1}:range`);
      else if (new Set(c.atoms).size !== c.atoms.length) bad.push(`${n + 1}:repeat`);
    });
    return bad;
  }
  const ranges = (idx) => { // [1,2,3,5] → '1-3,5'（xTB 的写法）
    const s = [...new Set(idx)].sort((a, b) => a - b), out = [];
    for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`); i = j; }
    return out.join(',');
  };

  /**
   * 反应路径的输入。program ∈ xtb | orca | gaussian；task ∈ constrain（受限优化）| scan | ts | irc | neb。
   * o: { charge, mult, method（ORCA / Gaussian 的方法，如 'B3LYP' 或 'XTB2'）, basis, solvent（ALPB 名字）, cores, mem（GB）, name,
   *      constraints: [{ type, atoms(从 1 开始), value? }], scan: { type, atoms, from, to, steps }, frozen: [从 1 开始],
   *      product: [atom]（NEB / QST2 / xTB path 的终点）, images, guess: 多帧 XYZ 文本（NEB 的初始路径）, ircPoints }。
   * 返回 { supported, files: [{ name, text }], run, notes: [代号或英文句子] }。
   */
  function pathInput(program, task, atoms, o = {}) {
    const name = String(o.name || 'mol').replace(/[^\w.-]+/g, '_') || 'mol';
    const q = Number(o.charge) || 0, m = Number(o.mult) || 1;
    const cons = o.constraints || [], frozen = o.frozen || [], sc = o.scan;
    const notes = [];
    const nope = (why) => ({ supported: false, files: [], run: '', notes: [why] });
    if (task === 'scan' && !sc) return nope('need-scan');
    if ((task === 'neb') && !o.product) return nope('need-product');
    const bad = checkCoords(atoms, [...cons, ...(sc ? [sc] : [])]);
    if (bad.length) return nope(`bad-coords:${bad.join(',')}`);
    const steps = sc ? Math.max(2, Math.min(200, Math.round(sc.steps || 10))) : 0;

    if (program === 'xtb') {
      const solv = o.solvent ? ` --alpb ${o.solvent}` : '';
      const gfn = o.method === 'GFN1-xTB' ? ' --gfn 1' : o.method === 'GFN-FF' ? ' --gfnff' : ' --gfn 2';
      const P = o.cores ? ` -P ${o.cores}` : '';
      if (task === 'ts' || task === 'irc') return nope('xtb-no-ts');
      if (task === 'neb') {
        const inp = ['$path', `   nrun=1`, `   npoint=${Math.max(5, Math.min(50, (o.images || 8) + 2))}`, '   anopt=10', '   kpush=0.003', '   kpull=-0.015', '   ppull=0.05', '   alp=1.2', '$end'];
        if (frozen.length) inp.unshift('$fix', `   atoms: ${ranges(frozen)}`, '$end');
        notes.push('xtb-path');
        return { supported: true, files: [{ name: `${name}.xyz`, text: xyzText(atoms, 'reactant') }, { name: `${name}_product.xyz`, text: xyzText(o.product, 'product') }, { name: 'path.inp', text: inp.join('\n') + '\n' }],
          run: `xtb ${name}.xyz --path ${name}_product.xyz --input path.inp${gfn}${solv} --chrg ${q} --uhf ${m - 1}${P} > ${name}_path.out`, notes };
      }
      const L = [];
      if (cons.length || sc) {
        L.push('$constrain', '   force constant=1.0');
        const all2 = sc ? [sc, ...cons] : cons; // 扫描的那一个排第一，$scan 里用 1: 指它
        for (const c of all2) {
          const v = c === sc ? `${c.from}` : (Number.isFinite(c.value) ? `${c.value}` : 'auto');
          L.push(`   ${c.type === 'bond' ? 'distance' : c.type}: ${c.atoms.join(', ')}, ${v}`);
        }
        L.push('$end');
      }
      if (sc) L.push('$scan', '   mode=sequential', `   1: ${sc.from}, ${sc.to}, ${steps + 1}`, '$end'); // xtb 的第三个数是点数（含两端，constrain_param.f90），和 ORCA、Gaussian 一样是 steps + 1 个点
      if (frozen.length) L.push('$fix', `   atoms: ${ranges(frozen)}`, '$end');
      if (!L.length) return nope('nothing-to-constrain');
      if (sc) notes.push('xtb-scan-log');
      return { supported: true, files: [{ name: `${name}.xyz`, text: xyzText(atoms, name) }, { name: `${name}.inp`, text: L.join('\n') + '\n' }],
        run: `xtb ${name}.xyz --opt --input ${name}.inp${gfn}${solv} --chrg ${q} --uhf ${m - 1}${P} > ${name}.out`, notes };
    }

    if (program === 'orca') {
      const xtbMethod = /^xtb/i.test(o.method || '');
      const level = xtbMethod ? 'XTB2' : `${o.method || 'B3LYP'} ${o.basis || 'def2-SVP'}${o.d3 !== false && !/^(HF|MP2)/i.test(o.method || 'B3LYP') ? ' D3BJ' : ''}`;
      const solv = o.solvent ? (xtbMethod ? ` ALPB(${o.solvent})` : ORCA_SOLV[o.solvent] ? ` CPCM(${ORCA_SOLV[o.solvent]})` : '') : '';
      if (o.solvent && !xtbMethod && !ORCA_SOLV[o.solvent]) notes.push('solvent-skipped');
      const kw = { constrain: 'Opt', scan: 'Opt', ts: 'OptTS Freq', irc: 'IRC', neb: 'NEB-TS Freq' }[task];
      const L = [`! ${level} ${kw}${solv}`.replace(/\s+/g, ' ')];
      if (o.cores > 1) L.push(`%pal nprocs ${o.cores} end`);
      if (o.mem) L.push(`%maxcore ${Math.max(500, Math.round((o.mem * 1000 * 0.75) / Math.max(1, o.cores || 1)))}`);
      const geom = [];
      const zero = (c) => c.atoms.map((a) => a - 1).join(' ');
      const tag = (t) => ({ bond: 'B', angle: 'A', dihedral: 'D' }[t]);
      if (cons.length || frozen.length) {
        geom.push('  Constraints');
        for (const c of cons) geom.push(`    { ${tag(c.type)} ${zero(c)}${Number.isFinite(c.value) ? ` ${c.value}` : ''} C }`);
        for (const a of frozen) geom.push(`    { C ${a - 1} C }`);
        geom.push('  end');
      }
      if (task === 'scan') geom.push('  Scan', `    ${tag(sc.type)} ${zero(sc)} = ${sc.from}, ${sc.to}, ${steps + 1}`, '  end');
      if (task === 'ts') geom.push('  Calc_Hess true', '  Recalc_Hess 5');
      if (geom.length) L.push('%geom', ...geom, 'end');
      if (task === 'irc') { L.push('%irc', '  MaxIter 100', '  Direction both', '  InitHess calc_anfreq', 'end'); notes.push('irc-from-ts'); }
      if (task === 'neb') {
        L.push('%neb', `  NEB_End_XYZFile "${name}_product.xyz"`, `  Nimages ${Math.max(3, Math.min(30, o.images || 8))}`, '  PreOpt_Ends true');
        if (o.guess) L.push(`  Restart_ALLXYZFile "${name}_guess.allxyz"`);
        L.push('end');
        notes.push('neb-same-order');
      }
      L.push('', `* xyz ${q} ${m}`, coord(atoms), '*', '');
      const files = [{ name: `${name}.inp`, text: L.join('\n') }];
      if (task === 'neb') files.push({ name: `${name}_product.xyz`, text: xyzText(o.product, 'product') });
      if (task === 'neb' && o.guess) files.push({ name: `${name}_guess.allxyz`, text: allxyz(o.guess) });
      if (task === 'scan') notes.push('orca-relaxscan');
      return { supported: true, files, run: `$(which orca) ${name}.inp > ${name}.out`, notes };
    }

    if (program === 'gaussian') {
      const lvl = `${o.method || 'B3LYP'}/${o.basis ? gBasis(o.basis) : 'Def2SVP'}${o.d3 !== false && !/^(HF|MP2)/i.test(o.method || 'B3LYP') ? ' EmpiricalDispersion=GD3BJ' : ''}`;
      const solv = o.solvent ? (G_SOLV[o.solvent] ? ` SCRF=(SMD,Solvent=${G_SOLV[o.solvent]})` : '') : '';
      if (o.solvent && !G_SOLV[o.solvent]) notes.push('solvent-skipped');
      const route = {
        constrain: `# opt=modredundant ${lvl}${solv}`,
        scan: `# opt=modredundant ${lvl}${solv}`,
        ts: `# opt=(ts,calcfc,noeigentest) freq ${lvl}${solv}`,
        irc: `# irc=(calcfc,maxpoints=${Math.max(5, Math.min(200, o.ircPoints || 30))},stepsize=10) ${lvl}${solv}`,
        neb: `# opt=(qst2) freq ${lvl}${solv}`,
      }[task];
      const head = [`%chk=${name}.chk`, `%nprocshared=${o.cores || 8}`, `%mem=${o.mem || 8}GB`, route, ''];
      const frz = new Set(frozen);
      const body = (as) => as.map((a, i) => `${a.el.padEnd(2)}${frz.size ? (frz.has(i + 1) ? ' -1' : '  0') : ''} ${f6(a.x)} ${f6(a.y)} ${f6(a.z)}`).join('\n');
      const L = [...head];
      if (task === 'neb') {
        L.push('reactant', '', `${q} ${m}`, body(atoms), '', 'product', '', `${q} ${m}`, body(o.product), '');
        notes.push('qst2');
      } else {
        L.push(`${name} ${task}`, '', `${q} ${m}`, body(atoms), '');
        const red = [];
        const letter = (t) => ({ bond: 'B', angle: 'A', dihedral: 'D' }[t]);
        for (const c of cons) red.push(`${letter(c.type)} ${c.atoms.join(' ')} F`);
        if (task === 'scan') {
          const now = coordValue(atoms, sc);
          const step = (sc.to - sc.from) / steps;
          red.push(`${letter(sc.type)} ${sc.atoms.join(' ')} S ${steps} ${step.toFixed(6)}`);
          if (Math.abs(now - sc.from) > (sc.type === 'bond' ? 0.005 : 0.5)) notes.push(`gaussian-scan-starts-at-current:${now.toFixed(3)}`);
        }
        if (red.length) L.push(...red, '');
      }
      L.push('');
      return { supported: true, files: [{ name: `${name}.gjf`, text: L.join('\n') }], run: `g16 < ${name}.gjf > ${name}.log`, notes };
    }
    return nope('program');
  }
  const gBasis = (b) => ({ 'def2-svp': 'Def2SVP', 'def2-tzvp': 'Def2TZVP', '6-31g*': '6-31G(d)', 'sto-3g': 'STO-3G', 'cc-pvdz': 'cc-pVDZ', 'cc-pvtz': 'cc-pVTZ' }[String(b).toLowerCase()] || b);
  const xyzText = (atoms, title) => `${atoms.length}\n${title}\n${coord(atoms)}\n`;
  /** ORCA 的 .allxyz：多帧之间用一行 “>” 隔开。 */
  const allxyz = (multi) => String(multi).trim().split(/\n(?=\s*\d+\s*\n)/).join('\n>\n') + '\n';

  // ── 读路径结果 ───────────────────────────────────────────────────────
  /**
   * 读一段路径结果。返回 { kind, label, energies（Eh，绝对值或相对值见 relative）, x（反应坐标，可能为 null）, xLabel,
   * frames（[[atom]]，可能为空）, ts（最高点或程序标的过渡态下标）, relative } 或 null。
   * 认：多帧 XYZ（每帧注释里有能量：xtbscan.log、ORCA 的 *_MEP_trj.xyz / *_IRC_Full_trj.xyz、CREST 等）、ORCA 输出里的 NEB “PATH SUMMARY”、
   * IRC “IRC PATH SUMMARY”、弛豫扫描 “The Calculated Surface using the 'Actual Energy'”、Gaussian 的 IRC 和扫描输出。
   */
  function readPath(text, parseXyz) {
    const t = String(text || '').replace(/\r/g, '');
    // ORCA NEB
    const neb = last(all(/PATH SUMMARY[^\n]*\n[-\s]*\n?\s*Image\s+Dist\.\(Ang\.\)\s+E\(Eh\)[^\n]*\n([\s\S]*?)(?:\n\s*\n|\n\s*Straight|$)/g, t));
    if (neb) {
      const rows = all(/^\s*(\d+)\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)[^\n]*$/gm, neb[1]);
      if (rows.length > 1) {
        const ts = rows.findIndex((r) => /CI|TS/.test(r[0]));
        return { kind: 'orca-neb', label: 'ORCA NEB', energies: rows.map((r) => Number(r[3])), x: rows.map((r) => Number(r[2])), xLabel: 'path length / Å', frames: [], ts: ts >= 0 ? ts : null, relative: false };
      }
    }
    // ORCA IRC
    const irc = last(all(/IRC PATH SUMMARY[\s\S]*?Step\s+E\(Eh\)[^\n]*\n([\s\S]*?)(?:\n\s*\n|$)/g, t));
    if (irc) {
      const rows = all(/^\s*(\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)[^\n]*$/gm, irc[1]);
      if (rows.length > 1) {
        const ts = rows.findIndex((r) => /<=\s*TS/.test(r[0]));
        return { kind: 'orca-irc', label: 'ORCA IRC', energies: rows.map((r) => Number(r[2])), x: null, xLabel: 'IRC step', frames: [], ts: ts >= 0 ? ts : null, relative: false };
      }
    }
    // ORCA 弛豫扫描
    const rs = last(all(/The Calculated Surface using the 'Actual Energy'\s*\n([\s\S]*?)(?:\n\s*\n|$)/g, t));
    if (rs) {
      const rows = all(/^\s*(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/gm, rs[1]);
      if (rows.length > 1) return { kind: 'orca-scan', label: 'ORCA relaxed scan', energies: rows.map((r) => Number(r[2])), x: rows.map((r) => Number(r[1])), xLabel: 'scan coordinate', frames: [], ts: null, relative: false };
    }
    // Gaussian IRC
    const gi = /Summary of reaction path following\s*\n[-\s]*\n\s*Energy\s+RxCoord\s*\n([\s\S]*?)\n\s*-{10,}/.exec(t);
    if (gi) {
      const rows = all(/^\s*(\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/gm, gi[1]);
      const off = /Energies reported relative to the TS energy of\s+(-?\d+\.\d+)/.exec(t);
      if (rows.length > 1) {
        const pts = rows.map((r) => ({ e: Number(r[2]), x: Number(r[3]) })).sort((a, b) => a.x - b.x);
        const base = off ? Number(off[1]) : 0;
        const ts = pts.findIndex((p) => Math.abs(p.x) < 1e-6);
        return { kind: 'gaussian-irc', label: 'Gaussian IRC', energies: pts.map((p) => p.e + base), x: pts.map((p) => p.x), xLabel: 'reaction coordinate / amu^½ bohr', frames: [], ts: ts >= 0 ? ts : null, relative: !off };
      }
    }
    // Gaussian 扫描：每个 “-- Stationary point found” 之前的最后一个能量和结构
    if (/Stationary point found/.test(t) && /modredundant/i.test(t)) {
      const parts = t.split(/-- Stationary point found\.?/);
      const energies = [], frames = [];
      for (let i = 0; i < parts.length - 1; i++) {
        const e = last(all(/SCF Done:\s+E\(\S+\)\s+=\s+(-?\d+\.\d+)/g, parts[i]));
        if (e) energies.push(Number(e[1]));
        const g = gaussianGeoms(parts[i]);
        if (g.length) frames.push(g[g.length - 1]);
      }
      if (energies.length > 1) return { kind: 'gaussian-scan', label: 'Gaussian relaxed scan', energies, x: null, xLabel: 'scan point', frames: frames.length === energies.length ? frames : [], ts: null, relative: false };
    }
    // 多帧 XYZ
    if (parseXyz && /^\s*\d+\s*\n/.test(t)) {
      let r;
      try { r = parseXyz(t); } catch { r = null; }
      if (r && r.frames.length > 1) {
        const E = r.frames.map((f) => f.energy);
        if (E.every(Number.isFinite)) {
          const unit = r.energyUnit || 'eh';
          const eh = E.map((e) => (unit === 'kcal' ? e / HARTREE_KCAL : unit === 'kj' ? e / HARTREE_KJ : unit === 'ev' ? e / HARTREE_EV : e));
          return { kind: 'xyz', label: 'multi-frame XYZ', energies: eh, x: null, xLabel: 'frame', frames: r.frames.map((f) => f.atoms), ts: null, relative: false, unit };
        }
        return { kind: 'xyz-noenergy', label: 'multi-frame XYZ', energies: [], x: null, xLabel: 'frame', frames: r.frames.map((f) => f.atoms), ts: null, relative: false };
      }
    }
    return null;
  }
  const SYM = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe').split(' ');
  function gaussianGeoms(t) {
    const heads = all(/Standard orientation:/g, t).length ? all(/Standard orientation:/g, t) : all(/Input orientation:/g, t);
    const out = [];
    for (const h of heads) {
      const lines = t.slice(h.index).split('\n').slice(5);
      const atoms = [];
      for (const l of lines) {
        const m = /^\s*\d+\s+(\d+)\s+-?\d+\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/.exec(l);
        if (!m) break;
        atoms.push({ el: SYM[Number(m[1]) - 1] || 'X', x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) });
      }
      if (atoms.length) out.push(atoms);
    }
    return out;
  }
  /** 相邻两帧之间的 RMS 位移累加（Å），给没有反应坐标的路径当横轴用。 */
  function pathLength(frames) {
    const x = [0];
    for (let k = 1; k < frames.length; k++) {
      const A = frames[k - 1], B = frames[k];
      if (A.length !== B.length) return null;
      let s = 0;
      for (let i = 0; i < A.length; i++) s += (A[i].x - B[i].x) ** 2 + (A[i].y - B[i].y) ** 2 + (A[i].z - B[i].z) ** 2;
      x.push(x[k - 1] + Math.sqrt(s));
    }
    return x;
  }
  /** 自然三次样条：返回 f(x)。x 要严格递增。 */
  function spline(xs, ys) {
    const n = xs.length;
    if (n < 3) return (x) => ys[0] + ((ys[n - 1] - ys[0]) * (x - xs[0])) / ((xs[n - 1] - xs[0]) || 1);
    const h = [], al = [0], l = [1], mu = [0], z = [0], c = new Array(n).fill(0), b = [], d = [];
    for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);
    for (let i = 1; i < n - 1; i++) al.push((3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]));
    for (let i = 1; i < n - 1; i++) { l.push(2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]); mu.push(h[i] / l[i]); z.push((al[i] - h[i - 1] * z[i - 1]) / l[i]); }
    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1]; // c[n−1] = 0 和 z[0] = mu[0] = 0 给出自然边界
      b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
      d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }
    return (x) => {
      let j = 0;
      while (j < n - 2 && x > xs[j + 1]) j++;
      const dx = x - xs[j];
      return ys[j] + b[j] * dx + c[j] * dx * dx + d[j] * dx ** 3;
    };
  }
  /**
   * 能量曲线：energies（Eh）→ 相对能量（unit），零点 zero ∈ 'first' | 'min' | 'last' | 数字下标；
   * 能垒（最高点 − 第一点）、反应能（最后 − 第一）、最高点（离散）和样条插出来的最高点（x 和能量）。
   */
  function profile(path, opts = {}) {
    const unit = opts.unit || 'kcal';
    const E = path.energies;
    if (!E || E.length < 2) return null;
    const x = path.x && path.x.length === E.length ? path.x.slice() : (path.frames && path.frames.length === E.length ? pathLength(path.frames) : null) || E.map((_, i) => i);
    let z = 0;
    if (opts.zero === 'min') z = E.indexOf(Math.min(...E));
    else if (opts.zero === 'last') z = E.length - 1;
    else if (Number.isInteger(opts.zero)) z = Math.max(0, Math.min(E.length - 1, opts.zero));
    const rel = E.map((e) => fromEh(e - E[z], unit));
    let top = 0;
    for (let i = 1; i < rel.length; i++) if (rel[i] > rel[top]) top = i;
    const relFirst = E.map((e) => fromEh(e - E[0], unit));
    let smooth = null;
    const inc = x.every((v, i) => i === 0 || v > x[i - 1]);
    if (inc && top > 0 && top < E.length - 1) {
      const f = spline(x, rel);
      let bx = x[top], by = rel[top];
      const lo = x[top - 1], hi = x[top + 1];
      for (let k = 0; k <= 400; k++) { const xx = lo + ((hi - lo) * k) / 400, yy = f(xx); if (yy > by) { by = yy; bx = xx; } }
      smooth = { x: bx, e: by };
    }
    return { x, rel, unit, zero: z, top, barrier: relFirst[top], reverse: relFirst[top] - relFirst[relFirst.length - 1], reaction: relFirst[relFirst.length - 1], smooth };
  }

  // ── 光谱 ────────────────────────────────────────────────────────────
  /** 紫外：读 Gaussian TD（“Excited State n: … eV … nm f=…”）和 ORCA（电偶极跃迁吸收谱表，ORCA 5 和 6 两种排法）。
      返回 [{ ev, nm, f, mult }]；mult 是激发态的自旋多重度（不知道时为 null），自旋禁阻的三重态 f = 0、照样列出来。 */
  function uvOf(text) {
    const t = String(text || '').replace(/\r/g, '');
    const g = all(/Excited State\s+\d+:\s+(\S+)\s+(-?\d+\.\d+)\s+eV\s+(-?\d+\.\d+)\s+nm\s+f=(-?\d+\.\d+)/g, t);
    const multOf = (sym) => (/^Singlet/i.test(sym) ? 1 : /^Triplet/i.test(sym) ? 3 : /^Doublet/i.test(sym) ? 2 : /^Quartet/i.test(sym) ? 4 : null);
    if (g.length) return g.map((m) => ({ ev: Number(m[2]), nm: Number(m[3]), f: Number(m[4]), mult: multOf(m[1]) }));
    const b = last(all(/ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC DIPOLE MOMENTS[^\n]*\n([\s\S]*?)(?:\n\s*\n\s*\n|\n\s*-{20,}\s*\n\s*[A-Z]{4,})/g, t));
    if (!b) return [];
    const out = [];
    for (const line of b[1].split('\n')) {
      // 自旋禁阻的态（ORCA 的 TD-DFT 同时算三重态时）：f = 0，留着能量和多重度
      let m = /^\s*\d+-\S+\s*->\s*\d+-\S+\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+spin forbidden \(mult=(\d)\)/.exec(line); // ORCA 6：eV cm⁻¹ nm
      if (m) { out.push({ ev: Number(m[1]), nm: Number(m[3]), f: 0, mult: Number(m[4]) }); continue; }
      m = /^\s*\d+\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+spin forbidden \(mult=(\d)\)/.exec(line); // ORCA 5：cm⁻¹ nm
      if (m) { out.push({ ev: Number(m[1]) / EV_CM, nm: Number(m[2]), f: 0, mult: Number(m[3]) }); continue; }
      m = /^\s*\d+-\S+\s*->\s*\d+-(\d)\S*\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/.exec(line); // ORCA 6：eV cm⁻¹ nm fosc（末态写成 1-1A，中间那个数是多重度）
      if (m) { out.push({ ev: Number(m[2]), nm: Number(m[4]), f: Number(m[5]), mult: Number(m[1]) }); continue; }
      m = /^\s*\d+\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/.exec(line); // ORCA 5：cm⁻¹ nm fosc
      if (m) out.push({ ev: Number(m[1]) / EV_CM, nm: Number(m[2]), f: Number(m[3]), mult: null });
    }
    return out;
  }
  /** 拉曼活性：Gaussian（freq=raman 的 “Raman Activ --”，Å⁴/amu）和 ORCA（“RAMAN SPECTRUM” 表）。返回 [{ freq, act }]。 */
  function ramanOf(text) {
    const t = String(text || '').replace(/\r/g, '');
    const row = (re) => all(re, t).flatMap((m) => nums(m[1]));
    const fs = row(/^\s*Frequencies --(?!-)([^\n]+)/gm), as = row(/^\s*Raman Activ --(?!-)([^\n]+)/gm);
    if (fs.length && fs.length === as.length) return fs.map((f, i) => ({ freq: f, act: as[i] }));
    const b = last(all(/RAMAN SPECTRUM\s*\n-+\n([\s\S]*?)(?:\n\s*\n(?!\s*-)|$)/g, t));
    if (!b) return [];
    return all(/^\s*\d+:\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/gm, b[1]).map((m) => ({ freq: Number(m[1]), act: Number(m[2]) }));
  }
  /**
   * 拉曼活性 S（Å⁴/amu）→ Stokes 散射强度（相对值）。Polavarapu, J. Phys. Chem. 1990, 94, 8106：
   *   I_i ∝ (ν₀ − ν_i)⁴ · S_i / ( ν_i · [1 − exp(−h c ν_i / k T)] )，ν 用 cm⁻¹，ν₀ 是激光波数（默认 532 nm），T 默认 298.15 K。
   * 返回 [{ freq, int }]，最强的那个归一成 1。虚频和 0 频跳过。
   */
  function ramanIntensity(modes, laserNm = 532, T = 298.15) {
    const nu0 = 1e7 / laserNm, c2 = 1.438776877; // c₂ = hc/k（cm·K）
    const raw = modes.filter((m) => m.freq > 1 && m.act > 0 && m.freq < nu0).map((m) => ({ freq: m.freq, int: ((nu0 - m.freq) ** 4 * m.act) / (m.freq * (1 - Math.exp((-c2 * m.freq) / T))) }));
    const mx = Math.max(0, ...raw.map((m) => m.int)) || 1;
    return raw.map((m) => ({ freq: m.freq, int: m.int / mx }));
  }
  /**
   * 把棒状谱展宽成连续谱。sticks: [{ pos, h }]；shape ∈ gauss | lorentz；fwhm 和 pos 同单位；每根棒的面积是 h（线型面积为 1）。
   * 返回 { x, y }。
   */
  function broaden(sticks, { from, to, n = 800, fwhm = 20, shape = 'lorentz' } = {}) {
    const x = new Array(n), y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) x[i] = from + ((to - from) * i) / (n - 1);
    const s = fwhm / Math.sqrt(8 * Math.LN2), g = fwhm / 2;
    for (const st of sticks) for (let i = 0; i < n; i++) {
      const d = x[i] - st.pos;
      y[i] += st.h * (shape === 'gauss' ? Math.exp(-(d * d) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)) : g / (Math.PI * (d * d + g * g)));
    }
    return { x, y };
  }
  /**
   * 紫外吸收谱：每个跃迁在波数轴上展成高斯，面积 = f / 4.319×10⁻⁹（L mol⁻¹ cm⁻²），所以纵轴就是摩尔吸光系数 ε（L mol⁻¹ cm⁻¹）。
   * fwhm 以 eV 给（默认 0.24 eV，约 1936 cm⁻¹）。返回 { nm, ev, eps }（在 nm 区间里等距取点）。
   */
  function uvSpectrum(trans, { fromNm = 180, toNm = 600, n = 600, fwhmEv = 0.24 } = {}) {
    const fw = fwhmEv * EV_CM, s = fw / Math.sqrt(8 * Math.LN2);
    const nm = [], ev = [], eps = [];
    for (let i = 0; i < n; i++) {
      const L = fromNm + ((toNm - fromNm) * i) / (n - 1), k = 1e7 / L;
      let e = 0;
      for (const t of trans) { if (!(t.f > 0)) continue; const k0 = t.ev * EV_CM, d = k - k0; e += (t.f / 4.319e-9) * Math.exp(-(d * d) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); }
      nm.push(L); ev.push(k / EV_CM); eps.push(e);
    }
    return { nm, ev, eps };
  }

  // ── 轨道能级、优化收敛 ───────────────────────────────────────────────
  /** 读轨道能量（Eh）和占据：ORCA “ORBITAL ENERGIES”、Gaussian “occ./virt. eigenvalues”、xTB 的轨道表。返回 { alpha:[{e,occ}], beta?:[] } 或 null。 */
  function orbitalsOf(text) {
    const t = String(text || '').replace(/\r/g, '');
    const oi = t.lastIndexOf('ORBITAL ENERGIES');
    if (oi >= 0) { // ORCA：最后一份表；开壳层分 SPIN UP / SPIN DOWN 两段
      const lists = { alpha: [], beta: [] };
      let cur = 'alpha', started = false, gap = 0;
      for (const l of t.slice(oi).split('\n').slice(1, 6000)) {
        if (/SPIN DOWN ORBITALS/.test(l)) { cur = 'beta'; gap = 0; continue; }
        const m = /^\s*\d+\s+(\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/.exec(l);
        if (m) { lists[cur].push({ occ: Number(m[1]), e: Number(m[2]) }); started = true; gap = 0; continue; }
        if (started && ++gap > 3) break;
      }
      if (lists.alpha.length) return lists.beta.length ? lists : { alpha: lists.alpha };
    }
    // Gaussian：轨道能量那几行连成一块（Alpha / Beta 的 occ. 和 virt.），优化时会印好几块，只取最后一块
    const lines = t.split('\n'), blocks = [];
    let cur = null;
    lines.forEach((l, i) => {
      const m = /^\s*(Alpha|Beta)\s+(occ|virt)\. eigenvalues --(.*)$/.exec(l);
      if (!m) return;
      if (!cur || i !== cur.end + 1) blocks.push(cur = { rows: [], end: i });
      cur.rows.push(m); cur.end = i;
    });
    if (blocks.length) {
      const rows = blocks[blocks.length - 1].rows;
      const take = (spin) => rows.filter((m) => m[1] === spin).flatMap((m) => nums(m[3]).map((e) => ({ e, occ: m[2] === 'occ' ? 1 : 0 })));
      const al = take('Alpha'), be = take('Beta');
      return be.length ? { alpha: al, beta: be } : { alpha: al.map((x) => ({ ...x, occ: x.occ * 2 })) };
    }
    const xb = last(all(/#\s+Occupation\s+Energy\/Eh\s+Energy\/eV\s*\n\s*-+\s*\n([\s\S]*?)\n\s*-{10,}/g, t));
    if (xb) {
      const rows = [];
      for (const l of xb[1].split('\n')) {
        const m = /^\s*\d+\s+(\d+\.\d+)?\s*(-?\d+\.\d+)\s+(-?\d+\.\d+)/.exec(l);
        if (m) rows.push({ occ: m[1] ? Number(m[1]) : 0, e: Number(m[2]) });
      }
      if (rows.length) return { alpha: rows };
    }
    return null;
  }
  /** HOMO / LUMO 的位置（按占据 > 0.5 算占据）。 */
  function frontier(orbs) {
    const a = orbs.alpha.slice().sort((x, y) => x.e - y.e);
    const occ = a.filter((o) => o.occ > 0.5), vir = a.filter((o) => o.occ <= 0.5);
    const homo = occ.length ? occ[occ.length - 1].e : null, lumo = vir.length ? vir[0].e : null;
    return { homo, lumo, gapEv: homo !== null && lumo !== null ? (lumo - homo) * HARTREE_EV : null };
  }
  /**
   * 优化收敛：每一步的能量和收敛判据。Gaussian（Maximum Force / RMS Force / Maximum Displacement / RMS Displacement 表）、
   * ORCA（Geometry convergence 表：Energy change、RMS gradient、MAX gradient、RMS step、MAX step）、其他程序只给能量（stepEnergies 传进来）。
   * 返回 { energies, series: { 名字: [值] }, thresholds: { 名字: 阈值 }, converged: [每步是否全过] }。
   */
  function convergence(text, energies = []) {
    const t = String(text || '').replace(/\r/g, '');
    const series = {}, thresholds = {};
    const push = (k, v, th) => { (series[k] = series[k] || []).push(v); thresholds[k] = th; };
    const g = all(/^\s*(Maximum Force|RMS {5}Force|Maximum Displacement|RMS {5}Displacement)\s+(-?\d+\.\d+)\s+(\d+\.\d+)\s+(YES|NO)/gm, t);
    if (g.length) for (const m of g) push(m[1].replace(/\s+/g, ' '), Number(m[2]), Number(m[3]));
    const o = all(/^\s*(Energy change|RMS gradient|MAX gradient|RMS step|MAX step)\s+(-?\d+\.\d+)\s+(\d+\.\d+)\s+(YES|NO)/gm, t);
    if (!g.length && o.length) for (const m of o) push(m[1], Math.abs(Number(m[2])), Number(m[3]));
    const keys = Object.keys(series);
    const nstep = keys.length ? Math.max(...keys.map((k) => series[k].length)) : 0;
    const converged = [];
    for (let i = 0; i < nstep; i++) converged.push(keys.every((k) => series[k][i] === undefined || Math.abs(series[k][i]) <= thresholds[k]));
    return { energies, series, thresholds, converged };
  }

  // ── 作业脚本 ─────────────────────────────────────────────────────────
  const stem = (f) => f.replace(/\.[\w]+$/, '').replace(/\.qcschema$/, '');
  const RUN = {
    gaussian: (f) => `g16 < ${f} > ${stem(f)}.log`,
    orca: (f) => `"$(which orca)" ${f} > ${stem(f)}.out`,
    xtb: (f, o) => `xtb ${f} --opt --chrg ${o.charge || 0} --uhf ${(o.mult || 1) - 1} -P ${o.cores} > ${stem(f)}.out`,
    crest: (f, o) => `crest ${f} --gfn2 --chrg ${o.charge || 0} --uhf ${(o.mult || 1) - 1} -T ${o.cores} > ${stem(f)}_crest.out`,
    pyscf: (f) => `python ${f} > ${stem(f)}.out`,
    ase: (f) => `python ${f} > ${stem(f)}.out`,
    psi4: (f, o) => `psi4 -n ${o.cores} ${f} ${stem(f)}.out`,
    nwchem: (f, o) => `mpirun -np ${o.cores} nwchem ${f} > ${stem(f)}.out`,
    cp2k: (f, o) => `mpirun -np ${o.cores} cp2k.psmp -i ${f} -o ${stem(f)}.out`,
  };
  const MODULE = { gaussian: 'gaussian', orca: 'orca', xtb: 'xtb', crest: 'crest', pyscf: 'python', ase: 'python', psi4: 'psi4', nwchem: 'nwchem', cp2k: 'cp2k' };
  // 每个任务在自己的子目录里跑的程序（CREST 的输出文件名是固定的，放一起会互相覆盖）
  const OWN_DIR = new Set(['crest']);
  const shq = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
  /**
   * 作业脚本。o: { scheduler: slurm | pbs | bash | bat, program, files: [输入文件名], commands?: [每个文件自己的命令]（给了就用它，比如开源代码台按任务写好的 xtb 命令）,
   * cores = 8, memGB = 16, hours = 24, partition, account, name, module }。
   * 多个文件时 Slurm / PBS 写成作业数组（一个文件一个任务），bash / bat 依次运行。CREST 每个任务在以输入文件名命名的子目录里跑。
   */
  function jobScript(o) {
    const files = (o.files || []).filter(Boolean);
    if (!files.length) throw new Error('job:nofiles');
    const cores = Math.max(1, Math.min(256, Math.round(o.cores || 8))), mem = Math.max(1, Math.round(o.memGB || 16)), hours = Math.max(1, Math.min(720, Math.round(o.hours || 24)));
    const name = String(o.name || 'molastria').replace(/[^\w.-]+/g, '_').slice(0, 40);
    const prog = Object.hasOwn(RUN, o.program) ? o.program : 'orca';
    const cmds = files.map((f, i) => (o.commands && o.commands[i] ? String(o.commands[i]) : RUN[prog](f, { ...o, cores })));
    const own = OWN_DIR.has(prog);
    const wrap = (f, c) => (own ? `mkdir -p ${stem(f)} && cp ${f} ${stem(f)}/ && (cd ${stem(f)} && ${c})` : c);
    const arr = files.length > 1;
    const hh = `${String(hours).padStart(2, '0')}:00:00`;
    const mod = o.module === false ? [] : [`module load ${o.module || MODULE[prog]}  # adjust to your cluster`];
    const env = prog === 'xtb' || prog === 'crest' ? [`export OMP_NUM_THREADS=${cores},1`, 'export OMP_STACKSIZE=4G', 'ulimit -s unlimited']
      : prog === 'pyscf' || prog === 'ase' ? [`export OMP_NUM_THREADS=${cores}`] : [];
    if (o.scheduler === 'bat') {
      const L = ['@echo off', 'REM MolAstria workbench: run the inputs one after another on Windows', `REM program: ${prog}; edit the path below if the program is not on PATH`];
      if (prog === 'xtb' || prog === 'crest') L.push(`set OMP_NUM_THREADS=${cores},1`, 'set OMP_STACKSIZE=4G');
      files.forEach((f, i) => {
        const c = cmds[i].replace('"$(which orca)"', 'orca').replace(/^mpirun -np \d+ /, '');
        L.push(own ? `mkdir ${stem(f)} 2>NUL & copy /Y ${f} ${stem(f)}\\ >NUL & pushd ${stem(f)} & ${c} & popd` : c);
      });
      return L.join('\r\n') + '\r\n';
    }
    if (o.scheduler === 'bash') {
      return ['#!/bin/bash', '# MolAstria workbench: run the inputs one after another', 'set -e', ...env, ...files.map((f, i) => wrap(f, cmds[i])), ''].join('\n');
    }
    // 作业数组：第 i 个任务跑第 i 条命令
    const arrayLines = (idx) => [`cmds=(\n${files.map((f, i) => `  ${shq(wrap(f, cmds[i]))}`).join('\n')}\n)`, `eval "\${cmds[$((${idx}-1))]}"`];
    if (o.scheduler === 'pbs') {
      const L = ['#!/bin/bash', `#PBS -N ${name}`, `#PBS -l select=1:ncpus=${cores}:mem=${mem}gb`, `#PBS -l walltime=${hh}`];
      if (o.partition) L.push(`#PBS -q ${o.partition}`);
      if (o.account) L.push(`#PBS -A ${o.account}`);
      if (arr) L.push(`#PBS -J 1-${files.length}`);
      L.push('', 'cd "$PBS_O_WORKDIR"', ...mod, ...env);
      if (prog === 'gaussian') L.push('export GAUSS_SCRDIR=${TMPDIR:-/tmp}');
      if (arr) L.push(...arrayLines('PBS_ARRAY_INDEX'));
      else L.push(wrap(files[0], cmds[0]));
      return L.join('\n') + '\n';
    }
    const L = ['#!/bin/bash', `#SBATCH --job-name=${name}`, '#SBATCH --nodes=1', '#SBATCH --ntasks=1', `#SBATCH --cpus-per-task=${cores}`, `#SBATCH --mem=${mem}G`, `#SBATCH --time=${hh}`];
    if (o.partition) L.push(`#SBATCH --partition=${o.partition}`);
    if (o.account) L.push(`#SBATCH --account=${o.account}`);
    if (arr) L.push(`#SBATCH --array=1-${files.length}`, '#SBATCH --output=%x_%A_%a.slurm');
    L.push('', 'cd "$SLURM_SUBMIT_DIR"', ...mod, ...env);
    if (prog === 'gaussian') L.push('export GAUSS_SCRDIR=${SLURM_TMPDIR:-/tmp}');
    if (arr) L.push(...arrayLines('SLURM_ARRAY_TASK_ID'));
    else L.push(wrap(files[0], cmds[0]));
    return L.join('\n') + '\n';
  }

  // ── zip（只存不压缩）────────────────────────────────────────────────
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const utf8 = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  /** files: [{ name, text }] → Uint8Array（zip，不压缩，文件名 UTF-8）。 */
  function zip(files) {
    const parts = [], central = [];
    let off = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff], u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    for (const f of files) {
      const name = utf8(f.name), data = typeof f.text === 'string' ? utf8(f.text) : f.text, crc = crc32(data);
      const head = [0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(Uint8Array.from(head), name, data);
      central.push(Uint8Array.from([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += head.length + name.length + data.length;
    }
    const csize = central.reduce((s, p) => s + p.length, 0);
    const end = Uint8Array.from([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
    const all2 = [...parts, ...central, end], out = new Uint8Array(all2.reduce((s, p) => s + p.length, 0));
    let p = 0;
    for (const a of all2) { out.set(a, p); p += a.length; }
    return out;
  }

  // ── 文献 ────────────────────────────────────────────────────────────
  // 每条：key、作者、题目、刊物、年、卷、页、DOI（或网址）。DOI 由 tools/workbench-refs.mjs 在 OpenAlex 核对。
  const REFS = {
    ester: { type: 'software', authors: ['Zhang, Zixuan'], title: 'Ester Studio, version 2.1.2 [computer software]', journal: 'GitHub', year: 2026, url: 'https://github.com/Ahey1/Ester-Studio/releases/tag/v2.1.2' },
    gfn2: { authors: ['Bannwarth, Christoph', 'Ehlert, Sebastian', 'Grimme, Stefan'], title: 'GFN2-xTB—An Accurate and Broadly Parametrized Self-Consistent Tight-Binding Quantum Chemical Method with Multipole Electrostatics and Density-Dependent Dispersion Contributions', journal: 'J. Chem. Theory Comput.', year: 2019, volume: '15', pages: '1652–1671', doi: '10.1021/acs.jctc.8b01176' },
    gfn1: { authors: ['Grimme, Stefan', 'Bannwarth, Christoph', 'Shushkov, Philip'], title: 'A Robust and Accurate Tight-Binding Quantum Chemical Method for Structures, Vibrational Frequencies, and Noncovalent Interactions of Large Molecular Systems Parametrized for All spd-Block Elements (Z = 1–86)', journal: 'J. Chem. Theory Comput.', year: 2017, volume: '13', pages: '1989–2009', doi: '10.1021/acs.jctc.7b00118' },
    gfnff: { authors: ['Spicher, Sebastian', 'Grimme, Stefan'], title: 'Robust Atomistic Modeling of Materials, Organometallic, and Biochemical Systems', journal: 'Angew. Chem. Int. Ed.', year: 2020, volume: '59', pages: '15665–15673', doi: '10.1002/anie.202004239' },
    alpb: { authors: ['Ehlert, Sebastian', 'Stahn, Marcel', 'Spicher, Sebastian', 'Grimme, Stefan'], title: 'Robust and Efficient Implicit Solvation Model for Fast Semiempirical Methods', journal: 'J. Chem. Theory Comput.', year: 2021, volume: '17', pages: '4250–4261', doi: '10.1021/acs.jctc.1c00471' },
    crest: { authors: ['Pracht, Philipp', 'Bohle, Fabian', 'Grimme, Stefan'], title: 'Automated exploration of the low-energy chemical space with fast quantum chemical methods', journal: 'Phys. Chem. Chem. Phys.', year: 2020, volume: '22', pages: '7169–7192', doi: '10.1039/C9CP06869D' },
    mmff: { authors: ['Halgren, Thomas A.'], title: 'Merck molecular force field. I. Basis, form, scope, parameterization, and performance of MMFF94', journal: 'J. Comput. Chem.', year: 1996, volume: '17', pages: '490–519', doi: '10.1002/(SICI)1096-987X(199604)17:5/6<490::AID-JCC1>3.0.CO;2-P' },
    kabsch: { authors: ['Kabsch, Wolfgang'], title: 'A solution for the best rotation to relate two sets of vectors', journal: 'Acta Cryst. A', year: 1976, volume: '32', pages: '922–923', doi: '10.1107/S0567739476001873' },
    horn: { authors: ['Horn, Berthold K. P.'], title: 'Closed-form solution of absolute orientation using unit quaternions', journal: 'J. Opt. Soc. Am. A', year: 1987, volume: '4', pages: '629–642', doi: '10.1364/JOSAA.4.000629' },
    idpp: { authors: ['Smidstrup, Søren', 'Pedersen, Andreas', 'Stokbro, Kurt', 'Jónsson, Hannes'], title: 'Improved initial guess for minimum energy path calculations', journal: 'J. Chem. Phys.', year: 2014, volume: '140', pages: '214106', doi: '10.1063/1.4878664' },
    cineb: { authors: ['Henkelman, Graeme', 'Uberuaga, Blas P.', 'Jónsson, Hannes'], title: 'A climbing image nudged elastic band method for finding saddle points and minimum energy paths', journal: 'J. Chem. Phys.', year: 2000, volume: '113', pages: '9901–9904', doi: '10.1063/1.1329672' },
    irc: { authors: ['Fukui, Kenichi'], title: 'The path of chemical reactions - the IRC approach', journal: 'Acc. Chem. Res.', year: 1981, volume: '14', pages: '363–368', doi: '10.1021/ar00072a001' },
    molden: { authors: ['Schaftenaar, G.', 'Noordik, J. H.'], title: 'Molden: a pre- and post-processing program for molecular and electronic structures', journal: 'J. Comput.-Aided Mol. Des.', year: 2000, volume: '14', pages: '123–134', doi: '10.1023/A:1008193805436' },
    hirshfeld: { authors: ['Hirshfeld, F. L.'], title: 'Bonded-atom fragments for describing molecular charge densities', journal: 'Theor. Chim. Acta', year: 1977, volume: '44', pages: '129–138', doi: '10.1007/BF00549096' },
    hsurf: { authors: ['Spackman, Mark A.', 'Jayatilaka, Dylan'], title: 'Hirshfeld surface analysis', journal: 'CrystEngComm', year: 2009, volume: '11', pages: '19–32', doi: '10.1039/B818330A' },
    fingerprint: { authors: ['Spackman, Mark A.', 'McKinnon, Joshua J.'], title: 'Fingerprinting intermolecular interactions in molecular crystals', journal: 'CrystEngComm', year: 2002, volume: '4', pages: '378–392', doi: '10.1039/B203191B' },
    igm: { authors: ['Lefebvre, Corentin', 'Rubez, Gaëtan', 'Khartabil, Hassan', 'Boisson, Jean-Charles', 'Contreras-García, Julia', 'Hénon, Eric'], title: 'Accurately extracting the signature of intermolecular interactions present in the NCI plot of the reduced density gradient versus electron density', journal: 'Phys. Chem. Chem. Phys.', year: 2017, volume: '19', pages: '17928–17936', doi: '10.1039/C7CP02110K' },
    igmh: { authors: ['Lu, Tian', 'Chen, Qinxue'], title: 'Independent gradient model based on Hirshfeld partition: A new method for visual study of interactions in chemical systems', journal: 'J. Comput. Chem.', year: 2022, volume: '43', pages: '539–555', doi: '10.1002/jcc.26812' },
    iri: { authors: ['Lu, Tian', 'Chen, Qinxue'], title: 'Interaction Region Indicator: A Simple Real Space Function Clearly Revealing Both Chemical Bonds and Weak Interactions', journal: 'Chemistry–Methods', year: 2021, volume: '1', pages: '231–239', doi: '10.1002/cmtd.202100007' },
    multiwfn: { authors: ['Lu, Tian', 'Chen, Feiwu'], title: 'Multiwfn: A multifunctional wavefunction analyzer', journal: 'J. Comput. Chem.', year: 2012, volume: '33', pages: '580–592', doi: '10.1002/jcc.22885' },
    raman: { authors: ['Polavarapu, Prasad L.'], title: 'Ab initio vibrational Raman and Raman optical activity spectra', journal: 'J. Phys. Chem.', year: 1990, volume: '94', pages: '8106–8112', doi: '10.1021/j100384a024' },
    bondi: { authors: ['Bondi, A.'], title: 'van der Waals Volumes and Radii', journal: 'J. Phys. Chem.', year: 1964, volume: '68', pages: '441–451', doi: '10.1021/j100785a001' },
    cordero: { authors: ['Cordero, Beatriz', 'Gómez, Verónica', 'Platero-Prats, Ana E.', 'Revés, Marc', 'Echeverría, Jorge', 'Cremades, Eduard', 'Barragán, Flavia', 'Alvarez, Santiago'], title: 'Covalent radii revisited', journal: 'Dalton Trans.', year: 2008, volume: '', pages: '2832–2838', doi: '10.1039/B801115J' },
    threedmol: { authors: ['Rego, Nicholas', 'Koes, David'], title: '3Dmol.js: molecular visualization with WebGL', journal: 'Bioinformatics', year: 2015, volume: '31', pages: '1322–1324', doi: '10.1093/bioinformatics/btu829' },
    pyscf: { authors: ['Sun, Qiming', 'Berkelbach, Timothy C.', 'Blunt, Nick S.', 'Booth, George H.', 'Guo, Sheng', 'Li, Zhendong', 'Liu, Junzi', 'McClain, James D.', 'Sayfutyarova, Elvira R.', 'Sharma, Sandeep', 'Wouters, Sebastian', 'Chan, Garnet Kin-Lic'], title: 'PySCF: the Python-based simulations of chemistry framework', journal: 'WIREs Comput. Mol. Sci.', year: 2018, volume: '8', pages: 'e1340', doi: '10.1002/wcms.1340' },
    vesta: { authors: ['Momma, Koichi', 'Izumi, Fujio'], title: 'VESTA 3 for three-dimensional visualization of crystal, volumetric and morphology data', journal: 'J. Appl. Cryst.', year: 2011, volume: '44', pages: '1272–1276', doi: '10.1107/S0021889811038970' },
    cip: { authors: ['Hanson, Robert M.', 'Musacchio, Sophia G.', 'Mayfield, John W.', 'Vainio, Mikko J.', 'Yerin, Andrey', 'Redkin, Dmitry'], title: 'Algorithmic Analysis of Cahn–Ingold–Prelog Rules of Stereochemistry: Proposals for Revised Rules and a Guide for Machine Implementation', journal: 'J. Chem. Inf. Model.', year: 2018, volume: '58', pages: '1755–1765', doi: '10.1021/acs.jcim.8b00324' },
    openchemlib: { type: 'software', authors: ['OpenChemLib contributors'], title: 'OpenChemLib JavaScript, version 9.25.1 [computer software]', journal: 'GitHub', year: 2025, url: 'https://github.com/cheminfo/openchemlib-js' },
    cclib: { authors: ['O\'Boyle, Noel M.', 'Tenderholt, Adam L.', 'Langner, Karol M.'], title: 'cclib: A library for package-independent computational chemistry algorithms', journal: 'J. Comput. Chem.', year: 2008, volume: '29', pages: '839–845', doi: '10.1002/jcc.20823' },
    vmd: { authors: ['Humphrey, William', 'Dalke, Andrew', 'Schulten, Klaus'], title: 'VMD: Visual molecular dynamics', journal: 'J. Mol. Graph.', year: 1996, volume: '14', pages: '33–38', doi: '10.1016/0263-7855(96)00018-5' },
  };
  const bibKey = (id, r) => `${(r.authors[0] || 'anon').split(',')[0].normalize('NFD').replace(/[^\w]/g, '')}${r.year}${id}`;
  const bibEsc = (s) => String(s).replace(/[{}]/g, '').replace(/–/g, '--').replace(/—/g, '---');
  function bibtex(ids) {
    return ids.filter((id) => REFS[id]).map((id) => {
      const r = REFS[id];
      const f = [`  author = {${r.authors.map(bibEsc).join(' and ')}}`, `  title = {{${bibEsc(r.title)}}}`];
      if (r.type === 'software') f.push(`  howpublished = {${r.journal}}`, `  url = {${r.url}}`);
      else f.push(`  journal = {${bibEsc(r.journal)}}`);
      f.push(`  year = {${r.year}}`);
      if (r.volume) f.push(`  volume = {${r.volume}}`);
      if (r.pages) f.push(`  pages = {${bibEsc(r.pages)}}`);
      if (r.doi) f.push(`  doi = {${r.doi}}`);
      return `@${r.type === 'software' ? 'misc' : 'article'}{${bibKey(id, r)},\n${f.join(',\n')}\n}`;
    }).join('\n\n') + '\n';
  }
  function ris(ids) {
    return ids.filter((id) => REFS[id]).map((id) => {
      const r = REFS[id];
      const L = [`TY  - ${r.type === 'software' ? 'COMP' : 'JOUR'}`, ...r.authors.map((a) => `AU  - ${a}`), `TI  - ${r.title}`, `${r.type === 'software' ? 'PB' : 'JO'}  - ${r.journal}`, `PY  - ${r.year}`];
      if (r.volume) L.push(`VL  - ${r.volume}`);
      if (r.pages) { const [sp, ep] = String(r.pages).split('–'); L.push(`SP  - ${sp}`); if (ep) L.push(`EP  - ${ep}`); }
      if (r.doi) L.push(`DO  - ${r.doi}`);
      if (r.url) L.push(`UR  - ${r.url}`);
      L.push('ER  - ');
      return L.join('\n');
    }).join('\n\n') + '\n';
  }
  function refsCsv(ids) {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    return ['key,authors,title,journal,year,volume,pages,doi_or_url', ...ids.filter((id) => REFS[id]).map((id) => { const r = REFS[id]; return [bibKey(id, r), r.authors.join('; '), r.title, r.journal, r.year, r.volume || '', r.pages || '', r.doi || r.url].map(q).join(','); })].join('\n') + '\n';
  }

  const pure = {
    UNITS, fromEh, HARTREE_KCAL, HARTREE_EV, EV_CM, ALPB, PATH_TASKS, coordValue, checkCoords, ranges, pathInput, allxyz,
    readPath, gaussianGeoms, pathLength, spline, profile, uvOf, ramanOf, ramanIntensity, broaden, uvSpectrum,
    orbitalsOf, frontier, convergence, jobScript, crc32, zip, REFS, bibtex, ris, refsCsv,
  };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaWBCalc = pure;
})(typeof self !== 'undefined' ? self : this);
