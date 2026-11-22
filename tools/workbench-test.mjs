// 计算工作台（public/workbench/）的测试：node --test tools/workbench-test.mjs
// - 格式读写来回一致，晶体和表面的层间距对照解析值，IDPP、原子对应、构象归簇、Boltzmann；
// - Molden 读法、轨道、密度和它的梯度与 Hessian 对照 PySCF（tools/workbench/fixtures.py），cube 读写和积分；
// - 自由原子密度的归一（∫ρ = Z）和氢原子的解析密度；Hirshfeld 面（孤立团簇合上、d_i + d_e 不小于核间距）、IGM 和 IGMH；
// - R/S 和 E/Z 对照 RDKit 的新 CIP 标注器（tools/workbench/cip-fixture.py），镜像后全部翻转；
// - 红外、拉曼、紫外、轨道能级、扫描能量对照 cclib 读出来的值（tools/workbench/cclib-excerpt.py），紫外谱的面积等于振子强度；
// - 反应路径输入、作业脚本过 bash -n、zip 能被 Python 读回、文献齐全；页面接进了顶栏、SEO、站点地图、CI 和最近更新。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8');
const WB = require('../public/workbench/wb-struct.js');
const C = require('../public/workbench/wb-calc.js');
const F = require('../public/workbench/wb-wfn.js');
const PROMOL = require('../public/workbench/wb-promol.js');
const Code = require('../public/code/code-core.js');
const FIX = 'tools/workbench/fixtures/';
let OCL = null;
try { OCL = createRequire(new URL('e2e/package.json', import.meta.url))('openchemlib'); } catch { /* 没装 tools/e2e 的依赖：R/S 那一项跳过 */ }
const has = (cmd) => { try { execFileSync(cmd, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);
const rhoFn = F.makePromol(PROMOL);

const WATER2 = `O -1.551007 -0.114520 0.000000
H -1.934259 0.762503 0.000000
H -0.599677 0.040712 0.000000
O 1.350625 0.111469 0.000000
H 1.680398 -0.373741 -0.758561
H 1.680398 -0.373741 0.758561`.split('\n').map((l) => { const [el, x, y, z] = l.split(/\s+/); return { el, x: +x, y: +y, z: +z }; });
const bohrAtoms = (atoms) => atoms.map((a) => ({ el: a.el, Z: WB.ZOF[a.el], x: a.x / WB.BOHR, y: a.y / WB.BOHR, z: a.z / WB.BOHR }));

// ── 结构 ──────────────────────────────────────────────────────────────
test('每种格式写出去再读回来，坐标、元素、晶胞都不变', () => {
  const mol = [{ atoms: WATER2, cell: null, energy: -152.7, comment: 'water dimer' }];
  for (const fmt of ['xyz', 'pdb', 'mol', 'gjf', 'orca']) {
    const text = WB.write(fmt, mol, { frame: 0 });
    const r = WB.parseAny(text, `x.${WB.EXT[fmt]}`);
    assert.equal(r.frames[0].atoms.length, 6, fmt);
    r.frames[0].atoms.forEach((a, i) => { assert.equal(a.el, WATER2[i].el, fmt); for (const c of ['x', 'y', 'z']) close(a[c], WATER2[i][c], 1e-3, `${fmt} ${c}`); });
  }
  const nacl = WB.crystal('nacl');
  for (const fmt of ['cif', 'poscar']) {
    const r = WB.parseAny(WB.write(fmt, [nacl], { frame: 0 }), `x.${WB.EXT[fmt]}`);
    const fr = r.frames[0];
    assert.equal(fr.atoms.length, nacl.atoms.length, fmt);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(fr.cell[i][j], nacl.cell[i][j], 1e-4, `${fmt} cell`);
  }
  // 多帧 XYZ（含 extxyz 的能量注释）
  const two = [{ atoms: WATER2, cell: null, energy: -1, comment: '' }, { atoms: WATER2.map((a) => ({ ...a, x: a.x + 0.1 })), cell: null, energy: -2, comment: '' }];
  const r = WB.parseAny(WB.write('xyz', two, { all: true }), 'path.xyz');
  assert.equal(r.frames.length, 2);
  close(r.frames[1].atoms[0].x, WATER2[0].x + 0.1, 1e-5);
  close(r.frames[1].energy, -2, 1e-12, 'energy= 是 Eh');
  // 注释里写了单位的能量换成 Eh（帧里的能量一律是 Eh，构象归簇和能量曲线都按 Eh 算）
  for (const [c, e] of [['conformer 1/3 from SMILES CCO | MMFF94s+ E = -37.435 kcal/mol', -37.435 / WB.HARTREE_KCAL], ['E = -2.5 eV', -2.5 / WB.HARTREE_EV], ['energy: -150.0 kJ/mol', -150 / WB.HARTREE_KJ], ['-76.02670311', -76.02670311]]) {
    close(WB.parseAny(`1\n${c}\nH 0 0 0\n`, 'x.xyz').frames[0].energy, e, 1e-12, c);
  }
});

test('晶体：超胞的原子数、fcc 铜三个面的层间距（a/√3、a/2、a/2√2）', () => {
  const cu = WB.crystal('cu');
  const a = WB.cellParams(cu.cell).a;
  assert.equal(WB.supercell(cu, 2, 3, 1).atoms.length, cu.atoms.length * 6);
  for (const [hkl, d] of [[[1, 1, 1], a / Math.sqrt(3)], [[1, 0, 0], a / 2], [[1, 1, 0], a / (2 * Math.SQRT2)]]) {
    const s = WB.slab(cu, hkl, { layers: 4, vacuum: 12 });
    const z = [...new Set(s.atoms.map((p) => +p.z.toFixed(3)))].sort((x, y) => x - y);
    assert.equal(z.length, 4, `${hkl} 层数`);
    for (let i = 1; i < z.length; i++) close(z[i] - z[i - 1], d, 2e-3, `${hkl} 层间距`);
    assert.ok(WB.cellParams(s.cell).c > z[3] - z[0] + 11.9, '真空层');
  }
});

test('IDPP 路径不让原子撞在一起；原子对应能认出打乱的顺序；构象归簇和 Boltzmann', () => {
  const A = [{ el: 'N', x: 0, y: 0, z: 0.38 }, { el: 'H', x: 0.94, y: 0, z: 0.03 }, { el: 'H', x: -0.47, y: 0.814, z: 0.03 }, { el: 'H', x: -0.47, y: -0.814, z: 0.03 }];
  const B = A.map((p) => ({ ...p, z: -p.z }));
  const r = WB.idpp(A, B, { images: 7 });
  const lin = WB.linearPath(A, B, 7);
  assert.equal(r.frames.length, 9);
  const minLin = Math.min(...lin.map((f) => Math.min(...f.flatMap((p, i) => f.slice(i + 1).map((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z))))));
  assert.ok(Math.min(...r.minDist) >= minLin - 1e-9);
  const mid = r.frames[4];
  for (let i = 1; i < 4; i++) { const d = Math.hypot(mid[i].x - mid[0].x, mid[i].y - mid[0].y, mid[i].z - mid[0].z); assert.ok(d > 0.85 && d < 1.2, `中间像的 N–H ${d}`); }
  // 打乱 + 转动 + 平移
  const perm = [3, 5, 4, 0, 2, 1], th = 0.7;
  const moved = perm.map((k) => { const p = WATER2[k]; return { el: p.el, x: Math.cos(th) * p.x - Math.sin(th) * p.y + 2, y: Math.sin(th) * p.x + Math.cos(th) * p.y - 1, z: p.z + 0.5 }; });
  const m = WB.mapAtoms(WATER2, moved);
  assert.ok(m.ok && m.changed);
  assert.deepEqual(m.order, WATER2.map((_, i) => perm.indexOf(i)));
  assert.ok(m.rmsd < 1e-6);
  // Boltzmann：差 1 kcal/mol，298.15 K 下布居比是 exp(−1/RT)
  const bz = WB.boltzmann([0, 1 / WB.HARTREE_KCAL], 'eh', 298.15);
  close(bz.pop[1] / bz.pop[0], Math.exp(-1 / (0.0019872043 * 298.15)), 1e-9);
  // 三个构象：两个是同一个（转了一下），一个不同
  const f = (atoms, e) => ({ atoms, energy: e, cell: null });
  const other = WATER2.map((p, i) => (i >= 3 ? { ...p, x: p.x + 0.8 } : p));
  const cl = WB.clusterConformers([f(WATER2, 0), f(moved.map((_, i) => moved[perm.indexOf(i)]), 1e-5), f(other, 0.002)], { rmsd: 0.1, heavy: false });
  assert.equal(cl.clusters.length, 2);
  close(cl.clusters.reduce((s, c) => s + c.pop, 0), 1, 1e-12);
});

// ── R/S 和 E/Z ────────────────────────────────────────────────────────
test('R/S 和 E/Z：18 个分子和 RDKit 的新 CIP 标注器一致，镜像后全部翻转', { skip: !OCL && '要先 npm ci --prefix tools/e2e' }, () => {
  const fx = JSON.parse(read(`${FIX}cip.json`));
  assert.ok(fx.cases.length >= 18);
  const flip = { R: 'S', S: 'R', E: 'E', Z: 'Z' };
  for (const c of fx.cases) {
    const atoms = c.atoms.map(([el, x, y, z]) => ({ el, x, y, z }));
    const r = WB.cipLabels(OCL, atoms, c.charge);
    assert.ok(r.ok, `${c.name}: ${r.why}`);
    assert.deepEqual(Object.fromEntries(r.centres.map(([i, l]) => [String(i), l])), c.centres, c.name);
    assert.deepEqual(r.bonds, c.bonds, c.name);
    const m = WB.cipLabels(OCL, atoms.map((a) => ({ ...a, x: -a.x })), c.charge);
    assert.deepEqual(m.centres.map(([i, l]) => [i, flip[l]]), r.centres, `${c.name} 镜像`);
    assert.deepEqual(m.bonds, r.bonds, `${c.name} 镜像的 E/Z 不变`);
  }
});

test('键级推断：苯是凯库勒式，乙腈是三键，硝基是 N⁺–O⁻，总电荷对不上就不标', () => {
  const benz = [];
  for (let k = 0; k < 6; k++) { const t = (k * Math.PI) / 3; benz.push({ el: 'C', x: 1.397 * Math.cos(t), y: 1.397 * Math.sin(t), z: 0 }, { el: 'H', x: 2.481 * Math.cos(t), y: 2.481 * Math.sin(t), z: 0 }); }
  const b = WB.bondOrders(benz);
  assert.ok(b.ok);
  const cc = b.orders.filter(([i, j]) => benz[i].el === 'C' && benz[j].el === 'C').map((o) => o[2]).sort();
  assert.deepEqual(cc, [1, 1, 1, 2, 2, 2]);
  const mecn = [{ el: 'C', x: 0, y: 0, z: 0 }, { el: 'C', x: 1.46, y: 0, z: 0 }, { el: 'N', x: 2.62, y: 0, z: 0 }, { el: 'H', x: -0.37, y: 1.03, z: 0 }, { el: 'H', x: -0.37, y: -0.51, z: 0.89 }, { el: 'H', x: -0.37, y: -0.51, z: -0.89 }];
  const m = WB.bondOrders(mecn);
  assert.ok(m.ok);
  assert.equal(m.orders.find(([i, j]) => (i === 1 && j === 2) || (i === 2 && j === 1))[2], 3);
  const nitro = [{ el: 'C', x: 0, y: 0, z: 0 }, { el: 'N', x: 1.49, y: 0, z: 0 }, { el: 'O', x: 2.09, y: 1.07, z: 0 }, { el: 'O', x: 2.09, y: -1.07, z: 0 }, { el: 'H', x: -0.36, y: 1.02, z: 0 }, { el: 'H', x: -0.36, y: -0.51, z: 0.89 }, { el: 'H', x: -0.36, y: -0.51, z: -0.89 }];
  const n = WB.bondOrders(nitro, undefined, 0);
  assert.ok(n.ok);
  assert.deepEqual(n.charges.slice(1, 4).sort(), [-1, 0, 1]);
  assert.equal(WB.bondOrders(nitro, undefined, 1).why, 'charge');
  assert.equal(WB.bondOrders([{ el: 'Fe', x: 0, y: 0, z: 0 }]).why, 'elements');
});

// ── 波函数 ────────────────────────────────────────────────────────────
test('Molden：基函数个数、轨道、密度、密度的梯度和 Hessian 都和 PySCF 一致（球谐、笛卡尔、开壳层）', () => {
  const ref = JSON.parse(read(`${FIX}reference.json`));
  for (const [name, r] of Object.entries(ref)) {
    const w = F.parseMolden(read(FIX + r.molden));
    assert.equal(w.nbf, r.nbas, `${name} nbf`);
    close(w.mos.reduce((s, m) => s + m.occ, 0), r.nelec, 1e-6, `${name} 电子数`);
    const homo = w.mos[r.homo_index];
    close(homo.e, r.homo_energy, 1e-5, `${name} HOMO 能量`);
    const ws = F.derivWork(w);
    r.points_bohr.forEach((p, i) => {
      close(F.densityAt(w, ...p), r.rho[i], 1e-9 + 1e-7 * r.rho[i], `${name} ρ`);
      close(Math.abs(F.moAt(w, homo, ...p)), Math.abs(r.homo[i]), 1e-8, `${name} HOMO`);
      const d = F.rhoDerivsAt(w, ...p, ws);
      const gn = Math.max(1e-4, Math.hypot(...r.grad[i]));
      for (let c = 0; c < 3; c++) close(d.g[c], r.grad[i][c], 1e-6 * gn, `${name} ∇ρ`);
      const H = ['xx', 'yy', 'zz', 'xy', 'xz', 'yz'].map((k) => r.hess[k][i]), hn = Math.max(1e-4, Math.hypot(...H));
      for (let c = 0; c < 6; c++) close(d.H[c], H[c], 1e-6 * hn, `${name} Hessian`);
    });
  }
});

test('cube：PySCF 写的密度 cube 和从 Molden 现算的密度逐点一致；格子够细时积分是 10 个电子；写出去再读回来一样', () => {
  const c = F.parseCube(read(`${FIX}water-density.cube`));
  const w = F.parseMolden(read(`${FIX}water-tz.molden`));
  assert.equal(c.atoms.length, 3);
  assert.deepEqual(c.n, [24, 24, 24]);
  // 逐点：cube 的 (i, j, k) 在 origin + i·a + j·b + k·c 处，k 变得最快
  const [nx, ny, nz] = c.n;
  for (let idx = 0; idx < c.data.length; idx += 131) {
    const i = Math.floor(idx / (ny * nz)), j = Math.floor(idx / nz) % ny, k = idx % nz;
    const p = [0, 1, 2].map((d) => c.origin[d] + i * c.axes[0][d] + j * c.axes[1][d] + k * c.axes[2][d]);
    close(F.densityAt(w, ...p), c.data[idx], 1e-4 * c.data[idx] + 1e-10, `点 ${i},${j},${k}`); // cube 只写 6 位有效数字，Molden 的系数也是截过的
  }
  // 24³ 的粗格子漏掉了氧核附近的尖峰，所以 cube 自己的积分只有约 9.1；在细格子上现算是 10
  const coarse = F.cubeIntegral(c);
  assert.ok(coarse > 8.8 && coarse < 9.4, `粗格子 ${coarse}`);
  // h = 0.15 bohr 时剩下的误差（约 0.5 %）来自核附近的尖峰；h = 0.09 时是 9.989，但要算 8 秒
  const g = F.gridFor(w.atoms.map((a) => [a.x, a.y, a.z]), { margin: 4.5, h: 0.15, maxPts: 1e6 });
  const data = F.fillGrid(g, (x, y, z) => F.densityAt(w, x, y, z));
  const fine = data.reduce((t, v) => t + v, 0) * g.h ** 3;
  close(fine, 10, 0.08, '细格子 ∫ρ');
  const back = F.parseCube(F.cubeText(g, data, w.atoms));
  assert.deepEqual(back.n, g.n);
  close(F.cubeIntegral(back), fine, 1e-4 * fine, '写出去再读回来');
  for (let i = 0; i < data.length; i += 997) close(back.data[i], data[i], 1e-5 * Math.abs(data[i]) + 1e-12);
});

test('自由原子密度：∫4πr²ρ dr = Z，氢原子接近解析的 e^{−2r}/π', () => {
  for (const Z of [1, 6, 7, 8, 9, 15, 16, 17, 26, 35]) {
    let s = 0;
    const n = 20000, r1 = 14;
    for (let k = 1; k <= n; k++) { const r = (k - 0.5) * (r1 / n); s += 4 * Math.PI * r * r * rhoFn(Z, r)[0] * (r1 / n); }
    close(s, Z, 0.01 * Z, `Z = ${Z}`);
  }
  for (const r of [0.2, 0.5, 1, 2, 3]) close(rhoFn(1, r)[0], Math.exp(-2 * r) / Math.PI, 0.05 * Math.exp(-2 * r) / Math.PI, `H r = ${r}`);
});

test('Hirshfeld 面：水二聚体的面合上了，接触比例加起来是 1，d_i + d_e 不小于氢键的核间距', () => {
  const atoms = bohrAtoms(WATER2);
  const r = F.hirshfeldGrid(rhoFn, atoms, [0, 1, 2], (el) => WB.VDW[el], { h: 0.3, maxPts: 2e5, envelope: 0.001 });
  const free = r.surface.filter((p) => p.free).length;
  assert.ok(free > 0 && free < r.surface.length);
  close(F.contactShares(r.surface).reduce((s, c) => s + c.share, 0), 1, 1e-12);
  const hb = Math.hypot(WATER2[2].x - WATER2[3].x, WATER2[2].y - WATER2[3].y);
  const contact = r.surface.filter((p) => !p.free);
  const dmin = Math.min(...contact.map((p) => p.di + p.de));
  assert.ok(dmin >= hb - 1e-6 && dmin < hb + 0.12, `${dmin} vs H···O ${hb}`);
  assert.equal(F.contactShares(r.surface)[0].pair, 'H···O');
  const fp = F.fingerprint(r.surface);
  assert.equal(fp.used, contact.filter((p) => p.di >= 0.4 && p.de >= 0.4 && p.di < 2.6 && p.de < 2.6).length);
  // 不加 envelope：w = ½ 的面在背向邻居那一侧打开，一直到格子边上
  const open = F.hirshfeldGrid(rhoFn, atoms, [0, 1, 2], (el) => WB.VDW[el], { h: 0.3, maxPts: 2e5 });
  assert.ok(open.surface.every((p) => !p.free));
});

test('IGM 和 IGMH：水二聚体的 δg^inter 最大处在氢键上，sign(λ₂)ρ 是负的；IGMH 用真实密度', () => {
  const frag = [0, 0, 0, 1, 1, 1];
  const igm = F.nciGrid(rhoFn, bohrAtoms(WATER2), frag, 'igm', { h: 0.3, maxPts: 2e5 });
  const w = F.parseMolden(read('public/workbench/samples/water-dimer.molden'));
  const igmh = F.igmhGrid(rhoFn, w, frag, { h: 0.3, maxPts: 2e5 });
  const H = w.atoms[2], O = w.atoms[3];
  for (const [r, lo, hi] of [[igm, -0.045, -0.02], [igmh, -0.032, -0.018]]) {
    let k = 0;
    for (let i = 1; i < r.main.length; i++) if (r.main[i] > r.main[k]) k = i;
    const [nx, ny, nz] = r.grid.n, ix = Math.floor(k / (ny * nz)), iy = Math.floor(k / nz) % ny, iz = k % nz;
    const p = [r.grid.origin[0] + ix * r.grid.h, r.grid.origin[1] + iy * r.grid.h, r.grid.origin[2] + iz * r.grid.h];
    const mid = [(H.x + O.x) / 2, (H.y + O.y) / 2, (H.z + O.z) / 2];
    assert.ok(Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]) < 1.2, '最大值在 H···O 之间');
    assert.ok(r.sl2r[k] > lo && r.sl2r[k] < hi, `sign(λ₂)ρ = ${r.sl2r[k]}`);
    assert.ok(r.scatter.length > 100);
  }
  // 两个片段的 Hirshfeld 梯度加起来就是 ∇ρ：远离分子的地方 δg^inter 趋于 0
  assert.ok(Math.abs(igmh.main[0]) < 1e-6);
});

// ── 光谱和输出 ────────────────────────────────────────────────────────
test('光谱和轨道对照 cclib：拉曼活性、紫外激发态、轨道能量、扫描能量', () => {
  const ref = JSON.parse(read(`${FIX}cclib/cclib-ref.json`));
  const cc = (f) => read(`${FIX}cclib/${f}`);
  for (const f of ['g16-raman.out', 'orca5-raman.out']) {
    const ra = C.ramanOf(cc(f)), want = ref[f];
    const pos = ra.filter((m) => m.freq > 0);
    assert.equal(pos.length, want.vibfreqs.length, f);
    pos.forEach((m, i) => { close(m.freq, want.vibfreqs[i], 0.01, `${f} ν`); close(m.act, want.vibramans[i], 1e-3 * Math.max(1, want.vibramans[i]), `${f} S`); });
  }
  // cclib 把单重态和三重态按能量排在一起；我们照程序的顺序列，三重态标 mult = 3、f = 0
  const sameStates = (uv, want, f) => {
    assert.equal(uv.length, want.etenergies.length, f);
    const ours = uv.map((t) => [t.ev * C.EV_CM, t.f]).sort((x, y) => x[0] - y[0]);
    ours.forEach(([e, osc], i) => { close(e, want.etenergies[i], 2, `${f} 激发能`); close(osc, want.etoscs[i], 1e-4, `${f} f`); });
  };
  sameStates(C.uvOf(cc('g16-td.out')), ref['g16-td.out'], 'g16-td.out');
  const o5 = C.uvOf(cc('orca5-td.out')), o6 = C.uvOf(cc('orca6-td.out'));
  sameStates(o5, ref['orca5-td.out'], 'orca5-td.out');
  assert.deepEqual(o5.map((t) => t.mult), [null, null, null, null, null, 3, 3, 3, 3, 3]);
  // ORCA 6（cclib 1.8.1 还读不了）：同一个分子、同样的设置，和 ORCA 5 的结果对照；多重度从态的名字（1-3Bu）读
  assert.deepEqual(o6.map((t) => t.mult), [3, 3, 3, 3, 3, 1, 1, 1, 1, 1]);
  const byE = (L) => L.slice().sort((x, y) => x.ev - y.ev);
  byE(o6).forEach((t, i) => { const u = byE(o5)[i]; close(t.ev, u.ev, 0.002, 'ORCA 6 vs 5 激发能'); close(t.f, u.f, 0.001, 'ORCA 6 vs 5 f'); assert.equal(t.mult ?? 1, u.mult ?? 1); });
  const r6 = C.ramanOf(cc('orca6-raman.out')).filter((m) => m.freq > 0), r5 = C.ramanOf(cc('orca5-raman.out')).filter((m) => m.freq > 0);
  // 两次计算的数值 Hessian 设置不同，低频的软模差得多；比模式数和最强的三条拉曼带
  assert.equal(r6.length, r5.length);
  const top = (L) => L.slice().sort((x, y) => y.act - x.act).slice(0, 3);
  top(r6).forEach((m, i) => { close(m.freq, top(r5)[i].freq, 0.005 * m.freq, 'ORCA 6 vs 5 ν'); close(m.act, top(r5)[i].act, 0.06 * m.act, 'ORCA 6 vs 5 S'); });
  for (const f of ['g16-sp.out', 'g16-un-sp.log', 'orca5-sp.out', 'orca5-sp-un.out']) {
    const o = C.orbitalsOf(cc(f)), want = ref[f].moenergies;
    assert.ok(o, f);
    assert.equal(o.alpha.length, want[0].length, `${f} α`);
    o.alpha.forEach((x, i) => close(x.e * C.HARTREE_EV, want[0][i], 2e-3, `${f} α ${i}`));
    if (want.length > 1) { assert.equal(o.beta.length, want[1].length, `${f} β`); o.beta.forEach((x, i) => close(x.e * C.HARTREE_EV, want[1][i], 2e-3, `${f} β`)); }
  }
  const scan = C.readPath(cc('g16-scan.log'), (t) => WB.parseAny(t, 'x.xyz'));
  assert.ok(scan);
  assert.equal(scan.energies.length, ref['g16-scan.log'].scanenergies.length);
  scan.energies.forEach((e, i) => close(e * C.HARTREE_EV, ref['g16-scan.log'].scanenergies[i], 1e-3));
  // ORCA 的弛豫扫描表（cclib 1.8.1 不读）：ORCA 5 和 6 同一个二面角扫描，12 个点、0° 到 360°，能量差不到 0.01 mEh
  const [s5, s6] = ['orca5-scan.out', 'orca6-scan.out'].map((f) => C.readPath(cc(f), (t) => WB.parseAny(t, 'x.xyz')));
  assert.equal(s5.energies.length, 12);
  assert.equal(s6.energies.length, 12);
  close(s5.x[11], 360, 1e-6);
  s5.energies.forEach((e, i) => close(s6.energies[i], e, 1e-5, `ORCA 6 vs 5 扫描 ${i}`));
});

test('谱的换算：紫外谱的面积等于 f / 4.319e-9，展宽保面积，拉曼强度的 Polavarapu 公式', () => {
  const s = C.uvSpectrum([{ ev: 5, nm: 1239.84198 / 5, f: 0.5 }], { fromNm: 120, toNm: 1200, n: 20000, fwhmEv: 0.3 });
  let area = 0;
  for (let i = 1; i < s.nm.length; i++) area += 0.5 * (s.eps[i] + s.eps[i - 1]) * Math.abs(1e7 / s.nm[i] - 1e7 / s.nm[i - 1]);
  close(area, 0.5 / 4.319e-9, 0.002 * area, '∫ε dν̃');
  for (const shape of ['gauss', 'lorentz']) {
    const b = C.broaden([{ pos: 1000, h: 3 }], { from: -20000, to: 22000, n: 84001, fwhm: 10, shape });
    let a = 0; for (let i = 1; i < b.x.length; i++) a += 0.5 * (b.y[i] + b.y[i - 1]) * (b.x[i] - b.x[i - 1]);
    close(a, 3, 0.01, shape);
  }
  const I = C.ramanIntensity([{ freq: 500, act: 1 }, { freq: 1500, act: 1 }], 532, 298.15);
  const nu0 = 1e7 / 532, c2 = 1.438776877;
  const raw = (v) => ((nu0 - v) ** 4) / (v * (1 - Math.exp((-c2 * v) / 298.15)));
  close(I[1].int / I[0].int, raw(1500) / raw(500), 1e-12);
});

test('能量曲线：样条插出来的最高点，能垒和反应能', () => {
  const x = [0, 1, 2, 3, 4, 5, 6], E = x.map((v) => (-0.5 * (v - 3.3) ** 2 + 10) / C.HARTREE_KCAL);
  const p = C.profile({ energies: E, x }, { unit: 'kcal' });
  assert.equal(p.top, 3);
  close(p.smooth.x, 3.3, 0.02);
  close(p.smooth.e - p.rel[0], 10 - (-0.5 * 3.3 ** 2 + 10), 0.02);
  close(p.reaction, (-0.5 * 2.7 ** 2) - (-0.5 * 3.3 ** 2), 1e-9);
});

// ── 输入和作业脚本 ────────────────────────────────────────────────────
test('反应路径输入：每种程序和任务都写得出来，没有 undefined', () => {
  const atoms = WATER2;
  const o = { charge: 0, mult: 1, name: 'w2', cores: 4, mem: 8, constraints: [{ type: 'bond', atoms: [1, 2], value: 0.97 }], scan: { type: 'bond', atoms: [3, 4], from: 1.8, to: 3.0, steps: 7 }, frozen: [1], product: WATER2.map((p) => ({ ...p, x: p.x * 1.05 })), images: 6, ircPoints: 20 };
  for (const prog of ['xtb', 'orca', 'gaussian']) for (const task of ['constrain', 'scan', 'ts', 'irc', 'neb']) {
    const r = C.pathInput(prog, task, atoms, { ...o, method: prog === 'orca' ? 'B3LYP' : prog === 'gaussian' ? 'B3LYP' : 'GFN2', basis: 'def2-SVP' });
    if (!r.supported) continue;
    assert.ok(r.files.length, `${prog} ${task}`);
    for (const f of r.files) assert.doesNotMatch(f.text, /undefined|NaN/, `${prog} ${task} ${f.name}`);
  }
  // 扫描 7 步是 8 个点：xtb 的第三个数是点数（含两端），ORCA 也写点数，Gaussian 写步数
  const txt = (prog, m) => C.pathInput(prog, 'scan', atoms, { ...o, method: m, basis: 'def2-SVP' }).files.map((f) => f.text).join('\n');
  assert.match(txt('xtb', 'GFN2'), /\$scan\s+mode=sequential\s+1: 1\.8, 3, 8\s/);
  assert.match(txt('xtb', 'GFN2'), /distance: 3, 4, 1\.8\n\s+distance: 1, 2, 0\.97/);
  assert.match(txt('orca', 'B3LYP'), /B 2 3 = 1\.8, 3, 8/);
  assert.match(txt('gaussian', 'B3LYP'), /B 3 4 S 7 0\.171429/);
});

test('作业脚本：Slurm / PBS 作业数组和 bash 过 bash -n，CREST 在自己的目录里跑，命令里的引号不出错', { skip: !has('bash') && '没有 bash' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-job-'));
  try {
    for (const scheduler of ['slurm', 'pbs', 'bash']) for (const program of ['orca', 'gaussian', 'xtb', 'crest', 'psi4', 'pyscf']) for (const n of [1, 3]) {
      const files = Array.from({ length: n }, (_, i) => `mol_${i + 1}.${program === 'gaussian' ? 'gjf' : program === 'orca' ? 'inp' : program === 'pyscf' ? 'py' : program === 'psi4' ? 'in' : 'xyz'}`);
      const commands = program === 'xtb' ? files.map((f) => `xtb ${f} --opt --chrg 0 --uhf 0 --input "it's.inp" > ${f}.out`) : null;
      const text = C.jobScript({ scheduler, program, files, commands, cores: 8, memGB: 16, hours: 12, partition: 'compute', account: 'abc' });
      const p = path.join(dir, `${scheduler}-${program}-${n}.sh`);
      fs.writeFileSync(p, text);
      execFileSync('bash', ['-n', p]);
      if (scheduler === 'slurm' && n > 1) assert.match(text, /#SBATCH --array=1-3/);
      if (scheduler === 'pbs' && n > 1) assert.match(text, /#PBS -J 1-3/);
      if (program === 'crest') assert.match(text, /mkdir -p mol_1 && cp mol_1\.xyz mol_1\//);
    }
    // 作业数组里第 2 个任务真的跑第 2 条命令（把命令换成 echo 实际跑一遍）
    const t = C.jobScript({ scheduler: 'slurm', program: 'xtb', files: ['a.xyz', 'b.xyz'], commands: ["echo 'first'", "echo \"it's second\""], module: false });
    const out = execFileSync('bash', ['-c', t.split('\n').filter((l) => !/^cd /.test(l)).join('\n')], { env: { ...process.env, SLURM_ARRAY_TASK_ID: '2' } }).toString().trim();
    assert.equal(out, "it's second");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('zip 能被 Python 的 zipfile 读回来，CRC 对得上，中文文件名不乱', { skip: !has('python3') && '没有 python3' }, () => {
  const files = [{ name: 'a.inp', text: '! B3LYP\n' }, { name: '中文.xyz', text: '1\n\nH 0 0 0\n' }, { name: 'job.slurm', text: '#!/bin/bash\n' }];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-zip-'));
  try {
    const p = path.join(dir, 'x.zip');
    fs.writeFileSync(p, C.zip(files));
    const out = execFileSync('python3', ['-I', '-c', 'import sys, zipfile, json; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n: z.read(n).decode() for n in z.namelist()}, ensure_ascii=False))', p]).toString();
    assert.deepEqual(JSON.parse(out), Object.fromEntries(files.map((f) => [f.name, f.text])));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('开源代码台的生成器能给每一帧写输入（批量作业页用它）', () => {
  for (const [prog] of Code.PROGRAMS) {
    const g = Code.generate(prog, WATER2.map((a) => ({ el: a.el, x: a.x, y: a.y, z: a.z })), { charge: 0, mult: 1, method: prog === 'xtb' || prog === 'crest' ? 'GFN2-xTB' : 'B3LYP', basis: 'def2-svp', task: 'opt', name: 'w2_01' });
    assert.ok(g.supported, prog);
    assert.ok(g.filename.startsWith('w2_01'), prog);
  }
});

test('文献：每条有 DOI 或网址，DOI 不重复，BibTeX / RIS / CSV 都写得出来', () => {
  const ids = Object.keys(C.REFS);
  assert.ok(ids.length >= 30);
  const dois = ids.map((k) => C.REFS[k].doi).filter(Boolean);
  assert.equal(new Set(dois).size, dois.length);
  for (const k of ids) assert.ok(C.REFS[k].doi || C.REFS[k].url, k);
  const bib = C.bibtex(ids);
  assert.equal((bib.match(/^@/gm) || []).length, ids.length);
  assert.equal((C.ris(ids).match(/^ER {2}-/gm) || []).length, ids.length);
  assert.equal(C.refsCsv(ids).trim().split('\n').length, ids.length + 1);
  for (const k of ['ester', 'igmh', 'cip', 'cclib', 'hirshfeld']) assert.ok(C.REFS[k], k);
});

// ── 页面 ──────────────────────────────────────────────────────────────
test('页面：脚本顺序、顶栏、SEO、站点地图、CI、最近更新和示例文件都接上了', () => {
  const html = read('public/workbench/index.html');
  assert.match(html, /data-section="workbench"/);
  assert.match(html, /translate="no"/);
  assert.match(html, /mol3d\.js[\s\S]*smiles3d\.js[\s\S]*code-core\.js[\s\S]*wb-struct\.js[\s\S]*wb-calc\.js[\s\S]*wb-wfn\.js[\s\S]*wb-tab-path\.js[\s\S]*wb-tab-wfn\.js[\s\S]*wb-tab-spec\.js[\s\S]*workbench\.js/);
  assert.match(read('public/shared-nav.js'), /\['workbench', 'workbench\/index\.html'/);
  const seo = read('tools/build-seo.ts');
  assert.match(seo, /injectHead\("workbench\/index\.html"/);
  assert.match(seo, /\["workbench\/", "0\.8", "monthly"\]/);
  assert.match(read('.github/workflows/pages.yml'), /node --test tools\/workbench-test\.mjs/);
  assert.match(read('public/updates/updates-data.js'), /id: 'workbench'/);
  const notice = read('public/workbench/samples/NOTICE.txt');
  for (const f of fs.readdirSync(new URL('public/workbench/samples/', ROOT))) if (f !== 'NOTICE.txt') assert.ok(notice.includes(f), `NOTICE 里没写 ${f}`);
  // 每个标签都登记了，编号不重复
  const tabs = [...['wb-tab-path.js', 'wb-tab-wfn.js', 'wb-tab-spec.js', 'workbench.js'].map((f) => read(`public/workbench/${f}`)).join('\n').matchAll(/\{ id: '(\w+)', n: (\d+), zh: '/g)].map((m) => [m[1], +m[2]]);
  assert.deepEqual(tabs.map((t) => t[1]).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 9]);
  assert.equal(new Set(tabs.map((t) => t[0])).size, tabs.length);
  // 生成的原子密度表没有被手改（文件头写着由 promol.py 生成）
  assert.match(read('public/workbench/wb-promol.js'), /^\/\* Generated by tools\/workbench\/promol\.py/);
});
