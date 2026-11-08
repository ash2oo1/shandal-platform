/* Foundation settlement — Boussinesq stress below the centre of a rectangular (Newmark 1935), strip or circular footing,
   immediate settlement from the layer moduli, primary consolidation of clay with Cc, Cs and the preconsolidation pressure,
   and its progress with time by Terzaghi's one-dimensional theory. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, GW = 9.81;
  var IDS = ['stS', 'stB', 'stL', 'stDf', 'stQ', 'stW', 'stCs', 'stDr', 'stAl'], persist = SH.persist('settle', IDS), last = null;
  var COLS = [{ k: 'ty', h: t('Soil', 'التربة'), w: '62px', type: 'select', opts: [['sand', t('Sand', 'رمل')], ['clay', t('Clay', 'طين')]] }, { k: 'h', h: 'h' }, { k: 'g', h: 'γ' }, { k: 'E', h: 'E' }, { k: 'cc', h: 'Cc' }, { k: 'e0', h: 'e0' }, { k: 'ocr', h: 'OCR' }, { k: 'cv', h: 'cv' }];
  var DEF = [{ ty: 'sand', h: 4, g: 18.5, E: 25 }, { ty: 'clay', h: 6, g: 17.5, E: 6, cc: 0.32, e0: 0.95, ocr: 1.3, cv: 2.5 }, { ty: 'sand', h: 6, g: 19.5, E: 60 }];
  var T = G.rows($('#stRows'), 'shandal_settle_rows', COLS, DEF, function () { later(); });
  $('#stAdd').addEventListener('click', function () { T.add({ ty: 'clay', h: 2, g: 18, E: 8, cc: 0.25, e0: 0.8, ocr: 1, cv: 3 }); });

  function Iz(shape, B, L, z) { /* influence factor at the centre: Δσ = q · I */
    if (z <= 1e-6) return 1;
    if (shape === 'circ') { var r = B / 2; return 1 - Math.pow(1 / (1 + (r / z) * (r / z)), 1.5); }
    if (shape === 'strip') { var a = Math.atan(B / (2 * z)); return (2 * a + Math.sin(2 * a)) / Math.PI; }
    var m = B / 2 / z, n = L / 2 / z, m2 = m * m, n2 = n * n, v = m2 + n2 + 1, s = Math.sqrt(v);
    return 4 / (4 * Math.PI) * ((2 * m * n * s / (v + m2 * n2)) * ((v + 1) / v) + Math.atan2(2 * m * n * s, v - m2 * n2));
  }
  var Uof = function (Tv) { if (Tv <= 0) return 0; if (Tv <= 0.2827) return Math.sqrt(4 * Tv / Math.PI); return Math.min(1, 1 - Math.pow(10, (1.781 - Tv) / 0.933) / 100); };
  var Tof = function (U) { return U < 0.6 ? Math.PI / 4 * U * U : 1.781 - 0.933 * Math.log10(100 * (1 - U)); };

  function run() {
    var p = { s: $('#stS').value, B: G.v('stB'), L: G.v('stL'), Df: Math.max(0, G.v('stDf') || 0), q: G.v('stQ'), w: Math.max(0, G.v('stW')), cs: G.v('stCs') || 0.15, dr: +$('#stDr').value || 2, al: G.v('stAl') || 25 };
    if (p.s !== 'rect') p.L = p.B; if (!(p.B > 0) || !(p.q >= 0) || isNaN(p.w)) return; if (p.s === 'rect' && !(p.L > 0)) return; if (p.s === 'rect' && p.L < p.B) { var tmp = p.L; p.L = p.B; p.B = tmp; }
    persist.save(); $('#stL').closest('.fg').style.display = p.s === 'rect' ? '' : 'none';
    var rows = T.get().filter(function (r) { return r.h > 0 && r.g > 0; }); if (!rows.length) return;
    var top = 0, Ls = rows.map(function (r) { var o = Object.assign({}, r, { z0: top, z1: top + r.h }); top += r.h; return o; }), Ztot = top;
    var sub = [], si = 0, sc = 0, zs = 0, sv = 0;
    Ls.forEach(function (Ly, li) {
      var n = Math.max(2, Math.ceil(Ly.h / 0.25)), dz = Ly.h / n; Ly.si = 0; Ly.sc = 0;
      for (var k = 0; k < n; k++) {
        var za = Ly.z0 + k * dz, zm = za + dz / 2, s0 = sv + Ly.g * (zm - Ly.z0), u = GW * Math.max(0, zm - p.w), se = s0 - u;
        if (zm <= p.Df) { sub.push({ z: zm, se: se, ds: null, sp: null, li: li }); continue; }
        var ds = p.q * Iz(p.s, p.B, p.L, zm - p.Df), ei = Ly.E > 0 ? ds * dz / (Ly.E * 1000) : 0, ec = 0, sp = null;
        if (Ly.ty === 'clay' && Ly.cc > 0 && Ly.e0 > 0 && se > 0) { sp = se * Math.max(1, Ly.ocr || 1); var sf = se + ds, cs = Ly.cc * p.cs;
          ec = (sf <= sp ? cs * Math.log10(sf / se) : cs * Math.log10(sp / se) + Ly.cc * Math.log10(sf / sp)) * dz / (1 + Ly.e0); }
        Ly.si += ei; Ly.sc += ec; si += ei; sc += ec; sub.push({ z: zm, se: se, ds: ds, sp: sp, li: li, ei: ei, ec: ec });
      }
      sv += Ly.g * Ly.h;
    });
    /* depth of influence: Δσ falls to 10 % of σ′0 */
    var zi = null; for (var i = 0; i < sub.length; i++) { var q2 = sub[i]; if (q2.ds != null && q2.z > p.Df + 0.5 && q2.ds < 0.1 * q2.se) { zi = q2.z; break; } }
    /* time: each clay layer consolidates on its own drainage path */
    var clays = Ls.filter(function (l) { return l.ty === 'clay' && l.sc > 0 && l.cv > 0; }).map(function (l) { var Hd = (l.z1 - Math.max(l.z0, p.Df)) / p.dr; return { l: l, Hd: Math.max(Hd, 0.05) }; });
    var S = function (ty) { var s = si; clays.forEach(function (c) { s += c.l.sc * Uof(c.l.cv * ty / (c.Hd * c.Hd)); }); Ls.forEach(function (l) { if (l.ty === 'clay' && !(l.cv > 0)) s += l.sc; }); return s; };
    var tAt = function (U) { if (!clays.length || sc <= 0) return 0; var target = si + U * sc, lo = 1e-4, hi = 1e4; for (var k2 = 0; k2 < 80; k2++) { var mid = Math.sqrt(lo * hi); if (S(mid) < target) lo = mid; else hi = mid; } return Math.sqrt(lo * hi); };
    last = { p: p, Ls: Ls, sub: sub, si: si, sc: sc, tot: si + sc, zi: zi, Ztot: Ztot, clays: clays, S: S, t50: tAt(0.5), t90: tAt(0.9) };
    render();
  }

  var mm = function (v) { return F(v * 1000, v * 1000 < 10 ? 1 : 0); };
  var yrs = function (y) { return y < 1 / 12 ? F(y * 365, 0) + t(' days', ' يوماً') : y < 1 ? F(y * 12, 1) + t(' months', ' شهر') : F(y, y < 10 ? 1 : 0) + t(' years', ' سنة'); };
  function render() {
    var R = last, p = R.p, al = p.al / 1000, st = R.tot > al ? 'bad' : R.tot > 0.8 * al ? 'warn' : 'ok';
    $('#stKpis').innerHTML = G.kpi(st, t('Total settlement', 'الهبوط الكلي'), mm(R.tot) + '<small> mm</small>', t('allowable ', 'المسموح ') + F(p.al, 0) + ' mm') + G.kpi('', t('Immediate', 'الفوري'), mm(R.si) + '<small> mm</small>', t('during construction', 'خلال الإنشاء')) +
      G.kpi(R.sc > 0 ? 'info' : '', t('Consolidation of clay', 'انضمام الطين'), mm(R.sc) + '<small> mm</small>', R.sc > 0 ? t('primary, long term', 'أولي، طويل الأمد') : t('no clay loaded', 'لا طين محمّل')) +
      G.kpi('', t('Time to 90 %', 'زمن 90 %'), R.sc > 0 && R.clays.length ? yrs(R.t90) : '—', R.sc > 0 && R.clays.length ? t('50 % in ', '50 % خلال ') + yrs(R.t50) : '');
    var v = [];
    if (st === 'bad') v.push(G.verdict('bad', t('Settlement exceeds the limit', 'الهبوط يتجاوز الحد'), t('Reduce the pressure (larger footing or raft), take the load to a stiffer layer with piles, or preload the clay before building.', 'خفّض الضغط (أساس أكبر أو حصيرة)، أو انقل الحمل إلى طبقة أصلب بالركائز، أو حمّل الطين مسبقاً قبل البناء.')));
    else if (st === 'warn') v.push(G.verdict('warn', t('Close to the limit', 'قريب من الحد'), t('Within the allowable value but with little margin; check differential settlement between neighbouring footings, which is usually half to three quarters of the total.', 'ضمن القيمة المسموحة لكن بهامش قليل؛ افحص الهبوط التفاضلي بين الأسس المتجاورة، وهو عادة نصف إلى ثلاثة أرباع الكلي.')));
    else v.push(G.verdict('ok', t('Within the allowable settlement', 'ضمن الهبوط المسموح'), t('Expected total ', 'الهبوط الكلي المتوقع ') + mm(R.tot) + t(' mm against ', ' مم مقابل ') + F(p.al, 0) + t(' mm allowed.', ' مم مسموح.')));
    if (R.zi != null) v.push(G.verdict('info', t('Depth of influence', 'عمق التأثير'), t('The added stress falls below 10 % of the existing effective stress at ', 'ينخفض الإجهاد المضاف دون 10 % من الإجهاد الفعال القائم عند عمق ') + F(R.zi, 1) + t(' m; boreholes should reach at least this depth.', ' م؛ ويجب أن تصل الآبار إلى هذا العمق على الأقل.')));
    else v.push(G.verdict('warn', t('Layers end too shallow', 'الطبقات تنتهي ضحلة'), t('The added stress is still above 10 % of the effective stress at the bottom of the last layer (', 'ما زال الإجهاد المضاف أعلى من 10 % من الإجهاد الفعال عند قاعدة آخر طبقة (') + F(R.Ztot, 1) + t(' m). Add the deeper layers or the settlement is underestimated.', ' م). أضف الطبقات الأعمق وإلا قُدّر الهبوط بأقل من حقيقته.')));
    $('#stVerd').innerHTML = v.join('');
    figProf(); figTime(); table();
  }
  var LCOL = { sand: '#E9D9A6', clay: '#BFD3E6' };
  function figProf() {
    var R = last, p = R.p, sub = R.sub, zmax = R.Ztot, xs = []; sub.forEach(function (s) { xs.push(s.se, s.se + (s.ds || 0)); if (s.sp) xs.push(s.sp); });
    var xr = G.span(xs.concat([0]), { zero: true });
    var bands = function (fx, fy) { return R.Ls.map(function (l) { return '<rect x="' + fx(xr.lo) + '" y="' + fy(l.z0) + '" width="' + (fx(xr.hi) - fx(xr.lo)) + '" height="' + (fy(l.z1) - fy(l.z0)) + '" fill="' + LCOL[l.ty] + '" opacity=".55"/>'; }).join('') + '<line x1="' + fx(xr.lo) + '" x2="' + fx(xr.hi) + '" y1="' + fy(p.w) + '" y2="' + fy(p.w) + '" stroke="#2E6FBF" stroke-dasharray="6 4"/>' + '<rect x="' + fx(xr.lo) + '" y="' + (fy(p.Df) - 6) + '" width="' + (fx(xr.lo + (xr.hi - xr.lo) * 0.12) - fx(xr.lo)) + '" height="6" fill="#8A8F94"/>'; };
    var ld = sub.filter(function (s) { return s.ds != null; }), cl = sub.filter(function (s) { return s.sp; });
    var ser = [{ pts: sub.map(function (s) { return [s.se, s.z]; }), col: G.INK, w: 2 }, { pts: [[p.q, p.Df]].concat(ld.map(function (s) { return [s.ds, s.z]; })), col: '#C0392B', w: 2 }, { pts: ld.map(function (s) { return [s.se + s.ds, s.z]; }), col: '#E67E22', w: 2, dash: '6 4' }];
    var lg = [{ name: "σ′v0 existing effective stress", col: G.INK }, { name: 'Δσ added by the footing', col: '#C0392B' }, { name: "σ′v0 + Δσ", col: '#E67E22', dash: '6 4' }];
    if (cl.length) { R.Ls.forEach(function (l, i) { var pts = cl.filter(function (s) { return s.li === i; }).map(function (s) { return [s.sp, s.z]; }); if (pts.length) ser.push({ pts: pts, col: '#7A4F9A', w: 1.8, dash: '2 3' }); }); lg.push({ name: "σ′p preconsolidation (clay)", col: '#7A4F9A', dash: '2 3' }); }
    lg.push({ name: 'Water table', col: '#2E6FBF', dash: '6 4' }, { name: 'Sand', col: '#C9A94E', box: 1, op: .5 }, { name: 'Clay', col: '#7FA5C8', box: 1, op: .5 }, { name: 'Footing base', col: '#8A8F94', box: 1, op: 1 });
    G.chart($('#stProf'), { W: 560, H: 560, m: { l: 64, r: 18, t: 54, b: 16 }, x: { lo: xr.lo, hi: xr.hi, title: 'Vertical stress (kPa)', top: true }, y: { lo: 0, hi: zmax, rev: true, title: 'Depth below ground (m)' }, under: bands, series: ser, legend: lg, note: 'Stress below the centre of the footing; ' + (p.s === 'rect' ? F(p.B, 1) + ' × ' + F(p.L, 1) + ' m rectangle' : p.s === 'strip' ? F(p.B, 1) + ' m strip' : F(p.B, 1) + ' m circle') + ', qn = ' + F(p.q, 0) + ' kPa at ' + F(p.Df, 1) + ' m.' });
    $('#stProfCap').textContent = t('The added stress (red) spreads and fades with depth; settlement is large where it is a big fraction of the existing stress and where clay is loaded beyond its preconsolidation pressure (orange line right of the purple).', 'ينتشر الإجهاد المضاف (الأحمر) ويخفت مع العمق؛ ويكبر الهبوط حيث يكون جزءاً كبيراً من الإجهاد القائم، وحيث يُحمَّل الطين فوق ضغط انضمامه المسبق (الخط البرتقالي يمين البنفسجي).');
  }
  function figTime() {
    var R = last, p = R.p, ts = []; for (var e = -2; e <= 2.0001; e += 0.05) ts.push(Math.pow(10, e));
    var tot = ts.map(function (y) { return [y, R.S(y) * 1000]; }), ymax = Math.max(R.tot * 1000, p.al) * 1.15;
    var ser = [{ pts: tot, col: '#C0392B', w: 2.6 }], lg = [{ name: 'Total settlement', col: '#C0392B' }];
    if (R.si > 0) { ser.push({ pts: ts.map(function (y) { return [y, R.si * 1000]; }), col: G.INK, w: 1.4, dash: '3 3' }); lg.push({ name: 'Immediate settlement', col: G.INK, dash: '3 3' }); }
    lg.push({ name: 'Allowable settlement', col: '#2E8B57', dash: '8 4' });
    var vl = []; if (R.sc > 0 && R.clays.length) { if (R.t50 > 0.01 && R.t50 < 100) vl.push({ v: R.t50, col: '#7A4F9A', dash: '4 3', label: 'U 50 %' }); if (R.t90 > 0.01 && R.t90 < 100) vl.push({ v: R.t90, col: '#7A4F9A', label: 'U 90 %' }); }
    G.chart($('#stTime'), { W: 560, H: 560, m: { l: 64, r: 18, t: 54, b: 16 }, x: { lo: 0.01, hi: 100, log: true, title: 'Time after loading (years, log scale)', top: true }, y: { lo: 0, hi: ymax, rev: true, title: 'Settlement (mm)' }, series: ser, hl: [{ v: p.al, col: '#2E8B57', dash: '8 4' }], vl: vl, legend: lg, note: R.sc > 0 ? 'Terzaghi one-dimensional consolidation, ' + (p.dr === 2 ? 'double' : 'single') + ' drainage of each clay layer; secondary compression not included.' : 'No clay is loaded: settlement is essentially complete during construction.' });
    $('#stTimeCap').textContent = R.sc > 0 ? t('Immediate settlement happens as the load is applied; the clay then squeezes out water slowly. Half of the consolidation takes ', 'يحدث الهبوط الفوري مع تسليط الحمل، ثم يطرد الطين الماء ببطء. يستغرق نصف الانضمام ') + yrs(R.t50) + t(' and 90 % takes ', ' ويستغرق 90 % منه ') + yrs(R.t90) + t('; thinner layers or vertical drains shorten this as the square of the drainage path.', '؛ والطبقات الأرق أو المصارف الرأسية تقصّره بنسبة مربع مسار التصريف.') : t('Without clay the settlement occurs almost entirely while the structure is built.', 'دون طين يحدث الهبوط كله تقريباً أثناء إنشاء المنشأ.');
  }
  function table() {
    var R = last;
    $('#stTbl').innerHTML = '<thead><tr><th>' + t('Layer', 'الطبقة') + '</th><th>' + t('Depth m', 'العمق م') + '</th><th class="num">' + t('Immediate mm', 'فوري مم') + '</th><th class="num">' + t('Consolidation mm', 'انضمام مم') + '</th><th class="num">' + t('Share %', 'النسبة %') + '</th></tr></thead><tbody>' +
      R.Ls.map(function (l, i) { return '<tr><td>' + (i + 1) + ' · ' + (l.ty === 'clay' ? t('Clay', 'طين') : t('Sand', 'رمل')) + '</td><td class="ltr">' + F(l.z0, 1) + '–' + F(l.z1, 1) + '</td><td class="num">' + mm(l.si) + '</td><td class="num">' + (l.ty === 'clay' ? mm(l.sc) : '—') + '</td><td class="num">' + (R.tot > 0 ? F(100 * (l.si + l.sc) / R.tot, 0) : '—') + '</td></tr>'; }).join('') +
      '<tr><td><b>' + t('Total', 'المجموع') + '</b></td><td></td><td class="num"><b>' + mm(R.si) + '</b></td><td class="num"><b>' + mm(R.sc) + '</b></td><td class="num"><b>100</b></td></tr></tbody>';
  }
  $('#stCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-settlement.csv', [['depth_m', 'sigma_v0_eff_kPa', 'delta_sigma_kPa', 'sigma_p_kPa', 'immediate_mm', 'consolidation_mm']].concat(last.sub.map(function (s) { return [s.z.toFixed(2), s.se.toFixed(1), s.ds != null ? s.ds.toFixed(1) : '', s.sp ? s.sp.toFixed(1) : '', s.ei ? (s.ei * 1000).toFixed(2) : '', s.ec ? (s.ec * 1000).toFixed(2) : '']; }))); });
  var tm = null; function later() { clearTimeout(tm); tm = setTimeout(run, 200); }
  IDS.forEach(function (id) { var e = $('#' + id); e.addEventListener('input', later); e.addEventListener('change', later); });
  $('#stDemo').addEventListener('click', function () { T.set(DEF); G.set({ stS: 'rect', stB: 3, stL: 3, stDf: 1.5, stQ: 150, stW: 2, stCs: 0.15, stDr: '2', stAl: 25 }); run(); });
  document.addEventListener('DOMContentLoaded', run);
})();
