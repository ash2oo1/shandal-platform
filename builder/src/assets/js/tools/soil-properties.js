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

  /* SoilGrids masks built-up land, permanent water and ice. When the point falls in such a pixel, one WCS
     request (GeoTIFF, deflate + horizontal predictor, decoded in the browser) finds the nearest predicted pixel. */
  function tiff(buf) {
    var v = new DataView(buf), le = v.getUint16(0) === 0x4949, u16 = function (o) { return v.getUint16(o, le); }, u32 = function (o) { return v.getUint32(o, le); };
    var off = u32(4), n = u16(off), T = {};
    for (var i = 0; i < n; i++) { var e = off + 2 + i * 12, tag = u16(e), typ = u16(e + 2), cnt = u32(e + 4), sz = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 }[typ] || 1, p = cnt * sz > 4 ? u32(e + 8) : e + 8, arr = [];
      for (var k = 0; k < Math.min(cnt, 4096); k++) { var o = p + k * sz; arr.push(typ === 3 ? u16(o) : typ === 4 ? u32(o) : typ === 12 ? v.getFloat64(o, le) : typ === 5 ? u32(o) / u32(o + 4) : v.getUint8(o)); } T[tag] = arr; }
    var W = T[256][0], H = T[257][0], tw = (T[322] || [W])[0], th = (T[323] || [H])[0], offs = T[324] || T[273], cnts = T[325] || T[279], comp = (T[259] || [1])[0], pred = (T[317] || [1])[0], signed = (T[339] || [1])[0] === 2;
    var tilesX = Math.ceil(W / tw), out = new Float32Array(W * H);
    return Promise.all(offs.map(function (o, idx) { var raw = new Uint8Array(buf, o, cnts[idx]);
      var p = comp === 8 || comp === 32946 ? new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer() : comp === 1 ? Promise.resolve(raw.slice().buffer) : Promise.reject(new Error('TIFF compression ' + comp));
      return p.then(function (ab) { var dv = new DataView(ab), a = new Int32Array(tw * th);
        for (var q = 0; q < tw * th && q * 2 + 1 < ab.byteLength; q++) a[q] = signed ? dv.getInt16(q * 2, le) : dv.getUint16(q * 2, le);
        if (pred === 2) for (var y = 0; y < th; y++) for (var x = 1; x < tw; x++) { var z = a[y * tw + x] + a[y * tw + x - 1]; a[y * tw + x] = signed ? (z << 16 >> 16) : (z & 0xffff); }
        var tx = (idx % tilesX) * tw, ty = Math.floor(idx / tilesX) * th;
        for (y = 0; y < th; y++) for (x = 0; x < tw; x++) { var X = tx + x, Y = ty + y; if (X < W && Y < H) out[Y * W + X] = a[y * tw + x]; } }); }))
      .then(function () { var sc = T[33550], tp = T[33922]; return { W: W, H: H, data: out, x0: tp[3] - tp[0] * sc[0], y0: tp[4] + tp[1] * sc[1], dx: sc[0], dy: sc[1] }; });
  }
  function nearestValid(lat, lon) {
    var d = 0.11, u = 'https://maps.isric.org/mapserv?map=/map/clay.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=clay_0-5cm_mean&FORMAT=image/tiff&SUBSET=long(' + (lon - d).toFixed(5) + ',' + (lon + d).toFixed(5) + ')&SUBSET=lat(' + (lat - d).toFixed(5) + ',' + (lat + d).toFixed(5) + ')&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326';
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('WCS ' + r.status); return r.arrayBuffer(); }).then(tiff).then(function (G) {
      var best = null, n = 0;
      for (var y = 0; y < G.H; y++) for (var x = 0; x < G.W; x++) { if (!(G.data[y * G.W + x] > 0)) continue; n++; var la = G.y0 - (y + .5) * G.dy, lo = G.x0 + (x + .5) * G.dx, dd = Math.hypot((la - lat) * 110574, (lo - lon) * 111320 * Math.cos(SH.rad(lat))); if (!best || dd < best.d) best = { lat: la, lon: lo, d: dd }; }
      if (best) { best.masked = 1 - n / (G.W * G.H); best.az = (SH.deg(Math.atan2((best.lon - lon) * Math.cos(SH.rad(lat)), best.lat - lat)) + 360) % 360; }
      return best;
    });
  }
  var alt = null;
  function query(lat, lon) {
    var q = 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + lon.toFixed(5) + '&lat=' + lat.toFixed(5) + PROPS.map(function (p) { return '&property=' + p; }).join('') + DEPTHS.map(function (d) { return '&depth=' + d; }).join('') + '&value=mean&value=Q0.05&value=Q0.95';
    return SH.getJSON(q, { timeout: 60000 }).then(function (j) {
      var P = {}; (j.properties.layers || []).forEach(function (l) { var df = (l.unit_measure && l.unit_measure.d_factor) || DIV[l.name] || 1; P[l.name] = l.depths.map(function (d) { var v = d.values; return { label: d.label, top: d.range.top_depth, bot: d.range.bottom_depth, mean: v.mean == null ? NaN : v.mean / df, lo: v['Q0.05'] == null ? NaN : v['Q0.05'] / df, hi: v['Q0.95'] == null ? NaN : v['Q0.95'] / df }; }); });
      return P;
    });
  }
  var DIRS = function (az) { var en = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'], ar = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'], i = Math.round(az / 45) % 8; return t(en[i], ar[i]); };
  function run() {
    var lat = SH.num('sLat'), lon = SH.num('sLon'), btn = $('#sRun'), host = $('.ws-main'); if (isNaN(lat) || isNaN(lon)) return; btn.disabled = true; SH.busy(host, true, t('Querying ISRIC SoilGrids 2.0…', 'جارٍ الاستعلام من ISRIC SoilGrids 2.0…'));
    if (alt && map) { map.removeLayer(alt); alt = null; }
    var empty = function (P) { return !P.clay || P.clay.every(function (d) { return isNaN(d.mean); }); }, note = null;
    query(lat, lon).then(function (P) {
      if (!empty(P)) return P;
      SH.busy(host, true, t('This point is masked by SoilGrids — searching the nearest predicted soil pixel…', 'هذه النقطة مُقنَّعة في SoilGrids — جارٍ البحث عن أقرب خلية تربة متنبأ بها…'));
      return nearestValid(lat, lon).then(function (b) {
        if (!b) throw new Error(t('SoilGrids has no soil prediction within about 12 km of this point. SoilGrids 2.0 does not predict soil under built-up land, permanent water bodies, ice or bare rock, which are masked using global land-cover maps. Choose a point on open land.', 'لا يوجد تنبؤ للتربة في SoilGrids ضمن نحو 12 كم من هذه النقطة. لا يتنبأ SoilGrids 2.0 بالتربة تحت المناطق المبنية والمسطحات المائية الدائمة والجليد والصخر المكشوف، إذ تُقنَّع هذه المناطق بخرائط الغطاء الأرضي العالمية. اختر نقطة على أرض مكشوفة.'));
        note = b; SH.busy(host, true, t('Nearest predicted pixel found ', 'وُجدت أقرب خلية متنبأ بها على بعد ') + SH.fmt(b.d, 0) + t(' m away — querying it…', ' م — جارٍ الاستعلام عنها…'));
        return query(b.lat, b.lon).then(function (P2) { if (empty(P2)) throw new Error(t('No prediction returned for the nearest pixel either. Try another point.', 'لم تُرجع الخدمة تنبؤاً لأقرب خلية أيضاً. جرّب نقطة أخرى.')); return P2; });
      });
    }).then(function (P) {
      var rows = DEPTHS.map(function (_, i) { var r = { label: P.clay[i].label, top: P.clay[i].top, bot: P.clay[i].bot }; PROPS.forEach(function (p) { r[p] = P[p] ? P[p][i] : { mean: NaN }; }); var s = r.sand.mean, c = r.clay.mean, si = r.silt.mean, tot = s + c + si; if (tot > 0) { s = 100 * s / tot; c = 100 * c / tot; } r.tex = texture(s, c); r.S = s; r.C = c; r.OM = 1.724 * r.soc.mean / 10; r.h = saxton(s, c, r.OM || 0); return r; });
      last = { lat: lat, lon: lon, rows: rows, near: note };
      if (note && map) { alt = L.layerGroup([L.polyline([[lat, lon], [note.lat, note.lon]], { color: '#1F6FB2', weight: 2, dashArray: '5 4' }), L.circleMarker([note.lat, note.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#1F6FB2', fillOpacity: 1 }).bindTooltip(t('Nearest predicted soil pixel', 'أقرب خلية تربة متنبأ بها'))]).addTo(map); map.fitBounds(L.latLngBounds([[lat, lon], [note.lat, note.lon]]).pad(1.2), { maxZoom: 14 }); }
      render();
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy(host, false); });
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  var nm = function (k) { return SH.lang === 'ar' ? AR[k] || k : k; };
  function render() {
    var r = last.rows, top = r[0], sub = r[3], f1 = function (v, d) { return isNaN(v) ? '—' : SH.fmt(v, d == null ? 1 : d); };
    $('#sEmpty').hidden = true; $('#sOut').hidden = false;
    var pawProf = r.reduce(function (a, x) { return a + (isNaN(x.h.paw) ? 0 : x.h.paw * (x.bot - x.top) * 10); }, 0);
    var num = function (v, d, u) { return '<span class="ltr">' + f1(v, d) + (u ? '&nbsp;' + u : '') + '</span>'; };
    $('#sKpis').innerHTML = kpi('info', t('Topsoil texture (0–30 cm)', 'قوام التربة السطحية (0–30 سم)'), nm(top.tex), t('Sand ', 'رمل ') + num(top.sand.mean, 0, '%') + ' · ' + t('Silt ', 'غرين ') + num(top.silt.mean, 0, '%') + ' · ' + t('Clay ', 'طين ') + num(top.clay.mean, 0, '%')) +
      kpi('', t('Subsoil texture (30–60 cm)', 'قوام التربة تحت السطحية (30–60 سم)'), nm(sub.tex), t('Clay ', 'طين ') + num(sub.clay.mean, 0, '%')) +
      kpi(top.phh2o.mean > 8.5 ? 'warn' : top.phh2o.mean < 5.5 ? 'warn' : 'ok', t('Soil reaction', 'تفاعل التربة') + ' pH', num(top.phh2o.mean, 1), top.phh2o.mean > 8.5 ? t('strongly alkaline, sodicity possible', 'قاعدي بقوة، احتمال الصودية') : top.phh2o.mean > 7.3 ? t('alkaline (calcareous)', 'قاعدي (كلسي)') : top.phh2o.mean < 5.5 ? t('acidic', 'حامضي') : t('near neutral', 'قريب من التعادل')) +
      kpi(top.soc.mean < 6 ? 'warn' : '', t('Organic carbon', 'الكربون العضوي'), num(top.soc.mean, 1) + '<small class="ltr"> g/kg</small>', t('Organic matter ≈ ', 'المادة العضوية ≈ ') + num(top.OM, 2, '%')) +
      kpi('', t('Plant-available water to 2 m', 'الماء المتاح للنبات حتى 2 م'), num(pawProf, 0) + '<small class="ltr"> mm</small>', 'Saxton &amp; Rawls (2006)');
    $('#sNear').hidden = !last.near; if (last.near) $('#sNear').innerHTML = '<span class="ib">' + SH.icon('info') + '</span><div><b>' + t('The selected point is masked in SoilGrids', 'النقطة المختارة مُقنَّعة في SoilGrids') + '</b><p style="margin:4px 0 0;line-height:1.8">' +
      t('SoilGrids 2.0 does not predict soil properties under built-up land, permanent water or ice: those pixels are excluded with global land-cover masks before the machine-learning model is applied (Poggio et al., 2021). The results below are for the nearest predicted 250 m pixel, ', 'لا يتنبأ SoilGrids 2.0 بخصائص التربة تحت المناطق المبنية والمياه الدائمة والجليد؛ إذ تُستبعد هذه الخلايا بأقنعة الغطاء الأرضي العالمية قبل تطبيق نموذج تعلّم الآلة (Poggio وآخرون، 2021). النتائج أدناه لأقرب خلية متنبأ بها بدقة 250 م، على بعد ') +
      '<b class="ltr">' + SH.fmt(last.near.d, 0) + ' m</b>' + t(' to the ', ' باتجاه ') + DIRS(last.near.az) + ' (<span class="ltr">' + last.near.lat.toFixed(5) + ', ' + last.near.lon.toFixed(5) + '</span>). ' +
      t('About ', 'نحو ') + '<b class="ltr">' + SH.fmt(last.near.masked * 100, 0) + ' %</b>' + t(' of the surrounding 24 × 24 km window is masked. Natural soil under a city has usually been sealed, excavated or replaced by fill, so test pits are needed on the site itself.', ' من النافذة المحيطة 24 × 24 كم مُقنَّعة. التربة الطبيعية تحت المدن تكون غالباً مغلقة أو محفورة أو مستبدلة بالردم، لذلك تلزم حفر اختبارية في الموقع نفسه.') + '</p></div>';
    interp(r, pawProf);
    var lab = r.map(function (x) { return x.label; }), p = SH.palette();
    SH.plot('sTex', [['sand', '#E9C46A', t('Sand', 'رمل')], ['silt', '#A3B18A', t('Silt', 'غرين')], ['clay', '#BC6C25', t('Clay', 'طين')]].map(function (k) { return { type: 'bar', orientation: 'h', y: lab, x: r.map(function (x) { return x[k[0]].mean; }), name: k[2], marker: { color: k[1], line: { color: '#fff', width: 1 } }, customdata: r.map(function (x) { return [x[k[0]].lo, x[k[0]].hi]; }), text: r.map(function (x) { return SH.fmt(x[k[0]].mean, 0) + '%'; }), textposition: 'inside', insidetextanchor: 'middle', textfont: { color: '#1b1b1b', size: 12 }, hovertemplate: '<b>' + k[2] + '</b> · %{y}<br>%{x:.1f} %  (5–95 %: %{customdata[0]:.0f}–%{customdata[1]:.0f})<extra></extra>' }; }),
      function () { return SH.plotLayout({ barmode: 'stack', bargap: .28, margin: { l: 86, r: 16, t: 44, b: 48 }, legend: { orientation: 'h', x: .5, xanchor: 'center', y: 1.1 }, yaxis: { autorange: 'reversed', title: { text: t('Depth interval', 'فترة العمق') } }, xaxis: { range: [0, 100], ticksuffix: ' %', title: { text: t('Mass fraction of the fine earth (< 2 mm)', 'النسبة الوزنية للتربة الناعمة (< 2 ملم)') } } }); });
    tri(r);
    var specs = [['phh2o', 'pH', 'x'], ['soc', 'SOC g/kg', 'x2'], ['bdod', t('Bulk density g/cm³', 'الكثافة الظاهرية g/cm³'), 'x3'], ['cec', 'CEC cmol/kg', 'x4']], mids = r.map(function (x) { return (x.top + x.bot) / 2; }), cols = ['#2A9D8F', '#6A994E', '#9A7631', '#7A4F9A'];
    SH.plot('sProp', specs.map(function (s, i) { return { x: r.map(function (x) { return x[s[0]].mean; }), y: mids, xaxis: s[2], yaxis: 'y', mode: 'lines+markers', name: s[1], line: { color: cols[i], width: 2.5, shape: 'hv' }, marker: { size: 7 }, error_x: { type: 'data', symmetric: false, array: r.map(function (x) { return x[s[0]].hi - x[s[0]].mean; }), arrayminus: r.map(function (x) { return x[s[0]].mean - x[s[0]].lo; }), color: SH.alpha(cols[i], .5), thickness: 1.2 } }; }),
      function () { var lay = SH.plotLayout({ grid: { rows: 1, columns: 4, pattern: 'independent' }, yaxis: { autorange: 'reversed', title: { text: t('Depth (cm)', 'العمق (سم)') } }, showlegend: false }); specs.forEach(function (s, i) { var k = i ? 'xaxis' + (i + 1) : 'xaxis'; lay[k] = Object.assign({}, lay.xaxis || {}, { title: { text: s[1] }, domain: [i * 0.25 + 0.02, (i + 1) * 0.25 - 0.02] }); if (i) lay['yaxis' + (i + 1)] = { matches: 'y', showticklabels: false }; }); return lay; });
    $('#sTbl').innerHTML = '<thead><tr><th>' + t('Depth', 'العمق') + '</th><th>USDA</th><th class="num">' + t('Sand', 'رمل') + '</th><th class="num">' + t('Silt', 'غرين') + '</th><th class="num">' + t('Clay', 'طين') + '</th><th class="num">BD</th><th class="num">SOC</th><th class="num">pH</th><th class="num">CEC</th><th class="num">' + t('Gravel', 'حصى') + '</th><th class="num">θ<sub>FC</sub></th><th class="num">θ<sub>WP</sub></th><th class="num">K<sub>sat</sub> mm/h</th></tr></thead><tbody>' +
      r.map(function (x) { return '<tr><td>' + x.label + '</td><td>' + nm(x.tex) + '</td><td class="num">' + f1(x.sand.mean, 0) + '</td><td class="num">' + f1(x.silt.mean, 0) + '</td><td class="num">' + f1(x.clay.mean, 0) + '</td><td class="num">' + f1(x.bdod.mean, 2) + '</td><td class="num">' + f1(x.soc.mean) + '</td><td class="num">' + f1(x.phh2o.mean) + '</td><td class="num">' + f1(x.cec.mean) + '</td><td class="num">' + f1(x.cfvo.mean, 0) + '</td><td class="num">' + f1(x.h.fc, 3) + '</td><td class="num">' + f1(x.h.wp, 3) + '</td><td class="num">' + f1(x.h.ks, 1) + '</td></tr>'; }).join('') + '</tbody>';
  }
  function interp(r, paw) {
    var top = r[0], sub = r[3], deep = r[5], f = function (v, d) { return '<span class="ltr">' + (isNaN(v) ? '—' : SH.fmt(v, d)) + '</span>'; }, P = [];
    var clayT = top.C, sandT = top.S, ph = top.phh2o.mean, soc = top.soc.mean, bd = top.bdod.mean, cec = top.cec.mean, cf = top.cfvo ? top.cfvo.mean : NaN, dClay = sub.C - top.C;
    P.push(t('<b>Texture and structure.</b> The topsoil is ', '<b>القوام والبنية.</b> التربة السطحية ') + '<b>' + nm(top.tex) + '</b>' + t(' with ', ' بنسبة طين ') + f(clayT, 0) + ' %' + t(' clay and ', ' ورمل ') + f(sandT, 0) + ' %' + t(' sand. ', '. ') +
      (clayT >= 35 ? t('Such clay-rich soil drains slowly, holds water and nutrients well, swells when wet and cracks when dry; it is sticky and hard to work when moist.', 'التربة الغنية بالطين تصرّف الماء ببطء وتحتفظ بالماء والعناصر جيداً، وتنتفخ عند الترطيب وتتشقق عند الجفاف، وتكون لزجة وصعبة الحراثة وهي رطبة.') : sandT >= 65 ? t('Sandy soil drains and warms quickly but holds little water or nutrients and is prone to wind erosion.', 'التربة الرملية سريعة التصريف والتسخين لكنها قليلة الاحتفاظ بالماء والعناصر ومعرّضة للتعرية الريحية.') : t('This balanced texture combines reasonable drainage with good water retention and workability.', 'هذا القوام المتوازن يجمع بين تصريف معقول واحتفاظ جيد بالماء وسهولة في الحراثة.')) +
      (Math.abs(dClay) >= 8 ? ' ' + (dClay > 0 ? t('Clay increases by ', 'يزداد الطين بمقدار ') + f(dClay, 0) + t(' points in the subsoil, which suggests clay illuviation or a finer parent material below.', ' نقطة في التربة تحت السطحية، ما يشير إلى ترسيب طيني مغسول أو إلى مادة أصل أنعم في الأسفل.') : t('Clay decreases with depth, typical of layered alluvium.', 'يقل الطين مع العمق، وهذا نموذجي للرسوبيات الغرينية الطبقية.')) : ''));
    P.push(t('<b>Chemistry.</b> ', '<b>الكيمياء.</b> ') + 'pH ' + f(ph, 1) + ': ' + (ph > 8.5 ? t('strongly alkaline; exchangeable sodium may be high, which disperses clay and lowers infiltration — test ESP/SAR before irrigation.', 'قاعدية قوية؛ قد يكون الصوديوم المتبادل مرتفعاً فيُشتّت الطين ويقلل الترشيح — افحص ESP/SAR قبل الري.') : ph > 7.3 ? t('alkaline, typical of calcareous (and often gypsiferous) soils of arid regions; phosphorus, iron and zinc availability is reduced.', 'قاعدية، وهذا نموذجي للترب الكلسية (والجبسية غالباً) في المناطق الجافة؛ تقل جاهزية الفسفور والحديد والزنك.') : ph < 5.5 ? t('acidic; aluminium toxicity and low base saturation are possible.', 'حامضية؛ يحتمل سمّية الألمنيوم وانخفاض التشبع القاعدي.') : t('near neutral, favourable for most crops.', 'قريبة من التعادل، ملائمة لمعظم المحاصيل.')) + ' ' +
      t('Organic carbon ', 'الكربون العضوي ') + f(soc, 1) + ' g/kg ' + (soc < 6 ? t('is low, so aggregate stability and biological activity are limited.', 'منخفض، لذا تكون ثباتية التجمعات والنشاط الحيوي محدودة.') : soc < 15 ? t('is moderate.', 'متوسط.') : t('is high.', 'مرتفع.')) + ' ' +
      t('CEC ', 'السعة التبادلية الكاتيونية ') + f(cec, 1) + ' cmol(+)/kg ' + (cec < 10 ? t('indicates a low nutrient-holding capacity.', 'تدل على قدرة منخفضة على الاحتفاظ بالعناصر.') : cec < 25 ? t('indicates a moderate nutrient-holding capacity.', 'تدل على قدرة متوسطة على الاحتفاظ بالعناصر.') : t('indicates a high nutrient-holding capacity, consistent with smectitic clay or organic matter.', 'تدل على قدرة عالية على الاحتفاظ بالعناصر، بما يتسق مع طين سمكتايتي أو مادة عضوية.')));
    P.push(t('<b>Physical and engineering notes.</b> Bulk density ', '<b>ملاحظات فيزيائية وهندسية.</b> الكثافة الظاهرية ') + f(bd, 2) + ' g/cm³ ' + (bd > 1.6 ? t('is high enough to restrict root growth and indicates compaction.', 'مرتفعة بما يكفي لتقييد نمو الجذور وتدل على انضغاط.') : bd < 1.1 ? t('is low (loose or organic soil).', 'منخفضة (تربة مفككة أو عضوية).') : t('is in the normal range.', 'ضمن المدى الطبيعي.')) +
      (isFinite(cf) && cf > 15 ? ' ' + t('Coarse fragments occupy ', 'تشغل القطع الخشنة ') + f(cf, 0) + t(' % of the volume, which reduces water storage and hinders excavation.', ' % من الحجم، ما يقلل خزن الماء ويعيق الحفر.') : '') + ' ' +
      t('The profile stores about ', 'يخزن المقطع نحو ') + f(paw, 0) + ' mm ' + t('of plant-available water to 2 m. ', 'من الماء المتاح للنبات حتى 2 م. ') +
      (sub.C >= 35 ? t('High subsoil clay suggests moderate to high shrink–swell potential: confirm with Atterberg limits and free-swell tests before founding light structures.', 'ارتفاع الطين تحت السطحي يشير إلى احتمال انتفاخ وانكماش متوسط إلى عالٍ: أكّده بحدود أتربرغ وفحص الانتفاخ الحر قبل تأسيس المنشآت الخفيفة.') : t('Subsoil clay content suggests a low to moderate shrink–swell potential.', 'محتوى الطين تحت السطحي يشير إلى احتمال انتفاخ وانكماش منخفض إلى متوسط.')));
    P.push('<span class="xsmall muted">' + t('Values are SoilGrids 2.0 predictions (median of a quantile random forest, 250 m) with 5–95 % prediction intervals; they describe the typical soil of the pixel, not a sample. Reference: Poggio, L. et al. (2021) SOIL 7, 217–240.', 'القيم تنبؤات SoilGrids 2.0 (وسيط غابة عشوائية كمّية، 250 م) مع فترات تنبؤ 5–95 %؛ وهي تصف التربة النموذجية للخلية لا عينة فعلية. المرجع: Poggio وآخرون (2021) SOIL 7، 217–240.') + '</span>');
    $('#sInterp').innerHTML = P.map(function (x) { return '<p style="margin:0 0 10px;line-height:1.9">' + x + '</p>'; }).join('');
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
