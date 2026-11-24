#!/usr/bin/env node
/* 论文工坊的 LaTeX 模板：从 PaperOrchestra Studio（github.com/FelixJiashengFu/paper-orchestra-studio，Apache-2.0）
   的 paper-orchestra/templates/ 复制到 public/paper/templates/<id>/，并生成索引 public/paper/po-templates.js。

   只复制许可证写得清楚、可以再发布的文件：模板仓库自己写的 template.tex、guidelines.md、references.bib、venue.json，
   以及文件头写明 LPPL 的 .cls / .bst / .sty / .cfg / .rtx。会议自己的样式文件（AAAI、ACL、CVPR、ICLR、ICML、NeurIPS 的 .sty
   和 CVPR / ICLR 作者包里的 preamble.tex、math_commands.tex）没有写许可证，公开仓库不能放，导出时写明去哪里下载。

   用法：node tools/paper-templates.mjs [--src <paper-orchestra-studio 的路径>] [--check]
   --check：不写文件，只核对 public/paper/ 里的文件和索引是不是最新的（没有源仓库时只核对索引和文件对得上）。 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/paper/templates');
const INDEX = join(ROOT, 'public/paper/po-templates.js');
const args = process.argv.slice(2);
const check = args.includes('--check');
const srcArg = args.indexOf('--src');
const SRC = join(srcArg >= 0 ? args[srcArg + 1] : process.env.PO_REPO || join(ROOT, '../paper-orchestra-studio'), 'paper-orchestra/templates');

// 模板的显示名、类别、没有放进来的样式文件和它们的官方下载地址。
const TEMPLATES = [
  ['journal-nature', 'journal', 'Nature', 'Nature', []],
  ['journal-nature-methods', 'journal', 'Nature Methods', 'Nature Methods', []],
  ['journal-nature-biotech', 'journal', 'Nature Biotechnology', 'Nature Biotechnology', []],
  ['journal-npj-compmater', 'journal', 'npj Computational Materials', 'npj Computational Materials', []],
  ['journal-acs-jctc-jpc-jcim', 'journal', 'ACS：JCTC / JPC A·B·C / JCIM', 'ACS: JCTC / JPC A·B·C / JCIM', []],
  ['journal-aip-jcp', 'journal', 'AIP：J. Chem. Phys.', 'AIP: J. Chem. Phys.', []],
  ['journal-rsc-pccp', 'journal', 'RSC：PCCP', 'RSC: PCCP', []],
  ['journal-elsevier-commatsci', 'journal', 'Elsevier：Comput. Mater. Sci.', 'Elsevier: Comput. Mater. Sci.', []],
  ['journal-chinese-gb7714', 'journal', '中文期刊（GB/T 7714）', 'Chinese journal (GB/T 7714)', []],
  ['neurips2026', 'conference', 'NeurIPS 2026', 'NeurIPS 2026', [['neurips_2026.sty', 'https://media.neurips.cc/Conferences/NeurIPS2026/Formatting_Instructions_For_NeurIPS_2026.zip']]],
  ['icml2026', 'conference', 'ICML 2026', 'ICML 2026', [['icml2026.sty', 'https://media.icml.cc/Conferences/ICML2026/Styles/icml2026.zip']]],
  ['iclr2025', 'conference', 'ICLR 2025', 'ICLR 2025', [['iclr2025_conference.sty', 'https://github.com/ICLR/Master-Template'], ['math_commands.tex', 'https://github.com/ICLR/Master-Template']]],
  ['cvpr2025', 'conference', 'CVPR 2025', 'CVPR 2025', [['cvpr.sty', 'https://github.com/cvpr-org/author-kit'], ['preamble.tex', 'https://github.com/cvpr-org/author-kit']]],
  ['aaai2027', 'conference', 'AAAI 2027', 'AAAI 2027', [['aaai2027.sty', 'https://aaai.org/authorkit27/']]],
  ['acl', 'conference', 'ACL / ARR', 'ACL / ARR', [['acl.sty', 'https://github.com/acl-org/acl-style-files']]],
  ['ieee-conference', 'conference', 'IEEE 会议', 'IEEE conference', []],
  ['acm-sigconf', 'conference', 'ACM sigconf（acmart，TeX Live 自带）', 'ACM sigconf (acmart, in TeX Live)', []],
  ['math-modeling-mcm', 'contest', '美赛 MCM / ICM', 'MCM / ICM contest', []],
  ['math-modeling-cumcm', 'contest', '国赛 CUMCM', 'CUMCM contest', []],
];
// 不复制：没写许可证的会议样式、来源说明（内容写进 THIRD-PARTY 文件）。
const SKIP = new Set(['UPSTREAM.md', 'SOURCES.md']);

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
let bad = 0;
const fail = (m) => { bad++; console.error('✗ ' + m); };

const index = [];
const haveSrc = existsSync(SRC);
if (!haveSrc && !check) { console.error(`找不到模板源：${SRC}（用 --src 或 PO_REPO 指定 paper-orchestra-studio 的路径）`); process.exit(1); }

for (const [id, kind, zh, en, missing] of TEMPLATES) {
  const skip = new Set([...SKIP, ...missing.map(([f]) => f)]);
  let files;
  if (haveSrc) {
    files = readdirSync(join(SRC, id)).filter((f) => !skip.has(f)).sort();
  } else {
    files = existsSync(join(OUT, id)) ? readdirSync(join(OUT, id)).sort() : [];
  }
  for (const need of ['template.tex', 'guidelines.md', 'references.bib']) if (!files.includes(need)) fail(`${id} 缺 ${need}`);
  const entry = { id, kind, zh, en, files: [], missing: missing.map(([file, url]) => ({ file, url })) };
  for (const f of files) {
    const from = haveSrc ? join(SRC, id, f) : join(OUT, id, f);
    const buf = readFileSync(from);
    entry.files.push({ name: f, bytes: buf.length, sha: sha(buf) });
    const to = join(OUT, id, f);
    if (check) {
      if (!existsSync(to)) fail(`public/paper/templates/${id}/${f} 不存在`);
      else if (sha(readFileSync(to)) !== sha(buf)) fail(`public/paper/templates/${id}/${f} 和源文件不一样`);
    } else {
      mkdirSync(join(OUT, id), { recursive: true });
      writeFileSync(to, buf);
    }
  }
  if (files.includes('venue.json')) {
    const v = JSON.parse(readFileSync(haveSrc ? join(SRC, id, 'venue.json') : join(OUT, id, 'venue.json'), 'utf8'));
    entry.venue = v;
  }
  if (!check && haveSrc) {
    for (const f of existsSync(join(OUT, id)) ? readdirSync(join(OUT, id)) : []) if (!files.includes(f)) rmSync(join(OUT, id, f));
  }
  index.push(entry);
}

const text = `/* 生成的文件，不要手改：node tools/paper-templates.mjs（从 PaperOrchestra Studio 的 paper-orchestra/templates/ 复制，Apache-2.0；
   样式文件各自的许可证见 public/paper/THIRD-PARTY-paper-orchestra.md）。每个模板：文件清单（大小、SHA-256 前 16 位）、
   期刊模板的 venue.json、没有放进来的会议样式文件和官方下载地址。 */
(function (root) {
  const TEMPLATES = ${JSON.stringify(index, null, 1)};
  if (typeof module === 'object' && module.exports) module.exports = TEMPLATES;
  else root.MOLASTRIA_PAPER_TEMPLATES = TEMPLATES;
})(typeof self !== 'undefined' ? self : this);
`;
if (check) {
  if (!existsSync(INDEX) || readFileSync(INDEX, 'utf8') !== text) fail('public/paper/po-templates.js 不是最新的（运行 node tools/paper-templates.mjs）');
  if (bad) process.exit(1);
  console.log(`模板是最新的：${index.length} 套`);
} else {
  writeFileSync(INDEX, text);
  console.log(`写好了 ${index.length} 套模板，${index.reduce((s, t) => s + t.files.length, 0)} 个文件`);
}
