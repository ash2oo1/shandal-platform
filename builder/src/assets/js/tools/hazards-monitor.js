/* Natural-hazards monitor.
   Live events grouped by hazard type (earthquakes from two independent seismic networks merged into one catalogue,
   volcanic unrest, wildfires, storms and cyclones, floods, drought, dust, landslides, ice, snow, temperature extremes,
   water colour, human-caused), daily satellite layers (thermal anomalies, aerosol, rain rate, flood water, land-surface
   temperature) and reference layers (plate boundaries, active faults, Holocene volcanoes).
   Popups carry derived information only (depth class, radiated energy, rupture length, nearest plate boundary, fault and
   volcano); the tool never sends the user to another site. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('hazmon2', ['zWin', 'zMin', 'zReg', 'zSat', 'zOp', 'zPlates', 'zFaults', 'zVolc']);
  var map = SH.map('zMap', { zoom: 2, base: 'dark', center: [25, 30], canvas: true });
  var ev = [], me = null, meMk = null, timer = null, evLayer = null, satLayer = null, plateLayer = null, faultLayer = null, volcLayer = null;
  var PL = null, FA = null, VO = null;

  /* ---------- hazard types */
  var HZ = [
    ['eq', t('Earthquakes', 'الزلازل'), '#F4A261'],
    ['tsu', t('Earthquakes with a tsunami flag', 'زلازل بإشارة تسونامي'), '#00B4D8'],
    ['volcano', t('Volcanic unrest and eruptions', 'نشاط وثوران بركاني'), '#E63946'],
    ['fire', t('Wildfires', 'حرائق الغابات والمراعي'), '#FF6B35'],
    ['storm', t('Storms and tropical cyclones', 'العواصف والأعاصير المدارية'), '#9B5DE5'],
    ['flood', t('Floods', 'الفيضانات'), '#2E86DE'],
    ['drought', t('Drought', 'الجفاف'), '#D4A373'],
    ['dust', t('Dust storms and haze', 'العواصف الترابية والضباب الدخاني'), '#C9A227'],
    ['slide', t('Landslides', 'الانهيارات الأرضية'), '#8D6E63'],
    ['ice', t('Sea and lake ice', 'جليد البحار والبحيرات'), '#7FDBFF'],
    ['snow', t('Heavy snow', 'الثلوج الكثيفة'), '#B0BEC5'],
    ['temp', t('Temperature extremes', 'الحرارة والبرودة المتطرفة'), '#F15BB5'],
    ['water', t('Water colour (algal blooms, sediment)', 'تغيّر لون المياه (طحالب، رواسب)'), '#2EC4B6'],
    ['manmade', t('Human-caused events', 'أحداث بفعل الإنسان'), '#9E9E9E']
  ];
  var HC = {}, HN = {}; HZ.forEach(function (h) { HN[h[0]] = h[1]; HC[h[0]] = h[2]; });
  var on = SH.store.get('shandal_hazmon_types', null) || {}; HZ.forEach(function (h) { if (on[h[0]] == null) on[h[0]] = true; });
  $('#zTypes').innerHTML = HZ.map(function (h) { return '<label class="chk"><input type="checkbox" value="' + h[0] + '"' + (on[h[0]] ? ' checked' : '') + '> <i style="width:11px;height:11px;border-radius:50%;flex:none;background:' + h[2] + ';box-shadow:0 0 0 1px rgba(0,0,0,.35)"></i><span style="flex:1">' + h[1] + '</span><b class="xsmall" data-n="' + h[0] + '">–</b></label>'; }).join('');
  var EONET = { wildfires: 'fire', volcanoes: 'volcano', severeStorms: 'storm', floods: 'flood', drought: 'drought', dustHaze: 'dust', landslides: 'slide', seaLakeIce: 'ice', snow: 'snow', tempExtremes: 'temp', waterColor: 'water', manmade: 'manmade' };
  var GD = { TC: 'storm', FL: 'flood', VO: 'volcano', DR: 'drought', WF: 'fire' };

  var depthCol = function (d) { return d < 35 ? '#E63946' : d < 70 ? '#F4A261' : d < 300 ? '#2A9D8F' : '#457B9D'; };
  var ago = function (ms) { var s = (Date.now() - ms) / 1000; return s < 3600 ? Math.max(1, Math.round(s / 60)) + t(' min ago', ' د مضت') : s < 86400 ? Math.round(s / 3600) + t(' h ago', ' س مضت') : Math.round(s / 86400) + t(' d ago', ' ي مضت'); };
  var winMs = function () { return { hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 }[SH.val('zWin')]; };
  var utc = function (ms) { return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'; };
  var loc = function (ms) { return new Date(ms).toLocaleString(SH.lang === 'ar' ? 'ar-IQ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); };

  /* ---------- feeds (no source names are shown anywhere in the interface) */
  function netA() { var m = +SH.val('zMin'), lvl = m >= 4.5 ? '4.5' : m >= 2.5 ? '2.5' : 'all';
    return SH.getJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/' + lvl + '_' + SH.val('zWin') + '.geojson').then(function (j) { return j.features.filter(function (f) { return f.properties.mag >= m; }).map(function (f) { var p = f.properties, c = f.geometry.coordinates;
      return { net: 'A', h: 'eq', id: f.id, lat: c[1], lon: c[0], depth: c[2], mag: p.mag, magType: p.magType, time: p.time, place: p.place, tsunami: p.tsunami, alert: p.alert, felt: p.felt, mmi: p.mmi, sig: p.sig }; }); }); }
  function netB() { var start = new Date(Date.now() - winMs()).toISOString().slice(0, 19);
    return SH.getJSON('https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=3000&orderby=time&minmag=' + Math.max(0, +SH.val('zMin')) + '&start=' + start).then(function (j) { return (j.features || []).map(function (f) { var p = f.properties;
      return { net: 'B', h: 'eq', id: p.unid, lat: p.lat, lon: p.lon, depth: p.depth, mag: p.mag, magType: p.magtype, time: Date.parse(p.time), place: p.flynn_region }; }); }); }
  function events() { var days = Math.max(14, Math.ceil(winMs() / 864e5));
    return SH.getJSON('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=' + days).then(function (j) { var out = []; j.events.forEach(function (e) { var cat = (e.categories[0] || {}).id, h = EONET[cat]; if (!h) return;
      var gs = e.geometry || [], g = gs[gs.length - 1]; if (!g) return; var c = g.coordinates; if (g.type === 'Polygon') { var r = c[0], sx = 0, sy = 0; r.forEach(function (q) { sx += q[0]; sy += q[1]; }); c = [sx / r.length, sy / r.length]; }
      var track = gs.length > 1 ? gs.filter(function (q) { return q.type === 'Point'; }).map(function (q) { return [q.coordinates[1], q.coordinates[0]]; }) : null;
      out.push({ net: 'E', h: h, id: e.id, lat: c[1], lon: c[0], time: Date.parse(g.date), start: Date.parse(gs[0].date), place: e.title, size: g.magnitudeValue, sizeU: g.magnitudeUnit, track: track && track.length > 1 ? track : null, n: gs.length }); }); return out; }); }
  function alerts() { var d0 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10), d1 = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    return SH.getJSON('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL;VO;DR;WF&alertlevel=green;orange;red&fromdate=' + d0 + '&todate=' + d1, { timeout: 25000 }).then(function (j) { return (j.features || []).filter(function (f) { return f.geometry && f.geometry.type === 'Point' && GD[f.properties.eventtype] && (String(f.properties.iscurrent) === 'true' || Date.now() - Date.parse(f.properties.todate) < 3 * 864e5); }).map(function (f) { var p = f.properties, c = f.geometry.coordinates;
      return { net: 'G', h: GD[p.eventtype], id: p.eventtype + p.eventid, lat: c[1], lon: c[0], time: Date.parse(p.datemodified || p.todate || p.fromdate), start: Date.parse(p.fromdate), place: p.name || p.description, alert: (p.alertlevel || '').toLowerCase(), sev: p.severitydata && p.severitydata.severitytext, country: p.country }; }).filter(function (e, i, A) { for (var k = 0; k < i; k++) if (A[k].id === e.id) return false; return true; }); }); }

  function refresh() {
    persist.save(); $('#zRef').disabled = true; $('#zStamp').textContent = t('Updating…', 'جارٍ التحديث…');
    var needEq = on.eq || on.tsu, needEv = HZ.some(function (h) { return h[0] !== 'eq' && h[0] !== 'tsu' && on[h[0]]; });
    var jobs = [needEq ? netA() : 0, needEq ? netB() : 0, needEv ? events() : 0, needEv ? alerts() : 0], failed = 0;
    Promise.all(jobs.map(function (p) { return p ? p.catch(function () { failed++; return []; }) : []; })).then(function (r) {
      ev = [].concat.apply([], r).filter(function (e) { return isFinite(e.lat) && isFinite(e.lon); });
      ev.forEach(function (e) { if (e.h === 'eq' && e.tsunami) e.h = 'tsu'; });
      merge(); draw(); list();
      $('#zStamp').textContent = t('Updated ', 'حُدّث ') + new Date().toLocaleTimeString(SH.lang === 'ar' ? 'ar-IQ' : 'en-GB') + t(' · refreshes every 5 min', ' · يتحدّث تلقائياً كل 5 دقائق') + (failed ? t(' · some services did not respond; shown what arrived', ' · بعض الخدمات لم تستجب؛ عُرض ما وصل') : '');
    }).then(function () { $('#zRef').disabled = false; clearTimeout(timer); timer = setTimeout(refresh, 300000); });
  }
  /* one event per earthquake: two networks reporting within 90 s and 120 km are the same shock; the same storm, flood or
     volcano reported by both event services within 150 km is kept once with its alert level */
  function merge() {
    var A = ev.filter(function (e) { return e.net === 'A'; });
    ev.forEach(function (e) { if (e.net !== 'B') return; for (var i = 0; i < A.length; i++) { var u = A[i]; if (Math.abs(u.time - e.time) < 90000 && SH.dist(u, e) < 120000) { u.twin = e; e.dup = true; break; } } });
    var G = ev.filter(function (e) { return e.net === 'G'; });
    ev.forEach(function (e) { if (e.net !== 'E') return; for (var i = 0; i < G.length; i++) { var g = G[i]; if (g.h === e.h && !g.dup && SH.dist(g, e) < 150000) { e.alert = g.alert; e.sev = g.sev; e.country = g.country; g.dup = true; break; } } });
  }
  var REG = { me: [12, 25, 42, 63], iq: [29, 38.7, 37.5, 48.7], ar: [-35, -18, 42, 63] };
  function inReg(e) { var r = SH.val('zReg');
    if (r === 'world') return true; if (r === 'view') return map && map.getBounds().pad(0.05).contains([e.lat, e.lon]);
    if (r === 'near') return !!me && SH.dist(me, e) <= 1000000;
    var b = REG[r]; return e.lat >= b[0] && e.lat <= b[2] && e.lon >= b[1] && e.lon <= b[3]; }
  function shown() { return ev.filter(function (e) { return !e.dup && on[e.h] && inReg(e); }); }

  function draw() {
    if (!map) return; if (evLayer) map.removeLayer(evLayer); evLayer = L.layerGroup().addTo(map);
    var cnt = {}; HZ.forEach(function (h) { cnt[h[0]] = 0; });
    shown().forEach(function (e) {
      cnt[e.h]++; var mk;
      if (e.h === 'eq' || e.h === 'tsu') mk = L.circleMarker([e.lat, e.lon], { radius: Math.max(3, Math.pow(Math.max(e.mag, 1), 1.55)), color: e.h === 'tsu' ? HC.tsu : '#fff', weight: e.h === 'tsu' ? 3 : 1, fillColor: depthCol(e.depth), fillOpacity: Date.now() - e.time < 36e5 ? 0.95 : 0.72 });
      else {
        if (e.track) L.polyline(e.track, { color: HC[e.h], weight: 2, opacity: .75, dashArray: '4 4' }).addTo(evLayer);
        var ring = e.alert === 'red' ? '#D00000' : e.alert === 'orange' ? '#FF8C00' : e.alert === 'green' ? '#2E8B57' : '#111';
        mk = L.circleMarker([e.lat, e.lon], { radius: e.alert ? 9 : 7, color: ring, weight: e.alert ? 3 : 1, fillColor: HC[e.h], fillOpacity: .95 });
      }
      mk.bindPopup(function () { return pop(e); }, { maxWidth: 320 }).addTo(evLayer); e.mk = mk;
    });
    HZ.forEach(function (h) { var b = $('[data-n="' + h[0] + '"]'); if (b) b.textContent = on[h[0]] ? cnt[h[0]] : '–'; });
    legend();
  }
  function title(e) { return e.h === 'eq' || e.h === 'tsu' ? 'M ' + SH.fmt(e.mag, 1) + ' · ' + (e.place || '') : HN[e.h] + (e.place ? ' · ' + e.place : ''); }

  /* ---------- derived information */
  function segDist(p, a, b) { // metres from p to segment a-b on a local equirectangular plane
    var k = Math.cos(p.lat * Math.PI / 180), ax = (a[1] - p.lon) * k, ay = a[0] - p.lat, bx = (b[1] - p.lon) * k, by = b[0] - p.lat;
    if (Math.abs(a[1] - b[1]) > 180) return 1e12; var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0, x = ax + u * dx, y = ay + u * dy;
    return Math.sqrt(x * x + y * y) * 111195; }
  var PNAME = { SUB: t('subduction zone', 'نطاق اندساس'), OCB: t('oceanic convergent boundary', 'حد تقارب محيطي'), CCB: t('continental collision', 'تصادم قاري'), OSR: t('oceanic spreading ridge', 'ظهر انتشار محيطي'), CRB: t('continental rift', 'خسيف قاري'), OTF: t('oceanic transform fault', 'صدع تحويلي محيطي'), CTF: t('continental transform fault', 'صدع تحويلي قاري') };
  function nearPlate(e) { if (!PL) return null; var best = null;
    PL.forEach(function (p) { var c = p[3]; for (var i = 0; i + 3 < c.length; i += 2) { var d = segDist(e, [c[i + 1], c[i]], [c[i + 3], c[i + 2]]); if (!best || d < best.d) best = { d: d, p: p }; } }); return best; }
  var FT = null;
  function nearFault(e) { if (!FA) return null; var best = null, x = e.lon * 1e4, y = e.lat * 1e4, box = 3e4;
    FA.f.forEach(function (f) { f.g.forEach(function (ln) { for (var i = 0; i + 3 < ln.length; i += 2) { if (Math.abs(ln[i] - x) > box * 2 || Math.abs(ln[i + 1] - y) > box) continue; var d = segDist(e, [ln[i + 1] / 1e4, ln[i] / 1e4], [ln[i + 3] / 1e4, ln[i + 2] / 1e4]); if (!best || d < best.d) best = { d: d, f: f }; } }); }); return best; }
  function nearVolc(e) { if (!VO) return null; var best = null; VO.forEach(function (v) { var d = SH.dist(e, { lat: v[4], lon: v[5] }); if (!best || d < best.d) best = { d: d, v: v }; }); return best; }
  function depthClass(d) { return d < 70 ? t('shallow (< 70 km): strongest shaking at the surface for its size', 'ضحل (أقل من 70 كم): أشد اهتزاز سطحي بالنسبة لقدره') : d < 300 ? t('intermediate (70–300 km)', 'متوسط العمق (70–300 كم)') : t('deep (> 300 km): felt widely but weakly', 'عميق (أكثر من 300 كم): يُشعر به على نطاق واسع لكن بضعف'); }
  var ALN = { green: t('green: limited impact expected', 'أخضر: أثر محدود متوقع'), yellow: t('yellow: local impact possible', 'أصفر: أثر محلي محتمل'), orange: t('orange: significant impact possible', 'برتقالي: أثر كبير محتمل'), red: t('red: severe impact expected', 'أحمر: أثر شديد متوقع') };
  function pop(e) {
    var r = function (k, v) { return v == null || v === '' ? '' : '<tr><td style="color:#888;padding-inline-end:8px;vertical-align:top;white-space:nowrap">' + k + '</td><td>' + v + '</td></tr>'; }, h = '';
    if (e.h === 'eq' || e.h === 'tsu') {
      var E = Math.pow(10, 1.5 * e.mag + 4.8), tnt = E / 4.184e9, RL = Math.pow(10, -2.44 + 0.59 * e.mag);
      h += r(t('Magnitude', 'القدر'), SH.fmt(e.mag, 1) + ' ' + SH.esc(e.magType || '') + (e.twin ? '<br><span class="xsmall" style="color:#888">' + t('second network: ', 'الشبكة الثانية: ') + SH.fmt(e.twin.mag, 1) + ' ' + SH.esc(e.twin.magType || '') + t(', epicentres ', '، بُعد المركزين ') + SH.fmt(SH.dist(e, e.twin) / 1000, 0) + ' km</span>' : ''));
      h += r(t('Origin time', 'وقت الحدوث'), utc(e.time) + '<br><span class="xsmall">' + loc(e.time) + '</span>');
      h += r(t('Depth', 'العمق'), SH.fmt(e.depth, 1) + ' km — ' + depthClass(e.depth));
      h += r(t('Radiated energy', 'الطاقة المنطلقة'), '<bdi dir="ltr">' + E.toExponential(1) + ' J</bdi> ≈ ' + (tnt >= 1000 ? SH.fmt(tnt / 1000, tnt >= 1e4 ? 0 : 1) + t(' kt TNT', ' كيلوطن TNT') : SH.fmt(tnt, tnt >= 10 ? 0 : 1) + t(' t TNT', ' طن TNT')));
      if (e.mag >= 4.5) h += r(t('Rupture length', 'طول التمزق'), '≈ ' + SH.fmt(RL, RL < 10 ? 1 : 0) + ' km');
      h += r(t('Tsunami', 'تسونامي'), e.tsunami ? '<b style="color:#00B4D8">' + t('flagged: large shock under or near the sea; follow your national warning centre', 'مُشار إليه: هزة كبيرة تحت البحر أو قربه؛ اتبع مركز الإنذار الوطني') + '</b>' : '');
      h += r(t('Expected impact', 'الأثر المتوقع'), e.alert ? ALN[e.alert] || e.alert : '');
      h += r(t('Max. intensity', 'أقصى شدة'), e.mmi ? 'MMI ' + SH.fmt(e.mmi, 1) : '');
      h += r(t('Felt reports', 'بلاغات الشعور'), e.felt || '');
    } else {
      h += r(t('Hazard', 'الخطر'), HN[e.h]);
      h += r(t('Started', 'بدأ'), e.start ? utc(e.start) : '');
      h += r(t('Last update', 'آخر تحديث'), utc(e.time) + ' · ' + ago(e.time));
      h += r(t('Size', 'الحجم'), e.size ? SH.fmt(e.size, 0) + ' ' + SH.esc(e.sizeU || '') : '');
      h += r(t('Track', 'المسار'), e.track ? e.n + t(' positions shown as a dashed line', ' موقعاً مرسومة بخط متقطع') : '');
      h += r(t('Alert level', 'مستوى الإنذار'), e.alert ? ALN[e.alert] || e.alert : '');
      h += r(t('Severity', 'الشدة'), SH.esc(e.sev || ''));
      h += r(t('Country', 'الدولة'), SH.esc(e.country || ''));
    }
    var pb = nearPlate(e); if (pb) h += r(t('Nearest plate boundary', 'أقرب حد صفيحي'), SH.fmt(pb.d / 1000, 0) + ' km · ' + (PNAME[pb.p[1]] || pb.p[1]) + ' (' + pb.p[0] + ', ' + pb.p[2] + ' mm/' + t('yr', 'سنة') + ')');
    var nf = nearFault(e); if (nf && nf.d < 300000) h += r(t('Nearest active fault', 'أقرب صدع نشط'), SH.fmt(nf.d / 1000, nf.d < 10000 ? 1 : 0) + ' km · ' + SH.esc(nf.f.n || t('unnamed', 'غير مسمّى')) + (FA.types[nf.f.t] ? ' (' + FA.types[nf.f.t].replace(/_/g, ' ') + ')' : '') + (nf.f.sr && nf.f.sr[0] ? ' · ' + nf.f.sr[0] + ' mm/' + t('yr', 'سنة') : ''));
    if (e.h === 'volcano' || e.h === 'eq' || e.h === 'tsu') { var nv = nearVolc(e); if (nv && nv.d < 200000) h += r(t('Nearest Holocene volcano', 'أقرب بركان هولوسيني'), SH.fmt(nv.d / 1000, 0) + ' km · ' + SH.esc(nv.v[1]) + ' (' + SH.esc(nv.v[7]) + ', ' + nv.v[6] + ' m)'); }
    h += r(t('Position', 'الموقع'), '<bdi dir="ltr">' + e.lat.toFixed(3) + ', ' + e.lon.toFixed(3) + '</bdi>');
    if (me) h += r(t('Distance from you', 'البعد عنك'), SH.fmt(SH.dist(me, e) / 1000, 0) + ' km');
    var miss = []; if (!PL) miss.push(t('plate boundaries', 'حدود الصفائح')); if (!FA) miss.push(t('active faults', 'الصدوع النشطة'));
    return '<b>' + SH.esc(title(e)) + '</b><table style="font-size:12px;margin-top:6px;line-height:1.5">' + h + '</table>' + (miss.length ? '<div class="xsmall" style="color:#888;margin-top:4px">' + t('Switch on ', 'فعّل طبقة ') + miss.join(t(' and ', ' و')) + t(' to see the distance to them.', ' لترى البعد عنها.') + '</div>' : '');
  }

  function list() {
    var s = SH.seg('zSort'), a = shown();
    if (me) a.forEach(function (e) { e._d = SH.dist(me, e); });
    var mg = function (e) { return e.h === 'eq' || e.h === 'tsu' ? e.mag : e.alert === 'red' ? 9.9 : e.alert === 'orange' ? 9.5 : -1; };
    a.sort(s === 'mag' ? function (x, y) { return mg(y) - mg(x); } : s === 'dist' && me ? function (x, y) { return x._d - y._d; } : function (x, y) { return y.time - x.time; });
    $('#zList').innerHTML = (a.length ? '' : '<p class="xsmall muted" style="padding:10px 16px;margin:0">' + t('No events match the hazard types, region and filters chosen.', 'لا توجد أحداث تطابق أنواع المخاطر والمنطقة والفلاتر المختارة.') + '</p>') + a.slice(0, 400).map(function (e, i) {
      var q = e.h === 'eq' || e.h === 'tsu';
      var badge = '<span style="min-width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-weight:800;color:#fff;background:' + (q ? depthCol(e.depth) : HC[e.h]) + (e.h === 'tsu' ? ';box-shadow:0 0 0 3px ' + HC.tsu : e.alert ? ';box-shadow:0 0 0 3px ' + ({ red: '#D00000', orange: '#FF8C00', green: '#2E8B57' }[e.alert] || '#888') : '') + ';font-size:' + (q ? '.9rem' : '.62rem') + ';text-align:center;line-height:1.1;padding:2px">' + (q ? SH.fmt(e.mag, 1) : SH.esc(HN[e.h].split(/[ (،,]/)[0])) + '</span>';
      return '<button type="button" data-k="' + i + '" style="all:unset;cursor:pointer;display:flex;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid var(--line)">' + badge + '<span style="display:grid;gap:2px;min-width:0"><b style="font-size:.85rem;line-height:1.3;overflow:hidden;text-overflow:ellipsis">' + SH.esc(q ? e.place || '' : e.place || HN[e.h]) + '</b><span class="xsmall muted">' + ago(e.time) + (q ? ' · ' + SH.fmt(e.depth, 0) + ' km' + t(' deep', ' عمقاً') : '') + (me ? ' · ' + SH.fmt(e._d / 1000, 0) + ' km' + t(' away', ' عنك') : '') + (e.h === 'tsu' ? t(' · tsunami flag', ' · إشارة تسونامي') : '') + '</span></span></button>';
    }).join('');
    $('#zList')._a = a;
  }

  /* ---------- daily satellite layers (served as images; no key needed) */
  var SAT = {
    fire: { l: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All', lag: 1, z: 9, h: t('Active fires and thermal anomalies (375 m)', 'الحرائق النشطة والشذوذ الحراري (375 م)'), k: [['#FFD60A', t('low', 'منخفض')], ['#FF8C00', ''], ['#D00000', t('high radiative power', 'قدرة إشعاعية عالية')]], n: t('Each dot is a 375 m pixel hotter than its surroundings on the chosen day: fires, gas flares, volcanic vents or hot industrial sites. Flares in oil fields appear every day at the same place.', 'كل نقطة خلية 375 م أسخن من محيطها في اليوم المختار: حرائق أو مشاعل غاز أو فوهات بركانية أو منشآت صناعية حارة. تظهر مشاعل حقول النفط يومياً في المكان نفسه.') },
    fire1k: { l: 'MODIS_Combined_Thermal_Anomalies_All', lag: 1, z: 7, h: t('Fires and thermal anomalies (1 km, two satellites)', 'الحرائق والشذوذ الحراري (1 كم، قمران)'), k: [['#FFD60A', ''], ['#D00000', t('hot pixel', 'خلية حارة')]], n: t('Coarser but with a longer, steadier record; use it to confirm the 375 m detections.', 'أخشن لكن بسجل أطول وأثبت؛ استعمله لتأكيد رصد 375 م.') },
    aod: { l: 'MODIS_Combined_Value_Added_AOD', lag: 1, z: 6, h: t('Aerosol optical depth: dust and smoke', 'العمق البصري للهباء: الغبار والدخان'), k: [['#FFFFB2', '0.1'], ['#FEB24C', '0.5'], ['#F03B20', '1'], ['#800026', '> 1.5']], n: t('Higher values mean more dust or smoke in the air column; values above 1 over Iraq are typical of dust storms. Gaps are clouds or bright desert where the retrieval fails.', 'القيم الأعلى تعني غباراً أو دخاناً أكثر في عمود الهواء؛ والقيم فوق 1 فوق العراق معتادة في العواصف الترابية. الفراغات غيوم أو صحراء ساطعة يتعذر فيها الاسترجاع.') },
    rain: { l: 'IMERG_Precipitation_Rate', lag: 2, z: 6, h: t('Rain rate (daily, satellite)', 'معدل الهطول (يومي، فضائي)'), k: [['#B3E5FC', t('light', 'خفيف')], ['#29B6F6', ''], ['#1565C0', ''], ['#E040FB', t('very heavy', 'غزير جداً')]], n: t('Satellite estimate of rain rate on a 10 km grid; reliable for regional patterns, less for single storms or snow.', 'تقدير فضائي لمعدل الهطول على شبكة 10 كم؛ موثوق للأنماط الإقليمية وأقل دقة للعواصف المنفردة والثلج.') },
    flood: { l: 'VIIRS_Combined_Flood_3-Day', lag: 2, z: 9, h: t('Flood water (3-day composite, 375 m)', 'مياه الفيضان (تجميع 3 أيام، 375 م)'), k: [['#D60000', t('flood water', 'مياه فيضان')], ['#2E86DE', t('normal water', 'مياه طبيعية')]], n: t('Water seen on the ground in the last three days compared with normal water bodies; cloud shadow and burn scars can cause false flood pixels.', 'المياه المرئية على الأرض في آخر ثلاثة أيام مقارنة بالمسطحات المائية الطبيعية؛ وقد يسبب ظل الغيوم وآثار الحرائق خلايا فيضان كاذبة.') },
    lst: { l: 'VIIRS_NOAA20_Land_Surface_Temp_Day', lag: 2, z: 7, h: t('Daytime land surface temperature', 'حرارة سطح الأرض نهاراً'), k: [['#313695', '−20 °C'], ['#FFFFBF', '20 °C'], ['#A50026', '60 °C']], n: t('Skin temperature of the ground, not air temperature; bare desert can exceed the air by 15–25 °C in summer.', 'حرارة سطح الأرض وليست حرارة الهواء؛ وقد تزيد الصحراء الجرداء على الهواء بـ 15–25 °م صيفاً.') }
  };
  var day = function (lag) { var d = new Date(Date.now() - lag * 864e5); return d.toISOString().slice(0, 10); };
  (function () { var el = $('#zDate'); el.max = day(0); if (!el.value || el.value > day(0)) el.value = day(1); })();
  var satStat = null;
  function sat() {
    if (!map) return; if (satLayer) { map.removeLayer(satLayer); satLayer = null; }
    var k = SH.val('zSat'), S = SAT[k]; $('#zSatInfo').hidden = !S; if (!S) { legend(); return; }
    var want = $('#zDate').value || day(S.lag), cap = day(S.lag), dt = want > cap ? cap : want;
    satLayer = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', { layers: S.l, format: 'image/png', transparent: true, version: '1.3.0', opacity: +SH.val('zOp') / 100, TIME: dt, maxNativeZoom: S.z, maxZoom: 18, attribution: '', crossOrigin: true, zIndex: 300 });
    var ok = 0, bad = 0; satLayer.on('loading', function () { ok = 0; bad = 0; }); satLayer.on('tileload', function () { ok++; }); satLayer.on('tileerror', function () { bad++; });
    satLayer.on('load', function () { if (bad && !ok) SH.toast(t('The satellite image for this day is not ready yet; choose an earlier date.', 'صورة القمر لهذا اليوم غير جاهزة بعد؛ اختر تاريخاً أقدم.'), 'warn'); });
    satLayer.addTo(map); satStat = dt;
    $('#zSatInfo').innerHTML = '<b>' + S.h + '</b> · ' + dt + (dt !== want ? t(' (latest available)', ' (أحدث المتاح)') : '') + '<br>' + S.n;
    legend();
  }
  $('#zOp').addEventListener('input', function () { if (satLayer) satLayer.setOpacity(+this.value / 100); });

  /* ---------- reference layers */
  var PCOL = { SUB: '#E63946', OCB: '#E76F51', CCB: '#F4A261', OSR: '#2A9D8F', CRB: '#57CC99', OTF: '#9D4EDD', CTF: '#C77DFF' };
  function getPlates() { return PL ? Promise.resolve(PL) : SH.getJSON(SH.base + 'assets/data/plates.json').then(function (j) { PL = j; return j; }); }
  function plates() {
    if (!map) return; if (!$('#zPlates').checked) { if (plateLayer) map.removeLayer(plateLayer); legend(); return; } if (plateLayer) { plateLayer.addTo(map); legend(); return; }
    getPlates().then(function (P) { plateLayer = L.layerGroup(); var rnd = L.canvas();
      P.forEach(function (p) { var parts = [[]]; for (var i = 0; i < p[3].length; i += 2) { var cur = parts[parts.length - 1], q = [p[3][i + 1], p[3][i]]; if (cur.length && Math.abs(q[1] - cur[cur.length - 1][1]) > 180) parts.push(cur = []); cur.push(q); } parts.forEach(function (ll) { if (ll.length < 2) return; L.polyline(ll, { renderer: rnd, color: PCOL[p[1]] || '#aaa', weight: 1.8, opacity: .85, interactive: true }).bindTooltip(p[0] + ' · ' + (PNAME[p[1]] || p[1]) + ' · ' + p[2] + ' mm/' + t('yr', 'سنة'), { sticky: true }).addTo(plateLayer); }); });
      plateLayer.addTo(map); legend(); }).catch(function () {});
  }
  function faults() {
    if (!map) return; if (!$('#zFaults').checked) { if (faultLayer) map.removeLayer(faultLayer); legend(); return; } if (faultLayer) { faultLayer.addTo(map); legend(); return; }
    $('#zFaultMsg').hidden = false;
    SH.getJSON(SH.base + 'assets/data/tectonics/faults.json', { timeout: 60000 }).then(function (j) { FA = j; faultLayer = L.layerGroup(); var rnd = L.canvas();
      j.f.forEach(function (f) { var nm = (f.n || t('Unnamed fault', 'صدع غير مسمّى')) + (j.types[f.t] ? ' · ' + j.types[f.t].replace(/_/g, ' ') : '') + (f.sr && f.sr[0] ? ' · ' + f.sr[0] + ' mm/' + t('yr', 'سنة') : '');
        f.g.forEach(function (ln) { var ll = []; for (var i = 0; i + 1 < ln.length; i += 2) ll.push([ln[i + 1] / 1e4, ln[i] / 1e4]); if (ll.length > 1) L.polyline(ll, { renderer: rnd, color: '#FFB703', weight: 1.1, opacity: .8 }).bindTooltip(SH.esc(nm), { sticky: true }).addTo(faultLayer); }); });
      faultLayer.addTo(map); legend(); }).catch(function (e) { SH.toast(e.message, 'bad'); $('#zFaults').checked = false; }).then(function () { $('#zFaultMsg').hidden = true; });
  }
  function volcs() {
    if (!map) return; if (!$('#zVolc').checked) { if (volcLayer) map.removeLayer(volcLayer); legend(); return; } if (volcLayer) { volcLayer.addTo(map); legend(); return; }
    (VO ? Promise.resolve(VO) : SH.getJSON(SH.base + 'assets/data/volcanoes.json')).then(function (V) { VO = V; volcLayer = L.layerGroup(); var rnd = L.canvas();
      V.forEach(function (v) { L.circleMarker([v[4], v[5]], { renderer: rnd, radius: 3.2, color: '#000', weight: .8, fillColor: v[8] === 'Historical' ? '#FF5252' : '#FFAB91', fillOpacity: .95 }).bindTooltip(SH.esc(v[1]) + ' · ' + SH.esc(v[7]) + ' · ' + v[6] + ' m · ' + SH.esc(v[2]), { sticky: true }).addTo(volcLayer); });
      volcLayer.addTo(map); legend(); }).catch(function () {});
  }
  /* reference data used in popups are loaded quietly even when their layer is off */
  getPlates().catch(function () {}); SH.getJSON(SH.base + 'assets/data/volcanoes.json').then(function (v) { VO = VO || v; }).catch(function () {});

  /* ---------- on-map legend */
  var Leg = L.Control.extend({ options: { position: 'topright' }, onAdd: function () { var d = L.DomUtil.create('div', 'hz-leg'); L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d); return d; } }), leg = map ? new Leg().addTo(map) : null;
  var lt = function (x) { return '<bdi dir="ltr">' + x + '</bdi>'; };
  function legend() {
    if (!leg) return; var c = leg.getContainer(), sw = function (col, txt, ring) { return '<div class="hz-r"><i style="background:' + col + (ring ? ';box-shadow:0 0 0 2px ' + ring : '') + '"></i>' + txt + '</div>'; }, h = '';
    if (on.eq || on.tsu) h += '<div class="hz-t">' + t('Earthquake depth', 'عمق الزلزال') + '</div>' + sw('#E63946', lt('&lt; 35 km')) + sw('#F4A261', lt('35–70 km')) + sw('#2A9D8F', lt('70–300 km')) + sw('#457B9D', lt('&gt; 300 km')) + '<div class="hz-n">' + t('size grows with magnitude', 'يكبر الرمز مع القدر') + '</div>';
    var hz = HZ.filter(function (x) { return x[0] !== 'eq' && on[x[0]] && ev.some(function (e) { return e.h === x[0] && !e.dup && inReg(e); }); });
    if (hz.length) h += '<div class="hz-t">' + t('Events', 'الأحداث') + '</div>' + hz.map(function (x) { return sw(x[2], x[1], x[0] === 'tsu' ? '#00B4D8' : 0); }).join('') + '<div class="hz-n">' + t('ring: alert green / orange / red', 'الحلقة: إنذار أخضر / برتقالي / أحمر') + '</div>';
    var S = SAT[SH.val('zSat')]; if (S && satLayer) h += '<div class="hz-t">' + S.h + '</div>' + S.k.map(function (k) { return sw(k[0], !k[1] ? '&nbsp;' : /\d/.test(k[1]) ? lt(k[1]) : k[1]); }).join('') + '<div class="hz-n">' + satStat + '</div>';
    if ($('#zPlates').checked) h += '<div class="hz-t">' + t('Plate boundaries', 'حدود الصفائح') + '</div>' + sw('#E63946', PNAME.SUB) + sw('#F4A261', PNAME.CCB) + sw('#2A9D8F', PNAME.OSR) + sw('#9D4EDD', t('transform', 'تحويلي'));
    if ($('#zFaults').checked && faultLayer) h += sw('#FFB703', t('active fault', 'صدع نشط'));
    if ($('#zVolc').checked && volcLayer) h += sw('#FF5252', t('volcano, historical eruption', 'بركان بثوران تاريخي')) + sw('#FFAB91', t('volcano, Holocene', 'بركان هولوسيني'));
    var od = c.querySelector('details'), op = od ? od.open : window.innerWidth >= 700; c.innerHTML = h ? '<details' + (op ? ' open' : '') + '><summary>' + t('Legend', 'المفتاح') + '</summary>' + h + '</details>' : ''; c.style.display = h ? '' : 'none';
  }

  /* ---------- events */
  $('#zList').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var x = $('#zList')._a[+b.getAttribute('data-k')]; if (x && x.mk && map) { map.flyTo([x.lat, x.lon], Math.max(map.getZoom(), 6), { duration: .8 }); setTimeout(function () { x.mk.openPopup(); }, 850); } });
  $('#zTypes').addEventListener('change', function (e) { var v = e.target.value; if (!v) return; var hadEq = on.eq || on.tsu, hadEv = HZ.some(function (h) { return h[0] !== 'eq' && h[0] !== 'tsu' && on[h[0]]; }); on[v] = e.target.checked; SH.store.set('shandal_hazmon_types', on);
    var needEq = on.eq || on.tsu, needEv = HZ.some(function (h) { return h[0] !== 'eq' && h[0] !== 'tsu' && on[h[0]]; }); if ((needEq && !hadEq) || (needEv && !hadEv)) refresh(); else { draw(); list(); } });
  $('#zAll').addEventListener('click', function () { var all = HZ.every(function (h) { return on[h[0]]; }); HZ.forEach(function (h) { on[h[0]] = !all; }); SH.$$('#zTypes input').forEach(function (i) { i.checked = !all; }); SH.store.set('shandal_hazmon_types', on); refresh(); });
  ['zWin', 'zMin'].forEach(function (id) { $('#' + id).addEventListener('change', refresh); });
  $('#zReg').addEventListener('change', function () { persist.save(); var r = this.value, b = REG[r];
    if (r === 'near' && !me) { $('#zMe').click(); return; }
    if (b && map) map.fitBounds([[b[0], b[1]], [b[2], b[3]]]); else if (r === 'world' && map) map.setView([25, 30], 2); draw(); list(); });
  if (map) map.on('moveend', function () { if (SH.val('zReg') === 'view') { draw(); list(); } });
  ['zSat', 'zDate'].forEach(function (id) { $('#' + id).addEventListener('change', function () { persist.save(); sat(); }); });
  $('#zPlates').addEventListener('change', function () { persist.save(); plates(); });
  $('#zFaults').addEventListener('change', function () { persist.save(); faults(); });
  $('#zVolc').addEventListener('change', function () { persist.save(); volcs(); });
  document.addEventListener('click', function (e) { if (e.target.closest('#zSort button')) setTimeout(list, 0); });
  $('#zRef').addEventListener('click', function () { refresh(); sat(); });
  $('#zMe').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { me = p; if (meMk) meMk.setLatLng([p.lat, p.lon]); else meMk = L.marker([p.lat, p.lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); map.setView([p.lat, p.lon], 5); var d = SH.$('#zSort button[data-v="dist"]'); draw(); if (d) d.click(); else list(); }).catch(function (e) { SH.toast(e.message, 'bad'); if (SH.val('zReg') === 'near') { $('#zReg').value = 'world'; } }).then(function () { b.disabled = false; }); });
  $('#zGeo').addEventListener('click', function () { SH.json('shandal-hazards-' + new Date().toISOString().slice(0, 16).replace(':', '') + '.geojson', { type: 'FeatureCollection', features: shown().map(function (e) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [e.lon, e.lat] }, properties: { hazard: e.h, title: title(e), time: new Date(e.time).toISOString(), magnitude: e.mag, depth_km: e.depth, alert: e.alert || null, tsunami_flag: e.h === 'tsu' || undefined } }; }) }); });
  $('#zCsv').addEventListener('click', function () { SH.csv('shandal-hazards-' + new Date().toISOString().slice(0, 10) + '.csv', [['hazard', 'title', 'time_utc', 'lat', 'lon', 'magnitude', 'depth_km', 'alert']].concat(shown().map(function (e) { return [HN[e.h], title(e), new Date(e.time).toISOString(), e.lat.toFixed(4), e.lon.toFixed(4), e.mag == null ? '' : e.mag, e.depth == null ? '' : e.depth, e.alert || '']; }))); });
  plates(); faults(); volcs(); sat(); refresh();
})();
