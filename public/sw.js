// Тоот Push Notification Service Worker

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'Тоот';
  const options = {
    body: data.body || 'Шинэ мэдэгдэл байна',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'toot-notification',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Нээх' },
      { action: 'close', title: 'Хаах' },
    ],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Аль хэдийн нээлттэй цонх байвал focus хийх
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Байхгүй бол шинэ цонх нээх
      return clients.openWindow(url);
    })
  );
});

var CACHE_NAME = 'toot-cache-v2';
var OFFLINE_URL = '/offline';
var CACHED_URLS = [
  '/',
  '/offline',
  '/login',
  '/admin',
  '/inspector',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
  '/manifest-admin.json',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHED_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  // API хүсэлтүүдийг cache хийхгүй
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Амжилттай бол cache-д хадгалах
      if (response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Offline — cache-с авах
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // HTML хүсэлт бол offline хуудас харуулах
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
