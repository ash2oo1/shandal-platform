/* Geo-potential mapper — one engine for probability (potential) maps built from evidence layers by the analytic hierarchy
   process (Saaty 1980), with a recipe per question. Recipe 1: groundwater potential zones from ten layers on one regular
   grid over the area: lithology, lineament density, slope, drainage density, mean annual rainfall, topographic wetness
   index, land cover, and dry-season moisture, vegetation and land-surface temperature. Each layer is rated 1–5, the
   weighted sum is classed into five zones, and the map can be checked against known wells (success-rate curve, ROC,
   frequency ratio, Spearman correlation with yield). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', D = SH.dem;
  var PC = 'https://planetarycomputer.microsoft.com/api/', MS = 'https://macrostrat.org/api/v2/', OM = 'https://archive-api.open-meteo.com/v1/archive';
  var C = function (en, ar) { return AR ? ar : en; };
  var persist = SH.persist('potential', ['pYear', 'pRes', 'pCls', 'pOp']);
  var map = SH.map('pMap', { zoom: 7, base: 'satellite', center: [33.3, 43.6] });

  /* ---------------------------------------------------------------- recipe: groundwater */
  var CLS = [['#b2182b', 'Very low', 'منخفضة جداً'], ['#ef8a62', 'Low', 'منخفضة'], ['#f6dc7d', 'Moderate', 'متوسطة'], ['#67a9cf', 'High', 'عالية'], ['#2166ac', 'Very high', 'عالية جداً']];
  var LC = { 10: ['#006400', 'Tree cover', 'غطاء شجري', 4], 20: ['#ffbb22', 'Shrubland', 'شجيرات', 3], 30: ['#ffff4c', 'Grassland', 'أعشاب', 3], 40: ['#f096ff', 'Cropland', 'أراضٍ زراعية', 4], 50: ['#fa0000', 'Built-up', 'عمران', 1],
    60: ['#b4b4b4', 'Bare or sparse vegetation', 'أرض جرداء أو نبات متناثر', 2], 70: ['#f0f0f0', 'Snow and ice', 'ثلج وجليد', 3], 80: ['#0064c8', 'Permanent water', 'مياه دائمة', 5], 90: ['#0096a0', 'Herbaceous wetland', 'أراضٍ رطبة عشبية', 5], 95: ['#00cf75', 'Mangroves', 'مانغروف', 5], 100: ['#fae6a0', 'Moss and lichen', 'طحالب وأشنات', 3] };
  /* lithology → groundwater rating (porosity and permeability of the rock or deposit) */
  var LITH = { gravel: [5, 'Gravel and alluvium', 'حصى ورواسب نهرية'], sand: [5, 'Sand', 'رمل'], quat: [4, 'Quaternary deposits', 'رواسب العصر الرباعي'], conglomerate: [4, 'Conglomerate', 'مدملكات'], limestone: [4, 'Limestone (karst)', 'حجر جيري (كارستي)'], dolomite: [4, 'Dolomite', 'دولومايت'], reef: [4, 'Reef limestone', 'حجر جيري مرجاني'], oolitic: [4, 'Oolitic limestone', 'حجر جيري سرئي'],
    sandstone: [4, 'Sandstone', 'حجر رملي'], breccia: [3, 'Breccia', 'بريشيا'], chalk: [3, 'Chalk', 'طباشير'], basalt: [3, 'Basalt', 'بازلت'], marble: [3, 'Marble', 'رخام'], gypsum: [3, 'Gypsum', 'جبس'], anhydrite: [2, 'Anhydrite', 'أنهايدرايت'], tuff: [2, 'Tuff', 'طف بركاني'], silt: [2, 'Silt', 'غرين'], siltstone: [2, 'Siltstone', 'حجر غريني'], marl: [2, 'Marl', 'مارل'],
    andesite: [2, 'Andesite', 'أنديسايت'], rhyolite: [2, 'Rhyolite', 'رايولايت'], granite: [2, 'Granite', 'غرانيت'], diorite: [2, 'Diorite', 'دايورايت'], gabbro: [2, 'Gabbro, ophiolite', 'غابرو، أفيولايت'], gneiss: [2, 'Gneiss', 'نايس'], schist: [2, 'Schist', 'شيست'], quartzite: [2, 'Quartzite', 'كوارتزايت'], serpentinite: [2, 'Serpentinite', 'سربنتينايت'], coal: [2, 'Coal', 'فحم'], chert: [2, 'Chert', 'صوان'], phosphorite: [2, 'Phosphorite', 'فوسفورايت'],
    phyllite: [1, 'Phyllite', 'فيلايت'], slate: [1, 'Slate', 'أردواز'], clay: [1, 'Clay', 'طين'], claystone: [1, 'Claystone', 'حجر طيني'], mudstone: [1, 'Mudstone', 'حجر وحلي'], shale: [1, 'Shale', 'طفل صفحي'], halite: [1, 'Rock salt', 'ملح صخري'] };
  function lithKey(s) { s = String(s || '').toLowerCase(); var K = [[/dolomit|dolostone/, 'dolomite'], [/chalk/, 'chalk'], [/marl/, 'marl'], [/oolit/, 'oolitic'], [/reef|boundstone/, 'reef'], [/limestone|carbonate|calcar/, 'limestone'], [/anhydrite/, 'anhydrite'], [/gypsum|evaporite/, 'gypsum'], [/halite|salt/, 'halite'], [/conglomerate/, 'conglomerate'], [/breccia/, 'breccia'],
      [/sandstone|arenite|greywacke|arkose/, 'sandstone'], [/siltstone/, 'siltstone'], [/claystone/, 'claystone'], [/mudstone/, 'mudstone'], [/shale/, 'shale'], [/chert/, 'chert'], [/phosph/, 'phosphorite'], [/coal|lignite/, 'coal'], [/gravel|alluvi|fan|terrace/, 'gravel'], [/sand|dune|eolian|aeolian/, 'sand'], [/silt|loess/, 'silt'], [/clay|mud/, 'clay'],
      [/tuff|pyroclast/, 'tuff'], [/basalt|mafic volcanic|lava/, 'basalt'], [/andesit/, 'andesite'], [/rhyolit|felsic volcanic/, 'rhyolite'], [/gabbro|ultramafic|ophiolit/, 'gabbro'], [/diorit/, 'diorite'], [/granit|plutonic|intrusive/, 'granite'], [/serpentin/, 'serpentinite'], [/marble/, 'marble'], [/quartzite/, 'quartzite'], [/gneiss|migmatit/, 'gneiss'], [/schist/, 'schist'], [/phyllite/, 'phyllite'], [/slate/, 'slate'], [/metamorph/, 'schist'], [/volcanic/, 'basalt'],
      [/quaternary|holocene|pleistocene|recent/, 'quat']];
    for (var i = 0; i < K.length; i++) if (K[i][0].test(s)) return K[i][1]; return ''; }

  /* kind: 'abs' fixed class limits (br) · 'q' quintiles of the area · 'cat' categorical. dir +1: higher value = higher potential */
  var GW = [
    { k: 'lith', n: C('Lithology', 'الصخارية'), imp: 9, kind: 'cat', d: C('Primary porosity and permeability of the rock or deposit at the surface.', 'المسامية والنفاذية الأولية للصخر أو الراسب على السطح.') },
    { k: 'lin', n: C('Lineament density', 'كثافة الخطوط التركيبية'), imp: 8, kind: 'q', dir: 1, u: 'km/km²', dp: 2, d: C('Faults and fractures are paths for infiltration and storage, so a dense network raises the potential.', 'الفوالق والكسور مسارات للتسرب والخزن، لذا ترفع كثافتها الاحتمالية.') },
    { k: 'slope', n: C('Slope', 'الانحدار'), imp: 7, kind: 'abs', dir: -1, br: [2, 5, 10, 20], u: '°', dp: 1, d: C('Gentle ground holds rain long enough to infiltrate; steep ground sheds it as runoff.', 'الأرض قليلة الانحدار تحتفظ بالمطر مدة تكفي لتسربه، والشديدة تصرفه جرياناً سطحياً.') },
    { k: 'dd', n: C('Drainage density', 'كثافة التصريف'), imp: 7, kind: 'q', dir: -1, u: 'km/km²', dp: 2, d: C('A dense stream network marks impermeable ground where rain runs off instead of soaking in.', 'الشبكة النهرية الكثيفة تدل على أرض قليلة النفاذية يجري عليها المطر بدل أن يتسرب.') },
    { k: 'rain', n: C('Mean annual rainfall', 'معدل الأمطار السنوي'), imp: 6, kind: 'abs', dir: 1, br: [100, 200, 350, 600], u: 'mm', dp: 0, d: C('The source of recharge: ten-year mean of annual totals.', 'مصدر التغذية: متوسط المجاميع السنوية لعشر سنوات.') },
    { k: 'twi', n: C('Topographic wetness index', 'مؤشر الرطوبة الطبوغرافي'), imp: 6, kind: 'q', dir: 1, u: '', dp: 1, d: C('ln(a / tan β): where water converges on flat ground and the soil stays wet.', 'ln(a / tan β): حيث يتجمع الماء على أرض مستوية وتبقى التربة رطبة.') },
    { k: 'lulc', n: C('Land cover', 'الغطاء الأرضي'), imp: 5, kind: 'cat', d: C('Vegetated, cultivated and wet land favours infiltration; built-up and bare land do not.', 'الأرض المزروعة والنباتية والرطبة تساعد التسرب، والعمران والأرض الجرداء لا تساعده.') },
    { k: 'ndmi', n: C('Dry-season moisture (NDMI)', 'رطوبة الموسم الجاف (NDMI)'), imp: 5, kind: 'q', dir: 1, u: '', dp: 2, d: C('Ground that stays moist at the end of summer is often fed by shallow groundwater.', 'الأرض التي تبقى رطبة في آخر الصيف كثيراً ما تغذيها مياه جوفية ضحلة.') },
    { k: 'ndvi', n: C('Dry-season vegetation (NDVI)', 'نبات الموسم الجاف (NDVI)'), imp: 4, kind: 'q', dir: 1, u: '', dp: 2, d: C('Plants that stay green without rain draw on shallow water; irrigated fields give the same signal, so read it with land cover.', 'النبات الذي يبقى أخضر بلا مطر يعتمد على مياه ضحلة؛ والحقول المروية تعطي الإشارة نفسها، لذا يُقرأ مع الغطاء الأرضي.') },
    { k: 'lst', n: C('Dry-season surface temperature', 'حرارة السطح في الموسم الجاف'), imp: 4, kind: 'q', dir: -1, u: C('°C from scene median', '°م عن وسيط المشهد'), dp: 1, d: C('Moist ground is cooler by evaporation, so relatively cool ground in summer is rated higher. Each scene is read relative to its own median, so scenes of different days join without steps.', 'الأرض الرطبة أبرد بسبب التبخر، لذا تُقيّم الأرض الأبرد نسبياً في الصيف أعلى. يُقرأ كل مشهد نسبةً إلى وسيطه، فتلتحم مشاهد الأيام المختلفة بلا قفزات.') }
  ];
  var F = GW, FK = {}; F.forEach(function (f) { FK[f.k] = f; });

  /* ---------------------------------------------------------------- state */
  var aoi = SH.store.get('shandal_pz_aoi', null), aoiLay = null, drawer = null, G = null, ov = null, wells = SH.store.get('shandal_pz_wells', []), wLay = L ? L.layerGroup() : null, addMode = false, userLin = null, busy = false;
  var saved = SH.store.get('shandal_pz_imp', {}); F.forEach(function (f) { f.on = saved[f.k] ? saved[f.k][0] !== false : true; f.w8 = saved[f.k] ? saved[f.k][1] : f.imp; });
  if (map) wLay.addTo(map);
  /* Arabic: the assistant button sits bottom-left, so the scale bar moves to the bottom-right corner */
  if (map && AR) { var scl = map.getContainer().querySelector('.leaflet-control-scale'), br = map.getContainer().querySelector('.leaflet-bottom.leaflet-right'); if (scl && br) br.insertBefore(scl, br.firstChild); }

  /* ---------------------------------------------------------------- dry-season year */
  (function () { var now = new Date(), y = now.getUTCFullYear() - (now.getUTCMonth() >= 9 ? 0 : 1), s = $('#pYear'), o = ''; for (var k = 0; k < 8; k++) o += '<option value="' + (y - k) + '">' + (y - k) + '</option>'; s.innerHTML = o;
    var sv = SH.store.get('shandal_tool_potential', {}); if (sv.pYear && +sv.pYear <= y && +sv.pYear > y - 8) s.value = sv.pYear; })();

  /* ---------------------------------------------------------------- AHP: pairwise matrix from importance scores, principal eigenvector, consistency */
  var RI = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51, 1.48];
  function ahp(s) {
    var n = s.length, A = [], i, j, w = [], k;
    for (i = 0; i < n; i++) { A.push([]); for (j = 0; j < n; j++) { var d = s[i] - s[j]; A[i].push(d >= 0 ? Math.min(9, d + 1) : 1 / Math.min(9, 1 - d)); } }
    for (i = 0; i < n; i++) w.push(1 / n);
    for (k = 0; k < 200; k++) { var nw = [], sm = 0; for (i = 0; i < n; i++) { var v = 0; for (j = 0; j < n; j++) v += A[i][j] * w[j]; nw.push(v); sm += v; } w = nw.map(function (v) { return v / sm; }); }
    var lam = 0; for (i = 0; i < n; i++) { var aw = 0; for (j = 0; j < n; j++) aw += A[i][j] * w[j]; lam += aw / w[i]; } lam /= n;
    var CI = n > 2 ? (lam - n) / (n - 1) : 0, CR = n > 2 ? CI / RI[n] : 0;
    return { w: w, lam: lam, CI: CI, CR: CR, A: A };
  }
  var AH = null;
  function weights() {
    var act = F.filter(function (f) { return f.on && f.st !== 'bad'; }); F.forEach(function (f) { f.w = 0; });
    if (act.length) { AH = ahp(act.map(function (f) { return f.w8; })); act.forEach(function (f, i) { f.w = AH.w[i]; }); } else AH = null;
    F.forEach(function (f) { var e = $('#pw_' + f.k); if (e) e.textContent = f.on && f.w ? SH.fmt(f.w * 100, 1) + '%' : '—'; });
    $('#pCR').innerHTML = AH ? '<span>λ<sub>max</sub> <b class="ltr">' + SH.fmt(AH.lam, 3) + '</b></span><span>CI <b class="ltr">' + SH.fmt(AH.CI, 3) + '</b></span><span>CR <b class="ltr" style="color:var(--' + (AH.CR < 0.1 ? 'ok' : 'warn') + ')">' + SH.fmt(AH.CR, 3) + '</b></span><span class="muted">' + (AH.CR < 0.1 ? t('consistent (CR < 0.10)', 'متسقة (CR < 0.10)') : t('inconsistent: soften the differences', 'غير متسقة: قلّل الفروق')) + '</span>' : '';
    SH.store.set('shandal_pz_imp', F.reduce(function (o, f) { o[f.k] = [f.on, f.w8]; return o; }, {}));
  }
  function rows() {
    $('#pF').innerHTML = F.map(function (f) { return '<div class="row" title="' + SH.esc(f.d) + '"><input type="checkbox" id="pc_' + f.k + '" ' + (f.on ? 'checked' : '') + ' aria-label="' + SH.esc(f.n) + '"><label for="pc_' + f.k + '">' + SH.esc(f.n) + '</label><input type="range" min="1" max="9" step="1" value="' + f.w8 + '" id="pi_' + f.k + '" aria-label="' + SH.esc(f.n) + '"><span class="w" id="pw_' + f.k + '"></span><span class="st" id="ps_' + f.k + '" data-s="' + (f.st || 'off') + '"></span></div>'; }).join('');
    weights();
  }
  rows();
  $('#pF').addEventListener('input', function (e) { var id = e.target.id || ''; if (!/^p[ci]_/.test(id)) return; var f = FK[id.slice(3)]; if (id[1] === 'c') f.on = e.target.checked; else f.w8 = +e.target.value; weights(); if (G && G.done) { compose(); } });
  $('#pDef').addEventListener('click', function () { F.forEach(function (f) { f.on = true; f.w8 = f.imp; }); rows(); if (G && G.done) compose(); });
  function status(k, s) { var f = FK[k]; f.st = s; var e = $('#ps_' + k); if (e) e.setAttribute('data-s', s); }

  /* ---------------------------------------------------------------- area */
  function km(b) { var kx = 111.32 * Math.cos(SH.rad((b.n + b.s) / 2)); return { w: (b.e - b.w) * kx, h: (b.n - b.s) * 110.57 }; }
  function setAoi(b) { aoi = b; SH.store.set('shandal_pz_aoi', b); if (!map) return; if (aoiLay) map.removeLayer(aoiLay); aoiLay = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: '#FFD60A', weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map);
    var k = km(b), a = k.w * k.h; $('#pAoi').innerHTML = '<span class="ltr">' + SH.fmt(k.w, 1) + ' × ' + SH.fmt(k.h, 1) + ' km · ' + SH.fmt(a, 1) + ' km²</span>' + (a > 2500 ? ' · <span style="color:var(--bad)">' + t('too large: keep it under 2500 km²', 'كبيرة جداً: اجعلها أقل من 2500 كم²') + '</span>' : a < 4 ? ' · <span style="color:var(--bad)">' + t('too small: at least 4 km²', 'صغيرة جداً: 4 كم² على الأقل') + '</span>' : ''); }
  if (aoi) { setAoi(aoi); if (map) map.fitBounds([[aoi.s, aoi.w], [aoi.n, aoi.e]]); }
  $('#pDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#pHint')); });
  $('#pView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  /* ---------------------------------------------------------------- data access */
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  /* the imagery service answers 503 when it is busy: retry with a growing pause */
  function pcFetch(url, opts, n) {
    n = n || 0; var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 45000);
    return fetch(url, Object.assign({}, opts || {}, { signal: ctl.signal })).then(function (r) { clearTimeout(tm); if (r.ok) return r; if ((r.status === 503 || r.status === 429 || r.status === 502 || r.status === 504) && n < 7) return sleep(1200 * (n + 1) + Math.random() * 800).then(function () { return pcFetch(url, opts, n + 1); }); throw new Error('HTTP ' + r.status); },
      function (e) { clearTimeout(tm); if (n < 3 && e.name !== 'AbortError') return sleep(1500 * (n + 1)).then(function () { return pcFetch(url, opts, n + 1); }); throw e; });
  }
  function search(body) { return pcFetch(PC + 'stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (j) { return j.features || []; }); }
  function npy(buf) {
    var u8 = new Uint8Array(buf), maj = u8[6], hl = maj >= 2 ? (u8[8] | (u8[9] << 8) | (u8[10] << 16) | (u8[11] << 24)) : (u8[8] | (u8[9] << 8)), o0 = maj >= 2 ? 12 : 10, off = o0 + hl, h = new TextDecoder().decode(u8.slice(o0, off));
    var ds = /descr': '([^']+)'/.exec(h)[1], sh = /shape': \(([^)]*)\)/.exec(h)[1].split(',').filter(function (s) { return s.trim(); }).map(Number);
    var T = { '<f8': Float64Array, '<f4': Float32Array, '|u1': Uint8Array, '<u1': Uint8Array, '<u2': Uint16Array, '<i2': Int16Array, '<i4': Int32Array, '|i1': Int8Array, '<u4': Uint32Array }[ds];
    if (!T) throw new Error('npy ' + ds); return { shape: sh, data: new T(buf.slice(off)) };
  }
  /* fill the grid from scenes in order (same date first), each request aligned to whole grid cells */
  function mosaic(items, coll, query, nb, okv, onDone, rel) {
    var out = []; for (var q = 0; q < nb; q++) { var a = new Float32Array(G.n); a.fill(NaN); out.push(a); }
    var done = new Uint8Array(G.n), used = [], left = function (i0, i1, j0, j1) { for (var j = j0; j < j1; j++) for (var i = i0; i < i1; i++) if (isNaN(out[0][j * G.nx + i])) return true; return false; };
    return items.slice(0, 8).reduce(function (p, it) { return p.then(function () {
      var bb = it.bbox, i0 = Math.max(0, Math.floor((bb[0] - G.b.w) / G.dlon)), i1 = Math.min(G.nx, Math.ceil((bb[2] - G.b.w) / G.dlon)), j0 = Math.max(0, Math.floor((G.b.n - bb[3]) / G.dlat)), j1 = Math.min(G.ny, Math.ceil((G.b.n - bb[1]) / G.dlat));
      if (i1 - i0 < 1 || j1 - j0 < 1 || !left(i0, i1, j0, j1)) return;
      var box = [G.b.w + i0 * G.dlon, G.b.n - j1 * G.dlat, G.b.w + i1 * G.dlon, G.b.n - j0 * G.dlat].map(function (v) { return v.toFixed(7); }).join(',');
      return pcFetch(PC + 'data/v1/item/bbox/' + box + '/' + (i1 - i0) + 'x' + (j1 - j0) + '.npy?collection=' + coll + '&item=' + encodeURIComponent(it.id) + '&' + query(it)).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        var A = npy(buf), W = A.shape[2], H = A.shape[1], B = A.shape[0], m = A.data.subarray((B - 1) * W * H), got = 0;
        for (var j = 0; j < H && j0 + j < G.ny; j++) for (var i = 0; i < W && i0 + i < G.nx; i++) { var c = (j0 + j) * G.nx + i0 + i, p = j * W + i; if (!isNaN(out[0][c]) || !m[p]) continue;
          var ok = true, v = []; for (q = 0; q < nb; q++) { v.push(A.data[q * W * H + p]); if (!okv(v[q], q)) ok = false; } if (!ok) continue; for (q = 0; q < nb; q++) out[q][c] = v[q]; got++; }
        if (got) { used.push(it); if (rel) { var vals = [], idx = []; for (var j4 = j0; j4 < j1; j4++) for (var i4 = i0; i4 < i1; i4++) { var c4 = j4 * G.nx + i4; if (isFinite(out[0][c4]) && !done[c4]) { vals.push(out[0][c4]); idx.push(c4); } }
            vals.sort(function (x, y) { return x - y; }); var med = vals[Math.floor(vals.length / 2)]; idx.forEach(function (c4) { out[0][c4] -= med; done[c4] = 1; }); } }
      }).catch(function () {});
    }); }, Promise.resolve()).then(function () { if (onDone) onDone(used); return { arr: out, used: used }; });
  }
  function byDate(items) { if (!items.length) return items; items.sort(function (a, b) { return (a.properties['eo:cloud_cover'] || 0) - (b.properties['eo:cloud_cover'] || 0); }); var d0 = items[0].properties.datetime.slice(0, 10);
    return items.filter(function (i) { return i.properties.datetime.slice(0, 10) === d0; }).concat(items.filter(function (i) { return i.properties.datetime.slice(0, 10) !== d0; })); }
  function season() { var y = +SH.val('pYear'), south = (G.b.n + G.b.s) / 2 < 0; return south ? (y - 1) + '-12-01T00:00:00Z/' + y + '-03-31T23:59:59Z' : y + '-06-01T00:00:00Z/' + y + '-09-30T23:59:59Z'; }
  var BB = function () { return [G.b.w, G.b.s, G.b.e, G.b.n]; };

  /* elevation (30 m elevation model, resampled to the grid; global terrain tiles as fallback) */
  function getDem() {
    var pad = Math.max(G.dlon, G.dlat) * 2, b = { n: G.b.n + pad, s: G.b.s - pad, e: G.b.e + pad, w: G.b.w - pad };
    var fill = function (f) { var Z = new Float32Array(G.n); for (var j = 0; j < G.ny; j++) for (var i = 0; i < G.nx; i++) Z[j * G.nx + i] = f(G.lat(j), G.lon(i)); return Z; };
    return SH.pc.dem(b, 'cop-dem-glo-30', null, 1400).then(fill).catch(function () { return D.terrarium(b, G.cell).then(fill); });
  }
  function getS2() {
    var q = function (cl) { return search({ collections: ['sentinel-2-l2a'], bbox: BB(), datetime: season(), query: { 'eo:cloud_cover': { lt: cl } }, sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }], limit: 40 }); };
    return q(5).then(function (it) { return it.length ? it : q(20); }).then(function (it) { if (!it.length) throw new Error('no scene');
      var off = function (s) { return function (x) { return x.properties['s2:processing_baseline'] >= '04.00' ? s.replace(/B(0[1-9]|1[0-2]|8A)/g, '(B$1-1000)') : s; }; };
      return mosaic(byDate(it), 'sentinel-2-l2a', function (x) { return 'expression=' + encodeURIComponent(off('(B08-B04)/(B08+B04);(B08-B11)/(B08+B11)')(x)) + '&asset_as_band=true'; }, 2, function (v) { return isFinite(v) && v >= -1 && v <= 1; }); });
  }
  function getLst() {
    var q = function (cl) { return search({ collections: ['landsat-c2-l2'], bbox: BB(), datetime: season(), query: { 'eo:cloud_cover': { lt: cl }, platform: { in: ['landsat-8', 'landsat-9'] } }, sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }], limit: 30 }); };
    return q(10).then(function (it) { return it.length ? it : q(30); }).then(function (it) { if (!it.length) throw new Error('no scene');
      return mosaic(byDate(it), 'landsat-c2-l2', function () { return 'expression=' + encodeURIComponent('lwir11*0.00341802+149.0-273.15') + '&asset_as_band=true'; }, 1, function (v) { return isFinite(v) && v > -40 && v < 85; }, null, true); });
  }
  function getLc() {
    return search({ collections: ['esa-worldcover'], bbox: BB(), limit: 20 }).then(function (it) { if (!it.length) throw new Error('none');
      it.sort(function (a, b) { return (b.properties['esa_worldcover:product_version'] || '').localeCompare(a.properties['esa_worldcover:product_version'] || ''); });
      return mosaic(it, 'esa-worldcover', function () { return 'assets=map&resampling=nearest'; }, 1, function (v) { return !!LC[v]; }); });
  }
  /* rainfall: ten complete years of daily totals at 3 × 3 points, interpolated bilinearly */
  function getRain() {
    var y1 = new Date().getUTCFullYear() - 1, y0 = y1 - 9, la = [G.b.s, (G.b.s + G.b.n) / 2, G.b.n], lo = [G.b.w, (G.b.w + G.b.e) / 2, G.b.e], pl = [], pn = [];
    la.forEach(function (a) { lo.forEach(function (o) { pl.push(a.toFixed(4)); pn.push(o.toFixed(4)); }); });
    return SH.getJSON(OM + '?latitude=' + pl.join(',') + '&longitude=' + pn.join(',') + '&start_date=' + y0 + '-01-01&end_date=' + y1 + '-12-31&daily=precipitation_sum&timezone=UTC', { timeout: 60000 }).then(function (j) {
      var arr = Array.isArray(j) ? j : [j], P = arr.map(function (r) { var s = 0, n = 0; (r.daily.precipitation_sum || []).forEach(function (v) { if (v != null) { s += v; n++; } }); return n > 300 ? s / (n / 365.25) : NaN; });
      if (P.some(function (v) { return !isFinite(v); })) throw new Error('rain');
      var R = new Float32Array(G.n); for (var j2 = 0; j2 < G.ny; j2++) for (var i = 0; i < G.nx; i++) { var fy = (G.lat(j2) - G.b.s) / (G.b.n - G.b.s) * 2, fx = (G.lon(i) - G.b.w) / (G.b.e - G.b.w) * 2, iy = Math.min(1, Math.floor(fy)), ix = Math.min(1, Math.floor(fx)), ty = fy - iy, tx = fx - ix, at = function (a, b) { return P[a * 3 + b]; };
        R[j2 * G.nx + i] = at(iy, ix) * (1 - tx) * (1 - ty) + at(iy, ix + 1) * tx * (1 - ty) + at(iy + 1, ix) * (1 - tx) * ty + at(iy + 1, ix + 1) * tx * ty; }
      G.rainYears = y0 + '–' + y1; return R; });
  }
  /* lithology: the most detailed geological map unit at a grid of points; each cell takes the unit of the nearest point */
  function getLith() {
    var k = km(G.b), ns = SH.clamp(Math.round(Math.sqrt(k.w * k.h) / 5), 4, 7), pts = [], units = {}, i, j;
    for (j = 0; j < ns; j++) for (i = 0; i < ns; i++) pts.push({ lat: G.b.s + (j + 0.5) / ns * (G.b.n - G.b.s), lon: G.b.w + (i + 0.5) / ns * (G.b.e - G.b.w) });
    var ORD = { large: 0, medium: 1, small: 2, tiny: 3 }, q = 0;
    var one = function (p) { return SH.getJSON(MS + 'geologic_units/map?lat=' + p.lat.toFixed(5) + '&lng=' + p.lon.toFixed(5), { timeout: 25000 }).then(function (jj) { var d = (jj && jj.success && jj.success.data) || [];
        d.sort(function (a, b) { return (ORD[a.scale] != null ? ORD[a.scale] : 9) - (ORD[b.scale] != null ? ORD[b.scale] : 9); }); var u = d[0]; if (!u) return;
        var id = String(u.map_id || u.name); if (!units[id]) { var txt = [u.lith, (u.liths || []).map(function (l) { return l.lith || l.name; }).join(' '), u.name, u.strat_name, u.descrip].join(' '), lk = lithKey([u.lith, u.name, u.strat_name, u.descrip].join(' ')), age = [u.b_int_name, u.t_int_name].filter(Boolean);
          if (!lk && /quaternary|holocene|pleistocene/i.test(age.join(' ') + ' ' + txt) && !/pliocene|miocene/i.test(u.b_int_name || '')) lk = 'quat';
          units[id] = { id: id, name: u.name || u.strat_name || '—', lith: u.lith || '', age: age.filter(function (v, x, a) { return a.indexOf(v) === x; }).join(' – '), color: u.color || '#cccccc', lk: lk, r: lk ? LITH[lk][0] : 3, rated: !!lk, n: 0 }; }
        units[id].n++; p.u = id; }).catch(function () {}); };
    var run = function () { if (q >= pts.length) return Promise.resolve(); var b = pts.slice(q, q + 5); q += 5; return Promise.all(b.map(one)).then(run); };
    return run().then(function () {
      if (!Object.keys(units).length) throw new Error('none');
      var U = new Int32Array(G.n).fill(-1), ids = Object.keys(units);
      for (var c = 0; c < G.n; c++) { var j3 = Math.floor(c / G.nx), i3 = c % G.nx, best = -1, nd = 1e9;
        pts.forEach(function (p) { if (!p.u) return; var dd2 = Math.pow((p.lat - G.lat(j3)) / G.dlat, 2) + Math.pow((p.lon - G.lon(i3)) / G.dlon, 2); if (dd2 < nd) { nd = dd2; best = ids.indexOf(p.u); } }); U[c] = best; }
      G.units = ids.map(function (id) { return units[id]; }); G.lithPts = pts.filter(function (p) { return p.u; }).length; return U;
    });
  }
  /* ---------------------------------------------------------------- terrain analysis on the grid */
  function terrain(Z) {
    var nx = G.nx, ny = G.ny, n = G.n, dx = G.dx, dy = G.dy, i, j, c, k;
    var mean = 0, cnt = 0; for (c = 0; c < n; c++) if (isFinite(Z[c])) { mean += Z[c]; cnt++; } mean /= cnt || 1; for (c = 0; c < n; c++) if (!isFinite(Z[c])) Z[c] = mean;
    var at = function (i, j) { i = i < 0 ? 0 : i >= nx ? nx - 1 : i; j = j < 0 ? 0 : j >= ny ? ny - 1 : j; return Z[j * nx + i]; };
    var S = new Float32Array(n), HXX = new Float32Array(n), HYY = new Float32Array(n), HXY = new Float32Array(n);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var a = at(i - 1, j - 1), b = at(i, j - 1), cc = at(i + 1, j - 1), d = at(i - 1, j), e = at(i, j), f = at(i + 1, j), g = at(i - 1, j + 1), h = at(i, j + 1), q = at(i + 1, j + 1);
      var gx = ((cc + 2 * f + q) - (a + 2 * d + g)) / (8 * dx), gy = ((g + 2 * h + q) - (a + 2 * b + cc)) / (8 * dy); S[j * nx + i] = SH.deg(Math.atan(Math.sqrt(gx * gx + gy * gy)));
      HXX[j * nx + i] = (d - 2 * e + f) / (dx * dx); HYY[j * nx + i] = (b - 2 * e + h) / (dy * dy); HXY[j * nx + i] = (q - g - cc + a) / (4 * dx * dy); }
    /* priority-flood depression filling (Barnes et al. 2014) with a small gradient so every cell drains */
    var Fz = new Float64Array(n), done = new Uint8Array(n), heap = [], hp = function (v) { heap.push(v); var x = heap.length - 1; while (x > 0) { var p = (x - 1) >> 1; if (Fz[heap[p]] <= Fz[heap[x]]) break; var tmp = heap[p]; heap[p] = heap[x]; heap[x] = tmp; x = p; } },
      pop = function () { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var x = 0; for (;;) { var l = 2 * x + 1, r = l + 1, m = x; if (l < heap.length && Fz[heap[l]] < Fz[heap[m]]) m = l; if (r < heap.length && Fz[heap[r]] < Fz[heap[m]]) m = r; if (m === x) break; var tmp = heap[m]; heap[m] = heap[x]; heap[x] = tmp; x = m; } } return top; };
    for (c = 0; c < n; c++) Fz[c] = Z[c];
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { c = j * nx + i; done[c] = 1; hp(c); }
    var DI = [-1, 0, 1, -1, 1, -1, 0, 1], DJ = [-1, -1, -1, 0, 0, 1, 1, 1], DL = DI.map(function (u, x) { return Math.sqrt(Math.pow(u * dx, 2) + Math.pow(DJ[x] * dy, 2)); });
    while (heap.length) { c = pop(); i = c % nx; j = (c - i) / nx; for (k = 0; k < 8; k++) { var ii = i + DI[k], jj = j + DJ[k]; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; var nn = jj * nx + ii; if (done[nn]) continue; done[nn] = 1; if (Fz[nn] <= Fz[c]) Fz[nn] = Fz[c] + 1e-4; hp(nn); } }
    /* D8 flow directions and accumulation */
    var dn = new Int32Array(n).fill(-1), dl = new Float32Array(n);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { c = j * nx + i; var best = 0; for (k = 0; k < 8; k++) { var i2 = i + DI[k], j2 = j + DJ[k]; if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny) continue; var s = (Fz[c] - Fz[j2 * nx + i2]) / DL[k]; if (s > best) { best = s; dn[c] = j2 * nx + i2; dl[c] = DL[k]; } } if (dn[c] < 0) dl[c] = Math.sqrt(dx * dy); }
    var ord = new Int32Array(n); for (c = 0; c < n; c++) ord[c] = c; ord.sort(function (a, b) { return Fz[b] - Fz[a]; });
    var acc = new Float32Array(n).fill(1); for (k = 0; k < n; k++) { c = ord[k]; if (dn[c] >= 0) acc[dn[c]] += acc[c]; }
    var cellA = dx * dy, thr = Math.max(0.5e6, 20 * cellA), LEN = new Float32Array(n), TW = new Float32Array(n), w = Math.sqrt(dx * dy);
    for (c = 0; c < n; c++) { if (acc[c] * cellA >= thr) LEN[c] = dl[c]; TW[c] = Math.log(acc[c] * cellA / w / Math.max(Math.tan(SH.rad(S[c])), 0.001)); }
    /* lineaments: elongated zones of strong one-directional curvature (linear valleys and scarps) in the terrain */
    var AN = new Float32Array(n), sgn = new Int8Array(n);
    for (c = 0; c < n; c++) { var tr = HXX[c] + HYY[c], df = Math.sqrt(Math.pow(HXX[c] - HYY[c], 2) + 4 * HXY[c] * HXY[c]), l1 = (tr + df) / 2, l2 = (tr - df) / 2, big = Math.abs(l1) > Math.abs(l2) ? l1 : l2, sm = Math.abs(l1) > Math.abs(l2) ? l2 : l1; AN[c] = Math.abs(big) - Math.abs(sm); sgn[c] = big > 0 ? 1 : -1; }
    var sorted = Array.prototype.slice.call(AN).sort(function (a, b) { return a - b; }), p88 = sorted[Math.floor(n * 0.88)], abs = 1.2 / (dx * dy), th = Math.max(p88, abs), M = new Uint8Array(n);
    for (c = 0; c < n; c++) if (AN[c] > th && S[c] > 0.4) M[c] = 1;
    var LIN = new Float32Array(n), lab = new Int32Array(n).fill(-1), stack = [], segs = 0;
    for (c = 0; c < n; c++) { if (!M[c] || lab[c] >= 0) continue; var comp = [], sx = 0, sy = 0; stack.push(c); lab[c] = c;
      while (stack.length) { var u = stack.pop(), ui = u % nx, uj = (u - ui) / nx; comp.push(u); sx += ui; sy += uj; for (k = 0; k < 8; k++) { var vi = ui + DI[k], vj = uj + DJ[k]; if (vi < 0 || vj < 0 || vi >= nx || vj >= ny) continue; var v = vj * nx + vi; if (M[v] && lab[v] < 0 && sgn[v] === sgn[c]) { lab[v] = c; stack.push(v); } } }
      if (comp.length < 4) continue; var mx = sx / comp.length, my = sy / comp.length, cxx = 0, cyy = 0, cxy = 0;
      comp.forEach(function (u) { var ex = (u % nx - mx) * dx, ey = ((u - u % nx) / nx - my) * dy; cxx += ex * ex; cyy += ey * ey; cxy += ex * ey; }); cxx /= comp.length; cyy /= comp.length; cxy /= comp.length;
      var tt = cxx + cyy, dd = Math.sqrt(Math.pow(cxx - cyy, 2) + 4 * cxy * cxy), la = (tt + dd) / 2, lb = Math.max((tt - dd) / 2, 1e-6);
      if (la / lb < 9) continue; /* axis ratio ≥ 3 */ var len = 4 * Math.sqrt(la); segs++; comp.forEach(function (u) { LIN[u] = len / comp.length; }); }
    if (userLin) { LIN.fill(0); rasterLines(userLin, LIN); }
    var R1 = SH.clamp(Math.round(1000 / G.cell), 2, 14), R2 = SH.clamp(Math.round(1500 / G.cell), 3, 18);
    return { slope: S, dd: density(LEN, R1), twi: TW, lin: density(LIN, R2), fill: Fz, acc: acc, chan: LEN, linRaw: LIN, segs: segs, R1: R1, R2: R2 };
  }
  /* length per cell summed in a square window → km per km² */
  function density(LEN, R) {
    var nx = G.nx, ny = G.ny, I = new Float64Array((nx + 1) * (ny + 1)), i, j, out = new Float32Array(G.n);
    for (j = 0; j < ny; j++) { var row = 0; for (i = 0; i < nx; i++) { row += LEN[j * nx + i]; I[(j + 1) * (nx + 1) + i + 1] = I[j * (nx + 1) + i + 1] + row; } }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var i0 = Math.max(0, i - R), i1 = Math.min(nx, i + R + 1), j0 = Math.max(0, j - R), j1 = Math.min(ny, j + R + 1), s = I[j1 * (nx + 1) + i1] - I[j0 * (nx + 1) + i1] - I[j1 * (nx + 1) + i0] + I[j0 * (nx + 1) + i0];
      out[j * nx + i] = (s / 1000) / ((i1 - i0) * (j1 - j0) * G.dx * G.dy / 1e6); }
    return out;
  }
  function rasterLines(gj, LIN) {
    var segs = []; (gj.features || [gj]).forEach(function (f) { var g = f.geometry || f, cs = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []; cs.forEach(function (l) { for (var k = 1; k < l.length; k++) segs.push([l[k - 1], l[k]]); }); });
    segs.forEach(function (s) { var a = s[0], b = s[1], m = D.metersPerDeg((a[1] + b[1]) / 2), len = Math.hypot((b[0] - a[0]) * m.x, (b[1] - a[1]) * m.y), st = Math.max(1, Math.ceil(len / (G.cell / 2))), per = len / st;
      for (var k = 0; k < st; k++) { var f = (k + 0.5) / st, lo = a[0] + (b[0] - a[0]) * f, la = a[1] + (b[1] - a[1]) * f, i = Math.floor((lo - G.b.w) / G.dlon), j = Math.floor((G.b.n - la) / G.dlat); if (i >= 0 && j >= 0 && i < G.nx && j < G.ny) LIN[j * G.nx + i] += per; } });
  }
  $('#pLinF').addEventListener('change', function () { var f = this.files[0]; if (!f) return; f.text().then(function (s) { var gj = JSON.parse(s), n = 0; (gj.features || [gj]).forEach(function (x) { var g = x.geometry || x; if (/LineString/.test(g.type)) n++; }); if (!n) throw new Error();
    userLin = gj; $('#pLinS').textContent = t('Your lineaments: ', 'خطوطك التركيبية: ') + n + t(' lines. They replace the automatic extraction on the next build.', ' خطاً. ستحل محل الاستخراج الآلي في الإنشاء القادم.'); }).catch(function () { SH.toast(t('The file holds no lines in GeoJSON.', 'لا يحتوي الملف على خطوط بصيغة GeoJSON.'), 'bad'); }); this.value = ''; });

  /* ---------------------------------------------------------------- ratings, index, classes */
  function pct(arr, ps) { var v = []; for (var c = 0; c < arr.length; c++) if (isFinite(arr[c])) v.push(arr[c]); v.sort(function (a, b) { return a - b; }); return ps.map(function (p) { return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : NaN; }); }
  function rate(f) {
    var raw = G.raw[f.k], R = new Float32Array(G.n).fill(NaN), c; if (!raw) return null;
    if (f.k === 'lulc') { for (c = 0; c < G.n; c++) if (LC[raw[c]]) R[c] = LC[raw[c]][3]; return R; }
    if (f.k === 'lith') { for (c = 0; c < G.n; c++) { var u = G.units[raw[c]]; if (u) R[c] = u.r; } return R; }
    var br = f.br; if (f.kind === 'q') { var q = pct(raw, [0.02, 0.2, 0.4, 0.6, 0.8, 0.98]); f.qb = q.slice(1, 5); f.rng = [q[0], q[5]]; br = (q[5] - q[0]) > 1e-6 ? f.qb : null; }
    for (c = 0; c < G.n; c++) { var v = raw[c]; if (!isFinite(v)) continue; if (!br) { R[c] = 3; continue; } var x = 0; while (x < 4 && v >= br[x]) x++; R[c] = f.dir > 0 ? x + 1 : 5 - x; }
    return R;
  }
  function jenks(data, k) {
    var n = data.length, mat1 = [], mat2 = [], i, j, l, m;
    for (i = 0; i <= n; i++) { mat1.push(new Array(k + 1).fill(0)); mat2.push(new Array(k + 1).fill(0)); }
    for (i = 1; i <= k; i++) { mat1[1][i] = 1; mat2[1][i] = 0; for (j = 2; j <= n; j++) mat2[j][i] = Infinity; }
    for (l = 2; l <= n; l++) { var s1 = 0, s2 = 0, w = 0, v = 0; for (m = 1; m <= l; m++) { var i3 = l - m + 1, val = data[i3 - 1]; s2 += val * val; s1 += val; w++; v = s2 - (s1 * s1) / w; var i4 = i3 - 1; if (i4 !== 0) for (j = 2; j <= k; j++) if (mat2[l][j] >= v + mat2[i4][j - 1]) { mat1[l][j] = i3; mat2[l][j] = v + mat2[i4][j - 1]; } }
      mat1[l][1] = 1; mat2[l][1] = v; }
    var br = [], kk = n; for (j = k; j >= 2; j--) { var id = mat1[kk][j] - 2; br.unshift(data[id + 1]); kk = mat1[kk][j] - 1; } return br; /* lower limits of classes 2..k */
  }
  function breaks(IDX) {
    var v = []; for (var c = 0; c < G.n; c++) if (isFinite(IDX[c])) v.push(IDX[c]); v.sort(function (a, b) { return a - b; }); if (v.length < 10) return null;
    var lo = v[0], hi = v[v.length - 1], m = SH.val('pCls');
    if (m === 'equal') return [1, 2, 3, 4].map(function (x) { return lo + (hi - lo) * x / 5; });
    if (m === 'quant') return [1, 2, 3, 4].map(function (x) { return v[Math.floor(v.length * x / 5)]; });
    var s = [], st = Math.max(1, Math.floor(v.length / 1500)); for (var k = 0; k < v.length; k += st) s.push(v[k]); return jenks(s, 5);
  }
  /* weighted linear combination, renormalised in each cell over the layers present there */
  function compose() {
    weights(); var act = F.filter(function (f) { return f.on && f.w > 0 && G.rate[f.k]; }), tot = act.reduce(function (a, f) { return a + f.w; }, 0), IDX = new Float32Array(G.n).fill(NaN), c;
    if (!act.length) { SH.toast(t('No layer is available.', 'لا توجد طبقة متاحة.'), 'warn'); return; }
    for (c = 0; c < G.n; c++) { var s = 0, w = 0; act.forEach(function (f) { var r = G.rate[f.k][c]; if (isFinite(r)) { s += f.w * r; w += f.w; } }); if (w >= 0.5 * tot) IDX[c] = s / w; }
    /* 3 × 3 mean of the index: removes single-cell speckle so the zones read as mappable units */
    var SM = new Float32Array(G.n).fill(NaN); for (c = 0; c < G.n; c++) { if (!isFinite(IDX[c])) continue; var ci = c % G.nx, cj = (c - ci) / G.nx, sm = 0, sn = 0; for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) { var ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= G.nx || jj >= G.ny) continue; var vv = IDX[jj * G.nx + ii]; if (isFinite(vv)) { sm += vv; sn++; } } SM[c] = sm / sn; }
    IDX = SM;
    var br = breaks(IDX), CL = new Int8Array(G.n).fill(-1); if (!br) { SH.toast(t('Too few cells with data.', 'الخلايا التي فيها بيانات قليلة جداً.'), 'bad'); return; }
    for (c = 0; c < G.n; c++) { if (!isFinite(IDX[c])) continue; var x = 0; while (x < 4 && IDX[c] >= br[x]) x++; CL[c] = x; }
    G.idx = IDX; G.cls = CL; G.br = br; G.act = act; G.done = true; showOpts(); draw(); results(); if (wells.length) validate(true);
  }

  /* ---------------------------------------------------------------- build */
  function grid(b) {
    var k = km(b), area = k.w * k.h, side = { fine: 300, coarse: 140 }[SH.val('pRes')] || 220, cell = Math.max(30, Math.sqrt(area * 1e6) / side);
    var nx = Math.max(20, Math.round(k.w * 1000 / cell)), ny = Math.max(20, Math.round(k.h * 1000 / cell)), m = D.metersPerDeg((b.n + b.s) / 2), dlon = (b.e - b.w) / nx, dlat = (b.n - b.s) / ny;
    return { b: b, nx: nx, ny: ny, n: nx * ny, dlon: dlon, dlat: dlat, dx: dlon * m.x, dy: dlat * m.y, cell: Math.sqrt(dlon * m.x * dlat * m.y), area: area, lat: function (j) { return b.n - (j + 0.5) * dlat; }, lon: function (i) { return b.w + (i + 0.5) * dlon; }, raw: {}, rate: {} };
  }
  function prog(s) { $('#pProg').innerHTML = s; }
  function run() {
    if (busy) return; if (!aoi) { SH.toast(t('Draw the area first.', 'ارسم المنطقة أولاً.'), 'warn'); return; }
    var k = km(aoi), a = k.w * k.h; if (a > 2500 || a < 4) { SH.toast(t('Keep the area between 4 and 2500 km².', 'اجعل المساحة بين 4 و2500 كم².'), 'warn'); return; }
    if (!SH.pro()) { SH.needPro(); return; }
    persist.save(); busy = true; $('#pRun').disabled = true; G = grid(aoi); F.forEach(function (f) { status(f.k, f.on ? 'run' : 'off'); }); weights();
    var host = $('.wsm-map'), done = 0, total = 6, step = function (k2, ok) { done++; prog(t('Layers ready: ', 'الطبقات الجاهزة: ') + '<b class="ltr">' + done + ' / ' + total + '</b>'); return ok; };
    SH.busy(host, true, t('Reading the evidence layers for your area…', 'جارٍ قراءة طبقات الأدلة لمنطقتك…')); prog(t('Starting…', 'جارٍ البدء…'));
    var set = function (ks, fn) { return fn().then(function (v) { ks.forEach(function (kk) { status(kk, 'ok'); }); step(ks[0], 1); return v; }, function () { ks.forEach(function (kk) { status(kk, 'bad'); }); step(ks[0], 0); return null; }); };
    /* the imagery service is called one request at a time; the geology and climate services in parallel */
    var pc = set(['slope', 'dd', 'twi', 'lin'], function () { return getDem().then(function (Z) { G.z = Z; return terrain(Z); }); })
      .then(function (T) { if (T) { G.T = T; ['slope', 'dd', 'twi', 'lin'].forEach(function (kk) { G.raw[kk] = T[kk]; }); }
        return set(['ndvi', 'ndmi'], getS2); })
      .then(function (s) { if (s) { G.raw.ndvi = s.arr[0]; G.raw.ndmi = s.arr[1]; G.s2 = s.used.map(function (i) { return i.properties.datetime.slice(0, 10); }); } return set(['lst'], getLst); })
      .then(function (s) { if (s) { G.raw.lst = s.arr[0]; G.ls = s.used.map(function (i) { return i.properties.datetime.slice(0, 10); }); } return set(['lulc'], getLc); })
      .then(function (s) { if (s) G.raw.lulc = s.arr[0]; });
    var rn = set(['rain'], getRain).then(function (R) { if (R) G.raw.rain = R; });
    var lt = set(['lith'], getLith).then(function (U) { if (U) G.raw.lith = U; });
    Promise.all([pc, rn, lt]).then(function () {
      F.forEach(function (f) { G.rate[f.k] = G.raw[f.k] ? rate(f) : null; if (!G.raw[f.k] && f.on) status(f.k, 'bad'); });
      var bad = F.filter(function (f) { return f.on && f.st === 'bad'; }); prog(bad.length ? '<span style="color:var(--warn)">' + t('Not available for this area, left out: ', 'غير متاحة لهذه المنطقة واستُبعدت: ') + bad.map(function (f) { return f.n; }).join(t(', ', '، ')) + '</span>' : t('All layers ready.', 'كل الطبقات جاهزة.'));
      compose(); if (map) map.fitBounds([[G.b.s, G.b.w], [G.b.n, G.b.e]]); if (window.innerWidth < 900) $('#pMap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { busy = false; $('#pRun').disabled = false; SH.busy(host, false); });
  }
  $('#pRun').addEventListener('click', run);
  $('#pCls').addEventListener('change', function () { persist.save(); if (G && G.done) compose(); });

  /* ---------------------------------------------------------------- map display */
  var VIR = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function ramp(f) { f = SH.clamp(f, 0, 1) * (VIR.length - 1); var i = Math.min(VIR.length - 2, Math.floor(f)), a = hex(VIR[i]), b = hex(VIR[i + 1]), u = f - i; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
  function showOpts() {
    var cur = SH.val('pShow') || 'cls', o = '<option value="cls">' + t('Potential classes', 'فئات الاحتمالية') + '</option><option value="idx">' + t('Potential index (1–5)', 'مؤشر الاحتمالية (1–5)') + '</option>';
    F.forEach(function (f) { if (!G.raw[f.k]) return; o += '<optgroup label="' + SH.esc(f.n) + '"><option value="r:' + f.k + '">' + t('Rating 1–5', 'التقييم 1–5') + '</option><option value="v:' + f.k + '">' + t('Values', 'القيم') + '</option></optgroup>'; });
    $('#pShow').innerHTML = o; $('#pShow').value = /^(cls|idx|[rv]:\w+)$/.test(cur) && $('#pShow').querySelector('option[value="' + cur + '"]') ? cur : 'cls';
  }
  /* canvas of the chosen view; returns {url, legend} */
  function paint(view, solid) {
    var cv = document.createElement('canvas'); cv.width = G.nx; cv.height = G.ny; var x = cv.getContext('2d'), im = x.createImageData(G.nx, G.ny), d = im.data, c, col, leg;
    var put = function (c, rgb, a) { d[c * 4] = rgb[0]; d[c * 4 + 1] = rgb[1]; d[c * 4 + 2] = rgb[2]; d[c * 4 + 3] = a == null ? 255 : a; };
    var CR = CLS.map(function (q) { return hex(q[0]); });
    if (view === 'cls') { for (c = 0; c < G.n; c++) if (G.cls[c] >= 0) put(c, CR[G.cls[c]]); leg = { title: t('Groundwater potential', 'احتمالية المياه الجوفية'), sw: CLS.map(function (q) { return [q[0], AR ? q[2] : q[1]]; }) }; }
    else if (view === 'idx' || view[0] === 'v' && FK[view.slice(2)].kind !== 'cat') {
      var arr = view === 'idx' ? G.idx : G.raw[view.slice(2)], q = view === 'idx' ? [1, 5] : pct(arr, [0.02, 0.98]), f = FK[view.slice(2)], inv = view !== 'idx' && f && f.dir < 0;
      for (c = 0; c < G.n; c++) if (isFinite(arr[c])) put(c, ramp((arr[c] - q[0]) / ((q[1] - q[0]) || 1)));
      leg = { title: view === 'idx' ? t('Potential index', 'مؤشر الاحتمالية') : f.n + (f.u ? ' (' + f.u + ')' : ''), grad: [q[0], q[1]], dp: view === 'idx' ? 1 : f.dp, note: inv ? t('Lower values rate higher.', 'القيم الأدنى تُقيّم أعلى.') : '' }; }
    else if (view[0] === 'r') { var R = G.rate[view.slice(2)]; for (c = 0; c < G.n; c++) if (isFinite(R[c])) put(c, CR[Math.round(R[c]) - 1]); leg = { title: FK[view.slice(2)].n + ' · ' + t('rating', 'التقييم'), sw: CLS.map(function (q, i) { return [q[0], (i + 1) + ' · ' + (AR ? q[2] : q[1])]; }) }; }
    else if (view === 'v:lulc') { var seen = {}; for (c = 0; c < G.n; c++) { var v = G.raw.lulc[c]; if (LC[v]) { put(c, hex(LC[v][0])); seen[v] = (seen[v] || 0) + 1; } } leg = { title: FK.lulc.n, sw: Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; }).map(function (v) { return [LC[v][0], (AR ? LC[v][2] : LC[v][1]) + ' · ' + LC[v][3]]; }) }; }
    else if (view === 'v:lith') { var su = {}; for (c = 0; c < G.n; c++) { var u = G.units[G.raw.lith[c]]; if (u) { put(c, hex(u.color)); su[G.raw.lith[c]] = 1; } } leg = { title: FK.lith.n, sw: Object.keys(su).map(function (i) { var u = G.units[i]; return [u.color, u.name + ' · ' + u.r]; }) }; }
    x.putImageData(im, 0, 0); return { url: cv.toDataURL('image/png'), leg: leg };
  }
  function draw() {
    if (!G || !G.done || !map) return; var P = paint(SH.val('pShow') || 'cls'); if (ov) map.removeLayer(ov);
    ov = L.imageOverlay(P.url, [[G.b.s, G.b.w], [G.b.n, G.b.e]], { opacity: +SH.val('pOp'), interactive: false }).addTo(map); var el = ov.getElement(); if (el) el.style.imageRendering = 'pixelated';
    var lg = $('#pLeg'), Lg = P.leg; lg.hidden = false;
    lg.innerHTML = '<div style="font-weight:800;margin-bottom:6px">' + SH.esc(Lg.title) + '</div>' + (Lg.sw ? '<div class="pz-cls">' + Lg.sw.slice(0, 9).map(function (s) { return '<div style="grid-template-columns:16px 1fr"><i style="background:' + s[0] + '"></i><span>' + SH.esc(s[1]) + '</span></div>'; }).join('') + '</div>'
      : '<div class="gr" style="background:linear-gradient(90deg,' + VIR.join(',') + ')"></div><div class="sc"><span>' + SH.fmt(Lg.grad[0], Lg.dp) + '</span><span>' + SH.fmt((Lg.grad[0] + Lg.grad[1]) / 2, Lg.dp) + '</span><span>' + SH.fmt(Lg.grad[1], Lg.dp) + '</span></div>' + (Lg.note ? '<div class="xsmall muted" style="margin-top:4px">' + Lg.note + '</div>' : ''));
  }
  $('#pShow').addEventListener('change', draw); $('#pOp').addEventListener('input', function () { if (ov) ov.setOpacity(+this.value); });

  /* ---------------------------------------------------------------- probe */
  function cellAt(lat, lon) { if (!G) return -1; var i = Math.floor((lon - G.b.w) / G.dlon), j = Math.floor((G.b.n - lat) / G.dlat); return i < 0 || j < 0 || i >= G.nx || j >= G.ny ? -1 : j * G.nx + i; }
  function valTxt(f, c) { var v = G.raw[f.k] ? G.raw[f.k][c] : NaN; if (f.k === 'lulc') return LC[v] ? (AR ? LC[v][2] : LC[v][1]) : '—'; if (f.k === 'lith') { var u = G.units[v]; return u ? u.name : '—'; } return isFinite(v) ? SH.fmt(v, f.dp) + (f.u ? ' ' + f.u : '') : '—'; }
  if (map) map.on('click', function (e) {
    if (addMode) { wells.push({ lat: e.latlng.lat, lon: e.latlng.lng }); saveWells(); return; }
    var c = cellAt(e.latlng.lat, e.latlng.lng); if (c < 0 || !G || !G.done) return;
    var h = '<div class="pz-pop"><b>' + (G.cls[c] >= 0 ? t('Potential: ', 'الاحتمالية: ') + (AR ? CLS[G.cls[c]][2] : CLS[G.cls[c]][1]) + ' · <span class="ltr">' + SH.fmt(G.idx[c], 2) + '</span>' : t('No data', 'لا بيانات')) + '</b><table><tr><td></td><td class="num">' + t('value', 'القيمة') + '</td><td class="num">' + t('rating', 'التقييم') + '</td><td class="num">' + t('weight', 'الوزن') + '</td></tr>' +
      F.filter(function (f) { return G.raw[f.k]; }).map(function (f) { var r = G.rate[f.k] ? G.rate[f.k][c] : NaN; return '<tr><td>' + SH.esc(f.n) + '</td><td class="num">' + SH.esc(valTxt(f, c)) + '</td><td class="num"><b>' + (isFinite(r) ? r : '—') + '</b></td><td class="num">' + (f.on && f.w ? SH.fmt(f.w * 100, 0) + '%' : '—') + '</td></tr>'; }).join('') + '</table><span class="ltr" style="color:#666">' + SH.fmtLatLon(e.latlng.lat, e.latlng.lng, 4) + '</span></div>';
    L.popup({ maxWidth: 340 }).setLatLng(e.latlng).setContent(h).openOn(map);
  });

  /* ---------------------------------------------------------------- results panel */
  function areas() { var n = [0, 0, 0, 0, 0], tot = 0; for (var c = 0; c < G.n; c++) if (G.cls[c] >= 0) { n[G.cls[c]]++; tot++; } var ca = G.dx * G.dy / 1e6; return n.map(function (v) { return { n: v, km2: v * ca, p: 100 * v / (tot || 1) }; }); }
  function results() {
    var A = areas(), hi = A[3].p + A[4].p, hk = A[3].km2 + A[4].km2;
    /* which layers set the high zones apart: mean rating inside high + very high minus the area mean */
    var drv = G.act.map(function (f) { var s1 = 0, n1 = 0, s0 = 0, n0 = 0, R = G.rate[f.k]; for (var c = 0; c < G.n; c++) { if (!isFinite(R[c]) || G.cls[c] < 0) continue; s0 += R[c]; n0++; if (G.cls[c] >= 3) { s1 += R[c]; n1++; } } return { f: f, d: n1 && n0 ? s1 / n1 - s0 / n0 : 0, m: n1 ? s1 / n1 : NaN }; }).sort(function (a, b) { return b.d * b.f.w - a.d * a.f.w; });
    var top = drv.filter(function (x) { return x.d > 0.15; }).slice(0, 3);
    var txt = t('High and very high potential cover ', 'تغطي الاحتمالية العالية والعالية جداً ') + '<b class="ltr">' + SH.fmt(hi, 1) + ' %</b>' + t(' of the area (', ' من المنطقة (') + '<span class="ltr">' + SH.fmt(hk, 1) + ' km²</span>). ' +
      (top.length ? t('They are set apart mainly by ', 'وتتميز أساساً بـ') + top.map(function (x) { return '<b>' + SH.esc(x.f.n) + '</b>'; }).join(t(', ', '، ')) + t(', which rate clearly higher there than in the rest of the area. ', '، التي يرتفع تقييمها فيها بوضوح عن بقية المنطقة. ') : '') +
      t('Treat the zones as targets for electrical soundings and test wells, not as proven water.', 'تعامل مع هذه المناطق كأهداف للسبر الكهربائي والآبار الاختبارية، لا كمياه مؤكدة.');
    var u = G.units ? G.units.slice().sort(function (a, b) { return b.n - a.n; }) : [];
    var neutral = u.length && u.every(function (x) { return x.r === 3; }) && FK.lith.on;
    var lithTbl = u.length ? '<details' + (u.some(function (x) { return !x.rated; }) ? ' open' : '') + '><summary class="small" style="cursor:pointer;font-weight:700">' + t('Rock units and their ratings', 'الوحدات الصخرية وتقييمها') + '</summary><p class="xsmall muted" style="margin:6px 0">' + t('Read from the geological map at ', 'قُرئت من الخريطة الجيولوجية عند ') + G.lithPts + t(' points; boundaries are approximate at that spacing. A unit whose rock type is not stated is rated 3; set it from your knowledge of the area.', ' نقطة، والحدود تقريبية بقدر تباعدها. الوحدة التي لم يُذكر نوع صخرها تُقيّم 3؛ عدّل تقييمها من معرفتك بالمنطقة.') + '</p><table class="pz-units"><tbody>' +
      u.map(function (x) { var ix = G.units.indexOf(x); return '<tr><td><i style="background:' + x.color + '"></i></td><td>' + SH.esc(x.name) + (x.age ? '<br><span class="muted">' + SH.esc(x.age) + '</span>' : '') + (x.lk ? '<br><span class="muted">' + SH.esc(AR ? LITH[x.lk][2] : LITH[x.lk][1]) + '</span>' : '') + '</td><td><select data-u="' + ix + '" aria-label="' + t('Rating', 'التقييم') + '">' + [1, 2, 3, 4, 5].map(function (r) { return '<option' + (r === x.r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></details>' : '';
    var srcs = [G.s2 && G.s2.length ? t('Optical scenes: ', 'المشاهد البصرية: ') + uniq(G.s2).join(t(', ', '، ')) : '', G.ls && G.ls.length ? t('Thermal scenes: ', 'المشاهد الحرارية: ') + uniq(G.ls).join(t(', ', '، ')) : '', G.rainYears ? t('Rainfall years: ', 'سنوات الأمطار: ') + G.rainYears : '', G.T ? t('Automatic lineaments: ', 'خطوط تركيبية آلية: ') + (userLin ? t('replaced by your file', 'استُبدلت بملفك') : G.T.segs) : ''].filter(Boolean);
    $('#pOut').innerHTML = '<div class="pz-card"><b class="h">' + t('Groundwater potential zones', 'مناطق احتمالية المياه الجوفية') + '</b><span>' + txt + '</span><div class="pz-cls">' +
      A.map(function (a, i) { return '<div><i style="background:' + CLS[i][0] + '"></i><span>' + (AR ? CLS[i][2] : CLS[i][1]) + '</span><span class="n">' + SH.fmt(a.km2, 1) + ' km²</span><span class="n">' + SH.fmt(a.p, 1) + ' %</span></div>'; }).join('') + '</div><div class="plot" id="pCh" style="height:200px"></div>' +
      '<table class="pz-tbl"><thead><tr><th>' + t('Layer', 'الطبقة') + '</th><th class="num">' + t('Weight', 'الوزن') + '</th><th class="num">' + t('Mean rating in high zones', 'متوسط التقييم في المناطق العالية') + '</th></tr></thead><tbody>' +
      drv.slice().sort(function (a, b) { return b.f.w - a.f.w; }).map(function (x) { return '<tr><td>' + SH.esc(x.f.n) + '</td><td class="num">' + SH.fmt(x.f.w * 100, 1) + ' %</td><td class="num">' + SH.fmt(x.m, 2) + '</td></tr>'; }).join('') + '</tbody></table>' + lithTbl +
      (neutral ? '<div class="pz-note" style="border-color:var(--warn)">' + t('The geological map here states ages but not rock types, so every unit is rated 3 and lithology does not change the ranking yet. Rate the units below from your knowledge of the formations.', 'الخريطة الجيولوجية هنا تذكر الأعمار دون أنواع الصخور، لذا قُيّمت كل الوحدات بـ3 ولا تؤثر الصخارية في الترتيب بعد. قيّم الوحدات أدناه من معرفتك بالتكوينات.') + '</div>' : '') + '<span class="xsmall muted">' + t('Grid ', 'الشبكة ') + '<span class="ltr">' + G.nx + ' × ' + G.ny + ' · ' + SH.fmt(G.cell, 0) + ' m</span>' + t(' · class breaks: ', ' · حدود الفئات: ') + '<span class="ltr">' + G.br.map(function (v) { return SH.fmt(v, 2); }).join(' · ') + '</span>' + (srcs.length ? '<br>' + srcs.join('<br>') : '') + '</span></div>';
    SH.plot('pCh', [{ type: 'bar', x: CLS.map(function (q) { return AR ? q[2] : q[1]; }), y: A.map(function (a) { return a.p; }), marker: { color: CLS.map(function (q) { return q[0]; }), line: { color: '#333', width: .5 } }, text: A.map(function (a) { return SH.fmt(a.p, 1) + '%'; }), textposition: 'outside', cliponaxis: false, hovertemplate: '%{x}<br>%{y:.1f} %<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 40, r: 8, t: 18, b: 34 }, showlegend: false, yaxis: { ticksuffix: ' %', rangemode: 'tozero', range: [0, Math.max.apply(null, A.map(function (a) { return a.p; })) * 1.22] }, xaxis: { tickfont: { size: 10 } } }); }, { displayModeBar: false });
  }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  $('#pOut').addEventListener('change', function (e) { var s = e.target.closest('[data-u]'); if (!s) return; var u = G.units[+s.getAttribute('data-u')]; u.r = +s.value; u.rated = true; G.rate.lith = rate(FK.lith); compose(); });

  /* ---------------------------------------------------------------- wells and validation */
  function saveWells() { SH.store.set('shandal_pz_wells', wells); drawWells(); $('#pWS').textContent = wells.length ? wells.length + t(' wells loaded.', ' بئراً محمّلة.') : ''; }
  function drawWells() { if (!wLay) return; wLay.clearLayers(); wells.forEach(function (w) { L.circleMarker([w.lat, w.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: w.st === 0 ? '#c0392b' : '#111', fillOpacity: 1 }).bindTooltip((w.name ? SH.esc(w.name) + ' · ' : '') + (w.y != null ? SH.fmt(w.y, 1) + ' L/s' : '') + (w.st === 0 ? ' ' + t('dry', 'جافة') : '')).addTo(wLay); }); }
  saveWells();
  $('#pWAdd').addEventListener('click', function () { addMode = !addMode; this.setAttribute('aria-pressed', addMode); this.classList.toggle('btn-ink', addMode); if (map) map.getContainer().style.cursor = addMode ? 'crosshair' : ''; if (addMode) SH.toast(t('Tap each well on the map, then tap the button again.', 'انقر كل بئر على الخريطة ثم انقر الزر مرة أخرى.'), 'info'); });
  $('#pWClr').addEventListener('click', function () { wells = []; saveWells(); $('#pValOut').innerHTML = ''; });
  $('#pWF').addEventListener('change', function () { var f = this.files[0]; if (!f) return; f.text().then(function (s) {
    var L2 = s.replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); }), sp = function (l) { return l.split(/[,;\t]/).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); }, h = sp(L2[0]).map(function (x) { return x.toLowerCase(); }), hasH = h.some(function (x) { return isNaN(parseFloat(x)); });
    var col = function (re, d) { for (var i = 0; i < h.length; i++) if (re.test(h[i])) return i; return hasH ? -1 : d; };
    var cLa = col(/^(lat|latitude|y|خط العرض|العرض)/, 0), cLo = col(/^(lon|lng|long|longitude|x|خط الطول|الطول)/, 1), cY = col(/yield|discharge|^q$|rate|انتاج|إنتاج|تصريف/, 2), cS = col(/status|state|productive|dry|حالة|الحالة/, -1), cN = col(/name|id|well|اسم|البئر|رقم/, -1);
    if (cLa < 0 || cLo < 0) throw new Error(); var add = [];
    L2.slice(hasH ? 1 : 0).forEach(function (l) { var r = sp(l), la = parseFloat(r[cLa]), lo = parseFloat(r[cLo]); if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return;
      var w = { lat: la, lon: lo }; if (cY >= 0 && isFinite(parseFloat(r[cY]))) w.y = parseFloat(r[cY]); if (cS >= 0 && r[cS] !== '' && r[cS] != null) w.st = /^(0|dry|no|false|جاف|جافة|لا)$/i.test(r[cS]) ? 0 : 1; if (cN >= 0) w.name = r[cN]; add.push(w); });
    if (!add.length) throw new Error(); wells = wells.concat(add); saveWells(); SH.toast(add.length + t(' wells added.', ' بئراً أُضيفت.'), 'ok'); if (G && G.done) validate();
  }).catch(function () { SH.toast(t('Could not read wells: use columns lat, lon and optionally yield or status.', 'تعذرت قراءة الآبار: استخدم أعمدة lat وlon ومعها yield أو status اختيارياً.'), 'bad'); }); this.value = ''; });
  function auc(pos, neg) { if (!pos.length || !neg.length) return NaN; var s = 0; pos.forEach(function (p) { var lt = 0, eq = 0; for (var k = 0; k < neg.length; k++) { if (neg[k] < p) lt++; else if (neg[k] === p) eq++; } s += (lt + eq / 2) / neg.length; }); return s / pos.length; }
  function rankv(a) { var o = a.map(function (v, i) { return [v, i]; }).sort(function (x, y) { return x[0] - y[0]; }), r = new Array(a.length); for (var i = 0; i < o.length;) { var j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (var k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
  function spear(x, y) { var rx = rankv(x), ry = rankv(y), n = x.length, mx = (n + 1) / 2, sxy = 0, sxx = 0, syy = 0; for (var i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - mx); sxx += Math.pow(rx[i] - mx, 2); syy += Math.pow(ry[i] - mx, 2); } return sxy / Math.sqrt(sxx * syy); }
  function grade(a) { return a >= 0.9 ? t('excellent', 'ممتازة') : a >= 0.8 ? t('very good', 'جيدة جداً') : a >= 0.7 ? t('good', 'جيدة') : a >= 0.6 ? t('moderate', 'متوسطة') : t('poor: revise the importance or ratings', 'ضعيفة: راجع الأهمية أو التقييمات'); }
  function validate(quiet) {
    if (!G || !G.done) { if (!quiet) SH.toast(t('Build the map first.', 'أنشئ الخريطة أولاً.'), 'warn'); return; }
    var W = wells.map(function (w) { var c = cellAt(w.lat, w.lon); return c >= 0 && isFinite(G.idx[c]) ? { w: w, v: G.idx[c], k: G.cls[c] } : null; }).filter(Boolean), o = $('#pValOut');
    if (W.length < 3) { o.innerHTML = '<span class="xsmall muted">' + t('At least three wells inside the mapped area are needed.', 'تلزم ثلاث آبار على الأقل داخل المنطقة المرسومة.') + '</span>'; return; }
    var prod = W.filter(function (x) { return x.w.st !== 0; }), dry = W.filter(function (x) { return x.w.st === 0; }), cells = []; for (var c = 0; c < G.n; c++) if (isFinite(G.idx[c])) cells.push(G.idx[c]);
    cells.sort(function (a, b) { return b - a; });
    var sAuc = auc(prod.map(function (x) { return x.v; }), cells), curve = { x: [0], y: [0] }, pv = prod.map(function (x) { return x.v; }).sort(function (a, b) { return b - a; });
    for (var q = 1; q <= 50; q++) { var thr = cells[Math.min(cells.length - 1, Math.floor(cells.length * q / 50) - 1)], nw = pv.filter(function (v) { return v >= thr; }).length; curve.x.push(q * 2); curve.y.push(100 * nw / (pv.length || 1)); }
    var A = areas(), fr = A.map(function (a, i) { var n = prod.filter(function (x) { return x.k === i; }).length, pw = 100 * n / (prod.length || 1); return { n: n, pw: pw, fr: a.p ? pw / a.p : NaN }; });
    var roc = prod.length >= 3 && dry.length >= 3 ? auc(prod.map(function (x) { return x.v; }), dry.map(function (x) { return x.v; })) : NaN, yl = W.filter(function (x) { return x.w.y != null; }), rho = yl.length >= 5 ? spear(yl.map(function (x) { return x.v; }), yl.map(function (x) { return x.w.y; })) : NaN;
    o.innerHTML = '<div class="pz-card"><b class="h">' + t('Validation against ', 'التحقق مقابل ') + W.length + t(' wells', ' بئراً') + '</b><span>' + t('Success-rate curve: the share of productive wells captured as the map is read from its highest to its lowest potential. Area under the curve ', 'منحنى معدل النجاح: نسبة الآبار المنتجة التي تلتقطها الخريطة عند قراءتها من أعلى احتمالية إلى أدناها. المساحة تحت المنحنى ') + '<b class="ltr">AUC = ' + SH.fmt(sAuc, 3) + '</b> (' + grade(sAuc) + ').' +
      (isFinite(roc) ? ' ' + t('Productive against dry wells: ', 'الآبار المنتجة مقابل الجافة: ') + '<b class="ltr">ROC AUC = ' + SH.fmt(roc, 3) + '</b> (' + grade(roc) + ').' : '') + (isFinite(rho) ? ' ' + t('Spearman correlation of the index with yield: ', 'ارتباط سبيرمان بين المؤشر والإنتاجية: ') + '<b class="ltr">ρ = ' + SH.fmt(rho, 2) + '</b> (' + yl.length + t(' wells).', ' بئراً).') : '') + '</span>' +
      '<div class="plot" id="pRoc" style="height:240px"></div><table class="pz-tbl"><thead><tr><th>' + t('Class', 'الفئة') + '</th><th class="num">' + t('Area %', 'المساحة %') + '</th><th class="num">' + t('Wells', 'الآبار') + '</th><th class="num">' + t('Frequency ratio', 'نسبة التكرار') + '</th></tr></thead><tbody>' +
      fr.map(function (r, i) { return '<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + CLS[i][0] + '"></i> ' + (AR ? CLS[i][2] : CLS[i][1]) + '</td><td class="num">' + SH.fmt(A[i].p, 1) + '</td><td class="num">' + r.n + '</td><td class="num"><b>' + (isFinite(r.fr) ? SH.fmt(r.fr, 2) : '—') + '</b></td></tr>'; }).join('') + '</tbody></table><span class="xsmall muted">' + t('A frequency ratio above 1 means the class holds more wells than its share of the area. A good map shows ratios rising from very low to very high.', 'نسبة التكرار الأعلى من 1 تعني أن الفئة تحوي آباراً أكثر من نصيبها من المساحة. الخريطة الجيدة تُظهر نسباً تتصاعد من المنخفضة جداً إلى العالية جداً.') + '</span></div>';
    var pal = SH.palette();
    SH.plot('pRoc', [{ x: [0, 100], y: [0, 100], mode: 'lines', line: { color: '#999', dash: 'dash', width: 1 }, hoverinfo: 'skip', name: t('Random', 'عشوائي') }, { x: curve.x, y: curve.y, mode: 'lines', line: { color: pal.accent, width: 2.5, shape: 'spline' }, fill: 'tonexty', fillcolor: SH.alpha(pal.accent, .12), name: 'AUC ' + SH.fmt(sAuc, 2), hovertemplate: '%{x:.0f}% → %{y:.0f}%<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 66, r: 10, t: 10, b: 44 }, showlegend: false, xaxis: { range: [0, 100], ticksuffix: '%', title: { text: t('Area, from highest potential', 'المساحة من أعلى احتمالية'), font: { size: 11 }, standoff: 8 } }, yaxis: { range: [0, 101], ticksuffix: '%', title: { text: t('Wells captured', 'الآبار الملتقطة'), font: { size: 11 }, standoff: 10 } } }); }, { displayModeBar: false });
  }
  $('#pVal').addEventListener('click', function () { validate(); });

  /* ---------------------------------------------------------------- downloads */
  function need() { if (!G || !G.done) { SH.toast(t('Build the map first.', 'أنشئ الخريطة أولاً.'), 'warn'); return false; } return true; }
  var fname = function (x) { return 'Shandal-groundwater-potential-' + new Date().toISOString().slice(0, 10) + x; };
  $('#pSheet').addEventListener('click', function () { if (!need() || !D) return; var view = SH.val('pShow') || 'cls', P = paint(view), A = areas(), svg = $('#pSheetSvg');
    /* upscale the grid image with nearest-neighbour so cells stay sharp in the sheet */
    var im = new Image(); im.onload = function () { var k = Math.max(1, Math.floor(1400 / Math.max(G.nx, G.ny))), cv = document.createElement('canvas'); cv.width = G.nx * k; cv.height = G.ny * k; var x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, cv.width, cv.height);
      var sw = view === 'cls' ? CLS.map(function (q, i) { return { color: q[0], name: (AR ? q[2] : q[1]) + ' · ' + SH.ltr(SH.fmt(A[i].p, 1) + '%') }; }) : P.leg.sw ? P.leg.sw.slice(0, 9).map(function (s) { return { color: s[0], name: s[1] }; }) : [];
      D.svgMap(svg, { b: G.b, min: 0, max: 1 }, [], { crs: 'geo', fill: false, image: cv.toDataURL('image/png'), noContours: true, grid: true, title: view === 'cls' ? t('Groundwater potential zones', 'مناطق احتمالية المياه الجوفية') : P.leg.title,
        subtitle: t('Analytic hierarchy process · ', 'التحليل الهرمي · ') + G.act.length + t(' layers · cell ', ' طبقات · الخلية ') + SH.fmt(G.cell, 0) + ' m · CR ' + SH.fmt(AH ? AH.CR : 0, 3), legendTitle: P.leg.title, swatches: sw, gradient: P.leg.grad ? { colors: VIR, min: P.leg.grad[0], max: P.leg.grad[1] } : null,
        points: wells.filter(function (w) { return cellAt(w.lat, w.lon) >= 0; }).map(function (w) { return { x: w.lon, y: w.lat, color: w.st === 0 ? '#c0392b' : '#111' }; }), pointsName: t('Well', 'بئر'), pointKinds: [{ color: '#111', name: t('Productive or unclassified well', 'بئر منتجة أو غير مصنفة') }].concat(wells.some(function (w) { return w.st === 0 && cellAt(w.lat, w.lon) >= 0; }) ? [{ color: '#c0392b', name: t('Dry well', 'بئر جافة') }] : []),
        source: t('Satellite imagery, elevation model, geological map, land cover and climate reanalysis, combined in the Shandal System.', 'صور فضائية ونموذج ارتفاع رقمي وخريطة جيولوجية وغطاء أرضي وإعادة تحليل مناخي، مدموجة في نظام شندل.'), credit: 'Shandal System' });
      SH.svgPng(svg, fname('.png'), 2); }; im.src = P.url; });
  $('#pAsc').addEventListener('click', function () { if (!need()) return; var s = 'ncols ' + G.nx + '\nnrows ' + G.ny + '\nxllcorner ' + G.b.w.toFixed(8) + '\nyllcorner ' + G.b.s.toFixed(8) + '\ndx ' + G.dlon.toFixed(10) + '\ndy ' + G.dlat.toFixed(10) + '\nNODATA_value -9999\n', r = [];
    for (var j = 0; j < G.ny; j++) { r.length = 0; for (var i = 0; i < G.nx; i++) { var v = G.idx[j * G.nx + i]; r.push(isFinite(v) ? v.toFixed(3) : '-9999'); } s += r.join(' ') + '\n'; }
    SH.download(fname('-index.asc'), s, 'text/plain'); SH.toast(t('Index grid in geographic coordinates (WGS 84), values 1–5. Opens in QGIS and ArcGIS.', 'شبكة المؤشر بالإحداثيات الجغرافية (WGS 84) بقيم 1–5. تُفتح في QGIS وArcGIS.'), 'info'); });
  $('#pCsv').addEventListener('click', function () { if (!need()) return; var A = areas(), rows = [[t('Class', 'الفئة'), t('Area (km²)', 'المساحة (كم²)'), t('Share (%)', 'النسبة (%)'), t('Lower limit of index', 'الحد الأدنى للمؤشر')]];
    A.forEach(function (a, i) { rows.push([AR ? CLS[i][2] : CLS[i][1], a.km2.toFixed(3), a.p.toFixed(2), i ? G.br[i - 1].toFixed(3) : '']); });
    rows.push([]); rows.push([t('Layer', 'الطبقة'), t('Importance (1–9)', 'الأهمية (1–9)'), t('AHP weight', 'وزن التحليل الهرمي')]); G.act.forEach(function (f) { rows.push([f.n, f.w8, f.w.toFixed(4)]); }); rows.push(['CR', AH ? AH.CR.toFixed(4) : '']);
    rows.push([]); rows.push(['© Shandal Geological Field Survey System · geologicalfieldsurvey.com', new Date().toISOString().slice(0, 10)]); SH.csv(fname('-classes.csv'), rows); });
  /* all layer ratings on one framed figure with shared legend, north arrow and scale bar */
  $('#pFac').addEventListener('click', function () { if (!need()) return; var fs = F.filter(function (f) { return G.rate[f.k]; }), cols = 4, rowsN = Math.ceil((fs.length + 1) / cols), pw = 300, M = 40, ph = Math.round(pw * (G.ny * G.dy) / (G.nx * G.dx)); if (ph > 380) { var sc0 = 380 / ph; ph = 380; pw = Math.round(pw * sc0); }
    var W = M * 2 + cols * pw + (cols - 1) * 24, H = 110 + rowsN * (ph + 46) + 90, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d'), FN = '"IBM Plex Sans Arabic", Manrope, Arial, sans-serif';
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.strokeStyle = '#1B232B'; x.lineWidth = 1.5; x.strokeRect(10, 10, W - 20, H - 20); x.fillStyle = '#1B232B'; x.font = '800 24px ' + FN; x.textAlign = AR ? 'right' : 'left'; x.direction = AR ? 'rtl' : 'ltr';
    x.fillText(t('Evidence layers rated 1–5 for groundwater potential', 'طبقات الأدلة مقيّمة من 1 إلى 5 لاحتمالية المياه الجوفية'), AR ? W - M : M, 52); x.font = '500 14px ' + FN; x.fillStyle = '#55616B'; x.fillText(t('Weights from the analytic hierarchy process are shown under each layer.', 'أوزان التحليل الهرمي مبينة تحت كل طبقة.'), AR ? W - M : M, 78);
    var items = fs.map(function (f) { return { v: 'r:' + f.k, n: f.n + ' · ' + SH.fmt(f.w * 100, 1) + '%' }; }).concat([{ v: 'cls', n: t('Result: potential classes', 'النتيجة: فئات الاحتمالية') }]), jobs = items.map(function (it) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.src = paint(it.v).url; }); });
    Promise.all(jobs).then(function (ims) { ims.forEach(function (im, k) { var ci = k % cols, ri = Math.floor(k / cols), px = AR ? W - M - (ci + 1) * pw - ci * 24 : M + ci * (pw + 24), py = 104 + ri * (ph + 46);
        x.imageSmoothingEnabled = false; x.fillStyle = '#f3f3f3'; x.fillRect(px, py, pw, ph); x.drawImage(im, px, py, pw, ph); x.strokeStyle = '#1B232B'; x.lineWidth = 1; x.strokeRect(px, py, pw, ph);
        x.fillStyle = '#1B232B'; x.font = (k === items.length - 1 ? '800' : '600') + ' 14px ' + FN; x.textAlign = 'center'; x.fillText(items[k].n, px + pw / 2, py + ph + 22); });
      /* legend, north arrow and scale bar along the foot */
      var ly = H - 62; x.textAlign = AR ? 'right' : 'left'; x.font = '700 13px ' + FN; var lx = AR ? W - M : M, sx = 0;
      CLS.forEach(function (q, i) { var lab = (i + 1) + ' ' + (AR ? q[2] : q[1]), wq = x.measureText(lab).width + 34, bx = AR ? lx - sx - 18 : lx + sx; x.fillStyle = q[0]; x.fillRect(bx, ly - 12, 18, 14); x.strokeStyle = '#333'; x.strokeRect(bx, ly - 12, 18, 14); x.fillStyle = '#1B232B'; x.fillText(lab, AR ? bx - 6 : bx + 24, ly); sx += wq; });
      var nxp = AR ? M + 20 : W - M - 20; x.beginPath(); x.moveTo(nxp, ly - 34); x.lineTo(nxp - 10, ly + 6); x.lineTo(nxp, ly - 2); x.closePath(); x.fillStyle = '#1B232B'; x.fill(); x.beginPath(); x.moveTo(nxp, ly - 34); x.lineTo(nxp + 10, ly + 6); x.lineTo(nxp, ly - 2); x.closePath(); x.fillStyle = '#fff'; x.fill(); x.stroke(); x.fillStyle = '#1B232B'; x.font = '800 13px ' + FN; x.textAlign = 'center'; x.fillText('N', nxp, ly - 38);
      var mpp = G.nx * G.dx / pw, want = mpp * 110, p10 = Math.pow(10, Math.floor(Math.log10(want))), nn = want / p10, lenM = (nn >= 5 ? 5 : nn >= 2 ? 2 : 1) * p10, bw = lenM / mpp, bx0 = AR ? M + 60 : W - M - 60 - bw;
      for (var q = 0; q < 4; q++) { x.fillStyle = q % 2 ? '#fff' : '#1B232B'; x.fillRect(bx0 + q * bw / 4, ly - 4, bw / 4, 7); } x.strokeRect(bx0, ly - 4, bw, 7); x.fillStyle = '#1B232B'; x.font = '600 12px ' + FN; x.fillText('0', bx0, ly + 20); x.fillText(lenM >= 1000 ? SH.fmt(lenM / 1000, 0) + ' km' : SH.fmt(lenM, 0) + ' m', bx0 + bw, ly + 20);
      SH.canvasPng(cv, fname('-layers.png')); }); });

  document.addEventListener('sh:beforereport', function (e) { if (!G || !G.done) { e.preventDefault(); SH.toast(t('Build the map first.', 'أنشئ الخريطة أولاً.'), 'warn'); } });
})();
