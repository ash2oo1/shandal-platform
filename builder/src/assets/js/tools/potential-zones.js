/* Geo-potential mapper — one engine for potential (prospectivity) maps built from evidence layers by the analytic hierarchy
   process (Saaty 1980), with a recipe per question, all on one regular grid over the area:
   · groundwater — lithology, lineament density, slope, drainage density, rainfall, wetness index, land cover, dry-season
     moisture, vegetation and surface temperature;
   · archaeological sites — mound relief, distance to water, height above drainage, soil-brightness and crop-mark anomalies,
     slope and land cover; generalised to about 1 km so that unrecorded sites are not exposed;
   · minerals — clay–hydroxyl, iron-oxide and ferrous-silicate anomalies (vegetation, water and towns masked), host rock,
     distance to lineaments and lineament density.
   Each layer is rated 1–5, the weighted sum is classed into five zones, and the map is checked against known points
   (success-rate curve, ROC, frequency ratio, Spearman correlation). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, AR = SH.lang === 'ar', D = SH.dem;
  var PC = 'https://planetarycomputer.microsoft.com/api/', MS = 'https://macrostrat.org/api/v2/', OM = 'https://archive-api.open-meteo.com/v1/archive';
  var C = function (en, ar) { return AR ? ar : en; };
  var persist = SH.persist('potential', ['pYear', 'pRes', 'pCls', 'pOp']);
  var map = SH.map('pMap', { zoom: 7, base: 'satellite', center: [33.3, 43.6] });

  /* ---------------------------------------------------------------- recipe: groundwater */
  var CLS = [['#b2182b', 'Very low', 'منخفضة جداً'], ['#ef8a62', 'Low', 'منخفضة'], ['#f6dc7d', 'Moderate', 'متوسطة'], ['#67a9cf', 'High', 'عالية'], ['#2166ac', 'Very high', 'عالية جداً']];
  var LC = { 10: ['#006400', 'Tree cover', 'غطاء شجري', 4], 20: ['#ffbb22', 'Shrubland', 'شجيرات', 3], 30: ['#ffff4c', 'Grassland', 'أعشاب', 3], 40: ['#f096ff', 'Cropland', 'أراضٍ زراعية', 4], 50: ['#fa0000', 'Built-up', 'عمران', 1],
    60: ['#b4b4b4', 'Bare or sparse vegetation', 'أرض جرداء أو نبات متناثر', 2], 70: ['#f0f0f0', 'Snow and ice', 'ثلج وجليد', 3], 80: ['#0064c8', 'Permanent water', 'مياه دائمة', 5], 90: ['#0096a0', 'Herbaceous wetland', 'أراضٍ رطبة عشبية', 5], 95: ['#00cf75', 'Mangroves', 'مانغروف', 5], 100: ['#fae6a0', 'Moss and lichen', 'طحالب وأشنات', 3] };
  /* lithology → groundwater rating (porosity and permeability of the rock or deposit) */
  var LITH = { gravel: [5, 'Gravel and alluvium', 'حصى ورواسب نهرية'], sand: [5, 'Sand', 'رمل'], quat: [4, 'Quaternary deposits', 'رواسب العصر الرباعي'], conglomerate: [4, 'Conglomerate', 'مدملكات'], limestone: [4, 'Limestone (karst)', 'حجر جيري (كارستي)'], dolomite: [4, 'Dolomite', 'دولومايت'], reef: [4, 'Reef limestone', 'حجر جيري مرجاني'], oolitic: [4, 'Oolitic limestone', 'حجر جيري سرئي'],
    sandstone: [4, 'Sandstone', 'حجر رملي'], breccia: [3, 'Breccia', 'بريشيا'], chalk: [3, 'Chalk', 'طباشير'], basalt: [3, 'Basalt', 'بازلت'], marble: [3, 'Marble', 'رخام'], gypsum: [3, 'Gypsum', 'جبس'], anhydrite: [2, 'Anhydrite', 'أنهايدرايت'], tuff: [2, 'Tuff', 'طف بركاني'], silt: [2, 'Silt', 'غرين'], siltstone: [2, 'Siltstone', 'حجر غريني'], marl: [2, 'Marl', 'مارل'],
    andesite: [2, 'Andesite', 'أنديسايت'], rhyolite: [2, 'Rhyolite', 'رايولايت'], granite: [2, 'Granite', 'غرانيت'], diorite: [2, 'Diorite', 'دايورايت'], gabbro: [2, 'Gabbro, ophiolite', 'غابرو، أفيولايت'], gneiss: [2, 'Gneiss', 'نايس'], schist: [2, 'Schist', 'شيست'], quartzite: [2, 'Quartzite', 'كوارتزايت'], serpentinite: [2, 'Serpentinite', 'سربنتينايت'], coal: [2, 'Coal', 'فحم'], chert: [2, 'Chert', 'صوان'], phosphorite: [2, 'Phosphorite', 'فوسفورايت'],
    phyllite: [1, 'Phyllite', 'فيلايت'], slate: [1, 'Slate', 'أردواز'], clay: [1, 'Clay', 'طين'], claystone: [1, 'Claystone', 'حجر طيني'], mudstone: [1, 'Mudstone', 'حجر وحلي'], shale: [1, 'Shale', 'طفل صفحي'], halite: [1, 'Rock salt', 'ملح صخري'] };
  function lithKey(s) { s = String(s || '').toLowerCase(); var K = [[/dolomit|dolostone/, 'dolomite'], [/chalk/, 'chalk'], [/marl/, 'marl'], [/oolit/, 'oolitic'], [/reef|boundstone/, 'reef'], [/limestone|carbonate|calcar/, 'limestone'], [/anhydrite/, 'anhydrite'], [/gypsum|evaporite/, 'gypsum'], [/halite|salt/, 'halite'], [/conglomerate/, 'conglomerate'], [/breccia/, 'breccia'],
      [/sandstone|arenite|greywacke|arkose/, 'sandstone'], [/siltstone/, 'siltstone'], [/claystone/, 'claystone'], [/mudstone/, 'mudstone'], [/shale/, 'shale'], [/chert/, 'chert'], [/phosph/, 'phosphorite'], [/coal|lignite/, 'coal'], [/gravel|alluvi|fan|terrace/, 'gravel'], [/sand|dune|eolian|aeolian/, 'sand'], [/silt|loess/, 'silt'], [/clay|mud/, 'clay'],
      [/tuff|pyroclast/, 'tuff'], [/basalt|mafic volcanic|lava/, 'basalt'], [/andesit/, 'andesite'], [/rhyolit|felsic volcanic/, 'rhyolite'], [/gabbro|ultramafic|ophiolit/, 'gabbro'], [/diorit/, 'diorite'], [/granit|plutonic|intrusive/, 'granite'], [/serpentin/, 'serpentinite'], [/marble/, 'marble'], [/quartzite/, 'quartzite'], [/gneiss|migmatit/, 'gneiss'], [/schist/, 'schist'], [/phyllite/, 'phyllite'], [/slate/, 'slate'], [/metamorph/, 'schist'], [/volcanic/, 'basalt'],
      [/quaternary|holocene|pleistocene|recent/, 'quat']];
    for (var i = 0; i < K.length; i++) if (K[i][0].test(s)) return K[i][1]; return ''; }

  /* kind: 'abs' fixed class limits (br) · 'q' quintiles of the area · 'cat' categorical. dir +1: higher value = higher potential */
  var GW = [
    { k: 'lith', n: C('Lithology', 'الصخارية'), imp: 9, kind: 'cat', d: C('Primary porosity and permeability of the rock or deposit at the surface.', 'المسامية والنفاذية الأولية للصخر أو الراسب على السطح.') },
    { k: 'lin', n: C('Lineament density', 'كثافة الخطوط التركيبية'), imp: 8, kind: 'q', dir: 1, u: 'km/km²', dp: 2, d: C('Faults and fractures are paths for infiltration and storage, so a dense network raises the potential.', 'الفوالق والكسور مسارات للتسرب والخزن، لذا ترفع كثافتها الاحتمالية.') },
    { k: 'slope', n: C('Slope', 'الانحدار'), imp: 7, kind: 'abs', dir: -1, br: [2, 5, 10, 20], u: '°', dp: 1, d: C('Gentle ground holds rain long enough to infiltrate; steep ground sheds it as runoff.', 'الأرض قليلة الانحدار تحتفظ بالمطر مدة تكفي لتسربه، والشديدة تصرفه جرياناً سطحياً.') },
    { k: 'dd', n: C('Drainage density', 'كثافة التصريف'), imp: 7, kind: 'q', dir: -1, u: 'km/km²', dp: 2, d: C('A dense stream network marks impermeable ground where rain runs off instead of soaking in.', 'الشبكة النهرية الكثيفة تدل على أرض قليلة النفاذية يجري عليها المطر بدل أن يتسرب.') },
    { k: 'rain', n: C('Mean annual rainfall', 'معدل الأمطار السنوي'), imp: 6, kind: 'abs', dir: 1, br: [100, 200, 350, 600], u: 'mm', dp: 0, d: C('The source of recharge: ten-year mean of annual totals.', 'مصدر التغذية: متوسط المجاميع السنوية لعشر سنوات.') },
    { k: 'twi', n: C('Topographic wetness index', 'مؤشر الرطوبة الطبوغرافي'), imp: 6, kind: 'q', dir: 1, u: '', dp: 1, d: C('ln(a / tan β): where water converges on flat ground and the soil stays wet.', 'ln(a / tan β): حيث يتجمع الماء على أرض مستوية وتبقى التربة رطبة.') },
    { k: 'lulc', n: C('Land cover', 'الغطاء الأرضي'), imp: 5, kind: 'cat', d: C('Vegetated, cultivated and wet land favours infiltration; built-up and bare land do not.', 'الأرض المزروعة والنباتية والرطبة تساعد التسرب، والعمران والأرض الجرداء لا تساعده.') },
    { k: 'ndmi', n: C('Dry-season moisture (NDMI)', 'رطوبة الموسم الجاف (NDMI)'), imp: 5, kind: 'q', dir: 1, u: '', dp: 2, d: C('Ground that stays moist at the end of summer is often fed by shallow groundwater.', 'الأرض التي تبقى رطبة في آخر الصيف كثيراً ما تغذيها مياه جوفية ضحلة.') },
    { k: 'ndvi', n: C('Dry-season vegetation (NDVI)', 'نبات الموسم الجاف (NDVI)'), imp: 4, kind: 'q', dir: 1, u: '', dp: 2, d: C('Plants that stay green without rain draw on shallow water; irrigated fields give the same signal, so read it with land cover.', 'النبات الذي يبقى أخضر بلا مطر يعتمد على مياه ضحلة؛ والحقول المروية تعطي الإشارة نفسها، لذا يُقرأ مع الغطاء الأرضي.') },
    { k: 'lst', n: C('Dry-season surface temperature', 'حرارة السطح في الموسم الجاف'), imp: 4, kind: 'q', dir: -1, u: C('°C from scene median', '°م عن وسيط المشهد'), dp: 1, d: C('Moist ground is cooler by evaporation, so relatively cool ground in summer is rated higher. Each scene is read relative to its own median, so scenes of different days join without steps.', 'الأرض الرطبة أبرد بسبب التبخر، لذا تُقيّم الأرض الأبرد نسبياً في الصيف أعلى. يُقرأ كل مشهد نسبةً إلى وسيطه، فتلتحم مشاهد الأيام المختلفة بلا قفزات.') }
  ];
  var SRC = { lith: 'lith', lin: 'dem', slope: 'dem', dd: 'dem', rain: 'rain', twi: 'dem', lulc: 'lc', ndmi: 's2g', ndvi: 's2g', lst: 'lst' }; GW.forEach(function (f) { f.src = SRC[f.k]; });

  /* ---------------------------------------------------------------- recipe: archaeological sites */
  var LCA = { 10: 2, 20: 3, 30: 3, 40: 4, 50: 2, 60: 4, 70: 1, 80: 1, 90: 2, 95: 1, 100: 2 };
  var ARCH = [
    { k: 'mound', n: C('Mound (tell) relief', 'بروز التلول'), imp: 9, kind: 'abs', dir: 1, br: [0.5, 1.5, 3, 6], u: 'm', dp: 1, src: 'dem', d: C('Height of the ground above its surroundings within about 500 m. Settlement mounds (tells) rise 2–40 m above flat plains; in hilly ground the value is capped because ridges mimic mounds.', 'ارتفاع الأرض عن محيطها ضمن نحو 500 م. ترتفع التلول الأثرية 2–40 م فوق السهول المنبسطة، وفي الأرض التلالية تُحدّ القيمة لأن الحافات تشبه التلول.') },
    { k: 'water', n: C('Distance to water', 'البعد عن المياه'), imp: 7, kind: 'abs', dir: -1, br: [500, 1500, 3000, 6000], u: 'm', dp: 0, src: 'dem', d: C('Distance to permanent water and to the main drainage lines. Ancient settlement clung to rivers and canals; old courses have shifted, so read it with the mound layer.', 'المسافة إلى المياه الدائمة وخطوط التصريف الرئيسة. ارتبط الاستيطان القديم بالأنهار والقنوات، وقد تغيرت المجاري القديمة، لذا يُقرأ مع طبقة التلول.') },
    { k: 'hand', n: C('Height above nearest drainage', 'الارتفاع فوق أقرب مجرى'), imp: 7, kind: 'abs', br: [1, 10, 30, 60], rs: [3, 5, 4, 2, 1], u: 'm', dp: 1, src: 'dem', d: C('Height of the ground above the nearest stream or water body. Ground 1–10 m above it was close to water yet safe from ordinary floods: the levees and terraces favoured for settlement.', 'ارتفاع الأرض فوق أقرب مجرى أو مسطح مائي. الأرض المرتفعة 1–10 م فوقه قريبة من الماء وآمنة من الفيضانات الاعتيادية: الأكتاف والمصاطب المفضلة للاستيطان.') },
    { k: 'bright', n: C('Soil-brightness anomaly', 'شذوذ سطوع التربة'), imp: 6, kind: 'z', dir: 1, u: 'σ', dp: 2, src: 's2a', d: C('Ancient occupation soils (anthrosols) of ash, burnt brick and salts are brighter in the shortwave infrared than the land around them in the dry season.', 'ترب الاستيطان القديم من الرماد والطابوق المحروق والأملاح أكثر سطوعاً في الأشعة تحت الحمراء القصيرة من الأرض المحيطة بها في الموسم الجاف.') },
    { k: 'slope', n: C('Slope', 'الانحدار'), imp: 5, kind: 'abs', dir: -1, br: [1, 3, 6, 12], u: '°', dp: 1, src: 'dem', d: C('Settlements were built on nearly level ground.', 'بُنيت المستوطنات على أرض شبه مستوية.') },
    { k: 'crop', n: C('Crop-mark anomaly', 'شذوذ علامات المحاصيل'), imp: 4, kind: 'z', dir: 1, u: 'σ', dp: 2, src: 's2a', d: C('In spring fields, crops grow weaker over buried walls and saline mound soils. The layer marks fields whose greenness falls below that of the fields around them; it is empty where nothing grows.', 'في حقول الربيع ينمو المحصول أضعف فوق الجدران المدفونة وترب التلول المالحة. تُبرز الطبقة الحقول التي يقل اخضرارها عن محيطها، وتكون فارغة حيث لا ينمو شيء.') },
    { k: 'lulc', n: C('Land cover', 'الغطاء الأرضي'), imp: 3, kind: 'cat', src: 'lc', d: C('Open plains and fields keep sites visible and reachable; water, dense trees and towns hide them.', 'السهول المفتوحة والحقول تُبقي المواقع ظاهرة ويمكن بلوغها، أما المياه والأشجار الكثيفة والمدن فتخفيها.') }
  ];

  /* ---------------------------------------------------------------- recipe: minerals (alteration-related metallic deposits) */
  var LITHM = { gabbro: 5, serpentinite: 5, basalt: 4, andesite: 4, rhyolite: 4, granite: 4, diorite: 4, breccia: 4, tuff: 3, schist: 3, gneiss: 3, quartzite: 3, marble: 3, phyllite: 3, chert: 3, phosphorite: 3, limestone: 3, dolomite: 3,
    slate: 2, reef: 2, oolitic: 2, chalk: 2, conglomerate: 2, sandstone: 2, siltstone: 2, mudstone: 2, claystone: 2, shale: 2, marl: 1, gypsum: 1, anhydrite: 1, halite: 1, coal: 1, gravel: 1, sand: 1, silt: 1, clay: 1, quat: 1 };
  var MIN = [
    { k: 'clay', n: C('Clay–hydroxyl alteration (B11/B12)', 'تغاير الطين والهيدروكسيل (B11/B12)'), imp: 8, kind: 'z', dir: 1, u: '', dp: 3, src: 's2m', d: C('Al-OH and Mg-OH bonds in clays, sericite and alunite and the CO₃ of carbonates absorb near 2.2 µm (B12), raising the ratio over argillic and phyllic alteration. Rated by standard deviations above the area mean.', 'تمتص روابط Al-OH وMg-OH في الأطيان والسيريسايت والألونايت وCO₃ في الكربونات قرب 2.2 ميكرون (B12)، فترتفع النسبة فوق نطاقات التغاير الطيني والفيلي. تُقيّم بعدد الانحرافات المعيارية فوق متوسط المنطقة.') },
    { k: 'iron', n: C('Iron-oxide anomaly (B4/B2)', 'شذوذ أكاسيد الحديد (B4/B2)'), imp: 7, kind: 'z', dir: 1, u: '', dp: 3, src: 's2m', d: C('Fe³⁺ in hematite, goethite and jarosite absorbs in the blue, so gossans and oxidised sulphide zones raise the ratio.', 'يمتص Fe³⁺ في الهيماتيت والجيوثايت والجاروسايت في الأزرق، فترفع القبعات الحديدية ونطاقات الكبريتيدات المؤكسدة النسبة.') },
    { k: 'lith', n: C('Host rock', 'الصخر المضيف'), imp: 8, kind: 'cat', src: 'lith', d: C('Favourability of the rock for hydrothermal metallic deposits: ophiolites and mafic–ultramafic rocks, volcanic and intrusive rocks rate highest; evaporites and young cover lowest.', 'ملاءمة الصخر للرواسب المعدنية الحرمائية: الأفيوليتات والصخور القاعدية وفوق القاعدية والبركانية والمتداخلة أعلاها، والمتبخرات والغطاء الحديث أدناها.') },
    { k: 'prox', n: C('Distance to lineaments', 'البعد عن الخطوط التركيبية'), imp: 7, kind: 'abs', dir: -1, br: [250, 500, 1000, 2000], u: 'm', dp: 0, src: 'dem', d: C('Faults and fractures carry the mineralising fluids, so ground close to them rates higher.', 'الفوالق والكسور تنقل المحاليل الممعدنة، لذا تُقيّم الأرض القريبة منها أعلى.') },
    { k: 'lin', n: C('Lineament density', 'كثافة الخطوط التركيبية'), imp: 6, kind: 'q', dir: 1, u: 'km/km²', dp: 2, src: 'dem', d: C('Intersecting fracture sets make permeable zones where fluids focused.', 'تقاطع مجموعات الكسور يصنع نطاقات نفاذة تركّزت فيها المحاليل.') },
    { k: 'ferr', n: C('Ferrous-silicate anomaly (B11/B8)', 'شذوذ السيليكات الحديدوزية (B11/B8)'), imp: 5, kind: 'z', dir: 1, u: '', dp: 3, src: 's2m', d: C('Fe²⁺ in chlorite, epidote, pyroxene and olivine absorbs near 1 µm; high over propylitic alteration and mafic rocks.', 'يمتص Fe²⁺ في الكلورايت والإبيدوت والبيروكسين والأوليفين قرب 1 ميكرون؛ ترتفع النسبة فوق التغاير البروبيليتي والصخور القاعدية.') }
  ];

  var PT = function (o) { return o; };
  var REC = {
    gw: { L: GW, pal: ['#b2182b', '#ef8a62', '#f6dc7d', '#67a9cf', '#2166ac'], title: C('Groundwater potential zones', 'مناطق احتمالية المياه الجوفية'), file: 'groundwater-potential', side: 220,
      lith: function (k) { return LITH[k][0]; }, lc: function (v) { return LC[v][3]; },
      note: C('The result ranks the ground inside your area from very low to very high potential. It does not give the depth, thickness or quality of water: those come from electrical soundings and wells.', 'تُرتّب النتيجة الأرض داخل منطقتك من احتمالية منخفضة جداً إلى عالية جداً. ولا تعطي عمق المياه أو سُمك الخزان أو نوعية المياه، فهذه تأتي من السبر الكهربائي والآبار.'),
      end: C('Treat the zones as targets for electrical soundings and test wells, not as proven water.', 'تعامل مع هذه المناطق كأهداف للسبر الكهربائي والآبار الاختبارية، لا كمياه مؤكدة.'),
      fig: C('Evidence layers rated 1–5 for groundwater potential', 'طبقات الأدلة مقيّمة من 1 إلى 5 لاحتمالية المياه الجوفية'),
      pt: PT({ h: C('5 · Check against wells', '5 · التحقق بالآبار'), p: C('Add known wells: a CSV with latitude, longitude and, if known, yield (L/s) or status (1 = productive, 0 = dry), or tap them on the map. The tool measures how well the map predicts them.', 'أضف آباراً معروفة: ملف CSV فيه خط العرض وخط الطول، ومع الإنتاجية (لتر/ثا) أو الحالة (1 = منتجة، 0 = جافة) إن وُجدت، أو انقرها على الخريطة. تقيس الأداة مدى تنبؤ الخريطة بها.'),
        load: C('Load wells (CSV)', 'حمّل الآبار (CSV)'), tap: C('Tap wells on map', 'انقر الآبار على الخريطة'), many: C(' wells', ' بئراً'), pos: C('Productive or unclassified well', 'بئر منتجة أو غير مصنفة'), neg: C('Dry well', 'بئر جافة'), negw: C('dry', 'جافة'), yu: 'L/s',
        curve: C('Success-rate curve: the share of productive wells captured as the map is read from its highest to its lowest potential.', 'منحنى معدل النجاح: نسبة الآبار المنتجة التي تلتقطها الخريطة عند قراءتها من أعلى احتمالية إلى أدناها.'), roc: C('Productive against dry wells: ', 'الآبار المنتجة مقابل الجافة: '), yl: C('yield', 'الإنتاجية'), ax: C('Wells captured', 'الآبار الملتقطة'), ttl: C('Validation against ', 'التحقق مقابل ') }) },
    arch: { L: ARCH, pal: ['#3b4a5a', '#8c96a0', '#e9d9a6', '#d9913a', '#9c2f12'], title: C('Archaeological site potential', 'احتمالية المواقع الأثرية'), file: 'archaeological-potential', side: 330, gen: 1000,
      lc: function (v) { return LCA[v]; },
      note: C('The map ranks where ancient settlement is likely, from mound relief, water, landform and soil and crop marks. It is generalised to cells of about 1 km so that unrecorded sites are not exposed. Under the Iraqi Antiquities and Heritage Law No. 55 of 2002, any survey or digging needs the permission of the State Board of Antiquities and Heritage.', 'ترتّب الخريطة الأماكن التي يُرجَّح فيها الاستيطان القديم من بروز التلول والمياه وشكل الأرض وعلامات التربة والمحاصيل. وهي معمّمة إلى خلايا بنحو 1 كم كي لا تُكشف المواقع غير المسجلة. وبموجب قانون الآثار والتراث العراقي رقم 55 لسنة 2002 يحتاج أي مسح أو حفر إلى إذن الهيئة العامة للآثار والتراث.'),
      end: C('The zones are areas to survey with the antiquities authority, not discovered sites.', 'هذه المناطق أماكن للمسح بالتنسيق مع هيئة الآثار، وليست مواقع مكتشفة.'),
      fig: C('Evidence layers rated 1–5 for archaeological site potential', 'طبقات الأدلة مقيّمة من 1 إلى 5 لاحتمالية المواقع الأثرية'),
      pt: PT({ h: C('5 · Check against known sites', '5 · التحقق بالمواقع المعروفة'), p: C('Load the recorded sites in the area, add your own as a CSV (latitude, longitude, optional status: 1 = site, 0 = surveyed without finds), or tap them on the map. The tool measures how well the map predicts them.', 'حمّل المواقع المسجلة في المنطقة، أو أضف مواقعك بملف CSV (خط العرض، خط الطول، والحالة اختيارياً: 1 = موقع، 0 = مُسح بلا لُقى)، أو انقرها على الخريطة. تقيس الأداة مدى تنبؤ الخريطة بها.'),
        load: C('Load sites (CSV)', 'حمّل المواقع (CSV)'), tap: C('Tap sites on map', 'انقر المواقع على الخريطة'), many: C(' sites', ' موقعاً'), pos: C('Known site', 'موقع معروف'), neg: C('Surveyed, no finds', 'مُسح بلا لُقى'), negw: C('no finds', 'بلا لُقى'), yu: '',
        curve: C('Success-rate curve: the share of known sites captured as the map is read from its highest to its lowest potential.', 'منحنى معدل النجاح: نسبة المواقع المعروفة التي تلتقطها الخريطة عند قراءتها من أعلى احتمالية إلى أدناها.'), roc: C('Sites against surveyed empty ground: ', 'المواقع مقابل الأرض الممسوحة الخالية: '), yl: C('value', 'القيمة'), ax: C('Sites captured', 'المواقع الملتقطة'), ttl: C('Validation against ', 'التحقق مقابل ') }) },
    min: { L: MIN, pal: ['#2b3a4a', '#6c7a89', '#f2d16b', '#e3742e', '#a3123a'], title: C('Mineral prospectivity', 'الاحتمالية المعدنية'), file: 'mineral-prospectivity', side: 260,
      lith: function (k) { return LITHM[k]; },
      note: C('The map ranks where alteration minerals, structures and favourable host rock coincide, as targets for sampling. Satellites cannot see gold or any metal itself: they see clay and iron minerals that sometimes accompany ore. Vegetation, water and towns are masked because they hide the rock.', 'ترتّب الخريطة الأماكن التي تجتمع فيها معادن التغاير والتراكيب والصخر المضيف الملائم، كأهداف لأخذ العينات. لا ترى الأقمار الصناعية الذهب ولا أي فلز بعينه، بل ترى معادن الطين والحديد التي ترافق الخام أحياناً. وتُحجب النباتات والمياه والمدن لأنها تغطي الصخر.'),
      end: C('Treat the zones as targets for field mapping, rock and stream-sediment sampling and geochemistry, not as proven ore.', 'تعامل مع هذه المناطق كأهداف للتخريط الحقلي وأخذ عينات الصخور ورواسب المجاري والتحليل الجيوكيميائي، لا كخام مؤكد.'),
      fig: C('Evidence layers rated 1–5 for mineral prospectivity', 'طبقات الأدلة مقيّمة من 1 إلى 5 للاحتمالية المعدنية'),
      pt: PT({ h: C('5 · Check against known occurrences', '5 · التحقق بالتمعدنات المعروفة'), p: C('Add known mineral occurrences, mines or prospects: a CSV with latitude, longitude and, if known, grade or status (1 = mineralised, 0 = barren), or tap them on the map.', 'أضف تمعدنات أو مناجم أو مكامن معروفة: ملف CSV فيه خط العرض وخط الطول، ومع المحتوى أو الحالة (1 = متمعدن، 0 = عقيم) إن وُجدت، أو انقرها على الخريطة.'),
        load: C('Load occurrences (CSV)', 'حمّل التمعدنات (CSV)'), tap: C('Tap occurrences on map', 'انقر التمعدنات على الخريطة'), many: C(' occurrences', ' تمعدناً'), pos: C('Mineral occurrence', 'تمعدن معروف'), neg: C('Barren sample', 'عينة عقيمة'), negw: C('barren', 'عقيمة'), yu: '',
        curve: C('Success-rate curve: the share of known occurrences captured as the map is read from its highest to its lowest prospectivity.', 'منحنى معدل النجاح: نسبة التمعدنات المعروفة التي تلتقطها الخريطة عند قراءتها من أعلى احتمالية إلى أدناها.'), roc: C('Mineralised against barren points: ', 'النقاط المتمعدنة مقابل العقيمة: '), yl: C('grade', 'المحتوى'), ax: C('Occurrences captured', 'التمعدنات الملتقطة'), ttl: C('Validation against ', 'التحقق مقابل ') }) }
  };
  REC.gw.k = 'gw'; REC.arch.k = 'arch'; REC.min.k = 'min';
  var RC = REC.gw, F = GW, FK = {};

  /* ---------------------------------------------------------------- state */
  var aoi = SH.store.get('shandal_pz_aoi', null), aoiLay = null, drawer = null, G = null, ov = null, wells = [], wLay = L ? L.layerGroup() : null, addMode = false, userLin = null, busy = false;
  if (map) wLay.addTo(map);
  /* Arabic: the assistant button sits bottom-left, so the scale bar moves to the bottom-right corner */
  if (map && AR) { var scl = map.getContainer().querySelector('.leaflet-control-scale'), br = map.getContainer().querySelector('.leaflet-bottom.leaflet-right'); if (scl && br) br.insertBefore(scl, br.firstChild); }

  /* ---------------------------------------------------------------- dry-season year */
  (function () { var now = new Date(), y = now.getUTCFullYear() - (now.getUTCMonth() >= 9 ? 0 : 1), s = $('#pYear'), o = ''; for (var k = 0; k < 8; k++) o += '<option value="' + (y - k) + '">' + (y - k) + '</option>'; s.innerHTML = o;
    var sv = SH.store.get('shandal_tool_potential', {}); if (sv.pYear && +sv.pYear <= y && +sv.pYear > y - 8) s.value = sv.pYear; })();

  /* ---------------------------------------------------------------- AHP: pairwise matrix from importance scores, principal eigenvector, consistency */
  var RI = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51, 1.48];
  function ahp(s) {
    var n = s.length, A = [], i, j, w = [], k;
    for (i = 0; i < n; i++) { A.push([]); for (j = 0; j < n; j++) { var d = s[i] - s[j]; A[i].push(d >= 0 ? Math.min(9, d + 1) : 1 / Math.min(9, 1 - d)); } }
    for (i = 0; i < n; i++) w.push(1 / n);
    for (k = 0; k < 200; k++) { var nw = [], sm = 0; for (i = 0; i < n; i++) { var v = 0; for (j = 0; j < n; j++) v += A[i][j] * w[j]; nw.push(v); sm += v; } w = nw.map(function (v) { return v / sm; }); }
    var lam = 0; for (i = 0; i < n; i++) { var aw = 0; for (j = 0; j < n; j++) aw += A[i][j] * w[j]; lam += aw / w[i]; } lam /= n;
    var CI = n > 2 ? (lam - n) / (n - 1) : 0, CR = n > 2 ? CI / RI[n] : 0;
    return { w: w, lam: lam, CI: CI, CR: CR, A: A };
  }
  var AH = null;
  function weights() {
    var act = F.filter(function (f) { return f.on && f.st !== 'bad'; }); F.forEach(function (f) { f.w = 0; });
    if (act.length) { AH = ahp(act.map(function (f) { return f.w8; })); act.forEach(function (f, i) { f.w = AH.w[i]; }); } else AH = null;
    F.forEach(function (f) { var e = $('#pw_' + f.k); if (e) e.textContent = f.on && f.w ? SH.fmt(f.w * 100, 1) + '%' : '—'; });
    $('#pCR').innerHTML = AH ? '<span>λ<sub>max</sub> <b class="ltr">' + SH.fmt(AH.lam, 3) + '</b></span><span>CI <b class="ltr">' + SH.fmt(AH.CI, 3) + '</b></span><span>CR <b class="ltr" style="color:var(--' + (AH.CR < 0.1 ? 'ok' : 'warn') + ')">' + SH.fmt(AH.CR, 3) + '</b></span><span class="muted">' + (AH.CR < 0.1 ? t('consistent (CR < 0.10)', 'متسقة (CR < 0.10)') : t('inconsistent: soften the differences', 'غير متسقة: قلّل الفروق')) + '</span>' : '';
    SH.store.set(impKey(), F.reduce(function (o, f) { o[f.k] = [f.on, f.w8]; return o; }, {}));
  }
  function rows() {
    $('#pF').innerHTML = F.map(function (f) { return '<div class="row" title="' + SH.esc(f.d) + '"><input type="checkbox" id="pc_' + f.k + '" ' + (f.on ? 'checked' : '') + ' aria-label="' + SH.esc(f.n) + '"><label for="pc_' + f.k + '">' + SH.esc(f.n) + '</label><input type="range" min="1" max="9" step="1" value="' + f.w8 + '" id="pi_' + f.k + '" aria-label="' + SH.esc(f.n) + '"><span class="w" id="pw_' + f.k + '"></span><span class="st" id="ps_' + f.k + '" data-s="' + (f.st || 'off') + '"></span></div>'; }).join('');
    weights();
  }
  var impKey = function () { return 'shandal_pz_imp' + (RC.k === 'gw' ? '' : '_' + RC.k); }, ptsKey = function () { return RC.k === 'gw' ? 'shandal_pz_wells' : 'shandal_pz_pts_' + RC.k; };
  /* switch recipe: layers, importance, palette, texts and known points of that question; results are cleared */
  function setRecipe(k) {
    RC = REC[k] || REC.gw; F = RC.L; FK = {}; F.forEach(function (f) { FK[f.k] = f; });
    var sv = SH.store.get(impKey(), {}); F.forEach(function (f) { f.on = sv[f.k] ? sv[f.k][0] !== false : true; f.w8 = sv[f.k] ? sv[f.k][1] : f.imp; f.st = 'off'; });
    CLS.forEach(function (q, i) { q[0] = RC.pal[i]; });
    SH.$$('#pRec [data-r]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-r') === RC.k ? 'true' : 'false'); });
    $('#pNote').textContent = RC.note; $('#pVH').textContent = RC.pt.h; $('#pVP').textContent = RC.pt.p; $('#pWFL').textContent = RC.pt.load; $('#pWAdd').textContent = RC.pt.tap; $('#pOsm').hidden = RC.k !== 'arch';
    document.querySelector('label[for=pLinF]').hidden = RC.k === 'arch'; $('#pLinS').hidden = RC.k === 'arch';
    G = null; if (ov && map) { map.removeLayer(ov); ov = null; } $('#pLeg').hidden = true; $('#pValOut').innerHTML = ''; $('#pProg').innerHTML = '';
    $('#pShow').innerHTML = '<option value="cls">' + t('Potential classes', 'فئات الاحتمالية') + '</option>';
    $('#pOut').innerHTML = '<span class="xsmall muted">' + t('Draw an area and build the map. Tap any point of the result to read every layer there.', 'ارسم منطقة وأنشئ الخريطة. انقر أي نقطة في النتيجة لقراءة كل طبقة فيها.') + '</span>';
    wells = SH.store.get(ptsKey(), []); saveWells(); rows(); SH.store.set('shandal_pz_recipe', RC.k);
    if (aoi) setAoi(aoi);
  }
  $('#pRec').addEventListener('click', function (e) { var b = e.target.closest('[data-r]'); if (!b || busy || b.getAttribute('data-r') === RC.k) return; setRecipe(b.getAttribute('data-r')); });
  $('#pF').addEventListener('input', function (e) { var id = e.target.id || ''; if (!/^p[ci]_/.test(id)) return; var f = FK[id.slice(3)]; if (id[1] === 'c') f.on = e.target.checked; else f.w8 = +e.target.value; weights(); if (G && G.done) { compose(); } });
  $('#pDef').addEventListener('click', function () { F.forEach(function (f) { f.on = true; f.w8 = f.imp; }); rows(); if (G && G.done) compose(); });
  function status(k, s) { var f = FK[k]; f.st = s; var e = $('#ps_' + k); if (e) e.setAttribute('data-s', s); }

  /* ---------------------------------------------------------------- area */
  function km(b) { var kx = 111.32 * Math.cos(SH.rad((b.n + b.s) / 2)); return { w: (b.e - b.w) * kx, h: (b.n - b.s) * 110.57 }; }
  function setAoi(b) { aoi = b; SH.store.set('shandal_pz_aoi', b); if (!map) return; if (aoiLay) map.removeLayer(aoiLay); aoiLay = L.rectangle([[b.s, b.w], [b.n, b.e]], { color: '#FFD60A', weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(map);
    var k = km(b), a = k.w * k.h; $('#pAoi').innerHTML = '<span class="ltr">' + SH.fmt(k.w, 1) + ' × ' + SH.fmt(k.h, 1) + ' km · ' + SH.fmt(a, 1) + ' km²</span>' + (a > 2500 ? ' · <span style="color:var(--bad)">' + t('too large: keep it under 2500 km²', 'كبيرة جداً: اجعلها أقل من 2500 كم²') + '</span>' : a < 4 ? ' · <span style="color:var(--bad)">' + t('too small: at least 4 km²', 'صغيرة جداً: 4 كم² على الأقل') + '</span>' : RC.k === 'arch' && a > 600 ? ' · <span style="color:var(--warn)">' + t('for mound detection keep it under 600 km²', 'لكشف التلول اجعلها أقل من 600 كم²') + '</span>' : ''); }
  if (aoi) { setAoi(aoi); if (map) map.fitBounds([[aoi.s, aoi.w], [aoi.n, aoi.e]]); }
  $('#pDraw').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); }, $('#pHint')); });
  $('#pView').addEventListener('click', function () { if (!map) return; var bb = map.getBounds().pad(-0.1); setAoi({ n: bb.getNorth(), s: bb.getSouth(), w: bb.getWest(), e: bb.getEast() }); });

  /* ---------------------------------------------------------------- data access */
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  /* the imagery service answers 503 when it is busy: retry with a growing pause */
  function pcFetch(url, opts, n) {
    n = n || 0; var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 45000);
    return fetch(url, Object.assign({}, opts || {}, { signal: ctl.signal })).then(function (r) { clearTimeout(tm); if (r.ok) return r; if ((r.status === 503 || r.status === 429 || r.status === 502 || r.status === 504) && n < 7) return sleep(1200 * (n + 1) + Math.random() * 800).then(function () { return pcFetch(url, opts, n + 1); }); throw new Error('HTTP ' + r.status); },
      function (e) { clearTimeout(tm); if (n < 3 && e.name !== 'AbortError') return sleep(1500 * (n + 1)).then(function () { return pcFetch(url, opts, n + 1); }); throw e; });
  }
  function search(body) { return pcFetch(PC + 'stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (j) { return j.features || []; }); }
  function npy(buf) {
    var u8 = new Uint8Array(buf), maj = u8[6], hl = maj >= 2 ? (u8[8] | (u8[9] << 8) | (u8[10] << 16) | (u8[11] << 24)) : (u8[8] | (u8[9] << 8)), o0 = maj >= 2 ? 12 : 10, off = o0 + hl, h = new TextDecoder().decode(u8.slice(o0, off));
    var ds = /descr': '([^']+)'/.exec(h)[1], sh = /shape': \(([^)]*)\)/.exec(h)[1].split(',').filter(function (s) { return s.trim(); }).map(Number);
    var T = { '<f8': Float64Array, '<f4': Float32Array, '|u1': Uint8Array, '<u1': Uint8Array, '<u2': Uint16Array, '<i2': Int16Array, '<i4': Int32Array, '|i1': Int8Array, '<u4': Uint32Array }[ds];
    if (!T) throw new Error('npy ' + ds); return { shape: sh, data: new T(buf.slice(off)) };
  }
  /* fill the grid from scenes in order (same date first), each request aligned to whole grid cells */
  function mosaic(items, coll, query, nb, okv, onDone, rel) {
    var out = []; for (var q = 0; q < nb; q++) { var a = new Float32Array(G.n); a.fill(NaN); out.push(a); }
    var done = new Uint8Array(G.n), used = [], left = function (i0, i1, j0, j1) { for (var j = j0; j < j1; j++) for (var i = i0; i < i1; i++) if (isNaN(out[0][j * G.nx + i])) return true; return false; };
    return items.slice(0, 8).reduce(function (p, it) { return p.then(function () {
      var bb = it.bbox, i0 = Math.max(0, Math.floor((bb[0] - G.b.w) / G.dlon)), i1 = Math.min(G.nx, Math.ceil((bb[2] - G.b.w) / G.dlon)), j0 = Math.max(0, Math.floor((G.b.n - bb[3]) / G.dlat)), j1 = Math.min(G.ny, Math.ceil((G.b.n - bb[1]) / G.dlat));
      if (i1 - i0 < 1 || j1 - j0 < 1 || !left(i0, i1, j0, j1)) return;
      var box = [G.b.w + i0 * G.dlon, G.b.n - j1 * G.dlat, G.b.w + i1 * G.dlon, G.b.n - j0 * G.dlat].map(function (v) { return v.toFixed(7); }).join(',');
      return pcFetch(PC + 'data/v1/item/bbox/' + box + '/' + (i1 - i0) + 'x' + (j1 - j0) + '.npy?collection=' + coll + '&item=' + encodeURIComponent(it.id) + '&' + query(it)).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        var A = npy(buf), W = A.shape[2], H = A.shape[1], B = A.shape[0], m = A.data.subarray((B - 1) * W * H), got = 0;
        for (var j = 0; j < H && j0 + j < G.ny; j++) for (var i = 0; i < W && i0 + i < G.nx; i++) { var c = (j0 + j) * G.nx + i0 + i, p = j * W + i; if (!isNaN(out[0][c]) || !m[p]) continue;
          var ok = true, v = []; for (q = 0; q < nb; q++) { v.push(A.data[q * W * H + p]); if (!okv(v[q], q)) ok = false; } if (!ok) continue; for (q = 0; q < nb; q++) out[q][c] = v[q]; got++; }
        if (got) { used.push(it); if (rel) { var vals = [], idx = []; for (var j4 = j0; j4 < j1; j4++) for (var i4 = i0; i4 < i1; i4++) { var c4 = j4 * G.nx + i4; if (isFinite(out[0][c4]) && !done[c4]) { vals.push(out[0][c4]); idx.push(c4); } }
            vals.sort(function (x, y) { return x - y; }); var med = vals[Math.floor(vals.length / 2)]; idx.forEach(function (c4) { out[0][c4] -= med; done[c4] = 1; }); } }
      }).catch(function () {});
    }); }, Promise.resolve()).then(function () { if (onDone) onDone(used); return { arr: out, used: used }; });
  }
  function byDate(items) { if (!items.length) return items; items.sort(function (a, b) { return (a.properties['eo:cloud_cover'] || 0) - (b.properties['eo:cloud_cover'] || 0); }); var d0 = items[0].properties.datetime.slice(0, 10);
    return items.filter(function (i) { return i.properties.datetime.slice(0, 10) === d0; }).concat(items.filter(function (i) { return i.properties.datetime.slice(0, 10) !== d0; })); }
  function season() { var y = +SH.val('pYear'), south = (G.b.n + G.b.s) / 2 < 0; return south ? (y - 1) + '-12-01T00:00:00Z/' + y + '-03-31T23:59:59Z' : y + '-06-01T00:00:00Z/' + y + '-09-30T23:59:59Z'; }
  var BB = function () { return [G.b.w, G.b.s, G.b.e, G.b.n]; };

  /* elevation (30 m elevation model, resampled to the grid; global terrain tiles as fallback) */
  function getDem() {
    var pad = Math.max(G.dlon, G.dlat) * 2, b = { n: G.b.n + pad, s: G.b.s - pad, e: G.b.e + pad, w: G.b.w - pad };
    var fill = function (f) { var Z = new Float32Array(G.n); for (var j = 0; j < G.ny; j++) for (var i = 0; i < G.nx; i++) Z[j * G.nx + i] = f(G.lat(j), G.lon(i)); return Z; };
    /* the imagery service often answers 503 when busy: try the 30 m model up to four times before the terrain-tile fallback */
    var tryCop = function (n) { return SH.pc.dem(b, 'cop-dem-glo-30', null, 1400).catch(function (e) { if (n >= 3) throw e; return sleep(1500 * (n + 1) + Math.random() * 800).then(function () { return tryCop(n + 1); }); }); };
    return tryCop(0).then(function (f) { G.demSrc = 'cop30'; return fill(f); }).catch(function () { G.demSrc = 'srtm'; return D.terrarium(b, G.cell).then(fill); });
  }
  function getS2() {
    var q = function (cl) { return search({ collections: ['sentinel-2-l2a'], bbox: BB(), datetime: season(), query: { 'eo:cloud_cover': { lt: cl } }, sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }], limit: 40 }); };
    return q(5).then(function (it) { return it.length ? it : q(20); }).then(function (it) { if (!it.length) throw new Error('no scene');
      var off = function (s) { return function (x) { return x.properties['s2:processing_baseline'] >= '04.00' ? s.replace(/B(0[1-9]|1[0-2]|8A)/g, '(B$1-1000)') : s; }; };
      return mosaic(byDate(it), 'sentinel-2-l2a', function (x) { return 'expression=' + encodeURIComponent(off('(B08-B04)/(B08+B04);(B08-B11)/(B08+B11)')(x)) + '&asset_as_band=true'; }, 2, function (v) { return isFinite(v) && v >= -1 && v <= 1; }); });
  }
  var off2 = function (s) { return function (x) { return x.properties['s2:processing_baseline'] >= '04.00' ? s.replace(/B(0[1-9]|1[0-2]|8A)/g, '(B$1-1000)') : s; }; };
  function s2items(dt, lim) { var q = function (cl) { return search({ collections: ['sentinel-2-l2a'], bbox: BB(), datetime: dt, query: { 'eo:cloud_cover': { lt: cl } }, sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }], limit: lim || 40 }); };
    return q(5).then(function (it) { return it.length ? it : q(20); }).then(function (it) { if (!it.length) throw new Error('no scene'); return byDate(it); }); }
  /* archaeology: dry-season shortwave brightness (B11) and spring greenness (NDVI) */
  function getS2Arch() {
    var y = +SH.val('pYear'), south = (G.b.n + G.b.s) / 2 < 0, spring = south ? y + '-09-01T00:00:00Z/' + y + '-10-31T23:59:59Z' : y + '-03-01T00:00:00Z/' + y + '-04-30T23:59:59Z', out = {};
    return s2items(season()).then(function (it) { return mosaic(it, 'sentinel-2-l2a', function (x) { return 'expression=' + encodeURIComponent(off2('B11/10000')(x)) + '&asset_as_band=true'; }, 1, function (v) { return isFinite(v) && v > 0 && v < 1.5; }); })
      .then(function (a) { out.b11 = a.arr[0]; out.d1 = a.used; return s2items(spring).then(function (it) { return mosaic(it, 'sentinel-2-l2a', function (x) { return 'expression=' + encodeURIComponent(off2('(B08-B04)/(B08+B04)')(x)) + '&asset_as_band=true'; }, 1, function (v) { return isFinite(v) && v >= -1 && v <= 1; }); }).then(function (b) { out.sndvi = b.arr[0]; out.d2 = b.used; }, function () {}); })
      .then(function () { return out; });
  }
  /* minerals: SWIR and visible band ratios with NDVI for masking, dry season (least vegetation) */
  function getS2Min() {
    return s2items(season()).then(function (it) { return mosaic(it, 'sentinel-2-l2a', function (x) { return 'expression=' + encodeURIComponent(off2('B11/B12;B04/B02;B11/B08;(B08-B04)/(B08+B04)')(x)) + '&asset_as_band=true'; }, 4, function (v, q) { return isFinite(v) && (q === 3 ? v >= -1 && v <= 1 : v > 0 && v < 10); }); });
  }
  function getLst() {
    var q = function (cl) { return search({ collections: ['landsat-c2-l2'], bbox: BB(), datetime: season(), query: { 'eo:cloud_cover': { lt: cl }, platform: { in: ['landsat-8', 'landsat-9'] } }, sortby: [{ field: 'eo:cloud_cover', direction: 'asc' }], limit: 30 }); };
    return q(10).then(function (it) { return it.length ? it : q(30); }).then(function (it) { if (!it.length) throw new Error('no scene');
      return mosaic(byDate(it), 'landsat-c2-l2', function () { return 'expression=' + encodeURIComponent('lwir11*0.00341802+149.0-273.15') + '&asset_as_band=true'; }, 1, function (v) { return isFinite(v) && v > -40 && v < 85; }, null, true); });
  }
  function getLc() {
    return search({ collections: ['esa-worldcover'], bbox: BB(), limit: 20 }).then(function (it) { if (!it.length) throw new Error('none');
      it.sort(function (a, b) { return (b.properties['esa_worldcover:product_version'] || '').localeCompare(a.properties['esa_worldcover:product_version'] || ''); });
      return mosaic(it, 'esa-worldcover', function () { return 'assets=map&resampling=nearest'; }, 1, function (v) { return !!LC[v]; }); });
  }
  /* rainfall: ten complete years of daily totals at 3 × 3 points, interpolated bilinearly */
  function getRain() {
    var y1 = new Date().getUTCFullYear() - 1, y0 = y1 - 9, la = [G.b.s, (G.b.s + G.b.n) / 2, G.b.n], lo = [G.b.w, (G.b.w + G.b.e) / 2, G.b.e], pl = [], pn = [];
    la.forEach(function (a) { lo.forEach(function (o) { pl.push(a.toFixed(4)); pn.push(o.toFixed(4)); }); });
    return SH.getJSON(OM + '?latitude=' + pl.join(',') + '&longitude=' + pn.join(',') + '&start_date=' + y0 + '-01-01&end_date=' + y1 + '-12-31&daily=precipitation_sum&timezone=UTC', { timeout: 60000 }).then(function (j) {
      var arr = Array.isArray(j) ? j : [j], P = arr.map(function (r) { var s = 0, n = 0; (r.daily.precipitation_sum || []).forEach(function (v) { if (v != null) { s += v; n++; } }); return n > 300 ? s / (n / 365.25) : NaN; });
      if (P.some(function (v) { return !isFinite(v); })) throw new Error('rain');
      var R = new Float32Array(G.n); for (var j2 = 0; j2 < G.ny; j2++) for (var i = 0; i < G.nx; i++) { var fy = (G.lat(j2) - G.b.s) / (G.b.n - G.b.s) * 2, fx = (G.lon(i) - G.b.w) / (G.b.e - G.b.w) * 2, iy = Math.min(1, Math.floor(fy)), ix = Math.min(1, Math.floor(fx)), ty = fy - iy, tx = fx - ix, at = function (a, b) { return P[a * 3 + b]; };
        R[j2 * G.nx + i] = at(iy, ix) * (1 - tx) * (1 - ty) + at(iy, ix + 1) * tx * (1 - ty) + at(iy + 1, ix) * (1 - tx) * ty + at(iy + 1, ix + 1) * tx * ty; }
      G.rainYears = y0 + '–' + y1; return R; });
  }
  /* lithology: the most detailed geological map unit at a grid of points; each cell takes the unit of the nearest point */
  function getLith() {
    var k = km(G.b), ns = SH.clamp(Math.round(Math.sqrt(k.w * k.h) / 5), 4, 7), pts = [], units = {}, i, j;
    for (j = 0; j < ns; j++) for (i = 0; i < ns; i++) pts.push({ lat: G.b.s + (j + 0.5) / ns * (G.b.n - G.b.s), lon: G.b.w + (i + 0.5) / ns * (G.b.e - G.b.w) });
    var ORD = { large: 0, medium: 1, small: 2, tiny: 3 }, q = 0;
    var one = function (p) { return SH.getJSON(MS + 'geologic_units/map?lat=' + p.lat.toFixed(5) + '&lng=' + p.lon.toFixed(5), { timeout: 25000 }).then(function (jj) { var d = (jj && jj.success && jj.success.data) || [];
        d.sort(function (a, b) { return (ORD[a.scale] != null ? ORD[a.scale] : 9) - (ORD[b.scale] != null ? ORD[b.scale] : 9); }); var u = d[0]; if (!u) return;
        var id = String(u.map_id || u.name); if (!units[id]) { var txt = [u.lith, (u.liths || []).map(function (l) { return l.lith || l.name; }).join(' '), u.name, u.strat_name, u.descrip].join(' '), lk = lithKey([u.lith, u.name, u.strat_name, u.descrip].join(' ')), age = [u.b_int_name, u.t_int_name].filter(Boolean);
          if (!lk && /quaternary|holocene|pleistocene/i.test(age.join(' ') + ' ' + txt) && !/pliocene|miocene/i.test(u.b_int_name || '')) lk = 'quat';
          units[id] = { id: id, name: u.name || u.strat_name || '—', lith: u.lith || '', age: age.filter(function (v, x, a) { return a.indexOf(v) === x; }).join(' – '), color: u.color || '#cccccc', lk: lk, r: lk && RC.lith && RC.lith(lk) ? RC.lith(lk) : 3, rated: !!(lk && RC.lith && RC.lith(lk)), n: 0 }; }
        units[id].n++; p.u = id; }).catch(function () {}); };
    var run = function () { if (q >= pts.length) return Promise.resolve(); var b = pts.slice(q, q + 5); q += 5; return Promise.all(b.map(one)).then(run); };
    return run().then(function () {
      if (!Object.keys(units).length) throw new Error('none');
      var U = new Int32Array(G.n).fill(-1), ids = Object.keys(units);
      for (var c = 0; c < G.n; c++) { var j3 = Math.floor(c / G.nx), i3 = c % G.nx, best = -1, nd = 1e9;
        pts.forEach(function (p) { if (!p.u) return; var dd2 = Math.pow((p.lat - G.lat(j3)) / G.dlat, 2) + Math.pow((p.lon - G.lon(i3)) / G.dlon, 2); if (dd2 < nd) { nd = dd2; best = ids.indexOf(p.u); } }); U[c] = best; }
      G.units = ids.map(function (id) { return units[id]; }); G.lithPts = pts.filter(function (p) { return p.u; }).length; return U;
    });
  }
  /* ---------------------------------------------------------------- terrain analysis on the grid */
  function terrain(Z) {
    var nx = G.nx, ny = G.ny, n = G.n, dx = G.dx, dy = G.dy, i, j, c, k;
    var mean = 0, cnt = 0; for (c = 0; c < n; c++) if (isFinite(Z[c])) { mean += Z[c]; cnt++; } mean /= cnt || 1; for (c = 0; c < n; c++) if (!isFinite(Z[c])) Z[c] = mean;
    var at = function (i, j) { i = i < 0 ? 0 : i >= nx ? nx - 1 : i; j = j < 0 ? 0 : j >= ny ? ny - 1 : j; return Z[j * nx + i]; };
    var S = new Float32Array(n), HXX = new Float32Array(n), HYY = new Float32Array(n), HXY = new Float32Array(n);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var a = at(i - 1, j - 1), b = at(i, j - 1), cc = at(i + 1, j - 1), d = at(i - 1, j), e = at(i, j), f = at(i + 1, j), g = at(i - 1, j + 1), h = at(i, j + 1), q = at(i + 1, j + 1);
      var gx = ((cc + 2 * f + q) - (a + 2 * d + g)) / (8 * dx), gy = ((g + 2 * h + q) - (a + 2 * b + cc)) / (8 * dy); S[j * nx + i] = SH.deg(Math.atan(Math.sqrt(gx * gx + gy * gy)));
      HXX[j * nx + i] = (d - 2 * e + f) / (dx * dx); HYY[j * nx + i] = (b - 2 * e + h) / (dy * dy); HXY[j * nx + i] = (q - g - cc + a) / (4 * dx * dy); }
    /* priority-flood depression filling (Barnes et al. 2014) with a small gradient so every cell drains */
    var Fz = new Float64Array(n), done = new Uint8Array(n), heap = [], hp = function (v) { heap.push(v); var x = heap.length - 1; while (x > 0) { var p = (x - 1) >> 1; if (Fz[heap[p]] <= Fz[heap[x]]) break; var tmp = heap[p]; heap[p] = heap[x]; heap[x] = tmp; x = p; } },
      pop = function () { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var x = 0; for (;;) { var l = 2 * x + 1, r = l + 1, m = x; if (l < heap.length && Fz[heap[l]] < Fz[heap[m]]) m = l; if (r < heap.length && Fz[heap[r]] < Fz[heap[m]]) m = r; if (m === x) break; var tmp = heap[m]; heap[m] = heap[x]; heap[x] = tmp; x = m; } } return top; };
    for (c = 0; c < n; c++) Fz[c] = Z[c];
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { c = j * nx + i; done[c] = 1; hp(c); }
    var DI = [-1, 0, 1, -1, 1, -1, 0, 1], DJ = [-1, -1, -1, 0, 0, 1, 1, 1], DL = DI.map(function (u, x) { return Math.sqrt(Math.pow(u * dx, 2) + Math.pow(DJ[x] * dy, 2)); });
    while (heap.length) { c = pop(); i = c % nx; j = (c - i) / nx; for (k = 0; k < 8; k++) { var ii = i + DI[k], jj = j + DJ[k]; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; var nn = jj * nx + ii; if (done[nn]) continue; done[nn] = 1; if (Fz[nn] <= Fz[c]) Fz[nn] = Fz[c] + 1e-4; hp(nn); } }
    /* D8 flow directions and accumulation */
    var dn = new Int32Array(n).fill(-1), dl = new Float32Array(n);
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { c = j * nx + i; var best = 0; for (k = 0; k < 8; k++) { var i2 = i + DI[k], j2 = j + DJ[k]; if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny) continue; var s = (Fz[c] - Fz[j2 * nx + i2]) / DL[k]; if (s > best) { best = s; dn[c] = j2 * nx + i2; dl[c] = DL[k]; } } if (dn[c] < 0) dl[c] = Math.sqrt(dx * dy); }
    var ord = new Int32Array(n); for (c = 0; c < n; c++) ord[c] = c; ord.sort(function (a, b) { return Fz[b] - Fz[a]; });
    var acc = new Float32Array(n).fill(1); for (k = 0; k < n; k++) { c = ord[k]; if (dn[c] >= 0) acc[dn[c]] += acc[c]; }
    var cellA = dx * dy, thr = Math.max(0.5e6, 20 * cellA), LEN = new Float32Array(n), TW = new Float32Array(n), w = Math.sqrt(dx * dy);
    for (c = 0; c < n; c++) { if (acc[c] * cellA >= thr) LEN[c] = dl[c]; TW[c] = Math.log(acc[c] * cellA / w / Math.max(Math.tan(SH.rad(S[c])), 0.001)); }
    /* lineaments: elongated zones of strong one-directional curvature (linear valleys and scarps) in the terrain */
    var AN = new Float32Array(n), sgn = new Int8Array(n);
    for (c = 0; c < n; c++) { var tr = HXX[c] + HYY[c], df = Math.sqrt(Math.pow(HXX[c] - HYY[c], 2) + 4 * HXY[c] * HXY[c]), l1 = (tr + df) / 2, l2 = (tr - df) / 2, big = Math.abs(l1) > Math.abs(l2) ? l1 : l2, sm = Math.abs(l1) > Math.abs(l2) ? l2 : l1; AN[c] = Math.abs(big) - Math.abs(sm); sgn[c] = big > 0 ? 1 : -1; }
    var sorted = Array.prototype.slice.call(AN).sort(function (a, b) { return a - b; }), p88 = sorted[Math.floor(n * 0.88)], abs = 1.2 / (dx * dy), th = Math.max(p88, abs), M = new Uint8Array(n);
    for (c = 0; c < n; c++) { var ci0 = c % nx, cj0 = (c - ci0) / nx; if (AN[c] > th && S[c] > 0.4 && ci0 > 1 && cj0 > 1 && ci0 < nx - 2 && cj0 < ny - 2) M[c] = 1; } /* the border cells have one-sided curvature: left out */
    var LIN = new Float32Array(n), lab = new Int32Array(n).fill(-1), stack = [], segs = 0;
    for (c = 0; c < n; c++) { if (!M[c] || lab[c] >= 0) continue; var comp = [], sx = 0, sy = 0; stack.push(c); lab[c] = c;
      while (stack.length) { var u = stack.pop(), ui = u % nx, uj = (u - ui) / nx; comp.push(u); sx += ui; sy += uj; for (k = 0; k < 8; k++) { var vi = ui + DI[k], vj = uj + DJ[k]; if (vi < 0 || vj < 0 || vi >= nx || vj >= ny) continue; var v = vj * nx + vi; if (M[v] && lab[v] < 0 && sgn[v] === sgn[c]) { lab[v] = c; stack.push(v); } } }
      if (comp.length < 4) continue; var mx = sx / comp.length, my = sy / comp.length, cxx = 0, cyy = 0, cxy = 0;
      comp.forEach(function (u) { var ex = (u % nx - mx) * dx, ey = ((u - u % nx) / nx - my) * dy; cxx += ex * ex; cyy += ey * ey; cxy += ex * ey; }); cxx /= comp.length; cyy /= comp.length; cxy /= comp.length;
      var tt = cxx + cyy, dd = Math.sqrt(Math.pow(cxx - cyy, 2) + 4 * cxy * cxy), la = (tt + dd) / 2, lb = Math.max((tt - dd) / 2, 1e-6);
      if (la / lb < 9) continue; /* axis ratio ≥ 3 */ var len = 4 * Math.sqrt(la); segs++; comp.forEach(function (u) { LIN[u] = len / comp.length; }); }
    if (userLin) { LIN.fill(0); rasterLines(userLin, LIN); }
    var R1 = SH.clamp(Math.round(1000 / G.cell), 2, 14), R2 = SH.clamp(Math.round(1500 / G.cell), 3, 18);
    /* rivers and large wadis: a real contributing area of at least 25 km² (on flat plains there may be none: water then comes from the land-cover map) */
    var STR = new Uint8Array(n); for (c = 0; c < n; c++) if (acc[c] * cellA >= Math.max(25e6, 100 * cellA)) STR[c] = 1;
    /* mound relief: height above the mean ground within about 500 m, capped in hilly ground where ridges mimic mounds */
    var rM = SH.clamp(Math.round(450 / G.cell), 2, 10), ZM = boxMean(Z, rM), SM2 = boxMean(S, rM), MOUND = new Float32Array(n);
    for (c = 0; c < n; c++) { var an = Z[c] - ZM[c]; MOUND[c] = SM2[c] > 4 ? Math.min(an, 1) : an; }
    var LM = new Uint8Array(n); for (c = 0; c < n; c++) if (LIN[c] > 0) LM[c] = 1;
    return { slope: S, dd: density(LEN, R1), twi: TW, lin: density(LIN, R2), fill: Fz, acc: acc, chan: LEN, linRaw: LIN, segs: segs, R1: R1, R2: R2, streams: STR, mound: MOUND, prox: dist(LM) };
  }
  /* length per cell summed in a square window → km per km² */
  function density(LEN, R) {
    var nx = G.nx, ny = G.ny, I = new Float64Array((nx + 1) * (ny + 1)), i, j, out = new Float32Array(G.n);
    for (j = 0; j < ny; j++) { var row = 0; for (i = 0; i < nx; i++) { row += LEN[j * nx + i]; I[(j + 1) * (nx + 1) + i + 1] = I[j * (nx + 1) + i + 1] + row; } }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var i0 = Math.max(0, i - R), i1 = Math.min(nx, i + R + 1), j0 = Math.max(0, j - R), j1 = Math.min(ny, j + R + 1), s = I[j1 * (nx + 1) + i1] - I[j0 * (nx + 1) + i1] - I[j1 * (nx + 1) + i0] + I[j0 * (nx + 1) + i0];
      out[j * nx + i] = (s / 1000) / ((i1 - i0) * (j1 - j0) * G.dx * G.dy / 1e6); }
    return out;
  }
  /* mean in a square window of radius R cells, ignoring missing cells */
  function boxMean(A, R) {
    var nx = G.nx, ny = G.ny, I = new Float64Array((nx + 1) * (ny + 1)), N = new Float64Array((nx + 1) * (ny + 1)), out = new Float32Array(G.n), i, j;
    for (j = 0; j < ny; j++) { var rs = 0, rn = 0; for (i = 0; i < nx; i++) { var v = A[j * nx + i]; if (isFinite(v)) { rs += v; rn++; } I[(j + 1) * (nx + 1) + i + 1] = I[j * (nx + 1) + i + 1] + rs; N[(j + 1) * (nx + 1) + i + 1] = N[j * (nx + 1) + i + 1] + rn; } }
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { var i0 = Math.max(0, i - R), i1 = Math.min(nx, i + R + 1), j0 = Math.max(0, j - R), j1 = Math.min(ny, j + R + 1), q = function (M) { return M[j1 * (nx + 1) + i1] - M[j0 * (nx + 1) + i1] - M[j1 * (nx + 1) + i0] + M[j0 * (nx + 1) + i0]; }, cn = q(N);
      out[j * nx + i] = cn ? q(I) / cn : NaN; }
    return out;
  }
  /* Euclidean-like distance (two-pass chamfer with the true cell sizes) from the cells where mask is set; NaN when none */
  function dist(mask, near) {
    var nx = G.nx, ny = G.ny, d = new Float32Array(G.n), at = new Int32Array(G.n), INF = 1e12, dx = G.dx, dy = G.dy, dg = Math.hypot(dx, dy), i, j, c, v, any = false;
    for (c = 0; c < G.n; c++) { d[c] = mask[c] ? 0 : INF; at[c] = c; if (mask[c]) any = true; } if (!any) return near ? { d: d.fill(NaN), at: at } : d.fill(NaN);
    var up = function (c, o, w) { if (d[o] + w < d[c]) { d[c] = d[o] + w; at[c] = at[o]; } };
    for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) { c = j * nx + i; if (i > 0) up(c, c - 1, dx); if (j > 0) { up(c, c - nx, dy); if (i > 0) up(c, c - nx - 1, dg); if (i < nx - 1) up(c, c - nx + 1, dg); } }
    for (j = ny - 1; j >= 0; j--) for (i = nx - 1; i >= 0; i--) { c = j * nx + i; if (i < nx - 1) up(c, c + 1, dx); if (j < ny - 1) { up(c, c + nx, dy); if (i < nx - 1) up(c, c + nx + 1, dg); if (i > 0) up(c, c + nx - 1, dg); } }
    return near ? { d: d, at: at } : d;
  }
  /* block mean over k × k cells, written back to every cell of the block (generalisation) */
  function block(A, k, mx) {
    if (k <= 1) return A; var out = new Float32Array(G.n).fill(NaN);
    for (var bj = 0; bj < G.ny; bj += k) for (var bi = 0; bi < G.nx; bi += k) { var s2 = 0, n2 = 0, i, j; for (j = bj; j < Math.min(G.ny, bj + k); j++) for (i = bi; i < Math.min(G.nx, bi + k); i++) { var v = A[j * G.nx + i]; if (isFinite(v)) { s2 = mx ? (n2 ? Math.max(s2, v) : v) : s2 + v; n2++; } }
      if (n2 < k * k / 4) continue; var m = mx ? s2 : s2 / n2; for (j = bj; j < Math.min(G.ny, bj + k); j++) for (i = bi; i < Math.min(G.nx, bi + k); i++) out[j * G.nx + i] = m; }
    return out;
  }
  function rasterLines(gj, LIN) {
    var segs = []; (gj.features || [gj]).forEach(function (f) { var g = f.geometry || f, cs = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []; cs.forEach(function (l) { for (var k = 1; k < l.length; k++) segs.push([l[k - 1], l[k]]); }); });
    segs.forEach(function (s) { var a = s[0], b = s[1], m = D.metersPerDeg((a[1] + b[1]) / 2), len = Math.hypot((b[0] - a[0]) * m.x, (b[1] - a[1]) * m.y), st = Math.max(1, Math.ceil(len / (G.cell / 2))), per = len / st;
      for (var k = 0; k < st; k++) { var f = (k + 0.5) / st, lo = a[0] + (b[0] - a[0]) * f, la = a[1] + (b[1] - a[1]) * f, i = Math.floor((lo - G.b.w) / G.dlon), j = Math.floor((G.b.n - la) / G.dlat); if (i >= 0 && j >= 0 && i < G.nx && j < G.ny) LIN[j * G.nx + i] += per; } });
  }
  $('#pLinF').addEventListener('change', function () { var f = this.files[0]; if (!f) return; f.text().then(function (s) { var gj = JSON.parse(s), n = 0; (gj.features || [gj]).forEach(function (x) { var g = x.geometry || x; if (/LineString/.test(g.type)) n++; }); if (!n) throw new Error();
    userLin = gj; $('#pLinS').textContent = t('Your lineaments: ', 'خطوطك التركيبية: ') + n + t(' lines. They replace the automatic extraction on the next build.', ' خطاً. ستحل محل الاستخراج الآلي في الإنشاء القادم.'); }).catch(function () { SH.toast(t('The file holds no lines in GeoJSON.', 'لا يحتوي الملف على خطوط بصيغة GeoJSON.'), 'bad'); }); this.value = ''; });

  /* ---------------------------------------------------------------- ratings, index, classes */
  function pct(arr, ps) { var v = []; for (var c = 0; c < arr.length; c++) if (isFinite(arr[c])) v.push(arr[c]); v.sort(function (a, b) { return a - b; }); return ps.map(function (p) { return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : NaN; }); }
  function rate(f) {
    var raw = G.raw[f.k], R = new Float32Array(G.n).fill(NaN), c; if (!raw) return null;
    if (f.k === 'lulc') { for (c = 0; c < G.n; c++) if (LC[raw[c]]) R[c] = RC.lc(raw[c]); return R; }
    if (f.k === 'lith') { for (c = 0; c < G.n; c++) { var u = G.units[raw[c]]; if (u) R[c] = u.r; } return R; }
    var br = f.br; if (f.kind === 'z') { var sm = 0, sn = 0, ss = 0; for (c = 0; c < G.n; c++) if (isFinite(raw[c])) { sm += raw[c]; sn++; } sm /= sn || 1; for (c = 0; c < G.n; c++) if (isFinite(raw[c])) ss += Math.pow(raw[c] - sm, 2); var sd = Math.sqrt(ss / (sn || 1)); f.zs = [sm, sd]; br = sd > 1e-9 ? [0, 0.5, 1, 2].map(function (z) { return sm + z * sd; }) : null; }
    if (f.kind === 'q') { var q = pct(raw, [0.02, 0.2, 0.4, 0.6, 0.8, 0.98]); f.qb = q.slice(1, 5); f.rng = [q[0], q[5]]; br = (q[5] - q[0]) > 1e-6 ? f.qb : null; }
    for (c = 0; c < G.n; c++) { var v = raw[c]; if (!isFinite(v)) continue; if (!br) { R[c] = 3; continue; } var x = 0; while (x < 4 && v >= br[x]) x++; R[c] = f.rs ? f.rs[x] : f.dir > 0 ? x + 1 : 5 - x; }
    return R;
  }
  function jenks(data, k) {
    var n = data.length, mat1 = [], mat2 = [], i, j, l, m;
    for (i = 0; i <= n; i++) { mat1.push(new Array(k + 1).fill(0)); mat2.push(new Array(k + 1).fill(0)); }
    for (i = 1; i <= k; i++) { mat1[1][i] = 1; mat2[1][i] = 0; for (j = 2; j <= n; j++) mat2[j][i] = Infinity; }
    for (l = 2; l <= n; l++) { var s1 = 0, s2 = 0, w = 0, v = 0; for (m = 1; m <= l; m++) { var i3 = l - m + 1, val = data[i3 - 1]; s2 += val * val; s1 += val; w++; v = s2 - (s1 * s1) / w; var i4 = i3 - 1; if (i4 !== 0) for (j = 2; j <= k; j++) if (mat2[l][j] >= v + mat2[i4][j - 1]) { mat1[l][j] = i3; mat2[l][j] = v + mat2[i4][j - 1]; } }
      mat1[l][1] = 1; mat2[l][1] = v; }
    var br = [], kk = n; for (j = k; j >= 2; j--) { var id = mat1[kk][j] - 2; br.unshift(data[id + 1]); kk = mat1[kk][j] - 1; } return br; /* lower limits of classes 2..k */
  }
  function breaks(IDX) {
    var v = []; for (var c = 0; c < G.n; c++) if (isFinite(IDX[c])) v.push(IDX[c]); v.sort(function (a, b) { return a - b; }); if (v.length < 10) return null;
    var lo = v[0], hi = v[v.length - 1], m = SH.val('pCls');
    if (m === 'equal') return [1, 2, 3, 4].map(function (x) { return lo + (hi - lo) * x / 5; });
    if (m === 'quant') return [1, 2, 3, 4].map(function (x) { return v[Math.floor(v.length * x / 5)]; });
    var s = [], st = Math.max(1, Math.floor(v.length / 1500)); for (var k = 0; k < v.length; k += st) s.push(v[k]); return jenks(s, 5);
  }
  /* weighted linear combination, renormalised in each cell over the layers present there */
  function compose() {
    weights(); var act = F.filter(function (f) { return f.on && f.w > 0 && G.rate[f.k]; }), tot = act.reduce(function (a, f) { return a + f.w; }, 0), IDX = new Float32Array(G.n).fill(NaN), c;
    if (!act.length) { SH.toast(t('No layer is available.', 'لا توجد طبقة متاحة.'), 'warn'); return; }
    for (c = 0; c < G.n; c++) { var s = 0, w = 0; act.forEach(function (f) { var r = G.rate[f.k][c]; if (isFinite(r)) { s += f.w * r; w += f.w; } }); if (w >= 0.5 * tot) IDX[c] = s / w; }
    /* 3 × 3 mean of the index: removes single-cell speckle so the zones read as mappable units */
    var SM = new Float32Array(G.n).fill(NaN); for (c = 0; c < G.n; c++) { if (!isFinite(IDX[c])) continue; var ci = c % G.nx, cj = (c - ci) / G.nx, sm = 0, sn = 0; for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) { var ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= G.nx || jj >= G.ny) continue; var vv = IDX[jj * G.nx + ii]; if (isFinite(vv)) { sm += vv; sn++; } } SM[c] = sm / sn; }
    IDX = RC.gen ? block(IDX, G.gen) : SM;
    var br = breaks(IDX), CL = new Int8Array(G.n).fill(-1); if (!br) { SH.toast(t('Too few cells with data.', 'الخلايا التي فيها بيانات قليلة جداً.'), 'bad'); return; }
    for (c = 0; c < G.n; c++) { if (!isFinite(IDX[c])) continue; var x = 0; while (x < 4 && IDX[c] >= br[x]) x++; CL[c] = x; }
    G.idx = IDX; G.cls = CL; G.br = br; G.act = act; G.done = true; showOpts(); draw(); results(); if (wells.length) validate(true);
  }

  /* ---------------------------------------------------------------- build */
  function grid(b) {
    var k = km(b), area = k.w * k.h, side = { fine: Math.round(RC.side * 1.35), coarse: Math.round(RC.side * 0.64) }[SH.val('pRes')] || RC.side, cell = Math.max(30, Math.sqrt(area * 1e6) / side);
    var nx = Math.max(20, Math.round(k.w * 1000 / cell)), ny = Math.max(20, Math.round(k.h * 1000 / cell)), m = D.metersPerDeg((b.n + b.s) / 2), dlon = (b.e - b.w) / nx, dlat = (b.n - b.s) / ny;
    return { b: b, nx: nx, ny: ny, n: nx * ny, dlon: dlon, dlat: dlat, dx: dlon * m.x, dy: dlat * m.y, cell: Math.sqrt(dlon * m.x * dlat * m.y), area: area, lat: function (j) { return b.n - (j + 0.5) * dlat; }, lon: function (i) { return b.w + (i + 0.5) * dlon; }, raw: {}, rate: {} };
  }
  function prog(s) { $('#pProg').innerHTML = s; }
  function run() {
    if (busy) return; if (!aoi) { SH.toast(t('Draw the area first.', 'ارسم المنطقة أولاً.'), 'warn'); return; }
    var k = km(aoi), a = k.w * k.h; if (a > 2500 || a < 4) { SH.toast(t('Keep the area between 4 and 2500 km².', 'اجعل المساحة بين 4 و2500 كم².'), 'warn'); return; }
    if (!SH.pro()) { SH.needPro(); return; }
    persist.save(); busy = true; $('#pRun').disabled = true; G = grid(aoi); F.forEach(function (f) { status(f.k, f.on ? 'run' : 'off'); }); weights();
    var need = {}; F.forEach(function (f) { need[f.src] = 1; }); if (RC.k !== 'gw') need.lc = 1;
    var host = $('.wsm-map'), done = 0, total = Object.keys(need).length, step = function () { done++; prog(t('Data sources ready: ', 'مصادر البيانات الجاهزة: ') + '<b class="ltr">' + done + ' / ' + total + '</b>'); };
    SH.busy(host, true, t('Reading the evidence layers for your area…', 'جارٍ قراءة طبقات الأدلة لمنطقتك…')); prog(t('Starting…', 'جارٍ البدء…'));
    var lay = function (src) { return F.filter(function (f) { return f.src === src; }).map(function (f) { return f.k; }); };
    var set = function (src, fn) { if (!need[src]) return Promise.resolve(null); return fn().then(function (v) { lay(src).forEach(function (kk) { status(kk, 'ok'); }); step(); return v; }, function () { lay(src).forEach(function (kk) { status(kk, 'bad'); }); step(); return null; }); };
    var dates = function (it) { return (it || []).map(function (i) { return i.properties.datetime.slice(0, 10); }); };
    /* the imagery service is called one request at a time; the geology and climate services in parallel */
    var pc = set('dem', function () { return getDem().then(function (Z) { G.z = Z; return terrain(Z); }); })
      .then(function (T) { if (T) { G.T = T; ['slope', 'dd', 'twi', 'lin', 'mound', 'prox'].forEach(function (kk) { if (FK[kk]) G.raw[kk] = T[kk]; }); } return set('s2g', getS2); })
      .then(function (s2) { if (s2) { G.raw.ndvi = s2.arr[0]; G.raw.ndmi = s2.arr[1]; G.s2 = dates(s2.used); } return set('s2a', getS2Arch); })
      .then(function (s2) { if (s2) { G.a = s2; G.s2 = dates(s2.d1); G.s2b = dates(s2.d2); } return set('s2m', getS2Min); })
      .then(function (s2) { if (s2) { G.m = s2.arr; G.s2 = dates(s2.used); } return set('lst', getLst); })
      .then(function (s2) { if (s2) { G.raw.lst = s2.arr[0]; G.ls = dates(s2.used); } return set('lc', getLc); })
      .then(function (s2) { if (s2) G.raw.lulc = s2.arr[0]; });
    var rn = set('rain', getRain).then(function (r) { if (r) G.raw.rain = r; });
    var lt = set('lith', getLith).then(function (U) { if (U) G.raw.lith = U; });
    Promise.all([pc, rn, lt]).then(function () {
      post();
      F.forEach(function (f) { var rr = G.raw[f.k] ? rate(f) : null; if (rr && !Array.prototype.some.call(rr, isFinite)) rr = null; G.rate[f.k] = rr; if (!rr && f.on) status(f.k, 'bad'); });
      var bad = F.filter(function (f) { return f.on && f.st === 'bad'; }); prog(bad.length ? '<span style="color:var(--warn)">' + t('Not available for this area, left out: ', 'غير متاحة لهذه المنطقة واستُبعدت: ') + bad.map(function (f) { return f.n; }).join(t(', ', '، ')) + '</span>' : t('All layers ready.', 'كل الطبقات جاهزة.'));
      compose(); if (map) map.fitBounds([[G.b.s, G.b.w], [G.b.n, G.b.e]]); if (window.innerWidth < 900) $('#pMap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { busy = false; $('#pRun').disabled = false; SH.busy(host, false); });
  }
  /* layers that combine sources, masks, and generalisation for archaeology */
  function post() {
    var c, LCw = G.raw.lulc;
    if (RC.k === 'arch') {
      /* drainage = mapped water and wetland plus streams draining ≥ 5 km²; distance to it, and height above the nearest drainage cell */
      if (G.T) { var wm = new Uint8Array(G.n), any = false; for (c = 0; c < G.n; c++) if (G.T.streams[c] || (LCw && (LCw[c] === 80 || LCw[c] === 90))) { wm[c] = 1; any = true; }
        if (any) { var NR = dist(wm, true); G.raw.water = NR.d; var H = new Float32Array(G.n), ZS = boxMean(G.z, 1); for (c = 0; c < G.n; c++) H[c] = Math.max(0, ZS[c] - G.z[NR.at[c]]); G.raw.hand = H; } else { G.raw.water = null; G.raw.hand = null; } }
      if (G.a && G.a.b11) { var rB = SH.clamp(Math.round(600 / G.cell), 3, 12), BM = boxMean(G.a.b11, rB), BR = new Float32Array(G.n); for (c = 0; c < G.n; c++) BR[c] = G.a.b11[c] - BM[c]; G.raw.bright = BR; }
      if (G.a && G.a.sndvi) { var NM = boxMean(G.a.sndvi, SH.clamp(Math.round(600 / G.cell), 3, 12)), CR2 = new Float32Array(G.n).fill(NaN), nC = 0; for (c = 0; c < G.n; c++) if (isFinite(G.a.sndvi[c]) && NM[c] >= 0.2) { CR2[c] = NM[c] - G.a.sndvi[c]; nC++; } G.raw.crop = nC > G.n * 0.02 ? CR2 : null; }
      G.gen = Math.max(1, Math.round(RC.gen / G.cell)); ['mound', 'bright', 'crop'].forEach(function (k) { if (G.raw[k]) G.raw[k] = block(boxMean(G.raw[k], 1), G.gen, true); }); /* the strongest smoothed signal in each block, so a 300 m mound is not averaged away */
    }
    if (RC.k === 'min' && G.m) {
      var masked = 0, ok = 0; for (c = 0; c < G.n; c++) { if (!isFinite(G.m[0][c])) continue; var lc = LCw ? LCw[c] : 60; if (G.m[3][c] > 0.25 || lc === 10 || lc === 40 || lc === 50 || lc === 80 || lc === 90 || lc === 95) { G.m[0][c] = G.m[1][c] = G.m[2][c] = NaN; masked++; } else ok++; }
      G.masked = masked / ((masked + ok) || 1); if (ok > 50) { G.raw.clay = G.m[0]; G.raw.iron = G.m[1]; G.raw.ferr = G.m[2]; }
    }
  }
  $('#pRun').addEventListener('click', run);
  $('#pCls').addEventListener('change', function () { persist.save(); if (G && G.done) compose(); });

  /* ---------------------------------------------------------------- map display */
  var VIR = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function ramp(f) { f = SH.clamp(f, 0, 1) * (VIR.length - 1); var i = Math.min(VIR.length - 2, Math.floor(f)), a = hex(VIR[i]), b = hex(VIR[i + 1]), u = f - i; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
  function showOpts() {
    var cur = SH.val('pShow') || 'cls', o = '<option value="cls">' + t('Potential classes', 'فئات الاحتمالية') + '</option><option value="idx">' + t('Potential index (1–5)', 'مؤشر الاحتمالية (1–5)') + '</option>';
    F.forEach(function (f) { if (!G.raw[f.k]) return; o += '<optgroup label="' + SH.esc(f.n) + '"><option value="r:' + f.k + '">' + t('Rating 1–5', 'التقييم 1–5') + '</option><option value="v:' + f.k + '">' + t('Values', 'القيم') + '</option></optgroup>'; });
    $('#pShow').innerHTML = o; $('#pShow').value = /^(cls|idx|[rv]:\w+)$/.test(cur) && $('#pShow').querySelector('option[value="' + cur + '"]') ? cur : 'cls';
  }
  /* canvas of the chosen view; returns {url, legend} */
  function paint(view, solid) {
    var cv = document.createElement('canvas'); cv.width = G.nx; cv.height = G.ny; var x = cv.getContext('2d'), im = x.createImageData(G.nx, G.ny), d = im.data, c, col, leg;
    var put = function (c, rgb, a) { d[c * 4] = rgb[0]; d[c * 4 + 1] = rgb[1]; d[c * 4 + 2] = rgb[2]; d[c * 4 + 3] = a == null ? 255 : a; };
    var CR = CLS.map(function (q) { return hex(q[0]); });
    if (view === 'cls') { for (c = 0; c < G.n; c++) if (G.cls[c] >= 0) put(c, CR[G.cls[c]]); leg = { title: RC.title, sw: CLS.map(function (q) { return [q[0], AR ? q[2] : q[1]]; }) }; }
    else if (view === 'idx' || view[0] === 'v' && FK[view.slice(2)].kind !== 'cat') {
      var arr = view === 'idx' ? G.idx : G.raw[view.slice(2)], q = view === 'idx' ? [1, 5] : pct(arr, [0.02, 0.98]), f = FK[view.slice(2)], inv = view !== 'idx' && f && f.dir < 0;
      for (c = 0; c < G.n; c++) if (isFinite(arr[c])) put(c, ramp((arr[c] - q[0]) / ((q[1] - q[0]) || 1)));
      leg = { title: view === 'idx' ? t('Potential index', 'مؤشر الاحتمالية') : f.n + (f.u ? ' (' + f.u + ')' : ''), grad: [q[0], q[1]], dp: view === 'idx' ? 1 : f.dp, note: inv ? t('Lower values rate higher.', 'القيم الأدنى تُقيّم أعلى.') : '' }; }
    else if (view[0] === 'r') { var R = G.rate[view.slice(2)]; for (c = 0; c < G.n; c++) if (isFinite(R[c])) put(c, CR[Math.round(R[c]) - 1]); leg = { title: FK[view.slice(2)].n + ' · ' + t('rating', 'التقييم'), sw: CLS.map(function (q, i) { return [q[0], (i + 1) + ' · ' + (AR ? q[2] : q[1])]; }) }; }
    else if (view === 'v:lulc') { var seen = {}; for (c = 0; c < G.n; c++) { var v = G.raw.lulc[c]; if (LC[v]) { put(c, hex(LC[v][0])); seen[v] = (seen[v] || 0) + 1; } } leg = { title: FK.lulc.n, sw: Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; }).map(function (v) { return [LC[v][0], (AR ? LC[v][2] : LC[v][1]) + ' · ' + RC.lc(v)]; }) }; }
    else if (view === 'v:lith') { var su = {}; for (c = 0; c < G.n; c++) { var u = G.units[G.raw.lith[c]]; if (u) { put(c, hex(u.color)); su[G.raw.lith[c]] = 1; } } leg = { title: FK.lith.n, sw: Object.keys(su).map(function (i) { var u = G.units[i]; return [u.color, u.name + ' · ' + u.r]; }) }; }
    x.putImageData(im, 0, 0); return { url: cv.toDataURL('image/png'), leg: leg };
  }
  function draw() {
    if (!G || !G.done || !map) return; var P = paint(SH.val('pShow') || 'cls'); if (ov) map.removeLayer(ov);
    ov = L.imageOverlay(P.url, [[G.b.s, G.b.w], [G.b.n, G.b.e]], { opacity: +SH.val('pOp'), interactive: false }).addTo(map); var el = ov.getElement(); if (el) el.style.imageRendering = 'pixelated';
    var lg = $('#pLeg'), Lg = P.leg; lg.hidden = false;
    lg.innerHTML = '<div style="font-weight:800;margin-bottom:6px">' + SH.esc(Lg.title) + '</div>' + (Lg.sw ? '<div class="pz-cls">' + Lg.sw.slice(0, 9).map(function (s) { return '<div style="grid-template-columns:16px 1fr"><i style="background:' + s[0] + '"></i><span>' + SH.esc(s[1]) + '</span></div>'; }).join('') + '</div>'
      : '<div class="gr" style="background:linear-gradient(90deg,' + VIR.join(',') + ')"></div><div class="sc"><span>' + SH.fmt(Lg.grad[0], Lg.dp) + '</span><span>' + SH.fmt((Lg.grad[0] + Lg.grad[1]) / 2, Lg.dp) + '</span><span>' + SH.fmt(Lg.grad[1], Lg.dp) + '</span></div>' + (Lg.note ? '<div class="xsmall muted" style="margin-top:4px">' + Lg.note + '</div>' : ''));
  }
  $('#pShow').addEventListener('change', draw); $('#pOp').addEventListener('input', function () { if (ov) ov.setOpacity(+this.value); });

  /* ---------------------------------------------------------------- probe */
  function cellAt(lat, lon) { if (!G) return -1; var i = Math.floor((lon - G.b.w) / G.dlon), j = Math.floor((G.b.n - lat) / G.dlat); return i < 0 || j < 0 || i >= G.nx || j >= G.ny ? -1 : j * G.nx + i; }
  function valTxt(f, c) { var v = G.raw[f.k] ? G.raw[f.k][c] : NaN; if (f.k === 'lulc') return LC[v] ? (AR ? LC[v][2] : LC[v][1]) : '—'; if (f.k === 'lith') { var u = G.units[v]; return u ? u.name : '—'; } return isFinite(v) ? SH.fmt(v, f.dp) + (f.u ? ' ' + f.u : '') : '—'; }
  if (map) map.on('click', function (e) {
    if (addMode) { wells.push({ lat: e.latlng.lat, lon: e.latlng.lng }); saveWells(); return; }
    var c = cellAt(e.latlng.lat, e.latlng.lng); if (c < 0 || !G || !G.done) return;
    var h = '<div class="pz-pop"><b>' + (G.cls[c] >= 0 ? t('Potential: ', 'الاحتمالية: ') + (AR ? CLS[G.cls[c]][2] : CLS[G.cls[c]][1]) + ' · <span class="ltr">' + SH.fmt(G.idx[c], 2) + '</span>' : t('No data', 'لا بيانات')) + '</b><table><tr><td></td><td class="num">' + t('value', 'القيمة') + '</td><td class="num">' + t('rating', 'التقييم') + '</td><td class="num">' + t('weight', 'الوزن') + '</td></tr>' +
      F.filter(function (f) { return G.raw[f.k]; }).map(function (f) { var r = G.rate[f.k] ? G.rate[f.k][c] : NaN; return '<tr><td>' + SH.esc(f.n) + '</td><td class="num">' + SH.esc(valTxt(f, c)) + '</td><td class="num"><b>' + (isFinite(r) ? r : '—') + '</b></td><td class="num">' + (f.on && f.w ? SH.fmt(f.w * 100, 0) + '%' : '—') + '</td></tr>'; }).join('') + '</table><span class="ltr" style="color:#666">' + SH.fmtLatLon(e.latlng.lat, e.latlng.lng, 4) + '</span></div>';
    L.popup({ maxWidth: 340 }).setLatLng(e.latlng).setContent(h).openOn(map);
  });

  /* ---------------------------------------------------------------- results panel */
  function areas() { var n = [0, 0, 0, 0, 0], tot = 0; for (var c = 0; c < G.n; c++) if (G.cls[c] >= 0) { n[G.cls[c]]++; tot++; } var ca = G.dx * G.dy / 1e6; return n.map(function (v) { return { n: v, km2: v * ca, p: 100 * v / (tot || 1) }; }); }
  function results() {
    var A = areas(), hi = A[3].p + A[4].p, hk = A[3].km2 + A[4].km2;
    /* which layers set the high zones apart: mean rating inside high + very high minus the area mean */
    var drv = G.act.map(function (f) { var s1 = 0, n1 = 0, s0 = 0, n0 = 0, R = G.rate[f.k]; for (var c = 0; c < G.n; c++) { if (!isFinite(R[c]) || G.cls[c] < 0) continue; s0 += R[c]; n0++; if (G.cls[c] >= 3) { s1 += R[c]; n1++; } } return { f: f, d: n1 && n0 ? s1 / n1 - s0 / n0 : 0, m: n1 ? s1 / n1 : NaN }; }).sort(function (a, b) { return b.d * b.f.w - a.d * a.f.w; });
    var top = drv.filter(function (x) { return x.d > 0.15; }).slice(0, 3);
    var txt = t('High and very high potential cover ', 'تغطي الاحتمالية العالية والعالية جداً ') + '<b class="ltr">' + SH.fmt(hi, 1) + ' %</b>' + t(' of the area (', ' من المنطقة (') + '<span class="ltr">' + SH.fmt(hk, 1) + ' km²</span>). ' +
      (top.length ? t('The layers that set them apart most are ', 'وأكثر الطبقات تمييزاً لها: ') + top.map(function (x) { return '<b>' + SH.esc(x.f.n) + '</b>'; }).join(t(', ', '، ')) + t('; each rates clearly higher there than in the rest of the area. ', '؛ إذ يرتفع تقييم كل منها فيها بوضوح عن بقية المنطقة. ') : '') +
      RC.end + (RC.k === 'arch' ? ' ' + t('Cells are generalised to about ', 'الخلايا معمّمة إلى نحو ') + '<span class="ltr">' + SH.fmt(G.gen * G.cell / 1000, 1) + ' km</span>' + t(' to protect unrecorded sites.', ' لحماية المواقع غير المسجلة.') + (G.cell > 90 ? ' <span style="color:var(--warn)">' + t('Cells are coarser than 90 m, so small mounds blur; a smaller area gives finer cells.', 'الخلايا أخشن من 90 م فتضيع التلول الصغيرة؛ المساحة الأصغر تعطي خلايا أدق.') + '</span>' : '') : '') +
      (RC.k === 'min' && G.masked != null ? ' ' + t('Vegetation, fields, water and towns hide ', 'تحجب النباتات والحقول والمياه والمدن ') + '<b class="ltr">' + SH.fmt(G.masked * 100, 0) + ' %</b>' + t(' of the area from the spectral layers; only the structural and rock layers rate it.', ' من المنطقة عن الطبقات الطيفية، فلا تقيّمها هناك إلا طبقتا التراكيب والصخر.') : '');
    var u = G.units ? G.units.slice().sort(function (a, b) { return b.n - a.n; }) : [];
    var neutral = u.length && FK.lith && FK.lith.on && u.every(function (x) { return !x.rated; });
    var lithTbl = u.length ? '<details' + (u.some(function (x) { return !x.rated; }) ? ' open' : '') + '><summary class="small" style="cursor:pointer;font-weight:700">' + t('Rock units and their ratings', 'الوحدات الصخرية وتقييمها') + '</summary><p class="xsmall muted" style="margin:6px 0">' + t('Read from the geological map at ', 'قُرئت من الخريطة الجيولوجية عند ') + G.lithPts + t(' points; boundaries are approximate at that spacing. A unit whose rock type is not stated is rated 3; set it from your knowledge of the area.', ' نقطة، والحدود تقريبية بقدر تباعدها. الوحدة التي لم يُذكر نوع صخرها تُقيّم 3؛ عدّل تقييمها من معرفتك بالمنطقة.') + '</p><table class="pz-units"><tbody>' +
      u.map(function (x) { var ix = G.units.indexOf(x); return '<tr><td><i style="background:' + x.color + '"></i></td><td>' + SH.esc(x.name) + (x.age ? '<br><span class="muted">' + SH.esc(x.age) + '</span>' : '') + (x.lk ? '<br><span class="muted">' + SH.esc(AR ? LITH[x.lk][2] : LITH[x.lk][1]) + '</span>' : '') + '</td><td><select data-u="' + ix + '" aria-label="' + t('Rating', 'التقييم') + '">' + [1, 2, 3, 4, 5].map(function (r) { return '<option' + (r === x.r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></details>' : '';
    var srcs = [G.s2 && G.s2.length ? t('Optical scenes: ', 'المشاهد البصرية: ') + uniq(G.s2).join(t(', ', '، ')) : '', G.s2b && G.s2b.length ? t('Spring scenes: ', 'مشاهد الربيع: ') + uniq(G.s2b).join(t(', ', '، ')) : '', G.ls && G.ls.length ? t('Thermal scenes: ', 'المشاهد الحرارية: ') + uniq(G.ls).join(t(', ', '، ')) : '', G.rainYears ? t('Rainfall years: ', 'سنوات الأمطار: ') + G.rainYears : '', G.T && (FK.lin || FK.prox) ? t('Automatic lineaments: ', 'خطوط تركيبية آلية: ') + (userLin ? t('replaced by your file', 'استُبدلت بملفك') : G.T.segs) : ''].filter(Boolean);
    $('#pOut').innerHTML = '<div class="pz-card"><b class="h">' + RC.title + '</b><span>' + txt + '</span><div class="pz-cls">' +
      A.map(function (a, i) { return '<div><i style="background:' + CLS[i][0] + '"></i><span>' + (AR ? CLS[i][2] : CLS[i][1]) + '</span><span class="n">' + SH.fmt(a.km2, 1) + ' km²</span><span class="n">' + SH.fmt(a.p, 1) + ' %</span></div>'; }).join('') + '</div><div class="plot" id="pCh" style="height:200px"></div>' +
      '<table class="pz-tbl"><thead><tr><th>' + t('Layer', 'الطبقة') + '</th><th class="num">' + t('Weight', 'الوزن') + '</th><th class="num">' + t('Mean rating in high zones', 'متوسط التقييم في المناطق العالية') + '</th></tr></thead><tbody>' +
      drv.slice().sort(function (a, b) { return b.f.w - a.f.w; }).map(function (x) { return '<tr><td>' + SH.esc(x.f.n) + '</td><td class="num"><span class="ltr">' + SH.fmt(x.f.w * 100, 1) + ' %</span></td><td class="num">' + SH.fmt(x.m, 2) + '</td></tr>'; }).join('') + '</tbody></table>' + lithTbl +
      (neutral ? '<div class="pz-note" style="border-color:var(--warn)">' + t('The geological map here states ages but not rock types, so every unit is rated 3 and lithology does not change the ranking yet. Rate the units below from your knowledge of the formations.', 'الخريطة الجيولوجية هنا تذكر الأعمار دون أنواع الصخور، لذا قُيّمت كل الوحدات بـ3 ولا تؤثر الصخارية في الترتيب بعد. قيّم الوحدات أدناه من معرفتك بالتكوينات.') + '</div>' : '') + '<span class="xsmall muted">' + t('Grid ', 'الشبكة ') + '<span class="ltr">' + G.nx + ' × ' + G.ny + ' · ' + SH.fmt(G.cell, 0) + ' m</span>' + t(' · class breaks: ', ' · حدود الفئات: ') + '<span class="ltr">' + G.br.map(function (v) { return SH.fmt(v, 2); }).join(' · ') + '</span>' + (srcs.length ? '<br>' + srcs.join('<br>') : '') + '</span></div>';
    SH.plot('pCh', [{ type: 'bar', x: CLS.map(function (q) { return AR ? q[2] : q[1]; }), y: A.map(function (a) { return a.p; }), marker: { color: CLS.map(function (q) { return q[0]; }), line: { color: '#333', width: .5 } }, text: A.map(function (a) { return SH.fmt(a.p, 1) + '%'; }), textposition: 'outside', cliponaxis: false, hovertemplate: '%{x}<br>%{y:.1f} %<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 40, r: 8, t: 18, b: 34 }, showlegend: false, yaxis: { ticksuffix: ' %', rangemode: 'tozero', range: [0, Math.max.apply(null, A.map(function (a) { return a.p; })) * 1.22] }, xaxis: { tickfont: { size: 10 } } }); }, { displayModeBar: false });
  }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  $('#pOut').addEventListener('change', function (e) { var s = e.target.closest('[data-u]'); if (!s) return; var u = G.units[+s.getAttribute('data-u')]; u.r = +s.value; u.rated = true; G.rate.lith = rate(FK.lith); compose(); });

  /* ---------------------------------------------------------------- wells and validation */
  function saveWells() { SH.store.set(ptsKey(), wells); drawWells(); $('#pWS').textContent = wells.length ? wells.length + RC.pt.many + t(' loaded.', ' محمّلة.') : ''; }
  function drawWells() { if (!wLay) return; wLay.clearLayers(); wells.forEach(function (w) { L.circleMarker([w.lat, w.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: w.st === 0 ? '#c0392b' : '#111', fillOpacity: 1 }).bindTooltip((w.name ? SH.esc(w.name) + ' · ' : '') + (w.y != null ? SH.fmt(w.y, 1) + (RC.pt.yu ? ' ' + RC.pt.yu : '') : '') + (w.st === 0 ? ' ' + RC.pt.negw : '')).addTo(wLay); }); }
  $('#pWAdd').addEventListener('click', function () { addMode = !addMode; this.setAttribute('aria-pressed', addMode); this.classList.toggle('btn-ink', addMode); if (map) map.getContainer().style.cursor = addMode ? 'crosshair' : ''; if (addMode) SH.toast(t('Tap each well on the map, then tap the button again.', 'انقر كل بئر على الخريطة ثم انقر الزر مرة أخرى.'), 'info'); });
  $('#pWClr').addEventListener('click', function () { wells = []; saveWells(); $('#pValOut').innerHTML = ''; });
  $('#pWF').addEventListener('change', function () { var f = this.files[0]; if (!f) return; f.text().then(function (s) {
    var L2 = s.replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); }), sp = function (l) { return l.split(/[,;\t]/).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); }, h = sp(L2[0]).map(function (x) { return x.toLowerCase(); }), hasH = h.some(function (x) { return isNaN(parseFloat(x)); });
    var col = function (re, d) { for (var i = 0; i < h.length; i++) if (re.test(h[i])) return i; return hasH ? -1 : d; };
    var cLa = col(/^(lat|latitude|y|خط العرض|العرض)/, 0), cLo = col(/^(lon|lng|long|longitude|x|خط الطول|الطول)/, 1), cY = col(/yield|discharge|^q$|rate|انتاج|إنتاج|تصريف/, 2), cS = col(/status|state|productive|dry|حالة|الحالة/, -1), cN = col(/name|id|well|اسم|البئر|رقم/, -1);
    if (cLa < 0 || cLo < 0) throw new Error(); var add = [];
    L2.slice(hasH ? 1 : 0).forEach(function (l) { var r = sp(l), la = parseFloat(r[cLa]), lo = parseFloat(r[cLo]); if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return;
      var w = { lat: la, lon: lo }; if (cY >= 0 && isFinite(parseFloat(r[cY]))) w.y = parseFloat(r[cY]); if (cS >= 0 && r[cS] !== '' && r[cS] != null) w.st = /^(0|dry|no|false|جاف|جافة|لا)$/i.test(r[cS]) ? 0 : 1; if (cN >= 0) w.name = r[cN]; add.push(w); });
    if (!add.length) throw new Error(); wells = wells.concat(add); saveWells(); SH.toast(add.length + RC.pt.many + t(' added.', ' أُضيفت.'), 'ok'); if (G && G.done) validate();
  }).catch(function () { SH.toast(t('Could not read the file: use columns lat, lon and optionally a value or status.', 'تعذرت قراءة الملف: استخدم أعمدة lat وlon ومعها قيمة أو حالة اختيارياً.'), 'bad'); }); this.value = ''; });
  function auc(pos, neg) { if (!pos.length || !neg.length) return NaN; var s = 0; pos.forEach(function (p) { var lt = 0, eq = 0; for (var k = 0; k < neg.length; k++) { if (neg[k] < p) lt++; else if (neg[k] === p) eq++; } s += (lt + eq / 2) / neg.length; }); return s / pos.length; }
  function rankv(a) { var o = a.map(function (v, i) { return [v, i]; }).sort(function (x, y) { return x[0] - y[0]; }), r = new Array(a.length); for (var i = 0; i < o.length;) { var j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (var k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
  function spear(x, y) { var rx = rankv(x), ry = rankv(y), n = x.length, mx = (n + 1) / 2, sxy = 0, sxx = 0, syy = 0; for (var i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - mx); sxx += Math.pow(rx[i] - mx, 2); syy += Math.pow(ry[i] - mx, 2); } return sxy / Math.sqrt(sxx * syy); }
  function grade(a) { return a >= 0.9 ? t('excellent', 'ممتازة') : a >= 0.8 ? t('very good', 'جيدة جداً') : a >= 0.7 ? t('good', 'جيدة') : a >= 0.6 ? t('moderate', 'متوسطة') : t('poor: revise the importance or ratings', 'ضعيفة: راجع الأهمية أو التقييمات'); }
  function validate(quiet) {
    if (!G || !G.done) { if (!quiet) SH.toast(t('Build the map first.', 'أنشئ الخريطة أولاً.'), 'warn'); return; }
    var W = wells.map(function (w) { var c = cellAt(w.lat, w.lon); return c >= 0 && isFinite(G.idx[c]) ? { w: w, v: G.idx[c], k: G.cls[c] } : null; }).filter(Boolean), o = $('#pValOut');
    if (W.length < 3) { o.innerHTML = '<span class="xsmall muted">' + t('At least three points inside the mapped area are needed.', 'تلزم ثلاث نقاط على الأقل داخل المنطقة المرسومة.') + '</span>'; return; }
    var prod = W.filter(function (x) { return x.w.st !== 0; }), dry = W.filter(function (x) { return x.w.st === 0; }), cells = []; for (var c = 0; c < G.n; c++) if (isFinite(G.idx[c])) cells.push(G.idx[c]);
    cells.sort(function (a, b) { return b - a; });
    var sAuc = auc(prod.map(function (x) { return x.v; }), cells), curve = { x: [0], y: [0] }, pv = prod.map(function (x) { return x.v; }).sort(function (a, b) { return b - a; });
    for (var q = 1; q <= 50; q++) { var thr = cells[Math.min(cells.length - 1, Math.floor(cells.length * q / 50) - 1)], nw = pv.filter(function (v) { return v >= thr; }).length; curve.x.push(q * 2); curve.y.push(100 * nw / (pv.length || 1)); }
    var A = areas(), fr = A.map(function (a, i) { var n = prod.filter(function (x) { return x.k === i; }).length, pw = 100 * n / (prod.length || 1); return { n: n, pw: pw, fr: a.p ? pw / a.p : NaN }; });
    var roc = prod.length >= 3 && dry.length >= 3 ? auc(prod.map(function (x) { return x.v; }), dry.map(function (x) { return x.v; })) : NaN, yl = W.filter(function (x) { return x.w.y != null; }), rho = yl.length >= 5 ? spear(yl.map(function (x) { return x.v; }), yl.map(function (x) { return x.w.y; })) : NaN;
    o.innerHTML = '<div class="pz-card"><b class="h">' + RC.pt.ttl + W.length + RC.pt.many + '</b><span>' + RC.pt.curve + t(' Area under the curve ', ' المساحة تحت المنحنى ') + '<b class="ltr">AUC = ' + SH.fmt(sAuc, 3) + '</b> (' + grade(sAuc) + ').' +
      (isFinite(roc) ? ' ' + RC.pt.roc + '<b class="ltr">ROC AUC = ' + SH.fmt(roc, 3) + '</b> (' + grade(roc) + ').' : '') + (isFinite(rho) ? ' ' + t('Spearman correlation of the index with ', 'ارتباط سبيرمان بين المؤشر و') + RC.pt.yl + ': <b class="ltr">ρ = ' + SH.fmt(rho, 2) + '</b> (' + yl.length + RC.pt.many + ').' : '') + '</span>' +
      '<div class="plot" id="pRoc" style="height:240px"></div><table class="pz-tbl"><thead><tr><th>' + t('Class', 'الفئة') + '</th><th class="num">' + t('Area %', 'المساحة %') + '</th><th class="num">' + t('Points', 'النقاط') + '</th><th class="num">' + t('Frequency ratio', 'نسبة التكرار') + '</th></tr></thead><tbody>' +
      fr.map(function (r, i) { return '<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + CLS[i][0] + '"></i> ' + (AR ? CLS[i][2] : CLS[i][1]) + '</td><td class="num">' + SH.fmt(A[i].p, 1) + '</td><td class="num">' + r.n + '</td><td class="num"><b>' + (isFinite(r.fr) ? SH.fmt(r.fr, 2) : '—') + '</b></td></tr>'; }).join('') + '</tbody></table><span class="xsmall muted">' + t('A frequency ratio above 1 means the class holds more points than its share of the area. A good map shows ratios rising from very low to very high.', 'نسبة التكرار الأعلى من 1 تعني أن الفئة تحوي آباراً أكثر من نصيبها من المساحة. الخريطة الجيدة تُظهر نسباً تتصاعد من المنخفضة جداً إلى العالية جداً.') + '</span></div>';
    var pal = SH.palette();
    SH.plot('pRoc', [{ x: [0, 100], y: [0, 100], mode: 'lines', line: { color: '#999', dash: 'dash', width: 1 }, hoverinfo: 'skip', name: t('Random', 'عشوائي') }, { x: curve.x, y: curve.y, mode: 'lines', line: { color: pal.accent, width: 2.5, shape: 'spline' }, fill: 'tonexty', fillcolor: SH.alpha(pal.accent, .12), name: 'AUC ' + SH.fmt(sAuc, 2), hovertemplate: '%{x:.0f}% → %{y:.0f}%<extra></extra>' }],
      function () { return SH.plotLayout({ margin: { l: 66, r: 10, t: 10, b: 44 }, showlegend: false, xaxis: { range: [0, 100], ticksuffix: '%', title: { text: t('Area, from highest potential', 'المساحة من أعلى احتمالية'), font: { size: 11 }, standoff: 8 } }, yaxis: { range: [0, 101], ticksuffix: '%', title: { text: RC.pt.ax, font: { size: 11 }, standoff: 10 } } }); }, { displayModeBar: false });
  }
  $('#pVal').addEventListener('click', function () { validate(); });
  /* archaeology: sites already recorded on open map data inside the area */
  $('#pOsm').addEventListener('click', function () { if (!aoi) { SH.toast(t('Draw the area first.', 'ارسم المنطقة أولاً.'), 'warn'); return; } var b = this; b.disabled = true;
    var bb = [aoi.s, aoi.w, aoi.n, aoi.e].map(function (v) { return v.toFixed(5); }).join(','), q = '[out:json][timeout:25];(node["historic"="archaeological_site"](' + bb + ');way["historic"="archaeological_site"](' + bb + ');relation["historic"="archaeological_site"](' + bb + '););out center 800;';
    SH.getJSON('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q), { timeout: 40000 }).then(function (j) { var add = (j.elements || []).map(function (e) { var la = e.lat != null ? e.lat : e.center && e.center.lat, lo = e.lon != null ? e.lon : e.center && e.center.lon; return isFinite(la) && isFinite(lo) ? { lat: la, lon: lo, name: (e.tags && (e.tags['name:' + SH.lang] || e.tags.name)) || '' } : null; }).filter(Boolean);
      var key = function (w) { return w.lat.toFixed(4) + ',' + w.lon.toFixed(4); }, have = {}; wells.forEach(function (w) { have[key(w)] = 1; }); add = add.filter(function (w) { return !have[key(w)]; });
      wells = wells.concat(add); saveWells(); SH.toast(add.length ? add.length + RC.pt.many + t(' recorded in the area added.', ' مسجلة في المنطقة أُضيفت.') : t('No recorded sites in this area.', 'لا توجد مواقع مسجلة في هذه المنطقة.'), add.length ? 'ok' : 'info'); if (add.length && G && G.done) validate(true);
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });

  /* ---------------------------------------------------------------- downloads */
  function need() { if (!G || !G.done) { SH.toast(t('Build the map first.', 'أنشئ الخريطة أولاً.'), 'warn'); return false; } return true; }
  var fname = function (x) { return 'Shandal-' + RC.file + '-' + new Date().toISOString().slice(0, 10) + x; };
  $('#pSheet').addEventListener('click', function () { if (!need() || !D) return; var view = SH.val('pShow') || 'cls', P = paint(view), A = areas(), svg = $('#pSheetSvg');
    /* upscale the grid image with nearest-neighbour so cells stay sharp in the sheet */
    var im = new Image(); im.onload = function () { var k = Math.max(1, Math.floor(1400 / Math.max(G.nx, G.ny))), cv = document.createElement('canvas'); cv.width = G.nx * k; cv.height = G.ny * k; var x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, cv.width, cv.height);
      var sw = view === 'cls' ? CLS.map(function (q, i) { return { color: q[0], name: (AR ? q[2] : q[1]) + ' · ' + SH.ltr(SH.fmt(A[i].p, 1) + '%') }; }) : P.leg.sw ? P.leg.sw.slice(0, 9).map(function (s) { return { color: s[0], name: s[1] }; }) : [];
      D.svgMap(svg, { b: G.b, min: 0, max: 1 }, [], { crs: 'geo', fill: false, image: cv.toDataURL('image/png'), noContours: true, grid: true, title: view === 'cls' ? RC.title : P.leg.title,
        subtitle: t('Analytic hierarchy process · ', 'التحليل الهرمي · ') + G.act.length + t(' layers · cell ', ' طبقات · الخلية ') + SH.fmt(G.cell * (RC.gen ? G.gen : 1), 0) + ' m · CR ' + SH.fmt(AH ? AH.CR : 0, 3), legendTitle: P.leg.title, swatches: sw, gradient: P.leg.grad ? { colors: VIR, min: P.leg.grad[0], max: P.leg.grad[1] } : null,
        points: wells.filter(function (w) { return cellAt(w.lat, w.lon) >= 0; }).map(function (w) { return { x: w.lon, y: w.lat, color: w.st === 0 ? '#c0392b' : '#111' }; }), pointsName: RC.pt.pos, pointKinds: [{ color: '#111', name: RC.pt.pos }].concat(wells.some(function (w) { return w.st === 0 && cellAt(w.lat, w.lon) >= 0; }) ? [{ color: '#c0392b', name: RC.pt.neg }] : []),
        source: t('Satellite imagery, elevation model, geological map, land cover and climate reanalysis, combined in the Shandal System.', 'صور فضائية ونموذج ارتفاع رقمي وخريطة جيولوجية وغطاء أرضي وإعادة تحليل مناخي، مدموجة في نظام شندل.'), credit: 'Shandal System' });
      SH.svgPng(svg, fname('.png'), 2); }; im.src = P.url; });
  $('#pAsc').addEventListener('click', function () { if (!need()) return; var s = 'ncols ' + G.nx + '\nnrows ' + G.ny + '\nxllcorner ' + G.b.w.toFixed(8) + '\nyllcorner ' + G.b.s.toFixed(8) + '\ndx ' + G.dlon.toFixed(10) + '\ndy ' + G.dlat.toFixed(10) + '\nNODATA_value -9999\n', r = [];
    for (var j = 0; j < G.ny; j++) { r.length = 0; for (var i = 0; i < G.nx; i++) { var v = G.idx[j * G.nx + i]; r.push(isFinite(v) ? v.toFixed(3) : '-9999'); } s += r.join(' ') + '\n'; }
    SH.download(fname('-index.asc'), s, 'text/plain'); SH.toast(t('Index grid in geographic coordinates (WGS 84), values 1–5. Opens in QGIS and ArcGIS.', 'شبكة المؤشر بالإحداثيات الجغرافية (WGS 84) بقيم 1–5. تُفتح في QGIS وArcGIS.'), 'info'); });
  $('#pCsv').addEventListener('click', function () { if (!need()) return; var A = areas(), rows = [[t('Class', 'الفئة'), t('Area (km²)', 'المساحة (كم²)'), t('Share (%)', 'النسبة (%)'), t('Lower limit of index', 'الحد الأدنى للمؤشر')]];
    A.forEach(function (a, i) { rows.push([AR ? CLS[i][2] : CLS[i][1], a.km2.toFixed(3), a.p.toFixed(2), i ? G.br[i - 1].toFixed(3) : '']); });
    rows.push([]); rows.push([t('Layer', 'الطبقة'), t('Importance (1–9)', 'الأهمية (1–9)'), t('AHP weight', 'وزن التحليل الهرمي')]); G.act.forEach(function (f) { rows.push([f.n, f.w8, f.w.toFixed(4)]); }); rows.push(['CR', AH ? AH.CR.toFixed(4) : '']);
    rows.push([]); rows.push(['© Shandal Geological Field Survey System · geologicalfieldsurvey.com', new Date().toISOString().slice(0, 10)]); SH.csv(fname('-classes.csv'), rows); });
  /* all layer ratings on one framed figure with shared legend, north arrow and scale bar */
  $('#pFac').addEventListener('click', function () { if (!need()) return; var fs = F.filter(function (f) { return G.rate[f.k]; }), cols = 4, rowsN = Math.ceil((fs.length + 1) / cols), pw = 300, M = 40, ph = Math.round(pw * (G.ny * G.dy) / (G.nx * G.dx)); if (ph > 380) { var sc0 = 380 / ph; ph = 380; pw = Math.round(pw * sc0); }
    var W = M * 2 + cols * pw + (cols - 1) * 24, H = 110 + rowsN * (ph + 46) + 90, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d'), FN = '"IBM Plex Sans Arabic", Manrope, Arial, sans-serif';
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.strokeStyle = '#1B232B'; x.lineWidth = 1.5; x.strokeRect(10, 10, W - 20, H - 20); x.fillStyle = '#1B232B'; x.font = '800 24px ' + FN; x.textAlign = AR ? 'right' : 'left'; x.direction = AR ? 'rtl' : 'ltr';
    x.fillText(RC.fig, AR ? W - M : M, 52); x.font = '500 14px ' + FN; x.fillStyle = '#55616B'; x.fillText(t('Weights from the analytic hierarchy process are shown under each layer.', 'أوزان التحليل الهرمي مبينة تحت كل طبقة.'), AR ? W - M : M, 78);
    var items = fs.map(function (f) { return { v: 'r:' + f.k, n: f.n + ' · \u2066' + SH.fmt(f.w * 100, 1) + '%\u2069' }; }).concat([{ v: 'cls', n: t('Result: potential classes', 'النتيجة: فئات الاحتمالية') }]), jobs = items.map(function (it) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.src = paint(it.v).url; }); });
    Promise.all(jobs).then(function (ims) { ims.forEach(function (im, k) { var ci = k % cols, ri = Math.floor(k / cols), px = AR ? W - M - (ci + 1) * pw - ci * 24 : M + ci * (pw + 24), py = 104 + ri * (ph + 46);
        x.imageSmoothingEnabled = false; x.fillStyle = '#f3f3f3'; x.fillRect(px, py, pw, ph); x.drawImage(im, px, py, pw, ph); x.strokeStyle = '#1B232B'; x.lineWidth = 1; x.strokeRect(px, py, pw, ph);
        x.fillStyle = '#1B232B'; x.font = (k === items.length - 1 ? '800' : '600') + ' 14px ' + FN; x.textAlign = 'center'; x.fillText(items[k].n, px + pw / 2, py + ph + 22); });
      /* legend, north arrow and scale bar along the foot */
      var ly = H - 62; x.textAlign = AR ? 'right' : 'left'; x.font = '700 13px ' + FN; var lx = AR ? W - M : M, sx = 0;
      CLS.forEach(function (q, i) { var lab = (i + 1) + ' ' + (AR ? q[2] : q[1]), wq = x.measureText(lab).width + 34, bx = AR ? lx - sx - 18 : lx + sx; x.fillStyle = q[0]; x.fillRect(bx, ly - 12, 18, 14); x.strokeStyle = '#333'; x.strokeRect(bx, ly - 12, 18, 14); x.fillStyle = '#1B232B'; x.fillText(lab, AR ? bx - 6 : bx + 24, ly); sx += wq; });
      (function () { var lab = t('No data or masked', 'لا بيانات أو محجوب'), wq = x.measureText(lab).width + 34, bx = AR ? lx - sx - 18 : lx + sx; x.fillStyle = '#f3f3f3'; x.fillRect(bx, ly - 12, 18, 14); x.strokeStyle = '#333'; x.strokeRect(bx, ly - 12, 18, 14); x.fillStyle = '#1B232B'; x.fillText(lab, AR ? bx - 6 : bx + 24, ly); })();
      var nxp = AR ? M + 20 : W - M - 20; x.beginPath(); x.moveTo(nxp, ly - 34); x.lineTo(nxp - 10, ly + 6); x.lineTo(nxp, ly - 2); x.closePath(); x.fillStyle = '#1B232B'; x.fill(); x.beginPath(); x.moveTo(nxp, ly - 34); x.lineTo(nxp + 10, ly + 6); x.lineTo(nxp, ly - 2); x.closePath(); x.fillStyle = '#fff'; x.fill(); x.stroke(); x.direction = 'ltr'; x.fillStyle = '#1B232B'; x.font = '800 13px ' + FN; x.textAlign = 'center'; x.fillText('N', nxp, ly - 38);
      var mpp = G.nx * G.dx / pw, want = mpp * 110, p10 = Math.pow(10, Math.floor(Math.log10(want))), nn = want / p10, lenM = (nn >= 5 ? 5 : nn >= 2 ? 2 : 1) * p10, bw = lenM / mpp, bx0 = AR ? M + 60 : W - M - 60 - bw;
      for (var q = 0; q < 4; q++) { x.fillStyle = q % 2 ? '#fff' : '#1B232B'; x.fillRect(bx0 + q * bw / 4, ly - 4, bw / 4, 7); } x.strokeRect(bx0, ly - 4, bw, 7); x.fillStyle = '#1B232B'; x.font = '600 12px ' + FN; x.fillText('0', bx0, ly + 20); x.fillText(lenM >= 1000 ? SH.fmt(lenM / 1000, 0) + ' km' : SH.fmt(lenM, 0) + ' m', bx0 + bw, ly + 20);
      SH.canvasPng(cv, fname('-layers.png')); }); });

  setRecipe($('#pRec').getAttribute('data-default') || 'gw');
  document.addEventListener('sh:beforereport', function (e) { if (!G || !G.done) { e.preventDefault(); SH.toast(t('Build the map first.', 'أنشئ الخريطة أولاً.'), 'warn'); } });
})();
