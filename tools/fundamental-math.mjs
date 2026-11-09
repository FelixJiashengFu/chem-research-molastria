// Builds public/fundamental-science/fs-math.js, math/fm-math.js and public/quantum/biology/qb-math.js: every formula of the Fundamental Science section (LaTeX in fs-data.js, key `math`)
// converted to MathML by KaTeX, so the page renders math natively, offline and without a script library.
//   node tools/fundamental-math.mjs          (needs network once, for npx to fetch katex)
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const KATEX = 'katex@0.16.11';
// The sub-module 数学基础与探索 (math/fm-data.js → math/fm-math.js) is built the same way.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const build = (dataFile, global, outFile, dir = 'fundamental-science') => {
  const root = new URL(`../public/${dir}/`, import.meta.url);
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
  console.log(`\nwrote ${Object.keys(out).length} formulas to public/${dir}/${outFile}`);
};
build('fs-data.js', 'MOLASTRIA_FS', 'fs-math.js');
build('math/fm-data.js', 'MOLASTRIA_FM', 'math/fm-math.js');
// 量子生物学栏目（quantum/biology/qb-data.js → qb-math.js）
build('qb-data.js', 'MOLASTRIA_QB', 'qb-math.js', 'quantum/biology');
