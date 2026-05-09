const CACHE_VERSION = 'mais-rechner-v7';
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
  if (url.endsWith('.html') || url.endsWith('/')) {
    // Network-First für HTML → User bekommt Updates
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    // Cache-First für statische Assets
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
