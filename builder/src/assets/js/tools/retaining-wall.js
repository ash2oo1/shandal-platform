/* Retaining wall stability — cantilever or gravity wall per metre run: Rankine (sloping backfill, virtual back through the heel) or
   Coulomb active pressure with wall friction, uniform surcharge, Mononobe–Okabe seismic increment applied at 0.6 H (Seed & Whitman 1970)
   with wall inertia; overturning about the toe, sliding with base friction, adhesion and optional passive resistance, eccentricity
   and base pressure against the allowable bearing pressure. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, R2 = SH.rad;
  var IDS = ['rwH', 'rwB', 'rwToe', 'rwTb', 'rwT1', 'rwT2', 'rwGc', 'rwPhi', 'rwG', 'rwA', 'rwQ', 'rwM', 'rwD', 'rwPf', 'rwCf', 'rwDf', 'rwQa', 'rwPp', 'rwK'];
  var persist = SH.persist('retwall', IDS), last = null;

  function KaR(phi, a) { var ca = Math.cos(a), r = Math.sqrt(Math.max(0, ca * ca - Math.pow(Math.cos(phi), 2))); return ca * (ca - r) / (ca + r); }
  function KaC(phi, d, a) { var x = Math.sin(phi + d) * Math.sin(phi - a) / (Math.cos(d) * Math.cos(a)); if (x < 0) return NaN; return Math.pow(Math.cos(phi), 2) / (Math.cos(d) * Math.pow(1 + Math.sqrt(x), 2)); }
  function KaeMO(phi, d, a, kh) { var ps = Math.atan(kh), y = phi - a - ps; if (y < 0) return NaN; var x = Math.sin(phi + d) * Math.sin(y) / (Math.cos(d + ps) * Math.cos(a)); return Math.pow(Math.cos(phi - ps), 2) / (Math.cos(ps) * Math.cos(d + ps) * Math.pow(1 + Math.sqrt(x), 2)); }

  function run() {
    var g = {}; IDS.forEach(function (k) { g[k] = G.v(k); }); g.rwM = $('#rwM').value; g.rwPp = $('#rwPp').checked;
    var H = g.rwH, B = g.rwB, b1 = Math.max(0, g.rwToe || 0), tb = g.rwTb, t1 = g.rwT1, t2 = g.rwT2, gc = g.rwGc || 24, phi = R2(g.rwPhi), gam = g.rwG, al = R2(g.rwA || 0), q = Math.max(0, g.rwQ || 0), kh = Math.max(0, g.rwK || 0);
    $('#rwD').closest('.fg').style.display = g.rwM === 'coulomb' ? '' : 'none';
    if (!(H > 0 && B > 0 && tb > 0 && t1 > 0 && t2 > 0 && gam > 0 && phi > 0)) return; persist.save();
    var err = []; if (t1 > t2) err.push(t('The stem is wider at the top than at the bottom.', 'الساق أعرض في الأعلى منها في الأسفل.')); if (b1 + t2 > B + 1e-9) err.push(t('Toe plus stem is wider than the base.', 'المقدمة مع الساق أعرض من القاعدة.')); if (tb >= H) err.push(t('The base is as thick as the wall is high.', 'سمك القاعدة يساوي ارتفاع الجدار.')); if (al >= phi) err.push(t('The backfill slope is steeper than its friction angle; it cannot stand by itself.', 'ميل الردم أشد من زاوية احتكاكه؛ ولا يمكن أن يقف بنفسه.'));
    if (err.length) { $('#rwKpis').innerHTML = ''; $('#rwVerd').innerHTML = G.verdict('bad', t('Check the input', 'تحقق من المدخلات'), err.join(' ')); return; }
    var xs = b1 + t2, hs = H - tb, heel = B - xs, Hv = H + heel * Math.tan(al), coul = g.rwM === 'coulomb', inc = coul ? R2(g.rwD || 0) : al;
    var Ka = coul ? KaC(phi, inc, al) : KaR(phi, al), Kae = kh > 0 ? KaeMO(phi, inc, al, kh) : Ka; if (!isFinite(Ka)) return;
    var W = [], add = function (nm, w, x, y, inert) { W.push({ nm: nm, V: w, x: x, y: y, inert: inert }); };
    add(t('Base slab', 'بلاطة القاعدة'), gc * B * tb, B / 2, tb / 2, 1);
    add(t('Stem (rectangle)', 'الساق (الجزء المستطيل)'), gc * t1 * hs, xs - t1 / 2, tb + hs / 2, 1);
    if (t2 > t1) add(t('Stem (batter)', 'الساق (الجزء المائل)'), gc * 0.5 * (t2 - t1) * hs, (b1 + 2 * (xs - t1)) / 3, tb + hs / 3, 1);
    if (heel > 0) add(t('Soil on the heel', 'التربة فوق الكعب'), gam * heel * hs, xs + heel / 2, tb + hs / 2, 0);
    if (heel > 0 && al > 0) add(t('Sloping backfill on the heel', 'الردم المائل فوق الكعب'), gam * 0.5 * heel * heel * Math.tan(al), xs + 2 / 3 * heel, H + heel * Math.tan(al) / 3, 0);
    var Df = Math.max(0, g.rwDf || 0); if (Df > tb && b1 > 0) add(t('Soil on the toe', 'التربة فوق المقدمة'), gam * b1 * (Df - tb), b1 / 2, tb + (Df - tb) / 2, 0);
    var Ps = 0.5 * Ka * gam * Hv * Hv, Pq = Ka * q * Hv, dP = kh > 0 && isFinite(Kae) ? 0.5 * gam * Hv * Hv * (Kae - Ka) : 0, c = Math.cos(inc), s = Math.sin(inc);
    var H_ = [{ nm: t('Active thrust of the soil', 'الدفع الإيجابي للتربة'), h: Ps * c, y: Hv / 3, v: Ps * s }, { nm: t('Thrust of the surcharge', 'دفع الحمل الإضافي'), h: Pq * c, y: Hv / 2, v: Pq * s }];
    if (dP > 0) H_.push({ nm: t('Seismic increment (Mononobe–Okabe)', 'الزيادة الزلزالية (مونونوبي–أوكابي)'), h: dP * c, y: 0.6 * Hv, v: dP * s });
    if (kh > 0) W.filter(function (w) { return w.inert; }).forEach(function (w) { H_.push({ nm: t('Inertia of ', 'قصور ') + w.nm, h: kh * w.V, y: w.y, v: 0 }); });
    var sumW = W.reduce(function (a, w) { return a + w.V; }, 0), sumPv = H_.reduce(function (a, f) { return a + f.v; }, 0), sumH = H_.reduce(function (a, f) { return a + f.h; }, 0);
    var Mr = W.reduce(function (a, w) { return a + w.V * w.x; }, 0) + sumPv * B, Mo = H_.reduce(function (a, f) { return a + f.h * f.y; }, 0), V = sumW + sumPv;
    var pf = R2(g.rwPf || 0), cf = Math.max(0, g.rwCf || 0), Kp = Math.pow(Math.tan(Math.PI / 4 + pf / 2), 2), Pp = g.rwPp && Df > 0 ? 0.5 * Kp * gam * Df * Df + 2 * cf * Math.sqrt(Kp) * Df : 0;
    var Rs = V * Math.tan(2 / 3 * pf) + 2 / 3 * cf * B + Pp, FSs = Rs / sumH, FSo = Mr / Mo;
    var Vb = V + q * heel, Mb = Mr - Mo + q * heel * (xs + heel / 2), xr = Mb / Vb, e = B / 2 - xr, ae = Math.abs(e), qmax, qmin;
    if (xr <= 0 || xr >= B) { qmax = Infinity; qmin = 0; } else if (ae <= B / 6) { qmax = Vb / B * (1 + 6 * ae / B); qmin = Vb / B * (1 - 6 * ae / B); } else { qmax = 2 * Vb / (3 * (B / 2 - ae)); qmin = 0; }
    var seis = kh > 0, req = { o: seis ? 1.5 : 2.0, s: seis ? 1.1 : 1.5, e: seis ? B / 4 : B / 6 };
    last = { g: g, H: H, B: B, b1: b1, tb: tb, t1: t1, t2: t2, xs: xs, hs: hs, heel: heel, Hv: Hv, al: al, q: q, kh: kh, Ka: Ka, Kae: Kae, inc: inc, gam: gam, Df: Df, W: W, Hf: H_, sumW: sumW, sumH: sumH, sumPv: sumPv, Mr: Mr, Mo: Mo, V: V, Vb: Vb, FSo: FSo, FSs: FSs, Pp: Pp, e: e, xr: xr, qmax: qmax, qmin: qmin, req: req, qa: g.rwQa || 200, Ps: Ps, Pq: Pq, dP: dP, coul: coul };
    render();
  }
  function render() {
    var R = last, okO = R.FSo >= R.req.o, okS = R.FSs >= R.req.s, okE = Math.abs(R.e) <= R.req.e, okQ = R.qmax <= R.qa;
    $('#rwKpis').innerHTML = G.kpi(okO ? 'ok' : 'bad', t('Overturning', 'الانقلاب'), F(R.FSo, 2), t('required ', 'المطلوب ') + F(R.req.o, 1)) + G.kpi(okS ? 'ok' : 'bad', t('Sliding', 'الانزلاق'), F(R.FSs, 2), t('required ', 'المطلوب ') + F(R.req.s, 1) + (R.Pp ? t(' · with passive', ' · مع السلبية') : '')) +
      G.kpi(okQ ? 'ok' : 'bad', t('Maximum base pressure', 'أقصى ضغط تحت القاعدة'), isFinite(R.qmax) ? F(R.qmax, 0) + '<small> kPa</small>' : '∞', t('allowable ', 'المسموح ') + F(R.qa, 0) + ' kPa') + G.kpi(okE ? 'ok' : 'warn', t('Eccentricity', 'اللامركزية'), F(Math.abs(R.e), 2) + '<small> m</small>', (R.kh > 0 ? 'B/4 = ' : 'B/6 = ') + F(R.req.e, 2) + t(' m', ' م'));
    var v = [], bad = [!okO && t('overturning', 'الانقلاب'), !okS && t('sliding', 'الانزلاق'), !okQ && t('bearing pressure', 'ضغط التحمل'), !okE && t('eccentricity', 'اللامركزية')].filter(Boolean);
    if (!bad.length) v.push(G.verdict('ok', t('The wall is stable', 'الجدار مستقر'), t('All four checks pass. The structural design of the stem and base (bending and shear) is still needed.', 'تجتاز الفحوص الأربعة كلها. ويبقى التصميم الإنشائي للساق والقاعدة (الانحناء والقص) لازماً.')));
    else v.push(G.verdict('bad', t('Not stable in ', 'غير مستقر في ') + bad.join(AR() ? ' و' : ', '), (!okS ? t('Widen the base, add a shear key below it or lengthen the heel to carry more soil. ', 'وسّع القاعدة أو أضف مفتاح قص تحتها أو أطِل الكعب ليحمل تربة أكثر. ') : '') + (!okO || !okE ? t('A longer heel moves the resultant back towards the centre of the base. ', 'الكعب الأطول يعيد المحصلة نحو مركز القاعدة. ') : '') + (!okQ ? t('A wider base or a longer toe spreads the pressure.', 'القاعدة الأعرض أو المقدمة الأطول توزع الضغط.') : '')));
    v.push(G.verdict('info', t('Earth pressure', 'ضغط التربة'), (R.coul ? 'Coulomb' : 'Rankine') + ' Ka = ' + F(R.Ka, 3) + (R.kh > 0 ? (isFinite(R.Kae) ? ' · KAE = ' + F(R.Kae, 3) : t(' · the seismic coefficient is too high for this backfill (φ′ − α − ψ < 0)', ' · المعامل الزلزالي أعلى مما يحتمله هذا الردم (φ′ − α − ψ < 0)')) : '') + t('. The wall must be free to move slightly outward (about 0.1–0.2 % of its height) for active pressure to develop; a rigid, propped wall carries the higher at-rest pressure. The backfill must drain: water behind the wall roughly doubles the thrust.', '. يجب أن يكون الجدار حراً في التحرك قليلاً إلى الخارج (نحو 0.1–0.2 % من ارتفاعه) ليتولد الضغط الإيجابي؛ أما الجدار الصلب المسنود فيتحمل ضغط السكون الأعلى. ويجب أن يُصرَّف الردم: فالماء خلف الجدار يضاعف الدفع تقريباً.')));
    $('#rwVerd').innerHTML = v.join('');
    fig(); table();
  }
  function AR() { return SH.lang === 'ar'; }
  function fig() {
    var R = last, W = 900, m = { l: 40, r: 40, t: 30 }, top = R.H + R.heel * Math.tan(R.al) + Math.max(0.9, 0.2 * R.H), pw = 0.42 * R.H, bot = -0.45 * R.H, xmin = -0.9, xmax = R.B + pw + 0.9;
    var k = (W - m.l - m.r) / (xmax - xmin); if ((top - bot) * k > 520) k = 520 / (top - bot); var PH = (top - bot) * k, ox = m.l + ((W - m.l - m.r) - (xmax - xmin) * k) / 2;
    var X = function (x) { return ox + (x - xmin) * k; }, Y = function (y) { return m.t + (top - y) * k; }, s = '<defs>' + G.hatch('rwFill', '#9C7A4A', '#EADCB9', 'sand') + G.hatch('rwBase', '#8C6D1F', '#E2D3B0', 'clay') + '<marker id="rwAr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#C0392B"/></marker><marker id="rwAk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + G.INK + '"/></marker></defs>';
    var B = R.B, xs = R.xs, H = R.H, tb = R.tb, Hs = R.H + R.heel * Math.tan(R.al), xe = R.B + pw * 0.15;
    /* foundation soil and front soil */
    s += '<rect x="' + X(xmin) + '" y="' + Y(0) + '" width="' + (X(xmax) - X(xmin)) + '" height="' + (Y(bot) - Y(0)) + '" fill="url(#rwBase)"/>';
    if (R.Df > 0) s += '<rect x="' + X(xmin) + '" y="' + Y(R.Df) + '" width="' + (X(R.b1) - X(xmin)) + '" height="' + (Y(0) - Y(R.Df)) + '" fill="url(#rwFill)"/>';
    /* backfill */
    var bf = 'M' + X(xs) + ' ' + Y(H) + 'L' + X(xmax) + ' ' + Y(H + (xmax - xs) * Math.tan(R.al)) + 'L' + X(xmax) + ' ' + Y(0) + 'L' + X(B) + ' ' + Y(0) + 'L' + X(B) + ' ' + Y(tb) + 'L' + X(xs) + ' ' + Y(tb) + 'Z';
    s += '<path d="' + bf + '" fill="url(#rwFill)"/><path d="M' + X(xs) + ' ' + Y(H) + 'L' + X(xmax) + ' ' + Y(H + (xmax - xs) * Math.tan(R.al)) + '" stroke="' + G.INK + '" stroke-width="1.6" fill="none"/>';
    /* wall */
    s += '<path d="M' + X(0) + ' ' + Y(0) + 'L' + X(B) + ' ' + Y(0) + 'L' + X(B) + ' ' + Y(tb) + 'L' + X(xs) + ' ' + Y(tb) + 'L' + X(xs) + ' ' + Y(H) + 'L' + X(xs - R.t1) + ' ' + Y(H) + 'L' + X(R.b1) + ' ' + Y(tb) + 'L' + X(0) + ' ' + Y(tb) + 'Z" fill="#B9BEC3" stroke="' + G.INK + '" stroke-width="2"/>';
    /* virtual back and pressure diagram (horizontal component) */
    var sc = R.Ka * Math.cos(R.inc), pBot = sc * (R.gam * Hs + R.q), pTop = sc * R.q, pS = R.kh > 0 && isFinite(R.Kae) ? (R.Kae - R.Ka) * Math.cos(R.inc) * R.gam * Hs : 0, pMax = Math.max(pBot + 0.0001, pS * 1.2 + pTop), pk = pw * 0.8 / pMax;
    s += '<line x1="' + X(B) + '" x2="' + X(B) + '" y1="' + Y(0) + '" y2="' + Y(Hs) + '" stroke="' + G.INK + '" stroke-dasharray="5 4"/>';
    s += '<path d="M' + X(xe) + ' ' + Y(Hs) + 'L' + X(xe + pTop * pk) + ' ' + Y(Hs) + 'L' + X(xe + pBot * pk) + ' ' + Y(0) + 'L' + X(xe) + ' ' + Y(0) + 'Z" fill="#C0392B" fill-opacity=".18" stroke="#C0392B" stroke-width="1.4"/>';
    if (pS > 0) s += '<path d="M' + X(xe) + ' ' + Y(0) + 'L' + X(xe + pS * pk) + ' ' + Y(Hs) + 'L' + X(xe) + ' ' + Y(Hs) + 'Z" fill="#7A4F9A" fill-opacity=".14" stroke="#7A4F9A" stroke-width="1.2" stroke-dasharray="5 3"/>';
    s += G.tx(X(xe + pBot * pk) + 4, Y(0) - 4, F(pBot, 0) + ' kPa', { fs: 11, fill: '#C0392B', fw: 700, halo: 1 }) + (pTop > 0 ? G.tx(X(xe + pTop * pk) + 4, Y(Hs) + 12, F(pTop, 0) + ' kPa', { fs: 11, fill: '#C0392B', halo: 1 }) : '');
    /* resultant thrust */
    var Pt = R.Hf.filter(function (f) { return f.nm.indexOf(t('Inertia', 'قصور')) !== 0; }), Ph = Pt.reduce(function (a, f) { return a + f.h; }, 0), yP = Pt.reduce(function (a, f) { return a + f.h * f.y; }, 0) / Ph;
    s += '<line x1="' + (X(B) + 70) + '" y1="' + Y(yP) + '" x2="' + (X(B) + 3) + '" y2="' + Y(yP) + '" stroke="#C0392B" stroke-width="2.6" marker-end="url(#rwAr)"/>' + G.tx(X(B) + 8, Y(yP) - 8, 'Ph = ' + F(Ph, 0) + ' kN/m', { fs: 12, fw: 800, fill: '#C0392B', halo: 1 });
    /* weight and base reaction */
    var xw = R.W.reduce(function (a, w) { return a + w.V * w.x; }, 0) / R.sumW;
    s += '<line x1="' + X(xw) + '" y1="' + (Y(H * 0.62)) + '" x2="' + X(xw) + '" y2="' + (Y(H * 0.62) + 56) + '" stroke="' + G.INK + '" stroke-width="2.4" marker-end="url(#rwAk)"/>' + G.tx(X(xw) + 6, Y(H * 0.62) - 4, 'W = ' + F(R.sumW, 0) + ' kN/m', { fs: 12, fw: 800, halo: 1 });
    if (isFinite(R.qmax)) { var bk = (-bot - 0.6) / Math.max(R.qmax, R.qa) , q0 = R.e >= 0 ? R.qmax : R.qmin, q1 = R.e >= 0 ? R.qmin : R.qmax, Lc = Math.abs(R.e) > B / 6 ? 3 * (B / 2 - Math.abs(R.e)) : B, path;
      if (Math.abs(R.e) <= B / 6) path = 'M' + X(0) + ' ' + Y(0) + 'L' + X(0) + ' ' + Y(-q0 * bk) + 'L' + X(B) + ' ' + Y(-q1 * bk) + 'L' + X(B) + ' ' + Y(0) + 'Z';
      else path = R.e >= 0 ? 'M' + X(0) + ' ' + Y(0) + 'L' + X(0) + ' ' + Y(-R.qmax * bk) + 'L' + X(Lc) + ' ' + Y(0) + 'Z' : 'M' + X(B) + ' ' + Y(0) + 'L' + X(B) + ' ' + Y(-R.qmax * bk) + 'L' + X(B - Lc) + ' ' + Y(0) + 'Z';
      s += '<path d="' + path + '" fill="#2E6FBF" fill-opacity=".2" stroke="#2E6FBF" stroke-width="1.4"/>' + '<line x1="' + X(-0.4) + '" x2="' + X(B + 0.4) + '" y1="' + Y(-R.qa * bk) + '" y2="' + Y(-R.qa * bk) + '" stroke="#2E8B57" stroke-dasharray="6 4"/>';
      s += G.tx(X(R.e >= 0 ? 0 : B) + (R.e >= 0 ? -4 : 4), Y(-R.qmax * bk) + 14, F(R.qmax, 0) + ' kPa', { fs: 11, fw: 700, fill: '#2E6FBF', anchor: R.e >= 0 ? 'end' : 'start', halo: 1 }) + G.tx(X(B + 0.45), Y(-R.qa * bk) + 4, 'qa = ' + F(R.qa, 0), { fs: 11, fill: '#2E8B57', halo: 1 });
      s += '<line x1="' + X(R.xr) + '" y1="' + (Y(0) + 46) + '" x2="' + X(R.xr) + '" y2="' + (Y(0) + 4) + '" stroke="#2E6FBF" stroke-width="2.2" marker-end="url(#rwAk)"/>' + G.tx(X(R.xr) + 6, Y(0) + 44, 'R, e = ' + F(R.e, 2) + ' m', { fs: 11.5, fw: 700, fill: '#2E6FBF', halo: 1 }); }
    if (R.q > 0) for (var qx = xs + 0.2; qx < xmax - 0.2; qx += (xmax - xs) / 6) { var yq = H + (qx - xs) * Math.tan(R.al); s += '<path d="M' + X(qx) + ' ' + (Y(yq) - 24) + 'v18" stroke="' + G.INK + '" stroke-width="1.3"/><path d="M' + (X(qx) - 4) + ' ' + (Y(yq) - 8) + 'l4 7l4 -7z" fill="' + G.INK + '"/>'; }
    if (R.q > 0) s += G.tx(X((xs + xmax) / 2), Y(H + ((xmax + xs) / 2 - xs) * Math.tan(R.al)) - 30, 'q = ' + F(R.q, 0) + ' kPa', { anchor: 'middle', fs: 11.5, fw: 700 });
    s += G.tx(X(xs) - 6, Y(H) - 8, 'H = ' + F(H, 2) + ' m', { anchor: 'end', fs: 11.5, halo: 1 }) + G.tx(X(B / 2), Y(tb / 2) + 4, 'B = ' + F(B, 2) + ' m', { anchor: 'middle', fs: 11.5, fw: 700 });
    s += '<rect x="' + X(xmin) + '" y="' + Y(top) + '" width="' + (X(xmax) - X(xmin)) + '" height="' + (Y(bot) - Y(top)) + '" fill="none" stroke="' + G.INK + '" stroke-width="1.2"/>';
    var ly = m.t + PH + 28; s += G.scaleBar(X(xmin), ly, k, 140) + G.tx(X(xmax), ly + 7, 'Wall and soil to scale; pressure diagrams to their own scale', { anchor: 'end', fs: 11, fill: G.MUT });
    var it = [{ name: 'Wall', col: '#7D848A', box: 1, op: .6 }, { name: 'Backfill', col: '#C9A94E', box: 1, op: .6 }, { name: 'Virtual back through the heel', col: G.INK, dash: '5 4', w: 1.2 }, { name: 'Static active pressure (horizontal)', col: '#C0392B', box: 1 }].concat(R.kh > 0 ? [{ name: 'Seismic increment', col: '#7A4F9A', box: 1 }] : []).concat([{ name: 'Base pressure', col: '#2E6FBF', box: 1 }, { name: 'Allowable bearing pressure', col: '#2E8B57', dash: '6 4' }]);
    var lw = (X(xmax) - X(xmin)) / 3; it.forEach(function (q2, i) { var x = X(xmin) + (i % 3) * Math.max(lw, 250), y = ly + 34 + Math.floor(i / 3) * 20; s += G.sym(q2, x + 10, y - 4) + G.tx(x + 26, y, q2.name, { fs: 11.5 }); });
    var HH = ly + 34 + Math.ceil(it.length / 3) * 20 + 4;
    $('#rwSec').setAttribute('viewBox', '0 0 ' + W + ' ' + HH); $('#rwSec').innerHTML = '<rect width="' + W + '" height="' + HH + '" fill="#fff"/>' + s;
    $('#rwSecCap').textContent = t('The red diagram is the active earth pressure on the vertical plane through the heel, the soil above the heel counting as part of the wall. The blue diagram is the contact pressure under the base: it must stay below the allowable value, and a triangle that does not reach the heel means the base is lifting.', 'المخطط الأحمر هو ضغط التربة الإيجابي على المستوى الرأسي المار بالكعب، والتربة فوق الكعب تُحسب جزءاً من الجدار. والمخطط الأزرق هو ضغط التماس تحت القاعدة: يجب أن يبقى دون القيمة المسموحة، والمثلث الذي لا يصل إلى الكعب يعني أن القاعدة ترتفع.');
  }
  function table() {
    var R = last, rows = [];
    R.W.forEach(function (w) { rows.push([w.nm, F(w.V, 1), '', F(w.x, 2), F(w.V * w.x, 1), '']); });
    if (R.sumPv > 0) rows.push([t('Vertical component of the thrust', 'المركبة الرأسية للدفع'), F(R.sumPv, 1), '', F(R.B, 2), F(R.sumPv * R.B, 1), '']);
    R.Hf.forEach(function (f) { if (f.h > 0) rows.push([f.nm, '', F(f.h, 1), F(f.y, 2), '', F(f.h * f.y, 1)]); });
    if (R.Pp) rows.push([t('Passive resistance in front (sliding only)', 'المقاومة السلبية الأمامية (للانزلاق فقط)'), '', '−' + F(R.Pp, 1), '', '', '']);
    $('#rwTbl').innerHTML = '<thead><tr><th>' + t('Force', 'القوة') + '</th><th class="num">V kN</th><th class="num">H kN</th><th class="num">' + t('Arm m', 'الذراع م') + '</th><th class="num">M<sub>R</sub> kN·m</th><th class="num">M<sub>O</sub> kN·m</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td>' + r.slice(1).map(function (c) { return '<td class="num">' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '<tr><td><b>' + t('Total', 'المجموع') + '</b></td><td class="num"><b>' + F(R.V, 1) + '</b></td><td class="num"><b>' + F(R.sumH, 1) + '</b></td><td></td><td class="num"><b>' + F(R.Mr, 1) + '</b></td><td class="num"><b>' + F(R.Mo, 1) + '</b></td></tr></tbody>';
  }
  $('#rwCsv').addEventListener('click', function () { if (!last) return; var R = last; SH.csv('shandal-retaining-wall.csv', [['force', 'V_kN_per_m', 'H_kN_per_m', 'arm_m']].concat(R.W.map(function (w) { return [w.nm, w.V.toFixed(2), '', w.x.toFixed(3)]; })).concat(R.Hf.map(function (f) { return [f.nm, '', f.h.toFixed(2), f.y.toFixed(3)]; })).concat([[], ['Ka', R.Ka.toFixed(4)], ['KAE', isFinite(R.Kae) ? R.Kae.toFixed(4) : ''], ['FS_overturning', R.FSo.toFixed(3)], ['FS_sliding', R.FSs.toFixed(3)], ['eccentricity_m', R.e.toFixed(3)], ['q_max_kPa', isFinite(R.qmax) ? R.qmax.toFixed(1) : 'inf'], ['q_min_kPa', R.qmin.toFixed(1)]])); });
  var tm = null; function later() { clearTimeout(tm); tm = setTimeout(run, 150); }
  IDS.forEach(function (id) { var e = $('#' + id); e.addEventListener('input', later); e.addEventListener('change', later); });
  $('#rwDemo').addEventListener('click', function () { G.set({ rwH: 5, rwB: 3.3, rwToe: 0.8, rwTb: 0.5, rwT1: 0.3, rwT2: 0.5, rwGc: 24, rwPhi: 32, rwG: 18, rwA: 0, rwQ: 10, rwM: 'rankine', rwD: 21, rwPf: 30, rwCf: 0, rwDf: 1, rwQa: 200, rwK: 0 }); G.set({ rwB: 3.6 }); $('#rwPp').checked = true; run(); });
  document.addEventListener('DOMContentLoaded', run);
})();
