/* Offline field survival map. Before the trip (online) areas are saved on the device — larger ones as squares of up to
   50 km — with the open-map features (water, settlements, roads and tracks, services, shelters, peaks, communication
   masts), a 1-arc-second elevation model (relief shading, slope, D8 drainage, line-of-sight from the masts), the MODIS
   8-day snow extent of the last weeks and the rain, snow and temperature of the week around the saving. In the field
   (offline) the GPS position is placed on that map, the nearest of each need is found through a spatial index, routes
   are computed on the saved road and path network (Dijkstra; car speeds by road class, walking by Tobler's function
   on the slope), and the ground where one stands is read. Everything lives in IndexedDB on the device. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, E = SH.esc, P = window.PCX, AR = SH.lang === 'ar', L = window.L;
  var OVP = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  var WX = 'https://api.open-meteo.com/v1/forecast', TILE = 50;
  var PRE = [['shaqlawa', 'Shaqlawa – Harir', 'شقلاوة – حرير', 36.43, 44.32], ['rawanduz', 'Rawanduz – Gali Ali Beg', 'راوندوز – گلي علي بيگ', 36.6, 44.5], ['dukan', 'Dukan lake', 'بحيرة دوكان', 35.98, 44.95],
    ['amedi', 'Amedi – Sulav', 'العمادية – سولاف', 37.08, 43.47], ['hawraman', 'Halabja – Hawraman', 'حلبجة – هورامان', 35.21, 46.08], ['bazian', 'Bazian – Qara Dagh', 'بازيان – قره داغ', 35.48, 45.3]];
  /* kinds: [en, ar, colour, symbol, min zoom] */
  var K = {
    riv: ['River or canal', 'نهر أو قناة', '#1F6FB8', 'line', 7], str: ['Stream', 'جدول', '#4A9BDB', 'line', 11], lak: ['Lake or reservoir', 'بحيرة أو خزان', '#1F6FB8', 'area', 8],
    spr: ['Spring', 'عين ماء', '#0B8FB0', 'drop', 11], wel: ['Well or water point', 'بئر أو نقطة ماء', '#0B8FB0', 'sq', 11],
    twn: ['Town', 'مدينة أو بلدة', '#1D2731', 'big', 7], vil: ['Village', 'قرية', '#3C4A57', 'dot', 10], ham: ['Hamlet or houses', 'تجمع بيوت', '#7A8590', 'small', 13],
    rdM: ['Main road', 'طريق رئيس', '#D9622B', 'line', 7], rdm: ['Minor road', 'طريق فرعي', '#E9A05F', 'line', 9], rdr: ['Street', 'شارع', '#B9B4AA', 'line', 13], trk: ['Dirt track', 'طريق ترابي', '#8C6239', 'line', 11], pth: ['Footpath', 'ممر مشاة', '#6B4A2B', 'line', 12],
    med: ['Clinic, hospital or pharmacy', 'مستوصف أو مستشفى أو صيدلية', '#C0392B', 'cross', 10], pol: ['Police', 'شرطة', '#1F3A93', 'sq', 10], fue: ['Fuel station', 'محطة وقود', '#7D3C98', 'dot', 12],
    shl: ['Shelter, hut or camp', 'ملجأ أو كوخ أو مخيم', '#2F7D5B', 'house', 11], htl: ['Hotel or guest house', 'فندق أو دار ضيافة', '#2F7D5B', 'sq', 11],
    pk: ['Peak', 'قمة', '#6B4A2B', 'tri', 11], cav: ['Cave entrance', 'مدخل كهف', '#55616B', 'cave', 12], tow: ['Communication mast', 'برج اتصالات', '#8E44AD', 'mast', 10]
  };
  var RAS = { hs: ['Relief shading', 'تظليل التضاريس', '#C9B48A'], hz: ['Steep slopes (25–35° / over 35°)', 'منحدرات شديدة (25–35° / أكثر من 35°)', '#E0663A'], ch: ['Stream beds (flash floods)', 'بطون الوديان (السيول)', '#2878DC'],
    cv: ['Likely phone signal (sight of a mast)', 'إشارة هاتف محتملة (رؤية برج)', '#A77BD0'], sn: ['Snow in the last weeks', 'الثلج في الأسابيع الأخيرة', '#7FD6F5'] };
  var EXTRA = { net: ['Where you had internet', 'حيث كان لديك إنترنت', '#16A34A'], mk: ['My landmarks', 'معالمي', '#D4A017'], tr: ['My path', 'مساري', '#E4007C'] };
  var LG = [['Water', 'المياه', ['riv', 'str', 'lak', 'spr', 'wel']], ['Settlements', 'التجمعات السكانية', ['twn', 'vil', 'ham']], ['Roads and paths', 'الطرق والممرات', ['rdM', 'rdm', 'rdr', 'trk', 'pth']],
    ['Help and services', 'المساعدة والخدمات', ['med', 'pol', 'fue', 'shl', 'htl']], ['Terrain and signal', 'التضاريس والإشارة', ['pk', 'cav', 'tow', 'cv', 'net']], ['Hazards', 'المخاطر', ['hz', 'ch', 'sn', 'hs']], ['Mine', 'خاصتي', ['mk', 'tr']]];
  var NEED = [['spring', 'Spring or well', 'عين أو بئر', ['spr', 'wel']], ['river', 'River or lake', 'نهر أو بحيرة', ['riv', 'lak']], ['stream', 'Stream (may be dry)', 'جدول (قد يكون جافاً)', ['str']],
    ['settle', 'Village or houses', 'قرية أو بيوت', ['twn', 'vil', 'ham']], ['town', 'Town', 'مدينة أو بلدة', ['twn']], ['road', 'Road or track for a car', 'طريق أو درب للسيارة', ['rdM', 'rdm', 'rdr', 'trk']],
    ['paved', 'Main or minor road', 'طريق رئيس أو فرعي', ['rdM', 'rdm']], ['med', 'Clinic or hospital', 'مستوصف أو مستشفى', ['med']], ['pol', 'Police', 'شرطة', ['pol']],
    ['shelter', 'Shelter or lodging', 'ملجأ أو مبيت', ['shl', 'htl']], ['peak', 'High point (view)', 'مرتفع (إطلالة)', ['pk']], ['tow', 'Communication mast', 'برج اتصالات', ['tow']]];
  var DB = null, PK = null, ACT = [], OV = {}, TERR = {}, PACKS = [], MARKS = [], NET = [], POS = null, HEAD = null, CTR = null, PLAN = false, TRK = [], REC = false, WATCH = null, SEL = null, NAME_EN = '';
  var LAST = 0, LASTU = 0, OUTLINE = null, CMP = false, busy = false, MODE = 'car', PICK = null, ROUTE = null, NR = [], IDX = {}, STAMP = 1;
  var ON = (function () { var o = {}; try { o = JSON.parse(localStorage.getItem('shandal_sm_on') || '{}'); } catch (e) {} Object.keys(K).concat(Object.keys(RAS), Object.keys(EXTRA)).forEach(function (k) { if (o[k] == null) o[k] = 1; }); return o; })();
  var persist = SH.persist('survivalmap', ['smSize', 'smName']);

  /* ---------------------------------------------------------------- storage on the device */
  function idb() {
    if (DB) return Promise.resolve(DB);
    return new Promise(function (res, rej) {
      var rq = indexedDB.open('shandal-survival', 2);
      rq.onupgradeneeded = function () { var d = rq.result; ['packs', 'tracks', 'terr', 'marks', 'net'].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); }); };
      rq.onsuccess = function () { DB = rq.result; res(DB); }; rq.onerror = function () { rej(rq.error); };
    });
  }
  function tx(store, mode, fn) { return idb().then(function (d) { return new Promise(function (res, rej) { var x = d.transaction(store, mode), s = x.objectStore(store), r = fn(s); x.oncomplete = function () { res(r && r.result); }; x.onerror = function () { rej(x.error); }; }); }); }
  var dbPut = function (st, v) { return tx(st, 'readwrite', function (s) { return s.put(v); }); };
  var dbGet = function (st, k) { return tx(st, 'readonly', function (s) { return s.get(k); }); };
  var dbDel = function (st, k) { return tx(st, 'readwrite', function (s) { return s.delete(k); }); };
  var dbAll = function (st) { return tx(st, 'readonly', function (s) { return s.getAll(); }); };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

  /* ---------------------------------------------------------------- geometry */
  var R0 = 6371008.8;
  function dist(a, b) { return SH.dist({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }); }
  function brg(a, b) { return SH.bearing({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }); }
  function nearLine(p, g) {
    var kx = Math.cos(SH.rad(p[0])) * R0 * Math.PI / 180, ky = R0 * Math.PI / 180, best = Infinity, bp = null;
    for (var i = 0; i < g.length - 1; i++) {
      var ax = (g[i][1] - p[1]) * kx, ay = (g[i][0] - p[0]) * ky, bx = (g[i + 1][1] - p[1]) * kx, by = (g[i + 1][0] - p[0]) * ky, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      var u = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0, x = ax + u * dx, y = ay + u * dy, d2 = x * x + y * y;
      if (d2 < best) { best = d2; bp = [p[0] + y / ky, p[1] + x / kx]; }
    }
    return { d: Math.sqrt(best), p: bp };
  }
  function simplify(pts, tol, keepIdx) {
    if (pts.length < 3) return pts; var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; if (keepIdx) keepIdx.forEach(function (i) { keep[i] = 1; });
    var st = [], last = 0; for (var q = 1; q < pts.length; q++) if (keep[q]) { st.push([last, q]); last = q; }
    while (st.length) { var s = st.pop(), a = pts[s[0]], b = pts[s[1]], md = 0, mi = -1;
      for (var i = s[0] + 1; i < s[1]; i++) { var dx = b[1] - a[1], dy = b[0] - a[0], l = Math.hypot(dx, dy) || 1e-12, dd = Math.abs(dy * (pts[i][1] - a[1]) - dx * (pts[i][0] - a[0])) / l; if (dd > md) { md = dd; mi = i; } }
      if (md > tol) { keep[mi] = 1; st.push([s[0], mi], [mi, s[1]]); } }
    return pts.filter(function (_, i) { return keep[i]; });
  }
  var r5 = function (v) { return Math.round(v * 1e5) / 1e5; };
  function compass8(b) { var n = AR ? ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; return n[Math.round(((b % 360) + 360) % 360 / 45) % 8]; }
  function km(m) { return m < 1000 ? F(Math.round(m / 10) * 10, 0) + t(' m', ' م') : F(m / 1000, m < 10000 ? 1 : 0) + t(' km', ' كم'); }
  function hm(min) { if (!isFinite(min)) return '—'; min = Math.max(1, Math.round(min)); var h = Math.floor(min / 60), m = min % 60; return h ? h + t(' h ', ' س ') + (m ? m + t(' min', ' د') : '') : m + t(' min', ' د'); }
  function tobler(sl) { sl = Math.max(-1, Math.min(1, sl)); return 6 * Math.exp(-3.5 * Math.abs(sl + 0.05)); }

  /* ---------------------------------------------------------------- sun times (no network) */
  function sun(lat, lon, day) {
    var y0 = Date.UTC(day.getFullYear(), 0, 1), d0 = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()), doy = (d0 - y0) / 864e5 + 1, g = 2 * Math.PI / 365 * (doy - 0.5);
    var eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var cw = (Math.sin(SH.rad(-0.833)) - Math.sin(SH.rad(lat)) * Math.sin(dec)) / (Math.cos(SH.rad(lat)) * Math.cos(dec)); if (cw < -1 || cw > 1) return null;
    var w = SH.deg(Math.acos(cw)), noon = 720 - 4 * lon - eot;
    return { rise: new Date(d0 + (noon - 4 * w) * 6e4), set: new Date(d0 + (noon + 4 * w) * 6e4) };
  }
  var hhmm = function (d) { return d ? d.toLocaleTimeString(AR ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'; };

  /* ---------------------------------------------------------------- symbols (canvas and key) */
  function glyph(g, ch, x, y, s) { g.fillStyle = '#fff'; g.font = '800 ' + Math.round(s * 0.62) + 'px Manrope, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y + 0.5); }
  function sym(g, k, x, y, s, label) {
    var c = (K[k] || EXTRA[k] || [0, 0, '#000'])[2], sh = K[k] ? K[k][3] : k === 'mk' ? 'star' : 'dot';
    g.lineWidth = Math.max(1.2, s * 0.16); g.strokeStyle = '#fff'; g.fillStyle = c; g.setLineDash([]); g.beginPath();
    if (sh === 'big') { g.arc(x, y, s * 0.62, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.22, 0, 7); g.fillStyle = '#fff'; g.fill(); return; }
    if (sh === 'dot' || sh === 'small') { g.arc(x, y, sh === 'small' ? s * 0.32 : s * 0.45, 0, 7); g.fill(); g.stroke(); return; }
    if (sh === 'sq') { g.rect(x - s * 0.45, y - s * 0.45, s * 0.9, s * 0.9); g.fill(); g.stroke(); if (label) glyph(g, k === 'pol' ? 'P' : k === 'htl' ? 'H' : 'W', x, y, s); return; }
    if (sh === 'drop') { g.moveTo(x, y - s * 0.7); g.bezierCurveTo(x + s * 0.6, y, x + s * 0.45, y + s * 0.55, x, y + s * 0.55); g.bezierCurveTo(x - s * 0.45, y + s * 0.55, x - s * 0.6, y, x, y - s * 0.7); g.fill(); g.stroke(); return; }
    if (sh === 'cross') { g.arc(x, y, s * 0.55, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(x - s * 0.1, y - s * 0.34, s * 0.2, s * 0.68); g.fillRect(x - s * 0.34, y - s * 0.1, s * 0.68, s * 0.2); return; }
    if (sh === 'house') { g.moveTo(x, y - s * 0.6); g.lineTo(x + s * 0.55, y - s * 0.05); g.lineTo(x + s * 0.4, y - s * 0.05); g.lineTo(x + s * 0.4, y + s * 0.5); g.lineTo(x - s * 0.4, y + s * 0.5); g.lineTo(x - s * 0.4, y - s * 0.05); g.lineTo(x - s * 0.55, y - s * 0.05); g.closePath(); g.fill(); g.stroke(); return; }
    if (sh === 'tri') { g.moveTo(x, y - s * 0.6); g.lineTo(x + s * 0.55, y + s * 0.42); g.lineTo(x - s * 0.55, y + s * 0.42); g.closePath(); g.fill(); g.stroke(); return; }
    if (sh === 'cave') { g.arc(x, y + s * 0.3, s * 0.55, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); return; }
    if (sh === 'mast') { g.moveTo(x, y - s * 0.7); g.lineTo(x + s * 0.4, y + s * 0.55); g.lineTo(x - s * 0.4, y + s * 0.55); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.strokeStyle = c; g.lineWidth = Math.max(1, s * 0.12); g.arc(x, y - s * 0.55, s * 0.5, -2.4, -0.74); g.stroke(); return; }
    if (sh === 'star') { for (var i = 0; i < 10; i++) { var r = i % 2 ? s * 0.3 : s * 0.7, a = -Math.PI / 2 + i * Math.PI / 5; if (i) g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); else g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); g.fill(); g.stroke(); return; }
    g.arc(x, y, s * 0.45, 0, 7); g.fill(); g.stroke();
  }
  var LST = { riv: [3.2], str: [1.4, [4, 3]], lak: [1.6], rdM: [3.6], rdm: [2.6], rdr: [1.6], trk: [1.9, [6, 4]], pth: [1.4, [2, 4]] };
  function keySvg(k) {
    if (RAS[k]) return '<svg viewBox="0 0 22 16"><rect x="1" y="2" width="20" height="12" rx="3" fill="' + RAS[k][2] + '" fill-opacity=".75"/></svg>';
    if (k === 'tr') return '<svg viewBox="0 0 22 16"><path d="M2 12 C8 2 14 14 20 4" fill="none" stroke="#E4007C" stroke-width="3"/></svg>';
    if (K[k] && (K[k][3] === 'line' || K[k][3] === 'area')) { var l = LST[k] || [2]; return '<svg viewBox="0 0 22 16">' + (k === 'lak' ? '<rect x="1" y="3" width="20" height="10" rx="3" fill="#9CD2F2" stroke="#1F6FB8"/>' : '<path d="M1 8 H21" stroke="' + K[k][2] + '" stroke-width="' + l[0] + '"' + (l[1] ? ' stroke-dasharray="' + l[1].join(' ') + '"' : '') + '/>') + '</svg>'; }
    var c = document.createElement('canvas'); c.width = 44; c.height = 32; sym(c.getContext('2d'), k, 22, 16, 22, true); return '<img src="' + c.toDataURL() + '" width="22" height="16" alt="">';
  }

  /* ---------------------------------------------------------------- map and the vector layer drawn on canvas tiles */
  var map = SH.map('smMap', { zoom: 7, center: [36.0, 44.4], base: 'topo' });
  var G = { vec: null, trk: L.polyline([], { color: '#E4007C', weight: 3.5, opacity: .9 }), sel: L.polyline([], { color: '#B08A3E', weight: 3, dashArray: '8 6' }), rt: L.layerGroup(), box: null, prev: null, me: null, acc: null, mk: L.layerGroup(), net: L.layerGroup() };
  G.rt.addTo(map); G.sel.addTo(map);
  var CS = 0.05;
  function ckey(i, j) { return i + ':' + j; }
  function buildIndex() {
    IDX = {};
    ACT.forEach(function (p) { (p.f || []).forEach(function (f) {
      var b = f.bb; if (!b) { if (f.p) b = [f.p[0], f.p[1], f.p[0], f.p[1]]; else { var s = 90, w = 180, n = -90, e = -180; f.g.forEach(function (q) { if (q[0] < s) s = q[0]; if (q[0] > n) n = q[0]; if (q[1] < w) w = q[1]; if (q[1] > e) e = q[1]; }); b = [s, w, n, e]; } f.bb = b; }
      for (var i = Math.floor(b[0] / CS); i <= Math.floor(b[2] / CS); i++) for (var j = Math.floor(b[1] / CS); j <= Math.floor(b[3] / CS); j++) { var k = ckey(i, j); (IDX[k] || (IDX[k] = [])).push(f); }
    }); });
  }
  function query(s, w, n, e, test) {
    var out = [], st = ++STAMP;
    for (var i = Math.floor(s / CS); i <= Math.floor(n / CS); i++) for (var j = Math.floor(w / CS); j <= Math.floor(e / CS); j++) { var a = IDX[ckey(i, j)]; if (!a) continue; for (var q = 0; q < a.length; q++) { var f = a[q]; if (f._s === st) continue; f._s = st; if (!test || test(f)) out.push(f); } }
    return out;
  }
  var LORD = ['lak', 'str', 'riv', 'pth', 'trk', 'rdr', 'rdm', 'rdM'], PORD = ['ham', 'vil', 'twn', 'cav', 'pk', 'tow', 'wel', 'spr', 'fue', 'htl', 'shl', 'pol', 'med'];
  function nmOf(f) { return (AR ? f.na || f.n || f.ne : f.ne || f.n || f.na) || ''; }
  var VecLayer = L.GridLayer.extend({
    createTile: function (co) {
      var c = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1), sz = this.getTileSize(); c.width = sz.x * dpr; c.height = sz.y * dpr; c.style.width = sz.x + 'px'; c.style.height = sz.y + 'px';
      var g = c.getContext('2d'); g.scale(dpr, dpr); var z = co.z, nw = co.scaleBy(sz), m = this._map;
      var b0 = m.unproject(nw, z), b1 = m.unproject(nw.add(sz), z), pad = 0.01 * Math.pow(2, 12 - Math.min(z, 12));
      var fs = query(b1.lat - pad, b0.lng - pad, b0.lat + pad, b1.lng + pad, function (f) { return ON[f.k] && K[f.k] && z >= K[f.k][4]; });
      var X = function (q) { var p = m.project([q[0], q[1]], z); return [p.x - nw.x, p.y - nw.y]; };
      var wz = z >= 14 ? 1.4 : z >= 12 ? 1.15 : z >= 10 ? 1 : 0.8;
      LORD.forEach(function (k) { fs.forEach(function (f) { if (f.k !== k || !f.g) return; g.beginPath(); f.g.forEach(function (q, i) { var p = X(q); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
        g.setLineDash([]);
        if (k === 'lak') { g.fillStyle = 'rgba(156,210,242,.85)'; g.fill(); g.strokeStyle = '#1F6FB8'; g.lineWidth = 1.2; g.stroke(); return; }
        var st = LST[k]; if (k === 'rdr') { g.strokeStyle = '#8C877C'; g.lineWidth = (st[0] + 1.4) * wz; g.stroke(); g.strokeStyle = '#FFFFFF'; g.lineWidth = st[0] * wz; g.stroke(); return; }
        if (k === 'rdM' || k === 'rdm') { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = (st[0] + 1.6) * wz; g.stroke(); }
        g.strokeStyle = K[k][2]; g.lineWidth = st[0] * wz; g.setLineDash(k === 'str' && !f.x ? [] : (st[1] || []).map(function (v) { return v * wz; })); g.stroke(); }); });
      g.setLineDash([]);
      var s = z >= 14 ? 15 : z >= 12 ? 12 : z >= 10 ? 10 : 8, lbl = [];
      PORD.forEach(function (k) { fs.forEach(function (f) { if (f.k !== k || !f.p) return; var p = X(f.p); if (p[0] < -20 || p[1] < -20 || p[0] > sz.x + 20 || p[1] > sz.y + 20) return; sym(g, k, p[0], p[1], s, z >= 12);
        var nm = nmOf(f); if (nm && ((k === 'twn' && z >= 8) || (k === 'vil' && z >= 11) || (k === 'ham' && z >= 14) || (/^(spr|pk|med|shl|htl|cav|tow)$/.test(k) && z >= 14))) lbl.push([nm, p[0] + s * 0.75, p[1], k === 'twn' ? 13 : 11, k === 'twn' ? 800 : 700]); }); });
      var boxes = []; lbl.forEach(function (q) { g.font = q[4] + ' ' + q[3] + 'px "Plex Arabic", Manrope, Arial'; var w = g.measureText(q[0]).width, b = [q[1], q[2] - q[3] * 0.7, q[1] + w, q[2] + q[3] * 0.5];
        if (boxes.some(function (o) { return !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]); })) return; boxes.push(b); g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 3.2; g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineJoin = 'round'; g.strokeText(q[0], q[1], q[2]); g.fillStyle = '#1D2731'; g.fillText(q[0], q[1], q[2]); });
      return c;
    }
  });
  map.createPane('smVec'); map.getPane('smVec').style.zIndex = 420; map.getPane('smVec').style.pointerEvents = 'none';
  G.vec = new VecLayer({ tileSize: 256, updateWhenZooming: false, keepBuffer: 2, pane: 'smVec' }); G.vec.addTo(map);
  G.trk.addTo(map); G.mk.addTo(map); G.net.addTo(map);

  /* raster overlays only for areas in view, so that a 500 km set does not fill the memory */
  function addOv(pk) { if (OV[pk.id]) return; var im = pk.img || (pk.t && pk.t.img) || {}, o = { L: {} }; ['hs', 'hz', 'ch', 'cv', 'sn'].forEach(function (k) { if (im[k]) o[k] = im[k]; }); OV[pk.id] = o; }
  function dropOv(id) { var o = OV[id]; if (!o) return; Object.keys(o.L).forEach(function (k) { map.removeLayer(o.L[k]); URL.revokeObjectURL(o.L[k]._url); }); delete OV[id]; }
  function overlays() {
    var vb = map.getBounds().pad(0.3), z = map.getZoom(), many = ACT.length > 4, on = navigator.onLine !== false;
    ACT.forEach(function (pk) {
      var o = OV[pk.id]; if (!o) return; var inView = vb.intersects([[pk.a.s, pk.a.w], [pk.a.n, pk.a.e]]) && (!many || z >= 9);
      ['hs', 'hz', 'ch', 'cv', 'sn'].forEach(function (k) {
        var want = inView && ON[k] && o[k], ly = o.L[k];
        if (want && !ly) { var u = URL.createObjectURL(o[k]); ly = L.imageOverlay(u, [[pk.a.s, pk.a.w], [pk.a.n, pk.a.e]], { opacity: k === 'hs' ? (on ? 0.6 : 1) : k === 'sn' ? 0.8 : 1, interactive: false }); ly._url = u; o.L[k] = ly; ly.addTo(map); if (k === 'hs') ly.bringToBack(); }
        else if (!want && ly) { map.removeLayer(ly); URL.revokeObjectURL(ly._url); delete o.L[k]; }
        else if (ly && k === 'hs') ly.setOpacity(on ? 0.6 : 1);
      });
    });
  }
  map.on('moveend', overlays);

  /* ---------------------------------------------------------------- the map key */
  function legend() {
    $('#smLeg').innerHTML = LG.map(function (gr) { return '<div><h5>' + (AR ? gr[1] : gr[0]) + '</h5><div class="g">' + gr[2].map(function (k) { var d = K[k] || RAS[k] || EXTRA[k]; return '<button type="button" data-k="' + k + '" aria-pressed="' + !!ON[k] + '">' + keySvg(k) + '<span>' + (AR ? d[1] : d[0]) + '</span></button>'; }).join('') + '</div></div>'; }).join('') +
      '<p class="xsmall muted" style="margin:0">' + t('Small places appear as you zoom in: towns from far away, villages, clinics and police closer, springs, wells, tracks and footpaths when close. Tap any symbol on the map for its name and a route.', 'تظهر الأماكن الصغيرة كلما قرّبت: المدن من بعيد، ثم القرى والمستوصفات والشرطة، ثم العيون والآبار والدروب وممرات المشاة عن قرب. انقر أي رمز على الخريطة لاسمه ولمسار إليه.') + '</p>';
  }
  $('#smLeg').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var k = b.getAttribute('data-k'); ON[k] = ON[k] ? 0 : 1; b.setAttribute('aria-pressed', !!ON[k]); lsSet('shandal_sm_on', JSON.stringify(ON)); redraw(); });
  function redraw() {
    G.vec.redraw(); overlays();
    if (ON.tr) G.trk.addTo(map); else map.removeLayer(G.trk);
    if (ON.mk) G.mk.addTo(map); else map.removeLayer(G.mk);
    if (ON.net) G.net.addTo(map); else map.removeLayer(G.net);
  }
  legend();

  /* ---------------------------------------------------------------- choosing the area */
  function boxOf(c, sz) { var dLa = sz / 2 / 111.32, dLo = dLa / Math.cos(SH.rad(c[0])); return { s: c[0] - dLa, n: c[0] + dLa, w: c[1] - dLo, e: c[1] + dLo }; }
  function estimate() { var sz = +$('#smSize').value, n = Math.ceil(sz / TILE), sub = sz / n, mb = n * n * Math.max(1.5, 8 * Math.pow(sub / 50, 2)); $('#smEst').textContent = (n > 1 ? n * n + t(' squares of ', ' مربعاً بضلع ') + F(sub, 0) + t(' km · ', ' كم · ') : '') + t('about ', 'نحو ') + F(mb, 0) + t(' MB and ', ' ميغابايت و') + hm(n * n * Math.max(0.5, sub / 50 * 1.5)) + t(' to save on a good connection.', ' للحفظ باتصال جيد.'); }
  function drawBox() {
    if (G.box) map.removeLayer(G.box); G.box = L.featureGroup().addTo(map); G.prev = null;
    var gids = {}; ACT.forEach(function (p) { if (p.gid) { var g = gids[p.gid] || (gids[p.gid] = { s: 90, w: 180, n: -90, e: -180 }); g.s = Math.min(g.s, p.a.s); g.w = Math.min(g.w, p.a.w); g.n = Math.max(g.n, p.a.n); g.e = Math.max(g.e, p.a.e); } else L.rectangle([[p.a.s, p.a.w], [p.a.n, p.a.e]], { color: '#B08A3E', weight: 2, fill: false, dashArray: '6 5', interactive: false }).addTo(G.box); });
    Object.keys(gids).forEach(function (k) { var a = gids[k]; L.rectangle([[a.s, a.w], [a.n, a.e]], { color: '#B08A3E', weight: 2, fill: false, dashArray: '6 5', interactive: false }).addTo(G.box); });
    estimate(); if (!CTR) return; var a = boxOf(CTR, +$('#smSize').value); G.prev = L.rectangle([[a.s, a.w], [a.n, a.e]], { color: '#E4007C', weight: 2, fillOpacity: .05, dashArray: '6 5', interactive: false }).addTo(G.box);
    var n = Math.ceil(+$('#smSize').value / TILE); for (var i = 1; i < n; i++) { var la = a.s + (a.n - a.s) * i / n, lo = a.w + (a.e - a.w) * i / n; L.polyline([[la, a.w], [la, a.e]], { color: '#E4007C', weight: 1, opacity: .5, interactive: false }).addTo(G.box); L.polyline([[a.s, lo], [a.n, lo]], { color: '#E4007C', weight: 1, opacity: .5, interactive: false }).addTo(G.box); }
    $('#smCtr').textContent = F(CTR[0], 4) + '°, ' + F(CTR[1], 4) + '°';
  }
  function setCtr(c, name, fit) { CTR = c; if (name === '') NAME_EN = ''; if (name) $('#smName').value = name; drawBox(); if (fit && G.prev) map.fitBounds(G.prev.getBounds(), { padding: [20, 20] }); }
  $('#smPre').innerHTML = PRE.map(function (p) { return '<button type="button" data-k="' + p[0] + '">' + E(AR ? p[2] : p[1]) + '</button>'; }).join('');
  $('#smPre').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var p = PRE.filter(function (q) { return q[0] === b.getAttribute('data-k'); })[0]; NAME_EN = p[1]; $$('#smPre button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); setCtr([p[3], p[4]], AR ? p[2] : p[1], true); });
  $('#smSize').addEventListener('change', function () { persist.save(); drawBox(); if (G.prev) map.fitBounds(G.prev.getBounds(), { padding: [20, 20] }); });
  $('#smMe').addEventListener('click', function () { SH.locate().then(function (p) { setCtr([p.lat, p.lon], '', true); }).catch(function (e) { SH.toast(e.message, 'bad'); }); });

  /* ---------------------------------------------------------------- download: features */
  function ovQuery(a) {
    var bb = [a.s, a.w, a.n, a.e].map(function (v) { return v.toFixed(5); }).join(',');
    return '[out:json][timeout:180][bbox:' + bb + '];(' +
      'way[waterway~"^(river|stream|canal|ditch|drain)$"];way[natural=water];rel[natural=water];way[landuse=reservoir];' +
      'node[natural=spring];node[man_made~"^(water_well|water_tap|water_tower)$"];node[amenity~"^(drinking_water|water_point)$"];' +
      'node[place~"^(city|town|village|hamlet|isolated_dwelling|suburb)$"];' +
      'way[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|track|path|footway|bridleway|motorway_link|trunk_link|primary_link|secondary_link)$"];' +
      'nwr[amenity~"^(hospital|clinic|doctors|pharmacy|police|fuel)$"];nwr[healthcare~"^(hospital|clinic|centre)$"];' +
      'node[natural~"^(peak|cave_entrance)$"];nwr[tourism~"^(alpine_hut|wilderness_hut|camp_site|hotel|guest_house|motel|hostel)$"];nwr[amenity=shelter];' +
      'nwr[man_made~"^(mast|communications_tower)$"];nwr[man_made=tower]["tower:type"="communication"];' +
      ');out geom qt;';
  }
  function ovFetch(q, i, n) {
    i = i || 0; n = n || 0; if (i >= OVP.length) { if (n < 2) return new Promise(function (r) { setTimeout(r, 15000); }).then(function () { return ovFetch(q, 0, n + 1); }); return Promise.reject(new Error(t('The map database is busy. Try again in a few minutes.', 'قاعدة بيانات الخريطة مشغولة. أعد المحاولة بعد دقائق.'))); }
    return fetch(OVP[i], { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(function () { return ovFetch(q, i + 1, n); });
  }
  function kindOf(tg) {
    var w = tg.waterway, h = tg.highway, am = tg.amenity, pl = tg.place, mm = tg.man_made || '';
    if (mm === 'mast' || mm === 'communications_tower' || (mm === 'tower' && tg['tower:type'] === 'communication')) return 'tow';
    if (w === 'river' || w === 'canal') return 'riv'; if (w) return 'str';
    if (tg.natural === 'water' || tg.landuse === 'reservoir') return 'lak'; if (tg.natural === 'spring') return 'spr';
    if (/^(water_well|water_tap|water_tower)$/.test(mm) || /^(drinking_water|water_point)$/.test(am || '')) return 'wel';
    if (pl === 'city' || pl === 'town') return 'twn'; if (pl === 'village' || pl === 'suburb') return 'vil'; if (pl) return 'ham';
    if (/^(motorway|trunk|primary|secondary)(_link)?$/.test(h || '')) return 'rdM'; if (h === 'tertiary' || h === 'unclassified') return 'rdm'; if (h === 'residential' || h === 'living_street') return 'rdr'; if (h === 'track') return 'trk'; if (h) return 'pth';
    if (/^(hospital|clinic|doctors|pharmacy)$/.test(am || '') || tg.healthcare) return 'med'; if (am === 'police') return 'pol'; if (am === 'fuel') return 'fue';
    if (am === 'shelter' || /hut|camp_site/.test(tg.tourism || '')) return 'shl'; if (tg.tourism) return 'htl';
    if (tg.natural === 'peak') return 'pk'; if (tg.natural === 'cave_entrance') return 'cav'; return null;
  }
  function parseOv(j) {
    var out = [], seen = {}, cnt = {};
    /* nodes shared by two or more roads or paths are kept as junctions, so that routes can turn there */
    (j.elements || []).forEach(function (el) { if (el.type === 'way' && el.tags && el.tags.highway && el.nodes) el.nodes.forEach(function (n) { cnt[n] = (cnt[n] || 0) + 1; }); });
    (j.elements || []).forEach(function (el) {
      var tg = el.tags || {}, k = kindOf(tg); if (!k) return; var key = el.type + el.id; if (seen[key]) return; seen[key] = 1;
      var f = { k: k }; if (tg.name) f.n = tg.name; if (tg['name:ar']) f.na = tg['name:ar']; if (tg['name:en']) f.ne = tg['name:en'];
      if (tg.intermittent === 'yes' || tg.seasonal === 'yes') f.x = 1; if (tg.ele && k === 'pk') f.h = Math.round(parseFloat(tg.ele)) || undefined;
      var lines = [];
      if (el.type === 'node') f.p = [r5(el.lat), r5(el.lon)];
      else if (el.type === 'way' && el.geometry) { var kp = el.nodes && tg.highway ? el.nodes.map(function (nd, i) { return cnt[nd] > 1 ? i : -1; }).filter(function (i) { return i >= 0; }) : null; lines.push([el.geometry, kp]); }
      else if (el.type === 'relation' && el.members) el.members.forEach(function (m) { if (m.geometry && m.role !== 'inner') lines.push([m.geometry, null]); });
      if (!f.p) {
        lines = lines.map(function (gk) { var g = gk[0]; if (g.some(function (q) { return !q; })) return g.filter(Boolean).map(function (q) { return [r5(q.lat), r5(q.lon)]; }); return simplify(g.map(function (q) { return [q.lat, q.lon]; }), 0.00005, gk[1]).map(function (q) { return [r5(q[0]), r5(q[1])]; }); }).filter(function (g) { return g.length > 1; });
        if (!lines.length) return;
        if (/^(med|pol|fue|shl|htl|spr|wel|cav|pk|tow)$/.test(k)) { var g0 = lines[0], la = 0, lo = 0; g0.forEach(function (q) { la += q[0]; lo += q[1]; }); f.p = [r5(la / g0.length), r5(lo / g0.length)]; }
        else if (lines.length === 1) f.g = lines[0]; else { lines.forEach(function (g) { var c = Object.assign({}, f); c.g = g; out.push(c); }); return; }
      }
      out.push(f);
    });
    return out;
  }

  /* ---------------------------------------------------------------- download: elevation, terrain, signal */
  function terrain(a, towers, onP) {
    var size = (a.n - a.s) * 111.32, N = Math.max(200, Math.min(900, Math.round(size * 1000 / 45))), W = Math.round(N * (a.e - a.w) * Math.cos(SH.rad((a.s + a.n) / 2)) / (a.n - a.s)), H = N;
    return SH.pc.dem(a, 'cop-dem-glo-30', function (d, n) { onP(d / n); }, 1400).then(function (f) {
      var z = new Float32Array(W * H), bad = 0;
      for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) { var v = f(a.n - (r + 0.5) / H * (a.n - a.s), a.w + (c + 0.5) / W * (a.e - a.w)); z[r * W + c] = isFinite(v) ? v : NaN; if (!isFinite(v)) bad++; }
      if (bad) { var mn = Infinity; for (var i = 0; i < z.length; i++) if (z[i] < mn) mn = z[i]; for (i = 0; i < z.length; i++) if (!isFinite(z[i])) z[i] = isFinite(mn) ? mn : 0; }
      return analyse(a, W, H, z, towers);
    });
  }
  function analyse(a, W, H, z, towers) {
    var dx = (a.e - a.w) / W * 111320 * Math.cos(SH.rad((a.s + a.n) / 2)), dy = (a.n - a.s) / H * 111320, n = W * H, slope = new Uint8Array(n), shade = new Float32Array(n);
    var at = function (r, c) { r = r < 0 ? 0 : r >= H ? H - 1 : r; c = c < 0 ? 0 : c >= W ? W - 1 : c; return z[r * W + c]; }, az = SH.rad(315), alt = SH.rad(45), r, c, q;
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      var gx = ((at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1)) - (at(r - 1, c - 1) + 2 * at(r, c - 1) + at(r + 1, c - 1))) / (8 * dx);
      var gy = ((at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1)) - (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1))) / (8 * dy);
      var s = Math.atan(Math.hypot(gx, gy)), asp = Math.atan2(gy, -gx), i = r * W + c; slope[i] = Math.min(90, Math.round(SH.deg(s)));
      shade[i] = Math.max(0, Math.sin(alt) * Math.cos(s) + Math.cos(alt) * Math.sin(s) * Math.cos(az - Math.PI / 2 + asp));
    }
    var ord = new Uint32Array(n); for (q = 0; q < n; q++) ord[q] = q; ord.sort(function (p1, p2) { return z[p2] - z[p1]; });
    var acc = new Float32Array(n).fill(1), DR = [-1, -1, -1, 0, 0, 1, 1, 1], DC = [-1, 0, 1, -1, 1, -1, 0, 1];
    for (q = 0; q < n; q++) { var k = ord[q], rr = (k / W) | 0, cc = k - rr * W, best = 0, bi = -1;
      for (var m = 0; m < 8; m++) { var r2 = rr + DR[m], c2 = cc + DC[m]; if (r2 < 0 || r2 >= H || c2 < 0 || c2 >= W) continue; var j = r2 * W + c2, dd = (z[k] - z[j]) / Math.hypot(DR[m] * dy, DC[m] * dx); if (dd > best) { best = dd; bi = j; } }
      if (bi >= 0) acc[bi] += acc[k]; }
    var cell = dx * dy / 1e6; for (q = 0; q < n; q++) acc[q] *= cell;
    /* line of sight from each mast (30 m above ground) to a phone 1.7 m above ground, up to 15 km, with earth curvature */
    var cov = new Uint8Array(n), cm = (dx + dy) / 2, Rc = Math.min(Math.round(15000 / cm), Math.max(W, H));
    (towers || []).forEach(function (tw) {
      var c0 = (tw[1] - a.w) / (a.e - a.w) * W, r0 = (a.n - tw[0]) / (a.n - a.s) * H; if (c0 < 0 || r0 < 0 || c0 >= W || r0 >= H) return;
      var h0 = z[(r0 | 0) * W + (c0 | 0)] + 30, rays = Math.ceil(2 * Math.PI * Rc);
      for (var ry = 0; ry < rays; ry++) { var th = ry / rays * 2 * Math.PI, cx = Math.cos(th), cy = Math.sin(th), mx = -Infinity;
        for (var st = 1; st <= Rc; st++) { var cc2 = (c0 + cx * st) | 0, rr2 = (r0 + cy * st) | 0; if (cc2 < 0 || rr2 < 0 || cc2 >= W || rr2 >= H) break; var d = st * cm, i2 = rr2 * W + cc2, zc = z[i2] - d * d / (2 * R0) * 0.87, tg = (zc + 1.7 - h0) / d;
          if (tg >= mx) cov[i2] = 1; var tg2 = (zc - h0) / d; if (tg2 > mx) mx = tg2; } }
    });
    var zmin = Infinity, zmax = -Infinity; for (q = 0; q < n; q++) { if (z[q] < zmin) zmin = z[q]; if (z[q] > zmax) zmax = z[q]; }
    var mk = function () { var cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; }, C = { hs: mk(), hz: mk(), ch: mk(), cv: mk() }, I = {};
    Object.keys(C).forEach(function (k2) { I[k2] = C[k2].getContext('2d').createImageData(W, H); });
    var RAMP = [[0, [176, 205, 150]], [0.25, [214, 222, 160]], [0.5, [222, 200, 150]], [0.75, [190, 160, 130]], [1, [245, 242, 236]]];
    for (q = 0; q < n; q++) { var u = (z[q] - zmin) / Math.max(1, zmax - zmin), lo = RAMP[0], hi = RAMP[RAMP.length - 1]; for (var s2 = 0; s2 < RAMP.length - 1; s2++) if (u >= RAMP[s2][0] && u <= RAMP[s2 + 1][0]) { lo = RAMP[s2]; hi = RAMP[s2 + 1]; break; }
      var f = (u - lo[0]) / Math.max(1e-6, hi[0] - lo[0]), sh = 0.45 + 0.75 * shade[q], o = 4 * q;
      for (var b = 0; b < 3; b++) I.hs.data[o + b] = Math.min(255, (lo[1][b] + (hi[1][b] - lo[1][b]) * f) * sh); I.hs.data[o + 3] = 255;
      if (slope[q] >= 35) { I.hz.data[o] = 200; I.hz.data[o + 1] = 30; I.hz.data[o + 2] = 30; I.hz.data[o + 3] = 120; } else if (slope[q] >= 25) { I.hz.data[o] = 240; I.hz.data[o + 1] = 140; I.hz.data[o + 2] = 0; I.hz.data[o + 3] = 95; }
      if (acc[q] >= 0.5) { var big = acc[q] >= 10; I.ch.data[o] = big ? 10 : 40; I.ch.data[o + 1] = big ? 70 : 120; I.ch.data[o + 2] = big ? 190 : 220; I.ch.data[o + 3] = big ? 235 : 190; }
      if (cov[q]) { I.cv.data[o] = 150; I.cv.data[o + 1] = 90; I.cv.data[o + 2] = 210; I.cv.data[o + 3] = 70; } }
    Object.keys(C).forEach(function (k2) { C[k2].getContext('2d').putImageData(I[k2], 0, 0); });
    var zi = new Int16Array(n); for (q = 0; q < n; q++) zi[q] = Math.round(z[q]);
    var keys = Object.keys(C), hasT = !!(towers || []).length;
    return Promise.all(keys.map(function (k2) { return new Promise(function (res) { C[k2].toBlob(res, 'image/png'); }); })).then(function (bl) {
      var img = {}; keys.forEach(function (k2, i) { img[k2] = bl[i]; }); if (!hasT) delete img.cv;
      return { W: W, H: H, z: zi, slope: slope, acc: acc, cov: hasT ? cov : null, zmin: Math.round(zmin), zmax: Math.round(zmax), img: img };
    });
  }

  /* ---------------------------------------------------------------- download: snow (MODIS 8-day maximum extent) and weather */
  function snow(a) {
    var to = new Date(), fr = new Date(Date.now() - 60 * 864e5), COL = 'modis-10A2-061';
    return P.search(COL, a, [fr.toISOString(), to.toISOString()], null, 60).then(function (its) {
      var by = {}; its.forEach(function (f) { var d = (f.properties.start_datetime || f.properties.datetime || '').slice(0, 10); (by[d] || (by[d] = [])).push(f); });
      var ds = Object.keys(by).sort().reverse().slice(0, 6); if (!ds.length) return null;
      var Q = P.expr('Maximum_Snow_Extent==200', 0, 1), W = 0, H = 0, cnt = null, last = null, ok = 0, used = [];
      return ds.reduce(function (pr, d) { return pr.then(function () { return P.mosaic(a, COL, P.pick(by[d], a, 4).map(function (f) { return { id: f.id }; }), Q, 300).then(function (img) {
        if (!W) { W = img.width; H = img.height; cnt = new Uint8Array(W * H); } var D = P.pix(P.canvasOf(img), W, H).data, cur = new Uint8Array(W * H), seen = 0;
        for (var i = 0; i < W * H; i++) if (D[4 * i + 3] > 127) { seen++; if (D[4 * i] > 127) { cnt[i]++; cur[i] = 1; } }
        if (seen > 0.3 * W * H) { ok++; used.push(d); if (!last) last = cur; } }).catch(function () {}); }); }, Promise.resolve()).then(function () {
        if (!ok) return null; var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var g = cv.getContext('2d'), im = g.createImageData(W, H), lf = 0;
        for (var i = 0; i < W * H; i++) { if (last && last[i]) lf++; if (!cnt[i]) continue; var o = 4 * i, fr2 = cnt[i] / ok; im.data[o] = last && last[i] ? 255 : 170; im.data[o + 1] = last && last[i] ? 255 : 225; im.data[o + 2] = 255; im.data[o + 3] = Math.round(90 + 150 * fr2); }
        g.putImageData(im, 0, 0);
        return new Promise(function (res) { cv.toBlob(res, 'image/png'); }).then(function (bl) { return { img: bl, W: W, H: H, cnt: cnt, last: last, n: ok, dates: used, frac: lf / (W * H) }; });
      });
    });
  }
  function weather(c) {
    return fetch(WX + '?latitude=' + c[0].toFixed(4) + '&longitude=' + c[1].toFixed(4) + '&daily=precipitation_sum,snowfall_sum,temperature_2m_max,temperature_2m_min&hourly=soil_moisture_3_to_9cm,snow_depth&past_days=7&forecast_days=7&timezone=auto')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
        var D = j.daily || {}, today = new Date().toISOString().slice(0, 10), days = (D.time || []).map(function (d, i) { return { d: d, p: D.precipitation_sum[i], sf: D.snowfall_sum ? D.snowfall_sum[i] : null, tx: D.temperature_2m_max[i], tn: D.temperature_2m_min[i] }; });
        var past = days.filter(function (x) { return x.d < today; }), r7 = past.reduce(function (s, x) { return s + (x.p || 0); }, 0), r3 = past.slice(-3).reduce(function (s, x) { return s + (x.p || 0); }, 0), s7 = past.reduce(function (s, x) { return s + (x.sf || 0); }, 0);
        var H = j.hourly || {}, sm = null, sd = null, now = Date.now(); (H.time || []).forEach(function (tm, i) { if (Date.parse(tm) <= now) { if (H.soil_moisture_3_to_9cm && H.soil_moisture_3_to_9cm[i] != null) sm = H.soil_moisture_3_to_9cm[i]; if (H.snow_depth && H.snow_depth[i] != null) sd = H.snow_depth[i]; } });
        return { at: new Date().toISOString(), days: days, r7: r7, r3: r3, s7: s7, sm: sm, sd: sd };
      });
  }
  function outline() { if (OUTLINE) return Promise.resolve(OUTLINE); return fetch(SH.base + 'assets/data/iraq-outline.json').then(function (r) { return r.json(); }).then(function (o) { OUTLINE = o.map(function (q) { return [q[1], q[0]]; }); return OUTLINE; }).catch(function () { return null; }); }

  /* ---------------------------------------------------------------- saving one square */
  function saveTile(a, meta, prog) {
    var pk = Object.assign({ id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6), a: a, c: [(a.s + a.n) / 2, (a.w + a.e) / 2], at: new Date().toISOString(), lang: SH.lang, v: 2 }, meta), warn = [];
    prog(0.04, t('Water, villages, roads, services and masts…', 'المياه والقرى والطرق والخدمات والأبراج…'));
    return ovFetch(ovQuery(a)).then(function (j) { pk.f = parseOv(j); prog(0.3, t('Elevation model…', 'نموذج الارتفاع…')); })
      .then(function () { var tw = pk.f.filter(function (f) { return f.k === 'tow'; }).map(function (f) { return f.p; }); return terrain(a, tw, function (p) { prog(0.3 + 0.35 * p, t('Elevation model…', 'نموذج الارتفاع…')); }).catch(function (e) { warn.push(t('No elevation model: ', 'لا يوجد نموذج ارتفاع: ') + e.message); return null; }); })
      .then(function (tr) { if (tr) { pk.img = tr.img; pk.zr = [tr.zmin, tr.zmax]; } prog(0.7, t('Snow of the last weeks…', 'ثلج الأسابيع الأخيرة…')); return snow(a).catch(function () { return null; }).then(function (sn) { if (sn) { pk.snow = { W: sn.W, H: sn.H, cnt: sn.cnt, last: sn.last, n: sn.n, dates: sn.dates, frac: sn.frac }; pk.img = pk.img || {}; pk.img.sn = sn.img; } return tr; }); })
      .then(function (tr) { prog(0.85, t('Rain, snow and temperature…', 'المطر والثلج والحرارة…')); return weather(pk.c).catch(function () { warn.push(t('Weather could not be read.', 'تعذرت قراءة الطقس.')); return null; }).then(function (wx) { pk.wx = wx; return tr; }); })
      .then(function (tr) { prog(0.95, t('Saving on this device…', 'الحفظ على هذا الجهاز…')); return outline().then(function (o) { pk.border = o; var ps = [dbPut('packs', pk)]; if (tr) ps.push(dbPut('terr', { id: pk.id, W: tr.W, H: tr.H, z: tr.z, slope: tr.slope, acc: tr.acc, cov: tr.cov })); return Promise.all(ps); }); })
      .then(function () { return { pk: pk, warn: warn }; });
  }
  function msg(p, s) { $('#smBarI').style.width = Math.round(p * 100) + '%'; $('#smMsg').textContent = s; }
  function job() { try { return JSON.parse(lsGet('shandal_sm_job') || 'null'); } catch (e) { return null; } }
  function resumeBtn() { var j = job(), b = $('#smResume'); b.hidden = !j || busy; if (j) b.querySelector('span').textContent = t('Continue saving “', 'أكمل حفظ «') + j.name + t('” (', '» (') + j.done.length + ' / ' + j.n * j.n + ')'; }
  function runJob(j) {
    busy = true; $('#smGet').disabled = true; resumeBtn(); if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    var N = j.n * j.n, a = j.a, list = [], warn = [], lock = null;
    for (var r = 0; r < j.n; r++) for (var c = 0; c < j.n; c++) list.push([r, c]);
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
    var step = function (i) {
      if (i >= list.length) return Promise.resolve();
      var rc = list[i], gi = rc[0] * j.n + rc[1]; if (j.done.indexOf(gi) >= 0) return step(i + 1);
      var dLa = (a.n - a.s) / j.n, dLo = (a.e - a.w) / j.n, sub = { s: a.n - (rc[0] + 1) * dLa, n: a.n - rc[0] * dLa, w: a.w + rc[1] * dLo, e: a.w + (rc[1] + 1) * dLo };
      var meta = { name: j.name + (N > 1 ? ' · ' + (gi + 1) + '/' + N : ''), en: j.en + (N > 1 ? ' · ' + (gi + 1) + '/' + N : ''), size: Math.round(j.size / j.n), gid: N > 1 ? j.gid : undefined, gname: j.name, gi: gi, gn: N, gsize: j.size };
      return saveTile(sub, meta, function (p, s) { msg((j.done.length + p) / N, (N > 1 ? t('Square ', 'المربع ') + (j.done.length + 1) + ' / ' + N + ' · ' : '') + s); })
        .then(function (r2) { j.done.push(gi); lsSet('shandal_sm_job', JSON.stringify(j)); warn = warn.concat(r2.warn); return showMany([r2.pk.id], false); })
        .then(function () { return step(i + 1); });
    };
    return step(0).then(function () {
      lsSet('shandal_sm_job', ''); msg(1, t('Saved. This area now works without internet.', 'تم الحفظ. هذه المنطقة تعمل الآن من دون إنترنت.') + (warn.length ? ' ' + warn.filter(function (w, i, A) { return A.indexOf(w) === i; }).join(' ') : ''));
      SH.toast(t('Area saved for offline use.', 'حُفظت المنطقة للعمل دون إنترنت.'), 'ok'); warm(); CTR = null; drawBox(); fitAll();
    }).catch(function (e) { msg(0, (e.message || String(e)) + t(' — press “Continue saving” to go on from where it stopped.', ' — اضغط «أكمل الحفظ» للمتابعة من حيث توقف.')); SH.toast(e.message || String(e), 'bad'); })
      .then(function () { busy = false; $('#smGet').disabled = false; if (lock) lock.release().catch(function () {}); resumeBtn(); listPacks(); });
  }
  $('#smGet').addEventListener('click', function () {
    if (busy) return; if (!CTR) return SH.toast(t('Choose a ready area, use your location or tap the map first.', 'اختر منطقة جاهزة أو استخدم موقعك أو انقر على الخريطة أولاً.'), 'warn');
    if (navigator.onLine === false) return SH.toast(t('Saving an area needs the internet. Do it before the trip.', 'حفظ المنطقة يحتاج إلى الإنترنت. افعله قبل الرحلة.'), 'warn');
    persist.save(); var sz = +$('#smSize').value, n = Math.ceil(sz / TILE), name = $('#smName').value.trim() || (F(CTR[0], 3) + '°, ' + F(CTR[1], 3) + '°');
    var en = NAME_EN && name === $('#smName').value.trim() ? NAME_EN : /[؀-ۿ]/.test(name) ? 'Area at ' + CTR[0].toFixed(3) + '°N, ' + CTR[1].toFixed(3) + '°E' : name;
    var go = function () { var j = { gid: 'g' + Date.now(), name: name, en: en, size: sz, n: n, a: boxOf(CTR, sz), done: [] }; lsSet('shandal_sm_job', JSON.stringify(j)); runJob(j); };
    if (n > 2) Promise.resolve(SH.confirm(t('This area is saved as ', 'تُحفظ هذه المنطقة في ') + n * n + t(' squares: ', ' مربعاً: ') + $('#smEst').textContent + t(' Keep the page open; if it stops, it can be continued later.', ' أبقِ الصفحة مفتوحة؛ وإن توقف الحفظ يمكن إكماله لاحقاً.'))).then(function (ok) { if (ok) go(); }); else go();
  });
  $('#smResume').addEventListener('click', function () { var j = job(); if (j && !busy) { if (navigator.onLine === false) return SH.toast(t('Saving needs the internet.', 'الحفظ يحتاج إلى الإنترنت.'), 'warn'); runJob(j); } });

  /* ---------------------------------------------------------------- saved areas (single squares and groups) */
  function sizeOf(p) { var b = JSON.stringify(p.f || []).length, im = p.img || (p.t && p.t.img) || {}; Object.keys(im).forEach(function (k) { b += (im[k] && im[k].size) || 0; }); if (p.t) b += p.t.z.byteLength * 4.5; else if (p.zr) b += 7 * 810000; return b / 1048576; }
  function isOn(id) { return ACT.some(function (p) { return p.id === id; }); }
  function groups() { var G0 = [], by = {}; PACKS.forEach(function (p) { if (p.gid) { if (!by[p.gid]) { by[p.gid] = { gid: p.gid, name: p.gname, size: p.gsize, n: p.gn, at: p.at, ps: [] }; G0.push(by[p.gid]); } by[p.gid].ps.push(p); } else G0.push({ gid: null, name: p.name, size: p.size, n: 1, at: p.at, ps: [p] }); }); return G0; }
  var GR = [];
  function listPacks() {
    return dbAll('packs').then(function (all) {
      PACKS = (all || []).sort(function (x, y) { return x.at < y.at ? 1 : -1; }); GR = groups();
      $('#smPacks').innerHTML = GR.length ? (GR.length > 1 ? '<div class="sm-chips"><button type="button" data-all="1">' + t('Show all on the map', 'اعرض الكل على الخريطة') + '</button><button type="button" data-all="0">' + t('Hide all', 'أخفِ الكل') + '</button></div>' : '') + GR.map(function (g, i) {
        var ids = g.ps.map(function (p) { return p.id; }), on = ids.every(isOn), mb = g.ps.reduce(function (s, p) { return s + sizeOf(p); }, 0), nf = g.ps.reduce(function (s, p) { return s + (p.f || []).length; }, 0);
        return '<div class="sm-pk" data-cur="' + on + '"><b>' + E(g.name) + '</b><small>' + g.size + ' × ' + g.size + t(' km', ' كم') + (g.gid ? ' · ' + g.ps.length + ' / ' + g.n + t(' squares', ' مربعاً') : '') + t(' · saved ', ' · حُفظت ') + new Date(g.at).toLocaleDateString(AR ? 'ar-IQ' : 'en-GB') + ' · ' + F(mb, 0) + ' MB · ' + F(nf, 0) + t(' features', ' معلماً') + '</small><div class="r"><button class="btn ' + (on ? 'btn-ink' : 'btn-line') + ' btn-xs" type="button" data-tog="' + i + '">' + (on ? '✓ ' + t('On the map', 'على الخريطة') : t('Show on the map', 'اعرض على الخريطة')) + '</button>' + (on ? '<button class="btn btn-line btn-xs" type="button" data-fit="' + i + '">' + t('Go to', 'انتقل إليها') + '</button>' : '') + '<button class="btn btn-line btn-xs" type="button" data-del="' + i + '">' + t('Delete', 'احذف') + '</button></div></div>';
      }).join('') : '<p class="xsmall muted" style="margin:0">' + t('No area saved yet.', 'لم تُحفظ أي منطقة بعد.') + '</p>';
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { $('#smStore').textContent = t('Used on this device: ', 'المستخدم على هذا الجهاز: ') + F((e.usage || 0) / 1048576, 0) + ' MB' + (e.quota ? t(' of about ', ' من نحو ') + F(e.quota / 1073741824, 1) + ' GB' : ''); });
    }).catch(function () { $('#smPacks').innerHTML = '<p class="xsmall muted">' + t('This browser does not allow saving data (private window?).', 'هذا المتصفح لا يسمح بحفظ البيانات (نافذة خاصة؟).') + '</p>'; });
  }
  function boundsOf(ps) { var b = L.latLngBounds([]); ps.forEach(function (p) { b.extend([[p.a.s, p.a.w], [p.a.n, p.a.e]]); }); return b; }
  $('#smPacks').addEventListener('click', function (e) {
    var o = e.target.closest('[data-tog]'), d = e.target.closest('[data-del]'), al = e.target.closest('[data-all]'), fi = e.target.closest('[data-fit]');
    if (o) { var g = GR[+o.getAttribute('data-tog')], ids = g.ps.map(function (p) { return p.id; }); if (ids.every(isOn)) hideMany(ids); else showMany(ids, true); }
    if (fi) map.fitBounds(boundsOf(GR[+fi.getAttribute('data-fit')].ps), { padding: [10, 10] });
    if (al) { if (al.getAttribute('data-all') === '1') showMany(PACKS.map(function (p) { return p.id; }), true); else hideMany(ACT.map(function (p) { return p.id; })); }
    if (d) { var g2 = GR[+d.getAttribute('data-del')]; Promise.resolve(SH.confirm(t('Delete this saved area from the device? It will not work offline any more.', 'حذف هذه المنطقة المحفوظة من الجهاز؟ لن تعمل بعدها من دون إنترنت.'))).then(function (ok) { if (!ok) return; var ids2 = g2.ps.map(function (p) { return p.id; }); hideMany(ids2); var j = job(); if (j && j.gid === g2.gid) lsSet('shandal_sm_job', ''); return Promise.all(ids2.map(function (id) { return Promise.all([dbDel('packs', id), dbDel('terr', id)]); })).then(function () { resumeBtn(); listPacks(); }); }); }
  });
  function remember() { lsSet('shandal_sm_open', JSON.stringify(ACT.map(function (p) { return p.id; }))); }
  function fitAll() { if (ACT.length) map.fitBounds(boundsOf(ACT), { padding: [10, 10] }); }
  function pkAt(lat, lon) { for (var i = 0; i < ACT.length; i++) { var a = ACT[i].a; if (lat >= a.s && lat <= a.n && lon >= a.w && lon <= a.e) return ACT[i]; } return null; }
  function changed(fit) {
    remember(); buildIndex(); drawBox(); redraw(); if (fit) fitAll();
    if (!ACT.length) { PK = null; SEL = null; G.sel.setLatLngs([]); $('#smOut').hidden = true; $('#smEmpty').hidden = false; status(); listPacks(); return; }
    $('#smOut').hidden = false; $('#smEmpty').hidden = true; PK = null; if (!POS) setPos({ lat: ACT[0].c[0], lon: ACT[0].c[1], acc: 0, plan: true, centre: true }); else update(true); season(); listPacks();
  }
  function showMany(ids, fit) { return Promise.all(ids.filter(function (id) { return !isOn(id); }).map(function (id) { return dbGet('packs', id); })).then(function (L0) { L0.forEach(function (pk) { if (pk && !isOn(pk.id)) { ACT.push(pk); addOv(pk); } }); changed(fit); }); }
  function hideMany(ids) { ACT = ACT.filter(function (p) { return ids.indexOf(p.id) < 0; }); ids.forEach(function (id) { dropOv(id); delete TERR[id]; }); if (POS && POS.centre && !pkAt(POS.lat, POS.lon)) POS = null; changed(false); }

  /* ---------------------------------------------------------------- terrain on demand */
  function terr(pk) {
    if (!pk) return Promise.resolve(null); if (pk.t) return Promise.resolve(pk.t); if (TERR[pk.id] !== undefined) return Promise.resolve(TERR[pk.id]);
    return dbGet('terr', pk.id).then(function (x) { TERR[pk.id] = x || null; var ks = Object.keys(TERR); if (ks.length > 16) delete TERR[ks[0]]; return TERR[pk.id]; }).catch(function () { return null; });
  }
  function terrSync(pk) { return !pk ? null : pk.t ? pk.t : TERR[pk.id] || null; }
  function cellOf(lat, lon, pk) { pk = pk || pkAt(lat, lon); var T = terrSync(pk); if (!T) return -1; var a = pk.a, c = Math.floor((lon - a.w) / (a.e - a.w) * T.W), r = Math.floor((a.n - lat) / (a.n - a.s) * T.H); return r < 0 || r >= T.H || c < 0 || c >= T.W ? -1 : r * T.W + c; }
  function elev(lat, lon) { var pk = pkAt(lat, lon), i = cellOf(lat, lon, pk); return i < 0 ? null : terrSync(pk).z[i]; }
  function loadAround(bnds) { return Promise.all(ACT.filter(function (p) { return bnds.intersects([[p.a.s, p.a.w], [p.a.n, p.a.e]]); }).slice(0, 16).map(terr)); }

  /* ---------------------------------------------------------------- position, compass, path, internet log */
  function setPos(p, soft) { POS = p; var pk = pkAt(p.lat, p.lon); if (pk && !terrSync(pk)) terr(pk).then(function () { update(true); }); update(!soft); }
  function meIcon() { return L.divIcon({ className: '', html: '<div class="sm-me">' + (HEAD != null ? '<svg viewBox="0 0 50 50" style="transform:rotate(' + HEAD + 'deg)"><path d="M25 3 L33 22 L17 22 Z" fill="#1A73E8" fill-opacity=".55"/></svg>' : '') + '<i></i></div>', iconSize: [22, 22], iconAnchor: [11, 11] }); }
  var lastPing = 0;
  function drawNet() { G.net.clearLayers(); NET.forEach(function (q) { L.circleMarker([q[0], q[1]], { radius: 4, color: '#fff', weight: 1.5, fillColor: '#16A34A', fillOpacity: 1, interactive: false }).addTo(G.net); }); }
  function ping() {
    if (!POS || POS.plan || Date.now() - lastPing < 20000 || navigator.onLine === false) return; lastPing = Date.now();
    fetch(SH.base + 'sw.js?ping=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) return; var l = NET[NET.length - 1], p = [r5(POS.lat), r5(POS.lon), Date.now()]; if (l && dist(l, p) < 100) l[2] = p[2]; else NET.push(p); if (NET.length > 3000) NET.shift(); dbPut('net', { id: 'all', p: NET }).catch(function () {}); drawNet(); }).catch(function () {});
  }
  $('#smGps').addEventListener('click', function () {
    if (WATCH != null) { navigator.geolocation.clearWatch(WATCH); WATCH = null; $('#smGps span').textContent = t('Start GPS', 'شغّل تحديد الموقع'); $('#smGps').setAttribute('aria-pressed', false); status(); return; }
    if (!navigator.geolocation) return SH.toast(t('This browser does not support location.', 'هذا المتصفح لا يدعم تحديد الموقع.'), 'bad');
    PLAN = false; $('#smPlan').setAttribute('aria-pressed', false);
    WATCH = navigator.geolocation.watchPosition(function (g) { var c = g.coords; if (c.accuracy > 3000) return; setPos({ lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, t: g.timestamp }, true); if (REC) addTrk(); ping(); },
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
  function addTrk() { if (!POS || POS.plan) return; var l = TRK[TRK.length - 1]; if (POS.acc > 60) return; if (l && dist(l, [POS.lat, POS.lon]) < 15) return; TRK.push([r5(POS.lat), r5(POS.lon), Date.now(), POS.alt != null ? Math.round(POS.alt) : null]); G.trk.setLatLngs(TRK.map(function (q) { return [q[0], q[1]]; })); if (TRK.length % 5 === 1) dbPut('tracks', { id: 'all', p: TRK }).catch(function () {}); }
  $('#smTrk').addEventListener('click', function () {
    REC = !REC; $('#smTrk').setAttribute('aria-pressed', REC); $('#smTrk span').textContent = REC ? t('Stop recording', 'أوقف التسجيل') : t('Record my path', 'سجّل مساري');
    if (REC) { if (WATCH == null) $('#smGps').click(); addTrk(); SH.toast(t('Recording. The start of your path is added to the list as the way back.', 'جارٍ التسجيل. تُضاف بداية مسارك إلى القائمة كطريق للعودة.'), 'ok'); } else dbPut('tracks', { id: 'all', p: TRK }).catch(function () {});
    status(); update(true);
  });

  /* ---------------------------------------------------------------- landmarks */
  var MKMODE = false, MKURL = null;
  function drawMarks() {
    G.mk.clearLayers(); if (!MKURL) { var c = document.createElement('canvas'); c.width = 52; c.height = 52; sym(c.getContext('2d'), 'mk', 26, 26, 34); MKURL = c.toDataURL(); }
    MARKS.forEach(function (m) { L.marker([m.lat, m.lon], { icon: L.icon({ iconUrl: MKURL, iconSize: [26, 26], iconAnchor: [13, 13] }), keyboard: false }).bindTooltip(E(m.name), { permanent: map.getZoom() >= 12, direction: 'right', offset: [10, 0] }).on('click', function () { popAt([m.lat, m.lon], m.name, t('My landmark', 'معلمي')); }).addTo(G.mk); });
    $('#smMarks').innerHTML = MARKS.length ? MARKS.map(function (m, i) { var d = POS ? ' · ' + km(dist([POS.lat, POS.lon], [m.lat, m.lon])) + ' ' + compass8(brg([POS.lat, POS.lon], [m.lat, m.lon])) : ''; return '<div class="it"><span><b>' + E(m.name) + '</b><small class="muted">' + d + '</small></span><span class="r"><button class="btn btn-line btn-xs" type="button" data-mr="' + i + '">' + t('Route', 'المسار') + '</button><button class="btn btn-line btn-xs" type="button" data-md="' + i + '" aria-label="' + t('Delete', 'احذف') + '">×</button></span></div>'; }).join('') : '<p class="xsmall muted" style="margin:0">' + t('No landmarks yet.', 'لا توجد معالم بعد.') + '</p>';
  }
  function addMark(lat, lon) { var nm = window.prompt(t('Name of the landmark', 'اسم المعلم'), t('Landmark ', 'معلم ') + (MARKS.length + 1)); if (nm == null) return; var m = { id: 'm' + Date.now(), name: nm.trim() || t('Landmark', 'معلم'), lat: r5(lat), lon: r5(lon), at: new Date().toISOString() }; MARKS.push(m); dbPut('marks', m).catch(function () {}); drawMarks(); SH.toast(t('Landmark saved.', 'حُفظ المعلم.'), 'ok'); }
  $('#smMkHere').addEventListener('click', function () { if (!POS || POS.plan) return SH.toast(t('Start the GPS first.', 'شغّل تحديد الموقع أولاً.'), 'warn'); addMark(POS.lat, POS.lon); });
  $('#smMkMap').addEventListener('click', function () { MKMODE = !MKMODE; $('#smMkMap').setAttribute('aria-pressed', MKMODE); if (MKMODE) SH.toast(t('Tap the map where the landmark is.', 'انقر على الخريطة حيث المعلم.'), 'ok'); });
  $('#smMarks').addEventListener('click', function (e) { var r = e.target.closest('[data-mr]'), d = e.target.closest('[data-md]'); if (r) { var m = MARKS[+r.getAttribute('data-mr')]; routeTo([m.lat, m.lon], m.name); } if (d) { var m2 = MARKS.splice(+d.getAttribute('data-md'), 1)[0]; dbDel('marks', m2.id).catch(function () {}); drawMarks(); } });
  map.on('zoomend', function () { if (MARKS.length) drawMarks(); });

  /* ---------------------------------------------------------------- clicks on the map: popups and picking */
  function popAt(q, name, kind, extra) {
    var here = POS ? km(dist([POS.lat, POS.lon], q)) + ' · ' + compass8(brg([POS.lat, POS.lon], q)) : '';
    var html = '<div class="sm-pop"><b>' + E(name || kind) + '</b><small>' + E(name ? kind : '') + (here ? (name ? ' · ' : '') + here : '') + '</small><div class="r"><button type="button" data-pr="car">' + t('Route by car', 'مسار بالسيارة') + '</button><button type="button" data-pr="walk">' + t('Route on foot', 'مسار مشياً') + '</button><button type="button" data-pm="1">' + t('Mark here', 'علّم هنا') + '</button>' + (extra ? '<button type="button" data-pc="1">' + t('Centre of a new area', 'مركز منطقة جديدة') + '</button>' : '') + '</div></div>';
    var pp = L.popup({ maxWidth: 270 }).setLatLng(q).setContent(html).openOn(map), el = pp.getElement();
    if (el) el.onclick = function (e) { var b = e.target.closest('[data-pr]'), m = e.target.closest('[data-pm]'), c = e.target.closest('[data-pc]'); if (b) { setMode(b.getAttribute('data-pr')); map.closePopup(); routeTo(q, name || kind); } if (m) { map.closePopup(); addMark(q[0], q[1]); } if (c) { map.closePopup(); NAME_EN = ''; setCtr(q, null, false); SH.toast(t('Now choose the size and press “Save this area”.', 'اختر الآن الحجم واضغط «احفظ هذه المنطقة».'), 'ok'); } };
  }
  map.on('click', function (e) {
    var q = [e.latlng.lat, e.latlng.lng];
    if (MKMODE) { MKMODE = false; $('#smMkMap').setAttribute('aria-pressed', false); addMark(q[0], q[1]); return; }
    if (PICK) { PICK = null; $('#smRtPick').setAttribute('aria-pressed', false); routeTo(q, t('Chosen point', 'نقطة مختارة')); return; }
    if (PLAN && ACT.length) { setPos({ lat: q[0], lon: q[1], acc: 0, plan: true }); return; }
    if (!ACT.length) { NAME_EN = ''; setCtr(q, null, false); return; }
    var z = map.getZoom(), pt = map.latLngToContainerPoint(e.latlng), d0 = 0.002 * Math.pow(2, Math.max(0, 15 - z)), best = null, bd = 16;
    query(q[0] - d0, q[1] - d0, q[0] + d0, q[1] + d0, function (f) { return f.p && ON[f.k] && z >= K[f.k][4]; }).forEach(function (f) { var dd = map.latLngToContainerPoint(f.p).distanceTo(pt); if (dd < bd) { bd = dd; best = f; } });
    if (best) popAt(best.p, nmOf(best), K[best.k][AR ? 1 : 0] + (best.h ? ' · ' + best.h + t(' m', ' م') : ''));
    else popAt(q, '', t('Point on the map', 'نقطة على الخريطة'), true);
  });

  /* ---------------------------------------------------------------- routes on the saved roads and paths */
  var SPEED = { rdM: 70, rdm: 45, rdr: 25, trk: 15 };
  function setMode(m) { MODE = m; $$('[data-rm]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-rm') === m); }); }
  $$('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-rm')); if (ROUTE) routeTo(ROUTE.to, ROUTE.name); }); });
  $('#smRtPick').addEventListener('click', function () { PICK = !PICK; $('#smRtPick').setAttribute('aria-pressed', !!PICK); if (PICK) SH.toast(t('Tap the destination on the map.', 'انقر على الوجهة في الخريطة.'), 'ok'); });
  $('#smRtClr').addEventListener('click', function () { ROUTE = null; G.rt.clearLayers(); $('#smRtClr').hidden = true; $('#smRtOut').textContent = ''; });
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) { var k = this.k, v = this.v, i = k.length; k.push(key); v.push(val); while (i > 0) { var p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; };
  Heap.prototype.pop = function () { var k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length; if (n) { var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i, mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) m = r; if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; } k[i] = lk; v[i] = lv; } return top; };
  function graph(bnds, mode) {
    var kinds = mode === 'car' ? ['rdM', 'rdm', 'rdr', 'trk'] : ['rdM', 'rdm', 'rdr', 'trk', 'pth'], ids = {}, NX = [], NY = [], ADJ = [], snap = {};
    var nodeOf = function (q, end) {
      var key = Math.round(q[0] * 1e5) + ',' + Math.round(q[1] * 1e5); if (ids[key] != null) return ids[key];
      var bi = Math.round(q[0] * 5e3), bj = Math.round(q[1] * 5e3);
      if (end) { var best = -1, bd = 15; for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) { var arr = snap[(bi + di) + ',' + (bj + dj)]; if (!arr) continue; for (var a = 0; a < arr.length; a++) { var id0 = arr[a], d = dist(q, [NY[id0], NX[id0]]); if (d < bd) { bd = d; best = id0; } } } if (best >= 0) { ids[key] = best; return best; } }
      var id = NX.length; NX.push(q[1]); NY.push(q[0]); ADJ.push([]); ids[key] = id; var sk = bi + ',' + bj; (snap[sk] || (snap[sk] = [])).push(id); return id;
    };
    query(bnds.getSouth(), bnds.getWest(), bnds.getNorth(), bnds.getEast(), function (f) { return f.g && kinds.indexOf(f.k) >= 0; }).forEach(function (f) { var g = f.g, prev = -1; for (var i = 0; i < g.length; i++) { var id = nodeOf(g[i], i === 0 || i === g.length - 1); if (prev >= 0 && prev !== id) {
      var d = dist([NY[prev], NX[prev]], [NY[id], NX[id]]), c1, c2;
      if (mode === 'car') { c1 = c2 = d / (SPEED[f.k] / 3.6); } else { var z1 = elev(NY[prev], NX[prev]), z2 = elev(NY[id], NX[id]), sl = z1 != null && z2 != null && d > 0 ? (z2 - z1) / d : 0; c1 = d / (tobler(sl) / 3.6); c2 = d / (tobler(-sl) / 3.6); }
      ADJ[prev].push(id, c1); ADJ[id].push(prev, c2); } prev = id; } });
    return { NX: NX, NY: NY, ADJ: ADJ };
  }
  /* join a point to the nearest place on a road segment (not only to its end nodes) by a new node */
  function nearestNode(G0, q) {
    var bu = -1, bv = -1, bc = 0, bd = Infinity, bp = null, bt = 0;
    for (var u = 0; u < G0.NX.length; u++) { var A = G0.ADJ[u]; for (var j = 0; j < A.length; j += 2) { var v = A[j]; if (v < u) continue; var r = nearLine(q, [[G0.NY[u], G0.NX[u]], [G0.NY[v], G0.NX[v]]]); if (r.d < bd) { bd = r.d; bu = u; bv = v; bc = A[j + 1]; bp = r.p; } } }
    if (bu < 0) return { i: -1, d: Infinity };
    var L0 = dist([G0.NY[bu], G0.NX[bu]], [G0.NY[bv], G0.NX[bv]]); bt = L0 ? dist([G0.NY[bu], G0.NX[bu]], bp) / L0 : 0;
    if (bt < 0.02) return { i: bu, d: dist(q, [G0.NY[bu], G0.NX[bu]]) }; if (bt > 0.98) return { i: bv, d: dist(q, [G0.NY[bv], G0.NX[bv]]) };
    var back = bc, Av = G0.ADJ[bv]; for (var k = 0; k < Av.length; k += 2) if (Av[k] === bu) { back = Av[k + 1]; break; }
    var id = G0.NX.length; G0.NX.push(bp[1]); G0.NY.push(bp[0]); G0.ADJ.push([bu, back * bt, bv, bc * (1 - bt)]); G0.ADJ[bu].push(id, bc * bt); G0.ADJ[bv].push(id, back * (1 - bt));
    return { i: id, d: bd };
  }
  function legWalk(a, b) { var d = dist(a, b), z1 = elev(a[0], a[1]), z2 = elev(b[0], b[1]), sl = z1 != null && z2 != null && d > 0 ? (z2 - z1) / d : 0; return d / (tobler(sl) / 3.6) * 1.25; }
  function routeTo(to, name) {
    if (!POS) return SH.toast(t('Start the GPS or choose a point first.', 'شغّل تحديد الموقع أو اختر نقطة أولاً.'), 'warn');
    var from = [POS.lat, POS.lon], d0 = dist(from, to), bnds = L.latLngBounds([from, to]).pad(d0 < 3000 ? 1.5 : 0.35);
    $('#smRtOut').textContent = t('Finding the route…', 'جارٍ إيجاد المسار…'); ROUTE = { to: to, name: name }; $('#smRt').scrollIntoView({ block: 'nearest' });
    loadAround(bnds).then(function () { return new Promise(function (r) { setTimeout(r, 30); }); }).then(function () {
      var G0 = graph(bnds, MODE), s = nearestNode(G0, from), e = nearestNode(G0, to), mcol = MODE === 'car' ? '#1A73E8' : '#1E8449'; G.rt.clearLayers(); $('#smRtClr').hidden = false;
      var fail = function (pre) { L.polyline([from, to], { color: mcol, weight: 4, dashArray: '8 8', opacity: .9 }).addTo(G.rt); $('#smRtOut').innerHTML = '<b>' + E(name) + '</b> · ' + km(d0) + t(' in a straight line. ', ' بخط مستقيم. ') + (pre || '') + t('No connected roads or paths between here and there in the saved map; the dashed line is the straight direction.', 'لا توجد طرق أو ممرات متصلة بين هنا وهناك في الخريطة المحفوظة؛ والخط المتقطع هو الاتجاه المستقيم.'); };
      var lim = MODE === 'car' ? 5000 : 15000; if (s.i < 0 || e.i < 0) return fail(); if (s.d > lim || e.d > lim) return fail(t('The nearest saved road or path is ', 'أقرب طريق أو ممر محفوظ على بعد ') + km(Math.max(s.d, e.d)) + t(' away. ', '. '));
      var n = G0.NX.length, D = new Float64Array(n).fill(Infinity), PR = new Int32Array(n).fill(-1), H0 = new Heap(); D[s.i] = 0; H0.push(0, s.i);
      while (H0.k.length) { var u = H0.pop(); if (u === e.i) break; var A = G0.ADJ[u], du = D[u]; for (var j = 0; j < A.length; j += 2) { var v = A[j], nd = du + A[j + 1]; if (nd < D[v]) { D[v] = nd; PR[v] = u; H0.push(nd, v); } } }
      if (!isFinite(D[e.i])) return fail();
      var path = [], len = 0, up = 0; for (var x = e.i; x >= 0; x = PR[x]) path.push([G0.NY[x], G0.NX[x]]); path.reverse();
      for (var i = 1; i < path.length; i++) { len += dist(path[i - 1], path[i]); var z1 = elev(path[i - 1][0], path[i - 1][1]), z2 = elev(path[i][0], path[i][1]); if (z1 != null && z2 != null && z2 > z1) up += z2 - z1; }
      var tot = D[e.i] + (MODE === 'walk' ? legWalk(from, path[0]) + legWalk(path[path.length - 1], to) : 0);
      L.polyline(path, { color: '#fff', weight: MODE === 'car' ? 9 : 7, opacity: .9 }).addTo(G.rt); ROUTE.line = L.polyline(path, { color: mcol, weight: MODE === 'car' ? 5.5 : 4.5, opacity: .95 }).addTo(G.rt);
      [[from, path[0]], [path[path.length - 1], to]].forEach(function (lg) { if (dist(lg[0], lg[1]) > 15) L.polyline(lg, { color: '#55616B', weight: 3, dashArray: '4 6' }).addTo(G.rt); });
      map.fitBounds(L.latLngBounds(path.concat([from, to])).pad(0.15), { maxZoom: 15 });
      var walkLegs = MODE === 'car' && (s.d > 30 || e.d > 30) ? t(' + on foot: ', ' + مشياً: ') + km(s.d) + t(' to the road', ' إلى الطريق') + (e.d > 30 ? t(' and ', ' و') + km(e.d) + t(' from it', ' منه') : '') : '';
      $('#smRtOut').innerHTML = '<span class="r"><b class="big">' + km(len + (MODE === 'walk' ? s.d + e.d : 0)) + ' · ' + hm(tot / 60) + '</b> ' + (MODE === 'car' ? t('by car', 'بالسيارة') : t('on foot', 'مشياً')) + '</span><span>' + t('To ', 'إلى ') + '<b>' + E(name) + '</b>' + walkLegs + (MODE === 'walk' && up > 20 ? t(' · climb ', ' · صعود ') + Math.round(up) + t(' m', ' م') : '') + t(' · straight line ', ' · بخط مستقيم ') + km(d0) + '.</span><br><span class="muted">' + (MODE === 'car' ? t('Speeds assumed: main roads 70, minor 45, streets 25, dirt tracks 15 km/h. Tracks may need a 4×4; ask about road conditions.', 'السرعات المفترضة: الطرق الرئيسة 70 والفرعية 45 والشوارع 25 والدروب الترابية 15 كم/س. قد تحتاج الدروب إلى سيارة دفع رباعي؛ اسأل عن حالة الطرق.') : t('Walking time from the slope (Tobler) on roads, tracks and footpaths; grey dashes are the parts off the mapped network.', 'زمن المشي من الانحدار (توبلر) على الطرق والدروب وممرات المشاة؛ والخطوط الرمادية المتقطعة أجزاء خارج الشبكة المرسومة.')) + '</span>';
    });
  }

  /* ---------------------------------------------------------------- nearest places */
  function nearest(kinds, p) {
    var ci = Math.floor(p[0] / CS), cj = Math.floor(p[1] / CS), best = null, st = ++STAMP, cellM = CS * 111320 * Math.cos(SH.rad(p[0]));
    for (var r = 0; r <= 14; r++) {
      for (var i = ci - r; i <= ci + r; i++) for (var j = cj - r; j <= cj + r; j++) { if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue; var a = IDX[ckey(i, j)]; if (!a) continue;
        for (var q = 0; q < a.length; q++) { var f = a[q]; if (f._s === st) continue; f._s = st; if (kinds.indexOf(f.k) < 0) continue; var d, pt; if (f.p) { d = dist(p, f.p); pt = f.p; } else { var nl = nearLine(p, f.g); d = nl.d; pt = nl.p; } if (!best || d < best.d) best = { d: d, q: pt, f: f }; } }
      if (best && best.d <= r * cellM) break;
    }
    return best;
  }
  function nearCov(p) {
    var pk = pkAt(p[0], p[1]), T = terrSync(pk); if (!T || !T.cov) return null; var a = pk.a, W = T.W, H = T.H, c0 = Math.floor((p[1] - a.w) / (a.e - a.w) * W), r0 = Math.floor((a.n - p[0]) / (a.n - a.s) * H);
    for (var rad = 0; rad < Math.max(W, H); rad++) { var bi = -1, bd = Infinity;
      for (var r = r0 - rad; r <= r0 + rad; r++) { if (r < 0 || r >= H) continue; var step = Math.abs(r - r0) === rad ? 1 : 2 * rad; for (var c = c0 - rad; c <= c0 + rad; c += step || 1) { if (c < 0 || c >= W) continue; if (T.cov[r * W + c]) { var d = (r - r0) * (r - r0) + (c - c0) * (c - c0); if (d < bd) { bd = d; bi = r * W + c; } } } }
      if (bi >= 0) { var rr = (bi / W) | 0, cc = bi - rr * W, q = [a.n - (rr + 0.5) / H * (a.n - a.s), a.w + (cc + 0.5) / W * (a.e - a.w)]; return { d: dist(p, q), q: q, f: { k: 'cov' } }; } }
    return null;
  }
  function walk(a, b) {
    var d = dist(a, b), n = Math.max(2, Math.min(300, Math.ceil(d / 50))), tm = 0, up = 0, prev = elev(a[0], a[1]);
    for (var i = 1; i <= n; i++) { var la = a[0] + (b[0] - a[0]) * i / n, lo = a[1] + (b[1] - a[1]) * i / n, z = elev(la, lo), seg = d / n, sl = prev != null && z != null ? (z - prev) / seg : 0; if (prev != null && z != null && z > prev) up += z - prev; tm += seg / 1000 / tobler(sl) * 60; prev = z; }
    return { min: tm * 1.25, up: up };
  }
  function arrowSvg(rot) { return '<svg viewBox="0 0 40 40" style="transform:rotate(' + rot + 'deg)"><path d="M20 3 L30 30 L20 24 L10 30 Z" fill="#B08A3E" stroke="#5C4415" stroke-width="1.2" stroke-linejoin="round"/></svg>'; }
  function update(force) {
    if (!POS) return; var now = Date.now(); if (!force && now - LASTU < 1500) { if (!update._t) update._t = setTimeout(function () { update._t = null; update(true); }, 1600 - (now - LASTU)); return; } LASTU = now;
    var ll = [POS.lat, POS.lon];
    if (!G.me) G.me = L.marker(ll, { icon: meIcon(), interactive: false, zIndexOffset: 1000 }).addTo(map); else G.me.setLatLng(ll);
    if (G.acc) map.removeLayer(G.acc); G.acc = POS.acc ? L.circle(ll, { radius: POS.acc, color: '#1A73E8', weight: 1, fillOpacity: .08, interactive: false }).addTo(map) : null;
    if (!ACT.length) return;
    var here0 = pkAt(POS.lat, POS.lon), np = here0 || ACT[0]; if (np !== PK) { PK = np; terr(PK); weatherCard(); }
    var u = SH.toUTM(POS.lat, POS.lon), z = elev(POS.lat, POS.lon);
    $('#smPos').innerHTML = '<small>' + (POS.plan ? (POS.centre ? t('Centre of the saved area (start the GPS to see your real position)', 'مركز المنطقة المحفوظة (شغّل تحديد الموقع لترى موقعك الحقيقي)') : t('Point chosen on the map', 'نقطة مختارة على الخريطة')) : t('Your position', 'موقعك')) + '</small>' +
      '<b class="big">' + POS.lat.toFixed(5) + '°N  ' + POS.lon.toFixed(5) + '°E</b><small style="direction:ltr;unicode-bidi:isolate">UTM ' + u.zone + u.band + '  ' + Math.round(u.E) + ' E  ' + Math.round(u.N) + ' N</small>' +
      '<small>' + (POS.acc ? t('Accuracy ± ', 'الدقة ± ') + Math.round(POS.acc) + t(' m', ' م') + ' · ' : '') + (z != null ? t('Height ', 'الارتفاع ') + z + t(' m above sea level', ' م فوق سطح البحر') : '') + (here0 ? '' : ' · <b style="color:#C0392B">' + t('Outside the saved areas — the map and the distances may miss nearer places.', 'خارج المناطق المحفوظة — قد تفوت الخريطة والمسافات أماكن أقرب.') + '</b>') + '</small>';
    NR = NEED.map(function (nd) { var b = nearest(nd[3], ll); return b ? { id: nd[0], h: AR ? nd[2] : nd[1], b: b } : null; }).filter(Boolean);
    var cv = nearCov(ll); if (cv) NR.push({ id: 'cov', h: t('Likely phone signal (sight of a mast)', 'إشارة هاتف محتملة (رؤية برج)'), b: cv });
    if (NET.length) { var bn = null; NET.forEach(function (q) { var d = dist(ll, q); if (!bn || d < bn.d) bn = { d: d, q: [q[0], q[1]], f: { k: 'net', t: q[2] } }; }); NR.push({ id: 'net', h: t('Where you last had internet', 'حيث كان لديك إنترنت آخر مرة'), b: bn }); }
    if (TRK.length) NR.push({ id: 'start', h: t('Back to where you started', 'العودة إلى نقطة البداية'), b: { d: dist(ll, TRK[0]), q: [TRK[0][0], TRK[0][1]], f: { k: 'start' } } });
    NR.forEach(function (x) { x.br = brg(ll, x.b.q); x.w = walk(ll, x.b.q); });
    $('#smNear').innerHTML = NR.map(function (x, i) { var f = x.b.f, nm = /^(start|cov|net)$/.test(f.k) ? '' : nmOf(f), sub = f.k === 'start' ? '' : f.k === 'cov' ? t('line of sight to a mapped mast — not a guarantee', 'خط نظر إلى برج مرسوم — ليس ضماناً') : f.k === 'net' ? new Date(f.t).toLocaleString(AR ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : K[f.k][AR ? 1 : 0] + (f.x ? t(' · seasonal, may be dry', ' · موسمي وقد يكون جافاً') : '');
      return '<div class="sm-nc" aria-pressed="' + (SEL === x.id) + '"><span class="ar" data-i="' + i + '" data-ar="' + i + '">' + arrowSvg(0) + '</span><span><h4>' + E(x.h) + '</h4><b>' + km(x.b.d) + ' · ' + compass8(x.br) + ' <bdi dir="ltr">' + Math.round(x.br) + '°</bdi></b><small>' + E(nm ? nm + ' · ' : '') + E(sub) + (sub ? '<br>' : '') + t('Walk about ', 'مشياً نحو ') + hm(x.w.min) + (x.w.up > 20 ? t(' · climb ', ' · صعود ') + Math.round(x.w.up) + t(' m', ' م') : '') + '</small><span class="go"><button class="btn btn-line btn-xs" type="button" data-go="' + i + '" data-m="car">' + t('By car', 'بالسيارة') + '</button><button class="btn btn-line btn-xs" type="button" data-go="' + i + '" data-m="walk">' + t('On foot', 'مشياً') + '</button></span></span></div>'; }).join('') ||
      '<p class="xsmall muted">' + t('No mapped water, villages or roads in the saved areas.', 'لا توجد مياه أو قرى أو طرق مرسومة في المناطق المحفوظة.') + '</p>';
    $('#smNearN').textContent = t('Distances are in a straight line; the walking time follows the slope and adds a quarter for the winding of real paths. Tap the arrow to see the line on the map, or “By car” / “On foot” for a route.', 'المسافات بخط مستقيم؛ ويتبع زمن المشي الانحدار ويضيف الربع لتعرج المسارات. انقر السهم لترى الخط على الخريطة، أو «بالسيارة» / «مشياً» لمسار.');
    arrows(); here(); selLine(); status(); if (MARKS.length && force) drawMarks();
  }
  function arrows() { NR.forEach(function (x, i) { var el = document.querySelector('[data-ar="' + i + '"] svg'); if (el) el.style.transform = 'rotate(' + Math.round(x.br - (HEAD || 0)) + 'deg)'; }); }
  function selLine() { var x = NR.filter(function (q) { return q.id === SEL; })[0]; G.sel.setLatLngs(x && POS ? [[POS.lat, POS.lon], x.b.q] : []); }
  $('#smNear').addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { var y = NR[+g.getAttribute('data-go')]; setMode(g.getAttribute('data-m')); routeTo(y.b.q, nmOf(y.b.f) || y.h); return; }
    var b = e.target.closest('[data-i]'); if (!b) return; var x = NR[+b.getAttribute('data-i')]; SEL = SEL === x.id ? null : x.id; selLine(); if (SEL) map.fitBounds(L.latLngBounds([[POS.lat, POS.lon], x.b.q]).pad(0.3), { maxZoom: 16 }); update(true);
  });

  /* ---------------------------------------------------------------- the ground where you stand */
  function borderKm(p) { var o = OUTLINE || (ACT.filter(function (q) { return q.border; })[0] || {}).border; if (!o) return null; return nearLine(p, o).d / 1000; }
  function snowAt(pk, p) { var S = pk && pk.snow; if (!S) return null; var a = pk.a, c = Math.floor((p[1] - a.w) / (a.e - a.w) * S.W), r = Math.floor((a.n - p[0]) / (a.n - a.s) * S.H); if (c < 0 || r < 0 || c >= S.W || r >= S.H) return null; var i = r * S.W + c; return { now: S.last ? S.last[i] : 0, n: S.cnt[i], of: S.n, dates: S.dates }; }
  function here() {
    var p = [POS.lat, POS.lon], C = [], add = function (lv, h, s) { C.push('<div class="sm-hz ' + lv + '"><h4>' + h + '</h4><p>' + s + '</p></div>'); }, pk = pkAt(p[0], p[1]), wx = (pk || PK || {}).wx, T = terrSync(pk), i = cellOf(p[0], p[1], pk);
    if (T && i >= 0) {
      var W = T.W, r0 = (i / W) | 0, c0 = i - r0 * W, z0 = T.z[i], sMax = 0, cat = 0, cx = 111320 * (pk.a.e - pk.a.w) / W * Math.cos(SH.rad(p[0])), rad = Math.max(1, Math.round(200 / cx)), rch = Math.max(1, Math.round(70 / cx));
      for (var dr = -rad; dr <= rad; dr++) for (var dc = -rad; dc <= rad; dc++) { var r = r0 + dr, c = c0 + dc; if (r < 0 || c < 0 || r >= T.H || c >= W) continue; var j = r * W + c;
        if (T.z[j] > z0 + 5 && T.slope[j] > sMax) sMax = T.slope[j]; if (Math.abs(dr) <= rch && Math.abs(dc) <= rch && T.z[j] <= z0 + 3 && T.acc[j] > cat) cat = T.acc[j]; }
      var s0 = T.slope[i], wet = wx && (wx.r7 >= 20 || (wx.sm != null && wx.sm >= 0.3));
      add(s0 >= 35 ? 'hi' : s0 >= 25 ? 'mid' : 'ok', t('Slope here ', 'الانحدار هنا ') + s0 + '°', s0 >= 35 ? t('Very steep ground: risk of falling and of loose rock. Move to gentler ground before resting.', 'أرض شديدة الانحدار جداً: خطر سقوط وصخور مفككة. انتقل إلى أرض ألطف قبل الاستراحة.') : s0 >= 25 ? t('Steep ground: keep three points of contact and avoid loose scree.', 'أرض منحدرة: حافظ على ثلاث نقاط تماس وتجنب الحطام المفكك.') : t('Gentle ground.', 'أرض لطيفة الانحدار.'));
      add(sMax >= 35 ? (wet ? 'hi' : 'mid') : 'ok', t('Slopes above you', 'المنحدرات فوقك'), sMax >= 35 ? t('Slopes of ', 'منحدرات بزاوية ') + sMax + t('° rise within 200 m above you: rockfall and small slides are possible', '° ترتفع ضمن 200 م فوقك: سقوط صخور وانزلاقات صغيرة محتملة') + (wet ? t(', more so after the recent rain.', '، وأكثر بعد الأمطار الأخيرة.') : '.') + t(' Do not camp or rest at the foot of cliffs.', ' لا تخيّم ولا تسترح عند أقدام الجروف.') : t('No very steep slope directly above you.', 'لا يوجد منحدر شديد جداً فوقك مباشرة.'));
      add(cat >= 10 ? 'hi' : cat >= 0.5 ? 'mid' : 'ok', t('Stream beds', 'بطون الوديان'), cat >= 0.5 ? t('You are in or beside a stream bed that drains ', 'أنت في بطن وادٍ أو بجانبه يصرّف ') + F(cat, cat < 10 ? 1 : 0) + t(' km². Rain upstream can bring a flash flood within minutes, even under a clear sky. Never camp in it; climb to the bank if the water rises or turns muddy.', ' كم². المطر في أعلى الوادي قد يجلب سيلاً خلال دقائق حتى مع سماء صافية. لا تخيّم فيه أبداً، واصعد إلى الضفة إن ارتفع الماء أو تعكّر.') : t('Not in a mapped stream bed.', 'لستَ في بطن وادٍ مرسوم.'));
      if (T.cov) add(T.cov[i] ? 'ok' : 'info', t('Phone signal', 'إشارة الهاتف'), T.cov[i] ? t('A mapped mast can be seen from here: a call or SMS is likely to get through.', 'يُرى من هنا برج مرسوم: الاتصال أو الرسالة على الأرجح يصلان.') : t('No mapped mast in sight from here. Climb to higher, open ground or follow the “likely phone signal” arrow.', 'لا يُرى من هنا أي برج مرسوم. اصعد إلى أرض أعلى ومكشوفة أو اتبع سهم «إشارة هاتف محتملة».'));
    } else add('mid', t('Ground', 'الأرض'), pk ? t('Reading the elevation model of this area…', 'جارٍ قراءة نموذج الارتفاع لهذه المنطقة…') : t('Outside the saved areas.', 'خارج المناطق المحفوظة.'));
    var sn = snowAt(pk, p), sd = wx && wx.sd;
    if (sn || (sd != null && sd > 0)) add(sn && sn.now ? 'hi' : sn && sn.n ? 'mid' : 'ok', t('Snow', 'الثلج'), (sn ? (sn.now ? t('Snow covered this place in the latest 8-day satellite view (from ', 'غطى الثلج هذا المكان في آخر صورة فضائية لثمانية أيام (من ') + E(sn.dates[0]) + ').' : sn.n ? t('Snow lay here in ', 'كان الثلج هنا في ') + sn.n + t(' of the last ', ' من آخر ') + sn.of + t(' 8-day periods.', ' فترات من ثمانية أيام.') : t('No snow seen here in the last weeks.', 'لم يُرَ ثلج هنا في الأسابيع الأخيرة.')) : '') + (sd != null && sd > 0 ? t(' Snow depth near the centre of the area at saving: ', ' عمق الثلج قرب مركز المنطقة وقت الحفظ: ') + F(sd * 100, 0) + t(' cm.', ' سم.') : '') + (sn && (sn.now || sn.n) ? t(' Expect ice on tracks, closed passes and very cold nights.', ' توقّع جليداً على الدروب وممرات مغلقة وليالي شديدة البرودة.') : ''));
    if (wx) { var lv = wx.r7 >= 40 || (wx.sm != null && wx.sm >= 0.35) ? 'hi' : wx.r7 >= 10 || (wx.sm != null && wx.sm >= 0.25) ? 'mid' : 'ok';
      add(lv, t('Recent rain and wet soil', 'الأمطار الأخيرة ورطوبة التربة'), t('Rain in the 7 days before saving: ', 'المطر في الأيام السبعة قبل الحفظ: ') + F(wx.r7, 0) + t(' mm (', ' ملم (') + F(wx.r3, 0) + t(' mm in the last 3 days)', ' ملم في آخر 3 أيام)') + (wx.sm != null ? t('; topsoil water ', '؛ ماء التربة السطحية ') + F(wx.sm * 100, 0) + '% ' + (wx.sm >= 0.3 ? t('(wet: mud, slippery clay slopes, slides more likely)', '(رطبة: طين ومنحدرات طينية زلقة واحتمال أكبر للانزلاق)') : wx.sm >= 0.2 ? t('(moist)', '(رطبة قليلاً)') : t('(dry)', '(جافة)')) : '') + t('. Read on ', '. قُرئت في ') + new Date(wx.at).toLocaleDateString(AR ? 'ar-IQ' : 'en-GB') + t('; it does not update without internet.', '؛ ولا تتحدث من دون إنترنت.')); }
    var bk = borderKm(p); if (bk != null && bk <= 15) add('hi', t('Border strip: mines', 'الشريط الحدودي: الألغام'), t('You are ', 'أنت على بعد ') + F(bk, 1) + t(' km from an international border. Mines and unexploded ordnance remain in parts of these areas. Keep to used roads and paths, never pick up metal objects, and ask local people before leaving the track.', ' كم من حدود دولية. ما زالت الألغام والمقذوفات غير المنفجرة في أجزاء من هذه المناطق. التزم بالطرق والمسارات المطروقة، ولا تلتقط أي جسم معدني، واسأل السكان المحليين قبل ترك الطريق.'));
    var s = sun(p[0], p[1], new Date()); if (s) { var left = (s.set - Date.now()) / 60000; add(left < 60 && left > 0 ? 'mid' : left <= 0 ? 'hi' : 'ok', t('Daylight', 'ضوء النهار'), t('Sunrise ', 'الشروق ') + hhmm(s.rise) + t(' · sunset ', ' · الغروب ') + hhmm(s.set) + (left > 0 ? t(' · daylight left ', ' · الضوء المتبقي ') + hm(left) + (left < 90 ? t('. Start back now: it is dark about 30 minutes after sunset.', '. ابدأ العودة الآن: يحلّ الظلام بعد الغروب بنحو 30 دقيقة.') : '') : t(' · the sun has set.', ' · غربت الشمس.'))); }
    $('#smHere').innerHTML = C.join('');
  }
  function weatherCard() {
    var wx = PK && PK.wx; if (!wx) { $('#smWx').innerHTML = '<p class="xsmall muted">' + t('Not saved with this area.', 'لم تُحفظ مع هذه المنطقة.') + '</p>'; return; }
    var today = new Date().toISOString().slice(0, 10), hasS = wx.days.some(function (d) { return d.sf != null; });
    $('#smWx').innerHTML = '<p class="xsmall muted" style="margin:0 0 6px">' + E(PK.name) + t(' · saved ', ' · حُفظت ') + new Date(wx.at).toLocaleString(AR ? 'ar-IQ' : 'en-GB') + t('. The forecast days are a forecast made then.', '. أيام التوقع هي توقع صدر وقتها.') + (wx.sd != null ? t(' Snow on the ground then: ', ' الثلج على الأرض وقتها: ') + F(wx.sd * 100, 0) + t(' cm.', ' سم.') : '') + (PK.snow ? t(' Snow cover in the latest satellite view: ', ' الغطاء الثلجي في آخر صورة فضائية: ') + F(PK.snow.frac * 100, 0) + t(' % of the area.', ' % من المنطقة.') : '') + '</p><table class="sm-tbl"><tr><th>' + t('Day', 'اليوم') + '</th><th>' + t('Rain (mm)', 'المطر (ملم)') + '</th>' + (hasS ? '<th>' + t('Snow (cm)', 'الثلج (سم)') + '</th>' : '') + '<th>' + t('Max / min (°C)', 'العظمى / الصغرى (°م)') + '</th></tr>' +
      wx.days.map(function (d) { var fut = d.d >= today; return '<tr' + (d.d === today ? ' style="font-weight:700"' : '') + '><td>' + new Date(d.d + 'T12:00').toLocaleDateString(AR ? 'ar-IQ' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + (fut ? ' <small class="muted">' + t('forecast', 'توقع') + '</small>' : '') + '</td><td>' + (d.p == null ? '—' : F(d.p, 1)) + '</td>' + (hasS ? '<td>' + (d.sf == null ? '—' : F(d.sf, 1)) + '</td>' : '') + '<td>' + (d.tx == null ? '—' : F(d.tx, 0) + ' / ' + F(d.tn, 0)) + '</td></tr>'; }).join('') + '</table>';
  }
  function season() {
    var m = new Date().getMonth() + 1, z = Math.max.apply(null, ACT.map(function (q) { return q.zr ? q.zr[1] : q.t ? q.t.zmax : 0; }).concat([0])), L0 = [];
    L0.push(t('Water: carry at least 3 litres a person; treat spring and stream water (boil, filter or tablets) — villages and herds are often upstream.', 'الماء: احمل 3 لترات للشخص على الأقل، وعالج ماء العيون والجداول (غلي أو فلتر أو أقراص) — فكثيراً ما تكون القرى والقطعان في أعلى المجرى.'));
    if (m >= 4 && m <= 10) L0.push(t('Snakes and scorpions are active: watch where you put hands and feet, shake out boots, do not lift stones with bare hands.', 'الأفاعي والعقارب نشطة: انتبه أين تضع يديك وقدميك، وانفض الحذاء، ولا ترفع الحجارة بيد عارية.'));
    if (m >= 6 && m <= 9) L0.push(t('Heat: work early and late, rest in shade at midday, and watch for heat exhaustion (headache, nausea, no sweating).', 'الحر: اعمل مبكراً ومتأخراً، واسترح في الظل وقت الظهيرة، وانتبه للإنهاك الحراري (صداع وغثيان وتوقف التعرق).'));
    if (m >= 11 || m <= 4) L0.push(t('Rain season: flash floods in valleys and slides on wet clay and marl slopes; days are short.', 'موسم الأمطار: سيول في الوديان وانزلاقات على المنحدرات الطينية والمارلية الرطبة، والنهار قصير.'));
    if ((m >= 11 || m <= 4) && z > 1400) L0.push(t('Snow and ice above about 1,500 m; passes and tracks may be closed and nights below freezing. Check the snow layer before going up.', 'ثلج وجليد فوق نحو 1500 م؛ قد تُغلق الممرات والدروب وتنزل الحرارة ليلاً تحت الصفر. راجع طبقة الثلج قبل الصعود.'));
    L0.push(t('Dogs guard herds and villages: do not run; stop, stand still and call for the shepherd.', 'الكلاب تحرس القطعان والقرى: لا تركض، توقف وقف ثابتاً ونادِ على الراعي.'));
    L0.push(t('Wild boar live in the oak forests of the mountains; give them room, especially females with young.', 'تعيش الخنازير البرية في غابات البلوط الجبلية؛ أفسح لها الطريق، خاصة الإناث مع صغارها.'));
    L0.push(t('Caves: bats can carry rabies; do not touch them, and do not enter caves without a light, a partner and a time to come out.', 'الكهوف: قد تحمل الخفافيش داء الكلب، فلا تلمسها، ولا تدخل الكهوف من دون ضوء ورفيق ووقت محدد للخروج.'));
    L0.push(t('Team: agree a meeting point and a return time, leave the route with someone who stays behind, and keep phones charged with a power bank.', 'الفريق: اتفقوا على نقطة لقاء ووقت عودة، واتركوا المسار مع شخص يبقى، وأبقوا الهواتف مشحونة بشاحن متنقل.'));
    L0.push(t('Mapped animal danger does not exist: these are general cautions for the season, not places on the map.', 'لا توجد خرائط لخطر الحيوانات: هذه تحذيرات عامة للموسم وليست أماكن على الخريطة.'));
    $('#smSeason').innerHTML = '<ul class="sm-season">' + L0.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  }

  /* ---------------------------------------------------------------- sharing the position (SMS uses the phone network) */
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
    var on = navigator.onLine !== false, nT = ACT.length;
    $('#smStat').innerHTML = '<span class="' + (on ? 'on' : 'off') + '">' + (on ? t('Online', 'متصل بالإنترنت') : t('Offline — using the saved areas', 'دون إنترنت — تُستخدم المناطق المحفوظة')) + '</span>' +
      (nT ? '<span>' + nT + (nT > 1 ? t(' saved squares on the map', ' مربعات محفوظة على الخريطة') : t(' saved area on the map', ' منطقة محفوظة على الخريطة')) + '</span>' : '<span>' + t('No area shown', 'لا توجد منطقة معروضة') + '</span>') +
      (PK ? '<span>' + E(PK.name) + '</span>' : '') + '<span>' + (WATCH != null ? t('GPS on', 'تحديد الموقع يعمل') : t('GPS off', 'تحديد الموقع متوقف')) + '</span>' + (REC ? '<span class="off">' + t('Recording path · ', 'تسجيل المسار · ') + TRK.length + '</span>' : '');
  }
  window.addEventListener('online', function () { status(); overlays(); }); window.addEventListener('offline', function () { status(); overlays(); });

  /* ---------------------------------------------------------------- map sheet and exports */
  function sheet() {
    if (!PK || !P) return; var pk = PK, a = pk.a; terr(pk).then(function (T) {
      var W = T ? T.W : 900, H = T ? T.H : 900, k = Math.min(2, 1400 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
      var vec = document.createElement('canvas'); vec.width = W; vec.height = H; var g = vec.getContext('2d'), X = function (lo) { return (lo - a.w) / (a.e - a.w) * W; }, Y = function (la) { return (a.n - la) / (a.n - a.s) * H; };
      var lw = Math.max(1, W / 900), fs = query(a.s, a.w, a.n, a.e, function (f) { return ON[f.k]; });
      var line = function (pts, col, w, dash) { g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(X(q[1]), Y(q[0])); else g.moveTo(X(q[1]), Y(q[0])); }); g.strokeStyle = col; g.lineWidth = w * lw; g.setLineDash(dash ? dash.map(function (v) { return v * lw; }) : []); g.stroke(); };
      LORD.filter(function (kk) { return kk !== 'rdr'; }).forEach(function (kk) { fs.forEach(function (f) { if (f.k !== kk || !f.g) return; if (kk === 'lak') { g.beginPath(); f.g.forEach(function (q, i) { if (i) g.lineTo(X(q[1]), Y(q[0])); else g.moveTo(X(q[1]), Y(q[0])); }); g.fillStyle = '#9CD2F2'; g.fill(); }
        line(f.g, K[kk][2], { riv: 2.4, str: 1.1, lak: 1.2, rdM: 2.8, rdm: 2, trk: 1.4, pth: 1 }[kk], kk === 'trk' ? [5, 3] : kk === 'pth' ? [2, 3] : kk === 'str' && f.x ? [3, 3] : null); }); });
      g.setLineDash([]); if (ON.tr && TRK.length > 1) line(TRK, '#E4007C', 2.6);
      var lbl = [];
      PORD.forEach(function (kk) { fs.forEach(function (f) { if (f.k !== kk || !f.p || kk === 'ham') return; var x = X(f.p[1]), y = Y(f.p[0]); sym(g, kk, x, y, 9 * lw, true);
        var nm = kk === 'twn' || kk === 'vil' ? (f.ne || f.n || '') : ''; if (nm && /^[\x00-\x7F]+$/.test(nm)) lbl.push([nm, x + 7 * lw, y + 4 * lw, kk === 'twn' ? 15 : 11]); }); });
      var boxes = []; lbl.sort(function (p1, p2) { return p2[3] - p1[3]; }).forEach(function (q) { var w2 = P.tw(g, q[0], q[3] * lw, 700), b = [q[1], q[2] - q[3] * lw, q[1] + w2, q[2] + 3 * lw]; if (b[2] > W || boxes.some(function (o) { return !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]); })) return; boxes.push(b); P.txt(g, q[0], q[1], q[2], q[3] * lw, 700, '#1D2731', 'left', true); });
      MARKS.forEach(function (m0) { if (m0.lat < a.s || m0.lat > a.n || m0.lon < a.w || m0.lon > a.e) return; sym(g, 'mk', X(m0.lon), Y(m0.lat), 14 * lw); });
      if (POS) { var px = X(POS.lon), py = Y(POS.lat); g.beginPath(); g.arc(px, py, 7 * lw, 0, 7); g.fillStyle = '#1A73E8'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5 * lw; g.stroke(); }
      var im = pk.img || (pk.t && pk.t.img) || {}, ld = function (b) { return b ? createImageBitmap(b).catch(function () { return null; }) : Promise.resolve(null); };
      return Promise.all([ld(ON.hs && im.hs), ld(ON.hz && im.hz), ld(ON.ch && im.ch), ld(ON.cv && im.cv), ld(ON.sn && im.sn)]).then(function (I) {
        var cnt = {}; fs.forEach(function (f) { cnt[f.k] = (cnt[f.k] || 0) + 1; });
        var leg = [['River / stream', '#1F6FB8'], ['Main road', '#D9622B'], ['Dirt track', '#8C6239'], ['Town / village', '#3C4A57'], ['Spring / well', '#0B8FB0'], ['Clinic', '#C0392B'], ['Mast', '#8E44AD'], ['Slope 25–35°', '#F5B566'], ['Slope > 35°', '#D9706D'], ['Stream bed (flash flood)', '#2878DC']];
        if (I[3]) leg.push(['Likely phone signal', '#C9A9E6']); if (I[4]) leg.push(['Snow (recent weeks)', '#9FE3FA']); if (MARKS.length) leg.push(['My landmark', '#D4A017']); if (TRK.length > 1) leg.push(['My path', '#E4007C']);
        P.sheet($('#smCv'), { a: a, title: pk.en || pk.name, sub: 'Offline field map · saved ' + pk.at.slice(0, 10) + ' · ' + pk.size + ' × ' + pk.size + ' km', layers: [I[0], I[1], I[2], I[3], I[4], vec], legend: leg,
          stats: 'Springs and wells ' + ((cnt.spr || 0) + (cnt.wel || 0)) + ' · villages ' + ((cnt.vil || 0) + (cnt.ham || 0) + (cnt.twn || 0)) + ' · clinics ' + (cnt.med || 0) + ' · masts ' + (cnt.tow || 0) + (pk.zr ? ' · elevation ' + pk.zr[0] + '–' + pk.zr[1] + ' m' : '') });
        $('#smCap').textContent = t('The saved area where you are. Relief shading, slopes and stream beds from the 30 m elevation model; water, villages, roads, services and masts from the open map database; recent snow from the MODIS 8-day snow maps; all at the time of saving.', 'المنطقة المحفوظة التي أنت فيها. تظليل التضاريس والمنحدرات وبطون الوديان من نموذج الارتفاع بدقة 30 م؛ والمياه والقرى والطرق والخدمات والأبراج من قاعدة بيانات الخريطة المفتوحة؛ والثلج الأخير من خرائط الثلج لثمانية أيام من MODIS؛ وكلها وقت الحفظ.');
      });
    });
  }
  $('#fsm1') && new IntersectionObserver(function (en) { if (en[0].isIntersecting) sheet(); }).observe($('#fsm1'));
  $$('[data-cv]').forEach(function (b) { b.addEventListener('click', function () { if (!PK) return; sheet(); setTimeout(function () { SH.exportCanvas($('#smCv'), 'shandal-offline-map-' + (PK.en || PK.name).replace(/[^\w؀-ۿ-]+/g, '-'), b.getAttribute('data-fmt')); }, 700); }); });
  $('#smGpx').addEventListener('click', function () {
    var wp = NR.map(function (x) { return '<wpt lat="' + x.b.q[0] + '" lon="' + x.b.q[1] + '"><name>' + E(x.h + (nmOf(x.b.f) ? ': ' + nmOf(x.b.f) : '')) + '</name></wpt>'; }).concat(MARKS.map(function (m) { return '<wpt lat="' + m.lat + '" lon="' + m.lon + '"><name>' + E(m.name) + '</name><type>landmark</type></wpt>'; })).join('');
    var tr = TRK.length ? '<trk><name>My path</name><trkseg>' + TRK.map(function (q) { return '<trkpt lat="' + q[0] + '" lon="' + q[1] + '">' + (q[3] != null ? '<ele>' + q[3] + '</ele>' : '') + '<time>' + new Date(q[2]).toISOString() + '</time></trkpt>'; }).join('') + '</trkseg></trk>' : '';
    var rt = ROUTE && ROUTE.line ? '<rte><name>' + E(ROUTE.name) + '</name>' + ROUTE.line.getLatLngs().map(function (q) { return '<rtept lat="' + q.lat.toFixed(5) + '" lon="' + q.lng.toFixed(5) + '"/>'; }).join('') + '</rte>' : '';
    SH.download('shandal-offline.gpx', '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Shandal System" xmlns="http://www.topografix.com/GPX/1/1">' + wp + rt + tr + '</gpx>', 'application/gpx+xml');
  });
  $('#smCsv').addEventListener('click', function () { SH.csv('shandal-offline-nearest.csv', [['need', 'name', 'kind', 'lat', 'lon', 'distance_m', 'bearing_deg', 'walk_min', 'climb_m']].concat(NR.map(function (x) { return [x.h, nmOf(x.b.f), K[x.b.f.k] ? K[x.b.f.k][0] : x.b.f.k, x.b.q[0].toFixed(5), x.b.q[1].toFixed(5), Math.round(x.b.d), Math.round(x.br), Math.round(x.w.min), Math.round(x.w.up)]; }), MARKS.map(function (m) { return ['landmark', m.name, 'landmark', m.lat, m.lon, POS ? Math.round(dist([POS.lat, POS.lon], [m.lat, m.lon])) : '', '', '', '']; }))); });

  /* ---------------------------------------------------------------- keep this page and its files for offline use */
  function warm() {
    if (!window.caches || navigator.onLine === false) return Promise.resolve();
    var page = location.href.split('#')[0], files = performance.getEntriesByType('resource').map(function (e) { return e.name; }).filter(function (u) { return u.indexOf(location.origin + '/') === 0 && u.indexOf('/assets/') > 0; });
    return Promise.all([caches.open('shandal-v1-pages').then(function (c) { return c.add(page); }), caches.open('shandal-v1-static').then(function (c) { return Promise.all(files.map(function (u) { return c.add(u).catch(function () {}); })); })]).catch(function () {});
  }
  setTimeout(warm, 4000);

  /* ---------------------------------------------------------------- start: reopen what was shown, even offline */
  status(); resumeBtn(); estimate();
  Promise.all([dbGet('tracks', 'all'), dbAll('marks'), dbGet('net', 'all')]).then(function (r) {
    TRK = (r[0] && r[0].p) || []; G.trk.setLatLngs(TRK.map(function (q) { return [q[0], q[1]]; })); MARKS = r[1] || []; drawMarks(); NET = (r[2] && r[2].p) || []; drawNet();
  }).catch(function () {});
  listPacks().then(function () {
    var ids = []; try { ids = JSON.parse(lsGet('shandal_sm_open') || '[]'); } catch (e) {} var last = lsGet('shandal_sm_last'); if (!ids.length && last) ids = [last];
    ids = ids.filter(function (id) { return PACKS.some(function (p) { return p.id === id; }); }); if (!ids.length && PACKS.length && navigator.onLine === false) ids = PACKS.map(function (p) { return p.id; });
    if (ids.length) showMany(ids, true).then(function () { if (innerWidth < 900 && location.hash !== '#plan') $('#smStat').scrollIntoView({ block: 'start' }); });
  });
})();
