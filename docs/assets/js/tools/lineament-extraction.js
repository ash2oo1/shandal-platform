/* Lineament extraction — topographic lineaments from a 30 m elevation model: multi-directional hillshade for reading,
   automatic extraction as elongated zones of strong one-directional curvature (Hessian of the terrain) turned into
   straight segments by principal-axis fitting (long curved zones are split until each piece is straight), manual drawing
   and editing, upload of mapped lines, lineament density, rose diagram with mean direction and Rayleigh test, comparison
   with the active faults of the world atlas, framed map sheet and GeoJSON / KML / CSV / ASCII-grid downloads. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', D = SH.dem;
  var persist = SH.persist('lineaments', ['nRes', 'nSens', 'nMin', 'nKind', 'nBg', 'nOp']);
  var map = SH.map('nMap', { zoom: 7, base: 'satellite', center: [35.4, 45.3] });
  var RND = L ? L.canvas({ tolerance: 7 }) : null;
  var COL = { valley: '#00e5ff', ridge: '#ff3df2', user: '#ffd60a', fault: '#ff5a1f' };
  var aoi = SH.store.get('shandal_ln_aoi', null), aoiLay = null, drawer = null, G = null, bgLay = null, layA = null, layM = null, layF = null, busy = false;
  var auto = [], mine = SH.store.get('shandal_ln_mine', []), faults = null, drawing = null;
  if (map && AR) { var scl = map.getContainer().querySelector('.leaflet-control-scale'), brc = map.getContainer().querySelector('.leaflet-bottom.leaflet-right'); if (scl && brc) brc.insertBefore(scl, brc.firstChild); }
  if (map) { layA = L.layerGroup().addTo(map); layM = L.layerGroup().addTo(map); }

  var hav = function (a, b) { var p1 = SH.rad(a[0]), p2 = SH.rad(b[0]), dl = SH.rad(b[1] - a[1]), h = Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2); return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h))); }; /* [lat, lon] → m */
  var brg = function (a, b) { var p1 = SH.rad(a[0]), p2 = SH.rad(b[0]), dl = SH.rad(b[1] - a[1]); return (SH.deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360; };
  var p3 = function (v) { v = Math.round(v) % 360; return (v < 10 ? '00' : v < 100 ? '0' : '') + v; };
  var lineLen = function (pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += hav(pts[i - 1], pts[i]); return s; };
  var trend = function (pts) { return brg(pts[0], pts[pts.length - 1]) % 180; };

  /* ---------------------------------------------------------------- area */
  function km(b) { var kx = 111.32 * Math.cos(SH.rad((b.n + b.s) / 2)); return { w: (b.e - b.w) * kx, h: (b.n - b.s) * 110.57 }; }
  function setAoi(b) { aoi = b; SH.store.set('shandal_ln_aoi', b); if (!map) return; if (aoiLay) map.removeLayer(aoiLay); aoiLay = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: '#FFD60A', weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map);
    var k = km(b), a = k.w * k.h; $('#nAoi').innerHTML = '<span class="ltr">' + SH.fmt(k.w, 1) + ' × ' + SH.fmt(k.h, 1) + ' km · ' + SH.fmt(a, 1) + ' km²</span>' + (a > 3000 ? ' · <span style="color:var(--bad)">' + t('too large: keep it under 3000 km²', 'كبيرة جداً: اجعلها أقل من 3000 كم²') + '</span>' : a < 1 ? ' · <span style="color:var(--bad)">' + t('too small: at least 1 km²', 'صغيرة جداً: 1 كم² على الأقل') + '</span>' : ''); }
  if (aoi) { setAoi(aoi); if (map) map.fitBounds([[aoi.s, aoi.w], [aoi.n, aoi.e]]); }
  $('#nDraw').addEventListener('click', function () { if (!map) return; stopDraw(); if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); drawer = null; setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#nHint')); });
  $('#nView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  /* ---------------------------------------------------------------- elevation grid */
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function grid(b) { var k = km(b), side = { fine: 420, coarse: 180 }[SH.val('nRes')] || 300, cell = Math.max(30, Math.sqrt(k.w * k.h * 1e6) / side);
    var nx = Math.max(30, Math.round(k.w * 1000 / cell)), ny = Math.max(30, Math.round(k.h * 1000 / cell)), m = D.metersPerDeg((b.n + b.s) / 2), dlon = (b.e - b.w) / nx, dlat = (b.n - b.s) / ny;
    return { b: b, nx: nx, ny: ny, n: nx * ny, dlon: dlon, dlat: dlat, dx: dlon * m.x, dy: dlat * m.y, cell: Math.sqrt(dlon * m.x * dlat * m.y), lat: function (j) { return b.n - (j + 0.5) * dlat; }, lon: function (i) { return b.w + (i + 0.5) * dlon; } }; }
  function getDem() {
    var pad = Math.max(G.dlon, G.dlat) * 2, b = { n: G.b.n + pad, s: G.b.s - pad, e: G.b.e + pad, w: G.b.w - pad };
    var fill = function (f) { var Z = new Float32Array(G.n); for (var j = 0; j < G.ny; j++) for (var i = 0; i < G.nx; i++) Z[j * G.nx + i] = f(G.lat(j), G.lon(i)); return Z; };
    var tryCop = function (n) { return SH.pc.dem(b, 'cop-dem-glo-30', null, 1600).catch(function (e) { if (n >= 3) throw e; return sleep(1500 * (n + 1) + Math.random() * 800).then(function () { return tryCop(n + 1); }); }); };
    return tryCop(0).then(function (f) { G.src = 'cop'; return fill(f); }).catch(function () { G.src = 'srtm'; return D.terrarium(b, G.cell).then(fill); });
  }

  /* ---------------------------------------------------------------- extraction */
  function extract(Z) {
    var nx = G.nx, ny = G.ny, n = G.n, dx = G.dx, dy = G.dy, c, i, j, k;
    var mean = 0, cnt = 0; for (c = 0; c < n; c++) if (isFinite(Z[c])) { mean += Z[c]; cnt++; } mean /= cnt || 1; for (c = 0; c < n; c++) if (!isFinite(Z[c])) Z[c] = mean;
    /* light 3 × 3 smoothing removes the speckle of the elevation model before the second derivatives */
    var ZS = new Float32Array(n); for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var s = 0, q = 0; for (var b = -1; b <= 1; b++) for (var a = -1; a <= 1; a++) { var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; s += Z[jj * nx + ii]; q++; } ZS[j * nx + i] = s / q; }
    var at = function (i, j) { i = i < 0 ? 0 : i >= nx ? nx - 1 : i; j = j < 0 ? 0 : j >= ny ? ny - 1 : j; return ZS[j * nx + i]; };
    var S = new Float32Array(n), AN = new Float32Array(n), sgn = new Int8Array(n);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var A = at(i - 1, j - 1), B = at(i, j - 1), Cc = at(i + 1, j - 1), Dd = at(i - 1, j), E = at(i, j), F = at(i + 1, j), Gg = at(i - 1, j + 1), H = at(i, j + 1), I = at(i + 1, j + 1);
      var gx = ((Cc + 2 * F + I) - (A + 2 * Dd + Gg)) / (8 * dx), gy = ((Gg + 2 * H + I) - (A + 2 * B + Cc)) / (8 * dy); c = j * nx + i; S[c] = SH.deg(Math.atan(Math.hypot(gx, gy)));
      var hxx = (Dd - 2 * E + F) / (dx * dx), hyy = (B - 2 * E + H) / (dy * dy), hxy = (I - Gg - Cc + A) / (4 * dx * dy), tr = hxx + hyy, df = Math.sqrt(Math.pow(hxx - hyy, 2) + 4 * hxy * hxy), l1 = (tr + df) / 2, l2 = (tr - df) / 2;
      var big = Math.abs(l1) > Math.abs(l2) ? l1 : l2, sm = Math.abs(l1) > Math.abs(l2) ? l2 : l1; AN[c] = Math.abs(big) - Math.abs(sm); sgn[c] = big > 0 ? 1 : -1; }
    G.slope = S; G.z = Z;
    var pc = { low: 0.93, mid: 0.88, high: 0.82 }[SH.val('nSens')] || 0.88, srt = Array.prototype.slice.call(AN).sort(function (a, b) { return a - b; }), th = Math.max(srt[Math.floor(n * pc)], 1.2 / (dx * dy)), M = new Uint8Array(n), kind = SH.val('nKind');
    for (c = 0; c < n; c++) { var ci = c % nx, cj = (c - ci) / nx; if (AN[c] > th && S[c] > 0.4 && ci > 1 && cj > 1 && ci < nx - 2 && cj < ny - 2 && (kind === 'all' || (kind === 'valley') === (sgn[c] > 0))) M[c] = 1; }
    var DI = [-1, 0, 1, -1, 1, -1, 0, 1], DJ = [-1, -1, -1, 0, 0, 1, 1, 1], lab = new Int32Array(n).fill(-1), stack = [], out = [], minL = Math.max(+SH.val('nMin') || 0, 3 * G.cell);
    /* principal-axis fit: a zone that is not straight enough (axis ratio < 3) is split at its median and refitted */
    function fit(comp, kindC, depth) {
      if (comp.length < 4) return; var mx = 0, my = 0; comp.forEach(function (u) { mx += u % nx; my += (u - u % nx) / nx; }); mx /= comp.length; my /= comp.length;
      var cxx = 0, cyy = 0, cxy = 0; comp.forEach(function (u) { var ex = (u % nx - mx) * dx, ey = ((u - u % nx) / nx - my) * dy; cxx += ex * ex; cyy += ey * ey; cxy += ex * ey; }); cxx /= comp.length; cyy /= comp.length; cxy /= comp.length;
      var tt = cxx + cyy, dd = Math.sqrt(Math.pow(cxx - cyy, 2) + 4 * cxy * cxy), la = (tt + dd) / 2, lb = Math.max((tt - dd) / 2, 1e-6), ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy), ux = Math.cos(ang), uy = Math.sin(ang);
      var pr = comp.map(function (u) { return ((u % nx - mx) * dx) * ux + (((u - u % nx) / nx - my) * dy) * uy; });
      if (la / lb < 9) { if (depth < 4 && comp.length >= 10) { var srt2 = pr.slice().sort(function (a, b) { return a - b; }), med = srt2[Math.floor(srt2.length / 2)]; fit(comp.filter(function (u, k2) { return pr[k2] < med; }), kindC, depth + 1); fit(comp.filter(function (u, k2) { return pr[k2] >= med; }), kindC, depth + 1); } return; }
      var p0 = Math.min.apply(null, pr), p1 = Math.max.apply(null, pr), len = p1 - p0; if (len < minL) return;
      var toLL = function (p) { var xi = mx + p * ux / dx, yj = my + p * uy / dy; return [G.b.n - (yj + 0.5) * G.dlat, G.b.w + (xi + 0.5) * G.dlon]; };
      var a0 = toLL(p0), a1 = toLL(p1); out.push({ pts: [a0, a1], kind: kindC, cells: comp.length, src: 'auto' });
    }
    for (c = 0; c < n; c++) { if (!M[c] || lab[c] >= 0) continue; var comp = []; stack.push(c); lab[c] = c;
      while (stack.length) { var u = stack.pop(), ui = u % nx, uj = (u - ui) / nx; comp.push(u); for (k = 0; k < 8; k++) { var vi = ui + DI[k], vj = uj + DJ[k]; if (vi < 0 || vj < 0 || vi >= nx || vj >= ny) continue; var v = vj * nx + vi; if (M[v] && lab[v] < 0 && sgn[v] === sgn[c]) { lab[v] = c; stack.push(v); } } }
      fit(comp, sgn[c] > 0 ? 'valley' : 'ridge', 0); }
    out.forEach(function (l, i2) { l.id = 'A' + (i2 + 1); l.L = lineLen(l.pts); l.az = trend(l.pts); });
    return out;
  }
  /* multi-directional hillshade (315°, 0°, 45° and 270° lights, 45° altitude, weighted average) */
  function shade() {
    var nx = G.nx, ny = G.ny, Z = G.z, cv = document.createElement('canvas'); cv.width = nx; cv.height = ny; var x = cv.getContext('2d'), im = x.createImageData(nx, ny), d = im.data, AZ = [315, 0, 45, 270], W = [0.4, 0.2, 0.2, 0.2], alt = SH.rad(45);
    var at = function (i, j) { i = i < 0 ? 0 : i >= nx ? nx - 1 : i; j = j < 0 ? 0 : j >= ny ? ny - 1 : j; return Z[j * nx + i]; };
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) { var gx = ((at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i - 1, j) + at(i - 1, j + 1))) / (8 * G.dx), gy = ((at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i, j - 1) + at(i + 1, j - 1))) / (8 * G.dy);
      var slope = Math.atan(1.6 * Math.hypot(gx, gy)), aspect = Math.atan2(gy, -gx), v = 0; for (var k = 0; k < 4; k++) { var zen = Math.PI / 2 - alt, az = SH.rad(360 - AZ[k] + 90); v += W[k] * Math.max(0, Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(az - aspect)); }
      var o = (j * nx + i) * 4, g = Math.round(255 * SH.clamp(v, 0, 1)); d[o] = d[o + 1] = d[o + 2] = g; d[o + 3] = 255; }
    x.putImageData(im, 0, 0); return cv.toDataURL('image/png');
  }
  /* length of lineaments per km² in a moving window of about 2 km */
  function density() {
    var nx = G.nx, ny = G.ny, LN = new Float32Array(G.n), all = visible();
    all.forEach(function (l) { var st = Math.max(1, Math.ceil(l.L / (G.cell / 2))), per = l.L / st; for (var k = 0; k < st; k++) { var f = (k + 0.5) / st, la = l.pts[0][0] + (l.pts[l.pts.length - 1][0] - l.pts[0][0]) * f, lo = l.pts[0][1] + (l.pts[l.pts.length - 1][1] - l.pts[0][1]) * f;
      if (l.pts.length > 2) { var seg = Math.min(l.pts.length - 2, Math.floor(f * (l.pts.length - 1))), u = f * (l.pts.length - 1) - seg; la = l.pts[seg][0] + (l.pts[seg + 1][0] - l.pts[seg][0]) * u; lo = l.pts[seg][1] + (l.pts[seg + 1][1] - l.pts[seg][1]) * u; }
      var i = Math.floor((lo - G.b.w) / G.dlon), j = Math.floor((G.b.n - la) / G.dlat); if (i >= 0 && j >= 0 && i < nx && j < ny) LN[j * nx + i] += per; } });
    var R = SH.clamp(Math.round(1000 / G.cell), 2, 25), I = new Float64Array((nx + 1) * (ny + 1)), out = new Float32Array(G.n), i, j;
    for (j = 0; j < ny; j++) { var row = 0; for (i = 0; i < nx; i++) { row += LN[j * nx + i]; I[(j + 1) * (nx + 1) + i + 1] = I[j * (nx + 1) + i + 1] + row; } }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var i0 = Math.max(0, i - R), i1 = Math.min(nx, i + R + 1), j0 = Math.max(0, j - R), j1 = Math.min(ny, j + R + 1), s = I[j1 * (nx + 1) + i1] - I[j0 * (nx + 1) + i1] - I[j1 * (nx + 1) + i0] + I[j0 * (nx + 1) + i0]; out[j * nx + i] = (s / 1000) / ((i1 - i0) * (j1 - j0) * G.dx * G.dy / 1e6); }
    G.dens = out; G.densR = R; return out;
  }
  var VIR = ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'];
  function densImg() { var D2 = density(), mx = 0, c; for (c = 0; c < G.n; c++) if (D2[c] > mx) mx = D2[c]; G.densMax = mx; var cv = document.createElement('canvas'); cv.width = G.nx; cv.height = G.ny; var x = cv.getContext('2d'), im = x.createImageData(G.nx, G.ny), d = im.data;
    for (c = 0; c < G.n; c++) { var f = mx ? D2[c] / mx : 0, k = Math.min(VIR.length - 2, Math.floor(f * (VIR.length - 1))), u = f * (VIR.length - 1) - k, a = VIR[k], b = VIR[k + 1], h = function (s, o) { return parseInt(s.slice(1 + o, 3 + o), 16); };
      d[c * 4] = h(a, 0) + (h(b, 0) - h(a, 0)) * u; d[c * 4 + 1] = h(a, 2) + (h(b, 2) - h(a, 2)) * u; d[c * 4 + 2] = h(a, 4) + (h(b, 4) - h(a, 4)) * u; d[c * 4 + 3] = f < 0.02 ? 0 : 230; }
    x.putImageData(im, 0, 0); return cv.toDataURL('image/png'); }

  /* ---------------------------------------------------------------- run */
  function run() {
    if (busy) return; if (!aoi) { SH.toast(t('Draw the area first.', 'ارسم المنطقة أولاً.'), 'warn'); return; } var k = km(aoi), a = k.w * k.h; if (a > 3000 || a < 1) { SH.toast(t('Keep the area between 1 and 3000 km².', 'اجعل المساحة بين 1 و3000 كم².'), 'warn'); return; }
    if (!SH.pro()) { SH.needPro(); return; } persist.save(); busy = true; $('#nRun').disabled = true; stopDraw(); G = grid(aoi); var host = $('.wsm-map');
    SH.busy(host, true, t('Reading the elevation model…', 'جارٍ قراءة نموذج الارتفاع…')); $('#nProg').textContent = t('Reading the elevation model…', 'جارٍ قراءة نموذج الارتفاع…');
    getDem().then(function (Z) { $('#nProg').textContent = t('Tracing lineaments…', 'جارٍ تتبع الخطيات…'); return sleep(30).then(function () { auto = extract(Z); G.shade = shade(); G.done = true; }); })
      .then(function () { $('#nProg').innerHTML = '<b class="ltr">' + auto.length + '</b> ' + t('lineaments traced on a ', 'خطية تُتُبّعت على شبكة ') + '<span class="ltr">' + G.nx + ' × ' + G.ny + ' · ' + SH.fmt(G.cell, 0) + ' m</span>' + t(' grid', '') + (G.src === 'srtm' ? t(' (fallback elevation model)', ' (نموذج ارتفاع احتياطي)') : '') + '.';
        draw(); background(); results(); if ($('#nShowF').checked) loadFaults(); if (map) map.fitBounds([[G.b.s, G.b.w], [G.b.n, G.b.e]]); if (window.innerWidth < 900) $('#nMap').scrollIntoView({ behavior: 'smooth', block: 'start' }); })
      .catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { busy = false; $('#nRun').disabled = false; SH.busy(host, false); });
  }
  $('#nRun').addEventListener('click', run);

  /* ---------------------------------------------------------------- display */
  function visible() { return ($('#nShowA').checked ? auto : []).concat($('#nShowM').checked ? mine : []); }
  var KN = { valley: [t('Linear valley', 'وادٍ خطي'), COL.valley], ridge: [t('Ridge or scarp', 'حافة أو جرف'), COL.ridge], user: [t('Drawn or loaded by you', 'رسمتها أو حمّلتها أنت'), COL.user] };
  function pop(l) { var k = KN[l.src === 'auto' ? l.kind : 'user'];
    return '<div class="ln-pop"><b>' + k[0] + '</b>' + (l.name ? ' · ' + SH.esc(l.name) : '') + '<table><tr><td>' + t('Length', 'الطول') + '</td><td class="ltr"><b>' + SH.fmt(l.L / 1000, 2) + ' km</b></td></tr><tr><td>' + t('Trend', 'الاتجاه') + '</td><td class="ltr"><b>' + p3(l.az) + '° – ' + p3(l.az + 180) + '°</b></td></tr>' + (l.cells ? '<tr><td>' + t('Cells traced', 'الخلايا المتتبَّعة') + '</td><td class="ltr">' + l.cells + '</td></tr>' : '') + '</table>' +
      '<button type="button" class="btn btn-line btn-xs" data-del="' + l.id + '" style="margin-top:6px">' + t('Delete this lineament', 'احذف هذه الخطية') + '</button></div>'; }
  function draw() {
    if (!map) return; layA.clearLayers(); layM.clearLayers();
    if ($('#nShowA').checked) auto.forEach(function (l) { L.polyline(l.pts, { renderer: RND, color: '#000', weight: 5, opacity: 0.5, interactive: false }).addTo(layA); L.polyline(l.pts, { renderer: RND, color: KN[l.kind][1], weight: 2.6, bubblingMouseEvents: false }).bindPopup(function () { return pop(l); }).addTo(layA); });
    if ($('#nShowM').checked) mine.forEach(function (l) { L.polyline(l.pts, { renderer: RND, color: '#000', weight: 6, opacity: 0.5, interactive: false }).addTo(layM); L.polyline(l.pts, { renderer: RND, color: COL.user, weight: 3, bubblingMouseEvents: false }).bindPopup(function () { return pop(l); }).addTo(layM); });
    legend();
  }
  function background() { if (!map) return; if (bgLay) { map.removeLayer(bgLay); bgLay = null; } if (!G || !G.done) return; var m = SH.val('nBg'); if (m === 'none') { legend(); return; }
    bgLay = L.imageOverlay(m === 'density' ? densImg() : G.shade, [[G.b.s, G.b.w], [G.b.n, G.b.e]], { opacity: +SH.val('nOp'), interactive: false }).addTo(map); bgLay.bringToBack(); legend(); }
  function legend() {
    var h = '', m = SH.val('nBg'), any = auto.length || mine.length || (faults && $('#nShowF').checked); if (!any && !(G && G.done)) { $('#nLeg').hidden = true; return; }
    h += '<b>' + t('Lineaments', 'الخطيات') + '</b>';
    if ($('#nShowA').checked) h += '<div class="r"><i style="background:' + COL.valley + '"></i><span>' + KN.valley[0] + '</span></div><div class="r"><i style="background:' + COL.ridge + '"></i><span>' + KN.ridge[0] + '</span></div>';
    if ($('#nShowM').checked && mine.length) h += '<div class="r"><i style="background:' + COL.user + '"></i><span>' + KN.user[0] + '</span></div>';
    if ($('#nShowF').checked && faults) h += '<div class="r"><i style="background:' + COL.fault + ';height:3px"></i><span>' + t('Active fault (world atlas)', 'فالق نشط (الأطلس العالمي)') + '</span></div>';
    if (G && G.done && m === 'density' && G.densMax != null) h += '<b style="display:block;margin-top:6px">' + t('Lineament density', 'كثافة الخطيات') + ' <span class="ltr" style="font-weight:400">(km/km²)</span></b><div class="gr" style="background:linear-gradient(90deg,' + VIR.join(',') + ')"></div><div class="sc"><span>0</span><span>' + SH.fmt(G.densMax / 2, 2) + '</span><span>' + SH.fmt(G.densMax, 2) + '</span></div>';
    if (G && G.done && m === 'shade') h += '<div class="xsmall muted" style="margin-top:4px">' + t('Background: hillshade lit from four directions', 'الخلفية: ظلال تضاريس مضاءة من أربعة اتجاهات') + '</div>';
    $('#nLeg').innerHTML = h; $('#nLeg').hidden = false;
  }
  ['nShowA', 'nShowM'].forEach(function (id) { $('#' + id).addEventListener('change', function () { draw(); if (SH.val('nBg') === 'density') background(); results(); }); });
  $('#nBg').addEventListener('change', function () { persist.save(); background(); }); $('#nOp').addEventListener('input', function () { if (bgLay) bgLay.setOpacity(+this.value); });
  if (map) map.on('popupopen', function (e) { var b = e.popup.getElement().querySelector('[data-del]'); if (!b) return; b.addEventListener('click', function () { var id = b.getAttribute('data-del'); auto = auto.filter(function (l) { return l.id !== id; }); mine = mine.filter(function (l) { return l.id !== id; }); saveMine(); map.closePopup(); draw(); if (SH.val('nBg') === 'density') background(); results(); }); });

  /* ---------------------------------------------------------------- manual drawing and loading */
  function saveMine() { SH.store.set('shandal_ln_mine', mine.map(function (l) { return { id: l.id, pts: l.pts, src: 'user', name: l.name || '' }; })); }
  mine.forEach(function (l) { l.L = lineLen(l.pts); l.az = trend(l.pts); l.src = 'user'; });
  function stopDraw() { if (!drawing || !map) return; var pts = drawing.pts; map.removeLayer(drawing.line); map.off('click', drawing.ck); map.off('dblclick', drawing.dbl); map.doubleClickZoom.enable(); map.getContainer().style.cursor = '';
    if (pts.length >= 2) { var l = { id: 'U' + Date.now().toString(36), pts: pts, src: 'user' }; l.L = lineLen(pts); l.az = trend(pts); mine.push(l); saveMine(); draw(); if (SH.val('nBg') === 'density') background(); results(); }
    drawing = null; $('#nDrawL').setAttribute('aria-pressed', 'false'); }
  $('#nDrawL').addEventListener('click', function () { if (!map) return; if (drawing) { stopDraw(); return; } if (drawer) { drawer.cancel(); drawer = null; }
    drawing = { pts: [], line: L.polyline([], { color: COL.user, weight: 3, dashArray: '6 4' }).addTo(map) }; map.doubleClickZoom.disable(); map.getContainer().style.cursor = 'crosshair'; this.setAttribute('aria-pressed', 'true');
    drawing.ck = function (e) { drawing.pts.push([e.latlng.lat, e.latlng.lng]); drawing.line.setLatLngs(drawing.pts); }; drawing.dbl = function () { stopDraw(); }; map.on('click', drawing.ck); map.on('dblclick', drawing.dbl);
    if (window.innerWidth < 900) $('#nMap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    SH.toast(t('Tap the points of the lineament; double-tap or tap the button again to finish.', 'انقر نقاط الخطية؛ انقر مرتين أو انقر الزر مجدداً للإنهاء.'), 'info'); });
  $('#nFile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; f.text().then(function (s) { var gj = JSON.parse(s), n = 0;
      (gj.features || [gj]).forEach(function (ft) { var g = ft.geometry || ft, nm = ft.properties && (ft.properties.name || ft.properties.name_en || ft.properties.Name) || '', cs = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
        cs.forEach(function (c2) { if (c2.length < 2) return; var pts = c2.map(function (q) { return [q[1], q[0]]; }), l = { id: 'U' + Date.now().toString(36) + (n++), pts: pts, src: 'user', name: nm }; l.L = lineLen(pts); l.az = trend(pts); mine.push(l); }); });
      if (!n) throw new Error(); saveMine(); draw(); results(); if (map) { var bb = L.latLngBounds([]); mine.forEach(function (l) { l.pts.forEach(function (q) { bb.extend(q); }); }); if (bb.isValid()) map.fitBounds(bb.pad(0.1)); }
      SH.toast(n + t(' lines loaded.', ' خطاً حُمّلت.'), 'ok'); }).catch(function () { SH.toast(t('The file holds no lines in GeoJSON.', 'لا يحتوي الملف على خطوط بصيغة GeoJSON.'), 'bad'); }); this.value = ''; });

  /* ---------------------------------------------------------------- active faults of the atlas, for comparison */
  function loadFaults() { var bb = G ? G.b : aoi; if (!bb || !map) return;
    var go = function () { if (layF) map.removeLayer(layF); layF = L.layerGroup(); var inB = function (q) { return q[1] >= bb.s && q[1] <= bb.n && q[0] >= bb.w && q[0] <= bb.e; };
      faults.inArea = []; faults.f.forEach(function (f) { f.g.forEach(function (s) { var pts = []; for (var i = 0; i < s.length; i += 2) pts.push([s[i] / 1e4, s[i + 1] / 1e4]); if (!pts.some(inB)) return; var ll = pts.map(function (q) { return [q[1], q[0]]; });
        L.polyline(ll, { renderer: RND, color: COL.fault, weight: 2.4, opacity: 0.95, dashArray: '8 5', interactive: false }).addTo(layF); faults.inArea.push(ll); }); });
      layF.addTo(map); legend(); results(); };
    if (faults) return go(); SH.getJSON(SH.base + 'assets/data/tectonics/faults.json', { timeout: 60000 }).then(function (j) { faults = j; go(); }).catch(function (e) { SH.toast(e.message, 'bad'); }); }
  $('#nShowF').addEventListener('change', function () { if (this.checked) loadFaults(); else { if (layF && map) map.removeLayer(layF); legend(); results(); } });

  /* ---------------------------------------------------------------- statistics and rose diagram */
  function stats(list) {
    var bins = new Array(18).fill(0), sx = 0, sy = 0, w = 0, cx = 0, cy = 0; list.forEach(function (l) { bins[Math.floor((l.az % 180) / 10) % 18] += l.L; var a = SH.rad(2 * l.az); sx += l.L * Math.sin(a); sy += l.L * Math.cos(a); w += l.L; cx += Math.sin(a); cy += Math.cos(a); });
    var n = list.length, Rn = Math.hypot(cx, cy), Rb = n ? Rn / n : 0, z = n ? Rn * Rn / n : 0, p = n ? Math.min(1, Math.exp(Math.sqrt(1 + 4 * n + 4 * (n * n - Rn * Rn)) - (1 + 2 * n))) : 1;
    return { bins: bins, mean: ((SH.deg(Math.atan2(sx, sy)) / 2) + 180) % 180, Rw: w ? Math.hypot(sx, sy) / w : 0, n: n, Rb: Rb, z: z, p: p, L: w };
  }
  var LAST = null;
  function results() {
    var list = visible(), o = $('#nOut'); if (!list.length) { o.innerHTML = '<span class="xsmall muted">' + t('No lineament to analyse.', 'لا توجد خطيات للتحليل.') + '</span>'; LAST = null; return; }
    var st = stats(list), area = aoi ? km(aoi).w * km(aoi).h : 0, kinds = {}; list.forEach(function (l) { var k = l.src === 'auto' ? l.kind : 'user'; kinds[k] = kinds[k] || { n: 0, L: 0 }; kinds[k].n++; kinds[k].L += l.L; });
    var Ls = list.map(function (l) { return l.L; }).sort(function (a, b) { return a - b; }), med = Ls[Math.floor(Ls.length / 2)];
    var fl = null; if (faults && faults.inArea && $('#nShowF').checked && faults.inArea.length) fl = stats(faults.inArea.map(function (ll) { return { L: lineLen(ll), az: trend(ll) }; }));
    var diff = fl ? Math.abs(((st.mean - fl.mean) % 180 + 270) % 180 - 90) : null;
    LAST = { st: st, fl: fl, list: list };
    o.innerHTML = '<div class="ln-card"><b class="h">' + t('Lineaments', 'الخطيات') + '</b><span><b class="ltr">' + list.length + '</b> ' + t('lineaments with ', 'خطية بطول كلي ') + '<b class="ltr">' + SH.fmt(st.L / 1000, 1) + ' km</b>' + t(' in total; median length ', '؛ والطول الوسيط ') + '<span class="ltr">' + SH.fmt(med / 1000, 2) + ' km</span>' + (area ? t('; density ', '؛ والكثافة ') + '<b class="ltr">' + SH.fmt(st.L / 1000 / area, 3) + ' km/km²</b>' : '') + '.</span>' +
      '<table class="ln-tbl"><thead><tr><th>' + t('Kind', 'النوع') + '</th><th class="num">' + t('Number', 'العدد') + '</th><th class="num">' + t('Length', 'الطول') + '</th></tr></thead><tbody>' + Object.keys(kinds).map(function (k) { return '<tr><td><i style="display:inline-block;width:14px;height:4px;border-radius:2px;background:' + KN[k][1] + '"></i> ' + KN[k][0] + '</td><td class="num">' + kinds[k].n + '</td><td class="num"><span class="ltr">' + SH.fmt(kinds[k].L / 1000, 1) + ' km</span></td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="ln-rose" id="nRose"></div><span>' + t('Mean direction ', 'الاتجاه المتوسط ') + '<b class="ltr">' + p3(st.mean) + '° – ' + p3(st.mean + 180) + '°</b>' + t(' (length-weighted, R̄ = ', ' (موزون بالطول، R̄ = ') + '<span class="ltr">' + SH.fmt(st.Rw, 2) + '</span>). ' + t('Rayleigh test: ', 'اختبار رايلي: ') + '<span class="ltr">n = ' + st.n + ', z = ' + SH.fmt(st.z, 2) + ', p ' + (st.p < 0.001 ? '< 0.001' : '= ' + SH.fmt(st.p, 3)) + '</span> — ' +
      (st.p < 0.05 ? t('the lineaments have a preferred direction.', 'للخطيات اتجاه مفضل.') : t('no single preferred direction at the 5 % level.', 'لا يوجد اتجاه مفضل واحد عند مستوى 5 %.')) + '</span>' +
      (function () { var tot = st.bins.reduce(function (a, b) { return a + b; }, 0) || 1, pk = []; st.bins.forEach(function (v, i) { var l = st.bins[(i + 17) % 18], r = st.bins[(i + 1) % 18]; if (v >= l && v >= r && v / tot >= 0.09) pk.push([i, v / tot]); }); pk.sort(function (a, b) { return b[1] - a[1]; }); pk = pk.slice(0, 3);
        if (!pk.length) return ''; return '<span>' + t('Main direction sets (classes with the most length): ', 'مجموعات الاتجاه الرئيسة (الفئات الأكثر طولاً): ') + pk.map(function (q) { return '<b class="ltr">' + p3(q[0] * 10) + '–' + p3(q[0] * 10 + 10) + '°</b> <span class="ltr">(' + SH.fmt(100 * q[1], 0) + ' %)</span>'; }).join(t(', ', '، ')) + '.' +
          (pk.length > 1 && st.p >= 0.05 ? ' ' + t('Several sets cancel each other in the mean, so the Rayleigh test, which looks for one direction, cannot detect them; read the sets from the rose instead.', 'المجموعات المتعددة يلغي بعضها بعضاً في المتوسط، فلا يكشفها اختبار رايلي الذي يبحث عن اتجاه واحد؛ اقرأ المجموعات من الوردة.') : '') + '</span>'; })() +
      (fl ? '<span>' + t('Active faults of the atlas in the area: ', 'الفوالق النشطة من الأطلس في المنطقة: ') + '<b class="ltr">' + fl.n + '</b>' + t(', mean direction ', '، اتجاهها المتوسط ') + '<b class="ltr">' + p3(fl.mean) + '° – ' + p3(fl.mean + 180) + '°</b>' + t('; the two directions differ by ', '؛ ويختلف الاتجاهان بـ') + '<b class="ltr">' + SH.fmt(diff, 0) + '°</b>. ' + (diff <= 20 ? t('The lineaments follow the active fault trend.', 'الخطيات تتبع اتجاه الفوالق النشطة.') : diff >= 60 ? t('The lineaments run across the active fault trend: they may be cross-faults, joints or drainage.', 'الخطيات تقطع اتجاه الفوالق النشطة: قد تكون فوالق مستعرضة أو فواصل أو تصريفاً.') : t('The lineaments are oblique to the active fault trend.', 'الخطيات مائلة على اتجاه الفوالق النشطة.')) + '</span>' : '') + '</div>';
    rose($('#nRose'), st, fl, false);
  }
  function rose(host, r, fl, forSheet) {
    var W = forSheet ? 640 : 340, cx = W / 2, cy = W / 2 + (forSheet ? 46 : 0), RR = W * 0.36, H = forSheet ? W + 170 : W, s = '', mx = Math.max.apply(null, r.bins) || 1, Rd = SH.rad, tot = r.bins.reduce(function (a, b) { return a + b; }, 0) || 1;
    var P = function (a0, rr) { var a1 = a0 + 10; return 'M' + cx + ' ' + cy + 'L' + (cx + rr * Math.sin(Rd(a0))).toFixed(2) + ' ' + (cy - rr * Math.cos(Rd(a0))).toFixed(2) + 'A' + rr.toFixed(2) + ' ' + rr.toFixed(2) + ' 0 0 1 ' + (cx + rr * Math.sin(Rd(a1))).toFixed(2) + ' ' + (cy - rr * Math.cos(Rd(a1))).toFixed(2) + 'Z'; };
    var ax = function (m, col, dash, wd) { return '<line x1="' + (cx - (RR + 3) * Math.sin(Rd(m))).toFixed(1) + '" y1="' + (cy + (RR + 3) * Math.cos(Rd(m))).toFixed(1) + '" x2="' + (cx + (RR + 3) * Math.sin(Rd(m))).toFixed(1) + '" y2="' + (cy - (RR + 3) * Math.cos(Rd(m))).toFixed(1) + '" stroke="' + col + '" stroke-width="' + wd + '" stroke-dasharray="' + dash + '"/>'; };
    s += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    if (forSheet) s += '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" fill="none" stroke="#1B232B" stroke-width="1.2"/><text x="' + cx + '" y="34" text-anchor="middle" font-size="17" font-weight="800" fill="#1B232B">' + SH.esc(t('Rose diagram of lineament directions', 'مخطط وردة لاتجاهات الخطيات')) + '</text>';
    [0.25, 0.5, 0.75, 1].forEach(function (f) { s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (RR * Math.sqrt(f)).toFixed(1) + '" fill="none" ' + (f < 1 ? 'stroke="#d0d4d8" stroke-dasharray="3 3"' : 'stroke="#1B232B" stroke-width="1.3"') + '/><text x="' + (cx + 4) + '" y="' + (cy - RR * Math.sqrt(f) + 12).toFixed(1) + '" font-size="9" fill="#55616B" direction="ltr">' + SH.fmt(100 * f * mx / tot, 1) + '%</text>'; });
    r.bins.forEach(function (c, i) { if (!c) return; var rr = RR * Math.sqrt(c / mx); [i * 10, i * 10 + 180].forEach(function (a0) { s += '<path d="' + P(a0, rr) + '" fill="rgba(0,150,199,.5)" stroke="#035e7b" stroke-width=".8"/>'; }); });
    for (var a = 0; a < 360; a += 10) { var l = a % 30 === 0 ? 8 : 4; s += '<line x1="' + (cx + RR * Math.sin(Rd(a))).toFixed(1) + '" y1="' + (cy - RR * Math.cos(Rd(a))).toFixed(1) + '" x2="' + (cx + (RR + l) * Math.sin(Rd(a))).toFixed(1) + '" y2="' + (cy - (RR + l) * Math.cos(Rd(a))).toFixed(1) + '" stroke="#1B232B" stroke-width=".8"/>'; if (a % 30 === 0 && a) s += '<text x="' + (cx + (RR + 20) * Math.sin(Rd(a))).toFixed(1) + '" y="' + (cy - (RR + 20) * Math.cos(Rd(a)) + 4).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#55616B" direction="ltr">' + p3(a) + '</text>'; }
    s += '<text x="' + cx + '" y="' + (cy - RR - 13) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#1B232B">N</text>' + ax(r.mean, '#1B232B', '7 4', 1.6) + (fl ? ax(fl.mean, COL.fault, '2 3', 2.2) : '');
    if (forSheet) { var y0 = cy + RR + 50, rows = [t('Petals: share of lineament length in 10° classes (bidirectional)', 'البتلات: نسبة طول الخطيات في فئات 10° (ثنائية الاتجاه)'), t('Black dashed line: mean direction ', 'الخط الأسود المتقطع: الاتجاه المتوسط ') + p3(r.mean) + '° – ' + p3(r.mean + 180) + '°, R̄ = ' + SH.fmt(r.Rw, 2),
        t('Rayleigh test, ', 'اختبار رايلي، ') + 'n = ' + r.n + ', z = ' + SH.fmt(r.z, 2) + ', p ' + (r.p < 0.001 ? '< 0.001' : '= ' + SH.fmt(r.p, 3))];
      if (fl) rows.push(t('Orange dotted line: mean direction of the active faults ', 'الخط البرتقالي المنقّط: الاتجاه المتوسط للفوالق النشطة ') + p3(fl.mean) + '° – ' + p3(fl.mean + 180) + '° (n = ' + fl.n + ')');
      if (aoi) rows.push(t('Area ', 'المنطقة ') + aoi.s.toFixed(3) + '°–' + aoi.n.toFixed(3) + '° N, ' + aoi.w.toFixed(3) + '°–' + aoi.e.toFixed(3) + '° E');
      rows.forEach(function (tx, k) { s += '<text x="' + cx + '" y="' + (y0 + k * 20) + '" text-anchor="middle" font-size="12" fill="#1B232B"' + (AR ? ' direction="rtl"' : '') + '>' + SH.esc(tx) + '</text>'; }); }
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">' + s + '</svg>'; return host.firstChild;
  }

  /* ---------------------------------------------------------------- downloads */
  function need() { if (!visible().length) { SH.toast(t('Extract or draw lineaments first.', 'استخرج الخطيات أو ارسمها أولاً.'), 'warn'); return false; } return true; }
  var fname = function (x) { return 'Shandal-lineaments-' + new Date().toISOString().slice(0, 10) + x; };
  function feats() { return visible().map(function (l) { return { type: 'Feature', properties: { id: l.id, kind: l.src === 'auto' ? l.kind : 'user', kind_ar: KN[l.src === 'auto' ? l.kind : 'user'][0], name: l.name || '', length_m: Math.round(l.L), trend_deg: Math.round(l.az), source: l.src === 'auto' ? 'automatic, 30 m elevation model' : 'user' }, geometry: { type: 'LineString', coordinates: l.pts.map(function (q) { return [+q[1].toFixed(6), +q[0].toFixed(6)]; }) } }; }); }
  $('#nGj').addEventListener('click', function () { if (!need()) return; SH.json(fname('.geojson'), { type: 'FeatureCollection', name: 'Lineaments · Shandal System', features: feats() }); });
  $('#nCsv').addEventListener('click', function () { if (!need()) return; var rows = [['id', 'kind', 'name', 'length_m', 'trend_deg', 'start_lat', 'start_lon', 'end_lat', 'end_lon']];
    feats().forEach(function (f) { var p = f.properties, c = f.geometry.coordinates; rows.push([p.id, p.kind, p.name, p.length_m, p.trend_deg, c[0][1], c[0][0], c[c.length - 1][1], c[c.length - 1][0]]); });
    rows.push([]); rows.push(['© Shandal Geological Field Survey System · geologicalfieldsurvey.com', new Date().toISOString().slice(0, 10)]); SH.csv(fname('.csv'), rows); });
  $('#nKml').addEventListener('click', function () { if (!need()) return; var esc = function (s) { return String(s == null ? '' : s).replace(/[<&>]/g, function (c) { return { '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]; }); }, kc = function (h) { h = h.replace('#', ''); return 'ff' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };
    var k = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Lineaments · Shandal System</name>' + ['valley', 'ridge', 'user'].map(function (q) { return '<Style id="' + q + '"><LineStyle><color>' + kc(KN[q][1]) + '</color><width>3</width></LineStyle></Style>'; }).join('');
    feats().forEach(function (f) { var p = f.properties; k += '<Placemark><name>' + esc(p.name || p.id) + '</name><styleUrl>#' + p.kind + '</styleUrl><ExtendedData>' + Object.keys(p).map(function (q) { return '<Data name="' + q + '"><value>' + esc(p[q]) + '</value></Data>'; }).join('') + '</ExtendedData><LineString><tessellate>1</tessellate><coordinates>' + f.geometry.coordinates.map(function (q) { return q[0] + ',' + q[1] + ',0'; }).join(' ') + '</coordinates></LineString></Placemark>'; });
    SH.download(fname('.kml'), k + '</Document></kml>', 'application/vnd.google-earth.kml+xml'); });
  $('#nAsc').addEventListener('click', function () { if (!G || !G.done) { SH.toast(t('Extract lineaments first: the density grid needs the elevation grid.', 'استخرج الخطيات أولاً: شبكة الكثافة تحتاج شبكة الارتفاع.'), 'warn'); return; } var Dn = density(), s = 'ncols ' + G.nx + '\nnrows ' + G.ny + '\nxllcorner ' + G.b.w.toFixed(8) + '\nyllcorner ' + G.b.s.toFixed(8) + '\ndx ' + G.dlon.toFixed(10) + '\ndy ' + G.dlat.toFixed(10) + '\nNODATA_value -9999\n', r = [];
    for (var j = 0; j < G.ny; j++) { r.length = 0; for (var i = 0; i < G.nx; i++) r.push(Dn[j * G.nx + i].toFixed(4)); s += r.join(' ') + '\n'; } SH.download(fname('-density.asc'), s, 'text/plain'); SH.toast(t('Lineament density in km per km², geographic coordinates (WGS 84).', 'كثافة الخطيات بالكيلومتر لكل كيلومتر مربع، بالإحداثيات الجغرافية (WGS 84).'), 'info'); });
  $('#nRoseDl').addEventListener('click', function () { if (!need() || !LAST) return; var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(host); SH.svgPng(rose(host, LAST.st, LAST.fl, true), fname('-rose.png'), 2); setTimeout(function () { host.remove(); }, 4000); });
  $('#nSheet').addEventListener('click', function () {
    if (!need() || !D) return; var b = G && G.done ? G.b : aoi; if (!b) { SH.toast(t('Draw the area first.', 'ارسم المنطقة أولاً.'), 'warn'); return; }
    var img = G && G.done ? (SH.val('nBg') === 'density' ? densImg() : G.shade) : null, lines = [], leg = [];
    var add = function (l) { var col = KN[l.src === 'auto' ? l.kind : 'user'][1]; lines.push({ pts: l.pts, color: '#000', width: 4.2 }); lines.push({ pts: l.pts, color: col, width: 2.4 }); };
    visible().forEach(add);
    if ($('#nShowA').checked && auto.length) { leg.push({ color: COL.valley, name: KN.valley[0], width: 3 }); leg.push({ color: COL.ridge, name: KN.ridge[0], width: 3 }); }
    if ($('#nShowM').checked && mine.length) leg.push({ color: COL.user, name: KN.user[0], width: 3 });
    if ($('#nShowF').checked && faults && faults.inArea) { faults.inArea.forEach(function (ll) { lines.push({ pts: ll, color: COL.fault, width: 2.2, dash: '8 5' }); }); if (faults.inArea.length) leg.push({ color: COL.fault, name: t('Active fault (world atlas)', 'فالق نشط (الأطلس العالمي)'), dash: '8 5' }); }
    D.svgMap($('#nSheetSvg'), { b: { n: b.n, s: b.s, e: b.e, w: b.w }, min: 0, max: G && G.densMax ? G.densMax : 1 }, [], { crs: 'geo', fill: false, image: img, noContours: true, grid: true, lines: lines, legend: leg, labels: false,
      gradient: img && SH.val('nBg') === 'density' ? { colors: VIR, min: 0, max: G.densMax || 1 } : null, legendTitle: img && SH.val('nBg') === 'density' ? t('Lineament density (km/km²)', 'كثافة الخطيات (كم/كم²)') : '',
      title: t('Topographic lineaments', 'الخطيات الطبوغرافية'), subtitle: visible().length + t(' lineaments · ', ' خطية · ') + SH.fmt(visible().reduce(function (a, l) { return a + l.L; }, 0) / 1000, 1) + ' km' + (G && G.done ? ' · ' + t('cell ', 'الخلية ') + SH.fmt(G.cell, 0) + ' m' : ''),
      source: t('Elevation model 30 m, multi-directional hillshade; lineaments traced in the Shandal System.', 'نموذج ارتفاع 30 م وظلال تضاريس متعددة الاتجاهات؛ الخطيات متتبَّعة في نظام شندل.'), credit: 'Shandal System' });
    SH.svgPng($('#nSheetSvg'), fname('.png'), 2);
  });
  draw(); results();
  document.addEventListener('sh:beforereport', function (e) { if (!visible().length) { e.preventDefault(); SH.toast(t('Extract or draw lineaments first.', 'استخرج الخطيات أو ارسمها أولاً.'), 'warn'); } });
})();
