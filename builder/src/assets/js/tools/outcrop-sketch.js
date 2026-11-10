/* Outcrop sketch and field description — a photo of the face (or a blank sheet) on which the geologist draws the bed
   boundaries, faults, joints and veins with a finger, places fossils, samples and dip notes, and sets the scale from an
   object of known length. Beds between boundaries are numbered from the bottom and described (lithology, colour, grain
   size, bedding, veins, fossils, joints, sedimentary and tectonic structures, landform). The result is an annotated
   sketch and a measured section (log) derived from it, both exportable, with the beds as CSV and the project as a file. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, AR = SH.lang === 'ar', KEY = 'shandal_os';
  var svg = $('#osSvg'), stage = $('#osStage');
  var S = SH.store.get(KEY, null) || { img: null, W: 1200, H: 800, lines: [], marks: [], beds: {}, ns: 0 };
  var MODE = 'b', UNDO = [], cur = null, cardsKey = '';

  var LITH = [['limestone', 'Limestone', 'حجر جيري', '#E6E0C8'], ['dolostone', 'Dolostone', 'دولومايت', '#E2D3B4'], ['sandstone', 'Sandstone', 'حجر رملي', '#E8C98E'], ['siltstone', 'Siltstone', 'حجر غريني', '#C9B99A'], ['claystone', 'Claystone', 'حجر طيني', '#A9B39A'], ['shale', 'Shale', 'طفل', '#8F9A92'], ['marl', 'Marl', 'مارل', '#C8CFAE'], ['gypsum', 'Gypsum / anhydrite', 'جبس / أنهيدرايت', '#F2F0EA'], ['conglomerate', 'Conglomerate', 'مدملكات', '#CDB38A'], ['breccia', 'Breccia', 'بريشيا', '#BFA88A'], ['chert', 'Chert', 'صوان', '#9C8C7A'], ['igneous', 'Igneous rock', 'صخر ناري', '#6F7A73'], ['alluvium', 'Loose sediment / soil', 'رسوبيات مفككة / تربة', '#D8C3A0'], ['cover', 'Covered (not exposed)', 'مغطى (غير منكشف)', '#FFFFFF']];
  var GRAIN = [['', '—', '—', 80], ['cl', 'Clay', 'طين', 40], ['si', 'Silt', 'غرين', 52], ['vf', 'Very fine sand', 'رمل ناعم جداً', 64], ['f', 'Fine sand', 'رمل ناعم', 74], ['m', 'Medium sand', 'رمل متوسط', 84], ['c', 'Coarse sand', 'رمل خشن', 94], ['vc', 'Very coarse sand', 'رمل خشن جداً', 104], ['gr', 'Granules', 'حبيبات', 114], ['pb', 'Pebbles', 'حصى', 128], ['cb', 'Cobbles and boulders', 'جلاميد', 142], ['xl', 'Crystalline / micrite', 'بلوري / مكروي', 80]];
  var BEDT = [['', '—', '—'], ['lam', 'Laminated (< 1 cm)', 'صفائحي (< 1 سم)'], ['thin', 'Thin (1–10 cm)', 'رقيق (1–10 سم)'], ['med', 'Medium (10–30 cm)', 'متوسط (10–30 سم)'], ['thick', 'Thick (30–100 cm)', 'سميك (30–100 سم)'], ['mass', 'Massive (> 1 m)', 'كتلي (> 1 م)']];
  var CH = {
    veins: [t('Veins', 'العروق'), [['calcite', 'calcite', 'كالسايت'], ['gypsum', 'gypsum', 'جبس'], ['quartz', 'quartz', 'كوارتز'], ['iron', 'iron oxide', 'أكاسيد حديد']]],
    sed: [t('Sedimentary structures', 'التراكيب الرسوبية'), [['xbed', 'cross-bedding', 'تطبق متقاطع'], ['ripple', 'ripple marks', 'علامات تموج'], ['graded', 'graded bedding', 'تطبق متدرج'], ['lamin', 'lamination', 'تصفح'], ['mudcr', 'mud cracks', 'تشققات طينية'], ['biotu', 'bioturbation', 'آثار أحيائية'], ['nodul', 'nodules', 'عقد'], ['stylo', 'stylolites', 'ستايلولايت'], ['load', 'load casts', 'قوالب حمل']]],
    tect: [t('Tectonic structures', 'التراكيب التكتونية'), [['joints', 'joints', 'فواصل'], ['fault', 'faults', 'فوالق'], ['fold', 'folds', 'طيات'], ['slick', 'slickensides', 'سطوح احتكاك'], ['cleav', 'cleavage', 'انفصام'], ['brecc', 'fault breccia', 'بريشيا فالقية']]],
    geo: [t('Landform', 'الشكل الأرضي'), [['cliff', 'cliff former', 'يكوّن جرفاً'], ['ledge', 'ledge', 'حافة بارزة'], ['slope', 'slope former', 'يكوّن منحدراً'], ['gully', 'gullies', 'أخاديد'], ['karst', 'karst', 'كارست'], ['cave', 'caves', 'كهوف'], ['scree', 'scree', 'ركام سفحي']]] };
  var HOW = { b: ['Drag a finger or the mouse along each boundary between two beds, from one side of the picture to the other. Beds between the lines are numbered from the bottom.', 'اسحب إصبعك أو الفأرة على طول كل حد بين طبقتين، من جانب الصورة إلى الآخر. وتُرقّم الطبقات بين الخطوط من الأسفل.'], fault: ['Drag along the fault trace.', 'اسحب على امتداد أثر الفالق.'], joint: ['Drag along each joint.', 'اسحب على امتداد كل فاصل.'], vein: ['Drag along the vein.', 'اسحب على امتداد العرق.'], fossil: ['Tap where fossils are found.', 'انقر حيث توجد المتحجرات.'], sample: ['Tap where a sample was taken; samples are numbered S1, S2…', 'انقر حيث أُخذت عينة؛ وتُرقّم العينات S1 وS2…'], dip: ['Write the dip or a note in the box below, then tap where it belongs.', 'اكتب الميل أو الملاحظة في الحقل أدناه، ثم انقر مكانها.'], scale: ['Drag across an object of known length (staff, hammer, person) and enter its length below.', 'اسحب عبر شيء معروف الطول (مسطرة أو مطرقة أو شخص) وأدخل طوله أدناه.'], erase: ['Tap a line or a symbol to remove it.', 'انقر خطاً أو رمزاً لحذفه.'], view: ['Scroll the page; drawing is paused.', 'مرّر الصفحة؛ الرسم متوقف.'] };

  function save() { try { SH.store.set(KEY, S); } catch (e) { if (!save.w) { save.w = 1; SH.toast(t('The device storage is full: save the project file.', 'ذاكرة الجهاز ممتلئة: احفظ ملف المشروع.'), 'warn'); } } }
  function snap() { UNDO.push(JSON.stringify({ lines: S.lines, marks: S.marks, ns: S.ns })); if (UNDO.length > 60) UNDO.shift(); }
  function setMode(m) { MODE = m; Array.prototype.forEach.call($('#osTools').querySelectorAll('[data-t]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-t') === m); }); stage.classList.toggle('draw', m !== 'view'); $('#osHow').textContent = t(HOW[m][0], HOW[m][1]); }
  $('#osTools').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) setMode(b.getAttribute('data-t')); });
  $('#osUndo').addEventListener('click', function () { var u = UNDO.pop(); if (!u) return; u = JSON.parse(u); S.lines = u.lines; S.marks = u.marks; S.ns = u.ns; save(); draw(); });
  $('#osClear').addEventListener('click', function () { SH.confirm(t('Remove all lines, symbols and descriptions?', 'احذف كل الخطوط والرموز والأوصاف؟')).then(function (ok) { if (!ok) return; snap(); S.lines = []; S.marks = []; S.beds = {}; S.ns = 0; save(); draw(); }); });

  /* ------------------------------------------------------------ picture */
  $('#osPhoto').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () { var im = new Image(); im.onload = function () { var k = Math.min(1, 1600 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); newSheet(cv.toDataURL('image/jpeg', 0.82), cv.width, cv.height); }; im.src = r.result; };
    r.readAsDataURL(f); this.value = '';
  });
  $('#osBlank').addEventListener('click', function () { newSheet(null, 1200, 800); });
  function newSheet(img, W, H) { var go = function () { snap(); S = { img: img, W: W, H: H, lines: [], marks: [], beds: {}, ns: 0 }; cardsKey = ''; save(); draw(); }; if (S.lines.length || S.marks.length) SH.confirm(t('Start a new sketch? The current drawing will be replaced.', 'ابدأ رسماً جديداً؟ سيُستبدل الرسم الحالي.')).then(function (ok) { if (ok) go(); }); else go(); }
  ['osTitle', 'osFace', 'osPlace', 'osRef'].forEach(function (id) { $('#' + id).addEventListener('input', function () { S.meta = S.meta || {}; S.meta[id] = this.value; save(); figs(); }); });
  if (S.meta) Object.keys(S.meta).forEach(function (k) { if ($('#' + k)) $('#' + k).value = S.meta[k]; });
  $('#osGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.gpsFix({ ms: 12000, target: 8 }).then(function (f) { var v = f.lat.toFixed(5) + ', ' + f.lon.toFixed(5); $('#osPlace').value = v; S.meta = S.meta || {}; S.meta.osPlace = v; save(); figs(); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });

  /* ------------------------------------------------------------ drawing */
  function pt(e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; var q = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.max(0, Math.min(S.W, q.x)), Math.max(0, Math.min(S.H, q.y))]; }
  function d2(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function segD(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0; return d2(p, [a[0] + u * dx, a[1] + u * dy]); }
  function rdp(P, eps) { if (P.length < 3) return P; var dm = 0, ix = 0; for (var i = 1; i < P.length - 1; i++) { var d = segD(P[i], P[0], P[P.length - 1]); if (d > dm) { dm = d; ix = i; } } return dm > eps ? rdp(P.slice(0, ix + 1), eps).slice(0, -1).concat(rdp(P.slice(ix), eps)) : [P[0], P[P.length - 1]]; }
  svg.addEventListener('pointerdown', function (e) {
    if (MODE === 'view') return; e.preventDefault(); var p = pt(e), tol = S.W / 40;
    if (MODE === 'erase') { var best = null, bd = tol; S.lines.forEach(function (l, i) { for (var j = 0; j + 1 < l.pts.length; j++) { var d = segD(p, l.pts[j], l.pts[j + 1]); if (d < bd) { bd = d; best = ['l', i]; } } }); S.marks.forEach(function (m, i) { var d = d2(p, [m.x, m.y]); if (d < bd) { bd = d; best = ['m', i]; } }); if (best) { snap(); (best[0] === 'l' ? S.lines : S.marks).splice(best[1], 1); save(); draw(); } return; }
    if (MODE === 'fossil' || MODE === 'sample' || MODE === 'dip') { var txt = MODE === 'dip' ? ($('#osTxt').value || '').trim() : ''; if (MODE === 'dip' && !txt) return SH.toast(t('Write the dip or the note first.', 'اكتب الميل أو الملاحظة أولاً.'), 'warn'); snap(); var m = { k: MODE, x: p[0], y: p[1], txt: txt }; if (MODE === 'sample') m.txt = 'S' + (++S.ns); S.marks.push(m); save(); draw(); return; }
    cur = { k: MODE, pts: [p], id: SH.uid('L') }; svg.setPointerCapture(e.pointerId); drawLive();
  });
  svg.addEventListener('pointermove', function (e) { if (!cur) return; var p = pt(e); if (d2(p, cur.pts[cur.pts.length - 1]) > S.W / 300) { cur.pts.push(p); drawLive(); } });
  function end() {
    if (!cur) return; var l = cur; cur = null; if (l.pts.length < 2 || d2(l.pts[0], l.pts[l.pts.length - 1]) < S.W / 60) { draw(); return; }
    snap(); if (l.k === 'scale') { S.lines = S.lines.filter(function (q) { return q.k !== 'scale'; }); l.pts = [l.pts[0], l.pts[l.pts.length - 1]]; } else l.pts = rdp(l.pts, S.W / 500).map(function (q) { return [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]; });
    if (l.k === 'b') l.pts.sort(function (a, b) { return a[0] - b[0]; });
    S.lines.push(l); save(); draw();
  }
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);

  /* ------------------------------------------------------------ beds geometry */
  function yAt(l, x) { if (!l) return null; var P = l.pts; if (x <= P[0][0]) return P[0][1]; for (var i = 0; i + 1 < P.length; i++) if (x <= P[i + 1][0]) { var u = (x - P[i][0]) / ((P[i + 1][0] - P[i][0]) || 1); return P[i][1] + u * (P[i + 1][1] - P[i][1]); } return P[P.length - 1][1]; }
  function meanY(l) { var s = 0; for (var i = 0; i <= 10; i++) s += yAt(l, S.W * i / 10); return s / 11; }
  function mpp() { var sc = S.lines.filter(function (l) { return l.k === 'scale'; })[0], L = parseFloat($('#osRef').value); return sc && L > 0 ? L / d2(sc.pts[0], sc.pts[1]) : null; }
  function beds() {
    var B = S.lines.filter(function (l) { return l.k === 'b'; }).sort(function (a, b) { return meanY(b) - meanY(a); }), out = [], k = mpp(), xc = S.W / 2;
    for (var i = 0; i <= B.length; i++) {
      var lo = B[i - 1] || null, up = B[i] || null, key = (lo ? lo.id : 'base') + '|' + (up ? up.id : 'top'), ylo = lo ? yAt(lo, xc) : S.H, yup = up ? yAt(up, xc) : 0;
      var sl = [lo, up].filter(Boolean).map(function (l) { return (yAt(l, xc + S.W * 0.05) - yAt(l, xc - S.W * 0.05)) / (S.W * 0.1); }), slope = sl.length ? sl.reduce(function (a, b) { return a + b; }, 0) / sl.length : 0;
      var px = Math.max(0, (ylo - yup) * Math.cos(Math.atan(slope)));
      if (!S.beds[key]) { var inh = null; Object.keys(S.beds).forEach(function (q) { var a = q.split('|'); if ((lo && a[0] === lo.id) || (up && a[1] === up.id)) inh = inh || S.beds[q]; }); S.beds[key] = inh ? JSON.parse(JSON.stringify(inh)) : { lith: 'limestone', col: '#E6E0C8' }; }
      out.push({ n: i + 1, key: key, lo: lo, up: up, ylo: ylo, yup: yup, edge: !lo || !up, thPx: px, th: k ? px * k : null, d: S.beds[key] });
    }
    return out;
  }
  function bedTh(b) { return b.d.th != null && b.d.th !== '' ? +b.d.th : b.th; }

  /* ------------------------------------------------------------ rendering */
  function lithPat(id, lith, bg) {
    var c = 'rgba(20,28,36,.6)', p;
    if (lith === 'limestone') p = '<path d="M0 .5h16M0 8.5h16M4 0v8M12 8v8" stroke="' + c + '" stroke-width=".8"/>';
    else if (lith === 'dolostone') p = '<path d="M0 .5h16M0 8.5h16M4 0v8M12 8v8M6 6l4-4M14 14l-4-4" stroke="' + c + '" stroke-width=".8"/>';
    else if (lith === 'sandstone') p = '<circle cx="3" cy="3" r=".9" fill="' + c + '"/><circle cx="11" cy="7" r=".9" fill="' + c + '"/><circle cx="5" cy="12" r=".9" fill="' + c + '"/><circle cx="13" cy="14" r=".9" fill="' + c + '"/>';
    else if (lith === 'siltstone') p = '<path d="M1 4h5M9 12h5" stroke="' + c + '" stroke-width=".8"/><circle cx="12" cy="4" r=".8" fill="' + c + '"/><circle cx="4" cy="12" r=".8" fill="' + c + '"/>';
    else if (lith === 'claystone' || lith === 'shale') p = '<path d="M0 4h7M9 4h7M4 12h8' + (lith === 'shale' ? 'M0 8h16' : '') + '" stroke="' + c + '" stroke-width=".8"/>';
    else if (lith === 'marl') p = '<path d="M0 .5h16M0 8.5h16M4 0v8M12 8v8M1 4.5h5M9 12.5h5" stroke="' + c + '" stroke-width=".7"/>';
    else if (lith === 'gypsum') p = '<path d="M2 5l2 3 2-3M10 13l2 3 2-3" stroke="' + c + '" stroke-width=".9" fill="none"/>';
    else if (lith === 'conglomerate') p = '<circle cx="4" cy="4" r="2.6" fill="none" stroke="' + c + '" stroke-width=".8"/><circle cx="12" cy="11" r="2.2" fill="none" stroke="' + c + '" stroke-width=".8"/>';
    else if (lith === 'breccia') p = '<path d="M2 6l3-4 3 4zM9 14l3-5 3 5z" fill="none" stroke="' + c + '" stroke-width=".8"/>';
    else if (lith === 'chert') p = '<path d="M2 4h6l-1 2H3zM9 12h6l-1 2h-4z" fill="' + c + '"/>';
    else if (lith === 'igneous') p = '<path d="M4 2v5M1.5 4.5h5M12 9v5M9.5 11.5h5" stroke="' + c + '" stroke-width=".9"/>';
    else if (lith === 'alluvium') p = '<circle cx="4" cy="4" r="1.6" fill="none" stroke="' + c + '" stroke-width=".7"/><circle cx="12" cy="9" r=".9" fill="' + c + '"/><circle cx="6" cy="13" r=".9" fill="' + c + '"/>';
    else p = '';
    return '<pattern id="' + id + '" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="' + bg + '"/>' + p + '</pattern>';
  }
  function lithName(k, ar) { var q = LITH.filter(function (x) { return x[0] === k; })[0] || LITH[0]; return ar ? q[2] : q[1]; }
  function bedPoly(b) { var a = [], r = [], n = 48; for (var i = 0; i <= n; i++) { var x = S.W * i / n; a.push(x.toFixed(1) + ',' + (b.up ? yAt(b.up, x) : 0).toFixed(1)); r.unshift(x.toFixed(1) + ',' + (b.lo ? yAt(b.lo, x) : S.H).toFixed(1)); } return a.concat(r).join(' '); }
  function linePath(l) { return 'M' + l.pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'); }
  function scene(BB, live, pfx) {
    var W = S.W, H = S.H, sw = W / 400, s = '', defs = '';
    if (S.img) s += '<image href="' + S.img + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="none"/>';
    else { s += '<rect width="' + W + '" height="' + H + '" fill="#FBF8F1"/>'; for (var gx = 0; gx <= W; gx += W / 12) s += '<line x1="' + gx + '" x2="' + gx + '" y1="0" y2="' + H + '" stroke="#ECE4D3"/>'; }
    BB.forEach(function (b) { if (!S.img || b.d.lith === 'cover') { defs += lithPat(pfx + 'p' + b.n, b.d.lith, b.d.lith === 'cover' ? '#FFFFFF' : (b.d.col || '#eee')); } s += '<polygon points="' + bedPoly(b) + '" fill="' + (S.img ? (b.d.lith === 'cover' ? 'url(#' + pfx + 'p' + b.n + ')' : b.d.col || '#fff') : 'url(#' + pfx + 'p' + b.n + ')') + '" fill-opacity="' + (S.img ? (b.d.lith === 'cover' ? 0.55 : 0.18) : 1) + '"/>'; });
    var ST = { b: ['#141C24', 2.2, ''], fault: ['#C0392B', 2.6, ''], joint: ['#2E6FBF', 1.5, (sw * 4) + ' ' + (sw * 3)], vein: ['#8A6D1F', 1.4, ''], scale: ['#B08A3E', 2.6, ''] };
    S.lines.concat(live ? [live] : []).forEach(function (l) { var q = ST[l.k], halo = S.img ? '<path d="' + linePath(l) + '" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="' + (q[1] + 2.2) * sw + '" stroke-linecap="round" stroke-linejoin="round"/>' : '';
      if (l.k === 'vein') halo = '<path d="' + linePath(l) + '" fill="none" stroke="#fff" stroke-width="' + 4 * sw + '" stroke-linecap="round" stroke-linejoin="round"/>';
      s += halo + '<path d="' + linePath(l) + '" fill="none" stroke="' + q[0] + '" stroke-width="' + q[1] * sw + '" stroke-linecap="round" stroke-linejoin="round"' + (q[2] ? ' stroke-dasharray="' + q[2] + '"' : '') + '/>';
      if (l.k === 'fault' && l.pts.length > 1) { var a = l.pts[0], z = l.pts[l.pts.length - 1], mx = (a[0] + z[0]) / 2, my = (a[1] + z[1]) / 2; s += '<circle cx="' + mx + '" cy="' + my + '" r="' + 2.6 * sw + '" fill="#C0392B"/>'; }
      if (l.k === 'scale') { var m0 = mpp(), A = l.pts[0], Z = l.pts[l.pts.length - 1]; [A, Z].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + 2.5 * sw + '" fill="#B08A3E" stroke="#fff" stroke-width="' + sw + '"/>'; }); if (m0) s += lab((A[0] + Z[0]) / 2, (A[1] + Z[1]) / 2 - 6 * sw, F(parseFloat($('#osRef').value), 2) + ' m', sw, '#8A6D1F'); }
    });
    S.marks.forEach(function (m) {
      if (m.k === 'fossil') s += '<g transform="translate(' + m.x + ' ' + m.y + ') scale(' + sw * 1.4 + ')"><circle r="7" fill="#fff" fill-opacity=".9"/><path d="M0-5a5 5 0 1 0 5 5c0-2-1.4-3.2-3.2-3.2S-1 -1.6-1 0" stroke="#2E8B57" stroke-width="1.6" fill="none"/></g>';
      else if (m.k === 'sample') s += '<rect x="' + (m.x - 4 * sw) + '" y="' + (m.y - 4 * sw) + '" width="' + 8 * sw + '" height="' + 8 * sw + '" fill="#7A4F9A" stroke="#fff" stroke-width="' + sw + '"/>' + lab(m.x + 10 * sw, m.y, m.txt, sw, '#7A4F9A', 'start');
      else s += '<path d="M' + (m.x - 7 * sw) + ' ' + m.y + 'h' + 14 * sw + 'M' + m.x + ' ' + m.y + 'v' + 5 * sw + '" stroke="#141C24" stroke-width="' + 1.6 * sw + '"/>' + lab(m.x + 10 * sw, m.y - 3 * sw, m.txt, sw, '#141C24', 'start');
    });
    BB.forEach(function (b) { var y = (b.ylo + b.yup) / 2, x = S.W * 0.05; if (b.ylo - b.yup < 10 * sw) return; s += '<circle cx="' + x + '" cy="' + y + '" r="' + 7.5 * sw + '" fill="#141C24" stroke="#fff" stroke-width="' + sw + '"/><text x="' + x + '" y="' + (y + 3.6 * sw) + '" text-anchor="middle" font-size="' + 10 * sw + '" font-weight="800" fill="#fff" font-family="Manrope,system-ui,sans-serif">' + b.n + '</text>'; });
    return { defs: defs, s: s };
  }
  function lab(x, y, txt, sw, col, anc) { return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anc || 'middle') + '" dominant-baseline="middle" font-size="' + 9.5 * sw + '" font-weight="700" fill="' + col + '" stroke="#fff" stroke-width="' + 2.6 * sw + '" paint-order="stroke" font-family="Manrope,system-ui,sans-serif">' + SH.esc(txt) + '</text>'; }
  function drawLive() { var BB = beds(), r = scene(BB, cur, 'e'); svg.innerHTML = '<defs>' + r.defs + '</defs>' + r.s; }
  function draw() {
    svg.setAttribute('viewBox', '0 0 ' + S.W + ' ' + S.H); var BB = beds(), r = scene(BB, null, 'e'); svg.innerHTML = '<defs>' + r.defs + '</defs>' + r.s;
    var k = mpp(), nb = S.lines.filter(function (l) { return l.k === 'b'; }).length;
    $('#osStat').textContent = (S.img ? t('Photo ', 'صورة ') + S.W + '×' + S.H : t('Blank sheet', 'ورقة فارغة')) + ' · ' + t('boundaries ', 'الحدود ') + nb + ' · ' + t('beds ', 'الطبقات ') + BB.length + ' · ' + (k ? t('scale 1 px = ', 'المقياس 1 بكسل = ') + F(k * 100, 2) + t(' cm', ' سم') : t('no scale yet: draw the scale line', 'لا مقياس بعد: ارسم خط المقياس'));
    cards(BB); figs(BB);
  }

  /* ------------------------------------------------------------ bed cards */
  function opt(list, v, ar) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(v || '') === o[0] ? ' selected' : '') + '>' + (ar ? o[2] : o[1]) + '</option>'; }).join(''); }
  function cards(BB) {
    var key = BB.map(function (b) { return b.key; }).join(',') + (mpp() ? 's' : ''); if (key === cardsKey) { BB.forEach(function (b) { var e = $('#osBeds').querySelector('[data-key="' + b.key + '"] [data-auto]'); if (e) e.textContent = b.th != null ? F(b.th, 2) + ' m' : '—'; }); return; } cardsKey = key;
    $('#osBeds').innerHTML = BB.slice().reverse().map(function (b) { var d = b.d, ch = function (g) { var q = CH[g], v = d[g] || []; return '<div class="os-chips" data-g="' + g + '"><b>' + q[0] + '</b>' + q[1].map(function (o) { return '<label><input type="checkbox" value="' + o[0] + '"' + (v.indexOf(o[0]) >= 0 ? ' checked' : '') + '>' + (AR ? o[2] : o[1]) + '</label>'; }).join('') + '</div>'; };
      return '<div class="os-bed" data-key="' + b.key + '"><h4><i>' + b.n + '</i>' + t('Bed ', 'الطبقة ') + b.n + (b.n === 1 ? t(' (lowest)', ' (الأدنى)') : b.n === BB.length ? t(' (highest)', ' (الأعلى)') : '') + '<small class="muted" style="font-weight:500;margin-inline-start:auto">' + t('thickness on the sketch ', 'السمك من الرسم ') + '<b data-auto class="ltr">' + (b.th != null ? F(b.th, 2) + ' m' : '—') + '</b></small></h4>' +
        '<div class="os-g"><label>' + t('Lithology', 'الصخارية') + '<select data-k="lith">' + opt(LITH, d.lith, AR) + '</select></label><label>' + t('Colour', 'اللون') + '<input type="color" data-k="col" value="' + (d.col || '#E6E0C8') + '"></label><label>' + t('Colour in words', 'وصف اللون') + '<input type="text" data-k="colName" value="' + SH.esc(d.colName || '') + '" placeholder="' + t('light grey, weathers buff', 'رمادي فاتح، يتجوى أصفر') + '"></label><label>' + t('Grain size', 'الحجم الحبيبي') + '<select data-k="grain">' + opt(GRAIN, d.grain, AR) + '</select></label><label>' + t('Bedding', 'سمك التطبق') + '<select data-k="bedT">' + opt(BEDT, d.bedT, AR) + '</select></label><label>' + t('Thickness (m), if measured', 'السمك (م) إن قيس') + '<input type="number" step="any" min="0" class="ltr" data-k="th" value="' + (d.th != null ? d.th : '') + '"></label></div>' +
        ch('veins') + ch('sed') + ch('tect') + ch('geo') +
        '<div class="os-g"><label>' + t('Fossils', 'المتحجرات') + '<input type="text" data-k="fos" value="' + SH.esc(d.fos || '') + '" placeholder="' + t('nummulites, oysters…', 'نيوميولايت، محار…') + '"></label><label>' + t('Joints (sets, spacing, orientation)', 'الفواصل (المجموعات والتباعد والاتجاه)') + '<input type="text" data-k="jnt" value="' + SH.esc(d.jnt || '') + '" placeholder="040/85, 30 cm"></label></div>' +
        '<textarea data-k="note" placeholder="' + t('Other observations: contacts, weathering, cement, porosity, reaction with acid…', 'ملاحظات أخرى: التماسات والتجوية والمادة اللاحمة والمسامية والتفاعل مع الحامض…') + '">' + SH.esc(d.note || '') + '</textarea></div>'; }).join('') || '<p class="muted">' + t('Draw at least one bed boundary on the sketch.', 'ارسم حداً واحداً على الأقل بين الطبقات.') + '</p>';
  }
  function onCard(e) {
    var c = e.target.closest('[data-key]'); if (!c) return; var d = S.beds[c.getAttribute('data-key')]; if (!d) return; var g = e.target.closest('[data-g]');
    if (g) d[g.getAttribute('data-g')] = Array.prototype.filter.call(g.querySelectorAll('input'), function (i) { return i.checked; }).map(function (i) { return i.value; });
    else { var k = e.target.getAttribute('data-k'); if (!k) return; var v = e.target.value; d[k] = k === 'th' ? (v === '' ? null : parseFloat(v)) : v; if (k === 'lith' && !d.colTouched) { var q = LITH.filter(function (x) { return x[0] === v; })[0]; if (q) { d.col = q[3]; c.querySelector('[data-k=col]').value = q[3]; } } if (k === 'col') d.colTouched = 1; }
    save(); var BB = beds(), r = scene(BB, null, 'e'); svg.innerHTML = '<defs>' + r.defs + '</defs>' + r.s; figs(BB);
  }
  $('#osBeds').addEventListener('input', onCard); $('#osBeds').addEventListener('change', onCard);
  $('#osRef').addEventListener('input', function () { draw(); });

  /* ------------------------------------------------------------ figures */
  function descr(b) { var d = b.d, p = [lithName(d.lith)], g = GRAIN.filter(function (x) { return x[0] === d.grain; })[0], bt = BEDT.filter(function (x) { return x[0] === d.bedT; })[0], nm = function (gr) { return (d[gr] || []).map(function (k) { return CH[gr][1].filter(function (o) { return o[0] === k; })[0][1]; }); };
    if (d.colName) p.push(d.colName); if (g && g[0]) p.push(g[1].toLowerCase()); if (bt && bt[0]) p.push(bt[1].toLowerCase().replace(/ \(.*\)/, '') + ' bedded');
    var s = p.join(', '); if (d.fos) s += '; fossils: ' + d.fos; if ((d.veins || []).length) s += '; veins: ' + nm('veins').join(', '); if ((d.sed || []).length) s += '; ' + nm('sed').join(', '); if ((d.tect || []).length) s += '; ' + nm('tect').join(', '); if (d.jnt) s += '; joints ' + d.jnt; if ((d.geo || []).length) s += '; ' + nm('geo').join(', '); if (d.note) s += '. ' + d.note; return s; }
  function figs(BB) {
    BB = BB || beds(); var fig = $('#osFig'), W = 760, pw = 712, k = pw / S.W, ph = S.H * k, x0 = 24, y0 = 54, r = scene(BB, null, 'f'), s = '', ink = G.INK, meta = S.meta || {};
    s += '<defs>' + r.defs + '<clipPath id="osClip"><rect width="' + S.W + '" height="' + S.H + '"/></clipPath></defs>';
    s += G.tx(x0, 32, (meta.osTitle ? meta.osTitle + ' — ' : '') + 'Outcrop sketch', { fs: 16, fw: 800 });
    var face = parseFloat(meta.osFace), cx = W - 46, cy = 28;
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="17" fill="#fff" stroke="' + ink + '"/>' + G.tx(cx, cy - 20, 'N', { fs: 10, fw: 800, anchor: 'middle' }) + '<line x1="' + cx + '" y1="' + (cy - 17) + '" x2="' + cx + '" y2="' + (cy - 12) + '" stroke="' + ink + '" stroke-width="1.5"/>';
    if (isFinite(face)) s += '<path d="M' + cx + ' ' + (cy - 14) + 'l5 12h-10z" fill="#B08A3E" transform="rotate(' + face + ' ' + cx + ' ' + cy + ')"/><line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - 6) + '" stroke="#B08A3E" stroke-width="2" transform="rotate(' + face + ' ' + cx + ' ' + cy + ')"/>' + G.tx(cx - 26, cy + 4, 'Looking ' + String(Math.round(face)).padStart(3, '0') + '°', { fs: 10.5, anchor: 'end', fill: G.MUT });
    s += '<g transform="translate(' + x0 + ' ' + y0 + ') scale(' + k + ')" clip-path="url(#osClip)">' + r.s + '</g><rect x="' + x0 + '" y="' + y0 + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="' + ink + '" stroke-width="1"/>';
    var y = y0 + ph + 30, m0 = mpp();
    if (m0) s += G.scaleBar(x0 + 8, y, k / m0, 200); else s += G.tx(x0, y + 6, 'No scale drawn', { fs: 11, fill: G.MUT });
    if (meta.osPlace) s += G.tx(W - 24, y + 6, meta.osPlace, { fs: 11, anchor: 'end', fill: G.MUT });
    y += 34; var used = [['b', 'Bed boundary'], ['fault', 'Fault'], ['joint', 'Joint'], ['vein', 'Vein']].filter(function (q) { return S.lines.some(function (l) { return l.k === q[0]; }); }), mk = [['fossil', 'Fossils'], ['sample', 'Sample'], ['dip', 'Dip / note']].filter(function (q) { return S.marks.some(function (m) { return m.k === q[0]; }); });
    var LG = used.map(function (q) { var c = { b: ['#141C24', 2.2, ''], fault: ['#C0392B', 2.6, ''], joint: ['#2E6FBF', 1.6, '4 3'], vein: ['#8A6D1F', 1.6, ''] }[q[0]]; return ['<line x1="0" x2="22" y1="0" y2="0" stroke="' + c[0] + '" stroke-width="' + c[1] + '"' + (c[2] ? ' stroke-dasharray="' + c[2] + '"' : '') + '/>', q[1]]; });
    mk.forEach(function (q) { LG.push([q[0] === 'fossil' ? '<path d="M11-5a5 5 0 1 0 5 5c0-2-1.4-3.2-3.2-3.2S10 -1.6 10 0" stroke="#2E8B57" stroke-width="1.6" fill="none"/>' : q[0] === 'sample' ? '<rect x="7" y="-4" width="8" height="8" fill="#7A4F9A"/>' : '<path d="M4 0h14M11 0v5" stroke="#141C24" stroke-width="1.6"/>', q[1]]); });
    if (BB.length > 1) LG.push(['<circle cx="11" cy="0" r="7" fill="#141C24"/><text x="11" y="3.5" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">1</text>', 'Bed number (from the base)']);
    var lx = x0, ly = y; LG.forEach(function (q) { var w = 34 + q[1].length * 6.4; if (lx + w > W - 20) { lx = x0; ly += 22; } s += '<g transform="translate(' + lx + ' ' + ly + ')">' + q[0] + '</g>' + G.tx(lx + 28, ly + 4, q[1], { fs: 11 }); lx += w + 12; });
    var Hh = ly + 34; s += G.tx(x0, Hh - 10, 'Shandal System · Geological Field Survey', { fs: 10, fill: '#8A6D1F', fw: 700 });
    fig.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh); fig.innerHTML = '<rect width="' + W + '" height="' + Hh + '" fill="#fff"/><rect x="4" y="4" width="' + (W - 8) + '" height="' + (Hh - 8) + '" fill="none" stroke="' + ink + '" stroke-width="1.1"/>' + s;
    logFig(BB);
  }
  function logFig(BB) {
    var lg = $('#osLog'), W = 760, ink = G.INK, x0 = 70, cxL = 260, defs = '', s = '', meta = S.meta || {};
    var th = BB.map(function (b) { return bedTh(b); }), known = th.every(function (v) { return v != null && v > 0; }), tot = known ? th.reduce(function (a, b) { return a + b; }, 0) : BB.length;
    var px = known ? 440 / tot : 440 / Math.max(1, BB.length), lines = BB.map(function (b) { return G.wrap('Bed ' + b.n + ': ' + descr(b), 66); }), H = BB.map(function (b, i) { return Math.max((known ? th[i] : 1) * px, lines[i].length * 14 + 8, 16); }), stretched = H.some(function (h, i) { return Math.abs(h - (known ? th[i] : 1) * px) > 1; });
    var sumH = H.reduce(function (a, b) { return a + b; }, 0), yb = 86 + sumH, y = yb, cum = 0;
    s += G.tx(24, 32, (meta.osTitle ? meta.osTitle + ' — ' : '') + 'Measured section', { fs: 16, fw: 800 }) + G.tx(24, 50, known ? 'Total thickness ' + F(tot, 2) + ' m' : 'Thickness not known: beds drawn with equal height (draw the scale or enter thicknesses)', { fs: 11, fill: G.MUT });
    s += G.tx(x0 - 12, yb + 4, '0', { fs: 10.5, anchor: 'end' });
    BB.forEach(function (b, i) { var h = H[i], g = GRAIN.filter(function (q) { return q[0] === (b.d.grain || ''); })[0] || GRAIN[0], w = g[3] * 1.15, top = y - h; defs += lithPat('lgp' + i, b.d.lith, b.d.lith === 'cover' ? '#fff' : b.d.col || '#eee');
      s += '<rect x="' + x0 + '" y="' + top + '" width="' + w + '" height="' + h + '" fill="url(#lgp' + i + ')" stroke="' + ink + '" stroke-width="1"' + (b.d.lith === 'cover' ? ' stroke-dasharray="4 3"' : '') + '/>';
      s += '<circle cx="' + (x0 - 40) + '" cy="' + (top + h / 2) + '" r="9" fill="#141C24"/>' + G.tx(x0 - 40, top + h / 2 + 4, String(b.n), { fs: 10, fw: 800, anchor: 'middle', fill: '#fff' });
      var gx = x0 + w + 6; if (b.d.fos) { s += '<path d="M' + (gx + 6) + ' ' + (top + h / 2 - 5) + 'a5 5 0 1 0 5 5c0-2-1.4-3.2-3.2-3.2s-1.8 1.6-1.8 3.2" stroke="#2E8B57" stroke-width="1.5" fill="none"/>'; gx += 16; }
      if ((b.d.veins || []).length) { s += '<path d="M' + gx + ' ' + (top + h / 2 + 4) + 'l3-8 3 8 3-8 3 8" stroke="#8A6D1F" stroke-width="1.3" fill="none"/>'; gx += 16; }
      if ((b.d.tect || []).indexOf('fault') >= 0) { s += '<path d="M' + gx + ' ' + (top + h / 2 + 6) + 'l8-12" stroke="#C0392B" stroke-width="2"/>'; }
      lines[i].forEach(function (ln, j) { s += G.tx(cxL, top + h / 2 - (lines[i].length - 1) * 7 + j * 14 + 4, ln, { fs: 11 }); });
      s += '<line x1="' + (x0 - 6) + '" x2="' + x0 + '" y1="' + top + '" y2="' + top + '" stroke="' + ink + '"/>'; cum += known ? th[i] : 1; if (known) s += G.tx(x0 - 12, top + 4, F(cum, cum < 10 ? 2 : 1), { fs: 10.5, anchor: 'end' });
      s += '<line x1="' + (cxL - 8) + '" x2="' + (W - 24) + '" y1="' + top + '" y2="' + top + '" stroke="#E3E7EA"/>'; y = top; });
    s += '<line x1="' + x0 + '" x2="' + x0 + '" y1="' + yb + '" y2="' + y + '" stroke="' + ink + '" stroke-width="1.2"/>' + (known ? G.tx(x0 - 14, y - 10, 'm', { fs: 11, fw: 700, anchor: 'end' }) : '');
    var gy = yb + 18; ['cl', 'si', 'vf', 'f', 'm', 'c', 'vc', 'gr', 'pb', 'cb'].forEach(function (k2) { var g = GRAIN.filter(function (q) { return q[0] === k2; })[0], gx = x0 + g[3] * 1.15; s += '<line x1="' + gx + '" x2="' + gx + '" y1="' + yb + '" y2="' + (yb + 5) + '" stroke="' + ink + '"/>'; s += '<text x="' + gx + '" y="' + gy + '" font-size="8.5" fill="' + G.MUT + '" text-anchor="end" transform="rotate(-50 ' + gx + ' ' + gy + ')" font-family="Manrope,system-ui,sans-serif">' + k2 + '</text>'; });
    s += G.tx(x0, yb + 50, 'Width = grain size (cl clay · si silt · vf–vc sand · gr granule · pb pebble · cb cobble)', { fs: 10.5, fill: G.MUT });
    if (stretched) s += G.tx(x0, yb + 66, 'Some beds are drawn taller than their thickness to fit the description; the depths on the left are exact.', { fs: 10.5, fill: G.MUT });
    var ly = yb + 92, lx = x0, seen = {}; s += G.tx(x0, ly - 8, 'Lithology', { fs: 11.5, fw: 800 }); ly += 4;
    BB.forEach(function (b, i) { if (seen[b.d.lith]) return; seen[b.d.lith] = 1; var nm = lithName(b.d.lith), w = 30 + nm.length * 6.6; if (lx + w > W - 20) { lx = x0; ly += 24; } s += '<rect x="' + lx + '" y="' + (ly - 8) + '" width="22" height="16" fill="url(#lgp' + i + ')" stroke="' + ink + '" stroke-width=".8"/>' + G.tx(lx + 28, ly + 4, nm, { fs: 11 }); lx += w + 14; });
    var Hh = ly + 36; s += G.tx(24, Hh - 10, 'Shandal System · Geological Field Survey', { fs: 10, fill: '#8A6D1F', fw: 700 });
    lg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh); lg.innerHTML = '<defs>' + defs + '</defs><rect width="' + W + '" height="' + Hh + '" fill="#fff"/><rect x="4" y="4" width="' + (W - 8) + '" height="' + (Hh - 8) + '" fill="none" stroke="' + ink + '" stroke-width="1.1"/>' + s;
  }

  /* ------------------------------------------------------------ files */
  $('#osCsv').addEventListener('click', function () { var BB = beds(); SH.csv('shandal-outcrop-beds.csv', [['bed', 'lithology', 'colour_hex', 'colour', 'grain_size', 'bedding', 'thickness_m', 'thickness_source', 'fossils', 'veins', 'sedimentary_structures', 'tectonic_structures', 'joints', 'landform', 'notes']].concat(BB.map(function (b) { var d = b.d, tv = bedTh(b); return [b.n, lithName(d.lith), d.col || '', d.colName || '', (GRAIN.filter(function (q) { return q[0] === d.grain; })[0] || ['', ''])[1], (BEDT.filter(function (q) { return q[0] === d.bedT; })[0] || ['', ''])[1], tv != null ? +tv.toFixed(3) : '', d.th != null ? 'measured' : b.th != null ? 'sketch' : '', d.fos || '', nmC(d, 'veins'), nmC(d, 'sed'), nmC(d, 'tect'), d.jnt || '', nmC(d, 'geo'), d.note || '']; }))); });
  function nmC(d, g) { return (d[g] || []).map(function (k) { var o = CH[g][1].filter(function (q) { return q[0] === k; })[0]; return o ? o[1] : k; }).join('; '); }
  $('#osJson').addEventListener('click', function () { SH.json('shandal-outcrop-sketch.json', S); });
  $('#osOpen').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; f.text().then(function (x) { var o = JSON.parse(x); if (!o || !o.W || !Array.isArray(o.lines)) throw new Error(t('Not an outcrop sketch file.', 'ليس ملف رسم منكشف.')); snap(); S = o; cardsKey = ''; if (S.meta) Object.keys(S.meta).forEach(function (k) { if ($('#' + k)) $('#' + k).value = S.meta[k]; }); save(); draw(); }).catch(function (e) { SH.toast(e.message, 'bad'); }); this.value = ''; });

  setMode('b'); draw();
  window.SHOS = { S: function () { return S; }, beds: beds, draw: draw, mpp: mpp };
})();
