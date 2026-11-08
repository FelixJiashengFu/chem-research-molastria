// Copies the built website of 中美·研究图谱 (a separate repository, university-science-research-network) into
// public/research-atlas/app/, where public/research-atlas/index.html shows it under the MolAstria header.
//   cd ../university-science-research-network && ./build_site.sh
//   node tools/vendor-atlas.mjs [path/to/university-science-research-network]
// The atlas is plain static pages with its own navigation (assets/nav.js). Inside the frame that script notices the
// MolAstria page around it: it takes the light/dark choice from the outer page and hides its own switch.
// Every copied page gets <meta name="robots" content="noindex"> (the outer page carries the SEO head).
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repo = fileURLToPath(new URL('../', import.meta.url));
const src = process.argv[2] ?? join(repo, '..', 'university-science-research-network');
const site = join(src, '_site'), out = join(repo, 'public', 'research-atlas', 'app');
if (!existsSync(join(site, 'index.html')) || !existsSync(join(site, 'assets', 'nav.js'))) throw new Error(`${site}: build the atlas first (./build_site.sh)`);
if (!readFileSync(join(site, 'assets', 'nav.js'), 'utf8').includes('data.embed') && !readFileSync(join(site, 'assets', 'nav.js'), 'utf8').includes('dataset.embed'))
  throw new Error('assets/nav.js has no embedded mode; update the atlas or this script');

rmSync(out, { recursive: true, force: true });
cpSync(site, out, { recursive: true });
let pages = 0;
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) {
      const html = readFileSync(p, 'utf8');
      if (!html.includes('name="robots"')) writeFileSync(p, html.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex">'));
      pages++;
    }
  }
};
walk(out);
let commit = '';
try { commit = execFileSync('git', ['-C', src, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { /* not a git checkout */ }
writeFileSync(join(out, 'VERSION.txt'), `中美·研究图谱 https://github.com/FelixJiashengFu/university-science-research-network ${commit}\ncopied by tools/vendor-atlas.mjs\n`);
const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
console.log(`research atlas ${commit} → public/research-atlas/app/ (${pages} pages, ${(size(out) / 1048576).toFixed(1)} MB)`);
