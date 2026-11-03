/* Faults & Plates of the World — active faults with their kinematics (type, dip, rake, slip rate, seismogenic depth),
   plate boundaries classified by type with their relative velocities, diffuse deformation zones, the plate under any point
   with its velocity from published Euler poles (no-net-rotation frame or relative to a chosen plate), search and filters,
   and the analysis of an area: counts, lengths, slip rates, rose diagram of directions with the Rayleigh test, map sheet
   and GeoJSON / KML / CSV downloads. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', D = SH.dem, C = function (en, ar) { return AR ? ar : en; };
  var BASE = SH.base + 'assets/data/tectonics/';
  var persist = SH.persist('faultsplates', ['fColor', 'fRef', 'fLO']);
  var map = SH.map('fMap', { zoom: 3, base: 'satellite', center: [30, 45], canvas: true });
  var RND = L ? L.canvas({ tolerance: 7, padding: 0.4 }) : null;

  /* ---------------------------------------------------------------- vocabularies */
  var GR = {
    reverse: ['#e03131', 'Reverse and thrust faults', 'فوالق عكسية وزاحفة'], normal: ['#3b7ddd', 'Normal faults', 'فوالق اعتيادية'], dextral: ['#2f9e44', 'Right-lateral strike-slip', 'فوالق مضربية يمينية'],
    sinistral: ['#ae3ec9', 'Left-lateral strike-slip', 'فوالق مضربية يسارية'], strike: ['#12b886', 'Strike-slip, sense not stated', 'فوالق مضربية غير محددة الاتجاه'], subduction: ['#862e9c', 'Subduction megathrusts', 'زحوف اندساسية عملاقة'],
    ridge: ['#f59f00', 'Spreading ridges', 'حيود انتشار'], fold: ['#a0522d', 'Active fold axes', 'محاور طيات نشطة'], unknown: ['#adb5bd', 'Type not stated', 'نوع غير مذكور']
  };
  var TY = { 'Normal': ['normal', 'Normal', 'اعتيادي'], 'Reverse': ['reverse', 'Reverse (thrust)', 'عكسي (زاحف)'], 'Dextral': ['dextral', 'Right-lateral strike-slip', 'مضربي يميني'], 'Sinistral': ['sinistral', 'Left-lateral strike-slip', 'مضربي يساري'],
    'Strike-Slip': ['strike', 'Strike-slip', 'مضربي'], 'Reverse-Strike-Slip': ['reverse', 'Reverse with a strike-slip component', 'عكسي بمركّبة مضربية'], 'Dextral-Reverse': ['dextral', 'Right-lateral with a reverse component', 'مضربي يميني بمركّبة عكسية'],
    'Dextral-Normal': ['dextral', 'Right-lateral with a normal component', 'مضربي يميني بمركّبة اعتيادية'], 'Sinistral-Reverse': ['sinistral', 'Left-lateral with a reverse component', 'مضربي يساري بمركّبة عكسية'],
    'Sinistral-Normal': ['sinistral', 'Left-lateral with a normal component', 'مضربي يساري بمركّبة اعتيادية'], 'Reverse-Dextral': ['reverse', 'Reverse with a right-lateral component', 'عكسي بمركّبة يمينية'],
    'Normal-Dextral': ['normal', 'Normal with a right-lateral component', 'اعتيادي بمركّبة يمينية'], 'Reverse-Sinistral': ['reverse', 'Reverse with a left-lateral component', 'عكسي بمركّبة يسارية'],
    'Normal-Sinistral': ['normal', 'Normal with a left-lateral component', 'اعتيادي بمركّبة يسارية'], 'Normal-Strike-Slip': ['normal', 'Normal with a strike-slip component', 'اعتيادي بمركّبة مضربية'],
    'Dextral-Oblique': ['dextral', 'Oblique right-lateral', 'مضربي يميني مائل'], 'Blind Thrust': ['reverse', 'Blind thrust', 'زحف أعمى'], 'Subduction_Thrust': ['subduction', 'Subduction megathrust', 'زحف اندساسي عملاق'],
    'Spreading_Ridge': ['ridge', 'Spreading ridge', 'حيد انتشار'], 'Dextral_Transform': ['dextral', 'Right-lateral transform', 'تحويلي يميني'], 'Sinistral_Transform': ['sinistral', 'Left-lateral transform', 'تحويلي يساري'],
    'Anticline': ['fold', 'Active anticline axis', 'محور طية محدبة نشطة'], 'Syncline': ['fold', 'Active syncline axis', 'محور طية مقعرة نشطة'], 'null': ['unknown', 'Not stated', 'غير مذكور'] };
  var BC = { SUB: ['#c92a2a', 4.5, 'Subduction zone', 'نطاق اندساس'], CCB: ['#d6336c', 4, 'Continental collision zone', 'نطاق تصادم قاري'], OCB: ['#f76707', 3.5, 'Oceanic convergent boundary', 'حد تقارب محيطي'],
    OSR: ['#fcc419', 3.5, 'Oceanic spreading ridge', 'حيد انتشار محيطي'], CRB: ['#ff922b', 3.5, 'Continental rift', 'أخدود قاري (خسف)'], OTF: ['#22b8cf', 3, 'Oceanic transform fault', 'فالق تحويلي محيطي'], CTF: ['#20c997', 3.5, 'Continental transform fault', 'فالق تحويلي قاري'] };
  var RATE = [[0.2, '#ced4da'], [1, '#74c0fc'], [5, '#4263eb'], [10, '#f59f00'], [1e9, '#e03131']];
  var PL = { AF: ['Africa', 'الأفريقية'], nb: ['Nubia (Africa)', 'النوبية (الأفريقية)'], AN: ['Antarctica', 'القطبية الجنوبية'], an: ['Antarctica', 'القطبية الجنوبية'], SO: ['Somalia', 'الصومالية'], sm: ['Somalia', 'الصومالية'], IN: ['India', 'الهندية'], 'in': ['India', 'الهندية'],
    AU: ['Australia', 'الأسترالية'], au: ['Australia', 'الأسترالية'], EU: ['Eurasia', 'الأوراسية'], eu: ['Eurasia', 'الأوراسية'], NA: ['North America', 'أمريكا الشمالية'], na: ['North America', 'أمريكا الشمالية'], SA: ['South America', 'أمريكا الجنوبية'], sa: ['South America', 'أمريكا الجنوبية'],
    NZ: ['Nazca', 'نازكا'], nz: ['Nazca', 'نازكا'], PA: ['Pacific', 'الهادئ'], pa: ['Pacific', 'الهادئ'], AR: ['Arabia', 'العربية'], ar: ['Arabia', 'العربية'], SU: ['Sunda', 'سوندا'], su: ['Sunda', 'سوندا'], TI: ['Timor', 'تيمور'], KE: ['Kermadec', 'كيرماديك'], TO: ['Tonga', 'تونغا'],
    NI: ["Niuafo'ou", 'نيوافوؤو'], WL: ['Woodlark', 'وودلارك'], MO: ['Maoke', 'ماوكي'], SB: ['South Bismarck', 'بسمارك الجنوبية'], SS: ['Solomon Sea', 'بحر سليمان'], NB: ['North Bismarck', 'بسمارك الشمالية'], NH: ['New Hebrides', 'هبريدس الجديدة'], CA: ['Caribbean', 'الكاريبي'], ca: ['Caribbean', 'الكاريبي'],
    CO: ['Cocos', 'كوكوس'], co: ['Cocos', 'كوكوس'], OK: ['Okhotsk', 'أوخوتسك'], JF: ['Juan de Fuca', 'خوان دي فوكا'], jf: ['Juan de Fuca', 'خوان دي فوكا'], AP: ['Altiplano', 'ألتيبلانو'], ND: ['North Andes', 'الأنديز الشمالية'], ON: ['Okinawa', 'أوكيناوا'], PS: ['Philippine Sea', 'بحر الفلبين'], ps: ['Philippine Sea', 'بحر الفلبين'],
    AM: ['Amur', 'آمور'], am: ['Amur', 'آمور'], CL: ['Caroline', 'كارولين'], MA: ['Mariana', 'ماريانا'], FT: ['Futuna', 'فوتونا'], SC: ['Scotia', 'سكوشا'], sc: ['Scotia', 'سكوشا'], SL: ['Shetland', 'شتلاند'], AS: ['Aegean Sea', 'بحر إيجة'], AT: ['Anatolia', 'الأناضول'],
    YA: ['Yangtze', 'اليانغتسي'], yz: ['Yangtze', 'اليانغتسي'], BU: ['Burma', 'بورما'], RI: ['Rivera', 'ريفيرا'], ri: ['Rivera', 'ريفيرا'], BH: ["Bird's Head", 'رأس الطائر'], MS: ['Molucca Sea', 'بحر مولوكا'], BS: ['Banda Sea', 'بحر باندا'], MN: ['Manus', 'مانوس'],
    CR: ['Conway Reef', 'شعاب كونواي'], BR: ['Balmoral Reef', 'شعاب بالمورال'], EA: ['Easter', 'الفصح (إيستر)'], JZ: ['Juan Fernandez', 'خوان فرنانديز'], GP: ['Galapagos', 'غالاباغوس'], SW: ['Sandwich', 'ساندويتش'], sw: ['Sandwich', 'ساندويتش'], PM: ['Panama', 'بنما'],
    lw: ['Lwandle', 'لواندل'], cp: ['Capricorn', 'كابريكورن'], mq: ['Macquarie', 'ماكواري'], sr: ['Sur', 'سور'] };
  var pn = function (c) { var p = PL[c]; return p ? (AR ? 'الصفيحة ' + p[1] : p[0] + ' plate') : c; };
  /* Arabic names of the fault systems that carry an English name in the source */
  var SYS = [[/san andreas/i, 'فالق سان أندرياس'], [/hayward/i, 'فالق هايوارد'], [/calaveras/i, 'فالق كالافيراس'], [/garlock/i, 'فالق غارلوك'], [/san jacinto/i, 'فالق سان خاسينتو'], [/elsinore/i, 'فالق إلسينور'], [/imperial/i, 'فالق إمبريال'], [/cerro prieto/i, 'فالق سيرو بريتو'],
    [/san gregorio/i, 'فالق سان غريغوريو'], [/hosgri/i, 'فالق هوسغري'], [/maacama/i, 'فالق ماكاما'], [/wasatch/i, 'فالق واساتش'], [/new madrid/i, 'نطاق نيو مدريد'], [/denali/i, 'فالق دينالي'], [/queen charlotte|fairweather/i, 'فالق الملكة شارلوت–فيرويذر'], [/cascadia/i, 'نطاق اندساس كاسكاديا'],
    [/middle america trench/i, 'زحف خندق أمريكا الوسطى'], [/motagua/i, 'فالق موتاغوا'], [/polochic/i, 'فالق بولوتشيك'], [/enriquillo/i, 'فالق إنريكيو–بلانتين غاردن'], [/septentrional/i, 'فالق سبتنتريونال'], [/oriente/i, 'فالق أورينتي'], [/swan islands/i, 'فالق جزر سوان التحويلي'],
    [/antilles/i, 'زحف الأنتيل'], [/north caribbean/i, 'الزحف الكاريبي الشمالي'], [/muertos/i, 'زحف مويرتوس'], [/bocon/i, 'فالق بوكونو'], [/el pilar/i, 'فالق إل بيلار'], [/romeral/i, 'فالق روميرال'], [/guayaquil|algeciras/i, 'منظومة فالق غواياكيل–ألخيسيراس'],
    [/atacama/i, 'فالق أتاكاما'], [/liqui|ofqui/i, 'فالق ليكينيه–أوفكي'], [/fagnano|magallanes/i, 'فالق ماجلان–فانيانو'], [/^alpine/i, 'الفالق الألبي'], [/hikurangi/i, 'زحف هيكورانغي'], [/wellington/i, 'فالق ولينغتون'], [/wairarapa/i, 'فالق وايرارابا'], [/puysegur/i, 'زحف بويسيغور'],
    [/hope fault|^hope|awatere|clarence|wairau/i, 'منظومة فوالق مارلبورو'], [/philippine/i, 'فالق الفلبين'], [/median tectonic/i, 'الخط التكتوني الأوسط'], [/itoigawa/i, 'خط إيتويغاوا–شيزوكا'], [/longmen/i, 'فالق لونغمنشان'], [/xian(g)?shuihe/i, 'منظومة فالق شيانشويخه–شياوجيانغ'], [/stanovoy/i, 'منظومة فالق ستانوفوي'], [/dauki/i, 'زحف داوكي'], [/matano/i, 'فالق ماتانو'], [/morrocoy/i, 'نطاق فالق موروكوي'], [/panama fault/i, 'نطاق فالق جنوب بنما'],
    [/haiyuan/i, 'فالق هاييوان'], [/kunlun/i, 'فالق كونلون'], [/altyn|altun/i, 'فالق ألتين تاغ'], [/karakoram/i, 'فالق قراقورم'], [/red river/i, 'فالق النهر الأحمر'], [/sagaing/i, 'فالق ساغاينغ'], [/sumatra|semangko/i, 'فالق سومطرة العظيم'],
    [/main frontal|main himalayan|main boundary thrust/i, 'الزحف الهيمالايي الرئيس'], [/salt range/i, 'فالق سولت رينج الأمامي'], [/main pamir/i, 'زحف بامير الرئيس'], [/talas.?fergana/i, 'فالق تالاس–فرغانة'], [/chaman/i, 'فالق شامان'], [/herat/i, 'فالق هرات'],
    [/makran/i, 'حزام زحف مكران'], [/north anatolian/i, 'فالق الأناضول الشمالي'], [/east anatolian/i, 'فالق الأناضول الشرقي'], [/dead sea|jordan valley|wadi araba|yammouneh/i, 'منظومة فالق البحر الميت التحويلي'], [/main recent/i, 'الفالق الحديث الرئيس (الزاكروس)'], [/zagros/i, 'فالق الزاكروس'],
    [/kazerun/i, 'فالق كازرون'], [/minab/i, 'فالق ميناب'], [/north tabriz/i, 'فالق تبريز الشمالي'], [/doruneh/i, 'فالق دورونه'], [/nayband/i, 'فالق نايبند'], [/gowk/i, 'فالق غوك'], [/bulnay/i, 'فالق بولناي'], [/hovd|khovd/i, 'فالق خوفد'],
    [/tunka/i, 'فالق تونكا'], [/sayan/i, 'فالق سايان'], [/baikal/i, 'فالق بايكال'], [/atlas/i, 'فالق الأطلس'], [/nekor/i, 'فالق النكور'], [/mitidja/i, 'زحف متيجة'], [/durba|araba/i, 'فالق ضربة–عربة'], [/south sinai/i, 'فالق كتلة جنوب سيناء'],
    [/sinai/i, 'فالق كتلة سيناء'], [/nezzazat/i, 'فالق النزازات'], [/hammam faroun/i, 'فالق حمام فرعون'], [/kalabsha/i, 'فالق كلابشة'], [/st\.? anthony/i, 'فالق القديس أنطونيوس'], [/hadahid/i, 'فالق الهدهد'], [/markha/i, 'فالق مرخة–بابا التحويلي'],
    [/longitudinal valley/i, 'فالق الوادي الطولي'], [/chelungpu/i, 'فالق تشيلونغبو'], [/mendocino/i, 'فالق مندوسينو'], [/blanco/i, 'فالق بلانكو'], [/owens valley/i, 'فالق وادي أوينز'], [/death valley/i, 'فالق وادي الموت'], [/walker lane/i, 'نطاق ووكر لين'],
    [/teton/i, 'فالق تيتون'], [/rio grande/i, 'أخدود ريو غراندي'], [/east african|kenya rift|ethiopian rift/i, 'منظومة الأخدود الأفريقي العظيم'], [/tanganyika/i, 'فالق تنجانيقا'], [/malawi|nyasa/i, 'فالق ملاوي'], [/rhine/i, 'أخدود الراين'],
    [/corinth/i, 'فالق خليج كورنث'], [/hellenic/i, 'القوس الهيليني'], [/calabria/i, 'قوس كالابريا'], [/apennine/i, 'فوالق الأبينيني'], [/pyrenee/i, 'فوالق البرانس'], [/alboran/i, 'فوالق بحر البوران'], [/gloria/i, 'فالق غلوريا التحويلي']];
  var arName = function (n) { if (!n) return ''; for (var i = 0; i < SYS.length; i++) if (SYS[i][0].test(n)) return SYS[i][1]; return ''; };

  /* ---------------------------------------------------------------- state */
  var DATA = null, FL = [], groups = {}, typeOn = {}, BL = [], plates = [], labels = null, layF = null, layB = null, layO = null, layI = null, area = null, areaLay = null, hilite = null, arrow = null, drawer = null;
  Object.keys(GR).forEach(function (g) { typeOn[g] = true; });
  var sv = SH.store.get('shandal_fp_types', null); if (sv) Object.keys(sv).forEach(function (g) { if (g in typeOn) typeOn[g] = sv[g]; });
  if (map && AR) { var scl = map.getContainer().querySelector('.leaflet-control-scale'), brc = map.getContainer().querySelector('.leaflet-bottom.leaflet-right'); if (scl && brc) brc.insertBefore(scl, brc.firstChild); }

  /* ---------------------------------------------------------------- geometry helpers */
  var hav = function (a, b) { var p1 = SH.rad(a[1]), p2 = SH.rad(b[1]), dl = SH.rad(b[0] - a[0]), h = Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2); return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h))); };
  var brg = function (a, b) { var p1 = SH.rad(a[1]), p2 = SH.rad(b[1]), dl = SH.rad(b[0] - a[0]); return (SH.deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360; };
  var wr = function (d) { return ((d + 180) % 360 + 360) % 360 - 180; };
  function decode(g, k) { var out = []; for (var i = 0; i < g.length; i += 2) out.push([g[i] / k, g[i + 1] / k]); return out; } /* [lon, lat] */
  function unwrap(pts) { var o = [pts[0].slice()]; for (var i = 1; i < pts.length; i++) { var lo = pts[i][0]; while (lo - o[i - 1][0] > 180) lo -= 360; while (lo - o[i - 1][0] < -180) lo += 360; o.push([lo, pts[i][1]]); } return o; }
  var ll = function (pts) { return unwrap(pts).map(function (q) { return [q[1], q[0]]; }); };
  var p3 = function (v) { v = Math.round(v) % 360; return (v < 10 ? '00' : v < 100 ? '0' : '') + v; };

  /* ---------------------------------------------------------------- styles and legend */
  function color(f) { if (SH.val('fColor') === 'rate') { var r = f.sr && f.sr[0] != null ? f.sr[0] : null; if (r == null) return '#868e96'; for (var i = 0; i < RATE.length; i++) if (r < RATE[i][0]) return RATE[i][1]; } return GR[f.grp][0]; }
  function fstyle(f) { return { renderer: RND, color: color(f), weight: f.grp === 'subduction' || f.grp === 'ridge' ? 2.6 : 1.9, opacity: 0.95, dashArray: f.grp === 'fold' ? '5 4' : null, bubblingMouseEvents: false }; }
  var legOpen = null;
  function legend() {
    var h = '';
    if ($('#fLF').checked) { h += '<b>' + t('Active faults', 'الفوالق النشطة') + '</b>';
      if (SH.val('fColor') === 'rate') h += RATE.map(function (r, i) { return '<div class="r"><i style="background:' + r[1] + '"></i><span class="ltr">' + (i ? '≥ ' + RATE[i - 1][0] : '< ' + RATE[0][0]) + (i < RATE.length - 1 && i ? ' – ' + r[0] : '') + ' ' + t('mm/yr', 'ملم/سنة') + '</span></div>'; }).join('') + '<div class="r"><i style="background:#868e96"></i><span>' + t('Rate not stated', 'المعدل غير مذكور') + '</span></div>';
      else h += Object.keys(GR).filter(function (g) { return groups[g] && typeOn[g]; }).map(function (g) { return '<div class="r"><i style="background:' + GR[g][0] + (g === 'fold' ? ';background:repeating-linear-gradient(90deg,' + GR[g][0] + ' 0 5px,transparent 5px 8px)' : '') + '"></i><span>' + (AR ? GR[g][2] : GR[g][1]) + '</span></div>'; }).join(''); }
    if ($('#fLB').checked) { h += '<b>' + t('Plate boundaries', 'حدود الصفائح') + '</b>' + Object.keys(BC).map(function (k) { return '<div class="r"><i style="background:' + BC[k][0] + ';height:' + Math.round(BC[k][1]) + 'px"></i><span>' + (AR ? BC[k][3] : BC[k][2]) + '</span></div>'; }).join(''); }
    if ($('#fLO').checked) h += '<div class="r"><i style="background:rgba(255,212,59,.35);height:12px;border:1px dashed #e67700"></i><span>' + t('Diffuse deformation zone', 'نطاق تشوه منتشر') + '</span></div>';
    if (layI && $('#fLI').checked) h += '<div class="r"><i style="background:#111;height:3px"></i><span>' + t('Fault of Iraq (Shandal compilation)', 'فالق في العراق (تجميع نظام شندل)') + '</span></div>';
    var open = legOpen == null ? window.innerWidth >= 700 : legOpen;
    $('#fLeg').innerHTML = '<button type="button" id="fLegT" style="all:unset;cursor:pointer;font-weight:800;display:flex;gap:6px;align-items:center">' + t('Legend', 'مفتاح الخريطة') + ' <span aria-hidden="true">' + (open ? '▾' : '▸') + '</span></button>' + (open ? (h || '<span class="muted">' + t('No layer shown.', 'لا توجد طبقة معروضة.') + '</span>') : ''); $('#fLeg').hidden = false;
  }

  /* ---------------------------------------------------------------- popups */
  var fmtT = function (tup, u, dp) { if (!tup || tup[0] == null) return null; var s = SH.fmt(tup[0], dp); if (tup[1] != null && tup[2] != null && Math.abs(tup[2] - tup[1]) > 1e-9) s += ' (' + SH.fmt(tup[1], dp) + '–' + SH.fmt(tup[2], dp) + ')'; return '<span class="ltr">' + s + (u ? (u === '°' ? '' : ' ') + u : '') + '</span>'; };
  var DIRS = { N: ['north', 'الشمال'], NE: ['north-east', 'الشمال الشرقي'], E: ['east', 'الشرق'], SE: ['south-east', 'الجنوب الشرقي'], S: ['south', 'الجنوب'], SW: ['south-west', 'الجنوب الغربي'], W: ['west', 'الغرب'], NW: ['north-west', 'الشمال الغربي'] };
  function fpop(f) {
    var ty = TY[f.ty] || TY['null'], ar = f.ar || (t('', 'فالق ') + (AR ? ty[2] : '')), rows = [], row = function (k, v) { if (v != null && v !== '') rows.push('<tr><td>' + k + '</td><td class="v">' + v + '</td></tr>'); };
    row(t('Type of movement', 'نوع الحركة'), AR ? ty[2] + ' <span class="muted ltr">(' + ty[1] + ')</span>' : ty[1]);
    row(t('Dip', 'الميل'), f.dip && f.dip[0] != null ? fmtT(f.dip, '°', 0) + (f.dd ? ' ' + t('toward ', 'نحو ') + (DIRS[f.dd] ? (AR ? DIRS[f.dd][1] : DIRS[f.dd][0]) : f.dd) : '') : null);
    row(t('Rake', 'زاوية الخدش (Rake)'), fmtT(f.rk, '°', 0));
    row(t('Slip rate', 'معدل الانزلاق'), fmtT(f.sr, t('mm/yr', 'ملم/سنة'), 2));
    row(t('Seismogenic depth', 'العمق المولّد للزلازل'), f.ud != null || f.ld != null ? '<span class="ltr">' + (f.ud != null ? SH.fmt(f.ud, 0) : '?') + '–' + (f.ld != null ? SH.fmt(f.ld, 0) : '?') + ' km</span>' : null);
    row(t('Length of the trace', 'طول الأثر'), '<span class="ltr">' + SH.fmt(f.L, 1) + ' km</span>');
    row(t('General trend', 'الاتجاه العام'), '<span class="ltr">' + p3(f.az) + '° – ' + p3(f.az + 180) + '°</span>');
    var nNote = f.na ? '<div class="muted" style="font-size:.72rem">' + t('Segment named from its position on the known trace of the system.', 'جزء سُمّي من موقعه على المسار المعروف للمنظومة.') + '</div>' : '';
    var title = f.n ? (AR ? '<div class="ar">' + (f.ar || t('', 'فالق ') + ty[2]) + '</div><div class="en">' + SH.esc(f.n) + '</div>' : '<div class="ar">' + SH.esc(f.n) + '</div>' + (f.ar ? '<div class="muted" dir="rtl" style="text-align:right">' + f.ar + '</div>' : ''))
      : '<div class="ar">' + (AR ? 'فالق ' + ty[2] : ty[1] + ' fault') + '</div><div class="muted">' + t('Unnamed in the source catalogue', 'غير مسمّى في المصدر') + '</div>';
    return '<div class="fp-pop">' + title + nNote + '<table>' + rows.join('') + '</table></div>';
  }
  function bpop(b) {
    var m = /^([A-Z]{2})\W([A-Z]{2})$/.exec(b.p) || [0, b.p, ''], k = BC[b.c] || ['#999', 2, b.c, b.c];
    var conv = b.di < 0, rl = b.ri;
    return '<div class="fp-pop"><div class="ar">' + (AR ? k[3] : k[2]) + '</div><div class="muted">' + pn(m[1]) + ' / ' + pn(m[2]) + '</div><table>' +
      '<tr><td>' + t('Relative velocity', 'السرعة النسبية') + '</td><td class="v"><span class="ltr">' + SH.fmt(b.v, 1) + ' ' + t('mm/yr', 'ملم/سنة') + '</span>' + (b.vmax - b.vmin > 1 ? ' <span class="muted ltr">(' + SH.fmt(b.vmin, 1) + '–' + SH.fmt(b.vmax, 1) + ')</span>' : '') + '</td></tr>' +
      '<tr><td>' + (conv ? t('Convergence', 'التقارب') : t('Opening', 'الانفتاح')) + '</td><td class="v"><span class="ltr">' + SH.fmt(Math.abs(b.di), 1) + ' ' + t('mm/yr', 'ملم/سنة') + '</span></td></tr>' +
      '<tr><td>' + t('Strike-slip component', 'المركّبة المضربية') + '</td><td class="v"><span class="ltr">' + SH.fmt(Math.abs(rl), 1) + ' ' + t('mm/yr', 'ملم/سنة') + '</span> ' + (Math.abs(rl) < 0.5 ? '' : rl > 0 ? t('right-lateral', 'يمينية') : t('left-lateral', 'يسارية')) + '</td></tr>' +
      '<tr><td>' + t('Length of this section', 'طول هذا الجزء') + '</td><td class="v"><span class="ltr">' + SH.fmt(b.L, 0) + ' km</span></td></tr>' + (b.o ? '<tr><td colspan="2" class="muted">' + t('Inside a diffuse deformation zone: the motion is shared by many faults.', 'داخل نطاق تشوه منتشر: تتوزع الحركة على فوالق كثيرة.') + '</td></tr>' : '') + '</table></div>';
  }

  /* ---------------------------------------------------------------- loading */
  Promise.all([SH.getJSON(BASE + 'faults.json', { timeout: 60000 }), SH.getJSON(BASE + 'boundaries.json'), SH.getJSON(BASE + 'plates.json'), SH.getJSON(BASE + 'orogens.json')]).then(function (r) {
    DATA = r[0]; var types = DATA.types;
    FL = DATA.f.map(function (f, i) { var ty = types[f.t], g = (TY[ty] || TY['null'])[0]; groups[g] = (groups[g] || 0) + 1; f.i = i; f.ty = ty; f.grp = g; f.ar = arName(f.n); f.pts = f.g.map(function (s) { return decode(s, 1e4); }); f.key = ((f.n || '') + ' ' + f.ar).toLowerCase(); return f; });
    BL = r[1].map(function (b) { b.pts = decode(b.g, 1e3); return b; }); plates = r[2]; buildPlates(r[2]); buildOro(r[3]); chips(); refs(); build(); legend();
    $('#fStat').innerHTML = '<span class="ltr">' + SH.fmt(FL.length, 0) + '</span> ' + t('active faults', 'فالقاً نشطاً') + ' · <span class="ltr">' + SH.fmt(FL.filter(function (f) { return f.n; }).length, 0) + '</span> ' + t('named', 'مسمّى') + ' · <span class="ltr">' + plates.length + '</span> ' + t('plates', 'صفيحة');
    SH.getJSON(BASE + 'iraq-faults.json').then(iraq, function () {}); search();
  }).catch(function (e) { $('#fStat').textContent = e.message; SH.toast(e.message, 'bad'); });

  function build() {
    if (!map) return; if (layF) map.removeLayer(layF); if (layB) map.removeLayer(layB);
    layB = L.layerGroup(); BL.forEach(function (b) { var k = BC[b.c] || ['#999', 2]; var pl = L.polyline(ll(b.pts), { renderer: RND, color: k[0], weight: k[1], opacity: 0.9, bubblingMouseEvents: false }); pl.bindPopup(function () { return bpop(b); }, { maxWidth: 340 }); pl.addTo(layB); b.layer = pl; });
    layF = L.layerGroup(); var minR = +SH.val('fRate'), n = 0;
    FL.forEach(function (f) { f.vis = typeOn[f.grp] && (!minR || (f.sr && f.sr[0] != null && f.sr[0] >= minR)); if (!f.vis) return; n++;
      f.pts.forEach(function (pts) { var pl = L.polyline(ll(pts), fstyle(f)); pl.bindPopup(function () { return fpop(f); }, { maxWidth: 340 }); pl.addTo(layF); }); });
    if ($('#fLB').checked) layB.addTo(map); if ($('#fLF').checked) layF.addTo(map);
    if (layI && $('#fLI').checked) layI.bringToFront && layI.eachLayer(function (l) { l.bringToFront(); });
    return n;
  }
  function buildPlates(P) {
    if (!map) return; labels = L.layerGroup();
    P.forEach(function (p) { var r = p.g[0], lat = 0, lon = 0; r.forEach(function (q) { lat += q[1]; lon += q[0]; }); lat /= r.length; lon /= r.length;
      if (p.pole && p.pole[0] === 1) { lat = 48; lon = -100; } else if (p.pole && p.pole[0] === -1) { lat = -78; lon = 30; }
      if (!plateAt(lat, wr(lon)) || plateAt(lat, wr(lon)).c !== p.c) { var best = null; r.forEach(function (q) { var a = [q[1] * 0.7 + lat * 0.3, q[0] * 0.7 + lon * 0.3]; if (!best && plateAt(a[0], wr(a[1])) && plateAt(a[0], wr(a[1])).c === p.c) best = a; }); if (best) { lat = best[0]; lon = best[1]; } }
      p.lab = [lat, wr(lon)]; var big = /^(nb|an|ar|au|ca|co|eu|in|jf|na|nz|pa|ps|sa|sc|sm|su|am|yz|cp|lw)$/.test(p.c);
      var mk = L.marker(p.lab, { interactive: false, icon: L.divIcon({ className: '', html: '<div style="transform:translate(-50%,-50%);white-space:nowrap;font:800 ' + (big ? 13 : 10.5) + 'px/1.2 \'IBM Plex Sans Arabic\',Manrope,sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 6px #000;letter-spacing:.3px">' + SH.esc(pn(p.c)) + '</div>', iconSize: [0, 0] }) }); mk._big = big; mk.addTo(labels); });
    var upd = function () { var z = map.getZoom(); labels.eachLayer(function (m) { var show = $('#fLP').checked && z <= 7 && (m._big || z >= 4); var el = m.getElement && m.getElement(); if (el) el.style.display = show ? '' : 'none'; }); };
    labels.addTo(map); map.on('zoomend', upd); $('#fLP').addEventListener('change', upd); setTimeout(upd, 50);
  }
  function buildOro(O) { if (!map) return; layO = L.layerGroup(); O.forEach(function (o) { o.g.forEach(function (ring) { L.polygon(ll(ring), { renderer: RND, color: '#e67700', weight: 1, dashArray: '4 4', fillColor: '#ffd43b', fillOpacity: 0.18, interactive: false }).addTo(layO); }); }); if ($('#fLO').checked) layO.addTo(map); }
  function iraq(gj) { if (!map || !gj || !(gj.features || []).length) return; $('#fLIw').hidden = false;
    layI = L.geoJSON(gj, { renderer: RND, style: function () { return { color: '#111', weight: 2.6, opacity: 1 }; }, onEachFeature: function (ft, l) { var p = ft.properties || {}; l.options.bubblingMouseEvents = false; l.bindPopup('<div class="fp-pop"><div class="ar">' + SH.esc(AR ? p.name_ar || p.name_en || '' : p.name_en || p.name_ar || '') + '</div><div class="muted">' + SH.esc(AR ? p.name_en || '' : p.name_ar || '') + '</div><table>' + ['type', 'dip', 'zone', 'certainty', 'activity', 'source'].filter(function (k) { return p[k]; }).map(function (k) { return '<tr><td>' + k + '</td><td class="v">' + SH.esc(p[k]) + '</td></tr>'; }).join('') + '</table></div>'); } });
    if ($('#fLI').checked) layI.addTo(map); legend(); }
  $('#fLeg').addEventListener('click', function (e) { if (e.target.closest('#fLegT')) { legOpen = !(legOpen == null ? window.innerWidth >= 700 : legOpen); legend(); } });
  ['fLF', 'fLB', 'fLO', 'fLI'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var lay = { fLF: layF, fLB: layB, fLO: layO, fLI: layI }[id]; if (lay && map) { if (this.checked) lay.addTo(map); else map.removeLayer(lay); } persist.save(); legend(); }); });
  $('#fColor').addEventListener('change', function () { persist.save(); build(); legend(); });

  /* ---------------------------------------------------------------- type chips, rate filter and search */
  function chips() { $('#fTypes').innerHTML = Object.keys(GR).filter(function (g) { return groups[g]; }).map(function (g) { return '<button type="button" data-g="' + g + '" aria-pressed="' + typeOn[g] + '"><i style="background:' + GR[g][0] + '"></i>' + (AR ? GR[g][2] : GR[g][1]) + ' <span class="muted ltr">' + SH.fmt(groups[g], 0) + '</span></button>'; }).join(''); }
  $('#fTypes').addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (!b) return; var g = b.getAttribute('data-g'); typeOn[g] = !typeOn[g]; b.setAttribute('aria-pressed', typeOn[g]); SH.store.set('shandal_fp_types', typeOn); build(); legend(); search(); });
  $('#fRate').addEventListener('input', function () { $('#fRateV').textContent = SH.fmt(+this.value, 1) + ' ' + t('mm/yr', 'ملم/سنة'); });
  $('#fRate').addEventListener('change', function () { build(); search(); });
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْ]/g, ''); };
  function search() {
    if (!DATA) return; var q = norm(SH.val('fQ').trim()), box = $('#fHits');
    if (q.length < 2) { box.innerHTML = '<span class="xsmall muted">' + t('Type at least two letters. Tap a result to fly to the fault.', 'اكتب حرفين على الأقل. انقر نتيجة للانتقال إلى الفالق.') + '</span>'; return; }
    var hits = FL.filter(function (f) { return f.vis && norm(f.key).indexOf(q) >= 0; }).sort(function (a, b) { return b.L - a.L; }).slice(0, 60);
    box.innerHTML = hits.length ? hits.map(function (f) { return '<button type="button" data-i="' + f.i + '"><i style="display:inline-block;width:14px;height:4px;border-radius:2px;background:' + color(f) + '"></i><span>' + (AR && f.ar ? f.ar + '<br><small class="ltr">' + SH.esc(f.n) + '</small>' : SH.esc(f.n) + (f.ar ? '<br><small dir="rtl">' + f.ar + '</small>' : '')) + '</span><small class="ltr">' + SH.fmt(f.L, 0) + ' km</small></button>'; }).join('') : '<span class="xsmall muted">' + t('No fault by that name among the faults shown.', 'لا يوجد فالق بهذا الاسم بين الفوالق المعروضة.') + '</span>';
  }
  var st; $('#fQ').addEventListener('input', function () { clearTimeout(st); st = setTimeout(search, 180); });
  $('#fHits').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b || !map) return; var f = FL[+b.getAttribute('data-i')]; if (hilite) map.removeLayer(hilite);
    hilite = L.layerGroup(f.pts.map(function (p) { return L.polyline(ll(p), { renderer: RND, color: '#ffe066', weight: 7, opacity: 0.85, interactive: false }); })).addTo(map);
    var bb = L.latLngBounds([]); f.pts.forEach(function (p) { ll(p).forEach(function (q) { bb.extend(q); }); }); map.fitBounds(bb.pad(0.6), { maxZoom: 10 });
    if (layF) layF.eachLayer(function (l) { l.bringToFront(); }); setTimeout(function () { L.popup({ maxWidth: 340 }).setLatLng(bb.getCenter()).setContent(fpop(f)).openOn(map); }, 450);
    if (window.innerWidth < 900) $('#fMap').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  /* ---------------------------------------------------------------- plate under a point and its velocity (Euler poles, no-net-rotation frame) */
  function inRing(r, pole, lat, lon) { var cr = 0; for (var i = 0; i < r.length; i++) { var a = r[i === 0 ? r.length - 1 : i - 1], b = r[i], da = wr(a[0] - lon), db = wr(b[0] - lon), dl = wr(b[0] - a[0]); if (Math.abs(dl) >= 180) continue;
      if ((da < 0) !== (db < 0) && Math.abs(da - db) < 180) { var y = a[1] + da / (da - db) * (b[1] - a[1]); if ((pole >= 0 && y > lat) || (pole < 0 && y < lat)) cr++; } } return pole ? cr % 2 === 0 : cr % 2 === 1; }
  function plateAt(lat, lon) { for (var i = 0; i < plates.length; i++) { var p = plates[i]; for (var j = 0; j < p.g.length; j++) if (inRing(p.g[j], p.pole ? p.pole[j] : 0, lat, lon)) return p; } return null; }
  function vel(p, lat, lon) { var w = SH.rad(p.w) / 1e6, la = SH.rad(p.lat), lo = SH.rad(p.lon), W = [w * Math.cos(la) * Math.cos(lo), w * Math.cos(la) * Math.sin(lo), w * Math.sin(la)], R = 6371008.8e3, ph = SH.rad(lat), lm = SH.rad(lon);
    var r = [R * Math.cos(ph) * Math.cos(lm), R * Math.cos(ph) * Math.sin(lm), R * Math.sin(ph)], v = [W[1] * r[2] - W[2] * r[1], W[2] * r[0] - W[0] * r[2], W[0] * r[1] - W[1] * r[0]];
    return { e: -Math.sin(lm) * v[0] + Math.cos(lm) * v[1], n: -Math.sin(ph) * Math.cos(lm) * v[0] - Math.sin(ph) * Math.sin(lm) * v[1] + Math.cos(ph) * v[2] }; } /* mm/yr */
  function refs() { var o = '<option value="nnr">' + t('Whole lithosphere (no net rotation)', 'الغلاف الصخري كله (بلا دوران صافٍ)') + '</option>' + plates.filter(function (p) { return /^[a-z]/.test(p.c); }).sort(function (a, b) { return pn(a.c).localeCompare(pn(b.c)); }).map(function (p) { return '<option value="' + p.c + '">' + SH.esc(pn(p.c)) + ' ' + t('fixed', 'ثابتة') + '</option>'; }).join('');
    var cur = SH.store.get('shandal_tool_faultsplates', {}).fRef; $('#fRef').innerHTML = o; if (cur && $('#fRef').querySelector('option[value="' + cur + '"]')) $('#fRef').value = cur; }
  var lastPt = null;
  function point(lat, lon) {
    lastPt = [lat, lon]; lon = wr(lon); var p = plateAt(lat, lon), box = $('#fPt'); if (!p) { box.innerHTML = '<span class="xsmall muted">' + t('No plate found at this point.', 'لم توجد صفيحة عند هذه النقطة.') + '</span>'; return; }
    var v = vel(p, lat, lon), ref = SH.val('fRef'), rp = ref !== 'nnr' ? plates.filter(function (q) { return q.c === ref; })[0] : null; if (rp) { var v2 = vel(rp, lat, lon); v = { e: v.e - v2.e, n: v.n - v2.n }; }
    var sp = Math.hypot(v.e, v.n), az = (SH.deg(Math.atan2(v.e, v.n)) + 360) % 360;
    var near = FL.map(function (f) { if (!f.vis) return null; var dmin = 1e9; f.pts.forEach(function (pts) { for (var k = 0; k < pts.length; k++) { var dy = (pts[k][1] - lat) * 111.2, dx = wr(pts[k][0] - lon) * 111.2 * Math.cos(SH.rad(lat)), d = Math.hypot(dx, dy); if (d < dmin) dmin = d; } }); return dmin <= 50 ? { f: f, d: dmin } : null; }).filter(Boolean).sort(function (a, b) { return a.d - b.d; }).slice(0, 8);
    box.innerHTML = '<div class="fp-card"><b class="h">' + SH.esc(pn(p.c)) + '</b><span class="ltr xsmall muted">' + SH.fmtLatLon(lat, lon, 3) + '</span><table class="fp-tbl">' +
      '<tr><td>' + t('Speed', 'السرعة') + '</td><td class="num"><b class="ltr">' + SH.fmt(sp, 1) + ' ' + t('mm/yr', 'ملم/سنة') + '</b></td></tr><tr><td>' + t('Direction (azimuth)', 'الاتجاه (السمت)') + '</td><td class="num"><b class="ltr">' + p3(az) + '°</b></td></tr>' +
      '<tr><td>' + t('North · east components', 'المركّبتان شمالاً · شرقاً') + '</td><td class="num"><span class="ltr">' + SH.fmt(v.n, 1) + ' · ' + SH.fmt(v.e, 1) + '</span></td></tr><tr><td>' + t('Movement in 1 000 years', 'الإزاحة في 1000 سنة') + '</td><td class="num"><span class="ltr">' + SH.fmt(sp, 0) + ' m</span></td></tr></table>' +
      '<span class="xsmall muted">' + (rp ? t('Relative to the ', 'نسبةً إلى ') + SH.esc(pn(rp.c)) + t(' held fixed.', ' بعد تثبيتها.') : t('In the no-net-rotation frame: the motion of the plate as a rigid cap, without local deformation.', 'في إطار انعدام الدوران الصافي: حركة الصفيحة ككتلة صلبة، دون التشوه المحلي.')) + '</span>' +
      (near.length ? '<b style="margin-top:4px">' + t('Faults within 50 km', 'الفوالق ضمن 50 كم') + '</b><div class="fp-hits">' + near.map(function (x) { var f = x.f, ty = TY[f.ty] || TY['null']; return '<button type="button" data-i="' + f.i + '"><i style="display:inline-block;width:14px;height:4px;border-radius:2px;background:' + color(f) + '"></i><span>' + (f.n ? SH.esc(AR && f.ar ? f.ar : f.n) : (AR ? 'فالق ' + ty[2] : ty[1] + ' fault')) + '</span><small class="ltr">' + SH.fmt(x.d, 1) + ' km</small></button>'; }).join('') + '</div>' : '<span class="xsmall muted">' + t('No mapped active fault within 50 km.', 'لا يوجد فالق نشط مرسوم ضمن 50 كم.') + '</span>') + '</div>';
    if (map) L.popup({ maxWidth: 260, offset: [0, -6] }).setLatLng([lat, lon]).setContent('<div class="fp-pop"><div class="ar">' + SH.esc(pn(p.c)) + '</div><span class="ltr"><b>' + SH.fmt(sp, 1) + '</b> ' + t('mm/yr', 'ملم/سنة') + ' · ' + p3(az) + '°</span><div class="muted">' + (rp ? t('relative to the ', 'نسبةً إلى ') + SH.esc(pn(rp.c)) : t('no-net-rotation frame', 'إطار انعدام الدوران الصافي')) + (near.length ? ' · ' + near.length + t(' faults within 50 km', ' فالقاً ضمن 50 كم') : '') + '</div></div>').openOn(map);
    if (map) { if (arrow) map.removeLayer(arrow); var len = SH.clamp(sp * 2.2, 18, 140);
      arrow = L.marker([lat, lon], { interactive: false, icon: L.divIcon({ className: 'fp-arrow', iconSize: [0, 0], html: '<svg width="' + (2 * len + 20) + '" height="' + (2 * len + 20) + '" style="position:absolute;left:' + (-len - 10) + 'px;top:' + (-len - 10) + 'px;overflow:visible"><g transform="translate(' + (len + 10) + ' ' + (len + 10) + ') rotate(' + az + ')"><line x1="0" y1="0" x2="0" y2="' + (-len) + '" stroke="#fff" stroke-width="6"/><line x1="0" y1="0" x2="0" y2="' + (-len) + '" stroke="#111" stroke-width="3"/><path d="M0 ' + (-len - 9) + ' L-7 ' + (-len + 5) + ' L7 ' + (-len + 5) + 'Z" fill="#111" stroke="#fff" stroke-width="1.5"/><circle r="4.5" fill="#ffd60a" stroke="#111" stroke-width="1.5"/></g></svg>' }) }).addTo(map); }
  }
  $('#fPt').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (!b || !map) return; var f = FL[+b.getAttribute('data-i')]; if (hilite) map.removeLayer(hilite); hilite = L.layerGroup(f.pts.map(function (p) { return L.polyline(ll(p), { renderer: RND, color: '#ffe066', weight: 7, opacity: 0.85, interactive: false }); })).addTo(map); L.popup({ maxWidth: 340 }).setLatLng(ll(f.pts[0])[Math.floor(f.pts[0].length / 2)]).setContent(fpop(f)).openOn(map); });
  $('#fRef').addEventListener('change', function () { persist.save(); if (lastPt) point(lastPt[0], lastPt[1]); });
  if (map) map.on('click', function (e) { if (drawer && drawer._on) return; if (!plates.length) return; point(e.latlng.lat, e.latlng.lng); });

  /* ---------------------------------------------------------------- area analysis */
  function setArea(b) { area = b; if (!map) return; if (areaLay) map.removeLayer(areaLay); areaLay = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: '#FFD60A', weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map); analyse(); }
  $('#fDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); drawer = null; setArea({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#fHint')); drawer._on = true; });
  $('#fView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.05); setArea({ n: Math.min(85, bb.getNorth()), s: Math.max(-85, bb.getSouth()), w: Math.max(-180, bb.getWest()), e: Math.min(180, bb.getEast()) }); });
  var inA = function (q) { var lo = q[0]; if (area.e - area.w < 360) { while (lo < area.w) lo += 360; while (lo > area.e) lo -= 360; } return q[1] >= area.s && q[1] <= area.n && lo >= area.w && lo <= area.e; };
  function sel() {
    var out = []; FL.forEach(function (f) { if (!f.vis) return; var Lk = 0, segs = []; f.pts.forEach(function (pts) { for (var k = 1; k < pts.length; k++) { var a = pts[k - 1], b = pts[k], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (!inA(m)) continue; var d = hav(a, b); Lk += d; segs.push([brg(a, b) % 180, d]); } });
      if (Lk > 0) out.push({ f: f, L: Lk, segs: segs }); });
    var bo = []; BL.forEach(function (b) { var Lk = 0; for (var k = 1; k < b.pts.length; k++) { var a = b.pts[k - 1], c = b.pts[k]; if (inA([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2])) Lk += hav(a, c); } if (Lk > 0) bo.push({ b: b, L: Lk }); });
    return { F: out, B: bo };
  }
  var LAST = null;
  function analyse() {
    var S = sel(), o = $('#fArea'); LAST = S; if (!S.F.length && !S.B.length) { o.innerHTML = '<span class="xsmall muted">' + t('No mapped active fault or plate boundary in this area.', 'لا يوجد فالق نشط أو حد صفيحة مرسوم في هذه المنطقة.') + '</span>'; return; }
    var by = {}, totL = 0, wsr = 0, Lsr = 0; S.F.forEach(function (x) { var g = x.f.grp; by[g] = by[g] || { n: 0, L: 0 }; by[g].n++; by[g].L += x.L; totL += x.L; if (x.f.sr && x.f.sr[0] != null) { wsr += x.f.sr[0] * x.L; Lsr += x.L; } });
    var bb = {}; S.B.forEach(function (x) { bb[x.b.c] = (bb[x.b.c] || 0) + x.L; });
    /* rose diagram: length-weighted strikes in 10° classes; Rayleigh test on the doubled strike of every fault (axial data) */
    var bins = new Array(18).fill(0); S.F.forEach(function (x) { x.segs.forEach(function (s) { bins[Math.floor(s[0] / 10) % 18] += s[1]; }); });
    var sx = 0, sy = 0, wsum = 0; S.F.forEach(function (x) { x.segs.forEach(function (s) { sx += s[1] * Math.sin(SH.rad(2 * s[0])); sy += s[1] * Math.cos(SH.rad(2 * s[0])); wsum += s[1]; }); });
    var mean = ((SH.deg(Math.atan2(sx, sy)) / 2) + 180) % 180, Rw = wsum ? Math.hypot(sx, sy) / wsum : 0;
    var n = S.F.length, cx = 0, cy = 0; S.F.forEach(function (x) { var a = SH.rad(2 * x.f.az); cx += Math.sin(a); cy += Math.cos(a); }); var Rn = Math.hypot(cx, cy), Rb = n ? Rn / n : 0, z = n ? Rn * Rn / n : 0, pv = n ? Math.exp(Math.sqrt(1 + 4 * n + 4 * (n * n - Rn * Rn)) - (1 + 2 * n)) : 1;
    S.rose = { bins: bins, mean: mean, Rw: Rw, n: n, Rb: Rb, z: z, p: Math.min(1, pv) };
    var ky = Object.keys(by).sort(function (a, b) { return by[b].L - by[a].L; }), km2 = (function () { var kx = 111.32 * Math.cos(SH.rad((area.n + area.s) / 2)); return Math.abs(area.e - area.w) * kx * (area.n - area.s) * 110.57; })();
    o.innerHTML = '<div class="fp-card"><b class="h">' + t('Faults in the area', 'الفوالق في المنطقة') + '</b><span>' + '<b class="ltr">' + n + '</b> ' + t('active faults with ', 'فالقاً نشطاً بطول ') + '<b class="ltr">' + SH.fmt(totL, 0) + ' km</b>' + t(' of trace; fault density ', ' للأثر؛ وكثافة الفوالق ') + '<b class="ltr">' + SH.fmt(totL / (km2 || 1) * 1000, 2) + ' km / 1000 km²</b>' + (Lsr ? t('; length-weighted mean slip rate ', '؛ ومتوسط معدل الانزلاق الموزون بالطول ') + '<b class="ltr">' + SH.fmt(wsr / Lsr, 2) + ' ' + t('mm/yr', 'ملم/سنة') + '</b>' : '') + '.</span>' +
      '<table class="fp-tbl"><thead><tr><th>' + t('Type', 'النوع') + '</th><th class="num">' + t('Faults', 'العدد') + '</th><th class="num">' + t('Length', 'الطول') + '</th></tr></thead><tbody>' + ky.map(function (g) { return '<tr><td><i style="display:inline-block;width:14px;height:4px;border-radius:2px;background:' + GR[g][0] + '"></i> ' + (AR ? GR[g][2] : GR[g][1]) + '</td><td class="num">' + by[g].n + '</td><td class="num"><span class="ltr">' + SH.fmt(by[g].L, 0) + ' km</span></td></tr>'; }).join('') +
      Object.keys(bb).map(function (k) { return '<tr><td><i style="display:inline-block;width:14px;height:4px;border-radius:2px;background:' + BC[k][0] + '"></i> ' + (AR ? BC[k][3] : BC[k][2]) + '</td><td class="num">—</td><td class="num"><span class="ltr">' + SH.fmt(bb[k], 0) + ' km</span></td></tr>'; }).join('') + '</tbody></table>' +
      (n ? '<div class="fp-rose" id="fRose"></div><span>' + t('Mean direction ', 'الاتجاه المتوسط ') + '<b class="ltr">' + p3(mean) + '° – ' + p3(mean + 180) + '°</b>' + t(' (length-weighted, R̄ = ', ' (موزون بالطول، R̄ = ') + '<span class="ltr">' + SH.fmt(Rw, 2) + '</span>). ' + t('Rayleigh test on the ', 'اختبار رايلي على اتجاهات ') + n + t(' fault trends: ', ' فالقاً: ') + '<span class="ltr">R̄ = ' + SH.fmt(Rb, 2) + ', z = ' + SH.fmt(z, 2) + ', p ' + (S.rose.p < 0.001 ? '< 0.001' : '= ' + SH.fmt(S.rose.p, 3)) + '</span> — ' +
        (S.rose.p < 0.05 ? t('the directions are not uniform: there is a preferred structural trend.', 'الاتجاهات غير متجانسة: يوجد اتجاه تركيبي مفضل.') : t('no preferred trend can be shown at the 5 % level.', 'لا يمكن إثبات اتجاه مفضل عند مستوى 5 %.')) + '</span>' : '') + '</div>';
    if (n) rose($('#fRose'), S.rose);
  }
  /* rose diagram as SVG: petal area proportional to length, bidirectional, mean direction dashed */
  function rose(host, r, forSheet) {
    var W = forSheet ? 640 : 340, cx = W / 2, cy = W / 2 + (forSheet ? 46 : 0), RR = W * 0.36, H = forSheet ? W + 150 : W, NS = 'http://www.w3.org/2000/svg', s = '', mx = Math.max.apply(null, r.bins) || 1, R = SH.rad, tot = r.bins.reduce(function (a, b) { return a + b; }, 0) || 1;
    var P = function (a0, rr) { var a1 = a0 + 10; return 'M' + cx + ' ' + cy + 'L' + (cx + rr * Math.sin(R(a0))).toFixed(2) + ' ' + (cy - rr * Math.cos(R(a0))).toFixed(2) + 'A' + rr.toFixed(2) + ' ' + rr.toFixed(2) + ' 0 0 1 ' + (cx + rr * Math.sin(R(a1))).toFixed(2) + ' ' + (cy - rr * Math.cos(R(a1))).toFixed(2) + 'Z'; };
    s += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    if (forSheet) s += '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" fill="none" stroke="#1B232B" stroke-width="1.2"/><text x="' + cx + '" y="34" text-anchor="middle" font-size="17" font-weight="800" fill="#1B232B">' + SH.esc(t('Rose diagram of active fault directions', 'مخطط وردة لاتجاهات الفوالق النشطة')) + '</text>';
    [0.25, 0.5, 0.75, 1].forEach(function (f) { s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (RR * Math.sqrt(f)).toFixed(1) + '" fill="none" stroke="#d0d4d8" ' + (f < 1 ? 'stroke-dasharray="3 3"' : 'stroke="#1B232B" stroke-width="1.3"') + '/><text x="' + (cx + 4) + '" y="' + (cy - RR * Math.sqrt(f) + 12).toFixed(1) + '" font-size="9" fill="#55616B" direction="ltr">' + SH.fmt(100 * f * mx / tot, 1) + '%</text>'; });
    r.bins.forEach(function (c, i) { if (!c) return; var rr = RR * Math.sqrt(c / mx); [i * 10, i * 10 + 180].forEach(function (a0) { s += '<path d="' + P(a0, rr) + '" fill="rgba(180,85,45,.55)" stroke="#8a3a1e" stroke-width=".8"/>'; }); });
    for (var a = 0; a < 360; a += 10) { var l = a % 30 === 0 ? 8 : 4; s += '<line x1="' + (cx + RR * Math.sin(R(a))).toFixed(1) + '" y1="' + (cy - RR * Math.cos(R(a))).toFixed(1) + '" x2="' + (cx + (RR + l) * Math.sin(R(a))).toFixed(1) + '" y2="' + (cy - (RR + l) * Math.cos(R(a))).toFixed(1) + '" stroke="#1B232B" stroke-width=".8"/>'; if (a % 30 === 0 && a) s += '<text x="' + (cx + (RR + 20) * Math.sin(R(a))).toFixed(1) + '" y="' + (cy - (RR + 20) * Math.cos(R(a)) + 4).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#55616B" direction="ltr">' + p3(a) + '</text>'; }
    s += '<text x="' + cx + '" y="' + (cy - RR - 13) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#1B232B">N</text>';
    var m = r.mean; s += '<line x1="' + (cx - (RR + 3) * Math.sin(R(m))).toFixed(1) + '" y1="' + (cy + (RR + 3) * Math.cos(R(m))).toFixed(1) + '" x2="' + (cx + (RR + 3) * Math.sin(R(m))).toFixed(1) + '" y2="' + (cy - (RR + 3) * Math.cos(R(m))).toFixed(1) + '" stroke="#1B232B" stroke-width="1.6" stroke-dasharray="7 4"/>';
    if (forSheet) { var y0 = cy + RR + 50, rows = [t('Petals: share of fault length in 10° classes (bidirectional)', 'البتلات: نسبة طول الفوالق في فئات 10° (ثنائية الاتجاه)'), t('Dashed line: mean direction ', 'الخط المتقطع: الاتجاه المتوسط ') + p3(m) + '° – ' + p3(m + 180) + '°, R̄ = ' + SH.fmt(r.Rw, 2), t('Rayleigh test, ', 'اختبار رايلي، ') + 'n = ' + r.n + ', z = ' + SH.fmt(r.z, 2) + ', p ' + (r.p < 0.001 ? '< 0.001' : '= ' + SH.fmt(r.p, 3)),
        t('Area ', 'المنطقة ') + area.s.toFixed(2) + '°–' + area.n.toFixed(2) + '° N, ' + area.w.toFixed(2) + '°–' + area.e.toFixed(2) + '° E'];
      rows.forEach(function (tx, k) { s += '<text x="' + cx + '" y="' + (y0 + k * 20) + '" text-anchor="middle" font-size="12" fill="#1B232B"' + (AR ? ' direction="rtl"' : '') + '>' + SH.esc(tx) + '</text>'; }); }
    host.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 ' + W + ' ' + H + '">' + s + '</svg>'; return host.firstChild;
  }

  /* ---------------------------------------------------------------- downloads */
  function needA() { if (!DATA) return false; if (!area) { if (!map) return false; var bb = map.getBounds(); setArea({ n: Math.min(85, bb.getNorth()), s: Math.max(-85, bb.getSouth()), w: Math.max(-180, bb.getWest()), e: Math.min(180, bb.getEast()) }); } return !!LAST; }
  var fname = function (x) { return 'Shandal-faults-' + area.s.toFixed(1) + '_' + area.w.toFixed(1) + '_' + area.n.toFixed(1) + '_' + area.e.toFixed(1) + x; };
  function feats() { return LAST.F.map(function (x) { var f = x.f, ty = TY[f.ty] || TY['null']; return { type: 'Feature', properties: { name_en: f.n || '', name_ar: f.ar || '', type_en: ty[1], type_ar: ty[2], group: f.grp, dip: f.dip ? f.dip[0] : null, dip_dir: f.dd || null, rake: f.rk ? f.rk[0] : null, slip_rate_mm_yr: f.sr ? f.sr[0] : null, slip_rate_min: f.sr ? f.sr[1] : null, slip_rate_max: f.sr ? f.sr[2] : null, seis_depth_top_km: f.ud == null ? null : f.ud, seis_depth_bottom_km: f.ld == null ? null : f.ld, length_km: f.L, trend_deg: f.az }, geometry: f.pts.length === 1 ? { type: 'LineString', coordinates: f.pts[0] } : { type: 'MultiLineString', coordinates: f.pts } }; }); }
  $('#fGj').addEventListener('click', function () { if (!needA()) return; SH.json(fname('.geojson'), { type: 'FeatureCollection', name: 'Active faults · Shandal System', license: 'CC BY-SA 4.0', features: feats() }); });
  $('#fCsv').addEventListener('click', function () { if (!needA()) return; var rows = [['name_en', 'name_ar', 'type_en', 'type_ar', 'dip', 'dip_dir', 'rake', 'slip_rate_mm_yr', 'length_km', 'trend_deg', 'start_lat', 'start_lon', 'end_lat', 'end_lon']];
    feats().forEach(function (ft) { var p = ft.properties, c = ft.geometry.type === 'LineString' ? ft.geometry.coordinates : [].concat.apply([], ft.geometry.coordinates); rows.push([p.name_en, p.name_ar, p.type_en, p.type_ar, p.dip, p.dip_dir, p.rake, p.slip_rate_mm_yr, p.length_km, p.trend_deg, c[0][1], c[0][0], c[c.length - 1][1], c[c.length - 1][0]]); });
    rows.push([]); rows.push(['© Shandal Geological Field Survey System · geologicalfieldsurvey.com · data CC BY-SA 4.0', new Date().toISOString().slice(0, 10)]); SH.csv(fname('.csv'), rows); });
  $('#fKml').addEventListener('click', function () { if (!needA()) return; var esc = function (s) { return String(s == null ? '' : s).replace(/[<&>]/g, function (c) { return { '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]; }); }, k = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Active faults · Shandal System</name>' +
      Object.keys(GR).map(function (g) { var h = GR[g][0].replace('#', ''); return '<Style id="' + g + '"><LineStyle><color>ff' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2) + '</color><width>2.5</width></LineStyle></Style>'; }).join('');
    feats().forEach(function (ft) { var p = ft.properties, ls = (ft.geometry.type === 'LineString' ? [ft.geometry.coordinates] : ft.geometry.coordinates).map(function (c) { return '<LineString><tessellate>1</tessellate><coordinates>' + c.map(function (q) { return q[0] + ',' + q[1] + ',0'; }).join(' ') + '</coordinates></LineString>'; }).join('');
      k += '<Placemark><name>' + esc(p.name_en || p.type_en) + '</name><styleUrl>#' + p.group + '</styleUrl><ExtendedData>' + Object.keys(p).map(function (q) { return '<Data name="' + q + '"><value>' + esc(p[q]) + '</value></Data>'; }).join('') + '</ExtendedData><MultiGeometry>' + ls + '</MultiGeometry></Placemark>'; });
    SH.download(fname('.kml'), k + '</Document></kml>', 'application/vnd.google-earth.kml+xml'); });
  $('#fRoseDl').addEventListener('click', function () { if (!needA() || !LAST.rose) { SH.toast(t('No faults in the area.', 'لا توجد فوالق في المنطقة.'), 'warn'); return; } var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(host); var svg = rose(host, LAST.rose, true); SH.svgPng(svg, fname('-rose.png'), 2); setTimeout(function () { host.remove(); }, 4000); });
  $('#fSheet').addEventListener('click', function () {
    if (!needA() || !D) return; var b = area, sp = Math.max(b.e - b.w, b.n - b.s); if (sp > 60) { SH.toast(t('For a map sheet keep the area under 60° across; zoom in or draw a smaller rectangle.', 'للخريطة المُخرجة اجعل المنطقة أقل من 60°؛ قرّب أو ارسم مستطيلاً أصغر.'), 'warn'); return; }
    var kx = Math.cos(SH.rad((b.n + b.s) / 2)), w = 1600, h = Math.round(SH.clamp(w * (b.n - b.s) / ((b.e - b.w) * kx), 300, 1600)), host = $('.wsm-map'); SH.busy(host, true, t('Composing the map sheet…', 'جارٍ إعداد الخريطة المُخرجة…'));
    var url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=' + [b.w, b.s, b.e, b.n].map(function (v) { return v.toFixed(5); }).join(',') + '&bboxSR=4326&imageSR=4326&size=' + w + ',' + h + '&format=jpg&f=image';
    fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); }).then(function (bl) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(bl); }); }).catch(function () { return null; }).then(function (img) {
      var lines = [], seenG = {}, seenB = {}, tr = function (pts) { return unwrap(pts).map(function (q) { var lo = q[0]; while (lo < b.w - 180) lo += 360; while (lo > b.e + 180) lo -= 360; return [q[1], lo]; }); };
      if ($('#fLB').checked) LAST.B.forEach(function (x) { var k = BC[x.b.c]; lines.push({ pts: tr(x.b.pts), color: k[0], width: k[1] * 0.8 }); seenB[x.b.c] = 1; });
      LAST.F.forEach(function (x) { x.f.pts.forEach(function (p) { lines.push({ pts: tr(p), color: color(x.f), width: 1.6, dash: x.f.grp === 'fold' ? '5 4' : null }); }); seenG[x.f.grp] = 1; });
      var leg = (SH.val('fColor') === 'rate' ? RATE.map(function (r, i) { return { color: r[1], name: (i ? '≥ ' + RATE[i - 1][0] : '< ' + RATE[0][0]) + (i < RATE.length - 1 && i ? ' – ' + r[0] : '') + ' ' + t('mm/yr', 'ملم/سنة'), width: 2.5 }; }) : Object.keys(GR).filter(function (g) { return seenG[g]; }).map(function (g) { return { color: GR[g][0], name: AR ? GR[g][2] : GR[g][1], dash: g === 'fold' ? '5 4' : null }; }))
        .concat(Object.keys(seenB).map(function (k) { return { color: BC[k][0], name: AR ? BC[k][3] : BC[k][2], width: 4 }; }));
      D.svgMap($('#fSheetSvg'), { b: { n: b.n, s: b.s, e: b.e, w: b.w }, min: 0, max: 1 }, [], { crs: 'geo', fill: false, image: img, noContours: true, grid: true, lines: lines, legend: leg, labels: false,
        title: t('Active faults and plate boundaries', 'الفوالق النشطة وحدود الصفائح'), subtitle: LAST.F.length + t(' faults · ', ' فالقاً · ') + SH.fmt(LAST.F.reduce(function (a, x) { return a + x.L; }, 0), 0) + ' km', legendTitle: '',
        source: t('Active faults, plate boundaries and satellite imagery, compiled in the Shandal System (data CC BY-SA 4.0).', 'الفوالق النشطة وحدود الصفائح والصور الفضائية، مجمّعة في نظام شندل (البيانات CC BY-SA 4.0).'), credit: 'Shandal System' });
      SH.svgPng($('#fSheetSvg'), fname('.png'), 2); }).then(function () { SH.busy(host, false); }, function (e) { SH.busy(host, false); SH.toast(e.message, 'bad'); });
  });
  document.addEventListener('sh:beforereport', function (e) { if (!DATA) e.preventDefault(); });
})();
