/* Automatic geological cross-section — topographic profile from the elevation model, geological units cut by the line
   (one source map kept along the line where possible, exact contacts from the unit polygons), strike-and-dip measurements
   projected onto the section with their apparent dip, and a layer-cake subsurface constructed from the contacts
   (beds dip towards the younger unit; going down each vertical, crossing a contact passes into the unit beneath it).
   The last section is kept on the device and redrawn offline. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, AR = SH.lang === 'ar', API = 'https://macrostrat.org/api/v2/', NS = 600;
  var IDS = ['xsA', 'xsB', 'xsBuf', 'xsDef', 'xsSrc', 'xsVE', 'xsDep'], persist = SH.persist('geosection', IDS);
  var map = SH.map('xsMap', { center: [34.6, 44.2], zoom: 6 }), L = window.L, lay = map ? L.layerGroup().addTo(map) : null, clicks = [], quiet = false, busy = false, last = SH.store.get('shandal_xs_last', null), RES = null;
  function hush(fn) { quiet = true; try { fn(); } finally { quiet = false; } }
  var MS = G.rows($('#xsMeas'), 'shandal_xs_meas', [{ k: 'lat', h: 'lat' }, { k: 'lon', h: 'lon' }, { k: 'dd', h: t('Dip dir.', 'اتجاه الميل'), w: '62px' }, { k: 'dip', h: t('Dip', 'الميل'), w: '52px' }, { k: 'ty', h: t('Type', 'النوع'), type: 'select', w: '78px', opts: [['S0', t('Bed', 'تطبق')], ['F', t('Fault', 'فالق')]] }], [], function () { if (!quiet) later(function () { mapDraw(); redraw(); }, 350); });
  var UN = G.rows($('#xsUnits'), 'shandal_xs_units', [{ k: 'a', h: t('From km', 'من كم'), w: '66px' }, { k: 'b', h: t('To km', 'إلى كم'), w: '66px' }, { k: 'n', h: t('Unit', 'الوحدة'), type: 'text' }, { k: 'age', h: t('Age Ma', 'العمر م.س'), w: '66px' }, { k: 'c', h: t('Colour', 'اللون'), type: 'color', w: '50px' }], [], function () { if (!quiet) later(redraw, 350); });
  var tm = null; function later(fn, ms) { clearTimeout(tm); tm = setTimeout(fn, ms); }
  var data = function (j) { return j && j.success ? j.success.data : j && j.data || j; };

  /* ---------------------------------------------------------------- line geometry */
  function pll(s) { var m = String(s || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/٫/g, '.').match(/-?\d+(?:\.\d+)?/g); if (!m || m.length < 2) return null; var a = +m[0], b = +m[1]; return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null; }
  function geom() {
    var A = pll($('#xsA').value), B = pll($('#xsB').value); if (!A || !B) return null;
    var mpd = SH.dem.metersPerDeg((A[0] + B[0]) / 2), vx = (B[1] - A[1]) * mpd.x, vy = (B[0] - A[0]) * mpd.y, Lm = Math.hypot(vx, vy); if (Lm < 50) return null;
    var ux = vx / Lm, uy = vy / Lm, az = (Math.atan2(ux, uy) * 180 / Math.PI + 360) % 360;
    return { A: A, B: B, L: Lm, ux: ux, uy: uy, az: az, mpd: mpd, loc: function (lat, lon) { var x = (lon - A[1]) * mpd.x, y = (lat - A[0]) * mpd.y; return { s: x * ux + y * uy, o: -x * uy + y * ux }; }, at: function (s) { var f = s / Lm; return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; } };
  }
  var CMP = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function cmp(a) { return CMP[Math.round(((a % 360) + 360) % 360 / 22.5) % 16]; }
  function lenTxt() { var g = geom(); $('#xsLen').textContent = g ? t('Length ', 'الطول ') + F(g.L / 1000, 2) + t(' km · azimuth ', ' كم · الاتجاه ') + F(g.az, 0) + '° (' + cmp(g.az + 180) + ' → ' + cmp(g.az) + ')' : ''; }

  /* ---------------------------------------------------------------- map */
  function mapDraw() {
    if (!lay) return; lay.clearLayers(); var g = geom(); lenTxt();
    if (g) { L.polyline([g.A, g.B], { color: '#C0392B', weight: 3 }).addTo(lay); [['A', g.A], ['A′', g.B]].forEach(function (q) { L.circleMarker(q[1], { radius: 6, color: '#fff', weight: 2, fillColor: '#C0392B', fillOpacity: 1 }).addTo(lay).bindTooltip(q[0], { permanent: true, direction: 'top', className: 'ltr' }); }); }
    else if (clicks.length === 1) L.circleMarker(clicks[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#C0392B', fillOpacity: 1 }).addTo(lay).bindTooltip('A', { permanent: true, direction: 'top' });
    var buf = G.v('xsBuf') || 0;
    MS.get().forEach(function (m) { if (!isFinite(m.lat) || !isFinite(m.lon)) return; var near = g ? (function (p) { return p.s >= 0 && p.s <= g.L && Math.abs(p.o) <= buf; })(g.loc(m.lat, m.lon)) : false; L.circleMarker([m.lat, m.lon], { radius: 4, color: m.ty === 'F' ? '#C0392B' : near ? '#2E8B57' : '#9AA3AB', weight: 2, fillOpacity: 0.6 }).addTo(lay).bindTooltip((m.ty === 'F' ? t('Fault ', 'فالق ') : '') + F(m.dd, 0) + '/' + F(m.dip, 0)); });
  }
  if (map) map.on('click', function (e) {
    if (busy) return; if (clicks.length >= 2 || (geom() && !clicks.length)) { clicks = []; $('#xsA').value = ''; $('#xsB').value = ''; }
    clicks.push([e.latlng.lat, e.latlng.lng]); $(clicks.length === 1 ? '#xsA' : '#xsB').value = e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5); persist.save(); mapDraw();
  });
  ['xsA', 'xsB'].forEach(function (id) { $('#' + id).addEventListener('change', function () { clicks = []; mapDraw(); var g = geom(); if (g && map) map.fitBounds([g.A, g.B], { padding: [30, 30] }); }); });
  $('#xsBuf').addEventListener('input', function () { later(function () { mapDraw(); redraw(); }, 350); });
  ['xsDef', 'xsVE', 'xsDep'].forEach(function (id) { $('#' + id).addEventListener(id === 'xsVE' ? 'change' : 'input', function () { persist.save(); later(redraw, 300); }); });

  /* ---------------------------------------------------------------- geology along the line */
  function pool(items, n, fn, onP) { var i = 0, done = 0, out = new Array(items.length); return new Promise(function (res) { if (!items.length) { res(out); return; } function next() { if (i >= items.length) return; var k = i++; Promise.resolve().then(function () { return fn(items[k]); }).then(function (v) { out[k] = v; }, function () { out[k] = null; }).then(function () { done++; if (onP) onP(done, items.length); if (done === items.length) res(out); else next(); }); } for (var j = 0; j < Math.min(n, items.length); j++) next(); }); }
  var RANK = { large: 0, medium: 1, small: 2, tiny: 3 };
  function unitsAt(p) {
    return SH.getJSON(API + 'geologic_units/map?lat=' + p[0].toFixed(5) + '&lng=' + p[1].toFixed(5), { timeout: 20000 }).then(function (j) {
      var d = data(j) || [], refs = (j && j.success && j.success.refs) || {}; if (!Array.isArray(d)) d = [d];
      return d.filter(function (u) { return u && u.map_id != null; }).map(function (u) { var ref = u.ref || (typeof refs[u.source_id] === 'object' ? refs[u.source_id] : {}) || {}, sc = u.scale || ref.scale || '';
        return { id: u.map_id, sid: u.source_id, rk: RANK[sc] != null ? RANK[sc] : 2, name: (u.name || u.strat_name || u.best_int_name || 'Unit').trim(), b: +u.b_age, tt: +u.t_age, int: u.best_int_name || u.b_int_name || '', lith: u.lith || '', col: /^#?[0-9a-f]{6}$/i.test(u.color || '') ? (u.color[0] === '#' ? u.color : '#' + u.color) : '#CFC7B4' }; });
    });
  }
  function inRing(x, y, r) { var c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function inGeom(g, lon, lat) { if (!g) return false; var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; for (var k = 0; k < polys.length; k++) { var p = polys[k]; if (p.length && inRing(lon, lat, p[0])) { var hole = false; for (var h = 1; h < p.length; h++) if (inRing(lon, lat, p[h])) { hole = true; break; } if (!hole) return true; } } return false; }
  function bbox(g) { var b = [180, 90, -180, -90]; (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(function (p) { p[0].forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); }); return b; }
  function geology(g, onP) {
    var K = Math.max(24, Math.min(64, Math.round(g.L / 400))), S = [];
    for (var k = 0; k < K; k++) S.push(g.at((k + 0.5) / K * g.L));
    return pool(S, 4, unitsAt, function (a, b) { onP(0.35 * a / b); }).then(function (R0) {
      var ok = R0.filter(function (r) { return r && r.length; }); if (!ok.length) return null;
      var cov = {}; R0.forEach(function (r) { var seen = {}; (r || []).forEach(function (u) { if (seen[u.sid]) return; seen[u.sid] = 1; cov[u.sid] = cov[u.sid] || { n: 0, rk: u.rk }; cov[u.sid].n++; cov[u.sid].rk = Math.min(cov[u.sid].rk, u.rk); }); });
      var sids = Object.keys(cov), full = sids.filter(function (s) { return cov[s].n >= 0.8 * K; }), pickS = (full.length ? full : sids).sort(function (a, b) { return full.length ? cov[a].rk - cov[b].rk || cov[b].n - cov[a].n : cov[b].n - cov[a].n || cov[a].rk - cov[b].rk; })[0];
      var coarse = R0.map(function (r) { if (!r || !r.length) return null; var s = r.filter(function (u) { return String(u.sid) === String(pickS); })[0]; return s || r.slice().sort(function (a, b) { return a.rk - b.rk; })[0]; });
      var U = {}; coarse.forEach(function (u) { if (u) U[u.id] = u; });
      var ids = Object.keys(U);
      return pool(ids, 3, function (id) { return SH.getJSON(API + 'geologic_units/map?map_id=' + id + '&format=geojson_bare', { timeout: 30000 }).then(function (gj) { var f = (gj && gj.features || [])[0] || (gj && gj.geometry ? gj : null); return f && f.geometry ? f.geometry : null; }); }, function (a, b) { onP(0.35 + 0.45 * a / b); }).then(function (geoms) {
        ids.forEach(function (id, i) { U[id].g = geoms[i]; U[id].bb = geoms[i] ? bbox(geoms[i]) : null; });
        var dense = [];
        for (var q = 0; q < NS; q++) { var s = q / (NS - 1) * g.L, p = g.at(s), ci = Math.min(K - 1, Math.max(0, Math.floor(s / g.L * K))), near = null;
          for (var d = 0; d < K && !near; d++) { if (coarse[ci - d]) near = coarse[ci - d]; else if (coarse[ci + d]) near = coarse[ci + d]; }
          var hit = null, order = [near].concat(ids.map(function (id) { return U[id]; }));
          for (var o = 0; o < order.length; o++) { var u = order[o]; if (!u || !u.g || !u.bb) continue; if (p[1] < u.bb[0] || p[1] > u.bb[2] || p[0] < u.bb[1] || p[0] > u.bb[3]) continue; if (inGeom(u.g, p[1], p[0])) { hit = u; break; } }
          dense.push(hit || near); }
        var rows = [], cur = null;
        dense.forEach(function (u, q) { var s = q / (NS - 1) * g.L / 1000, key = u ? u.name + '|' + u.b + '|' + u.tt : 'none';
          if (!cur || cur.key !== key) { if (cur) cur.b = s; cur = { key: key, a: s, b: s, n: u ? u.name : t('Unmapped', 'غير مخرَّط'), age: u && isFinite(u.b) ? Math.round(((u.b + (isFinite(u.tt) ? u.tt : u.b)) / 2) * 100) / 100 : null, c: u ? u.col : '#E5E1D8', int: u ? u.int : '', lith: u ? u.lith : '' }; rows.push(cur); } else cur.b = s; });
        rows.forEach(function (r) { r.a = Math.round(r.a * 1000) / 1000; r.b = Math.round(r.b * 1000) / 1000; delete r.key; });
        return { rows: rows, scale: cov[pickS] ? cov[pickS].rk : null, cover: cov[pickS] ? cov[pickS].n / K : 0 };
      });
    });
  }

  /* ---------------------------------------------------------------- build */
  function prog(f, msg) { $('#xsBar').style.width = Math.round(f * 100) + '%'; if (msg != null) $('#xsMsg').textContent = msg; }
  function build() {
    if (busy) return; var g = geom(); if (!g) { SH.toast(t('Tap A and A′ on the map or type their coordinates.', 'انقر A وA′ على الخريطة أو اكتب إحداثياتهما.'), 'warn'); return; }
    if (g.L > 300000) { SH.toast(t('Keep the section shorter than 300 km.', 'اجعل المقطع أقصر من 300 كم.'), 'warn'); return; }
    if (!navigator.onLine) { prog(0, t('A connection is needed to read the elevations and the map for a new line. The last section stays available.', 'يلزم اتصال لقراءة الارتفاعات والخريطة لخط جديد. ويبقى آخر مقطع متاحاً.')); return; }
    busy = true; $('#xsRun').disabled = true; persist.save(); var src = $('#xsSrc').value, pts = [];
    for (var k = 0; k < NS; k++) pts.push(g.at(k / (NS - 1) * g.L));
    prog(0.03, t('Reading the ground surface…', 'قراءة سطح الأرض…'));
    SH.dem.points(pts, { source: src, onProgress: function (a, b) { prog(0.03 + 0.3 * a / b); } }).catch(function () { return src !== 'aws' ? SH.dem.points(pts, { source: 'aws' }) : Promise.reject(new Error(t('The elevation model could not be read.', 'تعذرت قراءة نموذج الارتفاع.'))); }).then(function (z) {
      prog(0.35, t('Reading the geological map along the line…', 'قراءة الخريطة الجيولوجية على امتداد الخط…'));
      return geology(g, function (f) { prog(0.35 + 0.6 * f); }).catch(function () { return null; }).then(function (geo) {
        last = { A: g.A, B: g.B, src: src, z: z.map(function (v) { return isFinite(v) ? Math.round(v * 10) / 10 : null; }), geo: geo ? { scale: geo.scale, cover: geo.cover } : null, date: new Date().toISOString() };
        SH.store.set('shandal_xs_last', last);
        hush(function () { UN.set(geo && geo.rows.length ? geo.rows : [{ a: 0, b: Math.round(g.L) / 1000, n: t('Unit 1', 'الوحدة 1'), age: null, c: '#D9C8A0' }]); });
        prog(1, geo ? t('Done.', 'تم.') : t('Done without the geological map (no connection to it or no coverage here); enter the units in the table.', 'تم دون الخريطة الجيولوجية (لا اتصال بها أو لا تغطية هنا)؛ أدخل الوحدات في الجدول.'));
        redraw();
      });
    }).catch(function (e) { prog(0, e.message || String(e)); SH.toast(e.message || String(e), 'bad'); }).then(function () { busy = false; $('#xsRun').disabled = false; });
  }
  $('#xsRun').addEventListener('click', build);

  /* ---------------------------------------------------------------- construction */
  function same(a, b) { return a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6; }
  function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(c || ''); var v = m ? parseInt(m[1], 16) : 0xD9C8A0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function compute() {
    var g = geom(); if (!g || !last || !same(last.A, g.A) || !same(last.B, g.B)) return null;
    var Lk = g.L / 1000, zs = last.z.slice(), i; for (i = 0; i < zs.length; i++) if (zs[i] == null) zs[i] = i ? zs[i - 1] : (zs.filter(function (v) { return v != null; })[0] || 0);
    var surf = function (sk) { var f = Math.max(0, Math.min(1, sk / Lk)) * (NS - 1), a = Math.floor(f), b = Math.min(NS - 1, a + 1); return zs[a] + (zs[b] - zs[a]) * (f - a); };
    var units = UN.get().filter(function (u) { return isFinite(u.a) && isFinite(u.b) && u.b > u.a; }).sort(function (a, b) { return a.a - b.a; });
    var keys = []; units.forEach(function (u) { var key = (u.n || '') + '|' + u.age; if (keys.indexOf(key) < 0) keys.push(key); u.k = keys.indexOf(key) + 1; u.rgb = hex(u.c); });
    var unitAt = function (sk) { for (var k = 0; k < units.length; k++) if (sk >= units[k].a && sk <= units[k].b) return units[k]; var best = units[0], bd = Infinity; units.forEach(function (u) { var d = Math.min(Math.abs(sk - u.a), Math.abs(sk - u.b)); if (d < bd) { bd = d; best = u; } }); return best; };
    var buf = Math.max(0, G.v('xsBuf') || 0), M = [];
    MS.get().forEach(function (m, ix) { if (!isFinite(m.lat) || !isFinite(m.lon) || !isFinite(m.dd) || !isFinite(m.dip)) return; var p = g.loc(m.lat, m.lon); if (p.s < 0 || p.s > g.L || Math.abs(p.o) > buf) return;
      var beta = ((m.dd - g.az) % 360 + 540) % 360 - 180, ap = Math.atan(Math.tan(Math.min(89.9, m.dip) * Math.PI / 180) * Math.cos(beta * Math.PI / 180)) * 180 / Math.PI;
      M.push({ ix: ix + 1, ty: m.ty === 'F' ? 'F' : 'S0', dd: m.dd, dip: m.dip, s: p.s / 1000, o: p.o, beta: beta, ap: ap }); });
    var beds = M.filter(function (m) { return m.ty === 'S0'; }), def = Math.max(0, Math.min(89, G.v('xsDef') != null && isFinite(G.v('xsDef')) ? G.v('xsDef') : 10)), C = [], contra = 0;
    for (i = 1; i < units.length; i++) {
      var Ul = units[i - 1], Ur = units[i], xc = (Ul.b + Ur.a) / 2, zc = surf(xc), younger = isFinite(Ul.age) && isFinite(Ur.age) && Ul.age !== Ur.age ? (Ur.age < Ul.age ? 1 : -1) : 0, near = null, nd = Infinity;
      beds.forEach(function (m) { var d = Math.abs(m.s - xc); if (d < nd) { nd = d; near = m; } }); if (near && nd > Math.max(0.25 * Lk, 3 * buf / 1000)) near = null;
      var dip, sg; if (near) { dip = Math.abs(near.ap); sg = near.ap >= 0 ? 1 : -1; if (younger && sg !== younger && dip > 2) contra++; } else { dip = def; sg = younger || 0; }
      C.push({ x: xc, z: zc, dip: dip, sg: sg, below: sg > 0 ? Ul : sg < 0 ? Ur : null, from: near ? 'm' : 'd', L: Ul, R: Ur });
    }
    return { g: g, Lk: Lk, zs: zs, surf: surf, units: units, unitAt: unitAt, M: M, C: C, contra: contra, buf: buf };
  }
  function lineZ(c, x) { if (!c.sg) return null; var dx = (x - c.x) * c.sg; if (dx < 0) return null; return c.dip >= 89.5 ? null : c.z - Math.tan(c.dip * Math.PI / 180) * dx * 1000; }

  /* ---------------------------------------------------------------- figure */
  function redraw() {
    persist.save(); var X = compute(), g = geom();
    if (!X) { if (last && g && (!same(last.A, g.A) || !same(last.B, g.B))) prog(0, t('The line has changed: press “Build the section”.', 'تغير الخط: اضغط «ابنِ المقطع».')); return; }
    RES = X; $('#xsEmpty').hidden = true; $('#xsOut').hidden = false;
    var W = 1000, H = 560, m = { l: 74, r: 22, t: 56, b: 58 }, PW = W - m.l - m.r, PH = H - m.t - m.b, Lm = X.g.L, zmin = Math.min.apply(null, X.zs), zmax = Math.max.apply(null, X.zs), Rl = Math.max(10, zmax - zmin), ve = $('#xsVE').value, ztop, zbase, dep = G.v('xsDep');
    if (ve !== 'auto') { var yr = PH / PW * Lm / +ve; if (yr < Rl * 1.3) yr = Rl * 1.3; ztop = zmax + 0.12 * yr; zbase = ztop - yr; }
    else { var D = dep > 0 ? dep : Math.max(Rl * 1.2, 0.06 * Lm, 60); ztop = zmax + 0.14 * (Rl + D); zbase = zmin - D; }
    var VE = (PH / (ztop - zbase)) / (PW / Lm);
    // subsurface raster
    var nxr = 500, nzr = 280, cv = document.createElement('canvas'); cv.width = nxr; cv.height = nzr; var cx = cv.getContext('2d'), im = cx.createImageData(nxr, nzr);
    for (var ix = 0; ix < nxr; ix++) {
      var x = (ix + 0.5) / nxr * X.Lk, zs0 = X.surf(x), u = X.unitAt(x), cr = [];
      X.C.forEach(function (c) { var zl = lineZ(c, x); if (zl != null && zl < zs0 && zl > zbase && c.below) cr.push([zl, c.below]); }); cr.sort(function (a, b) { return b[0] - a[0]; });
      var ci = 0;
      for (var iz = 0; iz < nzr; iz++) { var z = ztop - (iz + 0.5) / nzr * (ztop - zbase), k = (iz * nxr + ix) * 4; if (z > zs0) { im.data[k + 3] = 0; continue; }
        while (ci < cr.length && cr[ci][0] >= z) { var nu = cr[ci][1]; if (!(isFinite(nu.age) && isFinite(u.age)) || nu.age >= u.age) u = nu; ci++; }
        var c = u ? u.rgb : [217, 200, 160]; im.data[k] = c[0]; im.data[k + 1] = c[1]; im.data[k + 2] = c[2]; im.data[k + 3] = 255; }
    }
    cx.putImageData(im, 0, 0); var url = cv.toDataURL('image/png'), prof = []; for (var q = 0; q < NS; q += 2) prof.push([q / (NS - 1) * X.Lk, X.zs[q]]); prof.push([X.Lk, X.zs[NS - 1]]);
    var leg = X.units.filter(function (u, k, a) { return a.findIndex(function (v) { return v.n === u.n && v.age === u.age; }) === k; }).map(function (u) { var nm = (u.n || '').length > 46 ? u.n.slice(0, 44) + '…' : u.n; return { name: u.k + ' · ' + nm + (u.int ? ' (' + u.int + ')' : isFinite(u.age) && u.age != null ? ' (' + F(u.age, 1) + ' Ma)' : ''), col: u.c || '#D9C8A0', box: 1, op: 1 }; });
    leg = leg.concat([{ name: 'Ground surface', col: G.INK, w: 2.2 }, { name: 'Projected contact', col: '#3A3A3A', dash: '5 4', w: 1.2 }, { name: 'Bedding: apparent dip', col: G.INK, w: 2.4 }].concat(X.M.some(function (q) { return q.ty === 'F'; }) ? [{ name: 'Fault (no offset shown)', col: '#C0392B', w: 2.2 }] : []));
    G.chart($('#xsSvg'), { W: W, H: H, m: m, x: { lo: 0, hi: X.Lk, title: 'Distance from A (km)' }, y: { lo: zbase, hi: ztop, title: 'Elevation (m above sea level)' },
      under: function (fx, fy) { return '<image href="' + url + '" x="' + fx(0) + '" y="' + fy(ztop) + '" width="' + (fx(X.Lk) - fx(0)) + '" height="' + (fy(zbase) - fy(ztop)) + '" preserveAspectRatio="none"/>'; },
      over: function (fx, fy) {
        var s = '';
        X.C.forEach(function (c) { if (!c.sg) { s += '<line x1="' + fx(c.x) + '" x2="' + fx(c.x) + '" y1="' + fy(c.z) + '" y2="' + fy(zbase) + '" stroke="#3A3A3A" stroke-width="1.1" stroke-dasharray="5 4"/>'; return; }
          var pts = [[c.x, c.z]], xe = c.sg > 0 ? X.Lk : 0, n = 80; for (var j = 1; j <= n; j++) { var xx = c.x + (xe - c.x) * j / n, zl = lineZ(c, xx); if (zl == null) break; if (zl < zbase) { var x0 = c.x + c.sg * (c.z - zbase) / Math.tan(Math.max(1e-6, c.dip) * Math.PI / 180) / 1000; pts.push([x0, zbase]); break; } if (zl > X.surf(xx) + 0.5) break; pts.push([xx, zl]); }
          if (pts.length > 1) s += '<path d="' + pts.map(function (p, j) { return (j ? 'L' : 'M') + fx(p[0]).toFixed(1) + ' ' + fy(p[1]).toFixed(1); }).join('') + '" fill="none" stroke="#3A3A3A" stroke-width="1.1" stroke-dasharray="5 4"/>'; });
        X.M.filter(function (q) { return q.ty === 'F'; }).forEach(function (q) { var zt = X.surf(q.s), a = Math.max(1, Math.abs(q.ap)), sg = q.ap >= 0 ? 1 : -1, xb = q.s + sg * (zt - zbase) / Math.tan(a * Math.PI / 180) / 1000; s += '<line x1="' + fx(q.s) + '" y1="' + fy(zt) + '" x2="' + fx(xb) + '" y2="' + fy(zbase) + '" stroke="#C0392B" stroke-width="2.2"/>'; });
        s += '<path d="M' + fx(0) + ' ' + fy(ztop) + prof.map(function (p) { return 'L' + fx(p[0]).toFixed(1) + ' ' + fy(p[1]).toFixed(1); }).join('') + 'L' + fx(X.Lk) + ' ' + fy(ztop) + 'Z" fill="#fff"/>';
        s += '<path d="' + prof.map(function (p, j) { return (j ? 'L' : 'M') + fx(p[0]).toFixed(1) + ' ' + fy(p[1]).toFixed(1); }).join('') + '" fill="none" stroke="' + G.INK + '" stroke-width="2.2"/>';
        X.C.forEach(function (c) { s += '<line x1="' + fx(c.x) + '" x2="' + fx(c.x) + '" y1="' + (fy(c.z) - 5) + '" y2="' + (fy(c.z) + 5) + '" stroke="' + G.INK + '" stroke-width="1.4"/>'; });
        return s;
      },
      top: function (fx, fy) {
        var s = '', B = X.M.filter(function (q) { return q.ty === 'S0'; });
        B.forEach(function (q) { var px = fx(q.s), py = fy(X.surf(q.s)), a = Math.atan(VE * Math.tan(Math.abs(q.ap) * Math.PI / 180)), sg = q.ap >= 0 ? 1 : -1, ln = 26; s += '<line x1="' + (px - sg * Math.cos(a) * 4).toFixed(1) + '" y1="' + (py - Math.sin(a) * 4).toFixed(1) + '" x2="' + (px + sg * Math.cos(a) * ln).toFixed(1) + '" y2="' + (py + Math.sin(a) * ln).toFixed(1) + '" stroke="' + G.INK + '" stroke-width="2.6" stroke-linecap="round"/>'; });
        var lx = spreadX(B.map(function (q) { return fx(q.s); }), 30, m.l + 12, W - m.r - 12); B.forEach(function (q, k) { var py = fy(X.surf(q.s)); s += G.tx(lx[k], py - 10, F(Math.abs(q.ap), 0) + '°', { fs: 10.5, anchor: 'middle', halo: 1 }); });
        var mids = X.units.map(function (u) { var xm = (Math.max(0, u.a) + Math.min(X.Lk, u.b)) / 2; return { u: u, px: fx(xm), py: fy(X.surf(xm)) }; }).filter(function (o) { return (fx(o.u.b) - fx(o.u.a)) > 3; });
        var row = fy(ztop) + 13, lx2 = spreadX(mids.map(function (o) { return o.px; }), 21, m.l + 11, W - m.r - 11);
        mids.forEach(function (o, k) { s += '<path d="M' + lx2[k] + ' ' + (row + 8) + 'L' + o.px + ' ' + (o.py - 14) + '" stroke="' + G.MUT + '" stroke-width=".8" fill="none"/><circle cx="' + lx2[k] + '" cy="' + row + '" r="8.5" fill="' + (o.u.c || '#D9C8A0') + '" stroke="' + G.INK + '" stroke-width="1"/>' + G.tx(lx2[k], row + 3.6, String(o.u.k), { fs: 9.5, anchor: 'middle', fw: 700 }); });
        s += G.tx(m.l, m.t - 12, 'A (' + cmp(X.g.az + 180) + ')', { fs: 14, fw: 800 }) + G.tx(W - m.r, m.t - 12, 'A′ (' + cmp(X.g.az) + ')', { fs: 14, fw: 800, anchor: 'end' });
        var ppm = PW / Lm, sb = G.scaleBar(0, 0, ppm, 170), sx = m.l + 16, sy = m.t + PH - 30; s += '<rect x="' + (sx - 8) + '" y="' + (sy - 18) + '" width="214" height="34" rx="4" fill="#fff" fill-opacity=".88"/><g transform="translate(' + sx + ' ' + sy + ')">' + sb + '</g>';
        return s;
      },
      legend: leg, note: 'Section A–A′ · azimuth ' + F(X.g.az, 0) + '° · ' + F(X.Lk, 2) + ' km · vertical exaggeration × ' + F(VE, VE < 10 ? 1 : 0) + ' · A ' + F(X.g.A[0], 4) + ', ' + F(X.g.A[1], 4) + ' · A′ ' + F(X.g.B[0], 4) + ', ' + F(X.g.B[1], 4) + ' · ' + (SH.dem.sources[last.src] || SH.dem.sources.aws).short + '. Below the surface: interpretation.' });
    $('#xsCap').textContent = t('Ground surface from the elevation model and units at the surface from the geological map; below the surface the contacts are projected with the apparent dip of the nearest bedding measurement, or with the default dip towards the younger unit, and filled as a layer cake. Numbers refer to the legend.', 'سطح الأرض من نموذج الارتفاع والوحدات السطحية من الخريطة الجيولوجية؛ وتحت السطح تُسقط الحدود بالميل الظاهري لأقرب قياس تطبق، أو بالميل الافتراضي نحو الوحدة الأحدث، وتُملأ طبقياً. وتشير الأرقام إلى المفتاح.');
    summary(X, VE, zmin, zmax);
  }
  function spreadX(xs, gap, lo, hi) { var o = xs.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x - b.x; }); for (var it = 0; it < 100; it++) { var mv = false; for (var i = 1; i < o.length; i++) { var d = o[i].x - o[i - 1].x; if (d < gap) { var sh = (gap - d) / 2; o[i - 1].x -= sh; o[i].x += sh; mv = true; } } o.forEach(function (q) { q.x = Math.max(lo, Math.min(hi, q.x)); }); if (!mv) break; } var out = []; o.forEach(function (q) { out[q.i] = q.x; }); return out; }

  function summary(X, VE, zmin, zmax) {
    var k = [], v = [], tot = MS.get().filter(function (q) { return isFinite(q.lat) && isFinite(q.dd); }).length, nm = {}; X.units.forEach(function (u) { nm[u.n] = 1; });
    k.push(G.kpi('info', t('Section length', 'طول المقطع'), F(X.Lk, 2) + '<small> km</small>', t('azimuth ', 'الاتجاه ') + F(X.g.az, 0) + '°'));
    k.push(G.kpi('info', t('Relief along the line', 'التضرس على الخط'), F(zmax - zmin, 0) + '<small> m</small>', F(zmin, 0) + '–' + F(zmax, 0) + ' m'));
    k.push(G.kpi('info', t('Units crossed', 'الوحدات المقطوعة'), Object.keys(nm).length + '', X.C.length + t(' contacts', ' حدود')));
    k.push(G.kpi(X.M.length ? 'ok' : 'warn', t('Measurements projected', 'القياسات المسقطة'), X.M.length + '<small> / ' + tot + '</small>', t('within ', 'ضمن ') + F(X.buf, 0) + ' m'));
    var geo = last.geo;
    if (geo) v.push(G.verdict(geo.scale >= 2 ? 'warn' : 'info', t('Geological map used', 'الخريطة الجيولوجية المستعملة'), (geo.scale === 0 ? t('A detailed map (about 1:100 000 or larger) ', 'خريطة تفصيلية (نحو 1:100000 أو أكبر) ') : geo.scale === 1 ? t('A medium-scale map (about 1:1 000 000) ', 'خريطة متوسطة المقياس (نحو 1:1000000) ') : t('A small-scale regional compilation ', 'تجميع إقليمي صغير المقياس ')) + t('covers ', 'تغطي ') + F(geo.cover * 100, 0) + t(' % of the line. ', ' % من الخط. ') + (geo.scale >= 1 ? t('Contacts may be several hundred metres to kilometres off and thin formations merged: correct the units from the national 1:100 000 or 1:250 000 sheets where you have them.', 'قد تنحرف الحدود مئات الأمتار إلى كيلومترات وتُدمج التكوينات الرقيقة: صحّح الوحدات من لوحات الخريطة الوطنية 1:100000 أو 1:250000 إن توفرت.') : '')));
    else v.push(G.verdict('warn', t('No geological map along the line', 'لا خريطة جيولوجية على الخط'), t('The units were not read (no connection to the map or no coverage). Type the units with their distances and ages in the table below.', 'لم تُقرأ الوحدات (لا اتصال بالخريطة أو لا تغطية). أدخل الوحدات مع مسافاتها وأعمارها في الجدول أدناه.')));
    var B = X.M.filter(function (q) { return q.ty === 'S0'; });
    if (!B.length) v.push(G.verdict('info', t('No dips near the line', 'لا ميول قرب الخط'), t('All contacts use the default dip of ', 'تستعمل الحدود كلها الميل الافتراضي ') + F(G.v('xsDef') || 0, 0) + t('° towards the younger unit. Add bedding measurements, import them from the field companion, or widen the projection distance.', '° نحو الوحدة الأحدث. أضف قياسات تطبق أو استوردها من مرافق المسح الحقلي أو وسّع مسافة الإسقاط.')));
    else { var cb = B.reduce(function (s, q) { return s + Math.abs(Math.cos(q.beta * Math.PI / 180)); }, 0) / B.length; if (cb < 0.5) v.push(G.verdict('warn', t('Line oblique to the strike', 'الخط مائل على المضرب'), t('On average the section runs at ', 'يمتد المقطع في المتوسط بزاوية ') + F(Math.acos(cb) * 180 / Math.PI, 0) + t('° to the dip direction, so apparent dips are much gentler than true dips. Turn the line towards the dip direction for a true section.', '° على اتجاه الميل، فتكون الميول الظاهرية أهدأ كثيراً من الحقيقية. أدر الخط نحو اتجاه الميل للحصول على مقطع حقيقي.'))); }
    if (X.contra) v.push(G.verdict('warn', t('Dips against the age order', 'ميول تخالف ترتيب الأعمار'), X.contra + t(' contacts dip towards the older unit: the beds may be overturned, a fault may separate them, or the ages from the map are wrong. Check them in the field and correct the ages in the table.', ' حدود تميل نحو الوحدة الأقدم: قد تكون الطبقات مقلوبة، أو يفصلها فالق، أو أعمار الخريطة خاطئة. تحقق منها حقلياً وصحح الأعمار في الجدول.')));
    if (VE > 5) v.push(G.verdict('info', t('Strong vertical exaggeration', 'مبالغة رأسية كبيرة'), t('At × ', 'عند × ') + F(VE, 1) + t(' slopes and dips look much steeper than they are; a 10° dip appears as ', ' تبدو المنحدرات والميول أشد كثيراً من حقيقتها؛ فالميل 10° يظهر ') + F(Math.atan(VE * Math.tan(10 * Math.PI / 180)) * 180 / Math.PI, 0) + t('°. Use × 1 for structural measurements on the figure.', '°. استعمل × 1 لأخذ القياسات البنيوية من الشكل.')));
    $('#xsKpis').innerHTML = k.join(''); $('#xsVerd').innerHTML = v.join('');
    $('#xsTbl').innerHTML = '<thead><tr><th>#</th><th>' + t('Type', 'النوع') + '</th><th class="num">' + t('Dip dir. / dip', 'اتجاه الميل / الميل') + '</th><th class="num">' + t('From A km', 'من A كم') + '</th><th class="num">' + t('Off the line m', 'عن الخط م') + '</th><th class="num">β</th><th class="num">' + t('Apparent dip', 'الميل الظاهري') + '</th><th>' + t('Dips towards', 'يميل نحو') + '</th></tr></thead><tbody>' + (X.M.length ? X.M.map(function (q) { return '<tr><td>' + q.ix + '</td><td>' + (q.ty === 'F' ? t('Fault', 'فالق') : t('Bedding', 'تطبق')) + '</td><td class="num ltr">' + F(q.dd, 0) + ' / ' + F(q.dip, 0) + '</td><td class="num">' + F(q.s, 2) + '</td><td class="num">' + F(Math.abs(q.o), 0) + ' ' + (q.o > 0 ? t('L', 'يسار') : t('R', 'يمين')) + '</td><td class="num">' + F(Math.abs(q.beta), 0) + '°</td><td class="num">' + F(Math.abs(q.ap), 1) + '°</td><td>' + (Math.abs(q.ap) < 0.5 ? '—' : q.ap > 0 ? 'A′' : 'A') + '</td></tr>'; }).join('') : '<tr><td colspan="8" class="muted">' + t('No measurement lies within the projection distance.', 'لا قياس ضمن مسافة الإسقاط.') + '</td></tr>') + '</tbody>';
  }

  /* ---------------------------------------------------------------- inputs and exports */
  $('#xsAddM').addEventListener('click', function () { MS.add({ ty: 'S0' }); });
  $('#xsFc').addEventListener('click', function () {
    var S = SH.store.get('shandal_fc', null), P = S && S.P && S.P[S.cur]; if (!P || !P.st || !P.st.length) { SH.toast(t('No survey with stations in the field companion on this device.', 'لا يوجد مسح فيه محطات في مرافق المسح الحقلي على هذا الجهاز.'), 'warn'); return; }
    var add = []; P.st.forEach(function (s) { (s.m || []).forEach(function (q) { if (q.k === 'S0' || q.k === 'F') add.push({ lat: +(+s.lat).toFixed(6), lon: +(+s.lon).toFixed(6), dd: q.a, dip: q.b, ty: q.k }); }); });
    if (!add.length) { SH.toast(t('The survey has no bedding or fault measurements.', 'لا يحوي المسح قياسات تطبق أو فوالق.'), 'warn'); return; }
    var have = MS.get().filter(function (q) { return isFinite(q.lat); }), key = function (q) { return [q.lat, q.lon, q.dd, q.dip].join('|'); }, ks = {}; have.forEach(function (q) { ks[key(q)] = 1; });
    var nw = add.filter(function (q) { return !ks[key(q)]; }); MS.set(have.concat(nw)); SH.toast(nw.length + t(' measurements imported from “', ' قياساً استُورد من «') + P.name + (AR ? '».' : '”.'), 'ok');
  });
  $('#xsPasteBtn').addEventListener('click', function () { var b = $('#xsPasteBox'); b.hidden = !b.hidden; });
  $('#xsPasteOk').addEventListener('click', function () { var rows = []; $('#xsPaste').value.split(/\r?\n/).forEach(function (ln) { var c = ln.trim().split(/[\s,;]+/), n = c.slice(0, 4).map(function (v) { return parseFloat(String(v).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/٫/g, '.')); }); if (n.length === 4 && n.every(isFinite)) rows.push({ lat: n[0], lon: n[1], dd: n[2], dip: n[3], ty: /^f/i.test(c[4] || '') ? 'F' : 'S0' }); });
    if (!rows.length) { SH.toast(t('No measurements found: one per line as lat lon dipdir dip [F].', 'لم تُعثر على قياسات: قياس في كل سطر بصيغة lat lon dipdir dip [F].'), 'bad'); return; } MS.set(MS.get().filter(function (q) { return isFinite(q.lat); }).concat(rows)); $('#xsPasteBox').hidden = true; $('#xsPaste').value = ''; });
  $('#xsUCsv').addEventListener('click', function () { SH.csv('shandal-section-units.csv', [['number', 'from_km', 'to_km', 'unit', 'age_ma', 'interval', 'lithology', 'colour']].concat(UN.get().map(function (u, k) { return [k + 1, u.a, u.b, u.n, u.age == null ? '' : u.age, u.int || '', u.lith || '', u.c || '']; }))); });
  $('#xsMCsv').addEventListener('click', function () { if (!RES) return; SH.csv('shandal-section-dips.csv', [['number', 'type', 'dip_direction', 'dip', 'from_A_km', 'offset_m', 'beta_deg', 'apparent_dip_deg']].concat(RES.M.map(function (q) { return [q.ix, q.ty, q.dd, q.dip, q.s.toFixed(3), q.o.toFixed(0), q.beta.toFixed(1), q.ap.toFixed(2)]; }))); });
  $('#xsPCsv').addEventListener('click', function () { if (!RES) return; SH.csv('shandal-section-profile.csv', [['distance_km', 'lat', 'lon', 'elevation_m', 'unit']].concat(RES.zs.map(function (z, q) { var s = q / (NS - 1) * RES.Lk, p = RES.g.at(s * 1000), u = RES.unitAt(s); return [s.toFixed(4), p[0].toFixed(6), p[1].toFixed(6), z.toFixed(1), u ? u.n : '']; }))); });
  function fc() { var X = RES, fs = [{ type: 'Feature', properties: { kind: 'section', name: 'A–A′', azimuth: +X.g.az.toFixed(1), length_km: +X.Lk.toFixed(3) }, geometry: { type: 'LineString', coordinates: [[X.g.A[1], X.g.A[0]], [X.g.B[1], X.g.B[0]]] } }];
    X.C.forEach(function (c) { var p = X.g.at(c.x * 1000); fs.push({ type: 'Feature', properties: { kind: 'contact', from_A_km: +c.x.toFixed(3), left: c.L.n, right: c.R.n }, geometry: { type: 'Point', coordinates: [+p[1].toFixed(6), +p[0].toFixed(6)] } }); });
    X.units.forEach(function (u) { var a = X.g.at(Math.max(0, u.a) * 1000), b = X.g.at(Math.min(X.Lk, u.b) * 1000); fs.push({ type: 'Feature', properties: { kind: 'unit', number: u.k, unit: u.n, age_ma: u.age, colour: u.c }, geometry: { type: 'LineString', coordinates: [[+a[1].toFixed(6), +a[0].toFixed(6)], [+b[1].toFixed(6), +b[0].toFixed(6)]] } }); });
    return { type: 'FeatureCollection', features: fs }; }
  $('#xsGeo').addEventListener('click', function () { if (!RES) return; SH.download('shandal-section.geojson', new Blob([JSON.stringify(fc())], { type: 'application/geo+json' })); });
  $('#xsKml').addEventListener('click', function () { if (!RES) return; var E = function (s) { return String(s).replace(/[<&>]/g, function (c) { return { '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]; }); }, k = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Shandal section A–A′</name>';
    fc().features.forEach(function (f) { var g = f.geometry, c = g.type === 'Point' ? [g.coordinates] : g.coordinates; k += '<Placemark><name>' + E(f.properties.kind === 'unit' ? f.properties.number + ' ' + f.properties.unit : f.properties.kind === 'contact' ? f.properties.left + ' | ' + f.properties.right : 'A–A′') + '</name>' + (g.type === 'Point' ? '<Point>' : '<LineString>') + '<coordinates>' + c.map(function (p) { return p[0] + ',' + p[1] + ',0'; }).join(' ') + '</coordinates>' + (g.type === 'Point' ? '</Point>' : '</LineString>') + '</Placemark>'; });
    SH.download('shandal-section.kml', new Blob([k + '</Document></kml>'], { type: 'application/vnd.google-earth.kml+xml' })); });
  window.SHXS = { compute: compute, geology: geology };
  document.addEventListener('DOMContentLoaded', function () { mapDraw(); var g = geom(); if (g && map) map.fitBounds([g.A, g.B], { padding: [30, 30] }); if (last) redraw(); });
})();
