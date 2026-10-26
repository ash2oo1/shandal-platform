/* Shandal offline shell: network first for every same-origin GET, with the last good copy kept in the cache.
   Online visitors always receive the current site; in the field without a connection, pages and tools that were
   opened before still load, and the surveys saved on the device remain available. */
var CACHE = 'shandal-offline-v1';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url); if (u.origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then(function (m) { return m || caches.match(r, { ignoreSearch: true }); }).then(function (m) { return m || new Response('', { status: 503, statusText: 'Offline' }); }); }));
});
