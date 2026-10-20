/* Quarry & earthworks survey — volumes, UTM corners, plan, satellite view, pit-face column, assessment narrative. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var GOVS = [['Baghdad', 'بغداد'], ['Basra', 'البصرة'], ['Nineveh', 'نينوى'], ['Erbil', 'أربيل'], ['Najaf', 'النجف الأشرف'], ['Karbala', 'كربلاء المقدسة'], ['Kirkuk', 'كركوك'], ['Anbar', 'الأنبار'], ['Diyala', 'ديالى'], ['Dhi Qar', 'ذي قار'], ['Sulaymaniyah', 'السليمانية'], ['Babil', 'بابل'], ['Maysan', 'ميسان'], ['Wasit', 'واسط'], ['Salah al-Din', 'صلاح الدين'], ['Qadisiyyah', 'الديوانية'], ['Muthanna', 'المثنى'], ['Duhok', 'دهوك'], ['Halabja', 'حلبجة']];
  var ST = SH.strat, LITH = ST.R;
  var ln = function (k) { return ST.name(k) || k; };
  var corners = SH.store.get('shandal_quarry_corners', [null, null, null, null]);
  var beds = SH.store.get('shandal_quarry_beds', [{ rock: 'topsoil', th: 0.5 }, { rock: 'clay', th: 1 }, { rock: 'sand', th: 2, sec: 'gravel', mix: 'mixed' }]);
  beds.forEach(function (b) { if (!LITH[b.rock]) b.rock = 'limestone'; if (b.sec && !LITH[b.sec]) b.sec = ''; });
  var persist = SH.persist('quarry', ['geoName', 'qSite', 'qCountry', 'qGov', 'qReg', 'qDunam', 'qArea', 'qVol', 'qMaxD', 'qL', 'qW', 'qD', 'qVarOther', 'qLab', 'qGw', 'qRehab', 'qColInv', 'qColRem', 'qFace', 'qWt']);
  var map, mapLayer, last = null;

  $('#qGov').innerHTML = GOVS.map(function (g) { return '<option value="' + g[0] + '">' + g[SH.lang === 'ar' ? 1 : 0] + '</option>'; }).join('');
  var sv = SH.store.get('shandal_tool_quarry', {}); if (sv.qGov) $('#qGov').value = sv.qGov;
  function country() { var iq = SH.val('qCountry') === 'iq'; $('#qGovWrap').hidden = !iq; $('#qRegWrap').hidden = iq; }
  $('#qCountry').addEventListener('change', country); country();
  $('#qDunam').addEventListener('input', function () { var v = SH.num('qDunam'); $('#qArea').value = v > 0 ? v * 2500 : ''; });
  $('#qArea').addEventListener('input', function () { var v = SH.num('qArea'); $('#qDunam').value = v > 0 ? +(v / 2500).toFixed(3) : ''; });

  /* ---------- corners */
  var capturing = {}, ctl = {};
  function zoneOf() { var c = corners.filter(Boolean)[0]; if (c) { var u = SH.toUTM(c.lat, c.lon); return { z: u.zone, s: c.lat < 0, band: u.band }; } return { z: 38, s: false, band: 'S' }; }
  var accCls = function (a) { return a == null ? 'mute' : a <= 5 ? 'ok' : a <= 15 ? 'warn' : 'bad'; };
  function cornersUI() {
    var Z = zoneOf(), inp = 'class="ltr" style="height:38px;border:1px solid var(--line-2);border-radius:8px;padding:0 10px;background:var(--bg);color:var(--text);font:inherit;font-size:.86rem;width:100%"';
    $('#qCorners').innerHTML = ['A', 'B', 'C', 'D'].map(function (k, i) {
      var c = corners[i], u = c ? SH.toUTM(c.lat, c.lon, Z.z) : null, cap = capturing[i];
      return '<div style="border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px" data-card="' + i + '"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">' + k + '</b>' +
        (c && c.acc != null ? '<span class="badge ' + accCls(c.acc) + ' ltr">± ' + SH.fmt(c.acc, c.acc < 10 ? 1 : 0) + ' m</span>' + (c.n ? '<span class="xsmall muted">' + c.n + t(' readings', ' قراءة') + '</span>' : '') : '<span class="small muted">' + (c ? t('Entered manually', 'أُدخل يدوياً') : t('Not captured', 'لم يُلتقط')) + '</span>') +
        '<span style="flex:1"></span>' + (cap ? '<button class="btn btn-line btn-xs" type="button" data-stop="' + i + '">' + t('Stop', 'إيقاف') + '</button>' : '<button class="btn btn-ink btn-xs" type="button" data-gps="' + i + '">' + (c && c.acc != null ? t('Improve GPS', 'حسّن الدقة') : 'GPS') + '</button>') + '</div>' +
        (cap ? '<div class="xsmall" id="qCap' + i + '" style="background:var(--surface-2);border-radius:8px;padding:8px 10px;line-height:1.7">' + t('Listening to the satellites…', 'جارٍ الاستماع إلى الأقمار الصناعية…') + '</div>' : '') +
        '<div class="row2"><label class="xsmall muted" style="display:grid;gap:3px">' + t('Easting E (m)', 'الشرقيات E (م)') + '<input ' + inp + ' data-e="' + i + '" inputmode="decimal" value="' + (u ? u.E.toFixed(2) : '') + '"></label><label class="xsmall muted" style="display:grid;gap:3px">' + t('Northing N (m)', 'الشماليات N (م)') + '<input ' + inp + ' data-n="' + i + '" inputmode="decimal" value="' + (u ? u.N.toFixed(2) : '') + '"></label></div>' +
        '<div class="xsmall muted ltr" style="text-align:start">UTM ' + Z.z + (Z.s ? 'S' : 'N') + ' · WGS 84' + (c ? ' · ' + c.lat.toFixed(6) + '°, ' + c.lon.toFixed(6) + '°' + (c.alt != null ? ' · h ' + SH.fmt(c.alt, 1) + ' m' : '') : '') + '</div></div>';
    }).join('') + '<p class="xsmall muted" style="margin:0;line-height:1.7">' + t('Each capture listens for up to 45 s and averages the best readings. Press again to add more readings: the result only replaces the stored corner when it is more accurate. For survey-grade work use a phone or GNSS receiver outdoors with a clear sky; desktop browsers only estimate an approximate position.', 'كل التقاط يستمع حتى 45 ثانية ويأخذ متوسط أفضل القراءات. اضغط مجدداً لإضافة قراءات: لا تحل النتيجة محل الركن المحفوظ إلا إذا كانت أدق. للعمل المساحي استخدم هاتفاً أو جهاز GNSS في مكان مكشوف على السماء؛ متصفحات الحاسوب المكتبي تقدّر موقعاً تقريبياً فقط.') + '</p>';
  }
  $('#qCorners').addEventListener('click', function (e) {
    var st = e.target.closest('[data-stop]'); if (st) { var j = +st.getAttribute('data-stop'); ctl[j] && ctl[j].stop && ctl[j].stop(); return; }
    var b = e.target.closest('[data-gps]'); if (!b) return; var i = +b.getAttribute('data-gps'); capturing[i] = true; ctl[i] = {}; cornersUI();
    var prev = corners[i] && corners[i].fixes ? corners[i] : (corners[i] && corners[i].acc != null ? corners[i] : null), before = prev ? prev.acc : null;
    SH.gpsFix({ ms: 45000, target: 3, prev: prev, control: ctl[i], onUpdate: function (r) { var el = $('#qCap' + i); if (!el) return;
      el.innerHTML = r.waiting ? t('Waiting for the first satellite fix… ', 'بانتظار أول إرسال من الأقمار الصناعية… ') + '<span class="ltr">' + Math.round(r.elapsed) + ' s</span>' :
        '<b class="ltr">± ' + SH.fmt(r.acc, r.acc < 10 ? 1 : 0) + ' m</b> · ' + r.n + t(' readings · ', ' قراءة · ') + r.used + t(' averaged', ' في المتوسط') + ' · <span class="ltr">' + Math.round(r.elapsed) + ' / ' + Math.round(r.ms / 1000) + ' s</span><div style="height:4px;border-radius:2px;background:var(--line);margin-top:6px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.min(100, r.elapsed / r.ms * 100) + '%;background:var(--accent)"></i></div>'; } })
      .then(function (p) {
        capturing[i] = false; var improved = before == null || p.acc < before - 0.05; corners[i] = { lat: p.lat, lon: p.lon, acc: p.acc, n: p.n, alt: p.alt, fixes: (p.fixes || []).slice(-80), t: Date.now() };
        SH.store.set('shandal_quarry_corners', corners); cornersUI();
        SH.toast(before == null ? t('Corner ', 'الركن ') + 'ABCD'[i] + t(' captured: ±', ' التُقط: ±') + SH.fmt(p.acc, 1) + ' m' : improved ? t('Accuracy improved from ±', 'تحسنت الدقة من ±') + SH.fmt(before, 1) + t(' to ±', ' إلى ±') + SH.fmt(p.acc, 1) + ' m' : t('No better reading this time; the stored ±', 'لم تُلتقط قراءة أفضل هذه المرة؛ بقيت الدقة المحفوظة ±') + SH.fmt(before, 1) + t(' m fix is kept, now averaged over more readings.', ' م مع متوسط قراءات أكثر.'), improved || before == null ? 'ok' : 'warn');
      }).catch(function (er) { capturing[i] = false; SH.toast(er.message, 'bad'); cornersUI(); });
  });
  $('#qCorners').addEventListener('change', function (e) {
    var i = e.target.getAttribute('data-e') || e.target.getAttribute('data-n'); if (i == null) return; i = +i; var Z = zoneOf();
    var E = parseFloat($('[data-e="' + i + '"]').value), N = parseFloat($('[data-n="' + i + '"]').value);
    if (isFinite(E) && isFinite(N) && E > 100000 && E < 900000 && N > 0 && N < 10000000) { var ll = SH.fromUTM(E, N, Z.z, Z.s); corners[i] = { lat: ll.lat, lon: ll.lon }; SH.store.set('shandal_quarry_corners', corners); cornersUI(); }
    else if ($('[data-e="' + i + '"]').value && $('[data-n="' + i + '"]').value) SH.toast(t('Easting must be 100 000–900 000 m and northing 0–10 000 000 m.', 'يجب أن تكون الشرقيات بين 100000 و900000 م والشماليات بين 0 و10000000 م.'), 'warn');
  });

  /* ---------- beds editor */
  var opts = function (sel) { return ST.GROUPS.map(function (g) { return '<optgroup label="' + SH.esc(g[SH.lang === 'ar' ? 2 : 1]) + '">' + Object.keys(LITH).filter(function (k) { return LITH[k][5] === g[0]; }).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + ln(k) + '</option>'; }).join('') + '</optgroup>'; }).join(''); };
  var gsOpts = function (sel) { var n = [t('clay', 'طين'), t('silt', 'غرين'), t('very fine sand', 'رمل ناعم جداً'), t('fine sand', 'رمل ناعم'), t('medium sand', 'رمل متوسط'), t('coarse sand', 'رمل خشن'), t('very coarse sand', 'رمل خشن جداً'), t('gravel / crystalline', 'حصى / متبلور')];
    return '<option value="">' + t('Texture: typical for the rock', 'النسيج: النموذجي للصخر') + '</option>' + n.map(function (x, i) { return '<option value="' + i + '"' + (String(sel) === String(i) ? ' selected' : '') + '>' + ST.GS[i] + ' · ' + x + '</option>'; }).join(''); };
  var ctOpts = function (sel) { return Object.keys(ST.CONTACTS).map(function (k) { return '<option value="' + k + '"' + ((sel || 'sharp') === k ? ' selected' : '') + '>' + t('Base: ', 'القاعدة: ') + ST.CONTACTS[k][SH.lang === 'ar' ? 1 : 0] + '</option>'; }).join(''); };
  function bedsUI() {
    var top = 0;
    $('#qBeds').innerHTML = beds.map(function (b, i) {
      var st = b.st || [], chips = Object.keys(ST.STRUCT).map(function (k) { return '<label class="chk" style="font-size:.78rem"><input type="checkbox" data-st="' + k + '"' + (st.indexOf(k) > -1 ? ' checked' : '') + '> ' + ST.STRUCT[k][SH.lang === 'ar' ? 1 : 0] + '</label>'; }).join('');
      var html = '<div style="border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px" data-bed="' + i + '"><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;border:1px solid #555;background:' + (LITH[b.rock] ? LITH[b.rock][2] : '#ccc') + '"></span><b class="small">' + t('Bed ', 'الطبقة ') + (i + 1) + '</b><span class="xsmall muted ltr">' + SH.fmt(top, 2) + '–' + SH.fmt(top + (b.th || 0), 2) + ' m</span><button class="x" style="margin-inline-start:auto" type="button" data-delbed="' + i + '" aria-label="' + t('Delete', 'حذف') + '">✕</button></div>' +
        '<div class="row2"><div class="fg"><select data-f="rock">' + opts(b.rock) + '</select></div><div class="fg"><input type="number" step="0.05" min="0.05" data-f="th" value="' + (b.th || '') + '" placeholder="' + t('Thickness m', 'السمك م') + '"></div></div>' +
        '<div class="row2"><div class="fg"><select data-f="sec"><option value="">' + t('No secondary rock', 'بلا صخر ثانوي') + '</option>' + opts(b.sec) + '</select></div><div class="fg"><select data-f="mix"><option value="mixed"' + (b.mix === 'mixed' ? ' selected' : '') + '>' + t('Mixed', 'مختلط') + '</option><option value="inter"' + (b.mix === 'inter' ? ' selected' : '') + '>' + t('Interbedded', 'متعاقب') + '</option></select></div></div>' +
        '<div class="row2"><div class="fg"><select data-f="gs">' + gsOpts(b.gs) + '</select></div><div class="fg"><select data-f="base">' + ctOpts(b.base) + '</select></div></div>' +
        '<details' + (st.length || b.desc || b.col ? ' open' : '') + '><summary class="small" style="cursor:pointer;font-weight:700">' + t('Colour, description, structures and fossils', 'اللون والوصف والتراكيب والأحافير') + (st.length ? ' · ' + st.length : '') + '</summary><div style="display:grid;gap:8px;margin-top:8px">' +
        '<div class="fg"><input data-f="col" value="' + SH.esc(b.col || '') + '" placeholder="' + t('Colour, e.g. pale yellowish brown (10YR 6/2)', 'اللون، مثل بني مصفر فاتح (10YR 6/2)') + '"></div>' +
        '<div class="fg"><textarea data-f="desc" rows="2" style="min-height:58px" placeholder="' + t('Field description: sorting, hardness, cement, bedding thickness…', 'الوصف الحقلي: الفرز، الصلابة، المادة اللاحمة، سمك التطبق…') + '">' + SH.esc(b.desc || '') + '</textarea></div>' +
        '<div class="chks" style="display:flex;flex-wrap:wrap;gap:4px 12px">' + chips + '</div></div></details></div>';
      top += b.th || 0; return html;
    }).join('');
  }
  $('#qBeds').addEventListener('change', function (e) {
    var box = e.target.closest('[data-bed]'); if (!box) return; var i = +box.getAttribute('data-bed'), f = e.target.getAttribute('data-f'), s = e.target.getAttribute('data-st');
    if (s) { var a = beds[i].st || []; if (e.target.checked) { if (a.indexOf(s) < 0) a.push(s); } else a = a.filter(function (x) { return x !== s; }); beds[i].st = a; SH.store.set('shandal_quarry_beds', beds); return; }
    if (!f) return; beds[i][f] = f === 'th' ? parseFloat(e.target.value) || 0 : e.target.value; SH.store.set('shandal_quarry_beds', beds); if (f !== 'desc' && f !== 'col') bedsUI();
  });
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
    planSheet(r); siteSheet(r); column(r); logTable(r); drawMap(); narrative(r); summaries(r);
  }

  /* ---------- shared sheet helpers: neat line, north arrow, legend box, graphic scale */
  var INK = '#1B232B', MUT = '#55616B';
  function sheetText(S, x, y, s, a, xr) { a = a || {}; if (/[؀-ۿ]/.test(String(s)) && xr != null) { a.direction = 'rtl'; a['text-anchor'] = 'start'; return S.text(xr, y, s, a); } return S.text(x, y, s, a); }
  function niceFloor(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; }
  function panel(S, PX, PY, PW, PH, sc, rot, items, extraRows) {
    S.add('rect', { x: PX, y: PY, width: PW, height: PH, fill: '#fff', stroke: INK, 'stroke-width': 1 }); var L0 = PX + 14, R0 = PX + PW - 14, y = PY + 22, cx = PX + PW / 2;
    var g = S.g({ transform: 'rotate(' + (rot || 0) + ' ' + cx + ' ' + (y + 28) + ')' }); S.text(cx, y, 'N', { 'font-size': 15, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' }, g);
    S.path('M' + cx + ' ' + (y + 6) + 'L' + (cx - 12) + ' ' + (y + 54) + 'L' + cx + ' ' + (y + 44) + 'z', { fill: INK, stroke: INK }, g); S.path('M' + cx + ' ' + (y + 6) + 'L' + (cx + 12) + ' ' + (y + 54) + 'L' + cx + ' ' + (y + 44) + 'z', { fill: '#fff', stroke: INK }, g);
    y += 74; S.line(PX, y, PX + PW, y, { stroke: INK, 'stroke-width': .7 }); y += 20;
    S.text(L0, y, 'LEGEND', { 'font-size': 11.5, 'font-weight': 800, fill: INK, 'letter-spacing': 1.6 }); if (SH.lang === 'ar') S.text(R0, y, 'مفتاح المخطط', { 'font-size': 11, 'font-weight': 700, fill: MUT, direction: 'rtl', 'text-anchor': 'start' }); y += 20;
    items.forEach(function (it) { it.sym(L0, y); sheetText(S, L0 + 40, y + 4, it.label, { 'font-size': 10.5, fill: INK }, R0); y += 22; });
    (extraRows || []).forEach(function (rw) { sheetText(S, L0, y + 4, rw[0], { 'font-size': 10.5, fill: MUT }, R0); S.text(SH.lang === 'ar' ? L0 : R0, y + 4, rw[1], { 'font-size': 10.5, 'font-weight': 800, fill: INK, direction: 'ltr', 'text-anchor': SH.lang === 'ar' ? 'start' : 'end' }); y += 18; });
    y += 6; S.line(PX, y, PX + PW, y, { stroke: INK, 'stroke-width': .7 }); y += 20;
    S.text(L0, y, 'SCALE', { 'font-size': 11.5, 'font-weight': 800, fill: INK, 'letter-spacing': 1.6 }); if (SH.lang === 'ar') S.text(R0, y, 'مقياس الرسم', { 'font-size': 11, 'font-weight': 700, fill: MUT, direction: 'rtl', 'text-anchor': 'start' }); y += 16;
    var sbm = niceFloor((PW - 60) / sc), sbw = sbm * sc; for (var q = 0; q < 4; q++) S.add('rect', { x: L0 + 6 + q * sbw / 4, y: y, width: sbw / 4, height: 7, fill: q % 2 ? '#fff' : INK, stroke: INK, 'stroke-width': .8 });
    [0, 2, 4].forEach(function (q) { S.text(L0 + 6 + q * sbw / 4, y + 21, SH.fmt(sbm * q / 4, sbm < 4 ? 1 : 0), { 'font-size': 9.5, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }); S.text(L0 + 14 + sbw, y + 8, 'm', { 'font-size': 10, 'font-weight': 700, fill: INK });
    y += 40; var rf = 1000 / (sc * 0.247), rfn = Math.pow(10, Math.floor(Math.log10(rf)) - 1); S.text(L0, y, '1 : ' + SH.fmt(Math.round(rf / rfn) * rfn, 0), { 'font-size': 11, 'font-weight': 800, fill: INK, direction: 'ltr' }); S.text(R0, y, t('on A4 landscape', 'على A4 أفقي'), { 'font-size': 9, fill: MUT, 'text-anchor': 'end' });
    return y;
  }
  function frameAxes(S, ox, oy, W, H, sc, xMax, yMax, xName, yName) {
    var st = SH.dem && SH.dem.niceInterval ? SH.dem.niceInterval(Math.max(xMax, yMax), 6) : 10, v;
    for (v = 0; v <= xMax + 1e-9; v += st) { var px = ox + v * sc; S.line(px, oy + H, px, oy + H + 6, { stroke: INK }); S.line(px, oy, px, oy + H, { stroke: INK, 'stroke-width': .4, opacity: .25, 'stroke-dasharray': '3 4' }); S.text(px, oy + H + 19, SH.fmt(v, 0), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    for (v = 0; v <= yMax + 1e-9; v += st) { var py = oy + H - v * sc; S.line(ox - 6, py, ox, py, { stroke: INK }); S.line(ox, py, ox + W, py, { stroke: INK, 'stroke-width': .4, opacity: .25, 'stroke-dasharray': '3 4' }); S.text(ox - 9, py + 4, SH.fmt(v, 0), { 'font-size': 10, fill: MUT, 'text-anchor': 'end', direction: 'ltr' }); }
    S.text(ox + W / 2, oy + H + 40, xName, { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' }); S.text(ox - 46, oy + H / 2, yName, { 'font-size': 11, fill: MUT, 'text-anchor': 'middle', transform: 'rotate(-90 ' + (ox - 46) + ' ' + (oy + H / 2) + ')' });
  }
  function hatch(S, defs, id, col, ang, gap) { var P = S.add('pattern', { id: id, width: gap || 10, height: gap || 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(' + (ang || 45) + ')' }, null, defs); S.add('rect', { x: 0, y: 0, width: gap || 10, height: gap || 10, fill: SH.alpha(col, .28) }, null, P); S.add('line', { x1: 0, y1: 0, x2: 0, y2: gap || 10, stroke: col, 'stroke-width': 1.3 }, null, P); return 'url(#' + id + ')'; }

  /* ---------- 2D plan: contract rectangle, worked and remaining parts, dimensions and percentages */
  function planSheet(r) {
    var S = SH.svgB('qPlan'), defs = S.add('defs', {}), inv = SH.val('qColInv') || '#C0603A', rem = SH.val('qColRem') || '#5D9C6B', VW = 1000, VH = 620; S.el.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    S.add('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#fff' }); S.add('rect', { x: 8, y: 8, width: VW - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    var totW = r.Wm, totL = r.A > 0 ? r.A / r.Wm : r.Lm; if (!(totL > 0)) totL = r.Lm; var Lx = Math.max(totL, r.Lm);
    sheetText(S, 30, 42, t('2D plan of worked and remaining areas', 'المرتسم الثنائي للمساحات المستثمرة والمتبقية'), { 'font-size': 19, 'font-weight': 800, fill: INK }, 700);
    sheetText(S, 30, 63, (SH.val('qSite') || t('Quarry', 'المقلع')) + ' · ' + t('local grid in metres, origin at the worked corner', 'شبكة محلية بالأمتار، أصلها عند ركن الاستثمار'), { 'font-size': 12, fill: MUT }, 700);
    var PW = 236, ml = 92, mt = 96, mb = 78, bw = VW - ml - PW - 60, bh = VH - mt - mb, sc = Math.min(bw / Lx, bh / totW), W = Lx * sc, H = totW * sc, ox = ml + (bw - W) / 2, oy = mt + (bh - H) / 2;
    frameAxes(S, ox, oy, W, H, sc, Lx, totW, t('Length along the contract (m)', 'الطول على امتداد العقد (م)'), t('Width (m)', 'العرض (م)'));
    if (totL > r.Lm) S.add('rect', { x: ox + r.Lm * sc, y: oy, width: (totL - r.Lm) * sc, height: H, fill: hatch(S, defs, 'hRem', rem, -45, 12), stroke: rem, 'stroke-width': 1.6 });
    S.add('rect', { x: ox, y: oy, width: Math.min(r.Lm, Lx) * sc, height: H, fill: hatch(S, defs, 'hInv', inv, 45, 9), stroke: inv, 'stroke-width': 2 });
    if (r.Lm > totL) S.add('rect', { x: ox + totL * sc, y: oy, width: (r.Lm - totL) * sc, height: H, fill: '#B23A2E', opacity: .22 });
    S.add('rect', { x: ox, y: oy, width: totL * sc, height: H, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-dasharray': '10 5' });
    var lab = function (x, y, a, b, c) { var g = S.g(); S.add('rect', { x: x - 78, y: y - 30, width: 156, height: 58, rx: 8, fill: '#fff', opacity: .92, stroke: INK, 'stroke-width': .6 }, null, g); S.text(x, y - 11, a, { 'font-size': 13, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' }, g); S.text(x, y + 6, b, { 'font-size': 11.5, fill: INK, 'text-anchor': 'middle', direction: 'ltr' }, g); S.text(x, y + 21, c, { 'font-size': 12, 'font-weight': 800, fill: '#B4552D', 'text-anchor': 'middle', direction: 'ltr' }, g); };
    var pI = isNaN(r.pctA) ? '' : SH.fmt(r.pctA, 1) + ' %', pR = isNaN(r.pctA) ? '' : SH.fmt(100 - r.pctA, 1) + ' %';
    if (r.Lm * sc > 120) lab(ox + Math.min(r.Lm, Lx) * sc / 2, oy + H / 2, t('Worked', 'المستثمرة'), SH.fmt(r.invA, 0) + ' m²', pI);
    if (totL > r.Lm && (totL - r.Lm) * sc > 120) lab(ox + r.Lm * sc + (totL - r.Lm) * sc / 2, oy + H / 2, t('Remaining', 'المتبقية'), SH.fmt(r.remA, 0) + ' m²', pR);
    var dim = function (x1, y1, x2, y2, s, vert) { S.line(x1, y1, x2, y2, { stroke: INK, 'stroke-width': 1 }); [[x1, y1, x2, y2], [x2, y2, x1, y1]].forEach(function (q) { var an = Math.atan2(q[3] - q[1], q[2] - q[0]); S.poly([[q[0], q[1]], [q[0] + 8 * Math.cos(an - .35), q[1] + 8 * Math.sin(an - .35)], [q[0] + 8 * Math.cos(an + .35), q[1] + 8 * Math.sin(an + .35)]], { fill: INK }); });
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2; S.add('rect', { x: mx - 44, y: my - 9, width: 88, height: 17, fill: '#fff' }); S.text(mx, my + 4, s, { 'font-size': 10.5, fill: INK, 'text-anchor': 'middle', direction: 'ltr', 'font-weight': 700 }); };
    dim(ox, oy - 18, ox + r.Lm * sc, oy - 18, 'L = ' + SH.fmt(r.Lm, 1) + ' m'); if (Math.abs(totL - r.Lm) > .01) dim(ox, oy - 40, ox + totL * sc, oy - 40, t('Contract ', 'العقد ') + SH.fmt(totL, 1) + ' m');
    dim(ox + W + 18, oy, ox + W + 18, oy + H, 'W = ' + SH.fmt(totW, 1) + ' m');
    var PX = VW - PW - 24; panel(S, PX, mt - 30, PW, VH - mt - 10, sc, 0, [
      { sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: 'url(#hInv)', stroke: inv, 'stroke-width': 1.5 }); }, label: t('Worked (excavated) area', 'المساحة المستثمرة (المحفورة)') },
      { sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: 'url(#hRem)', stroke: rem, 'stroke-width': 1.5 }); }, label: t('Remaining contract area', 'المساحة المتبقية من العقد') },
      { sym: function (x, y) { S.line(x, y, x + 30, y, { stroke: INK, 'stroke-width': 2.2, 'stroke-dasharray': '10 5' }); }, label: t('Contract boundary', 'حدود العقد') }].concat(r.Lm > totL ? [{ sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: '#B23A2E', opacity: .3 }); }, label: t('Beyond the contract', 'خارج حدود العقد') }] : []),
      [[t('Contract area', 'مساحة العقد'), SH.fmt(r.A, 0) + ' m²'], [t('Worked depth', 'عمق الاستثمار'), SH.fmt(r.Dm, 1) + ' m'], [t('Extracted', 'المستخرج'), SH.fmt(r.extV, 0) + ' m³']]);
    S.text(30, VH - 22, 'Shandal System · ' + new Date().toISOString().slice(0, 10), { 'font-size': 10, fill: MUT }); S.text(PX - 14, VH - 22, t('North arrow is schematic: the plan is drawn from tape lengths, not oriented coordinates.', 'سهم الشمال تخطيطي: المرتسم مبني على أطوال الشريط لا على إحداثيات موجهة.'), { 'font-size': 9.5, fill: MUT, 'text-anchor': 'end' });
    $('#qPlanCap').innerHTML = t('Contract rectangle ', 'مستطيل العقد ') + '<span class="ltr">' + SH.fmt(totL, 1) + ' × ' + SH.fmt(totW, 1) + ' m</span>' + t(' built on the worked width. ', ' مبني على العرض المستثمر. ') + (isNaN(r.pctA) ? '' : t('Worked share ', 'نسبة الاستثمار ') + '<b class="ltr">' + SH.fmt(r.pctA, 1) + ' %</b>' + t(', remaining ', '، والمتبقي ') + '<b class="ltr">' + SH.fmt(100 - r.pctA, 1) + ' %</b>. ') + t('For the true shape and orientation see the GPS site plan.', 'للشكل والاتجاه الحقيقيين راجع مخطط الموقع من GPS.');
  }

  /* ---------- site plan from GPS corners: true geometry in UTM with sides, bearings and area */
  function siteSheet(r) {
    var pts = corners.map(function (c, i) { return c ? { c: c, k: 'ABCD'[i] } : null; }).filter(Boolean); $('#qSiteWrap').hidden = pts.length < 3; if (pts.length < 3) return;
    var z = SH.toUTM(pts[0].c.lat, pts[0].c.lon).zone, P = pts.map(function (p) { var u = SH.toUTM(p.c.lat, p.c.lon, z); return { x: u.E, y: u.N, k: p.k, acc: p.c.acc }; });
    var S = SH.svgB('qSitePlan'), defs = S.add('defs', {}), VW = 1000, VH = 620, inv = SH.val('qColInv') || '#C0603A'; S.add('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#fff' }); S.add('rect', { x: 8, y: 8, width: VW - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    sheetText(S, 30, 42, t('Site plan from GPS corners', 'مخطط الموقع من أركان GPS'), { 'font-size': 19, 'font-weight': 800, fill: INK }, 700); S.text(30, 63, 'WGS 84 / UTM ' + z + (pts[0].c.lat < 0 ? 'S' : 'N') + ' · ' + (SH.val('qSite') || ''), { 'font-size': 12, fill: MUT, direction: 'ltr' });
    var xs = P.map(function (p) { return p.x; }), ys = P.map(function (p) { return p.y; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = Math.max(x1 - x0, y1 - y0) * 0.18 + 5;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad; var PW = 236, ml = 110, mt = 96, mb = 78, bw = VW - ml - PW - 60, bh = VH - mt - mb, sc = Math.min(bw / (x1 - x0), bh / (y1 - y0)), W = (x1 - x0) * sc, H = (y1 - y0) * sc, ox = ml + (bw - W) / 2, oy = mt + (bh - H) / 2;
    var X = function (x) { return ox + (x - x0) * sc; }, Y = function (y) { return oy + (y1 - y) * sc; };
    var st = SH.dem && SH.dem.niceInterval ? SH.dem.niceInterval(Math.max(x1 - x0, y1 - y0), 5) : 20, v;
    for (v = Math.ceil(x0 / st) * st; v <= x1; v += st) { S.line(X(v), oy, X(v), oy + H, { stroke: INK, 'stroke-width': .4, opacity: .3, 'stroke-dasharray': '3 4' }); S.line(X(v), oy + H, X(v), oy + H + 6, { stroke: INK }); S.text(X(v), oy + H + 19, SH.fmt(v, 0, { nogroup: true }), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    for (v = Math.ceil(y0 / st) * st; v <= y1; v += st) { S.line(ox, Y(v), ox + W, Y(v), { stroke: INK, 'stroke-width': .4, opacity: .3, 'stroke-dasharray': '3 4' }); S.line(ox - 6, Y(v), ox, Y(v), { stroke: INK }); S.text(ox - 9, Y(v) + 4, SH.fmt(v, 0, { nogroup: true }), { 'font-size': 10, fill: MUT, 'text-anchor': 'end', direction: 'ltr' }); }
    S.add('rect', { x: ox, y: oy, width: W, height: H, fill: 'none', stroke: INK, 'stroke-width': 1.3 }); S.text(ox + W / 2, oy + H + 40, 'Easting (m)', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' }); S.text(ox - 82, oy + H / 2, 'Northing (m)', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle', transform: 'rotate(-90 ' + (ox - 82) + ' ' + (oy + H / 2) + ')' });
    S.poly(P.map(function (p) { return [X(p.x), Y(p.y)]; }), { fill: hatch(S, defs, 'hSite', inv, 45, 9), stroke: inv, 'stroke-width': 2.2 });
    var area = 0, per = 0, sides = [];
    P.forEach(function (p, i) { var q = P[(i + 1) % P.length], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), az = (SH.deg(Math.atan2(dx, dy)) + 360) % 360; area += p.x * q.y - q.x * p.y; per += d; sides.push([p.k + q.k, d, az]);
      var mx = (X(p.x) + X(q.x)) / 2, my = (Y(p.y) + Y(q.y)) / 2, an = SH.deg(Math.atan2(Y(q.y) - Y(p.y), X(q.x) - X(p.x))); if (an > 90) an -= 180; if (an < -90) an += 180;
      S.text(mx, my - 6, SH.fmt(d, 1) + ' m · ' + SH.fmt(az, 0) + '°', { 'font-size': 10.5, 'font-weight': 700, fill: INK, 'text-anchor': 'middle', direction: 'ltr', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', transform: 'rotate(' + an.toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1) + ')' }); });
    area = Math.abs(area) / 2;
    P.forEach(function (p) { if (p.acc) S.circle(X(p.x), Y(p.y), Math.max(3, p.acc * sc), { fill: SH.alpha('#1F6FB2', .12), stroke: '#1F6FB2', 'stroke-width': .8, 'stroke-dasharray': '3 2' }); S.circle(X(p.x), Y(p.y), 5, { fill: '#fff', stroke: INK, 'stroke-width': 2 }); S.text(X(p.x) + 9, Y(p.y) - 9, p.k, { 'font-size': 14, 'font-weight': 800, fill: INK, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }); });
    var PX = VW - PW - 24, yy = panel(S, PX, mt - 30, PW, VH - mt - 10, sc, 0, [
      { sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: 'url(#hSite)', stroke: inv, 'stroke-width': 1.5 }); }, label: t('Surveyed outline', 'الحدود المرصودة') },
      { sym: function (x, y) { S.circle(x + 15, y, 5, { fill: '#fff', stroke: INK, 'stroke-width': 2 }); }, label: t('GPS corner', 'ركن GPS') },
      { sym: function (x, y) { S.circle(x + 15, y, 8, { fill: SH.alpha('#1F6FB2', .12), stroke: '#1F6FB2', 'stroke-dasharray': '3 2' }); }, label: t('Horizontal accuracy (±σ)', 'الدقة الأفقية (±σ)') }],
      [[t('Area', 'المساحة'), SH.fmt(area, 0) + ' m²'], [t('Perimeter', 'المحيط'), SH.fmt(per, 1) + ' m'], [t('Area (dunam)', 'المساحة (دونم)'), SH.fmt(area / 2500, 3)]]);
    S.text(30, VH - 22, 'Shandal System · ' + new Date().toISOString().slice(0, 10), { 'font-size': 10, fill: MUT });
    $('#qSiteCap').innerHTML = t('True outline from the corner coordinates in UTM. Each side is labelled with its length and grid bearing (clockwise from grid north). Shoelace area ', 'الحدود الحقيقية من إحداثيات الأركان بنظام UTM. كل ضلع موسوم بطوله واتجاهه الشبكي (باتجاه عقارب الساعة من شمال الشبكة). مساحة المضلع ') + '<b class="ltr">' + SH.fmt(area, 0) + ' m²</b>' + (r.invA ? t(' against ', ' مقابل ') + '<b class="ltr">' + SH.fmt(r.invA, 0) + ' m²</b>' + t(' from tape length × width (', ' من الطول × العرض بالشريط (') + '<span class="ltr">' + SH.fmt(100 * (area - r.invA) / r.invA, 1) + ' %</span>).' : '.');
  }

  /* ---------- stratigraphic column and bed log */
  function column(r) {
    var place = SH.val('qCountry') === 'iq' ? t('Iraq, ', 'العراق، ') + SH.selText('qGov') : (SH.val('qReg') || ''), c0 = corners.filter(Boolean)[0], u = c0 ? SH.toUTM(c0.lat, c0.lon) : null;
    ST.render($('#qCol'), r.beds, { title: t('Stratigraphic column of the pit face', 'العمود الطباقي لواجهة المقلع') + (SH.val('qSite') ? ' — ' + SH.val('qSite') : ''),
      meta: [place + (u ? ' · UTM ' + u.zone + u.band + ' E ' + u.E.toFixed(0) + ' N ' + u.N.toFixed(0) : ''), t('Logged by ', 'سجّلها ') + (SH.val('geoName') || '—') + ' · ' + new Date().toISOString().slice(0, 10) + ' · ' + t('total thickness ', 'السمك الكلي ') + SH.fmt(r.bedsTotal, 2) + ' m'],
      faceAz: SH.val('qFace') === '' ? null : SH.num('qFace'), pitFloor: r.Dm, water: SH.num('qWt'), credit: 'Shandal System', source: t('Field log', 'سجل حقلي') });
  }
  function logTable(r) {
    var top = 0;
    $('#qLog').innerHTML = '<thead><tr><th>#</th><th class="num">' + t('From–to (m)', 'من–إلى (م)') + '</th><th class="num">' + t('Thick. (m)', 'السمك (م)') + '</th><th>' + t('Lithology', 'الصخارية') + '</th><th>' + t('Texture', 'النسيج') + '</th><th>' + t('Base contact', 'التماس السفلي') + '</th><th>' + t('Structures and fossils', 'التراكيب والأحافير') + '</th><th>' + t('Likely environment', 'البيئة المرجحة') + '</th><th>' + t('Excavatability', 'قابلية الحفر') + '</th></tr></thead><tbody>' +
      r.beds.map(function (b, i) { var dg = ST.dig(b), g = b.gs !== undefined && b.gs !== '' ? +b.gs : LITH[b.rock][4], row = '<tr><td><b>' + (i + 1) + '</b></td><td class="num">' + SH.fmt(top, 2) + '–' + SH.fmt(top + b.th, 2) + '</td><td class="num">' + SH.fmt(b.th, 2) + '</td><td><b>' + ln(b.rock) + '</b>' + (b.sec ? (b.mix === 'inter' ? t(' interbedded with ', ' متعاقب مع ') : t(' with ', ' مع ')) + ln(b.sec) : '') + (b.col ? '<div class="xsmall muted">' + SH.esc(b.col) + '</div>' : '') + (b.desc ? '<div class="xsmall">' + SH.esc(b.desc) + '</div>' : '') + '</td><td class="ltr">' + ST.GS[g] + '</td><td>' + ST.CONTACTS[b.base || 'sharp'][SH.lang === 'ar' ? 1 : 0] + '</td><td class="small">' + ((b.st || []).map(function (k) { return ST.STRUCT[k] ? ST.STRUCT[k][SH.lang === 'ar' ? 1 : 0] : ''; }).filter(Boolean).join('، ') || '—') + '</td><td class="small">' + ST.facies(b) + '</td><td><span class="badge ' + dg[1] + '">' + dg[0] + '</span></td></tr>'; top += b.th; return row; }).join('') + '</tbody>';
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
