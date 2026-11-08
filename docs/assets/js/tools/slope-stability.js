/* Slope stability — circular slip surfaces by the simplified Bishop (1955) and ordinary (Fellenius 1936) methods of slices,
   with crest surcharge, a firm layer, phreatic line or ru, and pseudo-static seismic loading; grid-and-radius search with refinement,
   factor of safety against slope angle, and the angle that meets the required factor. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, E = SH.esc, G = window.EG, GW = 9.81;
  var IDS = ['ssH', 'ssB', 'ssQ', 'ssD', 'ssC', 'ssF', 'ssG', 'ssGs', 'ssW', 'ssHw', 'ssRu', 'ssK', 'ssFr'];
  var persist = SH.persist('slopestab', IDS), last = null;

  function par() {
    var p = { H: G.v('ssH'), b: G.v('ssB'), q: G.v('ssQ') || 0, D: Math.max(0, G.v('ssD') || 0), c: Math.max(0, G.v('ssC') || 0), phi: Math.max(0, G.v('ssF') || 0), g: G.v('ssG'), gs: G.v('ssGs'), w: $('#ssW').value, hw: G.v('ssHw') || 0, ru: G.v('ssRu') || 0, kh: Math.max(0, G.v('ssK') || 0), Fr: G.v('ssFr') || 1.5 };
    if (!(p.H > 0) || !(p.b > 1 && p.b < 89) || !(p.g > 0)) return null; if (!(p.gs > 0)) p.gs = p.g; p.hw = Math.min(Math.max(p.hw, 0), p.H); p.tf = Math.tan(SH.rad(p.phi)); p.Lx = p.H / Math.tan(SH.rad(p.b)); return p;
  }
  /* slope faces +x: crest y = H for x <= 0, face to the toe (Lx, 0), level ground beyond */
  var yg = function (p, x) { return x <= 0 ? p.H : x >= p.Lx ? 0 : p.H * (1 - x / p.Lx); };
  var yw = function (p, x) { return p.w !== 'phr' ? -1e9 : x <= 0 ? p.hw : x >= p.Lx ? 0 : p.hw * (1 - x / p.Lx); };

  function slices(p, xc, yc, R, n) {
    var lo = xc - R, hi = xc + R, N = 240, st = (hi - lo) / N, seg = [], cur = null;
    for (var i = 0; i <= N; i++) { var x = lo + i * st, dx = x - xc, yb = yc - Math.sqrt(Math.max(0, R * R - dx * dx)), ins = yb < yg(p, x) - 1e-6; if (ins && !cur) cur = [x, x]; if (ins) cur[1] = x; if (!ins && cur) { seg.push(cur); cur = null; } }
    if (cur) seg.push(cur); if (!seg.length) return null;
    seg.sort(function (a, b) { return (b[1] - b[0]) - (a[1] - a[0]); }); var a = seg[0][0] - st / 2, b = seg[0][1] + st / 2;
    if (b - a < 0.15 * p.H || a < xc - R || b > xc + R) { a = Math.max(a, xc - R + 1e-6); b = Math.min(b, xc + R - 1e-6); if (b - a < 0.15 * p.H) return null; }
    var out = [], bw = (b - a) / n;
    for (var k = 0; k < n; k++) {
      var xm = a + (k + 0.5) * bw, dx2 = xm - xc, yb2 = yc - Math.sqrt(Math.max(0, R * R - dx2 * dx2)), ygm = yg(p, xm), h = ygm - yb2; if (h <= 0) continue;
      var ywm = yw(p, xm), hb = p.w === 'phr' ? Math.max(0, Math.min(ywm, ygm) - yb2) : 0, ha = h - hb, W = bw * (p.g * ha + p.gs * hb) + (xm <= 0 ? p.q * bw : 0);
      var u = p.w === 'phr' ? GW * Math.max(0, ywm - yb2) : p.w === 'ru' ? p.ru * p.g * h : 0, sa = (xc - xm) / R, ca = Math.sqrt(Math.max(1e-9, 1 - sa * sa));
      out.push({ x: xm, b: bw, h: h, yb: yb2, yt: ygm, W: W, u: u, sa: sa, ca: ca, ym: (ygm + yb2) / 2 });
    }
    return out.length > 3 ? { s: out, a: a, b: b } : null;
  }
  function bishop(p, S, xc, yc, R) {
    var dr = 0; S.forEach(function (s) { dr += s.W * s.sa + p.kh * s.W * (yc - s.ym) / R; }); if (dr <= 1e-6) return null;
    var Fs = 1.2;
    for (var it = 0; it < 60; it++) { var rs = 0; S.forEach(function (s) { var ma = Math.max(0.2, s.ca + s.sa * p.tf / Fs); rs += (p.c * s.b + Math.max(0, s.W - s.u * s.b) * p.tf) / ma; }); var Fn = rs / dr; if (Math.abs(Fn - Fs) < 1e-4) { Fs = Fn; break; } Fs = Fn; }
    return Fs;
  }
  function fellenius(p, S, yc, R) {
    var dr = 0, rs = 0; S.forEach(function (s) { var l = s.b / s.ca; dr += s.W * s.sa + p.kh * s.W * (yc - s.ym) / R; rs += p.c * l + Math.max(0, s.W * s.ca - p.kh * s.W * s.sa - s.u * l) * p.tf; }); return dr > 1e-6 ? rs / dr : null;
  }
  function radii(p, xc, yc) {
    var r = [Math.hypot(xc - p.Lx, yc)], k;
    for (k = 1; k <= 6; k++) { var yd = -p.D * k / 6; if (p.D > 0 && yc - yd > 0) r.push(yc - yd); }
    [0.25, 0.5, 0.75].forEach(function (f) { r.push(Math.hypot(xc - p.Lx * f, yc - p.H * (1 - f))); });
    r.push(Math.hypot(xc - p.Lx - 0.25 * p.H, yc));
    return r.filter(function (R) { return yc - R >= -p.D - 1e-6; });
  }
  function search(p, nG, nS) {
    var x0 = -0.6 * p.H, x1 = p.Lx + 0.6 * p.H, y0 = p.H * 0.6, y1 = p.H * 2.8 + p.Lx * 0.6, best = null, grid = [];
    var test = function (xc, yc, R) { var sl = slices(p, xc, yc, R, nS); if (!sl) return null; var f = bishop(p, sl.s, xc, yc, R); if (f == null || !isFinite(f) || f <= 0) return null; if (!best || f < best.F) best = { F: f, xc: xc, yc: yc, R: R, sl: sl }; return f; };
    for (var i = 0; i < nG; i++) for (var j = 0; j < nG; j++) {
      var xc = x0 + (x1 - x0) * i / (nG - 1), yc = y0 + (y1 - y0) * j / (nG - 1), fm = null;
      radii(p, xc, yc).forEach(function (R) { var f = test(xc, yc, R); if (f != null && (fm == null || f < fm)) fm = f; });
      grid.push({ x: xc, y: yc, F: fm });
    }
    if (best) { /* refine around the best centre with continuous radii */
      var dx = (x1 - x0) / (nG - 1), dy = (y1 - y0) / (nG - 1), b0 = best;
      for (var a = -5; a <= 5; a++) for (var c = -5; c <= 5; c++) { var xc2 = b0.xc + a * dx / 5, yc2 = b0.yc + c * dy / 5; if (yc2 <= 0) continue; for (var f2 = 0.85; f2 <= 1.151; f2 += 0.05) { var R2 = b0.R * f2; if (yc2 - R2 >= -p.D - 1e-6) test(xc2, yc2, R2); } }
      best.Ff = fellenius(p, best.sl.s, best.yc, best.R);
    }
    return { best: best, grid: grid, box: [x0, x1, y0, y1] };
  }

  function run() {
    var p = par(); if (!p) { $('#ssKpis').innerHTML = ''; return; } persist.save();
    var R = search(p, 22, 30); if (!R.best) { $('#ssKpis').innerHTML = ''; $('#ssVerd').innerHTML = G.verdict('warn', t('No valid slip circle', 'لا دائرة انزلاق صالحة'), t('Check the geometry: the height, the angle and the firm layer depth.', 'تحقق من الهندسة: الارتفاع والزاوية وعمق الطبقة الصلبة.')); return; }
    var b = R.best; b.sl = slices(p, b.xc, b.yc, b.R, 40); b.F = bishop(p, b.sl.s, b.xc, b.yc, b.R); b.Ff = fellenius(p, b.sl.s, b.yc, b.R);
    var ang = [], A; for (A = 10; A <= 80; A += 5) { var q = Object.assign({}, p, { b: A, Lx: p.H / Math.tan(SH.rad(A)) }), r0 = search(q, 13, 24), r1 = p.kh > 0 ? search(Object.assign({}, q, { kh: 0 }), 13, 24) : null; ang.push({ b: A, F: r0.best ? r0.best.F : null, F0: r1 && r1.best ? r1.best.F : null }); }
    var safe = null; for (var i = 0; i + 1 < ang.length; i++) { var u0 = ang[i], u1 = ang[i + 1]; if (u0.F != null && u1.F != null && u0.F >= p.Fr && u1.F < p.Fr) { safe = u0.b + (u0.F - p.Fr) / (u0.F - u1.F) * 5; break; } }
    if (safe == null && ang[0].F != null && ang[0].F < p.Fr) safe = -1;
    var inf = p.c === 0 && p.tf > 0 ? p.tf / Math.tan(SH.rad(p.b)) * (p.w === 'ru' ? (1 - p.ru / Math.pow(Math.cos(SH.rad(p.b)), 2)) : 1) : null;
    last = { p: p, R: R, b: b, ang: ang, safe: safe, inf: inf }; render();
  }

  function render() {
    var L0 = last, p = L0.p, b = L0.b, ok = b.F >= p.Fr, depth = -Math.min.apply(null, b.sl.s.map(function (s) { return s.yb; })), deep = b.yc - b.R < -0.05;
    $('#ssKpis').innerHTML = G.kpi(b.F < 1 ? 'bad' : ok ? 'ok' : 'warn', t('Factor of safety (Bishop)', 'معامل الأمان (بيشوب)'), F(b.F, 2), t('required ', 'المطلوب ') + F(p.Fr, 2)) + G.kpi('', t('Ordinary method (Fellenius)', 'الطريقة العادية (فيلينيوس)'), b.Ff != null ? F(b.Ff, 2) : '—', t('usually 5–20 % lower', 'أقل عادة بـ 5–20 %')) +
      G.kpi('info', t('Slip circle', 'دائرة الانزلاق'), 'R ' + F(b.R, 1) + '<small> m</small>', (deep ? t('passes below the toe', 'تمر أسفل القدم') : t('through or above the toe', 'عبر القدم أو أعلاها'))) +
      G.kpi(L0.safe != null && L0.safe < p.b ? 'warn' : 'ok', t('Steepest safe angle', 'أشد زاوية آمنة'), L0.safe == null ? '> 80°' : L0.safe < 0 ? '< 10°' : F(L0.safe, 1) + '°', t('for FS = ', 'عند معامل أمان ') + F(p.Fr, 2) + ' · 1V:' + (L0.safe > 0 ? F(1 / Math.tan(SH.rad(L0.safe)), 2) + 'H' : '—'));
    var v = [];
    if (b.F < 1) v.push(G.verdict('bad', t('The slope is unstable', 'المنحدر غير مستقر'), t('The factor of safety is below 1: the slope would fail along the drawn circle under these conditions. Flatten the face, unload the crest, drain the slope or add a toe berm.', 'معامل الأمان أقل من 1: سينهار المنحدر على امتداد الدائرة المرسومة في هذه الظروف. خفّف ميل الوجه أو أزل الحمل عن الحافة أو صرّف المياه أو أضف ردماً عند القدم.')));
    else if (!ok) v.push(G.verdict('warn', t('Below the required margin', 'أقل من الهامش المطلوب'), t('The slope stands but with less margin than required. Flattening to ', 'المنحدر قائم لكن بهامش أقل من المطلوب. يحقق تخفيف الميل إلى ') + (L0.safe > 0 ? F(L0.safe, 1) + '°' : t('a gentler angle', 'زاوية ألطف')) + t(' would meet it; drainage that lowers the water table often gains as much.', ' الهامش المطلوب، وكثيراً ما يحقق التصريف الذي يخفض منسوب المياه مكسباً مماثلاً.')));
    else v.push(G.verdict('ok', t('Stable with the required margin', 'مستقر بالهامش المطلوب'), t('The lowest factor of safety found is ', 'أدنى معامل أمان وُجد هو ') + F(b.F, 2) + t('. Keep the drainage working: a rise of the water table is the most common trigger of slips in cuts and embankments.', '. حافظ على عمل التصريف؛ فارتفاع منسوب المياه أكثر مسببات الانزلاق شيوعاً في الحفريات والسداد.')));
    if (L0.inf != null) v.push(G.verdict(L0.inf < p.Fr ? 'warn' : 'info', t('Shallow surface slip (c′ = 0)', 'انزلاق سطحي ضحل (c′ = 0)'), t('For cohesionless soil the face itself has FS = tan φ′ / tan β ', 'للتربة غير المتماسكة يكون معامل أمان الوجه نفسه tan φ′ / tan β ') + (p.w === 'ru' ? t('reduced by ru ', 'مخفضاً بنسبة ru ') : '') + '= ' + F(L0.inf, 2) + t('; surface ravelling starts before a deep slip.', '؛ ويبدأ تساقط السطح قبل الانزلاق العميق.')));
    if (p.kh > 0) { var a0 = L0.ang.filter(function (a) { return a.b === Math.round(p.b / 5) * 5; })[0]; v.push(G.verdict('info', t('Earthquake loading included', 'الحمل الزلزالي مشمول'), t('A horizontal force kh·W acts on every slice. Pseudo-static analysis is conservative for short shaking but does not give the displacement; if FS < 1, estimate the permanent movement (Newmark sliding block).', 'تؤثر قوة أفقية kh·W على كل شريحة. التحليل شبه الساكن متحفظ للاهتزاز القصير لكنه لا يعطي الإزاحة؛ وإن كان المعامل أقل من 1 فقدّر الحركة الدائمة (كتلة نيومارك المنزلقة).') + (a0 && a0.F0 ? t(' Without the earthquake FS ≈ ', ' ودون الزلزال يكون المعامل ≈ ') + F(a0.F0, 2) + '.' : ''))); }
    $('#ssVerd').innerHTML = v.join('');
    figSec(); figAng(); tables();
  }

  function figSec() {
    var L0 = last, p = L0.p, b = L0.b, svg = $('#ssSec'), W = 900, m = { l: 30, r: 30, t: 20, b: 20 };
    var xmin = Math.min(-0.8 * p.H, b.sl.a - 0.25 * p.H), xmax = Math.max(p.Lx + 0.9 * p.H, b.sl.b + 0.25 * p.H), ymin = -p.D - 0.15 * p.H - 0.5, ymax = Math.max(p.H * 1.3, Math.min(b.yc + 0.15 * p.H, p.H * 2.2));
    var PW = W - m.l - m.r, k = PW / (xmax - xmin), PH = (ymax - ymin) * k; if (PH > 560) { k = 560 / (ymax - ymin); PH = 560; } var H = m.t + PH + 130, ox = m.l + (PW - (xmax - xmin) * k) / 2;
    var X = function (x) { return ox + (x - xmin) * k; }, Y = function (y) { return m.t + (ymax - y) * k; }, s = '<defs>' + G.hatch('ssSoil', '#9C7A4A', '#E9DCC0', 'clay') + G.hatch('ssRock', '#6B6B6B', '#D5D5D2', 'rock') + '<clipPath id="ssClip"><rect x="' + X(xmin) + '" y="' + Y(ymax) + '" width="' + (X(xmax) - X(xmin)) + '" height="' + (Y(ymin) - Y(ymax)) + '"/></clipPath></defs>';
    s += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    var gnd = 'M' + X(xmin) + ' ' + Y(p.H) + 'L' + X(0) + ' ' + Y(p.H) + 'L' + X(p.Lx) + ' ' + Y(0) + 'L' + X(xmax) + ' ' + Y(0);
    s += '<path d="' + gnd + 'L' + X(xmax) + ' ' + Y(-p.D) + 'L' + X(xmin) + ' ' + Y(-p.D) + 'Z" fill="url(#ssSoil)" stroke="none"/>';
    if (p.D >= 0) s += '<rect x="' + X(xmin) + '" y="' + Y(-p.D) + '" width="' + (X(xmax) - X(xmin)) + '" height="' + (Y(ymin) - Y(-p.D)) + '" fill="url(#ssRock)"/>';
    /* centre grid */
    s += '<g clip-path="url(#ssClip)">'; var Fr = p.Fr; L0.R.grid.forEach(function (g) { if (g.F == null) return; var col = g.F < 1 ? '#C0392B' : g.F < Fr ? '#E67E22' : g.F < Fr * 1.3 ? '#B9C93A' : '#2E8B57'; s += '<rect x="' + (X(g.x) - 3) + '" y="' + (Y(g.y) - 3) + '" width="6" height="6" fill="' + col + '" opacity=".8"/>'; });
    s += '</g>';
    /* failing mass */
    var sl = b.sl.s, a = b.sl.a, bb = b.sl.b, arc = '';
    for (var i = 0; i <= 60; i++) { var x = a + (bb - a) * i / 60, yb = b.yc - Math.sqrt(Math.max(0, b.R * b.R - (x - b.xc) * (x - b.xc))); arc += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(Math.min(yb, yg(p, x))).toFixed(1); }
    var top = ''; for (i = 60; i >= 0; i--) { var x2 = a + (bb - a) * i / 60; top += 'L' + X(x2).toFixed(1) + ' ' + Y(yg(p, x2)).toFixed(1); }
    s += '<path d="' + arc + top + 'Z" fill="#C0392B" fill-opacity=".18"/>';
    sl.forEach(function (q) { var xl = q.x - q.b / 2; s += '<line x1="' + X(xl) + '" x2="' + X(xl) + '" y1="' + Y(yg(p, xl)) + '" y2="' + Y(b.yc - Math.sqrt(Math.max(0, b.R * b.R - (xl - b.xc) * (xl - b.xc)))) + '" stroke="#C0392B" stroke-width=".6" opacity=".7"/>'; });
    s += '<path d="' + arc + '" fill="none" stroke="#C0392B" stroke-width="2.6"/>';
    s += '<path d="' + gnd + '" fill="none" stroke="' + G.INK + '" stroke-width="2"/>';
    if (p.w === 'phr') { s += '<path d="M' + X(xmin) + ' ' + Y(p.hw) + 'L' + X(0) + ' ' + Y(p.hw) + 'L' + X(p.Lx) + ' ' + Y(0) + 'L' + X(xmax) + ' ' + Y(0) + '" fill="none" stroke="#2E6FBF" stroke-width="2" stroke-dasharray="8 5"/>'; var wx = X(xmin + 0.35 * (0 - xmin)), wy = Y(p.hw); s += '<path d="M' + wx + ' ' + (wy - 2) + 'l-6 -9h12z" fill="#2E6FBF"/><line x1="' + (wx - 6) + '" x2="' + (wx + 6) + '" y1="' + (wy + 4) + '" y2="' + (wy + 4) + '" stroke="#2E6FBF"/>'; }
    if (p.q > 0) for (var qx = xmin + 0.1 * (0 - xmin); qx < -0.05 * p.H; qx += (0 - xmin) / 7) s += '<path d="M' + X(qx) + ' ' + (Y(p.H) - 26) + 'v20" stroke="' + G.INK + '" stroke-width="1.4"/><path d="M' + (X(qx) - 4) + ' ' + (Y(p.H) - 9) + 'l4 7l4 -7z" fill="' + G.INK + '"/>';
    if (p.q > 0) s += G.tx(X(xmin + 0.5 * (0 - xmin)), Y(p.H) - 32, 'q = ' + F(p.q, 0) + ' kPa', { anchor: 'middle', fs: 11.5, fw: 700 });
    /* centre and radii */
    var inC = b.yc <= ymax; s += '<g clip-path="url(#ssClip)"><line x1="' + X(b.xc) + '" y1="' + Y(b.yc) + '" x2="' + X(a) + '" y2="' + Y(yg(p, a)) + '" stroke="' + G.INK + '" stroke-dasharray="4 3" stroke-width=".9"/><line x1="' + X(b.xc) + '" y1="' + Y(b.yc) + '" x2="' + X(bb) + '" y2="' + Y(yg(p, bb)) + '" stroke="' + G.INK + '" stroke-dasharray="4 3" stroke-width=".9"/></g>';
    s += inC ? '<circle cx="' + X(b.xc) + '" cy="' + Y(b.yc) + '" r="5" fill="#fff" stroke="#C0392B" stroke-width="2"/>' + G.tx(X(b.xc) + 9, Y(b.yc) - 8, 'FS = ' + F(b.F, 2), { fw: 800, fs: 13, fill: '#C0392B', halo: 1 }) : G.tx(Math.min(Math.max(X(b.xc), X(xmin) + 60), X(xmax) - 60), Y(ymax) + 16, 'FS = ' + F(b.F, 2) + ' · centre above the frame', { fw: 800, fs: 12.5, fill: '#C0392B', anchor: 'middle', halo: 1 });
    /* dimensions */
    s += '<line x1="' + (X(p.Lx) + 14) + '" x2="' + (X(p.Lx) + 14) + '" y1="' + Y(0) + '" y2="' + Y(p.H) + '" stroke="' + G.MUT + '"/>' + G.tx(X(p.Lx) + 20, Y(p.H / 2) + 4, 'H = ' + F(p.H, 1) + ' m', { fs: 11.5, fill: G.INK, halo: 1 });
    var ar = 26; s += '<path d="M' + (X(p.Lx) - ar) + ' ' + Y(0) + 'A' + ar + ' ' + ar + ' 0 0 1 ' + (X(p.Lx) - ar * Math.cos(SH.rad(p.b))) + ' ' + (Y(0) - ar * Math.sin(SH.rad(p.b))) + '" fill="none" stroke="' + G.MUT + '"/>' + G.tx(X(p.Lx) - ar - 8, Y(0) - 6, 'β = ' + F(p.b, 1) + '°', { fs: 11.5, fill: G.INK, anchor: 'end', halo: 1 });
    s += G.tx(X(xmin) + 6, Y(-p.D) + 15, 'Firm layer', { fs: 11, fill: G.INK, fw: 700 }) + G.tx(X(xmax) - 6, Y(p.H * 0.5 > 0 ? -p.D * 0.5 : 0) + 4, 'c′ = ' + F(p.c, 1) + ' kPa · φ′ = ' + F(p.phi, 1) + '° · γ = ' + F(p.g, 1) + ' kN/m³', { fs: 11, anchor: 'end', halo: 1 });
    s += '<rect x="' + X(xmin) + '" y="' + Y(ymax) + '" width="' + (X(xmax) - X(xmin)) + '" height="' + (Y(ymin) - Y(ymax)) + '" fill="none" stroke="' + G.INK + '" stroke-width="1.2"/>';
    /* scale and legend below */
    var ly = m.t + PH + 30; s += G.scaleBar(m.l, ly, k, 160) + G.tx(W - m.r, ly + 7, 'Section to true scale (H : V = 1 : 1)', { anchor: 'end', fs: 11, fill: G.MUT });
    var it = [['Critical slip circle and slices', '#C0392B', 'line'], ['Sliding mass', '#C0392B', 'box'], ['Search centre, FS < 1', '#C0392B', 'sq'], ['Centre, FS 1 to required', '#E67E22', 'sq'], ['Centre, FS required to 1.3 ×', '#B9C93A', 'sq'], ['Centre, FS higher', '#2E8B57', 'sq']];
    if (p.w === 'phr') it.push(['Water table', '#2E6FBF', 'dash']);
    it.forEach(function (q, j) { var x = m.l + (j % 3) * 290, y = ly + 34 + Math.floor(j / 3) * 20; s += q[2] === 'line' ? '<line x1="' + x + '" x2="' + (x + 20) + '" y1="' + (y - 4) + '" y2="' + (y - 4) + '" stroke="' + q[1] + '" stroke-width="2.6"/>' : q[2] === 'dash' ? '<line x1="' + x + '" x2="' + (x + 20) + '" y1="' + (y - 4) + '" y2="' + (y - 4) + '" stroke="' + q[1] + '" stroke-width="2" stroke-dasharray="6 4"/>' : q[2] === 'box' ? '<rect x="' + x + '" y="' + (y - 10) + '" width="20" height="12" fill="' + q[1] + '" fill-opacity=".18" stroke="' + q[1] + '"/>' : '<rect x="' + (x + 6) + '" y="' + (y - 8) + '" width="8" height="8" fill="' + q[1] + '"/>'; s += G.tx(x + 28, y, q[0], { fs: 11.5 }); });
    var HH = ly + 34 + Math.ceil(it.length / 3) * 20 + 4; s = s.replace('<rect width="' + W + '" height="' + H + '"', '<rect width="' + W + '" height="' + HH + '"');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + HH); svg.innerHTML = s;
    $('#ssSecCap').textContent = t('The red circle is the slip surface with the lowest factor of safety among all centres tried (coloured squares, each showing the lowest value for that centre). ', 'الدائرة الحمراء سطح الانزلاق ذو أدنى معامل أمان بين كل المراكز المجربة (المربعات الملونة، وكل منها يمثل أدنى قيمة لذلك المركز). ') + (b.yc - b.R < -0.05 ? t('It passes below the toe, a deep failure typical of weak clay over a firm base.', 'وهي تمر أسفل القدم، وهو انهيار عميق معتاد في الطين الضعيف فوق قاعدة صلبة.') : t('It leaves the ground at or above the toe, the usual mode in frictional soils.', 'وتخرج من الأرض عند القدم أو أعلاها، وهو النمط المعتاد في الترب الاحتكاكية.'));
  }
  function figAng() {
    var L0 = last, p = L0.p, A = L0.ang.filter(function (a) { return a.F != null; }), all = A.map(function (a) { return Math.min(a.F, 4); }).concat(A.filter(function (a) { return a.F0; }).map(function (a) { return Math.min(a.F0, 4); }), [p.Fr, 0]), y = G.span(all, { zero: true });
    var ser = [{ pts: A.map(function (a) { return [a.b, Math.min(a.F, 4.5)]; }), col: '#C0392B', w: 2.4, mark: 'o' }], lg = [{ name: p.kh > 0 ? 'Bishop FS with kh = ' + F(p.kh, 2) : 'Bishop FS', col: '#C0392B', mark: 'o' }];
    if (p.kh > 0) { ser.push({ pts: A.filter(function (a) { return a.F0; }).map(function (a) { return [a.b, Math.min(a.F0, 4.5)]; }), col: '#2E6FBF', w: 2, dash: '6 4' }); lg.push({ name: 'Bishop FS without earthquake', col: '#2E6FBF', dash: '6 4' }); }
    lg.push({ name: 'Required FS', col: '#2E8B57', dash: '8 4' }, { name: 'Present slope angle', col: G.INK, dash: '3 3' });
    G.chart($('#ssAng'), { W: 760, H: 400, x: { lo: 10, hi: 80, st: 10, title: 'Slope angle β (°)' }, y: { lo: 0, hi: Math.min(4.5, y.hi), title: 'Factor of safety FS' }, series: ser, hl: [{ v: p.Fr, col: '#2E8B57', dash: '8 4', label: 'FS = ' + F(p.Fr, 2) }, { v: 1, col: '#C0392B', w: .8 }], vl: [{ v: p.b, col: G.INK, dash: '3 3' }].concat(L0.safe > 0 ? [{ v: L0.safe, col: '#2E8B57', w: 1, label: F(L0.safe, 1) + '°' }] : []), legend: lg, note: 'Same height, soil, water and loads as the section; each point is a full circle search.' });
    $('#ssAngCap').textContent = t('Each point repeats the full search for a slope of the same height at another angle. Where the curve crosses the required line is the steepest face that meets the design margin; values above 4.5 are cut.', 'تعيد كل نقطة البحث الكامل لمنحدر بالارتفاع نفسه وبزاوية أخرى. ونقطة تقاطع المنحنى مع خط المعامل المطلوب هي أشد وجه يحقق هامش التصميم؛ والقيم فوق 4.5 مقطوعة.');
  }
  function tables() {
    var L0 = last, p = L0.p, b = L0.b, rows = [[t('Simplified Bishop (moment equilibrium, interslice normal forces)', 'بيشوب المبسطة (توازن العزوم مع القوى العمودية بين الشرائح)'), F(b.F, 3), t('Standard for circular slips; within about 5 % of rigorous methods.', 'المعيار للانزلاقات الدائرية؛ ضمن نحو 5 % من الطرق الدقيقة.')], [t('Ordinary method of slices (Fellenius)', 'طريقة الشرائح العادية (فيلينيوس)'), b.Ff != null ? F(b.Ff, 3) : '—', t('Ignores interslice forces; conservative, more so with high pore pressure.', 'تهمل القوى بين الشرائح؛ متحفظة، وأكثر مع ضغط المسام العالي.')]];
    if (L0.inf != null) rows.push([t('Infinite slope, surface slip (c′ = 0)', 'منحدر لانهائي، انزلاق سطحي (c′ = 0)'), F(L0.inf, 3), t('Shallow ravelling of the face.', 'تساقط ضحل للوجه.')]);
    $('#ssTbl').innerHTML = '<thead><tr><th>' + t('Method', 'الطريقة') + '</th><th class="num">FS</th><th>' + t('Note', 'ملاحظة') + '</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="num"><b>' + r[1] + '</b></td><td class="xsmall">' + r[2] + '</td></tr>'; }).join('') + '</tbody>';
    $('#ssSl').innerHTML = '<thead><tr><th>#</th><th class="num">x m</th><th class="num">b m</th><th class="num">h m</th><th class="num">W kN/m</th><th class="num">α °</th><th class="num">u kPa</th></tr></thead><tbody>' + b.sl.s.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td class="num">' + F(s.x, 2) + '</td><td class="num">' + F(s.b, 2) + '</td><td class="num">' + F(s.h, 2) + '</td><td class="num">' + F(s.W, 1) + '</td><td class="num">' + F(SH.deg(Math.asin(s.sa)), 1) + '</td><td class="num">' + F(s.u, 1) + '</td></tr>'; }).join('') + '</tbody>';
  }
  $('#ssCsv').addEventListener('click', function () { if (!last) return; var b = last.b; SH.csv('shandal-slope-slices.csv', [['slice', 'x_m', 'width_m', 'height_m', 'W_kN_per_m', 'alpha_deg', 'u_kPa']].concat(b.sl.s.map(function (s, i) { return [i + 1, s.x.toFixed(3), s.b.toFixed(3), s.h.toFixed(3), s.W.toFixed(2), SH.deg(Math.asin(s.sa)).toFixed(2), s.u.toFixed(2)]; })).concat([[], ['FS_Bishop', b.F.toFixed(3)], ['FS_Fellenius', b.Ff != null ? b.Ff.toFixed(3) : ''], ['centre_x_m', b.xc.toFixed(2)], ['centre_y_m', b.yc.toFixed(2)], ['radius_m', b.R.toFixed(2)]])); });
  function wvis() { var w = $('#ssW').value; $('#ssHw').closest('.fg').style.display = w === 'phr' ? '' : 'none'; $('#ssRu').closest('.fg').style.display = w === 'ru' ? '' : 'none'; }
  var tm = null; function later() { clearTimeout(tm); tm = setTimeout(run, 250); }
  IDS.forEach(function (id) { var e = $('#' + id); e.addEventListener('input', later); e.addEventListener('change', function () { wvis(); later(); }); });
  $('#ssDemo').addEventListener('click', function () { G.set({ ssH: 12, ssB: 34, ssQ: 15, ssD: 6, ssC: 12, ssF: 24, ssG: 19, ssGs: 20, ssW: 'phr', ssHw: 7, ssK: 0.08, ssFr: 1.5 }); wvis(); run(); });
  document.addEventListener('DOMContentLoaded', function () { wvis(); run(); });
})();
