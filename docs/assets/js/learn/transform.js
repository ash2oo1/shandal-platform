/* Lesson: transform plate boundaries — a ridge–ridge transform with fracture zones (map view) and a continental
   transform with offset streams and a pull-apart basin (Dead Sea). */
(function () {
  var S = window.SHL, T = S.t, YT = 270, RA = 380, RB = 580;
  var REV = [-60, -52, -47, -41, -37, -31, -27, -22, -18, -13, -9, -5, 0, 3, 6, 10, 13, 17, 19, 23, 40];
  function pol(tf) { var k = 0; while (k < REV.length - 1 && tf >= REV[k + 1]) k++; return k % 2 === 0; }
  var STEPS = {
    ridge: [
      { t: 0, en_h: 'Offset ridges', ar_h: 'ظهور مزاحة', en: 'Seen from above, a mid-ocean ridge is not one straight line: it is broken into segments offset sideways.', ar: 'إذا نُظر من الأعلى فظهر وسط المحيط ليس خطاً مستقيماً واحداً، بل مقطّع إلى أجزاء مزاحة جانبياً.' },
      { t: 4, en_h: 'Spreading', ar_h: 'التوسع', en: 'Each segment makes new floor on both sides; the magnetic stripes move away from each ridge segment.', ar: 'يصنع كل جزء قاعاً جديداً على الجانبين، وتبتعد الأشرطة المغناطيسية عن كل جزء من الظهر.' },
      { t: 8, en_h: 'Transform fault', ar_h: 'الصدع التحويلي', en: 'Between the two segments the plates slide past each other in opposite directions: this is the transform fault. Crust is neither made nor destroyed here.', ar: 'بين الجزأين تنزلق الصفيحتان إحداهما بجانب الأخرى باتجاهين متعاكسين: هذا هو الصدع التحويلي، وفيه لا تُصنع القشرة ولا تُستهلك.' },
      { t: 12, en_h: 'Earthquakes', ar_h: 'الزلازل', en: 'Earthquakes occur only on the active part between the ridge segments.', ar: 'تحدث الزلازل فقط على الجزء النشط بين جزأي الظهر.' },
      { t: 15.5, en_h: 'Fracture zones', ar_h: 'نطاقات الكسر', en: 'Beyond the segments both sides move the same way, so the scar (fracture zone) is inactive — it only records the old offset.', ar: 'خارج الجزأين يتحرك الجانبان بالاتجاه نفسه، فالأثر (نطاق الكسر) غير نشط ويسجل الإزاحة القديمة فقط.' }],
    cont: [
      { t: 0, en_h: 'A transform on land', ar_h: 'صدع تحويلي على اليابسة', en: 'Some transform faults cross continents: the Dead Sea Transform separates the Arabian plate from the Sinai (African) plate.', ar: 'تقطع بعض الصدوع التحويلية القارات: صدع البحر الميت التحويلي يفصل الصفيحة العربية عن صفيحة سيناء (الأفريقية).' },
      { t: 3, en_h: 'Sideways motion', ar_h: 'حركة جانبية', en: 'The blocks slide horizontally. Here the east side moves north relative to the west: a left-lateral (sinistral) fault.', ar: 'تنزلق الكتلتان أفقياً؛ وهنا يتحرك الجانب الشرقي شمالاً بالنسبة للغربي: صدع يساري الحركة.' },
      { t: 8, en_h: 'Offset features', ar_h: 'معالم مزاحة', en: 'Streams and roads that cross the fault are bent or cut and shifted: their offset measures the slip.', ar: 'تنحني المجاري والطرق التي تعبر الصدع أو تنقطع وتُزاح، ومقدار إزاحتها يقيس الانزلاق.' },
      { t: 13, en_h: 'Pull-apart basin', ar_h: 'حوض انفراجي', en: 'Where the fault steps sideways the crust is pulled apart and a deep basin opens: the Dead Sea, the lowest land on Earth.', ar: 'حيث يتخطى الصدع جانبياً تنسحب القشرة وينفتح حوض عميق: البحر الميت، أخفض يابسة على الأرض.' }]
  };
  function ridge(t, P) {
    var v = P.rate * 3.2, out = '<rect width="960" height="540" fill="#1E4A6E"/>', w = 8;
    for (var x = 0; x < 960; x += w) { var xm = x + w / 2, dA = Math.abs(xm - RA), dB = Math.abs(xm - RB);
      out += '<rect x="' + x + '" y="0" width="' + (w + 0.6) + '" height="' + YT + '" fill="' + (pol(t - dA / v) ? '#2F6F9A' : '#9CC4DD') + '"/>';
      out += '<rect x="' + x + '" y="' + YT + '" width="' + (w + 0.6) + '" height="' + (540 - YT) + '" fill="' + (pol(t - dB / v) ? '#2F6F9A' : '#9CC4DD') + '"/>'; }
    out += '<path d="M0 ' + YT + 'H' + RA + 'M' + RB + ' ' + YT + 'H960" stroke="#fff" stroke-width="2.4" stroke-dasharray="10 8" opacity=".9"/>';
    var act = S.seg(t, 8, 9);
    out += '<path d="M' + RA + ' ' + YT + 'H' + RB + '" stroke="' + (act > 0 ? '#E63946' : '#fff') + '" stroke-width="' + (3 + 2 * act) + '"/>';
    [[RA, 30, YT], [RB, YT, 510]].forEach(function (r) { out += '<path d="M' + r[0] + ' ' + r[1] + 'V' + r[2] + '" stroke="#FF7A1A" stroke-width="9" opacity=".35"/><path d="M' + r[0] + ' ' + r[1] + 'V' + r[2] + '" stroke="#FFD08A" stroke-width="3"/>'; });
    /* motion arrows on each block */
    var A = function (x, y, dir) { return S.arrow(x - dir * 34, y, x + dir * 34, y, '#fff', 4); };
    out += A(200, 120, -1) + A(480, 120, 1) + A(760, 120, 1) + A(200, 420, -1) + A(480, 420, -1) + A(760, 420, 1);
    if (act > 0) out += '<g opacity="' + act.toFixed(2) + '">' + S.arrow(430, YT - 18, 530, YT - 18, '#FFD60A', 4) + S.arrow(530, YT + 18, 430, YT + 18, '#FFD60A', 4) + '</g>';
    if (t > 12) { var R = S.rnd(4); for (var i = 0; i < 14; i++) { var qx = RA + 10 + R() * (RB - RA - 20), ph = R() * 8, a = Math.max(0, Math.sin((t + ph) * 2.6)); if (a > 0.7) out += '<path d="M' + S.f(qx) + ' ' + (YT - 9) + 'l2.6 6.4 6.6 1.3-5.2 3.9 1.3 6.5-5.3-3.9-5.2 3.9 1.3-6.5-5.2-3.9 6.5-1.3z" fill="#FFD60A" stroke="#7a5b00" stroke-width=".7" opacity="' + ((a - 0.7) / 0.3).toFixed(2) + '"/>'; } }
    out += S.text(RA - 14, 60, T('ridge', 'ظهر'), { size: 15, ext: 'left', fill: '#fff', haloCol: 'rgba(0,0,0,.45)' }) + S.text(RB + 14, 500, T('ridge', 'ظهر'), { size: 15, ext: 'right', fill: '#fff', haloCol: 'rgba(0,0,0,.45)' });
    if (act > 0) out += S.tag((RA + RB) / 2, YT - 50, T('active transform fault', 'صدع تحويلي نشط'), '#B03A2E');
    if (t > 15.5) out += S.tag(170, YT + 34, T('fracture zone (inactive)', 'نطاق كسر (غير نشط)'), '#1B232B') + S.tag(800, YT - 34, T('fracture zone (inactive)', 'نطاق كسر (غير نشط)'), '#1B232B');
    out += '<g><rect x="16" y="500" width="20" height="14" fill="#2F6F9A" stroke="#fff"/>' + S.text(44, 512, T('normal', 'عادية'), { size: 12, ext: 'right', fill: '#fff', haloCol: 'rgba(0,0,0,.4)' }) + '<rect x="120" y="500" width="20" height="14" fill="#9CC4DD" stroke="#fff"/>' + S.text(148, 512, T('reversed', 'معكوسة'), { size: 12, ext: 'right', fill: '#fff', haloCol: 'rgba(0,0,0,.4)' }) + '</g>';
    return out;
  }
  function cont(t) {
    var d = 110 * S.ease(S.seg(t, 3, 18)), h = d / 2, FN = 420, FS = 540, Y1 = 230, Y2 = 330, out = '<rect width="960" height="540" fill="#E9D8B4"/>', R = S.rnd(21);
    for (var i = 0; i < 60; i++) { var x = R() * 960, y = R() * 540, side = x > (y < 280 ? FN : FS) ? -h : h; out += '<ellipse cx="' + S.f(x) + '" cy="' + S.f(y + side) + '" rx="' + S.f(10 + R() * 24) + '" ry="' + S.f(5 + R() * 9) + '" fill="#D8C095" opacity=".7"/>'; }
    /* pull-apart basin between the two fault strands */
    var bw = Math.min(1, d / 110), bas = [[FS, Y1 - h * 0.2], [FN, Y1 + 12 - h], [FN, Y2 + h * 0.2], [FS, Y2 - 12 + h]];
    if (d > 4) { var xr = FN + (FS - FN) * bw; out += '<path d="' + S.pathD([[FN + 2, Y1 + 4], [xr, Y1 + 4 + 30 * bw], [xr, Y2 - 4], [FN + 2, Y2 - 4 - 30 * bw]], true) + '" fill="#3E7CB1" stroke="#2C5A80" stroke-width="2" opacity="' + (0.4 + 0.6 * bw).toFixed(2) + '"/>'; }
    /* the fault strands with a step-over */
    out += '<path d="M' + FN + ' -10V' + (Y2) + '" stroke="#8E2C20" stroke-width="3.4"/><path d="M' + FS + ' ' + Y1 + 'V550" stroke="#8E2C20" stroke-width="3.4"/>';
    /* a stream crossing the southern strand, bent along the fault */
    var yr = 440, wv = function (x0, x1, yy) { var p = [], x; for (x = x0; x <= x1; x += 10) p.push([x, yy + 6 * Math.sin(x / 30)]); return p; };
    var W = wv(-10, FS, yr + h), E = wv(FS, 970, yr - h);
    out += '<path d="' + S.pathD(W.concat([[FS, yr - h]], E)) + '" stroke="#3E7CB1" stroke-width="6" fill="none" stroke-linejoin="round"/>';
    /* a road crossing the northern strand, cut and shifted */
    out += '<path d="M-10 ' + S.f(150 + h) + 'H' + (FN - 3) + 'M' + (FN + 3) + ' ' + S.f(150 - h) + 'H970" stroke="#555" stroke-width="10"/><path d="M-10 ' + S.f(150 + h) + 'H' + (FN - 3) + 'M' + (FN + 3) + ' ' + S.f(150 - h) + 'H970" stroke="#fff" stroke-width="1.6" stroke-dasharray="14 10"/>';
    out += S.arrow(720, 330, 720, 250, '#1B232B', 5) + S.arrow(240, 250, 240, 330, '#1B232B', 5);
    out += S.text(800, 220, T('Arabian plate', 'الصفيحة العربية'), { size: 16 }) + S.text(120, 290, T('Sinai plate', 'صفيحة سيناء'), { size: 16 });
    if (d > 30) out += S.text((FN + FS) / 2, Y2 + 30, T('Dead Sea (pull-apart)', 'البحر الميت (حوض انفراجي)'), { size: 14, fill: '#1F4E79' }) + S.text(FS - 16, yr + h + 34, T('offset stream', 'مجرى مُزاح'), { size: 13, ext: 'left' }) + S.text(FN + 16, 150 - h - 16, T('offset road', 'طريق مُزاح'), { size: 13, ext: 'right' });
    out += '<g transform="translate(905 470)"><path d="M0 -26L8 4L0 -2L-8 4Z" fill="#1B232B"/>' + S.text(0, 24, T('N', 'ش'), { size: 15 }) + '</g>';
    return out;
  }
  S.add('transform', {
    dur: function (P) { return P.mode === 'cont' ? 20 : 20; }, thumb: 0.8, bg: '#1E4A6E',
    params: [{ id: 'mode', type: 'seg', val: 'ridge', en: 'Setting', ar: 'البيئة', opts: [['ridge', 'Ocean ridge (map view)', 'ظهر محيطي (منظر علوي)'], ['cont', 'On land: Dead Sea', 'على اليابسة: البحر الميت']] },
             { id: 'rate', type: 'range', min: 2, max: 10, val: 5, unit: ' cm/yr', en: 'Spreading rate', ar: 'معدل التباعد' }],
    steps: function (P) { return STEPS[P.mode]; },
    render: function (t, P) { var o = P.mode === 'cont' ? cont(t) : ridge(t, P), lab = STEPS[P.mode].filter(function (q) { return t >= q.t; }).pop(); return o + S.tag(480, 30, T(lab.en_h, lab.ar_h), '#1F4E79'); }
  });
})();
