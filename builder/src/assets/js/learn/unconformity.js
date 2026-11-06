/* Lesson: unconformities — angular unconformity, disconformity, nonconformity, each built step by step. */
(function () {
  var S = window.SHL, T = S.t;
  /* horizontal layers growing one after another from y0 upwards */
  function stack(list, y0, t, t0, each, x0, x1, bottom) {
    var g = '', y = y0; x0 = x0 == null ? -300 : x0; x1 = x1 == null ? 1260 : x1;
    list.forEach(function (L, k) { var f = S.seg(t, t0 + k * each, t0 + (k + 0.85) * each); if (f <= 0) return; var top = y - L[1] * f, bot = k === 0 && bottom != null ? bottom : y;
      g += S.body('M' + x0 + ' ' + S.f(bot) + 'H' + x1 + 'V' + S.f(top) + 'H' + x0 + 'Z', L[0]) + '<path d="M' + x0 + ' ' + S.f(top) + 'H' + x1 + '" stroke="#333" stroke-width="1" opacity=".45"/>'; y -= L[1]; });
    return g; }
  function sea(t, a, b, lvl) { var f = Math.min(S.seg(t, a, a + 0.8), 1 - S.seg(t, b - 0.8, b)); return f > 0 ? '<rect x="0" y="' + lvl + '" width="960" height="' + (540 - lvl) + '" fill="url(#gSea)" opacity="' + (0.45 * f).toFixed(2) + '"/>' : ''; }
  /* old rocks are kept only below the erosion surface; the sea sits behind them so it shows only above the ground */
  function below(inner, surf) { var id = S.id('cE'); return '<clipPath id="' + id + '"><path d="' + S.pathD(surf.concat([[970, 700], [-10, 700]]), true) + '"/></clipPath><g clip-path="url(#' + id + ')">' + inner + '</g>'; }
  function wave(lvl, amp, fn) { var P = []; for (var x = -10; x <= 970; x += 12) P.push([x, lvl + (fn ? fn(x) : amp * Math.sin(x / 41))]); return P; }
  var NAME = { ang: T('Angular unconformity', 'عدم توافق زاوي'), dis: T('Disconformity', 'عدم توافق متوازٍ'), non: T('Nonconformity', 'عدم توافق ناري–رسوبي') };
  var STEPS = {
    ang: [
      { t: 0, en_h: 'Older layers', ar_h: 'طبقات أقدم', en: 'A sequence of layers is deposited flat in the sea.', ar: 'يُرسَّب تتابع من الطبقات مستوياً في البحر.' },
      { t: 4.5, en_h: 'Tilting and uplift', ar_h: 'إمالة ورفع', en: 'Mountain building tilts the layers and lifts them above sea level.', ar: 'تُميل حركة بناء الجبال الطبقات وترفعها فوق مستوى البحر.' },
      { t: 9.5, en_h: 'Erosion', ar_h: 'التعرية', en: 'Rivers, rain and waves wear the tilted layers down to a flat surface. Rock, and the time it records, is lost.', ar: 'تبري الأنهار والأمطار والأمواج الطبقات المائلة حتى سطح مستوٍ، فيُفقد الصخر والزمن الذي يسجله.' },
      { t: 14, en_h: 'New layers', ar_h: 'طبقات جديدة', en: 'The land sinks, the sea returns and new layers are laid flat on the eroded edges of the old ones.', ar: 'تهبط الأرض ويعود البحر وتُرسَّب طبقات جديدة مستوية فوق الحواف المتآكلة للطبقات القديمة.' },
      { t: 19.5, en_h: 'Angular unconformity', ar_h: 'عدم توافق زاوي', en: 'An angular unconformity: tilted older layers below, flat younger layers above, an erosion surface between — a gap of millions of years.', ar: 'عدم توافق زاوي: طبقات أقدم مائلة في الأسفل وطبقات أحدث مستوية في الأعلى، وبينهما سطح تعرية يمثل فجوة بملايين السنين.' }],
    dis: [
      { t: 0, en_h: 'Older layers', ar_h: 'طبقات أقدم', en: 'Layers are deposited in a shallow sea.', ar: 'تُرسَّب الطبقات في بحر ضحل.' },
      { t: 4.5, en_h: 'Gentle uplift', ar_h: 'رفع هادئ', en: 'The region rises without tilting; the sea withdraws.', ar: 'ترتفع المنطقة دون إمالة، وينسحب البحر.' },
      { t: 8.5, en_h: 'Erosion', ar_h: 'التعرية', en: 'Streams cut channels into the top layer and remove part of the record.', ar: 'تحفر المجاري قنوات في الطبقة العليا وتزيل جزءاً من السجل.' },
      { t: 13.5, en_h: 'New layers', ar_h: 'طبقات جديدة', en: 'The sea returns: conglomerate fills the channels, then sand and mud are laid parallel to the older layers.', ar: 'يعود البحر: تملأ المدملكات القنوات، ثم يترسب الرمل والطين موازياً للطبقات الأقدم.' },
      { t: 19.5, en_h: 'Disconformity', ar_h: 'عدم توافق متوازٍ', en: 'A disconformity: layers above and below are parallel, so the gap is found only from the irregular surface, a basal conglomerate or a jump in fossil ages.', ar: 'عدم توافق متوازٍ: الطبقات فوقه وتحته متوازية، فلا تُكتشف الفجوة إلا من السطح غير المنتظم أو المدملكات القاعدية أو قفزة في أعمار المتحجرات.' }],
    non: [
      { t: 0, en_h: 'A granite pluton', ar_h: 'جسم غرانيتي', en: 'Deep in the crust, magma rises into metamorphic rock and cools slowly into granite.', ar: 'في أعماق القشرة ترتفع الصهارة داخل صخور متحولة وتبرد ببطء إلى غرانيت.' },
      { t: 7.5, en_h: 'Uplift and deep erosion', ar_h: 'رفع وتعرية عميقة', en: 'Kilometres of rock are removed by uplift and erosion until the granite and its host are exposed at the surface.', ar: 'تُزال كيلومترات من الصخور بالرفع والتعرية حتى ينكشف الغرانيت والصخر المضيف على السطح.' },
      { t: 12.5, en_h: 'Sediments on top', ar_h: 'رواسب في الأعلى', en: 'The sea floods the surface and sediments are deposited directly on the igneous and metamorphic rock.', ar: 'يغمر البحر السطح وتُرسَّب الرواسب مباشرة فوق الصخور النارية والمتحولة.' },
      { t: 18.5, en_h: 'Nonconformity', ar_h: 'عدم توافق ناري–رسوبي', en: 'A nonconformity: sedimentary layers resting on eroded igneous or metamorphic rock. The granite is older than the layers; it does not cut them.', ar: 'عدم توافق ناري–رسوبي: طبقات رسوبية تستقر على صخور نارية أو متحولة متآكلة. الغرانيت أقدم من الطبقات؛ فهو لا يقطعها.' }]
  };
  S.add('unconformity', {
    dur: function (P) { return P.mode === 'non' ? 23 : 24; }, thumb: 0.95,
    params: [{ id: 'mode', type: 'seg', val: 'ang', en: 'Type', ar: 'النوع', opts: [['ang', 'Angular', 'زاوي'], ['dis', 'Disconformity', 'متوازٍ'], ['non', 'Nonconformity', 'ناري–رسوبي']] }],
    steps: function (P) { return STEPS[P.mode]; },
    render: function (t, P) {
      var out = '', m = P.mode, hi;
      if (m === 'ang') {
        var tl = S.ease(S.seg(t, 4.5, 9)), old = stack([['sand', 40], ['shale', 40], ['lime', 40], ['shale', 40], ['sand', 40], ['lime', 40], ['shale', 40], ['sand', 40], ['lime', 40]], 520, t, 0, 0.48, null, null, 700);
        var er = S.ease(S.seg(t, 9.5, 13.5)), lvl = t > 9.5 ? S.lerp(60, 330, er) : -400;
        out += sea(t, 14, 30, 150) + sea(t, 0, 4.6, 150);
        out += below('<g transform="translate(0 ' + S.f(-70 * tl) + ') rotate(' + S.f(-18 * tl) + ' 480 520)">' + S.body('M-300 520H1260V900H-300Z', 'meta') + old + '</g>', wave(lvl, 2.5));
        if (t > 14) out += stack([['cong', 18], ['sand', 34], ['shale', 30]], 330, t, 14.5, 1.5, -10, 970, 336);
        if (t > 19.5) hi = wave(330, 2.5);
      } else if (m === 'dis') {
        var er2 = S.ease(S.seg(t, 8.5, 13)), fn = function (x) { return er2 * (10 + 10 * Math.sin(x / 45) + 26 * Math.max(0, Math.sin(x / 130 + 1))); };
        out += sea(t, 0, 4.8, 150) + sea(t, 13.5, 30, 150);
        out += below(S.body('M-10 520H970V560H-10Z', 'meta') + stack([['lime', 42], ['shale', 40], ['sand', 38], ['lime', 40]], 520, t, 0, 0.9, -10, 970), wave(360, 0, fn));
        if (t > 13.5) { var cg = S.seg(t, 13.8, 15.2), surf = wave(360, 0, fn), ct = 360 + 2 - 34 * cg;
          out += S.body(S.pathD(surf.map(function (p) { return [p[0], Math.max(p[1], ct)]; }).concat([[970, ct], [-10, ct]]), true), 'cong');
          out += stack([['sand', 38], ['shale', 36]], 328, t, 15.4, 1.8, -10, 970); }
        if (t > 19.5) hi = wave(360, 0, fn);
      } else {
        var rise = S.ease(S.seg(t, 0, 5)), cy = S.lerp(700, 450, rise), ig = S.body('M-10 -10H970V560H-10Z', 'meta'), hot = 1 - S.seg(t, 4.5, 7), pl = 'M' + (480 - 200) + ' ' + S.f(cy + 40) + 'C' + 280 + ' ' + S.f(cy - 140) + ' ' + 680 + ' ' + S.f(cy - 160) + ' ' + 690 + ' ' + S.f(cy + 30) + 'L690 600L280 600Z';
        ig += S.body(pl, 'granite') + (hot > 0 ? '<path d="' + pl + '" fill="url(#gMagma)" opacity="' + (0.85 * hot).toFixed(2) + '"/>' : '') + '<path d="' + pl + '" fill="none" stroke="#7E2E2A" stroke-width="2"/>';
        var er3 = S.ease(S.seg(t, 7.5, 12)), lv = t > 7.5 ? S.lerp(-20, 360, er3) : -400;
        out += sea(t, 12.5, 30, 140) + below(ig, wave(lv, 3));
        if (t > 12.5) out += stack([['cong', 22], ['sand', 36], ['shale', 34], ['lime', 34]], 360, t, 12.8, 1.3, -10, 970, 366);
        if (t > 18.5) hi = wave(360, 3);
      }
      if (hi) { var f = S.seg(t, m === 'non' ? 18.5 : 19.5, (m === 'non' ? 18.5 : 19.5) + 1.2); out += '<path d="' + S.pathD(hi) + '" stroke="#C0392B" stroke-width="4" fill="none" opacity="' + f.toFixed(2) + '"/>' + '<g opacity="' + f.toFixed(2) + '">' + S.tag(300, hi[25][1] - 26, NAME[m], '#C0392B') + '</g>';
        if (m === 'ang') out += '<g opacity="' + f.toFixed(2) + '">' + S.text(760, 470, T('older, tilted', 'أقدم، مائلة'), { size: 15 }) + S.text(760, 290, T('younger, flat', 'أحدث، مستوية'), { size: 15 }) + '</g>';
        if (m === 'non') out += '<g opacity="' + f.toFixed(2) + '">' + S.text(480, 480, T('granite', 'غرانيت'), { size: 16 }) + S.text(130, 470, T('metamorphic rock', 'صخر متحول'), { size: 15 }) + '</g>'; }
      var lab = STEPS[m].filter(function (q) { return t >= q.t; }).pop();
      return out + S.tag(480, 50, T(lab.en_h, lab.ar_h), '#1F4E79');
    }
  });
})();
