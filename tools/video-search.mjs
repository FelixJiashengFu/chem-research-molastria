// Teaching videos (public/videos/): find candidate videos on YouTube and Bilibili, and re-check the chosen ones.
// YouTube and Bilibili are not reachable from every machine that edits the site, so this runs on GitHub Actions
// (.github/workflows/video-search.yml) and the workflow commits what it found to tmp-videos/ on the branch.
//   node tools/video-search.mjs search [topic,topic]   search every query in tools/video-queries.json → tmp-videos/candidates.json
//   node tools/video-search.mjs verify                 re-read every video in public/videos/videos-data.js → tmp-videos/verify.json
// Nothing here is needed to build or publish the site; covers are tools/video-thumbs.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadVideos } from './video-thumbs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'tmp-videos');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const debug = [];
const keepDebug = (name, body) => { if (debug.length < 40) debug.push({ name, body: String(body).slice(0, 200000) }); };

async function request(url, { method = 'GET', headers = {}, body, json = true, tries = 3, timeout = 25000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method, headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8', ...headers }, body, signal: AbortSignal.timeout(timeout) });
      const text = await res.text();
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      let data = null;
      if (json) { try { data = JSON.parse(text); } catch { data = null; } }
      return { status: res.status, text, data, headers: res.headers };
    } catch (e) {
      last = e;
      await sleep(1500 * (i + 1));
    }
  }
  return { status: 0, text: '', data: null, error: String(last?.message || last) };
}

// Run fn over items with n workers and a pause between calls.
async function pool(items, n, fn, gap = 0) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
      if (gap) await sleep(gap);
    }
  }));
  return out;
}

// ---------- YouTube (InnerTube, the JSON API the web page itself uses) ----------
const YT_CLIENT = { clientName: 'WEB', clientVersion: '2.20251105.01.00', hl: 'en', gl: 'US' };
const ytHeaders = { 'content-type': 'application/json', origin: 'https://www.youtube.com', referer: 'https://www.youtube.com/', cookie: 'CONSENT=YES+1; SOCS=CAI' };
const runs = (t) => (t ? (t.simpleText ?? (t.runs || []).map((r) => r.text).join('') ?? t.content ?? '') : '');
const parseNum = (s) => { const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i); if (!m) return 0; return Math.round(+m[1] * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1)); };
const secs = (s) => String(s || '').split(':').map(Number).reduce((a, b) => a * 60 + b, 0);

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const x of node) walk(x, visit); return; }
  for (const [k, v] of Object.entries(node)) {
    if (visit(k, v) === false) continue;
    walk(v, visit);
  }
}

function ytItems(data) {
  const items = [];
  walk(data, (k, v) => {
    if (k === 'videoRenderer' && v?.videoId) {
      const owner = v.ownerText?.runs?.[0] || v.longBylineText?.runs?.[0] || {};
      items.push({
        p: 'yt', k: 'video', id: v.videoId, title: runs(v.title), channel: owner.text || '',
        channelId: owner.navigationEndpoint?.browseEndpoint?.browseId || '',
        handle: owner.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || '',
        verified: JSON.stringify(v.ownerBadges || []).includes('VERIFIED'),
        duration: runs(v.lengthText), seconds: secs(runs(v.lengthText)),
        views: parseNum(runs(v.viewCountText)), published: runs(v.publishedTimeText),
        snippet: (v.detailedMetadataSnippets || []).map((s) => runs(s.snippetText)).join(' ') || runs(v.descriptionSnippet),
        cc: JSON.stringify(v.badges || []).includes('"CC"'),
        live: !v.lengthText,
      });
      return false;
    }
    if (k === 'playlistRenderer' && v?.playlistId) {
      const owner = v.shortBylineText?.runs?.[0] || v.longBylineText?.runs?.[0] || {};
      const first = v.navigationEndpoint?.watchEndpoint?.videoId || (JSON.stringify(v).match(/"videoId":"([\w-]{11})"/) || [])[1] || '';
      items.push({
        p: 'yt', k: 'playlist', id: v.playlistId, title: runs(v.title), channel: owner.text || '',
        channelId: owner.navigationEndpoint?.browseEndpoint?.browseId || '', videos: +v.videoCount || parseNum(runs(v.videoCountText)), first,
        snippet: (v.videos || []).map((x) => runs(x.childVideoRenderer?.title)).filter(Boolean).join(' | '),
      });
      return false;
    }
    if (k === 'lockupViewModel' && v?.contentId) {
      const s = JSON.stringify(v);
      const isList = /PLAYLIST|PODCAST/.test(v.contentType || '') || /^(PL|OL|UU)/.test(v.contentId);
      if (!isList) return false;
      const meta = v.metadata?.lockupMetadataViewModel || {};
      const parts = [];
      walk(meta.metadata, (kk, vv) => { if (kk === 'text' && vv?.content) parts.push(vv.content); });
      const count = (s.match(/"(\d[\d,]*) (?:videos|episodes|lessons)"/) || [])[1];
      items.push({
        p: 'yt', k: 'playlist', id: v.contentId, title: meta.title?.content || '', channel: parts.find((x) => !/view full|updated|playlist|course|^\d/i.test(x)) || parts[0] || '',
        videos: count ? +count.replace(/,/g, '') : 0, first: (s.match(/"videoId":"([\w-]{11})"/) || [])[1] || '', meta: parts.join(' · '),
      });
      return false;
    }
    return true;
  });
  return items;
}

async function ytSearch(query, params) {
  const r = await request('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST', headers: ytHeaders, body: JSON.stringify({ context: { client: YT_CLIENT }, query, params }),
  });
  let items = r.data ? ytItems(r.data) : [];
  if (!items.length) {
    // Fall back to the HTML results page, which carries the same data as ytInitialData.
    const sp = encodeURIComponent(params);
    const h = await request(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${sp}&hl=en&gl=US`, { headers: { cookie: ytHeaders.cookie }, json: false });
    const m = h.text.match(/var ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
    if (m) { try { items = ytItems(JSON.parse(m[1])); } catch { /* keep empty */ } }
    if (!items.length) keepDebug(`yt-search-${query}`, `${r.status} ${r.error || ''}\n${r.text.slice(0, 50000)}\n----\n${h.status}\n${h.text.slice(0, 100000)}`);
  }
  return { status: r.status, items };
}

async function ytPlaylist(id) {
  const r = await request('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST', headers: ytHeaders, body: JSON.stringify({ context: { client: YT_CLIENT }, browseId: `VL${id}` }),
  });
  if (!r.data) return null;
  const titles = [];
  let first = '';
  let total = 0;
  walk(r.data, (k, v) => {
    if (k === 'playlistVideoRenderer' && v?.videoId) { if (!first) first = v.videoId; if (titles.length < 15) titles.push(`${runs(v.title)} (${runs(v.lengthText)})`); return false; }
    return true;
  });
  const s = r.text;
  const m = s.match(/"(\d[\d,]*) (?:videos|episodes|lessons)"/) || s.match(/"text":"(\d[\d,]*)"\},\{"text":" videos"/);
  if (m) total = +m[1].replace(/,/g, '');
  let description = '';
  walk(r.data, (k, v) => {
    if (!description && (k === 'descriptionText' || k === 'description') && v && typeof v === 'object') { description = runs(v) || v.content || ''; }
    return !description;
  });
  const owner = (s.match(/"ownerText":\{"runs":\[\{"text":"([^"]+)"/) || s.match(/"text":\{"content":"by ([^"]+)"/) || [])[1] || '';
  return { titles, first, total, description: String(description).slice(0, 600), owner };
}

async function ytOembed(v) {
  const url = v.k === 'playlist' ? `https://www.youtube.com/playlist?list=${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;
  const r = await request(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  return { status: r.status, title: r.data?.title || '', channel: r.data?.author_name || '', channelUrl: r.data?.author_url || '', thumb: r.data?.thumbnail_url || '' };
}

// Full description, upload date, language and captions of one video, from its watch page.
async function ytWatch(id) {
  const r = await request(`https://www.youtube.com/watch?v=${id}&hl=en&gl=US`, { headers: { cookie: ytHeaders.cookie }, json: false });
  const m = r.text.match(/var ytInitialPlayerResponse\s*=\s*(\{.*?\});\s*(?:var|<\/script>)/s);
  if (!m) return { status: r.status };
  let p;
  try { p = JSON.parse(m[1]); } catch { return { status: r.status }; }
  const d = p.videoDetails || {};
  const mf = p.microformat?.playerMicroformatRenderer || {};
  const caps = (p.captions?.playerCaptionsTracklistRenderer?.captionTracks || []).map((c) => `${c.languageCode}${c.kind === 'asr' ? '(auto)' : ''}`);
  return {
    status: r.status, playable: p.playabilityStatus?.status || '', embeddable: p.playabilityStatus?.playableInEmbed,
    title: d.title || '', channel: d.author || '', channelId: d.channelId || '', seconds: +d.lengthSeconds || 0, views: +d.viewCount || 0,
    description: String(d.shortDescription || '').slice(0, 1200), keywords: (d.keywords || []).slice(0, 15),
    date: mf.uploadDate || mf.publishDate || '', category: mf.category || '', captions: caps, live: !!d.isLiveContent,
  };
}

// ---------- Bilibili ----------
const MIXIN = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
const bili = { cookie: '', mixin: '' };
const biliHeaders = () => ({ referer: 'https://search.bilibili.com/', origin: 'https://search.bilibili.com', cookie: bili.cookie, accept: 'application/json, text/plain, */*' });

async function biliInit() {
  const home = await request('https://www.bilibili.com/', { json: false });
  const set = (home.headers?.getSetCookie?.() || []).map((c) => c.split(';')[0]);
  const spi = await request('https://api.bilibili.com/x/frontend/finger/spi', { headers: { referer: 'https://www.bilibili.com/' } });
  const b3 = spi.data?.data?.b_3, b4 = spi.data?.data?.b_4;
  const jar = new Map(set.map((c) => c.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  if (b3) jar.set('buvid3', b3);
  if (b4) jar.set('buvid4', b4);
  if (!jar.has('b_nut')) jar.set('b_nut', String(Math.floor(Date.now() / 1000)));
  bili.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const nav = await request('https://api.bilibili.com/x/web-interface/nav', { headers: { referer: 'https://www.bilibili.com/', cookie: bili.cookie } });
  const w = nav.data?.data?.wbi_img;
  if (w) {
    const key = (u) => u.split('/').pop().split('.')[0];
    const raw = key(w.img_url) + key(w.sub_url);
    bili.mixin = MIXIN.map((i) => raw[i]).join('').slice(0, 32);
  }
  log(`bilibili: home ${home.status}, spi ${spi.status} (buvid3 ${b3 ? 'yes' : 'no'}), nav ${nav.status} (wbi ${bili.mixin ? 'yes' : 'no'})`);
}

function wbi(params) {
  const p = { ...params, wts: Math.floor(Date.now() / 1000) };
  const q = Object.keys(p).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(p[k]).replace(/[!'()*]/g, ''))}`).join('&');
  return `${q}&w_rid=${crypto.createHash('md5').update(q + bili.mixin).digest('hex')}`;
}

const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");

async function biliSearch(keyword) {
  const params = { search_type: 'video', keyword, page: 1, order: 'totalrank' };
  const tries = [
    bili.mixin ? `https://api.bilibili.com/x/web-interface/wbi/search/type?${wbi(params)}` : '',
    `https://api.bilibili.com/x/web-interface/search/type?${new URLSearchParams(params)}`,
  ].filter(Boolean);
  let last = null;
  for (const url of tries) {
    for (let i = 0; i < 3; i++) {
      const r = await request(url, { headers: biliHeaders() });
      last = r;
      const res = r.data?.data?.result;
      if (r.data?.code === 0 && Array.isArray(res)) {
        return { status: r.status, code: 0, items: res.filter((x) => x.bvid).map((x) => ({
          p: 'bili', k: 'video', id: x.bvid, title: stripTags(x.title), channel: x.author || '', mid: x.mid || 0,
          duration: x.duration || '', seconds: secs(x.duration), views: +x.play || 0, favorites: +x.favorites || 0,
          date: x.pubdate ? new Date(x.pubdate * 1000).toISOString().slice(0, 10) : '', snippet: stripTags(x.description).slice(0, 300),
          tags: String(x.tag || '').split(',').slice(0, 10), category: x.typename || '', pic: x.pic || '',
        })) };
      }
      if (r.data?.code === -412 || r.status === 412) { await sleep(20000 * (i + 1)); continue; }
      break;
    }
  }
  keepDebug(`bili-search-${keyword}`, `${last?.status} ${last?.error || ''}\n${(last?.text || '').slice(0, 20000)}`);
  return { status: last?.status || 0, code: last?.data?.code, items: [] };
}

async function biliView(bvid) {
  for (let i = 0; i < 3; i++) {
    const r = await request(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: { referer: 'https://www.bilibili.com/', cookie: bili.cookie } });
    if (r.data?.code === -412 || r.status === 412) { await sleep(20000 * (i + 1)); continue; }
    const d = r.data?.data;
    if (r.data?.code !== 0 || !d) return { status: r.status, code: r.data?.code ?? null, message: r.data?.message || r.error || '' };
    const season = d.ugc_season;
    return {
      status: r.status, code: 0, title: d.title, channel: d.owner?.name || '', mid: d.owner?.mid || 0, parts: d.videos || 1,
      pages: (d.pages || []).slice(0, 15).map((p) => `${p.part} (${Math.round(p.duration / 60)} min)`), seconds: d.duration || 0,
      copyright: d.copyright, views: d.stat?.view || 0, likes: d.stat?.like || 0, favorites: d.stat?.favorite || 0,
      date: d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : '', description: String(d.desc || '').slice(0, 1200),
      category: d.tname || '', pic: d.pic || '', season: season ? { title: season.title, episodes: (season.sections || []).reduce((n, s) => n + (s.episodes || []).length, 0) } : null,
      noReprint: d.rights?.no_reprint === 1, isUpowerExclusive: !!d.is_upower_exclusive, isChargeable: !!d.rights?.pay || !!d.rights?.ugc_pay,
    };
  }
  return { status: 412, code: -412, message: 'rate limited' };
}

// ---------- search ----------
async function search(only) {
  const Q = JSON.parse(await fs.readFile(path.join(root, 'tools/video-queries.json'), 'utf8'));
  const topics = Object.keys(Q).filter((t) => !only.length || only.includes(t));
  const result = { generated: new Date().toISOString(), topics: {} };
  const report = [];

  // YouTube: videos and playlists for every query.
  const ytJobs = topics.flatMap((t) => Q[t].yt.flatMap((q) => [{ t, q, kind: 'video', params: 'EgIQAQ==' }, { t, q, kind: 'playlist', params: 'EgIQAw==' }]));
  const ytHits = await pool(ytJobs, 3, async (j) => {
    const r = await ytSearch(j.q, j.params);
    report.push(`yt ${j.t} [${j.kind}] ${j.q}: ${r.status} → ${r.items.length}`);
    return r.items.filter((x) => (j.kind === 'video' ? x.k === 'video' : x.k === 'playlist')).slice(0, j.kind === 'video' ? 14 : 8)
      .map((x, rank) => ({ ...x, topic: j.t, query: j.q, rank }));
  }, 400);
  log(`youtube searches: ${ytJobs.length}, with results: ${ytHits.filter((h) => h.length).length}`);

  await biliInit();
  const biliJobs = topics.flatMap((t) => Q[t].bili.map((q) => ({ t, q })));
  const biliHits = await pool(biliJobs, 1, async (j) => {
    const r = await biliSearch(j.q);
    report.push(`bili ${j.t} ${j.q}: ${r.status}/${r.code} → ${r.items.length}`);
    return r.items.slice(0, 20).map((x, rank) => ({ ...x, topic: j.t, query: j.q, rank }));
  }, 1500);
  log(`bilibili searches: ${biliJobs.length}, with results: ${biliHits.filter((h) => h.length).length}`);

  // Merge per topic: one entry per id, remembering every query that found it.
  const merged = new Map();
  for (const hit of [...ytHits.flat(), ...biliHits.flat()]) {
    const key = `${hit.topic}:${hit.id}`;
    const cur = merged.get(key);
    if (cur) { cur.queries.push(hit.query); cur.rank = Math.min(cur.rank, hit.rank); continue; }
    const { query, ...rest } = hit;
    merged.set(key, { ...rest, queries: [query] });
  }
  let cands = [...merged.values()].filter((c) => !(c.k === 'video' && (c.live || (c.seconds && c.seconds < 180))));
  log(`candidates after merge: ${cands.length}`);

  // Details. YouTube: oEmbed for every candidate (exact title and channel, and 401 = embedding off); playlist contents;
  // the watch page for single videos (description, captions, date). Bilibili: the view API (parts, original or repost).
  const unique = (arr) => [...new Map(arr.map((c) => [c.id, c])).values()];
  const yt = unique(cands.filter((c) => c.p === 'yt'));
  const oembed = new Map(await pool(yt, 6, async (c) => [c.id, await ytOembed(c)], 50).then((x) => x));
  log(`oEmbed: ${[...oembed.values()].filter((o) => o.status === 200).length} ok, ${[...oembed.values()].filter((o) => o.status === 401 || o.status === 403).length} embedding off`);
  const lists = new Map(await pool(yt.filter((c) => c.k === 'playlist'), 3, async (c) => [c.id, await ytPlaylist(c.id)], 300));
  const watch = new Map(await pool(yt.filter((c) => c.k === 'video'), 4, async (c) => [c.id, await ytWatch(c.id)], 250));
  const bv = unique(cands.filter((c) => c.p === 'bili'));
  const views = new Map(await pool(bv, 2, async (c) => [c.id, await biliView(c.id)], 700));
  log(`bilibili view: ${[...views.values()].filter((v) => v.code === 0).length}/${bv.length} ok`);

  for (const c of cands) {
    if (c.p === 'yt') {
      const o = oembed.get(c.id);
      c.oembed = o?.status || 0;
      if (o?.status === 200) { c.title = o.title || c.title; c.channel = o.channel || c.channel; c.channelUrl = o.channelUrl; c.thumb = o.thumb; }
      if (c.k === 'playlist') {
        const l = lists.get(c.id);
        if (l) { c.items = l.titles; c.videos = l.total || c.videos; c.first = c.first || l.first; c.description = l.description; }
      } else {
        const w = watch.get(c.id);
        if (w?.title) Object.assign(c, { description: w.description, date: w.date, captions: w.captions, keywords: w.keywords, category: w.category, views: w.views || c.views, embeddable: w.embeddable });
      }
    } else {
      const v = views.get(c.id);
      if (v?.code === 0) {
        Object.assign(c, { title: v.title, channel: v.channel, parts: v.parts, pages: v.pages, copyright: v.copyright, views: v.views, likes: v.likes,
          favorites: v.favorites, date: v.date, description: v.description, category: v.category, pic: v.pic, season: v.season, seconds: v.seconds,
          noReprint: v.noReprint, paywalled: v.isUpowerExclusive || v.isChargeable });
      } else c.view = v;
    }
  }
  cands = cands.filter((c) => !(c.p === 'yt' && (c.oembed === 404 || c.oembed === 400)) && !(c.p === 'bili' && c.view && [-404, 62002, 62004, 62012].includes(c.view.code)));
  for (const t of topics) result.topics[t] = cands.filter((c) => c.topic === t).sort((a, b) => b.queries.length - a.queries.length || a.rank - b.rank);
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, only.length ? `candidates-${only.join('-')}.json` : 'candidates.json'), JSON.stringify(result, null, 1));
  await fs.writeFile(path.join(OUT, 'search-report.txt'), report.sort().join('\n') + '\n');
  log(Object.entries(result.topics).map(([t, l]) => `${t}: yt ${l.filter((c) => c.p === 'yt').length}, bili ${l.filter((c) => c.p === 'bili').length}`).join('\n'));
}

// ---------- verify ----------
async function verify() {
  const D = await loadVideos();
  await biliInit();
  const rows = await pool(D.items, 3, async (v) => {
    if (v.p === 'yt') {
      const o = await ytOembed(v);
      const extra = v.k === 'playlist' ? await ytPlaylist(v.id) : await ytWatch(v.id);
      return { id: v.id, p: v.p, k: v.k, status: o.status, title: o.title, channel: o.channel, thumb: o.thumb, extra };
    }
    const r = await biliView(v.id);
    return { id: v.id, p: v.p, k: v.k, status: r.code, title: r.title, channel: r.channel, parts: r.parts, seconds: r.seconds, copyright: r.copyright, pic: r.pic, date: r.date, season: r.season, message: r.message };
  }, 500);
  const bad = rows.filter((r) => (r.p === 'yt' ? r.status !== 200 : r.status !== 0) || !r.title);
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'verify.json'), JSON.stringify({ checked: new Date().toISOString(), rows }, null, 1));
  log(`verify: ${rows.length} videos, ${bad.length} with problems`);
  for (const b of bad) log(`::warning::${b.id}: ${b.status} ${b.message || ''}`);
}

const [mode = 'search', topicArg = ''] = process.argv.slice(2);
try {
  if (mode === 'verify') await verify();
  else await search(topicArg.split(',').filter(Boolean));
} finally {
  if (debug.length) {
    await fs.mkdir(path.join(OUT, 'debug'), { recursive: true });
    for (const [i, d] of debug.entries()) await fs.writeFile(path.join(OUT, 'debug', `${String(i).padStart(2, '0')}-${d.name.replace(/[^\w.-]+/g, '_').slice(0, 60)}.txt`), d.body);
  }
}
