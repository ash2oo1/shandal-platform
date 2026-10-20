/* 2D contour mapping lab — scattered X,Y,Z → ordinary kriging or IDW grid, hull clipping, semivariogram,
   leave-one-out cross-validation (Dubrule 1983 shortcut for kriging), print-ready SVG map and CAD/GIS exports. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, D = SH.dem;
  var persist = SH.persist('contourlab', ['lCrs', 'lRes', 'lPow', 'lHull', 'lInt', 'lIdx', 'lRamp', 'lFill', 'lLab', 'lPts', 'lPtL', 'lSm', 'lGrid', 'lTitle', 'lUnit']);
  var rows = [], head = [], P = [], G = null, CS = null, step = 0;

  /* ---------- parsing */
  function parse(txt) {
    var lines = txt.replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^#/.test(l); });
    if (!lines.length) return false;
    var sep = /\t/.test(lines[0]) ? '\t' : /;/.test(lines[0]) ? ';' : /,/.test(lines[0]) ? ',' : /\s+/;
    var cells = lines.map(function (l) { return l.split(sep).map(function (c) { return c.trim().replace(/^"|"$/g, ''); }); });
    var hasHead = cells[0].some(function (c) { return c !== '' && isNaN(parseFloat(c)); });
    head = hasHead ? cells[0] : cells[0].map(function (_, i) { return t('Column ', 'العمود ') + (i + 1); }); rows = hasHead ? cells.slice(1) : cells;
    var opts = head.map(function (h, i) { return '<option value="' + i + '">' + SH.esc(h) + '</option>'; }).join('');
    ['lCx', 'lCy', 'lCz'].forEach(function (id, k) { $('#' + id).innerHTML = opts; });
    var guess = function (re, d) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return Math.min(d, head.length - 1); };
    $('#lCx').value = guess(/^(x|e|east|easting|lon|long|longitude)/i, 0); $('#lCy').value = guess(/^(y|n|north|northing|lat|latitude)/i, 1); $('#lCz').value = guess(/^(z|elev|elevation|h|height|alt|value|rl)/i, 2);
    if (/lon|lat/i.test(head.join(' '))) $('#lCrs').value = 'geo';
    pick(); return true;
  }
  function pick() {
    var cx = +SH.val('lCx'), cy = +SH.val('lCy'), cz = +SH.val('lCz'), seen = {}, dup = 0; P = [];
    rows.forEach(function (r) { var x = parseFloat(r[cx]), y = parseFloat(r[cy]), z = parseFloat(r[cz]); if (isNaN(x) || isNaN(y) || isNaN(z)) return; var k = x.toFixed(6) + ',' + y.toFixed(6); if (seen[k]) { dup++; return; } seen[k] = 1; P.push({ x: x, y: y, z: z }); });
    $('#lInfo').innerHTML = P.length ? '<b>' + P.length + '</b> ' + t('valid points', 'نقطة صالحة') + (dup ? ' · ' + dup + t(' duplicate locations skipped', ' موقع مكرر أُهمل') : '') + (P.length > 800 ? ' · ' + t('kriging uses up to 800 points; IDW will be used', 'الكريجنغ يقبل حتى 800 نقطة؛ سيُستخدم IDW') : '') : t('No numeric X, Y, Z rows found.', 'لم يُعثر على صفوف رقمية X وY وZ.');
  }
  ['lCx', 'lCy', 'lCz'].forEach(function (id) { $('#' + id).addEventListener('change', pick); });
  $('#lFile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { if (!parse(r.result)) SH.toast(t('The file is empty.', 'الملف فارغ.'), 'warn'); else SH.toast(f.name + ' · ' + P.length + t(' points', ' نقطة'), 'ok'); }; r.readAsText(f); });
  var drop = $('#lDrop'); ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; }); });
  drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
  drop.addEventListener('drop', function (e) { e.preventDefault(); drop.style.borderColor = ''; var f = e.dataTransfer.files[0]; if (f) { var r = new FileReader(); r.onload = function () { parse(r.result); }; r.readAsText(f); } });
  $('#lPaste').addEventListener('change', function () { if (this.value.trim()) parse(this.value); });

  /* ---------- geometry */
  function hull(pts) { var p = pts.map(function (q) { return [q.x, q.y]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }, lo = [], up = [];
    p.forEach(function (q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (var i = p.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); } up.pop(); lo.pop(); return lo.concat(up); }
  function inPoly(x, y, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function invert(A) { var n = A.length, M = A.map(function (r, i) { var e = new Array(n).fill(0); e[i] = 1; return r.concat(e); });
    for (var c = 0; c < n; c++) { var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; var tmp = M[c]; M[c] = M[p]; M[p] = tmp; var pv = M[c][c] || 1e-12; for (var k = 0; k < 2 * n; k++) M[c][k] /= pv;
      for (r = 0; r < n; r++) { if (r === c) continue; var f = M[r][c]; if (!f) continue; for (k = c; k < 2 * n; k++) M[r][k] -= f * M[c][k]; } }
    return M.map(function (r) { return r.slice(n); }); }

  function run() {
    if (P.length < 4) { SH.toast(t('Load at least four points.', 'حمّل أربع نقاط على الأقل.'), 'warn'); return; }
    persist.save(); var btn = $('#lRun'); btn.disabled = true; SH.busy($('#lRun').parentElement, true);
    setTimeout(function () { try { compute(); } catch (e) { SH.toast(e.message, 'bad'); } btn.disabled = false; SH.busy($('#lRun').parentElement, false); }, 30);
  }
  function compute() {
    var geo = SH.val('lCrs') === 'geo', xs = P.map(function (p) { return p.x; }), ys = P.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), px = (x1 - x0) * 0.04 || 1, py = (y1 - y0) * 0.04 || 1;
    var b = { w: x0 - px, e: x1 + px, s: y0 - py, n: y1 + py }, m = geo ? D.metersPerDeg((y0 + y1) / 2) : { x: 1, y: 1 }, wM = (b.e - b.w) * m.x, hM = (b.n - b.s) * m.y, res = Math.max(30, Math.min(300, SH.num('lRes') || 120));
    var nx = wM >= hM ? res : Math.max(10, Math.round(res * wM / hM)), ny = hM > wM ? res : Math.max(10, Math.round(res * hM / wM));
    var meth = SH.seg('lMeth'); if (meth === 'kriging' && P.length > 800) meth = 'idw';
    // kriging is done in metric space so the variogram range is in metres
    var Pm = P.map(function (p) { return { x: (p.x - b.w) * m.x, y: (p.y - b.s) * m.y, z: p.z }; });
    var Gm = D.interp(Pm, { n: hM, s: 0, w: 0, e: wM }, nx, ny, { method: meth, power: SH.num('lPow') || 2 });
    G = { nx: nx, ny: ny, b: b, z: Gm.z, dx: wM / (nx - 1), dy: hM / (ny - 1), lats: [], lons: [], method: Gm.method, variogram: Gm.variogram, geo: geo };
    for (var j = 0; j < ny; j++) G.lats.push(b.n - (b.n - b.s) * j / (ny - 1)); for (var i = 0; i < nx; i++) G.lons.push(b.w + (b.e - b.w) * i / (nx - 1));
    G.full = { nx: nx, ny: ny, b: b, z: new Float32Array(G.z), dx: G.dx, dy: G.dy }; D.derive(G.full);
    if ($('#lHull').checked) { var H = hull(P); for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) if (!inPoly(G.lons[i], G.lats[j], H)) G.z[j * nx + i] = NaN; G.hull = H; }
    D.stats(G); D.derive(G);
    G.cv = crossval(Pm, Gm); contour();
  }
  function crossval(Pm, Gm) {
    var n = Pm.length, pred = [];
    if (Gm.method === 'kriging' && n <= 400) {
      var vg = Gm.variogram, A = []; for (var i = 0; i < n; i++) { var r = []; for (var j = 0; j < n; j++) r.push(vg.model(Math.hypot(Pm[i].x - Pm[j].x, Pm[i].y - Pm[j].y))); r.push(1); A.push(r); }
      A.push(new Array(n).fill(1).concat([0])); var Ai = invert(A), rhs = Pm.map(function (p) { return p.z; }).concat([0]);
      for (i = 0; i < n; i++) { var wi = 0; for (j = 0; j <= n; j++) wi += Ai[i][j] * rhs[j]; pred.push(Pm[i].z - wi / Ai[i][i]); }
    } else if (Gm.method === 'idw') {
      var pw = SH.num('lPow') || 2; Pm.forEach(function (p, i) { var num = 0, den = 0; Pm.forEach(function (q, k) { if (k === i) return; var w = 1 / Math.pow(Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2), pw / 2); num += w * q.z; den += w; }); pred.push(num / den); });
    } else return null;
    var e = pred.map(function (v, i) { return v - Pm[i].z; }), me = e.reduce(function (a, b) { return a + b; }, 0) / n, rmse = Math.sqrt(e.reduce(function (a, b) { return a + b * b; }, 0) / n);
    var zm = Pm.reduce(function (a, p) { return a + p.z; }, 0) / n, ss = Pm.reduce(function (a, p) { return a + Math.pow(p.z - zm, 2); }, 0), r2 = 1 - e.reduce(function (a, b) { return a + b * b; }, 0) / ss;
    return { pred: pred, obs: Pm.map(function (p) { return p.z; }), me: me, rmse: rmse, r2: r2 };
  }
  function contour() { var rz = G.max - G.min; step = SH.num('lInt') || D.niceInterval(rz, 14); if (rz / step > 300) step = D.niceInterval(rz, 40); CS = D.contours(G, D.levels(G, step)); render(); }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function render() {
    $('#lEmpty').hidden = true; $('#lOut').hidden = false; var cv = G.cv, unit = SH.val('lUnit') || t('Elevation (m)', 'الارتفاع (م)');
    $('#lKpis').innerHTML = kpi('info', t('Points', 'النقاط'), P.length, G.method === 'kriging' ? t('ordinary kriging', 'كريجنغ اعتيادي') : 'IDW p = ' + (SH.num('lPow') || 2)) + kpi('', t('Z range', 'مدى Z'), SH.fmt(G.min, 2) + ' – ' + SH.fmt(G.max, 2), unit) +
      kpi('', t('Interval', 'الفاصل'), SH.fmt(step, step < 1 ? 2 : 0), CS.length + t(' levels', ' مستوى')) + kpi('', t('Grid', 'الشبكة'), G.nx + ' × ' + G.ny, SH.fmt(G.dx, 1) + ' × ' + SH.fmt(G.dy, 1) + ' m') +
      (cv ? kpi(cv.r2 > 0.9 ? 'ok' : cv.r2 > 0.7 ? 'warn' : 'bad', t('Cross-validation RMSE', 'جذر متوسط مربع خطأ التحقق'), SH.fmt(cv.rmse, 3), 'R² = ' + SH.fmt(cv.r2, 3) + ' · ME = ' + SH.fmt(cv.me, 3)) : '');
    drawMap(); drawVar(); drawCv();
  }
  function drawMap() {
    var pts = $('#lPts').checked ? P.map(function (p) { return { x: p.x, y: p.y, label: $('#lPtL').checked ? SH.fmt(p.z, Math.abs(p.z) < 10 ? 2 : 1) : '' }; }) : [];
    var lines = G.hull && $('#lHull').checked ? [{ pts: G.hull.concat([G.hull[0]]).map(function (q) { return [q[1], q[0]]; }), color: '#7A7A7A', width: 1, dash: '3 3' }] : [];
    D.svgMap($('#lSvg'), G, CS, { crs: G.geo ? 'geo' : 'proj', interval: step, index: SH.num('lIdx') || 5, ramp: SH.val('lRamp'), fill: $('#lFill').checked, labels: $('#lLab').checked, smooth: $('#lSm').checked, grid: $('#lGrid').checked, points: pts, lines: lines,
      title: SH.val('lTitle') || t('Contour map', 'خريطة كنتورية'), subtitle: (G.method === 'kriging' ? t('Ordinary kriging, spherical model', 'كريجنغ اعتيادي، نموذج كروي') : 'IDW') + ' · ' + P.length + t(' points · interval ', ' نقطة · الفاصل ') + step, axisNames: G.geo ? null : ['X (m)', 'Y (m)'], legendTitle: SH.val('lUnit') || null, renderGrid: G.hull && $('#lHull').checked ? G.full : null, clipPoly: G.hull && $('#lHull').checked ? G.hull : null, unit: SH.val('lUnit') ? '' : ' m' });
  }
  function drawVar() {
    var v = G.variogram, p = SH.palette(); if (!v) { $('#lVar').innerHTML = '<div class="empty-s"><p>' + t('The semivariogram is computed for kriging only.', 'يُحسب نصف التباين للكريجنغ فقط.') + '</p></div>'; $('#lVarCap').textContent = ''; return; }
    var hx = [], hy = [], mx = v.exp.length ? v.exp[v.exp.length - 1].h * 1.1 : v.range * 2; for (var h = 0; h <= mx; h += mx / 80) { hx.push(h); hy.push(v.model(h)); }
    SH.plot('lVar', [{ x: v.exp.map(function (e) { return e.h; }), y: v.exp.map(function (e) { return e.g; }), mode: 'markers', name: t('Experimental', 'تجريبي'), marker: { size: v.exp.map(function (e) { return 6 + Math.min(10, Math.sqrt(e.n)); }), color: p.accent }, customdata: v.exp.map(function (e) { return e.n; }), hovertemplate: 'h %{x:.1f} m · γ %{y:.3f}<br>%{customdata} pairs<extra></extra>' },
      { x: hx, y: hy, mode: 'lines', name: t('Spherical model', 'النموذج الكروي'), line: { color: p.text, width: 2 } }], function () { return SH.plotLayout({ legend: { orientation: 'h', y: 1.1, x: 0 }, xaxis: { title: { text: t('Lag distance h (m)', 'مسافة الإزاحة h (م)') }, rangemode: 'tozero' }, yaxis: { title: { text: 'γ(h)' }, rangemode: 'tozero' } }); });
    $('#lVarCap').innerHTML = t('Nugget ', 'الكتلة ') + SH.fmt(v.nugget, 3) + ' · ' + t('partial sill ', 'العتبة الجزئية ') + SH.fmt(v.sill, 3) + ' · ' + t('range ', 'المدى ') + SH.fmt(v.range, 1) + ' m. ' + t('Weighted least squares by pair count.', 'مربعات صغرى موزونة بعدد الأزواج.');
  }
  function drawCv() {
    var c = G.cv, p = SH.palette(); if (!c) { $('#lCv').innerHTML = '<div class="empty-s"><p>' + t('Cross-validation runs for up to 400 kriging points.', 'يعمل التحقق المتقاطع حتى 400 نقطة للكريجنغ.') + '</p></div>'; $('#lCvCap').textContent = ''; return; }
    var lo = Math.min(Math.min.apply(null, c.obs), Math.min.apply(null, c.pred)), hi = Math.max(Math.max.apply(null, c.obs), Math.max.apply(null, c.pred));
    SH.plot('lCv', [{ x: [lo, hi], y: [lo, hi], mode: 'lines', line: { color: p.line2, dash: 'dash' }, hoverinfo: 'skip', showlegend: false }, { x: c.obs, y: c.pred, mode: 'markers', marker: { color: p.accent, size: 7, opacity: .8 }, showlegend: false, hovertemplate: t('observed', 'مرصود') + ' %{x:.2f} · ' + t('predicted', 'متنبأ') + ' %{y:.2f}<extra></extra>' }],
      function () { return SH.plotLayout({ xaxis: { title: { text: t('Observed Z', 'Z المرصود') } }, yaxis: { title: { text: t('Predicted Z (left out)', 'Z المتنبأ (عند الترك)') }, scaleanchor: 'x' } }); });
    $('#lCvCap').innerHTML = t('Each point is predicted from all the others. RMSE ', 'تُتنبأ كل نقطة من باقي النقاط. RMSE ') + SH.fmt(c.rmse, 3) + ', R² ' + SH.fmt(c.r2, 3) + t(', mean error ', '، متوسط الخطأ ') + SH.fmt(c.me, 3) + (G.method === 'kriging' ? t(' (Dubrule 1983 closed form).', ' (الصيغة المغلقة لـ Dubrule 1983).') : '.');
  }
  ['lIdx', 'lRamp', 'lFill', 'lLab', 'lPts', 'lPtL', 'lSm', 'lGrid', 'lTitle', 'lUnit'].forEach(function (id) { $('#' + id).addEventListener('change', function () { if (G) { persist.save(); drawMap(); } }); });
  $('#lInt').addEventListener('change', function () { if (G) contour(); });

  var nm = function () { return 'shandal-contour-lab-' + new Date().toISOString().slice(0, 10); };
  $('#ySvg').addEventListener('click', function () { if (!G) return; var s = new XMLSerializer().serializeToString($('#lSvg')); if (s.indexOf('xmlns=') < 0) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'); SH.download(nm() + '.svg', s, 'image/svg+xml'); });
  $('#yPng').addEventListener('click', function () { if (G) SH.svgPng($('#lSvg'), nm() + '.png', 2.5, '#ffffff'); });
  $('#yGeo').addEventListener('click', function () { if (!G) return; var cs = CS.map(function (c) { return { level: c.level, lines: c.lines.map(function (l) { return $('#lSm').checked ? D.smooth(l, 2) : l; }) }; }), gj = D.toGeoJSON(cs, { interval: step }); if (!G.geo) gj.crs_note = 'Coordinates are in the projected system of the input data, not WGS 84.'; SH.json(nm() + '.geojson', gj); });
  $('#yDxf').addEventListener('click', function () { if (!G) return; var o = ['0', 'SECTION', '2', 'ENTITIES'], idx = SH.num('lIdx') || 5;
    CS.forEach(function (c) { var lay = Math.round(c.level / step) % idx === 0 ? 'CONTOUR_INDEX' : 'CONTOUR'; c.lines.forEach(function (l) { if (l.length < 2) return; if ($('#lSm').checked) l = D.smooth(l, 2); o.push('0', 'POLYLINE', '8', lay, '66', '1', '10', '0', '20', '0', '30', c.level.toFixed(3), '70', '0'); l.forEach(function (q) { o.push('0', 'VERTEX', '8', lay, '10', q[1].toFixed(G.geo ? 8 : 3), '20', q[0].toFixed(G.geo ? 8 : 3), '30', c.level.toFixed(3)); }); o.push('0', 'SEQEND', '8', lay); }); });
    P.forEach(function (q) { o.push('0', 'POINT', '8', 'SURVEY_POINTS', '10', q.x.toFixed(G.geo ? 8 : 3), '20', q.y.toFixed(G.geo ? 8 : 3), '30', q.z.toFixed(3)); });
    o.push('0', 'ENDSEC', '0', 'EOF'); SH.download(nm() + '.dxf', o.join('\r\n'), 'application/dxf'); });
  $('#yCsv').addEventListener('click', function () { if (!G) return; var o = ['X,Y,Z']; for (var j = 0; j < G.ny; j++) for (var i = 0; i < G.nx; i++) { var z = G.z[j * G.nx + i]; if (!isNaN(z)) o.push(G.lons[i].toFixed(G.geo ? 7 : 3) + ',' + G.lats[j].toFixed(G.geo ? 7 : 3) + ',' + z.toFixed(3)); } SH.download(nm() + '-grid.csv', o.join('\r\n'), 'text/csv'); });
  $('#lRun').addEventListener('click', run);
  $('#lDemo').addEventListener('click', function () {
    var s = 7, rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; }, out = ['Easting,Northing,Elevation'];
    for (var k = 0; k < 60; k++) { var x = 452000 + rnd() * 1800, y = 4061000 + rnd() * 1400, z = 780 + 0.045 * (x - 452000) + 60 * Math.exp(-(Math.pow(x - 453100, 2) + Math.pow(y - 4061800, 2)) / 180000) - 25 * Math.exp(-(Math.pow(x - 452500, 2) + Math.pow(y - 4061300, 2)) / 90000) + (rnd() - 0.5) * 1.5; out.push(x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2)); }
    $('#lPaste').value = out.join('\n'); $('#lCrs').value = 'proj'; parse($('#lPaste').value); $('#lTitle').value = t('Site topography, total station survey', 'طبوغرافية الموقع، مسح بالمحطة الشاملة'); run();
  });
  document.addEventListener('sh:beforereport', function (e) { if (!G) { e.preventDefault(); SH.toast(t('Draw a map first.', 'ارسم خريطة أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (G) { drawVar(); drawCv(); } });
})();
