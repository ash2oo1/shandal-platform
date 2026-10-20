/* Shandal DEM engine — global elevation grids from AWS Terrain Tiles (Terrarium PNG, Tilezen) or Copernicus GLO-90 (Open-Meteo),
   bilinear sampling, Horn derivatives, marching-squares contours, hillshade and hypsometric rendering. */
(function (w) {
  'use strict';
  var SH = w.SH, t = SH.t, D = SH.dem = {};
  var TILE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  D.sources = {
    aws: { name: t('AWS Terrain Tiles (SRTM, 3DEP, ETOPO1 · ~30 m)', 'بلاطات AWS للتضاريس (SRTM و3DEP وETOPO1 · ~30 م)'), attr: 'Terrain Tiles: Tilezen/Mapzen on AWS Open Data — SRTM, USGS 3DEP, GMTED2010, ETOPO1, EU-DEM and others.' },
    cop: { name: t('Copernicus GLO-90 via Open-Meteo (90 m)', 'Copernicus GLO-90 عبر Open-Meteo (90 م)'), attr: 'Copernicus DEM GLO-90 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the EU and ESA; served by Open-Meteo.' }
  };
  var lon2x = function (lon, z) { return (lon + 180) / 360 * Math.pow(2, z); };
  var lat2y = function (lat, z) { var r = SH.rad(lat); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
  D.metersPerDeg = function (lat) { return { x: 111320 * Math.cos(SH.rad(lat)), y: 110574 }; };

  function loadImg(url) {
    return new Promise(function (res, rej) {
      var tries = 0;
      (function go() { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = function () { if (++tries < 3) setTimeout(go, 600 * tries); else rej(new Error(t('Elevation tile could not be loaded.', 'تعذر تحميل بلاطة الارتفاع.'))); }; im.src = url; })();
    });
  }
  /* Build a bilinear sampler over a terrarium mosaic covering bounds at a resolution near res_m */
  D.terrarium = function (b, res_m, onProgress) {
    var lat = (b.n + b.s) / 2, z = 14;
    var ntiles = function (z) { return (Math.floor(lon2x(b.e, z)) - Math.floor(lon2x(b.w, z)) + 1) * (Math.floor(lat2y(b.s, z)) - Math.floor(lat2y(b.n, z)) + 1); };
    var pxm = function (z) { return 156543.03 * Math.cos(SH.rad(lat)) / Math.pow(2, z); };
    while (z > 1 && ntiles(z) > 36) z--;
    while (z > 1 && pxm(z - 1) <= res_m / 1.5) z--;
    var x0 = Math.floor(lon2x(b.w, z)), x1 = Math.floor(lon2x(b.e, z)), y0 = Math.floor(lat2y(b.n, z)), y1 = Math.floor(lat2y(b.s, z)), W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var cx = cv.getContext('2d', { willReadFrequently: true }), jobs = [], done = 0, total = (x1 - x0 + 1) * (y1 - y0 + 1), n2 = Math.pow(2, z);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) (function (tx, ty) {
      var wx = ((tx % n2) + n2) % n2;
      jobs.push(loadImg(TILE.replace('{z}', z).replace('{x}', wx).replace('{y}', ty)).then(function (im) { cx.drawImage(im, (tx - x0) * 256, (ty - y0) * 256); if (onProgress) onProgress(++done, total); }));
    })(tx, ty);
    return Promise.all(jobs).then(function () {
      var px = cx.getImageData(0, 0, W, H).data, E = new Float32Array(W * H);
      for (var i = 0, k = 0; i < E.length; i++, k += 4) E[i] = px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768;
      var f = function (la, lo) {
        var gx = (lon2x(lo, z) - x0) * 256 - 0.5, gy = (lat2y(la, z) - y0) * 256 - 0.5, ix = Math.max(0, Math.min(W - 2, Math.floor(gx))), iy = Math.max(0, Math.min(H - 2, Math.floor(gy))), fx = Math.max(0, Math.min(1, gx - ix)), fy = Math.max(0, Math.min(1, gy - iy)), o = iy * W + ix;
        return E[o] * (1 - fx) * (1 - fy) + E[o + 1] * fx * (1 - fy) + E[o + W] * (1 - fx) * fy + E[o + W + 1] * fx * fy;
      };
      f.zoom = z; f.pixel = 156543.03 * Math.cos(SH.rad(lat)) / Math.pow(2, z); return f;
    });
  };
  /* Copernicus GLO-90 point query through Open-Meteo, 100 points per request */
  D.copernicus = function (pts, onProgress) {
    var out = new Array(pts.length), chunks = [];
    for (var i = 0; i < pts.length; i += 100) chunks.push(i);
    var idx = 0;
    function next() {
      if (idx >= chunks.length) return Promise.resolve(out);
      var s = chunks[idx], part = pts.slice(s, s + 100), tries = 0;
      var url = 'https://api.open-meteo.com/v1/elevation?latitude=' + part.map(function (p) { return p[0].toFixed(5); }).join(',') + '&longitude=' + part.map(function (p) { return p[1].toFixed(5); }).join(',');
      function go() {
        return fetch(url).then(function (r) { if (r.status === 429) throw { retry: true }; if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
          j.elevation.forEach(function (v, k) { out[s + k] = v; }); idx++; if (onProgress) onProgress(idx, chunks.length); return new Promise(function (r) { setTimeout(r, 250); }).then(next);
        }).catch(function (e) { if (++tries <= 5) return new Promise(function (r) { setTimeout(r, (e && e.retry ? 4000 : 1500) * tries); }).then(go); throw new Error(t('The elevation service is busy. Try a coarser grid or the AWS source.', 'خدمة الارتفاعات مشغولة. جرّب شبكة أخشن أو مصدر AWS.')); });
      }
      return go();
    }
    return next();
  };
  /* Regular grid over bounds {n,s,e,w}; rows run north to south */
  /* Copernicus GLO-90 is a 3″ (~90 m) grid of whole metres. Sample it on its native lattice, smooth the 1 m
     quantisation with a 3 × 3 binomial filter, and return a bilinear sampler for any finer target grid. */
  D.copNative = function (b, onProgress) {
    var d = 1 / 1200, pad = 2 * d, s0 = Math.floor((b.s - pad) / d) * d, w0 = Math.floor((b.w - pad) / d) * d, ny = Math.ceil((b.n + pad - s0) / d) + 1, nx = Math.ceil((b.e + pad - w0) / d) + 1, pts = [], i, j;
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) pts.push([s0 + j * d, w0 + i * d]);
    return D.copernicus(pts, onProgress).then(function (z) {
      var A = new Float32Array(nx * ny), S = new Float32Array(nx * ny); for (var k = 0; k < z.length; k++) A[k] = z[k] == null ? NaN : z[k];
      var W = [1, 2, 1];
      for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var sum = 0, wt = 0; for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) { var ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; var v = A[jj * nx + ii]; if (isNaN(v)) continue; var ww = W[di + 1] * W[dj + 1]; sum += v * ww; wt += ww; } S[j * nx + i] = wt ? sum / wt : NaN; }
      return function (lat, lon) { var fx = (lon - w0) / d, fy = (lat - s0) / d, x0 = Math.max(0, Math.min(nx - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(ny - 2, Math.floor(fy))), tx = fx - x0, ty = fy - y0;
        var a = S[y0 * nx + x0], b2 = S[y0 * nx + x0 + 1], c = S[(y0 + 1) * nx + x0], e = S[(y0 + 1) * nx + x0 + 1]; return a * (1 - tx) * (1 - ty) + b2 * tx * (1 - ty) + c * (1 - tx) * ty + e * tx * ty; };
    });
  };
  D.grid = function (b, nx, ny, opts) {
    opts = opts || {}; var src = opts.source || 'aws', lats = [], lons = [], i, j;
    for (j = 0; j < ny; j++) lats.push(b.n - (b.n - b.s) * j / (ny - 1));
    for (i = 0; i < nx; i++) lons.push(b.w + (b.e - b.w) * i / (nx - 1));
    var m = D.metersPerDeg((b.n + b.s) / 2), dx = (b.e - b.w) / (nx - 1) * m.x, dy = (b.n - b.s) / (ny - 1) * m.y;
    var G = { nx: nx, ny: ny, lats: lats, lons: lons, b: b, dx: dx, dy: dy, source: src, z: new Float32Array(nx * ny) };
    if (src === 'cop') {
      var pts = []; for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) pts.push([lats[j], lons[i]]);
      return D.copernicus(pts, opts.onProgress).then(function (z) { for (var k = 0; k < z.length; k++) G.z[k] = z[k] == null ? NaN : z[k]; return D.stats(G); });
    }
    return D.terrarium(b, Math.min(dx, dy), opts.onProgress).then(function (f) { G.zoom = f.zoom; G.pixel = f.pixel; for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) G.z[j * nx + i] = f(lats[j], lons[i]); return D.stats(G); });
  };

  /* Regular grid in a chosen CRS: 'geo' (square degree cells) or 'utm' (metres, zone of the centre). Rows run north to south. */
  D.plan = function (b, crs, step) {
    var latc = (b.n + b.s) / 2, lonc = (b.e + b.w) / 2;
    if (crs === 'geo') { var dd = step / 110574, nx = Math.round((b.e - b.w) / dd) + 1, ny = Math.round((b.n - b.s) / dd) + 1; return { crs: 'geo', nx: nx, ny: ny, dd: dd, b: { n: b.s + (ny - 1) * dd, s: b.s, w: b.w, e: b.w + (nx - 1) * dd } }; }
    var zone = SH.utmZone(latc, lonc), south = latc < 0, c = [[b.n, b.w], [b.n, b.e], [b.s, b.w], [b.s, b.e]].map(function (p) { return SH.toUTM(p[0], p[1], zone); });
    var E0 = Math.ceil(Math.min.apply(null, c.map(function (u) { return u.E; })) / step) * step, E1 = Math.floor(Math.max.apply(null, c.map(function (u) { return u.E; })) / step) * step;
    var N0 = Math.ceil(Math.min.apply(null, c.map(function (u) { return u.N; })) / step) * step, N1 = Math.floor(Math.max.apply(null, c.map(function (u) { return u.N; })) / step) * step;
    return { crs: 'utm', zone: zone, south: south, nx: Math.round((E1 - E0) / step) + 1, ny: Math.round((N1 - N0) / step) + 1, b: { n: N1, s: N0, w: E0, e: E1 }, step: step, geo: b };
  };
  D.build = function (b, crs, step, source, onProgress) {
    var P = D.plan(b, crs, step), nx = P.nx, ny = P.ny, i, j, G = { nx: nx, ny: ny, b: P.b, crs: P.crs, zone: P.zone, south: P.south, source: source, step: step, lats: [], lons: [], z: new Float32Array(nx * ny) }, ll = [];
    for (j = 0; j < ny; j++) G.lats.push(P.b.n - (P.b.n - P.b.s) * j / Math.max(1, ny - 1));
    for (i = 0; i < nx; i++) G.lons.push(P.b.w + (P.b.e - P.b.w) * i / Math.max(1, nx - 1));
    if (P.crs === 'geo') { var m = D.metersPerDeg((P.b.n + P.b.s) / 2); G.dx = P.dd * m.x; G.dy = P.dd * m.y; G.dd = P.dd; for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) ll.push([G.lats[j], G.lons[i]]); }
    else { G.dx = G.dy = step; for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var q = SH.fromUTM(G.lons[i], G.lats[j], P.zone, P.south); ll.push([q.lat, q.lon]); } }
    G.geo = { n: -90, s: 90, e: -180, w: 180 }; ll.forEach(function (p) { if (p[0] > G.geo.n) G.geo.n = p[0]; if (p[0] < G.geo.s) G.geo.s = p[0]; if (p[1] > G.geo.e) G.geo.e = p[1]; if (p[1] < G.geo.w) G.geo.w = p[1]; });
    G.ll = ll;
    var fill = function (z) { for (var k = 0; k < z.length; k++) G.z[k] = z[k] == null || isNaN(z[k]) ? NaN : z[k]; return D.stats(G); };
    if (source === 'cop') return D.copNative(G.geo, onProgress).then(function (f) { G.resampled = true; return fill(ll.map(function (p) { return f(p[0], p[1]); })); });
    var pad = 0.001, gb = { n: G.geo.n + pad, s: G.geo.s - pad, e: G.geo.e + pad, w: G.geo.w - pad };
    return D.terrarium(gb, step, onProgress).then(function (f) { G.zoom = f.zoom; G.pixel = f.pixel; return fill(ll.map(function (p) { return f(p[0], p[1]); })); });
  };
  D.points = function (pts, opts) {
    opts = opts || {};
    if ((opts.source || 'aws') === 'cop') return D.copernicus(pts, opts.onProgress);
    var b = { n: -90, s: 90, e: -180, w: 180 }; pts.forEach(function (p) { b.n = Math.max(b.n, p[0]); b.s = Math.min(b.s, p[0]); b.e = Math.max(b.e, p[1]); b.w = Math.min(b.w, p[1]); });
    var pad = 0.002; b.n += pad; b.s -= pad; b.e += pad; b.w -= pad;
    var span = Math.max((b.n - b.s) * 110574, (b.e - b.w) * D.metersPerDeg((b.n + b.s) / 2).x);
    return D.terrarium(b, opts.res || Math.max(10, span / Math.max(pts.length, 50)), opts.onProgress).then(function (f) { return pts.map(function (p) { return f(p[0], p[1]); }); });
  };
  D.stats = function (G) {
    var mn = Infinity, mx = -Infinity, s = 0, n = 0;
    for (var k = 0; k < G.z.length; k++) { var v = G.z[k]; if (isNaN(v)) continue; if (v < mn) mn = v; if (v > mx) mx = v; s += v; n++; }
    G.min = mn; G.max = mx; G.mean = s / n; return G;
  };
  /* Horn (1981) slope (deg), aspect (deg from north, clockwise) */
  D.derive = function (G) {
    var nx = G.nx, ny = G.ny, z = G.z, S = new Float32Array(nx * ny), A = new Float32Array(nx * ny);
    var at = function (i, j) { i = Math.max(0, Math.min(nx - 1, i)); j = Math.max(0, Math.min(ny - 1, j)); return z[j * nx + i]; };
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var a = at(i - 1, j - 1), b = at(i, j - 1), c = at(i + 1, j - 1), d = at(i - 1, j), f = at(i + 1, j), g = at(i - 1, j + 1), h = at(i, j + 1), k = at(i + 1, j + 1);
      var gx = ((c + 2 * f + k) - (a + 2 * d + g)) / (8 * G.dx), gy = ((g + 2 * h + k) - (a + 2 * b + c)) / (8 * G.dy);
      S[j * nx + i] = SH.deg(Math.atan(Math.sqrt(gx * gx + gy * gy))); A[j * nx + i] = (SH.deg(Math.atan2(-gx, gy)) + 360) % 360;
      /* gy positive means elevation increases southward, so the slope faces north */
    }
    G.slope = S; G.aspect = A; return G;
  };
  /* Marching squares: returns [{level, lines:[[[lat,lon],...],...]}] */
  D.contours = function (G, levels) {
    var nx = G.nx, ny = G.ny, z = G.z, out = [];
    var toLL = function (p) { return [G.b.n - (G.b.n - G.b.s) * p[1] / (ny - 1), G.b.w + (G.b.e - G.b.w) * p[0] / (nx - 1)]; };
    levels.forEach(function (L) {
      var segs = [];
      for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
        var tl = z[j * nx + i], tr = z[j * nx + i + 1], br = z[(j + 1) * nx + i + 1], bl = z[(j + 1) * nx + i];
        if (isNaN(tl) || isNaN(tr) || isNaN(br) || isNaN(bl)) continue;
        var c = (tl >= L ? 8 : 0) | (tr >= L ? 4 : 0) | (br >= L ? 2 : 0) | (bl >= L ? 1 : 0); if (c === 0 || c === 15) continue;
        var e = function (a, b) { return a === b ? 0.5 : (L - a) / (b - a); };
        var T = [i + e(tl, tr), j], R = [i + 1, j + e(tr, br)], B = [i + e(bl, br), j + 1], Lf = [i, j + e(tl, bl)];
        var ctr = (tl + tr + br + bl) / 4;
        switch (c) {
          case 1: case 14: segs.push([Lf, B]); break; case 2: case 13: segs.push([B, R]); break; case 3: case 12: segs.push([Lf, R]); break;
          case 4: case 11: segs.push([T, R]); break; case 6: case 9: segs.push([T, B]); break; case 7: case 8: segs.push([Lf, T]); break;
          case 5: if (ctr >= L) { segs.push([Lf, T]); segs.push([B, R]); } else { segs.push([Lf, B]); segs.push([T, R]); } break;
          case 10: if (ctr >= L) { segs.push([T, R]); segs.push([Lf, B]); } else { segs.push([Lf, T]); segs.push([B, R]); } break;
        }
      }
      out.push({ level: L, lines: join(segs).map(function (ln) { return ln.map(toLL); }) });
    });
    return out;
  };
  function join(segs) {
    var key = function (p) { return p[0].toFixed(4) + ',' + p[1].toFixed(4); }, ends = {}, used = new Uint8Array(segs.length), lines = [];
    segs.forEach(function (s, k) { [0, 1].forEach(function (e) { var kk = key(s[e]); (ends[kk] = ends[kk] || []).push(k); }); });
    function take(p, cur) { var l = ends[key(p)] || []; for (var q = 0; q < l.length; q++) if (!used[l[q]] && l[q] !== cur) return l[q]; return -1; }
    for (var k = 0; k < segs.length; k++) {
      if (used[k]) continue; used[k] = 1; var line = [segs[k][0], segs[k][1]], n;
      while ((n = take(line[line.length - 1], -1)) >= 0) { used[n] = 1; var s = segs[n]; line.push(key(s[0]) === key(line[line.length - 1]) ? s[1] : s[0]); }
      while ((n = take(line[0], -1)) >= 0) { used[n] = 1; s = segs[n]; line.unshift(key(s[0]) === key(line[0]) ? s[1] : s[0]); }
      lines.push(line);
    }
    return lines;
  }
  D.niceInterval = function (range, target) { var raw = range / (target || 12), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  D.levels = function (G, step, base) { base = base || 0; var a = Math.ceil((G.min - base) / step) * step + base, out = []; for (var v = a; v <= G.max; v += step) out.push(+v.toFixed(6)); return out; };
  /* Colour ramps */
  var RAMPS = {
    hypso: [[0, [46, 110, 74]], [0.18, [104, 160, 92]], [0.38, [205, 196, 128]], [0.58, [196, 150, 92]], [0.78, [150, 104, 78]], [1, [245, 242, 236]]],
    terrain: [[0, [30, 92, 150]], [0.25, [70, 160, 120]], [0.5, [230, 220, 140]], [0.75, [170, 120, 80]], [1, [255, 255, 255]]],
    gray: [[0, [30, 30, 30]], [1, [240, 240, 240]]],
    diverge: [[0, [33, 102, 172]], [0.25, [146, 197, 222]], [0.5, [247, 247, 247]], [0.75, [244, 165, 130]], [1, [178, 24, 43]]],
    spectral: [[0, [50, 136, 189]], [0.25, [153, 213, 148]], [0.5, [255, 255, 191]], [0.75, [252, 141, 89]], [1, [213, 62, 79]]],
    viridis: [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]]
  };
  D.ramps = RAMPS;
  D.color = function (v, ramp) { var r = RAMPS[ramp || 'hypso']; v = Math.max(0, Math.min(1, v)); for (var k = 1; k < r.length; k++) if (v <= r[k][0]) { var a = r[k - 1], b = r[k], f = (v - a[0]) / (b[0] - a[0]); return [0, 1, 2].map(function (c) { return Math.round(a[1][c] + (b[1][c] - a[1][c]) * f); }); } return r[r.length - 1][1]; };
  D.plotlyScale = function (ramp) { return RAMPS[ramp || 'hypso'].map(function (s) { return [s[0], 'rgb(' + s[1].join(',') + ')']; }); };
  /* Hillshade × hypsometric tint canvas; returns data URL */
  D.render = function (G, opts) {
    opts = opts || {}; if (!G.slope) D.derive(G);
    var nx = G.nx, ny = G.ny, cv = document.createElement('canvas'); cv.width = nx; cv.height = ny;
    var cx = cv.getContext('2d'), im = cx.createImageData(nx, ny), az = SH.rad(opts.azimuth == null ? 315 : opts.azimuth), alt = SH.rad(opts.altitude == null ? 45 : opts.altitude), rg = (G.max - G.min) || 1, tint = opts.tint !== false;
    for (var k = 0; k < nx * ny; k++) {
      var s = SH.rad(G.slope[k]), a = SH.rad(G.aspect[k]), hs = Math.max(0, Math.cos(alt) * Math.cos(s) + Math.sin(alt) * Math.sin(s) * Math.cos(az - a));
      var c = tint ? D.color((G.z[k] - G.min) / rg, opts.ramp) : [255, 255, 255], m = opts.shade === false ? 1 : 0.35 + 0.65 * hs;
      im.data[k * 4] = c[0] * m; im.data[k * 4 + 1] = c[1] * m; im.data[k * 4 + 2] = c[2] * m; im.data[k * 4 + 3] = isNaN(G.z[k]) ? 0 : 255;
    }
    cx.putImageData(im, 0, 0);
    var k2 = Math.max(1, Math.min(8, Math.ceil(900 / Math.max(nx, ny)))); if (k2 > 1 && opts.upsample !== false) { var big = document.createElement('canvas'); big.width = nx * k2; big.height = ny * k2; var bx = big.getContext('2d'); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high'; bx.drawImage(cv, 0, 0, big.width, big.height); return big.toDataURL('image/png'); }
    return cv.toDataURL('image/png');
  };
  /* Profile along a polyline of [lat,lon]; returns {d:[m], z:[m], pts:[[lat,lon]]} */
  D.densify = function (line, n) {
    var seg = [], tot = 0; for (var k = 1; k < line.length; k++) { var dd = SH.dist({ lat: line[k - 1][0], lon: line[k - 1][1] }, { lat: line[k][0], lon: line[k][1] }); seg.push(dd); tot += dd; }
    var pts = [], ds = []; for (var q = 0; q < n; q++) { var tgt = tot * q / (n - 1), acc = 0, s = 0; while (s < seg.length - 1 && acc + seg[s] < tgt) { acc += seg[s]; s++; } var f = seg[s] ? (tgt - acc) / seg[s] : 0; pts.push([line[s][0] + (line[s + 1][0] - line[s][0]) * f, line[s][1] + (line[s + 1][1] - line[s][1]) * f]); ds.push(tgt); }
    return { pts: pts, d: ds, length: tot };
  };

  /* ---------- scattered points → grid (projected x/y in metres or degrees) */
  function solve(A, b) { var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) { var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; var tmp = M[c]; M[c] = M[p]; M[p] = tmp; var piv = M[c][c]; if (Math.abs(piv) < 1e-12) piv = 1e-12;
      for (r = c + 1; r < n; r++) { var f = M[r][c] / piv; if (!f) continue; for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
    var x = new Array(n); for (var i = n - 1; i >= 0; i--) { var s = M[i][n]; for (var j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / (Math.abs(M[i][i]) < 1e-12 ? 1e-12 : M[i][i]); } return x; }
  D.variogram = function (pts) {
    var n = pts.length, maxd = 0, pairs = [], i, j;
    var step = n > 400 ? Math.ceil(n * n / 160000) : 1, c = 0;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) { if (step > 1 && (c++ % step)) continue; var h = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y); if (h > maxd) maxd = h; pairs.push([h, 0.5 * Math.pow(pts[i].z - pts[j].z, 2)]); }
    var lagMax = maxd / 2, nb = 12, bins = []; for (i = 0; i < nb; i++) bins.push({ h: 0, g: 0, n: 0 });
    pairs.forEach(function (p) { if (p[0] > lagMax) return; var k = Math.min(nb - 1, Math.floor(p[0] / lagMax * nb)); bins[k].h += p[0]; bins[k].g += p[1]; bins[k].n++; });
    var exp = bins.filter(function (b) { return b.n > 0; }).map(function (b) { return { h: b.h / b.n, g: b.g / b.n, n: b.n }; });
    var sph = function (h, a) { return h >= a ? 1 : 1.5 * h / a - 0.5 * Math.pow(h / a, 3); }, best = null;
    for (var q = 1; q <= 20; q++) { var a = lagMax * q / 10, S11 = 0, S12 = 0, S22 = 0, B1 = 0, B2 = 0;
      exp.forEach(function (e) { var f = sph(e.h, a), wgt = e.n; S11 += wgt; S12 += wgt * f; S22 += wgt * f * f; B1 += wgt * e.g; B2 += wgt * e.g * f; });
      var det = S11 * S22 - S12 * S12; if (!det) continue; var c0 = (B1 * S22 - B2 * S12) / det, cc = (S11 * B2 - S12 * B1) / det; if (c0 < 0) { c0 = 0; cc = B2 / S22; } if (cc < 0) cc = 0;
      var sse = 0; exp.forEach(function (e) { sse += e.n * Math.pow(e.g - (c0 + cc * sph(e.h, a)), 2); }); if (!best || sse < best.sse) best = { nugget: c0, sill: cc, range: a, sse: sse }; }
    best = best || { nugget: 0, sill: 1, range: maxd / 3 };
    best.exp = exp; best.model = function (h) { return h === 0 ? 0 : best.nugget + best.sill * sph(h, best.range); }; return best;
  };
  D.interp = function (pts, b, nx, ny, opts) {
    opts = opts || {}; var method = opts.method || 'idw', pw = opts.power || 2, n = pts.length, i, j, k;
    var G = { nx: nx, ny: ny, b: b, z: new Float32Array(nx * ny), method: method, lats: [], lons: [] };
    for (j = 0; j < ny; j++) G.lats.push(b.n - (b.n - b.s) * j / (ny - 1)); for (i = 0; i < nx; i++) G.lons.push(b.w + (b.e - b.w) * i / (nx - 1));
    G.dx = (b.e - b.w) / (nx - 1) * (opts.mx || 1); G.dy = (b.n - b.s) / (ny - 1) * (opts.my || 1);
    if (method === 'kriging' && n >= 4 && n <= 800) {
      var vg = D.variogram(pts), A = [], rhs = [];
      for (i = 0; i < n; i++) { var row = []; for (j = 0; j < n; j++) row.push(vg.model(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y))); row.push(1); A.push(row); rhs.push(pts[i].z); }
      var last = []; for (j = 0; j < n; j++) last.push(1); last.push(0); A.push(last); rhs.push(0);
      var wts = solve(A, rhs), mu = wts[n];
      for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var x = G.lons[i], y = G.lats[j], s = mu; for (k = 0; k < n; k++) s += wts[k] * vg.model(Math.hypot(x - pts[k].x, y - pts[k].y)); G.z[j * nx + i] = s; }
      G.variogram = vg;
    } else {
      G.method = 'idw';
      for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var xx = G.lons[i], yy = G.lats[j], num = 0, den = 0, hit = null;
        for (k = 0; k < n; k++) { var d2 = Math.pow(pts[k].x - xx, 2) + Math.pow(pts[k].y - yy, 2); if (d2 < 1e-18) { hit = pts[k].z; break; } var wv = 1 / Math.pow(d2, pw / 2); num += wv * pts[k].z; den += wv; }
        G.z[j * nx + i] = hit != null ? hit : num / den; }
    }
    return D.stats(G);
  };
  D.smooth = function (line, it) { for (var q = 0; q < (it || 2); q++) { if (line.length < 3) return line; var o = [line[0]]; for (var k = 0; k < line.length - 1; k++) { var a = line[k], b = line[k + 1]; o.push([.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1]]); } o.push(line[line.length - 1]); line = o; } return line; };
  function nice(range, target) { return D.niceInterval(range, target); }
  /* ---------- printable contour map in SVG. G.b in x/y units; opts.crs 'geo' (degrees) or 'proj' (metres) */
  /* Printable map sheet: neat line with graduated border, graticule in D°M′ (geographic) or metres (projected),
     and a margin panel with north arrow (top), boxed legend, graphic scale with representative fraction,
     coordinate reference and source. Arabic strings are set right-to-left; numbers and units stay left-to-right. */
  var isAr = function (s) { return /[؀-ۿ]/.test(String(s || '')); };
  function angStep(range) { var C = [10, 5, 2, 1, 30 / 60, 20 / 60, 15 / 60, 10 / 60, 5 / 60, 2 / 60, 1 / 60, 30 / 3600, 20 / 3600, 15 / 3600, 10 / 3600, 5 / 3600, 2 / 3600, 1 / 3600];
    for (var i = 0; i < C.length; i++) if (range / C[i] >= 3) return C[i]; return C[C.length - 1]; }
  function dms(v, step, isX) { var h = isX ? (v >= 0 ? 'E' : 'W') : (v >= 0 ? 'N' : 'S'), a = Math.abs(v) + 1e-9, d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), sc = Math.round((mf - m) * 60);
    if (sc === 60) { sc = 0; m++; } if (m === 60) { m = 0; d++; }
    return d + '°' + (step < 1 ? String(m).padStart(2, '0') + '′' : '') + (step < 1 / 60 ? String(sc).padStart(2, '0') + '″' : '') + h; }
  function niceFloor(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; }
  D.svgMap = function (svg, G, cs, opts) {
    opts = opts || {}; var S = SH.svgB(svg), VW = 1120, VH = 800; svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var ink = '#1B232B', mut = '#55616B', geo = opts.crs !== 'proj', latc = (G.b.n + G.b.s) / 2, kx = geo ? Math.cos(SH.rad(latc)) * 111320 : 1, ky = geo ? 110574 : 1;
    var PW = 246, ml = 96, mr = PW + 46, mt = opts.title ? 86 : 44, mb = opts.axisNames && !geo ? 76 : 58;
    var wM = (G.b.e - G.b.w) * kx, hM = (G.b.n - G.b.s) * ky, bw = VW - ml - mr, bh = VH - mt - mb, sc = Math.min(bw / wM, bh / hM), W = wM * sc, H = hM * sc, ox = ml + (bw - W) / 2, oy = mt + (bh - H) / 2;
    var X = function (x) { return ox + (x - G.b.w) * kx * sc; }, Y = function (y) { return oy + (G.b.n - y) * ky * sc; };
    var iso = function (s) { return String(s).replace(/[A-Za-z0-9][A-Za-z0-9 .,:\/°′″±+\-×()]*[A-Za-z0-9°′″)]|[A-Za-z0-9]/g, function (m) { return '⁦' + m + '⁩'; }); };
    var txt = function (x, y, str, a, xr) { a = a || {}; if (isAr(str)) str = iso(str); if (isAr(str) && xr != null) { a.direction = 'rtl'; a['text-anchor'] = a['text-anchor'] === 'middle' ? 'middle' : 'start'; return S.text(a['text-anchor'] === 'middle' ? x : xr, y, str, a); } return S.text(x, y, str, a); };
    S.add('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#FFFFFF' });
    S.add('rect', { x: 8, y: 8, width: VW - 16, height: VH - 16, fill: 'none', stroke: ink, 'stroke-width': 1.2 });
    if (opts.title) { var ar = isAr(opts.title); txt(ml - 6, 40, opts.title, { 'font-size': 20, 'font-weight': 800, fill: ink }, ox + W + 6);
      if (opts.subtitle) txt(ml - 6, 62, opts.subtitle, { 'font-size': 12.5, fill: mut }, ox + W + 6); }
    var defs = S.add('defs', {}), cid = 'mc' + Math.random().toString(36).slice(2, 7), cp = S.add('clipPath', { id: cid }, null, defs); S.add('rect', { x: ox, y: oy, width: W, height: H }, null, cp);
    var body = S.g({ 'clip-path': 'url(#' + cid + ')' }), fillHost = body;
    if (opts.clipPoly) { var hid = cid + 'h', cp2 = S.add('clipPath', { id: hid }, null, defs); S.poly(opts.clipPoly.map(function (q) { return [X(q[0]), Y(q[1])]; }), {}, cp2); fillHost = S.g({ 'clip-path': 'url(#' + hid + ')' }, body); }
    if (opts.fill !== false) { var RG = opts.renderGrid || G; if (opts.renderGrid) { RG.min = G.min; RG.max = G.max; } S.add('image', { href: D.render(RG, { ramp: opts.ramp, tint: true, shade: opts.shade }), x: ox, y: oy, width: W, height: H, preserveAspectRatio: 'none', opacity: opts.fillOpacity || 0.9 }, null, fillHost); }
    if (opts.image) S.add('image', { href: opts.image, x: ox, y: oy, width: W, height: H, preserveAspectRatio: 'none' }, null, fillHost);
    /* contours: index spacing adapts so at least three index lines are labelled */
    var step = opts.interval, base = opts.base || 0, idx = opts.index || 5; if (cs.length / idx < 3) idx = cs.length <= 9 ? 1 : 2;
    var labels = [], dpL = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
    cs.forEach(function (c) { var isIdx = Math.round((c.level - base) / step) % idx === 0;
      c.lines.forEach(function (ln) { if (opts.smooth) ln = D.smooth(ln, 2); var pp = ln.map(function (p) { return [X(p[1]), Y(p[0])]; }); S.path(S.pl(pp), { fill: 'none', stroke: isIdx ? '#4A2E17' : '#7E5636', 'stroke-width': isIdx ? 1.5 : 0.6, 'stroke-linejoin': 'round', opacity: isIdx ? .95 : .8 }, body);
        if (opts.labels !== false && isIdx && pp.length > 8) labels.push({ pp: pp, v: c.level }); }); });
    labels.forEach(function (l) { var pp = l.pp, acc = 0, next = 90, gap = 260;
      for (var k = 1; k < pp.length - 2; k++) { acc += Math.hypot(pp[k][0] - pp[k - 1][0], pp[k][1] - pp[k - 1][1]); if (acc < next) continue; next = acc + gap;
        var q = pp[k]; if (q[0] < ox + 18 || q[0] > ox + W - 18 || q[1] < oy + 12 || q[1] > oy + H - 12) continue;
        var a = pp[Math.max(0, k - 2)], b = pp[Math.min(pp.length - 1, k + 2)], ang = SH.deg(Math.atan2(b[1] - a[1], b[0] - a[0])); if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        S.text(q[0], q[1] + 3.5, SH.fmt(l.v, dpL), { 'font-size': 10, 'font-weight': 700, fill: '#4A2E17', 'text-anchor': 'middle', direction: 'ltr', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', transform: 'rotate(' + ang.toFixed(1) + ' ' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ')' }, body); } });
    (opts.lines || []).forEach(function (L) { var pp = L.pts.map(function (p) { return [X(p[1]), Y(p[0])]; }); S.path(S.pl(pp), { fill: 'none', stroke: L.color || '#1F6FB2', 'stroke-width': L.width || 2.5, 'stroke-linecap': 'round', 'stroke-dasharray': L.dash || null }, body); if (L.arrow && pp.length > 1) { var q = pp[pp.length - 1], r = pp[pp.length - 2], an = Math.atan2(q[1] - r[1], q[0] - r[0]); S.poly([q, [q[0] - 11 * Math.cos(an - .4), q[1] - 11 * Math.sin(an - .4)], [q[0] - 11 * Math.cos(an + .4), q[1] - 11 * Math.sin(an + .4)]], { fill: L.color || '#1F6FB2' }, body); } });
    (opts.spots || []).forEach(function (p) { var px = X(p.x), py = Y(p.y); if (px < ox + 4 || px > ox + W - 30 || py < oy + 12 || py > oy + H - 4) return;
      S.path('M' + (px - 3.5) + ' ' + py + 'H' + (px + 3.5) + 'M' + px + ' ' + (py - 3.5) + 'V' + (py + 3.5), { stroke: opts.spotColor || '#1B232B', 'stroke-width': 1.2 }, body);
      S.text(px + 4, py - 3, SH.fmt(p.v, opts.spotDp == null ? 0 : opts.spotDp, { nogroup: true }), { 'font-weight': p.key ? 800 : 400, 'font-size': opts.spotSize || 8.5, fill: opts.spotColor || '#1B232B', direction: 'ltr', stroke: '#fff', 'stroke-width': 2.2, 'paint-order': 'stroke' }, body); });
    (opts.points || []).forEach(function (p) { S.circle(X(p.x), Y(p.y), 3.2, { fill: p.color || '#111', stroke: '#fff', 'stroke-width': 1.2 }, body); if (p.label) S.text(X(p.x) + 6, Y(p.y) - 5, p.label, { 'font-size': 9.5, fill: ink, direction: 'ltr', stroke: '#fff', 'stroke-width': 2.5, 'paint-order': 'stroke' }, body); });
    /* graticule and graduated border */
    var tx = geo ? angStep(G.b.e - G.b.w) : nice(G.b.e - G.b.w, 5), ty = geo ? angStep(G.b.n - G.b.s) : nice(G.b.n - G.b.s, 5), v, k2, bd = 6;
    var fmtC = function (v, isX, st) { return geo ? dms(v, st, isX) : SH.fmt(v, 0, { nogroup: true }); };
    var xs = [], ys = []; for (v = Math.ceil(G.b.w / tx - 1e-9) * tx; v <= G.b.e + 1e-9; v += tx) xs.push(v); for (v = Math.ceil(G.b.s / ty - 1e-9) * ty; v <= G.b.n + 1e-9; v += ty) ys.push(v);
    var segX = [G.b.w].concat(xs.filter(function (q) { return q > G.b.w + 1e-9 && q < G.b.e - 1e-9; })).concat([G.b.e]), segY = [G.b.s].concat(ys.filter(function (q) { return q > G.b.s + 1e-9 && q < G.b.n - 1e-9; })).concat([G.b.n]);
    for (k2 = 0; k2 < segX.length - 1; k2++) { var f = k2 % 2 ? '#fff' : ink, x1 = X(segX[k2]), x2 = X(segX[k2 + 1]); S.add('rect', { x: x1, y: oy - bd, width: x2 - x1, height: bd, fill: f }); S.add('rect', { x: x1, y: oy + H, width: x2 - x1, height: bd, fill: f }); }
    for (k2 = 0; k2 < segY.length - 1; k2++) { f = k2 % 2 ? '#fff' : ink; var y1 = Y(segY[k2 + 1]), y2 = Y(segY[k2]); S.add('rect', { x: ox - bd, y: y1, width: bd, height: y2 - y1, fill: f }); S.add('rect', { x: ox + W, y: y1, width: bd, height: y2 - y1, fill: f }); }
    S.add('rect', { x: ox - bd, y: oy - bd, width: W + 2 * bd, height: H + 2 * bd, fill: 'none', stroke: ink, 'stroke-width': 0.9 });
    S.add('rect', { x: ox, y: oy, width: W, height: H, fill: 'none', stroke: ink, 'stroke-width': 1.3 });
    xs.forEach(function (v) { var px = X(v); if (opts.grid !== false) S.line(px, oy, px, oy + H, { stroke: ink, 'stroke-width': .45, opacity: .4, 'stroke-dasharray': '3 4' }); S.line(px, oy + H + bd, px, oy + H + bd + 5, { stroke: ink }); S.line(px, oy - bd, px, oy - bd - 5, { stroke: ink }); S.text(px, oy + H + bd + 19, fmtC(v, true, tx), { 'font-size': 10.5, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); });
    ys.forEach(function (v) { var py = Y(v); if (opts.grid !== false) S.line(ox, py, ox + W, py, { stroke: ink, 'stroke-width': .45, opacity: .4, 'stroke-dasharray': '3 4' }); S.line(ox - bd - 5, py, ox - bd, py, { stroke: ink }); S.line(ox + W + bd, py, ox + W + bd + 5, py, { stroke: ink }); S.text(ox - bd - 8, py + 4, fmtC(v, false, ty), { 'font-size': 10.5, fill: mut, 'text-anchor': 'end', direction: 'ltr' }); });
    if (!geo && opts.axisNames) { S.text(ox + W / 2, oy + H + bd + 42, opts.axisNames[0], { 'font-size': 11.5, fill: mut, 'text-anchor': 'middle' }); S.text(ox - 78, oy + H / 2, opts.axisNames[1], { 'font-size': 11.5, fill: mut, 'text-anchor': 'middle', transform: 'rotate(-90 ' + (ox - 78) + ' ' + (oy + H / 2) + ')' }); }
    /* margin panel */
    var PX = VW - 22 - PW, PY = Math.min(oy - bd, mt), PH = Math.max(oy + H + bd, VH - mb) - PY, L0 = PX + 14, R0 = PX + PW - 14, y = PY + 18;
    S.add('rect', { x: PX, y: PY, width: PW, height: PH, fill: '#fff', stroke: ink, 'stroke-width': 1 });
    var sep = function () { y += 8; S.line(PX, y, PX + PW, y, { stroke: ink, 'stroke-width': .7 }); y += 18; };
    var head = function (en, arT) { S.text(L0, y, en, { 'font-size': 11.5, 'font-weight': 800, fill: ink, 'letter-spacing': 1.6 }); if (SH.lang === 'ar' && arT) S.text(R0, y, arT, { 'font-size': 11.5, 'font-weight': 700, fill: mut, direction: 'rtl', 'text-anchor': 'start' }); y += 18; };
    var row = function (sym, label) { sym(L0, y); txt(L0 + 40, y + 4, label, { 'font-size': 10.5, fill: ink }, R0); y += 18; };
    // north arrow
    var cx0 = PX + PW / 2; S.text(cx0, y + 2, 'N', { 'font-size': 16, 'font-weight': 800, fill: ink, 'text-anchor': 'middle' });
    S.path('M' + cx0 + ' ' + (y + 8) + 'L' + (cx0 - 13) + ' ' + (y + 58) + 'L' + cx0 + ' ' + (y + 48) + 'z', { fill: ink, stroke: ink, 'stroke-width': 1 }); S.path('M' + cx0 + ' ' + (y + 8) + 'L' + (cx0 + 13) + ' ' + (y + 58) + 'L' + cx0 + ' ' + (y + 48) + 'z', { fill: '#fff', stroke: ink, 'stroke-width': 1 });
    y += 66; S.text(cx0, y, geo ? SH.t('Grid north = true north', 'شمال الشبكة = الشمال الجغرافي') : SH.t('Grid north (UTM)', 'شمال الشبكة (UTM)'), { 'font-size': 9.5, fill: mut, 'text-anchor': 'middle' }); sep();
    // legend
    head('LEGEND', 'مفتاح الخريطة');
    var lt = opts.legendTitle || SH.t('Elevation (m)', 'الارتفاع (م)'); txt(L0, y, lt, { 'font-size': 10.5, 'font-weight': 700, fill: ink }, R0); y += 10;
    if (opts.fill !== false) { var gid = cid + 'g', lg = S.add('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 0 }, null, defs), bwid = PW - 40;
      D.ramps[opts.ramp || 'hypso'].forEach(function (st) { S.add('stop', { offset: st[0], 'stop-color': 'rgb(' + st[1].join(',') + ')' }, null, lg); });
      S.add('rect', { x: L0 + 6, y: y, width: bwid, height: 12, fill: 'url(#' + gid + ')', stroke: ink, 'stroke-width': .6 });
      var ltk = nice(G.max - G.min, 4), dpk = ltk < 1 ? (ltk < 0.1 ? 2 : 1) : 0; for (v = Math.ceil(G.min / ltk) * ltk; v <= G.max + 1e-9; v += ltk) { var xx = L0 + 6 + (v - G.min) / ((G.max - G.min) || 1) * bwid; S.line(xx, y + 12, xx, y + 16, { stroke: ink }); S.text(xx, y + 27, SH.fmt(v, dpk), { 'font-size': 9.5, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); }
      y += 44; }
    else if (opts.gradient) { var gid2 = cid + 'g2', lg2 = S.add('linearGradient', { id: gid2, x1: 0, y1: 0, x2: 1, y2: 0 }, null, defs), bw2 = PW - 40, gs = opts.gradient.colors;
      gs.forEach(function (c, k) { S.add('stop', { offset: k / (gs.length - 1), 'stop-color': c }, null, lg2); });
      S.add('rect', { x: L0 + 6, y: y, width: bw2, height: 12, fill: 'url(#' + gid2 + ')', stroke: ink, 'stroke-width': .6 });
      [0, .5, 1].forEach(function (f) { var vv = opts.gradient.min + f * (opts.gradient.max - opts.gradient.min), xx2 = L0 + 6 + f * bw2; S.line(xx2, y + 12, xx2, y + 16, { stroke: ink }); S.text(xx2, y + 27, SH.fmt(vv, Math.abs(opts.gradient.max - opts.gradient.min) < 5 ? 2 : 0), { 'font-size': 9.5, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); });
      y += 44; }
    else y += 8;
    if ((opts.spots || []).length) row(function (x, yy) { S.path('M' + (x + 11) + ' ' + yy + 'H' + (x + 19) + 'M' + (x + 15) + ' ' + (yy - 4) + 'V' + (yy + 4), { stroke: ink, 'stroke-width': 1.2 }); S.text(x + 21, yy - 2, '123', { 'font-size': 8, fill: ink, direction: 'ltr' }); }, SH.t('Spot height (m above sea level)', 'نقطة ارتفاع (م فوق سطح البحر)'));
    (opts.swatches || []).forEach(function (sw) { row(function (x, yy) { S.add('rect', { x: x + 2, y: yy - 7, width: 26, height: 14, fill: sw.color, stroke: ink, 'stroke-width': .6 }); }, sw.name); });
    if (!opts.noContours) {
    row(function (x, yy) { S.line(x, yy, x + 30, yy, { stroke: '#4A2E17', 'stroke-width': 1.5 }); }, SH.t('Index contour (labelled)', 'خط كنتور رئيسي (مرقّم)'));
    if (idx > 1) row(function (x, yy) { S.line(x, yy, x + 30, yy, { stroke: '#7E5636', 'stroke-width': .6 }); }, SH.t('Intermediate contour', 'خط كنتور ثانوي'));
    (opts.legend || []).forEach(function (e) { row(function (x, yy) { S.line(x, yy, x + 30, yy, { stroke: e.color, 'stroke-width': 2.5, 'stroke-dasharray': e.dash || null }); }, e.name); });
    if ((opts.points || []).length) row(function (x, yy) { S.circle(x + 15, yy, 3.2, { fill: '#111', stroke: '#fff', 'stroke-width': 1.2 }); }, opts.pointsName || SH.t('Measured point', 'نقطة مقاسة'));
    if (opts.clipPoly) row(function (x, yy) { S.add('rect', { x: x + 4, y: yy - 6, width: 22, height: 12, fill: 'none', stroke: ink, 'stroke-dasharray': '3 2' }); }, SH.t('Interpolated only inside the data hull', 'الاستيفاء داخل غلاف البيانات فقط'));
    var unit = (opts.unit == null ? ' m' : opts.unit).trim();
    txt(L0, y + 4, SH.t('Contour interval', 'الفاصل الكنتوري'), { 'font-size': 10.5, fill: ink }, R0); S.text(SH.lang === 'ar' ? L0 : R0, y + 4, SH.fmt(step, step < 1 ? 2 : 0) + (unit ? ' ' + unit : ''), { 'font-size': 10.5, 'font-weight': 800, fill: ink, direction: 'ltr', 'text-anchor': SH.lang === 'ar' ? 'start' : 'end' }); y += 12;
    if (idx > 1) { y += 8; txt(L0, y + 4, SH.t('Index every', 'خط رئيسي كل'), { 'font-size': 10.5, fill: ink }, R0); S.text(SH.lang === 'ar' ? L0 : R0, y + 4, SH.fmt(step * idx, step * idx < 1 ? 2 : 0) + (unit ? ' ' + unit : ''), { 'font-size': 10.5, 'font-weight': 800, fill: ink, direction: 'ltr', 'text-anchor': SH.lang === 'ar' ? 'start' : 'end' }); y += 12; }
    }
    sep();
    // scale
    head('SCALE', 'مقياس الرسم');
    var sbM = niceFloor((PW - 56) / sc), sbW = sbM * sc, sx0 = L0 + 8, unitK = sbM >= 1000, fu = function (m) { return unitK ? SH.fmt(m / 1000, (m / 1000) % 1 ? 1 : 0) : SH.fmt(m, 0); };
    for (var q = 0; q < 4; q++) S.add('rect', { x: sx0 + q * sbW / 4, y: y, width: sbW / 4, height: 7, fill: q % 2 ? '#fff' : ink, stroke: ink, 'stroke-width': .8 });
    [0, 2, 4].forEach(function (q) { S.text(sx0 + q * sbW / 4, y + 21, fu(sbM * q / 4), { 'font-size': 9.5, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); });
    S.text(sx0 + sbW + 8, y + 8, unitK ? 'km' : 'm', { 'font-size': 10, 'font-weight': 700, fill: ink, direction: 'ltr' }); y += 38;
    var rf = wM * 1000 / (W / VW * 277), rfn = Math.pow(10, Math.floor(Math.log10(rf)) - 1), rfr = Math.round(rf / rfn) * rfn;
    S.text(L0, y, '1 : ' + SH.fmt(rfr, 0), { 'font-size': 11, 'font-weight': 800, fill: ink, direction: 'ltr' }); S.text(R0, y, SH.t('printed on A4 landscape', 'عند الطباعة على A4 أفقي'), { 'font-size': 9, fill: mut, 'text-anchor': 'end' }); y += 4; sep();
    // reference
    head('REFERENCE', 'المرجع');
    var crsL = opts.crsLabel || (geo ? 'WGS 84 · EPSG:4326' : (opts.subtitle && /UTM [0-9]+[NS]/.exec(opts.subtitle) ? 'WGS 84 / ' + /UTM [0-9]+[NS]/.exec(opts.subtitle)[0] : 'Projected, metres'));
    S.text(L0, y, crsL, { 'font-size': 10, fill: ink, direction: 'ltr' }); y += 16;
    var wrap = function (str, n) { var w = String(str).split(' '), out = [''], i; for (i = 0; i < w.length; i++) { if ((out[out.length - 1] + ' ' + w[i]).trim().length > n) out.push(w[i]); else out[out.length - 1] = (out[out.length - 1] + ' ' + w[i]).trim(); } return out; };
    if (opts.source) wrap(opts.source, 40).forEach(function (l) { txt(L0, y, l, { 'font-size': 9.5, fill: mut }, R0); y += 13; });
    var fy = PY + PH - 14; S.text(L0, fy - 14, opts.credit || 'Shandal System', { 'font-size': 10, 'font-weight': 700, fill: ink }); txt(L0, fy, SH.t('Produced ', 'أُنتجت في ') + new Date().toISOString().slice(0, 10), { 'font-size': 9.5, fill: mut }, R0);
    return { X: X, Y: Y, box: [ox, oy, W, H] };
  };
  D.toGeoJSON = function (cs, props) {
    return { type: 'FeatureCollection', features: cs.reduce(function (a, c) { return a.concat(c.lines.filter(function (l) { return l.length > 1; }).map(function (l) { return { type: 'Feature', properties: Object.assign({ elevation: c.level }, props || {}), geometry: { type: 'LineString', coordinates: l.map(function (p) { return [+p[1].toFixed(6), +p[0].toFixed(6)]; }) } }; })); }, []) };
  };
})(window);
