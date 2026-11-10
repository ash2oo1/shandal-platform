/* What is in front of me? — geology around a point and through the phone camera. An area pack (elevations about 8 km
   around the point, geological unit polygons, the local succession and active faults) is built online and kept in
   IndexedDB for use without a network. From it: a location sheet (elevation, slope, aspect, landform, unit underfoot and
   around, succession, expected fossils, nearest active fault, colour hint), a 360° panorama of the units on the skyline,
   and a live camera view where the line of sight is cast through the terrain to name the unit seen at the crosshair and
   across the picture, with the skyline drawn for calibration; photographs and videos are saved with the labels burned in. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, AR = SH.lang === 'ar', API = 'https://macrostrat.org/api/v2/', RAD = Math.PI / 180;
  var IDS = ['eyFov', 'eyOff', 'eyDip', 'eyNote'], persist = SH.persist('geoeye', IDS);
  var map = SH.map('eyMap', { center: [35.0, 44.8], zoom: 6 }), L = window.L, mk = null, PACK = null, POS = null, DECL = 0;
  /* formations of the Zagros foreland seen on the Baghdad–Sulaymaniyah trip: name, typical outcrop colour, fossils */
  var FMN = [['Bai Hassan', 'باي حسن', '#9C7B5B', 'Mostly barren; rare plant and vertebrate remains', 'فقيرة غالباً؛ بقايا نباتية وفقرية نادرة', /bai hassan|upper bakhtiari/i], ['Mukdadiya', 'المقدادية', '#9A958A', 'Mostly barren; plant remains', 'فقيرة غالباً؛ بقايا نباتية', /mukdad|lower bakhtiari/i], ['Injana', 'إنجانة', '#A0614A', 'Mostly barren', 'فقيرة غالباً', /injana|upper fars/i], ['Fatha', 'الفتحة', '#9AA58A', 'Few: shells in thin limestone beds', 'قليلة: أصداف في طبقات الحجر الجيري الرقيقة', /fat.?ha|lower fars/i], ['Pila Spi', 'بيلاسبي', '#CDBA92', 'Algae, corals, bryozoa', 'طحالب ومرجان وحزازيات', /pila ?spi/i], ['Gercus', 'جركس', '#8E3B2E', 'Mostly barren red beds', 'طبقات حمراء فقيرة غالباً', /gercus/i], ['Sinjar', 'سنجار', '#C9C3B3', 'Nummulites, Alveolina, Discocyclina, corals, algae', 'نمّوليت وألفيولينا وديسكوسايكلينا ومرجان وطحالب', /sinjar/i], ['Kolosh', 'كولوش', '#4E5254', 'Planktonic foraminifera, nannofossils', 'فورامنيفرا طافية ومتحجرات نانوية', /kolosh/i], ['Tanjero', 'تانجيرو', '#6E7556', 'Fossiliferous limestone beds in the upper part', 'طبقات جيرية غنية بالمتحجرات في الجزء الأعلى', /tanjero/i], ['Shiranish', 'شيرانش', '#A3A890', 'Planktonic foraminifera', 'فورامنيفرا طافية', /shiranish/i], ['Kometan', 'كوميتان', '#BFC1BE', 'Planktonic foraminifera, calcispheres', 'فورامنيفرا طافية وكرات كلسية', /kometan/i], ['Balambo', 'بالامبو', '#B7BAB9', 'Calcareous nannofossils', 'متحجرات نانوية كلسية', /balambo/i], ['Sarmord', 'سارمورد', '#8F8A7A', 'Calcareous nannofossils', 'متحجرات نانوية كلسية', /sarmord/i], ['Qamchuqa', 'قمجوقة', '#C2B9A3', 'Orbitolina and rudist fragments', 'أوربيتولينا وشظايا روديست', /qamchuqa/i]];
  var TRIP = [[34.565, 44.516], [35.5329, 44.3357], [35.5333, 44.8333], [35.63903, 44.97261], [35.557, 45.435], [35.58, 45.44], [35.3006, 45.4047], [35.1128, 45.7064], [34.1144, 44.9678]];
  var data = function (j) { return j && j.success ? j.success.data : j && j.data || j; };

  /* ---------------------------------------------------------------- storage of area packs */
  var dbp = null; function db() { return dbp || (dbp = new Promise(function (res, rej) { var r = indexedDB.open('shandal_eye', 1); r.onupgradeneeded = function () { r.result.createObjectStore('packs', { keyPath: 'id' }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; })); }
  function tx(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var x = d.transaction('packs', mode), st = x.objectStore('packs'), out = fn(st); x.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; x.onerror = function () { rej(x.error); }; }); }); }
  function allPacks() { return tx('readonly', function (st) { return st.getAll(); }).then(function (r) { return r || []; }).catch(function () { return []; }); }
  function packFor(lat, lon) { return allPacks().then(function (P) { var best = null, bd = Infinity; P.forEach(function (p) { var d = SH.dist({ lat: lat, lon: lon }, { lat: p.lat, lon: p.lon }); if (d < p.r * 0.7 && d < bd) { bd = d; best = p; } }); return best; }); }
  function packsInfo() { allPacks().then(function (P) { $('#eyPacks').textContent = P.length ? P.length + t(' areas saved on this phone (', ' منطقة محفوظة على هذا الهاتف (') + F(P.reduce(function (s, p) { return s + (p.size || 0); }, 0) / 1e6, 1) + ' MB).' : t('No area saved yet.', 'لا منطقة محفوظة بعد.'); }); }

  /* ---------------------------------------------------------------- building a pack online */
  function pool(items, n, fn) { var i = 0, done = 0, out = new Array(items.length); return new Promise(function (res) { if (!items.length) return res(out); function nx() { if (i >= items.length) return; var k = i++; Promise.resolve().then(function () { return fn(items[k]); }).then(function (v) { out[k] = v; }, function () { out[k] = null; }).then(function () { if (++done === items.length) res(out); else nx(); }); } for (var j = 0; j < Math.min(n, items.length); j++) nx(); }); }
  function unitsAt(p) { return SH.getJSON(API + 'geologic_units/map?lat=' + p[0].toFixed(5) + '&lng=' + p[1].toFixed(5), { timeout: 20000 }).then(function (j) { var d = data(j) || []; if (!Array.isArray(d)) d = [d]; var R0 = { large: 0, medium: 1, small: 2, tiny: 3 };
    return d.filter(function (u) { return u && u.map_id != null; }).map(function (u) { var sc = u.scale || (u.ref && u.ref.scale) || ''; return { id: u.map_id, rk: R0[sc] != null ? R0[sc] : 2, name: (u.name || u.strat_name || u.best_int_name || 'Unit').trim(), b: +u.b_age, tt: +u.t_age, int: u.best_int_name || u.b_int_name || '', lith: u.lith || '', desc: u.descrip || '', col: /^#?[0-9a-f]{6}$/i.test(u.color || '') ? (u.color[0] === '#' ? u.color : '#' + u.color) : '#CFC7B4' }; }).sort(function (a, b) { return a.rk - b.rk; })[0] || null; }); }
  function simplify(g) { var cnt = 0, f = function (r) { return r; }; (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(function (p) { p.forEach(function (r) { cnt += r.length; }); }); if (cnt < 6000) return g; var st = Math.ceil(cnt / 6000); f = function (r) { var o = r.filter(function (c, i) { return i % st === 0; }); o.push(r[r.length - 1]); return o.map(function (c) { return [+c[0].toFixed(5), +c[1].toFixed(5)]; }); };
    return g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.coordinates.map(f) } : { type: 'MultiPolygon', coordinates: g.coordinates.map(function (p) { return p.map(f); }) }; }
  function faultsNear(lat, lon) { var key = Math.floor(lat / 10) * 10 + '_' + Math.floor(lon / 10) * 10; return SH.getJSON(SH.base + 'assets/data/faults/' + key + '.json').then(function (A) { var out = []; (A || []).forEach(function (f) { var c = f[4], best = Infinity; for (var i = 0; i + 1 < c.length; i += 2) { var d = SH.dist({ lat: lat, lon: lon }, { lat: c[i + 1], lon: c[i] }); if (d < best) best = d; } if (best < 80000) out.push({ name: f[0], type: f[1], rate: f[2], dip: f[3], d: best, c: c }); }); return out.sort(function (a, b) { return a.d - b.d; }).slice(0, 5); }).catch(function () { return []; }); }
  function build(lat, lon, msg) {
    var R = 8000, mpd = SH.dem.metersPerDeg(lat), n = 241, b = { n: lat + R / mpd.y, s: lat - R / mpd.y, e: lon + R / mpd.x, w: lon - R / mpd.x };
    msg(t('Reading elevations…', 'قراءة الارتفاعات…'));
    return SH.dem.grid(b, n, n, { source: 'aws' }).then(function (Gd) {
      msg(t('Reading the geological map around the point…', 'قراءة الخريطة الجيولوجية حول النقطة…'));
      var S = []; for (var j = -2; j <= 2; j++) for (var i = -2; i <= 2; i++) S.push([lat + j * R * 0.38 / mpd.y, lon + i * R * 0.38 / mpd.x]);
      return pool(S, 4, unitsAt).then(function (U0) {
        var ids = {}; U0.forEach(function (u) { if (u) ids[u.id] = u; });
        return pool(Object.keys(ids), 3, function (id) { return SH.getJSON(API + 'geologic_units/map?map_id=' + id + '&format=geojson_bare', { timeout: 30000 }).then(function (gj) { var f = (gj && gj.features || [])[0]; return f && f.geometry ? simplify(f.geometry) : null; }); }).then(function (geoms) {
          Object.keys(ids).forEach(function (id, k) { ids[id].g = geoms[k]; });
          msg(t('Reading the local succession and faults…', 'قراءة التتابع المحلي والفوالق…'));
          return Promise.all([SH.getJSON(API + 'units?lat=' + lat.toFixed(5) + '&lng=' + lon.toFixed(5) + '&response=long', { timeout: 20000 }).then(function (j) { var d = data(j); return Array.isArray(d) ? d.slice(0, 30).map(function (u) { return { name: u.unit_name || u.strat_name_long || '', b: +u.b_age, tt: +u.t_age, int: (u.b_int_name || '') + (u.t_int_name && u.t_int_name !== u.b_int_name ? '–' + u.t_int_name : ''), lith: (u.lith || []).map(function (l) { return l.name || l.lith; }).filter(Boolean).slice(0, 3).join(', '), th: u.max_thick || u.min_thick || null, col: u.color || '#ccc' }; }) : []; }).catch(function () { return []; }), faultsNear(lat, lon)]).then(function (r) {
            var z = Array.prototype.map.call(Gd.z, function (v) { return isFinite(v) ? Math.round(v * 10) / 10 : null; });
            var p = { id: lat.toFixed(3) + ',' + lon.toFixed(3), lat: lat, lon: lon, r: R, date: new Date().toISOString(), dem: { b: Gd.b, nx: Gd.nx, ny: Gd.ny, z: z }, samples: S.map(function (q, k) { return { ll: q, id: U0[k] ? U0[k].id : null }; }), units: Object.keys(ids).map(function (id) { var u = ids[id]; return { id: u.id, name: u.name, b: u.b, tt: u.tt, int: u.int, lith: u.lith, desc: u.desc, col: u.col, g: u.g }; }), col: r[0], faults: r[1].map(function (f) { return { name: f.name, type: f.type, rate: f.rate, dip: f.dip, d: f.d }; }) };
            p.size = JSON.stringify(p).length; return tx('readwrite', function (st) { st.put(p); }).then(function () { return p; }, function () { return p; });
          });
        });
      });
    });
  }

  /* ---------------------------------------------------------------- terrain and units from a pack */
  function prep(p) {
    var D = p.dem, mpd = SH.dem.metersPerDeg(p.lat), z = D.z, nx = D.nx, ny = D.ny, b = D.b;
    p.zat = function (lat, lon) { var fx = (lon - b.w) / (b.e - b.w) * (nx - 1), fy = (b.n - lat) / (b.n - b.s) * (ny - 1); if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return null; var i = Math.floor(fx), j = Math.floor(fy), i1 = Math.min(nx - 1, i + 1), j1 = Math.min(ny - 1, j + 1), u = fx - i, v = fy - j, a = z[j * nx + i], c = z[j * nx + i1], d = z[j1 * nx + i], e = z[j1 * nx + i1]; if (a == null || c == null || d == null || e == null) return a; return a * (1 - u) * (1 - v) + c * u * (1 - v) + d * (1 - u) * v + e * u * v; };
    p.mpd = mpd; p.U = {}; p.units.forEach(function (u) { p.U[u.id] = u; if (u.g) u.bb = bboxG(u.g); });
    p.unitAt = function (lat, lon) { for (var k = 0; k < p.units.length; k++) { var u = p.units[k]; if (u.g && u.bb && lon >= u.bb[0] && lon <= u.bb[2] && lat >= u.bb[1] && lat <= u.bb[3] && inGeom(u.g, lon, lat)) return u; } var best = null, bd = Infinity; p.samples.forEach(function (s) { if (s.id == null) return; var d = Math.hypot((s.ll[0] - lat) * mpd.y, (s.ll[1] - lon) * mpd.x); if (d < bd) { bd = d; best = p.U[s.id]; } }); return best; };
    return p;
  }
  function inRing(x, y, r) { var c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function inGeom(g, lon, lat) { var P = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (var k = 0; k < P.length; k++) if (P[k].length && inRing(lon, lat, P[k][0])) { for (var h = 1; h < P[k].length; h++) if (inRing(lon, lat, P[k][h])) return false; return true; } return false; }
  function bboxG(g) { var b = [180, 90, -180, -90]; (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(function (p) { (p[0] || []).forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); }); return b; }
  function eyeZ() { var z = PACK.zat(POS.lat, POS.lon); return (z == null ? (POS.alt || 0) : z) + 1.6; }
  function along(az, s) { return [POS.lat + s * Math.cos(az * RAD) / PACK.mpd.y, POS.lon + s * Math.sin(az * RAD) / PACK.mpd.x]; }
  function cast(az, el) {
    var z0 = eyeZ(), te = Math.tan(el * RAD), Rm = PACK.r * 0.97, s = 15;
    while (s < Rm) { var p = along(az, s), zt = PACK.zat(p[0], p[1]); if (zt == null) break; var zr = z0 + s * te - s * s / (2 * 6371000) * 0.87; if (zr <= zt) return { s: s, ll: p, z: zt }; s += Math.max(12, s * 0.012); }
    return null;
  }
  function horizon() { var z0 = eyeZ(), H = []; for (var a = 0; a < 360; a++) { var best = -90, bs = 0, s = 30; while (s < PACK.r * 0.97) { var p = along(a, s), zt = PACK.zat(p[0], p[1]); if (zt == null) break; var e = Math.atan2(zt - z0 + s * s / (2 * 6371000) * 0.87, s) / RAD; if (e > best) { best = e; bs = s; } s += Math.max(15, s * 0.015); } H.push({ e: best, s: bs, u: bs ? PACK.unitAt.apply(null, along(a, bs)) : null }); } return H; }

  /* ---------------------------------------------------------------- location sheet */
  function setPos(lat, lon, extra) {
    POS = Object.assign({ lat: lat, lon: lon }, extra || {}); if (map) { if (mk) mk.setLatLng([lat, lon]); else mk = L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#2E8B57', fillOpacity: 1 }).addTo(map); map.setView([lat, lon], Math.max(map.getZoom(), 11)); }
    $('#eyPos').textContent = lat.toFixed(5) + ', ' + lon.toFixed(5) + (POS.acc ? ' (±' + F(POS.acc, 0) + ' m)' : '') + (POS.alt != null ? ' · GPS ' + F(POS.alt, 0) + ' m' : '');
    if (SH.igrf) SH.igrf.load().then(function () { var n = new Date(); DECL = SH.igrf.field(lat, lon, 0, n.getFullYear() + (n.getMonth() + .5) / 12).D || 0; }).catch(function () {});
    packFor(lat, lon).then(function (p) {
      if (p) { PACK = prep(p); sheet(); return; }
      if (!navigator.onLine) { $('#eyStat').textContent = t('No saved area here and no network: prepare the area while connected.', 'لا منطقة محفوظة هنا ولا شبكة: حضّر المنطقة وأنت متصل.'); return; }
      build(lat, lon, function (m) { $('#eyStat').textContent = m; }).then(function (p2) { PACK = prep(p2); $('#eyStat').textContent = ''; packsInfo(); sheet(); }).catch(function (e) { $('#eyStat').textContent = e.message || String(e); });
    });
  }
  var HZ = null;
  function sheet() {
    $('#eyEmpty').hidden = true; $('#eyOut').hidden = false; var p = PACK, z = p.zat(POS.lat, POS.lon), dx = 30, mpd = p.mpd;
    var zz = function (de, dn) { return p.zat(POS.lat + dn / mpd.y, POS.lon + de / mpd.x); }, a = zz(-dx, dx), b = zz(0, dx), c = zz(dx, dx), d = zz(-dx, 0), f = zz(dx, 0), g = zz(-dx, -dx), h = zz(0, -dx), i = zz(dx, -dx);
    var gx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx), gy = ((a + 2 * b + c) - (g + 2 * h + i)) / (8 * dx), sl = Math.atan(Math.hypot(gx, gy)) / RAD, asp = (Math.atan2(-gx, -gy) / RAD + 360) % 360;
    var ring = []; for (var k = 0; k < 16; k++) { var q = zz(300 * Math.sin(k * 22.5 * RAD), 300 * Math.cos(k * 22.5 * RAD)); if (q != null) ring.push(q); } var tpi = z - ring.reduce(function (s, v) { return s + v; }, 0) / Math.max(1, ring.length);
    var lf = tpi > 15 ? t('ridge or crest', 'حافة أو قمة') : tpi < -15 ? t('valley floor', 'قاع وادٍ') : sl < 2 ? t('plain or flat', 'سهل أو أرض مستوية') : sl > 25 ? t('steep slope', 'منحدر حاد') : t('slope', 'منحدر');
    var u = p.unitAt(POS.lat, POS.lon), cmp = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(asp / 45) % 8];
    $('#eyKpis').innerHTML = [G.kpi('info', t('Elevation', 'الارتفاع'), z != null ? F(z, 0) + '<small> m</small>' : '—', t('above sea level, from the elevation model', 'فوق سطح البحر، من نموذج الارتفاع')), G.kpi('info', t('Slope and aspect', 'الانحدار والاتجاه'), F(sl, 0) + '°<small> · ' + cmp + '</small>', t('facing ', 'يواجه ') + F(asp, 0) + '°'), G.kpi('info', t('Landform', 'الشكل الأرضي'), lf, t('position index ', 'مؤشر الموقع ') + (tpi >= 0 ? '+' : '') + F(tpi, 0) + ' m'), G.kpi('ok', t('Unit underfoot', 'الوحدة تحت قدميك'), u ? SH.esc(u.name) : '—', u ? (u.int || (isFinite(u.b) ? F(u.b, 1) + ' Ma' : '')) : t('no map unit', 'لا وحدة مخرّطة'))].join('');
    var v = [], fm = u ? FMN.filter(function (q) { return q[5].test(u.name + ' ' + u.desc); }) : [];
    if (u) v.push(G.verdict('info', t('What you stand on', 'ما تقف عليه'), '<b>' + SH.esc(u.name) + '</b>' + (u.int ? ' — ' + SH.esc(u.int) : '') + (isFinite(u.b) ? ' (' + F(u.b, 1) + (isFinite(u.tt) ? '–' + F(u.tt, 1) : '') + ' Ma)' : '') + '. ' + (u.lith ? t('Lithology: ', 'الصخارية: ') + SH.esc(u.lith) + '. ' : '') + (u.desc ? SH.esc(u.desc.slice(0, 300)) : '') + (fm.length ? ' ' + t('Fossils to look for: ', 'متحجرات تبحث عنها: ') + fm.map(function (q) { return T2(q); }).join('؛ ') + '.' : '')));
    if (p.faults && p.faults.length) { var fa = p.faults[0]; v.push(G.verdict(fa.d < 5000 ? 'warn' : 'info', t('Nearest active fault', 'أقرب فالق نشط'), F(fa.d / 1000, 1) + t(' km away', ' كم') + (fa.name ? ' — ' + SH.esc(fa.name) : '') + (fa.type ? ' · ' + SH.esc(fa.type) : '') + (fa.dip ? t(' · dip ', ' · الميل ') + F(fa.dip, 0) + '°' : '') + (fa.rate ? t(' · slip rate ', ' · معدل الانزلاق ') + F(fa.rate, 1) + ' mm/yr' : '') + '.')); }
    v.push(G.verdict('info', t('How good is this?', 'ما مدى الدقة؟'), t('Units come from the best geological map available here, which in northern Iraq is often a regional compilation: names and ages are reliable, boundaries may be several hundred metres off. Check the unit against the rock in front of you.', 'تأتي الوحدات من أفضل خريطة جيولوجية متاحة هنا، وهي في شمال العراق غالباً تجميع إقليمي: الأسماء والأعمار موثوقة، وقد تنحرف الحدود مئات الأمتار. طابق الوحدة مع الصخر الذي أمامك.')));
    $('#eyVerd').innerHTML = v.join('');
    var seen = {}; p.samples.forEach(function (s) { if (s.id != null) seen[s.id] = (seen[s.id] || 0) + 1; });
    $('#eyUnits').innerHTML = Object.keys(seen).sort(function (a2, b2) { return seen[b2] - seen[a2]; }).map(function (id) { var q = p.U[id]; return q ? '<div><i style="background:' + q.col + '"></i><span><b>' + SH.esc(q.name) + '</b>' + (q.int ? ' — ' + SH.esc(q.int) : '') + (q.lith ? '<br><small class="muted">' + SH.esc(q.lith) + '</small>' : '') + '</span><small class="muted">' + Math.round(seen[id] / p.samples.length * 100) + ' %</small></div>' : ''; }).join('') || '<p class="muted">—</p>';
    $('#eyCol').innerHTML = '<thead><tr><th>' + t('Unit', 'الوحدة') + '</th><th>' + t('Age', 'العمر') + '</th><th class="num">Ma</th><th>' + t('Lithology', 'الصخارية') + '</th><th class="num">' + t('Thickness m', 'السمك م') + '</th></tr></thead><tbody>' + (p.col.length ? p.col.map(function (q) { return '<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + q.col + ';margin-inline-end:6px"></i>' + SH.esc(q.name) + '</td><td>' + SH.esc(q.int) + '</td><td class="num">' + (isFinite(q.b) ? F(q.b, 1) + '–' + F(q.tt, 1) : '') + '</td><td>' + SH.esc(q.lith) + '</td><td class="num">' + (q.th ? F(q.th, 0) : '') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">' + t('No measured succession is published for this point; use the units around you and the field-trip column.', 'لا يوجد تتابع مقيس منشور لهذه النقطة؛ استعمل الوحدات من حولك وعمود الرحلة الحقلية.') + '</td></tr>') + '</tbody>';
    HZ = horizon(); figPan();
  }
  function T2(q) { return AR ? q[1] + ': ' + q[4] : q[0] + ': ' + q[3]; }
  function figPan() {
    var svg = $('#eyPan'), H = HZ, es = H.map(function (q) { return q.e; }), lo = Math.floor(Math.min.apply(null, es) - 1), hi = Math.ceil(Math.max.apply(null, es) + 2), segs = [], cur = null;
    H.forEach(function (q, a) { var id = q.u ? q.u.id : null; if (!cur || cur.id !== id) { cur = { id: id, a0: a, a1: a, u: q.u }; segs.push(cur); } else cur.a1 = a; });
    var leg = [], seenL = {}; segs.forEach(function (s) { if (s.u && !seenL[s.u.id]) { seenL[s.u.id] = 1; leg.push({ name: s.u.name.slice(0, 40) + (s.u.int ? ' (' + s.u.int + ')' : ''), col: s.u.col, box: 1, op: 1 }); } });
    G.chart(svg, { W: 760, H: 380, m: { l: 58, r: 16, t: 18, b: 52 }, x: { lo: 0, hi: 360, n: 8, title: 'Azimuth from true north (°): N 0 · E 90 · S 180 · W 270' }, y: { lo: lo, hi: hi, title: 'Elevation angle of the skyline (°)' },
      under: function (fx, fy) { var s = ''; segs.forEach(function (sg) { if (!sg.u) return; var pts = []; for (var a = sg.a0; a <= Math.min(359, sg.a1 + 1); a++) pts.push([a, H[a % 360].e]); s += '<path d="M' + fx(sg.a0) + ' ' + fy(lo) + pts.map(function (p) { return 'L' + fx(p[0]).toFixed(1) + ' ' + fy(p[1]).toFixed(1); }).join('') + 'L' + fx(Math.min(360, sg.a1 + 1)) + ' ' + fy(lo) + 'Z" fill="' + sg.u.col + '" fill-opacity=".85"/>'; }); return s; },
      series: [{ pts: H.map(function (q, a) { return [a, q.e]; }), col: G.INK, w: 1.8 }], legend: leg.concat([{ name: 'Skyline', col: G.INK }]), note: 'From ' + POS.lat.toFixed(4) + ', ' + POS.lon.toFixed(4) + ' · eye 1.6 m above ground · terrain within ' + F(PACK.r / 1000, 0) + ' km · colour = unit at the skyline' });
    $('#eyPanCap').textContent = t('The skyline all around you and the geological unit that forms it in each direction. Turn on the spot with this figure to recognise the ridges and the units they are made of.', 'خط الأفق من حولك والوحدة الجيولوجية التي تكوّنه في كل اتجاه. استدر في مكانك مع هذا الشكل لتتعرف على الحافات والوحدات التي تتكون منها.');
  }

  /* ---------------------------------------------------------------- camera */
  var vid = $('#eyVid'), cv = $('#eyCv'), cx = cv.getContext('2d'), stream = null, OR = { h: null, p: 0, ok: false }, rec = null, chunks = [], raf = null, comp = null;
  function onOri(e) {
    var al = e.alpha, be = e.beta, ga = e.gamma; if (be == null) return;
    if (e.webkitCompassHeading != null) al = 360 - e.webkitCompassHeading; else if (!e.absolute && e.type !== 'deviceorientationabsolute') { if (OR.abs) return; }
    if (e.type === 'deviceorientationabsolute' || e.absolute) OR.abs = true;
    var a = al * RAD, b = be * RAD, g = ga * RAD, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    var vx = -(ca * sg + sa * sb * cg), vy = -(sa * sg - ca * sb * cg), vz = -(cb * cg);
    var h = (Math.atan2(vx, vy) / RAD + 360) % 360, p = Math.asin(Math.max(-1, Math.min(1, vz))) / RAD;
    if (OR.h == null) OR.h = h; else { var d = ((h - OR.h + 540) % 360) - 180; OR.h = (OR.h + d * 0.25 + 360) % 360; } OR.p = OR.p * 0.75 + p * 0.25; OR.ok = true;
  }
  function startCam() {
    if (!POS || !PACK) { SH.toast(t('Fix your position first.', 'حدّد موقعك أولاً.'), 'warn'); return; }
    var ask = window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission().catch(function () { return 'denied'; }) : Promise.resolve('granted');
    ask.then(function () {
      window.addEventListener('deviceorientationabsolute', onOri); window.addEventListener('deviceorientation', onOri);
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    }).then(function (s) { stream = s; vid.srcObject = s; return vid.play(); }).then(function () { $('#eyPh').hidden = true; ['eyShot', 'eyRec', 'eyFs'].forEach(function (id) { $('#' + id).disabled = false; }); $('#eyStart').disabled = true; loop(); })
      .catch(function (e) { SH.toast(t('The camera could not be opened: ', 'تعذر فتح الكاميرا: ') + (e.message || e), 'bad'); });
  }
  var CH = null, fr = 0, smp = document.createElement('canvas'); smp.width = smp.height = 24;
  function lab(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h), v = parseInt(m[1], 16); return rgb2lab((v >> 16) & 255, (v >> 8) & 255, v & 255); }
  function rgb2lab(r, g, b) { var f = function (c) { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; }; r = f(r); g = f(g); b = f(b); var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883, q = function (u) { return u > 0.008856 ? Math.cbrt(u) : 7.787 * u + 16 / 116; }; return [116 * q(y) - 16, 500 * (q(x) - q(y)), 200 * (q(y) - q(z))]; }
  function colourHint() {
    if (!PACK || !vid.videoWidth) return; var names = PACK.units.map(function (u) { return u.name + ' ' + (u.desc || ''); }).join(' | '), cand = FMN.filter(function (q) { return q[5].test(names); }); if (!cand.length) { CH = null; return; }
    var g = smp.getContext('2d', { willReadFrequently: true }), w = vid.videoWidth, h = vid.videoHeight, sz = Math.min(w, h) * 0.08; g.drawImage(vid, w / 2 - sz / 2, h / 2 - sz / 2, sz, sz, 0, 0, 24, 24); var d = g.getImageData(0, 0, 24, 24).data, r = 0, gg = 0, b = 0; for (var i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } var n = d.length / 4, L0 = rgb2lab(r / n, gg / n, b / n);
    CH = cand.map(function (q) { var c = lab(q[2]); return { q: q, d: Math.hypot(L0[0] - c[0], L0[1] - c[1], L0[2] - c[2]) }; }).sort(function (a, b2) { return a.d - b2.d; }).slice(0, 2);
  }
  function loop() { if (++fr % 15 === 0) colourHint(); draw(cx, cv.clientWidth, cv.clientHeight, true); raf = requestAnimationFrame(loop); }
  function heading() { return OR.h == null ? null : (OR.h + DECL + (+$('#eyOff').value || 0) + 360) % 360; }
  function draw(c, W, H, screen) {
    if (screen) { var dpr = window.devicePixelRatio || 1; if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); } c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); }
    var hd = heading(), pt = OR.p, fov = +$('#eyFov').value || 63, hf = W > H ? fov * 1.33 : fov, vf = hf * H / W, X = function (az) { return W / 2 + (((az - hd + 540) % 360) - 180) / hf * W; }, Y = function (el) { return H / 2 - (el - pt) / vf * H; };
    var k = Math.max(1, Math.min(W, H) / 400); c.textBaseline = 'alphabetic'; c.direction = 'ltr';
    var bar = function (x, y, w, h) { c.fillStyle = 'rgba(15,23,32,.72)'; c.fillRect(x, y, w, h); };
    if (hd == null) { bar(0, H / 2 - 20 * k, W, 40 * k); c.fillStyle = '#fff'; c.font = 700 * 1 + ' ' + 14 * k + 'px system-ui'; c.textAlign = 'center'; c.fillText('Move the phone in a figure of eight to wake the compass', W / 2, H / 2 + 5 * k); return; }
    if (HZ) { c.beginPath(); for (var x = 0; x <= W; x += 4) { var az = (hd + (x - W / 2) / W * hf + 360) % 360, q = HZ[Math.floor(az) % 360]; var y = Y(q.e); if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.strokeStyle = 'rgba(255,214,102,.95)'; c.lineWidth = 2.2 * k; c.setLineDash([8 * k, 6 * k]); c.stroke(); c.setLineDash([]); }
    var N = 24, strip = []; for (var i = 0; i < N; i++) { var azc = (hd + ((i + 0.5) / N - 0.5) * hf + 360) % 360, hit = cast(azc, pt); strip.push(hit ? PACK.unitAt(hit.ll[0], hit.ll[1]) : null); }
    var sh = 30 * k, sy = H - sh - 64 * k; for (i = 0; i < N; i++) { var u = strip[i]; c.fillStyle = u ? u.col : 'rgba(150,180,210,.5)'; c.globalAlpha = 0.85; c.fillRect(i / N * W, sy, W / N + 1, sh); c.globalAlpha = 1; }
    c.font = 700 + ' ' + 11.5 * k + 'px system-ui'; c.textAlign = 'center'; var s0 = 0; for (i = 1; i <= N; i++) { if (i === N || (strip[i] ? strip[i].id : null) !== (strip[s0] ? strip[s0].id : null)) { if (strip[s0] && (i - s0) / N * W > 60 * k) { var nm = strip[s0].name; var mx = (s0 + i) / 2 / N * W; c.lineWidth = 3 * k; c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeText(nm.length > 28 ? nm.slice(0, 27) + '…' : nm, mx, sy + sh / 2 + 4 * k); c.fillStyle = '#141C24'; c.fillText(nm.length > 28 ? nm.slice(0, 27) + '…' : nm, mx, sy + sh / 2 + 4 * k); } s0 = i; } }
    var hc = cast(hd, pt), uc = hc ? PACK.unitAt(hc.ll[0], hc.ll[1]) : null;
    c.strokeStyle = '#fff'; c.lineWidth = 2 * k; c.beginPath(); c.arc(W / 2, H / 2, 14 * k, 0, 7); c.moveTo(W / 2 - 26 * k, H / 2); c.lineTo(W / 2 - 8 * k, H / 2); c.moveTo(W / 2 + 8 * k, H / 2); c.lineTo(W / 2 + 26 * k, H / 2); c.moveTo(W / 2, H / 2 - 26 * k); c.lineTo(W / 2, H / 2 - 8 * k); c.moveTo(W / 2, H / 2 + 8 * k); c.lineTo(W / 2, H / 2 + 26 * k); c.stroke();
    var L1 = uc ? uc.name : hc ? 'Unmapped ground' : 'Sky — tilt the phone down', L2 = uc ? [uc.int, isFinite(uc.b) ? F(uc.b, 1) + (isFinite(uc.tt) ? '–' + F(uc.tt, 1) : '') + ' Ma' : ''].filter(Boolean).join(' · ') : '', L3 = hc ? 'distance ' + (hc.s < 1000 ? F(hc.s, 0) + ' m' : F(hc.s / 1000, 2) + ' km') + ' · elevation ' + F(hc.z, 0) + ' m' : '', L4 = uc && uc.lith ? uc.lith.slice(0, 60) : '', L5 = CH && CH.length ? 'Colour closest to: ' + CH.map(function (o) { return o.q[0]; }).join(', ') + ' (hint only)' : '';
    var lines = [L1, L2, L3, L4, L5].filter(Boolean); c.font = 700 + ' ' + 14 * k + 'px system-ui'; var bw = Math.max.apply(null, lines.map(function (s) { return c.measureText(s).width; })) + 20 * k, bx = Math.min(W - bw - 8 * k, W / 2 + 30 * k), bh = lines.length * 19 * k + 10 * k, by = H / 2 + 30 * k; if (by + bh > sy - 6 * k) by = H / 2 - 30 * k - bh;
    bar(bx, by, bw, bh); if (uc) { c.fillStyle = uc.col; c.fillRect(bx, by, 5 * k, bh); }
    c.textAlign = 'left'; lines.forEach(function (s, j) { c.font = (j ? 400 : 700) + ' ' + (j ? 12.5 : 14) * k + 'px system-ui'; c.fillStyle = j ? '#d8dee4' : '#fff'; c.fillText(s, bx + 12 * k, by + 20 * k + j * 19 * k); });
    var dip = ($('#eyDip').value || '').trim(), note = ($('#eyNote').value || '').trim(), now = new Date(), top = [POS.lat.toFixed(5) + ', ' + POS.lon.toFixed(5) + (POS.acc ? ' ±' + F(POS.acc, 0) + ' m' : '') + ' · ' + F(eyeZ() - 1.6, 0) + ' m a.s.l.', 'Heading ' + F(hd, 0) + '° true · tilt ' + (pt >= 0 ? '+' : '') + F(pt, 0) + '° · ' + now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'].concat(dip ? ['Bedding ' + dip] : []).concat(note ? [note] : []);
    bar(0, 0, W, top.length * 17 * k + 10 * k); c.textAlign = 'left'; top.forEach(function (s, j) { c.font = (j ? 400 : 700) + ' ' + 12.5 * k + 'px system-ui'; c.fillStyle = '#fff'; c.fillText(s, 10 * k, 18 * k + j * 17 * k); });
    var cards = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; c.font = 700 + ' ' + 12 * k + 'px system-ui'; c.textAlign = 'center'; cards.forEach(function (n, j) { var xx = X(j * 45); if (xx > 10 && xx < W - 10) { c.fillStyle = 'rgba(15,23,32,.6)'; c.fillRect(xx - 16 * k, top.length * 17 * k + 14 * k, 32 * k, 18 * k); c.fillStyle = n === 'N' ? '#FFD666' : '#fff'; c.fillText(n, xx, top.length * 17 * k + 27 * k); } });
    bar(0, H - 26 * k, W, 26 * k); c.fillStyle = '#E8C77A'; c.font = 700 + ' ' + 12 * k + 'px system-ui'; c.textAlign = 'left'; c.fillText('Shandal System · Geological Field Survey', 10 * k, H - 9 * k); c.textAlign = 'right'; c.fillStyle = '#d8dee4'; c.font = 400 + ' ' + 11 * k + 'px system-ui'; c.fillText('dashed: computed skyline', W - 10 * k, H - 9 * k);
  }
  function composite() { var w = vid.videoWidth || 1280, h = vid.videoHeight || 720, c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); return { c: c, g: g, w: w, h: h }; }
  function frame(o) { o.g.drawImage(vid, 0, 0, o.w, o.h); draw(o.g, o.w, o.h, false); }
  function shot() { var o = composite(); frame(o); o.c.toBlob(function (b) { SH.download('shandal-outcrop-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.jpg', b); }, 'image/jpeg', 0.92); }
  function toggleRec() {
    if (rec) { rec.stop(); return; }
    if (!window.MediaRecorder) { SH.toast(t('This browser cannot record video.', 'هذا المتصفح لا يستطيع تسجيل الفيديو.'), 'bad'); return; }
    comp = composite(); var s = comp.c.captureStream(30), types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'], mt = types.filter(function (x) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x); })[0] || '';
    chunks = []; rec = new MediaRecorder(s, mt ? { mimeType: mt, videoBitsPerSecond: 6e6 } : {}); rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () { var type = rec.mimeType || mt || 'video/webm', b = new Blob(chunks, { type: type }); SH.download('shandal-outcrop-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + (/mp4/.test(type) ? '.mp4' : '.webm'), b); rec = null; comp = null; recUi(false); };
    rec.start(1000); recUi(true); (function tick() { if (!rec) return; frame(comp); requestAnimationFrame(tick); })();
  }
  function recUi(on) { $('#eyRec').classList.toggle('ey-rec', on); $('#eyRec').textContent = on ? t('■ Stop and save', '■ أوقف واحفظ') : t('● Record video', '● سجّل فيديو'); $('#eyFsRec').textContent = on ? '■' : '●'; }

  /* ---------------------------------------------------------------- inputs */
  $('#eyGps').addEventListener('click', function () { var b = this; b.disabled = true; $('#eyPos').textContent = t('Taking your position…', 'جارٍ أخذ موقعك…'); SH.gpsFix({ ms: 20000, target: 8 }).then(function (f) { setPos(f.lat, f.lon, { acc: f.acc, alt: f.alt }); }).catch(function (e) { $('#eyPos').textContent = e.message; }).then(function () { b.disabled = false; }); });
  if (map) map.on('click', function (e) { setPos(e.latlng.lat, e.latlng.lng); });
  $('#eyPack').addEventListener('click', function () { if (!POS) { SH.toast(t('Choose a place first.', 'اختر مكاناً أولاً.'), 'warn'); return; } build(POS.lat, POS.lon, function (m) { $('#eyStat').textContent = m; }).then(function (p) { PACK = prep(p); $('#eyStat').textContent = t('Saved for use without network.', 'حُفظت للعمل دون شبكة.'); packsInfo(); sheet(); }).catch(function (e) { $('#eyStat').textContent = e.message || String(e); }); });
  $('#eyPackTrip').addEventListener('click', function () { var b = this, i = 0; b.disabled = true; (function next() { if (i >= TRIP.length) { b.disabled = false; $('#eyStat').textContent = t('All 9 stops are saved on this phone.', 'حُفظت المحطات التسع كلها على هذا الهاتف.'); packsInfo(); return; } var p = TRIP[i++]; build(p[0], p[1], function (m) { $('#eyStat').textContent = t('Stop ', 'المحطة ') + i + '/9 — ' + m; }).catch(function () {}).then(next); })(); });
  $('#eyOffR').addEventListener('input', function () { $('#eyOff').value = this.value; persist.save(); }); $('#eyOff').addEventListener('input', function () { $('#eyOffR').value = this.value; });
  $('#eyStart').addEventListener('click', startCam); $('#eyShot').addEventListener('click', shot); $('#eyRec').addEventListener('click', toggleRec); $('#eyFsShot').addEventListener('click', shot); $('#eyFsRec').addEventListener('click', toggleRec);
  $('#eyFs').addEventListener('click', function () { $('#eyCam').classList.add('fs'); }); $('#eyFsX').addEventListener('click', function () { $('#eyCam').classList.remove('fs'); });
  document.addEventListener('DOMContentLoaded', function () { $('#eyOffR').value = $('#eyOff').value || 0; packsInfo(); });
  window.SHEYE = { setPos: setPos, cast: cast, ori: OR, get PACK() { return PACK; }, draw: draw };
})();
