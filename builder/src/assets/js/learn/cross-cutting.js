/* Lesson: cross-cutting relationships and inclusions — reading the order of events in a cross-section. */
(function () {
  var S = window.SHL, T = S.t, LITH = ['lime', 'shale', 'sand', 'lime'], LET = ['A', 'B', 'C', 'D'], Y0 = 470, TH = 50;
  var FX = function (y) { return 600 - 0.4737 * (y - 180); }, UX = -0.428, UY = 0.904, SMAX = 70;
  var DX = function (y) { return 300 + (560 - y) * 0.9756; }, DW = 12, DTOP = 285, ERO = 335, ETOP = 292;
  function strata(t) { var g = S.body('M-80 ' + Y0 + 'H1040V700H-80Z', 'meta');
    for (var k = 0; k < 4; k++) { var f = S.seg(t, k * 1.5, k * 1.5 + 1.3); if (f <= 0) break; var bot = Y0 - k * TH, top = bot - TH * f; g += S.body('M-80 ' + bot + 'H1040V' + top.toFixed(1) + 'H-80Z', LITH[k]) + '<path d="M-80 ' + top.toFixed(1) + 'H1040" stroke="#333" stroke-width="1" opacity=".45"/>'; }
    return g; }
  S.add('cross-cutting', {
    dur: 32, thumb: 0.9,
    steps: [
      { t: 0, en_h: 'Layers A to D', ar_h: 'الطبقات A إلى D', en: 'Four layers are deposited, A first and D last (superposition).', ar: 'تُرسَّب أربع طبقات: A أولاً وD أخيراً (قانون التعاقب).' },
      { t: 6.5, en_h: 'A fault', ar_h: 'صدع', en: 'A normal fault breaks the layers and the hanging wall slides down. The fault cuts A–D, so it is younger than all of them.', ar: 'يكسر صدع عادي الطبقات وينزلق الجدار المعلّق إلى الأسفل. الصدع يقطع A–D، فهو أحدث منها جميعاً.' },
      { t: 11.5, en_h: 'A dike', ar_h: 'قاطع ناري', en: 'Magma forces its way up through a crack and freezes into a dike. It cuts the layers and the fault and is not displaced: the dike is younger than the fault.', ar: 'تشق الصهارة طريقها عبر شق وتتجمد قاطعاً نارياً. القاطع يقطع الطبقات والصدع ولم يُزح، فهو أحدث من الصدع.' },
      { t: 17, en_h: 'Erosion', ar_h: 'التعرية', en: 'Uplift and erosion plane the land down, cutting the top of the fault block, the layers and the dike.', ar: 'يسوّي الرفع والتعرية سطح الأرض، فيقطعان أعلى كتلة الصدع والطبقات والقاطع.' },
      { t: 21.5, en_h: 'Layer E and inclusions', ar_h: 'الطبقة E والمحتويات', en: 'A new conglomerate E covers the eroded surface. It holds pebbles of the dike rock: inclusions are older than the rock that contains them.', ar: 'تغطي مدملكات جديدة E سطح التعرية، وفيها حصى من صخر القاطع: المحتويات أقدم من الصخر الذي يحتويها.' },
      { t: 25.5, en_h: 'The history', ar_h: 'التاريخ', en: 'Order of events: A, B, C, D, fault, dike, erosion, E. A feature that cuts another is always the younger of the two.', ar: 'ترتيب الأحداث: A ثم B ثم C ثم D ثم الصدع ثم القاطع ثم التعرية ثم E. المعلم الذي يقطع غيره هو دائماً الأحدث.' }],
    render: function (t) {
      var s = SMAX * S.ease(S.seg(t, 6.5, 11)), dx = UX * s, dy = UY * s, out = '', st = strata(t);
      var hw = '-80,-80 ' + S.f(FX(-80)) + ',-80 ' + S.f(FX(700)) + ',700 -80,700', fw = S.f(FX(-80)) + ',-80 1040,-80 1040,700 ' + S.f(FX(700)) + ',700';
      var cH = S.id('cHW'), cF = S.id('cFW'), cD = S.id('cDk'); out += '<clipPath id="' + cH + '"><polygon points="' + hw + '"/></clipPath><clipPath id="' + cF + '"><polygon points="' + fw + '"/></clipPath>';
      out += '<g clip-path="url(#' + cH + ')"><g transform="translate(' + S.f(dx) + ' ' + S.f(dy) + ')">' + st + '</g></g><g clip-path="url(#' + cF + ')">' + st + '</g>';
      if (t > 6.5) { var fy0 = Y0 - 4 * TH; out += '<path d="M' + S.f(FX(fy0)) + ' ' + fy0 + 'L' + S.f(FX(560)) + ' 560" stroke="#7B1E12" stroke-width="3.4" fill="none"/>';
        if (t < 11.5) out += S.arrow(FX(330) - 34, 318, FX(330) - 34 + UX * 40, 318 + UY * 40, '#7B1E12', 3) + S.arrow(FX(410) + 30, 420, FX(410) + 30 - UX * 34, 420 - UY * 34, '#7B1E12', 3); }
      /* the dike grows upwards, glows while molten, cools to basalt */
      var gr = S.seg(t, 11.5, 15.5); if (gr > 0) { var front = 560 - gr * (560 - DTOP), P = [[DX(560) - DW, 560], [DX(DTOP) - DW, DTOP], [DX(DTOP) + DW, DTOP], [DX(560) + DW, 560]], hot = 1 - S.seg(t, 15, 16.8);
        out += '<clipPath id="' + cD + '"><rect x="0" y="' + S.f(front) + '" width="960" height="600"/></clipPath><g clip-path="url(#' + cD + ')">' + S.body(S.pathD(P, true), 'basalt') + (hot > 0 ? '<path d="' + S.pathD(P, true) + '" fill="url(#gMagma)" opacity="' + hot.toFixed(2) + '"/>' : '') + '</g>'; }
      /* erosion lowers the land to a gently undulating surface */
      var er = S.seg(t, 17, 20.5); if (er > 0) { var lvl = S.lerp(255, ERO, S.ease(er)), wv = [];
        for (var x = -10; x <= 970; x += 20) wv.push([x, lvl + 3 * Math.sin(x / 37)]);
        out += '<path d="' + S.pathD([[-10, -10]].concat(wv, [[970, -10]]), true) + '" fill="url(#gSky)"/>';
        if (er >= 1) out += '<path d="' + S.pathD(wv) + '" stroke="#C0392B" stroke-width="3" fill="none" stroke-dasharray="' + (t > 25 ? '0' : '9 6') + '"/>'; }
      /* layer E with pebbles of the dike */
      var fe = S.seg(t, 21.5, 24.5); if (fe > 0) { var topE = ERO - (ERO - ETOP) * fe, R = S.rnd(11), wv2 = [];
        for (var x2 = -10; x2 <= 970; x2 += 20) wv2.push([x2, ERO + 3 * Math.sin(x2 / 37)]);
        out += S.body(S.pathD([[-10, topE]].concat(wv2, [[970, topE]]), true), 'cong');
        for (var i = 0; i < 26; i++) { var px = 380 + R() * 300, py = ERO - 5 - R() * (ERO - topE - 8); if (py > topE + 3) out += '<ellipse cx="' + S.f(px) + '" cy="' + S.f(py) + '" rx="' + (4 + R() * 4).toFixed(1) + '" ry="' + (3 + R() * 2).toFixed(1) + '" fill="#4A4C58" stroke="#222" stroke-width=".6"/>'; }
        out += '<path d="M-10 ' + S.f(topE) + 'H970" stroke="#5E7D3A" stroke-width="4"/>'; }
      /* the order of events */
      var nb = S.seg(t, 25.5, 30.5), tags = [[860, 445, 'A'], [860, 395, 'B'], [860, 352, 'C'], [110, 362, 'D'], [FX(430) + 30, 430, T('fault', 'صدع')], [DX(480) - 46, 480, T('dike', 'قاطع')], [600, ERO + 18, T('erosion', 'تعرية')], [860, (ERO + ETOP) / 2 + 2, 'E']];
      tags.forEach(function (q, k) { var f = S.seg(nb, k / 9, k / 9 + 0.12); if (f <= 0) return; var x = q[0], y = q[1];
        out += '<g opacity="' + f.toFixed(2) + '"><circle cx="' + S.f(x) + '" cy="' + S.f(y) + '" r="15" fill="#B08A3E" stroke="#fff" stroke-width="2"/>' + S.text(x, y + 6, String(k + 1), { size: 16, fill: '#fff', halo: false }) + S.text(x + (x > 700 ? -24 : 24), y + 6, q[2], { size: 15, ext: x > 700 ? 'left' : 'right' }) + '</g>'; });
      /* timeline of events, oldest first (right to left in Arabic) */
      var EV = [[0.2, 'A', 'lime'], [1.7, 'B', 'shale'], [3.2, 'C', 'sand'], [4.7, 'D', 'lime'], [6.5, T('fault', 'صدع'), 'F'], [11.5, T('dike', 'قاطع'), 'I'], [17, T('erosion', 'تعرية'), 'U'], [21.5, 'E', 'cong']], x0 = 150, x1 = 810;
      out += '<path d="M' + (S.AR ? x1 + 40 : x0 - 40) + ' 170H' + (S.AR ? x0 - 50 : x1 + 50) + '" stroke="#55616B" stroke-width="2" marker-end="url(#mArr)"/>' + S.text(S.AR ? x1 + 44 : x0 - 44, 196, T('older', 'أقدم'), { size: 13, fill: '#55616B' }) + S.text(S.AR ? x0 - 44 : x1 + 44, 196, T('younger', 'أحدث'), { size: 13, fill: '#55616B' });
      EV.forEach(function (ev, k) { var f = S.seg(t, ev[0], ev[0] + 0.6); if (f <= 0) return; var x = S.AR ? x1 - k * (x1 - x0) / 7 : x0 + k * (x1 - x0) / 7, sw = '';
        if (S.LITH[ev[2]]) sw = S.body('M' + (x - 18) + ' 132h36v24h-36z', ev[2], 'stroke="#333" stroke-width=".8"');
        else if (ev[2] === 'F') sw = '<rect x="' + (x - 18) + '" y="132" width="36" height="24" fill="#fff" stroke="#333" stroke-width=".8"/><path d="M' + (x + 6) + ' 132L' + (x - 6) + ' 156" stroke="#7B1E12" stroke-width="3"/>';
        else if (ev[2] === 'I') sw = S.body('M' + (x - 18) + ' 132h36v24h-36z', 'basalt', 'stroke="#333" stroke-width=".8"');
        else sw = '<rect x="' + (x - 18) + '" y="132" width="36" height="24" fill="#fff" stroke="#333" stroke-width=".8"/><path d="M' + (x - 16) + ' 146q8-6 16 0t16 0" stroke="#C0392B" stroke-width="3" fill="none"/>';
        out += '<g opacity="' + f.toFixed(2) + '">' + sw + S.text(x, 122, ev[1], { size: 14 }) + '</g>'; });
      var lab = t < 6.5 ? T('Deposition of A to D', 'ترسيب الطبقات من A إلى D') : t < 11.5 ? T('Faulting', 'التصدع') : t < 17 ? T('Intrusion of a dike', 'تداخل قاطع ناري') : t < 21.5 ? T('Uplift and erosion', 'الرفع والتعرية') : t < 25.5 ? T('Deposition of E', 'ترسيب E') : T('Order of events', 'ترتيب الأحداث');
      return out + S.tag(480, 50, lab, '#1F4E79');
    }
  });
})();
