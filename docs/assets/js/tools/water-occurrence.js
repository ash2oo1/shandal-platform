/* Water through the decades — the JRC Global Surface Water atlas (Pekel et al. 2016, version to 2020), built from every
   Landsat scene since March 1984: occurrence (how often a pixel was water), the transition classes between the first
   and the last year (permanent, new, lost, seasonal and their changes), the change of occurrence between 1984–1999 and
   2000–2020, and the months of water in 2020, with areas computed from the true ground area of each pixel. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, P = window.PCX, G = window.EG, AR = SH.lang === 'ar';
  var COL = 'jrc-gsw', MS = 1000;
  var TR = { 1: ['Permanent', 'دائمة', '#0000FF'], 2: ['New permanent', 'دائمة جديدة', '#22B14C'], 3: ['Lost permanent', 'دائمة مفقودة', '#D1102D'], 4: ['Seasonal', 'موسمية', '#99D9EA'], 5: ['New seasonal', 'موسمية جديدة', '#B5E61D'], 6: ['Lost seasonal', 'موسمية مفقودة', '#E6A1AA'], 7: ['Seasonal to permanent', 'من موسمية إلى دائمة', '#FF7F27'], 8: ['Permanent to seasonal', 'من دائمة إلى موسمية', '#FFC90E'], 9: ['Ephemeral permanent', 'دائمة عابرة', '#7F7F7F'], 10: ['Ephemeral seasonal', 'موسمية عابرة', '#C3C3C3'] };
  var IDS = ['woName', 'woView'], persist = SH.persist('wateroccurrence', IDS);
  var PRE = [['sawa', 'Lake Sawa', 'بحيرة ساوة', [44.94, 31.27, 45.08, 31.36]], ['razzaza', 'Razzaza Lake', 'بحيرة الرزازة', [43.5, 32.45, 44.1, 32.95]], ['central', 'Central Marshes', 'الأهوار الوسطى', [46.45, 30.85, 47.05, 31.25]], ['hammar', 'Hammar Marsh', 'هور الحمّار', [46.6, 30.6, 47.4, 30.98]], ['tharthar', 'Lake Tharthar', 'بحيرة الثرثار', [43.1, 33.7, 43.6, 34.25]], ['mosul', 'Mosul Dam Lake', 'بحيرة سد الموصل', [42.55, 36.6, 43.0, 36.95]], ['habbaniyah', 'Habbaniyah Lake', 'بحيرة الحبانية', [43.3, 33.15, 43.6, 33.35]],
    ['aral', 'Aral Sea (south)', 'بحر آرال (الجنوبي)', [58.2, 43.6, 59.9, 44.9]], ['urmia', 'Lake Urmia', 'بحيرة أورمية', [44.9, 37.0, 46.0, 38.3]], ['mead', 'Lake Mead (USA)', 'بحيرة ميد (أمريكا)', [-114.9, 35.95, -114.0, 36.55]], ['poopo', 'Lake Poopó (Bolivia)', 'بحيرة بوبو (بوليفيا)', [-67.3, -19.0, -66.8, -18.5]]];
  var map = SH.map('woMap', { zoom: 6, base: 'satellite', center: [33, 44] }), L = window.L, ovl = null, R = null, busy = false;
  var aoiP = P.aoiPicker({ key: 'wateroccurrence', prefix: 'wo', map: map, presets: PRE, maxKm: 150, minKm: 1, groups: [['Iraq', 'العراق', ['sawa', 'razzaza', 'central', 'hammar', 'tharthar', 'mosul', 'habbaniyah']], ['The world', 'العالم', ['aral', 'urmia', 'mead', 'poopo']]] });
  function msg(p, s) { $('#woBar').style.width = Math.round(p * 100) + '%'; $('#woMsg').textContent = s; }
  function nm() { return aoiP.name(); }
  function km2(v) { return F(v, v < 10 ? 2 : v < 100 ? 1 : 0) + ' km²'; }
  function layer(a, asset, nodata) { return P.search(COL, a, null, null, 20).then(function (its) { if (!its.length) throw new Error(t('The water atlas does not cover this area.', 'أطلس المياه لا يغطي هذه المنطقة.')); var use = P.pick(its, a, 4); return P.mosaic(a, COL, use.map(function (f) { return { id: f.id }; }), '&assets=' + asset + (nodata != null ? '&nodata=' + nodata : '') + '&resampling=nearest', MS); }); }
  function run() {
    if (busy) return; var a = aoiP.cur; if (!a) return SH.toast(t('Choose a place first.', 'اختر مكاناً أولاً.'), 'warn'); persist.save(); busy = true; $('#woRun').disabled = true; msg(0.1, t('Reading the water atlas…', 'قراءة أطلس المياه…'));
    Promise.all([layer(a, 'occurrence', 255), layer(a, 'transitions', null), layer(a, 'change', 255), layer(a, 'seasonality', 255)].map(function (p, i) { return p.then(function (x) { msg(0.1 + 0.2 * (i + 1), t('Water atlas layers: ', 'طبقات أطلس المياه: ') + (i + 1) + ' / 4'); return x; }); }))
      .then(function (I) { R = analyse(a, I); render(); msg(1, t('Ready.', 'جاهز.')); })
      .catch(function (e) { msg(0, ''); SH.toast(e.message || String(e), 'bad'); }).then(function () { busy = false; $('#woRun').disabled = false; });
  }
  $('#woRun').addEventListener('click', run);
  function analyse(a, I) {
    var w0 = I[0].width, h0 = I[0].height, n = w0 * h0, rows = P.rowArea(a, w0, h0), occ = new Uint8Array(n), tr = new Uint8Array(n), ch = new Uint8Array(n), se = new Uint8Array(n), okO = new Uint8Array(n), A = {}, ever = 0, perm = 0, occ75 = 0, mean = 0, mw = 0, gain = 0, loss = 0, i;
    for (var k = 1; k <= 10; k++) A[k] = 0;
    for (i = 0; i < n; i++) { var o = 4 * i, ar = rows[Math.floor(i / w0)];
      if (I[0].data[o + 3] > 127) { okO[i] = 1; occ[i] = I[0].data[o]; if (occ[i] > 0 && occ[i] <= 100) { ever += ar; mean += occ[i] * ar; mw += ar; if (occ[i] >= 75) occ75 += ar; } }
      if (I[1].data[o + 3] > 127) { tr[i] = I[1].data[o]; if (A[tr[i]] != null) A[tr[i]] += ar; }
      if (I[2].data[o + 3] > 127) { ch[i] = I[2].data[o]; if (ch[i] <= 200) { var d = ch[i] - 100; if (d > 0) gain += ar * d / 100; else loss += ar * -d / 100; } }
      if (I[3].data[o + 3] > 127) se[i] = I[3].data[o]; }
    perm = A[1] + A[2] + A[7];
    return { a: a, w: w0, h: h0, occ: occ, tr: tr, ch: ch, se: se, okO: okO, A: A, ever: ever, perm: perm, occ75: occ75, meanOcc: mw ? mean / mw : 0, gain: gain, loss: loss };
  }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lerp(st, x) { x = Math.max(0, Math.min(1, x)); for (var k = 1; k < st.length; k++) if (x <= st[k][0]) { var a0 = st[k - 1], b0 = st[k], u = (x - a0[0]) / (b0[0] - a0[0] || 1); return [0, 1, 2].map(function (j) { return Math.round(a0[1][j] + (b0[1][j] - a0[1][j]) * u); }); } return st[st.length - 1][1]; }
  var OCC = [[0, [205, 240, 255]], [0.5, [60, 140, 230]], [1, [10, 30, 140]]], CHG = [[0, [200, 30, 30]], [0.5, [240, 240, 240]], [1, [30, 150, 60]]], SEA = [[0, [235, 245, 210]], [0.5, [100, 190, 170]], [1, [20, 60, 140]]];
  function cv(r, v) { var c = document.createElement('canvas'); c.width = r.w; c.height = r.h; var g = c.getContext('2d'), im = g.createImageData(r.w, r.h), d = im.data;
    for (var i = 0; i < r.w * r.h; i++) { var o = 4 * i, col = null;
      if (v === 'tr') { if (TR[r.tr[i]]) col = hex(TR[r.tr[i]][2]); }
      else if (v === 'occ') { if (r.occ[i] > 0 && r.occ[i] <= 100) col = lerp(OCC, r.occ[i] / 100); }
      else if (v === 'chg') { if (r.ch[i] <= 200 && (r.occ[i] > 0 || r.ch[i] !== 100)) col = lerp(CHG, r.ch[i] / 200); }
      else { if (r.se[i] > 0 && r.se[i] <= 12) col = lerp(SEA, (r.se[i] - 1) / 11); }
      if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; } else if (r.okO[i]) { d[o] = d[o + 1] = d[o + 2] = 238; d[o + 3] = 255; } }
    g.putImageData(im, 0, 0); return c; }
  function render() {
    var r = R; $('#woEmpty').hidden = true; $('#woOut').hidden = false; var A = r.A, lost = A[3], newp = A[2];
    $('#woKpis').innerHTML = G.kpi('info', t('Ever water (1984–2020)', 'كانت ماءً يوماً (1984–2020)'), F(r.ever, 1) + '<small> km²</small>', t('mean occurrence ', 'متوسط التكرار ') + F(r.meanOcc, 0) + ' %') + G.kpi('info', t('Permanent water in 2020', 'المياه الدائمة في 2020'), F(r.perm, 1) + '<small> km²</small>', t('permanent, new permanent and seasonal-to-permanent', 'الدائمة والدائمة الجديدة والتي صارت دائمة')) + G.kpi(lost > newp ? 'bad' : 'ok', t('Permanent water lost', 'مياه دائمة مفقودة'), F(lost, 1) + '<small> km²</small>', t('new permanent ', 'دائمة جديدة ') + F(newp, 1) + ' km²') + G.kpi(r.loss > r.gain ? 'warn' : 'ok', t('Net change of water', 'صافي تغير المياه'), (r.gain - r.loss >= 0 ? '+' : '') + F(r.gain - r.loss, 1) + '<small> km²</small>', t('from 1984–1999 to 2000–2020', 'من 1984–1999 إلى 2000–2020'));
    var v = [G.verdict(lost > newp * 1.5 && lost > 0.5 ? 'bad' : newp > lost * 1.5 && newp > 0.5 ? 'ok' : 'info', t('The story of the water here', 'قصة المياه هنا'), t('Since 1984 ', 'منذ 1984 ') + km2(r.ever) + t(' of this area has been water at least once. ', ' من هذه المنطقة كانت ماءً مرة واحدة على الأقل. ') + km2(lost) + t(' of permanent water was lost, ', ' من المياه الدائمة فُقدت، ') + km2(A[8]) + t(' became seasonal, and ', ' وصارت موسمية ') + km2(newp) + t(' of new permanent water appeared (reservoirs, restored marshes). Weighted by how much water each pixel lost or gained, the water of 2000–2020 is ', ' من المياه الدائمة الجديدة ظهرت (خزانات، أهوار أُعيد إغمارها). وبحساب ما فقده كل بكسل أو كسبه من المياه، فإن مياه 2000–2020 ') + (r.gain - r.loss >= 0 ? t('larger by ', 'أكبر بـ') : t('smaller by ', 'أصغر بـ')) + km2(Math.abs(r.gain - r.loss)) + t(' than that of 1984–1999.', ' من مياه 1984–1999.'))];
    v.push(G.verdict('info', t('Check it against the time-lapse', 'قارنه مع الفيلم الزمني'), t('The atlas classifies every Landsat image since 1984 with expert rules and has been checked to less than 1 % false water and about 5 % missed water. If the area measured by Earth Through Time for a year differs strongly from these figures, look at that year’s frame: haze, cloud or a dry season is the usual cause.', 'يصنّف الأطلس كل صورة لاندسات منذ 1984 بقواعد خبيرة، وقد تُحقق منه بأقل من 1 % مياه زائفة ونحو 5 % مياه فائتة. فإذا اختلفت المساحة التي تقيسها أداة الأرض عبر الزمن لسنة ما كثيراً عن هذه الأرقام، فانظر إلى إطار تلك السنة: الضباب أو الغيوم أو موسم جاف هي السبب المعتاد.')));
    $('#woVerd').innerHTML = v.join(''); draw(); chart();
    if (map) { if (ovl) map.removeLayer(ovl); ovl = L.imageOverlay(cv(r, 'tr').toDataURL(), [[r.a.s, r.a.w], [r.a.n, r.a.e]], { opacity: 0.85 }).addTo(map); }
  }
  function draw() {
    var r = R, v = $('#woView').value, o = { a: r.a, layers: [cv(r, v)], smooth: false };
    if (v === 'tr') { o.title = nm() + ' — what happened to the water, 1984–2020'; o.sub = 'JRC Global Surface Water transitions between the first and the last year, Landsat 30 m'; o.legend = Object.keys(TR).filter(function (k) { return r.A[k] > 0.01; }).map(function (k) { return [TR[k][0], TR[k][2]]; }); o.stats = 'Permanent ' + km2(r.A[1]) + '  ·  Lost permanent ' + km2(r.A[3]) + '  ·  New permanent ' + km2(r.A[2]) + '  ·  Permanent to seasonal ' + km2(r.A[8]); }
    else if (v === 'occ') { o.title = nm() + ' — water occurrence, 1984–2020'; o.sub = 'Share of all valid Landsat observations in which the pixel was water'; o.ramp = { lo: 0, hi: 100, stops: OCC.map(function (s) { return [s[0] * 100, 'rgb(' + s[1].join(',') + ')']; }), ticks: [1, 25, 50, 75, 100], label: 'Water occurrence (%)' }; o.stats = 'Ever water ' + km2(r.ever) + '  ·  Water 75 % of the time or more ' + km2(r.occ75); }
    else if (v === 'chg') { o.title = nm() + ' — change in water occurrence'; o.sub = '1984–1999 compared with 2000–2020: red lost water, green gained water'; o.ramp = { lo: -100, hi: 100, stops: CHG.map(function (s) { return [s[0] * 200 - 100, 'rgb(' + s[1].join(',') + ')']; }), ticks: [-100, -50, 0, 50, 100], label: 'Change of occurrence (percentage points)' }; o.stats = 'Water lost ' + km2(r.loss) + '  ·  Water gained ' + km2(r.gain) + ' (occurrence-weighted)'; }
    else { o.title = nm() + ' — months with water in 2020'; o.sub = 'Number of months of 2020 in which the pixel was water'; o.ramp = { lo: 1, hi: 12, stops: SEA.map(function (s) { return [1 + s[0] * 11, 'rgb(' + s[1].join(',') + ')']; }), ticks: [1, 3, 6, 9, 12], label: 'Months with water (2020)' }; }
    o.legend = (o.legend || []).concat([['Never water', '#EEEEEE']]);
    P.sheet($('#woCv'), o);
    $('#woCap').textContent = v === 'tr' ? t('Blue is water that stayed permanent, red permanent water that disappeared, yellow permanent water that became seasonal, green new permanent water, light blue seasonal water. Grey shades are short-lived water.', 'الأزرق مياه بقيت دائمة، والأحمر مياه دائمة اختفت، والأصفر مياه دائمة صارت موسمية، والأخضر مياه دائمة جديدة، والأزرق الفاتح مياه موسمية. ودرجات الرمادي مياه قصيرة العمر.') : v === 'occ' ? t('The darker the blue, the more often the pixel was water in 37 years: dark cores are permanent lakes and rivers, pale fringes are floodplains and shrinking shores.', 'كلما كان الأزرق أدكن كان البكسل ماءً أكثر في 37 سنة: النوى الداكنة بحيرات وأنهار دائمة، والأطراف الشاحبة سهول فيضية وسواحل منكمشة.') : v === 'chg' ? t('How much more or less often each pixel was water in 2000–2020 than in 1984–1999.', 'كم زادت أو قلّت مرات كون كل بكسل ماءً في 2000–2020 مقارنة بـ1984–1999.') : t('Seasonal water is wet a few months, permanent water all twelve.', 'المياه الموسمية رطبة بضعة أشهر، والدائمة الاثني عشر كلها.');
  }
  $('#woView').addEventListener('change', function () { persist.save(); if (R) draw(); });
  function chart() {
    var r = R, ks = Object.keys(TR).filter(function (k) { return r.A[k] > 0; }), mx = Math.max.apply(null, ks.map(function (k) { return r.A[k]; }).concat([0.001])), W = 760, rowH = 30, H = 70 + ks.length * rowH + 30, x0 = 210, pw = W - x0 - 90, s = '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    s += G.tx(20, 26, 'Area of each water transition class, 1984–2020 (km²)', { fs: 13, fw: 800 });
    ks.forEach(function (k, i) { var y = 48 + i * rowH, w = r.A[k] / mx * pw; s += G.tx(x0 - 10, y + 15, TR[k][0], { fs: 12, anchor: 'end' }) + '<rect x="' + x0 + '" y="' + (y + 3) + '" width="' + Math.max(1, w) + '" height="18" rx="3" fill="' + TR[k][2] + '" stroke="#1B232B" stroke-width=".5"/>' + G.tx(x0 + w + 8, y + 16, F(r.A[k], r.A[k] < 10 ? 2 : 1), { fs: 12, fw: 700 }); });
    s += '<line x1="' + x0 + '" x2="' + x0 + '" y1="44" y2="' + (48 + ks.length * rowH) + '" stroke="#1B232B"/>' + G.tx(20, H - 12, nm() + ' · JRC Global Surface Water, Landsat 1984–2020', { fs: 10.5, fill: G.MUT });
    var el = $('#woChart'); el.setAttribute('viewBox', '0 0 ' + W + ' ' + H); el.innerHTML = s;
    $('#woChartCap').textContent = t('Each bar is the area that followed one path between the first and the last years of the record.', 'كل شريط مساحة سلكت مساراً واحداً بين السنوات الأولى والأخيرة من السجل.');
  }
  $$('[data-cv]').forEach(function (b) { b.addEventListener('click', function () { if (!R) return; SH.exportCanvas($('#' + b.getAttribute('data-cv')), 'shandal-water-' + $('#woView').value + '-' + (R.a.key || 'area'), b.getAttribute('data-fmt')); }); });
  $('#woCsv').addEventListener('click', function () { if (!R) return; var r = R; SH.csv('shandal-water-' + (r.a.key || 'area') + '.csv', [['place', nm()], ['bbox_w_s_e_n', [r.a.w, r.a.s, r.a.e, r.a.n].join(' ')], ['ever_water_km2', r.ever.toFixed(3)], ['mean_occurrence_pct', r.meanOcc.toFixed(1)], ['occurrence_75pct_or_more_km2', r.occ75.toFixed(3)], ['permanent_2020_km2', r.perm.toFixed(3)], ['gain_weighted_km2', r.gain.toFixed(3)], ['loss_weighted_km2', r.loss.toFixed(3)], [], ['transition', 'km2']].concat(Object.keys(TR).map(function (k) { return [TR[k][0], r.A[k].toFixed(3)]; }))); });
  $('#woTl').addEventListener('click', function () { var a = aoiP.cur; if (!a) return; try { localStorage.setItem('shandal_tl_aoi', JSON.stringify({ w: a.w, s: a.s, e: a.e, n: a.n, en: a.en, ar: a.ar, key: a.key, km2: a.km2 })); } catch (e) {} location.href = SH.base + (AR ? 'ar/' : '') + 'tools/iraq-timelapse/app/'; });
  $('#woName').addEventListener('input', function () { persist.save(); if (R) draw(); });
})();
