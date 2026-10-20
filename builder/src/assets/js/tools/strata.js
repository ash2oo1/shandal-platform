/* Stratigraphic column designer — vector (SVG) lithology patterns, weathering or grain-size profile. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, KEY = 'shandal_strata_beds';
  var ROCKS = {
    sed: [['sandstone', 'Sandstone', 'حجر رملي', '#EBD58A', 'dots'], ['siltstone', 'Siltstone', 'حجر غريني', '#D8CFA0', 'silt'], ['shale', 'Shale', 'طفل (سجيل)', '#B9B9A6', 'shale'], ['claystone', 'Claystone', 'حجر طيني', '#C7B79B', 'clay'],
          ['mudstone', 'Mudstone', 'حجر وحلي', '#BDB29A', 'clay'], ['conglomerate', 'Conglomerate', 'مدملكات', '#E3C489', 'cong'], ['breccia', 'Breccia', 'بريشيا', '#D9B98A', 'brec'], ['coal', 'Coal', 'فحم', '#3A3A3A', 'coal']],
    carb: [['limestone', 'Limestone', 'حجر جيري', '#A9CFE3', 'lime'], ['dolostone', 'Dolostone', 'دولوميت', '#B8D6C9', 'dolo'], ['marl', 'Marl', 'مارل', '#C9D7B4', 'marl'], ['chalk', 'Chalk', 'طباشير', '#EEF2EA', 'chalk'],
           ['marly_lime', 'Marly limestone', 'حجر جيري مارلي', '#B7D3CF', 'lime'], ['reef', 'Reef limestone', 'حجر جيري مرجاني', '#9CC4D9', 'reef']],
    evap: [['gypsum', 'Gypsum', 'جبس', '#F1D2E4', 'gyp'], ['anhydrite', 'Anhydrite', 'أنهيدرايت', '#E3C7DD', 'anh'], ['halite', 'Halite', 'هاليت (ملح صخري)', '#F4E7F1', 'halite']],
    ign: [['granite', 'Granite', 'غرانيت', '#F2B8A8', 'plus'], ['basalt', 'Basalt', 'بازلت', '#8F8F99', 'volc'], ['andesite', 'Andesite', 'أنديسايت', '#B09FA6', 'volc'], ['rhyolite', 'Rhyolite', 'رايولايت', '#E7B8B8', 'volc'], ['gabbro', 'Gabbro', 'غابرو', '#7E8A7A', 'plus'], ['diorite', 'Diorite', 'دايورايت', '#C6B0A8', 'plus'], ['tuff', 'Tuff', 'طف بركاني', '#E2D1B8', 'tuff']],
    meta: [['slate', 'Slate', 'أردواز', '#98A0A8', 'slate'], ['phyllite', 'Phyllite', 'فيليت', '#A9B0A0', 'wavy'], ['schist', 'Schist', 'شيست', '#B6AFA0', 'wavy'], ['gneiss', 'Gneiss', 'نايس', '#D7C1B4', 'gneiss'], ['marble', 'Marble', 'رخام', '#E9EEF2', 'marble'], ['quartzite', 'Quartzite', 'كوارتزايت', '#EFE3C8', 'quartzite']]
  };
  var ROCK = {}; Object.keys(ROCKS).forEach(function (c) { ROCKS[c].forEach(function (r) { ROCK[r[0]] = { cat: c, en: r[1], ar: r[2], color: r[3], pat: r[4] }; }); });
  var AGES = [['Holocene', 'الهولوسين'], ['Pleistocene', 'البلايستوسين'], ['Pliocene', 'البلايوسين'], ['Late Miocene', 'الميوسين المتأخر'], ['Middle Miocene', 'الميوسين الأوسط'], ['Early Miocene', 'الميوسين المبكر'], ['Oligocene', 'الأوليغوسين'], ['Eocene', 'الإيوسين'], ['Paleocene', 'الباليوسين'],
    ['Late Cretaceous', 'الطباشيري المتأخر'], ['Early Cretaceous', 'الطباشيري المبكر'], ['Late Jurassic', 'الجوراسي المتأخر'], ['Middle Jurassic', 'الجوراسي الأوسط'], ['Early Jurassic', 'الجوراسي المبكر'], ['Triassic', 'الترياسي'], ['Permian', 'البرمي'], ['Carboniferous', 'الكربوني'], ['Devonian', 'الديفوني'], ['Silurian', 'السيلوري'], ['Ordovician', 'الأوردوفيشي'], ['Cambrian', 'الكامبري'], ['Precambrian', 'ما قبل الكامبري']];
  var CONTACT = { sharp: t('sharp', 'حاد'), grad: t('gradational', 'متدرج'), eros: t('erosional', 'تعروي'), unconf: t('unconformity', 'عدم توافق'), uncert: t('uncertain', 'غير مؤكد') };
  var GRAIN = ['', t('clay', 'طين'), t('silt', 'غرين'), t('vf sand', 'رمل ناعم جداً'), t('f sand', 'رمل ناعم'), t('m sand', 'رمل متوسط'), t('c sand', 'رمل خشن'), t('vc sand', 'رمل خشن جداً'), t('granule', 'حبيبات'), t('pebble', 'حصى'), t('cobble', 'جلاميد'), t('boulder', 'كتل')];
  var ACC = { fossil: t('fossiliferous', 'غني بالأحافير'), xbed: t('cross-bedded', 'متقاطع التطبق'), ripple: t('with ripple marks', 'بعلامات تموج'), nodule: t('nodular', 'عقدي'), chert: t('with chert', 'مع صوان'), bio: t('bioturbated', 'معكّر حيوياً') };
  var beds = SH.store.get(KEY, []), editIdx = -1;
  var hdr = SH.persist('strata', ['geoName', 'cTitle', 'cLoc', 'cProf']);
  var rn = function (k) { return ROCK[k] ? ROCK[k][SH.lang] : k; };

  $('#ages').innerHTML = AGES.map(function (a) { return '<option value="' + a[SH.lang === 'ar' ? 1 : 0] + '">'; }).join('');
  function fillRocks() {
    var c = SH.val('bCat'), o = ROCKS[c].map(function (r) { return '<option value="' + r[0] + '">' + r[SH.lang === 'ar' ? 2 : 1] + '</option>'; }).join('');
    $('#bRock').innerHTML = o;
    $('#bRock2').innerHTML = Object.keys(ROCK).map(function (k) { return '<option value="' + k + '">' + rn(k) + '</option>'; }).join('');
    $('#bColor').value = ROCK[SH.val('bRock')].color;
  }
  $('#bCat').addEventListener('change', fillRocks);
  $('#bRock').addEventListener('change', function () { $('#bColor').value = ROCK[SH.val('bRock')].color; });
  $('#bMix').addEventListener('change', function () { $('#bMixRow').hidden = !this.checked; });
  $('#cProf').addEventListener('change', draw); ['cTitle', 'cLoc', 'geoName'].forEach(function (id) { $('#' + id).addEventListener('input', draw); });

  function autoDesc(b) {
    var s = rn(b.rock);
    if (b.mix) s += (b.mixStyle === 'inter' ? t(' interbedded with ', ' متعاقب مع ') : t(' mixed with ', ' مختلط مع ')) + rn(b.rock2).toLowerCase();
    if (ROCK[b.rock].cat === 'sed' && b.grain && !/shale|clay|mud|coal|silt/.test(b.rock)) s += ', ' + GRAIN[b.grain];
    var acc = (b.acc || []).map(function (a) { return ACC[a]; }); if (acc.length) s += ', ' + acc.join(', ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function readForm() {
    var b = { fm: SH.val('bFm').trim() || '—', age: SH.val('bAge').trim(), cat: SH.val('bCat'), rock: SH.val('bRock'), mix: $('#bMix').checked, rock2: SH.val('bRock2'), mixStyle: SH.val('bMixStyle'),
      th: SH.num('bTh'), hard: +SH.val('bHard'), grain: +SH.val('bGrain'), contact: SH.val('bContact'), color: SH.val('bColor'), pat: SH.val('bPat'), desc: SH.val('bDesc').trim(),
      acc: SH.$$('#bAcc input:checked').map(function (i) { return i.value; }) };
    if (!(b.th > 0)) { SH.toast(t('Thickness must be greater than zero.', 'يجب أن يكون السمك أكبر من صفر.'), 'warn'); return null; }
    return b;
  }
  function loadForm(b) {
    $('#bFm').value = b.fm === '—' ? '' : b.fm; $('#bAge').value = b.age; $('#bCat').value = b.cat; fillRocks(); $('#bRock').value = b.rock; $('#bMix').checked = b.mix; $('#bMixRow').hidden = !b.mix; $('#bRock2').value = b.rock2; $('#bMixStyle').value = b.mixStyle;
    $('#bTh').value = b.th; $('#bHard').value = b.hard; $('#bGrain').value = b.grain; $('#bContact').value = b.contact; $('#bColor').value = b.color; $('#bPat').value = b.pat; $('#bDesc').value = b.desc || '';
    SH.$$('#bAcc input').forEach(function (i) { i.checked = (b.acc || []).indexOf(i.value) > -1; });
  }
  function save() { SH.store.set(KEY, beds); renderTable(); draw(); }
  $('#bAdd').addEventListener('click', function () {
    var b = readForm(); if (!b) return;
    if (editIdx > -1) { beds[editIdx] = b; editIdx = -1; $('#bAddTxt').textContent = t('Add bed', 'أضف الطبقة'); $('#bCancel').hidden = true; SH.toast(t('Bed updated.', 'تم تحديث الطبقة.'), 'ok'); }
    else { beds.push(b); }
    $('#bDesc').value = ''; save();
  });
  $('#bCancel').addEventListener('click', function () { editIdx = -1; $('#bAddTxt').textContent = t('Add bed', 'أضف الطبقة'); $('#bCancel').hidden = true; });
  $('#bBody').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var i = +b.getAttribute('data-i');
    if (b.dataset.a === 'del') beds.splice(i, 1);
    else if (b.dataset.a === 'up' && i > 0) beds.splice(i - 1, 0, beds.splice(i, 1)[0]);
    else if (b.dataset.a === 'down' && i < beds.length - 1) beds.splice(i + 1, 0, beds.splice(i, 1)[0]);
    else if (b.dataset.a === 'edit') { editIdx = i; loadForm(beds[i]); $('#bAddTxt').textContent = t('Save changes', 'احفظ التعديل'); $('#bCancel').hidden = false; $('#bFm').focus(); return; }
    save();
  });
  $('#bClear').addEventListener('click', function () { if (beds.length) SH.confirm(t('Delete every bed in this column?', 'هل تريد حذف جميع طبقات العمود؟')).then(function (ok) { if (ok) { beds = []; save(); } }); });
  $('#bCsv').addEventListener('click', function () { SH.csv('shandal-stratigraphic-column.csv', SH.tableRows($('#bTable'))); });
  $('#bDemo').addEventListener('click', function () {
    beds = [
      { fm: 'Bai Hassan', age: t('Pliocene', 'البلايوسين'), cat: 'sed', rock: 'conglomerate', mix: false, rock2: 'sandstone', mixStyle: 'inter', th: 6, hard: 4, grain: 9, contact: 'eros', color: '#E3C489', pat: '#2B2B2B', acc: [] },
      { fm: 'Mukdadiya', age: t('Late Miocene', 'الميوسين المتأخر'), cat: 'sed', rock: 'sandstone', mix: true, rock2: 'claystone', mixStyle: 'inter', th: 9, hard: 3, grain: 5, contact: 'grad', color: '#EBD58A', pat: '#2B2B2B', acc: ['xbed'] },
      { fm: 'Injana', age: t('Late Miocene', 'الميوسين المتأخر'), cat: 'sed', rock: 'siltstone', mix: false, rock2: 'sandstone', mixStyle: 'inter', th: 7, hard: 2, grain: 2, contact: 'sharp', color: '#D8CFA0', pat: '#2B2B2B', acc: ['ripple'] },
      { fm: 'Fatha', age: t('Middle Miocene', 'الميوسين الأوسط'), cat: 'evap', rock: 'gypsum', mix: true, rock2: 'marl', mixStyle: 'inter', th: 11, hard: 3, grain: 1, contact: 'sharp', color: '#F1D2E4', pat: '#2B2B2B', acc: [] },
      { fm: 'Fatha', age: t('Middle Miocene', 'الميوسين الأوسط'), cat: 'carb', rock: 'limestone', mix: false, rock2: 'marl', mixStyle: 'inter', th: 4, hard: 5, grain: 1, contact: 'sharp', color: '#A9CFE3', pat: '#2B2B2B', acc: ['fossil'] },
      { fm: 'Euphrates', age: t('Early Miocene', 'الميوسين المبكر'), cat: 'carb', rock: 'dolostone', mix: false, rock2: 'marl', mixStyle: 'inter', th: 8, hard: 4, grain: 1, contact: 'unconf', color: '#B8D6C9', pat: '#2B2B2B', acc: ['chert'] }];
    if (!SH.val('cTitle')) $('#cTitle').value = t('Example section, Hamrin', 'مقطع مثال، حمرين');
    save(); SH.toast(t('Example section loaded (illustrative).', 'تم تحميل مقطع المثال (توضيحي).'), 'ok');
  });

  function renderTable() {
    var tb = $('#bBody'), top = 0; tb.innerHTML = '';
    beds.forEach(function (b, i) {
      var base = top + b.th;
      tb.insertAdjacentHTML('beforeend', '<tr><td>' + (i + 1) + '</td><td><b>' + SH.esc(b.fm) + '</b></td><td>' + SH.esc(b.age || '—') + '</td><td style="white-space:normal;min-width:180px"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:' + b.color + ';border:1px solid var(--line-2);vertical-align:-1px;margin-inline-end:6px"></span>' + SH.esc(b.desc || autoDesc(b)) + '</td><td class="num">' + SH.fmt(b.th, 1) + '</td><td class="num">' + SH.fmt(top, 1) + '</td><td class="num">' + SH.fmt(base, 1) + '</td><td>' + CONTACT[b.contact] + '</td>' +
        '<td data-noexport style="white-space:nowrap"><button class="x" data-a="up" data-i="' + i + '" title="' + t('Move up', 'تحريك للأعلى') + '">↑</button><button class="x" data-a="down" data-i="' + i + '" title="' + t('Move down', 'تحريك للأسفل') + '">↓</button><button class="x" data-a="edit" data-i="' + i + '" title="' + t('Edit', 'تعديل') + '">✎</button><button class="x" data-a="del" data-i="' + i + '" title="' + t('Delete', 'حذف') + '">✕</button></td></tr>');
      top = base;
    });
    $('#bEmpty').hidden = beds.length > 0;
    $('#kBeds').textContent = beds.length; $('#kThk').textContent = SH.fmt(top, 1);
    var fms = beds.map(function (b) { return b.fm; }).filter(function (v, i, a) { return v !== '—' && a.indexOf(v) === i; });
    $('#kFm').textContent = fms.length; $('#kFmS').textContent = fms.slice(0, 3).join(' · ') || '—';
  }

  /* ---------- SVG lithology patterns (FGDC-style) */
  function patterns(S, defs, id, kind, col) {
    var P = S.add('pattern', { id: id, width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, null, defs);
    var ln = function (dd, w, dash) { S.add('path', { d: dd, stroke: col, 'stroke-width': w || 1, fill: 'none', 'stroke-dasharray': dash || null }, null, P); };
    var dot = function (x, y, r) { S.add('circle', { cx: x, cy: y, r: r || 1.1, fill: col }, null, P); };
    switch (kind) {
      case 'dots': dot(4, 5); dot(14, 3); dot(20, 11); dot(8, 15); dot(17, 20); dot(3, 22); break;
      case 'silt': ln('M0 6H10M14 6H24M0 18H6M10 18H20', 1); dot(12, 12, .9); dot(22, 12, .9); break;
      case 'shale': ln('M0 4H9M13 4H24M0 12H5M9 12H19M0 20H11M15 20H24', 1); break;
      case 'clay': ln('M0 6H24M0 18H24', 1, '10 4'); break;
      case 'cong': S.add('circle', { cx: 7, cy: 7, r: 4.2, fill: 'none', stroke: col, 'stroke-width': 1 }, null, P); S.add('circle', { cx: 18, cy: 17, r: 3, fill: 'none', stroke: col, 'stroke-width': 1 }, null, P); dot(18, 5); dot(5, 20); break;
      case 'brec': ln('M3 3L10 6L5 11Z M14 12L22 14L16 21Z', 1); dot(18, 4); dot(6, 19); break;
      case 'coal': S.add('rect', { width: 24, height: 24, fill: col }, null, P); break;
      case 'lime': ln('M0 0H24M0 12H24M6 0V12M18 12V24', 1); break;
      case 'dolo': ln('M0 0H24M0 12H24M6 0V12M18 12V24M9 12L15 0M21 24L27 12M-3 24L3 12', 1); break;
      case 'marl': ln('M0 0H24M0 12H24M6 0V12M18 12V24', 1); ln('M2 6H10M14 18H22', 1, '3 2'); break;
      case 'chalk': ln('M0 0H24M0 12H24M6 0V12M18 12V24', .7); dot(12, 6, .8); dot(2, 18, .8); break;
      case 'reef': ln('M4 18Q8 6 12 18Q16 6 20 18', 1.1); ln('M0 0H24', .7); break;
      case 'gyp': ln('M2 6L6 12L10 6M14 18L18 24L22 18M14 6L18 12L22 6M2 18L6 24L10 18', 1); break;
      case 'anh': ln('M0 24L24 0M-6 6L6 -6M18 30L30 18', 1); ln('M0 12H24', .6); break;
      case 'halite': ln('M0 0H24V24H0ZM12 0V24M0 12H24', .8); break;
      case 'plus': ln('M6 3V9M3 6H9M18 15V21M15 18H21', 1.2); break;
      case 'volc': ln('M3 4L6 10L9 4M15 16L18 22L21 16', 1.1); break;
      case 'tuff': ln('M3 4L6 10L9 4', 1); dot(17, 7); dot(6, 18); dot(19, 19); break;
      case 'slate': ln('M0 4L24 1M0 12L24 9M0 20L24 17', .9); break;
      case 'wavy': ln('M0 6Q6 2 12 6T24 6M0 18Q6 14 12 18T24 18', 1); break;
      case 'gneiss': ln('M0 6Q6 0 12 6T24 6', 1); ln('M0 16H8M12 16H24', 2.2); break;
      case 'marble': ln('M0 0H24M0 12H24M6 0V12M18 12V24', .6); ln('M2 2L22 22', .5); break;
      case 'quartzite': dot(6, 6, 1.5); dot(18, 18, 1.5); ln('M10 0V24', .5, '2 3'); break;
      default: dot(12, 12);
    }
  }

  function draw() {
    var p = SH.palette(), S = SH.svgB('colSvg'), prof = SH.val('cProf'), total = beds.reduce(function (a, b) { return a + b.th; }, 0);
    var rtl = SH.lang === 'ar', W = 900, top = 120, colX = 210, colMax = 230, scaleH = Math.max(360, Math.min(1400, total * 34)), pxm = total ? scaleH / total : 30, H = top + scaleH + 150;
    S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    S.add('rect', { x: 0, y: 0, width: W, height: H, fill: '#FFFFFF' });
    var ink = '#1B232B', mute = '#5A6670', defs = S.add('defs', {});
    S.text(W / 2, 40, t('Shandal Geological Field Survey System', 'نظام شندل للمسح الميداني الجيولوجي'), { 'font-size': 18, 'font-weight': 800, fill: ink, 'text-anchor': 'middle' });
    S.text(W / 2, 64, SH.val('cTitle') || t('Stratigraphic column', 'العمود الطباقي'), { 'font-size': 15, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' });
    if (SH.val('cLoc')) S.text(W / 2, 84, SH.val('cLoc'), { 'font-size': 12, fill: mute, 'text-anchor': 'middle' });
    // tracks
    var trk = [[30, 'Unit / age', 'الوحدة / العمر'], [colX - 50, 'm', 'م'], [colX, prof === 'grain' ? 'Lithology · grain size' : 'Lithology · resistance', prof === 'grain' ? 'الصخارية · الحجم الحبيبي' : 'الصخارية · المقاومة'], [colX + colMax + 20, 'Description', 'الوصف']];
    S.add('rect', { x: 20, y: top - 26, width: W - 40, height: scaleH + 26, fill: 'none', stroke: ink, 'stroke-width': 1.2 });
    trk.forEach(function (k, i) { if (i) S.line(k[0], top - 26, k[0], top + scaleH, { stroke: '#9AA3AA', 'stroke-width': 1 }); S.text(k[0] + 8, top - 9, t(k[1], k[2]), { 'font-size': 11, 'font-weight': 800, fill: ink }); });
    S.line(20, top, W - 20, top, { stroke: ink, 'stroke-width': 1 });
    if (!beds.length) { S.text(W / 2, top + 120, t('Add beds to draw the column', 'أضف طبقات لرسم العمود'), { 'font-size': 14, fill: mute, 'text-anchor': 'middle' }); return; }
    // depth scale
    var step = total > 200 ? 50 : total > 80 ? 20 : total > 30 ? 10 : 5;
    for (var d = 0; d <= total + 0.001; d += step) { var yy = top + d * pxm; S.line(colX - 10, yy, colX, yy, { stroke: ink }); S.text(colX - 14, yy + 4, d, { 'font-size': 10, fill: mute, 'text-anchor': 'end' }); }
    var y = top, legend = {};
    beds.forEach(function (b, i) {
      var h = b.th * pxm, w = prof === 'grain' ? 40 + b.grain * (colMax - 40) / 11 : 50 + b.hard * (colMax - 50) / 5;
      var pid = 'pt' + i, pid2 = 'ps' + i; patterns(S, defs, pid, ROCK[b.rock].pat, b.pat); if (b.mix) patterns(S, defs, pid2, ROCK[b.rock2].pat, b.pat);
      S.add('rect', { x: colX, y: y, width: w, height: h, fill: b.color });
      S.add('rect', { x: colX, y: y, width: w, height: h, fill: 'url(#' + pid + ')' });
      if (b.mix) {
        if (b.mixStyle === 'mixed') S.add('rect', { x: colX, y: y, width: w, height: h, fill: 'url(#' + pid2 + ')', opacity: .7 });
        else { var band = Math.max(6, Math.min(16, h / 4)); for (var k = band; k < h; k += band * 2) { var bh = Math.min(band, h - k); S.add('rect', { x: colX, y: y + k, width: w, height: bh, fill: ROCK[b.rock2].color }); S.add('rect', { x: colX, y: y + k, width: w, height: bh, fill: 'url(#' + pid2 + ')' }); } }
      }
      // outline: right edge + top
      S.line(colX + w, y, colX + w, y + h, { stroke: ink, 'stroke-width': 1.4 });
      S.line(colX, y, colX, y + h, { stroke: ink, 'stroke-width': 1.4 });
      // lower contact
      var by = y + h, rng = SH.rng(i * 97 + 13);
      if (b.contact === 'eros' || b.contact === 'unconf') { var dd = 'M' + colX + ' ' + by; for (var xx = colX; xx < colX + w; xx += 8) dd += 'Q' + (xx + 4) + ' ' + (by + (rng() * 6 - 3)) + ' ' + (xx + 8) + ' ' + by; S.path(dd, { fill: 'none', stroke: b.contact === 'unconf' ? '#B4552D' : ink, 'stroke-width': b.contact === 'unconf' ? 2.2 : 1.4 }); }
      else S.line(colX, by, colX + Math.max(w, i < beds.length - 1 ? 0 : w), by, { stroke: ink, 'stroke-width': 1.4, 'stroke-dasharray': b.contact === 'grad' ? '6 4' : b.contact === 'uncert' ? '2 4' : null });
      if (i < beds.length - 1) { var nb = beds[i + 1], nw = prof === 'grain' ? 40 + nb.grain * (colMax - 40) / 11 : 50 + nb.hard * (colMax - 50) / 5; S.line(colX + w, by, colX + Math.max(w, nw), by, { stroke: ink, 'stroke-width': 1.4 }); }
      // accessories
      (b.acc || []).forEach(function (a, j) { var ax = colX + 12 + j * 18, ay = y + h / 2; if (h < 14) return;
        if (a === 'fossil') S.path('M' + (ax - 5) + ' ' + ay + 'a5 5 0 1 1 10 0a3 3 0 1 1 -6 0', { fill: 'none', stroke: ink, 'stroke-width': 1.2 });
        if (a === 'xbed') S.path('M' + (ax - 6) + ' ' + (ay + 4) + 'L' + (ax + 6) + ' ' + (ay + 4) + 'M' + (ax - 6) + ' ' + (ay + 4) + 'Q' + ax + ' ' + (ay - 6) + ' ' + (ax + 6) + ' ' + (ay - 6), { fill: 'none', stroke: ink, 'stroke-width': 1.2 });
        if (a === 'ripple') S.path('M' + (ax - 7) + ' ' + ay + 'q3.5 -5 7 0t7 0', { fill: 'none', stroke: ink, 'stroke-width': 1.2 });
        if (a === 'nodule') S.add('ellipse', { cx: ax, cy: ay, rx: 6, ry: 3.5, fill: 'none', stroke: ink, 'stroke-width': 1.2 });
        if (a === 'chert') S.path('M' + (ax - 6) + ' ' + ay + 'L' + ax + ' ' + (ay - 4) + 'L' + (ax + 6) + ' ' + ay + 'L' + ax + ' ' + (ay + 4) + 'Z', { fill: ink });
        if (a === 'bio') S.path('M' + (ax - 5) + ' ' + (ay - 5) + 'q5 3 0 5t0 5', { fill: 'none', stroke: ink, 'stroke-width': 1.4 });
      });
      // unit / age labels
      if (h >= 12) { S.text(30, y + h / 2 + (b.age ? -2 : 4), b.fm, { 'font-size': 12, 'font-weight': 800, fill: ink }); if (b.age) S.text(30, y + h / 2 + 13, b.age, { 'font-size': 10, fill: mute, 'font-style': 'italic' }); }
      // thickness
      var desc = (b.desc || autoDesc(b)) + ' · ' + SH.fmt(b.th, 1) + ' m';
      if (h >= 12) S.text(colX + colMax + 30, y + h / 2 + 4, desc.length > 70 ? desc.slice(0, 68) + '…' : desc, { 'font-size': 11, fill: ink });
      S.line(colX + colMax + 20, by, W - 20, by, { stroke: '#D5D9DC', 'stroke-width': .8 });
      legend[b.rock] = b; if (b.mix) legend[b.rock2] = { rock: b.rock2, color: ROCK[b.rock2].color, pat: b.pat };
      y = by;
    });
    // profile scale under the column
    var ly = top + scaleH + 22;
    if (prof === 'grain') { ['cl', 'si', 'vf', 'f', 'm', 'c', 'vc', 'gr', 'pb', 'cb', 'bd'].forEach(function (g, i2) { var gx = colX + 40 + (i2 + 1) * (colMax - 40) / 11; S.line(gx, top + scaleH, gx, top + scaleH + 6, { stroke: ink }); S.text(gx, top + scaleH + 16, g, { 'font-size': 8, fill: mute, 'text-anchor': 'middle' }); }); }
    else { for (var hh = 1; hh <= 5; hh++) { var hx = colX + 50 + hh * (colMax - 50) / 5; S.line(hx, top + scaleH, hx, top + scaleH + 6, { stroke: ink }); S.text(hx, top + scaleH + 16, hh, { 'font-size': 9, fill: mute, 'text-anchor': 'middle' }); } }
    // legend
    var keys = Object.keys(legend), lx = 30; ly += 22;
    S.text(30, ly, t('Legend', 'الدليل'), { 'font-size': 12, 'font-weight': 800, fill: ink }); ly += 10;
    keys.forEach(function (k, i3) {
      var col = i3 % 4, row = Math.floor(i3 / 4), gx = 30 + col * 215, gy = ly + row * 30, lid = 'lg' + i3;
      patterns(S, defs, lid, ROCK[k].pat, legend[k].pat || '#2B2B2B');
      S.add('rect', { x: gx, y: gy, width: 36, height: 20, fill: legend[k].color || ROCK[k].color, stroke: ink, 'stroke-width': .8 });
      S.add('rect', { x: gx, y: gy, width: 36, height: 20, fill: 'url(#' + lid + ')' });
      S.text(gx + 44, gy + 14, rn(k), { 'font-size': 11, fill: ink });
    });
    var rows = Math.ceil(keys.length / 4); H = ly + rows * 30 + 40; S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    S.text(30, H - 16, t('Prepared by: ', 'إعداد: ') + (SH.val('geoName') || '—'), { 'font-size': 11, fill: mute });
    S.text(W - 30, H - 16, new Date().toLocaleDateString(SH.lang === 'ar' ? 'ar-IQ' : 'en-GB') + ' · ' + t('Total ', 'المجموع ') + SH.fmt(total, 1) + ' m', { 'font-size': 11, fill: mute, 'text-anchor': 'end' });
    // white background must cover the new height
    S.el.firstChild.setAttribute('height', H);
  }
  $('#cPng').addEventListener('click', function () { if (!beds.length) return SH.toast(t('Add beds first.', 'أضف طبقات أولاً.'), 'warn'); SH.svgPng($('#colSvg'), 'shandal-stratigraphic-column.png', 2, '#ffffff'); });
  $('#cSvg').addEventListener('click', function () { if (!beds.length) return; var x = new XMLSerializer().serializeToString($('#colSvg')); SH.download('shandal-stratigraphic-column.svg', x, 'image/svg+xml'); });
  document.addEventListener('sh:beforereport', function (e) { if (!beds.length) { e.preventDefault(); SH.toast(t('Add at least one bed before making a report.', 'أضف طبقة واحدة على الأقل قبل إعداد التقرير.'), 'warn'); } });
  fillRocks(); renderTable(); draw();
})();
