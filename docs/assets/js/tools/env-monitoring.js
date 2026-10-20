/* Environmental monitoring & modelling — live weather and air quality (Open-Meteo), WBGT and heat index, Pasquill–Gifford
   Gaussian plume with Briggs rural dispersion, weighted-arithmetic water quality index, MEDALUS ESAI and an expert system. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('envmon', ['geoName', 'eScope', 'eLat', 'eLon', 'pOn', 'pGas', 'pQ', 'pH', 'wPH', 'wTDS', 'wDO', 'wTur', 'wNO3', 'wCl', 'wSO4', 'wTH', 'wCa', 'dSQI', 'dVQI', 'dMQI']);
  var map = SH.map('eMap', { zoom: 10, base: 'light', center: [SH.num('eLat') || 30.5, SH.num('eLon') || 47.78] }), siteMk = null, srcMk = null, plumeOvl = null, windArr = null, src = SH.store.get('shandal_env_src', null), placing = false, W = null, A = null, last = null;
  $('#pBox').hidden = !$('#pOn').checked; $('#pOn').addEventListener('change', function () { $('#pBox').hidden = !this.checked; persist.save(); });

  function site(lat, lon, fly) { $('#eLat').value = lat.toFixed(4); $('#eLon').value = lon.toFixed(4); persist.save(); if (!map) return; if (siteMk) siteMk.setLatLng([lat, lon]); else siteMk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); if (fly) map.setView([lat, lon], 11); }
  function setSrc(lat, lon) { src = { lat: lat, lon: lon }; SH.store.set('shandal_env_src', src); if (!map) return; if (srcMk) srcMk.setLatLng([lat, lon]); else srcMk = L.marker([lat, lon], { icon: SH.pin('<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M2 20h20V9l-6 4V9l-6 4V4H2z"/></svg>', 'mk-num', [24, 24]) }).bindTooltip(t('Emission source', 'مصدر الانبعاث')).addTo(map); }
  if (map) map.on('click', function (e) { if (placing) { setSrc(e.latlng.lat, e.latlng.lng); placing = false; $('#eHint').hidden = true; $('#pPlaceT').textContent = t('Move source', 'انقل المصدر'); map.getContainer().style.cursor = ''; if (last) run(); } else site(e.latlng.lat, e.latlng.lng); });
  $('#pPlace').addEventListener('click', function () { if (!map) return; placing = true; $('#eHint').hidden = false; map.getContainer().style.cursor = 'crosshair'; });
  $('#eGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { site(p.lat, p.lon, true); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  ['eLat', 'eLon'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var a = SH.num('eLat'), b = SH.num('eLon'); if (!isNaN(a) && !isNaN(b)) site(a, b, true); }); });
  site(SH.num('eLat') || 30.5085, SH.num('eLon') || 47.7804, true); if (src) setSrc(src.lat, src.lon);

  /* ---------- physics */
  var esat = function (T) { return 6.105 * Math.exp(17.27 * T / (237.7 + T)); };
  var wbgt = function (T, RH) { return 0.567 * T + 0.393 * (RH / 100) * esat(T) + 3.94; }; // Australian BoM simplified WBGT (shade, moderate wind)
  function heatIndex(T, RH) { var F = T * 9 / 5 + 32; if (F < 80) return T; var hi = -42.379 + 2.04901523 * F + 10.14333127 * RH - .22475541 * F * RH - .00683783 * F * F - .05481717 * RH * RH + .00122874 * F * F * RH + .00085282 * F * RH * RH - .00000199 * F * F * RH * RH; return (hi - 32) * 5 / 9; }
  function windChill(T, v) { var k = v * 3.6; return T <= 10 && k > 4.8 ? 13.12 + 0.6215 * T - 11.37 * Math.pow(k, 0.16) + 0.3965 * T * Math.pow(k, 0.16) : T; }
  function stability(u, day, sw, cloud) {
    var row = u < 2 ? 0 : u < 3 ? 1 : u < 5 ? 2 : u < 6 ? 3 : 4;
    if (day) { var c = sw > 600 ? 0 : sw > 300 ? 1 : 2; return [['A', 'A', 'B'], ['A', 'B', 'C'], ['B', 'B', 'C'], ['C', 'C', 'D'], ['C', 'D', 'D']][row][c]; }
    return [['F', 'F'], ['E', 'F'], ['D', 'E'], ['D', 'D'], ['D', 'D']][row][cloud >= 50 ? 0 : 1];
  }
  var SIG = { A: [.22, .20, 0, 0], B: [.16, .12, 0, 0], C: [.11, .08, .0002, -.5], D: [.08, .06, .0015, -.5], E: [.06, .03, .0003, -1], F: [.04, .016, .0003, -1] }, PEXP = { A: .07, B: .07, C: .10, D: .15, E: .35, F: .55 };
  function sig(cls, x) { var s = SIG[cls]; return [s[0] * x / Math.sqrt(1 + .0001 * x), s[2] ? s[1] * x * Math.pow(1 + s[2] * x, s[3]) : s[1] * x]; }
  function conc(Q, u, H, cls, x, y) { if (x <= 1) return 0; var s = sig(cls, x); return Q / (Math.PI * u * s[0] * s[1]) * Math.exp(-y * y / (2 * s[0] * s[0])) * Math.exp(-H * H / (2 * s[1] * s[1])) * 1e6; } // µg/m³
  var LIMIT = { SO2: [40, 'WHO 2021 24-h'], NO2: [25, 'WHO 2021 24-h'], PM10: [45, 'WHO 2021 24-h'], H2S: [150, 'WHO 24-h (odour/health)'] };

  /* ---------- data */
  function fetchAll(lat, lon) {
    var q = 'latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4);
    return Promise.all([
      SH.getJSON('https://api.open-meteo.com/v1/forecast?' + q + '&current=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,is_day,shortwave_radiation,visibility&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,wind_speed_10m_max&wind_speed_unit=ms&timezone=auto&past_days=7&forecast_days=7'),
      SH.getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?' + q + '&current=european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,dust,uv_index&timezone=auto').catch(function () { return null; })
    ]);
  }
  function run() {
    var lat = SH.num('eLat'), lon = SH.num('eLon'), btn = $('#eRun'); if (isNaN(lat) || isNaN(lon)) { SH.toast(t('Set the site first.', 'حدد الموقع أولاً.'), 'warn'); return; }
    persist.save(); btn.disabled = true; SH.busy($('#eMap').parentElement, true, t('Reading weather and air quality…', 'جارٍ قراءة الطقس وجودة الهواء…'));
    fetchAll(lat, lon).then(function (r) { W = r[0]; A = r[1]; analyse(lat, lon); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy($('#eMap').parentElement, false); });
  }
  function analyse(lat, lon) {
    var c = W.current, d = W.daily, today = d.time.indexOf((c.time || '').slice(0, 10)); if (today < 0) today = 7;
    var r = { lat: lat, lon: lon, T: c.temperature_2m, RH: c.relative_humidity_2m, Td: c.dew_point_2m, P: c.surface_pressure, u: c.wind_speed_10m, dir: c.wind_direction_10m, gust: c.wind_gusts_10m, cloud: c.cloud_cover, day: !!c.is_day, sw: c.shortwave_radiation || 0, vis: c.visibility, rain: c.precipitation,
      tmax: d.temperature_2m_max[today], tmin: d.temperature_2m_min[today], uv: d.uv_index_max[today], sunrise: (d.sunrise[today] || '').slice(11), sunset: (d.sunset[today] || '').slice(11), rain7: d.precipitation_sum.slice(0, today).reduce(function (a, b) { return a + (b || 0); }, 0), rainNext: d.precipitation_sum.slice(today).reduce(function (a, b) { return a + (b || 0); }, 0) };
    r.wbgt = wbgt(r.T, r.RH); r.hi = heatIndex(r.T, r.RH); r.wc = windChill(r.T, r.u); r.cls = stability(r.u, r.day, r.sw, r.cloud);
    r.aq = A && A.current ? A.current : null;
    if ($('#pOn').checked && src) r.plume = plume(r);
    r.wqi = wqi(); r.esai = esai(r);
    last = r; render();
  }

  function plume(r) {
    var Q = SH.num('pQ') || 50, H = SH.num('pH') || 40, gas = SH.val('pGas'), cls = r.cls, uH = Math.max(0.5, r.u * Math.pow(Math.max(H, 10) / 10, PEXP[cls])), to = (r.dir + 180) % 360, rad = SH.rad(to);
    var dx = SH.dist(src, { lat: src.lat, lon: r.lon }) * (r.lon >= src.lon ? 1 : -1), dy = SH.dist(src, { lat: r.lat, lon: src.lon }) * (r.lat >= src.lat ? 1 : -1);
    var xs = dx * Math.sin(rad) + dy * Math.cos(rad), ys = dx * Math.cos(rad) - dy * Math.sin(rad), cSite = conc(Q, uH, H, cls, xs, ys);
    var best = 0, bx = 0; for (var x = 10; x <= 50000; x *= 1.05) { var cc = conc(Q, uH, H, cls, x, 0); if (cc > best) { best = cc; bx = x; } }
    // raster around the source for the map overlay
    var R = Math.max(3000, Math.min(60000, Math.max(bx * 12, Math.hypot(dx, dy) * 1.4))), N = 160, cv = document.createElement('canvas'); cv.width = N; cv.height = N; var cx = cv.getContext('2d'), im = cx.createImageData(N, N), lim = LIMIT[gas][0];
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) { var ex = (i / (N - 1) * 2 - 1) * R, ny = (1 - j / (N - 1) * 2) * R, px = ex * Math.sin(rad) + ny * Math.cos(rad), py = ex * Math.cos(rad) - ny * Math.sin(rad), v = conc(Q, uH, H, cls, px, py), k = (j * N + i) * 4;
      if (v < lim * 0.02) { im.data[k + 3] = 0; continue; } var f = Math.min(1, Math.log10(v / (lim * 0.02)) / Math.log10(100)), col = f < .5 ? [255, 230 - 100 * f * 2, 80] : [230 - 40 * (f - .5) * 2, 130 - 110 * (f - .5) * 2, 60];
      im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; var edge = Math.min(1, (1 - Math.max(Math.abs(i / (N - 1) * 2 - 1), Math.abs(j / (N - 1) * 2 - 1))) * 8); im.data[k + 3] = (70 + 150 * f) * edge; }
    cx.putImageData(im, 0, 0); var dLat = R / 110574, dLon = R / (111320 * Math.cos(SH.rad(src.lat)));
    return { Q: Q, H: H, gas: gas, cls: cls, uH: uH, to: to, xs: xs, ys: ys, cSite: cSite, cMax: best, xMax: bx, img: cv.toDataURL(), bounds: [[src.lat - dLat, src.lon - dLon], [src.lat + dLat, src.lon + dLon]], lim: lim, limName: LIMIT[gas][1], dist: Math.hypot(dx, dy) };
  }
  function wqi() {
    var P = [['pH', 'wPH', 8.5, 7], ['TDS', 'wTDS', 500, 0], ['DO', 'wDO', 5, 14.6], ['Turbidity', 'wTur', 5, 0], ['NO₃⁻', 'wNO3', 50, 0], ['Cl⁻', 'wCl', 250, 0], ['SO₄²⁻', 'wSO4', 250, 0], ['TH', 'wTH', 500, 0], ['Ca²⁺', 'wCa', 75, 0]], rows = [], K = 0;
    P.forEach(function (p) { var v = SH.num(p[1]); if (!isNaN(v)) { K += 1 / p[2]; rows.push({ n: p[0], v: v, S: p[2], I: p[3] }); } });
    if (rows.length < 3) return null; K = 1 / K; var sw = 0, sq = 0;
    rows.forEach(function (r) { r.W = K / r.S; r.q = 100 * (r.v - r.I) / (r.S - r.I); if (r.n === 'pH') r.q = 100 * Math.abs(r.v - 7) / 1.5; sw += r.W; sq += r.W * r.q; });
    var w = sq / sw, so4 = SH.num('wSO4'), cl = SH.num('wCl');
    return { rows: rows, wqi: w, cls: w <= 25 ? 0 : w <= 50 ? 1 : w <= 75 ? 2 : w <= 100 ? 3 : 4, so4: so4, cl: cl, sulf: isNaN(so4) ? null : so4 < 150 ? 'S0' : so4 < 1500 ? 'S1' : so4 < 10000 ? 'S2' : 'S3' };
  }
  function esai(r) {
    var s = +SH.val('dSQI'), v = +SH.val('dVQI'), m = +SH.val('dMQI'), ai = r.rain7 + r.rainNext, cqi = r.T > 30 && ai < 1 ? 1.8 : r.T > 25 && ai < 5 ? 1.6 : ai < 20 ? 1.4 : 1.15, e = Math.pow(s * v * m * cqi, 0.25);
    var cl = e < 1.17 ? ['N', t('Non-affected', 'غير متأثرة')] : e < 1.23 ? ['P', t('Potential', 'محتملة')] : e < 1.27 ? ['F1', t('Fragile 1', 'هشة 1')] : e < 1.33 ? ['F2', t('Fragile 2', 'هشة 2')] : e < 1.38 ? ['F3', t('Fragile 3', 'هشة 3')] : e < 1.42 ? ['C1', t('Critical 1', 'حرجة 1')] : e < 1.53 ? ['C2', t('Critical 2', 'حرجة 2')] : ['C3', t('Critical 3', 'حرجة 3')];
    return { s: s, v: v, m: m, c: cqi, e: e, cls: cl };
  }

  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  var cardinal = function (deg) { return (SH.lang === 'ar' ? ['ش', 'ش ش', 'ش ق', 'ق ش ق', 'ق', 'ق ج ق', 'ج ق', 'ج ج ق', 'ج', 'ج ج غ', 'ج غ', 'غ ج غ', 'غ', 'غ ش غ', 'ش غ', 'ش ش غ'] : ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'])[Math.round(deg / 22.5) % 16]; };
  function render() {
    var r = last, aq = r.aq; $('#eEmpty').hidden = true; $('#eOut').hidden = false;
    var wb = r.wbgt, wbc = wb >= 32 ? 'bad' : wb >= 28 ? 'warn' : 'ok';
    $('#eKpis').innerHTML = kpi('info', t('Temperature', 'الحرارة'), SH.fmt(r.T, 1) + '<small>°C</small>', SH.fmt(r.tmin, 0) + '–' + SH.fmt(r.tmax, 0) + '°C · ' + t('range ', 'المدى ') + SH.fmt(r.tmax - r.tmin, 0) + '°') +
      kpi(wbc, 'WBGT', SH.fmt(wb, 1) + '<small>°C</small>', t('heat index ', 'مؤشر الحرارة ') + SH.fmt(r.hi, 0) + '°C') + kpi(r.u * 3.6 >= 40 ? 'bad' : r.u * 3.6 >= 25 ? 'warn' : '', t('Wind', 'الرياح'), SH.fmt(r.u * 3.6, 0) + '<small> km/h</small>', t('from ', 'من ') + cardinal(r.dir) + ' ' + Math.round(r.dir) + '° · ' + t('gusts ', 'هبات ') + SH.fmt(r.gust * 3.6, 0)) +
      kpi('', t('Humidity', 'الرطوبة'), SH.fmt(r.RH, 0) + '<small>%</small>', t('dew point ', 'نقطة الندى ') + SH.fmt(r.Td, 1) + '°C') + kpi('', t('Pressure', 'الضغط'), SH.fmt(r.P, 0) + '<small> hPa</small>', t('cloud ', 'الغيوم ') + r.cloud + '%') +
      kpi(r.vis < 2000 ? 'bad' : r.vis < 5000 ? 'warn' : '', t('Visibility', 'مدى الرؤية'), SH.fmt(r.vis / 1000, 1) + '<small> km</small>', '') + kpi(r.rain > 0 ? 'warn' : '', t('Rain', 'المطر'), SH.fmt(r.rain, 1) + '<small> mm</small>', t('7 days ', '7 أيام ') + SH.fmt(r.rain7, 0) + ' · ' + t('next ', 'القادم ') + SH.fmt(r.rainNext, 0) + ' mm') +
      kpi(r.uv >= 8 ? 'bad' : r.uv >= 6 ? 'warn' : '', t('UV index', 'مؤشر الأشعة UV'), SH.fmt(r.uv, 1), '☀ ' + r.sunrise + ' – ' + r.sunset) +
      (aq ? kpi(aq.european_aqi > 80 ? 'bad' : aq.european_aqi > 40 ? 'warn' : 'ok', t('Air quality', 'جودة الهواء'), aq.european_aqi != null ? aq.european_aqi : '—', 'EAQI · PM₂.₅ ' + SH.fmt(aq.pm2_5, 0) + ' · PM₁₀ ' + SH.fmt(aq.pm10, 0) + ' µg/m³') + kpi(aq.sulphur_dioxide > 40 || aq.nitrogen_dioxide > 25 ? 'warn' : '', 'NO₂ · SO₂', SH.fmt(aq.nitrogen_dioxide, 0) + ' · ' + SH.fmt(aq.sulphur_dioxide, 0), 'µg/m³ · CAMS') : '') +
      kpi('', t('Atmospheric stability', 'الاستقرار الجوي'), r.cls, 'Pasquill–Gifford · ' + (r.day ? t('day', 'نهار') : t('night', 'ليل')));
    expert(r); chart(SH.seg('eTab') || 't'); drawPlume(r); labs(r);
  }
  function card(ic, h, items) { return '<section class="pn"><div class="pn-h"><h2>' + h + '</h2></div><div class="pn-b" style="display:grid;gap:10px">' + items.map(function (i) { return '<div style="border-inline-start:3px solid var(--' + (i[0] === 'bad' ? 'danger' : i[0] === 'warn' ? 'warn' : 'ok') + ');padding-inline-start:10px;font-size:.86rem;line-height:1.65"><b>' + i[1] + '.</b> ' + i[2] + '</div>'; }).join('') + '</div></section>'; }
  function expert(r) {
    var g = [], h = [], q = [], aq = r.aq || {};
    g.push(r.u * 3.6 >= 40 ? ['bad', t('Machinery and drones', 'الآليات والطائرات المسيرة'), t('Wind above 40 km/h raises overturning moments on drill masts and cranes and blurs drone photogrammetry. Postpone lifting and flights.', 'الرياح فوق 40 كم/س ترفع عزوم الانقلاب على أبراج الحفر والرافعات وتشوه التصوير بالطائرات المسيرة. أجّل الرفع والطيران.')] : ['ok', t('Machinery and drones', 'الآليات والطائرات المسيرة'), t('Wind is within safe limits for rigs and survey drones.', 'الرياح ضمن الحدود الآمنة للحفارات وطائرات المسح.')]);
    g.push(r.rain > 0 || r.rainNext > 20 ? ['warn', t('Effective stress', 'الإجهاد الفعال'), (r.rain7 < 1 ? t('Rain after a dry spell enters desiccation cracks. ', 'المطر بعد فترة جفاف يدخل شقوق الجفاف. ') : '') + t('Rising pore pressure lowers effective stress (σ′ = σ − u, Terzaghi), so cut slopes and trenches lose strength.', 'ارتفاع ضغط المسام يخفض الإجهاد الفعال (σ′ = σ − u، تيرزاغي)، فتفقد المنحدرات المقطوعة والخنادق مقاومتها.')] : ['ok', t('Effective stress', 'الإجهاد الفعال'), t('No rain: effective stress is stable. Oven-dry rock samples before strength tests to standardise moisture (ISRM).', 'لا أمطار: الإجهاد الفعال مستقر. جفف العينات الصخرية فرنياً قبل فحوص المقاومة لتوحيد الرطوبة (ISRM).')]);
    if (r.tmax - r.tmin >= 18) g.push(['warn', t('Thermal weathering', 'التجوية الحرارية'), t('A daily range of ', 'مدى يومي قدره ') + SH.fmt(r.tmax - r.tmin, 0) + t('° drives thermal fatigue and granular disintegration of exposed rock.', '° يقود إلى الإجهاد الحراري والتفكك الحبيبي للصخور المكشوفة.')]);
    h.push(r.wbgt >= 32 ? ['bad', t('Heat stress', 'الإجهاد الحراري'), t('WBGT above 32 °C: stop heavy work, enforce shade, water and long rest cycles (ISO 7243, ACGIH).', 'WBGT فوق 32 °م: أوقف الأعمال الشاقة وطبّق الظل والماء ودورات راحة طويلة (ISO 7243، ACGIH).')] : r.wbgt >= 28 ? ['warn', t('Heat stress', 'الإجهاد الحراري'), t('WBGT 28–32 °C: limit heavy work to the cooler hours and schedule rest each hour.', 'WBGT بين 28 و32 °م: اقصر الأعمال الشاقة على الساعات الأبرد وجدول راحة كل ساعة.')] : ['ok', t('Heat stress', 'الإجهاد الحراري'), t('Heat load allows normal field work.', 'الحمل الحراري يسمح بالعمل الحقلي الاعتيادي.')]);
    if (aq.pm10 > 45 || aq.dust > 100) h.push(['warn', t('Dust', 'الغبار'), t('PM₁₀ above the WHO 24-h guideline: wear FFP2 masks and protect instrument optics and pumps.', 'PM₁₀ فوق دليل منظمة الصحة العالمية لـ24 ساعة: ارتدِ كمامات FFP2 واحمِ عدسات الأجهزة والمضخات.')]);
    if (r.plume) h.push(r.plume.cSite > r.plume.lim ? ['bad', t('Plume at the site', 'عمود التلوث عند الموقع'), t('Modelled ', 'التركيز المنمذج ') + r.plume.gas + ' ' + SH.fmt(r.plume.cSite, 0) + ' µg/m³ ' + t('exceeds the ', 'يتجاوز ') + r.plume.limName + t(' value. Move upwind.', '. انتقل عكس اتجاه الريح.')] : ['ok', t('Plume at the site', 'عمود التلوث عند الموقع'), t('The plume travels toward ', 'يتجه العمود نحو ') + Math.round(r.plume.to) + '° ' + t('and the site concentration is below the guideline.', 'وتركيزه عند الموقع دون الدليل.')]);
    else if (aq.sulphur_dioxide > 40 || aq.nitrogen_dioxide > 25) h.push(['warn', t('Combustion gases', 'غازات الاحتراق'), t('Regional NO₂ or SO₂ is above WHO guidelines; flaring or traffic is likely nearby. Smoke drifts toward ', 'تركيز NO₂ أو SO₂ الإقليمي فوق دليل منظمة الصحة؛ غالباً بسبب حرق الغاز أو المرور. ينجرف الدخان نحو ') + Math.round((r.dir + 180) % 360) + '°.']);
    q.push(r.uv >= 6 ? ['warn', t('Cables and polymers', 'الكابلات والبوليمرات'), t('High UV embrittles cable jackets and plastics; shade instruments and inspect cables (ASTM G154).', 'الأشعة العالية تقصف أغلفة الكابلات والبلاستيك؛ ظلل الأجهزة وافحص الكابلات (ASTM G154).')] : ['ok', t('Cables and polymers', 'الكابلات والبوليمرات'), t('UV exposure is moderate.', 'التعرض للأشعة معتدل.')]);
    q.push(r.T >= 45 || r.T <= -5 ? ['bad', t('Calibration', 'المعايرة'), t('Temperature is outside the usual −20 to +50 °C operating range margin; let total stations and GNSS receivers acclimatise and re-check calibration.', 'الحرارة خارج هامش نطاق التشغيل المعتاد؛ اترك المحطات الشاملة ومستقبلات GNSS تتأقلم وأعد فحص المعايرة.')] : ['ok', t('Calibration', 'المعايرة'), t('Instrument operating temperature is fine.', 'حرارة تشغيل الأجهزة مناسبة.')]);
    if (r.P < 1005 && r.u < 3) q.push(['bad', t('Barometric pumping', 'الضخ البارومتري'), t('Low and falling pressure with calm air draws radon, CO₂ and methane from the ground into pits and trenches. Ventilate and monitor gas before entry.', 'الضغط المنخفض مع سكون الهواء يسحب الرادون وثاني أكسيد الكربون والميثان من الأرض إلى الحفر والخنادق. هوِّ وراقب الغازات قبل الدخول.')]);
    $('#eExpert').innerHTML = card('hard-hat', t('Geotechnical', 'جيوتقني'), g) + card('shield-check', t('Health and safety', 'الصحة والسلامة'), h) + card('cpu', t('Instruments and materials', 'الأجهزة والمواد'), q);
  }
  function chart(k) {
    if (!W) return; var hr = W.hourly, p = SH.palette(), now = (W.current.time || '').slice(0, 13) + ':00', sh = [{ type: 'line', xref: 'x', yref: 'paper', x0: now, x1: now, y0: 0, y1: 1, line: { color: p.accent, dash: 'dot', width: 1.5 } }], tr;
    if (k === 't') tr = [{ x: hr.time, y: hr.temperature_2m, name: t('Temperature °C', 'الحرارة °م'), line: { color: '#D35400', width: 2 } }];
    else if (k === 'w') tr = [{ x: hr.time, y: hr.wind_speed_10m.map(function (v) { return v * 3.6; }), name: t('Wind km/h', 'الرياح كم/س'), line: { color: '#2E86C1', width: 2 }, fill: 'tozeroy', fillcolor: 'rgba(46,134,193,.1)' }];
    else tr = [{ x: hr.time, y: hr.precipitation, type: 'bar', name: t('Rain mm/h', 'المطر مم/س'), marker: { color: '#1F6FB2' } }, { x: hr.time, y: hr.relative_humidity_2m, name: t('Humidity %', 'الرطوبة %'), yaxis: 'y2', line: { color: p.text2, width: 1.5 } }];
    SH.plot('eChart', tr, function () { return SH.plotLayout({ shapes: sh, xaxis: { type: 'date' }, yaxis: { rangemode: 'tozero' }, yaxis2: { overlaying: 'y', side: 'right', showgrid: false, range: [0, 100] } }); });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#eTab button')) setTimeout(function () { chart(SH.seg('eTab')); }, 0); });
  function drawPlume(r) {
    if (!map) return; if (plumeOvl) map.removeLayer(plumeOvl); if (windArr) map.removeLayer(windArr);
    var to = (r.dir + 180) % 360, base = { lat: r.lat, lon: r.lon }, end = SH.dest(base, to, 2500); windArr = L.polyline([[base.lat, base.lon], [end.lat, end.lon]], { color: '#2E86C1', weight: 3, dashArray: '6 6' }).bindTooltip(t('Wind toward ', 'الريح نحو ') + Math.round(to) + '°').addTo(map);
    $('#plPn').hidden = !r.plume; if (!r.plume) return; var P = r.plume;
    plumeOvl = L.imageOverlay(P.img, P.bounds, { opacity: .9, interactive: false }).addTo(map); map.fitBounds(L.latLngBounds(P.bounds).extend([r.lat, r.lon]), { padding: [20, 20] });
    var row = function (k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; };
    $('#plTbl').innerHTML = row(t('Pollutant · Q · H', 'الملوث · Q · H'), P.gas + ' · ' + P.Q + ' g/s · ' + P.H + ' m') + row(t('Stability class · wind at H', 'فئة الاستقرار · الريح عند H'), P.cls + ' · ' + SH.fmt(P.uH, 1) + ' m/s') +
      row(t('Max ground-level concentration', 'أقصى تركيز أرضي'), '<b>' + SH.fmt(P.cMax, 0) + ' µg/m³</b> ' + t('at ', 'على بعد ') + SH.fmt(P.xMax / 1000, 2) + ' km ' + t('downwind', 'باتجاه الريح')) +
      row(t('At the site', 'عند الموقع'), '<b style="color:var(--' + (P.cSite > P.lim ? 'danger' : 'ok') + ')">' + SH.fmt(P.cSite, 1) + ' µg/m³</b> · ' + SH.fmt(P.dist / 1000, 2) + ' km ' + t('from the source', 'من المصدر') + (P.xs <= 0 ? ' · ' + t('upwind, not reached', 'عكس الريح، لا يصل') : '')) +
      row(t('Guideline', 'الدليل'), P.lim + ' µg/m³ (' + P.limName + ')') + row(t('Model', 'النموذج'), t('Steady-state Gaussian plume with ground reflection, Briggs (1973) rural σ<sub>y</sub>, σ<sub>z</sub>.', 'عمود غاوسي مستقر مع الانعكاس الأرضي، معاملات Briggs (1973) الريفية σ<sub>y</sub> وσ<sub>z</sub>.'));
  }
  function labs(r) {
    var w = r.wqi, e = r.esai; $('#labRow').hidden = false;
    if (w) { var CL = [[t('Excellent', 'ممتازة'), 'ok'], [t('Good', 'جيدة'), 'ok'], [t('Poor', 'رديئة'), 'warn'], [t('Very poor', 'رديئة جداً'), 'bad'], [t('Unsuitable for drinking', 'غير صالحة للشرب'), 'bad']][w.cls];
      $('#wTbl').innerHTML = '<thead><tr><th>' + t('Parameter', 'المعامل') + '</th><th class="num">' + t('Value', 'القيمة') + '</th><th class="num">' + t('Standard', 'المعيار') + '</th><th class="num">q<sub>i</sub></th><th class="num">W<sub>i</sub></th></tr></thead><tbody>' + w.rows.map(function (x) { return '<tr><td>' + x.n + '</td><td class="num">' + SH.fmt(x.v, 1) + '</td><td class="num">' + x.S + '</td><td class="num">' + SH.fmt(x.q, 0) + '</td><td class="num">' + SH.fmt(x.W, 3) + '</td></tr>'; }).join('') + '<tr><th colspan="3">WQI</th><th colspan="2" class="num"><span class="badge ' + CL[1] + '">' + SH.fmt(w.wqi, 1) + ' · ' + CL[0] + '</span></th></tr></tbody>';
      $('#wTxt').innerHTML = '<p style="margin:0">' + t('Weighted arithmetic index (Brown et al. 1972) against WHO drinking-water guidelines; W<sub>i</sub> ∝ 1/S<sub>i</sub>. ', 'مؤشر حسابي موزون (Brown وآخرون 1972) مقابل أدلة منظمة الصحة لمياه الشرب؛ W<sub>i</sub> ∝ 1/S<sub>i</sub>. ') + (w.sulf ? '<br><b>' + t('Concrete', 'الخرسانة') + ':</b> ' + t('sulfate exposure class ', 'فئة التعرض للكبريتات ') + w.sulf + ' (ACI 318-19 Table 19.3.1.1)' + (w.sulf !== 'S0' ? t(' — use sulfate-resisting cement and a low w/c ratio for foundations in contact with this water.', ' — استخدم سمنتاً مقاوماً للكبريتات ونسبة ماء/سمنت منخفضة للأسس الملامسة لهذه المياه.') : '.') : '') + (w.cl > 500 ? ' ' + t('Chloride above 500 mg/L raises reinforcement corrosion risk.', 'الكلوريد فوق 500 ملغم/لتر يرفع خطر تآكل حديد التسليح.') : '') + '</p>';
    } else { $('#wTbl').innerHTML = '<tbody><tr><td class="muted">' + t('Enter at least three water parameters to compute the index.', 'أدخل ثلاثة معاملات مياه على الأقل لحساب المؤشر.') + '</td></tr></tbody>'; $('#wTxt').textContent = ''; }
    var row = function (k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; }, col = /^C/.test(e.cls[0]) ? 'bad' : /^F/.test(e.cls[0]) ? 'warn' : 'ok';
    $('#dTbl').innerHTML = row('SQI · VQI · MQI', SH.fmt(e.s, 2) + ' · ' + SH.fmt(e.v, 2) + ' · ' + SH.fmt(e.m, 2)) + row(t('CQI (from current weather)', 'CQI (من الطقس الحالي)'), SH.fmt(e.c, 2)) + row('ESAI = (SQI·CQI·VQI·MQI)<sup>¼</sup>', '<span class="badge ' + col + '">' + SH.fmt(e.e, 3) + ' · ' + e.cls[0] + ' ' + e.cls[1] + '</span>');
    $('#dTxt').innerHTML = '<p style="margin:0">' + (col === 'bad' ? t('Critical: the land is already degrading. Bare, loose soil becomes a dust source and loses infiltration. Stop clearing and grazing, stabilise surfaces and restore vegetation.', 'حرجة: الأرض في طور التدهور. تصبح التربة الجرداء المفككة مصدراً للغبار وتفقد قابلية الترشيح. أوقف التجريف والرعي وثبّت الأسطح وأعد الغطاء النباتي.') : col === 'warn' ? t('Fragile: any further disturbance, such as earthworks or a drought year, can tip the area into active degradation.', 'هشة: أي اضطراب إضافي، كالأعمال الترابية أو سنة جفاف، قد يدفع المنطقة إلى تدهور نشط.') : t('Not affected: soil and cover resist wind and water erosion.', 'غير متأثرة: التربة والغطاء يقاومان التعرية الريحية والمائية.'));
    $('#dTxt').innerHTML += ' <span class="xsmall muted">' + t('Kosmas, Kirkby & Geeson (1999), MEDALUS classes.', 'Kosmas وKirkby وGeeson (1999)، فئات MEDALUS.') + '</span></p>';
  }
  $('#eRun').addEventListener('click', run);
  $('#eDemo').addEventListener('click', function () {
    site(30.5085, 47.7804, true); $('#pOn').checked = true; $('#pBox').hidden = false; $('#pGas').value = 'SO2'; $('#pQ').value = 60; $('#pH').value = 35; setSrc(30.535, 47.745);
    var v = { wPH: 7.8, wTDS: 1450, wDO: 5.6, wTur: 6, wNO3: 18, wCl: 410, wSO4: 520, wTH: 610, wCa: 140 }; for (var k in v) $('#' + k).value = v[k]; $('#dSQI').value = '1.45'; $('#dVQI').value = '1.7'; $('#dMQI').value = '2.0'; run();
  });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Run the monitoring first.', 'شغّل الرصد أولاً.'), 'warn'); } else if (map) map.invalidateSize(); });
  document.addEventListener('sh:redraw', function () { if (last) chart(SH.seg('eTab') || 't'); });
})();
