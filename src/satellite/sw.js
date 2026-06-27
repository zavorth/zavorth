const CACHE_NAME = 'zavorth-satellite-v2';
const ASSETS = [
  '/satellite',
  '/satellite/',
  '/satellite/index.html',
  '/satellite/satellite.css',
  '/satellite/satellite.js',
  '/satellite/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/satellite') || url.pathname.includes('/api/')) {
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener('push', (event) => {
  let data = { title: 'Zavorth', body: 'Solicitacao de aprovacao pendente.' };
  try {
    data = event.data.json();
  } catch {
    if (event.data) {
      data = { title: 'Zavorth', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    vibrate: [100, 50, 100],
    data: {
      url: '/satellite'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data?.url || '/satellite')
  );
});
