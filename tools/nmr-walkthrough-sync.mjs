#!/usr/bin/env node
// 逐步解谱讲解（public/nmr/walkthrough/）：从站长的 nmr-walkthrough 仓库（github.com/FelixJiashengFu/nmr-walkthrough，MIT）
// 复制播放器和讲解方法。生成的文件，不要手改：
//   player.html   ← lib/player.html（原样）
//   nw-guide.js   ← STYLE-GUIDE.md、SCHEMA.md、examples/*.json 和上游的版本
//   LICENSE.txt   ← LICENSE
// 用法：node tools/nmr-walkthrough-sync.mjs --src <nmr-walkthrough 的路径> [--check]
// --check 不写文件，只看生成的和仓库里的是不是一样（没有 --src 时只检查 nw-guide.js 里记的文件指纹）。
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/nmr/walkthrough');
// 上游 examples/ 里的每个示例都带过来；页面上按这个顺序排（大致由浅到深），名单外的新示例排在后面，按文件名
export const ORDER = ['ethyl-crotonate', 'estragole', 'pulegone', 'vanillin', 'melatonin', 'ibuprofen'];
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export function generate(src) {
  const read = (f) => readFileSync(join(src, f), 'utf8');
  let commit = '';
  try { commit = execFileSync('git', ['-C', src, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* 不是 git 检出 */ }
  const pkg = JSON.parse(read('package.json'));
  const player = read('lib/player.html');
  const guide = read('STYLE-GUIDE.md'), schema = read('SCHEMA.md');
  const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  const ids = readdirSync(join(src, 'examples')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const examples = ids.map((id) => ({ id, spec: JSON.parse(read(`examples/${id}.json`)) }));
  const data = {
    upstream: { repo: 'https://github.com/FelixJiashengFu/nmr-walkthrough', version: pkg.version, commit, license: 'MIT', playerSha: sha(player) },
    guide, schema, examples,
  };
  const js = `/* 生成的文件，不要手改：node tools/nmr-walkthrough-sync.mjs --src <nmr-walkthrough 的路径>。
   内容来自站长的 nmr-walkthrough（${data.upstream.repo}，MIT）：讲解方法 STYLE-GUIDE.md、数据格式 SCHEMA.md、examples/ 里的全部示例。
   示例里的每个位移、J 值和相关峰都来自各自 sources 所列的实测数据。 */
window.MOLASTRIA_NMRW_GUIDE = ${JSON.stringify(data, null, 1)};
`;
  return { 'player.html': player, 'nw-guide.js': js, 'LICENSE.txt': read('LICENSE') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--src');
  const src = i > 0 ? process.argv[i + 1] : '';
  const check = process.argv.includes('--check');
  if (!src) {
    if (!check) { console.error('usage: node tools/nmr-walkthrough-sync.mjs --src <path to nmr-walkthrough> [--check]'); process.exit(2); }
    const g = readFileSync(join(OUT, 'nw-guide.js'), 'utf8');
    const want = JSON.parse(g.slice(g.indexOf('{'), g.lastIndexOf('}') + 1)).upstream.playerSha;
    const ok = sha(readFileSync(join(OUT, 'player.html'), 'utf8')) === want;
    console.log(ok ? 'player.html matches nw-guide.js' : 'player.html was edited by hand: re-run with --src');
    process.exit(ok ? 0 : 1);
  }
  const files = generate(src);
  let stale = 0;
  for (const [name, text] of Object.entries(files)) {
    const p = join(OUT, name);
    const same = existsSync(p) && readFileSync(p, 'utf8') === text;
    if (check) { if (!same) { console.log(`stale: ${name}`); stale++; } }
    else if (!same) { writeFileSync(p, text); console.log(`wrote public/nmr/walkthrough/${name}`); }
  }
  if (check) { console.log(stale ? `${stale} file(s) out of date` : 'up to date'); process.exit(stale ? 1 : 0); }
}
