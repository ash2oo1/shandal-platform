/* Fossil Sites Explorer — Paleobiology Database (data1.2) collections and occurrences by area, group and age.
   Three views: search (group guide, summary, charts, site list), site card (rocks, environment, age,
   palaeolatitude, reference, fossils found) and fossil card (Wikipedia text, Commons images, PBDB
   classification, time range, ecology, worldwide record, reference library). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', E = SH.esc;
  var PB = 'https://paleobiodb.org/data1.2/';
  var map = SH.map('fMap', { zoom: 6, base: 'topo', center: [33, 44], canvas: true });
  var G = null, lay = null, box = null, drawer = null, world = null, O = [], S = [], SITES = {}, cur = { site: null, from: 'search' };
  var ARR = AR ? '→' : '←', EXT = '<span aria-hidden="true" style="opacity:.6">↗</span>';

  /* ------------------------------------------------------------------ helpers */
  var clean = function (v) { return v && !/^NO_|^$/.test(v) ? v : ''; };
  var unq = function (v) { return String(v || '').replace(/"/g, '').trim(); };
  var tr = function (dict, k) { if (!k) return ''; var a = dict[k] || dict[String(k).toLowerCase()]; return AR && a ? a : k; };
  var trTokens = function (dict, s) { if (!s) return ''; return String(s).split(/\s*,\s*/).map(function (x) { return AR ? (dict[x] || dict[x.toLowerCase()] || x) : x; }).join(AR ? '، ' : ', '); };
  var per = function (max, min) { return SH.icsAt((max + min) / 2) || ['Unknown', 'غير معروف', 0, 0, '#999']; };
  var pname = function (p) { return AR ? p[1] : p[0]; };
  var ma = function (v) { return SH.fmt(v, v < 10 ? 2 : 1); };
  var country = function (cc) { try { return new Intl.DisplayNames([AR ? 'ar' : 'en'], { type: 'region' }).of(cc); } catch (e) { return cc; } };
  var thumb = function (no) { return no ? PB + 'taxa/thumb.png?id=' + no : ''; };
  var pct = function (a, b) { return Math.round(100 * a / b); };
  var SCALE = { 'outcrop': t('single outcrop', 'مكشف واحد'), 'local area': t('local area', 'منطقة محلية'), 'small collection': t('small collection', 'مجموعة صغيرة'), 'basin': t('whole basin', 'حوض كامل'), 'hand sample': t('hand sample', 'عينة يدوية') };

  /* group of an occurrence: rudists and nummulites first, then class, then phylum */
  function grp(o) {
    if (o.order === 'Hippuritida') return 'Hippuritida';
    if (o.family === 'Nummulitidae') return 'Nummulitidae';
    return clean(o.cls) || clean(o.phylum) || t('Unclassified', 'غير مصنف');
  }
  function gname(k) {
    var g = G && G.groups.filter(function (x) { return x.k === k; })[0]; if (g) return AR ? g.ar : g.en;
    return tr(G ? G.cls : {}, k);
  }
  function envCat(e) {
    var s = String(e || '').toLowerCase(); if (!s) return 'none';
    if (/reef|bioherm|buildup/.test(s)) return 'reef';
    if (/lacustrine|pond|crater lake/.test(s)) return 'lake';
    if (/dune|eolian|loess/.test(s)) return 'eolian';
    if (/cave|fissure|sinkhole|karst|tar|spring/.test(s)) return 'karst';
    if (/lagoonal\/restricted|peritidal|shallow|shoal|carbonate indet/.test(s)) return 'shallow';
    if (/deep|offshore|slope|basin|submarine fan|transition zone/.test(s)) return 'deep';
    if (/delta|estuar|bay|lagoon|paralic|coastal|marginal|foreshore|shoreface/.test(s)) return 'marginal';
    if (/fluvial|alluvial|channel|floodplain|crevasse|levee|mire|swamp/.test(s)) return 'fluvial';
    if (/marine/.test(s)) return 'marine';
    if (/terrestrial/.test(s)) return 'land';
    return 'none';
  }
  var ecat = function (k) { return G.envcat.filter(function (c) { return c[0] === k; })[0]; };
  var lith = function (c) { return [unq(c.lithology1), unq(c.lithology2)].filter(function (x) { return x && x !== 'not reported'; }).map(function (x) { return tr(G.lith, x); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(AR ? ' و' : ' and '); };

  function show(v) { document.querySelectorAll('[data-v]').forEach(function (el) { el.hidden = el.getAttribute('data-v') !== v; }); var side = document.querySelector('.wsm-side'); if (side) side.scrollTop = 0; }
  function backBtn(label, id) { return '<button type="button" class="fx-back" id="' + id + '">' + ARR + ' ' + label + '</button>'; }

  /* ------------------------------------------------------------------ init */
  SH.getJSON(SH.base + 'assets/data/fossil-guide.json').then(function (j) {
    G = j;
    $('#fInt').innerHTML = G.intervals.map(function (i) { return '<option value="' + E(i[0]) + '">' + E(AR ? i[2] : i[1]) + '</option>'; }).join('');
    $('#fChips').innerHTML = G.groups.map(function (g) { return '<button type="button" class="fx-chip" aria-pressed="false" data-g="' + g.k + '"><i style="background:' + g.c + '"></i>' + E(AR ? g.ar : g.en) + '</button>'; }).join('');
    var persist = SH.persist('fossils2', ['fTax', 'fInt']); $('#fTax').addEventListener('change', persist.save); $('#fInt').addEventListener('change', persist.save);
    syncChip();
  }).catch(function (e) { SH.toast(e.message, 'bad'); });

  function syncChip() {
    var v = SH.val('fTax').trim(), g = G.groups.filter(function (x) { return x.k.toLowerCase() === v.toLowerCase(); })[0];
    document.querySelectorAll('.fx-chip').forEach(function (b) { b.setAttribute('aria-pressed', g && b.getAttribute('data-g') === g.k ? 'true' : 'false'); });
    $('#fGroup').innerHTML = g ? groupCard(g, true) : '';
  }
  function groupCard(g, more) {
    var ra = g.r[0] > 0 ? ma(g.r[0]) + (g.r[1] > 0 ? '–' + ma(g.r[1]) : t(' Ma – today', ' م.س – اليوم')) + (g.r[1] > 0 ? t(' Ma', ' م.س') : '') : '';
    return '<div class="fx-card"><div style="display:flex;gap:8px;align-items:center"><i style="width:12px;height:12px;border-radius:50%;background:' + g.c + '"></i><h4>' + E(AR ? g.ar : g.en) + ' <span class="xsmall muted" style="font-weight:600">· <i>' + g.k + '</i></span></h4></div>' +
      '<p>' + E(AR ? g.d_ar : g.d_en) + '</p>' +
      '<span class="lb">' + t('Time range', 'المدى الزمني') + '</span><p class="ltr" style="text-align:start">' + ra + '</p>' +
      '<span class="lb">' + t('Where they lived', 'أين عاشت') + '</span><p>' + E(AR ? g.env_ar : g.env_en) + '</p>' +
      '<span class="lb">' + t('Why geologists use them', 'لماذا يستخدمها الجيولوجيون') + '</span><p>' + E(AR ? g.use_ar : g.use_en) + '</p>' +
      ((AR ? g.iq_ar : g.iq_en) ? '<span class="lb">' + t('In Iraq', 'في العراق') + '</span><p class="fx-iq">' + E(AR ? g.iq_ar : g.iq_en) + '</p>' : '') +
      (more ? '<button type="button" class="btn btn-line btn-xs" data-tx="' + g.k + '">' + t('Images, references and worldwide record', 'الصور والمراجع والانتشار العالمي') + ' ' + ARR + '</button>' : '') + '</div>';
  }

  $('#fChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return; var on = b.getAttribute('aria-pressed') !== 'true';
    $('#fTax').value = on ? b.getAttribute('data-g') : ''; $('#fTax').dispatchEvent(new Event('change')); syncChip();
  });
  $('#fTax').addEventListener('input', function () { if (G) syncChip(); });
  $('#fGloss').addEventListener('click', function () {
    SH.modal(t('Glossary', 'المصطلحات'), '<div style="display:grid;gap:12px">' + G.glossary.map(function (g) { return '<div><b>' + E(AR ? g[1] : g[0]) + '</b><div class="small" style="line-height:1.7">' + E(AR ? g[3] : g[2]) + '</div></div>'; }).join('') + '</div>');
  });

  /* ------------------------------------------------------------------ search */
  function search(b) {
    if (!G) return;
    var w = Math.max(-180, b.getWest()), e = Math.min(180, b.getEast()), s = Math.max(-90, b.getSouth()), n = Math.min(90, b.getNorth());
    if (e - w > 60 || n - s > 45) { SH.toast(t('Area too large. Zoom in or draw a smaller rectangle.', 'المساحة كبيرة جداً. كبّر الخريطة أو ارسم مستطيلاً أصغر.'), 'warn'); return; }
    if (box) map.removeLayer(box); box = L.rectangle([[s, w], [n, e]], { color: SH.css('--accent'), weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map);
    clearWorld();
    var bb = '&lngmin=' + w.toFixed(3) + '&lngmax=' + e.toFixed(3) + '&latmin=' + s.toFixed(3) + '&latmax=' + n.toFixed(3), f = '';
    if (SH.val('fTax').trim()) f += '&base_name=' + encodeURIComponent(SH.val('fTax').trim());
    if (SH.val('fInt')) f += '&interval=' + encodeURIComponent(SH.val('fInt'));
    SH.busy($('#fMap').parentElement, true, t('Querying the Paleobiology Database…', 'جارٍ الاستعلام من قاعدة PBDB…'));
    Promise.all([
      SH.getJSON(PB + 'colls/list.json?vocab=pbdb&show=loc,strat,lith,env,paleoloc,ref,time&limit=3000' + bb + f, { timeout: 45000 }),
      SH.getJSON(PB + 'occs/list.json?vocab=pbdb&show=class,coords,img&limit=6000' + bb + f, { timeout: 45000 })
    ]).then(function (r) {
      if (r[0].errors) throw new Error(r[0].errors.join('; ')); if (r[1].errors) throw new Error(r[1].errors.join('; '));
      SITES = {}; (r[0].records || []).forEach(function (c) { c.max_ma = +c.max_ma; c.min_ma = +c.min_ma; c.lat = +c.lat; c.lng = +c.lng; c.taxa = []; SITES[c.collection_no] = c; });
      O = (r[1].records || []).map(function (x) { return { id: x.occurrence_no, cid: x.collection_no, name: x.accepted_name || x.identified_name, ident: x.identified_name, rank: x.accepted_rank || x.identified_rank, phylum: clean(x.phylum), cls: clean(x['class']), order: clean(x.order), family: clean(x.family), img: x.image_no, early: x.early_interval, late: x.late_interval || x.early_interval, max_ma: +x.max_ma, min_ma: +x.min_ma, lat: +x.lat, lon: +x.lng }; });
      O.forEach(function (o) { var c = SITES[o.cid]; if (c) c.taxa.push(o); });
      S = Object.keys(SITES).map(function (k) { return SITES[k]; });
      draw(); stats(); list(); show('search');
      $('#fInfo').innerHTML = '<b>' + S.length + '</b> ' + t('sites', 'موقعاً') + ' · <b>' + O.length + '</b> ' + t('fossil records', 'سجلاً أحفورياً') + (O.length >= 6000 ? ' · ' + t('limit reached; narrow the search', 'بلغ الحد؛ ضيّق البحث') : '') + ' · Paleobiology Database (CC BY 4.0)';
      if (!S.length) SH.toast(t('No fossil sites match this search here. Try a wider area or remove a filter.', 'لا توجد مواقع أحفورية مطابقة هنا. وسّع المنطقة أو أزل أحد الفلاتر.'), 'warn');
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { SH.busy($('#fMap').parentElement, false); });
  }

  function draw() {
    if (lay) map.removeLayer(lay); lay = L.layerGroup().addTo(map);
    var g = {}; S.forEach(function (c) { var k = c.lat.toFixed(3) + ',' + c.lng.toFixed(3); (g[k] = g[k] || []).push(c); });
    var used = {};
    Object.keys(g).forEach(function (k) {
      var a = g[k], c = a[0], p = per(c.max_ma, c.min_ma), nt = a.reduce(function (s, x) { return s + (x.taxa.length || +x.n_occs || 0); }, 0); used[p[0]] = p;
      L.circleMarker([c.lat, c.lng], { radius: Math.min(15, 5 + Math.sqrt(nt) * 1.3), color: '#1b1b1b', weight: 1, fillColor: p[4], fillOpacity: .92 })
        .bindTooltip('<b>' + E(c.collection_name) + '</b><br>' + pname(p) + ' · ' + nt + t(' records', ' سجل') + (a.length > 1 ? ' · ' + a.length + t(' beds', ' طبقة') : ''), { direction: 'top' })
        .on('click', function () { site(a, 'search'); }).addTo(lay);
    });
    var ps = SH.ics.filter(function (p) { return used[p[0]]; });
    $('#fLeg').hidden = !ps.length; $('#fLeg').innerHTML = '<b style="font-size:.76rem">' + t('Age of the site', 'عمر الموقع') + '</b>' + ps.map(function (p) { return '<span><i style="background:' + p[4] + '"></i>' + pname(p) + ' <span class="muted ltr">' + ma(p[2]) + '–' + ma(p[3]) + '</span></span>'; }).join('') + '<span class="muted">' + t('Circle size = number of records', 'حجم الدائرة = عدد السجلات') + '</span>';
  }

  function stats() {
    $('#fStats').hidden = !O.length; if (!O.length) return;
    var taxa = {}, P = {}, C = {}, EC = {}, marine = 0, land = 0;
    O.forEach(function (o) { taxa[o.name] = 1; var p = per(o.max_ma, o.min_ma)[0]; P[p] = (P[p] || 0) + 1; var g = grp(o); C[g] = (C[g] || 0) + 1; });
    S.forEach(function (c) { var k = envCat(c.environment); EC[k] = (EC[k] || 0) + 1; if (/reef|shallow|deep|marine|marginal/.test(k)) marine++; else if (k !== 'none') land++; });
    var oldest = Math.max.apply(null, O.map(function (o) { return o.max_ma; })), young = Math.min.apply(null, O.map(function (o) { return o.min_ma; }));
    var kpi = function (k, v, s, cls) { return '<div class="kpi ' + (cls || '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; };
    $('#fKpis').innerHTML = kpi(t('Sites', 'المواقع'), S.length, t('places with published fossils', 'أماكن فيها أحافير منشورة'), 'info') + kpi(t('Fossil records', 'السجلات'), SH.fmt(O.length, 0), t('one per fossil per site', 'سجل لكل أحفورة في كل موقع')) +
      kpi(t('Different fossils', 'أحافير مختلفة'), Object.keys(taxa).length, t('distinct genera and species', 'أجناس وأنواع مختلفة')) + kpi(t('Age span', 'المدى العمري'), '<span class="ltr">' + SH.fmt(oldest, 0) + '–' + SH.fmt(young, 0) + '</span>', t('million years ago', 'مليون سنة مضت'));
    var pk = Object.keys(P).sort(function (a, b) { return P[b] - P[a]; }), ck = Object.keys(C).sort(function (a, b) { return C[b] - C[a]; });
    var pP = SH.ics.filter(function (p) { return p[0] === pk[0]; })[0], ek = Object.keys(EC).filter(function (k) { return k !== 'none'; }).sort(function (a, b) { return EC[b] - EC[a]; });
    var s = t('This area holds ', 'تضم هذه المنطقة ') + '<b>' + S.length + '</b>' + t(' published fossil sites with ', ' موقعاً أحفورياً منشوراً فيها ') + '<b>' + O.length + '</b>' + t(' records of ', ' سجلاً لـ ') + '<b>' + Object.keys(taxa).length + '</b>' + t(' different fossils, from about ', ' أحفورة مختلفة، يتراوح عمرها بين نحو ') + SH.fmt(oldest, 0) + t(' to ', ' و') + SH.fmt(young, 0) + t(' million years ago. ', ' مليون سنة. ') +
      t('Most records come from the ', 'تأتي معظم السجلات من عصر ') + '<b>' + (pP ? pname(pP) : pk[0]) + '</b> (' + pct(P[pk[0]], O.length) + '%)' + t('. The dominant group is ', '. والمجموعة الغالبة هي ') + '<b>' + E(gname(ck[0])) + '</b> (' + pct(C[ck[0]], O.length) + '%)' + (ck[1] ? t(', followed by ', '، تليها ') + '<b>' + E(gname(ck[1])) + '</b>' : '') + '. ';
    if (marine + land) s += marine >= land ? t('Most sites with a recorded environment were under the sea', 'كانت معظم المواقع ذات البيئة المسجلة تحت سطح البحر') + (ek[0] ? ' (' + t('mainly ', 'غالباً ') + (AR ? ecat(ek[0])[2] : ecat(ek[0])[1].toLowerCase()) + ')' : '') + t(', so the area was covered by an ancient sea when these rocks formed.', '، أي أن المنطقة كانت مغمورة ببحر قديم عندما تكونت هذه الصخور.') : t('Most sites with a recorded environment were on land (rivers, lakes or deserts).', 'كانت معظم المواقع ذات البيئة المسجلة على اليابسة (أنهار أو بحيرات أو صحارى).');
    $('#fSum').innerHTML = s;
    var ord = SH.ics.filter(function (p) { return P[p[0]]; });
    SH.plot('fPer', [{ type: 'bar', x: ord.map(pname), y: ord.map(function (p) { return P[p[0]]; }), marker: { color: ord.map(function (p) { return p[4]; }), line: { color: '#333', width: .6 } }, hovertemplate: '%{x}: %{y}<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 44, r: 8, t: 6, b: 64 }, showlegend: false, xaxis: { tickangle: -35, autorange: 'reversed', title: { text: t('older ←   period   → younger', 'الأقدم ←   العصر   → الأحدث'), font: { size: 10 } } }, yaxis: { title: { text: t('records', 'السجلات'), font: { size: 10 } } } }); });
    var top = ck.slice(0, 10).reverse();
    SH.plot('fCls', [{ type: 'bar', orientation: 'h', y: top.map(gname), x: top.map(function (k) { return C[k]; }), marker: { color: top.map(function (k) { var g = G.groups.filter(function (x) { return x.k === k; })[0]; return g ? g.c : SH.palette().accent; }) }, hovertemplate: '%{y}: %{x}<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 130, r: 8, t: 6, b: 34 }, showlegend: false, xaxis: { title: { text: t('records', 'السجلات'), font: { size: 10 } } } }); });
    var ek2 = G.envcat.filter(function (c) { return EC[c[0]]; }).reverse();
    SH.plot('fEnv', [{ type: 'bar', orientation: 'h', y: ek2.map(function (c) { return AR ? c[2] : c[1]; }), x: ek2.map(function (c) { return EC[c[0]]; }), marker: { color: ek2.map(function (c) { return c[3]; }) }, customdata: ek2.map(function (c) { return AR ? c[5] : c[4]; }), hovertemplate: '%{y}: %{x}<br>%{customdata}<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 120, r: 8, t: 6, b: 34 }, showlegend: false, xaxis: { title: { text: t('sites', 'المواقع'), font: { size: 10 } } } }); });
  }

  function siteGroups(c) { var g = {}; c.taxa.forEach(function (o) { var k = grp(o); g[k] = (g[k] || 0) + 1; }); return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }); }
  function list() {
    $('#fListH').hidden = !S.length;
    $('#fList').innerHTML = S.slice().sort(function (a, b) { return b.taxa.length - a.taxa.length; }).slice(0, 200).map(function (c) {
      var p = per(c.max_ma, c.min_ma), gs = siteGroups(c).slice(0, 3);
      return '<button type="button" class="fx-site" data-c="' + c.collection_no + '"><span class="bar" style="background:' + p[4] + '"></span><span style="min-width:0"><b>' + E(c.collection_name) + '</b><span class="xsmall muted" style="display:block">' + E([c.formation ? (AR ? t('', 'تكوين ') + c.formation : c.formation + ' Fm.') : '', pname(p), ma(c.max_ma) + '–' + ma(c.min_ma) + t(' Ma', ' م.س')].filter(Boolean).join(' · ')) + '</span>' +
        (gs.length ? '<span class="fx-tags">' + gs.map(function (k) { return '<span>' + E(gname(k)) + '</span>'; }).join('') + '</span>' : '') + '</span><span class="n">' + (c.taxa.length || c.n_occs) + '<small>' + t('fossils', 'أحفورة') + '</small></span></button>';
    }).join('');
  }
  $('#fList').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (!b) return; var c = SITES[b.getAttribute('data-c')]; map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 9), { duration: .7 }); site([c], 'search'); });

  /* ------------------------------------------------------------------ site card */
  function site(arr, from) {
    cur.site = arr; cur.from = from || 'search'; var c0 = arr[0];
    var h = backBtn(t('All sites', 'كل المواقع'), 'fBackS');
    h += arr.map(function (c, i) {
      var p = per(c.max_ma, c.min_ma), env = c.environment || '', ec = ecat(envCat(env)), li = lith(c), gs = siteGroups(c), place = [c.county, c.state, country(c.cc)].filter(Boolean).join(AR ? '، ' : ', ');
      var fm = c.formation ? (AR ? 'تكوين ' + c.formation : 'the ' + c.formation + ' Formation') : '';
      var txt = (AR ? 'يقع هذا الموقع' : 'This site lies') + (place ? (AR ? ' في ' : ' in ') + E(place) : '') + (c.geogcomments ? ' (' + E(c.geogcomments) + ')' : '') + '. ' +
        (li || fm ? (AR ? 'يكشف ' : 'It exposes ') + E(li || t('rocks', 'صخور')) + (fm ? (AR ? ' من ' : ' of ') + E(fm) : '') + '. ' : '') +
        (AR ? 'يعود عمره إلى ' : 'Its age is ') + E(c.early_interval + (c.late_interval && c.late_interval !== c.early_interval ? ' – ' + c.late_interval : '')) + ' (' + ma(c.max_ma) + '–' + ma(c.min_ma) + t(' million years ago, ', ' مليون سنة، عصر ') + pname(p) + '). ' +
        (env ? (AR ? 'ترسبت صخوره في بيئة ' : 'Its sediments were laid down in a ') + '<b>' + E(tr(G.env, env)) + '</b>' + (AR ? '' : ' setting') + (ec && ec[0] !== 'none' ? ' — ' + E(AR ? ec[5] : ec[4].charAt(0).toLowerCase() + ec[4].slice(1)) : '. ') : t('The publication did not record the depositional environment. ', 'لم يسجّل المصدر البيئة الترسيبية. ')) +
        (c.taxa.length ? (AR ? 'سُجلت هنا ' : 'Recorded here: ') + '<b>' + c.taxa.length + '</b>' + t(' fossils, mainly ', ' أحفورة، أغلبها من ') + gs.slice(0, 2).map(gname).map(E).join(AR ? ' و' : ' and ') + '. ' : '') +
        (c.paleolat != null && c.paleolat !== '' ? (AR ? 'عندما كانت هذه الكائنات حية، كان الموقع عند خط عرض ' : 'When these organisms were alive, the site lay at about ') + '<b class="ltr">' + Math.abs(+c.paleolat).toFixed(0) + '°' + (+c.paleolat >= 0 ? t('N', 'شمالاً') : t('S', 'جنوباً')) + '</b>' + (AR ? ' تقريباً، بينما يقع اليوم عند ' : ', compared with ') + '<span class="ltr">' + Math.abs(c.lat).toFixed(0) + '°' + (c.lat >= 0 ? t('N', 'شمالاً') : t('S', 'جنوباً')) + '</span>' + t(' today', '') + (Math.abs(+c.paleolat) < 30 && Math.abs(c.lat) >= 30 ? t(' — it was then in the tropics.', ' — أي كان آنذاك في المنطقة المدارية.') : '.') : '');
      var row = function (k, v) { return v ? '<tr><th style="width:36%">' + k + '</th><td>' + v + '</td></tr>' : ''; };
      var bygrp = {}; c.taxa.forEach(function (o) { var k = grp(o); (bygrp[k] = bygrp[k] || []).push(o); });
      var taxaH = gs.map(function (k) {
        var seen = {}, rows = bygrp[k].filter(function (o) { if (seen[o.name]) return false; seen[o.name] = 1; return true; });
        return '<div style="margin-top:8px"><div class="xsmall" style="font-weight:800;color:var(--accent);padding:0 10px">' + E(gname(k)) + ' · ' + rows.length + '</div>' + rows.map(function (o) {
          return '<button type="button" class="fx-tx" data-tx="' + E(o.name) + '">' + (o.img ? '<img loading="lazy" alt="" src="' + thumb(o.img) + '">' : '<span class="ph"></span>') + '<span style="min-width:0"><i style="font-weight:700;font-size:.88rem">' + E(o.name) + '</i><span class="xsmall muted" style="display:block">' + E([tr(G.rank, o.rank), o.family, o.ident !== o.name ? t('identified as ', 'عُرّف كـ ') + o.ident : ''].filter(Boolean).join(' · ')) + '</span></span><span class="muted">' + ARR + '</span></button>';
        }).join('') + '</div>';
      }).join('');
      var gu = SH.base + (AR ? 'ar/' : '') + 'tools/geologic-unit/app/?lat=' + c.lat.toFixed(5) + '&lon=' + c.lng.toFixed(5);
      return (i ? '<hr style="border:0;border-top:2px solid var(--line);margin:18px 0">' : '') +
        '<div style="display:flex;gap:10px;align-items:start;margin-top:10px"><span style="flex:0 0 8px;align-self:stretch;border-radius:4px;background:' + p[4] + '"></span><div><h2 style="margin:0;font-size:1.15rem;line-height:1.35">' + E(c.collection_name) + '</h2><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><span class="badge warn">' + pname(p) + '</span><span class="badge mute ltr">' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma</span>' + (ec && ec[0] !== 'none' ? '<span class="badge info">' + E(AR ? ec[2] : ec[1]) + '</span>' : '') + '</div></div></div>' +
        '<p class="fx-sum" style="margin-top:12px">' + txt + '</p>' +
        '<table class="kv" style="font-size:.84rem;margin-top:10px">' + row(t('Country / region', 'الدولة / المنطقة'), E(place)) + row(t('Locality notes', 'وصف المكان'), E(c.geogcomments)) + row(t('Coordinates', 'الإحداثيات'), '<span class="ltr">' + SH.fmtLatLon(c.lat, c.lng, 4) + '</span>') +
        row(t('Formation', 'التكوين'), E(c.formation)) + row(t('Group', 'المجموعة'), E(c.geological_group)) + row(t('Member', 'العضو'), E(c.member)) + row(t('Rock type', 'نوع الصخر'), E(li)) +
        row(t('Environment', 'البيئة الترسيبية'), env ? E(tr(G.env, env)) + (AR ? ' <span class="xsmall muted ltr">(' + E(env) + ')</span>' : '') : '') +
        row(t('Geological age', 'العمر الجيولوجي'), E(c.early_interval + (c.late_interval && c.late_interval !== c.early_interval ? ' – ' + c.late_interval : '')) + ' · <span class="ltr">' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma</span>') +
        row(t('Palaeolatitude', 'خط العرض القديم'), c.paleolat != null && c.paleolat !== '' ? '<span class="ltr">' + (+c.paleolat).toFixed(1) + '°, ' + (+c.paleolng).toFixed(1) + '°</span> <span class="xsmall muted">(' + t('plate model ', 'نموذج ') + E(c.paleomodel || 'GPlates') + ')</span>' : '') +
        row(t('Sampling scale', 'نطاق الجمع'), E(SCALE[c.geogscale] || c.geogscale)) + row(t('Published in', 'المصدر المنشور'), '<span class="small">' + E(c.primary_reference) + '</span>') + '</table>' +
        '<h3 class="fx-h" style="margin-top:16px">' + t('Fossils found here', 'الأحافير الموجودة هنا') + ' (' + c.taxa.length + ')</h3><p class="fx-cap" style="margin:4px 0 0">' + t('Tap a fossil for its description, images, age range and references. Silhouettes are from PhyloPic.', 'انقر أي أحفورة لترى وصفها وصورها ومداها الزمني ومراجعها. الصور الظلية من PhyloPic.') + '</p>' + (taxaH || '<p class="small muted">' + t('No individual fossils matched the current filters.', 'لا توجد أحافير مفردة تطابق الفلاتر الحالية.') + '</p>') +
        '<h3 class="fx-h" style="margin-top:16px">' + t('Learn more', 'للاستزادة') + '</h3><div class="fx-links" style="margin-top:8px">' +
        '<a target="_blank" rel="noopener" href="https://paleobiodb.org/classic/basicCollectionSearch?collection_no=' + c.collection_no + '">PBDB · ' + t('collection record', 'سجل المجموعة') + ' ' + EXT + '</a>' +
        '<a href="' + gu + '">' + t('Geological map unit here', 'الوحدة الجيولوجية هنا') + ' ' + ARR + '</a>' +
        (c.formation ? '<a target="_blank" rel="noopener" href="https://scholar.google.com/scholar?q=' + encodeURIComponent('"' + c.formation + '" formation fossils') + '">' + t('Research on the formation', 'أبحاث عن التكوين') + ' ' + EXT + '</a>' : '') +
        '<a target="_blank" rel="noopener" href="https://scholar.google.com/scholar?q=' + encodeURIComponent(c.primary_reference ? c.primary_reference.slice(0, 160) : c.collection_name) + '">' + t('Original publication', 'المنشور الأصلي') + ' ' + EXT + '</a></div>';
    }).join('');
    $('#fSite').innerHTML = h; show('site');
    $('#fBackS').addEventListener('click', function () { show('search'); });
  }

  /* ------------------------------------------------------------------ taxon card */
  var getJ = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  function wiki(name) {
    return getJ('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name.replace(/ /g, '_')) + '?redirect=true').then(function (en) {
      if (!en || en.type === 'disambiguation' || !en.extract) return null;
      var out = { en: en, ar: null };
      if (!AR) return out;
      return getJ('https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ar&format=json&origin=*&titles=' + encodeURIComponent(en.title)).then(function (j) {
        var pg = j.query && j.query.pages, k = pg && Object.keys(pg)[0], ll = k && pg[k].langlinks && pg[k].langlinks[0]; if (!ll) return out;
        return getJ('https://ar.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(ll['*'].replace(/ /g, '_'))).then(function (a) { if (a && a.extract) out.ar = a; return out; });
      }).catch(function () { return out; });
    }).catch(function () { return null; });
  }
  function commons(name) {
    return getJ('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=320&format=json&origin=*&gsrsearch=' + encodeURIComponent(name + ' fossil')).then(function (j) {
      var p = j.query ? j.query.pages : {}; return Object.keys(p).map(function (k) { return p[k]; }).sort(function (a, b) { return a.index - b.index; }).map(function (x) { var ii = x.imageinfo && x.imageinfo[0]; if (!ii || !/jpeg|png/.test(ii.mime)) return null; var md = ii.extmetadata || {}, strip = function (s) { return String(s && s.value || '').replace(/<[^>]+>/g, '').trim(); };
        return { th: ii.thumburl, page: ii.descriptionurl, title: x.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), by: strip(md.Artist), lic: strip(md.LicenseShortName) }; }).filter(Boolean).slice(0, 9);
    }).catch(function () { return []; });
  }
  function rangeSvg(first, last, extant) {
    var lim = first > 400 ? 538.8 : first > 250 ? 419.2 : first > 145 ? 251.9 : first > 66 ? 145 : first > 23 ? 66 : 23.03, W = 320, H = 54, X = function (v) { return 4 + (1 - v / lim) * (W - 8); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + (H + 18) + '" style="width:100%;height:auto;direction:ltr" role="img">';
    SH.ics.forEach(function (p) { if (p[2] >= lim) return; var x1 = X(Math.min(p[3], lim)), x2 = X(p[2]); s += '<rect x="' + x1 + '" y="0" width="' + (x2 - x1) + '" height="22" fill="' + p[4] + '" stroke="#555" stroke-width=".4"/>' + (x2 - x1 > 34 ? '<text x="' + (x1 + x2) / 2 + '" y="15" font-size="8.5" text-anchor="middle" fill="#111">' + E(pname(p)) + '</text>' : ''); });
    var a = X(Math.min(first, lim)), b = X(Math.max(0, last));
    s += '<rect x="' + a + '" y="28" width="' + Math.max(3, b - a) + '" height="10" rx="5" fill="var(--text,#222)"/>' + (extant ? '<path d="M' + (b - 1) + ' 28 l7 5 -7 5z" fill="var(--text,#222)"/>' : '') +
      '<text x="4" y="' + (H + 6) + '" font-size="9" fill="currentColor">' + SH.fmt(lim, 0) + ' Ma</text><text x="' + (W - 4) + '" y="' + (H + 6) + '" font-size="9" text-anchor="end" fill="currentColor">' + t('today', 'اليوم') + '</text></svg>';
    return s;
  }
  function clearWorld() { if (world) { map.removeLayer(world); world = null; } }

  function taxon(name, from) {
    if (!name) return; clearWorld();
    var back = from === 'site' ? backBtn(t('Back to the site', 'العودة إلى الموقع'), 'fBackT') : backBtn(t('Back to search', 'العودة إلى البحث'), 'fBackT');
    $('#fTaxon').innerHTML = back + '<div class="xsmall muted" style="padding:20px 0">' + t('Loading from PBDB, Wikipedia and Wikimedia Commons…', 'جارٍ التحميل من PBDB وويكيبيديا وويكيميديا كومنز…') + '</div>'; show('taxon');
    var bk = function () { $('#fBackT').addEventListener('click', function () { clearWorld(); if (from === 'site' && cur.site) show('site'); else show('search'); }); }; bk();
    Promise.all([
      SH.getJSON(PB + 'taxa/single.json?vocab=pbdb&show=attr,app,class,ecospace,taphonomy,img,common,parent,size&name=' + encodeURIComponent(name), { timeout: 30000 }).then(function (j) { return (j.records || [])[0] || null; }).catch(function () { return null; }),
      wiki(name), commons(name)
    ]).then(function (r) {
      var x = r[0] || { taxon_name: name }, w = r[1], imgs = r[2], g = G.groups.filter(function (q) { return q.k === name; })[0];
      var nm = x.accepted_name || x.taxon_name || name, first = +x.firstapp_max_ma, last = +x.lastapp_min_ma, ext = x.is_extant === 'extant';
      var pic = (w && (w.ar || w.en).thumbnail && (w.ar || w.en).thumbnail.source) || (imgs[0] && imgs[0].th) || (x.image_no ? thumb(x.image_no) : '');
      var wtxt = w ? (w.ar || w.en) : null;
      var h = back + '<div class="fx-hero" style="margin-top:10px">' + (pic ? '<div class="pic" style="background-image:url(\'' + E(pic) + '\')" role="img" aria-label="' + E(nm) + '"></div>' : '') +
        '<div><h2 style="margin:0;font-size:1.3rem"><i>' + E(nm) + '</i> <span class="small muted" style="font-weight:500">' + E(x.taxon_attr || '') + '</span></h2><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' + (x.taxon_rank ? '<span class="badge mute">' + E(tr(G.rank, x.taxon_rank)) + '</span>' : '') +
        (x.is_extant ? '<span class="badge ' + (ext ? 'ok' : 'bad') + '">' + (ext ? t('still living', 'ما زال حياً') : t('extinct', 'منقرض')) + '</span>' : '') + (x.common_name ? '<span class="badge info">' + E(x.common_name) + '</span>' : '') + (g ? '<span class="badge warn">' + E(AR ? g.ar : g.en) + '</span>' : '') + '</div></div></div>';
      if (g) h += '<div style="margin-top:12px">' + groupCard(g, false) + '</div>';
      h += '<h3 class="fx-h" style="margin-top:16px">' + t('Description', 'الوصف') + '</h3>' + (wtxt ? '<p class="fx-sum" ' + (w.ar ? '' : 'dir="ltr" lang="en" style="text-align:left"') + '>' + E(wtxt.extract) + '</p><p class="fx-cap" style="margin-top:4px">' + (AR && !w.ar ? 'لا توجد مقالة عربية بعد؛ النص من ويكيبيديا الإنجليزية. ' : '') + t('Source: Wikipedia (CC BY-SA 4.0).', 'المصدر: ويكيبيديا (CC BY-SA 4.0).') + '</p>' : '<p class="small muted">' + t('No encyclopaedia entry was found for this name. Use the library links below.', 'لم يُعثر على مقالة موسوعية لهذا الاسم. استخدم روابط المكتبة أدناه.') + '</p>');
      var lad = [['phylum', x.phylum], ['class', x['class']], ['order', x.order], ['family', x.family], ['genus', x.genus]].filter(function (q) { return clean(q[1]); });
      if (lad.length) h += '<h3 class="fx-h" style="margin-top:16px">' + t('Classification', 'التصنيف') + '</h3><div class="fx-ladder" style="margin-top:8px">' + lad.map(function (q) { return '<span><em>' + E(tr(G.rank, q[0])) + ':</em> ' + E(q[1]) + (AR && G.cls[q[1]] ? ' <em>(' + E(G.cls[q[1]]) + ')</em>' : '') + '</span>'; }).join('<em>›</em>') + '</div>';
      if (isFinite(first)) h += '<h3 class="fx-h" style="margin-top:16px">' + t('When it lived', 'متى عاش') + '</h3><p class="small" style="margin:6px 0">' + t('First known: ', 'أول ظهور معروف: ') + '<b>' + E(x.early_interval || '') + '</b> <span class="ltr">(' + ma(first) + ' Ma)</span> · ' + (ext ? t('still living today', 'ما زال حياً حتى اليوم') : t('Last known: ', 'آخر ظهور معروف: ') + '<b>' + E(x.late_interval || '') + '</b> <span class="ltr">(' + ma(last) + ' Ma)</span>') + '</p>' + rangeSvg(first, ext ? 0 : last, ext) + '<p class="fx-cap">' + t('Range of the fossil record in PBDB; the true range may be slightly longer.', 'مدى السجل الأحفوري في PBDB؛ وقد يكون المدى الحقيقي أطول قليلاً.') + '</p>';
      var eco = [[t('Life habit', 'نمط المعيشة'), x.life_habit], [t('Feeding', 'التغذية'), x.diet], [t('Movement', 'الحركة'), x.motility], [t('Habitat', 'الموطن'), x.taxon_environment], [t('Skeleton', 'تركيب الهيكل'), x.composition || x.composition1]].filter(function (q) { return q[1]; });
      if (eco.length) h += '<h3 class="fx-h" style="margin-top:16px">' + t('How it lived', 'كيف عاش') + '</h3><table class="kv" style="font-size:.84rem;margin-top:8px">' + eco.map(function (q) { return '<tr><th style="width:36%">' + q[0] + '</th><td>' + E(trTokens(G.eco, q[1])) + '</td></tr>'; }).join('') + '</table><p class="fx-cap" style="margin-top:6px">' + t('Ecology as compiled by PBDB, sometimes inferred from close relatives.', 'البيئة كما جمعتها PBDB، وقد تُستنتج أحياناً من الأقارب.') + '</p>';
      if (imgs.length) h += '<h3 class="fx-h" style="margin-top:16px">' + t('Images', 'صور') + '</h3><div class="fx-gal" style="margin-top:8px">' + imgs.map(function (m) { return '<a target="_blank" rel="noopener" href="' + E(m.page) + '" title="' + E(m.title + (m.by ? ' — ' + m.by : '') + (m.lic ? ' (' + m.lic + ')' : '')) + '" style="background-image:url(\'' + E(m.th) + '\')"></a>'; }).join('') + '</div><p class="fx-cap" style="margin-top:6px">' + t('From Wikimedia Commons search; each image has its own free licence and author (tap to see them). Search results may include related specimens.', 'من بحث ويكيميديا كومنز؛ لكل صورة ترخيصها الحر ومؤلفها (انقر لرؤيتهما). قد تتضمن النتائج عينات قريبة.') + '</p>';
      h += '<h3 class="fx-h" style="margin-top:16px">' + t('Worldwide record', 'الانتشار العالمي') + '</h3><p class="small" style="margin:6px 0">' + (x.n_occs ? t('PBDB holds ', 'تضم PBDB ') + '<b>' + SH.fmt(+x.n_occs, 0) + '</b>' + t(' published records of this taxon.', ' سجلاً منشوراً لهذه الأصنوفة.') : '') + '</p><button type="button" class="btn btn-ink btn-sm" id="fWorld">' + t('Show worldwide on the map', 'اعرضها عالمياً على الخريطة') + '</button><div class="plot" id="fWPer" style="height:200px" hidden></div><p class="fx-cap" id="fWCap" hidden></p>';
      var en = w && w.en, ar = w && w.ar;
      h += '<h3 class="fx-h" style="margin-top:16px">' + t('Reference library', 'المكتبة المرجعية') + '</h3><div class="fx-links" style="margin-top:8px">' +
        (x.taxon_no ? '<a target="_blank" rel="noopener" href="https://paleobiodb.org/classic/basicTaxonInfo?taxon_no=' + x.taxon_no + '">PBDB ' + EXT + '</a>' : '') +
        (ar ? '<a target="_blank" rel="noopener" href="' + E(ar.content_urls.desktop.page) + '">ويكيبيديا العربية ' + EXT + '</a>' : '') + (en ? '<a target="_blank" rel="noopener" href="' + E(en.content_urls.desktop.page) + '">Wikipedia (EN) ' + EXT + '</a>' : '') +
        '<a target="_blank" rel="noopener" href="https://scholar.google.com/scholar?q=' + encodeURIComponent('"' + nm + '" fossil') + '">Google Scholar ' + EXT + '</a>' +
        '<a target="_blank" rel="noopener" href="https://www.biodiversitylibrary.org/search?searchTerm=' + encodeURIComponent(nm) + '">' + t('Biodiversity Heritage Library', 'مكتبة تراث التنوع الحيوي') + ' ' + EXT + '</a>' +
        '<a target="_blank" rel="noopener" href="https://www.gbif.org/species/search?q=' + encodeURIComponent(nm) + '">GBIF ' + EXT + '</a>' +
        '<a target="_blank" rel="noopener" href="https://commons.wikimedia.org/w/index.php?search=' + encodeURIComponent(nm + ' fossil') + '">' + t('More images', 'صور أخرى') + ' ' + EXT + '</a>' +
        '<a target="_blank" rel="noopener" href="https://www.marinespecies.org/aphia.php?p=taxlist&tName=' + encodeURIComponent(nm) + '">WoRMS ' + EXT + '</a></div>';
      $('#fTaxon').innerHTML = h; bk();
      $('#fWorld').addEventListener('click', function () { worldwide(nm, this); });
    });
  }
  function worldwide(nm, btn) {
    btn.disabled = true; clearWorld();
    SH.getJSON(PB + 'occs/list.json?vocab=pbdb&show=coords&limit=8000&base_name=' + encodeURIComponent(nm), { timeout: 45000 }).then(function (j) {
      var R = j.records || [], P = {}, pts = {}; world = L.layerGroup().addTo(map);
      R.forEach(function (r) { var p = per(+r.max_ma, +r.min_ma); P[p[0]] = (P[p[0]] || 0) + 1; var k = (+r.lat).toFixed(1) + ',' + (+r.lng).toFixed(1); if (pts[k]) return; pts[k] = 1; L.circleMarker([+r.lat, +r.lng], { radius: 3.5, weight: .6, color: '#111', fillColor: p[4], fillOpacity: .9, interactive: false }).addTo(world); });
      var ll = Object.keys(pts).map(function (k) { return k.split(',').map(Number); }); if (ll.length) map.fitBounds(L.latLngBounds(ll).pad(.1), { maxZoom: 6 });
      var ord = SH.ics.filter(function (p) { return P[p[0]]; }); $('#fWPer').hidden = false; $('#fWCap').hidden = false;
      SH.plot('fWPer', [{ type: 'bar', x: ord.map(pname), y: ord.map(function (p) { return P[p[0]]; }), marker: { color: ord.map(function (p) { return p[4]; }), line: { color: '#333', width: .5 } }, hovertemplate: '%{x}: %{y}<extra></extra>' }], function () { return SH.plotLayout({ margin: { l: 40, r: 6, t: 6, b: 60 }, showlegend: false, xaxis: { tickangle: -35, autorange: 'reversed' } }); });
      $('#fWCap').textContent = t(R.length + ' records worldwide shown on the map, coloured by period. The chart shows in which periods this taxon is most often found.', 'عُرض ' + R.length + ' سجلاً عالمياً على الخريطة ملونة حسب العصر. يبين المخطط العصور التي توجد فيها هذه الأصنوفة أكثر من غيرها.');
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-tx]'); if (!b || !G) return; var inSite = !!b.closest('#fSite'); taxon(b.getAttribute('data-tx'), inSite ? 'site' : 'search'); });

  /* ------------------------------------------------------------------ controls and exports */
  $('#fView').addEventListener('click', function () { if (map) search(map.getBounds().pad(-0.05)); });
  $('#fDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); search(bb); }, $('#fHint')); });
  $('#fTax').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#fView').click(); });
  $('#fCsv').addEventListener('click', function () { SH.csv('shandal-fossil-records.csv', [['occurrence_no', 'collection_no', 'site', 'taxon', 'rank', 'phylum', 'class', 'order', 'family', 'early_interval', 'late_interval', 'max_ma', 'min_ma', 'lat', 'lon', 'formation', 'lithology', 'environment', 'country', 'reference']].concat(O.map(function (o) { var c = SITES[o.cid] || {}; return [o.id, o.cid, c.collection_name, o.name, o.rank, o.phylum, o.cls, o.order, o.family, o.early, o.late, o.max_ma, o.min_ma, o.lat, o.lon, c.formation, [unq(c.lithology1), unq(c.lithology2)].filter(Boolean).join('; '), c.environment, c.cc, c.primary_reference]; }))); });
  $('#fGeo').addEventListener('click', function () { SH.json('shandal-fossil-sites.geojson', { type: 'FeatureCollection', features: S.map(function (c) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { collection_no: c.collection_no, name: c.collection_name, formation: c.formation, lithology: [unq(c.lithology1), unq(c.lithology2)].filter(Boolean).join('; '), environment: c.environment, early_interval: c.early_interval, late_interval: c.late_interval, max_ma: c.max_ma, min_ma: c.min_ma, paleolat: c.paleolat, paleolng: c.paleolng, taxa: c.taxa.map(function (o) { return o.name; }).join('; '), reference: c.primary_reference } }; }) }); });
})();
