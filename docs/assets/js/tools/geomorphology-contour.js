/* Geomorphological & contour survey — field GPS points and channel course → kriged contour map (UTM), satellite view,
   longitudinal channel profile with gradient and sinuosity, and an interpretation that joins the map with field geomorphology. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, D = SH.dem;
  var persist = SH.persist('geomorph', ['geoName', 'gProj', 'gEnv', 'gDrain', 'gValley', 'gFlood', 'gInt', 'gRamp']);
  var data = SH.store.get('shandal_geomorph_pts', { topo: [], riv: [] }), G = null, CS = null, step = 0, map = null, lay = null, last = null;
  var save = function () { SH.store.set('shandal_geomorph_pts', data); };
  var inp = 'height:34px;border:1px solid var(--line-2);border-radius:8px;padding:0 8px;background:var(--bg);color:var(--text);font:inherit;font-size:.8rem;min-width:0';

  function ui(kind) {
    var host = $(kind === 'topo' ? '#gTopo' : '#gRiv'), arr = data[kind];
    host.innerHTML = arr.length ? arr.map(function (p, i) {
      return '<div style="display:grid;grid-template-columns:22px 1fr 1fr 74px 26px;gap:6px;align-items:center" data-k="' + kind + '" data-i="' + i + '"><b class="xsmall" style="color:var(--text-3)">' + (kind === 'riv' ? 'S' : 'P') + (i + 1) + '</b>' +
        '<input class="ltr" style="' + inp + '" data-f="lat" value="' + (p.lat != null ? p.lat.toFixed(6) : '') + '" placeholder="' + t('Lat', 'عرض') + '"><input class="ltr" style="' + inp + '" data-f="lon" value="' + (p.lon != null ? p.lon.toFixed(6) : '') + '" placeholder="' + t('Lon', 'طول') + '">' +
        '<input class="ltr" style="' + inp + '" data-f="z" value="' + (p.z != null ? (+p.z).toFixed(1) : '') + '" placeholder="Z m"><button class="x" type="button" data-del aria-label="' + t('Delete', 'حذف') + '">✕</button></div>';
    }).join('') : '<p class="xsmall muted" style="margin:0">' + t('No points yet.', 'لا نقاط بعد.') + '</p>';
  }
  ['#gTopo', '#gRiv'].forEach(function (s) {
    $(s).addEventListener('change', function (e) { var r = e.target.closest('[data-i]'), f = e.target.getAttribute('data-f'); if (!r || !f) return; var v = parseFloat(e.target.value); data[r.getAttribute('data-k')][+r.getAttribute('data-i')][f] = isNaN(v) ? null : v; save(); });
    $(s).addEventListener('click', function (e) { if (!e.target.closest('[data-del]')) return; var r = e.target.closest('[data-i]'); data[r.getAttribute('data-k')].splice(+r.getAttribute('data-i'), 1); save(); ui(r.getAttribute('data-k')); });
  });
  SH.$$('[data-add]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-add'); data[k].push({ lat: null, lon: null, z: null }); save(); ui(k); }); });
  SH.$$('[data-gps]').forEach(function (b) { b.addEventListener('click', function () {
    var k = b.getAttribute('data-gps'); b.disabled = true;
    SH.locateBest(8000).then(function (p) { data[k].push({ lat: p.lat, lon: p.lon, z: null, acc: p.acc }); save(); ui(k); SH.toast(t('Point captured, ±', 'التُقطت النقطة، ±') + Math.round(p.acc) + ' m', 'ok'); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; });
  }); });
  var valid = function (arr) { return arr.filter(function (p) { return p.lat != null && p.lon != null && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180; }); };

  function fillDem() {
    var need = [], refs = []; ['topo', 'riv'].forEach(function (k) { valid(data[k]).forEach(function (p) { if (p.z == null) { need.push([p.lat, p.lon]); refs.push(p); } }); });
    if (!need.length) return Promise.resolve(0);
    return D.points(need, { source: 'aws', res: 15 }).then(function (z) { z.forEach(function (v, i) { refs[i].z = Math.round(v * 10) / 10; refs[i].dem = true; }); save(); ui('topo'); ui('riv'); return need.length; });
  }
  $('#gDem').addEventListener('click', function () { var b = this; b.disabled = true; fillDem().then(function (n) { SH.toast(n ? n + t(' heights filled from the DEM.', ' ارتفاعاً مُلئت من نموذج الارتفاع.') : t('All points already have Z.', 'كل النقاط لديها Z.'), n ? 'ok' : 'info'); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });

  var compass = function (deg) { var en = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'], ar = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'], k = Math.round(deg / 45) % 8; return SH.lang === 'ar' ? ar[k] : en[k]; };

  function run() {
    var T = valid(data.topo), R = valid(data.riv);
    if (T.filter(function (p) { return p.z != null; }).length + R.filter(function (p) { return p.z != null; }).length < 5 && T.length + R.length < 5) { SH.toast(t('Record at least five points with coordinates.', 'سجّل خمس نقاط على الأقل بإحداثيات.'), 'warn'); return; }
    var btn = $('#gRun'); btn.disabled = true; persist.save();
    var missing = T.concat(R).some(function (p) { return p.z == null; });
    (missing ? fillDem().then(function (n) { if (n) SH.toast(n + t(' missing heights were taken from the DEM.', ' ارتفاعاً ناقصاً أُخذ من نموذج الارتفاع.'), 'info'); }) : Promise.resolve()).then(function () { compute(valid(data.topo), valid(data.riv)); })
      .catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; });
  }
  function compute(T, R) {
    var all = T.concat(R).filter(function (p) { return p.z != null; }); if (all.length < 5) { SH.toast(t('Not enough points with heights.', 'لا توجد نقاط كافية بارتفاعات.'), 'warn'); return; }
    var zone = SH.utmZone(all[0].lat, all[0].lon), U = function (p) { var u = SH.toUTM(p.lat, p.lon, zone); return { x: u.E, y: u.N, z: p.z, lat: p.lat, lon: p.lon, dem: p.dem }; };
    var Tu = T.filter(function (p) { return p.z != null; }).map(U), Ru = R.filter(function (p) { return p.z != null; }).map(U), Au = Tu.concat(Ru);
    var xs = Au.map(function (p) { return p.x; }), ys = Au.map(function (p) { return p.y; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = Math.max(x1 - x0, y1 - y0) * 0.06 || 20;
    var b = { w: x0 - pad, e: x1 + pad, s: y0 - pad, n: y1 + pad }, wM = b.e - b.w, hM = b.n - b.s, res = 110, nx = wM >= hM ? res : Math.max(20, Math.round(res * wM / hM)), ny = hM > wM ? res : Math.max(20, Math.round(res * hM / wM));
    var Gm = D.interp(Au.map(function (p) { return { x: p.x - b.w, y: p.y - b.s, z: p.z }; }), { n: hM, s: 0, w: 0, e: wM }, nx, ny, { method: Au.length <= 800 ? 'kriging' : 'idw' });
    G = { nx: nx, ny: ny, b: b, z: Gm.z, dx: wM / (nx - 1), dy: hM / (ny - 1), lats: [], lons: [], method: Gm.method, zone: zone }; for (var j = 0; j < ny; j++) G.lats.push(b.n - hM * j / (ny - 1)); for (var i = 0; i < nx; i++) G.lons.push(b.w + wM * i / (nx - 1));
    D.stats(G); D.derive(G); step = SH.num('gInt') || D.niceInterval(G.max - G.min, 12); if ((G.max - G.min) / step > 200) step = D.niceInterval(G.max - G.min, 30); CS = D.contours(G, D.levels(G, step));
    var hi = Au.reduce(function (a, p) { return p.z > a.z ? p : a; }), lo = Au.reduce(function (a, p) { return p.z < a.z ? p : a; }), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, brg = function (p) { return (SH.deg(Math.atan2(p.x - cx, p.y - cy)) + 360) % 360; };
    var grad = (hi.z - lo.z) / (Math.hypot(hi.x - lo.x, hi.y - lo.y) || 1), sl = 0, c = 0; for (var k = 0; k < G.z.length; k++) { sl += G.slope[k]; c++; }
    var riv = null; if (Ru.length >= 2) { var len = 0, d = [0]; for (k = 1; k < Ru.length; k++) { len += Math.hypot(Ru[k].x - Ru[k - 1].x, Ru[k].y - Ru[k - 1].y); d.push(len); } var straight = Math.hypot(Ru[Ru.length - 1].x - Ru[0].x, Ru[Ru.length - 1].y - Ru[0].y), drop = Ru[0].z - Ru[Ru.length - 1].z;
      riv = { pts: Ru, d: d, len: len, straight: straight, sin: straight ? len / straight : 1, drop: drop, grad: drop / (len || 1), dir: (SH.deg(Math.atan2(Ru[Ru.length - 1].x - Ru[0].x, Ru[Ru.length - 1].y - Ru[0].y)) + 360) % 360 }; }
    last = { T: Tu, R: Ru, A: Au, hi: hi, lo: lo, hiDir: compass(brg(hi)), loDir: compass(brg(lo)), grad: grad, meanSlope: sl / c, riv: riv, dirFall: compass((SH.deg(Math.atan2(lo.x - hi.x, lo.y - hi.y)) + 360) % 360), area: (x1 - x0) * (y1 - y0), demN: Au.filter(function (p) { return p.dem; }).length };
    render();
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function render() {
    var r = last; $('#gEmpty').hidden = true; $('#gOut').hidden = false;
    $('#gKpis').innerHTML = kpi('info', t('Survey points', 'نقاط المسح'), r.A.length, r.T.length + t(' topographic · ', ' طبوغرافية · ') + r.R.length + t(' channel', ' مجرى')) + kpi('', t('Relief', 'التضرس'), SH.fmt(r.hi.z - r.lo.z, 1) + '<small> m</small>', SH.fmt(r.lo.z, 1) + '–' + SH.fmt(r.hi.z, 1) + ' m') +
      kpi('', t('Mean slope', 'متوسط الميل'), SH.fmt(r.meanSlope, 1) + '<small>°</small>', t('regional fall to the ', 'الانحدار العام نحو ') + r.dirFall) + kpi('', t('Contour interval', 'الفاصل الكنتوري'), SH.fmt(step, step < 1 ? 1 : 0) + '<small> m</small>', G.method === 'kriging' ? t('ordinary kriging', 'كريجنغ اعتيادي') : 'IDW') +
      (r.riv ? kpi(r.riv.drop <= 0 ? 'bad' : '', t('Channel gradient', 'انحدار المجرى'), SH.fmt(r.riv.grad * 1000, 1) + '<small> ‰</small>', t('sinuosity ', 'التعرج ') + SH.fmt(r.riv.sin, 2)) : '');
    var lines = r.riv ? [{ pts: r.R.map(function (p) { return [p.y, p.x]; }), color: '#1F6FB2', width: 3, arrow: true }] : [];
    D.svgMap($('#gSvg'), G, CS, { crs: 'proj', interval: step, index: 5, ramp: SH.val('gRamp'), smooth: true, title: SH.val('gProj') || t('Geomorphological contour map', 'الخريطة الكنتورية الجيومورفولوجية'), subtitle: 'WGS 84 / UTM ' + G.zone + (r.A[0].lat < 0 ? 'S' : 'N') + (SH.val('geoName') ? ' · ' + SH.val('geoName') : ''), axisNames: ['Easting (m)', 'Northing (m)'],
      points: r.T.map(function (p, i) { return { x: p.x, y: p.y, label: 'P' + (i + 1) }; }), lines: lines, legend: r.riv ? [{ name: t('Channel course', 'مسار المجرى'), color: '#1F6FB2' }] : [] });
    drawMap(); drawLong(); narrative(); tables();
  }
  function drawMap() {
    var r = last; if (!map) map = SH.map('gMap', { base: 'satellite', locate: false }); if (!map) return; if (lay) map.removeLayer(lay); lay = L.layerGroup().addTo(map);
    r.T.forEach(function (p, i) { L.marker([p.lat, p.lon], { icon: SH.pin('', 'mk', [12, 12]) }).bindTooltip('P' + (i + 1) + ' · ' + SH.fmt(p.z, 1) + ' m').addTo(lay); });
    if (r.riv) L.polyline(r.R.map(function (p) { return [p.lat, p.lon]; }), { color: '#4FC3F7', weight: 4 }).addTo(lay);
    var bb = L.latLngBounds(r.A.map(function (p) { return [p.lat, p.lon]; })); setTimeout(function () { map.invalidateSize(); map.fitBounds(bb, { padding: [30, 30], maxZoom: 17 }); }, 120);
  }
  function drawLong() {
    var r = last, p = SH.palette(); if (!r.riv) { $('#gLong').innerHTML = '<div class="empty-s"><p>' + t('Capture two or more channel points to draw the profile.', 'التقط نقطتين أو أكثر من المجرى لرسم المقطع.') + '</p></div>'; $('#gLongCap').textContent = ''; return; }
    var v = r.riv; SH.plot('gLong', [{ x: v.d, y: v.pts.map(function (q) { return q.z; }), mode: 'lines+markers', line: { color: '#1F6FB2', width: 2.5 }, marker: { size: 6 }, fill: 'tozeroy', fillcolor: 'rgba(31,111,178,.08)', text: v.pts.map(function (_, i) { return 'S' + (i + 1); }), hovertemplate: '%{text} · %{x:.0f} m · %{y:.1f} m<extra></extra>' }],
      function () { var zs = v.pts.map(function (q) { return q.z; }), a = Math.min.apply(null, zs), b = Math.max.apply(null, zs); return SH.plotLayout({ showlegend: false, xaxis: { title: { text: t('Distance downstream (m)', 'المسافة باتجاه المصب (م)') } }, yaxis: { title: { text: t('Bed elevation (m)', 'منسوب القاع (م)') }, range: [a - (b - a) * 0.2 - 1, b + (b - a) * 0.1 + 1] } }); });
    $('#gLongCap').innerHTML = t('Course ', 'طول المسار ') + SH.fmt(v.len, 0) + ' m · ' + t('straight ', 'المستقيم ') + SH.fmt(v.straight, 0) + ' m · ' + t('fall ', 'الهبوط ') + SH.fmt(v.drop, 1) + ' m · ' + t('flow toward the ', 'الجريان نحو ') + compass(v.dir) + '.';
  }
  function narrative() {
    var r = last, env = { mtn: t('complex mountainous terrain', 'تضاريس جبلية معقدة'), hill: t('a plateau and hill landscape', 'منظر هضاب وتلال'), plain: t('a flat plain', 'سهل منبسط'), wadi: t('an arid wadi system', 'منظومة وديان جافة') }[SH.val('gEnv')];
    var DR = { dend: t('The dendritic drainage points to rocks of uniform resistance without strong structural control.', 'يشير التصريف الشجري إلى صخور متجانسة المقاومة دون تحكم بنيوي قوي.'), trel: t('The trellis drainage follows the strike of alternating hard and soft beds, typical of folded or faulted terrain.', 'يتبع التصريف التعريشي مضرب الطبقات الصلبة واللينة المتعاقبة، وهو نموذجي للتضاريس المطوية أو المتصدعة.'), rad: t('Radial drainage spreads outward from a central high such as a dome, anticlinal nose or volcanic cone.', 'يتشعب التصريف الشعاعي من مرتفع مركزي كقبة أو أنف طية محدبة أو مخروط بركاني.'), rect: t('Rectangular drainage with right-angle bends is guided by orthogonal joints or faults.', 'يتحكم في التصريف المستطيلي ذي الانعطافات القائمة نظامٌ من الفواصل أو الصدوع المتعامدة.'), par: t('Parallel drainage reflects a uniform regional slope or elongated landforms.', 'يعكس التصريف المتوازي انحداراً إقليمياً منتظماً أو أشكالاً أرضية مستطيلة.') }[SH.val('gDrain')];
    var VA = { v: t('V-shaped valleys show that vertical incision is still active.', 'تدل الوديان على شكل V على أن النحت الرأسي ما يزال نشطاً.'), u: t('Flat-floored valleys show lateral erosion and sediment storage, a sign of a lower gradient or a mature stage.', 'تدل الوديان مسطحة القاع على نحت جانبي وخزن للرواسب، وهي علامة على انحدار أقل أو مرحلة ناضجة.'), g: t('Gullies and rills mark rapid surface erosion of soft or bare ground.', 'تدل الأخاديد والمسيلات على تعرية سطحية سريعة لأرض لينة أو مكشوفة.') }[SH.val('gValley')];
    var PR = SH.$$('#gProc input:checked').map(function (i) { return i.parentElement.textContent.trim().toLowerCase(); });
    var h = '<p>' + t('The survey covers ', 'يغطي المسح ') + SH.fmt(r.area / 1e4, 2) + t(' ha of ', ' هكتاراً من ') + env + t(' with ', ' بـ') + r.A.length + t(' measured points. The surface rises to ', ' نقطة مقاسة. يرتفع السطح إلى ') + '<b>' + SH.fmt(r.hi.z, 1) + ' m</b>' + t(' toward the ', ' نحو ') + r.hiDir + t(' and falls to ', ' وينخفض إلى ') + '<b>' + SH.fmt(r.lo.z, 1) + ' m</b>' + t(' toward the ', ' نحو ') + r.loDir + t('. The overall gradient between them is ', '. يبلغ الانحدار العام بينهما ') + SH.fmt(r.grad * 100, 1) + ' %' + t(', and the mean slope of the interpolated surface is ', '، ومتوسط ميل السطح المستوفى ') + SH.fmt(r.meanSlope, 1) + '°. ' +
      (r.meanSlope > 15 ? t('Closely spaced contours mark steep ground where runoff is fast and slope instability should be checked.', 'تدل الخطوط الكنتورية المتقاربة على أرض شديدة الانحدار حيث الجريان سريع ويجب فحص استقرار المنحدرات.') : t('Widely spaced contours mark gentle ground where water spreads and ponds after storms.', 'تدل الخطوط الكنتورية المتباعدة على أرض لطيفة الانحدار حيث تنتشر المياه وتتجمع بعد العواصف.')) + '</p>';
    h += '<p>' + DR + ' ' + VA + (PR.length ? ' ' + t('Active processes observed: ', 'العمليات النشطة المرصودة: ') + PR.join('، ') + '.' : '') + '</p>';
    if (r.riv) h += '<p>' + t('The surveyed channel runs ', 'يمتد المجرى المرصود ') + SH.fmt(r.riv.len, 0) + t(' m toward the ', ' م نحو ') + compass(r.riv.dir) + t(', falling ', '، هابطاً ') + SH.fmt(r.riv.drop, 1) + t(' m at a mean gradient of ', ' م بانحدار متوسط ') + SH.fmt(r.riv.grad * 1000, 1) + ' ‰. ' + t('Its sinuosity of ', 'ومعامل تعرجه ') + SH.fmt(r.riv.sin, 2) + (r.riv.sin < 1.05 ? t(' describes a straight channel, often guided by a joint or fault.', ' يصف مجرى مستقيماً، غالباً ما يوجهه فاصل أو صدع.') : r.riv.sin < 1.5 ? t(' describes a sinuous channel.', ' يصف مجرى متعرجاً.') : t(' describes a meandering channel.', ' يصف مجرى ملتوياً (منعطفاً).')) +
      (r.riv.drop <= 0 ? ' <b style="color:var(--danger)">' + t('The recorded heights rise downstream: check the order of the points or the heights.', 'الارتفاعات المسجلة تزداد نحو المصب: تحقق من ترتيب النقاط أو الارتفاعات.') + '</b>' : '') + '</p>';
    h += '<p>' + { high: t('Flood exposure is high: the site lies where flows converge or leave the catchment. Keep structures and stockpiles out of the active channel and its terraces.', 'التعرض للسيول عالٍ: يقع الموقع حيث تلتقي الجريانات أو تغادر الحوض. أبعد المنشآت والأكوام عن المجرى النشط ومصاطبه.'), mid: t('Flood exposure is moderate: the reach transfers water and sediment. Culverts and crossings need capacity for flash floods.', 'التعرض للسيول متوسط: المقطع ينقل المياه والرواسب. تحتاج العبّارات والمعابر إلى سعة كافية للسيول المفاجئة.'), low: t('Flood exposure is low: the site lies near a divide or summit.', 'التعرض للسيول منخفض: يقع الموقع قرب خط تقسيم مياه أو قمة.') }[SH.val('gFlood')] + '</p>';
    if (r.demN) h += '<p class="xsmall muted">' + r.demN + t(' heights were taken from the AWS Terrain Tiles DEM (about 30 m) because no levelled height was entered.', ' ارتفاعاً أُخذ من نموذج AWS Terrain Tiles (نحو 30 م) لعدم إدخال ارتفاع مسوّى.') + '</p>';
    $('#gNarr').innerHTML = h;
  }
  function tables() {
    var r = last, row = function (id, p) { return '<tr><td><b>' + id + '</b></td><td class="num">' + p.x.toFixed(1) + '</td><td class="num">' + p.y.toFixed(1) + '</td><td class="num">' + SH.fmt(p.z, 1) + (p.dem ? '<sup title="DEM">*</sup>' : '') + '</td></tr>'; }, hd = '<thead><tr><th>#</th><th class="num">E</th><th class="num">N</th><th class="num">Z m</th></tr></thead><tbody>';
    $('#gT1').innerHTML = hd + (r.T.map(function (p, i) { return row('P' + (i + 1), p); }).join('') || '<tr><td colspan="4" class="muted">—</td></tr>') + '</tbody>';
    $('#gT2').innerHTML = hd + (r.R.map(function (p, i) { return row('S' + (i + 1), p); }).join('') || '<tr><td colspan="4" class="muted">—</td></tr>') + '</tbody>';
  }
  $('#gPng').addEventListener('click', function () { if (G) SH.svgPng($('#gSvg'), 'shandal-geomorph-map.png', 2.5, '#ffffff'); });
  $('#gSvgB').addEventListener('click', function () { if (!G) return; var s = new XMLSerializer().serializeToString($('#gSvg')); if (s.indexOf('xmlns=') < 0) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'); SH.download('shandal-geomorph-map.svg', s, 'image/svg+xml'); });
  $('#gRun').addEventListener('click', run);
  $('#gDemo').addEventListener('click', function () {
    var c = [33.050, 41.900], s = 11, rnd = function () { s = (s * 16807) % 2147483647; return s / 2147483647; }, f = function (la, lo) { var u = (la - c[0] - 0.0085) / -0.008, v = (lo - c[1] - 0.0002) / 0.0075, dd = Math.abs(u - v) * 0.0055 * 1e3; return 280 + 900 * (la - c[0]) - 400 * (lo - c[1]) + 14 * Math.exp(-(Math.pow((la - c[0] - 0.0015) * 1e3, 2) + Math.pow((lo - c[1] - 0.0065) * 1e3, 2)) / 5) - 7 * Math.exp(-dd * dd / 1.5); };
    data.topo = []; for (var k = 0; k < 28; k++) { var la = c[0] + rnd() * 0.009 - 0.0005, lo = c[1] + rnd() * 0.009 - 0.0005; data.topo.push({ lat: la, lon: lo, z: Math.round(f(la, lo) * 10) / 10 }); }
    data.riv = []; for (k = 0; k < 9; k++) { var t0 = k / 8, la2 = c[0] + 0.0085 - t0 * 0.008 + 0.0004 * Math.sin(t0 * 7), lo2 = c[1] + 0.0002 + t0 * 0.0075; data.riv.push({ lat: la2, lon: lo2, z: Math.round((f(la2, lo2) - 2) * 10) / 10 }); }
    $('#gProj').value = t('Wadi Horan tributary, western desert', 'رافد وادي حوران، الصحراء الغربية'); $('#gEnv').value = 'wadi'; $('#gDrain').value = 'dend'; $('#gValley').value = 'u'; $('#gFlood').value = 'high'; save(); ui('topo'); ui('riv'); run();
  });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Process the survey first.', 'عالج المسح أولاً.'), 'warn'); } else if (map) map.invalidateSize(); });
  document.addEventListener('sh:redraw', function () { if (last) drawLong(); });
  ui('topo'); ui('riv');
})();
