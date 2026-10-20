/* Natural-hazards monitor — USGS and EMSC earthquakes (cross-matched), NASA EONET natural events, GDACS alerts and
   NASA FIRMS VIIRS fire detections on one live map with PB2002 plate boundaries, distance ranking and GeoJSON export. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('hazmon', ['zWin', 'zMin', 'zPlates']), feedsOn = SH.store.get('shandal_hazmon_feeds', { usgs: true, emsc: true, eonet: true, gdacs: true, firms: false });
  var map = SH.map('zMap', { zoom: 2, base: 'dark', center: [25, 30], canvas: true }), layers = {}, plateLayer = null, ev = [], me = null, meMk = null, timer = null;
  try { $('#zKey').value = localStorage.getItem('shandal_firms_key') || ''; } catch (e) {}
  SH.$$('#zFeeds input[value]').forEach(function (i) { i.checked = !!feedsOn[i.value]; });
  $('#zKeyWrap').hidden = !feedsOn.firms;
  var EONET_COL = { wildfires: '#FF6B35', volcanoes: '#E63946', severeStorms: '#9B5DE5', floods: '#2E86DE', dustHaze: '#C9A227', landslides: '#8D6E63', seaLakeIce: '#7FDBFF', snow: '#B0BEC5', drought: '#D4A373', earthquakes: '#F4A261', tempExtremes: '#F15BB5', manmade: '#888', waterColor: '#2EC4B6' };
  var depthCol = function (d) { return d < 35 ? '#E63946' : d < 70 ? '#F4A261' : d < 300 ? '#2A9D8F' : '#457B9D'; };
  var ago = function (ms) { var s = (Date.now() - ms) / 1000; return s < 3600 ? Math.round(s / 60) + t(' min ago', ' د مضت') : s < 86400 ? Math.round(s / 3600) + t(' h ago', ' س مضت') : Math.round(s / 86400) + t(' d ago', ' ي مضت'); };
  var winMs = function () { return { hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 }[SH.val('zWin')]; };

  /* ---------- feeds */
  function usgs() { var m = +SH.val('zMin'), lvl = m >= 4.5 ? '4.5' : m >= 2.5 ? '2.5' : 'all';
    return SH.getJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/' + lvl + '_' + SH.val('zWin') + '.geojson').then(function (j) { return j.features.filter(function (f) { return f.properties.mag >= m; }).map(function (f) { var p = f.properties, c = f.geometry.coordinates;
      return { src: 'usgs', kind: 'eq', id: f.id, lat: c[1], lon: c[0], depth: c[2], mag: p.mag, magType: p.magType, time: p.time, place: p.place, url: p.url, tsunami: p.tsunami, alert: p.alert, felt: p.felt }; }); }); }
  function emsc() { var start = new Date(Date.now() - winMs()).toISOString().slice(0, 19);
    return SH.getJSON('https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=2000&orderby=time&minmag=' + Math.max(0, +SH.val('zMin')) + '&start=' + start).then(function (j) { return (j.features || []).map(function (f) { var p = f.properties;
      return { src: 'emsc', kind: 'eq', id: p.unid, lat: p.lat, lon: p.lon, depth: p.depth, mag: p.mag, magType: p.magtype, time: Date.parse(p.time), place: p.flynn_region, url: 'https://www.seismicportal.eu/eventdetails.html?unid=' + p.unid }; }); }); }
  function eonet() { var days = Math.max(1, Math.ceil(winMs() / 864e5));
    return SH.getJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=' + Math.max(days, 7)).then(function (j) { return j.events.map(function (e) { var g = e.geometry[e.geometry.length - 1], c = g.coordinates, cat = e.categories[0] || {}; if (g.type === 'Polygon') { var r = c[0], sx = 0, sy = 0; r.forEach(function (q) { sx += q[0]; sy += q[1]; }); c = [sx / r.length, sy / r.length]; }
      return { src: 'eonet', kind: cat.id, cat: cat.title, id: e.id, lat: c[1], lon: c[0], time: Date.parse(g.date), place: e.title, url: (e.sources[0] || {}).url || e.link, mag: g.magnitudeValue, magUnit: g.magnitudeUnit, track: e.geometry.length }; }); }); }
  function gdacs() { return SH.getJSON('https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventlist=EQ;TC;FL;VO;DR;WF', { timeout: 20000 }).then(function (j) { return (j.features || []).filter(function (f) { return f.geometry && f.geometry.type === 'Point'; }).map(function (f) { var p = f.properties, c = f.geometry.coordinates;
      return { src: 'gdacs', kind: p.eventtype, id: p.eventtype + p.eventid, lat: c[1], lon: c[0], time: Date.parse(p.fromdate || p.datemodified), place: p.name || p.description, url: (p.url && p.url.report) || 'https://www.gdacs.org', alert: (p.alertlevel || '').toLowerCase(), sev: p.severitydata && p.severitydata.severitytext, country: p.country }; }); }); }
  function firms() { var key = SH.val('zKey').trim(); if (!/^[0-9a-f]{32}$/i.test(key)) return Promise.reject(new Error(t('Enter a valid FIRMS MAP_KEY.', 'أدخل مفتاح FIRMS صالحاً.'))); try { localStorage.setItem('shandal_firms_key', key); } catch (e) {}
    var b = map.getBounds(), w = Math.max(-180, b.getWest()), s = Math.max(-90, b.getSouth()), e = Math.min(180, b.getEast()), n = Math.min(90, b.getNorth()), days = Math.min(10, Math.max(1, Math.ceil(winMs() / 864e5)));
    return fetch('https://firms.modaps.eosdis.nasa.gov/api/area/csv/' + key + '/VIIRS_SNPP_NRT/' + [w, s, e, n].map(function (v) { return v.toFixed(2); }).join(',') + '/' + days).then(function (r) { if (!r.ok) throw new Error('FIRMS HTTP ' + r.status); return r.text(); }).then(function (txt) {
      var lines = txt.trim().split('\n'), h = lines.shift().split(','), ix = function (k) { return h.indexOf(k); }; return lines.slice(0, 20000).map(function (l) { var c = l.split(','), tm = c[ix('acq_date')] + 'T' + String(c[ix('acq_time')]).padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2') + ':00Z';
        return { src: 'firms', kind: 'fire', id: 'f' + c[ix('latitude')] + c[ix('longitude')] + c[ix('acq_time')], lat: +c[ix('latitude')], lon: +c[ix('longitude')], time: Date.parse(tm), frp: +c[ix('frp')], conf: c[ix('confidence')], place: 'VIIRS S-NPP · FRP ' + c[ix('frp')] + ' MW', url: 'https://firms.modaps.eosdis.nasa.gov/map/' }; }); }); }
  var F = { usgs: usgs, emsc: emsc, eonet: eonet, gdacs: gdacs, firms: firms };

  function refresh() {
    persist.save(); $('#zRef').disabled = true; $('#zStamp').textContent = t('Updating…', 'جارٍ التحديث…');
    var on = Object.keys(F).filter(function (k) { return feedsOn[k]; });
    Promise.all(on.map(function (k) { return F[k]().then(function (a) { $('[data-n="' + k + '"]').textContent = a.length; return a; }).catch(function (e) { $('[data-n="' + k + '"]').textContent = '!'; $('[data-n="' + k + '"]').title = e.message; SH.toast(k.toUpperCase() + ': ' + e.message, 'warn'); return []; }); }))
      .then(function (res) { ev = [].concat.apply([], res).filter(function (e) { return isFinite(e.lat) && isFinite(e.lon); }); match(); draw(); list(); $('#zStamp').textContent = t('Updated ', 'حُدّث ') + new Date().toLocaleTimeString(SH.lang === 'ar' ? 'ar-IQ' : 'en-GB') + ' · ' + ev.length + t(' events · auto every 5 min', ' حدثاً · تلقائياً كل 5 دقائق'); })
      .then(function () { $('#zRef').disabled = false; clearTimeout(timer); timer = setTimeout(refresh, 300000); });
    Object.keys(F).forEach(function (k) { if (!feedsOn[k]) $('[data-n="' + k + '"]').textContent = '–'; });
  }
  function match() { // flag USGS/EMSC solutions of the same earthquake
    var U = ev.filter(function (e) { return e.src === 'usgs'; }), E = ev.filter(function (e) { return e.src === 'emsc'; });
    E.forEach(function (e) { for (var i = 0; i < U.length; i++) { var u = U[i]; if (Math.abs(u.time - e.time) < 90000 && SH.dist(u, e) < 120000) { e.twin = u; u.twin = e; e.dup = true; break; } } });
  }
  function draw() {
    if (!map) return; Object.keys(layers).forEach(function (k) { map.removeLayer(layers[k]); }); layers = {};
    ev.forEach(function (e) {
      if (e.dup) return; var lay = layers[e.src] || (layers[e.src] = L.layerGroup().addTo(map)), mk;
      if (e.kind === 'eq') mk = L.circleMarker([e.lat, e.lon], { radius: Math.max(3, Math.pow(Math.max(e.mag, 1), 1.55)), color: '#fff', weight: e.src === 'emsc' ? 1.5 : 1, fillColor: depthCol(e.depth), fillOpacity: Date.now() - e.time < 36e5 ? 0.95 : 0.7, dashArray: e.src === 'emsc' ? '2 2' : null });
      else if (e.src === 'firms') mk = L.circleMarker([e.lat, e.lon], { radius: 2.5 + Math.min(4, Math.sqrt(e.frp || 1) / 3), stroke: false, fillColor: '#FF3D00', fillOpacity: .8 });
      else if (e.src === 'gdacs') mk = L.circleMarker([e.lat, e.lon], { radius: 9, color: e.alert === 'red' ? '#D00000' : e.alert === 'orange' ? '#FF8C00' : '#2E8B57', weight: 3, fillColor: '#fff', fillOpacity: .9 });
      else mk = L.circleMarker([e.lat, e.lon], { radius: 7, color: '#111', weight: 1, fillColor: EONET_COL[e.kind] || '#999', fillOpacity: .95 });
      mk.bindPopup(function () { return pop(e); }, { maxWidth: 300 }).addTo(lay); e.mk = mk;
    });
  }
  function title(e) { return e.kind === 'eq' ? 'M ' + SH.fmt(e.mag, 1) + ' · ' + (e.place || '') : e.src === 'gdacs' ? ({ EQ: t('Earthquake', 'زلزال'), TC: t('Tropical cyclone', 'إعصار مداري'), FL: t('Flood', 'فيضان'), VO: t('Volcano', 'بركان'), DR: t('Drought', 'جفاف'), WF: t('Wildfire', 'حريق غابات') }[e.kind] || e.kind) + ' · ' + (e.place || '') : e.place; }
  function pop(e) {
    var r = function (k, v) { return v == null || v === '' ? '' : '<tr><td style="color:#888;padding-inline-end:8px">' + k + '</td><td>' + v + '</td></tr>'; };
    return '<b>' + SH.esc(title(e)) + '</b><table style="font-size:12px;margin-top:6px">' + r(t('Source', 'المصدر'), e.src.toUpperCase() + (e.twin ? ' + ' + e.twin.src.toUpperCase() : '')) + r(t('Time (UTC)', 'الوقت (UTC)'), new Date(e.time).toISOString().replace('T', ' ').slice(0, 19)) +
      (e.kind === 'eq' ? r(t('Magnitude', 'القدر'), SH.fmt(e.mag, 1) + ' ' + (e.magType || '') + (e.twin ? ' · ' + e.twin.src.toUpperCase() + ' ' + SH.fmt(e.twin.mag, 1) : '')) + r(t('Depth', 'العمق'), SH.fmt(e.depth, 1) + ' km') + r(t('Tsunami flag', 'إشارة تسونامي'), e.tsunami ? '⚠ ' + t('yes', 'نعم') : '') + r('PAGER', e.alert || '') + r(t('Felt reports', 'بلاغات الشعور'), e.felt || '') : '') +
      (e.src === 'gdacs' ? r(t('Alert', 'الإنذار'), e.alert) + r(t('Severity', 'الشدة'), SH.esc(e.sev || '')) + r(t('Country', 'الدولة'), SH.esc(e.country || '')) : '') + (e.src === 'eonet' ? r(t('Category', 'الفئة'), e.cat) + r(t('Size', 'الحجم'), e.mag ? SH.fmt(e.mag, 0) + ' ' + (e.magUnit || '') : '') : '') +
      r(t('Position', 'الموقع'), e.lat.toFixed(3) + ', ' + e.lon.toFixed(3)) + (me ? r(t('Distance from you', 'البعد عنك'), SH.fmt(SH.dist(me, e) / 1000, 0) + ' km') : '') + '</table>' + (e.url ? '<a href="' + e.url + '" target="_blank" rel="noopener">' + t('Open source record ↗', 'افتح السجل الأصلي ↗') + '</a>' : '');
  }
  function list() {
    var s = SH.seg('zSort'), a = ev.filter(function (e) { return !e.dup && e.src !== 'firms'; });
    if (me) a.forEach(function (e) { e._d = SH.dist(me, e); });
    a.sort(s === 'mag' ? function (x, y) { return (y.kind === 'eq' ? y.mag : -1) - (x.kind === 'eq' ? x.mag : -1); } : s === 'dist' && me ? function (x, y) { return x._d - y._d; } : function (x, y) { return y.time - x.time; });
    var fr = ev.filter(function (e) { return e.src === 'firms'; }).length;
    $('#zList').innerHTML = (fr ? '<div class="xsmall muted" style="padding:8px 16px">' + fr + t(' FIRMS fire detections on the map', ' رصداً للحرائق من FIRMS على الخريطة') + '</div>' : '') + a.slice(0, 300).map(function (e, i) {
      var badge = e.kind === 'eq' ? '<span style="min-width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-weight:800;color:#fff;background:' + depthCol(e.depth) + '">' + SH.fmt(e.mag, 1) + '</span>' : '<span style="min-width:44px;height:44px;border-radius:10px;display:grid;place-items:center;background:' + (e.src === 'gdacs' ? (e.alert === 'red' ? '#D00000' : e.alert === 'orange' ? '#FF8C00' : '#2E8B57') : EONET_COL[e.kind] || '#999') + ';color:#fff;font-size:.7rem;font-weight:800">' + (e.src === 'gdacs' ? e.kind : (e.cat || '').slice(0, 4)) + '</span>';
      return '<button type="button" data-k="' + i + '" style="all:unset;cursor:pointer;display:flex;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid var(--line)">' + badge + '<span style="display:grid;gap:2px;min-width:0"><b style="font-size:.85rem;line-height:1.3;overflow:hidden;text-overflow:ellipsis">' + SH.esc(e.kind === 'eq' ? e.place || '' : title(e)) + '</b><span class="xsmall muted">' + e.src.toUpperCase() + (e.twin ? '+' + e.twin.src.toUpperCase() : '') + ' · ' + ago(e.time) + (e.kind === 'eq' ? ' · ' + SH.fmt(e.depth, 0) + ' km' : '') + (me ? ' · ' + SH.fmt(e._d / 1000, 0) + ' km' + t(' away', ' عنك') : '') + (e.tsunami ? ' · ⚠ tsunami' : '') + '</span></span></button>';
    }).join('');
    $('#zList')._a = a;
  }
  $('#zList').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var x = $('#zList')._a[+b.getAttribute('data-k')]; if (x && x.mk && map) { map.flyTo([x.lat, x.lon], Math.max(map.getZoom(), 6), { duration: .8 }); setTimeout(function () { x.mk.openPopup(); }, 850); } });
  $('#zFeeds').addEventListener('change', function (e) { var v = e.target.value; if (e.target.id === 'zPlates') { plates(); persist.save(); return; } if (!v) return; feedsOn[v] = e.target.checked; SH.store.set('shandal_hazmon_feeds', feedsOn); $('#zKeyWrap').hidden = !feedsOn.firms; if (v === 'firms' && e.target.checked && !SH.val('zKey')) { SH.toast(t('Enter your free FIRMS key, then refresh.', 'أدخل مفتاح FIRMS المجاني ثم حدّث.'), 'info'); return; } refresh(); });
  ['zWin', 'zMin'].forEach(function (id) { $('#' + id).addEventListener('change', refresh); });
  document.addEventListener('click', function (e) { if (e.target.closest('#zSort button')) setTimeout(list, 0); });
  $('#zRef').addEventListener('click', refresh);
  $('#zMe').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { me = p; if (meMk) meMk.setLatLng([p.lat, p.lon]); else meMk = L.marker([p.lat, p.lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); map.setView([p.lat, p.lon], 5); var d = SH.$('#zSort button[data-v="dist"]'); if (d) d.click(); else list(); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  $('#zGeo').addEventListener('click', function () { SH.json('shandal-hazards-' + new Date().toISOString().slice(0, 16).replace(':', '') + '.geojson', { type: 'FeatureCollection', features: ev.map(function (e) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [e.lon, e.lat] }, properties: { source: e.src, kind: e.kind, id: e.id, time: new Date(e.time).toISOString(), mag: e.mag, depth_km: e.depth, place: e.place, url: e.url, alert: e.alert } }; }) }); });
  var PCOL = { SUB: '#E63946', OCB: '#E76F51', CCB: '#F4A261', OSR: '#2A9D8F', CRB: '#57CC99', OTF: '#9D4EDD', CTF: '#C77DFF' };
  var PNAME = { SUB: t('subduction zone', 'نطاق اندساس'), OCB: t('oceanic convergent', 'تقارب محيطي'), CCB: t('continental collision', 'تصادم قاري'), OSR: t('spreading ridge', 'ظهر منتشر'), CRB: t('continental rift', 'خسيف قاري'), OTF: t('oceanic transform', 'تحويلي محيطي'), CTF: t('continental transform', 'تحويلي قاري') };
  function plates() {
    if (!map) return; if (!$('#zPlates').checked) { if (plateLayer) map.removeLayer(plateLayer); return; } if (plateLayer) { plateLayer.addTo(map); return; }
    SH.getJSON(SH.base + 'assets/data/plates.json').then(function (P) { plateLayer = L.layerGroup(); var rnd = L.canvas();
      P.forEach(function (p) { var parts = [[]]; for (var i = 0; i < p[3].length; i += 2) { var cur = parts[parts.length - 1], q = [p[3][i + 1], p[3][i]]; if (cur.length && Math.abs(q[1] - cur[cur.length - 1][1]) > 180) parts.push(cur = []); cur.push(q); } parts.forEach(function (ll) { if (ll.length < 2) return; L.polyline(ll, { renderer: rnd, color: PCOL[p[1]] || '#aaa', weight: 1.6, opacity: .8 }).bindTooltip(p[0] + ' · ' + (PNAME[p[1]] || p[1]) + ' · ' + p[2] + ' mm/yr', { sticky: true }).addTo(plateLayer); }); });
      plateLayer.addTo(map); plateLayer.eachLayer(function (l) { l.bringToBack && l.bringToBack(); }); }).catch(function () {});
  }
  plates(); refresh();
})();
