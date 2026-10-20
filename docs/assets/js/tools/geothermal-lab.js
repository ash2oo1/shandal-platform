/* Geothermal gradient and thermal maturity (Peters 1986; Dow 1977; Jarvie et al. 2001). */
(function () {
  'use strict';
  var t = SH.t, KEY = 'shandal_geothermal_wells';
  var wells = SH.store.get(KEY, []);
  function roWin(ro) { if (isNaN(ro)) return null; return ro < 0.6 ? [t('Immature', 'غير ناضج'), 'mute'] : ro <= 1.1 ? [t('Oil window', 'نافذة النفط'), 'ok'] : ro <= 1.4 ? [t('Wet-gas window', 'نافذة الغاز الرطب'), 'info'] : ro <= 2.2 ? [t('Dry-gas generation', 'توليد الغاز الجاف'), 'info'] : ro <= 3.2 ? [t('Dry-gas preservation', 'حفظ الغاز الجاف'), 'warn'] : [t('Gas destruction', 'تحطم الغاز'), 'bad']; }
  function tmWin(tm) { if (isNaN(tm)) return null; return tm < 430 ? [t('Immature', 'غير ناضج'), 'mute'] : tm <= 465 ? [t('Oil zone', 'نطاق النفط'), 'ok'] : [t('Gas zone', 'نطاق الغاز'), 'info']; }
  function calc(w) { var G = 1000 * (w.tf - w.ts) / w.depth; return { G: G, q: isNaN(w.k) ? NaN : w.k * G, z60: G > 0 ? 1000 * (60 - w.ts) / G : NaN, z120: G > 0 ? 1000 * (120 - w.ts) / G : NaN, roT: isNaN(w.tmax) ? NaN : 0.018 * w.tmax - 7.16 }; }
  function badge(x) { return x ? '<span class="badge ' + x[1] + '">' + x[0] + '</span>' : '—'; }
  function render() {
    var tb = SH.$('#gBody'); tb.innerHTML = '';
    wells.forEach(function (w, i) {
      var c = calc(w);
      tb.insertAdjacentHTML('beforeend', '<tr><td><b>' + SH.esc(w.name) + '</b></td><td class="num">' + SH.fmt(w.depth, 0) + '</td><td class="num">' + SH.fmt(w.tf, 1) + '</td><td class="num"><b>' + SH.fmt(c.G, 1) + '</b></td><td class="num">' + SH.fmt(c.q, 0) + '</td><td class="num">' + SH.fmt(w.ro, 2) + '</td><td>' + badge(roWin(w.ro)) + '</td><td class="num">' + SH.fmt(w.tmax, 0) + '</td><td>' + badge(tmWin(w.tmax)) + '</td><td class="num">' + SH.fmt(c.roT, 2) + '</td><td class="num">' + SH.fmt(c.z60, 0) + '</td><td class="num">' + SH.fmt(c.z120, 0) + '</td><td data-noexport><button class="x" data-del="' + i + '">✕</button></td></tr>');
    });
    SH.$('#gEmpty').hidden = wells.length > 0;
    var last = wells[wells.length - 1];
    if (last) { var c = calc(last), rw = roWin(last.ro) || tmWin(last.tmax); SH.$('#gG').textContent = SH.fmt(c.G, 1); SH.$('#gQ').textContent = SH.fmt(c.q, 0); SH.$('#gW').textContent = rw ? rw[0] : '—'; SH.$('#gWs').textContent = last.name; SH.$('#gZ').textContent = SH.fmt(c.z60, 0); }
    /* maturity zones by temperature (typical for ~1–10 °C/Myr heating; Tissot & Welte 1984; Hunt 1996) */
    var Z = [[0, 60, '#BFC7CE', t('Immature', 'غير ناضج')], [60, 120, '#3E9B5B', t('Oil window', 'نافذة النفط')], [120, 150, '#E0A030', t('Wet gas', 'غاز رطب')], [150, 200, '#C8553D', t('Dry gas', 'غاز جاف')], [200, 260, '#6B3A5B', t('Over-mature', 'فرط النضج')]];
    var zoneOf = function (T) { for (var k = 0; k < Z.length; k++) if (T < Z[k][1]) return k; return Z.length - 1; };
    var traces = [], ZMAX = 6000, narr = [];
    wells.forEach(function (w, wi) {
      var c = calc(w); if (!(c.G > 0)) return; var col = SH.palette().series[wi % 8];
      var depthAt = function (T) { return 1000 * (T - w.ts) / c.G; };
      // geotherm split by zone, each segment in the zone colour
      var cuts = [0].concat(Z.map(function (z) { return depthAt(z[1]); }).filter(function (d) { return d > 0 && d < ZMAX; })).concat([ZMAX]).sort(function (x, y) { return x - y; });
      for (var k = 0; k < cuts.length - 1; k++) { var d0 = cuts[k], d1 = cuts[k + 1], T0 = w.ts + c.G * d0 / 1000, T1 = w.ts + c.G * d1 / 1000, zi = zoneOf((T0 + T1) / 2);
        traces.push({ x: [T0, T1], y: [d0, d1], mode: 'lines', line: { color: Z[zi][2], width: 6 }, opacity: .9, showlegend: false, hoverinfo: 'skip', legendgroup: 'w' + wi }); }
      traces.push({ x: [w.ts, w.ts + c.G * ZMAX / 1000], y: [0, ZMAX], mode: 'lines', name: w.name + ' · ' + SH.fmt(c.G, 1) + ' °C/km', line: { color: col, width: 1.6, dash: 'dot' }, legendgroup: 'w' + wi,
        hovertemplate: '<b>' + SH.esc(w.name) + '</b><br>%{y:,.0f} m → %{x:.0f} °C<extra></extra>' });
      traces.push({ x: [w.tf], y: [w.depth], mode: 'markers', name: w.name, showlegend: false, marker: { size: 12, color: col, line: { color: '#fff', width: 2 }, symbol: 'diamond' }, legendgroup: 'w' + wi,
        hovertemplate: '<b>' + SH.esc(w.name) + '</b> · ' + t('measured', 'مقاس') + '<br>%{x:.1f} °C ' + t('at', 'عند') + ' %{y:,.0f} m<extra></extra>' });
      var o0 = depthAt(60), o1 = depthAt(120), g1 = depthAt(150), g2 = depthAt(200);
      traces.push({ x: [60, 120, 150].filter(function (T, j) { return [o0, o1, g1][j] < ZMAX; }), y: [o0, o1, g1].filter(function (d) { return d < ZMAX; }), mode: wi === wells.length - 1 ? 'markers+text' : 'markers', showlegend: false, legendgroup: 'w' + wi, marker: { size: 8, color: '#fff', line: { color: col, width: 2 } },
        text: [o0, o1, g1].filter(function (d) { return d < ZMAX; }).map(function (d) { return SH.fmt(d, 0) + ' m'; }), textposition: 'middle right', textfont: { size: 10, color: col }, hoverinfo: 'skip' });
      narr.push('<b>' + SH.esc(w.name) + '</b>: ' + t('gradient ', 'تدرج ') + '<span class="ltr">' + SH.fmt(c.G, 1) + ' °C/km</span>' + (isFinite(c.q) ? t(', heat flow ', '، جريان حراري ') + '<span class="ltr">' + SH.fmt(c.q, 0) + ' mW/m²</span>' : '') + '. ' +
        t('Oil window (60–120 °C) from ', 'نافذة النفط (60–120 °م) من ') + '<b class="ltr">' + SH.fmt(o0, 0) + ' m</b>' + t(' to ', ' إلى ') + '<b class="ltr">' + SH.fmt(o1, 0) + ' m</b>' + t(', wet gas to ', '، والغاز الرطب حتى ') + '<b class="ltr">' + SH.fmt(g1, 0) + ' m</b>' + t(', dry gas to ', '، والغاز الجاف حتى ') + '<b class="ltr">' + SH.fmt(g2, 0) + ' m</b>. ' +
        (c.G > 35 ? t('A high gradient brings the windows to shallow depth, so source rocks mature early.', 'التدرج المرتفع يرفع النوافذ إلى أعماق ضحلة، فتنضج الصخور المصدرية مبكراً.') : c.G < 20 ? t('A low gradient pushes the windows deep; source rocks need deep burial to generate.', 'التدرج المنخفض يدفع النوافذ إلى الأعماق؛ تحتاج الصخور المصدرية إلى دفن عميق لتوليد الهيدروكربونات.') : t('A typical sedimentary-basin gradient.', 'تدرج نموذجي للأحواض الرسوبية.')) +
        (roWin(w.ro) ? ' ' + t('The measured Ro of ', 'قيمة Ro المقاسة ') + '<span class="ltr">' + SH.fmt(w.ro, 2) + ' %</span>' + t(' places the sample in the ', ' تضع العينة في ') + '<b>' + roWin(w.ro)[0] + '</b>.' : ''));
    });
    var lw = wells.filter(function (w) { return calc(w).G > 0; }).slice(-1)[0];
    SH.plot('gP1', traces, function () {
      var p = SH.palette(), sh = [], an = [];
      Z.forEach(function (z) { sh.push({ type: 'rect', xref: 'x', yref: 'paper', x0: z[0], x1: z[1], y0: 0, y1: 1, fillcolor: z[2], opacity: .1, line: { width: 0 }, layer: 'below' }, { type: 'line', xref: 'x', yref: 'paper', x0: z[1], x1: z[1], y0: 0, y1: 1, line: { color: z[2], width: 1, dash: 'dot' }, layer: 'below' });
        an.push({ x: (z[0] + z[1]) / 2, y: 1.0, yref: 'paper', yanchor: 'bottom', text: '<b>' + z[3] + '</b><br><span style="font-size:9px">' + z[0] + '–' + (z[1] > 250 ? '>' + z[0] : z[1]) + ' °C</span>', showarrow: false, font: { size: 10.5, color: z[2] } }); });
      if (lw) { var cc = calc(lw); Z.forEach(function (z) { var d0 = Math.max(0, 1000 * (z[0] - lw.ts) / cc.G), d1 = Math.min(ZMAX, 1000 * (z[1] - lw.ts) / cc.G); if (d1 <= d0) return;
          sh.push({ type: 'rect', xref: 'paper', yref: 'y', x0: 1.02, x1: 1.07, y0: d0, y1: d1, fillcolor: z[2], opacity: .85, line: { color: '#fff', width: 1 } }); });
        an.push({ xref: 'paper', x: 1.045, y: 1.0, yref: 'paper', yanchor: 'bottom', text: '<b>' + SH.esc(lw.name) + '</b>', showarrow: false, font: { size: 10, color: p.text2 } }); }
      return SH.plotLayout({ hovermode: 'closest', margin: { l: 64, r: 70, t: 70, b: 86 }, xaxis: { title: { text: t('Temperature (°C)', 'درجة الحرارة (°م)') }, range: [0, 250], side: 'bottom', dtick: 25, zeroline: false },
        yaxis: { title: { text: t('Depth (m)', 'العمق (م)') }, range: [ZMAX, 0], dtick: 500, tickformat: ',d', zeroline: false }, legend: { orientation: 'h', x: 0, y: -0.16 }, shapes: sh, annotations: an });
    }, { filename: 'Geothermal_gradient' });
    var nb = SH.$('#gNarr'); if (nb) nb.innerHTML = narr.length ? narr.map(function (x) { return '<p style="margin:0 0 8px;line-height:1.85">' + x + '</p>'; }).join('') + '<p class="xsmall muted" style="margin:0">' + t('Linear geotherm from surface to measured temperature, extrapolated to 6 km. Window temperatures are typical for geological heating rates (Tissot & Welte, 1984; Hunt, 1996); faster heating shifts generation to higher temperatures. Correct bottom-hole temperatures for drilling disturbance (e.g. Horner) before use.', 'منحنى حراري خطي من السطح إلى الحرارة المقاسة ممتد إلى 6 كم. حرارات النوافذ نموذجية لمعدلات التسخين الجيولوجية (Tissot & Welte، 1984؛ Hunt، 1996)؛ والتسخين الأسرع يزيح التوليد إلى حرارات أعلى. صحّح حرارات قاع البئر من اضطراب الحفر (مثل طريقة Horner) قبل الاستخدام.') + '</p>' : '';

  }
  function add(w) { var i = wells.findIndex(function (x) { return x.name === w.name; }); if (i > -1) wells[i] = w; else wells.push(w); SH.store.set(KEY, wells); render(); }
  SH.$('#gAdd').addEventListener('click', function () {
    var w = { name: SH.val('gName').trim(), depth: SH.num('gDepth'), tf: SH.num('gTf'), ts: SH.num('gTs'), k: SH.num('gK'), ro: SH.num('gRo'), tmax: SH.num('gTmax') };
    if (!w.name) return SH.toast(t('Enter the well name.', 'أدخل اسم البئر.'), 'warn');
    if (!(w.depth > 0) || isNaN(w.tf) || isNaN(w.ts)) return SH.toast(t('Depth, formation temperature and surface temperature are required.', 'العمق وحرارة التكوين وحرارة السطح مطلوبة.'), 'warn');
    if (w.tf <= w.ts) return SH.toast(t('Formation temperature should be higher than surface temperature.', 'يجب أن تكون حرارة التكوين أعلى من حرارة السطح.'), 'warn');
    add(w); SH.toast(t('Well added.', 'أُضيف البئر.'), 'ok');
  });
  SH.$('#gDemo').addEventListener('click', function () {
    [{ name: 'Well A', depth: 2400, tf: 92, ts: 25, k: 2.2, ro: 0.85, tmax: 442 }, { name: 'Well B', depth: 3600, tf: 131, ts: 25, k: 2.5, ro: 1.32, tmax: 461 }, { name: 'Well C', depth: 1500, tf: 58, ts: 24, k: 1.8, ro: 0.52, tmax: 428 }].forEach(add);
    SH.toast(t('Example wells loaded (illustrative values).', 'تم تحميل آبار المثال (قيم توضيحية).'), 'ok');
  });
  SH.$('#gBody').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { wells.splice(+b.getAttribute('data-del'), 1); SH.store.set(KEY, wells); render(); } });
  SH.$('#gClear').addEventListener('click', function () { if (wells.length) SH.confirm(t('Delete all wells?', 'هل تريد حذف جميع الآبار؟')).then(function (ok) { if (ok) { wells = []; SH.store.set(KEY, wells); render(); } }); });
  SH.$('#gCsv').addEventListener('click', function () { SH.csv('shandal-geothermal.csv', SH.tableRows(SH.$('#gTable'))); });
  SH.$$('[data-png]').forEach(function (b) { b.addEventListener('click', function () { SH.plotPng(b.getAttribute('data-png'), 'shandal-geothermal'); }); });
  render();
})();
