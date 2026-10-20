/* Soil properties — ISRIC SoilGrids 2.0 point query (6 depths, mean and Q0.05–Q0.95), USDA texture class,
   Saxton & Rawls (2006) water retention and saturated conductivity. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('soil', ['sLat', 'sLon']), map = SH.map('sMap', { zoom: 6, base: 'satellite', locate: false, center: [SH.num('sLat') || 33.1, SH.num('sLon') || 44.5] }), mk = null, last = null;
  var PROPS = ['clay', 'sand', 'silt', 'bdod', 'soc', 'phh2o', 'cec', 'cfvo', 'nitrogen'], DEPTHS = ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm'];
  var UNIT = { clay: '%', sand: '%', silt: '%', bdod: 'g/cm³', soc: 'g/kg', phh2o: 'pH', cec: 'cmol(+)/kg', cfvo: 'vol %', nitrogen: 'g/kg' };
  var DIV = { clay: 10, sand: 10, silt: 10, bdod: 100, soc: 10, phh2o: 10, cec: 10, cfvo: 10, nitrogen: 100 };
  var POLY = { Sand: [[100, 0], [85, 0], [90, 10]], 'Loamy sand': [[85, 0], [70, 0], [85, 15], [90, 10]], 'Sandy loam': [[70, 0], [50, 0], [43, 7], [52, 7], [52, 20], [80, 20], [85, 15]], Loam: [[52, 7], [43, 7], [23, 27], [45, 27], [52, 20]], 'Silt loam': [[50, 0], [20, 0], [8, 12], [0, 12], [0, 27], [23, 27], [43, 7]], Silt: [[20, 0], [0, 0], [0, 12], [8, 12]], 'Sandy clay loam': [[80, 20], [52, 20], [45, 27], [45, 35], [65, 35]], 'Clay loam': [[45, 27], [20, 27], [20, 40], [45, 40]], 'Silty clay loam': [[20, 27], [0, 27], [0, 40], [20, 40]], 'Sandy clay': [[65, 35], [45, 35], [45, 55]], 'Silty clay': [[20, 40], [0, 40], [0, 60]], Clay: [[45, 40], [20, 40], [0, 60], [0, 100], [45, 55]] };
  var AR = { Sand: 'رمل', 'Loamy sand': 'رمل مزيجي', 'Sandy loam': 'مزيجة رملية', Loam: 'مزيجة', 'Silt loam': 'مزيجة غرينية', Silt: 'غرين', 'Sandy clay loam': 'مزيجة طينية رملية', 'Clay loam': 'مزيجة طينية', 'Silty clay loam': 'مزيجة طينية غرينية', 'Sandy clay': 'طين رملي', 'Silty clay': 'طين غريني', Clay: 'طين' };
  function inPoly(x, y, p) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; }
  function texture(sand, clay) { var s = sand + 1e-6, c = clay + 1e-6; for (var k in POLY) if (inPoly(s, c, POLY[k])) return k; for (k in POLY) if (inPoly(s - 0.3, c - 0.3, POLY[k])) return k; return '—'; }
  function saxton(S, C, OM) { S /= 100; C /= 100; OM = Math.min(OM, 8);
    var a = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031, t1500 = a + (0.14 * a - 0.02);
    var b = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299, t33 = b + (1.283 * b * b - 0.374 * b - 0.015);
    var c = 0.278 * S + 0.034 * C + 0.022 * OM - 0.018 * S * OM - 0.027 * C * OM - 0.584 * S * C + 0.078, tS33 = c + (0.636 * c - 0.107), tS = t33 + tS33 - 0.097 * S + 0.043;
    var B = (Math.log(1500) - Math.log(33)) / (Math.log(t33) - Math.log(t1500)), lam = 1 / B, Ks = 1930 * Math.pow(Math.max(tS - t33, 0), 3 - lam);
    return { wp: t1500, fc: t33, sat: tS, paw: t33 - t1500, ks: Ks }; }

  function site(lat, lon, fly) { $('#sLat').value = lat.toFixed(4); $('#sLon').value = lon.toFixed(4); persist.save(); if (!map) return; if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); if (fly) map.setView([lat, lon], 12); }
  if (map) map.on('click', function (e) { site(e.latlng.lat, e.latlng.lng); }); site(SH.num('sLat') || 33.1, SH.num('sLon') || 44.5);
  $('#sGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { site(p.lat, p.lon, true); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  ['sLat', 'sLon'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var a = SH.num('sLat'), b = SH.num('sLon'); if (!isNaN(a) && !isNaN(b)) site(a, b, true); }); });

  function run() {
    var lat = SH.num('sLat'), lon = SH.num('sLon'), btn = $('#sRun'); if (isNaN(lat) || isNaN(lon)) return; btn.disabled = true; SH.busy(btn.parentElement, true, t('Querying SoilGrids…', 'جارٍ الاستعلام من SoilGrids…'));
    var q = 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + lon.toFixed(5) + '&lat=' + lat.toFixed(5) + PROPS.map(function (p) { return '&property=' + p; }).join('') + DEPTHS.map(function (d) { return '&depth=' + d; }).join('') + '&value=mean&value=Q0.05&value=Q0.95';
    SH.getJSON(q, { timeout: 60000 }).then(function (j) {
      var P = {}; (j.properties.layers || []).forEach(function (l) { var df = (l.unit_measure && l.unit_measure.d_factor) || DIV[l.name] || 1; P[l.name] = l.depths.map(function (d) { var v = d.values; return { label: d.label, top: d.range.top_depth, bot: d.range.bottom_depth, mean: v.mean == null ? NaN : v.mean / df, lo: v['Q0.05'] == null ? NaN : v['Q0.05'] / df, hi: v['Q0.95'] == null ? NaN : v['Q0.95'] / df }; }); });
      if (!P.clay || P.clay.every(function (d) { return isNaN(d.mean); })) throw new Error(t('No soil prediction here (water, rock outcrop, urban or outside coverage).', 'لا يوجد تنبؤ للتربة هنا (مياه أو صخر مكشوف أو منطقة حضرية أو خارج التغطية).'));
      var rows = DEPTHS.map(function (_, i) { var r = { label: P.clay[i].label, top: P.clay[i].top, bot: P.clay[i].bot }; PROPS.forEach(function (p) { r[p] = P[p] ? P[p][i] : { mean: NaN }; }); var s = r.sand.mean, c = r.clay.mean, si = r.silt.mean, tot = s + c + si; if (tot > 0) { s = 100 * s / tot; c = 100 * c / tot; } r.tex = texture(s, c); r.S = s; r.C = c; r.OM = 1.724 * r.soc.mean / 10; r.h = saxton(s, c, r.OM || 0); return r; });
      last = { lat: lat, lon: lon, rows: rows }; render();
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy(btn.parentElement, false); });
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  var nm = function (k) { return SH.lang === 'ar' ? AR[k] || k : k; };
  function render() {
    var r = last.rows, top = r[0], sub = r[3], f1 = function (v, d) { return isNaN(v) ? '—' : SH.fmt(v, d == null ? 1 : d); };
    $('#sEmpty').hidden = true; $('#sOut').hidden = false;
    var pawProf = r.reduce(function (a, x) { return a + (isNaN(x.h.paw) ? 0 : x.h.paw * (x.bot - x.top) * 10); }, 0);
    $('#sKpis').innerHTML = kpi('info', t('Topsoil texture', 'قوام التربة السطحية'), nm(top.tex), f1(top.sand.mean, 0) + ' / ' + f1(top.silt.mean, 0) + ' / ' + f1(top.clay.mean, 0) + t(' % sand/silt/clay', ' % رمل/غرين/طين')) + kpi('', t('Subsoil (30–60 cm)', 'التربة تحت السطحية (30–60 سم)'), nm(sub.tex), t('clay ', 'الطين ') + f1(sub.clay.mean, 0) + ' %') +
      kpi(top.phh2o.mean > 8.5 ? 'warn' : top.phh2o.mean < 5.5 ? 'warn' : 'ok', 'pH (H₂O)', f1(top.phh2o.mean), top.phh2o.mean > 8.5 ? t('strongly alkaline, sodicity possible', 'قاعدي بقوة، احتمال الصودية') : top.phh2o.mean > 7.3 ? t('alkaline (calcareous)', 'قاعدي (كلسي)') : top.phh2o.mean < 5.5 ? t('acidic', 'حامضي') : t('near neutral', 'قريب من التعادل')) +
      kpi(top.soc.mean < 6 ? 'warn' : '', t('Organic carbon', 'الكربون العضوي'), f1(top.soc.mean) + '<small> g/kg</small>', 'OM ≈ ' + f1(top.OM, 2) + ' %') + kpi('', t('Plant-available water to 2 m', 'الماء المتاح للنبات حتى 2 م'), SH.fmt(pawProf, 0) + '<small> mm</small>', 'Saxton & Rawls (2006)');
    var lab = r.map(function (x) { return x.label; }), p = SH.palette();
    SH.plot('sTex', [['sand', '#E9C46A', t('Sand', 'رمل')], ['silt', '#A3B18A', t('Silt', 'غرين')], ['clay', '#BC6C25', t('Clay', 'طين')]].map(function (k) { return { type: 'bar', orientation: 'h', y: lab, x: r.map(function (x) { return x[k[0]].mean; }), name: k[2], marker: { color: k[1] }, hovertemplate: '%{y}: %{x:.1f} %<extra>' + k[2] + '</extra>' }; }),
      function () { return SH.plotLayout({ barmode: 'stack', yaxis: { autorange: 'reversed', title: { text: t('Depth', 'العمق') } }, xaxis: { range: [0, 100], title: { text: '%' } } }); });
    tri(r);
    var specs = [['phh2o', 'pH', 'x'], ['soc', 'SOC g/kg', 'x2'], ['bdod', t('Bulk density g/cm³', 'الكثافة الظاهرية g/cm³'), 'x3'], ['cec', 'CEC cmol/kg', 'x4']], mids = r.map(function (x) { return (x.top + x.bot) / 2; }), cols = ['#2A9D8F', '#6A994E', '#9A7631', '#7A4F9A'];
    SH.plot('sProp', specs.map(function (s, i) { return { x: r.map(function (x) { return x[s[0]].mean; }), y: mids, xaxis: s[2], yaxis: 'y', mode: 'lines+markers', name: s[1], line: { color: cols[i], width: 2.5, shape: 'hv' }, marker: { size: 7 }, error_x: { type: 'data', symmetric: false, array: r.map(function (x) { return x[s[0]].hi - x[s[0]].mean; }), arrayminus: r.map(function (x) { return x[s[0]].mean - x[s[0]].lo; }), color: SH.alpha(cols[i], .5), thickness: 1.2 } }; }),
      function () { var lay = SH.plotLayout({ grid: { rows: 1, columns: 4, pattern: 'independent' }, yaxis: { autorange: 'reversed', title: { text: t('Depth (cm)', 'العمق (سم)') } }, showlegend: false }); specs.forEach(function (s, i) { var k = i ? 'xaxis' + (i + 1) : 'xaxis'; lay[k] = Object.assign({}, lay.xaxis || {}, { title: { text: s[1] }, domain: [i * 0.25 + 0.02, (i + 1) * 0.25 - 0.02] }); if (i) lay['yaxis' + (i + 1)] = { matches: 'y', showticklabels: false }; }); return lay; });
    $('#sTbl').innerHTML = '<thead><tr><th>' + t('Depth', 'العمق') + '</th><th>USDA</th><th class="num">' + t('Sand', 'رمل') + '</th><th class="num">' + t('Silt', 'غرين') + '</th><th class="num">' + t('Clay', 'طين') + '</th><th class="num">BD</th><th class="num">SOC</th><th class="num">pH</th><th class="num">CEC</th><th class="num">' + t('Gravel', 'حصى') + '</th><th class="num">θ<sub>FC</sub></th><th class="num">θ<sub>WP</sub></th><th class="num">K<sub>sat</sub> mm/h</th></tr></thead><tbody>' +
      r.map(function (x) { return '<tr><td>' + x.label + '</td><td>' + nm(x.tex) + '</td><td class="num">' + f1(x.sand.mean, 0) + '</td><td class="num">' + f1(x.silt.mean, 0) + '</td><td class="num">' + f1(x.clay.mean, 0) + '</td><td class="num">' + f1(x.bdod.mean, 2) + '</td><td class="num">' + f1(x.soc.mean) + '</td><td class="num">' + f1(x.phh2o.mean) + '</td><td class="num">' + f1(x.cec.mean) + '</td><td class="num">' + f1(x.cfvo.mean, 0) + '</td><td class="num">' + f1(x.h.fc, 3) + '</td><td class="num">' + f1(x.h.wp, 3) + '</td><td class="num">' + f1(x.h.ks, 1) + '</td></tr>'; }).join('') + '</tbody>';
  }
  function tri(r) {
    var S = SH.svgB('sTri'), c = SH.palette(), A = [40, 400], B = [480, 400], C = [260, 19], P = function (sand, clay) { var silt = 100 - sand - clay; return [A[0] * sand / 100 + B[0] * silt / 100 + C[0] * clay / 100, A[1] * sand / 100 + B[1] * silt / 100 + C[1] * clay / 100]; };
    S.add('rect', { x: 0, y: 0, width: 520, height: 440, fill: SH.css('--il-bg') }); var fills = ['#F4E3B5', '#E9D8A6', '#DDE5B6', '#CFE1C1', '#E6CCB2', '#D6CCC2'], i = 0;
    for (var k in POLY) { var pts = POLY[k].map(function (q) { return P(q[0], q[1]); }); S.poly(pts, { fill: fills[i++ % fills.length], stroke: '#6b5b45', 'stroke-width': 1 }); var cx = pts.reduce(function (a, q) { return a + q[0]; }, 0) / pts.length, cy = pts.reduce(function (a, q) { return a + q[1]; }, 0) / pts.length; S.text(cx, cy + 3, nm(k), { 'font-size': 9.5, fill: '#4a3f30', 'text-anchor': 'middle' }); }
    S.text(122, 196, t('Clay %', 'الطين %'), { 'font-size': 12, 'font-weight': 700, fill: c.text, transform: 'rotate(-60 122 196)', 'text-anchor': 'middle' }); S.text(398, 196, t('Silt %', 'الغرين %'), { 'font-size': 12, 'font-weight': 700, fill: c.text, transform: 'rotate(60 398 196)', 'text-anchor': 'middle' }); S.text(260, 430, t('Sand %', 'الرمل %'), { 'font-size': 12, 'font-weight': 700, fill: c.text, 'text-anchor': 'middle' });
    var pal = ['#03045E', '#0077B6', '#00B4D8', '#E76F51', '#D62828', '#6A040F'];
    r.forEach(function (x, j) { if (isNaN(x.S)) return; var q = P(x.S, x.C); S.circle(q[0], q[1], 6, { fill: pal[j], stroke: '#fff', 'stroke-width': 1.5 }); });
    r.forEach(function (x, j) { S.circle(30, 30 + j * 16, 5, { fill: pal[j] }); S.text(40, 34 + j * 16, x.label, { 'font-size': 10, fill: c.text2 }); });
  }
  $('#sCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-soilgrids-' + last.lat.toFixed(4) + '_' + last.lon.toFixed(4) + '.csv', [['depth', 'usda_texture', 'sand_pct', 'silt_pct', 'clay_pct', 'bdod_g_cm3', 'soc_g_kg', 'ph_h2o', 'cec_cmol_kg', 'cfvo_vol_pct', 'nitrogen_g_kg', 'theta_fc', 'theta_wp', 'theta_sat', 'ksat_mm_h']].concat(last.rows.map(function (x) { return [x.label, x.tex, x.sand.mean, x.silt.mean, x.clay.mean, x.bdod.mean, x.soc.mean, x.phh2o.mean, x.cec.mean, x.cfvo.mean, x.nitrogen.mean, x.h.fc.toFixed(3), x.h.wp.toFixed(3), x.h.sat.toFixed(3), x.h.ks.toFixed(2)]; }))); });
  $('#sRun').addEventListener('click', run);
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Query a location first.', 'استعلم عن موقع أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (last) render(); });
})();
