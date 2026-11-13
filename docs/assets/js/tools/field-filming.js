/* Field filming — a shot list for a field video built from the stops of the day and the length of the finished film,
   an in-app camera that shows the instruction for each shot, counts its seconds (with still seconds before and after
   for cutting) and stops by itself, and a shot log with the time, position and the direction the phone faced.
   Clips stay on the device (IndexedDB) and are saved to the phone only when the user taps. Everything works offline. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, AR = SH.lang === 'ar', KEY = 'shandal_ff', esc = SH.esc;
  var INK = '#1B232B', MUT = '#55616B';
  var SC = ['#1F6FB8', '#C0392B', '#2E8B57', '#B08A3E', '#7A4F9A', '#0B8FB0', '#8C6239', '#D35400', '#3C4A57', '#9B2F6F'];
  /* shot kinds: key, English, Arabic, colour */
  var KIND = { wide: ['Wide', 'لقطة واسعة', '#1F6FB8'], medium: ['Medium', 'لقطة متوسطة', '#0B8FB0'], close: ['Close-up', 'لقطة قريبة', '#C0392B'], gesture: ['Pointing', 'إشارة باليد', '#B08A3E'], tool: ['Tool in use', 'أداة أثناء العمل', '#2E8B57'], move: ['Moving', 'لقطة متحركة', '#7A4F9A'], sound: ['Natural sound', 'صوت الطبيعة', '#6E6E6E'] };
  /* stop templates: [kind, base seconds, priority (1 kept always), what EN, what AR, point EN, point AR] */
  function S_(k, s, p, a, b, c, d) { return [k, s, p, a, b, c, d]; }
  var TPL = {
    outcrop: ['Layered outcrop', 'منكشف طبقي', [
      S_('wide', 5, 1, 'The whole face with all the beds in the frame; a person or the car in the picture gives the scale.', 'الواجهة كاملة وكل الطبقات داخل الإطار؛ ووجود شخص أو السيارة في الصورة يعطي المقياس.', 'the whole sequence, bottom to top', 'التتابع كله من الأسفل إلى الأعلى'),
      S_('move', 4, 2, 'Walk slowly along the beds with the camera at chest height.', 'امشِ ببطء بمحاذاة الطبقات والكاميرا بمستوى الصدر.', 'follow one bed with the camera', 'تابع طبقة واحدة بالكاميرا'),
      S_('close', 4, 1, 'Close-up of the bedding with the hammer or a ruler beside it for scale.', 'لقطة قريبة للتطبق والمطرقة أو مسطرة بجانبه كمقياس.', 'the contact between two beds or a colour change', 'التماس بين طبقتين أو تغيّر اللون'),
      S_('gesture', 3, 2, 'Your finger traces the boundary between two beds or along a lamination.', 'إصبعك يتتبع الحد بين طبقتين أو على امتداد تصفّح.', 'the boundary', 'الحد'),
      S_('tool', 4, 1, 'The measurement in action: the compass on the bed, a drop of acid, or the hammer opening a fresh surface.', 'القياس أثناء العمل: البوصلة على الطبقة، أو قطرة الحامض، أو المطرقة تكشف سطحاً طازجاً.', 'the reading, the fizz or the fresh colour', 'القراءة أو الفوران أو اللون الطازج')]],
    fold: ['Fold', 'طية', [
      S_('wide', 6, 1, 'The whole fold with both limbs in the frame, from far enough away.', 'الطية كاملة وجناحاها داخل الإطار، من مسافة كافية.', 'the hinge and both limbs', 'المفصل والجناحان'),
      S_('move', 5, 2, 'Slow pan from one limb across the hinge to the other.', 'حركة أفقية بطيئة من جناح عبر المفصل إلى الجناح الآخر.', 'follow one bed around the fold', 'تابع طبقة واحدة حول الطية'),
      S_('gesture', 3, 2, 'Your hand draws the shape of the fold in the air in front of it.', 'يدك ترسم شكل الطية في الهواء أمامها.', 'the hinge line', 'خط المفصل'),
      S_('tool', 4, 1, 'The dip measured on each limb with the compass.', 'قياس الميل على كل جناح بالبوصلة.', 'the reading on the compass', 'القراءة على البوصلة'),
      S_('close', 3, 3, 'Close-up of the bedding on one limb with a scale.', 'لقطة قريبة للتطبق على أحد الجناحين مع مقياس.', 'the bed surface', 'سطح الطبقة')]],
    fault: ['Fault', 'فالق', [
      S_('wide', 5, 1, 'The fault in its setting, with the beds on both sides.', 'الفالق في موضعه مع الطبقات على جانبيه.', 'the fault trace', 'أثر الفالق'),
      S_('close', 4, 1, 'The fault surface or crushed zone, with the hammer for scale.', 'سطح الفالق أو نطاق السحق، والمطرقة كمقياس.', 'slickensides, breccia or gouge', 'خدوش الاحتكاك أو البريشيا أو الطحين الفالقي'),
      S_('gesture', 3, 1, 'Your finger follows one bed to the fault and finds it again on the other side.', 'إصبعك يتبع طبقة حتى الفالق ثم يجدها على الجانب الآخر.', 'the offset', 'مقدار الإزاحة'),
      S_('tool', 4, 2, 'The fault plane measured with the compass.', 'قياس مستوى الفالق بالبوصلة.', 'the reading', 'القراءة'),
      S_('medium', 3, 3, 'Medium shot of the displaced beds.', 'لقطة متوسطة للطبقات المزاحة.', 'the displacement', 'الإزاحة')]],
    cave: ['Cave', 'كهف', [
      S_('wide', 5, 1, 'The entrance in the cliff, from outside.', 'المدخل في الجرف، من الخارج.', 'the entrance and the rock it is in', 'المدخل والصخر الذي فيه'),
      S_('move', 5, 2, 'Walking in, filmed from behind, with a light.', 'الدخول مصوَّراً من الخلف مع إضاءة.', 'the passage', 'الممر'),
      S_('close', 4, 2, 'Detail of the walls or cave formations, lit from the side.', 'تفاصيل الجدران أو ترسبات الكهف بإضاءة جانبية.', 'dripstone, flowstone or dissolution marks', 'الهوابط والصواعد أو آثار الإذابة'),
      S_('sound', 3, 3, 'A still frame inside with only the sound of the cave.', 'لقطة ثابتة في الداخل بصوت الكهف فقط.', '—', '—')]],
    water: ['Spring or waterfall', 'نبع أو شلال', [
      S_('wide', 6, 1, 'The spring or waterfall with the rock around it.', 'النبع أو الشلال مع الصخر من حوله.', 'where the water comes out', 'مكان خروج الماء'),
      S_('close', 4, 1, 'Close-up of the water leaving the rock.', 'لقطة قريبة للماء وهو يخرج من الصخر.', 'the outlet or the lip of the fall', 'المخرج أو حافة الشلال'),
      S_('medium', 4, 2, 'The rock layer the water comes from.', 'الطبقة الصخرية التي يخرج منها الماء.', 'the water-bearing bed', 'الطبقة الحاملة للماء'),
      S_('sound', 3, 3, 'A still frame with only the sound of the water.', 'لقطة ثابتة بصوت الماء فقط.', '—', '—')]],
    archaeo: ['Archaeological or heritage site', 'موقع أثري أو تراثي', [
      S_('wide', 6, 1, 'The site in its landscape, showing the ground it stands on.', 'الموقع في محيطه، مع الأرض التي يقوم عليها.', 'the site and the rock or hill below it', 'الموقع والصخر أو التل تحته'),
      S_('medium', 4, 2, 'The main structure or carving from a respectful distance.', 'البناء أو النحت الرئيسي من مسافة لائقة.', 'the structure', 'البناء'),
      S_('close', 4, 2, 'Detail of the stone used, without touching or climbing.', 'تفاصيل الحجر المستخدم، دون لمس أو تسلق.', 'the texture of the stone', 'ملمس الحجر'),
      S_('gesture', 3, 3, 'Point toward the hills where the stone may have come from, if they are in view.', 'أشر نحو التلال التي ربما جاء منها الحجر، إن كانت ظاهرة.', 'the source outcrop', 'المنكشف المصدر')]],
    view: ['Landscape or panorama', 'منظر طبيعي أو بانوراما', [
      S_('wide', 8, 1, 'Slow pan across the landscape, holding the first and last frame still.', 'حركة أفقية بطيئة عبر المنظر، مع تثبيت أول الإطار وآخره.', 'ridges, valleys and rivers', 'الحافات والوديان والأنهار'),
      S_('medium', 4, 2, 'Medium shot of the main landform, without zooming.', 'لقطة متوسطة لأبرز شكل أرضي، دون تقريب رقمي.', 'the landform', 'الشكل الأرضي'),
      S_('sound', 3, 3, 'A still frame with natural sound.', 'لقطة ثابتة بصوت الطبيعة.', '—', '—')]],
    sample: ['Rock, mineral or fossil in hand', 'صخرة أو معدن أو متحجرة في اليد', [
      S_('close', 5, 1, 'The specimen in your hand with a ruler, against a plain background.', 'العيّنة في يدك مع مسطرة، أمام خلفية سادة.', 'its main feature', 'أبرز ما فيها'),
      S_('move', 4, 2, 'Turn the specimen slowly to show every side.', 'أدِر العيّنة ببطء لتظهر كل جوانبها.', 'texture and crystal faces', 'النسيج وأوجه البلورات'),
      S_('close', 4, 2, 'Through the hand lens, very close.', 'من خلال العدسة اليدوية، عن قرب شديد.', 'grains, crystals or fossil detail', 'الحبيبات أو البلورات أو تفاصيل المتحجرة'),
      S_('tool', 3, 3, 'A simple test: scratch, streak or acid.', 'اختبار بسيط: الخدش أو المخدش أو الحامض.', 'the result', 'النتيجة')]],
    road: ['On the road', 'على الطريق', [
      S_('move', 6, 1, 'From the moving car (passenger side), the road cuts or the mountains passing by.', 'من السيارة وهي تسير (من جهة الراكب)، قطوع الطريق أو الجبال وهي تمر.', 'layers in the road cuts', 'الطبقات في قطوع الطريق'),
      S_('wide', 4, 2, 'A road sign or landmark that shows where you are.', 'لافتة طريق أو معلم يبيّن أين أنت.', 'the sign', 'اللافتة')]]
  };
  var OPEN = ['Opening', 'الافتتاح', [
    S_('wide', 5, 1, 'The area at a glance: the valley, the mountains or the road toward the first stop. Hold still or pan slowly.', 'المنطقة بنظرة واحدة: الوادي أو الجبال أو الطريق نحو المحطة الأولى. ثبّت الكاميرا أو حرّكها ببطء.', '—', '—'),
    S_('move', 4, 2, 'You walking toward the first stop, filmed from behind or the side.', 'أنت تمشي نحو المحطة الأولى، مصوَّراً من الخلف أو الجانب.', '—', '—')]];
  var CLOSE = ['Closing', 'الختام', [
    S_('wide', 5, 1, 'Pull back from the last stop to the wide landscape.', 'ابتعد من المحطة الأخيرة إلى المنظر الواسع.', '—', '—'),
    S_('sound', 3, 3, 'A still frame with only natural sound to end on.', 'لقطة ثابتة بصوت الطبيعة فقط للختام.', '—', '—')]];

  var S = SH.store.get(KEY, null) || { title: '', len: 60, or: 'v', pad: 3, stops: [], log: {}, n: 0 };
  if (!S.log) S.log = {};
  function save() { SH.store.set(KEY, S); }

  /* ------------------------------------------------------------ the plan */
  function plan() {
    var blocks = [{ id: 'open', name: t(OPEN[0], OPEN[1]), tp: OPEN, c: '#3C4A57', no: 0 }].concat(S.stops.map(function (s, i) { return { id: s.id, name: s.name || t(TPL[s.type][0], TPL[s.type][1]), en: s.name || TPL[s.type][0], tp: TPL[s.type], c: SC[i % SC.length], no: i + 1 }; }), [{ id: 'close', name: t(CLOSE[0], CLOSE[1]), tp: CLOSE, c: '#3C4A57', no: S.stops.length + 1 }]);
    var T = +S.len || 60, keep = 3, shots;
    function collect() { shots = []; blocks.forEach(function (b) { b.shots = []; b.tp[2].forEach(function (q, j) { if (q[2] <= keep) { var o = { id: b.id + '-' + j, b: b, k: q[0], base: q[1], pr: q[2], w: t(q[3], q[4]), p: t(q[5], q[6]) }; b.shots.push(o); shots.push(o); } }); }); }
    collect(); var sum = function () { return shots.reduce(function (a, o) { return a + o.base; }, 0); };
    while (keep > 1 && T / sum() < 0.75) { keep--; collect(); }
    var f = T / sum(); shots.forEach(function (o) { o.s = Math.max(2, Math.round(o.base * f)); });
    var tot = shots.reduce(function (a, o) { return a + o.s; }, 0), guard = 200, ord = shots.slice().sort(function (a, b) { return b.s - a.s; });
    while (tot !== T && guard--) { var i = guard % ord.length, o = ord[i]; if (tot > T && o.s > 2) { o.s--; tot--; } else if (tot < T) { o.s++; tot++; } }
    var k = 0; blocks.forEach(function (b) { b.shots.forEach(function (o, j) { o.no = j + 1; o.seq = ++k; }); });
    return { blocks: blocks, shots: shots, total: tot };
  }

  /* ------------------------------------------------------------ position and direction */
  var FIX = null, HDG = null, ROLL = null, watching = false, oriented = false;
  function startGps() {
    if (watching || !navigator.geolocation) return; watching = true;
    navigator.geolocation.watchPosition(function (p) { FIX = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }; }, function () {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  }
  function onOri(e) {
    var a = e.webkitCompassHeading != null ? (360 - e.webkitCompassHeading) : (e.absolute || e.type === 'deviceorientationabsolute') ? e.alpha : null;
    if (a == null || e.beta == null) return;
    var r = Math.PI / 180, cA = Math.cos(a * r), sA = Math.sin(a * r), cB = Math.cos(e.beta * r), sB = Math.sin(e.beta * r), cG = Math.cos(e.gamma * r), sG = Math.sin(e.gamma * r);
    var vE = -(cA * sG + sA * sB * cG), vN = -(sA * sG - cA * sB * cG), h;
    if (Math.hypot(vE, vN) > 0.5) h = Math.atan2(vE, vN) / r; else h = Math.atan2(-sA * cB, cA * cB) / r;
    HDG = (h + 360) % 360;
  }
  function onMot(e) {
    var g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
    var ang = Math.atan2(g.x, g.y) * 180 / Math.PI, so = (screen.orientation && screen.orientation.angle) || window.orientation || 0, rel = ((ang - so + 540) % 360) - 180;
    if (rel > 90) rel -= 180; else if (rel < -90) rel += 180; ROLL = rel;
  }
  function startOri() {
    if (oriented) return Promise.resolve(); oriented = true;
    var ask = window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission ? DeviceOrientationEvent.requestPermission().catch(function () {}) : Promise.resolve();
    var askM = window.DeviceMotionEvent && DeviceMotionEvent.requestPermission ? DeviceMotionEvent.requestPermission().catch(function () {}) : Promise.resolve();
    return Promise.all([ask, askM]).then(function () {
      if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri); else window.addEventListener('deviceorientation', onOri);
      window.addEventListener('devicemotion', onMot);
    });
  }

  /* ------------------------------------------------------------ clips store */
  var DB = null;
  function db() { if (DB) return DB; DB = new Promise(function (res, rej) { var q = indexedDB.open('shandal-film', 1); q.onupgradeneeded = function () { q.result.createObjectStore('clips', { keyPath: 'id' }); }; q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); return DB; }
  function tx(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var s = d.transaction('clips', mode).objectStore('clips'), r = fn(s); s.transaction.oncomplete = function () { res(r && r.result); }; s.transaction.onerror = function () { rej(s.transaction.error); }; }); }); }
  function clips() { return tx('readonly', function (s) { return s.getAll(); }).then(function (a) { return a || []; }); }

  /* ------------------------------------------------------------ stops panel */
  $('#ffType').innerHTML = Object.keys(TPL).map(function (k) { return '<option value="' + k + '">' + t(TPL[k][0], TPL[k][1]) + '</option>'; }).join('');
  function stopsUI() {
    $('#ffStops').innerHTML = S.stops.length ? S.stops.map(function (s, i) {
      return '<div class="ff-stop" data-i="' + i + '"><div class="r"><input data-f="name" value="' + esc(s.name) + '" placeholder="' + esc(t('Stop ', 'المحطة ') + (i + 1)) + '" aria-label="' + t('Stop name', 'اسم المحطة') + '"><select data-f="type">' + Object.keys(TPL).map(function (k) { return '<option value="' + k + '"' + (k === s.type ? ' selected' : '') + '>' + t(TPL[k][0], TPL[k][1]) + '</option>'; }).join('') + '</select></div>' +
        '<div class="b" style="grid-template-columns:repeat(3,auto)"><button type="button" data-a="up" aria-label="' + t('Move up', 'إلى الأعلى') + '">▲</button><button type="button" data-a="dn" aria-label="' + t('Move down', 'إلى الأسفل') + '">▼</button><button type="button" data-a="rm" aria-label="' + t('Remove', 'احذف') + '">✕</button></div></div>';
    }).join('') : '<p class="xsmall muted" style="margin:0">' + t('No stops yet: choose the kind of stop and add it.', 'لا محطات بعد: اختر نوع المحطة وأضفها.') + '</p>';
  }
  $('#ffAdd').addEventListener('click', function () { S.n = (S.n || 0) + 1; S.stops.push({ id: 's' + S.n, name: '', type: $('#ffType').value }); save(); render(); });
  $('#ffStops').addEventListener('change', function (e) { var r = e.target.closest('[data-i]'), f = e.target.getAttribute('data-f'); if (!r || !f) return; S.stops[+r.getAttribute('data-i')][f] = e.target.value; save(); render(true); });
  $('#ffStops').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return; var i = +b.closest('[data-i]').getAttribute('data-i'), a = b.getAttribute('data-a');
    if (a === 'up' && i > 0) S.stops.splice(i - 1, 0, S.stops.splice(i, 1)[0]); else if (a === 'dn' && i < S.stops.length - 1) S.stops.splice(i + 1, 0, S.stops.splice(i, 1)[0]); else if (a === 'rm') S.stops.splice(i, 1);
    save(); render();
  });
  [['ffTitle', 'title'], ['ffLen', 'len'], ['ffOr', 'or'], ['ffPad', 'pad']].forEach(function (q) { var e = $('#' + q[0]); e.value = S[q[1]] != null ? S[q[1]] : e.value; e.addEventListener('change', function () { S[q[1]] = q[1] === 'title' || q[1] === 'or' ? e.value : +e.value; save(); render(); }); });

  /* ------------------------------------------------------------ shot list */
  var P = null;
  function render(keepStops) {
    if (!keepStops) stopsUI();
    P = plan();
    var done = P.shots.filter(function (o) { return S.log[o.id]; }), fs = done.reduce(function (a, o) { return a + (S.log[o.id].dur || 0); }, 0);
    $('#ffKpis').innerHTML = G.kpi('', t('Stops', 'المحطات'), S.stops.length, t('plus opening and closing', 'مع الافتتاح والختام')) + G.kpi('', t('Shots', 'اللقطات'), P.shots.length, F(P.total, 0) + t(' s planned', ' ث مخططة')) + G.kpi(done.length === P.shots.length && P.shots.length ? 'ok' : '', t('Filmed', 'صُوّرت'), done.length + ' / ' + P.shots.length, F(fs, 0) + t(' s filmed', ' ث مصوَّرة'));
    $('#ffList').innerHTML = P.blocks.map(function (b) {
      return '<div><h3 class="ff-sh"><i style="background:' + b.c + '">' + (b.id === 'open' ? '▶' : b.id === 'close' ? '■' : b.no) + '</i>' + esc(b.name) + '</h3>' + b.shots.map(function (o) {
        var L = S.log[o.id], K = KIND[o.k];
        return '<div class="ff-shot' + (L ? ' done' : '') + '"><span class="n" style="background:' + K[2] + '">' + o.seq + '</span><div class="h">' + t(K[0], K[1]) + '<span class="s">' + o.s + t(' s', ' ث') + (S.pad ? ' + ' + (2 * S.pad) + t(' s spare', ' ث احتياط') : '') + '</span></div>' +
          '<p>' + esc(o.w) + '</p>' + (o.p !== '—' ? '<p><b>' + t('Point at: ', 'أشر إلى: ') + '</b>' + esc(o.p) + '</p>' : '') +
          '<div class="acts"><button type="button" class="rec" data-film="' + o.id + '">● ' + t('Film', 'صوّر') + '</button><button type="button" data-done="' + o.id + '">' + (L ? t('Log again', 'سجّل مجدداً') : t('Done', 'تمّت')) + '</button>' + (L ? '<span class="ok">✓ ' + new Date(L.t).toLocaleTimeString(AR ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) + (L.lat != null ? ' · ' + SH.ltr(L.lat.toFixed(5) + ', ' + L.lon.toFixed(5)) : '') + (L.hdg != null ? ' · ' + SH.ltr(F(L.hdg, 0) + '°') : '') + '</span>' : '') + '</div></div>';
      }).join('') + '</div>';
    }).join('');
    figMap(); figTime(); clipsUI();
  }
  function logShot(o, dur, clipId) {
    var L = { t: Date.now(), dur: dur, clip: clipId || null, seq: o.seq, k: o.k, stop: o.b.name };
    if (FIX && Date.now() - FIX.t < 120000) { L.lat = FIX.lat; L.lon = FIX.lon; L.acc = FIX.acc; }
    if (HDG != null) L.hdg = HDG;
    S.log[o.id] = L; save();
  }
  function shotById(id) { return P.shots.filter(function (o) { return o.id === id; })[0]; }
  $('#ffList').addEventListener('click', function (e) {
    var d = e.target.closest('[data-done]'), f = e.target.closest('[data-film]');
    if (d) { var o = shotById(d.getAttribute('data-done')); startGps(); startOri().then(function () { var go = function () { logShot(o, o.s, null); render(true); SH.toast(t('Shot logged.', 'سُجّلت اللقطة.'), 'ok'); }; if (FIX) go(); else { SH.toast(t('Getting your position…', 'جارٍ تحديد موقعك…')); setTimeout(go, 4000); } }); }
    if (f) openCam(f.getAttribute('data-film'));
  });

  /* ------------------------------------------------------------ camera */
  var CAM = { st: null, rec: null, o: null, raf: 0, chunks: [], t0: 0, mime: '' };
  function pickMime() { var c = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; if (!window.MediaRecorder) return null; for (var i = 0; i < c.length; i++) if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(c[i])) return c[i]; return ''; }
  function camText(o) {
    $('#ffCamH').textContent = o.seq + '. ' + o.b.name + ' — ' + t(KIND[o.k][0], KIND[o.k][1]) + ' (' + o.s + t(' s', ' ث') + ')';
    $('#ffCamP').innerHTML = esc(o.w) + (o.p !== '—' ? '<br><b>' + t('Point at: ', 'أشر إلى: ') + '</b>' + esc(o.p) : '');
    $('#ffPh').textContent = t('Frame the shot, then press Start.', 'اضبط الإطار ثم اضغط «ابدأ».'); $('#ffBar').style.width = '0';
    $('#ffGo').hidden = false; $('#ffStop').hidden = true; $('#ffNext').hidden = true;
  }
  function openCam(id) {
    var o = shotById(id); if (!o) return; CAM.o = o; CAM.mime = pickMime();
    if (CAM.mime === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { SH.toast(t('This browser cannot record video here. Film with the phone camera and tap «Done» to log the shot.', 'لا يستطيع هذا المتصفح تسجيل الفيديو هنا. صوّر بكاميرا الهاتف ثم انقر «تمّت» لتسجيل اللقطة.'), 'warn', 7000); return; }
    startGps(); startOri();
    var v = S.or === 'h' ? { width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1080 }, height: { ideal: 1920 } };
    var cons = { video: Object.assign({ facingMode: { ideal: 'environment' } }, v), audio: true };
    navigator.mediaDevices.getUserMedia(cons).catch(function () { cons.audio = false; return navigator.mediaDevices.getUserMedia(cons); }).then(function (st) {
      CAM.st = st; $('#ffVid').srcObject = st; $('#ffCam').hidden = false; document.documentElement.style.overflow = 'hidden'; camText(o); idle();
    }).catch(function () { SH.toast(t('The camera could not be opened. Allow camera access for this site, or film with the phone camera and tap «Done».', 'تعذّر فتح الكاميرا. اسمح للموقع باستخدام الكاميرا، أو صوّر بكاميرا الهاتف وانقر «تمّت».'), 'bad', 7000); });
  }
  function meta() { $('#ffMeta').textContent = (FIX ? FIX.lat.toFixed(5) + ', ' + FIX.lon.toFixed(5) + ' ±' + F(FIX.acc, 0) + ' m' : t('position: waiting', 'الموقع: بانتظار الإشارة')) + (HDG != null ? ' · ' + F(HDG, 0) + '°' : '') + (ROLL != null ? ' · ' + t('tilt ', 'الميلان ') + F(ROLL, 1) + '°' : ''); var l = $('#ffLvl'); if (ROLL != null) { l.style.transform = 'rotate(' + (-ROLL) + 'deg)'; l.classList.toggle('ok', Math.abs(ROLL) < 1.5); } }
  function idle() { cancelAnimationFrame(CAM.raf); (function lp() { meta(); if (!CAM.rec) CAM.raf = requestAnimationFrame(lp); })(); }
  function closeCam() { stopRec(true); cancelAnimationFrame(CAM.raf); if (CAM.st) CAM.st.getTracks().forEach(function (k) { k.stop(); }); CAM.st = null; $('#ffCam').hidden = true; document.documentElement.style.overflow = ''; render(true); }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
  $('#ffGo').addEventListener('click', function () {
    var o = CAM.o, pad = +S.pad || 0, total = o.s + 2 * pad; CAM.chunks = [];
    try { CAM.rec = CAM.mime ? new MediaRecorder(CAM.st, { mimeType: CAM.mime }) : new MediaRecorder(CAM.st); } catch (e) { CAM.rec = new MediaRecorder(CAM.st); }
    CAM.rec.ondataavailable = function (e) { if (e.data && e.data.size) CAM.chunks.push(e.data); };
    CAM.rec.onstop = function () { finish(); };
    CAM.rec.start(500); CAM.t0 = performance.now(); buzz(60);
    $('#ffGo').hidden = true; $('#ffStop').hidden = false; $('#ffNext').hidden = true; var ph = -1;
    (function lp() {
      var s = (performance.now() - CAM.t0) / 1000, np = s < pad ? 0 : s < pad + o.s ? 1 : 2;
      if (np !== ph) { ph = np; if (ph > 0) buzz(ph === 1 ? 120 : [60, 60, 60]); }
      $('#ffPh').textContent = ph === 0 ? t('Hold still · ', 'ثبّت الكاميرا · ') + Math.ceil(pad - s) : ph === 1 ? t('Action · ', 'نفّذ اللقطة · ') + Math.ceil(pad + o.s - s) + t(' s', ' ث') : t('Hold still · ', 'ثبّت الكاميرا · ') + Math.max(0, Math.ceil(total - s));
      $('#ffBar').style.width = Math.min(100, s / total * 100) + '%'; $('#ffBar').style.background = ph === 1 ? '#C0392B' : '#F5C04A'; meta();
      if (s >= total) { stopRec(); return; }
      CAM.raf = requestAnimationFrame(lp);
    })();
  });
  function stopRec(discard) { cancelAnimationFrame(CAM.raf); if (CAM.rec && CAM.rec.state !== 'inactive') { CAM.discard = !!discard; CAM.el = (performance.now() - CAM.t0) / 1000; CAM.rec.stop(); } }
  $('#ffStop').addEventListener('click', function () { stopRec(); });
  function finish() {
    var o = CAM.o, rec = CAM.rec; CAM.rec = null; buzz(200);
    if (CAM.discard || !CAM.chunks.length) { CAM.discard = false; return; }
    var pad = +S.pad || 0, el = CAM.el || 0, dur = Math.max(0, Math.min(o.s, el - pad)), type = (rec && rec.mimeType) || CAM.mime || 'video/webm', blob = new Blob(CAM.chunks, { type: type.split(';')[0] }), id = 'c' + Date.now();
    var c = { id: id, sid: o.id, seq: o.seq, stop: o.b.name, k: o.k, t: Date.now(), el: el, dur: dur, size: blob.size, mime: blob.type, blob: blob };
    logShot(o, dur, id); var L = S.log[o.id]; c.lat = L.lat; c.lon = L.lon; c.hdg = L.hdg;
    tx('readwrite', function (s) { return s.put(c); }).then(function () { $('#ffPh').textContent = t('Saved on this device (', 'حُفظ على هذا الجهاز (') + F(el, 1) + t(' s). Film again or go to the next shot.', ' ث). صوّر مجدداً أو انتقل إلى اللقطة التالية.'); }).catch(function () { $('#ffPh').textContent = t('The device storage is full: save the clips to the phone and delete them here.', 'ذاكرة الجهاز ممتلئة: احفظ المقاطع في الهاتف واحذفها من هنا.'); });
    $('#ffGo').hidden = false; $('#ffGo').textContent = t('Film again', 'صوّر مجدداً'); $('#ffStop').hidden = true; $('#ffNext').hidden = !nextShot(o); idle();
  }
  function nextShot(o) { var i = P.shots.indexOf(o); return P.shots[i + 1] || null; }
  $('#ffNext').addEventListener('click', function () { var n = nextShot(CAM.o); if (!n) return; CAM.o = n; $('#ffGo').textContent = t('Start', 'ابدأ'); camText(n); });
  $('#ffClose').addEventListener('click', closeCam);

  /* ------------------------------------------------------------ clips list */
  function ext(m) { return /mp4/.test(m) ? 'mp4' : 'webm'; }
  function clipName(c) { return 'shandal-film-' + String(c.seq).padStart(2, '0') + '-' + c.k + '-' + new Date(c.t).toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.' + ext(c.mime); }
  function clipsUI() {
    clips().then(function (a) {
      a.sort(function (x, y) { return x.seq - y.seq || x.t - y.t; }); var tot = a.reduce(function (s, c) { return s + c.size; }, 0);
      $('#ffClips').innerHTML = a.length ? '<p class="xsmall muted" style="margin:0">' + a.length + t(' clips · ', ' مقطعاً · ') + F(tot / 1048576, 1) + ' MB</p>' + a.map(function (c) {
        return '<div class="ff-clip"><div><b>' + c.seq + '. ' + esc(c.stop) + ' — ' + t(KIND[c.k][0], KIND[c.k][1]) + '</b><br><span class="muted">' + F(c.el, 1) + t(' s · ', ' ث · ') + F(c.size / 1048576, 1) + ' MB · ' + new Date(c.t).toLocaleTimeString(AR ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) + '</span></div><div class="bt"><button type="button" data-play="' + c.id + '">▶ ' + t('Play', 'شغّل') + '</button><button type="button" data-save="' + c.id + '">' + t('Save to device', 'احفظ في الجهاز') + '</button><button type="button" data-del="' + c.id + '" aria-label="' + t('Delete', 'احذف') + '">✕</button></div></div>';
      }).join('') : '<p class="xsmall muted" style="margin:0">' + t('Clips filmed with «Film» appear here.', 'تظهر هنا المقاطع المصوَّرة بزر «صوّر».') + '</p>';
    }).catch(function () { $('#ffClips').innerHTML = '<p class="xsmall muted" style="margin:0">' + t('This browser does not allow saving clips on the device.', 'لا يسمح هذا المتصفح بحفظ المقاطع على الجهاز.') + '</p>'; });
  }
  function getClip(id) { return tx('readonly', function (s) { return s.get(id); }); }
  $('#ffClips').addEventListener('click', function (e) {
    var p = e.target.closest('[data-play]'), sv = e.target.closest('[data-save]'), dl = e.target.closest('[data-del]');
    if (p) getClip(p.getAttribute('data-play')).then(function (c) { var u = URL.createObjectURL(c.blob); SH.modal(c.seq + '. ' + esc(c.stop), '<video src="' + u + '" controls playsinline style="width:100%;max-height:70vh;background:#000;border-radius:8px"></video>'); });
    if (sv) getClip(sv.getAttribute('data-save')).then(function (c) { SH.download(clipName(c), c.blob, c.mime); });
    if (dl) SH.confirm(t('Delete this clip from the device? It cannot be recovered unless you saved it to the phone.', 'أتحذف هذا المقطع من الجهاز؟ لا يمكن استرجاعه إلا إذا حفظته في الهاتف.')).then(function (ok) { if (ok) tx('readwrite', function (s) { return s.delete(dl.getAttribute('data-del')); }).then(clipsUI); });
  });

  /* ------------------------------------------------------------ figure 1: shot positions */
  function northArrow(x, y) { return '<g><path d="M' + x + ' ' + (y + 4) + 'L' + (x - 9) + ' ' + (y + 30) + 'L' + x + ' ' + (y + 24) + 'z" fill="' + INK + '"/><path d="M' + x + ' ' + (y + 4) + 'L' + (x + 9) + ' ' + (y + 30) + 'L' + x + ' ' + (y + 24) + 'z" fill="#fff" stroke="' + INK + '"/>' + G.tx(x, y, 'N', { fs: 13, fw: 800, anchor: 'middle' }) + '</g>'; }
  function figMap() {
    var svg = $('#ffMap'), W = 760, X0 = 30, Y0 = 50, X1 = 730, Y1 = 470, pts = P.shots.filter(function (o) { return S.log[o.id] && S.log[o.id].lat != null; }).map(function (o) { return { o: o, L: S.log[o.id] }; });
    pts.sort(function (a, b) { return a.L.t - b.L.t; });
    var s = '<rect width="' + W + '" height="620" fill="#fff"/>' + G.tx(W / 2, 30, 'Field filming: shot positions', { fs: 16, fw: 800, anchor: 'middle' }) + '<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="#F7F5EF" stroke="' + INK + '" stroke-width="1.2"/>';
    if (!pts.length) { svg.innerHTML = s + G.tx(W / 2, (Y0 + Y1) / 2, 'No shot with a position yet', { fs: 13, fill: MUT, anchor: 'middle' }) + northArrow(X1 - 30, Y0 + 14); return; }
    var la0 = pts.reduce(function (a, p) { return a + p.L.lat; }, 0) / pts.length, lo0 = pts.reduce(function (a, p) { return a + p.L.lon; }, 0) / pts.length, kx = Math.cos(la0 * Math.PI / 180) * 111320, ky = 110540;
    pts.forEach(function (p) { p.x = (p.L.lon - lo0) * kx; p.y = (p.L.lat - la0) * ky; });
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; }), ex = Math.max(50, Math.max.apply(0, xs) - Math.min.apply(0, xs), Math.max.apply(0, ys) - Math.min.apply(0, ys)) * 1.3, cx = (Math.max.apply(0, xs) + Math.min.apply(0, xs)) / 2, cy = (Math.max.apply(0, ys) + Math.min.apply(0, ys)) / 2;
    var pw = X1 - X0 - 80, ph = Y1 - Y0 - 80, k = Math.min(pw, ph) / ex, mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2;
    pts.forEach(function (p) { p.px = mx + (p.x - cx) * k; p.py = my - (p.y - cy) * k; });
    for (var it = 0; it < 40; it++) for (var i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++) { var a = pts[i], b = pts[j], dx = b.px - a.px, dy = b.py - a.py, d = Math.hypot(dx, dy); if (d < 22) { if (d < 0.01) { dx = Math.cos(j); dy = Math.sin(j); d = 1; } var m = (22 - d) / 2; a.px -= dx / d * m; a.py -= dy / d * m; b.px += dx / d * m; b.py += dy / d * m; } }
    pts.forEach(function (p) { if (p.L.hdg != null) { var r = p.L.hdg * Math.PI / 180, x2 = p.px + Math.sin(r) * 26, y2 = p.py - Math.cos(r) * 26; s += '<line x1="' + p.px.toFixed(1) + '" y1="' + p.py.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + p.o.b.c + '" stroke-width="2.2"/><circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="2.6" fill="' + p.o.b.c + '"/>'; } });
    pts.forEach(function (p, i) { s += '<circle cx="' + p.px.toFixed(1) + '" cy="' + p.py.toFixed(1) + '" r="10" fill="' + p.o.b.c + '" stroke="#fff" stroke-width="1.5"/>' + G.tx(p.px, p.py + 4, String(i + 1), { fs: 10, fw: 800, anchor: 'middle', fill: '#fff' }); });
    s += northArrow(X1 - 30, Y0 + 14) + '<rect x="' + (X0 + 10) + '" y="' + (Y1 - 34) + '" width="160" height="26" fill="#fff" fill-opacity=".85"/>' + G.scaleBar(X0 + 20, Y1 - 18, k, 120);
    var ly = Y1 + 26, used = [], lx = X0;
    s += G.tx(X0, ly, 'Legend', { fs: 12, fw: 800 }); ly += 18;
    pts.forEach(function (p) { if (used.indexOf(p.o.b) < 0) used.push(p.o.b); });
    used.forEach(function (b) { var lab = (b.id === 'open' ? 'Opening' : b.id === 'close' ? 'Closing' : 'Stop ' + b.no) + (b.id === 'open' || b.id === 'close' ? '' : ': ' + b.en); lab = lab.length > 34 ? lab.slice(0, 33) + '…' : lab; var w = 30 + lab.length * 6.6; if (lx + w > X1) { lx = X0; ly += 18; } s += '<circle cx="' + (lx + 6) + '" cy="' + (ly - 4) + '" r="6" fill="' + b.c + '"/>' + G.tx(lx + 16, ly, esc(lab), { fs: 11 }); lx += w + 10; });
    ly += 20; s += '<line x1="' + X0 + '" y1="' + (ly - 4) + '" x2="' + (X0 + 22) + '" y2="' + (ly - 4) + '" stroke="' + INK + '" stroke-width="2"/>' + G.tx(X0 + 30, ly, 'Number: filming order · arrow: direction the phone faced (magnetic, about ±15°)', { fs: 11 });
    ly += 18; s += G.tx(X0, ly, 'Centre ' + la0.toFixed(5) + '° N, ' + lo0.toFixed(5) + '° E (WGS 84) · ' + pts.length + ' shots · ' + new Date(pts[0].L.t).toISOString().slice(0, 10), { fs: 11, fill: MUT });
    svg.innerHTML = s;
  }

  /* ------------------------------------------------------------ figure 2: planned and filmed time */
  function figTime() {
    var svg = $('#ffTime'), W = 760, LX = 180, RX = 730, rows = P.blocks, top = 56, rh = 40, T = +S.len || 60;
    var filmed = 0; rows.forEach(function (b) { b.fd = b.shots.reduce(function (a, o) { return a + (S.log[o.id] ? S.log[o.id].dur || 0 : 0); }, 0); filmed += b.fd; });
    var mx = Math.max(T, P.total, filmed) * 1.05, k = (RX - LX) / mx, H = top + rows.length * rh + 120, s = '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' + G.tx(W / 2, 30, 'Field filming: planned and filmed seconds', { fs: 16, fw: 800, anchor: 'middle' });
    var st = G.step(0, mx, 6); G.ticks(0, mx, st).forEach(function (v) { var x = LX + v * k; s += '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + rows.length * rh) + '" stroke="#E3E6E8"/>' + G.tx(x, top + rows.length * rh + 16, F(v, 0), { fs: 10.5, anchor: 'middle', fill: MUT }); });
    s += G.tx((LX + RX) / 2, top + rows.length * rh + 34, 'Time in the finished film (s)', { fs: 11.5, fw: 700, anchor: 'middle' });
    var cp = 0, cf = 0;
    rows.forEach(function (b, i) {
      var y = top + i * rh, lab = b.id === 'open' ? 'Opening' : b.id === 'close' ? 'Closing' : 'Stop ' + b.no + ': ' + b.en; lab = lab.length > 24 ? lab.slice(0, 23) + '…' : lab;
      s += '<circle cx="18" cy="' + (y + 20) + '" r="5" fill="' + b.c + '"/>' + G.tx(28, y + 24, esc(lab), { fs: 11 });
      b.shots.forEach(function (o) { var w = o.s * k; s += '<rect x="' + (LX + cp * k).toFixed(1) + '" y="' + (y + 6) + '" width="' + Math.max(0.5, w - 1).toFixed(1) + '" height="13" fill="' + KIND[o.k][2] + '"/>'; cp += o.s; });
      b.shots.forEach(function (o) { var L = S.log[o.id]; if (!L || !L.dur) return; var w = L.dur * k; s += '<rect x="' + (LX + cf * k).toFixed(1) + '" y="' + (y + 22) + '" width="' + Math.max(0.5, w - 1).toFixed(1) + '" height="13" fill="' + KIND[o.k][2] + '" fill-opacity=".55" stroke="' + KIND[o.k][2] + '"/>'; cf += L.dur; });
    });
    var tx0 = LX + T * k; s += '<line x1="' + tx0 + '" y1="' + (top - 8) + '" x2="' + tx0 + '" y2="' + (top + rows.length * rh) + '" stroke="' + INK + '" stroke-width="1.6" stroke-dasharray="5 4"/>' + G.tx(tx0, top - 12, 'Target ' + T + ' s', { fs: 11, fw: 700, anchor: 'middle' });
    s += '<rect x="' + LX + '" y="' + top + '" width="' + (RX - LX) + '" height="' + rows.length * rh + '" fill="none" stroke="' + INK + '"/>';
    var ly = top + rows.length * rh + 60, lx = 20; s += G.tx(20, ly, 'Legend', { fs: 12, fw: 800 }); ly += 18;
    Object.keys(KIND).forEach(function (q) { var lab = KIND[q][0], w = 26 + lab.length * 6.6; if (lx + w > W - 20) { lx = 20; ly += 18; } s += '<rect x="' + lx + '" y="' + (ly - 10) + '" width="14" height="10" fill="' + KIND[q][2] + '"/>' + G.tx(lx + 19, ly, lab, { fs: 11 }); lx += w + 12; });
    ly += 18; s += G.tx(20, ly, 'Upper bar of each stop: planned · lower bar: filmed, without the spare seconds · dashed line: target length', { fs: 11, fill: MUT });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (ly + 16)); svg.innerHTML = s.replace('height="' + H + '"', 'height="' + (ly + 16) + '"');
  }

  /* ------------------------------------------------------------ save, open, new */
  $('#ffCsv').addEventListener('click', function () {
    var rows = [['order', 'stop', 'shot', 'kind', 'planned_s', 'filmed_s', 'time', 'lat', 'lon', 'accuracy_m', 'heading_deg', 'clip']];
    P.shots.forEach(function (o) { var L = S.log[o.id] || {}; rows.push([o.seq, o.b.name, o.w, KIND[o.k][0], o.s, L.dur != null ? F(L.dur, 1) : '', L.t ? new Date(L.t).toISOString() : '', L.lat != null ? L.lat.toFixed(6) : '', L.lon != null ? L.lon.toFixed(6) : '', L.acc != null ? F(L.acc, 0) : '', L.hdg != null ? F(L.hdg, 0) : '', L.clip || '']); });
    SH.csv('shandal-field-filming-shots.csv', rows);
  });
  $('#ffJson').addEventListener('click', function () { SH.download('shandal-field-filming.json', JSON.stringify(S, null, 1), 'application/json'); });
  $('#ffOpen').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; f.text().then(function (x) { var o = JSON.parse(x); if (!o || !Array.isArray(o.stops)) throw new Error(); S = o; if (!S.log) S.log = {}; save(); ['ffTitle', 'ffLen', 'ffOr', 'ffPad'].forEach(function (id, i) { $('#' + id).value = S[['title', 'len', 'or', 'pad'][i]]; }); render(); }).catch(function () { SH.toast(t('This is not a field filming project file.', 'هذا ليس ملف مشروع تصوير حقلي.'), 'bad'); }); e.target.value = ''; });
  $('#ffNew').addEventListener('click', function () { SH.confirm(t('Start a new film? The stops and the shot log are cleared; the clips stay on the device until you delete them.', 'أتبدأ فيلماً جديداً؟ تُمسح المحطات وسجل اللقطات؛ وتبقى المقاطع على الجهاز حتى تحذفها.')).then(function (ok) { if (!ok) return; S = { title: '', len: S.len, or: S.or, pad: S.pad, stops: [], log: {}, n: 0 }; $('#ffTitle').value = ''; save(); render(); }); });

  if (!S.stops.length) { S.n = 2; S.stops = [{ id: 's1', name: '', type: 'outcrop' }, { id: 's2', name: '', type: 'view' }]; save(); }
  render();
})();
