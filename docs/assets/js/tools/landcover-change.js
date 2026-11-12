/* Land cover change and urban growth — annual 10 m global land-use/land-cover maps (Sentinel-2, deep-learning
   classification, 2017–2023): area of every class each year with the true ground area of each pixel, the full
   from-to transition matrix between two years, the main changes mapped (farmland to buildings, other land to
   buildings, farmland lost, new farmland, water lost and gained), and an optional stability test that counts a
   change only when the new class holds in the following year.
   Landsat mode (1985 to last year, 30 m): spring and summer cloud-free composites of red, near- and shortwave-infrared
   surface reflectance are built for each year; a Gaussian naive-Bayes classifier is trained on the 2017 map of the
   same area against the 2017 Landsat composites, its agreement is measured against the 2023 map, and it then
   classifies every requested year, so the whole series comes from one consistent classifier. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, G = window.EG, P = window.PCX, AR = SH.lang === 'ar';
  var COL = 'io-lulc-annual-v02', MS = 900, Y0 = 2017, Y1 = 2023;
  var CL = { 1: ['Water', 'المياه', '#419BDF'], 2: ['Trees', 'الأشجار', '#397D49'], 4: ['Flooded vegetation', 'نبات مغمور', '#7A87C6'], 5: ['Crops', 'المحاصيل', '#E49635'], 7: ['Built area', 'المباني', '#C4281B'], 8: ['Bare ground', 'أرض جرداء', '#A59B8F'], 9: ['Snow and ice', 'ثلج وجليد', '#A8EBFF'], 10: ['Clouds', 'غيوم', '#616161'], 11: ['Rangeland', 'مراعٍ', '#E3E2C3'] }, KEYS = [1, 2, 4, 5, 7, 8, 9, 11];
  var CH = [['cb', 'Farmland to buildings', 'زراعية إلى مبانٍ', '#C4281B'], ['ob', 'Other land to buildings', 'أرض أخرى إلى مبانٍ', '#FF8A3D'], ['cl', 'Farmland lost (to bare or rangeland)', 'أرض زراعية فُقدت (إلى جرداء أو مراعٍ)', '#8B5A2B'], ['nc', 'New farmland', 'أرض زراعية جديدة', '#2E9B57'], ['wl', 'Water lost', 'مياه فُقدت', '#FFD000'], ['wg', 'New water', 'مياه جديدة', '#1E90FF'], ['tl', 'Trees lost', 'أشجار فُقدت', '#6B2F8F']];
  var IDS = ['lcSrc', 'lcA', 'lcB', 'lcStable', 'lcName', 'lcView'], persist = SH.persist('landcover', IDS);
  var PRE = [['baghdad', 'Baghdad', 'بغداد', [44.15, 33.15, 44.65, 33.55]], ['erbil', 'Erbil', 'أربيل', [43.85, 36.05, 44.2, 36.35]], ['basra', 'Basra', 'البصرة', [47.65, 30.35, 47.95, 30.65]], ['najaf', 'Najaf and Kufa', 'النجف والكوفة', [44.2, 31.9, 44.5, 32.15]], ['sulay', 'Sulaymaniyah', 'السليمانية', [45.3, 35.48, 45.55, 35.65]], ['mosul', 'Mosul', 'الموصل', [43.0, 36.25, 43.3, 36.45]], ['karbala', 'Karbala', 'كربلاء', [43.9, 32.5, 44.15, 32.7]],
    ['cairo', 'Cairo and the New Capital', 'القاهرة والعاصمة الإدارية', [31.2, 29.9, 31.9, 30.2]], ['riyadh', 'Riyadh', 'الرياض', [46.45, 24.5, 47.0, 24.95]], ['dubai', 'Dubai', 'دبي', [55.05, 24.9, 55.5, 25.3]], ['istanbul', 'Istanbul', 'إسطنبول', [28.6, 40.9, 29.3, 41.25]], ['amman', 'Amman', 'عمّان', [35.75, 31.85, 36.1, 32.1]]];
  var map = SH.map('lcMap', { zoom: 6, base: 'satellite', center: [33, 44] }), L = window.L, ovl = null, R = null, busy = false, YEARS = {}, LYEARS = {}, LFEAT = {}, LACC = null;
  var now0 = new Date(), LY1 = now0.getFullYear() - (now0.getMonth() >= 8 ? 0 : 1), LY0 = 1985, LS = 'landsat-c2-l2';
  var aoiP = P.aoiPicker({ key: 'landcover', prefix: 'lc', map: map, presets: PRE, maxKm: 100, minKm: 1, groups: [['Iraq', 'العراق', ['baghdad', 'erbil', 'basra', 'najaf', 'sulay', 'mosul', 'karbala']], ['The world', 'العالم', ['cairo', 'riyadh', 'dubai', 'istanbul', 'amman']]], onChange: function () { YEARS = {}; LYEARS = {}; LFEAT = {}; LACC = null; } });
  function src() { return $('#lcSrc').value === 'ls' ? 'ls' : 's2'; }
  function fillYears() {
    var ls = src() === 'ls', a0 = ls ? LY0 : Y0, b1 = ls ? LY1 : Y1, va = +$('#lcA').value, vb = +$('#lcB').value, o = function (lo, hi, sel) { var h = ''; for (var y = lo; y <= hi; y++) h += '<option value="' + y + '"' + (y === sel ? ' selected' : '') + '>' + y + '</option>'; return h; };
    if (!(va >= a0 && va < b1)) va = ls ? 2000 : Y0; if (!(vb > a0 && vb <= b1)) vb = b1;
    $('#lcA').innerHTML = o(a0, b1 - 1, va); $('#lcB').innerHTML = o(a0 + 1, b1, vb);
    $('#lcStable').disabled = ls; $('#lcYrNote').hidden = !ls; $('#lcS2Note').hidden = ls;
  }
  $('#lcSrc').addEventListener('change', function () { fillYears(); persist.save(); });
  fillYears();
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
  /* ---------------------------------------------------------- Landsat: spring and summer composites */
  var CLD = '((qa_pixel % 32) >= 8)', bandX = function (b) { return 'where(' + CLD + ',0,where(' + b + '<7400,7400,' + b + '))'; };
  var QLS = P.expr([bandX('red'), bandX('nir08'), bandX('swir16')].join(';'), 7273, 25455);   /* bytes 0..255 = SR 0..0.5; 0 = cloud, shadow or fill */
  function lsScenes(a, y0, y1, md0, md1) {
    return P.search(LS, a, [y0 + '-' + md0 + 'T00:00:00Z', y1 + '-' + md1 + 'T23:59:59Z'], { 'eo:cloud_cover': { lt: 40 } }, 100).then(function (its) {
      var good = its.filter(function (f) { return !(f.properties.platform === 'landsat-7' && f.properties.datetime >= '2003-05-31'); });
      return good.concat(its.filter(function (f) { return good.indexOf(f) < 0; })).sort(function (p1, p2) { var a1 = good.indexOf(p1) < 0, a2 = good.indexOf(p2) < 0; if (a1 !== a2) return a1 ? 1 : -1; return (p1.properties['eo:cloud_cover'] || 0) - (p2.properties['eo:cloud_cover'] || 0); });
    });
  }
  function season(a, y, md0, md1, W, H) {
    var n = W * H, out = new Uint8Array(3 * n), ok = new Uint8Array(n), got = 0;
    var add = function (items) { return items.reduce(function (pr, it) { return pr.then(function () { if (got > 0.995 * n) return; return P.img(P.bboxUrl(a, LS, it.id, QLS, MS)).then(function (bm) { var d = P.pix(bm, W, H).data; for (var i = 0; i < n; i++) { if (ok[i]) continue; var o = 4 * i; if (d[o + 3] <= 127 || !d[o] || !d[o + 1] || !d[o + 2]) continue; out[3 * i] = d[o]; out[3 * i + 1] = d[o + 1]; out[3 * i + 2] = d[o + 2]; ok[i] = 1; got++; } }).catch(function () {}); }); }, Promise.resolve()); };
    return lsScenes(a, y, y, md0, md1).then(function (its) { return add(P.pick(its, a, 4).concat(its).filter(function (x, i, A) { return A.indexOf(x) === i; }).slice(0, 6)); })
      .then(function () { if (got > 0.85 * n) return; return lsScenes(a, y - 1, y + 1, md0, md1).then(function (its) { return add(its.slice(0, 6)); }); })
      .then(function () { return { v: out, ok: ok, frac: got / n }; });
  }
  function lsFeat(a, y, W, H) {
    if (LFEAT[y]) return Promise.resolve(LFEAT[y]);
    return season(a, y, '02-15', '04-30', W, H).then(function (sp) { return season(a, y, '07-01', '08-31', W, H).then(function (su) {
      var n = W * H, NF = 7, f = new Float32Array(n * NF), ok = new Uint8Array(n), sr = function (v) { return v / 255 * 0.5 + 0.001; };
      for (var i = 0; i < n; i++) { if (!su.ok[i]) continue; ok[i] = 1; var r = sr(su.v[3 * i]), nn = sr(su.v[3 * i + 1]), s1 = sr(su.v[3 * i + 2]), rs = sp.ok[i] ? sr(sp.v[3 * i]) : r, ns = sp.ok[i] ? sr(sp.v[3 * i + 1]) : nn, ss = sp.ok[i] ? sr(sp.v[3 * i + 2]) : s1, o = i * NF;
        f[o] = (ns - rs) / (ns + rs); f[o + 1] = (nn - r) / (nn + r); f[o + 2] = r; f[o + 3] = nn; f[o + 4] = s1; f[o + 5] = (s1 - nn) / (s1 + nn); f[o + 6] = ss; }
      LFEAT[y] = { f: f, ok: ok, NF: NF, frac: su.frac, spf: sp.frac }; return LFEAT[y];
    }); });
  }
  /* Gaussian naive Bayes trained on the 2017 map */
  function train(lab, F0) {
    var NF = F0.NF, st = {}, n = lab.length;
    for (var i = 0; i < n; i++) { var k = lab[i]; if (!F0.ok[i] || !CL[k] || k === 10) continue; var S = st[k] || (st[k] = { n: 0, s: new Float64Array(NF), q: new Float64Array(NF) }); S.n++; for (var j = 0; j < NF; j++) { var v = F0.f[i * NF + j]; S.s[j] += v; S.q[j] += v * v; } }
    var tot = 0, M = []; Object.keys(st).forEach(function (k) { tot += st[k].n; });
    Object.keys(st).forEach(function (k) { var S = st[k]; if (S.n < 60) return; var mu = [], vr = [], lv = 0; for (var j = 0; j < NF; j++) { mu[j] = S.s[j] / S.n; vr[j] = Math.max(1e-5, S.q[j] / S.n - mu[j] * mu[j]); lv += Math.log(vr[j]); } M.push({ k: +k, mu: mu, iv: vr.map(function (v) { return 0.5 / v; }), c: 0.5 * Math.log(S.n / tot) - 0.5 * lv }); });
    return M;
  }
  function classify(M, F0, W, H, y) {
    var n = W * H, NF = F0.NF, c = new Uint8Array(n);
    for (var i = 0; i < n; i++) { if (!F0.ok[i]) continue; var best = -Infinity, bk = 0, o = i * NF; for (var m = 0; m < M.length; m++) { var q = M[m], s = q.c; for (var j = 0; j < NF; j++) { var d = F0.f[o + j] - q.mu[j]; s -= d * d * q.iv[j]; } if (s > best) { best = s; bk = q.k; } } c[i] = bk; }
    return { y: y, c: c, w: W, h: H, ls: 1, frac: F0.frac };
  }
  function runLs(a, ya, yb) {
    var ys = [ya, yb]; for (var y = Math.ceil(ya / 5) * 5; y < yb; y += 5) if (ys.indexOf(y) < 0) ys.push(y); [2017, 2023].forEach(function (y) { if (y > ya && y < yb && ys.indexOf(y) < 0) ys.push(y); }); ys.sort();
    var need = ys.filter(function (y) { return !LYEARS[y]; }), steps = need.length + 4, done = 0, st = function (s) { done++; msg(Math.min(0.97, done / steps), s); };
    msg(0.03, t('Reading the 2017 and 2023 maps that train and test the classifier…', 'قراءة خريطتي 2017 و2023 اللتين تدرّبان المصنِّف وتختبرانه…'));
    return Promise.all([year(a, 2017), year(a, 2023)]).then(function (M2) {
      if (!M2[0]) throw new Error(t('The 2017 map is missing here, so Landsat cannot be classified.', 'خريطة 2017 مفقودة هنا، فلا يمكن تصنيف لاندسات.'));
      var W = M2[0].w, H = M2[0].h; st(t('Landsat 2017 (training)…', 'لاندسات 2017 (التدريب)…'));
      return lsFeat(a, 2017, W, H).then(function (F17) {
        var Mdl = train(M2[0].c, F17); if (Mdl.length < 2) throw new Error(t('Too few clear Landsat pixels in 2017 to learn the classes.', 'بكسلات لاندسات الصافية في 2017 قليلة جداً لتعلّم الأصناف.'));
        if (ys.indexOf(2017) >= 0) LYEARS[2017] = classify(Mdl, F17, W, H, 2017);
        st(t('Landsat 2023 (test)…', 'لاندسات 2023 (الاختبار)…'));
        return (M2[1] ? lsFeat(a, 2023, W, H) : Promise.resolve(null)).then(function (F23) {
          if (F23) { var cl = classify(Mdl, F23, W, H, 2023), ok = 0, tot = 0, pc = {}; for (var i = 0; i < cl.c.length; i++) { var u = M2[1].c[i], v = cl.c[i]; if (!v || !u || u === 10) continue; tot++; if (u === v) ok++; [1, 5, 7].forEach(function (k) { var p = pc[k] || (pc[k] = { tp: 0, ref: 0, map: 0 }); if (u === k) p.ref++; if (v === k) p.map++; if (u === k && v === k) p.tp++; }); }
            LACC = { oa: tot ? ok / tot : null, pc: pc }; if (ys.indexOf(2023) >= 0) LYEARS[2023] = cl; }
          var q = ys.filter(function (y) { return !LYEARS[y]; }), work = function () { if (!q.length) return Promise.resolve(); var yy = q.shift(); return lsFeat(a, yy, W, H).then(function (Fy) { if (Fy.frac > 0.3) LYEARS[yy] = classify(Mdl, Fy, W, H, yy); }).catch(function () {}).then(function () { st(t('Landsat years: ', 'سنوات لاندسات: ') + yy); return work(); }); };
          return Promise.all([work(), work()]);
        });
      });
    }).then(function () {
      if (!LYEARS[ya] || !LYEARS[yb]) throw new Error(t('Not enough clear Landsat images for one of the two years here; try a nearby year.', 'لا توجد صور لاندسات صافية كافية لإحدى السنتين هنا؛ جرّب سنة قريبة.'));
      var D = {}; ys.forEach(function (y) { if (LYEARS[y]) D[y] = LYEARS[y]; }); R = analyse(a, ya, yb, D, true); render(); msg(1, t('Ready.', 'جاهز.'));
    });
  }
  function run() {
    if (busy) return; var a = aoiP.cur; if (!a) return SH.toast(t('Choose a place first.', 'اختر مكاناً أولاً.'), 'warn');
    var ya = +$('#lcA').value, yb = +$('#lcB').value; if (yb <= ya) return SH.toast(t('The last year must come after the first.', 'يجب أن تكون السنة الأخيرة بعد الأولى.'), 'warn');
    persist.save(); busy = true; $('#lcRun').disabled = true;
    if (src() === 'ls') { runLs(a, ya, yb).catch(function (e) { msg(0, ''); SH.toast(e.message || String(e), 'bad'); }).then(function () { busy = false; $('#lcRun').disabled = false; }); return; }
    var ys = []; for (var y = Y0; y <= Y1; y++) ys.push(y); var done = 0;
    msg(0.03, t('Reading the land-cover maps…', 'قراءة خرائط الغطاء الأرضي…'));
    var q = ys.slice(), work = function () { if (!q.length) return Promise.resolve(); var yy = q.shift(); return year(a, yy).catch(function () { return null; }).then(function () { done++; msg(done / ys.length * 0.9, t('Land-cover maps: ', 'خرائط الغطاء الأرضي: ') + done + ' / ' + ys.length); return work(); }); };
    Promise.all([work(), work(), work()]).then(function () {
      if (!YEARS[ya] || !YEARS[yb]) throw new Error(t('The land-cover map is missing for one of the two years here.', 'خريطة الغطاء الأرضي مفقودة لإحدى السنتين هنا.'));
      R = analyse(a, ya, yb, YEARS); render(); msg(1, t('Ready.', 'جاهز.'));
    }).catch(function (e) { msg(0, ''); SH.toast(e.message || String(e), 'bad'); }).then(function () { busy = false; $('#lcRun').disabled = false; });
  }
  $('#lcRun').addEventListener('click', run);

  function analyse(a, ya, yb, D, ls) {
    D = D || YEARS; var A = D[ya], B = D[yb], B2 = !ls && $('#lcStable').checked && D[yb + 1] ? D[yb + 1] : null, w0 = A.w, h0 = A.h, n = w0 * h0, rows = P.rowArea(a, w0, h0), M = {}, ch = new Uint8Array(n), S = {}, i, k;
    CH.forEach(function (q) { S[q[0]] = 0; }); KEYS.forEach(function (x) { M[x] = {}; KEYS.forEach(function (y) { M[x][y] = 0; }); });
    var per = {}; Object.keys(D).forEach(function (y) { var Y = D[y], ar = {}; KEYS.forEach(function (x) { ar[x] = 0; }); if (Y.w !== w0) return; for (i = 0; i < n; i++) { var c = Y.c[i]; if (ar[c] != null) ar[c] += rows[Math.floor(i / w0)]; } per[y] = ar; });
    var valid = 0;
    for (i = 0; i < n; i++) {
      var ca = A.c[i], cb = B.c[i]; if (!ca || !cb || ca === 10 || cb === 10) continue; var ar0 = rows[Math.floor(i / w0)]; valid += ar0;
      if (ca !== cb && B2 && B2.w === w0 && B2.c[i] !== cb) cb = ca; /* not stable: count as unchanged */
      if (M[ca] && M[ca][cb] != null) M[ca][cb] += ar0;
      if (ca === cb) continue;
      k = cb === 7 && ca === 5 ? 'cb' : cb === 7 ? 'ob' : ca === 5 && (cb === 8 || cb === 11) ? 'cl' : cb === 5 && ca !== 5 ? 'nc' : ca === 1 ? 'wl' : cb === 1 ? 'wg' : ca === 2 ? 'tl' : null;
      if (k) { S[k] += ar0; ch[i] = CH.map(function (q) { return q[0]; }).indexOf(k) + 1; }
    }
    return { a: a, ya: ya, yb: yb, w: w0, h: h0, A: A, B: B, M: M, S: S, ch: ch, per: per, valid: valid, stable: !!B2, ls: !!ls, acc: ls ? LACC : null };
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
    var pct = function (x) { return x == null ? '—' : F(100 * x, 0) + ' %'; }, ac = r.acc, pa2 = function (k) { var p = ac && ac.pc[k]; return p && p.ref ? pct(p.tp / p.ref) : '—'; };
    if (r.ls) v.push(G.verdict(ac && ac.oa != null && ac.oa < 0.6 ? 'warn' : 'info', t('About the Landsat maps', 'عن خرائط لاندسات'), t('Every year here was classified in this tool from Landsat (30 m) spring and summer images, with a classifier taught by the 2017 Sentinel-2 map of this place. Tested against the 2023 map it agrees on ', 'صُنّفت كل سنة هنا في هذه الأداة من صور لاندسات (30 م) للربيع والصيف، بمصنِّف علّمته خريطة سنتينل-2 لسنة 2017 لهذا المكان. وعند اختباره على خريطة 2023 يتفق في ') + pct(ac && ac.oa) + t(' of the pixels (built area found ', ' من البكسلات (وُجدت المباني بنسبة ') + pa2(7) + t(', crops ', '، والمحاصيل ') + pa2(5) + t(', water ', '، والمياه ') + pa2(1) + t('). Trust the large, steady changes — the growth of a city, a new lake, farmland lost over a decade — more than the change of a single class in one year. Rangeland and bare ground are the least certain; years before 1999 come from Landsat 5 only and may have fewer clear images.', '). ثق بالتغيرات الكبيرة المطردة — نمو مدينة، بحيرة جديدة، أرض زراعية فُقدت خلال عقد — أكثر من تغير صنف واحد في سنة واحدة. والمراعي والأرض الجرداء أقل الأصناف يقيناً، وسنوات ما قبل 1999 من لاندسات 5 وحده وقد تقل فيها الصور الصافية.')));
    else v.push(G.verdict('info', t('About the maps', 'عن الخرائط'), t('Each year is classified separately by a deep-learning model from Sentinel-2 images, about 85 % correct overall. Crops, rangeland and bare ground are often confused in dry regions; ', 'كل سنة مصنفة منفصلة بنموذج تعلم عميق من صور سنتينل-2، بدقة كلية نحو 85 %. وكثيراً ما تختلط المحاصيل والمراعي والأرض الجرداء في المناطق الجافة؛ ') + (r.stable ? t('the stability test is on, so only changes confirmed in ', 'اختبار الثبات مفعّل، فلا تُحسب إلا التغيرات المؤكدة في ') + (r.yb + 1) + t(' are counted.', '.') : t('the stability test could not be used (no later year), so read small changes with care.', 'تعذر استعمال اختبار الثبات (لا سنة لاحقة)، فاقرأ التغيرات الصغيرة بحذر.'))));
    $('#lcVerd').innerHTML = v.join('');
    draw(); chart(); matrix();
    if (map) { if (ovl) map.removeLayer(ovl); ovl = L.imageOverlay(chgCv(r).toDataURL(), [[r.a.s, r.a.w], [r.a.n, r.a.e]], { opacity: 0.8 }).addTo(map); }
  }
  function draw() {
    var r = R, v = $('#lcView').value, cv = $('#lcCv'), lay, leg, sub;
    if (v === 'chg') { lay = chgCv(r); leg = CH.filter(function (q) { return r.S[q[0]] > 0; }).map(function (q) { return [q[1], q[3]]; }).concat([['Unchanged (light)', '#D9D9D9']]); sub = 'Main changes ' + r.ya + ' → ' + r.yb + (r.stable ? ', confirmed in ' + (r.yb + 1) : '') + (r.ls ? ' · Landsat 30 m, classified with the 2017 map' + (r.acc && r.acc.oa != null ? ' (agreement in 2023: ' + Math.round(100 * r.acc.oa) + ' %)' : '') : ' · annual 10 m land-cover maps'); }
    else { var Y = v === 'a' ? r.A : r.B; lay = classCv(Y); var pr = r.per[Y.y] || {}; leg = KEYS.filter(function (k) { return pr[k] > 0.001 * r.valid; }).map(function (k) { return [CL[k][0], CL[k][2]]; }); sub = 'Land cover ' + Y.y + (r.ls ? ' · Landsat 30 m, classified with the 2017 map' : ' · annual 10 m land-cover map'); }
    P.sheet(cv, { a: r.a, title: nm() + (v === 'chg' ? ' — land-cover change ' + r.ya + '–' + r.yb : ' — land cover ' + (v === 'a' ? r.ya : r.yb)), sub: sub, layers: [lay], smooth: false, legend: leg,
      stats: v === 'chg' ? 'Farmland to buildings ' + km2(r.S.cb) + '  ·  Other land to buildings ' + km2(r.S.ob) + '  ·  Farmland lost ' + km2(r.S.cl) + '  ·  New farmland ' + km2(r.S.nc) : 'Built ' + km2((r.per[v === 'a' ? r.ya : r.yb] || {})[7] || 0) + '  ·  Crops ' + km2((r.per[v === 'a' ? r.ya : r.yb] || {})[5] || 0) + '  ·  Trees ' + km2((r.per[v === 'a' ? r.ya : r.yb] || {})[2] || 0) });
    $('#lcCap').textContent = v === 'chg' ? t('Coloured pixels changed between the two years: red is farmland that became buildings, orange is other land that became buildings, brown is farmland lost to bare ground or rangeland, green is new farmland, yellow and blue are water lost and gained, purple is trees lost. Light grey is unchanged.', 'البكسلات الملونة تغيرت بين السنتين: الأحمر أرض زراعية صارت مباني، والبرتقالي أرض أخرى صارت مباني، والبني أرض زراعية فُقدت إلى أرض جرداء أو مراعٍ، والأخضر أرض زراعية جديدة، والأصفر والأزرق مياه فُقدت ومياه جديدة، والبنفسجي أشجار فُقدت. والرمادي الفاتح لم يتغير.') : t('Each colour is a land-cover class of that year.', 'كل لون صنف من أصناف الغطاء الأرضي في تلك السنة.');
  }
  $('#lcView').addEventListener('change', function () { persist.save(); if (R) draw(); });
  function chart() {
    var r = R, ys = Object.keys(r.per).map(Number).sort(), keys = KEYS.filter(function (k) { return ys.some(function (y) { return r.per[y][k] > 0.01 * r.valid; }); }), mx = 0;
    keys.forEach(function (k) { ys.forEach(function (y) { mx = Math.max(mx, r.per[y][k]); }); });
    G.chart($('#lcChart'), { W: 760, H: 420, m: { l: 70, r: 20, t: 18, b: 56 }, x: { lo: ys[0], hi: ys[ys.length - 1], n: Math.min(8, ys.length), plain: true, title: 'Year' }, y: { lo: 0, hi: mx * 1.1 || 1, title: 'Area (km²)' },
      top: function (fx, fy) { return '<rect x="' + fx(r.ya) + '" y="' + fy(mx * 1.1) + '" width="' + (fx(r.yb) - fx(r.ya)) + '" height="' + (fy(0) - fy(mx * 1.1)) + '" fill="#B08A3E" fill-opacity=".07"/>'; },
      series: keys.map(function (k) { return { pts: ys.map(function (y) { return [y, r.per[y][k]]; }), col: CL[k][2] === '#E3E2C3' ? '#BDB76B' : CL[k][2], w: k === 7 || k === 5 ? 3 : 2, mark: 'o', r: 3 }; }), legend: keys.map(function (k) { return { name: CL[k][0], col: CL[k][2] === '#E3E2C3' ? '#BDB76B' : CL[k][2], mark: 'o' }; }) });
    $('#lcChartCap').textContent = (r.ls ? t('Landsat years classified here (every five years plus the two compared). ', 'سنوات لاندسات المصنفة هنا (كل خمس سنوات مع السنتين المقارنتين). ') : '') + t('Area of every land-cover class in each year from ' + ys[0] + ' to ' + ys[ys.length - 1] + '; the shaded band is the period compared. A steady rise of the built area with a fall of crops is urban growth over farmland.', 'مساحة كل صنف من أصناف الغطاء الأرضي في كل سنة من ' + ys[0] + ' إلى ' + ys[ys.length - 1] + '؛ والشريط المظلل هو الفترة المقارنة. والارتفاع المطرد للمباني مع انخفاض المحاصيل هو نمو حضري على حساب الأرض الزراعية.');
  }
  function matrix() {
    var r = R, ks = KEYS.filter(function (k) { return KEYS.some(function (j) { return r.M[k][j] > 0.001 || r.M[j][k] > 0.001; }); }), mx = 0; ks.forEach(function (a) { ks.forEach(function (b) { if (a !== b) mx = Math.max(mx, r.M[a][b]); }); });
    $('#lcMx').innerHTML = '<thead><tr><th class="r">' + t('From ', 'من ') + r.ya + ' ↓ / ' + t('to ', 'إلى ') + r.yb + ' →</th>' + ks.map(function (k) { return '<th>' + (AR ? CL[k][1] : CL[k][0]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ks.map(function (a) { return '<tr><th class="r">' + (AR ? CL[a][1] : CL[a][0]) + '</th>' + ks.map(function (b) { var v = r.M[a][b], al = a === b ? 0 : Math.min(0.85, v / (mx || 1)); return '<td style="' + (a === b ? 'color:var(--text-3)' : 'background:rgba(196,40,27,' + al.toFixed(2) + ')' + (al > 0.5 ? ';color:#fff;font-weight:700' : '')) + '">' + (v >= 0.005 ? F(v, v < 10 ? 2 : 1) : '·') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }
  $$('[data-cv]').forEach(function (b) { b.addEventListener('click', function () { if (!R) return; SH.exportCanvas($('#' + b.getAttribute('data-cv')), 'shandal-landcover-' + (R.a.key || 'area') + '-' + R.ya + '-' + R.yb, b.getAttribute('data-fmt')); }); });
  $('#lcCsv').addEventListener('click', function () {
    if (!R) return; var r = R, ys = Object.keys(r.per).map(Number).sort(), rows = [['place', nm()], ['source', r.ls ? 'Landsat 30 m classified with the 2017 map; agreement with 2023 map ' + (r.acc && r.acc.oa != null ? (100 * r.acc.oa).toFixed(1) + ' %' : 'n/a') : 'Annual 10 m land-cover maps (Sentinel-2)'], ['bbox_w_s_e_n', [r.a.w, r.a.s, r.a.e, r.a.n].join(' ')], [], ['year'].concat(KEYS.map(function (k) { return CL[k][0] + ' km2'; }))];
    ys.forEach(function (y) { rows.push([y].concat(KEYS.map(function (k) { return r.per[y][k].toFixed(3); }))); });
    rows.push([], ['from ' + r.ya + ' \\ to ' + r.yb].concat(KEYS.map(function (k) { return CL[k][0]; }))); KEYS.forEach(function (a) { rows.push([CL[a][0]].concat(KEYS.map(function (b) { return r.M[a][b].toFixed(3); }))); });
    rows.push([], ['change', 'km2']); CH.forEach(function (q) { rows.push([q[1], r.S[q[0]].toFixed(3)]); });
    SH.csv('shandal-landcover-' + (r.a.key || 'area') + '-' + r.ya + '-' + r.yb + '.csv', rows);
  });
  $('#lcName').addEventListener('input', function () { persist.save(); if (R) draw(); });
  $('#lcStable').addEventListener('change', function () { persist.save(); if (R && !R.ls && YEARS[R.ya]) { R = analyse(R.a, R.ya, R.yb, YEARS); render(); } });
})();
