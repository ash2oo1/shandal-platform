/* Well-log lab — loads wells (LAS, Excel, CSV, typed readings or a traced image), draws the composite log in the standard
   layout, interprets it (wl/petro.js), and shows crossplots, layers, well correlation, the response chart of the logs and
   the guide to each log (wl/guide.js). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, AR = SH.lang === 'ar', WL = window.WL;
  var C = function (en, ar) { return AR ? ar : en; };
  var IDS = ['wMode', 'wForm', 'wVsh', 'wModel', 'wGrMin', 'wGrMax', 'wRw', 'wFT', 'wRwT', 'wRmf', 'wA', 'wM', 'wN', 'wRhof', 'wCV', 'wCP', 'wCS', 'wMinTh', 'wScale'];
  var persist = SH.persist('welllog', IDS);
  var wells = [], act = -1, R = null, lastSvg = null;
  var KN = { GR: 'Gamma ray', CGR: 'Gamma ray without U', K: 'Potassium', TH: 'Thorium', U: 'Uranium', SP: 'Spontaneous potential', CALI: 'Caliper', BS: 'Bit size', RD: 'Deep resistivity', RM: 'Medium resistivity', RXO: 'Shallow / flushed-zone resistivity',
    RHOB: 'Bulk density', DRHO: 'Density correction', NPHI: 'Neutron porosity', PEF: 'Photoelectric factor', DT: 'Sonic', DTS: 'Shear sonic', TEMP: 'Temperature', NMR: 'NMR', ROP: 'Rate of penetration', '': '—' };
  var KNA = { GR: 'أشعة گاما', CGR: 'گاما دون اليورانيوم', K: 'البوتاسيوم', TH: 'الثوريوم', U: 'اليورانيوم', SP: 'الجهد الذاتي', CALI: 'مقياس القطر', BS: 'حجم الحافرة', RD: 'المقاومة العميقة', RM: 'المقاومة المتوسطة', RXO: 'المقاومة الضحلة / المغسولة',
    RHOB: 'الكثافة الكلية', DRHO: 'تصحيح الكثافة', NPHI: 'المسامية النيوترونية', PEF: 'العامل الكهروضوئي', DT: 'الصوتي', DTS: 'الصوتي القصي', TEMP: 'الحرارة', NMR: 'الرنين المغناطيسي', ROP: 'سرعة الحفر', '': '—' };
  var SHORT = { GR: 'gamma ray', CGR: 'GR without U', K: 'potassium', TH: 'thorium', U: 'uranium', SP: 'spont. potential', CALI: 'caliper', BS: 'bit size', RD: 'deep', RM: 'medium', RXO: 'shallow', RHOB: 'bulk density', NPHI: 'neutron', PEF: 'photoelectric', DT: 'sonic', DTS: 'shear sonic' };
  var kname = function (k) { return AR ? KNA[k] || k : KN[k] || k; };
  var FAC = [['#f6e05e', 'Sandstone', 'حجر رملي'], ['#6fa8dc', 'Limestone', 'حجر جيري'], ['#c27ba0', 'Dolomite', 'دولومايت'], ['#f4cccc', 'Anhydrite', 'أنهايدرايت'], ['#8c8c8c', 'Shale', 'طفل'],
    ['#dbeafe', 'Salt (halite)', 'ملح (هالايت)'], ['#111111', 'Coal', 'فحم'], ['#3d3d3d', 'Organic-rich shale', 'طفل غني بالمادة العضوية'], ['#d9d9d9', 'Clean rock', 'صخر نظيف']];
  var FLU = [['#2c7bb6', 'Water', 'ماء'], ['#1a9850', 'Oil', 'نفط'], ['#d7191c', 'Gas', 'غاز'], ['#2c7bb6', 'Fresh water', 'ماء عذب'], ['#fdae61', 'Brackish water', 'ماء مويلح'], ['#d7191c', 'Saline water', 'ماء مالح']];

  /* ---------------------------------------------------------------- loading */
  function add(w) { wells.push(w); act = wells.length - 1; listWells(); curvesUI(); run(); }
  function fail(name) { SH.toast(t('Could not read ', 'تعذرت قراءة ') + name + t(': check that it is LAS, Excel or a table with a header row.', ': تحقق أنه ملف LAS أو Excel أو جدول بسطر عناوين.'), 'bad'); }
  $('#wFile').addEventListener('change', function () {
    if (!SH.pro()) { SH.needPro(); this.value = ''; return; }
    Array.prototype.forEach.call(this.files, function (f) {
      var nm = f.name.replace(/\.[^.]+$/, '');
      if (/\.xlsx$/i.test(f.name)) f.arrayBuffer().then(function (b) { return WL.readXLSX(b, nm); }).then(add).catch(function () { fail(f.name); });
      else f.text().then(function (s) { return /~\s*[VvWwCcAa]/.test(s) ? WL.readLAS(s, nm) : WL.readTable(s, nm); }).then(add).catch(function () { fail(f.name); });
    });
    this.value = '';
  });
  $('#wDemo').addEventListener('click', function () { add(WL.example()); });
  $('#wPasteBtn').addEventListener('click', function () { $('#wPaste').hidden = !$('#wPaste').hidden; });
  $('#wPasteGo').addEventListener('click', function () { if (!SH.pro()) { SH.needPro(); return; } try { add(WL.readTable($('#wPasteT').value, $('#wPasteN').value.trim() || t('Typed readings', 'قراءات مُدخلة'))); $('#wPaste').hidden = true; } catch (e) { fail(t('the readings', 'القراءات')); } });
  function listWells() {
    $('#wWells').innerHTML = wells.map(function (w, i) { var d0 = w.D[0], d1 = w.D[w.D.length - 1]; return '<label><input type="radio" name="wAct" value="' + i + '"' + (i === act ? ' checked' : '') + '><span>' + SH.esc(w.name) + '<small class="ltr">' + fd(d0) + '–' + fd(d1) + ' ' + w.unit + ' · ' + w.curves.length + t(' curves', ' منحنى') + '</small></span><button class="x" type="button" data-del="' + i + '" aria-label="' + t('Remove', 'حذف') + '">✕</button></label>'; }).join('');
  }
  $('#wWells').addEventListener('change', function (e) { if (e.target.name === 'wAct') { act = +e.target.value; curvesUI(); run(); } });
  $('#wWells').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; e.preventDefault(); wells.splice(+b.getAttribute('data-del'), 1); act = Math.min(act, wells.length - 1); listWells(); curvesUI(); run(); });
  var KOPT = ['', 'GR', 'CGR', 'K', 'TH', 'U', 'SP', 'CALI', 'BS', 'RD', 'RM', 'RXO', 'RHOB', 'DRHO', 'NPHI', 'PEF', 'DT', 'DTS', 'TEMP', 'NMR', 'ROP'];
  function curvesUI() {
    var w = wells[act]; if (!w) { $('#wCurves').innerHTML = ''; return; }
    $('#wCurves').innerHTML = '<table class="wl-cv"><tr><th></th><th>' + t('Name', 'الاسم') + '</th><th>' + t('Unit', 'الوحدة') + '</th><th>' + t('Log', 'المجس') + '</th></tr>' + w.curves.map(function (c, i) {
      return '<tr><td><input type="checkbox" data-on="' + i + '"' + (c.on ? ' checked' : '') + '></td><td class="ltr" title="' + SH.esc(c.desc || '') + '"><b>' + SH.esc(c.mn) + '</b>' + (c.note ? '<br><small class="muted">' + SH.esc(c.note) + '</small>' : '') + '</td><td class="ltr">' + SH.esc(c.u || '') + '</td><td><select data-k="' + i + '">' + KOPT.map(function (k) { return '<option value="' + k + '"' + (k === c.kind ? ' selected' : '') + '>' + (k ? k + ' · ' + kname(k) : t('Not used', 'غير مستعمل')) + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</table>';
  }
  $('#wCurves').addEventListener('change', function (e) { var w = wells[act]; if (!w) return; var i = e.target.getAttribute('data-on'), k = e.target.getAttribute('data-k'); if (i != null) w.curves[+i].on = e.target.checked; if (k != null) w.curves[+k].kind = e.target.value; run(); });

  /* ---------------------------------------------------------------- parameters and run */
  var num = function (id) { var v = parseFloat($('#' + id).value); return isFinite(v) ? v : NaN; };
  function params() {
    var water = SH.val('wMode') === 'water';
    return { mode: SH.val('wMode'), form: SH.val('wForm'), vshM: SH.val('wVsh'), model: SH.val('wModel'), top: num('wTop'), bot: num('wBot'), grMin: num('wGrMin'), grMax: num('wGrMax'), rw: num('wRw'), fT: num('wFT'), rwT: num('wRwT'), rmf: num('wRmf'),
      a: num('wA') || 1, m: num('wM') || 2, n: num('wN') || 2, rhof: num('wRhof') || 1, cutV: isFinite(num('wCV')) ? num('wCV') : 0.4, cutP: isFinite(num('wCP')) ? num('wCP') : (water ? 0.15 : 0.08), cutS: isFinite(num('wCS')) ? num('wCS') : 0.5, minTh: num('wMinTh') };
  }
  IDS.concat(['wTop', 'wBot']).forEach(function (id) { var e = $('#' + id); if (e) e.addEventListener('change', run); });
  function run() {
    persist.save(); var w = wells[act];
    if (!w) { R = null; empty(); return; }
    var P = params(); R = WL.analyse(w, P); R.P = P; R.w = w;
    kpis(); verdict(); drawLog(); xplots(); zonesTable(); corr(); accDyn();
  }
  function empty() {
    $('#wKpis').innerHTML = ''; $('#wVerd').innerHTML = '<div class="verdict info"><span class="vi">' + SH.icon('info') + '</span><div><h3>' + t('Load a well', 'حمّل بئراً') + '</h3><p>' + t('Load a LAS, Excel or CSV file, type the readings, trace a log from an image, or open the example well built from the response chart below.', 'حمّل ملف LAS أو Excel أو CSV، أو اكتب القراءات، أو تتبّع مجساً من صورة، أو افتح البئر المثال المبنية من لوحة الاستجابة أدناه.') + '</p></div></div>';
    ['wLog', 'wZones', 'wCorr', 'wAccDyn', 'wXcap'].forEach(function (id) { $('#' + id).innerHTML = ''; }); ['wXnd', 'wXpk', 'wXmn'].forEach(function (id) { if (window.Plotly) Plotly.purge($('#' + id)); $('#' + id).innerHTML = ''; });
  }

  /* ---------------------------------------------------------------- results text */
  var fd = function (v) { return isFinite(v) ? (+v).toFixed(1) : '—'; };
  var pc = function (v, d) { return isFinite(v) ? SH.fmt(v * 100, d == null ? 0 : d) + '%' : '—'; };
  var len = function (v) { return isFinite(v) ? SH.fmt(v, v < 10 ? 1 : 0) + ' ' + R.w.unit : '—'; };
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function kpis() {
    var T = R.tot, water = R.P.mode === 'water', av = Object.keys(R.avail).filter(function (k) { return R.avail[k]; });
    $('#wKpis').innerHTML = kpi('', t('Interval', 'المدى'), '<span class="ltr">' + fd(R.top) + '–' + fd(R.bot) + '</span>', R.w.unit + ' · ' + av.length + t(' logs used', ' مجسات مستعملة')) +
      kpi(T.net > 0 ? 'ok' : 'warn', water ? t('Aquifer thickness', 'سُمك الخزان المائي') : t('Net pay', 'السُمك المنتج الصافي'), len(T.net), water ? t('clean, porous levels', 'مستويات نظيفة مسامية') : t('reservoir with Sw below the cutoff', 'مكمن بتشبع ماء دون الحد')) +
      kpi('', t('Porosity', 'المسامية'), pc(T.phi), water ? t('mean of the aquifer', 'متوسط الخزان') : t('mean of the pay', 'متوسط المنتج')) +
      (water ? kpi('', t('Dissolved solids', 'الأملاح الذائبة'), (function () { var s = 0, k = 0; for (var i = 0; i < R.n; i++) if (R.PAY[i] && isFinite(R.TDS[i])) { s += R.TDS[i]; k++; } return k ? Math.round(s / k) + '<small> mg/L</small>' : '—'; })(), t('mean of the aquifer (from Rw)', 'متوسط الخزان (من Rw)')) : kpi('', t('Water saturation', 'التشبع بالماء'), pc(T.sw), t('mean of the pay', 'متوسط المنتج'))) +
      kpi('', 'R<sub>w</sub>', SH.fmt(R.rw, 3) + '<small> Ω·m</small>', R.rwAuto ? t('estimated from the logs', 'مقدّرة من المجسات') : t('as entered', 'كما أُدخلت')) +
      kpi(R.resMed > 1.5 ? 'warn' : '', t('Mineral model misfit', 'عدم تطابق نموذج المعادن'), isFinite(R.resMed) ? SH.fmt(R.resMed, 2) : '—', t('below 1 is good', 'أقل من 1 جيد'));
  }
  function verdict() {
    var T = R.tot, water = R.P.mode === 'water', msgs = [];
    var pays = R.zones.filter(function (z) { return z.net > 0 && (water ? z.flu >= 3 : z.flu === 1 || z.flu === 2); });
    var zl = pays.slice(0, 6).map(function (z) { return '<span class="ltr">' + fd(z.top) + '–' + fd(z.base) + '</span> (' + (AR ? FLU[z.flu][2] : FLU[z.flu][1]) + (water && isFinite(z.tds) ? t(', ', '، ') + Math.round(z.tds) + ' mg/L' : !water ? t(', ', '، ') + 'Sw ' + pc(z.sw) : '') + ')'; }).join(t('; ', '؛ '));
    var h, p, st;
    if (!R.avail.RD && !water) { st = 'warn'; h = t('No resistivity log: lithology and porosity only', 'لا يوجد مجس مقاومة: الصخارية والمسامية فقط'); p = t('Water saturation and fluids need a deep resistivity log.', 'التشبع بالماء والموائع تحتاج إلى مجس مقاومة عميقة.'); }
    else if (pays.length) { st = 'ok'; h = water ? t('Aquifers found', 'خزانات مائية محددة') : t('Hydrocarbon-bearing layers found', 'طبقات حاملة للهيدروكربونات'); p = (water ? t('Aquifer levels: ', 'المستويات المائية: ') : t('Pay: ', 'الطبقات المنتجة: ')) + zl + '. ' + t('Net ', 'السُمك الصافي ') + len(T.net) + t(' of ', ' من أصل ') + len(T.len) + '.'; }
    else { st = 'info'; h = water ? t('No clean porous aquifer above the cutoffs', 'لا يوجد خزان مائي نظيف مسامي فوق الحدود') : t('No pay above the cutoffs', 'لا يوجد سُمك منتج فوق الحدود'); p = t('Reservoir-quality levels: ', 'المستويات بنوعية مكمنية: ') + len(T.res) + '. ' + t('Check Rw, m and the cutoffs.', 'راجع Rw وm والحدود.'); }
    if (T.gas > 0.05 && !water) msgs.push(t('Density–neutron crossover marks gas in part of the pay.', 'تقاطع الكثافة والنيوترون يدل على غاز في جزء من المنتج.'));
    if (T.frac > 0) msgs.push(t('Fracture or vug candidates (density–neutron porosity above sonic porosity) over ', 'مرشحات كسور أو فجوات (مسامية الكثافة والنيوترون أعلى من الصوتية) على مدى ') + len(T.frac) + '.');
    if (T.wash > 0.05) msgs.push(t('Bad hole over ', 'البئر متضرر في ') + pc(T.wash) + t(' of the interval: density and neutron are unreliable there.', ' من المدى: لا يُعتمد على الكثافة والنيوترون هناك.'));
    if (R.rwAuto && R.avail.RD) msgs.push(R.rwN >= 5 ? t('Rw was estimated from the lowest Rwa of ', 'قُدّرت Rw من أدنى قيم Rwa لـ') + R.rwN + t(' clean porous samples; enter the measured value if you have it.', ' عينة نظيفة مسامية؛ أدخل القيمة المقاسة إن توفرت.') : t('Too few clean porous samples to estimate Rw: 0.05 Ω·m was assumed. Enter Rw.', 'العينات النظيفة المسامية قليلة لتقدير Rw: افتُرضت 0.05 أوم·م. أدخل Rw.'));
    if (!R.avail.RHOB && !R.avail.NPHI && R.avail.DT) msgs.push(t('Porosity from the sonic log only (Raymer–Hunt–Gardner).', 'المسامية من السجل الصوتي فقط (ريمر–هنت–گاردنر).'));
    if (!R.avail.RHOB && !R.avail.NPHI && !R.avail.DT) msgs.push(t('No porosity log: only shale volume and layers can be given.', 'لا يوجد مجس مسامية: يمكن إعطاء حجم الطين والطبقات فقط.'));
    $('#wVerd').innerHTML = '<div class="verdict ' + st + '"><span class="vi">' + SH.icon(st === 'ok' ? 'ok' : st === 'warn' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + (msgs.length ? ' ' + msgs.join(' ') : '') + '</p></div></div>';
  }
  function zoneText(z) {
    var water = R.P.mode === 'water', f = FAC[z.f] || FAC[8], lith = AR ? f[2] : f[1], s = [];
    if (z.f <= 3 || z.f === 8) {
      s.push(isFinite(z.vsh) ? (z.vsh < 0.15 ? t('clean', 'نظيف') : z.vsh < 0.35 ? t('slightly shaly', 'قليل الطين') : t('shaly', 'طيني')) : '');
      if (isFinite(z.phi)) s.push(z.phi < 0.05 ? t('tight', 'محكم') : z.phi < 0.1 ? t('low porosity', 'منخفض المسامية') : z.phi < 0.18 ? t('moderate porosity', 'متوسط المسامية') : z.phi < 0.25 ? t('good porosity', 'جيد المسامية') : t('very good porosity', 'عالي المسامية جداً'));
      if (z.flu >= 0) s.push((AR ? FLU[z.flu][2] : FLU[z.flu][1]).toLowerCase() + (water ? '' : t('-bearing', '')));
    }
    if (z.f === 7) s.push(t('possible source rock (high gamma ray and resistivity, low density)', 'صخر مصدري محتمل (گاما ومقاومة عاليتان وكثافة منخفضة)'));
    if (z.frac > 0.2) s.push(t('fracture or vug candidate', 'مرشح كسور أو فجوات'));
    if (z.inv > 0.4 && z.f !== 4) s.push(t('invaded, permeable', 'مغزو بطين الحفر، نفاذ'));
    if (z.wash > 0.4) s.push(t('washed-out hole', 'بئر متوسّع'));
    return lith + (s.filter(Boolean).length ? t(': ', ': ') + s.filter(Boolean).join(t(', ', '، ')) : '');
  }
  function zonesTable() {
    var water = R.P.mode === 'water', u = R.w.unit;
    var h = '<tr><th>#</th><th class="num">' + t('Top', 'القمة') + ' (' + u + ')</th><th class="num">' + t('Base', 'القاعدة') + '</th><th class="num">' + t('Thick.', 'السُمك') + '</th><th class="num">GR</th><th class="num">V<sub>sh</sub></th><th class="num">φ</th>' +
      (water ? '<th class="num">TDS mg/L</th>' : '<th class="num">S<sub>w</sub> ' + t('(range)', '(المدى)') + '</th>') + '<th class="num">R<sub>t</sub></th><th>' + t('Interpretation', 'التفسير') + '</th><th class="num">' + (water ? t('Aquifer', 'خزان') : t('Net pay', 'منتج')) + '</th></tr>';
    $('#wZones').innerHTML = h + R.zones.map(function (z, i) { var f = FAC[z.f] || FAC[8];
      return '<tr><td><span class="sw-chip" style="background:' + f[0] + '"></span>' + (i + 1) + '</td><td class="num">' + fd(z.top) + '</td><td class="num">' + fd(z.base) + '</td><td class="num">' + fd(z.th) + '</td><td class="num">' + (isFinite(z.gr) ? SH.fmt(z.gr, 0) : '—') + '</td><td class="num">' + (isFinite(z.vsh) ? SH.fmt(z.vsh, 2) : '—') + '</td><td class="num">' + (isFinite(z.phi) ? SH.fmt(z.phi, 3) : '—') + '</td>' +
        (water ? '<td class="num">' + (isFinite(z.tds) ? Math.round(z.tds) : '—') + '</td>' : '<td class="num">' + (isFinite(z.sw) && z.flu >= 0 ? pc(z.sw) + (isFinite(z.swLo) ? ' <small class="muted">(' + SH.fmt(z.swLo * 100, 0) + '–' + SH.fmt(z.swHi * 100, 0) + ')</small>' : '') : '—') + '</td>') +
        '<td class="num">' + (isFinite(z.rt) ? SH.fmt(z.rt, z.rt < 10 ? 2 : 0) : '—') + '</td><td>' + zoneText(z) + '</td><td class="num">' + (z.net > 0 ? SH.fmt(z.net, 1) : '—') + '</td></tr>'; }).join('');
  }

  /* ---------------------------------------------------------------- composite log (SVG) */
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  function niceStep(span, px, target) { var raw = span * target / px, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function drawLog() {
    var w = R.w, D = w.D, n = D.length, i0 = 0, i1 = n - 1; while (i0 < n && !R.IN[i0]) i0++; while (i1 > 0 && !R.IN[i1]) i1--; if (i1 <= i0) { $('#wLog').innerHTML = ''; return; }
    var span = D[i1] - D[i0], sc = SH.val('wScale'), nIn = i1 - i0 + 1, Hp;
    if (sc === 'fit') Hp = Math.max(900, Math.min(2600, nIn * 1.6)); else Hp = span * (1000 / +sc) * 3.7795 * (w.unit === 'ft' ? 0.3048 : 1);
    var warn = ''; if (Hp > 14000) { Hp = 14000; warn = t('The interval is long for this scale: it was shortened to fit. Narrow the interval with Top and Base.', 'المدى طويل لهذا المقياس فاختُصر ليلائم. ضيّق المدى بالقمة والقاعدة.'); }
    var c = function (k) { return WL.curve(w, k); }, has = function (k) { return !!c(k); };
    var TR = [];
    if (has('GR') || has('SP') || has('CALI') || has('CGR')) TR.push({ id: 'gr', w: 150, ks: ['GR', 'CGR', 'SP', 'CALI', 'BS'] });
    if (has('K') || has('TH') || has('U')) TR.push({ id: 'sgr', w: 120, ks: ['K', 'TH', 'U'] });
    TR.push({ id: 'dep', w: 64 });
    if (has('RD') || has('RM') || has('RXO')) TR.push({ id: 'res', w: 170, ks: ['RD', 'RM', 'RXO'] });
    if (has('RHOB') || has('NPHI') || has('PEF')) TR.push({ id: 'nd', w: 180, ks: ['RHOB', 'NPHI', 'PEF'] });
    if (has('DT') || has('DTS')) TR.push({ id: 'dt', w: 120, ks: ['DT', 'DTS'] });
    TR.push({ id: 'vol', w: 150 }); TR.push({ id: 'phi', w: 130 }); TR.push({ id: 'int', w: 104 });
    var x = 12; TR.forEach(function (tr) { tr.x = x; x += tr.w; }); var W = x + 12, HH = 112, y0 = 58 + HH, H = y0 + Hp + 150;
    var Y = function (d) { return y0 + (d - D[i0]) / (span || 1) * Hp; };
    var stride = Math.max(1, Math.floor(nIn / Hp)), rowH = Math.max(1, Hp / nIn * stride) + 0.4;
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + Math.round(H) + '" width="' + W + '" height="' + Math.round(H) + '" font-family="Manrope, Arial, sans-serif" style="direction:ltr;background:#fff;max-width:none">', '<rect width="' + W + '" height="' + Math.round(H) + '" fill="#fff"/>'];
    o.push('<text x="12" y="24" font-size="17" font-weight="800" fill="#111">' + esc('Composite log — ' + w.name) + '</text>');
    o.push('<text x="12" y="44" font-size="11.5" fill="#444">' + esc('Depth ' + fd(D[i0]) + '–' + fd(D[i1]) + ' ' + w.unit + ' (MD)' + (sc === 'fit' ? '' : ' · scale 1:' + sc) + ' · ' + (R.P.mode === 'water' ? 'groundwater interpretation' : 'oil and gas interpretation') + ' · Rw ' + SH.fmt(R.rw, 3) + ' Ω·m · a ' + R.P.a + ', m ' + R.P.m + ', n ' + R.P.n + ' · ' + { indonesia: 'Indonesia', simandoux: 'Simandoux', archie: 'Archie' }[R.P.model]) + '</text>');
    var defs = ['<defs>']; TR.forEach(function (tr) { defs.push('<clipPath id="cl_' + tr.id + '"><rect x="' + tr.x + '" y="' + y0 + '" width="' + tr.w + '" height="' + Hp + '"/></clipPath>'); });
    defs.push('<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#777" stroke-width="1.4"/></pattern></defs>'); o.push(defs.join(''));
    /* grids */
    var dstep = niceStep(span, Hp, 60), minor = dstep / 5;
    TR.forEach(function (tr) {
      o.push('<rect x="' + tr.x + '" y="' + (58) + '" width="' + tr.w + '" height="' + (HH + Hp) + '" fill="none" stroke="#222" stroke-width="1"/>');
      o.push('<line x1="' + tr.x + '" y1="' + y0 + '" x2="' + (tr.x + tr.w) + '" y2="' + y0 + '" stroke="#222"/>');
      if (tr.id === 'dep') return;
      var g = [], dd;
      for (dd = Math.ceil(D[i0] / minor) * minor; dd <= D[i1]; dd += minor) { var yy = Y(dd).toFixed(1), major = Math.abs(dd / dstep - Math.round(dd / dstep)) < 1e-6; g.push('<line x1="' + tr.x + '" y1="' + yy + '" x2="' + (tr.x + tr.w) + '" y2="' + yy + '" stroke="' + (major ? '#bbb' : '#e6e6e6') + '" stroke-width="' + (major ? 0.8 : 0.5) + '"/>'); }
      if (tr.id === 'res') [0.2, 2, 20, 200, 2000].forEach(function (v, k) { for (var s2 = 1; s2 < 10 && k < 4; s2++) { var xv = tr.x + (Math.log10(v * s2) - Math.log10(0.2)) / 4 * tr.w; g.push('<line x1="' + xv.toFixed(1) + '" y1="' + y0 + '" x2="' + xv.toFixed(1) + '" y2="' + (y0 + Hp) + '" stroke="' + (s2 === 1 ? '#bbb' : '#eee') + '" stroke-width="0.5"/>'); } });
      else for (var q = 1; q < 10; q++) g.push('<line x1="' + (tr.x + tr.w * q / 10).toFixed(1) + '" y1="' + y0 + '" x2="' + (tr.x + tr.w * q / 10).toFixed(1) + '" y2="' + (y0 + Hp) + '" stroke="' + (q === 5 ? '#ccc' : '#eee') + '" stroke-width="0.5"/>');
      o.push(g.join(''));
    });
    /* depth track */
    var dt0 = TR.filter(function (tr) { return tr.id === 'dep'; })[0];
    o.push('<text x="' + (dt0.x + dt0.w / 2) + '" y="' + (58 + HH / 2) + '" font-size="11" font-weight="700" text-anchor="middle" fill="#111">Depth</text><text x="' + (dt0.x + dt0.w / 2) + '" y="' + (58 + HH / 2 + 15) + '" font-size="10.5" text-anchor="middle" fill="#444">' + w.unit + '</text>');
    for (var dd2 = Math.ceil(D[i0] / dstep) * dstep; dd2 <= D[i1] + 1e-9; dd2 += dstep) { var yy2 = Y(dd2); o.push('<line x1="' + dt0.x + '" y1="' + yy2.toFixed(1) + '" x2="' + (dt0.x + 7) + '" y2="' + yy2.toFixed(1) + '" stroke="#222"/><line x1="' + (dt0.x + dt0.w - 7) + '" y1="' + yy2.toFixed(1) + '" x2="' + (dt0.x + dt0.w) + '" y2="' + yy2.toFixed(1) + '" stroke="#222"/><text x="' + (dt0.x + dt0.w / 2) + '" y="' + (yy2 + 4).toFixed(1) + '" font-size="10.5" text-anchor="middle" fill="#111">' + SH.fmt(dd2, dstep < 1 ? 1 : 0).replace(/,/g, '') + '</text>'); }
    /* helpers */
    var XS = function (tr, s, v, lg) { if (!isFinite(v)) return NaN; var f = lg ? (Math.log10(Math.max(v, 1e-6)) - Math.log10(s[0])) / (Math.log10(s[1]) - Math.log10(s[0])) : (v - s[0]) / (s[1] - s[0]); return tr.x + f * tr.w; };
    var poly = function (tr, arr, s, lg, col, dash, wd) { var p = '', pen = false; for (var i = i0; i <= i1; i += stride) { var xv = XS(tr, s, arr[i], lg); if (!isFinite(xv)) { pen = false; continue; } p += (pen ? 'L' : 'M') + xv.toFixed(1) + ' ' + Y(D[i]).toFixed(1); pen = true; }
      return '<path d="' + p + '" fill="none" stroke="' + col + '" stroke-width="' + (wd || 1.3) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' clip-path="url(#cl_' + tr.id + ')"/>'; };
    var rect = function (x1, x2, yy, h) { if (!(x2 > x1)) return ''; h = Math.min(h, y0 + Hp - yy); if (!(h > 0)) return ''; return 'M' + x1.toFixed(1) + ' ' + yy.toFixed(1) + 'h' + (x2 - x1).toFixed(1) + 'v' + h.toFixed(2) + 'h' + (x1 - x2).toFixed(1) + 'z'; };
    var header = function (tr, rows) { rows.forEach(function (r, k) { var yy = 58 + 16 + k * 24; o.push('<text x="' + (tr.x + tr.w / 2) + '" y="' + yy + '" font-size="10.5" font-weight="700" text-anchor="middle" fill="' + r.c + '">' + esc(r.n) + '</text>');
      if (r.s) { o.push('<line x1="' + (tr.x + 4) + '" y1="' + (yy + 5) + '" x2="' + (tr.x + tr.w - 4) + '" y2="' + (yy + 5) + '" stroke="' + r.c + '" stroke-width="1.6"' + (r.d ? ' stroke-dasharray="' + r.d + '"' : '') + '/>');
        o.push('<text x="' + (tr.x + 4) + '" y="' + (yy + 15) + '" font-size="9" fill="' + r.c + '">' + esc(r.s[0]) + '</text><text x="' + (tr.x + tr.w / 2) + '" y="' + (yy + 15) + '" font-size="9" text-anchor="middle" fill="' + r.c + '">' + esc(r.u || '') + '</text><text x="' + (tr.x + tr.w - 4) + '" y="' + (yy + 15) + '" font-size="9" text-anchor="end" fill="' + r.c + '">' + esc(r.s[1]) + '</text>'); } }); };
    var spS = null; (function () { var sp = c('SP'); if (!sp) return; var a = WL.pct(sp, 0.02), b = WL.pct(sp, 0.98), m2 = Math.max(20, (b - a) * 1.1), mid = (a + b) / 2; spS = [Math.round(mid - m2 / 2), Math.round(mid + m2 / 2)]; })();
    TR.forEach(function (tr) {
      if (tr.ks) {
        var hr = [];
        tr.ks.forEach(function (k) { var arr = c(k); if (!arr) return; var st = WL.STYLE[k], s = k === 'SP' ? spS : st.s; if (!s) return;
          if (tr.id === 'gr' && (k === 'GR' || k === 'CGR') && k === (c('GR') ? 'GR' : 'CGR')) { var f = ''; for (var i = i0; i <= i1; i += stride) { var xv = XS(tr, s, arr[i]); if (isFinite(xv)) f += rect(tr.x, Math.min(xv, tr.x + tr.w), Y(D[i]), rowH); } o.push('<path d="' + f + '" fill="#d9ef8b" opacity="0.55" clip-path="url(#cl_' + tr.id + ')"/>'); }
          o.push(poly(tr, arr, s, st.log, st.c, st.d, k === 'BS' ? 1 : 1.4)); hr.push({ n: k + ' · ' + (SHORT[k] || KN[k]), c: st.c, d: st.d, s: [String(s[0]), String(s[1])], u: st.u }); });
        if (tr.id === 'nd' && c('RHOB') && c('NPHI')) {
          var rb = c('RHOB'), np = c('NPHI'), sR = WL.STYLE.RHOB.s, sN = WL.STYLE.NPHI.s, fg = '', fs = '';
          for (var j = i0; j <= i1; j += stride) { var xr = XS(tr, sR, rb[j]), xn = XS(tr, sN, np[j]); if (!isFinite(xr) || !isFinite(xn)) continue; xr = Math.max(tr.x, Math.min(tr.x + tr.w, xr)); xn = Math.max(tr.x, Math.min(tr.x + tr.w, xn)); var yy3 = Y(D[j]); if (xr < xn) fg += rect(xr, xn, yy3, rowH); else fs += rect(xn, xr, yy3, rowH); }
          o.push('<path d="' + fs + '" fill="#9e9e9e" opacity="0.45"/><path d="' + fg + '" fill="#ffd400" opacity="0.75"/>');
          tr.ks.forEach(function (k) { var arr = c(k); if (arr) { var st = WL.STYLE[k]; o.push(poly(tr, arr, st.s, false, st.c, st.d, 1.4)); } });
        }
        header(tr, hr.slice(0, 4));
      }
      if (tr.id === 'vol') {
        var comps = [['VSH', '#8c8c8c', 'Shale']].concat(R.set.map(function (s2) { return [s2, WL.MIN[s2].col, WL.MIN[s2].en]; }), [['hal', '#dbeafe', 'Halite'], ['coal', '#111', 'Coal']]), paths = {};
        comps.forEach(function (cp) { paths[cp[0]] = ''; }); paths.W = ''; paths.HC = ''; paths.G = '';
        for (var i2 = i0; i2 <= i1; i2 += stride) { if (!R.IN[i2]) continue; var xx = tr.x, yy4 = Y(D[i2]), vsh = R.VSH[i2];
          comps.forEach(function (cp) { var v = cp[0] === 'VSH' ? vsh : R.V[cp[0]] ? R.V[cp[0]][i2] : NaN; if (!(v > 0)) return; var x2 = Math.min(tr.x + tr.w, xx + v * tr.w); paths[cp[0]] += rect(xx, x2, yy4, rowH); xx = x2; });
          var ph = R.PHI[i2]; if (ph > 0) { var sw = isFinite(R.SW[i2]) && R.P.mode !== 'water' ? R.SW[i2] : 1, xw = Math.min(tr.x + tr.w, xx + ph * sw * tr.w); paths.W += rect(xx, xw, yy4, rowH); paths[R.GAS[i2] ? 'G' : 'HC'] += rect(xw, Math.min(tr.x + tr.w, xx + ph * tr.w), yy4, rowH); } }
        comps.forEach(function (cp) { if (paths[cp[0]]) o.push('<path d="' + paths[cp[0]] + '" fill="' + cp[1] + '"/>'); });
        o.push('<path d="' + paths.W + '" fill="#4f9fe0"/><path d="' + paths.HC + '" fill="#1a9850"/><path d="' + paths.G + '" fill="#d7191c"/>');
        header(tr, [{ n: 'Volumes', c: '#111' }, { n: '0 · fraction of rock · 1', c: '#444' }, { n: 'shale · minerals · water', c: '#444' }, { n: 'oil (green) · gas (red)', c: '#444' }]);
      }
      if (tr.id === 'phi') {
        var sP = [0.5, 0], fh = '', fw = '', fhg = '';
        for (var i3 = i0; i3 <= i1; i3 += stride) { if (!R.IN[i3]) continue; var p3 = R.PHI[i3], b3 = R.BVW[i3]; if (!(p3 > 0)) continue; var xp = XS(tr, sP, Math.min(0.5, p3)), yy5 = Y(D[i3]);
          var xb = isFinite(b3) && R.P.mode !== 'water' ? XS(tr, sP, Math.min(0.5, b3)) : xp; fw += rect(xb, tr.x + tr.w, yy5, rowH); if (R.GAS[i3]) fhg += rect(xp, xb, yy5, rowH); else fh += rect(xp, xb, yy5, rowH); }
        o.push('<path d="' + fw + '" fill="#4f9fe0" opacity="0.7"/><path d="' + fh + '" fill="#1a9850" opacity="0.8"/><path d="' + fhg + '" fill="#d7191c" opacity="0.8"/>');
        o.push(poly(tr, R.PHI, sP, false, '#111', null, 1.3));
        if (R.P.mode !== 'water' && R.avail.RD) o.push(poly(tr, R.SW, [1, 0], false, '#7b3294', '5 3', 1.2));
        header(tr, [{ n: 'PHIE · effective porosity', c: '#111', s: ['0.5', '0'], u: 'v/v' }, R.P.mode !== 'water' && R.avail.RD ? { n: 'SW · water saturation', c: '#7b3294', d: '5 3', s: ['1', '0'], u: 'v/v' } : { n: 'blue: water-filled', c: '#2c7bb6' }, { n: 'BVW: blue · HC: green/red', c: '#444' }]);
      }
      if (tr.id === 'int') {
        var hw = tr.w / 2 - 2, fp = {}, flp = {}, frp = '', wsp = '', srp = '';
        for (var i4 = i0; i4 <= i1; i4 += stride) { if (!R.IN[i4]) continue; var yy6 = Y(D[i4]), fc = R.FAC[i4]; if (fc >= 0) fp[fc] = (fp[fc] || '') + rect(tr.x, tr.x + hw, yy6, rowH);
          var fl = R.FLU[i4]; if (fl >= 0 && R.PAY[i4]) flp[fl] = (flp[fl] || '') + rect(tr.x + hw + 2, tr.x + hw + 2 + hw * 0.55, yy6, rowH); else if (fl === 0) flp[0] = (flp[0] || '') + rect(tr.x + hw + 2, tr.x + hw + 2 + hw * 0.55, yy6, rowH);
          if (R.FRAC[i4]) frp += rect(tr.x + tr.w - hw * 0.42, tr.x + tr.w - 1, yy6, rowH); if (R.WASH[i4]) wsp += rect(tr.x + tr.w - hw * 0.42, tr.x + tr.w - 1, yy6, rowH); }
        Object.keys(fp).forEach(function (k) { o.push('<path d="' + fp[k] + '" fill="' + FAC[k][0] + '"/>'); }); Object.keys(flp).forEach(function (k) { o.push('<path d="' + flp[k] + '" fill="' + FLU[k][0] + '"/>'); });
        o.push('<path d="' + wsp + '" fill="url(#hatch)"/><path d="' + frp + '" fill="#ff7f00"/>');
        header(tr, [{ n: 'Interpretation', c: '#111' }, { n: 'lithology · fluid', c: '#444' }, { n: 'orange: fractures', c: '#ff7f00' }, { n: 'hatch: bad hole', c: '#555' }]);
      }
    });
    /* layer boundaries across the log */
    R.zones.forEach(function (z, k) { var yz = Y(z.top); if (k) o.push('<line x1="' + TR[0].x + '" y1="' + yz.toFixed(1) + '" x2="' + (W - 12) + '" y2="' + yz.toFixed(1) + '" stroke="#333" stroke-width="0.7" stroke-dasharray="4 3" opacity="0.55"/>'); if (z.th > span / 60) o.push('<text x="' + (dt0.x + 4) + '" y="' + (Y((z.top + z.base) / 2) + 3).toFixed(1) + '" font-size="8.5" fill="#b35806">' + (k + 1) + '</text>'); });
    /* legend below the log */
    var ly = y0 + Hp + 46, lx = 12, put = function (col, txt, pat) { var wd = 12 + txt.length * 6.1 + 18; if (lx + wd > W - 12) { lx = 12; ly += 20; } o.push('<rect x="' + lx + '" y="' + (ly - 10) + '" width="13" height="13" fill="' + (pat ? 'url(#hatch)' : col) + '" stroke="#555" stroke-width="0.5"/><text x="' + (lx + 18) + '" y="' + ly + '" font-size="10.5" fill="#222">' + esc(txt) + '</text>'); lx += wd; };
    o.push('<text x="12" y="' + (ly - 18) + '" font-size="11" font-weight="800" fill="#111">Legend</text>');
    var seen = {}; for (var i5 = i0; i5 <= i1; i5++) if (R.FAC[i5] >= 0) seen[R.FAC[i5]] = 1; Object.keys(seen).forEach(function (k) { put(FAC[k][0], FAC[k][1]); });
    lx = 12; ly += 20; var sf = {}; for (i5 = i0; i5 <= i1; i5++) if (R.FLU[i5] >= 0) sf[R.FLU[i5]] = 1; Object.keys(sf).forEach(function (k) { put(FLU[k][0], FLU[k][1]); });
    put('#ffd400', 'Density–neutron crossover (gas or light hydrocarbon)'); put('#9e9e9e', 'Neutron left of density (shale)'); put('#ff7f00', 'Fracture or vug candidate'); put('', 'Bad hole (washout)', true);
    ['GR gamma ray · SP spontaneous potential · CALI caliper · BS bit size · RD/RM/RXO deep/medium/shallow resistivity · RHOB bulk density · NPHI neutron porosity (limestone units)',
     'PEF photoelectric factor · DT sonic · PHIE effective porosity · SW water saturation · BVW bulk volume of water · HC hydrocarbon',
     'Dashed lines: layer boundaries, numbered as in the table of layers.'].forEach(function (s3) { ly += 17; o.push('<text x="12" y="' + ly + '" font-size="10" fill="#555">' + esc(s3) + '</text>'); });
    H = ly + 20; o[0] = o[0].replace(/ \d+" width="(\d+)" height="\d+"/, ' ' + Math.round(H) + '" width="$1" height="' + Math.round(H) + '"'); o[1] = '<rect width="' + W + '" height="' + Math.round(H) + '" fill="#fff"/>';
    o.push('</svg>');
    $('#wLog').innerHTML = (warn ? '<p class="xsmall" style="margin:6px;color:var(--warn)">' + warn + '</p>' : '') + o.join('');
    lastSvg = $('#wLog svg');
  }

  /* ---------------------------------------------------------------- crossplots */
  function xplots() {
    if (!window.Plotly) return; var w = R.w, c = function (k) { return WL.curve(w, k); }, RB = c('RHOB'), NP = c('NPHI'), RD = c('RD') || c('RM'), DT = c('DT'), GR = c('GR') || c('CGR');
    var idx = []; for (var i = 0; i < R.n; i++) if (R.IN[i]) idx.push(i); var st = Math.max(1, Math.floor(idx.length / 2500)); idx = idx.filter(function (_, k) { return k % st === 0; });
    var cb = function (ttl) { return { thickness: 10, len: 0.6, title: { text: ttl, side: 'right' }, x: 1.02 }; };
    var L = function (x, y) { return { margin: { l: 58, r: 70, t: 30, b: 92 }, xaxis: x, yaxis: y, legend: { orientation: 'h', y: -0.3 }, showlegend: true }; };
    if (RB && NP) {
      var lines = [['Sandstone', 2.65, function (p) { return 0.95 * p - 0.02; }, '#b08800'], ['Limestone', 2.71, function (p) { return p; }, '#2c7bb6'], ['Dolomite', 2.87, function (p) { return 1.08 * p + 0.02; }, '#8e44ad']].map(function (L2) {
        var ps = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]; return { x: ps.map(L2[2]), y: ps.map(function (p) { return L2[1] - (L2[1] - R.P.rhof) * p; }), mode: 'lines+markers', marker: { size: 4 }, line: { color: L2[3], width: 1.6 }, name: L2[0], text: ps.map(function (p) { return 'φ ' + p; }), hoverinfo: 'name+text' }; });
      var pts = { x: idx.map(function (i) { return NP[i]; }), y: idx.map(function (i) { return RB[i]; }), mode: 'markers', type: 'scattergl', name: 'Samples', marker: { size: 4, color: idx.map(function (i) { return GR ? GR[i] : 0; }), colorscale: 'Viridis', cmin: R.grMin, cmax: R.grMax, colorbar: cb('GR'), opacity: 0.75 }, hovertemplate: 'NPHI %{x:.3f} · RHOB %{y:.3f}<extra></extra>' };
      var ref = { x: [-0.02, -0.03, R.SH.n], y: [2.98, 2.04, R.SH.r], mode: 'markers+text', text: ['Anhydrite', 'Salt', 'Shale'], textposition: 'middle right', marker: { size: 9, symbol: 'diamond', color: '#333' }, name: 'End members' };
      SH.plot('wXnd', lines.concat([pts, ref]), L({ title: { text: 'NPHI (v/v, limestone units)' }, range: [-0.05, 0.5] }, { title: { text: 'RHOB (g/cm³)' }, range: [3.0, 1.9] }), { filename: 'shandal-density-neutron' });
    } else { Plotly.purge($('#wXnd')); $('#wXnd').innerHTML = '<div class="empty-s"><p>' + t('Density and neutron logs are needed for this crossplot.', 'يحتاج هذا المخطط إلى مجسي الكثافة والنيوترون.') + '</p></div>'; }
    if (RD) {
      var ix2 = idx.filter(function (i) { return R.PHI[i] > 0.01 && RD[i] > 0; }), a = R.P.a, m = R.P.m, nn = R.P.n, lines2 = [1, 0.5, 0.25, 0.1].map(function (s) { var ph = [0.01, 1]; return { x: ph, y: ph.map(function (p) { return a * R.rw / (Math.pow(p, m) * Math.pow(s, nn)); }), mode: 'lines', name: 'Sw ' + s * 100 + '%', line: { width: 1.5, dash: s === 1 ? 'solid' : 'dash' } }; });
      SH.plot('wXpk', lines2.concat([{ x: ix2.map(function (i) { return R.PHI[i]; }), y: ix2.map(function (i) { return RD[i]; }), mode: 'markers', type: 'scattergl', name: 'Samples', marker: { size: 4, color: ix2.map(function (i) { return R.VSH[i]; }), colorscale: 'YlOrBr', cmin: 0, cmax: 1, colorbar: cb('Vsh'), opacity: 0.8 }, hovertemplate: 'φ %{x:.3f} · Rt %{y:.2f}<extra></extra>' }]),
        L({ title: { text: 'Effective porosity φ (v/v)' }, type: 'log', range: [-2, 0] }, { title: { text: 'Deep resistivity Rt (Ω·m)' }, type: 'log', range: [-1, 3.3] }), { filename: 'shandal-pickett' });
    } else { Plotly.purge($('#wXpk')); $('#wXpk').innerHTML = '<div class="empty-s"><p>' + t('A deep resistivity log is needed for the Pickett plot.', 'يحتاج مخطط بيكيت إلى مجس مقاومة عميقة.') + '</p></div>'; }
    if (DT && RB && NP) {
      var rf = R.P.rhof, ix3 = idx.filter(function (i) { return RB[i] > rf + 0.2; }), MN = function (dt, r, nph) { return [(189 - dt) / (r - rf) * 0.01, (1 - nph) / (r - rf)]; };
      var mins = ['qtz', 'cal', 'dol', 'anh', 'hal'].map(function (k) { var M = WL.MIN[k]; return [M.en].concat(MN(M.dt, M.r, M.n)); }); mins.push(['Shale'].concat(MN(R.SH.dt, R.SH.r, R.SH.n)));
      SH.plot('wXmn', [{ x: ix3.map(function (i) { return MN(DT[i], RB[i], NP[i])[1]; }), y: ix3.map(function (i) { return MN(DT[i], RB[i], NP[i])[0]; }), mode: 'markers', type: 'scattergl', name: 'Samples', marker: { size: 4, color: ix3.map(function (i) { return GR ? GR[i] : 0; }), colorscale: 'Viridis', cmin: R.grMin, cmax: R.grMax, colorbar: cb('GR'), opacity: 0.75 } },
        { x: mins.map(function (q) { return q[2]; }), y: mins.map(function (q) { return q[1]; }), text: mins.map(function (q) { return q[0]; }), mode: 'markers+text', textposition: 'top center', marker: { size: 10, symbol: 'diamond', color: '#333' }, name: 'Minerals' }],
        L({ title: { text: 'N = (1 − NPHI) / (ρb − ρf)' }, range: [0.3, 1.1] }, { title: { text: 'M = 0.01 (189 − DT) / (ρb − ρf)' }, range: [0.5, 1.3] }), { filename: 'shandal-m-n' });
    } else if (GR) {
      var gv = idx.map(function (i) { return GR[i]; });
      SH.plot('wXmn', [{ x: gv, type: 'histogram', nbinsx: 40, marker: { color: '#1a9850' }, name: 'GR' }, { x: [R.grMin, R.grMin], y: [0, idx.length / 8], mode: 'lines', name: 'GR clean', line: { color: '#b08800', dash: 'dash' } }, { x: [R.grMax, R.grMax], y: [0, idx.length / 8], mode: 'lines', name: 'GR shale', line: { color: '#555', dash: 'dash' } }],
        L({ title: { text: 'Gamma ray (gAPI)' } }, { title: { text: 'Samples' } }), { filename: 'shandal-gr-histogram' });
    }
    $('#wXcap').textContent = t('Left: density–neutron crossplot with the sandstone, limestone and dolomite lines (porosity marked every 0.05); gas moves points up and to the left, shale to the lower right. Middle: Pickett plot of porosity against deep resistivity with lines of equal water saturation (slope −1/m). Right: M–N lithology plot (needs sonic) or the gamma-ray histogram with the clean and shale values used.',
      'اليسار: مخطط الكثافة والنيوترون مع خطوط الحجر الرملي والجيري والدولومايت (المسامية معلّمة كل 0.05)؛ يحرك الغاز النقاط إلى الأعلى واليسار، والطفل إلى الأسفل واليمين. الوسط: مخطط بيكيت للمسامية مقابل المقاومة العميقة مع خطوط تساوي التشبع بالماء (الميل −1/m). اليمين: مخطط M–N للصخارية (يحتاج الصوتي) أو مدرج أشعة گاما مع قيمتي الصخر النظيف والطفل المستعملتين.');
  }

  /* ---------------------------------------------------------------- correlation of loaded wells */
  var corrK = 'GR';
  function corr() {
    if (wells.length < 2) { $('#fgCorr').hidden = true; return; } $('#fgCorr').hidden = false;
    var ks = ['GR', 'RD', 'RHOB', 'NPHI', 'DT', 'SP'].filter(function (k) { return wells.some(function (w) { return WL.curve(w, k); }); }); if (ks.indexOf(corrK) < 0) corrK = ks[0];
    $('#wCorrK').innerHTML = ks.map(function (k) { return '<button type="button" data-k="' + k + '" aria-pressed="' + (k === corrK) + '">' + k + ' · ' + kname(k) + '</button>'; }).join('');
    var P = R.P, maxSpan = 0; wells.forEach(function (w) { maxSpan = Math.max(maxSpan, w.D[w.D.length - 1] - w.D[0]); });
    var Hp = 1100, pxu = Hp / maxSpan, tw = 170, gap = 34, W = 20 + wells.length * (tw + 40 + gap), y0 = 70, st = WL.STYLE[corrK], o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + (y0 + Hp + 50) + '" width="' + W + '" height="' + (y0 + Hp + 50) + '" font-family="Manrope, Arial, sans-serif" style="direction:ltr;background:#fff;max-width:none"><rect width="100%" height="100%" fill="#fff"/>'];
    o.push('<text x="12" y="22" font-size="15" font-weight="800" fill="#111">' + esc('Well comparison — ' + corrK + ' (' + KN[corrK] + ')') + '</text><text x="12" y="40" font-size="10.5" fill="#444">Each well on its own depth axis at the same vertical scale; left strip: interpreted lithology.</text>');
    wells.forEach(function (w, k) {
      var arr = WL.curve(w, corrK), x0 = 20 + k * (tw + 40 + gap), Rk = WL.analyse(w, Object.assign({}, P, { top: NaN, bot: NaN })), D = w.D, Y = function (d) { return y0 + (d - D[0]) * pxu; }, s = corrK === 'SP' ? [WL.pct(arr || [], 0.02) - 10, WL.pct(arr || [], 0.98) + 10] : st.s;
      o.push('<text x="' + (x0 + 40 + tw / 2) + '" y="' + (y0 - 12) + '" font-size="11.5" font-weight="700" text-anchor="middle" fill="#111">' + esc(w.name) + '</text>');
      o.push('<rect x="' + x0 + '" y="' + y0 + '" width="30" height="' + ((D[D.length - 1] - D[0]) * pxu).toFixed(1) + '" fill="none" stroke="#222"/><rect x="' + (x0 + 40) + '" y="' + y0 + '" width="' + tw + '" height="' + ((D[D.length - 1] - D[0]) * pxu).toFixed(1) + '" fill="none" stroke="#222"/>');
      var stp = Math.max(1, Math.floor(D.length / Hp)), rh = Math.max(1, pxu * (w.step || 0) * stp) + 0.4, fp = {};
      for (var i = 0; i < D.length; i += stp) { var f = Rk.FAC[i]; if (f >= 0) fp[f] = (fp[f] || '') + 'M' + x0 + ' ' + Y(D[i]).toFixed(1) + 'h30v' + rh.toFixed(2) + 'h-30z'; }
      Object.keys(fp).forEach(function (f) { o.push('<path d="' + fp[f] + '" fill="' + FAC[f][0] + '"/>'); });
      if (arr && s) { var p = '', pen = false; for (i = 0; i < D.length; i += stp) { var v = arr[i]; if (!isFinite(v)) { pen = false; continue; } var fx = st.log ? (Math.log10(Math.max(v, 1e-6)) - Math.log10(s[0])) / (Math.log10(s[1]) - Math.log10(s[0])) : (v - s[0]) / (s[1] - s[0]); p += (pen ? 'L' : 'M') + (x0 + 40 + Math.max(0, Math.min(1, fx)) * tw).toFixed(1) + ' ' + Y(D[i]).toFixed(1); pen = true; }
        o.push('<path d="' + p + '" fill="none" stroke="' + st.c + '" stroke-width="1.3"/><text x="' + (x0 + 42) + '" y="' + (y0 - 1) + '" font-size="8.5" fill="#555">' + s[0] + '</text><text x="' + (x0 + 38 + tw) + '" y="' + (y0 - 1) + '" font-size="8.5" text-anchor="end" fill="#555">' + s[1] + '</text>'); }
      var ds = niceStep(D[D.length - 1] - D[0], (D[D.length - 1] - D[0]) * pxu, 70); for (var dd = Math.ceil(D[0] / ds) * ds; dd <= D[D.length - 1]; dd += ds) o.push('<text x="' + (x0 + 38 + tw + 4) + '" y="' + (Y(dd) + 3).toFixed(1) + '" font-size="9" fill="#333">' + SH.fmt(dd, 0).replace(/,/g, '') + '</text><line x1="' + (x0 + 40) + '" y1="' + Y(dd).toFixed(1) + '" x2="' + (x0 + 40 + tw) + '" y2="' + Y(dd).toFixed(1) + '" stroke="#e5e5e5"/>');
    });
    o.push('</svg>'); $('#wCorr').innerHTML = o.join('');
  }
  $('#wCorrK').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; corrK = b.getAttribute('data-k'); corr(); });

  /* ---------------------------------------------------------------- dynamic accuracy */
  function accDyn() {
    var s = [];
    if (isFinite(R.resMed)) s.push(t('Mineral model of this well: median misfit ', 'نموذج المعادن لهذه البئر: متوسط عدم التطابق ') + '<b class="ltr">' + SH.fmt(R.resMed, 2) + '</b>' + (R.resMed > 1.5 ? t(' — high: a mineral or fluid is missing from the model.', ' — مرتفع: معدن أو مائع غائب عن النموذج.') : t(' — the logs are reproduced within their measurement error.', ' — تُعاد المجسات ضمن خطأ قياسها.')));
    s.push(t('Water resistivity used: ', 'مقاومة الماء المستعملة: ') + '<b class="ltr">' + SH.fmt(R.rw, 3) + ' Ω·m</b> ' + (R.rwAuto ? t('(estimated — the largest single source of error in saturation)', '(مقدّرة — أكبر مصدر منفرد للخطأ في التشبع)') : t('(entered)', '(مُدخلة)')) + '.');
    if (R.tot.wash > 0) s.push(t('Bad hole: ', 'البئر المتضرر: ') + '<b class="ltr">' + pc(R.tot.wash, 1) + '</b>' + t(' of the interval.', ' من المدى.'));
    if (R.w.meta && R.w.meta.dig) s.push(R.w.meta.dig);
    $('#wAccDyn').innerHTML = '<p style="margin:0">' + s.join('<br>') + '</p>';
  }

  /* ---------------------------------------------------------------- downloads */
  var fname = function (s) { return 'shandal-' + s + '-' + String((wells[act] || {}).name || 'well').replace(/[^\w؀-ۿ.-]+/g, '_'); };
  $('#wPng').addEventListener('click', function () { if (!R || !lastSvg) return; SH.svgPng(lastSvg, fname('composite-log') + '.png', lastSvg.viewBox.baseVal.height > 6000 ? 1 : 2, '#fff'); });
  function resultCols() {
    var w = R.w, base = [['DEPT', w.unit, w.D]];
    w.curves.forEach(function (c) { if (c.on) base.push([c.mn, c.u || '', c.v]); });
    [['VSH', 'v/v', R.VSH], ['PHIE', 'v/v', R.PHI], ['SW', 'v/v', R.SW], ['BVW', 'v/v', R.BVW], ['SXO', 'v/v', R.SXO], ['PERM', 'mD', R.PERM], ['TDS', 'mg/L', R.TDS], ['FACIES', 'code', R.FAC], ['FLUID', 'code', R.FLU], ['PAY', 'flag', R.PAY], ['GASFLAG', 'flag', R.GAS], ['FRACFLAG', 'flag', R.FRAC], ['BADHOLE', 'flag', R.WASH]].forEach(function (q) { base.push(q); });
    return base;
  }
  $('#wCsv').addEventListener('click', function () { if (!R) return; var cols = resultCols(), rows = [cols.map(function (c) { return c[0] + (c[1] ? ' (' + c[1] + ')' : ''); })];
    for (var i = 0; i < R.n; i++) { if (!R.IN[i]) continue; rows.push(cols.map(function (c) { var v = c[2][i]; return isFinite(v) ? +(+v).toPrecision(6) : ''; })); } SH.csv(fname('results') + '.csv', rows); });
  $('#wLas').addEventListener('click', function () { if (!R) return; var cols = resultCols(), w = R.w, i0 = 0, i1 = R.n - 1; while (!R.IN[i0]) i0++; while (!R.IN[i1]) i1--;
    var L = ['~Version Information', ' VERS.          2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0', ' WRAP.           NO : One line per depth step', '~Well Information', ' STRT.' + w.unit + '  ' + w.D[i0].toFixed(4) + ' : START DEPTH', ' STOP.' + w.unit + '  ' + w.D[i1].toFixed(4) + ' : STOP DEPTH', ' STEP.' + w.unit + '  ' + (w.step || 0).toFixed(4) + ' : STEP', ' NULL.        -999.25 : NULL VALUE', ' WELL.  ' + w.name + ' : WELL', ' SRVC.  Shandal Geological Field Survey System : INTERPRETATION', ' DATE.  ' + new Date().toISOString().slice(0, 10) + ' : DATE', '~Curve Information'];
    cols.forEach(function (c) { L.push(' ' + c[0] + '.' + c[1].replace(/\s/g, '') + '  : ' + (KN[WL.kindOf(c[0])] || c[0])); });
    L.push('~Parameter Information', ' RW.ohm.m  ' + R.rw.toFixed(4) + ' : Formation water resistivity', ' A.  ' + R.P.a + ' : Tortuosity factor', ' M.  ' + R.P.m + ' : Cementation exponent', ' N.  ' + R.P.n + ' : Saturation exponent', '~A');
    for (var i = i0; i <= i1; i++) L.push(cols.map(function (c) { var v = c[2][i]; return (isFinite(v) ? (+v).toFixed(4) : '-999.25').padStart(11); }).join(' '));
    SH.download(fname('results') + '.las', L.join('\r\n') + '\r\n', 'text/plain;charset=utf-8'); });
  $('#wZCsv').addEventListener('click', function () { if (!R) return; var rows = [['#', 'Top', 'Base', 'Thickness', 'Lithology', 'GR', 'Vsh', 'PHIE', 'Sw', 'Sw min', 'Sw max', 'Rt', 'TDS mg/L', 'Net', 'Interpretation']];
    R.zones.forEach(function (z, k) { var f = FAC[z.f] || FAC[8]; rows.push([k + 1, z.top.toFixed(2), z.base.toFixed(2), z.th.toFixed(2), AR ? f[2] : f[1], isFinite(z.gr) ? z.gr.toFixed(1) : '', isFinite(z.vsh) ? z.vsh.toFixed(3) : '', isFinite(z.phi) ? z.phi.toFixed(3) : '', isFinite(z.sw) ? z.sw.toFixed(3) : '', isFinite(z.swLo) ? z.swLo.toFixed(3) : '', isFinite(z.swHi) ? z.swHi.toFixed(3) : '', isFinite(z.rt) ? z.rt.toFixed(2) : '', isFinite(z.tds) ? z.tds.toFixed(0) : '', z.net.toFixed(2), zoneText(z)]); });
    SH.csv(fname('layers') + '.csv', rows); });

  /* ---------------------------------------------------------------- response chart of the logs (type section) */
  function typeChart() {
    var T = WL.TYPE, tot = T.reduce(function (s, q) { return s + q.th; }, 0), Hp = 900, py = Hp / tot, y0 = 150, cols = [['col', 170], ['GR', 110], ['SP', 80], ['CALI', 80], ['RES', 150], ['ND', 160], ['PEF', 80], ['DT', 100], ['SGR', 120]], x = 12;
    cols.forEach(function (c) { c.x = x; x += c[1]; }); var W = x + 12, H = y0 + Hp + 40, o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="Manrope, Arial, sans-serif" style="direction:ltr;background:#fff;max-width:none"><rect width="100%" height="100%" fill="#fff"/>'];
    o.push('<text x="12" y="24" font-size="17" font-weight="800" fill="#111">Typical log responses to rocks and fluids</text><text x="12" y="42" font-size="11" fill="#444">Blocky values from the interpretation chart books (Rw 0.05 Ω·m, Rmf 0.5 Ω·m, fresh-mud filtrate, neutron in limestone units). Read across: each rock and fluid has its own fingerprint.</text>');
    var yAt = []; var yy = y0; T.forEach(function (q) { yAt.push([yy, yy + q.th * py]); yy += q.th * py; });
    var X = function (c, s, v, lg) { var f = lg ? (Math.log10(v) - Math.log10(s[0])) / (Math.log10(s[1]) - Math.log10(s[0])) : (v - s[0]) / (s[1] - s[0]); return c.x + Math.max(0, Math.min(1, f)) * c[1]; };
    var line = function (c, key, s, lg, col, dash) { var p = ''; T.forEach(function (q, k) { var xv = X(c, s, q[key], lg); p += (k ? 'L' : 'M') + xv.toFixed(1) + ' ' + yAt[k][0].toFixed(1) + 'L' + xv.toFixed(1) + ' ' + yAt[k][1].toFixed(1); }); o.push('<path d="' + p + '" fill="none" stroke="' + col + '" stroke-width="1.8"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>'); };
    var head = function (c, rows) { rows.forEach(function (r, k) { var hy = 64 + k * 26; o.push('<text x="' + (c.x + c[1] / 2) + '" y="' + hy + '" font-size="10" font-weight="700" text-anchor="middle" fill="' + r[1] + '">' + esc(r[0]) + '</text>'); if (r[2]) o.push('<line x1="' + (c.x + 4) + '" y1="' + (hy + 5) + '" x2="' + (c.x + c[1] - 4) + '" y2="' + (hy + 5) + '" stroke="' + r[1] + '" stroke-width="1.6"' + (r[3] ? ' stroke-dasharray="' + r[3] + '"' : '') + '/><text x="' + (c.x + 3) + '" y="' + (hy + 15) + '" font-size="8.5" fill="' + r[1] + '">' + r[2][0] + '</text><text x="' + (c.x + c[1] - 3) + '" y="' + (hy + 15) + '" font-size="8.5" text-anchor="end" fill="' + r[1] + '">' + r[2][1] + '</text>'); }); };
    cols.forEach(function (c) { o.push('<rect x="' + c.x + '" y="50" width="' + c[1] + '" height="' + (y0 - 50 + Hp) + '" fill="none" stroke="#222"/><line x1="' + c.x + '" y1="' + y0 + '" x2="' + (c.x + c[1]) + '" y2="' + y0 + '" stroke="#222"/>'); });
    T.forEach(function (q, k) { var c0 = cols[0]; o.push('<rect x="' + c0.x + '" y="' + yAt[k][0].toFixed(1) + '" width="' + c0[1] + '" height="' + (yAt[k][1] - yAt[k][0]).toFixed(1) + '" fill="' + q.col + '" stroke="#999" stroke-width="0.5"/><text x="' + (c0.x + 5) + '" y="' + ((yAt[k][0] + yAt[k][1]) / 2 + 3.5).toFixed(1) + '" font-size="9.5" fill="' + (/#(1|3)/.test(q.col) ? '#fff' : '#111') + '">' + esc(q.en) + '</text>');
      cols.slice(1).forEach(function (c) { o.push('<line x1="' + c.x + '" y1="' + yAt[k][1].toFixed(1) + '" x2="' + (c.x + c[1]) + '" y2="' + yAt[k][1].toFixed(1) + '" stroke="#eee"/>'); }); });
    head(cols[0], [['Rock and fluid', '#111']]);
    line(cols[1], 'GR', [0, 220], false, '#1a9850'); head(cols[1], [['GR', '#1a9850', ['0', '220 gAPI']]]);
    line(cols[2], 'SP', [-100, 20], false, '#2166ac', '6 3'); head(cols[2], [['SP', '#2166ac', ['−100', '+20 mV'], '6 3']]);
    line(cols[3], 'CALI', [6, 16], false, '#222', '2 3'); o.push('<line x1="' + X(cols[3], [6, 16], 8.5) + '" y1="' + y0 + '" x2="' + X(cols[3], [6, 16], 8.5) + '" y2="' + (y0 + Hp) + '" stroke="#999" stroke-dasharray="1 4"/>'); head(cols[3], [['CALI · BS', '#222', ['6', '16 in'], '2 3']]);
    line(cols[4], 'RD', [0.2, 2000], true, '#d7191c'); line(cols[4], 'RXO', [0.2, 2000], true, '#222', '2 2'); head(cols[4], [['RD deep', '#d7191c', ['0.2', '2000 Ω·m']], ['RXO shallow', '#222', ['0.2', '2000'], '2 2']]);
    (function () { var c = cols[5], fg = '', fs = ''; T.forEach(function (q, k) { var xr = X(c, [1.95, 2.95], q.RHOB), xn = X(c, [0.45, -0.15], q.NPHI); var r1 = 'M' + Math.min(xr, xn).toFixed(1) + ' ' + yAt[k][0].toFixed(1) + 'H' + Math.max(xr, xn).toFixed(1) + 'V' + yAt[k][1].toFixed(1) + 'H' + Math.min(xr, xn).toFixed(1) + 'z'; if (xr < xn) fg += r1; else fs += r1; }); o.push('<path d="' + fs + '" fill="#9e9e9e" opacity="0.45"/><path d="' + fg + '" fill="#ffd400" opacity="0.8"/>'); })();
    line(cols[5], 'RHOB', [1.95, 2.95], false, '#d7191c'); line(cols[5], 'NPHI', [0.45, -0.15], false, '#2c7bb6', '6 3'); head(cols[5], [['RHOB', '#d7191c', ['1.95', '2.95 g/cm³']], ['NPHI', '#2c7bb6', ['0.45', '−0.15 v/v'], '6 3']]);
    line(cols[6], 'PEF', [0, 10], false, '#8e44ad'); head(cols[6], [['PEF', '#8e44ad', ['0', '10 b/e']]]);
    line(cols[7], 'DT', [140, 40], false, '#111'); head(cols[7], [['DT', '#111', ['140', '40 µs/ft']]]);
    line(cols[8], 'K', [0, 5], false, '#1b7837'); line(cols[8], 'TH', [0, 25], false, '#b2182b', '5 3'); line(cols[8], 'U', [0, 20], false, '#2166ac', '2 2'); head(cols[8], [['K', '#1b7837', ['0', '5 %']], ['TH', '#b2182b', ['0', '25 ppm'], '5 3'], ['U', '#2166ac', ['0', '20 ppm'], '2 2']]);
    o.push('<text x="12" y="' + (H - 14) + '" font-size="9.5" fill="#555">Yellow: density–neutron crossover (gas, and the matrix effect of sandstone and coal). Grey: neutron left of density (shale, dolomite, anhydrite). Anhydrite and salt read near zero neutron; salt is the only rock with very low density and zero neutron. Coal reads off the scales (RHOB ≈ 1.4 g/cm³, NPHI ≈ 0.5).</text></svg>');
    $('#wType').innerHTML = o.join('');
  }
  $('#wTypePng').addEventListener('click', function () { var s = $('#wType svg'); if (s) SH.svgPng(s, 'shandal-log-response-chart.png', 2, '#fff'); });

  /* ---------------------------------------------------------------- guide */
  var gf = 'all';
  function guide() {
    var GR = WL.GUIDE.GROUPS, groups = ['all'].concat(Object.keys(GR));
    $('#wGF').innerHTML = groups.map(function (g) { return '<button type="button" data-g="' + g + '" aria-pressed="' + (g === gf) + '">' + (g === 'all' ? t('All logs', 'كل المجسات') : (AR ? GR[g][1] : GR[g][0])) + '</button>'; }).join('');
    var L2 = AR ? 1 : 0;
    $('#wGuide').innerHTML = WL.GUIDE.filter(function (g) { return gf === 'all' || g.grp === gf; }).map(function (g) {
      return '<article class="wl-g"><h4>' + (AR ? g.ar : g.en) + ' <small>' + SH.esc(g.mn) + ' · ' + SH.esc(g.u) + '</small></h4>' +
        '<div class="r"><b>' + t('Measures', 'يقيس') + '</b><span>' + g.m[L2] + '</span></div><div class="r"><b>' + t('High', 'مرتفع') + '</b><span>' + g.hi[L2] + '</span></div><div class="r"><b>' + t('Low', 'منخفض') + '</b><span>' + g.lo[L2] + '</span></div>' +
        '<div class="r"><b>' + t('Used for', 'يُستعمل في') + '</b><span>' + g.use[L2] + '</span></div><div class="r"><b>' + t('Limits', 'حدوده') + '</b><span>' + g.lim[L2] + '</span></div>' +
        (g.v.length ? '<table>' + g.v.map(function (v) { return '<tr><td>' + (AR ? v[1] : v[0]) + '</td><td class="num">' + v[2] + '</td></tr>'; }).join('') + '</table>' : '') + '</article>'; }).join('');
  }
  $('#wGF').addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (!b) return; gf = b.getAttribute('data-g'); guide(); });

  /* ---------------------------------------------------------------- reading a log from an image */
  var DG = { img: null, A: null, B: null, L: null, R: null, log: false, col: null, tol: 60, mode: '', pts: [], manual: false };
  var cv = $('#wCan'), cx = cv.getContext('2d');
  function steps() {
    var S = [['A', t('1 · First depth', '1 · العمق الأول'), t('Tap a depth line on the image, then type its depth.', 'انقر خط عمق على الصورة ثم اكتب عمقه.')], ['B', t('2 · Second depth', '2 · العمق الثاني'), t('A depth line far from the first.', 'خط عمق بعيد عن الأول.')],
      ['L', t('3 · Left edge of the track', '3 · الحافة اليسرى للمسار'), t('Tap the left edge and type its scale value.', 'انقر الحافة اليسرى واكتب قيمة المقياس عندها.')], ['R', t('4 · Right edge of the track', '4 · الحافة اليمنى للمسار'), t('Tap the right edge and type its value.', 'انقر الحافة اليمنى واكتب قيمتها.')], ['C', t('5 · Colour of the curve', '5 · لون المنحنى'), t('Tap on the curve itself.', 'انقر على المنحنى نفسه.')]];
    var val = function (k) { var o2 = DG[k]; return o2 && isFinite(o2.v) ? o2.v : ''; };
    $('#wSteps').innerHTML = S.map(function (s) { return '<div class="wl-step" data-on="' + (DG.mode === s[0]) + '"><b>' + s[1] + '</b><span class="muted">' + s[2] + '</span><div class="row"><button class="btn btn-line btn-xs" type="button" data-mk="' + s[0] + '">' + (DG[s[0] === 'C' ? 'col' : s[0]] ? '✓ ' : '') + t('Mark', 'حدّد') + '</button>' +
      (s[0] === 'C' ? (DG.col ? '<span class="sw-chip" style="background:rgb(' + DG.col.join(',') + ')"></span>' : '') + '<label class="xsmall">' + t('Tolerance', 'السماحية') + ' <input type="range" min="15" max="140" value="' + DG.tol + '" data-tol style="width:90px"></label>' : '<input type="number" step="any" class="ltr" data-v="' + s[0] + '" value="' + val(s[0]) + '" placeholder="' + (/[AB]/.test(s[0]) ? t('depth', 'العمق') : t('value', 'القيمة')) + '">' + (s[0] === 'R' ? '<select data-lg><option value="lin"' + (DG.log ? '' : ' selected') + '>' + t('linear', 'خطي') + '</option><option value="log"' + (DG.log ? ' selected' : '') + '>' + t('logarithmic', 'لوغاريتمي') + '</option></select>' : '')) + '</div></div>'; }).join('') +
      '<div class="wl-step"><b>' + t('6 · Trace and save', '6 · التتبع والحفظ') + '</b><div class="row"><button class="btn btn-gold btn-xs" type="button" id="dTrace">' + t('Trace curve', 'تتبّع المنحنى') + '</button><button class="btn btn-line btn-xs" type="button" id="dMan" aria-pressed="' + DG.manual + '">' + t('Tap points by hand', 'انقر النقاط يدوياً') + '</button><button class="btn btn-line btn-xs" type="button" id="dClr">' + t('Clear', 'امسح') + '</button></div>' +
      '<div class="row"><select id="dKind">' + KOPT.slice(1).map(function (k) { return '<option value="' + k + '">' + k + ' · ' + kname(k) + '</option>'; }).join('') + '</select><select id="dUnit"><option value="m">m</option><option value="ft">ft</option></select><button class="btn btn-ink btn-xs" type="button" id="dSave">' + t('Add to the well', 'أضف إلى البئر') + '</button></div></div>';
  }
  function paintDig() {
    if (!DG.img) return; cx.drawImage(DG.img, 0, 0); var W = cv.width, H = cv.height, lw = Math.max(1.5, W / 700);
    cx.lineWidth = lw; [['A', '#e11d48'], ['B', '#e11d48']].forEach(function (q) { var o2 = DG[q[0]]; if (!o2) return; cx.strokeStyle = q[1]; cx.setLineDash([8, 5]); cx.beginPath(); cx.moveTo(0, o2.y); cx.lineTo(W, o2.y); cx.stroke(); });
    [['L', '#2563eb'], ['R', '#2563eb']].forEach(function (q) { var o2 = DG[q[0]]; if (!o2) return; cx.strokeStyle = q[1]; cx.setLineDash([8, 5]); cx.beginPath(); cx.moveTo(o2.x, 0); cx.lineTo(o2.x, H); cx.stroke(); }); cx.setLineDash([]);
    if (DG.pts.length) { cx.strokeStyle = '#ff00d4'; cx.lineWidth = lw * 1.4; cx.beginPath(); DG.pts.forEach(function (p, k) { if (k) cx.lineTo(p[0], p[1]); else cx.moveTo(p[0], p[1]); }); cx.stroke(); }
  }
  $('#wDigBtn').addEventListener('click', function () { $('#fgDig').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#wImg').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var im = new Image(); im.onload = function () { DG = { img: im, A: null, B: null, L: null, R: null, log: false, col: null, tol: 60, mode: 'A', pts: [], manual: false, name: f.name.replace(/\.[^.]+$/, '') }; cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.style.width = Math.min(im.naturalWidth, 1400) + 'px'; $('#wCv').hidden = false; $('#wImgN').textContent = f.name + ' · ' + im.naturalWidth + ' × ' + im.naturalHeight + ' px'; steps(); paintDig(); }; im.src = URL.createObjectURL(f); this.value = ''; });
  $('#wSteps').addEventListener('click', function (e) {
    var mk = e.target.closest('[data-mk]'); if (mk) { DG.mode = mk.getAttribute('data-mk'); DG.manual = false; steps(); return; }
    if (e.target.id === 'dMan') { DG.manual = !DG.manual; DG.mode = DG.manual ? 'P' : ''; if (DG.manual) DG.pts = []; steps(); paintDig(); }
    if (e.target.id === 'dClr') { DG.pts = []; paintDig(); $('#wDigOut').textContent = ''; }
    if (e.target.id === 'dTrace') trace();
    if (e.target.id === 'dSave') saveDig();
  });
  $('#wSteps').addEventListener('input', function (e) { var v = e.target.getAttribute('data-v'); if (v) { DG[v] = DG[v] || {}; DG[v].v = parseFloat(e.target.value); } if (e.target.hasAttribute('data-tol')) DG.tol = +e.target.value; });
  $('#wSteps').addEventListener('change', function (e) { if (e.target.hasAttribute('data-lg')) DG.log = e.target.value === 'log'; });
  cv.addEventListener('click', function (e) {
    if (!DG.img) return; var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height, m = DG.mode;
    if (m === 'A' || m === 'B') { DG[m] = { y: y, v: DG[m] ? DG[m].v : NaN }; DG.mode = m === 'A' ? 'B' : 'L'; }
    else if (m === 'L' || m === 'R') { DG[m] = { x: x, v: DG[m] ? DG[m].v : NaN }; DG.mode = m === 'L' ? 'R' : 'C'; }
    else if (m === 'C') { var p = cx.getImageData(Math.round(x), Math.round(y), 1, 1).data; DG.col = [p[0], p[1], p[2]]; DG.mode = ''; }
    else if (m === 'P') { DG.pts.push([x, y]); DG.pts.sort(function (a, b) { return a[1] - b[1]; }); }
    steps(); paintDig();
  });
  function ready() { var ok = DG.A && DG.B && DG.L && DG.R && isFinite(DG.A.v) && isFinite(DG.B.v) && isFinite(DG.L.v) && isFinite(DG.R.v) && Math.abs(DG.A.y - DG.B.y) > 5 && Math.abs(DG.L.x - DG.R.x) > 5;
    if (!ok) SH.toast(t('Mark both depths and both track edges, and type their values.', 'حدّد العمقين وحافتي المسار واكتب قيمها.'), 'warn'); if (ok && DG.log && (DG.L.v <= 0 || DG.R.v <= 0)) { SH.toast(t('A logarithmic scale needs positive values.', 'المقياس اللوغاريتمي يحتاج قيماً موجبة.'), 'warn'); return false; } return ok; }
  function trace() {
    if (!DG.img || !DG.col) { SH.toast(t('Load an image and pick the colour of the curve.', 'حمّل صورة واختر لون المنحنى.'), 'warn'); return; }
    var x0 = DG.L ? Math.min(DG.L.x, DG.R ? DG.R.x : DG.L.x) : 0, x1 = DG.R ? Math.max(DG.L ? DG.L.x : 0, DG.R.x) : cv.width; x0 = Math.max(0, Math.floor(x0) + 1); x1 = Math.min(cv.width, Math.ceil(x1) - 1);
    cx.drawImage(DG.img, 0, 0); var data = cx.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, tol2 = DG.tol * DG.tol, c = DG.col, prev = null, pts = [];
    for (var y = 0; y < cv.height; y++) { var runs = [], run = null;
      for (var x = x0; x <= x1; x++) { var o = (y * W + x) * 4, d = Math.pow(data[o] - c[0], 2) + Math.pow(data[o + 1] - c[1], 2) + Math.pow(data[o + 2] - c[2], 2); if (d <= tol2) { if (run && x === run[1] + 1) run[1] = x; else { run = [x, x]; runs.push(run); } } }
      if (!runs.length) continue; var best = runs[0], bd = 1e9; runs.forEach(function (r) { var m = (r[0] + r[1]) / 2, dd = prev == null ? -(r[1] - r[0]) : Math.abs(m - prev); if (dd < bd) { bd = dd; best = r; } });
      var mx = (best[0] + best[1]) / 2; if (prev != null && Math.abs(mx - prev) > (x1 - x0) * 0.35) continue; prev = mx; pts.push([mx, y]); }
    DG.pts = pts; paintDig();
    $('#wDigOut').innerHTML = pts.length ? t('Traced ', 'تُتُبّعت ') + '<b>' + pts.length + '</b>' + t(' rows. Check the magenta line against the curve; widen or narrow the tolerance, or tap points by hand where curves cross.', ' صفاً. قارن الخط البنفسجي بالمنحنى؛ وسّع السماحية أو ضيّقها، أو انقر النقاط يدوياً حيث تتقاطع المنحنيات.') : t('Nothing of this colour inside the track: widen the tolerance or pick the colour again.', 'لا شيء بهذا اللون داخل المسار: وسّع السماحية أو اختر اللون مجدداً.');
  }
  function saveDig() {
    if (!ready() || DG.pts.length < 3) { if (DG.pts.length < 3) SH.toast(t('Trace the curve or tap at least three points.', 'تتبّع المنحنى أو انقر ثلاث نقاط على الأقل.'), 'warn'); return; }
    var dpp = (DG.B.v - DG.A.v) / (DG.B.y - DG.A.y), dep = function (y) { return DG.A.v + (y - DG.A.y) * dpp; }, fx = function (x) { var f = (x - DG.L.x) / (DG.R.x - DG.L.x); return DG.log ? Math.pow(10, Math.log10(DG.L.v) + f * (Math.log10(DG.R.v) - Math.log10(DG.L.v))) : DG.L.v + f * (DG.R.v - DG.L.v); };
    var pts = DG.pts.map(function (p) { return [dep(p[1]), fx(p[0])]; }).sort(function (a, b) { return a[0] - b[0]; }), step = Math.abs(dpp) * Math.max(1, Math.round(DG.pts.length > 50 ? 1 : 4));
    if (DG.manual || DG.pts.length < 50) { var z0 = pts[0][0], z1 = pts[pts.length - 1][0], st2 = (z1 - z0) / Math.max(50, Math.min(2000, Math.round((z1 - z0) / Math.abs(dpp)))), out = [], k = 0; for (var z = z0; z <= z1 + 1e-9; z += st2) { while (k < pts.length - 2 && pts[k + 1][0] < z) k++; var a = pts[k], b = pts[k + 1], f = (z - a[0]) / ((b[0] - a[0]) || 1); out.push([z, a[1] + f * (b[1] - a[1])]); } pts = out; step = st2; }
    var kind = $('#dKind').value, unit = $('#dUnit').value, mn = kind, u = (WL.STYLE[kind] || {}).u || '', name = t('Image: ', 'صورة: ') + DG.name;
    var accTxt = t('Read from the image ', 'المقروء من الصورة ') + '<b>' + SH.esc(DG.name) + '</b>: ' + t('one pixel = ', 'البكسل الواحد = ') + '<b class="ltr">' + SH.fmt(Math.abs(dpp), 3) + ' ' + unit + '</b>' + t(' in depth and ', ' في العمق و') + '<b class="ltr">' + (DG.log ? SH.fmt(Math.abs(Math.log10(DG.R.v / DG.L.v)) / Math.abs(DG.R.x - DG.L.x) * Math.LN10 * 100, 2) + ' %' : SH.fmt(Math.abs(DG.R.v - DG.L.v) / Math.abs(DG.R.x - DG.L.x), 3) + ' ' + u) + '</b>' + t(' in value.', ' في القيمة.');
    var ex = wells.filter(function (w) { return w.name === name; })[0];
    if (!ex) { var w = WL.makeWell(name, [{ mn: 'DEPT', u: unit, v: Float64Array.from(pts.map(function (p) { return p[0]; })) }, { mn: mn, u: u, v: Float64Array.from(pts.map(function (p) { return p[1]; })) }], unit, { src: 'image', dig: accTxt }); w.curves[0].kind = kind; add(w); }
    else { var D = ex.D, v = new Float64Array(D.length).fill(NaN), k2 = 0; for (var i = 0; i < D.length; i++) { if (D[i] < pts[0][0] || D[i] > pts[pts.length - 1][0]) continue; while (k2 < pts.length - 2 && pts[k2 + 1][0] < D[i]) k2++; var p1 = pts[k2], p2 = pts[k2 + 1], ff = (D[i] - p1[0]) / ((p2[0] - p1[0]) || 1); v[i] = p1[1] + ff * (p2[1] - p1[1]); }
      ex.curves = ex.curves.filter(function (c) { return c.kind !== kind; }); ex.curves.push({ mn: mn, u: u, kind: kind, v: v, on: true, note: '' }); ex.meta.dig = accTxt; act = wells.indexOf(ex); listWells(); curvesUI(); run(); }
    SH.toast(t('The curve was added. Trace another curve of the same image and it joins the same well.', 'أُضيف المنحنى. تتبّع منحنى آخر من الصورة نفسها فينضم إلى البئر نفسها.'), 'ok');
    DG.pts = []; DG.col = null; DG.mode = 'L'; steps(); paintDig();
  }

  /* ---------------------------------------------------------------- start */
  typeChart(); guide(); empty();
  document.addEventListener('sh:redraw', function () { if (R) xplots(); });
})();
