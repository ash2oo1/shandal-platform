/* Land cover change and urban growth — annual 10 m global land-use/land-cover maps (Sentinel-2, deep-learning
   classification, 2017–2023): area of every class each year with the true ground area of each pixel, the full
   from-to transition matrix between two years, the main changes mapped (farmland to buildings, other land to
   buildings, farmland lost, new farmland, water lost and gained), and an optional stability test that counts a
   change only when the new class holds in the following year. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, G = window.EG, P = window.PCX, AR = SH.lang === 'ar';
  var COL = 'io-lulc-annual-v02', MS = 900, Y0 = 2017, Y1 = 2023;
  var CL = { 1: ['Water', 'المياه', '#419BDF'], 2: ['Trees', 'الأشجار', '#397D49'], 4: ['Flooded vegetation', 'نبات مغمور', '#7A87C6'], 5: ['Crops', 'المحاصيل', '#E49635'], 7: ['Built area', 'المباني', '#C4281B'], 8: ['Bare ground', 'أرض جرداء', '#A59B8F'], 9: ['Snow and ice', 'ثلج وجليد', '#A8EBFF'], 10: ['Clouds', 'غيوم', '#616161'], 11: ['Rangeland', 'مراعٍ', '#E3E2C3'] }, KEYS = [1, 2, 4, 5, 7, 8, 9, 11];
  var CH = [['cb', 'Farmland to buildings', 'زراعية إلى مبانٍ', '#C4281B'], ['ob', 'Other land to buildings', 'أرض أخرى إلى مبانٍ', '#FF8A3D'], ['cl', 'Farmland lost (to bare or rangeland)', 'أرض زراعية فُقدت (إلى جرداء أو مراعٍ)', '#8B5A2B'], ['nc', 'New farmland', 'أرض زراعية جديدة', '#2E9B57'], ['wl', 'Water lost', 'مياه فُقدت', '#FFD000'], ['wg', 'New water', 'مياه جديدة', '#1E90FF'], ['tl', 'Trees lost', 'أشجار فُقدت', '#6B2F8F']];
  var IDS = ['lcA', 'lcB', 'lcStable', 'lcName', 'lcView'], persist = SH.persist('landcover', IDS);
  var PRE = [['baghdad', 'Baghdad', 'بغداد', [44.15, 33.15, 44.65, 33.55]], ['erbil', 'Erbil', 'أربيل', [43.85, 36.05, 44.2, 36.35]], ['basra', 'Basra', 'البصرة', [47.65, 30.35, 47.95, 30.65]], ['najaf', 'Najaf and Kufa', 'النجف والكوفة', [44.2, 31.9, 44.5, 32.15]], ['sulay', 'Sulaymaniyah', 'السليمانية', [45.3, 35.48, 45.55, 35.65]], ['mosul', 'Mosul', 'الموصل', [43.0, 36.25, 43.3, 36.45]], ['karbala', 'Karbala', 'كربلاء', [43.9, 32.5, 44.15, 32.7]],
    ['cairo', 'Cairo and the New Capital', 'القاهرة والعاصمة الإدارية', [31.2, 29.9, 31.9, 30.2]], ['riyadh', 'Riyadh', 'الرياض', [46.45, 24.5, 47.0, 24.95]], ['dubai', 'Dubai', 'دبي', [55.05, 24.9, 55.5, 25.3]], ['istanbul', 'Istanbul', 'إسطنبول', [28.6, 40.9, 29.3, 41.25]], ['amman', 'Amman', 'عمّان', [35.75, 31.85, 36.1, 32.1]]];
  var map = SH.map('lcMap', { zoom: 6, base: 'satellite', center: [33, 44] }), L = window.L, ovl = null, R = null, busy = false, YEARS = {};
  var aoiP = P.aoiPicker({ key: 'landcover', prefix: 'lc', map: map, presets: PRE, maxKm: 100, minKm: 1, groups: [['Iraq', 'العراق', ['baghdad', 'erbil', 'basra', 'najaf', 'sulay', 'mosul', 'karbala']], ['The world', 'العالم', ['cairo', 'riyadh', 'dubai', 'istanbul', 'amman']]], onChange: function () { YEARS = {}; } });
  function msg(p, s) { $('#lcBar').style.width = Math.round(p * 100) + '%'; $('#lcMsg').textContent = s; }
  function nm() { return aoiP.name(); }
  function km2(v) { return F(v, v < 10 ? 2 : v < 100 ? 1 : 0) + ' km²'; }

  /* one year: class values for every pixel of the area (mosaic of map tiles) */
  function year(a, y) {
    if (YEARS[y]) return Promise.resolve(YEARS[y]);
    return P.search(COL, a, [y + '-01-01T00:00:00Z', y + '-12-31T23:59:59Z'], null, 50).then(function (its) {
      if (!its.length) return null; var use = P.pick(its, a, 6); return P.mosaic(a, COL, use.map(function (f) { return { id: f.id }; }), '&assets=data&nodata=0&resampling=nearest', MS);
    }).then(function (img) { if (!img) return null; var n = img.width * img.height, c = new Uint8Array(n); for (var i = 0; i < n; i++) c[i] = img.data[4 * i + 3] > 127 ? img.data[4 * i] : 0; YEARS[y] = { y: y, c: c, w: img.width, h: img.height }; return YEARS[y]; });
  }
  function run() {
    if (busy) return; var a = aoiP.cur; if (!a) return SH.toast(t('Choose a place first.', 'اختر مكاناً أولاً.'), 'warn');
    var ya = +$('#lcA').value, yb = +$('#lcB').value; if (yb <= ya) return SH.toast(t('The last year must come after the first.', 'يجب أن تكون السنة الأخيرة بعد الأولى.'), 'warn');
    persist.save(); busy = true; $('#lcRun').disabled = true; var ys = []; for (var y = Y0; y <= Y1; y++) ys.push(y); var done = 0;
    msg(0.03, t('Reading the land-cover maps…', 'قراءة خرائط الغطاء الأرضي…'));
    var q = ys.slice(), work = function () { if (!q.length) return Promise.resolve(); var yy = q.shift(); return year(a, yy).catch(function () { return null; }).then(function () { done++; msg(done / ys.length * 0.9, t('Land-cover maps: ', 'خرائط الغطاء الأرضي: ') + done + ' / ' + ys.length); return work(); }); };
    Promise.all([work(), work(), work()]).then(function () {
      if (!YEARS[ya] || !YEARS[yb]) throw new Error(t('The land-cover map is missing for one of the two years here.', 'خريطة الغطاء الأرضي مفقودة لإحدى السنتين هنا.'));
      R = analyse(a, ya, yb); render(); msg(1, t('Ready.', 'جاهز.'));
    }).catch(function (e) { msg(0, ''); SH.toast(e.message || String(e), 'bad'); }).then(function () { busy = false; $('#lcRun').disabled = false; });
  }
  $('#lcRun').addEventListener('click', run);

  function analyse(a, ya, yb) {
    var A = YEARS[ya], B = YEARS[yb], B2 = $('#lcStable').checked && YEARS[yb + 1] ? YEARS[yb + 1] : null, w0 = A.w, h0 = A.h, n = w0 * h0, rows = P.rowArea(a, w0, h0), M = {}, ch = new Uint8Array(n), S = {}, i, k;
    CH.forEach(function (q) { S[q[0]] = 0; }); KEYS.forEach(function (x) { M[x] = {}; KEYS.forEach(function (y) { M[x][y] = 0; }); });
    var per = {}; Object.keys(YEARS).forEach(function (y) { var Y = YEARS[y], ar = {}; KEYS.forEach(function (x) { ar[x] = 0; }); if (Y.w !== w0) return; for (i = 0; i < n; i++) { var c = Y.c[i]; if (ar[c] != null) ar[c] += rows[Math.floor(i / w0)]; } per[y] = ar; });
    var valid = 0;
    for (i = 0; i < n; i++) {
      var ca = A.c[i], cb = B.c[i]; if (!ca || !cb || ca === 10 || cb === 10) continue; var ar0 = rows[Math.floor(i / w0)]; valid += ar0;
      if (ca !== cb && B2 && B2.w === w0 && B2.c[i] !== cb) cb = ca; /* not stable: count as unchanged */
      if (M[ca] && M[ca][cb] != null) M[ca][cb] += ar0;
      if (ca === cb) continue;
      k = cb === 7 && ca === 5 ? 'cb' : cb === 7 ? 'ob' : ca === 5 && (cb === 8 || cb === 11) ? 'cl' : cb === 5 && ca !== 5 ? 'nc' : ca === 1 ? 'wl' : cb === 1 ? 'wg' : ca === 2 ? 'tl' : null;
      if (k) { S[k] += ar0; ch[i] = CH.map(function (q) { return q[0]; }).indexOf(k) + 1; }
    }
    return { a: a, ya: ya, yb: yb, w: w0, h: h0, A: A, B: B, M: M, S: S, ch: ch, per: per, valid: valid, stable: !!B2 };
  }

  /* ------------------------------------------------------------------ drawing */
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function classCv(Y) { var c = document.createElement('canvas'); c.width = Y.w; c.height = Y.h; var g = c.getContext('2d'), im = g.createImageData(Y.w, Y.h); for (var i = 0; i < Y.c.length; i++) { var q = CL[Y.c[i]]; if (!q) continue; var rgb = hex(q[2]), o = 4 * i; im.data[o] = rgb[0]; im.data[o + 1] = rgb[1]; im.data[o + 2] = rgb[2]; im.data[o + 3] = 255; } g.putImageData(im, 0, 0); return c; }
  function chgCv(r) { var c = document.createElement('canvas'); c.width = r.w; c.height = r.h; var g = c.getContext('2d'), im = g.createImageData(r.w, r.h), cols = CH.map(function (q) { return hex(q[3]); });
    for (var i = 0; i < r.ch.length; i++) { var o = 4 * i, k = r.ch[i]; if (k) { var rgb = cols[k - 1]; im.data[o] = rgb[0]; im.data[o + 1] = rgb[1]; im.data[o + 2] = rgb[2]; im.data[o + 3] = 255; continue; } var q = CL[r.B.c[i]]; if (!q) continue; var b = hex(q[2]), gr = Math.round(0.3 * b[0] + 0.59 * b[1] + 0.11 * b[2]); im.data[o] = im.data[o + 1] = im.data[o + 2] = Math.round(gr * 0.35 + 255 * 0.65); im.data[o + 3] = 255; }
    g.putImageData(im, 0, 0); return c; }
  function render() {
    var r = R; if (!r) return; $('#lcEmpty').hidden = true; $('#lcOut').hidden = false; var S = r.S, pa = r.per[r.ya] || {}, pb = r.per[r.yb] || {}, dB = (pb[7] || 0) - (pa[7] || 0), dC = (pb[5] || 0) - (pa[5] || 0);
    $('#lcKpis').innerHTML = G.kpi(dB > 0 ? 'warn' : 'info', t('Built area ', 'المباني ') + r.ya + ' → ' + r.yb, F(pa[7] || 0, 1) + ' → ' + F(pb[7] || 0, 1) + '<small> km²</small>', (dB >= 0 ? '+' : '') + F(dB, 1) + ' km²' + (pa[7] ? ' (' + (dB >= 0 ? '+' : '') + F(100 * dB / pa[7], 0) + ' %)' : '')) +
      G.kpi(S.cb > 0.1 ? 'bad' : 'ok', t('Farmland built over', 'أرض زراعية بُني عليها'), F(S.cb, S.cb < 10 ? 2 : 1) + '<small> km²</small>', F(S.cb * 100, 0) + t(' hectares', ' هكتار')) +
      G.kpi(dC < 0 ? 'warn' : 'ok', t('Crops ', 'المحاصيل ') + r.ya + ' → ' + r.yb, F(pa[5] || 0, 1) + ' → ' + F(pb[5] || 0, 1) + '<small> km²</small>', (dC >= 0 ? '+' : '') + F(dC, 1) + ' km²') +
      G.kpi('info', t('Water ', 'المياه ') + r.ya + ' → ' + r.yb, F(pa[1] || 0, 1) + ' → ' + F(pb[1] || 0, 1) + '<small> km²</small>', t('lost ', 'فُقد ') + F(S.wl, 1) + t(' · new ', ' · جديد ') + F(S.wg, 1));
    var share = S.cb + S.ob > 0 ? 100 * S.cb / (S.cb + S.ob) : 0, v = [];
    v.push(G.verdict(dB > 0.02 * (pa[7] || 1) ? 'warn' : 'info', t('How the built area grew', 'كيف نمت المباني'), t('Between ', 'بين ') + r.ya + t(' and ', ' و') + r.yb + t(' buildings spread over ', ' امتدت المباني على ') + km2(S.cb + S.ob) + t(' of new land, ', ' من أرض جديدة، ') + F(share, 0) + t(' % of it farmland (', ' % منها أرض زراعية (') + km2(S.cb) + t(') and the rest rangeland, bare ground or trees.', ')، والباقي مراعٍ أو أرض جرداء أو أشجار.')));
    if (S.cl > 0.05) v.push(G.verdict('warn', t('Farmland that went out of use', 'أرض زراعية خرجت من الاستعمال'), km2(S.cl) + t(' of crops became bare ground or rangeland. In Iraq this follows drought, salinity, water shortage and abandonment; check single years, since a field left fallow for a season shows the same way.', ' من المحاصيل صارت أرضاً جرداء أو مراعي. وفي العراق يتبع هذا الجفاف والملوحة وشح المياه وترك الأرض؛ فافحص السنوات المفردة، لأن الحقل المتروك موسماً يظهر بالطريقة نفسها.')));
    v.push(G.verdict('info', t('About the maps', 'عن الخرائط'), t('Each year is classified separately by a deep-learning model from Sentinel-2 images, about 85 % correct overall. Crops, rangeland and bare ground are often confused in dry regions; ', 'كل سنة مصنفة منفصلة بنموذج تعلم عميق من صور سنتينل-2، بدقة كلية نحو 85 %. وكثيراً ما تختلط المحاصيل والمراعي والأرض الجرداء في المناطق الجافة؛ ') + (r.stable ? t('the stability test is on, so only changes confirmed in ', 'اختبار الثبات مفعّل، فلا تُحسب إلا التغيرات المؤكدة في ') + (r.yb + 1) + t(' are counted.', '.') : t('the stability test could not be used (no later year), so read small changes with care.', 'تعذر استعمال اختبار الثبات (لا سنة لاحقة)، فاقرأ التغيرات الصغيرة بحذر.'))));
    $('#lcVerd').innerHTML = v.join('');
    draw(); chart(); matrix();
    if (map) { if (ovl) map.removeLayer(ovl); ovl = L.imageOverlay(chgCv(r).toDataURL(), [[r.a.s, r.a.w], [r.a.n, r.a.e]], { opacity: 0.8 }).addTo(map); }
  }
  function draw() {
    var r = R, v = $('#lcView').value, cv = $('#lcCv'), lay, leg, sub;
    if (v === 'chg') { lay = chgCv(r); leg = CH.filter(function (q) { return r.S[q[0]] > 0; }).map(function (q) { return [q[1], q[3]]; }).concat([['Unchanged (light)', '#D9D9D9']]); sub = 'Main changes ' + r.ya + ' → ' + r.yb + (r.stable ? ', confirmed in ' + (r.yb + 1) : '') + ' · annual 10 m land-cover maps'; }
    else { var Y = v === 'a' ? r.A : r.B; lay = classCv(Y); var pr = r.per[Y.y] || {}; leg = KEYS.filter(function (k) { return pr[k] > 0.001 * r.valid; }).map(function (k) { return [CL[k][0], CL[k][2]]; }); sub = 'Land cover ' + Y.y + ' · annual 10 m land-cover map'; }
    P.sheet(cv, { a: r.a, title: nm() + (v === 'chg' ? ' — land-cover change ' + r.ya + '–' + r.yb : ' — land cover ' + (v === 'a' ? r.ya : r.yb)), sub: sub, layers: [lay], smooth: false, legend: leg,
      stats: v === 'chg' ? 'Farmland to buildings ' + km2(r.S.cb) + '  ·  Other land to buildings ' + km2(r.S.ob) + '  ·  Farmland lost ' + km2(r.S.cl) + '  ·  New farmland ' + km2(r.S.nc) : 'Built ' + km2((r.per[v === 'a' ? r.ya : r.yb] || {})[7] || 0) + '  ·  Crops ' + km2((r.per[v === 'a' ? r.ya : r.yb] || {})[5] || 0) + '  ·  Trees ' + km2((r.per[v === 'a' ? r.ya : r.yb] || {})[2] || 0) });
    $('#lcCap').textContent = v === 'chg' ? t('Coloured pixels changed between the two years: red is farmland that became buildings, orange is other land that became buildings, brown is farmland lost to bare ground or rangeland, green is new farmland, yellow and blue are water lost and gained, purple is trees lost. Light grey is unchanged.', 'البكسلات الملونة تغيرت بين السنتين: الأحمر أرض زراعية صارت مباني، والبرتقالي أرض أخرى صارت مباني، والبني أرض زراعية فُقدت إلى أرض جرداء أو مراعٍ، والأخضر أرض زراعية جديدة، والأصفر والأزرق مياه فُقدت ومياه جديدة، والبنفسجي أشجار فُقدت. والرمادي الفاتح لم يتغير.') : t('Each colour is a land-cover class of that year.', 'كل لون صنف من أصناف الغطاء الأرضي في تلك السنة.');
  }
  $('#lcView').addEventListener('change', function () { persist.save(); if (R) draw(); });
  function chart() {
    var r = R, ys = Object.keys(r.per).map(Number).sort(), keys = KEYS.filter(function (k) { return ys.some(function (y) { return r.per[y][k] > 0.01 * r.valid; }); }), mx = 0;
    keys.forEach(function (k) { ys.forEach(function (y) { mx = Math.max(mx, r.per[y][k]); }); });
    G.chart($('#lcChart'), { W: 760, H: 420, m: { l: 70, r: 20, t: 18, b: 56 }, x: { lo: Y0, hi: Y1, n: 7, plain: true, title: 'Year' }, y: { lo: 0, hi: mx * 1.1 || 1, title: 'Area (km²)' },
      top: function (fx, fy) { return '<rect x="' + fx(r.ya) + '" y="' + fy(mx * 1.1) + '" width="' + (fx(r.yb) - fx(r.ya)) + '" height="' + (fy(0) - fy(mx * 1.1)) + '" fill="#B08A3E" fill-opacity=".07"/>'; },
      series: keys.map(function (k) { return { pts: ys.map(function (y) { return [y, r.per[y][k]]; }), col: CL[k][2] === '#E3E2C3' ? '#BDB76B' : CL[k][2], w: k === 7 || k === 5 ? 3 : 2, mark: 'o', r: 3 }; }), legend: keys.map(function (k) { return { name: CL[k][0], col: CL[k][2] === '#E3E2C3' ? '#BDB76B' : CL[k][2], mark: 'o' }; }) });
    $('#lcChartCap').textContent = t('Area of every land-cover class in each year from 2017 to 2023; the shaded band is the period compared. A steady rise of the built area with a fall of crops is urban growth over farmland.', 'مساحة كل صنف من أصناف الغطاء الأرضي في كل سنة من 2017 إلى 2023؛ والشريط المظلل هو الفترة المقارنة. والارتفاع المطرد للمباني مع انخفاض المحاصيل هو نمو حضري على حساب الأرض الزراعية.');
  }
  function matrix() {
    var r = R, ks = KEYS.filter(function (k) { return KEYS.some(function (j) { return r.M[k][j] > 0.001 || r.M[j][k] > 0.001; }); }), mx = 0; ks.forEach(function (a) { ks.forEach(function (b) { if (a !== b) mx = Math.max(mx, r.M[a][b]); }); });
    $('#lcMx').innerHTML = '<thead><tr><th class="r">' + t('From ', 'من ') + r.ya + ' ↓ / ' + t('to ', 'إلى ') + r.yb + ' →</th>' + ks.map(function (k) { return '<th>' + (AR ? CL[k][1] : CL[k][0]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ks.map(function (a) { return '<tr><th class="r">' + (AR ? CL[a][1] : CL[a][0]) + '</th>' + ks.map(function (b) { var v = r.M[a][b], al = a === b ? 0 : Math.min(0.85, v / (mx || 1)); return '<td style="' + (a === b ? 'color:var(--text-3)' : 'background:rgba(196,40,27,' + al.toFixed(2) + ')' + (al > 0.5 ? ';color:#fff;font-weight:700' : '')) + '">' + (v >= 0.005 ? F(v, v < 10 ? 2 : 1) : '·') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }
  $$('[data-cv]').forEach(function (b) { b.addEventListener('click', function () { if (!R) return; SH.exportCanvas($('#' + b.getAttribute('data-cv')), 'shandal-landcover-' + (R.a.key || 'area') + '-' + R.ya + '-' + R.yb, b.getAttribute('data-fmt')); }); });
  $('#lcCsv').addEventListener('click', function () {
    if (!R) return; var r = R, ys = Object.keys(r.per).map(Number).sort(), rows = [['place', nm()], ['bbox_w_s_e_n', [r.a.w, r.a.s, r.a.e, r.a.n].join(' ')], [], ['year'].concat(KEYS.map(function (k) { return CL[k][0] + ' km2'; }))];
    ys.forEach(function (y) { rows.push([y].concat(KEYS.map(function (k) { return r.per[y][k].toFixed(3); }))); });
    rows.push([], ['from ' + r.ya + ' \\ to ' + r.yb].concat(KEYS.map(function (k) { return CL[k][0]; }))); KEYS.forEach(function (a) { rows.push([CL[a][0]].concat(KEYS.map(function (b) { return r.M[a][b].toFixed(3); }))); });
    rows.push([], ['change', 'km2']); CH.forEach(function (q) { rows.push([q[1], r.S[q[0]].toFixed(3)]); });
    SH.csv('shandal-landcover-' + (r.a.key || 'area') + '-' + r.ya + '-' + r.yb + '.csv', rows);
  });
  $('#lcName').addEventListener('input', function () { persist.save(); if (R) draw(); });
  $('#lcStable').addEventListener('change', function () { persist.save(); if (R && YEARS[R.ya]) { R = analyse(R.a, R.ya, R.yb); render(); } });
})();
