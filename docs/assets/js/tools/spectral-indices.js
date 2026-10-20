/* Spectral indices — Sentinel-2 L2A from the Microsoft Planetary Computer: STAC search, index and composite tiles
   rendered by the PC tiler (TiTiler), area statistics, time series and two-date change. Processing-baseline 04.00
   radiometric offset (−1000 DN) is removed before band arithmetic. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, PC = 'https://planetarycomputer.microsoft.com/api/';
  var persist = SH.persist('spectral', ['xFrom', 'xTo', 'xCloud', 'xIdx', 'xOp']), map = SH.map('xMap', { zoom: 9, base: 'satellite', center: [33.0, 40.5] });
  var aoi = SH.store.get('shandal_spectral_aoi', null), aoiLay = null, drawer = null, items = [], cur = null, tile = null;
  if (!$('#xTo').value) $('#xTo').value = new Date().toISOString().slice(0, 10);
  if (!$('#xFrom').value) $('#xFrom').value = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  var IDX = [
    { k: 'ndvi', n: 'NDVI', g: t('Vegetation', 'الغطاء النباتي'), e: '(B08-B04)/(B08+B04)', r: [-0.2, 0.9], c: 'rdylgn', d: t('Normalised difference vegetation index (Rouse et al. 1974). Dense vegetation > 0.6, bare soil 0.1–0.2, water < 0.', 'مؤشر الفرق النباتي المعياري (Rouse وآخرون 1974). نبات كثيف > 0.6، تربة جرداء 0.1–0.2، ماء < 0.') },
    { k: 'savi', n: 'SAVI', g: t('Vegetation', 'الغطاء النباتي'), e: '1.5*(B08-B04)/(B08+B04+5000)', r: [-0.2, 0.8], c: 'rdylgn', d: t('Soil-adjusted vegetation index (Huete 1988), L = 0.5, better for sparse arid vegetation.', 'مؤشر النبات المعدل للتربة (Huete 1988)، L = 0.5، أفضل للنبات المتناثر في المناطق الجافة.') },
    { k: 'ndwi', n: 'NDWI', g: t('Water', 'المياه'), e: '(B03-B08)/(B03+B08)', r: [-0.6, 0.6], c: 'rdbu', d: t('McFeeters (1996) water index; open water > 0.', 'مؤشر المياه لـ McFeeters (1996)؛ المياه المفتوحة > 0.') },
    { k: 'mndwi', n: 'MNDWI', g: t('Water', 'المياه'), e: '(B03-B11)/(B03+B11)', r: [-0.6, 0.8], c: 'rdbu', d: t('Modified NDWI (Xu 2006) with SWIR, suppresses built-up noise.', 'NDWI المعدل (Xu 2006) باستخدام SWIR، يخفف ضجيج المناطق المبنية.') },
    { k: 'ndmi', n: 'NDMI', g: t('Moisture', 'الرطوبة'), e: '(B08-B11)/(B08+B11)', r: [-0.6, 0.6], c: 'rdbu', d: t('Normalised difference moisture index (Gao 1996) for vegetation and soil moisture.', 'مؤشر الفرق الرطوبي المعياري (Gao 1996) لرطوبة النبات والتربة.') },
    { k: 'ndbi', n: 'NDBI', g: t('Urban and bare', 'العمران والأرض الجرداء'), e: '(B11-B08)/(B11+B08)', r: [-0.5, 0.5], c: 'magma', d: t('Normalised difference built-up index (Zha et al. 2003).', 'مؤشر الفرق العمراني المعياري (Zha وآخرون 2003).') },
    { k: 'bsi', n: 'BSI', g: t('Urban and bare', 'العمران والأرض الجرداء'), e: '((B11+B04)-(B08+B02))/((B11+B04)+(B08+B02))', r: [-0.4, 0.5], c: 'ylorbr', d: t('Bare soil index (Rikimaru et al. 2002), useful for desertification and quarry mapping.', 'مؤشر التربة الجرداء (Rikimaru وآخرون 2002)، مفيد لرصد التصحر والمقالع.') },
    { k: 'nbr', n: 'NBR', g: t('Fire', 'الحرائق'), e: '(B08-B12)/(B08+B12)', r: [-0.5, 0.8], c: 'rdylgn', d: t('Normalised burn ratio (Key & Benson 2006); compare dates for burn severity (dNBR).', 'نسبة الحرق المعيارية (Key & Benson 2006)؛ قارن تاريخين لشدة الحرق (dNBR).') },
    { k: 'clay', n: t('Clay minerals (B11/B12)', 'المعادن الطينية (B11/B12)'), g: t('Mineral ratios', 'النسب المعدنية'), e: 'B11/B12', r: [1.0, 1.6], c: 'viridis', d: t('SWIR1/SWIR2: high where Al-OH and Mg-OH minerals (clays, micas, carbonates) absorb near 2.2 µm.', 'SWIR1/SWIR2: مرتفعة حيث تمتص معادن Al-OH وMg-OH (الأطيان والميكا والكربونات) قرب 2.2 ميكرون.') },
    { k: 'ferrous', n: t('Ferrous minerals (B11/B08)', 'المعادن الحديدوزية (B11/B08)'), g: t('Mineral ratios', 'النسب المعدنية'), e: 'B11/B08', r: [0.8, 1.8], c: 'plasma', d: t('SWIR1/NIR: Fe²⁺-bearing minerals absorb in the NIR near 0.9–1.1 µm.', 'SWIR1/NIR: تمتص المعادن الحاوية على Fe²⁺ في الأشعة تحت الحمراء القريبة قرب 0.9–1.1 ميكرون.') },
    { k: 'ironox', n: t('Iron oxides (B04/B02)', 'أكاسيد الحديد (B04/B02)'), g: t('Mineral ratios', 'النسب المعدنية'), e: 'B04/B02', r: [1.0, 2.6], c: 'inferno', d: t('Red/blue: hematite and goethite absorb strongly in the blue; high in gossans and red beds.', 'أحمر/أزرق: يمتص الهيماتيت والجيوثايت بقوة في الأزرق؛ مرتفعة في القبعات الحديدية والطبقات الحمراء.') },
    { k: 'tc', n: t('True colour (B4, B3, B2)', 'الألوان الحقيقية (B4، B3، B2)'), g: t('Composites', 'التراكيب اللونية'), a: ['B04', 'B03', 'B02'], rs: '0,3000', d: t('Natural colour.', 'ألوان طبيعية.') },
    { k: 'fc', n: t('False colour (B8, B4, B3)', 'ألوان زائفة (B8، B4، B3)'), g: t('Composites', 'التراكيب اللونية'), a: ['B08', 'B04', 'B03'], rs: '0,5000', d: t('Vegetation appears red.', 'يظهر النبات باللون الأحمر.') },
    { k: 'geo', n: t('Geology (B12, B11, B2)', 'جيولوجي (B12، B11، B2)'), g: t('Composites', 'التراكيب اللونية'), a: ['B12', 'B11', 'B02'], rs: '0,5000', d: t('SWIR composite that separates lithologies and alteration.', 'تركيب SWIR يفصل الصخاريات والتحولات الحرمائية.') }
  ];
  var groups = {}; IDX.forEach(function (x) { (groups[x.g] = groups[x.g] || []).push(x); });
  $('#xIdx').innerHTML = Object.keys(groups).map(function (g) { return '<optgroup label="' + g + '">' + groups[g].map(function (x) { return '<option value="' + x.k + '">' + x.n + '</option>'; }).join('') + '</optgroup>'; }).join('');
  var sv = SH.store.get('shandal_tool_spectral', {}); if (sv.xIdx) $('#xIdx').value = sv.xIdx;
  var idx = function () { var k = SH.val('xIdx'); return IDX.filter(function (x) { return x.k === k; })[0]; };
  $('#xCloud').addEventListener('input', function () { $('#xCloudV').textContent = this.value + ' %'; }); $('#xCloudV').textContent = SH.val('xCloud') + ' %';

  function setAoi(b) { aoi = b; SH.store.set('shandal_spectral_aoi', b); if (!map) return; if (aoiLay) map.removeLayer(aoiLay); aoiLay = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: '#FFD60A', weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map);
    var m = SH.dem ? null : null, kx = 111.32 * Math.cos(SH.rad((b.n + b.s) / 2)), w = (b.e - b.w) * kx, h = (b.n - b.s) * 110.57; $('#xAoi').innerHTML = SH.fmt(w, 1) + ' × ' + SH.fmt(h, 1) + ' km · ' + SH.fmt(w * h, 1) + ' km²' + (w * h > 2500 ? ' · <span style="color:var(--warn)">' + t('large: statistics may be slow', 'كبيرة: قد تكون الإحصاءات بطيئة') + '</span>' : ''); }
  if (aoi) { setAoi(aoi); if (map) map.fitBounds([[aoi.s, aoi.w], [aoi.n, aoi.e]]); }
  $('#xDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#xHint')); });
  $('#xView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  function find() {
    if (!aoi) { SH.toast(t('Draw the area first.', 'ارسم المنطقة أولاً.'), 'warn'); return; } persist.save(); var b = $('#xFind'); b.disabled = true; $('#xScenes').innerHTML = '<span class="xsmall muted">' + t('Searching…', 'جارٍ البحث…') + '</span>';
    fetch(PC + 'stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['sentinel-2-l2a'], bbox: [aoi.w, aoi.s, aoi.e, aoi.n], datetime: SH.val('xFrom') + 'T00:00:00Z/' + SH.val('xTo') + 'T23:59:59Z', query: { 'eo:cloud_cover': { lt: +SH.val('xCloud') } }, sortby: [{ field: 'datetime', direction: 'desc' }], limit: 40 }) })
      .then(function (r) { if (!r.ok) throw new Error('STAC HTTP ' + r.status); return r.json(); })
      .then(function (j) { items = (j.features || []).map(function (f) { var p = f.properties; return { id: f.id, date: p.datetime.slice(0, 10), cloud: p['eo:cloud_cover'], tile: p['s2:mgrs_tile'], base: p['s2:processing_baseline'] || '', plat: p.platform, bbox: f.bbox }; });
        if (!items.length) { $('#xScenes').innerHTML = '<span class="xsmall muted">' + t('No scenes. Widen the dates or the cloud limit.', 'لا توجد مشاهد. وسّع التواريخ أو حد الغيوم.') + '</span>'; return; }
        $('#xScenes').innerHTML = items.map(function (it, i) { return '<button type="button" data-i="' + i + '" class="btn btn-line btn-sm" style="justify-content:space-between;width:100%"><span class="ltr">' + it.date + ' · ' + it.tile + '</span><span class="xsmall muted">☁ ' + SH.fmt(it.cloud, 0) + '% · ' + (it.plat || '').replace('Sentinel-', 'S') + '</span></button>'; }).join(''); pick(0); })
      .catch(function (e) { $('#xScenes').innerHTML = ''; SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; });
  }
  function pick(i) { cur = items[i]; SH.$$('#xScenes [data-i]').forEach(function (b) { b.classList.toggle('btn-ink', +b.getAttribute('data-i') === i); b.classList.toggle('btn-line', +b.getAttribute('data-i') !== i); }); layer(); }
  $('#xScenes').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) pick(+b.getAttribute('data-i')); });
  var off = function (it, ex) { return it && it.base >= '04.00' ? ex.replace(/B(0[1-9]|1[0-2]|8A)/g, '(B$1-1000)') : ex; };
  function params(it, x) { var p = 'collection=sentinel-2-l2a&item=' + encodeURIComponent(it.id);
    if (x.a) return p + x.a.map(function (a) { return '&assets=' + a; }).join('') + '&rescale=' + (it.base >= '04.00' ? x.rs.replace(/^0,(\d+)/, function (_, v) { return '1000,' + (+v + 1000); }) : x.rs) + '&color_formula=' + encodeURIComponent('Gamma RGB 1.3 Saturation 1.2');
    return p + '&expression=' + encodeURIComponent(off(it, x.e)) + '&asset_as_band=true&rescale=' + x.r.join(',') + '&colormap_name=' + x.c; }
  function layer() {
    if (!cur || !map) return; var x = idx(); persist.save(); if (tile) map.removeLayer(tile);
    tile = L.tileLayer(PC + 'data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?' + params(cur, x), { opacity: +SH.val('xOp'), maxZoom: 18, attribution: 'Sentinel-2 L2A © ESA/Copernicus · Microsoft Planetary Computer', bounds: cur.bbox ? [[cur.bbox[1], cur.bbox[0]], [cur.bbox[3], cur.bbox[2]]] : undefined }).addTo(map);
    $('#xIdxNote').innerHTML = x.d + (cur.base >= '04.00' && !x.a ? ' ' + t('Baseline ', 'خط المعالجة ') + cur.base + t(': offset removed.', ': أُزيلت الإزاحة.') : '');
    var lg = $('#xLeg'); lg.hidden = !!x.a; if (!x.a) lg.innerHTML = '<div class="xsmall" style="font-weight:700;margin-bottom:4px">' + x.n + ' · <span class="ltr">' + cur.date + '</span></div><div style="height:10px;border-radius:4px;background:' + grad(x.c) + '"></div><div class="xsmall muted" style="display:flex;justify-content:space-between"><span>' + x.r[0] + '</span><span>' + x.r[1] + '</span></div>';
  }
  var CM = { rdylgn: ['#a50026', '#f46d43', '#fee08b', '#d9ef8b', '#66bd63', '#006837'], rdbu: ['#67001f', '#f4a582', '#f7f7f7', '#92c5de', '#053061'], magma: ['#000004', '#51127c', '#b73779', '#fc8961', '#fcfdbf'], ylorbr: ['#ffffe5', '#fee391', '#fe9929', '#cc4c02', '#662506'], viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'], plasma: ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'], inferno: ['#000004', '#57106e', '#bc3754', '#f98e09', '#fcffa4'] };
  var grad = function (c) { return 'linear-gradient(90deg,' + (CM[c] || CM.viridis).join(',') + ')'; };
  $('#xIdx').addEventListener('change', layer); $('#xOp').addEventListener('input', function () { if (tile) tile.setOpacity(+this.value); });
  $('#xFind').addEventListener('click', find);

  var feat = function () { return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[aoi.w, aoi.s], [aoi.e, aoi.s], [aoi.e, aoi.n], [aoi.w, aoi.n], [aoi.w, aoi.s]]] } }; };
  function stats(it, x) {
    return fetch(PC + 'data/v1/item/statistics?' + params(it, x).replace(/&colormap_name=[^&]*/, '').replace(/&rescale=[^&]*/, '') + '&max_size=1024', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(feat()) })
      .then(function (r) { if (!r.ok) throw new Error('Statistics HTTP ' + r.status); return r.json(); })
      .then(function (j) { var p = j.properties ? j.properties.statistics : j, k = Object.keys(p)[0]; return p[k]; });
  }
  function need() { var x = idx(); if (!aoi || !cur) { SH.toast(t('Draw the area and pick a scene first.', 'ارسم المنطقة واختر مشهداً أولاً.'), 'warn'); return null; } if (x.a) { SH.toast(t('Statistics apply to indices, not colour composites.', 'الإحصاءات للمؤشرات وليس للتراكيب اللونية.'), 'info'); return null; } return x; }
  var row = function (k, v) { return '<tr><th>' + k + '</th><td class="num">' + v + '</td></tr>'; };
  $('#xStats').addEventListener('click', function () { var x = need(); if (!x) return; var o = $('#xOut'); o.innerHTML = '<span class="xsmall muted">' + t('Computing…', 'جارٍ الحساب…') + '</span>';
    stats(cur, x).then(function (s) { o.innerHTML = '<table class="kv" style="font-size:.84rem">' + row(x.n + ' · ' + cur.date, '') + row(t('Mean', 'المتوسط'), SH.fmt(s.mean, 3)) + row(t('Std. deviation', 'الانحراف المعياري'), SH.fmt(s.std, 3)) + row(t('Min · max', 'الأدنى · الأعلى'), SH.fmt(s.min, 3) + ' · ' + SH.fmt(s.max, 3)) + row('P2 · P98', SH.fmt(s.percentile_2, 3) + ' · ' + SH.fmt(s.percentile_98, 3)) + row(t('Valid pixels', 'البكسلات الصالحة'), SH.fmt(s.valid_pixels || s.count, 0)) + '</table><div class="plot" id="xHist" style="height:180px"></div>';
      if (s.histogram) { var h = s.histogram, ctr = h[1].slice(0, -1).map(function (e, i) { return (e + h[1][i + 1]) / 2; }); SH.plot('xHist', [{ type: 'bar', x: ctr, y: h[0], marker: { color: SH.palette().accent } }], function () { return SH.plotLayout({ margin: { l: 40, r: 6, t: 6, b: 30 }, showlegend: false, bargap: 0.02 }); }); } })
      .catch(function (e) { o.innerHTML = ''; SH.toast(e.message, 'bad'); }); });
  $('#xSeries').addEventListener('click', function () { var x = need(); if (!x) return; var o = $('#xOut'), list = items.slice(0, 12).reverse(); o.innerHTML = '<span class="xsmall muted">' + t('Computing ', 'جارٍ حساب ') + list.length + t(' scenes…', ' مشهداً…') + '</span>';
    var res = []; list.reduce(function (p, it) { return p.then(function () { return stats(it, x).then(function (s) { res.push({ d: it.date, m: s.mean, sd: s.std }); }).catch(function () {}); }); }, Promise.resolve()).then(function () {
      o.innerHTML = '<div class="plot" id="xTs" style="height:220px"></div>'; SH.plot('xTs', [{ x: res.map(function (r) { return r.d; }), y: res.map(function (r) { return r.m; }), error_y: { type: 'data', array: res.map(function (r) { return r.sd; }), thickness: 1, color: SH.alpha(SH.palette().accent, .5) }, mode: 'lines+markers', line: { color: SH.palette().accent, width: 2 } }], function () { return SH.plotLayout({ margin: { l: 44, r: 6, t: 6, b: 34 }, showlegend: false, yaxis: { title: { text: x.n } } }); }); }); });
  $('#xChange').addEventListener('click', function () { var x = need(); if (!x || items.length < 2) return; var o = $('#xOut'), old = items[items.length - 1]; if (old.id === cur.id) old = items[items.length - 2]; o.innerHTML = '<span class="xsmall muted">' + t('Comparing…', 'جارٍ المقارنة…') + '</span>';
    Promise.all([stats(old, x), stats(cur, x)]).then(function (s) { var d = s[1].mean - s[0].mean; o.innerHTML = '<table class="kv" style="font-size:.84rem">' + row(x.n + ' · ' + old.date, SH.fmt(s[0].mean, 3) + ' ± ' + SH.fmt(s[0].std, 3)) + row(x.n + ' · ' + cur.date, SH.fmt(s[1].mean, 3) + ' ± ' + SH.fmt(s[1].std, 3)) + row(t('Change in mean', 'التغير في المتوسط'), '<b style="color:var(--' + (d < 0 ? 'warn' : 'ok') + ')">' + (d >= 0 ? '+' : '') + SH.fmt(d, 3) + '</b>') + '</table>' +
      '<p class="xsmall muted" style="margin:0">' + (x.k === 'nbr' ? t('dNBR = NBR(before) − NBR(after); > 0.27 indicates moderate-to-high burn severity (Key & Benson 2006).', 'dNBR = NBR(قبل) − NBR(بعد)؛ القيم > 0.27 تدل على شدة حرق متوسطة إلى عالية (Key & Benson 2006).') : t('Compare scenes from the same season to avoid phenological effects.', 'قارن مشاهد من الفصل نفسه لتجنّب التأثيرات الموسمية.')) + '</p>'; }).catch(function (e) { o.innerHTML = ''; SH.toast(e.message, 'bad'); }); });
})();
