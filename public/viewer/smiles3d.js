/* SMILES → 三维坐标：搭几个构象、补齐氢，用 MMFF94s+ 力场各自优化，按力场能量排序。
   用 OpenChemLib（BSD-3，https://github.com/cheminfo/openchemlib-js）的 ConformerGenerator（扭转角库）和 ForceFieldMMFF94，
   第一次用时从 jsDelivr 载入，版本写死（openchemlib.js 约 1.1 MB、resources.json 约 1.4 MB，未压缩）。
   计算放在 Web Worker 里，页面不会卡住；“停止”直接结束 Worker。不支持 module Worker 的浏览器就在页面里算。
   embed() 是纯函数，OCL 由调用者传入（浏览器里是 jsDelivr 的模块，node 里是 npm 的 openchemlib），tools/code-test.mjs 测它。
   返回的提示只给代号（warnings），中文说明由页面写，这样界面翻译照常起作用。
   用法：MolAstriaSmiles3D.run(smiles, { onProgress }) → Promise<结果>；MolAstriaSmiles3D.stop()；toXYZ(结果) 得到多帧 XYZ。 */
(function (root) {
  'use strict';

  const VERSION = '9.25.1';
  const BASE = `https://cdn.jsdelivr.net/npm/openchemlib@${VERSION}/dist/`;

  /** 纯函数：一个 SMILES → { frames:[{atoms:[{el,x,y,z}], energy}], charge, mult, … }，出错时 { error, … }。
      会被转成文本放进 Worker，所以只能用参数和自己里面定义的东西。 */
  function embed(OCL, smiles, opts, progress) {
    const o = Object.assign({ conformers: 8, seed: 1, maxHeavy: 100 }, opts || {});
    const M = OCL.Molecule;
    const smi = String(smiles || '').trim();
    if (!smi) return { error: 'empty' };
    if (/\s/.test(smi)) return { error: 'parse', detail: 'whitespace' };
    let mol;
    try { mol = M.fromSmiles(smi); } catch (e) { return { error: 'parse', detail: String((e && e.message) || e).replace(/^[\s\S]*?SmilesParser:\s*/, '') }; }
    const heavy = mol.getAllAtoms();
    if (!heavy) return { error: 'empty' };
    if (heavy > o.maxHeavy) return { error: 'big', heavy, max: o.maxHeavy };
    mol.ensureHelperArrays(M.cHelperParities);
    let charge = 0, unpaired = 0, hydrogens = 0, unspecified = 0;
    for (let i = 0; i < heavy; i++) {
      charge += mol.getAtomCharge(i);
      const r = mol.getAtomRadical(i);
      if (r === M.cAtomRadicalStateD) unpaired += 1;
      else if (r === M.cAtomRadicalStateT) unpaired += 2;
      hydrogens += mol.getImplicitHydrogens(i);
      if (mol.getAtomParity(i) === M.cAtomParityUnknown) unspecified++;
    }
    for (let b = 0; b < mol.getBonds(); b++) if (mol.getBondParity(b) === M.cBondParityUnknown) unspecified++;
    const total = heavy + hydrogens;
    const fragments = mol.getFragments().length;
    // 立体构型由三维坐标重新认一遍（去掉氢再比），用来确认每个构象都是同一个立体异构体
    const noH = (c) => { const m = M.fromMolfile(c.toMolfile()); m.removeExplicitHydrogens(); return m; };
    const stereoOf = (c) => noH(c).getIDCode(); // idcode 是规范的，带立体信息
    const warnings = [];
    let source = smi, fixed = '';
    try {
      if (unspecified) { // 没写构型：先搭一个，按它定下构型，后面的构象都用这一种
        const first = new OCL.ConformerGenerator(o.seed).getOneConformerAsMolecule(M.fromSmiles(smi));
        if (!first) return { error: 'embed' };
        fixed = noH(first).toIsomericSmiles();
        source = fixed;
        warnings.push('unspecified');
      }
      const target = M.fromSmiles(source).getIDCode();
      const stereoSmiles = fixed || smi; // 写进 XYZ 注释的：原样的 SMILES，或者补上构型的那一个
      // 力场在浏览器里算得慢（大约和原子数的平方成正比），大分子少搭几个构象、少迭代几步
      const want = Math.max(1, Math.min(o.conformers, total <= 40 ? 8 : total <= 80 ? 4 : total <= 150 ? 2 : 1));
      const maxIts = total > 100 ? 500 : 2000;
      const gen = new OCL.ConformerGenerator(o.seed);
      if (!gen.initializeConformers(M.fromSmiles(source))) return { error: 'embed' };
      const raw = [];
      let mismatched = 0;
      for (let k = 0; k < want * 3 && raw.length < want; k++) {
        const c = gen.getNextConformerAsMolecule(null);
        if (!c) break;
        if (stereoOf(c) !== target) { mismatched++; continue; }
        raw.push(c);
      }
      if (!raw.length) return { error: 'stereo' };
      if (mismatched) warnings.push('stereo-dropped');
      let ff = 'MMFF94s+';
      const frames = [];
      for (let k = 0; k < raw.length; k++) {
        if (progress) progress(k + 1, raw.length);
        const c = raw[k];
        let energy = null;
        if (ff) {
          try { const f = new OCL.ForceFieldMMFF94(c, 'MMFF94s+'); f.minimise({ maxIts }); energy = f.getTotalEnergy(); } catch { ff = ''; }
        }
        if (!ff) { frames.length = 0; frames.push({ atoms: atomsOf(c), energy: null }); break; } // 没有力场参数：只留第一个，顺序没意义
        frames.push({ atoms: atomsOf(c), energy });
      }
      if (!ff) warnings.push('no-forcefield');
      if (ff && frames.some((x) => !(Number.isFinite(x.energy)))) warnings.push('no-forcefield');
      frames.sort((a, b) => (a.energy ?? 0) - (b.energy ?? 0));
      const kept = [];
      for (const fr of frames) if (!kept.some((x) => x.energy !== null && fr.energy !== null && Math.abs(x.energy - fr.energy) < 0.01)) kept.push(fr); // 能量相同当作同一个构象（或它的镜像）
      if (fragments > 1) warnings.push('fragments');
      if (unpaired) warnings.push('radical');
      return { smiles: smi, stereoSmiles, fixedSmiles: fixed, frames: kept, tried: raw.length, charge, unpaired, mult: unpaired + 1, heavy, total, fragments, unspecified, forcefield: ff, warnings };
    } catch (e) {
      return { error: 'embed', detail: String((e && e.message) || e).slice(0, 200) };
    }
    function atomsOf(c) { // 平移到几何中心
      const n = c.getAllAtoms(), out = [];
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += c.getAtomX(i) / n; cy += c.getAtomY(i) / n; cz += c.getAtomZ(i) / n; }
      const r6 = (v) => Math.round(v * 1e6) / 1e6 || 0;
      for (let i = 0; i < n; i++) out.push({ el: c.getAtomLabel(i), x: r6(c.getAtomX(i) - cx), y: r6(c.getAtomY(i) - cy), z: r6(c.getAtomZ(i) - cz) });
      return out;
    }
  }

  /** 结果 → 多帧 XYZ（注释行写英文，和生成的输入一样不翻译）。 */
  function toXYZ(r) {
    const f = (v) => (v < 0 ? '' : ' ') + v.toFixed(6);
    return (r.frames || []).map((fr, k) => {
      const e = fr.energy === null ? 'not optimised (no MMFF94 parameters)' : `MMFF94s+ E = ${fr.energy.toFixed(3)} kcal/mol`;
      const head = `conformer ${k + 1}/${r.frames.length} from SMILES ${r.stereoSmiles || r.smiles} | ${e}`;
      return `${fr.atoms.length}\n${head}\n${fr.atoms.map((a) => `${a.el.padEnd(2)} ${f(a.x)} ${f(a.y)} ${f(a.z)}`).join('\n')}\n`;
    }).join('');
  }

  // ── 浏览器：载入 OpenChemLib、Worker ─────────────────────────────────────
  async function loadOCL(base) {
    const OCL = await import(`${base}openchemlib.js`);
    await OCL.Resources.registerFromUrl(`${base}resources.json`);
    return OCL;
  }
  function workerMain() {
    let ready = null;
    self.onmessage = async (ev) => {
      const { smiles, opts, base } = ev.data;
      try {
        if (!ready) ready = loadOCL(base);
        const OCL = await ready;
        const r = embed(OCL, smiles, opts, (k, n) => self.postMessage({ type: 'progress', k, n }));
        self.postMessage({ type: 'done', result: r });
      } catch (e) {
        ready = null;
        self.postMessage({ type: 'error', message: String((e && e.message) || e) });
      }
    };
  }

  let worker = null, workerUrl = '', pending = null, inPage = null;
  function spawn() {
    if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([`const embed = ${embed.toString()};\nconst loadOCL = ${loadOCL.toString()};\n(${workerMain.toString()})();\n`], { type: 'text/javascript' }));
    return new Worker(workerUrl, { type: 'module', name: 'molastria-smiles3d' });
  }

  /** 在 Worker 里算一个 SMILES。onProgress(k, n)：正在优化第 k 个构象（共 n 个）。 */
  function run(smiles, { opts, onProgress } = {}) {
    stop();
    return new Promise((resolve, reject) => {
      const fail = (msg) => { stop(true); reject(new Error(msg)); };
      try { worker = worker || spawn(); } catch { worker = null; }
      if (!worker) { // 退回在页面里算（会卡一下）
        if (!inPage) inPage = loadOCL(BASE).catch((e) => { inPage = null; throw e; });
        inPage.then((OCL) => resolve(embed(OCL, smiles, opts, onProgress)), () => reject(new Error('load')));
        return;
      }
      pending = { resolve, reject };
      worker.onmessage = (ev) => {
        const d = ev.data || {};
        if (d.type === 'progress') { if (onProgress) onProgress(d.k, d.n); return; }
        pending = null;
        if (d.type === 'done') resolve(d.result);
        else fail(/import|fetch|Failed|load/i.test(d.message || '') ? 'load' : d.message || 'error');
      };
      worker.onerror = (e) => { e.preventDefault?.(); fail('load'); };
      worker.postMessage({ smiles, opts: opts || {}, base: BASE });
    });
  }
  /** 结束正在算的那一个（Worker 直接关掉，下次重新开；库要重新载入，浏览器缓存里有就很快）。 */
  function stop(silent) {
    if (pending && !silent) { const p = pending; pending = null; p.reject(new Error('stopped')); }
    pending = null;
    if (worker) { worker.terminate(); worker = null; }
  }

  const api = { VERSION, BASE, embed, toXYZ, run, stop };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MolAstriaSmiles3D = api;
})(typeof window !== 'undefined' ? window : globalThis);
