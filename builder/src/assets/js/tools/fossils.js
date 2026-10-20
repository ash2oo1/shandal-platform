/* Fossil occurrences — Paleobiology Database (data1.2) by area, taxon and interval; coloured by ICS period,
   counts by period and by class, collection links, CSV and GeoJSON export. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('fossils', ['fTax', 'fInt']), map = SH.map('fMap', { zoom: 6, base: 'topo', center: [33, 44], canvas: true }), lay = null, box = null, drawer = null, O = [];
  var per = function (o) { var mid = (o.max_ma + o.min_ma) / 2; return SH.icsAt(mid) || ['Unknown', 'غير معروف', 0, 0, '#999']; };
  function search(b) {
    var w = Math.max(-180, b.getWest()), e = Math.min(180, b.getEast()), s = Math.max(-90, b.getSouth()), n = Math.min(90, b.getNorth());
    if (e - w > 60 || n - s > 45) { SH.toast(t('Area too large. Zoom in or draw a smaller rectangle.', 'المساحة كبيرة جداً. كبّر الخريطة أو ارسم مستطيلاً أصغر.'), 'warn'); return; }
    persist.save(); if (box) map.removeLayer(box); box = L.rectangle([[s, w], [n, e]], { color: SH.css('--accent'), weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map);
    var q = 'https://paleobiodb.org/data1.2/occs/list.json?vocab=pbdb&show=class,coords,loc,refattr&limit=5000&lngmin=' + w.toFixed(3) + '&lngmax=' + e.toFixed(3) + '&latmin=' + s.toFixed(3) + '&latmax=' + n.toFixed(3);
    if (SH.val('fTax').trim()) q += '&base_name=' + encodeURIComponent(SH.val('fTax').trim()); if (SH.val('fInt').trim()) q += '&interval=' + encodeURIComponent(SH.val('fInt').trim());
    SH.busy($('#fMap').parentElement, true, t('Querying PBDB…', 'جارٍ الاستعلام من PBDB…'));
    SH.getJSON(q, { timeout: 40000 }).then(function (j) { if (j.errors) throw new Error(j.errors.join('; ')); O = (j.records || []).map(function (r) { return { id: r.occurrence_no, cid: r.collection_no, name: r.accepted_name || r.identified_name, rank: r.accepted_rank || r.identified_rank, phylum: r.phylum, cls: r['class'], order: r.order, family: r.family, early: r.early_interval, late: r.late_interval || r.early_interval, max_ma: +r.max_ma, min_ma: +r.min_ma, lat: +r.lat, lon: +r.lng, country: r.cc, formation: r.formation, ref: (r.ref_author || '') + (r.ref_pubyr ? ' ' + r.ref_pubyr : '') }; });
      draw(); stats(); $('#fInfo').innerHTML = '<b>' + O.length + '</b> ' + t('occurrences', 'تواجداً') + (O.length >= 5000 ? ' · ' + t('limit reached; narrow the search', 'بلغ الحد؛ ضيّق البحث') : '') + ' · Paleobiology Database (CC BY 4.0)'; })
      .catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { SH.busy($('#fMap').parentElement, false); });
  }
  function draw() {
    if (lay) map.removeLayer(lay); lay = L.layerGroup().addTo(map);
    var g = {}; O.forEach(function (o) { var k = o.lat.toFixed(3) + ',' + o.lon.toFixed(3); (g[k] = g[k] || []).push(o); });
    Object.keys(g).forEach(function (k) { var a = g[k], o = a[0], p = per(o); L.circleMarker([o.lat, o.lon], { radius: Math.min(14, 4 + Math.sqrt(a.length) * 1.5), color: '#222', weight: .8, fillColor: p[4], fillOpacity: .9 }).bindPopup(function () { return pop(a); }, { maxWidth: 320 }).addTo(lay); });
  }
  function pop(a) { var o = a[0]; return '<b>' + (SH.lang === 'ar' ? t('Collection ', 'المجموعة ') : 'Collection ') + o.cid + '</b> · ' + a.length + t(' taxa', ' أصنوفة') + '<div style="font-size:12px;color:#666">' + SH.esc(o.early + (o.late && o.late !== o.early ? ' – ' + o.late : '')) + ' · ' + SH.fmt(o.max_ma, 1) + '–' + SH.fmt(o.min_ma, 1) + ' Ma' + (o.formation ? ' · ' + SH.esc(o.formation) + ' Fm.' : '') + '</div><div style="max-height:160px;overflow:auto;margin-top:6px;font-size:12px">' +
      a.slice(0, 40).map(function (x) { return '<div><i>' + SH.esc(x.name || '') + '</i> <span style="color:#888">' + SH.esc([x.cls, x.family].filter(Boolean).join(' · ')) + '</span></div>'; }).join('') + '</div><a href="https://paleobiodb.org/classic/basicCollectionSearch?collection_no=' + o.cid + '" target="_blank" rel="noopener">PBDB ↗</a>'; }
  function stats() {
    $('#fStats').hidden = !O.length; if (!O.length) { $('#fList').innerHTML = ''; return; }
    var cols = {}, taxa = {}, P = {}, C = {}; O.forEach(function (o) { cols[o.cid] = 1; taxa[o.name] = 1; var p = per(o)[0]; P[p] = (P[p] || 0) + 1; var c = o.cls || o.phylum || t('Unclassified', 'غير مصنف'); C[c] = (C[c] || 0) + 1; });
    var oldest = O.reduce(function (a, o) { return o.max_ma > a.max_ma ? o : a; }), youngest = O.reduce(function (a, o) { return o.min_ma < a.min_ma ? o : a; });
    $('#fKpis').innerHTML = '<div class="kpi info"><span class="k">' + t('Occurrences', 'التواجدات') + '</span><span class="v">' + SH.fmt(O.length, 0) + '</span><span class="s">' + Object.keys(cols).length + t(' collections', ' مجموعة') + '</span></div><div class="kpi"><span class="k">' + t('Taxa', 'الأصنوفات') + '</span><span class="v">' + Object.keys(taxa).length + '</span><span class="s">' + SH.fmt(oldest.max_ma, 0) + '–' + SH.fmt(youngest.min_ma, 0) + ' Ma</span></div>';
    var ord = SH.ics.filter(function (p) { return P[p[0]]; }); SH.plot('fPer', [{ type: 'bar', x: ord.map(function (p) { return SH.lang === 'ar' ? p[1] : p[0]; }), y: ord.map(function (p) { return P[p[0]]; }), marker: { color: ord.map(function (p) { return p[4]; }), line: { color: '#333', width: .5 } }, hovertemplate: '%{x}: %{y}<extra></extra>' }], function () { return SH.plotLayout({ margin: { l: 40, r: 6, t: 8, b: 70 }, showlegend: false, xaxis: { tickangle: -40, autorange: 'reversed' } }); });
    var ck = Object.keys(C).sort(function (a, b) { return C[b] - C[a]; }).slice(0, 10); SH.plot('fCls', [{ type: 'bar', orientation: 'h', y: ck.slice().reverse(), x: ck.slice().reverse().map(function (k) { return C[k]; }), marker: { color: SH.palette().accent }, hovertemplate: '%{y}: %{x}<extra></extra>' }], function () { return SH.plotLayout({ margin: { l: 110, r: 6, t: 8, b: 30 }, showlegend: false }); });
    $('#fList').innerHTML = O.slice().sort(function (a, b) { return a.max_ma - b.max_ma; }).slice(0, 150).map(function (o, i) { var p = per(o); return '<button type="button" data-o="' + O.indexOf(o) + '" style="all:unset;cursor:pointer;display:grid;grid-template-columns:8px 1fr;gap:10px;padding:8px 16px;border-top:1px solid var(--line)"><span style="background:' + p[4] + ';border-radius:4px"></span><span style="display:grid;gap:1px"><i style="font-size:.86rem;font-weight:700">' + SH.esc(o.name || '') + '</i><span class="xsmall muted">' + SH.esc([o.cls, o.early].filter(Boolean).join(' · ')) + ' · ' + SH.fmt(o.max_ma, 1) + '–' + SH.fmt(o.min_ma, 1) + ' Ma</span></span></button>'; }).join('');
  }
  $('#fList').addEventListener('click', function (e) { var b = e.target.closest('[data-o]'); if (!b) return; var o = O[+b.getAttribute('data-o')]; map.flyTo([o.lat, o.lon], Math.max(map.getZoom(), 9), { duration: .7 }); });
  $('#fView').addEventListener('click', function () { if (map) search(map.getBounds().pad(-0.05)); });
  $('#fDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); search(bb); }, $('#fHint')); });
  $('#fCsv').addEventListener('click', function () { SH.csv('shandal-pbdb-occurrences.csv', [['occurrence_no', 'collection_no', 'taxon', 'rank', 'phylum', 'class', 'order', 'family', 'early_interval', 'late_interval', 'max_ma', 'min_ma', 'lat', 'lon', 'formation', 'country', 'reference']].concat(O.map(function (o) { return [o.id, o.cid, o.name, o.rank, o.phylum, o.cls, o.order, o.family, o.early, o.late, o.max_ma, o.min_ma, o.lat, o.lon, o.formation, o.country, o.ref]; }))); });
  $('#fGeo').addEventListener('click', function () { SH.json('shandal-pbdb-occurrences.geojson', { type: 'FeatureCollection', features: O.map(function (o) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [o.lon, o.lat] }, properties: { occurrence_no: o.id, collection_no: o.cid, taxon: o.name, class: o.cls, family: o.family, early_interval: o.early, max_ma: o.max_ma, min_ma: o.min_ma, formation: o.formation } }; }) }); });
  ['fTax', 'fInt'].forEach(function (id) { $('#' + id).addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#fView').click(); }); });
})();
