/* Geo-heritage atlas — geosites and monuments linked to the ground they stand on: filters, distance ranking,
   site sheets with geology, photo gallery, live conditions and directions. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, lang = SH.lang;
  var map = SH.map('hMap', { zoom: 6, base: 'satellite', center: [33.2, 44.2] }), sites = [], marks = {}, me = null, meMk = null, cur = null, gal = [], gi = 0;
  var TYPE = { cave: ['#8E5B3A', t('Cave', 'كهف'), 'M4 20c0-6 3.5-11 8-11s8 5 8 11'], mountain: ['#6D5E4B', t('Landform', 'شكل أرضي'), 'm3 20 6-10 4 6 2-3 6 7z'], river: ['#2E78B7', t('River landform', 'شكل نهري'), 'M3 8c3 0 3 3 6 3s3-3 6-3 3 3 6 3M3 15c3 0 3 3 6 3s3-3 6-3 3 3 6 3'], heritage: ['#A9853B', t('Heritage', 'تراث'), 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6'] };
  var ERA = { Precambrian: t('Precambrian', 'ما قبل الكامبري'), Paleozoic: t('Paleozoic', 'الباليوزوي'), Mesozoic: t('Mesozoic', 'الميزوزوي'), Cenozoic: t('Cenozoic', 'السينوزوي') };
  var img = function (s, n, th) { return SH.base + 'assets/img/geoheritage/' + s.id + '-' + n + (th ? '-t' : '') + '.webp'; };
  var pin = function (s) { var c = TYPE[s.type] || TYPE.heritage; return L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 32], html: '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + c[0] + ';border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);display:grid;place-items:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)"><path d="' + c[2] + '"/></svg></div>' }); };

  SH.getJSON(SH.base + 'assets/data/geoheritage.json').then(function (j) {
    sites = j; sites.forEach(function (s) { var d = s[lang] || s.en; if (map) marks[s.id] = L.marker([s.lat, s.lon], { icon: pin(s), title: d.name }).on('click', function () { open(s.id); }).addTo(map); });
    list(); var h = (location.hash || '').slice(1); if (h && sites.some(function (s) { return s.id === h; })) open(h);
  }).catch(function (e) { SH.toast(e.message, 'bad'); });

  function filtered() {
    var q = (SH.val('hQ') || '').toLowerCase(), ty = SH.seg('hType'), er = SH.seg('hEra');
    var a = sites.filter(function (s) { var d = s[lang] || s.en, txt = (d.name + ' ' + d.prov + ' ' + d.rock + ' ' + d.fm + ' ' + s.en.name).toLowerCase(); return (ty === 'all' || s.type === ty) && (er === 'all' || s.era === er) && (!q || txt.indexOf(q) >= 0); });
    if (me) a.forEach(function (s) { s._d = SH.dist(me, { lat: s.lat, lon: s.lon }); }), a.sort(function (x, y) { return x._d - y._d; });
    return a;
  }
  function list() {
    var a = filtered(), vis = {}; a.forEach(function (s) { vis[s.id] = 1; });
    Object.keys(marks).forEach(function (k) { if (vis[k]) { if (!map.hasLayer(marks[k])) marks[k].addTo(map); } else map.removeLayer(marks[k]); });
    $('#hList').innerHTML = '<div class="xsmall muted" style="padding:10px 16px">' + a.length + t(' sites', ' موقعاً') + '</div>' + a.map(function (s) { var d = s[lang] || s.en, c = TYPE[s.type];
      return '<button type="button" data-id="' + s.id + '" style="all:unset;cursor:pointer;display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px 16px;border-top:1px solid var(--line);align-items:center' + (cur === s.id ? ';background:var(--accent-soft)' : '') + '">' +
        (s.img ? '<img src="' + img(s, 1, true) + '" alt="" loading="lazy" style="width:64px;height:64px;object-fit:cover;border-radius:10px">' : '<span style="width:64px;height:64px;border-radius:10px;display:grid;place-items:center;background:' + SH.alpha(c[0], .15) + '"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="' + c[0] + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + c[2] + '"/></svg></span>') +
        '<span style="display:grid;gap:3px;min-width:0"><b style="font-size:.9rem;line-height:1.3">' + SH.esc(d.name) + '</b><span class="xsmall muted">' + SH.esc(d.prov) + ' · ' + c[1] + '</span><span class="xsmall" style="color:var(--accent)">' + ERA[s.era] + (s._d != null && me ? ' · ' + SH.fmt(s._d / 1000, s._d < 1e4 ? 1 : 0) + ' km' : '') + '</span></span></button>'; }).join('');
  }
  $('#hList').addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) open(b.getAttribute('data-id'), true); });
  $('#hQ').addEventListener('input', list);
  document.addEventListener('click', function (e) { if (e.target.closest('#hType button,#hEra button')) setTimeout(list, 0); });
  $('#hMe').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { me = p; if (meMk) meMk.setLatLng([p.lat, p.lon]); else meMk = L.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#1F6FB2', fillOpacity: 1 }).bindTooltip(t('You are here', 'أنت هنا')).addTo(map); list(); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });

  function open(id, fly) {
    var s = sites.filter(function (x) { return x.id === id; })[0]; if (!s) return; cur = id; var d = s[lang] || s.en, c = TYPE[s.type]; history.replaceState(null, '', '#' + id);
    if (map && fly !== false) map.flyTo([s.lat, s.lon], Math.max(map.getZoom(), 13), { duration: .8 });
    var row = function (k, v) { return '<tr><th style="width:38%">' + k + '</th><td>' + SH.esc(v) + '</td></tr>'; };
    var gallery = s.img ? '<div style="display:grid;grid-auto-flow:column;grid-auto-columns:120px;gap:8px;overflow-x:auto;padding:0 18px 4px">' + Array.from({ length: s.img }, function (_, i) { return '<img src="' + img(s, i + 1, true) + '" data-g="' + i + '" alt="' + SH.esc(d.name) + ' ' + (i + 1) + '" loading="lazy" style="width:120px;height:86px;object-fit:cover;border-radius:10px;cursor:zoom-in">'; }).join('') + '</div>' : '<p class="xsmall muted" style="margin:0 18px">' + t('No photographs yet for this site.', 'لا توجد صور لهذا الموقع بعد.') + '</p>';
    $('#hCard').innerHTML = (s.img ? '<div style="position:relative;height:180px;background:#111 url(' + img(s, 1) + ') center/cover;border-radius:18px 18px 0 0"></div>' : '') +
      '<div style="padding:16px 18px 6px;display:flex;gap:10px;align-items:start"><div style="flex:1"><span class="xsmall" style="color:' + c[0] + ';font-weight:700;text-transform:uppercase;letter-spacing:.06em">' + c[1] + ' · ' + ERA[s.era] + '</span><h2 style="margin:4px 0 2px;font-size:1.2rem">' + SH.esc(d.name) + '</h2><span class="xsmall muted">' + SH.esc(d.prov) + ' · <span class="ltr">' + SH.fmtLatLon(s.lat, s.lon, 4) + '</span></span></div><button type="button" class="x" data-close aria-label="' + t('Close', 'إغلاق') + '">✕</button></div>' +
      '<p style="margin:6px 18px 12px;font-size:.9rem;line-height:1.75">' + SH.esc(d.desc) + '</p>' + gallery +
      '<table class="kv" style="margin-top:12px">' + row(t('Formation', 'التكوين'), d.fm) + row(t('Rock type', 'نوع الصخر'), d.rock) + row(t('Tectonic setting', 'البيئة التكتونية'), d.tect) + '</table>' +
      '<div id="hNow" class="xsmall muted" style="padding:10px 18px">' + t('Reading current conditions…', 'جارٍ قراءة الظروف الحالية…') + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 18px 18px"><a class="btn btn-gold btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lon + '">' + t('Directions', 'الاتجاهات') + '</a><a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + s.lat + '&mlon=' + s.lon + '#map=15/' + s.lat + '/' + s.lon + '">OpenStreetMap</a><button type="button" class="btn btn-line btn-sm" data-copy>' + t('Copy link', 'نسخ الرابط') + '</button></div>';
    $('#hCard').hidden = false; $('#hCard').scrollTop = 0; gal = Array.from({ length: s.img }, function (_, i) { return img(s, i + 1); }); list();
    SH.getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + s.lat + '&longitude=' + s.lon + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1', { timeout: 12000 }).then(function (w) { if (cur !== id) return; var c2 = w.current;
      $('#hNow').innerHTML = '<b>' + t('Now at the site', 'الآن في الموقع') + ':</b> ' + SH.fmt(c2.temperature_2m, 0) + '°C · ' + t('humidity ', 'الرطوبة ') + c2.relative_humidity_2m + '% · ' + t('wind ', 'الرياح ') + SH.fmt(c2.wind_speed_10m, 0) + ' km/h · ☀ ' + w.daily.sunrise[0].slice(11) + '–' + w.daily.sunset[0].slice(11); }).catch(function () { $('#hNow').textContent = ''; });
  }
  $('#hCard').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { $('#hCard').hidden = true; cur = null; history.replaceState(null, '', location.pathname); list(); return; }
    if (e.target.closest('[data-copy]')) { navigator.clipboard && navigator.clipboard.writeText(location.href).then(function () { SH.toast(t('Link copied.', 'نُسخ الرابط.'), 'ok'); }); return; }
    var g = e.target.closest('[data-g]'); if (g) { gi = +g.getAttribute('data-g'); lb(); }
  });
  function lb() { $('#hImg').src = gal[gi]; $('#hCap').textContent = (gi + 1) + ' / ' + gal.length; $('#hLight').hidden = false; }
  $('#hLight').addEventListener('click', function (e) { var b = e.target.closest('[data-lb]'), k = b && b.getAttribute('data-lb'); if (k === 'x' || e.target === this) this.hidden = true; else if (k === 'n') { gi = (gi + 1) % gal.length; lb(); } else if (k === 'p') { gi = (gi - 1 + gal.length) % gal.length; lb(); } });
  document.addEventListener('keydown', function (e) { if ($('#hLight').hidden) return; if (e.key === 'Escape') $('#hLight').hidden = true; if (e.key === 'ArrowRight') { gi = (gi + 1) % gal.length; lb(); } if (e.key === 'ArrowLeft') { gi = (gi - 1 + gal.length) % gal.length; lb(); } });
})();
