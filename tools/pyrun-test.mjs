// Tests for the in-browser Python runner (public/viewer/pyrun.js) and the two exercises it runs (public/viewer/py-examples.js):
// the pure JS helpers (chart data, ticks, tracebacks, editor keys), and both Python programs run with the local python3 + numpy,
// checked against independent reference values (PySCF 2.15.0 RHF with the same STO-3G basis; the exact oscillator and Morse levels).
//   node --test tools/pyrun-test.mjs        (needs python3 with numpy: python3 -m pip install numpy)
// PYRUN_SKIP_PYTHON=1 skips the Python part, for machines without numpy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const load = (file) => { const box = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/viewer/${file}`, import.meta.url), 'utf8'), box); return box.window; };
const P = load('pyrun.js').MolAstriaPy;
const EX = load('py-examples.js').MOLASTRIA_PY_EXAMPLES;
// values made in the vm context have that context's Array and Object, so compare plain copies
const plain = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b, msg) => assert.deepEqual(plain(a), b, msg);
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tolerance ${tol})`);

// ── pure helpers ───────────────────────────────────────────────────────
test('chartData: shared x, gaps for non-finite values, colours cycle, limits are honoured', () => {
  assert.equal(P.chartData(null), null);
  assert.equal(P.chartData({ x: [1, 2] }), null, 'nothing to draw');
  assert.equal(P.chartData({ x: [1, 2], series: [{ y: [null, null] }] }), null, 'only gaps');
  const d = P.chartData({ title: 'T', xlabel: 'x', ylabel: 'y', x: [0, 1, 2, 3], series: [{ name: 'a', y: [0, 1, null, 3] }, { y: [3, 2, 1, 0], dash: true, color: 'ink' }, { name: 'c', y: [1, 1] }], points: [{ x: 1, y: 1, label: 'P' }, { x: 'bad', y: 0 }] });
  assert.equal(d.series.length, 3);
  same(d.series[0].y, [0, 1, null, 3]);
  assert.equal(d.series[0].color, 'gold'); assert.equal(d.series[1].color, 'ink'); assert.equal(d.series[2].color, 'info');
  assert.equal(d.series[1].name, 'y2'); assert.equal(d.series[1].dash, true);
  assert.equal(d.series[2].x.length, 2, 'a short series is cut to its own length');
  assert.equal(d.points.length, 1);
  same(d.xr, [0, 3]);
  assert.ok(d.yr[0] < 0 && d.yr[1] > 3, 'y range is padded');
  const e = P.chartData({ x: [0, 1, 2], series: [{ y: [0, 100, 1] }], ylim: [0, 2], xlim: [0, 1] });
  same(e.yr, [0, 2]); same(e.xr, [0, 1]);
  const f = P.chartData({ x: [0, 1, 2], series: [{ y: [5, 5, 5] }] });
  assert.ok(f.yr[0] < 5 && f.yr[1] > 5, 'a flat line still gets a range');
  assert.ok(P.chartData({ x: [0, 1, 5], series: [{ y: [0, 1, 1000] }], xlim: [0, 1] }).yr[1] < 10, 'y range only looks inside xlim');
});

test('ticks and tick labels', () => {
  same(P.ticks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  same(P.ticks(-1.12, -0.6, 5), [-1, -0.8, -0.6]);
  same(P.ticks(-1.12, -0.6, 10), [-1.1, -1, -0.9, -0.8, -0.7, -0.6]);
  same(P.ticks(0.5, 6, 6), [1, 2, 3, 4, 5, 6]);
  assert.equal(P.tickLabel(-1.1, 0.1), '−1.1');
  assert.equal(P.tickLabel(2, 1), '2');
  assert.equal(P.tickLabel(1e-17, 0.2), '0.0');
  assert.equal(P.tickLabel(0.25, 0.05), '0.25');
});

test('cleanTraceback drops the Pyodide frames and keeps the learner\'s', () => {
  const raw = [
    'Traceback (most recent call last):',
    '  File "/lib/python314.zip/_pyodide/_base.py", line 597, in eval_code_async',
    '    await CodeRunner(',
    '    ...<9 lines>...',
    '    .run_async(globals, locals)',
    '  File "/lib/python314.zip/_pyodide/_base.py", line 411, in run_async',
    '    coroutine = eval(self.code, globals, locals)',
    '  File "h2_rhf.py", line 7, in <module>',
    '    R = 1.4 +',
    'NameError: name \'x\' is not defined',
  ].join('\n');
  assert.equal(P.cleanTraceback(raw), ['Traceback (most recent call last):', '  File "h2_rhf.py", line 7, in <module>', '    R = 1.4 +', 'NameError: name \'x\' is not defined'].join('\n'));
  assert.equal(P.cleanTraceback('ValueError: x\n'), 'ValueError: x');
});

test('editKey: Tab, Shift+Tab and Enter keep Python indentation sane', () => {
  const tab = P.editKey('ab', 2, 2, 'tab');
  same(tab, { from: 2, to: 2, insert: '  ', start: 4, end: 4 }, 'Tab goes to the next multiple of four');
  const enter = P.editKey('for i in x:', 11, 11, 'enter');
  assert.equal(enter.insert, '\n    ', 'Enter after a colon indents one more level');
  assert.equal(P.editKey('    y = 1', 9, 9, 'enter').insert, '\n    ', 'Enter keeps the indentation');
  const text = 'a\nb\nc';
  const multi = P.editKey(text, 0, 3, 'tab');
  assert.equal(multi.insert, '    a\n    b'); assert.equal(multi.from, 0); assert.equal(multi.to, 3);
  same([multi.start, multi.end], [0, 11]);
  const out = P.editKey('    a\n  b', 2, 2, 'outdent');
  assert.equal(out.insert, 'a'); same([out.start, out.end], [0, 0], 'caret stays inside the line');
  assert.equal(P.editKey('a', 0, 0, 'outdent'), null, 'nothing to outdent');
  const block = P.editKey('    a\n  b\nc', 0, 9, 'outdent');
  assert.equal(block.insert, 'a\nb');
});

test('UI strings come in both languages; the download note uses the measured size', () => {
  for (const [k, v] of Object.entries(P.STR)) {
    assert.ok(Array.isArray(v) && v.length === 2 && /[㐀-鿿]/.test(v[0]) && v[1] && !/[㐀-鿿]/.test(v[1]), `STR.${k}`);
    assert.equal((v[0].match(/\{\d\}/g) || []).length, (v[1].match(/\{\d\}/g) || []).length, `STR.${k} slots`);
  }
  const mb = P.mb(P.DOWNLOAD.core + P.DOWNLOAD.numpy);
  assert.ok(P.downloadNote(['numpy'], 'zh').includes(`约 ${mb} MB`));
  assert.ok(P.downloadNote(['numpy'], 'en').includes(`about ${mb} MB including numpy`));
  assert.match(P.BASE, /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v\d+\.\d+\.\d+\/full\/$/);
});

test('exercises: well formed, and the lines the page text points at are where it says', () => {
  for (const [id, ex] of Object.entries(EX)) {
    assert.match(ex.name, /^[\w.-]+\.py$/, id);
    same(ex.packages, ['numpy'], id);
    assert.ok(!/[`]|\$\{/.test(ex.code), `${id}: no backticks or template slots`);
    assert.ok(/^chart = \{/m.test(ex.code), `${id} draws a chart`);
  }
  const h2 = EX.h2.code.split('\n'), sc = EX.schrodinger.code.split('\n');
  assert.ok(h2.slice(0, 10).some((l) => /^R = 1\.4 /.test(l)) && h2.slice(0, 10).some((l) => /^MOLECULE = "H2"/.test(l)), 'R and MOLECULE sit at the top of the H2 program');
  assert.match(sc[4], /^POTENTIAL = "harmonic"/, 'the pavilion text says POTENTIAL is on line 5');
});

// ── the Python programs ────────────────────────────────────────────────
const skip = process.env.PYRUN_SKIP_PYTHON === '1' ? 'PYRUN_SKIP_PYTHON=1' : false;
const python = (code) => {
  const tail = `\n${P.PY_HELPER}\nimport json as _json\nprint("@@" + to_json({k: v for k, v in globals().items() if k in _KEEP}))\n`;
  const r = spawnSync('python3', ['-I', '-'], { input: code + '\n_KEEP = {"E_total", "E_elec", "E_nuc", "eps", "r0", "limit", "curve", "Rs", "E", "chart"}' + tail, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, `python3 failed (is numpy installed? python3 -m pip install numpy):\n${r.stderr}`);
  const line = r.stdout.split('\n').find((l) => l.startsWith('@@'));
  return { out: r.stdout.slice(0, r.stdout.indexOf('@@')), v: JSON.parse(line.slice(2)) };
};
const edit = (code, from, to) => { assert.ok(code.includes(from), `the program contains ${from}`); return code.replace(from, to); };

test('H2 RHF/STO-3G at 1.4 bohr matches PySCF and Szabo & Ostlund; equilibrium and dissociation limit', { skip }, () => {
  const { out, v } = python(EX.h2.code);
  close(v.E_total, -1.116714325, 1e-8, 'total energy (PySCF 2.15.0: -1.116714325062551)');
  close(v.E_total, -1.1167, 1e-4, 'total energy (Szabo & Ostlund: about -1.1167)');
  close(v.E_elec, -1.8310000393, 1e-8, 'electronic energy (PySCF: E_total minus 1/R)');
  close(v.E_nuc, 1 / 1.4, 1e-12, 'nuclear repulsion');
  close(v.eps[0], -0.5782, 1e-4, 'occupied orbital energy'); close(v.eps[1], 0.6703, 1e-4, 'virtual orbital energy'); // also what other open H2 notebooks print
  close(v.r0, 1.346, 1.5e-3, 'equilibrium bond length (PySCF scan: 1.346 bohr)');
  close(v.limit, 2 * -0.46658184955727533, 1e-8, '2 E(H) (PySCF UHF H atom)');
  close(v.curve[v.Rs.indexOf(2)], -1.049170901985806, 1e-8, 'E at R = 2.0 (PySCF)');
  close(v.curve.at(-1), -0.645076749510633, 1e-8, 'E at R = 6.0 (PySCF): RHF stays far above 2 E(H)');
  assert.match(out, /total energy\s+-1\.116714 hartree/);
  const c = P.chartData(v.chart);
  assert.equal(c.series.length, 2); assert.equal(c.series[0].y.length, 56); assert.equal(c.points.length, 1); assert.equal(c.series[1].dash, true);
});

test('H2 program: changing R and switching to HeH+ work, and HeH+ needs a real SCF loop', { skip }, () => {
  const r2 = python(edit(EX.h2.code, 'R = 1.4 ', 'R = 2.0 '));
  close(r2.v.E_total, -1.049170901985806, 1e-8, 'H2 at R = 2.0 (PySCF)');
  const heh = python(edit(edit(EX.h2.code, 'R = 1.4 ', 'R = 1.4632 '), 'MOLECULE = "H2"', 'MOLECULE = "HeH+"'));
  close(heh.v.E_total, -2.8606584853362325, 1e-8, 'HeH+ at 1.4632 bohr, zeta(He) = 2.0925 (PySCF, same basis)');
  close(heh.v.limit, -2.6438760813459403, 1e-8, 'E(He) (PySCF, same basis)');
  close(heh.v.r0, 1.378, 1.5e-3, 'HeH+ equilibrium (PySCF scan: 1.378 bohr)');
  const iterations = heh.out.split('\n').filter((l) => /^\s*\d+\s+-\d/.test(l)).length;
  assert.ok(iterations >= 5, `HeH+ takes several SCF iterations (${iterations})`);
});

test('1D Schrodinger: oscillator and Morse levels match the closed forms; well and double well behave', { skip }, () => {
  const ho = python(EX.schrodinger.code);
  for (let n = 0; n < 6; n++) close(ho.v.E[n], n + 0.5, 1e-3, `harmonic n=${n}`);
  assert.match(ho.out, /^ 0 {4}0\.499988 {4}0\.500000/m);
  const ms = python(edit(EX.schrodinger.code, 'POTENTIAL = "harmonic"', 'POTENTIAL = "morse"'));
  const w = 0.7 * Math.sqrt(16), morse = (n) => w * (n + 0.5) - (w * (n + 0.5)) ** 2 / 32;
  for (let n = 0; n < 4; n++) close(ms.v.E[n], morse(n), 1e-3, `Morse n=${n}`);
  const dw = python(edit(EX.schrodinger.code, 'POTENTIAL = "harmonic"', 'POTENTIAL = "double"'));
  const split = dw.v.E[1] - dw.v.E[0];
  assert.ok(split > 0 && split < 0.2 && split < (dw.v.E[2] - dw.v.E[1]) / 10, `tunnelling splitting ${split}`);
  const sw = python(edit(EX.schrodinger.code, 'POTENTIAL = "harmonic"', 'POTENTIAL = "well"'));
  assert.equal(sw.v.E.filter((e) => e < 8).length, 3, 'a well of width 2 and depth 8 holds three bound states');
  const c = P.chartData(ho.v.chart);
  assert.equal(c.series.length, 5); assert.equal(c.series[0].color, 'ink'); assert.ok(c.yr[1] > ho.v.E[3]);
});
