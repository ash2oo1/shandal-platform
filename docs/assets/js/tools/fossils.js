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
  /* unique display names: two groups that share a translated name get their scientific name added */
  function glabels(keys, en) { var nm = keys.map(function (k) { return gname(k, en); }), cnt = {}; nm.forEach(function (n) { cnt[n] = (cnt[n] || 0) + 1; }); return keys.map(function (k, i) { return cnt[nm[i]] > 1 && nm[i] !== k ? nm[i] + ' (' + k + ')' : nm[i]; }); }
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
    /* opened from another Shandal tool with an area: #area=south,west,north,east&name=Place */
    var hq = {}; (location.hash || '').slice(1).split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) hq[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    var ab = (hq.area || '').split(',').map(Number);
    if (ab.length === 4 && ab.every(isFinite)) { $('#fTax').value = ''; $('#fInt').value = ''; persist.save(); syncChip(); var nm0 = hq.name || ''; runArea([nm0 ? t('Around ', 'حول ') + nm0 : '', '', ab]); try { history.replaceState(null, '', location.pathname + location.search); } catch (er) {} }
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
    if (k === 'out') { $$('#fOuts input').forEach(function (i) { i.checked = true; }); $('#fOuts').dispatchEvent(new Event('change')); return; }
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
      if (!S.length) { var flt = [AREA.tax, AREA.int].filter(Boolean);
        $('#fRes').hidden = true; $('#fEmpty').hidden = false; $('#fMapStat').hidden = true;
        if (flt.length) { $('#fInfo').innerHTML = '<span>' + t('No fossil sites of ', 'لا توجد مواقع أحفورية لـ ') + '<b dir="ltr">' + E(flt.join(' · ')) + '</b>' + t(' in this area.', ' في هذه المنطقة.') + '</span> <button type="button" class="btn btn-gold btn-xs" id="fNoF">' + t('Remove the filters and search again', 'أزل الفلاتر وأعد البحث') + '</button>';
          $('#fNoF').addEventListener('click', function () { $('#fTax').value = ''; $('#fInt').value = ''; $('#fTax').dispatchEvent(new Event('change')); $('#fInt').dispatchEvent(new Event('change')); syncChip(); search(L.latLngBounds([AREA.s, AREA.w], [AREA.n, AREA.e]), !!AREANAME); });
          SH.toast(t('No sites match the active filters here: ', 'لا توجد مواقع تطابق الفلاتر المفعّلة هنا: ') + E(flt.join(' · ')), 'warn', 6000); }
        else SH.toast(t('No published fossil sites in this area. Try a wider area.', 'لا توجد مواقع أحفورية منشورة في هذه المنطقة. جرّب منطقة أوسع.'), 'warn');
        return; }
      $('#fEmpty').hidden = true; $('#fRes').hidden = false;
      var OUT = outs(); if (!OUT.length) OUT = ['ov'];
      $$('.fx-tabs [data-tab]').forEach(function (b) { b.hidden = OUT.indexOf(b.getAttribute('data-tab')) < 0; });
      if (OUT.indexOf('ov') > -1) overview(); else stats0();
      if (OUT.indexOf('st') > -1) siteCards(); if (OUT.indexOf('gl') > -1) gallery(); if (OUT.indexOf('tb') > -1) table(); if (OUT.indexOf('ms') > -1) sheet();
      tab(OUT.indexOf(curTab) > -1 ? curTab : OUT[0]);
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
    $('#fMapStat').hidden = !S.length; $('#fMapBadges').innerHTML = '<span><b>' + S.length + '</b> ' + t('sites', 'موقعاً') + '</span><span><b>' + SH.fmt(O.length, 0) + '</b> ' + t('records', 'سجلاً') + '</span><span><b>' + Object.keys(taxa).length + '</b> ' + t('fossils', 'أحفورة') + '</span>';
    var an = AREANAME ? (AR ? (AREAS.filter(function (a) { return a[0] === AREANAME; })[0] || [0, AREANAME])[1] : AREANAME) : t('The searched area', 'المنطقة المبحوثة');
    $('#fMapTtl').innerHTML = '<b>' + t('Fossil sites map — ', 'خريطة المواقع الأحفورية — ') + E(an) + '</b>' + E([AREA && AREA.tax ? AREA.tax : t('all fossil groups', 'كل المجموعات الأحفورية'), AREA && AREA.int ? AREA.int : t('all ages', 'كل الأعمار')].join(' · ')) + '<br><span class="muted">' + t('Dashed frame: the searched area · colour: age of the site', 'الإطار المتقطع: منطقة البحث · اللون: عمر الموقع') + '</span>';
  }
  function highlight(c) { if (hl) map.removeLayer(hl); hl = L.circleMarker([c.lat, c.lng], { radius: 20, color: '#C9A227', weight: 3, fill: false, interactive: false }).addTo(map); }

  /* ------------------------------------------------------------------ results chosen by the user */
  function outs() { return $$('#fOuts input:checked').map(function (i) { return i.value; }); }
  function stats0() { $('#nSt').textContent = S.length; $('#nTb').textContent = SH.fmt(O.length, 0); }
  (function () { var k = 'shandal_fossil_outs'; try { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && v.length) $$('#fOuts input').forEach(function (i) { i.checked = v.indexOf(i.value) > -1; }); } catch (e) {}
    $('#fOuts').addEventListener('change', function () { try { localStorage.setItem(k, JSON.stringify(outs())); } catch (e) {} }); })();
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
    var xs = ord.map(function (p, i) { return i; }), GL = glabels(gs, en), data = gs.concat(cnt._o ? ['_o'] : []).map(function (g, i) { return { type: 'bar', name: g === '_o' ? L2('Other groups', 'مجموعات أخرى', en) : GL[i], x: xs, y: ord.map(function (p) { return (cnt[g] || {})[p[0]] || 0; }), marker: { color: g === '_o' ? '#9AA3AB' : gcol(g, i), line: { color: 'rgba(0,0,0,.35)', width: .5 } }, hovertemplate: '%{fullData.name}: %{y}<extra></extra>' }; });
    var fs = ord.length > 8 ? 9 : 10.5, shapes = ord.map(function (p, i) { return { type: 'rect', xref: 'x', yref: 'paper', x0: i - .5, x1: i + .5, y0: -0.13, y1: -0.02, fillcolor: p[4], line: { color: '#333', width: .6 } }; }), ann = ord.map(function (p, i) { return { xref: 'x', yref: 'paper', x: i, y: -0.075, yanchor: 'middle', xanchor: 'center', text: pname(p, en), showarrow: false, font: { size: fs, color: '#111' } }; });
    var top = ord.slice().sort(function (a, b) { return st.P[b[0]] - st.P[a[0]]; })[0];
    return { data: data, layout: { barmode: 'stack', margin: { l: 60, r: 10, t: 10, b: 150 }, xaxis: { tickvals: [], showticklabels: false, range: [-.5, ord.length - .5], zeroline: false }, yaxis: { title: { text: L2('number of fossil records', 'عدد السجلات الأحفورية', en) } }, shapes: shapes, annotations: ann.concat([{ xref: 'paper', yref: 'paper', x: .5, y: -0.17, yanchor: 'top', text: L2('geological period:  older  →  younger', 'العصر الجيولوجي:  الأقدم  ←  الأحدث', en), showarrow: false, font: { size: 10.5, color: '#888' } }]), legend: { orientation: 'h', x: .5, xanchor: 'center', y: -0.26, yanchor: 'top', font: { size: 10.5 }, title: { text: L2('Fossil group: ', 'المجموعة الأحفورية: ', en), font: { size: 10.5 } } }, bargap: .25 },
      cap: t('Bars stack the records of each period by fossil group; the coloured strip is the official ICS time scale. The ', 'تُكدّس الأعمدة سجلات كل عصر حسب المجموعة الأحفورية، والشريط الملوّن هو المقياس الزمني الرسمي للجنة الدولية للطباقية. ويبرز ') + '<b>' + (top ? pname(top) : '') + '</b>' + t(' stands out as the best documented interval of the area.', ' بوصفه الفترة الأفضل توثيقاً في المنطقة.') };
  }
  function chCls(st, en) {
    var top = Object.keys(st.C).sort(function (a, b) { return st.C[b] - st.C[a]; }).slice(0, 10), tot = O.length || 1;
    var rv = top.slice().reverse(), LBL = glabels(rv, en);
    var mar = top.filter(function (k) { return /Foraminifera|Nummulitidae|Anthozoa|Scleractinia|Echinoidea|Bivalvia|Gastropoda|Cephalopoda|Ammonoidea|Brachiopoda|Bryozoa|Crinoidea|Ostracoda|Hippuritida|Trilobita|Chondrichthyes|Cnidaria|Echinodermata|Porifera/.test(k); }).length;
    return { data: [{ type: 'bar', orientation: 'h', y: LBL, x: rv.map(function (k) { return st.C[k]; }), text: rv.map(function (k) { return st.C[k] + ' (' + pct(st.C[k], tot) + '%)'; }), textposition: 'outside', cliponaxis: false, marker: { color: rv.map(function (k, i) { return gcol(k, top.length - 1 - i); }), line: { color: 'rgba(0,0,0,.3)', width: .5 } }, hovertemplate: '%{y}: %{x}<extra></extra>' }],
      layout: { margin: { l: 140, r: 70, t: 10, b: 58 }, showlegend: false, xaxis: { title: { text: L2('number of fossil records (share of all records in brackets)', 'عدد السجلات الأحفورية (والنسبة من مجموع السجلات بين قوسين)', en) } } },
      cap: mar >= top.length / 2 ? t('Marine invertebrates and microfossils dominate the record, the signature of ancient seas over the area.', 'تهيمن اللافقاريات البحرية والأحافير الدقيقة على السجل، وهي بصمة البحار القديمة التي غمرت المنطقة.') : t('Land organisms make up a large part of the record, pointing to continental settings.', 'تشكّل كائنات اليابسة جزءاً كبيراً من السجل، ما يدل على بيئات قارية.') };
  }
  function chEnv(st, en) {
    var ek = G.envcat.filter(function (c) { return st.EC[c[0]] && c[0] !== 'none'; }).reverse();
    return { data: [{ type: 'bar', orientation: 'h', y: ek.map(function (c) { return en || !AR ? c[1] : c[2]; }), x: ek.map(function (c) { return st.EC[c[0]]; }), marker: { color: ek.map(function (c) { return c[3]; }), line: { color: 'rgba(0,0,0,.3)', width: .5 } }, customdata: ek.map(function (c) { return en || !AR ? c[4] : c[5]; }), text: ek.map(function (c) { return String(st.EC[c[0]]); }), textposition: 'outside', cliponaxis: false, hovertemplate: '%{y}: %{x}<br>%{customdata}<extra></extra>' }],
      layout: { margin: { l: 130, r: 40, t: 10, b: 58 }, showlegend: false, xaxis: { title: { text: L2('number of fossil sites in each environment', 'عدد المواقع الأحفورية في كل بيئة', en) } } },
      cap: st.EC.none ? t(st.EC.none + ' sites have no recorded environment and are not shown. Hover a bar for what each environment means.', 'لا تُعرض ' + st.EC.none + ' مواقع ليست لها بيئة مسجلة. مرّر المؤشر على أي عمود لمعرفة معنى البيئة.') : t('Hover a bar for what each environment means.', 'مرّر المؤشر على أي عمود لمعرفة معنى البيئة.') };
  }
  function chDrift(en) {
    var dr = S.filter(function (c) { return c.paleolat !== '' && c.paleolat != null && isFinite(+c.paleolat); }), lat0 = S.reduce(function (a, c) { return a + c.lat; }, 0) / (S.length || 1);
    var ps = SH.ics.filter(function (p) { return dr.some(function (c) { return per(c.max_ma, c.min_ma)[0] === p[0]; }); });
    var data = ps.map(function (p) { var a = dr.filter(function (c) { return per(c.max_ma, c.min_ma)[0] === p[0]; }); return { type: 'scatter', mode: 'markers', name: pname(p, en), x: a.map(function (c) { return (c.max_ma + c.min_ma) / 2; }), y: a.map(function (c) { return +c.paleolat; }), text: a.map(function (c) { return c.collection_name; }), marker: { color: p[4], size: 9, line: { color: '#222', width: .6 } }, hovertemplate: '%{text}<br>%{x:.1f} Ma · %{y:.1f}°<extra></extra>' }; });
    var xmax = Math.max.apply(null, dr.map(function (c) { return c.max_ma; }).concat([10]));
    data.push({ type: 'scatter', mode: 'lines', x: [0, xmax * 1.05], y: [lat0, lat0], line: { color: '#C9A227', width: 2, dash: 'dash' }, name: L2('latitude today', 'خط العرض اليوم', en), hoverinfo: 'skip' });
    return { data: data, layout: { margin: { l: 60, r: 14, t: 10, b: 140 }, xaxis: { autorange: 'reversed', title: { text: L2('age of the site (million years ago)', 'عمر الموقع (مليون سنة مضت)', en) } }, yaxis: { title: { text: L2('palaeolatitude (degrees; + north, − south)', 'خط العرض القديم (درجة؛ + شمال، − جنوب)', en) }, zeroline: true }, legend: { orientation: 'h', x: .5, xanchor: 'center', y: -0.22, yanchor: 'top', font: { size: 10.5 }, title: { text: L2('Period: ', 'العصر: ', en), font: { size: 10.5 } } },
      shapes: [{ type: 'rect', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: -23.4, y1: 23.4, fillcolor: 'rgba(224,123,106,.08)', line: { width: 0 }, layer: 'below' }] },
      cap: dr.length ? t('Each point is a site placed at the latitude it occupied when its fossils lived (plate reconstruction). The shaded band is the tropics and the dashed line the latitude of the area today; points below the line show how far the area has since drifted north.', 'كل نقطة موقع وُضع عند خط العرض الذي كان فيه عندما عاشت أحافيره (إعادة بناء الصفائح). الشريط المظلل هو المنطقة المدارية والخط المتقطع خط عرض المنطقة اليوم؛ والنقاط تحت الخط تبين مقدار انجراف المنطقة نحو الشمال منذ ذلك الحين.') : t('No palaeolatitudes are available for these sites.', 'لا تتوفر خطوط عرض قديمة لهذه المواقع.') };
  }
  function plotCanvas(id) {
    var c = CH[id](true), TT = { fPer: 'Fossil record through geological time', fCls: 'Main fossil groups', fEnv: 'Ancient depositional environments', fDrift: 'Palaeolatitude of the fossil sites through time' };
    var lay = SH.plotLayout(JSON.parse(JSON.stringify(c.layout)));
    lay.paper_bgcolor = '#fff'; lay.plot_bgcolor = '#fff'; lay.font = { family: PF, color: INK, size: 13 };
    ['xaxis', 'yaxis'].forEach(function (a) { lay[a] = SH.merge(lay[a] || {}, { gridcolor: '#E3E3E3', linecolor: '#888', tickcolor: '#888', zerolinecolor: '#BBB', tickfont: { color: INK }, title: { font: { color: INK } } }); });
    lay.legend = SH.merge(lay.legend || {}, { font: { color: INK } }); lay.margin = SH.merge(lay.margin || {}, { t: 70 });
    lay.title = { text: '<b>' + TT[id] + '</b>' + (AREANAME ? ' — ' + AREANAME : ''), x: .02, y: .97, font: { size: 17, color: INK } };
    return window.Plotly.toImage({ data: c.data, layout: lay }, { format: 'png', width: 1200, height: id === 'fPer' || id === 'fDrift' ? 760 : 640, scale: 2 }).then(SH.loadImage).then(function (im) { var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0); return cv; });
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
        '<div class="fx-card" style="margin-top:12px"><span class="lb">' + t('Site map and description sheet', 'خريطة الموقع ولوحة وصفه') + '</span><p>' + t('A framed location map with coordinates, north arrow and scale, the rocks, age and environment of the site and its fossils, shown at full size under the main map.', 'خريطة موقع مؤطرة بالإحداثيات وسهم الشمال ومقياس الرسم، مع صخور الموقع وعمره وبيئته وأحافيره، تظهر بحجمها الكامل أسفل الخريطة الرئيسية.') + '</p><div class="fx-dl"><button type="button" class="btn btn-gold btn-xs" data-goss="' + c.collection_no + '">' + SH.icon('map') + t('Open the site map', 'افتح خريطة الموقع') + '</button><a class="btn btn-ink btn-xs" href="' + gu + '">' + t('Geological unit here', 'الوحدة الجيولوجية هنا') + ' ' + FWD + '</a></div></div>' +
        '<h3 class="fx-h" style="margin-top:16px">' + t('Fossils found here', 'الأحافير الموجودة هنا') + ' (' + c.taxa.length + ')</h3><p class="fx-cap" style="margin:4px 0 0">' + t('Tap a fossil for its description, photographs, age range and worldwide record.', 'انقر أي أحفورة لترى وصفها وصورها ومداها الزمني وانتشارها العالمي.') + '</p>' + (taxaH || '<p class="small muted">' + t('No individual fossils matched the current filters.', 'لا توجد أحافير مفردة تطابق الفلاتر الحالية.') + '</p>');
    }).join('');
    $('#fSite').innerHTML = h; show('site'); siteFocus(arr[0]);
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
    var merge = function (a, b) { var seen = {}; return a.concat(b).filter(function (m) { if (seen[m.th] || /\b(park|street|church|station|village|road|bridge|school|house)\b/i.test(m.title)) return false; seen[m.th] = 1; return true; }).slice(0, n || 12); };
    return (IMGC[key] = q('intitle:"' + name + '" fossil').then(function (a) { a = merge(a, []); if (strict || a.length >= 4) return a; return q(name + ' fossil').then(function (b) { return merge(a, b); }); }));
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

  /* worldwide record: Equal Earth distribution map and time distribution, shown large in the deck under the map */
  function worldwide(nm) {
    var F0 = $('#fFocus'); F0.hidden = true;
    SH.getJSON(PB + 'occs/list.json?vocab=pbdb&show=coords,paleoloc&limit=8000&base_name=' + encodeURIComponent(nm), { timeout: 45000 }).then(function (j) {
      var R = (j.records || []).map(function (r) { return { lat: +r.lat, lon: +r.lng, max: +r.max_ma, min: +r.min_ma, plat: r.paleolat === '' || r.paleolat == null ? null : +r.paleolat }; }).filter(function (r) { return isFinite(r.lat) && isFinite(r.lon); });
      if (!$('#fWBox') || !cur.taxon || cur.taxon.name !== nm) return;
      if (!R.length) { $('#fWBox').innerHTML = '<p class="small muted">' + t('No mapped occurrences are published for this name.', 'لا توجد ظهورات منشورة مرسومة لهذا الاسم.') + '</p>'; return; }
      var cc = {}; R.forEach(function (r) { cc[Math.round(r.lat) + ',' + Math.round(r.lon)] = 1; });
      var P = {}; R.forEach(function (r) { var p = per(r.max, r.min)[0]; P[p] = (P[p] || 0) + 1; }); var pk = Object.keys(P).sort(function (a, b) { return P[b] - P[a]; }), pP = SH.ics.filter(function (p) { return p[0] === pk[0]; })[0];
      var tro = R.filter(function (r) { return r.plat != null; }), inT = tro.filter(function (r) { return Math.abs(r.plat) <= 23.5; }).length;
      var sum = t('Known from ', 'عُرفت من ') + '<b>' + SH.fmt(R.length, 0) + '</b>' + t(' published occurrences in about ', ' ظهوراً منشوراً في نحو ') + '<b>' + Object.keys(cc).length + '</b>' + t(' one-degree cells worldwide, most of them from the ', ' خلية بمساحة درجة واحدة حول العالم، أغلبها من عصر ') + '<b>' + (pP ? pname(pP) : '') + '</b>' + (tro.length ? t('. When alive, ', '. وعند حياتها كانت ') + '<b>' + pct(inT, tro.length) + '%</b>' + t(' of them lay within the tropics.', ' منها ضمن المنطقة المدارية.') : '.');
      $('#fWBox').innerHTML = '<p class="small" style="margin:6px 0;line-height:1.8">' + sum + '</p><button type="button" class="btn btn-gold btn-sm" id="fGoFocus">' + SH.icon('globe') + t('Open the distribution map and time chart', 'افتح خريطة الانتشار والمخطط الزمني') + '</button><p class="fx-cap" style="margin-top:8px">' + t('Both figures are shown at full size under the main map, with their downloads.', 'يظهر الشكلان بحجمهما الكامل أسفل الخريطة الرئيسية مع تنزيلاتهما.') + '</p>';
      $('#fFName').innerHTML = '<i>' + E(nm) + '</i>'; $('#fFSum').innerHTML = sum; F0.hidden = false;
      worldSvg($('#fWMap'), nm, R); timeSvg($('#fWTime'), nm, R);
      $('#fWCap').innerHTML = t('Each circle gathers the occurrences within one degree of latitude and longitude, coloured by the period in which most of them fall and sized by their number. The shaded belt is the present-day tropics.', 'تجمع كل دائرة الظهورات الواقعة ضمن درجة واحدة من العرض والطول، وتُلوَّن حسب العصر الذي يقع فيه أغلبها، ويتناسب حجمها مع عددها. والحزام المظلل هو المنطقة المدارية الحالية.');
      $('#fWTCap').innerHTML = t('Occurrences counted in equal time intervals, coloured by period, above the official ICS time scale; the tallest bars mark the intervals in which the fossil is most often found.', 'الظهورات محسوبة في فترات زمنية متساوية وملونة حسب العصر فوق المقياس الزمني الرسمي للجنة الدولية للطباقية؛ وتدل الأعمدة الأعلى على الفترات التي توجد فيها الأحفورة أكثر من غيرها.');
      cur.taxon.R = R;
      $('#fGoFocus').addEventListener('click', function () { F0.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }).catch(function () { if ($('#fWBox')) $('#fWBox').innerHTML = '<p class="small muted">' + t('The worldwide record could not be loaded now. Try again later.', 'تعذر تحميل الانتشار العالمي الآن. حاول لاحقاً.') + '</p>'; });
  }
  $('#fWOn').addEventListener('click', function () { var R = cur.taxon && cur.taxon.R; if (!R) return; clearWorld(); world = L.layerGroup().addTo(map); var seen = {};
    R.forEach(function (r) { var k = r.lat.toFixed(1) + ',' + r.lon.toFixed(1); if (seen[k]) return; seen[k] = 1; L.circleMarker([r.lat, r.lon], { radius: 3.5, weight: .6, color: '#111', fillColor: per(r.max, r.min)[4], fillOpacity: .9, interactive: false }).addTo(world); });
    map.fitBounds(L.latLngBounds(R.map(function (r) { return [r.lat, r.lon]; })).pad(.1), { maxZoom: 6 }); var m = $('.wsm'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#fFClose').addEventListener('click', function () { $('#fFocus').hidden = true; });
  /* Equal Earth projection (Šavrič, Patterson & Jenny 2018) */
  var EE = (function () { var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2, D = Math.PI / 180;
    return function (lon, lat) { var l = lon * D, th = Math.asin(M * Math.sin(lat * D)), t2 = th * th, t6 = t2 * t2 * t2; return [2 * Math.sqrt(3) * l * Math.cos(th) / (3 * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))]; }; })();
  var COAST = null; function coast() { return COAST || (COAST = SH.getJSON(SH.base + 'assets/data/land-110m.json').catch(function () { return []; })); }
  function northArrow(S2, x, y, s, col) {
    s = s || 1; col = col || INK; var g = S2.g({ transform: 'translate(' + x + ' ' + y + ') scale(' + s + ')' });
    S2.path('M0 0L-11 40L0 31Z', { fill: col }, g); S2.path('M0 0L11 40L0 31Z', { fill: '#fff', stroke: col, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g);
    S2.line(0, 31, 0, 48, { stroke: col, 'stroke-width': 1.3 }, g);
    S2.text(0, -7, 'N', { fill: col, 'font-size': 16, 'font-weight': 800, 'text-anchor': 'middle', 'font-family': PF, direction: 'ltr' }, g);
    return g;
  }
  function worldSvg(svg, nm, R) {
    var S2 = SH.svgB(svg), W = 1200, X0 = 70, MW = 1060, k = MW / (2 * 2.70663), MH = 2 * 1.31731 * k, Y0 = 108, cx = X0 + MW / 2, cy = Y0 + MH / 2;
    svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var P = function (lon, lat) { var q = EE(lon, lat); return [cx + k * q[0], cy - k * q[1]]; };
    var path = function (pts) { return pts.map(function (q, i) { var p = P(q[0], q[1]); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(''); };
    var bg = S2.add('rect', { x: 0, y: 0, width: W, height: 900, fill: '#fff' });
    var tt = S2.add('text', { x: X0, y: 46, fill: INK, 'font-size': 24, 'font-weight': 800, 'font-family': PF, direction: 'ltr' }); S2.add('tspan', {}, 'Worldwide record of ', tt); S2.add('tspan', { 'font-style': 'italic', fill: '#8A6A1F' }, nm, tt);
    S2.text(X0, 74, SH.fmt(R.length, 0) + ' published occurrences plotted at their present-day position', { fill: MUT, 'font-size': 14, 'font-family': PF, direction: 'ltr' });
    // sphere outline, ocean and clip
    var ol = []; for (var la = -90; la <= 90; la += 2) ol.push([-180, la]); for (la = 90; la >= -90; la -= 2) ol.push([180, la]);
    var dfs = S2.add('defs', {}), cid = 'eeclip' + Math.round(Math.random() * 1e6), cp = S2.add('clipPath', { id: cid }, null, dfs); S2.path(path(ol) + 'Z', {}, cp);
    S2.path(path(ol) + 'Z', { fill: '#E6EEF4' });
    var gc = S2.g({ 'clip-path': 'url(#' + cid + ')' });
    // tropics belt
    var tb = []; for (var lo = -180; lo <= 180; lo += 4) tb.push([lo, 23.44]); for (lo = 180; lo >= -180; lo -= 4) tb.push([lo, -23.44]); S2.path(path(tb) + 'Z', { fill: 'rgba(224,123,106,.10)' }, gc);
    var land = S2.g({}, gc), grat = S2.g({}, gc), dots = S2.g({}, gc);
    for (lo = -150; lo <= 150; lo += 30) { var mer = []; for (la = -90; la <= 90; la += 3) mer.push([lo, la]); S2.path(path(mer), { fill: 'none', stroke: '#AFC0CD', 'stroke-width': .6, 'stroke-opacity': .8 }, grat); }
    [-60, -30, 0, 30, 60].forEach(function (la2) { var par = []; for (var l2 = -180; l2 <= 180; l2 += 3) par.push([l2, la2]); S2.path(path(par), { fill: 'none', stroke: la2 ? '#AFC0CD' : '#7F95A6', 'stroke-width': la2 ? .6 : .9, 'stroke-dasharray': la2 ? null : '5 4' }, grat); });
    [23.44, -23.44].forEach(function (la2) { var par = []; for (var l2 = -180; l2 <= 180; l2 += 3) par.push([l2, la2]); S2.path(path(par), { fill: 'none', stroke: '#D9826F', 'stroke-width': .8, 'stroke-dasharray': '2 4' }, grat); });
    // occurrences, aggregated in 1° cells
    var cells = {}; R.forEach(function (r) { var key = Math.round(r.lat) + ',' + Math.round(r.lon); var c = cells[key] = cells[key] || { lat: Math.round(r.lat), lon: Math.round(r.lon), n: 0, P: {} }; c.n++; var p = per(r.max, r.min); c.P[p[0]] = (c.P[p[0]] || 0) + 1; });
    var used = {}, rad = function (n) { return Math.min(10, 3 + Math.sqrt(n) * 1.05); };
    Object.keys(cells).map(function (q) { return cells[q]; }).sort(function (a, b) { return b.n - a.n; }).forEach(function (c) { var pk = Object.keys(c.P).sort(function (a, b) { return c.P[b] - c.P[a]; })[0], p = SH.ics.filter(function (q) { return q[0] === pk; })[0] || ['?', '?', 0, 0, '#ccc']; used[p[0]] = p; var xy = P(c.lon, c.lat);
      S2.circle(xy[0], xy[1], rad(c.n), { fill: p[4], stroke: '#1B232B', 'stroke-width': .7, 'fill-opacity': .95 }, dots); });
    S2.path(path(ol) + 'Z', { fill: 'none', stroke: '#5E7180', 'stroke-width': 1.4 });
    // labels outside the sphere
    [-60, -30, 0, 30, 60].forEach(function (la2) { var p = P(-180, la2); S2.text(p[0] - 8, p[1] + 4, la2 ? Math.abs(la2) + '°' + (la2 > 0 ? 'N' : 'S') : '0°', { fill: MUT, 'font-size': 12, 'text-anchor': 'end', 'font-family': PF, direction: 'ltr' }); var q = P(180, la2); S2.text(q[0] + 8, q[1] + 4, la2 ? Math.abs(la2) + '°' + (la2 > 0 ? 'N' : 'S') : '0°', { fill: MUT, 'font-size': 12, 'font-family': PF, direction: 'ltr' }); });
    [-120, -60, 0, 60, 120].forEach(function (l2) { var p = P(l2, -90); S2.text(p[0], p[1] + 20, l2 ? Math.abs(l2) + '°' + (l2 > 0 ? 'E' : 'W') : '0°', { fill: MUT, 'font-size': 12, 'text-anchor': 'middle', 'font-family': PF, direction: 'ltr' }); });
    northArrow(S2, X0 + MW - 24, Y0 + 14, 1);
    // legend under the map
    var ly = Y0 + MH + 58; S2.line(X0, ly - 22, X0 + MW, ly - 22, { stroke: '#D9D4C7' });
    S2.text(X0, ly, 'LEGEND', { fill: INK, 'font-size': 15, 'font-weight': 800, 'letter-spacing': 1.2, 'font-family': PF, direction: 'ltr' }); ly += 26;
    S2.text(X0, ly, 'Period in which most occurrences of the cell fall', { fill: MUT, 'font-size': 12.5, 'font-family': PF, direction: 'ltr' }); ly += 12;
    var ps = SH.ics.filter(function (p) { return used[p[0]]; }).reverse(), colW = 265;
    ps.forEach(function (p, i) { var x = X0 + (i % 4) * colW, y = ly + Math.floor(i / 4) * 26; S2.circle(x + 8, y + 12, 7.5, { fill: p[4], stroke: '#1B232B', 'stroke-width': .7 }); S2.text(x + 24, y + 16.5, p[0] + '  (' + ma(p[3]) + '–' + ma(p[2]) + ' Ma)', { fill: INK, 'font-size': 13, 'font-family': PF, direction: 'ltr' }); });
    ly += Math.ceil(ps.length / 4) * 26 + 18;
    S2.text(X0, ly, 'Occurrences per 1° cell', { fill: MUT, 'font-size': 12.5, 'font-family': PF, direction: 'ltr' });
    var sx = X0 + 175; [1, 10, 50].forEach(function (n) { var r = rad(n); S2.circle(sx + r, ly - 4, r, { fill: '#fff', stroke: '#1B232B', 'stroke-width': .9 }); S2.text(sx + 2 * r + 7, ly + 1, String(n), { fill: INK, 'font-size': 13, 'font-family': PF, direction: 'ltr' }); sx += 2 * r + 40; });
    var lx = X0 + 470; S2.add('rect', { x: lx, y: ly - 12, width: 30, height: 14, fill: 'rgba(224,123,106,.18)', stroke: '#D9826F', 'stroke-dasharray': '2 3' }); S2.text(lx + 38, ly + 1, 'Tropics today (23.44° N–S)', { fill: INK, 'font-size': 13, 'font-family': PF, direction: 'ltr' });
    lx += 265; S2.line(lx, ly - 5, lx + 30, ly - 5, { stroke: '#7F95A6', 'stroke-width': 1, 'stroke-dasharray': '5 4' }); S2.text(lx + 38, ly + 1, 'Equator', { fill: INK, 'font-size': 13, 'font-family': PF, direction: 'ltr' });
    ly += 34; S2.text(X0, ly, 'Equal Earth projection, WGS 84 · coastlines at 1:110 million · geological ages after the ICS chart (2023)', { fill: MUT, 'font-size': 11.5, 'font-family': PF, direction: 'ltr' });
    var VH = ly + 30; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); bg.setAttribute('height', VH); S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    coast().then(function (rings) { rings.forEach(function (rg) {
      // unwrap rings that cross the antimeridian; a ring that circles the pole (Antarctica) is closed along the pole line
      var u = [], off = 0; rg.forEach(function (q, i) { if (i) { var dl = q[0] + off - u[i - 1][0]; if (dl > 180) off -= 360; else if (dl < -180) off += 360; } u.push([q[0] + off, q[1]]); });
      var d0 = u[u.length - 1][0] - u[0][0], dd = path(u);
      if (Math.abs(d0) > 180) { var pl = u[0][1] < 0 ? -90 : 90; dd += path([[u[u.length - 1][0], pl], [u[0][0], pl]]).replace(/^M/, 'L'); }
      [0, -360, 360].forEach(function (sh) { var dsh = sh ? path(u.map(function (q) { return [q[0] + sh, q[1]]; })) : dd; S2.path(dsh + 'Z', { fill: '#EFE6D2', stroke: '#8E8068', 'stroke-width': .6, 'stroke-linejoin': 'round' }, land); });
    }); });
  }
  function timeSvg(svg, nm, R) {
    var S2 = SH.svgB(svg), W = 1000, X0 = 70, X1 = 970, Y0 = 70, Y1 = 290; svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
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
  /* frame, graticule labels, north arrow and scale bar for a map panel. The north arrow and the scale bar sit
     outside the frame so they never cover data; returns projection helpers and the bottom of what was drawn */
  function mapFrame(S2, b, X0, Y0, PW, PH, kx, o) {
    o = o || {}; var tx = function (x, y, s, a, par) { return S2.text(x, y, s, Object.assign({ fill: INK, 'font-size': 12, direction: 'ltr', 'font-family': PF }, a || {}), par); };
    S2.add('rect', { x: X0, y: Y0, width: PW, height: PH, fill: 'none', stroke: INK, 'stroke-width': 1.6 }); S2.add('rect', { x: X0 - 6, y: Y0 - 6, width: PW + 12, height: PH + 12, fill: 'none', stroke: INK, 'stroke-width': .8 });
    var px = function (lo) { return X0 + (lo - b.w) / (b.e - b.w) * PW; }, py = function (la) { return Y0 + (b.n - la) / (b.n - b.s) * PH; };
    var gs = [1 / 60, 2 / 60, 5 / 60, 10 / 60, .25, .5, 1, 2, 5, 10], st = gs.filter(function (g) { return (b.e - b.w) / g <= 6; })[0] || 10;
    for (var lo = Math.ceil(b.w / st) * st; lo <= b.e + 1e-9; lo += st) { var X = px(lo); if (X < X0 + 20 || X > X0 + PW - 20) continue; S2.line(X, Y0 - 6, X, Y0, { stroke: INK }); S2.line(X, Y0 + PH, X, Y0 + PH + 6, { stroke: INK }); tx(X, Y0 + PH + 24, dms(lo, 'lon'), { 'font-size': 11.5, 'text-anchor': 'middle' }); }
    for (var la = Math.ceil(b.s / st) * st; la <= b.n + 1e-9; la += st) { var Y = py(la); if (Y < Y0 + 14 || Y > Y0 + PH - 14) continue; S2.line(X0 - 6, Y, X0, Y, { stroke: INK }); S2.line(X0 + PW, Y, X0 + PW + 6, Y, { stroke: INK }); tx(X0 - 12, Y + 4, dms(la, 'lat'), { 'font-size': 11.5, 'text-anchor': 'end' }); }
    northArrow(S2, o.nx != null ? o.nx : X0 + PW + 34, o.ny != null ? o.ny : Y0 + 18, 1);
    var kmPx = (b.e - b.w) * 111.32 * kx / PW, want = kmPx * Math.min(170, PW * .3), p10 = Math.pow(10, Math.floor(Math.log10(want))), m = want / p10, len = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p10, spx = len / kmPx, sx0 = o.sx != null ? o.sx : X0, sy0 = o.sy != null ? o.sy : Y0 + PH + 58;
    for (var i = 0; i < 4; i++) S2.add('rect', { x: sx0 + i * spx / 4, y: sy0, width: spx / 4, height: 7, fill: i % 2 ? '#fff' : INK }); S2.add('rect', { x: sx0, y: sy0, width: spx, height: 7, fill: 'none', stroke: INK, 'stroke-width': .9 });
    var fl = function (v) { return v >= 1 ? SH.fmt(v, v % 1 ? 1 : 0) : SH.fmt(v, 2); }; tx(sx0, sy0 - 7, '0', { 'font-size': 11, 'text-anchor': 'middle' }); tx(sx0 + spx / 2, sy0 - 7, fl(len / 2), { 'font-size': 11, 'text-anchor': 'middle' }); tx(sx0 + spx, sy0 - 7, fl(len), { 'font-size': 11, 'text-anchor': 'middle' }); tx(sx0 + spx + 10, sy0 + 7, 'km', { 'font-size': 11.5, 'font-weight': 700 });
    return { px: px, py: py, tx: tx, bottom: sy0 + 12 };
  }
  function fitBox(b) { var lat0 = (b.n + b.s) / 2, kx = Math.cos(SH.rad(lat0)), asp = ((b.e - b.w) * kx) / (b.n - b.s); return { kx: kx, asp: asp }; }
  function clipFor(S2, x, y, w, h) { var dfs = S2.add('defs', {}), id = 'fxc' + Math.round(Math.random() * 1e7), cp = S2.add('clipPath', { id: id }, null, dfs); S2.add('rect', { x: x, y: y, width: w, height: h }, null, cp); return 'url(#' + id + ')'; }
  var SITEKEY = [], NKEY = 30;
  function sitePoints() {
    var g = {}; S.forEach(function (c) { var k = c.lat.toFixed(3) + ',' + c.lng.toFixed(3); (g[k] = g[k] || []).push(c); });
    return Object.keys(g).map(function (k) { var a = g[k], n = a.reduce(function (s, x) { return s + (x.taxa.length || +x.n_occs || 0); }, 0), old = a.slice().sort(function (x, y) { return y.max_ma - x.max_ma; })[0]; return { a: a, c: old, n: n, p: per(old.max_ma, old.min_ma) }; }).sort(function (x, y) { return y.n - x.n; });
  }
  function sheet() {
    var svg = $('#fSheet'), S2 = SH.svgB(svg), W = 1100, X0 = 96, Y0 = 104; svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var b = { w: AREA.w, e: AREA.e, s: AREA.s, n: AREA.n }, lats = S.map(function (c) { return c.lat; }), lons = S.map(function (c) { return c.lng; });
    if (S.length) { var bw = Math.max.apply(null, lons) - Math.min.apply(null, lons), bh = Math.max.apply(null, lats) - Math.min.apply(null, lats), m = Math.max(.15, Math.max(bw, bh) * .07); b = { w: Math.min.apply(null, lons) - m, e: Math.max.apply(null, lons) + m, s: Math.min.apply(null, lats) - m, n: Math.max.apply(null, lats) + m }; }
    var f = fitBox(b), PW = 860, PH = PW / f.asp; if (PH > 760) { PH = 760; PW = PH * f.asp; } X0 = Math.max(96, (W - PW) / 2 - 10);
    var title = 'Fossil sites' + (AREANAME ? ' — ' + AREANAME : ' of the study area'), sub = [AREA.tax ? 'Group / taxon: ' + AREA.tax : 'All fossil groups', AREA.int ? 'Age: ' + AREA.int : 'All ages', S.length + ' sites, ' + O.length + ' fossil records'].join('   ·   ');
    var bg = S2.add('rect', { x: 0, y: 0, width: W, height: 900, fill: '#fff' });
    S2.text(40, 48, title, { fill: INK, 'font-size': 24, 'font-weight': 800, 'font-family': PF, direction: 'ltr' }); S2.text(40, 74, sub, { fill: MUT, 'font-size': 13, 'font-family': PF, direction: 'ltr' });
    var cl = clipFor(S2, X0, Y0, PW, PH), imgEl = S2.add('image', { x: X0, y: Y0, width: PW, height: PH, preserveAspectRatio: 'none', 'clip-path': cl });
    var ready = baseMap(b, Math.round(PW * 2.2), Math.round(PH * 2.2)).then(function (u) { if (u) imgEl.setAttribute('href', u); });
    var pts = sitePoints(), rad = function (n) { return Math.min(13, 4 + Math.sqrt(n) * 1.1); };
    var gS = S2.g({ 'clip-path': cl }), F = mapFrame(S2, b, X0, Y0, PW, PH, f.kx);
    pts.slice().reverse().forEach(function (q) { S2.circle(F.px(q.c.lng), F.py(q.c.lat), rad(q.n), { fill: q.p[4], stroke: '#111', 'stroke-width': .9, 'fill-opacity': .95 }, gS); });
    SITEKEY = pts.slice(0, NKEY); SITEKEY.forEach(function (q, i) { var r = rad(q.n), x = F.px(q.c.lng) + r * .75 + 2, y = F.py(q.c.lat) - r * .75; S2.text(x, y, String(i + 1), { fill: INK, 'font-size': 12, 'font-weight': 800, stroke: '#fff', 'stroke-width': 3.2, 'paint-order': 'stroke', 'stroke-linejoin': 'round', 'font-family': PF, direction: 'ltr' }, gS); });
    // legend under the map
    var ly = F.bottom + 44; S2.line(40, ly - 24, W - 40, ly - 24, { stroke: '#D9D4C7' });
    F.tx(40, ly, 'LEGEND', { 'font-size': 15, 'font-weight': 800, 'letter-spacing': 1.2 }); ly += 24; F.tx(40, ly, 'Age of the site (oldest fossil-bearing bed)', { fill: MUT, 'font-size': 12.5 }); ly += 10;
    var used = {}; pts.forEach(function (q) { used[q.p[0]] = 1; }); var ps = SH.ics.filter(function (p) { return used[p[0]]; }).reverse();
    ps.forEach(function (p, i) { var x = 40 + (i % 3) * 340, y = ly + Math.floor(i / 3) * 26; S2.circle(x + 9, y + 12, 8, { fill: p[4], stroke: '#111', 'stroke-width': .8 }); F.tx(x + 26, y + 16.5, p[0] + '  (' + ma(p[3]) + '–' + ma(p[2]) + ' Ma)', { 'font-size': 13 }); });
    ly += Math.ceil(ps.length / 3) * 26 + 22; F.tx(40, ly, 'Number of fossil records at the site', { fill: MUT, 'font-size': 12.5 });
    var sx = 300; [1, 10, 50].forEach(function (n) { var r = rad(n); S2.circle(sx + r, ly - 4, r, { fill: '#fff', stroke: '#111', 'stroke-width': .9 }); F.tx(sx + 2 * r + 8, ly + 1, String(n), { 'font-size': 13 }); sx += 2 * r + 46; });
    S2.text(sx + 30, ly + 1, '12', { fill: INK, 'font-size': 13, 'font-weight': 800, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', 'font-family': PF, direction: 'ltr' }); F.tx(sx + 56, ly + 1, 'Site number (see the key table)', { 'font-size': 13 });
    ly += 32; F.tx(40, ly, 'Geographic coordinates, WGS 84 · geological ages after the ICS chart (2023)', { fill: MUT, 'font-size': 11.5 });
    var VH = ly + 30; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); bg.setAttribute('height', VH); S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    keySheet();
    var top3 = SITEKEY.slice(0, 3).map(function (q) { return '<b>' + E(q.c.collection_name) + '</b>'; });
    $('#fSheetCap').innerHTML = t('The map gathers the ', 'تجمع الخريطة ') + S.length + t(' fossil sites of the area, coloured by the age of their oldest bed and sized by the number of fossils recorded. The richest are ', ' موقعاً أحفورياً في المنطقة، ملوّنة حسب عمر أقدم طبقة فيها، وبحجم يتناسب مع عدد الأحافير المسجلة. وأغناها ') + top3.join(AR ? '، و' : ', ') + t('. The numbered sites are described in the key table below, which downloads separately.', '. والمواقع المرقّمة موصوفة في جدول المفتاح أدناه، ويُنزَّل منفصلاً.');
    return ready;
  }
  function keySheet() {
    var svg = $('#fKey'), S2 = SH.svgB(svg), W = 1100; svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var meas = document.createElement('canvas').getContext('2d'), fit = function (s, w, font) { meas.font = font || ('12px ' + PF); s = String(s == null || s === '' ? '—' : s); if (meas.measureText(s).width <= w) return s; while (s.length > 1 && meas.measureText(s + '…').width > w) s = s.slice(0, -1); return s.trim() + '…'; };
    var bg = S2.add('rect', { x: 0, y: 0, width: W, height: 900, fill: '#fff' });
    S2.text(40, 48, 'Key to the numbered fossil sites' + (AREANAME ? ' — ' + AREANAME : ''), { fill: INK, 'font-size': 22, 'font-weight': 800, 'font-family': PF, direction: 'ltr' });
    S2.text(40, 72, 'Numbers refer to the map of the fossil sites; sites are ordered by the number of fossil records.', { fill: MUT, 'font-size': 12.5, 'font-family': PF, direction: 'ltr' });
    var cols = [['No.', 44], ['Site', 270], ['Formation', 150], ['Rock type', 150], ['Age', 170], ['Records', 64], ['Main fossil groups', 172]], x0 = 40, ys = 96, xs = [x0]; cols.forEach(function (c, i) { xs.push(xs[i] + c[1]); });
    S2.add('rect', { x: x0, y: ys, width: W - 80, height: 28, fill: INK }); cols.forEach(function (c, i) { S2.text(xs[i] + 8, ys + 19, c[0], { fill: '#fff', 'font-size': 12.5, 'font-weight': 700, 'font-family': PF, direction: 'ltr' }); }); ys += 28;
    SITEKEY.forEach(function (q, i) { var c = q.c, gs = siteGroups(c).slice(0, 2).map(function (k) { return gname(k, true); }).join(', ');
      if (i % 2) S2.add('rect', { x: x0, y: ys, width: W - 80, height: 26, fill: '#F6F4EE' });
      S2.circle(xs[0] + 12, ys + 13, 6, { fill: q.p[4], stroke: '#111', 'stroke-width': .6 }); S2.text(xs[0] + 24, ys + 17.5, String(i + 1), { fill: INK, 'font-size': 12.5, 'font-weight': 800, 'font-family': PF, direction: 'ltr' });
      var vals = [c.collection_name, c.formation, lith(c, true), ageTxt(c) + ' (' + q.p[0] + ')', String(q.n), gs];
      vals.forEach(function (v, j) { S2.text(xs[j + 1] + 8, ys + 17.5, fit(v, cols[j + 1][1] - 14), { fill: INK, 'font-size': 12, 'font-family': PF, direction: 'ltr' }); });
      ys += 26; });
    S2.line(x0, ys, W - 40, ys, { stroke: INK, 'stroke-width': .8 });
    var rest = sitePoints().length - SITEKEY.length; if (rest > 0) { S2.text(40, ys + 24, rest + ' further sites are shown on the map without numbers; the complete list is in the data table.', { fill: MUT, 'font-size': 12, 'font-family': PF, direction: 'ltr' }); ys += 24; }
    var VH = ys + 36; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); bg.setAttribute('height', VH); S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
  }
  var SSC = null;
  function siteFocus(c) {
    var F0 = $('#fSFocus'), p = per(c.max_ma, c.min_ma); F0.hidden = false; $('#fDeck').hidden = false;
    $('#fSName').textContent = c.collection_name; $('#fSSum').innerHTML = E([c.formation ? (AR ? 'تكوين ' + c.formation : c.formation + ' Formation') : '', pname(p) + ' (' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma)', c.cc ? country(c.cc) : '', c.taxa.length + ' ' + t('fossils', 'أحفورة')].filter(Boolean).join(' · '));
    $('#fSiteCap').innerHTML = t('The star marks the site on a framed location map about 100 km across, with the other fossil sites of the search coloured by period. The sheet reads the published record of the site: formation, rocks, environment, age, palaeolatitude and the fossils found, grouped by kind.', 'تدل النجمة على الموقع في خريطة موقع مؤطرة يبلغ عرضها نحو 100 كم، مع المواقع الأحفورية الأخرى في البحث ملونة حسب العصر. وتقرأ اللوحة السجل المنشور للموقع: التكوين والصخور والبيئة والعمر وخط العرض القديم والأحافير الموجودة مجمّعة حسب نوعها.');
    SSC = c; return siteSheet(c, $('#fSiteSheet'));
  }
  $('#fSClose').addEventListener('click', function () { $('#fSFocus').hidden = true; });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-goss]'); if (!b) return; var c = SITES[b.getAttribute('data-goss')]; (SSC === c ? Promise.resolve() : siteFocus(c)).then(function () { $('#fSFocus').scrollIntoView({ behavior: 'smooth', block: 'start' }); }); });
  function siteSheet(c, svg) {
    svg.setAttribute('viewBox', '0 0 1100 800'); svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var S2 = SH.svgB(svg), W = 1100, p = per(c.max_ma, c.min_ma), d = .45, b = { w: c.lng - d / Math.cos(SH.rad(c.lat)), e: c.lng + d / Math.cos(SH.rad(c.lat)), s: c.lat - d, n: c.lat + d }, f = fitBox(b), PW = 470, PH = PW / f.asp, X0 = 96, Y0 = 104;
    var bg = S2.add('rect', { x: 0, y: 0, width: W, height: 800, fill: '#fff' }), stripe = S2.add('rect', { x: 0, y: 0, width: 12, height: 800, fill: p[4] });
    S2.text(40, 48, c.collection_name, { fill: INK, 'font-size': 22, 'font-weight': 800, 'font-family': PF, direction: 'ltr' });
    S2.text(40, 74, [c.formation ? c.formation + ' Formation' : '', p[0], ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma', c.cc ? country(c.cc, true) : ''].filter(Boolean).join('   ·   '), { fill: MUT, 'font-size': 13, 'font-family': PF, direction: 'ltr' });
    var cl = clipFor(S2, X0, Y0, PW, PH), imgEl = S2.add('image', { x: X0, y: Y0, width: PW, height: PH, preserveAspectRatio: 'none', 'clip-path': cl });
    var gS = S2.g({ 'clip-path': cl }), F = mapFrame(S2, b, X0, Y0, PW, PH, f.kx);
    S.forEach(function (o) { if (o === c || o.lat < b.s || o.lat > b.n || o.lng < b.w || o.lng > b.e) return; S2.circle(F.px(o.lng), F.py(o.lat), 4.5, { fill: per(o.max_ma, o.min_ma)[4], stroke: '#111', 'stroke-width': .7 }, gS); });
    var star = function (sx, sy, R1, R2, par) { var s = ''; for (var i = 0; i < 10; i++) { var r = i % 2 ? R2 : R1, a = -Math.PI / 2 + i * Math.PI / 5; s += (i ? 'L' : 'M') + (sx + r * Math.cos(a)).toFixed(1) + ' ' + (sy + r * Math.sin(a)).toFixed(1); } return S2.path(s + 'Z', { fill: '#C0392B', stroke: '#fff', 'stroke-width': 1.5 }, par); };
    star(F.px(c.lng), F.py(c.lat), 14, 6, gS);
    var ly = F.bottom + 36; star(X0 + 8, ly - 4, 9, 4); F.tx(X0 + 24, ly + 1, 'Fossil site', { 'font-size': 12 }); S2.circle(X0 + 124, ly - 4, 4.5, { fill: '#bbb', stroke: '#111' }); F.tx(X0 + 136, ly + 1, 'Other fossil sites (coloured by period)', { 'font-size': 12 });
    var IX = X0 + PW + 90, iy = Y0 - 4, IW = W - IX - 40;
    var rows = [['Coordinates', c.lat.toFixed(5) + '°, ' + c.lng.toFixed(5) + '°'], ['Country / region', [c.county, c.state, c.cc ? country(c.cc, true) : ''].filter(Boolean).join(', ')], ['Formation', c.formation], ['Group / member', [c.geological_group, c.member].filter(Boolean).join(' / ')], ['Rock type', lith(c, true)], ['Environment', c.environment], ['Geological age', ageTxt(c) + ' (' + ma(c.max_ma) + '–' + ma(c.min_ma) + ' Ma), ' + p[0]], ['Palaeolatitude', c.paleolat !== '' && c.paleolat != null ? (+c.paleolat).toFixed(1) + '° (plate reconstruction)' : ''], ['Sampling scale', c.geogscale], ['Published in', c.primary_reference]];
    var meas = document.createElement('canvas').getContext('2d'); meas.font = '12px ' + PF;
    F.tx(IX, iy + 8, 'SITE DESCRIPTION', { 'font-size': 13.5, 'font-weight': 800, 'letter-spacing': .8 }); iy += 22;
    rows.forEach(function (r) { if (!r[1]) return; var ln = wrapTxt(meas, String(r[1]), IW - 124); S2.line(IX, iy, IX + IW, iy, { stroke: '#E2DED3' }); F.tx(IX, iy + 17, r[0], { fill: MUT, 'font-size': 11.5, 'font-weight': 700 }); ln.slice(0, 6).forEach(function (l, k) { F.tx(IX + 124, iy + 17 + k * 16, l, { 'font-size': 12 }); }); iy += 12 + Math.min(6, ln.length) * 16; });
    var fy = Math.max(ly + 40, iy + 34); S2.line(40, fy - 22, W - 40, fy - 22, { stroke: '#D9D4C7' }); F.tx(40, fy, 'FOSSILS FOUND AT THIS SITE (' + c.taxa.length + ')', { 'font-size': 13.5, 'font-weight': 800, 'letter-spacing': .8 }); fy += 10;
    var bygrp = {}; c.taxa.forEach(function (o) { var k = grp(o); (bygrp[k] = bygrp[k] || []).push(o.name); }); meas.font = 'italic 12px ' + PF;
    siteGroups(c).forEach(function (k, gi) { var names = uniq(bygrp[k]), ln = wrapTxt(meas, names.join(', '), W - 310); fy += 8; S2.circle(48, fy + 10, 5.5, { fill: gcol(k, gi), stroke: '#111', 'stroke-width': .6 }); F.tx(62, fy + 14.5, gname(k, true) + ' (' + names.length + ')', { 'font-size': 12.5, 'font-weight': 700 }); ln.forEach(function (l, j) { F.tx(260, fy + 14.5 + j * 16, l, { 'font-size': 12, 'font-style': 'italic' }); }); fy += Math.max(1, ln.length) * 16 + 4; });
    var VH = fy + 40; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); bg.setAttribute('height', VH); stripe.setAttribute('height', VH);
    S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    return baseMap(b, Math.round(PW * 2.2), Math.round(PH * 2.2)).then(function (u) { if (u) imgEl.setAttribute('href', u); return svg; });
  }

  /* ------------------------------------------------------------------ downloads */
  function exportWide(svg, name, fmt, width) {
    var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + (width || 1600) + 'px'; var c = svg.cloneNode(true); c.removeAttribute('id'); c.style.cssText = 'display:block;width:' + (width || 1600) + 'px;height:auto;min-width:0'; host.appendChild(c); document.body.appendChild(host);
    return SH.exportFigure(c, name, fmt).then(function (r) { host.remove(); return r; }, function (er) { host.remove(); throw er; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pl],[data-sheet],[data-key],[data-ssv],[data-wm],[data-wt]'); if (!b) return; var fmt = b.getAttribute('data-f') || b.getAttribute('data-sheet') || b.getAttribute('data-key') || b.getAttribute('data-ssv'); busyBtn(b, true);
    var done = function () { busyBtn(b, false); }, fail = function () { SH.toast(t('The image could not be created.', 'تعذر إنشاء الصورة.'), 'warn'); };
    var p;
    if (b.hasAttribute('data-pl')) p = plotCanvas(b.getAttribute('data-pl')).then(function (cv) { return SH.exportCanvas(cv, 'shandal-' + b.getAttribute('data-pl') + '_' + stamp(), fmt); });
    else if (b.hasAttribute('data-sheet')) p = exportWide($('#fSheet'), 'shandal-fossil-map_' + stamp(), fmt, 1650);
    else if (b.hasAttribute('data-key')) p = exportWide($('#fKey'), 'shandal-fossil-sites-key_' + stamp(), fmt, 1650);
    else if (b.hasAttribute('data-wm')) p = exportWide($('#fWMap'), 'shandal-worldwide-' + (cur.taxon ? cur.taxon.name.replace(/\s+/g, '_') : 'taxon'), fmt, 1800);
    else if (b.hasAttribute('data-wt')) p = exportWide($('#fWTime'), 'shandal-time-' + (cur.taxon ? cur.taxon.name.replace(/\s+/g, '_') : 'taxon'), fmt, 1600);
    else p = exportWide($('#fSiteSheet'), 'shandal-site-' + (SSC ? SSC.collection_no : 'site'), fmt, 1650);
    p.catch(fail).then(done);
  });

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
