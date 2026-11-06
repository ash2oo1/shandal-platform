/* Lesson: divergent plate boundaries — mid-ocean ridge with magnetic stripes, and continental rifting to a new ocean. */
(function () {
  var S = window.SHL, T = S.t, CX = 480;
  /* geomagnetic polarity in lesson time: reversals at these instants (normal first) */
  var REV = [-40, -33.5, -29, -24.6, -21, -17.2, -14.4, -10.1, -7.6, -4.2, -1.9, 0, 2.6, 4.1, 7, 8.4, 11.2, 12.6, 15.4, 17.9, 19.3, 21.6, 30];
  function pol(tf) { var k = 0; while (k < REV.length - 1 && tf >= REV[k + 1]) k++; return k % 2 === 0 ? 1 : -1; }
  var STEPS = {
    ocean: [
      { t: 0, en_h: 'Plates pull apart', ar_h: 'الصفيحتان تتباعدان', en: 'At a mid-ocean ridge two plates move away from each other, a few centimetres a year.', ar: 'عند ظهر وسط المحيط تتحرك صفيحتان مبتعدتين إحداهما عن الأخرى بضعة سنتيمترات في السنة.' },
      { t: 3, en_h: 'Rising mantle', ar_h: 'وشاح صاعد', en: 'Hot mantle rises beneath the ridge; the drop in pressure melts part of it into basalt magma that collects in a chamber.', ar: 'يصعد وشاح حار تحت الظهر، ويؤدي انخفاض الضغط إلى صهر جزء منه صهارةً بازلتية تتجمع في حجرة.' },
      { t: 7.5, en_h: 'New ocean floor', ar_h: 'قاع محيط جديد', en: 'Magma fills the crack at the axis and freezes into new oceanic crust, which is carried away on both sides.', ar: 'تملأ الصهارة الشق عند المحور وتتجمد قشرةً محيطية جديدة تُنقل بعيداً على الجانبين.' },
      { t: 11, en_h: 'Magnetic stripes', ar_h: 'الأشرطة المغناطيسية', en: 'Cooling basalt records the direction of Earth’s field. The field reverses from time to time, so the floor holds stripes of normal (dark) and reversed (light) polarity, mirror images on both sides.', ar: 'يسجّل البازلت أثناء تبريده اتجاه مجال الأرض المغناطيسي. ينقلب المجال من حين لآخر، فيحمل القاع أشرطة بقطبية عادية (داكنة) ومعكوسة (فاتحة) متناظرة على الجانبين.' },
      { t: 16, en_h: 'Older and deeper', ar_h: 'أقدم وأعمق', en: 'Away from the ridge the plate cools, thickens and sinks, so the sea gets deeper: depth grows with the square root of the age of the floor.', ar: 'بعيداً عن الظهر تبرد الصفيحة وتتثخن وتهبط فيزداد عمق البحر: يزداد العمق مع الجذر التربيعي لعمر القاع.' },
      { t: 20, en_h: 'Evidence', ar_h: 'الدليل', en: 'The symmetric magnetic anomaly measured from ships (top curve) was the key evidence for sea-floor spreading.', ar: 'كان الشذوذ المغناطيسي المتناظر الذي تقيسه السفن (المنحنى في الأعلى) الدليل الحاسم على توسع قاع المحيط.' }],
    rift: [
      { t: 0, en_h: 'Doming', ar_h: 'التقبب', en: 'Hot mantle beneath a continent lifts and stretches the crust into a broad dome.', ar: 'يرفع وشاح حار تحت القارة القشرةَ ويمدّها في قبة واسعة.' },
      { t: 5, en_h: 'Rift valley', ar_h: 'وادي الخسيف', en: 'The stretched crust breaks along normal faults; blocks drop between them to form a rift valley (graben), as in East Africa today.', ar: 'تتكسر القشرة الممدودة على صدوع عادية، وتهبط كتل بينها مكوّنة وادي خسيف (غرابن)، كما في شرق أفريقيا اليوم.' },
      { t: 10, en_h: 'Thinning and volcanoes', ar_h: 'الترقق والبراكين', en: 'The crust thins, magma rises through it and volcanoes appear on the rift floor.', ar: 'تترقق القشرة وتصعد الصهارة خلالها وتظهر البراكين على أرض الخسيف.' },
      { t: 14, en_h: 'Break-up', ar_h: 'الانفصال', en: 'The continent splits, the sea floods in and the first oceanic crust forms between the two margins — the stage of the Red Sea.', ar: 'تنفصل القارة ويغمرها البحر وتتكوّن أول قشرة محيطية بين الحافتين — وهي مرحلة البحر الأحمر.' },
      { t: 20, en_h: 'A new ocean', ar_h: 'محيط جديد', en: 'With time the gap widens into an ocean with a mid-ocean ridge, like the Atlantic.', ar: 'مع الزمن تتسع الفجوة إلى محيط ذي ظهر وسطي، مثل الأطلسي.' }]
  };
  function quakes(t, n, x0, x1, y0, y1, seed) { var R = S.rnd(seed), o = ''; for (var i = 0; i < n; i++) { var x = S.lerp(x0, x1, R()), y = S.lerp(y0, y1, R()), ph = R() * 10, a = Math.max(0, Math.sin((t + ph) * 2.2)); if (a > 0.7) o += '<path d="M' + S.f(x) + ' ' + S.f(y - 7) + 'l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="#FFD60A" stroke="#7a5b00" stroke-width=".6" opacity="' + ((a - 0.7) / 0.3).toFixed(2) + '"/>'; } return o; }
  S.quakes = quakes;
  function ocean(t, P) {
    var v = P.rate * 4, out = '', SEA = 110, floor = function (x) { return 210 + 3.6 * Math.sqrt(Math.abs(x - CX)); }, lith = function (x) { return 246 + 7 * Math.sqrt(Math.abs(x - CX)); };
    out += '<rect x="0" y="230" width="960" height="310" fill="url(#gMantle)"/>';
    /* mantle flow */
    var off = (-t * 28) % 40;
    [-1, 1].forEach(function (sg) { out += '<path d="M' + (CX + sg * 60) + ' 540C' + (CX + sg * 40) + ' 420 ' + (CX + sg * 60) + ' 360 ' + (CX + sg * 300) + ' 420" stroke="#FFE2B8" stroke-width="5" fill="none" stroke-dasharray="18 22" stroke-dashoffset="' + off.toFixed(1) + '" opacity=".75" marker-end="url(#mArr)"/>'; });
    /* lithosphere and crust with stripes */
    var xs = []; for (var x = -10; x <= 970; x += 8) xs.push(x);
    out += '<path d="' + S.pathD(xs.map(function (x) { return [x, floor(x) + 30]; }).concat(xs.slice().reverse().map(function (x) { return [x, lith(x)]; })), true) + '" fill="#6C4E3F" opacity=".9"/>';
    for (var i = 0; i < xs.length - 1; i++) { var xm = xs[i] + 4, d = Math.abs(xm - CX), p = pol(t - d / v);
      out += '<rect x="' + xs[i] + '" y="' + S.f(floor(xm)) + '" width="8.6" height="30" fill="' + (p > 0 ? '#22303C' : '#EDEFF2') + '"/>'; }
    out += '<path d="' + S.pathD(xs.map(function (x) { return [x, floor(x)]; })) + '" stroke="#111" stroke-width="1.2" fill="none"/>';
    /* sea */
    out += '<path d="' + S.pathD([[-10, SEA]].concat(xs.map(function (x) { return [x, floor(x)]; }), [[970, SEA]]), true) + '" fill="url(#gSea)" opacity=".75"/>';
    /* magma chamber and feeder */
    var gl = 0.8 + 0.2 * Math.sin(t * 3);
    out += '<path d="M' + (CX - 9) + ' 290L' + (CX - 3) + ' 212L' + (CX + 3) + ' 212L' + (CX + 9) + ' 290Z" fill="url(#gMagma)"/><ellipse cx="' + CX + '" cy="300" rx="' + S.f(46 * gl) + '" ry="20" fill="url(#gMagma)"/>';
    out += quakes(t, 14, CX - 30, CX + 30, 214, 250, 3);
    /* magnetic anomaly profile above the sea */
    var prof = []; for (var x2 = -10; x2 <= 970; x2 += 4) { var s2 = 0, nn = 0; for (var k = -3; k <= 3; k++) { s2 += pol(t - Math.abs(x2 + k * 3 - CX) / v); nn++; } prof.push([x2, 62 - 16 * s2 / nn]); }
    var sh = S.seg(t, 19.5, 21);
    out += '<g opacity="' + (0.35 + 0.65 * sh).toFixed(2) + '"><path d="M0 62H960" stroke="#9AA6B0" stroke-width="1" stroke-dasharray="4 4"/><path d="' + S.pathD(prof) + '" stroke="#C0392B" stroke-width="2.4" fill="none"/></g>';
    /* plate motion */
    out += S.arrow(CX - 150, 172, CX - 260, 172, '#fff', 5) + S.arrow(CX + 150, 172, CX + 260, 172, '#fff', 5);
    out += S.text(CX, 200, T('ridge axis', 'محور الظهر'), { size: 14 }) + S.text(CX, 342, T('magma chamber', 'حجرة صهارية'), { size: 14 }) + S.text(150, 470, T('asthenosphere', 'الأسثينوسفير'), { size: 15, fill: '#fff', halo: false }) + S.text(150, 318, T('lithosphere', 'الليثوسفير'), { size: 14, fill: '#fff', halo: false });
    out += S.text(860, 92, T('magnetic anomaly', 'الشذوذ المغناطيسي'), { size: 13, fill: '#C0392B' });
    out += '<g><rect x="30" y="500" width="22" height="14" fill="#22303C"/>' + S.text(60, 512, T('normal polarity', 'قطبية عادية'), { size: 13, ext: 'right' }) + '<rect x="190" y="500" width="22" height="14" fill="#EDEFF2" stroke="#999"/>' + S.text(220, 512, T('reversed', 'معكوسة'), { size: 13, ext: 'right' }) + '</g>';
    return out;
  }
  function rift(t) {
    var out = '', dome = 26 * S.ease(S.seg(t, 0, 5)), fd = S.ease(S.seg(t, 5, 13)), thin = S.ease(S.seg(t, 7, 15)), sep = 330 * S.ease(S.seg(t, 14, 23)), W = 180, SEAL = 236;
    var top = function (x) { var d = Math.abs(x - CX), k = d < W ? Math.floor((W - d) / (W / 3)) + 1 : 0; return 225 - dome * Math.exp(-Math.pow((x - CX) / 260, 2)) + 22 * fd * k; };
    var base = function (x) { return Math.max(top(x) + 16, 360 - 110 * thin * Math.exp(-Math.pow((x - CX) / 170, 2))); };
    out += '<rect x="0" y="250" width="960" height="290" fill="url(#gMantle)"/>';
    /* magma rising under the rift */
    if (thin > 0.2) out += '<ellipse cx="' + CX + '" cy="' + S.f(base(CX) + 40) + '" rx="' + S.f(70 + sep / 3) + '" ry="34" fill="url(#gMagma)" opacity="' + S.f(Math.min(1, thin)) + '"/>';
    /* oceanic crust and sea in the gap */
    if (sep > 1) { var gl = CX - sep / 2, gr = CX + sep / 2;
      out += '<rect x="0" y="' + SEAL + '" width="960" height="' + (330 - SEAL) + '" fill="#5DA9D6"/>' + S.body('M' + S.f(gl - 30) + ' 318H' + S.f(gr + 30) + 'V346H' + S.f(gl - 30) + 'Z', 'basalt'); }
    /* the two continental halves */
    var half = function (sg) { var xs = [], x; if (sg < 0) for (x = -20; x <= CX; x += 6) xs.push(x); else for (x = CX; x <= 980; x += 6) xs.push(x);
      var dx = sg * sep / 2, up = xs.map(function (x) { return [x + dx, top(x)]; }), lo = xs.slice().reverse().map(function (x) { return [x + dx, base(x)]; }), g = '';
      if (sep > 1) g += '<path d="' + S.pathD(lo.slice().reverse().concat([[lo[0][0], 345], [lo[lo.length - 1][0], 345]]), true) + '" fill="#CF7744"/>';
      g += S.body(S.pathD(up.concat(lo), true), 'granite');
      var cov = xs.map(function (x) { return [x + dx, top(x) + 24]; }).reverse(); g += S.body(S.pathD(up.concat(cov), true), 'sand');
      [W, 2 * W / 3, W / 3].forEach(function (d) { if (fd <= 0) return; var xf = CX + sg * d, y0 = top(xf + sg * 3); g += '<path d="M' + S.f(xf + dx) + ' ' + S.f(y0 - 4) + 'L' + S.f(xf + dx - sg * 34) + ' ' + S.f(y0 + 90) + '" stroke="#7B1E12" stroke-width="2.6"/>'; });
      return g; };
    out += half(-1) + half(1);
    /* volcanoes on the rift floor */
    var vf = S.seg(t, 10, 12); if (vf > 0 && sep < 20) [CX - 40, CX + 52].forEach(function (x, k) { var y = top(x) - 1, h = 30 * vf; out += '<path d="M' + (x - 26) + ' ' + y + 'L' + (x - 4) + ' ' + S.f(y - h) + 'L' + (x + 4) + ' ' + S.f(y - h) + 'L' + (x + 26) + ' ' + y + 'Z" fill="#5F6170"/>' + (Math.sin(t * 4 + k) > 0 ? '<circle cx="' + x + '" cy="' + S.f(y - h - 8) + '" r="7" fill="#9AA0A6" opacity=".7"/>' : '') + '<path d="M' + x + ' ' + S.f(y - h) + 'v6" stroke="#FF7A1A" stroke-width="4"/>'; });
    var ar = 4 + 6 * S.seg(t, 4, 8); out += S.arrow(240 - sep / 2, 150, 240 - sep / 2 - 30 - ar * 4, 150, '#1B232B', 5) + S.arrow(720 + sep / 2, 150, 720 + sep / 2 + 30 + ar * 4, 150, '#1B232B', 5);
    out += S.text(140 - sep / 4, 300, T('continental crust', 'قشرة قارية'), { size: 14 }) + S.text(820 + sep / 4, 470, T('mantle', 'الوشاح'), { size: 15, fill: '#fff', halo: false });
    if (sep > 60) out += S.text(CX, SEAL - 12, T('new sea', 'بحر جديد'), { size: 15, fill: '#1F4E79' }) + S.text(CX, 342, T('oceanic crust', 'قشرة محيطية'), { size: 12, fill: '#fff', halo: false });
    else if (fd > 0.3) out += S.text(CX, top(CX) - 78, T('rift valley', 'وادي الخسيف'), { size: 15 });
    return out;
  }
  S.add('divergent', {
    dur: 24, thumb: 0.7,
    params: [{ id: 'mode', type: 'seg', val: 'ocean', en: 'Setting', ar: 'البيئة', opts: [['ocean', 'Mid-ocean ridge', 'ظهر وسط المحيط'], ['rift', 'Continental rift', 'خسيف قاري']] },
             { id: 'rate', type: 'range', min: 2, max: 10, val: 5, unit: ' cm/yr', en: 'Spreading rate', ar: 'معدل التباعد' }],
    steps: function (P) { return STEPS[P.mode]; },
    render: function (t, P) { var o = P.mode === 'rift' ? rift(t) : ocean(t, P), lab = STEPS[P.mode].filter(function (q) { return t >= q.t; }).pop(); return o + S.tag(480, 30, T(lab.en_h, lab.ar_h), '#1F4E79'); }
  });
})();
