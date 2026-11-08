/* Compaction and CBR — Proctor test (ASTM D698 / D1557): bulk and dry density, least-squares curve, maximum dry density and optimum
   water content, zero-air-voids and 80 / 90 % saturation lines, degree of saturation at optimum, field relative compaction;
   CBR (ASTM D1883 / BS 1377-4) with correction of an initially concave curve, CBR at 2.54 and 5.08 mm, subgrade rating and an
   approximate resilient modulus. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG;
  var IDS = ['cpT', 'cpGs', 'cpV', 'cpMm', 'cpFd', 'cpFw', 'cpRc', 'cbSw'], persist = SH.persist('compcbr', IDS), last = null;
  var DEFP = [{ m: 5960, w: 8.2 }, { m: 6075, w: 10.4 }, { m: 6160, w: 12.3 }, { m: 6180, w: 14.1 }, { m: 6140, w: 16.2 }];
  var DEFC = [{ p: 0, l: 0 }, { p: 0.64, l: 0.35 }, { p: 1.27, l: 0.95 }, { p: 1.91, l: 1.7 }, { p: 2.54, l: 2.35 }, { p: 3.81, l: 3.3 }, { p: 5.08, l: 4.05 }, { p: 7.62, l: 5.1 }, { p: 10.16, l: 5.9 }, { p: 12.7, l: 6.5 }];
  var TP = G.rows($('#cpRows'), 'shandal_proctor_rows', [{ k: 'm', h: 'M g' }, { k: 'w', h: 'w %' }], DEFP, function () { later(); });
  var TC = G.rows($('#cbRows'), 'shandal_cbr_rows', [{ k: 'p', h: t('Penetration mm', 'الاختراق مم') }, { k: 'l', h: t('Load kN', 'الحمل كيلونيوتن') }], DEFC, function () { later(); });
  $('#cpAdd').addEventListener('click', function () { TP.add({}); }); $('#cbAdd').addEventListener('click', function () { TC.add({}); });

  function polyfit(x, y, n) {
    var mx = x.reduce(function (a, b) { return a + b; }, 0) / x.length, sx = Math.max(1e-6, Math.sqrt(x.reduce(function (a, b) { return a + (b - mx) * (b - mx); }, 0) / x.length)), u = x.map(function (v) { return (v - mx) / sx; }), A = [], b = [];
    for (var i = 0; i <= n; i++) { A.push([]); b.push(u.reduce(function (a, v, k) { return a + Math.pow(v, i) * y[k]; }, 0)); for (var j = 0; j <= n; j++) A[i].push(u.reduce(function (a, v) { return a + Math.pow(v, i + j); }, 0)); }
    for (i = 0; i <= n; i++) { var piv = i; for (j = i + 1; j <= n; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j; var tmp = A[i]; A[i] = A[piv]; A[piv] = tmp; tmp = b[i]; b[i] = b[piv]; b[piv] = tmp;
      for (j = i + 1; j <= n; j++) { var f = A[j][i] / A[i][i]; for (var k = i; k <= n; k++) A[j][k] -= f * A[i][k]; b[j] -= f * b[i]; } }
    var c = new Array(n + 1); for (i = n; i >= 0; i--) { var s = b[i]; for (j = i + 1; j <= n; j++) s -= A[i][j] * c[j]; c[i] = s / A[i][i]; }
    return function (v) { var q = (v - mx) / sx, s = 0; for (var i2 = 0; i2 <= n; i2++) s += c[i2] * Math.pow(q, i2); return s; };
  }
  function run() {
    var g = {}; IDS.forEach(function (k) { g[k] = G.v(k); }); var Gs = g.cpGs || 2.65, V = g.cpV, Mm = g.cpMm || 0; if (!(V > 0)) return; persist.save();
    var pts = TP.get().filter(function (r) { return r.m > Mm && r.w >= 0; }).map(function (r) { var rho = (r.m - Mm) / V; return { m: r.m, w: r.w, rho: rho, rd: rho / (1 + r.w / 100) }; }).sort(function (a, b) { return a.w - b.w; });
    var P = null;
    if (pts.length >= 3) {
      var fit = polyfit(pts.map(function (p) { return p.w; }), pts.map(function (p) { return p.rd; }), pts.length >= 5 ? 3 : 2), w0 = pts[0].w, w1 = pts[pts.length - 1].w, best = { w: w0, rd: -1 };
      for (var w = w0; w <= w1 + 1e-9; w += (w1 - w0) / 400) { var r = fit(w); if (r > best.rd) best = { w: w, rd: r }; }
      var edge = best.w <= w0 + (w1 - w0) * 0.02 || best.w >= w1 - (w1 - w0) * 0.02, e = Gs / best.rd - 1, S = best.w / 100 * Gs / e;
      P = { pts: pts, fit: fit, wopt: best.w, rdmax: best.rd, edge: edge, Sopt: S, w0: w0, w1: w1 };
      if (g.cpFd > 0) { P.rc = g.cpFd / best.rd * 100; P.dw = (g.cpFw || 0) - best.w; P.fd = g.cpFd; P.fw = g.cpFw; P.req = g.cpRc || 95; }
    }
    var C = null, cr = TC.get().filter(function (r) { return r.p >= 0 && r.l >= 0 && r.p != null && r.l != null; }).sort(function (a, b) { return a.p - b.p; });
    if (cr.length >= 4) {
      var x0 = 0, sm = 0, si = -1; for (var i = 0; i + 1 < cr.length && cr[i + 1].p <= 5.08; i++) { var sl = (cr[i + 1].l - cr[i].l) / Math.max(1e-6, cr[i + 1].p - cr[i].p); if (sl > sm * 1.0001) { sm = sl; si = i; } }
      var s0 = cr[1] ? (cr[1].l - cr[0].l) / Math.max(1e-6, cr[1].p - cr[0].p) : sm; if (si > 0 && sm > s0 * 1.15) { x0 = Math.max(0, cr[si].p - cr[si].l / sm); }
      var at = function (pp) { for (var j = 0; j + 1 < cr.length; j++) if (pp >= cr[j].p && pp <= cr[j + 1].p) return cr[j].l + (cr[j + 1].l - cr[j].l) * (pp - cr[j].p) / (cr[j + 1].p - cr[j].p); return NaN; };
      var L25 = at(2.54 + x0), L50 = at(5.08 + x0), c25 = L25 / 13.24 * 100, c50 = L50 / 19.96 * 100, cbr = isFinite(c50) && c50 > c25 ? c50 : c25;
      C = { cr: cr, x0: x0, sm: sm, si: si, L25: L25, L50: L50, c25: c25, c50: c50, cbr: cbr, sw: g.cbSw };
    }
    last = { g: g, Gs: Gs, P: P, C: C }; render();
  }
  function rate(c) { return c < 3 ? [t('Very poor subgrade', 'تربة أساس رديئة جداً'), 'bad'] : c < 7 ? [t('Poor to fair subgrade', 'تربة أساس رديئة إلى مقبولة'), 'warn'] : c < 20 ? [t('Fair to good subgrade, usable as subbase above 20 when granular', 'تربة أساس مقبولة إلى جيدة'), 'ok'] : c < 50 ? [t('Good: subbase material', 'جيدة: مادة طبقة ما تحت الأساس'), 'ok'] : c < 80 ? [t('Very good: base course material', 'جيدة جداً: مادة طبقة الأساس'), 'ok'] : [t('Excellent: crushed-stone base', 'ممتازة: أساس من الحجر المكسر'), 'ok']; }
  function render() {
    var R = last, P = R.P, C = R.C, k = [], v = [];
    if (P) { k.push(G.kpi('info', t('Maximum dry density', 'أقصى كثافة جافة'), F(P.rdmax, 3) + '<small> g/cm³</small>', F(P.rdmax * 9.807, 2) + ' kN/m³')); k.push(G.kpi('info', t('Optimum water content', 'المحتوى المائي الأمثل'), F(P.wopt, 1) + '<small> %</small>', t('saturation at optimum ', 'التشبع عند الأمثل ') + F(P.Sopt * 100, 0) + ' %'));
      if (P.rc != null) { var okR = P.rc >= P.req, okW = Math.abs(P.dw) <= 2; k.push(G.kpi(okR ? 'ok' : 'bad', t('Relative compaction', 'نسبة الرص'), F(P.rc, 1) + '<small> %</small>', t('required ', 'المطلوب ') + F(P.req, 0) + ' %')); v.push(G.verdict(okR && okW ? 'ok' : 'bad', okR && okW ? t('Field compaction accepted', 'الرص الحقلي مقبول') : t('Field compaction rejected', 'الرص الحقلي مرفوض'), t('Dry density ', 'الكثافة الجافة ') + F(P.fd, 3) + t(' g/cm³ is ', ' غ/سم³ تساوي ') + F(P.rc, 1) + t(' % of the maximum; water content is ', ' % من الأقصى؛ والمحتوى المائي ') + (P.dw >= 0 ? '+' : '') + F(P.dw, 1) + t(' % from optimum (usual tolerance ±2 %). ', ' % عن الأمثل (السماحية المعتادة ±2 %). ') + (!okR ? t('Add roller passes or thinner lifts. ', 'زِد مرات مرور الحادلة أو قلّل سمك الطبقات. ') : '') + (P.dw > 2 ? t('Dry the layer before rolling.', 'جفف الطبقة قبل الحدل.') : P.dw < -2 ? t('Add water and mix before rolling.', 'أضف ماءً واخلط قبل الحدل.') : ''))); }
      if (P.edge) v.push(G.verdict('warn', t('Peak not bracketed', 'القمة غير محصورة'), t('The highest point of the curve lies at the end of the test range; add a point on the ', 'أعلى نقطة في المنحنى تقع عند طرف مدى الفحص؛ أضف نقطة على الجانب ') + (P.wopt <= P.w0 + 0.1 ? t('dry side.', 'الجاف.') : t('wet side.', 'الرطب.')))); }
    else v.push(G.verdict('info', t('Compaction test', 'فحص الرص'), t('Enter at least three points (mass and water content).', 'أدخل ثلاث نقاط على الأقل (الكتلة والمحتوى المائي).')));
    if (C && isFinite(C.cbr)) { var rt = rate(C.cbr); k.push(G.kpi(rt[1], 'CBR', F(C.cbr, C.cbr < 10 ? 1 : 0) + '<small> %</small>', (C.c50 > C.c25 ? t('at 5.08 mm', 'عند 5.08 مم') : t('at 2.54 mm', 'عند 2.54 مم')) + (C.x0 > 0 ? t(' · corrected', ' · مصحح') : '')));
      v.push(G.verdict(rt[1], rt[0], 'CBR 2.54 mm = ' + F(C.c25, 1) + ' %, 5.08 mm = ' + F(C.c50, 1) + ' %' + (C.c50 > C.c25 ? t('. The value at 5.08 mm is higher: the standard asks to repeat the test, and if it is confirmed the higher value is used.', '. القيمة عند 5.08 مم أعلى: يطلب المعيار إعادة الفحص، فإن تأكدت تُعتمد القيمة الأعلى.') : '.') + t(' Approximate resilient modulus Mr ≈ ', ' معامل المرونة التقريبي Mr ≈ ') + F(10.34 * Math.min(C.cbr, 20), 0) + ' MPa' + (C.sw > 2 ? t('. Swell of ', '. انتفاخ ') + F(C.sw, 1) + t(' % indicates an expansive soil: stabilise with lime or replace it.', ' % يدل على تربة انتفاخية: ثبّتها بالجير أو استبدلها.') : '.'))); }
    $('#cpKpis').innerHTML = k.join(''); $('#cpVerd').innerHTML = v.join('');
    figCur(); figCbr(); table();
  }
  function figCur() {
    var R = last, P = R.P, svg = $('#cpCur'); if (!P) { svg.innerHTML = ''; return; }
    var wl = Math.max(0, Math.floor(P.w0 - 2)), wh = Math.ceil(P.w1 + 3), zav = function (w, S) { return R.Gs / (1 + w / 100 * R.Gs / S); };
    var ys = P.pts.map(function (p) { return p.rd; }).concat([P.rdmax]); if (P.fd) ys.push(P.fd); var lo = Math.min.apply(null, ys) - 0.06, hi = Math.max(P.rdmax + 0.08, Math.min(zav(wl + 1, 1), P.rdmax + 0.25));
    var cv = []; for (var w = P.w0; w <= P.w1 + 1e-9; w += (P.w1 - P.w0) / 80) cv.push([w, P.fit(w)]);
    var line = function (S) { var a = []; for (var w2 = wl; w2 <= wh; w2 += 0.25) a.push([w2, zav(w2, S)]); return a; };
    var ser = [{ pts: line(1), col: '#2E6FBF', w: 1.8 }, { pts: line(0.9), col: '#2E6FBF', w: 1.2, dash: '6 4' }, { pts: line(0.8), col: '#2E6FBF', w: 1.2, dash: '2 3' }, { pts: cv, col: '#C0392B', w: 2.4 }, { pts: P.pts.map(function (p) { return [p.w, p.rd]; }), col: '#C0392B', w: 0, mark: 'o', r: 5 }];
    var lg = [{ name: 'Test points and fitted curve', col: '#C0392B', mark: 'o' }, { name: 'Zero air voids (S = 100 %)', col: '#2E6FBF' }, { name: 'S = 90 %', col: '#2E6FBF', dash: '6 4' }, { name: 'S = 80 %', col: '#2E6FBF', dash: '2 3' }];
    if (P.fd) { ser.push({ pts: [[P.fw, P.fd]], col: '#2E8B57', w: 0, mark: 't', r: 7 }); lg.push({ name: 'Field test', col: '#2E8B57', mark: 't', noLine: 1 }); }
    var reqL = P.req ? P.rdmax * P.req / 100 : null;
    G.chart(svg, { W: 560, H: 400, m: { l: 66, r: 16, t: 16, b: 56 }, x: { lo: wl, hi: wh, title: 'Water content w (%)' }, y: { lo: lo, hi: hi, title: 'Dry density ρd (g/cm³)' }, series: ser, hl: reqL ? [{ v: reqL, col: '#2E8B57', dash: '8 4', label: F(P.req, 0) + ' % of ρd,max' }] : [], vl: [{ v: P.wopt, col: G.INK, dash: '3 3' }],
      top: function (fx, fy) { return '<circle cx="' + fx(P.wopt) + '" cy="' + fy(P.rdmax) + '" r="6" fill="#C0392B"/>' + G.tx(fx(P.wopt) + 9, fy(P.rdmax) - 9, 'ρd,max = ' + F(P.rdmax, 3) + ', w opt = ' + F(P.wopt, 1) + ' %', { fs: 11.5, fw: 800, halo: 1 }); }, legend: lg, note: (R.g.cpT === 'mod' ? 'Modified' : 'Standard') + ' Proctor, Gs = ' + F(R.Gs, 2) + '.' });
    $('#cpCurCap').textContent = t('Dry density rises with water as lubrication helps the grains pack, then falls as water takes the place of soil. The curve never crosses the zero-air-voids line; compaction near optimum leaves about 10–20 % of the voids with air.', 'ترتفع الكثافة الجافة مع الماء لأن التزييت يساعد الحبيبات على التراص، ثم تنخفض حين يحل الماء محل التربة. ولا يعبر المنحنى خط انعدام الفراغات الهوائية أبداً، والرص قرب الأمثل يترك نحو 10–20 % من الفراغات مملوءة بالهواء.');
  }
  function figCbr() {
    var R = last, C = R.C, svg = $('#cbCur'); if (!C) { svg.innerHTML = ''; return; }
    var pm = Math.max(12.7, C.cr[C.cr.length - 1].p), lm = Math.max.apply(null, C.cr.map(function (r) { return r.l; })) * 1.15, ser = [{ pts: C.cr.map(function (r) { return [r.p, r.l]; }), col: '#C0392B', w: 2.2, mark: 'o', r: 4 }], vl = [{ v: 2.54 + C.x0, col: '#2E6FBF', dash: '4 3', label: '2.54' }, { v: 5.08 + C.x0, col: '#2E8B57', dash: '4 3', label: '5.08' }];
    if (C.x0 > 0 && C.si >= 0) { var p1 = C.cr[C.si]; ser.push({ pts: [[C.x0, 0], [p1.p + 1.5, p1.l + 1.5 * C.sm]], col: G.INK, w: 1.2, dash: '5 4' }); }
    G.chart(svg, { W: 560, H: 400, m: { l: 62, r: 16, t: 16, b: 56 }, x: { lo: 0, hi: pm, st: 2, title: 'Penetration (mm)' }, y: { lo: 0, hi: lm, title: 'Load on piston (kN)' }, series: ser, vl: vl, top: function (fx, fy) { var s = ''; if (isFinite(C.L25)) s += '<circle cx="' + fx(2.54 + C.x0) + '" cy="' + fy(C.L25) + '" r="5" fill="#2E6FBF"/>' + G.tx(fx(2.54 + C.x0) + 8, fy(C.L25) + 16, 'CBR ' + F(C.c25, 1) + ' %', { fs: 11.5, fw: 700, fill: '#2E6FBF', halo: 1 }); if (isFinite(C.L50)) s += '<circle cx="' + fx(5.08 + C.x0) + '" cy="' + fy(C.L50) + '" r="5" fill="#2E8B57"/>' + G.tx(fx(5.08 + C.x0) + 8, fy(C.L50) + 16, 'CBR ' + F(C.c50, 1) + ' %', { fs: 11.5, fw: 700, fill: '#2E8B57', halo: 1 }); return s; },
      legend: [{ name: 'Test readings', col: '#C0392B', mark: 'o' }].concat(C.x0 > 0 ? [{ name: 'Tangent for the concave start (origin moved ' + F(C.x0, 2) + ' mm)', col: G.INK, dash: '5 4' }] : []).concat([{ name: 'Standard loads 13.24 kN at 2.54 mm and 19.96 kN at 5.08 mm', col: '#2E6FBF', dash: '4 3' }]) });
    $('#cbCurCap').textContent = t('CBR compares the load the soil carries at 2.54 and 5.08 mm penetration with the load a standard crushed stone carries. A curve that starts concave (seating of the piston) is corrected by moving the origin to where the steepest tangent meets the axis.', 'تقارن نسبة CBR الحمل الذي تحمله التربة عند اختراق 2.54 و5.08 مم بالحمل الذي يحمله حجر مكسر قياسي. والمنحنى الذي يبدأ مقعراً (استقرار المكبس) يُصحح بنقل الأصل إلى حيث يلاقي أشد مماس المحور.');
  }
  function table() {
    var R = last, P = R.P; if (!P) { $('#cpTbl').innerHTML = ''; return; }
    $('#cpTbl').innerHTML = '<thead><tr><th>#</th><th class="num">M g</th><th class="num">w %</th><th class="num">ρ g/cm³</th><th class="num">ρd g/cm³</th><th class="num">S %</th></tr></thead><tbody>' + P.pts.map(function (p, i) { var e = R.Gs / p.rd - 1; return '<tr><td>' + (i + 1) + '</td><td class="num">' + F(p.m, 0) + '</td><td class="num">' + F(p.w, 1) + '</td><td class="num">' + F(p.rho, 3) + '</td><td class="num">' + F(p.rd, 3) + '</td><td class="num">' + F(p.w / 100 * R.Gs / e * 100, 0) + '</td></tr>'; }).join('') + '</tbody>';
  }
  $('#cpCsv').addEventListener('click', function () { if (!last || !last.P) return; var P = last.P, C = last.C; SH.csv('shandal-compaction-cbr.csv', [['mass_g', 'w_pct', 'bulk_density', 'dry_density']].concat(P.pts.map(function (p) { return [p.m, p.w, p.rho.toFixed(4), p.rd.toFixed(4)]; })).concat([[], ['max_dry_density_g_cm3', P.rdmax.toFixed(4)], ['optimum_w_pct', P.wopt.toFixed(2)]]).concat(P.rc != null ? [['relative_compaction_pct', P.rc.toFixed(1)]] : []).concat(C ? [[], ['CBR_2.54', C.c25.toFixed(1)], ['CBR_5.08', C.c50.toFixed(1)], ['CBR', C.cbr.toFixed(1)], ['origin_correction_mm', C.x0.toFixed(2)]] : [])); });
  var tm = null; function later() { clearTimeout(tm); tm = setTimeout(run, 150); }
  IDS.forEach(function (id) { var e = $('#' + id); e.addEventListener('input', later); e.addEventListener('change', later); });
  $('#cpDemo').addEventListener('click', function () { TP.set(DEFP); TC.set(DEFC); G.set({ cpT: 'std', cpGs: 2.68, cpV: 944, cpMm: 4250, cpFd: 1.78, cpFw: 13, cpRc: 95, cbSw: 0.8 }); run(); });
  document.addEventListener('DOMContentLoaded', run);
})();
