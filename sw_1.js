const CACHE_NAME = 'mixtape-cache-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin app-shell requests; let everything else (fonts, jsmediatags CDN) pass through normally
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      // Network-first, and explicitly bypass the browser's own HTTP cache
      // (cache: 'no-store') so a plain fetch() can't silently serve a stale
      // copy underneath the service worker. Only fall back to the
      // service-worker cache if the network is truly unavailable (offline).
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
