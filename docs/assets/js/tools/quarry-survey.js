/* Quarry & earthworks survey — volumes, UTM corners, plan, satellite view, pit-face column, assessment narrative. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var GOVS = [['Baghdad', 'بغداد'], ['Basra', 'البصرة'], ['Nineveh', 'نينوى'], ['Erbil', 'أربيل'], ['Najaf', 'النجف الأشرف'], ['Karbala', 'كربلاء المقدسة'], ['Kirkuk', 'كركوك'], ['Anbar', 'الأنبار'], ['Diyala', 'ديالى'], ['Dhi Qar', 'ذي قار'], ['Sulaymaniyah', 'السليمانية'], ['Babil', 'بابل'], ['Maysan', 'ميسان'], ['Wasit', 'واسط'], ['Salah al-Din', 'صلاح الدين'], ['Qadisiyyah', 'الديوانية'], ['Muthanna', 'المثنى'], ['Duhok', 'دهوك'], ['Halabja', 'حلبجة']];
  var ST = SH.strat, LITH = ST.R;
  var ln = function (k) { return ST.name(k) || k; };
  var corners = SH.store.get('shandal_quarry_corners', [null, null, null, null]);
  var CC = 'AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT VA HN HK HU IS IN ID IR IE IM IT JM JP JE JO KZ KE KI KP KR XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(' ');
  (function () { var dn = null; try { dn = new Intl.DisplayNames([SH.lang], { type: 'region' }); } catch (e) {}
    var list = CC.map(function (c) { return [c.toLowerCase(), dn ? dn.of(c) : c]; }).sort(function (a, b) { return a[1].localeCompare(b[1], SH.lang); });
    $('#qCountry').insertAdjacentHTML('beforeend', list.map(function (c) { return '<option value="' + c[0] + '">' + SH.esc(c[1]) + '</option>'; }).join('')); })();
  var persist = SH.persist('quarry', ['geoName', 'qName', 'qSite', 'qCountry', 'qGov', 'qReg', 'qDunam', 'qArea', 'qVol', 'qMaxD', 'qL', 'qW', 'qD', 'qVarOther', 'qLab', 'qGw', 'qRehab', 'qColInv', 'qColRem', 'qFace', 'qWt']);
  var map, mapLayer, last = null;

  $('#qGov').innerHTML = GOVS.map(function (g) { return '<option value="' + g[0] + '">' + g[SH.lang === 'ar' ? 1 : 0] + '</option>'; }).join('');
  var sv = SH.store.get('shandal_tool_quarry', {}); if (sv.qGov) $('#qGov').value = sv.qGov;
  function country() { if (!$('#qCountry').value) $('#qCountry').value = 'iq'; var iq = SH.val('qCountry') === 'iq'; $('#qGovWrap').hidden = !iq; $('#qRegWrap').hidden = iq; }
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
  var bedEd = ST.editor($('#qBeds'), $('#qAddBed'), 'shandal_quarry_beds', [{ rock: 'topsoil', th: 0.5 }, { rock: 'clay', th: 1 }, { rock: 'sand', th: 2, sec: 'gravel', mix: 'mixed' }]);

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
    r.beds = bedEd.get().filter(function (b) { return b.rock && b.th > 0; }); r.bedsTotal = r.beds.reduce(function (a, b) { return a + b.th; }, 0);
    last = r; persist.save(); render(r);
  }
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  function render(r) {
    $('#qEmpty').hidden = true; $('#qOut').hidden = false;
    var overV = r.remV < 0, overA = r.remA < 0, overD = r.maxD > 0 && r.Dm > r.maxD;
    $('#qKpis').innerHTML = kpi(overV ? 'bad' : 'info', t('Extracted volume', 'الكمية المستخرجة'), SH.fmt(r.extV, 0) + '<small> m³</small>', isNaN(r.pctV) ? '' : '<bdi>' + SH.fmt(r.pctV, 1) + ' %</bdi>' + t(' of contract', ' من العقد')) +
      kpi(overV ? 'bad' : 'ok', t('Remaining volume', 'الكمية المتبقية'), SH.fmt(r.remV, 0) + '<small> m³</small>', overV ? t('Contract exceeded', 'تجاوز العقد') : t('Still available', 'متاحة')) +
      kpi(overA ? 'bad' : '', t('Worked area', 'المساحة المستثمرة'), SH.fmt(r.invA, 0) + '<small> m²</small>', SH.fmt(r.invA / 2500, 2) + t(' dunam', ' دونم') + (r.gpsA ? ' · <bdi>GPS ' + SH.fmt(r.gpsA, 0) + ' m²</bdi>' : '')) +
      kpi(overA ? 'bad' : 'ok', t('Remaining area', 'المساحة المتبقية'), SH.fmt(r.remA, 0) + '<small> m²</small>', isNaN(r.pctA) ? '' : '<bdi>' + SH.fmt(100 - r.pctA, 1) + ' %</bdi>' + t(' of contract', ' من العقد')) +
      kpi(overD ? 'bad' : 'ok', t('Worked depth', 'العمق المستثمر'), SH.fmt(r.Dm, 1) + '<small> m</small>', r.maxD > 0 ? t('Permitted ', 'المسموح ') + SH.fmt(r.maxD, 1) + t(' m', ' م') : t('No limit entered', 'لم يُدخل حد'));
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
  var INK = '#1B232B', MUT = '#55616B', AR = SH.lang === 'ar';
  var iso = function (s) { return String(s).replace(/\(?[A-Za-z0-9][A-Za-z0-9 .,:\/°′″±+\-×()–=²³]*[A-Za-z0-9°′″)²³]|[A-Za-z0-9]/g, function (m) { return '⁦' + m + '⁩'; }); };
  var hasAr = function (s) { return /[؀-ۿ]/.test(String(s)); };
  function sheetText(S, x, y, s, a, xr) { a = a || {}; if (hasAr(s)) { s = iso(s); a.direction = 'rtl'; if (xr != null) { a['text-anchor'] = 'start'; return S.text(xr, y, s, a); } } return S.text(x, y, s, a); }
  function niceFloor(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; }
  function niceCeil(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function panel(S, PX, PY, PW, PH, sc, items, extraRows) {
    S.add('rect', { x: PX, y: PY, width: PW, height: PH, fill: '#fff', stroke: INK, 'stroke-width': 1 }); var L0 = PX + 14, R0 = PX + PW - 14, y = PY + 22, cx = PX + PW / 2;
    S.text(cx, y, 'N', { 'font-size': 15, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' });
    S.path('M' + cx + ' ' + (y + 6) + 'L' + (cx - 12) + ' ' + (y + 54) + 'L' + cx + ' ' + (y + 44) + 'z', { fill: INK, stroke: INK }); S.path('M' + cx + ' ' + (y + 6) + 'L' + (cx + 12) + ' ' + (y + 54) + 'L' + cx + ' ' + (y + 44) + 'z', { fill: '#fff', stroke: INK });
    y += 74; S.line(PX, y, PX + PW, y, { stroke: INK, 'stroke-width': .7 }); y += 22;
    var head = function (en, ar) { if (AR) S.text(R0, y, ar, { 'font-size': 12, 'font-weight': 800, fill: INK, direction: 'rtl', 'text-anchor': 'start' }); else S.text(L0, y, en, { 'font-size': 11.5, 'font-weight': 800, fill: INK, 'letter-spacing': 1.6 }); };
    head('LEGEND', 'مفتاح المخطط'); y += 22;
    items.forEach(function (it) { if (AR) { it.sym(R0 - 30, y); sheetText(S, 0, y + 4, it.label, { 'font-size': 10.5, fill: INK }, R0 - 40); } else { it.sym(L0, y); S.text(L0 + 40, y + 4, it.label, { 'font-size': 10.5, fill: INK }); } y += 23; });
    if ((extraRows || []).length) { y += 2; S.line(L0, y - 8, R0, y - 8, { stroke: '#C9CED3', 'stroke-width': .6 }); y += 6; }
    (extraRows || []).forEach(function (rw) { sheetText(S, L0, y + 4, rw[0], { 'font-size': 10.5, fill: MUT }, R0); S.text(AR ? L0 : R0, y + 4, rw[1], { 'font-size': 10.5, 'font-weight': 800, fill: INK, direction: 'ltr', 'text-anchor': AR ? 'start' : 'end' }); y += 19; });
    y += 6; S.line(PX, y, PX + PW, y, { stroke: INK, 'stroke-width': .7 }); y += 22;
    head('SCALE', 'مقياس الرسم'); y += 14;
    var sbm = niceFloor((PW - 70) / sc), sbw = sbm * sc, sx = AR ? R0 - sbw - 8 : L0 + 6;
    for (var q = 0; q < 4; q++) S.add('rect', { x: sx + q * sbw / 4, y: y, width: sbw / 4, height: 7, fill: q % 2 ? '#fff' : INK, stroke: INK, 'stroke-width': .8 });
    [0, 2, 4].forEach(function (q) { S.text(sx + q * sbw / 4, y + 21, SH.fmt(sbm * q / 4, sbm < 4 ? 1 : 0), { 'font-size': 9.5, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); });
    S.text(AR ? sx - 8 : sx + sbw + 8, y + 8, t('m', 'م'), { 'font-size': 10, 'font-weight': 700, fill: INK, 'text-anchor': AR ? 'end' : 'start' });
    return y + 30;
  }
  /* equal tick interval on both axes, wide enough for the labels never to touch */
  function frameAxes(S, ox, oy, W, H, sc, xMax, yMax, xName, yName) {
    var st = niceCeil(Math.max(64 / sc, 26 / sc)), v, dg = st < 1 ? 1 : 0;
    for (v = 0; v <= xMax + 1e-9; v += st) { var px = ox + v * sc; S.line(px, oy + H, px, oy + H + 6, { stroke: INK }); S.line(px, oy, px, oy + H, { stroke: INK, 'stroke-width': .4, opacity: .25, 'stroke-dasharray': '3 4' }); S.text(px, oy + H + 19, SH.fmt(v, dg), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    for (v = 0; v <= yMax + 1e-9; v += st) { var py = oy + H - v * sc; S.line(ox - 6, py, ox, py, { stroke: INK }); S.line(ox, py, ox + W, py, { stroke: INK, 'stroke-width': .4, opacity: .25, 'stroke-dasharray': '3 4' }); S.text(ox - 9, py + 4, SH.fmt(v, dg), { 'font-size': 10, fill: MUT, 'text-anchor': 'end', direction: 'ltr' }); }
    sheetText(S, ox + W / 2, oy + H + 42, xName, { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    var yx = ox - 52, yy = oy + H / 2; S.text(yx, yy, hasAr(yName) ? iso(yName) : yName, { 'font-size': 11, fill: MUT, 'text-anchor': 'middle', direction: hasAr(yName) ? 'rtl' : 'ltr', transform: 'rotate(-90 ' + yx + ' ' + yy + ')' });
  }
  function hatch(S, defs, id, col, ang, gap) { var P = S.add('pattern', { id: id, width: gap || 10, height: gap || 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(' + (ang || 45) + ')' }, null, defs); S.add('rect', { x: 0, y: 0, width: gap || 10, height: gap || 10, fill: SH.alpha(col, .28) }, null, P); S.add('line', { x1: 0, y1: 0, x2: 0, y2: gap || 10, stroke: col, 'stroke-width': 1.3 }, null, P); return 'url(#' + id + ')'; }
  function footer(S, VH) { S.text(30, VH - 22, 'Shandal System · ' + new Date().toISOString().slice(0, 10), { 'font-size': 10, fill: MUT, direction: 'ltr' }); }

  /* ---------- 2D plan: contract rectangle, worked and remaining parts, dimensions and percentages */
  function planSheet(r) {
    var S = SH.svgB('qPlan'), defs = S.add('defs', {}), inv = SH.val('qColInv') || '#C0603A', rem = SH.val('qColRem') || '#5D9C6B', VW = 1000, VH = 620; S.el.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    S.add('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#fff' }); S.add('rect', { x: 8, y: 8, width: VW - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    var totW = r.Wm, totL = r.A > 0 ? r.A / r.Wm : r.Lm; if (!(totL > 0)) totL = r.Lm; var Lx = Math.max(totL, r.Lm);
    var PW = 236, PX = VW - PW - 24;
    sheetText(S, 30, 46, t('2D plan of the worked and remaining area', 'المرتسم الثنائي للمساحة المستثمرة والمتبقية'), { 'font-size': 19, 'font-weight': 800, fill: INK }, PX - 24);
    var ml = 96, mt = 112, mb = 74, bw = PX - ml - 50, bh = VH - mt - mb, sc = Math.min(bw / Lx, bh / totW), W = Lx * sc, H = totW * sc, ox = ml + (bw - W) / 2, oy = mt + (bh - H) / 2;
    frameAxes(S, ox, oy, W, H, sc, Lx, totW, t('Length along the contract (m)', 'الطول على امتداد العقد (م)'), t('Width (m)', 'العرض (م)'));
    if (totL > r.Lm) S.add('rect', { x: ox + r.Lm * sc, y: oy, width: (totL - r.Lm) * sc, height: H, fill: hatch(S, defs, 'hRem', rem, -45, 12), stroke: rem, 'stroke-width': 1.6 });
    S.add('rect', { x: ox, y: oy, width: Math.min(r.Lm, Lx) * sc, height: H, fill: hatch(S, defs, 'hInv', inv, 45, 9), stroke: inv, 'stroke-width': 2 });
    if (r.Lm > totL) S.add('rect', { x: ox + totL * sc, y: oy, width: (r.Lm - totL) * sc, height: H, fill: '#B23A2E', opacity: .22 });
    S.add('rect', { x: ox, y: oy, width: totL * sc, height: H, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-dasharray': '10 5' });
    var lab = function (x, y, a, b, c) { var g = S.g(); S.add('rect', { x: x - 70, y: y - 30, width: 140, height: 58, rx: 6, fill: '#fff', opacity: .94, stroke: INK, 'stroke-width': .6 }, null, g); sheetText(S, x, y - 11, a, { 'font-size': 13, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' }); S.text(x, y + 6, b, { 'font-size': 11.5, fill: INK, 'text-anchor': 'middle', direction: 'ltr' }, g); S.text(x, y + 21, c, { 'font-size': 12, 'font-weight': 800, fill: '#B4552D', 'text-anchor': 'middle', direction: 'ltr' }, g); };
    var pI = isNaN(r.pctA) ? '' : SH.fmt(r.pctA, 1) + ' %', pR = isNaN(r.pctA) ? '' : SH.fmt(100 - r.pctA, 1) + ' %';
    if (r.Lm * sc > 120 && H > 70) lab(ox + Math.min(r.Lm, Lx) * sc / 2, oy + H / 2, t('Worked', 'المستثمرة'), SH.fmt(r.invA, 0) + ' m²', pI);
    if (totL > r.Lm && (totL - r.Lm) * sc > 120 && H > 70) lab(ox + r.Lm * sc + (totL - r.Lm) * sc / 2, oy + H / 2, t('Remaining', 'المتبقية'), SH.fmt(r.remA, 0) + ' m²', pR);
    var arrow = function (x1, y1, x2, y2) { S.line(x1, y1, x2, y2, { stroke: INK, 'stroke-width': 1 }); [[x1, y1, x2, y2], [x2, y2, x1, y1]].forEach(function (q) { var an = Math.atan2(q[3] - q[1], q[2] - q[0]); S.poly([[q[0], q[1]], [q[0] + 8 * Math.cos(an - .35), q[1] + 8 * Math.sin(an - .35)], [q[0] + 8 * Math.cos(an + .35), q[1] + 8 * Math.sin(an + .35)]], { fill: INK }); }); };
    var dimH = function (x1, x2, y, s) { arrow(x1, y, x2, y); var mx = (x1 + x2) / 2, w = s.length * 6.2 + 16; S.add('rect', { x: mx - w / 2, y: y - 9, width: w, height: 17, fill: '#fff' }); sheetText(S, mx, y + 4, s, { 'font-size': 10.5, fill: INK, 'text-anchor': 'middle', 'font-weight': 700, direction: 'ltr' }); };
    dimH(ox, ox + r.Lm * sc, oy - 18, t('L = ', 'الطول = ') + SH.fmt(r.Lm, 1) + t(' m', ' م'));
    if (Math.abs(totL - r.Lm) > .01) dimH(ox, ox + totL * sc, oy - 44, t('Contract length = ', 'طول العقد = ') + SH.fmt(totL, 1) + t(' m', ' م'));
    var dx = ox + W + 16, my = oy + H / 2, ws = t('W = ', 'العرض = ') + SH.fmt(totW, 1) + t(' m', ' م'); arrow(dx, oy, dx, oy + H);
    var wl = ws.length * 5.6 + 12; if (wl < H - 20) S.add('rect', { x: dx - 7, y: my - wl / 2, width: 14, height: wl, fill: '#fff' });
    S.text(dx + 3.5, my, hasAr(ws) ? iso(ws) : ws, { 'font-size': 9.5, 'font-weight': 700, fill: INK, 'text-anchor': 'middle', direction: hasAr(ws) ? 'rtl' : 'ltr', transform: 'rotate(-90 ' + (dx + 3.5) + ' ' + my + ')' });
    panel(S, PX, 74, PW, VH - 74 - 40, sc, [
      { sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: 'url(#hInv)', stroke: inv, 'stroke-width': 1.5 }); }, label: t('Worked (excavated) area', 'المساحة المستثمرة (المحفورة)') },
      { sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: 'url(#hRem)', stroke: rem, 'stroke-width': 1.5 }); }, label: t('Remaining contract area', 'المساحة المتبقية من العقد') },
      { sym: function (x, y) { S.line(x, y, x + 30, y, { stroke: INK, 'stroke-width': 2.2, 'stroke-dasharray': '10 5' }); }, label: t('Contract boundary', 'حدود العقد') }].concat(r.Lm > totL ? [{ sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: '#B23A2E', opacity: .3 }); }, label: t('Beyond the contract', 'خارج حدود العقد') }] : []),
      [[t('Contract area', 'مساحة العقد'), SH.fmt(r.A, 0) + ' m²'], [t('Worked depth', 'عمق الاستثمار'), SH.fmt(r.Dm, 1) + ' m'], [t('Extracted', 'المستخرج'), SH.fmt(r.extV, 0) + ' m³']]);
    footer(S, VH);
  }

  /* ---------- site plan from GPS corners: true geometry in UTM with sides, bearings and area */
  function siteSheet(r) {
    var pts = corners.map(function (c, i) { return c ? { c: c, k: 'ABCD'[i] } : null; }).filter(Boolean); $('#qSiteWrap').hidden = pts.length < 3; if (pts.length < 3) return;
    var z = SH.toUTM(pts[0].c.lat, pts[0].c.lon).zone, P = pts.map(function (p) { var u = SH.toUTM(p.c.lat, p.c.lon, z); return { x: u.E, y: u.N, k: p.k, acc: p.c.acc }; });
    var S = SH.svgB('qSitePlan'), defs = S.add('defs', {}), VW = 1000, VH = 620, inv = SH.val('qColInv') || '#C0603A', PW = 236, PX = VW - PW - 24; S.add('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#fff' }); S.add('rect', { x: 8, y: 8, width: VW - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    sheetText(S, 30, 46, t('Site plan from the corner coordinates', 'مخطط الموقع من إحداثيات الأركان'), { 'font-size': 19, 'font-weight': 800, fill: INK }, PX - 24);
    S.text(AR ? PX - 24 : 30, 68, 'WGS 84 / UTM ' + z + (pts[0].c.lat < 0 ? 'S' : 'N'), { 'font-size': 12, fill: MUT, direction: 'ltr', 'text-anchor': AR ? 'end' : 'start' });
    var xs = P.map(function (p) { return p.x; }), ys = P.map(function (p) { return p.y; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = Math.max(x1 - x0, y1 - y0, 4) * 0.2 + 3;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad; var ml = 116, mt = 100, mb = 74, bw = PX - ml - 40, bh = VH - mt - mb, sc = Math.min(bw / (x1 - x0), bh / (y1 - y0)), W = (x1 - x0) * sc, H = (y1 - y0) * sc, ox = ml + (bw - W) / 2, oy = mt + (bh - H) / 2;
    var X = function (x) { return ox + (x - x0) * sc; }, Y = function (y) { return oy + (y1 - y) * sc; };
    var st = niceCeil(84 / sc), v, dg = st < 1 ? 1 : 0;
    for (v = Math.ceil(x0 / st) * st; v <= x1; v += st) { S.line(X(v), oy, X(v), oy + H, { stroke: INK, 'stroke-width': .4, opacity: .3, 'stroke-dasharray': '3 4' }); S.line(X(v), oy + H, X(v), oy + H + 6, { stroke: INK }); S.text(X(v), oy + H + 19, SH.fmt(v, dg, { nogroup: true }), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    for (v = Math.ceil(y0 / st) * st; v <= y1; v += st) { S.line(ox, Y(v), ox + W, Y(v), { stroke: INK, 'stroke-width': .4, opacity: .3, 'stroke-dasharray': '3 4' }); S.line(ox - 6, Y(v), ox, Y(v), { stroke: INK }); S.text(ox - 9, Y(v) + 4, SH.fmt(v, dg, { nogroup: true }), { 'font-size': 10, fill: MUT, 'text-anchor': 'end', direction: 'ltr' }); }
    S.add('rect', { x: ox, y: oy, width: W, height: H, fill: 'none', stroke: INK, 'stroke-width': 1.3 });
    sheetText(S, ox + W / 2, oy + H + 42, t('Easting E (m)', 'الشرقيات E (م)'), { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    var nn = t('Northing N (m)', 'الشماليات N (م)'), nx = ox - 88, ny = oy + H / 2; S.text(nx, ny, hasAr(nn) ? iso(nn) : nn, { 'font-size': 11, fill: MUT, 'text-anchor': 'middle', direction: hasAr(nn) ? 'rtl' : 'ltr', transform: 'rotate(-90 ' + nx + ' ' + ny + ')' });
    var clip = S.add('clipPath', { id: 'qSiteClip' }, null, defs); S.add('rect', { x: ox, y: oy, width: W, height: H }, null, clip);
    var gA = S.g({ 'clip-path': 'url(#qSiteClip)' });
    P.forEach(function (p) { if (p.acc) S.circle(X(p.x), Y(p.y), Math.max(3, p.acc * sc), { fill: SH.alpha('#1F6FB2', .06), stroke: '#1F6FB2', 'stroke-width': .8, 'stroke-dasharray': '3 2' }, gA); });
    S.poly(P.map(function (p) { return [X(p.x), Y(p.y)]; }), { fill: hatch(S, defs, 'hSite', inv, 45, 9), stroke: inv, 'stroke-width': 2.2 });
    var area = 0, per = 0, gx = 0, gy = 0; P.forEach(function (p) { gx += X(p.x) / P.length; gy += Y(p.y) / P.length; });
    P.forEach(function (p, i) { var q = P[(i + 1) % P.length], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), az = (SH.deg(Math.atan2(dx, dy)) + 360) % 360; area += p.x * q.y - q.x * p.y; per += d;
      var ax = X(p.x), ay = Y(p.y), bx = X(q.x), by = Y(q.y), mx = (ax + bx) / 2, my = (ay + by) / 2, len = Math.hypot(bx - ax, by - ay) || 1, nx2 = -(by - ay) / len, ny2 = (bx - ax) / len;
      if ((mx - gx) * nx2 + (my - gy) * ny2 < 0) { nx2 = -nx2; ny2 = -ny2; }
      var an = SH.deg(Math.atan2(by - ay, bx - ax)); if (an > 90) an -= 180; if (an < -90) an += 180; var lx = mx + nx2 * 14, ly = my + ny2 * 14 + 4;
      S.text(lx, ly, SH.fmt(d, 1) + ' m · ' + SH.fmt(az, 0) + '°', { 'font-size': 10.5, 'font-weight': 700, fill: INK, 'text-anchor': 'middle', direction: 'ltr', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', transform: 'rotate(' + an.toFixed(1) + ' ' + lx.toFixed(1) + ' ' + (ly - 4).toFixed(1) + ')' }); });
    area = Math.abs(area) / 2;
    P.forEach(function (p) { var px = X(p.x), py = Y(p.y), ux = px - gx, uy = py - gy, ul = Math.hypot(ux, uy) || 1; S.circle(px, py, 5, { fill: '#fff', stroke: INK, 'stroke-width': 2 }); S.text(px + ux / ul * 16, py + uy / ul * 16 + 5, p.k, { 'font-size': 14, 'font-weight': 800, fill: INK, 'text-anchor': 'middle', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }); });
    panel(S, PX, 74, PW, VH - 74 - 40, sc, [
      { sym: function (x, y) { S.add('rect', { x: x, y: y - 8, width: 30, height: 16, fill: 'url(#hSite)', stroke: inv, 'stroke-width': 1.5 }); }, label: t('Surveyed boundary', 'الحدود المرصودة') },
      { sym: function (x, y) { S.circle(x + 15, y, 5, { fill: '#fff', stroke: INK, 'stroke-width': 2 }); }, label: t('Corner (GPS)', 'ركن مرصود (GPS)') },
      { sym: function (x, y) { S.circle(x + 15, y, 8, { fill: SH.alpha('#1F6FB2', .1), stroke: '#1F6FB2', 'stroke-dasharray': '3 2' }); }, label: t('Horizontal accuracy', 'الدقة الأفقية') }],
      [[t('Area', 'المساحة'), SH.fmt(area, 0) + ' m²'], [t('Perimeter', 'المحيط'), SH.fmt(per, 1) + ' m'], [t('Area (dunam)', 'المساحة (دونم)'), SH.fmt(area / 2500, 3)]]);
    footer(S, VH);
    $('#qSiteCap').textContent = t('Surveyed boundary from the corner coordinates, with side lengths and grid bearings.', 'حدود الموقع المرصودة من إحداثيات الأركان، مع أطوال الأضلاع واتجاهاتها الشبكية.');
  }

  /* ---------- stratigraphic column and bed log */
  var siteName = function () { return SH.val('qName') || SH.val('qSite') || ''; };
  function column(r) {
    ST.render($('#qCol'), r.beds, { title: t('Geological stratigraphic column', 'العمود الطباقي الجيولوجي') + (siteName() ? ' — ' + siteName() : ''),
      faceAz: SH.val('qFace') === '' ? null : SH.num('qFace'), pitFloor: r.Dm, water: SH.num('qWt'), credit: 'Shandal System' });
  }
  function logTable(r) {
    var top = 0;
    $('#qLog').innerHTML = '<thead><tr><th>No.</th><th class="num">' + t('From–to (m)', 'من–إلى (م)') + '</th><th class="num">' + t('Thick. (m)', 'السمك (م)') + '</th><th>' + t('Lithology', 'الصخارية') + '</th><th>' + t('Texture', 'النسيج') + '</th><th>' + t('Base contact', 'التماس السفلي') + '</th><th>' + t('Structures and fossils', 'التراكيب والأحافير') + '</th><th>' + t('Likely environment', 'البيئة الترسيبية المرجحة') + '</th></tr></thead><tbody>' +
      r.beds.map(function (b, i) { var g = b.gs !== undefined && b.gs !== '' ? +b.gs : LITH[b.rock][4], row = '<tr><td><b>' + (i + 1) + '</b></td><td class="num">' + SH.fmt(top, 2) + '–' + SH.fmt(top + b.th, 2) + '</td><td class="num">' + SH.fmt(b.th, 2) + '</td><td><b>' + ln(b.rock) + '</b>' + (b.sec ? (b.mix === 'inter' ? t(' interbedded with ', ' متعاقب مع ') : t(' with ', ' مع ')) + ln(b.sec) : '') + (b.col ? '<div class="xsmall muted">' + SH.esc(b.col) + '</div>' : '') + (b.desc ? '<div class="xsmall">' + SH.esc(b.desc) + '</div>' : '') + '</td><td class="ltr">' + ST.GS[g] + '</td><td>' + ST.CONTACTS[b.base || 'sharp'][SH.lang === 'ar' ? 1 : 0] + '</td><td class="small">' + ((b.st || []).map(function (k) { return ST.STRUCT[k] ? ST.STRUCT[k][SH.lang === 'ar' ? 1 : 0] : ''; }).filter(Boolean).join('، ') || '—') + '</td><td class="small">' + ST.facies(b) + '</td></tr>'; top += b.th; return row; }).join('') + '</tbody>';
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
    var place = SH.esc(SH.selText('qCountry')) + ' · ' + (SH.val('qCountry') === 'iq' ? SH.selText('qGov') : SH.esc(SH.val('qReg') || '—'));
    $('#qSum1').innerHTML = row(t('Quarry or plant', 'المقلع أو المعمل'), SH.esc(SH.val('qName') || '—')) + row(t('Contract number', 'رقم العقد'), SH.esc(SH.val('qSite') || '—')) + row(t('Location', 'الموقع'), place) + row(t('Contract area', 'المساحة المتعاقد عليها'), '<bdi>' + SH.fmt(r.A, 0) + ' m²</bdi> (<bdi>' + SH.fmt(r.A / 2500, 2) + '</bdi>' + t(' dunam)', ' دونم)')) +
      row(t('Contracted volume', 'الكمية المتعاقد عليها'), '<bdi>' + SH.fmt(r.V, 0) + ' m³</bdi>') + row(t('Worked L × W × D', 'الطول × العرض × العمق'), '<span class="ltr">' + SH.fmt(r.Lm, 1) + ' × ' + SH.fmt(r.Wm, 1) + ' × ' + SH.fmt(r.Dm, 1) + ' m</span>') + row(t('Extracted / remaining', 'المستخرج / المتبقي'), '<bdi>' + SH.fmt(r.extV, 0) + ' m³</bdi> / <bdi>' + SH.fmt(r.remV, 0) + ' m³</bdi>');
    $('#qSum2').innerHTML = '<thead><tr><th>No.</th><th class="num">' + t('Latitude', 'دائرة العرض') + '</th><th class="num">' + t('Longitude', 'خط الطول') + '</th><th class="num">' + t('Easting E', 'الشرقيات E') + '</th><th class="num">' + t('Northing N', 'الشماليات N') + '</th><th>' + t('Zone', 'النطاق') + '</th></tr></thead><tbody>' + corners.map(function (c, i) { if (!c) return '<tr><td>' + 'ABCD'[i] + '</td><td colspan="5" class="muted">' + t('not captured', 'لم يُلتقط') + '</td></tr>'; var u = SH.toUTM(c.lat, c.lon); return '<tr><td><b>' + 'ABCD'[i] + '</b></td><td class="num">' + c.lat.toFixed(6) + '</td><td class="num">' + c.lon.toFixed(6) + '</td><td class="num">' + u.E.toFixed(1) + '</td><td class="num">' + u.N.toFixed(1) + '</td><td>' + u.zone + u.band + '</td></tr>'; }).join('') + '</tbody>';
    var pol = checked('qPol').map(function (v) { return label('qPol', v); }), ops = checked('qOps').map(function (v) { return label('qOps', v); }), mach = checked('qMach').map(function (v) { return label('qMach', v); });
    $('#qSum3').innerHTML = row(t('Laboratory compliance', 'المطابقة المختبرية'), SH.selText('qLab')) + row(t('Pollution', 'التلوث'), pol.length ? pol.join('، ') : t('None observed', 'لم يُرصد')) + row(t('Groundwater', 'المياه الجوفية'), SH.selText('qGw')) + row(t('Rehabilitation', 'إعادة التأهيل'), SH.selText('qRehab')) + row(t('Operations', 'العمليات'), ops.join('، ') || '—') + row(t('Machinery', 'الآليات'), mach.join('، ') || '—');
  }

  $('#qRun').addEventListener('click', run);
  $('#qDemo').addEventListener('click', function () {
    var v = { qName: t('Sand and gravel quarry', 'مقلع رمل وحصى'), qSite: '12/2026', qDunam: 20, qArea: 50000, qVol: 300000, qMaxD: 6, qL: 140, qW: 120, qD: 5.5 };
    for (var k in v) $('#' + k).value = v[k];
    var c = [33.3010, 44.7020]; corners = [{ lat: c[0], lon: c[1] }, { lat: c[0], lon: c[1] + 0.00151 }, { lat: c[0] - 0.00108, lon: c[1] + 0.00151 }, { lat: c[0] - 0.00108, lon: c[1] }];
    bedEd.set([{ rock: 'topsoil', th: 0.5 }, { rock: 'clay', th: 1.5 }, { rock: 'sand', th: 2, sec: 'gravel', mix: 'mixed' }, { rock: 'gravel', th: 2.5 }]);
    SH.$$('#qVar input[value=joint],#qOps input[value=exc],#qOps input[value=trans],#qMach input[value=ex],#qMach input[value=dt]').forEach(function (i) { i.checked = true; });
    SH.store.set('shandal_quarry_corners', corners); cornersUI(); run();
  });
  if (SH.fa) { SH.fa.attach('qFace', 'faceAz'); SH.fa.attach('qWt', 'wt'); }
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Process the data first.', 'عالج البيانات أولاً.'), 'warn'); } });
  document.addEventListener('sh:redraw', function () { if (last) { planSheet(last); siteSheet(last); column(last); } });
  SH.$$('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { SH.svgPng($('#' + b.getAttribute('data-svg')), 'shandal-' + b.getAttribute('data-svg') + '.png', 2); }); });
  cornersUI();
})();
