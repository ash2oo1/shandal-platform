/* Lineament extraction — topographic lineaments from a 30 m elevation model: Canny edges of hillshades lit from four
   directions, thinned, traced, simplified and linked across short gaps into continuous lineaments (default), or
   elongated zones of strong one-directional curvature fitted by straight segments (alternative); each lineament is
   read against the elevations on both sides (valley, ridge, scarp, relief, width, downthrown side) and ranked by
   length class with an indicative depth reach; geology on both sides of the main lineaments; manual drawing
   and editing, upload of mapped lines, lineament density, rose diagram with mean direction and Rayleigh test, comparison
   with the active faults of the world atlas, framed map sheet and GeoJSON / KML / CSV / ASCII-grid downloads. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', D = SH.dem;
  var persist = SH.persist('lineaments2', ['nMeth', 'nRes', 'nSens', 'nMin', 'nKind', 'nGap', 'nAng', 'nCol', 'nBg', 'nOp']);
  var map = SH.map('nMap', { zoom: 7, base: 'satellite', center: [35.4, 45.3] });
  var RND = L ? L.canvas({ tolerance: 7 }) : null;
  var COL = { valley: '#00e5ff', ridge: '#ff3df2', scarp: '#76ff03', subtle: '#ffffff', user: '#ffd60a', fault: '#ff5a1f' };
  var CCOL = { local: '#8ecae6', inter: '#ffd166', major: '#ff7b00', regional: '#e5001c' }, CW = { local: 1.8, inter: 2.6, major: 3.6, regional: 4.6 };
  var aoi = SH.store.get('shandal_ln_aoi', null), aoiLay = null, drawer = null, G = null, bgLay = null, geoLay = null, layA = null, layM = null, layF = null, busy = false;
  var auto = [], mine = SH.store.get('shandal_ln_mine', []), faults = null, drawing = null;
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
  function extractCurv(Z) {
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
    G.slope = S; G.z = Z; G.zs = ZS;
    var pc = { low: 0.93, mid: 0.88, high: 0.82 }[SH.val('nSens')] || 0.88, srt = Array.prototype.slice.call(AN).sort(function (a, b) { return a - b; }), th = Math.max(srt[Math.floor(n * pc)], 1.2 / (dx * dy)), M = new Uint8Array(n), kind = SH.val('nKind');
    for (c = 0; c < n; c++) { var ci = c % nx, cj = (c - ci) / nx; if (AN[c] > th && S[c] > 0.4 && ci > 1 && cj > 1 && ci < nx - 2 && cj < ny - 2 && (kind === 'all' || (kind === 'valley') === (sgn[c] > 0))) M[c] = 1; }
    var DI = [-1, 0, 1, -1, 1, -1, 0, 1], DJ = [-1, -1, -1, 0, 0, 1, 1, 1], lab = new Int32Array(n).fill(-1), stack = [], out = [], seg = [], minL = Math.max(+SH.val('nMin') || 0, 3 * G.cell);
    /* principal-axis fit: a zone that is not straight enough (axis ratio < 3) is split at its median and refitted */
    function fit(comp, kindC, depth) {
      if (comp.length < 4) return; var mx = 0, my = 0; comp.forEach(function (u) { mx += u % nx; my += (u - u % nx) / nx; }); mx /= comp.length; my /= comp.length;
      var cxx = 0, cyy = 0, cxy = 0; comp.forEach(function (u) { var ex = (u % nx - mx) * dx, ey = ((u - u % nx) / nx - my) * dy; cxx += ex * ex; cyy += ey * ey; cxy += ex * ey; }); cxx /= comp.length; cyy /= comp.length; cxy /= comp.length;
      var tt = cxx + cyy, dd = Math.sqrt(Math.pow(cxx - cyy, 2) + 4 * cxy * cxy), la = (tt + dd) / 2, lb = Math.max((tt - dd) / 2, 1e-6), ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy), ux = Math.cos(ang), uy = Math.sin(ang);
      var pr = comp.map(function (u) { return ((u % nx - mx) * dx) * ux + (((u - u % nx) / nx - my) * dy) * uy; });
      if (la / lb < 9) { if (depth < 4 && comp.length >= 10) { var srt2 = pr.slice().sort(function (a, b) { return a - b; }), med = srt2[Math.floor(srt2.length / 2)]; fit(comp.filter(function (u, k2) { return pr[k2] < med; }), kindC, depth + 1); fit(comp.filter(function (u, k2) { return pr[k2] >= med; }), kindC, depth + 1); } return; }
      var p0 = Math.min.apply(null, pr), p1 = Math.max.apply(null, pr); if (p1 - p0 < 2 * G.cell) return;
      var X = mx * dx, Y = my * dy; seg.push({ a: [X + p0 * ux, Y + p0 * uy], b: [X + p1 * ux, Y + p1 * uy], kind: kindC, cells: comp.length });
    }
    /* collinear merge: pieces of one ridge or valley broken by a saddle or a gully are joined when they keep the same
       direction (within 10°), lie on one line (offset under 1.5 cells) and the gap between them is short (under 6 cells) */
    function mergeSegs() {
      var tol = SH.rad(10), off = 1.5 * G.cell, gap = 6 * G.cell, changed = true;
      var dir = function (s) { return Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]); };
      var perp = function (s, p) { var vx = s.b[0] - s.a[0], vy = s.b[1] - s.a[1], L = Math.hypot(vx, vy) || 1; return Math.abs((p[0] - s.a[0]) * vy - (p[1] - s.a[1]) * vx) / L; };
      var dd = function (p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]); };
      while (changed) { changed = false;
        for (var x1 = 0; x1 < seg.length && !changed; x1++) for (var x2 = x1 + 1; x2 < seg.length; x2++) { var s1 = seg[x1], s2 = seg[x2]; if (s1.kind !== s2.kind) continue;
          var da = Math.abs(dir(s1) - dir(s2)) % Math.PI; da = Math.min(da, Math.PI - da); if (da > tol) continue;
          var g = Math.min(dd(s1.a, s2.a), dd(s1.a, s2.b), dd(s1.b, s2.a), dd(s1.b, s2.b)); if (g > gap) continue;
          if (Math.max(perp(s1, s2.a), perp(s1, s2.b), perp(s2, s1.a), perp(s2, s1.b)) > off) continue;
          var P = [s1.a, s1.b, s2.a, s2.b], best = [0, 1], bl = -1; for (var e1 = 0; e1 < 4; e1++) for (var e2 = e1 + 1; e2 < 4; e2++) { var l = dd(P[e1], P[e2]); if (l > bl) { bl = l; best = [e1, e2]; } }
          seg[x1] = { a: P[best[0]], b: P[best[1]], kind: s1.kind, cells: s1.cells + s2.cells }; seg.splice(x2, 1); changed = true; break; } }
    }
    for (c = 0; c < n; c++) { if (!M[c] || lab[c] >= 0) continue; var comp = []; stack.push(c); lab[c] = c;
      while (stack.length) { var u = stack.pop(), ui = u % nx, uj = (u - ui) / nx; comp.push(u); for (k = 0; k < 8; k++) { var vi = ui + DI[k], vj = uj + DJ[k]; if (vi < 0 || vj < 0 || vi >= nx || vj >= ny) continue; var v = vj * nx + vi; if (M[v] && lab[v] < 0 && sgn[v] === sgn[c]) { lab[v] = c; stack.push(v); } } }
      fit(comp, sgn[c] > 0 ? 'valley' : 'ridge', 0); }
    mergeSegs();
    var toLL = function (p) { return [G.b.n - (p[1] / dy + 0.5) * G.dlat, G.b.w + (p[0] / dx + 0.5) * G.dlon]; };
    seg.forEach(function (s2) { if (Math.hypot(s2.b[0] - s2.a[0], s2.b[1] - s2.a[1]) >= minL) out.push({ pts: [toLL(s2.a), toLL(s2.b)], xy: [s2.a, s2.b], kind: s2.kind, cells: s2.cells, src: 'auto', meth: 'curv' }); });
    return out;
  }
  /* ---------------------------------------------------------------- edge detection and linking (default method)
     After the LINE algorithm of PCI Geomatica and Abdullah et al. (2010): the terrain is lit from four directions
     (0°, 45°, 90°, 135°, low sun), each shaded relief goes through the Canny (1986) detector (Gaussian smoothing,
     Sobel gradient, non-maximum suppression, hysteresis), the four edge maps are combined and thinned to one-cell
     curves (Zhang & Suen 1984), the curves are traced, simplified (Douglas & Peucker 1973), cut where they bend, and
     collinear pieces separated by short gaps are linked into continuous lineaments. Every lineament is then read
     against the elevations on both sides (valley, ridge or scarp, relief, width, downthrown side). */
  function fillSmooth(Z) {
    var nx = G.nx, ny = G.ny, n = G.n, c, i, j, mean = 0, cnt = 0;
    for (c = 0; c < n; c++) if (isFinite(Z[c])) { mean += Z[c]; cnt++; } mean /= cnt || 1; for (c = 0; c < n; c++) if (!isFinite(Z[c])) Z[c] = mean;
    var ZS = new Float32Array(n); for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var s = 0, q = 0; for (var b = -1; b <= 1; b++) for (var a = -1; a <= 1; a++) { var ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; s += Z[jj * nx + ii]; q++; } ZS[j * nx + i] = s / q; }
    G.z = Z; G.zs = ZS; return ZS;
  }
  function gauss(A, nx, ny, sg) {
    var r = Math.max(1, Math.ceil(2.5 * sg)), w = [], ws = 0, k, i, j; for (k = -r; k <= r; k++) { var v = Math.exp(-k * k / (2 * sg * sg)); w.push(v); ws += v; } w = w.map(function (v) { return v / ws; });
    var T = new Float32Array(nx * ny), O = new Float32Array(nx * ny);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var s = 0; for (k = -r; k <= r; k++) { var ii = i + k; ii = ii < 0 ? 0 : ii >= nx ? nx - 1 : ii; s += w[k + r] * A[j * nx + ii]; } T[j * nx + i] = s; }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var s2 = 0; for (k = -r; k <= r; k++) { var jj = j + k; jj = jj < 0 ? 0 : jj >= ny ? ny - 1 : jj; s2 += w[k + r] * T[jj * nx + i]; } O[j * nx + i] = s2; }
    return O;
  }
  /* Sobel gradient of one smoothed shaded relief */
  function sobel(Hs, nx, ny) {
    var B = gauss(Hs, nx, ny, 1.2), n = nx * ny, GX = new Float32Array(n), GY = new Float32Array(n), i, j, c;
    var at = function (i, j) { i = i < 0 ? 0 : i >= nx ? nx - 1 : i; j = j < 0 ? 0 : j >= ny ? ny - 1 : j; return B[j * nx + i]; };
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { c = j * nx + i; GX[c] = (at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i - 1, j) + at(i - 1, j + 1)); GY[c] = (at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i, j - 1) + at(i + 1, j - 1)); }
    return [GX, GY];
  }
  /* Canny non-maximum suppression and hysteresis on a combined gradient field: returns a 0/1 edge map */
  function canny(M, AN, nx, ny, q) {
    var n = nx * ny, N = new Float32Array(n), vals = [], i, j, c;
    for (j = 1; j < ny - 1; j++) for (i = 1; i < nx - 1; i++) { c = j * nx + i; var m = M[c], a1, a2, an = AN[c], d = an < 22.5 || an >= 157.5 ? 0 : an < 67.5 ? 1 : an < 112.5 ? 2 : 3;
      if (d === 0) { a1 = M[c - 1]; a2 = M[c + 1]; } else if (d === 1) { a1 = M[c - nx - 1]; a2 = M[c + nx + 1]; } else if (d === 2) { a1 = M[c - nx]; a2 = M[c + nx]; } else { a1 = M[c - nx + 1]; a2 = M[c + nx - 1]; }
      if (m > 0 && m >= a1 && m > a2) { N[c] = m; vals.push(m); } }
    if (!vals.length) return new Uint8Array(n);
    vals.sort(function (a, b) { return a - b; }); var hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * q))], lo = 0.4 * hi, E = new Uint8Array(n), st = [];
    for (c = 0; c < n; c++) if (N[c] >= hi) { E[c] = 1; st.push(c); }
    while (st.length) { var u = st.pop(), ui = u % nx, uj = (u - ui) / nx; for (var b2 = -1; b2 <= 1; b2++) for (var a2b = -1; a2b <= 1; a2b++) { var vi = ui + a2b, vj = uj + b2; if (vi < 1 || vj < 1 || vi >= nx - 1 || vj >= ny - 1) continue; var v = vj * nx + vi; if (!E[v] && N[v] >= lo) { E[v] = 1; st.push(v); } } }
    return E;
  }
  /* Zhang–Suen thinning of a binary image to one-cell curves */
  function thin(E, nx, ny) {
    var ch = true, del = [], i, j, c;
    var P = function (c) { return [E[c - nx], E[c - nx + 1], E[c + 1], E[c + nx + 1], E[c + nx], E[c + nx - 1], E[c - 1], E[c - nx - 1]]; };
    while (ch) { ch = false;
      for (var pass = 0; pass < 2; pass++) { del.length = 0;
        for (j = 1; j < ny - 1; j++) for (i = 1; i < nx - 1; i++) { c = j * nx + i; if (!E[c]) continue; var p = P(c), B = 0, A = 0, k; for (k = 0; k < 8; k++) { B += p[k]; if (!p[k] && p[(k + 1) % 8]) A++; }
          if (B < 2 || B > 6 || A !== 1) continue;
          if (pass === 0 ? (p[0] * p[2] * p[4] === 0 && p[2] * p[4] * p[6] === 0) : (p[0] * p[2] * p[6] === 0 && p[0] * p[4] * p[6] === 0)) del.push(c); }
        if (del.length) { ch = true; del.forEach(function (q) { E[q] = 0; }); } } }
    return E;
  }
  /* Douglas–Peucker on [x, y] points in metres */
  function dp(P, eps) {
    if (P.length < 3) return P.slice(); var keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; var st = [[0, P.length - 1]];
    while (st.length) { var r = st.pop(), a = r[0], b = r[1], ax = P[a][0], ay = P[a][1], vx = P[b][0] - ax, vy = P[b][1] - ay, L = Math.hypot(vx, vy) || 1e-9, mx = -1, mi = -1;
      for (var k = a + 1; k < b; k++) { var d = Math.abs((P[k][0] - ax) * vy - (P[k][1] - ay) * vx) / L; if (d > mx) { mx = d; mi = k; } }
      if (mx > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return P.filter(function (q, k) { return keep[k]; });
  }
  var plen = function (P) { var s = 0; for (var k = 1; k < P.length; k++) s += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); return s; };
  /* outward unit direction at one end, from the end point back along the line over about six cells */
  function endDir(P, atStart) {
    var Q = atStart ? P : P.slice().reverse(), want = Math.min(6 * G.cell, plen(P) / 2), acc = 0, k = 1;
    for (; k < Q.length - 1; k++) { acc += Math.hypot(Q[k][0] - Q[k - 1][0], Q[k][1] - Q[k - 1][1]); if (acc >= want) break; }
    var vx = Q[0][0] - Q[k][0], vy = Q[0][1] - Q[k][1], L = Math.hypot(vx, vy) || 1; return [vx / L, vy / L];
  }
  function link(S, gap, atol) {
    var cosT = Math.cos(atol), added = 1, pass = 0;
    while (added && pass++ < 4) { added = 0;
      var E2 = [], H = {}, key = function (p) { return Math.floor(p[0] / gap) + ':' + Math.floor(p[1] / gap); };
      S.forEach(function (P, si) { [0, 1].forEach(function (e) { var p = e ? P[P.length - 1] : P[0], o = { s: si, e: e, p: p, u: endDir(P, !e) }; E2.push(o); (H[key(p)] = H[key(p)] || []).push(o); }); });
      var cand = [];
      E2.forEach(function (A) { var gx = Math.floor(A.p[0] / gap), gy = Math.floor(A.p[1] / gap);
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) (H[(gx + a) + ':' + (gy + b)] || []).forEach(function (B) {
          if (B.s <= A.s) return; var dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1], d = Math.hypot(dx, dy); if (d > gap) return;
          var opp = -(A.u[0] * B.u[0] + A.u[1] * B.u[1]); if (opp < cosT) return;
          /* B must lie ahead of A (and A ahead of B), and its lateral step from A's line must stay small: en-echelon
             pieces of one crest or valley, offset sideways by a cell or two, are joined; side-by-side lines are not */
          var alA = dx * A.u[0] + dy * A.u[1], alB = -(dx * B.u[0] + dy * B.u[1]), ltA = Math.abs(dx * A.u[1] - dy * A.u[0]), ltB = Math.abs(dx * B.u[1] - dy * B.u[0]);
          if (alA < -G.cell || alB < -G.cell) return; if (ltA > Math.max(2 * G.cell, 0.35 * alA) || ltB > Math.max(2 * G.cell, 0.35 * alB)) return;
          cand.push({ A: A, B: B, sc: d / gap + Math.acos(Math.min(1, opp)) / atol }); }); });
      if (!cand.length) break; cand.sort(function (x, y) { return x.sc - y.sc; });
      var par = S.map(function (q, k) { return k; }), fd = function (x) { while (par[x] !== x) x = par[x] = par[par[x]]; return x; }, used = {}, nb = S.map(function () { return [null, null]; });
      cand.forEach(function (c) { var ka = c.A.s + '_' + c.A.e, kb = c.B.s + '_' + c.B.e; if (used[ka] || used[kb]) return; var ra = fd(c.A.s), rb = fd(c.B.s); if (ra === rb) return; par[ra] = rb; used[ka] = used[kb] = 1; nb[c.A.s][c.A.e] = [c.B.s, c.B.e]; nb[c.B.s][c.B.e] = [c.A.s, c.A.e]; added++; });
      if (!added) break;
      var seen = new Uint8Array(S.length), out = [];
      var walk = function (s0, en) { var P = [], s = s0; while (s != null && !seen[s]) { seen[s] = 1; var Q = S[s]; P = P.concat(en === 0 ? Q : Q.slice().reverse()); var nx2 = nb[s][1 - en]; if (!nx2) break; s = nx2[0]; en = nx2[1]; } return P; };
      S.forEach(function (q, k) { if (seen[k]) return; if (!nb[k][0]) out.push(walk(k, 0)); else if (!nb[k][1]) out.push(walk(k, 1)); });
      S.forEach(function (q, k) { if (!seen[k]) out.push(walk(k, 0)); });
      S = out; }
    return S;
  }
  function extractLine(Z) {
    var nx = G.nx, ny = G.ny, n = G.n, dx = G.dx, dy = G.dy, i, j, c, k;
    var ZS = fillSmooth(Z), q = { low: 0.92, mid: 0.86, high: 0.78 }[SH.val('nSens')] || 0.86, alt = SH.rad(30), zen = Math.PI / 2 - alt;
    var at = function (i, j) { i = i < 0 ? 0 : i >= nx ? nx - 1 : i; j = j < 0 ? 0 : j >= ny ? ny - 1 : j; return ZS[j * nx + i]; };
    var SL = new Float32Array(n), AS = new Float32Array(n);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var gx = ((at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i - 1, j) + at(i - 1, j + 1))) / (8 * dx), gy = ((at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i, j - 1) + at(i + 1, j - 1))) / (8 * dy);
      c = j * nx + i; SL[c] = Math.atan(Math.hypot(gx, gy)); AS[c] = Math.atan2(gy, -gx); }
    G.slope = SL.map(function (v) { return SH.deg(v); });
    /* each light shows best the edges that face it; every cell keeps the strongest normalised gradient of the four
       lights with its direction, so that one landform gives one edge, not four slightly shifted ones */
    var M = new Float32Array(n), AN = new Float32Array(n);
    [0, 45, 90, 135].forEach(function (az0) { var HS = new Float32Array(n), az = SH.rad(360 - az0 + 90); for (c = 0; c < n; c++) HS[c] = Math.max(0, Math.cos(zen) * Math.cos(SL[c]) + Math.sin(zen) * Math.sin(SL[c]) * Math.cos(az - AS[c]));
      var g = sobel(HS, nx, ny), mag = new Float32Array(n); for (c = 0; c < n; c++) mag[c] = Math.hypot(g[0][c], g[1][c]);
      var smp = []; for (c = 0; c < n; c += 7) smp.push(mag[c]); smp.sort(function (a, b) { return a - b; }); var ref = smp[Math.floor(smp.length * 0.9)] || 1;
      for (c = 0; c < n; c++) { var v = mag[c] / ref; if (v > M[c]) { M[c] = v; AN[c] = (Math.atan2(g[1][c], g[0][c]) * 180 / Math.PI + 180) % 180; } } });
    var DIL = canny(M, AN, nx, ny, q);
    for (i = 0; i < nx; i++) { DIL[i] = DIL[nx + i] = DIL[(ny - 1) * nx + i] = DIL[(ny - 2) * nx + i] = 0; } for (j = 0; j < ny; j++) { DIL[j * nx] = DIL[j * nx + 1] = DIL[j * nx + nx - 1] = DIL[j * nx + nx - 2] = 0; }
    var T = thin(DIL, nx, ny);
    /* curves on gentle ground (slope under 1°) are tonal noise of the model, not landforms */
    for (c = 0; c < n; c++) if (T[c] && SL[c] < SH.rad(1)) T[c] = 0;
    /* split the skeleton at junctions (crossing number of 3 or more) and trace the simple curves */
    var OFF = [-nx, -nx + 1, 1, nx + 1, nx, nx - 1, -1, -nx - 1], cross = new Uint8Array(n), nbn = new Uint8Array(n);
    for (j = 1; j < ny - 1; j++) for (i = 1; i < nx - 1; i++) { c = j * nx + i; if (!T[c]) continue; var tr2 = 0, sm = 0; for (k = 0; k < 8; k++) { sm += T[c + OFF[k]]; if (!T[c + OFF[k]] && T[c + OFF[(k + 1) % 8]]) tr2++; } cross[c] = tr2; nbn[c] = sm; }
    for (c = 0; c < n; c++) if (T[c] && cross[c] >= 3) T[c] = 0;
    var vis = new Uint8Array(n), chains = [];
    var trace = function (c0) { var P = [], cur = c0; while (cur >= 0) { vis[cur] = 1; P.push([(cur % nx) * dx, Math.floor(cur / nx) * dy]); var nxt = -1; for (k = 0; k < 8; k += 2) { var v = cur + OFF[k]; if (T[v] && !vis[v]) { nxt = v; break; } } if (nxt < 0) for (k = 1; k < 8; k += 2) { var v2 = cur + OFF[k]; if (T[v2] && !vis[v2]) { nxt = v2; break; } } cur = nxt; } return P; };
    var deg = function (c) { var s = 0; for (k = 0; k < 8; k++) s += T[c + OFF[k]]; return s; };
    for (c = 0; c < n; c++) if (T[c] && !vis[c] && deg(c) <= 1) chains.push(trace(c));
    for (c = 0; c < n; c++) if (T[c] && !vis[c]) chains.push(trace(c));
    /* simplify and cut at bends of more than 30°, so that every piece is close to straight */
    var bend = SH.rad(30), pieces = [];
    chains.forEach(function (P) { if (P.length < 4) return; var Q = dp(P, 1.0 * G.cell), cur = [Q[0]];
      for (var m = 1; m < Q.length; m++) { cur.push(Q[m]); if (m < Q.length - 1) { var a1 = Math.atan2(Q[m][1] - Q[m - 1][1], Q[m][0] - Q[m - 1][0]), a2 = Math.atan2(Q[m + 1][1] - Q[m][1], Q[m + 1][0] - Q[m][0]), da = Math.abs(a2 - a1); da = Math.min(da, 2 * Math.PI - da); if (da > bend) { pieces.push(cur); cur = [Q[m]]; } } }
      pieces.push(cur); });
    pieces = pieces.filter(function (P) { return plen(P) >= 3 * G.cell; });
    G.nPieces = pieces.length;
    var gap = (+SH.val('nGap') || 8) * G.cell, atol = SH.rad(+SH.val('nAng') || 20);
    var L2 = link(pieces, gap, atol), minL = Math.max(+SH.val('nMin') || 0, 4 * G.cell), out = [];
    G.nLinked = pieces.length - L2.length;
    /* one landform can give two parallel edges (top and foot of a scarp, two walls of a valley): a line that runs
       within five cells of a longer one over most of its length is the same lineament and is dropped */
    L2 = L2.map(function (P) { return { P: P, L: plen(P), bb: P.reduce(function (b, q) { return [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])]; }, [1e18, 1e18, -1e18, -1e18]) }; }).sort(function (a, b) { return b.L - a.L; });
    var near = 5 * G.cell, keep2 = [], dseg = function (p, a, b) { var vx = b[0] - a[0], vy = b[1] - a[1], L2b = vx * vx + vy * vy, u = L2b ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2b)) : 0; return Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vy); };
    L2.forEach(function (o) { if (o.L < 2 * G.cell) return; var dup = keep2.some(function (k2) { if (o.bb[0] > k2.bb[2] + near || o.bb[2] < k2.bb[0] - near || o.bb[1] > k2.bb[3] + near || o.bb[3] < k2.bb[1] - near) return false;
        var tot = 0, hit = 0; for (var m = 1; m < o.P.length; m++) { var a = o.P[m - 1], b = o.P[m], st = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / G.cell)); for (var q = 0; q < st; q++) { var f = (q + 0.5) / st, pt = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; tot++; for (var r = 1; r < k2.P.length; r++) if (dseg(pt, k2.P[r - 1], k2.P[r]) <= near) { hit++; break; } } }
        return tot && hit / tot >= 0.6; });
      if (!dup) keep2.push(o); });
    G.nDup = L2.length - keep2.length; L2 = keep2.map(function (o) { return o.P; });
    var toLL = function (p) { return [G.b.n - (p[1] / dy + 0.5) * G.dlat, G.b.w + (p[0] / dx + 0.5) * G.dlon]; };
    L2.forEach(function (P) { var len = plen(P); if (len < minL) return; var Q = dp(P, 0.8 * G.cell), ch = Math.hypot(Q[Q.length - 1][0] - Q[0][0], Q[Q.length - 1][1] - Q[0][1]); if (ch / len < 0.75) return;
      out.push({ pts: Q.map(toLL), xy: Q, src: 'auto', meth: 'line', straight: ch / len }); });
    return out;
  }
  /* ---------------------------------------------------------------- relation to the elevations on both sides */
  function zAt(x, y) { var fi = x / G.dx, fj = y / G.dy, i0 = Math.floor(fi), j0 = Math.floor(fj), u = fi - i0, v = fj - j0, nx = G.nx, ny = G.ny, Z = G.zs;
    var g = function (i, j) { i = i < 0 ? 0 : i >= nx ? nx - 1 : i; j = j < 0 ? 0 : j >= ny ? ny - 1 : j; return Z[j * nx + i]; };
    return (1 - u) * (1 - v) * g(i0, j0) + u * (1 - v) * g(i0 + 1, j0) + (1 - u) * v * g(i0, j0 + 1) + u * v * g(i0 + 1, j0 + 1); }
  var toLLg = function (p) { return [G.b.n - (p[1] / G.dy + 0.5) * G.dlat, G.b.w + (p[0] / G.dx + 0.5) * G.dlon]; };
  /* mean cross-section of the line, from K cells on one side to K cells on the other (positive = left of the
     tracing direction). A valley floor or a crest within four cells of the traced edge is taken as the true
     position of the lineament (an edge of the shaded relief often sits on the wall rather than on the axis). */
  function profile(l) {
    var P = l.xy, K = SH.clamp(Math.round(600 / G.cell), 6, 15), K2 = Math.max(2, Math.ceil(K / 2)), C = new Float64Array(2 * K + 1), ns = 0, nl = [0, 0], tz = 2;
    for (var m = 1; m < P.length; m++) { var ax = P[m - 1][0], ay = P[m - 1][1], vx = P[m][0] - ax, vy = P[m][1] - ay, sl = Math.hypot(vx, vy); if (!sl) continue; var tx = vx / sl, ty = vy / sl, st = Math.max(1, Math.round(sl / G.cell));
      for (var q = 0; q < st; q++) { var f = (q + 0.5) / st, x = ax + vx * f, y = ay + vy * f; ns++; for (var k = -K; k <= K; k++) { var d = k * G.cell; C[k + K] += zAt(x - ty * d, y + tx * d); } }
      nl[0] += -ty * sl; nl[1] += tx * sl; }
    if (!ns) return; for (var k2 = 0; k2 <= 2 * K; k2++) C[k2] /= ns;
    var c = function (k) { k = k < -K ? -K : k > K ? K : k; return C[k + K]; }, mean = function (k0, dir, a, b) { var s2 = 0; for (var j = a; j <= b; j++) s2 += c(k0 + dir * j); return s2 / (b - a + 1); };
    var span = Math.min(4, K - K2), kv = 0, kr = 0; for (var k3 = -span; k3 <= span; k3++) { if (c(k3) < c(kv)) kv = k3; if (c(k3) > c(kr)) kr = k3; }
    var vL = mean(kv, 1, 1, K2) - c(kv), vR = mean(kv, -1, 1, K2) - c(kv), rL = c(kr) - mean(kr, 1, 1, K2), rR = c(kr) - mean(kr, -1, 1, K2);
    var ext = function (k0, dir, sg) { var mx = 0; for (var j = 1; j <= K; j++) mx = Math.max(mx, sg * (c(k0 + dir * j) - c(k0))); return mx; };
    var half = function (k0, dir, sg, top) { for (var j = 1; j <= K; j++) if (sg * (c(k0 + dir * j) - c(k0)) >= 0.5 * top) return j * G.cell; return K * G.cell; };
    var kind, relief, width = null, down = null, k0 = 0, isV = vL > tz && vR > tz, isR = rL > tz && rR > tz;
    if (isV && (!isR || Math.min(vL, vR) >= Math.min(rL, rR))) { kind = 'valley'; k0 = kv; var dL = ext(kv, 1, 1), dR = ext(kv, -1, 1); relief = Math.min(dL, dR); width = half(kv, 1, 1, dL) + half(kv, -1, 1, dR); }
    else if (isR) { kind = 'ridge'; k0 = kr; var hL = ext(kr, 1, -1), hR = ext(kr, -1, -1); relief = Math.min(hL, hR); width = half(kr, 1, -1, hL) + half(kr, -1, -1, hR); }
    else { var fL = mean(0, 1, K2, K), fR = mean(0, -1, K2, K), nearStep = c(2) - c(-2), farG = ((c(K) - c(K2)) - (c(-K) - c(-K2))) / (2 * Math.max(1, K - K2));
      if (Math.abs(fL - fR) > 2 * tz && Math.abs(nearStep) > 2 * tz && Math.abs(nearStep) / 4 > 1.8 * Math.abs(farG)) { kind = 'scarp'; relief = Math.abs(fL - fR); var lowLeft = fL < fR, Lw = Math.hypot(nl[0], nl[1]) || 1, ux = (lowLeft ? 1 : -1) * nl[0] / Lw, uy = (lowLeft ? 1 : -1) * nl[1] / Lw; down = (SH.deg(Math.atan2(ux, -uy)) + 360) % 360;
        var hi = lowLeft ? -1 : 1, lo = -hi, top = Math.max(tz, c(hi * K) - c(0)), bot = Math.max(tz, c(0) - c(lo * K)); width = half(0, hi, 1, top) + half(0, lo, -1, bot); }
      else { kind = 'subtle'; relief = Math.abs(fL - fR); } }
    if (k0) { var Lw2 = Math.hypot(nl[0], nl[1]) || 1, sx = nl[0] / Lw2 * k0 * G.cell, sy = nl[1] / Lw2 * k0 * G.cell; l.xy = P.map(function (p) { return [p[0] + sx, p[1] + sy]; }); l.pts = l.xy.map(toLLg); l.shift = Math.abs(k0) * G.cell; }
    l.kind = kind; l.relief = relief; l.width = width; l.down = down; l.zc = c(k0);
  }
  /* length classes and the indicative depth reach of the structure behind a lineament.
     Fault height grows with fault length (aspect ratio length/height ≈ 1–3 for faults of metres to tens of
     kilometres, Nicol et al. 1996; Schultz & Fossen 2002), and brittle faults stop at the base of the seismogenic
     crust, about 15 km; so length/2 (range length/3–length) is used as an order-of-magnitude guide only. */
  var CLS = [[0, 1000, 'local'], [1000, 5000, 'inter'], [5000, 20000, 'major'], [20000, 1e12, 'regional']];
  function cls(L) { for (var k = 0; k < CLS.length; k++) if (L < CLS[k][1]) return CLS[k][2]; return 'regional'; }
  function finish(list) {
    list.forEach(function (l, i2) { l.id = 'A' + (i2 + 1); l.L = lineLen(l.pts); l.az = trend(l.pts); if (G.zs && l.xy) profile(l); l.cls = cls(l.L); l.dep = Math.min(15000, l.L / 2); });
    list.sort(function (a, b) { return b.L - a.L; }); list.forEach(function (l, i2) { l.id = 'A' + (i2 + 1); });
    return list;
  }
  function extract(Z) { return finish(SH.val('nMeth') === 'curv' ? (function () { var o = extractCurv(Z); return o; })() : extractLine(Z)); }
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
    all.forEach(function (l) { for (var m = 1; m < l.pts.length; m++) { var A = l.pts[m - 1], B = l.pts[m], sl = hav(A, B), st = Math.max(1, Math.ceil(sl / (G.cell / 2))), per = sl / st;
      for (var k = 0; k < st; k++) { var f = (k + 0.5) / st, la = A[0] + (B[0] - A[0]) * f, lo = A[1] + (B[1] - A[1]) * f, i = Math.floor((lo - G.b.w) / G.dlon), j = Math.floor((G.b.n - la) / G.dlat); if (i >= 0 && j >= 0 && i < nx && j < ny) LN[j * nx + i] += per; } } });
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
    getDem().then(function (Z) { $('#nProg').textContent = t('Tracing lineaments…', 'جارٍ تتبع الخطيات…'); return sleep(30).then(function () { var kp = SH.val('nKind'); auto = extract(Z).filter(function (l) { return kp === 'all' || (kp === 'valley' ? l.kind === 'valley' : kp === 'ridge' ? l.kind === 'ridge' || l.kind === 'scarp' : kp === 'scarp' ? l.kind === 'scarp' : true); }); auto.forEach(function (l, i2) { l.id = 'A' + (i2 + 1); }); G.shade = shade(); G.done = true; }); })
      .then(function () { $('#nProg').innerHTML = '<b class="ltr">' + auto.length + '</b> ' + t('lineaments traced on a ', 'خطية تُتُبّعت على شبكة ') + '<span class="ltr">' + G.nx + ' × ' + G.ny + ' · ' + SH.fmt(G.cell, 0) + ' m</span>' + t(' grid', '') + (G.src === 'srtm' ? t(' (fallback elevation model)', ' (نموذج ارتفاع احتياطي)') : '') + '.' + (G.nPieces != null && SH.val('nMeth') !== 'curv' ? ' ' + t('Edge pieces: ', 'قطع الحواف: ') + '<span class="ltr">' + G.nPieces + '</span>' + t(', gaps bridged: ', '، فجوات رُبطت: ') + '<span class="ltr">' + G.nLinked + '</span>.' : '');
        draw(); background(); results(); if ($('#nShowF').checked) loadFaults(); if (map) map.fitBounds([[G.b.s, G.b.w], [G.b.n, G.b.e]]); if (window.innerWidth < 900) $('#nMap').scrollIntoView({ behavior: 'smooth', block: 'start' }); })
      .catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { busy = false; $('#nRun').disabled = false; SH.busy(host, false); });
  }
  $('#nRun').addEventListener('click', run);

  /* ---------------------------------------------------------------- display */
  function visible() { return ($('#nShowA').checked ? auto : []).concat($('#nShowM').checked ? mine : []); }
  var KN = { valley: [t('Linear valley (lower than both sides)', 'وادٍ خطي (أخفض من الجانبين)'), COL.valley], ridge: [t('Ridge (higher than both sides)', 'حافة (أعلى من الجانبين)'), COL.ridge], scarp: [t('Scarp or step (one side higher)', 'جرف أو درجة (جانب أعلى من الآخر)'), COL.scarp], subtle: [t('Slope or tonal line (no step)', 'خط على منحدر أو خط لوني (بلا درجة)'), COL.subtle], user: [t('Drawn or loaded by you', 'رسمتها أو حمّلتها أنت'), COL.user] };
  var CN = { local: t('Local (< 1 km): joints and small fractures, near-surface', 'محلية (< 1 كم): فواصل وكسور صغيرة قريبة من السطح'), inter: t('Intermediate (1–5 km): faults, fracture zones or bedding traces', 'متوسطة (1–5 كم): فوالق أو نطاقات كسور أو آثار تطبق'), major: t('Major (5–20 km): structures that may reach several km', 'رئيسة (5–20 كم): تراكيب قد تمتد كيلومترات في العمق'), regional: t('Regional (> 20 km): deep-seated or basement structures', 'إقليمية (> 20 كم): تراكيب عميقة أو في صخور القاعدة') };
  var CNs = { local: t('local', 'محلية'), inter: t('intermediate', 'متوسطة'), major: t('major', 'رئيسة'), regional: t('regional', 'إقليمية') };
  var kOf = function (l) { return l.src === 'auto' ? l.kind || 'subtle' : 'user'; };
  var colOf = function (l) { return SH.val('nCol') === 'cls' && l.src === 'auto' ? CCOL[l.cls] : KN[kOf(l)][1]; };
  var dkm = function (m) { return m >= 1000 ? SH.fmt(m / 1000, m >= 10000 ? 0 : 1) + ' km' : SH.fmt(Math.max(100, Math.round(m / 100) * 100), 0) + ' m'; };
  function pop(l) { var k = KN[kOf(l)], R = function (h, v) { return v == null || v === '' ? '' : '<tr><td>' + h + '</td><td>' + v + '</td></tr>'; };
    return '<div class="ln-pop"><b>' + k[0] + '</b>' + (l.name ? ' · ' + SH.esc(l.name) : '') + '<table>' +
      R(t('Length', 'الطول'), '<b class="ltr">' + SH.fmt(l.L / 1000, 2) + ' km</b>') + R(t('Trend', 'الاتجاه'), '<b class="ltr">' + p3(l.az) + '° – ' + p3(l.az + 180) + '°</b>') +
      (l.cls ? R(t('Class', 'الصنف'), CN[l.cls]) + R(t('Indicative depth reach', 'العمق الإرشادي'), l.L >= 1000 ? '<span class="ltr">≈ ' + dkm(l.dep) + '</span> <span class="xsmall muted">(' + t('order of magnitude, if it is a fault', 'رتبة مقدار، إن كانت فالقاً') + ')</span>' : t('near-surface', 'قريب من السطح')) : '') +
      (l.relief != null ? R(l.kind === 'valley' ? t('Depth of the valley', 'عمق الوادي') : l.kind === 'ridge' ? t('Height of the ridge', 'ارتفاع الحافة') : l.kind === 'scarp' ? t('Height of the step', 'ارتفاع الدرجة') : t('Relief across', 'التضاريس عبرها'), '<span class="ltr">' + SH.fmt(l.relief, l.relief < 10 ? 1 : 0) + ' m</span>') : '') +
      (l.width ? R(t('Width of the zone', 'عرض النطاق'), '<span class="ltr">' + SH.fmt(l.width, 0) + ' m</span>') : '') +
      (l.down != null ? R(t('Lower (downthrown) side', 'الجانب الأخفض (الهابط)'), t('towards ', 'نحو ') + '<span class="ltr">' + p3(l.down) + '°</span>') : '') +
      (l.zc != null ? R(t('Mean elevation on the line', 'متوسط الارتفاع على الخط'), '<span class="ltr">' + SH.fmt(l.zc, 0) + ' m</span>') : '') +
      (l.straight ? R(t('Straightness', 'الاستقامة'), '<span class="ltr">' + SH.fmt(l.straight, 2) + '</span>') : '') +
      (l.geo ? R(t('Geology across', 'الجيولوجيا عبرها'), l.geo.txt) : '') + '</table>' +
      '<button type="button" class="btn btn-line btn-xs" data-del="' + l.id + '" style="margin-top:6px">' + t('Delete this lineament', 'احذف هذه الخطية') + '</button></div>'; }
  function draw() {
    if (!map) return; layA.clearLayers(); layM.clearLayers();
    if ($('#nShowA').checked) auto.slice().reverse().forEach(function (l) { var w = CW[l.cls] || 2.6; L.polyline(l.pts, { renderer: RND, color: '#000', weight: w + 2.4, opacity: 0.55, interactive: false }).addTo(layA); L.polyline(l.pts, { renderer: RND, color: colOf(l), weight: w, bubblingMouseEvents: false }).bindPopup(function () { return pop(l); }, { maxWidth: 320 }).addTo(layA); });
    if ($('#nShowM').checked) mine.forEach(function (l) { L.polyline(l.pts, { renderer: RND, color: '#000', weight: 6, opacity: 0.5, interactive: false }).addTo(layM); L.polyline(l.pts, { renderer: RND, color: COL.user, weight: 3, bubblingMouseEvents: false }).bindPopup(function () { return pop(l); }).addTo(layM); });
    legend();
  }
  function background() { if (!map) return; if (bgLay) { map.removeLayer(bgLay); bgLay = null; } if (geoLay) { map.removeLayer(geoLay); geoLay = null; } var m = SH.val('nBg');
    if (m === 'geology') { geoLay = L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: +SH.val('nOp'), maxZoom: 18, crossOrigin: true, attribution: 'Geology © Macrostrat (CC BY 4.0)' }).addTo(map); legend(); return; }
    if (!G || !G.done) return; if (m === 'none') { legend(); return; }
    bgLay = L.imageOverlay(m === 'density' ? densImg() : G.shade, [[G.b.s, G.b.w], [G.b.n, G.b.e]], { opacity: +SH.val('nOp'), interactive: false }).addTo(map); bgLay.bringToBack(); legend(); }
  function legend() {
    var h = '', m = SH.val('nBg'), any = auto.length || mine.length || (faults && $('#nShowF').checked); if (!any && !(G && G.done) && m !== 'geology') { $('#nLeg').hidden = true; return; }
    h += '<b>' + t('Lineaments', 'الخطيات') + '</b>';
    if ($('#nShowA').checked && auto.length) { if (SH.val('nCol') === 'cls') ['local', 'inter', 'major', 'regional'].forEach(function (c) { if (auto.some(function (l) { return l.cls === c; })) h += '<div class="r"><i style="background:' + CCOL[c] + ';height:' + CW[c] + 'px"></i><span>' + CN[c] + '</span></div>'; });
      else ['valley', 'ridge', 'scarp', 'subtle'].forEach(function (k) { if (auto.some(function (l) { return l.kind === k; })) h += '<div class="r"><i style="background:' + COL[k] + ';box-shadow:0 0 0 1px #0006"></i><span>' + KN[k][0] + '</span></div>'; });
      if (SH.val('nCol') !== 'cls') h += '<div class="xsmall muted">' + t('Line width grows with the length class.', 'يزداد سمك الخط مع صنف الطول.') + '</div>'; }
    if ($('#nShowM').checked && mine.length) h += '<div class="r"><i style="background:' + COL.user + '"></i><span>' + KN.user[0] + '</span></div>';
    if ($('#nShowF').checked && faults) h += '<div class="r"><i style="background:' + COL.fault + ';height:3px"></i><span>' + t('Active fault (world atlas)', 'فالق نشط (الأطلس العالمي)') + '</span></div>';
    if (G && G.done && m === 'density' && G.densMax != null) h += '<b style="display:block;margin-top:6px">' + t('Lineament density', 'كثافة الخطيات') + ' <span class="ltr" style="font-weight:400">(km/km²)</span></b><div class="gr" style="background:linear-gradient(90deg,' + VIR.join(',') + ')"></div><div class="sc"><span>0</span><span>' + SH.fmt(G.densMax / 2, 2) + '</span><span>' + SH.fmt(G.densMax, 2) + '</span></div>';
    if (G && G.done && m === 'shade') h += '<div class="xsmall muted" style="margin-top:4px">' + t('Background: hillshade lit from four directions', 'الخلفية: ظلال تضاريس مضاءة من أربعة اتجاهات') + '</div>';
    if (m === 'geology') h += '<div class="xsmall muted" style="margin-top:4px">' + t('Background: geological map. Look for units that stop at a lineament and reappear shifted on the other side.', 'الخلفية: الخريطة الجيولوجية. ابحث عن وحدات تنقطع عند الخطية وتظهر مزاحة على الجانب الآخر.') + '</div>';
    $('#nLeg').innerHTML = h; $('#nLeg').hidden = false;
  }
  ['nShowA', 'nShowM'].forEach(function (id) { $('#' + id).addEventListener('change', function () { draw(); if (SH.val('nBg') === 'density') background(); results(); }); });
  $('#nBg').addEventListener('change', function () { persist.save(); background(); }); $('#nOp').addEventListener('input', function () { if (bgLay) bgLay.setOpacity(+this.value); if (geoLay) geoLay.setOpacity(+this.value); });
  $('#nCol').addEventListener('change', function () { persist.save(); draw(); });
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
    var st = stats(list), area = aoi ? km(aoi).w * km(aoi).h : 0, kinds = {}; list.forEach(function (l) { var k = kOf(l); kinds[k] = kinds[k] || { n: 0, L: 0 }; kinds[k].n++; kinds[k].L += l.L; });
    var Ls = list.map(function (l) { return l.L; }).sort(function (a, b) { return a - b; }), med = Ls[Math.floor(Ls.length / 2)];
    var fl = null; if (faults && faults.inArea && $('#nShowF').checked && faults.inArea.length) fl = stats(faults.inArea.map(function (ll) { return { L: lineLen(ll), az: trend(ll) }; }));
    var diff = fl ? Math.abs(((st.mean - fl.mean) % 180 + 270) % 180 - 90) : null;
    LAST = { st: st, fl: fl, list: list };
    o.innerHTML = '<div class="ln-card"><b class="h">' + t('Lineaments', 'الخطيات') + '</b><span><b class="ltr">' + list.length + '</b> ' + t('lineaments with ', 'خطية بطول كلي ') + '<b class="ltr">' + SH.fmt(st.L / 1000, 1) + ' km</b>' + t(' in total; median length ', '؛ والطول الوسيط ') + '<span class="ltr">' + SH.fmt(med / 1000, 2) + ' km</span>' + (area ? t('; density ', '؛ والكثافة ') + '<b class="ltr">' + SH.fmt(st.L / 1000 / area, 3) + ' km/km²</b>' : '') + '.</span>' +
      '<table class="ln-tbl"><thead><tr><th>' + t('Kind', 'النوع') + '</th><th class="num">' + t('Number', 'العدد') + '</th><th class="num">' + t('Length', 'الطول') + '</th></tr></thead><tbody>' + Object.keys(kinds).map(function (k) { return '<tr><td><i style="display:inline-block;width:14px;height:4px;border-radius:2px;background:' + KN[k][1] + '"></i> ' + KN[k][0] + '</td><td class="num">' + kinds[k].n + '</td><td class="num"><span class="ltr">' + SH.fmt(kinds[k].L / 1000, 1) + ' km</span></td></tr>'; }).join('') + '</tbody></table>' +
      clsTable(list) + longest(list) +
      '<div class="ln-rose" id="nRose"></div><span>' + t('Mean direction ', 'الاتجاه المتوسط ') + '<b class="ltr">' + p3(st.mean) + '° – ' + p3(st.mean + 180) + '°</b>' + t(' (length-weighted, R̄ = ', ' (موزون بالطول، R̄ = ') + '<span class="ltr">' + SH.fmt(st.Rw, 2) + '</span>). ' + t('Rayleigh test: ', 'اختبار رايلي: ') + '<span class="ltr">n = ' + st.n + ', z = ' + SH.fmt(st.z, 2) + ', p ' + (st.p < 0.001 ? '< 0.001' : '= ' + SH.fmt(st.p, 3)) + '</span> — ' +
      (st.p < 0.05 ? t('the lineaments have a preferred direction.', 'للخطيات اتجاه مفضل.') : t('no single preferred direction at the 5 % level.', 'لا يوجد اتجاه مفضل واحد عند مستوى 5 %.')) + '</span>' +
      (function () { var tot = st.bins.reduce(function (a, b) { return a + b; }, 0) || 1, pk = []; st.bins.forEach(function (v, i) { var l = st.bins[(i + 17) % 18], r = st.bins[(i + 1) % 18]; if (v >= l && v >= r && v / tot >= 0.09) pk.push([i, v / tot]); }); pk.sort(function (a, b) { return b[1] - a[1]; }); pk = pk.slice(0, 3);
        if (!pk.length) return ''; return '<span>' + t('Main direction sets (classes with the most length): ', 'مجموعات الاتجاه الرئيسة (الفئات الأكثر طولاً): ') + pk.map(function (q) { return '<b class="ltr">' + p3(q[0] * 10) + '–' + p3(q[0] * 10 + 10) + '°</b> <span class="ltr">(' + SH.fmt(100 * q[1], 0) + ' %)</span>'; }).join(t(', ', '، ')) + '.' +
          (pk.length > 1 && st.p >= 0.05 ? ' ' + t('Several sets cancel each other in the mean, so the Rayleigh test, which looks for one direction, cannot detect them; read the sets from the rose instead.', 'المجموعات المتعددة يلغي بعضها بعضاً في المتوسط، فلا يكشفها اختبار رايلي الذي يبحث عن اتجاه واحد؛ اقرأ المجموعات من الوردة.') : '') + '</span>'; })() +
      (fl ? '<span>' + t('Active faults of the atlas in the area: ', 'الفوالق النشطة من الأطلس في المنطقة: ') + '<b class="ltr">' + fl.n + '</b>' + t(', mean direction ', '، اتجاهها المتوسط ') + '<b class="ltr">' + p3(fl.mean) + '° – ' + p3(fl.mean + 180) + '°</b>' + t('; the two directions differ by ', '؛ ويختلف الاتجاهان بـ') + '<b class="ltr">' + SH.fmt(diff, 0) + '°</b>. ' + (diff <= 20 ? t('The lineaments follow the active fault trend.', 'الخطيات تتبع اتجاه الفوالق النشطة.') : diff >= 60 ? t('The lineaments run across the active fault trend: they may be cross-faults, joints or drainage.', 'الخطيات تقطع اتجاه الفوالق النشطة: قد تكون فوالق مستعرضة أو فواصل أو تصريفاً.') : t('The lineaments are oblique to the active fault trend.', 'الخطيات مائلة على اتجاه الفوالق النشطة.')) + '</span>' : '') + '</div>';
    rose($('#nRose'), st, fl, false);
  }
  function clsTable(list) { var A = list.filter(function (l) { return l.cls; }); if (!A.length) return ''; var tot = A.reduce(function (a, l) { return a + l.L; }, 0) || 1, by = {};
    A.forEach(function (l) { var b = by[l.cls] = by[l.cls] || { n: 0, L: 0, w: 0, wn: 0 }; b.n++; b.L += l.L; if (l.width) { b.w += l.width; b.wn++; } });
    return '<b class="h" style="margin-top:4px">' + t('Length classes and depth reach', 'أصناف الطول والعمق الإرشادي') + '</b><table class="ln-tbl"><thead><tr><th>' + t('Class', 'الصنف') + '</th><th class="num">' + t('Number', 'العدد') + '</th><th class="num">' + t('Share of length', 'نسبة الطول') + '</th><th class="num">' + t('Mean width', 'متوسط العرض') + '</th></tr></thead><tbody>' +
      ['regional', 'major', 'inter', 'local'].filter(function (c) { return by[c]; }).map(function (c) { var b = by[c]; return '<tr><td><i style="display:inline-block;width:14px;height:' + CW[c] + 'px;border-radius:2px;background:' + CCOL[c] + '"></i> ' + CNs[c] + '</td><td class="num">' + b.n + '</td><td class="num"><span class="ltr">' + SH.fmt(100 * b.L / tot, 0) + ' %</span></td><td class="num"><span class="ltr">' + (b.wn ? SH.fmt(b.w / b.wn, 0) + ' m' : '–') + '</span></td></tr>'; }).join('') + '</tbody></table>' +
      '<span class="xsmall muted">' + t('Longer lineaments, and those marked by wider and deeper-cut zones, usually belong to faults that reach deeper; short ones are mostly joints and local fractures. The indicative depth is about half the length (fault length/height ≈ 1–3), capped at the 15 km base of the brittle crust: an order of magnitude, not a measurement.', 'الخطيات الأطول، والتي تحددها نطاقات أعرض وأعمق تقطيعاً، تعود عادة إلى فوالق تمتد أعمق؛ والقصيرة غالباً فواصل وكسور محلية. والعمق الإرشادي نحو نصف الطول (نسبة طول الفالق إلى ارتفاعه ≈ 1–3) بحد أقصى 15 كم عند قاعدة القشرة الهشة: رتبة مقدار لا قياس.') + '</span>'; }
  function longest(list) { var A = list.filter(function (l) { return l.src === 'auto' && l.L >= 1000; }).slice().sort(function (a, b) { return b.L - a.L; }).slice(0, 10); if (!A.length) return '';
    return '<b class="h" style="margin-top:4px">' + t('Main lineaments', 'الخطيات الرئيسة') + '</b><div class="tbl-wrap"><table class="ln-tbl"><thead><tr><th>#</th><th class="num">' + t('Length', 'الطول') + '</th><th class="num">' + t('Trend', 'الاتجاه') + '</th><th>' + t('Form', 'الشكل') + '</th><th class="num">' + t('Relief', 'التضاريس') + '</th><th class="num">' + t('Width', 'العرض') + '</th><th class="num">' + t('Depth reach', 'العمق الإرشادي') + '</th></tr></thead><tbody>' +
      A.map(function (l) { return '<tr data-go="' + l.id + '" style="cursor:pointer"><td>' + l.id + '</td><td class="num"><span class="ltr">' + SH.fmt(l.L / 1000, 1) + ' km</span></td><td class="num"><span class="ltr">' + p3(l.az) + '°</span></td><td><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + COL[l.kind || 'subtle'] + ';box-shadow:0 0 0 1px #0005"></i> ' + ({ valley: t('valley', 'وادٍ'), ridge: t('ridge', 'حافة'), scarp: t('scarp', 'جرف'), subtle: t('slope / tonal', 'منحدر / لوني') }[l.kind] || '') + (l.geo && l.geo.diff ? ' ⚑' : '') + '</td><td class="num"><span class="ltr">' + (l.relief != null ? SH.fmt(l.relief, 0) + ' m' : '–') + '</span></td><td class="num"><span class="ltr">' + (l.width ? SH.fmt(l.width, 0) + ' m' : '–') + '</span></td><td class="num"><span class="ltr">≈ ' + dkm(l.dep) + '</span></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<button class="btn btn-line btn-sm" id="nGeoChk" type="button" style="justify-self:start">' + t('Check the geology on both sides', 'افحص الجيولوجيا على الجانبين') + '</button><span class="xsmall muted" id="nGeoMsg">' + t('Compares the rock units mapped on the two sides of each main lineament; a different unit on each side (⚑) suggests a fault that has juxtaposed or offset the formations.', 'يقارن الوحدات الصخرية المرسومة على جانبي كل خطية رئيسة؛ واختلاف الوحدة بين الجانبين (⚑) يشير إلى فالق جاور التكاوين أو أزاحها.') + '</span>'; }
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

  /* ---------------------------------------------------------------- formations on the two sides of the main lineaments */
  var GAPI = 'https://macrostrat.org/api/v2/geologic_units/map?', ORDS = { large: 0, medium: 1, small: 2, tiny: 3 };
  function unitsAt(p) { return SH.getJSON(GAPI + 'lat=' + p[0].toFixed(5) + '&lng=' + p[1].toFixed(5), { timeout: 20000 }).then(function (j) { var d = j && j.success && j.success.data; return (Array.isArray(d) ? d : []).map(function (u) { return { sc: u.scale || '', id: u.map_id, nm: u.strat_name || u.name || '', lith: u.lith || '', age: u.best_int_name || u.b_int_name || '' }; }); }).catch(function () { return null; }); }
  function sideDiff(a, b) { if (!a || !b || !a.length || !b.length) return null; var sc = Object.keys(ORDS).filter(function (k) { return a.some(function (u) { return u.sc === k; }) && b.some(function (u) { return u.sc === k; }); })[0];
    var ua = sc ? a.filter(function (u) { return u.sc === sc; })[0] : a[0], ub = sc ? b.filter(function (u) { return u.sc === sc; })[0] : b[0]; return { diff: ua.id !== ub.id && (ua.nm + ua.age) !== (ub.nm + ub.age), a: ua, b: ub }; }
  function geoCheck() { var A = auto.filter(function (l) { return l.L >= 1000; }).sort(function (a, b) { return b.L - a.L; }).slice(0, 10); if (!A.length) return; var btn = $('#nGeoChk'); if (btn) btn.disabled = true; var done = 0, msg = $('#nGeoMsg');
    var one = function (l) { var off = Math.max(250, 4 * G.cell), pos = [1 / 3, 2 / 3], jobs = [];
      pos.forEach(function (f) { var tot = l.L * f, acc = 0, k = 1; for (; k < l.pts.length; k++) { var sl = hav(l.pts[k - 1], l.pts[k]); if (acc + sl >= tot) break; acc += sl; } k = Math.min(k, l.pts.length - 1); var A0 = l.pts[k - 1], B0 = l.pts[k], u = Math.min(1, Math.max(0, (tot - acc) / (hav(A0, B0) || 1))), P = [A0[0] + (B0[0] - A0[0]) * u, A0[1] + (B0[1] - A0[1]) * u];
        var b = SH.rad(brg(A0, B0)), dN = Math.cos(b + Math.PI / 2) * off / 110574, dE = Math.sin(b + Math.PI / 2) * off / (111320 * Math.cos(SH.rad(P[0])));
        jobs.push(Promise.all([unitsAt([P[0] + dN, P[1] + dE]), unitsAt([P[0] - dN, P[1] - dE])])); });
      return Promise.all(jobs).then(function (r) { var cmp = r.map(function (x) { return sideDiff(x[0], x[1]); }).filter(Boolean), nd = cmp.filter(function (c) { return c.diff; }).length, nm = function (u) { return SH.esc((u.nm || u.lith || '?') + (u.age ? ' (' + u.age + ')' : '')); };
        if (!cmp.length) l.geo = { diff: false, txt: t('no mapped units here', 'لا وحدات مرسومة هنا') };
        else if (nd === cmp.length) l.geo = { diff: true, txt: '<b>⚑ ' + t('different units on the two sides', 'وحدتان مختلفتان على الجانبين') + '</b>: ' + nm(cmp[0].a) + ' | ' + nm(cmp[0].b) + ' — ' + t('possible fault contact or offset', 'تماس فالقي أو إزاحة محتملة') };
        else if (nd) l.geo = { diff: false, txt: t('a contact meets the line along part of its length', 'يلتقي تماس بالخط على جزء من طوله') + ': ' + nm(cmp[0].a) + ' | ' + nm(cmp[0].b) };
        else l.geo = { diff: false, txt: t('same unit on both sides', 'الوحدة نفسها على الجانبين') + ': ' + nm(cmp[0].a) };
        done++; if (msg) msg.textContent = done + ' / ' + A.length; }); };
    var q = A.slice(), run = function () { var l = q.shift(); return l ? one(l).then(run) : Promise.resolve(); };
    Promise.all([run(), run(), run()]).then(function () { var nd = A.filter(function (l) { return l.geo && l.geo.diff; }).length; results(); var m2 = $('#nGeoMsg'); if (m2) m2.textContent = nd + t(' of ', ' من ') + A.length + t(' main lineaments separate different rock units (⚑); open them on the geological background to look for offsets.', ' خطيات رئيسة تفصل وحدات صخرية مختلفة (⚑)؛ افتحها على خلفية الخريطة الجيولوجية للبحث عن الإزاحات.'); });
  }
  $('#nOut').addEventListener('click', function (e) { if (e.target.closest('#nGeoChk')) { geoCheck(); return; } var r = e.target.closest('[data-go]'); if (!r || !map) return; var l = auto.filter(function (x) { return x.id === r.getAttribute('data-go'); })[0]; if (!l) return; map.fitBounds(L.latLngBounds(l.pts).pad(0.3)); L.popup({ maxWidth: 320 }).setLatLng(l.pts[Math.floor(l.pts.length / 2)]).setContent(pop(l)).openOn(map); if (window.innerWidth < 900) $('#nMap').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  /* ---------------------------------------------------------------- downloads */
  function need() { if (!visible().length) { SH.toast(t('Extract or draw lineaments first.', 'استخرج الخطيات أو ارسمها أولاً.'), 'warn'); return false; } return true; }
  var fname = function (x) { return 'Shandal-lineaments-' + new Date().toISOString().slice(0, 10) + x; };
  function feats() { return visible().map(function (l) { return { type: 'Feature', properties: { id: l.id, kind: kOf(l), kind_label: KN[kOf(l)][0], name: l.name || '', length_m: Math.round(l.L), trend_deg: Math.round(l.az), length_class: l.cls || '', depth_reach_m: l.cls ? Math.round(l.dep) : null, relief_m: l.relief != null ? +l.relief.toFixed(1) : null, width_m: l.width ? Math.round(l.width) : null, downthrown_az: l.down != null ? Math.round(l.down) : null, straightness: l.straight ? +l.straight.toFixed(3) : null, geology_contrast: l.geo ? (l.geo.diff ? 'yes' : 'no') : null, method: l.src === 'auto' ? (l.meth === 'curv' ? 'curvature' : 'hillshade edges + linking') : 'user' }, geometry: { type: 'LineString', coordinates: l.pts.map(function (q) { return [+q[1].toFixed(6), +q[0].toFixed(6)]; }) } }; }); }
  $('#nGj').addEventListener('click', function () { if (!need()) return; SH.json(fname('.geojson'), { type: 'FeatureCollection', name: 'Lineaments · Shandal System', features: feats() }); });
  $('#nCsv').addEventListener('click', function () { if (!need()) return; var rows = [['id', 'kind', 'name', 'length_m', 'trend_deg', 'length_class', 'depth_reach_m', 'relief_m', 'width_m', 'downthrown_az', 'geology_contrast', 'start_lat', 'start_lon', 'end_lat', 'end_lon']];
    feats().forEach(function (f) { var p = f.properties, c = f.geometry.coordinates; rows.push([p.id, p.kind, p.name, p.length_m, p.trend_deg, p.length_class, p.depth_reach_m, p.relief_m, p.width_m, p.downthrown_az, p.geology_contrast, c[0][1], c[0][0], c[c.length - 1][1], c[c.length - 1][0]]); });
    rows.push([]); rows.push(['© Shandal Geological Field Survey System · geologicalfieldsurvey.com', new Date().toISOString().slice(0, 10)]); SH.csv(fname('.csv'), rows); });
  $('#nKml').addEventListener('click', function () { if (!need()) return; var esc = function (s) { return String(s == null ? '' : s).replace(/[<&>]/g, function (c) { return { '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]; }); }, kc = function (h) { h = h.replace('#', ''); return 'ff' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };
    var k = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Lineaments · Shandal System</name>' + ['valley', 'ridge', 'scarp', 'subtle', 'user'].map(function (q) { return '<Style id="' + q + '"><LineStyle><color>' + kc(KN[q][1]) + '</color><width>3</width></LineStyle></Style>'; }).join('');
    feats().forEach(function (f) { var p = f.properties; k += '<Placemark><name>' + esc(p.name || p.id) + '</name><styleUrl>#' + p.kind + '</styleUrl><ExtendedData>' + Object.keys(p).map(function (q) { return '<Data name="' + q + '"><value>' + esc(p[q]) + '</value></Data>'; }).join('') + '</ExtendedData><LineString><tessellate>1</tessellate><coordinates>' + f.geometry.coordinates.map(function (q) { return q[0] + ',' + q[1] + ',0'; }).join(' ') + '</coordinates></LineString></Placemark>'; });
    SH.download(fname('.kml'), k + '</Document></kml>', 'application/vnd.google-earth.kml+xml'); });
  $('#nAsc').addEventListener('click', function () { if (!G || !G.done) { SH.toast(t('Extract lineaments first: the density grid needs the elevation grid.', 'استخرج الخطيات أولاً: شبكة الكثافة تحتاج شبكة الارتفاع.'), 'warn'); return; } var Dn = density(), s = 'ncols ' + G.nx + '\nnrows ' + G.ny + '\nxllcorner ' + G.b.w.toFixed(8) + '\nyllcorner ' + G.b.s.toFixed(8) + '\ndx ' + G.dlon.toFixed(10) + '\ndy ' + G.dlat.toFixed(10) + '\nNODATA_value -9999\n', r = [];
    for (var j = 0; j < G.ny; j++) { r.length = 0; for (var i = 0; i < G.nx; i++) r.push(Dn[j * G.nx + i].toFixed(4)); s += r.join(' ') + '\n'; } SH.download(fname('-density.asc'), s, 'text/plain'); SH.toast(t('Lineament density in km per km², geographic coordinates (WGS 84).', 'كثافة الخطيات بالكيلومتر لكل كيلومتر مربع، بالإحداثيات الجغرافية (WGS 84).'), 'info'); });
  $('#nRoseDl').addEventListener('click', function () { if (!need() || !LAST) return; var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(host); SH.svgPng(rose(host, LAST.st, LAST.fl, true), fname('-rose.png'), 2); setTimeout(function () { host.remove(); }, 4000); });
  $('#nSheet').addEventListener('click', function () {
    if (!need() || !D) return; var b = G && G.done ? G.b : aoi; if (!b) { SH.toast(t('Draw the area first.', 'ارسم المنطقة أولاً.'), 'warn'); return; }
    var img = G && G.done ? (SH.val('nBg') === 'density' ? densImg() : G.shade) : null, lines = [], leg = [];
    var add = function (l) { var col = colOf(l), w = l.src === 'auto' ? (CW[l.cls] || 2.4) * 0.9 : 2.4; lines.push({ pts: l.pts, color: '#000', width: w + 1.8 }); lines.push({ pts: l.pts, color: col, width: w }); };
    visible().slice().sort(function (a, b) { return a.L - b.L; }).forEach(add);
    if ($('#nShowA').checked && auto.length) { if (SH.val('nCol') === 'cls') ['local', 'inter', 'major', 'regional'].forEach(function (c) { if (auto.some(function (l) { return l.cls === c; })) leg.push({ color: CCOL[c], name: CNs[c] + ' (' + { local: '< 1 km', inter: '1–5 km', major: '5–20 km', regional: '> 20 km' }[c] + ')', width: CW[c] }); });
      else ['valley', 'ridge', 'scarp', 'subtle'].forEach(function (k) { if (auto.some(function (l) { return l.kind === k; })) leg.push({ color: COL[k], name: KN[k][0], width: 3 }); }); }
    if ($('#nShowM').checked && mine.length) leg.push({ color: COL.user, name: KN.user[0], width: 3 });
    if ($('#nShowF').checked && faults && faults.inArea) { faults.inArea.forEach(function (ll) { lines.push({ pts: ll, color: COL.fault, width: 2.2, dash: '8 5' }); }); if (faults.inArea.length) leg.push({ color: COL.fault, name: t('Active fault (world atlas)', 'فالق نشط (الأطلس العالمي)'), dash: '8 5' }); }
    D.svgMap($('#nSheetSvg'), { b: { n: b.n, s: b.s, e: b.e, w: b.w }, min: 0, max: G && G.densMax ? G.densMax : 1 }, [], { crs: 'geo', fill: false, image: img, noContours: true, grid: true, lines: lines, legend: leg, labels: false,
      gradient: img && SH.val('nBg') === 'density' ? { colors: VIR, min: 0, max: G.densMax || 1 } : null, legendTitle: img && SH.val('nBg') === 'density' ? t('Lineament density (km/km²)', 'كثافة الخطيات (كم/كم²)') : '',
      title: t('Topographic lineaments', 'الخطيات الطبوغرافية'), subtitle: visible().length + t(' lineaments · ', ' خطية · ') + SH.fmt(visible().reduce(function (a, l) { return a + l.L; }, 0) / 1000, 1) + ' km' + (G && G.done ? ' · ' + t('cell ', 'الخلية ') + SH.fmt(G.cell, 0) + ' m' : ''),
      source: (SH.val('nMeth') === 'curv' ? t('Elevation model 30 m; lineaments from terrain curvature.', 'نموذج ارتفاع 30 م؛ الخطيات من تقعر التضاريس.') : t('Elevation model 30 m; Canny edges of hillshades lit from 0°, 45°, 90° and 135°, thinned, traced and linked.', 'نموذج ارتفاع 30 م؛ حواف كاني لظلال تضاريس مضاءة من 0° و45° و90° و135°، مرققة ومتتبَّعة ومربوطة.')) + t(' Traced in the Shandal System.', ' متتبَّعة في نظام شندل.'), credit: 'Shandal System' });
    SH.svgPng($('#nSheetSvg'), fname('.png'), 2);
  });
  draw(); results();
  document.addEventListener('sh:beforereport', function (e) { if (!visible().length) { e.preventDefault(); SH.toast(t('Extract or draw lineaments first.', 'استخرج الخطيات أو ارسمها أولاً.'), 'warn'); } });
})();
