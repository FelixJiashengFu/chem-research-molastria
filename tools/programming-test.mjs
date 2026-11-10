// 编程语言教学区（public/programming/pl-data.js）：node --test tools/programming-test.mjs
// 内容：每种语言中英两版齐全、链接是 https、路线和方向里提到的语言都存在。
// 代码：页面标“已在本机跑通”（tested: true）的每一段，本机装了对应的编译器或解释器就真的跑一遍，
// 检查打印的结果（LJ 题是 E = -3.000000）；没装的跳过并说明。PROGRAMMING_SKIP_RUN=1 全部跳过。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/programming/pl-data.js', import.meta.url), 'utf8'), ctx);
const D = ctx.window.MOLASTRIA_PL;
const ids = D.langs.map((l) => l.id);
const bi = (v, what) => { assert.ok(v && v.zh && v.en, `${what} 缺中文或英文`); assert.match(v.zh, /[一-鿿]/, `${what} 的中文没有汉字`); };

test('内容：中英两版、链接、引用都对得上', () => {
  assert.equal(new Set(ids).size, ids.length, 'id 重复');
  assert.ok(D.langs.length >= 20);
  bi(D.task, 'task');
  for (const l of D.langs) {
    assert.ok(D.tiers[l.tier], `${l.id} 的类别 ${l.tier} 不存在`);
    for (const k of ['role', 'good', 'watch']) bi(l[k], `${l.id}.${k}`);
    assert.ok(l.start.zh.length === l.start.en.length && l.start.zh.length >= 3, `${l.id}.start`);
    assert.ok(l.used.length >= 1 && l.links.length >= 1, `${l.id} 缺常见程序或链接`);
    for (const [zh, en, href] of l.links) { assert.ok(zh && en, `${l.id} 的链接名`); assert.match(href, /^https:\/\//, `${l.id} ${href}`); }
    assert.ok(l.snippets.length >= 1, `${l.id} 没有代码`);
    for (const s of l.snippets) { assert.ok(s.code.trim() && s.run && s.file, `${l.id} 的代码不完整`); assert.equal(typeof s.tested, 'boolean'); }
  }
  for (const p of [...D.paths, ...D.stages]) { bi(p, 'path'); bi(p.note, 'path.note'); for (const id of p.langs) assert.ok(ids.includes(id), `路线里的 ${id} 不存在`); }
  for (const e of D.exercises) bi(e, 'exercise');
  // 没跑过的要少而且明确：Julia、CUDA、Wolfram
  assert.deepEqual([...D.langs.flatMap((l) => l.snippets.filter((s) => !s.tested).map((s) => s.file))].sort(), ['cuda_lj.cu', 'lj.jl', 'symbolic.wl']);
});

const has = (cmd, args = ['--version']) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
const pyHas = (mod) => spawnSync('python3', ['-c', `import ${mod}`], { stdio: 'ignore' }).status === 0;
// 文件名 → [需要的程序, 跑法]
const RUN = {
  'lj.py': [() => has('python3'), (f) => [['python3', [f]]]],
  'lj_numpy.py': [() => pyHas('numpy'), (f) => [['python3', [f]]]],
  'lj_sympy.py': [() => pyHas('sympy'), (f) => [['python3', [f]]]],
  'lj.f90': [() => has('gfortran'), (f) => [['gfortran', ['-O2', f, '-o', 'a.out']], ['./a.out', []]]],
  'lj.c': [() => has('gcc'), (f) => [['gcc', ['-O2', f, '-lm', '-o', 'a.out']], ['./a.out', []]]],
  'lj.cpp': [() => has('g++'), (f) => [['g++', ['-std=c++17', '-O2', f, '-o', 'a.out']], ['./a.out', []]]],
  'lj_omp.c': [() => has('gcc'), (f) => [['gcc', ['-fopenmp', '-O2', f, '-lm', '-o', 'a.out']], ['./a.out', []]]],
  'lj_mpi.c': [() => has('mpicc') && has('mpirun'), (f) => [['mpicc', ['-O2', f, '-lm', '-o', 'a.out']], ['mpirun', ['--allow-run-as-root', '--oversubscribe', '-np', '2', './a.out']]]],
  'lj.rs': [() => has('rustc'), (f) => [['rustc', ['-O', f, '-o', 'a.out']], ['./a.out', []]]],
  'lj.m': [() => has('octave-cli'), (f) => [['octave-cli', [f]]]],
  'lj.R': [() => has('Rscript'), (f) => [['Rscript', [f]]]],
  'lj.js': [() => true, (f) => [[process.execPath, [f]]]],
  'LJ.java': [() => has('javac', ['-version']), (f) => [['javac', [f]], ['java', ['LJ']]]],
  'lj.tcl': [() => spawnSync('tclsh', [], { input: 'exit 0', stdio: ['pipe', 'ignore', 'ignore'] }).status === 0, (f) => [['tclsh', [f]]]],
  'lj.sh': [() => has('bash') && has('awk', ['-W', 'version']) || has('bash'), (f) => [['bash', [f]]]],
  'lj.pl': [() => has('perl', ['-v']), (f) => [['perl', [f]]]],
  // 没有 sqlite3 命令行时用 Python 自带的 sqlite3 模块执行同一段 SQL
  'lj.sql': [() => has('sqlite3', ['-version']) || pyHas('sqlite3'), (f) => (has('sqlite3', ['-version']) ? [['sh', ['-c', `sqlite3 < ${f}`]]] : [['python3', ['-c', `import sqlite3; print(sqlite3.connect(':memory:').execute(open('${f}').read()).fetchone()[0])`]]])],
  'lj.go': [() => has('go', ['version']), (f) => [['go', ['run', f]]]],
  'bell.qasm': [() => pyHas('qiskit.qasm3'), (f) => [['python3', ['-c', `import qiskit.qasm3 as q; from qiskit.quantum_info import Statevector; c=q.load('${f}'); c.remove_final_measurements(); print({str(k): round(float(v), 6) for k, v in Statevector(c).probabilities_dict().items()})`]]]],
};
const EXPECT = { 'lj_sympy.py': /V\(r_min\) = -epsilon/, 'bell.qasm': /\{'00': 0\.5, '11': 0\.5\}/ };

for (const l of D.langs) for (const s of l.snippets.filter((x) => x.tested)) {
  const r = RUN[s.file];
  test(`${l.name}：${s.file} 真的跑出页面上的结果`, (t) => {
    assert.ok(r, `${s.file} 标了 tested，但测试不知道怎么跑它`);
    if (process.env.PROGRAMMING_SKIP_RUN) return t.skip('PROGRAMMING_SKIP_RUN');
    if (!r[0]()) return t.skip('本机没有对应的编译器或解释器');
    const dir = mkdtempSync(join(tmpdir(), 'pl-'));
    try {
      writeFileSync(join(dir, s.file), `${s.code}\n`);
      let out = '';
      for (const [cmd, args] of r[1](s.file)) out = execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', timeout: 120000, env: { ...process.env, OMP_NUM_THREADS: '2', GOCACHE: join(dir, '.go') } });
      assert.match(out, EXPECT[s.file] || /E = -3\.000000/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
