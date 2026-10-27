/* Stratigraphic Column Designer — publication-style columns: ICS 2023 chronostratigraphy (system, series, stage)
   with merged and coloured cells, group and formation columns, depth scale (true or schematic), FGDC-style
   lithology patterns with interbedding, contacts with unconformities drawn across the chart, hiatuses,
   sedimentary structures and fossils, depositional environment, petroleum-system symbols, events, an
   explanation (legend), and an automatic stratigraphic description and interpretation. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, ST = SH.strat, R = ST.R, KEY = 'shandal_strata_units', AR = SH.lang === 'ar';
  var INK = '#1B232B', MUT = '#55616B', GRID = '#9AA3AD';

  /* ---------- ICS 2023 chronostratigraphy: periods, series and stages (top and base in Ma, official chart colours) */
  var PER = {
    Q: ['Quaternary', 'الرباعي', '#F9F97F', 'Quaternary', 'الرباعي'], N: ['Neogene', 'النيوجين', '#FFE619', 'Tertiary', 'الثلاثي'], Pg: ['Paleogene', 'الباليوجين', '#FD9A52', 'Tertiary', 'الثلاثي'],
    K: ['Cretaceous', 'الطباشيري', '#7FC64E'], J: ['Jurassic', 'الجوراسي', '#34B2C9'], Tr: ['Triassic', 'الترياسي', '#812B92'], P: ['Permian', 'البرمي', '#F04028'], C: ['Carboniferous', 'الكربوني', '#67A599'],
    D: ['Devonian', 'الديفوني', '#CB8C37'], S: ['Silurian', 'السيلوري', '#B3E1B6'], O: ['Ordovician', 'الأوردوفيشي', '#009270'], Cm: ['Cambrian', 'الكامبري', '#7FA056'], pC: ['Precambrian', 'ما قبل الكامبري', '#F74370']
  };
  /* [period, series en, series ar, colour, top, base, stages [[en, ar, top, base]]] */
  var SER = [
    ['Q', 'Holocene', 'الهولوسين', '#FEF2E0', 0, 0.0117, []], ['Q', 'Pleistocene', 'البلايستوسين', '#FFF2AE', 0.0117, 2.58, []],
    ['N', 'Pliocene', 'البلايوسين', '#FFFF99', 2.58, 5.333, [['Piacenzian', 'البياتشينزي', 2.58, 3.6], ['Zanclean', 'الزانكلي', 3.6, 5.333]]],
    ['N', 'Upper Miocene', 'الميوسين الأعلى', '#FFFF66', 5.333, 11.63, [['Messinian', 'المسيني', 5.333, 7.246], ['Tortonian', 'التورتوني', 7.246, 11.63]]],
    ['N', 'Middle Miocene', 'الميوسين الأوسط', '#FFFF4D', 11.63, 15.97, [['Serravallian', 'السرافالي', 11.63, 13.82], ['Langhian', 'اللانغي', 13.82, 15.97]]],
    ['N', 'Lower Miocene', 'الميوسين الأسفل', '#FFFF33', 15.97, 23.03, [['Burdigalian', 'البورديغالي', 15.97, 20.44], ['Aquitanian', 'الأكيتاني', 20.44, 23.03]]],
    ['Pg', 'Oligocene', 'الأوليغوسين', '#FEC07A', 23.03, 33.9, [['Chattian', 'الشاتي', 23.03, 27.82], ['Rupelian', 'الروبلي', 27.82, 33.9]]],
    ['Pg', 'Eocene', 'الإيوسين', '#FDB46C', 33.9, 56.0, [['Priabonian', 'البريابوني', 33.9, 37.71], ['Bartonian', 'البارتوني', 37.71, 41.2], ['Lutetian', 'اللوتيتي', 41.2, 47.8], ['Ypresian', 'الإيبريسي', 47.8, 56.0]]],
    ['Pg', 'Paleocene', 'الباليوسين', '#FDA75F', 56.0, 66.0, [['Thanetian', 'الثانيتي', 56.0, 59.2], ['Selandian', 'السيلاندي', 59.2, 61.6], ['Danian', 'الداني', 61.6, 66.0]]],
    ['K', 'Upper Cretaceous', 'الطباشيري الأعلى', '#A6D84A', 66.0, 100.5, [['Maastrichtian', 'الماستريختي', 66.0, 72.1], ['Campanian', 'الكمباني', 72.1, 83.6], ['Santonian', 'السانتوني', 83.6, 86.3], ['Coniacian', 'الكونياسي', 86.3, 89.8], ['Turonian', 'التوروني', 89.8, 93.9], ['Cenomanian', 'السينوماني', 93.9, 100.5]]],
    ['K', 'Lower Cretaceous', 'الطباشيري الأسفل', '#8CCD57', 100.5, 145.0, [['Albian', 'الألبي', 100.5, 113.0], ['Aptian', 'الأبتي', 113.0, 121.4], ['Barremian', 'الباريمي', 121.4, 125.77], ['Hauterivian', 'الهوتريفي', 125.77, 132.6], ['Valanginian', 'الفالانجيني', 132.6, 139.8], ['Berriasian', 'البرياسي', 139.8, 145.0]]],
    ['J', 'Upper Jurassic', 'الجوراسي الأعلى', '#B3E3EE', 145.0, 161.5, [['Tithonian', 'التيثوني', 145.0, 149.2], ['Kimmeridgian', 'الكمريدجي', 149.2, 154.8], ['Oxfordian', 'الأكسفوردي', 154.8, 161.5]]],
    ['J', 'Middle Jurassic', 'الجوراسي الأوسط', '#80CFD8', 161.5, 174.7, [['Callovian', 'الكالوفي', 161.5, 165.3], ['Bathonian', 'الباثوني', 165.3, 168.2], ['Bajocian', 'الباجوسي', 168.2, 170.9], ['Aalenian', 'الآليني', 170.9, 174.7]]],
    ['J', 'Lower Jurassic', 'الجوراسي الأسفل', '#42AED0', 174.7, 201.4, [['Toarcian', 'التوارسي', 174.7, 184.2], ['Pliensbachian', 'البلينسباخي', 184.2, 192.9], ['Sinemurian', 'السينموري', 192.9, 199.5], ['Hettangian', 'الهتانجي', 199.5, 201.4]]],
    ['Tr', 'Upper Triassic', 'الترياسي الأعلى', '#BD8CC3', 201.4, 237.0, []], ['Tr', 'Middle Triassic', 'الترياسي الأوسط', '#B168B1', 237.0, 247.2, []], ['Tr', 'Lower Triassic', 'الترياسي الأسفل', '#983999', 247.2, 251.9, []],
    ['P', 'Lopingian', 'اللوبينجي', '#FBA794', 251.9, 259.51, []], ['P', 'Guadalupian', 'الغوادالوبي', '#FB745C', 259.51, 274.4, []], ['P', 'Cisuralian', 'السيسورالي', '#EF5845', 274.4, 298.9, []],
    ['C', 'Pennsylvanian', 'البنسلفاني', '#99C2B5', 298.9, 323.4, []], ['C', 'Mississippian', 'المسيسيبي', '#678F66', 323.4, 358.9, []],
    ['D', 'Upper Devonian', 'الديفوني الأعلى', '#F1E19D', 358.9, 382.7, []], ['D', 'Middle Devonian', 'الديفوني الأوسط', '#F1C868', 382.7, 393.3, []], ['D', 'Lower Devonian', 'الديفوني الأسفل', '#E5AC4D', 393.3, 419.2, []],
    ['S', 'Pridoli', 'البريدولي', '#E6F5E1', 419.2, 423.0, []], ['S', 'Ludlow', 'اللودلو', '#BFE6CF', 423.0, 427.4, []], ['S', 'Wenlock', 'الوينلوك', '#B3E1C2', 427.4, 433.4, []], ['S', 'Llandovery', 'اللاندوفيري', '#99D7B3', 433.4, 443.8, []],
    ['O', 'Upper Ordovician', 'الأوردوفيشي الأعلى', '#7FCA93', 443.8, 458.4, []], ['O', 'Middle Ordovician', 'الأوردوفيشي الأوسط', '#4DB47E', 458.4, 470.0, []], ['O', 'Lower Ordovician', 'الأوردوفيشي الأسفل', '#1A9D6F', 470.0, 485.4, []],
    ['Cm', 'Furongian', 'الفورونجي', '#B3E095', 485.4, 497.0, []], ['Cm', 'Miaolingian', 'المياولينجي', '#A6CF86', 497.0, 509.0, []], ['Cm', 'Cambrian Series 2', 'السلسلة الكامبرية 2', '#99C078', 509.0, 521.0, []], ['Cm', 'Terreneuvian', 'التيرينوفي', '#8CB06C', 521.0, 538.8, []],
    ['pC', 'Precambrian', 'ما قبل الكامبري', '#F74370', 538.8, 4600, []]
  ];
  var AGE = {}; SER.forEach(function (s, i) { AGE['s' + i] = { per: s[0], ser: [s[1], s[2]], col: s[3], stg: null, top: s[4], base: s[5] };
    s[6].forEach(function (g, j) { AGE['s' + i + '_' + j] = { per: s[0], ser: [s[1], s[2]], col: s[3], stg: [g[0], g[1]], top: g[2], base: g[3] }; }); });
  var lighten = function (hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return 'rgb(' + [r, g, b].map(function (c) { return Math.round(c + (255 - c) * f); }).join(',') + ')'; };

  var units = SH.store.get(KEY, null), editIdx = -1;
  var hdr = SH.persist('strata2', ['geoName', 'cTitle', 'cLoc', 'cSrc', 'cScale', 'cProf', 'cTop', 'cAxis', 'cLang', 'cPer', 'cIcs']);
  if (!units) { // migrate the previous designer
    var old = SH.store.get('shandal_strata_beds', []), CM = { eros: 'erosive', unconf: 'uncon', uncert: 'covered', sharp: 'sharp', grad: 'grad' }, AM = { fossil: 'shell', xbed: 'xbed', ripple: 'ripple', nodule: 'nodule', bio: 'bioturb' };
    units = old.map(function (b) { var rk = b.rock === 'dolostone' ? 'dolomite' : b.rock, r2 = b.rock2 === 'dolostone' ? 'dolomite' : b.rock2; return { fm: b.fm === '—' ? '' : b.fm, grp: '', age: '', ageTxt: b.age || '', rock: R[rk] ? rk : 'limestone', sec: b.mix && R[r2] ? r2 : '', mix: b.mixStyle || 'inter', th: b.th, res: b.hard || 3, gs: '', base: CM[b.contact] || 'sharp', st: (b.acc || []).map(function (a) { return AM[a]; }).filter(Boolean), pet: [], col: '', desc: b.desc || '', com: '' }; });
    SH.store.set(KEY, units);
  }
  var FL = function () { return $('#cLang').value === 'ar'; }; // figure language
  var tf = function (en, ar) { return FL() ? ar : en; };
  var rname = function (k, ar) { return R[k] ? R[k][ar ? 1 : 0] : k; };

  /* ---------- form */
  (function () {
    var o = '<option value="">' + t('— Not specified —', '— غير محدد —') + '</option>', last = null;
    SER.forEach(function (s, i) { if (s[0] !== last) { if (last) o += '</optgroup>'; o += '<optgroup label="' + PER[s[0]][AR ? 1 : 0] + '">'; last = s[0]; }
      o += '<option value="s' + i + '">' + s[AR ? 2 : 1] + ' (' + s[4] + '–' + s[5] + ' Ma)</option>'; s[6].forEach(function (g, j) { o += '<option value="s' + i + '_' + j + '">   · ' + g[AR ? 1 : 0] + ' (' + g[2] + '–' + g[3] + ')</option>'; }); });
    $('#uAge').innerHTML = o + '</optgroup>';
    var ro = ST.GROUPS.map(function (g) { return '<optgroup label="' + SH.esc(g[AR ? 2 : 1]) + '">' + Object.keys(R).filter(function (k) { return R[k][5] === g[0]; }).map(function (k) { return '<option value="' + k + '">' + R[k][AR ? 1 : 0] + '</option>'; }).join('') + '</optgroup>'; }).join('');
    $('#uRock').innerHTML = ro; $('#uRock2').innerHTML = ro; $('#uRock').value = 'limestone'; $('#uRock2').value = 'marl';
    var gn = [t('clay', 'طين'), t('silt', 'غرين'), t('very fine sand', 'رمل ناعم جداً'), t('fine sand', 'رمل ناعم'), t('medium sand', 'رمل متوسط'), t('coarse sand', 'رمل خشن'), t('very coarse sand', 'رمل خشن جداً'), t('gravel / crystalline', 'حصى / متبلور')];
    $('#uGs').innerHTML = '<option value="">' + t('Typical of the rock', 'النموذجي للصخر') + '</option>' + gn.map(function (x, i) { return '<option value="' + i + '">' + ST.GS[i] + ' · ' + x + '</option>'; }).join('');
    $('#uBase').innerHTML = Object.keys(ST.CONTACTS).map(function (k) { return '<option value="' + k + '">' + ST.CONTACTS[k][AR ? 1 : 0] + '</option>'; }).join('');
    $('#uSt').innerHTML = ST.chips([], 'value', '.8rem');
  })();
  $('#uMix').addEventListener('change', function () { $('#uMixRow').hidden = !this.checked; });
  function readForm() {
    var u = { age: $('#uAge').value, grp: SH.val('uGrp').trim(), fm: SH.val('uFm').trim(), rock: $('#uRock').value, sec: $('#uMix').checked ? $('#uRock2').value : '', mix: $('#uMixS').value, th: SH.num('uTh'), gs: $('#uGs').value, res: +$('#uRes').value, base: $('#uBase').value,
      st: SH.$$('#uSt input:checked').map(function (i) { return i.value; }), pet: SH.$$('#uPet input:checked').map(function (i) { return i.value; }), col: SH.val('uCol').trim(), desc: SH.val('uDesc').trim(), com: SH.val('uCom').trim() };
    if (!(u.th > 0)) { SH.toast(t('Thickness must be greater than zero.', 'يجب أن يكون السمك أكبر من صفر.'), 'warn'); return null; }
    return u;
  }
  function loadForm(u) {
    $('#uAge').value = u.age || ''; $('#uGrp').value = u.grp || ''; $('#uFm').value = u.fm || ''; $('#uRock').value = u.rock; $('#uMix').checked = !!u.sec; $('#uMixRow').hidden = !u.sec; if (u.sec) $('#uRock2').value = u.sec; $('#uMixS').value = u.mix || 'inter';
    $('#uTh').value = u.th; $('#uGs').value = u.gs == null ? '' : u.gs; $('#uRes').value = u.res || 3; $('#uBase').value = u.base || 'sharp'; $('#uCol').value = u.col || ''; $('#uDesc').value = u.desc || ''; $('#uCom').value = u.com || '';
    SH.$$('#uSt input').forEach(function (i) { i.checked = (u.st || []).indexOf(i.value) > -1; }); SH.$$('#uPet input').forEach(function (i) { i.checked = (u.pet || []).indexOf(i.value) > -1; });
  }
  function save() { SH.store.set(KEY, units); renderTable(); draw(); narrative(); }
  $('#uAdd').addEventListener('click', function () { var u = readForm(); if (!u) return;
    if (editIdx > -1) { if (units[editIdx].hiatus) u.hiatus = true; units[editIdx] = u; editIdx = -1; $('#uAddTxt').textContent = t('Add unit', 'أضف الوحدة'); $('#uCancel').hidden = true; SH.toast(t('Unit updated.', 'حُدّثت الوحدة.'), 'ok'); }
    else units.push(u); $('#uDesc').value = ''; save(); });
  $('#uCancel').addEventListener('click', function () { editIdx = -1; $('#uAddTxt').textContent = t('Add unit', 'أضف الوحدة'); $('#uCancel').hidden = true; });
  $('#uHiatus').addEventListener('click', function () { units.push({ hiatus: true, age: $('#uAge').value, grp: '', fm: '', rock: 'limestone', sec: '', th: Math.max(1, SH.num('uTh') || 5), base: 'uncon', st: [], pet: [], desc: '', com: '' }); save(); SH.toast(t('Hiatus added: set its age and position in the table.', 'أُضيفت الفجوة: حدد عمرها وموضعها في الجدول.'), 'ok'); });
  ['cScale', 'cProf', 'cTop', 'cAxis', 'cLang', 'cPer', 'cIcs', 'cTitle', 'cLoc', 'cSrc', 'geoName'].forEach(function (id) { $('#' + id).addEventListener('change', function () { draw(); narrative(); }); });
  $('#cCols').addEventListener('change', draw);

  /* ---------- table */
  function ageLabel(u, ar) { var a = AGE[u.age]; if (!a) return u.ageTxt || ''; return a.stg ? a.stg[ar ? 1 : 0] : a.ser[ar ? 1 : 0]; }
  function renderTable() {
    var top = SH.num('cTop') || 0, rows = units.map(function (u, i) { var r = '<tr><td>' + (i + 1) + '</td><td>' + SH.esc(ageLabel(u, AR) || '—') + '</td><td>' + SH.esc(u.grp || '') + '</td><td><b>' + SH.esc(u.hiatus ? t('Hiatus', 'فجوة ترسيبية') : (u.fm || '—')) + '</b></td><td style="white-space:normal;min-width:160px">' + (u.hiatus ? '—' : '<span style="display:inline-block;width:11px;height:11px;border:1px solid #555;border-radius:2px;background:' + R[u.rock][2] + ';margin-inline-end:6px;vertical-align:-1px"></span>' + rname(u.rock, AR) + (u.sec ? (u.mix === 'inter' ? t(' with interbeds of ', ' مع تعاقبات من ') : t(' with ', ' مع ')) + rname(u.sec, AR) : '')) + '</td>' +
        '<td class="num">' + SH.fmt(u.th, 1) + '</td><td class="num">' + SH.fmt(top, 1) + '</td><td class="num">' + SH.fmt(top + u.th, 1) + '</td><td>' + (ST.CONTACTS[u.base] || ['', ''])[AR ? 1 : 0] + '</td><td>' + (u.pet || []).map(function (p) { return { oil: t('oil', 'نفط'), gas: t('gas', 'غاز'), src: t('source', 'مصدرية'), seal: t('seal', 'غطائية') }[p]; }).join('، ') + '</td>' +
        '<td data-noexport style="white-space:nowrap"><button class="x" data-a="up" data-i="' + i + '" type="button" aria-label="' + t('Move up', 'للأعلى') + '">↑</button><button class="x" data-a="down" data-i="' + i + '" type="button" aria-label="' + t('Move down', 'للأسفل') + '">↓</button><button class="x" data-a="edit" data-i="' + i + '" type="button" aria-label="' + t('Edit', 'تعديل') + '">✎</button><button class="x" data-a="del" data-i="' + i + '" type="button" aria-label="' + t('Delete', 'حذف') + '">✕</button></td></tr>'; top += u.th; return r; });
    $('#uTable').innerHTML = '<thead><tr><th>No.</th><th>' + t('Age', 'العمر') + '</th><th>' + t('Group', 'المجموعة') + '</th><th>' + t('Formation', 'التكوين') + '</th><th>' + t('Lithology', 'الصخارية') + '</th><th class="num">' + t('Thick. m', 'السمك م') + '</th><th class="num">' + t('Top m', 'القمة م') + '</th><th class="num">' + t('Base m', 'القاعدة م') + '</th><th>' + t('Lower contact', 'الحد السفلي') + '</th><th>' + t('Petroleum', 'بترولي') + '</th><th data-noexport></th></tr></thead><tbody>' + rows.join('') + '</tbody>';
    $('#uEmpty').hidden = units.length > 0;
    var tot = units.reduce(function (a, u) { return a + u.th; }, 0), fms = units.map(function (u) { return u.fm; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }), ages = units.map(function (u) { return AGE[u.age]; }).filter(Boolean);
    var span = ages.length ? ages.reduce(function (m, a) { return { top: Math.min(m.top, a.top), base: Math.max(m.base, a.base) }; }, { top: 1e9, base: -1 }) : null;
    $('#cKpis').innerHTML = '<div class="kpi info"><span class="k">' + t('Units', 'الوحدات') + '</span><span class="v">' + units.length + '</span><span class="s">' + t('top to bottom', 'من الأعلى للأسفل') + '</span></div><div class="kpi"><span class="k">' + t('Total thickness', 'السمك الكلي') + '</span><span class="v">' + SH.fmt(tot, 1) + '<small> m</small></span><span class="s">' + SH.fmt(top - tot, 0) + '–' + SH.fmt(top, 0) + ' m</span></div>' +
      '<div class="kpi"><span class="k">' + t('Formations', 'التكوينات') + '</span><span class="v">' + fms.length + '</span><span class="s">' + SH.esc(fms.slice(0, 3).join(' · ') || '—') + '</span></div><div class="kpi"><span class="k">' + t('Time span', 'المدى الزمني') + '</span><span class="v">' + (span ? SH.fmt(span.base - span.top, 1) + '<small> Myr</small>' : '—') + '</span><span class="s">' + (span ? '<bdi>' + span.top + '–' + span.base + ' Ma</bdi>' : t('ages not set', 'لم تُحدد الأعمار')) + '</span></div>';
  }
  $('#uTable').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var i = +b.getAttribute('data-i'), a = b.getAttribute('data-a');
    if (a === 'del') units.splice(i, 1); else if (a === 'up' && i > 0) units.splice(i - 1, 0, units.splice(i, 1)[0]); else if (a === 'down' && i < units.length - 1) units.splice(i + 1, 0, units.splice(i, 1)[0]);
    else if (a === 'edit') { editIdx = i; loadForm(units[i]); $('#uAddTxt').textContent = t('Save changes', 'احفظ التعديل'); $('#uCancel').hidden = false; $('#uFm').focus(); return; } save(); });
  $('#uClear').addEventListener('click', function () { if (units.length) SH.confirm(t('Delete every unit in this column?', 'هل تريد حذف جميع وحدات العمود؟')).then(function (ok) { if (ok) { units = []; save(); } }); });
  $('#uCsv').addEventListener('click', function () { var top = SH.num('cTop') || 0; SH.csv('shandal-stratigraphic-column.csv', [['no', 'system', 'series', 'stage', 'group', 'formation', 'lithology', 'secondary', 'thickness_m', 'top_m', 'base_m', 'lower_contact', 'petroleum', 'description', 'event']].concat(units.map(function (u, i) { var a = AGE[u.age] || {}, r = [i + 1, a.per ? PER[a.per][0] : '', a.ser ? a.ser[0] : '', a.stg ? a.stg[0] : '', u.grp || '', u.hiatus ? 'Hiatus' : u.fm || '', u.hiatus ? '' : rname(u.rock), u.sec ? rname(u.sec) : '', u.th, top, top + u.th, u.base, (u.pet || []).join(' '), descOf(u, false), u.com || '']; top += u.th; return r; }))); });

  /* ---------- descriptions */
  var GSN = [['clay', 'طين'], ['silt', 'غرين'], ['very fine-grained', 'ناعم جداً'], ['fine-grained', 'ناعم الحبيبات'], ['medium-grained', 'متوسط الحبيبات'], ['coarse-grained', 'خشن الحبيبات'], ['very coarse-grained', 'خشن جداً'], ['gravelly / crystalline', 'حصوي / متبلور']];
  function descOf(u, ar) {
    if (u.hiatus) return ar ? 'فجوة ترسيبية' : 'Hiatus';
    if (u.desc) return u.desc;
    var g = R[u.rock][5], s = rname(u.rock, ar);
    if (u.col) s = ar ? s + ' ' + u.col : u.col.charAt(0).toUpperCase() + u.col.slice(1) + ' ' + s.toLowerCase();
    if (u.gs !== '' && u.gs != null && (g === 'clastic' || g === 'unc')) s += (ar ? '، ' : ', ') + GSN[+u.gs][ar ? 1 : 0];
    if (u.sec) s += u.mix === 'inter' ? (ar ? '، مع تعاقبات من ' : ', with interbeds of ') + rname(u.sec, ar).toLowerCase() : (ar ? '، مع ' : ', with ') + rname(u.sec, ar).toLowerCase();
    var st = (u.st || []).filter(function (k) { return ST.STRUCT[k]; }).map(function (k) { var n = ST.STRUCT[k][ar ? 1 : 0]; return ar ? n : n.charAt(0).toLowerCase() + n.slice(1); }); if (st.length) s += (ar ? '؛ ' : '; ') + st.join(ar ? '، ' : ', ');
    return s;
  }

  /* ---------- drawing */
  function wrap(s, n) { var w = String(s || '').split(/\s+/), out = [''], i; for (i = 0; i < w.length; i++) { if (!w[i]) continue; if ((out[out.length - 1] + ' ' + w[i]).trim().length > n && out[out.length - 1]) out.push(w[i]); else out[out.length - 1] = (out[out.length - 1] + ' ' + w[i]).trim(); } return out; }
  var isAr = function (s) { return /[؀-ۿ]/.test(String(s)); };
  function tx(S, x, y, s, a) { a = Object.assign({ fill: INK, 'font-size': 11 }, a || {}); if (isAr(s)) { a.direction = 'rtl'; if (a['text-anchor'] === 'end') a['text-anchor'] = 'start'; else if (a['text-anchor'] !== 'middle') a['text-anchor'] = 'end'; s = String(s).replace(/[A-Za-z0-9][A-Za-z0-9 .,:\/°′″±+\-×()–]*[A-Za-z0-9°′″)]|[A-Za-z0-9]/g, function (m) { return '⁦' + m + '⁩'; }); } else a.direction = 'ltr'; return S.text(x, y, s, a); }
  function draw() {
    var S = SH.svgB('colSvg'), defs = S.add('defs', {}), ar = FL(), trad = $('#cPer').value === 'trad', ics = $('#cIcs').checked;
    var on = {}; SH.$$('#cCols input').forEach(function (i) { on[i.value] = i.checked; });
    if (!units.length) { S.el.setAttribute('viewBox', '0 0 1000 300'); S.add('rect', { x: 0, y: 0, width: 1000, height: 300, fill: '#fff' }); tx(S, 500, 150, tf('Add units to draw the column', 'أضف وحدات لرسم العمود'), { 'text-anchor': 'middle', fill: MUT, 'font-size': 14 }); return; }
    // columns
    var C = [], add = function (k, w, h) { C.push({ k: k, w: w, h: h }); };
    if (on.sys) add('sys', 40, tf('System', 'النظام')); if (on.ser) add('ser', 98, tf('Series', 'السلسلة')); if (on.stg) add('stg', 96, tf('Stage', 'الطابق')); if (on.grp) add('grp', 40, tf('Group', 'المجموعة')); if (on.fm) add('fm', 118, tf('Formation', 'التكوين'));
    add('dep', 54, $('#cAxis').value === 'thk' ? tf('Thick-ness (m)', 'السمك (م)') : tf('Depth (m)', 'العمق (م)')); add('lith', 160, tf('Lithology', 'الصخارية')); if (on.thk) add('thk', 48, tf('Thick. (m)', 'السمك (م)'));
    if (on.desc) add('desc', 0, tf('Lithological description', 'الوصف الصخاري')); if (on.env) add('env', 140, tf('Depositional environment', 'البيئة الترسيبية')); if (on.pet) add('pet', 64, tf('Petroleum system', 'النظام البترولي')); if (on.com) add('com', 150, tf('Events / comments', 'الأحداث والملاحظات'));
    var fixed = C.reduce(function (a, c) { return a + c.w; }, 0), W = Math.max(1000, fixed + (on.desc ? 230 : 0) + 40); C.forEach(function (c) { if (c.k === 'desc') c.w = W - 40 - fixed; });
    var x = 20; C.forEach(function (c) { c.x = x; x += c.w; }); var X0 = 20, X1 = W - 20, col = function (k) { return C.filter(function (c) { return c.k === k; })[0]; };
    // heights
    var total = units.reduce(function (a, u) { return a + u.th; }, 0), sch = $('#cScale').value === 'sch', dw = on.desc ? Math.max(20, Math.floor(col('desc').w / 6.2)) : 40;
    var need = units.map(function (u) { return on.desc ? Math.max(1, wrap(descOf(u, ar), dw).length) * 12 + 10 : 20; }), Hs, hs;
    if (sch) { var base = Math.max(900, units.length * 30); hs = units.map(function (u, i) { return Math.max(need[i], 22, base * u.th / total * 0.6); }); }
    else { Hs = SH.clamp(total * 6, 700, 1900); hs = units.map(function (u) { return u.th * Hs / total; }); }
    var TOP = 132, HH = 46, y0 = TOP + HH, ys = [y0]; hs.forEach(function (h) { ys.push(ys[ys.length - 1] + h); }); var yb = ys[ys.length - 1];
    var used = { rock: {}, contact: {}, st: {}, pet: {} }; units.forEach(function (u) { if (u.hiatus) { used.hiatus = 1; return; } used.rock[u.rock] = 1; if (u.sec) used.rock[u.sec] = 1; used.contact[u.base || 'sharp'] = 1; (u.st || []).forEach(function (k) { if (ST.STRUCT[k]) used.st[k] = 1; }); (u.pet || []).forEach(function (p) { used.pet[p] = 1; }); });
    var leg = Object.keys(used.rock).length + Object.keys(used.contact).length + Object.keys(used.st).length + Object.keys(used.pet).length + (used.hiatus ? 1 : 0), legRows = Math.ceil(leg / 4);
    var VH = yb + 70 + legRows * 26 + 60; S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); S.add('rect', { x: 0, y: 0, width: W, height: VH, fill: '#fff' });
    // title block
    tx(S, W / 2, 40, SH.val('cTitle') || tf('Stratigraphic column', 'العمود الطباقي'), { 'font-size': 20, 'font-weight': 800, 'text-anchor': 'middle' });
    var sub = [SH.val('cLoc'), SH.val('cSrc')].filter(Boolean).join(' · '); if (sub) tx(S, W / 2, 64, sub, { 'font-size': 12.5, fill: MUT, 'text-anchor': 'middle' });
    tx(S, W / 2, 86, (sch ? tf('Schematic vertical scale', 'مقياس رأسي تخطيطي') : tf('Vertical scale 1 : ', 'المقياس الرأسي 1 : ') + SH.fmt(Math.round(total * 1000 / ((yb - y0) * 0.26) / 10) * 10, 0) + tf(' (A4 width)', ' (بعرض A4)')) + ' · ' + tf('Total thickness ', 'السمك الكلي ') + SH.fmt(total, 1) + ' m', { 'font-size': 11, fill: MUT, 'text-anchor': 'middle' });
    // header
    S.add('rect', { x: X0, y: TOP, width: X1 - X0, height: HH, fill: '#F2F0EA', stroke: INK, 'stroke-width': 1.2 });
    C.forEach(function (c) { var lines = c.k === 'sys' || c.k === 'grp' ? [c.h] : wrap(c.h, Math.max(6, Math.floor(c.w / 7.2))); if (c.k === 'sys' || c.k === 'grp') { var cxh = c.x + c.w / 2, cyh = TOP + HH / 2; tx(S, cxh, cyh + 4, c.h, { 'font-size': 10, 'font-weight': 800, 'text-anchor': 'middle', transform: 'rotate(-90 ' + cxh + ' ' + cyh + ')' }); }
      else lines.slice(0, 3).forEach(function (l, i) { tx(S, c.x + c.w / 2, TOP + HH / 2 + 4 + (i - (Math.min(lines.length, 3) - 1) / 2) * 13, l, { 'font-size': 11, 'font-weight': 800, 'text-anchor': 'middle' }); });
      S.line(c.x, TOP, c.x, yb, { stroke: INK, 'stroke-width': 1 }); });
    S.add('rect', { x: X0, y: TOP, width: X1 - X0, height: yb - TOP, fill: 'none', stroke: INK, 'stroke-width': 1.4 });
    // merged age, group and formation cells
    var spans = function (fn) { var out = [], s = 0; for (var i = 1; i <= units.length; i++) { if (i === units.length || fn(units[i]) !== fn(units[s])) { out.push({ a: s, b: i - 1, v: fn(units[s]) }); s = i; } } return out; };
    var cell = function (c, sp, label, fill, rot, style) { var ya = ys[sp.a], ybb = ys[sp.b + 1], hh = ybb - ya; S.add('rect', { x: c.x, y: ya, width: c.w, height: hh, fill: fill || '#fff', stroke: INK, 'stroke-width': .8 }); if (!label) return;
      var fs = Math.min(style && style.fs || 11, rot ? Math.max(7, hh / Math.max(4, label.length) * 1.6) : 11); if (!rot && hh < 10) return; if (rot && hh < 22) return;
      if (rot) { var cx2 = c.x + c.w / 2, cy2 = ya + hh / 2; tx(S, cx2, cy2 + fs / 3, label, { 'font-size': fs, 'font-weight': 800, 'text-anchor': 'middle', 'letter-spacing': .5, transform: 'rotate(-90 ' + cx2 + ' ' + cy2 + ')' }); }
      else { var all = wrap(label, Math.max(6, Math.floor(c.w / 6.6))), lh = all.length > 1 && hh < 2 * 13 + 2 ? 9.5 : 13; if (lh < 13) all = wrap(label, Math.max(6, Math.floor(c.w / 5.2))); var ln = all.slice(0, Math.max(1, Math.floor((hh + 2) / lh))); ln.forEach(function (l, i) { tx(S, c.x + c.w / 2, ya + hh / 2 + 3.5 + (i - (ln.length - 1) / 2) * lh, l, Object.assign({ 'font-size': lh < 13 ? 8.5 : hh < 14 ? 9 : 11, 'text-anchor': 'middle', 'font-weight': style && style.bold ? 800 : 600 }, style && style.italic ? { 'font-style': 'italic' } : {})); }); } };
    var perOf = function (u) { var a = AGE[u.age]; if (!a) return ''; return trad && PER[a.per][3] ? a.per === 'Q' ? 'Q' : 'T' : a.per; }, perName = function (k) { if (k === 'T') return tf('TERTIARY', 'الثلاثي'); if (!k) return ''; var p = PER[k]; return ar ? p[1] : p[0].toUpperCase(); }, perCol = function (k) { return k === 'T' ? '#FDB462' : k ? PER[k][2] : '#fff'; };
    if (on.sys) spans(perOf).forEach(function (sp) { cell(col('sys'), sp, perName(sp.v), ics && sp.v ? lighten(perCol(sp.v), .35) : '#fff', true); });
    if (on.ser) spans(function (u) { var a = AGE[u.age]; return a ? a.ser[0] : ''; }).forEach(function (sp) { var a = AGE[units[sp.a].age]; cell(col('ser'), sp, a ? a.ser[ar ? 1 : 0] : '', ics && a ? lighten(a.col, .3) : '#fff', false, { bold: true }); });
    if (on.stg) spans(function (u) { var a = AGE[u.age]; return a && a.stg ? a.stg[0] : ''; }).forEach(function (sp) { var a = AGE[units[sp.a].age]; cell(col('stg'), sp, a && a.stg ? a.stg[ar ? 1 : 0] : '', ics && a ? lighten(a.col, .6) : '#fff'); });
    if (on.grp) spans(function (u) { return u.grp || ''; }).forEach(function (sp) { cell(col('grp'), sp, sp.v.toUpperCase(), '#fff', true); });
    if (on.fm) spans(function (u) { return u.hiatus ? '§hiatus' + Math.random() : u.fm || ''; }).forEach(function (sp) { var u = units[sp.a]; cell(col('fm'), sp, u.hiatus ? tf('Hiatus', 'فجوة ترسيبية') : sp.v, '#fff', false, u.hiatus ? { italic: true } : { bold: false }); });
    if (on.com) spans(function (u) { return u.com || ''; }).forEach(function (sp) { cell(col('com'), sp, sp.v, '#fff', false, { italic: false }); });
    // depth scale
    var dc = col('dep'), top0 = SH.num('cTop') || 0, axThk = $('#cAxis').value === 'thk', dval = function (d) { return axThk ? total - d : top0 + d; };
    if (!sch) { var step = (function (r) { var raw = r / 12, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; })(total), pxm = (yb - y0) / total;
      for (var dv = 0; dv <= total + 1e-9; dv += step) { var yy = y0 + dv * pxm; S.line(dc.x + dc.w - 8, yy, dc.x + dc.w, yy, { stroke: INK }); tx(S, dc.x + dc.w - 11, yy + 4, SH.fmt(dval(dv), step < 1 ? 1 : 0), HALO({ 'font-size': 10, fill: MUT, 'text-anchor': 'end' })); }
      for (dv = 0; dv <= total + 1e-9; dv += step / 5) { yy = y0 + dv * pxm; S.line(dc.x + dc.w - 4, yy, dc.x + dc.w, yy, { stroke: INK, 'stroke-width': .6 }); } }
    else { var cum = 0; ys.forEach(function (yy, i) { S.line(dc.x + dc.w - 8, yy, dc.x + dc.w, yy, { stroke: INK }); if (i === 0 || ys[i] - ys[i - 1] >= 13) tx(S, dc.x + dc.w - 11, yy + (i === 0 ? 10 : 4), SH.fmt(dval(cum), cum % 1 ? 1 : 0), HALO({ 'font-size': 9.5, fill: MUT, 'text-anchor': 'end' })); if (i < units.length) cum += units[i].th; }); }
    // lithology
    var lc = col('lith'), prof = $('#cProf').value;
    units.forEach(function (u, i) { var ya = ys[i], h = hs[i];
      if (u.hiatus) { S.add('rect', { x: lc.x, y: ya, width: lc.w, height: h, fill: '#fff' }); if (h >= 12) tx(S, lc.x + lc.w / 2, ya + h / 2 + 4, tf('Hiatus', 'فجوة ترسيبية'), { 'font-size': 11, 'font-style': 'italic', 'font-weight': 700, 'text-anchor': 'middle' }); return; }
      var r = R[u.rock], g = u.gs !== '' && u.gs != null ? +u.gs : r[4], w = prof === 'res' ? lc.w * (0.35 + 0.65 * ((u.res || 3) - 1) / 4) : prof === 'gs' ? lc.w * (0.3 + 0.7 * g / 7) : lc.w, id = 'lp' + i;
      ST.pattern(S, defs, id, r[3]); S.add('rect', { x: lc.x, y: ya, width: w, height: h, fill: r[2] }); S.add('rect', { x: lc.x, y: ya, width: w, height: h, fill: 'url(#' + id + ')' });
      if (u.sec && R[u.sec]) { var id2 = id + 's'; ST.pattern(S, defs, id2, R[u.sec][3]); if (u.mix === 'inter') { var bd = SH.clamp(h / 6, 3, 12); for (var k = bd; k < h - .5; k += 2 * bd) { var hh = Math.min(bd, h - k); S.add('rect', { x: lc.x, y: ya + k, width: w, height: hh, fill: R[u.sec][2] }); S.add('rect', { x: lc.x, y: ya + k, width: w, height: hh, fill: 'url(#' + id2 + ')' }); S.line(lc.x, ya + k, lc.x + w, ya + k, { stroke: INK, 'stroke-width': .35 }); } } else S.add('rect', { x: lc.x, y: ya, width: w, height: h, fill: 'url(#' + id2 + ')', opacity: .6 }); }
      S.add('rect', { x: lc.x, y: ya, width: w, height: h, fill: 'none', stroke: INK, 'stroke-width': .9 });
      var st = (u.st || []).filter(function (k) { return ST.STRUCT[k]; }); st.slice(0, Math.max(1, Math.floor(h / 18))).forEach(function (k, j) { var sx = lc.x + w - 14 - (j % 3) * 20, sy = ya + Math.min(h / 2, 12) + Math.floor(j / 3) * 18; if (h < 14) return; S.add('rect', { x: sx - 9, y: sy - 9, width: 18, height: 18, rx: 3, fill: '#fff', opacity: .85 }); ST.symbol(S, null, k, sx, sy, ST.scol(k)); });
    });
    // grid row lines in text columns
    units.forEach(function (u, i) { var yy = ys[i + 1]; C.forEach(function (c) { if (['sys', 'ser', 'stg', 'grp', 'fm', 'com', 'dep', 'lith'].indexOf(c.k) < 0) S.line(c.x, yy, c.x + c.w, yy, { stroke: GRID, 'stroke-width': .6 }); }); });
    // per-unit text columns
    units.forEach(function (u, i) { var ya = ys[i], h = hs[i];
      if (on.thk) { var tc = col('thk'); if (h >= 10) tx(S, tc.x + tc.w / 2, ya + h / 2 + 4, SH.fmt(u.th, u.th < 10 ? 1 : 0), { 'font-size': h < 14 ? 9 : 10.5, 'text-anchor': 'middle' }); }
      if (on.desc) { var c = col('desc'), ln = wrap(descOf(u, ar), dw), maxL = Math.max(1, Math.floor((h - 4) / 12)); if (h >= 10) ln.slice(0, maxL).forEach(function (l, j) { var last = j === maxL - 1 && ln.length > maxL; tx(S, ar ? c.x + c.w - 6 : c.x + 6, ya + h / 2 + 4 + (j - (Math.min(ln.length, maxL) - 1) / 2) * 12, l + (last ? '…' : ''), { 'font-size': h < 14 ? 9 : 10.5, fill: u.hiatus ? MUT : INK, 'font-style': u.hiatus ? 'italic' : 'normal', 'text-anchor': ar ? 'end' : 'start' }); }); }
      if (on.env) { var ec = col('env'), ev = u.hiatus ? '' : ST.facies(u, ar ? 'ar' : 'en'); var el = wrap(ev, Math.floor(ec.w / 6)), ml = Math.max(1, Math.floor((h - 4) / 11)); if (h >= 10) el.slice(0, ml).forEach(function (l, j) { tx(S, ar ? ec.x + ec.w - 5 : ec.x + 5, ya + h / 2 + 4 + (j - (Math.min(el.length, ml) - 1) / 2) * 11, l + (j === ml - 1 && el.length > ml ? '…' : ''), { 'font-size': 9.5, fill: MUT, 'text-anchor': ar ? 'end' : 'start' }); }); }
      if (on.pet && (u.pet || []).length && h >= 8) { var pc = col('pet'), n = u.pet.length; u.pet.forEach(function (p, j) { var px = pc.x + pc.w / 2 + (j - (n - 1) / 2) * 15, py = ya + h / 2; petSym(S, p, px, py); }); }
    });
    // contacts (unconformities across the whole chart)
    units.forEach(function (u, i) { if (i === units.length - 1 && u.base !== 'uncon') return; var yy = ys[i + 1], kind = u.base || 'sharp';
      if (kind === 'uncon') { wavy(S, X0, X1, yy, '#C0392B', 1.6); }
      else if (!units[i].hiatus) { var w2 = lc.w; ST.contact(S, null, kind === 'erosive' ? 'erosive' : kind, lc.x, lc.x + w2, yy); } });
    // explanation
    var ly = yb + 34; tx(S, ar ? X1 : X0, ly, tf('EXPLANATION', 'مفتاح الرموز'), { 'font-size': 13, 'font-weight': 800, 'letter-spacing': ar ? 0 : 1.5, 'text-anchor': ar ? 'end' : 'start' });
    var items = []; Object.keys(used.rock).forEach(function (k) { items.push([function (x, y) { var id = 'lg' + k; ST.pattern(S, defs, id, R[k][3]); S.add('rect', { x: x, y: y - 9, width: 36, height: 18, fill: R[k][2], stroke: INK, 'stroke-width': .7 }); S.add('rect', { x: x, y: y - 9, width: 36, height: 18, fill: 'url(#' + id + ')', stroke: INK, 'stroke-width': .7 }); }, rname(k, ar)]); });
    Object.keys(used.contact).forEach(function (k) { items.push([function (x, y) { if (k === 'uncon') wavy(S, x, x + 36, y, '#C0392B', 1.6); else ST.contact(S, null, k, x, x + 36, y); }, k === 'uncon' ? tf('Unconformity', 'عدم توافق') : ST.CONTACTS[k][ar ? 1 : 0]]); });
    if (used.hiatus) items.push([function (x, y) { S.add('rect', { x: x, y: y - 9, width: 36, height: 18, fill: '#fff', stroke: INK, 'stroke-width': .7 }); tx(S, x + 18, y + 4, 'H', { 'font-size': 10, 'font-style': 'italic', 'text-anchor': 'middle' }); }, tf('Hiatus (missing section)', 'فجوة ترسيبية (مقطع مفقود)')]);
    Object.keys(used.st).forEach(function (k) { items.push([function (x, y) { ST.symbol(S, null, k, x + 18, y, ST.scol(k)); }, ST.STRUCT[k][ar ? 1 : 0]]); });
    var PN = { oil: tf('Oil reservoir', 'مكمن نفطي'), gas: tf('Gas reservoir', 'مكمن غازي'), src: tf('Source rock', 'صخرة مصدرية'), seal: tf('Seal rock', 'صخرة غطائية') };
    Object.keys(used.pet).forEach(function (k) { items.push([function (x, y) { petSym(S, k, x + 18, y); }, PN[k]]); });
    var cw = (X1 - X0) / 4; items.forEach(function (it, i) { var y2 = ly + 26 + Math.floor(i / 4) * 26, x2 = ar ? X1 - (i % 4) * cw - 36 : X0 + (i % 4) * cw; it[0](x2, y2); tx(S, ar ? x2 - 10 : x2 + 46, y2 + 4, it[1], { 'font-size': 10.5, 'text-anchor': ar ? 'end' : 'start' }); });
    tx(S, ar ? X1 : X0, VH - 18, 'Shandal System · ' + new Date().toISOString().slice(0, 10) + (SH.val('geoName') ? ' · ' + SH.val('geoName') : ''), { 'font-size': 9.5, fill: MUT, 'text-anchor': ar ? 'end' : 'start' });
  }
  function HALO(a) { return Object.assign(a, { stroke: '#fff', 'stroke-width': 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }); }
  function wavy(S, x1, x2, y, col, w) { var n = Math.max(4, Math.round((x2 - x1) / 12)), d = 'M' + x1 + ' ' + y, s = (x2 - x1) / n; for (var i = 0; i < n; i++) d += 'q' + s / 2 + ' ' + (i % 2 ? 4 : -4) + ' ' + s + ' 0'; S.path(d, { stroke: col, 'stroke-width': w, fill: 'none' }); }
  function petSym(S, p, x, y) { if (p === 'oil') S.add('ellipse', { cx: x, cy: y, rx: 6, ry: 4.5, fill: '#2E9E4F', stroke: '#1F6B36', 'stroke-width': .8 }); else if (p === 'gas') S.add('ellipse', { cx: x, cy: y, rx: 6, ry: 4.5, fill: '#D93A2B', stroke: '#8E2219', 'stroke-width': .8 });
    else if (p === 'src') S.add('rect', { x: x - 9, y: y - 3.5, width: 18, height: 7, fill: '#111' }); else if (p === 'seal') S.add('rect', { x: x - 9, y: y - 2.5, width: 18, height: 5, fill: '#B5835A' }); }

  /* ---------- description and interpretation */
  function narrative() {
    if (!units.length) { $('#cNarr').innerHTML = '<p class="muted">' + t('The description is written once units are added.', 'يُكتب الوصف عند إضافة الوحدات.') + '</p>'; return; }
    var top0 = SH.num('cTop') || 0, P = function (s) { return '<p>' + s + '</p>'; }, b = function (s) { return '<b>' + s + '</b>'; }, html = '', d = top0, rows = units.map(function (u) { var r = { u: u, top: d, base: d + u.th }; d += u.th; return r; }), total = d - top0;
    var dated = units.map(function (u) { return AGE[u.age]; }).filter(Boolean), young = dated.length ? dated.reduce(function (m, a) { return a.top < m.top ? a : m; }) : null, old = dated.length ? dated.reduce(function (m, a) { return a.base > m.base ? a : m; }) : null;
    var fmOrder = []; rows.slice().reverse().forEach(function (r) { var k = r.u.hiatus ? null : (r.u.fm || ''); if (k && fmOrder.indexOf(k) < 0) fmOrder.push(k); });
    var al = function (a) { return a ? (a.stg ? a.stg[AR ? 1 : 0] + ' (' + a.ser[AR ? 1 : 0] + ')' : a.ser[AR ? 1 : 0]) : ''; };
    html += '<h3 style="margin:0 0 6px">' + t('1. General', 'أولاً: الإطار العام') + '</h3>' + P(t('The column comprises ', 'يتألف العمود من ') + b(units.filter(function (u) { return !u.hiatus; }).length) + t(' units with a total thickness of ', ' وحدة بسمك كلي ') + b('<bdi>' + SH.fmt(total, 1) + ' m</bdi>') + t(' between depths of ', ' بين العمقين ') + '<bdi>' + SH.fmt(top0, 0) + '</bdi>' + t(' and ', ' و') + '<bdi>' + SH.fmt(top0 + total, 0) + ' m</bdi>' + (old && young ? t(', spanning from the ', '، ويغطي المدى الزمني من ') + al(old) + t(' to the ', ' حتى ') + al(young) + ' (' + '<bdi>' + young.top + '–' + old.base + ' Ma</bdi>)' : '') + '.' + (fmOrder.length ? t(' In stratigraphic order, from oldest to youngest, the formations are: ', ' والتكوينات بحسب ترتيبها الطباقي من الأقدم إلى الأحدث: ') + fmOrder.join(AR ? '، ' : ', ') + '.' : ''));
    // per formation (oldest first)
    html += '<h3 style="margin:14px 0 6px">' + t('2. Lithostratigraphic description', 'ثانياً: الوصف الصخري الطباقي') + '</h3>';
    var groups = []; rows.forEach(function (r) { var k = r.u.hiatus ? '§h' : (r.u.fm || '—'), g = groups[groups.length - 1]; if (g && g.k === k && k !== '§h') g.rows.push(r); else groups.push({ k: k, rows: [r] }); });
    groups.slice().reverse().forEach(function (g) {
      var r0 = g.rows[0], rN = g.rows[g.rows.length - 1], th = rN.base - r0.top, u0 = r0.u, a = AGE[u0.age];
      if (g.k === '§h') { html += P(b(t('Hiatus', 'فجوة ترسيبية')) + (a ? ' (' + al(a) + ')' : '') + t(': the interval is not represented in the section; deposition was interrupted or the strata were removed by erosion.', ': هذا الفاصل غير ممثل في المقطع؛ إذ توقف الترسيب أو أُزيلت الطبقات بالتعرية.')); return; }
      var liths = g.rows.slice().reverse().map(function (r) { return descOf(r.u, AR).replace(/^./, function (c) { return AR ? c : c.toLowerCase(); }); });
      var env = []; g.rows.forEach(function (r) { var f = ST.facies(r.u); if (f && env.indexOf(f) < 0) env.push(f); });
      var baseC = rN.u.base || 'sharp', pet = []; g.rows.forEach(function (r) { (r.u.pet || []).forEach(function (p) { if (pet.indexOf(p) < 0) pet.push(p); }); });
      html += P(b((g.k === '—' ? t('Unnamed unit', 'وحدة غير مسماة') : g.k + (AR ? '' : ' Formation')).replace(/^/, AR && g.k !== '—' ? 'تكوين ' : '')) + (a ? ' — ' + al(a) : '') + ' (<bdi>' + SH.fmt(r0.top, 0) + '–' + SH.fmt(rN.base, 0) + ' m</bdi>' + t(', thickness ', '، بسمك ') + '<bdi>' + SH.fmt(th, 1) + ' m</bdi>)' + t(': consists, from base to top, of ', ': يتألف من القاعدة إلى القمة من ') + liths.join(AR ? '؛ ثم ' : '; then ') + '. ' +
        (AR ? 'وحدّه السفلي ' + (ST.CONTACTS[baseC] || ST.CONTACTS.sharp)[1] : 'Its lower boundary is ' + (function (n) { n = n.toLowerCase(); return (/^[aeiou]/.test(n) ? 'an ' : 'a ') + n; })((ST.CONTACTS[baseC] || ST.CONTACTS.sharp)[0])) + '. ' + (env.length ? t('Depositional setting: ', 'البيئة الترسيبية: ') + env.join(' ') + ' ' : '') +
        (pet.length ? t('Petroleum-system role: ', 'دوره في النظام البترولي: ') + pet.map(function (p) { return { oil: t('oil reservoir', 'مكمن نفطي'), gas: t('gas reservoir', 'مكمن غازي'), src: t('source rock', 'صخرة مصدرية'), seal: t('seal', 'صخرة غطائية') }[p]; }).join(AR ? '، ' : ', ') + '.' : ''));
    });
    // depositional evolution (bottom to top)
    var cls = function (u) { var g = R[u.rock][5]; return g === 'carb' ? 'carb' : g === 'evap' ? 'evap' : g === 'chem' ? 'chem' : g === 'ign' ? 'ign' : g === 'meta' ? 'meta' : 'clastic'; };
    var seq = rows.filter(function (r) { return !r.u.hiatus; }).slice().reverse(), ev = [];
    for (var i = 1; i < seq.length; i++) { var lo = seq[i - 1], up = seq[i], c0 = cls(lo.u), c1 = cls(up.u), at = '<bdi>' + SH.fmt(up.base, 0) + ' m</bdi>';
      if (c0 === 'clastic' && c1 === 'carb') ev.push(t('At ', 'عند ') + at + t(' carbonates replace siliciclastics upward (', ' تحل الكربونات محل الفتاتيات نحو الأعلى (') + '<bdi>' + (lo.u.fm || '—') + ' → ' + (up.u.fm || '—') + '</bdi>' + t('): a marine transgression or a reduction of terrigenous supply.', '): مما يدل على تقدم بحري أو انخفاض في المدخلات القارية.'));
      if (c0 === 'carb' && c1 === 'clastic') ev.push(t('At ', 'عند ') + at + t(' siliciclastics prograde over carbonates (', ' تتقدم الفتاتيات فوق الكربونات (') + '<bdi>' + (lo.u.fm || '—') + ' → ' + (up.u.fm || '—') + '</bdi>' + t('): a regression or an increase in sediment supply from the hinterland.', '): مما يدل على تراجع بحري أو زيادة في التجهيز الرسوبي من المناطق المرتفعة.'));
      if (c0 === 'carb' && c1 === 'evap') ev.push(t('At ', 'عند ') + at + t(' evaporites overlie carbonates: restriction of the basin and evaporative shallowing under an arid climate.', ' تعلو المتبخراتُ الكربوناتِ: انعزال الحوض وضحالته بالتبخر في مناخ جاف.'));
      if (c0 === 'evap' && c1 === 'carb') ev.push(t('At ', 'عند ') + at + t(' carbonates return above evaporites: renewed open-marine circulation.', ' تعود الكربونات فوق المتبخرات: استئناف الدوران البحري المفتوح.'));
      if (c0 === 'clastic' && c1 === 'clastic') { var g0 = lo.u.gs !== '' && lo.u.gs != null ? +lo.u.gs : R[lo.u.rock][4], g1 = up.u.gs !== '' && up.u.gs != null ? +up.u.gs : R[up.u.rock][4]; if (g1 < g0 - 1) ev.push(t('Fining-upward from ', 'تدرج نحو الأدق إلى الأعلى من ') + rname(lo.u.rock, AR).toLowerCase() + t(' to ', ' إلى ') + rname(up.u.rock, AR).toLowerCase() + t(' at ', ' عند ') + at + t(': waning flow energy (channel abandonment or transgression).', ': تناقص طاقة التيار (هجر القناة أو تقدم بحري).')); if (g1 > g0 + 1) ev.push(t('Coarsening-upward from ', 'تدرج نحو الأخشن إلى الأعلى من ') + rname(lo.u.rock, AR).toLowerCase() + t(' to ', ' إلى ') + rname(up.u.rock, AR).toLowerCase() + t(' at ', ' عند ') + at + t(': progradation (delta or shoreface advance).', ': تقدم رسوبي (تقدم دلتا أو وجه شاطئ).')); }
    }
    html += '<h3 style="margin:14px 0 6px">' + t('3. Depositional evolution', 'ثالثاً: التطور الترسيبي') + '</h3>' + (ev.length ? '<ul style="margin:0;padding-inline-start:20px">' + ev.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>' : P(t('No major change of facies association was recognised between consecutive units.', 'لم يُرصد تغير رئيسي في المجموعات السحنية بين الوحدات المتتالية.')));
    // breaks
    var br = []; rows.forEach(function (r, k) { var u = r.u; if (u.hiatus || u.base === 'uncon' || u.base === 'erosive') { var above = u.hiatus ? rows[k - 1] : r, below = rows[k + 1]; if (!below) return; var aA = above ? AGE[above.u.age] : null, aB = AGE[below.u.age], gap = aA && aB ? aB.top - aA.base : NaN;
      br.push((u.hiatus ? t('Hiatus', 'فجوة ترسيبية') : u.base === 'uncon' ? t('Unconformity', 'عدم توافق') : t('Erosional surface', 'سطح تعرية')) + t(' at ', ' عند ') + '<bdi>' + SH.fmt(u.hiatus ? r.top : r.base, 0) + ' m</bdi>' + t(', between ', '، بين ') + ((above && above.u.fm) || '—') + t(' and ', ' و') + ((below && below.u.fm) || '—') + (isFinite(gap) && gap > 0.05 ? t('; the missing time is about ', '؛ والزمن المفقود نحو ') + '<bdi>' + SH.fmt(gap, gap < 10 ? 1 : 0) + ' Myr</bdi>' + t(' (ICS 2023 boundaries)', ' (حدود ICS 2023)') : isFinite(gap) ? t('; the time gap is below the resolution of the assigned stage ages', '؛ والفجوة الزمنية دون دقة أعمار الطوابق المحددة') : '') + '.'); } });
    html += '<h3 style="margin:14px 0 6px">' + t('4. Stratigraphic breaks', 'رابعاً: الانقطاعات الطباقية') + '</h3>' + (br.length ? '<ul style="margin:0;padding-inline-start:20px">' + br.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>' : P(t('No unconformity, erosional surface or hiatus is recorded; the succession is conformable.', 'لم يُسجل عدم توافق أو سطح تعرية أو فجوة؛ والتتابع متوافق.')));
    // petroleum system
    var src = rows.filter(function (r) { return (r.u.pet || []).indexOf('src') > -1; }), res = rows.filter(function (r) { var p = r.u.pet || []; return p.indexOf('oil') > -1 || p.indexOf('gas') > -1; }), seal = rows.filter(function (r) { return (r.u.pet || []).indexOf('seal') > -1; });
    if (src.length || res.length || seal.length) {
      var pairs = []; res.forEach(function (r) { var k = rows.indexOf(r); for (var j = k - 1; j >= 0 && j >= k - 2; j--) if ((rows[j].u.pet || []).indexOf('seal') > -1) { pairs.push('<bdi>' + (r.u.fm || '—') + ' / ' + (rows[j].u.fm || '—') + '</bdi>'); break; } });
      var nm = function (l) { return l.map(function (r) { return r.u.fm || '—'; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(AR ? '، ' : ', '); };
      html += '<h3 style="margin:14px 0 6px">' + t('5. Petroleum system', 'خامساً: النظام البترولي') + '</h3>' + P((src.length ? t('Source rocks: ', 'الصخور المصدرية: ') + nm(src) + '. ' : '') + (res.length ? t('Reservoirs: ', 'المكامن: ') + nm(res) + '. ' : '') + (seal.length ? t('Seals: ', 'الصخور الغطائية: ') + nm(seal) + '. ' : '') +
        (pairs.length ? t('Reservoir–seal pairs in vertical contact: ', 'أزواج مكمن–غطاء متلاصقة رأسياً: ') + pairs.join(AR ? '؛ ' : '; ') + '. ' : '') + (src.length && res.length ? (rows.indexOf(src[src.length - 1]) > rows.indexOf(res[0]) ? t('The deepest source rock lies below the reservoirs, so vertical migration into the overlying reservoirs is possible where faults or fractures provide pathways.', 'تقع أعمق صخرة مصدرية أسفل المكامن، فالهجرة الرأسية إلى المكامن العلوية ممكنة حيث توفر الصدوع أو الكسور مسارات لها.') : '') : ''));
    }
    $('#cNarr').innerHTML = html;
  }

  /* ---------- example: southern Iraq (Mesopotamian Zone), illustrative thicknesses after published regional charts */
  $('#uDemo').addEventListener('click', function () {
    var A = function (en) { for (var k in AGE) if ((AGE[k].stg && AGE[k].stg[0] === en) || (!AGE[k].stg && AGE[k].ser[0] === en)) return k; return ''; };
    var U = function (fm, age, rock, th, o) { return Object.assign({ fm: fm, age: A(age), grp: '', rock: rock, sec: '', mix: 'inter', th: th, gs: '', res: 3, base: 'sharp', st: [], pet: [], col: '', desc: '', com: '' }, o || {}); };
    units = [
      U('Dibdibba', 'Pliocene', 'conglomerate', 200, { sec: 'sandstone', mix: 'mixed', base: 'sharp', com: 'Zagros orogeny' }),
      U('Fatha', 'Langhian', 'anhydrite', 150, { sec: 'marl', pet: ['seal'], com: 'Zagros orogeny' }),
      U('Ghar', 'Burdigalian', 'sandstone', 100, { sec: 'conglomerate', mix: 'mixed', pet: ['oil'], base: 'uncon', com: 'Zagros orogeny' }),
      U('Dammam', 'Lutetian', 'limestone', 200, { st: ['nummulite'], com: 'Neo-Tethys closing' }),
      U('Rus', 'Ypresian', 'anhydrite', 100, { com: 'Neo-Tethys closing' }),
      U('Umm Er Radhuma', 'Thanetian', 'dolomite', 550, { sec: 'anhydrite', base: 'uncon', com: 'Neo-Tethys closing' }),
      U('Tayarat', 'Maastrichtian', 'limestone', 150, { sec: 'dolomite', com: 'Neo-Tethys closing' }),
      U('Shiranish', 'Campanian', 'marly_lime', 150, { st: ['foram'], com: 'Neo-Tethys closing' }),
      U('Hartha', 'Campanian', 'limestone', 200, { com: 'Neo-Tethys closing' }),
      U("Sa'adi", 'Santonian', 'chalk', 150, { com: 'Neo-Tethys closing' }),
      U('Tanuma', 'Coniacian', 'shale', 60, { pet: ['seal'], com: 'Tethys obduction' }),
      U('Khasib', 'Turonian', 'limestone', 70, { pet: ['oil'], base: 'uncon', com: 'Tethys obduction' }),
      U('Mishrif', 'Cenomanian', 'reef', 120, { st: ['shell'], pet: ['oil'], com: 'Neo-Tethys opening' }),
      U('Rumaila', 'Cenomanian', 'lime_mud', 80, { com: 'Neo-Tethys opening' }),
      U('Ahmadi', 'Cenomanian', 'shale', 120, { sec: 'limestone', pet: ['seal'], com: 'Neo-Tethys opening' }),
      U('Mauddud', 'Albian', 'limestone', 150, { pet: ['oil'], com: 'Neo-Tethys opening' }),
      U('Nahr Umr', 'Albian', 'sandstone', 230, { sec: 'shale', pet: ['oil'], base: 'uncon', com: 'Neo-Tethys opening' }),
      U("Shu'aiba", 'Aptian', 'limestone', 170, { pet: ['oil'], com: 'Neo-Tethys opening' }),
      U('Zubair', 'Barremian', 'sandstone', 350, { sec: 'shale', pet: ['oil'], st: ['xbed'], com: 'Neo-Tethys opening' }),
      U('Ratawi', 'Hauterivian', 'shale', 150, { sec: 'limestone', pet: ['oil'], com: 'Neo-Tethys opening' }),
      U('Yamama', 'Valanginian', 'oolitic', 250, { pet: ['oil'], com: 'Neo-Tethys opening' }),
      U('Sulaiy', 'Berriasian', 'lime_mud', 250, { com: 'Neo-Tethys opening' }),
      U('Gotnia', 'Kimmeridgian', 'anhydrite', 150, { sec: 'halite', pet: ['seal'], com: 'Neo-Tethys opening' }),
      U('Najma', 'Oxfordian', 'limestone', 150, { com: 'Neo-Tethys opening' }),
      U('Sargelu', 'Bajocian', 'limestone', 250, { sec: 'shale', col: tf('black bituminous', 'أسود بيتوميني'), pet: ['src'], com: 'Neo-Tethys opening' })
    ];
    $('#cTitle').value = tf('Generalised stratigraphic column of southern Iraq', 'العمود الطباقي العام لجنوب العراق'); $('#cLoc').value = tf('Mesopotamian Zone', 'نطاق وادي الرافدين'); $('#cSrc').value = tf('Illustrative thicknesses after published regional charts', 'سماكات توضيحية وفق المخططات الإقليمية المنشورة');
    $('#cTop').value = 0; $('#cScale').value = 'sch'; $('#cProf').value = 'full'; SH.$$('#cCols input').forEach(function (i) { i.checked = ['sys', 'ser', 'stg', 'fm', 'thk', 'desc', 'pet', 'com'].indexOf(i.value) > -1; });
    hdr.save(); save(); SH.toast(t('Example loaded. Thicknesses are illustrative.', 'حُمّل المثال. السماكات توضيحية.'), 'ok');
  });

  $('#cSvg').addEventListener('click', function () { var s = new XMLSerializer().serializeToString($('#colSvg')); SH.download('shandal-stratigraphic-column.svg', new Blob([s], { type: 'image/svg+xml' })); });
  $('#cPng').addEventListener('click', function () { SH.svgPng($('#colSvg'), 'shandal-stratigraphic-column.png', 2); });
  document.addEventListener('sh:redraw', draw);
  document.addEventListener('sh:beforereport', function (e) { if (!units.length) { e.preventDefault(); SH.toast(t('Add units first.', 'أضف الوحدات أولاً.'), 'warn'); } });
  renderTable(); draw(); narrative();
})();
