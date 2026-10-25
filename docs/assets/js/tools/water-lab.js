/* Hydrochemistry water lab — major-ion analyses of one or many samples: ionic balance (APHA), hydrochemical facies,
   Piper (1944), Gibbs (1970), Schoeller (1962) and Stiff (1951) diagrams, drinking-water evaluation against IQS 417 or
   WHO (2022) with the weighted arithmetic WQI (Brown et al. 1972) and CCME WQI (2001), irrigation indices (SAR, %Na, RSC,
   KR, MAR, PI) with the USSL diagram (Richards 1954) and FAO 29 salinity classes, and concrete sulfate exposure (ACI 318). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var COLS = [['id', 'ID', ''], ['lat', 'Lat', '°'], ['lon', 'Lon', '°'], ['ph', 'pH', ''], ['ec', 'EC', 'µS/cm'], ['tds', 'TDS', 'mg/L'], ['ca', 'Ca²⁺', 'mg/L'], ['mg', 'Mg²⁺', 'mg/L'], ['na', 'Na⁺', 'mg/L'], ['k', 'K⁺', 'mg/L'],
    ['hco3', 'HCO₃⁻', 'mg/L'], ['co3', 'CO₃²⁻', 'mg/L'], ['cl', 'Cl⁻', 'mg/L'], ['so4', 'SO₄²⁻', 'mg/L'], ['no3', 'NO₃⁻', 'mg/L'], ['f', 'F⁻', 'mg/L'], ['turb', t('Turbidity', 'العكارة'), 'NTU']];
  var KEYS = COLS.map(function (c) { return c[0]; });
  var EW = { ca: 20.04, mg: 12.153, na: 22.99, k: 39.098, hco3: 61.017, co3: 30.004, cl: 35.453, so4: 48.03, no3: 62.004, f: 18.998 };
  var ION = function (k) { return { ca: 'Ca²⁺', mg: 'Mg²⁺', na: 'Na⁺', k: 'K⁺', nak: 'Na⁺+K⁺', hco3: 'HCO₃⁻', co3: 'CO₃²⁻', alk: 'HCO₃⁻+CO₃²⁻', cl: 'Cl⁻', so4: 'SO₄²⁻', no3: 'NO₃⁻', f: 'F⁻' }[k] || k; };
  var chem = function (s) { return '<bdi dir="ltr">' + s + '</bdi>'; };
  /* drinking-water limits, mg/L unless stated. IQS 417 values as cited in Iraqi hydrochemical studies;
     WHO: guideline or acceptability value, with Ca, Mg and TH from the WHO International Standards (1971). */
  var STD = {
    iqs: { name: t('Iraqi Standard IQS 417, 2nd update (2009)', 'المواصفة القياسية العراقية IQS 417، التحديث الثاني (2009)'),
      lim: { ph: [6.5, 8.5], tds: 1000, th: 500, ca: 50, mg: 50, na: 200, cl: 350, so4: 400, no3: 50, f: 1.0, turb: 5 } },
    who: { name: t('WHO Guidelines for Drinking-water Quality (2022)', 'أدلة منظمة الصحة العالمية لجودة مياه الشرب (2022)'),
      lim: { ph: [6.5, 8.5], tds: 1000, th: 500, ca: 75, mg: 50, na: 200, cl: 250, so4: 250, no3: 50, f: 1.5, turb: 5 } }
  };
  var PARAM = { ph: 'pH', tds: 'TDS', th: 'TH', ca: 'Ca²⁺', mg: 'Mg²⁺', na: 'Na⁺', cl: 'Cl⁻', so4: 'SO₄²⁻', no3: 'NO₃⁻', f: 'F⁻', turb: t('Turbidity', 'العكارة') };
  var COLORS = ['#B5651D', '#1F6FB2', '#2E8B57', '#8E44AD', '#C0392B', '#D4A017', '#16A085', '#6D4C41', '#E67E22', '#34495E', '#7F8C8D', '#AD1457'];
  var rows = SH.store.get('shandal_water_rows', []), R = null, map = null, mk = null;
  var persist = SH.persist('waterlab', ['wStd', 'wUse']);

  /* ---------- input table */
  function num(v) { if (v == null) return NaN; var s = String(v).trim().replace(',', '.'); if (s === '' || /^(nd|na|-|—)$/i.test(s)) return NaN; return parseFloat(s); }
  function save() { SH.store.set('shandal_water_rows', rows); }
  function drawInput() {
    var h = '<thead><tr><th></th>' + COLS.map(function (c) { return '<th class="num">' + chem(c[1]) + (c[2] ? '<br><small class="muted">' + c[2] + '</small>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    if (!rows.length) h += '<tr><td colspan="' + (COLS.length + 1) + '" class="muted" style="padding:18px">' + t('No samples yet. Add a sample, import a CSV file, paste rows from Excel, or load the illustrative example.', 'لا توجد عينات بعد. أضف عينة، أو استورد ملف CSV، أو الصق صفوفاً من Excel، أو حمّل المثال التوضيحي.') + '</td></tr>';
    rows.forEach(function (r, i) {
      h += '<tr><td><button class="btn btn-line btn-xs" data-del="' + i + '" type="button" aria-label="' + t('Delete', 'حذف') + '">×</button></td>' + KEYS.map(function (k) { var v = r[k] == null ? '' : r[k]; return '<td><input data-r="' + i + '" data-k="' + k + '" value="' + SH.esc(v) + '"' + (k === 'id' ? ' style="min-width:90px"' : '') + ' inputmode="' + (k === 'id' ? 'text' : 'decimal') + '"></td>'; }).join('') + '</tr>';
    });
    $('#wIn').innerHTML = h + '</tbody>';
  }
  $('#wIn').addEventListener('input', function (e) { var i = e.target.getAttribute('data-r'), k = e.target.getAttribute('data-k'); if (i == null) return; rows[+i][k] = e.target.value; save(); });
  $('#wIn').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; rows.splice(+b.getAttribute('data-del'), 1); save(); drawInput(); });
  $('#wAdd').addEventListener('click', function () { var o = { id: 'W' + (rows.length + 1) }; rows.push(o); save(); drawInput(); var ins = SH.$$('#wIn input[data-r="' + (rows.length - 1) + '"]'); if (ins[3]) ins[3].focus(); });
  $('#wClear').addEventListener('click', function () { if (!rows.length) return; rows = []; save(); drawInput(); $('#wOut').hidden = true; $('#wEmpty').hidden = false; });

  var ALIAS = { id: /^(id|sample|no|name|well|station|العينة|رقم)/, lat: /^(lat|latitude|y)$/, lon: /^(lon|lng|long|longitude|x)$/, ph: /^ph$/, ec: /^(ec|cond|conductivity)/, tds: /^tds/, ca: /^(ca|calcium)/, mg: /^(mg|magnesium)$/,
    na: /^(na|sodium)$/, k: /^(k|potassium)$/, hco3: /^(hco3|bicarbonate|alk)/, co3: /^(co3|carbonate)$/, cl: /^(cl|chloride)$/, so4: /^(so4|sulphate|sulfate)$/, no3: /^(no3|nitrate)$/, f: /^(f|fluoride)$/, turb: /^(turb|ntu)/ };
  function parse(text) {
    var lines = String(text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean); if (!lines.length) return 0;
    var sep = /\t/.test(lines[0]) ? '\t' : /;/.test(lines[0]) && !/,/.test(lines[0]) ? ';' : ',';
    var cells = lines.map(function (l) { return l.split(sep).map(function (c) { return c.trim().replace(/^"|"$/g, ''); }); });
    var map2 = KEYS.slice(), head = cells[0], isHead = head.some(function (c, i) { return i > 0 && c && isNaN(num(c)); });
    if (isHead) { map2 = head.map(function (c) { var n = c.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '').replace(/(mgl|mg|uscm|ntu|meql)$/, function (m) { return m === 'mg' ? 'mg' : ''; }); for (var k in ALIAS) if (ALIAS[k].test(n)) return k; return null; }); cells.shift(); }
    var n0 = rows.length;
    cells.forEach(function (c) { var o = {}; c.forEach(function (v, i) { var k = map2[i]; if (k) o[k] = v; }); if (!o.id) o.id = 'W' + (rows.length + 1); rows.push(o); });
    save(); drawInput(); return rows.length - n0;
  }
  $('#wFileBtn').addEventListener('click', function () { $('#wFile').click(); });
  $('#wFile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { var n = parse(r.result); SH.toast(n + t(' samples added.', ' عينة أضيفت.'), n ? 'ok' : 'warn'); }; r.readAsText(f); this.value = ''; });
  $('#wPasteGo').addEventListener('click', function () { var n = parse($('#wPaste').value); if (n) $('#wPaste').value = ''; SH.toast(n + t(' samples added.', ' عينة أضيفت.'), n ? 'ok' : 'warn'); });
  $('#wTpl').addEventListener('click', function () { SH.csv('shandal-water-template.csv', [KEYS.map(function (k) { return { id: 'ID', lat: 'Lat', lon: 'Lon', ph: 'pH', ec: 'EC_uScm', tds: 'TDS', ca: 'Ca', mg: 'Mg', na: 'Na', k: 'K', hco3: 'HCO3', co3: 'CO3', cl: 'Cl', so4: 'SO4', no3: 'NO3', f: 'F', turb: 'Turbidity_NTU' }[k]; })]); });

  /* ---------- calculations */
  function calc(r) {
    var v = {}; KEYS.forEach(function (k) { v[k] = k === 'id' ? String(r.id || '') : num(r[k]); });
    var m = {}; for (var k in EW) m[k] = isNaN(v[k]) ? 0 : v[k] / EW[k];
    var cat = m.ca + m.mg + m.na + m.k, an = m.hco3 + m.co3 + m.cl + m.so4 + m.no3 + m.f, cbe = cat + an > 0 ? 100 * (cat - an) / (cat + an) : NaN;
    var th = !isNaN(v.ca) || !isNaN(v.mg) ? 2.497 * (v.ca || 0) + 4.118 * (v.mg || 0) : NaN;
    var sumIons = ['ca', 'mg', 'na', 'k', 'cl', 'so4', 'no3', 'f', 'co3'].reduce(function (s, k) { return s + (isNaN(v[k]) ? 0 : v[k]); }, 0) + (isNaN(v.hco3) ? 0 : 0.4917 * v.hco3);
    var tds = !isNaN(v.tds) ? v.tds : sumIons > 0 ? sumIons : !isNaN(v.ec) ? 0.64 * v.ec : NaN, tdsEst = isNaN(v.tds);
    var ec = !isNaN(v.ec) ? v.ec : !isNaN(tds) ? tds / 0.64 : NaN;
    var cS = cat || 1, aS = (m.hco3 + m.co3 + m.cl + m.so4) || 1;
    var pc = { ca: 100 * m.ca / cS, mg: 100 * m.mg / cS, nak: 100 * (m.na + m.k) / cS }, pa = { alk: 100 * (m.hco3 + m.co3) / aS, cl: 100 * m.cl / aS, so4: 100 * m.so4 / aS };
    var dom = function (o) { var ks = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }), sel = ks.filter(function (k) { return o[k] >= 30; }); return (sel.length ? sel : [ks[0]]).map(ION).join('–'); };
    var P = pc.nak / 100, Q = (pa.cl + pa.so4) / 100;
    var field = P < 0.5 && Q < 0.5 ? ['I', t('Ca–Mg–HCO₃ (temporary hardness)', 'Ca–Mg–HCO₃ (عسرة مؤقتة)')] : P >= 0.5 && Q >= 0.5 ? ['III', t('Na–Cl (saline)', 'Na–Cl (مالحة)')] : P < 0.5 ? ['II', t('Ca–Mg–Cl–SO₄ (permanent hardness)', 'Ca–Mg–Cl–SO₄ (عسرة دائمة)')] : ['IV', t('Na–HCO₃ (alkali carbonate)', 'Na–HCO₃ (قلوية كربوناتية)')];
    var gC = m.na + m.ca > 0 ? m.na / (m.na + m.ca) : NaN, gA = m.cl + m.hco3 > 0 ? m.cl / (m.cl + m.hco3) : NaN, lt = Math.log10(tds);
    var gib = function (x) { return isNaN(x) || isNaN(lt) ? null : lt < 1.6 ? 'p' : lt > 2.9 && x > 0.45 ? 'e' : 'r'; };
    var sar = m.ca + m.mg > 0 ? m.na / Math.sqrt((m.ca + m.mg) / 2) : NaN, pna = cat > 0 ? 100 * (m.na + m.k) / cat : NaN, rsc = (m.hco3 + m.co3) - (m.ca + m.mg),
      kr = m.ca + m.mg > 0 ? m.na / (m.ca + m.mg) : NaN, mar = m.ca + m.mg > 0 ? 100 * m.mg / (m.ca + m.mg) : NaN, pi = m.ca + m.mg + m.na > 0 ? 100 * (m.na + Math.sqrt(m.hco3)) / (m.ca + m.mg + m.na) : NaN;
    var lec = Math.log10(ec), cCls = isNaN(ec) ? '—' : ec < 250 ? 'C1' : ec < 750 ? 'C2' : ec < 2250 ? 'C3' : 'C4';
    var sCls = isNaN(sar) || isNaN(ec) ? '—' : sar < 18.87 - 4.44 * lec ? 'S1' : sar < 31.31 - 6.66 * lec ? 'S2' : sar < 43.75 - 8.87 * lec ? 'S3' : 'S4';
    return { id: v.id || '—', v: v, m: m, cat: cat, an: an, cbe: cbe, th: th, tds: tds, tdsEst: tdsEst, ec: ec, pc: pc, pa: pa, cf: dom(pc), af: dom(pa), P: P, Q: Q, field: field,
      gC: gC, gA: gA, gibC: gib(gC), gibA: gib(gA), sar: sar, pna: pna, rsc: rsc, kr: kr, mar: mar, pi: pi, ussl: cCls + '-' + sCls, cCls: cCls, sCls: sCls,
      lat: v.lat, lon: v.lon };
  }
  function drinkVal(s, k) { return k === 'th' ? s.th : k === 'tds' ? s.tds : s.v[k]; }
  function exceeds(k, val, lim) { if (isNaN(val) || lim == null) return null; if (Array.isArray(lim)) return val < lim[0] || val > lim[1]; return val > lim; }
  /* weighted arithmetic WQI (Brown et al. 1972): q = 100 (V − Vi)/(S − Vi), Vi = 7 for pH and 0 otherwise; W ∝ 1/S */
  function wqi(s, lim) {
    var sw = 0, sq = 0, n = 0;
    Object.keys(lim).forEach(function (k) { var val = drinkVal(s, k); if (isNaN(val)) return; var S = Array.isArray(lim[k]) ? lim[k][1] : lim[k], Vi = k === 'ph' ? 7 : 0, q = 100 * (val - Vi) / (S - Vi); if (k === 'ph') q = Math.abs(q); var w = 1 / S; sw += w; sq += w * q; n++; });
    return n >= 3 ? sq / sw : NaN;
  }
  var WQIC = [[25, t('Excellent', 'ممتازة'), 'ok'], [50, t('Good', 'جيدة'), 'ok'], [75, t('Poor', 'رديئة'), 'warn'], [100, t('Very poor', 'رديئة جداً'), 'bad'], [Infinity, t('Unsuitable for drinking', 'غير صالحة للشرب'), 'bad']];
  var wqiC = function (x) { if (isNaN(x)) return ['—', t('n/a', 'غير متاح'), '']; for (var i = 0; i < WQIC.length; i++) if (x <= WQIC[i][0]) return [x, WQIC[i][1], WQIC[i][2]]; };
  /* CCME WQI across all samples (one water body or aquifer) */
  function ccme(S, lim) {
    var vars = Object.keys(lim), failV = {}, tests = 0, failT = 0, exc = 0, used = {};
    S.forEach(function (s) { vars.forEach(function (k) { var val = drinkVal(s, k), L0 = lim[k]; if (isNaN(val)) return; tests++; used[k] = 1;
      var e = Array.isArray(L0) ? (val > L0[1] ? val / L0[1] - 1 : val < L0[0] ? L0[0] / val - 1 : 0) : (val > L0 ? val / L0 - 1 : 0);
      if (e > 0) { failT++; failV[k] = 1; exc += e; } }); });
    var nv = Object.keys(used).length; if (nv < 4 || S.length < 2) return null;
    var F1 = 100 * Object.keys(failV).length / nv, F2 = 100 * failT / tests, nse = exc / tests, F3 = nse / (0.01 * nse + 0.01), q = 100 - Math.sqrt(F1 * F1 + F2 * F2 + F3 * F3) / 1.732;
    var cls = q >= 95 ? t('Excellent', 'ممتازة') : q >= 80 ? t('Good', 'جيدة') : q >= 65 ? t('Fair', 'مقبولة') : q >= 45 ? t('Marginal', 'هامشية') : t('Poor', 'رديئة');
    return { q: Math.max(0, q), F1: F1, F2: F2, F3: F3, cls: cls, nv: nv, tests: tests };
  }
  var thCls = function (x) { return isNaN(x) ? '—' : x < 75 ? t('soft', 'يسرة') : x < 150 ? t('moderately hard', 'متوسطة العسرة') : x < 300 ? t('hard', 'عسرة') : t('very hard', 'عسرة جداً'); };
  var pnaCls = function (x) { return isNaN(x) ? '—' : x < 20 ? t('excellent', 'ممتازة') : x < 40 ? t('good', 'جيدة') : x < 60 ? t('permissible', 'مسموحة') : x < 80 ? t('doubtful', 'مشكوك فيها') : t('unsuitable', 'غير صالحة'); };
  var rscCls = function (x) { return isNaN(x) ? '—' : x < 1.25 ? t('safe', 'آمنة') : x <= 2.5 ? t('marginal', 'هامشية') : t('unsuitable', 'غير صالحة'); };
  var faoCls = function (ec) { var d = ec / 1000; return isNaN(d) ? '—' : d < 0.7 ? t('none', 'لا قيد') : d <= 3 ? t('slight to moderate', 'قيد طفيف إلى متوسط') : t('severe', 'قيد شديد'); };
  var aci = function (so4) { return isNaN(so4) ? '—' : so4 < 150 ? 'S0' : so4 < 1500 ? 'S1' : so4 < 10000 ? 'S2' : 'S3'; };

  function run() {
    var S = rows.map(calc).filter(function (s) { return s.cat > 0 || s.an > 0; });
    if (!S.length) { SH.toast(t('Enter at least one sample with major ions.', 'أدخل عينة واحدة على الأقل بالأيونات الرئيسية.'), 'warn'); return; }
    persist.save(); var std = STD[SH.val('wStd')] || STD.iqs; S.forEach(function (s, i) { s.col = COLORS[i % COLORS.length]; s.wqi = wqi(s, std.lim); });
    R = { S: S, std: std, ccme: ccme(S, std.lim) };
    $('#wEmpty').hidden = true; $('#wOut').hidden = false;
    kpis(); qc(); piper(); gibbs(); schoeller(); stiff(); drink(); ussl(); irr(); narrative(); drawMap();
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function mode(a) { var c = {}; a.forEach(function (x) { c[x] = (c[x] || 0) + 1; }); return Object.keys(c).sort(function (x, y) { return c[y] - c[x]; })[0]; }
  function kpis() {
    var S = R.S, ok = S.filter(function (s) { return Math.abs(s.cbe) <= 5; }).length, w = S.map(function (s) { return s.wqi; }).filter(isFinite), mw = w.length ? w.reduce(function (a, b) { return a + b; }, 0) / w.length : NaN, wc = wqiC(mw);
    var tdsA = S.map(function (s) { return s.tds; }).filter(isFinite);
    $('#wKpis').innerHTML = kpi('info', t('Samples', 'العينات'), S.length, t('analysed', 'محللة')) +
      kpi(ok === S.length ? 'ok' : 'warn', t('Ionic balance within ±5 %', 'التوازن الأيوني ضمن ±5 %'), ok + ' / ' + S.length, t('APHA acceptance', 'معيار القبول APHA')) +
      kpi('', t('TDS range', 'مدى الأملاح الذائبة'), tdsA.length ? SH.ltr(SH.fmt(Math.min.apply(null, tdsA), 0) + '–' + SH.fmt(Math.max.apply(null, tdsA), 0)) + '<small> mg/L</small>' : '—', '') +
      kpi(wc[2], t('Mean WQI (drinking)', 'متوسط مؤشر جودة المياه (الشرب)'), isFinite(mw) ? SH.fmt(mw, 1) : '—', wc[1]) +
      kpi('', t('Dominant water type', 'نوع المياه السائد'), chem(mode(S.map(function (s) { return s.cf + ' · ' + s.af; }))), t('by meq/L > 30 %', 'بالملي مكافئ > 30 %')) +
      kpi('', t('Most common USSL class', 'فئة USSL الأكثر شيوعاً'), mode(S.map(function (s) { return s.ussl; })), t('irrigation', 'الري'));
  }
  function qc() {
    var h = '<thead><tr><th>No.</th><th>ID</th><th class="num">Σ ' + t('cations', 'الكاتيونات') + '<br><small>meq/L</small></th><th class="num">Σ ' + t('anions', 'الأنيونات') + '<br><small>meq/L</small></th><th class="num">CBE %</th><th class="num">TDS/EC</th><th>' + t('Status', 'الحالة') + '</th></tr></thead><tbody>';
    R.S.forEach(function (s, i) { var a = Math.abs(s.cbe), st = a <= 5 ? ['ok', t('accepted', 'مقبولة')] : a <= 10 ? ['warn', t('use with caution', 'تُستخدم بحذر')] : ['bad', t('rejected: re-check the analysis', 'مرفوضة: أعد فحص التحليل')], r = !isNaN(s.v.tds) && !isNaN(s.v.ec) ? s.v.tds / s.v.ec : NaN;
      h += '<tr><td class="num">' + (i + 1) + '</td><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + s.col + ';margin-inline-end:6px"></span>' + SH.esc(s.id) + '</td><td class="num">' + SH.fmt(s.cat, 2) + '</td><td class="num">' + SH.fmt(s.an, 2) + '</td><td class="num">' + SH.fmt(s.cbe, 1) + '</td><td class="num">' + (isNaN(r) ? '—' : SH.fmt(r, 2) + (r < 0.55 || r > 0.75 ? ' ⚠' : '')) + '</td><td><span class="pill ' + st[0] + '">' + st[1] + '</span></td></tr>'; });
    $('#wQc').innerHTML = h + '</tbody>';
    $('#wQcNote').innerHTML = t('CBE = (Σcations − Σanions) / (Σcations + Σanions) × 100. Analyses within ±5 % are accepted (APHA 2017); larger errors point to a missing ion or an analytical error. TDS/EC is normally 0.55–0.75 for natural waters.', 'CBE = (Σالكاتيونات − Σالأنيونات) / (Σالكاتيونات + Σالأنيونات) × 100. تُقبل التحاليل ضمن ±5 % (APHA 2017)، والخطأ الأكبر يدل على أيون مفقود أو خطأ تحليلي. وتكون نسبة TDS/EC عادة بين 0.55 و0.75 في المياه الطبيعية.');
  }

  /* ---------- Piper */
  function piper() {
    var S = SH.svgB($('#wPiper')), s = 240, g = 24, h = s * Math.sqrt(3) / 2, ox1 = 40, ox2 = ox1 + s + g, y0 = 560, ink = '#1B232B', mut = '#55616B';
    $('#wPiper').setAttribute('direction', 'ltr');
    var tri = function (ox, a, b, c) { var T = a + b + c || 1; a /= T; b /= T; c /= T; return [ox + b * s / 2 + c * s, y0 - b * h]; };
    var B = [ox1 + s + g / 2, y0 - g * Math.sqrt(3) / 2], Lv = [B[0] - s / 2, B[1] - h], Tv = [B[0], B[1] - 2 * h];
    var dia = function (p, q) { return [Lv[0] + p * (B[0] - Lv[0]) + q * (Tv[0] - Lv[0]), Lv[1] + p * (B[1] - Lv[1]) + q * (Tv[1] - Lv[1])]; };
    S.add('rect', { x: 0, y: 0, width: 640, height: 600, fill: '#fff' });
    [ox1, ox2].forEach(function (ox) {
      S.poly([[ox, y0], [ox + s, y0], [ox + s / 2, y0 - h]], { fill: '#FAF8F3', stroke: ink, 'stroke-width': 1.2 });
      for (var k = 1; k < 5; k++) { var q = k * 20; [[[q, 100 - q, 0], [q, 0, 100 - q]], [[0, q, 100 - q], [100 - q, q, 0]], [[100 - q, 0, q], [0, 100 - q, q]]].forEach(function (pq) { var a = tri(ox, pq[0][0], pq[0][1], pq[0][2]), b = tri(ox, pq[1][0], pq[1][1], pq[1][2]); S.line(a[0], a[1], b[0], b[1], { stroke: '#C9C3B6', 'stroke-width': .6 }); }); }
    });
    S.poly([dia(0, 0), dia(1, 0), dia(1, 1), dia(0, 1)], { fill: '#FAF8F3', stroke: ink, 'stroke-width': 1.2 });
    for (var k = 1; k < 5; k++) { var a = dia(k / 5, 0), b = dia(k / 5, 1), c = dia(0, k / 5), d = dia(1, k / 5); S.line(a[0], a[1], b[0], b[1], { stroke: '#C9C3B6', 'stroke-width': .6 }); S.line(c[0], c[1], d[0], d[1], { stroke: '#C9C3B6', 'stroke-width': .6 }); }
    var m1 = dia(.5, 0), m2 = dia(.5, 1), m3 = dia(0, .5), m4 = dia(1, .5); S.line(m1[0], m1[1], m2[0], m2[1], { stroke: ink, 'stroke-width': .8, 'stroke-dasharray': '4 3' }); S.line(m3[0], m3[1], m4[0], m4[1], { stroke: ink, 'stroke-width': .8, 'stroke-dasharray': '4 3' });
    [['I', .2, .2], ['II', .2, .8], ['III', .8, .8], ['IV', .8, .2]].forEach(function (f) { var p = dia(f[1], f[2]); S.text(p[0], p[1] + 5, f[0], { 'font-size': 15, 'font-weight': 800, fill: '#B9AE98', 'text-anchor': 'middle' }); });
    var lab = function (x, y, s2, a) { S.text(x, y, s2, Object.assign({ 'font-size': 12, fill: ink, 'font-weight': 700, 'text-anchor': 'middle' }, a || {})); };
    lab(ox1 - 4, y0 + 18, 'Ca²⁺', { 'text-anchor': 'start' }); lab(ox1 + s + 2, y0 + 18, 'Na⁺+K⁺', { 'text-anchor': 'end' }); lab(ox1 + s / 2, y0 - h - 8, 'Mg²⁺');
    lab(ox2 - 2, y0 + 18, 'HCO₃⁻+CO₃²⁻', { 'text-anchor': 'start' }); lab(ox2 + s + 4, y0 + 18, 'Cl⁻', { 'text-anchor': 'end' }); lab(ox2 + s / 2, y0 - h - 8, 'SO₄²⁻');
    lab(ox1 + s / 2, y0 + 38, t('Cations (% meq/L)', 'الكاتيونات (% ملي مكافئ)'), { 'font-weight': 400, fill: mut }); lab(ox2 + s / 2, y0 + 38, t('Anions (% meq/L)', 'الأنيونات (% ملي مكافئ)'), { 'font-weight': 400, fill: mut });
    var t1 = dia(0, .5), t2 = dia(.5, 1); lab(t1[0] - 46, t1[1] - 50, 'SO₄²⁻+Cl⁻', { transform: 'rotate(-60 ' + (t1[0] - 46) + ' ' + (t1[1] - 50) + ')', 'font-weight': 400 }); lab(t2[0] + 46, t2[1] + 50, 'Ca²⁺+Mg²⁺', { transform: 'rotate(60 ' + (t2[0] + 46) + ' ' + (t2[1] + 50) + ')', 'font-weight': 400 });
    R.S.forEach(function (sp) {
      var c = tri(ox1, sp.pc.ca, sp.pc.mg, sp.pc.nak), a = tri(ox2, sp.pa.alk, sp.pa.so4, sp.pa.cl), d = dia(sp.P, sp.Q), st = { fill: sp.col, stroke: '#fff', 'stroke-width': 1.2 };
      S.circle(c[0], c[1], 5.5, st); S.circle(a[0], a[1], 5.5, st); S.circle(d[0], d[1], 6.5, st);
    });
    var ly = 22; R.S.slice(0, 12).forEach(function (sp) { S.circle(470, ly, 5, { fill: sp.col }); S.text(482, ly + 4, sp.id, { 'font-size': 11.5, fill: ink }); ly += 18; });
    var cnt = {}; R.S.forEach(function (sp) { cnt[sp.field[0]] = (cnt[sp.field[0]] || 0) + 1; });
    $('#wPiperCap').innerHTML = t('Diamond fields (Piper 1944): ', 'حقول المعين (Piper 1944): ') + [['I', 'Ca–Mg–HCO₃'], ['II', 'Ca–Mg–Cl–SO₄'], ['III', 'Na–Cl'], ['IV', 'Na–HCO₃']].map(function (f) { return '<b>' + f[0] + '</b> ' + chem(f[1]); }).join(' · ') + '<br>' + t('Samples per field: ', 'عدد العينات في كل حقل: ') + Object.keys(cnt).sort().map(function (k) { return '<b>' + k + '</b>: ' + cnt[k]; }).join(' · ');
  }
  /* ---------- Gibbs */
  function gibbs() {
    var tt = [], xl = [], xr = []; for (var q = 0; q <= 46; q++) { var lt = q / 10; tt.push(Math.pow(10, lt)); xl.push(Math.max(0.01, 0.42 + 0.22 * lt / 4.6 - 0.44 * Math.exp(-Math.pow((lt - 2.1) / 0.85, 2)))); xr.push(Math.min(0.99, 1 - 0.38 * Math.exp(-Math.pow((lt - 2.2) / 0.75, 2)))); }
    var env = function (ax) { return { x: xl.concat(xr.slice().reverse()), y: tt.concat(tt.slice().reverse()), xaxis: ax, yaxis: 'y', fill: 'toself', fillcolor: 'rgba(181,101,29,.08)', line: { color: 'rgba(120,90,50,.55)', width: 1.2 }, hoverinfo: 'skip', showlegend: false }; };
    var tr = [env('x'), env('x2')];
    R.S.forEach(function (s) { tr.push({ x: [s.gC], y: [s.tds], xaxis: 'x', yaxis: 'y', mode: 'markers', marker: { size: 11, color: s.col, line: { color: '#fff', width: 1 } }, name: s.id, legendgroup: s.id, hovertemplate: s.id + '<br>Na/(Na+Ca) %{x:.2f}<br>TDS %{y:.0f} mg/L<extra></extra>' });
      tr.push({ x: [s.gA], y: [s.tds], xaxis: 'x2', yaxis: 'y', mode: 'markers', marker: { size: 11, color: s.col, symbol: 'diamond', line: { color: '#fff', width: 1 } }, name: s.id, legendgroup: s.id, showlegend: false, hovertemplate: s.id + '<br>Cl/(Cl+HCO₃) %{x:.2f}<br>TDS %{y:.0f} mg/L<extra></extra>' }); });
    var p = SH.palette(), an = function (ax, x, y, s2) { return { xref: ax, yref: 'y', x: x, y: Math.log10(y), text: s2, showarrow: false, font: { size: 10.5, color: p.text2 } }; };
    SH.plot('wGibbs', tr, function () { return SH.plotLayout({ margin: { l: 62, r: 14, t: 16, b: 52 }, showlegend: true, legend: { orientation: 'h', y: -0.22 },
      xaxis: { domain: [0, .47], range: [0, 1], title: { text: 'Na⁺/(Na⁺+Ca²⁺)' } }, xaxis2: { domain: [.53, 1], range: [0, 1], title: { text: 'Cl⁻/(Cl⁻+HCO₃⁻)' } },
      yaxis: { type: 'log', range: [0, 4.7], title: { text: 'TDS (mg/L)' } },
      annotations: [an('x', .78, 4, t('Precipitation', 'الأمطار')), an('x', .3, 180, t('Rock weathering', 'تجوية الصخور')), an('x', .78, 9000, t('Evaporation', 'التبخر')), an('x2', .78, 4, t('Precipitation', 'الأمطار')), an('x2', .3, 180, t('Rock weathering', 'تجوية الصخور')), an('x2', .78, 9000, t('Evaporation', 'التبخر'))] }); }, { filename: 'shandal-gibbs' });
    var c = { p: 0, r: 0, e: 0 }; R.S.forEach(function (s) { if (s.gibA) c[s.gibA]++; });
    $('#wGibbsCap').innerHTML = t('Envelopes drawn after Gibbs (1970); they are approximate, so samples near a boundary are transitional. By the anion ratio: ', 'الأغلفة مرسومة بحسب Gibbs (1970) وهي تقريبية، فالعينات القريبة من الحدود انتقالية. بحسب نسبة الأنيونات: ') +
      t('evaporation ', 'التبخر ') + c.e + ' · ' + t('rock weathering ', 'تجوية الصخور ') + c.r + ' · ' + t('precipitation ', 'الأمطار ') + c.p;
  }
  /* ---------- Schoeller */
  function schoeller() {
    var X = ['Ca²⁺', 'Mg²⁺', 'Na⁺+K⁺', 'Cl⁻', 'SO₄²⁻', 'HCO₃⁻'];
    SH.plot('wSch', R.S.map(function (s) { return { x: X, y: [s.m.ca, s.m.mg, s.m.na + s.m.k, s.m.cl, s.m.so4, s.m.hco3 + s.m.co3].map(function (v) { return v > 0 ? v : null; }), mode: 'lines+markers', name: s.id, line: { color: s.col, width: 2 }, marker: { size: 7 }, hovertemplate: '%{x}: %{y:.2f} meq/L<extra>' + SH.esc(s.id) + '</extra>' }; }),
      function () { return SH.plotLayout({ margin: { l: 60, r: 14, t: 14, b: 44 }, yaxis: { type: 'log', title: { text: 'meq/L' } }, legend: { orientation: 'h', y: -0.2 } }); }, { filename: 'shandal-schoeller' });
  }
  /* ---------- Stiff */
  function stiff() {
    var S = SH.svgB($('#wStiff')), list = R.S.slice(0, 8), cols = list.length > 4 ? 2 : 1, rowsN = Math.ceil(list.length / cols), W = 640 / cols, Hh = Math.max(84, Math.min(150, 360 / rowsN)), ink = '#1B232B';
    $('#wStiff').setAttribute('viewBox', '0 0 640 ' + (rowsN * Hh + 26)); $('#wStiff').setAttribute('direction', 'ltr');
    S.add('rect', { x: 0, y: 0, width: 640, height: rowsN * Hh + 26, fill: '#fff' });
    var mx = 0; list.forEach(function (s) { mx = Math.max(mx, s.m.na + s.m.k, s.m.ca, s.m.mg, s.m.cl, s.m.hco3 + s.m.co3, s.m.so4); });
    var nice = [1, 2, 5, 10, 20, 50, 100, 200, 500]; for (var q = 0; q < nice.length; q++) if (nice[q] >= mx) { mx = nice[q]; break; }
    list.forEach(function (s, i) {
      var cx = (i % cols) * W + W / 2, top = Math.floor(i / cols) * Hh + 18, hw = W / 2 - 46, dy = (Hh - 34) / 2, sc = hw / mx, ys = [top + 4, top + 4 + dy, top + 4 + 2 * dy];
      var cv = [s.m.na + s.m.k, s.m.ca, s.m.mg], avv = [s.m.cl, s.m.hco3 + s.m.co3, s.m.so4];
      S.line(cx, top - 2, cx, ys[2] + 4, { stroke: ink, 'stroke-width': 1 });
      ys.forEach(function (y) { S.line(cx - hw, y, cx + hw, y, { stroke: '#E2DDD2', 'stroke-width': .7 }); });
      S.poly([[cx - cv[0] * sc, ys[0]], [cx - cv[1] * sc, ys[1]], [cx - cv[2] * sc, ys[2]], [cx + avv[2] * sc, ys[2]], [cx + avv[1] * sc, ys[1]], [cx + avv[0] * sc, ys[0]]], { fill: SH.alpha(s.col, .35), stroke: s.col, 'stroke-width': 1.6 });
      ['Na⁺+K⁺', 'Ca²⁺', 'Mg²⁺'].forEach(function (l, k) { S.text(cx - hw - 4, ys[k] + 4, l, { 'font-size': 10, fill: ink, 'text-anchor': 'end' }); });
      ['Cl⁻', 'HCO₃⁻', 'SO₄²⁻'].forEach(function (l, k) { S.text(cx + hw + 4, ys[k] + 4, l, { 'font-size': 10, fill: ink }); });
      S.text(cx, top - 6, s.id, { 'font-size': 11.5, 'font-weight': 800, fill: s.col, 'text-anchor': 'middle' });
    });
    S.text(320, rowsN * Hh + 18, t('Scale: half-width = ', 'المقياس: نصف العرض = ') + mx + ' meq/L', { 'font-size': 10.5, fill: '#55616B', 'text-anchor': 'middle' });
  }
  /* ---------- drinking */
  function drink() {
    var lim = R.std.lim, ks = Object.keys(lim).filter(function (k) { return R.S.some(function (s) { return !isNaN(drinkVal(s, k)); }); });
    var h = '<thead><tr><th>ID</th>' + ks.map(function (k) { var L0 = lim[k]; return '<th class="num">' + chem(PARAM[k]) + '<br><small class="muted">' + (Array.isArray(L0) ? L0[0] + '–' + L0[1] : '≤ ' + L0) + '</small></th>'; }).join('') + '<th class="num">WQI</th><th>' + t('Class', 'الفئة') + '</th><th>' + t('Hardness', 'العسرة') + '</th></tr></thead><tbody>';
    R.S.forEach(function (s) { var w = wqiC(s.wqi);
      h += '<tr><td>' + SH.esc(s.id) + '</td>' + ks.map(function (k) { var val = drinkVal(s, k), ex = exceeds(k, val, lim[k]); return '<td class="num"' + (ex ? ' style="color:var(--danger);font-weight:800"' : '') + '>' + (isNaN(val) ? '—' : SH.fmt(val, k === 'ph' || k === 'f' ? 2 : k === 'turb' ? 1 : 0) + (ex ? ' ▲' : '')) + '</td>'; }).join('') +
        '<td class="num">' + (isFinite(s.wqi) ? SH.fmt(s.wqi, 1) : '—') + '</td><td><span class="pill ' + w[2] + '">' + w[1] + '</span></td><td>' + thCls(s.th) + '</td></tr>'; });
    $('#wDrink').innerHTML = h + '</tbody>';
    $('#wStdName').textContent = R.std.name;
    var c = R.ccme;
    $('#wDrinkNote').innerHTML = t('▲ exceeds the limit. WQI = Σ qᵢWᵢ / ΣWᵢ with qᵢ = 100 (Vᵢ − V₀)/(Sᵢ − V₀) and Wᵢ ∝ 1/Sᵢ (Brown et al. 1972); classes 0–25 excellent, 26–50 good, 51–75 poor, 76–100 very poor, > 100 unsuitable. ', '▲ يتجاوز الحد. WQI = Σ qᵢWᵢ / ΣWᵢ حيث qᵢ = 100 (Vᵢ − V₀)/(Sᵢ − V₀) وWᵢ ∝ 1/Sᵢ (Brown et al. 1972)؛ الفئات: 0–25 ممتازة، 26–50 جيدة، 51–75 رديئة، 76–100 رديئة جداً، أكثر من 100 غير صالحة. ') +
      (c ? '<br>' + t('CCME WQI for all samples together: ', 'مؤشر CCME لجميع العينات معاً: ') + '<b>' + SH.fmt(c.q, 1) + '</b> (' + c.cls + ') · F1 ' + SH.fmt(c.F1, 0) + ' · F2 ' + SH.fmt(c.F2, 0) + ' · F3 ' + SH.fmt(c.F3, 0) + ' · ' + c.nv + t(' variables, ', ' متغيرات، ') + c.tests + t(' tests.', ' فحصاً.') : '') +
      (SH.val('wStd') === 'iqs' ? '<br>' + t('IQS 417 limits as cited in Iraqi hydrochemical studies; check them against the official copy of the standard before an official report.', 'حدود IQS 417 كما تُذكر في الدراسات الهيدروكيميائية العراقية؛ طابقها مع النسخة الرسمية للمواصفة قبل أي تقرير رسمي.') : '<br>' + t('WHO sets no health-based value for TDS, hardness, Ca or Mg; the limits shown are acceptability values, with Ca, Mg and hardness from the WHO International Standards (1971).', 'لا تضع منظمة الصحة العالمية قيمة صحية لـ TDS والعسرة والكالسيوم والمغنيسيوم؛ الحدود المعروضة قيم قبول، والكالسيوم والمغنيسيوم والعسرة من المعايير الدولية للمنظمة (1971).'));
  }
  /* ---------- irrigation */
  function ussl() {
    var xs = []; for (var q = 0; q <= 60; q++) xs.push(Math.pow(10, 2 + q * 2 / 60));
    var line = function (a, b) { return xs.map(function (x) { return Math.max(0, a - b * Math.log10(x)); }); }, p = SH.palette();
    var tr = [[18.87, 4.44], [31.31, 6.66], [43.75, 8.87]].map(function (ab) { return { x: xs, y: line(ab[0], ab[1]), mode: 'lines', line: { color: p.text2, width: 1.1 }, hoverinfo: 'skip', showlegend: false }; });
    R.S.forEach(function (s) { if (isNaN(s.ec) || isNaN(s.sar)) return; tr.push({ x: [s.ec], y: [s.sar], mode: 'markers+text', text: [s.id], textposition: s.ec > 5000 ? 'top left' : 'top center', textfont: { size: 10 }, marker: { size: 11, color: s.col, line: { color: '#fff', width: 1 } }, name: s.id, hovertemplate: s.id + '<br>EC %{x:.0f} µS/cm<br>SAR %{y:.2f}<br>' + s.ussl + '<extra></extra>' }); });
    SH.plot('wUssl', tr, function () {
      var sh = [250, 750, 2250].map(function (x) { return { type: 'line', x0: x, x1: x, y0: 0, y1: 32, line: { color: p.text2, width: 1.1 } }; });
      var an = [['C1', 160], ['C2', 430], ['C3', 1300], ['C4', 4800]].map(function (c) { return { x: Math.log10(c[1]), y: 31, text: '<b>' + c[0] + '</b>', showarrow: false, font: { size: 11, color: p.text2 } }; })
        .concat([['S1', 3], ['S2', 13.5], ['S3', 22], ['S4', 29]].map(function (c) { return { x: Math.log10(115), y: c[1], text: '<b>' + c[0] + '</b>', showarrow: false, font: { size: 11, color: p.text2 } }; }));
      return SH.plotLayout({ margin: { l: 56, r: 14, t: 14, b: 50 }, showlegend: false, shapes: sh, annotations: an, xaxis: { type: 'log', range: [2, 4], title: { text: 'EC (µS/cm, 25 °C)' } }, yaxis: { range: [0, 32], title: { text: 'SAR' } } }); }, { filename: 'shandal-ussl' });
  }
  function irr() {
    var h = '<thead><tr><th>ID</th><th class="num">EC</th><th class="num">SAR</th><th>USSL</th><th class="num">%Na</th><th class="num">RSC<br><small>meq/L</small></th><th class="num">KR</th><th class="num">MAR %</th><th class="num">PI %</th><th>FAO 29</th></tr></thead><tbody>';
    R.S.forEach(function (s) { var f = function (v, d) { return isNaN(v) ? '—' : SH.fmt(v, d); };
      h += '<tr><td>' + SH.esc(s.id) + '</td><td class="num">' + f(s.ec, 0) + '</td><td class="num">' + f(s.sar, 2) + '</td><td><b>' + s.ussl + '</b></td><td class="num">' + f(s.pna, 1) + '<br><small class="muted">' + pnaCls(s.pna) + '</small></td><td class="num">' + f(s.rsc, 2) + '<br><small class="muted">' + rscCls(s.rsc) + '</small></td><td class="num"' + (s.kr > 1 ? ' style="color:var(--danger)"' : '') + '>' + f(s.kr, 2) + '</td><td class="num"' + (s.mar > 50 ? ' style="color:var(--danger)"' : '') + '>' + f(s.mar, 1) + '</td><td class="num">' + f(s.pi, 1) + '</td><td>' + faoCls(s.ec) + '</td></tr>'; });
    $('#wIrr').innerHTML = h + '</tbody><tfoot><tr><td colspan="10" class="xsmall muted" style="white-space:normal;line-height:1.7">SAR = Na/√((Ca+Mg)/2) · %Na = (Na+K)/(Ca+Mg+Na+K)×100 (Wilcox 1955) · RSC = (HCO₃+CO₃) − (Ca+Mg) (Eaton 1950) · KR = Na/(Ca+Mg) (Kelly 1940), > 1 ' + t('unsuitable', 'غير صالحة') + ' · MAR = Mg/(Ca+Mg)×100, > 50 ' + t('harmful', 'ضارة') + ' · PI = (Na+√HCO₃)/(Ca+Mg+Na)×100 (Doneen 1964) · ' + t('all in meq/L', 'جميعها بالملي مكافئ/لتر') + '</td></tr></tfoot>';
  }
  /* ---------- narrative */
  function narrative() {
    var S = R.S, n = S.length, p = [], bad = S.filter(function (s) { return Math.abs(s.cbe) > 10; }), fields = {}, gib = { p: 0, r: 0, e: 0 };
    S.forEach(function (s) { fields[s.field[0]] = (fields[s.field[0]] || 0) + 1; if (s.gibA) gib[s.gibA]++; });
    var fTop = Object.keys(fields).sort(function (a, b) { return fields[b] - fields[a]; })[0], fName = S.filter(function (s) { return s.field[0] === fTop; })[0].field[1];
    p.push('<p><b>' + t('Water type. ', 'نوع المياه. ') + '</b>' + fields[fTop] + t(' of ', ' من ') + n + t(' samples plot in field ', ' عينة تقع في الحقل ') + fTop + t(' of the Piper diamond, ', ' من معين Piper، ') + chem(fName) + '. ' +
      (fTop === 'II' ? t('Calcium–magnesium sulfate and chloride water is typical of aquifers in gypsum- and anhydrite-bearing formations such as the Fatha (Lower Fars) and of irrigated alluvium where evaporation concentrates the salts.', 'المياه الكبريتاتية والكلوريدية الكالسيومية المغنيسيومية نموذجية للخزانات في التكوينات الحاوية على الجبس والأنهيدرايت مثل تكوين الفتحة (الفارس الأسفل)، وللرسوبيات النهرية المروية حيث يركّز التبخر الأملاح.') :
       fTop === 'III' ? t('Sodium chloride water marks advanced evaporation, saline groundwater or mixing with brine; it is common in the lower Mesopotamian plain and near sabkhas.', 'المياه الصوديومية الكلوريدية تدل على تبخر متقدم أو مياه جوفية مالحة أو خلط بمحاليل ملحية، وهي شائعة في السهل الرسوبي الأسفل وقرب السبخات.') :
       fTop === 'I' ? t('Calcium bicarbonate water is young, recently recharged water that has dissolved carbonate rocks; it is typical of karst springs and upstream river water.', 'المياه البيكربوناتية الكالسيومية مياه حديثة التغذية أذابت صخوراً كربوناتية، وهي نموذجية للينابيع الكارستية ومياه الأنهار في أعاليها.') :
       t('Sodium bicarbonate water usually reflects cation exchange: calcium in the water is replaced by sodium held on clays.', 'المياه البيكربوناتية الصوديومية تعكس عادة التبادل الأيوني، إذ يحل الصوديوم المحمول على الأطيان محل الكالسيوم في الماء.')) + '</p>');
    p.push('<p><b>' + t('What controls the chemistry. ', 'ما الذي يتحكم بالكيمياء. ') + '</b>' + t('On the Gibbs diagram ', 'على مخطط Gibbs تقع ') + gib.e + t(' sample(s) fall in the evaporation field, ', ' عينة في حقل التبخر، و') + gib.r + t(' in rock weathering and ', ' في تجوية الصخور، و') + gib.p + t(' in precipitation dominance. ', ' في سيادة الأمطار. ') +
      (gib.e > gib.r ? t('Evaporation and evaporite dissolution dominate, as expected in an arid climate with shallow water tables.', 'يسود التبخر وإذابة المتبخرات، كما هو متوقع في مناخ جاف مع مناسيب مياه ضحلة.') : t('Water–rock interaction is the main control, so the chemistry reflects the lithology of the aquifer.', 'التفاعل بين الماء والصخر هو المتحكم الرئيسي، فالكيمياء تعكس صخارية الخزان.')) + '</p>');
    var dr = S.filter(function (s) { return isFinite(s.wqi); }), good = dr.filter(function (s) { return s.wqi <= 50; }).length, exc = {};
    S.forEach(function (s) { Object.keys(R.std.lim).forEach(function (k) { if (exceeds(k, drinkVal(s, k), R.std.lim[k])) exc[k] = (exc[k] || 0) + 1; }); });
    var ek = Object.keys(exc).sort(function (a, b) { return exc[b] - exc[a]; });
    p.push('<p><b>' + t('Drinking. ', 'الشرب. ') + '</b>' + good + t(' of ', ' من ') + dr.length + t(' samples are excellent or good by the WQI. ', ' عينة ممتازة أو جيدة بحسب مؤشر جودة المياه. ') + (ek.length ? t('Most frequent exceedances: ', 'أكثر التجاوزات تكراراً: ') + ek.slice(0, 4).map(function (k) { return chem(PARAM[k]) + ' (' + exc[k] + ')'; }).join('، ') + '. ' +
      (exc.so4 ? t('High sulfate gives a bitter taste and a laxative effect for people not used to it.', 'الكبريتات العالية تعطي طعماً مراً وأثراً مسهلاً لغير المعتادين عليها.') + ' ' : '') + (exc.no3 ? t('Nitrate above 50 mg/L points to sewage or fertiliser and is a health risk for infants.', 'النترات فوق 50 ملغم/لتر تشير إلى مياه الصرف أو الأسمدة، وهي خطر صحي على الرضع.') + ' ' : '') + (exc.tds ? t('Water above 1000 mg/L TDS needs desalination (reverse osmosis) before drinking.', 'المياه التي يتجاوز فيها TDS 1000 ملغم/لتر تحتاج إلى تحلية (التناضح العكسي) قبل الشرب.') : '') : t('No parameter exceeds the selected standard.', 'لا يتجاوز أي معامل المعيار المختار.')) + '</p>');
    var uc = {}; S.forEach(function (s) { uc[s.ussl] = (uc[s.ussl] || 0) + 1; }); var ut = Object.keys(uc).sort(function (a, b) { return uc[b] - uc[a]; })[0] || '—';
    p.push('<p><b>' + t('Irrigation. ', 'الري. ') + '</b>' + t('The commonest USSL class is ', 'فئة USSL الأكثر شيوعاً هي ') + '<b>' + ut + '</b>. ' +
      (/C4/.test(ut) ? t('Very high salinity: usable only on permeable soils with good drainage, extra leaching and very salt-tolerant crops such as date palm and barley.', 'ملوحة عالية جداً: لا تُستخدم إلا في ترب نفاذة جيدة التصريف مع غسل إضافي ومحاصيل شديدة التحمل للملوحة مثل النخيل والشعير.') :
       /C3/.test(ut) ? t('High salinity: suitable for salt-tolerant crops on soils with adequate drainage; regular leaching is required.', 'ملوحة عالية: تصلح للمحاصيل المتحملة للملوحة في ترب جيدة التصريف، مع غسل منتظم للتربة.') : t('Low to medium salinity: suitable for most crops and soils.', 'ملوحة منخفضة إلى متوسطة: تصلح لأغلب المحاصيل والترب.')) + ' ' +
      (S.some(function (s) { return /S3|S4/.test(s.sCls); }) ? t('Some samples carry a high sodium hazard that can disperse clay and seal the soil; gypsum amendment is advised.', 'بعض العينات ذات خطر صوديومي عالٍ قد يفكك الطين ويغلق مسامات التربة، ويُنصح بإضافة الجبس.') : t('The sodium hazard is low (S1–S2).', 'خطر الصوديوم منخفض (S1–S2).')) + '</p>');
    var sv = S.map(function (s) { return aci(s.v.so4); }), worst = ['S3', 'S2', 'S1', 'S0'].filter(function (c) { return sv.indexOf(c) >= 0; })[0];
    if (worst && worst !== 'S0') p.push('<p><b>' + t('Concrete. ', 'الخرسانة. ') + '</b>' + t('Sulfate exposure class ', 'فئة التعرض للكبريتات ') + '<b>' + worst + '</b> (ACI 318-19, ' + t('Table 19.3.1.1', 'الجدول 19.3.1.1') + '). ' + (worst === 'S1' ? t('Use moderately sulfate-resisting cement (ASTM C150 Type II) for foundations in contact with this water.', 'استخدم سمنتاً متوسط المقاومة للكبريتات (ASTM C150 النوع II) للأسس الملامسة لهذه المياه.') : t('Use sulfate-resisting cement (Type V) with a low water/cement ratio for foundations in contact with this water.', 'استخدم سمنتاً مقاوماً للكبريتات (النوع V) مع نسبة ماء/سمنت منخفضة للأسس الملامسة لهذه المياه.')) + '</p>');
    if (bad.length) p.push('<p class="xsmall" style="color:var(--danger)">' + t('Samples with ionic-balance error above 10 % (', 'عينات خطأ توازنها الأيوني أكبر من 10 % (') + bad.map(function (s) { return SH.esc(s.id); }).join('، ') + t(') should be re-analysed before they are interpreted.', ') يجب إعادة تحليلها قبل تفسيرها.') + '</p>');
    $('#wNarr').innerHTML = p.join('');
  }
  /* ---------- map */
  function drawMap() {
    var pts = R.S.filter(function (s) { return isFinite(s.lat) && isFinite(s.lon); }), fig = $('#fw6');
    fig.hidden = !pts.length; if (!pts.length) return;
    if (!map) map = SH.map('wMap', { zoom: 6, base: 'topo' }); if (!map) return;
    if (mk) map.removeLayer(mk); mk = L.layerGroup().addTo(map);
    pts.forEach(function (s) { var w = wqiC(s.wqi), col = w[2] === 'ok' ? '#2E8B57' : w[2] === 'warn' ? '#D4A017' : w[2] === 'bad' ? '#C0392B' : '#7F8C8D';
      L.circleMarker([s.lat, s.lon], { radius: 9, color: '#fff', weight: 2, fillColor: col, fillOpacity: .95 }).bindPopup('<b>' + SH.esc(s.id) + '</b><br>WQI ' + (isFinite(s.wqi) ? SH.fmt(s.wqi, 1) : '—') + ' · ' + w[1] + '<br>TDS ' + SH.fmt(s.tds, 0) + ' mg/L · ' + s.ussl + '<br>' + s.cf + ' · ' + s.af).addTo(mk); });
    setTimeout(function () { map.invalidateSize(); map.fitBounds(L.latLngBounds(pts.map(function (s) { return [s.lat, s.lon]; })).pad(0.3), { maxZoom: 12 }); }, 50);
  }
  /* ---------- exports */
  $('#wCsv').addEventListener('click', function () { if (!R) return; SH.csv('shandal-water-results.csv', [['ID', 'Lat', 'Lon', 'Cations_meq', 'Anions_meq', 'CBE_pct', 'TDS_mgL', 'TH_mgL_CaCO3', 'Cation_facies', 'Anion_facies', 'Piper_field', 'Gibbs_cation', 'Gibbs_anion', 'WQI', 'WQI_class', 'SAR', 'Na_pct', 'RSC_meq', 'KR', 'MAR_pct', 'PI_pct', 'USSL', 'ACI_sulfate']].concat(R.S.map(function (s) {
    var r2 = function (v, d) { return isFinite(v) ? v.toFixed(d) : ''; };
    return [s.id, r2(s.lat, 6), r2(s.lon, 6), r2(s.cat, 3), r2(s.an, 3), r2(s.cbe, 2), r2(s.tds, 0), r2(s.th, 0), s.cf, s.af, s.field[0], s.gibC || '', s.gibA || '', r2(s.wqi, 1), wqiC(s.wqi)[1], r2(s.sar, 2), r2(s.pna, 1), r2(s.rsc, 2), r2(s.kr, 2), r2(s.mar, 1), r2(s.pi, 1), s.ussl, aci(s.v.so4)]; }))); });
  $('#wCsvIn').addEventListener('click', function () { SH.csv('shandal-water-input.csv', [KEYS].concat(rows.map(function (r) { return KEYS.map(function (k) { return r[k] == null ? '' : r[k]; }); }))); });
  SH.$$('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { if (R) SH.svgPng($('#' + b.getAttribute('data-svg')), 'shandal-' + b.getAttribute('data-svg').slice(1).toLowerCase() + '.png', 3, '#ffffff'); }); });

  /* illustrative example: six water types typical of Iraq (synthetic values, ionically balanced; not measurements) */
  $('#wDemo').addEventListener('click', function () {
    rows = [
      { id: 'Tigris-Baghdad', lat: 33.33, lon: 44.39, ph: 7.9, ec: 750, tds: 480, ca: 70, mg: 25, na: 45, k: 3, hco3: 160, co3: 0, cl: 60, so4: 150, no3: 8, f: 0.4, turb: 12 },
      { id: 'Karst-Spring', lat: 36.19, lon: 44.01, ph: 7.7, ec: 480, tds: 300, ca: 65, mg: 18, na: 12, k: 1.5, hco3: 240, co3: 0, cl: 20, so4: 45, no3: 4, f: 0.2, turb: 1 },
      { id: 'Well-Fatha', lat: 35.05, lon: 43.6, ph: 7.6, ec: 1600, tds: 1050, ca: 120, mg: 55, na: 140, k: 5, hco3: 230, co3: 0, cl: 190, so4: 380, no3: 15, f: 0.8, turb: 2 },
      { id: 'Well-Dibdibba', lat: 30.55, lon: 47.25, ph: 7.4, ec: 2600, tds: 1750, ca: 180, mg: 85, na: 260, k: 8, hco3: 210, co3: 0, cl: 380, so4: 620, no3: 25, f: 1.1, turb: 1.5 },
      { id: 'Well-Na', lat: 32.5, lon: 45.8, ph: 8.1, ec: 2900, tds: 1800, ca: 60, mg: 30, na: 420, k: 10, hco3: 300, co3: 0, cl: 520, so4: 300, no3: 5, f: 1.4, turb: 3 },
      { id: 'Sabkha-Edge', lat: 31.2, lon: 46.4, ph: 7.2, ec: 8900, tds: 5600, ca: 410, mg: 230, na: 1150, k: 25, hco3: 180, co3: 0, cl: 1900, so4: 1450, no3: 30, f: 1.6, turb: 4 }];
    save(); drawInput(); run();
    SH.toast(t('Illustrative values, not field measurements.', 'قيم توضيحية وليست قياسات حقلية.'), 'info');
  });
  $('#wRun').addEventListener('click', run);
  $('#wStd').addEventListener('change', function () { if (R) run(); });
  document.addEventListener('sh:beforereport', function (e) { if (!R) { e.preventDefault(); SH.toast(t('Analyse the samples first.', 'حلّل العينات أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (R) { gibbs(); schoeller(); ussl(); } });
  drawInput(); if (rows.length) run();
})();
