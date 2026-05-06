// Service Worker - الذهب اليوم
const CACHE_NAME = 'goldtoday-v1';
const STATIC_ASSETS = ['/', '/index.html', '/shared.css', '/manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).catch(function() {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Don't cache API calls
  if (e.request.url.includes('/.netlify/functions/')) return;
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (res && res.status === 200 && e.request.method === 'GET') {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, resClone); });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});

// Push notifications
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : {};
  self.registration.showNotification(data.title || 'الذهب اليوم', {
    body: data.body || 'تحديث جديد للأسعار',
    icon: '/apple-touch-icon.png',
    badge: '/favicon-32x32.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'price-alert',
    renotify: true
  });
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
