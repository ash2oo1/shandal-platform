/* Engineering soil classification — Unified Soil Classification System (ASTM D2487) group symbol and group name with the coarse
   and fine modifiers, and AASHTO M 145 group with the group index; gradation coefficients D10, D30, D60, Cu, Cc; gradation curve
   and Casagrande plasticity chart. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG;
  var IDS = ['scId', 'scLL', 'scPL', 'scLLo', 'scPt'], persist = SH.persist('soilclass', IDS), last = null;
  var LAB = { 75: '3″', 37.5: '1½″', 19: '¾″', 9.5: '⅜″', 4.75: '#4', 2: '#10', 0.85: '#20', 0.425: '#40', 0.25: '#60', 0.15: '#100', 0.075: '#200' };
  var DEF1 = [[75, 100], [37.5, 100], [19, 97], [9.5, 92], [4.75, 86], [2, 78], [0.85, 66], [0.425, 54], [0.25, 44], [0.15, 36], [0.075, 27]].map(function (r) { return { d: r[0], p: r[1] }; });
  var DEF2 = [[75, 100], [37.5, 100], [19, 100], [9.5, 100], [4.75, 99], [2, 98], [0.85, 97], [0.425, 95], [0.25, 93], [0.15, 90], [0.075, 84]].map(function (r) { return { d: r[0], p: r[1] }; });
  var T = G.rows($('#scRows'), 'shandal_sclass_rows', [{ k: 'd', h: t('Sieve mm', 'المنخل مم') }, { k: 'p', h: t('% passing', '% المار') }], DEF1, function () { later(); });

  function Dx(pts, P) { for (var i = 0; i + 1 < pts.length; i++) { var a = pts[i], b = pts[i + 1]; if ((a.p - P) * (b.p - P) <= 0 && a.p !== b.p) return Math.pow(10, Math.log10(a.d) + (P - a.p) / (b.p - a.p) * (Math.log10(b.d) - Math.log10(a.d))); } return NaN; }
  function at(pts, d) { for (var i = 0; i + 1 < pts.length; i++) { var a = pts[i], b = pts[i + 1]; if (d <= a.d && d >= b.d) return a.p + (Math.log10(d) - Math.log10(a.d)) / (Math.log10(b.d) - Math.log10(a.d)) * (b.p - a.p); } return d > pts[0].d ? 100 : NaN; }
  var NM = { CL: ['Lean clay', 'طين قليل اللدونة'], CH: ['Fat clay', 'طين عالي اللدونة'], ML: ['Silt', 'غرين'], MH: ['Elastic silt', 'غرين مرن'], 'CL-ML': ['Silty clay', 'طين غريني'], OL: ['Organic clay or silt', 'طين أو غرين عضوي'], OH: ['Organic clay or silt (high LL)', 'طين أو غرين عضوي (LL مرتفع)'] };
  function fines(LL, PI, org) {
    if (isNaN(LL) || isNaN(PI)) return 'ML';
    var A = 0.73 * (LL - 20);
    if (LL < 50) { if (org) return 'OL'; if (PI > 7 && PI >= A) return 'CL'; if (PI >= 4 && PI <= 7 && PI >= A) return 'CL-ML'; return 'ML'; }
    if (org) return 'OH'; return PI >= A ? 'CH' : 'MH';
  }
  function uscs(Gr, Sa, Fi, Cu, Cc, LL, PI, org, pt) {
    var en = [], ar = [], sym;
    if (pt) return { sym: 'PT', en: 'Peat', ar: 'خث' };
    if (Fi >= 50) {
      var fc = fines(LL, PI, org), R = Gr + Sa, sp = Sa >= Gr; sym = fc; var base = NM[fc];
      if (R < 15) return { sym: sym, en: base[0], ar: base[1] };
      if (R < 30) return { sym: sym, en: base[0] + (sp ? ' with sand' : ' with gravel'), ar: base[1] + (sp ? ' مع رمل' : ' مع حصى') };
      var other = sp ? Gr : Sa;
      return { sym: sym, en: (sp ? 'Sandy ' : 'Gravelly ') + base[0].toLowerCase() + (other >= 15 ? (sp ? ' with gravel' : ' with sand') : ''), ar: base[1] + (sp ? ' رملي' : ' حصوي') + (other >= 15 ? (sp ? ' مع حصى' : ' مع رمل') : '') };
    }
    var g = Gr > Sa, X = g ? 'G' : 'S', well = g ? (Cu >= 4 && Cc >= 1 && Cc <= 3) : (Cu >= 6 && Cc >= 1 && Cc <= 3), oth = g ? Sa : Gr, wo = oth >= 15, bEn = g ? 'gravel' : 'sand', bAr = g ? 'حصى' : 'رمل', oEn = g ? 'sand' : 'gravel', oAr = g ? 'رمل' : 'حصى';
    var gEn = well ? 'Well-graded ' : 'Poorly graded ', gAr = well ? ' جيد التدرج' : ' رديء التدرج', fc2 = fines(LL, PI, org), clay = fc2 === 'CL' || fc2 === 'CH' || fc2 === 'CL-ML' || fc2 === 'OL' && PI > 7;
    if (Fi < 5) return { sym: X + (well ? 'W' : 'P'), en: gEn + bEn + (wo ? ' with ' + oEn : ''), ar: bAr + gAr + (wo ? ' مع ' + oAr : '') };
    if (Fi <= 12) { var s2 = X + (well ? 'W' : 'P') + '-' + X + (clay ? 'C' : 'M'); return { sym: s2, en: gEn + bEn + ' with ' + (clay ? 'clay' : 'silt') + (wo ? ' and ' + oEn : ''), ar: bAr + gAr + ' مع ' + (clay ? 'طين' : 'غرين') + (wo ? ' و' + oAr : '') }; }
    if (fc2 === 'CL-ML') return { sym: X + 'C-' + X + 'M', en: 'Silty, clayey ' + bEn + (wo ? ' with ' + oEn : ''), ar: bAr + ' غريني طيني' + (wo ? ' مع ' + oAr : '') };
    return { sym: X + (clay ? 'C' : 'M'), en: (clay ? 'Clayey ' : 'Silty ') + bEn + (wo ? ' with ' + oEn : ''), ar: bAr + (clay ? ' طيني' : ' غريني') + (wo ? ' مع ' + oAr : '') };
  }
  function aashto(P10, P40, P200, LL, PI, np) {
    LL = isNaN(LL) ? 0 : LL; PI = np || isNaN(PI) ? 0 : PI; var g;
    if (P200 <= 35) {
      if (P10 <= 50 && P40 <= 30 && P200 <= 15 && PI <= 6) g = 'A-1-a'; else if (P40 <= 50 && P200 <= 25 && PI <= 6) g = 'A-1-b'; else if (P40 > 50 && P200 <= 10 && PI === 0) g = 'A-3';
      else if (LL <= 40 && PI <= 10) g = 'A-2-4'; else if (LL > 40 && PI <= 10) g = 'A-2-5'; else if (LL <= 40) g = 'A-2-6'; else g = 'A-2-7';
    } else { if (LL <= 40 && PI <= 10) g = 'A-4'; else if (LL > 40 && PI <= 10) g = 'A-5'; else if (LL <= 40) g = 'A-6'; else g = PI <= LL - 30 ? 'A-7-5' : 'A-7-6'; }
    var c = function (v, a, b) { return Math.max(a, Math.min(b, v)); }, GI;
    if (/^A-1|A-3|A-2-4|A-2-5/.test(g)) GI = 0; else if (/^A-2-6|A-2-7/.test(g)) GI = 0.01 * c(P200 - 15, 0, 40) * c(PI - 10, 0, 20); else GI = c(P200 - 35, 0, 40) * (0.2 + 0.005 * c(LL - 40, 0, 20)) + 0.01 * c(P200 - 15, 0, 40) * c(PI - 10, 0, 20);
    GI = Math.max(0, Math.round(GI));
    var rating = /^A-1|A-3/.test(g) ? [t('Excellent to good subgrade', 'تربة أساس ممتازة إلى جيدة'), 'ok'] : /^A-2/.test(g) ? [t('Good to fair subgrade', 'تربة أساس جيدة إلى مقبولة'), 'ok'] : GI > 10 ? [t('Poor subgrade', 'تربة أساس رديئة'), 'bad'] : [t('Fair to poor subgrade', 'تربة أساس مقبولة إلى رديئة'), 'warn'];
    var mat = /^A-1/.test(g) ? t('stone fragments, gravel and sand', 'قطع حجرية وحصى ورمل') : g === 'A-3' ? t('fine sand', 'رمل ناعم') : /^A-2/.test(g) ? t('silty or clayey gravel and sand', 'حصى ورمل غريني أو طيني') : /A-4|A-5/.test(g) ? t('silty soils', 'ترب غرينية') : t('clayey soils', 'ترب طينية');
    return { g: g, GI: GI, rating: rating, mat: mat };
  }
  function run() {
    var rows = T.get().filter(function (r) { return r.d > 0 && r.p != null && r.p >= 0 && r.p <= 100; }).sort(function (a, b) { return b.d - a.d; }); if (rows.length < 3) return; persist.save();
    var P75 = at(rows, 75); if (!isFinite(P75)) P75 = 100; var norm = function (v) { return v / P75 * 100; }, pts = rows.map(function (r) { return { d: r.d, p: Math.min(100, norm(r.p)) }; });
    var P4 = at(pts, 4.75), P200 = at(pts, 0.075), P10 = at(pts, 2), P40 = at(pts, 0.425); if (!isFinite(P200)) { $('#scKpis').innerHTML = ''; $('#scVerd').innerHTML = G.verdict('warn', t('Sieve 0.075 mm needed', 'منخل 0.075 مم مطلوب'), t('Enter the percent passing the 0.075 mm (#200) sieve.', 'أدخل النسبة المارة من منخل 0.075 مم (#200).')); return; }
    var Gr = 100 - (isFinite(P4) ? P4 : 100), Fi = P200, Sa = 100 - Gr - Fi, D10 = Dx(pts, 10), D30 = Dx(pts, 30), D60 = Dx(pts, 60), Cu = D60 / D10, Cc = D30 * D30 / (D10 * D60);
    var LL = G.v('scLL'), PL = G.v('scPL'), np = isNaN(PL), PI = np ? 0 : Math.max(0, LL - PL), LLo = G.v('scLLo'), org = LLo > 0 && LL > 0 && LLo / LL < 0.75, pt = $('#scPt').value === '1';
    var U = uscs(Gr, Sa, Fi, Cu, Cc, LL, np ? NaN : PI, org, pt), A = aashto(P10, P40, P200, LL, PI, np);
    last = { pts: pts, P75: P75, Gr: Gr, Sa: Sa, Fi: Fi, D10: D10, D30: D30, D60: D60, Cu: Cu, Cc: Cc, LL: LL, PL: PL, PI: PI, np: np, org: org, U: U, A: A, P10: P10, P40: P40, P4: P4, id: $('#scId').value };
    render();
  }
  var dd = function (v) { return isFinite(v) ? (v < 0.01 ? v.toPrecision(2) : F(v, v < 1 ? 3 : 2)) : '—'; };
  function render() {
    var R = last, U = R.U, A = R.A;
    $('#scKpis').innerHTML = G.kpi('info', 'USCS', U.sym, SH.lang === 'ar' ? U.ar : U.en) + G.kpi(A.rating[1], 'AASHTO', A.g + ' <small>(' + A.GI + ')</small>', t('group index ', 'دليل المجموعة ') + A.GI) + G.kpi('', t('Gravel · Sand · Fines', 'حصى · رمل · ناعم'), F(R.Gr, 0) + ' · ' + F(R.Sa, 0) + ' · ' + F(R.Fi, 0), '%') + G.kpi('', 'LL · PI', R.np ? 'NP' : F(R.LL, 0) + ' · ' + F(R.PI, 0), R.np ? t('non-plastic', 'غير لدن') : t('plasticity index ', 'دليل اللدونة ') + F(R.PI, 0));
    var v = [G.verdict('info', U.sym + ' — ' + (SH.lang === 'ar' ? U.ar : U.en) + (SH.lang === 'ar' ? ' (' + U.en + ')' : ''), use(U.sym)), G.verdict(A.rating[1], A.g + ' (' + A.GI + ') — ' + A.rating[0], t('Mainly ', 'في الغالب ') + A.mat + t('. The group index rises with fines and plasticity; 0 is best, above 20 very poor.', '. يرتفع دليل المجموعة مع الناعم واللدونة؛ 0 هو الأفضل وفوق 20 رديء جداً.'))];
    if (R.Fi <= 12 && !(R.D10 > 0)) v.push(G.verdict('warn', t('D10 not found', 'لم يُعثر على D10'), t('More than 10 % passes the finest sieve, so Cu and Cc cannot be read; this does not affect soils with more than 12 % fines.', 'يمر أكثر من 10 % من أنعم منخل، فلا يمكن قراءة Cu وCc؛ ولا يؤثر هذا في الترب التي يزيد ناعمها على 12 %.')));
    if (R.P75 < 100) v.push(G.verdict('info', t('Cobbles present', 'وجود جلاميد'), F(100 - R.P75, 0) + t(' % is larger than 75 mm and is excluded from the classification, as the standard requires; add “with cobbles” to the name.', ' % أكبر من 75 مم واستُبعد من التصنيف كما يشترط المعيار؛ أضف «مع جلاميد» إلى الاسم.')));
    $('#scVerd').innerHTML = v.join('');
    figGrad(); figPlas(); table();
  }
  function use(s) {
    var M = { GW: t('Excellent for road bases, drainage and fill; high strength, low compressibility.', 'ممتاز لطبقات أساس الطرق والتصريف والردم؛ مقاومة عالية وانضغاط قليل.'), GP: t('Good fill and drainage material; may need blending for road bases.', 'مادة ردم وتصريف جيدة؛ وقد تحتاج إلى خلط لطبقات أساس الطرق.'), SW: t('Good fill and subbase; compacts well with vibratory rollers.', 'ردم وطبقة ما تحت الأساس جيدان؛ يُرص جيداً بالحادلات الاهتزازية.'), SP: t('Fair fill; uniform sand is prone to liquefaction and erosion when loose and saturated.', 'ردم مقبول؛ والرمل المنتظم عرضة للتميع والتعرية حين يكون مفككاً ومشبعاً.'), GM: t('Fair to good subgrade; fines reduce drainage.', 'تربة أساس مقبولة إلى جيدة؛ والناعم يقلل التصريف.'), GC: t('Good impervious core or subgrade; sensitive to water.', 'لب كتيم أو تربة أساس جيدة؛ حساس للماء.'), SM: t('Fair subgrade; erodible and frost-susceptible; check liquefaction below water.', 'تربة أساس مقبولة؛ قابلة للتعرية والتأثر بالانجماد؛ افحص التميع تحت الماء.'), SC: t('Fair subgrade and good for earth-dam cores; strength falls when wet.', 'تربة أساس مقبولة وجيدة للبّ السدود الترابية؛ تنخفض مقاومتها حين تبتل.'), ML: t('Poor subgrade; loses strength when wet, erodible, sensitive to vibration.', 'تربة أساس رديئة؛ تفقد مقاومتها حين تبتل، وقابلة للتعرية، وحساسة للاهتزاز.'), CL: t('Fair to poor subgrade; medium compressibility; good for impervious liners.', 'تربة أساس مقبولة إلى رديئة؛ انضغاط متوسط؛ جيدة للبطانات الكتيمة.'), 'CL-ML': t('Poor subgrade; sensitive to water content during compaction.', 'تربة أساس رديئة؛ حساسة للمحتوى المائي أثناء الرص.'), MH: t('Poor subgrade; high compressibility and low strength.', 'تربة أساس رديئة؛ انضغاط عالٍ ومقاومة منخفضة.'), CH: t('Very poor subgrade; high swelling and shrinkage: check expansive potential and treat with lime.', 'تربة أساس رديئة جداً؛ انتفاخ وانكماش عاليان: افحص قابلية الانتفاخ وعالجها بالجير.'), OL: t('Unsuitable for foundations and fills; high compressibility and creep.', 'غير صالحة للأسس والردم؛ انضغاط وزحف عاليان.'), OH: t('Unsuitable for foundations and fills; high compressibility and creep.', 'غير صالحة للأسس والردم؛ انضغاط وزحف عاليان.'), PT: t('Remove or bypass with piles; unsuitable for any foundation.', 'أزِلها أو تجاوزها بالركائز؛ غير صالحة لأي أساس.') };
    var k = s.split('-')[0]; return M[s] || M[k] || M[k.slice(0, 2)] || '';
  }
  function figGrad() {
    var R = last, pts = R.pts.slice().sort(function (a, b) { return a.d - b.d; });
    var marks = [[R.D10, 10, 'D10'], [R.D30, 30, 'D30'], [R.D60, 60, 'D60']].filter(function (q) { return isFinite(q[0]); });
    G.chart($('#scGrad'), { W: 560, H: 400, m: { l: 58, r: 16, t: 34, b: 56 }, x: { lo: 0.01, hi: 100, log: true, title: 'Particle size (mm, log scale)' }, y: { lo: 0, hi: 100, st: 20, title: 'Percent passing (%)' },
      under: function (fx, fy) { return [[0.075, 'Fines'], [4.75, 'Sand'], [75, 'Gravel']].map(function (q, i, a) { var x0 = i ? a[i - 1][0] : 0.01; return '<rect x="' + fx(x0) + '" y="' + fy(100) + '" width="' + (fx(q[0]) - fx(x0)) + '" height="' + (fy(0) - fy(100)) + '" fill="' + ['#E8EEF5', '#F6EFD9', '#ECE6DC'][i] + '"/>'; }).join(''); },
      top: function (fx, fy) { var s = [[0.075, 'Fines'], [4.75, 'Sand'], [75, 'Gravel']].map(function (q, i, a) { var x0 = i ? a[i - 1][0] : 0.01; return G.tx((fx(q[0]) + fx(x0)) / 2, fy(100) - 8, q[1], { anchor: 'middle', fs: 11, fw: 700, fill: G.MUT }); }).join(''); marks.forEach(function (q) { s += '<line x1="' + fx(q[0]) + '" x2="' + fx(q[0]) + '" y1="' + fy(q[1]) + '" y2="' + fy(0) + '" stroke="#7A4F9A" stroke-dasharray="3 3"/>' + G.tx(fx(q[0]) + 4, fy(q[1]) - 6, q[2] + ' = ' + dd(q[0]), { fs: 10.5, fill: '#7A4F9A', fw: 700, halo: 1 }); }); return s; },
      series: [{ pts: pts.map(function (p) { return [p.d, p.p]; }), col: '#C0392B', w: 2.4, mark: 'o', r: 4 }], legend: [{ name: 'Sample' + (R.id ? ' ' + R.id : ''), col: '#C0392B', mark: 'o' }, { name: 'D10, D30, D60', col: '#7A4F9A', dash: '3 3' }], note: 'Cu = ' + dd(R.Cu) + ', Cc = ' + dd(R.Cc) + '. Gravel/sand boundary 4.75 mm, sand/fines boundary 0.075 mm (ASTM).' });
    $('#scGradCap').textContent = t('A smooth, flat curve spanning many sizes is a well-graded soil; a steep one is uniform. The coefficients Cu = D60/D10 and Cc = D30²/(D10·D60) decide between well and poorly graded coarse soils.', 'المنحنى الأملس المنبسط الممتد على مقاسات كثيرة يدل على تربة جيدة التدرج، والمنحنى الحاد يدل على تربة منتظمة. ويحدد المعاملان Cu = D60/D10 وCc = D30²/(D10·D60) إن كانت التربة الخشنة جيدة أو رديئة التدرج.');
  }
  function figPlas() {
    var R = last, LLmax = Math.max(100, Math.ceil((R.LL || 0) / 10) * 10 + 10), PImax = Math.max(60, Math.ceil((R.PI || 0) / 10) * 10 + 10);
    G.chart($('#scPlas'), { W: 560, H: 400, m: { l: 58, r: 16, t: 16, b: 56 }, x: { lo: 0, hi: LLmax, st: 10, title: 'Liquid limit LL (%)' }, y: { lo: 0, hi: PImax, st: 10, title: 'Plasticity index PI (%)' },
      under: function (fx, fy) { return '<path d="M' + fx(4 / 0.73 + 20) + ' ' + fy(4) + 'L' + fx(7 / 0.73 + 20) + ' ' + fy(7) + 'L' + fx(7 / 0.9 + 8) + ' ' + fy(7) + 'L' + fx(4 / 0.9 + 8) + ' ' + fy(4) + 'Z" fill="#7A4F9A" fill-opacity=".18"/>' + '<line x1="' + fx(50) + '" x2="' + fx(50) + '" y1="' + fy(0) + '" y2="' + fy(PImax) + '" stroke="' + G.INK + '" stroke-width="1"/>'; },
      series: [{ pts: [[4 / 0.73 + 20, 4], [LLmax, 0.73 * (LLmax - 20)]], col: G.INK, w: 1.8 }, { pts: [[4 / 0.9 + 8, 4], [Math.min(LLmax, PImax / 0.9 + 8), Math.min(PImax, 0.9 * (LLmax - 8))]], col: G.INK, w: 1.2, dash: '6 4' }].concat(R.np ? [] : [{ pts: [[R.LL, R.PI]], col: '#C0392B', w: 0, mark: 'o', r: 7, mfill: '#C0392B' }]),
      top: function (fx, fy) { var L0 = [[42, 24, 'CL or OL'], [72, 46, 'CH or OH'], [38, 3, 'ML or OL'], [76, 20, 'MH or OH'], [20, 5.6, 'CL-ML']]; return L0.map(function (q) { return q[0] < LLmax && q[1] < PImax ? G.tx(fx(q[0]), fy(q[1]), q[2], { anchor: 'middle', fs: 11.5, fw: 700, fill: G.MUT, halo: 1 }) : ''; }).join('') + G.tx(fx(Math.min(LLmax - 2, 90)), fy(0.73 * (Math.min(LLmax - 2, 90) - 20)) + 16, 'A-line', { anchor: 'end', fs: 11, fw: 700 }) + G.tx(fx(Math.min(PImax / 0.9 + 8, LLmax) - 2) - 4, fy(Math.min(PImax, 0.9 * (LLmax - 8))) + 14, 'U-line', { anchor: 'end', fs: 11, fw: 700 }) + (R.np ? '' : G.tx(fx(R.LL) + 10, fy(R.PI) - 8, R.U.sym, { fs: 12, fw: 800, fill: '#C0392B', halo: 1 })); },
      legend: [{ name: 'A-line PI = 0.73 (LL − 20)', col: G.INK }, { name: 'U-line PI = 0.9 (LL − 8)', col: G.INK, dash: '6 4' }, { name: 'CL-ML zone', col: '#7A4F9A', box: 1, op: .3 }].concat(R.np ? [] : [{ name: 'Sample fines', col: '#C0392B', mark: 'o', mfill: '#C0392B', noLine: 1 }]), note: R.np ? 'Fines are non-plastic (NP): no point plotted.' : 'LL = ' + F(R.LL, 0) + ' %, PL = ' + F(R.PL, 0) + ' %, PI = ' + F(R.PI, 0) + ' %.' });
    $('#scPlasCap').textContent = t('Casagrande’s chart separates clays (above the A-line) from silts (below), and low from high plasticity at LL = 50. Points above the U-line usually signal a test error.', 'يفصل مخطط كازاغراندي الأطيان (فوق خط A) عن الغرين (تحته)، واللدونة المنخفضة عن العالية عند LL = 50. والنقاط فوق خط U تدل عادة على خطأ في الفحص.');
  }
  function table() {
    var R = last, row = function (a, b) { return '<tr><td>' + a + '</td><td class="num">' + b + '</td></tr>'; };
    $('#scTbl').innerHTML = '<tbody>' + row(t('Gravel (75–4.75 mm)', 'حصى (75–4.75 مم)'), F(R.Gr, 1) + ' %') + row(t('Sand (4.75–0.075 mm)', 'رمل (4.75–0.075 مم)'), F(R.Sa, 1) + ' %') + row(t('Fines (< 0.075 mm)', 'ناعم (< 0.075 مم)'), F(R.Fi, 1) + ' %') + row(t('Passing 2.0 mm / 0.425 mm', 'المار من 2.0 مم / 0.425 مم'), F(R.P10, 0) + ' / ' + F(R.P40, 0) + ' %') + row('D10 · D30 · D60', dd(R.D10) + ' · ' + dd(R.D30) + ' · ' + dd(R.D60) + ' mm') + row('Cu · Cc', dd(R.Cu) + ' · ' + dd(R.Cc)) + row('LL · PL · PI', R.np ? 'NP' : F(R.LL, 0) + ' · ' + F(R.PL, 0) + ' · ' + F(R.PI, 0)) + row('USCS', R.U.sym + ' · ' + R.U.en) + row('AASHTO', R.A.g + ' (' + R.A.GI + ')') + '</tbody>';
  }
  $('#scCsv').addEventListener('click', function () { if (!last) return; var R = last; SH.csv('shandal-soil-classification.csv', [['sieve_mm', 'percent_passing']].concat(R.pts.map(function (p) { return [p.d, p.p.toFixed(1)]; })).concat([[], ['gravel_pct', R.Gr.toFixed(1)], ['sand_pct', R.Sa.toFixed(1)], ['fines_pct', R.Fi.toFixed(1)], ['D10_mm', isFinite(R.D10) ? R.D10.toPrecision(3) : ''], ['D30_mm', isFinite(R.D30) ? R.D30.toPrecision(3) : ''], ['D60_mm', isFinite(R.D60) ? R.D60.toPrecision(3) : ''], ['Cu', isFinite(R.Cu) ? R.Cu.toFixed(2) : ''], ['Cc', isFinite(R.Cc) ? R.Cc.toFixed(2) : ''], ['LL', R.np ? 'NP' : R.LL], ['PI', R.np ? 'NP' : R.PI], ['USCS', R.U.sym], ['USCS_name', R.U.en], ['AASHTO', R.A.g], ['group_index', R.A.GI]])); });
  var tm = null; function later() { clearTimeout(tm); tm = setTimeout(run, 150); }
  IDS.forEach(function (id) { var e = $('#' + id); e.addEventListener('input', later); e.addEventListener('change', later); });
  $('#scDemo').addEventListener('click', function () { T.set(DEF1); G.set({ scId: 'BH-2 · 3.0 m', scLL: 34, scPL: 19, scLLo: '', scPt: '0' }); run(); });
  $('#scDemo2').addEventListener('click', function () { T.set(DEF2); G.set({ scId: 'BH-5 · 6.0 m', scLL: 62, scPL: 26, scLLo: '', scPt: '0' }); run(); });
  document.addEventListener('DOMContentLoaded', run);
})();
