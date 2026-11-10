// 开源代码台（public/code/code-core.js）的纯逻辑测试：node --test tools/code-test.mjs
// 输入文件生成器：每个程序的关键字都对、电荷和多重度自洽检查对；本机装了 PySCF（pip install pyscf）时，
// 真的跑一遍生成的脚本，对照参考能量，再用输出解读读回来（CODE_SKIP_PYTHON=1 跳过）。
// 输出解读：xTB、ORCA、Psi4、Gaussian 的片段照这些程序真实输出的格式写，PySCF 的是本机实跑的输出。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const C = require('../public/code/code-core.js');

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
