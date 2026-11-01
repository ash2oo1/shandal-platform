/* Shandal System service worker — keeps the heavy, unchanging files (map and chart libraries, fonts, scripts,
   styles, images, data) on the device after the first visit, so later visits open at once even when many people use
   the system or the connection is weak. Pages are always fetched fresh first and fall back to the saved copy offline.
   Only files of this site are stored; data services, maps and the subscriber service are never cached here. */
var V = 'shandal-v1', STATIC = V + '-static', PAGES = V + '-pages';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf(V) !== 0; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
function trim(name, max) { caches.open(name).then(function (c) { c.keys().then(function (ks) { if (ks.length > max) ks.slice(0, ks.length - max).forEach(function (k) { c.delete(k); }); }); }); }
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url); if (u.origin !== self.location.origin) return;
  var p = u.pathname;
  if (r.mode === 'navigate' || /\.html?$/.test(p) || p.slice(-1) === '/') {
    /* pages: network first (6 s), saved copy when offline or very slow */
    e.respondWith(new Promise(function (res) {
      var done = false, tm = setTimeout(function () { caches.match(r).then(function (c) { if (c && !done) { done = true; res(c); } }); }, 6000);
      fetch(r).then(function (n) { clearTimeout(tm); if (n.ok) { var cp = n.clone(); caches.open(PAGES).then(function (c) { c.put(r, cp); trim(PAGES, 120); }); } if (!done) { done = true; res(n); } })
        .catch(function () { clearTimeout(tm); caches.match(r).then(function (c) { if (!done) { done = true; res(c || Response.error()); } }); });
    }));
    return;
  }
  if (p.indexOf('/assets/') < 0) return;
  var versioned = /[?&]v=/.test(u.search) || p.indexOf('/assets/vendor/') >= 0 || p.indexOf('/assets/fonts/') >= 0;
  e.respondWith(caches.open(STATIC).then(function (c) {
    return c.match(r).then(function (hit) {
      var net = fetch(r).then(function (n) { if (n.ok) { c.put(r, n.clone()); trim(STATIC, 600); } return n; });
      if (hit && versioned) return hit;                       /* versioned files never change: serve from the device */
      if (hit) { net.catch(function () {}); return hit; }    /* images and data: serve saved copy, refresh in the background */
      return net;
    });
  }));
});
