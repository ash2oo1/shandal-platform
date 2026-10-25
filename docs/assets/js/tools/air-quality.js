/* Air quality — CAMS (Copernicus) air-quality point service: current US/EU AQI, pollutants, dust and AOD,
   5-day hourly forecast, WHO 2021 guideline comparison and a smooth regional map with category isolines. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('aq', ['qLat', 'qLon', 'qIdx']), map = SH.map('qMap', { zoom: 7, base: 'light', center: [SH.num('qLat') || 33.3, SH.num('qLon') || 44.37] }), mk = null, gridLay = null, last = null;
  var VARS = 'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,aerosol_optical_depth,uv_index';
  var USC = [[50, '#00E400', t('Good', 'جيدة'), t('Air quality is satisfactory.', 'جودة الهواء مُرضية.')], [100, '#FFDD00', t('Moderate', 'معتدلة'), t('Acceptable; unusually sensitive people should reduce long heavy exertion.', 'مقبولة؛ على الحساسين جداً تقليل المجهود الطويل الشاق.')], [150, '#FF7E00', t('Unhealthy for sensitive groups', 'غير صحية للفئات الحساسة'), t('Children, older adults and people with asthma or heart disease should limit outdoor exertion.', 'على الأطفال وكبار السن ومرضى الربو والقلب تقليل المجهود في الخارج.')], [200, '#FF0000', t('Unhealthy', 'غير صحية'), t('Everyone may feel effects. Wear an FFP2/N95 mask outdoors and shorten field work.', 'قد يتأثر الجميع. ارتدِ كمامة FFP2/N95 في الخارج واختصر العمل الحقلي.')], [300, '#8F3F97', t('Very unhealthy', 'غير صحية جداً'), t('Health alert. Avoid outdoor activity.', 'إنذار صحي. تجنّب النشاط في الخارج.')], [9999, '#7E0023', t('Hazardous', 'خطرة'), t('Emergency conditions. Stay indoors with filtered air.', 'ظروف طارئة. ابقَ في الداخل مع هواء مفلتر.')]];
  var cat = function (v) { for (var i = 0; i < USC.length; i++) if (v <= USC[i][0]) return USC[i]; return USC[USC.length - 1]; };
  var EUC = [[20, '#50F0E6'], [40, '#50CCAA'], [60, '#F0E641'], [80, '#FF5050'], [100, '#960032'], [9999, '#7D2181']];
  var WHO = [['pm2_5', 'PM₂.₅', 15], ['pm10', 'PM₁₀', 45], ['nitrogen_dioxide', 'NO₂', 25], ['sulphur_dioxide', 'SO₂', 40], ['carbon_monoxide', 'CO', 4000]];
  function site(lat, lon, fly) { $('#qLat').value = lat.toFixed(4); $('#qLon').value = lon.toFixed(4); persist.save(); if (!map) return; if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); if (fly) map.setView([lat, lon], 7); }
  if (map) map.on('click', function (e) { site(e.latlng.lat, e.latlng.lng); run(); });
  site(SH.num('qLat') || 33.3152, SH.num('qLon') || 44.3661);
  $('#qGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { site(p.lat, p.lon, true); run(); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  function run() {
    var lat = SH.num('qLat'), lon = SH.num('qLon'); if (isNaN(lat) || isNaN(lon)) return; persist.save(); $('#qRun').disabled = true;
    SH.getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4) + '&current=' + VARS + '&hourly=' + VARS + '&timezone=auto&past_days=1&forecast_days=5')
      .then(function (j) { last = { j: j, lat: lat, lon: lon }; render(); if (SH.pro()) grid(lat, lon); else lockedMap(); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { $('#qRun').disabled = false; });
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function render() {
    var c = last.j.current, h = last.j.hourly, us = c.us_aqi, k = cat(us); $('#qEmpty').hidden = true; $('#qOut').hidden = false;
    $('#qHero').innerHTML = '<section class="pn" style="overflow:hidden"><div style="display:flex;gap:18px;align-items:center;padding:18px;flex-wrap:wrap"><div style="width:110px;height:110px;border-radius:50%;display:grid;place-items:center;background:' + k[1] + ';color:' + (us > 100 && us <= 150 || us <= 100 ? '#111' : '#fff') + ';font-size:2.2rem;font-weight:800;box-shadow:0 0 0 8px ' + SH.alpha(k[1], .25) + '">' + (us != null ? Math.round(us) : '—') + '</div><div style="flex:1;min-width:220px"><span class="xsmall muted">US AQI · ' + (c.time || '').replace('T', ' ') + ' (' + (last.j.timezone_abbreviation || '') + ')</span><h2 style="margin:4px 0">' + k[2] + '</h2><p style="margin:0;font-size:.92rem;line-height:1.7">' + k[3] + '</p>' +
      (c.dust > 150 ? '<p style="margin:6px 0 0;font-size:.88rem"><b>' + t('Dust event', 'حدث غباري') + ':</b> ' + t('desert dust dominates the particulate load; visibility and respiratory risk are both elevated.', 'الغبار الصحراوي يهيمن على الجسيمات؛ تنخفض الرؤية ويرتفع الخطر التنفسي.') + '</p>' : '') + '</div></div></section>';
    var eu = c.european_aqi, ec = EUC.filter(function (x) { return eu <= x[0]; })[0] || EUC[5];
    $('#qKpis').innerHTML = kpi('', t('European AQI', 'المؤشر الأوروبي'), '<span style="color:' + ec[1] + '">' + Math.round(eu) + '</span>', 'EEA') + kpi(c.pm2_5 > 15 ? 'warn' : 'ok', 'PM₂.₅', SH.fmt(c.pm2_5, 1) + '<small> µg/m³</small>', 'WHO 24-h 15') + kpi(c.pm10 > 45 ? 'warn' : 'ok', 'PM₁₀', SH.fmt(c.pm10, 0) + '<small> µg/m³</small>', 'WHO 24-h 45') +
      kpi(c.dust > 150 ? 'bad' : c.dust > 50 ? 'warn' : '', t('Dust', 'الغبار'), SH.fmt(c.dust, 0) + '<small> µg/m³</small>', 'CAMS') + kpi('', 'AOD₅₅₀', SH.fmt(c.aerosol_optical_depth, 2), t('aerosol optical depth', 'العمق البصري للهباء')) + kpi(c.nitrogen_dioxide > 25 ? 'warn' : '', 'NO₂', SH.fmt(c.nitrogen_dioxide, 0) + '<small> µg/m³</small>', '') + kpi(c.sulphur_dioxide > 40 ? 'warn' : '', 'SO₂', SH.fmt(c.sulphur_dioxide, 0) + '<small> µg/m³</small>', '') + kpi('', 'O₃', SH.fmt(c.ozone, 0) + '<small> µg/m³</small>', '') + kpi('', 'CO', SH.fmt(c.carbon_monoxide, 0) + '<small> µg/m³</small>', '') + kpi(c.uv_index >= 8 ? 'bad' : c.uv_index >= 6 ? 'warn' : '', 'UV', SH.fmt(c.uv_index, 1), '');
    var today = (c.time || '').slice(0, 10), idx = h.time.map(function (tm, i) { return tm.slice(0, 10) === today ? i : -1; }).filter(function (i) { return i >= 0; });
    $('#qWho').innerHTML = '<thead><tr><th>' + t('Pollutant', 'الملوث') + '</th><th class="num">' + t('24-h mean', 'متوسط 24 ساعة') + '</th><th class="num">' + t('Peak hour', 'ساعة الذروة') + '</th><th class="num">' + t('WHO guideline', 'دليل الصحة العالمية') + '</th><th>' + t('Status', 'الحالة') + '</th></tr></thead><tbody>' + WHO.map(function (w) { var a = idx.map(function (i) { return h[w[0]][i]; }).filter(function (v) { return v != null; }), m = a.reduce(function (p, q) { return p + q; }, 0) / (a.length || 1), pk = Math.max.apply(null, a.concat([0])), r = m / w[2];
      return '<tr><td><b>' + w[1] + '</b></td><td class="num">' + SH.fmt(m, 1) + '</td><td class="num">' + SH.fmt(pk, 0) + '</td><td class="num">' + SH.fmt(w[2], 0) + ' µg/m³</td><td><span class="badge ' + (r > 2 ? 'bad' : r > 1 ? 'warn' : 'ok') + '">' + (r > 1 ? '× ' + SH.fmt(r, 1) : t('within', 'ضمن الدليل')) + '</span></td></tr>'; }).join('') + '</tbody>';
    plot(SH.seg('qTab') || 'pm');
  }
  function plot(k) {
    if (!last) return; var h = last.j.hourly, now = (last.j.current.time || '').slice(0, 13) + ':00', p = SH.palette(), tr;
    if (k === 'pm') tr = [{ x: h.time, y: h.pm2_5, name: 'PM₂.₅', line: { color: '#B4552D', width: 2 } }, { x: h.time, y: h.pm10, name: 'PM₁₀', line: { color: '#9A7631', width: 2 } }, { x: h.time, y: h.dust, name: t('Dust', 'الغبار'), line: { color: '#C9A227', width: 1.5, dash: 'dot' } }];
    else if (k === 'gas') tr = [{ x: h.time, y: h.nitrogen_dioxide, name: 'NO₂', line: { color: '#7A4F9A', width: 2 } }, { x: h.time, y: h.sulphur_dioxide, name: 'SO₂', line: { color: '#2A9D8F', width: 2 } }, { x: h.time, y: h.ozone, name: 'O₃', line: { color: '#2E78B7', width: 2 } }];
    else tr = [{ x: h.time, y: h.us_aqi, name: 'US AQI', line: { color: p.text, width: 2 } }, { x: h.time, y: h.european_aqi, name: 'EU AQI', line: { color: p.accent, width: 2 } }];
    SH.plot('qPlot', tr, function () { return SH.plotLayout({ xaxis: { type: 'date' }, yaxis: { title: { text: k === 'aqi' ? 'AQI' : 'µg/m³' }, rangemode: 'tozero' }, shapes: [{ type: 'line', xref: 'x', yref: 'paper', x0: now, x1: now, y0: 0, y1: 1, line: { color: p.accent, dash: 'dot' } }].concat(k === 'pm' ? [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 15, y1: 15, line: { color: '#B4552D', width: 1, dash: 'dash' } }, { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 45, y1: 45, line: { color: '#9A7631', width: 1, dash: 'dash' } }] : []) }); });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#qTab button')) setTimeout(function () { plot(SH.seg('qTab')); }, 0); });
  /* Regional surface: CAMS global (native ~0.4°) sampled on an 11 × 11 grid at 0.4°, upsampled with
     Catmull-Rom bicubic interpolation for display, coloured on a continuous scale anchored at the centre
     of each official category, with isolines drawn exactly at the category breakpoints. */
  var SCALES = {
    us_aqi: { unit: 'AQI', br: [50, 100, 150, 200, 300], cols: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#8F3F97', '#7E0023'], max: 500, src: 'US EPA AQI' },
    european_aqi: { unit: 'EAQI', br: [20, 40, 60, 80, 100], cols: ['#50F0E6', '#50CCAA', '#F0E641', '#FF5050', '#960032', '#7D2181'], max: 150, src: 'EEA European AQI' },
    pm2_5: { unit: 'µg/m³', br: [9, 35.4, 55.4, 125.4, 225.4], cols: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#8F3F97', '#7E0023'], max: 325, src: 'US EPA PM2.5 breakpoints (2024)' },
    dust: { unit: 'µg/m³', br: [54, 154, 254, 354, 424], cols: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#8F3F97', '#7E0023'], max: 600, src: t('US EPA PM10 breakpoints (dust is coarse particulate matter)', 'حدود PM10 لوكالة حماية البيئة الأمريكية (الغبار جسيمات خشنة)') }
  };
  var hex = function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  function colorAt(S, v) {
    var c = [0].concat(S.br), ctr = S.cols.map(function (_, i) { return i < S.br.length ? (c[i] + S.br[i]) / 2 : S.br[S.br.length - 1] + (S.br[S.br.length - 1] - c[c.length - 2]) / 2; });
    if (v <= ctr[0]) return hex(S.cols[0]); for (var i = 1; i < ctr.length; i++) if (v <= ctr[i]) { var f = (v - ctr[i - 1]) / (ctr[i] - ctr[i - 1]), A = hex(S.cols[i - 1]), B = hex(S.cols[i]); return [0, 1, 2].map(function (k) { return Math.round(A[k] + (B[k] - A[k]) * f); }); }
    return hex(S.cols[S.cols.length - 1]);
  }
  function cr(p0, p1, p2, p3, x) { return p1 + 0.5 * x * (p2 - p0 + x * (2 * p0 - 5 * p1 + 4 * p2 - p3 + x * (3 * (p1 - p2) + p3 - p0))); }
  function bicubic(C, n, fx, fy) {
    var i = Math.floor(fx), j = Math.floor(fy), dx = fx - i, dy = fy - j, g = function (a, b) { a = Math.max(0, Math.min(n - 1, a)); b = Math.max(0, Math.min(n - 1, b)); return C[b * n + a]; };
    var r = []; for (var m = -1; m <= 2; m++) r.push(cr(g(i - 1, j + m), g(i, j + m), g(i + 1, j + m), g(i + 2, j + m), dx));
    return Math.max(0, cr(r[0], r[1], r[2], r[3], dy));
  }
  var legend = null, readout = null, field = null;
  function grid(lat, lon) {
    if (!map) return; var n = 11, d = 0.4, h = (n - 1) / 2, la = [], lo = [], i, j;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) { la.push((lat + (h - i) * d).toFixed(2)); lo.push((lon + (j - h) * d).toFixed(2)); }
    var v = SH.val('qIdx'), S = SCALES[v] || SCALES.us_aqi;
    SH.busy($('#qMap').parentElement, true, t('Reading the CAMS atmosphere model…', 'جارٍ قراءة نموذج الغلاف الجوي CAMS…'));
    SH.getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + la.join(',') + '&longitude=' + lo.join(',') + '&current=' + v, { timeout: 40000 }).then(function (arr) {
      if (!Array.isArray(arr)) arr = [arr]; var C = arr.map(function (r) { var x = r.current && r.current[v]; return x == null ? NaN : x; });
      var ok = C.filter(isFinite); if (!ok.length) throw new Error(t('No model values returned for this area.', 'لم تُرجع قيم للنموذج في هذه المنطقة.'));
      var mean = ok.reduce(function (a, b) { return a + b; }, 0) / ok.length; C = C.map(function (x) { return isFinite(x) ? x : mean; });
      var N = 121, bb = { n: lat + h * d, s: lat - h * d, w: lon - h * d, e: lon + h * d }, G = { nx: N, ny: N, b: bb, z: new Float32Array(N * N) };
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) G.z[j * N + i] = bicubic(C, n, i / (N - 1) * (n - 1), j / (N - 1) * (n - 1));
      field = { G: G, S: S, v: v };
      /* raster in Web Mercator rows so the image lines up with the base map */
      var W = 360, H = 360, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var cx = cv.getContext('2d'), im = cx.createImageData(W, H);
      var my = function (la) { return Math.log(Math.tan(Math.PI / 4 + SH.rad(la) / 2)); }, yN = my(bb.n), yS = my(bb.s);
      for (var py = 0; py < H; py++) { var yy = yN + (yS - yN) * (py + .5) / H, lt = (2 * Math.atan(Math.exp(yy)) - Math.PI / 2) * 180 / Math.PI, fy = (bb.n - lt) / (bb.n - bb.s) * (n - 1);
        for (var px = 0; px < W; px++) { var fx = (px + .5) / W * (n - 1), val = bicubic(C, n, fx, fy), col = colorAt(S, val), o = (py * W + px) * 4; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255; } }
      cx.putImageData(im, 0, 0);
      if (gridLay) map.removeLayer(gridLay); gridLay = L.layerGroup().addTo(map);
      L.imageOverlay(cv.toDataURL('image/png'), [[bb.s, bb.w], [bb.n, bb.e]], { opacity: .62, interactive: false }).addTo(gridLay);
      L.rectangle([[bb.s, bb.w], [bb.n, bb.e]], { color: '#333', weight: 1, fill: false, dashArray: '4 4', interactive: false }).addTo(gridLay);
      var lv = S.br.filter(function (b) { return b > G.z.reduce(function (a, b) { return Math.min(a, b); }, 1e9) && b < G.z.reduce(function (a, b) { return Math.max(a, b); }, -1e9); });
      SH.dem.contours(G, lv).forEach(function (c) { c.lines.forEach(function (ln) { if (ln.length < 4) return; L.polyline(ln, { color: '#1b1b1b', weight: 1.6, opacity: .85, interactive: false }).addTo(gridLay); var m = ln[Math.floor(ln.length / 2)];
        L.marker(m, { interactive: false, icon: L.divIcon({ className: '', html: '<span style="background:#fff;border:1px solid #333;border-radius:4px;padding:0 4px;font:700 11px/1.5 system-ui;color:#111;white-space:nowrap;transform:translate(-50%,-50%);display:inline-block">' + SH.fmt(c.level, c.level % 1 ? 1 : 0) + '</span>', iconSize: [0, 0] }) }).addTo(gridLay); }); });
      if (mk) mk.setZIndexOffset && mk.setZIndexOffset(1000);
      map.fitBounds([[bb.s, bb.w], [bb.n, bb.e]], { padding: [10, 10] });
      if (!legend) { legend = L.control({ position: 'bottomright' }); legend.onAdd = function () { var dv = L.DomUtil.create('div'); dv.id = 'qLeg'; dv.style.cssText = 'background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:11px;line-height:1.5;box-shadow:0 6px 18px rgba(0,0,0,.18);min-width:170px'; return dv; }; legend.addTo(map); }
      var names = [t('Good', 'جيدة'), t('Moderate', 'معتدلة'), t('Unhealthy for sensitive', 'غير صحية للحساسين'), t('Unhealthy', 'غير صحية'), t('Very unhealthy', 'غير صحية جداً'), t('Hazardous', 'خطرة')];
      if (v === 'european_aqi') names = [t('Good', 'جيدة'), t('Fair', 'مقبولة'), t('Moderate', 'متوسطة'), t('Poor', 'رديئة'), t('Very poor', 'رديئة جداً'), t('Extremely poor', 'رديئة للغاية')];
      var lim = [0].concat(S.br);
      $('#qLeg').innerHTML = '<b style="font-size:11.5px">' + SH.esc(SH.selText('qIdx')) + '</b>' + S.cols.map(function (c, k) { return '<div style="display:flex;gap:6px;align-items:center"><i style="width:14px;height:10px;background:' + c + ';border:1px solid #555;display:inline-block"></i><span>' + names[k] + '</span><span class="ltr" style="margin-inline-start:auto;color:var(--text-2)">' + (k < S.br.length ? SH.fmt(lim[k], 0) + '–' + SH.fmt(S.br[k], S.br[k] % 1 ? 1 : 0) : '> ' + SH.fmt(S.br[S.br.length - 1], 0)) + '</span></div>'; }).join('') + '<div style="margin-top:4px;color:var(--text-2)">— ' + t('isoline at a category limit', 'خط تساوي عند حد الفئة') + '</div>';
      if (!readout) { readout = L.control({ position: 'topright' }); readout.onAdd = function () { var dv = L.DomUtil.create('div'); dv.id = 'qRead'; dv.style.cssText = 'background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.18)'; dv.textContent = t('Move over the map to read values', 'حرّك المؤشر فوق الخريطة لقراءة القيم'); return dv; }; readout.addTo(map);
        map.on('mousemove', function (e) { if (!field) return; var g = field.G.b, n2 = 11; if (e.latlng.lat > g.n || e.latlng.lat < g.s || e.latlng.lng < g.w || e.latlng.lng > g.e) { $('#qRead').textContent = t('Outside the modelled area', 'خارج منطقة النموذج'); return; }
          var val = bicubic(field.C, n2, (e.latlng.lng - g.w) / (g.e - g.w) * (n2 - 1), (g.n - e.latlng.lat) / (g.n - g.s) * (n2 - 1)); $('#qRead').innerHTML = '<b class="ltr">' + SH.fmt(val, field.S.unit === 'µg/m³' ? 1 : 0) + ' ' + field.S.unit + '</b> · <span class="ltr">' + e.latlng.lat.toFixed(2) + '°, ' + e.latlng.lng.toFixed(2) + '°</span>'; }); }
      field.C = C;
      $('#qMapCap').innerHTML = t('Current ', 'القيم الحالية لـ ') + '<b>' + SH.esc(SH.selText('qIdx')) + '</b>' + t(' from the CAMS global atmospheric composition forecast (native resolution about 0.4°, ≈ 45 km). The model was sampled on an 11 × 11 grid at its native spacing and interpolated bicubically for display; black isolines mark the official category limits (', ' من تنبؤ تركيب الغلاف الجوي العالمي CAMS (الدقة الأصلية نحو 0.4°، أي ≈ 45 كم). أُخذت قيم النموذج على شبكة 11 × 11 بتباعده الأصلي واستُكملت بالاستيفاء ثلاثي الدرجة للعرض؛ وتحدد الخطوط السوداء حدود الفئات الرسمية (') + SH.esc(S.src) + t('). Values between nodes are interpolated, so local sources such as a factory or a road are smoothed out.', '). القيم بين العقد مستوفاة، لذلك تُنعَّم المصادر المحلية كالمصانع والطرق.');
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { SH.busy($('#qMap').parentElement, false); });
  }
  function lockedMap() { $('#qMapCap').innerHTML = SH.icon('info') + ' ' + t('The regional pollution map, with isolines at the official category limits, is a Shandal analysis for subscribers.', 'خريطة التلوث الإقليمية مع خطوط الحدود الرسمية للفئات من تحليل نظام شندل، وهي للمشتركين.'); }
  $('#qIdx').addEventListener('change', function () { persist.save(); if (last && SH.pro()) grid(last.lat, last.lon); });
  $('#qRun').addEventListener('click', run);
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Read the air quality first.', 'اقرأ جودة الهواء أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (last) plot(SH.seg('qTab') || 'pm'); });
})();
