/* 开源代码台的纯逻辑（没有 DOM，tools/code-test.mjs 测）：
   1. 读分子（XYZ），核对电荷和自旋多重度；
   2. 为 PySCF、Psi4、xTB、CREST、ORCA、Gaussian、NWChem、CP2K、ASE 写输入，导出 QCSchema；
   3. 读 xTB、ORCA、Psi4、Gaussian、PySCF、NWChem、CP2K、Q-Chem 的输出（思路借鉴 cclib，BSD-3；代码是自己写的）；
   4. 按许可证判断一份代码能不能放进 MIT 许可的 MolAstria；
   5. 代码搜索的链接、PyPI / OSV 返回值的整理。
   浏览器里是 window.MolAstriaCode，node 里是 module.exports。 */
(function (root) {
  'use strict';

  // ── 元素与常数 ─────────────────────────────────────────────────────────
  const SYMBOLS = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr '
    + 'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu '
    + 'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn').split(' ');
  const Z = Object.fromEntries(SYMBOLS.map((s, i) => [s, i + 1]));
  const BOHR_ANGSTROM = 0.529177210903; // CODATA 2018，1 bohr 等于多少 Å
  const HARTREE_EV = 27.211386245988; // CODATA 2018
  const HARTREE_KCAL = 627.509474; // 1 Eh 等于多少 kcal/mol

  /** 元素符号规范成首字母大写；也接受原子序数。认不出返回 ''。 */
  function element(tok) {
    const t = String(tok || '').trim();
    if (/^\d+$/.test(t)) return SYMBOLS[Number(t) - 1] || '';
    const m = /^([A-Za-z]{1,2})(?:[\d_-].*)?$/.exec(t); // "C1"、"H_a" 这类标签取前面的符号
    if (!m) return '';
    const two = m[1][0].toUpperCase() + (m[1][1] || '').toLowerCase();
    if (m[1].length === 2 && Z[two]) return two;
    const one = m[1][0].toUpperCase();
    return Z[one] ? one : '';
  }

  /** 多帧 XYZ（构象、轨迹、扫描）拆成一帧一段，带上每一帧在原文里从第几行开始（从 0 数）；
      只有一帧、或者格式对不上时返回 null，交给单帧的读法报错。 */
  function frameBlocks(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const frames = [];
    let i = 0;
    while (i < lines.length) {
      while (i < lines.length && !lines[i].trim()) i++;
      if (i >= lines.length) break;
      const m = /^\s*(\d+)\s*$/.exec(lines[i]);
      if (!m || +m[1] < 1) return null;
      const n = +m[1], block = lines.slice(i, i + n + 2);
      if (block.length < n + 2 || block.slice(2).some((l) => !l.trim() || /^\s*\d+\s*$/.test(l))) return null;
      frames.push({ text: block.join('\n'), start: i });
      i += n + 2;
    }
    return frames.length > 1 ? frames : null;
  }
  const splitFrames = (text) => frameBlocks(text)?.map((b) => b.text) ?? null;

  /** 读 XYZ：标准格式（原子数 + 注释行）或者只有“元素 x y z”的若干行；多帧的文件读第 frame 帧（从 0 数）。
      返回 { atoms:[{el,x,y,z}], comment, errors, frames（共几帧）, frame, comments（每帧的注释） }。报错里的行号按整个文件数。 */
  function parseXYZ(text, frame = 0) {
    const multi = frameBlocks(text);
    if (multi) {
      const k = Math.min(Math.max(0, Math.floor(Number(frame) || 0)), multi.length - 1);
      const r = parseOne(multi[k].text, multi[k].start, k);
      return { ...r, frames: multi.length, frame: k, comments: multi.map((b) => (b.text.split('\n')[1] || '').trim()) };
    }
    return { ...parseOne(text), frames: 1, frame: 0, comments: [] };
  }
  /** 读一帧。off：这一帧前面还有几行（报错的行号加上它）；k：多帧文件里的第几帧（单帧是 -1）。 */
  function parseOne(text, off = 0, k = -1) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    while (lines.length && !lines[0].trim()) { lines.shift(); off++; }
    let comment = '', declared = null;
    if (lines.length && /^\s*\d+\s*$/.test(lines[0])) {
      declared = Number(lines[0].trim());
      comment = (lines[1] || '').trim();
      lines.splice(0, 2);
      off += 2;
    }
    const atoms = [], errors = [];
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const p = line.split(/[\s,]+/);
      const el = element(p[0]);
      const xyz = p.slice(1, 4).map(Number);
      if (!el || p.length < 4 || xyz.some((v) => !Number.isFinite(v))) { errors.push(`第 ${i + 1 + off} 行读不懂：${line.slice(0, 40)}`); return; }
      atoms.push({ el, x: xyz[0], y: xyz[1], z: xyz[2] });
    });
    if (declared !== null && declared !== atoms.length && !errors.length) {
      errors.push(k < 0 ? `第一行写的是 ${declared} 个原子，实际读到 ${atoms.length} 个` : `第 ${k + 1} 帧写的是 ${declared} 个原子，实际读到 ${atoms.length} 个`);
    }
    if (!atoms.length && !errors.length) errors.push('没有读到原子');
    return { atoms, comment, errors };
  }

  /** 分子式（Hill 规则：有碳时 C、H 在前，其余按字母）。 */
  function formula(atoms) {
    const n = {};
    for (const a of atoms) n[a.el] = (n[a.el] || 0) + 1;
    const keys = Object.keys(n).sort();
    const order = n.C ? ['C', ...(n.H ? ['H'] : []), ...keys.filter((k) => k !== 'C' && k !== 'H')] : keys;
    return order.map((k) => k + (n[k] > 1 ? n[k] : '')).join('');
  }

  /** 电子数和多重度是否自洽。多重度 = 2S+1；电子数是偶数时多重度只能是奇数，反过来也一样。 */
  function checkSpin(atoms, charge, mult) {
    const q = Number(charge), m = Number(mult);
    const nuc = atoms.reduce((s, a) => s + (Z[a.el] || 0), 0);
    const ne = nuc - q;
    const out = { electrons: ne, unpaired: m - 1, ok: false, message: '' };
    if (!Number.isInteger(q)) out.message = '电荷要是整数';
    else if (!Number.isInteger(m) || m < 1) out.message = '自旋多重度要是正整数（单重态 1、双重态 2、三重态 3）';
    else if (ne < 0) out.message = `电荷 ${q} 比全部核电荷 ${nuc} 还多，没有电子了`;
    else if (m - 1 > ne) out.message = `只有 ${ne} 个电子，最多 ${ne} 个未成对，多重度不能是 ${m}`;
    else if ((ne + m - 1) % 2) out.message = ne % 2 ? `${ne} 个电子是奇数，多重度应该是偶数（2、4…），现在是 ${m}` : `${ne} 个电子是偶数，多重度应该是奇数（1、3…），现在是 ${m}`;
    else { out.ok = true; out.message = `${ne} 个电子，${m - 1} 个未成对`; }
    return out;
  }

  // ── 方法、基组与任务 ─────────────────────────────────────────────────────
  const METHODS = {
    HF: { kind: 'hf' }, B3LYP: { kind: 'dft' }, PBE0: { kind: 'dft' }, PBE: { kind: 'dft' },
    MP2: { kind: 'post' }, 'CCSD(T)': { kind: 'post' },
    'GFN2-xTB': { kind: 'xtb', flag: '--gfn 2' }, 'GFN1-xTB': { kind: 'xtb', flag: '--gfn 1' }, 'GFN-FF': { kind: 'xtb', flag: '--gfnff' },
  };
  const BASES = ['sto-3g', '6-31g*', 'def2-svp', 'def2-tzvp', 'cc-pvdz', 'cc-pvtz'];
  const BASIS_NAME = {
    pretty: { 'sto-3g': 'STO-3G', '6-31g*': '6-31G*', 'def2-svp': 'def2-SVP', 'def2-tzvp': 'def2-TZVP', 'cc-pvdz': 'cc-pVDZ', 'cc-pvtz': 'cc-pVTZ' },
    gaussian: { 'sto-3g': 'STO-3G', '6-31g*': '6-31G(d)', 'def2-svp': 'Def2SVP', 'def2-tzvp': 'Def2TZVP', 'cc-pvdz': 'cc-pVDZ', 'cc-pvtz': 'cc-pVTZ' },
  };
  const TASKS = ['sp', 'opt', 'freq', 'optfreq'];
  const TASK_LABEL = { sp: '单点能', opt: '结构优化', freq: '频率', optfreq: '优化 + 频率' };
  const TASK_EN = { sp: 'single point', opt: 'optimization', freq: 'frequencies', optfreq: 'optimization + frequencies' }; // 写进输入文件的标题用英文

  function norm(opts) {
    const o = { charge: 0, mult: 1, method: 'B3LYP', basis: 'def2-svp', task: 'sp', solvent: '', d3: false, name: 'mol', ...opts };
    o.charge = Number(o.charge) || 0; o.mult = Number(o.mult) || 1;
    o.open = o.mult > 1;
    o.kind = (METHODS[o.method] || METHODS.B3LYP).kind;
    o.opt = o.task === 'opt' || o.task === 'optfreq';
    o.freq = o.task === 'freq' || o.task === 'optfreq';
    o.name = String(o.name || 'mol').replace(/[^\w.-]+/g, '_') || 'mol';
    return o;
  }
  const f = (v) => (v < 0 ? '' : ' ') + v.toFixed(6);
  const coordLines = (atoms, pad = '') => atoms.map((a) => `${pad}${a.el.padEnd(2)} ${f(a.x)} ${f(a.y)} ${f(a.z)}`).join('\n');
  const xyzFile = (atoms, comment = '') => `${atoms.length}\n${comment}\n${coordLines(atoms)}\n`;
  const nope = (why) => ({ supported: false, text: '', notes: [why] });

  // 每个程序：返回 { supported, text, filename, run, notes }。
  const GEN = {};

  GEN.pyscf = (atoms, o) => {
    if (o.kind === 'xtb') return nope('PySCF 不做 GFN-xTB：请看 xTB、CREST 或 ASE 标签。');
    const notes = [];
    const spin = o.mult - 1;
    const scf = o.kind !== 'dft' ? (o.open ? 'scf.UHF' : 'scf.RHF') : (o.open ? 'dft.UKS' : 'dft.RKS');
    const L = ['from pyscf import gto, scf, dft' + (o.kind === 'post' ? (o.method === 'MP2' ? ', mp' : ', cc') : ''), ''];
    L.push('mol = gto.M(', '    atom="""', coordLines(atoms, '    '), '    """,', `    basis="${o.basis}",`, `    charge=${o.charge},`, `    spin=${spin},  # 2S = number of unpaired electrons (multiplicity ${o.mult})`, '    unit="Angstrom",', ')', '');
    const xc = o.kind === 'dft' ? `\nmf.xc = "${o.method.toLowerCase()}"` : '';
    L.push(`mf = ${scf}(mol)${xc}`);
    if (o.d3 && o.kind === 'dft') { L.push('mf.disp = "d3bj"  # needs: pip install pyscf-dispersion'); }
    if (o.solvent) { L.push(`mf = mf.ddCOSMO()\nmf.with_solvent.eps = ${o.solvent === 'water' ? '78.3553' : '1.0'}  # water`); }
    if (o.opt && o.kind !== 'post') {
      L.push('', 'from pyscf.geomopt.geometric_solver import optimize  # needs: pip install geometric', 'mol = optimize(mf)', `mf = ${scf}(mol)${xc}`);
      if (o.d3 && o.kind === 'dft') L.push('mf.disp = "d3bj"');
    }
    L.push('mf.kernel()');
    if (o.kind === 'post') {
      if (o.method === 'MP2') L.push('pt = mp.MP2(mf).run()', 'print("E(MP2) =", pt.e_tot)');
      else L.push('mycc = cc.CCSD(mf).run()', 'et = mycc.ccsd_t()', 'print("E(CCSD(T)) =", mycc.e_tot + et)');
      if (o.opt) notes.push('这里只给 MP2 / CCSD(T) 单点：通常先用 DFT 优化结构，再在优化好的结构上算。');
    }
    if (o.freq) {
      if (o.kind === 'post') notes.push('PySCF 没有 MP2 / CCSD(T) 的解析 Hessian，频率请改用 HF 或 DFT。');
      else if (o.solvent) notes.push('PySCF 的溶剂模型 Hessian 支持有限，频率请先在气相下算。');
      else L.push('', 'from pyscf.hessian import thermo', 'hess = mf.Hessian().kernel()', 'freq = thermo.harmonic_analysis(mol, hess)', 'print("Frequencies / cm^-1:", freq["freq_wavenumber"])');
    }
    if (o.d3 && o.kind !== 'dft') notes.push('D3(BJ) 色散校正只加在 DFT 上。');
    return { supported: true, text: L.join('\n') + '\n', filename: `${o.name}.py`, run: `python ${o.name}.py`, notes };
  };

  GEN.psi4 = (atoms, o) => {
    if (o.kind === 'xtb') return nope('Psi4 不做 GFN-xTB：请看 xTB、CREST 或 ASE 标签。');
    const notes = [];
    const m = o.kind === 'hf' ? 'scf' : o.method.toLowerCase() + (o.d3 && o.kind === 'dft' ? '-d3bj' : '');
    const L = ['# Psi4 input', 'memory 2 GB', '', 'molecule {', `  ${o.charge} ${o.mult}`, coordLines(atoms, '  '), '  units angstrom', '  symmetry c1', '}', '', 'set {', `  basis ${o.basis}`];
    if (o.open) L.push(`  reference ${o.kind === 'dft' ? 'uks' : 'uhf'}`);
    if (o.solvent) { L.push('  pcm true', '  pcm_scf_type total'); notes.push('PCM 要装 PCMSolver；下面的 pcm 段落用水。'); }
    L.push('}');
    if (o.solvent) L.push('', 'pcm = {', '  Units = Angstrom', '  Medium {', '    SolverType = IEFPCM', '    Solvent = Water', '  }', '  Cavity {', '    Type = GePol', '  }', '}');
    L.push('');
    if (o.task === 'sp') L.push(`energy('${m}')`);
    if (o.task === 'opt') L.push(`optimize('${m}')`);
    if (o.task === 'freq') L.push(`frequency('${m}')`);
    if (o.task === 'optfreq') L.push(`optimize('${m}')`, `frequency('${m}')`);
    if (o.d3 && o.kind !== 'dft') notes.push('D3(BJ) 色散校正只加在 DFT 上。');
    if (o.d3 && o.kind === 'dft') notes.push('-d3bj 后缀要装 dftd3 或 s-dftd3。');
    if (o.kind === 'post' && o.freq) notes.push('MP2 / CCSD(T) 的频率 Psi4 会用有限差分，很慢。');
    return { supported: true, text: L.join('\n') + '\n', filename: `${o.name}.in`, run: `psi4 ${o.name}.in`, notes };
  };

  function xtbArgs(o, forCrest) {
    const meth = METHODS[o.method]?.kind === 'xtb' ? o.method : 'GFN2-xTB';
    const a = [];
    if (forCrest) a.push(meth === 'GFN-FF' ? '--gfnff' : meth === 'GFN1-xTB' ? '--gfn1' : '--gfn2');
    else a.push(METHODS[meth].flag);
    a.push(`--chrg ${o.charge}`, `--uhf ${o.mult - 1}`);
    if (o.solvent) a.push('--alpb water');
    return { a, meth };
  }

  GEN.xtb = (atoms, o) => {
    const { a, meth } = xtbArgs(o, false);
    const notes = [];
    if (METHODS[o.method]?.kind !== 'xtb') notes.push(`xTB 只做半经验方法，这里用 ${meth}；基组设置不起作用。`);
    const task = o.task === 'opt' ? '--opt' : o.task === 'freq' ? '--hess' : o.task === 'optfreq' ? '--ohess' : '';
    const cmd = ['xtb', `${o.name}.xyz`, task, ...a].filter(Boolean).join(' ');
    if (o.d3) notes.push('GFN-xTB 自带 D4 / D3 色散，不用另加。');
    return { supported: true, text: xyzFile(atoms, `${o.name} charge=${o.charge} mult=${o.mult}`), filename: `${o.name}.xyz`, run: cmd, notes };
  };

  GEN.crest = (atoms, o) => {
    const { a, meth } = xtbArgs(o, true);
    const notes = ['CREST 做构象搜索，任务设置（单点、优化、频率）对它不起作用；结果在 crest_conformers.xyz。'];
    if (METHODS[o.method]?.kind !== 'xtb') notes.push(`CREST 用 xTB 系方法采样，这里用 ${meth}。`);
    const cmd = ['crest', `${o.name}.xyz`, ...a, '-T 4'].join(' ');
    return { supported: true, text: xyzFile(atoms, `${o.name} charge=${o.charge} mult=${o.mult}`), filename: `${o.name}.xyz`, run: cmd, notes };
  };

  GEN.orca = (atoms, o) => {
    const notes = [];
    let kw;
    if (o.kind === 'xtb') { kw = [o.method === 'GFN-FF' ? 'XTBFF' : o.method === 'GFN1-xTB' ? 'XTB1' : 'XTB2']; notes.push('ORCA 调用外部的 xtb 程序，要把 xtb 放进 PATH（ORCA 6 起自带）。'); }
    else kw = [o.method, BASIS_NAME.pretty[o.basis] || o.basis];
    if (o.d3 && o.kind === 'dft') kw.push('D3BJ');
    if (o.open && o.kind !== 'xtb') kw.push(o.kind === 'dft' ? 'UKS' : 'UHF');
    if (o.opt) kw.push('Opt');
    if (o.freq) kw.push(o.kind === 'post' ? 'NumFreq' : 'Freq');
    if (o.solvent) kw.push(o.kind === 'xtb' ? 'ALPB(water)' : 'CPCM(water)');
    if (o.kind === 'post' && o.basis.startsWith('def2')) kw.push(o.basis === 'def2-svp' ? 'def2-SVP/C' : 'def2-TZVP/C');
    const L = [`! ${kw.join(' ')}`, '', '%pal nprocs 4 end', '%maxcore 2000', '', `* xyz ${o.charge} ${o.mult}`, coordLines(atoms, '  '), '*'];
    if (o.d3 && o.kind !== 'dft') notes.push('D3(BJ) 色散校正只加在 DFT 上。');
    if (o.kind === 'post' && o.opt) notes.push('CCSD(T) 没有解析梯度，ORCA 会很慢；通常用 DFT 优化、再算 CCSD(T) 单点。');
    return { supported: true, text: L.join('\n') + '\n', filename: `${o.name}.inp`, run: `orca ${o.name}.inp > ${o.name}.out`, notes };
  };

  GEN.gaussian = (atoms, o) => {
    if (o.kind === 'xtb') return nope('Gaussian 不内置 GFN-xTB：请看 xTB、CREST 或 ASE 标签。');
    const notes = [];
    const meth = (o.open ? 'U' : '') + (o.method === 'CCSD(T)' ? 'CCSD(T)' : o.method === 'PBE' ? 'PBEPBE' : o.method === 'PBE0' ? 'PBE1PBE' : o.method);
    const route = [`#p ${meth}/${BASIS_NAME.gaussian[o.basis] || o.basis}`];
    if (o.opt) route.push('Opt');
    if (o.freq) route.push('Freq');
    if (o.d3 && o.kind === 'dft') route.push('EmpiricalDispersion=GD3BJ');
    if (o.solvent) route.push('SCRF=(SMD,Solvent=Water)');
    if (o.kind === 'post' && o.freq) notes.push('CCSD(T) 的 Freq 是数值差分，非常慢。');
    const L = [`%chk=${o.name}.chk`, '%nprocshared=4', '%mem=4GB', route.join(' '), '', `${o.name} ${TASK_EN[o.task]}`, '', `${o.charge} ${o.mult}`, coordLines(atoms), '', ''];
    if (o.d3 && o.kind !== 'dft') notes.push('D3(BJ) 色散校正只加在 DFT 上。');
    notes.push('Gaussian 是商业软件，要有授权。');
    return { supported: true, text: L.join('\n'), filename: `${o.name}.gjf`, run: `g16 ${o.name}.gjf`, notes };
  };

  GEN.nwchem = (atoms, o) => {
    if (o.kind === 'xtb') return nope('NWChem 不做 GFN-xTB：请看 xTB、CREST 或 ASE 标签。');
    const notes = [];
    const L = [`start ${o.name}`, `title "${o.name} ${TASK_EN[o.task]}"`, 'memory total 2000 mb', '', `charge ${o.charge}`, '', 'geometry units angstrom noautosym', coordLines(atoms, '  '), 'end', '', 'basis spherical', `  * library ${o.basis}`, 'end', ''];
    let theory;
    if (o.kind === 'dft') {
      const xc = { B3LYP: 'b3lyp', PBE0: 'pbe0', PBE: 'xpbe96 cpbe96' }[o.method];
      L.push('dft', `  xc ${xc}`, `  mult ${o.mult}`);
      if (o.d3) L.push('  disp vdw 4');
      L.push('end');
      theory = 'dft';
    } else {
      L.push('scf', o.open ? `  uhf\n  nopen ${o.mult - 1}` : '  rhf', 'end');
      theory = o.kind === 'hf' ? 'scf' : o.method === 'MP2' ? 'mp2' : 'ccsd(t)';
      if (o.method === 'CCSD(T)' && o.open) { theory = 'tce'; L.push('tce', '  ccsd(t)', 'end'); }
    }
    if (o.solvent) { L.push('cosmo', '  dielec 78.4', 'end'); }
    L.push('');
    if (o.opt) L.push(`task ${theory} optimize`);
    if (o.freq) L.push(`task ${theory} freq`);
    if (o.task === 'sp') L.push(`task ${theory} energy`);
    if (o.d3 && o.kind !== 'dft') notes.push('D3(BJ) 色散校正只加在 DFT 上。');
    if (o.kind === 'post' && o.freq) notes.push('NWChem 的 MP2 / CCSD(T) 频率用数值差分，很慢。');
    return { supported: true, text: L.join('\n') + '\n', filename: `${o.name}.nw`, run: `mpirun -np 4 nwchem ${o.name}.nw > ${o.name}.out`, notes };
  };

  GEN.cp2k = (atoms, o) => {
    if (o.kind === 'xtb' && o.method === 'GFN-FF') return nope('CP2K 不做 GFN-FF；可以选 GFN1-xTB。');
    const notes = [];
    const xs = atoms.map((a) => a.x), ys = atoms.map((a) => a.y), zs = atoms.map((a) => a.z);
    const box = [xs, ys, zs].map((v) => Math.ceil(Math.max(...v) - Math.min(...v) + 10)); // 两边各留 5 Å 真空
    const kinds = [...new Set(atoms.map((a) => a.el))];
    const xtb = o.kind === 'xtb';
    if (xtb && o.method === 'GFN2-xTB') notes.push('CP2K 自带的 xTB 只有 GFN0 和 GFN1；GFN2-xTB 要走 tblite 后端（GFN_TYPE TBLITE），CP2K 编译时要带上 tblite（conda-forge 的 2026.2 没带，会报 “Built without TBLITE”）。按 CP2K 2026.2 的输入手册写；跑不了就改选 GFN1-xTB。');
    if (!xtb && o.method !== 'PBE') notes.push(`CP2K 这里固定用 PBE + DZVP-MOLOPT-SR-GTH（GPW 的标准搭配），没有按 ${o.method} / ${BASIS_NAME.pretty[o.basis]} 写；杂化泛函和高斯基组要另外设置 HFX 段。`);
    if (o.solvent) notes.push('溶剂模型（SCCS）没有写进去，这里是真空。');
    const run = o.opt ? 'GEO_OPT' : o.freq ? 'VIBRATIONAL_ANALYSIS' : 'ENERGY';
    if (o.task === 'optfreq') notes.push('CP2K 一个输入只做一种 RUN_TYPE：先跑 GEO_OPT，再把结果改成 VIBRATIONAL_ANALYSIS。');
    const dft = xtb
      ? ['    &QS', '      METHOD xTB', '      &XTB', ...(o.method === 'GFN1-xTB' ? ['        GFN_TYPE 1'] : ['        GFN_TYPE TBLITE', '        &TBLITE', '          METHOD GFN2', '        &END TBLITE']), '      &END XTB', '    &END QS']
      : ['    BASIS_SET_FILE_NAME BASIS_MOLOPT', '    POTENTIAL_FILE_NAME GTH_POTENTIALS', '    &MGRID', '      CUTOFF 400', '      REL_CUTOFF 50', '    &END MGRID', '    &XC', '      &XC_FUNCTIONAL PBE', '      &END XC_FUNCTIONAL', ...(o.d3 ? ['      &VDW_POTENTIAL', '        POTENTIAL_TYPE PAIR_POTENTIAL', '        &PAIR_POTENTIAL', '          TYPE DFTD3(BJ)', '          PARAMETER_FILE_NAME dftd3.dat', '          REFERENCE_FUNCTIONAL PBE', '        &END PAIR_POTENTIAL', '      &END VDW_POTENTIAL'] : []), '    &END XC', '    &POISSON', '      PERIODIC NONE', '      POISSON_SOLVER MT', '    &END POISSON'];
    const L = ['&GLOBAL', `  PROJECT ${o.name}`, `  RUN_TYPE ${run}`, '  PRINT_LEVEL LOW', '&END GLOBAL', '&FORCE_EVAL', '  METHOD QS', '  &DFT',
      `    CHARGE ${o.charge}`, `    MULTIPLICITY ${o.mult}`, ...(o.open ? ['    UKS'] : []), ...dft,
      '    &SCF', '      MAX_SCF 100', '      EPS_SCF 1.0E-6', '      SCF_GUESS ATOMIC', '    &END SCF', '  &END DFT', '  &SUBSYS', '    &CELL', `      ABC ${box.join(' ')}`, ...(xtb ? [] : ['      PERIODIC NONE']), '    &END CELL',
      '    &COORD', coordLines(atoms, '      '), '    &END COORD', '    &TOPOLOGY', '      &CENTER_COORDINATES', '      &END CENTER_COORDINATES', '    &END TOPOLOGY',
      ...kinds.flatMap((k) => (xtb ? [] : [`    &KIND ${k}`, '      BASIS_SET DZVP-MOLOPT-SR-GTH', `      POTENTIAL GTH-PBE-q${valence(k)}`, `    &END KIND`])),
      '  &END SUBSYS', '&END FORCE_EVAL', ''];
    if (!xtb && kinds.some((k) => !valence(k))) notes.push('有元素的 GTH 价电子数这里没收录，POTENTIAL 那一行要按 GTH_POTENTIALS 文件手改。');
    return { supported: true, text: L.join('\n'), filename: `${o.name}.inp`, run: `cp2k.psmp -i ${o.name}.inp -o ${o.name}.out`, notes };
  };
  // GTH-PBE 赝势的价电子数（只收常见的主族与第一过渡系；没有的返回 0）
  const Q = { H: 1, He: 2, Li: 3, Be: 4, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8, Na: 9, Mg: 10, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8, K: 9, Ca: 10, Ti: 12, V: 13, Cr: 14, Mn: 15, Fe: 16, Co: 17, Ni: 18, Cu: 11, Zn: 12, Br: 7, I: 7 };
  function valence(el) { return Q[el] || 0; }

  GEN.ase = (atoms, o) => {
    const notes = [];
    const meth = METHODS[o.method]?.kind === 'xtb' && o.method !== 'GFN-FF' ? o.method : 'GFN2-xTB';
    if (meth !== o.method) notes.push(`ASE 这里接的是 tblite 的 ${meth}（pip install tblite[ase]）；要用 DFT 请看 PySCF 或 Psi4 标签。`);
    const L = ['from ase import Atoms', 'from tblite.ase import TBLite', ''];
    if (o.opt) L.push('from ase.optimize import BFGS');
    if (o.freq) L.push('from ase.vibrations import Vibrations');
    L.push('', `symbols = ${JSON.stringify(atoms.map((a) => a.el))}`, 'positions = [', ...atoms.map((a) => `    (${f(a.x)}, ${f(a.y)}, ${f(a.z)}),`), ']', 'atoms = Atoms(symbols=symbols, positions=positions)  # in Å', '');
    L.push(`atoms.calc = TBLite(method="${meth}", charge=${o.charge}, multiplicity=${o.mult}${o.solvent ? ', alpb_solvation="water"' : ''})`);
    if (o.opt) L.push(`BFGS(atoms, trajectory="${o.name}-opt.traj").run(fmax=0.01)`);
    L.push('print("Energy / eV:", atoms.get_potential_energy())');
    if (o.freq) L.push(`vib = Vibrations(atoms, name="${o.name}-vib")`, 'vib.run()', 'vib.summary()');
    if (o.solvent) notes.push('alpb_solvation 要 tblite 0.4 以上。');
    return { supported: true, text: L.join('\n') + '\n', filename: `${o.name}_ase.py`, run: `python ${o.name}_ase.py`, notes };
  };

  /** QCSchema（MolSSI，https://github.com/MolSSI/QCSchema）：坐标用 bohr。优化任务导出 qcschema_optimization_input。 */
  GEN.qcschema = (atoms, o) => {
    const molecule = {
      schema_name: 'qcschema_molecule', schema_version: 2,
      symbols: atoms.map((a) => a.el),
      geometry: atoms.flatMap((a) => [a.x, a.y, a.z].map((v) => +(v / BOHR_ANGSTROM).toFixed(8))),
      molecular_charge: o.charge, molecular_multiplicity: o.mult,
    };
    const model = o.kind === 'xtb' ? { method: o.method.toLowerCase() } : { method: o.kind === 'hf' ? 'hf' : o.method.toLowerCase() + (o.d3 && o.kind === 'dft' ? '-d3bj' : ''), basis: o.basis };
    const keywords = o.open ? { reference: o.kind === 'dft' ? 'uks' : 'uhf' } : {};
    const notes = ['坐标单位是 bohr（1 bohr = 0.529177210903 Å，CODATA 2018）。可以交给 QCEngine：qcng.compute(json, "psi4")。'];
    if (o.solvent) notes.push('QCSchema 没有统一的溶剂字段，溶剂要写进各程序的 keywords。');
    let doc;
    if (o.opt) {
      doc = { schema_name: 'qcschema_optimization_input', schema_version: 1, initial_molecule: molecule, input_specification: { driver: 'gradient', model, keywords }, keywords: { program: o.kind === 'xtb' ? 'xtb' : 'psi4' } };
      notes.push('优化输入交给 QCEngine 的优化器：qcng.compute_procedure(json, "geometric")。' + (o.freq ? '频率要在优化后另交一个 driver 为 hessian 的输入。' : ''));
    } else {
      doc = { schema_name: 'qcschema_input', schema_version: 1, molecule, driver: o.freq ? 'hessian' : 'energy', model, keywords };
    }
    return { supported: true, text: JSON.stringify(doc, null, 2) + '\n', filename: `${o.name}.qcschema.json`, run: '', notes };
  };

  const PROGRAMS = [
    ['pyscf', 'PySCF'], ['psi4', 'Psi4'], ['xtb', 'xTB'], ['crest', 'CREST'], ['orca', 'ORCA'], ['gaussian', 'Gaussian'],
    ['nwchem', 'NWChem'], ['cp2k', 'CP2K'], ['ase', 'ASE'], ['qcschema', 'QCSchema'],
  ];

  /** 生成一个程序的输入。atoms 来自 parseXYZ；opts 见 norm()。 */
  function generate(program, atoms, opts) {
    const g = GEN[program];
    if (!g) return nope(`不认识的程序 ${program}`);
    if (!atoms || !atoms.length) return nope('先给一个分子');
    return g(atoms, norm(opts));
  }

  // ── 读输出 ────────────────────────────────────────────────────────────
  const num = (s) => Number(String(s).replace(/D/i, 'E'));
  const all = (re, t) => [...t.matchAll(re)];
  const last = (arr) => arr[arr.length - 1];

  function detect(t) {
    // 先认横幅很独特的三个：CP2K 跑 xTB 时输出里也有 “xTB” 和 “Eh”，要排在 xTB 前面
    if (/CP2K\|\s+version string|\[ABORT\][\s\S]*Routine Calling Stack|\*\*\*\* \*\*\*\* \*\*\*\*\*\*\s+\*\*\s+PROGRAM STARTED AT|ENERGY\| Total FORCE_EVAL/.test(t)) return 'cp2k';
    if (/Northwest Computational Chemistry Package|NWChem Input Module|Total times\s+cpu:/.test(t)) return 'nwchem';
    if (/Welcome to Q-Chem|Q-Chem, Inc\.|Thank you very much for using Q-Chem|Total energy in the final basis set/.test(t)) return 'qchem';
    if (/\bx\s?T\s?B\b|xtb version|\|\s+TOTAL ENERGY\s+-?\d/.test(t) && /Eh/.test(t)) return 'xtb';
    if (/O\s+R\s+C\s+A|FINAL SINGLE POINT ENERGY|ORCA TERMINATED/.test(t)) return 'orca';
    if (/Psi4: An Open-Source Ab Initio|Psi4 exiting|@\w*-?[RU](?:HF|KS) Final Energy/.test(t)) return 'psi4';
    if (/Entering Gaussian System|Gaussian, Inc\.|SCF Done:\s+E\(/.test(t)) return 'gaussian';
    if (/converged SCF energy\s*=|PySCF|SCF not converged/.test(t)) return 'pyscf';
    return '';
  }

  /** 从 Gaussian 一行特征值里取数：它的定宽格式会把负数连在一起（-10.12345-10.23456）。 */
  const floats = (s) => (String(s).match(/-?\d+\.\d+/g) || []).map(Number);
  /** 带指数的数（CP2K 的 1.5771062461E+03、NWChem 的 -4.989594D-01）。 */
  const sci = (s) => (String(s).match(/-?\d+\.\d+(?:[ED][+-]?\d+)?/gi) || []).map(num);
  /** 由各自旋的占据和空轨道能量（hartree）算能隙（eV）：HOMO 取最高的占据轨道，LUMO 取最低的空轨道。 */
  /** 两种标记（比如“收敛了”和“没收敛”）哪个在后面就按哪个：一个文件里有好几次优化时，看最后一次。都没有是 null。 */
  function laterOf(t, yes, no) {
    const y = last(all(yes, t)), n = last(all(no, t));
    if (!y && !n) return null;
    return !n || (!!y && y.index > n.index);
  }
  function gapOf(spins, r) {
    const occ = spins.flatMap((x) => x.occ), vir = spins.flatMap((x) => x.vir);
    if (!occ.length || !vir.length) return;
    r.gap = (Math.min(...vir) - Math.max(...occ)) * HARTREE_EV;
    if (spins.length > 1) r.gapNote = '开壳层：HOMO 取 α、β 里较高的一个，LUMO 取较低的一个';
  }

  const PARSE = {};
  PARSE.xtb = (t, r) => {
    const e = last(all(/TOTAL ENERGY\s+(-?\d+\.\d+)\s+Eh/g, t));
    if (e) { r.energy = num(e[1]); r.energyLabel = 'GFN-xTB 总能量'; }
    const g = last(all(/HOMO-LUMO GAP\s+(-?\d+\.\d+)\s+eV/g, t));
    if (g) r.gap = num(g[1]);
    if (/GEOMETRY OPTIMIZATION CONVERGED/.test(t)) r.optConverged = true;
    if (/FAILED TO CONVERGE GEOMETRY OPTIMIZATION/.test(t)) r.optConverged = false;
    if (/SCC not converged|Self consistent charge iterator did not converge/i.test(t)) r.scfConverged = false;
    // 频率段：“projected vibrational frequencies” 后面若干行 “eigval :  …”；前 6（线性分子 5）个是平动转动，接近 0
    const fb = /projected vibrational frequencies[^\n]*\n([\s\S]*?)(?:\n\s*\n|reduced masses)/.exec(t);
    if (fb) r.freqs = all(/eigval\s*:\s*([^\n]+)/g, fb[1]).flatMap((m) => floats(m[1])).filter((v) => Math.abs(v) > 1e-3);
    r.normal = /normal termination of xtb/.test(t) ? true : /abnormal termination|\[ERROR\]/i.test(t) ? false : null;
  };
  PARSE.orca = (t, r) => {
    const e = last(all(/FINAL SINGLE POINT ENERGY\s+(-?\d+\.\d+)/g, t));
    if (e) { r.energy = num(e[1]); r.energyLabel = 'FINAL SINGLE POINT ENERGY'; }
    if (/SCF NOT CONVERGED|SCF CONVERGENCE FAILURE/i.test(t)) r.scfConverged = false;
    else if (/SCF CONVERGED AFTER/.test(t)) r.scfConverged = true;
    if (/THE OPTIMIZATION HAS CONVERGED/.test(t)) r.optConverged = true;
    else if (/The optimization did not converge|OPTIMIZATION DID NOT CONVERGE/i.test(t)) r.optConverged = false;
    const vb = last(all(/VIBRATIONAL FREQUENCIES\s*\n-+\n([\s\S]*?)(?:\n\s*\n\s*\n|NORMAL MODES)/g, t));
    if (vb) r.freqs = all(/^\s*\d+:\s+(-?\d+\.\d+)\s+cm\*\*-1/gm, vb[1]).map((m) => num(m[1])).filter((v) => Math.abs(v) > 1e-3);
    const ob = last(all(/ORBITAL ENERGIES\s*\n-+\n([\s\S]*?)(?:\n\s*\n\s*\n|\*{5,}|MULLIKEN)/g, t));
    if (ob && !/SPIN UP/.test(ob[1])) {
      const rows = all(/^\s*\d+\s+(\d\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/gm, ob[1]).map((m) => ({ occ: num(m[1]), ev: num(m[3]) }));
      const occ = rows.filter((x) => x.occ > 0.5), vir = rows.filter((x) => x.occ < 0.5);
      if (occ.length && vir.length) r.gap = vir[0].ev - occ[occ.length - 1].ev;
    }
    r.normal = /ORCA TERMINATED NORMALLY/.test(t) ? true : /aborting the run|ORCA finished by error|error termination/i.test(t) ? false : null;
  };
  PARSE.psi4 = (t, r) => {
    const scf = last(all(/@\S*?(?:RHF|UHF|ROHF|RKS|UKS) Final Energy:\s+(-?\d+\.\d+)/g, t));
    const cct = last(all(/CCSD\(T\) total energy\s*=\s*(-?\d+\.\d+)/gi, t));
    const mp2At = Math.max(t.lastIndexOf('MP2 Energies'), t.lastIndexOf('MP2 Total Energy'));
    const mp2 = mp2At >= 0 ? /Total Energy[^=:\n]*[=:]\s*(-?\d+\.\d+)/.exec(t.slice(mp2At)) : null;
    if (cct) { r.energy = num(cct[1]); r.energyLabel = 'CCSD(T) total energy'; }
    else if (mp2) { r.energy = num(mp2[1]); r.energyLabel = 'MP2 Total Energy'; }
    else if (scf) { r.energy = num(scf[1]); r.energyLabel = 'SCF Final Energy'; }
    if (/Could not converge SCF iterations|SCF did not converge/i.test(t)) r.scfConverged = false;
    else if (scf) r.scfConverged = true;
    if (/Optimization is complete!/.test(t)) r.optConverged = true;
    else if (/Could not converge geometry optimization/i.test(t)) r.optConverged = false;
    const fr = all(/Freq \[cm\^-1\]\s+([^\n]+)/g, t).flatMap((m) => (m[1].match(/-?\d+\.\d+i?/g) || []).map((s) => (s.endsWith('i') ? -num(s.slice(0, -1)) : num(s))));
    if (fr.length) r.freqs = fr;
    const occB = last(all(/Doubly Occupied:\s*\n([\s\S]*?)(?:Singly Occupied:|Virtual:)/g, t));
    const virB = last(all(/Virtual:\s*\n([\s\S]*?)\n\s*\n\s*(?:Final Occupation|\S)/g, t));
    if (occB && virB && !/Alpha Occupied/.test(t)) {
      const vals = (s) => all(/\d+[A-Za-z][\w'"]*\s+(-?\d+\.\d+)/g, s).map((m) => num(m[1]));
      const o = vals(occB[1]), v = vals(virB[1]);
      if (o.length && v.length) r.gap = (Math.min(...v) - Math.max(...o)) * HARTREE_EV;
    }
    r.normal = /Psi4 exiting successfully/.test(t) ? true : /Psi4 encountered an error|PsiException|Traceback/.test(t) ? false : null;
  };
  PARSE.gaussian = (t, r) => {
    const e = last(all(/SCF Done:\s+E\((\S+)\)\s+=\s+(-?\d+\.\d+)/g, t));
    if (e) { r.energy = num(e[2]); r.energyLabel = `SCF Done: E(${e[1]})`; }
    const mp2 = last(all(/EUMP2\s*=\s*(-?\d+\.\d+D[+-]\d+)/g, t));
    const cc = last(all(/CCSD\(T\)\s*=\s*(-?\d+\.\d+D[+-]\d+)/g, t));
    if (cc) { r.energy = num(cc[1]); r.energyLabel = 'CCSD(T)'; } else if (mp2) { r.energy = num(mp2[1]); r.energyLabel = 'EUMP2'; }
    if (/Convergence failure -- run terminated|>>>>>>>>>> Convergence criterion not met/.test(t)) r.scfConverged = false;
    else if (e) r.scfConverged = true;
    if (/Optimization completed\.|-- Stationary point found\./.test(t)) r.optConverged = true;
    else if (/Optimization stopped\.|Number of steps exceeded/.test(t)) r.optConverged = false;
    const fr = all(/Frequencies --\s+([^\n]+)/g, t).flatMap((m) => floats(m[1]));
    if (fr.length) r.freqs = fr;
    // 取最后一组 Alpha 特征值（hartree）；开壳层只看 alpha 会偏，标出来
    const blocks = t.split(/The electronic state is|Population analysis using the SCF/).slice(-1)[0];
    const occ = all(/Alpha\s+occ\. eigenvalues --([^\n]+)/g, blocks).flatMap((m) => floats(m[1]));
    const vir = all(/Alpha virt\. eigenvalues --([^\n]+)/g, blocks).flatMap((m) => floats(m[1]));
    if (occ.length && vir.length) { r.gap = (vir[0] - occ[occ.length - 1]) * HARTREE_EV; if (/Beta\s+occ\./.test(blocks)) r.warnings.push('开壳层：能隙只按 alpha 轨道算。'); }
    r.normal = /Normal termination of Gaussian/.test(t) && !/Error termination/.test(t.split(/Normal termination of Gaussian/).slice(-1)[0]) ? true : /Error termination/.test(t) ? false : null;
  };
  PARSE.pyscf = (t, r) => {
    const scf = last(all(/converged SCF energy\s*=\s*(-?\d+\.\d+)/g, t));
    const ccsdt = last(all(/E\(CCSD\(T\)\)\s*=\s*(-?\d+\.\d+)/g, t));
    const ccsd = last(all(/E\(CCSD\)\s*=\s*(-?\d+\.\d+)/g, t));
    const mp2 = last(all(/E\(MP2\)\s*=\s*(-?\d+\.\d+)/g, t));
    const pick = ccsdt ? [ccsdt, 'E(CCSD(T))'] : ccsd ? [ccsd, 'E(CCSD)'] : mp2 ? [mp2, 'E(MP2)'] : scf ? [scf, 'converged SCF energy'] : null;
    if (pick) { r.energy = num(pick[0][1]); r.energyLabel = pick[1]; }
    if (/SCF not converged/.test(t)) r.scfConverged = false;
    else if (scf) r.scfConverged = true;
    if (/Geometry optimization converged|geometric-optimize.*Converged|Converged! =D/.test(t)) r.optConverged = true;
    const hl = last(all(/HOMO\s*=\s*(-?\d+\.\d+)\s+LUMO\s*=\s*(-?\d+\.\d+)/g, t));
    if (hl) r.gap = (num(hl[2]) - num(hl[1])) * HARTREE_EV;
    if (/Traceback \(most recent call last\)/.test(t)) r.normal = false;
  };

  // NWChem（7.2.2 实跑核对）：SCF / DFT / MP2 / CCSD(T) / TCE 的能量，“Optimization converged”，
  // 投影后的频率（P.Frequency，虚频是负数，前 6 个平动转动约为 0），最后一次 “Molecular Orbital Analysis” 里的轨道能量。
  // 能量只看最后一个算出能量的 task（先粗优化再精算、优化完再算单点）。数值差分会在一个个位移结构上各算一次能量，
  // 最后一个不是这个结构的：优化取最后一行 “@ 步数 能量” 那一次，有限差分 Hessian 和数值梯度取头一次（参考结构）。
  const NW_E = [
    [/CCSD\(T\) total energy \/ hartree\s*=\s*(-?\d+\.\d+)/g, () => 'CCSD(T) total energy (TCE)'],
    [/Total CCSD\(T\) energy:\s*(-?\d+\.\d+)/g, () => 'Total CCSD(T) energy'],
    [/CCSD total energy \/ hartree\s*=\s*(-?\d+\.\d+)/g, () => 'CCSD total energy (TCE)'],
    [/Total CCSD energy:\s*(-?\d+\.\d+)/g, () => 'Total CCSD energy'],
    [/Total MP2 energy:?\s+(-?\d+\.\d+)/g, () => 'Total MP2 energy'],
    [/Total (SCF|DFT) energy =\s+(-?\d+\.\d+)/g, (m) => `Total ${m[1]} energy`],
  ];
  function nwEnergy(t) {
    // 每个 task 开始时 NWChem 都重新读一次输入，印一行 “NWChem Input Module”（“Task times” 在打印级别低时没有）
    const seg = t.split(/^\s*NWChem Input Module\s*$/m).reverse().find((s) => NW_E.some(([re]) => all(re, s).length));
    if (!seg) return null;
    const [re, label] = NW_E.find(([x]) => all(x, seg).length);
    const val = (m) => num(m[m.length - 1]);
    const hits = all(re, seg);
    let m = last(hits);
    const steps = all(/^@\s+\d+\s+(-?\d+\.\d+)/gm, seg);
    const fd = last(all(/NWChem (?:Finite-difference Hessian|Numerical Gradients Module)/g, seg));
    if (steps.length) { // 优化：“@” 那一行只有 8 位小数，找和它对得上的那一次，取完整的位数
      const at = num(last(steps)[1]);
      m = [...hits].reverse().find((h) => Math.abs(val(h) - at) < 6e-9);
      if (!m) return { energy: at, label: `${label(last(hits))} (@ ${last(steps)[0].trim().split(/\s+/)[1]})` };
    } else if (fd) m = hits.find((h) => h.index > fd.index) || m;
    return { energy: val(m), label: label(m) };
  }
  PARSE.nwchem = (t, r) => {
    const e = nwEnergy(t);
    if (e) { r.energy = e.energy; r.energyLabel = e.label; }
    if (/Calculation failed to converge/.test(t)) r.scfConverged = false;
    else if (/Total (?:SCF|DFT) energy =/.test(t)) r.scfConverged = true;
    r.optConverged = laterOf(t, /^\s*Optimization converged\s*$/gm, /Failed to converge in maximum number of steps/g);
    const fr = all(/^\s*P\.Frequency\s+([^\n]+)/gm, t.split(/\(Projected Frequencies expressed in cm-1\)/).slice(-1)[0]).flatMap((m) => sci(m[1]));
    if (fr.length) r.freqs = fr.filter((v) => Math.abs(v) > 1e-3);
    const heads = all(/(?:^|\n)\s*(?:\S+ )?Final (Alpha |Beta )?Molecular Orbital Analysis/g, t);
    const lastHead = last(heads);
    if (lastHead) {
      const blocks = lastHead[1] === 'Beta ' && heads.length > 1 ? heads.slice(-2) : [lastHead];
      gapOf(blocks.map((h) => {
        const seg = t.slice(h.index + h[0].length).split(/\n\s*(?:\S+ )?Final (?:Alpha |Beta )?Molecular Orbital Analysis|\n\s*center of mass|\n\s*Task\s+times/)[0];
        const v = all(/Vector\s+\d+\s+Occ=\s*(\S+)\s+E=\s*(\S+)/g, seg).map((m) => ({ occ: num(m[1]), e: num(m[2]) }));
        return { occ: v.filter((x) => x.occ > 0.5).map((x) => x.e), vir: v.filter((x) => x.occ < 0.5).map((x) => x.e) };
      }), r);
    }
    r.normal = /There is an error in the input file|ARMCI Error|MPI_ABORT|\b(?:energy|optimize|freq|gradient) failed\b/.test(t) ? false : /^\s*Total times\s+cpu:/m.test(t) ? true : null;
    // 报错那一段：两行横线之间的一句话（后面跟一个数字），再往下是 “current input line”
    const er = /-{20,}\n\s*(\S[^\n]*?)\s+-?\d+\s*\n\s*-{20,}\n\s*-{20,}\n\s*current input line/.exec(t);
    if (er) r.errorText = er[1].trim();
  };
  // CP2K（2026.2 实跑核对；7.x 以前写的是 “energy (a.u.):”）：每一步的 “ENERGY| Total FORCE_EVAL” 取最后一个；SCF 和几何优化的收敛；
  // VIBRATIONAL_ANALYSIS 的 “VIB|Frequency”（科学计数法，虚频是负数）。默认输出里没有 HOMO–LUMO 能隙，不读。
  PARSE.cp2k = (t, r) => {
    const e = last(all(/ENERGY\| Total FORCE_EVAL \( \w+ \) energy [[(](?:a\.u\.|hartree)[\])]:?\s+(-?\d+\.\d+)/g, t));
    if (e) { r.energy = num(e[1]); r.energyLabel = 'ENERGY| Total FORCE_EVAL'; }
    if (/SCF run NOT converged/.test(t)) r.scfConverged = false;
    else if (/SCF run converged in/.test(t)) r.scfConverged = true;
    r.optConverged = laterOf(t, /GEOMETRY OPTIMIZATION COMPLETED/g, /MAXIMUM NUMBER OF OPTIMIZATION STEPS REACHED/g);
    const fr = all(/VIB\|Frequency \(cm\^-1\)\s+([^\n]+)/g, t).flatMap((m) => sci(m[1]));
    if (fr.length) r.freqs = fr;
    if (!e && fr.length) r.energyHint = 'CP2K 的振动分析把各个位移点的能量写在 PROJECT-r-0.out 这类副本文件里，主输出里没有总能量。';
    r.normal = /\[ABORT\]/.test(t) ? false : /PROGRAM ENDED AT/.test(t) ? true : null;
    // [ABORT] 框里的话：去掉框线、小人和源文件位置
    const ab = /\[ABORT\][^\n]*\n((?:[^\n]*\n){1,8}?)\s*\*{20,}/.exec(t);
    if (ab) r.errorText = ab[1].split('\n').map((l) => l.replace(/^\s*\*\s?/, '').replace(/\*\s*$/, '').replace(/^\s*(?:\\___\/|\||O\/\||\/\| \||\/ \\)/, '').replace(/\S+\.F:\d+\s*$/, '').trim()).filter(Boolean).join(' ');
  };
  // Q-Chem（5.4 和 6.0 的真实输出，cclib 回归数据，BSD-3）：最后一个 “Total energy in the final basis set”，
  // MP2 / MP3 / MP4 / CCSD / CCSD(T) 优先；“OPTIMIZATION CONVERGED”；“Frequency:” 行（虚频是负数）；
  // 最后一组 “Orbital Energies” 里 Alpha 和 Beta 的 Occupied / Virtual（a.u.，只有三位小数）。
  // 能量只看最后一个算出能量的 job（多个 job 的输入用 @@@ 隔开），有限差分（“Starting / Finishing finite difference”）里的位移结构不算。
  const QC_E = [
    [/CCSD\(T\) total energy\s*=\s*(-?\d+\.\d+)/g, 'CCSD(T) total energy'],
    [/CCSD total energy\s*=\s*(-?\d+\.\d+)/g, 'CCSD total energy'],
    [/^\s*EMP4\s*=\s*(-?\d+\.\d+)/gm, 'EMP4'],
    [/^\s*EMP4SDQ\s*=\s*(-?\d+\.\d+)/gm, 'EMP4SDQ'],
    [/CCD total energy\s*=\s*(-?\d+\.\d+)/g, 'CCD total energy'],
    [/^\s*MP3 energy\s*=\s*(-?\d+\.\d+)/gm, 'MP3 energy'],
    [/^\s*EMP3\s*=\s*(-?\d+\.\d+)/gm, 'EMP3'],
    [/RI-MP2 TOTAL ENERGY\s*=\s*(-?\d+\.\d+)/g, 'RI-MP2 TOTAL ENERGY'],
    [/MP2\s+total energy\s*=\s*(-?\d+\.\d+)/g, 'MP2 total energy'],
    [/^\s*MP2 energy\s*=\s*(-?\d+\.\d+)/gm, 'MP2 energy'],
    [/^\s*EMP2\s*=\s*(-?\d+\.\d+)/gm, 'EMP2'],
    [/Total energy in the final basis set\s*=\s*(-?\d+\.\d+)/g, 'Total energy in the final basis set'],
  ];
  PARSE.qchem = (t, r) => {
    const job = t.split(/\n[^\n]*Welcome to Q-Chem/).map((s) => s.replace(/# Starting finite difference calculation[\s\S]*?(?:# Finishing finite difference calculation|$)/g, ''))
      .reverse().find((s) => QC_E.some(([re]) => all(re, s).length));
    const pick = job && QC_E.map(([re, label]) => [last(all(re, job)), label]).find(([m]) => m);
    if (pick) { r.energy = num(pick[0][1]); r.energyLabel = pick[1]; }
    else if (/# Starting finite difference calculation/.test(t)) r.energyHint = 'Q-Chem 的这个任务是有限差分（一系列位移结构或外加电场下的能量），没有单独印出未扰动的能量；要能量请另算一次单点。';
    if (/SCF failed to converge|Convergence failure/.test(t)) r.scfConverged = false;
    else if (/Total energy in the final basis set/.test(t)) r.scfConverged = true;
    r.optConverged = laterOf(t, /\*\*\s+OPTIMIZATION CONVERGED\s+\*\*/g, /MAXIMUM OPTIMIZATION CYCLES REACHED/g);
    // 只看最后一段振动分析（VPT2 非谐计算会把谐振频率再印一遍）
    const fr = all(/^\s*Frequency:\s+([^\n]+)/gm, t.split(/\*\*\s+VIBRATIONAL ANALYSIS\s+\*\*/).slice(-1)[0]).flatMap((m) => floats(m[1]));
    if (fr.length) r.freqs = fr;
    const ob = last(all(/Orbital Energies \(a\.u\.\)[^\n]*\n\s*-+\n([\s\S]*?)\n\s*-{20,}/g, t));
    if (ob) {
      const spins = ob[1].split(/(?:Alpha|Beta) MOs/).slice(1).map((b) => {
        const [occ = '', vir = ''] = b.split(/-- Virtual --/);
        return { occ: floats(occ.split(/-- Occupied --/)[1] || ''), vir: floats(vir) };
      });
      gapOf(/Restricted/.test(ob[1]) ? spins.slice(0, 1) : spins, r);
    }
    r.normal = /Q-Chem fatal error occurred/.test(t) ? false : /Thank you very much for using Q-Chem/.test(t) ? true : null;
    const fe = /Q-Chem fatal error occurred[^\n]*\n\s*\n?\s*(\S[^\n]*)/.exec(t);
    if (fe) r.errorText = fe[1].trim();
  };

  /** 读一段输出，返回 { program, energy(Eh), energyEV, energyLabel, normal, scfConverged, optConverged, gap(eV), freqs, imaginary, warnings }。 */
  function parseOutput(text, program) {
    const t = String(text || '').replace(/\r/g, '');
    const p = program || detect(t);
    const r = { program: p, energy: null, energyLabel: '', normal: null, scfConverged: null, optConverged: null, gap: null, gapNote: '', errorText: '', freqs: [], imaginary: [], warnings: [] };
    if (!p) { r.warnings.push('认不出是哪个程序的输出（支持 xTB、ORCA、Psi4、Gaussian、PySCF、NWChem、CP2K、Q-Chem）'); return r; }
    PARSE[p](t, r);
    r.energyEV = r.energy === null ? null : r.energy * HARTREE_EV;
    r.imaginary = r.freqs.filter((v) => v < 0);
    if (r.imaginary.length === 1) r.warnings.push(`有 1 个虚频（${r.imaginary[0].toFixed(1)} cm⁻¹）：如果找的是过渡态，这是对的；如果找的是极小点，结构还没到底。`);
    else if (r.imaginary.length > 1) r.warnings.push(`有 ${r.imaginary.length} 个虚频：这不是极小点，也不是一阶鞍点，要重新优化。`);
    const small = r.imaginary.filter((v) => v > -50);
    if (small.length && small.length === r.imaginary.length) r.warnings.push('虚频都很小（不到 50 cm⁻¹），常是积分格点或收敛标准太松引起的数值噪声。');
    if (r.scfConverged === false) r.warnings.push('SCF 没有收敛，能量不能用。');
    if (r.optConverged === false) r.warnings.push('结构优化没有收敛。');
    if (r.normal === false) r.warnings.push(r.errorText ? `程序没有正常结束，报错是：${r.errorText}` : '程序没有正常结束。');
    if (r.energy === null) r.warnings.push(r.energyHint || '没找到最终能量。');
    delete r.energyHint;
    return r;
  }

  /** 两个能量（Eh）之差换成常用单位。 */
  function energyDiff(e1, e2) {
    const d = e2 - e1;
    return { hartree: d, ev: d * HARTREE_EV, kcal: d * HARTREE_KCAL, kj: d * HARTREE_KCAL * 4.184 };
  }

  // ── 许可证 ────────────────────────────────────────────────────────────
  // 用法：link 只放链接或推荐；web 把代码放进 MolAstria 网站（发给每个浏览器，算分发）；desktop 打包进桌面版；
  // service 只在自己的服务器上运行、不分发；call 作为独立程序调用（命令行、子进程）。
  const USES = [['link', '只放链接或推荐'], ['web', '把代码放进网站'], ['desktop', '打包进桌面版'], ['service', '在自己的服务器上运行'], ['call', '作为独立程序调用']];
  const FAMILY = {
    permissive: { v: { link: 'ok', web: 'ok', desktop: 'ok', service: 'ok', call: 'ok' }, why: '宽松许可：保留版权和许可声明就行。' },
    apache: { v: { link: 'ok', web: 'ok', desktop: 'ok', service: 'ok', call: 'ok' }, why: 'Apache-2.0：保留版权、许可和 NOTICE 文件，改过的文件要注明；带明确的专利授权。' },
    mpl: { v: { link: 'ok', web: 'cond', desktop: 'cond', service: 'ok', call: 'ok' }, why: 'MPL-2.0 是文件级 copyleft：原样放成单独的文件可以和 MIT 代码一起发布，改过的那些文件要继续按 MPL 公开。' },
    lgpl: { v: { link: 'ok', web: 'cond', desktop: 'cond', service: 'ok', call: 'ok' }, why: 'LGPL：作为单独的库调用可以，库本身的改动要按 LGPL 公开，并让用户能换掉这个库；不能把它的代码抄进 MIT 文件。' },
    gpl: { v: { link: 'ok', web: 'no', desktop: 'no', service: 'ok', call: 'cond' }, why: 'GPL：把它的代码放进网站或桌面版就是分发衍生作品，整个作品要按 GPL 发布，和 MolAstria 的 MIT 冲突；只在服务器上运行不算分发；作为独立程序调用、各自分开发布一般可以，但一起分发时要附上它的源码。' },
    agpl: { v: { link: 'ok', web: 'no', desktop: 'no', service: 'cond', call: 'cond' }, why: 'AGPL：和 GPL 一样不能进 MIT 的网站和桌面版；而且用户经网络使用改过的版本时，也要向他们提供源码。' },
    ccby: { v: { link: 'ok', web: 'ok', desktop: 'ok', service: 'ok', call: 'ok' }, why: 'CC BY：署名就能用（适合文字、图片和数据，不太适合代码）。' },
    ccbysa: { v: { link: 'ok', web: 'cond', desktop: 'cond', service: 'ok', call: 'ok' }, why: 'CC BY-SA：署名，改编后的内容要按同样的许可发布。' },
    nc: { v: { link: 'ok', web: 'no', desktop: 'no', service: 'no', call: 'no' }, why: '非商业（NC）：MolAstria 有 Pro 收费，算商业使用，只能链接。' },
    none: { v: { link: 'ok', web: 'no', desktop: 'no', service: 'no', call: 'no' }, why: '没有许可证不等于公有领域：默认保留所有权利，只能链接，思路可以借鉴、代码要自己写。' },
    proprietary: { v: { link: 'ok', web: 'no', desktop: 'no', service: 'no', call: 'cond' }, why: '商业或自定义许可：按它自己的条款，一般只能链接，或让用户自己装授权版本再调用。' },
  };

  /** 把各种写法（SPDX、PyPI 分类器、“MIT License”）归到一族。 */
  function licenceFamily(raw) {
    const s = String(raw || '').trim();
    if (!s || /^(NOASSERTION|NONE|UNKNOWN|UNLICENSED|null)$/i.test(s)) return 'none';
    const parts = (op) => { // 只在最外层（括号外）按 AND / OR 拆
      const out = []; let depth = 0, cur = '';
      for (const tok of s.split(/(\(|\)|\s+)/).filter((x) => x !== undefined && x !== '')) {
        if (tok === '(') depth++;
        if (tok === ')') depth--;
        if (depth === 0 && tok === op) { out.push(cur); cur = ''; } else cur += tok;
      }
      out.push(cur);
      return out.map((x) => x.trim()).filter(Boolean);
    };
    const strip = (x) => (/^\(.*\)$/.test(x) ? x.slice(1, -1) : x);
    const and = parts('AND');
    if (and.length > 1) return and.map((x) => licenceFamily(strip(x))).sort((a, b) => RANK.indexOf(b) - RANK.indexOf(a))[0]; // 都要满足：取最严
    const or = parts('OR');
    if (or.length > 1) return or.map((x) => licenceFamily(strip(x))).sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0]; // 任选其一：取最宽松
    if (/^\(.*\)$/.test(s)) return licenceFamily(s.slice(1, -1));
    const t = s.replace(/^License :: (OSI Approved :: )?/i, '');
    if (/\bNC\b|NonCommercial/i.test(t)) return 'nc';
    if (/AGPL|Affero/i.test(t)) return 'agpl';
    if (/LGPL|Lesser General Public/i.test(t)) return 'lgpl';
    if (/GPL|General Public License/i.test(t)) return 'gpl';
    if (/MPL|Mozilla/i.test(t)) return 'mpl';
    if (/Apache/i.test(t)) return 'apache';
    if (/CC[- ]BY[- ]SA|ShareAlike/i.test(t)) return 'ccbysa';
    if (/^CC[- ]BY\b|Creative Commons Attribution/i.test(t)) return 'ccby';
    if (/\b(MIT|BSD|ISC|Zlib|Unlicense|0BSD|CC0|PSF|Python Software Foundation|Python-2\.0|Public Domain|BSL-1\.0|Boost)\b/i.test(t)) return 'permissive';
    if (/Proprietary|Commercial|EULA|Other\/Proprietary/i.test(t)) return 'proprietary';
    return 'none';
  }
  const RANK = ['permissive', 'apache', 'ccby', 'mpl', 'lgpl', 'ccbysa', 'gpl', 'agpl', 'proprietary', 'nc', 'none'];

  /** 一个许可证对每种用法的结论：{ family, verdicts:{use:'ok'|'cond'|'no'}, why }。 */
  function licenceVerdict(raw) {
    const fam = licenceFamily(raw);
    return { family: fam, verdicts: FAMILY[fam].v, why: FAMILY[fam].why };
  }

  // ── 代码搜索 ──────────────────────────────────────────────────────────
  // 计算化学的常用仓库，用于“只在计算化学项目里搜”。每个都在 GitHub 上核对过（2026-11-10）。
  const CHEM_REPOS = ['pyscf/pyscf', 'psi4/psi4', 'grimme-lab/xtb', 'tblite/tblite', 'crest-lab/crest', 'rdkit/rdkit', 'openbabel/openbabel', 'cclib/cclib', 'nwchemgit/nwchem', 'cp2k/cp2k', 'openmm/openmm', 'ACEsuit/mace', 'mir-group/nequip', 'MolSSI/QCElemental', 'MolSSI/QCEngine', 'MDAnalysis/mdanalysis'];
  const LANGS = { '': '', python: ['Python', 'python'], fortran: ['Fortran', 'fortran'], cpp: ['C++', 'c++'], c: ['C', 'c'], julia: ['Julia', 'julia'] };

  /** 一个查询词 → 各个代码搜索引擎的网址。lang 见 LANGS，chem 为 true 时只搜 CHEM_REPOS。 */
  function searchLinks(query, { lang = '', chem = false } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];
    const L = LANGS[lang] || '';
    const enc = encodeURIComponent;
    const gh = [q, L && `language:${L[0].includes(' ') || L[0].includes('+') ? `"${L[0]}"` : L[0]}`, chem && `(${CHEM_REPOS.map((r) => `repo:${r}`).join(' OR ')})`].filter(Boolean).join(' ');
    const sgRepo = chem ? ` repo:^github\\.com/(${CHEM_REPOS.map((r) => r.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')).join('|')})$` : '';
    const sg = `context:global ${q}${L ? ` lang:${L[1]}` : ''}${sgRepo}`;
    let grep = `https://grep.app/search?q=${enc(q)}`;
    if (L) grep += `&filter[lang][0]=${enc(L[0])}`;
    if (chem) CHEM_REPOS.forEach((r, i) => { grep += `&filter[repo][${i}]=${enc(r)}`; });
    return [
      { id: 'github', name: 'GitHub 代码搜索', url: `https://github.com/search?q=${enc(gh)}&type=code`, note: '要登录 GitHub' },
      { id: 'sourcegraph', name: 'Sourcegraph', url: `https://sourcegraph.com/search?q=${enc(sg)}&patternType=keyword`, note: '支持正则和符号' },
      { id: 'grep', name: 'grep.app', url: grep, note: '不用登录，搜 GitHub 上约一百万个仓库' },
      { id: 'swh', name: 'Software Heritage', url: `https://archive.softwareheritage.org/browse/search/?q=${enc(q)}&with_visit=true&with_content=true`, note: '按仓库网址关键词搜存档' },
      { id: 'debian', name: 'Debian Code Search', url: `https://codesearch.debian.net/search?q=${enc(q)}&literal=1`, note: 'Debian 打包的全部源码' },
    ];
  }

  // ── 软件体检：整理 PyPI 和 OSV 的返回 ──────────────────────────────────
  /** 包名规范（PEP 503）。 */
  const pypiName = (s) => String(s || '').trim().toLowerCase().replace(/[-_.]+/g, '-');
  /** 输入是包名还是仓库网址。 */
  function parseTarget(s) {
    const t = String(s || '').trim();
    const gh = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/i.exec(t);
    if (gh) return { kind: 'github', owner: gh[1], repo: gh[2], url: `https://github.com/${gh[1]}/${gh[2]}` };
    const gl = /^(?:https?:\/\/)?(?:www\.)?gitlab\.com\/([\w./-]+?)(?:\.git)?\/?$/i.exec(t);
    if (gl) return { kind: 'gitlab', path: gl[1], url: `https://gitlab.com/${gl[1]}` };
    if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(t)) return { kind: 'pypi', name: pypiName(t) };
    return { kind: '', error: '请输入 PyPI 包名（如 pyscf）或 GitHub 仓库网址' };
  }

  /** 从 PyPI 的 JSON（https://pypi.org/pypi/<名字>/json）里取要用的字段。 */
  function summarizePypi(j) {
    const info = (j && j.info) || {};
    const classifiers = (info.classifiers || []).filter((c) => c.startsWith('License ::')).map((c) => c.replace(/^License :: (OSI Approved :: )?/, ''));
    const short = (s) => (s && s.length < 80 && !/\n/.test(s) ? s : '');
    const licence = info.license_expression || short(info.license) || classifiers.join(' AND ') || '';
    const urls = { ...(info.project_urls || {}) };
    if (info.home_page) urls.Homepage = urls.Homepage || info.home_page;
    const repo = Object.values(urls).map((u) => parseTarget(u)).find((x) => x.kind === 'github' || x.kind === 'gitlab') || null;
    const files = (j && j.urls) || [];
    const uploaded = files.map((x) => x.upload_time_iso_8601 || x.upload_time).filter(Boolean).sort()[0] || '';
    return { name: info.name || '', version: info.version || '', summary: info.summary || '', licence, requiresPython: info.requires_python || '', urls, repo, released: uploaded.slice(0, 10), yanked: !!(files[0] && files[0].yanked) };
  }

  /** OSV（https://osv.dev）的 /v1/query 返回 → 漏洞列表。 */
  function summarizeOsv(j) {
    return ((j && j.vulns) || []).map((v) => ({
      id: v.id, aliases: (v.aliases || []).filter((a) => /^CVE-/.test(a)),
      summary: v.summary || (v.details || '').split('\n')[0].slice(0, 160),
      severity: (v.database_specific && v.database_specific.severity) || '',
      url: `https://osv.dev/vulnerability/${encodeURIComponent(v.id)}`,
    }));
  }

  const pure = {
    SYMBOLS, Z, BOHR_ANGSTROM, HARTREE_EV, HARTREE_KCAL, METHODS, BASES, BASIS_NAME, TASKS, TASK_LABEL, PROGRAMS, USES, CHEM_REPOS,
    element, parseXYZ, splitFrames, formula, checkSpin, generate, detect, parseOutput, energyDiff, licenceFamily, licenceVerdict, searchLinks,
    pypiName, parseTarget, summarizePypi, summarizeOsv,
  };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaCode = pure;
})(typeof window !== 'undefined' ? window : globalThis);
