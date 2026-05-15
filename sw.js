// Service Worker — Dashboard Dr. Edson
// Minimal: enables PWA installability, passes-through all fetches

const CACHE = 'dashboard-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
  // Pass through — no offline cache (dashboard requires live data)
  e.respondWith(fetch(e.request).catch(function() {
    return new Response('Offline', { status: 503 });
  }));
});
