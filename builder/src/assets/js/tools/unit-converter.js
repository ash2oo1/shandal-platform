/* Unit converter — every common unit of science, engineering and the field, converted through SI with the exact factors
   of NIST SP 811 (2008) and ISO 80000; special scales (temperature, slope, API gravity, mud weight, coordinates, map
   scale, ions in milliequivalents) by their defining equations. Free for everyone. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, AR = SH.lang === 'ar';
  var C = function (en, ar) { return AR ? ar : en; };
  var IC = function (n) { var e = document.querySelector('#uIc [data-n="' + n + '"]'); return e ? e.innerHTML : ''; };
  /* [id, English, Arabic, factor to the SI base of the quantity] */
  var Q = {
    length: { n: ['Length and distance', 'الطول والمسافة'], i: 'ruler', u: [['m', 'metre', 'متر', 1], ['km', 'kilometre', 'كيلومتر', 1e3], ['cm', 'centimetre', 'سنتيمتر', 1e-2], ['mm', 'millimetre', 'مليمتر', 1e-3], ['um', 'micrometre (µm)', 'مايكرومتر (µm)', 1e-6], ['nm', 'nanometre', 'نانومتر', 1e-9], ['A', 'ångström', 'أنگستروم', 1e-10],
      ['in', 'inch', 'إنج (بوصة)', 0.0254], ['ft', 'foot', 'قدم', 0.3048], ['ftus', 'US survey foot', 'قدم المساحة الأمريكي', 1200 / 3937], ['yd', 'yard', 'ياردة', 0.9144], ['mi', 'mile', 'ميل', 1609.344], ['nmi', 'nautical mile', 'ميل بحري', 1852], ['fath', 'fathom', 'قامة', 1.8288], ['ch', 'chain (Gunter)', 'سلسلة (گنتر)', 20.1168], ['rod', 'rod', 'رود', 5.0292], ['fur', 'furlong', 'فرلنگ', 201.168], ['mil', 'mil (thou)', 'ملّ (جزء من ألف إنج)', 2.54e-5],
      ['au', 'astronomical unit', 'وحدة فلكية', 149597870700], ['ly', 'light-year', 'سنة ضوئية', 9460730472580800], ['pc', 'parsec', 'فرسخ فلكي', 3.0856775814913673e16]] },
    area: { n: ['Area', 'المساحة'], i: 'square', u: [['m2', 'square metre', 'متر مربع', 1], ['km2', 'square kilometre', 'كيلومتر مربع', 1e6], ['ha', 'hectare', 'هكتار', 1e4], ['dunamiq', 'Iraqi dunam (2500 m²)', 'دونم عراقي (2500 م²)', 2500], ['olk', 'olk (¼ Iraqi dunam)', 'أولك (ربع دونم عراقي)', 625], ['dunam', 'metric dunam (1000 m²)', 'دونم متري (1000 م²)', 1000], ['are', 'are', 'آر', 100], ['cm2', 'square centimetre', 'سنتيمتر مربع', 1e-4], ['mm2', 'square millimetre', 'مليمتر مربع', 1e-6],
      ['acre', 'acre', 'فدان إنگليزي (أكر)', 4046.8564224], ['feddan', 'Egyptian feddan', 'فدان مصري', 4200.83], ['ft2', 'square foot', 'قدم مربع', 0.09290304], ['in2', 'square inch', 'إنج مربع', 6.4516e-4], ['yd2', 'square yard', 'ياردة مربعة', 0.83612736], ['mi2', 'square mile', 'ميل مربع', 2589988.110336]] },
    volume: { n: ['Volume', 'الحجم'], i: 'box', u: [['m3', 'cubic metre', 'متر مكعب', 1], ['L', 'litre', 'لتر', 1e-3], ['mL', 'millilitre (cm³)', 'ملّيلتر (سم³)', 1e-6], ['km3', 'cubic kilometre', 'كيلومتر مكعب', 1e9], ['mcm', 'million cubic metres', 'مليون متر مكعب', 1e6], ['bcm', 'billion cubic metres', 'مليار متر مكعب', 1e9],
      ['bbl', 'barrel (oil, 42 US gal)', 'برميل (نفط، 42 گالوناً)', 0.158987294928], ['galus', 'US gallon', 'گالون أمريكي', 0.003785411784], ['galuk', 'imperial gallon', 'گالون بريطاني', 0.00454609], ['ft3', 'cubic foot', 'قدم مكعب', 0.028316846592], ['in3', 'cubic inch', 'إنج مكعب', 1.6387064e-5], ['yd3', 'cubic yard', 'ياردة مكعبة', 0.764554857984],
      ['acft', 'acre-foot', 'أكر-قدم', 1233.48183754752], ['mcf', 'thousand cubic feet (Mcf)', 'ألف قدم مكعب (Mcf)', 28.316846592], ['mmcf', 'million cubic feet (MMcf)', 'مليون قدم مكعب (MMcf)', 28316.846592], ['bcf', 'billion cubic feet (Bcf)', 'مليار قدم مكعب (Bcf)', 28316846.592], ['qtus', 'US quart', 'كوارت أمريكي', 9.46352946e-4], ['floz', 'US fluid ounce', 'أونصة سائلة أمريكية', 2.95735295625e-5]] },
    mass: { n: ['Mass and weight', 'الكتلة والوزن'], i: 'weight', u: [['kg', 'kilogram', 'كيلوغرام', 1], ['g', 'gram', 'غرام', 1e-3], ['mg', 'milligram', 'ملّيغرام', 1e-6], ['ug', 'microgram', 'مايكروغرام', 1e-9], ['t', 'tonne (metric ton)', 'طن متري', 1e3], ['q', 'quintal', 'قنطار متري', 100], ['lb', 'pound', 'باوند (رطل)', 0.45359237], ['oz', 'ounce', 'أونصة', 0.028349523125],
      ['ozt', 'troy ounce (gold, silver)', 'أونصة ترويسية (الذهب والفضة)', 0.0311034768], ['ct', 'carat (gems)', 'قيراط (الأحجار الكريمة)', 2e-4], ['gr', 'grain', 'حبة (grain)', 6.479891e-5], ['st', 'stone', 'ستون', 6.35029318], ['tsh', 'short ton (US)', 'طن قصير (أمريكي)', 907.18474], ['tlg', 'long ton (UK)', 'طن طويل (بريطاني)', 1016.0469088], ['mithqal', 'mithqal (4.25 g)', 'مثقال (4.25 غم)', 4.25e-3]] },
    density: { n: ['Density and mud weight', 'الكثافة ووزن طين الحفر'], i: 'droplet', u: [['kgm3', 'kg/m³', 'كغم/م³', 1], ['gcc', 'g/cm³', 'غم/سم³', 1000], ['sg', 'specific gravity (water = 1)', 'الوزن النوعي (الماء = 1)', 999.972], ['ppg', 'pound per US gallon (ppg)', 'باوند/گالون أمريكي (ppg)', 119.826427], ['pcf', 'pound per cubic foot', 'باوند/قدم³', 16.01846337], ['tm3', 't/m³', 'طن/م³', 1000], ['api', 'API gravity (°API)', 'كثافة API (°API)', 'api']] },
    pressure: { n: ['Pressure and stress', 'الضغط والإجهاد'], i: 'gauge', u: [['Pa', 'pascal', 'باسكال', 1], ['kPa', 'kilopascal (kN/m²)', 'كيلوباسكال (كيلونيوتن/م²)', 1e3], ['MPa', 'megapascal (N/mm²)', 'ميگاباسكال (نيوتن/مم²)', 1e6], ['GPa', 'gigapascal', 'گيگاباسكال', 1e9], ['bar', 'bar', 'بار', 1e5], ['mbar', 'millibar (hPa)', 'ملّيبار (هكتوباسكال)', 100], ['atm', 'standard atmosphere', 'ضغط جوي قياسي', 101325],
      ['psi', 'psi (lbf/in²)', 'psi (باوند/إنج²)', 6894.757293168], ['ksi', 'ksi', 'ksi', 6894757.293168], ['kgcm2', 'kgf/cm² (technical atm)', 'كغم قوة/سم²', 98066.5], ['tm2', 'tonne-force/m²', 'طن قوة/م²', 9806.65], ['tsf', 'ton-force (short)/ft²', 'طن قوة قصير/قدم²', 95760.5179], ['psf', 'lbf/ft²', 'باوند/قدم²', 47.88025898], ['mmHg', 'mmHg (torr)', 'ملم زئبق (تور)', 133.322387415], ['inHg', 'inch of mercury', 'إنج زئبق', 3386.388640341], ['mH2O', 'metre of water', 'متر ماء', 9806.65], ['ftH2O', 'foot of water', 'قدم ماء', 2989.06692]] },
    gradient: { n: ['Pressure gradient', 'تدرج الضغط'], i: 'trending-down', u: [['kPam', 'kPa/m', 'كيلوباسكال/م', 1], ['psift', 'psi/ft', 'psi/قدم', 22.62059], ['barm', 'bar/m', 'بار/م', 100], ['MPakm', 'MPa/km', 'ميگاباسكال/كم', 1], ['ppge', 'mud-weight equivalent (ppg)', 'وزن طين مكافئ (ppg)', 22.62059 * 0.051948], ['gcce', 'density equivalent (g/cm³)', 'كثافة مكافئة (غم/سم³)', 9.80665]] },
    temperature: { n: ['Temperature', 'درجة الحرارة'], i: 'thermometer', u: [['C', 'degree Celsius', 'درجة سيليزية', 'C'], ['F', 'degree Fahrenheit', 'درجة فهرنهايت', 'F'], ['K', 'kelvin', 'كلفن', 'K'], ['R', 'degree Rankine', 'درجة رانكن', 'R']] },
    tgrad: { n: ['Geothermal gradient', 'التدرج الحراري الأرضي'], i: 'flame', u: [['Ckm', '°C/km', '°م/كم', 1], ['C100m', '°C/100 m', '°م/100 م', 10], ['F100ft', '°F/100 ft', '°ف/100 قدم', 18.2269], ['Ffta', '°F/1000 ft', '°ف/1000 قدم', 1.82269]] },
    angle: { n: ['Angle, dip and slope', 'الزاوية والميل والانحدار'], i: 'triangle-right', u: [['deg', 'degree (°)', 'درجة (°)', 1], ['rad', 'radian', 'راديان', 180 / Math.PI], ['grad', 'gradian (gon)', 'گراد (گون)', 0.9], ['amin', 'arcminute (′)', 'دقيقة قوسية (′)', 1 / 60], ['asec', 'arcsecond (″)', 'ثانية قوسية (″)', 1 / 3600], ['mil', 'mil (NATO, 6400)', 'مِل (الناتو، 6400)', 360 / 6400], ['turn', 'turn', 'دورة كاملة', 360],
      ['pct', 'slope in percent (%)', 'الانحدار بالنسبة المئوية (%)', 'pct'], ['pm', 'slope per mille (‰)', 'الانحدار بالألف (‰)', 'pm'], ['ratio', 'slope ratio 1 : n (V : H)', 'نسبة الانحدار 1 : n (رأسي : أفقي)', 'ratio'], ['hv', 'batter n : 1 (H : V)', 'الميل الهندسي n : 1 (أفقي : رأسي)', 'hv'], ['mkm', 'm per km', 'م لكل كم', 'mkm']] },
    time: { n: ['Time and geological time', 'الزمن والزمن الجيولوجي'], i: 'clock', u: [['s', 'second', 'ثانية', 1], ['ms', 'millisecond', 'ملّي ثانية', 1e-3], ['us', 'microsecond', 'مايكروثانية', 1e-6], ['min', 'minute', 'دقيقة', 60], ['h', 'hour', 'ساعة', 3600], ['d', 'day', 'يوم', 86400], ['wk', 'week', 'أسبوع', 604800], ['yr', 'year (365.25 d)', 'سنة (365.25 يوماً)', 31557600], ['ka', 'thousand years (ka)', 'ألف سنة (ka)', 31557600e3], ['Ma', 'million years (Ma)', 'مليون سنة (Ma)', 31557600e6], ['Ga', 'billion years (Ga)', 'مليار سنة (Ga)', 31557600e9]] },
    speed: { n: ['Speed and velocity', 'السرعة'], i: 'gauge', u: [['ms', 'm/s', 'م/ث', 1], ['kmh', 'km/h', 'كم/س', 1 / 3.6], ['mph', 'mile per hour', 'ميل/ساعة', 0.44704], ['kn', 'knot', 'عقدة', 1852 / 3600], ['fts', 'ft/s', 'قدم/ث', 0.3048], ['kms', 'km/s (seismic velocity)', 'كم/ث (السرعة الزلزالية)', 1000], ['md', 'm/day', 'م/يوم', 1 / 86400], ['mmyr', 'mm/yr (plate motion)', 'ملم/سنة (حركة الصفائح)', 1e-3 / 31557600], ['cmyr', 'cm/yr', 'سم/سنة', 1e-2 / 31557600]] },
    slowness: { n: ['Sonic slowness and velocity', 'البطء الصوتي والسرعة'], i: 'activity', u: [['usft', 'µs/ft (slowness)', 'مايكروثانية/قدم (بطء)', 'usft'], ['usm', 'µs/m (slowness)', 'مايكروثانية/م (بطء)', 'usm'], ['vms', 'velocity m/s', 'السرعة م/ث', 'vms'], ['vfts', 'velocity ft/s', 'السرعة قدم/ث', 'vfts'], ['vkms', 'velocity km/s', 'السرعة كم/ث', 'vkms']] },
    accel: { n: ['Acceleration and gravity', 'التعجيل والجاذبية'], i: 'arrow-down', u: [['ms2', 'm/s²', 'م/ث²', 1], ['gal', 'gal (cm/s²)', 'گال (سم/ث²)', 0.01], ['mgal', 'milligal (mGal)', 'ملّيگال', 1e-5], ['ugal', 'microgal (µGal)', 'مايكروگال', 1e-8], ['gu', 'gravity unit (µm/s²)', 'وحدة جاذبية (µm/s²)', 1e-6], ['g0', 'standard gravity g', 'الجاذبية القياسية g', 9.80665], ['fts2', 'ft/s²', 'قدم/ث²', 0.3048]] },
    force: { n: ['Force and load', 'القوة والحِمل'], i: 'move-down', u: [['N', 'newton', 'نيوتن', 1], ['kN', 'kilonewton', 'كيلونيوتن', 1e3], ['MN', 'meganewton', 'ميگانيوتن', 1e6], ['kgf', 'kilogram-force', 'كيلوغرام قوة', 9.80665], ['tf', 'tonne-force', 'طن قوة', 9806.65], ['lbf', 'pound-force', 'باوند قوة', 4.4482216152605], ['kip', 'kip (1000 lbf)', 'كيب (1000 باوند قوة)', 4448.2216152605], ['dyn', 'dyne', 'داين', 1e-5]] },
    energy: { n: ['Energy and work', 'الطاقة والشغل'], i: 'zap', u: [['J', 'joule', 'جول', 1], ['kJ', 'kilojoule', 'كيلوجول', 1e3], ['MJ', 'megajoule', 'ميگاجول', 1e6], ['GJ', 'gigajoule', 'گيگاجول', 1e9], ['Wh', 'watt-hour', 'واط ساعة', 3600], ['kWh', 'kilowatt-hour', 'كيلوواط ساعة', 3.6e6], ['MWh', 'megawatt-hour', 'ميگاواط ساعة', 3.6e9], ['cal', 'calorie (thermochemical)', 'سعرة (حرارية كيميائية)', 4.184], ['kcal', 'kilocalorie', 'كيلو سعرة', 4184],
      ['btu', 'BTU (IT)', 'وحدة حرارية بريطانية BTU', 1055.05585262], ['therm', 'therm (US)', 'ثيرم', 105480400], ['eV', 'electronvolt', 'إلكترون فولت', 1.602176634e-19], ['erg', 'erg', 'إرگ', 1e-7], ['ftlbf', 'foot-pound-force', 'قدم-باوند قوة', 1.3558179483314], ['boe', 'barrel of oil equivalent', 'برميل نفط مكافئ', 6.1178632e9], ['toe', 'tonne of oil equivalent', 'طن نفط مكافئ', 4.1868e10], ['tnt', 'tonne of TNT', 'طن TNT', 4.184e9]] },
    power: { n: ['Power', 'القدرة'], i: 'plug-zap', u: [['W', 'watt', 'واط', 1], ['kW', 'kilowatt', 'كيلوواط', 1e3], ['MW', 'megawatt', 'ميگاواط', 1e6], ['GW', 'gigawatt', 'گيگاواط', 1e9], ['hp', 'horsepower (mechanical)', 'حصان (ميكانيكي)', 745.69987158227], ['ps', 'metric horsepower', 'حصان متري', 735.49875], ['btuh', 'BTU per hour', 'BTU/ساعة', 0.29307107017], ['kcalh', 'kcal per hour', 'كيلو سعرة/ساعة', 1.1622222], ['tr', 'ton of refrigeration', 'طن تبريد', 3516.8528420667]] },
    flow: { n: ['Flow rate and discharge', 'معدل الجريان والتصريف'], i: 'droplets', u: [['m3s', 'm³/s', 'م³/ث', 1], ['Ls', 'L/s', 'لتر/ث', 1e-3], ['Lmin', 'L/min', 'لتر/دقيقة', 1e-3 / 60], ['m3h', 'm³/h', 'م³/ساعة', 1 / 3600], ['m3d', 'm³/day', 'م³/يوم', 1 / 86400], ['gpm', 'US gallon per minute', 'گالون أمريكي/دقيقة', 0.003785411784 / 60], ['cfs', 'ft³/s (cusec)', 'قدم³/ث', 0.028316846592],
      ['bpd', 'barrel per day', 'برميل/يوم', 0.158987294928 / 86400], ['mmscfd', 'million standard ft³/day', 'مليون قدم³ قياسي/يوم', 28316.846592 / 86400], ['mcmy', 'million m³/year', 'مليون م³/سنة', 1e6 / 31557600]] },
    perm: { n: ['Permeability', 'النفاذية'], i: 'layers', u: [['m2', 'square metre', 'متر مربع', 1], ['um2', 'µm²', 'مايكرومتر مربع', 1e-12], ['D', 'darcy', 'دارسي', 9.869233e-13], ['mD', 'millidarcy', 'ملّيدارسي', 9.869233e-16], ['nD', 'nanodarcy', 'نانودارسي', 9.869233e-22], ['cm2', 'cm²', 'سم²', 1e-4]] },
    hydk: { n: ['Hydraulic conductivity and transmissivity', 'الموصلية الهيدروليكية والناقلية'], i: 'droplets', u: [['ms', 'm/s', 'م/ث', 1], ['cms', 'cm/s', 'سم/ث', 0.01], ['md', 'm/day', 'م/يوم', 1 / 86400], ['ftd', 'ft/day', 'قدم/يوم', 0.3048 / 86400], ['gpdft2', 'US gal/day/ft²', 'گالون/يوم/قدم²', 4.716e-7], ['darcyw', 'darcy (water, 20 °C)', 'دارسي (ماء عند 20 °م)', 9.66e-6]] },
    visc: { n: ['Viscosity', 'اللزوجة'], i: 'droplet', u: [['Pas', 'Pa·s (dynamic)', 'باسكال·ث (ديناميكية)', 1], ['mPas', 'mPa·s (dynamic)', 'ملّي باسكال·ث', 1e-3], ['cP', 'centipoise', 'سنتيبويز', 1e-3], ['P', 'poise', 'بويز', 0.1]] },
    kvisc: { n: ['Kinematic viscosity', 'اللزوجة الكينماتيكية'], i: 'droplet', u: [['m2s', 'm²/s', 'م²/ث', 1], ['cSt', 'centistokes (mm²/s)', 'سنتيستوكس (مم²/ث)', 1e-6], ['St', 'stokes (cm²/s)', 'ستوكس (سم²/ث)', 1e-4], ['ft2s', 'ft²/s', 'قدم²/ث', 0.09290304]] },
    conc: { n: ['Concentration in water', 'التركيز في الماء'], i: 'flask-conical', u: [['mgL', 'mg/L', 'ملغم/لتر', 1], ['ugL', 'µg/L', 'مايكروغرام/لتر', 1e-3], ['gL', 'g/L', 'غم/لتر', 1e3], ['ppm', 'ppm (dilute water)', 'جزء بالمليون (ماء مخفف)', 1], ['ppb', 'ppb (dilute water)', 'جزء بالمليار (ماء مخفف)', 1e-3], ['pct', 'percent by mass (dilute)', 'نسبة مئوية كتلية (مخفف)', 1e4], ['gm3', 'g/m³', 'غم/م³', 1]] },
    elec: { n: ['Resistivity, conductivity and salinity', 'المقاومة النوعية والموصلية والملوحة'], i: 'zap', u: [['ohmm', 'resistivity Ω·m', 'المقاومة النوعية أوم·م', 'ohmm'], ['ohmcm', 'resistivity Ω·cm', 'المقاومة النوعية أوم·سم', 'ohmcm'], ['Sm', 'conductivity S/m', 'الموصلية سيمنز/م', 'Sm'], ['mSm', 'conductivity mS/m', 'الموصلية ملّي سيمنز/م', 'mSm'], ['mScm', 'EC mS/cm (dS/m)', 'الموصلية ملّي سيمنز/سم', 'mScm'], ['uScm', 'EC µS/cm', 'الموصلية مايكروسيمنز/سم', 'uScm'], ['tds', 'TDS mg/L (≈ 0.64 × EC)', 'الأملاح الذائبة ملغم/لتر (≈ 0.64 × EC)', 'tds']] },
    magnetic: { n: ['Magnetic field', 'المجال المغناطيسي'], i: 'magnet', u: [['T', 'tesla', 'تسلا', 1], ['mT', 'millitesla', 'ملّي تسلا', 1e-3], ['uT', 'microtesla', 'مايكروتسلا', 1e-6], ['nT', 'nanotesla', 'نانوتسلا', 1e-9], ['gamma', 'gamma (= nT)', 'گاما (= نانوتسلا)', 1e-9], ['G', 'gauss', 'گاوس', 1e-4], ['mG', 'milligauss', 'ملّي گاوس', 1e-7]] },
    radio: { n: ['Radioactivity and dose', 'الإشعاع والجرعة'], i: 'radiation', u: [['Bq', 'becquerel (activity)', 'بكريل (نشاط)', 1], ['kBq', 'kilobecquerel', 'كيلوبكريل', 1e3], ['MBq', 'megabecquerel', 'ميگابكريل', 1e6], ['Ci', 'curie', 'كوري', 3.7e10], ['mCi', 'millicurie', 'ملّي كوري', 3.7e7], ['uCi', 'microcurie', 'مايكروكوري', 3.7e4], ['pCi', 'picocurie', 'بيكوكوري', 0.037]] },
    dose: { n: ['Radiation dose', 'الجرعة الإشعاعية'], i: 'radiation', u: [['Sv', 'sievert', 'سيفرت', 1], ['mSv', 'millisievert', 'ملّي سيفرت', 1e-3], ['uSv', 'microsievert', 'مايكروسيفرت', 1e-6], ['rem', 'rem', 'ريم', 0.01], ['mrem', 'millirem', 'ملّي ريم', 1e-5], ['Gy', 'gray (absorbed, photons)', 'گراي (ممتصة، فوتونات)', 1], ['rad', 'rad (absorbed)', 'راد (ممتصة)', 0.01]] },
    freq: { n: ['Frequency', 'التردد'], i: 'radio', u: [['Hz', 'hertz', 'هيرتز', 1], ['kHz', 'kilohertz', 'كيلوهيرتز', 1e3], ['MHz', 'megahertz', 'ميگاهيرتز', 1e6], ['GHz', 'gigahertz', 'گيگاهيرتز', 1e9], ['rpm', 'revolutions per minute', 'دورة/دقيقة', 1 / 60], ['rads', 'rad/s', 'راديان/ث', 1 / (2 * Math.PI)]] },
    data: { n: ['Digital data', 'البيانات الرقمية'], i: 'hard-drive', u: [['B', 'byte', 'بايت', 1], ['bit', 'bit', 'بت', 0.125], ['kB', 'kilobyte (1000)', 'كيلوبايت (1000)', 1e3], ['MB', 'megabyte', 'ميگابايت', 1e6], ['GB', 'gigabyte', 'گيگابايت', 1e9], ['TB', 'terabyte', 'تيرابايت', 1e12], ['KiB', 'kibibyte (1024)', 'كيبيبايت (1024)', 1024], ['MiB', 'mebibyte', 'ميبيبايت', 1048576], ['GiB', 'gibibyte', 'گيبيبايت', 1073741824], ['TiB', 'tebibyte', 'تيبيبايت', 1099511627776]] },
    fuel: { n: ['Fuel consumption', 'استهلاك الوقود'], i: 'fuel', u: [['L100', 'L/100 km', 'لتر/100 كم', 'L100'], ['kmL', 'km/L', 'كم/لتر', 'kmL'], ['mpgus', 'mile per US gallon', 'ميل/گالون أمريكي', 'mpgus'], ['mpguk', 'mile per imperial gallon', 'ميل/گالون بريطاني', 'mpguk']] }
  };
  var SPECIAL = [['coords', ['Coordinates: decimal, DMS and UTM', 'الإحداثيات: عشرية ودرجات ودقائق وثوانٍ وUTM'], 'map-pin'], ['scale', ['Map scale', 'مقياس الخريطة'], 'map'], ['ions', ['Ions: mg/L ↔ meq/L', 'الأيونات: ملغم/لتر ↔ ملّي مكافئ/لتر'], 'atom']];

  /* ---- special scales: to and from the base of their quantity */
  var TO = {
    api: function (v) { return 141.5 / (v + 131.5) * 999.016; } /* SG at 60 °F relative to water at 60 °F (999.016 kg/m³) */, C: function (v) { return v + 273.15; }, F: function (v) { return (v - 32) * 5 / 9 + 273.15; }, K: function (v) { return v; }, R: function (v) { return v * 5 / 9; },
    pct: function (v) { return Math.atan(v / 100) * 180 / Math.PI; }, pm: function (v) { return Math.atan(v / 1000) * 180 / Math.PI; }, ratio: function (v) { return Math.atan(1 / v) * 180 / Math.PI; }, hv: function (v) { return Math.atan(1 / v) * 180 / Math.PI; }, mkm: function (v) { return Math.atan(v / 1000) * 180 / Math.PI; },
    usft: function (v) { return 1e6 / v * 0.3048; }, usm: function (v) { return 1e6 / v; }, vms: function (v) { return v; }, vfts: function (v) { return v * 0.3048; }, vkms: function (v) { return v * 1000; },
    ohmm: function (v) { return 1 / v; }, ohmcm: function (v) { return 100 / v; }, Sm: function (v) { return v; }, mSm: function (v) { return v / 1000; }, mScm: function (v) { return v / 10; }, uScm: function (v) { return v / 1e4; }, tds: function (v) { return v / 0.64 / 1e4; },
    L100: function (v) { return 100 / v; }, kmL: function (v) { return v; }, mpgus: function (v) { return v * 1.609344 / 3.785411784; }, mpguk: function (v) { return v * 1.609344 / 4.54609; }
  };
  var FROM = {
    api: function (b) { return 141.5 / (b / 999.016) - 131.5; }, C: function (b) { return b - 273.15; }, F: function (b) { return (b - 273.15) * 9 / 5 + 32; }, K: function (b) { return b; }, R: function (b) { return b * 9 / 5; },
    pct: function (b) { return Math.tan(b * Math.PI / 180) * 100; }, pm: function (b) { return Math.tan(b * Math.PI / 180) * 1000; }, ratio: function (b) { return 1 / Math.tan(b * Math.PI / 180); }, hv: function (b) { return 1 / Math.tan(b * Math.PI / 180); }, mkm: function (b) { return Math.tan(b * Math.PI / 180) * 1000; },
    usft: function (b) { return 1e6 / (b / 0.3048); }, usm: function (b) { return 1e6 / b; }, vms: function (b) { return b; }, vfts: function (b) { return b / 0.3048; }, vkms: function (b) { return b / 1000; },
    ohmm: function (b) { return 1 / b; }, ohmcm: function (b) { return 100 / b; }, Sm: function (b) { return b; }, mSm: function (b) { return b * 1000; }, mScm: function (b) { return b * 10; }, uScm: function (b) { return b * 1e4; }, tds: function (b) { return b * 1e4 * 0.64; },
    L100: function (b) { return 100 / b; }, kmL: function (b) { return b; }, mpgus: function (b) { return b / (1.609344 / 3.785411784); }, mpguk: function (b) { return b / (1.609344 / 4.54609); }
  };
  function toBase(u, v) { return typeof u[3] === 'number' ? v * u[3] : TO[u[3]](v); }
  function fromBase(u, b) { return typeof u[3] === 'number' ? b / u[3] : FROM[u[3]](b); }
  var NOTE = {
    area: ['The Iraqi dunam is 2500 m² (the olk is a quarter of it); the metric dunam used in Syria, Jordan and Palestine is 1000 m².', 'الدونم العراقي 2500 م² (والأولك ربعه)، أما الدونم المتري المستعمل في سوريا والأردن وفلسطين فهو 1000 م².'],
    density: ['API gravity = 141.5 / SG − 131.5 at 60 °F; heavier oil has lower API. Mud weight in ppg × 0.1198 = g/cm³.', 'كثافة API = 141.5 / الوزن النوعي − 131.5 عند 60 °ف؛ والنفط الأثقل أقل API. ووزن الطين بوحدة ppg × 0.1198 = غم/سم³.'],
    gradient: ['Fresh-water hydrostatic gradient ≈ 9.79 kPa/m (0.433 psi/ft); typical overburden ≈ 22.6 kPa/m (1.0 psi/ft). Gradient in psi/ft = 0.052 × mud weight in ppg.', 'التدرج الهيدروستاتيكي للماء العذب ≈ 9.79 كيلوباسكال/م (0.433 psi/قدم)، وتدرج الغطاء الصخري النموذجي ≈ 22.6 كيلوباسكال/م (1.0 psi/قدم). والتدرج بوحدة psi/قدم = 0.052 × وزن الطين بوحدة ppg.'],
    angle: ['Slope: percent = 100 × tan(angle); a 45° slope is 100 % and 1 : 1. Ratio 1 : n means 1 vertical for n horizontal.', 'الانحدار: النسبة المئوية = 100 × ظل الزاوية؛ فالانحدار 45° يساوي 100 % و1 : 1. والنسبة 1 : n تعني 1 رأسياً لكل n أفقياً.'],
    slowness: ['Slowness (µs/ft) = 304 800 / velocity (m/s).', 'البطء (مايكروثانية/قدم) = 304800 / السرعة (م/ث).'],
    elec: ['Resistivity is the inverse of conductivity: EC (µS/cm) = 10 000 / ρ (Ω·m). TDS ≈ 0.64 × EC is an average for natural waters; the factor ranges 0.55–0.75 with the ions present.', 'المقاومة النوعية مقلوب الموصلية: الموصلية (مايكروسيمنز/سم) = 10000 / المقاومة (أوم·م). والأملاح الذائبة ≈ 0.64 × الموصلية معدل للمياه الطبيعية، ويتراوح المعامل بين 0.55 و0.75 بحسب الأيونات.'],
    conc: ['mg/L equals ppm only in dilute water (density ≈ 1 g/cm³); in brines divide by the density.', 'يساوي ملغم/لتر جزءاً بالمليون في الماء المخفف فقط (كثافة ≈ 1 غم/سم³)؛ وفي المحاليل الملحية يُقسم على الكثافة.'],
    hydk: ['Darcy for water uses the viscosity and density of water at 20 °C: 1 darcy ≈ 9.66 × 10⁻⁶ m/s.', 'يُحسب الدارسي للماء بلزوجة الماء وكثافته عند 20 °م: 1 دارسي ≈ 9.66 × 10⁻⁶ م/ث.'],
    dose: ['Sievert and gray are equal only for photons (gamma and X-rays).', 'يتساوى السيفرت والگراي للفوتونات فقط (گاما والأشعة السينية).'],
    time: ['Geological time uses the Julian year of 365.25 days (IUPAC–IUGS 2011): 1 Ma = 10⁶ years.', 'يستعمل الزمن الجيولوجي السنة اليوليانية 365.25 يوماً (IUPAC–IUGS 2011): 1 مليون سنة = 10⁶ سنة.']
  };

  /* ---------------------------------------------------------------- interface */
  var cur = SH.store ? (SH.store.get('shandal_uc_q') || 'length') : 'length';
  function list() {
    var q = ($('#uQ').value || '').trim().toLowerCase();
    var items = Object.keys(Q).map(function (k) { return [k, Q[k].n, Q[k].i]; }).concat(SPECIAL);
    $('#uCats').innerHTML = items.filter(function (it) { if (!q) return true; var s = (it[1][0] + ' ' + it[1][1]).toLowerCase(); if (s.indexOf(q) >= 0) return true; var qq = Q[it[0]]; return qq && qq.u.some(function (u) { return (u[0] + ' ' + u[1] + ' ' + u[2]).toLowerCase().indexOf(q) >= 0; }); })
      .map(function (it) { return '<button type="button" data-q="' + it[0] + '" aria-pressed="' + (it[0] === cur) + '">' + IC(it[2]) + '<span>' + C(it[1][0], it[1][1]) + '</span></button>'; }).join('') || '<p class="xsmall muted">' + t('Nothing found.', 'لا نتائج.') + '</p>';
  }
  $('#uQ').addEventListener('input', list);
  $('#uCats').addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (!b) return; cur = b.getAttribute('data-q'); try { SH.store.set('shandal_uc_q', cur); } catch (x) {} list(); show(); if (window.innerWidth < 900) $('#uMain').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  var fmt = function (v) { if (!isFinite(v)) return '—'; var a = Math.abs(v); if (a !== 0 && (a >= 1e12 || a < 1e-6)) return v.toExponential(6).replace(/\.?0+e/, 'e'); var s = (+v.toPrecision(10)).toString(); var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return p.join('.'); };
  function show() {
    var q = Q[cur]; ['uConv', 'uCoord', 'uScale', 'uIons'].forEach(function (id) { $('#' + id).hidden = true; });
    if (cur === 'coords') { $('#uCoord').hidden = false; $('#uTitle').textContent = C('Coordinates', 'الإحداثيات'); coords(); return; }
    if (cur === 'scale') { $('#uScale').hidden = false; $('#uTitle').textContent = C('Map scale', 'مقياس الخريطة'); scale(); return; }
    if (cur === 'ions') { $('#uIons').hidden = false; $('#uTitle').textContent = C('Ions in water', 'الأيونات في الماء'); ions(); return; }
    $('#uConv').hidden = false; $('#uTitle').textContent = C(q.n[0], q.n[1]);
    $('#uFrom').innerHTML = q.u.map(function (u) { return '<option value="' + u[0] + '">' + C(u[1], u[2]) + '</option>'; }).join('');
    $('#uTo').innerHTML = $('#uFrom').innerHTML; if (q.u[1]) $('#uTo').value = q.u[1][0];
    var nt = NOTE[cur]; $('#uNote').hidden = !nt; if (nt) $('#uNote').innerHTML = C(nt[0], nt[1]);
    conv();
  }
  function conv() {
    var q = Q[cur]; if (!q) return; var v = parseFloat(String($('#uVal').value).replace(',', '.')), uf = q.u.filter(function (u) { return u[0] === $('#uFrom').value; })[0], ut = q.u.filter(function (u) { return u[0] === $('#uTo').value; })[0];
    if (!isFinite(v) || !uf) { $('#uRes').textContent = '—'; $('#uAll').innerHTML = ''; return; }
    var b = toBase(uf, v);
    $('#uRes').innerHTML = '<span class="ltr">' + fmt(fromBase(ut, b)) + '</span> <small>' + SH.esc(C(ut[1], ut[2])) + '</small>';
    $('#uAll').innerHTML = q.u.map(function (u) { var r = fromBase(u, b); return '<tr' + (u[0] === uf[0] ? ' class="on"' : '') + '><td>' + SH.esc(C(u[1], u[2])) + '</td><td class="num ltr"><b>' + fmt(r) + '</b></td><td class="cp"><button type="button" class="btn btn-line btn-xs" data-cp="' + (isFinite(r) ? +r.toPrecision(12) : '') + '" aria-label="' + t('Copy', 'نسخ') + '">' + IC('copy') + '</button></td></tr>'; }).join('');
  }
  ['uVal', 'uFrom', 'uTo'].forEach(function (id) { $('#' + id).addEventListener('input', conv); $('#' + id).addEventListener('change', conv); });
  $('#uSwap').addEventListener('click', function () { var a = $('#uFrom').value; $('#uFrom').value = $('#uTo').value; $('#uTo').value = a; conv(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-cp]'); if (!b) return; var s = b.getAttribute('data-cp'); if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { SH.toast(t('Copied ', 'نُسخ ') + s, 'ok'); }); });

  /* ---- coordinates: decimal degrees, degrees–minutes–seconds and UTM on WGS 84 (Karney/Krüger series, accurate to < 1 mm) */
  var A = 6378137, F = 1 / 298.257223563, K0 = 0.9996;
  function utmFwd(lat, lon, zone) {
    var n = F / (2 - F), A1 = A / (1 + n) * (1 + n * n / 4 + Math.pow(n, 4) / 64), al = [n / 2 - 2 * n * n / 3 + 5 * Math.pow(n, 3) / 16, 13 * n * n / 48 - 3 * Math.pow(n, 3) / 5, 61 * Math.pow(n, 3) / 240];
    var lo0 = (zone * 6 - 183) * Math.PI / 180, ph = lat * Math.PI / 180, lm = lon * Math.PI / 180 - lo0, e = Math.sqrt(F * (2 - F));
    var tt = Math.sinh(Math.atanh(Math.sin(ph)) - e * Math.atanh(e * Math.sin(ph))), xi = Math.atan(tt / Math.cos(lm)), et = Math.atanh(Math.sin(lm) / Math.sqrt(1 + tt * tt)), X = et, Y = xi;
    for (var j = 1; j <= 3; j++) { X += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * et); Y += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * et); }
    return { E: 500000 + K0 * A1 * X, N: (lat < 0 ? 10000000 : 0) + K0 * A1 * Y };
  }
  function utmInv(E, N, zone, south) {
    var n = F / (2 - F), A1 = A / (1 + n) * (1 + n * n / 4 + Math.pow(n, 4) / 64), be = [n / 2 - 2 * n * n / 3 + 37 * Math.pow(n, 3) / 96, n * n / 48 + Math.pow(n, 3) / 15, 17 * Math.pow(n, 3) / 480], de = [2 * n - 2 * n * n / 3 - 2 * Math.pow(n, 3), 7 * n * n / 3 - 8 * Math.pow(n, 3) / 5, 56 * Math.pow(n, 3) / 15];
    var xi = (N - (south ? 10000000 : 0)) / (K0 * A1), et = (E - 500000) / (K0 * A1), xp = xi, ep = et;
    for (var j = 1; j <= 3; j++) { xp -= be[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * et); ep -= be[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * et); }
    var chi = Math.asin(Math.sin(xp) / Math.cosh(ep)), ph = chi; for (j = 1; j <= 3; j++) ph += de[j - 1] * Math.sin(2 * j * chi);
    return { lat: ph * 180 / Math.PI, lon: (zone * 6 - 183) + Math.atan2(Math.sinh(ep), Math.cos(xp)) * 180 / Math.PI };
  }
  var dms = function (d, pos, neg) { var s = d < 0 ? neg : pos, a = Math.abs(d), D = Math.floor(a), m = (a - D) * 60, M = Math.floor(m), S = (m - M) * 60; if (S >= 59.9995) { S = 0; M++; } if (M >= 60) { M = 0; D++; } return D + '° ' + String(M).padStart(2, '0') + '′ ' + S.toFixed(3).padStart(6, '0') + '″ ' + s; };
  function parseAng(s) { s = String(s || '').trim().toUpperCase(); if (!s) return NaN; var neg = /[SW]|^-/.test(s) || /[جغ]/.test(s); var nums = s.replace(/[^\d.,\s]+/g, ' ').replace(/,/g, '.').trim().split(/\s+/).map(Number).filter(isFinite); if (!nums.length) return NaN; var v = nums[0] + (nums[1] || 0) / 60 + (nums[2] || 0) / 3600; return neg ? -v : v; }
  function coords() {
    var lat = parseAng($('#cLat').value), lon = parseAng($('#cLon').value), o = [];
    if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 84 && Math.abs(lon) <= 180) {
      var zone = Math.floor((lon + 180) / 6) + 1, u = utmFwd(lat, lon, zone), band = 'CDEFGHJKLMNPQRSTUVWXX'[Math.floor((lat + 80) / 8)];
      o.push(['Decimal degrees', 'درجات عشرية', lat.toFixed(6) + ', ' + lon.toFixed(6)], ['Degrees, minutes, seconds', 'درجات ودقائق وثوانٍ', dms(lat, 'N', 'S') + '   ' + dms(lon, 'E', 'W')], ['Degrees and decimal minutes', 'درجات ودقائق عشرية', Math.trunc(lat) + '° ' + (Math.abs(lat % 1) * 60).toFixed(4) + '′, ' + Math.trunc(lon) + '° ' + (Math.abs(lon % 1) * 60).toFixed(4) + '′'],
        ['UTM (WGS 84)', 'UTM (WGS 84)', zone + band + '   E ' + u.E.toFixed(2) + ' m   N ' + u.N.toFixed(2) + ' m']);
    }
    var E = parseFloat($('#cE').value), N = parseFloat($('#cN').value), z = parseInt($('#cZ').value, 10), south = $('#cH').value === 'S';
    if (isFinite(E) && isFinite(N) && z >= 1 && z <= 60) { var g = utmInv(E, N, z, south); o.push(['From UTM: decimal degrees', 'من UTM: درجات عشرية', g.lat.toFixed(7) + ', ' + g.lon.toFixed(7)], ['From UTM: degrees, minutes, seconds', 'من UTM: درجات ودقائق وثوانٍ', dms(g.lat, 'N', 'S') + '   ' + dms(g.lon, 'E', 'W')]); }
    $('#cOut').innerHTML = o.map(function (r) { return '<tr><td>' + C(r[0], r[1]) + '</td><td class="ltr"><b>' + r[2] + '</b></td><td class="cp"><button type="button" class="btn btn-line btn-xs" data-cp="' + r[2] + '">' + IC('copy') + '</button></td></tr>'; }).join('') || '<tr><td class="muted">' + t('Enter a latitude and longitude, or a UTM position.', 'أدخل خط العرض وخط الطول، أو موقعاً بنظام UTM.') + '</td></tr>';
  }
  ['cLat', 'cLon', 'cE', 'cN', 'cZ', 'cH'].forEach(function (id) { $('#' + id).addEventListener('input', coords); $('#' + id).addEventListener('change', coords); });
  $('#cGps').addEventListener('click', function () { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(function (p) { $('#cLat').value = p.coords.latitude.toFixed(6); $('#cLon').value = p.coords.longitude.toFixed(6); coords(); }, function () { SH.toast(t('Location is not available.', 'الموقع غير متاح.'), 'warn'); }, { enableHighAccuracy: true, timeout: 15000 }); });

  /* ---- map scale */
  function scale() {
    var s = parseFloat(String($('#sS').value).replace(/^1\s*:\s*/, '').replace(/[\s,]/g, '')), mapc = parseFloat($('#sMap').value), gr = parseFloat($('#sGr').value), o = [];
    if (s > 0) { o.push(['1 cm on the map', '1 سم على الخريطة', fmt(s / 100) + ' m = ' + fmt(s / 1e5) + ' km'], ['1 km on the ground', '1 كم على الأرض', fmt(1e5 / s) + ' cm'], ['1 cm² on the map', '1 سم² على الخريطة', fmt(s * s / 1e4) + ' m² = ' + fmt(s * s / 1e8) + ' ha'], ['Smallest plottable feature (0.2 mm)', 'أصغر معلم يمكن رسمه (0.2 ملم)', fmt(s * 0.0002) + ' m']);
      if (mapc > 0) o.push(['Map distance → ground', 'المسافة على الخريطة ← على الأرض', fmt(mapc) + ' cm → ' + fmt(mapc * s / 100) + ' m']); if (gr > 0) o.push(['Ground distance → map', 'المسافة على الأرض ← على الخريطة', fmt(gr) + ' m → ' + fmt(gr * 100 / s) + ' cm']); }
    $('#sOut').innerHTML = o.map(function (r) { return '<tr><td>' + C(r[0], r[1]) + '</td><td class="num ltr"><b>' + r[2] + '</b></td></tr>'; }).join('');
  }
  ['sS', 'sMap', 'sGr'].forEach(function (id) { $('#' + id).addEventListener('input', scale); });

  /* ---- ions: equivalent weight = atomic or formula weight / charge (IUPAC 2021 atomic weights) */
  var ION = [['Ca', 'Ca²⁺', 40.078, 2], ['Mg', 'Mg²⁺', 24.305, 2], ['Na', 'Na⁺', 22.98977, 1], ['K', 'K⁺', 39.0983, 1], ['Fe', 'Fe²⁺', 55.845, 2], ['NH4', 'NH₄⁺', 18.038, 1], ['Cl', 'Cl⁻', 35.453, 1], ['SO4', 'SO₄²⁻', 96.06, 2], ['HCO3', 'HCO₃⁻', 61.016, 1], ['CO3', 'CO₃²⁻', 60.008, 2], ['NO3', 'NO₃⁻', 62.004, 1], ['F', 'F⁻', 18.998, 1], ['PO4', 'PO₄³⁻', 94.97, 3]];
  function ions() {
    if (!$('#iTb').innerHTML) $('#iTb').innerHTML = ION.map(function (i) { return '<tr><td class="ltr"><b>' + i[1] + '</b></td><td class="num ltr">' + (i[2] / i[3]).toFixed(3) + '</td><td><input type="number" step="any" class="ltr" data-ion="' + i[0] + '" data-u="mg" placeholder="mg/L"></td><td><input type="number" step="any" class="ltr" data-ion="' + i[0] + '" data-u="meq" placeholder="meq/L"></td></tr>'; }).join('');
    var cat = 0, an = 0; SH.$$('#iTb [data-u=meq]').forEach(function (e) { var v = parseFloat(e.value); if (!isFinite(v)) return; var io = ION.filter(function (q) { return q[0] === e.getAttribute('data-ion'); })[0]; if (/⁺/.test(io[1])) cat += v; else an += v; });
    $('#iBal').innerHTML = cat + an > 0 ? t('Cations ', 'الكاتيونات ') + '<b class="ltr">' + cat.toFixed(3) + '</b>' + t(' meq/L · anions ', ' ملّي مكافئ/لتر · الأنيونات ') + '<b class="ltr">' + an.toFixed(3) + '</b>' + t(' meq/L · ionic balance error ', ' ملّي مكافئ/لتر · خطأ التوازن الأيوني ') + '<b class="ltr">' + (100 * (cat - an) / (cat + an)).toFixed(1) + ' %</b>' + t(' (acceptable within ±5 %).', ' (مقبول ضمن ±5 %).') : '';
  }
  $('#iTb').addEventListener('input', function (e) { var el = e.target, id = el.getAttribute('data-ion'); if (!id) return; var io = ION.filter(function (q) { return q[0] === id; })[0], ew = io[2] / io[3], v = parseFloat(el.value), other = $('#iTb [data-ion="' + id + '"][data-u="' + (el.getAttribute('data-u') === 'mg' ? 'meq' : 'mg') + '"]');
    other.value = isFinite(v) ? +(el.getAttribute('data-u') === 'mg' ? v / ew : v * ew).toPrecision(6) : ''; ions(); });

  list(); show();
})();
