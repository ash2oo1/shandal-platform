/* DEM & Contour Mapping Studio — one workspace for elevation grids, contour maps, spot-height sheets and profiles.
   Regular grids (UTM or geographic) from the SRTM composite (~30 m) or Copernicus GLO-90 (resampled on its native 3″ grid),
   marching-squares contours, print-ready map sheet in five styles, topographic profile, 3D model, hypsometric curve and
   slope distribution, and exports to PNG, SVG, GeoJSON, DXF, CSV, XYZ, ESRI ASCII grid (+ .prj) and shaded relief. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, D = SH.dem;
  var IDS = ['dN', 'dS', 'dW', 'dE', 'dSrc', 'dCrs', 'dStep', 'dStyle', 'dInt', 'dIdx', 'dSp', 'dDp', 'dRamp', 'dShade', 'dLab', 'dSm', 'dGrid', 'dTitle', 'pN'];
  var persist = SH.persist('demstudio', IDS);
  var map = SH.map('dMap', { zoom: 6, base: 'topo', canvas: true }), rect = null, overlay = null, drawer = null;
  var G = null, CS = null, step = 0, prof = null, pLine = null, pPts = [], tracing = false, pMk = [];
  var LIM = { aws: 360000, cop: 360000 }, COP_NATIVE = 4000;

  /* ---------- area and grid plan */
  function bounds() { var b = { n: SH.num('dN'), s: SH.num('dS'), w: SH.num('dW'), e: SH.num('dE') }; return [b.n, b.s, b.w, b.e].some(isNaN) || b.n <= b.s || b.e <= b.w ? null : b; }
  function setBounds(b, fit) { $('#dN').value = b.n.toFixed(5); $('#dS').value = b.s.toFixed(5); $('#dW').value = b.w.toFixed(5); $('#dE').value = b.e.toFixed(5); persist.save(); show(fit); }
  function autoStep(b) {
    var m = D.metersPerDeg((b.n + b.s) / 2), big = Math.max((b.e - b.w) * m.x, (b.n - b.s) * m.y), s = big / 250, nice = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 120, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000];
    for (var i = 0; i < nice.length; i++) if (nice[i] >= s) { s = nice[i]; break; }
    return Math.max(s, SH.val('dSrc') === 'cop' ? 30 : 10);
  }
  function stepOf(b) { return SH.num('dStep') > 0 ? SH.num('dStep') : autoStep(b); }
  function copNative(b) { return Math.ceil((b.n - b.s) * 1200 + 6) * Math.ceil((b.e - b.w) * 1200 + 6); }
  function show(fit) {
    var b = bounds(); if (!b) { estimate(); return; }
    if (map) { if (rect) rect.setBounds([[b.s, b.w], [b.n, b.e]]); else rect = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: SH.css('--accent'), weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map); if (fit) map.fitBounds(rect.getBounds(), { padding: [30, 30] }); }
    estimate();
  }
  function estimate() {
    var b = bounds(); if (!b) { $('#dEst').textContent = '—'; $('#dArea').textContent = t('Draw a rectangle or type the bounds.', 'ارسم مستطيلاً أو اكتب الحدود.'); return null; }
    var src = SH.val('dSrc'), st = stepOf(b), P = D.plan(b, SH.val('dCrs'), st), n = P.nx * P.ny, m = D.metersPerDeg((b.n + b.s) / 2), w = (b.e - b.w) * m.x / 1000, h = (b.n - b.s) * m.y / 1000;
    $('#dArea').innerHTML = SH.ltr(SH.fmt(w, 2) + ' × ' + SH.fmt(h, 2) + ' km') + ' · ' + SH.ltr(SH.fmt(w * h, 2) + ' km²') + (P.crs === 'utm' ? ' · ' + SH.ltr('UTM ' + P.zone + (P.south ? 'S' : 'N')) : '');
    var ok = n <= LIM[src], cn = src === 'cop' ? copNative(b) : 0, okc = !cn || cn <= COP_NATIVE;
    $('#dEst').innerHTML = '<b>' + SH.ltr(SH.fmt(P.nx, 0) + ' × ' + SH.fmt(P.ny, 0) + ' = ' + SH.fmt(n, 0)) + '</b> ' + t('nodes', 'عقدة') + ' · ' + SH.ltr(SH.fmt(st, 0) + ' m') + (SH.num('dStep') > 0 ? '' : ' (' + t('auto', 'تلقائي') + ')') +
      (ok ? '' : '<br><span style="color:var(--danger)">' + t('Too many nodes for one request; increase the spacing (limit ', 'عدد العقد كبير؛ زد التباعد (الحد ') + SH.fmt(LIM[src], 0) + ')</span>') +
      (okc ? '' : '<br><span style="color:var(--danger)">' + t('The area is too large for Copernicus GLO-90 (', 'المنطقة كبيرة على Copernicus GLO-90 (') + SH.fmt(cn, 0) + t(' native cells, limit ', ' خلية أصلية، الحد ') + SH.fmt(COP_NATIVE, 0) + t('). Shrink the area or use the SRTM composite.', '). صغّر المنطقة أو استخدم نموذج SRTM المركّب.') + '</span>') +
      (src === 'cop' && st < 90 ? '<br>' + t('Copernicus is 90 m data: spacing below 90 m interpolates between native cells.', 'بيانات Copernicus بدقة 90 م: التباعد الأقل من 90 م استيفاء بين الخلايا الأصلية.') : '');
    return ok && okc ? P : null;
  }
  ['dN', 'dS', 'dW', 'dE'].forEach(function (id) { $('#' + id).addEventListener('change', function () { show(true); }); });
  ['dStep', 'dSrc', 'dCrs'].forEach(function (id) { $('#' + id).addEventListener('input', estimate); $('#' + id).addEventListener('change', estimate); });
  $('#dDraw').addEventListener('click', function () { if (!map) return; stopTrace(); if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#dHint')); });
  $('#dView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  var toLL = function (y, x) { if (G.crs === 'utm') { var q = SH.fromUTM(x, y, G.zone, G.south); return [q.lat, q.lon]; } return [y, x]; };
  var toXY = function (lat, lon) { if (G.crs === 'utm') { var u = SH.toUTM(lat, lon, G.zone); return [u.N + (G.south && u.N < 0 ? 1e7 : 0), u.E]; } return [lat, lon]; };

  /* ---------- fetch */
  function run() {
    var b = bounds(), P = estimate(), btn = $('#dRun'), host = $('#dMap').parentElement;
    if (!b) { SH.toast(t('Mark the area first.', 'حدد المنطقة أولاً.'), 'warn'); return; }
    if (!P) { SH.toast(t('The grid is too large for this source. Increase the spacing or shrink the area.', 'الشبكة كبيرة على هذا المصدر. زد التباعد أو صغّر المنطقة.'), 'warn'); return; }
    if (P.nx < 4 || P.ny < 4) { SH.toast(t('The area is smaller than four grid cells. Reduce the spacing.', 'المنطقة أصغر من أربع خلايا. قلّل التباعد.'), 'warn'); return; }
    stopTrace(); btn.disabled = true; persist.save(); SH.busy(host, true, t('Fetching elevations…', 'جارٍ جلب الارتفاعات…'));
    D.build(b, SH.val('dCrs'), stepOf(b), SH.val('dSrc'), function (k, n) { SH.busy(host, true, t('Fetching elevations… ', 'جارٍ جلب الارتفاعات… ') + Math.round(100 * k / n) + ' %'); })
      .then(function (g) { SH.busy(host, true, t('Drawing contours…', 'جارٍ رسم خطوط الكنتور…')); return new Promise(function (r) { setTimeout(function () { r(g); }, 30); }); })
      .then(function (g) { G = g; D.derive(G); analyse(); contour(); renderAll(); })
      .catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy(host, false); });
  }
  function analyse() {
    var n = G.nx * G.ny, sl = 0, c = 0, sorted = [], sArr = [];
    for (var k = 0; k < n; k++) { if (isNaN(G.z[k])) continue; sl += G.slope[k]; c++; sorted.push(G.z[k]); sArr.push(G.slope[k]); }
    sorted.sort(function (a, b) { return a - b; });
    G.stat = { meanSlope: sl / c, HI: (G.mean - G.min) / ((G.max - G.min) || 1), nodata: n - c, sorted: sorted, slopes: sArr };
    var hi = -1, lo = -1; for (k = 0; k < n; k++) { var v = G.z[k]; if (isNaN(v)) continue; if (hi < 0 || v > G.z[hi]) hi = k; if (lo < 0 || v < G.z[lo]) lo = k; } G.stat.hi = Math.max(0, hi); G.stat.lo = Math.max(0, lo);
  }
  function contour() {
    var rz = G.max - G.min; step = SH.num('dInt') || D.niceInterval(rz, 15);
    if (rz / step > 400) { step = D.niceInterval(rz, 60); SH.toast(t('Interval raised to ', 'رُفع الفاصل إلى ') + step + t(' m to keep the map legible.', ' م للحفاظ على وضوح الخريطة.'), 'info'); }
    CS = D.contours(G, D.levels(G, step));
  }

  /* ---------- rendering */
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function renderAll() {
    $('#dEmpty').hidden = true; $('#dOut').hidden = false;
    kpis(); meta(); drawLeaflet(); drawSheet(); table();
    // the heavier charts are drawn on the next frames so the map appears at once
    requestAnimationFrame(function () { draw3d(); requestAnimationFrame(hypso); });
    if (map) map.fitBounds([[G.geo.s, G.geo.w], [G.geo.n, G.geo.e]], { padding: [20, 20] });
  }
  function kpis() {
    var nl = 0, n = G.nx * G.ny, HI = G.stat.HI; CS.forEach(function (cc) { nl += cc.lines.length; });
    $('#dKpis').innerHTML = kpi('info', t('Grid nodes', 'عقد الشبكة'), SH.fmt(n, 0), SH.ltr(G.nx + ' × ' + G.ny + ' · ' + (G.crs === 'utm' ? SH.fmt(G.step, 0) + ' m' : SH.fmt(G.dd * 3600, 2) + '″'))) +
      kpi('', t('Contour interval', 'الفاصل الكنتوري'), SH.fmt(step, step < 1 ? 1 : 0) + '<small> m</small>', CS.length + t(' levels · ', ' مستوى · ') + nl + t(' lines', ' خطاً')) +
      kpi('', t('Elevation range', 'مدى الارتفاع'), SH.ltr(SH.fmt(G.min, 0) + '–' + SH.fmt(G.max, 0)) + '<small> m</small>', t('mean ', 'المتوسط ') + SH.ltr(SH.fmt(G.mean, 1) + ' m')) +
      kpi('', t('Relief', 'التضرس'), SH.fmt(G.max - G.min, 1) + '<small> m</small>', t('maximum − minimum', 'الأعلى − الأدنى')) +
      kpi(G.stat.meanSlope > 20 ? 'warn' : '', t('Mean slope', 'متوسط الميل'), SH.fmt(G.stat.meanSlope, 1) + '<small>°</small>', 'Horn (1981)') +
      kpi('', t('Hypsometric integral', 'التكامل الهبسومتري'), SH.fmt(HI, 3), HI > 0.6 ? t('youthful terrain', 'تضاريس فتية') : HI > 0.35 ? t('mature terrain', 'تضاريس ناضجة') : t('old terrain', 'تضاريس هرمة'));
  }
  function crsText() { return G.crs === 'utm' ? 'WGS 84 / UTM ' + G.zone + (G.south ? 'S' : 'N') + ' (EPSG:' + (G.south ? 327 : 326) + String(G.zone).padStart(2, '0') + ')' : 'WGS 84 (EPSG:4326)'; }
  function meta() {
    $('#dMeta').innerHTML = SH.ltr(crsText()) + ' · ' + t('Elevation model: ', 'نموذج الارتفاع: ') + D.sources[G.source].attr + (G.zoom ? ' · ' + SH.ltr(t('pixel ≈ ', 'pixel ≈ ') + SH.fmt(G.pixel, 1) + ' m') : '') + (G.stat.nodata ? ' · ' + G.stat.nodata + t(' empty nodes', ' عقدة فارغة') : '');
  }
  function styleOf() { var s = SH.val('dStyle') || 'relief'; return { s: s, fill: /relief$/.test(s), cont: s === 'relief' || s === 'contours' || s === 'spotscont', spots: /^spots/.test(s) }; }
  function drawLeaflet() {
    if (!map || !G) return; if (overlay) map.removeLayer(overlay); overlay = L.layerGroup().addTo(map);
    var st = styleOf(), idx = SH.num('dIdx') || 5, rnd = L.canvas({ padding: 0.3 }), sm = $('#dSm').checked;
    L.imageOverlay(D.render(G, { ramp: SH.val('dRamp'), shade: $('#dShade').checked }), [[G.geo.s, G.geo.w], [G.geo.n, G.geo.e]], { opacity: st.fill ? .78 : .45 }).addTo(overlay);
    CS.forEach(function (c) { var isI = Math.round(c.level / step) % idx === 0; c.lines.forEach(function (ln) { if (ln.length < 2) return; L.polyline((sm ? D.smooth(ln, 2) : ln).map(function (q) { return toLL(q[0], q[1]); }), { renderer: rnd, color: isI ? '#4A2E17' : '#7E5636', weight: isI ? 1.8 : .8, opacity: .92, interactive: isI }).bindTooltip(SH.fmt(c.level, step < 1 ? 1 : 0) + ' m', { sticky: true }).addTo(overlay); }); });
  }
  function spotsFor() {
    var sp = SH.num('dSp'), kk = Math.max(1, Math.round((sp > 0 ? sp : (G.nx - 1) * G.dx / 14) / G.dx)), off = Math.floor(kk / 2), spots = [], i, j;
    for (j = off; j < G.ny; j += kk) for (i = off; i < G.nx; i += kk) { var z = G.z[j * G.nx + i]; if (!isNaN(z)) spots.push({ x: G.lons[i], y: G.lats[j], v: z }); }
    // the highest and lowest points of the area are always printed
    [G.stat.hi, G.stat.lo].forEach(function (q) { var sx = G.lons[q % G.nx], sy = G.lats[Math.floor(q / G.nx)], rr = kk * Math.abs(G.lons[1] - G.lons[0]) * .6; spots = spots.filter(function (p) { return Math.hypot(p.x - sx, p.y - sy) > rr; }); spots.push({ x: sx, y: sy, v: G.z[q], key: true }); });
    return spots;
  }
  function drawSheet() {
    if (!G) return; var st = styleOf(), spots = st.spots ? spotsFor() : [], lines = [], legend = [];
    if (prof) { lines.push({ pts: prof.line.map(function (p) { return toXY(p[0], p[1]); }), color: '#C0392B', width: 2.2, dash: '8 5' }); legend.push({ name: t('Profile A–B', 'المقطع A–B'), color: '#C0392B', dash: '8 5' }); }
    var title = SH.val('dTitle') || (st.spots && !st.cont ? t('Spot-height map', 'خريطة نقاط الارتفاع') : t('Topographic contour map', 'خريطة كنتورية طبوغرافية'));
    var sub = (G.crs === 'utm' ? 'WGS 84 / UTM ' + G.zone + (G.south ? 'S' : 'N') : 'WGS 84') + (st.cont ? ' · ' + t('contour interval ', 'الفاصل الكنتوري ') + SH.ltr(SH.fmt(step, step < 1 ? 1 : 0) + ' m') : '') + (st.spots ? ' · ' + spots.length + t(' spot heights', ' نقطة ارتفاع') : '');
    var r = D.svgMap($('#dSheet'), G, st.cont ? CS : [], { crs: G.crs === 'utm' ? 'proj' : 'geo', interval: step, index: SH.num('dIdx') || 5, ramp: SH.val('dRamp'), fill: st.fill, shade: $('#dShade').checked, labels: $('#dLab').checked, smooth: $('#dSm').checked, grid: $('#dGrid').checked,
      noContours: !st.cont, spots: spots, spotDp: +SH.val('dDp') || 0, spotSize: spots.length > 250 ? 7.5 : 8.5, lines: lines, legend: legend, title: title, subtitle: sub, legendTitle: t('Elevation (m)', 'الارتفاع (م)'),
      axisNames: G.crs === 'utm' ? ['Easting (m)', 'Northing (m)'] : null, source: D.sources[G.source].short });
    if (prof && r) { var S = $('#dSheet'), NS = 'http://www.w3.org/2000/svg', a = toXY(prof.line[0][0], prof.line[0][1]), b = toXY(prof.line[prof.line.length - 1][0], prof.line[prof.line.length - 1][1]);
      [[a, 'A'], [b, 'B']].forEach(function (q) { var tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', r.X(q[0][1]) + 6); tx.setAttribute('y', r.Y(q[0][0]) - 6); tx.setAttribute('font-size', 13); tx.setAttribute('font-weight', 800); tx.setAttribute('fill', '#C0392B'); tx.setAttribute('stroke', '#fff'); tx.setAttribute('stroke-width', 3); tx.setAttribute('paint-order', 'stroke'); tx.setAttribute('direction', 'ltr'); tx.textContent = q[1]; S.appendChild(tx); }); }
    $('#dCap').innerHTML = st.spots && !st.cont ? t('Exercise sheet: only spot heights are printed, so students can interpolate and draw the contour lines by hand. The highest and lowest points of the area are always included.', 'ورقة تمرين: تُطبع نقاط الارتفاع فقط ليستكمل الطلبة الاستيفاء ويرسموا خطوط الكنتور يدوياً. تُضمَّن دائماً أعلى نقطة وأدنى نقطة في المنطقة.')
      : t('Contours traced by marching squares on a ', 'رُسمت خطوط الكنتور بخوارزمية المربعات المتحركة على شبكة ') + SH.ltr(G.nx + ' × ' + G.ny) + t(' grid and smoothed for display; every ', '، ومُهِّدت للعرض؛ ويُرسم كل خط رقم ') + (SH.num('dIdx') || 5) + t('th line is an index contour. Source: ', ' خطاً رئيسياً مرقَّماً. المصدر: ') + D.sources[G.source].attr;
  }
  function hypso() {
    if (!G) return; var sorted = G.stat.sorted, sArr = G.stat.slopes, HI = G.stat.HI, p = SH.palette(), hx = [], hy = [];
    // hypsometric curve (Strahler 1952): relative area above each relative height
    for (var q = 0; q <= 50; q++) { var a = q / 50, idx = Math.floor((1 - a) * (sorted.length - 1)); hx.push(a); hy.push((sorted[idx] - G.min) / ((G.max - G.min) || 1)); }
    SH.plot('dHyp', [{ x: hx, y: hy, mode: 'lines', line: { color: p.accent, width: 2.5 }, fill: 'tozeroy', fillcolor: SH.alpha(p.accent, .12), hovertemplate: 'a/A %{x:.2f} · h/H %{y:.2f}<extra></extra>' }], function () { return SH.plotLayout({ margin: { l: 50, r: 10, t: 10, b: 40 }, showlegend: false, xaxis: { title: { text: t('Relative area a/A', 'المساحة النسبية a/A') }, range: [0, 1] }, yaxis: { title: { text: 'h/H' }, range: [0, 1] } }); }, { filename: 'shandal-hypsometric' });
    var bins = new Array(18).fill(0); sArr.forEach(function (s) { bins[Math.min(17, Math.floor(s / 5))]++; });
    SH.plot('dSlope', [{ x: bins.map(function (_, i) { return i * 5 + 2.5; }), y: bins.map(function (b) { return 100 * b / sArr.length; }), mode: 'lines', line: { shape: 'hvh', color: p.text2, width: 1.5 }, fill: 'tozeroy', fillcolor: SH.alpha(p.text2, .15), hovertemplate: '%{x:.1f}° ± 2.5° · %{y:.1f} %<extra></extra>' }], function () { return SH.plotLayout({ margin: { l: 50, r: 10, t: 10, b: 40 }, showlegend: false, bargap: 0, xaxis: { title: { text: t('Slope (°)', 'الميل (°)') }, range: [0, 90], dtick: 10 }, yaxis: { title: { text: t('% of area', '% من المساحة') } } }); }, { filename: 'shandal-slope' });
    $('#dHypCap').innerHTML = t('Hypsometric integral HI = ', 'التكامل الهبسومتري HI = ') + '<b>' + SH.fmt(HI, 3) + '</b> — ' + (HI > 0.6 ? t('convex curve: youthful, weakly eroded terrain (Strahler 1952).', 'منحنى محدب: تضاريس فتية ضعيفة التعرية (Strahler 1952).') : HI > 0.35 ? t('S-shaped curve: mature terrain in equilibrium (Strahler 1952).', 'منحنى على شكل S: تضاريس ناضجة في حالة توازن (Strahler 1952).') : t('concave curve: old, deeply eroded terrain (Strahler 1952).', 'منحنى مقعر: تضاريس هرمة شديدة التعرية (Strahler 1952).')) +
      ' ' + t('Slope classes follow Horn (1981) gradients on the grid.', 'ودرجات الميل محسوبة بفروق Horn (1981) على الشبكة.');
  }
  function draw3d() {
    if (!G) return; var f = Math.max(1, Math.ceil(Math.max(G.nx, G.ny) / 160)), Z = [], X = [], Y = [], vex = +$('#dVex').value || 2, i, j;
    for (i = 0; i < G.nx; i += f) X.push(G.crs === 'utm' ? (G.lons[i] - G.b.w) : (G.lons[i] - G.b.w) * D.metersPerDeg((G.b.n + G.b.s) / 2).x);
    for (j = 0; j < G.ny; j += f) { Y.push(G.crs === 'utm' ? (G.lats[j] - G.b.s) : (G.lats[j] - G.b.s) * 110574); var r = []; for (i = 0; i < G.nx; i += f) { var v = G.z[j * G.nx + i]; r.push(isNaN(v) ? null : v); } Z.push(r); }
    var w = X[X.length - 1] || 1, h = Y[0] || 1, mx = Math.max(w, h), rz = (G.max - G.min) || 1, p = SH.palette(), unitK = mx > 5000, ax = function (n) { return { title: { text: n + (unitK ? ' (km)' : ' (m)') }, color: p.text2, gridcolor: p.line, tickvals: null }; };
    var sx = unitK ? X.map(function (q) { return q / 1000; }) : X, sy = unitK ? Y.map(function (q) { return q / 1000; }) : Y;
    SH.plot('d3d', [{ type: 'surface', x: sx, y: sy, z: Z, colorscale: D.plotlyScale(SH.val('dRamp') === 'gray' ? 'gray' : SH.val('dRamp') || 'hypso'), showscale: false, contours: { z: { show: true, usecolormap: false, color: 'rgba(60,40,20,.35)', width: 1, start: G.min, end: G.max, size: step || D.niceInterval(rz, 15) } }, lighting: { ambient: .6, diffuse: .7, roughness: .9, specular: .1 }, hovertemplate: 'Z %{z:.1f} m<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 0, r: 0, t: 0, b: 0 }, scene: { aspectmode: 'manual', aspectratio: { x: w / mx * 1.6, y: h / mx * 1.6, z: Math.max(0.08, rz * vex / mx * 1.6) }, xaxis: ax('E'), yaxis: ax('N'), zaxis: { title: { text: 'Z (m)' }, color: p.text2, gridcolor: p.line }, camera: { eye: { x: -1.35, y: -1.55, z: 1.05 } } } }); }, { filename: 'shandal-dem-3d', displayModeBar: 'hover' });
  }
  function table() {
    var rows = [], n = G.nx * G.ny; for (var k = 0; k < Math.min(8, n); k++) { var j = Math.floor(k / G.nx), i = k % G.nx; rows.push('<tr><td class="num">' + (k + 1) + '</td><td class="num">' + xy(i, j)[0] + '</td><td class="num">' + xy(i, j)[1] + '</td><td class="num">' + (isNaN(G.z[k]) ? '—' : G.z[k].toFixed(2)) + '</td></tr>'); }
    $('#dTbl').innerHTML = '<thead><tr><th class="num">#</th><th class="num">' + (G.crs === 'utm' ? 'X (Easting)' : 'X (Lon)') + '</th><th class="num">' + (G.crs === 'utm' ? 'Y (Northing)' : 'Y (Lat)') + '</th><th class="num">Z (m)</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  }
  function xy(i, j) { return G.crs === 'utm' ? [G.lons[i].toFixed(2), G.lats[j].toFixed(2)] : [G.lons[i].toFixed(7), G.lats[j].toFixed(7)]; }

  /* option changes redraw without fetching again; several quick changes are merged into one frame */
  var pend = {}, raf = 0;
  function later(what) { pend[what] = 1; if (raf) return; raf = requestAnimationFrame(function () { raf = 0; var p = pend; pend = {}; if (!G) return; persist.save();
    if (p.contour) { contour(); kpis(); p.leaflet = p.sheet = p.d3 = 1; }
    if (p.leaflet) drawLeaflet(); if (p.sheet) drawSheet(); if (p.d3) draw3d(); }); }
  $('#dInt').addEventListener('change', function () { later('contour'); });
  ['dIdx', 'dRamp', 'dShade', 'dSm', 'dStyle'].forEach(function (id) { $('#' + id).addEventListener('change', function () { later('leaflet'); later('sheet'); if (id === 'dRamp') later('d3'); }); });
  ['dLab', 'dGrid', 'dSp', 'dDp', 'dTitle'].forEach(function (id) { $('#' + id).addEventListener('change', function () { later('sheet'); }); });
  $('#dVex').addEventListener('input', function () { $('#dVexO').textContent = $('#dVex').value; });
  $('#dVex').addEventListener('change', function () { later('d3'); });

  /* ---------- topographic profile */
  function stopTrace() { if (!tracing) return; tracing = false; $('#pHint').hidden = true; $('#pDrawT').textContent = t('Trace section', 'ارسم المقطع'); map.getContainer().style.cursor = ''; map.off('click', addV); }
  function addV(e) { if (pPts.length >= 20) return; pPts.push([e.latlng.lat, e.latlng.lng]); if (pLine) pLine.setLatLngs(pPts); else pLine = L.polyline(pPts, { color: '#C0392B', weight: 3, dashArray: '8 5' }).addTo(map); pMk.push(L.marker(e.latlng, { icon: SH.pin(pPts.length === 1 ? 'A' : '', 'mk-num', [22, 22]) }).addTo(map)); }
  $('#pDraw').addEventListener('click', function () {
    if (!map) return; if (drawer) drawer.cancel();
    if (tracing) { stopTrace(); if (pPts.length >= 2) { pMk[pMk.length - 1].setIcon(SH.pin('B', 'mk-num', [22, 22])); profile(pPts.slice()); } else SH.toast(t('Add at least two points.', 'أضف نقطتين على الأقل.'), 'warn'); return; }
    clearProf(); tracing = true; $('#pHint').hidden = false; $('#pDrawT').textContent = t('Finish', 'إنهاء'); map.getContainer().style.cursor = 'crosshair'; map.on('click', addV);
  });
  function clearProf() { pPts = []; if (pLine) { map.removeLayer(pLine); pLine = null; } pMk.forEach(function (m) { map.removeLayer(m); }); pMk = []; }
  $('#pClear').addEventListener('click', function () { stopTrace(); clearProf(); prof = null; $('#pPlot').hidden = true; $('#pKpis').hidden = true; $('#pEmpty').hidden = false; if (G) drawSheet(); });
  function profile(line) {
    var src = G ? G.source : SH.val('dSrc'), n = Math.max(50, Math.min(src === 'cop' ? 500 : 2000, SH.num('pN') || 400)), dn = D.densify(line, n), host = $('#pPlot').parentElement;
    $('#dOut').hidden = false; $('#dEmpty').hidden = true; host.scrollIntoView({ behavior: 'smooth', block: 'center' }); SH.busy(host, true, t('Sampling the profile…', 'جارٍ أخذ عينات المقطع…'));
    D.points(dn.pts, { source: src, res: Math.max(5, dn.length / n) }).then(function (z) {
      var gain = 0, loss = 0, maxS = 0, sumS = 0; for (var k = 1; k < z.length; k++) { var dz = z[k] - z[k - 1], dd = dn.d[k] - dn.d[k - 1]; if (dz > 0) gain += dz; else loss -= dz; var s = SH.deg(Math.atan(Math.abs(dz) / (dd || 1))); if (s > maxS) maxS = s; sumS += s; }
      prof = { line: line, d: dn.d, z: z, pts: dn.pts, length: dn.length, gain: gain, loss: loss, maxS: maxS, meanS: sumS / (z.length - 1) }; drawProf(); if (G) drawSheet();
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { SH.busy(host, false); });
  }
  function drawProf() {
    var zmin = Math.min.apply(null, prof.z), zmax = Math.max.apply(null, prof.z), km = prof.length > 2000, dx = prof.d.map(function (v) { return km ? v / 1000 : v; }), hl = (zmax - zmin) || 1;
    var ve = (prof.length / hl) * (320 - 90) / 700; // approximate vertical exaggeration of the plotted section
    $('#pEmpty').hidden = true; $('#pPlot').hidden = false; $('#pKpis').hidden = false;
    SH.plot('pPlot', [{ x: dx, y: prof.z, mode: 'lines', line: { color: '#8A5A35', width: 2.5, shape: 'spline', smoothing: .4 }, fill: 'tozeroy', fillcolor: 'rgba(200,170,120,.35)', customdata: prof.pts.map(function (q) { return q[0].toFixed(5) + ', ' + q[1].toFixed(5); }), hovertemplate: '%{x:.2f} ' + (km ? 'km' : 'm') + ' · %{y:.1f} m<br>%{customdata}<extra></extra>' }],
      function () { return SH.plotLayout({ showlegend: false, margin: { l: 64, r: 20, t: 26, b: 50 }, xaxis: { title: { text: t('Distance', 'المسافة') + (km ? ' (km)' : ' (m)') } }, yaxis: { title: { text: t('Elevation (m)', 'الارتفاع (م)') }, range: [zmin - hl * 0.15, zmax + hl * 0.12] },
        annotations: [{ x: dx[0], y: prof.z[0], text: 'A', showarrow: false, yshift: 14, font: { size: 13, color: '#C0392B' } }, { x: dx[dx.length - 1], y: prof.z[prof.z.length - 1], text: 'B', showarrow: false, yshift: 14, font: { size: 13, color: '#C0392B' } },
          { xref: 'paper', yref: 'paper', x: 1, y: 1.07, xanchor: 'right', showarrow: false, text: t('Vertical exaggeration ≈ ', 'المبالغة الرأسية ≈ ') + '×' + SH.fmt(Math.max(1, ve), ve < 10 ? 1 : 0), font: { size: 11, color: SH.palette().text2 } }] }); }, { filename: 'shandal-profile' });
    $('#pKpis').innerHTML = kpi('info', t('Length', 'الطول'), SH.fmt(prof.length / (km ? 1000 : 1), km ? 2 : 0) + '<small> ' + (km ? 'km' : 'm') + '</small>', prof.z.length + t(' samples', ' عينة')) + kpi('', t('Elevation', 'الارتفاع'), SH.ltr(SH.fmt(zmin, 0) + '–' + SH.fmt(zmax, 0)) + '<small> m</small>', SH.ltr('A ' + SH.fmt(prof.z[0], 0) + ' · B ' + SH.fmt(prof.z[prof.z.length - 1], 0))) +
      kpi('ok', t('Total ascent', 'مجموع الصعود'), '+' + SH.fmt(prof.gain, 0) + '<small> m</small>', '') + kpi('warn', t('Total descent', 'مجموع النزول'), '−' + SH.fmt(prof.loss, 0) + '<small> m</small>', '') + kpi('', t('Mean slope', 'متوسط الانحدار'), SH.fmt(prof.meanS, 1) + '<small>°</small>', t('max ', 'الأقصى ') + SH.ltr(SH.fmt(prof.maxS, 1) + '°'));
  }

  /* ---------- exports */
  function base() { return 'shandal-dem-' + (G.crs === 'utm' ? 'utm' + G.zone + (G.south ? 's' : 'n') : 'wgs84') + '-' + new Date().toISOString().slice(0, 10); }
  function smoothed(l) { return $('#dSm').checked ? D.smooth(l, 2) : l; }
  function dl(kind) {
    if (!G) { SH.toast(t('Fetch a grid first.', 'اجلب شبكة أولاً.'), 'warn'); return; }
    var nm = base(), i, j, k, out = [];
    if (kind === 'csv' || kind === 'xyz') {
      var sep = kind === 'csv' ? ',' : ' '; if (kind === 'csv') out.push(G.crs === 'utm' ? 'X_Easting,Y_Northing,Z_m' : 'X_Lon,Y_Lat,Z_m');
      for (j = 0; j < G.ny; j++) for (i = 0; i < G.nx; i++) { k = j * G.nx + i; if (isNaN(G.z[k])) continue; var c = xy(i, j); out.push(c[0] + sep + c[1] + sep + G.z[k].toFixed(2)); }
      SH.download(nm + '.' + kind, out.join('\r\n'), 'text/plain');
    } else if (kind === 'asc') {
      var cs = G.crs === 'utm' ? G.step : G.dd, hdr = ['ncols ' + G.nx, 'nrows ' + G.ny, 'xllcorner ' + (G.b.w - cs / 2).toFixed(G.crs === 'utm' ? 3 : 9), 'yllcorner ' + (G.b.s - cs / 2).toFixed(G.crs === 'utm' ? 3 : 9), 'cellsize ' + (G.crs === 'utm' ? cs : cs.toFixed(10)), 'NODATA_value -9999'];
      for (j = 0; j < G.ny; j++) { var r = []; for (i = 0; i < G.nx; i++) { k = j * G.nx + i; r.push(isNaN(G.z[k]) ? -9999 : G.z[k].toFixed(2)); } out.push(r.join(' ')); }
      SH.download(nm + '.asc', hdr.concat(out).join('\n'), 'text/plain');
      var prj = G.crs === 'utm' ? 'PROJCS["WGS_1984_UTM_Zone_' + G.zone + (G.south ? 'S' : 'N') + '",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",' + (G.south ? '10000000.0' : '0.0') + '],PARAMETER["Central_Meridian",' + ((G.zone - 1) * 6 - 177) + '.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]' : 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
      setTimeout(function () { SH.download(nm + '.prj', prj, 'text/plain'); }, 500);
    } else if (kind === 'png') {
      var a = document.createElement('a'); a.href = D.render(G, { ramp: SH.val('dRamp'), shade: $('#dShade').checked }); a.download = nm + '-relief.png'; a.click();
    } else if (kind === 'geojson') {
      var cs2 = CS.map(function (c) { return { level: c.level, lines: c.lines.map(function (l) { return smoothed(l).map(function (p) { return toLL(p[0], p[1]); }); }) }; });
      SH.json(nm + '-contours.geojson', D.toGeoJSON(cs2, { interval_m: step, source: D.sources[G.source].short }));
    } else if (kind === 'dxf') {
      var o = ['0', 'SECTION', '2', 'ENTITIES'], idx = SH.num('dIdx') || 5, dp = G.crs === 'utm' ? 3 : 8;
      CS.forEach(function (c) { var lay = Math.round(c.level / step) % idx === 0 ? 'CONTOUR_INDEX' : 'CONTOUR'; c.lines.forEach(function (l) { if (l.length < 2) return; l = smoothed(l);
        o.push('0', 'POLYLINE', '8', lay, '66', '1', '10', '0', '20', '0', '30', c.level.toFixed(3), '70', '0');
        l.forEach(function (p) { o.push('0', 'VERTEX', '8', lay, '10', p[1].toFixed(dp), '20', p[0].toFixed(dp), '30', c.level.toFixed(3)); }); o.push('0', 'SEQEND', '8', lay); }); });
      o.push('0', 'ENDSEC', '0', 'EOF'); SH.download(nm + '-contours.dxf', o.join('\r\n'), 'application/dxf');
    }
  }
  SH.$$('[data-dl]').forEach(function (b) { b.addEventListener('click', function () { dl(b.getAttribute('data-dl')); }); });
  $('#xGeo').addEventListener('click', function () { dl('geojson'); });
  $('#xDxf').addEventListener('click', function () { dl('dxf'); });
  $('#xPng').addEventListener('click', function () { if (G) SH.svgPng($('#dSheet'), base() + '-' + (SH.val('dStyle') || 'relief') + '.png', 3, '#ffffff'); });
  $('#xSvg').addEventListener('click', function () { if (!G) return; var s = new XMLSerializer().serializeToString($('#dSheet')); if (s.indexOf('xmlns=') < 0) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'); SH.download(base() + '-' + (SH.val('dStyle') || 'relief') + '.svg', s, 'image/svg+xml'); });
  $('#xPcsv').addEventListener('click', function () { if (!prof) return; SH.csv('shandal-profile.csv', [['distance_m', 'lat', 'lon', 'elevation_m']].concat(prof.d.map(function (d, k) { return [d.toFixed(1), prof.pts[k][0].toFixed(6), prof.pts[k][1].toFixed(6), prof.z[k].toFixed(2)]; }))); });

  $('#dRun').addEventListener('click', run);
  $('#dDemo').addEventListener('click', function () { $('#dSrc').value = 'aws'; $('#dCrs').value = 'utm'; $('#dStep').value = ''; $('#dInt').value = ''; $('#dStyle').value = 'relief'; setBounds({ n: 36.70, s: 36.58, w: 44.47, e: 44.64 }, true); run(); });
  document.addEventListener('sh:beforereport', function (e) { if (!G && !prof) { e.preventDefault(); SH.toast(t('Fetch a grid first.', 'اجلب شبكة أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (G) { draw3d(); hypso(); } if (prof) drawProf(); });
  show(true);
  window.__shProfile = function (line) { pPts = line; profile(line); };
})();
