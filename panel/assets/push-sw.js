// The panel's service worker: shows an order notification when the server
// sends one, and opens the panel when it is tapped. It caches nothing.
var HOME = new URL(self.location).searchParams.get('home') || self.registration.scope;
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'הזמנה חדשה', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'הזמנה חדשה', {
    body: d.body || '', tag: d.tag || 'order', renotify: true, dir: 'rtl', lang: 'he',
    vibrate: [200, 100, 200], requireInteraction: false, data: { url: d.url || HOME }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || HOME;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if (cs[i].url.indexOf(url.split('#')[0].split('?')[0]) === 0 && 'focus' in cs[i]) return cs[i].focus();
    return self.clients.openWindow(url);
  }));
});
