// Teaching videos (public/videos/): download each video's cover image to public/videos/thumbs/<id>.jpg and check
// that the videos still exist. Runs in CI before the site is published and before the desktop app is built
// (pages.yml, desktop.yml), because YouTube and Bilibili are not reachable from every machine that edits the site.
// The thumbs folder is not in git. Missing covers never fail the build: the page falls back to the platform's
// image URL and then to a drawn placeholder. Gone videos are listed as warnings so someone can remove them.
//   node tools/video-thumbs.mjs            download what is missing
//   node tools/video-thumbs.mjs --check    also re-check every video (YouTube oEmbed, Bilibili view API)
//   node tools/video-thumbs.mjs --strict   exit 1 when a video is gone (for a manual audit)
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public/videos');
const out = path.join(dir, 'thumbs');
const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check') || args.has('--strict');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export async function loadVideos(file = path.join(dir, 'videos-data.js')) {
  const sandbox = { window: {} };
  vm.runInNewContext(await fs.readFile(file, 'utf8'), sandbox, { filename: file });
  return sandbox.window.MOLASTRIA_VIDEOS;
}

async function get(url, { json = false, referer = '', tries = 3 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : 'image/*,*/*', ...(referer ? { referer } : {}) }, signal: AbortSignal.timeout(20000) });
      if (res.status === 404 || res.status === 401 || res.status === 403 || res.status === 400) return { status: res.status };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: res.status, body: json ? await res.json() : Buffer.from(await res.arrayBuffer()) };
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  return { status: 0, error: String(last?.message || last) };
}

const firstVideo = (v) => (v.k === 'playlist' ? (String(v.thumb || '').match(/\/vi\/([\w-]{11})\//) || [])[1] : v.id);
const pageUrl = (v) => (v.p === 'yt'
  ? (v.k === 'playlist' ? `https://www.youtube.com/playlist?list=${v.id}` : `https://www.youtube.com/watch?v=${v.id}`)
  : `https://www.bilibili.com/video/${v.id}/`);

// Returns { image?: Buffer, gone?: string, warn?: string }
async function one(v) {
  if (v.p === 'yt') {
    let warn;
    if (CHECK) {
      const o = await get(`https://www.youtube.com/oembed?url=${encodeURIComponent(pageUrl(v))}&format=json`, { json: true });
      // 401/403: embedding is turned off (the video exists); 400/404: the video or playlist is gone or private.
      if (o.status === 404 || o.status === 400) return { gone: `oEmbed ${o.status}` };
      if ((o.status === 401 || o.status === 403) && v.embed !== false) warn = 'embedding is now off (set embed: false)';
    }
    const id = firstVideo(v);
    if (!id) return { warn: 'no first-video id for this playlist (set thumb to its oEmbed thumbnail_url)' };
    for (const size of ['mqdefault', 'hqdefault']) {
      const r = await get(`https://i.ytimg.com/vi/${id}/${size}.jpg`);
      if (r.body?.length > 2000) return { image: r.body, warn };
    }
    return { warn: warn || 'cover not downloaded' };
  }
  // Bilibili: the view API gives the cover URL; the image host accepts requests without a referer.
  const r = await get(`https://api.bilibili.com/x/web-interface/view?bvid=${v.id}`, { json: true, referer: 'https://www.bilibili.com/' });
  const data = r.body?.data;
  if (r.body && r.body.code !== 0) {
    // -404 / 62002 / 62004: deleted, hidden or under review. Anything else (rate limits) is only a warning.
    if ([-404, 62002, 62004, 62012].includes(r.body.code)) return { gone: `view API code ${r.body.code} ${r.body.message || ''}`.trim() };
    if (!v.thumb) return { warn: `view API code ${r.body.code} ${r.body.message || ''}`.trim() };
  }
  const pic = data?.pic || v.thumb;
  if (!pic) return { warn: r.error || 'no cover URL' };
  const img = await get(String(pic).replace(/^\/\//, 'https://').replace(/^http:/, 'https:').replace(/@.*$/, '') + '@320w_180h_1c.jpg');
  return img.body?.length > 1000 ? { image: img.body } : { warn: `cover not downloaded (${img.status || img.error})` };
}

async function main() {
  const D = await loadVideos();
  await fs.mkdir(out, { recursive: true });
  const have = new Set((await fs.readdir(out)).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)));
  const todo = D.items.filter((v) => CHECK || !have.has(v.id));
  const gone = [], warns = [];
  let saved = 0, next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const v = todo[next++];
      const r = await one(v);
      if (r.image) { await fs.writeFile(path.join(out, `${v.id}.jpg`), r.image); saved++; }
      if (r.gone) gone.push(`${v.id} (${v.title}): ${r.gone}`);
      if (r.warn) warns.push(`${v.id} (${v.title}): ${r.warn}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`video covers: ${saved} downloaded, ${have.size} already present, ${D.items.length} videos`);
  for (const w of warns) console.log(`::warning::video ${w}`);
  for (const g of gone) console.log(`::warning::video gone? ${g}`);
  if (args.has('--strict') && gone.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
