/* Palynofacies lab — Tyson (1995) AOM–phytoclast–palynomorph ternary classification. */
(function () {
  'use strict';
  var t = SH.t, KEY = 'shandal_palyno_samples', NS = 'http://www.w3.org/2000/svg';
  var samples = SH.store.get(KEY, []);
  var FIELDS = {
    I: { env: t('Highly proximal shelf or basin', 'رف أو حوض قريب جداً من اليابسة'), ker: 'III', oil: false },
    II: { env: t('Marginal dysoxic–anoxic basin', 'حوض هامشي منخفض الأكسجين إلى عديمه'), ker: 'III', oil: false },
    III: { env: t('Heterolithic oxic shelf (proximal shelf)', 'رف مؤكسد متغاير الصخارية (رف قريب)'), ker: 'III / IV', oil: false },
    IVa: { env: t('Shelf-to-basin transition (dysoxic–suboxic)', 'انتقال من الرف إلى الحوض (منخفض الأكسجين)'), ker: 'III / II', oil: false },
    IVb: { env: t('Shelf-to-basin transition (suboxic–anoxic)', 'انتقال من الرف إلى الحوض (شبه عديم الأكسجين)'), ker: 'II / III', oil: false },
    V: { env: t('Mud-dominated oxic shelf (distal shelf)', 'رف مؤكسد يسوده الطين (رف بعيد)'), ker: 'III / IV', oil: false },
    VI: { env: t('Proximal suboxic–anoxic shelf', 'رف قريب شبه عديم الأكسجين'), ker: 'II', oil: true },
    VII: { env: t('Distal dysoxic–anoxic “shelf”', 'رف بعيد منخفض الأكسجين إلى عديمه'), ker: 'II', oil: true },
    VIII: { env: t('Distal dysoxic–anoxic shelf', 'رف بعيد منخفض الأكسجين إلى عديمه'), ker: 'II', oil: true },
    IX: { env: t('Distal suboxic–anoxic basin', 'حوض بعيد شبه عديم الأكسجين'), ker: 'II ≫ I', oil: true }
  };
  function classify(A, P, Y) {
    if (P < 20) return A >= 80 ? 'IX' : A >= 60 ? 'VIII' : A >= 40 ? 'VII' : 'V';
    if (P < 40) return A >= 60 ? 'VI' : A >= 40 ? 'IVb' : Y <= 30 ? 'IVa' : 'III';
    if (P < 60) return A >= 40 ? 'II' : Y <= 20 ? 'IVa' : 'III';
    return A >= 20 ? 'II' : 'I';
  }
  // geometry: AOM lower-left, palynomorphs lower-right, phytoclasts top
  var VA = [80, 560], VY = [680, 560], VP = [380, 560 - 600 * Math.sqrt(3) / 2];
  function xy(A, P, Y) { var s = A + P + Y; A /= s; P /= s; Y /= s; return [A * VA[0] + P * VP[0] + Y * VY[0], A * VA[1] + P * VP[1] + Y * VY[1]]; }
  function el(tag, a, txt) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; }

  function drawBase() {
    var svg = SH.$('#pSvg'); svg.innerHTML = '';
    var p = SH.palette();
    // field shading by sampling
    var g = el('g', { 'shape-rendering': 'crispEdges' }); svg.appendChild(g);
    var cGas = SH.alpha(SH.css('--b2'), 0.75), cOil = SH.alpha(p.ok, 0.2);
    var step = 2;
    for (var P = 0; P < 100; P += step) for (var A = 0; A + P < 100; A += step) {
      var Y = 100 - A - P, f = classify(A + step / 3, P + step / 3, Y - 2 * step / 3);
      var a = xy(A, P, 100 - A - P), b = xy(A + step, P, 100 - A - P - step), c = xy(A, P + step, 100 - A - P - step);
      g.appendChild(el('polygon', { points: a.join(',') + ' ' + b.join(',') + ' ' + c.join(','), fill: FIELDS[f].oil ? cOil : cGas, stroke: 'none' }));
      if (A + P + step < 100) { var d = xy(A + step, P + step, 100 - A - P - 2 * step); g.appendChild(el('polygon', { points: b.join(',') + ' ' + d.join(',') + ' ' + c.join(','), fill: FIELDS[f].oil ? cOil : cGas, stroke: 'none' })); }
    }
    // grid
    for (var k = 10; k < 100; k += 10) {
      [[xy(k, 0, 100 - k), xy(k, 100 - k, 0)], [xy(0, k, 100 - k), xy(100 - k, k, 0)], [xy(0, 100 - k, k), xy(100 - k, 0, k)]].forEach(function (ln) {
        svg.appendChild(el('line', { x1: ln[0][0], y1: ln[0][1], x2: ln[1][0], y2: ln[1][1], stroke: p.line, 'stroke-width': 1 }));
      });
      var q = xy(0, k, 100 - k); svg.appendChild(el('text', { x: q[0] + 8, y: q[1] + 4, 'font-size': 11, fill: p.text3 }, k));
      var r = xy(k, 0, 100 - k); svg.appendChild(el('text', { x: r[0], y: r[1] + 18, 'font-size': 11, fill: p.text3, 'text-anchor': 'middle' }, 100 - k));
      var lft = xy(100 - k, k, 0); svg.appendChild(el('text', { x: lft[0] - 8, y: lft[1] + 4, 'font-size': 11, fill: p.text3, 'text-anchor': 'end' }, 100 - k));
    }
    // field boundaries (segments that reproduce classify())
    var B = [[[80, 0, 20], [80, 20, 0]], [[60, 0, 40], [60, 40, 0]], [[40, 0, 60], [40, 60, 0]], [[20, 60, 20], [20, 80, 0]],
      [[0, 20, 80], [80, 20, 0]], [[0, 40, 60], [60, 40, 0]], [[0, 60, 40], [40, 60, 0]], [[40, 30, 30], [30, 40, 30]], [[40, 40, 20], [20, 60, 20]]];
    B.forEach(function (s) { var a = xy.apply(null, s[0]), b = xy.apply(null, s[1]); svg.appendChild(el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: p.accent, 'stroke-width': 1.8 })); });
    // outline
    svg.appendChild(el('polygon', { points: [VA, VY, VP].map(function (v) { return v.join(','); }).join(' '), fill: 'none', stroke: p.text, 'stroke-width': 2 }));
    // field labels at centroids
    var acc = {};
    for (var P2 = 1; P2 < 100; P2 += 2) for (var A2 = 1; A2 + P2 < 99; A2 += 2) { var f2 = classify(A2, P2, 100 - A2 - P2), pt = xy(A2, P2, 100 - A2 - P2); acc[f2] = acc[f2] || [0, 0, 0]; acc[f2][0] += pt[0]; acc[f2][1] += pt[1]; acc[f2][2]++; }
    var nudge = { IVa: [0, 0], IVb: [0, 0], III: [0, -6] };
    Object.keys(acc).forEach(function (f) { var c = acc[f], n = nudge[f] || [0, 0]; svg.appendChild(el('text', { x: c[0] / c[2] + n[0], y: c[1] / c[2] + 5 + n[1], 'font-size': 15, 'font-weight': 800, fill: p.accent, 'text-anchor': 'middle' }, f)); });
    svg.appendChild(el('text', { x: VA[0] - 10, y: VA[1] + 40, 'font-size': 14, 'font-weight': 700, fill: p.text, 'text-anchor': 'middle' }, 'AOM'));
    svg.appendChild(el('text', { x: VY[0] + 10, y: VY[1] + 40, 'font-size': 14, 'font-weight': 700, fill: p.text, 'text-anchor': 'middle' }, t('Palynomorphs', 'البالينومورف')));
    svg.appendChild(el('text', { x: VP[0], y: VP[1] - 14, 'font-size': 14, 'font-weight': 700, fill: p.text, 'text-anchor': 'middle' }, t('Phytoclasts', 'الفايتوكلاست')));
    svg.appendChild(el('text', { x: 40, y: 40, 'font-size': 12, fill: p.text2 }, t('Gas-prone (I–V) · Oil-prone (VI–IX)', 'منتج للغاز (I–V) · منتج للنفط (VI–IX)')));
    // samples
    samples.forEach(function (s, i) {
      var c = xy(s.A, s.P, s.Y), gg = el('g', {});
      gg.appendChild(el('circle', { cx: c[0], cy: c[1], r: 11, fill: p.accent, stroke: p.bg, 'stroke-width': 2 }));
      gg.appendChild(el('text', { x: c[0], y: c[1] + 4, 'font-size': 11, 'font-weight': 800, fill: '#141C24', 'text-anchor': 'middle' }, i + 1));
      gg.appendChild(el('title', {}, s.name + ' · ' + t('Field ', 'الحقل ') + s.f));
      svg.appendChild(gg);
    });
  }
  function guide() {
    SH.$('#pGuide').innerHTML = Object.keys(FIELDS).map(function (k) { return '<tr><th style="width:56px">' + k + '</th><td style="font-weight:600">' + FIELDS[k].env + '<br><small class="muted">' + t('Kerogen ', 'كيروجين ') + FIELDS[k].ker + ' · ' + (FIELDS[k].oil ? t('oil-prone', 'منتج للنفط') : t('gas-prone', 'منتج للغاز')) + '</small></td></tr>'; }).join('');
  }
  function render() {
    SH.$('#pN').textContent = samples.length;
    var last = samples[samples.length - 1];
    if (last) { var F = FIELDS[last.f]; SH.$('#pF').textContent = last.f; SH.$('#pFs').textContent = F.env; SH.$('#pK').textContent = t('Type ', 'النوع ') + F.ker; SH.$('#pKs').textContent = F.oil ? t('Oil-prone', 'منتج للنفط') : t('Gas-prone', 'منتج للغاز'); }
    var tb = SH.$('#pBody'); tb.innerHTML = '';
    samples.forEach(function (s, i) {
      var F = FIELDS[s.f];
      tb.insertAdjacentHTML('beforeend', '<tr><td>' + (i + 1) + '</td><td><b>' + SH.esc(s.name) + '</b></td><td class="num">' + SH.fmt(s.A, 1) + '</td><td class="num">' + SH.fmt(s.P, 1) + '</td><td class="num">' + SH.fmt(s.Y, 1) + '</td><td><b>' + s.f + '</b></td><td style="white-space:normal;min-width:200px">' + F.env + '</td><td>' + F.ker + '</td><td><span class="badge ' + (F.oil ? 'ok' : 'info') + '">' + (F.oil ? t('Oil-prone', 'منتج للنفط') : t('Gas-prone', 'منتج للغاز')) + '</span></td><td data-noexport><button class="x" data-del="' + i + '" aria-label="' + t('Delete', 'حذف') + '">✕</button></td></tr>');
    });
    SH.$('#pEmpty').hidden = samples.length > 0;
    drawBase();
  }
  function add(name, a, p, y) {
    var tot = a + p + y, A = 100 * a / tot, P = 100 * p / tot, Y = 100 * y / tot;
    var s = { name: name, A: Math.round(A * 10) / 10, P: Math.round(P * 10) / 10, Y: Math.round(Y * 10) / 10 };
    s.f = classify(A, P, Y);
    var i = samples.findIndex(function (x) { return x.name === name; }); if (i > -1) samples[i] = s; else samples.push(s);
    SH.store.set(KEY, samples); render(); return s;
  }
  function live() {
    var a = SH.num('pAom'), p = SH.num('pPhy'), y = SH.num('pPal');
    if ([a, p, y].every(function (v) { return v >= 0; }) && a + p + y > 0) { var s = a + p + y; SH.$('#pSum').textContent = t('Total ', 'المجموع ') + s + ' · AOM ' + SH.fmt(100 * a / s, 1) + ' % · ' + t('Phyto ', 'فايتو ') + SH.fmt(100 * p / s, 1) + ' % · ' + t('Paly ', 'بالينو ') + SH.fmt(100 * y / s, 1) + ' % → ' + t('Field ', 'الحقل ') + classify(100 * a / s, 100 * p / s, 100 * y / s); }
  }
  ['pAom', 'pPhy', 'pPal'].forEach(function (id) { SH.$('#' + id).addEventListener('input', live); });
  SH.$('#pAdd').addEventListener('click', function () {
    var n = SH.val('pName').trim(), a = SH.num('pAom'), p = SH.num('pPhy'), y = SH.num('pPal');
    if (!n) { SH.toast(t('Give the sample a name.', 'أدخل اسم العينة.'), 'warn'); return; }
    if (![a, p, y].every(function (v) { return v >= 0; })) { SH.toast(t('Enter all three counts as zero or positive numbers.', 'أدخل الأعداد الثلاثة كأرقام موجبة أو صفر.'), 'warn'); return; }
    if (a + p + y === 0) { SH.toast(t('The three counts add up to zero.', 'مجموع الأعداد الثلاثة صفر.'), 'warn'); return; }
    var s = add(n, a, p, y); SH.toast(t('Plotted in field ', 'أُسقطت في الحقل ') + s.f, 'ok'); SH.$('#pName').value = '';
  });
  SH.$('#pDemo').addEventListener('click', function () {
    [['Ora Shale 1', 180, 60, 40], ['Ora Shale 2', 240, 30, 20], ['Gercus 3', 20, 210, 70], ['Shiranish 4', 90, 70, 140], ['Kolosh 5', 45, 120, 60], ['Sargelu 6', 310, 18, 22]].forEach(function (r) { add(r[0], r[1], r[2], r[3]); });
    SH.toast(t('Example samples loaded (illustrative counts).', 'تم تحميل عينات المثال (أعداد توضيحية).'), 'ok');
  });
  SH.$('#pBody').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; samples.splice(+b.getAttribute('data-del'), 1); SH.store.set(KEY, samples); render(); });
  SH.$('#pClear').addEventListener('click', function () { if (samples.length) SH.confirm(t('Delete all samples?', 'هل تريد حذف جميع العينات؟')).then(function (ok) { if (ok) { samples = []; SH.store.set(KEY, samples); render(); } }); });
  SH.$('#pCsv').addEventListener('click', function () { SH.csv('shandal-palynofacies.csv', SH.tableRows(SH.$('#pTable'))); });
  SH.$('#pPng').addEventListener('click', function () { SH.svgPng(SH.$('#pSvg'), 'shandal-tyson-diagram.png', 2); });
  document.addEventListener('sh:redraw', drawBase);
  guide(); render();
})();
