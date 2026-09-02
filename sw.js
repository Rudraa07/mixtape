const CACHE_NAME = 'mixtape-cache-v3';

// On install, clear all old caches and don't cache anything
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Never cache — always go to network so auth gate works
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Pass everything through to the Worker
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(fetch(event.request));
  }
});
