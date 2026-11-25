/* Satellite-derived bathymetry — Sentinel-2 surface reflectance, water from the scene classification and MNDWI,
   optional sun-glint removal against a deep-water sample (Hedley et al. 2005), the log-ratio depth index
   pSDB = ln(n·Rblue) / ln(n·Rgreen|red), n = 1000 (Stumpf et al. 2003; Caballero & Stumpf 2019), linear calibration
   against known depths with leave-one-out error, a depth map, a calibration plot, a profile and GeoTIFF / CSV exports. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, P = window.PCX, G = window.EG, AR = SH.lang === 'ar', L = window.L;
  var COL = 'sentinel-2-l2a', MS = 1000, N = 1000, INK = '#1B232B', MUT = '#55616B';
  var PRE = [['sawa', 'Lake Sawa', 'بحيرة ساوة', [44.94, 31.27, 45.08, 31.36]], ['habbaniyah', 'Habbaniyah Lake', 'بحيرة الحبانية', [43.3, 33.15, 43.6, 33.35]], ['tortugas', 'Dry Tortugas (USA)', 'دراي تورتوغاس (أمريكا)', [-82.95, 24.58, -82.8, 24.7]]];
  var IDS = ['bName', 'bFrom', 'bTo', 'bCloud', 'bRatio', 'bMax'], persist = SH.persist('satbathy', IDS);
  var map = SH.map('bMap', { zoom: 6, base: 'satellite', center: [33, 44] }), ovl = null, R = null, busy = false, scenes = [], scene = null, PTS = SH.store.get('shandal_sdb_pts', []), GS = null, gRect = null, ptMarks = null, profLine = null;
  var aoiP = P.aoiPicker({ key: 'satbathy', prefix: 'b', map: map, presets: PRE, maxKm: 30, minKm: 0.5, groups: [['Iraq', 'العراق', ['sawa', 'habbaniyah']], ['The world', 'العالم', ['tortugas']]], onChange: function () { scenes = []; scene = null; if ($('#bScenes')) $('#bScenes').innerHTML = ''; } });
  (function dates() { var d = new Date(), y = new Date(d.getTime() - 365 * 864e5); if (!$('#bTo').value) $('#bTo').value = d.toISOString().slice(0, 10); if (!$('#bFrom').value) $('#bFrom').value = y.toISOString().slice(0, 10); })();
  function msg(p, s) { $('#bBar').style.width = Math.round(p * 100) + '%'; $('#bMsg').textContent = s; }

  /* ------------------------------------------------------------ scenes */
  function thumb(it) { return P.API + 'data/v1/item/preview.png?collection=' + COL + '&item=' + encodeURIComponent(it.id) + '&assets=visual&asset_bidx=visual%7C1%2C2%2C3&nodata=0&max_size=96'; }
  function sceneUI() {
    $('#bScenes').innerHTML = scenes.map(function (s, i) { return '<button type="button" data-i="' + i + '" aria-pressed="' + (s === scene) + '"><img loading="lazy" alt="" src="' + thumb(s.items[0]) + '"><span><b class="ltr" style="display:block">' + s.date + '</b>' + t('Clouds ', 'غيوم ') + F(s.cloud, 1) + ' % · ' + s.items.length + t(' tile(s)', ' بلاطة') + '</span></button>'; }).join('');
  }
  $('#bFind').addEventListener('click', function () {
    var a = aoiP.cur; if (!a) return SH.toast(t('Choose the water body first.', 'اختر المسطح المائي أولاً.'), 'warn'); persist.save();
    $('#bScenes').innerHTML = '<span class="xsmall muted">' + t('Searching the Sentinel-2 archive…', 'جارٍ البحث في أرشيف Sentinel-2…') + '</span>';
    P.search(COL, a, [$('#bFrom').value + 'T00:00:00Z', $('#bTo').value + 'T23:59:59Z'], { 'eo:cloud_cover': { lt: +$('#bCloud').value || 10 } }, 100).then(function (its) {
      var by = {}; its.forEach(function (f) { var dd = f.properties.datetime.slice(0, 10); (by[dd] = by[dd] || []).push(f); });
      scenes = Object.keys(by).map(function (dd) { var g = by[dd], c = g.reduce(function (s, f) { return s + f.properties['eo:cloud_cover']; }, 0) / g.length; return { date: dd, cloud: c, items: P.pick(g, a, 4) }; }).filter(function (s) { return P.hits(s.items[0].geometry, [[(a.w + a.e) / 2, (a.s + a.n) / 2]])[0] || s.items.length > 1; });
      scenes.sort(function (x, y) { return x.cloud - y.cloud; }); scenes = scenes.slice(0, 12); scene = scenes[0] || null;
      if (!scenes.length) { $('#bScenes').innerHTML = '<span class="xsmall muted">' + t('No clear image. Widen the dates or raise the cloud limit.', 'لا توجد صورة صافية. وسّع التواريخ أو ارفع حد الغيوم.') + '</span>'; return; }
      sceneUI();
    }).catch(function () { $('#bScenes').innerHTML = '<span class="xsmall muted">' + t('The image archive needs a connection.', 'أرشيف الصور يحتاج اتصالاً.') + '</span>'; });
  });
  $('#bScenes').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b) return; scene = scenes[+b.getAttribute('data-i')]; sceneUI(); });

  /* ------------------------------------------------------------ known depths */
  function savePts() { SH.store.set('shandal_sdb_pts', PTS); }
  function ptsUI() {
    $('#bPts').innerHTML = PTS.length ? PTS.map(function (p, i) { return '<div data-i="' + i + '"><span class="ltr">' + p.lat.toFixed(5) + ', ' + p.lon.toFixed(5) + '</span><input type="number" step="0.1" min="0" value="' + p.d + '" aria-label="' + t('Depth (m)', 'العمق (م)') + '"><button type="button" data-rm>✕</button></div>'; }).join('') : '<span class="xsmall muted">' + t('No known depths yet.', 'لا أعماق معروفة بعد.') + '</span>';
    if (ptMarks) map.removeLayer(ptMarks); ptMarks = L.layerGroup(PTS.map(function (p) { return L.circleMarker([p.lat, p.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#E2C27A', fillOpacity: 1 }).bindTooltip(F(p.d, 1) + ' m'); })).addTo(map);
  }
  $('#bPts').addEventListener('change', function (e) { var r = e.target.closest('[data-i]'); if (!r) return; var v = parseFloat(e.target.value); if (isFinite(v) && v >= 0) { PTS[+r.getAttribute('data-i')].d = v; savePts(); ptsUI(); } });
  $('#bPts').addEventListener('click', function (e) { if (!e.target.closest('[data-rm]')) return; PTS.splice(+e.target.closest('[data-i]').getAttribute('data-i'), 1); savePts(); ptsUI(); });
  $('#bClrPt').addEventListener('click', function () { if (!PTS.length) return; SH.confirm(t('Remove all known depths?', 'أتحذف كل الأعماق المعروفة؟')).then(function (ok) { if (ok) { PTS = []; savePts(); ptsUI(); } }); });
  var adding = false;
  $('#bAddPt').addEventListener('click', function () { adding = true; map.getContainer().style.cursor = 'crosshair'; SH.toast(t('Tap the map where the depth was measured.', 'انقر على الخريطة حيث قيس العمق.')); });
  function parseLines(txt) {
    var n = 0; txt.split(/\r?\n/).forEach(function (ln) { var v = ln.split(/[,;\t ]+/).map(function (x) { return parseFloat(x); }).filter(function (x) { return isFinite(x); }); if (v.length < 3) return; var la = v[0], lo = v[1], dd = Math.abs(v[2]); if (Math.abs(la) > 90 || Math.abs(lo) > 180) return; PTS.push({ lat: la, lon: lo, d: dd }); n++; });
    savePts(); ptsUI(); SH.toast(n + t(' points added.', ' نقطة أُضيفت.'), n ? 'ok' : 'warn');
  }
  $('#bPasteGo').addEventListener('click', function () { parseLines($('#bPaste').value); $('#bPaste').value = ''; });
  $('#bCsvIn').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) f.text().then(parseLines); e.target.value = ''; });

  /* ------------------------------------------------------------ sun glint sample */
  $('#bGlint').addEventListener('change', function () { $('#bGlintDraw').hidden = !this.checked; $('#bGlintInfo').hidden = !this.checked; if (!this.checked) { GS = null; if (gRect) map.removeLayer(gRect); } glintInfo(); });
  function glintInfo() { $('#bGlintInfo').textContent = GS ? t('Sample: ', 'العيّنة: ') + GS.s.toFixed(4) + '–' + GS.n.toFixed(4) + '° N, ' + GS.w.toFixed(4) + '–' + GS.e.toFixed(4) + '° E' : t('Draw a rectangle over open, deep water where the bottom cannot be seen and glint shows as ripples.', 'ارسم مستطيلاً فوق مياه مفتوحة عميقة لا يُرى قاعها ويظهر فيها الوهج تموّجات.'); }
  $('#bGlintDraw').addEventListener('click', function () { SH.drawRect(map, function (bb, r) { if (gRect) map.removeLayer(gRect); gRect = r; if (r) r.setStyle({ color: '#33C2FF' }); GS = { w: bb.getWest(), e: bb.getEast(), s: bb.getSouth(), n: bb.getNorth() }; glintInfo(); }, $('#bHint')); });

  /* ------------------------------------------------------------ profile line */
  var prof = null, profPts = [];
  $('#bProfDraw').addEventListener('click', function () { if (!R) return; profPts = []; prof = true; map.getContainer().style.cursor = 'crosshair'; $('#bProfHint').textContent = t('Tap the start (A) and the end (B) on the map.', 'انقر البداية (A) ثم النهاية (B) على الخريطة.'); SH.$('#bMap').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  map.on('click', function (e) {
    if (adding) { adding = false; map.getContainer().style.cursor = ''; var typed = ''; SH.modal(t('Known depth', 'العمق المعروف'), '<label class="xsmall" for="bDin">' + t('Depth at this point (m)', 'العمق عند هذه النقطة (م)') + '</label><input id="bDin" class="eo-in" type="number" step="0.1" min="0" inputmode="decimal">', [{ label: t('Cancel', 'إلغاء'), value: false }, { label: t('Add', 'أضف'), value: true, cls: 'btn-gold' }]).then(function (ok) { if (ok) add(typed); }); setTimeout(function () { var el = document.getElementById('bDin'); if (el) { el.focus(); el.addEventListener('input', function () { typed = el.value; }); } }, 50); function add(v) { v = parseFloat(v); if (!isFinite(v) || v < 0) return; PTS.push({ lat: e.latlng.lat, lon: e.latlng.lng, d: v }); savePts(); ptsUI(); } return; }
    if (prof) { profPts.push(e.latlng); if (profPts.length === 2) { prof = false; map.getContainer().style.cursor = ''; $('#bProfHint').textContent = ''; if (profLine) map.removeLayer(profLine); profLine = L.polyline(profPts, { color: '#E2C27A', weight: 3 }).addTo(map); figProf(); SH.$('#fb3').scrollIntoView({ behavior: 'smooth' }); } }
  });

  /* ------------------------------------------------------------ reading the image */
  function bbox(a) { return [a.w, a.s, a.e, a.n].map(function (v) { return v.toFixed(5); }).join(','); }
  function off(it) { return (it.properties['s2:processing_baseline'] || '') >= '04.00' ? 1000 : 0; }
  function fetchPair(a, it) {
    var o = off(it), lo = o, hiV = o + 1500, hiN = o + 3000;
    var q1 = '&expression=' + encodeURIComponent('B02;B03;B04') + '&asset_as_band=true&rescale=' + lo + ',' + hiV + '&rescale=' + lo + ',' + hiV + '&rescale=' + lo + ',' + hiV;
    var q2 = '&expression=' + encodeURIComponent('B08;B11;SCL') + '&asset_as_band=true&rescale=' + lo + ',' + hiN + '&rescale=' + lo + ',' + hiN + '&rescale=0,255';
    return Promise.all([P.img(P.bboxUrl(a, COL, it.id, q1, MS)), P.img(P.bboxUrl(a, COL, it.id, q2, MS))]).then(function (B) { var w0 = B[0].width, h0 = B[0].height; return { w: w0, h: h0, v: P.pix(B[0], w0, h0), n: P.pix(B[1], w0, h0) }; });
  }
  function read(a, sc) {
    return Promise.all(sc.items.map(function (it, k) { return fetchPair(a, it).catch(function (e) { if (!k) throw e; return null; }); })).then(function (A) {
      var w0 = A[0].w, h0 = A[0].h, n = w0 * h0, B = new Float32Array(n), Gr = new Float32Array(n), Rd = new Float32Array(n), NI = new Float32Array(n), SW = new Float32Array(n), SCL = new Uint8Array(n), ok = new Uint8Array(n), kV = 0.15 / 255, kN = 0.3 / 255;
      A.forEach(function (x) { if (!x) return; var v = x.w === w0 ? x : null; if (!v) return; for (var i = 0; i < n; i++) { var o = 4 * i; if (ok[i] || v.v.data[o + 3] < 128 || v.n.data[o + 3] < 128) continue; ok[i] = 1; B[i] = v.v.data[o] * kV; Gr[i] = v.v.data[o + 1] * kV; Rd[i] = v.v.data[o + 2] * kV; NI[i] = v.n.data[o] * kN; SW[i] = v.n.data[o + 1] * kN; SCL[i] = v.n.data[o + 2]; } });
      return { w: w0, h: h0, B: B, G: Gr, R: Rd, N: NI, S: SW, SCL: SCL, ok: ok };
    });
  }

  /* ------------------------------------------------------------ analysis */
  function px(r, a, lat, lon) { var x = Math.floor((lon - a.w) / (a.e - a.w) * r.w), y = Math.floor((a.n - lat) / (a.n - a.s) * r.h); return x >= 0 && y >= 0 && x < r.w && y < r.h ? [x, y] : null; }
  function fit(xs, ys) { var n = xs.length, mx = 0, my = 0, i; for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n; var sxy = 0, sxx = 0, syy = 0; for (i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); } var m1 = sxx ? sxy / sxx : 0, b = my - m1 * mx; return { m1: m1, b: b, r2: sxx && syy ? sxy * sxy / (sxx * syy) : 0 }; }
  function evalFit(xs, ys) {
    var f = fit(xs, ys), n = xs.length, se = 0, lo = 0, ae = [], i; for (i = 0; i < n; i++) { var e = f.m1 * xs[i] + f.b - ys[i]; se += e * e; ae.push(Math.abs(e)); }
    if (n >= 4) for (i = 0; i < n; i++) { var xx = xs.slice(), yy = ys.slice(); xx.splice(i, 1); yy.splice(i, 1); var g = fit(xx, yy), e2 = g.m1 * xs[i] + g.b - ys[i]; lo += e2 * e2; }
    ae.sort(function (p, q) { return p - q; });
    f.n = n; f.rmse = Math.sqrt(se / n); f.loo = n >= 4 ? Math.sqrt(lo / n) : null; f.medae = n ? ae[Math.floor(n / 2)] : null; return f;
  }
  function analyse(a, I, sc) {
    var w0 = I.w, h0 = I.h, n = w0 * h0, water = new Uint8Array(n), pg = new Float32Array(n), pr = new Float32Array(n), i, nW = 0, nCl = 0, nirW = [];
    for (i = 0; i < n; i++) { if (!I.ok[i]) continue; var s = I.SCL[i]; if (s === 3 || s === 8 || s === 9 || s === 10 || s === 11) { nCl++; continue; } var mn = (I.G[i] - I.S[i]) / (I.G[i] + I.S[i] + 1e-6); if (s === 6 || mn > 0) { water[i] = 1; nW++; } }
    var glint = null;
    if ($('#bGlint').checked && GS) {
      var sx = [], sy = { B: [], G: [], R: [] }; for (i = 0; i < n; i++) { if (!water[i]) continue; var lo = a.w + ((i % w0) + 0.5) / w0 * (a.e - a.w), la = a.n - (Math.floor(i / w0) + 0.5) / h0 * (a.n - a.s); if (lo >= GS.w && lo <= GS.e && la >= GS.s && la <= GS.n) { sx.push(I.N[i]); sy.B.push(I.B[i]); sy.G.push(I.G[i]); sy.R.push(I.R[i]); } }
      if (sx.length >= 30) { var mnN = Math.min.apply(null, sx); glint = { n: sx.length, min: mnN, B: fit(sx, sy.B).m1, G: fit(sx, sy.G).m1, R: fit(sx, sy.R).m1 }; for (i = 0; i < n; i++) if (water[i]) { var dN = I.N[i] - mnN; I.B[i] -= glint.B * dN; I.G[i] -= glint.G * dN; I.R[i] -= glint.R * dN; } }
      else glint = { n: sx.length, fail: true };
    }
    for (i = 0; i < n; i++) { if (!water[i]) continue; nirW.push(I.N[i]); var lb = Math.log(N * I.B[i]), lg = Math.log(N * I.G[i]), lr = Math.log(N * I.R[i]); pg[i] = I.B[i] > 0.0011 && I.G[i] > 0.0011 ? lb / lg : NaN; pr[i] = I.B[i] > 0.0011 && I.R[i] > 0.0011 ? lb / lr : NaN; }
    nirW.sort(function (p, q) { return p - q; });
    /* known depths: 3 × 3 median of the index at each point */
    function samp(arr, x, y) { var v = []; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w0 || yy >= h0) continue; var k = yy * w0 + xx; if (water[k] && isFinite(arr[k])) v.push(arr[k]); } if (!v.length) return NaN; v.sort(function (p, q) { return p - q; }); return v[Math.floor(v.length / 2)]; }
    var used = [], skipped = 0;
    PTS.forEach(function (p) { var q = px(I, a, p.lat, p.lon); if (!q) { skipped++; return; } var g = samp(pg, q[0], q[1]), r0 = samp(pr, q[0], q[1]); if (!isFinite(g) && !isFinite(r0)) { skipped++; return; } used.push({ p: p, g: g, r: r0 }); });
    var mode = $('#bRatio').value, fg = null, fr = null;
    var gu = used.filter(function (u) { return isFinite(u.g); }), ru = used.filter(function (u) { return isFinite(u.r); });
    if (gu.length >= 3) fg = evalFit(gu.map(function (u) { return u.g; }), gu.map(function (u) { return u.p.d; }));
    if (ru.length >= 3) fr = evalFit(ru.map(function (u) { return u.r; }), ru.map(function (u) { return u.p.d; }));
    var cal = mode === 'green' ? !!fg : mode === 'red' ? !!fr : !!(fg && fr);
    var dmax = parseFloat($('#bMax').value); if (!isFinite(dmax) || dmax <= 0) dmax = used.length ? Math.max.apply(null, used.map(function (u) { return u.p.d; })) * 1.2 : 20;
    var Z = new Float32Array(n).fill(NaN), beyond = 0, nZ = 0, vals = [];
    if (cal) {
      for (i = 0; i < n; i++) { if (!water[i]) continue; var zg = fg && isFinite(pg[i]) ? fg.m1 * pg[i] + fg.b : NaN, zr = fr && isFinite(pr[i]) ? fr.m1 * pr[i] + fr.b : NaN, z = mode === 'green' ? zg : mode === 'red' ? zr : (isFinite(zr) && zr < 5 ? zr : zg); if (!isFinite(z)) continue; z = Math.max(0, z); Z[i] = z; nZ++; if (z > dmax) beyond++; else vals.push(z); }
    } else {
      var src = mode === 'red' ? pr : pg, s0 = []; for (i = 0; i < n; i++) if (water[i] && isFinite(src[i])) s0.push(src[i]); s0.sort(function (p, q) { return p - q; });
      var q2 = s0[Math.floor(s0.length * 0.02)] || 0, q98 = s0[Math.floor(s0.length * 0.98)] || 1, sp = q98 - q2 || 1, sgn = fg ? Math.sign(fg.m1) || 1 : 1;
      for (i = 0; i < n; i++) if (water[i] && isFinite(src[i])) { Z[i] = Math.max(0, Math.min(1, (src[i] - q2) / sp)); nZ++; vals.push(Z[i]); }
    }
    vals.sort(function (p, q) { return p - q; });
    var pxA = P.rowArea(a, w0, h0), aW = 0; for (i = 0; i < n; i++) if (water[i]) aW += pxA[Math.floor(i / w0)];
    used.forEach(function (u) { var zg = fg && isFinite(u.g) ? fg.m1 * u.g + fg.b : NaN, zr = fr && isFinite(u.r) ? fr.m1 * u.r + fr.b : NaN; u.z = mode === 'green' ? zg : mode === 'red' ? zr : (isFinite(zr) && zr < 5 ? zr : zg); });
    var fs = null;
    if (mode === 'switch' && fg && fr) {
      var both = used.filter(function (u) { return isFinite(u.g) && isFinite(u.r); }), se = 0, lo2 = 0, ae = [], zz = [], dd = [];
      both.forEach(function (u) { var e0 = u.z - u.p.d; se += e0 * e0; ae.push(Math.abs(e0)); zz.push(u.z); dd.push(u.p.d); });
      if (both.length >= 4) both.forEach(function (u, k) { var rest = both.filter(function (x, j) { return j !== k; }), g1 = fit(rest.map(function (x) { return x.g; }), rest.map(function (x) { return x.p.d; })), r1 = fit(rest.map(function (x) { return x.r; }), rest.map(function (x) { return x.p.d; })), zr1 = r1.m1 * u.r + r1.b, z1 = zr1 < 5 ? zr1 : g1.m1 * u.g + g1.b; lo2 += (Math.max(0, z1) - u.p.d) * (Math.max(0, z1) - u.p.d); });
      ae.sort(function (x, y) { return x - y; });
      if (both.length) fs = { n: both.length, rmse: Math.sqrt(se / both.length), loo: both.length >= 4 ? Math.sqrt(lo2 / both.length) : null, medae: ae[Math.floor(ae.length / 2)], r2: fit(zz, dd).r2, m1: fg.m1, b: fg.b, sw: true };
    }
    return { fs: fs, a: a, w: w0, h: h0, sc: sc, water: water, Z: Z, cal: cal, mode: mode, fg: fg, fr: fr, used: used, skipped: skipped, dmax: dmax, beyond: beyond, nZ: nZ, nW: nW, nCl: nCl, aW: aW, med: vals.length ? vals[Math.floor(vals.length / 2)] : NaN, p95: vals.length ? vals[Math.floor(vals.length * 0.95)] : NaN, glint: glint, nirMed: nirW.length ? nirW[Math.floor(nirW.length / 2)] : NaN, I: I };
  }

  /* ------------------------------------------------------------ run */
  function run() {
    if (busy) return; var a = aoiP.cur; if (!a) return SH.toast(t('Choose the water body first.', 'اختر المسطح المائي أولاً.'), 'warn');
    if (!scene) return SH.toast(t('Find the satellite images and choose one first.', 'ابحث عن الصور الفضائية واختر واحدة أولاً.'), 'warn');
    if ($('#bGlint').checked && !GS) return SH.toast(t('Draw the deep-water sample, or switch glint removal off.', 'ارسم عيّنة المياه العميقة، أو أوقف إزالة الوهج.'), 'warn');
    persist.save(); busy = true; $('#bRun').disabled = true; msg(0.15, t('Reading the image bands…', 'قراءة حزم الصورة…'));
    read(a, scene).then(function (I) { msg(0.7, t('Computing the depths…', 'حساب الأعماق…')); R = analyse(a, I, scene); render(); msg(1, t('Ready.', 'جاهز.')); })
      .catch(function (e) { msg(0, ''); SH.toast((e && e.status ? t('The image service is busy. Try again in a minute.', 'خدمة الصور مشغولة. أعد المحاولة بعد دقيقة.') : (e && e.message) || String(e)), 'bad'); })
      .then(function () { busy = false; $('#bRun').disabled = false; });
  }
  $('#bRun').addEventListener('click', run);

  /* ------------------------------------------------------------ colours and drawing */
  var RAMP = [[0, [198, 236, 245]], [0.25, [110, 196, 226]], [0.5, [42, 140, 200]], [0.75, [22, 80, 160]], [1, [10, 30, 90]]];
  function lerp(x) { x = Math.max(0, Math.min(1, x)); for (var k = 1; k < RAMP.length; k++) if (x <= RAMP[k][0]) { var a0 = RAMP[k - 1], b0 = RAMP[k], u = (x - a0[0]) / (b0[0] - a0[0]); return [0, 1, 2].map(function (j) { return Math.round(a0[1][j] + (b0[1][j] - a0[1][j]) * u); }); } return RAMP[RAMP.length - 1][1]; }
  function canvas(r) {
    var c = document.createElement('canvas'); c.width = r.w; c.height = r.h; var g = c.getContext('2d'), im = g.createImageData(r.w, r.h), d = im.data, top = r.cal ? r.dmax : 1;
    for (var i = 0; i < r.w * r.h; i++) { var o = 4 * i, z = r.Z[i];
      if (r.water[i] && isFinite(z)) { if (r.cal && z > r.dmax) { d[o] = 120; d[o + 1] = 90; d[o + 2] = 150; } else { var col = lerp(z / top); d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; } d[o + 3] = 255; }
      else if (r.water[i]) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = 255; }
      else if (r.I.ok[i]) { var s = r.I.SCL[i], cl = s === 3 || s === 8 || s === 9 || s === 10 || s === 11; d[o] = cl ? 200 : 226; d[o + 1] = cl ? 200 : 220; d[o + 2] = cl ? 205 : 205; d[o + 3] = 255; } }
    g.putImageData(im, 0, 0); return c;
  }
  function nm() { return aoiP.name('en'); }
  function draw() {
    var r = R, top = r.cal ? r.dmax : 1, st = r.cal ? G.step(0, top, 5) : 0.25, ticks = G.ticks(0, top, st);
    var o = { a: r.a, layers: [canvas(r)], smooth: false, title: nm() + (r.cal ? ' — water depth' : ' — relative water depth'), sub: 'Sentinel-2 ' + r.sc.date + ' · ' + (r.mode === 'green' ? 'blue/green' : r.mode === 'red' ? 'blue/red' : 'blue/red below 5 m, blue/green deeper') + ' log ratio' + (r.cal ? ', calibrated with ' + (r.mode === 'red' ? r.fr.n : r.fg.n) + ' known depths' : ', not calibrated') + (r.glint && !r.glint.fail ? ' · sun glint removed' : ''),
      ramp: { lo: 0, hi: top, stops: RAMP.map(function (s) { return [s[0] * top, 'rgb(' + s[1].join(',') + ')']; }), ticks: ticks, label: r.cal ? 'Depth below the water surface on the image date (m)' : 'Relative depth index (0 shallow – 1 deep, not metres)' },
      legend: [['Land', '#E2DCCD'], ['Cloud or shadow', '#C8C8CD'], ['Water without a valid value', '#FFFFFF']].concat(r.cal ? [['Deeper than ' + F(r.dmax, 1) + ' m (beyond the reliable range)', '#785A96']] : []),
      stats: r.cal ? 'Water ' + F(r.aW, 2) + ' km²  ·  median depth ' + F(r.med, 1) + ' m  ·  95th percentile ' + F(r.p95, 1) + ' m  ·  error (leave-one-out RMSE) ' + (cfit(r).loo != null ? '±' + F(cfit(r).loo, 2) + ' m' : 'n/a') : 'Water ' + F(r.aW, 2) + ' km²  ·  add known depths to convert to metres' };
    P.sheet($('#bCv'), o);
    $('#bCap').textContent = r.cal ? t('Depth below the water surface on the day of the image. Shades of blue darken with depth; purple marks depths beyond the reliable range, white water without a valid value (glint, very dark or turbid water).', 'العمق تحت سطح الماء يوم التقاط الصورة. تزداد درجة الأزرق قتامة مع العمق؛ والبنفسجي أعماق خارج المدى الموثوق، والأبيض ماء بلا قيمة صالحة (وهج أو مياه شديدة القتامة أو العكارة).') : t('Relative depth: 0 is the shallowest and 1 the deepest water in this image (2nd and 98th percentiles). Add known depths to turn it into metres.', 'عمق نسبي: 0 أضحل الماء و1 أعمقه في هذه الصورة (المئين 2 و98). أضف أعماقاً معروفة لتحويله إلى أمتار.');
  }
  function cfit(r) { return r.mode === 'red' ? r.fr : r.mode === 'switch' && r.fs ? r.fs : r.fg; }
  function render() {
    var r = R; $('#bEmpty').hidden = true; $('#bOut').hidden = false; var f = cfit(r);
    $('#bKpis').innerHTML = G.kpi('info', t('Water mapped', 'المياه المرسومة'), F(r.aW, 2) + '<small> km²</small>', r.sc.date) + (r.cal ? G.kpi('info', t('Median depth', 'العمق الوسيط'), F(r.med, 1) + '<small> m</small>', t('95 % shallower than ', '95 % أضحل من ') + F(r.p95, 1) + ' m') + G.kpi(f.loo != null && f.loo < 1 ? 'ok' : 'warn', t('Error at the known depths', 'الخطأ عند الأعماق المعروفة'), (f.loo != null ? '±' + F(f.loo, 2) : '±' + F(f.rmse, 2)) + '<small> m</small>', (f.loo != null ? t('leave-one-out RMSE · ', 'RMSE بترك نقطة · ') : t('fit RMSE · ', 'RMSE الملاءمة · ')) + 'R² ' + F(f.r2, 2)) + G.kpi('', t('Known depths used', 'الأعماق المعروفة المستخدمة'), f.n, r.skipped ? r.skipped + t(' outside the water or the image', ' خارج الماء أو الصورة') : '') : G.kpi('warn', t('Depths in metres', 'الأعماق بالأمتار'), t('Not yet', 'ليس بعد'), t('needs at least 3 known depths', 'تحتاج 3 أعماق معروفة على الأقل')));
    var v = [];
    if (r.cal) v.push(G.verdict(f.loo != null && f.loo < 1 ? 'ok' : 'info', t('Depth map in metres', 'خريطة أعماق بالأمتار'), t('Calibrated with ', 'عويرت بـ') + f.n + (f.sw ? t(' known depths: red-ratio model below 5 m, green-ratio model deeper (both lines in Figure 2); R² of mapped against known depths = ', ' عمقاً معروفاً: نموذج نسبة الأحمر دون 5 م ونموذج نسبة الأخضر أعمق (الخطان في الشكل 2)؛ وR² بين المرسوم والمعروف = ') : t(' known depths: depth = ', ' عمقاً معروفاً: العمق = ') + '<span class="ltr">' + F(f.m1, 2) + ' × pSDB ' + (f.b >= 0 ? '+ ' : '− ') + F(Math.abs(f.b), 2) + '</span>' + t(', R² = ', '، R² = ')) + F(f.r2, 2) + t('. Leaving each point out in turn and predicting it from the others gives an error of ', '. وترك كل نقطة بدورها والتنبؤ بها من البقية يعطي خطأ ') + (f.loo != null ? '±' + F(f.loo, 2) + ' m' : t('— (needs 4 points)', '— (يحتاج 4 نقاط)')) + t('; the median absolute error is ', '؛ والخطأ المطلق الوسيط ') + F(f.medae, 2) + ' m.' + (r.beyond ? t(' ', ' ') + F(r.beyond / r.nZ * 100, 1) + t(' % of the water is deeper than the reliable range and is drawn in purple.', ' % من الماء أعمق من المدى الموثوق ورُسم بالبنفسجي.') : '')));
    else v.push(G.verdict('warn', t('Relative depth only', 'عمق نسبي فقط'), t('With fewer than three known depths inside the mapped water, the map shows where the water is shallower or deeper in this image, not how deep it is. Add depths from a survey, an echo sounder or a nautical chart and run again.', 'مع أقل من ثلاثة أعماق معروفة داخل الماء المرسوم، تبيّن الخريطة أين الماء أضحل أو أعمق في هذه الصورة، لا كم عمقه. أضف أعماقاً من مسح أو جهاز صدى أو خريطة ملاحية وأعد الحساب.')));
    if (r.glint) v.push(G.verdict(r.glint.fail ? 'warn' : 'info', t('Sun glint', 'وهج الشمس'), r.glint.fail ? t('The deep-water sample holds only ', 'عيّنة المياه العميقة فيها ') + r.glint.n + t(' water pixels; at least 30 are needed, so glint was not removed.', ' بكسل ماء فقط؛ ويلزم 30 على الأقل، فلم يُزل الوهج.') : t('Glint was removed from ', 'أُزيل الوهج من ') + r.glint.n + t(' sample pixels: slopes on NIR blue ', ' بكسل عيّنة: ميول على NIR للأزرق ') + F(r.glint.B, 2) + t(', green ', '، والأخضر ') + F(r.glint.G, 2) + t(', red ', '، والأحمر ') + F(r.glint.R, 2) + '.'));
    v.push(G.verdict('info', t('Water level and clarity', 'منسوب الماء وصفاؤه'), t('Depths are below the water surface on ', 'الأعماق تحت سطح الماء يوم ') + r.sc.date + t('. Known depths measured on another day must be corrected to that water level (tide, river stage or lake level). The method needs light to reach the bottom: muddy, algal or stirred-up water makes the depths too shallow, and dark bottoms such as weed beds can look deeper.', '. ويجب تصحيح الأعماق المعروفة المقيسة في يوم آخر إلى ذلك المنسوب (المد، أو منسوب النهر، أو منسوب البحيرة). وتحتاج الطريقة أن يصل الضوء إلى القاع: فالماء الطيني أو المليء بالطحالب أو المضطرب يجعل الأعماق أضحل من حقيقتها، والقيعان الداكنة كمروج النباتات قد تبدو أعمق.')));
    $('#bVerd').innerHTML = v.join(''); draw(); figCal(); figProf();
    if (map) { if (ovl) map.removeLayer(ovl); ovl = L.imageOverlay(canvas(r).toDataURL(), [[r.a.s, r.a.w], [r.a.n, r.a.e]], { opacity: 0.9 }).addTo(map); if (ptMarks) ptMarks.bringToFront && ptMarks.eachLayer(function (l) { l.bringToFront(); }); }
  }

  /* ------------------------------------------------------------ figure 2: calibration */
  function figCal() {
    var svg = $('#bCal'), r = R, W = 760, X0 = 80, X1 = 720, Y0 = 50, Y1 = 400, s = '<rect width="760" height="520" fill="#fff"/>' + G.tx(W / 2, 28, 'Calibration of the depth index against known depths', { fs: 15, fw: 800, anchor: 'middle' });
    var sets = [];
    if (r.fg && r.mode !== 'red') sets.push(['g', 'Blue/green ratio', '#2E8B57', r.fg]);
    if (r.fr && r.mode !== 'green') sets.push(['r', 'Blue/red ratio', '#C0392B', r.fr]);
    var pts = []; r.used.forEach(function (u) { sets.forEach(function (S0) { var x = S0[0] === 'g' ? u.g : u.r; if (isFinite(x)) pts.push([x, u.p.d, S0]); }); });
    if (!pts.length) { svg.innerHTML = s + '<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="none" stroke="' + INK + '"/>' + G.tx(W / 2, (Y0 + Y1) / 2, 'No known depths inside the mapped water', { fs: 13, fill: MUT, anchor: 'middle' }); $('#bCalCap').textContent = t('Add at least three known depths to calibrate the map.', 'أضف ثلاثة أعماق معروفة على الأقل لمعايرة الخريطة.'); return; }
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), xl = Math.min.apply(0, xs), xh = Math.max.apply(0, xs), yh = Math.max.apply(0, ys) * 1.1 || 1, dx = (xh - xl) || 0.05; xl -= dx * 0.08; xh += dx * 0.08;
    var X = function (v) { return X0 + (v - xl) / (xh - xl) * (X1 - X0); }, Y = function (v) { return Y0 + v / yh * (Y1 - Y0); };
    G.ticks(xl, xh, G.step(xl, xh, 6)).forEach(function (v) { s += '<line x1="' + X(v) + '" y1="' + Y0 + '" x2="' + X(v) + '" y2="' + Y1 + '" stroke="#E3E6E8"/>' + G.tx(X(v), Y1 + 16, F(v, 2), { fs: 10.5, anchor: 'middle', fill: MUT }); });
    G.ticks(0, yh, G.step(0, yh, 6)).forEach(function (v) { s += '<line x1="' + X0 + '" y1="' + Y(v) + '" x2="' + X1 + '" y2="' + Y(v) + '" stroke="#E3E6E8"/>' + G.tx(X0 - 8, Y(v) + 4, F(v, v % 1 ? 1 : 0), { fs: 10.5, anchor: 'end', fill: MUT }); });
    s += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="none" stroke="' + INK + '"/>';
    sets.forEach(function (S0) { var f = S0[3]; s += '<line x1="' + X(xl) + '" y1="' + Y(Math.max(0, f.m1 * xl + f.b)) + '" x2="' + X(xh) + '" y2="' + Y(Math.max(0, f.m1 * xh + f.b)) + '" stroke="' + S0[2] + '" stroke-width="2" stroke-dasharray="6 4" clip-path="url(#bcc)"/>'; });
    s = s.replace('<rect x="' + X0, '<clipPath id="bcc"><rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '"/></clipPath><rect x="' + X0);
    pts.forEach(function (p) { s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="5" fill="' + p[2][2] + '" fill-opacity=".85" stroke="#fff"/>'; });
    s += G.tx((X0 + X1) / 2, Y1 + 36, 'pSDB = ln(1000·R_blue) / ln(1000·R_' + (sets.length > 1 ? 'green or red' : sets[0][0] === 'g' ? 'green' : 'red') + ')  (dimensionless)', { fs: 11.5, fw: 700, anchor: 'middle' });
    s += G.tx(24, (Y0 + Y1) / 2, 'Known depth (m)', { fs: 11.5, fw: 700, anchor: 'middle', rot: -90 });
    var ly = Y1 + 66; s += G.tx(X0, ly, 'Legend', { fs: 12, fw: 800 }); ly += 18;
    sets.forEach(function (S0) { var f = S0[3]; s += '<circle cx="' + (X0 + 6) + '" cy="' + (ly - 4) + '" r="5" fill="' + S0[2] + '"/><line x1="' + (X0 + 16) + '" y1="' + (ly - 4) + '" x2="' + (X0 + 36) + '" y2="' + (ly - 4) + '" stroke="' + S0[2] + '" stroke-width="2" stroke-dasharray="6 4"/>' + G.tx(X0 + 44, ly, S0[1] + ': depth = ' + F(f.m1, 2) + ' × pSDB ' + (f.b >= 0 ? '+ ' : '− ') + F(Math.abs(f.b), 2) + ' · n = ' + f.n + ' · R² = ' + F(f.r2, 2) + ' · RMSE ' + F(f.rmse, 2) + ' m' + (f.loo != null ? ' · LOO ' + F(f.loo, 2) + ' m' : ''), { fs: 11 }); ly += 18; });
    svg.innerHTML = s;
    $('#bCalCap').textContent = t('Each known depth against the depth index at its pixel (median of 3 × 3 pixels), with the fitted straight line. LOO is the error when each point is predicted from the others.', 'كل عمق معروف مقابل مؤشر العمق عند بكسله (وسيط 3 × 3 بكسل)، مع الخط المستقيم الملائم. وLOO هو الخطأ حين يُتنبأ بكل نقطة من البقية.');
  }

  /* ------------------------------------------------------------ figure 3: profile */
  function figProf() {
    var svg = $('#bProf'), r = R, W = 760, X0 = 70, X1 = 730, Y0 = 50, Y1 = 320, s = '<rect width="760" height="400" fill="#fff"/>' + G.tx(W / 2, 28, 'Depth profile A–B', { fs: 15, fw: 800, anchor: 'middle' });
    if (!r || profPts.length < 2) { svg.innerHTML = s + '<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="none" stroke="' + INK + '"/>' + G.tx(W / 2, (Y0 + Y1) / 2, 'Draw a line on the map to see the profile', { fs: 13, fill: MUT, anchor: 'middle' }); return; }
    var A = profPts[0], B = profPts[1], len = A.distanceTo(B), K = 240, pr = [];
    for (var k = 0; k <= K; k++) { var u = k / K, la = A.lat + (B.lat - A.lat) * u, lo = A.lng + (B.lng - A.lng) * u, q = px(r.I, r.a, la, lo), z = q ? r.Z[q[1] * r.w + q[0]] : NaN; pr.push([u * len, isFinite(z) && q && r.water[q[1] * r.w + q[0]] ? z : NaN]); }
    var zs = pr.map(function (p) { return p[1]; }).filter(isFinite), zh = (zs.length ? Math.max.apply(0, zs) : 1) * 1.1 || 1, xh = len, unit = xh > 2000 ? 'km' : 'm', sc = unit === 'km' ? 1000 : 1;
    var X = function (v) { return X0 + v / xh * (X1 - X0); }, Y = function (v) { return Y0 + v / zh * (Y1 - Y0); };
    G.ticks(0, xh / sc, G.step(0, xh / sc, 6)).forEach(function (v) { s += '<line x1="' + X(v * sc) + '" y1="' + Y0 + '" x2="' + X(v * sc) + '" y2="' + Y1 + '" stroke="#E3E6E8"/>' + G.tx(X(v * sc), Y1 + 16, F(v, v % 1 ? 1 : 0), { fs: 10.5, anchor: 'middle', fill: MUT }); });
    G.ticks(0, zh, G.step(0, zh, 5)).forEach(function (v) { s += '<line x1="' + X0 + '" y1="' + Y(v) + '" x2="' + X1 + '" y2="' + Y(v) + '" stroke="#E3E6E8"/>' + G.tx(X0 - 8, Y(v) + 4, F(v, v % 1 ? 1 : 0), { fs: 10.5, anchor: 'end', fill: MUT }); });
    var path = '', area = '', seg = [];
    function flush() { if (seg.length > 1) { path += 'M' + seg.map(function (p) { return X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('L'); area += 'M' + X(seg[0][0]).toFixed(1) + ' ' + Y0 + 'L' + seg.map(function (p) { return X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('L') + 'L' + X(seg[seg.length - 1][0]).toFixed(1) + ' ' + Y0 + 'Z'; } seg = []; }
    pr.forEach(function (p) { if (isFinite(p[1])) seg.push(p); else flush(); }); flush();
    s += '<path d="' + area + '" fill="#9BD3EA" fill-opacity=".6"/><path d="' + path + '" fill="none" stroke="#1F4E8C" stroke-width="2"/><line x1="' + X0 + '" y1="' + Y0 + '" x2="' + X1 + '" y2="' + Y0 + '" stroke="#2E6FBF" stroke-width="1.5"/>';
    s += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="none" stroke="' + INK + '"/>' + G.tx(X0, Y0 - 8, 'A', { fs: 13, fw: 800 }) + G.tx(X1, Y0 - 8, 'B', { fs: 13, fw: 800, anchor: 'end' });
    s += G.tx((X0 + X1) / 2, Y1 + 36, 'Distance from A (' + unit + ')', { fs: 11.5, fw: 700, anchor: 'middle' }) + G.tx(22, (Y0 + Y1) / 2, r.cal ? 'Depth (m)' : 'Relative depth (0–1)', { fs: 11.5, fw: 700, anchor: 'middle', rot: -90 });
    s += '<line x1="' + X0 + '" y1="' + (Y1 + 58) + '" x2="' + (X0 + 22) + '" y2="' + (Y1 + 58) + '" stroke="#2E6FBF" stroke-width="1.5"/>' + G.tx(X0 + 30, Y1 + 62, 'Water surface on ' + r.sc.date, { fs: 11 }) + '<line x1="' + (X0 + 240) + '" y1="' + (Y1 + 58) + '" x2="' + (X0 + 262) + '" y2="' + (Y1 + 58) + '" stroke="#1F4E8C" stroke-width="2"/>' + G.tx(X0 + 270, Y1 + 62, 'Bottom from the image · gaps: no valid water value', { fs: 11 });
    svg.innerHTML = s;
  }

  /* ------------------------------------------------------------ exports */
  function fname(ext) { return 'shandal-bathymetry-' + (nm() || 'area').replace(/[^\w-]+/g, '-').toLowerCase() + '-' + R.sc.date + '.' + ext; }
  function tiff(r) {
    var W0 = r.w, H0 = r.h, n = W0 * H0, data = new Float32Array(n); for (var i = 0; i < n; i++) data[i] = r.water[i] && isFinite(r.Z[i]) ? r.Z[i] : NaN;
    var ascii = 'nan\0', tags = [[256, 3, 1, W0], [257, 3, 1, H0], [258, 3, 1, 32], [259, 3, 1, 1], [262, 3, 1, 1], [273, 4, 1, 0], [277, 3, 1, 1], [278, 3, 1, H0], [279, 4, 1, n * 4], [284, 3, 1, 1], [339, 3, 1, 3], [33550, 12, 3, null], [33922, 12, 6, null], [34735, 3, 16, null], [42113, 2, ascii.length, null]];
    var ifdOff = 8, ifdLen = 2 + tags.length * 12 + 4, ext = Math.ceil((ifdOff + ifdLen) / 8) * 8, scaleOff = ext, tieOff = scaleOff + 24, gkOff = tieOff + 48, dataOff = gkOff + 32, total = dataOff + n * 4;
    var buf = new ArrayBuffer(total), v = new DataView(buf); v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, ifdOff, true); v.setUint16(ifdOff, tags.length, true);
    tags.forEach(function (tg, k) { var p = ifdOff + 2 + k * 12; v.setUint16(p, tg[0], true); v.setUint16(p + 2, tg[1], true); v.setUint32(p + 4, tg[2], true);
      var val = tg[0] === 273 ? dataOff : tg[0] === 33550 ? scaleOff : tg[0] === 33922 ? tieOff : tg[0] === 34735 ? gkOff : tg[3];
      if (tg[0] === 42113) { for (var c = 0; c < 4; c++) v.setUint8(p + 8 + c, ascii.charCodeAt(c)); } else if (tg[1] === 3 && tg[2] === 1) v.setUint16(p + 8, val, true); else v.setUint32(p + 8, val, true); });
    v.setUint32(ifdOff + 2 + tags.length * 12, 0, true);
    var a = r.a; [(a.e - a.w) / W0, (a.n - a.s) / H0, 0].forEach(function (x, k) { v.setFloat64(scaleOff + 8 * k, x, true); });
    [0, 0, 0, a.w, a.n, 0].forEach(function (x, k) { v.setFloat64(tieOff + 8 * k, x, true); });
    [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, 4326].forEach(function (x, k) { v.setUint16(gkOff + 2 * k, x, true); });
    new Float32Array(buf, dataOff, n).set(data); return new Blob([buf], { type: 'image/tiff' });
  }
  function need() { if (!R) { SH.toast(t('Map the depths first.', 'ارسم الأعماق أولاً.'), 'warn'); return false; } return true; }
  $('#bTif').addEventListener('click', function () { if (!need()) return; SH.saveFile(tiff(R), fname('tif'), 'image/tiff'); SH.toast(R.cal ? t('GeoTIFF: depth in metres, 32-bit, WGS 84; no data = NaN.', 'GeoTIFF: العمق بالأمتار، 32 بت، WGS 84؛ وغياب القيمة = NaN.') : t('GeoTIFF: relative depth index 0–1, WGS 84.', 'GeoTIFF: مؤشر العمق النسبي 0–1، WGS 84.'), 'ok'); });
  $('#bXyz').addEventListener('click', function () {
    if (!need()) return; var r = R, a = r.a, step = Math.max(1, Math.ceil(Math.sqrt(r.nZ / 150000))), rows = [['latitude', 'longitude', r.cal ? 'depth_m' : 'relative_depth_0_1', 'beyond_reliable_range']];
    for (var y = 0; y < r.h; y += step) for (var x = 0; x < r.w; x += step) { var i = y * r.w + x, z = r.Z[i]; if (!r.water[i] || !isFinite(z)) continue; rows.push([(a.n - (y + 0.5) / r.h * (a.n - a.s)).toFixed(6), (a.w + (x + 0.5) / r.w * (a.e - a.w)).toFixed(6), F(z, r.cal ? 2 : 3), r.cal && z > r.dmax ? 1 : 0]); }
    SH.csv(fname('csv'), rows);
  });
  $('#bPtsCsv').addEventListener('click', function () { if (!need()) return; var rows = [['latitude', 'longitude', 'known_depth_m', 'pSDB_green', 'pSDB_red', 'mapped_depth_m', 'residual_m']]; R.used.forEach(function (u) { rows.push([u.p.lat.toFixed(6), u.p.lon.toFixed(6), u.p.d, isFinite(u.g) ? u.g.toFixed(4) : '', isFinite(u.r) ? u.r.toFixed(4) : '', isFinite(u.z) ? F(u.z, 2) : '', isFinite(u.z) ? F(u.z - u.p.d, 2) : '']); }); SH.csv('shandal-bathymetry-known-depths.csv', rows); });

  ptsUI(); figProf();
})();
