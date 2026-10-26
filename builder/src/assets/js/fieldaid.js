/* SH.fa — field assistant for parameters a geologist cannot read directly at the outcrop.
   Each guided field gets a help button that opens: how to measure it in the field, typical values with their
   source, and, where possible, a calculator (tilt test, Barton–Bandis, Schmidt hammer, point load, Jv, scanline,
   critical tension-crack depth) or an online estimate (seismic coefficient from the mapped active faults,
   slope geometry from the Copernicus DEM). Online estimates requested without a connection are queued and
   completed automatically when the device is back online; the survey itself is kept in local storage. */
(function () {
  'use strict';
  var t = SH.t, AR = SH.lang === 'ar', $ = SH.$, Q = 'shandal_fa_queue';
  var esc = SH.esc, f2 = function (v, d) { return SH.fmt(v, d == null ? 2 : d); };
  var LITH_PHI = [['Sandstone', 'حجر رملي', 25, 35], ['Siltstone', 'حجر غريني', 27, 31], ['Shale', 'طفل', 27, 27], ['Limestone', 'حجر جيري', 33, 40], ['Dolomite', 'دولومايت', 27, 31], ['Chalk', 'طباشير', 30, 30], ['Conglomerate', 'مدملكات', 35, 35], ['Granite (fine)', 'غرانيت ناعم', 29, 35], ['Granite (coarse)', 'غرانيت خشن', 31, 35], ['Basalt', 'بازلت', 31, 38], ['Gneiss (schistose)', 'نايس متورق', 23, 29], ['Slate', 'أردواز', 25, 30], ['Amphibolite', 'أمفيبولايت', 32, 32]];
  var LITH_GAM = [['Clay and soil', 'طين وتربة', 16, 20], ['Chalk', 'طباشير', 15, 22], ['Gypsum', 'جبس', 22, 23], ['Marl', 'مارل', 22, 25], ['Shale', 'طفل', 22, 26], ['Sandstone', 'حجر رملي', 22, 25], ['Limestone', 'حجر جيري', 25, 27], ['Dolomite', 'دولومايت', 26, 28], ['Granite', 'غرانيت', 26, 27], ['Quartzite', 'كوارتزايت', 26, 27], ['Marble', 'رخام', 26, 27], ['Gneiss', 'نايس', 26, 28], ['Basalt', 'بازلت', 27, 30]];
  var JRC = [[1, '0–2', 'smooth, planar', 'ناعم مستوٍ'], [3, '2–4', 'smooth, slightly undulating', 'ناعم متموج قليلاً'], [5, '4–6', 'slightly rough, planar', 'خشن قليلاً مستوٍ'], [7, '6–8', 'slightly rough, undulating', 'خشن قليلاً متموج'], [9, '8–10', 'rough, planar', 'خشن مستوٍ'], [11, '10–12', 'rough, undulating', 'خشن متموج'], [13, '12–14', 'rough, irregular', 'خشن غير منتظم'], [15, '14–16', 'very rough, undulating', 'خشن جداً متموج'], [17, '16–18', 'very rough, irregular', 'خشن جداً غير منتظم'], [19, '18–20', 'extremely rough, stepped', 'خشن للغاية متدرج']];
  var tab = function (head, rows) { return '<table class="tbl fa-t"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; };
  var fld = function (id, lab, val, unit) { return '<div class="fg"><label for="' + id + '">' + lab + (unit ? ' <bdi class="u" dir="ltr">(' + unit + ')</bdi>' : '') + '</label><input id="' + id + '" type="number" step="any" inputmode="decimal" value="' + (val == null || !isFinite(val) ? '' : val) + '"></div>'; };
  var out = function (id) { return '<div class="fa-out" id="' + id + '"></div>'; };
  var ref = function (s) { return '<p class="fa-ref">' + s + '</p>'; };
  var h = function (en, ar) { return '<h4>' + t(en, ar) + '</h4>'; };
  var p = function (en, ar) { return '<p>' + t(en, ar) + '</p>'; };
  var nm = function (num) { var v = parseFloat(String(num).replace(',', '.')); return v; };
  var g = function (id) { var e = document.getElementById(id); return e ? nm(e.value) : NaN; };

  /* ------------------------------------------------------------ guides and calculators */
  var GUIDE = {
    phi: { t: ['Friction angle of the joints φ', 'زاوية احتكاك الفواصل φ'], html: function (c) {
      var psi = c.psi || 40, sn = c.H > 0 && c.gam ? 0.5 * c.gam * c.H * Math.cos(SH.rad(psi)) * Math.cos(SH.rad(psi)) / 1000 : 0.1;
      return h('What it is', 'ما هو') + p('The angle of shearing resistance along the joint surfaces. It is not read from a map: it is measured on the outcrop or on a sample.', 'زاوية مقاومة القص على أسطح الفواصل. لا تُقرأ من خريطة، بل تُقاس على المنكشف أو على عينة.') +
        h('Field method 1 · tilt test', 'الطريقة الحقلية 1 · اختبار الإمالة') + p('Place a block with a natural joint face on its matching lower block, tilt slowly and read the angle at which the upper block starts to slide (clinometer of the phone). Repeat at least three times; the mean is the friction angle of the joint at very low stress.', 'ضع كتلة ذات وجه فاصل طبيعي على الكتلة المقابلة لها، وأمِلها ببطء، واقرأ الزاوية التي تبدأ عندها الكتلة العليا بالانزلاق (بميزان الهاتف). كرر ثلاث مرات على الأقل؛ والمتوسط هو زاوية احتكاك الفاصل عند إجهاد منخفض جداً.') +
        '<div class="row3">' + fld('faT1', t('Tilt 1', 'إمالة 1'), '', '°') + fld('faT2', t('Tilt 2', 'إمالة 2'), '', '°') + fld('faT3', t('Tilt 3', 'إمالة 3'), '', '°') + '</div>' + out('faTilt') +
        h('Field method 2 · Barton–Bandis criterion', 'الطريقة الحقلية 2 · معيار Barton–Bandis') + p('Measure the joint roughness by comparison with the standard profiles (JRC), the strength of the joint wall with a Schmidt hammer (JCS), and take the basic friction angle of the rock type.', 'قِس خشونة الفاصل بمقارنته مع المقاطع القياسية (JRC)، ومقاومة جدار الفاصل بمطرقة شميت (JCS)، وخذ زاوية الاحتكاك الأساسية لنوع الصخر.') +
        '<div class="fg"><label for="faLith">' + t('Rock type (basic friction angle φb)', 'نوع الصخر (زاوية الاحتكاك الأساسية φb)') + '</label><select id="faLith">' + LITH_PHI.map(function (l, i) { return '<option value="' + (l[2] + l[3]) / 2 + '"' + (i === 3 ? ' selected' : '') + '>' + l[AR ? 1 : 0] + ' · ' + (l[2] === l[3] ? l[2] : l[2] + '–' + l[3]) + '°</option>'; }).join('') + '</select></div>' +
        '<div class="fg"><label for="faJrc">' + t('Joint roughness coefficient JRC', 'معامل خشونة الفاصل JRC') + '</label><select id="faJrc">' + JRC.map(function (j, i) { return '<option value="' + j[0] + '"' + (i === 4 ? ' selected' : '') + '>JRC ' + j[1] + ' · ' + j[AR ? 3 : 2] + '</option>'; }).join('') + '</select></div>' +
        '<div class="row3">' + fld('faRr', t('Rebound on the joint wall r', 'الارتداد على جدار الفاصل r'), '', '') + fld('faRR', t('Rebound on fresh rock R', 'الارتداد على صخر سليم R'), '', '') + fld('faSn', t('Normal stress σn', 'الإجهاد العمودي σn'), f2(sn, 3), 'MPa') + '</div>' + out('faBB') +
        '<div class="fg"><label for="faUse">' + t('Value to apply', 'القيمة المطلوب تطبيقها') + '</label><select id="faUse"><option value="bb">' + t('Barton–Bandis at the stress of the slope', 'Barton–Bandis عند إجهاد المنحدر') + '</option><option value="tilt">' + t('Mean tilt angle', 'متوسط زاوية الإمالة') + '</option></select></div>' +
        ref('Barton & Choubey (1977); Wyllie & Mah (2004), table 4.1. JCS = 1.4459·e^(0.0706 r), L-type hammer (Aydin & Basu 2005); φr = (φb − 20°) + 20° r/R; φ = φr + JRC·log10(JCS/σn).');
    }, calc: function () {
      var tl = ['faT1', 'faT2', 'faT3'].map(g).filter(isFinite), r = null;
      var tilt = null, bb = null; if (tl.length) { tilt = tl.reduce(function (a, b) { return a + b; }, 0) / tl.length; $('#faTilt').innerHTML = t('Mean tilt angle: ', 'متوسط زاوية الإمالة: ') + '<b><bdi>' + f2(tilt, 1) + '°</bdi></b>'; } else $('#faTilt').innerHTML = '';
      var fb = g('faLith'), jrc = g('faJrc'), rr = g('faRr'), RR = g('faRR'), sn = g('faSn');
      if (isFinite(fb) && isFinite(jrc) && sn > 0) { var fr = isFinite(rr) && RR > 0 ? (fb - 20) + 20 * rr / RR : fb, jcs = isFinite(rr) ? 1.4459 * Math.exp(0.0706 * rr) : NaN, add = isFinite(jcs) ? jrc * Math.log10(jcs / sn) : NaN, phi = isFinite(add) ? Math.min(70, fr + add) : fr;
        $('#faBB').innerHTML = 'φr = ' + f2(fr, 1) + '°' + (isFinite(jcs) ? ' · JCS = ' + f2(jcs, 0) + ' MPa · JRC·log(JCS/σn) = ' + f2(add, 1) + '°' : '') + ' → φ = <b>' + f2(phi, 1) + '°</b>'; bb = phi; }
      var use = $('#faUse') ? $('#faUse').value : 'bb'; r = use === 'tilt' ? (tilt != null ? tilt : bb) : (bb != null ? bb : tilt);
      return r == null ? null : Math.round(r * 10) / 10;
    } },
    coh: { t: ['Cohesion of the joints c', 'تماسك الفواصل c'], html: function () {
      return p('Clean or open joints have no true cohesion: use c = 0, which is the value recommended for design (Wyllie & Mah 2004). Apparent cohesion exists only on rough joints at low stress and is already represented by JRC in the Barton–Bandis criterion; healed or cemented joints may carry cohesion, but it can only be measured by direct shear tests in the laboratory.', 'الفواصل النظيفة أو المفتوحة لا تملك تماسكاً حقيقياً: استخدم c = 0 وهي القيمة الموصى بها للتصميم (Wyllie & Mah 2004). أما التماسك الظاهري فيوجد فقط في الفواصل الخشنة عند إجهاد منخفض، ويمثله JRC في معيار Barton–Bandis؛ وقد تملك الفواصل الملتئمة أو المسمنتة تماسكاً لكنه لا يُقاس إلا باختبار القص المباشر في المختبر.') +
        tab([t('Joint condition', 'حالة الفاصل'), 'c (kPa)'], [[t('Clean, open or slickensided', 'نظيف أو مفتوح أو مصقول'), '0'], [t('Rough, closed, unweathered', 'خشن مغلق غير متجوٍ'), '0 – 25 (' + t('apparent', 'ظاهري') + ')'], [t('Clay infilling', 'حشوة طينية'), t('laboratory test', 'اختبار مختبري')]]) + ref('Wyllie & Mah (2004); Hoek & Bray (1981).');
    }, calc: function () { return 0; }, applyLabel: ['Use c = 0', 'استخدم c = 0'] },
    kh: { t: ['Seismic coefficient kh', 'المعامل الزلزالي kh'], online: true, html: function (c) {
      return p('The horizontal pseudo-static coefficient represents earthquake shaking as a constant horizontal force kh·W on the block. It is taken from the peak ground acceleration (PGA) of the site: kh = 0.5 PGA/g (Hynes-Griffin & Franklin 1984). Use the PGA of the national seismic code when it is available; otherwise the platform estimates it from the mapped active faults around the site.', 'يمثل المعامل شبه الساكن الأفقي اهتزاز الزلزال بقوة أفقية ثابتة kh·W على الكتلة. ويؤخذ من أقصى تسارع أرضي (PGA) للموقع: kh = 0.5 PGA/g (Hynes-Griffin & Franklin 1984). استخدم PGA من الكود الزلزالي الوطني إن توفرت؛ وإلا يقدّرها النظام من الصدوع النشطة المرسومة حول الموقع.') +
        '<div class="row2">' + fld('faPga', t('PGA from the code', 'PGA من الكود'), '', 'g') + '<div class="fg"><label for="faKf">' + t('Fraction of PGA', 'نسبة من PGA') + '</label><select id="faKf"><option value="0.5" selected>0.5 · Hynes-Griffin &amp; Franklin (1984)</option><option value="0.333">1/3 · Marcuson (1981)</option></select></div></div>' +
        '<button class="btn btn-line btn-sm" type="button" id="faOnline">' + t('Estimate PGA from active faults', 'قدّر PGA من الصدوع النشطة') + '</button>' + out('faKh') +
        ref(t('Faults: GEM Global Active Faults (Styron & Pagani 2020, CC BY-SA 4.0); magnitude from rupture length (Wells & Coppersmith 1994); median PGA on rock, Vs30 = 760 m/s (Boore, Joyner & Fumal 1997). A screening value: the code PGA governs for design.', 'الصدوع: قاعدة GEM للصدوع النشطة (Styron & Pagani 2020، CC BY-SA 4.0)؛ والقدر من طول التمزق (Wells & Coppersmith 1994)؛ وPGA الوسيطة على الصخر Vs30 = 760 م/ث (Boore, Joyner & Fumal 1997). قيمة استكشافية، وPGA الكود هي الحاكمة في التصميم.'));
    }, calc: function () { var pga = g('faPga'), k = g('faKf'); if (pga > 0) { var v = Math.round(pga * k * 1000) / 1000; $('#faKh').innerHTML = 'kh = ' + k + ' × ' + pga + ' = <b>' + v + '</b>'; return v; } return null; } },
    limP: { t: ['Lateral limit for planar sliding', 'الحد الجانبي للانزلاق المستوي'], html: function () {
      return p('Planar sliding needs the plane to dip nearly toward the face. The lateral limit is the largest difference allowed between the dip directions of the plane and of the face. It is not measured: it is a design convention.', 'يحتاج الانزلاق المستوي أن يميل المستوى تقريباً باتجاه الوجه. والحد الجانبي هو أكبر فرق مسموح بين اتجاهي ميل المستوى والوجه. لا يُقاس، بل هو اصطلاح تصميمي.') +
        tab([t('Value', 'القيمة'), t('Use', 'الاستخدام'), t('Source', 'المصدر')], [['±20°', t('Standard, recommended', 'قياسي وموصى به'), 'Wyllie & Mah (2004)'], ['±30°', t('Conservative, poor data or persistent joints', 'محافظ، عند ضعف البيانات أو استمرارية الفواصل'), 'Hoek & Bray (1981)']]);
    }, choices: [20, 30] },
    limT: { t: ['Lateral limit for toppling', 'الحد الجانبي للانقلاب'], html: function () {
      return p('Flexural toppling needs steep layers dipping into the slope almost exactly opposite to the face. The lateral limit is a design convention, not a measurement.', 'يحتاج الانقلاب الانثنائي طبقات شديدة الميل تميل داخل المنحدر عكس الوجه تقريباً. والحد الجانبي اصطلاح تصميمي لا قياس.') +
        tab([t('Value', 'القيمة'), t('Use', 'الاستخدام'), t('Source', 'المصدر')], [['±10°', t('Standard', 'قياسي'), 'Goodman & Bray (1976); Wyllie & Mah (2004)'], ['±30°', t('Conservative screening', 'فحص محافظ'), 'Hudson & Harrison (1997)']]);
    }, choices: [10, 30] },
    crack: { t: ['Tension crack depth z', 'عمق شق الشد z'], html: function (c) {
      var z = c.H > 0 && c.psf > c.psp && c.psp > 0 ? c.H * (1 - Math.sqrt(Math.tan(SH.rad(c.psp)) / Math.tan(SH.rad(c.psf)))) : NaN;
      return p('Tension cracks are open, steep fractures behind the crest. If a crack is visible, lower a tape or a rod into it and record the depth to the bottom, the distance from the crest and the depth of standing water. If no crack is visible, the analysis uses the critical depth that gives the minimum factor of safety (Hoek & Bray 1981).', 'شقوق الشد كسور مفتوحة شديدة الميل خلف القمة. إن كان الشق ظاهراً، أنزل شريط قياس أو قضيباً فيه وسجّل العمق حتى القاع والمسافة عن القمة وعمق الماء الراكد. وإن لم يظهر شق، يستخدم التحليل العمق الحرج الذي يعطي أدنى معامل أمان (Hoek & Bray 1981).') +
        '<p class="fa-eq">z<sub>c</sub>/H = 1 − √(cotψf · tanψp)</p>' + (isFinite(z) ? '<div class="fa-out">H = ' + f2(c.H, 1) + ' m · ψf = ' + c.psf + '° · ψp = ' + f2(c.psp, 0) + '° → z<sub>c</sub> = <b>' + f2(z, 2) + ' m</b></div>' : '') + ref('Hoek & Bray (1981); Wyllie & Mah (2004), eq. 6.11.');
    }, calc: function (c) { var z = c.H > 0 && c.psf > c.psp && c.psp > 0 ? c.H * (1 - Math.sqrt(Math.tan(SH.rad(c.psp)) / Math.tan(SH.rad(c.psf)))) : null; return z == null ? null : Math.round(z * 100) / 100; } },
    water: { t: ['Water in the tension crack', 'الماء في شق الشد'], html: function () { return p('Observe the crack after rain or measure the standing water with a tape. For design, a crack half full is the usual case and a full crack the extreme case after heavy rainfall (Wyllie & Mah 2004). Water pressure acts both in the crack (V) and along the sliding plane (U).', 'راقب الشق بعد المطر أو قِس الماء الراكد بالشريط. في التصميم تُعد حالة الشق الممتلئ للنصف هي المعتادة، والشق الممتلئ هو الحالة القصوى بعد الأمطار الغزيرة (Wyllie & Mah 2004). ويؤثر ضغط الماء في الشق (V) وعلى مستوى الانزلاق (U).'); } },
    gam: { t: ['Unit weight of the rock γ', 'الوزن النوعي للصخر γ'], html: function () {
      return p('Field method: weigh a hand specimen (kg) and measure its volume by immersion in a graduated container (litres); γ = 9.81 × mass / volume in kN/m³. Otherwise use the typical value of the rock type.', 'الطريقة الحقلية: زِن عينة يدوية (كغم) وقِس حجمها بغمرها في وعاء مدرّج (لتر)؛ γ = 9.81 × الكتلة / الحجم بوحدة كيلونيوتن/م³. وإلا استخدم القيمة النموذجية لنوع الصخر.') +
        '<div class="row2">' + fld('faM', t('Mass', 'الكتلة'), '', 'kg') + fld('faV', t('Volume', 'الحجم'), '', 'L') + '</div>' + out('faG') +
        tab([t('Rock', 'الصخر'), 'γ (kN/m³)'], LITH_GAM.map(function (l) { return [l[AR ? 1 : 0], l[2] + '–' + l[3]]; })) + ref('Goodman (1989); Hoek & Bray (1981).');
    }, calc: function () { var m = g('faM'), v = g('faV'); if (m > 0 && v > 0) { var x = Math.round(9.81 * m / v * 10) / 10; $('#faG').innerHTML = 'γ = 9.81 × ' + m + ' / ' + v + ' = <b>' + x + ' kN/m³</b>'; return x; } return null; } },
    ucs: { t: ['Intact rock strength (UCS)', 'مقاومة الصخر السليم (UCS)'], html: function () {
      return p('With a Schmidt hammer (L-type) take 20 impacts on a fresh, flat surface at least 6 cm apart, hammer perpendicular to the surface. The calculator uses the mean of the upper half of the readings (ISRM 1978).', 'بمطرقة شميت (النوع L) خذ 20 ضربة على سطح سليم مستوٍ بمسافة 6 سم على الأقل بينها، والمطرقة عمودية على السطح. تستخدم الحاسبة متوسط النصف الأعلى من القراءات (ISRM 1978).') +
        '<div class="fg"><label for="faRb">' + t('Rebound readings, separated by spaces', 'قراءات الارتداد مفصولة بمسافات') + '</label><textarea id="faRb" rows="2" class="ltr"></textarea></div>' + out('faU') +
        h('Without instruments · ISRM field estimate', 'دون أجهزة · التقدير الحقلي ISRM') + tab(['Grade', t('Field test', 'الاختبار الحقلي'), 'UCS (MPa)'], [['R6', t('Only chipped by the geological hammer', 'لا تقطعه المطرقة إلا بشظايا'), '> 250'], ['R5', t('Many blows to fracture', 'يحتاج ضربات عديدة'), '100–250'], ['R4', t('More than one blow', 'أكثر من ضربة'), '50–100'], ['R3', t('Fractured by a single firm blow; not scraped by a knife', 'ينكسر بضربة قوية واحدة ولا تخدشه المطواة'), '25–50'], ['R2', t('Scraped by a knife with difficulty', 'تخدشه المطواة بصعوبة'), '5–25'], ['R1', t('Crumbles under firm blows of the hammer point', 'يتفتت بضربات رأس المطرقة'), '1–5'], ['R0', t('Indented by the thumbnail', 'يخدشه الظفر'), '0.25–1']]) +
        ref('ISRM (1978, 1981); UCS = 1.4459·e^(0.0706 R), Aydin & Basu (2005).');
    }, calc: function () { var v = String($('#faRb').value || '').split(/[\s,;]+/).map(nm).filter(isFinite).sort(function (a, b) { return b - a; }); if (v.length < 5) return null; var top = v.slice(0, Math.ceil(v.length / 2)), R = top.reduce(function (a, b) { return a + b; }, 0) / top.length, u = 1.4459 * Math.exp(0.0706 * R); $('#faU').innerHTML = 'R = ' + f2(R, 1) + ' (n = ' + v.length + ') → UCS = <b>' + f2(u, 0) + ' MPa</b>'; return Math.round(u); } },
    is50: { t: ['Point load index Is(50)', 'مؤشر الحمل النقطي Is(50)'], html: function () {
      return p('Break an irregular lump or a core between the cones of a portable point-load tester and record the failure load P and the equivalent diameter De. The size-corrected index converts to UCS ≈ 22 Is(50).', 'اكسر كتلة غير منتظمة أو لباباً بين مخروطي جهاز الحمل النقطي المحمول، وسجّل حمل الكسر P والقطر المكافئ De. ويتحول المؤشر المصحح إلى UCS ≈ 22 Is(50).') +
        '<div class="row2">' + fld('faP', t('Failure load P', 'حمل الكسر P'), '', 'kN') + fld('faDe', t('Equivalent diameter De', 'القطر المكافئ De'), '', 'mm') + '</div>' + out('faIs') + ref('ISRM (1985): Is = P/De², F = (De/50)^0.45, Is(50) = F·Is.');
    }, calc: function () { var P = g('faP'), De = g('faDe'); if (P > 0 && De > 0) { var Is = P * 1000 / (De * De), F = Math.pow(De / 50, 0.45), v = Math.round(F * Is * 100) / 100; $('#faIs').innerHTML = 'Is = ' + f2(Is, 2) + ' MPa · F = ' + f2(F, 3) + ' → Is(50) = <b>' + v + ' MPa</b>'; return v; } return null; } },
    jv: { t: ['RQD and the volumetric joint count Jv', 'RQD وعدد الفواصل الحجمي Jv'], html: function () {
      return p('Without drill core, RQD is derived from the number of joints in a unit volume. Measure the mean spacing of each set along a line perpendicular to it; count the random joints over the exposure.', 'عند غياب اللباب يُشتق RQD من عدد الفواصل في وحدة الحجم. قِس متوسط تباعد كل مجموعة على خط عمودي عليها، وعُدّ الفواصل العشوائية على المنكشف.') +
        '<div class="row4">' + fld('faS1', 'S1', '', 'm') + fld('faS2', 'S2', '', 'm') + fld('faS3', 'S3', '', 'm') + fld('faS4', 'S4', '', 'm') + '</div><div class="row2">' + fld('faNr', t('Random joints Nr', 'فواصل عشوائية Nr'), '0', '') + fld('faA', t('Counted area A', 'المساحة المعدودة A'), '1', 'm²') + '</div>' + out('faJv') + ref('Palmström (2005): Jv = Σ 1/Si + Nr/(5√A); RQD = 110 − 2.5 Jv.');
    }, calc: function () { var s = ['faS1', 'faS2', 'faS3', 'faS4'].map(g).filter(function (x) { return x > 0; }); if (!s.length) return null; var nr = g('faNr') || 0, A = g('faA') || 1, jv = s.reduce(function (a, b) { return a + 1 / b; }, 0) + nr / (5 * Math.sqrt(A)), rqd = SH.clamp(110 - 2.5 * jv, 0, 100); $('#faJv').innerHTML = 'Jv = <b>' + f2(jv, 1) + '</b> · RQD = <b>' + f2(rqd, 0) + ' %</b>'; return { jv: Math.round(jv * 10) / 10, rqd: Math.round(rqd) }; } },
    spc: { t: ['Mean spacing of discontinuities', 'متوسط تباعد الانقطاعات'], html: function () {
      return p('Stretch a tape (scanline) of known length across the face and count every discontinuity that crosses it. The apparent spacing is L/N; correct it to true spacing with the angle θ between the scanline and the normal to the set.', 'مدّ شريطاً (خط مسح) بطول معلوم عبر الواجهة وعُدّ كل انقطاع يقطعه. التباعد الظاهري هو L/N؛ ويُصحح إلى التباعد الحقيقي بالزاوية θ بين خط المسح والعمودي على المجموعة.') +
        '<div class="row3">' + fld('faL', t('Scanline length L', 'طول خط المسح L'), '', 'm') + fld('faN', t('Count N', 'العدد N'), '', '') + fld('faTh', 'θ', '0', '°') + '</div>' + out('faSp') + ref('Priest & Hudson (1976); ISRM (1978).');
    }, calc: function () { var L = g('faL'), N = g('faN'), th = g('faTh') || 0; if (L > 0 && N > 0) { var s = L / N * Math.cos(SH.rad(th)); $('#faSp').innerHTML = 'S = L/N · cosθ = <b>' + f2(s, 3) + ' m</b>'; return Math.round(s * 1000) / 1000; } return null; } },
    cond: { t: ['Condition of discontinuities (RMR89)', 'حالة الانقطاعات (RMR89)'], html: function () {
      return tab([t('Parameter', 'المعامل'), t('How to measure', 'طريقة القياس')], [[t('Persistence', 'الاستمرارية'), t('Trace length of the joint on the face, with a tape', 'طول أثر الفاصل على الواجهة بالشريط')], [t('Aperture', 'الفتحة'), t('Feeler gauge or ruler across the opening', 'مقياس الفتحات أو المسطرة عبر الفتحة')], [t('Roughness', 'الخشونة'), t('Touch and comparison with the JRC profiles over 10 cm', 'باللمس والمقارنة مع مقاطع JRC على 10 سم')], [t('Infilling', 'الحشوة'), t('Thickness and hardness of the material between the walls (knife test)', 'سمك المادة بين الجدارين وصلابتها (اختبار المطواة)')], [t('Weathering', 'التجوية'), t('Discoloration and softening of the walls compared with fresh rock', 'تغير لون الجدران وليونتها مقارنة بالصخر السليم')]]) + ref('Bieniawski (1989), table 1-E; ISRM (1978).'); } },
    gw: { t: ['Groundwater condition', 'حالة المياه الجوفية'], html: function () { return p('Observe the face: completely dry, damp (colour change, no free water), wet (water on the surface), dripping, or flowing. Record after at least one day without rain; the wettest condition expected in service governs design.', 'راقب الواجهة: جافة تماماً، أو رطبة (تغير لون دون ماء حر)، أو مبللة (ماء على السطح)، أو تقطير، أو جريان. سجّل بعد يوم على الأقل من دون مطر؛ وتحكم التصميمَ أشد حالة رطوبة متوقعة خلال الخدمة.') + ref('Bieniawski (1989).'); } },
    face: { t: ['Slope face and height', 'وجه المنحدر وارتفاعه'], online: true, html: function () {
      return p('Measure an engineered cut directly: lay the phone on the face for dip and dip direction, and use a tape or a laser range finder for the height. For a natural slope the platform can estimate the mean dip, dip direction and local relief from the Copernicus 30 m elevation model around the site; cut faces are steeper than the terrain model can resolve.', 'قِس القطع الهندسي مباشرة: ضع الهاتف على الوجه لقراءة الميل واتجاهه، واستخدم شريطاً أو مقياس مسافة ليزرياً للارتفاع. وللمنحدر الطبيعي يقدّر النظام الميل المتوسط واتجاهه والتضاريس المحلية من نموذج كوبرنيكوس للارتفاعات بدقة 30 م حول الموقع؛ أما وجوه القطع فأشد ميلاً من أن يميزها نموذج التضاريس.') +
        '<button class="btn btn-line btn-sm" type="button" id="faOnline">' + t('Estimate from the terrain model', 'قدّر من نموذج التضاريس') + '</button>' + out('faDem') + ref('Copernicus DEM GLO-30 (ESA), via Microsoft Planetary Computer; least-squares plane over a 5 × 5 window.');
    } },
    D: { t: ['Disturbance factor D', 'معامل الإزعاج D'], html: function () { return tab(['D', t('Excavation', 'الحفر')], [['0', t('Excellent controlled blasting or TBM; natural slopes', 'تفجير محكوم ممتاز أو حفارة أنفاق؛ منحدرات طبيعية')], ['0.5', t('Mechanical excavation with minimal disturbance', 'حفر آلي بإزعاج قليل')], ['0.7', t('Small-scale civil slopes with good blasting', 'منحدرات مدنية صغيرة بتفجير جيد')], ['0.8', t('Poor blasting in tunnels', 'تفجير رديء في الأنفاق')], ['1.0', t('Large open-pit production blasting, poor-quality blasting in slopes', 'تفجير إنتاجي في المناجم المكشوفة الكبيرة أو تفجير رديء في المنحدرات')]]) + ref('Hoek, Carranza-Torres & Corkum (2002), table 1.'); } },
    faceAz: { t: ['Face azimuth', 'اتجاه الواجهة'], html: function () { return p('The compass direction toward which the quarry face looks, measured clockwise from north (0–360°). Stand at the foot of the face with your back to it and read the bearing of the direction you are facing with the phone compass, or lay the phone flat on the face and take its dip direction. It orients the stratigraphic column and the structural readings of the face.', 'الاتجاه البوصلي الذي تنظر إليه واجهة المقلع، مقاساً باتجاه عقارب الساعة من الشمال (0–360°). قف عند قاعدة الواجهة وظهرك إليها واقرأ سمت الاتجاه الذي تواجهه ببوصلة الهاتف، أو ضع الهاتف مستوياً على الواجهة وخذ اتجاه ميلها. ويُستخدم لتوجيه العمود الطباقي والقراءات التركيبية للواجهة.') + tab([t('Azimuth', 'السمت'), t('Face looks toward', 'الواجهة تنظر نحو')], [['0°', t('North', 'الشمال')], ['90°', t('East', 'الشرق')], ['180°', t('South', 'الجنوب')], ['270°', t('West', 'الغرب')]]); } },
    wt: { t: ['Depth to the water table', 'عمق منسوب المياه'], html: function () { return p('Vertical distance from the ground surface at the top of the face to the level of groundwater seen in the pit (standing water or seepage line on the face). Measure it with a tape from the crest, or subtract the water level from the crest elevation of the GPS. Leave it empty if the excavation has not reached water. Excavation must remain above this level to protect the aquifer and to avoid dewatering.', 'المسافة الرأسية من سطح الأرض أعلى الواجهة إلى مستوى المياه الجوفية الظاهر في الحفرة (ماء راكد أو خط رشح على الواجهة). قِسها بشريط من القمة، أو اطرح منسوب الماء من ارتفاع القمة في GPS. اتركها فارغة إذا لم تبلغ الحفريات الماء. ويجب أن يبقى الحفر فوق هذا المنسوب حمايةً للخزان الجوفي وتجنباً لعمليات سحب المياه.'); } },
    q: { t: ['Q-system ratings', 'تقييمات نظام Q'], html: function () { return p('Jn: count the joint sets visible in the face (add "random" for scattered joints). Jr: roughness of the weakest set at small (cm) and intermediate (m) scale. Ja: hardness and thickness of the coating or filling of the weakest set (knife test). Jw: water inflow into the excavation. SRF: weakness zones, loose rock near the surface, or high stress relative to strength.', 'Jn: عُدّ مجموعات الفواصل الظاهرة في الواجهة (أضف "عشوائية" للفواصل المبعثرة). Jr: خشونة المجموعة الأضعف على مقياس السنتيمتر والمتر. Ja: صلابة الغلاف أو الحشوة في المجموعة الأضعف وسمكها (اختبار المطواة). Jw: تدفق الماء إلى الحفرية. SRF: نطاقات الضعف أو الصخر المفكك قرب السطح أو الإجهاد العالي نسبة إلى المقاومة.') + ref('Barton et al. (1974); NGI (2015), Using the Q-system.'); } }
  };

  /* ------------------------------------------------------------ online estimates */
  var faultIdx = null, tiles = {};
  function loadFaults(lat, lon) {
    var base = SH.base + 'assets/data/faults/', ix = faultIdx ? Promise.resolve(faultIdx) : SH.getJSON(base + 'index.json').then(function (j) { faultIdx = j; return j; });
    return ix.then(function (ixx) { var la = Math.floor(lat / 10) * 10, lo = Math.floor(lon / 10) * 10, want = []; for (var dy = -10; dy <= 10; dy += 10) for (var dx = -10; dx <= 10; dx += 10) { var lo2 = ((lo + dx + 180) % 360 + 360) % 360 - 180, k = (la + dy) + '_' + lo2; if (ixx.indexOf(k) >= 0) want.push(k); }
      return Promise.all(want.map(function (k) { return tiles[k] || (tiles[k] = SH.getJSON(base + k + '.json').catch(function () { return []; })); })); }).then(function (a) { return [].concat.apply([], a); });
  }
  function pgaFromFaults(lat, lon) {
    return loadFaults(lat, lon).then(function (recs) {
      var kx = 111.195 * Math.cos(SH.rad(lat)), ky = 111.195, best = null;
      recs.forEach(function (r) { var c = r[4], d = 1e9, len = 0; for (var i = 0; i + 3 < c.length; i += 2) { var x1 = (c[i] - lon) * kx, y1 = (c[i + 1] - lat) * ky, x2 = (c[i + 2] - lon) * kx, y2 = (c[i + 3] - lat) * ky, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / L2)) : 0, qx = x1 + u * dx, qy = y1 + u * dy; d = Math.min(d, Math.hypot(qx, qy)); len += Math.sqrt(L2); }
        if (d > 200) return; var s = (r[1] || '').toLowerCase(), k = /thrust|reverse|anticline/.test(s) ? 'R' : /normal/.test(s) ? 'N' : /dextral|sinistral|strike/.test(s) ? 'SS' : 'U', lg = Math.log10(Math.max(len, 1));
        var Mw = Math.min(8, k === 'SS' ? 5.16 + 1.12 * lg : k === 'R' ? 5.00 + 1.22 * lg : k === 'N' ? 4.86 + 1.32 * lg : 5.08 + 1.16 * lg), b1 = k === 'SS' ? -0.313 : k === 'R' ? -0.117 : -0.242, rr = Math.sqrt(d * d + 5.57 * 5.57);
        var pga = Math.exp(b1 + 0.527 * (Mw - 6) - 0.778 * Math.log(rr) - 0.371 * Math.log(760 / 1396)); if (!best || pga > best.pga) best = { pga: pga, name: r[0], Mw: Mw, d: d }; });
      return best || { pga: 0, none: true };
    });
  }
  function demFace(lat, lon) {
    var dl = 0.0025; return SH.pc.dem({ s: lat - dl, n: lat + dl, w: lon - dl / Math.cos(SH.rad(lat)), e: lon + dl / Math.cos(SH.rad(lat)) }, 'cop-dem-glo-30', null, 200).then(function (f) {
      var step = 30, mx = 0, sxz = 0, syz = 0, sxx = 0, syy = 0, n = 0, zs = [], kx = 1 / (111320 * Math.cos(SH.rad(lat))), ky = 1 / 110540;
      for (var j = -2; j <= 2; j++) for (var i = -2; i <= 2; i++) { var z = f(lat + j * step * ky, lon + i * step * kx); if (!isFinite(z)) continue; zs.push([i * step, j * step, z]); }
      if (zs.length < 9) throw new Error(t('No elevation data at this point.', 'لا توجد بيانات ارتفاع في هذه النقطة.'));
      var zm = zs.reduce(function (a, q) { return a + q[2]; }, 0) / zs.length; zs.forEach(function (q) { sxz += q[0] * (q[2] - zm); syz += q[1] * (q[2] - zm); sxx += q[0] * q[0]; syy += q[1] * q[1]; });
      var gx = sxz / sxx, gy = syz / syy, dip = SH.deg(Math.atan(Math.hypot(gx, gy))), dd = ((SH.deg(Math.atan2(-gx, -gy)) % 360) + 360) % 360;
      var lo = 1e9, hi = -1e9; for (var a = 0; a < 360; a += 30) for (var rr = 0; rr <= 100; rr += 25) { var z2 = f(lat + rr * Math.cos(SH.rad(a)) * ky, lon + rr * Math.sin(SH.rad(a)) * kx); if (isFinite(z2)) { lo = Math.min(lo, z2); hi = Math.max(hi, z2); } }
      return { dip: dip, dd: dd, relief: hi - lo, z: f(lat, lon) };
    });
  }
  var FETCH = {
    kh: function (a) { return pgaFromFaults(a.lat, a.lon).then(function (b) { return { value: Math.round(0.5 * b.pga * 1000) / 1000, info: b }; }); },
    face: function (a) { return demFace(a.lat, a.lon).then(function (b) { return { value: b, info: b }; }); }
  };

  /* ------------------------------------------------------------ offline queue */
  function queue() { return SH.store.get(Q, []); }
  function enqueue(item) { var q = queue().filter(function (x) { return !(x.tool === item.tool && x.key === item.key); }); q.push(item); SH.store.set(Q, q); }
  var appliers = {};
  function flush() {
    if (!navigator.onLine) return; var q = queue(), left = [];
    if (!q.length) return;
    Promise.all(q.map(function (it) { var ap = appliers[it.tool + ':' + it.key]; if (!ap) { left.push(it); return null; }
      return FETCH[it.key](it.args).then(function (r) { ap(r, true); }).catch(function () { left.push(it); }); })).then(function () { SH.store.set(Q, left); });
  }
  window.addEventListener('online', flush);

  /* ------------------------------------------------------------ attach to fields */
  function open(key, o) {
    var G = GUIDE[key], ctx = o.ctx ? o.ctx() : {}, btns = [{ label: t('Close', 'إغلاق'), value: false }];
    if (G.calc || G.choices) btns.push({ label: G.applyLabel ? t(G.applyLabel[0], G.applyLabel[1]) : t('Apply to the field', 'طبّق على الحقل'), value: true, cls: 'btn-gold' });
    var html = '<div class="fa-g">' + G.html(ctx) + (G.choices ? '<div class="fg"><label for="faCh">' + t('Value', 'القيمة') + '</label><select id="faCh">' + G.choices.map(function (c) { return '<option value="' + c + '">±' + c + '°</option>'; }).join('') + '</select></div>' : '') + '</div>';
    var pr = SH.modal(t(G.t[0], G.t[1]), html, btns), box = document.querySelector('.modal:last-of-type .fa-g');
    if (box && G.calc) box.addEventListener('input', function () { try { G.calc(ctx); } catch (e) {} });
    if (box && G.calc) try { G.calc(ctx); } catch (e) {}
    var ob = box && box.querySelector('#faOnline'), result = null;
    if (ob) ob.addEventListener('click', function () {
      var a = o.args ? o.args() : null; if (!a || !isFinite(a.lat) || !isFinite(a.lon)) { SH.toast(t('Enter the site position first.', 'أدخل موقع الموقع أولاً.'), 'warn'); return; }
      if (!navigator.onLine) { enqueue({ tool: o.tool, key: key, args: a, t: Date.now() }); var oe = box.querySelector('.fa-out:last-of-type'); if (oe) oe.innerHTML = t('No connection. The request is saved and will be completed automatically when the device is online; the survey stays on this device.', 'لا يوجد اتصال. حُفظ الطلب وسيُنفذ تلقائياً عند الاتصال بالإنترنت؛ ويبقى المسح محفوظاً على هذا الجهاز.'); if (o.pending) o.pending(true); return; }
      ob.disabled = true; var oe2 = box.querySelector('#faKh, #faDem'); if (oe2) oe2.textContent = t('Retrieving data…', 'جارٍ جلب البيانات…');
      FETCH[key](a).then(function (r) { ob.disabled = false; result = r;
        if (key === 'kh') { var b = r.info; $('#faKh').innerHTML = b.none ? t('No mapped active fault within 200 km; kh = 0 unless the code requires otherwise.', 'لا يوجد صدع نشط مرسوم ضمن 200 كم؛ kh = 0 ما لم يتطلب الكود غير ذلك.') : t('Controlling fault: ', 'الصدع الحاكم: ') + esc(b.name || '—') + ' · Mw ' + f2(b.Mw, 1) + ' · ' + f2(b.d, 1) + ' km → PGA = ' + f2(b.pga, 3) + ' g → kh = 0.5 PGA = <b>' + r.value + '</b>'; }
        if (key === 'face') { var d = r.info; $('#faDem').innerHTML = t('Terrain: dip ', 'التضاريس: الميل ') + f2(d.dip, 0) + '° ' + t('toward ', 'نحو ') + f2(d.dd, 0) + '° · ' + t('relief within 100 m: ', 'التضاريس ضمن 100 م: ') + f2(d.relief, 0) + ' m · ' + t('elevation ', 'الارتفاع ') + f2(d.z, 0) + ' m'; }
      }).catch(function (e) { ob.disabled = false; var oe3 = box.querySelector('#faKh, #faDem'); if (oe3) oe3.textContent = e.message; });
    });
    var mo = document.querySelector('.modal:last-of-type'), chosen = null;
    if (mo) mo.addEventListener('click', function (e) { if (!e.target.closest('[data-i]')) return; var v = null;
      if (G.choices) { var sl = mo.querySelector('#faCh'); v = sl ? +sl.value : G.choices[0]; } else { try { v = G.calc ? G.calc(ctx) : null; } catch (er) {} if (v == null && result) v = result.value; } chosen = v; }, true);
    pr.then(function (ok) { if (!ok) return; var v = chosen;
      if (v == null || (typeof v === 'number' && !isFinite(v))) { SH.toast(t('Nothing to apply: complete the calculator first.', 'لا توجد قيمة للتطبيق: أكمل الحاسبة أولاً.'), 'warn'); return; }
      o.apply(v, false); });
  }
  SH.fa = {
    attach: function (fieldId, key, o) {
      var el = document.getElementById(fieldId); if (!el || !GUIDE[key]) return; var lab = el.closest('.fg') ? el.closest('.fg').querySelector('label') : null; if (!lab) return;
      lab.querySelectorAll('.tip').forEach(function (x) { x.remove(); });
      var b = document.createElement('button'); b.type = 'button'; b.className = 'fa-q'; b.textContent = AR ? '؟' : '?'; b.setAttribute('aria-label', t('How to measure', 'كيف يُقاس')); lab.appendChild(b);
      o = o || {}; o.tool = o.tool || (document.body.getAttribute('data-slug') || 'tool');
      if (!o.apply) o.apply = function (v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); SH.toast(t(GUIDE[key].t[0], GUIDE[key].t[1]) + ' = ' + v, 'ok'); };
      appliers[o.tool + ':' + key] = function (r, fromQueue) { var v = r.value; if (fromQueue) { o.apply(v, true); SH.toast(t('Online data completed: ', 'اكتملت البيانات عبر الإنترنت: ') + t(GUIDE[key].t[0], GUIDE[key].t[1]), 'ok', 6000); if (o.pending) o.pending(false); } };
      if (queue().some(function (x) { return x.tool === o.tool && x.key === key; }) && o.pending) o.pending(true);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(key, o); });
    },
    flush: flush, guides: GUIDE
  };
  setTimeout(flush, 1500);

})();
