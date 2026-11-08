/* Shandal Site Report — one point, one report: location, terrain (90 m grid: slope, aspect, relief, position, two 6 km profiles),
   geology at the point, active faults (Wells & Coppersmith 1994 surface-rupture magnitude) and nearest plate boundary, instrumental
   earthquakes since 1973 (Poisson rates), nearest Holocene volcano, 30-year climate normals (Köppen–Geiger after Peel et al. 2007,
   aridity index P/ET0), soil (texture class, pH, organic carbon), rivers and height above the nearest river, a hazard screening matrix
   and a field checklist. Figures: location map (frame, graticule, north arrow, scale, legend below), profiles, earthquakes, climate. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, L = window.L, AR = SH.lang === 'ar', E = SH.esc, F = SH.fmt;
  var PF = 'Manrope, Arial, sans-serif', INK = '#1B232B', MUT = '#55616B', GOLD = '#B08A3E';
  var persist = SH.persist('sitereport', ['sLat', 'sLon', 'sTitle', 'sR']);
  var map = SH.map('sMap', { zoom: 7, base: 'topo', center: [SH.num('sLat') || 35.468, SH.num('sLon') || 44.392] }), mk = null, R = null;
  var JS = function (u, ms) { return SH.getJSON(u, { timeout: ms || 30000 }); };

  /* ------------------------------------------------------------------ site picking */
  function site(lat, lon, fly) {
    $('#sLat').value = lat.toFixed(5); $('#sLon').value = lon.toFixed(5); persist.save(); if (!map) return;
    if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map);
    if (fly) map.setView([lat, lon], Math.max(map.getZoom(), 9));
  }
  if (map) map.on('click', function (e) { site(e.latlng.lat, ((e.latlng.lng + 540) % 360) - 180); });
  ['sLat', 'sLon'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var a = SH.num('sLat'), b = SH.num('sLon'); if (!isNaN(a) && !isNaN(b)) site(a, b, true); }); });
  $('#sGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { site(p.lat, p.lon, true); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  var NOM = 'https://nominatim.openstreetmap.org/', LANG = '&accept-language=' + (AR ? 'ar,en' : 'en');
  function find() {
    var q = $('#sQ').value.trim(); if (!q) return; $('#sHits').innerHTML = '<span class="xsmall muted">' + t('Searching…', 'جارٍ البحث…') + '</span>';
    JS(NOM + 'search?format=jsonv2&limit=5&q=' + encodeURIComponent(q) + LANG, 12000).then(function (r) {
      r = Array.isArray(r) ? r : [];
      $('#sHits').innerHTML = r.length ? r.map(function (h) { return '<button type="button" class="btn btn-line btn-xs" style="justify-content:flex-start;text-align:start;white-space:normal" data-ll="' + h.lat + ',' + h.lon + '">' + E(h.display_name) + '</button>'; }).join('') : '<span class="xsmall muted">' + t('No match.', 'لا نتائج.') + '</span>';
    }).catch(function (e) { $('#sHits').innerHTML = '<span class="xsmall muted">' + E(e.message) + '</span>'; });
  }
  $('#sFind').addEventListener('click', find);
  $('#sQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } });
  $('#sHits').addEventListener('click', function (e) { var b = e.target.closest('[data-ll]'); if (!b) return; var p = b.getAttribute('data-ll').split(','); site(+p[0], +p[1], true); $('#sHits').innerHTML = ''; });
  site(SH.num('sLat') || 35.468, SH.num('sLon') || 44.392, true);
  $('#sDemo').addEventListener('click', function () { $('#sTitle').value = t('Kirkuk city', 'مدينة كركوك'); site(35.468, 44.392, true); run(); });

  /* ------------------------------------------------------------------ progress */
  var STEPS = [['loc', t('Place name and coordinates', 'اسم المكان والإحداثيات')], ['ter', t('Terrain', 'التضاريس')], ['geo', t('Geology', 'الجيولوجيا')], ['flt', t('Faults and plates', 'الصدوع والصفائح')], ['eq', t('Earthquakes', 'الزلازل')], ['cli', t('Climate', 'المناخ')], ['soil', t('Soil', 'التربة')], ['hyd', t('Rivers', 'الأنهار')], ['vol', t('Volcanoes', 'البراكين')]];
  function prog(k, st) { var li = $('#sProg [data-k="' + k + '"]'); if (li) li.className = st; }
  function step(k, p) { prog(k, 'run'); return p.then(function (v) { prog(k, 'ok'); return v; }, function (e) { prog(k, 'no'); return { err: (e && e.message) || String(e) }; }); }

  /* ------------------------------------------------------------------ data: location */
  function getLoc(p) { return JS(NOM + 'reverse?format=jsonv2&zoom=12&lat=' + p.lat.toFixed(5) + '&lon=' + p.lon.toFixed(5) + LANG, 12000).then(function (j) {
    var a = (j && j.address) || {}; return { name: j && j.display_name || '', place: a.city || a.town || a.village || a.hamlet || a.municipality || a.county || '', region: a.state || a.province || a.region || '', country: a.country || '', cc: (a.country_code || '').toUpperCase() }; }); }

  /* ------------------------------------------------------------------ data: terrain (grid 9 × 9 at 150 m, two 6 km profiles) */
  var OM = 'https://api.open-meteo.com/v1/elevation';
  function elev(pts) { return JS(OM + '?latitude=' + pts.map(function (q) { return q[0].toFixed(5); }).join(',') + '&longitude=' + pts.map(function (q) { return q[1].toFixed(5); }).join(','), 20000).then(function (j) { if (!j.elevation || j.elevation.length !== pts.length) throw new Error(t('No elevation returned.', 'لم يُرجَع ارتفاع.')); return j.elevation; }); }
  function off(p, dx, dy) { return [p.lat + dy / 111320, p.lon + dx / (111320 * Math.cos(SH.rad(p.lat)))]; }
  function getTer(p) {
    var h = 150, n = 9, c = 4, g = [], pr = [];
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) g.push(off(p, (j - c) * h, (c - i) * h));
    for (var k = 0; k < 50; k++) { var s = -3000 + k * 6000 / 49; pr.push(off(p, s, 0)); }
    for (k = 0; k < 50; k++) { s = -3000 + k * 6000 / 49; pr.push(off(p, 0, s)); }
    return Promise.all([elev(g), elev(pr)]).then(function (r) {
      var z = r[0], Z = function (i, j) { return z[i * n + j]; }, zc = Z(c, c);
      var a = Z(c - 1, c - 1), b = Z(c - 1, c), cc = Z(c - 1, c + 1), d = Z(c, c - 1), f = Z(c, c + 1), gg = Z(c + 1, c - 1), hh = Z(c + 1, c), ii = Z(c + 1, c + 1);
      var dzdx = ((cc + 2 * f + ii) - (a + 2 * d + gg)) / (8 * h), dzdy = ((a + 2 * b + cc) - (gg + 2 * hh + ii)) / (8 * h);
      var slope = SH.deg(Math.atan(Math.hypot(dzdx, dzdy))), asp = (SH.deg(Math.atan2(-dzdx, -dzdy)) + 360) % 360;
      var mn = Math.min.apply(null, z), mx = Math.max.apply(null, z), mean = z.reduce(function (s0, v) { return s0 + v; }, 0) / z.length, tpi = zc - mean;
      var we = r[1].slice(0, 50), sn = r[1].slice(50);
      return { z: zc, slope: slope, aspect: asp, relief: mx - mn, tpi: tpi, min: mn, max: mx, we: we, sn: sn, flat: slope < 0.5 };
    });
  }
  function landform(T) {
    if (T.tpi > Math.max(12, T.relief * 0.25)) return T.slope > 8 ? [t('Ridge or hill crest', 'خط أو قمة تل'), 'ridge'] : [t('Low rise or plateau edge', 'مرتفع خفيف أو حافة هضبة'), 'rise'];
    if (T.tpi < -Math.max(12, T.relief * 0.25)) return T.slope > 8 ? [t('Valley side near the floor', 'جانب وادٍ قرب قاعه'), 'valley'] : [t('Valley floor or depression', 'قاع وادٍ أو منخفض'), 'valley'];
    if (T.slope < 2) return [t('Flat ground (plain or terrace)', 'أرض منبسطة (سهل أو مصطبة)'), 'flat'];
    if (T.slope < 8) return [t('Gentle slope', 'منحدر لطيف'), 'gentle'];
    return T.slope < 20 ? [t('Moderate hillside', 'سفح متوسط الانحدار'), 'slope'] : [t('Steep hillside', 'سفح شديد الانحدار'), 'steep'];
  }
  var DIR8 = AR ? ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'] : ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  var dir8 = function (a) { return DIR8[Math.round(a / 45) % 8]; };

  /* ------------------------------------------------------------------ data: geology */
  var SCO = { large: 0, medium: 1, small: 2, tiny: 3 };
  function getGeo(p) { return JS('https://macrostrat.org/api/v2/geologic_units/map?lat=' + p.lat.toFixed(5) + '&lng=' + p.lon.toFixed(5), 25000).then(function (j) {
    var a = ((j && j.success && j.success.data) || []).filter(function (u) { return u.name || u.lith || u.descrip; });
    if (!a.length) throw new Error(t('No geological map unit at this point.', 'لا وحدة جيولوجية مرسومة في هذه النقطة.'));
    a.sort(function (x, y) { return (SCO[x.scale] != null ? SCO[x.scale] : 4) - (SCO[y.scale] != null ? SCO[y.scale] : 4) || (x.b_int_age - x.t_int_age) - (y.b_int_age - y.t_int_age); });
    return { best: a[0], all: a.slice(0, 5) }; }); }
  function rockClass(G) {
    if (!G || G.err) return { txt: '', evap: false, carb: false, weak: false, loose: false, hard: false, igneous: false };
    var u = G.best, s = [u.name, u.strat_name, u.lith, u.descrip, u.comments, (u.liths || []).map(function (l) { return l.lith || l.name || l; }).join(' ')].join(' ').toLowerCase();
    var young = u.b_int_age != null && u.b_int_age <= 2.6;
    return { txt: s, evap: /gypsum|anhydrite|halite|evaporit|salt\b|sabkha/.test(s), carb: /limestone|dolomit|carbonate|chalk|marl|karst/.test(s),
      weak: /clay|marl|shale|mudstone|siltstone|\bsilt|gypsum|evaporit|flysch|tuff|loess|unconsolidated|alluvi|colluvi/.test(s),
      loose: young || /alluvi|colluvi|unconsolidated|terrace|aeolian|eolian|dune|gravel|sand(?!stone)|fan deposit|flood ?plain|sediments/.test(s),
      hard: /granite|basalt|gabbro|diorite|quartzite|gneiss|schist|amphibolit|ophiolit|serpentin|limestone|dolomit|sandstone|igneous|metamorphic|volcanic|plutonic/.test(s),
      igneous: /granite|basalt|gabbro|diorite|ophiolit|serpentin|volcanic|plutonic|igneous|andesit|rhyolit/.test(s), young: young };
  }

  /* ------------------------------------------------------------------ data: faults and plate boundary */
  var tiles = {}, fIndex = null, FBASE = SH.base + 'assets/data/faults/';
  function kind(s) { s = (s || '').toLowerCase(); if (/thrust|reverse|anticline/.test(s)) return 'R'; if (/normal/.test(s)) return 'N'; if (/dextral|sinistral|strike|transform/.test(s)) return 'SS'; return 'U'; }
  var KCOL = { R: '#C0392B', N: '#2E6FBF', SS: '#2E8B57', U: '#6E6E6E' };
  var KNAME = { R: t('reverse / thrust', 'عكسي / زاحف'), N: t('normal', 'اعتيادي'), SS: t('strike-slip', 'انزلاق مضربي'), U: t('unspecified', 'غير محدد') };
  var KEN = { R: 'Reverse / thrust fault', N: 'Normal fault', SS: 'Strike-slip fault', U: 'Fault, type unspecified' };
  function segDist(c, lat, lon) {
    var kx = 111.195 * Math.cos(SH.rad(lat)), ky = 111.195, best = 1e9, len = 0, near = null;
    for (var i = 0; i + 3 < c.length; i += 2) {
      var x1 = (c[i] - lon) * kx, y1 = (c[i + 1] - lat) * ky, x2 = (c[i + 2] - lon) * kx, y2 = (c[i + 3] - lat) * ky, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
      if (Math.abs(c[i + 2] - c[i]) > 180) continue;
      var u = L2 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / L2)) : 0, qx = x1 + u * dx, qy = y1 + u * dy, dd = Math.sqrt(qx * qx + qy * qy);
      if (dd < best) { best = dd; near = [lat + qy / ky, lon + qx / kx]; } len += Math.sqrt(L2);
    }
    return { d: best, len: len, near: near };
  }
  function getFlt(p, Rk) {
    var idx = fIndex ? Promise.resolve(fIndex) : JS(FBASE + 'index.json').then(function (j) { return fIndex = j; });
    var faults = idx.then(function (ix) {
      var la = Math.floor(p.lat / 10) * 10, lo = Math.floor(p.lon / 10) * 10, want = [];
      for (var dy = -10; dy <= 10; dy += 10) for (var dx = -10; dx <= 10; dx += 10) { var lo2 = ((lo + dx + 180) % 360 + 360) % 360 - 180, k = (la + dy) + '_' + lo2; if (ix.indexOf(k) >= 0 && want.indexOf(k) < 0) want.push(k); }
      return Promise.all(want.map(function (k) { return tiles[k] || (tiles[k] = JS(FBASE + k + '.json', 60000).catch(function () { return []; })); }));
    }).then(function (arrs) {
      var seen = {}, out = [];
      arrs.forEach(function (a) { a.forEach(function (r) { var key = r[4].slice(0, 4).join(','); if (seen[key]) return; seen[key] = 1; var s = segDist(r[4], p.lat, p.lon); if (s.d > Rk) return;
        var k = kind(r[1]), lg = Math.log10(Math.max(s.len, 1)), Mw = k === 'SS' ? 5.16 + 1.12 * lg : k === 'R' ? 5.00 + 1.22 * lg : k === 'N' ? 4.86 + 1.32 * lg : 5.08 + 1.16 * lg;
        out.push({ name: r[0], type: r[1], k: k, rate: r[2], dip: r[3], c: r[4], d: s.d, len: s.len, near: s.near, Mw: Math.min(Mw, 8.0) }); }); });
      return out.sort(function (a, b) { return a.d - b.d; });
    });
    var plates = JS(SH.base + 'assets/data/plates.json').then(function (P) { var nb = null; P.forEach(function (q) { var s = segDist(q[3], p.lat, p.lon); if (!nb || s.d < nb.d) nb = { d: s.d, name: q[0], cls: q[1], v: q[2], near: s.near }; }); return { nb: nb, P: P }; }).catch(function () { return { nb: null, P: [] }; });
    return Promise.all([faults, plates]).then(function (r) { return { list: r[0], nb: r[1].nb, P: r[1].P }; });
  }
  var PN = { SUB: t('subduction zone', 'نطاق اندساس'), OCB: t('oceanic convergent boundary', 'حد تقارب محيطي'), CCB: t('continental collision boundary', 'حد تصادم قاري'), OSR: t('spreading ridge', 'ظهر منتشر'), CRB: t('continental rift', 'خسيف قاري'), OTF: t('oceanic transform', 'صدع تحويلي محيطي'), CTF: t('continental transform', 'صدع تحويلي قاري') };

  /* ------------------------------------------------------------------ data: earthquakes */
  function getEq(p, Rk) { var y0 = 1973; return JS('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=' + p.lat.toFixed(4) + '&longitude=' + p.lon.toFixed(4) + '&maxradiuskm=' + Rk + '&minmagnitude=4&starttime=' + y0 + '-01-01&orderby=magnitude&limit=20000', 60000).then(function (j) {
    var ev = (j.features || []).filter(function (f) { return f.properties.mag != null && f.properties.type === 'earthquake'; }).map(function (f) { var c = f.geometry.coordinates; return { lat: c[1], lon: c[0], depth: c[2], mag: f.properties.mag, time: f.properties.time, place: f.properties.place, d: SH.dist(p, { lat: c[1], lon: c[0] }) / 1000 }; });
    var yrs = (Date.now() - Date.parse(y0 + '-01-01')) / 3.15576e10, n5 = ev.filter(function (e) { return e.mag >= 5; }).length, n6 = ev.filter(function (e) { return e.mag >= 6; }).length;
    var l5 = n5 / yrs, l6 = n6 / yrs, nearSig = ev.filter(function (e) { return e.mag >= 5; }).sort(function (a, b) { return a.d - b.d; })[0] || null, near50 = ev.filter(function (e) { return e.d <= 50; }).length;
    return { ev: ev, yrs: yrs, n: ev.length, n5: n5, n6: n6, l5: l5, l6: l6, P5: 1 - Math.exp(-l5 * 50), P6: 1 - Math.exp(-l6 * 50), max: ev[0] || null, near5: nearSig, near50: near50, R: Rk }; }); }

  /* ------------------------------------------------------------------ data: volcanoes */
  function getVol(p) { return JS(SH.base + 'assets/data/volcanoes.json').then(function (V) { var o = V.map(function (v) { return { name: v[1], country: v[2], lat: v[4], lon: v[5], el: v[6], type: v[7], d: SH.dist(p, { lat: v[4], lon: v[5] }) / 1000 }; }).sort(function (a, b) { return a.d - b.d; }); return { near: o[0], list: o.slice(0, 3) }; }); }

  /* ------------------------------------------------------------------ data: climate 1995–2024 */
  function getCli(p) {
    return JS('https://archive-api.open-meteo.com/v1/archive?latitude=' + p.lat.toFixed(4) + '&longitude=' + p.lon.toFixed(4) + '&start_date=1995-01-01&end_date=2024-12-31&daily=precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration&timezone=GMT', 90000).then(function (j) {
      var D = j.daily, n = D.time.length, M = []; for (var m = 0; m < 12; m++) M.push({ T: 0, Tx: 0, Tn: 0, P: 0, E: 0, nT: 0 });
      var yrs = {}, maxP = { v: -1, d: '' }, wet = 0;
      for (var i = 0; i < n; i++) { var mo = +D.time[i].slice(5, 7) - 1, o = M[mo], y = D.time[i].slice(0, 4); yrs[y] = 1;
        if (D.temperature_2m_mean[i] != null) { o.T += D.temperature_2m_mean[i]; o.Tx += D.temperature_2m_max[i]; o.Tn += D.temperature_2m_min[i]; o.nT++; }
        var pp = D.precipitation_sum[i]; if (pp != null) { o.P += pp; if (pp > maxP.v) maxP = { v: pp, d: D.time[i] }; if (pp >= 10) wet++; }
        if (D.et0_fao_evapotranspiration[i] != null) o.E += D.et0_fao_evapotranspiration[i]; }
      var ny = Object.keys(yrs).length;
      M.forEach(function (o) { o.T /= o.nT; o.Tx /= o.nT; o.Tn /= o.nT; o.P /= ny; o.E /= ny; });
      var P = M.reduce(function (s, o) { return s + o.P; }, 0), ET = M.reduce(function (s, o) { return s + o.E; }, 0), T = M.reduce(function (s, o) { return s + o.T; }, 0) / 12;
      return { M: M, P: P, ET: ET, T: T, AI: ET ? P / ET : null, maxP: maxP, wet: wet / ny, ny: ny, kg: koppen(M, p.lat), elev: j.elevation };
    });
  }
  function koppen(M, lat) {
    var T = M.map(function (o) { return o.T; }), P = M.map(function (o) { return o.P; }), MAT = T.reduce(function (a, b) { return a + b; }, 0) / 12, MAP = P.reduce(function (a, b) { return a + b; }, 0);
    var Th = Math.max.apply(null, T), Tc = Math.min.apply(null, T), sum = lat >= 0 ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2], win = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(function (m) { return sum.indexOf(m) < 0; });
    var Ps = sum.reduce(function (a, m) { return a + P[m]; }, 0), Pw = MAP - Ps, Psd = Math.min.apply(null, sum.map(function (m) { return P[m]; })), Psw = Math.max.apply(null, sum.map(function (m) { return P[m]; })), Pwd = Math.min.apply(null, win.map(function (m) { return P[m]; })), Pww = Math.max.apply(null, win.map(function (m) { return P[m]; })), Pd = Math.min.apply(null, P);
    var Pth = Pw >= 0.7 * MAP ? 20 * MAT : Ps >= 0.7 * MAP ? 20 * MAT + 280 : 20 * MAT + 140, T10 = T.filter(function (v) { return v >= 10; }).length;
    if (Th < 10) return Th > 0 ? 'ET' : 'EF';
    if (MAP < Pth) return 'B' + (MAP < 0.5 * Pth ? 'W' : 'S') + (MAT >= 18 ? 'h' : 'k');
    if (Tc >= 18) return Pd >= 60 ? 'Af' : Pd >= 100 - MAP / 25 ? 'Am' : 'Aw';
    var g = Tc > 0 ? 'C' : 'D', s = (Psd < 40 && Psd < Pww / 3) ? 's' : (Pwd < Psw / 10) ? 'w' : 'f', th = Th >= 22 ? 'a' : T10 >= 4 ? 'b' : (g === 'D' && Tc < -38) ? 'd' : 'c';
    return g + s + th;
  }
  function kgName(k) {
    var N = { Af: ['Tropical rainforest', 'مداري مطير'], Am: ['Tropical monsoon', 'مداري موسمي'], Aw: ['Tropical savanna', 'سافانا مدارية'], BWh: ['Hot desert', 'صحراوي حار'], BWk: ['Cold desert', 'صحراوي بارد'], BSh: ['Hot semi-arid (steppe)', 'شبه جاف حار (سهوب)'], BSk: ['Cold semi-arid (steppe)', 'شبه جاف بارد (سهوب)'], ET: ['Tundra', 'تندرا'], EF: ['Ice cap', 'غطاء جليدي'] };
    if (N[k]) return t(N[k][0], N[k][1]);
    var s = { s: t('dry summer', 'صيف جاف'), w: t('dry winter', 'شتاء جاف'), f: t('no dry season', 'بلا فصل جاف') }[k[1]], th = { a: t('hot summer', 'صيف حار'), b: t('warm summer', 'صيف دافئ'), c: t('cool summer', 'صيف معتدل البرودة'), d: t('very cold winter', 'شتاء قارس جداً') }[k[2]];
    if (k === 'Csa' || k === 'Csb') return t('Mediterranean, ', 'متوسطي، ') + th;
    var sep = AR ? '، ' : ', '; return (k[0] === 'C' ? t('Temperate', 'معتدل') : t('Continental', 'قاري')) + sep + s + sep + th;
  }
  function aiClass(ai) { return ai == null ? ['—', -1] : ai < 0.05 ? [t('hyper-arid', 'شديد الجفاف'), 3] : ai < 0.2 ? [t('arid', 'جاف'), 2] : ai < 0.5 ? [t('semi-arid', 'شبه جاف'), 1] : ai < 0.65 ? [t('dry sub-humid', 'شبه رطب جاف'), 1] : [t('humid', 'رطب'), 0]; }

  /* ------------------------------------------------------------------ data: soil */
  function getSoil(p) {
    var u = 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + p.lon.toFixed(4) + '&lat=' + p.lat.toFixed(4) + ['clay', 'sand', 'silt', 'phh2o', 'soc', 'bdod', 'cfvo'].map(function (k) { return '&property=' + k; }).join('') + ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm'].map(function (k) { return '&depth=' + k; }).join('') + '&value=mean';
    return JS(u, 120000).then(function (j) {
      var L0 = (j.properties && j.properties.layers) || [], o = {};
      L0.forEach(function (l) { o[l.name] = l.depths.map(function (dd) { var v = dd.values && dd.values.mean; return v == null ? null : v / (l.unit_measure.d_factor || 1); }); });
      if (!o.clay || o.clay.every(function (v) { return v == null; })) throw new Error(t('No soil prediction here (built-up area, water or bare rock).', 'لا تنبؤ للتربة هنا (منطقة عمرانية أو ماء أو صخر عارٍ).'));
      var w30 = function (a) { if (!a) return null; var s = 0, wt = 0; [5, 10, 15].forEach(function (w, i) { if (a[i] != null) { s += a[i] * w; wt += w; } }); return wt ? s / wt : null; };
      var cl = w30(o.clay) / 10, sa = w30(o.sand) / 10, si = w30(o.silt) / 10, sm = cl + sa + si; if (sm) { cl = cl * 100 / sm; sa = sa * 100 / sm; si = si * 100 / sm; }
      return { o: o, clay: cl, sand: sa, silt: si, ph: w30(o.phh2o), soc: w30(o.soc), bd: w30(o.bdod), cf: w30(o.cfvo) != null ? w30(o.cfvo) / 10 : null, tex: texture(sa, si, cl) };
    });
  }
  function texture(sa, si, cl) {
    var c = function (en, ar) { return t(en, ar); };
    if (si + 1.5 * cl < 15) return c('sand', 'رملية');
    if (si + 2 * cl < 30) return c('loamy sand', 'رملية مزيجية');
    if ((cl >= 7 && cl < 20 && sa > 52) || (cl < 7 && si < 50)) return c('sandy loam', 'مزيجية رملية');
    if (cl >= 7 && cl < 27 && si >= 28 && si < 50 && sa <= 52) return c('loam', 'مزيجية');
    if ((si >= 50 && cl >= 12 && cl < 27) || (si >= 50 && si < 80 && cl < 12)) return c('silt loam', 'مزيجية غرينية');
    if (si >= 80 && cl < 12) return c('silt', 'غرينية');
    if (cl >= 20 && cl < 35 && si < 28 && sa > 45) return c('sandy clay loam', 'مزيجية طينية رملية');
    if (cl >= 27 && cl < 40 && sa > 20 && sa <= 45) return c('clay loam', 'مزيجية طينية');
    if (cl >= 27 && cl < 40 && sa <= 20) return c('silty clay loam', 'مزيجية طينية غرينية');
    if (cl >= 35 && sa > 45) return c('sandy clay', 'طينية رملية');
    if (cl >= 40 && si >= 40) return c('silty clay', 'طينية غرينية');
    return c('clay', 'طينية');
  }

  /* ------------------------------------------------------------------ data: rivers and height above the nearest river */
  var OVP = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  function overpass(q, i) { i = i || 0; return fetch(OVP[i] + '?data=' + encodeURIComponent(q)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(function (e) { if (i + 1 < OVP.length) return overpass(q, i + 1); throw new Error(t('The river database did not answer. Try again later.', 'لم تستجب قاعدة بيانات الأنهار. حاول لاحقاً.')); }); }
  function getHyd(p) {
    var q = '[out:json][timeout:25];(way(around:10000,' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) + ')["waterway"~"^(river|stream|canal)$"];way(around:3000,' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) + ')["natural"="water"];);out tags geom;';
    return overpass(q).then(function (j) {
      var W = (j.elements || []).filter(function (e) { return e.geometry && e.geometry.length > 1; }).map(function (e) { var c = []; e.geometry.forEach(function (g) { c.push(g.lon, g.lat); }); var s = segDist(c, p.lat, p.lon); var tg = e.tags || {};
        return { kind: tg.waterway || (tg.natural === 'water' ? (tg.water || 'water') : 'water'), name: (AR && tg['name:ar']) || (!AR && tg['name:en']) || tg.name || '', d: s.d, near: s.near, c: c }; });
      var by = function (f) { return W.filter(f).sort(function (a, b) { return a.d - b.d; })[0] || null; };
      var river = by(function (w) { return w.kind === 'river'; }), any = by(function () { return true; }), stream = by(function (w) { return w.kind === 'stream'; }), canal = by(function (w) { return w.kind === 'canal'; }), lake = by(function (w) { return w.kind !== 'river' && w.kind !== 'stream' && w.kind !== 'canal'; });
      var ref = river && river.d < 10 ? river : any;
      if (!ref) return { none: true, W: W };
      return elev([ref.near, [p.lat, p.lon]]).then(function (z) { return { river: river, stream: stream, canal: canal, lake: lake, any: any, ref: ref, hab: z[1] - z[0], W: W }; }).catch(function () { return { river: river, stream: stream, canal: canal, lake: lake, any: any, ref: ref, hab: null, W: W }; });
    });
  }
  var WK = { river: t('river', 'نهر'), stream: t('stream', 'جدول'), canal: t('canal', 'قناة'), water: t('water body', 'مسطح مائي'), lake: t('lake', 'بحيرة'), reservoir: t('reservoir', 'خزان'), pond: t('pond', 'بركة') };

  /* ------------------------------------------------------------------ hazard screening */
  var LV = [t('Low', 'منخفض'), t('Moderate', 'متوسط'), t('High', 'مرتفع'), t('Very high', 'مرتفع جداً')];
  function screen(D) {
    var H = [], T = D.ter, G = rockClass(D.geo), Fl = D.flt, Q = D.eq, C = D.cli, S = D.soil, W = D.hyd, V = D.vol;
    var ok = function (x) { return x && !x.err; };
    /* earthquakes */
    (function () { var why = [], s = 0, n = 0;
      if (ok(Fl)) { n++; var f = Fl.list[0]; if (f) { s += f.d < 5 ? 3 : f.d < 20 ? 2 : f.d < 50 ? 1 : 0; why.push(t('nearest mapped active fault ', 'أقرب صدع نشط مرسوم على بعد ') + F(f.d, f.d < 10 ? 1 : 0) + t(' km', ' كم')); } else why.push(t('no mapped active fault within ', 'لا صدع نشط مرسوم ضمن ') + D.R + t(' km', ' كم'));
        if (Fl.nb) { s += Fl.nb.d < 100 ? 2 : Fl.nb.d < 300 ? 1 : 0; why.push(t('plate boundary at ', 'حد الصفيحة على بعد ') + F(Fl.nb.d, 0) + t(' km', ' كم')); } }
      if (ok(Q)) { n++; var dec = Q.l5 * 10; s += dec >= 3 ? 3 : dec >= 1 ? 2 : dec >= 0.3 ? 1 : 0; why.push(F(Q.n5, 0) + t(' earthquakes of M ≥ 5 within ', ' زلزالاً بقدر 5 فأكثر ضمن ') + Q.R + t(' km since 1973', ' كم منذ 1973')); }
      H.push({ k: 'eq', h: t('Earthquake shaking', 'الاهتزاز الزلزالي'), lv: n ? (s >= 7 ? 3 : s >= 5 ? 2 : s >= 3 ? 1 : 0) : -1, why: why }); })();
    /* landslides and rockfall */
    (function () { if (!ok(T)) return H.push({ k: 'ls', h: t('Landslides and rockfall', 'الانهيالات الأرضية وتساقط الصخور'), lv: -1, why: [] });
      var s = T.slope < 5 ? 0 : T.slope < 15 ? 1 : T.slope < 30 ? 2 : 3, why = [t('slope ', 'الانحدار ') + F(T.slope, 1) + '°', t('relief ', 'التضرس ') + F(T.relief, 0) + t(' m within 600 m', ' م ضمن 600 م')];
      if (G.weak && T.slope >= 5) { s++; why.push(t('weak or clay-rich rocks', 'صخور ضعيفة أو غنية بالطين')); }
      if (ok(C) && (C.P > 600 || C.maxP.v > 60) && T.slope >= 5) { s++; why.push(t('heavy rainfall', 'أمطار غزيرة')); }
      if (H[0].lv >= 2 && T.slope >= 10) { s++; why.push(t('strong earthquakes possible', 'زلازل قوية محتملة')); }
      H.push({ k: 'ls', h: t('Landslides and rockfall', 'الانهيالات الأرضية وتساقط الصخور'), lv: T.slope < 5 ? 0 : Math.min(3, Math.max(0, s - 1)), why: why }); })();
    /* floods */
    (function () { var s = 0, why = [], n = 0;
      if (ok(T)) { n++; if (T.slope < 2) { s++; why.push(t('flat ground', 'أرض منبسطة')); } if (landform(T)[1] === 'valley') { s += 2; why.push(t('valley floor or depression', 'قاع وادٍ أو منخفض')); } if (landform(T)[1] === 'ridge') s -= 2; }
      if (ok(W) && !W.none) { n++; var dd = W.ref.d; s += dd < 0.5 ? 2 : dd < 2 ? 1 : 0; if (dd < 2) why.push(WK[W.ref.kind] + t(' at ', ' على بعد ') + F(dd * 1000, 0) + t(' m', ' م'));
        if (W.hab != null) { s += W.hab < 3 ? 2 : W.hab < 8 ? 1 : W.hab > 25 ? -2 : 0; why.push(t('ground ', 'الأرض ') + F(W.hab, 0) + t(' m above the nearest water', ' م فوق أقرب مجرى مائي')); } }
      if (ok(C)) { n++; if (C.maxP.v >= 50) { s++; why.push(t('daily rainfall up to ', 'هطول يومي يصل إلى ') + F(C.maxP.v, 0) + t(' mm', ' ملم')); } }
      H.push({ k: 'fl', h: t('Floods and flash floods', 'الفيضانات والسيول'), lv: n ? Math.max(0, Math.min(3, s - 1)) : -1, why: why }); })();
    /* dissolution */
    (function () { if (!ok(D.geo)) return H.push({ k: 'ka', h: t('Dissolution and sinkholes', 'الإذابة والخسفات'), lv: -1, why: [] });
      var lv = G.evap ? 3 : G.carb ? 1 : 0, why = [G.evap ? t('gypsum, anhydrite or salt in the mapped unit', 'جبس أو أنهيدرايت أو ملح في الوحدة المرسومة') : G.carb ? t('limestone, dolomite or marl in the mapped unit', 'حجر جيري أو دولومايت أو مارل في الوحدة المرسومة') : t('no soluble rock named in the mapped unit', 'لا صخر قابل للإذابة في وصف الوحدة المرسومة')];
      if (G.evap && ok(C) && C.P > 300) why.push(t('enough rain to dissolve gypsum', 'أمطار كافية لإذابة الجبس'));
      if (lv && ok(W) && !W.none && W.hab != null && W.hab < 10) { lv = Math.min(3, lv + 1); why.push(t('shallow water likely', 'مياه ضحلة محتملة')); }
      H.push({ k: 'ka', h: t('Dissolution and sinkholes', 'الإذابة والخسفات'), lv: lv, why: why }); })();
    /* problem soils */
    (function () { var s = 0, why = [], n = 0;
      if (ok(S)) { n++; s += S.clay >= 40 ? 2 : S.clay >= 25 ? 1 : 0; why.push(t('clay ', 'الطين ') + F(S.clay, 0) + t('% in the top 30 cm', '% في أعلى 30 سم')); if (S.ph != null && S.ph >= 8.3) { s++; why.push(t('alkaline (pH ', 'قلوية (pH ') + F(S.ph, 1) + ')'); } }
      if (ok(D.geo)) { n++; if (G.evap) { s += 2; why.push(t('gypsiferous parent rock', 'صخر أم جبسي')); } else if (/clay|marl|shale|mudstone|claystone/.test(G.txt)) { s++; why.push(t('clay or marl bedrock', 'صخر أساس طيني أو مارلي')); } if (G.loose) { s++; why.push(t('young loose deposits', 'رواسب حديثة مفككة')); } }
      if (ok(C) && C.AI != null && C.AI < 0.2 && s) { s++; why.push(t('arid climate (collapsible and saline soils)', 'مناخ جاف (ترب انهيارية ومالحة)')); }
      H.push({ k: 'so', h: t('Swelling, collapsing or saline soils', 'الترب الانتفاخية أو الانهيارية أو المالحة'), lv: n ? Math.min(3, Math.max(0, s - 1)) : -1, why: why }); })();
    /* volcanoes */
    if (ok(V) && V.near) H.push({ k: 'vo', h: t('Volcanic activity', 'النشاط البركاني'), lv: V.near.d < 30 ? 3 : V.near.d < 100 ? 2 : V.near.d < 300 ? 1 : 0, why: [t('nearest Holocene volcano ', 'أقرب بركان هولوسيني ') + V.near.name + ' ' + F(V.near.d, 0) + t(' km', ' كم')] });
    /* drought and dust */
    if (ok(C)) { var ai = aiClass(C.AI); H.push({ k: 'ar', h: t('Drought, dust and desertification', 'الجفاف والغبار والتصحر'), lv: ai[1], why: [t('aridity index ', 'مؤشر الجفاف ') + F(C.AI, 2) + ' (' + ai[0] + ')', t('rain ', 'المطر ') + F(C.P, 0) + t(' mm against evaporative demand of ', ' ملم مقابل طلب تبخري ') + F(C.ET, 0) + t(' mm a year', ' ملم سنوياً')] }); }
    return H;
  }

  /* ------------------------------------------------------------------ run */
  var busy = false;
  function run() {
    var lat = SH.num('sLat'), lon = SH.num('sLon'); if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { SH.toast(t('Set the site first.', 'حدد الموقع أولاً.'), 'warn'); return; }
    if (busy) return; busy = true; persist.save(); site(lat, lon, true);
    var p = { lat: lat, lon: lon }, Rk = +$('#sR').value || 150, btn = $('#sRun'); btn.disabled = true;
    $('#sProg').innerHTML = STEPS.map(function (s) { return '<li data-k="' + s[0] + '"><i></i>' + s[1] + '</li>'; }).join('');
    var J = { loc: step('loc', getLoc(p)), ter: step('ter', getTer(p)), geo: step('geo', getGeo(p)), flt: step('flt', getFlt(p, Rk)), eq: step('eq', getEq(p, Rk)), cli: step('cli', getCli(p)), soil: step('soil', getSoil(p)), hyd: step('hyd', getHyd(p)), vol: step('vol', getVol(p)) };
    var keys = Object.keys(J);
    Promise.all(keys.map(function (k) { return J[k]; })).then(function (v) {
      var D = { p: p, R: Rk, title: $('#sTitle').value.trim(), when: new Date() }; keys.forEach(function (k, i) { D[k] = v[i]; });
      D.hz = screen(D); R = D; render(D);
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { busy = false; btn.disabled = false; });
  }
  $('#sRun').addEventListener('click', run);

  /* ------------------------------------------------------------------ render */
  var ok = function (x) { return x && !x.err; };
  var na = function (x) { return '<p class="muted small" style="margin:0">' + t('Not available: ', 'غير متاح: ') + E((x && x.err) || '') + '</p>'; };
  var row = function (k, v) { return '<tr><td>' + k + '</td><td>' + v + '</td></tr>'; };
  var lvTag = function (l) { return '<span class="sr-lv sr-l' + (l < 0 ? 'x' : l) + '">' + (l < 0 ? t('No data', 'لا بيانات') : LV[l]) + '</span>'; };
  var kmv = function (v) { return F(v, v < 10 ? 1 : 0) + t(' km', ' كم'); };
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function ageTxt(u) { var a = u.b_int_name === u.t_int_name ? u.b_int_name : u.b_int_name + ' – ' + u.t_int_name; return E(a) + ' <span class="ltr">(' + F(u.b_int_age, u.b_int_age < 10 ? 2 : 1) + '–' + F(u.t_int_age, u.t_int_age < 10 ? 2 : 1) + ' Ma)</span>'; }

  function render(D) {
    $('#sEmpty').hidden = true; $('#sOut').hidden = false;
    var p = D.p, U = SH.toUTM(p.lat, p.lon), lo = D.loc, T = D.ter, Q = D.eq, C = D.cli, S = D.soil, W = D.hyd, Fl = D.flt, V = D.vol, G = D.geo;
    var place = ok(lo) ? [lo.place, lo.region, lo.country].filter(Boolean).join(AR ? '، ' : ', ') : '';
    var top = D.hz.filter(function (h) { return h.lv >= 2; });
    $('#sHead').innerHTML = '<h2>' + E(D.title || place || t('Site report', 'تقرير الموقع')) + '</h2><p>' + (place && D.title ? E(place) + ' · ' : '') + '<span class="ltr">' + SH.fmtLatLon(p.lat, p.lon, 5) + '</span> · ' + D.when.toLocaleDateString(AR ? 'ar-IQ-u-nu-latn' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p>' +
      '<p>' + (top.length ? t('The screening flags ', 'يُظهر الفحص الأولي ') + top.map(function (h) { return '<b>' + h.h + '</b> (' + LV[h.lv] + ')'; }).join(AR ? ' و' : ', ') + t(' as the points that need attention first at this site. The other hazards come out moderate or low on the regional data.', ' بوصفها أول ما يحتاج إلى الانتباه في هذا الموقع، أما المخاطر الأخرى فتظهر متوسطة أو منخفضة بحسب البيانات الإقليمية.') : t('No hazard comes out high on the regional data. Field checks below still apply to any construction or investment.', 'لا يظهر أي خطر مرتفعاً بحسب البيانات الإقليمية، وتبقى الفحوص الحقلية أدناه لازمة لأي إنشاء أو استثمار.')) + '</p>';
    /* KPIs */
    var k = [];
    if (ok(T)) k.push(kpi('info', t('Elevation', 'الارتفاع'), F(T.z, 0) + '<small> ' + t('m', 'م') + '</small>', landform(T)[0]));
    if (ok(T)) k.push(kpi(T.slope >= 15 ? 'warn' : 'ok', t('Slope', 'الانحدار'), F(T.slope, 1) + '<small>°</small>', T.slope < 0.5 ? t('level', 'مستوية') : t('facing ', 'باتجاه ') + dir8(T.aspect)));
    if (ok(Fl)) k.push(kpi(Fl.list[0] && Fl.list[0].d < 20 ? 'warn' : 'ok', t('Nearest active fault', 'أقرب صدع نشط'), Fl.list[0] ? F(Fl.list[0].d, Fl.list[0].d < 10 ? 1 : 0) + '<small> ' + t('km', 'كم') + '</small>' : '> ' + D.R + '<small> ' + t('km', 'كم') + '</small>', Fl.list[0] ? KNAME[Fl.list[0].k] : t('none mapped', 'لا صدع مرسوم')));
    if (ok(Q)) k.push(kpi(Q.n5 > 10 ? 'warn' : 'ok', t('Earthquakes M ≥ 4', 'زلازل بقدر 4 فأكثر'), F(Q.n, 0), Q.max ? t('largest M ', 'الأكبر M ') + F(Q.max.mag, 1) : '—'));
    if (ok(C)) k.push(kpi('info', t('Annual rainfall', 'المطر السنوي'), F(C.P, 0) + '<small> ' + t('mm', 'ملم') + '</small>', F(C.T, 1) + ' °C · ' + C.kg));
    $('#sKpis').innerHTML = k.join('');
    /* matrix */
    $('#sMx').innerHTML = '<thead><tr><th>' + t('Hazard', 'الخطر') + '</th><th>' + t('Level', 'المستوى') + '</th><th>' + t('Why', 'السبب') + '</th></tr></thead><tbody>' + D.hz.map(function (h) { return '<tr><td>' + h.h + '</td><td>' + lvTag(h.lv) + '</td><td class="sr-why">' + (h.why.length ? h.why.map(E).join(AR ? '؛ ' : '; ') : '—') + '</td></tr>'; }).join('') + '</tbody>';
    /* location */
    $('#sLoc').innerHTML = (place ? row(t('Place', 'المكان'), E(place)) : '') + row(t('Latitude, longitude', 'دائرة العرض وخط الطول'), '<span class="ltr">' + p.lat.toFixed(5) + '°, ' + p.lon.toFixed(5) + '°</span>') + row(t('Degrees, minutes, seconds', 'درجات ودقائق وثوانٍ'), '<span class="ltr">' + SH.dms(p.lat, 'N', 'S') + ' ' + SH.dms(p.lon, 'E', 'W') + '</span>') +
      row('UTM (WGS 84)', '<span class="ltr">' + U.zone + U.band + ' · E ' + F(U.E, 0) + ' · N ' + F(U.N, 0) + '</span>');
    /* terrain */
    $('#sTer').innerHTML = ok(T) ? row(t('Ground elevation', 'ارتفاع الأرض'), F(T.z, 0) + t(' m above sea level', ' م فوق سطح البحر')) + row(t('Slope', 'الانحدار'), F(T.slope, 1) + '° (' + F(Math.tan(SH.rad(T.slope)) * 100, 0) + ' %)') + row(t('Facing', 'اتجاه الانحدار'), T.slope < 0.5 ? '—' : dir8(T.aspect) + ' <span class="ltr">(' + F(T.aspect, 0) + '°)</span>') +
      row(t('Relief within 600 m', 'التضرس ضمن 600 م'), F(T.min, 0) + '–' + F(T.max, 0) + t(' m (', ' م (') + F(T.relief, 0) + t(' m)', ' م)')) + row(t('Position in the landscape', 'الموقع في المشهد الأرضي'), landform(T)[0] + ' <span class="xsmall muted">(TPI ' + (T.tpi >= 0 ? '+' : '') + F(T.tpi, 0) + t(' m', ' م') + ')</span>') : '<tr><td colspan="2">' + na(T) + '</td></tr>';
    /* geology */
    if (ok(G)) { var u = G.best, rc = rockClass(G), tags = [];
      if (rc.evap) tags.push(t('soluble evaporites', 'متبخرات قابلة للإذابة')); if (rc.carb) tags.push(t('carbonates', 'كربونات')); if (rc.loose) tags.push(t('loose young deposits', 'رواسب حديثة مفككة')); if (rc.igneous) tags.push(t('igneous rocks', 'صخور نارية')); if (rc.weak && !rc.evap) tags.push(t('weak or clay-rich rocks', 'صخور ضعيفة أو غنية بالطين'));
      $('#sGeo').innerHTML = '<table class="sr-kv">' + row(t('Mapped unit', 'الوحدة المرسومة'), '<b>' + E(u.name || u.strat_name || '—') + '</b>' + (u.strat_name && u.strat_name !== u.name ? '<br><span class="xsmall muted">' + E(u.strat_name) + '</span>' : '')) + row(t('Age', 'العمر'), ageTxt(u)) + (u.lith ? row(t('Rocks', 'الصخور'), E(u.lith)) : '') + (u.descrip ? row(t('Description', 'الوصف'), '<span class="small">' + E(u.descrip.slice(0, 600)) + (u.descrip.length > 600 ? '…' : '') + '</span>') : '') +
        row(t('Map scale', 'مقياس الخريطة'), { large: t('detailed (about 1:100 000)', 'تفصيلي (نحو 1:100000)'), medium: t('regional (about 1:1 000 000)', 'إقليمي (نحو 1:1000000)'), small: t('small (about 1:5 000 000)', 'صغير (نحو 1:5000000)'), tiny: t('global compilation', 'تجميع عالمي') }[u.scale] || E(u.scale || '—')) + (tags.length ? row(t('Engineering character', 'الطبيعة الهندسية'), tags.join(AR ? '، ' : ', ')) : '') + '</table>' +
        (G.all.length > 1 ? '<p class="sr-note">' + t('Other maps at this point: ', 'خرائط أخرى في هذه النقطة: ') + G.all.slice(1).map(function (x) { return E(x.name || x.strat_name) + ' (' + E(x.b_int_name) + ')'; }).join(AR ? '؛ ' : '; ') + '</p>' : '') +
        '<p class="sr-note">' + t('The unit comes from the most detailed map available at this point; boundaries on regional maps can be several hundred metres out, so confirm the rock in the field.', 'الوحدة مأخوذة من أكثر الخرائط تفصيلاً المتوفرة في هذه النقطة، وقد تنحرف الحدود في الخرائط الإقليمية مئات الأمتار، فتحقق من الصخر في الحقل.') + '</p>'; }
    else $('#sGeo').innerHTML = na(G);
    /* faults */
    if (ok(Fl)) { var fl = Fl.list.slice(0, 6);
      $('#sStr').innerHTML = (fl.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + t('Fault', 'الصدع') + '</th><th>' + t('Type', 'النوع') + '</th><th class="num">' + t('Distance', 'المسافة') + '</th><th class="num">' + t('Length', 'الطول') + '</th><th class="num">M<sub>w</sub>*</th></tr></thead><tbody>' + fl.map(function (f) { return '<tr><td>' + E(f.name || t('unnamed', 'بلا اسم')) + '</td><td>' + KNAME[f.k] + '</td><td class="num">' + kmv(f.d) + '</td><td class="num">' + F(f.len, 0) + '</td><td class="num">' + F(f.Mw, 1) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="sr-note">* ' + t('Largest magnitude the mapped length could produce if the whole fault ruptured at once; length in km.', 'أكبر قدر يمكن أن يولده الطول المرسوم لو تمزق الصدع كله دفعة واحدة؛ الطول بالكيلومتر.') + '</p>' : '<p class="small" style="margin:0">' + t('No active fault is mapped within ', 'لا صدع نشط مرسوم ضمن ') + D.R + t(' km. Small or buried faults may still exist.', ' كم. وقد توجد صدوع صغيرة أو مدفونة.') + '</p>') +
        (Fl.nb ? '<p class="sr-note">' + t('Nearest plate boundary: ', 'أقرب حد صفيحي: ') + '<b>' + (PN[Fl.nb.cls] || E(Fl.nb.cls)) + '</b>' + t(' at ', ' على بعد ') + F(Fl.nb.d, 0) + t(' km, relative motion about ', ' كم، والحركة النسبية نحو ') + F(Fl.nb.v, 0) + t(' mm a year.', ' مم في السنة.') + '</p>' : ''); }
    else $('#sStr').innerHTML = na(Fl);
    /* earthquakes */
    if (ok(Q)) { var big = Q.ev.slice(0, 5);
      $('#sSei').innerHTML = '<table class="sr-kv">' + row(t('Earthquakes M ≥ 4 within ', 'زلازل بقدر 4 فأكثر ضمن ') + Q.R + t(' km since 1973', ' كم منذ 1973'), F(Q.n, 0) + (Q.near50 ? t(' (', ' (') + Q.near50 + t(' within 50 km)', ' ضمن 50 كم)') : '')) + row(t('Of magnitude 5 and above', 'منها بقدر 5 فأكثر'), F(Q.n5, 0) + ' · ' + t('about one every ', 'نحو زلزال كل ') + (Q.l5 ? F(1 / Q.l5, 1 / Q.l5 < 10 ? 1 : 0) + t(' years', ' سنة') : '—')) +
        row(t('Chance of M ≥ 5 within the circle in 50 years', 'احتمال زلزال M ≥ 5 داخل الدائرة خلال 50 سنة'), Q.n5 ? F(100 * Q.P5, 0) + ' %' : t('below the record', 'أقل مما يسجله الفهرس')) + row(t('Chance of M ≥ 6 in 50 years', 'احتمال M ≥ 6 خلال 50 سنة'), Q.n6 ? F(100 * Q.P6, 0) + ' %' : t('none recorded since 1973', 'لم يُسجَّل منذ 1973')) +
        (Q.near5 ? row(t('Nearest M ≥ 5', 'أقرب زلزال M ≥ 5'), 'M ' + F(Q.near5.mag, 1) + ' · ' + kmv(Q.near5.d) + ' · ' + new Date(Q.near5.time).getUTCFullYear()) : '') + '</table>' +
        (big.length ? '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>M</th><th>' + t('Date', 'التاريخ') + '</th><th class="num">' + t('Depth km', 'العمق كم') + '</th><th class="num">' + t('Distance km', 'المسافة كم') + '</th></tr></thead><tbody>' + big.map(function (e) { return '<tr><td><b>' + F(e.mag, 1) + '</b></td><td class="ltr">' + new Date(e.time).toISOString().slice(0, 10) + '</td><td class="num">' + F(e.depth, 0) + '</td><td class="num">' + F(e.d, 0) + '</td></tr>'; }).join('') + '</tbody></table></div>' : ''); }
    else $('#sSei').innerHTML = na(Q);
    /* climate */
    if (ok(C)) { var ai = aiClass(C.AI), hot = C.M.reduce(function (a, o, i) { return o.Tx > C.M[a].Tx ? i : a; }, 0), cold = C.M.reduce(function (a, o, i) { return o.Tn < C.M[a].Tn ? i : a; }, 0), MN = AR ? ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var dry = C.M.filter(function (o) { return o.P < 2 * o.T; }).length;
      $('#sCli').innerHTML = '<div class="grid2"><table class="sr-kv">' + row(t('Climate type', 'نوع المناخ'), '<b class="ltr">' + C.kg + '</b> · ' + kgName(C.kg)) + row(t('Mean annual temperature', 'المعدل السنوي للحرارة'), F(C.T, 1) + ' °C') + row(t('Hottest month', 'أحر شهر'), MN[hot] + ' · ' + t('mean maximum ', 'معدل العظمى ') + F(C.M[hot].Tx, 1) + ' °C') + row(t('Coldest month', 'أبرد شهر'), MN[cold] + ' · ' + t('mean minimum ', 'معدل الصغرى ') + F(C.M[cold].Tn, 1) + ' °C') + '</table>' +
        '<table class="sr-kv">' + row(t('Annual rainfall', 'المطر السنوي'), F(C.P, 0) + t(' mm', ' ملم')) + row(t('Reference evapotranspiration', 'التبخر–النتح المرجعي'), F(C.ET, 0) + t(' mm a year', ' ملم سنوياً')) + row(t('Aridity index P / ET₀', 'مؤشر الجفاف P / ET₀'), F(C.AI, 2) + ' · ' + ai[0]) + row(t('Wettest day 1995–2024', 'أغزر يوم 1995–2024'), F(C.maxP.v, 0) + t(' mm on ', ' ملم في ') + '<span class="ltr">' + C.maxP.d + '</span>') + row(t('Days with 10 mm or more', 'أيام بمطر 10 ملم فأكثر'), F(C.wet, 1) + t(' a year', ' في السنة')) + '</table></div>' +
        '<p class="sr-note">' + t('Dry months (rain less than twice the mean temperature): ', 'الأشهر الجافة (المطر أقل من ضعف معدل الحرارة): ') + dry + t(' of 12.', ' من 12.') + '</p>'; }
    else $('#sCli').innerHTML = na(C);
    /* soil */
    if (ok(S)) { var dep = ['0–5', '5–15', '15–30', '30–60', '60–100'], o = S.o, v = function (a, i, f, dg) { return a && a[i] != null ? F(a[i] * f, dg) : '—'; };
      $('#sSoil').innerHTML = '<table class="sr-kv">' + row(t('Texture of the top 30 cm', 'نسجة أعلى 30 سم'), '<b>' + S.tex + '</b> · ' + t('sand ', 'رمل ') + F(S.sand, 0) + '% · ' + t('silt ', 'غرين ') + F(S.silt, 0) + '% · ' + t('clay ', 'طين ') + F(S.clay, 0) + '%') + row('pH (H₂O)', S.ph != null ? F(S.ph, 1) + ' · ' + (S.ph >= 8.5 ? t('strongly alkaline', 'قلوية بشدة') : S.ph >= 7.4 ? t('alkaline', 'قلوية') : S.ph >= 6.6 ? t('neutral', 'متعادلة') : t('acidic', 'حامضية')) : '—') +
        row(t('Organic carbon', 'الكربون العضوي'), S.soc != null ? F(S.soc, 1) + t(' g/kg', ' غم/كغم') : '—') + row(t('Bulk density', 'الكثافة الظاهرية'), S.bd != null ? F(S.bd, 2) + ' g/cm³' : '—') + (S.cf != null ? row(t('Gravel and stones', 'الحصى والحجارة'), F(S.cf, 0) + t('% by volume', '% حجماً')) : '') + '</table>' +
        '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>' + t('Depth cm', 'العمق سم') + '</th><th class="num">' + t('Clay %', 'طين %') + '</th><th class="num">' + t('Sand %', 'رمل %') + '</th><th class="num">pH</th></tr></thead><tbody>' + dep.map(function (dd, i) { return '<tr><td class="ltr">' + dd + '</td><td class="num">' + v(o.clay, i, 0.1, 0) + '</td><td class="num">' + v(o.sand, i, 0.1, 0) + '</td><td class="num">' + v(o.phh2o, i, 1, 1) + '</td></tr>'; }).join('') + '</tbody></table></div>'; }
    else $('#sSoil').innerHTML = na(S);
    /* water and volcanoes */
    var hh = '';
    if (ok(W)) { if (W.none) hh += '<p class="small" style="margin:0">' + t('No river, stream or canal is mapped within 10 km.', 'لا نهر أو جدول أو قناة مرسومة ضمن 10 كم.') + '</p>';
      else { hh += '<table class="sr-kv">' + (W.river ? row(t('Nearest river', 'أقرب نهر'), E(W.river.name || t('unnamed', 'بلا اسم')) + ' · ' + kmv(W.river.d)) : row(t('Nearest river', 'أقرب نهر'), t('none within 10 km', 'لا نهر ضمن 10 كم'))) + (W.stream ? row(t('Nearest stream', 'أقرب جدول'), E(W.stream.name || t('unnamed', 'بلا اسم')) + ' · ' + kmv(W.stream.d)) : '') + (W.canal ? row(t('Nearest canal', 'أقرب قناة'), E(W.canal.name || t('unnamed', 'بلا اسم')) + ' · ' + kmv(W.canal.d)) : '') + (W.lake ? row(t('Nearest lake or reservoir', 'أقرب بحيرة أو خزان'), E(W.lake.name || WK[W.lake.kind] || '') + ' · ' + kmv(W.lake.d)) : '') +
        (W.hab != null ? row(t('Height above the nearest water', 'الارتفاع فوق أقرب مجرى مائي'), F(W.hab, 0) + t(' m (', ' م (') + WK[W.ref.kind] + ')') : '') + '</table>'; } }
    else hh += na(W);
    if (ok(V) && V.near) hh += '<p class="sr-note">' + t('Nearest volcano active since the last ice age: ', 'أقرب بركان نشط منذ آخر عصر جليدي: ') + '<b>' + E(V.near.name) + '</b> (' + E(V.near.country) + ') · ' + E(V.near.type) + ' · ' + F(V.near.d, 0) + t(' km.', ' كم.') + '</p>';
    $('#sHyd').innerHTML = hh;
    /* recommendations and tools */
    recs(D); tools(D);
    /* figures */
    figProf(D); figEq(D); figCli(D); figMap(D).catch(function () { $('#sFigMap').innerHTML = '<p class="muted small" style="padding:12px">' + t('The map could not be drawn.', 'تعذر رسم الخريطة.') + '</p>'; });
    $$('.sr-dl').forEach(function (s) { var f = s.getAttribute('data-fig'); s.innerHTML = ['png', 'jpg', 'pdf'].map(function (x) { return '<button class="btn btn-line btn-xs" type="button" data-dlf="' + f + '" data-fmt="' + x + '">' + x.toUpperCase() + '</button>'; }).join(''); });
    if (map) drawMapLayers(D);
  }

  function recs(D) {
    var H = {}, r = []; D.hz.forEach(function (h) { H[h.k] = h.lv; }); var G = rockClass(D.geo);
    r.push(t('Walk the site and confirm the rock or soil at the surface; the geological map unit is regional and its boundaries may be several hundred metres out.', 'امشِ في الموقع وتحقق من الصخر أو التربة على السطح؛ فالوحدة الجيولوجية من خريطة إقليمية وقد تنحرف حدودها مئات الأمتار.'));
    if (H.eq >= 1) r.push(t('Design to the national seismic code, and classify the ground by shear-wave velocity in the upper 30 m (MASW or a downhole test); soft deep soils amplify shaking.', 'صمّم وفق كود الزلازل الوطني، وصنّف الأرض بسرعة موجة القص في أعلى 30 م (اختبار MASW أو داخل البئر)؛ فالترب الطرية العميقة تضخم الاهتزاز.'));
    if (H.eq >= 2) r.push(t('Check in the field whether the nearest mapped fault shows recent movement (offset terraces, scarps, springs in a line) and keep critical structures off its trace.', 'تحقق في الحقل من وجود حركة حديثة على أقرب صدع مرسوم (مصاطب مزاحة، حافات، ينابيع على خط واحد) وأبعد المنشآت الحرجة عن مساره.'));
    if (H.ls >= 1) r.push(t('Map the joints and bedding on the slope and test them for planar, wedge and toppling failure; look for tension cracks, tilted trees and bulging at the toe.', 'ارسم الفواصل والتطبق على المنحدر وافحصها لانزلاق مستوٍ وإسفيني وانقلابي؛ وابحث عن شقوق الشد والأشجار المائلة وانتفاخ قدم المنحدر.'));
    if (H.fl >= 1) r.push(t('Find the highest flood mark from local people and from debris lines, keep floor levels above it, and leave natural drainage paths open.', 'اعرف أعلى منسوب فيضان من السكان ومن خطوط المخلفات، واجعل مناسيب الأرضيات أعلى منه، واترك مسارات التصريف الطبيعية مفتوحة.'));
    if (H.ka >= 2) r.push(t('Test soil and water for sulphate and gypsum content, use sulphate-resisting cement, and run a resistivity or ground-penetrating radar survey for cavities before building; keep water leaks away from foundations.', 'افحص التربة والماء لمحتوى الكبريتات والجبس، واستخدم إسمنتاً مقاوماً للكبريتات، وأجرِ مسحاً بالمقاومية أو الرادار الأرضي للكشف عن الفجوات قبل البناء، وأبعد تسرب المياه عن الأسس.'));
    else if (H.ka === 1) r.push(t('Carbonate rock can hold solution cavities; probe or drill at each heavy foundation.', 'قد تحوي الصخور الكربوناتية فجوات إذابة؛ اسبر أو احفر عند كل أساس ثقيل.'));
    if (H.so >= 1) r.push(t('Run Atterberg limits, free swell and collapse (wetting) tests on samples from the foundation depth, and measure soluble salts.', 'أجرِ حدود أتربرغ والانتفاخ الحر واختبار الانهيار عند الترطيب على نماذج من عمق الأساس، وقِس الأملاح الذائبة.'));
    if (D.hyd && !D.hyd.err && D.hyd.hab != null && D.hyd.hab < 6) r.push(t('Groundwater is probably shallow; record the water level in trial pits or boreholes and allow for it in excavation and foundation design.', 'المياه الجوفية ضحلة على الأرجح؛ سجّل منسوبها في الحفر الاختبارية أو الآبار وخذه بالحسبان في الحفر وتصميم الأسس.'));
    if (G.loose) r.push(t('Young loose deposits need boreholes with standard penetration tests to find the bearing layer.', 'تحتاج الرواسب الحديثة المفككة إلى آبار مع اختبار الاختراق القياسي لتحديد الطبقة الحاملة.'));
    if (H.ar >= 2) r.push(t('Expect dust storms and high evaporation: protect fresh concrete from rapid drying and plan water supply.', 'توقع العواصف الترابية والتبخر العالي: احمِ الخرسانة الطرية من الجفاف السريع وخطط لتوفير المياه.'));
    r.push(t('Treat this report as a desk study; the levels guide where to look and which tests to order, not the final design values.', 'عامل هذا التقرير دراسة مكتبية؛ فالمستويات ترشد إلى أين تنظر وأي الفحوص تطلب، وليست قيماً نهائية للتصميم.'));
    $('#sRec').innerHTML = r.map(function (x) { return '<li>' + x + '</li>'; }).join('');
  }
  var TL = { 'seismic-hazard': ['Seismic hazard', 'الخطر الزلزالي'], 'seismic-evaluation': ['Seismic evaluation', 'التقييم الزلزالي'], 'faults-plates': ['Faults and plates atlas', 'أطلس الصدوع والصفائح'], 'geologic-unit': ['Geologic unit', 'الوحدة الجيولوجية'], 'landslide-susceptibility': ['Landslide susceptibility', 'قابلية الانهيالات'], 'stereonet-lab': ['Stereonet lab', 'مختبر الإسقاط المجسم'], 'hydro-alert': ['Hydrological alert', 'الإنذار الهيدرولوجي'], 'soil-properties': ['Soil properties', 'خصائص التربة'], 'atterberg-limits': ['Atterberg limits', 'حدود أتربرغ'], 'bearing-capacity': ['Bearing capacity', 'قابلية التحمل'], 'geomorphology-contour': ['Geomorphology and contours', 'الجيومورفولوجيا والكنتور'], 'iraq-time-machine': ['Iraq Time Machine', 'آلة الزمن للعراق'] };
  function tools(D) {
    var H = {}; D.hz.forEach(function (h) { H[h.k] = h.lv; }); var s = ['geologic-unit', 'geomorphology-contour'];
    if (H.eq >= 1) s.push('seismic-hazard', 'seismic-evaluation', 'faults-plates'); if (H.ls >= 1) s.push('landslide-susceptibility', 'stereonet-lab'); if (H.fl >= 1) s.push('hydro-alert'); if (H.so >= 1 || H.ka >= 1) s.push('soil-properties', 'atterberg-limits'); s.push('bearing-capacity');
    if (D.loc && D.loc.cc === 'IQ') s.push('iraq-time-machine');
    $('#sTools').innerHTML = s.filter(function (x, i) { return s.indexOf(x) === i; }).map(function (k) { return '<a class="btn btn-line btn-xs" href="' + SH.base + (AR ? 'ar/' : '') + 'tools/' + k + '/app/">' + t(TL[k][0], TL[k][1]) + '</a>'; }).join('');
  }

  /* ------------------------------------------------------------------ live map layers */
  var lay = null;
  function drawMapLayers(D) {
    if (lay) map.removeLayer(lay); lay = L.layerGroup().addTo(map); var p = D.p;
    L.circle([p.lat, p.lon], { radius: D.R * 1000, color: GOLD, weight: 1.5, fill: false, dashArray: '6 5', interactive: false }).addTo(lay);
    if (ok(D.flt)) D.flt.list.forEach(function (f) { var ll = []; for (var i = 0; i + 1 < f.c.length; i += 2) ll.push([f.c[i + 1], f.c[i]]); L.polyline(ll, { color: KCOL[f.k], weight: 2 }).bindTooltip((f.name || t('unnamed', 'بلا اسم')) + ' · ' + KNAME[f.k]).addTo(lay); });
    if (ok(D.eq)) D.eq.ev.slice(0, 400).forEach(function (e) { L.circleMarker([e.lat, e.lon], { radius: 2 + (e.mag - 4) * 2.4, color: '#5a2a00', weight: .8, fillColor: '#F08C2E', fillOpacity: .7 }).bindTooltip('M ' + F(e.mag, 1) + ' · ' + new Date(e.time).getUTCFullYear()).addTo(lay); });
    map.fitBounds(L.circle([p.lat, p.lon], { radius: D.R * 1000 }).addTo(lay).setStyle({ opacity: 0, fill: false }).getBounds(), { padding: [6, 6] });
  }

  /* ------------------------------------------------------------------ SVG helpers */
  var tx = function (x, y, s, a) { a = a || {}; return '<text x="' + x + '" y="' + y + '" font-family="' + PF + '" font-size="' + (a.fs || 12) + '" fill="' + (a.fill || INK) + '"' + (a.anchor ? ' text-anchor="' + a.anchor + '"' : '') + (a.fw ? ' font-weight="' + a.fw + '"' : '') + (a.rot ? ' transform="rotate(' + a.rot + ' ' + x + ' ' + y + ')"' : '') + ' direction="ltr">' + E(s) + '</text>'; };
  var nice = function (lo, hi, n) { var r = (hi - lo) / (n || 5), p10 = Math.pow(10, Math.floor(Math.log10(r))), m = r / p10, st = (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p10; return st; };
  function ticks(lo, hi, st) { var a = []; for (var v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) a.push(+v.toFixed(6)); return a; }

  function figProf(D) {
    var T = D.ter, svg = $('#sProf'); if (!ok(T)) { svg.innerHTML = tx(450, 190, 'Terrain data not available', { anchor: 'middle', fill: MUT }); return; }
    var all = T.we.concat(T.sn), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = Math.max(10, (hi - lo) * 0.15); lo -= pad; hi += pad; var st = nice(lo, hi, 4); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    var X0 = 80, PW = 790, PH = 120, o = '<rect width="900" height="380" fill="#fff"/>';
    var ve = (6000 / PW) / ((hi - lo) / PH);
    [[T.we, 'W', 'E', 'West – east profile', 20], [T.sn, 'S', 'N', 'South – north profile', 190]].forEach(function (q) {
      var Y0 = q[4] + 18, px = function (i) { return X0 + i / 49 * PW; }, py = function (z) { return Y0 + (hi - z) / (hi - lo) * PH; };
      o += tx(X0, q[4] + 10, q[3], { fw: 800, fs: 13 });
      ticks(lo, hi, st).forEach(function (v) { var y = py(v); o += '<line x1="' + X0 + '" x2="' + (X0 + PW) + '" y1="' + y + '" y2="' + y + '" stroke="#E3E6E8"/>' + tx(X0 - 8, y + 4, F(v, 0), { anchor: 'end', fs: 11, fill: MUT }); });
      [-3, -2, -1, 0, 1, 2, 3].forEach(function (k) { var x = X0 + (k + 3) / 6 * PW; o += '<line x1="' + x + '" x2="' + x + '" y1="' + (Y0 + PH) + '" y2="' + (Y0 + PH + 5) + '" stroke="' + INK + '"/>' + tx(x, Y0 + PH + 18, String(k), { anchor: 'middle', fs: 11 }); });
      var d = q[0].map(function (z, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(z).toFixed(1); }).join('');
      o += '<path d="' + d + 'L' + (X0 + PW) + ' ' + (Y0 + PH) + 'L' + X0 + ' ' + (Y0 + PH) + 'Z" fill="#D9C7A1" opacity=".75"/><path d="' + d + '" fill="none" stroke="#6B4F2A" stroke-width="2"/>';
      o += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + PW + '" height="' + PH + '" fill="none" stroke="' + INK + '"/>';
      var zc = q[0][24] * 0.5 + q[0][25] * 0.5; o += '<line x1="' + (X0 + PW / 2) + '" x2="' + (X0 + PW / 2) + '" y1="' + Y0 + '" y2="' + (Y0 + PH) + '" stroke="#C0392B" stroke-dasharray="4 3"/><path d="M' + (X0 + PW / 2) + ' ' + (py(zc) - 4) + 'l-6 -11h12z" fill="#C0392B"/>';
      o += tx(X0 + 6, Y0 + 15, q[1], { fw: 800 }) + tx(X0 + PW - 6, Y0 + 15, q[2], { fw: 800, anchor: 'end' });
    });
    o += tx(X0 + PW / 2, 352, 'Distance from the site (km)', { anchor: 'middle', fs: 12, fw: 700 }) + tx(22, 190, 'Elevation (m a.s.l.)', { anchor: 'middle', fs: 12, fw: 700, rot: -90 });
    o += tx(X0, 372, 'Red triangle and dashed line: the site. Vertical exaggeration × ' + F(ve, ve < 10 ? 1 : 0) + '. Ground from a 90 m elevation model.', { fs: 11, fill: MUT });
    svg.innerHTML = o;
    $('#sProfCap').textContent = t('Ground along two 6 km lines crossing at the site. The relief shows whether the site sits on a crest, a slope or a valley floor; the vertical scale is stretched ×', 'الأرض على امتداد خطين طول كل منهما 6 كم يتقاطعان في الموقع. يبين التضرس إن كان الموقع على قمة أو منحدر أو قاع وادٍ؛ والمقياس الرأسي مضخم ×') + F(ve, ve < 10 ? 1 : 0) + t(' so that gentle slopes can be read.', ' لتُقرأ المنحدرات اللطيفة.');
  }

  function figEq(D) {
    var Q = D.eq, svg = $('#sEq'); if (!ok(Q) || !Q.ev.length) { svg.innerHTML = '<rect width="900" height="400" fill="#fff"/>' + tx(450, 200, ok(Q) ? 'No earthquake of M ≥ 4 recorded within ' + D.R + ' km since 1973' : 'Earthquake data not available', { anchor: 'middle', fill: MUT }); $('#sEqCap').textContent = ''; return; }
    svg.setAttribute('viewBox', '0 0 900 410'); var X0 = 70, Y0 = 20, PW = 800, PH = 290, mmax = Math.max(6, Math.ceil(Q.max.mag * 2) / 2 + 0.5), y1 = 1973, y2 = new Date().getUTCFullYear() + 1, o = '<rect width="900" height="410" fill="#fff"/>';
    var px = function (yr) { return X0 + (yr - y1) / (y2 - y1) * PW; }, py = function (m) { return Y0 + (mmax - m) / (mmax - 4) * PH; };
    ticks(4, mmax, 0.5).forEach(function (v) { var y = py(v); o += '<line x1="' + X0 + '" x2="' + (X0 + PW) + '" y1="' + y + '" y2="' + y + '" stroke="#E3E6E8"/>' + tx(X0 - 8, y + 4, F(v, 1), { anchor: 'end', fs: 11, fill: MUT }); });
    ticks(1975, y2, 5).forEach(function (v) { var x = px(v); o += '<line x1="' + x + '" x2="' + x + '" y1="' + (Y0 + PH) + '" y2="' + (Y0 + PH + 5) + '" stroke="' + INK + '"/>' + tx(x, Y0 + PH + 18, String(v), { anchor: 'middle', fs: 11 }); });
    var dc = function (d) { return d <= 50 ? '#C0392B' : d <= 100 ? '#E67E22' : '#2E6FBF'; };
    Q.ev.slice().reverse().forEach(function (e) { var yr = new Date(e.time).getUTCFullYear() + new Date(e.time).getUTCMonth() / 12; o += '<circle cx="' + px(yr).toFixed(1) + '" cy="' + py(e.mag).toFixed(1) + '" r="' + (2 + (e.mag - 4) * 2.2).toFixed(1) + '" fill="' + dc(e.d) + '" fill-opacity=".55" stroke="' + dc(e.d) + '" stroke-width=".8"/>'; });
    o += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + PW + '" height="' + PH + '" fill="none" stroke="' + INK + '"/>';
    o += tx(X0 + PW / 2, Y0 + PH + 40, 'Year', { anchor: 'middle', fw: 700 }) + tx(20, Y0 + PH / 2, 'Magnitude (M)', { anchor: 'middle', fw: 700, rot: -90 });
    var lx = X0, ly = 378; [['≤ 50 km from the site', '#C0392B'], ['50–100 km', '#E67E22'], ['> 100 km', '#2E6FBF']].forEach(function (q) { o += '<circle cx="' + (lx + 6) + '" cy="' + (ly - 4) + '" r="6" fill="' + q[1] + '" fill-opacity=".55" stroke="' + q[1] + '"/>' + tx(lx + 18, ly, q[0], { fs: 11.5 }); lx += 190; });
    o += tx(X0, ly + 20, 'Circle size grows with magnitude. M ≥ 4, since 1973, within ' + D.R + ' km of the site.', { fs: 11, fill: MUT });
    svg.innerHTML = o;
    $('#sEqCap').textContent = t('Every recorded earthquake of magnitude 4 or more inside the circle, by year and magnitude; colour gives the distance from the site. Clusters mark sequences on the same fault; the record before about 1990 misses some events near M 4.', 'كل زلزال مسجل بقدر 4 فأكثر داخل الدائرة بحسب السنة والقدر؛ ويدل اللون على البعد عن الموقع. تشير التجمعات إلى متواليات على الصدع نفسه، والسجل قبل نحو 1990 ينقصه بعض الأحداث قرب القدر 4.');
  }

  function figCli(D) {
    var C = D.cli, svg = $('#sClim'); if (!ok(C)) { svg.innerHTML = '<rect width="900" height="420" fill="#fff"/>' + tx(450, 210, 'Climate data not available', { anchor: 'middle', fill: MUT }); return; }
    var X0 = 80, Y0 = 46, PW = 740, PH = 290, M = C.M, Tn = Math.min(0, Math.min.apply(null, M.map(function (o) { return o.Tn; }))), Tx = Math.max.apply(null, M.map(function (o) { return o.Tx; })), Pm = Math.max.apply(null, M.map(function (o) { return o.P; }));
    var tlo = Math.floor(Tn / 10) * 10, thi = Math.max(Math.ceil(Tx / 10) * 10, Math.ceil(Pm / 2 / 10) * 10), py = function (tc) { return Y0 + (thi - tc) / (thi - tlo) * PH; }, bw = PW / 12, o = '<rect width="900" height="420" fill="#fff"/>';
    o += tx(X0, 26, 'Mean annual temperature ' + F(C.T, 1) + ' °C · Annual rainfall ' + F(C.P, 0) + ' mm · ET0 ' + F(C.ET, 0) + ' mm · Köppen–Geiger ' + C.kg + ' · 1995–2024', { fw: 800, fs: 13 });
    ticks(tlo, thi, 10).forEach(function (v) { var y = py(v); o += '<line x1="' + X0 + '" x2="' + (X0 + PW) + '" y1="' + y + '" y2="' + y + '" stroke="#E3E6E8"/>' + tx(X0 - 8, y + 4, String(v), { anchor: 'end', fs: 11, fill: '#C0392B' }) + tx(X0 + PW + 8, y + 4, String(v * 2), { fs: 11, fill: '#2E6FBF' }); });
    M.forEach(function (m, i) { var x = X0 + i * bw, dry = m.P < 2 * m.T; if (dry) o += '<rect x="' + x + '" y="' + py(m.T) + '" width="' + bw + '" height="' + Math.max(0, py(m.P / 2) - py(m.T)) + '" fill="#F3D9A4" opacity=".7"/>'; o += '<rect x="' + (x + bw * .2) + '" y="' + py(m.P / 2) + '" width="' + bw * .6 + '" height="' + Math.max(0, py(0) - py(m.P / 2)) + '" fill="#2E6FBF" opacity=".8"/>'; o += tx(x + bw / 2, Y0 + PH + 18, 'JFMAMJJASOND'[i], { anchor: 'middle', fs: 12, fw: 700 }); });
    var line = function (k, col, dash, w) { return '<path d="' + M.map(function (m, i) { return (i ? 'L' : 'M') + (X0 + (i + .5) * bw).toFixed(1) + ' ' + py(k === 'E' ? m.E / 2 : m[k]).toFixed(1); }).join('') + '" fill="none" stroke="' + col + '" stroke-width="' + (w || 2) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'; };
    o += line('Tx', '#C0392B', '5 4', 1.4) + line('Tn', '#C0392B', '2 3', 1.4) + line('T', '#C0392B', '', 2.6);
    if (tlo < 0) o += '<line x1="' + X0 + '" x2="' + (X0 + PW) + '" y1="' + py(0) + '" y2="' + py(0) + '" stroke="' + INK + '" stroke-width=".8"/>';
    o += '<rect x="' + X0 + '" y="' + Y0 + '" width="' + PW + '" height="' + PH + '" fill="none" stroke="' + INK + '"/>';
    o += tx(22, Y0 + PH / 2, 'Temperature (°C)', { anchor: 'middle', fw: 700, rot: -90, fill: '#C0392B' }) + tx(882, Y0 + PH / 2, 'Precipitation (mm / month)', { anchor: 'middle', fw: 700, rot: 90, fill: '#2E6FBF' });
    var lx = X0, ly = 396, it = [['bar', '#2E6FBF', 'P: precipitation'], ['line', '#C0392B', 'T: mean temperature'], ['dash', '#C0392B', 'Tmax / Tmin: mean daily maximum / minimum'], ['area', '#F3D9A4', 'Dry months (P < 2T)']];
    it.forEach(function (q, i) { var x = lx + (i % 3) * 250, y = ly + Math.floor(i / 3) * 18; o += q[0] === 'bar' || q[0] === 'area' ? '<rect x="' + x + '" y="' + (y - 10) + '" width="16" height="10" fill="' + q[1] + '"/>' : '<line x1="' + x + '" x2="' + (x + 18) + '" y1="' + (y - 5) + '" y2="' + (y - 5) + '" stroke="' + q[1] + '" stroke-width="2"' + (q[0] === 'dash' ? ' stroke-dasharray="5 4"' : q[0] === 'dash2' ? ' stroke-dasharray="8 4"' : '') + '/>'; o += tx(x + 24, y, q[2], { fs: 11 }); });
    svg.setAttribute('viewBox', '0 0 900 ' + (ly + 26)); o = o.replace('<rect width="900" height="420"', '<rect width="900" height="' + (ly + 26) + '"');
    svg.innerHTML = o;
    $('#sClimCap').textContent = t('Monthly normals of 1995–2024 drawn on the Walter–Lieth scale (20 mm of rain for every 10 °C). Where the rain bar falls below the temperature line the month is dry; ET0 in the title is the yearly reference evapotranspiration, the water that a grass cover would lose if it never ran short.', 'المعدلات الشهرية للفترة 1995–2024 مرسومة بمقياس والتر–ليث (20 ملم مطر لكل 10 °م). حيثما ينخفض عمود المطر تحت خط الحرارة يكون الشهر جافاً، وET0 في العنوان هو التبخر–النتح المرجعي السنوي، أي الماء الذي يفقده غطاء عشبي لو لم ينقصه الماء أبداً.');
  }

  /* ------------------------------------------------------------------ location map (canvas) */
  var imgCache = {};
  function tile(u) { return imgCache[u] || (imgCache[u] = new Promise(function (res) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = u; })); }
  var mapCanvas = null;
  function figMap(D) {
    var p = D.p, S = 2, W = 900 * S, PW = 760 * S, PH = 600 * S, X0 = 70 * S, Y0 = 70 * S, half = D.R * 1.12 * 1000;
    var mppT = 2 * half / PW, z = Math.max(2, Math.min(13, Math.floor(Math.log2(156543.03 * Math.cos(SH.rad(p.lat)) / mppT)))), n = 256 * Math.pow(2, z), k = 156543.03 * Math.cos(SH.rad(p.lat)) / Math.pow(2, z) / mppT;
    var WX = function (lo) { return (lo + 180) / 360 * n; }, WY = function (la) { var r = SH.rad(la); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n; }, cx = WX(p.lon), cy = WY(p.lat);
    var X = function (lo) { return X0 + PW / 2 + (WX(lo) - cx) * k; }, Y = function (la) { return Y0 + PH / 2 + (WY(la) - cy) * k; };
    var LO = function (xx) { return ((xx - X0 - PW / 2) / k + cx) / n * 360 - 180; }, LA = function (yy) { var m = ((yy - Y0 - PH / 2) / k + cy) / n; return SH.deg(Math.atan(Math.sinh(Math.PI * (1 - 2 * m)))); };
    var tx0 = Math.floor((cx - PW / 2 / k) / 256), tx1 = Math.floor((cx + PW / 2 / k) / 256), ty0 = Math.floor((cy - PH / 2 / k) / 256), ty1 = Math.floor((cy + PH / 2 / k) / 256), jobs = [];
    for (var a = tx0; a <= tx1; a++) for (var b = ty0; b <= ty1; b++) (function (a1, b1) { var nt = Math.pow(2, z), aw = ((a1 % nt) + nt) % nt; jobs.push(tile('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/' + z + '/' + b1 + '/' + aw).then(function (im) { return { im: im, a: a1, b: b1 }; })); })(a, b);
    return Promise.all(jobs).then(function (T) {
      var cv = document.createElement('canvas'), lg = legendItems(D), legH = (Math.ceil(lg.length / 3) * 24 + 36) * S; cv.width = W; cv.height = Y0 + PH + 70 * S + legH; var g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.save(); g.beginPath(); g.rect(X0, Y0, PW, PH); g.clip(); g.fillStyle = '#EDEDEA'; g.fillRect(X0, Y0, PW, PH);
      T.forEach(function (q) { if (q.im) g.drawImage(q.im, X0 + PW / 2 + (q.a * 256 - cx) * k, Y0 + PH / 2 + (q.b * 256 - cy) * k, 256 * k + 1, 256 * k + 1); });
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(X0, Y0, PW, PH);
      var poly = function (c, col, w, dash) { g.beginPath(); for (var i = 0; i + 1 < c.length; i += 2) { var xx = X(c[i]), yy = Y(c[i + 1]); if (i && Math.abs(c[i] - c[i - 2]) > 180) g.moveTo(xx, yy); else if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); } g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); };
      if (ok(D.flt)) { D.flt.P.forEach(function (q) { var c = q[3], inb = false; for (var i = 0; i + 1 < c.length; i += 2) if (Math.abs(c[i + 1] - p.lat) < 8 && Math.abs(c[i] - p.lon) < 10) { inb = true; break; } if (inb) poly(c, '#7A4F9A', 4 * S, [10 * S, 5 * S]); }); D.flt.list.forEach(function (f) { poly(f.c, KCOL[f.k], 1.8 * S); }); }
      if (ok(D.eq)) D.eq.ev.slice().reverse().forEach(function (e) { g.beginPath(); g.arc(X(e.lon), Y(e.lat), (2 + (e.mag - 4) * 2.4) * S, 0, 7); g.fillStyle = 'rgba(240,140,46,.65)'; g.fill(); g.lineWidth = .8 * S; g.strokeStyle = '#5a2a00'; g.stroke(); });
      if (ok(D.vol)) D.vol.list.forEach(function (v) { var xx = X(v.lon), yy = Y(v.lat); if (xx < X0 || xx > X0 + PW || yy < Y0 || yy > Y0 + PH) return; g.beginPath(); g.moveTo(xx, yy - 9 * S); g.lineTo(xx + 8 * S, yy + 6 * S); g.lineTo(xx - 8 * S, yy + 6 * S); g.closePath(); g.fillStyle = '#8E1B1B'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = S; g.stroke(); });
      var rpx = D.R * 1000 / mppT; g.beginPath(); g.arc(X0 + PW / 2, Y0 + PH / 2, rpx, 0, 7); g.setLineDash([9 * S, 6 * S]); g.strokeStyle = GOLD; g.lineWidth = 2.2 * S; g.stroke(); g.setLineDash([]);
      star(g, X0 + PW / 2, Y0 + PH / 2, 13 * S, '#E8B400');
      g.restore();
      /* neat line, graticule, north arrow, scale */
      g.strokeStyle = INK; g.lineWidth = 1.6 * S; g.strokeRect(X0, Y0, PW, PH); g.lineWidth = .8 * S; g.strokeRect(X0 - 6 * S, Y0 - 6 * S, PW + 12 * S, PH + 12 * S);
      g.fillStyle = INK; g.font = '800 ' + 17 * S + 'px ' + PF; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; var nm0 = D.title || (ok(D.loc) ? [D.loc.place, D.loc.country].filter(Boolean).join(', ') : ''); g.fillText(nm0 && !/[\u0600-\u06FF]/.test(nm0) ? ('Site location: ' + nm0).slice(0, 90) : 'Site location', X0 - 6 * S, 30 * S);
      g.font = '500 ' + 12 * S + 'px ' + PF; g.fillStyle = MUT; g.fillText(SH.fmtLatLon(p.lat, p.lon, 4) + ' · WGS 84 · Web Mercator', X0 - 6 * S, 50 * S);
      var w0 = LO(X0), e0 = LO(X0 + PW), n0 = LA(Y0), s0 = LA(Y0 + PH), gs = [0.25, 0.5, 1, 2, 5], st = gs.filter(function (v) { return (e0 - w0) / v <= 6; })[0] || 5, dm = function (v, ax) { var aa = Math.abs(v), dd = Math.floor(aa + 1e-9), mm = Math.round((aa - dd) * 60); if (mm === 60) { dd++; mm = 0; } return dd + '°' + (mm < 10 ? '0' : '') + mm + '′' + (ax ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); };
      g.font = '500 ' + 11.5 * S + 'px ' + PF; g.fillStyle = INK; g.lineWidth = S;
      for (var lo = Math.ceil(w0 / st) * st; lo <= e0; lo += st) { var xx = X(lo); if (xx < X0 + 30 * S || xx > X0 + PW - 30 * S) continue; g.beginPath(); g.moveTo(xx, Y0 - 6 * S); g.lineTo(xx, Y0); g.moveTo(xx, Y0 + PH); g.lineTo(xx, Y0 + PH + 6 * S); g.stroke(); g.textAlign = 'center'; g.fillText(dm(lo, 0), xx, Y0 + PH + 22 * S); }
      for (var la = Math.ceil(s0 / st) * st; la <= n0; la += st) { var yy = Y(la); if (yy < Y0 + 20 * S || yy > Y0 + PH - 20 * S) continue; g.beginPath(); g.moveTo(X0 - 6 * S, yy); g.lineTo(X0, yy); g.moveTo(X0 + PW, yy); g.lineTo(X0 + PW + 6 * S, yy); g.stroke(); g.save(); g.translate(X0 - 14 * S, yy); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(dm(la, 1), 0, 0); g.restore(); }
      /* north arrow, top right inside the frame */
      var nx = X0 + PW - 34 * S, ny = Y0 + 22 * S; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(nx - 20 * S, ny - 14 * S, 40 * S, 66 * S); g.beginPath(); g.moveTo(nx, ny + 4 * S); g.lineTo(nx - 11 * S, ny + 44 * S); g.lineTo(nx, ny + 35 * S); g.closePath(); g.fillStyle = INK; g.fill(); g.beginPath(); g.moveTo(nx, ny + 4 * S); g.lineTo(nx + 11 * S, ny + 44 * S); g.lineTo(nx, ny + 35 * S); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2 * S; g.stroke();
      g.fillStyle = INK; g.font = '800 ' + 14 * S + 'px ' + PF; g.textAlign = 'center'; g.fillText('N', nx, ny + 0 * S);
      /* scale bar */
      var want = D.R * 0.6, p10 = Math.pow(10, Math.floor(Math.log10(want))), mq = want / p10, len = (mq >= 5 ? 5 : mq >= 2 ? 2 : 1) * p10, spx = len * 1000 / mppT, sx = X0, sy = Y0 + PH + 40 * S;
      for (var i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff' : INK; g.fillRect(sx + i * spx / 4, sy, spx / 4, 7 * S); } g.strokeStyle = INK; g.lineWidth = .9 * S; g.strokeRect(sx, sy, spx, 7 * S);
      g.fillStyle = INK; g.font = '600 ' + 11 * S + 'px ' + PF; g.textAlign = 'center'; [0, .5, 1].forEach(function (f) { g.fillText(F(len * f, 0), sx + spx * f, sy - 4 * S); }); g.textAlign = 'left'; g.fillText('km', sx + spx + 8 * S, sy + 8 * S);
      g.fillStyle = MUT; g.textAlign = 'right'; g.font = '500 ' + 10.5 * S + 'px ' + PF; g.fillText('Scale true at the site latitude', X0 + PW, sy + 8 * S);
      /* legend below the map */
      var ly = Y0 + PH + 76 * S; g.textAlign = 'left'; g.fillStyle = INK; g.font = '800 ' + 12.5 * S + 'px ' + PF; g.fillText('Legend', X0, ly); ly += 20 * S;
      lg.forEach(function (it, i2) { var lx = X0 + (i2 % 3) * (PW / 3), yy = ly + Math.floor(i2 / 3) * 24 * S; it.draw(g, lx + 10 * S, yy - 4 * S, S); g.fillStyle = INK; g.font = '500 ' + 11.5 * S + 'px ' + PF; g.textAlign = 'left'; g.fillText(it.t, lx + 26 * S, yy); });
      mapCanvas = cv; var url = cv.toDataURL('image/jpeg', .9); $('#sFigMap').innerHTML = '<img alt="" src="' + url + '">';
      $('#sFigMapCap').textContent = t('The site (star) with the earthquakes of magnitude 4 and above since 1973 inside the dashed circle of ', 'الموقع (النجمة) مع زلازل القدر 4 فأكثر منذ 1973 داخل الدائرة المتقطعة بنصف قطر ') + D.R + t(' km, the active faults coloured by their sense of movement and the nearest plate boundary. Faults that line up with clusters of earthquakes are the likely sources of future shaking at the site.', ' كم، والصدوع النشطة ملونة بحسب نوع حركتها، وأقرب حد صفيحي. الصدوع التي تصطف مع تجمعات الزلازل هي المصادر المرجحة للاهتزاز المستقبلي في الموقع.');
    });
  }
  function star(g, x, y, r, col) { g.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = r * .14; g.strokeStyle = '#1B232B'; g.stroke(); }
  function legendItems(D) {
    var it = [{ t: 'Site', draw: function (g, x, y, S) { star(g, x, y, 8 * S, '#E8B400'); } }, { t: 'Search radius ' + D.R + ' km', draw: function (g, x, y, S) { g.setLineDash([6 * S, 4 * S]); g.strokeStyle = GOLD; g.lineWidth = 2 * S; g.beginPath(); g.moveTo(x - 9 * S, y); g.lineTo(x + 9 * S, y); g.stroke(); g.setLineDash([]); } },
      { t: 'Earthquake M ≥ 4 (size ∝ M)', draw: function (g, x, y, S) { g.beginPath(); g.arc(x, y, 6 * S, 0, 7); g.fillStyle = 'rgba(240,140,46,.65)'; g.fill(); g.strokeStyle = '#5a2a00'; g.lineWidth = .8 * S; g.stroke(); } }];
    var used = {}; if (ok(D.flt)) D.flt.list.forEach(function (f) { used[f.k] = 1; });
    ['R', 'N', 'SS', 'U'].forEach(function (kk) { if (used[kk]) it.push({ t: KEN[kk], draw: function (g, x, y, S) { g.strokeStyle = KCOL[kk]; g.lineWidth = 2.4 * S; g.beginPath(); g.moveTo(x - 9 * S, y); g.lineTo(x + 9 * S, y); g.stroke(); } }); });
    it.push({ t: 'Plate boundary', draw: function (g, x, y, S) { g.setLineDash([8 * S, 4 * S]); g.strokeStyle = '#7A4F9A'; g.lineWidth = 3 * S; g.beginPath(); g.moveTo(x - 9 * S, y); g.lineTo(x + 9 * S, y); g.stroke(); g.setLineDash([]); } });
    if (ok(D.vol) && D.vol.near && D.vol.near.d < D.R * 1.5) it.push({ t: 'Holocene volcano', draw: function (g, x, y, S) { g.beginPath(); g.moveTo(x, y - 8 * S); g.lineTo(x + 7 * S, y + 5 * S); g.lineTo(x - 7 * S, y + 5 * S); g.closePath(); g.fillStyle = '#8E1B1B'; g.fill(); } });
    return it;
  }

  /* ------------------------------------------------------------------ downloads */
  function fname(x) { return 'shandal-site-' + x + '-' + (R ? R.p.lat.toFixed(3) + '_' + R.p.lon.toFixed(3) : ''); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-dlf]'); if (!b || !R) return; var f = b.getAttribute('data-dlf'), fmt = b.getAttribute('data-fmt'); b.disabled = true;
    var job = f === 'map' ? (mapCanvas ? SH.exportCanvas(mapCanvas, fname('map'), fmt) : Promise.reject(new Error(t('The map is not ready yet.', 'الخريطة غير جاهزة بعد.')))) : SH.exportFigure($(f === 'prof' ? '#sProf' : f === 'eq' ? '#sEq' : '#sClim'), fname(f === 'prof' ? 'profiles' : f === 'eq' ? 'earthquakes' : 'climate'), fmt);
    Promise.resolve(job).catch(function (er) { SH.toast(er.message, 'bad'); }).then(function () { b.disabled = false; });
  });
  function flat() {
    var D = R, a = [['field', 'value']], p = D.p, add = function (k, v) { if (v != null && v !== '' && !(typeof v === 'number' && !isFinite(v))) a.push([k, typeof v === 'number' ? +v.toFixed(4) : v]); };
    add('title', D.title); add('latitude', p.lat); add('longitude', p.lon); if (ok(D.loc)) add('place', [D.loc.place, D.loc.region, D.loc.country].filter(Boolean).join(', '));
    if (ok(D.ter)) { add('elevation_m', D.ter.z); add('slope_deg', D.ter.slope); add('aspect_deg', D.ter.aspect); add('relief_600m_m', D.ter.relief); add('tpi_m', D.ter.tpi); add('landform', landform(D.ter)[0]); }
    if (ok(D.geo)) { var u = D.geo.best; add('geologic_unit', u.name || u.strat_name); add('lithology', u.lith); add('age', u.b_int_name + ' - ' + u.t_int_name); add('age_base_Ma', u.b_int_age); add('age_top_Ma', u.t_int_age); }
    if (ok(D.flt)) { var f = D.flt.list[0]; if (f) { add('nearest_fault_name', f.name); add('nearest_fault_type', f.type); add('nearest_fault_km', f.d); add('nearest_fault_length_km', f.len); add('nearest_fault_Mw_max', f.Mw); } if (D.flt.nb) { add('plate_boundary_km', D.flt.nb.d); add('plate_boundary_class', D.flt.nb.cls); } }
    if (ok(D.eq)) { add('eq_radius_km', D.eq.R); add('eq_M4_count_since_1973', D.eq.n); add('eq_M5_count', D.eq.n5); add('eq_M6_count', D.eq.n6); add('eq_M5_P50yr', D.eq.P5); if (D.eq.max) add('eq_largest_M', D.eq.max.mag); }
    if (ok(D.cli)) { add('climate_koppen', D.cli.kg); add('mean_annual_T_C', D.cli.T); add('annual_P_mm', D.cli.P); add('annual_ET0_mm', D.cli.ET); add('aridity_index', D.cli.AI); add('max_daily_P_mm', D.cli.maxP.v); add('max_daily_P_date', D.cli.maxP.d); D.cli.M.forEach(function (m, i) { add('month' + (i + 1) + '_T_P_ET0', F(m.T, 1) + ' / ' + F(m.P, 0) + ' / ' + F(m.E, 0)); }); }
    if (ok(D.soil)) { add('soil_texture', D.soil.tex); add('soil_clay_pct', D.soil.clay); add('soil_sand_pct', D.soil.sand); add('soil_silt_pct', D.soil.silt); add('soil_pH', D.soil.ph); add('soil_SOC_g_kg', D.soil.soc); }
    if (ok(D.hyd) && !D.hyd.none) { if (D.hyd.river) { add('nearest_river', D.hyd.river.name); add('nearest_river_km', D.hyd.river.d); } add('height_above_water_m', D.hyd.hab); }
    if (ok(D.vol) && D.vol.near) { add('nearest_volcano', D.vol.near.name); add('nearest_volcano_km', D.vol.near.d); }
    D.hz.forEach(function (h) { add('hazard_' + h.k, h.lv < 0 ? 'no data' : ['low', 'moderate', 'high', 'very high'][h.lv]); });
    return a;
  }
  $('#sCsv').addEventListener('click', function () { if (R) SH.csv(fname('data') + '.csv', flat()); });
  $('#sJson').addEventListener('click', function () { if (!R) return; var o = {}; flat().slice(1).forEach(function (r) { o[r[0]] = r[1]; }); SH.download(fname('data') + '.json', JSON.stringify(o, null, 1), 'application/json'); });
  document.addEventListener('sh:beforereport', function (e) { if (!R) { e.preventDefault(); SH.toast(t('Prepare the site report first.', 'أعدّ تقرير الموقع أولاً.'), 'warn'); } });
})();
