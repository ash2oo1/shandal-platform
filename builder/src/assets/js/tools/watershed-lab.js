/* Watershed and morphometry lab — basin delineation from a global elevation model in the browser:
   priority-flood depression filling with an epsilon gradient (Barnes et al. 2014), D8 steepest-descent flow,
   contributing area by topological order, outlet snapping, an analysis window that grows until the basin is complete,
   Strahler ordering, Horton–Strahler–Schumm–Miller morphometry, hypsometry, longest flow path, and the design flood by the
   NRCS curve number with the NRCS dimensionless unit hydrograph. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, AR = SH.lang === 'ar';
  var IDS = ['wsLat', 'wsLon', 'wsSnap', 'wsSrc', 'wsDet', 'wsThr', 'wsP', 'wsD', 'wsLc', 'wsCN'], persist = SH.persist('watershed', IDS);
  var map = SH.map('wsMap', { center: [33.3, 43.8], zoom: 6 }), L = window.L, mk = null, lay = L && map ? L.layerGroup().addTo(map) : null, R = null, busy = false, pending = false;
  var DI = [1, 1, 0, -1, -1, -1, 0, 1], DJ = [0, 1, 1, 1, 0, -1, -1, -1];
  var UH = [[0, 0], [.1, .03], [.2, .1], [.3, .19], [.4, .31], [.5, .47], [.6, .66], [.7, .82], [.8, .93], [.9, .99], [1, 1], [1.1, .99], [1.2, .93], [1.3, .86], [1.4, .78], [1.5, .68], [1.6, .56], [1.7, .46], [1.8, .39], [1.9, .33], [2, .28], [2.2, .207], [2.4, .147], [2.6, .107], [2.8, .077], [3, .055], [3.2, .04], [3.4, .029], [3.6, .021], [3.8, .015], [4, .011], [4.5, .005], [5, 0]];

  /* ---------------------------------------------------------------- outlet on the map */
  function setPt(lat, lon, fly) {
    if (!map || !isFinite(lat) || !isFinite(lon)) return;
    if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map);
    if (fly) map.setView([lat, lon], Math.max(map.getZoom(), 11));
  }
  if (map) map.on('click', function (e) { if (busy) return; $('#wsLat').value = e.latlng.lat.toFixed(6); $('#wsLon').value = e.latlng.lng.toFixed(6); persist.save(); setPt(e.latlng.lat, e.latlng.lng); });
  ['wsLat', 'wsLon'].forEach(function (id) { $('#' + id).addEventListener('change', function () { setPt(G.v('wsLat'), G.v('wsLon'), true); }); });
  $('#wsGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.gpsFix({ ms: 20000, target: 10 }).then(function (f) { $('#wsLat').value = f.lat.toFixed(6); $('#wsLon').value = f.lon.toFixed(6); persist.save(); setPt(f.lat, f.lon, true); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  $('#wsLc').addEventListener('change', function () { if (this.value) { $('#wsCN').value = this.value; persist.save(); } if (R) flood(); });
  ['wsP', 'wsD', 'wsCN'].forEach(function (id) { $('#' + id).addEventListener('input', function () { if (id === 'wsCN') $('#wsLc').value = ''; later(function () { if (R) flood(); }, 350); }); });
  var tm = null; function later(fn, ms) { clearTimeout(tm); tm = setTimeout(fn, ms); }

  /* ---------------------------------------------------------------- progress */
  function prog(f, msg) { $('#wsBar').style.width = Math.round(f * 100) + '%'; if (msg != null) $('#wsMsg').textContent = msg; }
  function tick() { return new Promise(function (r) { setTimeout(r, 15); }); }

  /* ---------------------------------------------------------------- grid around a centre */
  function fetchGrid(lat, lon, r, maxCells, src, onP) {
    var mpd = SH.dem.metersPerDeg(lat), cell = Math.max(30, 2 * r / Math.sqrt(maxCells)), n = Math.round(2 * r / cell) + 1;
    var b = { n: lat + r / mpd.y, s: lat - r / mpd.y, e: lon + r / mpd.x, w: lon - r / mpd.x };
    var use = src === 'cop30' && r <= 120000 ? 'cop30' : 'aws';
    var go = function (s) { return SH.dem.grid(b, n, n, { source: s, onProgress: onP }).then(function (g) { g.src = s; g.cell = cell; return g; }); };
    return go(use).catch(function (e) { if (use === 'aws') throw e; return go('aws'); });
  }

  /* ---------------------------------------------------------------- hydrological conditioning */
  function Heap(n) { this.k = new Float64Array(n); this.v = new Int32Array(n); this.n = 0; }
  Heap.prototype.push = function (key, val) { var k = this.k, v = this.v, i = this.n++; while (i > 0) { var p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; };
  Heap.prototype.pop = function () { var k = this.k, v = this.v, top = v[0], n = --this.n; if (n > 0) { var key = k[n], val = v[n], i = 0; for (;;) { var l = 2 * i + 1; if (l >= n) break; var r = l + 1, c = r < n && k[r] < k[l] ? r : l; if (k[c] >= key) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = key; v[i] = val; } return top; };
  function hydro(Gd) {
    var nx = Gd.nx, ny = Gd.ny, N = nx * ny, z = Gd.z, f = new Float64Array(N), cl = new Uint8Array(N), H = new Heap(N), i, j, c, d, n;
    var dlon = (Gd.b.e - Gd.b.w) / (nx - 1), dlat = (Gd.b.n - Gd.b.s) / (ny - 1), dy = dlat * 110574, dxr = new Float64Array(ny), car = new Float64Array(ny);
    for (j = 0; j < ny; j++) { dxr[j] = dlon * 111320 * Math.cos(Gd.lats[j] * Math.PI / 180); car[j] = dxr[j] * dy; }
    for (c = 0; c < N; c++) { f[c] = z[c]; if (isNaN(z[c])) cl[c] = 2; }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { c = j * nx + i; if (cl[c]) continue; var edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
      if (!edge) for (d = 0; d < 8; d++) if (cl[(j + DJ[d]) * nx + i + DI[d]] === 2) { edge = true; break; }
      if (edge) { cl[c] = 1; H.push(f[c], c); } }
    while (H.n) { c = H.pop(); var ci = c % nx, cj = (c - ci) / nx;
      for (d = 0; d < 8; d++) { var ni = ci + DI[d], nj = cj + DJ[d]; if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue; n = nj * nx + ni; if (cl[n]) continue; cl[n] = 1; if (f[n] <= f[c]) f[n] = f[c] + 1e-4; H.push(f[n], n); } }
    var rc = new Int32Array(N).fill(-1), dd = new Int8Array(N).fill(-1);
    for (j = 0; j < ny; j++) { var dx = dxr[j], dg = Math.sqrt(dx * dx + dy * dy);
      for (i = 0; i < nx; i++) { c = j * nx + i; if (cl[c] === 2) continue; var best = 0;
        for (d = 0; d < 8; d++) { var ii = i + DI[d], jj = j + DJ[d]; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; n = jj * nx + ii; if (cl[n] === 2) continue; var dr = f[c] - f[n]; if (dr <= 0) continue; var s = dr / (d & 1 ? dg : d === 0 || d === 4 ? dx : dy); if (s > best) { best = s; rc[c] = n; dd[c] = d; } } } }
    var deg = new Uint8Array(N), acc = new Float64Array(N), ord = new Int32Array(N), head = 0, tail = 0;
    for (c = 0; c < N; c++) { if (cl[c] === 2) continue; acc[c] = car[(c / nx) | 0]; if (rc[c] >= 0) deg[rc[c]]++; }
    for (c = 0; c < N; c++) if (cl[c] !== 2 && !deg[c]) ord[tail++] = c;
    while (head < tail) { c = ord[head++]; var r = rc[c]; if (r >= 0) { acc[r] += acc[c]; if (--deg[r] === 0) ord[tail++] = r; } }
    return { Gd: Gd, f: f, nx: nx, ny: ny, rc: rc, dd: dd, acc: acc, ord: ord, nOrd: tail, dxr: dxr, dy: dy, car: car, dlon: dlon, dlat: dlat };
  }
  function cellOf(hy, lat, lon) { var i = Math.round((lon - hy.Gd.b.w) / hy.dlon), j = Math.round((hy.Gd.b.n - lat) / hy.dlat); return [Math.max(0, Math.min(hy.nx - 1, i)), Math.max(0, Math.min(hy.ny - 1, j))]; }
  function ll(hy, c) { var i = c % hy.nx, j = (c - i) / hy.nx; return [hy.Gd.lats[j], hy.Gd.lons[i]]; }
  function snap(hy, lat, lon, Rm, prevA) {
    var p = cellOf(hy, lat, lon), j0 = p[1], ri = Math.ceil(Rm / hy.dxr[j0]), rj = Math.ceil(Rm / hy.dy), best = -1, bv = -Infinity;
    for (var dj = -rj; dj <= rj; dj++) for (var di = -ri; di <= ri; di++) { var i = p[0] + di, j = j0 + dj; if (i < 0 || j < 0 || i >= hy.nx || j >= hy.ny) continue; var ex = di * hy.dxr[j0], ey = dj * hy.dy; if (ex * ex + ey * ey > Rm * Rm + 1) continue;
      var c = j * hy.nx + i, a = hy.acc[c]; if (!(a > 0)) continue; var v = prevA ? (a >= 0.7 * prevA ? -Math.abs(Math.log(a / prevA)) : -50 + Math.log(a)) : a; if (v > bv) { bv = v; best = c; } }
    return best >= 0 ? best : p[1] * hy.nx + p[0];
  }
  function delin(hy, o) {
    var nx = hy.nx, ny = hy.ny, rc = hy.rc, mask = new Uint8Array(nx * ny), list = new Int32Array(nx * ny), h = 0, n = 1, touch = false; mask[o] = 1; list[0] = o;
    while (h < n) { var c = list[h++], i = c % nx, j = (c - i) / nx; if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) touch = true;
      for (var d = 0; d < 8; d++) { var ii = i + DI[d], jj = j + DJ[d]; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; var q = jj * nx + ii; if (!mask[q] && rc[q] === c) { mask[q] = 1; list[n++] = q; } } }
    return { mask: mask, list: list.subarray(0, n), n: n, touch: touch, area: hy.acc[o] };
  }

  /* ---------------------------------------------------------------- run */
  function run() {
    if (busy) return; var lat = G.v('wsLat'), lon = G.v('wsLon');
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85) { SH.toast(t('Tap the outlet on the map or enter its coordinates.', 'انقر المصب على الخريطة أو أدخل إحداثياته.'), 'warn'); return; }
    if (!navigator.onLine) { pending = true; prog(0, t('The elevation model needs a connection. The basin will be delineated as soon as the connection returns.', 'يحتاج نموذج الارتفاع إلى اتصال. سيُحدد الحوض تلقائياً حال عودة الاتصال.')); return; }
    pending = false; busy = true; persist.save(); $('#wsRun').disabled = true;
    var src = $('#wsSrc').value, maxCells = 1e6 * (+$('#wsDet').value || 1), snapR = Math.max(0, G.v('wsSnap') || 0), r = 5000, level = 0, cLat = lat, cLon = lon, sLat = lat, sLon = lon, prevA = 0;
    var step = function () {
      var lv = level; prog(0.05 + 0.18 * lv, t('Reading elevations (window ', 'قراءة الارتفاعات (نافذة ') + F(2 * r / 1000, 0) + ' km)…');
      return fetchGrid(cLat, cLon, r, maxCells, src, function (a, b) { prog(0.05 + 0.18 * lv + 0.1 * a / b); }).then(function (Gd) {
        prog(0.18 + 0.18 * lv, t('Filling depressions and tracing flow on ', 'ملء المنخفضات وتتبع الجريان على ') + F(Gd.nx * Gd.ny / 1e6, 2) + t(' million cells…', ' مليون خلية…'));
        return tick().then(function () {
          var hy = hydro(Gd), cs = Math.max(hy.dxr[(hy.ny / 2) | 0], hy.dy), o = snap(hy, sLat, sLon, lv ? Math.max(2.5 * cs, 0) : Math.max(snapR, 0.6 * cs), lv ? prevA : 0), bas = delin(hy, o);
          if (bas.touch && r < 450000) {
            var p = ll(hy, o), sx = 0, sy = 0; for (var k = 0; k < bas.n; k += Math.max(1, (bas.n / 4000) | 0)) { var q = ll(hy, bas.list[k]); sx += q[0]; sy += q[1]; } var cnt = Math.ceil(bas.n / Math.max(1, (bas.n / 4000) | 0));
            sLat = p[0]; sLon = p[1]; prevA = bas.area; r *= 3; level++;
            var gLat = sy ? sx / cnt : sLat, gLon = sy ? sy / cnt : sLon, mpd = SH.dem.metersPerDeg(sLat), dist = Math.hypot((gLat - sLat) * mpd.y, (gLon - sLon) * mpd.x), k2 = dist > 0.6 * r ? 0.6 * r / dist : 1;
            cLat = sLat + (gLat - sLat) * k2; cLon = sLon + (gLon - sLon) * k2;
            return step();
          }
          prog(0.85, t('Ordering streams and measuring the basin…', 'ترتيب المجاري وقياس الحوض…'));
          return tick().then(function () { return analyse(hy, o, bas, { lat: lat, lon: lon, src: Gd.src }); });
        });
      });
    };
    step().then(function (res) { R = res; flood(); draw(); prog(1, t('Done. The analysis ran on a grid of ', 'تم. جرى التحليل على شبكة بخلايا ') + F(res.cell, 0) + t(' m cells.', ' م.')); })
      .catch(function (e) { prog(0, e.message || String(e)); SH.toast(e.message || String(e), 'bad'); })
      .then(function () { busy = false; $('#wsRun').disabled = false; });
  }
  window.addEventListener('online', function () { if (pending) run(); });

  /* ---------------------------------------------------------------- morphometry */
  function geod(a, b) { return SH.dist({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }); }
  function analyse(hy, o, bas, opt) {
    var nx = hy.nx, ny = hy.ny, N = nx * ny, rc = hy.rc, dd = hy.dd, acc = hy.acc, z = hy.Gd.z, mask = bas.mask, list = bas.list, nB = bas.n, A = acc[o], i, j, k, c;
    var stepL = function (c) { var j = (c / nx) | 0, d = dd[c], dx = hy.dxr[j]; return d < 0 ? Math.min(dx, hy.dy) : d & 1 ? Math.sqrt(dx * dx + hy.dy * hy.dy) : d === 0 || d === 4 ? dx : hy.dy; };
    // elevation, slope, hypsometry
    var zs = new Float32Array(nB), zmin = Infinity, zmax = -Infinity, zsum = 0, ssum = 0, at = function (ii, jj, dv) { if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return dv; var v = z[jj * nx + ii]; return isNaN(v) ? dv : v; };
    for (k = 0; k < nB; k++) { c = list[k]; var v = z[c]; zs[k] = v; if (v < zmin) zmin = v; if (v > zmax) zmax = v; zsum += v; i = c % nx; j = (c - i) / nx;
      var a = at(i - 1, j - 1, v), b = at(i, j - 1, v), cc = at(i + 1, j - 1, v), dl = at(i - 1, j, v), fr = at(i + 1, j, v), g = at(i - 1, j + 1, v), h = at(i, j + 1, v), q = at(i + 1, j + 1, v);
      var gx = ((cc + 2 * fr + q) - (a + 2 * dl + g)) / (8 * hy.dxr[j]), gy = ((g + 2 * h + q) - (a + 2 * b + cc)) / (8 * hy.dy); ssum += Math.sqrt(gx * gx + gy * gy); }
    var zmean = zsum / nB, Hrel = zmax - zmin, slopeT = ssum / nB; zs.sort();
    var hyp = []; for (k = 0; k <= 50; k++) { var fa = k / 50, zq = zs[Math.min(nB - 1, Math.max(0, Math.round((1 - fa) * (nB - 1))))]; hyp.push([fa, Hrel > 0 ? (zq - zmin) / Hrel : 0]); }
    var HI = Hrel > 0 ? (zmean - zmin) / Hrel : 0;
    // streams and Strahler orders
    var thrIn = G.v('wsThr'), cellA = A / nB, thr = thrIn > 0 ? thrIn * 1e6 : Math.max(25 * cellA, 0.002 * A), so = new Uint8Array(N), mx = new Uint8Array(N), cm = new Uint8Array(N), inS = new Uint8Array(N), Nu = [], Lu = [], kmax = 0;
    var isS = function (c) { return mask[c] && acc[c] >= thr; };
    for (k = 0; k < hy.nOrd; k++) { c = hy.ord[k]; if (!isS(c)) continue; var u = cm[c] >= 2 ? mx[c] + 1 : Math.max(mx[c], 1); so[c] = u; if (u > kmax) kmax = u;
      if (mx[c] !== u) Nu[u] = (Nu[u] || 0) + 1; Lu[u] = (Lu[u] || 0) + stepL(c);
      var r = rc[c]; if (r >= 0 && isS(r)) { inS[r]++; if (u > mx[r]) { mx[r] = u; cm[r] = 1; } else if (u === mx[r]) cm[r]++; } }
    var segs = [];
    for (k = 0; k < nB; k++) { c = list[k]; if (!isS(c) || inS[c] === 1) continue;
      var cells = [c], cur = c; for (;;) { var nx2 = rc[cur]; if (nx2 < 0 || !isS(nx2)) break; cells.push(nx2); if (inS[nx2] >= 2) break; cur = nx2; }
      if (cells.length < 2) continue; var pts = [ll(hy, cells[0])];
      for (var q2 = 1; q2 < cells.length - 1; q2++) if (dd[cells[q2]] !== dd[cells[q2 - 1]]) pts.push(ll(hy, cells[q2]));
      pts.push(ll(hy, cells[cells.length - 1])); segs.push({ u: so[c], pts: pts }); }
    // boundary ring
    var i0 = nx, i1 = 0, j0 = ny, j1 = 0; for (k = 0; k < nB; k++) { c = list[k]; i = c % nx; j = (c - i) / nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    var w = i1 - i0 + 3, hh = j1 - j0 + 3, Gm = { nx: w, ny: hh, lats: [], lons: [], z: new Float32Array(w * hh) }, jt, it2;
    for (j = 0; j < hh; j++) Gm.lats.push(hy.Gd.b.n - (j0 - 1 + j) * hy.dlat); for (i = 0; i < w; i++) Gm.lons.push(hy.Gd.b.w + (i0 - 1 + i) * hy.dlon);
    for (j = 1; j < hh - 1; j++) for (i = 1; i < w - 1; i++) { jt = j0 - 1 + j; it2 = i0 - 1 + i; Gm.z[j * w + i] = jt >= 0 && it2 >= 0 && jt < ny && it2 < nx ? mask[jt * nx + it2] : 0; }
    Gm.b = { n: Gm.lats[0], s: Gm.lats[hh - 1], w: Gm.lons[0], e: Gm.lons[w - 1] };
    var lines = (SH.dem.contours(Gm, [0.5])[0] || { lines: [] }).lines, ring = lines.slice().sort(function (a, b) { return b.length - a.length; })[0] || [];
    ring = SH.dem.smooth(ring, 1); if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring.push(ring[0]);
    var P = 0; for (k = 1; k < ring.length; k++) P += geod(ring[k - 1], ring[k]);
    var out = ll(hy, o), Lb = 0; ring.forEach(function (p) { var dd2 = geod(out, p); if (dd2 > Lb) Lb = dd2; });
    // longest flow path
    var fl = new Float64Array(N), far = o; fl[o] = 0;
    for (k = 1; k < nB; k++) { c = list[k]; fl[c] = fl[rc[c]] + stepL(c); if (fl[c] > fl[far]) far = c; }
    var Lc = fl[far] + stepL(o) / 2, path = [], prof = []; c = far; while (c >= 0 && mask[c]) { path.push(ll(hy, c)); prof.push([(Lc - fl[c] - stepL(o) / 2) / 1000, hy.f[c], z[c]]); if (c === o) break; c = rc[c]; }
    var zAt = function (fr) { var tgt = fr * Lc, best = prof[0], bd = Infinity; prof.forEach(function (p) { var dd3 = Math.abs((Lc / 1000 - p[0]) * 1000 - tgt); if (dd3 < bd) { bd = dd3; best = p; } }); return best; };
    var p10 = zAt(0.10), p85 = zAt(0.85), S1085 = Math.max(1e-5, (p85[1] - p10[1]) / (0.75 * Lc)), Hpath = Math.max(hy.f[far] - hy.f[o], 0.0005 * Lc);
    // aggregates
    var Akm = A / 1e6, Pkm = P / 1000, Lbk = Lb / 1000, sumN = 0, sumL = 0, ords = [];
    for (k = 1; k <= kmax; k++) { var n0 = Nu[k] || 0, l0 = (Lu[k] || 0) / 1000; sumN += n0; sumL += l0; ords.push({ u: k, N: n0, L: l0, Lm: n0 ? l0 / n0 : 0 }); }
    ords.forEach(function (q, ix) { var nx3 = ords[ix + 1], pv = ords[ix - 1]; q.Rb = nx3 && nx3.N ? q.N / nx3.N : null; q.RL = pv && pv.Lm ? q.Lm / pv.Lm : null; });
    var rbs = ords.filter(function (q) { return q.Rb; }), Rb = rbs.length ? rbs.reduce(function (s, q) { return s + q.Rb; }, 0) / rbs.length : null;
    var Rbw = rbs.length ? rbs.reduce(function (s, q, ix) { return s + q.Rb * (q.N + ords[q.u].N); }, 0) / rbs.reduce(function (s, q) { return s + q.N + ords[q.u].N; }, 0) : null;
    var fit = function (key) { var xs = ords.filter(function (q) { return q[key] > 0; }); if (xs.length < 2) return null; var mxv = 0, myv = 0; xs.forEach(function (q) { mxv += q.u; myv += Math.log10(q[key]); }); mxv /= xs.length; myv /= xs.length; var sxy = 0, sxx = 0; xs.forEach(function (q) { sxy += (q.u - mxv) * (Math.log10(q[key]) - myv); sxx += (q.u - mxv) * (q.u - mxv); }); var b = sxy / sxx; return { b: b, a: myv - b * mxv }; };
    var fN = fit('N'), fL = fit('Lm'), Dd = sumL / Akm;
    var M = { A: Akm, P: Pkm, Lb: Lbk, Lc: Lc / 1000, zmin: zmin, zmax: zmax, zmean: zmean, H: Hrel, HI: HI, slope: Math.atan(slopeT) * 180 / Math.PI, slopeP: slopeT * 100, kmax: kmax, sumN: sumN, sumL: sumL, Dd: Dd, Fs: sumN / Akm, Rt: sumN / Pkm, Lo: Dd > 0 ? 1 / (2 * Dd) : null, Cm: Dd > 0 ? 1 / Dd : null, Rb: Rb, Rbw: Rbw, RbH: fN ? Math.pow(10, -fN.b) : null, RLH: fL ? Math.pow(10, fL.b) : null,
      Rf: Akm / (Lbk * Lbk), Rc: 4 * Math.PI * Akm / (Pkm * Pkm), Re: 2 * Math.sqrt(Akm / Math.PI) / Lbk, Cc: Pkm / (2 * Math.sqrt(Math.PI * Akm)), Rh: Hrel / Lb, Rn: Dd * Hrel / 1000, Mel: (Hrel / 1000) / Math.sqrt(Akm), S1085: S1085, Hpath: Hpath, thr: thr / 1e6 };
    var oll = out, bb = { n: -90, s: 90, e: -180, w: 180 }; ring.forEach(function (p) { bb.n = Math.max(bb.n, p[0]); bb.s = Math.min(bb.s, p[0]); bb.e = Math.max(bb.e, p[1]); bb.w = Math.min(bb.w, p[1]); });
    return { hy: hy, o: o, bas: bas, M: M, ords: ords, fN: fN, fL: fL, segs: segs, ring: ring, path: path, prof: prof, p10: p10, p85: p85, hyp: hyp, outlet: oll, req: [opt.lat, opt.lon], snapD: geod([opt.lat, opt.lon], oll), src: opt.src, cell: Math.max(hy.dxr[(hy.ny / 2) | 0], hy.dy), truncated: bas.touch, bb: bb, ij: [i0, i1, j0, j1] };
  }

  /* ---------------------------------------------------------------- design flood */
  function flood() {
    if (!R) return; var M = R.M, P = Math.max(0, G.v('wsP') || 0), Td = Math.max(0.25, G.v('wsD') || 3), CN = Math.min(98, Math.max(30, G.v('wsCN') || 80));
    var S = 25400 / CN - 254, Ia = 0.2 * S, Qf = function (p) { return p > Ia ? (p - Ia) * (p - Ia) / (p + 0.8 * S) : 0; }, Q = Qf(P);
    var Lft = M.Lc * 1000 * 3.28084, Y = Math.max(0.5, M.slopeP), lag = Math.pow(Lft, 0.8) * Math.pow(1000 / CN - 9, 0.7) / (1900 * Math.sqrt(Y)), tcN = lag / 0.6, tcK = 0.0195 * Math.pow(M.Lc * 1000, 0.77) * Math.pow(M.Hpath / (M.Lc * 1000), -0.385) / 60;
    var dD0 = Math.min(0.133 * tcN, Td), n = Math.max(1, Math.ceil(Td / dD0)), dD = Td / n, Tp = dD / 2 + lag, qp = 0.208 * M.A / Tp, inc = [], prev = 0;
    for (var k = 1; k <= n; k++) { var c = Qf(P * k / n); inc.push(c - prev); prev = c; }
    var uh = function (tt) { var x = tt / Tp; if (x <= 0 || x >= 5) return 0; for (var i = 1; i < UH.length; i++) if (x <= UH[i][0]) { var a = UH[i - 1], b = UH[i]; return qp * (a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])); } return 0; };
    var Tend = Td + 5 * Tp, hyd = [], pk = [0, 0], vol = 0, dt = Tend / 400;
    for (var s = 0; s <= 400; s++) { var tt = s * dt, q = 0; for (k = 0; k < n; k++) q += inc[k] * uh(tt - k * dD); hyd.push([tt, q]); if (q > pk[1]) pk = [tt, q]; vol += q * dt * 3600; }
    R.F = { P: P, Td: Td, CN: CN, S: S, Q: Q, C: P > 0 ? Q / P : 0, lag: lag, tcN: tcN, tcK: tcK, Tp: Tp, qp: qp, hyd: hyd, peak: pk, vol: Q / 1000 * M.A * 1e6, volC: vol, qs: pk[1] / M.A, inc: inc, dD: dD };
    hazard(); summary(); figHyd();
  }
  function hazard() {
    var M = R.M, Fz = R.F, sc = function (v, a, b, rev) { return rev ? (v < a ? 3 : v < b ? 2 : 1) : (v > b ? 3 : v > a ? 2 : 1); };
    var f = [[t('time of concentration', 'زمن التركيز'), sc(Fz.tcN, 1, 3, 1), F(Fz.tcN, 1) + ' h'], [t('Melton ruggedness', 'وعورة ميلتون'), sc(M.Mel, 0.3, 0.6), F(M.Mel, 2)], [t('circularity', 'الاستدارة'), sc(M.Rc, 0.4, 0.6), F(M.Rc, 2)], [t('mean slope', 'متوسط الانحدار'), sc(M.slope, 5, 15), F(M.slope, 1) + '°'], [t('runoff coefficient', 'معامل الجريان'), sc(Fz.C, 0.25, 0.5), F(Fz.C, 2)]];
    var m = f.reduce(function (s, q) { return s + q[1]; }, 0) / f.length; R.Hz = { f: f, m: m, cls: m >= 2.3 ? 'high' : m >= 1.7 ? 'mod' : 'low' };
    var mel = M.Mel, Lk = M.Lb; R.Hz.wil = mel > 0.6 && Lk < 2.7 ? 'flow' : mel > 0.3 ? 'dflood' : 'flood';
  }

  /* ---------------------------------------------------------------- text */
  function cls(v, arr) { for (var i = 0; i < arr.length; i++) if (v < arr[i][0]) return t(arr[i][1], arr[i][2]); return t(arr[arr.length - 1][1], arr[arr.length - 1][2]); }
  function reShape(v) { return cls(v, [[0.5, 'more elongated', 'مستطيل جداً'], [0.7, 'elongated', 'مستطيل'], [0.8, 'less elongated', 'قليل الاستطالة'], [0.9, 'oval', 'بيضوي'], [9, 'circular', 'دائري']]); }
  function stage(hi) { return hi > 0.6 ? t('youthful (inequilibrium) stage: strong erosion still to come', 'مرحلة الشباب (عدم التوازن): التعرية الشديدة ما تزال قادمة') : hi >= 0.35 ? t('mature (equilibrium) stage', 'مرحلة النضج (التوازن)') : t('old (monadnock) stage: the basin is largely worn down', 'مرحلة الشيخوخة: الحوض متآكل إلى حد بعيد'); }
  function summary() {
    var M = R.M, Fz = R.F, Hz = R.Hz, k = [], v = [];
    k.push(G.kpi('info', t('Basin area', 'مساحة الحوض'), F(M.A, M.A < 10 ? 2 : M.A < 1000 ? 1 : 0) + '<small> km²</small>', t('perimeter ', 'المحيط ') + F(M.P, 1) + ' km'));
    k.push(G.kpi('info', t('Highest stream order', 'أعلى مرتبة مجرى'), M.kmax + '', M.sumN + t(' streams · ', ' مجرى · ') + F(M.sumL, 1) + ' km'));
    k.push(G.kpi('info', t('Drainage density', 'كثافة التصريف'), F(M.Dd, 2) + '<small> km/km²</small>', t('threshold ', 'العتبة ') + F(M.thr, M.thr < 1 ? 3 : 2) + ' km²'));
    k.push(G.kpi(Hz.cls === 'high' ? 'bad' : Hz.cls === 'mod' ? 'warn' : 'ok', t('Design flood peak', 'ذروة فيضان التصميم'), F(Fz.peak[1], Fz.peak[1] < 10 ? 1 : 0) + '<small> m³/s</small>', t('after ', 'بعد ') + F(Fz.peak[0], 1) + t(' h · ', ' ساعة · ') + F(Fz.qs, 2) + ' m³/s/km²'));
    if (R.truncated) v.push(G.verdict('bad', t('Basin larger than the analysed window', 'الحوض أكبر من نافذة التحليل'), t('The basin reaches the edge of the largest window (about 900 km). Area, lengths and orders are minimum values; use a coarser national basin map for basins of this size.', 'يصل الحوض إلى حافة أكبر نافذة (نحو 900 كم). فالمساحة والأطوال والمراتب قيم دنيا؛ استعمل خريطة أحواض وطنية للأحواض بهذا الحجم.')));
    if (R.snapD > 1) v.push(G.verdict('info', t('Outlet moved to the stream', 'نُقل المصب إلى المجرى'), t('The tapped point was moved ', 'نُقلت النقطة المنقورة ') + F(R.snapD, 0) + t(' m to the cell with the largest drainage area nearby (', ' م إلى الخلية ذات أكبر مساحة تصريف قريبة (') + F(R.outlet[0], 5) + ', ' + F(R.outlet[1], 5) + t('). Check on the map that it lies on the intended valley.', '). تأكد على الخريطة أنها على الوادي المقصود.')));
    if (M.slope < 1 || M.H < 15) v.push(G.verdict('warn', t('Very flat terrain', 'تضاريس مستوية جداً'), t('Mean slope ', 'متوسط الانحدار ') + F(M.slope, 2) + t('° and relief ', '° والتضرس ') + F(M.H, 0) + t(' m: on such ground flow follows canals, drains and embankments that the elevation model does not see, and the boundary may be wrong. Check it against canals and field observation.', ' م: على مثل هذه الأرض يتبع الجريان القنوات والمبازل والسداد التي لا يراها نموذج الارتفاع، وقد تكون الحدود خاطئة. قارنها بالقنوات والملاحظة الحقلية.')));
    if (R.bas.n < 60) v.push(G.verdict('warn', t('Very small basin', 'حوض صغير جداً'), t('Only ', 'فقط ') + R.bas.n + t(' cells: shape and stream parameters are not meaningful. Move the outlet downstream or choose the finest detail.', ' خلية: معاملات الشكل والمجاري غير ذات معنى. انقل المصب باتجاه المجرى أو اختر أدق تفصيل.')));
    v.push(G.verdict('info', t('Shape', 'الشكل'), t('Elongation ratio ', 'نسبة الاستطالة ') + F(M.Re, 2) + ' (' + reShape(M.Re) + t('), circularity ', ')، والاستدارة ') + F(M.Rc, 2) + t(' and form factor ', ' ومعامل الشكل ') + F(M.Rf, 2) + '. ' + (M.Rc > 0.5 ? t('A compact basin gathers its flow quickly, giving short, sharp flood peaks.', 'الحوض المندمج يجمع جريانه بسرعة فتأتي ذروات الفيضان قصيرة وحادة.') : t('An elongated basin spreads its flow over time, giving lower and longer floods than a round basin of the same area.', 'الحوض المستطيل يوزع جريانه على زمن أطول، فتأتي فيضاناته أوطأ وأطول من حوض دائري بالمساحة نفسها.'))));
    if (M.Rb) v.push(G.verdict(M.Rb > 5 ? 'warn' : 'info', t('Stream network', 'شبكة المجاري'), t('Mean bifurcation ratio ', 'متوسط نسبة التشعب ') + F(M.Rb, 2) + (M.Rb > 5 ? t(': above 5, which points to geological structure (faults, joints, folds) controlling the drainage.', ': أكبر من 5، مما يدل على تحكم البنية الجيولوجية (الفوالق والفواصل والطيات) في التصريف.') : M.Rb >= 3 ? t(': between 3 and 5, typical of a natural network without strong structural control.', ': بين 3 و5، وهو المعتاد لشبكة طبيعية دون تحكم بنيوي قوي.') : t(': below 3, typical of flat or little-dissected ground.', ': أقل من 3، وهو المعتاد للأرض المستوية أو قليلة التقطع.')) + ' ' + t('Drainage density ', 'كثافة التصريف ') + F(M.Dd, 2) + t(' km/km² at this threshold.', ' كم/كم² عند هذه العتبة.')));
    v.push(G.verdict('info', t('Relief and hypsometry', 'التضاريس والهبسومتري'), t('Relief ', 'التضرس ') + F(M.H, 0) + t(' m, mean slope ', ' م، ومتوسط الانحدار ') + F(M.slope, 1) + t('°, hypsometric integral ', '°، والتكامل الهبسومتري ') + F(M.HI, 2) + ': ' + stage(M.HI) + '.'));
    var hzT = { high: t('High', 'عالٍ'), mod: t('Moderate', 'متوسط'), low: t('Low', 'منخفض') }[Hz.cls], wl = { flow: t('debris flows (Melton above 0.6 and a short basin)', 'جريانات الحطام (ميلتون أكبر من 0.6 وحوض قصير)'), dflood: t('debris floods carrying gravel and boulders', 'فيضانات حطامية تحمل الحصى والجلاميد'), flood: t('water floods with fine sediment', 'فيضانات مائية برواسب ناعمة') }[Hz.wil];
    v.push(G.verdict(Hz.cls === 'high' ? 'bad' : Hz.cls === 'mod' ? 'warn' : 'ok', t('Flash-flood hazard: ', 'خطر السيول الوامضة: ') + hzT, t('Indicative score ', 'درجة استرشادية ') + F(Hz.m, 1) + t(' of 3 from ', ' من 3 من ') + Hz.f.map(function (q) { return q[0] + ' ' + q[2] + ' (' + q[1] + ')'; }).join('، ') + '. ' + t('By Melton’s ruggedness the valley mouth is prone to ', 'وبحسب وعورة ميلتون يتعرض مخرج الوادي إلى ') + wl + '. ' + t('The design storm of ', 'العاصفة التصميمية ') + F(Fz.P, 0) + t(' mm in ', ' ملم خلال ') + F(Fz.Td, 1) + t(' h gives ', ' ساعة تعطي ') + F(Fz.Q, 1) + t(' mm of runoff, ', ' ملم جرياناً، أي ') + F(Fz.vol / 1e6, Fz.vol < 1e7 ? 2 : 1) + t(' million m³, and a peak of ', ' مليون م³، وذروة ') + F(Fz.peak[1], 0) + t(' m³/s at the outlet.', ' م³/ثا عند المصب.')));
    $('#wsKpis').innerHTML = k.join(''); $('#wsVerd').innerHTML = v.join('');
    tablePar();
  }
  function tablePar() {
    var M = R.M, Fz = R.F, rows = [
      ['A', t('Basin area', 'مساحة الحوض'), 'A', M.A, 'km²', ''], ['A', t('Perimeter', 'المحيط'), 'P', M.P, 'km', ''], ['A', t('Basin length (outlet to farthest divide)', 'طول الحوض (من المصب إلى أبعد نقطة على الخط الفاصل)'), 'Lb', M.Lb, 'km', ''],
      ['A', t('Form factor', 'معامل الشكل'), 'Rf', M.Rf, '', M.Rf < 0.45 ? t('elongated', 'مستطيل') : t('compact', 'مندمج')], ['A', t('Circularity ratio', 'نسبة الاستدارة'), 'Rc', M.Rc, '', M.Rc < 0.5 ? t('elongated', 'مستطيل') : t('near circular', 'قريب من الدائري')], ['A', t('Elongation ratio', 'نسبة الاستطالة'), 'Re', M.Re, '', reShape(M.Re)], ['A', t('Compactness coefficient', 'معامل الاندماج'), 'Cc', M.Cc, '', ''],
      ['L', t('Highest stream order', 'أعلى مرتبة'), 'u', M.kmax, '', ''], ['L', t('Number of streams', 'عدد المجاري'), 'ΣN', M.sumN, '', ''], ['L', t('Total stream length', 'مجموع أطوال المجاري'), 'ΣL', M.sumL, 'km', ''], ['L', t('Mean bifurcation ratio', 'متوسط نسبة التشعب'), 'Rb', M.Rb, '', M.Rb > 5 ? t('structural control', 'تحكم بنيوي') : ''], ['L', t('Weighted mean bifurcation ratio', 'متوسط نسبة التشعب الموزون'), 'Rbw', M.Rbw, '', ''],
      ['L', t('Bifurcation ratio from Horton’s law', 'نسبة التشعب من قانون هورتن'), 'Rb(H)', M.RbH, '', ''], ['L', t('Length ratio from Horton’s law', 'نسبة الأطوال من قانون هورتن'), 'RL', M.RLH, '', ''], ['L', t('Drainage density', 'كثافة التصريف'), 'Dd', M.Dd, 'km/km²', ''], ['L', t('Stream frequency', 'تكرار المجاري'), 'Fs', M.Fs, '1/km²', ''], ['L', t('Drainage texture', 'نسيج التصريف'), 'Rt', M.Rt, '1/km', ''],
      ['L', t('Length of overland flow', 'طول الجريان السطحي'), 'Lo', M.Lo, 'km', ''], ['L', t('Constant of channel maintenance', 'ثابت إدامة المجرى'), 'C', M.Cm, 'km²/km', ''], ['L', t('Longest flow path', 'أطول مسار للجريان'), 'Lc', M.Lc, 'km', ''], ['L', t('Channel slope 10–85 %', 'انحدار المجرى 10–85 %'), 'S10–85', M.S1085 * 1000, 'm/km', ''],
      ['R', t('Highest elevation', 'أعلى ارتفاع'), 'zmax', M.zmax, 'm', ''], ['R', t('Outlet / lowest elevation', 'أدنى ارتفاع'), 'zmin', M.zmin, 'm', ''], ['R', t('Mean elevation', 'متوسط الارتفاع'), 'z̄', M.zmean, 'm', ''], ['R', t('Basin relief', 'تضرس الحوض'), 'H', M.H, 'm', ''], ['R', t('Relief ratio', 'نسبة التضرس'), 'Rh', M.Rh, '', ''], ['R', t('Ruggedness number', 'رقم الوعورة'), 'Rn', M.Rn, '', ''], ['R', t('Melton ruggedness', 'وعورة ميلتون'), 'MR', M.Mel, '', ''], ['R', t('Mean slope', 'متوسط الانحدار'), 'θ', M.slope, '°', ''], ['R', t('Hypsometric integral', 'التكامل الهبسومتري'), 'HI', M.HI, '', M.HI > 0.6 ? t('youthful', 'شباب') : M.HI >= 0.35 ? t('mature', 'نضج') : t('old', 'شيخوخة')],
      ['H', t('Time of concentration (NRCS lag)', 'زمن التركيز (معادلة التأخر)'), 'tc', Fz.tcN, 'h', ''], ['H', t('Time of concentration (Kirpich)', 'زمن التركيز (كيربك)'), 'tc', Fz.tcK, 'h', ''], ['H', t('Lag time', 'زمن التأخر'), 'tL', Fz.lag, 'h', ''], ['H', t('Potential retention', 'الاحتجاز المحتمل'), 'S', Fz.S, 'mm', ''], ['H', t('Runoff depth', 'عمق الجريان'), 'Q', Fz.Q, 'mm', ''], ['H', t('Runoff coefficient', 'معامل الجريان'), 'C', Fz.C, '', ''], ['H', t('Runoff volume', 'حجم الجريان'), 'V', Fz.vol / 1e6, 'million m³', ''], ['H', t('Peak discharge', 'ذروة التصريف'), 'Qp', Fz.peak[1], 'm³/s', ''], ['H', t('Time to peak from storm start', 'زمن الذروة من بدء العاصفة'), 'tp', Fz.peak[0], 'h', '']];
    var GN = { A: t('Areal aspects', 'الخصائص المساحية'), L: t('Linear aspects', 'الخصائص الطولية'), R: t('Relief aspects', 'الخصائص التضاريسية'), H: t('Hydrology of the design storm', 'هيدرولوجيا العاصفة التصميمية') }, last = '';
    R.rows = rows;
    $('#wsPar').innerHTML = '<thead><tr><th>' + t('Parameter', 'المعامل') + '</th><th>' + t('Symbol', 'الرمز') + '</th><th class="num">' + t('Value', 'القيمة') + '</th><th>' + t('Unit', 'الوحدة') + '</th><th>' + t('Note', 'ملاحظة') + '</th></tr></thead><tbody>' + rows.map(function (r) { var h = ''; if (r[0] !== last) { last = r[0]; h = '<tr><th colspan="5" style="background:var(--surface-2)">' + GN[r[0]] + '</th></tr>'; } return h + '<tr><td>' + r[1] + '</td><td class="ltr">' + r[2] + '</td><td class="num">' + (r[3] == null || !isFinite(r[3]) ? '—' : F(r[3], dp(r[3]))) + '</td><td class="ltr">' + r[4] + '</td><td>' + r[5] + '</td></tr>'; }).join('') + '</tbody>';
    $('#wsOrd').innerHTML = '<thead><tr><th>' + t('Order u', 'المرتبة u') + '</th><th class="num">' + t('Streams Nu', 'عدد المجاري Nu') + '</th><th class="num">' + t('Bifurcation ratio', 'نسبة التشعب') + '</th><th class="num">' + t('Total length km', 'الطول الكلي كم') + '</th><th class="num">' + t('Mean length km', 'متوسط الطول كم') + '</th><th class="num">' + t('Length ratio', 'نسبة الأطوال') + '</th></tr></thead><tbody>' + R.ords.map(function (q) { return '<tr><td>' + q.u + '</td><td class="num">' + q.N + '</td><td class="num">' + (q.Rb ? F(q.Rb, 2) : '—') + '</td><td class="num">' + F(q.L, 2) + '</td><td class="num">' + F(q.Lm, 3) + '</td><td class="num">' + (q.RL ? F(q.RL, 2) : '—') + '</td></tr>'; }).join('') + '</tbody>';
  }
  function dp(v) { if (Number.isInteger(v)) return 0; var a = Math.abs(v); return a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : 3; }

  /* ---------------------------------------------------------------- figures */
  var OC = ['#4FA3E0', '#2F86CF', '#1F6FB2', '#155A99', '#0B4A85', '#073763', '#052A4D', '#031B33'];
  function ow(u) { return 0.6 + 0.65 * (u - 1); }
  function draw() {
    $('#wsEmpty').hidden = true; $('#wsOut').hidden = false; var M = R.M;
    if (lay) { lay.clearLayers(); L.polygon(R.ring, { color: '#C0392B', weight: 2.5, fillOpacity: 0.08 }).addTo(lay); R.segs.forEach(function (s) { L.polyline(s.pts, { color: OC[Math.min(OC.length - 1, s.u - 1)], weight: 1 + s.u * 0.8, opacity: 0.95 }).addTo(lay); }); L.circleMarker(R.outlet, { radius: 6, color: '#fff', weight: 2, fillColor: '#E67E22', fillOpacity: 1 }).addTo(lay).bindTooltip(t('Outlet', 'المصب')); map.fitBounds(L.polygon(R.ring).getBounds().pad(0.05)); }
    figMap(); figHorton(); figHyp(); figPro();
  }
  function figMap() {
    var hy = R.hy, Gd = hy.Gd, nx = hy.nx, ij = R.ij, mi = Math.max(3, Math.round((ij[1] - ij[0]) * 0.08)), mj = Math.max(3, Math.round((ij[3] - ij[2]) * 0.08));
    var i0 = Math.max(0, ij[0] - mi), i1 = Math.min(nx - 1, ij[1] + mi), j0 = Math.max(0, ij[2] - mj), j1 = Math.min(hy.ny - 1, ij[3] + mj), st = Math.max(1, Math.ceil(Math.max(i1 - i0 + 1, j1 - j0 + 1) / 900));
    var w = Math.floor((i1 - i0) / st) + 1, h = Math.floor((j1 - j0) / st) + 1, Gc = { nx: w, ny: h, lats: [], lons: [], z: new Float32Array(w * h) }, cv = document.createElement('canvas'); cv.width = w; cv.height = h; var g = cv.getContext('2d'), im = g.createImageData(w, h);
    for (var jj = 0; jj < h; jj++) Gc.lats.push(Gd.lats[j0 + jj * st]); for (var ii = 0; ii < w; ii++) Gc.lons.push(Gd.lons[i0 + ii * st]);
    for (jj = 0; jj < h; jj++) for (ii = 0; ii < w; ii++) { var c = (j0 + jj * st) * nx + i0 + ii * st, k = jj * w + ii; Gc.z[k] = Gd.z[c]; if (!R.bas.mask[c]) { im.data[k * 4] = im.data[k * 4 + 1] = im.data[k * 4 + 2] = 255; im.data[k * 4 + 3] = 150; } }
    g.putImageData(im, 0, 0); var mpd = SH.dem.metersPerDeg((Gc.lats[0] + Gc.lats[h - 1]) / 2);
    Gc.b = { n: Gc.lats[0], s: Gc.lats[h - 1], w: Gc.lons[0], e: Gc.lons[w - 1] }; Gc.dx = (Gc.b.e - Gc.b.w) / Math.max(1, w - 1) * mpd.x; Gc.dy = (Gc.b.n - Gc.b.s) / Math.max(1, h - 1) * mpd.y; SH.dem.stats(Gc);
    var lines = [{ pts: R.ring, color: '#C0392B', width: 2.4 }], maxU = R.M.kmax;
    R.segs.slice().sort(function (a, b) { return a.u - b.u; }).forEach(function (s) { lines.push({ pts: s.pts, color: OC[Math.min(OC.length - 1, s.u - 1)], width: ow(s.u) }); });
    lines.push({ pts: R.path, color: '#E67E22', width: 1.3, dash: '5 4' });
    var leg = [{ name: 'Basin boundary', color: '#C0392B', width: 2.4 }]; for (var u = 1; u <= maxU; u++) leg.push({ name: 'Stream, Strahler order ' + u, color: OC[Math.min(OC.length - 1, u - 1)], width: ow(u) }); leg.push({ name: 'Longest flow path', color: '#E67E22', width: 1.3, dash: '5 4' });
    SH.dem.svgMap($('#wsSvg'), Gc, [], { crs: 'geo', noContours: true, fill: true, ramp: 'hypso', image: cv.toDataURL('image/png'), lines: lines, legend: leg, points: [{ x: R.outlet[1], y: R.outlet[0], color: '#E67E22', label: 'Outlet' }], pointKinds: [{ color: '#E67E22', name: 'Outlet (pour point)' }],
      title: 'Drainage basin · outlet ' + F(R.outlet[0], 4) + '° N, ' + F(R.outlet[1], 4) + '° E', subtitle: 'Area ' + F(R.M.A, R.M.A < 10 ? 2 : 1) + ' km² · perimeter ' + F(R.M.P, 1) + ' km · Strahler order ' + maxU + ' · grid ' + F(R.cell, 0) + ' m · stream threshold ' + F(R.M.thr, R.M.thr < 1 ? 3 : 2) + ' km²', source: SH.dem.sources[R.src].short, legendTitle: 'Elevation (m)' });
    $('#wsCap').textContent = t('The basin is everything that drains to the outlet; land outside it is shown pale. Streams are coloured and thickened by their Strahler order; the dashed orange line is the longest flow path used for the time of concentration.', 'الحوض هو كل ما يصرف إلى المصب، وتظهر الأرض خارجه باهتة. وتُلوَّن المجاري وتُعرَّض بحسب مرتبتها عند ستريلر، والخط البرتقالي المتقطع هو أطول مسار للجريان المستعمل لزمن التركيز.');
  }
  function figHorton() {
    var O = R.ords.filter(function (q) { return q.N > 0; }), svg = $('#wsHor'); if (!O.length) { svg.innerHTML = ''; return; }
    var vals = []; O.forEach(function (q) { vals.push(q.N, q.Lm); }); vals = vals.filter(function (v) { return v > 0; });
    var lo = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, vals)))), hi = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, vals)))); if (hi / lo < 100) hi *= 10;
    var line = function (f) { return f ? [[0.8, Math.pow(10, f.a + f.b * 0.8)], [O.length + 0.2, Math.pow(10, f.a + f.b * (O.length + 0.2))]] : []; };
    var ser = [{ pts: O.map(function (q) { return [q.u, q.N]; }), col: '#1F6FB2', w: 0, mark: 'o', r: 5, mfill: '#1F6FB2' }, { pts: line(R.fN), col: '#1F6FB2', w: 1.6, dash: '6 4' }, { pts: O.filter(function (q) { return q.Lm > 0; }).map(function (q) { return [q.u, q.Lm]; }), col: '#C0392B', w: 0, mark: 's', r: 5, mfill: '#C0392B' }, { pts: line(R.fL), col: '#C0392B', w: 1.6, dash: '6 4' }];
    G.chart(svg, { W: 760, H: 420, m: { l: 74, r: 18, t: 18, b: 58 }, x: { lo: 0, hi: O.length + 1, n: O.length + 1, title: 'Stream order u', plain: 1 }, y: { lo: lo, hi: hi, log: 1, title: 'Number of streams · mean length (km)' }, series: ser,
      legend: [{ name: 'Number of streams Nu', col: '#1F6FB2', mark: 'o', mfill: '#1F6FB2', noLine: 1 }, { name: 'Law of numbers, Rb = ' + (R.M.RbH ? F(R.M.RbH, 2) : '—'), col: '#1F6FB2', dash: '6 4' }, { name: 'Mean length Lu (km)', col: '#C0392B', mark: 's', mfill: '#C0392B', noLine: 1 }, { name: 'Law of lengths, RL = ' + (R.M.RLH ? F(R.M.RLH, 2) : '—'), col: '#C0392B', dash: '6 4' }] });
    $('#wsHorCap').textContent = t('Horton’s laws: stream numbers fall and mean lengths rise geometrically with order, so they plot as straight lines on a logarithmic scale. Points far from the lines reveal orders affected by structure, lithology or the stream threshold.', 'قانونا هورتن: تتناقص أعداد المجاري وتتزايد متوسطات أطوالها هندسياً مع المرتبة، فتظهر خطوطاً مستقيمة على المقياس اللوغاريتمي. والنقاط البعيدة عن الخطوط تكشف مراتب متأثرة بالبنية أو الصخارية أو عتبة المجرى.');
  }
  function figHyp() {
    var ref = [], x; for (x = 0; x <= 1.0001; x += 0.05) ref.push([x, 1 - x]);
    G.chart($('#wsHyp'), { W: 760, H: 460, m: { l: 74, r: 18, t: 18, b: 58 }, x: { lo: 0, hi: 1, title: 'Relative area a/A (area above the height)' }, y: { lo: 0, hi: 1, title: 'Relative height h/H' },
      series: [{ pts: R.hyp, col: '#2E6FBF', w: 2.6, area: 1, fillOp: 0.18 }, { pts: ref, col: '#9AA3AB', w: 1.2, dash: '5 4' }], legend: [{ name: 'Hypsometric curve, HI = ' + F(R.M.HI, 3), col: '#2E6FBF' }, { name: 'HI = 0.5 reference', col: '#9AA3AB', dash: '5 4' }], note: 'Convex upward: youthful (HI > 0.6) · S-shaped: mature (0.35–0.6) · concave: old (< 0.35).' });
    $('#wsHypCap').textContent = t('The share of the basin area lying above each relative height. The area under the curve is the hypsometric integral; it measures how much of the original upland volume is still to be eroded (Strahler 1952).', 'نسبة مساحة الحوض الواقعة فوق كل ارتفاع نسبي. والمساحة تحت المنحنى هي التكامل الهبسومتري، وتقيس مقدار ما بقي من الحجم الأصلي للمرتفعات دون تعرية (ستريلر 1952).');
  }
  function figPro() {
    var P = R.prof.filter(function (p) { return isFinite(p[1]); }); if (P.length < 2) return; var raw = P.filter(function (p) { return isFinite(p[2]); }).map(function (p) { return [p[0], p[2]]; }); P = P.map(function (p) { return [p[0], p[1]]; }); var zs = P.map(function (p) { return p[1]; }).concat(raw.map(function (p) { return p[1]; })), lo = Math.min.apply(null, zs), hi = Math.max.apply(null, zs), pad = (hi - lo) * 0.06 || 5;
    G.chart($('#wsPro'), { W: 760, H: 400, m: { l: 74, r: 18, t: 18, b: 58 }, x: { lo: 0, hi: P[P.length - 1][0], title: 'Distance from the divide along the longest flow path (km)' }, y: { lo: lo - pad, hi: hi + pad, title: 'Elevation (m)' },
      series: [{ pts: raw, col: '#9AA3AB', w: 1 }, { pts: P, col: '#2E6FBF', w: 2.2, area: 1, fillOp: 0.12 }, { pts: [[R.p85[0], R.p85[1]], [R.p10[0], R.p10[1]]], col: '#C0392B', w: 1.6, dash: '6 4', mark: 'o', r: 4.5, mfill: '#C0392B' }],
      legend: [{ name: 'Channel profile (depressions filled)', col: '#2E6FBF' }, { name: 'Raw elevation model', col: '#9AA3AB', w: 1 }, { name: 'Slope between 10 % and 85 % of length: ' + F(R.M.S1085 * 1000, 1) + ' m/km', col: '#C0392B', dash: '6 4', mark: 'o', mfill: '#C0392B' }], note: 'Length ' + F(R.M.Lc, 2) + ' km · fall ' + F(R.M.Hpath, 0) + ' m from the head of the path to the outlet.' });
    $('#wsProCap').textContent = t('Elevation along the longest flow path from the divide to the outlet, after depressions in the elevation model are filled; the grey line is the raw model, whose dips are mostly noise, bridges or vegetation. Steps and convex sections (knickpoints) mark resistant beds, faults or recent uplift; a smooth concave profile marks a graded channel.', 'الارتفاع على امتداد أطول مسار للجريان من الخط الفاصل إلى المصب بعد ملء منخفضات نموذج الارتفاع؛ والخط الرمادي هو النموذج الخام، وانخفاضاته في الغالب ضوضاء أو جسور أو نبات. والدرجات والأجزاء المحدبة (نقاط التغير) تدل على طبقات مقاومة أو فوالق أو رفع حديث، والمقطع المقعر المنتظم يدل على مجرى متوازن.');
  }
  function figHyd() {
    var Fz = R.F; if (!Fz.hyd.length) return; var mx = Math.max(Fz.peak[1], 0.001);
    G.chart($('#wsHyd'), { W: 760, H: 420, m: { l: 74, r: 18, t: 18, b: 58 }, zero: 1, x: { lo: 0, hi: Fz.hyd[Fz.hyd.length - 1][0], title: 'Time from the start of the storm (h)' }, y: { lo: 0, hi: mx * 1.12, title: 'Discharge at the outlet (m³/s)' },
      series: [{ pts: Fz.hyd, col: '#2E6FBF', w: 2.4, area: 1, fillOp: 0.15 }], vl: [{ v: Fz.Td, col: '#9AA3AB', dash: '5 4' }, { v: Fz.peak[0], col: '#C0392B', dash: '6 4', label: 'Peak ' + F(Fz.peak[1], Fz.peak[1] < 10 ? 1 : 0) + ' m³/s' }],
      legend: [{ name: 'Flood hydrograph', col: '#2E6FBF' }, { name: 'Time of peak', col: '#C0392B', dash: '6 4' }, { name: 'End of the storm', col: '#9AA3AB', dash: '5 4' }], note: 'Storm ' + F(Fz.P, 0) + ' mm in ' + F(Fz.Td, 1) + ' h · CN ' + F(Fz.CN, 0) + ' · runoff ' + F(Fz.Q, 1) + ' mm · lag ' + F(Fz.lag, 2) + ' h · volume ' + F(Fz.vol / 1e6, 2) + ' million m³.' });
    $('#wsHydCap').textContent = t('Discharge at the outlet for rain falling uniformly over the storm duration, from the curve-number runoff and the dimensionless unit hydrograph. It ignores channel losses and storage, which lower desert floods, and assumes the storm covers the whole basin.', 'التصريف عند المصب لمطر يهطل بانتظام طوال مدة العاصفة، من جريان رقم المنحنى ووحدة الهيدروغراف اللابعدية. ويهمل فواقد المجرى والخزن اللذين يخفضان سيول الصحراء، ويفترض أن العاصفة تغطي الحوض كله.');
  }

  /* ---------------------------------------------------------------- exports and links */
  function geojson() {
    var M = R.M, ring = R.ring.map(function (p) { return [+p[1].toFixed(6), +p[0].toFixed(6)]; });
    var fs = [{ type: 'Feature', properties: { kind: 'basin', area_km2: +M.A.toFixed(4), perimeter_km: +M.P.toFixed(3), order: M.kmax, drainage_density: +M.Dd.toFixed(4), hypsometric_integral: +M.HI.toFixed(4), relief_m: +M.H.toFixed(1) }, geometry: { type: 'Polygon', coordinates: [ring] } }];
    R.segs.forEach(function (s) { fs.push({ type: 'Feature', properties: { kind: 'stream', strahler: s.u }, geometry: { type: 'LineString', coordinates: s.pts.map(function (p) { return [+p[1].toFixed(6), +p[0].toFixed(6)]; }) } }); });
    fs.push({ type: 'Feature', properties: { kind: 'longest_flow_path', length_km: +M.Lc.toFixed(3) }, geometry: { type: 'LineString', coordinates: R.path.map(function (p) { return [+p[1].toFixed(6), +p[0].toFixed(6)]; }) } });
    fs.push({ type: 'Feature', properties: { kind: 'outlet' }, geometry: { type: 'Point', coordinates: [+R.outlet[1].toFixed(6), +R.outlet[0].toFixed(6)] } });
    return { type: 'FeatureCollection', features: fs };
  }
  $('#wsGeo').addEventListener('click', function () { if (!R) return; SH.download('shandal-basin.geojson', new Blob([JSON.stringify(geojson())], { type: 'application/geo+json' })); });
  $('#wsKml').addEventListener('click', function () {
    if (!R) return; var cs = function (pts) { return pts.map(function (p) { return p[1].toFixed(6) + ',' + p[0].toFixed(6) + ',0'; }).join(' '); }, s = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Shandal drainage basin</name><Style id="b"><LineStyle><color>ff2b39c0</color><width>3</width></LineStyle><PolyStyle><color>222b39c0</color></PolyStyle></Style>';
    for (var u = 1; u <= R.M.kmax; u++) s += '<Style id="s' + u + '"><LineStyle><color>ffb26f1f</color><width>' + (1 + u * 0.8).toFixed(1) + '</width></LineStyle></Style>';
    s += '<Placemark><name>Basin ' + F(R.M.A, 2) + ' km2</name><styleUrl>#b</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>' + cs(R.ring) + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>';
    R.segs.forEach(function (sg) { s += '<Placemark><name>Order ' + sg.u + '</name><styleUrl>#s' + sg.u + '</styleUrl><LineString><coordinates>' + cs(sg.pts) + '</coordinates></LineString></Placemark>'; });
    s += '<Placemark><name>Outlet</name><Point><coordinates>' + R.outlet[1].toFixed(6) + ',' + R.outlet[0].toFixed(6) + ',0</coordinates></Point></Placemark></Document></kml>';
    SH.download('shandal-basin.kml', new Blob([s], { type: 'application/vnd.google-earth.kml+xml' }));
  });
  $('#wsCsv').addEventListener('click', function () { if (!R) return; SH.csv('shandal-basin-morphometry.csv', [['group', 'parameter', 'symbol', 'value', 'unit']].concat(R.rows.map(function (r) { return [r[0], r[1], r[2], r[3] == null ? '' : (+r[3]).toPrecision(6), r[4]]; }))); });
  $('#wsOrdCsv').addEventListener('click', function () { if (!R) return; SH.csv('shandal-basin-orders.csv', [['order', 'streams', 'bifurcation_ratio', 'total_length_km', 'mean_length_km', 'length_ratio']].concat(R.ords.map(function (q) { return [q.u, q.N, q.Rb ? q.Rb.toFixed(3) : '', q.L.toFixed(3), q.Lm.toFixed(4), q.RL ? q.RL.toFixed(3) : '']; }))); });
  $('#wsToHydro').addEventListener('click', function () { if (!R) return; var o = SH.store.get('shandal_tool_hydro', {}); o.hLat = R.outlet[0].toFixed(5); o.hLon = R.outlet[1].toFixed(5); SH.store.set('shandal_tool_hydro', o); location.href = SH.base + (AR ? 'ar/' : '') + 'tools/hydro-alert/app/'; });
  $('#wsToPz').addEventListener('click', function () { if (!R) return; SH.store.set('shandal_pz_aoi', { n: R.bb.n, s: R.bb.s, e: R.bb.e, w: R.bb.w }); location.href = SH.base + (AR ? 'ar/' : '') + 'tools/potential-zones/app/'; });
  $('#wsRun').addEventListener('click', run);
  ['wsThr'].forEach(function (id) { $('#' + id).addEventListener('change', function () { if (R && !busy) { var res = analyse(R.hy, R.o, R.bas, { lat: R.req[0], lon: R.req[1], src: R.src }); R = res; flood(); draw(); } }); });
  document.addEventListener('DOMContentLoaded', function () { var la = G.v('wsLat'), lo = G.v('wsLon'); if (isFinite(la) && isFinite(lo)) setPt(la, lo, true); });
  window.SHWS = { hydro: hydro, delin: delin, snap: snap, analyse: function (h, o, b) { return analyse(h, o, b, { lat: 0, lon: 0, src: 'aws' }); }, get R() { return R; } };
})();
