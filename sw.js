// sw.js - Service Worker untuk SiramTanam PWA
const CACHE_NAME = 'siramtanam-v1.0.0';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://unpkg.com/mqtt/dist/mqtt.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('[SW] Cache failed:', err))
  );
  // Force waiting service worker to become active
  self.skipWaiting();
});

// Fetch event - serve from cache then network (stale-while-revalidate)
self.addEventListener('fetch', event => {
  // Skip non-GET requests and external analytics
  if (event.request.method !== 'GET') return;
  
  // Skip MQTT WebSocket connections
  if (event.request.url.includes('broker.hivemq.com')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Return cached response, then update cache in background
          fetch(event.request).then(freshResponse => {
            if (freshResponse && freshResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, freshResponse);
              });
            }
          }).catch(() => {});
          return response;
        }
        return fetch(event.request).then(response => {
          // Cache new responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        if (event.request.url.includes('.html')) {
          return caches.match('./index.html');
        }
        return new Response('Offline - SiramTanam', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Push notification (optional)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Ada notifikasi baru dari SiramTanam',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './'
    }
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'SiramTanam', options)
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || './')
  );
});