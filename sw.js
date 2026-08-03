const CACHE_NAME = 'zerando-vida-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './states.js',
  './cities.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)));
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('inaturalist.org') || e.request.url.includes('nominatim.openstreetmap.org')) {
    return; // sempre buscar online essas chamadas
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
