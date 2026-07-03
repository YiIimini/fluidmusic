// public/sw.js — FluidMusic Service Worker
const CACHE_NAME = 'fluidmusic-v1.1.0';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles/variables.css',
  '/styles/base.css',
  '/styles/layout.css',
  '/styles/components.css',
  '/styles/animations.css',
  '/vendor/three.min.js',
  '/assets/icon.png',
  '/js/module-registry.js',
  '/js/renderer-manager.js',
  '/js/app.js',
  '/js/audio-engine.js',
  '/js/api-bridge.js',
  '/js/i18n.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Skip API proxy requests
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
