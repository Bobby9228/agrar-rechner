// ⚠️ CACHE_VERSION muss bei jedem Release manuell gebumpet werden!
// Bei Vergessen bekommen Nutzer die alte Version aus dem Cache.
// alternativa: Build-Script das Hash/Zeitstempel injiziert.
// CACHE_VERSION dient nur noch als Namespace für den Offline-Fallback-Cache.
// Seit der Umstellung auf network-first (siehe fetch-Handler unten) MUSS
// dieser Wert nicht mehr manuell gebumpt werden, damit Nutzer Updates sehen —
// das war die Ursache wiederholter Stale-Cache-Probleme. Ein Bump hier räumt
// nur noch alte Offline-Caches auf, ist für sichtbare Updates nicht mehr nötig.
const CACHE_VERSION = 'agrar-rechner-v47';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css?v=15',
    '/js/app-globals.js',
    '/js/state.js',
    '/js/calculations.js',
    '/js/ui-handlers.js',
    '/js/render-tabs.js',
    '/js/render-results.js',
    '/js/render-drill.js',
    '/js/render-dashboard.js',
    '/js/main.js',
    '/icon.svg',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

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
      return response;
    }).catch(() => caches.match(e.request)));
    return;
  }
  // Network-First für ALLES (nicht mehr nur HTML): User bekommt bei jedem
  // Deploy sofort die aktuelle Version. Der Cache dient nur noch als
  // Offline-Fallback, wenn kein Netz verfügbar ist — nicht mehr als primäre
  // Quelle. Behebt die wiederholten "alte CSS trotz neuem Deploy"-Fälle.
  e.respondWith(
    fetch(e.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
      return response;
    }).catch(() => caches.match(e.request).then(r => r || new Response('Offline', { status: 503 })))
  );
});
