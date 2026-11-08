// Teaching videos (public/videos/): find candidate videos on YouTube and Bilibili, and re-check the chosen ones.
// Run it on a machine that reaches YouTube and Bilibili (the owner's PC, or a GitHub Actions runner: the cloud sessions
// that edit the site cannot reach either platform; docs/RUNBOOK.md 教学视频 has the temporary-workflow recipe).
// Output goes to tmp-videos/ (not in git); public/videos/videos-data.js is written by hand from it.
//   node tools/video-search.mjs yt search [topic,…]     YouTube: every query in tools/video-queries.json → tmp-videos/yt.json
//   node tools/video-search.mjs bili search [topic,…]   Bilibili: the same → tmp-videos/bili.json
//   node tools/video-search.mjs yt verify               re-read the YouTube videos in public/videos/videos-data.js → tmp-videos/verify-yt.json
//   node tools/video-search.mjs bili verify             the same for Bilibili → tmp-videos/verify-bili.json
// Each run stops starting new requests after VIDEO_SEARCH_MINUTES (default 28) and writes what it has, and it writes
// the search results before fetching details, so a slow or rate-limited platform still leaves something to work with.
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
const T0 = Date.now();
const DEADLINE = T0 + (+process.env.VIDEO_SEARCH_MINUTES || 28) * 60000;
const late = () => Date.now() > DEADLINE;
const log = (...a) => console.log(`[${Math.round((Date.now() - T0) / 1000)}s]`, ...a);
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

// Run fn over items with n workers and a pause between calls; stops starting new items after the deadline or when
// stop() says so (a platform that keeps rate-limiting). Logs progress every `every` items.
async function pool(name, items, n, fn, { gap = 0, every = 50, stop = () => false } = {}) {
  const out = new Array(items.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length && !late() && !stop()) {
      const i = next++;
      out[i] = await fn(items[i], i);
      if (++done % every === 0) log(`${name}: ${done}/${items.length}`);
      if (gap) await sleep(gap);
    }
  }));
  log(`${name}: done ${done}/${items.length}${done < items.length ? (late() ? ' (deadline)' : ' (stopped)') : ''}`);
  return out;
}

// ---------- YouTube (InnerTube, the JSON API the web page itself uses) ----------
const YT_CLIENT = { clientName: 'WEB', clientVersion: '2.20251105.01.00', hl: 'en', gl: 'US' };
const ytHeaders = { 'content-type': 'application/json', origin: 'https://www.youtube.com', referer: 'https://www.youtube.com/', cookie: 'CONSENT=YES+1; SOCS=CAI' };
const runs = (t) => (t ? (t.simpleText ?? (t.runs ? t.runs.map((r) => r.text).join('') : t.content ?? '')) : '');
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
// limited: consecutive rate-limit answers (-412 / HTTP 412); after 4 in a row that endpoint is given up for this run.
const bili = { cookie: '', mixin: '', searchLimited: 0, viewLimited: 0 };
const biliHeaders = () => ({ referer: 'https://search.bilibili.com/', origin: 'https://search.bilibili.com', cookie: bili.cookie, accept: 'application/json, text/plain, */*' });
const limited = (r) => r.status === 412 || r.data?.code === -412 || r.data?.code === -352;

async function biliInit() {
  const home = await request('https://www.bilibili.com/', { json: false, tries: 1 });
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

// Bilibili search titles carry <em class="keyword"> highlights. Plain text for a JSON file: strip tags until none are
// left, then decode the entities the API uses (&amp; last, so nothing is decoded twice). Nothing here is ever HTML.
const stripTags = (s) => {
  let t = String(s || ''), prev;
  do { prev = t; t = t.replace(/<[^<>]*>/g, ''); } while (t !== prev);
  return t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
};

async function biliSearchApi(keyword) {
  const params = { search_type: 'video', keyword, page: 1, order: 'totalrank' };
  const urls = [
    bili.mixin ? `https://api.bilibili.com/x/web-interface/wbi/search/type?${wbi(params)}` : '',
    `https://api.bilibili.com/x/web-interface/search/type?${new URLSearchParams(params)}`,
  ].filter(Boolean);
  let last = null;
  for (const url of urls) {
    const r = await request(url, { headers: biliHeaders() });
    last = r;
    const res = r.data?.data?.result;
    if (r.data?.code === 0 && Array.isArray(res)) {
      bili.searchLimited = 0;
      return { how: 'api', status: r.status, code: 0, items: res.filter((x) => x.bvid).map((x) => ({
        p: 'bili', k: 'video', id: x.bvid, title: stripTags(x.title), channel: x.author || '', mid: x.mid || 0,
        duration: x.duration || '', seconds: secs(x.duration), views: +x.play || 0, favorites: +x.favorites || 0,
        date: x.pubdate ? new Date(x.pubdate * 1000).toISOString().slice(0, 10) : '', snippet: stripTags(x.description).slice(0, 300),
        tags: String(x.tag || '').split(',').slice(0, 10), category: x.typename || '', pic: x.pic || '',
      })) };
    }
    if (limited(r)) bili.searchLimited++;
  }
  keepDebug(`bili-search-${keyword}`, `${last?.status} ${last?.error || ''}\n${(last?.text || '').slice(0, 20000)}`);
  return { how: 'api', status: last?.status || 0, code: last?.data?.code, items: [] };
}

// When Bilibili's own search refuses this machine: find BV ids through web search engines (titles come from the view API).
async function biliSearchWeb(keyword) {
  const found = new Map();
  const engines = [
    ['ddg', `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:bilibili.com/video ${keyword}`)}`],
    ['bing', `https://www.bing.com/search?q=${encodeURIComponent(`site:bilibili.com/video ${keyword}`)}&setlang=zh-CN&count=30`],
  ];
  for (const [name, url] of engines) {
    const r = await request(url, { json: false, tries: 2 });
    for (const m of r.text.matchAll(/bilibili\.com(?:%2F|\/)video(?:%2F|\/)(BV[0-9A-Za-z]{10})/g)) if (!found.has(m[1])) found.set(m[1], name);
    if (!r.text) keepDebug(`web-${name}-${keyword}`, `${r.status} ${r.error || ''}`);
  }
  return { how: 'web', status: 200, items: [...found.keys()].slice(0, 20).map((id) => ({ p: 'bili', k: 'video', id, title: '', channel: '' })) };
}

async function biliView(bvid) {
  const r = await request(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers: { referer: 'https://www.bilibili.com/', cookie: bili.cookie } });
  if (limited(r)) { bili.viewLimited++; return { status: r.status, code: -412, message: 'rate limited' }; }
  bili.viewLimited = 0;
  const d = r.data?.data;
  if (r.data?.code !== 0 || !d) return { status: r.status, code: r.data?.code ?? null, message: r.data?.message || r.error || '' };
  const season = d.ugc_season;
  return {
    status: r.status, code: 0, title: d.title, channel: d.owner?.name || '', mid: d.owner?.mid || 0, parts: d.videos || 1,
    pages: (d.pages || []).slice(0, 15).map((p) => `${p.part} (${Math.round(p.duration / 60)} min)`), seconds: d.duration || 0,
    copyright: d.copyright, views: d.stat?.view || 0, likes: d.stat?.like || 0, favorites: d.stat?.favorite || 0,
    date: d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 10) : '', description: String(d.desc || '').slice(0, 1200),
    category: d.tname || '', pic: d.pic || '', season: season ? { title: season.title, episodes: (season.sections || []).reduce((n, s) => n + (s.episodes || []).length, 0) } : null,
    paywalled: !!d.is_upower_exclusive || !!d.rights?.pay || !!d.rights?.ugc_pay,
  };
}

// ---------- search ----------
const unique = (arr) => [...new Map(arr.map((c) => [c.id, c])).values()];
function merge(hits) {
  const merged = new Map();
  for (const hit of hits.flat().filter(Boolean)) {
    const key = `${hit.topic}:${hit.id}`;
    const cur = merged.get(key);
    if (cur) { if (!cur.queries.includes(hit.query)) cur.queries.push(hit.query); cur.rank = Math.min(cur.rank, hit.rank); continue; }
    const { query, ...rest } = hit;
    merged.set(key, { ...rest, queries: [query] });
  }
  return [...merged.values()];
}
async function save(file, topics, cands, extra = {}) {
  const result = { generated: new Date().toISOString(), ...extra, topics: {} };
  for (const t of topics) result.topics[t] = cands.filter((c) => c.topic === t).sort((a, b) => b.queries.length - a.queries.length || a.rank - b.rank);
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, file), JSON.stringify(result, null, 1));
  log(`saved ${file}: ${cands.length} candidates`);
}
async function queries(only) {
  const Q = JSON.parse(await fs.readFile(path.join(root, 'tools/video-queries.json'), 'utf8'));
  // Words that are not topic ids (such as a run label in run.txt) are ignored.
  const want = only.filter((t) => Q[t]);
  return { Q, topics: Object.keys(Q).filter((t) => !want.length || want.includes(t)) };
}

async function searchYt(only) {
  const { Q, topics } = await queries(only);
  const report = [];
  const jobs = topics.flatMap((t) => Q[t].yt.flatMap((q) => [{ t, q, kind: 'video', params: 'EgIQAQ==' }, { t, q, kind: 'playlist', params: 'EgIQAw==' }]));
  const hits = await pool('youtube search', jobs, 3, async (j) => {
    const r = await ytSearch(j.q, j.params);
    report.push(`${j.t} [${j.kind}] ${j.q}: ${r.status} → ${r.items.length}`);
    return r.items.filter((x) => x.k === j.kind).slice(0, j.kind === 'video' ? 14 : 8).map((x, rank) => ({ ...x, topic: j.t, query: j.q, rank }));
  }, { gap: 300, every: 40 });
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'yt-report.txt'), report.sort().join('\n') + '\n');
  let cands = merge(hits).filter((c) => !(c.k === 'video' && (c.live || (c.seconds && c.seconds < 180))));
  await save('yt.json', topics, cands, { stage: 'search' });

  // oEmbed for every candidate: exact title and channel, 401/403 = embedding off, 400/404 = gone.
  const all = unique(cands);
  const oembed = new Map((await pool('oembed', all, 8, async (c) => [c.id, await ytOembed(c)], { every: 200 })).filter(Boolean));
  for (const c of cands) {
    const o = oembed.get(c.id);
    if (!o) continue;
    c.oembed = o.status;
    if (o.status === 200) { c.title = o.title || c.title; c.channel = o.channel || c.channel; c.channelUrl = o.channelUrl; c.thumb = o.thumb; }
  }
  cands = cands.filter((c) => c.oembed !== 404 && c.oembed !== 400);
  await save('yt.json', topics, cands, { stage: 'oembed' });

  const lists = new Map((await pool('playlists', unique(cands.filter((c) => c.k === 'playlist')), 3, async (c) => [c.id, await ytPlaylist(c.id)], { gap: 200, every: 50 })).filter(Boolean));
  // The watch page (description, captions, upload date) only for the better-ranked single videos.
  const top = unique(cands.filter((c) => c.k === 'video' && (c.rank < 8 || c.queries.length > 1)));
  const watch = new Map((await pool('watch pages', top, 4, async (c) => [c.id, await ytWatch(c.id)], { gap: 150, every: 100 })).filter(Boolean));
  for (const c of cands) {
    if (c.k === 'playlist') {
      const l = lists.get(c.id);
      if (l) { c.items = l.titles; c.videos = l.total || c.videos; c.first = c.first || l.first; c.description = l.description; }
    } else {
      const w = watch.get(c.id);
      if (w?.title) Object.assign(c, { description: w.description, date: w.date, captions: w.captions, keywords: w.keywords, category: w.category, views: w.views || c.views, embeddable: w.embeddable });
    }
  }
  await save('yt.json', topics, cands, { stage: 'done' });
}

async function searchBili(only) {
  const { Q, topics } = await queries(only);
  await biliInit();
  const report = [];
  const jobs = topics.flatMap((t) => Q[t].bili.map((q) => ({ t, q })));
  const hits = await pool('bilibili search', jobs, 1, async (j) => {
    let r = bili.searchLimited < 4 ? await biliSearchApi(j.q) : { items: [] };
    if (!r.items.length) r = await biliSearchWeb(j.q);
    report.push(`${j.t} ${j.q}: ${r.how} ${r.status}/${r.code ?? ''} → ${r.items.length}`);
    return r.items.slice(0, 20).map((x, rank) => ({ ...x, topic: j.t, query: j.q, rank }));
  }, { gap: 1200, every: 10 });
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'bili-report.txt'), report.sort().join('\n') + '\n');
  let cands = merge(hits).filter((c) => !(c.seconds && c.seconds < 180));
  await save('bili.json', topics, cands, { stage: 'search' });

  const views = new Map((await pool('bilibili view', unique(cands), 2, async (c) => [c.id, await biliView(c.id)], { gap: 600, every: 50, stop: () => bili.viewLimited >= 4 })).filter(Boolean));
  for (const c of cands) {
    const v = views.get(c.id);
    if (v?.code === 0) {
      Object.assign(c, { title: v.title, channel: v.channel, mid: v.mid, parts: v.parts, pages: v.pages, copyright: v.copyright, views: v.views, likes: v.likes,
        favorites: v.favorites, date: v.date, description: v.description, category: v.category, pic: v.pic, season: v.season, seconds: v.seconds, paywalled: v.paywalled });
    } else if (v) c.view = { code: v.code, message: v.message };
  }
  cands = cands.filter((c) => !(c.view && [-404, 62002, 62004, 62012].includes(c.view.code)) && !(c.seconds && c.seconds < 180) && (c.title || !c.view));
  await save('bili.json', topics, cands, { stage: 'done', searchLimited: bili.searchLimited, viewLimited: bili.viewLimited });
}

// ---------- verify ----------
async function verify(part) {
  const D = await loadVideos();
  const list = D.items.filter((v) => v.p === part);
  if (part === 'bili') await biliInit();
  const rows = (await pool(`verify ${part}`, list, part === 'yt' ? 4 : 2, async (v) => {
    if (v.p === 'yt') {
      const o = await ytOembed(v);
      const extra = v.k === 'playlist' ? await ytPlaylist(v.id) : await ytWatch(v.id);
      return { id: v.id, p: v.p, k: v.k, status: o.status, title: o.title, channel: o.channel, thumb: o.thumb, extra };
    }
    const r = await biliView(v.id);
    return { id: v.id, p: v.p, k: v.k, status: r.code, title: r.title, channel: r.channel, parts: r.parts, seconds: r.seconds, copyright: r.copyright, pic: r.pic, date: r.date, season: r.season, paywalled: r.paywalled, message: r.message };
  }, { gap: part === 'yt' ? 100 : 600, every: 25 })).filter(Boolean);
  const bad = rows.filter((r) => (r.p === 'yt' ? r.status !== 200 : r.status !== 0) || !r.title);
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, `verify-${part}.json`), JSON.stringify({ checked: new Date().toISOString(), total: list.length, rows }, null, 1));
  log(`verify ${part}: ${rows.length}/${list.length} checked, ${bad.length} with problems`);
  for (const b of bad) log(`::warning::${b.id}: ${b.status} ${b.message || ''}`);
}

const [part = 'yt', mode = 'search', topicArg = ''] = process.argv.slice(2);
try {
  if (mode === 'verify') await verify(part);
  else if (part === 'bili') await searchBili(topicArg.split(',').filter(Boolean));
  else await searchYt(topicArg.split(',').filter(Boolean));
} finally {
  if (debug.length) {
    await fs.mkdir(path.join(OUT, 'debug'), { recursive: true });
    for (const [i, d] of debug.entries()) await fs.writeFile(path.join(OUT, 'debug', `${part}-${String(i).padStart(2, '0')}-${d.name.replace(/[^\w.-]+/g, '_').slice(0, 60)}.txt`), d.body);
  }
}
