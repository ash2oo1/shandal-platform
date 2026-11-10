/* Shared satellite helpers for the Earth-observation tools: catalogue search and cropped images from the open
   Earth-observation archive (STAC + TiTiler), mosaics of neighbouring scenes, true ground area of pixels, area of
   interest selection (presets, place search, drawing), contrast stretch, and framed map sheets drawn on canvas
   (title, graticule, north arrow, scale bar, legend below, stamp on export). window.PCX */
(function (w) {
  'use strict';
  var d = document, SH = w.SH, t = SH.t, F = SH.fmt, AR = SH.lang === 'ar';
  var P = {}; w.PCX = P;
  P.API = 'https://planetarycomputer.microsoft.com/api/';
  P.INK = '#1B232B'; P.MUT = '#55616B'; P.PF = 'Manrope, Arial, sans-serif'; P.AF = '"Plex Arabic", Manrope, Arial, sans-serif';

  /* ------------------------------------------------------------ network with retries */
  P.ff = function ff(url, opt, n) { n = n || 0; return fetch(url, opt).then(function (r) { if (r.ok) return r; if ((r.status === 429 || r.status >= 500) && n < 3) return new Promise(function (res) { setTimeout(res, 1500 * (n + 1) + Math.random() * 800); }).then(function () { return ff(url, opt, n + 1); }); var er = new Error('HTTP ' + r.status); er.status = r.status; throw er; }, function (e) { if (n < 2) return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return ff(url, opt, n + 1); }); throw e; }); };
  P.poly = function (a) { return { type: 'Polygon', coordinates: [[[a.w, a.s], [a.e, a.s], [a.e, a.n], [a.w, a.n], [a.w, a.s]]] }; };
  /* STAC search; dt = [isoStart, isoEnd] or null; query = STAC query object */
  P.search = function (col, a, dt, query, limit, sortby) {
    var body = { collections: [col], intersects: P.poly(a), limit: limit || 100 }; if (dt) body.datetime = dt[0] + '/' + dt[1]; if (query) body.query = query; if (sortby) body.sortby = sortby;
    return P.ff(P.API + 'stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (j) { return j.features || []; });
  };
  P.img = function (url) { return P.ff(url).then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b); }); };
  P.bboxUrl = function (a, col, id, q, ms) { return P.API + 'data/v1/item/bbox/' + [a.w, a.s, a.e, a.n].map(function (v) { return v.toFixed(5); }).join(',') + '.png?collection=' + col + '&item=' + encodeURIComponent(id) + '&max_size=' + (ms || 720) + q; };
  P.expr = function (ex, lo, hi, extra) { return '&expression=' + encodeURIComponent(ex) + '&asset_as_band=true' + (lo != null ? '&rescale=' + lo + ',' + hi : '') + (extra || ''); };
  P.pix = function (bm, W, H) { var c = d.createElement('canvas'); c.width = W || bm.width; c.height = H || bm.height; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(bm, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height); };

  /* ------------------------------------------------------------ footprints, coverage and mosaics */
  function inPoly(x, y, ring) { var c = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
  function rings(g) { return !g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(function (q) { return q[0]; }) : []; }
  P.inPoly = inPoly;
  P.grid = function (a, N) { var out = []; N = N || 12; for (var i = 0; i <= N; i++) for (var j = 0; j <= N; j++) out.push([a.w + (a.e - a.w) * i / N, a.s + (a.n - a.s) * j / N]); return out; };
  P.hits = function (geom, pts) { var R = rings(geom); return pts.map(function (p) { return R.some(function (r) { return inPoly(p[0], p[1], r); }); }); };
  P.coverFrac = function (geom, a) { var h = P.hits(geom, P.grid(a, 8)); return h.filter(Boolean).length / h.length; };
  /* the best item first, then items closest in time that fill what it misses (at most max) */
  P.pick = function (items, a, max, timeKey) {
    if (!items.length) return []; var pts = P.grid(a, 12), first = items[0], got = P.hits(first.geometry, pts), out = [first], t0 = Date.parse(first.properties[timeKey || 'datetime']);
    var rest = items.slice(1).sort(function (x, y) { return Math.abs(Date.parse(x.properties[timeKey || 'datetime']) - t0) - Math.abs(Date.parse(y.properties[timeKey || 'datetime']) - t0); });
    while (out.length < (max || 4) && got.some(function (v) { return !v; })) {
      var best = null, bn = 0; rest.forEach(function (x) { if (out.indexOf(x) >= 0) return; var h = P.hits(x.geometry, pts), n = 0; h.forEach(function (v, k) { if (v && !got[k]) n++; }); if (n > bn) { bn = n; best = [x, h]; } });
      if (!best) break; out.push(best[0]); best[1].forEach(function (v, k) { if (v) got[k] = true; });
    }
    return out;
  };
  /* fetch the same request for several items and fill the gaps of the first with the others (alpha = valid) */
  P.mosaic = function (a, col, items, q, ms) {
    return Promise.all(items.map(function (it, k) { return P.img(P.bboxUrl(a, col, it.id, q, ms)).catch(function (e) { if (!k) throw e; return null; }); })).then(function (B) {
      var w0 = B[0].width, h0 = B[0].height, out = new ImageData(w0, h0), n = w0 * h0, used = 0;
      B.forEach(function (bm) { if (!bm) return; var p = P.pix(bm, w0, h0).data, add = 0; for (var i = 0; i < n; i++) { var o = 4 * i; if (out.data[o + 3] || p[o + 3] <= 127) continue; out.data[o] = p[o]; out.data[o + 1] = p[o + 1]; out.data[o + 2] = p[o + 2]; out.data[o + 3] = 255; add++; } if (add) used++; });
      out.used = used; return out;
    });
  };
  /* true ground area (km²) of each pixel row of a geographic crop */
  P.rowArea = function (a, w0, h0) { var r = [], dlon = (a.e - a.w) / w0, dlat = (a.n - a.s) / h0; for (var j = 0; j < h0; j++) r.push(dlon * 111.32 * Math.cos(SH.rad(a.n - (j + 0.5) * dlat)) * dlat * 110.574); return r; };
  P.sizeKm = function (a) { return [(a.e - a.w) * 111.32 * Math.cos(SH.rad((a.s + a.n) / 2)), (a.n - a.s) * 110.57]; };
  /* Otsu threshold of a byte histogram, limited to [lo, hi] */
  P.otsu = function (H, lo, hi) { lo = lo || 0; hi = hi == null ? 255 : hi; var tot = 0, sum = 0, i; for (i = lo; i <= hi; i++) { tot += H[i]; sum += i * H[i]; } var wB = 0, sB = 0, best = 0, th = Math.round((lo + hi) / 2); for (i = lo; i <= hi; i++) { wB += H[i]; if (!wB) continue; var wF = tot - wB; if (!wF) break; sB += i * H[i]; var mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = i; } } return th; };
  /* Kittler–Illingworth minimum-error threshold (two Gaussian classes), better than Otsu when the classes differ in size */
  P.ki = function (H, lo, hi) { lo = lo || 0; hi = hi == null ? 255 : hi; var best = Infinity, th = P.otsu(H, lo, hi); for (var T = lo + 2; T < hi - 2; T++) { var p1 = 0, m1 = 0, p2 = 0, m2 = 0, i; for (i = lo; i <= T; i++) { p1 += H[i]; m1 += i * H[i]; } for (i = T + 1; i <= hi; i++) { p2 += H[i]; m2 += i * H[i]; } if (p1 < 20 || p2 < 20) continue; m1 /= p1; m2 /= p2; var v1 = 0, v2 = 0; for (i = lo; i <= T; i++) v1 += H[i] * (i - m1) * (i - m1); for (i = T + 1; i <= hi; i++) v2 += H[i] * (i - m2) * (i - m2); v1 = Math.max(v1 / p1, 0.25); v2 = Math.max(v2 / p2, 0.25); var tot = p1 + p2, P1 = p1 / tot, P2 = p2 / tot, J = P1 * Math.log(v1) + P2 * Math.log(v2) - 2 * (P1 * Math.log(P1) + P2 * Math.log(P2)); if (J < best) { best = J; th = T; } } return th; };
  /* joint contrast stretch of RGB (keeps colour balance) */
  P.stretch = function (img, cut) { var D = img.data, H = new Uint32Array(256), n = 0, i; cut = cut || 0.01; for (i = 0; i < D.length; i += 4) if (D[i + 3] > 127) { H[D[i]]++; H[D[i + 1]]++; H[D[i + 2]]++; n += 3; } if (!n) return img; var lo = 0, hi = 255, a = 0, v; for (v = 0; v < 256; v++) { a += H[v]; if (a >= n * cut) { lo = v; break; } } a = 0; for (v = 255; v >= 0; v--) { a += H[v]; if (a >= n * cut) { hi = v; break; } } if (hi - lo < 12) return img; var k = 255 / (hi - lo); for (i = 0; i < D.length; i += 4) for (var c = 0; c < 3; c++) D[i + c] = Math.max(0, Math.min(255, (D[i + c] - lo) * k)); return img; };
  P.canvasOf = function (img) { var c = d.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0); return c; };

  /* ------------------------------------------------------------ area of interest: presets, place search, drawing */
  /* o: { key, map, presets: [[key, en, ar, [w,s,e,n], extra]], groups: [[en, ar, [keys]]], maxKm, minKm, onChange(aoi) } — expects
     elements #<p>Pre, #<p>Q, #<p>Go, #<p>Res, #<p>Draw, #<p>Hint, #<p>Aoi, #<p>Name inside the page, where p = o.prefix */
  P.aoiPicker = function (o) {
    var $ = function (s) { return d.getElementById(o.prefix + s); }, L = w.L, map = o.map, rect = null, A = { cur: null };
    function setAoi(b, en, ar, key, extra) {
      var W0 = Math.min(b[0], b[2]), E0 = Math.max(b[0], b[2]), S0 = Math.min(b[1], b[3]), N0 = Math.max(b[1], b[3]), sz = P.sizeKm({ w: W0, e: E0, s: S0, n: N0 });
      if (sz[0] > (o.maxKm || 150) || sz[1] > (o.maxKm || 150)) { SH.toast(t('The area is too large: at most about ', 'المنطقة كبيرة جداً: الحد نحو ') + (o.maxKm || 150) + ' × ' + (o.maxKm || 150) + t(' km.', ' كم.'), 'warn'); return; }
      if (sz[0] < (o.minKm || 1) || sz[1] < (o.minKm || 1)) { SH.toast(t('The area is too small.', 'المنطقة صغيرة جداً.'), 'warn'); return; }
      var prev = A.cur; A.cur = { w: W0, e: E0, s: S0, n: N0, en: en || 'Selected area', ar: ar || 'المنطقة المختارة', key: key || '', km2: sz[0] * sz[1], extra: extra || null };
      if ($('Name') && prev && (Math.abs(prev.w - W0) > 1e-6 || Math.abs(prev.n - N0) > 1e-6)) $('Name').value = '';
      if ($('Name')) $('Name').placeholder = AR ? A.cur.ar : A.cur.en;
      if ($('Aoi')) $('Aoi').innerHTML = '<span class="ltr">' + F(sz[0], sz[0] < 10 ? 1 : 0) + ' × ' + F(sz[1], sz[1] < 10 ? 1 : 0) + ' km</span>';
      Array.prototype.forEach.call(($('Pre') || d.createElement('div')).querySelectorAll('[data-k]'), function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-k') === key ? 'true' : 'false'); });
      if (map) { if (rect) map.removeLayer(rect); rect = L.rectangle([[S0, W0], [N0, E0]], { color: '#E2C27A', weight: 2, fill: false }).addTo(map); map.fitBounds(rect.getBounds(), { padding: [20, 20], maxZoom: 13 }); }
      try { localStorage.setItem('shandal_aoi_' + o.key, JSON.stringify(A.cur)); } catch (er) {}
      if (o.onChange) o.onChange(A.cur);
    }
    A.set = setAoi;
    A.name = function (lang) { var v = $('Name') && $('Name').value.trim(); return v || (lang === 'ar' ? A.cur.ar : A.cur.en); };
    if ($('Pre') && o.presets) {
      var chip = function (p) { return '<button type="button" data-k="' + p[0] + '" aria-pressed="false">' + (AR ? p[2] : p[1]) + '</button>'; };
      $('Pre').innerHTML = (o.groups || [['', '', o.presets.map(function (p) { return p[0]; })]]).map(function (g) { return (g[0] ? '<b class="xsmall muted" style="width:100%">' + (AR ? g[1] : g[0]) + '</b>' : '') + g[2].map(function (k) { return chip(o.presets.filter(function (p) { return p[0] === k; })[0]); }).join(''); }).join('');
      $('Pre').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var p = o.presets.filter(function (q) { return q[0] === b.getAttribute('data-k'); })[0]; setAoi(p[3], p[1], p[2], p[0], p[4]); });
    }
    function find() {
      var q = ($('Q').value || '').trim(), box = $('Res'); if (q.length < 2) return; box.innerHTML = '<span class="xsmall muted">' + t('Searching…', 'جارٍ البحث…') + '</span>';
      fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' + encodeURIComponent(q) + '&accept-language=' + (AR ? 'ar,en' : 'en')).then(function (r) { return r.json(); }).then(function (R0) {
        if (!R0.length) { box.innerHTML = '<span class="xsmall muted">' + t('Nothing found. Try another spelling or draw the area.', 'لم يُعثر على شيء. جرّب كتابة أخرى أو ارسم المنطقة.') + '</span>'; return; }
        box.innerHTML = R0.map(function (r, i) { return '<button type="button" data-i="' + i + '">' + SH.esc(r.display_name.split(',').slice(0, 3).join('،')) + '</button>'; }).join('');
        box.onclick = function (e) { var b = e.target.closest('[data-i]'); if (!b) return; var r = R0[+b.getAttribute('data-i')], bb = r.boundingbox.map(Number), la = +r.lat, lo = +r.lon, kx = 111.32 * Math.cos(SH.rad(la)), mx = (o.maxKm || 150) * 0.9, half = function (km) { return [lo - km / kx, la - km / 110.57, lo + km / kx, la + km / 110.57]; };
          var wk = (bb[3] - bb[2]) * kx, hk = (bb[1] - bb[0]) * 110.57, b2 = wk > mx || hk > mx ? half(mx / 2.4) : wk < (o.minKm || 1) * 3 && hk < (o.minKm || 1) * 3 ? half(Math.max(3, (o.minKm || 1) * 2)) : [bb[2] - (bb[3] - bb[2]) * 0.08, bb[0] - (bb[1] - bb[0]) * 0.08, bb[3] + (bb[3] - bb[2]) * 0.08, bb[1] + (bb[1] - bb[0]) * 0.08];
          var nm = r.display_name.split(',')[0]; setAoi(b2, r.name && /^[\x00-\x7F]+$/.test(r.name) ? r.name : nm, nm, ''); box.innerHTML = ''; };
      }).catch(function () { box.innerHTML = '<span class="xsmall muted">' + t('Search needs a connection.', 'البحث يحتاج اتصالاً.') + '</span>'; });
    }
    if ($('Go')) { $('Go').addEventListener('click', find); $('Q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } }); }
    if ($('Draw') && map) $('Draw').addEventListener('click', function () { SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setAoi([bb.getWest(), bb.getSouth(), bb.getEast(), bb.getNorth()], 'Area ' + F(bb.getCenter().lat, 2) + '° N, ' + F(bb.getCenter().lng, 2) + '° E', 'المنطقة المرسومة', ''); }, $('Hint')); });
    var s0 = null; try { s0 = JSON.parse(localStorage.getItem('shandal_aoi_' + o.key) || 'null'); } catch (er) {}
    if (s0 && s0.w != null) setAoi([s0.w, s0.s, s0.e, s0.n], s0.en, s0.ar, s0.key, s0.extra); else if (o.presets && o.presets.length) { var p = o.presets[0]; setAoi(p[3], p[1], p[2], p[0], p[4]); }
    return A;
  };

  /* ------------------------------------------------------------ framed map sheet on canvas */
  function isAr(x) { return /[؀-ۿ]/.test(x); }
  P.txt = function (g, s, x, y, size, wt, col, al, halo) { s = String(s); var A = isAr(s); g.direction = A ? 'rtl' : 'ltr'; g.font = (wt || 500) + ' ' + size + 'px ' + (A ? P.AF : P.PF); g.textAlign = al || 'left'; g.textBaseline = 'alphabetic'; if (halo) { g.lineWidth = size / 4; g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineJoin = 'round'; g.strokeText(s, x, y); } g.fillStyle = col || P.INK; g.fillText(s, x, y); };
  P.tw = function (g, s, size, wt) { s = String(s); g.font = (wt || 500) + ' ' + size + 'px ' + (isAr(s) ? P.AF : P.PF); return g.measureText(s).width; };
  function dms(v, lat) { var a = Math.abs(v), dd = Math.floor(a + 1e-9), m = Math.round((a - dd) * 60); if (m === 60) { dd++; m = 0; } return dd + '°' + (m < 10 ? '0' : '') + m + '′' + (lat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); }
  /* o: { a (aoi), title, sub, layers: [canvas|ImageBitmap, ...] drawn in order (with optional {img, alpha}), legend: [[label, colour, kind?]], stats, ramp: {stops:[[v,col]], lo, hi, label, ticks} } */
  P.sheet = function (cv, o) {
    var W = cv.width, H = cv.height, g = cv.getContext('2d'), a = o.a, s = Math.min(W, H) / 900, head = (o.sub ? 92 : 64) * s, foot = (o.ramp ? 190 : 150) * s, pad = 46 * s;
    var ar = ((a.e - a.w) * Math.cos(SH.rad((a.s + a.n) / 2))) / (a.n - a.s), aw = W - 2 * pad - 30 * s, ah = H - head - foot - 30 * s, iw = aw, ih = iw / ar; if (ih > ah) { ih = ah; iw = ih * ar; }
    var X0 = (W - iw) / 2 + 12 * s, Y0 = head + 14 * s;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    P.txt(g, o.title || '', pad, 44 * s, 30 * s, 800); if (o.sub) P.txt(g, o.sub, pad, 74 * s, 16 * s, 500, P.MUT);
    g.fillStyle = '#E9ECEF'; g.fillRect(X0, Y0, iw, ih); g.imageSmoothingEnabled = o.smooth !== false;
    (o.layers || []).forEach(function (L0) { if (!L0) return; var im = L0.img || L0; g.globalAlpha = L0.alpha == null ? 1 : L0.alpha; g.drawImage(im, X0, Y0, iw, ih); g.globalAlpha = 1; });
    g.imageSmoothingEnabled = true;
    g.strokeStyle = P.INK; g.lineWidth = 2 * s; g.strokeRect(X0, Y0, iw, ih); g.lineWidth = s; g.strokeRect(X0 - 6 * s, Y0 - 6 * s, iw + 12 * s, ih + 12 * s);
    var gs = [1 / 60, 2 / 60, 5 / 60, 10 / 60, 0.25, 0.5, 1], st = gs.filter(function (v) { return (a.e - a.w) / v <= 5; })[0] || 1, X = function (lo) { return X0 + (lo - a.w) / (a.e - a.w) * iw; }, Y = function (la) { return Y0 + (a.n - la) / (a.n - a.s) * ih; };
    g.lineWidth = 1.2 * s;
    for (var lo = Math.ceil(a.w / st) * st; lo <= a.e + 1e-9; lo += st) { var xx = X(lo); if (xx < X0 + 30 * s || xx > X0 + iw - 30 * s) continue; g.beginPath(); g.moveTo(xx, Y0 + ih + 6 * s); g.lineTo(xx, Y0 + ih); g.moveTo(xx, Y0 - 6 * s); g.lineTo(xx, Y0); g.stroke(); P.txt(g, dms(lo, 0), xx, Y0 + ih + 24 * s, 13 * s, 500, P.INK, 'center'); }
    for (var la = Math.ceil(a.s / st) * st; la <= a.n + 1e-9; la += st) { var yy = Y(la); if (yy < Y0 + 20 * s || yy > Y0 + ih - 20 * s) continue; g.beginPath(); g.moveTo(X0 - 6 * s, yy); g.lineTo(X0, yy); g.moveTo(X0 + iw, yy); g.lineTo(X0 + iw + 6 * s, yy); g.stroke(); g.save(); g.translate(X0 - 14 * s, yy); g.rotate(-Math.PI / 2); P.txt(g, dms(la, 1), 0, 0, 13 * s, 500, P.INK, 'center'); g.restore(); }
    if (o.badge) { g.font = '800 ' + 40 * s + 'px ' + P.PF; g.direction = 'ltr'; g.textAlign = 'left'; g.lineWidth = 6 * s; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(o.badge, X0 + 16 * s, Y0 + 50 * s); g.fillStyle = '#fff'; g.fillText(o.badge, X0 + 16 * s, Y0 + 50 * s); }
    var nx = X0 + iw - 34 * s, ny = Y0 + 18 * s; g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(nx - 20 * s, ny - 4 * s, 40 * s, 64 * s); g.beginPath(); g.moveTo(nx, ny + 20 * s); g.lineTo(nx - 11 * s, ny + 54 * s); g.lineTo(nx, ny + 46 * s); g.closePath(); g.fillStyle = P.INK; g.fill(); g.beginPath(); g.moveTo(nx, ny + 20 * s); g.lineTo(nx + 11 * s, ny + 54 * s); g.lineTo(nx, ny + 46 * s); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = P.INK; g.lineWidth = 1.2 * s; g.stroke(); P.txt(g, 'N', nx, ny + 16 * s, 15 * s, 800, P.INK, 'center');
    var kmPx = (a.e - a.w) * 111.32 * Math.cos(SH.rad((a.s + a.n) / 2)) / iw, want = kmPx * iw * 0.25, p10 = Math.pow(10, Math.floor(Math.log10(want))), m = want / p10, len = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p10, sp = len / kmPx, sx = X0, sy = Y0 + ih + 46 * s;
    for (var i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff' : P.INK; g.fillRect(sx + i * sp / 4, sy, sp / 4, 8 * s); } g.strokeStyle = P.INK; g.lineWidth = s; g.strokeRect(sx, sy, sp, 8 * s);
    [0, 0.5, 1].forEach(function (k) { P.txt(g, F(len * k, len * k % 1 ? (len * k < 0.1 ? 2 : 1) : 0), sx + sp * k, sy - 5 * s, 12 * s, 600, P.INK, 'center'); }); P.txt(g, 'km', sx + sp + 10 * s, sy + 9 * s, 13 * s, 700);
    var lx = X0 + iw, ly = sy + 6 * s;
    (o.legend || []).slice().reverse().forEach(function (q) { var tq = P.tw(g, q[0], 13 * s, 500); if (lx - tq - 26 * s < sx + sp + 60 * s) { lx = X0 + iw; ly += 22 * s; } P.txt(g, q[0], lx, ly + 3 * s, 13 * s, 500, P.INK, 'right'); g.fillStyle = q[1]; g.fillRect(lx - tq - 26 * s, ly - 9 * s, 18 * s, 13 * s); g.strokeStyle = P.INK; g.lineWidth = .8 * s; g.strokeRect(lx - tq - 26 * s, ly - 9 * s, 18 * s, 13 * s); lx -= tq + 46 * s; });
    var yb = ly + 34 * s;
    if (o.ramp) { var R = o.ramp, rw = Math.min(iw, 520 * s), rx = X0 + (iw - rw) / 2, ry = yb, gr = g.createLinearGradient(rx, 0, rx + rw, 0); R.stops.forEach(function (q) { gr.addColorStop((q[0] - R.lo) / (R.hi - R.lo), q[1]); }); g.fillStyle = gr; g.fillRect(rx, ry, rw, 14 * s); g.strokeStyle = P.INK; g.lineWidth = .8 * s; g.strokeRect(rx, ry, rw, 14 * s);
      (R.ticks || [R.lo, R.hi]).forEach(function (v) { var x = rx + (v - R.lo) / (R.hi - R.lo) * rw; g.beginPath(); g.moveTo(x, ry + 14 * s); g.lineTo(x, ry + 19 * s); g.stroke(); P.txt(g, (R.fmt ? R.fmt(v) : F(v, Math.abs(v) < 10 && v % 1 ? 1 : 0)), x, ry + 33 * s, 12 * s, 600, P.INK, 'center'); }); P.txt(g, R.label || '', rx + rw / 2, ry - 7 * s, 12.5 * s, 700, P.INK, 'center'); yb = ry + 52 * s; }
    if (o.stats) P.txt(g, o.stats, X0, yb, 15 * s, 700, P.INK);
    return { x: X0, y: Y0, w: iw, h: ih, s: s };
  };
})(window);
