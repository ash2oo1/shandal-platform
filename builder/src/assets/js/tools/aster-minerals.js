/* ASTER mineral mapping — Terra ASTER Level-1T (VNIR 15 m, SWIR 30 m, TIR 90 m, 2000–2006 in this archive): band-ratio
   mineral group indices of the Geoscience Australia ASTER products (Cudahy 2012) and Ninomiya thermal indices — ferric
   and ferrous iron, AlOH (clays, micas, alunite), kaolin, FeOH, MgOH and carbonate, silica, quartz and gypsum — with
   vegetation and water masked, a 2–98 % stretch, an RGB of AlOH, MgOH and ferric content, the strongest X % of the area
   outlined as anomalies on the image, their area, and exports. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, G = window.EG, P = window.PCX, AR = SH.lang === 'ar';
  var COL = 'aster-l1t', MS = 900;
  var B = { 1: 'VNIR_b1', 2: 'VNIR_b2', 3: 'VNIR_b3', 4: 'SWIR_b1', 5: 'SWIR_b2', 6: 'SWIR_b3', 7: 'SWIR_b4', 8: 'SWIR_b5', 9: 'SWIR_b6', 10: 'TIR_b1', 11: 'TIR_b2', 12: 'TIR_b3', 13: 'TIR_b4', 14: 'TIR_b5' };
  /* multi-band assets are addressed as ASSET_bN, so asset_as_band is not used here */
  function E(s, lo, hi) { return '&expression=' + encodeURIComponent(ex(s)) + '&rescale=' + lo + ',' + hi; }
  function ex(s) { return s.replace(/B(\d+)/g, function (m, n) { return B[n] + '*1.0'; }); }
  /* [key, en, ar, expression with Bn, rescale lo, hi, note en, note ar] */
  var IX = [
    ['fe3', 'Ferric oxide content (B2/B1)', 'محتوى أكاسيد الحديد الثلاثي (B2/B1)', 'B2/B1', 0.5, 2.5, 'Hematite, goethite and red beds, gossans and laterites.', 'الهيماتايت والغوثايت والطبقات الحمراء والقبعات الحديدية واللاترايت.'],
    ['fe2', 'Ferrous iron index (B5/B4)', 'مؤشر الحديد الثنائي (B5/B4)', 'B5/B4', 0.2, 1.2, 'Fe²⁺ in silicates and carbonates: mafic and ultramafic rocks, chlorite, siderite.', 'الحديد الثنائي في السيليكات والكربونات: الصخور المافية وفوق المافية والكلورايت والسيدرايت.'],
    ['aloh', 'AlOH group content ((B5+B7)/B6)', 'محتوى مجموعة AlOH ((B5+B7)/B6)', '(B5+B7)/B6', 1.5, 2.6, 'Clays (kaolinite, smectite, illite), white micas, alunite and pyrophyllite: argillic alteration and clay-rich beds.', 'الأطيان (الكاؤولينايت والسمكتايت والإلايت) والميكا البيضاء والألونايت والبايروفلايت: التغيير الأرجيلي والطبقات الغنية بالطين.'],
    ['kaol', 'Kaolin group index (B6/B5)', 'مؤشر مجموعة الكاؤولين (B6/B5)', 'B6/B5', 0.7, 1.4, 'Kaolinite and halloysite, the clays of the Hussainiyat and Ga’ara kaolin deposits.', 'الكاؤولينايت والهالويسايت، أطيان رواسب كاؤولين الحسينيات والكعرة.'],
    ['feoh', 'FeOH group content ((B6+B8)/B7)', 'محتوى مجموعة FeOH ((B6+B8)/B7)', '(B6+B8)/B7', 1.6, 2.6, 'Jarosite, chlorite, epidote and nontronite.', 'الجاروسايت والكلورايت والإبيدوت والنونترونايت.'],
    ['mgoh', 'MgOH and carbonate content ((B6+B9)/(B7+B8))', 'محتوى MgOH والكربونات ((B6+B9)/(B7+B8))', '(B6+B9)/(B7+B8)', 0.7, 1.3, 'Calcite, dolomite, chlorite, serpentine and talc: limestones, marbles and propylitic alteration.', 'الكالسايت والدولومايت والكلورايت والسربنتين والتالك: الأحجار الجيرية والمرمر والتغيير البروبيليتي.'],
    ['gyp', 'Gypsum index ((B10+B12)/B11, thermal)', 'مؤشر الجبس ((B10+B12)/B11، حراري)', '(B10+B12)/B11', 1.8, 2.3, 'Gypsum and anhydrite of the Fat’ha (Lower Fars) Formation and gypcrete, 90 m.', 'جبس وأنهيدرايت تكوين الفتحة (الفارس الأسفل) والقشور الجبسية، 90 م.'],
    ['sil', 'Silica index (B13/B10, thermal)', 'مؤشر السيليكا (B13/B10، حراري)', 'B13/B10', 0.9, 1.4, 'Silica-rich rocks and soils: sandstones, cherts, silicified zones, 90 m.', 'الصخور والترب الغنية بالسيليكا: الأحجار الرملية والصوان والنطاقات المتسلكنة، 90 م.'],
    ['qtz', 'Quartz index (B11/(B10+B12), thermal)', 'مؤشر الكوارتز (B11/(B10+B12)، حراري)', 'B11/(B10+B12)', 0.4, 0.6, 'Quartz-rich sands and sandstones (Ninomiya), 90 m.', 'الرمال والأحجار الرملية الغنية بالكوارتز (نينوميا)، 90 م.'],
    ['carb', 'Carbonate index (B13/B14, thermal)', 'مؤشر الكربونات (B13/B14، حراري)', 'B13/B14', 0.95, 1.1, 'Limestone and dolomite (Ninomiya), 90 m.', 'الحجر الجيري والدولومايت (نينوميا)، 90 م.'],
    ['rgb', 'Composite: AlOH (red) · MgOH (green) · ferric (blue)', 'تركيب: AlOH (أحمر) · MgOH (أخضر) · الحديد الثلاثي (أزرق)', '', 0, 0, 'Red areas are clay-rich, green carbonate-rich, blue iron-oxide-rich; mixtures give intermediate colours.', 'المناطق الحمراء غنية بالطين، والخضراء بالكربونات، والزرقاء بأكاسيد الحديد؛ والخلائط تعطي ألواناً وسطية.']];
  var IDS = ['asIx', 'asTop', 'asBase', 'asVeg', 'asName'], persist;
  var PRE = [['akashat', 'Akashat (phosphate and clays)', 'عكاشات (الفوسفات والأطيان)', [39.75, 33.5, 40.2, 33.85]], ['rutba', 'Rutba uplift', 'مرتفع الرطبة', [40.05, 32.85, 40.5, 33.2]], ['hussainiyat', 'Hussainiyat kaolin', 'كاؤولين الحسينيات', [40.65, 33.4, 41.0, 33.65]], ['mishraq', 'Mishraq sulphur', 'كبريت المشراق', [43.2, 36.0, 43.45, 36.2]], ['penjween', 'Penjween ophiolites', 'أوفيولايت بنجوين', [45.8, 35.5, 46.1, 35.75]], ['fatha', 'Fat’ha gypsum (Hemrin)', 'جبس الفتحة (حمرين)', [43.5, 34.85, 43.85, 35.15]],
    ['cuprite', 'Cuprite, Nevada (test site)', 'كوبرايت، نيفادا (موقع اختبار)', [-117.3, 37.45, -117.1, 37.6]], ['oman', 'Oman ophiolite', 'أوفيولايت عُمان', [57.9, 23.2, 58.3, 23.5]]];
  var map = SH.map('asMap', { zoom: 6, base: 'satellite', center: [33, 44] }), L = window.L, ovl = null, R = null, busy = false, SC = [];
  var aoiP = P.aoiPicker({ key: 'aster', prefix: 'as', map: map, presets: PRE, maxKm: 60, minKm: 1, groups: [['Iraq', 'العراق', ['akashat', 'rutba', 'hussainiyat', 'mishraq', 'penjween', 'fatha']], ['The world', 'العالم', ['cuprite', 'oman']]], onChange: function () { SC = []; $('#asScene').innerHTML = '<option value="">' + t('— search first —', '— ابحث أولاً —') + '</option>'; } });
  $('#asIx').innerHTML = IX.map(function (q) { return '<option value="' + q[0] + '">' + (AR ? q[2] : q[1]) + '</option>'; }).join(''); persist = SH.persist('aster', IDS);
  function note() { var q = IX.filter(function (x) { return x[0] === $('#asIx').value; })[0] || IX[0]; $('#asIxNote').textContent = AR ? q[7] : q[6]; } note(); $('#asIx').addEventListener('change', note);
  function msg(p, s) { $('#asBar').style.width = Math.round(p * 100) + '%'; $('#asMsg').textContent = s; }
  function nm() { return aoiP.name(); }
  function km2(v) { return F(v, v < 10 ? 2 : v < 100 ? 1 : 0) + ' km²'; }

  /* ------------------------------------------------------------------ scenes */
  function find() {
    var a = aoiP.cur; if (!a) return Promise.resolve([]); msg(0.1, t('Searching ASTER images…', 'البحث عن صور ASTER…'));
    return P.search(COL, a, ['2000-01-01T00:00:00Z', '2006-12-31T23:59:59Z'], { 'eo:cloud_cover': { lt: 25 } }, 200).then(function (its) {
      SC = its.map(function (f) { return { f: f, id: f.id, date: f.properties.datetime.slice(0, 10), cloud: f.properties['eo:cloud_cover'], cov: P.coverFrac(f.geometry, a) }; }).filter(function (x) { return x.cov > 0.2; }).sort(function (x, y) { return (y.cov >= 0.95) - (x.cov >= 0.95) || x.cloud - y.cloud; }).slice(0, 15);
      $('#asScene').innerHTML = SC.length ? SC.map(function (x, i) { return '<option value="' + i + '">' + x.date + ' · ' + t('cloud ', 'غيوم ') + F(x.cloud, 0) + ' % · ' + t('covers ', 'تغطي ') + F(x.cov * 100, 0) + ' %</option>'; }).join('') : '<option value="">' + t('No ASTER image here', 'لا توجد صورة ASTER هنا') + '</option>';
      msg(0, SC.length ? t('Images found: ', 'الصور الموجودة: ') + SC.length : t('No ASTER short-wave image covers this area with little cloud.', 'لا توجد صورة ASTER قليلة الغيوم تغطي هذه المنطقة.')); return SC;
    });
  }
  $('#asFind').addEventListener('click', function () { find().catch(function (e) { msg(0, ''); SH.toast(e.message, 'bad'); }); });

  /* ------------------------------------------------------------------ run */
  function get(a, items, q) { return P.mosaic(a, COL, items, q, MS); }
  function run() {
    if (busy) return; var a = aoiP.cur; if (!a) return SH.toast(t('Choose a place first.', 'اختر مكاناً أولاً.'), 'warn');
    persist.save(); busy = true; $('#asRun').disabled = true;
    (SC.length ? Promise.resolve(SC) : find()).then(function (S) {
      if (!S.length) throw new Error(t('No ASTER image covers this area.', 'لا توجد صورة ASTER تغطي هذه المنطقة.'));
      var sel = S[+$('#asScene').value || 0] || S[0], others = S.filter(function (x) { return x !== sel; }).map(function (x) { return x.f; }), use = P.pick([sel.f].concat(others), a, 3).map(function (f) { return { id: f.id, date: f.properties.datetime.slice(0, 10) }; });
      var key = $('#asIx').value, q = IX.filter(function (x) { return x[0] === key; })[0], reqs = [];
      var base = $('#asBase').value === 'nc' ? E('B2;(B1*0.75+B3*0.25);B1*0.85', 0, 255) : E('B3;B2;B1', 0, 255);
      reqs.push(get(a, use, base));
      reqs.push(get(a, use, E('(B3-B2)/(B3+B2+0.001);(B1-B3)/(B1+B3+0.001)', -1, 1)));
      if (key === 'rgb') ['aloh', 'mgoh', 'fe3'].forEach(function (k) { var z = IX.filter(function (x) { return x[0] === k; })[0]; reqs.push(get(a, use, E(z[3], z[4], z[5]))); });
      else reqs.push(get(a, use, E(q[3], q[4], q[5])));
      msg(0.3, t('Reading the image bands… ', 'قراءة نطاقات الصورة… ') + reqs.length);
      return Promise.all(reqs).then(function (I) { R = analyse(a, q, I, use); render(); msg(1, t('Ready.', 'جاهز.')); });
    }).catch(function (e) { msg(0, ''); SH.toast(e.message || String(e), 'bad'); }).then(function () { busy = false; $('#asRun').disabled = false; });
  }
  $('#asRun').addEventListener('click', run);

  function analyse(a, q, I, use) {
    var base = I[0], mk = I[1], w0 = base.width, h0 = base.height, n = w0 * h0, ok = new Uint8Array(n), vm = $('#asVeg').checked, rows = P.rowArea(a, w0, h0), i, nV = 0, nW = 0, area = 0;
    for (i = 0; i < n; i++) { var o = 4 * i; if (base.data[o + 3] < 128) continue; var nd = mk.data[o] / 255 * 2 - 1, nw = mk.data[o + 1] / 255 * 2 - 1; if (vm && nd > 0.25) { nV++; continue; } if (vm && nw > 0.1) { nW++; continue; } ok[i] = 1; area += rows[Math.floor(i / w0)]; }
    var chans = q[0] === 'rgb' ? [I[2], I[3], I[4]] : [I[2]], val = chans.map(function (C) { var v = new Uint8Array(n); for (var i2 = 0; i2 < n; i2++) v[i2] = C.data[4 * i2 + 3] > 127 && ok[i2] ? C.data[4 * i2] : 0; return v; });
    var H = new Uint32Array(256), tot = 0; val[0].forEach(function (v, k) { if (ok[k] && v > 0) { H[v]++; tot++; } });
    var pc = function (p) { var c = 0; for (var k = 0; k < 256; k++) { c += H[k]; if (c >= tot * p) return k; } return 255; }, p2 = pc(0.02), p98 = pc(0.98), p50 = pc(0.5), top = +$('#asTop').value, pt = pc(1 - top / 100);
    var an = new Uint8Array(n), aA = 0; if (q[0] !== 'rgb') for (i = 0; i < n; i++) if (ok[i] && val[0][i] >= pt && val[0][i] > 0) { an[i] = 1; aA += rows[Math.floor(i / w0)]; }
    var dec = function (b) { return q[4] + b / 255 * (q[5] - q[4]); };
    return { a: a, q: q, w: w0, h: h0, base: base, ok: ok, val: val, H: H, tot: tot, p2: p2, p98: p98, p50: p50, pt: pt, top: top, an: an, aA: aA, area: area, dec: dec, use: use, nV: nV, nW: nW, chans: chans };
  }

  /* ------------------------------------------------------------------ drawing */
  var RAMP = [[0, [43, 58, 168]], [0.25, [0, 160, 220]], [0.5, [90, 200, 90]], [0.75, [250, 210, 40]], [1, [220, 40, 30]]];
  function ramp(x) { x = Math.max(0, Math.min(1, x)); for (var k = 1; k < RAMP.length; k++) if (x <= RAMP[k][0]) { var a0 = RAMP[k - 1], b0 = RAMP[k], u = (x - a0[0]) / (b0[0] - a0[0]); return [0, 1, 2].map(function (j) { return Math.round(a0[1][j] + (b0[1][j] - a0[1][j]) * u); }); } return RAMP[RAMP.length - 1][1]; }
  function baseCv(r, dim) { var img = new ImageData(new Uint8ClampedArray(r.base.data), r.w, r.h); P.stretch(img, 0.01); if (dim) for (var i = 0; i < img.data.length; i += 4) { var g0 = 0.3 * img.data[i] + 0.59 * img.data[i + 1] + 0.11 * img.data[i + 2]; img.data[i] = img.data[i + 1] = img.data[i + 2] = g0 * 0.8 + 40; } return P.canvasOf(img); }
  function ixCv(r) {
    var img = new ImageData(r.w, r.h), n = r.w * r.h;
    for (var m0 = 0; m0 < n; m0++) if (!r.ok[m0] && r.base.data[4 * m0 + 3] > 127) { img.data[4 * m0] = img.data[4 * m0 + 1] = img.data[4 * m0 + 2] = 200; img.data[4 * m0 + 3] = 255; }
    if (r.q[0] === 'rgb') { var st = r.val.map(function (v) { var H = new Uint32Array(256), tt = 0; v.forEach(function (x, k) { if (r.ok[k] && x) { H[x]++; tt++; } }); var c = 0, lo = 0, hi = 255, k; for (k = 0; k < 256; k++) { c += H[k]; if (c >= tt * 0.02) { lo = k; break; } } c = 0; for (k = 255; k >= 0; k--) { c += H[k]; if (c >= tt * 0.02) { hi = k; break; } } return [lo, Math.max(lo + 1, hi)]; });
      for (var i = 0; i < n; i++) { if (!r.ok[i]) continue; var o = 4 * i; for (var c2 = 0; c2 < 3; c2++) img.data[o + c2] = Math.max(0, Math.min(255, (r.val[c2][i] - st[c2][0]) / (st[c2][1] - st[c2][0]) * 255)); img.data[o + 3] = 255; } return P.canvasOf(img); }
    for (var j = 0; j < n; j++) { if (!r.ok[j] || !r.val[0][j]) continue; var c3 = ramp((r.val[0][j] - r.p2) / Math.max(1, r.p98 - r.p2)), o2 = 4 * j; img.data[o2] = c3[0]; img.data[o2 + 1] = c3[1]; img.data[o2 + 2] = c3[2]; img.data[o2 + 3] = 255; }
    return P.canvasOf(img);
  }
  function anCv(r) { var img = new ImageData(r.w, r.h); for (var i = 0; i < r.an.length; i++) { if (!r.an[i]) continue; var x = i % r.w, y = (i - x) / r.w, edge = x === 0 || y === 0 || x === r.w - 1 || y === r.h - 1 || !r.an[i - 1] || !r.an[i + 1] || !r.an[i - r.w] || !r.an[i + r.w], o = 4 * i; if (edge) { img.data[o] = 255; img.data[o + 1] = 230; img.data[o + 2] = 0; img.data[o + 3] = 255; } else { img.data[o] = 255; img.data[o + 1] = 60; img.data[o + 2] = 0; img.data[o + 3] = 120; } } return P.canvasOf(img); }
  function render() {
    var r = R; if (!r) return; $('#asEmpty').hidden = true; $('#asOut').hidden = false; var q = r.q, isRgb = q[0] === 'rgb';
    $('#asKpis').innerHTML = (isRgb ? '' : G.kpi('warn', t('Anomaly area (top ', 'مساحة الشذوذ (أعلى ') + r.top + ' %)', F(r.aA, r.aA < 10 ? 2 : 1) + '<small> km²</small>', t('index ≥ ', 'المؤشر ≥ ') + F(r.dec(r.pt), 3))) + G.kpi('info', t('Rock and soil analysed', 'الصخر والتربة المحللة'), F(r.area, 1) + '<small> km²</small>', t('vegetation and water left out', 'استُبعد النبات والمياه')) + (isRgb ? '' : G.kpi('info', t('Median index', 'وسيط المؤشر'), F(r.dec(r.p50), 3), '2–98 %: ' + F(r.dec(r.p2), 3) + ' – ' + F(r.dec(r.p98), 3))) + G.kpi('info', t('Image', 'الصورة'), r.use[0].date, r.use.length > 1 ? t('mosaic of ', 'فسيفساء ') + r.use.length : 'ASTER L1T');
    var v = [G.verdict('info', AR ? q[2] : q[1], (AR ? q[7] : q[6]) + ' ' + (isRgb ? '' : t('The highest ', 'أعلى ') + r.top + t(' % of the rock surface is outlined in yellow on the image as anomalies to visit in the field.', ' % من سطح الصخور محددة بالأصفر على الصورة شذوذاتٍ يُتحقق منها في الحقل.')))];
    v.push(G.verdict('warn', t('An index is a pointer, not a proof', 'المؤشر دليل لا برهان'), t('Ratios of raw image values show where a mineral group is relatively strong, not how much of it there is. Shadows, dark soils, scene seams and different gain settings can shift them. Confirm with field samples, a hand lens, acid for carbonates, and laboratory XRD or spectra.', 'نسب القيم الخام للصورة تُظهر أين تكون المجموعة المعدنية قوية نسبياً، لا كم منها يوجد. وقد تزيحها الظلال والترب الداكنة وحدود المشاهد وإعدادات الكسب المختلفة. أكّد بالعينات الحقلية والعدسة والحامض للكربونات وتحليل XRD أو الأطياف في المختبر.')));
    $('#asVerd').innerHTML = v.join('');
    var cv = $('#asCv'), bk = $('#asBase').value, title = nm() + ' — ' + (isRgb ? 'AlOH · MgOH · ferric oxide composite' : q[1].replace(/ \(.*$/, ''));
    P.sheet(cv, { a: r.a, title: title, sub: 'ASTER L1T ' + r.use.map(function (u) { return u.date; }).join(', ') + ' · ' + (isRgb ? 'RGB of AlOH, MgOH and ferric oxide content' : q[1]) + ' · vegetation and water masked', smooth: true,
      layers: (bk === 'none' ? [] : [{ img: baseCv(r, true), alpha: 1 }]).concat([{ img: ixCv(r), alpha: bk === 'none' ? 1 : 0.85 }]),
      legend: (isRgb ? [['AlOH (clays)', '#E03030'], ['MgOH and carbonate', '#30C030'], ['Ferric oxide', '#3060E0']] : []).concat([['Masked (vegetation, water)', '#C8C8C8']]),
      ramp: isRgb ? null : { lo: 0, hi: 1, stops: RAMP.map(function (s) { return [s[0], 'rgb(' + s[1].join(',') + ')']; }), ticks: [0, 0.25, 0.5, 0.75, 1], fmt: function (x) { return F(r.dec(r.p2 + x * (r.p98 - r.p2)), 2); }, label: q[1] + ' (2–98 % stretch)' } });
    $('#asCap').textContent = isRgb ? t('Each colour channel is one mineral index stretched over the area: red AlOH (clays, micas), green MgOH and carbonate, blue ferric oxide. White means all three are high, black all low.', 'كل قناة لونية مؤشر معدني ممدد على المنطقة: الأحمر AlOH (الأطيان والميكا)، والأخضر MgOH والكربونات، والأزرق أكاسيد الحديد الثلاثي. والأبيض يعني ارتفاع الثلاثة، والأسود انخفاضها.') : t('The index from low (blue) to high (red), stretched between the 2nd and 98th percentiles of the rock surface; grey is vegetation or water.', 'المؤشر من المنخفض (الأزرق) إلى المرتفع (الأحمر)، ممدداً بين المئين 2 و98 لسطح الصخور؛ والرمادي نبات أو ماء.');
    var cv2 = $('#asCv2');
    P.sheet(cv2, { a: r.a, title: nm() + ' — ' + (isRgb ? 'image' : 'anomalies (top ' + r.top + ' %)'), sub: 'ASTER ' + (bk === 'nc' ? 'natural-like colour' : 'false colour 3-2-1') + ', ' + r.use[0].date, layers: [baseCv(r, false)].concat(isRgb ? [] : [anCv(r)]), legend: isRgb ? [] : [['Anomaly (outline)', '#FFE600'], ['Anomaly (area)', 'rgba(255,60,0,.5)']], stats: isRgb ? '' : 'Anomaly area ' + km2(r.aA) + '  ·  index ≥ ' + F(r.dec(r.pt), 3) });
    $('#asCap2').textContent = isRgb ? t('The image itself, for comparison.', 'الصورة نفسها للمقارنة.') : t('The strongest part of the index outlined in yellow on the image: these are the places to visit and sample first.', 'أقوى جزء من المؤشر محدداً بالأصفر على الصورة: هذه هي الأماكن التي تُزار وتؤخذ منها العينات أولاً.');
    if (!isRgb) hist(); else $('#asHist').innerHTML = '';
    if (map) { if (ovl) map.removeLayer(ovl); ovl = L.imageOverlay(ixCv(r).toDataURL(), [[r.a.s, r.a.w], [r.a.n, r.a.e]], { opacity: 0.75 }).addTo(map); }
  }
  function hist() {
    var r = R, pts = [], mx = 0; for (var k = 1; k < 256; k += 2) { var v = 100 * (r.H[k] + (r.H[k + 1] || 0)) / (r.tot || 1); pts.push([r.dec(k), v]); mx = Math.max(mx, v); }
    G.chart($('#asHist'), { W: 760, H: 330, m: { l: 64, r: 20, t: 18, b: 56 }, x: { lo: r.q[4], hi: r.q[5], n: 8, title: r.q[1] }, y: { lo: 0, hi: mx * 1.12 || 1, title: 'Share of rock surface (%)' },
      top: function (fx, fy) { var x = fx(r.dec(r.pt)); return '<rect x="' + x + '" y="' + fy(mx * 1.12) + '" width="' + (fx(r.q[5]) - x) + '" height="' + (fy(0) - fy(mx * 1.12)) + '" fill="#FF3C00" fill-opacity=".08"/><line x1="' + x + '" x2="' + x + '" y1="' + fy(mx * 1.12) + '" y2="' + fy(0) + '" stroke="#C0392B" stroke-width="2" stroke-dasharray="6 4"/>' + G.tx(x + 6, fy(mx * 1.04), 'Top ' + r.top + ' %', { fs: 11.5, fw: 700, fill: '#C0392B' }); },
      series: [{ pts: pts, col: '#8E44AD', w: 2.4 }], legend: [{ name: 'Rock and soil pixels', col: '#8E44AD' }, { name: 'Anomaly threshold', col: '#C0392B', dash: '6 4' }] });
    $('#asHistCap').textContent = t('How the index is spread over the rock surface. A long tail on the right is a sign of a real mineral concentration; a single symmetric peak means no strong anomaly.', 'كيف يتوزع المؤشر على سطح الصخور. والذيل الطويل إلى اليمين علامة على تركز معدني حقيقي؛ والقمة الواحدة المتناظرة تعني عدم وجود شذوذ قوي.');
  }
  $$('[data-cv]').forEach(function (b) { b.addEventListener('click', function () { if (!R) return; SH.exportCanvas($('#' + b.getAttribute('data-cv')), 'shandal-aster-' + R.q[0] + '-' + (R.a.key || 'area'), b.getAttribute('data-fmt')); }); });
  $('#asCsv').addEventListener('click', function () { if (!R) return; var r = R; SH.csv('shandal-aster-' + r.q[0] + '-' + (r.a.key || 'area') + '.csv', [['place', nm()], ['bbox_w_s_e_n', [r.a.w, r.a.s, r.a.e, r.a.n].join(' ')], ['images', r.use.map(function (u) { return u.id; }).join(' ')], ['index', r.q[1]], ['rock_area_km2', r.area.toFixed(3)]].concat(r.q[0] === 'rgb' ? [] : [['p2', r.dec(r.p2).toFixed(4)], ['median', r.dec(r.p50).toFixed(4)], ['p98', r.dec(r.p98).toFixed(4)], ['anomaly_top_pct', r.top], ['anomaly_threshold', r.dec(r.pt).toFixed(4)], ['anomaly_area_km2', r.aA.toFixed(3)]])); });
  $('#asGeo').addEventListener('click', function () {
    if (!R || R.q[0] === 'rgb') return; var r = R, a = r.a, dx = (a.e - a.w) / r.w, dy = (a.n - a.s) / r.h, open = {}, rects = [];
    for (var y = 0; y <= r.h; y++) { var runs = {}, x = 0; if (y < r.h) while (x < r.w) { if (r.an[y * r.w + x]) { var x0 = x; while (x < r.w && r.an[y * r.w + x]) x++; runs[x0 + ':' + x] = 1; } else x++; } Object.keys(open).forEach(function (k) { if (runs[k]) delete runs[k]; else { var p = k.split(':'); rects.push([+p[0], open[k], +p[1], y]); delete open[k]; } }); Object.keys(runs).forEach(function (k) { open[k] = y; }); }
    SH.json('shandal-aster-anomalies-' + r.q[0] + '.geojson', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: nm(), index: r.q[1], top_pct: r.top, threshold: +r.dec(r.pt).toFixed(4), area_km2: +r.aA.toFixed(3), images: r.use.map(function (u) { return u.id; }).join(' ') }, geometry: { type: 'MultiPolygon', coordinates: rects.map(function (q) { var W0 = a.w + q[0] * dx, E0 = a.w + q[2] * dx, N0 = a.n - q[1] * dy, S0 = a.n - q[3] * dy; return [[[W0, S0], [E0, S0], [E0, N0], [W0, N0], [W0, S0]]]; }) } }] });
  });
  ['asIx', 'asTop', 'asBase', 'asVeg'].forEach(function (id) { $('#' + id).addEventListener('change', function () { persist.save(); }); });
  $('#asName').addEventListener('input', function () { persist.save(); if (R) render(); });
})();
