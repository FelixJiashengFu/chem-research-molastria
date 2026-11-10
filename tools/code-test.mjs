// 开源代码台（public/code/code-core.js）的纯逻辑测试：node --test tools/code-test.mjs
// 输入文件生成器：每个程序的关键字都对、电荷和多重度自洽检查对；本机装了 PySCF（pip install pyscf）时，
// 真的跑一遍生成的脚本，对照参考能量，再用输出解读读回来（CODE_SKIP_PYTHON=1 跳过）。
// 输出解读：xTB、ORCA、Psi4、Gaussian 的片段照这些程序真实输出的格式写，PySCF 的是本机实跑的输出；
// NWChem、CP2K、Q-Chem 用 tools/code-fixtures/ 里的真实输出（来源见那里的 README），本机有 nwchem、cp2k.psmp 时也真跑一遍。
// 从 SMILES 生成坐标（public/viewer/smiles3d.js）：用 tools/e2e 装的 openchemlib（npm ci --prefix tools/e2e），没装就跳过。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const C = require('../public/code/code-core.js');
const DEMOS = require('../public/code/code-demos.js');
const S3 = require('../public/viewer/smiles3d.js');
const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (f) => readFileSync(join(HERE, 'code-fixtures', f), 'utf8');

const WATER = '3\nwater\nO 0.000000 0.000000 0.117300\nH 0.000000 0.757200 -0.469200\nH 0.000000 -0.757200 -0.469200\n';
const w = C.parseXYZ(WATER).atoms;
const o2 = C.parseXYZ('O 0 0 0.6\nO 0 0 -0.6').atoms;

test('XYZ：标准格式、裸坐标、原子序数、标签和错误', () => {
  const r = C.parseXYZ(WATER);
  assert.deepEqual(r.errors, []);
  assert.equal(r.comment, 'water');
  assert.equal(C.formula(r.atoms), 'H2O');
  assert.equal(C.parseXYZ('8 0 0 0\n1 0 0 1').atoms[0].el, 'O');
  assert.deepEqual(C.parseXYZ('c1 0 0 0\nCL 1 0 0\nh_a 0 1 0').atoms.map((a) => a.el), ['C', 'Cl', 'H']);
  assert.equal(C.formula(C.parseXYZ('C 0 0 0\nH 1 0 0\nH 0 1 0\nH 0 0 1\nCl 1 1 1').atoms), 'CH3Cl');
  assert.match(C.parseXYZ('4\n\nO 0 0 0\nH 0 0 1').errors[0], /4 个原子，实际读到 2 个/);
  assert.match(C.parseXYZ('Xx 0 0 0').errors[0], /读不懂/);
  assert.match(C.parseXYZ('').errors[0], /没有读到原子/);
});

test('电荷与多重度：偶数电子配奇数多重度', () => {
  assert.equal(C.checkSpin(w, 0, 1).ok, true);
  assert.equal(C.checkSpin(w, 0, 1).electrons, 10);
  assert.equal(C.checkSpin(w, 0, 2).ok, false);
  assert.equal(C.checkSpin(w, 1, 2).ok, true); // H2O⁺ 双重态
  assert.equal(C.checkSpin(o2, 0, 3).ok, true); // 三重态氧
  assert.match(C.checkSpin(w, 11, 1).message, /没有电子/);
  assert.match(C.checkSpin(C.parseXYZ('H 0 0 0').atoms, 0, 4).message, /最多 1 个未成对/);
  assert.equal(C.checkSpin(w, 0.5, 1).ok, false);
});

test('输入生成：每个程序的关键字', () => {
  const g = (p, o) => C.generate(p, w, { name: 'w', ...o });
  let r = g('pyscf', { method: 'B3LYP', basis: 'def2-svp', task: 'optfreq', d3: true });
  assert.match(r.text, /dft\.RKS\(mol\)\nmf\.xc = "b3lyp"/);
  assert.match(r.text, /mf\.disp = "d3bj"/);
  assert.match(r.text, /geometric_solver import optimize/);
  assert.match(r.text, /harmonic_analysis/);
  assert.match(C.generate('pyscf', o2, { method: 'HF', mult: 3 }).text, /spin=2[\s\S]*scf\.UHF\(mol\)/);
  r = g('pyscf', { method: 'CCSD(T)', task: 'opt' });
  assert.match(r.text, /scf\.RHF\(mol\)/, 'post-HF 从 RHF 出发');
  assert.doesNotMatch(r.text, /optimize/);
  assert.match(r.notes.join(), /先用 DFT 优化/);
  assert.equal(g('pyscf', { method: 'GFN2-xTB' }).supported, false);

  r = g('psi4', { method: 'B3LYP', d3: true, task: 'optfreq' });
  assert.match(r.text, /molecule \{\n  0 1\n/);
  assert.match(r.text, /optimize\('b3lyp-d3bj'\)\nfrequency\('b3lyp-d3bj'\)/);
  assert.match(C.generate('psi4', o2, { method: 'B3LYP', mult: 3 }).text, /reference uks/);
  assert.match(g('psi4', { method: 'HF' }).text, /energy\('scf'\)/);

  r = C.generate('xtb', o2, { method: 'GFN2-xTB', mult: 3, task: 'optfreq', solvent: 'water', name: 'o2' });
  assert.equal(r.run, 'xtb o2.xyz --ohess --gfn 2 --chrg 0 --uhf 2 --alpb water');
  assert.match(r.text, /^2\n/);
  assert.equal(g('xtb', { method: 'GFN-FF', task: 'opt' }).run, 'xtb w.xyz --opt --gfnff --chrg 0 --uhf 0');
  assert.equal(g('crest', { method: 'GFN2-xTB' }).run, 'crest w.xyz --gfn2 --chrg 0 --uhf 0 -T 4');

  r = g('orca', { method: 'B3LYP', basis: 'def2-tzvp', task: 'optfreq', d3: true, solvent: 'water' });
  assert.match(r.text, /^! B3LYP def2-TZVP D3BJ Opt Freq CPCM\(water\)\n/);
  assert.match(r.text, /\* xyz 0 1\n/);
  assert.match(C.generate('orca', o2, { method: 'CCSD(T)', basis: 'def2-svp', mult: 3 }).text, /^! CCSD\(T\) def2-SVP UHF def2-SVP\/C/);
  assert.match(g('orca', { method: 'GFN2-xTB', task: 'opt' }).text, /^! XTB2 Opt/);

  r = g('gaussian', { method: 'PBE0', basis: '6-31g*', task: 'optfreq', d3: true, solvent: 'water' });
  assert.match(r.text, /#p PBE1PBE\/6-31G\(d\) Opt Freq EmpiricalDispersion=GD3BJ SCRF=\(SMD,Solvent=Water\)/);
  assert.match(r.text, /\n0 1\nO /);
  assert.ok(r.text.endsWith('\n\n'), 'Gaussian 输入以空行结尾');
  assert.match(C.generate('gaussian', o2, { method: 'B3LYP', mult: 3 }).text, /#p UB3LYP\//);

  r = g('nwchem', { method: 'PBE', task: 'opt', d3: true });
  assert.match(r.text, /xc xpbe96 cpbe96\n  mult 1\n  disp vdw 4/);
  assert.match(r.text, /task dft optimize/);
  assert.match(C.generate('nwchem', o2, { method: 'HF', mult: 3 }).text, /uhf\n  nopen 2[\s\S]*task scf energy/);

  r = g('cp2k', { method: 'PBE', task: 'opt' });
  assert.match(r.text, /RUN_TYPE GEO_OPT/);
  assert.match(r.text, /POTENTIAL GTH-PBE-q6/);
  assert.match(r.text, /POTENTIAL GTH-PBE-q1/);
  assert.match(r.text, /ABC 10 12 11/, '分子大小加 10 Å 真空，向上取整');
  assert.match(g('cp2k', { method: 'GFN1-xTB' }).text, /METHOD xTB[\s\S]*GFN_TYPE 1/);
  r = g('cp2k', { method: 'GFN2-xTB' }); // CP2K 2026.2 只认 GFN_TYPE 0、1、TBLITE；写 2 会报 invalid value for enumeration（见 code-fixtures/cp2k-input-abort.out）
  assert.match(r.text, /GFN_TYPE TBLITE\n\s+&TBLITE\n\s+METHOD GFN2\n\s+&END TBLITE/);
  assert.doesNotMatch(r.text, /GFN_TYPE 2/);
  assert.ok(r.notes.some((n) => /tblite/.test(n)));
  assert.equal(g('cp2k', { method: 'GFN-FF' }).supported, false);

  r = g('ase', { method: 'GFN2-xTB', task: 'optfreq' });
  assert.match(r.text, /TBLite\(method="GFN2-xTB", charge=0, multiplicity=1\)/);
  assert.match(r.text, /BFGS[\s\S]*Vibrations/);
});

test('QCSchema：坐标换成 bohr，优化用 optimization_input', () => {
  const d = JSON.parse(C.generate('qcschema', w, { method: 'B3LYP', basis: 'cc-pvdz' }).text);
  assert.equal(d.schema_name, 'qcschema_input');
  assert.equal(d.driver, 'energy');
  assert.deepEqual(d.model, { method: 'b3lyp', basis: 'cc-pvdz' });
  assert.deepEqual(d.molecule.symbols, ['O', 'H', 'H']);
  assert.ok(Math.abs(d.molecule.geometry[4] - 0.7572 / 0.529177210903) < 1e-7);
  assert.equal(d.molecule.molecular_multiplicity, 1);
  const o = JSON.parse(C.generate('qcschema', o2, { method: 'HF', mult: 3, task: 'opt' }).text);
  assert.equal(o.schema_name, 'qcschema_optimization_input');
  assert.equal(o.input_specification.driver, 'gradient');
  assert.equal(o.input_specification.keywords.reference, 'uhf');
  assert.equal(JSON.parse(C.generate('qcschema', w, { task: 'freq' }).text).driver, 'hessian');
});

// ── 输出解读 ──
const XTB = `      -----------------------------------------------------------
     |                   =====================                   |
     |                           x T B                           |
     |                   =====================                   |
      -----------------------------------------------------------
   * xtb version 6.7.1 (edcfbbe) compiled by 'conda@1efc2f54142f' on 2024-07-22
   *** GEOMETRY OPTIMIZATION CONVERGED AFTER 5 ITERATIONS ***
           -------------------------------------------------
          |               Frequency Printout                |
           -------------------------------------------------
 projected vibrational frequencies (6 translations/rotations projected out)
eigval :       -0.00    -0.00    -0.00     0.00     0.00     0.00
eigval :     1539.13  3643.62  3651.66
 reduced masses (amu)
           -------------------------------------------------
          | TOTAL ENERGY               -5.070544440612 Eh   |
          | GRADIENT NORM               0.000057213433 Eh/α |
          | HOMO-LUMO GAP              14.645949553209 eV   |
           -------------------------------------------------
   * finished run on 2026/11/10 at 06:00:00.000
 normal termination of xtb
`;
const ORCA = `                                 *****************
                                 * O   R   C   A *
                                 *****************
               *** SCF CONVERGED AFTER   9 CYCLES ***
----------------
ORBITAL ENERGIES
----------------

  NO   OCC          E(Eh)            E(eV)
   0   2.0000     -19.141519      -520.8672
   3   2.0000      -0.313127        -8.5206
   4   2.0000      -0.247063        -6.7229
   5   0.0000       0.009880         0.2689
   6   0.0000       0.083641         2.2760

                    ********************************
                    * MULLIKEN POPULATION ANALYSIS *
                    ********************************
                    ***        THE OPTIMIZATION HAS CONVERGED     ***
-------------------------   --------------------
FINAL SINGLE POINT ENERGY       -76.407993545624
-------------------------   --------------------
-----------------------
VIBRATIONAL FREQUENCIES
-----------------------

Scaling factor for frequencies =  1.000000000  (already applied!)

     0:         0.00 cm**-1
     5:         0.00 cm**-1
     6:      -212.37 cm**-1 ***imaginary mode***
     7:      1626.37 cm**-1
     8:      3812.36 cm**-1


------------
NORMAL MODES
------------
                             ****ORCA TERMINATED NORMALLY****
`;
const PSI4 = `    Psi4: An Open-Source Ab Initio Electronic Structure Package
    Orbital Energies [Eh]
    ---------------------

    Doubly Occupied:

       1A    -20.557846     2A     -1.316181     3A     -0.677073
       4A     -0.558726     5A     -0.490383

    Virtual:

       6A      0.178011     7A      0.249490

    Final Occupation by Irrep:
  @DF-RHF Final Energy:   -76.02663273410671
	-----------------------------------------------------------
	 ==================> DF-MP2 Energies <====================
	-----------------------------------------------------------
	 Reference Energy          =     -76.0266327341067112 [Eh]
	 Correlation Energy        =      -0.2033051587254410 [Eh]
	 Total Energy              =     -76.2299378928321547 [Eh]
  Freq [cm^-1]                1625.84             3801.31             3905.24
    Optimization is complete!
*** Psi4 exiting successfully. Buy a developer a beer!
`;
const GAUSS = ` Entering Gaussian System, Link 0=g16
 SCF Done:  E(RB3LYP) =  -76.4089533787     A.U. after   10 cycles
 Optimization completed.
    -- Stationary point found.
 **********************************************************************

            Population analysis using the SCF Density.

 **********************************************************************
 Alpha  occ. eigenvalues --  -19.13780  -0.99800  -0.52102  -0.37394  -0.29140
 Alpha virt. eigenvalues --    0.06454   0.15142   0.75532   0.82341
 Frequencies --   1647.4237              3801.7062              3905.6711
 Normal termination of Gaussian 16 at Tue Nov 10 06:00:00 2026.
`;

test('输出解读：xTB', () => {
  const r = C.parseOutput(XTB);
  assert.equal(r.program, 'xtb');
  assert.equal(r.energy, -5.070544440612);
  assert.equal(r.gap, 14.645949553209);
  assert.deepEqual(r.freqs, [1539.13, 3643.62, 3651.66]);
  assert.equal(r.optConverged, true);
  assert.equal(r.normal, true);
  assert.deepEqual(r.warnings, []);
});

test('输出解读：ORCA（一个虚频）', () => {
  const r = C.parseOutput(ORCA);
  assert.equal(r.program, 'orca');
  assert.equal(r.energy, -76.407993545624);
  assert.ok(Math.abs(r.gap - (0.2689 - -6.7229)) < 1e-9);
  assert.deepEqual(r.freqs, [-212.37, 1626.37, 3812.36]);
  assert.deepEqual(r.imaginary, [-212.37]);
  assert.match(r.warnings.join(), /1 个虚频/);
  assert.equal(r.scfConverged, true);
  assert.equal(r.optConverged, true);
  assert.equal(r.normal, true);
});

test('输出解读：Psi4（MP2 能量优先于 SCF）', () => {
  const r = C.parseOutput(PSI4);
  assert.equal(r.program, 'psi4');
  assert.equal(r.energy, -76.2299378928321547);
  assert.equal(r.energyLabel, 'MP2 Total Energy');
  assert.ok(Math.abs(r.gap - (0.178011 - -0.490383) * C.HARTREE_EV) < 1e-9);
  assert.deepEqual(r.freqs, [1625.84, 3801.31, 3905.24]);
  assert.equal(r.normal, true);
  const i = C.parseOutput('Psi4: An Open-Source Ab Initio\n  Freq [cm^-1]   312.40i   1625.84\n  @RKS Final Energy:   -76.3\nPsiException: Could not converge SCF iterations in 100 iterations.');
  assert.deepEqual(i.imaginary, [-312.4]);
  assert.equal(i.scfConverged, false);
  assert.equal(i.normal, false);
});

test('输出解读：Gaussian（定宽数字连在一起也能拆）', () => {
  const r = C.parseOutput(GAUSS);
  assert.equal(r.program, 'gaussian');
  assert.equal(r.energy, -76.4089533787);
  assert.equal(r.energyLabel, 'SCF Done: E(RB3LYP)');
  assert.ok(Math.abs(r.gap - (0.06454 - -0.29140) * C.HARTREE_EV) < 1e-9);
  assert.equal(r.optConverged, true);
  assert.equal(r.normal, true);
  const mp = C.parseOutput(' Entering Gaussian System\n SCF Done:  E(RHF) =  -76.02  A.U.\n E2 =    -0.2013D+00 EUMP2 =    -0.76229D+02\n Error termination via Lnk1e');
  assert.equal(mp.energy, -76.229);
  assert.equal(mp.normal, false);
  assert.deepEqual(C.parseOutput(' Frequencies -- -1234.5678-1000.1234   12.3456\n Entering Gaussian System').imaginary, [-1234.5678, -1000.1234]);
});

test('输出解读：认不出的输出、能量差换算', () => {
  const r = C.parseOutput('hello');
  assert.equal(r.program, '');
  assert.match(r.warnings[0], /认不出/);
  const d = C.energyDiff(-76.0, -75.9);
  assert.ok(Math.abs(d.kcal - 62.7509474) < 1e-6);
  assert.ok(Math.abs(d.ev - 2.7211386245988) < 1e-9);
  assert.ok(Math.abs(d.kj - 262.5499639) < 1e-6);
});

test('许可证：各族的结论', () => {
  const v = (s) => C.licenceVerdict(s);
  assert.equal(v('MIT').family, 'permissive');
  assert.equal(v('BSD-3-Clause').verdicts.web, 'ok');
  assert.equal(v('Apache Software License').family, 'apache');
  assert.equal(v('License :: OSI Approved :: GNU Lesser General Public License v3 (LGPLv3)').family, 'lgpl');
  assert.equal(v('LGPL-3.0-or-later').verdicts.desktop, 'cond');
  assert.equal(v('GPL-2.0-only').verdicts.web, 'no');
  assert.equal(v('GPL-3.0').verdicts.service, 'ok');
  assert.equal(v('AGPL-3.0-only').verdicts.service, 'cond');
  assert.equal(v('MPL-2.0').verdicts.web, 'cond');
  assert.equal(v('CC-BY-NC-4.0').verdicts.web, 'no');
  assert.equal(v('CC-BY-SA-4.0').family, 'ccbysa');
  assert.equal(v('CC-BY-4.0').family, 'ccby');
  assert.equal(v('NOASSERTION').family, 'none');
  assert.equal(v('').verdicts.web, 'no');
  assert.equal(v('MIT OR GPL-3.0').family, 'permissive', 'OR 取最宽松');
  assert.equal(v('MIT AND GPL-3.0').family, 'gpl', 'AND 取最严');
  assert.equal(v('(Apache-2.0 OR MIT) AND LGPL-2.1').family, 'lgpl');
  for (const [use] of C.USES) assert.equal(v('NOASSERTION').verdicts.link === 'ok' && use ? true : false, true);
});

test('代码搜索：语言和计算化学仓库的筛选', () => {
  assert.deepEqual(C.searchLinks('  '), []);
  const L = C.searchLinks('def kernel', { lang: 'python', chem: true });
  const by = Object.fromEntries(L.map((x) => [x.id, decodeURIComponent(x.url)]));
  assert.match(by.github, /q=def kernel language:Python \(repo:pyscf\/pyscf OR repo:psi4\/psi4/);
  assert.match(by.github, /&type=code$/);
  assert.match(by.sourcegraph, /context:global def kernel lang:python repo:\^github\\\.com\/\(pyscf\/pyscf\|/);
  assert.match(by.grep, /filter\[lang\]\[0\]=Python/);
  assert.match(by.grep, /filter\[repo\]\[0\]=pyscf\/pyscf/);
  assert.match(C.searchLinks('x', { lang: 'cpp' })[0].url, /language%3A%22C%2B%2B%22/);
  assert.equal(L.length, 5);
});

test('软件体检：输入判断、PyPI 与 OSV 的整理', () => {
  assert.deepEqual(C.parseTarget('PySCF'), { kind: 'pypi', name: 'pyscf' });
  assert.equal(C.parseTarget('pyscf_dispersion').name, 'pyscf-dispersion');
  assert.deepEqual(C.parseTarget('https://github.com/grimme-lab/xtb.git'), { kind: 'github', owner: 'grimme-lab', repo: 'xtb', url: 'https://github.com/grimme-lab/xtb' });
  assert.equal(C.parseTarget('github.com/pyscf/pyscf/tree/master').repo, 'pyscf');
  assert.equal(C.parseTarget('https://gitlab.com/ase/ase').kind, 'gitlab');
  assert.equal(C.parseTarget('什么').kind, '');
  // 2026-11-10 https://pypi.org/pypi/pyscf/json 的相关字段
  const s = C.summarizePypi({ info: { name: 'pyscf', version: '2.15.0', license: 'Apache-2.0', license_expression: null, requires_python: '>=3.9', home_page: null, summary: 'PySCF: Python-based Simulations of Chemistry Framework', project_urls: { Documentation: 'http://www.pyscf.org', Homepage: 'http://www.pyscf.org', Repository: 'https://github.com/pyscf/pyscf' }, classifiers: ['License :: OSI Approved :: Apache Software License'] }, urls: [{ upload_time_iso_8601: '2026-11-05T05:41:29.587646Z' }] });
  assert.equal(s.licence, 'Apache-2.0');
  assert.equal(s.repo.url, 'https://github.com/pyscf/pyscf');
  assert.equal(s.released, '2026-11-05');
  assert.equal(C.summarizePypi({ info: { license: 'Copyright (c) 2020\nPermission is hereby granted…', classifiers: ['License :: OSI Approved :: MIT License'] } }).licence, 'MIT License');
  assert.equal(C.summarizePypi({ info: { license_expression: 'LGPL-3.0-or-later' } }).licence, 'LGPL-3.0-or-later');
  const v = C.summarizeOsv({ vulns: [{ id: 'GHSA-xxxx-yyyy', aliases: ['CVE-2024-1', 'PYSEC-1'], details: 'first line\nmore', database_specific: { severity: 'HIGH' } }] });
  assert.deepEqual(v, [{ id: 'GHSA-xxxx-yyyy', aliases: ['CVE-2024-1'], summary: 'first line', severity: 'HIGH', url: 'https://osv.dev/vulnerability/GHSA-xxxx-yyyy' }]);
  assert.deepEqual(C.summarizeOsv({}), []);
});

test('XYZ：多帧（构象、自旋态、轨迹）选一帧', () => {
  const two = `${WATER}3\nwater, stretched\nO 0 0 0.2\nH 0 0.8 -0.5\nH 0 -0.8 -0.5\n`;
  let r = C.parseXYZ(two);
  assert.equal(r.frames, 2);
  assert.equal(r.frame, 0);
  assert.deepEqual(r.comments, ['water', 'water, stretched']);
  assert.equal(r.atoms[0].z, 0.1173);
  r = C.parseXYZ(two, 1);
  assert.equal(r.comment, 'water, stretched');
  assert.equal(r.atoms[0].z, 0.2);
  assert.equal(C.parseXYZ(two, 9).frame, 1, '超出范围就用最后一帧');
  assert.equal(C.parseXYZ(two, -3).frame, 0);
  // 帧之间可以有空行，原子数可以不同（反应里的几个分子）
  r = C.parseXYZ(`2\nH2\nH 0 0 0\nH 0 0 0.74\n\n${WATER}`, 1);
  assert.equal(r.frames, 2);
  assert.equal(C.formula(r.atoms), 'H2O');
  // 单帧照旧；不像多帧的文字也照单帧读，原来的报错不变
  assert.equal(C.parseXYZ(WATER).frames, 1);
  assert.equal(C.splitFrames(WATER), null);
  assert.match(C.parseXYZ('4\n\nO 0 0 0\nH 0 0 1').errors[0], /4 个原子，实际读到 2 个/);
  assert.equal(C.splitFrames('O 0 0 0\nH 0 0 1'), null);
});

// ── NWChem、CP2K、Q-Chem：真实输出 ──
const near = (a, b, tol, msg) => assert.ok(a !== null && Math.abs(a - b) < tol, `${msg || ''} ${a} ≠ ${b}`);
const OUTS = [
  // [文件, 程序, 能量, { 其他要核对的 }]
  ['nwchem-water-b3lyp-optfreq.out', 'nwchem', -76.407024141046, { normal: true, scf: true, opt: true, gap: 9.673, freqs: [1710.83, 3721.07, 3844.86] }],
  ['nwchem-water-mp2.out', 'nwchem', -76.230775616089, { normal: true, label: /MP2/ }],
  ['nwchem-water-ccsdt.out', 'nwchem', -75.01252910731762, { normal: true, label: /CCSD\(T\)/ }],
  ['nwchem-o2-uhf.out', 'nwchem', -147.633942066969, { normal: true, gap: 18.638, gapNote: true }],
  ['nwchem-o2-tce-ccsdt.out', 'nwchem', -147.74259162487206, { normal: true, label: /CCSD\(T\).*TCE/, gap: 18.638, gapNote: true }],
  ['nwchem-scf-fail.out', 'nwchem', undefined, { normal: false, scf: false, error: 'dft energy failed' }],
  ['nwchem-opt-fail.out', 'nwchem', undefined, { normal: false, opt: false, error: 'dft optimize failed' }],
  ['nwchem-input-error.out', 'nwchem', null, { normal: false, error: 'scf_input: unrecognized directive' }],
  ['cp2k-water-pbe-opt.out', 'cp2k', -17.219621443226934, { normal: true, scf: true, opt: true, gap: null }],
  ['cp2k-water-pbe-freq.out', 'cp2k', null, { normal: true, freqs: [1577.11, 3878.43, 3986.16], warn: /PROJECT-r-0\.out/ }],
  ['cp2k-o2-uks.out', 'cp2k', -31.927136079422276, { normal: true, scf: true }],
  ['cp2k-water-gfn1.out', 'cp2k', -5.768733676277428, { normal: true, scf: true }],
  ['cp2k-scf-fail.out', 'cp2k', null, { normal: false, scf: false, error: /^SCF run NOT converged/ }],
  ['cp2k-opt-fail.out', 'cp2k', -17.219605246001397, { normal: true, opt: false }],
  ['cp2k-input-abort.out', 'cp2k', null, { normal: false, error: 'invalid value for enumeration:2' }],
  ['qchem-dvb-gopt.out', 'qchem', -382.3082955186, { normal: true, opt: true, gap: 5.170 }],
  ['qchem-dvb-raman.out', 'qchem', -382.3004424119, { normal: true, imaginary: [-106.88, -102.92], nfreqs: 54 }],
  ['qchem-dvb-cation-uhf.out', 'qchem', -382.0653088345, { normal: true, gap: 1.823, gapNote: true }],
  ['qchem-water-ccsdt.out', 'qchem', -75.0177603, { label: /CCSD\(T\)/ }],
  ['qchem-water-mp2.out', 'qchem', -75.00228214, { label: /MP2/ }],
  ['qchem-water-ir-anharm.out', 'qchem', -75.2909617066, { freqs: [1860.1, 3939.13, 4272.66] }], // 非谐分析后面又印一遍频率，只算一次
  ['qchem6-water-smd.out', 'qchem', -74.9672988069, { normal: true }],
];
for (const [file, prog, energy, x] of OUTS) {
  test(`输出解读：${file}`, () => {
    const r = C.parseOutput(fixture(file));
    assert.equal(r.program, prog);
    if (energy === null) assert.equal(r.energy, null);
    else if (energy !== undefined) near(r.energy, energy, 1e-9, 'E');
    if ('normal' in x) assert.equal(r.normal, x.normal);
    if ('scf' in x) assert.equal(r.scfConverged, x.scf);
    if ('opt' in x) assert.equal(r.optConverged, x.opt);
    if (x.gap === null) assert.equal(r.gap, null);
    else if (x.gap !== undefined) near(r.gap, x.gap, 5e-4, 'gap');
    if (x.gapNote) assert.match(r.gapNote, /开壳层/);
    else assert.equal(r.gapNote, '');
    if (x.label) assert.match(r.energyLabel, x.label);
    if (x.freqs) { assert.equal(r.freqs.length, x.freqs.length); x.freqs.forEach((v, i) => near(r.freqs[i], v, 0.01, `ν${i + 1}`)); }
    if (x.nfreqs) assert.equal(r.freqs.length, x.nfreqs);
    if (x.imaginary) assert.deepEqual(r.imaginary, x.imaginary);
    else assert.deepEqual(r.imaginary, []);
    if (x.error instanceof RegExp) assert.match(r.errorText, x.error);
    else if (x.error) assert.equal(r.errorText, x.error);
    if (x.error) assert.ok(r.warnings.some((w) => w.includes(r.errorText)), '报错写进提示');
    if (x.warn) assert.ok(r.warnings.some((w) => x.warn.test(w)), r.warnings.join(' / '));
    // 程序选错了也不该读出别家的东西；自动识别和指定程序结果一样
    assert.deepEqual(C.parseOutput(fixture(file), prog), r);
  });
}

test('输出解读：NWChem 里正常的 CCSD 也会印 “IO error message >End of File”，不算出错', () => {
  const t = fixture('nwchem-water-ccsdt.out');
  assert.match(t, /IO error message >End of File\n\s+file_read_ga: failing reading[\s\S]*Failed reading restart vector/);
  const r = C.parseOutput(t);
  assert.equal(r.normal, true);
  assert.equal(r.errorText, '');
});

test('输出解读：Q-Chem 的报错（照手册格式写的一段，没有真实样本）', () => {
  const t = ' Welcome to Q-Chem\n\n Q-Chem fatal error occurred in module /home/qchem/libgen/molecule.C, line 1234:\n\n  Wrong number of electrons for given multiplicity\n\n';
  const r = C.parseOutput(t);
  assert.equal(r.program, 'qchem');
  assert.equal(r.normal, false);
  assert.equal(r.errorText, 'Wrong number of electrons for given multiplicity');
});

test('读输出的示例：每一段都能读对', () => {
  assert.deepEqual(Object.keys(DEMOS), ['orca', 'nwchem', 'cp2k', 'qchem']);
  const r = Object.fromEntries(Object.entries(DEMOS).map(([k, t]) => [k, C.parseOutput(t)]));
  for (const k of Object.keys(DEMOS)) assert.equal(r[k].program, k);
  assert.deepEqual(r.orca.imaginary, [-212.37]);
  near(r.nwchem.energy, -76.407024141046, 1e-12);
  assert.deepEqual(r.nwchem.freqs, [1710.83, 3721.07, 3844.86]);
  near(r.nwchem.gap, 9.673, 5e-4);
  assert.equal(r.cp2k.optConverged, false);
  assert.match(r.qchem.gapNote, /开壳层/);
  // 示例里的数字都摘自真实输出：每一行能在对应的样本文件里找到
  for (const [k, file] of [['cp2k', 'cp2k-opt-fail.out'], ['qchem', 'qchem-dvb-cation-uhf.out'], ['nwchem', 'nwchem-water-b3lyp-optfreq.out']]) {
    const src = new Set(fixture(file).split('\n'));
    for (const line of DEMOS[k].split('\n')) if (line.trim()) assert.ok(src.has(line), `${k}: ${line}`);
  }
});

// ── 从 SMILES 生成三维坐标（OpenChemLib） ──
const OCL_PATH = join(HERE, 'e2e', 'node_modules', 'openchemlib', 'dist', 'openchemlib.js');
let OCL = null;
if (existsSync(OCL_PATH)) {
  OCL = await import(pathToFileURL(OCL_PATH).href);
  OCL.Resources.registerFromNodejs();
}
const noOCL = !OCL && '没装 openchemlib（npm ci --prefix tools/e2e）';
const pos = (r, k = 0) => r.frames[k].atoms;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** 手性中心四个邻居的有符号体积：两个对映体符号相反。 */
function chiralVolume(atoms, c, nbrs) {
  const [a, b, d] = nbrs.map((i) => [atoms[i].x - atoms[c].x, atoms[i].y - atoms[c].y, atoms[i].z - atoms[c].z]);
  return a[0] * (b[1] * d[2] - b[2] * d[1]) - a[1] * (b[0] * d[2] - b[2] * d[0]) + a[2] * (b[0] * d[1] - b[1] * d[0]);
}
const neighbours = (atoms, i, cut = 1.7) => atoms.map((a, j) => [j, dist(a, atoms[i])]).filter(([j, d]) => j !== i && d < cut).map(([j]) => j);

test('SMILES → 坐标：小分子、电荷、自由基、键长合理', { skip: noOCL }, () => {
  let r = S3.embed(OCL, 'O');
  assert.equal(r.frames.length, 1);
  assert.equal(C.formula(pos(r)), 'H2O');
  for (const h of [1, 2]) near(dist(pos(r)[0], pos(r)[h]), 0.97, 0.05, 'O–H');
  assert.deepEqual([r.charge, r.mult, r.warnings], [0, 1, []]);
  r = S3.embed(OCL, 'CC(=O)[O-]');
  assert.deepEqual([r.charge, r.mult], [-1, 1]);
  assert.equal(C.checkSpin(pos(r), r.charge, r.mult).ok, true);
  r = S3.embed(OCL, '[NH4+]');
  assert.deepEqual([r.charge, C.formula(pos(r))], [1, 'H4N']);
  r = S3.embed(OCL, '[CH3]');
  assert.deepEqual([r.unpaired, r.mult], [1, 2]);
  assert.ok(r.warnings.includes('radical'));
  assert.equal(C.checkSpin(pos(r), r.charge, r.mult).ok, true);
  r = S3.embed(OCL, '[Na+].[Cl-]');
  assert.ok(r.warnings.includes('fragments'));
  // 几何中心在原点；多帧 XYZ 能被代码台读回来
  r = S3.embed(OCL, 'CCCC');
  const c = pos(r).reduce((s, a) => s + a.x + a.y + a.z, 0);
  near(c, 0, 1e-4, '中心');
  const xyz = S3.toXYZ(r);
  const back = C.parseXYZ(xyz, r.frames.length - 1);
  assert.equal(back.frames, r.frames.length);
  assert.deepEqual(back.errors, []);
  assert.match(back.comments[0], /^conformer 1\/\d+ from SMILES CCCC \| MMFF94s\+ E = -?\d+\.\d{3} kcal\/mol$/);
  for (let k = 1; k < r.frames.length; k++) assert.ok(r.frames[k].energy >= r.frames[k - 1].energy, '按能量排好');
});

test('SMILES → 坐标：立体构型照写的来（L / D 丙氨酸、顺反二氟乙烯）', { skip: noOCL }, () => {
  const sign = (smi) => {
    const r = S3.embed(OCL, smi);
    assert.equal(r.unspecified, 0);
    return r.frames.map((f) => {
      const a = f.atoms, ca = 1; // C[C@H](N)C(=O)O：第 1 个原子是 α 碳
      const heavy = neighbours(a, ca).filter((j) => a[j].el !== 'H').sort((x, y) => x - y); // 甲基 C0、N2、羧基 C3
      return Math.sign(chiralVolume(a, ca, heavy));
    });
  };
  const L = sign('C[C@H](N)C(=O)O'), D = sign('C[C@@H](N)C(=O)O');
  assert.ok(L.every((s) => s === L[0]) && D.every((s) => s === D[0]), '每个构象都是同一个对映体');
  assert.equal(L[0], -D[0], 'L 和 D 符号相反');
  const ff = (smi) => { const a = pos(S3.embed(OCL, smi)); const f = a.map((x, i) => [x, i]).filter(([x]) => x.el === 'F'); return dist(f[0][0], f[1][0]); };
  const trans = ff('F/C=C/F'), cis = ff('F/C=C\\F');
  assert.ok(trans > 3.3 && cis < 3.0, `反式 F–F ${trans.toFixed(2)} Å，顺式 ${cis.toFixed(2)} Å`);
});

test('SMILES → 坐标：没写的构型定成一种并提示，坏 SMILES 和力场不认识的分子', { skip: noOCL }, () => {
  let r = S3.embed(OCL, 'CC(N)C(=O)O');
  assert.equal(r.unspecified, 1);
  assert.ok(r.warnings.includes('unspecified'));
  assert.match(r.fixedSmiles, /@/);
  assert.equal(r.stereoSmiles, r.fixedSmiles);
  r = S3.embed(OCL, 'O=O');
  assert.ok(r.warnings.includes('no-forcefield'));
  assert.equal(r.frames.length, 1);
  assert.equal(r.frames[0].energy, null);
  assert.match(S3.toXYZ(r), /not optimised/);
  assert.equal(S3.embed(OCL, '').error, 'empty');
  assert.deepEqual(S3.embed(OCL, 'c1ccccc1 C'), { error: 'parse', detail: 'whitespace' });
  r = S3.embed(OCL, 'C1CC');
  assert.equal(r.error, 'parse');
  assert.match(r.detail, /ring closure/);
  r = S3.embed(OCL, 'C'.repeat(101));
  assert.deepEqual([r.error, r.heavy, r.max], ['big', 101, 100]);
});

// ── 真的跑 PySCF ──
let hasPyscf = false;
if (!process.env.CODE_SKIP_PYTHON) {
  try { execFileSync('python3', ['-c', 'import pyscf'], { stdio: 'ignore' }); hasPyscf = true; } catch { /* 没装 */ }
}
test('生成的 PySCF 脚本能跑：水 HF/STO-3G 单点和频率、氧气三重态 UHF，输出解读读回来', { skip: !hasPyscf && '本机没装 PySCF（pip install pyscf）' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'code-test-'));
  try {
    const run = (atoms, o) => {
      const g = C.generate('pyscf', atoms, { name: 't', ...o });
      writeFileSync(join(dir, 't.py'), g.text);
      return execFileSync('python3', ['-I', join(dir, 't.py')], { encoding: 'utf8', timeout: 300000 });
    };
    let out = run(w, { method: 'HF', basis: 'sto-3g', task: 'freq' });
    let r = C.parseOutput(out);
    assert.equal(r.program, 'pyscf');
    // 参考值：同一几何，PySCF 2.15 RHF/STO-3G
    assert.ok(Math.abs(r.energy - -74.9630231384613) < 1e-6, `E = ${r.energy}`);
    assert.equal(r.scfConverged, true);
    const fr = (/Frequencies \/ cm\^-1: \[([^\]]+)\]/.exec(out) || [])[1].trim().split(/\s+/).map(Number);
    assert.equal(fr.length, 3);
    assert.ok(fr.every((x) => x > 1500 && x < 5000), String(fr));
    out = run(o2, { method: 'HF', basis: 'sto-3g', mult: 3 });
    r = C.parseOutput(out);
    assert.match(out, /2S\+1 = 3\.0/);
    assert.ok(r.energy < -145 && r.energy > -150, `E = ${r.energy}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── 本机有 NWChem、CP2K 时真跑生成的输入（CI 里没有，跳过） ──
const onPath = (cmd) => { try { execFileSync('which', [cmd], { stdio: 'ignore', timeout: 20000 }); return true; } catch { return false; } };
const NWCHEM = !process.env.CODE_SKIP_PYTHON && onPath('nwchem');
const CP2K = !process.env.CODE_SKIP_PYTHON && (process.env.CP2K_EXE || (onPath('cp2k.psmp') ? 'cp2k.psmp' : ''));
test('生成的 NWChem 输入能跑：水 HF/STO-3G，和 PySCF 的参考能量一致', { skip: !NWCHEM && '本机没有 nwchem' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'code-nw-'));
  try {
    const g = C.generate('nwchem', w, { method: 'HF', basis: 'sto-3g', name: 't' });
    writeFileSync(join(dir, g.filename), g.text);
    const out = execFileSync('nwchem', [g.filename], { cwd: dir, encoding: 'utf8', timeout: 300000 });
    const r = C.parseOutput(out);
    assert.equal(r.program, 'nwchem');
    assert.equal(r.normal, true);
    near(r.energy, -74.9630231384613, 1e-6, 'E'); // 同一几何，PySCF RHF/STO-3G
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('生成的 CP2K 输入能跑：水 GFN1-xTB 单点', { skip: !CP2K && '本机没有 cp2k.psmp（或设 CP2K_EXE）' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'code-cp-'));
  try {
    const g = C.generate('cp2k', w, { method: 'GFN1-xTB', name: 't' });
    writeFileSync(join(dir, g.filename), g.text);
    execFileSync(CP2K, ['-i', g.filename, '-o', 't.out'], { cwd: dir, stdio: 'ignore', timeout: 300000 });
    const r = C.parseOutput(readFileSync(join(dir, 't.out'), 'utf8'));
    assert.equal(r.program, 'cp2k');
    assert.equal(r.normal, true);
    near(r.energy, -5.768733676277428, 1e-6, 'E'); // CP2K 2026.2 跑同一个输入的结果（code-fixtures/cp2k-water-gfn1.out）
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
