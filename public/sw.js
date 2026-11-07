/* MolAstria service worker: pages you have visited stay readable offline, and the site installs as an app.
   shared-nav.js registers it on the website only: never in the desktop app, the single-file build, a disk copy or a
   local preview (localhost / 127.0.0.1).
   - Page navigations: network first. When the network fails, or has not answered within NAV_WAIT ms and a copy is
     kept, the kept copy of that page; with no copy, offline.html. Pages that load are kept (at most PAGE_MAX).
   - Same-origin static files (scripts, styles, images, fonts, data): the kept copy at once, refreshed in the
     background (at most ASSET_MAX).
   - Everything else goes to the network untouched: other origins (api.molastria.com and its AI / model calls, the
     UMA origin, GitHub releases, CDNs), non-GET requests, requests with a Range header and audio / video (Safari
     plays video through Range requests, which a worker must not answer), downloads, and file types not listed below.
   VERSION is stamped by tools/build-seo.ts on every deploy, so each release starts with fresh caches.
   Kill switch (docs/RUNBOOK.md): KILL = true here, and SW = false in shared-nav.js, in the same deploy. This worker
   then handles no request, deletes every molastria-* cache and unregisters itself. */
const VERSION = 'dev';
const KILL = false;
const PAGES = `molastria-pages-${VERSION}`, ASSETS = `molastria-assets-${VERSION}`;
const OFFLINE = new URL('offline.html', self.registration.scope).href;
const NAV_WAIT = 3000, PAGE_MAX = 60, ASSET_MAX = 250;
const PAGE = /(?:\/|\.html|\/[^/.]+)$/; // a directory, an .html file or an extensionless address
const STATIC = /\.(?:js|mjs|css|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf)$/i;
const MEDIA = /\.(?:mp4|m4v|webm|mov|mp3|m4a|aac|ogg|oga|wav)$/i;

// One copy per page: no query string, and "dir/" is "dir/index.html" (GitHub Pages serves the same file).
const pageKey = (href) => { const u = new URL(href); return u.origin + u.pathname.replace(/\/$/, '/index.html'); };
const keep = (res) => res && res.ok && res.type === 'basic';
async function save(name, key, res, max) {
  if (!(await caches.has(name))) return; // a newer version (or the kill switch) deleted it: do not bring it back
  const cache = await caches.open(name);
  await cache.put(key, res);
  const keys = await cache.keys(); // oldest first: put() moves a key to the end
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) if (k.url !== OFFLINE) await cache.delete(k);
}
const quietly = (p) => p.catch(() => {});

self.addEventListener('install', (e) => {
  self.skipWaiting();
  if (!KILL) e.waitUntil(Promise.all([caches.open(ASSETS), caches.open(PAGES).then((c) => c.add(new Request(OFFLINE, { cache: 'reload' })))]));
});

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('molastria-') && (KILL || (k !== PAGES && k !== ASSETS))) await caches.delete(k);
  if (KILL) await self.registration.unregister();
  else await self.clients.claim();
})()));

function handled(req) {
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range')) return '';
  if (/^(?:audio|video|track)$/.test(req.destination) || MEDIA.test(url.pathname)) return '';
  if (req.mode === 'navigate') return PAGE.test(url.pathname) ? 'page' : '';
  return STATIC.test(url.pathname) ? 'asset' : '';
}

async function page(e) {
  const key = pageKey(e.request.url);
  const net = fetch(e.request).then((res) => {
    if (keep(res) && /html/.test(res.headers.get('content-type') || '')) e.waitUntil(quietly(save(PAGES, key, res.clone(), PAGE_MAX)));
    return res;
  });
  e.waitUntil(quietly(net));
  const kept = () => caches.match(key, { cacheName: PAGES });
  let timer;
  const slow = new Promise((resolve) => { timer = setTimeout(resolve, NAV_WAIT); });
  try {
    const first = await Promise.race([net, slow]);
    if (first) return first; // the network answered in time
    return (await kept()) || (await net); // slow network: the kept copy, else keep waiting
  } catch {
    return (await kept()) || (await caches.match(OFFLINE, { cacheName: PAGES })) || Response.error();
  } finally {
    clearTimeout(timer);
  }
}

async function asset(e) {
  const hit = await caches.match(e.request, { cacheName: ASSETS });
  const net = fetch(e.request).then((res) => {
    if (keep(res)) e.waitUntil(quietly(save(ASSETS, e.request, res.clone(), ASSET_MAX)));
    return res;
  });
  if (!hit) return net;
  e.waitUntil(quietly(net));
  return hit;
}

if (!KILL) {
  self.addEventListener('fetch', (e) => {
    const kind = handled(e.request);
    if (kind === 'page') e.respondWith(page(e));
    else if (kind === 'asset') e.respondWith(asset(e));
  });
  // First visit: the page and its files loaded before this worker existed. shared-nav.js sends their addresses;
  // the same rules pick what is kept (same-origin pages and static files only), so that page also opens offline.
  self.addEventListener('message', (e) => {
    const list = Array.isArray(e.data?.cache) ? e.data.cache.filter((u) => typeof u === 'string').slice(0, 200) : [];
    e.waitUntil(Promise.all(list.map((href) => quietly((async () => {
      const url = new URL(href, self.location.href);
      if (url.origin !== self.location.origin) return;
      const asPage = PAGE.test(url.pathname);
      if (!asPage && handled(new Request(url)) !== 'asset') return;
      const res = await fetch(url);
      if (!keep(res)) return;
      if (!asPage) await save(ASSETS, url.href, res, ASSET_MAX);
      else if (/html/.test(res.headers.get('content-type') || '')) await save(PAGES, pageKey(url.href), res, PAGE_MAX);
    })()))));
  });
}
