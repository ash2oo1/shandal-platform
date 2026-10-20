/* SH.strat — stratigraphic column library: rock catalogue with FGDC-style vector patterns, grain-size /
   texture profile, contact types, sedimentary structures and fossil symbols, a research-style column renderer
   with depth axis, vertical scale, face orientation and boxed legend, plus facies and excavatability notes. */
(function () {
  'use strict';
  var t = SH.t, AR = SH.lang === 'ar', isAr = function (s) { return /[؀-ۿ]/.test(String(s || '')); };
  var GS = ['cl', 'si', 'vf', 'f', 'm', 'c', 'vc', 'gr'];
  /* key: [en, ar, colour, pattern, texture class 0–7, group] */
  var R = {
    topsoil: ['Topsoil', 'تربة سطحية', '#B59A7A', 'soil', 1, 'unc'], fill: ['Made ground (fill)', 'ردم (أرض مصطنعة)', '#C8C2B8', 'fill', 3, 'unc'],
    clay: ['Clay', 'طين', '#C7B79B', 'clay', 0, 'unc'], silt: ['Silt', 'غرين', '#D8CFA0', 'silt', 1, 'unc'], sand: ['Sand', 'رمل', '#F2DE9C', 'sand', 4, 'unc'],
    gravel: ['Gravel', 'حصى', '#E3C489', 'gravel', 7, 'unc'], cobbles: ['Cobbles and boulders', 'جلاميد وكتل', '#D6B47E', 'boulder', 7, 'unc'], sabkha: ['Sabkha mud', 'طين سبخي', '#E6DDE8', 'sabkha', 0, 'unc'],
    sandstone: ['Sandstone', 'حجر رملي', '#EBD58A', 'sandstone', 4, 'clastic'], siltstone: ['Siltstone', 'حجر غريني', '#D8CFA0', 'siltstone', 1, 'clastic'], claystone: ['Claystone', 'حجر طيني صلصالي', '#C7B79B', 'claystone', 0, 'clastic'],
    mudstone: ['Mudstone', 'حجر وحلي', '#BDB29A', 'mudstone', 0, 'clastic'], shale: ['Shale', 'طفل (سجيل)', '#B9B9A6', 'shale', 0, 'clastic'], conglomerate: ['Conglomerate', 'مدملكات', '#E3C489', 'cong', 7, 'clastic'], breccia: ['Breccia', 'بريشيا', '#D9B98A', 'brec', 7, 'clastic'],
    limestone: ['Limestone', 'حجر جيري', '#A9CFE3', 'lime', 4, 'carb'], lime_mud: ['Lime mudstone (micrite)', 'حجر جيري دقيق (مكرايت)', '#B9D8EA', 'limemud', 1, 'carb'], wackestone: ['Wackestone', 'واكستون', '#AFD3E6', 'wacke', 2, 'carb'],
    packstone: ['Packstone', 'باكستون', '#A3CBE0', 'pack', 4, 'carb'], grainstone: ['Grainstone', 'جرينستون', '#98C4DC', 'grain', 5, 'carb'], calcarenite: ['Calcarenite', 'حجر جيري فتاتي (كالكارينايت)', '#B3D4F2', 'grain', 5, 'carb'],
    oolitic: ['Oolitic limestone', 'حجر جيري سرئي', '#A6CDE2', 'oolite', 5, 'carb'], fossil_lime: ['Fossiliferous limestone', 'حجر جيري أحفوري', '#9FC8DE', 'fossil', 4, 'carb'], reef: ['Reef limestone (boundstone)', 'حجر جيري شعابي', '#8FBFD6', 'reef', 7, 'carb'],
    chalk: ['Chalk', 'طباشير', '#EEF2EA', 'chalk', 0, 'carb'], marl: ['Marl', 'مارل', '#C9D7B4', 'marl', 1, 'carb'], marly_lime: ['Marly limestone', 'حجر جيري مارلي', '#B7D3CF', 'marlylime', 2, 'carb'],
    sandy_lime: ['Sandy limestone', 'حجر جيري رملي', '#B4D2D8', 'sandylime', 4, 'carb'], dolomite: ['Dolomite', 'دولومايت', '#B8D6C9', 'dolo', 4, 'carb'], calcrete: ['Calcrete (caliche)', 'كالكريت (كاليشي)', '#E8DCC0', 'calcrete', 3, 'carb'], travertine: ['Travertine', 'ترافرتين', '#E9E1CF', 'trav', 4, 'carb'],
    gypsum: ['Gypsum', 'جبس', '#F1D2E4', 'gyp', 3, 'evap'], anhydrite: ['Anhydrite', 'أنهيدرايت', '#E3C7DD', 'anh', 3, 'evap'], halite: ['Halite (rock salt)', 'هاليت (ملح صخري)', '#F4E7F1', 'halite', 3, 'evap'], gypcrete: ['Gypcrete', 'جبكريت', '#EED9E2', 'gypcrete', 3, 'evap'],
    chert: ['Chert', 'صوان', '#D9D3C4', 'chert', 2, 'chem'], phosphorite: ['Phosphorite', 'فوسفوريت', '#D2C29B', 'phos', 4, 'chem'], ironstone: ['Ironstone', 'حجر حديدي', '#C98B5E', 'iron', 3, 'chem'], coal: ['Coal / lignite', 'فحم / لجنايت', '#3A3A3A', 'coal', 0, 'chem'],
    granite: ['Granite', 'غرانيت', '#F2B8A8', 'granite', 7, 'ign'], diorite: ['Diorite', 'دايورايت', '#C6B0A8', 'diorite', 7, 'ign'], gabbro: ['Gabbro', 'غابرو', '#7E8A7A', 'gabbro', 7, 'ign'], basalt: ['Basalt', 'بازلت', '#8F8F99', 'basalt', 7, 'ign'],
    andesite: ['Andesite', 'أنديسايت', '#B09FA6', 'andesite', 7, 'ign'], rhyolite: ['Rhyolite', 'رايولايت', '#E7B8B8', 'rhyolite', 7, 'ign'], tuff: ['Tuff', 'طف بركاني', '#E2D1B8', 'tuff', 4, 'ign'], volc_breccia: ['Volcanic breccia', 'بريشيا بركانية', '#C9B2A0', 'vbrec', 7, 'ign'],
    slate: ['Slate', 'أردواز', '#98A0A8', 'slate', 7, 'meta'], phyllite: ['Phyllite', 'فيليت', '#A9B0A0', 'phyllite', 7, 'meta'], schist: ['Schist', 'شيست', '#B6AFA0', 'schist', 7, 'meta'], gneiss: ['Gneiss', 'نايس', '#D7C1B4', 'gneiss', 7, 'meta'],
    marble: ['Marble', 'رخام', '#E9EEF2', 'marble', 7, 'meta'], quartzite: ['Quartzite', 'كوارتزايت', '#EFE3C8', 'quartzite', 7, 'meta'], serpentinite: ['Serpentinite', 'سربنتينايت', '#8FA88A', 'serp', 7, 'meta']
  };
  var GROUPS = [['unc', 'Unconsolidated sediments and soils', 'رسوبيات غير متماسكة وترب'], ['clastic', 'Siliciclastic rocks', 'صخور فتاتية'], ['carb', 'Carbonate rocks', 'صخور كربونية'], ['evap', 'Evaporites', 'متبخرات'], ['chem', 'Chemical and organic rocks', 'صخور كيميائية وعضوية'], ['ign', 'Igneous rocks', 'صخور نارية'], ['meta', 'Metamorphic rocks', 'صخور متحولة']];
  var CONTACTS = { sharp: ['Sharp contact', 'تماس حاد'], grad: ['Gradational contact', 'تماس تدريجي'], erosive: ['Erosional (scoured) contact', 'تماس تعريتي'], uncon: ['Unconformity', 'عدم توافق'], covered: ['Covered / inferred contact', 'تماس مغطى أو مستنتج'] };
  var STRUCT = {
    lam: ['Parallel lamination', 'تصفّح متوازٍ', 's'], xbed: ['Cross-bedding', 'تطبق متقاطع', 's'], ripple: ['Ripple marks', 'علامات تموج', 's'], graded: ['Graded bedding', 'تطبق متدرج', 's'],
    mudcrack: ['Mud cracks', 'تشققات طينية', 's'], bioturb: ['Bioturbation', 'اضطراب حيوي', 's'], nodule: ['Nodules', 'عقد', 's'], concretion: ['Concretions', 'تكورات', 's'], root: ['Root traces', 'آثار جذور', 's'],
    vug: ['Vugs / karst cavities', 'فجوات وكهوف كارستية', 's'], stylolite: ['Stylolites', 'ستايلولايت', 's'], gypvein: ['Gypsum veins', 'عروق جبسية', 's'], joint: ['Joints / fractures', 'فواصل وكسور', 's'], seep: ['Water seepage', 'رشح مائي', 's'],
    shell: ['Bivalve shells', 'أصداف ذوات المصراعين', 'f'], oyster: ['Oysters', 'محار', 'f'], gastropod: ['Gastropods', 'بطنيات القدم', 'f'], foram: ['Foraminifera', 'منخربات', 'f'], nummulite: ['Nummulites', 'نميوليتات', 'f'],
    coral: ['Corals', 'مرجان', 'f'], echinoid: ['Echinoids', 'قنافذ البحر', 'f'], plant: ['Plant remains', 'بقايا نباتية', 'f'], bone: ['Vertebrate bones', 'عظام فقاريات', 'f'], trace: ['Trace fossils', 'أحافير أثرية', 'f']
  };
  var nm = function (o) { return o ? o[AR ? 1 : 0] : ''; };

  /* ---------------- patterns (24 × 24 user-space tiles) */
  function pattern(S, defs, id, kind, col) {
    col = col || '#2B2B2B'; var W = 24, P = S.add('pattern', { id: id, width: W, height: W, patternUnits: 'userSpaceOnUse' }, null, defs);
    var l = function (d, w, da) { S.add('path', { d: d, stroke: col, 'stroke-width': w || 0.9, fill: 'none', 'stroke-dasharray': da || null, 'stroke-linecap': 'round' }, null, P); };
    var dot = function (x, y, r) { S.add('circle', { cx: x, cy: y, r: r || 1, fill: col }, null, P); }, ring = function (x, y, r, w) { S.add('circle', { cx: x, cy: y, r: r, fill: 'none', stroke: col, 'stroke-width': w || .9 }, null, P); };
    var brick = function () { l('M0 0.5H24M0 12.5H24M6 0.5V12.5M18 12.5V24'); }, v = function (x, y) { l('M' + (x - 3) + ' ' + (y - 2.5) + 'L' + x + ' ' + (y + 2.5) + 'L' + (x + 3) + ' ' + (y - 2.5)); };
    var K = {
      soil: function () { l('M2 20q3-7 6 0M14 9q3-7 6 0'); l('M4 6H9M15 19H20', .7); },
      fill: function () { l('M3 3L9 9M9 3L3 9M15 15L21 21M21 15L15 21', .8); dot(18, 5, 1.2); dot(6, 18, 1.2); },
      clay: function () { l('M0 6H24M0 18H24', .9, '9 3'); }, silt: function () { l('M1 6H10M14 6H23M5 18H19', .9); dot(12, 12, .8); dot(3, 12, .8); },
      sand: function () { dot(4, 4); dot(14, 7); dot(8, 15); dot(19, 18); dot(21, 3); dot(2, 21); }, sandstone: function () { l('M0 .5H24', .6); dot(4, 5); dot(14, 8); dot(8, 15); dot(19, 18); dot(21, 3); dot(3, 20); },
      siltstone: function () { l('M0 .5H24', .6); l('M2 7H10M14 7H22M6 17H18', .9); dot(12, 12, .8); },
      claystone: function () { l('M0 .5H24', .6); l('M0 8H24M0 16H24', .9, '9 3'); }, mudstone: function () { l('M0 6H11M14 6H24M5 18H19', .9); l('M0 .5H24', .6); },
      shale: function () { l('M0 4H9M12 4H22M3 10H15M18 10H24M0 16H8M11 16H21M5 22H17', .8); },
      gravel: function () { ring(6, 6, 3.4); ring(17, 15, 2.6); ring(5, 19, 1.8); }, cong: function () { l('M0 .5H24', .6); ring(6, 7, 3.4); ring(17, 15, 2.8); dot(5, 19, 1.6); dot(18, 4, 1.3); },
      boulder: function () { ring(9, 10, 6.5, 1.1); dot(20, 21, 1.5); }, brec: function () { l('M2 3L9 6L4 10ZM13 12L20 14L14 20Z', .9); l('M0 .5H24', .6); },
      sabkha: function () { l('M0 6H24M0 18H24', .8, '9 3'); l('M4 11L7 13L10 11M15 23L18 21L21 23', .8); },
      lime: brick, limemud: function () { brick(); l('M2 6.5H4M14 18.5H16', .7); }, wacke: function () { brick(); dot(12, 6, .9); dot(3, 18, .9); },
      pack: function () { brick(); dot(10, 4, .9); dot(14, 8, .9); dot(2, 16, .9); dot(22, 20, .9); }, grain: function () { brick(); ring(12, 6.5, 1.4, .7); ring(3, 18.5, 1.4, .7); ring(21, 18.5, 1.4, .7); },
      oolite: function () { brick(); ring(12, 6.5, 2, .7); dot(12, 6.5, .5); ring(3, 18.5, 2, .7); dot(3, 18.5, .5); },
      fossil: function () { brick(); l('M9 8q3-5 6 0M0 20q3-5 6 0', .9); }, reef: function () { l('M3 22V14q0-5 3-8M6 14l4-4M3 17l-3-2M15 22V12q2-4 6-5M15 15l-4-3', 1); },
      chalk: function () { l('M0 .5H24M0 12.5H24M6 .5V12.5M18 12.5V24', .5); l('M12 5V8M10.5 6.5H13.5M3 17V20M1.5 18.5H4.5', .7); },
      marl: function () { brick(); l('M1 6.5H5M13 18.5H17', .8, '2 1.5'); }, marlylime: function () { l('M0 .5H24M6 .5V12.5', .9); l('M0 12.5H24', .9, '5 2'); l('M18 12.5V24', .9); },
      sandylime: function () { brick(); dot(12, 6.5, .9); dot(3, 18.5, .9); dot(21, 20, .9); }, dolo: function () { l('M0 .5H24M0 12.5H24M4 .5L8 12.5M16 12.5L20 24', .9); },
      calcrete: function () { brick(); ring(12, 6.5, 2.4, .9); ring(1, 19, 1.8, .9); }, trav: function () { l('M0 4q6-3 12 0t12 0M0 12q6-3 12 0t12 0M0 20q6-3 12 0t12 0', .8); },
      gyp: function () { v(6, 6); v(18, 18); v(18, 6); v(6, 18); }, anh: function () { l('M0 24L24 0M-6 6L6 -6M18 30L30 18', .9); l('M0 12H24', .6); },
      halite: function () { l('M2 2H10V10H2ZM14 14H22V22H14Z', .9); }, gypcrete: function () { v(6, 6); v(18, 18); ring(18, 6, 2.2, .8); },
      chert: function () { l('M3 9L7 3L11 9ZM14 21L18 15L22 21Z', .9); l('M0 12H24', .6); }, phos: function () { l('M0 .5H24', .6); S.add('text', { x: 4, y: 10, 'font-size': 7, fill: col, 'font-family': 'Arial' }, 'P', P); dot(16, 18, 1.2); dot(19, 7, 1); },
      iron: function () { dot(6, 6, 1.6); dot(18, 18, 1.6); l('M0 12H24', .6); }, coal: function () { S.add('rect', { x: 0, y: 0, width: W, height: W, fill: '#1E1E1E' }, null, P); l('M0 8H24M0 16H24', .4); },
      granite: function () { l('M6 3V9M3 6H9M18 15V21M15 18H21', 1.1); }, diorite: function () { l('M6 3V9M3 6H9M15 15L21 21M21 15L15 21', 1); }, gabbro: function () { l('M3 3L9 9M9 3L3 9M15 15L21 21M21 15L15 21', 1); },
      basalt: function () { v(6, 7); v(18, 19); v(18, 7); v(6, 19); }, andesite: function () { v(6, 7); v(18, 19); l('M16 5H20M4 17H8', .9); }, rhyolite: function () { v(6, 7); l('M14 15q3 4 6 0', .9); v(18, 7); },
      tuff: function () { v(6, 7); v(18, 19); dot(17, 6); dot(5, 18); dot(12, 12, .8); }, vbrec: function () { v(6, 6); l('M13 12L20 15L15 21Z', .9); dot(19, 4, 1.2); },
      slate: function () { l('M0 3H24M0 9H24M0 15H24M0 21H24', .6); l('M4 0L8 24M16 0L20 24', .4); }, phyllite: function () { l('M0 6q3-2 6 0t6 0t6 0t6 0M0 18q3-2 6 0t6 0t6 0t6 0', .8); },
      schist: function () { l('M0 4q3-4 6 0t6 0t6 0t6 0M0 12q3-4 6 0t6 0t6 0t6 0M0 20q3-4 6 0t6 0t6 0t6 0', .8); }, gneiss: function () { l('M0 6q6-5 12 0t12 0M0 18q6-5 12 0t12 0', 1.1); dot(6, 12, 1); dot(18, 1, 1); },
      marble: function () { l('M0 .5H24M0 12.5H24M6 .5L8 12.5M18 12.5L16 24', .8); l('M10 6q3 2 6 0', .5); }, quartzite: function () { dot(4, 4); dot(14, 8); dot(8, 16); dot(20, 19); l('M0 12H8M12 12H20', .6); },
      serp: function () { l('M0 6q4 4 8 0t8 0t8 0M0 18q4 4 8 0t8 0t8 0', .9); l('M4 10L6 14M16 10L18 14', .6); }
    };
    (K[kind] || function () { dot(12, 12); })();
  }

  /* ---------------- structure and fossil symbols, centred at (x, y), about 16 px */
  function symbol(S, g, k, x, y, col) {
    col = col || '#1B232B'; var a = { stroke: col, 'stroke-width': 1.1, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, p = function (d, o) { return S.path(d, Object.assign({}, a, o || {}), g); };
    var X = function (dx) { return x + dx; }, Y = function (dy) { return y + dy; }, M = function () { var s = ''; for (var i = 0; i < arguments.length; i += 2) s += (i ? 'L' : 'M') + X(arguments[i]) + ' ' + Y(arguments[i + 1]); return s; };
    var F = {
      lam: function () { p(M(-8, -4, 8, -4) + M(-8, 0, 8, 0) + M(-8, 4, 8, 4)); }, xbed: function () { p(M(-8, 6, 8, 6)); p('M' + X(-8) + ' ' + Y(-6) + 'Q' + X(-2) + ' ' + Y(-6) + ' ' + X(2) + ' ' + Y(6)); p('M' + X(-3) + ' ' + Y(-6) + 'Q' + X(3) + ' ' + Y(-6) + ' ' + X(7) + ' ' + Y(6)); },
      ripple: function () { p('M' + X(-8) + ' ' + Y(2) + 'q2-5 4 0t4 0t4 0t4 0'); p(M(-8, 6, 8, 6), { 'stroke-width': .7 }); }, graded: function () { p(M(-6, -7, 6, -7, 0, 7) + 'Z'); },
      mudcrack: function () { p(M(-7, -6, -7, 4) + M(-2, -6, -1, 6) + M(4, -5, 6, 5) + M(-7, -1, -1, 0, 5, 0)); }, bioturb: function () { p('M' + X(-6) + ' ' + Y(-6) + 'c4 2-4 6 0 8s-4 6 0 6M' + X(4) + ' ' + Y(-6) + 'c3 3-3 5 0 7'); },
      nodule: function () { S.add('ellipse', Object.assign({ cx: x, cy: y, rx: 7, ry: 4 }, a), null, g); }, concretion: function () { S.circle(x, y, 6.5, a, g); S.circle(x, y, 2.5, { fill: col }, g); },
      root: function () { p(M(0, -7, 0, 7) + M(0, 0, -5, 6) + M(0, 3, 5, 7) + M(0, -3, 4, 1)); }, vug: function () { p('M' + X(-6) + ' ' + Y(2) + 'q2-8 6-6t6 4q-1 6-6 5t-6-3z'); },
      stylolite: function () { p(M(-8, 0, -6, -3, -4, 2, -2, -3, 0, 2, 2, -3, 4, 2, 6, -3, 8, 0)); }, gypvein: function () { p(M(-7, 6, 7, -6), { 'stroke-width': 2, stroke: '#C2185B' }); p(M(-7, 0, 1, -7), { 'stroke-width': 1.2, stroke: '#C2185B' }); },
      joint: function () { p(M(-6, -7, -2, 7) + M(2, -7, 6, 7)); }, seep: function () { p('M' + x + ' ' + Y(-7) + 'C' + X(4) + ' ' + Y(-1) + ' ' + X(5) + ' ' + Y(3) + ' ' + x + ' ' + Y(6) + 'C' + X(-5) + ' ' + Y(3) + ' ' + X(-4) + ' ' + Y(-1) + ' ' + x + ' ' + Y(-7) + 'Z', { stroke: '#1F6FB2', fill: '#9CC9EE' }); },
      shell: function () { p('M' + X(-7) + ' ' + Y(4) + 'Q' + x + ' ' + Y(-10) + ' ' + X(7) + ' ' + Y(4) + 'Z'); p(M(0, 4, 0, -4) + M(-3, 4, -2, -2) + M(3, 4, 2, -2), { 'stroke-width': .7 }); },
      oyster: function () { p('M' + X(-7) + ' ' + Y(-3) + 'q7-6 14 0q-2 8-7 8t-7-8z'); p('M' + X(-4) + ' ' + Y(-1) + 'q4-3 8 0', { 'stroke-width': .7 }); },
      gastropod: function () { p('M' + X(-6) + ' ' + Y(6) + 'L' + X(6) + ' ' + Y(6) + 'L' + x + ' ' + Y(-8) + 'Z'); p(M(-4, 2, 4, 0) + M(-2, -2, 3, -4), { 'stroke-width': .7 }); },
      foram: function () { S.circle(x, y, 6, a, g); p('M' + x + ' ' + y + 'm0-3a3 3 0 1 1-2.6 1.5', { 'stroke-width': .8 }); }, nummulite: function () { S.add('ellipse', Object.assign({ cx: x, cy: y, rx: 8, ry: 3.5 }, a), null, g); p(M(-5, 0, 5, 0), { 'stroke-width': .7 }); },
      coral: function () { p(M(0, 7, 0, -2) + M(0, 1, -5, -6) + M(0, -2, 5, -7) + M(0, 4, 4, 0)); }, echinoid: function () { S.circle(x, y, 6.5, a, g); for (var i = 0; i < 5; i++) { var an = -Math.PI / 2 + i * 2 * Math.PI / 5; p(M(0, 0, Math.cos(an) * 5, Math.sin(an) * 5), { 'stroke-width': .7 }); } },
      plant: function () { p('M' + X(-6) + ' ' + Y(6) + 'Q' + X(-6) + ' ' + Y(-6) + ' ' + X(6) + ' ' + Y(-6) + 'Q' + X(6) + ' ' + Y(6) + ' ' + X(-6) + ' ' + Y(6) + 'Z' + M(-6, 6, 4, -4), { stroke: '#2E7D32' }); },
      bone: function () { p(M(-5, 0, 5, 0), { 'stroke-width': 2.4 }); S.circle(X(-6), Y(-2), 2.2, a, g); S.circle(X(-6), Y(2), 2.2, a, g); S.circle(X(6), Y(-2), 2.2, a, g); S.circle(X(6), Y(2), 2.2, a, g); },
      trace: function () { p('M' + X(-7) + ' ' + Y(5) + 'c3-12 6 4 9-6s3 4 5 2'); }
    };
    (F[k] || function () { S.circle(x, y, 3, { fill: col }, g); })();
  }

  /* ---------------- contact line at y across [x1, x2] */
  function contact(S, g, kind, x1, x2, y) {
    var ink = '#1B232B';
    if (kind === 'grad') return S.line(x1, y, x2, y, { stroke: ink, 'stroke-width': 1.1, 'stroke-dasharray': '7 4' }, g);
    if (kind === 'covered') return S.line(x1, y, x2, y, { stroke: ink, 'stroke-width': 1.2, 'stroke-dasharray': '1.5 3.5', 'stroke-linecap': 'round' }, g);
    if (kind === 'erosive' || kind === 'uncon') { var d = 'M' + x1 + ' ' + y, n = Math.max(3, Math.round((x2 - x1) / 14)), w = (x2 - x1) / n; for (var i = 0; i < n; i++) d += 'q' + (w / 2) + ' ' + (i % 2 ? 4 : -4) + ' ' + w + ' 0';
      S.path(d, { stroke: ink, 'stroke-width': 1.6, fill: 'none' }, g); if (kind === 'uncon') S.path(d.replace('M' + x1 + ' ' + y, 'M' + x1 + ' ' + (y + 4)), { stroke: ink, 'stroke-width': 1.1, fill: 'none' }, g); return; }
    S.line(x1, y, x2, y, { stroke: ink, 'stroke-width': 1.5 }, g);
  }

  /* ---------------- facies and engineering notes */
  function facies(b) {
    var r = R[b.rock] || {}, st = b.st || [], has = function (k) { return st.indexOf(k) > -1; }, k = b.rock, g = r[5];
    if (k === 'topsoil') return t('Modern soil horizon with organic matter.', 'أفق تربة حديثة غني بالمادة العضوية.');
    if (k === 'fill') return t('Anthropogenic made ground.', 'أرض مصطنعة من نشاط بشري.');
    if (g === 'evap' || k === 'sabkha') return t('Evaporitic sabkha or restricted lagoon under an arid climate.', 'سبخة تبخرية أو لاغون محصور في مناخ جاف.');
    if (k === 'reef' || has('coral')) return t('Warm, shallow, normal-marine carbonate platform with reef growth.', 'منصة كربونية بحرية ضحلة دافئة طبيعية الملوحة مع نمو شعابي.');
    if (k === 'oolitic' || k === 'grainstone' || k === 'calcarenite') return t('High-energy carbonate shoal or beach, agitated by waves and tides.', 'ضحل كربوني عالي الطاقة أو شاطئ تحركه الأمواج والمد.');
    if (k === 'chalk' || k === 'lime_mud' || (k === 'marl' && has('foram'))) return t('Quiet, low-energy marine water below wave base.', 'مياه بحرية هادئة منخفضة الطاقة تحت قاعدة الأمواج.');
    if (k === 'marl' || k === 'marly_lime') return t('Low-energy marine or lagoonal setting with clay input.', 'بيئة بحرية أو لاغونية منخفضة الطاقة مع مدخلات طينية.');
    if (k === 'calcrete') return t('Pedogenic carbonate formed in a semi-arid soil profile.', 'كربونات تربة تكونت في مقطع تربة شبه جاف.');
    if (g === 'carb') return has('shell') || has('oyster') || has('nummulite') || has('echinoid') || k === 'fossil_lime' ? t('Shallow marine carbonate shelf with a benthic fauna.', 'رف كربوني بحري ضحل مع حيوانات قاعية.') : t('Marine carbonate shelf.', 'رف كربوني بحري.');
    if (k === 'coal') return t('Peat swamp (mire) with waterlogged vegetation.', 'مستنقع خثي مشبع بالماء والنباتات.');
    if (k === 'gravel' || k === 'conglomerate' || k === 'cobbles') return b.base === 'erosive' ? t('High-energy channel lag or alluvial fan; the erosional base records scour.', 'رواسب قاع قناة عالية الطاقة أو مروحة غرينية؛ القاعدة التعريتية تسجل النحت.') : t('High-energy river or alluvial-fan deposit.', 'رواسب نهرية أو مروحة غرينية عالية الطاقة.');
    if (k === 'breccia') return t('Angular clasts with little transport: talus, fault breccia or collapse.', 'فتات زاوي قليل النقل: ركام سفحي أو بريشيا فالقية أو انهيار.');
    if (k === 'sand' || k === 'sandstone') return has('xbed') ? t('Migrating dunes in a river channel or shoreface.', 'كثبان مهاجرة في قناة نهرية أو وجه شاطئ.') : has('ripple') ? t('Shallow, low-to-moderate energy current or wave reworking.', 'تيارات أو أمواج ضحلة متوسطة الطاقة.') : t('Sand deposited by rivers, wind or shallow sea.', 'رمل رسبته الأنهار أو الرياح أو البحر الضحل.');
    if (k === 'clay' || k === 'silt' || g === 'clastic') return has('mudcrack') ? t('Floodplain or playa fines repeatedly exposed and dried.', 'رواسب ناعمة لسهل فيضي أو بلايا تعرضت للجفاف مراراً.') : has('root') ? t('Floodplain fines with plant colonisation (palaeosol).', 'رواسب سهل فيضي مع نمو نباتي (تربة قديمة).') : t('Low-energy suspension settling: floodplain, lake or quiet marine water.', 'ترسيب من العالق في وسط منخفض الطاقة: سهل فيضي أو بحيرة أو بحر هادئ.');
    if (g === 'ign') return k === 'tuff' || k === 'volc_breccia' ? t('Explosive volcanic deposit.', 'رواسب بركانية انفجارية.') : t('Igneous body: lava flow or intrusion.', 'جسم ناري: لابة أو متداخل.');
    if (g === 'meta') return t('Metamorphic basement or tectonised rock.', 'صخور قاعدية متحولة أو متأثرة تكتونياً.');
    return '';
  }
  function dig(b) { var g = (R[b.rock] || [])[5], k = b.rock;
    if (g === 'unc' || k === 'marl' || k === 'chalk' || k === 'claystone' || k === 'mudstone' || k === 'shale' || k === 'coal' || k === 'sabkha') return [t('Free digging', 'حفر مباشر'), 'ok'];
    if (k === 'gypsum' || k === 'calcrete' || k === 'gypcrete' || k === 'siltstone' || k === 'marly_lime' || k === 'tuff' || k === 'halite' || k === 'phosphorite' || k === 'travertine' || k === 'calcarenite') return [t('Ripping', 'تفكيك بالمخالب (Ripping)'), 'warn'];
    return [t('Hammering or blasting', 'تكسير أو تفجير'), 'bad']; }

  /* ---------------- column renderer */
  function render(svg, beds, o) {
    o = o || {}; var S = SH.svgB(svg), ink = '#1B232B', mut = '#55616B', defs = S.add('defs', {});
    beds = beds.filter(function (b) { return R[b.rock] && b.th > 0; }); var total = beds.reduce(function (a, b) { return a + b.th; }, 0);
    var VW = 1000, top = 150, Hc = Math.max(520, Math.min(1100, beds.length * 46)), px = Hc / (total || 1);
    var xDep = 78, xNo = 92, x0 = 122, wMin = 46, wMax = 236, xSt = x0 + wMax + 24, wSt = 112, xDs = xSt + wSt + 22, xDe = VW - 30;
    var W = function (b) { var g = b.gs != null && b.gs !== '' ? +b.gs : R[b.rock][4]; return wMin + (g / 7) * (wMax - wMin); };
    var txt = function (x, y, s, a, xr) { a = a || {}; if (isAr(s) && xr != null) { a.direction = 'rtl'; a['text-anchor'] = 'start'; return S.text(xr, y, s, a); } return S.text(x, y, s, a); };
    var wrap = function (s, n) { var w = String(s || '').split(/\s+/), out = [''], i; for (i = 0; i < w.length; i++) { if (!w[i]) continue; if ((out[out.length - 1] + ' ' + w[i]).trim().length > n && out[out.length - 1]) out.push(w[i]); else out[out.length - 1] = (out[out.length - 1] + ' ' + w[i]).trim(); } return out; };
    // estimate description heights to size the sheet
    var used = { rock: {}, contact: {}, st: {} }, lines = beds.map(function (b) { var L = [nm(R[b.rock]) + (b.sec && R[b.sec] ? (b.mix === 'inter' ? t(' interbedded with ', ' متعاقب مع ') : t(' with ', ' مع ')) + nm(R[b.sec]).toLowerCase() : '')]; if (b.col) L.push(b.col); if (b.desc) wrap(b.desc, 50).forEach(function (q) { L.push(q); }); return L; });
    var legendRows = 0; beds.forEach(function (b) { used.rock[b.rock] = 1; if (b.sec && R[b.sec]) used.rock[b.sec] = 1; used.contact[b.base || 'sharp'] = 1; (b.st || []).forEach(function (k) { if (STRUCT[k]) used.st[k] = 1; }); });
    var nR = Object.keys(used.rock).length, nC = Object.keys(used.contact).length, nS = Object.keys(used.st).length; legendRows = Math.max(Math.ceil(nR / 2), nC + 1, Math.ceil(nS / 2));
    var VH = top + Hc + 96 + 54 + legendRows * 26 + 70; svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    S.add('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#FFFFFF' }); S.add('rect', { x: 8, y: 8, width: VW - 16, height: VH - 16, fill: 'none', stroke: ink, 'stroke-width': 1.2 });
    // header
    txt(30, 44, o.title || t('Stratigraphic column', 'العمود الطباقي'), { 'font-size': 21, 'font-weight': 800, fill: ink }, VW - 150);
    (o.meta || []).forEach(function (m, i) { txt(30, 68 + i * 17, m, { 'font-size': 12, fill: mut }, VW - 150); });
    // face orientation compass (top right)
    var cx = VW - 70, cy = 72, rr = 34; S.circle(cx, cy, rr, { fill: '#fff', stroke: ink, 'stroke-width': 1 }); ['N', 'E', 'S', 'W'].forEach(function (k, i) { var an = i * Math.PI / 2; S.line(cx + Math.sin(an) * (rr - 6), cy - Math.cos(an) * (rr - 6), cx + Math.sin(an) * rr, cy - Math.cos(an) * rr, { stroke: ink }); if (i) S.text(cx + Math.sin(an) * (rr + 9), cy - Math.cos(an) * (rr + 9) + 4, k, { 'font-size': 9.5, fill: mut, 'text-anchor': 'middle' }); });
    S.path('M' + cx + ' ' + (cy - rr + 2) + 'l-7 20l7-5z', { fill: ink }); S.path('M' + cx + ' ' + (cy - rr + 2) + 'l7 20l-7-5z', { fill: '#fff', stroke: ink, 'stroke-width': .8 }); S.text(cx, cy - rr - 6, 'N', { 'font-size': 14, 'font-weight': 800, fill: ink, 'text-anchor': 'middle' });
    if (o.faceAz != null && isFinite(o.faceAz)) { var fa = SH.rad(o.faceAz); S.line(cx, cy, cx + Math.sin(fa) * (rr - 4), cy - Math.cos(fa) * (rr - 4), { stroke: '#B4552D', 'stroke-width': 2.4 }); S.circle(cx, cy, 2.5, { fill: '#B4552D' });
      S.text(cx, cy + rr + 18, t('Face looks ', 'الواجهة نحو ') + Math.round(o.faceAz) + '°', { 'font-size': 10, fill: '#B4552D', 'text-anchor': 'middle', 'font-weight': 700 }); }
    else S.text(cx, cy + rr + 18, t('Face azimuth not recorded', 'اتجاه الواجهة غير مسجل'), { 'font-size': 9, fill: mut, 'text-anchor': 'middle' });
    // column headers
    var hy = top - 18; S.text(xDep - 4, hy, t('Depth (m)', 'العمق (م)'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'end' }); S.text(xNo + 14, hy, t('Bed', 'طبقة'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' });
    S.text(x0 + wMax / 2, hy - 14, t('Lithology and texture', 'الصخارية والنسيج'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' });
    S.text(xSt + wSt / 2, hy, t('Structures · fossils', 'تراكيب · أحافير'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' });
    txt(xDs, hy, t('Description', 'الوصف'), { 'font-size': 10.5, 'font-weight': 700, fill: ink }, xDe);
    GS.forEach(function (g, i) { var gx = x0 + wMin + (i / 7) * (wMax - wMin); S.line(gx, top, gx, top + Hc, { stroke: '#9AA3AD', 'stroke-width': .4, 'stroke-dasharray': '2 4' }); S.text(gx, hy, g, { 'font-size': 9, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); S.text(gx, top + Hc + 16, g, { 'font-size': 9, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); });
    S.text(x0 + wMax / 2, top + Hc + 31, t('clay · silt · sand (vf–vc) · gravel   |   carbonates by Dunham texture', 'طين · غرين · رمل (ناعم جداً–خشن جداً) · حصى   |   الكربونات حسب نسيج دنهام'), { 'font-size': 8.5, fill: mut, 'text-anchor': 'middle' });
    // depth axis
    S.line(xDep, top, xDep, top + Hc, { stroke: ink, 'stroke-width': 1.2 }); var dt = SH.dem && SH.dem.niceInterval ? SH.dem.niceInterval(total, 10) : 1;
    for (var dv = 0; dv <= total + 1e-9; dv += dt) { var yy = top + dv * px; S.line(xDep - 6, yy, xDep, yy, { stroke: ink }); S.text(xDep - 9, yy + 3.5, SH.fmt(dv, dt < 1 ? 1 : 0), { 'font-size': 10, fill: mut, 'text-anchor': 'end', direction: 'ltr' }); }
    for (dv = 0; dv <= total + 1e-9; dv += dt / 5) { yy = top + dv * px; S.line(xDep - 3, yy, xDep, yy, { stroke: ink, 'stroke-width': .6 }); }
    // beds
    var y = top, prevW = null, descBottom = top - 4;
    beds.forEach(function (b, i) {
      var r = R[b.rock], h = b.th * px, w = W(b), id = 'sp' + i + Math.random().toString(36).slice(2, 6);
      pattern(S, defs, id, r[3]); S.add('rect', { x: x0, y: y, width: w, height: h, fill: r[2] }); S.add('rect', { x: x0, y: y, width: w, height: h, fill: 'url(#' + id + ')' });
      if (b.sec && R[b.sec]) { var id2 = id + 's'; pattern(S, defs, id2, R[b.sec][3]); if (b.mix === 'inter') { var bd = Math.max(4, Math.min(12, h / 6)); for (var k = bd; k < h - .5; k += 2 * bd) { var hh = Math.min(bd, h - k); S.add('rect', { x: x0, y: y + k, width: w, height: hh, fill: R[b.sec][2] }); S.add('rect', { x: x0, y: y + k, width: w, height: hh, fill: 'url(#' + id2 + ')' }); S.line(x0, y + k, x0 + w, y + k, { stroke: ink, 'stroke-width': .4 }); } } else S.add('rect', { x: x0, y: y, width: w, height: h, fill: 'url(#' + id2 + ')', opacity: .65 }); }
      S.line(x0, y, x0, y + h, { stroke: ink, 'stroke-width': 1.3 }); S.line(x0 + w, y, x0 + w, y + h, { stroke: ink, 'stroke-width': 1.3 });
      if (i === 0) S.line(x0, y, x0 + w, y, { stroke: ink, 'stroke-width': 1.5 }); else if (prevW !== null && prevW !== w) S.line(x0 + Math.min(prevW, w), y, x0 + Math.max(prevW, w), y, { stroke: ink, 'stroke-width': 1.3 });
      // base contact of this bed
      contact(S, null, b.base || 'sharp', x0, x0 + w, y + h);
      // bed number
      S.text(xNo + 14, y + h / 2 + 4, String(i + 1), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' }); S.line(xNo, y, xNo + 28, y, { stroke: '#C9CED3', 'stroke-width': .6 });
      // structures and fossils
      var st = (b.st || []).filter(function (k) { return STRUCT[k]; }), perRow = 4, cw = wSt / perRow, rows = Math.ceil(st.length / perRow), rh = Math.min(22, Math.max(16, h / Math.max(1, rows)));
      st.forEach(function (k, j) { var col = j % perRow, row = Math.floor(j / perRow), sy = y + h / 2 + (row - (rows - 1) / 2) * rh; if (sy < y + 6 || sy > y + h - 6) sy = Math.max(y + 7, Math.min(y + h - 7, sy)); symbol(S, null, k, xSt + cw / 2 + col * cw, sy, STRUCT[k][2] === 'f' ? '#5B3A1E' : ink); });
      S.line(xSt, y, xSt + wSt, y, { stroke: '#C9CED3', 'stroke-width': .6 });
      // description with leader
      var L = lines[i], lh = 14, blockH = (L.length + 1) * lh, want = y + h / 2 - blockH / 2 + lh * .8, dy0 = Math.max(want, descBottom + lh * .9);
      S.path('M' + (x0 + w) + ' ' + (y + h / 2) + 'L' + (xSt - 6) + ' ' + (y + h / 2), { stroke: '#C9CED3', 'stroke-width': .6, fill: 'none' });
      S.path('M' + (xSt + wSt + 4) + ' ' + (y + h / 2) + 'L' + (xDs - 6) + ' ' + (dy0 - 4), { stroke: '#9AA3AD', 'stroke-width': .7, fill: 'none' });
      txt(xDs, dy0, (i + 1) + '. ' + L[0], { 'font-size': 11.5, 'font-weight': 800, fill: ink }, xDe);
      S.text(AR ? xDs : xDe, dy0, SH.fmt(b.th, 2) + ' m · ' + SH.fmt((y - top) / px, 2) + '–' + SH.fmt((y - top + h) / px, 2) + ' m', { 'font-size': 10, fill: mut, 'text-anchor': AR ? 'start' : 'end', direction: 'ltr' });
      for (var q = 1; q < L.length; q++) txt(xDs, dy0 + q * lh, L[q], { 'font-size': 10.5, fill: q === 1 && b.col ? '#7A4E1F' : '#2E3740' }, xDe);
      descBottom = dy0 + (L.length - 1) * lh + 6; prevW = w; y += h;
    });
    S.line(xNo, y, xNo + 28, y, { stroke: '#C9CED3', 'stroke-width': .6 });
    if (o.pitFloor > 0 && o.pitFloor <= total + 1e-9) { var py = top + o.pitFloor * px; S.line(xDep - 30, py, xSt + wSt, py, { stroke: '#B4552D', 'stroke-width': 2, 'stroke-dasharray': '8 4' }); S.text(xDep - 32, py - 5, t('Pit floor', 'أرضية الحفر'), { 'font-size': 9.5, fill: '#B4552D', 'text-anchor': 'end', 'font-weight': 700 }); }
    if (o.water > 0 && o.water <= total + 1e-9) { var wy = top + o.water * px; S.line(x0, wy, xSt + wSt, wy, { stroke: '#1F6FB2', 'stroke-width': 1.6 }); S.path('M' + (x0 + wMax - 18) + ' ' + (wy - 11) + 'h14l-7 10z', { fill: '#fff', stroke: '#1F6FB2', 'stroke-width': 1.3 }); S.text(x0 + wMax - 24, wy - 4, t('Water table', 'منسوب المياه'), { 'font-size': 9.5, fill: '#1F6FB2', 'text-anchor': 'end', 'font-weight': 700 }); }
    // vertical scale bar and representative fraction
    var sbm = SH.dem && SH.dem.niceInterval ? SH.dem.niceInterval(total, 4) : 1, sbh = sbm * px, sbx = 30, sby = top + Hc + 52;
    for (var s2 = 0; s2 < 2; s2++) S.add('rect', { x: sbx, y: sby - sbh + s2 * sbh / 2, width: 7, height: sbh / 2, fill: s2 ? '#fff' : ink, stroke: ink, 'stroke-width': .8 });
    S.text(sbx + 12, sby + 3, '0', { 'font-size': 9.5, fill: mut, direction: 'ltr' }); S.text(sbx + 12, sby - sbh + 4, SH.fmt(sbm, sbm < 1 ? 1 : 0) + ' m', { 'font-size': 9.5, fill: mut, direction: 'ltr' });
    var rf = total * 1000 / (Hc * 0.19), rfn = Math.pow(10, Math.floor(Math.log10(rf)) - 1); S.text(sbx, sby + 18, t('Vertical scale ≈ 1 : ', 'المقياس الرأسي ≈ 1 : ') + SH.fmt(Math.round(rf / rfn) * rfn, 0) + t(' (A4)', ' (A4)'), { 'font-size': 9.5, fill: mut });
    // legend box
    var ly = top + Hc + 84, lx = 160, lw = VW - lx - 24, lh2 = 30 + legendRows * 26; S.add('rect', { x: lx, y: ly, width: lw, height: lh2, fill: '#fff', stroke: ink, 'stroke-width': 1 });
    S.text(lx + 12, ly + 18, 'LEGEND', { 'font-size': 11.5, 'font-weight': 800, fill: ink, 'letter-spacing': 1.6 }); if (AR) S.text(lx + lw - 12, ly + 18, 'مفتاح العمود', { 'font-size': 11.5, 'font-weight': 700, fill: mut, direction: 'rtl', 'text-anchor': 'start' });
    var c1 = lx + 12, c2 = lx + lw * 0.52, c3 = lx + lw * 0.74, ry = ly + 38;
    Object.keys(used.rock).forEach(function (k, i) { var cx2 = c1 + (i % 2) * (lw * 0.25), cy2 = ry + Math.floor(i / 2) * 26, id = 'lg' + k + Math.random().toString(36).slice(2, 5); pattern(S, defs, id, R[k][3]);
      S.add('rect', { x: cx2, y: cy2 - 9, width: 30, height: 18, fill: R[k][2], stroke: ink, 'stroke-width': .7 }); S.add('rect', { x: cx2, y: cy2 - 9, width: 30, height: 18, fill: 'url(#' + id + ')' }); txt(cx2 + 36, cy2 + 4, nm(R[k]), { 'font-size': 10, fill: ink }, cx2 + lw * 0.25 - 8); });
    var ci = 0; Object.keys(used.contact).forEach(function (k) { var cy2 = ry + ci * 26; contact(S, null, k, c2, c2 + 34, cy2); txt(c2 + 42, cy2 + 4, nm(CONTACTS[k]), { 'font-size': 10, fill: ink }, c3 - 8); ci++; });
    var cy3 = ry + ci * 26; S.line(c2, cy3, c2 + 34, cy3, { stroke: '#B4552D', 'stroke-width': 2, 'stroke-dasharray': '8 4' }); txt(c2 + 42, cy3 + 4, t('Pit floor', 'أرضية الحفر'), { 'font-size': 10, fill: ink }, c3 - 8);
    Object.keys(used.st).forEach(function (k, i) { var cx2 = c3 + (i % 2) * (lw * 0.13), cy2 = ry + Math.floor(i / 2) * 26; symbol(S, null, k, cx2 + 9, cy2, STRUCT[k][2] === 'f' ? '#5B3A1E' : ink); txt(cx2 + 22, cy2 + 4, nm(STRUCT[k]), { 'font-size': 9, fill: ink }, cx2 + lw * 0.13 - 4); });
    S.text(30, VH - 22, o.credit || 'Shandal System', { 'font-size': 10, 'font-weight': 700, fill: ink }); S.text(VW - 30, VH - 22, (o.source || '') + (o.source ? ' · ' : '') + new Date().toISOString().slice(0, 10), { 'font-size': 9.5, fill: mut, 'text-anchor': 'end', direction: 'ltr' });
    return { total: total, height: VH };
  }

  SH.strat = { R: R, GROUPS: GROUPS, CONTACTS: CONTACTS, STRUCT: STRUCT, GS: GS, pattern: pattern, symbol: symbol, render: render, facies: facies, dig: dig, name: function (k) { return nm(R[k]); } };
})();
