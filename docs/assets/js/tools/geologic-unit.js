/* Geological Unit Finder — Macrostrat integrated geological map at any point: the units at every available map
   scale with age, lithology, description and source map; place name (OpenStreetMap Nominatim); unit boundary
   on demand; position on the ICS time scale; the local stratigraphic succession (Macrostrat measured column
   where it exists, otherwise the map units cropping out within 25 km ordered by age); a written description and
   interpretation; links to the source maps and other services; CSV, GeoJSON, PNG and PDF outputs. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', ST = SH.strat;
  var INK = '#1B232B', MUT = '#55616B', API = 'https://macrostrat.org/api/v2/', NOM = 'https://nominatim.openstreetmap.org/';
  var persist = SH.persist('geounit', ['uLat', 'uLon', 'uOv', 'uOp', 'uLab', 'uNb', 'uTitle', 'uSheetTs']);
  var map = SH.map('uMap', { zoom: 6, base: 'light', center: [33.3, 43.5] }), ov = null, mk = null, polys = {}, polyLayer = null;
  var S0 = { lat: NaN, lon: NaN, place: null, units: [], elev: null, col: [], colMode: '', nb: [], seq: 0 };

  /* ---------- map furniture: overlay, graphic scale with representative fraction, north arrow */
  function overlay() { if (!map) return; if (ov) { map.removeLayer(ov); ov = null; } if (!$('#uOv').checked) return; ov = L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: (SH.num('uOp') || 60) / 100, maxZoom: 18, crossOrigin: true, attribution: 'Geology © <a href="https://macrostrat.org">Macrostrat</a> (CC BY 4.0)' }).addTo(map); }
  if (map) {
    var dsc = map.getContainer().querySelector('.leaflet-control-scale'); if (dsc) dsc.remove();
    var Scale = L.Control.extend({ options: { position: 'bottomleft' }, onAdd: function () { var e = L.DomUtil.create('div', 'gu-scale'); e.style.direction = 'ltr'; L.DomEvent.disableClickPropagation(e); this._e = e; return e; } });
    var North = L.Control.extend({ options: { position: 'topright' }, onAdd: function () { var e = L.DomUtil.create('div', 'gu-north'); e.innerHTML = '<svg viewBox="0 0 40 52" width="34" height="44" aria-label="North"><circle cx="20" cy="30" r="17" fill="rgba(255,255,255,.9)" stroke="#1B232B" stroke-width=".8"/><path d="M20 14 L27 40 L20 34 Z" fill="#fff" stroke="#1B232B" stroke-width="1"/><path d="M20 14 L13 40 L20 34 Z" fill="#1B232B"/><text x="20" y="10" text-anchor="middle" font-size="11" font-weight="800" fill="#1B232B">N</text></svg>'; return e; } });
    var sc = new Scale(); sc.addTo(map); new North().addTo(map);
    var upd = function () { var c = map.getSize(), y = c.y / 2, a = map.containerPointToLatLng([0, y]), b = map.containerPointToLatLng([100, y]), mpp = map.distance(a, b) / 100, want = mpp * 150, p = Math.pow(10, Math.floor(Math.log10(want))), n = want / p, len = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p, px = len / mpp;
      var lab = function (m) { return m >= 1000 ? SH.fmt(m / 1000, m % 1000 ? 1 : 0) + ' km' : SH.fmt(m, 0) + ' m'; }, rf = mpp / 0.000264583, rp = Math.pow(10, Math.floor(Math.log10(rf)) - 1), rfN = Math.round(rf / rp) * rp, segs = '';
      for (var i = 0; i < 4; i++) segs += '<rect x="' + (10 + i * px / 4) + '" y="18" width="' + px / 4 + '" height="6" fill="' + (i % 2 ? '#fff' : '#1B232B') + '"/>';
      var bw0 = Math.max(px + 44, 150); sc._e.innerHTML = '<svg width="' + bw0 + '" height="44" style="display:block;direction:ltr"><rect x="0" y="0" width="' + bw0 + '" height="44" rx="6" fill="rgba(255,255,255,.9)"/>' + segs + '<rect x="10" y="18" width="' + px + '" height="6" fill="none" stroke="#1B232B" stroke-width=".8"/>' +
        '<text x="10" y="14" font-size="10" font-weight="700" text-anchor="middle" fill="#1B232B">0</text><text x="' + (10 + px / 2) + '" y="14" font-size="10" text-anchor="middle" fill="#1B232B">' + lab(len / 2).replace(/ (k?m)$/, '') + '</text><text x="' + (10 + px) + '" y="14" font-size="10" font-weight="700" text-anchor="middle" fill="#1B232B">' + lab(len) + '</text>' +
        '<text x="10" y="38" font-size="10" fill="#55616B">1 : ' + rfN.toLocaleString('en-US') + ' (96 dpi)</text></svg>'; };
    map.on('zoomend moveend resize', upd); upd();
  }
  overlay(); $('#uOv').addEventListener('change', function () { persist.save(); overlay(); }); $('#uOp').addEventListener('input', function () { if (ov) ov.setOpacity(SH.num('uOp') / 100); });
  $('#uLab').addEventListener('change', label);

  /* ---------- helpers */
  var JS = function (u, ms) { return SH.getJSON(u, { timeout: ms || 25000 }); };
  var data = function (j) { return j && j.success ? j.success.data : j && j.data || j; };
  var fmtMa = function (v) { return isFinite(v) ? SH.fmt(v, v < 10 ? 2 : 1) : '—'; };
  var ERA = [['Cenozoic', 0, 66, '#F2F91D'], ['Mesozoic', 66, 251.902, '#67C5CA'], ['Paleozoic', 251.902, 538.8, '#99C08D'], ['Neoproterozoic', 538.8, 1000, '#FEB342'], ['Mesoproterozoic', 1000, 1600, '#FDB462'], ['Paleoproterozoic', 1600, 2500, '#F74370'], ['Archean', 2500, 4031, '#F0047F'], ['Hadean', 4031, 4567, '#AE027E']];
  var SCN = { large: [t('large scale (detailed)', 'مقياس كبير (تفصيلي)'), 100000], medium: [t('medium scale', 'مقياس متوسط'), 1000000], small: [t('small scale', 'مقياس صغير'), 5000000], tiny: [t('global compilation', 'تجميع عالمي'), 15000000] };
  var ORD = { large: 0, medium: 1, small: 2, tiny: 3 };
  function scaleClass(u) { var d = denom(u); if (!isFinite(d)) return u.scale; return d <= 250000 ? 'large' : d <= 2500000 ? 'medium' : d < 15000000 ? 'small' : 'tiny'; }
  function denom(u) { var m = /1\s*:\s*([\d.,]+)\s*([MmKk])?/.exec(u.src + ' ' + (u.scaleTxt || '')); if (m) { var v = parseFloat(m[1].replace(/,/g, '')); return m[2] && /m/i.test(m[2]) ? v * 1e6 : m[2] && /k/i.test(m[2]) ? v * 1e3 : v; } return SCN[u.scale] ? SCN[u.scale][1] : NaN; }
  function norm(u) {
    var bi = u.b_int || {}, ti = u.t_int || {}, ref = u.ref || {};
    var liths = u.lith || (u.liths || []).map(function (l) { return l.lith || l.name; }).join(', ') || (u.macrostrat && (u.macrostrat.liths || []).map(function (l) { return l.lith || l.name; }).join(', ')) || '';
    var env = (u.macrostrat && (u.macrostrat.environs || []).map(function (e) { return e.environ || e.name; }).join(', ')) || '';
    return { map_id: u.map_id, name: u.name || u.unit_name || '', strat: u.strat_name || (u.macrostrat && u.macrostrat.strat_names && u.macrostrat.strat_names.map(function (s) { return s.rank_name || s.strat_name; }).join(', ')) || '', lith: liths, env: env, desc: u.descrip || '', comm: u.comments || '',
      b_int: u.b_int_name || bi.int_name || '', t_int: u.t_int_name || ti.int_name || '', b_age: +(u.b_age != null ? u.b_age : u.b_int_age != null ? u.b_int_age : bi.b_age), t_age: +(u.t_age != null ? u.t_age : u.t_int_age != null ? u.t_int_age : ti.t_age),
      color: u.color || '#ccc', scale: u.scale || ref.scale || '', src: ref.name || ref.ref_title || u.source || '', title: ref.ref_title || '', url: ref.url || '', authors: ref.authors || '', year: ref.ref_year || '', doi: ref.isbn_doi || '', source_id: u.source_id || ref.source_id, scaleTxt: ref.scale || '' };
  }
  function lithKey(s) { s = String(s || '').toLowerCase(); var K = [[/dolomit|dolostone/, 'dolomite'], [/chalk/, 'chalk'], [/marl/, 'marl'], [/oolit/, 'oolitic'], [/reef|boundstone/, 'reef'], [/limestone|carbonate|calcar/, 'limestone'], [/anhydrite/, 'anhydrite'], [/gypsum|evaporite/, 'gypsum'], [/halite|salt/, 'halite'], [/conglomerate/, 'conglomerate'], [/breccia/, 'breccia'],
      [/sandstone|arenite|greywacke|arkose/, 'sandstone'], [/siltstone/, 'siltstone'], [/claystone/, 'claystone'], [/mudstone/, 'mudstone'], [/shale/, 'shale'], [/chert/, 'chert'], [/phosph/, 'phosphorite'], [/coal|lignite/, 'coal'], [/gravel|alluvi|fan/, 'gravel'], [/sand|dune|eolian|aeolian/, 'sand'], [/silt|loess/, 'silt'], [/clay|mud/, 'clay'],
      [/tuff|pyroclast/, 'tuff'], [/basalt|mafic volcanic|lava/, 'basalt'], [/andesit/, 'andesite'], [/rhyolit|felsic volcanic/, 'rhyolite'], [/gabbro|ultramafic|ophiolit/, 'gabbro'], [/diorit/, 'diorite'], [/granit|plutonic|intrusive|felsic/, 'granite'], [/serpentin/, 'serpentinite'], [/marble/, 'marble'], [/quartzite/, 'quartzite'], [/gneiss|migmatit/, 'gneiss'], [/schist/, 'schist'], [/phyllite/, 'phyllite'], [/slate/, 'slate'], [/metamorph/, 'schist'], [/volcanic/, 'basalt']];
    for (var i = 0; i < K.length; i++) if (K[i][0].test(s)) return K[i][1]; return ''; }
  function per(ma) { return SH.icsAt(ma); }
  function placeTxt(p, short) { if (!p) return ''; var a = p.address || {}, loc = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || '', st = a.state || a.province || a.region || '', c = a.country || ''; return (short ? [loc || st, c] : [loc, st, c]).filter(function (v, i, arr) { return v && arr.indexOf(v) === i; }).join(AR ? '، ' : ', '); }

  /* ---------- place search and reverse geocoding (OpenStreetMap Nominatim) */
  function reverse(lat, lon) { return JS(NOM + 'reverse?format=jsonv2&zoom=10&lat=' + lat.toFixed(5) + '&lon=' + lon.toFixed(5) + '&accept-language=' + (AR ? 'ar,en' : 'en'), 12000).catch(function () { return null; }); }
  function search() { var q = SH.val('uQ').trim(); if (!q) return; $('#uHits').innerHTML = '<span class="muted">' + t('Searching…', 'جارٍ البحث…') + '</span>';
    JS(NOM + 'search?format=jsonv2&limit=6&q=' + encodeURIComponent(q) + '&accept-language=' + (AR ? 'ar,en' : 'en'), 12000).then(function (r) { r = Array.isArray(r) ? r : [];
      $('#uHits').innerHTML = r.length ? r.map(function (h, i) { return '<button type="button" class="btn btn-line btn-xs" style="justify-content:flex-start;text-align:start;white-space:normal" data-i="' + i + '">' + SH.esc(h.display_name) + '</button>'; }).join('') : '<span class="muted">' + t('No match.', 'لا نتائج.') + '</span>';
      $('#uHits').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; var h = r[+b.getAttribute('data-i')]; $('#uHits').innerHTML = ''; var la = +h.lat, lo = +h.lon; if (map) map.setView([la, lo], 10); query(la, lo); }; })
      .catch(function () { $('#uHits').innerHTML = '<span style="color:var(--danger)">' + t('Place search is unavailable at the moment.', 'البحث عن الأماكن غير متاح حالياً.') + '</span>'; }); }
  $('#uFind').addEventListener('click', search); $('#uQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  function label() { if (!mk) return; mk.unbindTooltip(); var s = placeTxt(S0.place, true); if ($('#uLab').checked && s) mk.bindTooltip(SH.esc(s), { permanent: true, direction: 'bottom', offset: [0, 12], className: 'gu-lab' }).openTooltip(); }

  /* ---------- queries */
  function units(lat, lon) {
    var z = map ? Math.max(3, map.getZoom()) : 8;
    return JS(API + 'mobile/map_query?lat=' + lat.toFixed(5) + '&lng=' + lon.toFixed(5) + '&z=' + z).then(function (j) { var d = data(j) || {}; var arr = d.burwell || d.mapData || d; return { units: (Array.isArray(arr) ? arr : []).map(norm), elev: d.elevation }; })
      .catch(function () { return { units: [], elev: null }; })
      .then(function (r) { return JS(API + 'geologic_units/map?lat=' + lat.toFixed(5) + '&lng=' + lon.toFixed(5)).then(function (j) { var d = data(j), refs = (j.success && j.success.refs) || {};
        var more = (Array.isArray(d) ? d : []).map(function (u) { if (!u.ref && refs[u.source_id]) u.ref = { name: refs[u.source_id] }; return norm(u); }).filter(function (x) { return !r.units.some(function (y) { return y.name === x.name && y.b_age === x.b_age; }); });
        r.units = r.units.concat(more); return r; }).catch(function () { return r; }); })
      .then(function (r) { r.units = r.units.filter(function (u) { return u.name || u.lith; }); r.units.sort(function (a, b) { return (ORD[a.scale] != null ? ORD[a.scale] : 9) - (ORD[b.scale] != null ? ORD[b.scale] : 9); }); return r; });
  }
  function column(lat, lon) { return JS(API + 'units?lat=' + lat.toFixed(5) + '&lng=' + lon.toFixed(5) + '&response=long', 20000).then(function (j) { var d = data(j); return Array.isArray(d) ? d : []; }).catch(function () { return []; }); }
  function neighbours(lat, lon, scale) {
    var pts = [], R = [10, 25]; R.forEach(function (km) { for (var a = 0; a < 360; a += 45) { var dy = km / 111.2 * Math.cos(a * Math.PI / 180), dx = km / (111.2 * Math.cos(lat * Math.PI / 180)) * Math.sin(a * Math.PI / 180); pts.push([lat + dy, lon + dx]); } });
    var out = [], i = 0, run = function () { if (i >= pts.length) return Promise.resolve(); var p = pts.slice(i, i + 4); i += 4;
      return Promise.all(p.map(function (q) { return JS(API + 'geologic_units/map?lat=' + q[0].toFixed(5) + '&lng=' + q[1].toFixed(5) + (scale ? '&scale=' + scale : ''), 20000).then(function (j) { var d = data(j); (Array.isArray(d) ? d : []).forEach(function (u) { out.push(norm(u)); }); }).catch(function () {}); })).then(run); };
    return run().then(function () { return out; });
  }
  function query(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return; var seq = ++S0.seq;
    $('#uLat').value = lat.toFixed(5); $('#uLon').value = lon.toFixed(5); persist.save(); S0.lat = lat; S0.lon = lon; S0.place = null; clearPolys();
    if (map) { if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); mk.unbindTooltip(); }
    $('#uEmpty').hidden = true; $('#uOut').hidden = false; $('#uKpis').hidden = false;
    $('#uRes').innerHTML = '<div class="xsmall muted" style="padding:14px 16px">' + t('Querying the geological maps…', 'جارٍ الاستعلام من الخرائط الجيولوجية…') + '</div>';
    S0.placeEn = null; reverse(lat, lon).then(function (p) { if (seq !== S0.seq) return; S0.place = p; label(); kpis(); narrative(); if (!AR) { S0.placeEn = p; return; } return new Promise(function (r) { setTimeout(r, 1100); }).then(function () { return JS(NOM + 'reverse?format=jsonv2&zoom=10&lat=' + lat.toFixed(5) + '&lon=' + lon.toFixed(5) + '&accept-language=en', 12000); }).then(function (q) { if (seq === S0.seq) S0.placeEn = q; }).catch(function () {}); });
    units(lat, lon).then(function (r) {
      if (seq !== S0.seq) return; S0.units = r.units; S0.elev = r.elev; S0.col = []; S0.nb = []; S0.colMode = ''; render(); kpis(); timescale(); narrative(); table(); drawCol();
      return column(lat, lon).then(function (c) { if (seq !== S0.seq) return; if (c.length) { S0.col = c; S0.colMode = 'col'; drawCol(); narrative(); return; }
        if (!$('#uNb').checked || !S0.units.length) { drawCol(); return; }
        S0.colMode = 'wait'; drawCol(); var best = S0.units[0].scale;
        return neighbours(lat, lon, best).then(function (nb) { if (seq !== S0.seq) return; var all = S0.units.filter(function (u) { return u.scale === best; }).concat(nb.filter(function (u) { return !best || u.scale === best || !u.scale; }));
          var seen = {}; S0.nb = all.filter(function (u) { var k = u.name + '|' + u.b_age + '|' + u.t_age; if (seen[k] || !isFinite(u.b_age)) return false; seen[k] = 1; return true; }); S0.colMode = S0.nb.length ? 'map' : ''; drawCol(); narrative(); table(); }); });
    }).catch(function (e) { $('#uRes').innerHTML = '<div class="xsmall" style="padding:14px 16px;color:var(--danger)">' + SH.esc(e.message) + '</div>'; });
  }

  /* ---------- KPIs and unit cards */
  function kpis() { var u = S0.units[0], p = u && isFinite(u.b_age) ? per((u.b_age + u.t_age) / 2) : null, d = u ? denom(u) : NaN;
    $('#uKpis').innerHTML = '<div class="kpi info"><span class="k">' + t('Location', 'الموقع') + '</span><span class="v" style="font-size:1rem">' + SH.esc(placeTxt(S0.place, true) || '—') + '</span><span class="s ltr">' + SH.fmtLatLon(S0.lat, S0.lon, 4) + '</span></div>' +
      '<div class="kpi"><span class="k">' + t('Elevation', 'الارتفاع') + '</span><span class="v">' + (S0.elev != null ? SH.fmt(S0.elev, 0) + '<small> m</small>' : '—') + '</span><span class="s">' + t('above sea level', 'فوق مستوى سطح البحر') + '</span></div>' +
      '<div class="kpi"><span class="k">' + t('Unit at the point', 'الوحدة عند النقطة') + '</span><span class="v" style="font-size:1rem">' + SH.esc(u ? u.name : '—') + '</span><span class="s">' + SH.esc(u ? u.lith.split(',').slice(0, 2).join(',') : '') + '</span></div>' +
      '<div class="kpi"><span class="k">' + t('Age', 'العمر') + '</span><span class="v" style="font-size:1rem">' + (p ? (AR ? p[1] : p[0]) : '—') + '</span><span class="s ltr">' + (u && isFinite(u.b_age) ? fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma' : '') + '</span></div>' +
      '<div class="kpi"><span class="k">' + t('Map scale', 'مقياس الخريطة') + '</span><span class="v" style="font-size:1rem">' + (isFinite(d) ? '<bdi>1 : ' + Math.round(d).toLocaleString('en-US') + '</bdi>' : '—') + '</span><span class="s">' + (u && SCN[scaleClass(u)] ? SCN[scaleClass(u)][0] : '') + '</span></div>'; }
  function render() {
    var U = S0.units; if (!U.length) { $('#uRes').innerHTML = '<div class="small muted" style="padding:14px 16px">' + t('No mapped unit here (open water or a gap in coverage).', 'لا توجد وحدة مرسومة هنا (مياه مفتوحة أو فجوة في التغطية).') + '</div>'; return; }
    var row = function (k, v) { return v ? '<tr><th style="width:32%">' + k + '</th><td dir="auto" style="text-align:' + (AR ? 'right' : 'left') + '">' + v + '</td></tr>' : ''; };
    $('#uRes').innerHTML = U.map(function (u, i) { var p = isFinite(u.b_age) ? per((u.b_age + u.t_age) / 2) : null, key = lithKey(u.lith + ' ' + u.name), env = u.env || (key ? ST.facies({ rock: key, st: [] }) : ''), d = denom(u);
      return '<section style="border-top:' + (i ? '1px solid var(--line)' : '0') + '"><div style="padding:14px 16px 8px"><p class="xsmall" style="margin:0;color:var(--accent);font-weight:700">' + (i === 0 ? t('Most detailed · ', 'الأكثر تفصيلاً · ') : '') + (SCN[scaleClass(u)] ? SCN[scaleClass(u)][0] : SH.esc(u.scale || '')) + (isFinite(d) ? ' · <bdi>1:' + Math.round(d).toLocaleString('en-US') + '</bdi>' : '') + '</p><h3 style="margin:4px 0;font-size:1rem;line-height:1.5"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:7px;background:' + SH.esc(u.color) + ';border:1px solid rgba(0,0,0,.25);font-weight:800;font-size:.8rem;color:#111;margin-inline-end:8px">' + (i + 1) + '</span>' + SH.esc(u.name) + '</h3>' +
        (isFinite(u.b_age) ? '<p class="small" style="margin:0"><b>' + SH.esc(u.b_int + (u.t_int && u.t_int !== u.b_int ? ' – ' + u.t_int : '')) + '</b> · <bdi>' + fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma</bdi></p>' : '') + '</div>' +
        '<table class="kv" style="font-size:.84rem">' + row(t('Period', 'العصر'), p ? '<span style="display:inline-block;width:10px;height:10px;background:' + p[4] + ';border:1px solid #888;margin-inline-end:6px"></span>' + (AR ? p[1] + ' <span class="muted">(' + p[0] + ')</span>' : p[0]) : '') + row(t('Stratigraphic name', 'الاسم الطباقي'), SH.esc(u.strat)) + row(t('Lithology', 'الصخارية'), SH.esc(u.lith)) +
        row(t('Depositional setting', 'البيئة الترسيبية'), SH.esc(u.env) || (env ? SH.esc(env) + ' <span class="xsmall muted">(' + t('inferred from the lithology', 'مستنتجة من الصخارية') + ')</span>' : '')) + row(t('Description', 'الوصف'), SH.esc(u.desc)) + row(t('Comments', 'ملاحظات'), SH.esc(u.comm)) + '</table>' +
        '<div class="no-print" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 16px 14px"><button class="btn btn-line btn-xs" data-poly="' + i + '" type="button">' + t('Show unit boundary', 'أظهر حدود الوحدة') + '</button><button class="btn btn-line btn-xs" data-zoom="' + i + '" type="button">' + t('Zoom to unit', 'قرّب إلى الوحدة') + '</button></div></section>'; }).join('') +
      '';
  }

  /* ---------- unit boundary on demand */
  function clearPolys() { polys = {}; if (polyLayer && map) map.removeLayer(polyLayer); polyLayer = map ? L.featureGroup().addTo(map) : null; }
  function getPoly(i) { var u = S0.units[i]; if (polys[i]) return Promise.resolve(polys[i]);
    /* the polygon is requested by its map identifier; if that fails, by the point without a scale filter
       (the services do not always agree on the scale class of a source map) and matched by identifier or name */
    var pick = function (g) { var f = (g && g.features) || []; return f.filter(function (x) { return u.map_id != null && (x.properties || {}).map_id === u.map_id; })[0] || f.filter(function (x) { return (x.properties || {}).name === u.name; })[0] || null; };
    var byId = u.map_id != null ? JS(API + 'geologic_units/map?map_id=' + u.map_id + '&format=geojson_bare', 30000).then(pick).catch(function () { return null; }) : Promise.resolve(null);
    return byId.then(function (f) { return f || JS(API + 'geologic_units/map?lat=' + S0.lat.toFixed(5) + '&lng=' + S0.lon.toFixed(5) + '&format=geojson_bare', 30000).then(pick); }).then(function (f) {
      if (!f || !f.geometry) throw new Error(t('The boundary of this unit is not published by the map service.', 'لا تنشر خدمة الخرائط حدود هذه الوحدة.')); polys[i] = L.geoJSON(f, { style: { color: '#C0392B', weight: 2.2, dashArray: '6 4', fillColor: u.color, fillOpacity: .18 } }); polys[i]._f = f; return polys[i]; }); }
  $('#uRes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b || !map) return; var i = +(b.getAttribute('data-poly') || b.getAttribute('data-zoom'));
    var on = b.hasAttribute('data-poly'); b.disabled = true;
    getPoly(i).then(function (pl) { if (on) { if (polyLayer.hasLayer(pl)) { polyLayer.removeLayer(pl); b.textContent = t('Show unit boundary', 'أظهر حدود الوحدة'); } else { polyLayer.addLayer(pl); b.textContent = t('Hide unit boundary', 'أخفِ حدود الوحدة'); } } else { if (!polyLayer.hasLayer(pl)) polyLayer.addLayer(pl); map.fitBounds(pl.getBounds(), { padding: [24, 24], maxZoom: 13 }); } })
      .catch(function (er) { SH.toast(er.message, 'warn'); }).then(function () { b.disabled = false; }); });

  /* ---------- figure 2: time scale */
  var tx = function (S, x, y, s, a) { return S.text(x, y, s, Object.assign({ fill: INK, 'font-size': 11, direction: 'ltr' }, a || {})); };
  function timescale() {
    var U = S0.units.filter(function (u) { return isFinite(u.b_age); }), S = SH.svgB('uSvg');
    if (!U.length) { S.el.setAttribute('viewBox', '0 0 760 120'); tx(S, 380, 60, 'No dated unit at this point', { 'text-anchor': 'middle', fill: MUT }); $('#uTsCap').innerHTML = ''; return; }
    var mx = Math.max.apply(null, U.map(function (u) { return u.b_age; })), lim = mx < 2.6 ? 2.58 : mx < 23.1 ? 23.03 : mx < 66.1 ? 66 : mx < 252 ? 251.902 : mx < 539 ? 538.8 : mx < 1000 ? 1000 : 4567;
    var top = 46, H = 420, xA = 70, xE = 76, wE = 34, xP = 114, wP = 132, xU = xP + wP + 26, Y = function (ma) { return top + Math.sqrt(Math.min(ma, lim) / lim) * H; };
    var VH = top + H + 40; S.el.setAttribute('viewBox', '0 0 760 ' + VH); S.add('rect', { x: 0, y: 0, width: 760, height: VH, fill: '#fff' });
    tx(S, xA - 34, 28, 'Age (Ma)', { 'font-size': 10.5, 'font-weight': 700 }); tx(S, xE + wE / 2, 28, 'Era', { 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'middle' }); tx(S, xP + wP / 2, 28, 'Period', { 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'middle' }); tx(S, xU, 28, 'Units at the point', { 'font-size': 10.5, 'font-weight': 700 });
    ERA.forEach(function (e) { if (e[1] >= lim) return; var y1 = Y(e[1]), y2 = Y(e[2]); S.add('rect', { x: xE, y: y1, width: wE, height: y2 - y1, fill: e[3], stroke: INK, 'stroke-width': .6 }); if (y2 - y1 > 52) { var cx = xE + wE / 2, cy = (y1 + y2) / 2; tx(S, cx, cy + 4, e[0], { 'font-size': 10, 'font-weight': 700, 'text-anchor': 'middle', transform: 'rotate(-90 ' + cx + ' ' + cy + ')' }); } });
    var lastY = -99; SH.ics.forEach(function (p) { if (p[2] >= lim) return; var y1 = Y(p[2]), y2 = Y(p[3]); S.add('rect', { x: xP, y: y1, width: wP, height: y2 - y1, fill: p[4], stroke: INK, 'stroke-width': .6 }); if (y2 - y1 > 12) tx(S, xP + wP / 2, (y1 + y2) / 2 + 4, p[0], { 'font-size': 10.5, 'text-anchor': 'middle' });
      if (y1 - lastY >= 11) { tx(S, xA, y1 + 4, SH.fmt(p[2], p[2] < 10 && p[2] ? 2 : p[2] % 1 ? 1 : 0), { 'font-size': 9.5, fill: MUT, 'text-anchor': 'end' }); S.line(xA + 2, y1, xE, y1, { stroke: MUT, 'stroke-width': .6 }); lastY = y1; } });
    if (Y(lim) - lastY >= 11) tx(S, xA, Y(lim) + 4, SH.fmt(lim, lim < 10 ? 2 : lim % 1 ? 1 : 0), { 'font-size': 9.5, fill: MUT, 'text-anchor': 'end' });
    var n = Math.min(U.length, 8), bw = 16;
    U.slice(0, n).forEach(function (u, i) { var y1 = Y(u.t_age), y2 = Y(u.b_age), x = xU + i * (bw + 8), h = Math.max(4, y2 - y1); S.add('rect', { x: x, y: y1, width: bw, height: h, fill: u.color, stroke: INK, 'stroke-width': 1 }); S.line(xP + wP, y1, x, y1, { stroke: MUT, 'stroke-width': .5, 'stroke-dasharray': '2 3' }); S.line(xP + wP, y1 + h, x, y1 + h, { stroke: MUT, 'stroke-width': .5, 'stroke-dasharray': '2 3' });
      tx(S, x + bw / 2, y1 - 5, String(i + 1), { 'font-size': 10.5, 'font-weight': 800, 'text-anchor': 'middle' }); });
    var lx = xU + n * (bw + 8) + 14, ly = 74; tx(S, lx, ly - 14, 'LEGEND', { 'font-size': 10, 'font-weight': 800, 'letter-spacing': 1 });
    U.slice(0, n).forEach(function (u, i) { var y = ly + i * 34; S.add('rect', { x: lx, y: y - 9, width: 14, height: 14, fill: u.color, stroke: INK, 'stroke-width': .8 }); tx(S, lx + 7, y + 2, String(i + 1), { 'font-size': 9, 'font-weight': 800, 'text-anchor': 'middle' });
      var nm = u.name.length > 46 ? u.name.slice(0, 44) + '…' : u.name; tx(S, lx + 22, y + 2, nm, { 'font-size': 10.5, 'font-weight': 700 }); tx(S, lx + 22, y + 16, (u.scale || '') + ' scale · ' + fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma', { 'font-size': 9.5, fill: MUT }); });
    S.add('rect', { x: 6, y: 6, width: 748, height: VH - 12, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    $('#uTsCap').innerHTML = t('Each numbered bar spans the age of the unit with the same number in the unit list; the age axis is scaled to the square root of time so that young intervals remain legible. ', 'يمتد كل عمود مرقّم على عمر الوحدة التي تحمل الرقم نفسه في قائمة الوحدات، ومحور العمر متناسب مع الجذر التربيعي للزمن لتبقى الفترات الحديثة مقروءة. ') +
      (U.length > 1 ? (U.every(function (u) { return u.b_age >= U[0].t_age && u.t_age <= U[0].b_age; }) ? t('The intervals overlap, so the map scales agree on the age; the detailed map narrows it.', 'تتداخل الفترات، فالمقاييس متفقة على العمر، والخريطة التفصيلية تضيّقه.') : t('The intervals do not overlap: the generalised maps assign a different age at this point. Prefer the most detailed map and verify in the field.', 'الفترات غير متداخلة: الخرائط المعممة تعطي عمراً مختلفاً عند هذه النقطة. يُعتمد على الخريطة الأكثر تفصيلاً مع التحقق الحقلي.')) : t('Only one map scale covers this point.', 'يغطي هذه النقطة مقياس خرائطي واحد فقط.'));
  }

  /* ---------- figure 3: local succession */
  function colRows() {
    if (S0.colMode === 'col') return S0.col.map(function (u) { var lt = (u.lith || []).slice().sort(function (a, b) { return (b.prop || 0) - (a.prop || 0); }); return { name: u.unit_name || u.strat_name_long || '', fm: u.Fm || '', gp: u.Gp || '', t: +u.t_age, b: +u.b_age, th: +(u.max_thick || u.min_thick || 0), lith: lt.map(function (l) { return l.name || l.lith; }).join(', '), key: lithKey(lt.map(function (l) { return l.name || l.lith; }).join(' ')), env: (u.environ || []).map(function (e) { return e.name || e.environ; }).join(', '), color: u.color || '#ddd' }; }).sort(function (a, b) { return a.t - b.t || a.b - b.b; });
    if (S0.colMode === 'map') return S0.nb.map(function (u) { return { name: u.name, fm: u.strat || '', gp: '', t: u.t_age, b: u.b_age, th: 0, lith: u.lith, key: lithKey(u.lith + ' ' + u.name), env: u.env, color: u.color, here: S0.units.some(function (x) { return x.name === u.name && x.b_age === u.b_age; }) }; }).sort(function (a, b) { return a.t - b.t || a.b - b.b; });
    return [];
  }
  function wavy(S, x1, x2, y) { var n = Math.max(4, Math.round((x2 - x1) / 12)), s = (x2 - x1) / n, d = 'M' + x1 + ' ' + y; for (var i = 0; i < n; i++) d += 'q' + s / 2 + ' ' + (i % 2 ? 4 : -4) + ' ' + s + ' 0'; S.path(d, { stroke: '#C0392B', 'stroke-width': 1.6, fill: 'none' }); }
  function drawCol() {
    var S = SH.svgB('uCol'), defs = S.add('defs', {}), rows = colRows(), W = 900;
    var msg = function (s) { S.el.setAttribute('viewBox', '0 0 900 120'); S.add('rect', { x: 0, y: 0, width: 900, height: 120, fill: '#fff' }); tx(S, 450, 64, s, { 'text-anchor': 'middle', fill: MUT, 'font-size': 13 }); $('#uColCap').innerHTML = ''; $('#uColDes').hidden = true; };
    if (S0.colMode === 'wait') return msg('Surveying the units mapped within 25 km of the point…');
    if (!rows.length) return msg(S0.units.length ? 'No measured column or neighbouring map units are available for this point.' : 'No geological data at this point.');
    $('#uColDes').hidden = false;
    var real = S0.colMode === 'col' && rows.every(function (r) { return r.th > 0; }), tot = rows.reduce(function (a, r) { return a + r.th; }, 0);
    var C = [['sys', 92, 'System'], ['unit', 210, S0.colMode === 'col' ? 'Unit / Formation' : 'Map unit'], ['age', 92, 'Age (Ma)'], ['lith', 130, 'Lithology'], ['thk', 56, real ? 'Thick. (m)' : 'Gap (Myr)'], ['desc', 0, 'Lithology and setting']], x = 20;
    C[5][1] = W - 40 - C.slice(0, 5).reduce(function (a, c) { return a + c[1]; }, 0); C.forEach(function (c) { c.x = x; x += c[1]; }); var col = function (k) { return C.filter(function (c) { return c[0] === k; })[0]; };
    var top = 60, HH = 34, y0 = top + HH, hs = rows.map(function (r) { return real ? Math.max(24, r.th / tot * Math.max(420, rows.length * 34)) : 36; }), ys = [y0]; hs.forEach(function (h) { ys.push(ys[ys.length - 1] + h); }); var yb = ys[ys.length - 1];
    var usedK = {}; rows.forEach(function (r) { if (r.key) usedK[r.key] = 1; }); var gaps = rows.some(function (r, i) { return i && r.t - rows[i - 1].b > 0.5; });
    var VH = yb + 60 + Math.ceil((Object.keys(usedK).length + 3) / 4) * 26 + 20;
    S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); var bg = S.add('rect', { x: 0, y: 0, width: W, height: VH, fill: '#fff' });
    tx(S, W / 2, 34, S0.colMode === 'col' ? 'Stratigraphic column at the point' : 'Generalised succession of the map units within 25 km', { 'font-size': 16, 'font-weight': 800, 'text-anchor': 'middle' });
    S.add('rect', { x: 20, y: top, width: W - 40, height: HH, fill: '#F2F0EA', stroke: INK, 'stroke-width': 1.1 });
    C.forEach(function (c) { tx(S, c.x + c[1] / 2, top + HH / 2 + 4, c[2], { 'font-size': 10.5, 'font-weight': 800, 'text-anchor': 'middle' }); S.line(c.x, top, c.x, yb, { stroke: INK, 'stroke-width': .9 }); });
    S.add('rect', { x: 20, y: top, width: W - 40, height: yb - top, fill: 'none', stroke: INK, 'stroke-width': 1.3 });
    // system cells (merged by ICS period of the mean age)
    var pk = function (r) { var p = per((r.t + r.b) / 2); return p ? p[0] : ''; }, s0 = 0;
    for (var i = 1; i <= rows.length; i++) if (i === rows.length || pk(rows[i]) !== pk(rows[s0])) { var p = per((rows[s0].t + rows[s0].b) / 2), c = col('sys'), ya = ys[s0], hh = ys[i] - ya; S.add('rect', { x: c.x, y: ya, width: c[1], height: hh, fill: p ? p[4] : '#fff', stroke: INK, 'stroke-width': .8 }); if (p && hh >= 16) tx(S, c.x + c[1] / 2, ya + hh / 2 + 4, p[0], { 'font-size': p[0].length > 11 ? 9 : 10, 'font-weight': 800, 'text-anchor': 'middle' }); s0 = i; }
    var wrap = function (s, n) { var w = String(s || '').split(/\s+/), o = ['']; w.forEach(function (x) { if ((o[o.length - 1] + ' ' + x).trim().length > n && o[o.length - 1]) o.push(x); else o[o.length - 1] = (o[o.length - 1] + ' ' + x).trim(); }); return o; };
    rows.forEach(function (r, i) { var ya = ys[i], h = hs[i], cy = ya + h / 2, lc = col('lith');
      C.slice(1).forEach(function (c) { S.line(c.x, ys[i + 1], c.x + c[1], ys[i + 1], { stroke: '#9AA3AD', 'stroke-width': .6 }); });
      var un = col('unit'), ln = wrap(r.name + (r.fm && r.fm !== r.name ? ' (' + r.fm + ')' : ''), 34).slice(0, Math.max(1, Math.floor(h / 12))); ln.forEach(function (l, j) { tx(S, un.x + 8, cy + 4 + (j - (ln.length - 1) / 2) * 12, l, { 'font-size': 10.5, 'font-weight': r.here ? 800 : 600 }); });
      if (r.here) { S.path('M' + (un.x + un[1] - 4) + ' ' + cy + 'l-9 -6v12z', { fill: '#C0392B' }); }
      var ag = col('age'); tx(S, ag.x + ag[1] / 2, cy + 4, fmtMa(r.b) + '–' + fmtMa(r.t), { 'font-size': 10, 'text-anchor': 'middle' });
      if (r.key && ST && ST.R[r.key]) { var id = 'gc' + i; ST.pattern(S, defs, id, ST.R[r.key][3]); S.add('rect', { x: lc.x, y: ya, width: lc[1], height: h, fill: ST.R[r.key][2] }); S.add('rect', { x: lc.x, y: ya, width: lc[1], height: h, fill: 'url(#' + id + ')' }); }
      else { S.add('rect', { x: lc.x, y: ya, width: lc[1], height: h, fill: r.color }); }
      S.add('rect', { x: lc.x, y: ya, width: lc[1], height: h, fill: 'none', stroke: INK, 'stroke-width': .8 });
      var th = col('thk'); if (real) tx(S, th.x + th[1] / 2, cy + 4, SH.fmt(r.th, 0), { 'font-size': 10, 'text-anchor': 'middle' });
      var de = col('desc'), dl = wrap([r.lith, r.env].filter(Boolean).join(' · '), Math.floor(de[1] / 5.8)).slice(0, Math.max(1, Math.floor(h / 12))); dl.forEach(function (l, j) { tx(S, de.x + 8, cy + 4 + (j - (dl.length - 1) / 2) * 12, l, { 'font-size': 9.5, fill: MUT }); });
    });
    // age gaps between successive units: unconformity or missing map units
    rows.forEach(function (r, i) { if (!i) return; var gap = r.t - rows[i - 1].b; if (gap > 0.5) { var th = col('thk'); wavy(S, col('unit').x, th.x, ys[i]); wavy(S, th.x + th[1], 20 + W - 40, ys[i]); var gl = SH.fmt(gap, gap < 10 ? 1 : 0); S.add('rect', { x: th.x + 6, y: ys[i] - 8, width: th[1] - 12, height: 16, rx: 4, fill: '#fff', stroke: '#C0392B', 'stroke-width': 1 }); tx(S, th.x + th[1] / 2, ys[i] + 4, gl, { 'font-size': 9.5, 'font-weight': 700, fill: '#C0392B', 'text-anchor': 'middle' }); } });
    // explanation
    var ly = yb + 30, items = []; tx(S, 20, ly, 'EXPLANATION', { 'font-size': 12, 'font-weight': 800, 'letter-spacing': 1.4 });
    Object.keys(usedK).forEach(function (k) { items.push([function (x, y) { var id = 'gl' + k; ST.pattern(S, defs, id, ST.R[k][3]); S.add('rect', { x: x, y: y - 9, width: 34, height: 18, fill: ST.R[k][2], stroke: INK, 'stroke-width': .7 }); S.add('rect', { x: x, y: y - 9, width: 34, height: 18, fill: 'url(#' + id + ')', stroke: INK, 'stroke-width': .7 }); }, ST.R[k][0]]); });
    if (rows.some(function (r) { return !r.key; })) items.push([function (x, y) { S.add('rect', { x: x, y: y - 9, width: 34, height: 18, fill: '#ddd', stroke: INK, 'stroke-width': .7 }); }, 'Undifferentiated (source-map colour)']);
    if (gaps) items.push([function (x, y) { wavy(S, x, x + 34, y); }, real ? 'Unconformity / time gap' : 'Age gap between map units (Myr)']);
    if (S0.colMode === 'map') items.push([function (x, y) { S.path('M' + (x + 30) + ' ' + y + 'l-9 -6v12z', { fill: '#C0392B' }); }, 'Unit mapped at the point']);
    items.forEach(function (it, i) { var x2 = 20 + (i % 4) * ((W - 40) / 4), y2 = ly + 24 + Math.floor(i / 4) * 26; it[0](x2, y2); tx(S, x2 + 44, y2 + 4, it[1], { 'font-size': 10 }); });
    var VH2 = ly + 24 + Math.ceil(items.length / 4) * 26 + 14; S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH2); bg.setAttribute('height', VH2); S.add('rect', { x: 6, y: 6, width: W - 12, height: VH2 - 12, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    $('#uColCap').innerHTML = (S0.colMode === 'col' ? t('Measured column at the point; unit heights are proportional to thickness. ', 'عمود مقيس عند النقطة؛ ارتفاعات الوحدات متناسبة مع سماكاتها. ') : t('Map units cropping out within 25 km, ordered by age from youngest (top) to oldest; heights are schematic because map units carry no thickness. ', 'وحدات الخريطة المكشوفة ضمن 25 كم مرتبة بحسب العمر من الأحدث (أعلى) إلى الأقدم؛ والارتفاعات تخطيطية لأن وحدات الخرائط لا تحمل سمكاً. ')) + (gaps ? t('Red wavy lines mark time not represented by any unit: unconformities, non-deposition, or units not exposed in the area.', 'تشير الخطوط الحمراء المتموجة إلى زمن غير ممثل بأي وحدة: عدم توافق أو انقطاع في الترسيب أو وحدات غير مكشوفة في المنطقة.') : t('The units form a continuous age sequence with no gap larger than 0.5 Myr.', 'تشكل الوحدات تتابعاً عمرياً متصلاً بلا فجوة تزيد على 0.5 مليون سنة.'));
  }
  function HALO(a) { return Object.assign(a, { stroke: '#fff', 'stroke-width': 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }); }
  $('#uColDes').addEventListener('click', function () { var rows = colRows(); if (!rows.length) return;
    var go = function () { SH.store.set('shandal_strata_units', rows.map(function (r) { return { fm: r.fm || r.name, grp: r.gp || '', age: '', ma: (r.t + r.b) / 2, ageTxt: fmtMa(r.b) + '–' + fmtMa(r.t) + ' Ma', rock: r.key || 'limestone', sec: '', mix: 'inter', th: r.th > 0 ? r.th : 100, gs: '', res: 3, base: 'sharp', st: [], pet: [], col: '', desc: r.lith ? r.lith.charAt(0).toUpperCase() + r.lith.slice(1) : '', com: '' }; }));
      var h = SH.store.get('shandal_tool_strata2', {}); h.cTitle = (S0.colMode === 'col' ? 'Stratigraphic column' : 'Generalised succession') + (placeTxt(S0.place, true) ? ' — ' + placeTxt(S0.place, true) : ''); h.cLoc = SH.fmtLatLon(S0.lat, S0.lon, 4); h.cSrc = S0.colMode === 'col' ? 'Measured column' : 'Map units within 25 km; thicknesses to be set'; h.cScale = 'sch'; SH.store.set('shandal_tool_strata2', h);
      location.href = SH.base + (AR ? 'ar/' : '') + 'tools/strata/app/'; };
    var cur = SH.store.get('shandal_strata_units', []); if (cur && cur.length) SH.confirm(t('The Column Designer already holds a column. Replace it with this succession?', 'يحتوي مصمم العمود على عمود محفوظ. هل تستبدله بهذا التتابع؟')).then(function (ok) { if (ok) go(); }); else go(); });
  function real0() { return S0.colMode === 'col'; }

  /* ---------- description and interpretation */
  var CTX = {
    Quaternary: ['Glacial–interglacial cycles, eolian, fluvial and coastal deposition, and the present landscape; in arid regions alluvial fans, wadi fills, sabkhas and dunes dominate.', 'دورات جليدية وبين جليدية، وترسيب ريحي ونهري وساحلي يشكّل المشهد الحالي؛ وتسود في المناطق الجافة المراوح الغرينية ورواسب الوديان والسبخات والكثبان.'],
    Neogene: ['Continental collision and uplift (Alpine–Himalayan belt, Zagros), closure of seaways, and widespread molasse and evaporite basins.', 'تصادم قاري ونهوض (الحزام الألبي–الهيمالايي وزاغروس)، وانغلاق الممرات البحرية، وانتشار أحواض المولاس والمتبخرات.'],
    Paleogene: ['Warm greenhouse climate with the Paleocene–Eocene Thermal Maximum; carbonate platforms rich in nummulites spread over shelves of the Tethys.', 'مناخ دفيء مع الحد الحراري الأقصى بين الباليوسين والإيوسين، وانتشار منصات كربونية غنية بالنميوليتات على رفوف التيثس.'],
    Cretaceous: ['High sea level and warm climate; extensive carbonate platforms with rudists, oceanic anoxic events, and major petroleum source and reservoir rocks; ends with the K–Pg extinction at 66 Ma.', 'مستوى بحر مرتفع ومناخ دافئ، ومنصات كربونية واسعة مع الروديستات، وأحداث نقص الأكسجين المحيطي، وصخور مصدرية ومكمنية بترولية رئيسية؛ وينتهي بانقراض الطباشيري–الباليوجين عند 66 مليون سنة.'],
    Jurassic: ['Break-up of Pangaea and opening of the Atlantic; carbonate and evaporite sedimentation on passive margins, with important organic-rich source rocks.', 'تفكك بانجيا وانفتاح الأطلسي، وترسيب كربوني وتبخري على الحواف الخاملة، مع صخور مصدرية غنية بالمادة العضوية.'],
    Triassic: ['Recovery after the end-Permian extinction; arid continental red beds and evaporites on Pangaea and carbonates along the Tethys margins.', 'تعافٍ بعد انقراض نهاية البرمي، وطبقات حمراء قارية جافة ومتبخرات على بانجيا، وكربونات على حواف التيثس.'],
    Permian: ['Assembly of Pangaea, arid interiors with red beds and evaporites, and the largest mass extinction at the end of the period (251.9 Ma).', 'اكتمال بانجيا، ودواخل قارية جافة مع طبقات حمراء ومتبخرات، وأكبر انقراض جماعي في نهاية العصر (251.9 مليون سنة).'],
    Carboniferous: ['Coal-forming swamps on equatorial lowlands, extensive carbonate seas, and the Gondwana glaciation.', 'مستنقعات مكوّنة للفحم في الأراضي المنخفضة الاستوائية، وبحار كربونية واسعة، وتجلد غندوانا.'],
    Devonian: ['Spread of land plants and the first forests, reef building, and organic-rich marine shales.', 'انتشار النباتات البرية وأولى الغابات، وبناء الشعاب، وطفل بحري غني بالمادة العضوية.'],
    Silurian: ['Post-glacial sea-level rise with organic-rich graptolitic shales, a major petroleum source rock across North Africa and Arabia.', 'ارتفاع مستوى البحر بعد التجلد مع طفل غرابتوليتي غني بالمادة العضوية، وهو صخرة مصدرية رئيسية في شمال أفريقيا والجزيرة العربية.'],
    Ordovician: ['Great biodiversification, widespread shallow seas and clastic shelves on Gondwana, ending with the Hirnantian glaciation.', 'تنوع حيوي كبير، وبحار ضحلة واسعة ورفوف فتاتية على غندوانا، وينتهي بتجلد الهيرنانتي.'],
    Cambrian: ['Rapid diversification of animal life and transgression of shallow seas over continental platforms.', 'تنوع سريع للحياة الحيوانية وتقدم البحار الضحلة فوق المنصات القارية.']
  };
  function narrative() {
    if (!isFinite(S0.lat)) return; var U = S0.units, u = U[0], P = function (s) { return '<p>' + s + '</p>'; }, H = function (s) { return '<h3 style="margin:14px 0 6px">' + s + '</h3>'; }, html = '', utm = SH.toUTM(S0.lat, S0.lon);
    html += H(t('1. Location', 'أولاً: الموقع')).replace('14px', '0') + P(t('The point ', 'تقع النقطة ') + '<bdi>' + SH.fmtLatLon(S0.lat, S0.lon, 5) + '</bdi> (UTM ' + utm.zone + utm.band + ', E ' + utm.E.toFixed(0) + ', N ' + utm.N.toFixed(0) + ')' + (S0.place ? t(' lies in ', ' في ') + SH.esc(placeTxt(S0.place)) : '') + (S0.elev != null ? t(', at an elevation of about ', '، على ارتفاع نحو ') + '<bdi>' + SH.fmt(S0.elev, 0) + ' m</bdi>' + t(' above sea level', ' فوق مستوى سطح البحر') : '') + '.');
    if (!u) { $('#uNarr').innerHTML = html + P(t('No mapped geological unit is available here.', 'لا تتوفر وحدة جيولوجية مرسومة هنا.')); return; }
    var p = isFinite(u.b_age) ? per((u.b_age + u.t_age) / 2) : null, d = denom(u), key = lithKey(u.lith + ' ' + u.name);
    html += H(t('2. Surface geology', 'ثانياً: الجيولوجيا السطحية')) + P(t('On the most detailed map available (', 'على أكثر الخرائط تفصيلاً المتاحة (') + (isFinite(d) ? '<bdi>1:' + Math.round(d).toLocaleString('en-US') + '</bdi>' : SH.esc(SCN[scaleClass(u)] ? SCN[scaleClass(u)][0] : '—')) + t('), the point falls within ', ')، تقع النقطة ضمن ') + '<b>' + SH.esc(u.name) + '</b>' + (isFinite(u.b_age) ? t(', dated ', '، وعمرها ') + SH.esc(u.b_int + (u.t_int && u.t_int !== u.b_int ? '–' + u.t_int : '')) + ' (<bdi>' + fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma</bdi>)' : '') + '.' + (u.lith ? t(' Lithology: ', ' الصخارية: ') + SH.esc(u.lith) + '.' : '') + (u.desc ? ' ' + SH.esc(u.desc) : '') +
      (U.length > 1 ? t(' Smaller-scale compilations show ', ' وتُظهر الخرائط ذات المقياس الأصغر ') + U.slice(1).map(function (x) { return '<b>' + SH.esc(x.name) + '</b> (' + (SCN[scaleClass(x)] ? SCN[scaleClass(x)][0] : x.scale) + ')'; }).join(AR ? '، ' : ', ') + '.' : ''));
    if (p) html += H(t('3. Geological age context', 'ثالثاً: السياق الزمني الجيولوجي')) + P('<b>' + (AR ? p[1] : p[0]) + '</b> (<bdi>' + fmtMa(p[3]) + '–' + fmtMa(p[2]) + ' Ma</bdi>)' + t(': ', ': ') + (CTX[p[0]] ? CTX[p[0]][AR ? 1 : 0] : t('Precambrian basement history: crust formation, orogenic belts and early life.', 'تاريخ القاعدة لما قبل الكامبري: تكوّن القشرة والأحزمة الجبلية والحياة المبكرة.')) + ' ' + t('The unit is ', 'وعمر الوحدة ') + '<bdi>' + SH.fmt((u.b_age + u.t_age) / 2, 1) + '</bdi>' + t(' million years old on average.', ' مليون سنة في المتوسط.'));
    var env = u.env || (key ? ST.facies({ rock: key, st: [] }) : ''), dig = key ? ST.dig({ rock: key }) : null;
    html += H(t('4. Lithology and depositional setting', 'رابعاً: الصخارية والبيئة الترسيبية')) + P((key ? t('The dominant lithology is classed as ', 'تُصنّف الصخارية السائدة على أنها ') + '<b>' + (AR ? ST.R[key][1] : ST.R[key][0].toLowerCase()) + '</b>. ' : t('The map unit groups several lithologies and is not resolved into a single rock type at this scale. ', 'تجمع الوحدة الخرائطية عدة أنواع صخرية ولا تُفصل إلى نوع واحد بهذا المقياس. ')) + (env ? t('Depositional setting: ', 'البيئة الترسيبية: ') + SH.esc(String(env).replace(/\.$/, '')) + (u.env ? '.' : t(' (inferred from the lithology).', ' (مستنتجة من الصخارية).')) : '') + (dig ? ' ' + t('Expected excavatability: ', 'قابلية الحفر المتوقعة: ') + dig[0] + '.' : ''));
    var rows = colRows();
    if (rows.length) { var gp = []; rows.forEach(function (r, i) { if (i && r.t - rows[i - 1].b > 0.5) gp.push('<bdi>' + SH.fmt(r.t - rows[i - 1].b, 1) + ' Myr</bdi>' + t(' between ', ' بين ') + SH.esc(rows[i - 1].name) + t(' and ', ' و') + SH.esc(r.name)); });
      html += H(t('5. Local succession', 'خامساً: التتابع المحلي')) + P((S0.colMode === 'col' ? t('The measured column at the point comprises ', 'يتألف العمود المقيس عند النقطة من ') : t('Within 25 km of the point the map shows ', 'تُظهر الخريطة ضمن 25 كم من النقطة ')) + '<b>' + rows.length + '</b>' + t(' units, from oldest to youngest: ', ' وحدة، من الأقدم إلى الأحدث: ') + rows.slice().reverse().map(function (r) { return SH.esc(r.name); }).join(' → ') + '. ' +
        (gp.length ? t('Age gaps: ', 'الفجوات العمرية: ') + gp.join(AR ? '؛ ' : '; ') + t('. These record unconformities, non-deposition or units not exposed in the area.', '. وهي تسجل عدم توافق أو انقطاعاً في الترسيب أو وحدات غير مكشوفة في المنطقة.') : t('No age gap larger than 0.5 Myr is present.', 'لا توجد فجوة عمرية تزيد على 0.5 مليون سنة.'))); }
    if (isFinite(d)) html += H(t('6. Reliability of the map', 'سادساً: موثوقية الخريطة')) + P(t('At ', 'عند المقياس ') + '<bdi>1:' + Math.round(d).toLocaleString('en-US') + '</bdi>' + t(' a 0.5 mm line represents about ', ' يمثل خط بعرض 0.5 مم نحو ') + '<bdi>' + SH.fmt(d * 0.0005 / 1000, d * 0.0005 < 1000 ? 2 : 1) + ' km</bdi>' + t(' on the ground, so contacts may be displaced by this amount and bodies smaller than about ', ' على الأرض، لذا قد تنزاح الحدود بهذا المقدار ولا تظهر الأجسام الأصغر من نحو ') + '<bdi>' + SH.fmt(d * 0.002 / 1000, 1) + ' km</bdi>' + t(' are not shown. Field verification or a larger-scale national map is required for site work.', '. ويلزم التحقق الحقلي أو خريطة وطنية بمقياس أكبر لأعمال الموقع.'));
    $('#uNarr').innerHTML = html;
  }

  /* ---------- table and exports */
  function table() { var U = S0.units; $('#uTbl').innerHTML = '<thead><tr><th>No.</th><th>' + t('Unit', 'الوحدة') + '</th><th>' + t('Scale', 'المقياس') + '</th><th>' + t('Age', 'العمر') + '</th><th class="num">' + t('Base Ma', 'القاعدة م.س') + '</th><th class="num">' + t('Top Ma', 'القمة م.س') + '</th><th>' + t('Lithology', 'الصخارية') + '</th></tr></thead><tbody>' +
    U.map(function (u, i) { return '<tr><td>' + (i + 1) + '</td><td><b>' + SH.esc(u.name) + '</b></td><td>' + SH.esc(u.scale) + '</td><td>' + SH.esc(u.b_int + (u.t_int && u.t_int !== u.b_int ? ' – ' + u.t_int : '')) + '</td><td class="num">' + fmtMa(u.b_age) + '</td><td class="num">' + fmtMa(u.t_age) + '</td><td style="white-space:normal;min-width:180px">' + SH.esc(u.lith) + '</td></tr>'; }).join('') + '</tbody>'; }
  $('#uCsv').addEventListener('click', function () { if (!S0.units.length) return; SH.csv('shandal-geological-units.csv', [['lat', 'lon', 'place', 'elevation_m', 'no', 'unit', 'strat_name', 'scale', 'b_int', 't_int', 'b_age_ma', 't_age_ma', 'lithology', 'environment', 'description']].concat(S0.units.map(function (u, i) { return [S0.lat, S0.lon, placeTxt(S0.place), S0.elev, i + 1, u.name, u.strat, u.scale, u.b_int, u.t_int, u.b_age, u.t_age, u.lith, u.env, u.desc]; }))); });
  $('#uJson').addEventListener('click', function () { if (!isFinite(S0.lat)) return; var f = [{ type: 'Feature', geometry: { type: 'Point', coordinates: [S0.lon, S0.lat] }, properties: { place: placeTxt(S0.place), elevation_m: S0.elev, units: S0.units } }];
    Object.keys(polys).forEach(function (k) { if (polys[k]._f) f.push(Object.assign({}, polys[k]._f, { properties: Object.assign({ unit: S0.units[k].name }, polys[k]._f.properties || {}) })); }); SH.json('shandal-geological-units.geojson', { type: 'FeatureCollection', features: f }); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-exp]'); if (!b) return; if (!isFinite(S0.lat) && b.getAttribute('data-exp') !== 'uSec') { SH.toast(t('Identify a point first.', 'حدد نقطة أولاً.'), 'warn'); return; } if (b.disabled) return; b.disabled = true;
    (b.getAttribute('data-exp') === 'uMap' ? sheet().then(function (cv) { return SH.exportCanvas(cv, b.getAttribute('data-nm'), b.getAttribute('data-f')); }) : SH.exportFigure($('#' + b.getAttribute('data-exp')), b.getAttribute('data-nm'), b.getAttribute('data-f'))).catch(function () { SH.toast(t('The image could not be created. Wait for the map to finish loading and try again.', 'تعذر إنشاء الصورة. انتظر اكتمال تحميل الخريطة ثم أعد المحاولة.'), 'warn'); }).then(function () { b.disabled = false; }); });
  function mapCap() { $('#uMapCap').innerHTML = t('Colours distinguish the mapped geological units. The red point is the identified site; the dashed outline, when shown, is the extent of the selected unit, whose positional precision is limited by the map scale given in the unit list.', 'تميّز الألوان الوحدات الجيولوجية المرسومة. النقطة الحمراء هي الموقع المحدد، والخط المتقطع عند ظهوره يمثل امتداد الوحدة المختارة، ودقة موقعه محدودة بمقياس الخريطة المبين في قائمة الوحدات.'); }
  mapCap();


  /* ---------- study area and the composed map sheet (map, graticule, scale, north arrow, legend, time scale, credits) */
  var area = null, drawing = false, drawer = null;
  $('#uArea').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawing = true;
    drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); if (area) map.removeLayer(area); area = L.rectangle(bb, { color: '#C0392B', weight: 2.5, dashArray: '8 5', fill: false, interactive: false }).addTo(map); $('#uAreaX').hidden = false; setTimeout(function () { drawing = false; }, 400); }, $('#uAreaHint')); });
  $('#uAreaX').addEventListener('click', function () { if (area && map) map.removeLayer(area); area = null; this.hidden = true; });
  function tilesReady() { return new Promise(function (res) { var n = 0, iv = setInterval(function () { var pend = map.getContainer().querySelectorAll('.leaflet-tile-pane img.leaflet-tile:not(.leaflet-tile-loaded)').length; if (!pend || ++n > 40) { clearInterval(iv); setTimeout(res, 350); } }, 200); }); }
  function dms(v, ax) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m ? (m < 10 ? '0' : '') + m + '′' : '') + (ax === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); }
  function niceDeg(span) { var c = [1 / 60, 2 / 60, 5 / 60, 10 / 60, 0.25, 0.5, 1, 2, 5, 10, 20]; for (var i = 0; i < c.length; i++) if (span / c[i] <= 5) return c[i]; return 30; }
  function sheet() {
    if (!map) return Promise.reject(new Error('map'));
    var view = { c: map.getCenter(), z: map.getZoom() }, snap = map.options.zoomSnap, prep = area ? (map.options.zoomSnap = 0, map.fitBounds(area.getBounds(), { padding: [12, 12], animate: false }), tilesReady()) : tilesReady();
    return prep.then(function () {
      var el = map.getContainer(), W0 = el.offsetWidth, H0 = el.offsetHeight, cr = { x: 0, y: 0, w: W0, h: H0 };
      if (area) { var b = area.getBounds(), p1 = map.latLngToContainerPoint(b.getNorthWest()), p2 = map.latLngToContainerPoint(b.getSouthEast()), mx = 10, my = 10; cr.x = Math.max(0, p1.x - mx); cr.y = Math.max(0, p1.y - my); cr.w = Math.min(W0, p2.x + mx) - cr.x; cr.h = Math.min(H0, p2.y + my) - cr.y; }
      var W = cr.w, H = cr.h, geo = { tl: map.containerPointToLatLng([cr.x, cr.y]), br: map.containerPointToLatLng([cr.x + W, cr.y + H]), c: map.containerPointToLatLng([cr.x + W / 2, cr.y + H / 2]) };
      var mpp = map.distance(map.containerPointToLatLng([cr.x + W / 2 - 50, cr.y + H / 2]), map.containerPointToLatLng([cr.x + W / 2 + 50, cr.y + H / 2])) / 100, pt = function (la, lo) { var q = map.latLngToContainerPoint([la, lo]); return { x: q.x - cr.x, y: q.y - cr.y }; };
      var proj = { lat: [], lon: [] }, st = niceDeg(Math.max(geo.br.lng - geo.tl.lng, geo.tl.lat - geo.br.lat));
      for (var v = Math.ceil(geo.tl.lng / st) * st; v < geo.br.lng; v += st) proj.lon.push([v, pt(geo.c.lat, v).x]);
      for (v = Math.ceil(geo.br.lat / st) * st; v < geo.tl.lat; v += st) proj.lat.push([v, pt(v, geo.c.lng).y]);
      return Promise.all([SH.mapImage(el, true), $('#uSheetTs').checked && S0.units.some(function (u) { return isFinite(u.b_age); }) ? SH.svgImage($('#uSvg')) : null]).then(function (r) {
        if (area) { map.options.zoomSnap = snap; map.setView(view.c, view.z, { animate: false }); }
        return Promise.all([SH.loadImage(r[0].src), r[1] ? SH.loadImage(r[1].src) : null]).then(function (im) { var r0 = im[0].naturalWidth / W0, c2 = document.createElement('canvas'); c2.width = Math.round(W * r0); c2.height = Math.round(H * r0); c2.getContext('2d').drawImage(im[0], cr.x * r0, cr.y * r0, W * r0, H * r0, 0, 0, c2.width, c2.height); return compose(c2, im[1], { W: W, H: H, mpp: mpp, proj: proj, st: st }); });
      });
    });
  }
  function compose(mapIm, tsIm, g) {
    var SW = 2400, SH2 = 3400, cv = document.createElement('canvas'); cv.width = SW; cv.height = SH2; var x = cv.getContext('2d'), F = 'Manrope, "IBM Plex Sans Arabic", Arial, sans-serif';
    var txt = function (s, X, Y, sz, wt, col, al) { x.font = (wt || 400) + ' ' + sz + 'px ' + F; x.fillStyle = col || INK; x.textAlign = al || 'left'; x.fillText(s, X, Y); };
    x.fillStyle = '#fff'; x.fillRect(0, 0, SW, SH2);
    var place = placeTxt(S0.placeEn || (AR ? null : S0.place), false), title = SH.val('uTitle').trim() || ('Geological map' + (place ? ' — ' + place : ''));
    txt(title, 60, 74, 40, 800); txt(SH.fmtLatLon(S0.lat, S0.lon, 4) + (S0.elev != null ? '  ·  elevation ' + SH.fmt(S0.elev, 0) + ' m' : '') + '  ·  WGS 84, Web Mercator projection', 60, 112, 22, 500, MUT);
    x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 136); x.lineTo(SW - 40, 136); x.stroke();
    // map frame
    var FX = 120, FY = 196, FWmax = 1560, FHmax = 1500, f = Math.min(FWmax / g.W, FHmax / g.H), FW = g.W * f, FH = g.H * f;
    x.drawImage(mapIm, FX, FY, FW, FH); x.lineWidth = 3; x.strokeRect(FX, FY, FW, FH); x.lineWidth = 1; x.strokeRect(FX - 10, FY - 10, FW + 20, FH + 20);
    // graticule ticks and labels
    x.strokeStyle = INK; x.lineWidth = 1.6;
    g.proj.lon.forEach(function (q) { var X = FX + q[1] * f; if (X < FX + 4 || X > FX + FW - 4) return; x.beginPath(); x.moveTo(X, FY - 10); x.lineTo(X, FY + 12); x.moveTo(X, FY + FH + 10); x.lineTo(X, FY + FH - 12); x.stroke(); txt(dms(q[0], 'lon'), X, FY - 20, 20, 600, INK, 'center'); txt(dms(q[0], 'lon'), X, FY + FH + 38, 20, 600, INK, 'center'); });
    g.proj.lat.forEach(function (q) { var Y = FY + q[1] * f; if (Y < FY + 4 || Y > FY + FH - 4) return; x.beginPath(); x.moveTo(FX - 10, Y); x.lineTo(FX + 12, Y); x.moveTo(FX + FW + 10, Y); x.lineTo(FX + FW - 12, Y); x.stroke();
      x.save(); x.translate(FX - 22, Y); x.rotate(-Math.PI / 2); txt(dms(q[0], 'lat'), 0, 0, 20, 600, INK, 'center'); x.restore(); x.save(); x.translate(FX + FW + 34, Y); x.rotate(-Math.PI / 2); txt(dms(q[0], 'lat'), 0, 0, 20, 600, INK, 'center'); x.restore(); });
    g.proj.lon.forEach(function (a) { g.proj.lat.forEach(function (b) { var X = FX + a[1] * f, Y = FY + b[1] * f; if (X < FX + 20 || X > FX + FW - 20 || Y < FY + 20 || Y > FY + FH - 20) return; x.strokeStyle = 'rgba(27,35,43,.75)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(X - 10, Y); x.lineTo(X + 10, Y); x.moveTo(X, Y - 10); x.lineTo(X, Y + 10); x.stroke(); }); });
    // side panel
    var PX = FX + FW + 90, PW = SW - 40 - PX, y = FY;
    // north arrow
    var cx = PX + 46, cy = y + 52; x.fillStyle = INK; x.beginPath(); x.moveTo(cx, cy - 44); x.lineTo(cx - 20, cy + 26); x.lineTo(cx, cy + 12); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy - 44); x.lineTo(cx + 20, cy + 26); x.lineTo(cx, cy + 12); x.closePath(); x.fill(); x.stroke(); txt('N', cx, cy - 54, 28, 800, INK, 'center');
    // scale bar
    var mps = g.mpp / f, want = mps * Math.min(PW - 150, 420), p = Math.pow(10, Math.floor(Math.log10(want))), n = want / p, len = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p, px = len / mps, sx = PX + 120, sy = y + 40, lab = function (m) { return m >= 1000 ? SH.fmt(m / 1000, m % 1000 ? 1 : 0) : SH.fmt(m, 0); }, un = len >= 1000 ? 'km' : 'm';
    for (var i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#fff' : INK; x.fillRect(sx + i * px / 4, sy, px / 4, 14); } x.strokeStyle = INK; x.lineWidth = 1.5; x.strokeRect(sx, sy, px, 14);
    [[0, '0'], [px / 2, lab(len / 2)], [px, lab(len) + ' ' + un]].forEach(function (q) { x.beginPath(); x.moveTo(sx + q[0], sy); x.lineTo(sx + q[0], sy - 6); x.stroke(); txt(q[1], sx + q[0], sy - 12, 20, 700, INK, 'center'); });
    var rf = mps / (297 / SW / 1000), rp = Math.pow(10, Math.floor(Math.log10(rf)) - 1); txt('Scale 1 : ' + (Math.round(rf / rp) * rp).toLocaleString('en-US') + ' (sheet printed at A4 width)', sx, sy + 46, 19, 500, MUT);
    y += 130; x.strokeStyle = '#C9CED3'; x.lineWidth = 1; x.beginPath(); x.moveTo(PX, y); x.lineTo(SW - 40, y); x.stroke(); y += 42;
    // legend
    txt('LEGEND', PX, y, 24, 800); y += 34;
    var L0 = (S0.nb.length ? S0.nb : S0.units).filter(function (u) { return u.name; }).slice().sort(function (a, b) { return (a.t_age - b.t_age) || (a.b_age - b.b_age); }), seen = {};
    L0 = L0.filter(function (u) { var k = u.name + u.b_age; if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, tsIm ? 7 : 12);
    var clip = function (s, w, sz, wt) { x.font = (wt || 400) + ' ' + sz + 'px ' + F; if (x.measureText(s).width <= w) return s; while (s.length > 3 && x.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; };
    L0.forEach(function (u) { x.fillStyle = u.color || '#ddd'; x.fillRect(PX, y - 2, 52, 32); x.strokeStyle = INK; x.lineWidth = 1.2; x.strokeRect(PX, y - 2, 52, 32); var here = S0.units.some(function (q) { return q.name === u.name && q.b_age === u.b_age; });
      txt(clip(u.name, PW - 74, 20, 700), PX + 68, y + 12, 20, 700); txt(clip((isFinite(u.b_age) ? fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma' : '') + (u.lith ? ' · ' + u.lith : '') + (here ? ' · at the point' : ''), PW - 74, 17, 400), PX + 68, y + 34, 17, 400, MUT); y += 50; });
    var sym = function (draw, s) { draw(PX + 26, y + 12); txt(s, PX + 68, y + 19, 19, 500); y += 40; };
    y += 4; sym(function (X, Y) { x.fillStyle = '#C0392B'; x.beginPath(); x.arc(X, Y, 9, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke(); }, 'Selected point');
    if (area) sym(function (X, Y) { x.strokeStyle = '#C0392B'; x.lineWidth = 3; x.setLineDash([10, 6]); x.strokeRect(X - 24, Y - 12, 48, 24); x.setLineDash([]); }, 'Study area');
    if (SEC.line) sym(function (X, Y) { x.strokeStyle = INK; x.lineWidth = 3.5; x.setLineDash([12, 7]); x.beginPath(); x.moveTo(X - 24, Y); x.lineTo(X + 24, Y); x.stroke(); x.setLineDash([]); }, 'Cross-section line A–A′');
    if (polyLayer && polyLayer.getLayers().length) sym(function (X, Y) { x.fillStyle = 'rgba(192,57,43,.15)'; x.fillRect(X - 24, Y - 12, 48, 24); x.strokeStyle = '#C0392B'; x.lineWidth = 2.5; x.setLineDash([8, 5]); x.strokeRect(X - 24, Y - 12, 48, 24); x.setLineDash([]); }, 'Boundary of the selected unit');
    // time scale panel
    if (tsIm) { y += 10; x.strokeStyle = '#C9CED3'; x.lineWidth = 1; x.beginPath(); x.moveTo(PX, y); x.lineTo(SW - 40, y); x.stroke(); y += 36; txt('POSITION ON THE GEOLOGICAL TIME SCALE', PX, y, 20, 800); y += 14;
      var k2 = PW / tsIm.width; x.drawImage(tsIm, PX, y, tsIm.width * k2, tsIm.height * k2); y += tsIm.height * k2; }
    // credits (the sheet height follows the content, at least A4 landscape proportions)
    var bot = Math.max(FY + FH + 60, y + 20), HH = Math.max(1697, bot + 110), out = document.createElement('canvas'); out.width = SW; out.height = HH; var ox = out.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, SW, HH); ox.drawImage(cv, 0, 0); cv = out; x = ox; SH2 = HH;
    x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(40, SH2 - 76); x.lineTo(SW - 40, SH2 - 76); x.stroke();
    txt('Data: Macrostrat (CC BY 4.0). Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors. Place names: OpenStreetMap Nominatim. Map units are generalised to the scale of the source maps.', 40, SH2 - 44, 17, 400, MUT);
    return cv;
  }

  /* ---------- geological cross-section A–A′: elevation profile (SRTM composite) coloured by the mapped units */
  var SEC = { mode: 0, a: null, b: null, line: null, mk: [], prof: null, units: [], cls: '' };
  function hav(a, b) { var R = 6371008.8, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r, h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) * Math.sin(dn / 2); return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); }
  function bearing(a, b) { var r = Math.PI / 180, y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r), x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r); return (Math.atan2(y, x) / r + 360) % 360; }
  var CARD = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'], card = function (az) { return CARD[Math.round(az / 22.5) % 16]; };
  function inRing(p, r) { var x = p[1], y = p[0], c = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; }
  function inGeom(p, g) { if (!g) return false; var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; return polys.some(function (pl) { return inRing(p, pl[0]) && !pl.slice(1).some(function (h) { return inRing(p, h); }); }); }
  function secClear() { if (SEC.line) map.removeLayer(SEC.line); SEC.mk.forEach(function (m) { map.removeLayer(m); }); SEC.line = null; SEC.mk = []; SEC.a = SEC.b = null; SEC.prof = null; $('#uSecWrap').hidden = true; $('#uSecX').hidden = true; }
  function endMk(ll, s) { return L.marker(ll, { interactive: false, icon: L.divIcon({ className: '', html: '<div style="font:800 13px/1 Manrope,sans-serif;color:#fff;background:#1B232B;border:2px solid #fff;border-radius:6px;padding:3px 6px;box-shadow:0 1px 4px rgba(0,0,0,.4);direction:ltr">' + s + '</div>', iconSize: [30, 22], iconAnchor: [15, 26] }) }).addTo(map); }
  $('#uSecDraw').addEventListener('click', function () { if (!map) return; secClear(); SEC.mode = 1; drawing = true; map.getContainer().style.cursor = 'crosshair'; $('#uSecHint').hidden = false; $('#uSecHint').textContent = t('Click the start of the section (A).', 'انقر بداية المقطع (A).'); });
  $('#uSecX').addEventListener('click', secClear);
  $('#uVe').addEventListener('change', function () { if (SEC.prof) drawSec(); });
  function secClick(ll) {
    if (SEC.mode === 1) { SEC.a = [ll.lat, ll.lng]; SEC.mk.push(endMk(ll, 'A')); SEC.mode = 2; $('#uSecHint').textContent = t('Click the end of the section (A′).', 'انقر نهاية المقطع (A′).'); return; }
    SEC.b = [ll.lat, ll.lng]; SEC.mk.push(endMk(ll, 'A′')); SEC.mode = 0; map.getContainer().style.cursor = ''; setTimeout(function () { drawing = false; }, 300);
    SEC.line = L.polyline([SEC.a, SEC.b], { color: '#1B232B', weight: 3, dashArray: '10 6', interactive: false }).addTo(map); $('#uSecX').hidden = false; buildSec();
  }
  function buildSec() {
    var len = hav(SEC.a, SEC.b); if (len < 200) { SH.toast(t('The section is too short (minimum 200 m).', 'المقطع قصير جداً (الحد الأدنى 200 م).'), 'warn'); secClear(); $('#uSecHint').hidden = true; return; }
    if (len > 400000) { SH.toast(t('The section is too long (maximum 400 km).', 'المقطع طويل جداً (الحد الأقصى 400 كم).'), 'warn'); secClear(); $('#uSecHint').hidden = true; return; }
    var N = 400, pts = []; for (var i = 0; i <= N; i++) { var f = i / N; pts.push([SEC.a[0] + (SEC.b[0] - SEC.a[0]) * f, SEC.a[1] + (SEC.b[1] - SEC.a[1]) * f]); }
    var dist = pts.map(function (p, i) { return i ? hav(SEC.a, p) : 0; });
    $('#uSecWrap').hidden = false; SH.svgB('uSec').el.setAttribute('viewBox', '0 0 1200 160'); tx(SH.svgB('uSec'), 600, 84, 'Reading the elevation model and the geological map along the section…', { 'text-anchor': 'middle', fill: MUT, 'font-size': 14 });
    $('#uSecHint').textContent = t('Building the section…', 'جارٍ بناء المقطع…');
    var elev = SH.dem.points(pts, { res: Math.max(30, len / N / 2) }).catch(function () { return null; });
    // geology: 31 samples, choose one map scale, fetch the unit polygons, classify all 401 points, query the gaps
    var NS = 30, samp = [], cand = {}, j = 0; for (i = 0; i <= NS; i++) samp.push(pts[Math.round(i * N / NS)]);
    var getAt = function (p) { return JS(API + 'geologic_units/map?lat=' + p[0].toFixed(5) + '&lng=' + p[1].toFixed(5), 20000).then(function (r) { var d = data(r), refs = (r.success && r.success.refs) || {}; return (Array.isArray(d) ? d : []).map(function (u) { if (!u.ref && refs[u.source_id]) u.ref = { name: refs[u.source_id] }; var n = norm(u); n.cls = scaleClass(n); return n; }); }).catch(function () { return []; }); };
    var res = new Array(samp.length), run = function () { if (j >= samp.length) return Promise.resolve(); var k0 = j; j += 6; return Promise.all(samp.slice(k0, k0 + 6).map(function (p, q) { return getAt(p).then(function (r) { res[k0 + q] = r; }); })).then(run); };
    var geo = run().then(function () {
      var cnt = {}; res.forEach(function (r) { var seen = {}; (r || []).forEach(function (u) { if (!seen[u.cls]) { cnt[u.cls] = (cnt[u.cls] || 0) + 1; seen[u.cls] = 1; } }); });
      var cls = ['large', 'medium', 'small', 'tiny'].filter(function (c) { return (cnt[c] || 0) >= 0.6 * samp.length; })[0] || Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0] || ''; SEC.cls = cls;
      res.forEach(function (r) { (r || []).forEach(function (u) { if (u.cls === cls && u.map_id != null && !cand[u.map_id]) cand[u.map_id] = u; }); });
      var ids = Object.keys(cand); return Promise.all(ids.map(function (id) { return JS(API + 'geologic_units/map?map_id=' + id + '&format=geojson_bare', 30000).then(function (g) { var f = (g.features || [])[0]; if (f) cand[id].geom = f.geometry; }).catch(function () {}); }))
        .then(function () { var lab = function () { return pts.map(function (p) { for (var id in cand) if (cand[id].geom && inGeom(p, cand[id].geom)) return id; return null; }); }, cls0 = lab(), miss = [], k;
          for (k = 0; k <= N; k += 8) if (cls0[k] == null) miss.push(k); miss = miss.slice(0, 12);
          return Promise.all(miss.map(function (k) { return getAt(pts[k]).then(function (r) { r.filter(function (u) { return u.cls === cls; }).forEach(function (u) { if (u.map_id != null && !cand[u.map_id]) cand[u.map_id] = u; }); }); })).then(function () {
            var nids = Object.keys(cand).filter(function (id) { return !cand[id].geom; }); return Promise.all(nids.map(function (id) { return JS(API + 'geologic_units/map?map_id=' + id + '&format=geojson_bare', 30000).then(function (g) { var f = (g.features || [])[0]; if (f) cand[id].geom = f.geometry; }).catch(function () {}); })).then(lab); }); }); });
    Promise.all([elev, geo]).then(function (r) { if (!r[0]) throw new Error(t('The elevation model could not be read.', 'تعذرت قراءة نموذج الارتفاع.'));
      var ids = r[1], order = [], segs = [], s0 = 0; for (var k = 1; k <= N + 1; k++) if (k === N + 1 || ids[k] !== ids[s0]) { segs.push({ id: ids[s0], a: s0, b: k - 1 }); s0 = k; }
      segs.forEach(function (sg) { if (sg.id != null && order.indexOf(sg.id) < 0) order.push(sg.id); });
      SEC.units = order.map(function (id) { return cand[id]; }); SEC.prof = { pts: pts, d: dist, z: r[0], id: ids, segs: segs, len: len, az: bearing(SEC.a, SEC.b) };
      $('#uSecHint').hidden = true; drawSec(); })
      .catch(function (e) { $('#uSecHint').textContent = e.message; SH.svgB('uSec'); });
  }
  function drawSec() {
    var P = SEC.prof, S = SH.svgB('uSec'), defs = S.add('defs', {}), W = 1200, U = SEC.units, nL = U.length;
    var zmin = Math.min.apply(null, P.z), zmax = Math.max.apply(null, P.z), rel = Math.max(1, zmax - zmin), X0 = 90, X1 = W - 40, PW = X1 - X0, top = 116;
    var mpx = P.len / PW, ve = $('#uVe').value === 'auto' ? (function () { var v = (PW * 0.28) * mpx / rel; var c = [1, 2, 5, 10, 20, 50]; for (var q = c.length - 1; q >= 0; q--) if (c[q] <= v) return c[q]; return 1; })() : +$('#uVe').value;
    var ph = Math.max(140, Math.min(420, rel * ve / mpx)), band = Math.max(36, ph * 0.22), zb = zmin - (band + 20) * mpx / ve, ztop = zmax + 30 * mpx / ve, H = (ztop - zb) * ve / mpx;
    var Y = function (z) { return top + (ztop - z) * ve / mpx; }, Xd = function (d) { return X0 + d / P.len * PW; }, yb = Y(zb);
    var legRows = Math.ceil(Math.max(1, nL) / 2), VH = yb + 140 + legRows * 30 + 40;
    S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); var bgS = S.add('rect', { x: 0, y: 0, width: W, height: VH, fill: '#fff' });
    var place = placeTxt(S0.placeEn || (AR ? null : S0.place), true);
    tx(S, W / 2, 44, SH.val('uSecTitle').trim() || ('Geological cross-section A–A′' + (place ? ' — ' + place : '')), { 'font-size': 20, 'font-weight': 800, 'text-anchor': 'middle' });
    // surface-geology band under the topography
    var topo = P.d.map(function (d, i) { return [Xd(d), Y(P.z[i])]; }), bandAt = function (i) { return Y(P.z[i]) + band; };
    var cut = Math.max(Y(zmin) + band, 0);
    P.segs.forEach(function (sg) { var u = sg.id != null ? cand0(sg.id) : null, a = Math.max(0, sg.a - (sg.a ? 0.5 : 0)), b = Math.min(P.d.length - 1, sg.b + (sg.b < P.d.length - 1 ? 0.5 : 0)), pts = [], i;
      for (i = sg.a; i <= sg.b; i++) pts.push(topo[i]); if (sg.b + 1 < topo.length) pts.push(topo[sg.b + 1]); var last = pts[pts.length - 1][0], first = pts[0][0];
      var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'L' + last.toFixed(1) + ' ' + yb + 'L' + first.toFixed(1) + ' ' + yb + 'Z';
      var key = u ? lithKey(u.lith + ' ' + u.name) : '', col = u ? u.color : '#EEE';
      S.path(d, { fill: col, stroke: 'none' }); if (key && ST.R[key]) { var id = 'sp' + sg.a; ST.pattern(S, defs, id, ST.R[key][3]); S.path(d, { fill: 'url(#' + id + ')', stroke: 'none', opacity: .7 }); }
      if (!u) { var hid = 'shx'; if (!defs.querySelector('#shx')) { var pt = S.add('pattern', { id: hid, width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, null, defs); S.add('path', { d: 'M0 8L8 0', stroke: '#999', 'stroke-width': 1 }, null, pt); } S.path(d, { fill: 'url(#shx)' }); } });
    // fade the deep part: the band shows outcrop only
    var gid = 'sfade'; var lg = S.add('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, null, defs); S.add('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': 0 }, null, lg); S.add('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': 1 }, null, lg);
    var under = 'M' + topo.map(function (p) { return p[0].toFixed(1) + ' ' + (p[1] + band * 0.55).toFixed(1); }).join('L') + 'L' + X1 + ' ' + yb + 'L' + X0 + ' ' + yb + 'Z'; S.path(under, { fill: '#fff', opacity: .92 });
    S.path('M' + topo.map(function (p) { return p[0].toFixed(1) + ' ' + (p[1] + band * 0.55).toFixed(1); }).join('L'), { fill: 'none', stroke: MUT, 'stroke-width': .8, 'stroke-dasharray': '4 4' });
    // contacts (dip unknown, drawn vertical and dashed)
    P.segs.forEach(function (sg, k) { if (!k) return; var x = topo[sg.a][0], y = topo[sg.a][1]; S.line(x, y, x, y + band * 0.55, { stroke: INK, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }); });
    S.path('M' + topo.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'), { fill: 'none', stroke: INK, 'stroke-width': 2 });
    // unit numbers above the profile (only where the outcrop is wide enough)
    P.segs.forEach(function (sg) { if (sg.id == null) return; var x1 = topo[sg.a][0], x2 = topo[Math.min(sg.b + 1, topo.length - 1)][0]; if (x2 - x1 < 18) return; var mid = Math.round((sg.a + sg.b) / 2), n = SEC.units.indexOf(cand0(sg.id)) + 1, y = Math.min.apply(null, topo.slice(sg.a, sg.b + 1).map(function (p) { return p[1]; })) - 14;
      S.add('rect', { x: (x1 + x2) / 2 - 10, y: y - 13, width: 20, height: 18, rx: 4, fill: cand0(sg.id).color, stroke: INK, 'stroke-width': .8 }); tx(S, (x1 + x2) / 2, y + 1, String(n), { 'font-size': 11, 'font-weight': 800, 'text-anchor': 'middle' }); });
    // frame, axes, labels
    S.add('rect', { x: X0, y: top, width: PW, height: yb - top, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    var zs = SH.dem.niceInterval(ztop - zb, 6); for (var z = Math.ceil(zb / zs) * zs; z <= ztop; z += zs) { var yy = Y(z); S.line(X0 - 6, yy, X0, yy, { stroke: INK }); S.line(X1, yy, X1 + 6, yy, { stroke: INK }); tx(S, X0 - 9, yy + 4, SH.fmt(z, 0), { 'font-size': 11, 'text-anchor': 'end', fill: MUT }); }
    var cx = 28, cy = (top + yb) / 2; tx(S, cx, cy, 'Elevation (m a.s.l.)', { 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle', transform: 'rotate(-90 ' + cx + ' ' + cy + ')' });
    var ds = SH.dem.niceInterval(P.len / 1000, 8); for (var dk = 0; dk <= P.len / 1000 + 1e-9; dk += ds) { var xx = Xd(dk * 1000); S.line(xx, yb, xx, yb + 6, { stroke: INK }); tx(S, xx, yb + 20, SH.fmt(dk, ds < 1 ? 1 : 0), { 'font-size': 11, 'text-anchor': 'middle', fill: MUT }); }
    tx(S, (X0 + X1) / 2, yb + 40, 'Distance along the section (km)', { 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle' });
    tx(S, X0, top - 12, 'A', { 'font-size': 20, 'font-weight': 800 }); tx(S, X0 + 20, top - 12, '(' + card((P.az + 180) % 360) + ')', { 'font-size': 12, fill: MUT }); tx(S, X1, top - 12, 'A′', { 'font-size': 20, 'font-weight': 800, 'text-anchor': 'end' }); tx(S, X1 - 28, top - 12, '(' + card(P.az) + ')', { 'font-size': 12, fill: MUT, 'text-anchor': 'end' });
    // graphic scale (lower left), direction rose (upper right), section data (lower right)
    var sl = SH.dem.niceInterval(P.len, 5), spx = sl / mpx, sx = X0, sy = yb + 70; for (var q = 0; q < 4; q++) S.add('rect', { x: sx + q * spx / 4, y: sy, width: spx / 4, height: 7, fill: q % 2 ? '#fff' : INK }); S.add('rect', { x: sx, y: sy, width: spx, height: 7, fill: 'none', stroke: INK, 'stroke-width': .8 });
    [[0, '0'], [spx / 2, sl >= 1000 ? SH.fmt(sl / 2000, (sl / 2) % 1000 ? 1 : 0) : SH.fmt(sl / 2, 0)], [spx, sl >= 1000 ? SH.fmt(sl / 1000, sl % 1000 ? 1 : 0) + ' km' : SH.fmt(sl, 0) + ' m']].forEach(function (q, k) { tx(S, sx + q[0], sy - 6, q[1], { 'font-size': 11, 'font-weight': k === 2 ? 700 : 500, 'text-anchor': 'middle' }); });
    var rx = W - 62, ry = 58, r = 22; S.circle(rx, ry, r, { fill: '#fff', stroke: INK, 'stroke-width': .9 }); S.path('M' + rx + ' ' + (ry - r + 3) + 'l-5 12h10z', { fill: INK }); tx(S, rx, ry - r - 5, 'N', { 'font-size': 12, 'font-weight': 800, 'text-anchor': 'middle' });
    var ar = P.az * Math.PI / 180; S.line(rx - Math.sin(ar) * r * .75, ry + Math.cos(ar) * r * .75, rx + Math.sin(ar) * r * .75, ry - Math.cos(ar) * r * .75, { stroke: '#C0392B', 'stroke-width': 2.4 }); S.circle(rx + Math.sin(ar) * r * .75, ry - Math.cos(ar) * r * .75, 3.2, { fill: '#C0392B' });
    tx(S, rx - r - 8, ry + 4, 'A → A′', { 'font-size': 11, 'font-weight': 700, 'text-anchor': 'end' });
    [['Length', SH.fmt(P.len / 1000, P.len < 10000 ? 2 : 1) + ' km'], ['Azimuth A → A′', ('00' + Math.round(P.az)).slice(-3) + '° (' + card(P.az) + ')'], ['Vertical exaggeration', '×' + ve], ['Elevations', 'SRTM, EGM96 geoid']].forEach(function (q, k) { tx(S, X1 - 150, sy - 4 + k * 15, q[0], { 'font-size': 10.5, fill: MUT, 'text-anchor': 'end' }); tx(S, X1, sy - 4 + k * 15, q[1], { 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'end' }); });
    // legend
    var ly = yb + 150; tx(S, X0, ly, 'LEGEND', { 'font-size': 12, 'font-weight': 800, 'letter-spacing': 1.2 });
    U.forEach(function (u, i) { var x = X0 + (i % 2) * (PW / 2), y = ly + 24 + Math.floor(i / 2) * 30, key = lithKey(u.lith + ' ' + u.name); S.add('rect', { x: x, y: y - 11, width: 34, height: 20, fill: u.color, stroke: INK, 'stroke-width': .8 }); if (key && ST.R[key]) { var id = 'sl' + i; ST.pattern(S, defs, id, ST.R[key][3]); S.add('rect', { x: x, y: y - 11, width: 34, height: 20, fill: 'url(#' + id + ')', opacity: .7 }); }
      tx(S, x + 17, y + 3, String(i + 1), { 'font-size': 10, 'font-weight': 800, 'text-anchor': 'middle', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' });
      var nm = u.name.length > 48 ? u.name.slice(0, 46) + '…' : u.name; tx(S, x + 44, y - 1, nm, { 'font-size': 11, 'font-weight': 700 }); tx(S, x + 44, y + 12, (isFinite(u.b_age) ? fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma' : '') + (u.lith ? ' · ' + (u.lith.length > 44 ? u.lith.slice(0, 42) + '…' : u.lith) : ''), { 'font-size': 9.5, fill: MUT }); });
    var yL = ly + 24 + legRows * 30; S.line(X0, yL - 8, X0 + 34, yL - 8, { stroke: INK, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }); tx(S, X0 + 44, yL - 4, 'Contact (dip not known)', { 'font-size': 10.5 });
    if (P.id.some(function (v) { return v == null; })) { S.add('rect', { x: X0 + PW / 2, y: yL - 18, width: 34, height: 18, fill: '#fff', stroke: INK, 'stroke-width': .8 }); var hp = S.add('rect', { x: X0 + PW / 2, y: yL - 18, width: 34, height: 18, fill: 'url(#shx)' }); tx(S, X0 + PW / 2 + 44, yL - 4, 'No mapped unit', { 'font-size': 10.5 }); }
    S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + (yL + 16)); bgS.setAttribute('height', yL + 16); S.add('rect', { x: 6, y: 6, width: W - 12, height: yL + 4, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    var lst = U.map(function (u, i) { return (i + 1) + ' ' + SH.esc(u.name); }).join(AR ? '، ' : ', ');
    $('#uSecCap').innerHTML = t('The profile shows the relief along ', 'يبيّن المقطع تضرس السطح على امتداد ') + '<bdi>A–A′</bdi> (<bdi>' + SH.fmt(zmin, 0) + '–' + SH.fmt(zmax, 0) + ' m</bdi>' + t(') and the units that crop out along it: ', ') والوحدات المكشوفة على امتداده: ') + (lst || '—') + '. ' + t('The coloured band marks outcrop only: dips and thicknesses are not given by the map, so contacts are drawn as vertical dashed lines and the subsurface is left uninterpreted. A structural section needs measured dips.', 'الشريط الملوّن يمثل الانكشاف فقط؛ فالخريطة لا تعطي الميول ولا السماكات، لذا رُسمت الحدود خطوطاً رأسية متقطعة وتُرك ما تحت السطح دون تفسير. ويحتاج المقطع التركيبي إلى قياسات ميل حقلية.');
  }
  function cand0(id) { for (var i = 0; i < SEC.units.length; i++) if (String(SEC.units[i].map_id) === String(id)) return SEC.units[i]; return null; }
  $('#uSecCsv').addEventListener('click', function () { var P = SEC.prof; if (!P) return; SH.csv('shandal-cross-section.csv', [['distance_m', 'lat', 'lon', 'elevation_m', 'unit', 'b_age_ma', 't_age_ma', 'lithology']].concat(P.pts.map(function (p, i) { var u = P.id[i] != null ? cand0(P.id[i]) : null; return [Math.round(P.d[i]), p[0].toFixed(6), p[1].toFixed(6), P.z[i].toFixed(1), u ? u.name : '', u ? u.b_age : '', u ? u.t_age : '', u ? u.lith : '']; }))); });
  if (map) map.on('click', function (e) { if (SEC.mode) { secClick(e.latlng); return; } if (drawing) return; query(e.latlng.lat, e.latlng.lng); });
  $('#uGo').addEventListener('click', function () { var a = SH.num('uLat'), b = SH.num('uLon'); if (isNaN(a) || isNaN(b)) { SH.toast(t('Enter coordinates.', 'أدخل الإحداثيات.'), 'warn'); return; } if (map) map.setView([a, b], Math.max(map.getZoom(), 9)); query(a, b); });
  $('#uMe').addEventListener('click', function () { var bt = this; bt.disabled = true; SH.locate().then(function (p) { if (map) map.setView([p.lat, p.lon], 10); query(p.lat, p.lon); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { bt.disabled = false; }); });
  document.addEventListener('sh:beforereport', function (e) { if (!S0.units.length && !SEC.prof) { e.preventDefault(); SH.toast(t('Identify a point first.', 'حدد نقطة أولاً.'), 'warn'); } });
  var qs = new URLSearchParams(location.search), qa = parseFloat(qs.get('lat')), qb = parseFloat(qs.get('lon'));
  if (isFinite(qa) && isFinite(qb)) { $('#uLat').value = qa; $('#uLon').value = qb; }
  var a0 = SH.num('uLat'), b0 = SH.num('uLon'); if (!isNaN(a0) && !isNaN(b0) && SH.val('uLat') !== '') { if (map) map.setView([a0, b0], 9); query(a0, b0); }
})();
