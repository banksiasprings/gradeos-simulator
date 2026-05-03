const CACHE = 'gradeos-v145';
const ASSETS = [
  './',
  './index.html',
  './src/product/guidance/blade-pose.js',
  './src/sim/fake-gps/blade-antennas.js',
  './src/product/design/design-surface.js',
  './src/product/guidance/blade-target.js',
  './src/product/positioning/nmea-parse.js',
  './src/product/positioning/local-frame.js',
  './src/sim/fake-gps/nmea-stream.js',
  './src/product/design/profile-designer.js',
  './src/product/guidance/alignment-guidance.js',
  './src/sim/render/dozer-model.js',
  './src/sim/render/dozer-sprites.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
