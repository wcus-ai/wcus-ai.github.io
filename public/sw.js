/**
 * Service worker — app-shell cache for offline support at the booth.
 *
 * Strategy:
 *   - Bypass entirely on localhost (dev server) — no caching, no staleness.
 *   - Network-first for navigation (HTML) — always fresh page structure.
 *   - Stale-while-revalidate for static assets (CSS, JS, images, fonts) —
 *     serve cached instantly, fetch updated version in background.
 *   - Network-only for /r/*, /feedback/*, /stats (must hit edge).
 */

const SHELL = ['.', 'privacy/', 'living-block-map/'];
const VERSION = 'v4';
const CACHE = `wcus-core-ai-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  if (
    url.pathname.startsWith('/r/') ||
    url.pathname.startsWith('/feedback/') ||
    url.pathname === '/stats'
  ) {
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    }),
  );
});
