/* Geological and archaeological tourism of Iraq — natural, geological, archaeological, religious and museum
   places on one map. Side panel: kind of place, governorate, geological zone, search, World Heritage, distance
   from the user and the place card (story, geological reading, rock at the surface, elevation, live conditions,
   nearby places, directions through the navigation app the user chooses). Deck under the map: the selected place
   (satellite / geology / terrain view, photographs, weather chart, ground profile, location sheet), overview with
   charts, place cards, trip planner, data table and a print-ready map sheet with its key. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, L = window.L, AR = SH.lang === 'ar', E = SH.esc;
  var INK = '#1B232B', MUT = '#55616B', PF = 'Manrope, Arial, sans-serif', GOLD = '#C9A227';
  var MS = 'https://macrostrat.org/api/v2/', MET = 'https://api.met.no/weatherapi/', OM = 'https://api.open-meteo.com/v1/elevation', WP = 'https://en.wikipedia.org/w/api.php', CM = 'https://commons.wikimedia.org/w/api.php', PB = 'https://paleobiodb.org/data1.2/';
  var spin = '<span aria-hidden="true" style="display:inline-block;width:11px;height:11px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ghSpin .8s linear infinite;vertical-align:-1px;margin-inline-end:5px"></span>';
  var ARR = AR ? '→' : '←';
  var ICO = {"navigation": "<polygon points=\"3 11 22 2 13 21 11 13 3 11\" />", "plus": "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />", "check": "<path d=\"M20 6 9 17l-5-5\" />", "satellite": "<path d=\"m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5\" /> <path d=\"M16.5 7.5 19 5\" /> <path d=\"m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5\" /> <path d=\"M9 21a6 6 0 0 0-6-6\" /> <path d=\"M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z\" />", "share-2": "<circle cx=\"18\" cy=\"5\" r=\"3\" /> <circle cx=\"6\" cy=\"12\" r=\"3\" /> <circle cx=\"18\" cy=\"19\" r=\"3\" /> <line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\" /> <line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\" />", "route": "<circle cx=\"6\" cy=\"19\" r=\"3\" /> <path d=\"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\" /> <circle cx=\"18\" cy=\"5\" r=\"3\" />"};
  var ico = function (n) { return '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICO[n] || '') + '</svg>'; };
  var store = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  /* ------------------------------------------------------------------ vocabularies */
  var GL = { water: 'M2 15c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 9c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2', land: 'm3 20 6-10 4 6 2-3 6 7z', cave: 'M3 20c0-7 4-12 9-12s9 5 9 12M9 20c0-3 1.4-5 3-5s3 2 3 5', arch: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6', rel: 'M12 3v4M10 5h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4', mus: 'M3 21h18M4 9h16M12 3 3 9M12 3l9 6M6 9v10M10 9v10M14 9v10M18 9v10', park: 'M12 3a5 5 0 0 1 5 5 4 4 0 0 1-2 7H9a4 4 0 0 1-2-7 5 5 0 0 1 5-5zM12 15v6' };
  var CAT = {
    nature: ['#2F7D5B', t('Nature and geology', 'الطبيعة والجيولوجيا'), t('waterfalls, caves, lakes, rivers', 'شلالات، كهوف، بحيرات، أنهار'), 'land'],
    archaeo: ['#B0702A', t('Archaeology and heritage', 'الآثار والتراث'), t('ancient cities, citadels, minarets', 'مدن قديمة، قلاع، منائر'), 'arch'],
    religious: ['#2E6FA8', t('Religious sites', 'المواقع الدينية'), t('shrines, mosques, churches', 'مراقد، جوامع، كنائس'), 'rel'],
    museum: ['#8A4FA3', t('Museums and monuments', 'المتاحف والنُّصب'), t('museums, monuments, parks', 'متاحف، نُصب، متنزهات'), 'mus']
  };
  var TY = {
    waterfall: [t('Waterfall', 'شلال'), 'water'], gorge: [t('Gorge', 'مضيق'), 'land'], cave: [t('Cave', 'كهف'), 'cave'], mountain: [t('Mountain', 'جبل'), 'land'], resort: [t('Mountain resort', 'مصيف جبلي'), 'land'],
    lake: [t('Lake', 'بحيرة'), 'water'], depression: [t('Depression', 'منخفض'), 'land'], marsh: [t('Marsh', 'هور'), 'water'], river: [t('River and river landform', 'نهر وشكل نهري'), 'water'], island: [t('River island', 'جزيرة نهرية'), 'water'],
    spring: [t('Spring and seep', 'عين ونضح'), 'water'], sinkhole: [t('Sinkhole', 'خسفة'), 'cave'], valley: [t('Desert valley', 'وادٍ صحراوي'), 'land'], outcrop: [t('Rock outcrop', 'مكشف صخري'), 'land'],
    archaeo: [t('Archaeological site', 'موقع أثري'), 'arch'], ziggurat: [t('Ziggurat', 'زقورة'), 'arch'], relief: [t('Rock relief', 'منحوتة صخرية'), 'arch'], palace: [t('Palace', 'قصر'), 'arch'], citadel: [t('Citadel and fortress', 'قلعة وحصن'), 'arch'],
    minaret: [t('Minaret and mosque', 'منارة وجامع'), 'arch'], bridge: [t('Old bridge', 'جسر قديم'), 'arch'], khan: [t('Caravanserai', 'خان'), 'arch'], heritage: [t('Historic quarter and building', 'حي ومبنى تراثي'), 'arch'], market: [t('Historic market', 'سوق تراثي'), 'arch'],
    religious: [t('Shrine and mosque', 'مرقد وجامع'), 'rel'], church: [t('Church and monastery', 'كنيسة ودير'), 'rel'], museum: [t('Museum', 'متحف'), 'mus'], monument: [t('Monument', 'نصب'), 'mus'], park: [t('Park and corniche', 'متنزه وكورنيش'), 'park']
  };
  var GOV = { Duhok: 'دهوك', Erbil: 'أربيل', Sulaymaniyah: 'السليمانية', Halabja: 'حلبجة', Nineveh: 'نينوى', Kirkuk: 'كركوك', Saladin: 'صلاح الدين', Diyala: 'ديالى', Anbar: 'الأنبار', Baghdad: 'بغداد', Babil: 'بابل', Karbala: 'كربلاء', Najaf: 'النجف', Wasit: 'واسط', 'Al-Qadisiyyah': 'القادسية', Maysan: 'ميسان', 'Dhi Qar': 'ذي قار', Muthanna: 'المثنى', Basra: 'البصرة' };
  var GORD = Object.keys(GOV);
  var ZONE = {
    thrust: ['#7A3E6E', t('Zagros Thrust Zone', 'نطاق الزحوف لزاكروس'), t('The highest mountains of Iraq along the Iranian border, built of metamorphic, volcanic and sedimentary rock sheets pushed over the edge of the Arabian Plate.', 'أعلى جبال العراق على الحدود الإيرانية، مكونة من صفائح صخرية متحولة وبركانية ورسوبية دُفعت فوق حافة الصفيحة العربية.'), 'Thrust sheets of the Zagros suture'],
    hfz: ['#3F7F4F', t('High Folded Zone', 'نطاق الطيات العالية'), t('Long limestone anticlines 1,000–2,500 m high separated by valleys; the land of gorges, karst caves, springs and waterfalls.', 'طيات محدبة طويلة من الحجر الجيري بارتفاع 1000–2500 م تفصلها وديان؛ أرض المضائق والكهوف الكارستية والينابيع والشلالات.'), 'Cretaceous–Paleogene limestone anticlines'],
    foothill: ['#A9873E', t('Foothill (Low Folded) Zone', 'نطاق الطيات الواطئة'), t('Low ridges of Miocene gypsum, marl and red sandstone with broad plains between them; oil fields, mineral springs and the Assyrian heartland.', 'حافات واطئة من جبس ومارل وحجر رملي أحمر من المايوسين تفصلها سهول واسعة؛ حقول النفط والينابيع المعدنية وقلب بلاد آشور.'), 'Miocene–Pliocene Fatha, Injana and Mukdadiya formations'],
    jazira: ['#C48A5A', t('Jazira plain', 'سهل الجزيرة'), t('The open plain of north-west Iraq between the Tigris and the Euphrates, broken by the isolated Sinjar anticline.', 'السهل المفتوح شمال غرب العراق بين دجلة والفرات، يقطعه جبل سنجار المنعزل.'), 'Miocene gypsum and limestone of the Jazira'],
    mesop: ['#3E7FA6', t('Mesopotamian Plain', 'السهل الرسوبي لبلاد الرافدين'), t('A subsiding basin filled with Quaternary river silt, sand and clay of the Tigris and Euphrates, the land of Sumer and Babylon and of the marshes.', 'حوض هابط امتلأ بغرين ورمل وطين دجلة والفرات في العصر الرباعي، أرض سومر وبابل والأهوار.'), 'Quaternary fluvial and marsh deposits'],
    western: ['#B3563F', t('Western Desert', 'الصحراء الغربية'), t('A stable plateau of nearly flat limestone, dolomite and sandstone rising towards the Rutba uplift, cut by long wadis and the Euphrates valley.', 'هضبة مستقرة من الحجر الجيري والدولومايت والحجر الرملي شبه الأفقية، ترتفع نحو نهوض الرطبة وتقطعها وديان طويلة ووادي الفرات.'), 'Paleozoic–Neogene platform rocks of the Stable Shelf'],
    desert: ['#C7A04A', t('Southern Desert and Abu Jir margin', 'الصحراء الجنوبية وحافة أبو جير'), t('The edge of the desert plateau west of the Euphrates, with escarpments, closed depressions, lakes and springs along the Abu Jir fault zone.', 'حافة هضبة الصحراء غرب الفرات، فيها جروف ومنخفضات مغلقة وبحيرات وينابيع على امتداد نطاق فالق أبو جير.'), 'Eocene–Miocene limestone and Dibdibba gravels']
  };
  var ZORD = ['thrust', 'hfz', 'foothill', 'jazira', 'mesop', 'desert', 'western'];
  var DIRS = AR ? ['شمالاً', 'شمال شرق', 'شرقاً', 'جنوب شرق', 'جنوباً', 'جنوب غرب', 'غرباً', 'شمال غرب'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  var P = [], BY = {}, MK = {}, me = null, meMk = null, sel = null, LIST = [], shown = 60, trip = store.get('sh_gh_trip', []), cats = { nature: 1, archaeo: 1, religious: 1, museum: 1 };
  var nm = function (p, en) { return (AR && !en ? p.ar : p.en).name; };
  var gname = function (g, en) { return AR && !en ? GOV[g] || g : g; };
  var enT = {}; Object.keys(TY).forEach(function (k) { enT[k] = TY[k][0]; });
  if (AR) { var TYEN = { waterfall: 'Waterfall', gorge: 'Gorge', cave: 'Cave', mountain: 'Mountain', resort: 'Mountain resort', lake: 'Lake', depression: 'Depression', marsh: 'Marsh', river: 'River and river landform', island: 'River island', spring: 'Spring and seep', sinkhole: 'Sinkhole', valley: 'Desert valley', outcrop: 'Rock outcrop', archaeo: 'Archaeological site', ziggurat: 'Ziggurat', relief: 'Rock relief', palace: 'Palace', citadel: 'Citadel and fortress', minaret: 'Minaret and mosque', bridge: 'Old bridge', khan: 'Caravanserai', heritage: 'Historic quarter and building', market: 'Historic market', religious: 'Shrine and mosque', church: 'Church and monastery', museum: 'Museum', monument: 'Monument', park: 'Park and corniche' }; enT = TYEN; }
  var CATEN = { nature: 'Nature and geology', archaeo: 'Archaeology and heritage', religious: 'Religious sites', museum: 'Museums and monuments' };
  var ZEN = { thrust: 'Zagros Thrust Zone', hfz: 'High Folded Zone', foothill: 'Foothill (Low Folded) Zone', jazira: 'Jazira plain', mesop: 'Mesopotamian Plain', western: 'Western Desert', desert: 'Southern Desert and Abu Jir margin' };
  var km = function (m) { return m < 1e4 ? SH.fmt(m / 1000, 1) : SH.fmt(m / 1000, 0); }, KM = t(' km', ' كم');
  var bearing = function (a, b) { var f1 = SH.rad(a.lat), f2 = SH.rad(b.lat), dl = SH.rad(b.lon - a.lon), y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; };
  var dir8 = function (b) { return DIRS[Math.round(b / 45) % 8]; };
  var photoURL = function (p, w) { if (p.loc) return SH.base + 'assets/img/geoheritage/' + p.loc + '-1' + (w <= 330 ? '-t' : '') + '.webp'; if (!p.photo) return ''; var f = p.photo.split('/').pop(), ext = f.toLowerCase().split('.').pop(); return 'https://upload.wikimedia.org/wikipedia/' + p.photo.replace(/^(\w+)\//, '$1/thumb/') + '/' + w + 'px-' + f + (ext === 'svg' ? '.png' : ''); };
  var origURL = function (p) { return p.photo ? 'https://upload.wikimedia.org/wikipedia/' + p.photo : ''; };
  function shade(hex, f) { var n = parseInt(String(hex).slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255, m = function (c) { return Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f); }; return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')'; }
  var grad = function (hex) { return '--c1:' + shade(hex, -.1) + ';--c2:' + shade(hex, -.6); };
  var svgI = function (g, col, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 16) + '" height="' + (w || 16) + '" fill="none" stroke="' + (col || '#fff') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + GL[g] + '"/></svg>'; };
  var glyph = function (p) { return TY[p.type] ? TY[p.type][1] : CAT[p.cat][3]; };
  function busyBtn(b, on) { if (on) { b._h = b.innerHTML; b.disabled = true; b.innerHTML = spin + t('Preparing…', 'جارٍ التجهيز…'); } else { b.disabled = false; if (b._h) b.innerHTML = b._h; } }
  function dlBtns(attr, val) { return ['png', 'jpg', 'pdf'].map(function (f) { return '<button class="btn btn-line btn-xs" type="button" ' + attr + '="' + val + '" data-f="' + f + '">' + f.toUpperCase() + '</button>'; }).join(''); }
  $$('[data-dlplot]').forEach(function (d) { d.innerHTML = dlBtns('data-pl', d.getAttribute('data-dlplot')); });
  var stamp = function () { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };

  /* ------------------------------------------------------------------ map */
  var map = SH.map('hMap', { zoom: 6, center: [33.2, 43.9], base: 'light', bases: ['light', 'dark', 'satellite', 'topo'] });
  if (map) map.attributionControl.setPrefix('Leaflet');
  var geoL = L ? L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: .62, maxZoom: 16, attribution: 'Geology © Macrostrat' }) : null;
  $('#hGeoL').addEventListener('click', function () { if (!map) return; var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on); if (on) geoL.addTo(map); else map.removeLayer(geoL); });
  var pinIcon = function (p, on) { var c = CAT[p.cat][0]; return L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 29], html: '<div class="gh-pin' + (on ? ' on' : '') + '" style="background:' + c + '">' + svgI(glyph(p)) + '</div>' }); };
  $('#hLeg').innerHTML = '<b>' + t('Kind of place', 'نوع المكان') + '</b>' + Object.keys(CAT).map(function (k) { return '<span><i style="background:' + CAT[k][0] + '"></i>' + CAT[k][1] + '</span>'; }).join('');

  /* ------------------------------------------------------------------ controls */
  $('#hCats').innerHTML = Object.keys(CAT).map(function (k) { return '<button type="button" class="gh-cat" data-cat="' + k + '" aria-pressed="true"><i style="background:' + CAT[k][0] + '">' + svgI(CAT[k][3], '#fff', 16) + '</i><span><b>' + CAT[k][1] + '</b><small data-cn="' + k + '"></small></span></button>'; }).join('');
  $('#hGov').innerHTML = '<option value="">' + t('All governorates', 'كل المحافظات') + '</option>' + GORD.map(function (g) { return '<option value="' + g + '">' + gname(g) + '</option>'; }).join('');
  $('#hZone').innerHTML = '<option value="">' + t('All zones', 'كل النطاقات') + '</option>' + ZORD.map(function (z) { return '<option value="' + z + '">' + ZONE[z][1] + '</option>'; }).join('');
  function typeOpts() { var v = SH.val('hType'), have = {}; P.forEach(function (p) { if (cats[p.cat]) have[p.type] = (have[p.type] || 0) + 1; });
    $('#hType').innerHTML = '<option value="">' + t('All types', 'كل الأنواع') + '</option>' + Object.keys(TY).filter(function (k) { return have[k]; }).map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + TY[k][0] + ' (' + have[k] + ')</option>'; }).join(''); }
  $('#hCats').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; var k = b.getAttribute('data-cat'), on = Object.keys(cats).filter(function (c) { return cats[c]; });
    if (on.length === 4) { Object.keys(cats).forEach(function (c) { cats[c] = c === k ? 1 : 0; }); } else if (cats[k] && on.length === 1) { Object.keys(cats).forEach(function (c) { cats[c] = 1; }); } else cats[k] = cats[k] ? 0 : 1;
    $$('#hCats [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', !!cats[x.getAttribute('data-cat')]); }); typeOpts(); refresh(true); });
  ['hType', 'hGov', 'hZone', 'hRad'].forEach(function (id) { $('#' + id).addEventListener('change', function () { refresh(true); }); });
  $('#hUn').addEventListener('change', function () { refresh(true); });
  var qT; $('#hQ').addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(function () { refresh(false); }, 180); });
  $('#hReset').addEventListener('click', function () { Object.keys(cats).forEach(function (c) { cats[c] = 1; }); $$('#hCats [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', 'true'); }); ['hType', 'hGov', 'hZone', 'hQ'].forEach(function (id) { $('#' + id).value = ''; }); $('#hRad').value = '0'; $('#hUn').checked = false; typeOpts(); refresh(true); });

  var norm = function (s) { return String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); };
  function filtered() {
    var ty = SH.val('hType'), gv = SH.val('hGov'), zn = SH.val('hZone'), q = norm(SH.val('hQ')), un = $('#hUn').checked, rad = +SH.val('hRad') || 0;
    var a = P.filter(function (p) { if (!cats[p.cat]) return false; if (ty && p.type !== ty) return false; if (gv && p.gov !== gv) return false; if (zn && p.zone !== zn) return false; if (un && !p.unesco) return false;
      if (q && p._q.indexOf(q) < 0) return false; if (me && rad && p._d > rad * 1000) return false; return true; });
    if (me) a.sort(function (x, y) { return x._d - y._d; }); else a.sort(function (x, y) { return y.lat - x.lat; });
    return a;
  }
  function refresh(fit) {
    LIST = filtered(); shown = 60; var vis = {}; LIST.forEach(function (p) { vis[p.id] = 1; });
    if (map) Object.keys(MK).forEach(function (k) { if (vis[k] || k === (sel && sel.id)) { if (!map.hasLayer(MK[k])) MK[k].addTo(map); } else if (map.hasLayer(MK[k])) map.removeLayer(MK[k]); });
    var cn = {}; P.forEach(function (p) { cn[p.cat] = (cn[p.cat] || 0) + 1; }); Object.keys(CAT).forEach(function (k) { var el = $('[data-cn="' + k + '"]'); if (el) el.textContent = (cn[k] || 0) + ' ' + t('places', 'مكاناً') + ' · ' + CAT[k][2]; });
    $('#hCount').textContent = LIST.length + ' ' + t(LIST.length === 1 ? 'place' : 'places', 'مكاناً') + (me ? t(', nearest first', '، الأقرب أولاً') : t(', north to south', '، من الشمال إلى الجنوب'));
    $('#hMapStat').innerHTML = '<b>' + LIST.length + '</b> ' + t('places on the map', 'مكاناً على الخريطة');
    $('#nPl').textContent = LIST.length;
    list(); overview(); cards(); table();
    if ($('[data-pane="ms"]') && !$('[data-pane="ms"]').hidden) sheet();
    if (fit && map && LIST.length) map.fitBounds(L.latLngBounds(LIST.map(function (p) { return [p.lat, p.lon]; })).pad(.12), { maxZoom: 11 });
  }
  function liHTML(p) { var c = CAT[p.cat][0], ph = photoURL(p, 120);
    return '<button type="button" class="gh-li' + (sel && sel.id === p.id ? ' on' : '') + '" data-id="' + p.id + '"><span class="ph" style="' + (ph ? 'background-image:url(\'' + ph + '\')' : 'background:' + c) + '">' + (ph ? '' : svgI(glyph(p), '#fff', 22)) + '</span><span><b>' + E(nm(p)) + '</b><small>' + TY[p.type][0] + ' · ' + gname(p.gov) + (p.unesco ? ' · ' + t('World Heritage', 'تراث عالمي') : '') + '</small></span>' +
      (me ? '<span class="d">' + km(p._d) + KM + '<br><small style="text-align:end">' + dir8(p._b) + '</small></span>' : '<span></span>') + '</button>'; }
  function list() {
    if (!LIST.length) { $('#hList').innerHTML = '<div style="padding:16px" class="gh-cap">' + t('No place matches all the filters. Clear one of them, or use “Clear filters”.', 'لا يوجد مكان يطابق كل الفلاتر. امسح أحدها أو استخدم «مسح الفلاتر».') + '</div>'; return; }
    $('#hList').innerHTML = LIST.slice(0, shown).map(liHTML).join('') + (LIST.length > shown ? '<button type="button" class="gh-more" id="hMore">' + t('Show more', 'عرض المزيد') + ' (' + (LIST.length - shown) + ')</button>' : '');
  }
  $('#hList').addEventListener('click', function (e) { if (e.target.closest('#hMore')) { shown += 60; list(); return; } var b = e.target.closest('[data-id]'); if (b) open(b.getAttribute('data-id'), true); });

  /* ------------------------------------------------------------------ location */
  function setMe(p) { if (!p || !isFinite(p.lat) || !isFinite(p.lon)) { SH.toast(t('Your position could not be read. Try again outdoors.', 'تعذرت قراءة موقعك. حاول مجدداً في مكان مفتوح.'), 'warn'); return; } me = { lat: +p.lat, lon: +p.lon }; P.forEach(function (x) { x._d = SH.dist(me, x); x._b = bearing(me, x); });
    if (map) { if (meMk) meMk.setLatLng([me.lat, me.lon]); else meMk = L.circleMarker([me.lat, me.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#1F6FB2', fillOpacity: 1 }).bindTooltip(t('You are here', 'أنت هنا')).addTo(map); }
    var n = P.slice().sort(function (a, b) { return a._d - b._d; })[0];
    $('#hMeTxt').innerHTML = t('Located. The nearest place is ', 'تم تحديد موقعك. أقرب مكان هو ') + '<b>' + E(nm(n)) + '</b> ' + t('at ', 'على بعد ') + '<span class="ltr">' + km(n._d) + KM + '</span> ' + dir8(n._b) + '.';
    $('#hSort').value = 'dist'; }
  function locate(btn, then) { if (btn) busyBtn(btn, true); SH.locate().then(function (p) { setMe(p); if (then) then(); else refresh(true); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { if (btn) busyBtn(btn, false); }); }
  $('#hMe').addEventListener('click', function () { locate(this); });
  $('#hNear').addEventListener('click', function () { var b = this; locate(b, function () { if (SH.val('hRad') === '0') $('#hRad').value = '100'; refresh(false); var a = LIST.length ? LIST : P.slice().sort(function (x, y) { return x._d - y._d; }); if (map) map.fitBounds(L.latLngBounds(a.slice(0, 8).map(function (p) { return [p.lat, p.lon]; }).concat([[me.lat, me.lon]])).pad(.2), { maxZoom: 11 });
    if (!LIST.length) SH.toast(t('No place within 100 km; the list shows the nearest places at any distance.', 'لا يوجد مكان ضمن 100 كم؛ تعرض القائمة أقرب الأماكن على أي مسافة.'), 'warn'), $('#hRad').value = '0', refresh(false); }); });
  if (map) map.on('sh:located', function (e) { setMe(e); refresh(false); });
  $('#hRand').addEventListener('click', function () { var a = LIST.length ? LIST : P, p = a[Math.floor(Math.random() * a.length)]; open(p.id, true); });

  /* the "Try" buttons fill each step with a worked example */
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-try]'); if (!b) return; var k = b.getAttribute('data-try');
    if (k === 'cat') { Object.keys(cats).forEach(function (c) { cats[c] = c === 'nature' ? 1 : 0; }); $$('#hCats [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', !!cats[x.getAttribute('data-cat')]); }); typeOpts(); $('#hType').value = 'waterfall'; refresh(true); }
    else if (k === 'where') { $('#hGov').value = 'Dhi Qar'; $('#hZone').value = ''; refresh(true); }
    else if (k === 'q') { $('#hQ').value = AR ? 'زقورة' : 'ziggurat'; refresh(true); }
    else if (k === 'near') { setMe({ lat: 33.3128, lon: 44.3615 }); $('#hRad').value = '50'; refresh(true); $('#hMeTxt').innerHTML = t('Example: distances from central Baghdad. Press “Locate me” to use your own position.', 'مثال: المسافات من وسط بغداد. اضغط «حدّد موقعي» لاستخدام موقعك أنت.'); }
  });

  /* ------------------------------------------------------------------ place view (side) */
  function show(v) { $$('[data-v]').forEach(function (el) { el.hidden = el.getAttribute('data-v') !== v; }); var side = $('.wsm-side'); if (side) side.scrollTop = 0; var w = $('.wsm'), on = v === 'place'; if (w && w.classList.contains('gh-wide') !== on) { w.classList.toggle('gh-wide', on); setTimeout(function () { if (map) map.invalidateSize(); }, 60); } }
  function highlight(p) { if (!map) return; Object.keys(MK).forEach(function (k) { var q = BY[k]; MK[k].setIcon(pinIcon(q, p && k === p.id)); MK[k].setZIndexOffset(p && k === p.id ? 1000 : 0); }); if (p && !map.hasLayer(MK[p.id])) MK[p.id].addTo(map); }
  var tok = 0;
  function open(id, fly) {
    var p = BY[id]; if (!p) return; sel = p; var my = ++tok, d = AR ? p.ar : p.en, c = CAT[p.cat][0], z = ZONE[p.zone], ph = photoURL(p, 960), inTrip = trip.indexOf(p.id) > -1;
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    highlight(p); if (map && fly !== false) map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), p.cat === 'nature' && /river|marsh|mountain|valley/.test(p.type) ? 9 : 13), { duration: .8 });
    var near = P.filter(function (q) { return q !== p; }).map(function (q) { return { q: q, d: SH.dist(p, q), b: bearing(p, q) }; }).filter(function (x) { return x.d < 60000; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 8);
    var h = '<button type="button" class="gh-back" id="hBack">' + ARR + ' ' + t('All places', 'كل الأماكن') + '</button>' +
      '<div class="gh-hero" id="hHero" style="' + grad(c) + (ph ? ';background-image:linear-gradient(transparent,transparent),url(\'' + ph + '\')' : '') + '"><div class="in"><div class="gh-pills"><span style="background:' + c + '">' + TY[p.type][0] + '</span><span>' + gname(p.gov) + '</span>' + (p.unesco ? '<span class="u">' + t('UNESCO World Heritage', 'تراث عالمي – يونسكو') + '</span>' : '') + '</div><h2>' + E(d.name) + '</h2></div></div>' +
      '<p class="gh-txt">' + E(d.desc) + '</p>' +
      (d.geo ? '<div class="gh-lb">' + svgI('land', 'currentColor', 14) + t('The geology of the place', 'جيولوجيا المكان') + '</div><p class="gh-geo">' + E(d.geo) + '</p>' : '') +
      '<div class="gh-lb">' + svgI('arch', 'currentColor', 14) + t('Key facts', 'معلومات أساسية') + '</div><div class="gh-facts">' +
      '<div class="gh-fact w"><span>' + t('Geological zone', 'النطاق الجيولوجي') + '</span><b><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + z[0] + ';margin-inline-end:6px"></i>' + z[1] + '</b><small class="gh-cap" style="display:block">' + z[2] + '</small></div>' +
      '<div class="gh-fact w"><span>' + t('Rock at the surface (geological map)', 'الصخر على السطح (الخريطة الجيولوجية)') + '</span><b id="hRock">' + spin + '</b></div>' +
      '<div class="gh-fact"><span>' + t('Elevation', 'الارتفاع') + '</span><b class="ltr" id="hElev">' + spin + '</b></div>' +
      '<div class="gh-fact"><span>' + t('Coordinates', 'الإحداثيات') + '</span><b class="ltr">' + p.lat.toFixed(4) + '°N, ' + p.lon.toFixed(4) + '°E</b></div>' +
      (me ? '<div class="gh-fact"><span>' + t('Distance from you', 'البعد عنك') + '</span><b class="ltr">' + km(SH.dist(me, p)) + KM + ' · ' + dir8(bearing(me, p)) + '</b></div><div class="gh-fact"><span>' + t('Driving time (approx.)', 'زمن القيادة (تقريبي)') + '</span><b>' + drive(SH.dist(me, p) * 1.3) + '</b></div>' : '') +
      '<div class="gh-fact w"><span>' + t('Fossil sites within 25 km', 'المواقع الأحفورية ضمن 25 كم') + '</span><b id="hFos">' + spin + '</b></div>' +
      (p.unesco ? '<div class="gh-fact w"><span>' + t('World Heritage inscription', 'التسجيل في التراث العالمي') + '</span><b>' + E(p.unesco) + '</b></div>' : '') + '</div>' +
      '<div class="gh-lb">' + svgI('park', 'currentColor', 14) + t('Now at the place', 'الآن في المكان') + '</div><div class="gh-now" id="hNow"><div><span>' + t('Temperature', 'الحرارة') + '</span><b>' + spin + '</b></div><div><span>' + t('Sunrise', 'الشروق') + '</span><b>…</b></div><div><span>' + t('Sunset', 'الغروب') + '</span><b>…</b></div></div>' +
      '<div class="gh-btns"><button type="button" class="btn btn-gold btn-sm" data-nav="' + p.id + '">' + ico('navigation') + t('Directions', 'الاتجاهات') + '</button><button type="button" class="btn btn-ink btn-sm" data-addtrip="' + p.id + '">' + ico(inTrip ? 'check' : 'plus') + (inTrip ? t('In your trip', 'ضمن رحلتك') : t('Add to trip', 'أضف إلى الرحلة')) + '</button><button type="button" class="btn btn-line btn-sm" id="hSat">' + ico('satellite') + t('Satellite view', 'المنظر الفضائي') + '</button><button type="button" class="btn btn-line btn-sm" id="hShare">' + ico('share-2') + t('Share', 'مشاركة') + '</button></div>' +
      (near.length ? '<div class="gh-lb">' + svgI('land', 'currentColor', 14) + t('Nearby places', 'أماكن قريبة') + '</div><div class="gh-near">' + near.map(function (x) { return '<button type="button" class="gh-nb" data-id="' + x.q.id + '"><i style="background:' + CAT[x.q.cat][0] + '"></i><span>' + E(nm(x.q)) + ' <small class="gh-cap">· ' + TY[x.q.type][0] + '</small></span><em>' + km(x.d) + KM + ' ' + dir8(x.b) + '</em></button>'; }).join('') + '</div>' : '');
    $('#hPlace').innerHTML = h; show('place');
    $('#hBack').addEventListener('click', function () { show('list'); sel = null; highlight(null); $('#hFocus').hidden = true; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} });
    $('#hPlace').querySelector('.gh-near') && $('#hPlace').querySelector('.gh-near').addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) open(b.getAttribute('data-id'), true); });
    $('#hSat').addEventListener('click', function () { $('#hFocus').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#hShare').addEventListener('click', function () { var u = location.origin + location.pathname + '#' + p.id; if (navigator.share) navigator.share({ title: d.name, url: u }).catch(function () {}); else copyTxt(u, t('Link copied.', 'نُسخ الرابط.')); });
    $('#hHero').addEventListener('click', function () { if (GAL.length) lb(0); });
    $$('.gh-li').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-id') === id); });
    focus(p, my); facts(p, my);
  }
  function drive(m) { var h = m / 1000 / 70; return h < 1 ? Math.max(5, Math.round(h * 60 / 5) * 5) + t(' min', ' دقيقة') : SH.fmt(Math.floor(h), 0) + t(' h ', ' س ') + (Math.round(h % 1 * 6) * 10 ? Math.round(h % 1 * 6) * 10 + t(' min', ' د') : ''); }
  function copyTxt(s, msg) { (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { SH.toast(msg || t('Copied.', 'تم النسخ.'), 'ok'); }).catch(function () { window.prompt(t('Copy:', 'انسخ:'), s); }); }

  /* surface geology, elevation, fossils and live conditions for the open place */
  var FX = {};
  function facts(p, my) {
    var D = FX[p.id] = FX[p.id] || {};
    var rock = D.rock ? Promise.resolve(D.rock) : SH.getJSON(MS + 'geologic_units/map?lat=' + p.lat.toFixed(5) + '&lng=' + p.lon.toFixed(5), { timeout: 15000 }).then(function (j) { var a = (j.success && j.success.data) || []; a.sort(function (x, y) { return (x.t_age - x.b_age) - (y.t_age - y.b_age); }); return D.rock = a.filter(function (u) { return u.name || u.lith; })[0] || null; }).catch(function () { return null; });
    rock.then(function (u) { if (my !== tok) return; var el = $('#hRock'); if (!el) return; if (!u) { el.textContent = t('Not available for this point', 'غير متاح لهذه النقطة'); return; }
      var pr = SH.icsAt((+u.b_age + +u.t_age) / 2), age = (u.b_int_name || '') + (u.t_int_name && u.t_int_name !== u.b_int_name ? ' – ' + u.t_int_name : '');
      el.innerHTML = '<span class="ltr" style="display:block">' + E(u.name || '') + '</span><small class="gh-cap" style="display:block">' + E([String(u.lith || '').replace(/\b(Major|Minor|Incidental):\s*/g, '').replace(/[{}]/g, ''), age ? age + ' (' + SH.fmt(+u.b_age, 1) + '–' + SH.fmt(+u.t_age, 1) + ' Ma)' : ''].filter(Boolean).join(' · ')) + (pr ? ' · ' + (AR ? pr[1] : pr[0]) : '') + '</small>'; D.rockTxt = [u.name, String(u.lith || '').replace(/\b(Major|Minor|Incidental):\s*/g, '').replace(/[{}]/g, ''), age].filter(Boolean).join('; '); });
    var el0 = D.el != null ? Promise.resolve(D.el) : SH.getJSON(OM + '?latitude=' + p.lat.toFixed(5) + '&longitude=' + p.lon.toFixed(5), { timeout: 12000 }).then(function (j) { return D.el = j.elevation && j.elevation[0]; }).catch(function () { return null; });
    el0.then(function (v) { if (my !== tok) return; var el = $('#hElev'); if (el) el.textContent = v == null ? '—' : SH.fmt(v, 0) + t(' m above sea level', ' م فوق سطح البحر'); });
    var dl = .23, dlo = dl / Math.cos(SH.rad(p.lat));
    Promise.all([rock, el0]).then(function () { if (my === tok && PS === p) placeSheet(p); });
    var fos = D.fos ? Promise.resolve(D.fos) : SH.getJSON(PB + 'colls/list.json?lngmin=' + (p.lon - dlo).toFixed(3) + '&lngmax=' + (p.lon + dlo).toFixed(3) + '&latmin=' + (p.lat - dl).toFixed(3) + '&latmax=' + (p.lat + dl).toFixed(3) + '&show=loc', { timeout: 15000 }).then(function (j) { return D.fos = j.records || []; }).catch(function () { return null; });
    fos.then(function (r) { if (my !== tok) return; var el = $('#hFos'); if (!el) return; if (r == null) { el.textContent = '—'; return; } if (!r.length) { el.textContent = t('None recorded in the published database', 'لا توجد مواقع مسجلة في قاعدة البيانات المنشورة'); return; }
      var ages = r.map(function (c) { return SH.icsAt(((+c.lag || 0) + (+c.eag || 0)) / 2); }).filter(Boolean), pc = {}; ages.forEach(function (a) { pc[AR ? a[1] : a[0]] = 1; });
      el.innerHTML = r.length + ' ' + t('fossil collections', 'مجموعة أحفورية') + (Object.keys(pc).length ? ' · ' + E(Object.keys(pc).slice(0, 4).join(AR ? '، ' : ', ')) : '') + ' <a class="gh-try" style="margin-inline-start:6px" href="' + SH.base + (AR ? '' : 'en/') + 'tools/fossils/">' + t('Fossil explorer', 'مستكشف الأحافير') + '</a>'; });
    var q = '?lat=' + p.lat.toFixed(4) + '&lon=' + p.lon.toFixed(4), hm = function (iso) { var m = /T(\d\d:\d\d)/.exec(iso || ''); return m ? m[1] : '—'; };
    var wx = D.wx ? Promise.resolve(D.wx) : SH.getJSON(MET + 'locationforecast/2.0/compact' + q, { timeout: 14000 }).then(function (j) { return D.wx = j; }).catch(function () { return null; });
    var sun = D.sun ? Promise.resolve(D.sun) : SH.getJSON(MET + 'sunrise/3.0/sun' + q + '&offset=%2B03:00', { timeout: 12000 }).then(function (j) { return D.sun = j; }).catch(function () { return null; });
    Promise.all([wx, sun]).then(function (r) { if (my !== tok) return; var el = $('#hNow'); if (!el) return; var c = r[0] && r[0].properties.timeseries[0].data.instant.details, s = r[1] && r[1].properties;
      el.innerHTML = '<div><span>' + t('Temperature', 'الحرارة') + '</span><b>' + (c ? SH.fmt(c.air_temperature, 0) + '°C' : '—') + '</b><span>' + (c ? t('wind ', 'الرياح ') + SH.fmt(c.wind_speed * 3.6, 0) + t(' km/h', ' كم/س') : '') + '</span></div><div><span>' + t('Sunrise', 'الشروق') + '</span><b>' + (s ? hm(s.sunrise.time) : '—') + '</b></div><div><span>' + t('Sunset', 'الغروب') + '</span><b>' + (s ? hm(s.sunset.time) : '—') + '</b></div>';
      wxChart(r[0], p); });
  }

  /* ------------------------------------------------------------------ selected place in the deck */
  var mini = null, miniL = {}, miniMk = null, GAL = [], LB = { i: 0 }, PS = null;
  function focus(p, my) {
    var F0 = $('#hFocus'), d = AR ? p.ar : p.en; F0.hidden = false;
    $('#hFK').textContent = t('Selected place', 'المكان المختار') + ' · ' + TY[p.type][0]; $('#hFName').textContent = d.name;
    $('#hFSum').textContent = [gname(p.gov), ZONE[p.zone][1], p.lat.toFixed(4) + '°N ' + p.lon.toFixed(4) + '°E'].join(' · ');
    if (L && !mini) { mini = L.map('hMini', { zoomControl: true, attributionControl: true }); mini.attributionControl.setPrefix('Leaflet');
      miniL.sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
      miniL.geo = L.layerGroup([L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' }), L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: .7, maxZoom: 16, attribution: 'Geology © Macrostrat' })]);
      miniL.topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Map © Esri, HERE, Garmin, USGS' });
      miniL.sat.addTo(mini); L.control.scale({ metric: true, imperial: false }).addTo(mini); }
    if (mini) { var zz = /river|marsh|mountain|valley|lake|depression/.test(p.type) ? 11 : 16; mini.setView([p.lat, p.lon], zz); setTimeout(function () { mini.invalidateSize(); }, 80);
      if (miniMk) miniMk.setLatLng([p.lat, p.lon]); else miniMk = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 29], html: '<div class="gh-pin on" style="background:#C0392B">' + svgI('arch') + '</div>' }) }).addTo(mini); }
    $('#hMiniCap').innerHTML = t('Imagery at full resolution around the place. “Geology” lays the geological map over the imagery so the rock units can be followed on the ground; “Terrain” shows relief, roads and names.', 'صور فضائية بكامل الدقة حول المكان. وتضع «جيولوجيا» الخريطة الجيولوجية فوق الصور لتتبع الوحدات الصخرية على الأرض، وتُظهر «تضاريس» التضاريس والطرق والأسماء.');
    gallery(p, my); profile(p, my);
    PS = p; placeSheet(p).then(function () { $('#hPSCap').innerHTML = t('The red star marks the place on a framed location map about 60 km across, with the other places coloured by kind. The panel on the right summarises the place for printing or sharing.', 'تدل النجمة الحمراء على المكان في خريطة موقع مؤطرة بعرض نحو 60 كم، مع الأماكن الأخرى ملونة حسب نوعها. وتلخص اللوحة على اليمين المكان للطباعة أو المشاركة.'); });
  }
  $$('[data-mini]').forEach(function (b) { b.addEventListener('click', function () { if (!mini) return; var k = b.getAttribute('data-mini'); Object.keys(miniL).forEach(function (x) { if (mini.hasLayer(miniL[x])) mini.removeLayer(miniL[x]); }); miniL[k].addTo(mini); $$('[data-mini]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); x.classList.toggle('btn-ink', x === b); x.classList.toggle('btn-line', x !== b); }); }); });
  $('#hFClose').addEventListener('click', function () { $('#hFocus').hidden = true; });

  /* photographs: the images of the place's encyclopaedia article, then a search of the media archive */
  function gallery(p, my) {
    var g = $('#hGal'); g.innerHTML = '<span class="gh-cap">' + spin + t('Loading photographs…', 'جارٍ تحميل الصور…') + '</span>'; GAL = [];
    if (p.loc) for (var i = 1; i <= p.img; i++) GAL.push({ th: SH.base + 'assets/img/geoheritage/' + p.loc + '-' + i + '-t.webp', src: SH.base + 'assets/img/geoheritage/' + p.loc + '-' + i + '.webp', cap: p.en.name, by: 'Shandal archive' });
    var bad = /ISS\d|View of Earth|View of Iraq|MODIS|Landsat|Sentinel|locator|logo|map|flag|icon|symbol|coat_of_arms|seal|locator|svg|location|diagram|plan|commons-logo|edit-clear|question_book|wiki|ambox|portal|emblem/i;
    var parse = function (j) { var pg = (j.query && j.query.pages) || {}; return Object.keys(pg).map(function (k) { return pg[k]; }).filter(function (x) { var ii = x.imageinfo && x.imageinfo[0]; return ii && ii.thumburl && !bad.test(x.title) && /image\/(jpeg|png|webp)/.test(ii.mime || 'image/jpeg') && (ii.width || 999) >= 400; }).map(function (x) { var ii = x.imageinfo[0], md = ii.extmetadata || {}, art = md.Artist ? String(md.Artist.value).replace(/<[^>]+>/g, '').trim() : ''; return { th: ii.thumburl, src: ii.thumburl.replace(/\/\d+px-/, '/1280px-'), full: ii.url, w: ii.width, cap: (md.ImageDescription ? String(md.ImageDescription.value).replace(/<[^>]+>/g, '').trim() : x.title.replace(/^File:|\.\w+$/g, '').replace(/_/g, ' ')).slice(0, 160), by: [art, md.LicenseShortName && md.LicenseShortName.value].filter(Boolean).join(' · ') }; }); };
    var ii = '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=500&iiextmetadatafilter=Artist|LicenseShortName|ImageDescription&format=json&origin=*';
    var a1 = p.wp ? SH.getJSON(WP + '?action=query&titles=' + encodeURIComponent(p.wp) + '&generator=images&gimlimit=40' + ii, { timeout: 15000 }).then(parse).catch(function () { return []; }) : Promise.resolve([]);
    var rad = /river|marsh|mountain|valley|lake|depression|gorge/.test(p.type) ? 5000 : 1200, nmq = (p.wp || p.en.name).replace(/\s*\(.*\)$/, '').replace(/^Lake |^Mount |^Al-|^Jabal /, '');
    var a2 = SH.getJSON(CM + '?action=query&generator=geosearch&ggsnamespace=6&ggslimit=30&ggsradius=' + rad + '&ggscoord=' + p.lat + '%7C' + p.lon + ii, { timeout: 15000 }).then(parse).catch(function () { return []; });
    var a3 = nmq.length < 5 || /^(gara|salman|alus|makhul)$/i.test(nmq) ? Promise.resolve([]) : SH.getJSON(CM + '?action=query&generator=search&gsrnamespace=6&gsrlimit=16&gsrsearch=' + encodeURIComponent('intitle:"' + nmq + '" Iraq -soldier -soldiers -police -army -marines -minister -battalion -payment -ISS') + ii, { timeout: 15000 }).then(parse).catch(function () { return []; });
    Promise.all([a1, a2, a3]).then(function (r) { if (my !== tok) return; var seen = {}; GAL.forEach(function (x) { seen[x.src] = 1; });
      r[0].concat(r[1], r[2]).forEach(function (x) { var k = x.th.split('/').slice(-2, -1)[0]; if (seen[k]) return; seen[k] = 1; if (GAL.length < 24) GAL.push(x); });
      if (!GAL.length && p.photo) GAL.push({ th: photoURL(p, 500), src: photoURL(p, 1280), cap: p.en.name, by: '' });
      $('#hGalN').textContent = GAL.length ? GAL.length + t(' photographs', ' صورة') : '';
      g.innerHTML = GAL.length ? GAL.map(function (x, i) { return '<button type="button" data-g="' + i + '" style="background-image:url(\'' + x.th + '\')" aria-label="' + E(x.cap) + '"></button>'; }).join('') : '<p class="gh-cap">' + t('No photographs were found for this place.', 'لم يُعثر على صور لهذا المكان.') + '</p>';
      if (GAL.length && !p.loc && !p.photo) { var hero = $('#hHero'); if (hero) hero.style.backgroundImage = 'url(\'' + GAL[0].src.replace('/1280px-', '/960px-') + '\')'; } });
  }
  $('#hGal').addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (b) lb(+b.getAttribute('data-g')); });
  function lb(i) { if (!GAL.length) return; LB.i = (i + GAL.length) % GAL.length; var x = GAL[LB.i], im = $('#hLbI'); im.onerror = function () { if (x.full && im.src !== x.full) im.src = x.full; else if (im.src !== x.th) im.src = x.th; }; im.src = x.src; im.alt = x.cap; $('#hLbC').textContent = x.cap; $('#hLbK').textContent = (LB.i + 1) + ' / ' + GAL.length + (x.by ? ' · ' + x.by : ''); var o = $('#hLb'); if (o.parentNode !== document.body) document.body.appendChild(o); o.hidden = false; }
  $('#hLbX').addEventListener('click', function () { $('#hLb').hidden = true; });
  $('#hLbP').addEventListener('click', function () { lb(LB.i + (AR ? 1 : -1)); }); $('#hLbN').addEventListener('click', function () { lb(LB.i + (AR ? -1 : 1)); });
  document.addEventListener('keydown', function (e) { if ($('#hLb').hidden) { if (e.key === 'Escape') $('#hNav').hidden = true; return; } if (e.key === 'Escape') $('#hLb').hidden = true; if (e.key === 'ArrowLeft') lb(LB.i - 1); if (e.key === 'ArrowRight') lb(LB.i + 1); });

  /* ------------------------------------------------------------------ charts */
  var CH = {}, L2 = function (en, ar, e2) { return e2 || !AR ? en : ar; };
  var base = function (en) { return { margin: { l: 60, r: 16, t: 10, b: 110 }, legend: { orientation: 'h', x: .5, xanchor: 'center', y: -0.2, yanchor: 'top', font: { size: 11 } }, font: { family: PF } }; };
  CH.hWx = function (en) { var j = FX[sel && sel.id] && FX[sel.id].wx; if (!j) return { data: [], layout: base(en) };
    var days = {}, order = []; j.properties.timeseries.forEach(function (s) { var dt = new Date(s.time), k = new Date(dt.getTime() + 3 * 3600e3).toISOString().slice(0, 10), v = s.data.instant.details.air_temperature, pr = s.data.next_1_hours ? s.data.next_1_hours.details.precipitation_amount : s.data.next_6_hours ? s.data.next_6_hours.details.precipitation_amount : 0; if (!days[k]) { days[k] = { mx: -99, mn: 99, pr: 0 }; order.push(k); } days[k].mx = Math.max(days[k].mx, v); days[k].mn = Math.min(days[k].mn, v); days[k].pr += pr || 0; });
    order = order.slice(0, 8); var lab = order.map(function (k) { var d0 = new Date(k + 'T12:00:00'); try { return d0.toLocaleDateString(en || !AR ? 'en-GB' : 'ar-IQ', { weekday: 'short', day: 'numeric' }); } catch (e) { return k.slice(5); } });
    return { data: [{ type: 'bar', x: lab, y: order.map(function (k) { return +days[k].pr.toFixed(1); }), name: L2('rain (mm per day)', 'المطر (ملم في اليوم)', en), marker: { color: '#5B9BD5' }, yaxis: 'y2', hovertemplate: '%{y} mm<extra></extra>' },
      { type: 'scatter', mode: 'lines+markers+text', x: lab, y: order.map(function (k) { return +days[k].mx.toFixed(0); }), text: order.map(function (k) { return days[k].mx.toFixed(0) + '°'; }), textposition: 'top center', name: L2('highest temperature (°C)', 'أعلى حرارة (°م)', en), line: { color: '#D9534F', width: 2.5 }, marker: { size: 7 } },
      { type: 'scatter', mode: 'lines+markers+text', x: lab, y: order.map(function (k) { return +days[k].mn.toFixed(0); }), text: order.map(function (k) { return days[k].mn.toFixed(0) + '°'; }), textposition: 'bottom center', name: L2('lowest temperature (°C)', 'أدنى حرارة (°م)', en), line: { color: '#2E6FA8', width: 2.5 }, marker: { size: 7 } }],
      layout: SH.merge(base(en), { yaxis: { title: { text: L2('air temperature (°C)', 'حرارة الهواء (°م)', en) } }, yaxis2: { title: { text: L2('rain (mm)', 'المطر (ملم)', en) }, overlaying: 'y', side: 'right', showgrid: false, rangemode: 'tozero' }, margin: { r: 60 }, xaxis: { title: { text: L2('day (local time)', 'اليوم (التوقيت المحلي)', en) } } }) }; };
  function wxChart(j, p) { if (!j || sel !== p || !window.Plotly) return; var c = CH.hWx(); SH.plot('hWx', c.data, c.layout, { filename: 'shandal-weather-' + p.id });
    var tmax = Math.max.apply(null, c.data[1].y), rain = c.data[0].y.reduce(function (a, b) { return a + b; }, 0);
    $('#hWxCap').innerHTML = t('Daily highest and lowest air temperature and daily rain at the place for the coming days. ', 'أعلى وأدنى حرارة للهواء والمطر اليومي في المكان للأيام القادمة. ') + (tmax >= 40 ? t('Expect strong heat: plan the visit for early morning or late afternoon and carry water.', 'يُتوقع حر شديد: خطط للزيارة في الصباح الباكر أو آخر العصر واحمل الماء.') : rain > 10 ? t('Rain is expected; tracks and valleys can become muddy or flood.', 'يُتوقع مطر؛ قد تصبح الطرق الترابية والوديان موحلة أو تجري فيها السيول.') : t('Conditions look suitable for a visit.', 'تبدو الظروف مناسبة للزيارة.')); }
  var PROF = {};
  CH.hProf = function (en) { var r = PROF[sel && sel.id]; if (!r) return { data: [], layout: base(en) }; var xs = r.x;
    return { data: [{ type: 'scatter', mode: 'lines', x: xs, y: r.we, name: L2('west → east', 'غرب ← شرق', en), line: { color: '#8C6D3F', width: 2.5 }, fill: 'tozeroy', fillcolor: 'rgba(140,109,63,.15)' }, { type: 'scatter', mode: 'lines', x: xs, y: r.sn, name: L2('south → north', 'جنوب ← شمال', en), line: { color: '#2F7D5B', width: 2.5, dash: 'dot' } }],
      layout: SH.merge(base(en), { xaxis: { title: { text: L2('distance from the place (km); negative = west or south', 'المسافة من المكان (كم)؛ السالب = غرباً أو جنوباً', en) }, zeroline: true, zerolinecolor: '#C0392B', zerolinewidth: 2 }, yaxis: { title: { text: L2('elevation above sea level (m)', 'الارتفاع فوق سطح البحر (م)', en) } } }) }; };
  function profile(p, my) {
    var go = function () { if (my !== tok || !window.Plotly) return; var c = CH.hProf(); SH.plot('hProf', c.data, c.layout, { filename: 'shandal-profile-' + p.id }); var r = PROF[p.id], all = r.we.concat(r.sn), rel = Math.max.apply(null, all) - Math.min.apply(null, all);
      $('#hProfCap').innerHTML = t('Ground elevation along two lines 16 km long crossing at the place (red line): west to east and south to north. The relief within 8 km is about ', 'ارتفاع الأرض على امتداد خطين طول كل منهما 16 كم يتقاطعان عند المكان (الخط الأحمر): من الغرب إلى الشرق ومن الجنوب إلى الشمال. ويبلغ التضرس ضمن 8 كم نحو ') + '<b>' + SH.fmt(rel, 0) + t(' m', ' م') + '</b>' + (rel > 600 ? t(', typical of the deeply cut folded mountains.', '، وهو نموذجي للجبال المطوية المقطعة بعمق.') : rel > 120 ? t(', a landscape of ridges and valleys.', '، وهي أرض حافات ووديان.') : t(', an almost flat landscape of plains or plateau.', '، وهي أرض شبه مستوية من السهول أو الهضاب.')); };
    if (PROF[p.id]) return go();
    var n = 33, dk = 8, xs = [], la = [], lo = []; for (var i = 0; i < n; i++) { var k = -dk + 2 * dk * i / (n - 1); xs.push(+k.toFixed(2)); la.push(p.lat); lo.push(p.lon + k / (111.32 * Math.cos(SH.rad(p.lat)))); } for (i = 0; i < n; i++) { la.push(p.lat + xs[i] / 110.57); lo.push(p.lon); }
    SH.getJSON(OM + '?latitude=' + la.map(function (v) { return v.toFixed(5); }).join(',') + '&longitude=' + lo.map(function (v) { return v.toFixed(5); }).join(','), { timeout: 15000 }).then(function (j) { var e = j.elevation || []; PROF[p.id] = { x: xs, we: e.slice(0, n), sn: e.slice(n, 2 * n) }; go(); })
      .catch(function () { if (my === tok) $('#hProf').innerHTML = '<p class="gh-cap" style="padding:20px">' + t('The elevation service did not answer. Try again later.', 'لم تستجب خدمة الارتفاعات. حاول لاحقاً.') + '</p>'; });
  }
  /* overview charts of the current selection */
  CH.hGovC = function (en) { var g = {}; LIST.forEach(function (p) { (g[p.gov] = g[p.gov] || {})[p.cat] = (g[p.gov][p.cat] || 0) + 1; }); var gs = GORD.filter(function (k) { return g[k]; }).reverse();
    return { data: Object.keys(CAT).map(function (c) { return { type: 'bar', orientation: 'h', y: gs.map(function (k) { return gname(k, en); }), x: gs.map(function (k) { return g[k][c] || 0; }), name: en ? CATEN[c] : CAT[c][1], marker: { color: CAT[c][0] }, hovertemplate: '%{y}: %{x}<extra>' + (en ? CATEN[c] : CAT[c][1]) + '</extra>' }; }),
      layout: SH.merge(base(en), { barmode: 'stack', margin: { l: 120, b: 120 }, xaxis: { title: { text: L2('number of places', 'عدد الأماكن', en) }, dtick: 2 }, yaxis: { automargin: true }, legend: { y: -0.16 } }) }; };
  CH.hZoneC = function (en) { var z = {}; LIST.forEach(function (p) { (z[p.zone] = z[p.zone] || {})[p.cat] = (z[p.zone][p.cat] || 0) + 1; }); var zs = ZORD.filter(function (k) { return z[k]; }).reverse();
    return { data: Object.keys(CAT).map(function (c) { return { type: 'bar', orientation: 'h', y: zs.map(function (k) { return en ? ZEN[k] : ZONE[k][1]; }), x: zs.map(function (k) { return z[k][c] || 0; }), name: en ? CATEN[c] : CAT[c][1], marker: { color: CAT[c][0] }, hovertemplate: '%{y}: %{x}<extra>' + (en ? CATEN[c] : CAT[c][1]) + '</extra>' }; }),
      layout: SH.merge(base(en), { barmode: 'stack', margin: { l: 200, b: 120 }, xaxis: { title: { text: L2('number of places', 'عدد الأماكن', en) } }, yaxis: { automargin: true, title: { text: L2('north-east  ↑  geological zone  ↓  south-west', 'الشمال الشرقي  ↑  النطاق الجيولوجي  ↓  الجنوب الغربي', en), standoff: 8 } }, legend: { y: -0.16 } }) }; };
  CH.hTypeC = function (en) { var c = {}; LIST.forEach(function (p) { c[p.type] = (c[p.type] || 0) + 1; }); var ks = Object.keys(c).sort(function (a, b) { return c[a] - c[b]; });
    return { data: [{ type: 'bar', orientation: 'h', y: ks.map(function (k) { return en ? enT[k] : TY[k][0]; }), x: ks.map(function (k) { return c[k]; }), text: ks.map(function (k) { return c[k]; }), textposition: 'outside', marker: { color: ks.map(function (k) { return CAT[P.filter(function (p) { return p.type === k; })[0].cat][0]; }) }, showlegend: false, hovertemplate: '%{y}: %{x}<extra></extra>' }],
      layout: SH.merge(base(en), { margin: { l: 170, b: 60 }, xaxis: { title: { text: L2('number of places', 'عدد الأماكن', en) } }, yaxis: { automargin: true } }) }; };
  CH.hLatC = function (en) { return { data: Object.keys(CAT).map(function (c) { var a = LIST.filter(function (p) { return p.cat === c; }); return { type: 'scatter', mode: 'markers', x: a.map(function (p) { return p.lon; }), y: a.map(function (p) { return p.lat; }), text: a.map(function (p) { return nm(p, en); }), name: en ? CATEN[c] : CAT[c][1], marker: { color: CAT[c][0], size: 9, line: { color: '#fff', width: 1 } }, hovertemplate: '%{text}<extra></extra>' }; }),
      layout: SH.merge(base(en), { xaxis: { title: { text: L2('longitude (degrees east)', 'خط الطول (درجة شرقاً)', en) }, range: [38.7, 48.8] }, yaxis: { title: { text: L2('latitude (degrees north)', 'خط العرض (درجة شمالاً)', en) }, range: [29, 37.5], scaleanchor: 'x', scaleratio: 1.2 }, shapes: [{ type: 'line', x0: 38.7, x1: 48.8, y0: 34.6, y1: 34.6, line: { color: '#999', dash: 'dot', width: 1 } }], annotations: [{ x: 48.6, y: 34.75, xanchor: 'right', text: L2('mountains and foothills', 'الجبال والتلال', en), showarrow: false, font: { size: 10, color: '#777' } }, { x: 48.6, y: 34.4, xanchor: 'right', text: L2('plains and deserts', 'السهول والصحارى', en), showarrow: false, font: { size: 10, color: '#777' } }] }) }; };
  function overview() {
    var n = LIST.length, by = {}; LIST.forEach(function (p) { by[p.cat] = (by[p.cat] || 0) + 1; }); var un = LIST.filter(function (p) { return p.unesco; }).length, govs = {}; LIST.forEach(function (p) { govs[p.gov] = 1; });
    $('#hKpis').innerHTML = '<div class="gh-kpi"><span>' + t('Places', 'الأماكن') + '</span><b>' + n + '</b><small>' + Object.keys(govs).length + t(' governorates', ' محافظة') + '</small></div>' + Object.keys(CAT).map(function (k) { return '<div class="gh-kpi" style="--kc:' + CAT[k][0] + '"><span>' + CAT[k][1] + '</span><b>' + (by[k] || 0) + '</b><small>' + CAT[k][2] + '</small></div>'; }).join('') + '<div class="gh-kpi" style="--kc:' + GOLD + '"><span>' + t('World Heritage', 'التراث العالمي') + '</span><b>' + un + '</b><small>' + t('places on the UNESCO list', 'أماكن على قائمة يونسكو') + '</small></div>';
    if (!n) { $('#hRead').innerHTML = t('No place matches the filters.', 'لا يوجد مكان يطابق الفلاتر.'); }
    else { var zc = {}; LIST.forEach(function (p) { zc[p.zone] = (zc[p.zone] || 0) + 1; }); var zt = Object.keys(zc).sort(function (a, b) { return zc[b] - zc[a]; }), gc = {}; LIST.forEach(function (p) { gc[p.gov] = (gc[p.gov] || 0) + 1; }); var gt = Object.keys(gc).sort(function (a, b) { return gc[b] - gc[a]; });
      var top = LIST.filter(function (p) { return p.unesco; }).slice(0, 3); if (top.length < 3) top = top.concat(LIST.filter(function (p) { return !p.unesco && (p.photo || p.loc); }).slice(0, 3 - top.length));
      $('#hRead').innerHTML = (AR ? 'يضم الاختيار ' : 'The selection holds ') + '<b>' + n + '</b>' + t(' places in ', ' مكاناً في ') + Object.keys(govs).length + t(' governorates; most are in ', ' محافظة، أكثرها في ') + '<b>' + gname(gt[0]) + '</b> (' + gc[gt[0]] + ')' + (gt[1] ? t(' and ', ' و') + '<b>' + gname(gt[1]) + '</b> (' + gc[gt[1]] + ')' : '') + '. ' +
        t('Geologically, ', 'جيولوجياً، ') + Math.round(100 * zc[zt[0]] / n) + t('% stand on the ', '% منها تقع في ') + '<b>' + ZONE[zt[0]][1] + '</b>' + t(': ', ': ') + ZONE[zt[0]][2] + ' ' +
        ((by.nature || 0) && n - (by.nature || 0) ? t('Natural places dominate the folded mountains of the north-east, while the ancient cities, shrines and museums follow the rivers across the plain: the same water that cut the gorges built the soil on which Mesopotamian civilisation grew. ', 'تسود الأماكن الطبيعية في الجبال المطوية في الشمال الشرقي، بينما تتبع المدن القديمة والمراقد والمتاحف الأنهار عبر السهل: فالماء نفسه الذي حفر المضائق بنى التربة التي نمت عليها حضارة بلاد الرافدين. ') : '') +
        (top.length ? t('Highlights: ', 'أبرزها: ') + top.map(function (p) { return '<b>' + E(nm(p)) + '</b>'; }).join(AR ? '، ' : ', ') + '.' : '');
    }
    if (!window.Plotly) return;
    ['hGovC', 'hZoneC', 'hTypeC', 'hLatC'].forEach(function (id) { var c = CH[id](); SH.plot(id, c.data, c.layout, { filename: 'shandal-' + id }); });
    $('#hGovCap').textContent = t('Number of places in each governorate, split by kind of place.', 'عدد الأماكن في كل محافظة مقسماً حسب نوع المكان.');
    $('#hZoneCap').textContent = t('Where the places stand on the geological map of Iraq: from the thrust mountains of the north-east to the stable desert plateau of the west. Natural places gather where rock and relief are strongest; cultural places where the rivers built the plain.', 'موقع الأماكن على الخريطة الجيولوجية للعراق: من جبال الزحوف في الشمال الشرقي إلى هضبة الصحراء المستقرة في الغرب. تتجمع الأماكن الطبيعية حيث يقوى الصخر والتضرس، والأماكن الحضارية حيث بنت الأنهار السهل.');
    $('#hTypeCap').textContent = t('How many places of each type are in the selection; the colour shows the kind of place.', 'عدد الأماكن من كل نوع في الاختيار؛ ويدل اللون على نوع المكان.');
    $('#hLatCap').textContent = t('Every place plotted by its latitude and longitude. North of about 34.6° N (dotted line) lie the folded mountains and foothills; south of it the river plain and the deserts.', 'كل مكان مرسوم حسب خط عرضه وطوله. شمال خط العرض 34.6° تقريباً (الخط المنقط) تقع الجبال المطوية والتلال، وجنوبه السهل النهري والصحارى.');
  }
  function plotCanvas(id) {
    var c = CH[id](true), TT = { hWx: 'Weather forecast — ' + (sel ? sel.en.name : ''), hProf: 'Ground profile across ' + (sel ? sel.en.name : 'the place'), hGovC: 'Places by governorate', hZoneC: 'Places on the geological zones of Iraq', hTypeC: 'Types of place', hLatC: 'Places from north to south' };
    var lay = SH.plotLayout(JSON.parse(JSON.stringify(c.layout))); lay.paper_bgcolor = '#fff'; lay.plot_bgcolor = '#fff'; lay.font = { family: PF, color: INK, size: 13 };
    ['xaxis', 'yaxis', 'yaxis2'].forEach(function (a) { if (lay[a]) lay[a] = SH.merge(lay[a], { gridcolor: '#E3E3E3', linecolor: '#888', tickcolor: '#888', zerolinecolor: '#BBB', tickfont: { color: INK }, title: { font: { color: INK } } }); });
    if (id === 'hProf') lay.xaxis.zerolinecolor = '#C0392B';
    lay.legend = SH.merge(lay.legend || {}, { font: { color: INK } }); lay.margin = SH.merge(lay.margin || {}, { t: 70 }); lay.title = { text: '<b>' + TT[id] + '</b>', x: .02, y: .97, font: { size: 17, color: INK } };
    return window.Plotly.toImage({ data: c.data, layout: lay }, { format: 'png', width: 1200, height: 760, scale: 2 }).then(SH.loadImage).then(function (im) { var cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0); return cv; });
  }

  /* ------------------------------------------------------------------ cards, table */
  function cards() {
    var s = SH.val('hSort'), a = LIST.slice(); if (s === 'name') a.sort(function (x, y) { return nm(x).localeCompare(nm(y), AR ? 'ar' : 'en'); }); else if (s === 'gov') a.sort(function (x, y) { return GORD.indexOf(x.gov) - GORD.indexOf(y.gov) || y.lat - x.lat; }); else if (s === 'dist' && me) a.sort(function (x, y) { return x._d - y._d; }); else a.sort(function (x, y) { return y.lat - x.lat; });
    $('#hCards').innerHTML = a.map(function (p) { var c = CAT[p.cat][0], ph = photoURL(p, 500), d = AR ? p.ar : p.en;
      return '<button type="button" class="gh-card" data-id="' + p.id + '"><span class="im" style="' + grad(c) + (ph ? ';background-image:url(\'' + ph + '\')' : '') + '">' + (ph ? '' : svgI(glyph(p), 'rgba(255,255,255,.85)', 34)) + '<em style="background:' + c + '">' + TY[p.type][0] + '</em>' + (p.unesco ? '<u>UNESCO</u>' : '') + '</span><span class="bd"><b>' + E(d.name) + '</b><small>' + gname(p.gov) + ' · ' + ZONE[p.zone][1] + (me ? ' · <span class="ltr">' + km(p._d) + KM + '</span>' : '') + '</small><small>' + E(((d.desc.match(/^.*?[.؟!](\s|$)/) || [d.desc])[0]).slice(0, 160)) + '</small></span></button>'; }).join('');
  }
  $('#hSort').addEventListener('change', cards);
  $('#hCards').addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) { open(b.getAttribute('data-id'), true); var m = $('.wsm'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  var TS = { k: 'n', d: 1 };
  var COLS = [['n', t('No.', 'ت')], ['name', t('Place', 'المكان')], ['type', t('Type', 'النوع')], ['gov', t('Governorate', 'المحافظة')], ['zone', t('Geological zone', 'النطاق الجيولوجي')], ['lat', t('Latitude', 'خط العرض')], ['lon', t('Longitude', 'خط الطول')], ['un', t('World Heritage', 'تراث عالمي')], ['dist', t('Distance (km)', 'المسافة (كم)')]];
  function rows(en) { return LIST.map(function (p, i) { return { p: p, n: i + 1, name: nm(p, en), type: en ? enT[p.type] : TY[p.type][0], gov: gname(p.gov, en), zone: en ? ZEN[p.zone] : ZONE[p.zone][1], lat: p.lat, lon: p.lon, un: p.unesco || '', dist: me ? +(p._d / 1000).toFixed(1) : '' }; }); }
  function table() {
    var q = norm(SH.val('hTQ')), r = rows().filter(function (x) { return !q || norm([x.name, x.type, x.gov, x.zone, x.p.en.name].join(' ')).indexOf(q) > -1; });
    r.sort(function (a, b) { var A = a[TS.k], B = b[TS.k]; return (typeof A === 'number' && typeof B === 'number' ? A - B : String(A).localeCompare(String(B), AR ? 'ar' : 'en')) * TS.d; });
    var cols = COLS.filter(function (c) { return c[0] !== 'dist' || me; });
    $('#hTbl').innerHTML = '<thead><tr>' + cols.map(function (c) { return '<th data-k="' + c[0] + '"' + (TS.k === c[0] ? ' data-dir="' + (TS.d > 0 ? 'asc' : 'desc') + '"' : '') + '>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>' + r.map(function (x) { return '<tr data-id="' + x.p.id + '">' + cols.map(function (c) { var v = x[c[0]]; return '<td>' + (c[0] === 'name' ? '<span class="sw" style="background:' + CAT[x.p.cat][0] + '"></span>' : '') + (c[0] === 'lat' || c[0] === 'lon' ? '<span class="ltr">' + (+v).toFixed(5) + '</span>' : E(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }
  $('#hTbl').addEventListener('click', function (e) { var th = e.target.closest('th[data-k]'); if (th) { var k = th.getAttribute('data-k'); TS.d = TS.k === k ? -TS.d : 1; TS.k = k; table(); return; } var tr = e.target.closest('tr[data-id]'); if (tr) { open(tr.getAttribute('data-id'), true); var m = $('.wsm'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  $('#hTQ').addEventListener('input', table);
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-tbl]'); if (!b) return; var f = b.getAttribute('data-tbl'), r = rows(true), nmF = 'shandal-iraq-places_' + stamp();
    var head = ['No.', 'Place (English)', 'Place (Arabic)', 'Type', 'Kind', 'Governorate', 'Geological zone', 'Latitude', 'Longitude', 'World Heritage', 'Description', 'Geology'].concat(me ? ['Distance from you (km)'] : []);
    var data = r.map(function (x) { var p = x.p; return [x.n, p.en.name, p.ar.name, enT[p.type], CATEN[p.cat], p.gov, ZEN[p.zone], p.lat, p.lon, p.unesco || '', AR ? p.ar.desc : p.en.desc, AR ? p.ar.geo : p.en.geo].concat(me ? [x.dist] : []); });
    if (f === 'xlsx') xlsx(nmF + '.xlsx', [{ name: 'Places', head: head, rows: data, widths: [6, 34, 30, 22, 22, 16, 26, 11, 11, 30, 80, 80, 14] }]);
    else if (f === 'csv') SH.download(nmF + '.csv', new Blob(['\ufeff' + [head].concat(data).map(function (rr) { return rr.map(function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    else if (f === 'geojson') SH.download(nmF + '.geojson', new Blob([JSON.stringify({ type: 'FeatureCollection', features: r.map(function (x) { var p = x.p; return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { name: p.en.name, name_ar: p.ar.name, type: enT[p.type], kind: CATEN[p.cat], governorate: p.gov, zone: ZEN[p.zone], world_heritage: p.unesco || null, description: p.en.desc, description_ar: p.ar.desc, geology: p.en.geo } }; }) }, null, 1)], { type: 'application/geo+json' }));
    else { var esc = function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }; SH.download(nmF + '.kml', new Blob(['<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Shandal — places of Iraq</name>' + r.map(function (x) { var p = x.p; return '<Placemark><name>' + esc(nm(p)) + '</name><description>' + esc((AR ? p.ar.desc : p.en.desc)) + '</description><Point><coordinates>' + p.lon + ',' + p.lat + ',0</coordinates></Point></Placemark>'; }).join('') + '</Document></kml>'], { type: 'application/vnd.google-earth.kml+xml' })); }
  });

  /* ------------------------------------------------------------------ directions: the user picks the app */
  var NAV = null;
  function navTo(stops) { NAV = stops; var rem = store.get('sh_navapp', null); if (rem && stops.length === 1) return go(rem); var o = $('#hNav'); if (o.parentNode !== document.body) document.body.appendChild(o);
    $('#hNavTo').innerHTML = stops.length === 1 ? t('To: ', 'إلى: ') + '<b>' + E(nm(stops[0])) + '</b>' : t('A route through ', 'طريق يمر بـ ') + stops.length + t(' stops. Only Google Maps opens several stops at once; the other apps open the first stop.', ' محطات. يفتح Google Maps وحده عدة محطات معاً؛ وتفتح التطبيقات الأخرى المحطة الأولى.');
    $('#hNavCo').textContent = stops[0].lat.toFixed(5) + ', ' + stops[0].lon.toFixed(5); $('#hNavRem').checked = false; o.hidden = false; }
  function go(app) { var s = NAV, d = s[s.length - 1], f = s[0], u;
    if (app === 'copy') { copyTxt(f.lat.toFixed(6) + ', ' + f.lon.toFixed(6), t('Coordinates copied.', 'نُسخت الإحداثيات.')); $('#hNav').hidden = true; return; }
    if (app === 'google') u = 'https://www.google.com/maps/dir/?api=1&destination=' + d.lat + ',' + d.lon + '&travelmode=driving' + (s.length > 1 ? '&waypoints=' + s.slice(0, -1).slice(0, 9).map(function (p) { return p.lat + ',' + p.lon; }).join('%7C') : '');
    else if (app === 'apple') u = 'https://maps.apple.com/?daddr=' + f.lat + ',' + f.lon + '&dirflg=d';
    else u = 'https://waze.com/ul?ll=' + f.lat + ',' + f.lon + '&navigate=yes';
    $('#hNav').hidden = true; window.open(u, '_blank', 'noopener'); }
  $('#hNav').addEventListener('click', function (e) { if (e.target === this || e.target.closest('#hNavX')) { this.hidden = true; return; } var b = e.target.closest('[data-app]'); if (!b) return; var a = b.getAttribute('data-app'); if ($('#hNavRem').checked && a !== 'copy') store.set('sh_navapp', a); go(a); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-nav]'); if (b) navTo([BY[b.getAttribute('data-nav')]]); });

  /* ------------------------------------------------------------------ trip planner */
  function saveTrip() { store.set('sh_gh_trip', trip); $('#nTr').textContent = trip.length; }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-addtrip]'); if (!b) return; var id = b.getAttribute('data-addtrip'), i = trip.indexOf(id); if (i > -1) trip.splice(i, 1); else trip.push(id); saveTrip(); tripView();
    b.innerHTML = ico(i > -1 ? 'plus' : 'check') + (i > -1 ? t('Add to trip', 'أضف إلى الرحلة') : t('In your trip', 'ضمن رحلتك')); SH.toast(i > -1 ? t('Removed from your trip.', 'أُزيل من رحلتك.') : t('Added to your trip.', 'أُضيف إلى رحلتك.'), 'ok'); });
  var tripLine = null;
  function tripView() {
    trip = trip.filter(function (id) { return BY[id]; }); $('#nTr').textContent = trip.length; var s = trip.map(function (id) { return BY[id]; });
    if (tripLine && map) { map.removeLayer(tripLine); tripLine = null; }
    if (!s.length) { $('#hTK').innerHTML = ''; $('#hTrip').innerHTML = '<div class="gh-empty">' + ico('route') + '<p>' + t('Your trip is empty. Open any place and press “Add to trip”; the stops, the distances between them and the whole route appear here.', 'رحلتك فارغة. افتح أي مكان واضغط «أضف إلى الرحلة»؛ تظهر هنا المحطات والمسافات بينها والطريق كاملاً.') + '</p></div>'; return; }
    var tot = 0, legs = s.map(function (p, i) { var from = i ? s[i - 1] : me; var dd = from ? SH.dist(from, p) : 0; tot += dd; return dd; });
    $('#hTK').innerHTML = '<div class="gh-kpi"><span>' + t('Stops', 'المحطات') + '</span><b>' + s.length + '</b></div><div class="gh-kpi"><span>' + t('Straight-line distance', 'المسافة المستقيمة') + '</span><b>' + km(tot) + '</b><small>km' + (me ? t(', from your position', '، من موقعك') : '') + '</small></div><div class="gh-kpi"><span>' + t('Driving time (approx.)', 'زمن القيادة (تقريبي)') + '</span><b style="font-size:1.25rem">' + drive(tot * 1.3) + '</b><small>' + t('at ~70 km/h on roads', 'بمعدل ~70 كم/س على الطرق') + '</small></div>';
    $('#hTrip').innerHTML = s.map(function (p, i) { return (legs[i] ? '<div class="gh-leg2">↓ ' + km(legs[i]) + KM + '</div>' : '') + '<div class="gh-stop"><span class="n" style="background:' + CAT[p.cat][0] + '">' + (i + 1) + '</span><span><b>' + E(nm(p)) + '</b><small>' + TY[p.type][0] + ' · ' + gname(p.gov) + '</small></span><span class="ac"><button type="button" class="btn btn-line btn-xs" data-tup="' + i + '" aria-label="up">↑</button><button type="button" class="btn btn-line btn-xs" data-nav="' + p.id + '" aria-label="navigate">' + ico('navigation') + '</button><button type="button" class="btn btn-line btn-xs" data-addtrip="' + p.id + '" aria-label="remove">✕</button></span></div>'; }).join('');
    if (map) tripLine = L.polyline((me ? [[me.lat, me.lon]] : []).concat(s.map(function (p) { return [p.lat, p.lon]; })), { color: GOLD, weight: 4, opacity: .85, dashArray: '8 6' }).addTo(map);
  }
  $('#hTrip').addEventListener('click', function (e) { var b = e.target.closest('[data-tup]'); if (!b) return; var i = +b.getAttribute('data-tup'); if (i < 1) return; var x = trip[i]; trip[i] = trip[i - 1]; trip[i - 1] = x; saveTrip(); tripView(); });
  $('#hTClr').addEventListener('click', function () { trip = []; saveTrip(); tripView(); });
  $('#hTGo').addEventListener('click', function () { if (!trip.length) return SH.toast(t('Add places to your trip first.', 'أضف أماكن إلى رحلتك أولاً.'), 'warn'); NAV = null; var s = trip.map(function (id) { return BY[id]; }); var o = $('#hNav'); navTo(s); if (s.length > 1) { if (o.parentNode !== document.body) document.body.appendChild(o); o.hidden = false; } });
  $('#hTOpt').addEventListener('click', function () { if (trip.length < 3 && !(me && trip.length > 1)) return; var rest = trip.map(function (id) { return BY[id]; }), out = [], curP = me || rest.shift(); if (!me) out.push(curP);
    while (rest.length) { rest.sort(function (a, b) { return SH.dist(curP, a) - SH.dist(curP, b); }); curP = rest.shift(); out.push(curP); }
    for (var it = 0; it < 30; it++) { var imp = false; for (var i = 0; i < out.length - 1; i++) for (var j = i + 1; j < out.length; j++) { var A = i ? out[i - 1] : me, B = out[i], C = out[j], D = out[j + 1]; if (!A) continue; var d0 = SH.dist(A, B) + (D ? SH.dist(C, D) : 0), d1 = SH.dist(A, C) + (D ? SH.dist(B, D) : 0); if (d1 < d0 - 1) { out = out.slice(0, i).concat(out.slice(i, j + 1).reverse(), out.slice(j + 1)); imp = true; } } if (!imp) break; }
    trip = out.map(function (p) { return p.id; }); saveTrip(); tripView(); SH.toast(t('Stops arranged into the shortest round.', 'رُتبت المحطات في أقصر جولة.'), 'ok'); });

  /* ------------------------------------------------------------------ tabs */
  $$('.gh-tabs [data-tab]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-tab'); $$('.gh-tabs [data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b); }); $$('.gh-pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== k; });
    if (k === 'ov' && window.Plotly) ['hGovC', 'hZoneC', 'hTypeC', 'hLatC'].forEach(function (id) { try { window.Plotly.Plots.resize(id); } catch (e) {} }); if (k === 'ms') sheet(); if (k === 'tr') tripView(); }); });

  /* ------------------------------------------------------------------ figures (map sheet, key, place sheet) */
  function northArrow(S2, x, y, s, col) { s = s || 1; col = col || INK; var g = S2.g({ transform: 'translate(' + x + ' ' + y + ') scale(' + s + ')' });
    S2.path('M0 0L-11 40L0 31Z', { fill: col }, g); S2.path('M0 0L11 40L0 31Z', { fill: '#fff', stroke: col, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, g); S2.line(0, 31, 0, 48, { stroke: col, 'stroke-width': 1.3 }, g);
    S2.text(0, -7, 'N', { fill: col, 'font-size': 16, 'font-weight': 800, 'text-anchor': 'middle', 'font-family': PF, direction: 'ltr' }, g); return g; }
  function baseMap(b, cw, ch, svc) {
    var z = Math.max(2, Math.min(15, Math.round(Math.log2(360 * cw / (256 * (b.e - b.w)))))), n = Math.pow(2, z), X = function (lo) { return (lo + 180) / 360 * n; }, Y = function (la) { var r = SH.rad(la); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n; }, LA = function (yy) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI; };
    var x0 = Math.floor(X(b.w)), x1 = Math.floor(X(b.e)), y0 = Math.floor(Y(b.n)), y1 = Math.floor(Y(b.s)); if ((x1 - x0 + 1) * (y1 - y0 + 1) > 160) return Promise.resolve(null);
    var mk = function (url) { var c = document.createElement('canvas'); c.width = cw; c.height = ch; var g = c.getContext('2d'), jobs = [];
      for (var tx0 = x0; tx0 <= x1; tx0++) for (var ty = y0; ty <= y1; ty++) (function (tx1, ty1) { jobs.push(new Promise(function (res) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { var l0 = tx1 / n * 360 - 180, l1 = (tx1 + 1) / n * 360 - 180, qx = function (l) { return (l - b.w) / (b.e - b.w) * cw; }, qy = function (a) { return (b.n - a) / (b.n - b.s) * ch; }; for (var r = 0; r < 16; r++) { var Y0p = qy(LA(ty1 + r / 16)), Y1p = qy(LA(ty1 + (r + 1) / 16)); g.drawImage(im, 0, r * 16, 256, 16, qx(l0), Y0p, qx(l1) - qx(l0), Y1p - Y0p + .5); } res(); }; im.onerror = function () { res(); }; im.src = url.replace('{z}', z).replace('{y}', ty1).replace('{x}', tx1); })); })(tx0, ty);
      return Promise.all(jobs).then(function () { return c; }); };
    var A = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
    var urls = svc === 'topo' ? [A + 'World_Topo_Map/MapServer/tile/{z}/{y}/{x}'] : [A + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', A + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'];
    return Promise.all(urls.map(mk)).then(function (a) { var o = document.createElement('canvas'); o.width = cw; o.height = ch; var x = o.getContext('2d'); x.fillStyle = '#EDEDEA'; x.fillRect(0, 0, cw, ch); a.forEach(function (c) { x.drawImage(c, 0, 0); }); try { return o.toDataURL('image/jpeg', .9); } catch (e) { return null; } }).catch(function () { return null; });
  }
  function dms(v, ax) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m + '′' + (ax === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); }
  function mapFrame(S2, b, X0, Y0, PW, PH, kx, o) {
    o = o || {}; var tx = function (x, y, s, a, par) { return S2.text(x, y, s, Object.assign({ fill: INK, 'font-size': 12, direction: 'ltr', 'font-family': PF }, a || {}), par); };
    S2.add('rect', { x: X0, y: Y0, width: PW, height: PH, fill: 'none', stroke: INK, 'stroke-width': 1.6 }); S2.add('rect', { x: X0 - 6, y: Y0 - 6, width: PW + 12, height: PH + 12, fill: 'none', stroke: INK, 'stroke-width': .8 });
    var px = function (lo) { return X0 + (lo - b.w) / (b.e - b.w) * PW; }, py = function (la) { return Y0 + (b.n - la) / (b.n - b.s) * PH; };
    var gs = [1 / 60, 2 / 60, 5 / 60, 10 / 60, .25, .5, 1, 2, 5, 10], st = gs.filter(function (g) { return (b.e - b.w) / g <= 6; })[0] || 10;
    for (var lo = Math.ceil(b.w / st) * st; lo <= b.e + 1e-9; lo += st) { var X = px(lo); if (X < X0 + 20 || X > X0 + PW - 20) continue; S2.line(X, Y0 - 6, X, Y0, { stroke: INK }); S2.line(X, Y0 + PH, X, Y0 + PH + 6, { stroke: INK }); tx(X, Y0 + PH + 24, dms(lo, 'lon'), { 'font-size': 11.5, 'text-anchor': 'middle' }); }
    for (var la = Math.ceil(b.s / st) * st; la <= b.n + 1e-9; la += st) { var Y = py(la); if (Y < Y0 + 14 || Y > Y0 + PH - 14) continue; S2.line(X0 - 6, Y, X0, Y, { stroke: INK }); S2.line(X0 + PW, Y, X0 + PW + 6, Y, { stroke: INK }); tx(X0 - 12, Y + 4, dms(la, 'lat'), { 'font-size': 11.5, 'text-anchor': 'end' }); }
    northArrow(S2, o.nx != null ? o.nx : X0 + PW + 34, o.ny != null ? o.ny : Y0 + 18, 1);
    var kmPx = (b.e - b.w) * 111.32 * kx / PW, want = kmPx * Math.min(170, PW * .3), p10 = Math.pow(10, Math.floor(Math.log10(want))), m = want / p10, len = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p10, spx = len / kmPx, sx0 = o.sx != null ? o.sx : X0, sy0 = o.sy != null ? o.sy : Y0 + PH + 58;
    for (var i = 0; i < 4; i++) S2.add('rect', { x: sx0 + i * spx / 4, y: sy0, width: spx / 4, height: 7, fill: i % 2 ? '#fff' : INK }); S2.add('rect', { x: sx0, y: sy0, width: spx, height: 7, fill: 'none', stroke: INK, 'stroke-width': .9 });
    var fl = function (v) { return v >= 1 ? SH.fmt(v, v % 1 ? 1 : 0) : SH.fmt(v, 2); }; tx(sx0, sy0 - 7, '0', { 'font-size': 11, 'text-anchor': 'middle' }); tx(sx0 + spx / 2, sy0 - 7, fl(len / 2), { 'font-size': 11, 'text-anchor': 'middle' }); tx(sx0 + spx, sy0 - 7, fl(len), { 'font-size': 11, 'text-anchor': 'middle' }); tx(sx0 + spx + 10, sy0 + 7, 'km', { 'font-size': 11.5, 'font-weight': 700 });
    return { px: px, py: py, tx: tx, bottom: sy0 + 12 };
  }
  var fitBox = function (b) { var kx = Math.cos(SH.rad((b.n + b.s) / 2)); return { kx: kx, asp: ((b.e - b.w) * kx) / (b.n - b.s) }; };
  function clipFor(S2, x, y, w, h) { var dfs = S2.add('defs', {}), id = 'ghc' + Math.round(Math.random() * 1e7), cp = S2.add('clipPath', { id: id }, null, dfs); S2.add('rect', { x: x, y: y, width: w, height: h }, null, cp); return 'url(#' + id + ')'; }
  function wrapTxt(x, s, maxW) { var words = String(s).split(' '), lines = [], c0 = ''; words.forEach(function (w) { var ts = c0 ? c0 + ' ' + w : w; if (x.measureText(ts).width > maxW && c0) { lines.push(c0); c0 = w; } else c0 = ts; }); if (c0) lines.push(c0); return lines; }
  var mdot = function (S2, x, y, cat, r, par) { return S2.circle(x, y, r || 7, { fill: CAT[cat][0], stroke: '#fff', 'stroke-width': 1.6 }, par); };
  var KEY = [], NKEY = 40;
  function sheet() {
    var svg = $('#hSheet'), S2 = SH.svgB(svg), W = 1100; svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var a = LIST.length ? LIST : P, lats = a.map(function (p) { return p.lat; }), lons = a.map(function (p) { return p.lon; }), bw = Math.max.apply(null, lons) - Math.min.apply(null, lons), bh = Math.max.apply(null, lats) - Math.min.apply(null, lats), mg = Math.max(.08, Math.max(bw, bh) * .08);
    var b = { w: Math.min.apply(null, lons) - mg, e: Math.max.apply(null, lons) + mg, s: Math.min.apply(null, lats) - mg, n: Math.max.apply(null, lats) + mg }, f = fitBox(b), PW = 840, PH = PW / f.asp; if (PH > 780) { PH = 780; PW = PH * f.asp; } var X0 = Math.max(96, (W - PW) / 2 - 10), Y0 = 104;
    var bg = S2.add('rect', { x: 0, y: 0, width: W, height: 900, fill: '#fff' });
    var gv = SH.val('hGov'), rd = +SH.val('hRad') || 0, ttl = 'Geological, natural and archaeological places' + (gv ? ' — ' + gv + ' Governorate' : me && rd ? ' within ' + rd + ' km of the observer' : ' of Iraq');
    S2.text(40, 48, ttl, { fill: INK, 'font-size': 23, 'font-weight': 800, 'font-family': PF, direction: 'ltr' });
    S2.text(40, 74, a.length + ' places' + (SH.val('hType') ? ' · ' + enT[SH.val('hType')] : '') + (SH.val('hZone') ? ' · ' + ZEN[SH.val('hZone')] : '') + ($('#hUn').checked ? ' · World Heritage sites' : ''), { fill: MUT, 'font-size': 13, 'font-family': PF, direction: 'ltr' });
    var cl = clipFor(S2, X0, Y0, PW, PH), imgEl = S2.add('image', { x: X0, y: Y0, width: PW, height: PH, preserveAspectRatio: 'none', 'clip-path': cl });
    var ready = baseMap(b, Math.round(PW * 2), Math.round(PH * 2)).then(function (u) { if (u) imgEl.setAttribute('href', u); });
    var gS = S2.g({ 'clip-path': cl }), F = mapFrame(S2, b, X0, Y0, PW, PH, f.kx);
    var ord = a.slice().sort(function (x, y) { return (y.unesco ? 2 : 0) + (y.photo || y.loc ? 1 : 0) - ((x.unesco ? 2 : 0) + (x.photo || x.loc ? 1 : 0)) || y.lat - x.lat; });
    /* numbered places: places closer than 16 px on the sheet share one label (e.g. "21–24"); labels are placed
       around their dot where they collide with nothing, otherwise pushed out with a leader line */
    var pick = ord.slice(0, NKEY), cl0 = [];
    pick.slice().sort(function (x, y) { return y.lat - x.lat || x.lon - y.lon; }).forEach(function (p) { var X = F.px(p.lon), Y = F.py(p.lat), c = cl0.filter(function (q) { return Math.hypot(q.x - X, q.y - Y) < 16; })[0]; if (c) { c.m.push(p); c.x = (c.x * (c.m.length - 1) + X) / c.m.length; c.y = (c.y * (c.m.length - 1) + Y) / c.m.length; } else cl0.push({ x: X, y: Y, m: [p] }); });
    cl0.sort(function (a0, b0) { return a0.y - b0.y || a0.x - b0.x; }); KEY = []; cl0.forEach(function (c) { c.m.forEach(function (p) { KEY.push(p); }); c.lab = c.m.length === 1 ? String(KEY.length) : (KEY.length - c.m.length + 1) + '–' + KEY.length; });
    a.forEach(function (p) { mdot(S2, F.px(p.lon), F.py(p.lat), p.cat, KEY.indexOf(p) > -1 ? 7.5 : 5, gS); });
    var boxes = a.map(function (p) { var X = F.px(p.lon), Y = F.py(p.lat); return [X - 7, Y - 7, X + 7, Y + 7]; }), hit = function (bx) { return bx[0] < X0 + 2 || bx[2] > X0 + PW - 2 || bx[1] < Y0 + 2 || bx[3] > Y0 + PH - 2 || boxes.some(function (o) { return bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]; }); };
    var mc = document.createElement('canvas').getContext('2d'); mc.font = '800 12px ' + PF;
    cl0.forEach(function (c) { var w = mc.measureText(c.lab).width + 4, h = 14, best = null;
      [1, 1.9, 2.8, 3.8].some(function (k) { return [[1, -1], [1, 0], [1, 1], [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1]].some(function (d) { var cx = c.x + d[0] * (9 * k + (d[0] ? w / 2 : 0)), cy = c.y + d[1] * (9 * k + h / 2), bx = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]; if (!hit(bx)) { best = { x: cx, y: cy, bx: bx, k: k }; return true; } return false; }); });
      if (!best) best = { x: c.x + 9 + w / 2, y: c.y - 8, bx: [c.x + 9, c.y - 15, c.x + 9 + w, c.y - 1], k: 1 };
      boxes.push(best.bx); if (best.k > 1) S2.line(c.x, c.y, best.x, best.y, { stroke: INK, 'stroke-width': .8 }, gS);
      S2.text(best.x, best.y + 4.5, c.lab, { fill: INK, 'font-size': 12, 'font-weight': 800, 'text-anchor': 'middle', stroke: '#fff', 'stroke-width': 3.2, 'paint-order': 'stroke', 'stroke-linejoin': 'round', 'font-family': PF, direction: 'ltr' }, gS); });
    var ly = F.bottom + 44; S2.line(40, ly - 24, W - 40, ly - 24, { stroke: '#D9D4C7' });
    F.tx(40, ly, 'LEGEND', { 'font-size': 15, 'font-weight': 800, 'letter-spacing': 1.2 }); ly += 26;
    Object.keys(CAT).forEach(function (k, i) { var x = 40 + (i % 2) * 400, y = ly + Math.floor(i / 2) * 26; mdot(S2, x + 8, y - 4, k, 7.5); F.tx(x + 24, y + 1, CATEN[k], { 'font-size': 13 }); });
    ly += 54; mdot(S2, 48, ly - 4, 'nature', 5); F.tx(64, ly + 1, 'Smaller dot: place without a number (see the data table)', { 'font-size': 13 });
    S2.text(560, ly + 1, '12', { fill: INK, 'font-size': 13, 'font-weight': 800, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke', 'font-family': PF, direction: 'ltr' }); F.tx(586, ly + 1, 'Place number (see the key table)', { 'font-size': 13 });
    ly += 30; F.tx(40, ly, 'Geographic coordinates, WGS 84 · basemap with international borders and place names', { fill: MUT, 'font-size': 11.5 });
    var VH = ly + 30; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); bg.setAttribute('height', VH); S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    keySheet();
    $('#hSheetCap').innerHTML = t('The map shows the ', 'تُظهر الخريطة ') + a.length + t(' places of the current selection coloured by kind. The ', ' مكاناً من الاختيار الحالي ملونة حسب النوع. وتحمل ') + KEY.length + t(' numbered places, World Heritage sites and the best documented first, are described in the key table below, which downloads separately.', ' مكاناً أرقاماً، مواقع التراث العالمي والأفضل توثيقاً أولاً، وهي موصوفة في جدول المفتاح أدناه الذي يُنزَّل منفصلاً.');
    return ready;
  }
  function keySheet() {
    var svg = $('#hKey'), S2 = SH.svgB(svg), W = 1100; svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var meas = document.createElement('canvas').getContext('2d'), fit = function (s, w) { meas.font = '12px ' + PF; s = String(s == null || s === '' ? '—' : s); if (meas.measureText(s).width <= w) return s; while (s.length > 1 && meas.measureText(s + '…').width > w) s = s.slice(0, -1); return s.trim() + '…'; };
    var bg = S2.add('rect', { x: 0, y: 0, width: W, height: 900, fill: '#fff' });
    S2.text(40, 48, 'Key to the numbered places', { fill: INK, 'font-size': 22, 'font-weight': 800, 'font-family': PF, direction: 'ltr' });
    S2.text(40, 72, 'Numbers refer to the map of the places, from north to south; places that share one label on the map are listed together.', { fill: MUT, 'font-size': 12.5, 'font-family': PF, direction: 'ltr' });
    var cols = [['No.', 46], ['Place', 300], ['Type', 180], ['Governorate', 120], ['Geological zone', 200], ['Coordinates', 174]], x0 = 40, ys = 96, xs = [x0]; cols.forEach(function (c, i) { xs.push(xs[i] + c[1]); });
    S2.add('rect', { x: x0, y: ys, width: W - 80, height: 28, fill: INK }); cols.forEach(function (c, i) { S2.text(xs[i] + 8, ys + 19, c[0], { fill: '#fff', 'font-size': 12.5, 'font-weight': 700, 'font-family': PF, direction: 'ltr' }); }); ys += 28;
    KEY.forEach(function (p, i) { if (i % 2) S2.add('rect', { x: x0, y: ys, width: W - 80, height: 26, fill: '#F6F4EE' });
      mdot(S2, xs[0] + 12, ys + 13, p.cat, 6); S2.text(xs[0] + 24, ys + 17.5, String(i + 1), { fill: INK, 'font-size': 12.5, 'font-weight': 800, 'font-family': PF, direction: 'ltr' });
      [p.en.name + (p.unesco ? ' ★' : ''), enT[p.type], p.gov, ZEN[p.zone], p.lat.toFixed(4) + '° N, ' + p.lon.toFixed(4) + '° E'].forEach(function (v, j) { S2.text(xs[j + 1] + 8, ys + 17.5, fit(v, cols[j + 1][1] - 14), { fill: INK, 'font-size': 12, 'font-family': PF, direction: 'ltr' }); }); ys += 26; });
    S2.line(x0, ys, W - 40, ys, { stroke: INK, 'stroke-width': .8 }); ys += 22; S2.text(40, ys, '★ UNESCO World Heritage site', { fill: MUT, 'font-size': 12, 'font-family': PF, direction: 'ltr' });
    var rest = (LIST.length || P.length) - KEY.length; if (rest > 0) { ys += 20; S2.text(40, ys, rest + ' further places are shown on the map without numbers; the complete list is in the data table.', { fill: MUT, 'font-size': 12, 'font-family': PF, direction: 'ltr' }); }
    var VH = ys + 30; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); bg.setAttribute('height', VH); S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
  }
  function placeSheet(p) {
    var svg = $('#hPSheet'), S2 = SH.svgB(svg), W = 1100, X0 = 96, Y0 = 104, dd = .27, b = { w: p.lon - dd / Math.cos(SH.rad(p.lat)), e: p.lon + dd / Math.cos(SH.rad(p.lat)), s: p.lat - dd, n: p.lat + dd }, f = fitBox(b), PW = 480, PH = PW / f.asp, c = CAT[p.cat][0];
    svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr';
    var bg = S2.add('rect', { x: 0, y: 0, width: W, height: 800, fill: '#fff' }), stripe = S2.add('rect', { x: 0, y: 0, width: 12, height: 800, fill: c });
    S2.text(40, 48, p.en.name, { fill: INK, 'font-size': 23, 'font-weight': 800, 'font-family': PF, direction: 'ltr' });
    S2.text(40, 74, [enT[p.type], p.gov + ' Governorate, Iraq', ZEN[p.zone]].join('   ·   '), { fill: MUT, 'font-size': 13, 'font-family': PF, direction: 'ltr' });
    var cl = clipFor(S2, X0, Y0, PW, PH), imgEl = S2.add('image', { x: X0, y: Y0, width: PW, height: PH, preserveAspectRatio: 'none', 'clip-path': cl });
    var gS = S2.g({ 'clip-path': cl }), F = mapFrame(S2, b, X0, Y0, PW, PH, f.kx);
    P.forEach(function (q) { if (q === p || q.lat < b.s || q.lat > b.n || q.lon < b.w || q.lon > b.e) return; mdot(S2, F.px(q.lon), F.py(q.lat), q.cat, 5.5, gS); });
    var star = function (sx, sy, R1, R2, par) { var s = ''; for (var i = 0; i < 10; i++) { var r = i % 2 ? R2 : R1, an = -Math.PI / 2 + i * Math.PI / 5; s += (i ? 'L' : 'M') + (sx + r * Math.cos(an)).toFixed(1) + ' ' + (sy + r * Math.sin(an)).toFixed(1); } return S2.path(s + 'Z', { fill: '#C0392B', stroke: '#fff', 'stroke-width': 1.5 }, par); };
    star(F.px(p.lon), F.py(p.lat), 15, 6.5, gS);
    var ly = F.bottom + 36; F.tx(X0, ly - 16, 'LEGEND', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1 }); ly += 8; star(X0 + 8, ly - 4, 9, 4); F.tx(X0 + 24, ly + 1, 'This place', { 'font-size': 12 });
    var lx = X0 + 120, used = {}; P.forEach(function (q) { if (q !== p && q.lat >= b.s && q.lat <= b.n && q.lon >= b.w && q.lon <= b.e) used[q.cat] = 1; });
    Object.keys(CAT).filter(function (k) { return used[k]; }).forEach(function (k, i) { var x = lx + (i % 2) * 190, y = ly + Math.floor(i / 2) * 22; mdot(S2, x, y - 4, k, 5.5); F.tx(x + 12, y + 1, CATEN[k], { 'font-size': 12 }); });
    ly += Math.ceil(Object.keys(used).length / 2) * 22 + 6;
    var IX = X0 + PW + 90, iy = Y0 - 4, IW = W - IX - 40, D = FX[p.id] || {}, meas = document.createElement('canvas').getContext('2d'); meas.font = '12px ' + PF;
    var rowsI = [['Coordinates', p.lat.toFixed(5) + '° N, ' + p.lon.toFixed(5) + '° E'], ['Governorate', p.gov], ['Type of place', enT[p.type] + ' (' + CATEN[p.cat].toLowerCase() + ')'], ['Geological zone', ZEN[p.zone]], ['Surface rock', D.rockTxt || ''], ['Elevation', D.el != null ? SH.fmt(D.el, 0) + ' m above sea level' : ''], ['World Heritage', p.unesco || ''], ['Description', p.en.desc], ['Geology', p.en.geo]];
    F.tx(IX, iy + 8, 'DESCRIPTION OF THE PLACE', { 'font-size': 13.5, 'font-weight': 800, 'letter-spacing': .8 }); iy += 22;
    rowsI.forEach(function (r) { if (!r[1]) return; var ln = wrapTxt(meas, String(r[1]), IW - 120), mx = r[0] === 'Description' || r[0] === 'Geology' ? 12 : 4; S2.line(IX, iy, IX + IW, iy, { stroke: '#E2DED3' }); F.tx(IX, iy + 17, r[0], { fill: MUT, 'font-size': 11.5, 'font-weight': 700 }); ln.slice(0, mx).forEach(function (l, k) { F.tx(IX + 120, iy + 17 + k * 16, l + (k === mx - 1 && ln.length > mx ? '…' : ''), { 'font-size': 12 }); }); iy += 12 + Math.min(mx, ln.length) * 16; });
    var VH = Math.max(ly + 30, iy + 30); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); bg.setAttribute('height', VH); stripe.setAttribute('height', VH);
    S2.add('rect', { x: 8, y: 8, width: W - 16, height: VH - 16, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    return baseMap(b, Math.round(PW * 2.2), Math.round(PH * 2.2), 'topo').then(function (u) { if (u) imgEl.setAttribute('href', u); return svg; });
  }
  function exportWide(svg, name, fmt, width) { var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + (width || 1600) + 'px'; var c = svg.cloneNode(true); c.removeAttribute('id'); c.style.cssText = 'display:block;width:' + (width || 1600) + 'px;height:auto;min-width:0'; host.appendChild(c); document.body.appendChild(host);
    return SH.exportFigure(c, name, fmt).then(function (r) { host.remove(); return r; }, function (er) { host.remove(); throw er; }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pl],[data-sheet],[data-key],[data-ps]'); if (!b) return; var fmt = b.getAttribute('data-f') || b.getAttribute('data-sheet') || b.getAttribute('data-key') || b.getAttribute('data-ps'); busyBtn(b, true);
    var done = function () { busyBtn(b, false); }, fail = function () { SH.toast(t('The image could not be created.', 'تعذر إنشاء الصورة.'), 'warn'); }, p;
    if (b.hasAttribute('data-pl')) p = plotCanvas(b.getAttribute('data-pl')).then(function (cv) { return SH.exportCanvas(cv, 'shandal-' + b.getAttribute('data-pl') + '_' + stamp(), fmt); });
    else if (b.hasAttribute('data-sheet')) p = sheet().then(function () { return exportWide($('#hSheet'), 'shandal-iraq-places-map_' + stamp(), fmt, 1650); });
    else if (b.hasAttribute('data-key')) p = exportWide($('#hKey'), 'shandal-iraq-places-key_' + stamp(), fmt, 1650);
    else p = (PS ? placeSheet(PS) : Promise.resolve()).then(function () { return exportWide($('#hPSheet'), 'shandal-place-' + (PS ? PS.id : 'place') + '_' + stamp(), fmt, 1650); });
    p.catch(fail).then(done);
  });

  /* minimal XLSX writer (stored ZIP, inline strings, bold header, frozen first row, RTL in Arabic) */
  function xlsx(name, sheets) {
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); };
    var col = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
    var cell = function (v, r, c, st) { var ref = col(c) + r; if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (st ? ' s="' + st + '"' : '') + '><v>' + v + '</v></c>'; return '<c r="' + ref + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t xml:space="preserve">' + esc(v == null ? '' : v) + '</t></is></c>'; };
    var files = [];
    files.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>']);
    files.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
    files.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(s.name).slice(0, 31) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>']);
    files.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
    files.push(['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B232B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD9D4C7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>']);
    sheets.forEach(function (s, i) {
      var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (AR ? ' rightToLeft="1"' : '') + '><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + s.head.map(function (h, j) { return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + ((s.widths && s.widths[j]) || 16) + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>';
      x += '<row r="1" ht="22" customHeight="1">' + s.head.map(function (h, j) { return cell(h, 1, j, 1); }).join('') + '</row>';
      s.rows.forEach(function (r, k) { x += '<row r="' + (k + 2) + '">' + r.map(function (v, j) { return cell(v, k + 2, j, 2); }).join('') + '</row>'; });
      x += '</sheetData><autoFilter ref="A1:' + col(s.head.length - 1) + (s.rows.length + 1) + '"/></worksheet>'; files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', x]); });
    SH.download(name, zip(files), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  var CRC = (function () { var c, tb = []; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } return tb; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) { var enc = new TextEncoder(), parts = [], cd = [], off = 0, u16 = function (v) { return [v & 255, v >> 8 & 255]; }, u32 = function (v) { return [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255]; };
    files.forEach(function (f) { var nm0 = enc.encode(f[0]), data = enc.encode(f[1]), c = crc32(data); var lh = new Uint8Array([].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(data.length), u32(data.length), u16(nm0.length), u16(0))); parts.push(lh, nm0, data);
      cd.push(new Uint8Array([].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(data.length), u32(data.length), u16(nm0.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm0); off += lh.length + nm0.length + data.length; });
    var cdl = cd.reduce(function (a, b) { return a + b.length; }, 0), end = new Uint8Array([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length), u32(cdl), u32(off), u16(0)));
    return new Blob(parts.concat(cd, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); }

  /* ------------------------------------------------------------------ load */
  SH.getJSON(SH.base + 'assets/data/geoheritage.json').then(function (j) {
    P = j; P.forEach(function (p) { BY[p.id] = p; p._q = norm([p.en.name, p.ar.name, p.en.desc, p.ar.desc, p.en.geo, p.ar.geo, p.gov, GOV[p.gov], TY[p.type][0], enT[p.type], ZONE[p.zone][1]].join(' '));
      if (map) MK[p.id] = L.marker([p.lat, p.lon], { icon: pinIcon(p), title: nm(p), riseOnHover: true }).bindTooltip(E(nm(p)), { direction: 'top', offset: [0, -26] }).on('click', function () { open(p.id, false); }).addTo(map); });
    typeOpts(); refresh(false); tripView();
    var h = decodeURIComponent((location.hash || '').slice(1)); if (h && BY[h]) open(h, true);
  }).catch(function (e) { SH.toast(e.message, 'bad'); });

  /* the PDF report includes the selected place, the overview and the map sheet */
  var rep0 = SH.report; if (rep0) SH.report = function (title) { var d = $('#hDeck'); d.classList.add('gh-print'); var pre = sheet() || Promise.resolve(); return Promise.resolve(pre).then(function () { return rep0(title); }).then(function (r) { d.classList.remove('gh-print'); return r; }, function (er) { d.classList.remove('gh-print'); throw er; }); };
})();
