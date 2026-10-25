/* Hydrological early warning — hourly rainfall (ECMWF / ERA5) tested against rainfall intensity–duration landslide thresholds,
   with antecedent precipitation index and local slope from the Copernicus 30 m DEM. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('hydro', ['hLat', 'hLon', 'hLith', 'hStart', 'hEnd', 'hThr', 'hA', 'hB', 'hK']);
  var DUR = [1, 2, 3, 6, 12, 24, 48, 72, 120, 168, 240];
  var THR = { caine: { a: 14.82, b: 0.39, n: 'Caine (1980)' }, guz: { a: 2.20, b: 0.44, n: 'Guzzetti et al. (2008)' } };
  var map = SH.map('hMap', { zoom: 10, base: 'topo', center: [SH.num('hLat') || 36.65, SH.num('hLon') || 44.54] }), mk = null, last = null;

  function place(lat, lon, fly) {
    $('#hLat').value = lat.toFixed(4); $('#hLon').value = lon.toFixed(4); persist.save();
    if (!map) return; if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map);
    if (fly) map.setView([lat, lon], Math.max(map.getZoom(), 11));
    $('#hPlace').innerHTML = '<span class="ltr">' + SH.fmtLatLon(lat, lon, 4) + '</span>';
  }
  if (map) map.on('click', function (e) { place(e.latlng.lat, e.latlng.lng); });
  ['hLat', 'hLon'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var a = SH.num('hLat'), b = SH.num('hLon'); if (!isNaN(a) && !isNaN(b)) place(a, b, true); }); });
  place(SH.num('hLat') || 36.6527, SH.num('hLon') || 44.5422, true);
  document.addEventListener('click', function (e) { if (!e.target.closest('#hMode button')) return; setTimeout(function () { var arc = SH.seg('hMode') === 'arc'; $('#hDates').hidden = !arc; $('#hModeNote').textContent = arc ? t('Historical hourly rainfall from the Copernicus ERA5 reanalysis (ECMWF). Data are usually available up to five days before today.', 'أمطار ساعية تاريخية من إعادة التحليل ERA5 لبرنامج كوبرنيكوس (ECMWF). تتوفر البيانات عادة حتى خمسة أيام قبل اليوم.') : t('Forecast mode joins the last 14 days of observed hourly rain with the 7-day forecast, so antecedent wetness is counted.', 'وضع التنبؤ يدمج أمطار آخر 14 يوماً الساعية المرصودة مع تنبؤ 7 أيام، لتُحسب الرطوبة السابقة.'); }, 0); });
  $('#hThr').addEventListener('change', function () { $('#hUser').hidden = this.value !== 'user'; }); $('#hUser').hidden = SH.val('hThr') !== 'user';
  function thr() { var k = SH.val('hThr'); return k === 'user' ? { a: SH.num('hA'), b: SH.num('hB'), n: t('Custom', 'مخصصة') } : THR[k]; }

  /* ---------- data */
  function fetchRain(lat, lon) {
    var q = 'latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4) + '&hourly=precipitation&timezone=auto';
    if (SH.seg('hMode') === 'arc') {
      var s = SH.val('hStart'), e = SH.val('hEnd'); if (!s || !e || s > e) return Promise.reject(new Error(t('Choose a valid start and end date.', 'اختر تاريخي بداية ونهاية صحيحين.')));
      if ((new Date(e) - new Date(s)) / 864e5 > 366) return Promise.reject(new Error(t('Keep the period to one year or less.', 'اجعل الفترة سنة واحدة أو أقل.')));
      return SH.getJSON('https://archive-api.open-meteo.com/v1/archive?' + q + '&start_date=' + s + '&end_date=' + e);
    }
    return SH.getJSON('https://api.open-meteo.com/v1/forecast?' + q + '&past_days=14&forecast_days=7');
  }
  /* local slope from Copernicus GLO-30 (Horn 1981 on a 3 × 3 window at 30 m) */
  function fetchSlope(lat, lon) {
    var d = 30, dlat = d / 111195, dlon = d / (111195 * Math.cos(SH.rad(lat)));
    return SH.pc.dem({ n: lat + 4 * dlat, s: lat - 4 * dlat, e: lon + 4 * dlon, w: lon - 4 * dlon }, 'cop-dem-glo-30').then(function (f) {
      var z = []; for (var i = 1; i >= -1; i--) for (var j = -1; j <= 1; j++) z.push(f(lat + i * dlat, lon + j * dlon));
      if (z.some(isNaN)) return null;
      var dzdx = ((z[2] + 2 * z[5] + z[8]) - (z[0] + 2 * z[3] + z[6])) / (8 * d), dzdy = ((z[0] + 2 * z[1] + z[2]) - (z[6] + 2 * z[7] + z[8])) / (8 * d);
      var asp = (SH.deg(Math.atan2(dzdx, dzdy)) + 180) % 360;
      return { z: z[4], slope: SH.deg(Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy))), aspect: asp, relief: Math.max.apply(null, z) - Math.min.apply(null, z) };
    }).catch(function () { return null; });
  }

  /* ---------- analysis */
  function analyse(j, T, k) {
    var time = j.hourly.time, P = j.hourly.precipitation.map(function (v) { return v == null ? 0 : Math.max(0, v); }), n = P.length, cs = [0];
    for (var i = 0; i < n; i++) cs.push(cs[i] + P[i]);
    var ratio = new Array(n).fill(0), rDur = new Array(n).fill(0), env = DUR.map(function () { return { I: 0, end: -1 }; });
    for (i = 0; i < n; i++) DUR.forEach(function (D, di) {
      if (i + 1 < D) return; var sum = cs[i + 1] - cs[i + 1 - D], I = sum / D; if (sum <= 0) return;
      var r = I / (T.a * Math.pow(D, -T.b)); if (r > ratio[i]) { ratio[i] = r; rDur[i] = D; }
      if (I > env[di].I) env[di] = { I: I, end: i, sum: sum };
    });
    // daily totals and API
    var days = [], dP = [], idx = {};
    time.forEach(function (tm, i) { var d = tm.slice(0, 10); if (!(d in idx)) { idx[d] = days.length; days.push(d); dP.push(0); } dP[idx[d]] += P[i]; });
    var api = [], a = 0; dP.forEach(function (p) { a = k * a + p; api.push(a); });
    var nowI = -1; if (j._fc) { var nowS = j._now; for (i = 0; i < n; i++) if (time[i] <= nowS) nowI = i; }
    var breachH = ratio.filter(function (r) { return r >= 1; }).length, peak = 0, peakI = 0; ratio.forEach(function (r, i) { if (r > peak) { peak = r; peakI = i; } });
    // breach episodes (contiguous hours)
    var eps = [], cur = null; ratio.forEach(function (r, i) { if (r >= 1) { if (!cur) cur = { s: i, e: i, max: r, D: rDur[i] }; else { cur.e = i; if (r > cur.max) { cur.max = r; cur.D = rDur[i]; } } } else if (cur) { eps.push(cur); cur = null; } }); if (cur) eps.push(cur);
    return { time: time, P: P, n: n, ratio: ratio, rDur: rDur, env: env, days: days, dP: dP, api: api, total: cs[n], max24: Math.max.apply(null, DUR.indexOf(24) >= 0 ? [env[DUR.indexOf(24)].sum || 0] : [0]), peak: peak, peakI: peakI, breachH: breachH, eps: eps, nowI: nowI, T: T };
  }

  function run() {
    var lat = SH.num('hLat'), lon = SH.num('hLon'), T = thr(), k = SH.num('hK') || 0.9, host = $('#hRun');
    if (isNaN(lat) || isNaN(lon)) { SH.toast(t('Set the site first.', 'حدد الموقع أولاً.'), 'warn'); return; }
    if (!(T.a > 0 && T.b > 0)) { SH.toast(t('Enter positive a and b for the custom threshold.', 'أدخل قيماً موجبة لـ a وb للعتبة المخصصة.'), 'warn'); return; }
    persist.save(); host.disabled = true; SH.busy($('#hMap').parentElement, true, t('Fetching hourly rainfall…', 'جارٍ جلب الأمطار الساعية…'));
    var fc = SH.seg('hMode') !== 'arc';
    Promise.all([fetchRain(lat, lon), fetchSlope(lat, lon)]).then(function (res) {
      var j = res[0]; if (!j || !j.hourly || !j.hourly.time || !j.hourly.time.length) throw new Error(t('No rainfall data for this period.', 'لا توجد بيانات أمطار لهذه الفترة.'));
      j._fc = fc; if (fc) { var off = (j.utc_offset_seconds || 0) * 1000, d = new Date(Date.now() + off); j._now = d.toISOString().slice(0, 13) + ':00'; }
      var r = analyse(j, T, k); r.slope = res[1]; r.lat = lat; r.lon = lon; r.fc = fc; r.lith = SH.val('hLith'); r.elev = j.elevation; r.tz = j.timezone_abbreviation || j.timezone || '';
      last = r; render(r);
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { host.disabled = false; SH.busy($('#hMap').parentElement, false); });
  }

  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var fmtT = function (s) { return s ? s.replace('T', ' ') : '—'; };
  function level(r) { var fut = r.fc && r.nowI >= 0 ? Math.max.apply(null, r.ratio.slice(r.nowI + 1).concat([0])) : 0, nowR = r.fc && r.nowI >= 0 ? Math.max.apply(null, r.ratio.slice(Math.max(0, r.nowI - 72), r.nowI + 1).concat([0])) : r.peak; return { fut: fut, nowR: nowR }; }

  function render(r) {
    $('#hEmpty').hidden = true; $('#hOut').hidden = false;
    var lv = level(r), s = r.slope, steep = s && s.slope >= 25, mod = s && s.slope >= 15, apiNow = r.api[r.fc && r.nowI >= 0 ? r.days.indexOf(r.time[r.nowI].slice(0, 10)) : r.api.length - 1] || 0;
    var maxApi = Math.max.apply(null, r.api);
    var kRain = kpi('info', t('Total rainfall', 'مجموع الأمطار'), SH.fmt(r.total, 1) + '<small> mm</small>', r.days.length + t(' days · ', ' يوماً · ') + r.n + t(' hours', ' ساعة')), kMax = kpi('', t('Wettest day', 'أكثر الأيام مطراً'), SH.fmt(Math.max.apply(null, r.dP.concat([0])), 1) + '<small> mm</small>', r.days[r.dP.indexOf(Math.max.apply(null, r.dP.concat([0])))] || '—');
    if (!SH.pro()) { $('#hKpis').innerHTML = kRain + kMax; plots(r); return; }
    $('#hKpis').innerHTML = kRain +
      kpi(r.peak >= 1 ? 'bad' : r.peak >= 0.7 ? 'warn' : 'ok', t('Peak exceedance ratio', 'أقصى نسبة تجاوز'), SH.fmt(r.peak, 2), r.peak > 0 ? t('at D = ', 'عند D = ') + r.rDur[r.peakI] + ' h · ' + fmtT(r.time[r.peakI]) : t('no rain', 'لا أمطار')) +
      kpi(r.breachH ? 'bad' : 'ok', t('Hours above threshold', 'ساعات فوق العتبة'), r.breachH, r.eps.length + t(' episode(s)', ' حدث')) +
      kpi(apiNow > 50 ? 'warn' : '', t('Antecedent index', 'مؤشر الرطوبة السابقة'), SH.fmt(r.fc ? apiNow : maxApi, 1) + '<small> mm</small>', r.fc ? t('today', 'اليوم') : t('maximum in period', 'الأقصى في الفترة')) +
      kpi(steep ? 'bad' : mod ? 'warn' : 'ok', t('Local slope', 'الميل المحلي'), s ? SH.fmt(s.slope, 1) + '<small>°</small>' : '—', s ? SH.fmt(s.z, 0) + ' m · ' + t('aspect ', 'الاتجاه ') + SH.fmt(s.aspect, 0) + '° · DEM 90 m' : t('elevation unavailable', 'الارتفاع غير متاح'));
    var v = [];
    if (r.fc) {
      if (lv.fut >= 1) v.push(verdict('bad', t('Forecast rainfall crosses the threshold', 'الأمطار المتوقعة تتجاوز العتبة'), t('Forecast storms reach ', 'تبلغ العواصف المتوقعة ') + SH.fmt(lv.fut, 2) + t(' × the ', ' × عتبة ') + r.T.n + t(' threshold. Restrict access to steep cuts and debris-flow channels and alert field teams.', '. قيّد الوصول إلى القطوع الحادة ومجاري التدفقات الحطامية ونبّه فرق الحقل.')));
      else if (lv.fut >= 0.7) v.push(verdict('warn', t('Forecast rainfall approaches the threshold', 'الأمطار المتوقعة تقترب من العتبة'), t('Forecast storms reach ', 'تبلغ العواصف المتوقعة ') + SH.fmt(lv.fut * 100, 0) + t(' % of the threshold. Monitor tension cracks, seepage and springs.', ' % من العتبة. راقب الشقوق الشدّية والرشح والينابيع.')));
      else v.push(verdict('ok', t('No threshold crossing forecast', 'لا تجاوز متوقع للعتبة'), t('The 7-day forecast stays below ', 'يبقى تنبؤ الأيام السبعة دون ') + SH.fmt(Math.max(lv.fut, 0) * 100, 0) + t(' % of the threshold.', ' % من العتبة.')));
      if (lv.nowR >= 1) v.push(verdict('bad', t('Threshold crossed in the last 72 hours', 'تم تجاوز العتبة خلال آخر 72 ساعة'), t('Slopes may still be failing as pore pressure peaks after the rain. Inspect before re-opening sites.', 'قد تستمر المنحدرات بالانهيار مع بلوغ ضغط المسام ذروته بعد المطر. افحص قبل إعادة فتح المواقع.')));
    } else {
      v.push(r.breachH ? verdict('bad', r.eps.length + t(' threshold-crossing episode(s)', ' حدث تجاوز للعتبة'), t('The strongest reached ', 'بلغ أقواها ') + SH.fmt(r.peak, 2) + t(' × the threshold at ', ' × العتبة عند مدة ') + r.rDur[r.peakI] + t(' h duration, ending ', ' ساعة، منتهياً في ') + fmtT(r.time[r.peakI]) + '.') :
        r.peak >= 0.7 ? verdict('warn', t('Rainfall approached the threshold', 'اقتربت الأمطار من العتبة'), t('Peak ratio ', 'أقصى نسبة ') + SH.fmt(r.peak, 2) + '.') : verdict('ok', t('No threshold crossing in the period', 'لا تجاوز للعتبة في الفترة'), t('Peak ratio ', 'أقصى نسبة ') + SH.fmt(r.peak, 2) + '.'));
    }
    if (s && s.slope < 8) v.push(verdict('info', t('Gentle terrain', 'تضاريس لطيفة'), t('The DEM slope at the site is below 8°, where rainfall-induced shallow landslides are uncommon. Flooding and gullying are the more likely responses.', 'ميل الموقع في نموذج الارتفاع أقل من 8°، حيث تندر الانزلاقات الضحلة الناتجة عن الأمطار. الفيضانات والتخدد هي الاستجابة الأرجح.')));
    $('#hVerd').innerHTML = v.join('');
    plots(r); table(r); narrative(r, lv);
  }

  function plots(r) {
    var c = SH.palette(), rain = SH.css('--data') || '#2E86C1', dan = SH.css('--danger') || '#C0392B', shapes = [];
    var dX = r.days.map(function (d) { return d + 'T12:00'; }), nowD = r.fc && r.nowI >= 0 ? String(r.time[r.nowI]).slice(0, 10) : null;
    var obs = r.dP.map(function (v, i) { return !nowD || r.days[i] < nowD ? v : null; }), fcs = r.dP.map(function (v, i) { return nowD && r.days[i] >= nowD ? v : null; });
    var above = r.ratio.map(function (v) { return v >= 1 ? v : null; });
    if (!SH.pro()) { /* free view: the source rainfall only */
      SH.plot('hTs', [
        { type: 'bar', x: dX, y: obs, name: t('Observed daily rain', 'المطر اليومي المرصود'), marker: { color: SH.alpha(rain, .85), line: { color: rain, width: 1 } }, hovertemplate: '%{y:.1f} mm<extra></extra>' },
        { type: 'bar', x: dX, y: fcs, name: t('Forecast daily rain', 'المطر اليومي المتوقع'), marker: { color: SH.alpha(rain, .35), line: { color: rain, width: 1 } }, hovertemplate: '%{y:.1f} mm<extra></extra>' }
      ], function () { return SH.plotLayout({ bargap: .25, barmode: 'overlay', margin: { l: 56, r: 20, t: 40, b: 46 }, legend: { orientation: 'h', x: .5, xanchor: 'center', y: 1.12 }, xaxis: { type: 'date', tickformat: '%d %b' }, yaxis: { rangemode: 'tozero', title: { text: t('Rain mm/day', 'المطر مم/يوم') } } }); }, { filename: 'shandal-rainfall' });
      return;
    }
    SH.plot('hTs', [
      { type: 'bar', x: dX, y: obs, name: t('Observed daily rain', 'المطر اليومي المرصود'), marker: { color: SH.alpha(rain, .85), line: { color: rain, width: 1 } }, hovertemplate: '%{y:.1f} mm<extra>' + t('Observed', 'مرصود') + '</extra>' },
      { type: 'bar', x: dX, y: fcs, name: t('Forecast daily rain', 'المطر اليومي المتوقع'), marker: { color: SH.alpha(rain, .35), line: { color: rain, width: 1 }, pattern: { shape: '/', fgcolor: rain, size: 6, solidity: .25 } }, hovertemplate: '%{y:.1f} mm<extra>' + t('Forecast', 'متوقع') + '</extra>' },
      { x: dX, y: r.api, name: t('Antecedent precipitation index (API)', 'مؤشر الأمطار السابقة (API)'), yaxis: 'y2', mode: 'lines', line: { color: c.text, width: 2.4, shape: 'spline', smoothing: .9 }, hovertemplate: '%{y:.1f} mm<extra>API</extra>' },
      { x: r.time, y: r.ratio, name: t('Exceedance ratio I / It', 'نسبة التجاوز I / It'), yaxis: 'y3', mode: 'lines', line: { color: '#C77D1F', width: 1.8, shape: 'spline', smoothing: .6 }, fill: 'tozeroy', fillcolor: SH.alpha('#C77D1F', .12), customdata: r.rDur, hovertemplate: '%{y:.2f} (D = %{customdata} h)<extra>I / It</extra>' },
      { x: r.time, y: above, name: t('Above threshold', 'فوق العتبة'), yaxis: 'y3', mode: 'lines', line: { color: dan, width: 2.6 }, fill: 'tozeroy', fillcolor: SH.alpha(dan, .28), hoverinfo: 'skip', showlegend: r.breachH }
    ], function () {
      var sh = [], an = [];
      if (nowD) { sh.push({ type: 'rect', xref: 'x', yref: 'paper', x0: r.time[r.nowI], x1: r.time[r.n - 1], y0: 0, y1: 1, fillcolor: SH.alpha(c.accent, .08), line: { width: 0 }, layer: 'below' }, { type: 'line', xref: 'x', yref: 'paper', x0: r.time[r.nowI], x1: r.time[r.nowI], y0: 0, y1: 1, line: { color: c.accent, width: 1.6, dash: 'dot' } });
        an.push({ x: r.time[r.nowI], y: 1.0, yref: 'paper', text: t('Now', 'الآن'), showarrow: false, xanchor: 'center', yanchor: 'bottom', font: { size: 11, color: c.accent }, bgcolor: c.bg || '#fff' }, { x: r.time[Math.round((r.nowI + r.n - 1) / 2)], y: 1.0, yref: 'paper', text: '<b>' + t('Forecast', 'التنبؤ') + '</b>', showarrow: false, yanchor: 'bottom', font: { size: 11, color: c.accent } }); }
      sh.push({ type: 'line', xref: 'paper', yref: 'y3', x0: 0, x1: 1, y0: 1, y1: 1, line: { color: dan, width: 1.4, dash: 'dash' } });
      [[0, 1.0, 'left', t('Rain mm/day', 'المطر مم/يوم')], [1, 1.0, 'right', 'API mm'], [0, .34, 'left', 'I / It']].forEach(function (q) { an.push({ xref: 'paper', yref: 'paper', x: q[0], y: q[1], xanchor: q[2], yanchor: 'bottom', xshift: 0, yshift: 4, text: '<b>' + q[3] + '</b>', showarrow: false, font: { size: 10.5, color: c.text2 } }); });
      an.push({ xref: 'paper', x: 0, y: 1, yref: 'y3', text: t('threshold', 'العتبة'), showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { size: 10, color: dan } });
      return SH.plotLayout({ bargap: .25, barmode: 'overlay', hovermode: 'x unified', margin: { l: 56, r: 56, t: 84, b: 46 },
        legend: { orientation: 'h', x: .5, xanchor: 'center', y: 1.2, font: { size: 11 } },
        xaxis: { type: 'date', anchor: 'y3', tickformat: '%d %b', nticks: 12, tickangle: 0, showspikes: true, spikemode: 'across', spikethickness: 1, spikedash: 'dot', spikecolor: c.text2, hoverformat: '%A %d %B %Y' },
        yaxis: { domain: [.44, 1], rangemode: 'tozero', zeroline: false },
        yaxis2: { overlaying: 'y', side: 'right', showgrid: false, rangemode: 'tozero' },
        yaxis3: { domain: [0, .34], rangemode: 'tozero', range: [0, Math.max(1.3, (r.peak || 0) * 1.15)] },
        shapes: sh, annotations: an });
    }, { filename: 'shandal-rainfall' });
    var Dx = [], tC = [], tG = [], tU = []; for (var D = 0.5; D <= 400; D *= 1.15) { Dx.push(D); tC.push(14.82 * Math.pow(D, -0.39)); tG.push(2.2 * Math.pow(D, -0.44)); tU.push(r.T.a * Math.pow(D, -r.T.b)); }
    var env = r.env.map(function (e, i) { return { D: DUR[i], I: e.I, end: e.end }; }).filter(function (e) { return e.I > 0; });
    var tr = [{ x: Dx, y: tC, name: 'Caine 1980', line: { color: dan, width: 2 }, hoverinfo: 'skip' }, { x: Dx, y: tG, name: 'Guzzetti 2008', line: { color: '#D68910', width: 2, dash: 'dash' }, hoverinfo: 'skip' }];
    if (SH.val('hThr') === 'user') tr.push({ x: Dx, y: tU, name: t('Custom', 'مخصصة'), line: { color: c.accent, width: 2, dash: 'dot' }, hoverinfo: 'skip' });
    tr.push({ x: env.map(function (e) { return e.D; }), y: env.map(function (e) { return e.I; }), mode: 'lines+markers', name: t('Max intensity in period', 'أقصى شدة في الفترة'), line: { color: rain, width: 2.5 }, marker: { size: 8, color: env.map(function (e) { return e.I >= r.T.a * Math.pow(e.D, -r.T.b) ? dan : rain; }), line: { color: '#fff', width: 1.5 } }, customdata: env.map(function (e) { return fmtT(r.time[e.end]); }), hovertemplate: 'D %{x} h · I %{y:.2f} mm/h<br>%{customdata}<extra></extra>' });
    SH.plot('hID', tr, function () { return SH.plotLayout({ xaxis: { type: 'log', title: { text: t('Duration D (h)', 'المدة D (ساعة)') }, range: [Math.log10(0.8), Math.log10(300)] }, yaxis: { type: 'log', title: { text: t('Mean intensity I (mm/h)', 'الشدة المتوسطة I (مم/ساعة)') } } }); }, { filename: 'shandal-intensity-duration' });
  }
  function table(r) {
    $('#hTbl').innerHTML = '<thead><tr><th class="num">D h</th><th class="num">' + t('Max total mm', 'أقصى مجموع مم') + '</th><th class="num">I mm/h</th><th class="num">I<sub>t</sub> mm/h</th><th class="num">I/I<sub>t</sub></th><th>' + t('Ending', 'ينتهي في') + '</th></tr></thead><tbody>' +
      r.env.map(function (e, i) { var D = DUR[i], It = r.T.a * Math.pow(D, -r.T.b), q = e.I / It; return '<tr><td class="num">' + D + '</td><td class="num">' + SH.fmt(e.sum || 0, 1) + '</td><td class="num">' + SH.fmt(e.I, 2) + '</td><td class="num">' + SH.fmt(It, 2) + '</td><td class="num"><span class="badge ' + (q >= 1 ? 'bad' : q >= 0.7 ? 'warn' : 'ok') + '">' + SH.fmt(q, 2) + '</span></td><td class="ltr xsmall" style="white-space:nowrap">' + (e.end >= 0 ? fmtT(r.time[e.end]).slice(5) : '—') + '</td></tr>'; }).join('') + '</tbody>';
  }
  var LITH = {
    colluvium: t('Loose colluvium saturates quickly and fails as shallow translational slides that can mobilise into fast debris flows along channels. Short, intense bursts are the main trigger.', 'تتشبع الرواسب المنحدرية المفككة بسرعة وتنهار كانزلاقات انتقالية ضحلة قد تتحول إلى تدفقات حطامية سريعة على طول المجاري. الدفعات القصيرة الشديدة هي المحفز الرئيسي.'),
    clay: t('Clay-rich soils drain slowly, so pore pressure builds over days. Long-duration totals and the antecedent index matter more than peak intensity, and failures are often deeper rotational slides that lag the rain.', 'تصرّف التربة الطينية ببطء، فيتراكم ضغط المسام على مدى أيام. المجاميع طويلة المدة ومؤشر الرطوبة السابقة أهم من ذروة الشدة، والانهيارات غالباً انزلاقات دورانية أعمق تتأخر عن المطر.'),
    fractured: t('Water entering joints raises cleft pressure and reduces effective normal stress on discontinuities, favouring rockfall, wedge and planar failures in cut faces during and just after intense rain.', 'يرفع الماء الداخل في الفواصل ضغط الشقوق ويقلل الإجهاد العمودي الفعال على الانقطاعات، مما يرجّح السقوط الصخري والانهيارات الإسفينية والمستوية في القطوع خلال الأمطار الشديدة وبعدها مباشرة.'),
    marl: t('Marl and weathered shale soften and swell when wet, losing strength toward residual values. Repeated wetting cycles and long rainy spells drive slow earthflows and reactivation of old slides.', 'يلين المارل والطفل المتجوي وينتفخان عند الترطيب ويفقدان المقاومة نحو القيم المتبقية. تقود دورات الترطيب المتكررة وفترات المطر الطويلة تدفقات أرضية بطيئة وإعادة تنشيط الانزلاقات القديمة.'),
    gravel: t('Free-draining sandy gravel rarely builds pore pressure. Expect surface erosion, scour and washouts rather than deep sliding, unless the gravel overlies a low-permeability layer.', 'نادراً ما يبني الحصى الرملي جيد التصريف ضغط مسام. توقع التعرية السطحية والنحت والجرف بدلاً من الانزلاق العميق، ما لم يعلُ الحصى طبقة منخفضة النفاذية.')
  };
  function narrative(r, lv) {
    var s = r.slope, h = '<p>' + t('Hourly rainfall at ', 'حُللت الأمطار الساعية عند ') + '<span class="ltr">' + SH.fmtLatLon(r.lat, r.lon, 4) + '</span>' + t(' was analysed from ', ' من ') + fmtT(r.time[0]).slice(0, 10) + t(' to ', ' إلى ') + fmtT(r.time[r.n - 1]).slice(0, 10) + ' (' + SH.esc(r.tz) + '). ' +
      t('The period delivered ', 'بلغ مجموع الأمطار ') + SH.fmt(r.total, 1) + ' mm' + t('. Every window from 1 to 240 hours was compared with the ', '. قورنت كل نافذة زمنية من 1 إلى 240 ساعة بعتبة ') + r.T.n + t(' threshold, I = ', '، I = ') + SH.fmt(r.T.a, 2) + ' D<sup>−' + SH.fmt(r.T.b, 2) + '</sup>.</p>';
    h += '<p>' + LITH[r.lith] + '</p>';
    if (s) h += '<p>' + t('The 30 m Copernicus DEM gives a local slope of ', 'يعطي نموذج كوبرنيكوس 30 م ميلاً محلياً قدره ') + SH.fmt(s.slope, 1) + '° ' + t('facing ', 'باتجاه ') + SH.fmt(s.aspect, 0) + '°' + t(' and a relief of ', ' وتضاريس نسبية ') + SH.fmt(s.relief, 0) + t(' m within 90 m of the site. ', ' م ضمن 90 م من الموقع. ') +
      (s.slope >= 25 ? t('Slopes this steep are prone to shallow failure once the threshold is crossed.', 'المنحدرات بهذا الانحدار معرضة للانهيار الضحل عند تجاوز العتبة.') : s.slope >= 15 ? t('Moderate slopes fail where soils are thick, cut or saturated.', 'المنحدرات المتوسطة تنهار حيث تكون التربة سميكة أو مقطوعة أو مشبعة.') : t('Note that a 90 m DEM smooths road cuts and gullies; check steeper local faces in the field.', 'لاحظ أن نموذج 90 م ينعّم قطوع الطرق والأخاديد؛ افحص الواجهات المحلية الأشد انحداراً ميدانياً.')) + '</p>';
    h += '<p class="xsmall muted">' + t('Thresholds are empirical lower envelopes from global inventories. They flag conditions in which landslides have occurred, not certainty of failure. Calibrate with local landslide records where they exist.', 'العتبات أغلفة دنيا تجريبية من قوائم عالمية. تشير إلى ظروف حدثت فيها انزلاقات، لا إلى حتمية الانهيار. عايرها بسجلات الانزلاقات المحلية حيث توجد.') + '</p>';
    $('#hNarr').innerHTML = h;
  }

  $('#hCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-hourly-rain.csv', [['time', 'precip_mm', 'exceedance_ratio', 'critical_duration_h']].concat(last.time.map(function (tm, i) { return [tm, last.P[i], last.ratio[i].toFixed(3), last.rDur[i] || '']; }))); });
  $('#hRun').addEventListener('click', run);
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Fetch the rainfall first.', 'اجلب الأمطار أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (last) plots(last); });
})();
