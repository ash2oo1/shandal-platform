/* Grain-size analysis — sieve masses → % finer, D10/D30/D60, Cu, Cc, USCS (ASTM D2487) group symbol and name,
   Folk & Ward (1957) graphic statistics. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, persist = SH.persist('grainsize', ['gId', 'gTot', 'gLL', 'gPL']), last = null;
  var STD = [[75, '3″'], [50, '2″'], [37.5, '1½″'], [25, '1″'], [19, '¾″'], [12.5, '½″'], [9.5, '⅜″'], [4.75, '#4'], [2, '#10'], [0.85, '#20'], [0.425, '#40'], [0.25, '#60'], [0.15, '#100'], [0.106, '#140'], [0.075, '#200']];
  var rows = SH.store.get('shandal_grain_rows', STD.map(function (s) { return { d: s[0], m: null }; })), pan = SH.store.get('shandal_grain_pan', null);
  var inp = 'height:34px;border:1px solid var(--line-2);border-radius:8px;padding:0 8px;background:var(--bg);color:var(--text);font:inherit;font-size:.84rem;min-width:0';
  var lab = function (d) { for (var i = 0; i < STD.length; i++) if (Math.abs(STD[i][0] - d) < 1e-6) return STD[i][1]; return ''; };
  function ui() {
    $('#gRows').innerHTML = '<div style="display:grid;grid-template-columns:54px 1fr 1fr 24px;gap:6px;font-size:.74rem;color:var(--text-3)"><span>' + t('Sieve', 'المنخل') + '</span><span>' + t('Opening mm', 'الفتحة مم') + '</span><span>' + t('Retained g', 'المحتجز غم') + '</span><span></span></div>' +
      rows.map(function (r, i) { return '<div style="display:grid;grid-template-columns:54px 1fr 1fr 24px;gap:6px;align-items:center" data-i="' + i + '"><span class="xsmall muted">' + lab(r.d) + '</span><input class="ltr" type="number" step="any" style="' + inp + '" data-f="d" value="' + (r.d != null ? r.d : '') + '"><input class="ltr" type="number" step="0.1" style="' + inp + '" data-f="m" value="' + (r.m != null ? r.m : '') + '"><button class="x" type="button" data-del>✕</button></div>'; }).join('') +
      '<div style="display:grid;grid-template-columns:54px 1fr 1fr 24px;gap:6px;align-items:center"><span class="xsmall muted">' + t('Pan', 'الوعاء') + '</span><span class="xsmall muted">&lt; ' + Math.min.apply(null, rows.map(function (r) { return r.d || 99; })) + '</span><input class="ltr" type="number" step="0.1" style="' + inp + '" id="gPan" value="' + (pan != null ? pan : '') + '"><span></span></div>';
  }
  $('#gRows').addEventListener('input', function (e) { if (e.target.id === 'gPan') { var v = parseFloat(e.target.value); pan = isNaN(v) ? null : v; SH.store.set('shandal_grain_pan', pan); run(); return; } var r = e.target.closest('[data-i]'), f = e.target.getAttribute('data-f'); if (!r || !f) return; var v2 = parseFloat(e.target.value); rows[+r.getAttribute('data-i')][f] = isNaN(v2) ? null : v2; SH.store.set('shandal_grain_rows', rows); run(); });
  $('#gRows').addEventListener('click', function (e) { if (!e.target.closest('[data-del]')) return; rows.splice(+e.target.closest('[data-i]').getAttribute('data-i'), 1); SH.store.set('shandal_grain_rows', rows); ui(); run(); });
  $('#gAdd').addEventListener('click', function () { rows.push({ d: null, m: null }); ui(); });
  $('#gStd').addEventListener('click', function () { var old = {}; rows.forEach(function (r) { if (r.d) old[r.d] = r.m; }); rows = STD.map(function (s) { return { d: s[0], m: old[s[0]] != null ? old[s[0]] : null }; }); SH.store.set('shandal_grain_rows', rows); ui(); run(); });

  var interpD = function (pts, P) { // pts sorted by size desc: [{d, f}] ; returns size at P % finer (log interpolation)
    for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1]; if ((a.f - P) * (b.f - P) <= 0 && a.f !== b.f) return Math.pow(10, Math.log10(a.d) + (P - a.f) / (b.f - a.f) * (Math.log10(b.d) - Math.log10(a.d))); }
    return NaN; };
  var phiAt = function (pts, C) { // C = cumulative % coarser
    for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1], ca = 100 - a.f, cb = 100 - b.f; if ((ca - C) * (cb - C) <= 0 && ca !== cb) return -Math.log2(a.d) + (C - ca) / (cb - ca) * (-Math.log2(b.d) + Math.log2(a.d)); }
    return NaN; };
  function fineClass(LL, PL) { if (isNaN(LL) || isNaN(PL)) return null; var PI = LL - PL, A = 0.73 * (LL - 20); if (PI <= 0) return 'ML'; if (LL < 50) return PI > 7 && PI >= A ? 'CL' : PI >= 4 && PI <= 7 && PI >= A ? 'CL-ML' : 'ML'; return PI >= A ? 'CH' : 'MH'; }
  var FN = { CL: [t('Lean clay', 'طين قليل اللدونة')], CH: [t('Fat clay', 'طين عالي اللدونة')], ML: [t('Silt', 'غرين')], MH: [t('Elastic silt', 'غرين مرن')], 'CL-ML': [t('Silty clay', 'طين غريني')] };
  function classify(G, S, F, Cu, Cc, LL, PL) {
    var fc = fineClass(LL, PL), coarseIsG = G > S, x = coarseIsG ? 'G' : 'S', other = coarseIsG ? S : G, wOther = coarseIsG ? t(' with sand', ' مع رمل') : t(' with gravel', ' مع حصى');
    var well = coarseIsG ? Cu >= 4 && Cc >= 1 && Cc <= 3 : Cu >= 6 && Cc >= 1 && Cc <= 3, base = coarseIsG ? t('gravel', 'حصى') : t('sand', 'رمل');
    if (F >= 50) { if (!fc) return { sym: 'ML / CL', name: t('Fine-grained soil — enter LL and PL to classify', 'تربة ناعمة — أدخل LL وPL للتصنيف'), need: true };
      var R = G + S, nm = FN[fc][0]; if (R >= 30) nm = (S >= G ? t('Sandy ', 'رملي ') : t('Gravelly ', 'حصوي ')) + nm.toLowerCase() + ((S >= G ? G : S) >= 15 ? (S >= G ? t(' with gravel', ' مع حصى') : t(' with sand', ' مع رمل')) : ''); else if (R >= 15) nm += S >= G ? t(' with sand', ' مع رمل') : t(' with gravel', ' مع حصى'); return { sym: fc, name: nm }; }
    if (F < 5) { var sym = x + (well ? 'W' : 'P'); return { sym: sym, name: (well ? t('Well-graded ', 'جيد التدرج ') : t('Poorly graded ', 'رديء التدرج ')) + base + (other >= 15 ? wOther : '') }; }
    var fsuf = fc ? (fc === 'CL-ML' ? 'C-' + x + 'M' : /^C/.test(fc) ? 'C' : 'M') : null;
    if (F > 12) { if (!fsuf) return { sym: x + 'M / ' + x + 'C', name: t('Silty or clayey ', 'غريني أو طيني ') + base + t(' — enter LL and PL', ' — أدخل LL وPL'), need: true };
      var s2 = fc === 'CL-ML' ? x + 'C-' + x + 'M' : x + fsuf, nm2 = (fc === 'CL-ML' ? t('Silty, clayey ', 'غريني طيني ') : /^C/.test(fc) ? t('Clayey ', 'طيني ') : t('Silty ', 'غريني ')) + base + (other >= 15 ? wOther : ''); return { sym: s2, name: nm2 }; }
    var g1 = x + (well ? 'W' : 'P'); if (!fsuf) return { sym: g1 + '-' + x + 'M / ' + g1 + '-' + x + 'C', name: (well ? t('Well-graded ', 'جيد التدرج ') : t('Poorly graded ', 'رديء التدرج ')) + base + t(' with silt or clay — enter LL and PL', ' مع غرين أو طين — أدخل LL وPL'), need: true };
    var dual = g1 + '-' + x + (/^C/.test(fc) ? 'C' : 'M'); return { sym: dual, name: (well ? t('Well-graded ', 'جيد التدرج ') : t('Poorly graded ', 'رديء التدرج ')) + base + (/^C/.test(fc) ? t(' with clay', ' مع طين') : t(' with silt', ' مع غرين')) + (other >= 15 ? (coarseIsG ? t(' and sand', ' ورمل') : t(' and gravel', ' وحصى')) : '') };
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var word = function (v, cuts, names) { for (var i = 0; i < cuts.length; i++) if (v < cuts[i]) return names[i]; return names[names.length - 1]; };

  function run() {
    persist.save(); var R = rows.filter(function (r) { return r.d > 0 && r.m != null && r.m >= 0; }).sort(function (a, b) { return b.d - a.d; });
    if (R.length < 3) { $('#gKpis').innerHTML = ''; $('#gVerd').innerHTML = verdict('info', t('Enter retained masses', 'أدخل الكتل المحتجزة'), t('At least three sieves with masses.', 'ثلاثة مناخل على الأقل بكتلها.')); return; }
    var sumR = R.reduce(function (a, r) { return a + r.m; }, 0) + (pan || 0), tot = SH.num('gTot') > 0 ? SH.num('gTot') : sumR, cum = 0, pts = [];
    R.forEach(function (r) { cum += r.m; r.ret = 100 * r.m / tot; r.cum = 100 * cum / tot; r.f = Math.max(0, 100 - r.cum); pts.push({ d: r.d, f: r.f }); });
    pts.unshift({ d: R[0].d * 1.5, f: 100 });
    var fAt = function (d) { if (d >= pts[0].d) return 100; for (var i = 0; i < pts.length - 1; i++) if (pts[i].d >= d && pts[i + 1].d <= d) { var a = pts[i], b = pts[i + 1]; return a.f + (Math.log10(d) - Math.log10(a.d)) / (Math.log10(b.d) - Math.log10(a.d)) * (b.f - a.f); } return pts[pts.length - 1].f; };
    var F = fAt(0.075), G = 100 - fAt(4.75), S = 100 - G - F, D10 = interpD(pts, 10), D30 = interpD(pts, 30), D60 = interpD(pts, 60), Cu = D60 / D10, Cc = D30 * D30 / (D10 * D60), loss = SH.num('gTot') > 0 ? SH.num('gTot') - sumR : 0;
    var c = classify(G, S, F, Cu, Cc, SH.num('gLL'), SH.num('gPL'));
    var P = {}; [5, 16, 25, 50, 75, 84, 95].forEach(function (k) { P[k] = phiAt(pts, k); });
    var Mz = (P[16] + P[50] + P[84]) / 3, sI = (P[84] - P[16]) / 4 + (P[95] - P[5]) / 6.6, Sk = (P[16] + P[84] - 2 * P[50]) / (2 * (P[84] - P[16])) + (P[5] + P[95] - 2 * P[50]) / (2 * (P[95] - P[5])), KG = (P[95] - P[5]) / (2.44 * (P[75] - P[25]));
    last = { R: R, pts: pts, F: F, G: G, S: S, D10: D10, D30: D30, D60: D60, Cu: Cu, Cc: Cc, c: c, tot: tot };
    var dfmt = function (v) { return isNaN(v) ? '—' : v < 0.1 ? SH.fmt(v, 3) : SH.fmt(v, 2); };
    $('#gKpis').innerHTML = kpi('info', 'USCS', c.sym, c.name) + kpi('', t('Gravel · Sand · Fines', 'حصى · رمل · ناعم'), SH.fmt(G, 0) + ' · ' + SH.fmt(S, 0) + ' · ' + SH.fmt(F, 0) + '<small>%</small>', '> 4.75 · 4.75–0.075 · < 0.075 mm') +
      kpi('', 'D<sub>10</sub> · D<sub>30</sub> · D<sub>60</sub>', dfmt(D10) + ' · ' + dfmt(D30) + ' · ' + dfmt(D60), 'mm') + kpi(isNaN(Cu) ? '' : (G > S ? Cu >= 4 : Cu >= 6) ? 'ok' : 'warn', 'C<sub>u</sub> · C<sub>c</sub>', isNaN(Cu) ? '—' : SH.fmt(Cu, 1) + ' · ' + SH.fmt(Cc, 2), t('uniformity · curvature', 'التجانس · الانحناء')) +
      kpi('', t('Mean size M<sub>z</sub>', 'متوسط الحجم M<sub>z</sub>'), isNaN(Mz) ? '—' : SH.fmt(Mz, 2) + '<small> φ</small>', isNaN(Mz) ? '' : SH.fmt(Math.pow(2, -Mz), Math.pow(2, -Mz) < 0.1 ? 3 : 2) + ' mm');
    var v = [];
    if (c.need) v.push(verdict('info', t('Plasticity needed', 'اللدونة مطلوبة'), t('Fines exceed 5 %. Enter LL and PL of the fraction passing 0.425 mm to complete the USCS symbol.', 'الناعم يتجاوز 5 %. أدخل LL وPL للجزء المار من منخل 0.425 مم لإكمال رمز USCS.')));
    if (isNaN(D10)) v.push(verdict('warn', t('D10 not reached', 'لم يُبلغ D10'), t('More than 10 % passes the finest sieve. Run a hydrometer test (ASTM D7928) to extend the curve.', 'يمر أكثر من 10 % من أنعم منخل. أجرِ فحص الهيدروميتر (ASTM D7928) لتمديد المنحنى.')));
    if (SH.num('gTot') > 0 && Math.abs(loss) > 0 && Math.abs(sumR - SH.num('gTot')) / SH.num('gTot') > 0.003 && loss < 0) v.push(verdict('warn', t('Mass check', 'فحص الكتلة'), t('Retained masses add up to more than the total dry mass.', 'مجموع الكتل المحتجزة أكبر من الكتلة الجافة الكلية.')));
    if (!isNaN(Cu)) v.push(verdict('ok', t('Engineering reading', 'القراءة الهندسية'), (G > S ? Cu >= 4 && Cc >= 1 && Cc <= 3 : Cu >= 6 && Cc >= 1 && Cc <= 3) ? t('Well graded: particles fill each other’s voids, giving high density, strength and low permeability after compaction. Suitable for subbase and fill.', 'جيد التدرج: تملأ الحبيبات فراغات بعضها، فتعطي كثافة ومقاومة عالية ونفاذية منخفضة بعد الحدل. مناسب للطبقة تحت الأساس والردم.') : t('Poorly graded: a narrow or gap-graded range compacts less well and drains freely; useful as a filter or drainage layer.', 'رديء التدرج: مدى ضيق أو متقطع يُحدل بكفاءة أقل ويصرّف بحرية؛ مفيد كطبقة مرشح أو تصريف.')));
    $('#gVerd').innerHTML = v.join('');
    $('#gTbl').innerHTML = '<thead><tr><th>' + t('Sieve', 'المنخل') + '</th><th class="num">mm</th><th class="num">' + t('Retained g', 'محتجز غم') + '</th><th class="num">' + t('Retained %', 'محتجز %') + '</th><th class="num">' + t('Cum. %', 'تراكمي %') + '</th><th class="num">' + t('Passing %', 'مار %') + '</th></tr></thead><tbody>' +
      R.map(function (r) { return '<tr><td>' + lab(r.d) + '</td><td class="num">' + r.d + '</td><td class="num">' + SH.fmt(r.m, 1) + '</td><td class="num">' + SH.fmt(r.ret, 2) + '</td><td class="num">' + SH.fmt(r.cum, 2) + '</td><td class="num"><b>' + SH.fmt(r.f, 2) + '</b></td></tr>'; }).join('') + '<tr><td>' + t('Pan + wash', 'الوعاء + الغسل') + '</td><td></td><td class="num">' + SH.fmt((pan || 0) + Math.max(0, loss), 1) + '</td><td class="num">' + SH.fmt(100 * ((pan || 0) + Math.max(0, loss)) / tot, 2) + '</td><td class="num">100</td><td class="num">0</td></tr></tbody>';
    var row = function (k, vv) { return '<tr><th>' + k + '</th><td>' + vv + '</td></tr>'; }, ok = !isNaN(sI);
    $('#gStat').innerHTML = row('D<sub>10</sub>, D<sub>30</sub>, D<sub>60</sub>', dfmt(D10) + ', ' + dfmt(D30) + ', ' + dfmt(D60) + ' mm') + row('C<sub>u</sub> = D<sub>60</sub>/D<sub>10</sub>', isNaN(Cu) ? '—' : SH.fmt(Cu, 2)) + row('C<sub>c</sub> = D<sub>30</sub>²/(D<sub>10</sub>D<sub>60</sub>)', isNaN(Cc) ? '—' : SH.fmt(Cc, 2)) +
      row('φ₅ · φ₁₆ · φ₅₀ · φ₈₄ · φ₉₅', [5, 16, 50, 84, 95].map(function (k) { return isNaN(P[k]) ? '—' : SH.fmt(P[k], 2); }).join(' · ')) +
      row(t('Mean M<sub>z</sub>', 'المتوسط M<sub>z</sub>'), isNaN(Mz) ? '—' : SH.fmt(Mz, 2) + ' φ · ' + word(Mz, [-1, 0, 1, 2, 3, 4, 8], [t('gravel', 'حصى'), t('very coarse sand', 'رمل خشن جداً'), t('coarse sand', 'رمل خشن'), t('medium sand', 'رمل متوسط'), t('fine sand', 'رمل ناعم'), t('very fine sand', 'رمل ناعم جداً'), t('silt', 'غرين'), t('clay', 'طين')])) +
      row(t('Sorting σ<sub>I</sub>', 'الفرز σ<sub>I</sub>'), ok ? SH.fmt(sI, 2) + ' · ' + word(sI, [0.35, 0.5, 0.71, 1, 2, 4], [t('very well sorted', 'جيد الفرز جداً'), t('well sorted', 'جيد الفرز'), t('moderately well sorted', 'متوسط الفرز إلى جيد'), t('moderately sorted', 'متوسط الفرز'), t('poorly sorted', 'رديء الفرز'), t('very poorly sorted', 'رديء الفرز جداً'), t('extremely poorly sorted', 'رديء الفرز للغاية')]) : t('needs φ₅–φ₉₅ (extend the curve)', 'يحتاج φ₅–φ₉₅ (مدّد المنحنى)')) +
      row(t('Skewness Sk<sub>I</sub>', 'الالتواء Sk<sub>I</sub>'), ok ? SH.fmt(Sk, 2) + ' · ' + word(Sk, [-0.3, -0.1, 0.1, 0.3], [t('very coarse-skewed', 'ملتوٍ نحو الخشن جداً'), t('coarse-skewed', 'ملتوٍ نحو الخشن'), t('symmetrical', 'متماثل'), t('fine-skewed', 'ملتوٍ نحو الناعم'), t('very fine-skewed', 'ملتوٍ نحو الناعم جداً')]) : '—') +
      row(t('Kurtosis K<sub>G</sub>', 'التفرطح K<sub>G</sub>'), ok ? SH.fmt(KG, 2) + ' · ' + word(KG, [0.67, 0.9, 1.11, 1.5, 3], [t('very platykurtic', 'مفلطح جداً'), t('platykurtic', 'مفلطح'), t('mesokurtic', 'متوسط التفرطح'), t('leptokurtic', 'مدبب'), t('very leptokurtic', 'مدبب جداً'), t('extremely leptokurtic', 'مدبب للغاية')]) : '—');
    plot();
  }
  function plot() {
    var r = last, p = SH.palette(); if (!r) return;
    var bands = [[0.002, 0.075, 'rgba(120,120,120,.08)', t('Fines', 'ناعم')], [0.075, 4.75, 'rgba(201,163,90,.12)', t('Sand', 'رمل')], [4.75, 100, 'rgba(120,90,60,.10)', t('Gravel', 'حصى')]];
    var D = [['D₁₀', r.D10, 10], ['D₃₀', r.D30, 30], ['D₆₀', r.D60, 60]].filter(function (q) { return !isNaN(q[1]); });
    SH.plot('gPlot', [{ x: r.pts.slice(1).map(function (q) { return q.d; }), y: r.pts.slice(1).map(function (q) { return q.f; }), mode: 'lines+markers', line: { color: p.accent, width: 3, shape: 'spline', smoothing: 0.4 }, marker: { size: 8, color: p.accent, line: { color: '#fff', width: 1.5 } }, name: t('% finer', '% المار'), hovertemplate: '%{x} mm · %{y:.1f} %<extra></extra>' },
      { x: D.map(function (q) { return q[1]; }), y: D.map(function (q) { return q[2]; }), mode: 'markers+text', text: D.map(function (q) { return q[0]; }), textposition: 'top left', marker: { size: 9, symbol: 'diamond', color: '#B4552D' }, showlegend: false, hovertemplate: '%{text} = %{x:.3f} mm<extra></extra>' }],
      function () { return SH.plotLayout({ showlegend: false, xaxis: { type: 'log', autorange: 'reversed', title: { text: t('Particle size (mm)', 'حجم الحبيبة (مم)') }, range: [2, -2.7] }, yaxis: { title: { text: t('Percent finer by mass (%)', 'النسبة المارة بالكتلة (%)') }, range: [0, 102] },
        shapes: bands.map(function (b) { return { type: 'rect', xref: 'x', yref: 'paper', x0: b[0], x1: b[1], y0: 0, y1: 1, fillcolor: b[2], line: { width: 0 }, layer: 'below' }; }),
        annotations: bands.map(function (b) { return { x: Math.log10(Math.sqrt(b[0] * b[1])), y: 1.02, yref: 'paper', text: b[3], showarrow: false, font: { size: 11, color: p.text2 } }; }) }); }, { filename: 'shandal-grain-size' });
  }
  $('#gCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-sieve-analysis.csv', [['sieve', 'opening_mm', 'retained_g', 'retained_pct', 'cumulative_pct', 'passing_pct']].concat(last.R.map(function (r) { return [lab(r.d), r.d, r.m, r.ret.toFixed(2), r.cum.toFixed(2), r.f.toFixed(2)]; }))); });
  ['gId', 'gTot', 'gLL', 'gPL'].forEach(function (id) { $('#' + id).addEventListener('input', run); });
  $('#gDemo').addEventListener('click', function () { var m = [0, 0, 145.2, 310.5, 228.4, 260.8, 180.6, 402.3, 365.1, 290.4, 238.7, 190.2, 140.5, 60.4, 42.3]; rows = STD.map(function (s, i) { return { d: s[0], m: m[i] }; }); pan = 35.6; $('#gTot').value = 2920; $('#gId').value = 'BP-3 · bulk'; $('#gLL').value = ''; $('#gPL').value = ''; SH.store.set('shandal_grain_rows', rows); SH.store.set('shandal_grain_pan', pan); ui(); run(); });
  document.addEventListener('sh:redraw', plot);
  ui(); run();
})();
