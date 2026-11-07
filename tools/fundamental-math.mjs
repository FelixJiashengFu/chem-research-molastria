// Builds public/fundamental-science/fs-math.js: every formula of the Fundamental Science section (LaTeX in fs-data.js, key `math`)
// converted to MathML by KaTeX, so the page renders math natively, offline and without a script library.
//   node tools/fundamental-math.mjs          (needs network once, for npx to fetch katex)
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const KATEX = 'katex@0.16.11';
const root = new URL('../public/fundamental-science/', import.meta.url);
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('fs-data.js', root), 'utf8'), sandbox);
const formulas = sandbox.window.MOLASTRIA_FS.math;
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const out = {};
for (const [key, [tex, display]] of Object.entries(formulas)) {
  const r = spawnSync(`${npx} -y ${KATEX} --format mathml${display ? ' --display-mode' : ''}`, { input: tex, encoding: 'utf8', shell: true });
  const m = (r.stdout || '').match(/<math[\s\S]*<\/math>/);
  if (r.status !== 0 || !m) throw new Error(`${key}: KaTeX failed\n${r.stderr}`);
  out[key] = m[0].replace(/\n<\/annotation>/, '</annotation>');
  process.stdout.write(`${key} `);
}
writeFileSync(new URL('fs-math.js', root), `/* 生成的文件，不要手改：node tools/fundamental-math.mjs 从 fs-data.js 的 LaTeX 用 ${KATEX} 生成 MathML。 */
window.MOLASTRIA_FS_MATH = ${JSON.stringify(out, null, 1)};
`);
console.log(`\nwrote ${Object.keys(out).length} formulas to public/fundamental-science/fs-math.js`);
