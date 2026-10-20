/* Air quality — CAMS through the Open-Meteo air-quality API: current US/EU AQI, pollutants, dust and AOD,
   5-day hourly forecast, WHO 2021 guideline comparison and a 9 × 9 regional grid map. */
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
      .then(function (j) { last = { j: j, lat: lat, lon: lon }; render(); grid(lat, lon); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { $('#qRun').disabled = false; });
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
  function grid(lat, lon) {
    if (!map) return; var n = 9, d = 0.5, la = [], lo = []; for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { la.push((lat + (i - 4) * d).toFixed(2)); lo.push((lon + (j - 4) * d).toFixed(2)); }
    var v = SH.val('qIdx');
    SH.getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + la.join(',') + '&longitude=' + lo.join(',') + '&current=' + v, { timeout: 30000 }).then(function (arr) { if (!Array.isArray(arr)) arr = [arr]; if (gridLay) map.removeLayer(gridLay); gridLay = L.layerGroup().addTo(map);
      arr.forEach(function (r, k) { var val = r.current && r.current[v]; if (val == null) return; var col = v === 'us_aqi' ? cat(val)[1] : v === 'european_aqi' ? (EUC.filter(function (x) { return val <= x[0]; })[0] || EUC[5])[1] : v === 'pm2_5' ? cat(val <= 9 ? 40 : val <= 35.4 ? 80 : val <= 55.4 ? 130 : val <= 125.4 ? 180 : 250)[1] : cat(val <= 50 ? 30 : val <= 150 ? 80 : val <= 300 ? 130 : val <= 600 ? 180 : 250)[1];
        L.rectangle([[+la[k] - d / 2, +lo[k] - d / 2], [+la[k] + d / 2, +lo[k] + d / 2]], { stroke: false, fillColor: col, fillOpacity: .45 }).bindTooltip(SH.fmt(val, 0)).addTo(gridLay); });
      if (mk) mk.bringToFront && mk.bringToFront(); map.fitBounds([[lat - 2.3, lon - 2.3], [lat + 2.3, lon + 2.3]]);
      $('#qMapCap').textContent = t('Current ', 'القيم الحالية لـ ') + SH.selText('qIdx') + t(' on a 0.5° grid (CAMS global, about 40 km).', ' على شبكة 0.5° (CAMS العالمي، نحو 40 كم).'); }).catch(function () {});
  }
  $('#qIdx').addEventListener('change', function () { persist.save(); if (last) grid(last.lat, last.lon); });
  $('#qRun').addEventListener('click', run);
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Read the air quality first.', 'اقرأ جودة الهواء أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (last) plot(SH.seg('qTab') || 'pm'); });
})();
