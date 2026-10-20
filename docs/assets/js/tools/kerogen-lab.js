/* Kerogen analysis lab — Rock-Eval interpretation (Espitalié 1977; Peters 1986; Peters & Cassa 1994; Jarvie 2001). */
(function () {
  'use strict';
  var t = SH.t, KEY = 'shandal_kerogen_samples';
  var samples = SH.store.get(KEY, []);

  function classify(s) {
    var r = {};
    r.hi = s.toc > 0 && !isNaN(s.s2) ? 100 * s.s2 / s.toc : NaN;
    r.oi = s.toc > 0 && !isNaN(s.s3) ? 100 * s.s3 / s.toc : NaN;
    r.pi = !isNaN(s.s1) && !isNaN(s.s2) && (s.s1 + s.s2) > 0 ? s.s1 / (s.s1 + s.s2) : NaN;
    r.ro = !isNaN(s.tmax) ? 0.018 * s.tmax - 7.16 : NaN;
    // organic richness (TOC)
    r.rich = s.toc < 0.5 ? ['poor', t('Poor', 'فقير'), 'bad'] : s.toc < 1 ? ['fair', t('Fair', 'متوسط'), 'warn'] : s.toc < 2 ? ['good', t('Good', 'جيد'), 'ok'] : s.toc < 4 ? ['vgood', t('Very good', 'جيد جداً'), 'ok'] : ['exc', t('Excellent', 'ممتاز'), 'ok'];
    // product from HI
    if (!isNaN(r.hi)) r.prod = r.hi < 50 ? [t('None', 'لا شيء'), 'mute'] : r.hi < 200 ? [t('Gas', 'غاز'), 'info'] : r.hi < 300 ? [t('Gas and oil', 'غاز ونفط'), 'warn'] : [t('Oil', 'نفط'), 'ok'];
    // kerogen type from HI (Peters & Cassa 1994)
    if (!isNaN(r.hi)) r.type = r.hi > 600 ? 'I' : r.hi >= 300 ? 'II' : r.hi >= 200 ? 'II/III' : r.hi >= 50 ? 'III' : 'IV';
    // maturity from Tmax, else from PI
    if (!isNaN(s.tmax)) r.mat = s.tmax < 435 ? [t('Immature', 'غير ناضج'), 'mute'] : s.tmax <= 470 ? [t('Oil window', 'نافذة النفط'), 'ok'] : [t('Gas window', 'نافذة الغاز'), 'info'];
    else if (!isNaN(r.pi)) r.mat = r.pi < 0.1 ? [t('Immature (PI)', 'غير ناضج (PI)'), 'mute'] : r.pi <= 0.4 ? [t('Oil window (PI)', 'نافذة النفط (PI)'), 'ok'] : [t('Gas / stained (PI)', 'غاز / تلوث (PI)'), 'info'];
    return r;
  }

  function read() {
    var s = { name: SH.val('kName').trim(), toc: SH.num('kToc'), s1: SH.num('kS1'), s2: SH.num('kS2'), s3: SH.num('kS3'), tmax: SH.num('kTmax') };
    if (!s.name) { SH.toast(t('Give the sample a name or well number.', 'أدخل اسم العينة أو رقم البئر.'), 'warn'); SH.$('#kName').focus(); return null; }
    if (!(s.toc > 0)) { SH.toast(t('TOC must be a number greater than zero.', 'يجب أن يكون TOC رقماً أكبر من صفر.'), 'warn'); SH.$('#kToc').focus(); return null; }
    if (isNaN(s.s2) || s.s2 < 0) { SH.toast(t('S2 is required to calculate the hydrogen index.', 'قيمة S2 مطلوبة لحساب مؤشر الهيدروجين.'), 'warn'); SH.$('#kS2').focus(); return null; }
    if (!isNaN(s.tmax) && (s.tmax < 350 || s.tmax > 650)) { SH.toast(t('Tmax looks out of range (350–650 °C). Check the value.', 'قيمة Tmax خارج النطاق المعتاد (350–650 °م). تحقق منها.'), 'warn'); return null; }
    return s;
  }
  function add(s) {
    var i = samples.findIndex(function (x) { return x.name === s.name; });
    if (i > -1) samples[i] = s; else samples.push(s);
    SH.store.set(KEY, samples); render();
  }

  var CURVES = {
    I: { x: [35, 25, 15, 12, 10, 10, 12], y: [920, 800, 600, 400, 200, 100, 50] },
    II: { x: [90, 70, 40, 25, 20, 16, 16, 18], y: [640, 630, 580, 450, 300, 150, 100, 50] },
    III: { x: [15, 30, 60, 100, 130, 160], y: [30, 60, 90, 100, 90, 40] }
  };

  function render() {
    var p = SH.palette(), last = samples[samples.length - 1];
    SH.$('#kN').textContent = samples.length;
    if (last) {
      var c = classify(last);
      SH.$('#kHI').textContent = SH.fmt(c.hi, 0); SH.$('#kHIs').textContent = last.name + ' · ' + (c.prod ? c.prod[0] : '');
      SH.$('#kType').textContent = c.type ? t('Type ', 'النوع ') + c.type : '—'; SH.$('#kTypeS').textContent = c.rich[1] + ' · TOC ' + SH.fmt(last.toc, 2) + ' %';
      SH.$('#kMat').textContent = c.mat ? c.mat[0] : '—'; SH.$('#kMatS').textContent = !isNaN(c.ro) ? 'Ro ≈ ' + SH.fmt(c.ro, 2) + ' %' : (!isNaN(c.pi) ? 'PI = ' + SH.fmt(c.pi, 2) : t('Add Tmax or S1', 'أضف Tmax أو S1'));
    } else { ['kHI', 'kType', 'kMat'].forEach(function (id) { SH.$('#' + id).textContent = '—'; }); }

    // table
    var tb = SH.$('#kBody'); tb.innerHTML = '';
    samples.forEach(function (s, i) {
      var c = classify(s), b = function (x) { return x ? '<span class="badge ' + x[x.length - 1] + '">' + x[x.length === 3 ? 1 : 0] + '</span>' : '—'; };
      tb.insertAdjacentHTML('beforeend', '<tr><td><b>' + SH.esc(s.name) + '</b></td><td class="num">' + SH.fmt(s.toc, 2) + '</td><td class="num">' + SH.fmt(s.s1, 2) + '</td><td class="num">' + SH.fmt(s.s2, 2) + '</td><td class="num">' + SH.fmt(s.s3, 2) + '</td><td class="num">' + SH.fmt(s.tmax, 0) +
        '</td><td class="num"><b>' + SH.fmt(c.hi, 0) + '</b></td><td class="num">' + SH.fmt(c.oi, 0) + '</td><td class="num">' + SH.fmt(c.pi, 2) + '</td><td class="num">' + SH.fmt(c.ro, 2) + '</td><td>' + b(c.rich) + '</td><td>' + b(c.prod) + '</td><td>' + (c.type ? '<b>' + c.type + '</b>' : '—') + '</td><td>' + b(c.mat) +
        '</td><td data-noexport><button class="x" data-del="' + i + '" aria-label="' + t('Delete', 'حذف') + '">✕</button></td></tr>');
    });
    SH.$('#kEmpty').hidden = samples.length > 0;

    // charts
    var withHI = samples.map(function (s) { return [s, classify(s)]; }).filter(function (a) { return !isNaN(a[1].hi); });
    var mk = { size: 11, color: p.accent, line: { color: p.bg, width: 1.5 } };
    var pts = function (xf, yf, list) { return { x: list.map(xf), y: list.map(yf), text: list.map(function (a) { return a[0].name; }), mode: 'markers+text', textposition: 'top center', textfont: { size: 10, color: p.text2 }, marker: mk, type: 'scatter', name: t('Samples', 'العينات'), hovertemplate: '%{text}<br>x=%{x}<br>y=%{y}<extra></extra>' }; };
    var line = function (x0, x1, y0, y1) { return { type: 'line', x0: x0, x1: x1, y0: y0, y1: y1, line: { color: p.line2, width: 1.2 } }; };
    var ann = function (x, y, s) { return { x: x, y: y, text: s, showarrow: false, font: { size: 11, color: p.text2 } }; };
    SH.plot('kP1', [pts(function (a) { return a[0].toc; }, function (a) { return a[1].hi; }, withHI)], function () {
      var q = SH.palette();
      return { xaxis: { type: 'log', range: [-1, 2], title: { text: 'TOC (wt %)' }, tickvals: [0.1, 0.5, 1, 2, 5, 10, 50, 100] }, yaxis: { range: [0, 1000], title: { text: 'HI (mg HC/g TOC)' } }, showlegend: false,
        shapes: [line(0.5, 0.5, 0, 1000), line(1, 1, 0, 1000), line(2, 2, 0, 1000), line(0.1, 100, 200, 200), line(0.1, 100, 300, 300)].map(function (s) { s.line.color = q.line2; return s; }),
        annotations: [ann(Math.log10(0.22), 960, t('Poor', 'فقير')), ann(Math.log10(0.7), 960, t('Fair', 'متوسط')), ann(Math.log10(1.42), 960, t('Good', 'جيد')), ann(Math.log10(10), 960, t('Very good', 'جيد جداً')),
          ann(Math.log10(35), 480, t('Oil-prone', 'منتج للنفط')), ann(Math.log10(35), 250, t('Mixed', 'مختلط')), ann(Math.log10(35), 100, t('Gas-prone', 'منتج للغاز'))] };
    }, { filename: 'HI_vs_TOC' });

    var withOI = withHI.filter(function (a) { return !isNaN(a[1].oi); });
    var cur = function (k, col) { return { x: CURVES[k].x, y: CURVES[k].y, mode: 'lines', line: { shape: 'spline', dash: 'dash', color: col, width: 2 }, hoverinfo: 'skip', name: t('Type ', 'النوع ') + k }; };
    SH.plot('kP2', [cur('I', p.series[1]), cur('II', p.series[0]), cur('III', p.series[2]), pts(function (a) { return a[1].oi; }, function (a) { return a[1].hi; }, withOI)], function () {
      return { xaxis: { range: [0, 250], title: { text: 'OI (mg CO₂/g TOC)' } }, yaxis: { range: [0, 1000], title: { text: 'HI (mg HC/g TOC)' } }, showlegend: false,
        annotations: [ann(46, 930, 'I'), ann(102, 650, 'II'), ann(172, 55, 'III')] };
    }, { filename: 'Van_Krevelen' });

    var withT = withHI.filter(function (a) { return !isNaN(a[0].tmax); });
    SH.plot('kP3', [pts(function (a) { return a[0].tmax; }, function (a) { return a[1].hi; }, withT)], function () {
      var q = SH.palette();
      return { xaxis: { range: [400, 520], title: { text: 'Tmax (°C)' } }, yaxis: { range: [0, 1000], title: { text: 'HI (mg HC/g TOC)' } }, showlegend: false,
        shapes: [{ type: 'rect', x0: 435, x1: 470, y0: 0, y1: 1000, fillcolor: q.accent, opacity: 0.1, line: { width: 0 } }, { type: 'rect', x0: 470, x1: 520, y0: 0, y1: 1000, fillcolor: q.data, opacity: 0.08, line: { width: 0 } },
          line(400, 520, 600, 600), line(400, 520, 300, 300), line(400, 520, 200, 200), line(400, 520, 50, 50)].map(function (s) { if (s.type === 'line') s.line.color = q.line2; return s; }),
        annotations: [ann(417, 960, t('Immature', 'غير ناضج')), ann(452, 960, t('Oil window', 'نافذة النفط')), ann(495, 960, t('Gas window', 'نافذة الغاز')), ann(512, 640, 'I'), ann(512, 450, 'II'), ann(512, 250, 'II/III'), ann(512, 125, 'III'), ann(512, 25, 'IV')] };
    }, { filename: 'HI_vs_Tmax' });
  }

  SH.$('#kAdd').addEventListener('click', function () { var s = read(); if (s) { add(s); SH.toast(t('Sample added: ', 'أُضيفت العينة: ') + SH.esc(s.name), 'ok'); SH.$('#kName').value = ''; SH.$('#kName').focus(); } });
  SH.$('#kDemo').addEventListener('click', function () {
    [{ name: 'Sargelu-1', toc: 6.8, s1: 2.1, s2: 38.4, s3: 0.9, tmax: 441 }, { name: 'Naokelekan-2', toc: 4.2, s1: 1.6, s2: 19.6, s3: 0.7, tmax: 446 }, { name: 'Chia Gara-3', toc: 2.1, s1: 0.6, s2: 7.4, s3: 0.8, tmax: 438 },
     { name: 'Kurra Chine-4', toc: 1.1, s1: 0.2, s2: 2.1, s3: 1.3, tmax: 452 }, { name: 'Shiranish-5', toc: 0.7, s1: 0.1, s2: 0.9, s3: 1.6, tmax: 429 }, { name: 'Coal seam-6', toc: 48, s1: 3, s2: 92, s3: 18, tmax: 432 }].forEach(function (s) { add(s); });
    SH.toast(t('Example samples loaded (illustrative values).', 'تم تحميل عينات المثال (قيم توضيحية).'), 'ok');
  });
  SH.$('#kPasteBtn').addEventListener('click', function () { var d = SH.$('#kPastePn'); d.open = true; SH.$('#kPaste').focus(); });
  SH.$('#kImport').addEventListener('click', function () {
    var n = 0, bad = 0;
    SH.$('#kPaste').value.split(/\r?\n/).forEach(function (ln) {
      if (!ln.trim()) return; var c = ln.split(/[,;\t]/).map(function (x) { return x.trim(); });
      var f = function (i) { var v = parseFloat((c[i] || '').replace(',', '.')); return isNaN(v) ? NaN : v; };
      var s = { name: c[0], toc: f(1), s1: f(2), s2: f(3), s3: f(4), tmax: f(5) };
      if (s.name && s.toc > 0 && !isNaN(s.s2)) { add(s); n++; } else bad++;
    });
    SH.toast(t(n + ' samples added', 'أُضيفت ' + n + ' عينة') + (bad ? t(', ' + bad + ' lines skipped (need name, TOC and S2).', '، وتم تجاهل ' + bad + ' سطر (يلزم الاسم وTOC وS2).') : '.'), n ? 'ok' : 'warn');
  });
  SH.$('#kBody').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; samples.splice(+b.getAttribute('data-del'), 1); SH.store.set(KEY, samples); render(); });
  SH.$('#kClear').addEventListener('click', function () { if (!samples.length) return; SH.confirm(t('Delete all samples from this lab?', 'هل تريد حذف جميع العينات من المختبر؟')).then(function (ok) { if (ok) { samples = []; SH.store.set(KEY, samples); render(); } }); });
  SH.$('#kCsv').addEventListener('click', function () { SH.csv('shandal-kerogen-lab.csv', SH.tableRows(SH.$('#kTable'))); });
  SH.$$('[data-png]').forEach(function (b) { b.addEventListener('click', function () { SH.plotPng(b.getAttribute('data-png'), 'shandal-' + b.getAttribute('data-png')); }); });
  document.addEventListener('sh:beforereport', function (e) { if (!samples.length) { e.preventDefault(); SH.toast(t('Add at least one sample before making a report.', 'أضف عينة واحدة على الأقل قبل إعداد التقرير.'), 'warn'); } });
  render();
})();
