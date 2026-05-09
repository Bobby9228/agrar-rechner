const CACHE_VERSION = 'mais-rechner-v10';
const STATIC_ASSETS = ['/', '/index.html', '/icon.svg', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // sw.js NIEMALS cachen — sonst bekommt der Browser nie Updates
  if (url.endsWith('/sw.js')) {
    e.respondWith(fetch(e.request).then(response => {
      // Neuen SW sofort aktivieren wenn sich CACHE_VERSION geändert hat
      return response;
    }).catch(() => caches.match(e.request)));
    return;
  }
  if (url.endsWith('.html') || url.endsWith('/')) {
    // Network-First für HTML → User bekommt Updates
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    // Cache-First für statische Assets
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
