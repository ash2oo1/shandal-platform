/* Global contour & profile studio — DEM → marching-squares contours, print-ready SVG map, Leaflet overlay,
   topographic profile, exports to SVG, PNG, GeoJSON, DXF and CSV. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, D = SH.dem;
  var persist = SH.persist('contours', ['cN', 'cS', 'cW', 'cE', 'cSrc', 'cCrs', 'cStep', 'cInt', 'cIdx', 'cRamp', 'cFill', 'cLab', 'cSm', 'cGrid', 'cTitle', 'pN']);
  var map = SH.map('cMap', { zoom: 6, base: 'topo', canvas: true }), rect = null, relief = null, cLayer = null, drawer = null, G = null, CS = null, step = 0, prof = null, pLine = null, pPts = [], tracing = false, pMk = [];

  function bounds() { var b = { n: SH.num('cN'), s: SH.num('cS'), w: SH.num('cW'), e: SH.num('cE') }; return [b.n, b.s, b.w, b.e].some(isNaN) || b.n <= b.s || b.e <= b.w ? null : b; }
  function setBounds(b, fit) { $('#cN').value = b.n.toFixed(5); $('#cS').value = b.s.toFixed(5); $('#cW').value = b.w.toFixed(5); $('#cE').value = b.e.toFixed(5); persist.save(); show(fit); }
  function autoStep(b) { var m = D.metersPerDeg((b.n + b.s) / 2), big = Math.max((b.e - b.w) * m.x, (b.n - b.s) * m.y), s = big / 250, src = SH.val('cSrc'), nice = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 120, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000]; for (var i = 0; i < nice.length; i++) if (nice[i] >= s) { s = nice[i]; break; } return Math.max(s, src === 'cop' ? 90 : 10); }
  function show(fit) {
    var b = bounds(); if (!b) return;
    if (map) { if (rect) rect.setBounds([[b.s, b.w], [b.n, b.e]]); else rect = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: SH.css('--accent'), weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map); if (fit) map.fitBounds(rect.getBounds(), { padding: [30, 30] }); }
    var m = D.metersPerDeg((b.n + b.s) / 2), w = (b.e - b.w) * m.x / 1000, h = (b.n - b.s) * m.y / 1000, st = SH.num('cStep') || autoStep(b), P = D.plan(b, SH.val('cCrs'), st), n = P.nx * P.ny;
    $('#cArea').innerHTML = SH.fmt(w, 2) + ' × ' + SH.fmt(h, 2) + ' km · ' + t('grid ', 'الشبكة ') + P.nx + ' × ' + P.ny + ' @ ' + st + ' m' + (n > (SH.val('cSrc') === 'cop' ? 3000 : 250000) ? ' · <span style="color:var(--danger)">' + t('too dense, increase spacing', 'كثيفة جداً، زد التباعد') + '</span>' : '');
  }
  ['cN', 'cS', 'cW', 'cE'].forEach(function (id) { $('#' + id).addEventListener('change', function () { show(true); }); });
  ['cStep', 'cSrc', 'cCrs'].forEach(function (id) { $('#' + id).addEventListener('change', function () { show(false); }); });
  $('#cDraw').addEventListener('click', function () { if (!map) return; stopTrace(); if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#cHint')); });
  $('#cView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setBounds({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  var toLL = function (y, x) { if (G.crs === 'utm') { var q = SH.fromUTM(x, y, G.zone, G.south); return [q.lat, q.lon]; } return [y, x]; };
  var toXY = function (lat, lon) { if (G.crs === 'utm') { var u = SH.toUTM(lat, lon, G.zone); return [u.N + (G.south && u.N < 0 ? 1e7 : 0), u.E]; } return [lat, lon]; };

  function run() {
    var b = bounds(), btn = $('#cRun'), host = $('#cMap').parentElement; if (!b) { SH.toast(t('Mark the area first.', 'حدد المنطقة أولاً.'), 'warn'); return; }
    var st = SH.num('cStep') || autoStep(b), P = D.plan(b, SH.val('cCrs'), st), lim = SH.val('cSrc') === 'cop' ? 3000 : 250000;
    if (P.nx * P.ny > lim) { SH.toast(t('Grid too dense for this source. Increase the spacing.', 'الشبكة كثيفة على هذا المصدر. زد التباعد.'), 'warn'); return; }
    if (P.nx < 4 || P.ny < 4) { SH.toast(t('Area too small for this spacing.', 'المنطقة صغيرة لهذا التباعد.'), 'warn'); return; }
    btn.disabled = true; persist.save(); SH.busy(host, true, t('Fetching elevations…', 'جارٍ جلب الارتفاعات…'));
    D.build(b, SH.val('cCrs'), st, SH.val('cSrc'), function (k, n) { SH.busy(host, true, t('Fetching elevations… ', 'جارٍ جلب الارتفاعات… ') + Math.round(100 * k / n) + ' %'); })
      .then(function (g) { G = g; D.derive(G); contour(); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy(host, false); });
  }
  function contour() {
    if (!G) return; var rz = G.max - G.min; step = SH.num('cInt') || D.niceInterval(rz, 15);
    if (rz / step > 400) { step = D.niceInterval(rz, 60); SH.toast(t('Interval raised to ', 'رُفع الفاصل إلى ') + step + t(' m to keep the map legible.', ' م للحفاظ على وضوح الخريطة.'), 'info'); }
    CS = D.contours(G, D.levels(G, step)); render();
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function render() {
    $('#cEmpty').hidden = true; $('#cOut').hidden = false;
    var nl = 0, len = 0, sl = 0, c = 0; CS.forEach(function (cc) { nl += cc.lines.length; }); for (var k = 0; k < G.z.length; k++) if (!isNaN(G.z[k])) { sl += G.slope[k]; c++; }
    var sorted = Array.prototype.slice.call(G.z).filter(function (v) { return !isNaN(v); }), HI = (G.mean - G.min) / ((G.max - G.min) || 1);
    $('#cKpis').innerHTML = kpi('info', t('Contour interval', 'الفاصل الكنتوري'), SH.fmt(step, step < 1 ? 1 : 0) + '<small> m</small>', CS.length + t(' levels · ', ' مستوى · ') + nl + t(' lines', ' خط')) +
      kpi('', t('Elevation range', 'مدى الارتفاع'), SH.fmt(G.min, 0) + '–' + SH.fmt(G.max, 0) + '<small> m</small>', t('relief ', 'التضرس ') + SH.fmt(G.max - G.min, 0) + ' m') +
      kpi('', t('Mean slope', 'متوسط الميل'), SH.fmt(sl / c, 1) + '<small>°</small>', 'Horn (1981)') + kpi('', t('Hypsometric integral', 'التكامل الهبسومتري'), SH.fmt(HI, 3), HI > 0.6 ? t('youthful', 'فتية') : HI > 0.35 ? t('mature', 'ناضجة') : t('old', 'هرمة')) +
      kpi('', t('Grid', 'الشبكة'), G.nx + ' × ' + G.ny, (G.crs === 'utm' ? SH.fmt(G.step, 0) + ' m · UTM ' + G.zone + (G.south ? 'S' : 'N') : SH.fmt(G.dd * 3600, 1) + '″ · WGS 84'));
    drawSvg(); drawLeaflet();
    $('#cCap').innerHTML = t('Contours by marching squares on a ', 'رُسم الكنتور بخوارزمية المربعات المتحركة على شبكة ') + G.nx + ' × ' + G.ny + t(' grid. Source: ', '. المصدر: ') + D.sources[G.source].attr;
  }
  function drawSvg() {
    var lines = [], legend = [];
    if (prof) { lines.push({ pts: prof.line.map(function (p) { return toXY(p[0], p[1]); }), color: '#C0392B', width: 2.2, dash: '8 5' }); legend.push({ name: t('Profile A–B', 'المقطع A–B'), color: '#C0392B', dash: '8 5' }); }
    var r = D.svgMap($('#cSvg'), G, CS, { crs: G.crs === 'utm' ? 'proj' : 'geo', interval: step, index: SH.num('cIdx') || 5, ramp: SH.val('cRamp'), fill: $('#cFill').checked, labels: $('#cLab').checked, smooth: $('#cSm').checked, grid: $('#cGrid').checked,
      title: SH.val('cTitle') || t('Topographic contour map', 'خريطة كنتورية طبوغرافية'), subtitle: (G.crs === 'utm' ? 'WGS 84 / UTM ' + G.zone + (G.south ? 'S' : 'N') : 'WGS 84') + ' · ' + t('interval ', 'الفاصل ') + SH.ltr(step + ' m') + (SH.val('geoName') ? ' · ' + SH.val('geoName') : ''), lines: lines, legend: legend,
      axisNames: G.crs === 'utm' ? ['Easting (m)', 'Northing (m)'] : null, source: G.source === 'cop' ? 'DEM: Copernicus GLO-90 (ESA)' : 'DEM: Terrain Tiles on AWS (SRTM and others)' });
    if (prof && r) { var a = toXY(prof.line[0][0], prof.line[0][1]), b = toXY(prof.line[prof.line.length - 1][0], prof.line[prof.line.length - 1][1]); var S = $('#cSvg'), NS = 'http://www.w3.org/2000/svg';
      [[a, 'A'], [b, 'B']].forEach(function (q) { var tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', r.X(q[0][1]) + 6); tx.setAttribute('y', r.Y(q[0][0]) - 6); tx.setAttribute('font-size', 13); tx.setAttribute('font-weight', 800); tx.setAttribute('fill', '#C0392B'); tx.setAttribute('stroke', '#fff'); tx.setAttribute('stroke-width', 3); tx.setAttribute('paint-order', 'stroke'); tx.textContent = q[1]; S.appendChild(tx); }); }
  }
  function drawLeaflet() {
    if (!map) return; if (relief) map.removeLayer(relief); if (cLayer) map.removeLayer(cLayer);
    if ($('#cFill').checked) relief = L.imageOverlay(D.render(G, { ramp: SH.val('cRamp') }), [[G.geo.s, G.geo.w], [G.geo.n, G.geo.e]], { opacity: .75 }).addTo(map);
    cLayer = L.layerGroup().addTo(map); var idx = SH.num('cIdx') || 5, rnd = L.canvas({ padding: 0.3 });
    CS.forEach(function (c) { var isI = Math.round(c.level / step) % idx === 0; c.lines.forEach(function (ln) { if (ln.length < 2) return; L.polyline(ln.map(function (p) { return toLL(p[0], p[1]); }), { renderer: rnd, color: isI ? '#5B3A1E' : '#8A5A35', weight: isI ? 1.8 : .8, opacity: .9, interactive: isI }).bindTooltip(SH.fmt(c.level, step < 1 ? 1 : 0) + ' m', { sticky: true }).addTo(cLayer); }); });
    map.fitBounds([[G.geo.s, G.geo.w], [G.geo.n, G.geo.e]], { padding: [20, 20] });
  }
  ['cIdx', 'cRamp', 'cFill', 'cLab', 'cSm', 'cGrid', 'cTitle'].forEach(function (id) { $('#' + id).addEventListener('change', function () { if (G) { persist.save(); render(); } }); });
  $('#cInt').addEventListener('change', function () { if (G) { persist.save(); contour(); } });

  /* ---------- profile */
  function stopTrace() { if (!tracing) return; tracing = false; $('#pHint').hidden = true; $('#pDrawT').textContent = t('Trace section', 'ارسم المقطع'); map.getContainer().style.cursor = ''; map.off('click', addV); }
  function addV(e) { if (pPts.length >= 20) return; pPts.push([e.latlng.lat, e.latlng.lng]); if (pLine) pLine.setLatLngs(pPts); else pLine = L.polyline(pPts, { color: '#C0392B', weight: 3, dashArray: '8 5' }).addTo(map); pMk.push(L.marker(e.latlng, { icon: SH.pin(pPts.length === 1 ? 'A' : '', 'mk-num', [22, 22]) }).addTo(map)); }
  $('#pDraw').addEventListener('click', function () {
    if (!map) return;
    if (tracing) { stopTrace(); if (pPts.length >= 2) { pMk[pMk.length - 1].setIcon(SH.pin('B', 'mk-num', [22, 22])); profile(pPts.slice()); } else SH.toast(t('Add at least two points.', 'أضف نقطتين على الأقل.'), 'warn'); return; }
    clearProf(); tracing = true; $('#pHint').hidden = false; $('#pDrawT').textContent = t('Finish', 'إنهاء'); map.getContainer().style.cursor = 'crosshair'; map.on('click', addV);
  });
  function clearProf() { pPts = []; if (pLine) { map.removeLayer(pLine); pLine = null; } pMk.forEach(function (m) { map.removeLayer(m); }); pMk = []; }
  $('#pClear').addEventListener('click', function () { stopTrace(); clearProf(); prof = null; $('#pPlot').hidden = true; $('#pKpis').hidden = true; $('#pEmpty').hidden = false; if (G) drawSvg(); });
  function profile(line) {
    var src = G ? G.source : SH.val('cSrc'), n = Math.max(50, Math.min(src === 'cop' ? 500 : 2000, SH.num('pN') || 400)), dn = D.densify(line, n);
    $('#cOut').hidden = false; $('#cEmpty').hidden = true; SH.busy($('#pPlot').parentElement, true, t('Sampling the profile…', 'جارٍ أخذ عينات المقطع…'));
    D.points(dn.pts, { source: src, res: Math.max(5, dn.length / n) }).then(function (z) {
      var gain = 0, loss = 0, maxS = 0, sumS = 0; for (var k = 1; k < z.length; k++) { var dz = z[k] - z[k - 1], dd = dn.d[k] - dn.d[k - 1]; if (dz > 0) gain += dz; else loss -= dz; var s = SH.deg(Math.atan(Math.abs(dz) / (dd || 1))); if (s > maxS) maxS = s; sumS += s; }
      prof = { line: line, d: dn.d, z: z, pts: dn.pts, length: dn.length, gain: gain, loss: loss, maxS: maxS, meanS: sumS / (z.length - 1) }; drawProf(); if (G) drawSvg();
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { SH.busy($('#pPlot').parentElement, false); });
  }
  function drawProf() {
    var p = SH.palette(), zmin = Math.min.apply(null, prof.z), zmax = Math.max.apply(null, prof.z), km = prof.length > 2000, dx = prof.d.map(function (v) { return km ? v / 1000 : v; }), ve = (prof.length / 1000) / ((zmax - zmin) || 1) * 0.25 * 1000 / 4;
    $('#pEmpty').hidden = true; $('#pPlot').hidden = false; $('#pKpis').hidden = false;
    SH.plot('pPlot', [{ x: dx, y: prof.z, mode: 'lines', line: { color: '#8A5A35', width: 2.5 }, fill: 'tozeroy', fillcolor: 'rgba(200,170,120,.35)', customdata: prof.pts.map(function (q) { return q[0].toFixed(5) + ', ' + q[1].toFixed(5); }), hovertemplate: '%{x:.2f} ' + (km ? 'km' : 'm') + ' · %{y:.1f} m<br>%{customdata}<extra></extra>' }],
      function () { return SH.plotLayout({ showlegend: false, xaxis: { title: { text: t('Distance', 'المسافة') + (km ? ' (km)' : ' (m)') } }, yaxis: { title: { text: t('Elevation (m)', 'الارتفاع (م)') }, range: [zmin - (zmax - zmin) * 0.15, zmax + (zmax - zmin) * 0.1] },
        annotations: [{ x: dx[0], y: prof.z[0], text: 'A', showarrow: false, yshift: 14, font: { size: 13, color: '#C0392B' } }, { x: dx[dx.length - 1], y: prof.z[prof.z.length - 1], text: 'B', showarrow: false, yshift: 14, font: { size: 13, color: '#C0392B' } }] }); }, { filename: 'shandal-profile' });
    $('#pKpis').innerHTML = kpi('info', t('Length', 'الطول'), SH.fmt(prof.length / (km ? 1000 : 1), km ? 2 : 0) + '<small> ' + (km ? 'km' : 'm') + '</small>', prof.z.length + t(' samples', ' عينة')) + kpi('', t('Elevation', 'الارتفاع'), SH.fmt(zmin, 0) + '–' + SH.fmt(zmax, 0) + '<small> m</small>', 'A ' + SH.fmt(prof.z[0], 0) + ' · B ' + SH.fmt(prof.z[prof.z.length - 1], 0)) +
      kpi('ok', t('Total gain', 'مجموع الصعود'), '+' + SH.fmt(prof.gain, 0) + '<small> m</small>', '') + kpi('warn', t('Total loss', 'مجموع النزول'), '−' + SH.fmt(prof.loss, 0) + '<small> m</small>', '') + kpi('', t('Slope', 'الانحدار'), SH.fmt(prof.meanS, 1) + '<small>°</small>', t('max ', 'الأقصى ') + SH.fmt(prof.maxS, 1) + '°');
  }

  /* ---------- exports */
  var base = function () { return 'shandal-contours-' + new Date().toISOString().slice(0, 10); };
  $('#xSvg').addEventListener('click', function () { if (!G) return; var s = new XMLSerializer().serializeToString($('#cSvg')); if (s.indexOf('xmlns=') < 0) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'); SH.download(base() + '.svg', s, 'image/svg+xml'); });
  $('#xPng').addEventListener('click', function () { if (G) SH.svgPng($('#cSvg'), base() + '.png', 2.5, '#ffffff'); });
  $('#xGeo').addEventListener('click', function () { if (!G) return; var cs = CS.map(function (c) { return { level: c.level, lines: c.lines.map(function (l) { return ($('#cSm').checked ? D.smooth(l, 2) : l).map(function (p) { return toLL(p[0], p[1]); }); }) }; }); SH.json(base() + '.geojson', D.toGeoJSON(cs, { interval_m: step, source: G.source })); });
  $('#xDxf').addEventListener('click', function () {
    if (!G) return; var o = ['0', 'SECTION', '2', 'ENTITIES'], idx = SH.num('cIdx') || 5;
    CS.forEach(function (c) { var lay = Math.round(c.level / step) % idx === 0 ? 'CONTOUR_INDEX' : 'CONTOUR'; c.lines.forEach(function (l) { if (l.length < 2) return; if ($('#cSm').checked) l = D.smooth(l, 2);
      o.push('0', 'POLYLINE', '8', lay, '66', '1', '10', '0', '20', '0', '30', c.level.toFixed(3), '70', '0');
      l.forEach(function (p) { o.push('0', 'VERTEX', '8', lay, '10', p[1].toFixed(G.crs === 'utm' ? 3 : 8), '20', p[0].toFixed(G.crs === 'utm' ? 3 : 8), '30', c.level.toFixed(3)); }); o.push('0', 'SEQEND', '8', lay); }); });
    o.push('0', 'ENDSEC', '0', 'EOF'); SH.download(base() + (G.crs === 'utm' ? '-utm' + G.zone : '-wgs84') + '.dxf', o.join('\r\n'), 'application/dxf');
  });
  $('#xCsv').addEventListener('click', function () { if (!G) return; var o = [G.crs === 'utm' ? 'X_Easting,Y_Northing,Z_m' : 'X_Lon,Y_Lat,Z_m']; for (var j = 0; j < G.ny; j++) for (var i = 0; i < G.nx; i++) { var z = G.z[j * G.nx + i]; if (!isNaN(z)) o.push(G.lons[i].toFixed(G.crs === 'utm' ? 2 : 7) + ',' + G.lats[j].toFixed(G.crs === 'utm' ? 2 : 7) + ',' + z.toFixed(2)); } SH.download(base() + '-grid.csv', o.join('\r\n'), 'text/csv'); });
  $('#xPcsv').addEventListener('click', function () { if (!prof) return; SH.csv('shandal-profile.csv', [['distance_m', 'lat', 'lon', 'elevation_m']].concat(prof.d.map(function (d, k) { return [d.toFixed(1), prof.pts[k][0].toFixed(6), prof.pts[k][1].toFixed(6), prof.z[k].toFixed(2)]; }))); });

  $('#cRun').addEventListener('click', run);
  $('#cDemo').addEventListener('click', function () { $('#cSrc').value = 'aws'; $('#cCrs').value = 'utm'; $('#cStep').value = ''; $('#cInt').value = ''; setBounds({ n: 36.70, s: 36.58, w: 44.47, e: 44.64 }, true); run(); });
  document.addEventListener('sh:beforereport', function (e) { if (!G) { e.preventDefault(); SH.toast(t('Generate a map first.', 'أنشئ خريطة أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (prof) drawProf(); });
  show(true);
  // expose for scripted demos
  window.__shProfile = function (line) { pPts = line; profile(line); };
})();
