/* Rock Mass Lab — RMR89 (Bieniawski 1989), Q (Barton et al. 1974; NGI 2015), Q-slope (Bar & Barton 2017),
   GSI quantified from JCond89 and RQD (Hoek, Carter & Diederichs 2013), generalised Hoek–Brown criterion
   (Hoek, Carranza-Torres & Corkum 2002) with equivalent Mohr–Coulomb parameters, and rock-mass modulus
   (Hoek & Diederichs 2006). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, AR = SH.lang === 'ar';
  var ids = ['geoName', 'mProject', 'mRock', 'ucs', 'is50', 'mCase', 'H', 'gam', 'slope', 'span', 'esr', 'Dfac', 'rqd', 'jv', 'spc', 'Jn', 'Jr', 'Ja', 'cPer', 'cApe', 'cRou', 'cInf', 'cWea', 'rGw', 'Jw', 'SRF', 'Oa', 'Jwice', 'SRFs'];
  var store = SH.persist('rockmass', ids), last = null;
  var INK = '#1B232B', MUT = '#55616B', CRIT = '#C0392B', HB = '#B4552D', MC = '#2F6FB2';
  var num = function (id) { return parseFloat($('#' + id).value); };
  function caseUI() { var tun = $('#mCase').value === 'tunnel'; $('#tunBox').hidden = !tun; }
  $('#mCase').addEventListener('change', caseUI);

  var RMRC = [[81, 'I', t('Very good rock', 'صخر جيد جداً')], [61, 'II', t('Good rock', 'صخر جيد')], [41, 'III', t('Fair rock', 'صخر متوسط')], [21, 'IV', t('Poor rock', 'صخر ضعيف')], [-1, 'V', t('Very poor rock', 'صخر ضعيف جداً')]];
  var QC = [[400, t('Exceptionally good', 'جيد استثنائياً')], [100, t('Extremely good', 'جيد للغاية')], [40, t('Very good', 'جيد جداً')], [10, t('Good', 'جيد')], [4, t('Fair', 'متوسط')], [1, t('Poor', 'ضعيف')], [0.1, t('Very poor', 'ضعيف جداً')], [0.01, t('Extremely poor', 'ضعيف للغاية')], [0, t('Exceptionally poor', 'ضعيف استثنائياً')]];
  var GC = [[75, t('Very good', 'جيد جداً')], [55, t('Good', 'جيد')], [35, t('Fair', 'متوسط')], [20, t('Poor', 'ضعيف')], [-1, t('Very poor', 'ضعيف جداً')]];
  var pick = function (tab, v) { for (var i = 0; i < tab.length; i++) if (v >= tab[i][0]) return tab[i]; return tab[tab.length - 1]; };

  function analyse() {
    var sci = num('ucs'); if (!(sci > 0) && num('is50') > 0) sci = 22 * num('is50');
    if (!(sci > 0)) { SH.toast(t('Enter the intact UCS or the point-load index.', 'أدخل مقاومة الصخر السليم أو مؤشر الحمل النقطي.'), 'warn'); return null; }
    var rqd = num('rqd'); if (isNaN(rqd) && num('jv') >= 0) rqd = SH.clamp(110 - 2.5 * num('jv'), 0, 100);
    if (isNaN(rqd)) { SH.toast(t('Enter RQD or Jv.', 'أدخل RQD أو Jv.'), 'warn'); return null; }
    var spc = num('spc'); if (!(spc > 0)) { SH.toast(t('Enter the mean joint spacing.', 'أدخل متوسط تباعد الفواصل.'), 'warn'); return null; }
    var r = { sci: sci, rqd: rqd, spc: spc, mi: parseFloat($('#mRock').value), D: num('Dfac'), H: num('H') || 0, gam: num('gam') || 26, slope: num('slope'), tun: $('#mCase').value === 'tunnel', B: num('span'), ESR: num('esr') };
    // RMR89
    var a1 = sci > 250 ? 15 : sci > 100 ? 12 : sci > 50 ? 7 : sci > 25 ? 4 : sci > 5 ? 2 : sci >= 1 ? 1 : 0, a2 = rqd >= 90 ? 20 : rqd >= 75 ? 17 : rqd >= 50 ? 13 : rqd >= 25 ? 8 : 3, a3 = spc > 2 ? 20 : spc >= 0.6 ? 15 : spc >= 0.2 ? 10 : spc >= 0.06 ? 8 : 5;
    r.sub = ['cPer', 'cApe', 'cRou', 'cInf', 'cWea'].map(function (id) { return parseInt($('#' + id).value, 10); }); var a4 = r.sub.reduce(function (x, y) { return x + y; }, 0), a5 = +$('#rGw').value;
    r.p = [a1, a2, a3, a4, a5]; r.rmr = a1 + a2 + a3 + a4 + a5; r.rmrDry = a1 + a2 + a3 + a4 + 15;
    // Q and Q-slope
    var Jn = num('Jn'), Jr = num('Jr'), Ja = num('Ja'), Jw = num('Jw'), SRF = num('SRF'), rq = Math.max(rqd, 10);
    r.Qp = { Jn: Jn, Jr: Jr, Ja: Ja, Jw: Jw, SRF: SRF, O: num('Oa'), Jwice: num('Jwice'), SRFs: num('SRFs') };
    r.Q = rq / Jn * (Jr / Ja) * (Jw / SRF);
    r.Qs = rq / Jn * (Jr / Ja * r.Qp.O) * (r.Qp.Jwice / r.Qp.SRFs); r.beta = 20 * Math.log10(r.Qs) + 65;
    r.Qr = Math.exp((r.rmr - 44) / 9); r.RMRq = 9 * Math.log(r.Q) + 44;
    if (r.tun && r.B > 0) { r.De = r.B / r.ESR; r.spanMax = 2 * r.ESR * Math.pow(r.Q, 0.4); r.Lb = 2 + 0.15 * r.B / r.ESR; }
    // GSI and Hoek–Brown
    r.gsi = SH.clamp(1.5 * a4 + rqd / 2, 0, 100); r.gsiR = r.rmrDry > 23 ? r.rmrDry - 5 : NaN;
    var G = r.gsi, D = r.D; r.mb = r.mi * Math.exp((G - 100) / (28 - 14 * D)); r.s = Math.exp((G - 100) / (9 - 3 * D)); r.a = 0.5 + (Math.exp(-G / 15) - Math.exp(-20 / 3)) / 6;
    var mb = r.mb, s = r.s, a = r.a; r.sc = sci * Math.pow(s, a); r.st = -s * sci / mb;
    r.scm = sci * (mb + 4 * s - a * (mb - 8 * s)) * Math.pow(mb / 4 + s, a - 1) / (2 * (1 + a) * (2 + a));
    var gH = r.gam * Math.max(r.H, 1) / 1000; r.s3max = r.tun ? 0.47 * r.scm * Math.pow(r.scm / gH, -0.94) : 0.72 * r.scm * Math.pow(r.scm / gH, -0.91);
    var s3n = r.s3max / sci, k = 6 * a * mb * Math.pow(s + mb * s3n, a - 1);
    r.phi = SH.deg(Math.asin(k / (2 * (1 + a) * (2 + a) + k)));
    r.c = sci * ((1 + 2 * a) * s + (1 - a) * mb * s3n) * Math.pow(s + mb * s3n, a - 1) / ((1 + a) * (2 + a) * Math.sqrt(1 + k / ((1 + a) * (2 + a))));
    r.Erm = 100000 * (1 - D / 2) / (1 + Math.exp((75 + 25 * D - G) / 11));
    return r;
  }

  /* ---------- drawing helpers */
  function frame(S, W, H, title) { S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + H); S.add('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }); S.add('rect', { x: 6, y: 6, width: W - 12, height: H - 12, fill: 'none', stroke: INK, 'stroke-width': 1.1 }); S.text(20, 30, title, { 'font-size': 11.5, 'font-weight': 700, fill: INK, direction: 'ltr' }); S.text(16, H - 14, 'Shandal System · ' + new Date().toISOString().slice(0, 10), { 'font-size': 9.5, fill: MUT, direction: 'ltr' }); }
  function halo(S, x, y, s, a) { return S.text(x, y, s, Object.assign({ fill: INK, stroke: '#fff', 'stroke-width': 3.2, 'paint-order': 'stroke', direction: 'ltr', 'font-size': 11, 'font-weight': 800 }, a || {})); }
  function box(S, x, y, s, a) { a = a || {}; var fs = a['font-size'] || 11, w = String(s).length * fs * .56 + 10; S.add('rect', { x: x - w / 2, y: y - fs - 1, width: w, height: fs + 7, rx: 3, fill: '#fff', stroke: a.box || INK, 'stroke-width': .8 }); S.text(x, y + 1, s, Object.assign({ 'font-size': fs, 'text-anchor': 'middle', direction: 'ltr', fill: INK, 'font-weight': 700 }, a)); }
  function nice(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function axes(S, o) { // o: x0,y0,w,h,xmin,xmax,ymin,ymax,xlab,ylab,xlog
    var X = function (v) { return o.x0 + (o.xlog ? (Math.log10(v) - o.xmin) / (o.xmax - o.xmin) : (v - o.xmin) / (o.xmax - o.xmin)) * o.w; }, Y = function (v) { return o.y0 + o.h - (v - o.ymin) / (o.ymax - o.ymin) * o.h; };
    S.add('rect', { x: o.x0, y: o.y0, width: o.w, height: o.h, fill: '#FBFAF6', stroke: INK, 'stroke-width': 1 });
    var v, sx = o.xlog ? 1 : nice((o.xmax - o.xmin) / 6), sy = nice((o.ymax - o.ymin) / 6);
    for (v = o.xlog ? Math.ceil(o.xmin) : Math.ceil(o.xmin / sx) * sx; v <= o.xmax + 1e-9; v += sx) { var px = o.xlog ? o.x0 + (v - o.xmin) / (o.xmax - o.xmin) * o.w : X(v); S.line(px, o.y0, px, o.y0 + o.h, { stroke: '#E1E4E7', 'stroke-width': .7 }); S.line(px, o.y0 + o.h, px, o.y0 + o.h + 5, { stroke: INK }); S.text(px, o.y0 + o.h + 18, o.xlog ? String(Math.pow(10, v)).replace(/^0\./, '0.') : SH.fmt(Math.abs(v) < 1e-9 ? 0 : v, sx < 1 ? 1 : 0), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    for (v = Math.ceil(o.ymin / sy) * sy; v <= o.ymax + 1e-9; v += sy) { S.line(o.x0, Y(v), o.x0 + o.w, Y(v), { stroke: '#E1E4E7', 'stroke-width': .7 }); S.line(o.x0 - 5, Y(v), o.x0, Y(v), { stroke: INK }); S.text(o.x0 - 8, Y(v) + 4, SH.fmt(Math.abs(v) < 1e-9 ? 0 : v, sy < 1 ? 1 : 0), { 'font-size': 10, fill: MUT, 'text-anchor': 'end', direction: 'ltr' }); }
    S.text(o.x0 + o.w / 2, o.y0 + o.h + 38, o.xlab, { 'font-size': 11, 'font-weight': 700, fill: INK, 'text-anchor': 'middle', direction: 'ltr' });
    var yx = o.x0 - 48, yy = o.y0 + o.h / 2; S.text(yx, yy, o.ylab, { 'font-size': 11, 'font-weight': 700, fill: INK, 'text-anchor': 'middle', direction: 'ltr', transform: 'rotate(-90 ' + yx + ' ' + yy + ')' });
    return { X: X, Y: Y };
  }
  function legend(S, x, y, w, items) { S.add('rect', { x: x, y: y, width: w, height: 30 + items.length * 21, fill: '#fff', stroke: INK, 'stroke-width': .9 }); S.text(x + 10, y + 18, 'LEGEND', { 'font-size': 10.5, 'font-weight': 800, fill: INK, 'letter-spacing': 1.2 }); items.forEach(function (it, i) { var yy = y + 36 + i * 21; it[0](x + 10, yy); S.text(x + 46, yy + 4, it[1], { 'font-size': 10, fill: INK, direction: 'ltr' }); }); }
  var sLine = function (S, col, w, da) { return function (x, y) { S.line(x, y, x + 28, y, { stroke: col, 'stroke-width': w || 2, 'stroke-dasharray': da || null }); }; };
  var sDot = function (S, col) { return function (x, y) { S.circle(x + 14, y, 4.5, { fill: col, stroke: '#fff', 'stroke-width': 1 }); }; };
  var pathOf = function (pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'); };

  /* ---------- 1. classification scales */
  function drawM1(r) {
    var S = SH.svgB('svgM1'); frame(S, 760, 460, 'Rock mass on the RMR89, Q-system and GSI scales (solid marker: measured · open marker: correlated)');
    var x0 = 70, w = 620, bar = function (y, title, bands, pos, posC, lab, labC) {
      S.text(x0, y - 14, title, { 'font-size': 11.5, 'font-weight': 800, fill: INK, direction: 'ltr' });
      bands.forEach(function (b) { S.add('rect', { x: x0 + b[0] * w, y: y, width: (b[1] - b[0]) * w, height: 22, fill: b[3], stroke: '#fff' }); S.text(x0 + (b[0] + b[1]) / 2 * w, y + 15, b[2], { 'font-size': 9.5, 'font-weight': 800, fill: '#fff', 'text-anchor': 'middle', direction: 'ltr' }); });
      S.poly([[x0 + pos * w, y - 2], [x0 + pos * w - 7, y - 13], [x0 + pos * w + 7, y - 13]], { fill: INK }); box(S, x0 + pos * w, y - 20, lab);
      if (posC != null && isFinite(posC)) { var px = x0 + SH.clamp(posC, 0, 1) * w; S.poly([[px, y + 24], [px - 7, y + 35], [px + 7, y + 35]], { fill: '#fff', stroke: INK, 'stroke-width': 1.4 }); box(S, px, y + 52, labC, { 'font-weight': 600, fill: MUT, box: MUT }); }
    };
    var cols = ['#B23A2E', '#D9822B', '#C9A227', '#6C8F2E', '#2E7D5B'];
    bar(80, 'RMR89 (0–100)', [[0, .2, 'V', cols[0]], [.21, .4, 'IV', cols[1]], [.41, .6, 'III', cols[2]], [.61, .8, 'II', cols[3]], [.81, 1, 'I', cols[4]]], r.rmr / 100, r.RMRq / 100, 'RMR89 = ' + r.rmr, '9 lnQ + 44 = ' + SH.fmt(r.RMRq, 0));
    var lq = function (q) { return (Math.log10(Math.max(q, 1e-3)) + 3) / 6; }, qb = [[0.001, 0.01, 'Exc. poor'], [0.01, 0.1, 'Ext. poor'], [0.1, 1, 'V. poor'], [1, 4, 'Poor'], [4, 10, 'Fair'], [10, 40, 'Good'], [40, 100, 'V. good'], [100, 400, 'Ext. good'], [400, 1000, 'Exc.']], qc = ['#7A1F1A', '#B23A2E', '#D05A2A', '#D9822B', '#C9A227', '#8FAF3A', '#6C8F2E', '#2E7D5B', '#1F5E46'];
    bar(220, 'Q-system (logarithmic, 0.001–1000)', qb.map(function (b, i) { return [lq(b[0]), lq(b[1]), b[2], qc[i]]; }), lq(r.Q), lq(r.Qr), 'Q = ' + SH.fmt(r.Q, r.Q < 1 ? 3 : 2), 'exp[(RMR − 44)/9] = ' + SH.fmt(r.Qr, r.Qr < 1 ? 3 : 1));
    [0.001, 0.01, 0.1, 1, 10, 100, 1000].forEach(function (q) { S.text(x0 + lq(q) * w, 220 + 70, String(q), { 'font-size': 9, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); });
    bar(360, 'GSI (0–100)', [[0, .2, 'Very poor', cols[0]], [.2, .35, 'Poor', cols[1]], [.35, .55, 'Fair', cols[2]], [.55, .75, 'Good', cols[3]], [.75, 1, 'Very good', cols[4]]], r.gsi / 100, isFinite(r.gsiR) ? r.gsiR / 100 : null, 'GSI = ' + SH.fmt(r.gsi, 0), 'RMR89′ − 5 = ' + SH.fmt(r.gsiR, 0));
    var rc = pick(RMRC, r.rmr), qcl = pick(QC, r.Q), gc = pick(GC, r.gsi);
    $('#capM1').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>σci = ' + SH.fmt(r.sci, 0) + ' MPa، RQD = ' + SH.fmt(r.rqd, 0) + ' %، S = ' + SH.fmt(r.spc, 2) + ' m، Jn = ' + r.Qp.Jn + '، Jr = ' + r.Qp.Jr + '، Ja = ' + r.Qp.Ja + '، Jw = ' + r.Qp.Jw + '، SRF = ' + r.Qp.SRF + '، JCond89 = ' + r.p[3] + '.' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>RMR89 = ' + r.rmr + ' (' + t('class ', 'الصنف ') + rc[1] + ' · ' + rc[2] + ')، Q = ' + SH.fmt(r.Q, r.Q < 1 ? 3 : 2) + ' (' + qcl[1] + ')، GSI = 1.5 JCond89 + RQD/2 = ' + SH.fmt(r.gsi, 0) + ' (' + gc[1] + ').' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (Math.abs(r.RMRq - r.rmr) <= 10 ? t('the three systems agree within the scatter of the Bieniawski (1976) correlation RMR ≈ 9 lnQ + 44 (±10).', 'تتفق الأنظمة الثلاثة ضمن تشتت ارتباط Bieniawski (1976) RMR ≈ 9 lnQ + 44 (±10).') : t('RMR and Q differ by more than the ±10 scatter of the correlation; ', 'يختلف RMR وQ بأكثر من تشتت الارتباط ±10؛ ') + (r.RMRq < r.rmr ? t('Q is penalised by Jw, SRF or clay alteration (Ja), which RMR weights less.', 'إذ يتأثر Q بعوامل Jw أو SRF أو تغير الطين (Ja) التي يقل وزنها في RMR.') : t('RMR is penalised by spacing or groundwater more than Q.', 'إذ يتأثر RMR بالتباعد أو المياه الجوفية أكثر من Q.')));
  }

  /* ---------- 2. Hoek–Brown σ1–σ3 */
  function hbS1(r, s3) { return s3 + r.sci * Math.pow(r.mb * s3 / r.sci + r.s, r.a); }
  function drawM2(r) {
    var S = SH.svgB('svgM2'); frame(S, 760, 500, 'Generalised Hoek–Brown criterion (2002) · GSI ' + SH.fmt(r.gsi, 0) + ' · mi ' + r.mi + ' · D ' + r.D + ' · σci ' + SH.fmt(r.sci, 0) + ' MPa');
    var s3a = r.st, s3b = Math.max(r.s3max * 1.3, r.sci * 0.02), pts = [], mc = [], N = 80;
    for (var i = 0; i <= N; i++) { var s3 = s3a + (s3b - s3a) * i / N; pts.push([s3, hbS1(r, s3)]); }
    var sp = Math.sin(SH.rad(r.phi)), k = (1 + sp) / (1 - sp), sc = 2 * r.c * Math.cos(SH.rad(r.phi)) / (1 - sp);
    for (i = 0; i <= N; i++) { s3 = s3a + (s3b - s3a) * i / N; mc.push([s3, sc + k * s3]); }
    var ymax = Math.max(pts[N][1], mc[N][1]) * 1.08, A = axes(S, { x0: 90, y0: 56, w: 450, h: 360, xmin: Math.min(s3a, 0) * 1.1, xmax: s3b, ymin: 0, ymax: ymax, xlab: 'Minor principal stress σ3 (MPa)', ylab: 'Major principal stress σ1 (MPa)' });
    S.path(pathOf(pts.map(function (p) { return [A.X(p[0]), A.Y(Math.max(0, p[1]))]; })), { fill: 'none', stroke: HB, 'stroke-width': 2.4 });
    S.path(pathOf(mc.filter(function (p) { return p[0] >= 0; }).map(function (p) { return [A.X(p[0]), A.Y(p[1])]; })), { fill: 'none', stroke: MC, 'stroke-width': 2, 'stroke-dasharray': '8 4' });
    S.line(A.X(r.s3max), 56, A.X(r.s3max), 416, { stroke: MUT, 'stroke-dasharray': '3 3' }); halo(S, A.X(r.s3max) + 4, 70, 'σ3max = ' + SH.fmt(r.s3max, 2) + ' MPa', { 'font-size': 10, fill: MUT });
    S.circle(A.X(0), A.Y(r.sc), 4, { fill: HB }); halo(S, A.X(0) + 8, A.Y(r.sc) - 6, 'σc = ' + SH.fmt(r.sc, 2) + ' MPa', { 'font-size': 10, fill: HB });
    legend(S, 560, 56, 186, [[sLine(S, HB, 2.4), 'Hoek–Brown envelope'], [sLine(S, MC, 2, '8 4'), 'Equivalent Mohr–Coulomb'], [function () {}, 'mb = ' + SH.fmt(r.mb, 3)], [function () {}, 's = ' + r.s.toExponential(2)], [function () {}, 'a = ' + SH.fmt(r.a, 3)], [function () {}, 'σt = ' + SH.fmt(r.st, 3) + ' MPa'], [function () {}, "c′ = " + SH.fmt(r.c * 1000, 0) + ' kPa'], [function () {}, "φ′ = " + SH.fmt(r.phi, 1) + '°'], [function () {}, 'σcm = ' + SH.fmt(r.scm, 2) + ' MPa'], [function () {}, 'Erm = ' + SH.fmt(r.Erm / 1000, 2) + ' GPa']]);
    $('#capM2').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>σci = ' + SH.fmt(r.sci, 1) + ' MPa، mi = ' + r.mi + '، GSI = ' + SH.fmt(r.gsi, 0) + '، D = ' + r.D + '، γ = ' + r.gam + ' kN/m³، H = ' + r.H + ' m.' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>mb = ' + SH.fmt(r.mb, 3) + '، s = ' + r.s.toExponential(2) + '، a = ' + SH.fmt(r.a, 3) + t('; uniaxial strength of the mass σc = σci·s^a = ', '؛ ومقاومة الكتلة أحادية المحور σc = σci·s^a = ') + SH.fmt(r.sc, 2) + ' MPa' + t(', global strength σcm = ', '، والمقاومة الإجمالية σcm = ') + SH.fmt(r.scm, 2) + ' MPa' + t('; fitted over 0 ≤ σ3 ≤ σ3max = ', '؛ والملاءمة على المدى 0 ≤ σ3 ≤ σ3max = ') + SH.fmt(r.s3max, 2) + " MPa: c′ = " + SH.fmt(r.c * 1000, 0) + " kPa، φ′ = " + SH.fmt(r.phi, 1) + '°.' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + t('the rock mass retains ', 'تحتفظ الكتلة الصخرية بـ ') + SH.fmt(100 * r.sc / r.sci, 1) + t(' % of the intact uniaxial strength; c′ and φ′ are valid for ', ' % من مقاومة الصخر السليم أحادية المحور؛ وتصلح c′ وφ′ ') + (r.tun ? t('a tunnel at the given depth', 'لنفق على العمق المحدد') : t('a slope of the given height', 'لمنحدر بالارتفاع المحدد')) + t(' (Hoek et al. 2002) and should not be extrapolated to other stress ranges.', ' (Hoek et al. 2002) ولا يجوز استقراؤها لمدى إجهادات آخر.');
  }

  /* ---------- 3. τ–σn envelope (Balmer 1952) */
  function drawM3(r) {
    var S = SH.svgB('svgM3'); frame(S, 760, 500, 'Shear strength of the rock mass · Hoek–Brown (Balmer 1952 transformation) and Mohr–Coulomb fit');
    var pts = [], N = 90, s3b = Math.max(r.s3max * 1.3, r.sci * 0.02);
    for (var i = 1; i <= N; i++) { var s3 = r.st + (s3b - r.st) * i / N, s1 = hbS1(r, s3), d = 1 + r.a * r.mb * Math.pow(r.mb * s3 / r.sci + r.s, r.a - 1), sn = (s1 + s3) / 2 - (s1 - s3) / 2 * (d - 1) / (d + 1), tau = (s1 - s3) * Math.sqrt(d) / (d + 1); if (isFinite(sn) && isFinite(tau)) pts.push([sn, tau]); }
    var xmax = pts[pts.length - 1][0], ymax = Math.max(pts[pts.length - 1][1], r.c + xmax * Math.tan(SH.rad(r.phi))) * 1.08;
    var A = axes(S, { x0: 90, y0: 56, w: 450, h: 360, xmin: Math.min(0, pts[0][0]) * 1.1, xmax: xmax, ymin: 0, ymax: ymax, xlab: 'Normal stress σn (MPa)', ylab: 'Shear stress τ (MPa)' });
    S.path(pathOf(pts.map(function (p) { return [A.X(p[0]), A.Y(p[1])]; })), { fill: 'none', stroke: HB, 'stroke-width': 2.4 });
    S.line(A.X(0), A.Y(r.c), A.X(xmax), A.Y(Math.min(ymax, r.c + xmax * Math.tan(SH.rad(r.phi)))), { stroke: MC, 'stroke-width': 2, 'stroke-dasharray': '8 4' });
    S.circle(A.X(0), A.Y(r.c), 4, { fill: MC }); halo(S, A.X(0) + 8, A.Y(r.c) - 8, "c′ = " + SH.fmt(r.c * 1000, 0) + ' kPa', { 'font-size': 10, fill: MC });
    var ax = A.X(xmax * .62), ay = A.Y(r.c + xmax * .62 * Math.tan(SH.rad(r.phi))); halo(S, ax + 10, ay + 22, "φ′ = " + SH.fmt(r.phi, 1) + '°', { 'font-size': 11, fill: MC });
    legend(S, 560, 56, 186, [[sLine(S, HB, 2.4), 'Hoek–Brown τ(σn)'], [sLine(S, MC, 2, '8 4'), "τ = c′ + σn tanφ′"]]);
    $('#capM3').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('the Hoek–Brown parameters of figure 2.', 'معاملات Hoek–Brown في الشكل 2.') + '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('the curved shear-strength envelope τ(σn) and its linear equivalent τ = c′ + σn tanφ′ with c′ = ', 'غلاف مقاومة القص المنحني τ(σn) ومكافئه الخطي τ = c′ + σn tanφ′ حيث c′ = ') + SH.fmt(r.c * 1000, 0) + " kPa، φ′ = " + SH.fmt(r.phi, 1) + '°.' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + t('these are the rock-mass parameters to use in limit-equilibrium or numerical analyses of failure through the mass (circular or non-structurally controlled failure); failure along discrete joints uses the joint friction angle instead.', 'هذه معاملات الكتلة الصخرية التي تُستخدم في تحليلات التوازن الحدّي أو التحليلات العددية للانهيار عبر الكتلة (الانهيار الدائري أو غير المتحكم به تركيبياً)؛ أما الانهيار على فواصل منفردة فيستخدم زاوية احتكاك الفواصل.');
  }

  /* ---------- 4. Q-slope */
  function drawM4(r) {
    var S = SH.svgB('svgM4'); frame(S, 760, 500, 'Q-slope (Bar & Barton 2017) · β = 20 log10(Q-slope) + 65');
    var A = axes(S, { x0: 90, y0: 56, w: 450, h: 360, xmin: -3, xmax: 2, ymin: 0, ymax: 90, xlab: 'Q-slope (logarithmic)', ylab: 'Slope angle (°)', xlog: true });
    var line = [], under = [], over = [];
    for (var lq = -3; lq <= 2.0001; lq += 0.05) { var b = SH.clamp(20 * lq + 65, 0, 90); line.push([A.X(Math.pow(10, lq)), A.Y(b)]); }
    S.path(pathOf([[A.X(1e-3), A.Y(90)]].concat(line).concat([[A.X(100), A.Y(90)]])), { fill: SH.alpha(CRIT, .1), stroke: 'none' });
    S.path(pathOf(line), { fill: 'none', stroke: INK, 'stroke-width': 2.2 });
    halo(S, A.X(0.02) + 6, A.Y(70), 'Unstable', { fill: CRIT }); halo(S, A.X(10), A.Y(40), 'Stable', { fill: '#2E7D5B' });
    var qx = SH.clamp(r.Qs, 1e-3, 100), bx = A.X(qx);
    S.circle(bx, A.Y(SH.clamp(r.beta, 0, 90)), 6, { fill: '#fff', stroke: INK, 'stroke-width': 2 }); halo(S, bx + 10, A.Y(SH.clamp(r.beta, 0, 90)) + 16, 'β = ' + SH.fmt(r.beta, 1) + '°', { fill: INK });
    var ok = isFinite(r.slope) ? r.slope <= r.beta : null;
    if (isFinite(r.slope)) { S.circle(bx, A.Y(r.slope), 6, { fill: ok ? '#2E7D5B' : CRIT, stroke: '#fff', 'stroke-width': 1.4 }); halo(S, bx - 10, A.Y(r.slope) + (Math.abs(r.slope - r.beta) < 6 ? (r.slope < r.beta ? 18 : -10) : 4), 'Design ' + r.slope + '°', { fill: ok ? '#2E7D5B' : CRIT, 'text-anchor': 'end' }); }
    legend(S, 560, 56, 186, [[sLine(S, INK, 2.2), 'β = 20 log Q-slope + 65'], [function (x, y) { S.add('rect', { x: x, y: y - 7, width: 28, height: 14, fill: SH.alpha(CRIT, .15) }); }, 'Unstable domain'], [function (x, y) { S.circle(x + 14, y, 4.5, { fill: '#fff', stroke: INK, 'stroke-width': 1.6 }); }, 'Steepest stable angle β'], [sDot(S, '#2E7D5B'), 'Design slope angle'], [function () {}, 'Q-slope = ' + SH.fmt(r.Qs, r.Qs < 1 ? 3 : 2)]]);
    $('#capM4').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>Q-slope = (RQD/Jn)·(Jr/Ja)·O·(Jwice/SRFslope) = (' + SH.fmt(Math.max(r.rqd, 10), 0) + '/' + r.Qp.Jn + ')·(' + r.Qp.Jr + '/' + r.Qp.Ja + ')·' + r.Qp.O + '·(' + r.Qp.Jwice + '/' + r.Qp.SRFs + ').' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>Q-slope = ' + SH.fmt(r.Qs, r.Qs < 1 ? 3 : 2) + t('; steepest slope angle not requiring reinforcement β = ', '؛ وأشد زاوية منحدر لا تحتاج إلى تدعيم β = ') + SH.fmt(r.beta, 1) + '°.' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (ok == null ? '' : ok ? t('the design angle of ', 'زاوية التصميم ') + r.slope + t('° is below β and falls in the stable domain of the Q-slope chart.', '° أقل من β وتقع في نطاق الاستقرار في مخطط Q-slope.') : t('the design angle of ', 'زاوية التصميم ') + r.slope + t('° exceeds β by ', '° تتجاوز β بمقدار ') + SH.fmt(r.slope - r.beta, 1) + t('°; the slope requires flattening or reinforcement.', '°؛ ويحتاج المنحدر إلى تخفيف الميل أو التدعيم.'));
  }

  /* ---------- 5. RMR bars */
  function drawM5(r) {
    var S = SH.svgB('svgM5'); frame(S, 760, 330, 'RMR89 (Bieniawski 1989) · rating / maximum');
    var names = ['A1 Intact strength', 'A2 RQD', 'A3 Spacing', 'A4 Condition', 'A5 Groundwater'], mx = [15, 20, 20, 30, 15], x0 = 200, wm = 400;
    var det = ['σci ' + SH.fmt(r.sci, 0) + ' MPa', 'RQD ' + SH.fmt(r.rqd, 0) + ' %', 'S = ' + SH.fmt(r.spc, 2) + ' m', 'P' + r.sub[0] + ' · A' + r.sub[1] + ' · R' + r.sub[2] + ' · I' + r.sub[3] + ' · W' + r.sub[4], ''];
    r.p.forEach(function (v, i) { var y = 50 + i * 50, f = v / mx[i], col = f < .4 ? CRIT : f < .7 ? '#C9A227' : '#2E7D5B';
      S.text(x0 - 12, y + 18, names[i], { 'font-size': 12, 'font-weight': 700, fill: INK, 'text-anchor': 'end', direction: 'ltr' }); if (det[i]) S.text(x0 - 12, y + 33, det[i], { 'font-size': 9.5, fill: MUT, 'text-anchor': 'end', direction: 'ltr' });
      S.add('rect', { x: x0, y: y + 4, width: wm, height: 22, rx: 4, fill: '#EEF0F2' }); S.add('rect', { x: x0, y: y + 4, width: Math.max(2, wm * f), height: 22, rx: 4, fill: col }); S.text(x0 + wm + 12, y + 20, v + ' / ' + mx[i], { 'font-size': 12, 'font-weight': 800, fill: INK, direction: 'ltr' }); });
    var low = r.p.map(function (v, i) { return [v / mx[i], i]; }).sort(function (a, b) { return a[0] - b[0]; })[0], nm = [t('intact rock strength', 'مقاومة الصخر السليم'), 'RQD', t('discontinuity spacing', 'تباعد الانقطاعات'), t('discontinuity condition', 'حالة الانقطاعات'), t('groundwater', 'المياه الجوفية')];
    $('#capM5').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>A1 = ' + r.p[0] + '، A2 = ' + r.p[1] + '، A3 = ' + r.p[2] + '، A4 = ' + r.p[3] + '، A5 = ' + r.p[4] + '.<br><b>' + t('Output: ', 'المخرجات: ') + '</b>RMR89 = ' + r.rmr + t('; basic RMR in dry conditions RMR89′ = ', '؛ وRMR الأساسي في الظروف الجافة RMR89′ = ') + r.rmrDry + '.<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + t('the controlling parameter is ', 'المعامل المتحكم هو ') + nm[low[1]] + ' (' + Math.round(low[0] * 100) + ' %).';
  }

  /* ---------- outputs */
  var MATH = /[A-Za-z0-9ψφξβδαγκΣπστ(\[|][A-Za-z0-9ψφξβδαγκΣπστ°′″±+\-−×()=\/·∩→≤≥<>.,%²³\[\]|^ ]*[A-Za-z0-9ψφξβδαγκΣπστ°′″)%²³\]]|[A-Za-z0-9]/g;
  function fixNode(root) {
    if (!AR) { root.innerHTML = root.innerHTML.replace(/،/g, ','); return; }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n; while ((n = w.nextNode())) if (!n.parentNode.closest('bdi')) list.push(n);
    list.forEach(function (tn) { var txt = tn.nodeValue, out = document.createDocumentFragment(), lst = 0; txt.replace(MATH, function (m, off) { if (off > lst) out.appendChild(document.createTextNode(txt.slice(lst, off))); var b = document.createElement('bdi'); b.dir = 'ltr'; b.textContent = m; out.appendChild(b); lst = off + m.length; return m; }); if (!lst) return; if (lst < txt.length) out.appendChild(document.createTextNode(txt.slice(lst))); tn.parentNode.replaceChild(out, tn); });
  }
  function kpi(c, k, v, s) { return '<div class="kpi ' + (c || '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function render(r) {
    last = r; $('#mEmpty').hidden = true; $('#mOut').hidden = false;
    var rc = pick(RMRC, r.rmr), qc = pick(QC, r.Q), gc = pick(GC, r.gsi), st = function (v, a, b) { return v >= a ? 'ok' : v >= b ? 'warn' : 'bad'; };
    $('#mKpis').innerHTML = kpi(st(r.rmr, 61, 41), 'RMR<sub>89</sub>', r.rmr + '<small> /100</small>', t('Class ', 'الصنف ') + rc[1] + ' · ' + rc[2]) + kpi(st(r.Q, 10, 1), 'Q', SH.fmt(r.Q, r.Q < 1 ? 3 : 2), qc[1]) + kpi(st(r.gsi, 55, 35), 'GSI', SH.fmt(r.gsi, 0), gc[1]) +
      (r.tun ? '' : kpi(isFinite(r.slope) ? (r.slope <= r.beta ? 'ok' : 'bad') : '', t('Q-slope angle β', 'زاوية Q-slope β'), SH.fmt(r.beta, 1) + '<small>°</small>', 'Q-slope ' + SH.fmt(r.Qs, r.Qs < 1 ? 3 : 2))) +
      kpi('', "c′ · φ′", SH.fmt(r.c * 1000, 0) + '<small> kPa</small> · ' + SH.fmt(r.phi, 1) + '<small>°</small>', t('Equivalent Mohr–Coulomb', 'مكافئ Mohr–Coulomb')) + kpi('', 'Erm', SH.fmt(r.Erm / 1000, 2) + '<small> GPa</small>', 'σcm ' + SH.fmt(r.scm, 1) + ' MPa');
    var row = function (a, b, c, d) { return '<tr><td><b>' + a + '</b></td><td class="ltr">' + b + '</td><td>' + c + '</td><td class="xsmall">' + d + '</td></tr>'; };
    $('#mTab').innerHTML = '<thead><tr><th>' + t('Parameter', 'المعامل') + '</th><th>' + t('Value', 'القيمة') + '</th><th>' + t('Class or meaning', 'الصنف أو الدلالة') + '</th><th>' + t('Reference', 'المرجع') + '</th></tr></thead><tbody>' +
      row('RMR89', r.p.join(' + ') + ' = ' + r.rmr, t('Class ', 'الصنف ') + rc[1] + ' · ' + rc[2], 'Bieniawski (1989)') +
      row('Q', '(' + SH.fmt(Math.max(r.rqd, 10), 0) + '/' + r.Qp.Jn + ')(' + r.Qp.Jr + '/' + r.Qp.Ja + ')(' + r.Qp.Jw + '/' + r.Qp.SRF + ') = ' + SH.fmt(r.Q, r.Q < 1 ? 3 : 2), qc[1], 'Barton et al. (1974); NGI (2015)') +
      row('Q-slope · β', SH.fmt(r.Qs, r.Qs < 1 ? 3 : 2) + ' · ' + SH.fmt(r.beta, 1) + '°', t('Steepest unreinforced slope angle', 'أشد زاوية منحدر دون تدعيم'), 'Bar & Barton (2017)') +
      row('GSI', '1.5 × ' + r.p[3] + ' + ' + SH.fmt(r.rqd, 0) + '/2 = ' + SH.fmt(r.gsi, 0) + (isFinite(r.gsiR) ? ' (RMR89′ − 5 = ' + SH.fmt(r.gsiR, 0) + ')' : ''), gc[1], 'Hoek et al. (2013); Hoek et al. (1995)') +
      row('mb · s · a', SH.fmt(r.mb, 3) + ' · ' + r.s.toExponential(2) + ' · ' + SH.fmt(r.a, 3), 'mi = ' + r.mi + ', D = ' + r.D, 'Hoek et al. (2002)') +
      row('σc · σcm · σt', SH.fmt(r.sc, 2) + ' · ' + SH.fmt(r.scm, 2) + ' · ' + SH.fmt(r.st, 3) + ' MPa', t('Rock-mass strengths', 'مقاومات الكتلة الصخرية'), 'Hoek et al. (2002)') +
      row("c′ · φ′", SH.fmt(r.c * 1000, 0) + ' kPa · ' + SH.fmt(r.phi, 1) + '°', 'σ3max = ' + SH.fmt(r.s3max, 3) + ' MPa', 'Hoek et al. (2002)') +
      row('Erm', SH.fmt(r.Erm, 0) + ' MPa', t('Rock-mass deformation modulus', 'معامل تشوه الكتلة الصخرية'), 'Hoek & Diederichs (2006)') +
      (r.tun && r.De ? row(t('Tunnel', 'النفق'), 'De = ' + SH.fmt(r.De, 1) + ' m · L = ' + SH.fmt(r.Lb, 1) + ' m · Smax = ' + SH.fmt(r.spanMax, 1) + ' m', t('Equivalent dimension, bolt length, max. unsupported span', 'البعد المكافئ وطول المسمار وأقصى فتحة دون تدعيم'), 'Barton et al. (1974)') : '') + '</tbody>';
    drawM1(r); drawM2(r); drawM3(r); $('#qsWrap').hidden = r.tun; if (!r.tun) drawM4(r); drawM5(r);
    ['#capM1', '#capM2', '#capM3', '#capM4', '#capM5'].forEach(function (q) { fixNode($(q)); });
  }
  function run() { var r = analyse(); if (r) { store.save(); render(r); } return r; }
  $('#mRun').addEventListener('click', function () { if (run()) $('#mOut').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#mDemo').addEventListener('click', function () {
    var v = { mProject: t('Road cut, km 14', 'قطع طريق، كم 14'), mRock: '10', ucs: 85, rqd: 72, spc: 0.45, H: 15, gam: 26, slope: 65, mCase: 'slope', Dfac: '0.7', Jn: '9', Jr: '1.5', Ja: '2', Jw: '1', SRF: '1', rGw: '15', cPer: '4', cApe: '4', cRou: '3', cInf: '6', cWea: '5', Oa: '0.75', Jwice: '1', SRFs: '2.5' };
    for (var k in v) $('#' + k).value = v[k]; $('#is50').value = ''; $('#jv').value = ''; caseUI(); run();
  });
  document.addEventListener('sh:redraw', function () { if (last) render(last); });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Classify the rock mass first.', 'صنّف الكتلة الصخرية أولاً.'), 'warn'); } });
  SH.$$('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { SH.svgPng($('#' + b.getAttribute('data-svg')), 'shandal-' + b.getAttribute('data-svg') + '.png', 2); }); });
  caseUI(); if (num('ucs') > 0 && (num('rqd') >= 0 || num('jv') >= 0) && num('spc') > 0) run();
})();
