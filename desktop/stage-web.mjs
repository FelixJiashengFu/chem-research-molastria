// Copies the site (public/) into desktop/web/, the folder Tauri embeds in the app, leaving out what the app never shows.
// Tauri runs it before every build and dev run (tauri.conf.json → build.beforeBuildCommand / beforeDevCommand).
//   watch/  the 15-minute video tour (about 95 MB in video-0*.bin): no page links to it, so inside the app it is unreachable;
//           it lives on the website at https://molastria.com/watch/. Embedding it made the installers 16–17 times larger.
import { cpSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const src = join(here, '..', 'public'), out = join(here, 'web');
const LEAVE_OUT = ['watch'];

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: (p) => !LEAVE_OUT.includes(relative(src, p).split(sep)[0]) });

const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);
console.log(`stage-web: public/ → desktop/web/ without ${LEAVE_OUT.join(', ')} (${(size(out) / 1048576).toFixed(1)} MB of ${(size(src) / 1048576).toFixed(1)} MB)`);
