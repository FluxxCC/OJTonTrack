 const CACHE_NAME = 'ojtontrack-v7';
const ASSETS = [
  '/',
  '/manifest.json',
  '/icons-192.png',
  '/icons-512.png'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

 self.addEventListener('fetch', (event) => {
   // Network First Strategy
   event.respondWith(
     fetch(event.request)
       .then((response) => {
         // Optional: Cache new requests dynamically if needed
         return response;
       })
       .catch(() => {
         return caches.match(event.request);
       })
   );
 });
 
 self.addEventListener('push', (event) => {
   let data = {};
   try {
     data = event.data ? event.data.json() : {};
   } catch {
     data = { title: 'OJTonTrack', body: event.data ? event.data.text() : 'Update' };
   }
   const title = data.title || 'OJTonTrack';
   const body = data.body || 'You have a new update';
   const icon = data.icon || '/icons-192.png';
   const tag = data.tag;
   const url = data.url || '/';
   event.waitUntil(
     self.registration.showNotification(title, {
       body,
       icon,
       tag,
       data: { url }
     })
   );
 });
 
 self.addEventListener('notificationclick', function(event) {
   event.notification.close();
   const raw = (event.notification && event.notification.data && event.notification.data.url) || '/';
   const targetUrl = raw.startsWith('http') ? raw : (self.location.origin + raw);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const supervisorTab = clientList.find(c => c.url && c.url.includes('/portal/supervisor'));
      const chosen = supervisorTab || clientList[0];
      if (chosen && 'focus' in chosen) {
        try { chosen.postMessage({ type: 'notification-click', url: targetUrl }); } catch {}
        return chosen.focus();
      }
       // No existing client found; do not open a new tab to respect current session rule
       return Promise.resolve();
    })
  );
});
