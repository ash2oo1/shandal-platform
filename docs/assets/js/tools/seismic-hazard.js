/* Seismic hazard explorer — USGS ComCat events around a site; Mc by maximum curvature (+0.2, Woessner & Wiemer 2005),
   Aki–Utsu b-value with Shi & Bolt (1982) uncertainty, Gutenberg–Richter rates, Poisson exceedance, nearest PB2002 boundary. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, LOG10E = Math.LOG10E;
  var persist = SH.persist('seishaz', ['hzLat', 'hzLon', 'hzR', 'hzMin', 'hzY0', 'hzLife']);
  var map = SH.map('hzMap', { zoom: 5, base: 'topo', center: [SH.num('hzLat') || 36.19, SH.num('hzLon') || 44.01], canvas: true }), mk = null, circ = null, evLay = null, plateLay = null, plates = null, last = null;
  var depthCol = function (d) { return d < 35 ? '#E63946' : d < 70 ? '#F4A261' : d < 300 ? '#2A9D8F' : '#457B9D'; };
  function site(lat, lon, fly) { $('#hzLat').value = lat.toFixed(3); $('#hzLon').value = lon.toFixed(3); persist.save(); if (!map) return; if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); var r = (SH.num('hzR') || 300) * 1000; if (circ) circ.setLatLng([lat, lon]).setRadius(r); else circ = L.circle([lat, lon], { radius: r, color: SH.css('--accent'), weight: 2, fill: false, dashArray: '6 5' }).addTo(map); if (fly) map.fitBounds(circ.getBounds(), { padding: [10, 10] }); }
  if (map) map.on('click', function (e) { site(e.latlng.lat, e.latlng.lng); });
  $('#hzGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { site(p.lat, p.lon, true); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  ['hzLat', 'hzLon', 'hzR'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var a = SH.num('hzLat'), b = SH.num('hzLon'); if (!isNaN(a) && !isNaN(b)) site(a, b, true); }); });
  site(SH.num('hzLat') || 36.19, SH.num('hzLon') || 44.01, true);
  SH.getJSON(SH.base + 'assets/data/plates.json').then(function (P) { plates = P; if (!map) return; plateLay = L.layerGroup().addTo(map); var rnd = L.canvas(); P.forEach(function (p) { var parts = [[]]; for (var i = 0; i < p[3].length; i += 2) { var cur = parts[parts.length - 1], q = [p[3][i + 1], p[3][i]]; if (cur.length && Math.abs(q[1] - cur[cur.length - 1][1]) > 180) parts.push(cur = []); cur.push(q); } parts.forEach(function (ll) { if (ll.length > 1) L.polyline(ll, { renderer: rnd, color: '#7A4F9A', weight: 1.5, opacity: .7 }).addTo(plateLay); }); }); }).catch(function () {});

  function run() {
    var lat = SH.num('hzLat'), lon = SH.num('hzLon'), R = SH.num('hzR') || 300, mn = SH.num('hzMin') || 3, y0 = Math.max(1900, SH.num('hzY0') || 1973), btn = $('#hzRun');
    if (isNaN(lat) || isNaN(lon)) { SH.toast(t('Set the site first.', 'حدد الموقع أولاً.'), 'warn'); return; }
    persist.save(); site(lat, lon, true); btn.disabled = true; SH.busy($('#hzMap').parentElement, true, t('Querying USGS ComCat…', 'جارٍ الاستعلام من USGS ComCat…'));
    SH.getJSON('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=' + lat + '&longitude=' + lon + '&maxradiuskm=' + R + '&minmagnitude=' + mn + '&starttime=' + y0 + '-01-01&orderby=time&limit=20000', { timeout: 45000 })
      .then(function (j) { var E = j.features.filter(function (f) { return f.properties.mag != null && f.properties.type === 'earthquake'; }).map(function (f) { var c = f.geometry.coordinates, p = f.properties; return { lat: c[1], lon: c[0], depth: c[2], mag: p.mag, magType: p.magType, time: p.time, place: p.place, url: p.url, d: SH.dist({ lat: lat, lon: lon }, { lat: c[1], lon: c[0] }) / 1000 }; });
        if (E.length < 15) throw new Error(t('Only ', 'فقط ') + E.length + t(' events found. Enlarge the radius, lower the minimum magnitude or start earlier.', ' حدثاً. وسّع نصف القطر أو اخفض القدر الأدنى أو ابدأ مبكراً.'));
        analyse(E, { lat: lat, lon: lon, R: R, mn: mn, y0: y0 }); })
      .catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy($('#hzMap').parentElement, false); });
  }
  function analyse(E, q) {
    var dM = 0.1, bins = {}, mags = E.map(function (e) { return Math.round(e.mag / dM) * dM; });
    mags.forEach(function (m) { var k = m.toFixed(1); bins[k] = (bins[k] || 0) + 1; });
    var ks = Object.keys(bins).map(Number).sort(function (a, b) { return a - b; }), mode = ks.reduce(function (a, k) { return bins[k.toFixed(1)] > bins[a.toFixed(1)] ? k : a; }, ks[0]), Mc = Math.round((mode + 0.2) * 10) / 10;
    var sel = mags.filter(function (m) { return m >= Mc - 1e-9; }), N = sel.length, mean = sel.reduce(function (a, b) { return a + b; }, 0) / N, b = LOG10E / (mean - (Mc - dM / 2));
    var sb = 2.3 * b * b * Math.sqrt(sel.reduce(function (a, m) { return a + Math.pow(m - mean, 2); }, 0) / (N * (N - 1)));
    var yrs = (Date.now() - Date.parse(q.y0 + '-01-01')) / 3.15576e10, a = Math.log10(N / yrs) + b * Mc, life = SH.num('hzLife') || 50;
    var lam = function (M) { return Math.pow(10, a - b * M); }, Mmax = Math.max.apply(null, E.map(function (e) { return e.mag; })), big = E.slice().sort(function (x, y) { return y.mag - x.mag; });
    var nb = null; if (plates) { var kx = 111.195 * Math.cos(SH.rad(q.lat)); plates.forEach(function (p) { for (var i = 0; i + 1 < p[3].length; i += 2) { var dx = (p[3][i] - q.lon) * kx, dy = (p[3][i + 1] - q.lat) * 111.195, d = Math.hypot(dx, dy); if (!nb || d < nb.d) nb = { d: d, name: p[0], cls: p[1], v: p[2] }; } }); }
    last = { E: E, q: q, Mc: Mc, b: b, sb: sb, a: a, N: N, yrs: yrs, lam: lam, life: life, Mmax: Mmax, big: big, bins: bins, ks: ks, nb: nb };
    render();
  }
  var PN = { SUB: t('subduction zone', 'نطاق اندساس'), OCB: t('oceanic convergent', 'تقارب محيطي'), CCB: t('continental collision', 'تصادم قاري'), OSR: t('spreading ridge', 'ظهر منتشر'), CRB: t('continental rift', 'خسيف قاري'), OTF: t('oceanic transform', 'تحويلي محيطي'), CTF: t('continental transform', 'تحويلي قاري') };
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var tr = function (y) { return y >= 1e4 ? SH.fmt(y / 1000, 0) + ' ky' : SH.fmt(y, y < 10 ? 1 : 0); };
  function render() {
    var r = last, q = r.q, P = function (M) { return 1 - Math.exp(-r.lam(M) * r.life); };
    $('#hzEmpty').hidden = true; $('#hzOut').hidden = false;
    $('#hzKpis').innerHTML = kpi('info', t('Events', 'الأحداث'), SH.fmt(r.E.length, 0), SH.fmt(r.yrs, 0) + t(' years · ', ' سنة · ') + q.R + ' km') + kpi('', 'M<sub>c</sub>', SH.fmt(r.Mc, 1), t('maximum curvature + 0.2', 'أقصى انحناء + 0.2')) +
      kpi(r.b < 0.7 || r.b > 1.3 ? 'warn' : 'ok', t('b-value', 'قيمة b'), SH.fmt(r.b, 2) + '<small> ± ' + SH.fmt(r.sb, 2) + '</small>', 'a = ' + SH.fmt(r.a, 2) + ' · N(≥M<sub>c</sub>) = ' + r.N) +
      kpi(P(6) > 0.5 ? 'bad' : P(6) > 0.1 ? 'warn' : 'ok', 'P(M≥6) ' + t('in ', 'خلال ') + r.life + t(' yr', ' سنة'), SH.fmt(100 * P(6), 0) + '<small>%</small>', 'T<sub>R</sub> = ' + tr(1 / r.lam(6)) + t(' yr', ' سنة')) +
      kpi('', t('Largest recorded', 'الأكبر المسجل'), 'M ' + SH.fmt(r.Mmax, 1), SH.fmt(r.big[0].d, 0) + ' km · ' + new Date(r.big[0].time).getUTCFullYear());
    var v = [];
    if (r.nb) v.push(verdict(r.nb.d < 100 ? 'warn' : 'info', t('Nearest plate boundary: ', 'أقرب حد صفيحي: ') + SH.fmt(r.nb.d, 0) + ' km', r.nb.name + ' · ' + (PN[r.nb.cls] || r.nb.cls) + ' · ' + r.nb.v + t(' mm/yr relative motion (Bird 2003).', ' مم/سنة حركة نسبية (Bird 2003).')));
    if (r.b < 0.7) v.push(verdict('warn', t('Low b-value', 'قيمة b منخفضة'), t('Relatively more large events than small ones. This can reflect high differential stress, but also catalogue incompleteness for small magnitudes or mixed magnitude types.', 'أحداث كبيرة أكثر نسبياً من الصغيرة. قد يعكس ذلك إجهاداً تفاضلياً عالياً، أو نقص اكتمال الفهرس للأقدار الصغيرة أو اختلاط أنواع القدر.')));
    if (r.N < 50) v.push(verdict('warn', t('Few events above Mc', 'أحداث قليلة فوق Mc'), t('With fewer than 50 events the b-value is uncertain (±', 'مع أقل من 50 حدثاً تكون قيمة b غير مؤكدة (±') + SH.fmt(r.sb, 2) + t('). Enlarge the area or the period.', '). وسّع المنطقة أو الفترة.')));
    v.push(verdict('info', t('How to use these numbers', 'كيف تُستخدم هذه الأرقام'), t('Rates describe earthquakes anywhere inside the circle, not shaking at the site. For design use the national code map or a probabilistic hazard study; the Seismic Evaluation tool turns code values into design spectra.', 'تصف المعدلات الزلازل في أي مكان داخل الدائرة، لا الاهتزاز عند الموقع. للتصميم استخدم خريطة الكود الوطني أو دراسة خطر احتمالية؛ وتحوّل أداة التقييم الزلزالي قيم الكود إلى أطياف تصميم.')));
    $('#hzVerd').innerHTML = v.join('');
    var Ms = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5].filter(function (M) { return M >= r.Mc; });
    $('#hzRates').innerHTML = '<thead><tr><th>M ≥</th><th class="num">' + t('Observed', 'مرصود') + '</th><th class="num">λ ' + t('per yr', 'سنوياً') + '</th><th class="num">T<sub>R</sub> ' + t('yr', 'سنة') + '</th><th class="num">P ' + r.life + t(' yr', ' سنة') + '</th></tr></thead><tbody>' +
      Ms.map(function (M) { var p = P(M), obs = r.E.filter(function (e) { return e.mag >= M; }).length; return '<tr><td><b>' + M.toFixed(1) + '</b></td><td class="num">' + obs + '</td><td class="num">' + (r.lam(M) < 0.01 ? r.lam(M).toExponential(2) : SH.fmt(r.lam(M), 3)) + '</td><td class="num">' + tr(1 / r.lam(M)) + '</td><td class="num"><span class="badge ' + (p > 0.5 ? 'bad' : p > 0.1 ? 'warn' : 'ok') + '">' + SH.fmt(100 * p, 1) + ' %</span></td></tr>'; }).join('') + '</tbody>';
    $('#hzBig').innerHTML = '<thead><tr><th>M</th><th>' + t('Date', 'التاريخ') + '</th><th class="num">' + t('Depth', 'العمق') + '</th><th class="num">' + t('Distance', 'المسافة') + '</th><th>' + t('Place', 'المكان') + '</th></tr></thead><tbody>' + r.big.slice(0, 12).map(function (e) { return '<tr><td><b>' + SH.fmt(e.mag, 1) + '</b> <span class="xsmall muted">' + (e.magType || '') + '</span></td><td class="ltr">' + new Date(e.time).toISOString().slice(0, 10) + '</td><td class="num">' + SH.fmt(e.depth, 0) + '</td><td class="num">' + SH.fmt(e.d, 0) + '</td><td class="xsmall"><a href="' + e.url + '" target="_blank" rel="noopener">' + SH.esc(e.place || '') + '</a></td></tr>'; }).join('') + '</tbody>';
    plots(); mapEv();
  }
  function plots() {
    var r = last, p = SH.palette(), ks = r.ks, inc = ks.map(function (k) { return r.bins[k.toFixed(1)]; }), cum = ks.map(function (k) { return r.E.filter(function (e) { return e.mag >= k - 0.05; }).length / r.yrs; });
    var gx = [r.Mc, Math.max(r.Mmax + 0.5, 7)], gy = gx.map(function (M) { return r.lam(M); });
    SH.plot('hzFmd', [{ x: ks, y: inc.map(function (n) { return n / r.yrs; }), type: 'bar', name: t('Incremental', 'تزايدي'), marker: { color: SH.alpha(p.accent, .35) } }, { x: ks, y: cum, mode: 'markers', name: t('Cumulative N(≥M)', 'تراكمي N(≥M)'), marker: { color: p.text, size: 6 } }, { x: gx, y: gy, mode: 'lines', name: 'G–R', line: { color: '#B4552D', width: 2.5 } }],
      function () { return SH.plotLayout({ barmode: 'overlay', xaxis: { title: { text: t('Magnitude', 'القدر') } }, yaxis: { type: 'log', title: { text: t('Events per year', 'أحداث في السنة') }, exponentformat: 'power' }, shapes: [{ type: 'line', x0: r.Mc, x1: r.Mc, yref: 'paper', y0: 0, y1: 1, line: { color: p.text2, dash: 'dot' } }], annotations: [{ x: r.Mc, yref: 'paper', y: 1, text: 'M<sub>c</sub>', showarrow: false, yshift: 8 }] }); });
    $('#hzFmdCap').innerHTML = 'log<sub>10</sub> N = ' + SH.fmt(r.a, 2) + ' − ' + SH.fmt(r.b, 2) + ' M ' + t('(annual rates)', '(معدلات سنوية)');
    SH.plot('hzTime', [{ x: r.E.map(function (e) { return new Date(e.time); }), y: r.E.map(function (e) { return e.mag; }), mode: 'markers', marker: { size: r.E.map(function (e) { return Math.max(3, Math.pow(e.mag, 1.6) / 2); }), color: r.E.map(function (e) { return depthCol(e.depth); }), opacity: .7 }, hovertemplate: '%{x|%Y-%m-%d} · M %{y}<extra></extra>' }], function () { return SH.plotLayout({ showlegend: false, xaxis: { type: 'date' }, yaxis: { title: { text: t('Magnitude', 'القدر') } }, shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: r.Mc, y1: r.Mc, line: { color: p.text2, dash: 'dot' } }] }); });
    SH.plot('hzDepth', [{ x: r.E.map(function (e) { return e.depth; }), type: 'histogram', xbins: { size: 5 }, marker: { color: p.accent } }], function () { return SH.plotLayout({ showlegend: false, xaxis: { title: { text: t('Depth (km)', 'العمق (كم)') } }, yaxis: { title: { text: t('Events', 'الأحداث') } } }); });
  }
  function mapEv() { if (!map) return; if (evLay) map.removeLayer(evLay); evLay = L.layerGroup().addTo(map); last.E.slice().sort(function (a, b) { return a.mag - b.mag; }).forEach(function (e) { L.circleMarker([e.lat, e.lon], { radius: Math.max(2, Math.pow(e.mag, 1.5) / 1.6), color: '#fff', weight: .6, fillColor: depthCol(e.depth), fillOpacity: .75 }).bindTooltip('M ' + e.mag + ' · ' + new Date(e.time).toISOString().slice(0, 10) + ' · ' + SH.fmt(e.depth, 0) + ' km').addTo(evLay); }); }
  $('#hzCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-catalogue.csv', [['time_utc', 'lat', 'lon', 'depth_km', 'mag', 'mag_type', 'distance_km', 'place']].concat(last.E.map(function (e) { return [new Date(e.time).toISOString(), e.lat, e.lon, e.depth, e.mag, e.magType, e.d.toFixed(1), e.place]; }))); });
  $('#hzRun').addEventListener('click', run);
  $('#hzDemo').addEventListener('click', function () { $('#hzR').value = 300; $('#hzMin').value = 3; $('#hzY0').value = 1973; site(36.19, 44.01, true); run(); });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Run the analysis first.', 'شغّل التحليل أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (last) plots(); });
})();
