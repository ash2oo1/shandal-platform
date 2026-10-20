/* Shallow-foundation bearing capacity — Terzaghi (1943), Meyerhof (1963) and Vesić (1973) with shape, depth and
   inclination factors, water-table correction, allowable loads and a Prandtl failure-mechanism sketch. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, R = Math.PI / 180, GW = 9.81;
  var ids = ['bShape', 'bB', 'bL', 'bDf', 'bBeta', 'bC', 'bPhi', 'bG', 'bGs', 'bDw', 'bFS'], persist = SH.persist('bearing', ids), last = null;
  var tan = function (d) { return Math.tan(d * R); };
  function inp() { var s = SH.val('bShape'), B = SH.num('bB'), Lr = s === 'rect' ? Math.max(SH.num('bL'), B) : s === 'strip' ? Infinity : B; return { shape: s, B: B, L: Lr, Df: SH.num('bDf') || 0, beta: SH.num('bBeta') || 0, c: SH.num('bC') || 0, phi: SH.num('bPhi') || 0, g: SH.num('bG'), gs: SH.num('bGs'), Dw: isNaN(SH.num('bDw')) ? 99 : SH.num('bDw'), FS: SH.num('bFS') || 3 }; }
  function water(p, B) { var gp = p.gs - GW, q, gB;
    if (p.Dw <= p.Df) { q = p.g * p.Dw + gp * (p.Df - p.Dw); gB = gp; } else { q = p.g * p.Df; gB = p.Dw >= p.Df + B ? p.g : gp + (p.Dw - p.Df) / B * (p.g - gp); }
    return { q: q, gB: gB }; }
  function terzaghi(p, B) {
    var f = p.phi, Nq = f === 0 ? 1 : Math.exp(2 * (3 * Math.PI / 4 - f * R / 2) * Math.tan(f * R)) / (2 * Math.pow(Math.cos((45 + f / 2) * R), 2)), Nc = f === 0 ? 5.7 : (Nq - 1) / tan(f), Ng = f === 0 ? 0 : 2 * (Nq + 1) * tan(f) / (1 + 0.4 * Math.sin(4 * f * R));
    var BL = isFinite(p.L) ? B / p.L : 0, sc = p.shape === 'circle' ? 1.3 : 1 + 0.3 * BL, sg = p.shape === 'circle' ? 0.6 : 1 - 0.2 * BL, w = water(p, B);
    var qu = p.c * Nc * sc + w.q * Nq + 0.5 * w.gB * B * Ng * sg; return { m: 'Terzaghi (1943)', Nc: Nc, Nq: Nq, Ng: Ng, qu: qu, q: w.q, sc: sc, sq: 1, sg: sg, dc: 1, dq: 1, dg: 1, ic: 1, iq: 1, ig: 1 };
  }
  function meyerhof(p, B) {
    var f = p.phi, Nq = Math.exp(Math.PI * tan(f)) * Math.pow(tan(45 + f / 2), 2), Nc = f === 0 ? 5.14 : (Nq - 1) / tan(f), Ng = (Nq - 1) * tan(1.4 * f), Kp = Math.pow(tan(45 + f / 2), 2);
    var BL = isFinite(p.L) ? B / p.L : 0, sc = 1 + 0.2 * Kp * BL, sq = f > 10 ? 1 + 0.1 * Kp * BL : 1, dc = 1 + 0.2 * Math.sqrt(Kp) * p.Df / B, dq = f > 10 ? 1 + 0.1 * Math.sqrt(Kp) * p.Df / B : 1;
    var ic = Math.pow(1 - p.beta / 90, 2), ig = f > 0 ? Math.pow(Math.max(0, 1 - p.beta / f), 2) : 1, w = water(p, B);
    var qu = p.c * Nc * sc * dc * ic + w.q * Nq * sq * dq * ic + 0.5 * w.gB * B * Ng * sq * dq * ig; return { m: 'Meyerhof (1963)', Nc: Nc, Nq: Nq, Ng: Ng, qu: qu, q: w.q, sc: sc, sq: sq, sg: sq, dc: dc, dq: dq, dg: dq, ic: ic, iq: ic, ig: ig };
  }
  function vesic(p, B) {
    var f = p.phi, Nq = Math.exp(Math.PI * tan(f)) * Math.pow(tan(45 + f / 2), 2), Nc = f === 0 ? 5.14 : (Nq - 1) / tan(f), Ng = 2 * (Nq + 1) * tan(f);
    var BL = isFinite(p.L) ? B / p.L : 0, sc = 1 + BL * Nq / Nc, sq = 1 + BL * tan(f), sg = Math.max(0.6, 1 - 0.4 * BL), k = p.Df / B <= 1 ? p.Df / B : Math.atan(p.Df / B);
    var dq = 1 + 2 * tan(f) * Math.pow(1 - Math.sin(f * R), 2) * k, dc = f === 0 ? 1 + 0.4 * k : dq - (1 - dq) / (Nc * tan(f));
    var ic = Math.pow(1 - p.beta / 90, 2), ig = f > 0 ? Math.pow(Math.max(0, 1 - p.beta / f), 2) : 1, w = water(p, B);
    var qu = p.c * Nc * sc * dc * ic + w.q * Nq * sq * dq * ic + 0.5 * w.gB * B * Ng * sg * ig; return { m: 'Vesić (1973)', Nc: Nc, Nq: Nq, Ng: Ng, qu: qu, q: w.q, sc: sc, sq: sq, sg: sg, dc: dc, dq: dq, dg: 1, ic: ic, iq: ic, ig: ig };
  }
  var area = function (p, B) { return p.shape === 'strip' ? B : p.shape === 'circle' ? Math.PI * B * B / 4 : p.shape === 'rect' ? B * p.L : B * B; };
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }

  function run() {
    var p = inp(); if (!(p.B > 0 && p.g > 0 && p.gs > 0)) return; persist.save();
    var M = [terzaghi(p, p.B), meyerhof(p, p.B), vesic(p, p.B)], A = area(p, p.B), un = p.shape === 'strip' ? ' kN/m' : ' kN';
    M.forEach(function (r) { r.qnet = r.qu - r.q; r.qall = r.qu / p.FS; r.qnetall = r.qnet / p.FS; r.Q = r.qnetall * A; });
    var gov = M.reduce(function (a, r) { return r.qnetall < a.qnetall ? r : a; }); last = { p: p, M: M, gov: gov };
    $('#bKpis').innerHTML = kpi('info', t('Allowable net pressure', 'الضغط الصافي المسموح'), SH.fmt(gov.qnetall, 0) + '<small> kPa</small>', t('governing: ', 'الحاكمة: ') + gov.m) + kpi('', t('Allowable load', 'الحمل المسموح'), SH.fmt(gov.Q, 0) + '<small>' + un + '</small>', t('net, FS = ', 'صافٍ، FS = ') + p.FS) +
      kpi('', t('Ultimate q<sub>u</sub>', 'الأقصى q<sub>u</sub>'), SH.fmt(gov.qu, 0) + '<small> kPa</small>', 'q = ' + SH.fmt(gov.q, 1) + ' kPa') + kpi('', 'N<sub>c</sub> · N<sub>q</sub> · N<sub>γ</sub>', SH.fmt(M[2].Nc, 1) + ' · ' + SH.fmt(M[2].Nq, 1) + ' · ' + SH.fmt(M[2].Ng, 1), 'φ′ = ' + p.phi + '° (Vesić)') +
      kpi('', t('Spread of methods', 'التباين بين الطرق'), SH.fmt(100 * (Math.max.apply(null, M.map(function (r) { return r.qu; })) / Math.min.apply(null, M.map(function (r) { return r.qu; })) - 1), 0) + '<small>%</small>', t('max/min q<sub>u</sub>', 'الأقصى/الأدنى q<sub>u</sub>'));
    var v = [];
    if (p.Dw < p.Df + p.B) v.push(verdict('warn', t('Water table within the influence zone', 'منسوب المياه ضمن نطاق التأثير'), t('Submerged unit weight is used in the affected terms; capacity drops by up to half compared with dry ground. Check uplift and construction dewatering.', 'استُخدم الوزن المغمور في الحدود المتأثرة؛ وتنخفض القدرة حتى النصف مقارنة بالأرض الجافة. تحقق من الطفو والتجفيف أثناء التنفيذ.')));
    if (p.phi > 0 && p.phi < 28 && p.c < 5) v.push(verdict('warn', t('Loose or soft ground', 'أرض مفككة أو لينة'), t('Low φ′ suggests local or punching shear; Terzaghi recommends reduced strength (c* = ⅔c, tanφ* = ⅔tanφ). Settlement, not bearing, will probably govern.', 'تشير φ′ المنخفضة إلى قص موضعي أو اختراقي؛ يوصي ترزاكي بتخفيض المقاومة (c* = ⅔c، tanφ* = ⅔tanφ). والهبوط لا القدرة هو الحاكم غالباً.')));
    if (p.beta > 0) v.push(verdict('info', t('Inclined load', 'حمل مائل'), t('Inclination factors reduce capacity (Meyerhof 1963). Terzaghi ignores inclination, so it overestimates here.', 'تخفض معاملات الميل القدرة (Meyerhof 1963). يهمل ترزاكي الميل، لذا يبالغ هنا.')));
    if (p.phi === 0) v.push(verdict('info', t('Undrained (φ = 0) analysis', 'تحليل غير مصرف (φ = 0)'), t('Short-term capacity of saturated clay: q<sub>u</sub> ≈ 5.14 c<sub>u</sub> s<sub>c</sub> d<sub>c</sub> + q. Check the long-term drained case too.', 'القدرة قصيرة الأمد للطين المشبع: q<sub>u</sub> ≈ 5.14 c<sub>u</sub> s<sub>c</sub> d<sub>c</sub> + q. افحص الحالة المصرفة طويلة الأمد أيضاً.')));
    v.push(verdict('ok', t('Bearing is one check of two', 'القدرة أحد فحصين'), t('Size the footing so that settlement also stays within limits (typically 25 mm for isolated footings on sand).', 'حدد أبعاد الأساس بحيث يبقى الهبوط ضمن الحدود أيضاً (عادة 25 مم للأسس المنفردة على الرمل).')));
    $('#bVerd').innerHTML = v.join('');
    var row = function (r) { return '<tr><td><b>' + r.m + '</b></td><td class="num">' + SH.fmt(r.Nc, 2) + '</td><td class="num">' + SH.fmt(r.Nq, 2) + '</td><td class="num">' + SH.fmt(r.Ng, 2) + '</td><td class="num">' + SH.fmt(r.sc, 2) + ' / ' + SH.fmt(r.sq, 2) + ' / ' + SH.fmt(r.sg, 2) + '</td><td class="num">' + SH.fmt(r.dc, 2) + ' / ' + SH.fmt(r.dq, 2) + '</td><td class="num">' + SH.fmt(r.ic, 2) + ' / ' + SH.fmt(r.ig, 2) + '</td><td class="num">' + SH.fmt(r.qu, 0) + '</td><td class="num">' + SH.fmt(r.qnetall, 0) + '</td><td class="num">' + SH.fmt(r.Q, 0) + '</td></tr>'; };
    $('#bTbl').innerHTML = '<thead><tr><th>' + t('Method', 'الطريقة') + '</th><th class="num">N<sub>c</sub></th><th class="num">N<sub>q</sub></th><th class="num">N<sub>γ</sub></th><th class="num">s<sub>c</sub>/s<sub>q</sub>/s<sub>γ</sub></th><th class="num">d<sub>c</sub>/d<sub>q</sub></th><th class="num">i<sub>c</sub>/i<sub>γ</sub></th><th class="num">q<sub>u</sub> kPa</th><th class="num">q<sub>net,all</sub> kPa</th><th class="num">Q<sub>all</sub>' + un + '</th></tr></thead><tbody>' + M.map(row).join('') + '</tbody>';
    $('#bNote').innerHTML = t('Net allowable pressure q<sub>net,all</sub> = (q<sub>u</sub> − q)/FS, with q the effective overburden at founding level. ', 'الضغط الصافي المسموح q<sub>net,all</sub> = (q<sub>u</sub> − q)/FS، حيث q الضغط الفعال للتربة فوق منسوب التأسيس. ') + t('Terzaghi N<sub>γ</sub> from Coduto’s fit; Vesić depth factors after Hansen (1970).', 'معامل N<sub>γ</sub> لترزاكي من مطابقة Coduto؛ ومعاملات العمق لـ Vesić وفق Hansen (1970).');
    sketch(p); chart(p);
  }
  function sketch(p) {
    var S = SH.svgB('bSk'), c = SH.palette(), ink = c.text, f = p.phi, W = 560, H = 360, gy = 120;
    var am = (45 + f / 2) * R, r0m = (p.B / 2) / Math.cos(am), xm = 0, ym = 0; for (var k0 = 0; k0 <= 30; k0++) { var q0 = k0 / 30 * Math.PI / 2, rr = r0m * Math.exp(q0 * Math.tan(f * R)), an = Math.PI - am - q0, ex0 = p.B / 2 + rr * Math.cos(an), ey0 = rr * Math.sin(an); ym = Math.max(ym, ey0); if (k0 === 30) xm = ex0 + (ey0 + Math.min(p.Df, 1.2)) / Math.tan((45 - f / 2) * R); }
    var sc = Math.min(90, (W - 30) / (2 * Math.max(xm, p.B)), (H - gy - 26) / (ym + Math.min(p.Df, 1.2)));
    var B = p.B * sc, D = Math.min(p.Df, 1.2) * sc, x0 = W / 2 - B / 2, x1 = W / 2 + B / 2, y0 = gy + D;
    S.add('rect', { x: 0, y: 0, width: W, height: H, fill: SH.css('--il-bg') }); S.add('rect', { x: 0, y: gy, width: W, height: H - gy, fill: SH.alpha('#C8A36A', .25) }); S.line(0, gy, W, gy, { stroke: ink, 'stroke-width': 1.5 });
    if (p.Dw * sc + gy < H) { var wy = gy + p.Dw * sc; S.add('rect', { x: 0, y: wy, width: W, height: H - wy, fill: SH.alpha('#2E78B7', .12) }); S.line(0, wy, W, wy, { stroke: '#2E78B7', 'stroke-dasharray': '6 4' }); S.path('M' + (W - 40) + ' ' + (wy - 10) + 'l8 10l8 -10z', { fill: '#2E78B7' }); }
    var a = (45 + f / 2) * R, h1 = (B / 2) * Math.tan(a), apex = [W / 2, y0 + h1], r0 = Math.hypot(B / 2, h1), th = Math.PI / 2;
    // zone I wedge
    S.poly([[x0, y0], [x1, y0], apex], { fill: SH.alpha('#B4552D', .25), stroke: '#B4552D', 'stroke-width': 1.5 });
    // log-spiral zones II and passive zones III on each side (Prandtl)
    [-1, 1].forEach(function (sg) {
      var ex = sg > 0 ? x1 : x0, path = [], beta0 = Math.atan2(apex[1] - y0, apex[0] - ex); // direction edge→apex
      for (var k = 0; k <= 30; k++) { var q = k / 30 * th, r = r0 * Math.exp(q * Math.tan(f * R)), ang = beta0 - sg * q; path.push([ex + r * Math.cos(ang), y0 + r * Math.sin(ang)]); }
      var end = path[path.length - 1], pa = (45 - f / 2) * R, L3 = (end[1] - gy) / Math.tan(pa), top = [end[0] + sg * L3, gy];
      S.path(S.pl([[ex, y0]].concat(path).concat([[ex, y0]])), { fill: SH.alpha('#A9853B', .2), stroke: '#A9853B', 'stroke-width': 1.2 });
      S.poly([[ex, y0], end, top, [ex, gy]], { fill: SH.alpha('#2F7F7C', .16), stroke: '#2F7F7C', 'stroke-width': 1.2 });
      S.path(S.pl(path.concat([top])), { fill: 'none', stroke: ink, 'stroke-width': 2, 'stroke-dasharray': '0' });
      S.text(ex + sg * (r0 * 0.55), y0 + r0 * 0.5, 'II', { 'font-size': 13, 'font-weight': 800, fill: '#7E5F22', 'text-anchor': 'middle' }); S.text((end[0] + top[0]) / 2 + sg * 6, gy + (end[1] - gy) * 0.45, 'III', { 'font-size': 13, 'font-weight': 800, fill: '#22605D', 'text-anchor': 'middle' });
    });
    S.text(W / 2, y0 + h1 * 0.55, 'I', { 'font-size': 13, 'font-weight': 800, fill: '#8C3B1C', 'text-anchor': 'middle' });
    S.add('rect', { x: x0 - 6, y: y0 - 16, width: B + 12, height: 16, fill: '#8A9097', stroke: ink }); S.add('rect', { x: W / 2 - 10, y: gy - 50, width: 20, height: y0 - 16 - gy + 50, fill: '#8A9097', stroke: ink });
    S.arrow(W / 2, gy - 95, W / 2 + Math.sin(p.beta * R) * 40, gy - 55, ink, 2.5); S.text(W / 2 + 14, gy - 82, 'Q', { 'font-size': 13, 'font-weight': 800, fill: ink });
    S.text(W / 2, y0 - 22, 'B = ' + SH.fmt(p.B, 2) + ' m', { 'font-size': 11, fill: ink, 'text-anchor': 'middle' }); S.text(16, gy - 8, t('ground', 'سطح الأرض'), { 'font-size': 11, fill: c.text2 });
    S.text(W - 14, H - 14, '45° + φ/2 = ' + SH.fmt(45 + f / 2, 1) + '° · 45° − φ/2 = ' + SH.fmt(45 - f / 2, 1) + '°', { 'font-size': 11, fill: c.text2, 'text-anchor': 'end' });
  }
  function chart(p) {
    var Bs = [], cols = ['#B4552D', '#2F7F7C', '#9A7631'], tr = [0, 1, 2].map(function (i) { return { x: [], y: [], name: ['Terzaghi', 'Meyerhof', 'Vesić'][i], mode: 'lines', line: { color: cols[i], width: 2.2 } }; });
    for (var B = 0.5; B <= Math.max(6, p.B * 2); B += 0.1) { [terzaghi, meyerhof, vesic].forEach(function (fn, i) { var r = fn(p, B); tr[i].x.push(+B.toFixed(2)); tr[i].y.push((r.qu - r.q) / p.FS); }); }
    tr.push({ x: [p.B], y: [last.gov.qnetall], mode: 'markers', name: t('Design', 'التصميم'), marker: { size: 11, color: SH.palette().text, symbol: 'diamond' } });
    SH.plot('bPlot', tr, function () { return SH.plotLayout({ xaxis: { title: { text: t('Footing width B (m)', 'عرض الأساس B (م)') } }, yaxis: { title: { text: 'q<sub>net,all</sub> (kPa)' }, rangemode: 'tozero' } }); });
  }
  ids.forEach(function (id) { $('#' + id).addEventListener('input', run); $('#' + id).addEventListener('change', run); });
  $('#bShape').addEventListener('change', function () { $('#bL').disabled = this.value !== 'rect'; }); $('#bL').disabled = SH.val('bShape') !== 'rect';
  $('#bDemo').addEventListener('click', function () { var v = { bShape: 'rect', bB: 2, bL: 3, bDf: 1.5, bBeta: 0, bC: 12, bPhi: 28, bG: 18.5, bGs: 20, bDw: 2.5, bFS: 3 }; for (var k in v) $('#' + k).value = v[k]; $('#bL').disabled = false; run(); });
  document.addEventListener('sh:redraw', function () { if (last) run(); });
  run();
})();
