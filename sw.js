// Foster Family Hub — Service Worker
// Strategy: Network-First with automatic cache busting
// Every page load fetches fresh content from the server.
// Falls back to cache only when offline.

const CACHE_NAME = 'foster-hub-v1';

// Files to pre-cache for offline fallback
const PRECACHE_URLS = [
  './',
  './index.html'
];

// Install: pre-cache core files
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  // Skip waiting so new SW activates immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  // Take control of all clients immediately
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: Network-first strategy
// Always try the network for fresh content.
// If network fails (offline), fall back to cache.
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For navigation requests (HTML pages) — always network first
  if (event.request.mode === 'navigate' ||
      event.request.url.includes('index.html') ||
      event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(function(networkResponse) {
          // Update the cache with the fresh response
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(function() {
          // Network failed — serve from cache
          return caches.match(event.request).then(function(cachedResponse) {
            return cachedResponse || new Response('You are offline. Please reconnect and try again.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }

  // For external CDN resources (React, Babel, fonts) — cache first, then network
  if (event.request.url.includes('unpkg.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(event.request).then(function(cachedResponse) {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(function(networkResponse) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // For everything else — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(function(networkResponse) {
        var responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(function() {
        return caches.match(event.request);
      })
  );
});
