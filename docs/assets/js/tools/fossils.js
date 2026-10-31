/* Fossil Sites Explorer — published fossil collections and occurrences by area, group and age, read and
   interpreted inside Shandal. Side panel: search (group guide, age, area, examples) and the site and fossil
   cards. Results deck under the map: overview (KPIs, interpretation, four explained charts), site cards,
   fossil gallery, complete data table (Excel, CSV, GeoJSON) and a print-ready map sheet. Every figure is
   downloadable with frame, north arrow, scale and legend; nothing sends the user outside the system. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, L = window.L, AR = SH.lang === 'ar', E = SH.esc;
  var PB = 'https://paleobiodb.org/data1.2/';
  var map = SH.map('fMap', { zoom: 5, base: 'light', center: [33.5, 44], canvas: true });
  if (map) map.attributionControl.setPrefix('Leaflet');
  var G = null, LAND = null, lay = null, box = null, drawer = null, world = null, hl = null, O = [], S = [], SITES = {}, AREA = null, AREANAME = '', cur = { site: null, from: 'search', taxon: null };
  var ARR = AR ? '→' : '←', FWD = AR ? '←' : '→';
  var INK = '#1B232B', MUT = '#55616B', PF = 'Manrope, Arial, sans-serif';

  /* ------------------------------------------------------------------ helpers */
  var clean = function (v) { return v && !/^NO_|^$/.test(v) ? v : ''; };
  var unq = function (v) { return String(v || '').replace(/"/g, '').trim(); };
  var tr = function (dict, k) { if (!k) return ''; var a = dict[k] || dict[String(k).toLowerCase()]; return AR && a ? a : k; };
  var trTokens = function (dict, s) { if (!s) return ''; return String(s).split(/\s*,\s*/).map(function (x) { return AR ? (dict[x] || dict[x.toLowerCase()] || x) : x; }).join(AR ? '، ' : ', '); };
  var per = function (max, min) { return SH.icsAt((max + min) / 2) || ['Unknown', 'غير معروف', 0, 0, '#999999']; };
  var pname = function (p, en) { return AR && !en ? p[1] : p[0]; };
  var ma = function (v) { return SH.fmt(v, v < 10 ? 2 : 1); };
  var country = function (cc, en) { try { return new Intl.DisplayNames([AR && !en ? 'ar' : 'en'], { type: 'region' }).of(cc); } catch (e) { return cc; } };
  var thumb = function (no) { return no ? PB + 'taxa/thumb.png?id=' + no : ''; };
  var pct = function (a, b) { return Math.round(100 * a / b); };
  var uniq = function (a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); };
  function shade(hex, f) { var n = parseInt(String(hex).slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255, m = function (c) { return Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f); }; return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')'; }
  function grad(hex) { return '--c1:' + shade(hex, -.18) + ';--c2:' + shade(hex, -.62); }
  var SCALE = { 'outcrop': t('single outcrop', 'مكشف واحد'), 'local area': t('local area', 'منطقة محلية'), 'small collection': t('small collection', 'مجموعة صغيرة'), 'basin': t('whole basin', 'حوض كامل'), 'hand sample': t('hand sample', 'عينة يدوية') };
  var spin = '<span aria-hidden="true" style="display:inline-block;width:11px;height:11px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:fxSpin .8s linear infinite;vertical-align:-1px;margin-inline-end:5px"></span>';
  (function () { var st = document.createElement('style'); st.textContent = '@keyframes fxSpin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); })();

  function grp(o) {
    if (o.order === 'Hippuritida') return 'Hippuritida';
    if (o.family === 'Nummulitidae') return 'Nummulitidae';
    return clean(o.cls) || clean(o.phylum) || 'Unclassified';
  }
  function ginfo(k) { return G && G.groups.filter(function (x) { return x.k === k; })[0]; }
  function gname(k, en) { var g = ginfo(k); if (g) return AR && !en ? g.ar : g.en; if (k === 'Unclassified') return en || !AR ? 'Unclassified' : 'غير مصنف'; return en ? k : tr(G ? G.cls : {}, k); }
  var GPAL = ['#C9A227', '#2F7F7C', '#B4552D', '#4B63B5', '#6C8F2E', '#9C4D9A', '#2A8FB8', '#8C6D4F', '#D06A8A', '#5E6B78'];
  function gcol(k, i) { var g = ginfo(k); return g ? g.c : GPAL[(i || 0) % GPAL.length]; }
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
  var lithList = function (c) { return uniq([unq(c.lithology1), unq(c.lithology2)].filter(function (x) { return x && x !== 'not reported'; })); };
  var lith = function (c, en) { return uniq(lithList(c).map(function (x) { return en ? x : tr(G.lith, x); })).join(AR && !en ? ' و' : ' and '); };
  var ageTxt = function (c) { return c.early_interval + (c.late_interval && c.late_interval !== c.early_interval ? ' – ' + c.late_interval : ''); };

  function show(v) { $$('[data-v]').forEach(function (el) { el.hidden = el.getAttribute('data-v') !== v; }); var side = $('.wsm-side'); if (side) side.scrollTop = 0; var w = $('.wsm'), on = v !== 'search'; if (w && w.classList.contains('fx-wide') !== on) { w.classList.toggle('fx-wide', on); setTimeout(function () { map.invalidateSize(); }, 60); } }
  function backBtn(label, id) { return '<button type="button" class="fx-back" id="' + id + '">' + ARR + ' ' + label + '</button>'; }
  function busyBtn(b, on) { if (on) { b._h = b.innerHTML; b.disabled = true; b.innerHTML = spin + t('Preparing…', 'جارٍ التجهيز…'); } else { b.disabled = false; if (b._h) b.innerHTML = b._h; } }
  function dlBtns(attr, val) { return ['png', 'jpg', 'pdf'].map(function (f) { return '<button class="btn btn-line btn-xs" type="button" ' + attr + '="' + val + '" data-f="' + f + '">' + f.toUpperCase() + '</button>'; }).join(''); }

  /* ------------------------------------------------------------------ examples */
  var AREAS = [
    ['Northern Iraq and the Zagros', 'شمال العراق وزاگروس', [29, 38, 38, 49]],
    ['Western Desert of Iraq', 'الصحراء الغربية العراقية', [30, 38.5, 34.5, 44.5]],
    ['Mount Lebanon and the Levant', 'جبل لبنان والمشرق', [31, 34.4, 35, 37.5]],
    ['Fayum, Egypt', 'الفيوم، مصر', [28.8, 29.5, 30, 31.3]],
    ['High Atlas, Morocco', 'الأطلس الكبير، المغرب', [29.5, -10, 33.5, -3.5]],
    ['Jurassic Coast, England', 'الساحل الجوراسي، إنجلترا', [50.4, -3.8, 50.9, -1.7]]
  ];
  function runArea(a) { AREANAME = a[0]; var b = L.latLngBounds([a[2][0], a[2][1]], [a[2][2], a[2][3]]); map.fitBounds(b, { padding: [20, 20] }); search(b, true); }

  /* ------------------------------------------------------------------ init */
  Promise.all([SH.getJSON(SH.base + 'assets/data/fossil-guide.json'), SH.getJSON(SH.base + 'assets/data/land-dots.json').catch(function () { return null; })]).then(function (r) {
    G = r[0]; LAND = r[1];
    $('#fInt').innerHTML = G.intervals.map(function (i) { return '<option value="' + E(i[0]) + '">' + E(AR ? i[2] : i[1]) + '</option>'; }).join('');
    $('#fChips').innerHTML = G.groups.map(function (g) { return '<button type="button" class="fx-chip" aria-pressed="false" data-g="' + g.k + '"><i style="background:' + g.c + '"></i><span><b>' + E(AR ? g.ar : g.en) + '</b><small>' + SH.fmt(g.r[0], 0) + '–' + SH.fmt(g.r[1], 0) + ' Ma</small></span></button>'; }).join('');
    $('#fAreas').innerHTML = AREAS.map(function (a, i) { return '<button type="button" class="fx-area" data-area="' + i + '">' + E(AR ? a[1] : a[0]) + '</button>'; }).join('');
    var persist = SH.persist('fossils3', ['fTax', 'fInt']); $('#fTax').addEventListener('change', persist.save); $('#fInt').addEventListener('change', persist.save);
    syncChip();
  }).catch(function (e) { SH.toast(e.message, 'bad'); });

  function syncChip() {
    var v = SH.val('fTax').trim(), g = G.groups.filter(function (x) { return x.k.toLowerCase() === v.toLowerCase(); })[0];
    $$('.fx-chip').forEach(function (b) { b.setAttribute('aria-pressed', g && b.getAttribute('data-g') === g.k ? 'true' : 'false'); });
    $('#fGroup').innerHTML = g ? groupCard(g, true) : '';
  }
  function groupCard(g, more) {
    var ra = '<span class="ltr">' + SH.fmt(g.r[0], 0) + ' – ' + SH.fmt(g.r[1], 0) + '</span> ' + t('million years ago', 'مليون سنة مضت') + (g.r[1] === 0 ? t(' (still living today)', ' (ما زالت حية اليوم)') : '');
    return '<div class="fx-card"><div style="display:flex;gap:8px;align-items:center"><i style="width:12px;height:12px;border-radius:50%;background:' + g.c + '"></i><h4>' + E(AR ? g.ar : g.en) + ' <span class="xsmall muted" style="font-weight:600">· <i>' + g.k + '</i></span></h4></div>' +
      '<p>' + E(AR ? g.d_ar : g.d_en) + '</p>' +
      '<span class="lb">' + t('Time range', 'المدى الزمني') + '</span><p>' + ra + '</p>' +
      '<span class="lb">' + t('Where they lived', 'أين عاشت') + '</span><p>' + E(AR ? g.env_ar : g.env_en) + '</p>' +
      '<span class="lb">' + t('Why geologists use them', 'لماذا يستخدمها الجيولوجيون') + '</span><p>' + E(AR ? g.use_ar : g.use_en) + '</p>' +
      ((AR ? g.iq_ar : g.iq_en) ? '<span class="lb">' + t('In Iraq', 'في العراق') + '</span><p class="fx-iq">' + E(AR ? g.iq_ar : g.iq_en) + '</p>' : '') +
      (more ? '<button type="button" class="btn btn-line btn-xs" data-tx="' + g.k + '">' + t('Images, description and worldwide record', 'الصور والوصف والانتشار العالمي') + ' ' + FWD + '</button>' : '') + '</div>';
  }
  $('#fChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return; var on = b.getAttribute('aria-pressed') !== 'true';
    $('#fTax').value = on ? b.getAttribute('data-g') : ''; $('#fTax').dispatchEvent(new Event('change')); syncChip();
  });
  $('#fTax').addEventListener('input', function () { if (G) syncChip(); });
  $('#fGloss').addEventListener('click', function () {
    SH.modal(t('Glossary', 'المصطلحات'), '<div style="display:grid;gap:12px">' + G.glossary.map(function (g) { return '<div><b>' + E(AR ? g[1] : g[0]) + '</b><div class="small" style="line-height:1.7">' + E(AR ? g[3] : g[2]) + '</div></div>'; }).join('') + '</div>');
  });
  $('#fAreas').addEventListener('click', function (e) { var b = e.target.closest('[data-area]'); if (b) runArea(AREAS[+b.getAttribute('data-area')]); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-try]'); if (!b || !G) return; var k = b.getAttribute('data-try');
    if (k === 'group') { $('#fTax').value = 'Nummulitidae'; syncChip(); SH.toast(t('Example: nummulites, the large foraminifera of the Eocene limestones of Iraq.', 'مثال: النميوليتات، المنخربات الكبيرة في حجر الكلس الإيوسيني في العراق.')); }
    if (k === 'name') { $('#fTax').value = 'Hippurites'; syncChip(); SH.toast(t('Example: Hippurites, a Late Cretaceous rudist bivalve.', 'مثال: Hippurites، رخوي روديستي من الطباشيري المتأخر.')); }
    if (k === 'age') { $('#fInt').value = 'Cretaceous'; SH.toast(t('Example: the Cretaceous period (145–66 Ma).', 'مثال: العصر الطباشيري (145–66 مليون سنة).')); }
    if (k === 'area') runArea(AREAS[0]);
    $('#fTax').dispatchEvent(new Event('change'));
  });
  function demo() { $('#fTax').value = ''; $('#fInt').value = ''; syncChip(); runArea(AREAS[0]); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  $('#fDemo').addEventListener('click', demo); $$('[data-demo]').forEach(function (b) { b.addEventListener('click', demo); });

  /* ------------------------------------------------------------------ search */
  function search(b, named) {
    if (!G) return;
    var w = Math.max(-180, b.getWest()), e = Math.min(180, b.getEast()), s = Math.max(-90, b.getSouth()), n = Math.min(90, b.getNorth());
    if (e - w > 60 || n - s > 45) { SH.toast(t('Area too large. Zoom in or draw a smaller rectangle.', 'المساحة كبيرة جداً. كبّر الخريطة أو ارسم مستطيلاً أصغر.'), 'warn'); return; }
    if (!named) AREANAME = '';
    if (box) map.removeLayer(box); box = L.rectangle([[s, w], [n, e]], { color: '#C9A227', weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map);
    clearWorld();
    var bb = '&lngmin=' + w.toFixed(3) + '&lngmax=' + e.toFixed(3) + '&latmin=' + s.toFixed(3) + '&latmax=' + n.toFixed(3), f = '';
    if (SH.val('fTax').trim()) f += '&base_name=' + encodeURIComponent(SH.val('fTax').trim());
    if (SH.val('fInt')) f += '&interval=' + encodeURIComponent(SH.val('fInt'));
    SH.busy($('#fMap').parentElement, true, t('Searching the fossil record of this area…', 'جارٍ البحث في السجل الأحفوري لهذه المنطقة…'));
    Promise.all([
      SH.getJSON(PB + 'colls/list.json?vocab=pbdb&show=loc,strat,lith,env,paleoloc,ref,time&limit=3000' + bb + f, { timeout: 45000 }),
      SH.getJSON(PB + 'occs/list.json?vocab=pbdb&show=class,coords,img&limit=6000' + bb + f, { timeout: 45000 })
    ]).then(function (r) {
      if (r[0].errors) throw new Error(r[0].errors.join('; ')); if (r[1].errors) throw new Error(r[1].errors.join('; '));
      AREA = { w: w, e: e, s: s, n: n, tax: SH.val('fTax').trim(), int: SH.val('fInt') };
      SITES = {}; (r[0].records || []).forEach(function (c) { c.max_ma = +c.max_ma; c.min_ma = +c.min_ma; c.lat = +c.lat; c.lng = +c.lng; c.taxa = []; SITES[c.collection_no] = c; });
      O = (r[1].records || []).map(function (x) { return { id: x.occurrence_no, cid: x.collection_no, name: x.accepted_name || x.identified_name, ident: x.identified_name, rank: x.accepted_rank || x.identified_rank, phylum: clean(x.phylum), cls: clean(x['class']), order: clean(x.order), family: clean(x.family), genus: clean(x.genus), img: x.image_no, early: x.early_interval, late: x.late_interval || x.early_interval, max_ma: +x.max_ma, min_ma: +x.min_ma, lat: +x.lat, lon: +x.lng }; });
      O.forEach(function (o) { var c = SITES[o.cid]; if (c) c.taxa.push(o); });
      S = Object.keys(SITES).map(function (k) { return SITES[k]; });
      show('search'); draw();
      $('#fInfo').innerHTML = '<span><b>' + S.length + '</b> ' + t('sites', 'موقعاً') + ' · <b>' + SH.fmt(O.length, 0) + '</b> ' + t('fossil records', 'سجلاً أحفورياً') + (O.length >= 6000 ? ' · ' + t('limit reached; narrow the search', 'بلغ الحد؛ ضيّق البحث') : '') + '</span>';
      if (!S.length) { SH.toast(t('No fossil sites match this search here. Try a wider area or remove a filter.', 'لا توجد مواقع أحفورية مطابقة هنا. وسّع المنطقة أو أزل أحد الفلاتر.'), 'warn'); $('#fRes').hidden = true; $('#fEmpty').hidden = false; return; }
      $('#fEmpty').hidden = true; $('#fRes').hidden = false;
      overview(); siteCards(); gallery(); table(); sheet();
      tab(curTab);
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
    $('#fLeg').hidden = !ps.length; $('#fLeg').innerHTML = '<b style="font-size:.78rem">' + t('Age of the site', 'عمر الموقع') + '</b>' + ps.map(function (p) { return '<span><i style="background:' + p[4] + '"></i>' + pname(p) + ' <span class="muted ltr">' + ma(p[2]) + '–' + ma(p[3]) + '</span></span>'; }).join('') + '<span class="muted">' + t('Circle size = number of records', 'حجم الدائرة = عدد السجلات') + '</span>';
    var taxa = {}; O.forEach(function (o) { taxa[o.name] = 1; });
    $('#fMapStat').hidden = !S.length; $('#fMapStat').innerHTML = '<span><b>' + S.length + '</b> ' + t('sites', 'موقعاً') + '</span><span><b>' + SH.fmt(O.length, 0) + '</b> ' + t('records', 'سجلاً') + '</span><span><b>' + Object.keys(taxa).length + '</b> ' + t('fossils', 'أحفورة') + '</span>';
  }
  function highlight(c) { if (hl) map.removeLayer(hl); hl = L.circleMarker([c.lat, c.lng], { radius: 20, color: '#C9A227', weight: 3, fill: false, interactive: false }).addTo(map); }

  /* ------------------------------------------------------------------ results deck: tabs */
  var curTab = 'ov';
  function tab(k) { curTab = k; $$('.fx-tabs [data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === k ? 'true' : 'false'); }); $$('.fx-pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== k; }); if (window.Plotly && k === 'ov') $$('#fRes .js-plotly-plot').forEach(function (p) { try { window.Plotly.Plots.resize(p); } catch (e) {} }); if (k === 'gl') galObserve(); }
  $('.fx-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) tab(b.getAttribute('data-tab')); });

  /* ------------------------------------------------------------------ overview */
  var CH = {};
  function stats() {
    var taxa = {}, P = {}, C = {}, EC = {}, F = {}, marine = 0, land = 0;
    O.forEach(function (o) { taxa[o.name] = 1; var p = per(o.max_ma, o.min_ma)[0]; P[p] = (P[p] || 0) + 1; var g = grp(o); C[g] = (C[g] || 0) + 1; });
    S.forEach(function (c) { var k = envCat(c.environment); EC[k] = (EC[k] || 0) + 1; if (/reef|shallow|deep|marine|marginal/.test(k)) marine++; else if (k !== 'none') land++; if (c.formation) { var f = F[c.formation] = F[c.formation] || { n: 0, sites: 0, lith: {}, p: {} }; f.n += c.taxa.length; f.sites++; lithList(c).forEach(function (l) { f.lith[l] = 1; }); f.p[per(c.max_ma, c.min_ma)[0]] = 1; } });
    var ages = O.length ? O : S;
    return { taxa: taxa, P: P, C: C, EC: EC, F: F, marine: marine, land: land, oldest: Math.max.apply(null, ages.map(function (o) { return o.max_ma; })), young: Math.min.apply(null, ages.map(function (o) { return o.min_ma; })) };
  }
  function overview() {
    var st = stats(), nT = Object.keys(st.taxa).length, pk = Object.keys(st.P).sort(function (a, b) { return st.P[b] - st.P[a]; }), ck = Object.keys(st.C).sort(function (a, b) { return st.C[b] - st.C[a]; }), fk = Object.keys(st.F).sort(function (a, b) { return st.F[b].n - st.F[a].n; });
    var pP = SH.ics.filter(function (p) { return p[0] === pk[0]; })[0];
    var kpi = function (k, v, s) { return '<div class="fx-kpi"><span>' + k + '</span><b>' + v + '</b><small>' + s + '</small></div>'; };
    $('#fKpis').innerHTML = kpi(t('Fossil sites', 'المواقع الأحفورية'), S.length, t('places with published fossils', 'أماكن فيها أحافير منشورة')) + kpi(t('Fossil records', 'السجلات الأحفورية'), SH.fmt(O.length, 0), t('one per fossil per site', 'سجل لكل أحفورة في كل موقع')) +
      kpi(t('Different fossils', 'أحافير مختلفة'), nT, t('distinct genera and species', 'أجناس وأنواع مختلفة')) + kpi(t('Age span', 'المدى العمري'), SH.fmt(st.oldest, 0) + '–' + SH.fmt(st.young, 0), t('million years ago', 'مليون سنة مضت')) +
      kpi(t('Formations', 'التكوينات'), fk.length, t('named rock units with fossils', 'وحدات صخرية مسماة فيها أحافير')) + kpi(t('Best represented', 'الأكثر تمثيلاً'), '<span style="font-size:1.15rem">' + (pP ? pname(pP) : '—') + '</span>', pk[0] ? pct(st.P[pk[0]], O.length || 1) + t('% of the records', '% من السجلات') : '');
    $('#nSt').textContent = S.length; $('#nTb').textContent = SH.fmt(O.length, 0);
    // interpretation
    var P2 = [];
    P2.push(t('The searched area holds ', 'تضم المنطقة المبحوثة ') + '<b>' + S.length + '</b>' + t(' published fossil sites with ', ' موقعاً أحفورياً منشوراً فيها ') + '<b>' + SH.fmt(O.length, 0) + '</b>' + t(' records of ', ' سجلاً لـ ') + '<b>' + nT + '</b>' + t(' different fossils, ranging from about ', ' أحفورة مختلفة، تتراوح أعمارها بين نحو ') + '<b class="ltr">' + SH.fmt(st.oldest, 0) + '</b>' + t(' to ', ' و') + '<b class="ltr">' + SH.fmt(st.young, 0) + '</b>' + t(' million years ago.', ' مليون سنة.'));
    if (pk[0] && ck[0]) P2.push(t('Most records belong to the ', 'تعود معظم السجلات إلى عصر ') + '<b>' + (pP ? pname(pP) : pk[0]) + '</b> (' + pct(st.P[pk[0]], O.length) + '%)' + (pk[1] ? t(', followed by the ', '، يليه ') + '<b>' + pname(SH.ics.filter(function (p) { return p[0] === pk[1]; })[0] || [pk[1], pk[1]]) + '</b>' : '') + t('. The dominant group is ', '. والمجموعة الغالبة هي ') + '<b>' + E(gname(ck[0])) + '</b> (' + pct(st.C[ck[0]], O.length) + '%)' + (ck[1] ? t(', then ', '، ثم ') + '<b>' + E(gname(ck[1])) + '</b>' : '') + (ck[2] ? t(' and ', ' و') + '<b>' + E(gname(ck[2])) + '</b>' : '') + '.');
    var ek = Object.keys(st.EC).filter(function (k) { return k !== 'none'; }).sort(function (a, b) { return st.EC[b] - st.EC[a]; });
    if (st.marine + st.land) P2.push(st.marine >= st.land ? t('Of the sites with a recorded environment, ', 'من المواقع ذات البيئة المسجلة، ') + '<b>' + pct(st.marine, st.marine + st.land) + '%</b>' + t(' formed under the sea', ' تكوّنت تحت سطح البحر') + (ek[0] ? ' (' + t('mainly ', 'غالباً ') + (AR ? ecat(ek[0])[2] : ecat(ek[0])[1].toLowerCase()) + ')' : '') + t(': the region was covered by ancient seas for much of the recorded time, and its fossil-bearing rocks are mainly marine sediments.', '؛ أي أن المنطقة كانت مغمورة ببحار قديمة معظم الزمن المسجل، وصخورها الحاملة للأحافير رسوبيات بحرية في أغلبها.') : t('Most sites with a recorded environment formed on land (rivers, lakes or deserts), so the fossil-bearing rocks are mainly continental sediments.', 'تكوّنت معظم المواقع ذات البيئة المسجلة على اليابسة (أنهار أو بحيرات أو صحارى)، فالصخور الحاملة للأحافير رسوبيات قارية في أغلبها.'));
    if (fk.length) P2.push(t('The richest formations are ', 'أغنى التكوينات بالأحافير ') + fk.slice(0, 3).map(function (f) { var x = st.F[f], li = Object.keys(x.lith).slice(0, 2).map(function (l) { return tr(G.lith, l); }).join(AR ? ' و' : ' and '); return '<b dir="ltr">' + E(f) + '</b> (' + x.n + t(' records', ' سجلاً') + (li ? AR ? '، ' + E(li) : ', ' + E(li) : '') + ')'; }).join(AR ? '، و' : ', ') + t('. These units are the first targets for fossil collecting and biostratigraphic sampling in the area.', '. وهذه الوحدات هي الأهداف الأولى لجمع الأحافير وأخذ العينات الطباقية الحيوية في المنطقة.'));
    var idx = ck.filter(function (k) { var g = ginfo(k); return g && /Nummulitidae|Hippuritida|Ammonoidea|Foraminifera|Graptolithina|Trilobita/.test(k); }).slice(0, 2);
    if (idx.length) P2.push(t('Index fossils are present: ', 'توجد أحافير دالة: ') + idx.map(function (k) { var g = ginfo(k); return '<b>' + E(AR ? g.ar : g.en) + '</b> — ' + E((AR ? g.use_ar : g.use_en).split(/[.؛]\s/)[0].replace(/[.؛]?$/, '.')); }).join(' '));
    var dr = S.filter(function (c) { return c.paleolat !== '' && c.paleolat != null && isFinite(+c.paleolat); });
    if (dr.length >= 3) { var d0 = dr.reduce(function (a, c) { return a + (c.lat - +c.paleolat); }, 0) / dr.length, old = dr.slice().sort(function (a, b) { return b.max_ma - a.max_ma; })[0];
      if (Math.abs(d0) >= 3) P2.push(t('Plate reconstruction places these sites on average ', 'تضع إعادة بناء الصفائح هذه المواقع في المتوسط على بُعد ') + '<b class="ltr">' + Math.abs(d0).toFixed(0) + '°</b>' + (d0 > 0 ? t(' south of their present latitude when the organisms lived; the oldest site lay at about ', ' جنوب خط عرضها الحالي عندما عاشت هذه الكائنات؛ وكان أقدم موقع عند خط عرض ') : t(' north of their present latitude; the oldest site lay at about ', ' شمال خط عرضها الحالي؛ وكان أقدم موقع عند خط عرض ')) + '<b class="ltr">' + Math.abs(+old.paleolat).toFixed(0) + '°' + (+old.paleolat >= 0 ? 'N' : 'S') + '</b>' + t('. The region has drifted with its plate since then, which is why tropical reef and lagoon fossils now occur far from the tropics.', '. وقد انجرفت المنطقة مع صفيحتها منذ ذلك الحين، ولهذا توجد أحافير الشعاب واللاغونات المدارية اليوم بعيداً عن المناطق المدارية.')); }
    $('#fSum').innerHTML = P2.map(function (x) { return '<p style="margin:0 0 10px">' + x + '</p>'; }).join('');
    CH = { fPer: function (en) { return chPer(st, en); }, fCls: function (en) { return chCls(st, en); }, fEnv: function (en) { return chEnv(st, en); }, fDrift: function (en) { return chDrift(en); } };
    Object.keys(CH).forEach(function (id) { var c = CH[id](false); SH.plot(id, c.data, function () { return c.layout; }, { filename: 'shandal-' + id }); $('#' + id + 'Cap').innerHTML = c.cap || ''; });
    $$('[data-dlplot]').forEach(function (d) { d.innerHTML = dlBtns('data-pl', d.getAttribute('data-dlplot')); });
  }
  var L2 = function (en, ar, e) { return AR && !e ? ar : en; };
  function chPer(st, en) {
    var ord = SH.ics.filter(function (p) { return st.P[p[0]]; }).reverse(), gs = Object.keys(st.C).sort(function (a, b) { return st.C[b] - st.C[a]; }).slice(0, 6), cnt = {};
    O.forEach(function (o) { var p = per(o.max_ma, o.min_ma)[0], g = gs.indexOf(grp(o)) > -1 ? grp(o) : '_o'; cnt[g] = cnt[g] || {}; cnt[g][p] = (cnt[g][p] || 0) + 1; });
    var xs = ord.map(function (p, i) { return i; }), data = gs.concat(cnt._o ? ['_o'] : []).map(function (g, i) { return { type: 'bar', name: g === '_o' ? L2('Other groups', 'مجموعات أخرى', en) : gname(g, en), x: xs, y: ord.map(function (p) { return (cnt[g] || {})[p[0]] || 0; }), marker: { color: g === '_o' ? '#9AA3AB' : gcol(g, i), line: { color: 'rgba(0,0,0,.35)', width: .5 } }, hovertemplate: '%{fullData.name}: %{y}<extra></extra>' }; });
    var shapes = ord.map(function (p, i) { return { type: 'rect', xref: 'x', yref: 'paper', x0: i - .5, x1: i + .5, y0: -0.17, y1: -0.04, fillcolor: p[4], line: { color: '#333', width: .6 } }; }), ann = ord.map(function (p, i) { return { xref: 'x', yref: 'paper', x: i, y: -0.105, text: pname(p, en), showarrow: false, font: { size: 10, color: '#111' } }; });
    var top = ord.slice().sort(function (a, b) { return st.P[b[0]] - st.P[a[0]]; })[0];
    return { data: data, layout: { barmode: 'stack', margin: { l: 50, r: 10, t: 10, b: 84 }, xaxis: { tickvals: [], showticklabels: false, range: [-.5, ord.length - .5], zeroline: false }, yaxis: { title: { text: L2('fossil records', 'السجلات الأحفورية', en) } }, shapes: shapes, annotations: ann.concat([{ xref: 'paper', yref: 'paper', x: .5, y: -0.25, text: L2('older  →  younger', 'الأقدم  ←  الأحدث', en), showarrow: false, font: { size: 10, color: '#777' } }]), legend: { orientation: 'h', y: 1.12, font: { size: 10 } }, bargap: .25 },
      cap: t('Bars stack the records of each period by fossil group; the coloured strip is the official ICS time scale. The ', 'تُكدّس الأعمدة سجلات كل عصر حسب المجموعة الأحفورية، والشريط الملوّن هو المقياس الزمني الرسمي للجنة الدولية للطباقية. ويبرز ') + '<b>' + (top ? pname(top) : '') + '</b>' + t(' stands out as the best documented interval of the area.', ' بوصفه الفترة الأفضل توثيقاً في المنطقة.') };
  }
  function chCls(st, en) {
    var top = Object.keys(st.C).sort(function (a, b) { return st.C[b] - st.C[a]; }).slice(0, 10), tot = O.length || 1;
    var rv = top.slice().reverse();
    var mar = top.filter(function (k) { return /Foraminifera|Nummulitidae|Anthozoa|Scleractinia|Echinoidea|Bivalvia|Gastropoda|Cephalopoda|Ammonoidea|Brachiopoda|Bryozoa|Crinoidea|Ostracoda|Hippuritida|Trilobita|Chondrichthyes|Cnidaria|Echinodermata|Porifera/.test(k); }).length;
    return { data: [{ type: 'bar', orientation: 'h', y: rv.map(function (k) { return gname(k, en); }), x: rv.map(function (k) { return st.C[k]; }), text: rv.map(function (k) { return pct(st.C[k], tot) + '%'; }), textposition: 'outside', cliponaxis: false, marker: { color: rv.map(function (k, i) { return gcol(k, top.length - 1 - i); }), line: { color: 'rgba(0,0,0,.3)', width: .5 } }, hovertemplate: '%{y}: %{x}<extra></extra>' }],
      layout: { margin: { l: 140, r: 40, t: 10, b: 40 }, showlegend: false, xaxis: { title: { text: L2('fossil records', 'السجلات الأحفورية', en) } } },
      cap: mar >= top.length / 2 ? t('Marine invertebrates and microfossils dominate the record, the signature of ancient seas over the area.', 'تهيمن اللافقاريات البحرية والأحافير الدقيقة على السجل، وهي بصمة البحار القديمة التي غمرت المنطقة.') : t('Land organisms make up a large part of the record, pointing to continental settings.', 'تشكّل كائنات اليابسة جزءاً كبيراً من السجل، ما يدل على بيئات قارية.') };
  }
  function chEnv(st, en) {
    var ek = G.envcat.filter(function (c) { return st.EC[c[0]] && c[0] !== 'none'; }).reverse();
    return { data: [{ type: 'bar', orientation: 'h', y: ek.map(function (c) { return en || !AR ? c[1] : c[2]; }), x: ek.map(function (c) { return st.EC[c[0]]; }), marker: { color: ek.map(function (c) { return c[3]; }), line: { color: 'rgba(0,0,0,.3)', width: .5 } }, customdata: ek.map(function (c) { return en || !AR ? c[4] : c[5]; }), hovertemplate: '%{y}: %{x}<br>%{customdata}<extra></extra>' }],
      layout: { margin: { l: 130, r: 16, t: 10, b: 40 }, showlegend: false, xaxis: { title: { text: L2('sites', 'المواقع', en) } } },
      cap: st.EC.none ? t(st.EC.none + ' sites have no recorded environment and are not shown. Hover a bar for what each environment means.', 'لا تُعرض ' + st.EC.none + ' مواقع ليست لها بيئة مسجلة. مرّر المؤشر على أي عمود لمعرفة معنى البيئة.') : t('Hover a bar for what each environment means.', 'مرّر المؤشر على أي عمود لمعرفة معنى البيئة.') };
  }
  function chDrift(en) {
    var dr = S.filter(function (c) { return c.paleolat !== '' && c.paleolat != null && isFinite(+c.paleolat); }), lat0 = S.reduce(function (a, c) { return a + c.lat; }, 0) / (S.length || 1);
    var ps = SH.ics.filter(function (p) { return dr.some(function (c) { return per(c.max_ma, c.min_ma)[0] === p[0]; }); });
    var data = ps.map(function (p) { var a = dr.filter(function (c) { return per(c.max_ma, c.min_ma)[0] === p[0]; }); return { type: 'scatter', mode: 'markers', name: pname(p, en), x: a.map(function (c) { return (c.max_ma + c.min_ma) / 2; }), y: a.map(function (c) { return +c.paleolat; }), text: a.map(function (c) { return c.collection_name; }), marker: { color: p[4], size: 9, line: { color: '#222', width: .6 } }, hovertemplate: '%{text}<br>%{x:.1f} Ma · %{y:.1f}°<extra></extra>' }; });
    var xmax = Math.max.apply(null, dr.map(function (c) { return c.max_ma; }).concat([10]));
    data.push({ type: 'scatter', mode: 'lines', x: [0, xmax * 1.05], y: [lat0, lat0], line: { color: '#C9A227', width: 2, dash: 'dash' }, name: L2('latitude today', 'خط العرض اليوم', en), hoverinfo: 'skip' });
    return { data: data, layout: { margin: { l: 56, r: 14, t: 10, b: 46 }, xaxis: { autorange: 'reversed', title: { text: L2('age (million years ago)', 'العمر (مليون سنة مضت)', en) } }, yaxis: { title: { text: L2('palaeolatitude (°)', 'خط العرض القديم (°)', en) }, zeroline: true }, legend: { orientation: 'h', y: 1.14, font: { size: 10 } },
      shapes: [{ type: 'rect', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: -23.4, y1: 23.4, fillcolor: 'rgba(224,123,106,.08)', line: { width: 0 }, layer: 'below' }] },
      cap: dr.length ? t('Each point is a site placed at the latitude it occupied when its fossils lived (plate reconstruction). The shaded band is the tropics and the dashed line the latitude of the area today; points below the line show how far the area has since drifted north.', 'كل نقطة موقع وُضع عند خط العرض الذي كان فيه عندما عاشت أحافيره (إعادة بناء الصفائح). الشريط المظلل هو المنطقة المدارية والخط المتقطع خط عرض المنطقة اليوم؛ والنقاط تحت الخط تبين مقدار انجراف المنطقة نحو الشمال منذ ذلك الحين.') : t('No palaeolatitudes are available for these sites.', 'لا تتوفر خطوط عرض قديمة لهذه المواقع.') };
  }
  function plotCanvas(id) {
    var c = CH[id](true), TT = { fPer: 'Fossil record through geological time', fCls: 'Main fossil groups', fEnv: 'Ancient depositional environments', fDrift: 'Palaeolatitude of the fossil sites through time' };
    var lay = SH.plotLayout(JSON.parse(JSON.stringify(c.layout)));
    lay.paper_bgcolor = '#fff'; lay.plot_bgcolor = '#fff'; lay.font = { family: PF, color: INK, size: 13 };
    ['xaxis', 'yaxis'].forEach(function (a) { lay[a] = SH.merge(lay[a] || {}, { gridcolor: '#E3E3E3', linecolor: '#888', tickcolor: '#888', zerolinecolor: '#BBB', tickfont: { color: INK }, title: { font: { color: INK } } }); });
    lay.legend = SH.merge(lay.legend || {}, { font: { color: INK } }); lay.margin = SH.merge(lay.margin || {}, { t: 70 }); if (id === 'fPer') lay.margin.b = 110;
    if (lay.legend && lay.legend.y > 1) lay.legend.y = 1.06;
    lay.title = { text: '<b>' + TT[id] + '</b>' + (AREANAME ? ' — ' + AREANAME : ''), x: .02, y: .97, font: { size: 17, color: INK } };
    return window.Plotly.toImage({ data: c.data, layout: lay }, { format: 'png', width: 1200, height: 640, scale: 2 }).then(SH.loadImage).then(function (im) { var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0); return cv; });
  }

  /* ------------------------------------------------------------------ site cards */
  function siteGroups(c) { var g = {}; c.taxa.forEach(function (o) { var k = grp(o); g[k] = (g[k] || 0) + 1; }); return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }); }
  function siteCards() {
    var srt = SH.val('fSort'), a = S.slice();
    a.sort(srt === 'old' ? function (x, y) { return y.max_ma - x.max_ma; } : srt === 'young' ? function (x, y) { return x.min_ma - y.min_ma; } : srt === 'name' ? function (x, y) { return String(x.collection_name).localeCompare(y.collection_name); } : function (x, y) { return y.taxa.length - x.taxa.length; });
    $('#fList').innerHTML = a.slice(0, 300).map(function (c) {
      var p = per(c.max_ma, c.min_ma), gs = siteGroups(c).slice(0, 3), ec = ecat(envCat(c.environment)), li = lith(c);
      return '<button type="button" class="fx-site" data-c="' + c.collection_no + '" style="' + grad(p[4]) + '"><div class="top"><b>' + E(c.collection_name) + '</b><span class="n">' + (c.taxa.length || c.n_occs) + '<small>' + t('fossils', 'أحفورة') + '</small></span></div><div class="bd">' +
        '<span><b style="color:var(--text)">' + pname(p) + '</b> · <span class="ltr">' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma</span></span>' +
        (c.formation || li ? '<span>' + E([c.formation ? (AR ? 'تكوين ' + c.formation : c.formation + ' Fm.') : '', li].filter(Boolean).join(' · ')) + '</span>' : '') +
        '<span>' + E([country(c.cc), ec && ec[0] !== 'none' ? (AR ? ec[2] : ec[1]) : ''].filter(Boolean).join(' · ')) + '</span>' +
        (gs.length ? '<span class="fx-tags">' + gs.map(function (k) { return '<span>' + E(gname(k)) + '</span>'; }).join('') + '</span>' : '') + '</div></button>';
    }).join('');
  }
  $('#fSort').addEventListener('change', siteCards);
  $('#fList').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (!b) return; var c = SITES[b.getAttribute('data-c')]; openSite(c); });
  function openSite(c) { map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 9), { duration: .7 }); site([c], 'search'); var m = $('.wsm'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  /* ------------------------------------------------------------------ site view (side) */
  function site(arr, from) {
    cur.site = arr; cur.from = from || 'search'; highlight(arr[0]);
    var h = backBtn(t('All results', 'كل النتائج'), 'fBackS');
    h += arr.map(function (c, i) {
      var p = per(c.max_ma, c.min_ma), env = c.environment || '', ec = ecat(envCat(env)), li = lith(c), gs = siteGroups(c), place = [c.county, c.state, country(c.cc)].filter(Boolean).join(AR ? '، ' : ', ');
      var fm = c.formation ? (AR ? 'تكوين ' + c.formation : 'the ' + c.formation + ' Formation') : '';
      var txt = (AR ? 'يقع هذا الموقع' : 'This site lies') + (place ? (AR ? ' في ' : ' in ') + E(place) : '') + '. ' +
        (li || fm ? (AR ? 'يكشف ' : 'It exposes ') + E(li || t('rocks', 'صخوراً')) + (fm ? (AR ? ' من ' : ' of ') + E(fm) : '') + '. ' : '') +
        (AR ? 'يعود عمره إلى ' : 'Its age is ') + E(ageTxt(c)) + ' (' + ma(c.max_ma) + '–' + ma(c.min_ma) + t(' million years ago, ', ' مليون سنة، عصر ') + pname(p) + '). ' +
        (env ? (AR ? 'ترسبت صخوره في بيئة ' : 'Its sediments were laid down in a ') + '<b>' + E(tr(G.env, env)) + '</b>' + (AR ? '' : ' setting') + (ec && ec[0] !== 'none' ? ' — ' + E(AR ? ec[5] : ec[4].charAt(0).toLowerCase() + ec[4].slice(1)) + ' ' : '. ') : t('The publication did not record the depositional environment. ', 'لم يسجّل المنشور البيئة الترسيبية. ')) +
        (c.taxa.length ? (AR ? 'سُجلت هنا ' : 'Recorded here: ') + '<b>' + c.taxa.length + '</b>' + t(' fossils, mainly ', ' أحفورة، أغلبها من ') + gs.slice(0, 2).map(function (k) { return gname(k); }).map(E).join(AR ? ' و' : ' and ') + '. ' : '') +
        (c.paleolat != null && c.paleolat !== '' ? (AR ? 'عندما كانت هذه الكائنات حية، كان الموقع عند خط عرض ' : 'When these organisms were alive, the site lay at about ') + '<b class="ltr">' + Math.abs(+c.paleolat).toFixed(0) + '°' + (+c.paleolat >= 0 ? t('N', ' شمالاً') : t('S', ' جنوباً')) + '</b>' + (AR ? ' تقريباً، بينما يقع اليوم عند ' : ', compared with ') + '<span class="ltr">' + Math.abs(c.lat).toFixed(0) + '°' + (c.lat >= 0 ? t('N', ' شمالاً') : t('S', ' جنوباً')) + '</span>' + t(' today', '') + (Math.abs(+c.paleolat) < 23.5 && Math.abs(c.lat) >= 23.5 ? t(' — it was then in the tropics.', ' — أي كان آنذاك في المنطقة المدارية.') : '.') : '');
      var fact = function (k, v, w) { return v ? '<div class="fx-fact' + (w ? ' w' : '') + '"><span>' + k + '</span><b>' + v + '</b></div>' : ''; };
      var bygrp = {}; c.taxa.forEach(function (o) { var k = grp(o); (bygrp[k] = bygrp[k] || []).push(o); });
      var taxaH = gs.map(function (k) {
        var seen = {}, rows = bygrp[k].filter(function (o) { if (seen[o.name]) return false; seen[o.name] = 1; return true; });
        return '<div style="margin-top:8px"><div class="xsmall" style="font-weight:800;color:var(--accent);padding:0 10px;display:flex;gap:6px;align-items:center"><i style="width:8px;height:8px;border-radius:50%;background:' + gcol(k) + '"></i>' + E(gname(k)) + ' · ' + rows.length + '</div>' + rows.map(function (o) {
          return '<button type="button" class="fx-tx" data-tx="' + E(o.name) + '">' + (o.img ? '<img loading="lazy" alt="" src="' + thumb(o.img) + '">' : '<span class="ph"></span>') + '<span style="min-width:0"><i style="font-weight:700;font-size:.88rem">' + E(o.name) + '</i><span class="xsmall muted" style="display:block">' + E([tr(G.rank, o.rank), o.family, o.ident && o.ident.indexOf(o.name) !== 0 ? t('published as ', 'نُشر باسم ') + o.ident : ''].filter(Boolean).join(' · ')) + '</span></span><span class="muted">' + FWD + '</span></button>';
        }).join('') + '</div>';
      }).join('');
      var gu = SH.base + (AR ? 'ar/' : '') + 'tools/geologic-unit/app/?lat=' + c.lat.toFixed(5) + '&lon=' + c.lng.toFixed(5);
      return (i ? '<hr style="border:0;border-top:2px solid var(--line);margin:18px 0">' : '') +
        '<div class="fx-hd" style="margin-top:10px;' + grad(p[4]) + '"><h2>' + E(c.collection_name) + '</h2><div class="pills"><span>' + pname(p) + '</span><span class="ltr">' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma</span>' + (ec && ec[0] !== 'none' ? '<span>' + E(AR ? ec[2] : ec[1]) + '</span>' : '') + '<span>' + c.taxa.length + ' ' + t('fossils', 'أحفورة') + '</span></div></div>' +
        '<p class="fx-sum" style="margin-top:12px">' + txt + '</p>' +
        '<div class="fx-facts" style="margin-top:12px">' + fact(t('Country / region', 'الدولة / المنطقة'), E(place)) + fact(t('Coordinates', 'الإحداثيات'), '<span class="ltr">' + SH.fmtLatLon(c.lat, c.lng, 4) + '</span>') +
        fact(t('Formation', 'التكوين'), E(c.formation)) + fact(t('Group', 'المجموعة'), E(c.geological_group)) + fact(t('Member', 'العضو'), E(c.member)) + fact(t('Rock type', 'نوع الصخر'), E(li)) +
        fact(t('Environment', 'البيئة الترسيبية'), env ? E(tr(G.env, env)) : '') + fact(t('Geological age', 'العمر الجيولوجي'), E(ageTxt(c)) + ' · <span class="ltr">' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma</span>') +
        fact(t('Palaeolatitude', 'خط العرض القديم'), c.paleolat != null && c.paleolat !== '' ? '<span class="ltr">' + (+c.paleolat).toFixed(1) + '°, ' + (+c.paleolng).toFixed(1) + '°</span>' : '') +
        fact(t('Sampling scale', 'نطاق الجمع'), E(SCALE[c.geogscale] || c.geogscale)) + fact(t('Locality notes', 'وصف المكان'), E(c.geogcomments), true) + fact(t('Rock description', 'وصف الصخور'), E(c.lithdescript), true) + fact(t('Published in', 'المنشور العلمي'), '<span class="small" dir="ltr" style="display:block;text-align:start">' + E(c.primary_reference) + '</span>', true) + '</div>' +
        '<div class="fx-card" style="margin-top:12px"><span class="lb">' + t('Site sheet: location map with north arrow and scale, rocks, age and fossils', 'لوحة الموقع: خريطة الموقع بسهم الشمال والمقياس، والصخور والعمر والأحافير') + '</span><div class="fx-dl">' + dlBtns('data-ss', c.collection_no) + '<a class="btn btn-ink btn-xs" href="' + gu + '">' + t('Geological unit here', 'الوحدة الجيولوجية هنا') + ' ' + FWD + '</a></div></div>' +
        '<h3 class="fx-h" style="margin-top:16px">' + t('Fossils found here', 'الأحافير الموجودة هنا') + ' (' + c.taxa.length + ')</h3><p class="fx-cap" style="margin:4px 0 0">' + t('Tap a fossil for its description, photographs, age range and worldwide record.', 'انقر أي أحفورة لترى وصفها وصورها ومداها الزمني وانتشارها العالمي.') + '</p>' + (taxaH || '<p class="small muted">' + t('No individual fossils matched the current filters.', 'لا توجد أحافير مفردة تطابق الفلاتر الحالية.') + '</p>');
    }).join('');
    $('#fSite').innerHTML = h; show('site');
    $('#fBackS').addEventListener('click', function () { if (hl) { map.removeLayer(hl); hl = null; } show('search'); });
  }

  /* ------------------------------------------------------------------ taxon card */
  var getJ = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  function wiki(name) {
    return getJ('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name.replace(/ /g, '_')) + '?redirect=true').then(function (en) {
      if (!en || en.type === 'disambiguation' || !en.extract) return null;
      var out = { en: en, ar: null }; if (!AR) return out;
      return getJ('https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=ar&format=json&origin=*&titles=' + encodeURIComponent(en.title)).then(function (j) {
        var pg = j.query && j.query.pages, k = pg && Object.keys(pg)[0], ll = k && pg[k].langlinks && pg[k].langlinks[0]; if (!ll) return out;
        return getJ('https://ar.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(ll['*'].replace(/ /g, '_'))).then(function (a) { if (a && a.extract) out.ar = a; return out; });
      }).catch(function () { return out; });
    }).catch(function () { return null; });
  }
  var IMGC = {};
  function photos(name, n, strict) {
    var key = name + '|' + (n || 12) + (strict ? 's' : ''); if (IMGC[key]) return IMGC[key];
    var q = function (qs) { return photos0(qs, n); };
    return (IMGC[key] = q('intitle:"' + name + '"').then(function (a) { return strict || a.length >= 3 ? a : q(name + ' fossil').then(function (b) { var seen = {}; return a.concat(b).filter(function (m) { if (seen[m.th]) return false; seen[m.th] = 1; return true; }).slice(0, n || 12); }); }));
  }
  function photos0(qs, n) {
    return (getJ('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=' + (n || 12) + '&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=640&format=json&origin=*&gsrsearch=' + encodeURIComponent(qs)).then(function (j) {
      var p = j.query ? j.query.pages : {}; return Object.keys(p).map(function (k) { return p[k]; }).sort(function (a, b) { return a.index - b.index; }).map(function (x) { var ii = x.imageinfo && x.imageinfo[0]; if (!ii || !/jpeg|png/.test(ii.mime)) return null; var md = ii.extmetadata || {}, strip = function (s) { return String(s && s.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); };
        return { th: ii.thumburl, big: ii.width > 1400 ? ii.thumburl.replace(/\/640px-/, '/1400px-') : ii.url, title: x.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' '), by: strip(md.Artist).slice(0, 80), lic: strip(md.LicenseShortName) }; }).filter(Boolean);
    }).catch(function () { return []; }));
  }
  function rangeSvg(first, last, extant) {
    var lim = first > 400 ? 538.8 : first > 250 ? 419.2 : first > 145 ? 251.9 : first > 66 ? 145 : first > 23 ? 66 : 23.03, W = 320, H = 54, X = function (v) { return 4 + (1 - v / lim) * (W - 8); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + (H + 18) + '" style="width:100%;height:auto;direction:ltr" role="img">';
    SH.ics.forEach(function (p) { if (p[2] >= lim) return; var x1 = X(Math.min(p[3], lim)), x2 = X(p[2]); s += '<rect x="' + x1 + '" y="0" width="' + (x2 - x1) + '" height="22" fill="' + p[4] + '" stroke="#555" stroke-width=".4"/>' + (x2 - x1 > 34 ? '<text x="' + (x1 + x2) / 2 + '" y="15" font-size="8.5" text-anchor="middle" fill="#111">' + E(pname(p)) + '</text>' : ''); });
    var a = X(Math.min(first, lim)), b = X(Math.max(0, last));
    s += '<rect x="' + a + '" y="28" width="' + Math.max(3, b - a) + '" height="10" rx="5" fill="#C9A227" stroke="#5c4a12" stroke-width=".6"/>' + (extant ? '<path d="M' + (b - 1) + ' 28 l7 5 -7 5z" fill="#C9A227"/>' : '') +
      '<text x="4" y="' + (H + 6) + '" font-size="9" fill="currentColor">' + SH.fmt(lim, 0) + ' Ma</text><text x="' + (W - 4) + '" y="' + (H + 6) + '" font-size="9" text-anchor="end" fill="currentColor">' + t('today', 'اليوم') + '</text></svg>';
    return s;
  }
  function clearWorld() { if (world) { map.removeLayer(world); world = null; } }

  function taxon(name, from) {
    if (!name) return; clearWorld(); cur.taxon = null;
    var back = from === 'site' ? backBtn(t('Back to the site', 'العودة إلى الموقع'), 'fBackT') : backBtn(t('Back to the results', 'العودة إلى النتائج'), 'fBackT');
    $('#fTaxon').innerHTML = back + '<div class="small muted" style="padding:24px 0">' + spin + t('Preparing the fossil card…', 'جارٍ إعداد بطاقة الأحفورة…') + '</div>'; show('taxon');
    var bk = function () { $('#fBackT').addEventListener('click', function () { clearWorld(); if (from === 'site' && cur.site) show('site'); else show('search'); }); }; bk();
    Promise.all([
      SH.getJSON(PB + 'taxa/single.json?vocab=pbdb&show=attr,app,class,ecospace,taphonomy,img,common,parent,size&name=' + encodeURIComponent(name), { timeout: 30000 }).then(function (j) { return (j.records || [])[0] || null; }).catch(function () { return null; }),
      wiki(name).then(function (w) { var gn = name.split(' ')[0]; if (w || gn === name) return w; return wiki(gn).then(function (w2) { if (w2) w2.genus = gn; return w2; }); }),
      photos(name).then(function (a) { var gn = name.split(' ')[0]; return a.length || gn === name ? a : photos(gn); })
    ]).then(function (r) {
      var x = r[0] || { taxon_name: name }, w = r[1], imgs = r[2], g = ginfo(name);
      var nm = x.accepted_name || x.taxon_name || name, first = +x.firstapp_max_ma, last = +x.lastapp_min_ma, ext = x.is_extant === 'extant';
      var wpic = w && (w.ar || w.en).thumbnail ? (w.ar || w.en) : null;
      if (wpic) imgs = [{ th: wpic.thumbnail.source, big: (wpic.originalimage && wpic.originalimage.source) || wpic.thumbnail.source, title: nm, by: '', lic: '' }].concat(imgs.filter(function (m) { return m.th !== wpic.thumbnail.source; }));
      var lad = [['phylum', x.phylum], ['class', x['class']], ['order', x.order], ['family', x.family], ['genus', x.genus]].filter(function (q) { return clean(q[1]); });
      cur.taxon = { name: nm, attr: x.taxon_attr || '', rank: x.taxon_rank, first: first, last: ext ? 0 : last, ext: ext, early: x.early_interval, late: x.late_interval, lad: lad, imgs: imgs, grp: g };
      var pf = isFinite(first) ? per(first, first) : null;
      var h = back + '<div class="fx-hd" style="margin-top:10px;' + grad(pf ? pf[4] : '#5a6a78') + '"><h2><i>' + E(nm) + '</i> <span style="font-weight:500;font-size:.8em;opacity:.85">' + E(x.taxon_attr || '') + '</span></h2><div class="pills">' + (x.taxon_rank ? '<span>' + E(tr(G.rank, x.taxon_rank)) + '</span>' : '') +
        (x.is_extant ? '<span>' + (ext ? t('still living', 'ما زال حياً') : t('extinct', 'منقرض')) + '</span>' : '') + (x.common_name ? '<span>' + E(x.common_name) + '</span>' : '') + (g ? '<span>' + E(AR ? g.ar : g.en) + '</span>' : '') + (isFinite(first) ? '<span class="ltr">' + ma(first) + '–' + (ext ? '0' : ma(last)) + ' Ma</span>' : '') + '</div></div>';
      if (imgs.length) h += '<div class="fx-hero" role="button" tabindex="0" data-lb="0" style="margin-top:12px;background-image:url(\'' + E(imgs[0].th) + '\')" aria-label="' + E(nm) + '"></div>';
      if (g) h += '<div style="margin-top:12px">' + groupCard(g, false) + '</div>';
      var wtxt = w ? (w.ar || w.en) : null;
      h += '<h3 class="fx-h" style="margin-top:16px">' + t('Description', 'الوصف') + '</h3>' + (wtxt ? '<p class="fx-sum" ' + (w.ar || !AR ? '' : 'dir="ltr" lang="en" style="text-align:left"') + '>' + E(wtxt.extract) + '</p>' + (w.genus || w.en.title.toLowerCase() !== name.toLowerCase() ? '<p class="fx-cap" style="margin-top:4px">' + t('No separate entry exists for this exact name; the text describes ', 'لا يوجد مدخل مستقل لهذا الاسم بعينه؛ النص يصف ') + '<i>' + E(w.genus || w.en.title) + '</i>.</p>' : '') : '<p class="small muted">' + t('No published description was found for this name yet; its classification, age range and record are given below.', 'لم يُعثر بعد على وصف منشور لهذا الاسم؛ وتجد أدناه تصنيفه ومداه الزمني وسجله.') + '</p>');
      if (lad.length) h += '<h3 class="fx-h" style="margin-top:16px">' + t('Classification', 'التصنيف') + '</h3><div class="fx-ladder" style="margin-top:8px">' + lad.map(function (q) { return '<span><em>' + E(tr(G.rank, q[0])) + ':</em> ' + E(q[1]) + (AR && G.cls[q[1]] ? ' <em>(' + E(G.cls[q[1]]) + ')</em>' : '') + '</span>'; }).join('<em>›</em>') + '</div>';
      if (isFinite(first)) h += '<h3 class="fx-h" style="margin-top:16px">' + t('When it lived', 'متى عاش') + '</h3><p class="small" style="margin:6px 0">' + t('First known: ', 'أول ظهور معروف: ') + '<b>' + E(x.early_interval || '') + '</b> <span class="ltr">(' + ma(first) + ' Ma)</span> · ' + (ext ? t('still living today', 'ما زال حياً حتى اليوم') : t('Last known: ', 'آخر ظهور معروف: ') + '<b>' + E(x.late_interval || '') + '</b> <span class="ltr">(' + ma(last) + ' Ma)</span>') + '</p>' + rangeSvg(first, ext ? 0 : last, ext) + '<p class="fx-cap">' + t('Range of the published fossil record; the true range may be slightly longer.', 'مدى السجل الأحفوري المنشور؛ وقد يكون المدى الحقيقي أطول قليلاً.') + '</p>';
      var eco = [[t('Life habit', 'نمط المعيشة'), x.life_habit], [t('Feeding', 'التغذية'), x.diet], [t('Movement', 'الحركة'), x.motility], [t('Habitat', 'الموطن'), x.taxon_environment], [t('Skeleton', 'تركيب الهيكل'), x.composition || x.composition1]].filter(function (q) { return q[1]; });
      if (eco.length) h += '<h3 class="fx-h" style="margin-top:16px">' + t('How it lived', 'كيف عاش') + '</h3><div class="fx-facts" style="margin-top:8px">' + eco.map(function (q) { return '<div class="fx-fact"><span>' + q[0] + '</span><b>' + E(trTokens(G.eco, q[1])) + '</b></div>'; }).join('') + '</div><p class="fx-cap" style="margin-top:6px">' + t('Mode of life compiled from the literature, sometimes inferred from close relatives.', 'نمط الحياة مجموع من المنشورات العلمية، وقد يُستنتج أحياناً من الأقارب.') + '</p>';
      if (imgs.length > 1) h += '<h3 class="fx-h" style="margin-top:16px">' + t('Photographs', 'صور الأحفورة') + ' (' + imgs.length + ')</h3><div class="fx-gal" style="margin-top:8px">' + imgs.map(function (m, i) { return '<button type="button" data-lb="' + i + '" aria-label="' + E(m.title) + '" style="background-image:url(\'' + E(m.th) + '\')"></button>'; }).join('') + '</div><p class="fx-cap" style="margin-top:6px">' + t('Open any photograph to enlarge it and download it as a captioned plate. Photographs may include closely related specimens.', 'افتح أي صورة لتكبيرها وتنزيلها لوحةً موثّقة. قد تشمل الصور عينات قريبة الصلة.') + '</p>';
      h += '<h3 class="fx-h" style="margin-top:16px">' + t('Worldwide record', 'الانتشار العالمي') + '</h3><div id="fWBox"><p class="small muted">' + spin + t('Mapping every published occurrence…', 'جارٍ رسم كل الظهورات المنشورة…') + '</p></div>';
      $('#fTaxon').innerHTML = h; bk();
      worldwide(nm);
    });
  }

  /* worldwide record: dotted world map + time distribution, both downloadable */
  function worldwide(nm) {
    SH.getJSON(PB + 'occs/list.json?vocab=pbdb&show=coords,paleoloc&limit=8000&base_name=' + encodeURIComponent(nm), { timeout: 45000 }).then(function (j) {
      var R = (j.records || []).map(function (r) { return { lat: +r.lat, lon: +r.lng, max: +r.max_ma, min: +r.min_ma, plat: r.paleolat === '' || r.paleolat == null ? null : +r.paleolat }; }).filter(function (r) { return isFinite(r.lat) && isFinite(r.lon); });
      if (!$('#fWBox')) return;
      if (!R.length) { $('#fWBox').innerHTML = '<p class="small muted">' + t('No mapped occurrences are published for this name.', 'لا توجد ظهورات منشورة مرسومة لهذا الاسم.') + '</p>'; return; }
      var cc = {}; R.forEach(function (r) { cc[Math.round(r.lat) + ',' + Math.round(r.lon)] = 1; });
      var P = {}; R.forEach(function (r) { var p = per(r.max, r.min)[0]; P[p] = (P[p] || 0) + 1; }); var pk = Object.keys(P).sort(function (a, b) { return P[b] - P[a]; }), pP = SH.ics.filter(function (p) { return p[0] === pk[0]; })[0];
      var tro = R.filter(function (r) { return r.plat != null; }), inT = tro.filter(function (r) { return Math.abs(r.plat) <= 23.5; }).length;
      $('#fWBox').innerHTML = '<p class="small" style="margin:6px 0;line-height:1.8">' + t('Known from ', 'عُرفت من ') + '<b>' + SH.fmt(R.length, 0) + '</b>' + t(' published occurrences in about ', ' ظهوراً منشوراً في نحو ') + '<b>' + Object.keys(cc).length + '</b>' + t(' one-degree cells worldwide, most of them from the ', ' خلية بمساحة درجة واحدة حول العالم، أغلبها من عصر ') + '<b>' + (pP ? pname(pP) : '') + '</b>' + (tro.length ? t('. When alive, ', '. وعند حياتها كانت ') + '<b>' + pct(inT, tro.length) + '%</b>' + t(' of them lay within the tropics.', ' منها ضمن المنطقة المدارية.') : '.') + '</p>' +
        '<div class="fx-world zoom" data-zoom="fWMap"><svg id="fWMap" viewBox="0 0 1000 560" role="img" aria-label="world"></svg></div><div class="fx-dl" style="margin-top:8px"><span class="lbl">' + t('Distribution map', 'خريطة الانتشار') + '</span>' + dlBtns('data-wm', '1') + '<button type="button" class="btn btn-ink btn-xs" id="fWOn">' + t('Show on the main map', 'اعرضها على الخريطة الرئيسية') + '</button></div>' +
        '<div class="fx-world zoom" data-zoom="fWTime" style="margin-top:12px;background:#fff"><svg id="fWTime" viewBox="0 0 1000 380" role="img" aria-label="time"></svg></div><div class="fx-dl" style="margin-top:8px"><span class="lbl">' + t('Time distribution', 'التوزيع الزمني') + '</span>' + dlBtns('data-wt', '1') + '</div>' +
        '<p class="fx-cap" style="margin-top:6px">' + t('The map shows where the fossil has been found, coloured by geological period; the chart shows in which intervals it is most often found.', 'تبين الخريطة أماكن العثور على الأحفورة ملونة حسب العصر الجيولوجي، ويبين المخطط الفترات التي توجد فيها أكثر من غيرها.') + '</p>';
      worldSvg($('#fWMap'), nm, R); timeSvg($('#fWTime'), nm, R);
      $('#fWOn').addEventListener('click', function () { clearWorld(); world = L.layerGroup().addTo(map); var seen = {};
        R.forEach(function (r) { var k = r.lat.toFixed(1) + ',' + r.lon.toFixed(1); if (seen[k]) return; seen[k] = 1; L.circleMarker([r.lat, r.lon], { radius: 3.5, weight: .6, color: '#111', fillColor: per(r.max, r.min)[4], fillOpacity: .9, interactive: false }).addTo(world); });
        map.fitBounds(L.latLngBounds(R.map(function (r) { return [r.lat, r.lon]; })).pad(.1), { maxZoom: 6 }); });
    }).catch(function () { if ($('#fWBox')) $('#fWBox').innerHTML = '<p class="small muted">' + t('The worldwide record could not be loaded now. Try again later.', 'تعذر تحميل الانتشار العالمي الآن. حاول لاحقاً.') + '</p>'; });
  }
  function worldSvg(svg, nm, R) {
    var S2 = SH.svgB(svg), W = 1000, X0 = 30, Y0 = 70, MW = 760, MH = 380, px = function (lo) { return X0 + (lo + 180) / 360 * MW; }, py = function (la) { return Y0 + (90 - la) / 180 * MH; };
    S2.add('rect', { x: 0, y: 0, width: W, height: 560, fill: '#0D1720' });
    S2.text(X0, 36, 'Worldwide record of ', { fill: '#E9EEF2', 'font-size': 20, 'font-weight': 700, 'font-family': PF });
    S2.add('text', { x: X0 + 196, y: 36, fill: '#F2C95B', 'font-size': 20, 'font-weight': 700, 'font-style': 'italic', 'font-family': PF }, nm);
    S2.text(X0, 58, SH.fmt(R.length, 0) + ' published occurrences · present-day coordinates', { fill: '#9AA6B1', 'font-size': 13, 'font-family': PF });
    // graticule
    for (var lo = -180; lo <= 180; lo += 30) S2.line(px(lo), Y0, px(lo), Y0 + MH, { stroke: 'rgba(255,255,255,.07)' });
    for (var la = -90; la <= 90; la += 30) S2.line(X0, py(la), X0 + MW, py(la), { stroke: la === 0 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)', 'stroke-dasharray': la === 0 ? '4 4' : null });
    [23.44, -23.44].forEach(function (la) { S2.line(X0, py(la), X0 + MW, py(la), { stroke: 'rgba(224,123,106,.35)', 'stroke-dasharray': '2 5' }); });
    if (LAND) { var dd = ''; for (var i = 0; i < LAND.length; i += 2) dd += 'M' + px(LAND[i + 1]).toFixed(1) + ' ' + py(LAND[i]).toFixed(1) + 'h1.6v1.6h-1.6z'; S2.path(dd, { fill: 'rgba(214,190,130,.55)' }); }
    var cells = {}; R.forEach(function (r) { var k = Math.round(r.lat) + ',' + Math.round(r.lon); var c = cells[k] = cells[k] || { lat: Math.round(r.lat), lon: Math.round(r.lon), n: 0, P: {} }; c.n++; var p = per(r.max, r.min); c.P[p[0]] = (c.P[p[0]] || 0) + 1; c.col = c.col || p[4]; });
    var used = {};
    Object.keys(cells).map(function (k) { return cells[k]; }).sort(function (a, b) { return b.n - a.n; }).forEach(function (c) { var pk = Object.keys(c.P).sort(function (a, b) { return c.P[b] - c.P[a]; })[0], p = SH.ics.filter(function (q) { return q[0] === pk; })[0] || ['?', '?', 0, 0, '#ccc']; used[p[0]] = p;
      S2.circle(px(c.lon), py(c.lat), Math.min(9, 2.6 + Math.sqrt(c.n) * .9), { fill: p[4], stroke: '#0D1720', 'stroke-width': .8, 'fill-opacity': .95 }); });
    S2.add('rect', { x: X0, y: Y0, width: MW, height: MH, fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1 });
    [[-120, '120°W'], [-60, '60°W'], [0, '0°'], [60, '60°E'], [120, '120°E']].forEach(function (q) { S2.text(px(q[0]), Y0 + MH + 18, q[1], { fill: '#9AA6B1', 'font-size': 11, 'text-anchor': 'middle', 'font-family': PF }); });
    [[60, '60°N'], [30, '30°N'], [0, '0°'], [-30, '30°S'], [-60, '60°S']].forEach(function (q) { S2.text(X0 + MW + 8, py(q[0]) + 4, q[1], { fill: '#9AA6B1', 'font-size': 11, 'font-family': PF }); });
    // north arrow
    var NX = X0 + MW - 26, NY = Y0 + 16; S2.path('M' + NX + ' ' + NY + 'l-9 26l9 -6z', { fill: '#E9EEF2' }); S2.path('M' + NX + ' ' + NY + 'l9 26l-9 -6z', { fill: 'none', stroke: '#E9EEF2', 'stroke-width': 1 }); S2.text(NX, NY - 4, 'N', { fill: '#E9EEF2', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'middle', 'font-family': PF });
    // legend
    var LX = X0 + MW + 58, ly = Y0 + 6; S2.text(LX, ly, 'LEGEND', { fill: '#E9EEF2', 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1, 'font-family': PF }); ly += 20; S2.text(LX, ly, 'Main period of the cell', { fill: '#9AA6B1', 'font-size': 11, 'font-family': PF }); ly += 14;
    SH.ics.filter(function (p) { return used[p[0]]; }).forEach(function (p) { S2.circle(LX + 7, ly + 6, 6, { fill: p[4], stroke: '#0D1720' }); S2.text(LX + 20, ly + 10, p[0], { fill: '#E9EEF2', 'font-size': 12, 'font-family': PF }); ly += 20; });
    ly += 8; S2.text(LX, ly, 'Size = occurrences', { fill: '#9AA6B1', 'font-size': 11, 'font-family': PF }); ly += 14; S2.text(LX, ly, 'per 1° cell', { fill: '#9AA6B1', 'font-size': 11, 'font-family': PF }); ly += 8;
    [1, 10, 50].forEach(function (n) { var r = Math.min(9, 2.6 + Math.sqrt(n) * .9); S2.circle(LX + 9, ly + 12, r, { fill: 'none', stroke: '#E9EEF2' }); S2.text(LX + 24, ly + 16, String(n), { fill: '#E9EEF2', 'font-size': 11, 'font-family': PF }); ly += 22; });
    ly += 6; S2.line(LX, ly + 6, LX + 24, ly + 6, { stroke: 'rgba(224,123,106,.8)', 'stroke-dasharray': '2 5' }); S2.text(LX + 30, ly + 10, 'Tropics today', { fill: '#E9EEF2', 'font-size': 11, 'font-family': PF });
    S2.text(X0, 540, 'Equirectangular projection, WGS 84. Geological ages after ICS (2023).', { fill: '#6F7C88', 'font-size': 11, 'font-family': PF });
  }
  function timeSvg(svg, nm, R) {
    var S2 = SH.svgB(svg), W = 1000, X0 = 70, X1 = 970, Y0 = 70, Y1 = 290;
    var mids = R.map(function (r) { return (r.max + r.min) / 2; }), tmax = Math.max.apply(null, R.map(function (r) { return r.max; })), tmin = Math.min.apply(null, R.map(function (r) { return r.min; }));
    var span = Math.max(5, tmax - tmin), lo = Math.max(0, tmin - span * .08), hi = tmax + span * .08, bw = span > 200 ? 10 : span > 80 ? 5 : span > 25 ? 2 : 1, nb = Math.ceil((hi - lo) / bw), bins = new Array(nb).fill(0);
    mids.forEach(function (m) { var i = Math.min(nb - 1, Math.floor((hi - m) / bw)); if (i >= 0) bins[i]++; });
    var mx = Math.max.apply(null, bins) || 1, X = function (age) { return X0 + (hi - age) / (hi - lo) * (X1 - X0); }, Yv = function (v) { return Y1 - v / mx * (Y1 - Y0); };
    S2.add('rect', { x: 0, y: 0, width: W, height: 380, fill: '#fff' });
    S2.text(X0, 32, 'Time distribution of ', { fill: INK, 'font-size': 18, 'font-weight': 700, 'font-family': PF }); S2.add('text', { x: X0 + 178, y: 32, fill: '#9A7631', 'font-size': 18, 'font-weight': 700, 'font-style': 'italic', 'font-family': PF }, nm);
    S2.text(X0, 52, 'Occurrences per ' + bw + '-million-year interval (mid-point age of each record)', { fill: MUT, 'font-size': 12, 'font-family': PF });
    for (var k = 0; k <= 4; k++) { var v = mx * k / 4, y = Yv(v); S2.line(X0, y, X1, y, { stroke: '#E6E6E6' }); S2.text(X0 - 8, y + 4, String(Math.round(v)), { fill: MUT, 'font-size': 11, 'text-anchor': 'end', 'font-family': PF }); }
    bins.forEach(function (n, i) { if (!n) return; var a = hi - i * bw, b = a - bw, p = per(a, b); S2.add('rect', { x: X(a) + .5, y: Yv(n), width: Math.max(1, X(b) - X(a) - 1), height: Y1 - Yv(n), fill: p[4], stroke: '#333', 'stroke-width': .5 }); });
    // ICS strip
    SH.ics.forEach(function (p) { var a = Math.min(p[3], hi), b = Math.max(p[2], lo); if (a <= b) return; var xa = X(a), xb = X(b); S2.add('rect', { x: xa, y: Y1 + 6, width: xb - xa, height: 26, fill: p[4], stroke: '#444', 'stroke-width': .6 }); if (xb - xa > 46) S2.text((xa + xb) / 2, Y1 + 23, p[0], { fill: '#111', 'font-size': 11, 'text-anchor': 'middle', 'font-family': PF }); });
    var st = (hi - lo) > 300 ? 50 : (hi - lo) > 120 ? 20 : (hi - lo) > 50 ? 10 : (hi - lo) > 20 ? 5 : 2;
    for (var a2 = Math.ceil(lo / st) * st; a2 <= hi; a2 += st) { var x = X(a2); S2.line(x, Y1 + 32, x, Y1 + 38, { stroke: INK }); S2.text(x, Y1 + 52, String(a2), { fill: INK, 'font-size': 11, 'text-anchor': 'middle', 'font-family': PF }); }
    S2.text((X0 + X1) / 2, Y1 + 74, 'Age (Ma)   ← older · younger →', { fill: INK, 'font-size': 12, 'text-anchor': 'middle', 'font-family': PF });
    S2.add('text', { x: 18, y: (Y0 + Y1) / 2, fill: INK, 'font-size': 12, 'text-anchor': 'middle', transform: 'rotate(-90 18 ' + (Y0 + Y1) / 2 + ')', 'font-family': PF }, 'Occurrences');
    S2.line(X0, Y1, X1, Y1, { stroke: INK }); S2.line(X0, Y0, X0, Y1, { stroke: INK });
  }

  /* ------------------------------------------------------------------ lightbox and photographic plates */
  var LB = { i: 0 }; document.body.appendChild($('#fLb'));
  function lbOpen(i) { if (!cur.taxon || !cur.taxon.imgs.length) return; LB.i = (i + cur.taxon.imgs.length) % cur.taxon.imgs.length; var m = cur.taxon.imgs[LB.i]; $('#fLbImg').src = m.big || m.th; $('#fLbImg').alt = m.title;
    $('#fLbCap').innerHTML = '<b><i>' + E(cur.taxon.name) + '</i></b> · ' + (LB.i + 1) + ' / ' + cur.taxon.imgs.length + (m.by || m.lic ? '<br><span style="opacity:.75">' + t('Photo: ', 'الصورة: ') + E([m.by, m.lic].filter(Boolean).join(' · ')) + '</span>' : ''); $('#fLb').hidden = false; }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-lb]'); if (b && b.closest('#fTaxon')) lbOpen(+b.getAttribute('data-lb')); });
  document.addEventListener('keydown', function (e) { if ($('#fLb').hidden) { var b = e.target.closest && e.target.closest('[data-lb]'); if (b && e.key === 'Enter') lbOpen(+b.getAttribute('data-lb')); return; } if (e.key === 'Escape') $('#fLb').hidden = true; if (e.key === 'ArrowRight') lbOpen(LB.i + (AR ? -1 : 1)); if (e.key === 'ArrowLeft') lbOpen(LB.i + (AR ? 1 : -1)); });
  $('#fLbX').addEventListener('click', function () { $('#fLb').hidden = true; });
  $('#fLb').addEventListener('click', function (e) { if (e.target === this || e.target.classList.contains('st')) this.hidden = true; });
  $('#fLbP').addEventListener('click', function () { lbOpen(LB.i - 1); }); $('#fLbN').addEventListener('click', function () { lbOpen(LB.i + 1); });
  function loadCors(src) { return new Promise(function (res, rej) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  function wrapTxt(x, s, maxW) { var words = String(s).split(' '), lines = [], cur0 = ''; words.forEach(function (w) { var tst = cur0 ? cur0 + ' ' + w : w; if (x.measureText(tst).width > maxW && cur0) { lines.push(cur0); cur0 = w; } else cur0 = tst; }); if (cur0) lines.push(cur0); return lines; }
  function plate(fmt, btn) {
    var tx = cur.taxon, m = tx.imgs[LB.i]; busyBtn(btn, true);
    loadCors(m.big || m.th).catch(function () { return loadCors(m.th); }).then(function (im) {
      var W = 1600, pad = 60, k = Math.min((W - 2 * pad) / im.naturalWidth, 1100 / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k, cv = document.createElement('canvas'), x = cv.getContext('2d');
      x.font = '600 26px ' + PF; var info = [], pf = isFinite(tx.first) ? per(tx.first, tx.first) : null;
      if (tx.grp) info.push(tx.grp.en); if (tx.rank) info.push(tx.rank.charAt(0).toUpperCase() + tx.rank.slice(1));
      var age = isFinite(tx.first) ? 'Range: ' + (tx.early || '') + (tx.ext ? ' – Recent' : ' – ' + (tx.late || '')) + ' (' + ma(tx.first) + '–' + (tx.ext ? '0' : ma(tx.last)) + ' Ma)' : '';
      var cls = uniq(tx.lad.map(function (q) { return q[1]; })).join(' › '), credit = m.by || m.lic ? 'Photograph: ' + [m.by, m.lic].filter(Boolean).join(' · ') : '';
      var lines = [].concat(age ? [age] : [], cls ? wrapTxt(x, 'Classification: ' + cls, W - 2 * pad) : [], credit ? wrapTxt(x, credit, W - 2 * pad) : []);
      var H = pad + 70 + 20 + ih + 40 + lines.length * 38 + pad; cv.width = W; cv.height = H;
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = pf ? pf[4] : '#C9A227'; x.fillRect(0, 0, 14, H);
      x.fillStyle = INK; x.font = 'italic 800 46px ' + PF; x.textBaseline = 'alphabetic'; x.fillText(tx.name, pad, pad + 40); var nw = x.measureText(tx.name).width;
      x.font = '500 26px ' + PF; x.fillStyle = MUT; x.fillText((tx.attr ? tx.attr + '   ' : '') + info.join(' · '), pad + nw + 18, pad + 40);
      x.fillStyle = '#F4F2EC'; x.fillRect(pad, pad + 70, W - 2 * pad, ih + 20); x.drawImage(im, (W - iw) / 2, pad + 80, iw, ih);
      x.strokeStyle = '#D9D4C7'; x.lineWidth = 2; x.strokeRect(pad, pad + 70, W - 2 * pad, ih + 20);
      x.font = '600 26px ' + PF; x.fillStyle = INK; lines.forEach(function (l, i) { x.fillStyle = i === lines.length - 1 && credit ? MUT : INK; x.fillText(l, pad, pad + 90 + ih + 50 + i * 38); });
      return SH.exportCanvas(cv, 'shandal-fossil-' + tx.name.replace(/\s+/g, '_') + '-' + (LB.i + 1), fmt);
    }).catch(function () { SH.toast(t('This photograph cannot be turned into a plate; try another one.', 'تعذر تحويل هذه الصورة إلى لوحة؛ جرّب صورة أخرى.'), 'warn'); }).then(function () { busyBtn(btn, false); });
  }
  $$('[data-plate]').forEach(function (b) { b.addEventListener('click', function () { plate(b.getAttribute('data-plate'), b); }); });

  /* ------------------------------------------------------------------ gallery of the area */
  var GOBS = null;
  function gallery() {
    var cnt = {}, info = {}; O.forEach(function (o) { var n = o.name; if (!n) return; cnt[n] = (cnt[n] || 0) + 1; if (!info[n]) info[n] = o; else if (!info[n].img && o.img) info[n].img = o.img; });
    var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 36); $('#nGl').textContent = top.length;
    $('#fGal').innerHTML = top.map(function (n) { var o = info[n], p = per(o.max_ma, o.min_ma);
      return '<button type="button" class="fx-gi" data-tx="' + E(n) + '"><div class="im' + (o.img ? ' sil' : '') + '" data-ph="' + E(n) + '"' + (o.img ? ' style="background-image:url(\'' + thumb(o.img) + '\')"' : '') + '><span class="ag" style="background:' + p[4] + '">' + pname(p) + '</span></div><div class="tx"><i>' + E(n) + '</i><span>' + E(gname(grp(o))) + ' · ' + cnt[n] + t(' records', ' سجل') + '</span></div></button>'; }).join('');
    if (GOBS) GOBS.disconnect(); GOBS = null; if (curTab === 'gl') galObserve();
  }
  function galObserve() {
    if (GOBS || !('IntersectionObserver' in window)) return; var q = [], busy = 0;
    var pump = function () { while (busy < 3 && q.length) { var el = q.shift(); busy++; (function (el) { photos(el.getAttribute('data-ph'), 3, true).then(function (a) { if (a[0]) { el.classList.remove('sil'); el.style.backgroundImage = 'url(\'' + a[0].th + '\')'; } }).catch(function () {}).then(function () { busy--; pump(); }); })(el); } };
    GOBS = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !e.target._q) { e.target._q = 1; q.push(e.target); GOBS.unobserve(e.target); } }); pump(); }, { rootMargin: '200px' });
    $$('#fGal [data-ph]').forEach(function (el) { GOBS.observe(el); });
  }

  /* ------------------------------------------------------------------ data table */
  var TB = { rows: [], cols: [], sort: null, dir: 1, q: '', page: 0, size: 100 };
  function rowsOf(en) {
    return O.map(function (o, i) { var c = SITES[o.cid] || {}, p = per(o.max_ma, o.min_ma); return [i + 1, o.name, gname(grp(o), en), o.family, en || !AR ? (o.rank || '') : tr(G.rank, o.rank), c.collection_name || '', c.formation || '', lith(c, en), c.environment ? (en ? c.environment : tr(G.env, c.environment)) : '', [o.early, o.late !== o.early ? o.late : ''].filter(Boolean).join(' – '), pname(p, en), o.max_ma, o.min_ma, +o.lat.toFixed(4), +o.lon.toFixed(4), c.paleolat !== '' && c.paleolat != null ? +(+c.paleolat).toFixed(2) : '', c.cc ? country(c.cc, en) : '', c.primary_reference || '', p[4]]; });
  }
  var HEAD = function (en) { return [L2('No.', 'م', en), L2('Fossil', 'الأحفورة', en), L2('Group', 'المجموعة', en), L2('Family', 'العائلة', en), L2('Rank', 'الرتبة', en), L2('Site', 'الموقع', en), L2('Formation', 'التكوين', en), L2('Rock type', 'نوع الصخر', en), L2('Environment', 'البيئة الترسيبية', en), L2('Interval', 'الفترة', en), L2('Period', 'العصر', en), L2('Max age (Ma)', 'العمر الأقصى (م.س)', en), L2('Min age (Ma)', 'العمر الأدنى (م.س)', en), L2('Latitude', 'خط العرض', en), L2('Longitude', 'خط الطول', en), L2('Palaeolatitude', 'خط العرض القديم', en), L2('Country', 'الدولة', en), L2('Reference', 'المرجع', en)]; };
  function table() { TB.rows = rowsOf(false); TB.cols = HEAD(false); TB.page = 0; renderTbl(); }
  function tblFiltered() { var q = TB.q.toLowerCase(), r = q ? TB.rows.filter(function (x) { return x.slice(0, 18).join(' ').toLowerCase().indexOf(q) > -1; }) : TB.rows.slice(); if (TB.sort != null) { var k = TB.sort, d = TB.dir; r.sort(function (a, b) { var x = a[k], y = b[k]; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * d; }); } return r; }
  function renderTbl() {
    var r = tblFiltered(), np = Math.max(1, Math.ceil(r.length / TB.size)); TB.page = Math.min(TB.page, np - 1); var pg = r.slice(TB.page * TB.size, (TB.page + 1) * TB.size);
    $('#fTbl').innerHTML = '<thead><tr>' + TB.cols.map(function (h, i) { return '<th data-k="' + i + '"' + (TB.sort === i ? ' data-dir="' + (TB.dir > 0 ? 'asc' : 'desc') + '"' : '') + '>' + E(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      pg.map(function (x) { return '<tr>' + x.slice(0, 18).map(function (v, i) { return '<td' + (i >= 11 && i <= 15 ? ' class="ltr"' : '') + (i === 17 ? ' class="wr" dir="ltr" title="' + E(v) + '"' : '') + '>' + (i === 1 ? '<i>' + E(v) + '</i>' : i === 10 ? '<span class="sw" style="background:' + x[18] + '"></span>' + E(v) : E(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
    $('#fPg').innerHTML = np > 1 ? '<button class="btn btn-line btn-xs" type="button" data-pg="-1"' + (TB.page ? '' : ' disabled') + '>' + ARR + '</button><span>' + t('Page ', 'الصفحة ') + (TB.page + 1) + t(' of ', ' من ') + np + ' · ' + SH.fmt(r.length, 0) + t(' rows', ' صفاً') + '</span><button class="btn btn-line btn-xs" type="button" data-pg="1"' + (TB.page < np - 1 ? '' : ' disabled') + '>' + FWD + '</button>' : '<span>' + SH.fmt(r.length, 0) + t(' rows', ' صفاً') + '</span>';
  }
  $('#fTbl').addEventListener('click', function (e) { var th = e.target.closest('th[data-k]'); if (!th) return; var k = +th.getAttribute('data-k'); if (TB.sort === k) TB.dir = -TB.dir; else { TB.sort = k; TB.dir = 1; } renderTbl(); });
  $('#fPg').addEventListener('click', function (e) { var b = e.target.closest('[data-pg]'); if (!b) return; TB.page += +b.getAttribute('data-pg'); renderTbl(); });
  $('#fQ').addEventListener('input', function () { TB.q = this.value.trim(); TB.page = 0; renderTbl(); });
  var stamp = function () { return AREA ? AREA.s.toFixed(1) + '_' + AREA.w.toFixed(1) + '_' + AREA.n.toFixed(1) + '_' + AREA.e.toFixed(1) : 'area'; };
  $('#fCsv').addEventListener('click', function () { var en = !AR; SH.csv('shandal-fossil-records_' + stamp() + '.csv', [HEAD(en)].concat(rowsOf(en).map(function (r) { return r.slice(0, 18); }))); });
  $('#fGeo').addEventListener('click', function () { SH.json('shandal-fossil-sites_' + stamp() + '.geojson', { type: 'FeatureCollection', features: S.map(function (c) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { site_no: c.collection_no, name: c.collection_name, formation: c.formation, lithology: lithList(c).join('; '), environment: c.environment, early_interval: c.early_interval, late_interval: c.late_interval, max_ma: c.max_ma, min_ma: c.min_ma, period: per(c.max_ma, c.min_ma)[0], paleolat: c.paleolat, paleolng: c.paleolng, fossils: c.taxa.length, taxa: uniq(c.taxa.map(function (o) { return o.name; })).join('; '), reference: c.primary_reference } }; }) }); });
  $('#fXls').addEventListener('click', function () {
    var en = !AR, sites = S.slice().sort(function (a, b) { return b.taxa.length - a.taxa.length; }).map(function (c, i) { var p = per(c.max_ma, c.min_ma); return [i + 1, c.collection_name, c.formation || '', c.geological_group || '', lith(c, en), c.environment ? (en ? c.environment : tr(G.env, c.environment)) : '', ageTxt(c), pname(p, en), c.max_ma, c.min_ma, +c.lat.toFixed(5), +c.lng.toFixed(5), c.paleolat !== '' && c.paleolat != null ? +(+c.paleolat).toFixed(2) : '', c.taxa.length, uniq(c.taxa.map(function (o) { return o.name; })).join(', '), c.cc ? country(c.cc, en) : '', c.primary_reference || '']; });
    var sh = [L2('No.', 'م', en), L2('Site', 'الموقع', en), L2('Formation', 'التكوين', en), L2('Group', 'المجموعة الصخرية', en), L2('Rock type', 'نوع الصخر', en), L2('Environment', 'البيئة الترسيبية', en), L2('Age', 'العمر', en), L2('Period', 'العصر', en), L2('Max age (Ma)', 'العمر الأقصى (م.س)', en), L2('Min age (Ma)', 'العمر الأدنى (م.س)', en), L2('Latitude', 'خط العرض', en), L2('Longitude', 'خط الطول', en), L2('Palaeolatitude', 'خط العرض القديم', en), L2('Fossils', 'عدد الأحافير', en), L2('Fossils found', 'الأحافير الموجودة', en), L2('Country', 'الدولة', en), L2('Reference', 'المرجع', en)];
    xlsx('shandal-fossils_' + stamp() + '.xlsx', [{ name: L2('Fossil records', 'السجلات الأحفورية', en), head: HEAD(en), rows: rowsOf(en).map(function (r) { return r.slice(0, 18); }), widths: [6, 26, 18, 18, 10, 34, 20, 22, 22, 22, 14, 12, 12, 11, 11, 13, 14, 60] }, { name: L2('Sites', 'المواقع', en), head: sh, rows: sites, widths: [6, 36, 20, 18, 22, 22, 24, 14, 12, 12, 11, 11, 13, 9, 60, 14, 60] }]);
  });

  /* minimal XLSX writer (stored ZIP, inline strings, bold header, frozen first row, RTL in Arabic) */
  function xlsx(name, sheets) {
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); };
    var col = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
    var cell = function (v, r, c, st) { var ref = col(c) + r; if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (st ? ' s="' + st + '"' : '') + '><v>' + v + '</v></c>'; return '<c r="' + ref + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t xml:space="preserve">' + esc(v == null ? '' : v) + '</t></is></c>'; };
    var files = [];
    files.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>']);
    files.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
    files.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(s.name).slice(0, 31) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>']);
    files.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
    files.push(['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B232B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD9D4C7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs></styleSheet>']);
    sheets.forEach(function (s, i) {
      var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (AR ? ' rightToLeft="1"' : '') + '><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + s.head.map(function (h, j) { return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + ((s.widths && s.widths[j]) || 16) + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>';
      x += '<row r="1" ht="22" customHeight="1">' + s.head.map(function (h, j) { return cell(h, 1, j, 1); }).join('') + '</row>';
      s.rows.forEach(function (r, k) { x += '<row r="' + (k + 2) + '">' + r.map(function (v, j) { return cell(v, k + 2, j, 2); }).join('') + '</row>'; });
      x += '</sheetData><autoFilter ref="A1:' + col(s.head.length - 1) + (s.rows.length + 1) + '"/></worksheet>';
      files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', x]);
    });
    SH.download(name, zip(files), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  var CRC = (function () { var c, tb = []; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], cd = [], off = 0;
    var u16 = function (v) { return [v & 255, v >> 8 & 255]; }, u32 = function (v) { return [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255]; };
    files.forEach(function (f) { var nm = enc.encode(f[0]), data = enc.encode(f[1]), c = crc32(data);
      var lh = new Uint8Array([].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(data.length), u32(data.length), u16(nm.length), u16(0)));
      parts.push(lh, nm, data);
      cd.push(new Uint8Array([].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(data.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += lh.length + nm.length + data.length; });
    var cdl = cd.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length), u32(cdl), u32(off), u16(0)));
    return new Blob(parts.concat(cd, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ------------------------------------------------------------------ map sheets (area and single site) */
  function baseMap(b, cw, ch) {
    var z = Math.max(2, Math.min(15, Math.round(Math.log2(360 * cw / (256 * (b.e - b.w)))))), n = Math.pow(2, z), X = function (lo) { return (lo + 180) / 360 * n; }, Y = function (la) { var r = SH.rad(la); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n; }, LA = function (yy) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI; };
    var x0 = Math.floor(X(b.w)), x1 = Math.floor(X(b.e)), y0 = Math.floor(Y(b.n)), y1 = Math.floor(Y(b.s)); if ((x1 - x0 + 1) * (y1 - y0 + 1) > 140) return Promise.resolve(null);
    var mk = function (svc) { var c = document.createElement('canvas'); c.width = cw; c.height = ch; var g = c.getContext('2d'), jobs = []; if (svc.indexOf('Base') > -1) { g.fillStyle = '#EDEDEA'; g.fillRect(0, 0, cw, ch); }
      for (var tx0 = x0; tx0 <= x1; tx0++) for (var ty = y0; ty <= y1; ty++) (function (tx1, ty1) { jobs.push(new Promise(function (res) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { var l0 = tx1 / n * 360 - 180, l1 = (tx1 + 1) / n * 360 - 180, qx = function (l) { return (l - b.w) / (b.e - b.w) * cw; }, qy = function (a) { return (b.n - a) / (b.n - b.s) * ch; }; for (var r = 0; r < 16; r++) { var Y0p = qy(LA(ty1 + r / 16)), Y1p = qy(LA(ty1 + (r + 1) / 16)); g.drawImage(im, 0, r * 16, 256, 16, qx(l0), Y0p, qx(l1) - qx(l0), Y1p - Y0p + .5); } res(); }; im.onerror = function () { res(); }; im.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/' + svc + '/MapServer/tile/' + z + '/' + ty1 + '/' + tx1; })); })(tx0, ty);
      return Promise.all(jobs).then(function () { return c; }); };
    return Promise.all([mk('World_Light_Gray_Base'), mk('World_Light_Gray_Reference')]).then(function (a) { var o = document.createElement('canvas'); o.width = cw; o.height = ch; var x = o.getContext('2d'); x.drawImage(a[0], 0, 0); x.drawImage(a[1], 0, 0); try { return o.toDataURL('image/jpeg', .9); } catch (e) { return null; } }).catch(function () { return null; });
  }
  function dms(v, ax) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m + '′' + (ax === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); }
  /* frame, graticule, north arrow and scale bar for a map panel; returns projection helpers */
  function mapFrame(S2, b, X0, Y0, PW, PH, kx, nx, ny) {
    var tx = function (x, y, s, a) { return S2.text(x, y, s, Object.assign({ fill: INK, 'font-size': 12, direction: 'ltr', 'font-family': PF }, a || {})); };
    S2.add('rect', { x: X0, y: Y0, width: PW, height: PH, fill: 'none', stroke: INK, 'stroke-width': 1.6 }); S2.add('rect', { x: X0 - 6, y: Y0 - 6, width: PW + 12, height: PH + 12, fill: 'none', stroke: INK, 'stroke-width': .8 });
    var px = function (lo) { return X0 + (lo - b.w) / (b.e - b.w) * PW; }, py = function (la) { return Y0 + (b.n - la) / (b.n - b.s) * PH; };
    var gs = [1 / 60, 2 / 60, 5 / 60, 10 / 60, .25, .5, 1, 2, 5, 10], st = gs.filter(function (g) { return (b.e - b.w) / g <= 6; })[0] || 10;
    for (var lo = Math.ceil(b.w / st) * st; lo <= b.e + 1e-9; lo += st) { var X = px(lo); if (X < X0 + 3 || X > X0 + PW - 3) continue; S2.line(X, Y0 - 6, X, Y0 + 6, { stroke: INK }); S2.line(X, Y0 + PH - 6, X, Y0 + PH + 6, { stroke: INK }); tx(X, Y0 + PH + 22, dms(lo, 'lon'), { 'font-size': 11, 'text-anchor': 'middle' }); }
    for (var la = Math.ceil(b.s / st) * st; la <= b.n + 1e-9; la += st) { var Y = py(la); if (Y < Y0 + 3 || Y > Y0 + PH - 3) continue; S2.line(X0 - 6, Y, X0 + 6, Y, { stroke: INK }); S2.line(X0 + PW - 6, Y, X0 + PW + 6, Y, { stroke: INK }); tx(X0 - 11, Y + 4, dms(la, 'lat'), { 'font-size': 11, 'text-anchor': 'end' }); }
    // north arrow inside the frame (top right)
    var NX = nx == null ? X0 + PW - 30 : nx, NY = ny == null ? Y0 + 20 : ny; S2.add('circle', { cx: NX, cy: NY + 17, r: 24, fill: 'rgba(255,255,255,.88)', stroke: INK, 'stroke-width': .6 });
    S2.path('M' + NX + ' ' + (NY + 2) + 'l-9 28l9 -7z', { fill: INK }); S2.path('M' + NX + ' ' + (NY + 2) + 'l9 28l-9 -7z', { fill: '#fff', stroke: INK, 'stroke-width': 1 }); tx(NX, NY - 1, 'N', { 'font-size': 13, 'font-weight': 800, 'text-anchor': 'middle' });
    // scale bar inside the frame (bottom left)
    var kmPx = (b.e - b.w) * 111.32 * kx / PW, want = kmPx * Math.min(150, PW * .28), p10 = Math.pow(10, Math.floor(Math.log10(want))), m = want / p10, len = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p10, spx = len / kmPx, sx0 = X0 + 16, sy0 = Y0 + PH - 20;
    S2.add('rect', { x: sx0 - 8, y: sy0 - 22, width: spx + 58, height: 36, fill: 'rgba(255,255,255,.88)', stroke: INK, 'stroke-width': .5 });
    for (var i = 0; i < 4; i++) S2.add('rect', { x: sx0 + i * spx / 4, y: sy0, width: spx / 4, height: 6, fill: i % 2 ? '#fff' : INK }); S2.add('rect', { x: sx0, y: sy0, width: spx, height: 6, fill: 'none', stroke: INK, 'stroke-width': .8 });
    var fl = function (v) { return v >= 1 ? SH.fmt(v, v % 1 ? 1 : 0) : SH.fmt(v, 2); }; tx(sx0, sy0 - 6, '0', { 'font-size': 10.5, 'text-anchor': 'middle' }); tx(sx0 + spx / 2, sy0 - 6, fl(len / 2), { 'font-size': 10.5, 'text-anchor': 'middle' }); tx(sx0 + spx, sy0 - 6, fl(len) + ' km', { 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'start' });
    return { px: px, py: py, tx: tx };
  }
  function fitBox(b) { var lat0 = (b.n + b.s) / 2, kx = Math.cos(SH.rad(lat0)), asp = ((b.e - b.w) * kx) / (b.n - b.s); return { kx: kx, asp: asp }; }
  var SITEKEY = [];
  function sheet() {
    var svg = $('#fSheet'), S2 = SH.svgB(svg), W = 1100, X0 = 80, Y0 = 92;
    // area: the searched rectangle, tightened around the sites when they occupy a small part of it
    var b = { w: AREA.w, e: AREA.e, s: AREA.s, n: AREA.n };
    var lats = S.map(function (c) { return c.lat; }), lons = S.map(function (c) { return c.lng; });
    if (S.length) { var bw = Math.max.apply(null, lons) - Math.min.apply(null, lons), bh = Math.max.apply(null, lats) - Math.min.apply(null, lats), m = Math.max(.15, Math.max(bw, bh) * .07); b = { w: Math.min.apply(null, lons) - m, e: Math.max.apply(null, lons) + m, s: Math.min.apply(null, lats) - m, n: Math.max.apply(null, lats) + m }; }
    var f = fitBox(b), PW = 720, PH = PW / f.asp; if (PH > 640) { PH = 640; PW = PH * f.asp; } var LX = X0 + 720 + 40;
    var title = 'Fossil sites' + (AREANAME ? ' — ' + AREANAME : ' of the study area'), sub = [AREA.tax ? 'Group / taxon: ' + AREA.tax : 'All fossil groups', AREA.int ? 'Age: ' + AREA.int : 'All ages', S.length + ' sites · ' + O.length + ' fossil records'].join('   ·   ');
    S2.add('rect', { x: 0, y: 0, width: W, height: 800, fill: '#fff' });
    S2.text(X0 - 40, 44, title, { fill: INK, 'font-size': 22, 'font-weight': 800, 'font-family': PF }); S2.text(X0 - 40, 68, sub, { fill: MUT, 'font-size': 12.5, 'font-family': PF });
    var imgEl = S2.add('image', { x: X0, y: Y0, width: PW, height: PH, preserveAspectRatio: 'none' });
    var ready = baseMap(b, Math.round(PW * 1.6), Math.round(PH * 1.6)).then(function (u) { if (u) imgEl.setAttribute('href', u); });
    // sites
    var g = {}; S.forEach(function (c) { var k = c.lat.toFixed(3) + ',' + c.lng.toFixed(3); (g[k] = g[k] || []).push(c); });
    var pts = Object.keys(g).map(function (k) { var a = g[k], n = a.reduce(function (s, x) { return s + (x.taxa.length || +x.n_occs || 0); }, 0), old = a.slice().sort(function (x, y) { return y.max_ma - x.max_ma; })[0]; return { a: a, c: a[0], n: n, p: per(old.max_ma, old.min_ma) }; }).sort(function (x, y) { return y.n - x.n; });
    var rad = function (n) { return Math.min(13, 4 + Math.sqrt(n) * 1.1); };
    var gS = S2.g({}), F = mapFrame(S2, b, X0, Y0, PW, PH, f.kx);
    pts.slice().reverse().forEach(function (q) { S2.circle(F.px(q.c.lng), F.py(q.c.lat), rad(q.n), { fill: q.p[4], stroke: '#111', 'stroke-width': .9, 'fill-opacity': .95 }, gS); });
    SITEKEY = pts.slice(0, 20); SITEKEY.forEach(function (q, i) { var x = F.px(q.c.lng) + rad(q.n) + 2, y = F.py(q.c.lat) - rad(q.n) + 2; S2.text(x, y, String(i + 1), { fill: INK, 'font-size': 11.5, 'font-weight': 800, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', 'font-family': PF }, gS); });
    // legend
    var ly = Y0 + 4; F.tx(LX, ly + 8, 'LEGEND', { 'font-size': 14, 'font-weight': 800, 'letter-spacing': 1 }); ly += 30; F.tx(LX, ly, 'Age of the site (oldest bed)', { fill: MUT, 'font-size': 11.5 }); ly += 10;
    var used = {}; pts.forEach(function (q) { used[q.p[0]] = 1; });
    SH.ics.filter(function (p) { return used[p[0]]; }).reverse().forEach(function (p) { S2.circle(LX + 8, ly + 9, 7, { fill: p[4], stroke: '#111', 'stroke-width': .8 }); F.tx(LX + 22, ly + 13, p[0] + '  (' + ma(p[3]) + '–' + ma(p[2]) + ' Ma)', { 'font-size': 11.5 }); ly += 20; });
    ly += 22; F.tx(LX, ly, 'Number of fossil records', { fill: MUT, 'font-size': 11.5 }); ly += 6;
    [1, 10, 50].forEach(function (n) { var r = rad(n); S2.circle(LX + 13, ly + 14, r, { fill: '#fff', stroke: '#111', 'stroke-width': .9 }); F.tx(LX + 32, ly + 18, String(n), { 'font-size': 11.5 }); ly += 28; });
    ly += 4; S2.add('text', { x: LX + 6, y: ly + 12, fill: INK, 'font-size': 11.5, 'font-weight': 800, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', 'font-family': PF }, '7'); F.tx(LX + 32, ly + 12, 'Site number (see key)', { 'font-size': 11.5 }); ly += 26;
    F.tx(LX, ly + 6, 'Geographic coordinates, WGS 84', { fill: MUT, 'font-size': 10.5 }); F.tx(LX, ly + 22, 'Ages after the ICS chart (2023)', { fill: MUT, 'font-size': 10.5 });
    // key to numbered sites
    var ky = Math.max(Y0 + PH + 50, ly + 40), cw = [34, 300, 170, 170, 180, 0]; F.tx(X0 - 40, ky, 'KEY TO THE NUMBERED SITES', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': .8 }); ky += 12;
    var heads = ['No.', 'Site', 'Formation', 'Rock type', 'Age', 'Main fossils'], xs = [X0 - 40]; cw.slice(0, 5).forEach(function (w, i) { xs.push(xs[i] + w); });
    S2.add('rect', { x: X0 - 40, y: ky, width: W - 2 * (X0 - 40), height: 22, fill: INK }); heads.forEach(function (h, i) { F.tx(xs[i] + 6, ky + 15, h, { fill: '#fff', 'font-size': 11, 'font-weight': 700 }); }); ky += 22;
    var clip = function (s, n) { s = String(s || '—'); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    SITEKEY.forEach(function (q, i) { var c = q.c, gs = siteGroups(c).slice(0, 2).map(function (k) { return gname(k, true); }).join(', ');
      if (i % 2) S2.add('rect', { x: X0 - 40, y: ky, width: W - 2 * (X0 - 40), height: 20, fill: '#F6F4EE' });
      S2.circle(xs[0] + 10, ky + 10, 5, { fill: q.p[4], stroke: '#111', 'stroke-width': .6 }); F.tx(xs[0] + 20, ky + 14, String(i + 1), { 'font-size': 11, 'font-weight': 800 });
      F.tx(xs[1] + 6, ky + 14, clip(c.collection_name, 46), { 'font-size': 11 }); F.tx(xs[2] + 6, ky + 14, clip(c.formation, 25), { 'font-size': 11 }); F.tx(xs[3] + 6, ky + 14, clip(lith(c, true), 25), { 'font-size': 11 });
      F.tx(xs[4] + 6, ky + 14, clip(ageTxt(c), 27), { 'font-size': 11 }); F.tx(xs[5] + 6, ky + 14, clip(gs, 24), { 'font-size': 11 }); ky += 20; });
    if (pts.length > 20) { F.tx(X0 - 40, ky + 16, (pts.length - 20) + ' further sites are drawn on the map without numbers; the complete list is in the data table.', { fill: MUT, 'font-size': 11 }); ky += 22; }
    var VH = ky + 40; S2.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); S2.el.firstChild.setAttribute('height', VH);
    S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    var top3 = SITEKEY.slice(0, 3).map(function (q) { return '<b>' + E(q.c.collection_name) + '</b>'; });
    $('#fSheetCap').innerHTML = t('The map gathers the ', 'تجمع الخريطة ') + S.length + t(' fossil sites of the area, coloured by the age of their oldest bed and sized by the number of fossils recorded. The richest are ', ' موقعاً أحفورياً في المنطقة، ملوّنة حسب عمر أقدم طبقة فيها، وبحجم يتناسب مع عدد الأحافير المسجلة. وأغناها ') + top3.join(AR ? '، و' : ', ') + t('; the numbered sites are described in the key under the map.', '؛ والمواقع المرقّمة موصوفة في المفتاح أسفل الخريطة.');
    return ready;
  }
  function siteSheet(c) {
    var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1100px'; document.body.appendChild(host);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 1100 800'); svg.style.width = '1100px'; host.appendChild(svg);
    var S2 = SH.svgB(svg), W = 1100, p = per(c.max_ma, c.min_ma), d = .45, b = { w: c.lng - d / Math.cos(SH.rad(c.lat)), e: c.lng + d / Math.cos(SH.rad(c.lat)), s: c.lat - d, n: c.lat + d }, f = fitBox(b), PW = 480, PH = PW / f.asp, X0 = 70, Y0 = 96;
    S2.add('rect', { x: 0, y: 0, width: W, height: 800, fill: '#fff' }); S2.add('rect', { x: 0, y: 0, width: 12, height: 800, fill: p[4] });
    S2.text(40, 44, c.collection_name, { fill: INK, 'font-size': 21, 'font-weight': 800, 'font-family': PF });
    S2.text(40, 68, [c.formation ? c.formation + ' Formation' : '', p[0], ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma', c.cc ? country(c.cc, true) : ''].filter(Boolean).join('   ·   '), { fill: MUT, 'font-size': 13, 'font-family': PF });
    var imgEl = S2.add('image', { x: X0, y: Y0, width: PW, height: PH, preserveAspectRatio: 'none' });
    var gS = S2.g({}), F = mapFrame(S2, b, X0, Y0, PW, PH, f.kx);
    // neighbouring sites, then the site as a star
    S.forEach(function (o) { if (o === c || o.lat < b.s || o.lat > b.n || o.lng < b.w || o.lng > b.e) return; S2.circle(F.px(o.lng), F.py(o.lat), 4.5, { fill: per(o.max_ma, o.min_ma)[4], stroke: '#111', 'stroke-width': .7 }, gS); });
    var sx = F.px(c.lng), sy = F.py(c.lat), star = ''; for (var i = 0; i < 10; i++) { var r = i % 2 ? 6 : 14, a = -Math.PI / 2 + i * Math.PI / 5; star += (i ? 'L' : 'M') + (sx + r * Math.cos(a)).toFixed(1) + ' ' + (sy + r * Math.sin(a)).toFixed(1); } S2.path(star + 'Z', { fill: '#C0392B', stroke: '#fff', 'stroke-width': 1.5 }, gS);
    var ly = Y0 + PH + 46; S2.path('M' + (X0 + 8) + ' ' + (ly - 9) + 'l3 6h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z', { fill: '#C0392B', stroke: '#fff' }); F.tx(X0 + 26, ly + 2, 'Fossil site', { 'font-size': 11.5 }); S2.circle(X0 + 128, ly - 2, 4.5, { fill: '#bbb', stroke: '#111' }); F.tx(X0 + 140, ly + 2, 'Other fossil sites (coloured by period)', { 'font-size': 11.5 });
    // information block
    var IX = X0 + PW + 50, iy = Y0 + 4, IW = W - IX - 40;
    var rows = [['Coordinates', c.lat.toFixed(5) + '°, ' + c.lng.toFixed(5) + '°'], ['Country / region', [c.county, c.state, c.cc ? country(c.cc, true) : ''].filter(Boolean).join(', ')], ['Formation', c.formation], ['Group / member', [c.geological_group, c.member].filter(Boolean).join(' / ')], ['Rock type', lith(c, true)], ['Environment', c.environment], ['Geological age', ageTxt(c) + ' (' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma), ' + p[0]], ['Palaeolatitude', c.paleolat !== '' && c.paleolat != null ? (+c.paleolat).toFixed(1) + '° (plate reconstruction)' : ''], ['Sampling scale', c.geogscale], ['Published in', c.primary_reference]];
    var meas = document.createElement('canvas').getContext('2d'); meas.font = '12px ' + PF;
    F.tx(IX, iy + 8, 'SITE DESCRIPTION', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': .8 }); iy += 22;
    rows.forEach(function (r) { if (!r[1]) return; var ln = wrapTxt(meas, String(r[1]), IW - 130); S2.line(IX, iy, IX + IW, iy, { stroke: '#E2DED3' }); F.tx(IX, iy + 16, r[0], { fill: MUT, 'font-size': 11, 'font-weight': 700 }); ln.slice(0, 5).forEach(function (l, k) { F.tx(IX + 130, iy + 16 + k * 16, l, { 'font-size': 12 }); }); iy += 10 + Math.min(5, ln.length) * 16; });
    // fossils
    var fy = Math.max(ly + 34, iy + 30); F.tx(40, fy, 'FOSSILS FOUND AT THIS SITE (' + c.taxa.length + ')', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': .8 }); fy += 10;
    var bygrp = {}; c.taxa.forEach(function (o) { var k = grp(o); (bygrp[k] = bygrp[k] || []).push(o.name); }); meas.font = 'italic 12px ' + PF;
    siteGroups(c).forEach(function (k, gi) { var names = uniq(bygrp[k]), ln = wrapTxt(meas, names.join(', '), W - 300); fy += 8; S2.circle(48, fy + 10, 5, { fill: gcol(k, gi), stroke: '#111', 'stroke-width': .6 }); F.tx(60, fy + 14, gname(k, true) + ' (' + names.length + ')', { 'font-size': 12, 'font-weight': 700 }); ln.forEach(function (l, j) { F.tx(250, fy + 14 + j * 16, l, { 'font-size': 12, 'font-style': 'italic' }); }); fy += Math.max(1, ln.length) * 16 + 4; });
    var VH = fy + 40; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); svg.firstChild.setAttribute('height', VH); svg.childNodes[1].setAttribute('height', VH);
    S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    return baseMap(b, Math.round(PW * 1.6), Math.round(PH * 1.6)).then(function (u) { if (u) imgEl.setAttribute('href', u); return { svg: svg, host: host }; });
  }

  /* ------------------------------------------------------------------ downloads */
  function exportWide(svg, name, fmt, width) {
    var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + (width || 1600) + 'px'; var c = svg.cloneNode(true); c.removeAttribute('id'); c.style.cssText = 'display:block;width:' + (width || 1600) + 'px;height:auto;min-width:0'; host.appendChild(c); document.body.appendChild(host);
    return SH.exportFigure(c, name, fmt).then(function (r) { host.remove(); return r; }, function (er) { host.remove(); throw er; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pl],[data-sheet],[data-ss],[data-wm],[data-wt]'); if (!b) return; var fmt = b.getAttribute('data-f') || b.getAttribute('data-sheet'); busyBtn(b, true);
    var done = function () { busyBtn(b, false); }, fail = function () { SH.toast(t('The image could not be created.', 'تعذر إنشاء الصورة.'), 'warn'); };
    var p;
    if (b.hasAttribute('data-pl')) p = plotCanvas(b.getAttribute('data-pl')).then(function (cv) { return SH.exportCanvas(cv, 'shandal-' + b.getAttribute('data-pl') + '_' + stamp(), fmt); });
    else if (b.hasAttribute('data-sheet')) p = exportWide($('#fSheet'), 'shandal-fossil-map_' + stamp(), fmt, 1650);
    else if (b.hasAttribute('data-wm')) p = exportWide($('#fWMap'), 'shandal-worldwide-' + (cur.taxon ? cur.taxon.name.replace(/\s+/g, '_') : 'taxon'), fmt, 1600);
    else if (b.hasAttribute('data-wt')) p = exportWide($('#fWTime'), 'shandal-time-' + (cur.taxon ? cur.taxon.name.replace(/\s+/g, '_') : 'taxon'), fmt, 1600);
    else { var c = SITES[b.getAttribute('data-ss')]; p = siteSheet(c).then(function (r) { r.host.remove(); return exportWide(r.svg, 'shandal-site-' + c.collection_no, fmt, 1650); }); }
    p.catch(fail).then(done);
  });

  document.addEventListener('click', function (e) { var z = e.target.closest('[data-zoom]'); if (!z) return; var sv = $('#' + z.getAttribute('data-zoom')); if (!sv) return; var c = sv.cloneNode(true); c.removeAttribute('id'); c.style.cssText = 'display:block;width:100%;height:auto;border-radius:12px'; SH.modal(cur.taxon ? cur.taxon.name : '', '<div id="fZoomBox" style="width:min(1100px,86vw)"></div>'); var bx = $('#fZoomBox'); if (bx) bx.appendChild(c); });
  /* ------------------------------------------------------------------ open a fossil card from anywhere */
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-tx]'); if (!b || !G) return; var inSite = !!b.closest('#fSite'); taxon(b.getAttribute('data-tx'), inSite ? 'site' : 'search'); if (b.closest('#fDeck')) { var m = $('.wsm'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });

  /* ------------------------------------------------------------------ controls */
  $('#fView').addEventListener('click', function () { if (map) search(map.getBounds().pad(-0.05)); });
  $('#fDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); search(bb); }, $('#fHint')); });
  $('#fTax').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#fView').click(); });

  /* the PDF report includes the overview and the map sheet of the deck */
  var rep0 = SH.report; if (rep0) SH.report = function (title) { var d = $('#fDeck'); if (d && !$('#fRes').hidden) d.classList.add('fx-print'); return Promise.resolve(rep0(title)).then(function (r) { if (d) d.classList.remove('fx-print'); return r; }, function (er) { if (d) d.classList.remove('fx-print'); throw er; }); };
  document.addEventListener('sh:beforereport', function (e) { if (!S.length) { e.preventDefault(); SH.toast(t('Search an area first.', 'ابحث في منطقة أولاً.'), 'warn'); } });
})();
