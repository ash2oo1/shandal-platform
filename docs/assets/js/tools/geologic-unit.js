/* Geological Unit Finder — Macrostrat integrated geological map at any point: the units at every available map
   scale with age, lithology, description and source map; place name (OpenStreetMap Nominatim); unit boundary
   on demand; position on the ICS time scale; the local stratigraphic succession (Macrostrat measured column
   where it exists, otherwise the map units cropping out within 25 km ordered by age); a written description and
   interpretation; links to the source maps and other services; CSV, GeoJSON, PNG and PDF outputs. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', ST = SH.strat;
  var INK = '#1B232B', MUT = '#55616B', API = 'https://macrostrat.org/api/v2/', NOM = 'https://nominatim.openstreetmap.org/';
  var persist = SH.persist('geounit', ['uLat', 'uLon', 'uOv', 'uOp', 'uLab', 'uNb']);
  var map = SH.map('uMap', { zoom: 6, base: 'light', center: [33.3, 43.5] }), ov = null, mk = null, polys = {}, polyLayer = null;
  var S0 = { lat: NaN, lon: NaN, place: null, units: [], elev: null, col: [], colMode: '', nb: [], seq: 0 };

  /* ---------- map furniture: overlay, graphic scale with representative fraction, north arrow */
  function overlay() { if (!map) return; if (ov) { map.removeLayer(ov); ov = null; } if (!$('#uOv').checked) return; ov = L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: (SH.num('uOp') || 60) / 100, maxZoom: 18, crossOrigin: true, attribution: 'Geology © <a href="https://macrostrat.org">Macrostrat</a> (CC BY 4.0)' }).addTo(map); }
  if (map) {
    var dsc = map.getContainer().querySelector('.leaflet-control-scale'); if (dsc) dsc.remove();
    var Scale = L.Control.extend({ options: { position: 'bottomleft' }, onAdd: function () { var e = L.DomUtil.create('div', 'gu-scale'); L.DomEvent.disableClickPropagation(e); this._e = e; return e; } });
    var North = L.Control.extend({ options: { position: 'topright' }, onAdd: function () { var e = L.DomUtil.create('div', 'gu-north'); e.innerHTML = '<svg viewBox="0 0 40 52" width="34" height="44" aria-label="North"><circle cx="20" cy="30" r="17" fill="rgba(255,255,255,.9)" stroke="#1B232B" stroke-width=".8"/><path d="M20 14 L27 40 L20 34 Z" fill="#fff" stroke="#1B232B" stroke-width="1"/><path d="M20 14 L13 40 L20 34 Z" fill="#1B232B"/><text x="20" y="10" text-anchor="middle" font-size="11" font-weight="800" fill="#1B232B">N</text></svg>'; return e; } });
    var sc = new Scale(); sc.addTo(map); new North().addTo(map);
    var upd = function () { var c = map.getSize(), y = c.y / 2, a = map.containerPointToLatLng([0, y]), b = map.containerPointToLatLng([100, y]), mpp = map.distance(a, b) / 100, want = mpp * 150, p = Math.pow(10, Math.floor(Math.log10(want))), n = want / p, len = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p, px = len / mpp;
      var lab = function (m) { return m >= 1000 ? SH.fmt(m / 1000, m % 1000 ? 1 : 0) + ' km' : SH.fmt(m, 0) + ' m'; }, rf = mpp / 0.000264583, rp = Math.pow(10, Math.floor(Math.log10(rf)) - 1), rfN = Math.round(rf / rp) * rp, segs = '';
      for (var i = 0; i < 4; i++) segs += '<rect x="' + (10 + i * px / 4) + '" y="18" width="' + px / 4 + '" height="6" fill="' + (i % 2 ? '#fff' : '#1B232B') + '"/>';
      sc._e.innerHTML = '<svg width="' + (px + 44) + '" height="44" style="display:block"><rect x="0" y="0" width="' + (px + 44) + '" height="44" rx="6" fill="rgba(255,255,255,.9)"/>' + segs + '<rect x="10" y="18" width="' + px + '" height="6" fill="none" stroke="#1B232B" stroke-width=".8"/>' +
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
    $('#uRes').innerHTML = '<div class="xsmall muted" style="padding:14px 16px">' + t('Querying Macrostrat…', 'جارٍ الاستعلام من Macrostrat…') + '</div>';
    reverse(lat, lon).then(function (p) { if (seq !== S0.seq) return; S0.place = p; label(); kpis(); narrative(); links(); });
    units(lat, lon).then(function (r) {
      if (seq !== S0.seq) return; S0.units = r.units; S0.elev = r.elev; S0.col = []; S0.nb = []; S0.colMode = ''; render(); kpis(); timescale(); narrative(); links(); table(); drawCol();
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
      '<div class="kpi"><span class="k">' + t('Map scale', 'مقياس الخريطة') + '</span><span class="v" style="font-size:1rem">' + (isFinite(d) ? '<bdi>1 : ' + Math.round(d).toLocaleString('en-US') + '</bdi>' : '—') + '</span><span class="s">' + (u && SCN[u.scale] ? SCN[u.scale][0] : '') + '</span></div>'; }
  function render() {
    var U = S0.units; if (!U.length) { $('#uRes').innerHTML = '<div class="small muted" style="padding:14px 16px">' + t('No mapped unit here (open water or a gap in coverage).', 'لا توجد وحدة مرسومة هنا (مياه مفتوحة أو فجوة في التغطية).') + '</div>'; return; }
    var row = function (k, v) { return v ? '<tr><th style="width:32%">' + k + '</th><td dir="auto" style="text-align:start">' + v + '</td></tr>' : ''; };
    $('#uRes').innerHTML = U.map(function (u, i) { var p = isFinite(u.b_age) ? per((u.b_age + u.t_age) / 2) : null, key = lithKey(u.lith + ' ' + u.name), env = u.env || (key ? ST.facies({ rock: key, st: [] }) : ''), d = denom(u);
      var src = (u.url ? '<a href="' + SH.esc(u.url) + '" target="_blank" rel="noopener">' : '') + SH.esc(u.src || '—') + (u.url ? ' ↗</a>' : '') + (u.authors ? '<br><span class="xsmall muted">' + SH.esc(u.authors) + (u.year ? ' (' + u.year + ')' : '') + '</span>' : '') + (u.title && u.title !== u.src ? '<br><span class="xsmall">' + SH.esc(u.title) + '</span>' : '') +
        (u.doi ? '<br><a class="xsmall" href="' + (/^10\./.test(u.doi) ? 'https://doi.org/' : 'https://www.google.com/search?q=') + encodeURIComponent(u.doi) + '" target="_blank" rel="noopener">' + SH.esc(u.doi) + ' ↗</a>' : '') + (u.source_id ? '<br><a class="xsmall" href="https://macrostrat.org/maps/' + u.source_id + '" target="_blank" rel="noopener">' + t('Source map on Macrostrat', 'الخريطة المصدر في Macrostrat') + ' ↗</a>' : '');
      return '<section style="border-top:' + (i ? '1px solid var(--line)' : '0') + '"><div style="padding:14px 16px 8px"><p class="xsmall" style="margin:0;color:var(--accent);font-weight:700">' + (i === 0 ? t('Most detailed · ', 'الأكثر تفصيلاً · ') : '') + (SCN[u.scale] ? SCN[u.scale][0] : SH.esc(u.scale || '')) + (isFinite(d) ? ' · <bdi>1:' + Math.round(d).toLocaleString('en-US') + '</bdi>' : '') + '</p><h3 style="margin:4px 0;font-size:1rem;line-height:1.5"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:7px;background:' + SH.esc(u.color) + ';border:1px solid rgba(0,0,0,.25);font-weight:800;font-size:.8rem;color:#111;margin-inline-end:8px">' + (i + 1) + '</span>' + SH.esc(u.name) + '</h3>' +
        (isFinite(u.b_age) ? '<p class="small" style="margin:0"><b>' + SH.esc(u.b_int + (u.t_int && u.t_int !== u.b_int ? ' – ' + u.t_int : '')) + '</b> · <bdi>' + fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma</bdi></p>' : '') + '</div>' +
        '<table class="kv" style="font-size:.84rem">' + row(t('Period', 'العصر'), p ? '<span style="display:inline-block;width:10px;height:10px;background:' + p[4] + ';border:1px solid #888;margin-inline-end:6px"></span>' + (AR ? p[1] + ' <span class="muted">(' + p[0] + ')</span>' : p[0]) : '') + row(t('Stratigraphic name', 'الاسم الطباقي'), SH.esc(u.strat)) + row(t('Lithology', 'الصخارية'), SH.esc(u.lith)) +
        row(t('Depositional setting', 'البيئة الترسيبية'), SH.esc(u.env) || (env ? SH.esc(env) + ' <span class="xsmall muted">(' + t('inferred from the lithology', 'مستنتجة من الصخارية') + ')</span>' : '')) + row(t('Description', 'الوصف'), SH.esc(u.desc)) + row(t('Comments', 'ملاحظات'), SH.esc(u.comm)) + row(t('Source map', 'الخريطة المصدر'), src) + '</table>' +
        '<div class="no-print" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 16px 14px"><button class="btn btn-line btn-xs" data-poly="' + i + '" type="button">' + t('Show unit boundary', 'أظهر حدود الوحدة') + '</button><button class="btn btn-line btn-xs" data-zoom="' + i + '" type="button">' + t('Zoom to unit', 'قرّب إلى الوحدة') + '</button></div></section>'; }).join('') +
      '<p class="xsmall muted" style="padding:10px 16px;margin:0;border-top:1px solid var(--line)">' + t('Data: Macrostrat (Peters et al. 2018), CC BY 4.0, from the cited source maps. Map units are generalised to the scale of each source map.', 'البيانات: Macrostrat (Peters وآخرون 2018) بترخيص CC BY 4.0، من الخرائط المصدر المذكورة. وحدات الخريطة معممة بحسب مقياس كل خريطة مصدر.') + '</p>';
  }

  /* ---------- unit boundary on demand */
  function clearPolys() { polys = {}; if (polyLayer && map) map.removeLayer(polyLayer); polyLayer = map ? L.featureGroup().addTo(map) : null; }
  function getPoly(i) { var u = S0.units[i]; if (polys[i]) return Promise.resolve(polys[i]);
    return JS(API + 'geologic_units/map?lat=' + S0.lat.toFixed(5) + '&lng=' + S0.lon.toFixed(5) + (u.scale ? '&scale=' + u.scale : '') + '&format=geojson_bare', 30000).then(function (g) { var f = (g.features || data(g) && data(g).features || []).filter(function (x) { var p = x.properties || {}; return u.map_id == null || p.map_id === u.map_id; })[0] || (g.features || [])[0];
      if (!f || !f.geometry) throw new Error(t('The boundary of this unit is not available.', 'حدود هذه الوحدة غير متاحة.')); polys[i] = L.geoJSON(f, { style: { color: '#C0392B', weight: 2.2, dashArray: '6 4', fillColor: u.color, fillOpacity: .18 } }); polys[i]._f = f; return polys[i]; }); }
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
    var lx = xU + n * (bw + 8) + 14, ly = 74; tx(S, lx, ly - 14, 'KEY', { 'font-size': 10, 'font-weight': 800, 'letter-spacing': 1 });
    U.slice(0, n).forEach(function (u, i) { var y = ly + i * 34; S.add('rect', { x: lx, y: y - 9, width: 14, height: 14, fill: u.color, stroke: INK, 'stroke-width': .8 }); tx(S, lx + 7, y + 2, String(i + 1), { 'font-size': 9, 'font-weight': 800, 'text-anchor': 'middle' });
      var nm = u.name.length > 46 ? u.name.slice(0, 44) + '…' : u.name; tx(S, lx + 22, y + 2, nm, { 'font-size': 10.5, 'font-weight': 700 }); tx(S, lx + 22, y + 16, (u.scale || '') + ' scale · ' + fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma', { 'font-size': 9.5, fill: MUT }); });
    tx(S, 20, VH - 12, 'Vertical axis: square root of age, to show young intervals legibly. ICS International Chronostratigraphic Chart (2023) colours.', { 'font-size': 9.5, fill: MUT });
    $('#uTsCap').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('age intervals (Ma) of the units mapped at the point at each map scale.', 'الفترات العمرية (مليون سنة) للوحدات المرسومة عند النقطة في كل مقياس خرائطي.') + '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('each numbered bar spans the age interval of the unit with the same number in the unit list.', 'يمتد كل عمود مرقّم على الفترة العمرية للوحدة التي تحمل الرقم نفسه في قائمة الوحدات.') + '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' +
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
    var C = [['sys', 44, 'System'], ['unit', 210, S0.colMode === 'col' ? 'Unit / Formation' : 'Map unit'], ['age', 92, 'Age (Ma)'], ['lith', 130, 'Lithology'], ['thk', 56, real ? 'Thick. (m)' : 'Gap (Myr)'], ['desc', 0, 'Lithology and setting']], x = 20;
    C[5][1] = W - 40 - C.slice(0, 5).reduce(function (a, c) { return a + c[1]; }, 0); C.forEach(function (c) { c.x = x; x += c[1]; }); var col = function (k) { return C.filter(function (c) { return c[0] === k; })[0]; };
    var top = 60, HH = 34, y0 = top + HH, hs = rows.map(function (r) { return real ? Math.max(24, r.th / tot * Math.max(420, rows.length * 34)) : 36; }), ys = [y0]; hs.forEach(function (h) { ys.push(ys[ys.length - 1] + h); }); var yb = ys[ys.length - 1];
    var usedK = {}; rows.forEach(function (r) { if (r.key) usedK[r.key] = 1; }); var gaps = rows.some(function (r, i) { return i && r.t - rows[i - 1].b > 0.5; });
    var VH = yb + 60 + Math.ceil((Object.keys(usedK).length + 3) / 4) * 26 + 20;
    S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); var bg = S.add('rect', { x: 0, y: 0, width: W, height: VH, fill: '#fff' });
    tx(S, W / 2, 34, S0.colMode === 'col' ? 'Macrostrat stratigraphic column at the point' : 'Generalised succession of the map units within 25 km', { 'font-size': 16, 'font-weight': 800, 'text-anchor': 'middle' });
    S.add('rect', { x: 20, y: top, width: W - 40, height: HH, fill: '#F2F0EA', stroke: INK, 'stroke-width': 1.1 });
    C.forEach(function (c) { if (c[0] === 'sys') { var cx = c.x + c[1] / 2, cy = top + HH / 2; tx(S, cx, cy + 4, c[2], { 'font-size': 9.5, 'font-weight': 800, 'text-anchor': 'middle', transform: 'rotate(-90 ' + cx + ' ' + cy + ')' }); } else tx(S, c.x + c[1] / 2, top + HH / 2 + 4, c[2], { 'font-size': 10.5, 'font-weight': 800, 'text-anchor': 'middle' }); S.line(c.x, top, c.x, yb, { stroke: INK, 'stroke-width': .9 }); });
    S.add('rect', { x: 20, y: top, width: W - 40, height: yb - top, fill: 'none', stroke: INK, 'stroke-width': 1.3 });
    // system cells (merged by ICS period of the mean age)
    var pk = function (r) { var p = per((r.t + r.b) / 2); return p ? p[0] : ''; }, s0 = 0;
    for (var i = 1; i <= rows.length; i++) if (i === rows.length || pk(rows[i]) !== pk(rows[s0])) { var p = per((rows[s0].t + rows[s0].b) / 2), c = col('sys'), ya = ys[s0], hh = ys[i] - ya; S.add('rect', { x: c.x, y: ya, width: c[1], height: hh, fill: p ? p[4] : '#fff', stroke: INK, 'stroke-width': .8 }); if (p && hh > 40) { var cx = c.x + c[1] / 2, cy = ya + hh / 2; tx(S, cx, cy + 4, p[0].toUpperCase(), { 'font-size': Math.min(10, hh / p[0].length * 1.5), 'font-weight': 800, 'text-anchor': 'middle', transform: 'rotate(-90 ' + cx + ' ' + cy + ')' }); } s0 = i; }
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
    var VH2 = ly + 24 + Math.ceil(items.length / 4) * 26 + 6; S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH2); bg.setAttribute('height', VH2);
    $('#uColCap').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + (S0.colMode === 'col' ? t('Macrostrat measured column covering the point (unit thickness, lithology and environment).', 'العمود الطباقي المقيس في Macrostrat الذي يغطي النقطة (سمك الوحدات وصخاريتها وبيئتها).') : t('map units of the most detailed map at the point and at sixteen points 10 and 25 km around it.', 'وحدات الخريطة الأكثر تفصيلاً عند النقطة وعند ست عشرة نقطة على بعد 10 و25 كم حولها.')) +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + (real ? t('units from youngest (top) to oldest, heights proportional to thickness.', 'الوحدات من الأحدث (أعلى) إلى الأقدم، والارتفاعات متناسبة مع السمك.') : t('units ordered by age from youngest (top) to oldest; heights are schematic because map units carry no thickness.', 'الوحدات مرتبة بحسب العمر من الأحدث (أعلى) إلى الأقدم؛ والارتفاعات تخطيطية لأن وحدات الخرائط لا تحمل سمكاً.')) +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (gaps ? t('Red wavy lines mark intervals of time not represented by any unit: unconformities, non-deposition, or units not exposed in the surveyed area.', 'تشير الخطوط الحمراء المتموجة إلى فترات زمنية غير ممثلة بأي وحدة: عدم توافق أو انقطاع في الترسيب أو وحدات غير مكشوفة في المنطقة المستقصاة.') : t('The units form a continuous age sequence with no gap larger than 0.5 Myr.', 'تشكل الوحدات تتابعاً عمرياً متصلاً بلا فجوة تزيد على 0.5 مليون سنة.')) + ' ' + t('Lithology patterns follow FGDC-STD-013-2006.', 'تتبع أنماط الصخارية المعيار FGDC-STD-013-2006.');
  }
  function HALO(a) { return Object.assign(a, { stroke: '#fff', 'stroke-width': 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }); }
  $('#uColDes').addEventListener('click', function () { var rows = colRows(); if (!rows.length) return;
    var go = function () { SH.store.set('shandal_strata_units', rows.map(function (r) { return { fm: r.fm || r.name, grp: r.gp || '', age: '', ma: (r.t + r.b) / 2, ageTxt: fmtMa(r.b) + '–' + fmtMa(r.t) + ' Ma', rock: r.key || 'limestone', sec: '', mix: 'inter', th: r.th > 0 ? r.th : 100, gs: '', res: 3, base: 'sharp', st: [], pet: [], col: '', desc: r.lith ? r.lith.charAt(0).toUpperCase() + r.lith.slice(1) : '', com: '' }; }));
      var h = SH.store.get('shandal_tool_strata2', {}); h.cTitle = (S0.colMode === 'col' ? 'Stratigraphic column' : 'Generalised succession') + (placeTxt(S0.place, true) ? ' — ' + placeTxt(S0.place, true) : ''); h.cLoc = SH.fmtLatLon(S0.lat, S0.lon, 4); h.cSrc = S0.colMode === 'col' ? 'Macrostrat column' : 'Macrostrat map units within 25 km' + (real0() ? '' : '; thicknesses to be set'); h.cScale = 'sch'; SH.store.set('shandal_tool_strata2', h);
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
    html += H(t('2. Surface geology', 'ثانياً: الجيولوجيا السطحية')) + P(t('On the most detailed map available (', 'على أكثر الخرائط تفصيلاً المتاحة (') + SH.esc(u.src || '—') + (isFinite(d) ? ', <bdi>1:' + Math.round(d).toLocaleString('en-US') + '</bdi>' : '') + t('), the point falls within ', ')، تقع النقطة ضمن ') + '<b>' + SH.esc(u.name) + '</b>' + (isFinite(u.b_age) ? t(', dated ', '، وعمرها ') + SH.esc(u.b_int + (u.t_int && u.t_int !== u.b_int ? '–' + u.t_int : '')) + ' (<bdi>' + fmtMa(u.b_age) + '–' + fmtMa(u.t_age) + ' Ma</bdi>)' : '') + '.' + (u.lith ? t(' Lithology: ', ' الصخارية: ') + SH.esc(u.lith) + '.' : '') + (u.desc ? ' ' + SH.esc(u.desc) : '') +
      (U.length > 1 ? t(' Smaller-scale compilations show ', ' وتُظهر الخرائط ذات المقياس الأصغر ') + U.slice(1).map(function (x) { return '<b>' + SH.esc(x.name) + '</b> (' + (SCN[x.scale] ? SCN[x.scale][0] : x.scale) + ')'; }).join(AR ? '، ' : ', ') + '.' : ''));
    if (p) html += H(t('3. Geological age context', 'ثالثاً: السياق الزمني الجيولوجي')) + P('<b>' + (AR ? p[1] : p[0]) + '</b> (<bdi>' + fmtMa(p[3]) + '–' + fmtMa(p[2]) + ' Ma</bdi>)' + t(': ', ': ') + (CTX[p[0]] ? CTX[p[0]][AR ? 1 : 0] : t('Precambrian basement history: crust formation, orogenic belts and early life.', 'تاريخ القاعدة لما قبل الكامبري: تكوّن القشرة والأحزمة الجبلية والحياة المبكرة.')) + ' ' + t('The unit is ', 'وعمر الوحدة ') + '<bdi>' + SH.fmt((u.b_age + u.t_age) / 2, 1) + '</bdi>' + t(' million years old on average.', ' مليون سنة في المتوسط.'));
    var env = u.env || (key ? ST.facies({ rock: key, st: [] }) : ''), dig = key ? ST.dig({ rock: key }) : null;
    html += H(t('4. Lithology and depositional setting', 'رابعاً: الصخارية والبيئة الترسيبية')) + P((key ? t('The dominant lithology is classed as ', 'تُصنّف الصخارية السائدة على أنها ') + '<b>' + (AR ? ST.R[key][1] : ST.R[key][0].toLowerCase()) + '</b>. ' : t('The map unit groups several lithologies and is not resolved into a single rock type at this scale. ', 'تجمع الوحدة الخرائطية عدة أنواع صخرية ولا تُفصل إلى نوع واحد بهذا المقياس. ')) + (env ? t('Depositional setting: ', 'البيئة الترسيبية: ') + SH.esc(String(env).replace(/\.$/, '')) + (u.env ? '.' : t(' (inferred from the lithology).', ' (مستنتجة من الصخارية).')) : '') + (dig ? ' ' + t('Expected excavatability: ', 'قابلية الحفر المتوقعة: ') + dig[0] + '.' : ''));
    var rows = colRows();
    if (rows.length) { var gp = []; rows.forEach(function (r, i) { if (i && r.t - rows[i - 1].b > 0.5) gp.push('<bdi>' + SH.fmt(r.t - rows[i - 1].b, 1) + ' Myr</bdi>' + t(' between ', ' بين ') + SH.esc(rows[i - 1].name) + t(' and ', ' و') + SH.esc(r.name)); });
      html += H(t('5. Local succession', 'خامساً: التتابع المحلي')) + P((S0.colMode === 'col' ? t('The Macrostrat column at the point comprises ', 'يتألف عمود Macrostrat عند النقطة من ') : t('Within 25 km of the point the map shows ', 'تُظهر الخريطة ضمن 25 كم من النقطة ')) + '<b>' + rows.length + '</b>' + t(' units, from oldest to youngest: ', ' وحدة، من الأقدم إلى الأحدث: ') + rows.slice().reverse().map(function (r) { return SH.esc(r.name); }).join(' → ') + '. ' +
        (gp.length ? t('Age gaps: ', 'الفجوات العمرية: ') + gp.join(AR ? '؛ ' : '; ') + t('. These record unconformities, non-deposition or units not exposed in the area.', '. وهي تسجل عدم توافق أو انقطاعاً في الترسيب أو وحدات غير مكشوفة في المنطقة.') : t('No age gap larger than 0.5 Myr is present.', 'لا توجد فجوة عمرية تزيد على 0.5 مليون سنة.'))); }
    if (isFinite(d)) html += H(t('6. Reliability of the map', 'سادساً: موثوقية الخريطة')) + P(t('At ', 'عند المقياس ') + '<bdi>1:' + Math.round(d).toLocaleString('en-US') + '</bdi>' + t(' a 0.5 mm line represents about ', ' يمثل خط بعرض 0.5 مم نحو ') + '<bdi>' + SH.fmt(d * 0.0005 / 1000, d * 0.0005 < 1000 ? 2 : 1) + ' km</bdi>' + t(' on the ground, so contacts may be displaced by this amount and bodies smaller than about ', ' على الأرض، لذا قد تنزاح الحدود بهذا المقدار ولا تظهر الأجسام الأصغر من نحو ') + '<bdi>' + SH.fmt(d * 0.002 / 1000, 1) + ' km</bdi>' + t(' are not shown. Field verification or a larger-scale national map is required for site work.', '. ويلزم التحقق الحقلي أو خريطة وطنية بمقياس أكبر لأعمال الموقع.'));
    $('#uNarr').innerHTML = html;
  }

  /* ---------- links */
  function links() {
    if (!isFinite(S0.lat)) return; var la = S0.lat.toFixed(5), lo = S0.lon.toFixed(5), u = S0.units[0], c = S0.place && S0.place.address ? S0.place.address.country || '' : '', A = function (h, en, ar, note) { return '<li><a href="' + h + '" target="_blank" rel="noopener">' + t(en, ar) + ' ↗</a>' + (note ? '<span class="xsmall muted"> — ' + note + '</span>' : '') + '</li>'; };
    var srcs = []; S0.units.forEach(function (x) { if (x.source_id && !srcs.some(function (y) { return y.source_id === x.source_id; })) srcs.push(x); });
    var tool = function (slug, en, ar) { return '<li><a href="' + SH.base + (AR ? 'ar/' : '') + 'tools/' + slug + '/app/">' + t(en, ar) + '</a></li>'; };
    $('#uLinks').innerHTML = '<div class="row2" style="align-items:start"><div><h3 style="margin:0 0 6px;font-size:.92rem">' + t('Source maps', 'الخرائط المصدر') + '</h3><ul style="margin:0;padding-inline-start:18px;line-height:1.9">' +
      (srcs.length ? srcs.map(function (x) { return (x.url ? A(SH.esc(x.url), x.src, x.src, t('original publication', 'المنشور الأصلي')) : '') + A('https://macrostrat.org/maps/' + x.source_id, x.src + ' — Macrostrat', x.src + ' — Macrostrat', t('map details, licence and download', 'تفاصيل الخريطة وترخيصها وتنزيلها')); }).join('') : '<li class="muted">—</li>') +
      A('https://macrostrat.org/map/loc/' + lo + '/' + la, 'Macrostrat map at this point', 'خريطة Macrostrat عند هذه النقطة') + A('https://portal.onegeology.org/OnegeologyGlobal/', 'OneGeology portal (national geological surveys)', 'بوابة OneGeology (هيئات المسح الجيولوجي الوطنية)') + A('https://mrdata.usgs.gov/general/map-global.html', 'USGS global mineral resources data', 'بيانات الموارد المعدنية العالمية (USGS)') + '</ul></div>' +
      '<div><h3 style="margin:0 0 6px;font-size:.92rem">' + t('Imagery, literature and related tools', 'الصور والأدبيات والأدوات المرتبطة') + '</h3><ul style="margin:0;padding-inline-start:18px;line-height:1.9">' +
      A('https://earth.google.com/web/@' + la + ',' + lo + ',800a,25000d,35y,0h,0t,0r', 'Google Earth (3-D view)', 'Google Earth (عرض ثلاثي الأبعاد)') + A('https://www.openstreetmap.org/?mlat=' + la + '&mlon=' + lo + '#map=12/' + la + '/' + lo, 'OpenStreetMap', 'OpenStreetMap') +
      (u ? A('https://scholar.google.com/scholar?q=' + encodeURIComponent('"' + (u.strat || u.name).split(',')[0] + '" geology ' + c), 'Google Scholar: publications on this unit', 'Google Scholar: منشورات عن هذه الوحدة') : '') +
      (u && isFinite(u.b_age) ? A('https://' + (AR ? 'ar' : 'en') + '.wikipedia.org/w/index.php?search=' + encodeURIComponent(AR ? 'العصر ' + per((u.b_age + u.t_age) / 2)[1] : per((u.b_age + u.t_age) / 2)[0] + ' period'), 'Wikipedia: the period', 'ويكيبيديا: العصر الجيولوجي') : '') +
      tool('fossils', 'Fossil Sites Explorer', 'مستكشف مواقع الأحافير') + tool('strata', 'Stratigraphic Column Designer', 'مصمم العمود الطباقي') + tool('dem-studio', 'DEM Studio (terrain)', 'استوديو نماذج الارتفاع') + '</ul></div></div>';
  }

  /* ---------- table and exports */
  function table() { var U = S0.units; $('#uTbl').innerHTML = '<thead><tr><th>No.</th><th>' + t('Unit', 'الوحدة') + '</th><th>' + t('Scale', 'المقياس') + '</th><th>' + t('Age', 'العمر') + '</th><th class="num">' + t('Base Ma', 'القاعدة م.س') + '</th><th class="num">' + t('Top Ma', 'القمة م.س') + '</th><th>' + t('Lithology', 'الصخارية') + '</th><th>' + t('Source', 'المصدر') + '</th></tr></thead><tbody>' +
    U.map(function (u, i) { return '<tr><td>' + (i + 1) + '</td><td><b>' + SH.esc(u.name) + '</b></td><td>' + SH.esc(u.scale) + '</td><td>' + SH.esc(u.b_int + (u.t_int && u.t_int !== u.b_int ? ' – ' + u.t_int : '')) + '</td><td class="num">' + fmtMa(u.b_age) + '</td><td class="num">' + fmtMa(u.t_age) + '</td><td style="white-space:normal;min-width:180px">' + SH.esc(u.lith) + '</td><td style="white-space:normal">' + SH.esc(u.src) + '</td></tr>'; }).join('') + '</tbody>'; }
  $('#uCsv').addEventListener('click', function () { if (!S0.units.length) return; SH.csv('shandal-geological-units.csv', [['lat', 'lon', 'place', 'elevation_m', 'no', 'unit', 'strat_name', 'scale', 'b_int', 't_int', 'b_age_ma', 't_age_ma', 'lithology', 'environment', 'description', 'source', 'authors', 'year', 'url']].concat(S0.units.map(function (u, i) { return [S0.lat, S0.lon, placeTxt(S0.place), S0.elev, i + 1, u.name, u.strat, u.scale, u.b_int, u.t_int, u.b_age, u.t_age, u.lith, u.env, u.desc, u.src, u.authors, u.year, u.url]; }))); });
  $('#uJson').addEventListener('click', function () { if (!isFinite(S0.lat)) return; var f = [{ type: 'Feature', geometry: { type: 'Point', coordinates: [S0.lon, S0.lat] }, properties: { place: placeTxt(S0.place), elevation_m: S0.elev, units: S0.units } }];
    Object.keys(polys).forEach(function (k) { if (polys[k]._f) f.push(Object.assign({}, polys[k]._f, { properties: Object.assign({ unit: S0.units[k].name }, polys[k]._f.properties || {}) })); }); SH.json('shandal-geological-units.geojson', { type: 'FeatureCollection', features: f }); });
  $('#uTsPng').addEventListener('click', function () { SH.svgPng($('#uSvg'), 'shandal-time-scale.png', 2); });
  $('#uColPng').addEventListener('click', function () { SH.svgPng($('#uCol'), 'shandal-succession.png', 2); });
  $('#uMapPng').addEventListener('click', function () { if (!SH.mapImage) return; var b = this; b.disabled = true; SH.mapImage($('#uMap')).then(function (im) { return fetch(im.src).then(function (r) { return r.blob(); }); }).then(function (bl) { SH.download('shandal-geological-map.jpg', bl); }).catch(function () { SH.toast(t('The map image could not be created.', 'تعذر إنشاء صورة الخريطة.'), 'warn'); }).then(function () { b.disabled = false; }); });
  function mapCap() { $('#uMapCap').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('the selected point.', 'النقطة المختارة.') + ' <b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('Macrostrat integrated geological map (unit colours of the source maps), the point with its place name, and the unit boundary when requested.', 'الخريطة الجيولوجية المدمجة في Macrostrat (بألوان وحدات الخرائط المصدر)، والنقطة مع اسم المكان، وحدود الوحدة عند الطلب.') + ' <b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + t('the boundary shows the extent of the unit on the source map; its precision is limited by the map scale shown in the unit list. Place names © OpenStreetMap contributors (Nominatim).', 'تُظهر الحدود امتداد الوحدة على الخريطة المصدر، ودقتها محدودة بمقياس الخريطة المبين في قائمة الوحدات. أسماء الأماكن © مساهمو OpenStreetMap (Nominatim).'); }
  mapCap();

  if (map) map.on('click', function (e) { query(e.latlng.lat, e.latlng.lng); });
  $('#uGo').addEventListener('click', function () { var a = SH.num('uLat'), b = SH.num('uLon'); if (isNaN(a) || isNaN(b)) { SH.toast(t('Enter coordinates.', 'أدخل الإحداثيات.'), 'warn'); return; } if (map) map.setView([a, b], Math.max(map.getZoom(), 9)); query(a, b); });
  $('#uMe').addEventListener('click', function () { var bt = this; bt.disabled = true; SH.locate().then(function (p) { if (map) map.setView([p.lat, p.lon], 10); query(p.lat, p.lon); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { bt.disabled = false; }); });
  document.addEventListener('sh:beforereport', function (e) { if (!S0.units.length) { e.preventDefault(); SH.toast(t('Identify a point first.', 'حدد نقطة أولاً.'), 'warn'); } });
  var qs = new URLSearchParams(location.search), qa = parseFloat(qs.get('lat')), qb = parseFloat(qs.get('lon'));
  if (isFinite(qa) && isFinite(qb)) { $('#uLat').value = qa; $('#uLon').value = qb; }
  var a0 = SH.num('uLat'), b0 = SH.num('uLon'); if (!isNaN(a0) && !isNaN(b0) && SH.val('uLat') !== '') { if (map) map.setView([a0, b0], 9); query(a0, b0); }
})();
