/* Mohr circle — 2-D stress transformation, principal stresses, stress on any plane, effective stress and
   Mohr–Coulomb safety; triaxial series fitted in p–q space (Lambe) to give c and φ. Compression positive. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, R = Math.PI / 180, mode = 'state', last = null;
  var ids = ['sx', 'sy', 'txy', 'th', 'mc', 'mphi', 'mu', 'triData'], persist = SH.persist('mohr', ids);
  document.addEventListener('click', function (e) { if (!e.target.closest('#mcMode button')) return; setTimeout(function () { mode = SH.seg('mcMode'); $('#mcState').hidden = mode !== 'state'; $('#mcTri').hidden = mode === 'state'; run(); }, 0); });
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var row = function (k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; }, f1 = function (v) { return SH.fmt(v, 1); };

  function frame(S, circles, env, extra) {
    var W = 900, H = 520, ml = 70, mr = 30, mt = 30, mb = 50, c = SH.palette(), ink = c.text;
    var lo = Math.min(0, Math.min.apply(null, circles.map(function (q) { return q.C - q.R; }))), hi = Math.max.apply(null, circles.map(function (q) { return q.C + q.R; }));
    if (env && env.phi > 0 && env.c > 0) lo = Math.min(lo, -env.c / Math.tan(env.phi * R) * 0.6);
    var span = (hi - lo) * 1.08 || 1, tmax = Math.max.apply(null, circles.map(function (q) { return q.R; })) * 1.25 || 1;
    var sc = Math.min((W - ml - mr) / span, (H - mt - mb) / (2 * tmax)), x0 = ml + ((W - ml - mr) - span * sc) / 2 - (lo - span * 0.02) * sc, y0 = mt + (H - mt - mb) / 2;
    var X = function (s) { return x0 + s * sc; }, Y = function (tau) { return y0 - tau * sc; };
    S.add('rect', { x: 0, y: 0, width: W, height: H, fill: SH.css('--il-bg') });
    var raw = span / 8, pw = Math.pow(10, Math.floor(Math.log10(raw))), mm = raw / pw, step = (mm < 1.5 ? 1 : mm < 3.5 ? 2 : mm < 7.5 ? 5 : 10) * pw;
    for (var v = Math.ceil((lo - span * 0.02) / step) * step; X(v) < W - mr; v += step) { S.line(X(v), mt, X(v), H - mb, { stroke: c.line, 'stroke-width': .7 }); S.text(X(v), H - mb + 18, SH.fmt(v, 0), { 'font-size': 11, fill: c.text2, 'text-anchor': 'middle' }); }
    for (v = -Math.floor(tmax / step) * step; v <= tmax; v += step) { if (Y(v) < mt || Y(v) > H - mb) continue; S.line(ml, Y(v), W - mr, Y(v), { stroke: c.line, 'stroke-width': .7 }); S.text(ml - 8, Y(v) + 4, SH.fmt(v, 0), { 'font-size': 11, fill: c.text2, 'text-anchor': 'end' }); }
    S.line(ml, y0, W - mr, y0, { stroke: ink, 'stroke-width': 1.3 }); if (X(0) > ml) S.line(X(0), mt, X(0), H - mb, { stroke: ink, 'stroke-width': 1.3 });
    S.text(W - mr, y0 - 8, 'σ (kPa)', { 'font-size': 12, fill: ink, 'text-anchor': 'end', 'font-weight': 700 }); S.text(Math.max(ml, X(0)) + 8, mt + 12, 'τ (kPa)', { 'font-size': 12, fill: ink, 'font-weight': 700 });
    if (env) { var a = Math.tan(env.phi * R), sA = env.phi > 0 ? -env.c / a : lo, sB = hi + span; [1, -1].forEach(function (sg) { S.line(X(Math.max(sA, lo - span)), Y(sg * (env.c + a * Math.max(sA, lo - span))), X(sB), Y(sg * (env.c + a * sB)), { stroke: '#B4552D', 'stroke-width': 2, 'stroke-dasharray': sg < 0 ? '6 5' : null }); });
      S.text(X(hi * 0.9), Y(env.c + a * hi * 0.9) - 10, 'τ = c + σ tanφ', { 'font-size': 12, fill: '#B4552D', 'font-weight': 700, 'text-anchor': 'middle' }); }
    return { X: X, Y: Y, sc: sc, ink: ink, c: c };
  }

  function runState() {
    var sx = SH.num('sx'), sy = SH.num('sy'), tx = SH.num('txy') || 0, th = SH.num('th') || 0, c = SH.num('mc') || 0, phi = SH.num('mphi') || 0, u = SH.num('mu') || 0;
    if (isNaN(sx) || isNaN(sy)) return; $('#thOut').textContent = th + '°';
    var C = (sx + sy) / 2, Rr = Math.hypot((sx - sy) / 2, tx), s1 = C + Rr, s3 = C - Rr, tp = 0.5 * Math.atan2(2 * tx, sx - sy) / R;
    var st = C + (sx - sy) / 2 * Math.cos(2 * th * R) + tx * Math.sin(2 * th * R), tt = -(sx - sy) / 2 * Math.sin(2 * th * R) + tx * Math.cos(2 * th * R);
    var Ce = C - u, FS = phi > 0 ? (Ce + c / Math.tan(phi * R)) * Math.sin(phi * R) / Rr : c / Rr, mob = phi > 0 ? Math.asin(Math.min(1, Rr / (Ce + c / Math.tan(phi * R)))) / R : NaN;
    var tf = c + (st - u) * Math.tan(phi * R), FSp = Math.abs(tt) > 1e-9 ? tf / Math.abs(tt) : Infinity;
    last = { sx: sx, sy: sy, tx: tx, C: C, R: Rr, s1: s1, s3: s3, tp: tp, st: st, tt: tt, FS: FS };
    $('#mcKpis').innerHTML = kpi('info', 'σ<sub>1</sub> · σ<sub>3</sub>', f1(s1) + ' · ' + f1(s3) + '<small> kPa</small>', t('σ₁ plane at ', 'مستوي σ₁ عند ') + SH.fmt(tp, 1) + '°') + kpi('', 'τ<sub>max</sub>', f1(Rr) + '<small> kPa</small>', t('on planes at ', 'على مستويات عند ') + SH.fmt(tp + 45, 1) + '°') +
      kpi('', 'σ<sub>θ</sub> · τ<sub>θ</sub>', f1(st) + ' · ' + f1(tt), 'θ = ' + th + '°') + kpi(FS < 1 ? 'bad' : FS < 1.5 ? 'warn' : 'ok', t('Safety factor', 'معامل الأمان'), isFinite(FS) ? SH.fmt(FS, 2) : '∞', t('circle vs envelope', 'الدائرة مقابل الغلاف')) + kpi('', t('Mobilised φ', 'φ المعبأة'), isNaN(mob) ? '—' : SH.fmt(mob, 1) + '°', 'p′ = ' + f1(Ce) + ' kPa');
    $('#mcVerd').innerHTML = FS < 1 ? verdict('bad', t('Failure', 'انهيار'), t('The circle crosses the Mohr–Coulomb envelope: the material fails on planes inclined at 45° + φ/2 = ', 'الدائرة تقطع غلاف موهر–كولوم: تنهار المادة على مستويات مائلة بـ 45° + φ/2 = ') + SH.fmt(45 + phi / 2, 1) + t('° to the σ₃ direction.', '° عن اتجاه σ₃.')) :
      verdict(FS < 1.5 ? 'warn' : 'ok', t('Stable stress state', 'حالة إجهاد مستقرة'), t('The circle stays below the envelope with a margin of ', 'تبقى الدائرة تحت الغلاف بهامش ') + SH.fmt((FS - 1) * 100, 0) + t(' % on radius.', ' % على نصف القطر.') + (u > 0 ? ' ' + t('Pore pressure shifts the circle left by u = ', 'يزيح ضغط المسام الدائرة يساراً بمقدار u = ') + u + ' kPa.' : ''));
    var S = SH.svgB('mcSvg'), F = frame(S, [{ C: C, R: Rr }, { C: Ce, R: Rr }], { c: c, phi: phi }), X = F.X, Y = F.Y, sc = F.sc;
    if (u) S.circle(X(C), Y(0), Rr * sc, { fill: 'none', stroke: F.c.text3, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' });
    S.circle(X(Ce), Y(0), Rr * sc, { fill: SH.alpha('#2F7F7C', .1), stroke: '#2F7F7C', 'stroke-width': 2.5 });
    var px = X(sx - u), py = Y(tx), qx = X(sy - u), qy = Y(-tx); S.line(px, py, qx, qy, { stroke: F.c.text2, 'stroke-width': 1, 'stroke-dasharray': '3 3' });
    S.circle(px, py, 5, { fill: '#1B232B' }); S.text(px + 8, py - 6, 'X (σx, τxy)', { 'font-size': 11, fill: F.ink }); S.circle(qx, qy, 5, { fill: '#1B232B' }); S.text(qx + 8, qy + 14, 'Y (σy, −τxy)', { 'font-size': 11, fill: F.ink });
    S.circle(X(s1 - u), Y(0), 5, { fill: '#9A7631' }); S.text(X(s1 - u) + 6, Y(0) + 16, 'σ′₁', { 'font-size': 12, 'font-weight': 700, fill: '#7E5F22' }); S.circle(X(s3 - u), Y(0), 5, { fill: '#9A7631' }); S.text(X(s3 - u) - 6, Y(0) + 16, 'σ′₃', { 'font-size': 12, 'font-weight': 700, fill: '#7E5F22', 'text-anchor': 'end' });
    S.line(X(Ce), Y(0), X(st - u), Y(tt), { stroke: '#B4552D', 'stroke-width': 1.5 }); S.circle(X(st - u), Y(tt), 7, { fill: '#B4552D', stroke: '#fff', 'stroke-width': 2 }); S.text(X(st - u) + 10, Y(tt) - 8, 'θ = ' + SH.fmt(+SH.val('th'), 0) + '°', { 'font-size': 12, 'font-weight': 700, fill: '#B4552D' });
    if (phi > 0) { var tx2 = Ce - Rr * Math.sin(phi * R), ty2 = Rr * Math.cos(phi * R); S.circle(X(tx2), Y(ty2), 4, { fill: 'none', stroke: '#B4552D', 'stroke-width': 1.5 }); }
    $('#mcCap').innerHTML = t('Solid circle: effective stresses. ', 'الدائرة المتصلة: الإجهادات الفعالة. ') + (u ? t('Dashed: total stresses. ', 'المتقطعة: الإجهادات الكلية. ') : '') + t('A rotation θ of the plane moves the point 2θ around the circle.', 'دوران المستوي بزاوية θ يحرك النقطة 2θ حول الدائرة.');
    $('#mcTblH').textContent = t('Results', 'النتائج');
    $('#mcTbl').innerHTML = row(t('Centre C · radius R', 'المركز C · نصف القطر R'), f1(C) + ' · ' + f1(Rr) + ' kPa') + row(t('Principal stresses', 'الإجهادات الرئيسية'), 'σ₁ = ' + f1(s1) + ', σ₃ = ' + f1(s3) + ' kPa') + row(t('Principal direction', 'الاتجاه الرئيسي'), 'θ<sub>p</sub> = ' + SH.fmt(tp, 2) + '° ' + t('from the x-face', 'من وجه x')) +
      row(t('Stress on the plane θ', 'الإجهاد على المستوي θ'), 'σ = ' + f1(st) + ', τ = ' + f1(tt) + ' kPa') + row(t('Shear strength on that plane', 'مقاومة القص على ذلك المستوي'), 'τ<sub>f</sub> = ' + f1(tf) + ' kPa · FS = ' + (isFinite(FSp) ? SH.fmt(FSp, 2) : '∞')) + row(t('Theoretical failure plane', 'مستوي الانهيار النظري'), '45° + φ/2 = ' + SH.fmt(45 + phi / 2, 1) + '° ' + t('from the σ₁ plane', 'من مستوي σ₁'));
  }
  function runTri() {
    var rows = SH.val('triData').split('\n').map(function (l) { var p = l.split(/[,;\s]+/).map(parseFloat); return p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]) && p[1] > p[0] ? { s3: p[0], s1: p[1] } : null; }).filter(Boolean);
    if (rows.length < 2) { $('#mcKpis').innerHTML = ''; $('#mcVerd').innerHTML = verdict('info', t('Enter at least two specimens', 'أدخل عينتين على الأقل'), t('Each line: σ₃, σ₁ at failure.', 'كل سطر: σ₃، σ₁ عند الانهيار.')); return; }
    var P = rows.map(function (r) { return (r.s1 + r.s3) / 2; }), Q = rows.map(function (r) { return (r.s1 - r.s3) / 2; }), n = rows.length, mp = P.reduce(function (a, b) { return a + b; }) / n, mq = Q.reduce(function (a, b) { return a + b; }) / n;
    var sxy = 0, sxx = 0, syy = 0; for (var i = 0; i < n; i++) { sxy += (P[i] - mp) * (Q[i] - mq); sxx += Math.pow(P[i] - mp, 2); syy += Math.pow(Q[i] - mq, 2); }
    var tanA = sxx ? sxy / sxx : 0, a = mq - tanA * mp, phi = Math.asin(Math.max(-1, Math.min(1, tanA))) / R, c = a / Math.cos(phi * R), r2 = sxx && syy ? sxy * sxy / (sxx * syy) : 1;
    if (phi < 0) { phi = 0; c = mq; } if (c < 0) c = 0;
    last = { rows: rows, c: c, phi: phi };
    $('#mcKpis').innerHTML = kpi('info', t('Cohesion c', 'التماسك c'), SH.fmt(c, 1) + '<small> kPa</small>', 'c = a / cosφ') + kpi('info', t('Friction angle φ', 'زاوية الاحتكاك φ'), SH.fmt(phi, 1) + '<small>°</small>', 'sinφ = tanα') + kpi(r2 > 0.98 ? 'ok' : r2 > 0.9 ? 'warn' : 'bad', 'R²', SH.fmt(r2, 4), n + t(' specimens', ' عينات')) + kpi('', 'a · α', SH.fmt(a, 1) + ' kPa · ' + SH.fmt(Math.atan(tanA) / R, 2) + '°', t('p–q line', 'خط p–q'));
    $('#mcVerd').innerHTML = r2 < 0.95 ? verdict('warn', t('Scatter in the series', 'تشتت في السلسلة'), t('The specimens do not lie on one line. Check sample disturbance, drainage conditions or a curved envelope at high stress.', 'لا تقع العينات على خط واحد. تحقق من اضطراب العينات أو ظروف التصريف أو غلاف منحنٍ عند الإجهاد العالي.')) : verdict('ok', t('Consistent envelope', 'غلاف متسق'), t('The p–q points lie on a straight line, so a single Mohr–Coulomb envelope describes the series.', 'تقع نقاط p–q على خط مستقيم، لذا يصف غلاف موهر–كولوم واحد السلسلة.'));
    var S = SH.svgB('mcSvg'), F = frame(S, rows.map(function (r, i) { return { C: P[i], R: Q[i] }; }), { c: c, phi: phi }), cols = ['#2F7F7C', '#9A7631', '#2E78B7', '#7A4F9A', '#B4552D', '#3C7D4E'];
    rows.forEach(function (r, i) { var col = cols[i % cols.length]; S.path('M' + F.X(r.s3) + ' ' + F.Y(0) + ' A ' + Q[i] * F.sc + ' ' + Q[i] * F.sc + ' 0 0 1 ' + F.X(r.s1) + ' ' + F.Y(0), { fill: SH.alpha(col, .08), stroke: col, 'stroke-width': 2.2 }); S.circle(F.X(P[i]), F.Y(Q[i]), 4, { fill: col }); });
    var pts = [], pm = Math.max.apply(null, P) * 1.15; for (var k = 0; k <= 1; k++) pts.push([F.X(k * pm), F.Y(a + tanA * k * pm)]); S.path(S.pl(pts), { stroke: F.c.text2, 'stroke-width': 1.2, 'stroke-dasharray': '2 4', fill: 'none' });
    $('#mcCap').innerHTML = t('Upper half circles for each specimen; dots are the (p, q) tops fitted by the dotted K<sub>f</sub> line.', 'أنصاف دوائر علوية لكل عينة؛ النقاط هي قمم (p, q) المطابقة بخط K<sub>f</sub> المنقط.');
    $('#mcTblH').textContent = t('Specimens', 'العينات');
    $('#mcTbl').innerHTML = rows.map(function (r, i) { return row('#' + (i + 1) + ' · σ₃ = ' + f1(r.s3), 'σ₁ = ' + f1(r.s1) + ' · p = ' + f1(P[i]) + ' · q = ' + f1(Q[i]) + ' · σ₁/σ₃ = ' + SH.fmt(r.s1 / r.s3, 2)); }).join('');
  }
  function run() { persist.save(); if (mode === 'state') runState(); else runTri(); }
  ids.forEach(function (id) { $('#' + id).addEventListener('input', run); });
  $('#mcDemo').addEventListener('click', function () { if (mode === 'state') { var v = { sx: 180, sy: 60, txy: 45, th: 35, mc: 15, mphi: 32, mu: 20 }; for (var k in v) $('#' + k).value = v[k]; } else $('#triData').value = '50, 178\n100, 318\n200, 590\n300, 865'; run(); });
  document.addEventListener('sh:redraw', run);
  run();
})();
