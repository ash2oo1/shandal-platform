/* DEM data hub — regular elevation grids (UTM or geographic) from AWS Terrain Tiles or Copernicus GLO-90, with 3D preview,
   hypsometry, slope statistics and exports to CSV, XYZ, ESRI ASCII grid and shaded relief. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, D = SH.dem;
  var persist = SH.persist('demhub', ['dN', 'dS', 'dW', 'dE', 'dSrc', 'dCrs', 'dStep']);
  var map = SH.map('dMap', { zoom: 6, base: 'topo' }), rect = null, overlay = null, G = null, drawer = null;
  var LIM = { aws: 360000, cop: 3000 };

  function bounds() { var b = { n: SH.num('dN'), s: SH.num('dS'), w: SH.num('dW'), e: SH.num('dE') }; return [b.n, b.s, b.w, b.e].some(isNaN) || b.n <= b.s || b.e <= b.w ? null : b; }
  function setBounds(b, fit) {
    $('#dN').value = b.n.toFixed(5); $('#dS').value = b.s.toFixed(5); $('#dW').value = b.w.toFixed(5); $('#dE').value = b.e.toFixed(5); persist.save(); show(fit);
  }
  function show(fit) {
    var b = bounds(); if (!b || !map) { estimate(); return; }
    if (rect) rect.setBounds([[b.s, b.w], [b.n, b.e]]); else rect = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: SH.css('--accent'), weight: 2, fillOpacity: .06, dashArray: '6 4' }).addTo(map);
    if (fit) map.fitBounds(rect.getBounds(), { padding: [30, 30] }); estimate();
  }
  function estimate() {
    var b = bounds(), st = SH.num('dStep'), src = SH.val('dSrc');
    if (!b || !(st > 0)) { $('#dEst').textContent = '—'; $('#dArea').textContent = t('Draw a rectangle or type the bounds.', 'ارسم مستطيلاً أو اكتب الحدود.'); return null; }
    var P = D.plan(b, SH.val('dCrs'), st), n = P.nx * P.ny, m = D.metersPerDeg((b.n + b.s) / 2), w = (b.e - b.w) * m.x / 1000, h = (b.n - b.s) * m.y / 1000;
    $('#dArea').innerHTML = SH.fmt(w, 2) + ' × ' + SH.fmt(h, 2) + ' km · ' + SH.fmt(w * h, 2) + ' km²' + (P.crs === 'utm' ? ' · UTM ' + P.zone + (P.south ? 'S' : 'N') : '');
    var ok = n <= LIM[src];
    $('#dEst').innerHTML = '<b>' + SH.fmt(P.nx, 0) + ' × ' + SH.fmt(P.ny, 0) + ' = ' + SH.fmt(n, 0) + '</b> ' + t('nodes', 'عقدة') + (ok ? '' : ' · <span style="color:var(--danger)">' + t('too many for this source; increase the spacing (limit ', 'كثيرة على هذا المصدر؛ زد التباعد (الحد ') + SH.fmt(LIM[src], 0) + ')</span>') +
      (src === 'cop' && SH.num('dStep') < 90 ? '<br>' + t('Copernicus is 90 m data: spacing below 90 m only interpolates.', 'بيانات Copernicus بدقة 90 م: التباعد الأقل من 90 م مجرد استيفاء.') : '');
    return ok ? P : null;
  }
  ['dN', 'dS', 'dW', 'dE'].forEach(function (id) { $('#' + id).addEventListener('change', function () { show(true); }); });
  ['dStep', 'dSrc', 'dCrs'].forEach(function (id) { $('#' + id).addEventListener('input', estimate); $('#' + id).addEventListener('change', estimate); });
  $('#dDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); if (rect) { map.removeLayer(rect); rect = null; } drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#dHint')); });
  $('#dView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  function run() {
    var b = bounds(), P = estimate(), btn = $('#dRun'), src = SH.val('dSrc'), host = $('#dMap').parentElement;
    if (!b) { SH.toast(t('Mark the area first.', 'حدد المنطقة أولاً.'), 'warn'); return; }
    if (!P) { SH.toast(t('Too many grid nodes. Increase the spacing or shrink the area.', 'عدد عقد الشبكة كبير. زد التباعد أو صغّر المنطقة.'), 'warn'); return; }
    if (P.nx < 3 || P.ny < 3) { SH.toast(t('The area is smaller than three grid cells. Reduce the spacing.', 'المنطقة أصغر من ثلاث خلايا. قلّل التباعد.'), 'warn'); return; }
    btn.disabled = true; SH.busy(host, true, t('Fetching elevations…', 'جارٍ جلب الارتفاعات…')); persist.save();
    D.build(b, SH.val('dCrs'), SH.num('dStep'), src, function (k, n) { SH.busy(host, true, t('Fetching elevations… ', 'جارٍ جلب الارتفاعات… ') + Math.round(100 * k / n) + ' %'); })
      .then(function (g) { G = g; D.derive(G); render(); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy(host, false); });
  }

  function render() {
    $('#dEmpty').hidden = true; $('#dOut').hidden = false;
    var n = G.nx * G.ny, sl = 0, c = 0, sorted = [], sArr = [];
    for (var k = 0; k < n; k++) { if (isNaN(G.z[k])) continue; sl += G.slope[k]; c++; sorted.push(G.z[k]); sArr.push(G.slope[k]); }
    sorted.sort(function (a, b) { return a - b; });
    var HI = (G.mean - G.min) / ((G.max - G.min) || 1);
    G.stat = { meanSlope: sl / c, HI: HI, nodata: n - c };
    $('#dKpis').innerHTML = kpi('info', t('Grid nodes', 'عقد الشبكة'), SH.fmt(n, 0), G.nx + ' × ' + G.ny + ' · ' + (G.crs === 'utm' ? SH.fmt(G.step, 0) + ' m' : SH.fmt(G.dd * 3600, 2) + '″')) +
      kpi('', t('Minimum', 'الأدنى'), SH.fmt(G.min, 1) + '<small> m</small>', '') + kpi('', t('Maximum', 'الأعلى'), SH.fmt(G.max, 1) + '<small> m</small>', '') +
      kpi('', t('Relief', 'التضرس'), SH.fmt(G.max - G.min, 1) + '<small> m</small>', t('mean ', 'المتوسط ') + SH.fmt(G.mean, 1) + ' m') +
      kpi(G.stat.meanSlope > 20 ? 'warn' : '', t('Mean slope', 'متوسط الميل'), SH.fmt(G.stat.meanSlope, 1) + '<small>°</small>', 'HI = ' + SH.fmt(HI, 3));
    $('#dMeta').innerHTML = (G.crs === 'utm' ? 'WGS 84 / UTM ' + G.zone + (G.south ? 'S' : 'N') + ' (EPSG:' + (G.south ? 327 : 326) + String(G.zone).padStart(2, '0') + ')' : 'WGS 84 (EPSG:4326)') + ' · ' + t('Source: ', 'المصدر: ') + D.sources[G.source].attr + (G.zoom ? ' · z' + G.zoom + ' ≈ ' + SH.fmt(G.pixel, 1) + ' m/px' : '') + (G.stat.nodata ? ' · ' + G.stat.nodata + t(' empty nodes', ' عقدة فارغة') : '');
    if (map) { if (overlay) map.removeLayer(overlay); overlay = L.layerGroup().addTo(map); L.imageOverlay(D.render(G, { ramp: 'hypso' }), [[G.geo.s, G.geo.w], [G.geo.n, G.geo.e]], { opacity: .8 }).addTo(overlay);
      var cs0 = contoursFor(), rnd = L.canvas({ padding: .3 }); cs0.cs.forEach(function (c) { var isI = Math.round(c.level / cs0.step) % 5 === 0; c.lines.forEach(function (ln) { if (ln.length < 2) return; L.polyline(D.smooth(ln, 2).map(function (q) { return toLL(q[0], q[1]); }), { renderer: rnd, color: isI ? '#4A2E17' : '#7E5636', weight: isI ? 1.8 : .8, opacity: .95 }).bindTooltip(SH.fmt(c.level, cs0.step < 1 ? 1 : 0) + ' m', { sticky: true }).addTo(overlay); }); });
      map.fitBounds([[G.geo.s, G.geo.w], [G.geo.n, G.geo.e]], { padding: [20, 20] }); }
    sheet();
    draw3d();
    // hypsometric curve (Strahler 1952): relative area above each relative height
    var hx = [], hy = []; for (var q = 0; q <= 50; q++) { var a = q / 50, idx = Math.floor((1 - a) * (sorted.length - 1)); hx.push(a); hy.push((sorted[idx] - G.min) / ((G.max - G.min) || 1)); }
    var p = SH.palette();
    SH.plot('dHyp', [{ x: hx, y: hy, mode: 'lines', line: { color: p.accent, width: 2.5 }, fill: 'tozeroy', fillcolor: SH.alpha(p.accent, .12), hovertemplate: 'a/A %{x:.2f} · h/H %{y:.2f}<extra></extra>' }], function () { return SH.plotLayout({ margin: { l: 50, r: 10, t: 10, b: 40 }, showlegend: false, xaxis: { title: { text: t('Relative area a/A', 'المساحة النسبية a/A') }, range: [0, 1] }, yaxis: { title: { text: 'h/H' }, range: [0, 1] } }); });
    var bins = new Array(18).fill(0); sArr.forEach(function (s) { bins[Math.min(17, Math.floor(s / 5))]++; });
    SH.plot('dSlope', [{ x: bins.map(function (_, i) { return i * 5 + 2.5; }), y: bins.map(function (b) { return 100 * b / sArr.length; }), mode: 'lines', line: { shape: 'hvh', color: p.text2, width: 1.5 }, fill: 'tozeroy', fillcolor: SH.alpha(p.text2, .15), hovertemplate: '%{x:.0f}° · %{y:.1f} %<extra></extra>' }], function () { return SH.plotLayout({ margin: { l: 50, r: 10, t: 10, b: 40 }, showlegend: false, xaxis: { title: { text: t('Slope (°)', 'الميل (°)') }, range: [0, 90] }, yaxis: { title: { text: '%' } } }); });
    $('#dHypCap').innerHTML = t('Hypsometric integral HI = ', 'التكامل الهبسومتري HI = ') + '<b>' + SH.fmt(HI, 3) + '</b> — ' + (HI > 0.6 ? t('convex curve, youthful and weakly eroded terrain (Strahler 1952).', 'منحنى محدب، تضاريس فتية ضعيفة التعرية (Strahler 1952).') : HI > 0.35 ? t('S-shaped curve, mature terrain in equilibrium (Strahler 1952).', 'منحنى على شكل S، تضاريس ناضجة في حالة توازن (Strahler 1952).') : t('concave curve, old and deeply eroded terrain (Strahler 1952).', 'منحنى مقعر، تضاريس هرمة شديدة التعرية (Strahler 1952).'));
    var rows = []; for (k = 0; k < Math.min(8, n); k++) { var j = Math.floor(k / G.nx), i = k % G.nx; rows.push('<tr><td class="num">' + (k + 1) + '</td><td class="num">' + xy(i, j)[0] + '</td><td class="num">' + xy(i, j)[1] + '</td><td class="num">' + (isNaN(G.z[k]) ? '—' : G.z[k].toFixed(2)) + '</td></tr>'); }
    $('#dTbl').innerHTML = '<thead><tr><th class="num">#</th><th class="num">' + (G.crs === 'utm' ? 'X (Easting)' : 'X (Lon)') + '</th><th class="num">' + (G.crs === 'utm' ? 'Y (Northing)' : 'Y (Lat)') + '</th><th class="num">Z (m)</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  }

  /* ---------- contours and printable map */
  var toLL = function (y, x) { if (G.crs === 'utm') { var q = SH.fromUTM(x, y, G.zone, G.south); return [q.lat, q.lon]; } return [y, x]; };
  function contoursFor() { var iv = SH.num('dmInt'), step = iv > 0 ? iv : D.niceInterval(G.max - G.min, 12); return { step: step, cs: D.contours(G, D.levels(G, step)) }; }
  function sheet() {
    if (!G) return; var st = SH.val('dmStyle') || 'relief', C = contoursFor(), withC = /relief$|contours|spotscont/.test(st) && st !== 'spotsrelief', withS = /^spots/.test(st), fill = /relief/.test(st);
    var spots = [];
    if (withS) { var sp = SH.num('dmSp'), wM = (G.nx - 1) * G.dx, kk = Math.max(1, Math.round((sp > 0 ? sp : wM / 14) / G.dx)), off = Math.floor(kk / 2);
      for (var j = off; j < G.ny; j += kk) for (var i = off; i < G.nx; i += kk) { var z = G.z[j * G.nx + i]; if (!isNaN(z)) spots.push({ x: G.lons[i], y: G.lats[j], v: z }); }
      // always include highest and lowest points
      var hi = 0, lo = 0; for (var k = 1; k < G.z.length; k++) { if (G.z[k] > G.z[hi]) hi = k; if (G.z[k] < G.z[lo]) lo = k; }
      [hi, lo].forEach(function (q) { var sx = G.lons[q % G.nx], sy = G.lats[Math.floor(q / G.nx)], r = kk * Math.abs(G.lons[1] - G.lons[0]) * .6; spots = spots.filter(function (p) { return Math.hypot(p.x - sx, p.y - sy) > r; }); spots.push({ x: sx, y: sy, v: G.z[q], key: true }); }); }
    var dp = +SH.val('dmDp') || 0;
    D.svgMap($('#dSheet'), G, withC ? C.cs : [], { crs: G.crs === 'utm' ? 'proj' : 'geo', interval: C.step, index: 5, ramp: 'hypso', fill: fill, labels: true, smooth: true, grid: true, noContours: !withC, spots: spots, spotDp: dp, spotSize: spots.length > 250 ? 7.5 : 8.5,
      title: SH.val('dmTitle') || (withS && !withC ? t('Spot-height map', 'خريطة نقاط الارتفاع') : t('Topographic map', 'خريطة طبوغرافية')), subtitle: (G.crs === 'utm' ? 'WGS 84 / UTM ' + G.zone + (G.south ? 'S' : 'N') : 'WGS 84') + (withC ? ' · ' + t('contour interval ', 'الفاصل الكنتوري ') + C.step + ' m' : '') + (withS ? ' · ' + spots.length + t(' spot heights', ' نقطة ارتفاع') : ''),
      legendTitle: t('Elevation (m)', 'الارتفاع (م)'), axisNames: G.crs === 'utm' ? ['Easting (m)', 'Northing (m)'] : null, source: G.source === 'cop' ? 'DEM: Copernicus GLO-90 (ESA)' : 'DEM: Terrain Tiles on AWS (SRTM and others)' });
    $('#dSheetCap').innerHTML = withS && !withC ? t('Exercise sheet: only spot heights are printed, so students can interpolate and draw the contour lines by hand. The highest and lowest points of the area are always included.', 'ورقة تمرين: تُطبع نقاط الارتفاع فقط ليستكمل الطلبة الاستيفاء ويرسموا خطوط الكنتور يدوياً. تُضمّن دائماً أعلى وأدنى نقطتين في المنطقة.') : t('Contours by marching squares on the fetched grid, smoothed for display; index contours every fifth line are labelled.', 'خطوط الكنتور بخوارزمية المربعات المتحركة على الشبكة المجلوبة، ممهّدة للعرض؛ يُرقَّم كل خط رئيسي خامس.');
  }
  ['dmStyle', 'dmInt', 'dmSp', 'dmDp', 'dmTitle'].forEach(function (id) { $('#' + id).addEventListener('change', function () { if (G) { if (id === 'dmInt') render(); else sheet(); } }); });
  $('#dMapPng').addEventListener('click', function () { if (G) SH.svgPng($('#dSheet'), 'shandal-map-' + (SH.val('dmStyle') || 'relief') + '.png', 3); });
  $('#dMapSvg').addEventListener('click', function () { if (G) SH.download('shandal-map-' + (SH.val('dmStyle') || 'relief') + '.svg', new XMLSerializer().serializeToString($('#dSheet')), 'image/svg+xml'); });
  function xy(i, j) { return G.crs === 'utm' ? [G.lons[i].toFixed(2), G.lats[j].toFixed(2)] : [G.lons[i].toFixed(7), G.lats[j].toFixed(7)]; }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }

  function draw3d() {
    if (!G) return; var f = Math.max(1, Math.ceil(Math.max(G.nx, G.ny) / 160)), Z = [], X = [], Y = [], vex = +$('#dVex').value || 2;
    for (var i = 0; i < G.nx; i += f) X.push(G.crs === 'utm' ? (G.lons[i] - G.b.w) : (G.lons[i] - G.b.w) * D.metersPerDeg((G.b.n + G.b.s) / 2).x);
    for (var j = 0; j < G.ny; j += f) { Y.push(G.crs === 'utm' ? (G.lats[j] - G.b.s) : (G.lats[j] - G.b.s) * 110574); var r = []; for (i = 0; i < G.nx; i += f) { var v = G.z[j * G.nx + i]; r.push(isNaN(v) ? null : v); } Z.push(r); }
    var w = X[X.length - 1] || 1, h = Y[0] || 1, mx = Math.max(w, h), rz = (G.max - G.min) || 1, p = SH.palette();
    SH.plot('d3d', [{ type: 'surface', x: X, y: Y, z: Z, colorscale: D.plotlyScale('hypso'), showscale: false, contours: { z: { show: true, usecolormap: false, color: 'rgba(60,40,20,.35)', width: 1, start: G.min, end: G.max, size: D.niceInterval(rz, 15) } }, lighting: { ambient: .6, diffuse: .7, roughness: .9, specular: .1 }, hovertemplate: 'Z %{z:.1f} m<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 0, r: 0, t: 0, b: 0 }, scene: { aspectmode: 'manual', aspectratio: { x: w / mx * 1.6, y: h / mx * 1.6, z: Math.max(0.08, rz * vex / mx * 1.6) }, xaxis: { title: { text: 'E (m)' }, color: p.text2, gridcolor: p.line }, yaxis: { title: { text: 'N (m)' }, color: p.text2, gridcolor: p.line }, zaxis: { title: { text: 'Z (m)' }, color: p.text2, gridcolor: p.line }, camera: { eye: { x: -1.3, y: -1.5, z: 1.1 } } } }); }, { filename: 'shandal-dem-3d' });
  }
  $('#dVex').addEventListener('change', draw3d);

  function dl(kind) {
    if (!G) return; var nm = 'shandal-dem-' + (G.crs === 'utm' ? 'utm' + G.zone : 'wgs84') + '-' + new Date().toISOString().slice(0, 10), i, j, k, out = [];
    if (kind === 'csv' || kind === 'xyz') {
      var sep = kind === 'csv' ? ',' : ' '; if (kind === 'csv') out.push(G.crs === 'utm' ? 'X_Easting,Y_Northing,Z_m' : 'X_Lon,Y_Lat,Z_m');
      for (j = 0; j < G.ny; j++) for (i = 0; i < G.nx; i++) { k = j * G.nx + i; if (isNaN(G.z[k])) continue; var c = xy(i, j); out.push(c[0] + sep + c[1] + sep + G.z[k].toFixed(2)); }
      SH.download(nm + '.' + kind, out.join('\r\n'), 'text/plain');
    } else if (kind === 'asc') {
      var cs = G.crs === 'utm' ? G.step : G.dd, hdr = ['ncols ' + G.nx, 'nrows ' + G.ny, 'xllcorner ' + (G.b.w - cs / 2).toFixed(G.crs === 'utm' ? 3 : 9), 'yllcorner ' + (G.b.s - cs / 2).toFixed(G.crs === 'utm' ? 3 : 9), 'cellsize ' + (G.crs === 'utm' ? cs : cs.toFixed(10)), 'NODATA_value -9999'];
      for (j = 0; j < G.ny; j++) { var r = []; for (i = 0; i < G.nx; i++) { k = j * G.nx + i; r.push(isNaN(G.z[k]) ? -9999 : G.z[k].toFixed(2)); } out.push(r.join(' ')); }
      SH.download(nm + '.asc', hdr.concat(out).join('\n'), 'text/plain');
      var prj = G.crs === 'utm' ? 'PROJCS["WGS_1984_UTM_Zone_' + G.zone + (G.south ? 'S' : 'N') + '",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",' + (G.south ? '10000000.0' : '0.0') + '],PARAMETER["Central_Meridian",' + ((G.zone - 1) * 6 - 177) + '.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]' : 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
      setTimeout(function () { SH.download(nm + '.prj', prj, 'text/plain'); }, 400);
    } else if (kind === 'png') { var a = document.createElement('a'); a.href = D.render(G, { ramp: 'hypso' }); a.download = nm + '-relief.png'; a.click(); }
  }
  SH.$$('[data-dl]').forEach(function (b) { b.addEventListener('click', function () { dl(b.getAttribute('data-dl')); }); });
  $('#dRun').addEventListener('click', run);
  $('#dDemo').addEventListener('click', function () { $('#dSrc').value = 'aws'; $('#dCrs').value = 'utm'; $('#dStep').value = 30; setBounds({ n: 36.70, s: 36.60, w: 44.48, e: 44.62 }, true); run(); });
  document.addEventListener('sh:beforereport', function (e) { if (!G) { e.preventDefault(); SH.toast(t('Fetch a grid first.', 'اجلب شبكة أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (G) render(); });
  show(true);
})();
