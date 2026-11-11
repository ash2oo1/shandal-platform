/* Offline field survival map. Before the trip (online) an area is saved on the device: the map features of water,
   settlements, roads, health, police, shelter and peaks from the open map database, a 1-arc-second elevation model from
   which slope, hillshade and the drainage network are computed, and the rain, temperature and soil wetness around the
   download time. In the field (offline) the position from the phone's satellite receiver is placed on that map and the
   nearest of each need is given with an arrow, the distance, the walking time from the slope (Tobler) and the height to
   climb; the ground where one stands is read for steep slopes, stream beds, recent rain and the border strip. The sun
   times are computed from astronomy, so they need no network. Everything is kept in IndexedDB on the device. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, E = SH.esc, P = window.PCX, AR = SH.lang === 'ar', L = window.L;
  var OVP = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  var WX = 'https://api.open-meteo.com/v1/forecast';
  var PRE = [['shaqlawa', 'Shaqlawa – Harir', 'شقلاوة – حرير', 36.43, 44.32], ['rawanduz', 'Rawanduz – Gali Ali Beg', 'راوندوز – گلي علي بيگ', 36.6, 44.5], ['dukan', 'Dukan lake', 'بحيرة دوكان', 35.98, 44.95],
    ['amedi', 'Amedi – Sulav', 'العمادية – سولاف', 37.08, 43.47], ['hawraman', 'Halabja – Hawraman', 'حلبجة – هورامان', 35.21, 46.08], ['bazian', 'Bazian – Qara Dagh', 'بازيان – قره داغ', 35.48, 45.3]];
  /* kinds of map feature: [label en, label ar, colour] */
  var K = {
    riv: ['River or canal', 'نهر أو قناة', '#1F6FB8'], str: ['Stream', 'جدول', '#4A9BDB'], lak: ['Lake or reservoir', 'بحيرة أو خزان', '#1F6FB8'], spr: ['Spring', 'عين ماء', '#0B8FB0'], wel: ['Well or water point', 'بئر أو نقطة ماء', '#0B8FB0'],
    twn: ['Town', 'مدينة أو بلدة', '#1D2731'], vil: ['Village', 'قرية', '#3C4A57'], ham: ['Hamlet or houses', 'تجمع بيوت', '#5C6873'],
    rdM: ['Main road', 'طريق رئيس', '#D9622B'], rdm: ['Minor road', 'طريق فرعي', '#E9A05F'], trk: ['Dirt track', 'طريق ترابي', '#8C6239'], pth: ['Footpath', 'ممر مشاة', '#6B4A2B'],
    med: ['Hospital, clinic or pharmacy', 'مستشفى أو مستوصف أو صيدلية', '#C0392B'], pol: ['Police', 'شرطة', '#1F3A93'], fue: ['Fuel station', 'محطة وقود', '#7D3C98'],
    shl: ['Shelter, hut or camp', 'ملجأ أو كوخ أو مخيم', '#2F7D5B'], htl: ['Hotel or guest house', 'فندق أو دار ضيافة', '#2F7D5B'], pk: ['Peak', 'قمة', '#6B4A2B'], cav: ['Cave entrance', 'مدخل كهف', '#55616B']
  };
  /* what is searched for: id, title en/ar, kinds, icon letter */
  var NEED = [['spring', 'Spring or well', 'عين أو بئر', ['spr', 'wel']], ['river', 'River or lake', 'نهر أو بحيرة', ['riv', 'lak']], ['stream', 'Stream (may be dry)', 'جدول (قد يكون جافاً)', ['str']],
    ['settle', 'Village or houses', 'قرية أو بيوت', ['twn', 'vil', 'ham']], ['town', 'Town', 'مدينة أو بلدة', ['twn']], ['road', 'Road or track for a car', 'طريق أو درب للسيارة', ['rdM', 'rdm', 'trk']],
    ['paved', 'Main or minor road', 'طريق رئيس أو فرعي', ['rdM', 'rdm']], ['med', 'Clinic or hospital', 'مستوصف أو مستشفى', ['med']], ['pol', 'Police', 'شرطة', ['pol']],
    ['shelter', 'Shelter or lodging', 'ملجأ أو مبيت', ['shl', 'htl']], ['peak', 'High point (signal, view)', 'مرتفع (إشارة وإطلالة)', ['pk']]];
  var DB = null, PK = null, PACKS = [], POS = null, HEAD = null, CTR = null, PLAN = false, TRK = [], REC = false, WATCH = null, SEL = null, NAME_EN = '', LAST = 0, LASTU = 0, OUTLINE = null, CMP = false, busy = false;
  var IDS = ['smSize', 'smName'], persist = SH.persist('survivalmap', IDS);

  /* ---------------------------------------------------------------- storage on the device */
  function idb() {
    if (DB) return Promise.resolve(DB);
    return new Promise(function (res, rej) {
      var rq = indexedDB.open('shandal-survival', 1);
      rq.onupgradeneeded = function () { var d = rq.result; if (!d.objectStoreNames.contains('packs')) d.createObjectStore('packs', { keyPath: 'id' }); if (!d.objectStoreNames.contains('tracks')) d.createObjectStore('tracks', { keyPath: 'id' }); };
      rq.onsuccess = function () { DB = rq.result; res(DB); }; rq.onerror = function () { rej(rq.error); };
    });
  }
  function tx(store, mode, fn) { return idb().then(function (d) { return new Promise(function (res, rej) { var x = d.transaction(store, mode), s = x.objectStore(store), r = fn(s); x.oncomplete = function () { res(r && r.result); }; x.onerror = function () { rej(x.error); }; }); }); }
  var dbPut = function (st, v) { return tx(st, 'readwrite', function (s) { return s.put(v); }); };
  var dbGet = function (st, k) { return tx(st, 'readonly', function (s) { return s.get(k); }); };
  var dbDel = function (st, k) { return tx(st, 'readwrite', function (s) { return s.delete(k); }); };
  var dbAll = function (st) { return tx(st, 'readonly', function (s) { return s.getAll(); }); };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

  /* ---------------------------------------------------------------- geometry helpers */
  var R0 = 6371008.8;
  function dist(a, b) { return SH.dist({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }); }
  function brg(a, b) { return SH.bearing({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }); }
  /* nearest point on a polyline g to p, in a local metric frame */
  function nearLine(p, g) {
    var kx = Math.cos(SH.rad(p[0])) * R0 * Math.PI / 180, ky = R0 * Math.PI / 180, best = Infinity, bp = null;
    for (var i = 0; i < g.length - 1; i++) {
      var ax = (g[i][1] - p[1]) * kx, ay = (g[i][0] - p[0]) * ky, bx = (g[i + 1][1] - p[1]) * kx, by = (g[i + 1][0] - p[0]) * ky, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      var u = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0, x = ax + u * dx, y = ay + u * dy, d2 = x * x + y * y;
      if (d2 < best) { best = d2; bp = [p[0] + y / ky, p[1] + x / kx]; }
    }
    return { d: Math.sqrt(best), p: bp };
  }
  function simplify(pts, tol) {
    if (pts.length < 3) return pts; var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; var st = [[0, pts.length - 1]];
    while (st.length) { var s = st.pop(), a = pts[s[0]], b = pts[s[1]], md = 0, mi = -1;
      for (var i = s[0] + 1; i < s[1]; i++) { var dx = b[1] - a[1], dy = b[0] - a[0], l = Math.hypot(dx, dy) || 1e-12, dd = Math.abs(dy * (pts[i][1] - a[1]) - dx * (pts[i][0] - a[0])) / l; if (dd > md) { md = dd; mi = i; } }
      if (md > tol) { keep[mi] = 1; st.push([s[0], mi], [mi, s[1]]); } }
    return pts.filter(function (_, i) { return keep[i]; });
  }
  var r5 = function (v) { return Math.round(v * 1e5) / 1e5; };
  function compass8(b) { var n = AR ? ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; return n[Math.round(((b % 360) + 360) % 360 / 45) % 8]; }
  function km(m) { return m < 1000 ? F(Math.round(m / 10) * 10, 0) + t(' m', ' م') : F(m / 1000, m < 10000 ? 1 : 0) + t(' km', ' كم'); }
  function hm(min) { if (!isFinite(min)) return '—'; min = Math.max(1, Math.round(min)); var h = Math.floor(min / 60), m = min % 60; return h ? h + t(' h ', ' س ') + (m ? m + t(' min', ' د') : '') : m + t(' min', ' د'); }

  /* ---------------------------------------------------------------- sun times from astronomy (NOAA), no network */
  function sun(lat, lon, day) {
    var y0 = Date.UTC(day.getFullYear(), 0, 1), d0 = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()), doy = (d0 - y0) / 864e5 + 1, g = 2 * Math.PI / 365 * (doy - 0.5);
    var eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var cw = (Math.sin(SH.rad(-0.833)) - Math.sin(SH.rad(lat)) * Math.sin(dec)) / (Math.cos(SH.rad(lat)) * Math.cos(dec)); if (cw < -1 || cw > 1) return null;
    var w = SH.deg(Math.acos(cw)), noon = 720 - 4 * lon - eot;                       /* minutes after 00:00 UTC */
    return { rise: new Date(d0 + (noon - 4 * w) * 6e4), set: new Date(d0 + (noon + 4 * w) * 6e4) };
  }
  var hhmm = function (d) { return d ? d.toLocaleTimeString(AR ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'; };

  /* ---------------------------------------------------------------- map */
  var map = SH.map('smMap', { zoom: 7, center: [36.0, 44.4], base: 'topo' }), CANV = L.canvas({ padding: 0.3 });
  var G = { hs: null, hz: null, ch: null, vec: L.layerGroup(), lbl: L.layerGroup(), trk: L.polyline([], { color: '#E4007C', weight: 3.5, opacity: .9 }), sel: L.polyline([], { color: '#B08A3E', weight: 3, dashArray: '8 6' }), box: null, me: null, acc: null, ctr: null };
  G.vec.addTo(map); G.lbl.addTo(map); G.trk.addTo(map); G.sel.addTo(map);
  var LAY = { hz: [t('Steep slopes', 'المنحدرات الشديدة'), 1], ch: [t('Stream beds (flash floods)', 'بطون الوديان (السيول)'), 1], hs: [t('Relief shading', 'تظليل التضاريس'), 1], lbl: [t('Names', 'الأسماء'), 1] };
  function lzCls() { map.getContainer().classList.toggle('lz-lo', map.getZoom() < 12); }
  map.on('zoomend', lzCls); lzCls();
  function boxOf(c, sz) { var dLa = sz / 2 / 111.32, dLo = dLa / Math.cos(SH.rad(c[0])); return { s: c[0] - dLa, n: c[0] + dLa, w: c[1] - dLo, e: c[1] + dLo }; }
  function drawBox() {
    if (G.box) map.removeLayer(G.box); G.box = null; if (PK) { G.box = L.rectangle([[PK.a.s, PK.a.w], [PK.a.n, PK.a.e]], { color: '#B08A3E', weight: 2, fill: false, dashArray: '6 5', interactive: false }).addTo(map); return; }
    if (!CTR) return; var a = boxOf(CTR, +$('#smSize').value); G.box = L.rectangle([[a.s, a.w], [a.n, a.e]], { color: '#B08A3E', weight: 2, fillOpacity: .06, dashArray: '6 5', interactive: false }).addTo(map);
    $('#smCtr').textContent = F(CTR[0], 4) + '°, ' + F(CTR[1], 4) + '°';
  }
  function setCtr(c, name, fit) { CTR = c; if (name === '') NAME_EN = ''; if (name) $('#smName').value = name; drawBox(); if (fit && G.box) map.fitBounds(G.box.getBounds(), { padding: [20, 20] }); }
  $('#smPre').innerHTML = PRE.map(function (p) { return '<button type="button" data-k="' + p[0] + '">' + E(AR ? p[2] : p[1]) + '</button>'; }).join('');
  $('#smPre').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var p = PRE.filter(function (q) { return q[0] === b.getAttribute('data-k'); })[0]; closePack(); NAME_EN = p[1]; $$('#smPre button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); setCtr([p[3], p[4]], AR ? p[2] : p[1], true); });
  $('#smSize').addEventListener('change', function () { drawBox(); });
  $('#smMe').addEventListener('click', function () { SH.locate().then(function (p) { closePack(); setCtr([p.lat, p.lon], '', true); }).catch(function (e) { SH.toast(e.message, 'bad'); }); });
  map.on('click', function (e) { if (PLAN && PK) { setPos({ lat: e.latlng.lat, lon: e.latlng.lng, acc: 0, plan: true }); return; } if (!PK) { NAME_EN = ''; setCtr([e.latlng.lat, e.latlng.lng], null, false); } });

  /* ---------------------------------------------------------------- download: features */
  function ovQuery(a) {
    var bb = [a.s, a.w, a.n, a.e].map(function (v) { return v.toFixed(5); }).join(',');
    return '[out:json][timeout:150][bbox:' + bb + '];(' +
      'way[waterway~"^(river|stream|canal|ditch|drain)$"];way[natural=water];rel[natural=water];way[landuse=reservoir];' +
      'node[natural=spring];node[man_made~"^(water_well|water_tap|water_tower)$"];node[amenity~"^(drinking_water|water_point)$"];' +
      'node[place~"^(city|town|village|hamlet|isolated_dwelling|suburb)$"];' +
      'way[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track|path|footway|bridleway)$"];' +
      'nwr[amenity~"^(hospital|clinic|doctors|pharmacy|police|fuel)$"];nwr[healthcare~"^(hospital|clinic|centre)$"];' +
      'node[natural~"^(peak|cave_entrance)$"];nwr[tourism~"^(alpine_hut|wilderness_hut|camp_site|hotel|guest_house|motel|hostel)$"];nwr[amenity=shelter];' +
      ');out geom qt;';
  }
  function ovFetch(q, i) {
    i = i || 0; if (i >= OVP.length) return Promise.reject(new Error(t('The map database is busy. Try again in a few minutes.', 'قاعدة بيانات الخريطة مشغولة. أعد المحاولة بعد دقائق.')));
    return fetch(OVP[i], { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(function () { return ovFetch(q, i + 1); });
  }
  function kindOf(tg) {
    var w = tg.waterway, h = tg.highway, am = tg.amenity, pl = tg.place;
    if (w === 'river' || w === 'canal') return 'riv'; if (w) return 'str';
    if (tg.natural === 'water' || tg.landuse === 'reservoir') return 'lak'; if (tg.natural === 'spring') return 'spr';
    if (/^(water_well|water_tap|water_tower)$/.test(tg.man_made || '') || /^(drinking_water|water_point)$/.test(am || '')) return 'wel';
    if (pl === 'city' || pl === 'town') return 'twn'; if (pl === 'village' || pl === 'suburb') return 'vil'; if (pl) return 'ham';
    if (/^(motorway|trunk|primary|secondary)$/.test(h || '')) return 'rdM'; if (h === 'tertiary' || h === 'unclassified') return 'rdm'; if (h === 'track') return 'trk'; if (h) return 'pth';
    if (/^(hospital|clinic|doctors|pharmacy)$/.test(am || '') || tg.healthcare) return 'med'; if (am === 'police') return 'pol'; if (am === 'fuel') return 'fue';
    if (am === 'shelter' || /hut|camp_site/.test(tg.tourism || '')) return 'shl'; if (tg.tourism) return 'htl';
    if (tg.natural === 'peak') return 'pk'; if (tg.natural === 'cave_entrance') return 'cav'; return null;
  }
  function parseOv(j) {
    var out = [], seen = {};
    (j.elements || []).forEach(function (el) {
      var tg = el.tags || {}, k = kindOf(tg); if (!k) return; var key = el.type + el.id; if (seen[key]) return; seen[key] = 1;
      var f = { k: k }; if (tg.name) f.n = tg.name; if (tg['name:ar']) f.na = tg['name:ar']; if (tg['name:en']) f.ne = tg['name:en'];
      if (tg.intermittent === 'yes' || tg.seasonal === 'yes') f.x = 1; if (tg.ele && k === 'pk') f.h = Math.round(parseFloat(tg.ele)) || undefined;
      var lines = [];
      if (el.type === 'node') f.p = [r5(el.lat), r5(el.lon)];
      else if (el.type === 'way' && el.geometry) lines.push(el.geometry);
      else if (el.type === 'relation' && el.members) el.members.forEach(function (m) { if (m.geometry && m.role !== 'inner') lines.push(m.geometry); });
      if (!f.p) {
        lines = lines.map(function (g) { return simplify(g.filter(Boolean).map(function (q) { return [q.lat, q.lon]; }), 0.00005).map(function (q) { return [r5(q[0]), r5(q[1])]; }); }).filter(function (g) { return g.length > 1; });
        if (!lines.length) return;
        if (/^(med|pol|fue|shl|htl|spr|wel|cav|pk)$/.test(k)) { var g0 = lines[0], la = 0, lo = 0; g0.forEach(function (q) { la += q[0]; lo += q[1]; }); f.p = [r5(la / g0.length), r5(lo / g0.length)]; }
        else if (lines.length === 1) f.g = lines[0]; else { lines.forEach(function (g) { var c = Object.assign({}, f); c.g = g; out.push(c); }); return; }
      }
      out.push(f);
    });
    return out;
  }

  /* ---------------------------------------------------------------- download: elevation and terrain analysis */
  function terrain(a, onP) {
    var size = (a.n - a.s) * 111.32, N = Math.max(200, Math.min(900, Math.round(size * 1000 / 45))), W = Math.round(N * (a.e - a.w) * Math.cos(SH.rad((a.s + a.n) / 2)) / (a.n - a.s)), H = N;
    return SH.pc.dem(a, 'cop-dem-glo-30', function (d, n) { onP(d / n); }, 1400).then(function (f) {
      var z = new Float32Array(W * H), bad = 0;
      for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) { var v = f(a.n - (r + 0.5) / H * (a.n - a.s), a.w + (c + 0.5) / W * (a.e - a.w)); z[r * W + c] = isFinite(v) ? v : NaN; if (!isFinite(v)) bad++; }
      if (bad) { var mn = Infinity; for (var i = 0; i < z.length; i++) if (z[i] < mn) mn = z[i]; for (i = 0; i < z.length; i++) if (!isFinite(z[i])) z[i] = isFinite(mn) ? mn : 0; }
      return analyse(a, W, H, z);
    });
  }
  function analyse(a, W, H, z) {
    var dx = (a.e - a.w) / W * 111320 * Math.cos(SH.rad((a.s + a.n) / 2)), dy = (a.n - a.s) / H * 111320, n = W * H, slope = new Uint8Array(n), shade = new Float32Array(n);
    var at = function (r, c) { r = r < 0 ? 0 : r >= H ? H - 1 : r; c = c < 0 ? 0 : c >= W ? W - 1 : c; return z[r * W + c]; };
    var az = SH.rad(315), alt = SH.rad(45);
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var gx = ((at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1)) - (at(r - 1, c - 1) + 2 * at(r, c - 1) + at(r + 1, c - 1))) / (8 * dx);
      var gy = ((at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1)) - (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1))) / (8 * dy);
      var s = Math.atan(Math.hypot(gx, gy)), asp = Math.atan2(gy, -gx), i = r * W + c; slope[i] = Math.min(90, Math.round(SH.deg(s)));
      shade[i] = Math.max(0, Math.sin(alt) * Math.cos(s) + Math.cos(alt) * Math.sin(s) * Math.cos(az - Math.PI / 2 + asp));
    }
    /* D8 flow accumulation: cells in descending order of height pass their area to the steepest lower neighbour */
    var ord = new Uint32Array(n); for (var q = 0; q < n; q++) ord[q] = q; ord.sort(function (p1, p2) { return z[p2] - z[p1]; });
    var acc = new Float32Array(n).fill(1), DR = [-1, -1, -1, 0, 0, 1, 1, 1], DC = [-1, 0, 1, -1, 1, -1, 0, 1];
    for (q = 0; q < n; q++) { var k = ord[q], rr = (k / W) | 0, cc = k - rr * W, best = 0, bi = -1;
      for (var m = 0; m < 8; m++) { var r2 = rr + DR[m], c2 = cc + DC[m]; if (r2 < 0 || r2 >= H || c2 < 0 || c2 >= W) continue; var j = r2 * W + c2, dd = (z[k] - z[j]) / Math.hypot(DR[m] * dy, DC[m] * dx); if (dd > best) { best = dd; bi = j; } }
      if (bi >= 0) acc[bi] += acc[k]; }
    var cell = dx * dy / 1e6; for (q = 0; q < n; q++) acc[q] *= cell;            /* catchment in km² */
    var zmin = Infinity, zmax = -Infinity; for (q = 0; q < n; q++) { if (z[q] < zmin) zmin = z[q]; if (z[q] > zmax) zmax = z[q]; }
    var mk = function () { var cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; }, hs = mk(), hz = mk(), ch = mk();
    var g1 = hs.getContext('2d'), g2 = hz.getContext('2d'), g3 = ch.getContext('2d'), I1 = g1.createImageData(W, H), I2 = g2.createImageData(W, H), I3 = g3.createImageData(W, H);
    var RAMP = [[0, [176, 205, 150]], [0.25, [214, 222, 160]], [0.5, [222, 200, 150]], [0.75, [190, 160, 130]], [1, [245, 242, 236]]];
    for (q = 0; q < n; q++) { var u = (z[q] - zmin) / Math.max(1, zmax - zmin), lo = RAMP[0], hi = RAMP[RAMP.length - 1]; for (var s2 = 0; s2 < RAMP.length - 1; s2++) if (u >= RAMP[s2][0] && u <= RAMP[s2 + 1][0]) { lo = RAMP[s2]; hi = RAMP[s2 + 1]; break; }
      var f = (u - lo[0]) / Math.max(1e-6, hi[0] - lo[0]), sh = 0.45 + 0.75 * shade[q], o = 4 * q;
      for (var b = 0; b < 3; b++) I1.data[o + b] = Math.min(255, (lo[1][b] + (hi[1][b] - lo[1][b]) * f) * sh); I1.data[o + 3] = 255;
      if (slope[q] >= 35) { I2.data[o] = 200; I2.data[o + 1] = 30; I2.data[o + 2] = 30; I2.data[o + 3] = 120; } else if (slope[q] >= 25) { I2.data[o] = 240; I2.data[o + 1] = 140; I2.data[o + 2] = 0; I2.data[o + 3] = 95; }
      if (acc[q] >= 0.5) { var big = acc[q] >= 10; I3.data[o] = big ? 10 : 40; I3.data[o + 1] = big ? 70 : 120; I3.data[o + 2] = big ? 190 : 220; I3.data[o + 3] = big ? 235 : 190; } }
    g1.putImageData(I1, 0, 0); g2.putImageData(I2, 0, 0); g3.putImageData(I3, 0, 0);
    var zi = new Int16Array(n); for (q = 0; q < n; q++) zi[q] = Math.round(z[q]);
    return Promise.all([hs, hz, ch].map(function (cv) { return new Promise(function (res) { cv.toBlob(res, 'image/png'); }); })).then(function (bl) {
      return { W: W, H: H, z: zi, slope: slope, acc: acc, zmin: Math.round(zmin), zmax: Math.round(zmax), img: { hs: bl[0], hz: bl[1], ch: bl[2] } };
    });
  }

  /* ---------------------------------------------------------------- download: rain, temperature and soil wetness */
  function weather(c) {
    return fetch(WX + '?latitude=' + c[0].toFixed(4) + '&longitude=' + c[1].toFixed(4) + '&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&hourly=soil_moisture_3_to_9cm&past_days=7&forecast_days=7&timezone=auto')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
        var D = j.daily || {}, today = new Date().toISOString().slice(0, 10), days = (D.time || []).map(function (d, i) { return { d: d, p: D.precipitation_sum[i], tx: D.temperature_2m_max[i], tn: D.temperature_2m_min[i] }; });
        var past = days.filter(function (x) { return x.d < today; }), r7 = past.reduce(function (s, x) { return s + (x.p || 0); }, 0), r3 = past.slice(-3).reduce(function (s, x) { return s + (x.p || 0); }, 0);
        var H = j.hourly || {}, sm = null, now = Date.now(); (H.time || []).forEach(function (tm, i) { if (Date.parse(tm) <= now && H.soil_moisture_3_to_9cm[i] != null) sm = H.soil_moisture_3_to_9cm[i]; });
        return { at: new Date().toISOString(), days: days, r7: r7, r3: r3, sm: sm };
      });
  }

  /* ---------------------------------------------------------------- the download itself */
  function msg(p, s) { $('#smBarI').style.width = Math.round(p * 100) + '%'; $('#smMsg').textContent = s; }
  $('#smGet').addEventListener('click', function () {
    if (busy) return; if (!CTR) return SH.toast(t('Choose a ready area, use your location or tap the map first.', 'اختر منطقة جاهزة أو استخدم موقعك أو انقر على الخريطة أولاً.'), 'warn');
    if (navigator.onLine === false) return SH.toast(t('Saving an area needs the internet. Do it before the trip.', 'حفظ المنطقة يحتاج إلى الإنترنت. افعله قبل الرحلة.'), 'warn');
    persist.save(); busy = true; $('#smGet').disabled = true;
    var sz = +$('#smSize').value, a = boxOf(CTR, sz), name = $('#smName').value.trim() || (F(CTR[0], 3) + '°, ' + F(CTR[1], 3) + '°'), pk = { id: 'p' + Date.now(), name: name, en: (NAME_EN && name === $('#smName').value.trim() ? NAME_EN : /[\u0600-\u06FF]/.test(name) ? 'Area at ' + CTR[0].toFixed(3) + '°N, ' + CTR[1].toFixed(3) + '°E' : name), size: sz, a: a, c: CTR.slice(), at: new Date().toISOString(), lang: SH.lang }, warn = [];
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    msg(0.04, t('1/4 · Reading water, villages, roads and services…', '1/4 · قراءة المياه والقرى والطرق والخدمات…'));
    ovFetch(ovQuery(a)).then(function (j) { pk.f = parseOv(j); msg(0.35, t('2/4 · Reading the elevation model…', '2/4 · قراءة نموذج الارتفاع…')); })
      .then(function () { return terrain(a, function (p) { msg(0.35 + 0.35 * p, t('2/4 · Reading the elevation model…', '2/4 · قراءة نموذج الارتفاع…')); }).catch(function (e) { warn.push(t('No elevation model: ', 'لا يوجد نموذج ارتفاع: ') + e.message); return null; }); })
      .then(function (tr) { pk.t = tr; msg(0.8, t('3/4 · Rain and temperature…', '3/4 · المطر والحرارة…')); return weather(CTR).catch(function () { warn.push(t('Rain and temperature could not be read.', 'تعذرت قراءة المطر والحرارة.')); return null; }); })
      .then(function (wx) { pk.wx = wx; msg(0.92, t('4/4 · Saving on this device…', '4/4 · الحفظ على هذا الجهاز…')); return outline().then(function (o) { pk.border = o; return dbPut('packs', pk); }); })
      .then(function () { msg(1, t('Saved. This area now works without internet.', 'تم الحفظ. هذه المنطقة تعمل الآن من دون إنترنت.') + (warn.length ? ' ' + warn.join(' ') : '')); SH.toast(t('Area saved for offline use.', 'حُفظت المنطقة للعمل دون إنترنت.'), 'ok'); warm(); return listPacks().then(function () { openPack(pk.id); }); })
      .catch(function (e) { msg(0, ''); SH.toast(e.message || String(e), 'bad'); })
      .then(function () { busy = false; $('#smGet').disabled = false; });
  });
  function outline() { if (OUTLINE) return Promise.resolve(OUTLINE); return fetch(SH.base + 'assets/data/iraq-outline.json').then(function (r) { return r.json(); }).then(function (o) { OUTLINE = o.map(function (q) { return [q[1], q[0]]; }); return OUTLINE; }).catch(function () { return null; }); }

  /* ---------------------------------------------------------------- saved areas */
  function sizeOf(pk) { var b = JSON.stringify(pk.f || []).length; if (pk.t) b += pk.t.z.byteLength + pk.t.slope.byteLength + pk.t.acc.byteLength + pk.t.img.hs.size + pk.t.img.hz.size + pk.t.img.ch.size; return b / 1048576; }
  function listPacks() {
    return dbAll('packs').then(function (all) {
      PACKS = (all || []).sort(function (x, y) { return x.at < y.at ? 1 : -1; });
      $('#smPacks').innerHTML = PACKS.length ? PACKS.map(function (p) {
        return '<div class="sm-pk" data-cur="' + (PK && PK.id === p.id) + '"><b>' + E(p.name) + '</b><small>' + p.size + ' × ' + p.size + t(' km · saved ', ' كم · حُفظت ') + new Date(p.at).toLocaleDateString(AR ? 'ar-IQ' : 'en-GB') + ' · ' + F(sizeOf(p), 1) + ' MB · ' + (p.f || []).length + t(' features', ' معلماً') + '</small><div class="r"><button class="btn btn-ink btn-xs" type="button" data-open="' + p.id + '">' + t('Open', 'افتح') + '</button><button class="btn btn-line btn-xs" type="button" data-del="' + p.id + '">' + t('Delete', 'احذف') + '</button></div></div>';
      }).join('') : '<p class="xsmall muted" style="margin:0">' + t('No area saved yet.', 'لم تُحفظ أي منطقة بعد.') + '</p>';
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { $('#smStore').textContent = t('Used on this device: ', 'المستخدم على هذا الجهاز: ') + F((e.usage || 0) / 1048576, 0) + ' MB' + (e.quota ? t(' of about ', ' من نحو ') + F(e.quota / 1073741824, 1) + ' GB' : ''); });
    }).catch(function () { $('#smPacks').innerHTML = '<p class="xsmall muted">' + t('This browser does not allow saving data (private window?).', 'هذا المتصفح لا يسمح بحفظ البيانات (نافذة خاصة؟).') + '</p>'; });
  }
  $('#smPacks').addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
    if (o) openPack(o.getAttribute('data-open'));
    if (d) Promise.resolve(SH.confirm(t('Delete this saved area from the device? It will not work offline any more.', 'حذف هذه المنطقة المحفوظة من الجهاز؟ لن تعمل بعدها من دون إنترنت.'))).then(function (ok) { if (!ok) return; var id = d.getAttribute('data-del'); if (PK && PK.id === id) closePack(); return Promise.all([dbDel('packs', id), dbDel('tracks', id)]).then(listPacks); });
  });

  /* ---------------------------------------------------------------- opening an area */
  function nmOf(f) { return (AR ? f.na || f.n || f.ne : f.ne || f.n || f.na) || ''; }
  function closePack() {
    PK = null; TRK = []; SEL = null; ['hs', 'hz', 'ch'].forEach(function (k) { if (G[k]) { map.removeLayer(G[k]); URL.revokeObjectURL(G[k]._url); G[k] = null; } });
    G.vec.clearLayers(); G.lbl.clearLayers(); G.trk.setLatLngs([]); G.sel.setLatLngs([]); $('#smOut').hidden = true; $('#smEmpty').hidden = false; drawBox(); status(); listPacks();
  }
  function openPack(id) {
    return dbGet('packs', id).then(function (pk) {
      if (!pk) return; closePack(); PK = pk; lsSet('shandal_sm_last', id); $$('#smPre button').forEach(function (x) { x.setAttribute('aria-pressed', false); });
      var bb = [[pk.a.s, pk.a.w], [pk.a.n, pk.a.e]];
      if (pk.t) [['hs', 0], ['hz', 0], ['ch', 0]].forEach(function (q) { var u = URL.createObjectURL(pk.t.img[q[0]]), ly = L.imageOverlay(u, bb, { opacity: q[0] === 'hs' ? (navigator.onLine === false ? 1 : 0.6) : 1, interactive: false, className: 'sm-img' }); ly._url = u; G[q[0]] = ly; });
      layers(); drawVec(); drawBox(); map.fitBounds(bb, { padding: [10, 10] });
      return dbGet('tracks', id).then(function (tr) { TRK = (tr && tr.p) || []; G.trk.setLatLngs(TRK.map(function (q) { return [q[0], q[1]]; })); });
    }).then(function () { if (!PK) return; $('#smOut').hidden = false; $('#smEmpty').hidden = true; status(); weatherCard(); season(); if (!POS) setPos({ lat: PK.c[0], lon: PK.c[1], acc: 0, plan: true, centre: true }); else update(true); listPacks(); });
  }
  function layers() {
    $('#smLay').innerHTML = Object.keys(LAY).map(function (k) { return '<button type="button" data-l="' + k + '" aria-pressed="' + !!LAY[k][1] + '">' + LAY[k][0] + '</button>'; }).join('');
    ['hs', 'hz', 'ch'].forEach(function (k) { if (!G[k]) return; if (LAY[k][1]) G[k].addTo(map); else map.removeLayer(G[k]); });
    if (G.hs && G.hs._map) G.hs.bringToBack();
    if (LAY.lbl[1]) G.lbl.addTo(map); else map.removeLayer(G.lbl);
  }
  $('#smLay').addEventListener('click', function (e) { var b = e.target.closest('[data-l]'); if (!b) return; var k = b.getAttribute('data-l'); LAY[k][1] = !LAY[k][1]; layers(); });
  function drawVec() {
    G.vec.clearLayers(); G.lbl.clearLayers(); var F0 = PK.f || [];
    var ln = { riv: [3, null], str: [1.4, null], lak: [1.6, null], rdM: [3.4, null], rdm: [2.4, null], trk: [1.8, '6 4'], pth: [1.3, '2 4'] };
    ['lak', 'str', 'riv', 'pth', 'trk', 'rdm', 'rdM'].forEach(function (k) { F0.forEach(function (f) { if (f.k !== k || !f.g) return;
      var o = { renderer: CANV, color: K[k][2], weight: ln[k][0], opacity: .95, dashArray: k === 'str' && f.x ? '4 4' : ln[k][1], interactive: false };
      if (k === 'lak') L.polygon(f.g, Object.assign(o, { fillColor: '#9CD2F2', fillOpacity: .75 })).addTo(G.vec); else L.polyline(f.g, o).addTo(G.vec); }); });
    F0.forEach(function (f) { if (!f.p) return; var k = f.k, nm = nmOf(f), c = K[k][2];
      if (/^(twn|vil|ham)$/.test(k)) { L.circleMarker(f.p, { renderer: CANV, radius: k === 'twn' ? 6 : k === 'vil' ? 4.5 : 3, color: '#fff', weight: 1.5, fillColor: c, fillOpacity: 1 }).bindTooltip(E(nm || K[k][AR ? 1 : 0])).addTo(G.vec);
        if (nm && k !== 'ham') L.tooltip({ permanent: true, direction: 'right', offset: [5, 0], className: 'sm-lbl' + (k === 'vil' ? ' v' : '') }).setLatLng(f.p).setContent(E(nm)).addTo(G.lbl); return; }
      var letter = { spr: '~', wel: 'W', med: '+', pol: 'P', fue: 'F', shl: 'S', htl: 'H', pk: '▲', cav: 'C' }[k] || '•';
      L.marker(f.p, { icon: L.divIcon({ className: '', html: '<div class="sm-pk-ic" style="background:' + c + '">' + letter + '</div>', iconSize: [16, 16], iconAnchor: [8, 8] }), keyboard: false })
        .bindTooltip(E((nm ? nm + ' · ' : '') + K[k][AR ? 1 : 0] + (f.h ? ' · ' + f.h + t(' m', ' م') : ''))).addTo(G.vec); });
  }

  /* ---------------------------------------------------------------- position, compass, track */
  function setPos(p, soft) { POS = p; update(!soft); }
  function meIcon() { return L.divIcon({ className: '', html: '<div class="sm-me">' + (HEAD != null ? '<svg viewBox="0 0 50 50" style="transform:rotate(' + HEAD + 'deg)"><path d="M25 3 L33 22 L17 22 Z" fill="#1A73E8" fill-opacity=".55"/></svg>' : '') + '<i></i></div>', iconSize: [22, 22], iconAnchor: [11, 11] }); }
  $('#smGps').addEventListener('click', function () {
    if (WATCH != null) { navigator.geolocation.clearWatch(WATCH); WATCH = null; $('#smGps span').textContent = t('Start GPS', 'شغّل تحديد الموقع'); $('#smGps').setAttribute('aria-pressed', false); status(); return; }
    if (!navigator.geolocation) return SH.toast(t('This browser does not support location.', 'هذا المتصفح لا يدعم تحديد الموقع.'), 'bad');
    PLAN = false; $('#smPlan').setAttribute('aria-pressed', false);
    WATCH = navigator.geolocation.watchPosition(function (g) { var c = g.coords; if (c.accuracy > 3000) return; setPos({ lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, t: g.timestamp }, true); if (REC) addTrk(); },
      function (e) { SH.toast(e.code === 1 ? t('Location permission was refused. Allow it in the browser settings.', 'رُفض إذن الموقع. اسمح به من إعدادات المتصفح.') : t('Waiting for satellites… go into the open, away from walls and cliffs.', 'بانتظار الأقمار… اخرج إلى مكان مكشوف بعيداً عن الجدران والجروف.'), 'warn'); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 60000 });
    $('#smGps span').textContent = t('Stop GPS', 'أوقف تحديد الموقع'); $('#smGps').setAttribute('aria-pressed', true); status();
  });
  $('#smPlan').addEventListener('click', function () { PLAN = !PLAN; $('#smPlan').setAttribute('aria-pressed', PLAN); if (PLAN) SH.toast(t('Tap the map to see what is nearest from that point.', 'انقر على الخريطة لترى الأقرب من تلك النقطة.'), 'ok'); });
  function onOri(e) {
    var h = null; if (e.webkitCompassHeading != null) h = e.webkitCompassHeading; else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null) h = (360 - e.alpha) % 360; if (h == null) return;
    if (screen.orientation && screen.orientation.angle) h = (h + screen.orientation.angle) % 360;
    HEAD = HEAD == null ? h : (HEAD + ((((h - HEAD) % 360) + 540) % 360 - 180) * 0.25 + 360) % 360;
    if (Date.now() - LAST > 250) { LAST = Date.now(); arrows(); if (G.me) G.me.setIcon(meIcon()); }
  }
  $('#smCmp').addEventListener('click', function () {
    if (CMP) { window.removeEventListener('deviceorientationabsolute', onOri); window.removeEventListener('deviceorientation', onOri); CMP = false; HEAD = null; $('#smCmp').setAttribute('aria-pressed', false); arrows(); if (G.me) G.me.setIcon(meIcon()); return; }
    var ask = window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission().catch(function () { return 'denied'; }) : Promise.resolve('granted');
    ask.then(function (r) { if (r !== 'granted') return SH.toast(t('Compass access was refused.', 'رُفض الوصول إلى البوصلة.'), 'bad');
      window.addEventListener('deviceorientationabsolute', onOri); window.addEventListener('deviceorientation', onOri); CMP = true; $('#smCmp').setAttribute('aria-pressed', true);
      SH.toast(t('Hold the phone flat; the arrows now point where to walk. Move it in a figure of eight to calibrate.', 'أمسك الهاتف أفقياً؛ تشير الأسهم الآن إلى حيث تمشي. حرّكه على شكل رقم 8 للمعايرة.'), 'ok');
      setTimeout(function () { if (HEAD == null) SH.toast(t('No compass found on this device; arrows stay with north up.', 'لا توجد بوصلة في هذا الجهاز؛ تبقى الأسهم والشمال إلى الأعلى.'), 'warn'); }, 2500); });
  });
  function addTrk() { if (!POS || POS.plan || !PK) return; var l = TRK[TRK.length - 1]; if (POS.acc > 60) return; if (l && dist(l, [POS.lat, POS.lon]) < 15) return; TRK.push([r5(POS.lat), r5(POS.lon), Date.now(), POS.alt != null ? Math.round(POS.alt) : null]); G.trk.setLatLngs(TRK.map(function (q) { return [q[0], q[1]]; })); if (TRK.length % 5 === 1) dbPut('tracks', { id: PK.id, p: TRK }).catch(function () {}); }
  $('#smTrk').addEventListener('click', function () {
    if (!PK) return SH.toast(t('Open a saved area first.', 'افتح منطقة محفوظة أولاً.'), 'warn');
    REC = !REC; $('#smTrk').setAttribute('aria-pressed', REC); $('#smTrk span').textContent = REC ? t('Stop recording', 'أوقف التسجيل') : t('Record my path', 'سجّل مساري');
    if (REC) { if (WATCH == null) $('#smGps').click(); addTrk(); SH.toast(t('Recording. The start of your path is added to the list as the way back.', 'جارٍ التسجيل. تُضاف بداية مسارك إلى القائمة كطريق للعودة.'), 'ok'); } else if (PK) dbPut('tracks', { id: PK.id, p: TRK }).catch(function () {});
    update(true);
  });

  /* ---------------------------------------------------------------- reading the ground */
  function cellOf(lat, lon) { if (!PK || !PK.t) return -1; var a = PK.a, T = PK.t, c = Math.floor((lon - a.w) / (a.e - a.w) * T.W), r = Math.floor((a.n - lat) / (a.n - a.s) * T.H); return r < 0 || r >= T.H || c < 0 || c >= T.W ? -1 : r * T.W + c; }
  function elev(lat, lon) { var i = cellOf(lat, lon); return i < 0 ? null : PK.t.z[i]; }
  /* walking time with Tobler's hiking function along the straight line, ×1.25 for a real path */
  function walk(a, b) {
    var d = dist(a, b), n = Math.max(2, Math.min(300, Math.ceil(d / 50))), tm = 0, up = 0, prev = elev(a[0], a[1]);
    for (var i = 1; i <= n; i++) { var la = a[0] + (b[0] - a[0]) * i / n, lo = a[1] + (b[1] - a[1]) * i / n, z = elev(la, lo), seg = d / n, sl = prev != null && z != null ? (z - prev) / seg : 0; if (prev != null && z != null && z > prev) up += z - prev; tm += seg / 1000 / (6 * Math.exp(-3.5 * Math.abs(sl + 0.05))) * 60; prev = z; }
    return { min: tm * 1.25, up: up };
  }
  function nearest(kinds) {
    var p = [POS.lat, POS.lon], best = null;
    (PK.f || []).forEach(function (f) { if (kinds.indexOf(f.k) < 0) return; var d, q;
      if (f.p) { d = dist(p, f.p); q = f.p; } else { var r = nearLine(p, f.g); d = r.d; q = r.p; }
      if (!best || d < best.d) best = { d: d, q: q, f: f }; });
    return best;
  }
  function arrowSvg(rot) { return '<svg viewBox="0 0 40 40" style="transform:rotate(' + rot + 'deg)"><path d="M20 3 L30 30 L20 24 L10 30 Z" fill="#B08A3E" stroke="#5C4415" stroke-width="1.2" stroke-linejoin="round"/></svg>'; }
  var NR = [];
  function update(force) {
    if (!POS) return; var now = Date.now(); if (!force && now - LASTU < 1500) { if (!update._t) update._t = setTimeout(function () { update._t = null; update(true); }, 1600 - (now - LASTU)); return; } LASTU = now;
    var ll = [POS.lat, POS.lon];
    if (!G.me) G.me = L.marker(ll, { icon: meIcon(), interactive: false, zIndexOffset: 1000 }).addTo(map); else G.me.setLatLng(ll);
    if (G.acc) map.removeLayer(G.acc); G.acc = POS.acc ? L.circle(ll, { radius: POS.acc, color: '#1A73E8', weight: 1, fillOpacity: .08, interactive: false }).addTo(map) : null;
    if (!PK) return;
    var u = SH.toUTM(POS.lat, POS.lon), z = elev(POS.lat, POS.lon), inside = POS.lat >= PK.a.s && POS.lat <= PK.a.n && POS.lon >= PK.a.w && POS.lon <= PK.a.e;
    $('#smPos').innerHTML = '<small>' + (POS.plan ? (POS.centre ? t('Centre of the saved area (start the GPS to see your real position)', 'مركز المنطقة المحفوظة (شغّل تحديد الموقع لترى موقعك الحقيقي)') : t('Point chosen on the map', 'نقطة مختارة على الخريطة')) : t('Your position', 'موقعك')) + '</small>' +
      '<b class="big">' + POS.lat.toFixed(5) + '°N  ' + POS.lon.toFixed(5) + '°E</b><small style="direction:ltr;unicode-bidi:isolate">UTM ' + u.zone + u.band + '  ' + Math.round(u.E) + ' E  ' + Math.round(u.N) + ' N</small>' +
      '<small>' + (POS.acc ? t('Accuracy ± ', 'الدقة ± ') + Math.round(POS.acc) + t(' m', ' م') + ' · ' : '') + (z != null ? t('Height ', 'الارتفاع ') + z + t(' m above sea level', ' م فوق سطح البحر') : '') + (inside ? '' : ' · <b style="color:#C0392B">' + t('Outside the saved area — the map and the distances may miss nearer places.', 'خارج المنطقة المحفوظة — قد تفوت الخريطة والمسافات أماكن أقرب.') + '</b>') + '</small>';
    NR = NEED.map(function (nd) { var b = nearest(nd[3]); return b ? { id: nd[0], h: AR ? nd[2] : nd[1], b: b } : null; }).filter(Boolean);
    if (TRK.length) NR.push({ id: 'start', h: t('Back to where you started', 'العودة إلى نقطة البداية'), b: { d: dist(ll, TRK[0]), q: [TRK[0][0], TRK[0][1]], f: { k: 'start' } } });
    NR.forEach(function (x) { x.br = brg(ll, x.b.q); x.w = walk(ll, x.b.q); });
    $('#smNear').innerHTML = NR.map(function (x, i) { var f = x.b.f, nm = f.k === 'start' ? '' : nmOf(f), sub = f.k === 'start' ? '' : K[f.k][AR ? 1 : 0] + (f.x ? t(' · seasonal, may be dry', ' · موسمي وقد يكون جافاً') : '');
      return '<button type="button" class="sm-nc" data-i="' + i + '" aria-pressed="' + (SEL === x.id) + '"><span class="ar" data-ar="' + i + '">' + arrowSvg(0) + '</span><span><h4>' + E(x.h) + '</h4><b>' + km(x.b.d) + ' · ' + compass8(x.br) + ' <bdi dir="ltr">' + Math.round(x.br) + '°</bdi></b><small>' + E(nm ? nm + ' · ' : '') + E(sub) + (sub ? '<br>' : '') + t('Walk about ', 'مشياً نحو ') + hm(x.w.min) + (x.w.up > 20 ? t(' · climb ', ' · صعود ') + Math.round(x.w.up) + t(' m', ' م') : '') + '</small></span></button>'; }).join('') ||
      '<p class="xsmall muted">' + t('No mapped water, villages or roads in this saved area.', 'لا توجد مياه أو قرى أو طرق مرسومة في هذه المنطقة المحفوظة.') + '</p>';
    $('#smNearN').textContent = t('Distances are in a straight line; the walking time follows the slope and adds a quarter for the winding of real paths. The arrow points to the place; with the compass on, hold the phone flat and walk where it points.', 'المسافات بخط مستقيم؛ ويتبع زمن المشي الانحدار ويضيف الربع لتعرج المسارات الحقيقية. يشير السهم إلى المكان؛ ومع تشغيل البوصلة أمسك الهاتف أفقياً وامشِ حيث يشير.');
    arrows(); here(); selLine();
  }
  function arrows() { NR.forEach(function (x, i) { var el = document.querySelector('[data-ar="' + i + '"] svg'); if (el) el.style.transform = 'rotate(' + Math.round(x.br - (HEAD || 0)) + 'deg)'; }); }
  function selLine() { var x = NR.filter(function (q) { return q.id === SEL; })[0]; G.sel.setLatLngs(x && POS ? [[POS.lat, POS.lon], x.b.q] : []); }
  $('#smNear').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; var x = NR[+b.getAttribute('data-i')]; SEL = SEL === x.id ? null : x.id; $$('#smNear .sm-nc').forEach(function (n) { n.setAttribute('aria-pressed', n === b && SEL != null); }); selLine(); if (SEL) map.fitBounds(L.latLngBounds([[POS.lat, POS.lon], x.b.q]).pad(0.3), { maxZoom: 16 }); });

  function borderKm(p) { var o = PK.border; if (!o) return null; var r = nearLine(p, o); return r.d / 1000; }
  function here() {
    var p = [POS.lat, POS.lon], C = [], add = function (lv, h, s) { C.push('<div class="sm-hz ' + lv + '"><h4>' + h + '</h4><p>' + s + '</p></div>'); }, wx = PK.wx, i = cellOf(p[0], p[1]);
    if (PK.t && i >= 0) {
      var T = PK.t, W = T.W, r0 = (i / W) | 0, c0 = i - r0 * W, z0 = T.z[i], sMax = 0, cat = 0, cx = 111320 * (PK.a.e - PK.a.w) / W * Math.cos(SH.rad(p[0])), rad = Math.max(1, Math.round(200 / cx)), rch = Math.max(1, Math.round(70 / cx));
      for (var dr = -rad; dr <= rad; dr++) for (var dc = -rad; dc <= rad; dc++) { var r = r0 + dr, c = c0 + dc; if (r < 0 || c < 0 || r >= T.H || c >= W) continue; var j = r * W + c;
        if (T.z[j] > z0 + 5 && T.slope[j] > sMax) sMax = T.slope[j]; if (Math.abs(dr) <= rch && Math.abs(dc) <= rch && T.z[j] <= z0 + 3 && T.acc[j] > cat) cat = T.acc[j]; }
      var s0 = T.slope[i], wet = wx && (wx.r7 >= 20 || (wx.sm != null && wx.sm >= 0.3));
      add(s0 >= 35 ? 'hi' : s0 >= 25 ? 'mid' : 'ok', t('Slope here ', 'الانحدار هنا ') + s0 + '°', s0 >= 35 ? t('Very steep ground: risk of falling and of loose rock. Move to gentler ground before resting.', 'أرض شديدة الانحدار جداً: خطر سقوط وصخور مفككة. انتقل إلى أرض ألطف قبل الاستراحة.') : s0 >= 25 ? t('Steep ground: keep three points of contact and avoid loose scree.', 'أرض منحدرة: حافظ على ثلاث نقاط تماس وتجنب الحطام المفكك.') : t('Gentle ground.', 'أرض لطيفة الانحدار.'));
      add(sMax >= 35 ? (wet ? 'hi' : 'mid') : 'ok', t('Slopes above you', 'المنحدرات فوقك'), sMax >= 35 ? t('Slopes of ', 'منحدرات بزاوية ') + sMax + t('° rise within 200 m above you: rockfall and small slides are possible', '° ترتفع ضمن 200 م فوقك: سقوط صخور وانزلاقات صغيرة محتملة') + (wet ? t(', more so after the recent rain.', '، وأكثر بعد الأمطار الأخيرة.') : '.') + t(' Do not camp or rest at the foot of cliffs.', ' لا تخيّم ولا تسترح عند أقدام الجروف.') : t('No very steep slope directly above you.', 'لا يوجد منحدر شديد جداً فوقك مباشرة.'));
      add(cat >= 10 ? 'hi' : cat >= 0.5 ? 'mid' : 'ok', t('Stream beds', 'بطون الوديان'), cat >= 0.5 ? t('You are in or beside a stream bed that drains ', 'أنت في بطن وادٍ أو بجانبه يصرّف ') + F(cat, cat < 10 ? 1 : 0) + t(' km². Rain upstream can bring a flash flood within minutes, even under a clear sky. Never camp in it; climb to the bank if the water rises or turns muddy.', ' كم². المطر في أعلى الوادي قد يجلب سيلاً خلال دقائق حتى مع سماء صافية. لا تخيّم فيه أبداً، واصعد إلى الضفة إن ارتفع الماء أو تعكّر.') : t('Not in a mapped stream bed.', 'لستَ في بطن وادٍ مرسوم.'));
    } else add('mid', t('Ground', 'الأرض'), t('No elevation model in this saved area, so slopes and stream beds cannot be read.', 'لا يوجد نموذج ارتفاع في هذه المنطقة المحفوظة، فلا يمكن قراءة المنحدرات وبطون الوديان.'));
    if (wx) { var lv = wx.r7 >= 40 || (wx.sm != null && wx.sm >= 0.35) ? 'hi' : wx.r7 >= 10 || (wx.sm != null && wx.sm >= 0.25) ? 'mid' : 'ok';
      add(lv, t('Recent rain and wet soil', 'الأمطار الأخيرة ورطوبة التربة'), t('Rain in the 7 days before saving: ', 'المطر في الأيام السبعة قبل الحفظ: ') + F(wx.r7, 0) + t(' mm (', ' ملم (') + F(wx.r3, 0) + t(' mm in the last 3 days)', ' ملم في آخر 3 أيام)') + (wx.sm != null ? t('; topsoil water ', '؛ ماء التربة السطحية ') + F(wx.sm * 100, 0) + '% ' + (wx.sm >= 0.3 ? t('(wet: mud, slippery clay slopes, slides more likely)', '(رطبة: طين ومنحدرات طينية زلقة واحتمال أكبر للانزلاق)') : wx.sm >= 0.2 ? t('(moist)', '(رطبة قليلاً)') : t('(dry)', '(جافة)')) : '') + t('. Read on ', '. قُرئت في ') + new Date(wx.at).toLocaleDateString(AR ? 'ar-IQ' : 'en-GB') + t('; it does not update without internet.', '؛ ولا تتحدث من دون إنترنت.')); }
    var bk = borderKm(p); if (bk != null && bk <= 15) add('hi', t('Border strip: mines', 'الشريط الحدودي: الألغام'), t('You are ', 'أنت على بعد ') + F(bk, 1) + t(' km from an international border. Mines and unexploded ordnance remain in parts of these areas. Keep to used roads and paths, never pick up metal objects, and ask local people before leaving the track.', ' كم من حدود دولية. ما زالت الألغام والمقذوفات غير المنفجرة في أجزاء من هذه المناطق. التزم بالطرق والمسارات المطروقة، ولا تلتقط أي جسم معدني، واسأل السكان المحليين قبل ترك الطريق.'));
    var s = sun(p[0], p[1], new Date()); if (s) { var left = (s.set - Date.now()) / 60000; add(left < 60 && left > 0 ? 'mid' : left <= 0 ? 'hi' : 'ok', t('Daylight', 'ضوء النهار'), t('Sunrise ', 'الشروق ') + hhmm(s.rise) + t(' · sunset ', ' · الغروب ') + hhmm(s.set) + (left > 0 ? t(' · daylight left ', ' · الضوء المتبقي ') + hm(left) + (left < 90 ? t('. Start back now: it is dark about 30 minutes after sunset.', '. ابدأ العودة الآن: يحلّ الظلام بعد الغروب بنحو 30 دقيقة.') : '') : t(' · the sun has set.', ' · غربت الشمس.'))); }
    $('#smHere').innerHTML = C.join('');
  }
  function weatherCard() {
    var wx = PK.wx; if (!wx) { $('#smWx').innerHTML = '<p class="xsmall muted">' + t('Not saved with this area.', 'لم تُحفظ مع هذه المنطقة.') + '</p>'; return; }
    var today = new Date().toISOString().slice(0, 10);
    $('#smWx').innerHTML = '<p class="xsmall muted" style="margin:0 0 6px">' + t('Saved on ', 'حُفظت في ') + new Date(wx.at).toLocaleString(AR ? 'ar-IQ' : 'en-GB') + t('. The forecast days are a forecast made then.', '. أيام التوقع هي توقع صدر وقتها.') + '</p><table class="sm-tbl"><tr><th>' + t('Day', 'اليوم') + '</th><th>' + t('Rain (mm)', 'المطر (ملم)') + '</th><th>' + t('Max / min (°C)', 'العظمى / الصغرى (°م)') + '</th></tr>' +
      wx.days.map(function (d) { var fut = d.d >= today; return '<tr' + (d.d === today ? ' style="font-weight:700"' : '') + '><td>' + new Date(d.d + 'T12:00').toLocaleDateString(AR ? 'ar-IQ' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + (fut ? ' <small class="muted">' + t('forecast', 'توقع') + '</small>' : '') + '</td><td>' + (d.p == null ? '—' : F(d.p, 1)) + '</td><td>' + (d.tx == null ? '—' : F(d.tx, 0) + ' / ' + F(d.tn, 0)) + '</td></tr>'; }).join('') + '</table>';
  }
  function season() {
    var m = new Date().getMonth() + 1, z = PK.t ? PK.t.zmax : 0, L0 = [];
    L0.push(t('Water: carry at least 3 litres a person; treat spring and stream water (boil, filter or tablets) — villages and herds are often upstream.', 'الماء: احمل 3 لترات للشخص على الأقل، وعالج ماء العيون والجداول (غلي أو فلتر أو أقراص) — فكثيراً ما تكون القرى والقطعان في أعلى المجرى.'));
    if (m >= 4 && m <= 10) L0.push(t('Snakes and scorpions are active: watch where you put hands and feet, shake out boots, do not lift stones with bare hands.', 'الأفاعي والعقارب نشطة: انتبه أين تضع يديك وقدميك، وانفض الحذاء، ولا ترفع الحجارة بيد عارية.'));
    if (m >= 6 && m <= 9) L0.push(t('Heat: work early and late, rest in shade at midday, and watch for heat exhaustion (headache, nausea, no sweating).', 'الحر: اعمل مبكراً ومتأخراً، واسترح في الظل وقت الظهيرة، وانتبه للإنهاك الحراري (صداع وغثيان وتوقف التعرق).'));
    if (m >= 11 || m <= 4) L0.push(t('Rain season: flash floods in valleys and slides on wet clay and marl slopes; days are short.', 'موسم الأمطار: سيول في الوديان وانزلاقات على المنحدرات الطينية والمارلية الرطبة، والنهار قصير.'));
    if ((m >= 12 || m <= 3) && z > 1400) L0.push(t('Snow and ice above about 1,500 m; tracks may be closed and nights below freezing.', 'ثلج وجليد فوق نحو 1500 م؛ قد تُغلق الطرق الترابية وتنزل الحرارة ليلاً تحت الصفر.'));
    L0.push(t('Dogs guard herds and villages: do not run; stop, stand still and call for the shepherd.', 'الكلاب تحرس القطعان والقرى: لا تركض، توقف وقف ثابتاً ونادِ على الراعي.'));
    L0.push(t('Wild boar live in the oak forests of the mountains; give them room, especially females with young.', 'تعيش الخنازير البرية في غابات البلوط الجبلية؛ أفسح لها الطريق، خاصة الإناث مع صغارها.'));
    L0.push(t('Caves: bats can carry rabies; do not touch them, and do not enter caves without a light, a partner and a time to come out.', 'الكهوف: قد تحمل الخفافيش داء الكلب، فلا تلمسها، ولا تدخل الكهوف من دون ضوء ورفيق ووقت محدد للخروج.'));
    L0.push(t('Mapped animal danger does not exist: these are general cautions for the season, not places on the map.', 'لا توجد خرائط لخطر الحيوانات: هذه تحذيرات عامة للموسم وليست أماكن على الخريطة.'));
    $('#smSeason').innerHTML = '<ul class="sm-season">' + L0.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  }

  /* ---------------------------------------------------------------- sharing the position (SMS works on the phone network, no internet) */
  function posText() {
    if (!POS) return ''; var n = NR.filter(function (x) { return x.id === 'settle'; })[0], u = SH.toUTM(POS.lat, POS.lon);
    return t('My location', 'موقعي') + ': ' + POS.lat.toFixed(5) + ', ' + POS.lon.toFixed(5) + (POS.acc ? ' (±' + Math.round(POS.acc) + 'm)' : '') + ' | UTM ' + u.zone + u.band + ' ' + Math.round(u.E) + 'E ' + Math.round(u.N) + 'N' +
      (n ? ' | ' + t('nearest village', 'أقرب قرية') + ': ' + (nmOf(n.b.f) || '?') + ' ' + km(n.b.d) + ' ' + compass8(brg(n.b.q, [POS.lat, POS.lon])) + t(' of it', ' منها') : '') + ' | ' + new Date().toLocaleTimeString(AR ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) +
      ' | https://maps.google.com/?q=' + POS.lat.toFixed(5) + ',' + POS.lon.toFixed(5);
  }
  $('#smSms').addEventListener('click', function () { if (!POS) return SH.toast(t('Start the GPS first.', 'شغّل تحديد الموقع أولاً.'), 'warn'); location.href = 'sms:?&body=' + encodeURIComponent(posText()); });
  $('#smCopy').addEventListener('click', function () { if (!POS) return SH.toast(t('Start the GPS first.', 'شغّل تحديد الموقع أولاً.'), 'warn'); var s = posText(); (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { SH.toast(t('Copied.', 'نُسخ.'), 'ok'); }).catch(function () { window.prompt('', s); }); });

  /* ---------------------------------------------------------------- status line */
  function status() {
    var on = navigator.onLine !== false;
    $('#smStat').innerHTML = '<span class="' + (on ? 'on' : 'off') + '">' + (on ? t('Online', 'متصل بالإنترنت') : t('Offline — using the saved area', 'دون إنترنت — تُستخدم المنطقة المحفوظة')) + '</span>' +
      (PK ? '<span>' + E(PK.name) + ' · ' + t('saved ', 'حُفظت ') + new Date(PK.at).toLocaleDateString(AR ? 'ar-IQ' : 'en-GB') + '</span>' : '<span>' + t('No area open', 'لا توجد منطقة مفتوحة') + '</span>') +
      '<span>' + (WATCH != null ? t('GPS on', 'تحديد الموقع يعمل') : t('GPS off', 'تحديد الموقع متوقف')) + '</span>' + (REC ? '<span class="off">' + t('Recording path · ', 'تسجيل المسار · ') + TRK.length + '</span>' : '');
    if (G.hs) G.hs.setOpacity(on ? 0.6 : 1);
  }
  window.addEventListener('online', status); window.addEventListener('offline', status);

  /* ---------------------------------------------------------------- map sheet and exports */
  function sheet() {
    if (!PK || !P) return; var a = PK.a, W = PK.t ? PK.t.W : 900, H = PK.t ? PK.t.H : 900, k = Math.min(2, 1400 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
    var mk = function () { var c = document.createElement('canvas'); c.width = W; c.height = H; return c; }, vec = mk(), g = vec.getContext('2d'), X = function (lo) { return (lo - a.w) / (a.e - a.w) * W; }, Y = function (la) { return (a.n - la) / (a.n - a.s) * H; };
    var lw = Math.max(1, W / 900);
    var line = function (pts, col, w, dash) { g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(X(q[1]), Y(q[0])); else g.moveTo(X(q[1]), Y(q[0])); }); g.strokeStyle = col; g.lineWidth = w * lw; g.setLineDash(dash ? dash.map(function (v) { return v * lw; }) : []); g.stroke(); };
    ['lak', 'str', 'riv', 'pth', 'trk', 'rdm', 'rdM'].forEach(function (kk) { (PK.f || []).forEach(function (f) { if (f.k !== kk || !f.g) return; if (kk === 'lak') { g.beginPath(); f.g.forEach(function (q, i) { if (i) g.lineTo(X(q[1]), Y(q[0])); else g.moveTo(X(q[1]), Y(q[0])); }); g.fillStyle = '#9CD2F2'; g.fill(); }
      line(f.g, K[kk][2], { riv: 2.4, str: 1.1, lak: 1.2, rdM: 2.8, rdm: 2, trk: 1.4, pth: 1 }[kk], kk === 'trk' ? [5, 3] : kk === 'pth' ? [2, 3] : kk === 'str' && f.x ? [3, 3] : null); }); });
    g.setLineDash([]); if (TRK.length > 1) line(TRK, '#E4007C', 2.6);
    var lbl = [];
    (PK.f || []).forEach(function (f) { if (!f.p) return; var x = X(f.p[1]), y = Y(f.p[0]), r = (f.k === 'twn' ? 5 : f.k === 'vil' ? 3.6 : 2.8) * lw; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = K[f.k][2]; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = lw; g.stroke();
      var nm = f.k === 'twn' || f.k === 'vil' ? (f.ne || f.n || '') : ''; if (nm && /[A-Za-z]/.test(nm)) lbl.push([nm, x + r + 3 * lw, y + 4 * lw, f.k === 'twn' ? 15 : 11]); });
    /* names in English on the sheet; skip any that would overlap a name already placed */
    var boxes = []; lbl.sort(function (p1, p2) { return p2[3] - p1[3]; }).forEach(function (q) { var w2 = P.tw(g, q[0], q[3] * lw, 700), b = [q[1], q[2] - q[3] * lw, q[1] + w2, q[2] + 3 * lw]; if (b[2] > W || boxes.some(function (o) { return !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]); })) return; boxes.push(b); P.txt(g, q[0], q[1], q[2], q[3] * lw, 700, '#1D2731', 'left', true); });
    if (POS) { var px = X(POS.lon), py = Y(POS.lat); g.beginPath(); g.arc(px, py, 7 * lw, 0, 7); g.fillStyle = '#1A73E8'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5 * lw; g.stroke(); }
    var hsI = null, hzI = null, chI = null, ld = function (b) { return b ? createImageBitmap(b).catch(function () { return null; }) : Promise.resolve(null); };
    Promise.all([ld(PK.t && PK.t.img.hs), ld(PK.t && PK.t.img.hz), ld(PK.t && PK.t.img.ch)]).then(function (I) { hsI = I[0]; hzI = I[1]; chI = I[2];
      var cnt = {}; (PK.f || []).forEach(function (f) { cnt[f.k] = (cnt[f.k] || 0) + 1; });
      P.sheet($('#smCv'), { a: a, title: PK.en || PK.name, sub: 'Offline field map · saved ' + PK.at.slice(0, 10) + ' · ' + PK.size + ' × ' + PK.size + ' km', layers: [hsI, hzI, chI, vec],
        legend: [['River / stream', '#1F6FB8'], ['Main road', '#D9622B'], ['Dirt track', '#8C6239'], ['Village', '#3C4A57'], ['Slope 25–35°', '#F5B566'], ['Slope > 35°', '#D9706D'], ['Stream bed (flash flood)', '#2878DC'], ['Your path', '#E4007C'], ['Position', '#1A73E8']],
        stats: 'Springs and wells ' + ((cnt.spr || 0) + (cnt.wel || 0)) + ' · villages ' + ((cnt.vil || 0) + (cnt.ham || 0) + (cnt.twn || 0)) + ' · clinics ' + (cnt.med || 0) + (PK.t ? ' · elevation ' + PK.t.zmin + '–' + PK.t.zmax + ' m' : '') });
      $('#smCap').textContent = t('Relief shading and slopes from the 30 m elevation model; water, villages, roads and services from the open map database at the time of saving. Distances on the map are true to the scale bar.', 'تظليل التضاريس والمنحدرات من نموذج الارتفاع بدقة 30 م؛ والمياه والقرى والطرق والخدمات من قاعدة بيانات الخريطة المفتوحة وقت الحفظ. المسافات على الخريطة مطابقة لمقياس الرسم.');
    });
  }
  $('#fsm1') && new IntersectionObserver(function (en) { if (en[0].isIntersecting) sheet(); }).observe($('#fsm1'));
  $$('[data-cv]').forEach(function (b) { b.addEventListener('click', function () { if (!PK) return; sheet(); setTimeout(function () { SH.exportCanvas($('#smCv'), 'shandal-offline-map-' + PK.name.replace(/[^\w؀-ۿ-]+/g, '-'), b.getAttribute('data-fmt')); }, 400); }); });
  $('#smGpx').addEventListener('click', function () {
    if (!PK) return; var wp = NR.map(function (x) { return '<wpt lat="' + x.b.q[0] + '" lon="' + x.b.q[1] + '"><name>' + E(x.h + (nmOf(x.b.f) ? ': ' + nmOf(x.b.f) : '')) + '</name></wpt>'; }).join('');
    var tr = TRK.length ? '<trk><name>' + E(PK.name) + '</name><trkseg>' + TRK.map(function (q) { return '<trkpt lat="' + q[0] + '" lon="' + q[1] + '">' + (q[3] != null ? '<ele>' + q[3] + '</ele>' : '') + '<time>' + new Date(q[2]).toISOString() + '</time></trkpt>'; }).join('') + '</trkseg></trk>' : '';
    SH.download('shandal-' + PK.id + '.gpx', '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Shandal System" xmlns="http://www.topografix.com/GPX/1/1">' + wp + tr + '</gpx>', 'application/gpx+xml');
  });
  $('#smCsv').addEventListener('click', function () { if (!PK) return; SH.csv('shandal-offline-nearest.csv', [['need', 'name', 'kind', 'lat', 'lon', 'distance_m', 'bearing_deg', 'walk_min', 'climb_m']].concat(NR.map(function (x) { return [x.h, nmOf(x.b.f), x.b.f.k === 'start' ? 'start' : K[x.b.f.k][0], x.b.q[0].toFixed(5), x.b.q[1].toFixed(5), Math.round(x.b.d), Math.round(x.br), Math.round(x.w.min), Math.round(x.w.up)]; }))); });

  /* ---------------------------------------------------------------- keep this page and its files for offline use */
  function warm() {
    if (!window.caches || navigator.onLine === false) return Promise.resolve();
    var page = location.href.split('#')[0], files = performance.getEntriesByType('resource').map(function (e) { return e.name; }).filter(function (u) { return u.indexOf(location.origin + '/') === 0 && u.indexOf('/assets/') > 0 && !/\.(npy)$/.test(u); });
    return Promise.all([caches.open('shandal-v1-pages').then(function (c) { return c.add(page); }), caches.open('shandal-v1-static').then(function (c) { return Promise.all(files.map(function (u) { return c.add(u).catch(function () {}); })); })]).catch(function () {});
  }
  setTimeout(warm, 4000);

  /* ---------------------------------------------------------------- start: open the last area, even offline */
  status(); listPacks().then(function () { var last = lsGet('shandal_sm_last'); var id = last && PACKS.some(function (p) { return p.id === last; }) ? last : PACKS.length && navigator.onLine === false ? PACKS[0].id : null; if (id) openPack(id).then(function () { if (innerWidth < 900 && location.hash !== '#plan') $('#smStat').scrollIntoView({ block: 'start' }); }); });
})();
