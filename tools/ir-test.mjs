// 代码台的红外光谱：五个程序的频率和强度读法对照 cclib（tools/code-fixtures/cclib-ir.json），展宽的面积守恒、线型、实验谱的读法。
//   node --test tools/ir-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const Code = require('../public/code/code-core.js');
const IR = require('../public/code/ir-core.js');
const fixture = (f) => readFileSync(new URL(`./code-fixtures/${f}`, import.meta.url), 'utf8');
const REF = JSON.parse(fixture('cclib-ir.json'));

test('frequencies and IR intensities match cclib for Gaussian, ORCA, Psi4, Q-Chem and NWChem', () => {
  for (const [prog, file] of [['gaussian', 'ir-gaussian16-dvb.out'], ['orca', 'ir-orca5-dvb.out'], ['psi4', 'ir-psi4-dvb.out'], ['qchem', 'ir-qchem-dvb.out'], ['nwchem', 'ir-nwchem7-dvb.out']]) {
    const r = Code.parseOutput(fixture(file));
    assert.equal(r.program, prog);
    // cclib keeps NWChem's six zero modes (translations and rotations); the reader drops them
    const want = REF[prog].freq.map((f, i) => ({ freq: f, int: REF[prog].ir[i] })).filter((m) => Math.abs(m.freq) > 1);
    assert.equal(r.ir.length, want.length, prog);
    r.ir.forEach((m, i) => { assert.ok(Math.abs(m.freq - want[i].freq) < 1e-3, `${prog} freq ${i}`); assert.ok(Math.abs(m.int - want[i].int) < 1e-3, `${prog} int ${i}`); });
    assert.equal(r.freqs.length, want.length, `${prog}: the frequency row is filled too`);
  }
  // Gaussian prints a normal block and an HPModes block: only one set is used
  const g = Code.parseOutput(fixture('ir-gaussian16-dvb.out'));
  assert.equal(g.ir[0].freq, 53.1981);
  // outputs without intensities give no spectrum
  assert.deepEqual(Code.parseOutput(fixture('xtb-water-opt.out')).ir, []);
  assert.deepEqual(Code.parseOutput(fixture('nwchem-water-b3lyp-optfreq.out')).ir, []);
});

test('line shapes have unit area and the stated width', () => {
  for (const shape of IR.SHAPES) {
    let a = 0;
    for (let d = -20000; d <= 20000; d += 0.05) a += IR.lineShape(d, 12, shape) * 0.05;
    assert.ok(Math.abs(a - 1) < 2e-3, `${shape} area ${a}`);
    const peak = IR.lineShape(0, 12, shape), half = IR.lineShape(6, 12, shape);
    assert.ok(Math.abs(half / peak - 0.5) < 1e-9, `${shape} FWHM`);
  }
});

test('broadening keeps each band area at 100 × intensity, whatever the width and shape', () => {
  const ir = [{ freq: 1700, int: 250 }, { freq: 3000, int: 40 }, { freq: -120, int: 9 }, { freq: 900, int: 0 }];
  for (const shape of IR.SHAPES) for (const fwhm of [4, 20, 60]) {
    const s = IR.broaden(ir, { fwhm, shape, from: -2000, to: 7000, step: 0.25 });
    const area = IR.integrate(s.x, s.y);
    assert.ok(Math.abs(area - 100 * 290) / (100 * 290) < 0.01, `${shape} ${fwhm}: ${area}`);
    assert.equal(s.sticks.length, 2, 'imaginary and zero-intensity modes are dropped');
  }
  // scale factor moves the peak
  const s = IR.broaden([{ freq: 2000, int: 10 }], { scale: 0.96, from: 1800, to: 2100, step: 0.5 });
  assert.equal(s.x[s.y.indexOf(s.max)], 1920);
  // peak height of a Lorentzian: 100·A·2/(π·FWHM)
  const l = IR.broaden([{ freq: 1000, int: 50 }], { fwhm: 10, from: 900, to: 1100, step: 0.5 });
  assert.ok(Math.abs(l.max - (100 * 50 * 2) / (Math.PI * 10)) < 1e-6);
  assert.deepEqual(IR.strongest(s.sticks, 3), [{ freq: 1920, int: 10 }]);
});

test('experimental spectra: two-column text, percent transmittance, and JCAMP-DX', () => {
  const abs = IR.parseExperimental('wavenumber,absorbance\n3000,0.2\n1700,1.6\n1000,0.4\n');
  assert.ok(abs.ok); assert.equal(abs.units, 'A');
  assert.deepEqual(abs.x, [1000, 1700, 3000]);
  assert.deepEqual(abs.y.map((v) => +v.toFixed(4)), [0.25, 1, 0.125]);
  const tr = IR.parseExperimental('cm-1\t%T\n3000\t95\n1700\t10\n1000\t80\n');
  assert.equal(tr.units, 'T');
  assert.equal(tr.y[1], 1, 'the deepest transmittance dip becomes the tallest peak');
  assert.ok(Math.abs(tr.y[2] - -Math.log10(0.95) / -Math.log10(0.10)) < 1e-9);
  const jdx = ['##TITLE=test compound', '##JCAMP-DX=4.24', '##XUNITS=1/CM', '##YUNITS=ABSORBANCE', '##XFACTOR=1', '##YFACTOR=0.001', '##FIRSTX=1000', '##LASTX=1007', '##NPOINTS=8', '##XYDATA=(X++(Y..Y))', '1000 100 200 300 400', '1004 500 600 700 800', '##END='].join('\n');
  const j = IR.parseExperimental(jdx);
  assert.ok(j.ok); assert.equal(j.title, 'test compound');
  assert.deepEqual(j.x, [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]);
  assert.deepEqual(j.y.map((v) => +v.toFixed(3)), [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]);
  const peaks = IR.parseExperimental('##TITLE=p\n##YUNITS=TRANSMITTANCE\n##PEAK TABLE=(XY..XY)\n1700,0.1 2900,0.5\n##END=');
  assert.deepEqual(peaks.x, [1700, 2900]); assert.equal(peaks.units, 'T');
  assert.equal(IR.parseExperimental('##TITLE=c\n##XYDATA=(X++(Y..Y))\n1000@AJ%JJ\n##END=').why, 'compressed');
  assert.equal(IR.parseExperimental('hello\nworld').ok, false);
  assert.match(IR.toCSV({ x: [1, 2], y: [0.5, 1] }), /^wavenumber_cm-1,epsilon_L_per_mol_cm\n1\.00,0\.500000\n2\.00,1\.00000\n$/);
});
