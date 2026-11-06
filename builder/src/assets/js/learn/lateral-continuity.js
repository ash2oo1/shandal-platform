/* Lesson: lateral continuity — layers extend sideways until they thin out, and can be matched across a valley. */
(function () {
  var S = window.SHL, T = S.t, LITH = ['lime', 'shale', 'sand', 'lime', 'shale', 'sand'], TH = [52, 50, 56, 48, 50, 48], LET = ['A', 'B', 'C', 'D', 'E', 'F'], BASE = 520, CX = 470;
  /* layer C pinches out towards the east: a sand body that ends where its supply ended */
  function th(k, x) { var c = TH[2] * S.clamp((930 - x) / 230, 0, 1); return k === 2 ? c : k === 3 ? TH[3] + TH[2] - c : TH[k]; }
  function bounds(x) { var y = [BASE]; for (var k = 0; k < LITH.length; k++) y.push(y[k] - th(k, x)); return y; }
  S.add('lateral-continuity', {
    dur: 22, thumb: 0.75,
    steps: [
      { t: 0, en_h: 'Continuous sheets', ar_h: 'أغطية متصلة', en: 'Layers are laid down as continuous sheets that extend in every direction across the basin.', ar: 'تُرسَّب الطبقات أغطيةً متصلة تمتد في كل الاتجاهات عبر الحوض.' },
      { t: 3, en_h: 'A river cuts down', ar_h: 'نهر يحفر', en: 'After uplift a river cuts a valley through the layers. It removes rock, but it does not change the layers on either side.', ar: 'بعد الرفع يحفر نهر وادياً عبر الطبقات؛ فيزيل الصخر لكنه لا يغيّر الطبقات على الجانبين.' },
      { t: 11, en_h: 'Matching across', ar_h: 'المضاهاة عبر الوادي', en: 'Lateral continuity: the same layer on both walls was once one sheet, so the sequence can be matched (correlated) across the gap.', ar: 'مبدأ الاستمرارية الجانبية: الطبقة نفسها على الجدارين كانت غطاءً واحداً، فيمكن مضاهاة التتابع (ربطه) عبر الفجوة.' },
      { t: 16, en_h: 'Where a layer ends', ar_h: 'حيث تنتهي الطبقة', en: 'A layer is continuous only until it thins to nothing (pinches out) or passes into another rock type at the edge of its basin.', ar: 'تستمر الطبقة فقط حتى تترقق وتتلاشى (تتسفّن) أو تتحول إلى نوع صخري آخر عند حافة حوضها.' },
      { t: 20, en_h: 'In the field', ar_h: 'في الحقل', en: 'Geologists use this to follow a formation from outcrop to outcrop and from well to well.', ar: 'يستعمل الجيولوجيون هذا المبدأ لتتبع التكوين من مكشف إلى آخر ومن بئر إلى أخرى.' }],
    render: function (t) {
      var out = '', inc = S.ease(S.seg(t, 3, 11)), cor = S.seg(t, 11, 15), pin = S.seg(t, 16, 18), xs = [], x;
      for (x = -10; x <= 970; x += 10) xs.push(x);
      var B = xs.map(bounds), top = BASE - TH.reduce(function (a, b) { return a + b; }, 0);
      for (var k = 0; k < LITH.length; k++) { var up = xs.map(function (xx, i) { return [xx, B[i][k + 1]]; }), lo = xs.map(function (xx, i) { return [xx, B[i][k]]; }).reverse();
        out += S.body(S.pathD(up.concat(lo), true), LITH[k]) + '<path d="' + S.pathD(up) + '" stroke="#333" stroke-width="1" fill="none" opacity=".45"/>'; }
      out = S.body('M-10 ' + BASE + 'H970V560H-10Z', 'meta') + out;
      /* valley: V-shaped, widening as it deepens; walls slightly convex */
      if (inc > 0) { var depth = inc * 262, ytop = top - 4, yb = ytop + depth, hw = 40 + inc * 170;
        out += '<path d="M' + (CX - hw) + ' ' + ytop + 'Q' + (CX - hw * 0.45) + ' ' + (ytop + depth * 0.25) + ' ' + (CX - 18) + ' ' + yb + 'L' + (CX + 18) + ' ' + yb + 'Q' + (CX + hw * 0.45) + ' ' + (ytop + depth * 0.25) + ' ' + (CX + hw) + ' ' + ytop + 'Z" fill="url(#gSky)"/>';
        out += '<path d="M' + (CX - 18) + ' ' + yb + 'H' + (CX + 18) + '" stroke="#2D6E9E" stroke-width="7" stroke-linecap="round"/>' + S.text(CX, yb + 30, T('river', 'نهر'), { size: 14, fill: '#1F4E79' }); }
      /* land surface line and vegetation ticks */
      out += '<path d="M-10 ' + (top - 2) + 'H970" stroke="#5E7D3A" stroke-width="4"/>';
      if (cor > 0) { for (var k2 = 0; k2 < LITH.length; k2++) { var yL = (bounds(CX - 260)[k2] + bounds(CX - 260)[k2 + 1]) / 2, yR = (bounds(CX + 260)[k2] + bounds(CX + 260)[k2 + 1]) / 2, f = S.seg(cor, k2 / 10, k2 / 10 + 0.35);
          if (yL > top - 4 + 262 - 6) continue;
          out += '<path d="M' + (CX - 230) + ' ' + yL.toFixed(1) + 'L' + (CX - 230 + 460 * f).toFixed(1) + ' ' + S.lerp(yL, yR, f).toFixed(1) + '" stroke="#B03A2E" stroke-width="2.4" stroke-dasharray="7 5" fill="none"/>';
          if (f >= 1) { out += S.tag(CX - 260, yL + 5, LET[k2], '#B03A2E') + S.tag(CX + 260, yR + 5, LET[k2], '#B03A2E'); } } }
      if (pin > 0) { out += '<g opacity="' + pin.toFixed(2) + '"><circle cx="905" cy="' + ((bounds(905)[2] + bounds(905)[3]) / 2).toFixed(1) + '" r="34" fill="none" stroke="#1F4E79" stroke-width="3"/>' + S.tag(800, top - 34, T('layer C pinches out', 'الطبقة C تتلاشى'), '#1F4E79') + '<path d="M820 ' + (top - 20) + 'L893 ' + S.f(bounds(905)[3] - 30) + '" stroke="#1F4E79" stroke-width="2.4"/>' + '</g>'; }
      out += S.tag(480, 50, inc < 1 ? T('A river cuts a valley', 'نهر يحفر وادياً') : cor < 1 ? T('Layers on both walls match', 'الطبقات على الجدارين متطابقة') : T('Lateral continuity', 'الاستمرارية الجانبية'), '#1F4E79');
      return out;
    }
  });
})();
