/* Atterberg limits — Casagrande multipoint flow curve, one-point check, plastic limit, plasticity/liquidity/consistency
   indices, flow and toughness indices, Skempton activity and USCS fine-grained class on the plasticity chart (ASTM D2487). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, persist = SH.persist('atterberg', ['aId', 'geoName', 'pl1', 'pl2', 'pl3', 'aW', 'aClay']), last = null;
  var trials = SH.store.get('shandal_atterberg_ll', [{ n: 34, w: 38.2 }, { n: 26, w: 40.1 }, { n: 19, w: 42.3 }, { n: 15, w: 44.0 }]);
  var inp = 'height:38px;border:1px solid var(--line-2);border-radius:9px;padding:0 10px;background:var(--bg);color:var(--text);font:inherit;font-size:.86rem;min-width:0';
  function ui() { $('#aLL').innerHTML = '<div style="display:grid;grid-template-columns:24px 1fr 1fr 26px;gap:6px;font-size:.75rem;color:var(--text-3)"><span>No.</span><span>' + t('Blows N', 'الضربات N') + '</span><span>w %</span><span></span></div>' + trials.map(function (r, i) { return '<div style="display:grid;grid-template-columns:24px 1fr 1fr 26px;gap:6px;align-items:center" data-i="' + i + '"><b class="xsmall">' + (i + 1) + '</b><input type="number" style="' + inp + '" data-f="n" value="' + (r.n != null ? r.n : '') + '" min="1"><input type="number" style="' + inp + '" data-f="w" value="' + (r.w != null ? r.w : '') + '" step="0.1"><button class="x" type="button" data-del>✕</button></div>'; }).join(''); }
  $('#aLL').addEventListener('input', function (e) { var r = e.target.closest('[data-i]'), f = e.target.getAttribute('data-f'); if (!r || !f) return; var v = parseFloat(e.target.value); trials[+r.getAttribute('data-i')][f] = isNaN(v) ? null : v; SH.store.set('shandal_atterberg_ll', trials); run(); });
  $('#aLL').addEventListener('click', function (e) { if (!e.target.closest('[data-del]')) return; trials.splice(+e.target.closest('[data-i]').getAttribute('data-i'), 1); SH.store.set('shandal_atterberg_ll', trials); ui(); run(); });
  $('#aAddLL').addEventListener('click', function () { trials.push({ n: null, w: null }); ui(); });
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var NAMES = { CL: t('Lean clay', 'طين قليل اللدونة'), CH: t('Fat clay', 'طين عالي اللدونة'), ML: t('Silt', 'غرين'), MH: t('Elastic silt', 'غرين مرن'), 'CL-ML': t('Silty clay', 'طين غريني') };
  function uscs(LL, PI) { var A = 0.73 * (LL - 20); if (LL < 50) { if (PI > 7 && PI >= A) return 'CL'; if (PI >= 4 && PI <= 7 && PI >= A) return 'CL-ML'; return 'ML'; } return PI >= A ? 'CH' : 'MH'; }

  function run() {
    persist.save(); var T = trials.filter(function (r) { return r.n > 0 && r.w > 0; });
    var PLs = ['pl1', 'pl2', 'pl3'].map(SH.num).filter(function (v) { return !isNaN(v); }), PL = PLs.length ? PLs.reduce(function (a, b) { return a + b; }) / PLs.length : NaN;
    if (T.length < 1) { $('#aKpis').innerHTML = ''; $('#aVerd').innerHTML = verdict('info', t('Enter cup trials', 'أدخل محاولات الجهاز'), t('At least one trial; three or more for the flow curve.', 'محاولة واحدة على الأقل؛ ثلاث أو أكثر لمنحنى الجريان.')); return; }
    var LL, If = NaN, a = NaN, r2 = NaN, one = T.map(function (r) { return r.w * Math.pow(r.n / 25, 0.121); });
    if (T.length >= 2) { var X = T.map(function (r) { return Math.log10(r.n); }), Y = T.map(function (r) { return r.w; }), n = T.length, mx = X.reduce(function (p, q) { return p + q; }) / n, my = Y.reduce(function (p, q) { return p + q; }) / n, sxy = 0, sxx = 0, syy = 0;
      for (var i = 0; i < n; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += Math.pow(X[i] - mx, 2); syy += Math.pow(Y[i] - my, 2); }
      var b = sxx ? sxy / sxx : 0; a = my - b * mx; If = -b; LL = a + b * Math.log10(25); r2 = sxx && syy ? sxy * sxy / (sxx * syy) : 1;
    } else LL = one[0];
    var PI = !isNaN(PL) ? LL - PL : NaN, w = SH.num('aW'), clay = SH.num('aClay'), LI = !isNaN(w) && PI > 0 ? (w - PL) / PI : NaN, CI = !isNaN(w) && PI > 0 ? (LL - w) / PI : NaN, It = PI > 0 && If > 0 ? PI / If : NaN, Act = PI > 0 && clay > 0 ? PI / clay : NaN;
    var cls = !isNaN(PI) ? (PI <= 0 ? 'NP' : uscs(LL, PI)) : null;
    last = { T: T, LL: LL, PL: PL, PI: PI, If: If, a: a, r2: r2, one: one, cls: cls };
    $('#aKpis').innerHTML = kpi('info', 'LL', SH.fmt(LL, 1) + '<small>%</small>', T.length >= 2 ? t('flow curve at N = 25', 'منحنى الجريان عند N = 25') : t('one-point method', 'طريقة النقطة الواحدة')) + kpi('', 'PL', isNaN(PL) ? '—' : SH.fmt(PL, 1) + '<small>%</small>', PLs.length + t(' trials', ' محاولات')) +
      kpi('', 'PI', isNaN(PI) ? '—' : SH.fmt(PI, 1) + '<small>%</small>', isNaN(PI) ? '' : PI <= 0 ? t('non-plastic', 'غير لدن') : PI < 5 ? t('slightly plastic', 'قليل اللدونة جداً') : PI < 10 ? t('low plasticity', 'لدونة منخفضة') : PI < 20 ? t('medium plasticity', 'لدونة متوسطة') : PI < 40 ? t('high plasticity', 'لدونة عالية') : t('very high plasticity', 'لدونة عالية جداً')) +
      kpi(cls === 'CH' || cls === 'MH' ? 'warn' : 'ok', 'USCS', cls || '—', cls && NAMES[cls] ? NAMES[cls] : cls === 'NP' ? t('non-plastic fines', 'ناعم غير لدن') : '') +
      kpi(!isNaN(LI) && LI > 1 ? 'bad' : !isNaN(LI) && LI > 0.5 ? 'warn' : '', 'LI · CI', isNaN(LI) ? '—' : SH.fmt(LI, 2) + ' · ' + SH.fmt(CI, 2), isNaN(CI) ? t('needs natural w', 'يحتاج w الطبيعي') : CI < 0 ? t('liquid state', 'حالة سائلة') : CI < 0.25 ? t('very soft', 'لين جداً') : CI < 0.5 ? t('soft', 'لين') : CI < 0.75 ? t('medium stiff', 'متوسط الصلابة') : CI < 1 ? t('stiff', 'صلب') : t('very stiff to hard', 'صلب جداً إلى قاسٍ'));
    var v = [];
    if (T.length >= 2 && (Math.min.apply(null, T.map(function (r) { return r.n; })) > 25 || Math.max.apply(null, T.map(function (r) { return r.n; })) < 25)) v.push(verdict('warn', t('25 blows not bracketed', 'لم تُحصر الضربات 25'), t('All trials lie on one side of N = 25, so the LL is extrapolated. Add a trial on the other side.', 'كل المحاولات في جهة واحدة من N = 25، لذا استُقرئ حد السيولة. أضف محاولة في الجهة الأخرى.')));
    if (!isNaN(r2) && r2 < 0.95 && T.length >= 3) v.push(verdict('warn', t('Poor flow-curve fit', 'مطابقة ضعيفة لمنحنى الجريان'), 'R² = ' + SH.fmt(r2, 3) + '. ' + t('Check mixing time, cup height (10 mm) and moisture loss.', 'تحقق من زمن الخلط وارتفاع سقوط الكأس (10 مم) وفقدان الرطوبة.')));
    if (PLs.length >= 2 && Math.max.apply(null, PLs) - Math.min.apply(null, PLs) > 2) v.push(verdict('warn', t('Plastic-limit trials disagree', 'محاولات حد اللدونة متباينة'), t('Spread above 2 % (ASTM D4318 single-operator precision). Repeat the rolling.', 'التباين فوق 2 % (دقة المشغل الواحد في ASTM D4318). أعد الفتل.')));
    if (!isNaN(Act)) v.push(verdict(Act > 1.25 ? 'warn' : 'ok', t('Activity A = ', 'الفعالية A = ') + SH.fmt(Act, 2), (Act < 0.75 ? t('Inactive clay (Skempton 1953), typical of kaolinite.', 'طين غير فعال (Skempton 1953)، نموذجي للكاؤولينايت.') : Act <= 1.25 ? t('Normal activity, typical of illite.', 'فعالية اعتيادية، نموذجية للإلايت.') : t('Active clay: smectite (montmorillonite) is likely, with high swell–shrink potential. Test free swell and swelling pressure.', 'طين فعال: يُرجح وجود السمكتايت (المونتموريلونايت) مع قابلية انتفاخ وانكماش عالية. افحص الانتفاخ الحر وضغط الانتفاخ.'))));
    if (!isNaN(LI) && LI > 1) v.push(verdict('bad', t('Water content above LL', 'المحتوى المائي فوق حد السيولة'), t('The soil is in a liquid state in situ: very sensitive, prone to large settlement and loss of strength when disturbed.', 'التربة في حالة سائلة في الموقع: حساسة جداً، معرضة لهبوط كبير وفقدان المقاومة عند الاضطراب.')));
    $('#aVerd').innerHTML = v.join('');
    var row = function (k, vv) { return '<tr><th>' + k + '</th><td>' + vv + '</td></tr>'; };
    $('#aTbl').innerHTML = row(t('Flow curve', 'منحنى الجريان'), isNaN(If) ? '—' : 'w = ' + SH.fmt(a, 2) + ' − ' + SH.fmt(If, 2) + ' log₁₀N · R² = ' + SH.fmt(r2, 3)) + row(t('Flow index I<sub>f</sub>', 'مؤشر الجريان I<sub>f</sub>'), isNaN(If) ? '—' : SH.fmt(If, 2)) + row(t('One-point LL per trial (ASTM D4318)', 'حد السيولة بالنقطة الواحدة لكل محاولة'), T.map(function (r, i) { return 'N' + r.n + ': ' + SH.fmt(one[i], 1); }).join(' · ')) +
      row(t('Toughness index I<sub>t</sub> = PI / I<sub>f</sub>', 'مؤشر المتانة I<sub>t</sub> = PI / I<sub>f</sub>'), isNaN(It) ? '—' : SH.fmt(It, 2)) + row(t('A-line at this LL', 'الخط A عند هذا LL'), 'PI = ' + SH.fmt(0.73 * (LL - 20), 1) + ' · U-line ' + SH.fmt(0.9 * (LL - 8), 1)) + row(t('Activity A = PI / clay %', 'الفعالية A = PI / نسبة الطين'), isNaN(Act) ? '—' : SH.fmt(Act, 2));
    plots();
  }
  function plots() {
    var r = last, p = SH.palette(); if (!r) return;
    var tr = [{ x: r.T.map(function (q) { return q.n; }), y: r.T.map(function (q) { return q.w; }), mode: 'markers', name: t('Trials', 'المحاولات'), marker: { size: 10, color: p.accent } }];
    if (!isNaN(r.If)) tr.push({ x: [10, 40], y: [r.a - r.If * 1, r.a - r.If * Math.log10(40)], mode: 'lines', name: t('Flow line', 'خط الجريان'), line: { color: p.text, width: 2 } }, { x: [25, 25, 10], y: [Math.min.apply(null, r.T.map(function (q) { return q.w; })) - 3, r.LL, r.LL], mode: 'lines', name: 'LL', line: { color: '#B4552D', dash: 'dash', width: 1.5 } });
    SH.plot('aFlow', tr, function () { return SH.plotLayout({ xaxis: { type: 'log', title: { text: t('Number of blows N (log)', 'عدد الضربات N (لوغاريتمي)') }, range: [1, Math.log10(45)], tickvals: [10, 15, 20, 25, 30, 40] }, yaxis: { title: { text: t('Water content w (%)', 'المحتوى المائي w (%)') } } }); });
    var ll = [], A = [], U = []; for (var x = 0; x <= 110; x += 2) { ll.push(x); A.push(x >= 25.5 ? 0.73 * (x - 20) : null); U.push(x >= 16 ? 0.9 * (x - 8) : null); }
    var ct = [{ x: ll, y: U, mode: 'lines', name: 'U-line', line: { color: p.text3, dash: 'dot', width: 1.5 } }, { x: ll, y: A, mode: 'lines', name: 'A-line', line: { color: p.text, width: 2 } },
      { x: [50, 50], y: [0, 60], mode: 'lines', showlegend: false, line: { color: p.text2, width: 1, dash: 'dash' }, hoverinfo: 'skip' }, { x: [4 / 0.9 + 8, 4 / 0.73 + 20, 7 / 0.73 + 20, 7 / 0.9 + 8, 4 / 0.9 + 8], y: [4, 4, 7, 7, 4], mode: 'lines', fill: 'toself', fillcolor: 'rgba(154,118,49,.15)', line: { width: 0 }, name: 'CL-ML', hoverinfo: 'skip' }];
    if (!isNaN(r.PI)) ct.push({ x: [r.LL], y: [r.PI], mode: 'markers+text', text: [' ' + (r.cls || '')], textposition: 'middle right', marker: { size: 13, color: '#B4552D', line: { color: '#fff', width: 2 } }, name: t('Sample', 'العينة') });
    SH.plot('aChart', ct, function () { return SH.plotLayout({ xaxis: { title: { text: t('Liquid limit LL (%)', 'حد السيولة LL (%)') }, range: [0, 110] }, yaxis: { title: { text: t('Plasticity index PI (%)', 'مؤشر اللدونة PI (%)') }, range: [0, 70] },
      annotations: [['CL', 30, 32], ['CH', 72, 52], ['ML', 40, 4], ['MH', 82, 20], ['CL-ML', 12, 10]].map(function (a) { return { x: a[1], y: a[2], text: '<b>' + a[0] + '</b>', showarrow: false, font: { size: 13, color: p.text2 } }; }) }); });
  }
  ['aId', 'geoName', 'pl1', 'pl2', 'pl3', 'aW', 'aClay'].forEach(function (id) { $('#' + id).addEventListener('input', run); });
  $('#aDemo').addEventListener('click', function () { trials = [{ n: 35, w: 37.6 }, { n: 28, w: 38.9 }, { n: 21, w: 40.6 }, { n: 16, w: 42.4 }]; var v = { aId: 'BH-2 · 3.0 m', pl1: 19.8, pl2: 20.6, pl3: 20.1, aW: 26.5, aClay: 28 }; for (var k in v) $('#' + k).value = v[k]; SH.store.set('shandal_atterberg_ll', trials); ui(); run(); });
  document.addEventListener('sh:redraw', plots);
  ui(); run();
})();
