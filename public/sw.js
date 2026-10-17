/* Optika Miftari service worker — fast repeat visits on phones and a basic offline fallback.
 *  - hashed build files (/assets/…: JS, CSS, fonts) never change → cache-first
 *  - photos (/images/…, /og/…, icons) → stale-while-revalidate, capped
 *  - pages (navigations) → network-first, so new deploys show up at once; the cached copy is used offline
 *  - the try-on runtime (/mediapipe/, ~15 MB) is left to the normal HTTP cache
 * Bump VERSION to drop every cache on the next visit. */
const VERSION = 'v1';
const ASSETS = `optika-assets-${VERSION}`;
const IMAGES = `optika-images-${VERSION}`;
const PAGES = `optika-pages-${VERSION}`;
const KEEP = [ASSETS, IMAGES, PAGES];
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('optika-') && !KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Saving to the cache must never break the response itself (storage full, private mode…). */
function store(event, cacheName, request, res, max) {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.put(request, res))
      .then(() => trim(cacheName, max))
      .catch(() => {}),
  );
}

async function cacheFirst(event) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  try {
    const res = await fetch(event.request);
    if (res.ok) store(event, ASSETS, event.request, res.clone(), 120);
    return res;
  } catch {
    // offline, or the page went away and cancelled the download: a plain network error, not a worker crash
    return Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then((res) => {
      if (res.ok) store(event, IMAGES, event.request, res.clone(), 160);
      return res;
    })
    .catch(() => hit || Response.error());
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return refresh;
}

async function networkFirst(event) {
  const { request } = event;
  try {
    const res = await fetch(request);
    // GitHub Pages answers unknown deep links with the app shell (404.html, status 404) — still a usable page.
    if (res.ok || res.status === 404) store(event, PAGES, request, res.clone(), 40);
    return res;
  } catch {
    const cache = await caches.open(PAGES);
    return (await cache.match(request)) || (await cache.match(SCOPE.href)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const path = url.pathname.slice(SCOPE.pathname.length);
  if (path.startsWith('mediapipe/') || path === 'sw.js') return;
  if (request.mode === 'navigate') return event.respondWith(networkFirst(event));
  if (path.startsWith('assets/')) return event.respondWith(cacheFirst(event));
  if (/^(images|og)\//.test(path) || /\.(png|webp|jpg|svg|ico)$/.test(path)) return event.respondWith(staleWhileRevalidate(event));
});
