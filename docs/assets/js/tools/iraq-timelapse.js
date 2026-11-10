/* Earth Through Time — any place on Earth, every year since 1972. Landsat Collection 2 Level-2 surface reflectance
   (Landsat 4/5 TM, 7 ETM+, 8/9 OLI, 1982 onward) and, before that or where none exists up to 2012, Level-1 Landsat 1–5 MSS (60 m):
   the clearest scene of the same season in every chosen year, cropped to the area; water by MNDWI (Xu 2006) and green vegetation
   by NDVI measured on every pixel with true ground area; framed map frames (graticule, north arrow, scale, legend), a time
   series, a change map between two years, and a time-lapse video in 16:9, 9:16 or 1:1. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, E = SH.esc, L = window.L, G = window.EG, AR = SH.lang === 'ar';
  var PC = 'https://planetarycomputer.microsoft.com/api/', COL = 'landsat-c2-l2', MS = 720, K = 14545.4545;
  var PF = 'Manrope, Arial, sans-serif', INK = '#1B232B', MUT = '#55616B';
  var IDS = ['tlY0', 'tlY1', 'tlStep', 'tlSea', 'tlCl', 'tlTw', 'tlTv', 'tlTwM', 'tlTvM', 'tlOw', 'tlOv', 'tlFmt', 'tlSp', 'tlMode'], persist = SH.persist('timelapse', IDS);
  var PRE = [
    ['central', 'Central Marshes', 'الأهوار الوسطى', [46.45, 30.85, 47.05, 31.25]], ['hammar', 'Hammar Marsh', 'هور الحمّار', [46.6, 30.6, 47.4, 30.98]], ['hawizeh', 'Hawizeh Marsh', 'هور الحويزة', [47.45, 31.2, 47.85, 31.75]],
    ['sawa', 'Lake Sawa', 'بحيرة ساوة', [44.96, 31.28, 45.06, 31.35]], ['razzaza', 'Razzaza Lake', 'بحيرة الرزازة', [43.55, 32.45, 44.05, 32.9]], ['mosul', 'Mosul Dam Lake', 'بحيرة سد الموصل', [42.55, 36.6, 43.0, 36.95]],
    ['haditha', 'Haditha (Qadisiyah) Lake', 'بحيرة حديثة (القادسية)', [41.9, 34.1, 42.45, 34.55]], ['dukan', 'Dukan Lake', 'بحيرة دوكان', [44.85, 35.9, 45.2, 36.2]], ['baghdad', 'Baghdad', 'بغداد', [44.2, 33.15, 44.6, 33.5]],
    ['erbil', 'Erbil', 'أربيل', [43.88, 36.08, 44.15, 36.32]], ['basra', 'Basra and the Shatt al-Arab', 'البصرة وشط العرب', [47.7, 30.35, 48.05, 30.65]]];
  var WORLD = [
    ['aral', 'Aral Sea (south)', 'بحر آرال (الجنوبي)', [58.2, 43.6, 59.9, 44.9]], ['urmia', 'Lake Urmia', 'بحيرة أورمية', [44.9, 37.0, 46.0, 38.3]], ['deadsea', 'Dead Sea', 'البحر الميت', [35.3, 31.0, 35.65, 31.85]],
    ['ataturk', 'Atatürk Dam Lake (Euphrates)', 'بحيرة سد أتاتورك (الفرات)', [38.2, 37.3, 39.0, 37.9]], ['dubai', 'Dubai coast and the Palm islands', 'ساحل دبي وجزر النخلة', [54.95, 24.95, 55.4, 25.3]], ['cairo', 'Cairo and the New Capital', 'القاهرة والعاصمة الإدارية', [31.2, 29.9, 31.9, 30.2]],
    ['mead', 'Lake Mead (USA)', 'بحيرة ميد (أمريكا)', [-114.9, 35.95, -114.0, 36.55]], ['columbia', 'Columbia Glacier (Alaska)', 'نهر كولومبيا الجليدي (ألاسكا)', [-147.3, 60.9, -146.7, 61.3]], ['rondonia', 'Rondônia forest (Brazil)', 'غابات روندونيا (البرازيل)', [-63.5, -10.5, -62.5, -9.5]],
    ['shanghai', 'Shanghai', 'شنغهاي', [121.2, 30.9, 121.95, 31.45]], ['poopo', 'Lake Poopó (Bolivia)', 'بحيرة بوبو (بوليفيا)', [-67.3, -19.0, -66.8, -18.5]]];
  var ALLP = PRE.concat(WORLD);
  var MSSONLY = false, ALLF = [], MISS = [], FULL = 0.98, aoi = null, rect = null, frames = [], cur = 0, playing = null, busy = false;
  var map = SH.map('tlMap', { zoom: 6, base: 'satellite', center: [33, 44] });

  /* ------------------------------------------------------------------ area */
  function setAoi(b, en, ar, key) {
    var w = Math.min(b[0], b[2]), e = Math.max(b[0], b[2]), s = Math.min(b[1], b[3]), n = Math.max(b[1], b[3]), kx = 111.32 * Math.cos(SH.rad((s + n) / 2)), wk = (e - w) * kx, hk = (n - s) * 110.57;
    if (wk > 150 || hk > 150) { SH.toast(t('The area must fit in one Landsat scene: at most about 150 × 150 km.', 'يجب أن تتسع المنطقة في مشهد لاندسات واحد: نحو 150 × 150 كم كحد أقصى.'), 'warn'); return; }
    if (wk < 1.5 || hk < 1.5) { SH.toast(t('The area is too small for 30 m pixels.', 'المنطقة أصغر من أن تُقاس ببكسلات 30 م.'), 'warn'); return; }
    aoi = { w: w, s: s, e: e, n: n, en: en || 'Selected area', ar: ar || t('Selected area', 'المنطقة المختارة'), key: key || '', km2: wk * hk };
    $('#tlAoi').innerHTML = '<span class="ltr">' + F(wk, 0) + ' × ' + F(hk, 0) + ' km</span>';
    $$('#tlPre button').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-k') === key ? 'true' : 'false'); });
    if (map) { if (rect) map.removeLayer(rect); rect = L.rectangle([[s, w], [n, e]], { color: '#E2C27A', weight: 2, fill: false }).addTo(map); map.fitBounds(rect.getBounds(), { padding: [20, 20], maxZoom: 11 }); }
    try { localStorage.setItem('shandal_tl_aoi', JSON.stringify(aoi)); } catch (er) {}
  }
  var chips = function (L0) { return L0.map(function (p) { return '<button type="button" data-k="' + p[0] + '" aria-pressed="false">' + (AR ? p[2] : p[1]) + '</button>'; }).join(''); };
  $('#tlPre').innerHTML = '<b class="xsmall muted" style="width:100%">' + t('Iraq', 'العراق') + '</b>' + chips(PRE) + '<b class="xsmall muted" style="width:100%;margin-top:4px">' + t('The world', 'العالم') + '</b>' + chips(WORLD);
  $('#tlPre').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var p = ALLP.filter(function (q) { return q[0] === b.getAttribute('data-k'); })[0]; setAoi(p[3], p[1], p[2], p[0]); });
  $('#tlDraw').addEventListener('click', function () { if (!map) return; SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setAoi([bb.getWest(), bb.getSouth(), bb.getEast(), bb.getNorth()], 'Area ' + F(bb.getCenter().lat, 2) + '° N, ' + F(bb.getCenter().lng, 2) + '° E', t('المنطقة المرسومة', 'المنطقة المرسومة'), ''); }, $('#tlHint')); });
  /* search a place anywhere by name */
  function findPlace() {
    var q = ($('#tlQ').value || '').trim(), box = $('#tlRes'); if (q.length < 2) return; box.innerHTML = '<span class="xsmall muted">' + t('Searching…', 'جارٍ البحث…') + '</span>';
    fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' + encodeURIComponent(q) + '&accept-language=' + (AR ? 'ar,en' : 'en')).then(function (r) { return r.json(); }).then(function (R0) {
      if (!R0.length) { box.innerHTML = '<span class="xsmall muted">' + t('Nothing found. Try another spelling or draw the area.', 'لم يُعثر على شيء. جرّب كتابة أخرى أو ارسم المنطقة.') + '</span>'; return; }
      box.innerHTML = R0.map(function (r, i) { return '<button type="button" data-i="' + i + '">' + E(r.display_name.split(',').slice(0, 3).join('،')) + '</button>'; }).join('');
      box.onclick = function (e) { var b = e.target.closest('[data-i]'); if (!b) return; var r = R0[+b.getAttribute('data-i')], bb = r.boundingbox.map(Number), la = +r.lat, lo = +r.lon, s0 = bb[0], n0 = bb[1], w0 = bb[2], e0 = bb[3], kx = 111.32 * Math.cos(SH.rad(la)), half = function (km) { return [lo - km / kx, la - km / 110.57, lo + km / kx, la + km / 110.57]; };
        var wk = (e0 - w0) * kx, hk = (n0 - s0) * 110.57, b2 = wk > 140 || hk > 140 ? half(50) : wk < 8 && hk < 8 ? half(6) : [w0 - (e0 - w0) * 0.08, s0 - (n0 - s0) * 0.08, e0 + (e0 - w0) * 0.08, n0 + (n0 - s0) * 0.08];
        var nm = r.display_name.split(',')[0]; setAoi(b2, r.name && /^[\x00-\x7F]+$/.test(r.name) ? r.name : nm, nm, ''); box.innerHTML = ''; };
    }).catch(function () { box.innerHTML = '<span class="xsmall muted">' + t('Search needs a connection.', 'البحث يحتاج اتصالاً.') + '</span>'; });
  }
  $('#tlGo').addEventListener('click', findPlace); $('#tlQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); findPlace(); } });
  (function () { var s = null; try { s = JSON.parse(localStorage.getItem('shandal_tl_aoi') || 'null'); } catch (er) {} if (s && s.w != null) setAoi([s.w, s.s, s.e, s.n], s.en, s.ar, s.key); else { var p = PRE[0]; setAoi(p[3], p[1], p[2], p[0]); } })();

  /* ------------------------------------------------------------------ network */
  function ff(url, opt, n) { n = n || 0; return fetch(url, opt).then(function (r) { if (r.ok) return r; if ((r.status === 429 || r.status >= 500) && n < 3) return new Promise(function (res) { setTimeout(res, 1500 * (n + 1) + Math.random() * 800); }).then(function () { return ff(url, opt, n + 1); }); var er = new Error('HTTP ' + r.status); er.status = r.status; throw er; }, function (e) { if (n < 2) return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return ff(url, opt, n + 1); }); throw e; }); }
  function range(y, sea) { var d = function (yy, m, dd) { return yy + '-' + String(m).padStart(2, '0') + '-' + String(dd).padStart(2, '0'); }, last = function (yy, m) { return new Date(Date.UTC(yy, m, 0)).getUTCDate(); };
    return sea === 'mam' ? [d(y, 3, 1), d(y, 5, 31)] : sea === 'jja' ? [d(y, 6, 1), d(y, 8, 31)] : sea === 'son' ? [d(y, 9, 1), d(y, 11, 30)] : sea === 'djf' ? [d(y - 1, 12, 1), d(y, 2, last(y, 2))] : [d(y, 1, 1), d(y, 12, 31)]; }
  function inPoly(x, y, ring) { var c = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
  function covers(g) { var rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(function (p) { return p[0]; }) : []; var pts = [[aoi.w, aoi.s], [aoi.e, aoi.s], [aoi.e, aoi.n], [aoi.w, aoi.n], [(aoi.w + aoi.e) / 2, (aoi.s + aoi.n) / 2]]; return pts.filter(function (p) { return rings.some(function (r) { return inPoly(p[0], p[1], r); }); }).length; }
  var SAT = { 'landsat-4': 'Landsat 4 TM', 'landsat-5': 'Landsat 5 TM', 'landsat-7': 'Landsat 7 ETM+', 'landsat-8': 'Landsat 8 OLI', 'landsat-9': 'Landsat 9 OLI-2' }, MSSN = { 'landsat-1': 'Landsat 1 MSS', 'landsat-2': 'Landsat 2 MSS', 'landsat-3': 'Landsat 3 MSS', 'landsat-4': 'Landsat 4 MSS', 'landsat-5': 'Landsat 5 MSS' }, COL1 = 'landsat-c2-l1';
  function search(y, sea, cl, mss) {
    var r = range(y, sea), poly = { type: 'Polygon', coordinates: [[[aoi.w, aoi.s], [aoi.e, aoi.s], [aoi.e, aoi.n], [aoi.w, aoi.n], [aoi.w, aoi.s]]] }, NM = mss ? MSSN : SAT;
    return ff(PC + 'stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: [mss ? COL1 : COL], intersects: poly, datetime: r[0] + 'T00:00:00Z/' + r[1] + 'T23:59:59Z', query: { 'eo:cloud_cover': { lt: cl } }, limit: 100 }) }).then(function (x) { return x.json(); }).then(function (j) {
      var it = (j.features || []).filter(function (f) { return NM[f.properties.platform] && (!mss || !f.properties.instruments || f.properties.instruments.indexOf('mss') >= 0); }).map(function (f) { var p = f.properties, slc = p.platform === 'landsat-7' && p.datetime >= '2003-05-31', cv = covers(f.geometry); return { id: f.id, geom: f.geometry, date: p.datetime.slice(0, 10), plat: p.platform, sat: NM[p.platform], mss: !!mss, col: mss ? COL1 : COL, cloud: p['eo:cloud_cover'], slc: slc, cv: cv, score: (p['eo:cloud_cover'] || 0) + (slc ? 60 : 0) + (5 - cv) * 40 }; });
      it.sort(function (a, b) { return a.score - b.score; }); return it.length ? it : null; });
  }
  function img(url) { return ff(url).then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b); }); }
  function bboxUrl(id, q, col) { return PC + 'data/v1/item/bbox/' + [aoi.w, aoi.s, aoi.e, aoi.n].map(function (v) { return v.toFixed(5); }).join(',') + '.png?collection=' + (col || COL) + '&item=' + encodeURIComponent(id) + '&max_size=' + MS + q; }
  var Q_RGB = '&assets=red&assets=green&assets=blue&nodata=0&rescale=7300,19500&color_formula=' + encodeURIComponent('Gamma RGB 1.25 Saturation 1.2');
  var Q_IX = function (ex) { return '&expression=' + encodeURIComponent(ex) + '&asset_as_band=true&nodata=0&rescale=-1,1'; };
  var EX_W = '(green-swir16)/(green+swir16-' + K.toFixed(2) + ')', EX_V = '(nir08-red)/(nir08+red-' + K.toFixed(2) + ')';
  /* MSS (Level-1 digital numbers, no blue or short-wave infrared band): water by NDWI (McFeeters 1996), vegetation by NDVI, colour approximated */
  var M_RGB = '&expression=' + encodeURIComponent('red;0.7*green+0.3*nir08;green') + '&asset_as_band=true&nodata=0&rescale=0,255', M_W = '(green-nir08)/(green+nir08)', M_V = '(nir08-red)/(nir08+red)';
  function stretch(c) { var g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), D = d.data; for (var ch = 0; ch < 3; ch++) { var H = new Uint32Array(256), n = 0; for (var i = 0; i < D.length; i += 4) if (D[i + 3] > 127) { H[D[i + ch]]++; n++; } if (!n) return; var lo = 0, hi = 255, a = 0; for (var v = 0; v < 256; v++) { a += H[v]; if (a >= n * 0.02) { lo = v; break; } } a = 0; for (v = 255; v >= 0; v--) { a += H[v]; if (a >= n * 0.02) { hi = v; break; } } var k = 255 / Math.max(1, hi - lo); for (i = 0; i < D.length; i += 4) D[i + ch] = Math.max(0, Math.min(255, Math.pow((D[i + ch] - lo) * k / 255, 0.85) * 255)); } g.putImageData(d, 0, 0); }
  function pix(bm, w, h) { var c = document.createElement('canvas'); c.width = w || bm.width; c.height = h || bm.height; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(bm, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height); }
  /* choose the scenes of the season that together cover the area: the best scene first, then the scenes closest in date
     that fill what it misses (neighbouring paths and rows), at most four */
  function pick(its) {
    var N = 12, P = [], i, j; for (i = 0; i <= N; i++) for (j = 0; j <= N; j++) P.push([aoi.w + (aoi.e - aoi.w) * i / N, aoi.s + (aoi.n - aoi.s) * j / N]);
    var rings = function (g) { return g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(function (q) { return q[0]; }) : []; };
    var hit = function (it) { var R0 = rings(it.geom); return P.map(function (p) { return R0.some(function (r) { return inPoly(p[0], p[1], r); }); }); };
    var first = its[0], got = hit(first), out = [first], t0 = Date.parse(first.date);
    var rest = its.slice(1).filter(function (x) { return !x.slc || first.slc; }).sort(function (a, b) { return Math.abs(Date.parse(a.date) - t0) / 864e5 + a.cloud - (Math.abs(Date.parse(b.date) - t0) / 864e5 + b.cloud); });
    while (out.length < 4 && got.some(function (v) { return !v; })) {
      var best = null, bn = 0; rest.forEach(function (x) { if (out.indexOf(x) >= 0) return; var h = hit(x), n = 0; h.forEach(function (v, k) { if (v && !got[k]) n++; }); if (n > bn) { bn = n; best = [x, h]; } });
      if (!best) break; out.push(best[0]); best[1].forEach(function (v, k) { if (v) got[k] = true; });
    }
    return out;
  }
  function frame(y, sea, cl) {
    var useMss = y < 1982 || MSSONLY;
    return search(y, sea, cl, useMss).then(function (it) { return it || (!useMss && y <= 2012 ? search(y, sea, cl, true) : null); }).then(function (its) {
      if (!its) return { y: y, none: true };
      var use = pick(its), mss = use[0].mss, q = mss ? [M_RGB, Q_IX(M_W), Q_IX(M_V)] : [Q_RGB, Q_IX(EX_W), Q_IX(EX_V)];
      return Promise.all(use.map(function (it, k) { return Promise.all(q.map(function (x) { return img(bboxUrl(it.id, x, it.col)); })).catch(function (e) { if (!k) throw e; return null; }); })).then(function (RR) {
        var r0 = RR[0], w = r0[1].width, h = r0[1].height, n = w * h, W = new Uint8Array(n), V = new Uint8Array(n), M = new Uint8Array(n);
        var rgb = document.createElement('canvas'); rgb.width = w; rgb.height = h; var g = rgb.getContext('2d'), out = g.createImageData(w, h), used = [];
        RR.forEach(function (r, k) {
          if (!r) return; var a = pix(r[1], w, h), b = pix(r[2], w, h), c = pix(r[0], w, h), add = 0;
          for (var i = 0; i < n; i++) { if (M[i] || a.data[4 * i + 3] <= 127) continue; M[i] = 1; W[i] = a.data[4 * i]; V[i] = b.data[4 * i]; var o = 4 * i; out.data[o] = c.data[o]; out.data[o + 1] = c.data[o + 1]; out.data[o + 2] = c.data[o + 2]; out.data[o + 3] = 255; add++; }
          if (add > n * 0.002 || !k) used.push(use[k]);
        });
        g.putImageData(out, 0, 0); if (mss) stretch(rgb);
        var it = used[0]; if (used.length > 1) { it = Object.assign({}, it, { n: used.length, ids: used.map(function (x) { return x.id; }), dates: used.map(function (x) { return x.date; }), cloud: Math.max.apply(null, used.map(function (x) { return x.cloud || 0; })) }); }
        return { y: y, it: it, rgb: rgb, W: W, V: V, M: M, w: w, h: h };
      });
    }).catch(function (e) { return { y: y, err: e.message || String(e) }; });
  }
  /* true ground area of each pixel row of the geographic (equal-angle) crop */
  function measure(f, tw, tv) {
    if (!f.W) return; if (f.it.mss) { tw = MSSW(); tv = MSSV(); } var rowA = [], dlon = (aoi.e - aoi.w) / f.w, dlat = (aoi.n - aoi.s) / f.h, cw = Math.round((tw + 1) / 2 * 255), cvv = Math.round((tv + 1) / 2 * 255), wa = 0, va = 0, valid = 0, tot = 0;
    for (var r = 0; r < f.h; r++) rowA.push(dlon * 111.32 * Math.cos(SH.rad(aoi.n - (r + 0.5) * dlat)) * dlat * 110.574);
    for (var i = 0; i < f.W.length; i++) { var A = rowA[Math.floor(i / f.w)]; tot += A; if (!f.M[i]) continue; valid += A; if (f.W[i] > cw) wa += A; else if (f.V[i] > cvv) va += A; }
    f.water = wa; f.veg = va; f.cov = tot ? valid / tot : 0; f.cw = cw; f.cv = cvv;
  }

  /* ------------------------------------------------------------------ run */
  function run() {
    if (busy) return; if (!aoi) { SH.toast(t('Choose a place first.', 'اختر مكاناً أولاً.'), 'warn'); return; }
    var y0 = Math.max(1972, Math.round(G.v('tlY0') || 1985)), y1 = Math.min(new Date().getUTCFullYear(), Math.round(G.v('tlY1') || 2025)), st = +$('#tlStep').value || 2, sea = $('#tlSea').value, cl = G.v('tlCl') || 20;
    if (y1 < y0) { var tmp = y0; y0 = y1; y1 = tmp; } var ys = []; for (var y = y0; y <= y1; y += st) ys.push(y); if (ys[ys.length - 1] !== y1) ys.push(y1);
    persist.save(); busy = true; stop(); var btn = $('#tlRun'); btn.disabled = true; frames = []; var done = 0, out = [], q = ys.slice();
    var msg = function () { $('#tlBar').style.width = (100 * done / ys.length) + '%'; $('#tlMsg').textContent = t('Satellite scenes: ', 'المشاهد الفضائية: ') + done + ' / ' + ys.length; };
    msg();
    var worker = function () { if (!q.length) return Promise.resolve(); var yy = q.shift(); return frame(yy, sea, cl).then(function (f) { out.push(f); done++; msg(); return worker(); }); };
    Promise.all([worker(), worker(), worker()]).then(function () {
      out.sort(function (a, b) { return a.y - b.y; }); ALLF = out.filter(function (f) { return f.W; }); MISS = out.filter(function (f) { return !f.W; });
      if (!ALLF.length) { SH.toast(t('No clear scene was found. Widen the cloud limit or choose the whole year.', 'لم يُعثر على مشهد صافٍ. وسّع حد الغيوم أو اختر السنة كلها.'), 'bad'); return; }
      remeasure(); applyMode();
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { busy = false; btn.disabled = false; });
  }
  /* film of complete years only (default) or of every year found */
  function applyMode() {
    if (!ALLF.length) return; stop(); var full = $('#tlMode').value !== 'all', cut = ALLF.filter(function (f) { return f.cov < FULL; });
    frames = full ? ALLF.filter(function (f) { return f.cov >= FULL; }) : ALLF.slice();
    if (!frames.length) { frames = ALLF.slice(); SH.toast(t('No year covers the whole area: showing every year. Draw a smaller area.', 'لا توجد سنة تغطي المنطقة كلها: تُعرض كل السنوات. ارسم منطقة أصغر.'), 'warn'); }
    $('#tlMsg').textContent = t('Ready: ', 'جاهز: ') + frames.length + t(' years in the film', ' سنة في الفيلم') + (full && cut.length && frames.length < ALLF.length ? t(' · left out (area not fully covered): ', ' · استُبعدت (تغطية ناقصة): ') + cut.map(function (f) { return f.y + ' (' + Math.round(f.cov * 100) + '%)'; }).join(', ') : '') + (MISS.length ? t(' · no clear scene in ', ' · لا مشهد صافٍ في ') + MISS.map(function (f) { return f.y; }).join(', ') : '');
    $('#tlEmpty').hidden = true; $('#tlOut').hidden = false; $('#tlSl').max = frames.length - 1; cur = frames.length - 1; $('#tlSl').value = cur;
    var opts = frames.map(function (f, i) { return '<option value="' + i + '">' + f.y + '</option>'; }).join(''); $('#tlA').innerHTML = opts; $('#tlB').innerHTML = opts; $('#tlA').value = 0; $('#tlB').value = frames.length - 1;
    render();
  }
  $('#tlMode').addEventListener('change', function () { persist.save(); applyMode(); });
  $('#tlRun').addEventListener('click', run);
  function MSSW() { var v = G.v('tlTwM'); return isNaN(v) ? 0.1 : v; } function MSSV() { var v = G.v('tlTvM'); return isNaN(v) ? 0.2 : v; }
  function remeasure() { var tw = G.v('tlTw'), tv = G.v('tlTv'); tw = isNaN(tw) ? 0 : tw; tv = isNaN(tv) ? 0.3 : tv; ALLF.forEach(function (f) { measure(f, tw, tv); }); }
  var good = function () { return frames.filter(function (f) { return f.cov >= 0.9; }); };

  /* ------------------------------------------------------------------ drawing */
  function dms(v, lat) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m + '′' + (lat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); }
  function overlay(f) {
    var key = f.cw + '|' + f.cv + '|' + $('#tlOw').checked + $('#tlOv').checked; if (f._ok === key) return f._ov;
    var c = document.createElement('canvas'); c.width = f.w; c.height = f.h; var g = c.getContext('2d'), d = g.createImageData(f.w, f.h), ow = $('#tlOw').checked, ov = $('#tlOv').checked;
    for (var i = 0; i < f.W.length; i++) { if (!f.M[i]) continue; var o = 4 * i; if (ow && f.W[i] > f.cw) { d.data[o] = 0; d.data[o + 1] = 150; d.data[o + 2] = 255; d.data[o + 3] = 150; } else if (ov && f.V[i] > f.cv) { d.data[o] = 40; d.data[o + 1] = 200; d.data[o + 2] = 70; d.data[o + 3] = 120; } }
    g.putImageData(d, 0, 0); f._ov = c; f._ok = key; return c;
  }
  /* lay out a framed map: header, image with graticule and north arrow, scale and legend below */
  function layout(W, H, vid, ft) {
    var s = vid && H > W * 1.3 ? W / 760 : Math.min(W, H) / 900, head = 92 * s, foot = (ft || (vid ? 210 : 150)) * s, pad = 46 * s, ar = ((aoi.e - aoi.w) * Math.cos(SH.rad((aoi.s + aoi.n) / 2))) / (aoi.n - aoi.s);
    var aw = W - 2 * pad - 30 * s, ah = H - head - foot - 30 * s, iw = aw, ih = iw / ar; if (ih > ah) { ih = ah; iw = ih * ar; }
    var dy = vid ? Math.max(0, (H - (head + 14 * s + ih + foot)) / 2) : 0;
    return { s: s, x: (W - iw) / 2 + 12 * s, y: head + 14 * s, w: iw, h: ih, head: head, foot: foot, pad: pad, dy: dy };
  }
  function txt(g, s, x, y, size, wt, col, al, halo) { g.direction = 'ltr'; g.font = (wt || 500) + ' ' + size + 'px ' + PF; g.textAlign = al || 'left'; g.textBaseline = 'alphabetic'; if (halo) { g.lineWidth = size / 5; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineJoin = 'round'; g.strokeText(s, x, y); } g.fillStyle = col || INK; g.fillText(s, x, y); }
  function drawMap(g, W, H, f, o) {
    o = o || {}; var Lt = layout(W, H, o.vid, o.foot), s = Lt.s;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.save(); g.translate(0, Lt.dy);
    txt(g, o.title || aoi.en, Lt.pad, 44 * s, 30 * s, 800);
    txt(g, o.sub || ((f.it.dates ? f.it.n + ' scenes ' + f.it.dates.slice().sort()[0] + ' to ' + f.it.dates.slice().sort().pop() : f.it.date) + ' · ' + f.it.sat + (f.it.mss ? ' · 60 m, colour approximated (no blue band)' : ' · surface reflectance, true colour') + ($('#tlOw').checked || $('#tlOv').checked ? ' with measured classes' : '')), Lt.pad, 74 * s, 17 * s, 500, MUT);
    if (o.base) g.drawImage(o.base, Lt.x, Lt.y, Lt.w, Lt.h); else { g.fillStyle = '#E9ECEF'; g.fillRect(Lt.x, Lt.y, Lt.w, Lt.h); g.globalAlpha = o.alpha == null ? 1 : o.alpha; g.drawImage(f.rgb, Lt.x, Lt.y, Lt.w, Lt.h); g.drawImage(overlay(f), Lt.x, Lt.y, Lt.w, Lt.h); g.globalAlpha = 1; }
    if (o.prev) { g.globalAlpha = 1 - o.mix; g.drawImage(o.prev.rgb, Lt.x, Lt.y, Lt.w, Lt.h); g.drawImage(overlay(o.prev), Lt.x, Lt.y, Lt.w, Lt.h); g.globalAlpha = 1; }
    /* neat line and graticule ticks */
    g.strokeStyle = INK; g.lineWidth = 2 * s; g.strokeRect(Lt.x, Lt.y, Lt.w, Lt.h); g.lineWidth = s; g.strokeRect(Lt.x - 6 * s, Lt.y - 6 * s, Lt.w + 12 * s, Lt.h + 12 * s);
    var gs = [1 / 60, 2 / 60, 5 / 60, 10 / 60, 0.25, 0.5, 1], st = gs.filter(function (v) { return (aoi.e - aoi.w) / v <= 5; })[0] || 1, X = function (lo) { return Lt.x + (lo - aoi.w) / (aoi.e - aoi.w) * Lt.w; }, Y = function (la) { return Lt.y + (aoi.n - la) / (aoi.n - aoi.s) * Lt.h; };
    g.lineWidth = 1.2 * s;
    for (var lo = Math.ceil(aoi.w / st) * st; lo <= aoi.e + 1e-9; lo += st) { var xx = X(lo); if (xx < Lt.x + 30 * s || xx > Lt.x + Lt.w - 30 * s) continue; g.beginPath(); g.moveTo(xx, Lt.y + Lt.h + 6 * s); g.lineTo(xx, Lt.y + Lt.h); g.moveTo(xx, Lt.y - 6 * s); g.lineTo(xx, Lt.y); g.stroke(); txt(g, dms(lo, 0), xx, Lt.y + Lt.h + 24 * s, 13 * s, 500, INK, 'center'); }
    for (var la = Math.ceil(aoi.s / st) * st; la <= aoi.n + 1e-9; la += st) { var yy = Y(la); if (yy < Lt.y + 20 * s || yy > Lt.y + Lt.h - 20 * s) continue; g.beginPath(); g.moveTo(Lt.x - 6 * s, yy); g.lineTo(Lt.x, yy); g.moveTo(Lt.x + Lt.w, yy); g.lineTo(Lt.x + Lt.w + 6 * s, yy); g.stroke(); g.save(); g.translate(Lt.x - 14 * s, yy); g.rotate(-Math.PI / 2); txt(g, dms(la, 1), 0, 0, 13 * s, 500, INK, 'center'); g.restore(); }
    /* year inside the map, north arrow top right */
    if (o.year) { g.direction = 'ltr'; g.font = '800 ' + 54 * s + 'px ' + PF; g.textAlign = 'left'; g.lineWidth = 7 * s; g.lineJoin = 'round'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(o.year, Lt.x + 18 * s, Lt.y + 62 * s); g.fillStyle = '#fff'; g.fillText(o.year, Lt.x + 18 * s, Lt.y + 62 * s); }
    var nx = Lt.x + Lt.w - 34 * s, ny = Lt.y + 18 * s; g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(nx - 20 * s, ny - 4 * s, 40 * s, 64 * s); g.beginPath(); g.moveTo(nx, ny + 20 * s); g.lineTo(nx - 11 * s, ny + 54 * s); g.lineTo(nx, ny + 46 * s); g.closePath(); g.fillStyle = INK; g.fill(); g.beginPath(); g.moveTo(nx, ny + 20 * s); g.lineTo(nx + 11 * s, ny + 54 * s); g.lineTo(nx, ny + 46 * s); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2 * s; g.stroke(); txt(g, 'N', nx, ny + 16 * s, 15 * s, 800, INK, 'center');
    /* scale bar */
    var kmPx = (aoi.e - aoi.w) * 111.32 * Math.cos(SH.rad((aoi.s + aoi.n) / 2)) / Lt.w, want = kmPx * Lt.w * 0.25, p10 = Math.pow(10, Math.floor(Math.log10(want))), m = want / p10, len = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p10, sp = len / kmPx, sx = Lt.x, sy = Lt.y + Lt.h + 46 * s;
    for (var i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff' : INK; g.fillRect(sx + i * sp / 4, sy, sp / 4, 8 * s); } g.strokeStyle = INK; g.lineWidth = s; g.strokeRect(sx, sy, sp, 8 * s);
    [0, 0.5, 1].forEach(function (k) { txt(g, F(len * k, len * k % 1 ? 1 : 0), sx + sp * k, sy - 5 * s, 12 * s, 600, INK, 'center'); }); txt(g, 'km', sx + sp + 10 * s, sy + 9 * s, 13 * s, 700);
    /* legend below the map */
    var items = o.legend || [].concat($('#tlOw').checked ? [[(f && f.it && f.it.mss ? 'Water (NDWI > ' + F(MSSW(), 2) : 'Water (MNDWI > ' + F(G.v('tlTw') || 0, 2)) + ')', 'rgba(0,150,255,.75)']] : []).concat($('#tlOv').checked ? [['Green vegetation (NDVI > ' + F(f && f.it && f.it.mss ? MSSV() : G.v('tlTv') || 0.3, 2) + ')', 'rgba(40,200,70,.7)']] : []);
    var lx = Lt.x + Lt.w, ly = sy + 6 * s; g.textAlign = 'right'; items.slice().reverse().forEach(function (q) { g.font = '500 ' + 13 * s + 'px ' + PF; var tw = g.measureText(q[0]).width; txt(g, q[0], lx, ly + 3 * s, 13 * s, 500, INK, 'right'); g.fillStyle = q[1]; g.fillRect(lx - tw - 26 * s, ly - 9 * s, 18 * s, 13 * s); g.strokeStyle = INK; g.lineWidth = .8 * s; g.strokeRect(lx - tw - 26 * s, ly - 9 * s, 18 * s, 13 * s); lx -= tw + 46 * s; });
    if (o.stats !== false) txt(g, o.stats || ('Water ' + F(f.water, f.water < 10 ? 1 : 0) + ' km²  ·  Green vegetation ' + F(f.veg, f.veg < 10 ? 1 : 0) + ' km²  ·  Area ' + F(aoi.km2, 0) + ' km²' + (f.cov < 0.9 ? '  ·  scene covers ' + F(f.cov * 100, 0) + ' %' : '')), Lt.x, sy + 40 * s, 15 * s, 700, INK);
    if (o.vid) spark(g, Lt.x, sy + 58 * s, Lt.w, 70 * s, o.idx);
    g.restore();
    if (o.vid) { txt(g, '© Shandal Geological Field Survey System · geologicalfieldsurvey.com' + (SH.geologist() ? ' · ' + SH.geologist() : ''), W / 2, H - 16 * s, 13 * s, 600, MUT, 'center'); }
    return Lt;
  }
  function spark(g, x, y, w, h, idx) {
    var P = good(); if (P.length < 3) return; var y0 = P[0].y, y1 = P[P.length - 1].y, mx = Math.max.apply(null, P.map(function (f) { return Math.max(f.water, $('#tlOv').checked ? f.veg : 0); })) || 1, k = h / mx;
    g.strokeStyle = '#D5D9DD'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
    var line = function (key, col) { g.beginPath(); P.forEach(function (f, i) { var xx = x + (f.y - y0) / Math.max(1, y1 - y0) * w, yy = y + h - f[key] * k; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); }); g.strokeStyle = col; g.lineWidth = 3; g.stroke(); };
    if ($('#tlOv').checked) line('veg', '#2E8B57'); line('water', '#2E6FBF');
    var f = frames[idx]; if (f) { var xx = x + (f.y - y0) / Math.max(1, y1 - y0) * w; g.strokeStyle = '#C0392B'; g.lineWidth = 2; g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); }
    txt(g, String(y0), x + 4, y + h - 6, 12, 600, MUT); txt(g, String(y1), x + w - 4, y + h - 6, 12, 600, MUT, 'right');
  }
  function show(i) {
    cur = Math.max(0, Math.min(frames.length - 1, i)); var f = frames[cur], cv = $('#tlCv'); $('#tlSl').value = cur; $('#tlYr').textContent = f.y;
    drawMap(cv.getContext('2d'), cv.width, cv.height, f, { year: String(f.y) });
  }

  /* ------------------------------------------------------------------ results */
  function render() {
    var P = good(), first = P[0], last = P[P.length - 1];
    if (P.length >= 2) {
      var dW = last.water - first.water, dV = last.veg - first.veg, minW = P.reduce(function (a, f) { return f.water < a.water ? f : a; }), maxW = P.reduce(function (a, f) { return f.water > a.water ? f : a; });
      var pc = function (a, b) { return a > 0 ? (b - a) / a * 100 : null; };
      $('#tlKpis').innerHTML = G.kpi(dW < 0 ? 'bad' : 'ok', t('Water ', 'المياه ') + first.y + ' → ' + last.y, F(first.water, first.water < 10 ? 1 : 0) + ' → ' + F(last.water, last.water < 10 ? 1 : 0) + '<small> km²</small>', (dW >= 0 ? '+' : '') + F(dW, Math.abs(dW) < 10 ? 1 : 0) + ' km²' + (pc(first.water, last.water) != null ? ' (' + (dW >= 0 ? '+' : '') + F(pc(first.water, last.water), 0) + ' %)' : '')) +
        G.kpi(dV < 0 ? 'warn' : 'ok', t('Green vegetation ', 'النبات الأخضر ') + first.y + ' → ' + last.y, F(first.veg, 0) + ' → ' + F(last.veg, 0) + '<small> km²</small>', (dV >= 0 ? '+' : '') + F(dV, 0) + ' km²') +
        G.kpi('info', t('Most water', 'أكثر مياه'), String(maxW.y), F(maxW.water, maxW.water < 10 ? 1 : 0) + ' km²') + G.kpi('info', t('Least water', 'أقل مياه'), String(minW.y), F(minW.water, minW.water < 10 ? 1 : 0) + ' km²');
      var v = [G.verdict(dW < -0.2 * (first.water || 1) ? 'bad' : dW > 0.2 * (first.water || 1) ? 'ok' : 'info', t('How the water changed', 'كيف تغيرت المياه'), t('Measured open water went from ', 'تغيرت المياه المكشوفة المقيسة من ') + F(first.water, 1) + t(' km² in ', ' كم² سنة ') + first.y + t(' to ', ' إلى ') + F(last.water, 1) + t(' km² in ', ' كم² سنة ') + last.y + t('; the highest was in ', '؛ وكانت أعلاها سنة ') + maxW.y + t(' and the lowest in ', ' وأدناها سنة ') + minW.y + t('. One scene per year is a snapshot of that season: a wet or dry month shifts it, so read the trend over several years.', '. المشهد الواحد في السنة لقطة لذلك الموسم، والشهر الرطب أو الجاف يحركها، فاقرأ الاتجاه عبر عدة سنوات.'))];
      if (/central|hammar|hawizeh/.test(aoi.key)) v.push(G.verdict('info', t('Marshes: water under reeds', 'الأهوار: المياه تحت القصب'), t('Water covered by dense reeds is counted as green vegetation, not as water. Read both curves together: when the marshes were drained in the 1990s both fell; after 2003 both returned; in dry years water falls first.', 'تُحسب المياه المغطاة بالقصب الكثيف نباتاً أخضر لا ماءً. فاقرأ المنحنيين معاً: حين جُففت الأهوار في التسعينيات انخفض كلاهما، وبعد 2003 عاد كلاهما، وفي السنوات الجافة تنخفض المياه أولاً.')));
      if (frames.some(function (f) { return f.it.slc; })) v.push(G.verdict('warn', t('Striped scenes', 'مشاهد مخططة'), t('Years marked Landsat 7 after May 2003 have diagonal gaps from a sensor fault; their areas are lower than real.', 'السنوات المعلَّمة بلاندسات 7 بعد أيار 2003 فيها فجوات قطرية بسبب عطل في المتحسس، ومساحاتها أقل من الحقيقة.')));
      $('#tlVerd').innerHTML = v.join('');
    } else { $('#tlKpis').innerHTML = ''; $('#tlVerd').innerHTML = G.verdict('warn', t('Too few complete scenes', 'مشاهد كاملة قليلة'), t('Fewer than two scenes cover the whole area. Draw a smaller area or widen the cloud limit.', 'أقل من مشهدين يغطيان المنطقة كلها. ارسم منطقة أصغر أو وسّع حد الغيوم.')); }
    show(cur); chart(); change(); table();
    $('#tlCap').textContent = t('Each frame is the clearest Landsat scene of the chosen season in that year, in natural colour, with open water (blue) and green vegetation (green) measured pixel by pixel. Press play or drag the slider; download a single frame or the whole film for a report or a reel.', 'كل إطار هو أصفى مشهد لاندسات في الموسم المختار من تلك السنة، بالألوان الطبيعية، مع المياه المكشوفة (الأزرق) والنبات الأخضر (الأخضر) مقيسة بكسلاً بكسلاً. اضغط التشغيل أو اسحب المؤشر، ونزّل إطاراً واحداً أو الفيلم كله لتقرير أو ريلز.');
  }
  function chart() {
    var P = good(); if (!P.length) { $('#tlChart').innerHTML = ''; return; } var x0 = P[0].y, x1 = Math.max(P[P.length - 1].y, x0 + 1);
    var mk = function (key, col, title) { var r = G.span(P.map(function (f) { return f[key]; }).concat([0]), { zero: true }); return G.panel({ W: 760, H: 230, m: { l: 72, r: 20, t: 26, b: 34 }, x: { lo: x0, hi: x1, plain: true, st: EG.step(x0, x1, 8) < 1 ? 1 : EG.step(x0, x1, 8) }, y: { lo: 0, hi: r.hi, title: title }, series: [{ pts: P.map(function (f) { return [f.y, f[key]]; }), col: col, w: 2.4, mark: 'o', r: 3.5, area: true, fillOp: .12 }], top: function (fx, fy) { return EG.tx(fx(x0) + 6, 18, key === 'water' ? 'Open water (MNDWI' + (P.some(function (f) { return f.it.mss; }) ? '; NDWI for MSS years' : '') + ')' : 'Green vegetation (NDVI)', { fs: 12.5, fw: 800, fill: col }); } }); };
    var s = '<rect width="760" height="540" fill="#fff"/><g>' + mk('water', '#2E6FBF', 'Area (km²)') + '</g><g transform="translate(0 240)">' + mk('veg', '#2E8B57', 'Area (km²)') + '</g>' + EG.tx(380, 500, 'Year', { anchor: 'middle', fw: 700, fs: 12.5 }) + EG.tx(72, 526, aoi.en + ' · ' + seasonEn() + ' scenes · Landsat ' + (frames.some(function (f) { return f.it.mss; }) ? '1–9 (MSS 60 m before 1982, hollow points)' : '4–9 surface reflectance, 30 m') + ' · scenes covering ≥ 90 % of the area', { fs: 11, fill: EG.MUT });
    $('#tlChart').setAttribute('viewBox', '0 0 760 540'); $('#tlChart').innerHTML = s;
    $('#tlChartCap').textContent = t('Area of open water and of green vegetation measured on each year’s scene. Sudden drops show droughts, drainage or upstream dams; sudden rises show floods, new reservoirs or irrigation.', 'مساحة المياه المكشوفة والنبات الأخضر المقيسة على مشهد كل سنة. الانخفاضات المفاجئة تدل على الجفاف أو التجفيف أو السدود في أعالي الأنهار، والارتفاعات المفاجئة على الفيضانات أو الخزانات الجديدة أو الري.');
  }
  function seasonEn() { return { mam: 'Spring (Mar–May)', jja: 'Summer (Jun–Aug)', son: 'Autumn (Sep–Nov)', djf: 'Winter (Dec–Feb)', all: 'Clearest-of-year' }[$('#tlSea').value]; }
  var CH = [['Permanent water', [46, 111, 191]], ['Water lost', [192, 57, 43]], ['New water', [0, 188, 212]], ['Vegetation lost', [230, 126, 34]], ['New vegetation', [46, 139, 87]]];
  var chgCanvas = null;
  function change() {
    var a = frames[+$('#tlA').value], b = frames[+$('#tlB').value]; if (!a || !b) return; if (a.w !== b.w || a.h !== b.h) return;
    var c = document.createElement('canvas'); c.width = a.w; c.height = a.h; var g = c.getContext('2d'); g.drawImage(b.rgb, 0, 0); var base = g.getImageData(0, 0, a.w, a.h), A = [0, 0, 0, 0, 0], dlat = (aoi.n - aoi.s) / a.h, dlon = (aoi.e - aoi.w) / a.w;
    for (var i = 0; i < a.W.length; i++) { var o = 4 * i, gr = (base.data[o] + base.data[o + 1] + base.data[o + 2]) / 3; gr = 150 + gr * 0.4; base.data[o] = base.data[o + 1] = base.data[o + 2] = gr; if (!a.M[i] || !b.M[i]) continue;
      var wa = a.W[i] > a.cw, wb = b.W[i] > b.cw, va = !wa && a.V[i] > a.cv, vb = !wb && b.V[i] > b.cv, k = wa && wb ? 0 : wa && !wb ? 1 : !wa && wb ? 2 : va && !vb ? 3 : !va && vb ? 4 : -1;
      if (k < 0) continue; var ar = dlon * 111.32 * Math.cos(SH.rad(aoi.n - (Math.floor(i / a.w) + 0.5) * dlat)) * dlat * 110.574; A[k] += ar; base.data[o] = CH[k][1][0]; base.data[o + 1] = CH[k][1][1]; base.data[o + 2] = CH[k][1][2]; }
    g.putImageData(base, 0, 0);
    var cv = $('#tlChg'), legend = CH.map(function (q, k) { return [q[0] + ' ' + F(A[k], A[k] < 10 ? 1 : 0) + ' km²', 'rgb(' + q[1].join(',') + ')']; });
    drawMap(cv.getContext('2d'), cv.width, cv.height, b, { foot: 210, base: c, title: aoi.en + ': change ' + a.y + ' → ' + b.y, sub: a.it.date + ' (' + a.it.sat + ') compared with ' + b.it.date + ' (' + b.it.sat + ')', legend: [], stats: 'Water lost ' + F(A[1], 1) + ' km² · new water ' + F(A[2], 1) + ' km² · vegetation lost ' + F(A[3], 1) + ' km² · new vegetation ' + F(A[4], 1) + ' km²' });
    var g2 = cv.getContext('2d'), Lt = layout(cv.width, cv.height, false, 210), s = Lt.s, ly = Lt.y + Lt.h + 120 * s; CH.forEach(function (q, k) { var x = Lt.x + (k % 3) * (Lt.w / 3), y = ly + Math.floor(k / 3) * 26 * s; g2.fillStyle = legend[k][1]; g2.fillRect(x, y - 12 * s, 18 * s, 14 * s); g2.strokeStyle = INK; g2.lineWidth = .8; g2.strokeRect(x, y - 12 * s, 18 * s, 14 * s); txt(g2, legend[k][0], x + 26 * s, y, 13 * s, 500); });
    chgCanvas = cv;
    $('#tlChgCap').textContent = t('Every pixel of the later year compared with the earlier one: red is water that disappeared, cyan is new water, orange is vegetation lost and green is new vegetation. Grey is unchanged ground.', 'كل بكسل في السنة اللاحقة مقارناً بالسابقة: الأحمر مياه اختفت، والسماوي مياه جديدة، والبرتقالي نبات فُقد، والأخضر نبات جديد. والرمادي أرض لم تتغير.') + ' ' + t('Water lost: ', 'المياه المفقودة: ') + F(A[1], 1) + t(' km²; new water: ', ' كم²؛ المياه الجديدة: ') + F(A[2], 1) + t(' km².', ' كم².');
  }
  ['tlA', 'tlB'].forEach(function (id) { $('#' + id).addEventListener('change', change); });
  function table() {
    $('#tlTbl').innerHTML = '<thead><tr><th>' + t('Year', 'السنة') + '</th><th>' + t('Scene date', 'تاريخ المشهد') + '</th><th>' + t('Satellite', 'القمر') + '</th><th class="num">' + t('Cloud %', 'الغيوم %') + '</th><th class="num">' + t('Coverage %', 'التغطية %') + '</th><th class="num">' + t('Water km²', 'المياه كم²') + '</th><th class="num">' + t('Vegetation km²', 'النبات كم²') + '</th></tr></thead><tbody>' +
      frames.map(function (f, i) { return '<tr data-go="' + i + '" style="cursor:pointer"><td><b>' + f.y + '</b></td><td class="ltr">' + (f.it.dates ? f.it.dates.join(' + ') : f.it.date) + '</td><td class="ltr">' + f.it.sat + (f.it.n ? ' <span class="badge">' + t('mosaic of ', 'فسيفساء ') + f.it.n + '</span>' : '') + (f.it.slc ? ' <span class="badge warn">SLC-off</span>' : '') + '</td><td class="num">' + F(f.it.cloud, 0) + '</td><td class="num">' + F(f.cov * 100, 0) + '</td><td class="num">' + F(f.water, f.water < 10 ? 2 : 1) + '</td><td class="num">' + F(f.veg, 1) + '</td></tr>'; }).join('') + '</tbody>';
  }
  $('#tlTbl').addEventListener('click', function (e) { var r = e.target.closest('[data-go]'); if (r) { stop(); show(+r.getAttribute('data-go')); } });
  $('#tlCsv').addEventListener('click', function () { if (!frames.length) return; SH.csv('shandal-timelapse-' + (aoi.key || 'area') + '.csv', [['area', aoi.en], ['bbox_w_s_e_n', [aoi.w, aoi.s, aoi.e, aoi.n].join(' ')], ['season', seasonEn()], ['mndwi_threshold', G.v('tlTw')], ['ndvi_threshold', G.v('tlTv')], [], ['year', 'scene_id', 'date', 'satellite', 'sensor_resolution_m', 'cloud_pct', 'coverage_pct', 'water_km2', 'vegetation_km2']].concat(frames.map(function (f) { return [f.y, f.it.ids ? f.it.ids.join(' + ') : f.it.id, f.it.date, f.it.sat, f.it.mss ? 60 : 30, F(f.it.cloud, 1), (f.cov * 100).toFixed(1), f.water.toFixed(3), f.veg.toFixed(3)]; }))); });

  /* ------------------------------------------------------------------ playback */
  function stop() { if (playing) { clearInterval(playing); playing = null; } var b = $('#tlPlay'); if (b) { b.querySelector('.i-play').style.display = ''; b.querySelector('.i-pause').style.display = 'none'; } }
  $('#tlPlay').addEventListener('click', function () { if (!frames.length) return; if (playing) return stop(); this.querySelector('.i-play').style.display = 'none'; this.querySelector('.i-pause').style.display = ''; if (cur >= frames.length - 1) show(0); playing = setInterval(function () { if (cur >= frames.length - 1) return stop(); show(cur + 1); }, 900 * (+$('#tlSp').value || 1)); });
  $('#tlSl').addEventListener('input', function () { stop(); show(+this.value); });
  ['tlTw', 'tlTv', 'tlTwM', 'tlTvM', 'tlOw', 'tlOv'].forEach(function (id) { $('#' + id).addEventListener('change', function () { persist.save(); if (!frames.length) return; remeasure(); render(); }); });
  $$('[data-fr]').forEach(function (b) { b.addEventListener('click', function () { if (!frames.length) return; SH.exportCanvas($('#tlCv'), 'shandal-' + (aoi.key || 'area') + '-' + frames[cur].y, b.getAttribute('data-fr')); }); });
  $$('[data-ch]').forEach(function (b) { b.addEventListener('click', function () { if (!chgCanvas) return; SH.exportCanvas(chgCanvas, 'shandal-' + (aoi.key || 'area') + '-change-' + frames[+$('#tlA').value].y + '-' + frames[+$('#tlB').value].y, b.getAttribute('data-ch')); }); });

  /* ------------------------------------------------------------------ video */
  $('#tlVid').addEventListener('click', function () {
    if (!frames.length) return; if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { SH.toast(t('This browser cannot record video. Use Chrome, Edge or a recent Safari.', 'هذا المتصفح لا يستطيع تسجيل الفيديو. استعمل كروم أو إيدج أو سفاري حديثاً.'), 'bad'); return; }
    stop(); var fmt = $('#tlFmt').value, sz = fmt === 'reel' ? [1080, 1920] : fmt === 'sq' ? [1080, 1080] : [1920, 1080], cv = document.createElement('canvas'); cv.width = sz[0]; cv.height = sz[1]; var g = cv.getContext('2d');
    var btn = this, old = btn.innerHTML; btn.disabled = true; btn.textContent = t('Recording…', 'جارٍ التسجيل…');
    var mimes = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'], mime = mimes.filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0] || '';
    var fps = 25, hold = 0.9 * (+$('#tlSp').value || 1), fade = 0.35, endHold = 2.2, N = frames.length, total = N * hold + endHold, stream = cv.captureStream(fps), rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined), chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () { var type = (rec.mimeType || mime || 'video/webm').split(';')[0]; SH.download('shandal-' + (aoi.key || 'area') + '-' + frames[0].y + '-' + frames[N - 1].y + (type === 'video/mp4' ? '.mp4' : '.webm'), new Blob(chunks, { type: type })); btn.disabled = false; btn.innerHTML = old; show(cur); };
    var t0 = null, k = 0; drawMap(g, cv.width, cv.height, frames[0], { year: String(frames[0].y), vid: true, idx: 0 }); rec.start(200);
    var tick = setInterval(function () {
      var now = performance.now(); if (t0 === null) t0 = now; var s = (now - t0) / 1000, i = Math.min(N - 1, Math.floor(s / hold)), into = s - i * hold, f = frames[i], prev = i > 0 && into < fade ? frames[i - 1] : null;
      drawMap(g, cv.width, cv.height, f, { year: String(f.y), vid: true, idx: i, prev: prev, mix: prev ? into / fade : 1 });
      if (k++ % 5 === 0) btn.textContent = t('Recording… ', 'جارٍ التسجيل… ') + Math.min(100, Math.round(100 * s / total)) + ' %';
      if (s >= total) { clearInterval(tick); setTimeout(function () { rec.stop(); }, 150); }
    }, 1000 / fps);
  });
  $('#tlCv').addEventListener('click', function () { $('#tlPlay').click(); });
})();
