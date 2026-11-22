/* 计算工作台的 Web Worker：格点上的轨道、密度、Hirshfeld 面、IGM、IGMH、IRI、点电荷静电势都在这里算，页面不卡。
   消息 { id, job, ... } → 进度 { id, type: 'progress', k, n } 和结果 { id, type: 'done', ... } 或 { id, type: 'error', message }。 */
/* global importScripts, MolAstriaWBWfn, MOLASTRIA_WB_PROMOL */
importScripts('wb-promol.js', 'wb-wfn.js');
const F = MolAstriaWBWfn;
let rhoFn = null;
const promol = () => rhoFn || (rhoFn = F.makePromol(MOLASTRIA_WB_PROMOL));
const QUALITY = { low: { h: 0.35, maxPts: 1.5e5 }, medium: { h: 0.25, maxPts: 4e5 }, high: { h: 0.17, maxPts: 1.2e6 } };

self.onmessage = (ev) => {
  const d = ev.data || {};
  const progress = (k, n) => self.postMessage({ id: d.id, type: 'progress', k, n });
  try {
    const q = QUALITY[d.quality] || QUALITY.medium;
    if (d.job === 'mo' || d.job === 'density') {
      const w = F.parseMolden(d.molden);
      const g = F.gridFor(w.atoms.map((a) => [a.x, a.y, a.z]), { margin: d.job === 'mo' ? 5 : 4.5, ...q });
      const buf = new Float64Array(w.nbf);
      let data, title;
      if (d.job === 'mo') {
        const mo = w.mos[d.index];
        if (!mo) throw new Error('mo:index');
        data = F.fillGrid(g, (x, y, z) => F.moAt(w, mo, x, y, z, buf), progress);
        title = `MO ${d.index + 1} (${mo.spin}) E = ${mo.e.toFixed(5)} Eh occ = ${mo.occ}`;
      } else {
        const occ = w.mos.filter((m) => m.occ > 1e-8);
        data = F.fillGrid(g, (x, y, z) => F.densityAt(w, x, y, z, buf, occ), progress);
        title = 'electron density';
      }
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += d.job === 'mo' ? data[i] * data[i] : data[i];
      const integral = sum * g.h ** 3;
      self.postMessage({ id: d.id, type: 'done', cube: F.cubeText(g, data, w.atoms, 'MolAstria workbench', title), grid: g, integral });
      return;
    }
    if (d.job === 'hirshfeld') {
      const vdw = (el) => d.vdw[el] ?? 2.0;
      const r = F.hirshfeldGrid(promol(), d.atoms, d.inside, vdw, { ...q, envelope: d.envelope || 0 }, progress);
      const atomsZ = d.atoms.map((a) => ({ Z: a.Z, x: a.x, y: a.y, z: a.z }));
      self.postMessage({ id: d.id, type: 'done', wCube: F.cubeText(r.grid, r.w, atomsZ, 'Hirshfeld weight'), dCube: F.cubeText(r.grid, r.dnorm, atomsZ, 'd_norm'), surface: r.surface, grid: r.grid });
      return;
    }
    if (d.job === 'igm' || d.job === 'iri') {
      const r = F.nciGrid(promol(), d.atoms, d.frag, d.job, { h: q.h * 0.8, maxPts: q.maxPts * 1.5 }, progress);
      const atomsZ = d.atoms.map((a) => ({ Z: a.Z, x: a.x, y: a.y, z: a.z }));
      self.postMessage({ id: d.id, type: 'done', mainCube: F.cubeText(r.grid, r.main, atomsZ, d.job), colorCube: F.cubeText(r.grid, r.sl2r, atomsZ, 'sign(lambda2)rho'), scatter: r.scatter, grid: r.grid });
      return;
    }
    if (d.job === 'igmh') {
      const w = F.parseMolden(d.molden);
      const r = F.igmhGrid(promol(), w, d.frag, { h: q.h, maxPts: q.maxPts * 0.75 }, progress);
      self.postMessage({ id: d.id, type: 'done', mainCube: F.cubeText(r.grid, r.main, w.atoms, 'IGMH dg_inter'), colorCube: F.cubeText(r.grid, r.sl2r, w.atoms, 'sign(lambda2)rho'), scatter: r.scatter, grid: r.grid });
      return;
    }
    if (d.job === 'espq') {
      const g = F.gridFor(d.atoms.map((a) => [a.x, a.y, a.z]), { margin: 4.5, ...q });
      const atomsZ = d.atoms.map((a) => ({ Z: a.Z, x: a.x, y: a.y, z: a.z }));
      const rho = F.fillGrid(g, (x, y, z) => F.promolAt(promol(), d.atoms, x, y, z).rho, progress);
      const esp = F.espPointCharges(d.atoms, d.charges, g);
      self.postMessage({ id: d.id, type: 'done', rhoCube: F.cubeText(g, rho, atomsZ, 'promolecular density'), espCube: F.cubeText(g, esp, atomsZ, 'point-charge ESP') });
      return;
    }
    throw new Error(`job:${d.job}`);
  } catch (e) {
    self.postMessage({ id: d.id, type: 'error', message: String((e && e.message) || e) });
  }
};
