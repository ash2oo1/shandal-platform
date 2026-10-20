/* Geological unit finder — Macrostrat integrated geological map at any point: units at every available scale,
   age interval, lithology, description and source map, with the ICS time scale and a map overlay. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('geounit', ['uLat', 'uLon', 'uOv']), map = SH.map('uMap', { zoom: 6, base: 'light', center: [34, 44] }), ov = null, mk = null;
  var API = 'https://macrostrat.org/api/v2/';
  function overlay() { if (!map) return; if (ov) { map.removeLayer(ov); ov = null; } if (!$('#uOv').checked) return; ov = L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: .6, maxZoom: 18, attribution: 'Geology © <a href="https://macrostrat.org">Macrostrat</a> (CC BY 4.0)' }).addTo(map); }
  overlay(); $('#uOv').addEventListener('change', function () { persist.save(); overlay(); });
  function norm(u) {
    var bi = u.b_int || {}, ti = u.t_int || {}, ref = u.ref || {};
    return { name: u.name || u.unit_name || '', strat: u.strat_name || (u.macrostrat && u.macrostrat.strat_names && u.macrostrat.strat_names.map(function (s) { return s.rank_name || s.strat_name; }).join(', ')) || '', lith: u.lith || (u.liths || []).map(function (l) { return l.lith; }).join(', '), desc: u.descrip || '', comm: u.comments || '',
      age: u.age || '', b_int: u.b_int_name || bi.int_name || '', t_int: u.t_int_name || ti.int_name || '', b_age: +(u.b_age != null ? u.b_age : u.b_int_age != null ? u.b_int_age : bi.b_age), t_age: +(u.t_age != null ? u.t_age : u.t_int_age != null ? u.t_int_age : ti.t_age), color: u.color || '#ccc', scale: u.scale || ref.scale || '', src: ref.name || ref.ref_title || u.source || '', url: ref.url || '', authors: ref.authors || '', year: ref.ref_year || '', source_id: u.source_id || ref.source_id };
  }
  function query(lat, lon) {
    $('#uLat').value = lat.toFixed(5); $('#uLon').value = lon.toFixed(5); persist.save();
    if (map) { if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); }
    var u = SH.toUTM(lat, lon); $('#uXY').innerHTML = '<span class="ltr">' + SH.fmtLatLon(lat, lon, 5) + '<br>UTM ' + u.zone + u.band + ' · E ' + u.E.toFixed(0) + ' · N ' + u.N.toFixed(0) + '</span>';
    $('#uRes').innerHTML = '<div class="xsmall muted" style="padding:14px 16px">' + t('Querying Macrostrat…', 'جارٍ الاستعلام من Macrostrat…') + '</div>';
    var z = map ? Math.max(3, map.getZoom()) : 8;
    SH.getJSON(API + 'mobile/map_query?lat=' + lat.toFixed(5) + '&lng=' + lon.toFixed(5) + '&z=' + z, { timeout: 25000 }).then(function (j) { var d = j.success ? j.success.data : j.data || j; var arr = d.burwell || d.mapData || d; return { units: (Array.isArray(arr) ? arr : []).map(norm), elev: d.elevation }; })
      .catch(function () { return SH.getJSON(API + 'geologic_units/map?lat=' + lat.toFixed(5) + '&lng=' + lon.toFixed(5), { timeout: 25000 }).then(function (j) { var d = j.success ? j.success.data : j.data || j; return { units: (Array.isArray(d) ? d : []).map(norm) }; }); })
      .then(function (r) { render(r, lat, lon); return SH.getJSON(API + 'geologic_units/map?lat=' + lat.toFixed(5) + '&lng=' + lon.toFixed(5), { timeout: 25000 }).then(function (j) { var d = j.success ? j.success.data : [], refs = (j.success && j.success.refs) || {}; var more = (Array.isArray(d) ? d : []).map(function (u) { if (!u.ref && refs[u.source_id]) u.ref = { name: refs[u.source_id] }; return norm(u); }).filter(function (x) { return !r.units.some(function (y) { return y.name === x.name && y.b_age === x.b_age; }); }); if (more.length) { r.units = r.units.concat(more); render(r, lat, lon); } }).catch(function () {}); })
      .catch(function (e) { $('#uRes').innerHTML = '<div class="xsmall" style="padding:14px 16px;color:var(--danger)">' + SH.esc(e.message) + '</div>'; });
  }
  var SC = { large: t('large scale (detailed)', 'مقياس كبير (تفصيلي)'), medium: t('medium scale', 'مقياس متوسط'), small: t('small scale', 'مقياس صغير'), tiny: t('global compilation', 'تجميع عالمي') };
  function render(r, lat, lon) {
    var U = r.units.filter(function (u) { return u.name || u.lith; }); if (!U.length) { $('#uRes').innerHTML = '<div class="xsmall muted" style="padding:14px 16px">' + t('No mapped unit here (open water or a gap in coverage).', 'لا توجد وحدة مرسومة هنا (مياه مفتوحة أو فجوة في التغطية).') + '</div>'; $('#uScale').hidden = true; return; }
    var ord = { large: 0, medium: 1, small: 2, tiny: 3 }; U.sort(function (a, b) { return (ord[a.scale] != null ? ord[a.scale] : 9) - (ord[b.scale] != null ? ord[b.scale] : 9); });
    var row = function (k, v) { return v ? '<tr><th style="width:34%">' + k + '</th><td>' + v + '</td></tr>' : ''; };
    $('#uRes').innerHTML = (r.elev != null ? '<div class="xsmall muted" style="padding:10px 16px">' + t('Elevation ', 'الارتفاع ') + SH.fmt(r.elev, 0) + ' m</div>' : '') + U.map(function (u, i) { var p = SH.icsAt((u.b_age + u.t_age) / 2);
      return '<section style="border-top:1px solid var(--line)"><div style="display:flex;gap:10px;padding:14px 16px 8px;align-items:start"><span style="flex:0 0 14px;height:42px;border-radius:5px;background:' + SH.esc(u.color) + ';border:1px solid rgba(0,0,0,.2)"></span><div style="flex:1;min-width:0"><span class="xsmall" style="color:var(--accent);font-weight:700">' + (i === 0 ? t('Most detailed · ', 'الأكثر تفصيلاً · ') : '') + (SC[u.scale] || u.scale || '') + '</span><h3 style="margin:2px 0;font-size:1rem;line-height:1.35">' + SH.esc(u.name) + '</h3>' +
        (isFinite(u.b_age) ? '<span class="small"><b>' + SH.esc(u.b_int + (u.t_int && u.t_int !== u.b_int ? ' – ' + u.t_int : '')) + '</b> · ' + SH.fmt(u.b_age, u.b_age < 10 ? 2 : 1) + '–' + SH.fmt(u.t_age, u.t_age < 10 ? 2 : 1) + ' Ma</span>' : '') + '</div></div>' +
        '<table class="kv" style="font-size:.84rem">' + row(t('Period', 'العصر'), p ? '<span style="display:inline-block;width:10px;height:10px;background:' + p[4] + ';border:1px solid #888;margin-inline-end:6px"></span>' + (SH.lang === 'ar' ? p[1] : p[0]) : '') + row(t('Stratigraphic name', 'الاسم الطباقي'), SH.esc(u.strat)) + row(t('Lithology', 'الصخارية'), SH.esc(u.lith)) + row(t('Description', 'الوصف'), SH.esc(u.desc)) + row(t('Comments', 'ملاحظات'), SH.esc(u.comm)) +
        row(t('Source map', 'الخريطة المصدر'), (u.url ? '<a href="' + SH.esc(u.url) + '" target="_blank" rel="noopener">' : '') + SH.esc(u.src) + (u.url ? ' ↗</a>' : '') + (u.authors ? '<br><span class="xsmall muted">' + SH.esc(u.authors) + (u.year ? ' (' + u.year + ')' : '') + '</span>' : '')) + '</table></section>'; }).join('') +
      '<p class="xsmall muted" style="padding:10px 16px;margin:0">' + t('Data: Macrostrat (Peters et al. 2018), CC BY 4.0. Map units are generalised; check the source map and the field before relying on a boundary.', 'البيانات: Macrostrat (Peters وآخرون 2018)، CC BY 4.0. وحدات الخريطة معممة؛ راجع الخريطة المصدر والحقل قبل الاعتماد على حد.') + '</p>';
    scale(U.filter(function (u) { return isFinite(u.b_age); }));
  }
  function scale(U) {
    $('#uScale').hidden = !U.length; if (!U.length) return; var S = SH.svgB('uSvg'), c = SH.palette(), mx = Math.max.apply(null, U.map(function (u) { return u.b_age; })), top = 10, H = 340, x0 = 60, w = 70;
    var lim = mx < 2.6 ? 2.58 : mx < 23.1 ? 23.03 : mx < 66 ? 66 : mx < 252 ? 251.902 : mx < 539 ? 538.8 : 4567, Y = function (ma) { return top + Math.sqrt(ma / lim) * H; };
    SH.ics.forEach(function (p) { if (p[2] >= lim) return; var y1 = Y(p[2]), y2 = Y(Math.min(p[3], lim)); S.add('rect', { x: x0, y: y1, width: w, height: y2 - y1, fill: p[4], stroke: '#444', 'stroke-width': .5 }); if (y2 - y1 > 11) S.text(x0 + w / 2, (y1 + y2) / 2 + 4, SH.lang === 'ar' ? p[1] : p[0], { 'font-size': 10, fill: '#111', 'text-anchor': 'middle' }); S.text(x0 - 6, y1 + 4, SH.fmt(p[2], p[2] < 10 ? 2 : 0), { 'font-size': 9, fill: c.text2, 'text-anchor': 'end' }); });
    S.text(x0 - 6, top + H + 4, SH.fmt(lim, lim < 10 ? 2 : 0), { 'font-size': 9, fill: c.text2, 'text-anchor': 'end' }); S.text(8, top + 6, 'Ma', { 'font-size': 10, fill: c.text2 });
    U.slice(0, 4).forEach(function (u, i) { var y1 = Y(Math.min(u.t_age, lim)), y2 = Y(Math.min(u.b_age, lim)), x = x0 + w + 12 + i * 18; S.add('rect', { x: x, y: y1, width: 10, height: Math.max(3, y2 - y1), fill: u.color, stroke: '#111', 'stroke-width': 1 }); });
    S.text(x0 + w + 12, top + H + 22, t('units at the point (by scale)', 'الوحدات عند النقطة (حسب المقياس)'), { 'font-size': 9.5, fill: c.text2 });
  }
  if (map) map.on('click', function (e) { query(e.latlng.lat, e.latlng.lng); });
  $('#uGo').addEventListener('click', function () { var a = SH.num('uLat'), b = SH.num('uLon'); if (isNaN(a) || isNaN(b)) { SH.toast(t('Enter coordinates.', 'أدخل الإحداثيات.'), 'warn'); return; } if (map) map.setView([a, b], Math.max(map.getZoom(), 9)); query(a, b); });
  $('#uMe').addEventListener('click', function () { var bt = this; bt.disabled = true; SH.locate().then(function (p) { if (map) map.setView([p.lat, p.lon], 10); query(p.lat, p.lon); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { bt.disabled = false; }); });
  var qs = new URLSearchParams(location.search), qa = parseFloat(qs.get('lat')), qb = parseFloat(qs.get('lon'));
  if (isFinite(qa) && isFinite(qb)) { $('#uLat').value = qa; $('#uLon').value = qb; }
  var a0 = SH.num('uLat'), b0 = SH.num('uLon'); if (!isNaN(a0) && !isNaN(b0) && SH.val('uLat') !== '') { if (map) map.setView([a0, b0], 9); query(a0, b0); }
})();
