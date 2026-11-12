/* Field station — precise averaged position (degrees, DMS, UTM, GPS and model elevation); compass and clinometer in three
   holds (flat: heading of the top edge; upright: heading of the camera; on a bed: dip, dip direction and strike from the
   screen normal) with a level, magnetic and true north (IGRF) and recorded readings; weather for 24 h with rain, storm,
   heat and wind alerts; nearest road, stream, spring, settlement and named peak; the geological unit underfoot and around
   with Iraqi formation colours, lithology, fossils and features to look for; groundwater indications from the height above
   the nearest stream and the lithology; nearest active faults; map; and a one-page station card. Works offline for the
   position, compass and clinometer, and for the geology when the area was saved with the geology camera. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, AR = SH.lang === 'ar', RAD = Math.PI / 180, API = 'https://macrostrat.org/api/v2/';
  var map = SH.map('fsMap', { center: [35, 44.5], zoom: 6 }), L = window.L, lay = map ? L.layerGroup().addTo(map) : null, gov = null;
  var POS = null, DECL = null, FMS = [], D = {}, MODE = 'flat', OR = { ok: false }, lockT = 0, RECS = SH.store.get('shandal_fs_recs', []);
  var data = function (j) { return j && j.success ? j.success.data : j && j.data || j; };
  SH.getJSON(SH.base + 'assets/data/iraq-formations.json').then(function (r) { FMS = (r || []).map(function (f) { f.rx = new RegExp(f.re, 'i'); return f; }); }).catch(function () {});

  /* ---------------------------------------------------------------- formatting */
  function dms(v, pos, neg) { var a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60; return d + '° ' + String(m).padStart(2, '0') + '′ ' + s.toFixed(1).padStart(4, '0') + '″ ' + (v >= 0 ? pos : neg); }
  function card(a) { return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((a % 360) + 360) % 360 / 22.5) % 16]; }
  function cardAr(a) { return ['شمال', 'شمال–شمال شرق', 'شمال شرق', 'شرق–شمال شرق', 'شرق', 'شرق–جنوب شرق', 'جنوب شرق', 'جنوب–جنوب شرق', 'جنوب', 'جنوب–جنوب غرب', 'جنوب غرب', 'غرب–جنوب غرب', 'غرب', 'غرب–شمال غرب', 'شمال غرب', 'شمال–شمال غرب'][Math.round(((a % 360) + 360) % 360 / 22.5) % 16]; }
  function dir(a) { return AR ? cardAr(a) : card(a); }
  function brg(a, b) { var f1 = a[0] * RAD, f2 = b[0] * RAD, dl = (b[1] - a[1]) * RAD; return (Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) / RAD + 360) % 360; }
  function dist(a, b) { return SH.dist({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }); }
  function km(d) { return d < 1000 ? F(d, 0) + t(' m', ' م') : F(d / 1000, d < 10000 ? 1 : 0) + t(' km', ' كم'); }

  /* ---------------------------------------------------------------- position */
  $('#fsGps').addEventListener('click', function () {
    var b = this; b.disabled = true; $('#fsPos').innerHTML = '<span class="muted">' + t('Averaging position readings… stand still.', 'جارٍ حساب متوسط قراءات الموقع… قف ثابتاً.') + '</span>';
    SH.gpsFix({ ms: 30000, target: 4 }).then(function (f) { setPos(f.lat, f.lon, f); }).catch(function (e) { $('#fsPos').textContent = e.message; }).then(function () { b.disabled = false; });
  });
  if (map) map.on('click', function (e) { setPos(e.latlng.lat, e.latlng.lng, { manual: true }); });
  function setPos(lat, lon, f) {
    POS = { lat: lat, lon: lon, acc: f.acc || null, alt: f.alt != null ? f.alt : null, n: f.n || 0, manual: !!f.manual, t: new Date() }; var u = SH.toUTM(lat, lon);
    $('#fsPos').innerHTML = '<b class="ltr">' + lat.toFixed(6) + ', ' + lon.toFixed(6) + '</b><span class="ltr">' + dms(lat, 'N', 'S') + ' · ' + dms(lon, 'E', 'W') + '</span><span class="ltr">UTM ' + u.zone + u.band + ' · E ' + F(u.E, 0) + ' · N ' + F(u.N, 0) + '</span><span>' + (POS.manual ? t('Chosen on the map', 'مختار على الخريطة') : t('Accuracy ±', 'الدقة ±') + F(POS.acc || 0, 0) + t(' m from ', ' م من ') + (POS.n || 1) + t(' readings', ' قراءة')) + (POS.alt != null ? t(' · GPS height ', ' · ارتفاع GPS ') + F(POS.alt, 0) + t(' m', ' م') : '') + '</span>';
    $('#fsCopy').disabled = false;
    if (SH.igrf) SH.igrf.load().then(function () { var n = new Date(); DECL = SH.igrf.field(lat, lon, 0, n.getFullYear() + (n.getMonth() + .5) / 12).D; calTxt(); }).catch(function () {});
    if (map) map.setView([lat, lon], 13);
    dossier();
  }
  $('#fsCopy').addEventListener('click', function () {
    if (!POS) return; var u = SH.toUTM(POS.lat, POS.lon), txt = t('My position: ', 'موقعي: ') + POS.lat.toFixed(6) + ', ' + POS.lon.toFixed(6) + ' (UTM ' + u.zone + u.band + ' ' + Math.round(u.E) + ' ' + Math.round(u.N) + ')' + (D.z != null ? t(', elevation ', '، الارتفاع ') + Math.round(D.z) + t(' m', ' م') : '') + ' · ' + new Date().toLocaleString() + ' · https://maps.google.com/?q=' + POS.lat.toFixed(6) + ',' + POS.lon.toFixed(6);
    if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { SH.toast(t('Copied.', 'نُسخ.'), 'ok'); }); else SH.toast(txt, 'info');
  });

  /* ---------------------------------------------------------------- compass and clinometer */
  var HOW = { flat: ['Hold the phone flat, screen to the sky, away from the car, keys and the hammer. The top edge of the phone points to the direction read. Keep the bubble in the circle.', 'أمسك الهاتف أفقياً والشاشة نحو السماء، بعيداً عن السيارة والمفاتيح والمطرقة. يشير الحد الأعلى للهاتف إلى الاتجاه المقروء. أبقِ الفقاعة داخل الدائرة.'],
    up: ['Hold the phone upright in front of you with the camera facing the target (a peak, a ridge, a well). The heading is the direction the camera looks; the tilt shows how far up or down.', 'أمسك الهاتف قائماً أمامك والكاميرا نحو الهدف (قمة أو حافة أو بئر). الاتجاه هو ما تنظر إليه الكاميرا، والإمالة تبيّن مقدار الصعود أو النزول.'],
    plane: ['Lay the back of the phone flat on the bedding, joint or fault surface, screen up (use a notebook on rough surfaces). The phone reads the dip and the dip direction; the strike is the dip direction minus 90° (right-hand rule).', 'ضع ظهر الهاتف مستوياً على سطح الطبقة أو الفاصل أو الفالق والشاشة للأعلى (استعمل دفتراً على السطوح الخشنة). يقرأ الهاتف الميل واتجاه الميل؛ والمضرب يساوي اتجاه الميل ناقص 90° (قاعدة اليد اليمنى).'] };
  function setMode(m) { MODE = m; Array.prototype.forEach.call($('#fsModes').children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-m') === m); }); $('#fsHow').textContent = t(HOW[m][0], HOW[m][1]); }
  $('#fsModes').addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (b) setMode(b.getAttribute('data-m')); });
  setMode('flat');
  function onOri(e) {
    if (e.beta == null) return; var al = e.alpha, abs = e.type === 'deviceorientationabsolute' || e.absolute;
    if (e.webkitCompassHeading != null) { al = 360 - e.webkitCompassHeading; abs = true; OR.acc = e.webkitCompassAccuracy; } else if (!abs && OR.abs) return;
    if (abs) OR.abs = true; OR.rel = !abs;
    var a = al * RAD, b = e.beta * RAD, g = e.gamma * RAD, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    var top = [-cb * sa, ca * cb, sb], z = [cg * sa * sb + ca * sg, sa * sg - ca * cg * sb, cb * cg], cam = [-z[0], -z[1], -z[2]];
    var h = function (v) { return (Math.atan2(v[0], v[1]) / RAD + 360) % 360; }, sm = function (old, nw) { if (old == null || isNaN(old)) return nw; var d = ((nw - old + 540) % 360) - 180; return (old + d * 0.2 + 360) % 360; };
    OR.flat = sm(OR.flat, h(top)); OR.cam = sm(OR.cam, h(cam)); OR.pitch = Math.asin(Math.max(-1, Math.min(1, cam[2]))) / RAD; OR.beta = e.beta; OR.gamma = e.gamma;
    var n = z[2] < 0 ? [-z[0], -z[1], -z[2]] : z; OR.dip = Math.acos(Math.max(-1, Math.min(1, n[2]))) / RAD; OR.dd = sm(OR.dd, h(n)); OR.ok = true;
  }
  $('#fsStart').addEventListener('click', function () {
    var ask = window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission().catch(function () { return 'denied'; }) : Promise.resolve('granted');
    ask.then(function (r) { if (r !== 'granted') { SH.toast(t('Motion and orientation access was refused; allow it in the browser settings.', 'رُفض إذن الحركة والاتجاه؛ اسمح به من إعدادات المتصفح.'), 'bad'); return; }
      window.addEventListener('deviceorientationabsolute', onOri); window.addEventListener('deviceorientation', onOri); $('#fsStart').disabled = true; $('#fsLock').disabled = false;
      setTimeout(function () { if (!OR.ok) SH.toast(t('No compass found on this device (a phone or tablet is needed).', 'لا توجد بوصلة في هذا الجهاز (يلزم هاتف أو جهاز لوحي).'), 'warn'); }, 2500); (function loop() { dial(); requestAnimationFrame(loop); })(); });
  });
  function calTxt() { $('#fsCal').textContent = (DECL != null ? t('Magnetic declination here ', 'الانحراف المغناطيسي هنا ') + (DECL >= 0 ? '+' : '') + F(DECL, 1) + t('° (east positive), from the IGRF model. ', '° (الشرق موجب)، من نموذج IGRF. ') : t('Fix the position to add the magnetic declination. ', 'حدّد الموقع لإضافة الانحراف المغناطيسي. ')) + (OR.rel ? t('This browser gives a relative compass: readings may drift.', 'هذا المتصفح يعطي بوصلة نسبية: قد تنحرف القراءات.') : OR.acc != null ? t('Compass accuracy ±', 'دقة البوصلة ±') + F(OR.acc, 0) + '°.' : t('If readings jump, move the phone in a figure of eight to calibrate.', 'إن قفزت القراءات حرّك الهاتف على شكل رقم ثمانية للمعايرة.')); }
  function cur() { var dc = DECL || 0, mag = MODE === 'up' ? OR.cam : MODE === 'flat' ? OR.flat : OR.dd; return { mag: mag, tru: (mag + dc + 360) % 360, dip: OR.dip, dd: (OR.dd + dc + 360) % 360, pitch: OR.pitch }; }
  function dial() {
    if (!OR.ok || Date.now() < lockT) return; var c = cur(), s = '', r = 112, cx = 130, cy = 130, rot = -(c.tru || 0);
    s += '<circle cx="130" cy="130" r="122" fill="#141C24"/><g transform="rotate(' + rot.toFixed(1) + ' 130 130)">';
    for (var a = 0; a < 360; a += 5) { var l = a % 30 ? 6 : 12, x1 = cx + Math.sin(a * RAD) * r, y1 = cy - Math.cos(a * RAD) * r, x2 = cx + Math.sin(a * RAD) * (r - l), y2 = cy - Math.cos(a * RAD) * (r - l); s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#d8dee4" stroke-width="' + (a % 30 ? 1 : 2) + '"/>'; }
    [['N', 0, '#FF6B5B'], ['E', 90, '#fff'], ['S', 180, '#fff'], ['W', 270, '#fff']].forEach(function (q) { s += '<text x="' + (cx + Math.sin(q[1] * RAD) * 84).toFixed(1) + '" y="' + (cy - Math.cos(q[1] * RAD) * 84 + 7).toFixed(1) + '" text-anchor="middle" font-size="20" font-weight="800" fill="' + q[2] + '" font-family="system-ui" transform="rotate(' + q[1] + ' ' + (cx + Math.sin(q[1] * RAD) * 84).toFixed(1) + ' ' + (cy - Math.cos(q[1] * RAD) * 84).toFixed(1) + ')">' + q[0] + '</text>'; });
    for (a = 30; a < 360; a += 30) if (a % 90) s += '<text x="' + (cx + Math.sin(a * RAD) * 86).toFixed(1) + '" y="' + (cy - Math.cos(a * RAD) * 86 + 4).toFixed(1) + '" text-anchor="middle" font-size="11" fill="#9aa3ab" font-family="system-ui">' + a + '</text>';
    if (MODE === 'plane' && c.dip > 1) { var dd = c.dd; s += '<g transform="rotate(' + dd.toFixed(1) + ' 130 130)"><line x1="130" y1="130" x2="130" y2="62" stroke="#FFD666" stroke-width="4"/><path d="M130 52l8 14h-16z" fill="#FFD666"/><line x1="70" y1="130" x2="190" y2="130" stroke="#FFD666" stroke-width="4"/></g>'; }
    s += '</g><path d="M130 4l9 18h-18z" fill="#E8C77A"/>';
    if (MODE === 'flat') { var bx = Math.max(-40, Math.min(40, (OR.gamma || 0) * 2)), by = Math.max(-40, Math.min(40, (OR.beta || 0) * 2)), lv = Math.hypot(OR.gamma || 0, OR.beta || 0) < 3; s += '<circle cx="130" cy="130" r="18" fill="none" stroke="' + (lv ? '#2E8B57' : '#d8dee4') + '" stroke-width="2"/><circle cx="' + (130 + bx).toFixed(1) + '" cy="' + (130 + by).toFixed(1) + '" r="8" fill="' + (lv ? '#2E8B57' : '#E8C77A') + '"/>'; }
    $('#fsDial').innerHTML = s;
    var R0 = MODE === 'plane' ? [[t('Dip', 'الميل'), F(c.dip, 0) + '°'], [t('Dip direction', 'اتجاه الميل'), F(c.dd, 0) + '°'], [t('Strike (RHR)', 'المضرب'), F((c.dd + 270) % 360, 0) + '°']] : [[t('True', 'حقيقي'), F(c.tru, 0) + '° ' + card(c.tru)], [t('Magnetic', 'مغناطيسي'), F(c.mag, 0) + '°'], MODE === 'up' ? [t('Tilt', 'الإمالة'), (c.pitch >= 0 ? '+' : '') + F(c.pitch, 0) + '°'] : [t('Level', 'الاستواء'), Math.hypot(OR.gamma || 0, OR.beta || 0) < 3 ? t('good', 'جيد') : F(Math.hypot(OR.gamma || 0, OR.beta || 0), 0) + '°']];
    $('#fsRead').innerHTML = R0.map(function (q) { return '<div><small>' + q[0] + '</small><b class="ltr">' + q[1] + '</b></div>'; }).join('');
  }
  $('#fsLock').addEventListener('click', function () {
    if (!OR.ok) return; var c = cur(), r = { t: new Date().toISOString(), mode: MODE, lat: POS ? +POS.lat.toFixed(6) : null, lon: POS ? +POS.lon.toFixed(6) : null, decl: DECL != null ? +DECL.toFixed(1) : null };
    if (MODE === 'plane') { r.dd = Math.round(c.dd); r.dip = Math.round(c.dip); r.strike = Math.round((c.dd + 270) % 360); } else { r.tru = Math.round(c.tru); r.mag = Math.round(c.mag); if (MODE === 'up') r.pitch = Math.round(c.pitch); }
    RECS.push(r); SH.store.set('shandal_fs_recs', RECS); lockT = Date.now() + 2500; recs(); if (navigator.vibrate) navigator.vibrate(60); SH.toast(t('Reading recorded.', 'سُجلت القراءة.'), 'ok'); if (D.ready) cardFig();
  });
  function recs() {
    $('#fsRecs').innerHTML = RECS.length ? '<table class="tbl"><tbody>' + RECS.slice(-12).reverse().map(function (r) { return '<tr><td>' + r.t.slice(11, 16) + '</td><td>' + ({ flat: t('flat', 'أفقي'), up: t('upright', 'قائم'), plane: t('plane', 'مستوى') })[r.mode] + '</td><td class="ltr">' + (r.mode === 'plane' ? r.dd + '/' + r.dip + ' (' + t('strike ', 'مضرب ') + r.strike + ')' : r.tru + '° T · ' + r.mag + '° M' + (r.pitch != null ? ' · ' + r.pitch + '°' : '')) + '</td></tr>'; }).join('') + '</tbody></table>' : '<span class="muted">' + t('Lock a reading to keep it here.', 'ثبّت قراءة لتحفظها هنا.') + '</span>';
  }
  $('#fsNet').addEventListener('click', function () { var P = RECS.filter(function (r) { return r.mode === 'plane'; }); if (!P.length) return SH.toast(t('No plane readings yet.', 'لا قراءات مستويات بعد.'), 'warn'); var rows = SH.store.get('shandal_stereonet_rows', []); P.forEach(function (r) { rows.push({ t: 'P', a: r.dd, b: r.dip, s: '', src: 'phone' }); }); SH.store.set('shandal_stereonet_rows', rows); location.href = SH.base + (AR ? 'ar/' : '') + 'tools/stereonet-lab/app/'; });
  $('#fsRecCsv').addEventListener('click', function () { SH.csv('shandal-station-readings.csv', [['time_utc', 'mode', 'lat', 'lon', 'true_heading', 'magnetic_heading', 'tilt', 'dip_direction', 'dip', 'strike_rhr', 'declination']].concat(RECS.map(function (r) { return [r.t, r.mode, r.lat, r.lon, r.tru, r.mag, r.pitch, r.dd, r.dip, r.strike, r.decl]; }))); });
  $('#fsRecClr').addEventListener('click', function () { SH.confirm(t('Delete all recorded readings?', 'احذف كل القراءات المسجلة؟')).then(function (ok) { if (ok) { RECS = []; SH.store.set('shandal_fs_recs', RECS); recs(); } }); });

  /* ---------------------------------------------------------------- dossier */
  var OVP = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  function overpass(q, i) { i = i || 0; return fetch(OVP[i], { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(function (e) { if (i + 1 < OVP.length) return overpass(q, i + 1); throw e; }); }
  function segNear(g, p) { var best = { d: Infinity, ll: null }; for (var i = 0; i < g.length; i++) { var a = g[i], b = g[i + 1] || a, mx = Math.cos(p[0] * RAD), ax = (a.lon - p[1]) * mx, ay = a.lat - p[0], bx = (b.lon - p[1]) * mx, by = b.lat - p[0], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0, lat = a.lat + (b.lat - a.lat) * u, lon = a.lon + (b.lon - a.lon) * u, d = dist(p, [lat, lon]); if (d < best.d) best = { d: d, ll: [lat, lon] }; } return best; }
  function nearby(p) {
    var la = p[0].toFixed(5), lo = p[1].toFixed(5), q = '[out:json][timeout:40];(way(around:3000,' + la + ',' + lo + ')["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track)$"];way(around:10000,' + la + ',' + lo + ')["waterway"~"^(river|stream|canal)$"];node(around:12000,' + la + ',' + lo + ')["natural"="spring"];node(around:15000,' + la + ',' + lo + ')["place"~"^(city|town|village)$"];node(around:30000,' + la + ',' + lo + ')["natural"="peak"]["name"];node(around:20000,' + la + ',' + lo + ')["natural"="cave_entrance"];);out tags geom;';
    return overpass(q).then(function (j) {
      var E = (j.elements || []).map(function (e) { var tg = e.tags || {}, nm = (AR && tg['name:ar']) || (!AR && tg['name:en']) || tg.name || '', r; if (e.type === 'node') r = { d: dist(p, [e.lat, e.lon]), ll: [e.lat, e.lon] }; else if (e.geometry) r = segNear(e.geometry, p); else return null;
        var k = tg.highway ? 'road' : tg.waterway ? tg.waterway : tg.natural === 'spring' ? 'spring' : tg.place ? 'place' : tg.natural === 'peak' ? 'peak' : tg.natural === 'cave_entrance' ? 'cave' : 'other';
        var en = tg['name:en'] || (/[\u0600-\u06FF]/.test(tg.name || '') ? '' : tg.name || ''); return { k: k, sub: tg.highway || tg.place || '', name: nm, en: en, d: r.d, ll: r.ll, ele: tg.ele ? parseFloat(tg.ele) : null }; }).filter(Boolean);
      var best = function (f) { return E.filter(f).sort(function (a, b) { return a.d - b.d; })[0] || null; };
      return { road: best(function (e) { return e.k === 'road' && e.sub !== 'track'; }), track: best(function (e) { return e.k === 'road' && e.sub === 'track'; }), river: best(function (e) { return e.k === 'river'; }), stream: best(function (e) { return e.k === 'stream' || e.k === 'canal'; }), spring: best(function (e) { return e.k === 'spring'; }), place: best(function (e) { return e.k === 'place'; }), town: best(function (e) { return e.k === 'place' && /city|town/.test(e.sub); }), peak: best(function (e) { return e.k === 'peak'; }), cave: best(function (e) { return e.k === 'cave'; }) };
    });
  }
  function weather(p) { return SH.getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + p[0].toFixed(4) + '&longitude=' + p[1].toFixed(4) + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code,precipitation&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_gusts_10m&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=2', { timeout: 20000 }); }
  function geoAt(p) { return SH.getJSON(API + 'geologic_units/map?lat=' + p[0].toFixed(5) + '&lng=' + p[1].toFixed(5), { timeout: 20000 }).then(function (j) { var d = data(j) || []; if (!Array.isArray(d)) d = [d]; var R0 = { large: 0, medium: 1, small: 2, tiny: 3 }; return d.filter(function (u) { return u && u.map_id != null; }).map(function (u) { var sc = u.scale || ''; return { rk: R0[sc] != null ? R0[sc] : 2, name: (u.name || u.strat_name || u.best_int_name || '').trim(), strat: u.strat_name || '', int: u.best_int_name || '', b: +u.b_age, tt: +u.t_age, lith: u.lith || '', desc: u.descrip || '', col: u.color || '#ccc' }; }).sort(function (a, b) { return a.rk - b.rk; })[0] || null; }).catch(function () { return null; }); }
  function faults(p) { var key = Math.floor(p[0] / 10) * 10 + '_' + Math.floor(p[1] / 10) * 10; return SH.getJSON(SH.base + 'assets/data/faults/' + key + '.json').then(function (A) { var out = []; (A || []).forEach(function (f) { var c = f[4], g = []; for (var i = 0; i + 1 < c.length; i += 2) g.push({ lat: c[i + 1], lon: c[i] }); var r = segNear(g, p); if (r.d < 150000) out.push({ name: f[0], type: f[1], rate: f[2], dip: f[3], d: r.d, ll: r.ll, g: g }); }); return out.sort(function (a, b) { return a.d - b.d; }).slice(0, 4); }).catch(function () { return []; }); }
  function pack(p) { return new Promise(function (res) { try { var r = indexedDB.open('shandal_eye', 1); r.onupgradeneeded = function () { r.result.createObjectStore('packs', { keyPath: 'id' }); }; r.onsuccess = function () { var x = r.result.transaction('packs', 'readonly').objectStore('packs').getAll(); x.onsuccess = function () { var best = null; (x.result || []).forEach(function (k) { if (dist(p, [k.lat, k.lon]) < k.r * 0.7) best = k; }); res(best); }; x.onerror = function () { res(null); }; }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  function dossier() {
    var p = [POS.lat, POS.lon]; D = { p: p }; $('#fsEmpty').hidden = true; $('#fsOut').hidden = false; $('#fsKpis').innerHTML = '<p class="muted">' + t('Reading the place…', 'قراءة المكان…') + '</p>';
    var around = []; for (var a = 0; a < 360; a += 45) around.push([p[0] + 2500 * Math.cos(a * RAD) / 110574, p[1] + 2500 * Math.sin(a * RAD) / (111320 * Math.cos(p[0] * RAD))]);
    var jobs = [weather(p).catch(function () { return null; }), nearby(p).catch(function () { return null; }), geoAt(p), Promise.all(around.map(geoAt)), faults(p), SH.dem.points([p], { source: 'aws' }).then(function (z) { return z[0]; }).catch(function () { return null; }), pack(p)];
    Promise.all(jobs).then(function (r) {
      D.wx = r[0]; D.nb = r[1]; D.u = r[2]; D.ar = r[3]; D.fa = r[4]; D.z = r[5]; D.pk = r[6];
      if (D.pk) { if (D.z == null) { D.z = zPack(D.pk, p); } if (!D.u) { var u = unitPack(D.pk, p); if (u) D.u = { name: u.name, int: u.int, b: u.b, tt: u.tt, lith: u.lith, desc: u.desc, col: u.col }; } if (!D.fa.length && D.pk.faults) D.fa = D.pk.faults; }
      var n = D.nb, hv = n && (n.river || n.stream) ? (n.river && n.stream ? (n.river.d < n.stream.d * 3 ? n.river : n.stream) : (n.river || n.stream)) : null; D.hv = hv;
      var after = hv && D.z != null ? SH.dem.points([hv.ll], { source: 'aws' }).then(function (z) { D.hab = D.z - z[0]; }).catch(function () {}) : Promise.resolve();
      return after.then(function () { D.ready = true; render(); });
    });
  }
  function zPack(k, p) { var b = k.dem.b, nx = k.dem.nx, ny = k.dem.ny, i = Math.round((p[1] - b.w) / (b.e - b.w) * (nx - 1)), j = Math.round((b.n - p[0]) / (b.n - b.s) * (ny - 1)); return k.dem.z[j * nx + i]; }
  function unitPack(k, p) { var best = null, bd = Infinity; (k.samples || []).forEach(function (s) { var d = dist(p, s.ll); if (s.id != null && d < bd) { bd = d; best = s.id; } }); return (k.units || []).filter(function (u) { return u.id === best; })[0] || null; }

  /* ---------------------------------------------------------------- lithology knowledge */
  var LK = [
    [/limestone|carbonate|chalk|dolom|dolostone|reef/i, ['Limestone or dolostone', 'حجر جيري أو دولومايت'], ['Fizzes in dilute HCl (dolomite only when powdered)', 'يفور مع حامض الهيدروكلوريك المخفف (الدولومايت فقط إذا سُحق)'], ['Fossils (foraminifera, shells, corals), stylolites, joints, karst holes and caves, chert nodules', 'متحجرات (فورامنيفرا وأصداف ومرجان)، وستايلولايت، وفواصل، وتجاويف كارستية وكهوف، وعقد صوان'], ['Light grey, cream, buff or white', 'رمادي فاتح أو كريمي أو أصفر شاحب أو أبيض']],
    [/sandstone|sand|arenite|greywacke/i, ['Sandstone', 'حجر رملي'], ['Grains visible with the lens; rough to the touch', 'الحبيبات تُرى بالعدسة؛ خشن الملمس'], ['Cross-bedding, ripple marks, graded beds, sole marks, channel shapes, imbricated pebbles', 'تطبق متقاطع، وعلامات تموج، وطبقات متدرجة، وآثار قواعد، وأشكال قنوات، وحصى متراكب'], ['Buff, grey, brown or red', 'أصفر شاحب أو رمادي أو بني أو أحمر']],
    [/clay|mud|shale|marl|silt/i, ['Claystone, marl or shale', 'طين أو مارل أو طفل'], ['Marl fizzes weakly; clay is smooth and sticky when wet', 'المارل يفور بضعف؛ والطين ناعم ولزج عند البلل'], ['Fissility, mud cracks, gypsum veins, slumps, badlands and gullies', 'تورق، وتشققات طينية، وعروق جبس، وانزلاقات، وأراضٍ رديئة وأخاديد'], ['Green, grey, red-brown or black', 'أخضر أو رمادي أو بني محمر أو أسود']],
    [/gypsum|anhydrite|evaporite|salt|halite/i, ['Evaporites', 'متبخرات'], ['Gypsum scratches with a fingernail; salt tastes salty', 'الجبس يُخدش بالظفر؛ والملح طعمه مالح'], ['Selenite crystals, satin-spar veins, chicken-wire texture, dissolution sinkholes', 'بلورات سيلينايت، وعروق جبس ليفي، ونسيج شبك الدجاج، وحفر ذوبان'], ['White, grey or pinkish', 'أبيض أو رمادي أو وردي']],
    [/conglomerate|gravel|breccia|fan/i, ['Conglomerate or gravel', 'مدملكات أو حصى'], ['Rounded (conglomerate) or angular (breccia) clasts', 'فتات مستدير (مدملكات) أو حاد (بريشيا)'], ['Imbrication, channel fills, clast types that reveal the source rocks', 'تراكب الحصى، ومالئات القنوات، وأنواع الفتات التي تكشف صخور المصدر'], ['Mixed colours of the pebbles', 'ألوان مختلطة بحسب الحصى']],
    [/basalt|volcanic|igneous|gabbro|ophiolit|serpentin|peridot|granite|diorite|tuff|lava/i, ['Igneous or ophiolitic rocks', 'صخور نارية أو أوفيولايتية'], ['No reaction with acid; crystals or glassy texture', 'لا تتفاعل مع الحامض؛ نسيج بلوري أو زجاجي'], ['Columnar joints, vesicles, pillow lavas, serpentinite with shiny green surfaces, contact zones', 'فواصل عمودية، وفجوات غازية، ولابات وسائدية، وسربنتينايت بسطوح خضراء لامعة، ونطاقات تماس'], ['Dark green, black or speckled', 'أخضر داكن أو أسود أو مبقع']],
    [/schist|slate|marble|phyllite|metamorph|gneiss|quartzite/i, ['Metamorphic rocks', 'صخور متحولة'], ['Foliation and shiny micas; marble fizzes', 'تورق وميكا لامعة؛ والمرمر يفور'], ['Foliation, crenulation, folds at all scales, quartz veins', 'تورق، وتجعد، وطيات بكل المقاييس، وعروق كوارتز'], ['Grey, green or white', 'رمادي أو أخضر أو أبيض']],
    [/alluvi|quaternary|recent|holocene|terrace|soil|flood/i, ['Young sediments (Quaternary)', 'رسوبيات حديثة (الرباعي)'], ['Loose, not cemented', 'مفككة غير ملتحمة'], ['River terraces, alluvial fans, desert pavement, gypcrete and calcrete crusts', 'مصاطب نهرية، ومراوح غرينية، ورصيف صحراوي، وقشور جبسية وكلسية'], ['Brown, buff or grey', 'بني أو أصفر شاحب أو رمادي']]];
  function lithInfo(s) { return LK.filter(function (q) { return q[0].test(s || ''); }); }
  function fmMatch(u) { if (!u) return []; var s = [u.name, u.strat, u.desc].join(' '); return FMS.filter(function (f) { return f.rx.test(s); }); }

  /* ---------------------------------------------------------------- tectonic zone of Iraq from generalised boundary lines */
  var ZL = { mzt: [[37.10, 44.35], [36.85, 44.80], [36.67, 45.05], [36.35, 45.30], [36.00, 45.55], [35.62, 45.95], [35.35, 46.10], [35.05, 46.30]],
    mff: [[37.10, 42.30], [37.00, 42.55], [36.88, 43.10], [36.75, 43.55], [36.50, 43.95], [36.25, 44.25], [35.95, 44.70], [35.65, 45.05], [35.35, 45.40], [35.05, 45.70], [34.65, 45.95], [34.20, 46.30]],
    ham: [[35.60, 43.20], [35.30, 43.35], [35.10, 43.55], [34.80, 44.00], [34.45, 44.55], [34.15, 45.05], [33.75, 45.60], [33.30, 46.10]] };
  var ZN = { thrust: ['Zagros Thrust Zone', 'نطاق الزحوف'], hfz: ['High Folded Zone', 'نطاق الطيات العالية'], foothill: ['Foothill Zone (low folds)', 'نطاق التلال (الطيات الواطئة)'], mesop: ['Mesopotamian Plain', 'السهل الرسوبي'], west: ['Jazira and Western Desert', 'الجزيرة والصحراء الغربية'] };
  function side(p, g) { var kx = Math.cos(p[0] * RAD), best = Infinity, sg = 0; for (var i = 0; i < g.length - 1; i++) { var ax = g[i][1] * kx, ay = g[i][0], bx = g[i + 1][1] * kx, by = g[i + 1][0], px = p[1] * kx, py = p[0], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)), qx = ax + u * dx - px, qy = ay + u * dy - py, d2 = qx * qx + qy * qy; if (d2 < best) { best = d2; sg = dx * (py - ay) - dy * (px - ax); } } return { s: sg > 0 ? 1 : -1, d: Math.sqrt(best) * 111.2 }; }
  function zoneAt(p) {
    if (p[0] < 29 || p[0] > 37.5 || p[1] < 38.7 || p[1] > 48.7) return null;
    var a = side(p, ZL.mzt), b = side(p, ZL.mff), c = side(p, ZL.ham), z, nr = [];
    if (a.s > 0) z = 'thrust'; else if (b.s > 0) z = 'hfz'; else if ((p[1] < 43.1 && p[0] > 34.3) || p[1] < 42.3) z = 'west'; else if (c.s > 0 || p[0] > 35.3) z = 'foothill'; else z = 'mesop';
    if (a.d < 15) nr.push(a.s > 0 ? 'hfz' : 'thrust'); if (b.d < 15 && z !== 'thrust') nr.push(b.s > 0 ? 'foothill' : 'hfz'); if (c.d < 15 && /foothill|mesop/.test(z)) nr.push(c.s > 0 ? 'mesop' : 'foothill');
    return { z: z, near: nr };
  }
  /* likelihood of each Iraqi formation from the place (zone, mapped age, mapped name) and from the description */
  var COLS = [['red', 'Brick red', 'أحمر طابوقي', '#B5523B'], ['redbrown', 'Red-brown', 'بني محمر', '#9A5B45'], ['brown', 'Brown', 'بني', '#8B6B4A'], ['buff', 'Buff / yellowish', 'أصفر شاحب', '#D9C28E'], ['white', 'White / cream', 'أبيض / كريمي', '#F1ECDF'], ['lgrey', 'Light grey', 'رمادي فاتح', '#BFC3C2'], ['dgrey', 'Dark grey / black', 'رمادي داكن / أسود', '#45484A'], ['green', 'Green / olive', 'أخضر / زيتوني', '#7E9161'], ['bluegrey', 'Blue-grey', 'رمادي مزرق', '#8796A0'], ['purple', 'Purple', 'بنفسجي', '#7D5A79'], ['mixed', 'Many colours (pebbles)', 'ألوان كثيرة (حصى)', 'conic-gradient(#B5523B,#D9C28E,#7E9161,#45484A,#B5523B)']];
  var LITHS = [['lst', 'Limestone', 'حجر جيري'], ['dol', 'Dolomite', 'دولومايت'], ['marl', 'Marl', 'مارل'], ['clay', 'Claystone / shale', 'طين / طفل'], ['silt', 'Siltstone', 'غرين'], ['sst', 'Sandstone', 'حجر رملي'], ['cgl', 'Conglomerate / gravel', 'مدملكات / حصى'], ['gyp', 'Gypsum', 'جبس'], ['chert', 'Chert', 'صوان'], ['volc', 'Volcanic rock', 'صخر بركاني'], ['ultra', 'Serpentinite (dark, heavy, shiny green)', 'سربنتينايت (داكن ثقيل أخضر لامع)']];
  var FEATS = [['gyp', 'Gypsum bands or veins', 'أشرطة أو عروق جبس'], ['cyc', 'Repeated alternating beds', 'تعاقب طبقات متكرر'], ['xbed', 'Cross-bedding', 'تطبق متقاطع'], ['chan', 'Channels or pebble lenses', 'قنوات أو عدسات حصى'], ['cliff', 'Forms cliffs or ridges', 'يكوّن جروفاً أو حافات'], ['thin', 'Thin regular beds', 'طبقات رقيقة منتظمة'], ['nod', 'Chert nodules', 'عقد صوان'], ['shells', 'Shells', 'أصداف'], ['numm', 'Nummulites (coin-shaped fossils)', 'نمّوليت (أحافير بشكل العملة)'], ['rud', 'Rudists (horn-shaped shells)', 'روديست (أصداف قرنية)'], ['coral', 'Corals', 'مرجان'], ['alg', 'Algae or reef debris', 'طحالب أو فتات شعابي'], ['bitum', 'Oil smell or bitumen', 'رائحة نفط أو قير'], ['rad', 'Thin coloured chert ribbons', 'أشرطة صوان ملونة رقيقة'], ['pillow', 'Pillow shapes or gas holes', 'أشكال وسائدية أو فجوات غازية']];
  var ACID = [['strong', 'Fizzes strongly', 'يفور بقوة'], ['weak', 'Fizzes weakly or only when powdered', 'يفور بضعف أو عند السحق'], ['none', 'No reaction', 'لا يتفاعل']];
  var SIM = { red: ['redbrown'], redbrown: ['red', 'brown'], brown: ['redbrown', 'buff'], buff: ['white', 'brown'], white: ['buff', 'lgrey'], lgrey: ['white', 'bluegrey'], dgrey: ['bluegrey'], green: ['bluegrey'], bluegrey: ['green', 'lgrey', 'dgrey'], purple: ['redbrown'], mixed: ['brown'] };
  var DESC = SH.store.get('shandal_fs_desc', { c: [], l: [], f: [], acid: '' }); if (!DESC.c) DESC = { c: [], l: [], f: [], acid: '' };
  function prior(f, Z, u, named) {
    var zs = !Z ? 1 : f.zones.indexOf(Z.z) >= 0 ? 1 : Z.near.some(function (z) { return f.zones.indexOf(z) >= 0; }) ? 0.35 : 0.03, ag = 1;
    if (u && isFinite(u.b) && isFinite(u.tt) && f.ma) { var o = Math.min(u.b, f.ma[0]) - Math.max(u.tt, f.ma[1]); ag = o > 0 ? 1 : -o < 8 ? 0.35 : 0.05; }
    return zs * ag * (named.indexOf(f) >= 0 ? 4 : 1);
  }
  function like(f) {
    var T = f.tags, s = 0, carb = T.l.some(function (x) { return /lst|dol|marl/.test(x); });
    DESC.c.forEach(function (c) { s += T.c.indexOf(c) >= 0 ? 1.2 : (SIM[c] || []).some(function (x) { return T.c.indexOf(x) >= 0; }) ? 0.3 : -0.9; });
    DESC.l.forEach(function (l) { s += T.l.indexOf(l) >= 0 ? 1.4 : -1; });
    DESC.f.forEach(function (x) { s += T.f.indexOf(x) >= 0 ? 1.3 : -0.5; });
    if (DESC.acid === 'strong') s += T.l.indexOf('lst') >= 0 ? 1 : carb ? 0.3 : -1.2; else if (DESC.acid === 'weak') s += T.l.indexOf('dol') >= 0 || T.l.indexOf('marl') >= 0 ? 1 : carb ? 0.2 : -0.6; else if (DESC.acid === 'none') s += carb && !T.l.some(function (x) { return /sst|clay|cgl|gyp|chert|volc|ultra|silt/.test(x); }) ? -1.2 : 0.5;
    return Math.exp(s);
  }
  function ranked() {
    var have = FMS.filter(function (f) { return f.ma && f.tags; }); if (!have.length) return [];
    var Z = D.p ? zoneAt(D.p) : null, u = D.u, named = u ? fmMatch(u) : [], R0 = have.map(function (f) { return { f: f, w: (D.p ? prior(f, Z, u, named) : 1) * like(f) }; }), tot = R0.reduce(function (a, b) { return a + b.w; }, 0);
    R0.forEach(function (r) { r.p = r.w / tot; }); return R0.sort(function (a, b) { return b.w - a.w; });
  }
  function sw(c) { return '<i style="display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,.25);vertical-align:-3px;background:' + c + '"></i>'; }
  function fCard(f, pct, why) {
    var cs = f.tags.c.map(function (c) { var q = COLS.filter(function (x) { return x[0] === c; })[0]; return q ? sw(q[3]) : ''; }).join(' ');
    return '<div class="fs-fm"><div class="fs-fm-h"><i style="background:' + f.colour + '"></i><b>' + (AR ? f.ar : f.en) + '</b>' + (pct != null ? '<span class="fs-pct">' + Math.round(pct * 100) + ' %</span>' : '') + '</div>' +
      '<p><b>' + t('Age: ', 'العمر: ') + '</b>' + (AR ? f.age[1] : f.age[0]) + (f.ma ? ' (' + F(f.ma[0], f.ma[0] % 1 ? 1 : 0) + '–' + F(f.ma[1], f.ma[1] % 1 ? 1 : 0) + t(' million years', ' مليون سنة') + ')' : '') + '</p>' +
      '<p><b>' + t('Rocks: ', 'الصخور: ') + '</b>' + (AR ? f.lith[1] : f.lith[0]) + '</p><p><b>' + t('Colour in the field: ', 'اللون في الحقل: ') + '</b>' + cs + ' ' + (AR ? f.col[1] : f.col[0]) + '</p>' +
      '<p><b>' + t('Fossils: ', 'الأحافير: ') + '</b>' + (AR ? f.fos[1] : f.fos[0]) + '</p><p><b>' + t('How to recognise it: ', 'كيف تعرفه: ') + '</b>' + (AR ? f.feat[1] : f.feat[0]) + '</p>' + (why ? '<p class="xsmall muted">' + why + '</p>' : '') + '</div>';
  }
  function rocksHere(u) {
    var Z = zoneAt(D.p), R0 = ranked(); if (!R0.length) return '';
    var keep = DESC.c.length + DESC.l.length + DESC.f.length + (DESC.acid ? 1 : 0), saved = DESC; if (keep) DESC = { c: [], l: [], f: [], acid: '' }; var P0 = ranked(); DESC = saved;
    var top = P0.filter(function (r, i) { return i < 5 && r.p >= 0.04; });
    return '<div class="fs-zone">' + (Z ? t('Structural zone here: ', 'النطاق التركيبي هنا: ') + '<b>' + (AR ? ZN[Z.z][1] : ZN[Z.z][0]) + '</b>' + (Z.near.length ? t(', close to the ', '، وقريب من ') + Z.near.map(function (z) { return AR ? ZN[z][1] : ZN[z][0]; }).join(t(' and the ', ' و')) : '') + '. ' : '') + t('The formations you are most likely to see around here, with their colours:', 'التكوينات التي يُرجَّح أن تراها هنا، بألوانها:') + '</div>' +
      '<div class="fs-fms">' + top.map(function (r) { return fCard(r.f, r.p); }).join('') + '</div><p class="xsmall muted" style="margin:6px 0 0">' + t('The global geological map often names only the age here; the Iraqi formations are ranked by the structural zone, the mapped age and name. Describe the outcrop below to confirm which one is in front of you.', 'كثيراً ما تذكر الخريطة الجيولوجية العالمية العمر فقط هنا؛ فتُرتَّب التكوينات العراقية بحسب النطاق التركيبي والعمر والاسم المرسومين. صِف المكشف في الأسفل لتتأكد أيها أمامك.') + '</p>';
  }
  /* ---------------------------------------------------------------- describe the outcrop */
  function chipRow(list, key, multi) { return list.map(function (q) { var on = multi ? DESC[key].indexOf(q[0]) >= 0 : DESC[key] === q[0]; return '<button type="button" data-g="' + key + '" data-v="' + q[0] + '" aria-pressed="' + on + '">' + (q[3] ? sw(q[3]) + ' ' : '') + (AR ? q[2] : q[1]) + '</button>'; }).join(''); }
  function describe() {
    var box = $('#fsDesc'); if (!box) return;
    $('#fsDc').innerHTML = chipRow(COLS, 'c', 1); $('#fsDl').innerHTML = chipRow(LITHS, 'l', 1); $('#fsDf').innerHTML = chipRow(FEATS, 'f', 1); $('#fsDa').innerHTML = chipRow(ACID, 'acid', 0);
    var n = DESC.c.length + DESC.l.length + DESC.f.length + (DESC.acid ? 1 : 0), R0 = ranked();
    if (!n) { $('#fsDr').innerHTML = '<p class="muted xsmall">' + t('Choose what you see: colours (fresh and weathered), the rock, the features and fossils, and the reaction with dilute acid.', 'اختر ما تراه: الألوان (الطازجة والمجواة)، ونوع الصخر، والظواهر والأحافير، والتفاعل مع الحامض المخفف.') + '</p>'; return; }
    var top = R0.slice(0, 4);
    $('#fsDr').innerHTML = '<p style="margin:0 0 8px"><b>' + t('Most likely: ', 'الأرجح: ') + (AR ? top[0].f.ar : top[0].f.en) + '</b> — ' + Math.round(top[0].p * 100) + ' %' + (D.p ? t(' (place and description together)', ' (المكان والوصف معاً)') : t(' (description only — fix your position to add the place)', ' (الوصف فقط — حدّد موقعك لإضافة المكان)')) + '</p><div class="fs-fms">' + top.map(function (r) {
      var T = r.f.tags, m = [], x = []; DESC.c.concat(DESC.l, DESC.f).forEach(function (k) { var nm = (COLS.concat(LITHS, FEATS).filter(function (q) { return q[0] === k; })[0] || [k, k, k]); (T.c.indexOf(k) >= 0 || T.l.indexOf(k) >= 0 || T.f.indexOf(k) >= 0 ? m : x).push(AR ? nm[2] : nm[1]); });
      return fCard(r.f, r.p, (m.length ? t('Matches: ', 'يطابق: ') + m.join('، ') + '. ' : '') + (x.length ? t('Does not fit: ', 'لا يناسب: ') + x.join('، ') + '.' : ''));
    }).join('') + '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#fsDesc [data-g]'); if (!b) return; var g = b.getAttribute('data-g'), v = b.getAttribute('data-v');
    if (g === 'acid') DESC.acid = DESC.acid === v ? '' : v; else { var i = DESC[g].indexOf(v); if (i >= 0) DESC[g].splice(i, 1); else DESC[g].push(v); }
    SH.store.set('shandal_fs_desc', DESC); describe(); if (D.ready) cardFig();
  });
  var dClr = $('#fsDclr'); if (dClr) dClr.addEventListener('click', function () { DESC = { c: [], l: [], f: [], acid: '' }; SH.store.set('shandal_fs_desc', DESC); describe(); if (D.ready) cardFig(); });
  /* ---------------------------------------------------------------- true thickness of a bed */
  var THK = SH.store.get('shandal_fs_thk', []), TA = null, TB = null, TM = 'gps';
  function thkMode(m) { TM = m; Array.prototype.forEach.call($('#ftModes').children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-t') === m); }); $('#ftGps').hidden = m !== 'gps'; $('#ftTape').hidden = m !== 'tape'; thk(); }
  function ftFix(which) {
    var b = $(which === 'A' ? '#ftA' : '#ftB'); b.disabled = true;
    SH.gpsFix({ ms: 15000, target: 5 }).then(function (f) { var q = { p: [f.lat, f.lon], z: f.alt != null ? f.alt : null, acc: f.acc };
      return (navigator.onLine !== false ? SH.dem.points([q.p], { source: 'aws' }).then(function (z) { if (z[0] != null) { q.zd = z[0]; } }).catch(function () {}) : Promise.resolve()).then(function () { if (which === 'A') TA = q; else TB = q; thk(); }); })
      .catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; });
  }
  function thk() {
    if (!$('#ftOut')) return; var dip = parseFloat($('#ftDip').value), dd = parseFloat($('#ftDd').value), dx, dz, how, warn = '';
    $('#ftAinfo').textContent = TA ? TA.p[0].toFixed(5) + ', ' + TA.p[1].toFixed(5) + (TA.z != null ? ' · GPS ' + F(TA.z, 0) + t(' m', ' م') : '') + (TA.zd != null ? t(' · model ', ' · النموذج ') + F(TA.zd, 0) + t(' m', ' م') : '') : '—';
    $('#ftBinfo').textContent = TB ? TB.p[0].toFixed(5) + ', ' + TB.p[1].toFixed(5) + (TB.z != null ? ' · GPS ' + F(TB.z, 0) + t(' m', ' م') : '') + (TB.zd != null ? t(' · model ', ' · النموذج ') + F(TB.zd, 0) + t(' m', ' م') : '') : '—';
    if (!isFinite(dip) || !isFinite(dd)) { $('#ftOut').innerHTML = '<p class="xsmall muted">' + t('Enter the dip and dip direction of the bed (or take them from the last reading “on the bed”).', 'أدخل ميل الطبقة واتجاه ميلها (أو خذهما من آخر قراءة «على الطبقة»).') + '</p>'; return null; }
    if (TM === 'gps') { if (!TA || !TB) { $('#ftOut').innerHTML = '<p class="xsmall muted">' + t('Stand on the lower contact and press “Base”, then walk to the upper contact and press “Top”.', 'قف على التماس الأسفل واضغط «القاعدة»، ثم امشِ إلى التماس الأعلى واضغط «القمة».') + '</p>'; return null; }
      var d = dist(TA.p, TB.p), az = brg(TA.p, TB.p), za = TA.zd != null && TB.zd != null ? [TA.zd, TB.zd] : [TA.z, TB.z]; if (za[0] == null || za[1] == null) { $('#ftOut').innerHTML = '<p class="xsmall muted">' + t('No elevation for one of the points.', 'لا يوجد ارتفاع لإحدى النقطتين.') + '</p>'; return null; }
      dx = d * Math.cos((az - dd) * RAD); dz = za[1] - za[0]; how = 'GPS points ' + F(d, 0) + ' m apart'; if (d < 3 * Math.max(TA.acc || 5, TB.acc || 5)) warn = t('The two points are close compared with the GPS error: use the tape method for thin beds.', 'النقطتان متقاربتان مقارنة بخطأ GPS: استعمل طريقة الشريط للطبقات الرقيقة.');
    } else { var Lt = parseFloat($('#ftL').value), sg = parseFloat($('#ftS').value) || 0, al = parseFloat($('#ftAz').value); if (!isFinite(Lt) || !isFinite(al)) { $('#ftOut').innerHTML = '<p class="xsmall muted">' + t('Enter the measured length, the slope angle and the direction of the measuring line.', 'أدخل الطول المقيس وزاوية المنحدر واتجاه خط القياس.') + '</p>'; return null; }
      dx = Lt * Math.cos(sg * RAD) * Math.cos((al - dd) * RAD); dz = Lt * Math.sin(sg * RAD); how = 'tape ' + F(Lt, 1) + ' m at ' + F(sg, 0) + '° slope'; }
    var T0 = Math.abs(dx * Math.sin(dip * RAD) + dz * Math.cos(dip * RAD)), V0 = dip < 89 ? T0 / Math.cos(dip * RAD) : Infinity;
    $('#ftOut').innerHTML = '<div class="fs-thk"><div><small>' + t('True thickness', 'السُّمك الحقيقي') + '</small><b>' + F(T0, T0 < 10 ? 2 : 1) + t(' m', ' م') + '</b></div><div><small>' + t('Vertical thickness (in a borehole)', 'السُّمك العمودي (في بئر)') + '</small><b>' + (isFinite(V0) ? F(V0, V0 < 10 ? 2 : 1) + t(' m', ' م') : '—') + '</b></div></div><p class="xsmall muted" style="margin:6px 0 0">t = |Δx·sin δ + Δz·cos δ| · Δx = ' + F(dx, 1) + ' m ' + t('along the dip direction', 'باتجاه الميل') + ', Δz = ' + F(dz, 1) + ' m. ' + warn + '</p>';
    return { t: T0, dip: dip, dd: dd, how: how };
  }
  if ($('#ftModes')) {
    $('#ftModes').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) thkMode(b.getAttribute('data-t')); });
    ['ftDip', 'ftDd', 'ftL', 'ftS', 'ftAz'].forEach(function (id) { $('#' + id).addEventListener('input', thk); });
    $('#ftA').addEventListener('click', function () { ftFix('A'); }); $('#ftB').addEventListener('click', function () { ftFix('B'); });
    $('#ftUse').addEventListener('click', function () { var r = RECS.filter(function (q) { return q.mode === 'plane'; }).slice(-1)[0]; if (!r) return SH.toast(t('No reading “on the bed” yet: lay the phone on the bed and lock a reading.', 'لا توجد قراءة «على الطبقة» بعد: ضع الهاتف على الطبقة وثبّت قراءة.'), 'warn'); $('#ftDip').value = r.dip; $('#ftDd').value = Math.round(r.dd); thk(); });
    $('#ftAzUse').addEventListener('click', function () { if (!OR.ok) return SH.toast(t('Start the compass first.', 'شغّل البوصلة أولاً.'), 'warn'); $('#ftAz').value = Math.round(cur().tru); thk(); });
    $('#ftSave').addEventListener('click', function () { var r = thk(); if (!r) return; r.p = D.p || (TA ? TA.p : POS ? [POS.lat, POS.lon] : [0, 0]); r.at = new Date().toISOString(); THK.push(r); SH.store.set('shandal_fs_thk', THK.slice(-50)); SH.toast(t('Saved to the station card.', 'حُفظ في بطاقة المحطة.'), 'ok'); if (D.ready) cardFig(); });
    thkMode('gps');
  }
  /* ---------------------------------------------------------------- places worth visiting near you */
  var GH = null;
  function places() {
    if (!$('#fsPlaces')) return; (GH ? Promise.resolve(GH) : SH.getJSON(SH.base + 'assets/data/geoheritage.json').then(function (j) { GH = j; return j; })).then(function (A) {
      var CN = { nature: ['Nature', 'طبيعة', '#2F7D5B'], archaeo: ['Archaeology', 'آثار', '#B0702A'], religious: ['Religious', 'ديني', '#2E6FA8'], museum: ['Museum', 'متحف', '#8A4FA3'], geosite: ['Geosite', 'موقع جيولوجي', '#3C4A57'] };
      var L0 = A.map(function (x) { return { x: x, d: dist(D.p, [x.lat, x.lon]) }; }).filter(function (q) { return q.d < 150000; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 10);
      var base = location.pathname.replace(/tools\/[^/]+\/app\/?.*$/, 'tools/geoheritage/app/');
      $('#fsPlaces').innerHTML = L0.length ? L0.map(function (q) { var x = q.x, c = CN[x.cat] || CN.nature, b = brg(D.p, [x.lat, x.lon]); return '<a class="fs-pl" href="' + base + '#' + x.id + '"><i style="background:' + c[2] + '"></i><span><b>' + SH.esc(AR ? x.ar.name : x.en.name) + '</b><small>' + (AR ? c[1] : c[0]) + ' · ' + SH.esc((AR ? x.ar.desc : x.en.desc).slice(0, 110)) + '…</small></span><b class="ltr">' + km(q.d) + '<small>' + dir(b) + '</small></b></a>'; }).join('') : '<p class="muted">' + t('No listed place within 150 km.', 'لا يوجد مكان مدرج ضمن 150 كم.') + '</p>';
    }).catch(function () { $('#fsPlaces').innerHTML = '<p class="muted">' + t('The list of places could not be read.', 'تعذرت قراءة قائمة الأماكن.') + '</p>'; });
  }

  /* ---------------------------------------------------------------- render */
  var WMO = function (c) { return c === 0 ? t('clear sky', 'صحو') : c <= 3 ? t('partly cloudy', 'غائم جزئياً') : c <= 48 ? t('fog', 'ضباب') : c <= 57 ? t('drizzle', 'رذاذ') : c <= 67 ? t('rain', 'مطر') : c <= 77 ? t('snow', 'ثلج') : c <= 82 ? t('showers', 'زخات مطر') : c <= 86 ? t('snow showers', 'زخات ثلج') : t('thunderstorm', 'عاصفة رعدية'); };
  function WMOen(c) { return c === 0 ? 'clear sky' : c <= 3 ? 'partly cloudy' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'showers' : c <= 86 ? 'snow showers' : 'thunderstorm'; }
  var FT = { reverse: 'عكسي', thrust: 'زاحف', normal: 'عادي', dextral: 'مضربي يميني', sinistral: 'مضربي يساري', 'strike-slip': 'مضربي', strike_slip: 'مضربي' };
  function ftype(x) { if (!x) return ''; if (!AR) return x; return String(x).split(/[-_ ]+(?=[A-Z])|\s*[,;/]\s*|\s+/).map(function (w) { return FT[w.toLowerCase()] || w; }).join(' '); }
  function hhmm(s) { return String(s).slice(11, 16); }
  function render() {
    var k = [], al = [], wx = D.wx, u = D.u, n = D.nb || {};
    k.push(G.kpi('info', t('Elevation', 'الارتفاع'), D.z != null ? F(D.z, 0) + '<small> m</small>' : '—', t('above sea level (elevation model)', 'فوق سطح البحر (نموذج الارتفاع)') + (POS.alt != null ? ' · GPS ' + F(POS.alt, 0) : '')));
    if (wx && wx.current) { var c = wx.current; k.push(G.kpi(c.temperature_2m >= 40 ? 'bad' : 'info', t('Weather now', 'الطقس الآن'), F(c.temperature_2m, 0) + '<small> °C</small>', WMO(c.weather_code) + t(' · feels ', ' · المحسوسة ') + F(c.apparent_temperature, 0) + '° · ' + t('wind ', 'الرياح ') + F(c.wind_speed_10m, 0) + ' km/h')); }
    k.push(G.kpi(u ? 'ok' : 'info', t('Unit underfoot', 'الوحدة تحت قدميك'), u ? SH.esc(u.name || u.int) : '—', u ? (u.int || '') + (isFinite(u.b) ? ' · ' + F(u.b, 1) + '–' + F(u.tt, 1) + ' Ma' : '') : t('no map unit or no connection', 'لا وحدة أو لا اتصال')));
    var fa = (D.fa || [])[0]; k.push(G.kpi(fa && fa.d < 5000 ? 'warn' : 'info', t('Nearest active fault', 'أقرب فالق نشط'), fa ? km(fa.d) : '—', fa ? ftype(fa.type) + (fa.ll ? ' · ' + dir(brg(D.p, fa.ll)) : '') : t('none within 150 km in the database', 'لا يوجد ضمن 150 كم في قاعدة البيانات')));
    $('#fsKpis').innerHTML = k.join('');
    if (wx && wx.hourly) {
      var H = wx.hourly, now = Date.now(), idx = [], i; for (i = 0; i < H.time.length; i++) { var tm = new Date(H.time[i] + ':00').getTime(); if (tm >= now - 3600e3 && idx.length < 24) idx.push(i); }
      var rain = idx.filter(function (i) { return H.precipitation_probability[i] >= 50 || H.precipitation[i] >= 0.5; })[0], storm = idx.filter(function (i) { return H.weather_code[i] >= 95; })[0], gust = idx.filter(function (i) { return H.wind_gusts_10m[i] >= 50; })[0], tmax = Math.max.apply(null, idx.map(function (i) { return H.temperature_2m[i]; })), tmin = Math.min.apply(null, idx.map(function (i) { return H.temperature_2m[i]; }));
      if (storm != null) al.push(G.verdict('bad', t('Thunderstorm expected at ', 'عاصفة رعدية متوقعة الساعة ') + hhmm(H.time[storm]), t('Leave valleys and wadi beds before then: flash floods can arrive from rain you cannot see upstream. Stay off ridges and away from isolated trees during lightning.', 'غادر الوديان ومجاري السيول قبل ذلك: فقد تصل السيول من مطر لا تراه في أعلى الوادي. وابتعد عن القمم والأشجار المنفردة أثناء البرق.')));
      else if (rain != null) al.push(G.verdict('warn', t('Rain likely from ', 'مطر محتمل من الساعة ') + hhmm(H.time[rain]), t('Probability ', 'الاحتمال ') + F(H.precipitation_probability[rain], 0) + ' %' + (H.precipitation[rain] ? ', ' + F(H.precipitation[rain], 1) + ' mm' : '') + '. ' + t('Wet clay and marl slopes become slippery; plan to be out of narrow valleys and off unpaved tracks.', 'تصبح منحدرات الطين والمارل المبللة زلقة؛ خطط للخروج من الوديان الضيقة والطرق الترابية.')));
      else al.push(G.verdict('ok', t('No rain expected in the next 24 hours', 'لا مطر متوقع في الساعات الـ24 القادمة'), t('Maximum ', 'العظمى ') + F(tmax, 0) + t('°C, minimum ', '°م، والصغرى ') + F(tmin, 0) + '°C.'));
      if (tmax >= 40) al.push(G.verdict('bad', t('Heat: ', 'حر: ') + F(tmax, 0) + '°C', t('Work early and late, rest in shade at midday, drink at least a litre an hour, wear a hat and long sleeves.', 'اعمل باكراً ومتأخراً، واسترح في الظل وقت الظهيرة، واشرب لتراً على الأقل كل ساعة، والبس قبعة وأكماماً طويلة.')));
      if (tmin <= 1) al.push(G.verdict('warn', t('Frost and ice possible', 'صقيع وجليد محتمل'), t('Rock faces and tracks can be icy in the morning; rockfall increases on thawing.', 'قد تكون الواجهات الصخرية والطرق متجمدة صباحاً، ويزداد سقوط الصخور عند الذوبان.')));
      if (gust != null) al.push(G.verdict('warn', t('Strong gusts from ', 'هبات قوية من الساعة ') + hhmm(H.time[gust]), F(H.wind_gusts_10m[gust], 0) + ' km/h. ' + t('Rockfall and dust; keep away from cliff edges.', 'سقوط صخور وغبار؛ ابتعد عن حواف الجروف.')));
      if (wx.daily) { var ss = wx.daily.sunset[0], left = (new Date(ss).getTime() - now) / 3600e3; if (left > 0 && left < 3) al.push(G.verdict('warn', t('Sunset at ', 'الغروب الساعة ') + hhmm(ss), t('About ', 'بقي نحو ') + F(left, 1) + t(' h of daylight left: start back in time.', ' ساعة من ضوء النهار: ابدأ العودة في الوقت المناسب.'))); }
      var pts = idx.map(function (i, j) { return j; }), tp = idx.map(function (i, j) { return [j, H.temperature_2m[i]]; }), pp = idx.map(function (i, j) { return [j, H.precipitation_probability[i]]; }), t0 = Math.floor(tmin) - 2, t1 = Math.ceil(tmax) + 2;
      G.chart($('#fsWx'), { W: 760, H: 300, m: { l: 56, r: 56, t: 16, b: 56 }, x: { lo: 0, hi: Math.max(1, idx.length - 1), n: 8, title: 'Hours from now (first: ' + hhmm(H.time[idx[0]]) + ' local time)' }, y: { lo: t0, hi: t1, title: 'Temperature (°C)' },
        under: function (fx, fy) { var s = ''; pp.forEach(function (q) { var h = (fy(t0) - fy(t1)) * q[1] / 100; s += '<rect x="' + (fx(q[0]) - 9) + '" y="' + (fy(t0) - h) + '" width="18" height="' + h + '" fill="#2E6FBF" fill-opacity=".28"/>'; }); return s; },
        top: function (fx, fy) { var s = ''; [0, 50, 100].forEach(function (v) { var y = fy(t0) - (fy(t0) - fy(t1)) * v / 100; s += G.tx(fx(Math.max(1, idx.length - 1)) + 8, y + 4, v + ' %', { fs: 10, fill: '#2E6FBF' }); }); return s; },
        series: [{ pts: tp, col: '#C0392B', w: 2.4, mark: 'o', r: 3 }], legend: [{ name: 'Temperature', col: '#C0392B', mark: 'o' }, { name: 'Chance of rain (right scale, %)', col: '#2E6FBF', box: 1, op: 0.35 }] });
    }
    $('#fsAlerts').innerHTML = al.join('');
    var items = [['road', n.road, t('Nearest road', 'أقرب طريق'), '#1B232B'], ['track', n.track, t('Nearest track', 'أقرب مسلك ترابي'), '#8A6D1F'], ['river', n.river, t('Nearest river', 'أقرب نهر'), '#2E6FBF'], ['stream', n.stream, t('Nearest stream or canal', 'أقرب جدول أو قناة'), '#4FA3E0'], ['spring', n.spring, t('Nearest spring', 'أقرب نبع'), '#2E8B57'], ['place', n.place, t('Nearest village or town', 'أقرب قرية أو بلدة'), '#7A4F9A'], ['peak', n.peak, t('Nearest named peak', 'أقرب قمة معروفة'), '#B08A3E'], ['cave', n.cave, t('Nearest cave', 'أقرب كهف'), '#55616B']];
    $('#fsNear').innerHTML = D.nb ? items.filter(function (q) { return q[1]; }).map(function (q) { var e = q[1], b = brg(D.p, e.ll); return '<div><svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" fill="' + q[3] + '"/><path d="M13 4l5 13-5-3-5 3z" fill="#fff" transform="rotate(' + b.toFixed(0) + ' 13 13)"/></svg><span><b>' + q[2] + '</b>' + (e.name ? ' — ' + SH.esc(e.name) : '') + '<br><small>' + dir(b) + ' (' + F(b, 0) + '°)' + (e.ele ? ' · ' + F(e.ele, 0) + t(' m high', ' م ارتفاعاً') : '') + '</small></span><b class="ltr">' + km(e.d) + '</b></div>'; }).join('') || '<p class="muted">' + t('No mapped features nearby.', 'لا معالم مخرّطة قريبة.') + '</p>' : '<p class="muted">' + t('The map database did not answer (busy or no connection). ', 'لم تُجب قاعدة بيانات الخريطة (مشغولة أو لا اتصال). ') + '<button class="btn btn-line btn-xs" type="button" id="fsNearRe">' + t('Try again', 'أعد المحاولة') + '</button> · ' + t('Offline, use the Offline Field Survival Map.', 'ودون إنترنت استعمل خريطة النجاة الميدانية.') + '</p>';
    var fm = fmMatch(u), li = lithInfo(u ? u.lith + ' ' + u.name + ' ' + u.desc : ''), s = '';
    if (u) { s += '<p style="margin:0 0 8px;line-height:1.8"><b>' + SH.esc(u.name) + '</b>' + (u.int ? ' — ' + SH.esc(u.int) : '') + (isFinite(u.b) ? ' (' + F(u.b, 1) + '–' + F(u.tt, 1) + t(' million years', ' مليون سنة') + ')' : '') + '. ' + (u.lith ? t('Lithology: ', 'الصخارية: ') + SH.esc(u.lith) + '. ' : '') + (u.desc ? SH.esc(u.desc.slice(0, 260)) : '') + '</p>'; }
    fm.forEach(function (f) { s += '<div style="display:grid;grid-template-columns:14px minmax(0,1fr);gap:8px;margin:6px 0"><i style="width:14px;height:14px;border-radius:3px;margin-top:5px;background:' + f.colour + '"></i><span><b>' + (AR ? f.ar : f.en) + '</b> — ' + (AR ? f.age[1] : f.age[0]) + '. ' + t('Rocks: ', 'الصخور: ') + (AR ? f.lith[1] : f.lith[0]) + '. ' + t('Colour in the field: ', 'اللون في الحقل: ') + (AR ? f.col[1] : f.col[0]) + '. ' + t('Fossils: ', 'المتحجرات: ') + (AR ? f.fos[1] : f.fos[0]) + '.</span></div>'; });
    var aroundU = {}; (D.ar || []).forEach(function (q, j) { if (q && q.name && (!u || q.name !== u.name)) (aroundU[q.name] = aroundU[q.name] || []).push(j * 45); });
    if (Object.keys(aroundU).length) s += '<p style="margin:8px 0 0">' + t('Within about 2.5 km: ', 'ضمن نحو 2.5 كم: ') + Object.keys(aroundU).map(function (nm) { return '<b>' + SH.esc(nm) + '</b> (' + aroundU[nm].map(function (a) { return dir(a); }).join('، ') + ')'; }).join('؛ ') + '.</p>';
    s += rocksHere(u);
    $('#fsGeo').innerHTML = s || '<p class="muted">' + t('The geological map could not be read here (no connection or no coverage). Save the area beforehand with the geology camera.', 'تعذرت قراءة الخريطة الجيولوجية هنا (لا اتصال أو لا تغطية). احفظ المنطقة مسبقاً بالكاميرا الجيولوجية.') + '</p>';
    var look = []; fm.forEach(function (f) { look.push('<b>' + (AR ? f.ar : f.en) + ':</b> ' + (AR ? f.feat[1] : f.feat[0])); }); li.forEach(function (q) { look.push('<b>' + T2(q[1]) + ':</b> ' + T2(q[3]) + '. ' + t('Colours: ', 'الألوان: ') + T2(q[4]) + '. ' + t('Test: ', 'الاختبار: ') + T2(q[2]) + '.'); });
    look.push(t('Everywhere: measure bedding on both sides of any fold, joint sets (at least 20 readings each), fault planes with slickenlines and their sense of movement, and photograph every station with a scale (hammer or lens cap).', 'في كل مكان: قِس التطبق على جانبي أي طية، ومجموعات الفواصل (20 قراءة على الأقل لكل مجموعة)، ومستويات الفوالق مع تخططاتها واتجاه حركتها، وصوّر كل محطة مع مقياس (المطرقة أو غطاء العدسة).'));
    $('#fsLook').innerHTML = look.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    var w = [], hv = D.hv;
    if (hv) w.push(t('Nearest drainage: ', 'أقرب مجرى: ') + (hv.name ? SH.esc(hv.name) + t(', ', '، ') : '') + km(hv.d) + ' ' + dir(brg(D.p, hv.ll)) + (D.hab != null ? (D.hab < 1.5 ? t(', at about the same level as you.', '، وهو تقريباً بمستوى موقعك.') : t(', and you stand about ', '، وأنت أعلى منه بنحو ') + F(D.hab, 0) + t(' m above it.', ' م.')) : '.'));
    if (D.hab != null) w.push(D.hab < 5 ? t('You are almost at stream level: in valley alluvium the water table here is usually shallow, a few metres or less — and so is the flood risk.', 'أنت تقريباً بمستوى المجرى: في رسوبيات الوادي يكون منسوب الماء هنا ضحلاً عادة، بضعة أمتار أو أقل، وكذلك خطر الفيضان.') : D.hab < 40 ? t('The water table usually follows the ground in a subdued way: here it is likely to be shallower than ', 'يتبع منسوب الماء سطح الأرض عادة بصورة مخففة: فمن المرجح هنا أن يكون أقل عمقاً من ') + F(D.hab, 0) + t(' m but deeper than in the valley floor.', ' م وأعمق منه في قاع الوادي.') : t('You are high above the drainage: groundwater, if present in the rocks, is likely to be deep (tens of metres or more) and to need a geophysical survey to locate.', 'أنت أعلى كثيراً من المجاري: فالمياه الجوفية، إن وجدت في الصخور، مرجح أن تكون عميقة (عشرات الأمتار أو أكثر) وتحتاج مسحاً جيوفيزيائياً لتحديدها.'));
    if (u) { var L0 = (u.lith || u.name).toLowerCase(), rk = [[/alluvi|gravel|sand|conglomerate|quaternary/, 'a'], [/limestone|dolom|carbonate/, 'c'], [/clay|marl|shale|mud/, 'm'], [/gypsum|evaporite|anhydrite/, 'g']].map(function (q) { var m = q[0].exec(L0); return [m ? m.index : 1e9, q[1]]; }).sort(function (a, b) { return a[0] - b[0]; })[0]; L0 = rk[0] < 1e9 ? { a: 'sand', c: 'limestone', m: 'clay', g: 'gypsum' }[rk[1]] : ''; w.push(/alluvi|gravel|sand|conglomerate|quaternary/.test(L0) ? t('These rocks store and pass water well (porous aquifer).', 'هذه الصخور تخزن الماء وتمرره جيداً (خزان مسامي).') : /limestone|dolom|carbonate/.test(L0) ? t('Carbonate rocks hold water in fractures and karst: yields vary greatly from place to place; springs at the foot of limestone ridges are common.', 'الصخور الكربونية تحفظ الماء في الكسور والكارست: فيتفاوت العطاء كثيراً من مكان لآخر، وتشيع الينابيع عند أقدام حافات الحجر الجيري.') : /clay|marl|shale/.test(L0) ? t('Clay, marl and shale hold water but do not release it: they act as barriers (aquitards).', 'الطين والمارل والطفل تحفظ الماء ولا تطلقه: فهي حواجز (طبقات شبه كتيمة).') : /gypsum|evaporite|anhydrite/.test(L0) ? t('Water in gypsiferous rocks is usually hard and high in sulphate.', 'الماء في الصخور الجبسية يكون عادة عسراً وغنياً بالكبريتات.') : ''); }
    w.push(t('No public database gives the water-table depth at a point in Iraq: the vertical electrical sounding lab or a nearby well gives the true depth.', 'لا توجد قاعدة بيانات عامة تعطي عمق منسوب الماء عند نقطة في العراق: مختبر السبر الكهربائي أو بئر قريبة يعطيان العمق الحقيقي.'));
    (D.fa || []).slice(0, 3).forEach(function (f) { w.push(t('Active fault: ', 'فالق نشط: ') + (f.name ? SH.esc(f.name) + ' · ' : '') + ftype(f.type) + ' · ' + km(f.d) + (f.ll ? ' ' + dir(brg(D.p, f.ll)) : '') + (f.dip ? t(' · dip ', ' · الميل ') + F(f.dip, 0) + '°' : '') + (f.rate ? t(' · ', ' · ') + F(f.rate, 1) + ' mm/yr' : '')); });
    $('#fsWater').innerHTML = w.filter(Boolean).map(function (x) { return '<li>' + x + '</li>'; }).join('');
    mapDraw(); cardFig(); describe(); places(); var re = $('#fsNearRe'); if (re) re.onclick = function () { re.disabled = true; nearby(D.p).then(function (nb) { D.nb = nb; render(); }).catch(function () { re.disabled = false; SH.toast(t('Still no answer; try again in a minute.', 'لا يوجد رد بعد؛ أعد المحاولة بعد دقيقة.'), 'warn'); }); };
  }
  function T2(q) { return AR ? q[1] : q[0]; }
  function mapDraw() {
    if (!map) return; lay.clearLayers(); var n = D.nb || {}; L.circleMarker(D.p, { radius: 8, color: '#fff', weight: 3, fillColor: '#2E8B57', fillOpacity: 1 }).addTo(lay).bindTooltip(t('You', 'أنت'));
    [['road', '#1B232B'], ['river', '#2E6FBF'], ['stream', '#4FA3E0'], ['spring', '#2E8B57'], ['place', '#7A4F9A'], ['peak', '#B08A3E'], ['cave', '#55616B']].forEach(function (q) { var e = n[q[0]]; if (!e) return; L.polyline([D.p, e.ll], { color: q[1], weight: 1.5, dashArray: '4 4' }).addTo(lay); L.circleMarker(e.ll, { radius: 6, color: '#fff', weight: 2, fillColor: q[1], fillOpacity: 1 }).addTo(lay).bindTooltip((e.name || q[0]) + ' · ' + km(e.d)); });
    (D.fa || []).forEach(function (f) { if (f.g) L.polyline(f.g.map(function (g) { return [g.lat, g.lon]; }), { color: '#C0392B', weight: 3 }).addTo(lay).bindTooltip(t('Active fault', 'فالق نشط') + (f.type ? ' · ' + ftype(f.type) : '')); });
    geoLayer(); setTimeout(function () { map.invalidateSize(); var pts = [D.p]; Object.keys(n).forEach(function (k2) { if (n[k2] && n[k2].ll && n[k2].d < 20000) pts.push(n[k2].ll); }); map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 14 }); }, 60);
  }
  function geoLayer() { if (!map) return; if (gov) { map.removeLayer(gov); gov = null; } if ($('#fsGeoOv').checked) gov = L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: 0.5, maxZoom: 16 }).addTo(map); }
  $('#fsGeoOv').addEventListener('change', geoLayer);

  /* ---------------------------------------------------------------- station card */
  function cardFig() {
    if (!D.ready) return; var svg = $('#fsCard'), W = 760, s = '', u = D.u, n = D.nb || {}, utm = SH.toUTM(D.p[0], D.p[1]), wx = D.wx, ink = G.INK, y = 30;
    s += '<rect x="10" y="10" width="740" height="10" fill="#B08A3E"/>' + G.tx(24, y + 26, 'Field station card', { fs: 20, fw: 800 }) + G.tx(736, y + 26, POS.t.toISOString().slice(0, 16).replace('T', ' ') + ' UTC', { fs: 12, anchor: 'end', fill: G.MUT });
    y += 50; var L1 = [['Position', D.p[0].toFixed(6) + ', ' + D.p[1].toFixed(6) + (POS.acc ? '  ±' + F(POS.acc, 0) + ' m' : '')], ['DMS', dms(D.p[0], 'N', 'S') + '   ' + dms(D.p[1], 'E', 'W')], ['UTM', 'Zone ' + utm.zone + utm.band + '   E ' + F(utm.E, 0) + '   N ' + F(utm.N, 0)], ['Elevation', (D.z != null ? F(D.z, 0) + ' m a.s.l. (model)' : '—') + (POS.alt != null ? '   GPS ' + F(POS.alt, 0) + ' m' : '')], ['Declination', DECL != null ? (DECL >= 0 ? '+' : '') + F(DECL, 1) + '° (IGRF)' : '—']];
    if (wx && wx.current) L1.push(['Weather', F(wx.current.temperature_2m, 0) + ' °C, ' + WMOen(wx.current.weather_code) + ', wind ' + F(wx.current.wind_speed_10m, 0) + ' km/h, humidity ' + F(wx.current.relative_humidity_2m, 0) + ' %']);
    L1.forEach(function (q, i) { s += G.tx(24, y + i * 22, q[0], { fs: 12, fw: 700, fill: G.MUT }) + G.tx(130, y + i * 22, q[1], { fs: 12.5 }); }); y += L1.length * 22 + 12;
    s += '<line x1="24" x2="736" y1="' + y + '" y2="' + y + '" stroke="#E3E7EA"/>'; y += 24;
    s += G.tx(24, y, 'Geology', { fs: 14, fw: 800 }); y += 20;
    var gl = u ? [(u.name || '') + (u.int ? ' — ' + u.int : '') + (isFinite(u.b) ? ' (' + F(u.b, 1) + '–' + F(u.tt, 1) + ' Ma)' : ''), u.lith ? 'Lithology: ' + u.lith : ''].filter(Boolean) : ['No map unit read'];
    fmMatch(u).forEach(function (f) { gl.push(f.en + ': ' + f.col[0] + '; fossils: ' + f.fos[0]); });
    var top = ranked()[0]; if (top) gl.push('Most likely formation here: ' + top.f.en + ' (' + top.f.age[0] + ', ' + Math.round(top.p * 100) + ' %' + (DESC.c.length + DESC.l.length + DESC.f.length ? ', from the place and the description' : ', from the place') + ')');
    THK.filter(function (q) { return dist(D.p, q.p) < 2000; }).slice(-3).forEach(function (q) { gl.push('Bed thickness: true ' + F(q.t, 2) + ' m (dip ' + q.dip + '° to ' + q.dd + '°, ' + q.how + ')'); });
    gl.forEach(function (ln) { G.wrap(ln, 64).forEach(function (w2) { s += G.tx(24, y, w2, { fs: 12 }); y += 17; }); }); y += 8;
    s += G.tx(24, y, 'Nearest features', { fs: 14, fw: 800 }); y += 20;
    [['Road', n.road], ['River', n.river], ['Stream / canal', n.stream], ['Spring', n.spring], ['Settlement', n.place], ['Named peak', n.peak]].forEach(function (q) { if (!q[1]) return; var b = brg(D.p, q[1].ll); s += G.tx(24, y, q[0], { fs: 12, fw: 700, fill: G.MUT }) + G.tx(130, y, (q[1].en || 'unnamed').slice(0, 30) + '  ·  ' + (q[1].d < 1000 ? F(q[1].d, 0) + ' m' : F(q[1].d / 1000, 1) + ' km') + '  ·  ' + card(b) + ' ' + F(b, 0) + '°', { fs: 12 }); y += 18; });
    var fa = (D.fa || [])[0]; if (fa) { s += G.tx(24, y, 'Active fault', { fs: 12, fw: 700, fill: G.MUT }) + G.tx(130, y, (fa.type || 'fault') + '  ·  ' + F(fa.d / 1000, 1) + ' km' + (fa.ll ? '  ·  ' + card(brg(D.p, fa.ll)) : ''), { fs: 12 }); y += 18; }
    var cx = 610, cy = 300, R = 100; s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#FBF7EE" stroke="' + ink + '" stroke-width="1.2"/>';
    for (var a = 0; a < 360; a += 10) { var l = a % 90 ? (a % 30 ? 4 : 8) : 12; s += '<line x1="' + (cx + Math.sin(a * RAD) * R).toFixed(1) + '" y1="' + (cy - Math.cos(a * RAD) * R).toFixed(1) + '" x2="' + (cx + Math.sin(a * RAD) * (R - l)).toFixed(1) + '" y2="' + (cy - Math.cos(a * RAD) * (R - l)).toFixed(1) + '" stroke="' + ink + '"/>'; }
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (q) { s += G.tx(cx + Math.sin(q[1] * RAD) * (R + 13), cy - Math.cos(q[1] * RAD) * (R + 13) + 4, q[0], { fs: 12, fw: 800, anchor: 'middle' }); });
    var here = RECS.filter(function (r) { return r.lat != null && dist(D.p, [r.lat, r.lon]) < 300; }).slice(-12);
    here.forEach(function (r) { if (r.mode === 'plane') { var st = r.strike * RAD, x1 = cx + Math.sin(st) * 70, y1 = cy - Math.cos(st) * 70, x2 = cx - Math.sin(st) * 70, y2 = cy + Math.cos(st) * 70, dd = r.dd * RAD; s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#8C6D1F" stroke-width="2"/><line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.sin(dd) * 22).toFixed(1) + '" y2="' + (cy - Math.cos(dd) * 22).toFixed(1) + '" stroke="#8C6D1F" stroke-width="2"/>' + G.tx(cx + Math.sin(dd) * 32, cy - Math.cos(dd) * 32 + 4, String(r.dip), { fs: 10.5, anchor: 'middle', fw: 700, fill: '#8C6D1F', halo: 1 }); } else { var h = r.tru * RAD; s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.sin(h) * (R - 6)).toFixed(1) + '" y2="' + (cy - Math.cos(h) * (R - 6)).toFixed(1) + '" stroke="#2E6FBF" stroke-width="1.6"/>'; } });
    s += G.tx(cx, cy + R + 32, here.length ? 'Readings at this station (true north)' : 'No readings recorded here yet', { fs: 11, anchor: 'middle', fill: G.MUT });
    s += '<line x1="' + (cx - 90) + '" x2="' + (cx - 66) + '" y1="' + (cy + R + 50) + '" y2="' + (cy + R + 50) + '" stroke="#8C6D1F" stroke-width="2"/>' + G.tx(cx - 60, cy + R + 54, 'strike, dip', { fs: 10.5 }) + '<line x1="' + (cx + 10) + '" x2="' + (cx + 34) + '" y1="' + (cy + R + 50) + '" y2="' + (cy + R + 50) + '" stroke="#2E6FBF" stroke-width="1.6"/>' + G.tx(cx + 40, cy + R + 54, 'heading', { fs: 10.5 });
    var H = Math.max(y + 30, cy + R + 80); s += G.tx(24, H - 12, 'Shandal System · Geological Field Survey', { fs: 10.5, fill: '#8A6D1F', fw: 700 });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = '<rect width="' + W + '" height="' + H + '" fill="#fff"/><rect x="4" y="4" width="' + (W - 8) + '" height="' + (H - 8) + '" fill="none" stroke="' + ink + '" stroke-width="1.2"/>' + s;
  }
  recs();
  window.SHFS = { onOri: onOri, OR: OR, setPos: setPos, cur: cur };
})();
