// CACHE_VERSION ist der Namespace des Offline-Fallback-Caches. Bei jedem
// Release wird sie gebumpet, damit der activate-Handler (siehe unten) alte
// Caches aufräumt. Für sichtbare Updates ist der Bump NICHT mehr nötig —
// der fetch-Handler ist network-first (Network schlägt Cache), Nutzer sehen
// also bei jedem Online-Besuch sofort die neue Version. Der Bump räumt
// nur noch den Offline-Fallback-Cache auf.
const CACHE_VERSION = 'agrar-rechner-v53';
// STATIC_ASSETS muss exakt zu den lokalen Produktions-Assets aus index.html
// passen, damit eine frische PWA-Installation (oder ein Update-SW) beim
// ersten Offline-Restart alle Bootstrap-Dateien im Cache hat. Kongruenz wird
// durch tests/37-deploy-sanity.test.js abgesichert (lokale <script src>/
// <link href> + apple-touch-icon/manifest + self-gehostete Fonts in
// public/fonts/ gegen STATIC_ASSETS).
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css?v=21',
    '/js/app-globals.js',
    '/js/state.js',
    '/js/culture.js',
    '/js/calculations.js?v=21',
    '/js/culture-handlers.js',
    '/js/ui-handlers.js?v=22',
    '/js/input-handlers.js',
    '/js/settings-handlers.js',
    '/js/reset-handlers.js',
    '/js/drill-handlers.js',
    '/js/protocol-handlers.js',
    '/js/tab-handlers.js',
    '/js/render-tabs.js',
    '/js/state-coordinator.js',
    '/js/render-results.js?v=21',
    '/js/render-drill.js',
    '/js/render-dashboard.js',
    '/js/render-local-protocol.js?v=3',
    '/js/data-io-handlers.js',
    '/js/main.js',
    '/fonts/inter-variable-latin.woff2',
    '/fonts/inter-variable-latin-ext.woff2',
    '/fonts/source-serif-4-variable-latin.woff2',
    '/fonts/source-serif-4-variable-latin-ext.woff2',
    '/icon.svg',
    '/icon-180.png',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-192.png',
    '/icon-maskable-512.png',
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
