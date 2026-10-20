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
    var traces = wells.map(function (w) { var c = calc(w); return { x: [w.ts, w.tf, w.ts + c.G * 6], y: [0, w.depth, 6000], mode: 'lines+markers', name: w.name, line: { width: 2.5 }, marker: { size: [0, 9, 0] }, hovertemplate: w.name + '<br>%{x:.0f} °C at %{y:.0f} m<extra></extra>' }; });
    SH.plot('gP1', traces, function () {
      var p = SH.palette();
      return { xaxis: { title: { text: t('Temperature (°C)', 'درجة الحرارة (°م)') }, range: [0, 220], side: 'top' }, yaxis: { title: { text: t('Depth (m)', 'العمق (م)') }, autorange: 'reversed', range: [6000, 0] }, margin: { t: 50 }, legend: { orientation: 'h', y: -0.08 },
        shapes: [{ type: 'rect', xref: 'x', yref: 'paper', x0: 60, x1: 120, y0: 0, y1: 1, fillcolor: p.accent, opacity: 0.12, line: { width: 0 } }, { type: 'rect', xref: 'x', yref: 'paper', x0: 120, x1: 200, y0: 0, y1: 1, fillcolor: p.data, opacity: 0.1, line: { width: 0 } }],
        annotations: [{ x: 90, y: 300, text: t('Oil generation', 'توليد النفط'), showarrow: false, font: { color: p.text2, size: 11 } }, { x: 160, y: 300, text: t('Gas generation', 'توليد الغاز'), showarrow: false, font: { color: p.text2, size: 11 } }] };
    }, { filename: 'Geothermal_gradient' });
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
