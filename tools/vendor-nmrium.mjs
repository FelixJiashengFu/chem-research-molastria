// Builds NMRium (https://github.com/cheminfo/nmrium, MIT) as the standalone NFDI4Chem wrapper app
// (https://github.com/NFDI4Chem/nmrium-react-wrapper, MIT) and copies it into public/nmr/nmrium/app/, where
// public/nmr/nmrium/index.html shows it in a frame under the MolAstria header. Everything in app/ is generated:
// never edit it by hand, change the patches below and run this again.
//   node tools/vendor-nmrium.mjs                 clone the pinned tag into a temporary folder and build it
//   node tools/vendor-nmrium.mjs path/to/wrapper  build an existing checkout (it must be at the pinned commit)
// Needs git, Node 20+ and the network for npm (about 600 MB of node_modules in that folder, under a minute).
//
// Why this old version (wrapper v0.8.0, NMRium 0.56.0, June 2024): since February 2025 the libraries that read and
// process the data (nmr-processing 16+, jcampconverter 11+, nmr-load-save 3+, and later @zakodium/nmrium-core) are
// CC BY-NC-SA 4.0, not MIT; every NMRium from 0.61.0 on bundles them. This is the newest wrapper release whose whole
// bundle is under permissive licences. The licence check below fails the build if a newer pin brings in anything
// else (see docs/DECISIONS.md, NMRium).
//
// Patches to the wrapper's source, each checked so that moved code fails loudly:
//   1. allowed origins: the wrapper downloads a list of allowed parent sites from raw.githubusercontent.com and
//      molastria.com is not on it. Here the frame obeys only its own parent window on its own origin (the page
//      that embeds it is always same-origin) and needs no network to start (the desktop app works offline).
//   2. a 'ready' event (nmr-wrapper:ready) once the message listeners are in place, so the page knows when to send.
//   3. no service worker and no update prompt (vite-plugin-pwa): the site has its own sw.js, and a second worker
//      under /nmr/nmrium/app/ would cache the whole app and ask visitors to reload.
//   4. no source maps; the wrapper's demo data (public/data) is not copied.
//   5. a small build plugin lists the npm packages that end up in the bundle; their licences go to
//      THIRD-PARTY-LICENSES.md next to the app.
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const TAG = 'v0.8.0';
export const COMMIT = 'a469b7d4329e2a0f8ed54656d1ffae3214a13603';
const REPO_URL = 'https://github.com/NFDI4Chem/nmrium-react-wrapper.git';
/** Licences the bundle may contain. CC-BY-4.0 is a font (cheminfo-font) and needs only the attribution below. */
const ALLOWED = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0', 'CC-BY-4.0', '(MIT AND Zlib)', '(MIT OR GPL-3.0-or-later)', '(MIT OR CC0-1.0)']);

const repo = fileURLToPath(new URL('../', import.meta.url));
const out = join(repo, 'public', 'nmr', 'nmrium', 'app');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, NODE_OPTIONS: '--max_old_space_size=4096' } }).toString();

let src = process.argv[2];
if (!src) {
  src = join(mkdtempSync(join(tmpdir(), 'nmrium-')), 'wrapper');
  run('git', ['clone', '--quiet', '--depth', '1', '--branch', TAG, REPO_URL, src]);
}
const head = run('git', ['-C', src, 'rev-parse', 'HEAD']).trim();
if (head !== COMMIT) throw new Error(`${src} is at ${head}, expected ${TAG} = ${COMMIT}`);

/** Replace exactly one occurrence of `from` in a source file; fail when the wrapper's code moved. */
function patch(file, from, to) {
  const p = join(src, file), text = readFileSync(p, 'utf8');
  if (text.includes(to) && !text.includes(from)) return; // already patched (a second run on the same checkout)
  if (text.split(from).length !== 2) throw new Error(`${file}: the code to patch changed; update tools/vendor-nmrium.mjs`);
  writeFileSync(p, text.replace(from, () => to));
}

// 1. allowed origins
writeFileSync(join(src, 'src/hooks/useWhiteList.ts'), `// MolAstria (tools/vendor-nmrium.mjs): the frame obeys only its parent window on its own origin; no download.
export function useWhiteList() {
  return { allowedOrigins: [window.location.origin], isFetchAllowedOriginsPending: false };
}
`);
patch('src/events/event.ts', `    const url = new URL(origin);

    const skipOriginCheck =
      allowedOrigins.length === 0 || allowedOrigins.includes('*');

    if (!skipOriginCheck && !allowedOrigins.includes(url.origin)) {
      throw new Error(\`Invalid Origin \${origin}\`);
    }
`, `    // MolAstria: only the embedding page, and only from an allowed origin (exact match, so 'null' works for file://).
    if (event.source !== window.parent || window.parent === window) return;
    if (allowedOrigins.length > 0 && !allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) return;
`);
// 2. ready event
patch('src/events/types.ts', `  | 'action-response';`, `  | 'action-response'
  | 'ready';`);
patch('src/NMRiumWrapper.tsx', `  return (
    <RootLayout style={styles.container}>`, `  // MolAstria: tell the embedding page that the listeners above are in place (effects run in order).
  useEffect(() => {
    events.trigger('ready', {} as never);
  }, []);

  return (
    <RootLayout style={styles.container}>`);
// 3. no service worker
patch('src/index.tsx', `import { registerSW } from 'virtual:pwa-register';\n`, '');
patch('src/index.tsx', `// add this to prompt for a refresh
const updateSW = registerSW({
  onNeedRefresh() {
    // eslint-disable-next-line no-alert
    if (window.confirm('New NMRium wrappe update available. Reload?')) {
      void updateSW(true);
    }
  },
});
`, '');
// 4 and 5. no source maps, no PWA plugin; list the bundled packages
patch('vite.config.ts', `    build: {
      sourcemap: true,`, `    build: {
      sourcemap: false,`);
patch('vite.config.ts', 'plugins: [react(), splitVendorChunkPlugin(), VitePWA(pwaSettings)],', `plugins: [react(), splitVendorChunkPlugin(), {
      name: 'molastria-bundled-packages',
      generateBundle(_options, bundle) {
        const dirs = new Set();
        for (const chunk of Object.values(bundle)) for (const id of Object.keys(chunk.modules || {})) {
          const m = /^(.*\\/node_modules\\/(?:@[^/]+\\/)?[^/]+)\\//.exec(id.replace(/\\\\/g, '/').replace(/^\\0/, ''));
          if (m) dirs.add(m[1]);
        }
        this.emitFile({ type: 'asset', fileName: 'bundled-packages.json', source: JSON.stringify([...dirs].sort()) });
      },
    }],`);

if (!existsSync(join(src, 'node_modules', 'vite'))) run('npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts', '--legacy-peer-deps'], src);
rmSync(join(src, 'dist'), { recursive: true, force: true });
run('npx', ['vite', 'build'], src);
const dist = join(src, 'dist');
for (const f of ['index.html', 'bundled-packages.json']) if (!existsSync(join(dist, f))) throw new Error(`build produced no ${f}`);
const nmrium = JSON.parse(readFileSync(join(src, 'node_modules', 'nmrium', 'package.json'), 'utf8')).version;

// Licences of the bundled packages (read from each package.json, nearest one up for nested folders)
const pkgs = new Map();
for (const dir of JSON.parse(readFileSync(join(dist, 'bundled-packages.json'), 'utf8'))) {
  let d = dir;
  while (!existsSync(join(d, 'package.json')) && d.includes('node_modules')) d = dirname(d);
  const pj = JSON.parse(readFileSync(join(d, 'package.json'), 'utf8'));
  const license = typeof pj.license === 'string' ? pj.license : (pj.license?.type ?? pj.licenses?.map((l) => l.type).join(' OR ') ?? '');
  const file = readdirSync(d).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const text = file ? readFileSync(join(d, file), 'utf8').trim() : '';
  // Two small packages (fast-shallow-equal, react-universal-interface) declare no licence field; their LICENSE is the Unlicense.
  const declared = license || (/^This is free and unencumbered software released into the public domain/.test(text) ? 'Unlicense' : '');
  pkgs.set(`${pj.name}@${pj.version}`, { name: pj.name, version: pj.version, license: declared, text });
}
const bad = [...pkgs.values()].filter((p) => !ALLOWED.has(p.license));
if (bad.length) throw new Error(`licences not allowed in the bundle: ${bad.map((p) => `${p.name}@${p.version} (${p.license || 'none'})`).join(', ')}`);
const list = [...pkgs.values()].sort((a, b) => a.name.localeCompare(b.name));

// Copy: the page and its assets. Left out: demo data, PWA files, icons only the manifest used, maps, the package list.
const LEAVE_OUT = /^(data|sw\.js|workbox-.*|manifest\.webmanifest|registerSW\.js|icon-\d+x\d+\.png|bundled-packages\.json|.*\.map)$/;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const e of readdirSync(dist)) if (!LEAVE_OUT.test(e)) cpSync(join(dist, e), join(out, e), { recursive: true, filter: (p) => !p.endsWith('.map') });
let html = readFileSync(join(out, 'index.html'), 'utf8');
html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '').replace(/\s*<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '')
  .replace('<head>', '<head>\n  <meta name="robots" content="noindex">').replace(/<title>[^<]*<\/title>/, '<title>NMRium</title>');
if (html.includes('manifest.webmanifest') || html.includes('registerSW')) throw new Error('index.html still points at the PWA files');
writeFileSync(join(out, 'index.html'), html);
const wrapperLicense = readFileSync(join(src, 'LICENSE'), 'utf8').trim();
writeFileSync(join(out, 'LICENSE.txt'), `NMRium wrapper ${TAG} (https://github.com/NFDI4Chem/nmrium-react-wrapper), built with NMRium ${nmrium}
(https://github.com/cheminfo/nmrium, MIT). Built by tools/vendor-nmrium.mjs in the MolAstria repository, with the
small patches listed at the top of that script. The licences of every npm package in this build are in
THIRD-PARTY-LICENSES.md.

${wrapperLicense}
`);
writeFileSync(join(out, 'THIRD-PARTY-LICENSES.md'), `# Packages bundled in this NMRium build\n\nNMRium ${nmrium}, wrapper ${TAG}; ${list.length} packages, generated by tools/vendor-nmrium.mjs.\n\n`
  + list.map((p) => `## ${p.name} ${p.version} (${p.license})\n\n${p.text || '(no licence file in the package; licence as declared in its package.json)'}\n`).join('\n'));
writeFileSync(join(out, 'VERSION.txt'), `nmrium-react-wrapper ${TAG} ${COMMIT}\nnmrium ${nmrium}\nbuilt by tools/vendor-nmrium.mjs\n`);
const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
const count = {};
for (const p of list) count[p.license] = (count[p.license] || 0) + 1;
console.log(`NMRium ${nmrium} (wrapper ${TAG}) → public/nmr/nmrium/app/ (${(size(out) / 1048576).toFixed(1)} MB; ${list.length} packages: ${Object.entries(count).map(([l, n]) => `${n} ${l}`).join(', ')})`);
