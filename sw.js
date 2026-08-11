// SOUNDnoduul service worker
// Caches the app shell for offline use. Deliberately does NOT cache anything
// going to Supabase (the shared gallery) - that must always hit the network
// live, or the gallery would show stale data or fail confusingly offline.
// Bump CACHE_NAME whenever the app shell files change, so old caches get
// cleared out on the next visit instead of serving a stale version forever.
const CACHE_NAME = 'soundnoduul-shell-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Supabase traffic (shared gallery uploads/downloads) -
  // let it go straight to the network, untouched, every time.
  if (url.hostname.endsWith('supabase.co')) {
    return;
  }

  // Only handle simple same-origin GETs; let everything else (POSTs, other
  // origins like the Supabase JS CDN script) pass through normally.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // App shell: cache-first, falling back to network, and quietly refreshing
  // the cache with whatever the network returns.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached); // offline and not cached - nothing more we can do

      return cached || networkFetch;
    })
  );
});
