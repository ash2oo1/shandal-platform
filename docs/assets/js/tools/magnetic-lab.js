/* Regional magnetic lab — IGRF-14 reference grids (F, D, I, H, Z, SV), point calculator, and ground-survey reduction:
   diurnal drift removal from base-station readings, residual anomaly ΔT = T_obs − δT_diurnal − F_IGRF, kriged anomaly map. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, D = SH.dem, M = SH.igrf;
  var persist = SH.persist('maglab', ['mDate', 'mAlt', 'mN', 'mS', 'mW', 'mE', 'mStep', 'mComp', 'pLat', 'pLon', 'sData', 'sBase']);
  if (!$('#mDate').value) $('#mDate').value = new Date().toISOString().slice(0, 10);
  var map = SH.map('mMap', { zoom: 5, base: 'light' }), rect = null, ovl = null, ptsLayer = null, drawer = null, G = null, CS = null, step = 0, mode = 'grid', S = null;
  var COMP = { F: ['F', 'nT', t('Total intensity', 'الشدة الكلية')], D: ['D', '°', t('Declination', 'الانحراف')], I: ['I', '°', t('Inclination', 'الميل')], H: ['H', 'nT', t('Horizontal intensity', 'الشدة الأفقية')], Z: ['Z', 'nT', t('Vertical intensity', 'الشدة الرأسية')], svF: ['dF/dt', 'nT/yr', t('Secular variation of F', 'التغير القرني لـ F')] };
  var year = function () { var d = new Date(SH.val('mDate') || Date.now()); return M.decimalYear(isNaN(d) ? new Date() : d); };

  document.addEventListener('click', function (e) { if (!e.target.closest('#mMode button')) return; setTimeout(function () { mode = SH.seg('mMode'); $('#mGridSide').hidden = mode !== 'grid'; $('#mSurvSide').hidden = mode === 'grid'; }, 0); });

  /* ---------- point calculator */
  function point() {
    var la = SH.num('pLat'), lo = SH.num('pLon'); if (isNaN(la) || isNaN(lo)) return;
    M.load().then(function () { var f = M.field(la, lo, SH.num('mAlt') || 0, year()), r = function (k, v) { return '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:2px 0"><span class="muted">' + k + '</span><b class="ltr">' + v + '</b></div>'; };
      $('#pOut').innerHTML = r('F', SH.fmt(f.F, 1) + ' nT') + r('H', SH.fmt(f.H, 1) + ' nT') + r('X · Y · Z', SH.fmt(f.X, 0) + ' · ' + SH.fmt(f.Y, 0) + ' · ' + SH.fmt(f.Z, 0) + ' nT') + r(t('Declination D', 'الانحراف D'), SH.fmt(f.D, 2) + '° ' + (f.D >= 0 ? 'E' : 'W')) + r(t('Inclination I', 'الميل I'), SH.fmt(f.I, 2) + '°') +
        r(t('Annual change', 'التغير السنوي'), 'F ' + (f.sv.F >= 0 ? '+' : '') + SH.fmt(f.sv.F, 1) + ' nT · D ' + (f.sv.D >= 0 ? '+' : '') + SH.fmt(f.sv.D, 1) + '′') +
        '<p class="xsmall muted" style="margin:6px 0 0">' + t('Set your compass declination to ', 'اضبط انحراف البوصلة على ') + SH.fmt(Math.abs(f.D), 1) + '° ' + (f.D >= 0 ? t('east', 'شرقاً') : t('west', 'غرباً')) + t(' to read true bearings.', ' لقراءة الاتجاهات الحقيقية.') + '</p>'; });
  }
  ['pLat', 'pLon', 'mDate', 'mAlt'].forEach(function (id) { $('#' + id).addEventListener('change', function () { persist.save(); point(); }); });
  if (map) map.on('click', function (e) { if (drawer && drawer.active) return; $('#pLat').value = e.latlng.lat.toFixed(4); $('#pLon').value = e.latlng.lng.toFixed(4); point(); });

  /* ---------- reference grid */
  function bounds() { var b = { n: SH.num('mN'), s: SH.num('mS'), w: SH.num('mW'), e: SH.num('mE') }; return [b.n, b.s, b.w, b.e].some(isNaN) || b.n <= b.s || b.e <= b.w ? null : b; }
  function setBounds(b, fit) { $('#mN').value = b.n.toFixed(3); $('#mS').value = b.s.toFixed(3); $('#mW').value = b.w.toFixed(3); $('#mE').value = b.e.toFixed(3); persist.save(); show(fit); }
  function show(fit) { var b = bounds(); if (!b) return; if (map) { if (rect) rect.setBounds([[b.s, b.w], [b.n, b.e]]); else rect = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: SH.css('--accent'), weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map); if (fit) map.fitBounds(rect.getBounds(), { padding: [30, 30] }); }
    var st = SH.num('mStep') || 0.05, nx = Math.round((b.e - b.w) / st) + 1, ny = Math.round((b.n - b.s) / st) + 1; $('#mEst').innerHTML = nx + ' × ' + ny + ' = <b>' + SH.fmt(nx * ny, 0) + '</b> ' + t('nodes', 'عقدة') + (nx * ny > 90000 ? ' · <span style="color:var(--danger)">' + t('limit 90,000', 'الحد 90,000') + '</span>' : ''); }
  ['mN', 'mS', 'mW', 'mE', 'mStep'].forEach(function (id) { $('#' + id).addEventListener('change', function () { show(id !== 'mStep'); }); });
  $('#mDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#mHint')); });
  $('#mView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  function runGrid() {
    var b = bounds(); if (!b) { SH.toast(t('Mark the survey area first.', 'حدد منطقة المسح أولاً.'), 'warn'); return; }
    var st = SH.num('mStep') || 0.05, nx = Math.round((b.e - b.w) / st) + 1, ny = Math.round((b.n - b.s) / st) + 1; if (nx * ny > 90000) { SH.toast(t('Too many nodes. Increase the step.', 'عدد العقد كبير. زد الخطوة.'), 'warn'); return; }
    if (nx < 3 || ny < 3) { SH.toast(t('Area smaller than three steps.', 'المنطقة أصغر من ثلاث خطوات.'), 'warn'); return; }
    persist.save(); M.load().then(function () {
      var y = year(), alt = SH.num('mAlt') || 0, comp = SH.val('mComp'), Fz = {}; ['F', 'D', 'I', 'H', 'Z', 'X', 'Y', 'svF', 'svD'].forEach(function (k) { Fz[k] = new Float32Array(nx * ny); });
      var bb = { n: b.s + (ny - 1) * st, s: b.s, w: b.w, e: b.w + (nx - 1) * st };
      for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) { var f = M.field(bb.n - j * st, bb.w + i * st, alt, y), k = j * nx + i; Fz.F[k] = f.F; Fz.D[k] = f.D; Fz.I[k] = f.I; Fz.H[k] = f.H; Fz.Z[k] = f.Z; Fz.X[k] = f.X; Fz.Y[k] = f.Y; Fz.svF[k] = f.sv.F; Fz.svD[k] = f.sv.D; }
      G = mkGrid(bb, nx, ny, st, Fz[comp]); G.all = Fz; G.comp = comp; G.year = y; G.kind = 'ref'; contourAndRender();
    }).catch(function (e) { SH.toast(e.message, 'bad'); });
  }
  function mkGrid(bb, nx, ny, st, z) { var m = D.metersPerDeg((bb.n + bb.s) / 2), g = { nx: nx, ny: ny, b: bb, z: z, lats: [], lons: [], dx: st * m.x, dy: st * m.y, dd: st }; for (var j = 0; j < ny; j++) g.lats.push(bb.n - j * st); for (var i = 0; i < nx; i++) g.lons.push(bb.w + i * st); D.stats(g); D.derive(g); return g; }

  /* ---------- survey reduction */
  var hm = function (s) { var m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s || ''); return m ? +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0) : NaN; };
  function parseRows(txt) { return txt.replace(/\r/g, '').split('\n').map(function (l) { return l.split(/[,;\t]/).map(function (c) { return c.trim(); }); }).filter(function (c) { return c.length >= 3 && !isNaN(parseFloat(c[0])) && !isNaN(parseFloat(c[2])); }); }
  $('#sFile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { $('#sData').value = r.result; persist.save(); }; r.readAsText(f); });
  function runSurvey() {
    var rows = parseRows(SH.val('sData')); if (rows.length < 5) { SH.toast(t('Enter at least five readings: lat, lon, F.', 'أدخل خمس قراءات على الأقل: عرض، طول، F.'), 'warn'); return; }
    var base = SH.val('sBase').replace(/\r/g, '').split('\n').map(function (l) { var p = l.split(/[,;\t]/); return { t: hm(p[0]), F: parseFloat(p[1]) }; }).filter(function (b) { return !isNaN(b.t) && !isNaN(b.F); }).sort(function (a, b) { return a.t - b.t; });
    var bmean = base.length ? base.reduce(function (a, b) { return a + b.F; }, 0) / base.length : 0;
    var drift = function (tm) { if (base.length < 2 || isNaN(tm)) return 0; if (tm <= base[0].t) return base[0].F - bmean; if (tm >= base[base.length - 1].t) return base[base.length - 1].F - bmean; for (var k = 1; k < base.length; k++) if (tm <= base[k].t) { var f = (tm - base[k - 1].t) / (base[k].t - base[k - 1].t); return base[k - 1].F + f * (base[k].F - base[k - 1].F) - bmean; } return 0; };
    persist.save();
    M.load().then(function () {
      var y = year(), alt = SH.num('mAlt') || 0;
      var P = rows.map(function (r) { var la = parseFloat(r[0]), lo = parseFloat(r[1]), F = parseFloat(r[2]), tm = hm(r[3]), ref = M.field(la, lo, alt, y).F, dc = drift(tm); return { lat: la, lon: lo, F: F, time: r[3] || '', ref: ref, dc: dc, dT: F - dc - ref }; });
      var la = P.map(function (p) { return p.lat; }), lo = P.map(function (p) { return p.lon; }), s0 = Math.min.apply(null, la), n0 = Math.max.apply(null, la), w0 = Math.min.apply(null, lo), e0 = Math.max.apply(null, lo), pd = Math.max(n0 - s0, e0 - w0) * 0.05 || 0.001;
      var b = { n: n0 + pd, s: s0 - pd, w: w0 - pd, e: e0 + pd }, m = D.metersPerDeg((b.n + b.s) / 2), wM = (b.e - b.w) * m.x, hM = (b.n - b.s) * m.y, res = 110, nx = wM >= hM ? res : Math.max(20, Math.round(res * wM / hM)), ny = hM > wM ? res : Math.max(20, Math.round(res * hM / wM));
      var Gm = D.interp(P.map(function (p) { return { x: (p.lon - b.w) * m.x, y: (p.lat - b.s) * m.y, z: p.dT }; }), { n: hM, s: 0, w: 0, e: wM }, nx, ny, { method: P.length <= 800 ? 'kriging' : 'idw' });
      var g = { nx: nx, ny: ny, b: b, z: Gm.z, dx: wM / (nx - 1), dy: hM / (ny - 1), lats: [], lons: [], method: Gm.method }; for (var j = 0; j < ny; j++) g.lats.push(b.n - (b.n - b.s) * j / (ny - 1)); for (var i = 0; i < nx; i++) g.lons.push(b.w + (b.e - b.w) * i / (nx - 1));
      g.full = { nx: nx, ny: ny, b: b, z: new Float32Array(g.z), dx: g.dx, dy: g.dy }; D.derive(g.full);
      var H = hull(P); for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) if (!inPoly(g.lons[i], g.lats[j], H)) g.z[j * nx + i] = NaN; g.hull = H;
      D.stats(g); var a = Math.max(Math.abs(g.min), Math.abs(g.max)); g.min = -a; g.max = a; D.derive(g);
      G = g; G.kind = 'anom'; G.year = y; S = { P: P, base: base, bmean: bmean }; contourAndRender();
    }).catch(function (e) { SH.toast(e.message, 'bad'); });
  }
  function hull(pts) { var p = pts.map(function (q) { return [q.lon, q.lat]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }, lo = [], up = [];
    p.forEach(function (q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }); for (var i = p.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); } up.pop(); lo.pop(); return lo.concat(up); }
  function inPoly(x, y, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

  function contourAndRender() {
    var rz = G.max - G.min; step = D.niceInterval(rz, G.kind === 'anom' ? 16 : 12); CS = D.contours(G, D.levels(G, step)); render();
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function render() {
    $('#mEmpty').hidden = true; $('#mOut').hidden = false; var anom = G.kind === 'anom', c = anom ? ['ΔT', 'nT', t('Residual anomaly', 'الشذوذ المتبقي')] : COMP[G.comp], dp = c[1] === '°' ? 2 : 0;
    if (anom) { var dt = S.P.map(function (p) { return p.dT; }), mn = Math.min.apply(null, dt), mx = Math.max.apply(null, dt), sd = Math.sqrt(dt.reduce(function (a, v) { return a + v * v; }, 0) / dt.length - Math.pow(dt.reduce(function (a, v) { return a + v; }, 0) / dt.length, 2));
      $('#mKpis').innerHTML = kpi('info', t('Readings', 'القراءات'), S.P.length, S.base.length ? S.base.length + t(' base readings', ' قراءة أساس') : t('no diurnal correction', 'دون تصحيح يومي')) + kpi('', t('Mean IGRF F', 'متوسط F المرجعي'), SH.fmt(S.P.reduce(function (a, p) { return a + p.ref; }, 0) / S.P.length, 1) + '<small> nT</small>', 'IGRF-14 · ' + SH.fmt(G.year, 2)) +
        kpi(mx > 0 ? 'bad' : '', t('Max anomaly', 'أقصى شذوذ'), '+' + SH.fmt(mx, 1) + '<small> nT</small>', '') + kpi(mn < 0 ? 'info' : '', t('Min anomaly', 'أدنى شذوذ'), SH.fmt(mn, 1) + '<small> nT</small>', '') + kpi('', t('Std. deviation', 'الانحراف المعياري'), SH.fmt(sd, 1) + '<small> nT</small>', G.method === 'kriging' ? t('kriged map', 'خريطة كريجنغ') : 'IDW');
    } else { var f0 = G.all[G.comp];
      $('#mKpis').innerHTML = kpi('info', c[2], SH.fmt(G.min, dp) + ' – ' + SH.fmt(G.max, dp) + '<small> ' + c[1] + '</small>', 'IGRF-14 · ' + SH.fmt(G.year, 2)) + kpi('', t('Grid', 'الشبكة'), G.nx + ' × ' + G.ny, G.dd + '° · ' + SH.fmt(G.dx / 1000, 1) + ' km') +
        kpi('', t('Mean F', 'متوسط F'), SH.fmt(avg(G.all.F), 0) + '<small> nT</small>', '') + kpi('', t('Mean D · I', 'متوسط D · I'), SH.fmt(avg(G.all.D), 2) + '° · ' + SH.fmt(avg(G.all.I), 2) + '°', '') + kpi('', t('Mean dF/dt', 'متوسط dF/dt'), SH.fmt(avg(G.all.svF), 1) + '<small> nT/yr</small>', ''); }
    var pts = anom ? S.P.map(function (p) { return { x: p.lon, y: p.lat }; }) : [];
    D.svgMap($('#mSvg'), G, CS, { crs: 'geo', interval: step, index: 5, ramp: anom ? 'diverge' : 'spectral', shade: false, smooth: true, title: anom ? t('Residual total-field anomaly', 'شذوذ الشدة الكلية المتبقي') : c[2] + ' (' + c[0] + ')', subtitle: 'IGRF-14 · ' + t('epoch ', 'الزمن ') + SH.fmt(G.year, 2) + ' · ' + t('height ', 'الارتفاع ') + (SH.num('mAlt') || 0) + ' km',
      legendTitle: c[0] + ' (' + c[1] + ')', unit: ' ' + c[1], points: pts, renderGrid: anom ? G.full : null, clipPoly: anom ? G.hull : null, credit: 'Shandal System · IGRF-14 (IAGA 2024)' });
    $('#mCap').innerHTML = anom ? t('ΔT = T<sub>obs</sub> − δT<sub>diurnal</sub> − F<sub>IGRF</sub>. Positive anomalies (red) often mark magnetite-bearing bodies, mafic intrusions or basement highs; negative lows (blue) mark the paired flank of an induced anomaly at mid latitudes, non-magnetic sediments or remanence.', 'ΔT = T<sub>المقاس</sub> − δT<sub>اليومي</sub> − F<sub>IGRF</sub>. غالباً ما تدل الشذوذات الموجبة (الحمراء) على أجسام حاملة للمغنتايت أو متداخلات قاعدية أو مرتفعات القاعدة؛ والسالبة (الزرقاء) على الجناح المزدوج للشذوذ المستحث في العروض الوسطى أو رواسب غير مغناطيسية أو مغناطيسية متبقية.') :
      t('Contour interval ', 'الفاصل الكنتوري ') + step + ' ' + c[1] + '. ' + t('Spherical-harmonic synthesis to degree 13, geodetic coordinates on WGS 84.', 'تركيب توافقيات كروية حتى الدرجة 13، بإحداثيات جيوديسية على WGS 84.');
    if (map) { if (ovl) map.removeLayer(ovl); if (ptsLayer) map.removeLayer(ptsLayer); var RG = anom ? Object.assign({}, G.full, { min: G.min, max: G.max }) : G; ovl = L.imageOverlay(D.render(RG, { ramp: anom ? 'diverge' : 'spectral', shade: false }), [[G.b.s, G.b.w], [G.b.n, G.b.e]], { opacity: .65 }).addTo(map);
      if (anom) { ptsLayer = L.layerGroup().addTo(map); S.P.forEach(function (p) { L.circleMarker([p.lat, p.lon], { radius: 3, color: '#111', weight: 1, fillOpacity: .8 }).bindTooltip(SH.fmt(p.dT, 1) + ' nT').addTo(ptsLayer); }); }
      map.fitBounds(ovl.getBounds(), { padding: [20, 20] }); }
    $('#mTblPn').hidden = !anom;
    if (anom) $('#mTbl').innerHTML = '<thead><tr><th>#</th><th class="num">Lat</th><th class="num">Lon</th><th>' + t('Time', 'الوقت') + '</th><th class="num">T<sub>obs</sub></th><th class="num">δT<sub>d</sub></th><th class="num">F<sub>IGRF</sub></th><th class="num">ΔT</th></tr></thead><tbody>' + S.P.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td class="num">' + p.lat.toFixed(5) + '</td><td class="num">' + p.lon.toFixed(5) + '</td><td>' + SH.esc(p.time) + '</td><td class="num">' + SH.fmt(p.F, 1) + '</td><td class="num">' + SH.fmt(p.dc, 1) + '</td><td class="num">' + SH.fmt(p.ref, 1) + '</td><td class="num"><b>' + SH.fmt(p.dT, 1) + '</b></td></tr>'; }).join('') + '</tbody>';
  }
  var avg = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
  $('#mComp').addEventListener('change', function () { persist.save(); if (G && G.kind === 'ref') { var g = mkGrid(G.b, G.nx, G.ny, G.dd, G.all[SH.val('mComp')]); g.all = G.all; g.comp = SH.val('mComp'); g.year = G.year; g.kind = 'ref'; G = g; contourAndRender(); } });

  $('#mPng').addEventListener('click', function () { if (G) SH.svgPng($('#mSvg'), 'shandal-magnetic-map.png', 2.5, '#ffffff'); });
  $('#mGrd').addEventListener('click', function () {
    if (!G) return; var Z = G.kind === 'anom' ? G.z : G.z, out = ['DSAA', G.nx + ' ' + G.ny, G.b.w.toFixed(6) + ' ' + G.b.e.toFixed(6), G.b.s.toFixed(6) + ' ' + G.b.n.toFixed(6)], mn = Infinity, mx = -Infinity;
    for (var k = 0; k < Z.length; k++) if (!isNaN(Z[k])) { mn = Math.min(mn, Z[k]); mx = Math.max(mx, Z[k]); } out.push(mn.toFixed(3) + ' ' + mx.toFixed(3));
    for (var j = G.ny - 1; j >= 0; j--) { var r = []; for (var i = 0; i < G.nx; i++) { var v = Z[j * G.nx + i]; r.push(isNaN(v) ? '1.70141e+038' : v.toFixed(3)); } out.push(r.join(' ')); }
    SH.download('shandal-magnetic-' + (G.kind === 'anom' ? 'anomaly' : G.comp) + '.grd', out.join('\n'), 'text/plain');
  });
  $('#mCsv').addEventListener('click', function () {
    if (!G) return; if (G.kind === 'anom') { SH.csv('shandal-magnetic-reduced.csv', [['lat', 'lon', 'time', 'T_obs_nT', 'diurnal_nT', 'IGRF_F_nT', 'dT_nT']].concat(S.P.map(function (p) { return [p.lat, p.lon, p.time, p.F, p.dc.toFixed(2), p.ref.toFixed(2), p.dT.toFixed(2)]; }))); return; }
    var o = [['lon', 'lat', 'F_nT', 'H_nT', 'X_nT', 'Y_nT', 'Z_nT', 'D_deg', 'I_deg', 'dF_dt_nT_yr', 'dD_dt_min_yr']]; for (var j = 0; j < G.ny; j++) for (var i = 0; i < G.nx; i++) { var k = j * G.nx + i, a = G.all; o.push([G.lons[i].toFixed(4), G.lats[j].toFixed(4), a.F[k].toFixed(1), a.H[k].toFixed(1), a.X[k].toFixed(1), a.Y[k].toFixed(1), a.Z[k].toFixed(1), a.D[k].toFixed(3), a.I[k].toFixed(3), a.svF[k].toFixed(2), a.svD[k].toFixed(2)]); }
    SH.csv('shandal-igrf14-grid.csv', o);
  });
  $('#mRun').addEventListener('click', runGrid); $('#sRun').addEventListener('click', runSurvey);
  $('#mDemo').addEventListener('click', function () { $('#mStep').value = 0.1; setBounds({ n: 38, s: 29, w: 38, e: 49 }, true); runGrid(); });
  $('#sDemo').addEventListener('click', function () {
    var c = [33.45, 44.10], s = 5, rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; }, out = ['lat,lon,F_nT,time'];
    M.load().then(function () { var y = year(); for (var k = 0; k < 90; k++) { var la = c[0] + (Math.floor(k / 10) * 0.004) + (rnd() - .5) * 0.0008, lo = c[1] + (k % 10) * 0.004 + (rnd() - .5) * 0.0008, dx = (lo - c[1] - 0.02) * 92, dy = (la - c[0] - 0.016) * 111, r2 = dx * dx + dy * dy, tm = 540 + k * 2.5;
        var anom = 180 * Math.exp(-r2 / 0.5) - 70 * Math.exp(-(Math.pow(dx, 2) + Math.pow(dy + 0.9, 2)) / 0.6) + (rnd() - .5) * 4, diur = 6 * Math.sin((tm - 540) / 230);
        out.push(la.toFixed(5) + ',' + lo.toFixed(5) + ',' + (M.field(la, lo, 0.04, y).F + anom + diur).toFixed(1) + ',' + String(Math.floor(tm / 60)).padStart(2, '0') + ':' + String(Math.floor(tm % 60)).padStart(2, '0')); }
      $('#sData').value = out.join('\n'); $('#mAlt').value = 0.04; var bm = 46900; $('#sBase').value = [540, 600, 660, 720, 780].map(function (tm) { return String(Math.floor(tm / 60)).padStart(2, '0') + ':' + String(tm % 60).padStart(2, '0') + ', ' + (bm + 6 * Math.sin((tm - 540) / 230)).toFixed(1); }).join('\n'); runSurvey(); });
  });
  document.addEventListener('sh:beforereport', function (e) { if (!G) { e.preventDefault(); SH.toast(t('Compute a map first.', 'احسب خريطة أولاً.'), 'warn'); } });
  show(true); point();
  window.__shMagMode = function (m) { var b = SH.$('#mMode button[data-v="' + m + '"]'); if (b) b.click(); };
})();
