/* Lesson: convergent plate boundaries — ocean–continent subduction (Andes), ocean–ocean subduction (Japan,
   Marianas) and continent–continent collision (Zagros, Himalaya). */
(function () {
  var S = window.SHL, T = S.t, SEA = 150, TH = 54;
  function slab(x0, y0, L) { var P = [[x0, y0]], x = x0, y = y0; for (var s = 6; s <= L; s += 6) { var a = S.rad(8 + 37 * Math.min(1, s / 260)); x += 6 * Math.cos(a); y += 6 * Math.sin(a); P.push([x, y]); } return P; }
  S.rad = function (d) { return d * Math.PI / 180; };
  function offset(P, d) { return P.map(function (p, i) { var q = P[Math.min(P.length - 1, i + 1)], r = P[Math.max(0, i - 1)], dx = q[0] - r[0], dy = q[1] - r[1], L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * d, p[1] + dx / L * d]; }); }
  function slabY(P, x) { for (var i = 1; i < P.length; i++) if (P[i][0] >= x) { var f = (x - P[i - 1][0]) / ((P[i][0] - P[i - 1][0]) || 1); return P[i - 1][1] + f * (P[i][1] - P[i - 1][1]); } return null; }
  function plate(t, x0, yT, P, v) {
    var top = [[-10, yT]].concat(P), bot = [[-10, yT + TH]].concat(offset(P, TH).slice(0)), g = '', cr = offset(P, 14);
    g += '<path d="' + S.pathD(top.concat(bot.slice().reverse()), true) + '" fill="#4A5A6A"/>';
    g += S.body(S.pathD(top.concat(([[-10, yT + 14]].concat(cr)).reverse()), true), 'ocean');
    g += '<path d="' + S.pathD(top) + '" stroke="#fff" stroke-width="3" fill="none" stroke-dasharray="5 30" stroke-dashoffset="' + S.f(-t * v) + '" opacity=".8"/>';
    return g; }
  function quakesAlong(t, P, n, seed) { var R = S.rnd(seed), o = ''; for (var i = 0; i < n; i++) { var k = Math.floor(R() * P.length), p = P[k], ph = R() * 9, a = Math.max(0, Math.sin((t + ph) * 2.4)); if (a < 0.75 || !p) continue; var y = p[1] + 6 + R() * 16, col = y < 300 ? '#FFD60A' : y < 400 ? '#FF8C00' : '#E63946';
      o += '<circle cx="' + S.f(p[0] + 4) + '" cy="' + S.f(y) + '" r="5" fill="' + col + '" stroke="#222" stroke-width=".8" opacity="' + ((a - 0.75) / 0.25).toFixed(2) + '"/>'; } return o; }
  function volcano(x, y, h, t, on, wf) { wf = wf || 2.2; var g = '<path d="M' + S.f(x - wf * h) + ' ' + S.f(y + 4) + 'L' + S.f(x - 7) + ' ' + S.f(y - h) + 'L' + S.f(x + 7) + ' ' + S.f(y - h) + 'L' + S.f(x + wf * h) + ' ' + S.f(y + 4) + 'Z" fill="#6B5E57" stroke="#3a302b" stroke-width="1"/>';
    if (on) { g += '<path d="M' + S.f(x - 6) + ' ' + S.f(y - h) + 'q6 ' + S.f(h * 0.5) + ' 2 ' + S.f(h * 0.9) + '" stroke="#FF7A1A" stroke-width="4" fill="none"/>'; for (var i = 0; i < 6; i++) { var f = ((t * 0.5 + i / 6) % 1); g += '<circle cx="' + S.f(x + 10 * Math.sin(i * 2 + t) + f * 30) + '" cy="' + S.f(y - h - 10 - f * 70) + '" r="' + S.f(6 + f * 12) + '" fill="#8E8E8E" opacity="' + S.f(0.6 * (1 - f)) + '"/>'; } }
    return g; }
  function magma(t, P, xv, yv) { var src = null; for (var i = 0; i < P.length; i++) if (P[i][1] > 390) { src = P[i]; break; } if (!src) return ''; var g = '';
    for (var k = 0; k < 6; k++) { var f = ((t * 0.25 + k / 6) % 1), x = S.lerp(src[0] - 10, xv, f), y = S.lerp(src[1] - 10, yv + 10, f); g += '<ellipse cx="' + S.f(x) + '" cy="' + S.f(y) + '" rx="' + S.f(9 - f * 4) + '" ry="' + S.f(12 - f * 5) + '" fill="url(#gMagma)" opacity=".9"/>'; }
    return g + '<circle cx="' + S.f(src[0]) + '" cy="' + S.f(src[1] - 6) + '" r="14" fill="url(#gMagma)" opacity=".8"/>'; }
  var STEPS = {
    oc: [
      { t: 0, en_h: 'Ocean meets continent', ar_h: 'محيط يلتقي قارة', en: 'Two plates move towards each other. Oceanic lithosphere is denser than continental, so it bends down and sinks beneath it.', ar: 'تتحرك صفيحتان نحو بعضهما. الليثوسفير المحيطي أكثف من القاري، فينحني ويغوص تحته.' },
      { t: 4, en_h: 'Trench and slab', ar_h: 'الخندق واللوح', en: 'Where it bends a deep trench forms; the sinking plate (the slab) descends into the mantle at a steepening angle.', ar: 'حيث تنحني الصفيحة يتكوّن خندق عميق، وتنزل الصفيحة الغائصة (اللوح) في الوشاح بزاوية تزداد انحداراً.' },
      { t: 8, en_h: 'Earthquakes', ar_h: 'الزلازل', en: 'Earthquakes follow the slab from shallow to as deep as 700 km: the Wadati–Benioff zone. Colour shows depth.', ar: 'تتبع الزلازل اللوح من الأعماق الضحلة حتى 700 كم: نطاق واداتي–بنيوف. ويدل اللون على العمق.' },
      { t: 12, en_h: 'Volcanic arc', ar_h: 'القوس البركاني', en: 'At about 100 km depth the slab releases water, which lowers the melting point of the mantle wedge above it; the magma rises to build a chain of volcanoes.', ar: 'عند عمق نحو 100 كم يطلق اللوح الماء، فيخفض درجة انصهار الوتد الوشاحي فوقه، وتصعد الصهارة لتبني سلسلة براكين.' },
      { t: 18, en_h: 'Mountains', ar_h: 'الجبال', en: 'Compression and magma thicken the continental edge into a mountain range with volcanoes — the Andes.', ar: 'يثخّن الانضغاط والصهارة حافة القارة إلى سلسلة جبلية ذات براكين — جبال الأنديز.' }],
    arc: [
      { t: 0, en_h: 'Ocean meets ocean', ar_h: 'محيط يلتقي محيطاً', en: 'Two oceanic plates converge; the older, colder and denser one sinks beneath the other.', ar: 'تتقارب صفيحتان محيطيتان، فتغوص الأقدم والأبرد والأكثف تحت الأخرى.' },
      { t: 5, en_h: 'Trench', ar_h: 'الخندق', en: 'The deepest places on Earth are such trenches: the Mariana Trench is about 11 km deep.', ar: 'أعمق أماكن الأرض هي هذه الخنادق: خندق ماريانا بعمق نحو 11 كم.' },
      { t: 9, en_h: 'Island arc', ar_h: 'قوس جزر', en: 'Magma from above the slab builds volcanoes on the sea floor that grow until they rise above the sea as a curved chain of islands.', ar: 'تبني الصهارة من فوق اللوح براكين على قاع البحر تنمو حتى ترتفع فوق سطح البحر سلسلةً مقوسة من الجزر.' },
      { t: 17, en_h: 'Examples', ar_h: 'أمثلة', en: 'Japan, the Mariana Islands and the Aleutians are island arcs, with deep earthquakes beneath them.', ar: 'اليابان وجزر ماريانا والأليوشيان أقواس جزر، تحتها زلازل عميقة.' }],
    col: [
      { t: 0, en_h: 'A closing ocean', ar_h: 'محيط ينغلق', en: 'The Neo-Tethys Ocean lay between Arabia and Iran. Its floor sank beneath Iran, carrying Arabia northwards.', ar: 'كان محيط التيثس الجديد يفصل بين الصفيحة العربية وإيران. غاص قاعه تحت إيران حاملاً الصفيحة العربية شمالاً.' },
      { t: 9, en_h: 'Continents collide', ar_h: 'تصادم القارتين', en: 'When the ocean was used up the two continents met. Continental crust is too light to sink far, so it crumples instead.', ar: 'عندما استُهلك المحيط التقت القارتان. القشرة القارية أخف من أن تغوص عميقاً، فتنضغط وتتجعد بدلاً من ذلك.' },
      { t: 12, en_h: 'Folds and thrusts', ar_h: 'الطيات والدسر', en: 'The layers on the Arabian edge fold into long anticlines and synclines and stack along thrust faults: the Zagros fold-thrust belt of Kurdistan and Iran.', ar: 'تنطوي الطبقات على حافة الصفيحة العربية في طيات محدبة ومقعرة طويلة وتتراكب على صدوع دسر: حزام طيات ودسر زاغروس في كردستان وإيران.' },
      { t: 16, en_h: 'Suture and root', ar_h: 'الخياطة والجذر', en: 'Slices of old ocean floor (ophiolites) are pushed onto the margin along the suture; the crust thickens into a deep root and the sinking slab may break off.', ar: 'تُدفع شرائح من قاع المحيط القديم (أوفيوليت) فوق الحافة على طول نطاق الخياطة، وتتثخن القشرة في جذر عميق وقد ينفصل اللوح الغائص.' },
      { t: 21, en_h: 'Still active', ar_h: 'ما زال نشطاً', en: 'Arabia still moves north about 2 cm a year: the earthquakes of the Zagros and the oil traps in its anticlines are both results of this collision.', ar: 'ما زالت الصفيحة العربية تتحرك شمالاً نحو 2 سم في السنة: وزلازل زاغروس ومصائد النفط في طياتها المحدبة كلها نتائج هذا التصادم.' }]
  };
  function sub(t, mode) {
    var out = '', TR = 430, yT = mode === 'arc' ? 236 : 236, L = 230 + 9 * t, P = slab(TR, yT, L), v = 22;
    out += '<rect x="0" y="250" width="960" height="290" fill="url(#gMantle)"/>';
    out += '<rect x="0" y="' + SEA + '" width="' + (mode === 'arc' ? 960 : TR + 70) + '" height="' + (yT + 6 - SEA) + '" fill="url(#gSea)" opacity=".85"/>';
    var Pf = [[TR - 120, yT]].concat(P), plt = [[-10, yT]].concat(P.slice());
    out += plate(t, TR, yT, P, v);
    /* overriding plate */
    var xs = [], x; for (x = TR - 4; x <= 970; x += 6) xs.push(x);
    if (mode === 'oc') { var H = 80 * S.ease(S.seg(t, 2, 20)), mt = function (x) { return H * Math.exp(-Math.pow((x - 690) / 130, 2)); };
      var top = xs.map(function (x) { return [x, x < TR + 90 ? S.lerp(yT - 2, 178, (x - TR) / 90) - mt(x) * S.clamp((x - TR) / 90, 0, 1) : 178 - mt(x)]; }), bot = xs.map(function (x) { var sy = slabY(P, x); var b = 330 + 0.9 * mt(x); return [x, sy != null ? Math.min(b, sy - 2) : b]; });
      out += S.body(S.pathD(top.concat(bot.slice().reverse()), true), 'granite') + S.body(S.pathD(top.concat(top.map(function (p) { return [p[0], p[1] + 22]; }).reverse()), true), 'sand');
      var vy = 178 - mt(690); out += magma(t, P, 690, vy) + volcano(690, vy, 34 * S.seg(t, 9, 13), t, t > 12);
      out += S.text(820, 160 - mt(820), T('the Andes', 'الأنديز'), { size: 15 }) + S.text(800, 300, T('continental crust', 'قشرة قارية'), { size: 14 }) + S.arrow(900, 120, 840, 120, '#1B232B', 4);
    } else { var top2 = xs.map(function (x) { return [x, x < TR + 60 ? S.lerp(yT + 4, 232, (x - TR) / 60) : 232]; }), bot2 = xs.map(function (x) { var sy = slabY(P, x); return [x, sy != null ? Math.min(286, sy - 2) : 286]; });
      out += S.body(S.pathD(top2.concat(bot2.slice().reverse()), true), 'ocean');
      out += '<rect x="' + (TR + 60) + '" y="' + SEA + '" width="' + (970 - TR - 60) + '" height="' + (232 - SEA) + '" fill="url(#gSea)" opacity=".85"/>';
      var hv = 120 * S.ease(S.seg(t, 9, 17)); out += magma(t, P, 690, 232) + volcano(690, 232, hv, t, hv > 85, 0.95);
      if (hv > 85) out += S.text(690, 232 - hv - 28, T('island arc', 'قوس جزر'), { size: 15 });
      out += S.arrow(900, 200, 840, 200, '#fff', 4); }
    out += quakesAlong(t, P.filter(function (p, i) { return i * 6 < L - 10; }), 46, 5);
    out += S.arrow(140, 205, 240, 205, '#fff', 5);
    out += S.text(TR, yT + 34, T('trench', 'الخندق'), { size: 14, fill: '#fff', halo: false });
    var mid = P[Math.min(P.length - 1, 45)]; if (mid) out += S.text(mid[0] - 70, mid[1] + 60, T('sinking slab', 'اللوح الغائص'), { size: 14, fill: '#fff', halo: false });
    if (t > 8) { var dp = P[Math.min(P.length - 1, 70)]; if (dp) out += S.text(dp[0] + 70, dp[1] - 6, T('Wadati–Benioff zone', 'نطاق واداتي–بنيوف'), { size: 13, ext: 'right' }); }
    out += S.text(120, 470, T('mantle', 'الوشاح'), { size: 15, fill: '#fff', halo: false });
    return out;
  }
  function col(t) {
    var out = '', TR = 470, cl = S.ease(S.seg(t, 0, 9)), E = S.lerp(170, TR - 6, cl), coll = S.ease(S.seg(t, 9, 22)), L = 210 + 8 * Math.min(t, 15), brk = S.seg(t, 16, 24);
    out += '<rect x="0" y="250" width="960" height="290" fill="url(#gMantle)"/>';
    /* oceanic remnant and slab */
    var P = slab(TR, 248, L), dy = 60 * brk;
    if (cl < 1) out += '<rect x="' + S.f(E) + '" y="206" width="' + S.f(TR + 40 - E) + '" height="44" fill="url(#gSea)" opacity=".85"/>';
    var oc = [[E - 10, 248]].concat(P), ob = offset(oc, 46);
    out += '<g transform="translate(' + S.f(brk * 18) + ' ' + S.f(dy) + ')" opacity="' + S.f(1 - 0.35 * brk) + '"><path d="' + S.pathD(oc.concat(ob.slice().reverse()), true) + '" fill="#4A5A6A"/>' + S.body(S.pathD(oc.concat(offset(oc, 12).reverse()), true), 'ocean') + '</g>';
    if (brk > 0.2) out += S.text(P[40][0] + 80, P[40][1] + dy + 40, T('slab breaks off', 'انفصال اللوح'), { size: 13, fill: '#fff', halo: false });
    /* Arabian plate: basement and folded cover */
    var xa = []; for (var x = -10; x <= E; x += 5) xa.push(x);
    var up = function (x) { return 34 * coll * S.clamp((x - 120) / (E - 120), 0, 1); }, A = function (x) { return 22 * coll * S.clamp((x - 70) / (E - 70), 0, 1); };
    var bTop = xa.map(function (x) { var edge = S.clamp((E - x) / 60, 0, 1); return [x, 232 - up(x) * 0.6 + (1 - edge) * 18]; }), bBot = xa.map(function (x) { return [x, 320 + 40 * coll * Math.exp(-Math.pow((x - E) / 120, 2))]; });
    var cTop = xa.map(function (x) { var edge = S.clamp((E - x) / 60, 0, 1); return [x, 204 - up(x) - A(x) * Math.sin((x - 60) / 17) + (1 - edge) * 30]; }), cBot = xa.map(function (x, i) { return [x, cTop[i][1] + 28 - 6 * (1 - S.clamp((E - x) / 60, 0, 1))]; });
    var cMid = cTop.map(function (p, i) { return [p[0], (p[1] + cBot[i][1]) / 2]; });
    out += S.body(S.pathD(cBot.concat(bBot.slice().reverse()), true), 'granite');
    out += S.body(S.pathD(cTop.concat(cMid.slice().reverse()), true), 'lime') + S.body(S.pathD(cMid.concat(cBot.slice().reverse()), true), 'sand');
    /* thrusts inside the folded belt */
    if (coll > 0.3) [E - 70, E - 150, E - 230].forEach(function (xf, k) { var f = S.seg(coll, 0.3 + k * 0.15, 0.6 + k * 0.15); if (f <= 0) return; var i = Math.max(0, Math.round((xf + 10) / 5)); var p = cTop[Math.min(i, cTop.length - 1)]; out += '<path d="M' + S.f(p[0] - 30) + ' ' + S.f(p[1] + 70) + 'Q' + S.f(p[0] - 8) + ' ' + S.f(p[1] + 30) + ' ' + S.f(p[0] + 6) + ' ' + S.f(p[1]) + '" stroke="#7B1E12" stroke-width="2.4" fill="none" opacity="' + f.toFixed(2) + '"/>'; });
    /* Iranian plate with rising mountains and a deep root */
    var xi = []; for (var x2 = cl < 1 ? TR - 4 : Math.min(TR - 4, E - 2); x2 <= 970; x2 += 6) xi.push(x2);
    var Hm = 90 * coll, m = function (x) { return Hm * Math.exp(-Math.pow((x - 600) / 140, 2)); };
    var iTop = xi.map(function (x) { return [x, (x < TR + 50 ? S.lerp(240, 200, (x - TR) / 50) : 200) - m(x)]; }), iBot = xi.map(function (x) { var sy = slabY(P, x); var b = 320 + 1.3 * m(x); return [x, sy != null && cl < 1 ? Math.min(b, sy + dy - 2) : b]; });
    out += S.body(S.pathD(iTop.concat(iBot.slice().reverse()), true), 'meta') + S.body(S.pathD(iTop.concat(iTop.map(function (p) { return [p[0], p[1] + 20]; }).reverse()), true), 'shale');
    /* ophiolite pushed onto the margin */
    var of = S.seg(t, 11, 15); if (of > 0) { var x0 = TR - 70 - 40 * of, yb = cTop[Math.max(0, Math.min(cTop.length - 1, Math.round((x0 + 10) / 5)))][1];
      out += '<path d="M' + S.f(x0) + ' ' + S.f(yb + 2) + 'Q' + S.f(x0 + 40) + ' ' + S.f(yb - 20) + ' ' + S.f(TR + 30) + ' ' + S.f(204 - m(TR + 30)) + 'L' + S.f(TR + 20) + ' ' + S.f(222 - m(TR + 20)) + 'Q' + S.f(x0 + 60) + ' ' + S.f(yb + 2) + ' ' + S.f(x0) + ' ' + S.f(yb + 2) + 'Z" fill="#4F7F52" stroke="#24452a" stroke-width="1.2" opacity="' + of.toFixed(2) + '"/>'; }
    if (coll > 0) { var R = S.rnd(9); for (var i = 0; i < 30; i++) { var qx = 120 + R() * 560, qy = 215 + R() * 120, ph = R() * 9, a = Math.max(0, Math.sin((t + ph) * 2.4)); if (a > 0.8) out += '<circle cx="' + S.f(qx) + '" cy="' + S.f(qy) + '" r="4.5" fill="#FFD60A" stroke="#222" stroke-width=".8" opacity="' + ((a - 0.8) / 0.2 * coll).toFixed(2) + '"/>'; } }
    out += S.arrow(60, 140, 160, 140, '#1B232B', 5) + S.text(110, 120, T('Arabian plate', 'الصفيحة العربية'), { size: 15 }) + S.text(820, 120, T('Iranian plate (Eurasia)', 'الصفيحة الإيرانية (أوراسيا)'), { size: 15 });
    if (cl < 0.95) out += S.text((E + TR) / 2, 190, T('Neo-Tethys Ocean', 'محيط التيثس الجديد'), { size: 14, fill: '#1F4E79' });
    if (coll > 0.5) out += S.text(260, 150 - 10, T('Zagros folds', 'طيات زاغروس'), { size: 15, fill: '#8E2C20' }) + S.text(600, 420 + 1.3 * Hm * 0.3, T('crustal root', 'جذر قشري'), { size: 14 });
    if (of > 0.6) out += S.text(TR - 40, 170 - m(TR) * 0.5, T('ophiolite (suture)', 'أوفيوليت (الخياطة)'), { size: 13, fill: '#24452a' });
    return out;
  }
  S.add('convergent', {
    dur: 24, thumb: 0.8,
    params: [{ id: 'mode', type: 'seg', val: 'oc', en: 'Plates', ar: 'الصفيحتان', opts: [['oc', 'Ocean–continent', 'محيطية–قارية'], ['arc', 'Ocean–ocean', 'محيطية–محيطية'], ['col', 'Continent–continent (Zagros)', 'قارية–قارية (زاغروس)']] }],
    steps: function (P) { return STEPS[P.mode]; },
    render: function (t, P) { var o = P.mode === 'col' ? col(t) : sub(t, P.mode), lab = STEPS[P.mode].filter(function (q) { return t >= q.t; }).pop(); return o + S.tag(480, 30, T(lab.en_h, lab.ar_h), '#1F4E79'); }
  });
})();
