// Copies the site (public/) into desktop/web/, the folder Tauri embeds in the app, leaving out what the app never shows.
// Tauri runs it before every build and dev run (tauri.conf.json → build.beforeBuildCommand / beforeDevCommand).
//   watch/  the 15-minute video tour (about 95 MB in video-0*.bin): no page links to it, so inside the app it is unreachable;
//           it lives on the website at https://molastria.com/watch/. Embedding it made the installers 16–17 times larger.
//   research-atlas/app/  the copied 中美·研究图谱 site (network data for 20 universities, about 100 MB); in the app
//           research-atlas/index.html frames the website's copy instead.
import { cpSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const src = join(here, '..', 'public'), out = join(here, 'web');
const LEAVE_OUT = ['watch', 'research-atlas/app'];

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: (p) => { const r = relative(src, p).split(sep).join('/'); return !LEAVE_OUT.some((l) => r === l || r.startsWith(l + '/')); } });

const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
console.log(`stage-web: public/ → desktop/web/ without ${LEAVE_OUT.join(', ')} (${(size(out) / 1048576).toFixed(1)} MB of ${(size(src) / 1048576).toFixed(1)} MB)`);
