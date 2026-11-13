// Builds public/fundamental-science/fs-math.js, math/fm-math.js, the Quantum Carnival pavilions (quantum/physics/qp-math.js, quantum/biology/qb-math.js, quantum/algorithms/qa-math.js, quantum/computing/qc-math.js): every formula of the Fundamental Science section (LaTeX in fs-data.js, key `math`)
// converted to MathML by KaTeX, so the page renders math natively, offline and without a script library.
//   node tools/fundamental-math.mjs          (needs network once, for npx to fetch katex)
//   node tools/fundamental-math.mjs quantum  (only the files whose path contains "quantum")
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const KATEX = 'katex@0.16.11';
// The sub-module 数学基础与探索 (math/fm-data.js → math/fm-math.js) is built the same way.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const only = process.argv[2] || '';
const build = (dataFile, global, outFile, dir = 'fundamental-science/') => {
  if (!`${dir}${dataFile}`.includes(only)) return;
  const root = new URL(`../public/${dir}`, import.meta.url);
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(new URL(dataFile, root), 'utf8'), sandbox);
  const formulas = sandbox.window[global].math;
  const out = {};
  for (const [key, [tex, display]] of Object.entries(formulas)) {
    const r = spawnSync(`${npx} -y ${KATEX} --format mathml${display ? ' --display-mode' : ''}`, { input: tex, encoding: 'utf8', shell: true });
    const m = (r.stdout || '').match(/<math[\s\S]*<\/math>/);
    if (r.status !== 0 || !m) throw new Error(`${key}: KaTeX failed\n${r.stderr}`);
    out[key] = m[0].replace(/\n<\/annotation>/, '</annotation>');
    process.stdout.write(`${key} `);
  }
  const name = outFile.split('/').pop(), src = dataFile.split('/').pop();
  writeFileSync(new URL(outFile, root), `/* 生成的文件，不要手改：node tools/fundamental-math.mjs 从 ${src} 的 LaTeX 用 ${KATEX} 生成 MathML。 */
window.${global}_MATH = ${JSON.stringify(out, null, 1)};
`);
  console.log(`\nwrote ${Object.keys(out).length} formulas to public/${dir}${outFile}`);
};
build('fs-data.js', 'MOLASTRIA_FS', 'fs-math.js');
build('math/fm-data.js', 'MOLASTRIA_FM', 'math/fm-math.js');
// 量子生物学栏目（quantum/biology/qb-data.js → qb-math.js）
build('qb-data.js', 'MOLASTRIA_QB', 'qb-math.js', 'quantum/biology/');
build('../quantum/physics/qp-data.js', 'MOLASTRIA_QP', '../quantum/physics/qp-math.js');
// 量子嘉年华 · 量子算法
build('qa-data.js', 'MOLASTRIA_QA', 'qa-math.js', 'quantum/algorithms/');
// 量子计算机栏目（quantum/computing/qc-data.js → qc-math.js）
build('qc-data.js', 'MOLASTRIA_QC', 'qc-math.js', 'quantum/computing/');
// NMR 栏目（nmr/nmr-data.js → nmr-math.js）
build('nmr-data.js', 'MOLASTRIA_NMR', 'nmr-math.js', 'nmr/');
// 前沿 AI 数学（ai-math/aim-data.js → aim-math.js）
build('aim-data.js', 'MOLASTRIA_AIM', 'aim-math.js', 'ai-math/');
// 写公式作答的题（../viewer/formula-check.js 判分）：题面和解答里的公式
build('math/fm-quiz.js', 'MOLASTRIA_FM_QUIZ', 'math/fm-quiz-math.js');
build('qp-quiz.js', 'MOLASTRIA_QP_QUIZ', 'qp-quiz-math.js', 'quantum/physics/');
// 化学学科馆的十五个展馆（chemistry/<id>/data.js → <id>/math.js）
{
  const box = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../public/chemistry/chem-subjects.js', import.meta.url), 'utf8'), box);
  for (const [id] of box.window.MOLASTRIA_CHEM_SUBJECTS.subjects) {
    if (existsSync(new URL(`../public/chemistry/${id}/data.js`, import.meta.url))) build(`${id}/data.js`, 'MOLASTRIA_CHEM', `${id}/math.js`, 'chemistry/');
  }
}
