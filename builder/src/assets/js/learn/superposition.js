/* Lesson: superposition and original horizontality (Steno 1669). */
(function () {
  var S = window.SHL, T = S.t, LITH = ['cong', 'sand', 'shale', 'lime', 'sand', 'shale', 'lime'], TH = 40, Y0 = 470, DEP = 3.2;
  var NAMES = { cong: T('conglomerate', 'مدملكات'), sand: T('sandstone', 'حجر رملي'), shale: T('shale', 'طفل'), lime: T('limestone', 'حجر جيري') };
  function dur(P) { return P.n * DEP + 9; }
  S.add('superposition', {
    dur: dur, thumb: 0.62,
    params: [{ id: 'n', type: 'range', min: 3, max: 7, val: 5, en: 'Number of layers', ar: 'عدد الطبقات' }],
    steps: function (P) { var e = P.n * DEP; return [
      { t: 0, en_h: 'Deposition', ar_h: 'الترسيب', en: 'Sediment settles from the water of a basin and spreads into a flat sheet: layer 1 is laid down first, on the old basement.', ar: 'تترسب الرواسب من ماء الحوض وتنتشر في غطاء مستوٍ: تُرسَّب الطبقة 1 أولاً فوق صخور القاعدة القديمة.' },
      { t: DEP, en_h: 'One over another', ar_h: 'طبقة فوق أخرى', en: 'Each new layer can only settle on top of the one before it, so every layer is younger than the layer beneath it.', ar: 'لا تستقر الطبقة الجديدة إلا فوق التي سبقتها، فكل طبقة أحدث من الطبقة التي تحتها.' },
      { t: (P.n - 1) * DEP, en_h: 'Superposition', ar_h: 'قانون التعاقب', en: 'Law of superposition: in an undisturbed sequence the oldest layer is at the bottom and the youngest at the top.', ar: 'قانون التعاقب الطبقي: في التتابع غير المضطرب تكون الطبقة الأقدم في الأسفل والأحدث في الأعلى.' },
      { t: e + 0.5, en_h: 'The sea retreats', ar_h: 'انحسار البحر', en: 'The basin dries out and the layers become rock: loose grains are compacted and cemented.', ar: 'يجف الحوض وتتحول الطبقات إلى صخور: تُرصّ الحبيبات المفككة وتُلحم.' },
      { t: e + 2.5, en_h: 'Tilting', ar_h: 'الإمالة', en: 'Earth movements later tilt the layers. Original horizontality: sediments are laid down flat, so tilted or folded layers record deformation that came after.', ar: 'تميل حركات القشرة الطبقات لاحقاً. مبدأ الأفقية الأصلية: الرواسب تُرسَّب مستوية، فالطبقات المائلة أو المطوية تسجّل تشوهاً حدث بعدها.' },
      { t: e + 7.5, en_h: 'Reading the order', ar_h: 'قراءة الترتيب', en: 'Even when tilted, the order is kept: follow the arrow from the oldest layer to the youngest, perpendicular to the bedding.', ar: 'حتى بعد الإمالة يبقى الترتيب: اتبع السهم من الأقدم إلى الأحدث عمودياً على التطبق.' }]; },
    render: function (t, P) {
      var n = P.n, e = n * DEP, out = '', sea = 1 - S.seg(t, e + 0.3, e + 2.2), tilt = S.ease(S.seg(t, e + 2.5, e + 7)) * 20, R = S.rnd(7);
      var g = '<g transform="rotate(' + (-tilt).toFixed(2) + ' 480 ' + Y0 + ') translate(0 ' + (-tilt * 2.2).toFixed(1) + ')">';
      g += S.body('M-200 ' + Y0 + 'H1160V900H-200Z', 'meta') + '<path d="M-200 ' + Y0 + 'H1160" stroke="#4E3566" stroke-width="2"/>';
      for (var k = 0; k < n; k++) { var f = S.seg(t, k * DEP, (k + 1) * DEP - 0.6); if (f <= 0) break; var top = Y0 - k * TH - TH * f, bot = Y0 - k * TH;
        g += S.body('M-200 ' + bot + 'H1160V' + top.toFixed(1) + 'H-200Z', LITH[k]) + '<path d="M-200 ' + top.toFixed(1) + 'H1160" stroke="#3a3a3a" stroke-width="1" opacity=".5"/>';
        if (k === 3 && f > 0.6) g += '<g transform="translate(300 ' + (bot - TH / 2).toFixed(1) + ')" opacity="' + S.seg(f, 0.6, 1).toFixed(2) + '"><path d="M0 0m-11 0a11 11 0 1 0 22 0a11 11 0 1 0-22 0M0 0a6 6 0 1 1 6-6" fill="#F5EBD3" stroke="#5B4632" stroke-width="1.6"/><path d="M-11 0h22M0-11v22" stroke="#5B4632" stroke-width=".7" opacity=".5"/></g>';
        if (f >= 1) g += '<g><circle cx="880" cy="' + (bot - TH / 2) + '" r="14" fill="#1B232B"/>' + S.text(880, bot - TH / 2 + 6, String(k + 1), { size: 16, fill: '#fff', halo: false }) + '</g>' + S.text(820, bot - TH / 2 + 6, NAMES[LITH[k]], { size: 14, ext: 'left', weight: 600 }); }
      if (tilt > 0.5) { var yb = Y0 - TH / 2, yt = Y0 - n * TH + TH / 2; g += S.arrow(140, yb, 140, yt, '#B03A2E', 4) + S.text(170, yb + 6, T('oldest', 'الأقدم'), { size: 15, ext: 'right', fill: '#B03A2E' }) + S.text(170, yt + 6, T('youngest', 'الأحدث'), { size: 15, ext: 'right', fill: '#B03A2E' }); }
      g += '</g>';
      /* water and settling grains */
      if (sea > 0) { var lvl = 120 + (1 - sea) * 400, cur = Math.min(n - 1, Math.floor(t / DEP)), fk = S.seg(t, cur * DEP, (cur + 1) * DEP - 0.6), topNow = Y0 - cur * TH - TH * fk;
        var wb = t < e ? topNow : Y0 - n * TH; if (wb > lvl) out += '<rect x="0" y="' + lvl.toFixed(1) + '" width="960" height="' + (wb - lvl).toFixed(1) + '" fill="url(#gSea)" opacity="' + (0.6 * sea).toFixed(2) + '"/>';
        out += '<path d="M0 ' + lvl.toFixed(1) + Array.apply(null, Array(25)).map(function (_, i) { return 'Q' + (i * 40 + 20) + ' ' + (lvl - 4 + 8 * ((i + Math.floor(t * 3)) % 2)).toFixed(1) + ' ' + (i * 40 + 40) + ' ' + lvl.toFixed(1); }).join('') + '" stroke="#fff" stroke-width="2" fill="none" opacity="' + (0.8 * sea).toFixed(2) + '"/>';
        if (t < e) { var col = S.LITH[LITH[cur]][0]; for (var i = 0; i < 70; i++) { var x0 = R() * 960, ph = R(), sp = 0.35 + R() * 0.4, y = lvl + 10 + ((t * sp + ph) % 1) * (topNow - lvl - 10); out += '<circle cx="' + (x0 + Math.sin(t * 2 + i) * 6).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1.6 + R() * 2).toFixed(1) + '" fill="' + col + '" stroke="#5a4a2a" stroke-width=".5"/>'; } } }
      out = g + out;
      if (t < e) out += S.tag(480, 60, T('Deposition of layer ', 'ترسيب الطبقة ') + (Math.min(n, Math.floor(t / DEP) + 1)), '#1F4E79');
      else if (tilt > 0.5) out += S.tag(480, 60, T('Tilted after deposition', 'أُميلت بعد ترسيبها'), '#8E2C20');
      else out += S.tag(480, 60, T('Oldest at the bottom, youngest at the top', 'الأقدم في الأسفل والأحدث في الأعلى'), '#1F4E79');
      return out;
    }
  });
})();
