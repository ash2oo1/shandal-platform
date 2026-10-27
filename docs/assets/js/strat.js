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
  function facies(b, L) {
    var t = L ? function (en, ar) { return L === 'ar' ? ar : en; } : SH.t;
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

  /* ---------------- column renderer: depth axis, bed numbers, lithology profile, structures, and a side panel
     with north arrow, a vertical legend of every symbol drawn, the grain-size key and a horizontal scale bar */
  function render(svg, beds, o) {
    o = o || {}; var S = SH.svgB(svg), ink = '#1B232B', mut = '#55616B', defs = S.add('defs', {});
    beds = beds.filter(function (b) { return R[b.rock] && b.th > 0; }); var total = beds.reduce(function (a, b) { return a + b.th; }, 0);
    var VW = 1000, top = 132, Hc = Math.max(480, Math.min(1000, beds.length * 50)), px = Hc / (total || 1);
    var xDep = 70, xNo = 82, x0 = 120, wMin = 50, wMax = 290, xSt = x0 + wMax + 22, wSt = 128;
    var PX = 616, PW = 360, PY = 74, L0 = PX + 16, R0 = PX + PW - 16;
    var W = function (b) { var g = b.gs != null && b.gs !== '' ? +b.gs : R[b.rock][4]; return wMin + (g / 7) * (wMax - wMin); };
    var iso = function (s) { return String(s).replace(/\(?[A-Za-z0-9][A-Za-z0-9 .,:\/°′″±+\-×()–]*[A-Za-z0-9°′″)]|[A-Za-z0-9]/g, function (m) { return '⁦' + m + '⁩'; }); };
    var txt = function (x, y, s, a, xr) { a = a || {}; if (isAr(s)) { s = iso(s); if (xr != null) { a.direction = 'rtl'; a['text-anchor'] = a['text-anchor'] === 'middle' ? 'middle' : 'start'; return S.text(a['text-anchor'] === 'middle' ? x : xr, y, s, a); } a.direction = 'rtl'; } return S.text(x, y, s, a); };
    var water = o.water > 0 && o.water <= total + 1e-9, floor = o.pitFloor > 0 && o.pitFloor <= total + 1e-9, face = o.faceAz != null && isFinite(o.faceAz);
    var used = { rock: {}, contact: {}, st: {} };
    beds.forEach(function (b) { used.rock[b.rock] = 1; if (b.sec && R[b.sec]) used.rock[b.sec] = 1; used.contact[b.base || 'sharp'] = 1; (b.st || []).forEach(function (k) { if (STRUCT[k]) used.st[k] = 1; }); });
    // legend entries: [draw(x, y), label]
    var items = [];
    Object.keys(used.rock).forEach(function (k) { items.push([function (x, y) { var id = 'lg' + k + Math.random().toString(36).slice(2, 6); pattern(S, defs, id, R[k][3]); S.add('rect', { x: x, y: y - 9, width: 34, height: 18, fill: R[k][2], stroke: ink, 'stroke-width': .7 }); S.add('rect', { x: x, y: y - 9, width: 34, height: 18, fill: 'url(#' + id + ')', stroke: ink, 'stroke-width': .7 }); }, nm(R[k])]); });
    Object.keys(used.contact).forEach(function (k) { items.push([function (x, y) { contact(S, null, k, x, x + 34, y); }, nm(CONTACTS[k])]); });
    Object.keys(used.st).forEach(function (k) { items.push([function (x, y) { symbol(S, null, k, x + 17, y, STRUCT[k][2] === 'f' ? '#5B3A1E' : ink); }, nm(STRUCT[k])]); });
    if (floor) items.push([function (x, y) { S.line(x, y, x + 34, y, { stroke: '#B4552D', 'stroke-width': 2, 'stroke-dasharray': '8 4' }); }, t('Pit floor', 'أرضية الحفر')]);
    if (water) items.push([function (x, y) { S.line(x, y + 4, x + 34, y + 4, { stroke: '#1F6FB2', 'stroke-width': 1.6 }); S.path('M' + (x + 10) + ' ' + (y - 7) + 'h14l-7 10z', { fill: '#fff', stroke: '#1F6FB2', 'stroke-width': 1.2 }); }, t('Water table', 'منسوب المياه الجوفية')]);
    var IH = 25, GSN = [['cl', t('clay', 'طين')], ['si', t('silt', 'غرين')], ['vf', t('very fine sand', 'رمل ناعم جداً')], ['f', t('fine sand', 'رمل ناعم')], ['m', t('medium sand', 'رمل متوسط')], ['c', t('coarse sand', 'رمل خشن')], ['vc', t('very coarse sand', 'رمل خشن جداً')], ['gr', t('gravel', 'حصى')]];
    var panelH = 334 + items.length * IH + (face ? 16 : 0);
    var VH = Math.max(top + Hc + 70, PY + panelH + 40); svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    S.add('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#FFFFFF' }); S.add('rect', { x: 8, y: 8, width: VW - 16, height: VH - 16, fill: 'none', stroke: ink, 'stroke-width': 1.2 });
    txt(30, 46, o.title || t('Geological stratigraphic column', 'العمود الطباقي الجيولوجي'), { 'font-size': 20, 'font-weight': 800, fill: ink }, PX - 24);
    // column headers and grain-size ticks
    var hy = top - 12; S.text(xDep - 2, hy, t('Depth (m)', 'العمق (م)'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' }); S.text(xNo + 18, hy - 18, t('Bed', 'الطبقة'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' });
    S.text(x0 + wMax / 2, hy - 18, t('Lithology and texture', 'الصخارية والنسيج'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' });
    S.text(xSt + wSt / 2, hy - 18, t('Structures and fossils', 'التراكيب والأحافير'), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' });
    GS.forEach(function (g, i) { var gx = x0 + wMin + (i / 7) * (wMax - wMin); S.line(gx, top, gx, top + Hc, { stroke: '#9AA3AD', 'stroke-width': .4, 'stroke-dasharray': '2 4' }); S.text(gx, hy, g, { 'font-size': 9, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); S.text(gx, top + Hc + 16, g, { 'font-size': 9, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); });
    // depth axis
    S.line(xDep + 8, top, xDep + 8, top + Hc, { stroke: ink, 'stroke-width': 1.2 }); var dt = SH.dem && SH.dem.niceInterval ? SH.dem.niceInterval(total, 10) : 1, xa = xDep + 8;
    for (var dv = 0; dv <= total + 1e-9; dv += dt) { var yy = top + dv * px; S.line(xa - 6, yy, xa, yy, { stroke: ink }); S.text(xa - 9, yy + 3.5, SH.fmt(dv, dt < 1 ? 1 : 0), { 'font-size': 10, fill: mut, 'text-anchor': 'end', direction: 'ltr' }); }
    for (dv = 0; dv <= total + 1e-9; dv += dt / 5) { yy = top + dv * px; S.line(xa - 3, yy, xa, yy, { stroke: ink, 'stroke-width': .6 }); }
    // beds
    var y = top, prevW = null;
    beds.forEach(function (b, i) {
      var r = R[b.rock], h = b.th * px, w = W(b), id = 'sp' + i + Math.random().toString(36).slice(2, 6);
      pattern(S, defs, id, r[3]); S.add('rect', { x: x0, y: y, width: w, height: h, fill: r[2] }); S.add('rect', { x: x0, y: y, width: w, height: h, fill: 'url(#' + id + ')' });
      if (b.sec && R[b.sec]) { var id2 = id + 's'; pattern(S, defs, id2, R[b.sec][3]); if (b.mix === 'inter') { var bd = Math.max(4, Math.min(12, h / 6)); for (var k = bd; k < h - .5; k += 2 * bd) { var hh = Math.min(bd, h - k); S.add('rect', { x: x0, y: y + k, width: w, height: hh, fill: R[b.sec][2] }); S.add('rect', { x: x0, y: y + k, width: w, height: hh, fill: 'url(#' + id2 + ')' }); S.line(x0, y + k, x0 + w, y + k, { stroke: ink, 'stroke-width': .4 }); } } else S.add('rect', { x: x0, y: y, width: w, height: h, fill: 'url(#' + id2 + ')', opacity: .65 }); }
      S.line(x0, y, x0, y + h, { stroke: ink, 'stroke-width': 1.3 }); S.line(x0 + w, y, x0 + w, y + h, { stroke: ink, 'stroke-width': 1.3 });
      if (i === 0) S.line(x0, y, x0 + w, y, { stroke: ink, 'stroke-width': 1.5 }); else if (prevW !== null && prevW !== w) S.line(x0 + Math.min(prevW, w), y, x0 + Math.max(prevW, w), y, { stroke: ink, 'stroke-width': 1.3 });
      contact(S, null, b.base || 'sharp', x0, x0 + w, y + h);
      S.text(xNo + 18, y + h / 2 + 4, String(i + 1), { 'font-size': 10.5, 'font-weight': 700, fill: ink, 'text-anchor': 'middle' }); S.line(xNo + 4, y, xNo + 32, y, { stroke: '#C9CED3', 'stroke-width': .6 });
      var st = (b.st || []).filter(function (k) { return STRUCT[k]; }), perRow = 4, cw = wSt / perRow, rows = Math.ceil(st.length / perRow), rh = Math.min(22, Math.max(16, h / Math.max(1, rows)));
      st.forEach(function (k, j) { var col = j % perRow, row = Math.floor(j / perRow), sy = y + h / 2 + (row - (rows - 1) / 2) * rh; sy = Math.max(y + 7, Math.min(y + h - 7, sy)); symbol(S, null, k, xSt + cw / 2 + col * cw, sy, STRUCT[k][2] === 'f' ? '#5B3A1E' : ink); });
      S.line(xSt, y, xSt + wSt, y, { stroke: '#C9CED3', 'stroke-width': .6 });
      prevW = w; y += h;
    });
    S.line(xNo + 4, y, xNo + 32, y, { stroke: '#C9CED3', 'stroke-width': .6 }); S.line(xSt, y, xSt + wSt, y, { stroke: '#C9CED3', 'stroke-width': .6 });
    if (floor) { var py = top + o.pitFloor * px; S.line(xa, py, xSt + wSt, py, { stroke: '#B4552D', 'stroke-width': 2, 'stroke-dasharray': '8 4' }); }
    if (water) { var wy = top + o.water * px; S.line(x0, wy, xSt + wSt, wy, { stroke: '#1F6FB2', 'stroke-width': 1.6 }); S.path('M' + (x0 + wMax - 18) + ' ' + (wy - 11) + 'h14l-7 10z', { fill: '#fff', stroke: '#1F6FB2', 'stroke-width': 1.3 }); }
    // side panel: north arrow
    S.add('rect', { x: PX, y: PY, width: PW, height: panelH, fill: '#fff', stroke: ink, 'stroke-width': 1 });
    var cx = PX + PW / 2, ny = PY + 20, cy = ny + 36, sep = function (yy) { S.line(PX, yy, PX + PW, yy, { stroke: ink, 'stroke-width': .7 }); };
    S.text(cx, ny, 'N', { 'font-size': 15, 'font-weight': 800, fill: ink, 'text-anchor': 'middle' });
    S.path('M' + cx + ' ' + (ny + 6) + 'L' + (cx - 12) + ' ' + (ny + 54) + 'L' + cx + ' ' + (ny + 44) + 'z', { fill: ink, stroke: ink }); S.path('M' + cx + ' ' + (ny + 6) + 'L' + (cx + 12) + ' ' + (ny + 54) + 'L' + cx + ' ' + (ny + 44) + 'z', { fill: '#fff', stroke: ink });
    if (face) { var fz = t('Face azimuth ', 'اتجاه الواجهة ') + String(Math.round(o.faceAz) % 360).padStart(3, '0') + '° (' + SH.dir16(o.faceAz) + ')'; S.text(cx, ny + 78, AR ? iso(fz) : fz, { 'font-size': 10.5, 'font-weight': 700, fill: mut, 'text-anchor': 'middle', direction: AR ? 'rtl' : 'ltr' }); }
    var yL = PY + (face ? 112 : 96); sep(yL); yL += 22;
    var head = function (en, ar, yy) { if (AR) S.text(R0, yy, ar, { 'font-size': 12, 'font-weight': 800, fill: ink, direction: 'rtl', 'text-anchor': 'start' }); else S.text(L0, yy, en, { 'font-size': 11.5, 'font-weight': 800, fill: ink, 'letter-spacing': 1.6 }); };
    head('LEGEND', 'مفتاح الرموز', yL); yL += 22;
    items.forEach(function (it) { if (AR) { it[0](R0 - 34, yL); txt(0, yL + 4, it[1], { 'font-size': 10.5, fill: ink }, R0 - 44); } else { it[0](L0, yL); S.text(L0 + 44, yL + 4, it[1], { 'font-size': 10.5, fill: ink }); } yL += IH; });
    yL += 4; sep(yL); yL += 22; head('GRAIN SIZE', 'حجم الحبيبات', yL); yL += 20;
    GSN.forEach(function (g, i) { var col = i % 2, row = Math.floor(i / 2), half = (PW - 32) / 2, gy = yL + row * 20;
      if (AR) { var xr = R0 - col * half; S.text(xr, gy, g[0], { 'font-size': 10, 'font-weight': 800, fill: ink, 'text-anchor': 'end', direction: 'ltr' }); S.text(xr - 26, gy, g[1], { 'font-size': 10, fill: ink, direction: 'rtl', 'text-anchor': 'start' }); }
      else { var xl = L0 + col * half; S.text(xl, gy, g[0], { 'font-size': 10, 'font-weight': 800, fill: ink }); S.text(xl + 26, gy, g[1], { 'font-size': 10, fill: ink }); } });
    yL += 4 * 20; sep(yL); yL += 22; head('SCALE', 'مقياس الرسم', yL); yL += 14;
    var sbm = 1, cands = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]; cands.forEach(function (c) { if (c * px <= PW - 90) sbm = c; });
    var sbw = sbm * px, sx = AR ? R0 - sbw - 12 : L0 + 6;
    for (var q = 0; q < 4; q++) S.add('rect', { x: sx + q * sbw / 4, y: yL, width: sbw / 4, height: 7, fill: q % 2 ? '#fff' : ink, stroke: ink, 'stroke-width': .8 });
    [0, 2, 4].forEach(function (q) { S.text(sx + q * sbw / 4, yL + 21, SH.fmt(sbm * q / 4, sbm < 4 ? (sbm < 1 ? 2 : 1) : 0), { 'font-size': 9.5, fill: mut, 'text-anchor': 'middle', direction: 'ltr' }); });
    S.text(AR ? sx - 8 : sx + sbw + 8, yL + 8, t('m', 'م'), { 'font-size': 10, 'font-weight': 700, fill: ink, 'text-anchor': AR ? 'end' : 'start' });
    S.text(30, VH - 22, (o.credit || 'Shandal System') + ' · ' + new Date().toISOString().slice(0, 10), { 'font-size': 10, fill: mut, direction: 'ltr' });
    return { total: total, height: VH };
  }

  /* ---------------- bed editor: shared by every survey that logs a section bed by bed */
  function editor(box, addBtn, key, defaults, onChange) {
    var beds = SH.store.get(key, defaults || [{ rock: 'limestone', th: 1 }]);
    beds.forEach(function (b) { if (!R[b.rock]) b.rock = 'limestone'; if (b.sec && !R[b.sec]) b.sec = ''; });
    var save = function () { SH.store.set(key, beds); if (onChange) onChange(beds); };
    var opts = function (sel) { return GROUPS.map(function (g) { return '<optgroup label="' + SH.esc(g[SH.lang === 'ar' ? 2 : 1]) + '">' + Object.keys(R).filter(function (k) { return R[k][5] === g[0]; }).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + nm(R[k]) + '</option>'; }).join('') + '</optgroup>'; }).join(''); };
    var gsOpts = function (sel) { var n = [t('clay', 'طين'), t('silt', 'غرين'), t('very fine sand', 'رمل ناعم جداً'), t('fine sand', 'رمل ناعم'), t('medium sand', 'رمل متوسط'), t('coarse sand', 'رمل خشن'), t('very coarse sand', 'رمل خشن جداً'), t('gravel / crystalline', 'حصى / متبلور')];
      return '<option value="">' + t('Texture: typical for the rock', 'النسيج: النموذجي للصخر') + '</option>' + n.map(function (x, i) { return '<option value="' + i + '"' + (String(sel) === String(i) ? ' selected' : '') + '>' + GS[i] + ' · ' + x + '</option>'; }).join(''); };
    var ctOpts = function (sel) { return Object.keys(CONTACTS).map(function (k) { return '<option value="' + k + '"' + ((sel || 'sharp') === k ? ' selected' : '') + '>' + t('Base: ', 'القاعدة: ') + CONTACTS[k][SH.lang === 'ar' ? 1 : 0] + '</option>'; }).join(''); };
    function bedsUI() {
      var top = 0;
      box.innerHTML = beds.map(function (b, i) {
        var st = b.st || [], chips = Object.keys(STRUCT).map(function (k) { return '<label class="chk" style="font-size:.78rem"><input type="checkbox" data-st="' + k + '"' + (st.indexOf(k) > -1 ? ' checked' : '') + '> ' + STRUCT[k][SH.lang === 'ar' ? 1 : 0] + '</label>'; }).join('');
        var html = '<div style="border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px" data-bed="' + i + '"><div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:3px;border:1px solid #555;background:' + (R[b.rock] ? R[b.rock][2] : '#ccc') + '"></span><b class="small">' + t('Bed ', 'الطبقة ') + (i + 1) + '</b><span class="xsmall muted ltr">' + SH.fmt(top, 2) + '–' + SH.fmt(top + (b.th || 0), 2) + ' m</span><button class="x" style="margin-inline-start:auto" type="button" data-delbed="' + i + '" aria-label="' + t('Delete', 'حذف') + '">✕</button></div>' +
          '<div class="row2"><div class="fg"><select data-f="rock">' + opts(b.rock) + '</select></div><div class="fg"><input type="number" step="0.05" min="0.05" data-f="th" value="' + (b.th || '') + '" placeholder="' + t('Thickness m', 'السمك م') + '"></div></div>' +
          '<div class="row2"><div class="fg"><select data-f="sec"><option value="">' + t('No secondary rock', 'بلا صخر ثانوي') + '</option>' + opts(b.sec) + '</select></div><div class="fg"><select data-f="mix"><option value="mixed"' + (b.mix === 'mixed' ? ' selected' : '') + '>' + t('Mixed', 'مختلط') + '</option><option value="inter"' + (b.mix === 'inter' ? ' selected' : '') + '>' + t('Interbedded', 'متعاقب') + '</option></select></div></div>' +
          '<div class="row2"><div class="fg"><select data-f="gs">' + gsOpts(b.gs) + '</select></div><div class="fg"><select data-f="base">' + ctOpts(b.base) + '</select></div></div>' +
          '<details' + (st.length || b.desc || b.col ? ' open' : '') + '><summary class="small" style="cursor:pointer;font-weight:700">' + t('Colour, description, structures and fossils', 'اللون والوصف والتراكيب والأحافير') + (st.length ? ' · ' + st.length : '') + '</summary><div style="display:grid;gap:8px;margin-top:8px">' +
          '<div class="fg"><input data-f="col" value="' + SH.esc(b.col || '') + '" placeholder="' + t('Colour, e.g. pale yellowish brown (10YR 6/2)', 'اللون، مثل بني مصفر فاتح (10YR 6/2)') + '"></div>' +
          '<div class="fg"><textarea data-f="desc" rows="2" style="min-height:58px" placeholder="' + t('Field description: sorting, hardness, cement, bedding thickness…', 'الوصف الحقلي: الفرز، الصلابة، المادة اللاحمة، سمك التطبق…') + '">' + SH.esc(b.desc || '') + '</textarea></div>' +
          '<div class="chks" style="display:flex;flex-wrap:wrap;gap:4px 12px">' + chips + '</div></div></details></div>';
        top += b.th || 0; return html;
      }).join('');
    }
    box.addEventListener('change', function (e) {
      var box = e.target.closest('[data-bed]'); if (!box) return; var i = +box.getAttribute('data-bed'), f = e.target.getAttribute('data-f'), s = e.target.getAttribute('data-st');
      if (s) { var a = beds[i].st || []; if (e.target.checked) { if (a.indexOf(s) < 0) a.push(s); } else a = a.filter(function (x) { return x !== s; }); beds[i].st = a; save(); return; }
      if (!f) return; beds[i][f] = f === 'th' ? parseFloat(e.target.value) || 0 : e.target.value; save(); if (f !== 'desc' && f !== 'col') bedsUI();
    });
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-delbed]'); if (!b) return; beds.splice(+b.getAttribute('data-delbed'), 1); save(); bedsUI(); });
    addBtn.addEventListener('click', function () { beds.push({ rock: 'limestone', th: 1 }); save(); bedsUI(); });
    bedsUI();
    return { get: function () { return beds; }, set: function (b) { beds = b; save(); bedsUI(); }, redraw: bedsUI };
  }

  SH.strat = { R: R, GROUPS: GROUPS, CONTACTS: CONTACTS, STRUCT: STRUCT, GS: GS, pattern: pattern, symbol: symbol, contact: contact, render: render, editor: editor, facies: facies, dig: dig, name: function (k) { return nm(R[k]); } };
})();
