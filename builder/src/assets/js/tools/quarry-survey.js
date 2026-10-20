/* Quarry & earthworks survey — volumes, UTM corners, plan, satellite view, pit-face column, assessment narrative. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var GOVS = [['Baghdad', 'بغداد'], ['Basra', 'البصرة'], ['Nineveh', 'نينوى'], ['Erbil', 'أربيل'], ['Najaf', 'النجف الأشرف'], ['Karbala', 'كربلاء المقدسة'], ['Kirkuk', 'كركوك'], ['Anbar', 'الأنبار'], ['Diyala', 'ديالى'], ['Dhi Qar', 'ذي قار'], ['Sulaymaniyah', 'السليمانية'], ['Babil', 'بابل'], ['Maysan', 'ميسان'], ['Wasit', 'واسط'], ['Salah al-Din', 'صلاح الدين'], ['Qadisiyyah', 'الديوانية'], ['Muthanna', 'المثنى'], ['Duhok', 'دهوك'], ['Halabja', 'حلبجة']];
  var LITH = {
    topsoil: ['Topsoil', 'تربة سطحية', '#D7CCC8', 'soil', 1], clay: ['Clay', 'طين', '#CFD8DC', 'clay', 1], silt: ['Silt', 'غرين', '#ECEFF1', 'silt', 2], sand: ['Sand', 'رمل', '#FFE082', 'dots', 2], gravel: ['Gravel', 'حصى', '#BCAAA4', 'cong', 1],
    conglomerate: ['Conglomerate', 'مدملكات', '#A1887F', 'cong', 3], breccia: ['Breccia', 'بريشيا', '#8D6E63', 'brec', 3], sandstone: ['Sandstone', 'حجر رملي', '#FFCC80', 'dots', 3], mudstone: ['Mudstone', 'حجر طيني', '#B0BEC5', 'clay', 1], shale: ['Shale', 'طفل', '#90A4AE', 'shale', 1],
    limestone: ['Limestone', 'حجر جيري', '#BBDDF0', 'lime', 3], dolomite: ['Dolomite', 'دولومايت', '#BBDEFB', 'dolo', 3], marl: ['Marl', 'مارل', '#C5CAE9', 'marl', 1], chalk: ['Chalk', 'طباشير', '#F5F5F5', 'lime', 2], calcarenite: ['Calcarenite', 'حجر جيري فتاتي', '#B3D4F2', 'dots', 2],
    gypsum: ['Gypsum / anhydrite', 'جبس / أنهيدرايت', '#F8BBD0', 'gyp', 2], halite: ['Halite', 'ملح صخري', '#F48FB1', 'halite', 2],
    basalt: ['Basalt', 'بازلت', '#78909C', 'volc', 3], granite: ['Granite', 'غرانيت', '#FFCCBC', 'plus', 3], tuff: ['Tuff', 'طف بركاني', '#FFD54F', 'volc', 2]
  };
  var ln = function (k) { return LITH[k] ? LITH[k][SH.lang === 'ar' ? 1 : 0] : k; };
  var corners = SH.store.get('shandal_quarry_corners', [null, null, null, null]);
  var beds = SH.store.get('shandal_quarry_beds', [{ rock: 'topsoil', th: 0.5 }, { rock: 'clay', th: 1 }, { rock: 'sand', th: 2, sec: 'gravel', mix: 'mixed' }]);
  var persist = SH.persist('quarry', ['geoName', 'qSite', 'qCountry', 'qGov', 'qReg', 'qDunam', 'qArea', 'qVol', 'qMaxD', 'qL', 'qW', 'qD', 'qVarOther', 'qLab', 'qGw', 'qRehab', 'qColInv', 'qColRem']);
  var map, mapLayer, last = null;

  $('#qGov').innerHTML = GOVS.map(function (g) { return '<option value="' + g[0] + '">' + g[SH.lang === 'ar' ? 1 : 0] + '</option>'; }).join('');
  var sv = SH.store.get('shandal_tool_quarry', {}); if (sv.qGov) $('#qGov').value = sv.qGov;
  function country() { var iq = SH.val('qCountry') === 'iq'; $('#qGovWrap').hidden = !iq; $('#qRegWrap').hidden = iq; }
  $('#qCountry').addEventListener('change', country); country();
  $('#qDunam').addEventListener('input', function () { var v = SH.num('qDunam'); $('#qArea').value = v > 0 ? v * 2500 : ''; });
  $('#qArea').addEventListener('input', function () { var v = SH.num('qArea'); $('#qDunam').value = v > 0 ? +(v / 2500).toFixed(3) : ''; });

  /* ---------- corners */
  function cornersUI() {
    $('#qCorners').innerHTML = ['A', 'B', 'C', 'D'].map(function (k, i) {
      var c = corners[i], u = c ? SH.toUTM(c.lat, c.lon) : null;
      return '<div style="border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px"><div style="display:flex;align-items:center;gap:8px"><b style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">' + k + '</b>' +
        '<span class="small ltr" style="flex:1">' + (u ? 'E ' + SH.fmt(u.E, 1, { nogroup: true }) + ' · N ' + SH.fmt(u.N, 1, { nogroup: true }) + ' · ' + u.zone + u.band + (c.acc ? ' · ±' + Math.round(c.acc) + ' m' : '') : '<span class="muted">' + t('Not captured', 'لم يُلتقط') + '</span>') + '</span>' +
        '<button class="btn btn-ink btn-xs" type="button" data-gps="' + i + '">GPS</button></div>' +
        '<div class="row2"><input class="ltr" style="height:36px;border:1px solid var(--line-2);border-radius:8px;padding:0 10px;background:var(--bg);color:var(--text);font:inherit;font-size:.84rem" placeholder="' + t('Latitude', 'دائرة العرض') + '" data-lat="' + i + '" value="' + (c ? c.lat.toFixed(6) : '') + '"><input class="ltr" style="height:36px;border:1px solid var(--line-2);border-radius:8px;padding:0 10px;background:var(--bg);color:var(--text);font:inherit;font-size:.84rem" placeholder="' + t('Longitude', 'خط الطول') + '" data-lon="' + i + '" value="' + (c ? c.lon.toFixed(6) : '') + '"></div></div>';
    }).join('');
  }
  $('#qCorners').addEventListener('click', function (e) {
    var b = e.target.closest('[data-gps]'); if (!b) return; var i = +b.getAttribute('data-gps'); b.disabled = true; b.textContent = '…';
    SH.locateBest(10000, function (p) { b.textContent = '±' + Math.round(p.acc) + 'm'; }).then(function (p) { corners[i] = p; SH.store.set('shandal_quarry_corners', corners); cornersUI(); SH.toast(t('Corner ', 'الركن ') + 'ABCD'[i] + t(' captured, accuracy ±', ' التُقط، الدقة ±') + Math.round(p.acc) + ' m', 'ok'); })
      .catch(function (er) { SH.toast(er.message, 'bad'); cornersUI(); });
  });
  $('#qCorners').addEventListener('change', function (e) {
    var i = e.target.getAttribute('data-lat') || e.target.getAttribute('data-lon'); if (i == null) return; i = +i;
    var la = parseFloat($('[data-lat="' + i + '"]').value), lo = parseFloat($('[data-lon="' + i + '"]').value);
    if (!isNaN(la) && !isNaN(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) { corners[i] = { lat: la, lon: lo }; SH.store.set('shandal_quarry_corners', corners); cornersUI(); }
  });

  /* ---------- beds editor */
  var opts = function (sel) { return Object.keys(LITH).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + ln(k) + '</option>'; }).join(''); };
  function bedsUI() {
    var top = 0;
    $('#qBeds').innerHTML = beds.map(function (b, i) {
      var html = '<div style="border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px" data-bed="' + i + '"><div style="display:flex;align-items:center;gap:8px"><b class="small">' + t('Bed ', 'الطبقة ') + (i + 1) + '</b><span class="xsmall muted ltr">' + SH.fmt(top, 1) + '–' + SH.fmt(top + (b.th || 0), 1) + ' m</span><button class="x" style="margin-inline-start:auto" type="button" data-delbed="' + i + '" aria-label="' + t('Delete', 'حذف') + '">✕</button></div>' +
        '<div class="row2"><div class="fg"><select data-f="rock">' + opts(b.rock) + '</select></div><div class="fg"><input type="number" step="0.1" min="0.1" data-f="th" value="' + (b.th || '') + '" placeholder="' + t('Thickness m', 'السمك م') + '"></div></div>' +
        '<div class="row2"><div class="fg"><select data-f="sec"><option value="">' + t('No secondary rock', 'بلا صخر ثانوي') + '</option>' + opts(b.sec) + '</select></div><div class="fg"><select data-f="mix"><option value="mixed"' + (b.mix === 'mixed' ? ' selected' : '') + '>' + t('Mixed', 'مختلط') + '</option><option value="inter"' + (b.mix === 'inter' ? ' selected' : '') + '>' + t('Interbedded', 'متعاقب') + '</option></select></div></div></div>';
      top += b.th || 0; return html;
    }).join('');
  }
  $('#qBeds').addEventListener('change', function (e) { var box = e.target.closest('[data-bed]'), f = e.target.getAttribute('data-f'); if (!box || !f) return; var i = +box.getAttribute('data-bed'); beds[i][f] = f === 'th' ? parseFloat(e.target.value) || 0 : e.target.value; SH.store.set('shandal_quarry_beds', beds); bedsUI(); });
  $('#qBeds').addEventListener('click', function (e) { var b = e.target.closest('[data-delbed]'); if (!b) return; beds.splice(+b.getAttribute('data-delbed'), 1); SH.store.set('shandal_quarry_beds', beds); bedsUI(); });
  $('#qAddBed').addEventListener('click', function () { beds.push({ rock: 'limestone', th: 1 }); SH.store.set('shandal_quarry_beds', beds); bedsUI(); });

  var checked = function (id) { return SH.$$('#' + id + ' input:checked').map(function (i) { return i.value; }); };
  var label = function (id, v) { var i = $('#' + id + ' input[value="' + v + '"]'); return i ? i.parentElement.textContent.trim() : v; };

  /* ---------- processing */
  function run() {
    var A = SH.num('qArea'), V = SH.num('qVol'), Lm = SH.num('qL'), Wm = SH.num('qW'), Dm = SH.num('qD'), maxD = SH.num('qMaxD');
    if (!(Lm > 0 && Wm > 0 && Dm > 0)) { SH.toast(t('Enter the worked length, width and depth.', 'أدخل الطول والعرض والعمق المستثمر.'), 'warn'); return; }
    var r = { A: A, V: V, Lm: Lm, Wm: Wm, Dm: Dm, maxD: maxD };
    r.invA = Lm * Wm; r.extV = r.invA * Dm; r.remA = A > 0 ? A - r.invA : NaN; r.remV = V > 0 ? V - r.extV : NaN; r.pctA = A > 0 ? 100 * r.invA / A : NaN; r.pctV = V > 0 ? 100 * r.extV / V : NaN;
    var pts = corners.filter(Boolean);
    if (pts.length >= 3) { var z = SH.toUTM(pts[0].lat, pts[0].lon).zone, xy = pts.map(function (p) { var u = SH.toUTM(p.lat, p.lon, z); return [u.E, u.N]; }), s = 0; for (var i = 0; i < xy.length; i++) { var j = (i + 1) % xy.length; s += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1]; } r.gpsA = Math.abs(s) / 2; }
    r.beds = beds.filter(function (b) { return b.rock && b.th > 0; }); r.bedsTotal = r.beds.reduce(function (a, b) { return a + b.th; }, 0);
    last = r; persist.save(); render(r);
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  function render(r) {
    $('#qEmpty').hidden = true; $('#qOut').hidden = false;
    var overV = r.remV < 0, overA = r.remA < 0, overD = r.maxD > 0 && r.Dm > r.maxD;
    $('#qKpis').innerHTML = kpi(overV ? 'bad' : 'info', t('Extracted volume', 'الكمية المستخرجة'), SH.fmt(r.extV, 0) + '<small> m³</small>', isNaN(r.pctV) ? '' : SH.fmt(r.pctV, 1) + t(' % of contract', ' % من العقد')) +
      kpi(overV ? 'bad' : 'ok', t('Remaining volume', 'الكمية المتبقية'), SH.fmt(r.remV, 0) + '<small> m³</small>', overV ? t('Contract exceeded', 'تجاوز العقد') : t('Still available', 'متاحة')) +
      kpi(overA ? 'bad' : '', t('Worked area', 'المساحة المستثمرة'), SH.fmt(r.invA, 0) + '<small> m²</small>', SH.fmt(r.invA / 2500, 2) + t(' dunam', ' دونم') + (r.gpsA ? ' · GPS ' + SH.fmt(r.gpsA, 0) + ' m²' : '')) +
      kpi(overA ? 'bad' : 'ok', t('Remaining area', 'المساحة المتبقية'), SH.fmt(r.remA, 0) + '<small> m²</small>', isNaN(r.pctA) ? '' : SH.fmt(100 - r.pctA, 1) + t(' % of contract', ' % من العقد')) +
      kpi(overD ? 'bad' : 'ok', t('Worked depth', 'العمق المستثمر'), SH.fmt(r.Dm, 1) + '<small> m</small>', r.maxD > 0 ? t('Permitted ', 'المسموح ') + SH.fmt(r.maxD, 1) + ' m' : t('No limit entered', 'لم يُدخل حد'));
    var v = [];
    if (overV || overA) v.push(verdict('bad', t('Contract exceeded', 'تجاوز حدود العقد'), t('The worked volume or area is larger than the contracted amount. Notify the licensing authority.', 'الكمية أو المساحة المستثمرة أكبر من المتعاقد عليه. يجب إبلاغ جهة الترخيص.')));
    if (overD) v.push(verdict('bad', t('Permitted depth exceeded', 'تجاوز العمق المسموح'), t('Excavation is ', 'الحفر أعمق بـ ') + SH.fmt(r.Dm - r.maxD, 1) + t(' m deeper than the licence allows.', ' م من المسموح في الترخيص.')));
    var gw = SH.val('qGw'); if (gw !== 'safe') v.push(verdict(gw === 'impact' ? 'bad' : 'warn', t('Groundwater reached', 'الوصول إلى المياه الجوفية'), gw === 'impact' ? t('Excavation is affecting groundwater. Stop work and inform the environmental authority.', 'الحفر يؤثر على المياه الجوفية. يجب إيقاف العمل وإبلاغ الجهة البيئية.') : t('Water is visible in the pit. Keep the floor above the water table.', 'المياه ظاهرة في الحفرة. حافظ على أرضية الحفر فوق منسوب المياه.')));
    if (SH.val('qRehab') === 'hazard') v.push(verdict('bad', t('Unsafe abandoned pit', 'حفرة متروكة غير آمنة'), t('The site has been left as an open pit, contrary to rehabilitation rules.', 'تُرك الموقع حفرة مفتوحة خلافاً لتعليمات إعادة التأهيل.')));
    if (SH.val('qLab') === 'no') v.push(verdict('warn', t('Material does not match the laboratory report', 'المادة غير مطابقة للتحليل المختبري'), t('Resample and retest before further extraction.', 'أعد أخذ العينات والفحص قبل الاستمرار بالاستخراج.')));
    if (r.gpsA && r.invA && Math.abs(r.gpsA - r.invA) / r.invA > 0.15) v.push(verdict('info', t('GPS area differs from tape measurements', 'مساحة GPS تختلف عن القياس بالشريط'), t('The polygon from the corners is ', 'المضلع من الأركان مساحته ') + SH.fmt(r.gpsA, 0) + ' m² ' + t('against ', 'مقابل ') + SH.fmt(r.invA, 0) + ' m² ' + t('from length × width. Check the corners or the shape of the pit.', 'من الطول × العرض. تحقق من الأركان أو من شكل الحفرة.')));
    if (!v.length) v.push(verdict('ok', t('Within contract and licence', 'ضمن حدود العقد والترخيص'), t('No exceedance or environmental warning was found in the entered data.', 'لم يُرصد تجاوز أو تحذير بيئي في البيانات المدخلة.')));
    $('#qVerd').innerHTML = v.join('');
    drawPlan(r); drawCol(r); drawMap(); narrative(r); summaries(r);
  }

  function drawPlan(r) {
    var S = SH.svgB('qPlan'), p = SH.palette(), inv = SH.val('qColInv'), rem = SH.val('qColRem');
    S.add('rect', { x: 0, y: 0, width: 560, height: 420, fill: SH.css('--il-bg') });
    var totW = r.Wm, totL = r.A > 0 ? r.A / r.Wm : r.Lm; if (!(totL > 0)) totL = r.Lm;
    var mx = 70, my = 50, dw = 420, dh = 300, sc = Math.min(dw / Math.max(totL, r.Lm), dh / totW), wL = Math.max(totL, r.Lm) * sc, wW = totW * sc, ox = mx + (dw - wL) / 2, oy = my + (dh - wW) / 2;
    S.add('rect', { x: ox, y: oy, width: totL * sc, height: wW, fill: SH.alpha(rem, .35), stroke: rem, 'stroke-width': 2 });
    S.add('rect', { x: ox, y: oy, width: r.Lm * sc, height: wW, fill: SH.alpha(inv, .55), stroke: inv, 'stroke-width': 2 });
    S.text(ox + r.Lm * sc / 2, oy + wW / 2 - 4, t('Worked', 'مستثمر'), { 'font-size': 13, 'font-weight': 800, fill: p.text, 'text-anchor': 'middle' });
    S.text(ox + r.Lm * sc / 2, oy + wW / 2 + 14, SH.fmt(r.invA, 0) + ' m²', { 'font-size': 12, fill: p.text, 'text-anchor': 'middle' });
    if (totL > r.Lm) { S.text(ox + r.Lm * sc + (totL - r.Lm) * sc / 2, oy + wW / 2 - 4, t('Remaining', 'متبقٍ'), { 'font-size': 13, 'font-weight': 800, fill: p.text, 'text-anchor': 'middle' }); S.text(ox + r.Lm * sc + (totL - r.Lm) * sc / 2, oy + wW / 2 + 14, SH.fmt(r.remA, 0) + ' m²', { 'font-size': 12, fill: p.text, 'text-anchor': 'middle' }); }
    S.arrow(ox + 1, oy + wW + 22, ox + r.Lm * sc - 1, oy + wW + 22, p.text2, 1.2); S.arrow(ox + r.Lm * sc - 1, oy + wW + 22, ox + 1, oy + wW + 22, p.text2, 1.2);
    S.text(ox + r.Lm * sc / 2, oy + wW + 40, 'L = ' + SH.fmt(r.Lm, 1) + ' m', { 'font-size': 12, fill: p.text2, 'text-anchor': 'middle' });
    S.arrow(ox - 22, oy + 1, ox - 22, oy + wW - 1, p.text2, 1.2); S.arrow(ox - 22, oy + wW - 1, ox - 22, oy + 1, p.text2, 1.2);
    S.text(ox - 30, oy + wW / 2, 'W = ' + SH.fmt(r.Wm, 1) + ' m', { 'font-size': 12, fill: p.text2, 'text-anchor': 'middle', transform: 'rotate(-90 ' + (ox - 30) + ' ' + (oy + wW / 2) + ')' });
    S.path('M520 40l7 18h-14z', { fill: p.accent }); S.text(520, 34, 'N', { 'font-size': 12, 'font-weight': 800, fill: p.text, 'text-anchor': 'middle' });
    $('#qPlanCap').innerHTML = t('Contract area drawn as ', 'رُسمت مساحة العقد بطول ') + SH.fmt(totL, 1) + ' × ' + SH.fmt(totW, 1) + ' m ' + t('using the worked width. ', 'باستخدام العرض المستثمر. ') + (isNaN(r.pctA) ? '' : t('Worked share: ', 'نسبة الاستثمار: ') + '<b>' + SH.fmt(r.pctA, 1) + ' %</b>.');
  }

  function pattern(S, defs, id, kind, col) {
    var P = S.add('pattern', { id: id, width: 20, height: 20, patternUnits: 'userSpaceOnUse' }, null, defs);
    var l = function (dd, w, da) { S.add('path', { d: dd, stroke: col, 'stroke-width': w || 1, fill: 'none', 'stroke-dasharray': da || null }, null, P); }, dot = function (x, y, r) { S.add('circle', { cx: x, cy: y, r: r || 1, fill: col }, null, P); };
    ({ soil: function () { l('M2 16q3 -6 6 0M12 8q3 -6 6 0', .9); }, clay: function () { l('M0 5H20M0 15H20', 1, '8 3'); }, silt: function () { l('M0 5H8M12 5H20', 1); dot(10, 15); }, dots: function () { dot(4, 4); dot(14, 8); dot(8, 15); dot(17, 17); },
      cong: function () { S.add('circle', { cx: 6, cy: 6, r: 3.5, fill: 'none', stroke: col }, null, P); S.add('circle', { cx: 15, cy: 15, r: 2.5, fill: 'none', stroke: col }, null, P); }, brec: function () { l('M2 2L9 5L4 9ZM12 11L18 13L13 18Z'); },
      shale: function () { l('M0 4H8M12 4H20M0 14H5M9 14H17'); }, lime: function () { l('M0 0H20M0 10H20M5 0V10M15 10V20'); }, dolo: function () { l('M0 0H20M0 10H20M5 0V10M15 10V20M8 10L12 0'); }, marl: function () { l('M0 0H20M0 10H20M5 0V10M15 10V20'); l('M2 5H8M12 15H18', 1, '2 2'); },
      gyp: function () { l('M2 4L5 9L8 4M12 14L15 19L18 14'); }, halite: function () { l('M0 0H20V20H0ZM10 0V20M0 10H20', .7); }, volc: function () { l('M3 4L6 10L9 4M12 13L15 19L18 13'); }, plus: function () { l('M5 2V8M2 5H8M15 12V18M12 15H18', 1.2); } }[kind] || function () { dot(10, 10); })();
  }
  function drawCol(r) {
    var S = SH.svgB('qCol'), p = SH.palette(), defs = S.add('defs', {}), ink = '#1B232B';
    S.add('rect', { x: 0, y: 0, width: 560, height: 420, fill: '#FFFFFF' });
    if (!r.beds.length) { S.text(280, 210, t('No beds entered', 'لم تُدخل طبقات'), { 'font-size': 14, fill: p.text3, 'text-anchor': 'middle' }); return; }
    var top = 40, H = 340, px = H / r.bedsTotal, x0 = 120, wmax = 160, y = top;
    S.text(x0, 26, t('Depth (m)', 'العمق (م)'), { 'font-size': 11, fill: '#5A6670' });
    r.beds.forEach(function (b, i) {
      var h = b.th * px, w = 70 + LITH[b.rock][4] * (wmax - 70) / 3; pattern(S, defs, 'qp' + i, LITH[b.rock][3], '#2B2B2B');
      S.add('rect', { x: x0, y: y, width: w, height: h, fill: LITH[b.rock][2] }); S.add('rect', { x: x0, y: y, width: w, height: h, fill: 'url(#qp' + i + ')' });
      if (b.sec && LITH[b.sec]) { pattern(S, defs, 'qs' + i, LITH[b.sec][3], '#2B2B2B'); if (b.mix === 'inter') { var bd = Math.max(5, h / 6); for (var k = bd; k < h; k += 2 * bd) { S.add('rect', { x: x0, y: y + k, width: w, height: Math.min(bd, h - k), fill: LITH[b.sec][2] }); S.add('rect', { x: x0, y: y + k, width: w, height: Math.min(bd, h - k), fill: 'url(#qs' + i + ')' }); } } else S.add('rect', { x: x0, y: y, width: w, height: h, fill: 'url(#qs' + i + ')', opacity: .7 }); }
      S.add('rect', { x: x0, y: y, width: w, height: h, fill: 'none', stroke: ink, 'stroke-width': 1.2 });
      S.line(x0 - 8, y, x0, y, { stroke: ink }); S.text(x0 - 12, y + 4, SH.fmt(y === top ? 0 : (y - top) / px, 1), { 'font-size': 10, fill: '#5A6670', 'text-anchor': 'end' });
      if (h > 11) S.text(x0 + wmax + 20, y + h / 2 + 4, ln(b.rock) + (b.sec ? (b.mix === 'inter' ? t(' / ', ' / ') : ' + ') + ln(b.sec) : '') + ' · ' + SH.fmt(b.th, 1) + ' m', { 'font-size': 12, fill: ink });
      y += h;
    });
    S.line(x0 - 8, y, x0, y, { stroke: ink }); S.text(x0 - 12, y + 4, SH.fmt(r.bedsTotal, 1), { 'font-size': 10, fill: '#5A6670', 'text-anchor': 'end' });
    if (r.Dm > 0 && r.Dm <= r.bedsTotal) { var dy = top + r.Dm * px; S.line(x0 - 30, dy, x0 + wmax + 10, dy, { stroke: '#B4552D', 'stroke-width': 2, 'stroke-dasharray': '6 4' }); S.text(x0 - 34, dy - 4, t('pit floor', 'أرضية الحفر'), { 'font-size': 10, fill: '#B4552D', 'text-anchor': 'end' }); }
  }

  function drawMap() {
    var pts = corners.filter(Boolean);
    if (!map) { map = SH.map('qMap', { base: 'satellite', zoom: 15, locate: false }); }
    if (!map) return;
    if (mapLayer) map.removeLayer(mapLayer);
    mapLayer = L.layerGroup().addTo(map);
    if (pts.length < 3) { $('#qMap').insertAdjacentHTML('beforeend', ''); SH.toast(t('Capture at least three corners to outline the site on the satellite map.', 'التقط ثلاثة أركان على الأقل لرسم الموقع على الخريطة الفضائية.'), 'info'); return; }
    var poly = L.polygon(pts.map(function (p) { return [p.lat, p.lon]; }), { color: SH.val('qColInv'), weight: 3, fillOpacity: .25 }).addTo(mapLayer);
    corners.forEach(function (c, i) { if (!c) return; var u = SH.toUTM(c.lat, c.lon); L.marker([c.lat, c.lon], { icon: SH.pin('ABCD'[i], 'mk-num', [24, 24]) }).bindTooltip('ABCD'[i] + ' · E ' + u.E.toFixed(1) + ' N ' + u.N.toFixed(1) + ' (' + u.zone + u.band + ')', { permanent: false }).addTo(mapLayer); });
    setTimeout(function () { map.invalidateSize(); map.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 18 }); }, 100);
  }

  function narrative(r) {
    var ord = SH.lang === 'ar' ? ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'] : ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    var top = 0, html = '<p>' + t('Field observations show a section from the surface (0.0 m) to ', 'تُظهر المشاهدات الحقلية مقطعاً يمتد من السطح (0.0 م) حتى عمق ') + SH.fmt(r.bedsTotal, 1) + t(' m. The lithological succession is described as follows:', ' م، ويُوصف التتابع الصخاري كما يلي:') + '</p>';
    r.beds.forEach(function (b, i) {
      var s = '<p><b>' + t('The ', 'الطبقة ') + (ord[i] || (i + 1)) + t(' bed', '') + '</b> ' + t('extends from ', 'تمتد من عمق ') + SH.fmt(top, 1) + t(' m to ', ' م إلى ') + SH.fmt(top + b.th, 1) + t(' m (', ' م (بسمك ') + SH.fmt(b.th, 1) + t(' m thick) and consists mainly of ', ' م)، وتتكون أساساً من ') + ln(b.rock).toLowerCase();
      if (b.sec) s += b.mix === 'inter' ? t(', interbedded with thin layers of ', '، تتعاقب معها طبقات رقيقة من ') + ln(b.sec).toLowerCase() + t(', which records alternating depositional energy.', '، مما يدل على تناوب في طاقة الترسيب.') : t(', mixed with scattered ', '، ممزوجة بحبيبات متناثرة من ') + ln(b.sec).toLowerCase() + t(' within the matrix.', ' ضمن الأرضية.');
      else s += '.';
      html += s + '</p>'; top += b.th;
    });
    var vars = checked('qVar').map(function (v) { return label('qVar', v); }); if (SH.val('qVarOther')) vars.push(SH.esc(SH.val('qVarOther')));
    html += '<p>' + (vars.length ? t('Geological variations observed in the face: ', 'المتغيرات الجيولوجية المرصودة في الواجهة: ') + vars.join('، ') + '.' : t('No geological variations were observed; the beds are laterally continuous and stable.', 'لم تُرصد متغيرات جيولوجية، والطبقات مستمرة جانبياً ومستقرة.')) + '</p>';
    $('#qNarr').innerHTML = html;
  }
  function summaries(r) {
    var row = function (k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; };
    var place = SH.val('qCountry') === 'iq' ? t('Iraq · ', 'العراق · ') + SH.selText('qGov') : SH.esc(SH.val('qReg') || '—');
    $('#qSum1').innerHTML = row(t('Quarry / contract', 'المقلع / العقد'), SH.esc(SH.val('qSite') || '—')) + row(t('Location', 'الموقع'), place) + row(t('Contract area', 'المساحة المتعاقد عليها'), SH.fmt(r.A, 0) + ' m² (' + SH.fmt(r.A / 2500, 2) + t(' dunam)', ' دونم)')) +
      row(t('Contracted volume', 'الكمية المتعاقد عليها'), SH.fmt(r.V, 0) + ' m³') + row(t('Worked L × W × D', 'الطول × العرض × العمق'), '<span class="ltr">' + SH.fmt(r.Lm, 1) + ' × ' + SH.fmt(r.Wm, 1) + ' × ' + SH.fmt(r.Dm, 1) + ' m</span>') + row(t('Extracted / remaining', 'المستخرج / المتبقي'), SH.fmt(r.extV, 0) + ' / ' + SH.fmt(r.remV, 0) + ' m³');
    $('#qSum2').innerHTML = '<thead><tr><th>#</th><th class="num">Lat</th><th class="num">Lon</th><th class="num">E</th><th class="num">N</th><th>Zone</th></tr></thead><tbody>' + corners.map(function (c, i) { if (!c) return '<tr><td>' + 'ABCD'[i] + '</td><td colspan="5" class="muted">' + t('not captured', 'لم يُلتقط') + '</td></tr>'; var u = SH.toUTM(c.lat, c.lon); return '<tr><td><b>' + 'ABCD'[i] + '</b></td><td class="num">' + c.lat.toFixed(6) + '</td><td class="num">' + c.lon.toFixed(6) + '</td><td class="num">' + u.E.toFixed(1) + '</td><td class="num">' + u.N.toFixed(1) + '</td><td>' + u.zone + u.band + '</td></tr>'; }).join('') + '</tbody>';
    var pol = checked('qPol').map(function (v) { return label('qPol', v); }), ops = checked('qOps').map(function (v) { return label('qOps', v); }), mach = checked('qMach').map(function (v) { return label('qMach', v); });
    $('#qSum3').innerHTML = row(t('Laboratory compliance', 'المطابقة المختبرية'), SH.selText('qLab')) + row(t('Pollution', 'التلوث'), pol.length ? pol.join('، ') : t('None observed', 'لم يُرصد')) + row(t('Groundwater', 'المياه الجوفية'), SH.selText('qGw')) + row(t('Rehabilitation', 'إعادة التأهيل'), SH.selText('qRehab')) + row(t('Operations', 'العمليات'), ops.join('، ') || '—') + row(t('Machinery', 'الآليات'), mach.join('، ') || '—');
  }

  $('#qRun').addEventListener('click', run);
  $('#qDemo').addEventListener('click', function () {
    var v = { qSite: t('Nahrawan quarry 12', 'مقلع النهروان 12'), qDunam: 20, qArea: 50000, qVol: 300000, qMaxD: 6, qL: 140, qW: 120, qD: 5.5 };
    for (var k in v) $('#' + k).value = v[k];
    var c = [33.3010, 44.7020]; corners = [{ lat: c[0], lon: c[1] }, { lat: c[0], lon: c[1] + 0.00151 }, { lat: c[0] - 0.00108, lon: c[1] + 0.00151 }, { lat: c[0] - 0.00108, lon: c[1] }];
    beds = [{ rock: 'topsoil', th: 0.5 }, { rock: 'clay', th: 1.5 }, { rock: 'sand', th: 2, sec: 'gravel', mix: 'mixed' }, { rock: 'gravel', th: 2.5 }];
    SH.$$('#qVar input[value=joint],#qOps input[value=exc],#qOps input[value=trans],#qMach input[value=ex],#qMach input[value=dt]').forEach(function (i) { i.checked = true; });
    SH.store.set('shandal_quarry_corners', corners); SH.store.set('shandal_quarry_beds', beds); cornersUI(); bedsUI(); run();
  });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Process the data first.', 'عالج البيانات أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (last) { drawPlan(last); } });
  SH.$$('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { SH.svgPng($('#' + b.getAttribute('data-svg')), 'shandal-' + b.getAttribute('data-svg') + '.png', 2); }); });
  cornersUI(); bedsUI();
})();
