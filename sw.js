// Mixtape Service Worker — minimal, just enables media session notifications
const CACHE = 'mixtape-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Pass all fetches through — no caching to avoid stale audio issues
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
