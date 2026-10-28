/* Global Soil Properties — point profile (6 depths to 2 m, predicted value and 90 % prediction interval), USDA
   texture, Saxton & Rawls (2006) hydraulics, WRB classification probabilities, measured soil profiles nearby,
   and property maps of a study area (classed raster with frame, graticule, scale, north arrow and legend),
   exported as PNG, JPG, PDF and GeoTIFF. Data: ISRIC SoilGrids 2.0 (250 m) and WoSIS. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L, P = window.Plotly, AR_UI = SH.lang === 'ar', INK = '#1B232B', MUT = '#55616B';
  var persist = SH.persist('soil2', ['geoName', 'sTitle', 'sLat', 'sLon', 'sSpan', 'sPurpose', 'sDepth', 'sProf']);
  var map = SH.map('sMap', { zoom: 8, base: 'light', bases: ['light'], noSwitch: true, fixedBase: true, locate: false, center: [SH.num('sLat') || 33.1, SH.num('sLon') || 44.5] }), mk = null, last = null, area = null, drawer = null, wms = null, profLayer = null, alt = null;
  var PROPS = ['clay', 'sand', 'silt', 'bdod', 'soc', 'phh2o', 'cec', 'cfvo', 'nitrogen', 'ocd', 'wv0010', 'wv0033', 'wv1500'], DEPTHS = ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm'];
  var DIV = { clay: 10, sand: 10, silt: 10, bdod: 100, soc: 10, phh2o: 10, cec: 10, cfvo: 10, nitrogen: 100, ocd: 10, ocs: 10, wv0010: 10, wv0033: 10, wv1500: 10 };
  /* key: [English name, Arabic name, unit, colour ramp] */
  var LY = {
    ocd: ['Organic carbon density', 'كثافة الكربون العضوي', 'kg/m³', 'soc'], ocs: ['Organic carbon stock (0–30 cm)', 'مخزون الكربون العضوي (0–30 سم)', 'kg/m²', 'soc'],
    clay: ['Clay content', 'محتوى الطين', '%', 'clay'], sand: ['Sand content', 'محتوى الرمل', '%', 'sand'], silt: ['Silt content', 'محتوى الغرين', '%', 'silt'],
    bdod: ['Bulk density of the fine earth', 'الكثافة الظاهرية للتربة الناعمة', 'g/cm³', 'bd'], cfvo: ['Coarse fragments', 'القطع الخشنة (حجمياً)', 'vol %', 'cf'],
    wv0010: ['Water content at −10 kPa', 'المحتوى الحجمي للماء عند −10 كيلوباسكال', 'vol %', 'water'], wv0033: ['Water content at −33 kPa (field capacity)', 'المحتوى الحجمي للماء عند −33 كيلوباسكال (السعة الحقلية)', 'vol %', 'water'], wv1500: ['Water content at −1500 kPa (wilting point)', 'المحتوى الحجمي للماء عند −1500 كيلوباسكال (نقطة الذبول الدائم)', 'vol %', 'water'],
    phh2o: ['Soil pH in water', 'درجة حموضة التربة في الماء', 'pH', 'ph'], soc: ['Soil organic carbon', 'الكربون العضوي في التربة', 'g/kg', 'soc'], nitrogen: ['Total nitrogen', 'النتروجين الكلي', 'g/kg', 'soc'], cec: ['Cation exchange capacity at pH 7', 'السعة التبادلية الكاتيونية عند pH 7', 'cmol(+)/kg', 'cec'],
    wrb: ['WRB Reference Soil Groups (most probable)', 'المجموعات المرجعية للتربة وفق WRB (الأكثر احتمالاً)', '', 'wrb']
  };
  var RAMP = { clay: ['#FFF7EC', '#FDD49E', '#FC8D59', '#D7301F', '#7F0000'], sand: ['#FFFFE5', '#FEE391', '#FEC44F', '#EC7014', '#993404'], silt: ['#F7FCF5', '#C7E9C0', '#74C476', '#238B45', '#00441B'], bd: ['#F7FBFF', '#C6DBEF', '#6BAED6', '#2171B5', '#08306B'],
    cf: ['#FFFFFF', '#D9D9D9', '#969696', '#525252', '#000000'], water: ['#FFFFD9', '#C7E9B4', '#41B6C4', '#225EA8', '#081D58'], ph: ['#D73027', '#FC8D59', '#FEE08B', '#D9EF8B', '#91CF60', '#1A9850', '#4575B4'], soc: ['#FFFFE5', '#D9F0A3', '#78C679', '#238443', '#004529'], cec: ['#FCFBFD', '#DADAEB', '#9E9AC8', '#6A51A3', '#3F007D'] };
  var WRB = [['Acrisols', 'أكريسولات: ترب حامضية غنية بالطين المغسول', '#F7A35C'], ['Albeluvisols', 'ألبيلوفيسولات: ترب ذات ألسنة مُبيَّضة', '#D9C9A3'], ['Alisols', 'أليسولات: ترب حامضية بطين عالي النشاط', '#FFE680'], ['Andosols', 'أندوسولات: ترب بركانية', '#E8473B'], ['Arenosols', 'أرينوسولات: ترب رملية', '#F5DEB3'],
    ['Calcisols', 'كالسيسولات: ترب كلسية', '#FFF29A'], ['Cambisols', 'كامبيسولات: ترب ضعيفة التطور', '#F5C26B'], ['Chernozems', 'تشيرنوزيمات: ترب سوداء غنية بالدبال', '#8C6D46'], ['Cryosols', 'كرايوسولات: ترب متجمدة', '#7B7DB3'], ['Durisols', 'دوريسولات: ترب ذات طبقة سليكية صلبة', '#F4D7A8'],
    ['Ferralsols', 'فيرالسولات: ترب استوائية شديدة التجوية', '#E05A2B'], ['Fluvisols', 'فلوفيسولات: ترب رسوبية نهرية', '#3BA3E0'], ['Gleysols', 'غلايسولات: ترب مشبعة بالماء الجوفي', '#8FA6C7'], ['Gypsisols', 'جبسيسولات: ترب جبسية', '#F2E6C2'], ['Histosols', 'هيستوسولات: ترب عضوية (خُثّية)', '#6E4B3A'],
    ['Kastanozems', 'كاستانوزيمات: ترب بنية كستنائية', '#C99B6E'], ['Leptosols', 'ليبتوسولات: ترب ضحلة فوق الصخر', '#BDBDBD'], ['Lixisols', 'ليكسيسولات: ترب بطين منخفض النشاط', '#F2B6A0'], ['Luvisols', 'لوفيسولات: ترب بأفق طيني مغسول', '#F28C8C'], ['Nitisols', 'نيتيسولات: ترب طينية عميقة لامعة', '#B94A48'],
    ['Phaeozems', 'فايوزيمات: ترب داكنة غنية بالدبال', '#A0785A'], ['Planosols', 'بلانوسولات: ترب ذات تغير قوامي مفاجئ', '#E7A3C7'], ['Plinthosols', 'بلينثوسولات: ترب حديدية (بلينثيت)', '#C0392B'], ['Podzols', 'بودزولات: ترب مُبيَّضة حامضية', '#9AA9B9'], ['Regosols', 'ريغوسولات: ترب فتية غير متطورة', '#FFD9A0'],
    ['Solonchaks', 'سولونتشاكات: ترب ملحية', '#E83E8C'], ['Solonetz', 'سولونيتزات: ترب صودية', '#F7C6E0'], ['Stagnosols', 'ستاغنوسولات: ترب مشبعة بالماء السطحي', '#56B4E9'], ['Umbrisols', 'أمبريسولات: ترب داكنة حامضية', '#6B8E23'], ['Vertisols', 'فيرتيسولات: ترب طينية متشققة منتفخة', '#8E4585']];
  var PRESET = { general: ['clay', 'sand', 'phh2o', 'soc', 'wrb'], agri: ['clay', 'phh2o', 'soc', 'nitrogen', 'cec', 'wv0033', 'wrb'], eng: ['clay', 'sand', 'bdod', 'cfvo', 'wv0033', 'wrb'], carbon: ['ocs', 'ocd', 'soc', 'nitrogen', 'wrb'], water: ['wv0010', 'wv0033', 'wv1500', 'sand', 'clay', 'wrb'] };
  var POLY = { Sand: [[100, 0], [85, 0], [90, 10]], 'Loamy sand': [[85, 0], [70, 0], [85, 15], [90, 10]], 'Sandy loam': [[70, 0], [50, 0], [43, 7], [52, 7], [52, 20], [80, 20], [85, 15]], Loam: [[52, 7], [43, 7], [23, 27], [45, 27], [52, 20]], 'Silt loam': [[50, 0], [20, 0], [8, 12], [0, 12], [0, 27], [23, 27], [43, 7]], Silt: [[20, 0], [0, 0], [0, 12], [8, 12]], 'Sandy clay loam': [[80, 20], [52, 20], [45, 27], [45, 35], [65, 35]], 'Clay loam': [[45, 27], [20, 27], [20, 40], [45, 40]], 'Silty clay loam': [[20, 27], [0, 27], [0, 40], [20, 40]], 'Sandy clay': [[65, 35], [45, 35], [45, 55]], 'Silty clay': [[20, 40], [0, 40], [0, 60]], Clay: [[45, 40], [20, 40], [0, 60], [0, 100], [45, 55]] };
  var AR = { Sand: 'رمل', 'Loamy sand': 'رمل مزيجي', 'Sandy loam': 'مزيجة رملية', Loam: 'مزيجة', 'Silt loam': 'مزيجة غرينية', Silt: 'غرين', 'Sandy clay loam': 'مزيجة طينية رملية', 'Clay loam': 'مزيجة طينية', 'Silty clay loam': 'مزيجة طينية غرينية', 'Sandy clay': 'طين رملي', 'Silty clay': 'طين غريني', Clay: 'طين' };
  var nm = function (k) { return AR_UI ? AR[k] || k : k; }, DL = function (d) { return d.replace('cm', '').replace('-', '–') + ' cm'; };
  function inPoly(x, y, p) { var c = false; for (var i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; } return c; }
  function texture(sand, clay) { var s = sand + 1e-6, c = clay + 1e-6; for (var k in POLY) if (inPoly(s, c, POLY[k])) return k; for (k in POLY) if (inPoly(s - 0.3, c - 0.3, POLY[k])) return k; return '—'; }
  function saxton(S, C, OM) { S /= 100; C /= 100; OM = Math.min(OM, 8);
    var a = -0.024 * S + 0.487 * C + 0.006 * OM + 0.005 * S * OM - 0.013 * C * OM + 0.068 * S * C + 0.031, t1500 = a + (0.14 * a - 0.02);
    var b = -0.251 * S + 0.195 * C + 0.011 * OM + 0.006 * S * OM - 0.027 * C * OM + 0.452 * S * C + 0.299, t33 = b + (1.283 * b * b - 0.374 * b - 0.015);
    var c = 0.278 * S + 0.034 * C + 0.022 * OM - 0.018 * S * OM - 0.027 * C * OM - 0.584 * S * C + 0.078, tS33 = c + (0.636 * c - 0.107), tS = t33 + tS33 - 0.097 * S + 0.043;
    var B = (Math.log(1500) - Math.log(33)) / (Math.log(t33) - Math.log(t1500)), lam = 1 / B, Ks = 1930 * Math.pow(Math.max(tS - t33, 0), 3 - lam);
    return { wp: t1500, fc: t33, sat: tS, paw: t33 - t1500, ks: Ks }; }

  /* ---------- map, point, study area, layer selection */
  function site(lat, lon, fly) { $('#sLat').value = lat.toFixed(4); $('#sLon').value = lon.toFixed(4); persist.save(); if (!map) return; if (mk) mk.setLatLng([lat, lon]); else mk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map); if (fly) map.setView([lat, lon], Math.max(map.getZoom(), 10)); areaInfo(); }
  var drawing = false;
  if (map) map.on('click', function (e) { if (drawing) return; site(e.latlng.lat, e.latlng.lng); }); site(SH.num('sLat') || 33.1, SH.num('sLon') || 44.5);
  $('#sGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { site(p.lat, p.lon, true); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; }); });
  ['sLat', 'sLon'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var a = SH.num('sLat'), b = SH.num('sLon'); if (!isNaN(a) && !isNaN(b)) site(a, b, true); }); });
  function bounds() { if (area) { var b = area.getBounds(); return { s: b.getSouth(), n: b.getNorth(), w: b.getWest(), e: b.getEast() }; } var h = +$('#sSpan').value / 2, la = SH.num('sLat'), lo = SH.num('sLon'); return { s: la - h, n: la + h, w: lo - h / Math.cos(SH.rad(la)), e: lo + h / Math.cos(SH.rad(la)) }; }
  function areaInfo() { var b = bounds(), km = function (d, lat) { return d * 111.32 * (lat == null ? 1 : Math.cos(SH.rad(lat))); }; $('#sAreaInfo').innerHTML = (area ? t('Study area drawn: ', 'منطقة الدراسة المرسومة: ') : t('Study area around the point: ', 'منطقة الدراسة حول النقطة: ')) + '<bdi>' + SH.fmt(km(b.e - b.w, (b.n + b.s) / 2), 0) + ' × ' + SH.fmt(km(b.n - b.s), 0) + ' km</bdi>'; }
  $('#sSpan').addEventListener('change', areaInfo);
  $('#sArea').addEventListener('click', function () { if (!map) return; if (drawer) drawer.cancel(); drawing = true; drawer = SH.drawRect(map, function (bb, r) { if (r) map.removeLayer(r); if (area) map.removeLayer(area); var span = Math.max(bb.getNorth() - bb.getSouth(), bb.getEast() - bb.getWest()); if (span > 3) { SH.toast(t('The study area is limited to 3° (about 330 km).', 'منطقة الدراسة محدودة بـ 3° (نحو 330 كم).'), 'warn'); area = null; } else area = L.rectangle(bb, { color: '#C0392B', weight: 2.5, dashArray: '8 5', fill: false, interactive: false }).addTo(map); areaInfo(); setTimeout(function () { drawing = false; }, 300); }, $('#sHint')); });
  function sel() { return SH.$$('#sLayers [data-ly]').filter(function (i) { return i.checked; }).map(function (i) { return i.getAttribute('data-ly'); }); }
  $('#sPurpose').addEventListener('change', function () { var p = PRESET[this.value]; if (p) SH.$$('#sLayers [data-ly]').forEach(function (i) { i.checked = p.indexOf(i.getAttribute('data-ly')) > -1; }); prevOpts(); });
  $('#sLayers').addEventListener('change', function () { $('#sPurpose').value = 'custom'; prevOpts(); });
  function prevOpts() { var s = $('#sPrev'), v = s.value; s.innerHTML = '<option value="">' + t('Base map only', 'خريطة الأساس فقط') + '</option>' + Object.keys(LY).map(function (k) { return '<option value="' + k + '">' + LY[k][0] + '</option>'; }).join(''); s.value = v || (sel()[0] || ''); preview(); }
  function wmsName(k, d) { return k === 'wrb' ? 'MostProbable' : k === 'ocs' ? 'ocs_0-30cm_mean' : k + '_' + d + '_mean'; }
  function preview() { if (!map) return; if (wms) { map.removeLayer(wms); wms = null; } var k = $('#sPrev').value; if (!k) return;
    wms = L.tileLayer.wms('https://maps.isric.org/mapserv?map=/map/' + k + '.map', { layers: wmsName(k, $('#sDepth').value), format: 'image/png', transparent: true, version: '1.3.0', opacity: .72, attribution: 'Soil data © ISRIC SoilGrids (CC BY 4.0)', crossOrigin: true }).addTo(map); }
  $('#sPrev').addEventListener('change', preview); $('#sDepth').addEventListener('change', preview); prevOpts(); areaInfo();

  /* ---------- GeoTIFF reader (8/16-bit integer, deflate, horizontal predictor) */
  function tiff(buf) {
    var v = new DataView(buf), le = v.getUint16(0) === 0x4949, u16 = function (o) { return v.getUint16(o, le); }, u32 = function (o) { return v.getUint32(o, le); };
    var off = u32(4), n = u16(off), T = {};
    for (var i = 0; i < n; i++) { var e = off + 2 + i * 12, tag = u16(e), typ = u16(e + 2), cnt = u32(e + 4), sz = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 }[typ] || 1, p = cnt * sz > 4 ? u32(e + 8) : e + 8, arr = [];
      for (var k = 0; k < Math.min(cnt, 65536); k++) { var o = p + k * sz; arr.push(typ === 3 ? u16(o) : typ === 4 ? u32(o) : typ === 12 ? v.getFloat64(o, le) : typ === 5 ? u32(o) / u32(o + 4) : typ === 2 ? String.fromCharCode(v.getUint8(o)) : v.getUint8(o)); } T[tag] = arr; }
    var W = T[256][0], H = T[257][0], tiled = !!T[322], tw = tiled ? T[322][0] : W, th = tiled ? T[323][0] : (T[278] || [H])[0], offs = T[324] || T[273], cnts = T[325] || T[279], comp = (T[259] || [1])[0], pred = (T[317] || [1])[0], bits = (T[258] || [16])[0], signed = (T[339] || [1])[0] === 2, bpp = bits / 8;
    var nod = T[42113] ? parseFloat(T[42113].join('')) : NaN, tilesX = Math.ceil(W / tw), out = new Float32Array(W * H).fill(NaN);
    return Promise.all(offs.map(function (o, idx) { var raw = new Uint8Array(buf, o, cnts[idx]);
      var p = comp === 8 || comp === 32946 ? new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer() : comp === 1 ? Promise.resolve(raw.slice().buffer) : Promise.reject(new Error('TIFF compression ' + comp));
      return p.then(function (ab) { var dv = new DataView(ab), a = new Int32Array(tw * th), N = Math.min(tw * th, Math.floor(ab.byteLength / bpp));
        for (var q = 0; q < N; q++) a[q] = bpp === 1 ? dv.getUint8(q) : signed ? dv.getInt16(q * 2, le) : dv.getUint16(q * 2, le);
        if (pred === 2) for (var y = 0; y < th; y++) for (var x = 1; x < tw; x++) { var z = a[y * tw + x] + a[y * tw + x - 1]; a[y * tw + x] = bpp === 1 ? z & 0xff : signed ? (z << 16 >> 16) : (z & 0xffff); }
        var tx0 = tiled ? (idx % tilesX) * tw : 0, ty0 = tiled ? Math.floor(idx / tilesX) * th : idx * th;
        for (y = 0; y < th; y++) for (x = 0; x < tw; x++) { var X = tx0 + x, Y = ty0 + y, val = a[y * tw + x]; if (X < W && Y < H && val !== nod && !(signed && val === -32768)) out[Y * W + X] = val; } }); }))
      .then(function () { var sc = T[33550], tp = T[33922]; return { W: W, H: H, data: out, x0: tp[3] - tp[0] * sc[0], y0: tp[4] + tp[1] * sc[1], dx: sc[0], dy: sc[1] }; });
  }
  function wcs(k, d, b) { return 'https://maps.isric.org/mapserv?map=/map/' + k + '.map&SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=' + wmsName(k, d) + '&FORMAT=image/tiff&SUBSET=long(' + b.w.toFixed(5) + ',' + b.e.toFixed(5) + ')&SUBSET=lat(' + b.s.toFixed(5) + ',' + b.n.toFixed(5) + ')&SUBSETTINGCRS=http://www.opengis.net/def/crs/EPSG/0/4326&OUTPUTCRS=http://www.opengis.net/def/crs/EPSG/0/4326'; }
  function nearestValid(lat, lon) {
    var d = 0.11; return fetch(wcs('clay', '0-5cm', { w: lon - d, e: lon + d, s: lat - d, n: lat + d })).then(function (r) { if (!r.ok) throw new Error('WCS ' + r.status); return r.arrayBuffer(); }).then(tiff).then(function (G) {
      var best = null, n = 0;
      for (var y = 0; y < G.H; y++) for (var x = 0; x < G.W; x++) { if (!(G.data[y * G.W + x] > 0)) continue; n++; var la = G.y0 - (y + .5) * G.dy, lo = G.x0 + (x + .5) * G.dx, dd = Math.hypot((la - lat) * 110574, (lo - lon) * 111320 * Math.cos(SH.rad(lat))); if (!best || dd < best.d) best = { lat: la, lon: lo, d: dd }; }
      if (best) { best.masked = 1 - n / (G.W * G.H); best.az = (SH.deg(Math.atan2((best.lon - lon) * Math.cos(SH.rad(lat)), best.lat - lat)) + 360) % 360; }
      return best;
    });
  }

  /* ---------- point queries */
  /* the service answers in about 5–7 s per property, so the properties are requested in three parallel groups */
  var GROUPS = [['clay', 'sand', 'silt', 'bdod', 'cfvo'], ['soc', 'phh2o', 'cec', 'nitrogen', 'ocd'], ['wv0010', 'wv0033', 'wv1500']];
  function query(lat, lon) {
    return Promise.all(GROUPS.map(function (g) { var q = 'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=' + lon.toFixed(5) + '&lat=' + lat.toFixed(5) + g.map(function (p) { return '&property=' + p; }).join('') + DEPTHS.map(function (d) { return '&depth=' + d; }).join('') + '&value=mean&value=Q0.05&value=Q0.95';
      return SH.getJSON(q, { timeout: 150000 }).catch(function (e) { if (/429/.test(e.message)) throw new Error(t('The soil service allows about five requests per minute. Wait one minute and run the analysis again.', 'تسمح خدمة التربة بنحو خمسة طلبات في الدقيقة. انتظر دقيقة ثم أعد إصدار التحليل.')); throw e; }); }))
    .then(function (js) { var R = {}; js.forEach(function (j) { (j.properties.layers || []).forEach(function (l) { var df = (l.unit_measure && l.unit_measure.d_factor) || DIV[l.name] || 1; R[l.name] = l.depths.map(function (d) { var v = d.values; return { label: d.label, top: d.range.top_depth, bot: d.range.bottom_depth, mean: v.mean == null ? NaN : v.mean / df, lo: v['Q0.05'] == null ? NaN : v['Q0.05'] / df, hi: v['Q0.95'] == null ? NaN : v['Q0.95'] / df }; }); }); }); return R; });
  }
  function classify(lat, lon) { return SH.getJSON('https://rest.isric.org/soilgrids/v2.0/classification/query?lon=' + lon.toFixed(5) + '&lat=' + lat.toFixed(5) + '&number_classes=5', { timeout: 60000 }).catch(function () { return null; }); }
  function profiles(lat, lon) {
    var v = '(first:1){ valueAvg }', d = 0.6, q = '{ wosisLatestProfiles(first: 40, filter: {latitude: {greaterThan: ' + (lat - d) + ', lessThan: ' + (lat + d) + '}, longitude: {greaterThan: ' + (lon - d) + ', lessThan: ' + (lon + d) + '}}) { profileId profileCode datasetCode wrbReferenceSoilGroup usdaOrderName year latitude longitude layers(first:12){ upperDepth lowerDepth layerName clayValues' + v + ' sandValues' + v + ' siltValues' + v + ' phaqValues' + v + ' orgcValues' + v + ' tceqValues' + v + ' elcospValues' + v + ' cecph7Values' + v + ' } } }';
    return fetch('https://graphql.isric.org/wosis/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }) }).then(function (r) { return r.json(); }).then(function (j) {
      var g = function (a) { return a && a[0] && a[0].valueAvg != null ? +a[0].valueAvg : NaN; };
      return ((j.data && j.data.wosisLatestProfiles) || []).map(function (p) { return { id: p.profileId, code: p.profileCode, ds: p.datasetCode, wrb: p.wrbReferenceSoilGroup || '', usda: p.usdaOrderName || '', year: p.year, lat: p.latitude, lon: p.longitude, d: Math.hypot((p.latitude - lat) * 110.574, (p.longitude - lon) * 111.32 * Math.cos(SH.rad(lat))),
        layers: (p.layers || []).map(function (l) { return { top: l.upperDepth, bot: l.lowerDepth, name: l.layerName || '', clay: g(l.clayValues), sand: g(l.sandValues), silt: g(l.siltValues), ph: g(l.phaqValues), oc: g(l.orgcValues), caco3: g(l.tceqValues), ec: g(l.elcospValues), cec: g(l.cecph7Values) }; }).sort(function (a, b) { return a.top - b.top; }) }; })
        .sort(function (a, b) { return a.d - b.d; }).slice(0, 5);
    }).catch(function () { return []; });
  }

  /* ---------- run */
  var DIRS = function (az) { var en = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'], ar = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'], i = Math.round(az / 45) % 8; return t(en[i], ar[i]); };
  function run() {
    var lat = SH.num('sLat'), lon = SH.num('sLon'), btn = $('#sRun'), host = $('.ws-main'); if (isNaN(lat) || isNaN(lon)) return; btn.disabled = true; SH.busy(host, true, t('Reading the soil profile at six depths (about 30–60 s)…', 'جارٍ قراءة مقطع التربة عند ست أعماق (نحو 30–60 ثانية)…'));
    if (alt && map) { map.removeLayer(alt); alt = null; }
    var empty = function (R) { return !R.clay || R.clay.every(function (d) { return isNaN(d.mean); }); }, note = null, qlat = lat, qlon = lon;
    query(lat, lon).then(function (R) {
      if (!empty(R)) return R;
      SH.busy(host, true, t('The point is masked (built-up land or water); searching the nearest soil pixel…', 'النقطة مُقنَّعة (أرض مبنية أو مياه)؛ جارٍ البحث عن أقرب خلية تربة…'));
      return nearestValid(lat, lon).then(function (b) {
        if (!b) throw new Error(t('No soil prediction exists within about 12 km of this point: built-up land, permanent water, ice and bare rock are not predicted. Choose a point on open land.', 'لا يوجد تنبؤ للتربة ضمن نحو 12 كم من هذه النقطة؛ إذ لا يُتنبأ بالتربة تحت المناطق المبنية والمياه الدائمة والجليد والصخر العاري. اختر نقطة على أرض مكشوفة.'));
        note = b; qlat = b.lat; qlon = b.lon; return query(b.lat, b.lon).then(function (R2) { if (empty(R2)) throw new Error(t('No prediction for the nearest pixel either. Try another point.', 'لا يوجد تنبؤ لأقرب خلية أيضاً. جرّب نقطة أخرى.')); return R2; });
      });
    }).then(function (R) {
      SH.busy(host, true, t('Soil classification and measured profiles…', 'تصنيف التربة والمقاطع المقيسة…'));
      return Promise.all([R, classify(qlat, qlon), $('#sProf').checked ? profiles(lat, lon) : []]);
    }).then(function (A) {
      var Rr = A[0], rows = DEPTHS.map(function (_, i) { var r = { label: Rr.clay[i].label, top: Rr.clay[i].top, bot: Rr.clay[i].bot }; PROPS.forEach(function (p) { r[p] = Rr[p] ? Rr[p][i] : { mean: NaN, lo: NaN, hi: NaN }; }); var s = r.sand.mean, c = r.clay.mean, si = r.silt.mean, tot = s + c + si; if (tot > 0) { s = 100 * s / tot; c = 100 * c / tot; } r.tex = texture(s, c); r.S = s; r.C = c; r.OM = 1.724 * r.soc.mean / 10; r.h = saxton(s, c, r.OM || 0); return r; });
      last = { lat: lat, lon: lon, rows: rows, near: note, wrb: A[1], prof: A[2], b: bounds(), depth: $('#sDepth').value, layers: sel() };
      if (note && map) alt = L.layerGroup([L.polyline([[lat, lon], [note.lat, note.lon]], { color: '#1F6FB2', weight: 2, dashArray: '5 4' }), L.circleMarker([note.lat, note.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#1F6FB2', fillOpacity: 1 }).bindTooltip(t('Nearest predicted soil pixel', 'أقرب خلية تربة متنبأ بها'))]).addTo(map);
      if (map) { if (profLayer) map.removeLayer(profLayer); profLayer = L.layerGroup(last.prof.map(function (p) { return L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 1.5, fillColor: '#C0392B', fillOpacity: 1 }).bindTooltip(p.code + ' · ' + (p.wrb || p.usda || '') + (p.year ? ' · ' + p.year : '')); })).addTo(map); }
      render();
      SH.busy(host, false);
      return maps();
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { btn.disabled = false; SH.busy(host, false); });
  }

  /* ---------- results */
  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  var f1 = function (v, d) { return isNaN(v) ? '—' : SH.fmt(v, d == null ? 1 : d); }, num = function (v, d, u) { return '<span class="ltr">' + f1(v, d) + (u ? '&nbsp;' + u : '') + '</span>'; };
  function wrbTop() { var w = last.wrb; if (!w || !w.wrb_class_name) return null; var nmEn = w.wrb_class_name, i = WRB.findIndex(function (x) { return x[0] === nmEn; }); return { en: nmEn, ar: i > -1 ? WRB[i][1] : nmEn, p: (w.wrb_class_probability || []).map(function (q) { return { n: q[0], p: +q[1] }; }) }; }
  function render() {
    var r = last.rows, top = r[0], sub = r[3], W = wrbTop();
    $('#sEmpty').hidden = true; $('#sOut').hidden = false;
    var pawProf = r.reduce(function (a, x) { var fc = x.wv0033.mean, wp = x.wv1500.mean, paw = isFinite(fc) && isFinite(wp) ? (fc - wp) / 100 : x.h.paw; return a + (isNaN(paw) ? 0 : paw * (x.bot - x.top) * 10); }, 0); last.paw = pawProf;
    var ph = top.phh2o.mean;
    $('#sKpis').innerHTML = kpi('info', t('Topsoil texture (0–5 cm)', 'قوام التربة السطحية (0–5 سم)'), nm(top.tex), t('Sand ', 'رمل ') + num(top.S, 0, '%') + ' · ' + t('Clay ', 'طين ') + num(top.C, 0, '%')) +
      kpi('', t('Subsoil texture (30–60 cm)', 'قوام التربة تحت السطحية (30–60 سم)'), nm(sub.tex), t('Clay ', 'طين ') + num(sub.C, 0, '%')) +
      kpi(ph > 8.5 || ph < 5.5 ? 'warn' : 'ok', t('Soil reaction', 'تفاعل التربة') + ' pH', num(ph, 1), ph > 8.5 ? t('strongly alkaline', 'قاعدي بقوة') : ph > 7.3 ? t('alkaline (calcareous)', 'قاعدي (كلسي)') : ph < 5.5 ? t('acidic', 'حامضي') : t('near neutral', 'قريب من التعادل')) +
      kpi(top.soc.mean < 6 ? 'warn' : '', t('Organic carbon', 'الكربون العضوي'), num(top.soc.mean, 1) + '<small class="ltr"> g/kg</small>', t('Organic matter ≈ ', 'المادة العضوية ≈ ') + num(top.OM, 2, '%')) +
      kpi('', t('Plant-available water to 2 m', 'الماء المتاح للنبات حتى 2 م'), num(pawProf, 0) + '<small class="ltr"> mm</small>', t('between −33 and −1500 kPa', 'بين −33 و−1500 كيلوباسكال')) +
      (W ? kpi('info', t('WRB soil group', 'المجموعة المرجعية WRB'), '<span dir="ltr">' + W.en + '</span>', (AR_UI ? W.ar.split(':')[1] + ' · ' : '') + t('probability ', 'احتمال ') + num(W.p[0] ? W.p[0].p : NaN, 0, '%')) : '');
    var nr = last.near; $('#sNear').hidden = !nr; if (nr) $('#sNear').innerHTML = '<span class="ib">' + SH.icon('info') + '</span><div><b>' + t('The selected point lies on masked land', 'النقطة المختارة تقع على أرض مُقنَّعة') + '</b><p style="margin:4px 0 0;line-height:1.8">' +
      t('Soil is not predicted under built-up land, permanent water or ice. The profile below is that of the nearest predicted 250 m cell, ', 'لا يُتنبأ بالتربة تحت المناطق المبنية والمياه الدائمة والجليد. المقطع أدناه لأقرب خلية متنبأ بها بدقة 250 م، على بعد ') + '<b class="ltr">' + SH.fmt(nr.d, 0) + ' m</b>' + t(' to the ', ' باتجاه ') + DIRS(nr.az) + '. ' +
      t('Natural soil under a city is usually sealed, excavated or replaced by fill, so test pits are needed on the site itself.', 'التربة الطبيعية تحت المدن تكون غالباً مغلقة أو محفورة أو مستبدلة بالردم، لذلك تلزم حفر اختبارية في الموقع نفسه.') + '</p></div>';
    interp(r, pawProf, W); figTex(r); tri(r); figProp(r); figWrb(W); figProf(r); table(r);
  }
  var EXP = false, PF = 'Manrope, Arial, sans-serif';
  function lay(extra) { var l = SH.plotLayout(extra); if (EXP) { l.paper_bgcolor = l.plot_bgcolor = '#fff'; l.font = { family: PF, color: INK, size: 13 }; } else l.font = Object.assign({}, l.font, { family: PF }); return l; }
  function figTex(r) {
    var lab = r.map(function (x) { return DL(x.label); });
    SH.plot('sTex', [['S', '#E9C46A', 'Sand (2–0.05 mm)', 'sand'], ['silt', '#A3B18A', 'Silt (0.05–0.002 mm)', 'silt'], ['C', '#BC6C25', 'Clay (< 0.002 mm)', 'clay']].map(function (k) { var vals = r.map(function (x) { return k[0] === 'silt' ? 100 - x.S - x.C : x[k[0]]; });
      return { type: 'bar', orientation: 'h', y: lab, x: vals, name: k[2], marker: { color: k[1], line: { color: '#fff', width: 1 } }, text: vals.map(function (v) { return Math.round(v) + '%'; }), textposition: 'inside', insidetextanchor: 'middle', textfont: { color: '#1B232B', size: 12 }, hovertemplate: '%{y}: %{x:.1f} %<extra>' + k[2] + '</extra>' }; }),
      function () { return lay({ barmode: 'stack', bargap: .3, margin: { l: 96, r: 20, t: 46, b: 56 }, legend: { orientation: 'h', x: .5, xanchor: 'center', y: 1.13 }, yaxis: { autorange: 'reversed', automargin: true, ticksuffix: '  ' }, annotations: [{ xref: 'paper', yref: 'paper', x: 0, y: 1, xanchor: 'right', yanchor: 'bottom', xshift: -8, yshift: 4, showarrow: false, text: '<b>Depth</b>', font: { size: 13 } }], xaxis: { range: [0, 100], ticksuffix: ' %', title: { text: 'Mass fraction of the fine earth (< 2 mm)' } } }); }, { filename: 'shandal-particle-size' });
    var top = r[0], dc = r[5].C - top.C;
    $('#sTexCap').innerHTML = t('The profile is ', 'المقطع ') + '<b>' + nm(top.tex) + '</b>' + t(' at the surface', ' عند السطح') + (r[5].tex !== top.tex ? t(' and ', ' و') + '<b>' + nm(r[5].tex) + '</b>' + t(' at 1–2 m', ' عند 1–2 م') : t(' throughout', ' في كامل العمق')) + '. ' +
      (Math.abs(dc) < 5 ? t('Clay changes little with depth, which indicates a uniform parent material (typical of alluvial or aeolian deposits) and weak horizon development.', 'يتغير الطين قليلاً مع العمق، ما يدل على مادة أصل متجانسة (مثل الرسوبيات النهرية أو الريحية) وتطور ضعيف للآفاق.') : dc > 0 ? t('Clay increases with depth, consistent with clay illuviation into a Bt horizon or a finer underlying deposit.', 'يزداد الطين مع العمق، وهذا يتفق مع ترسيب طيني مغسول في أفق Bt أو مع رسوبيات أنعم في الأسفل.') : t('Clay decreases with depth, which points to a coarser underlying deposit or surface clay accumulation.', 'يتناقص الطين مع العمق، ما يشير إلى رسوبيات أخشن في الأسفل أو إلى تراكم طيني سطحي.'));
  }
  function tri(r) {
    var S = SH.svgB('sTri'), W = 980, H = 600, A = [70, 540], B = [610, 540], C = [340, 72], Pt = function (sand, clay) { var silt = 100 - sand - clay; return [A[0] * sand / 100 + B[0] * silt / 100 + C[0] * clay / 100, A[1] * sand / 100 + B[1] * silt / 100 + C[1] * clay / 100]; };
    var tx = function (x, y, s, a) { return S.text(x, y, s, Object.assign({ fill: INK, 'font-size': 13, direction: 'ltr', 'font-family': PF }, a || {})); };
    S.add('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' });
    var fills = { Sand: '#F4E3B5', 'Loamy sand': '#EDD9A3', 'Sandy loam': '#E3E6B6', Loam: '#D3E3C2', 'Silt loam': '#E9D2B8', Silt: '#DAD2C8', 'Sandy clay loam': '#F1E0B0', 'Clay loam': '#EAD6A6', 'Silty clay loam': '#DDE5B6', 'Sandy clay': '#D7E6C9', 'Silty clay': '#E6CCB2', Clay: '#D8CCC2' };
    for (var k in POLY) S.poly(POLY[k].map(function (q) { return Pt(q[0], q[1]); }), { fill: fills[k], stroke: '#6b5b45', 'stroke-width': 1 });
    var LBL = { Sand: [[92.5, 3.2]], 'Loamy sand': [[80.8, 4.3]], 'Sandy loam': [[64, 10], [62, 16], [71, 15]], Loam: [[42, 17], [39, 22], [47, 11]], 'Silt loam': [[27, 12], [20, 19], [32, 5]], Silt: [[7, 5]], 'Sandy clay loam': [[60, 27], [56, 32], [66, 23]], 'Clay loam': [[32, 34], [27, 38], [37, 29.5], [26, 30]], 'Silty clay loam': [[10, 34], [10, 37], [10, 31]], 'Sandy clay': [[53, 39], [52, 41], [54, 37]], 'Silty clay': [[8, 44], [7, 46], [9, 42]], Clay: [[22, 60], [18, 50], [14, 68]] };
    var PP = r.map(function (x) { return isNaN(x.S) ? null : Pt(x.S, x.C); }).filter(Boolean);
    for (k in LBL) { var fs = k === 'Loamy sand' ? 9.5 : k.length > 12 ? 10.5 : 11.5, hw = k.length * fs * .29 + 6, pos = LBL[k].map(function (q) { return Pt(q[0], q[1]); }), best = pos[0];
      for (var pi = 0; pi < pos.length; pi++) { var q0 = pos[pi]; if (!PP.some(function (p) { return Math.abs(p[0] - q0[0]) < hw && Math.abs(p[1] - (q0[1] - 4)) < 11; })) { best = q0; break; } }
      tx(best[0], best[1] + 4, k, { 'font-size': fs, fill: '#4a3f30', 'text-anchor': 'middle' }); }
    for (var g = 10; g < 100; g += 10) { var a1 = Pt(100 - g, g), b1 = Pt(0, g); tx(a1[0] - 8, a1[1] + 4, String(g), { 'font-size': 10.5, fill: MUT, 'text-anchor': 'end' }); var s1 = Pt(g, 0); tx(s1[0], s1[1] + 18, String(g), { 'font-size': 10.5, fill: MUT, 'text-anchor': 'middle' }); var si = Pt(0, 100 - g); tx(si[0] + 8, si[1] + 4, String(g), { 'font-size': 10.5, fill: MUT }); }
    tx(150, 290, 'Clay (%)', { 'font-weight': 700, 'text-anchor': 'middle', transform: 'rotate(-60 150 290)' }); tx(540, 290, 'Silt (%)', { 'font-weight': 700, 'text-anchor': 'middle', transform: 'rotate(60 540 290)' }); tx(340, 586, 'Sand (%)', { 'font-weight': 700, 'text-anchor': 'middle' });
    var pal = ['#03045E', '#0077B6', '#00B4D8', '#E76F51', '#D62828', '#6A040F'], P2 = r.map(function (x) { return isNaN(x.S) ? null : Pt(x.S, x.C); });
    // inset: magnified window of the cluster of points
    var v = P2.filter(Boolean), mx = Math.min.apply(null, v.map(function (q) { return q[0]; })), Mx = Math.max.apply(null, v.map(function (q) { return q[0]; })), my = Math.min.apply(null, v.map(function (q) { return q[1]; })), My = Math.max.apply(null, v.map(function (q) { return q[1]; }));
    var half = Math.max(14, (Mx - mx) / 2 + 10, (My - my) / 2 + 10), cx0 = (mx + Mx) / 2, cy0 = (my + My) / 2, IX = 660, IY = 72, IS = 300, k2 = IS / (2 * half);
    P2.forEach(function (q, j) { if (q) S.circle(q[0], q[1], 2.6, { fill: pal[j], stroke: '#fff', 'stroke-width': .6 }); });
    S.add('rect', { x: cx0 - half, y: cy0 - half, width: 2 * half, height: 2 * half, fill: 'none', stroke: INK, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
    S.line(cx0 + half, cy0 - half, IX, IY, { stroke: MUT, 'stroke-width': .8, 'stroke-dasharray': '3 3' }); S.line(cx0 + half, cy0 + half, IX, IY + IS, { stroke: MUT, 'stroke-width': .8, 'stroke-dasharray': '3 3' });
    var cp = S.add('clipPath', { id: 'triClip' }, null, S.add('defs', {})); S.add('rect', { x: IX, y: IY, width: IS, height: IS }, null, cp);
    var gI = S.add('g', { 'clip-path': 'url(#triClip)' }), toI = function (q) { return [IX + (q[0] - (cx0 - half)) * k2, IY + (q[1] - (cy0 - half)) * k2]; };
    S.add('rect', { x: IX, y: IY, width: IS, height: IS, fill: '#fff' }, null, gI);
    for (k in POLY) { var pp = POLY[k].map(function (q) { return toI(Pt(q[0], q[1])); }); S.poly(pp, { fill: fills[k], stroke: '#6b5b45', 'stroke-width': 1.2 }, gI); }
    for (k in POLY) { var c2 = POLY[k].map(function (q) { return toI(Pt(q[0], q[1])); }), ccx = c2.reduce(function (a, q) { return a + q[0]; }, 0) / c2.length, ccy = c2.reduce(function (a, q) { return a + q[1]; }, 0) / c2.length; if (ccx > IX + 20 && ccx < IX + IS - 20 && ccy > IY + 14 && ccy < IY + IS - 8) S.text(ccx, ccy, k, { 'font-size': 12, fill: '#6b5b45', 'text-anchor': 'middle', 'font-family': PF, direction: 'ltr' }, gI); }
    var used = []; P2.forEach(function (q, j) { if (!q) return; var p = toI(q), lx = p[0] + 10, ly = p[1] + 4; while (used.some(function (u) { return Math.abs(u[0] - lx) < 30 && Math.abs(u[1] - ly) < 13; })) ly += 13; used.push([lx, ly]); S.circle(p[0], p[1], 6, { fill: pal[j], stroke: '#fff', 'stroke-width': 1.5 }, gI); S.text(lx, ly, String(j + 1), { 'font-size': 12, 'font-weight': 800, fill: pal[j], 'font-family': PF, direction: 'ltr' }, gI); });
    S.add('rect', { x: IX, y: IY, width: IS, height: IS, fill: 'none', stroke: INK, 'stroke-width': 1.3 }); tx(IX, IY - 10, 'Enlarged view', { 'font-weight': 700, 'font-size': 12 });
    var LYy = IY + IS + 34; tx(IX, LYy, 'Depth (cm)', { 'font-weight': 800, 'font-size': 12.5 });
    r.forEach(function (x, j) { var col = j % 2, row = Math.floor(j / 2), xx = IX + col * 150, yy = LYy + 22 + row * 22; S.circle(xx + 6, yy - 4, 6, { fill: pal[j] }); tx(xx + 18, yy, (j + 1) + '  ' + DL(x.label) + '  ' + x.tex, { 'font-size': 11 }); });
    var cls = r.map(function (x) { return x.tex; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    $('#sTriCap').innerHTML = (cls.length === 1 ? t('All six depths fall in the ', 'تقع الأعماق الست كلها في صنف ') + '<b>' + nm(cls[0]) + '</b>' + t(' class, so the profile is texturally uniform.', '، فالمقطع متجانس القوام.') : t('The depths fall in ', 'تتوزع الأعماق على ') + cls.length + t(' texture classes: ', ' أصناف قوام: ') + cls.map(function (c) { return '<b>' + nm(c) + '</b>'; }).join(AR_UI ? '، ' : ', ') + '.') + ' ' + t('The enlarged view separates the points, which plot close together because the fractions differ by only a few per cent between depths.', 'تفصل النافذة المكبَّرة النقاط المتقاربة، إذ لا تختلف النسب بين الأعماق إلا ببضع نسب مئوية.');
  }
  function figProp(r) {
    var specs = [['phh2o', 'pH (H₂O)', '#2A9D8F'], ['soc', 'Organic carbon (g/kg)', '#6A994E'], ['bdod', 'Bulk density (g/cm³)', '#9A7631'], ['cec', 'CEC (cmol(+)/kg)', '#7A4F9A'], ['wv0033', 'Water content (vol %)', '#1F6FB2']], mids = r.map(function (x) { return (x.top + x.bot) / 2; }), tr = [];
    specs.forEach(function (s, i) { var ax = i ? 'x' + (i + 1) : 'x', step = function (k) { var xs = [], ys = []; r.forEach(function (x) { xs.push(x[k].mean, x[k].mean); ys.push(x.top, x.bot); }); return [xs, ys]; }, st = step(s[0]);
      tr.push({ x: r.map(function (x) { return x[s[0]].lo; }).concat(r.map(function (x) { return x[s[0]].hi; }).reverse()), y: mids.concat(mids.slice().reverse()), xaxis: ax, yaxis: 'y', fill: 'toself', fillcolor: s[2] + '26', line: { width: 0 }, hoverinfo: 'skip', showlegend: i === 0, name: '90 % prediction interval', legendgroup: 'pi' });
      tr.push({ x: st[0], y: st[1], xaxis: ax, yaxis: 'y', mode: 'lines', line: { color: s[2], width: 2.6 }, name: 'Predicted value', showlegend: i === 0, legendgroup: 'pv', hovertemplate: '%{y} cm: %{x:.2f}<extra>' + s[1] + '</extra>' });
      if (s[0] === 'wv0033') { var w = step('wv1500'); tr.push({ x: w[0], y: w[1], xaxis: ax, yaxis: 'y', mode: 'lines', line: { color: '#D62828', width: 2, dash: 'dash' }, name: 'Wilting point (−1500 kPa)', showlegend: true, hovertemplate: '%{y} cm: %{x:.1f}<extra>−1500 kPa</extra>' }); tr[tr.length - 2].name = 'Field capacity (−33 kPa)'; tr[tr.length - 2].showlegend = true; } });
    SH.plot('sProp', tr, function () { var l = lay({ yaxis: { autorange: 'reversed', range: [200, 0], title: { text: 'Depth (cm)' }, dtick: 25, zeroline: false }, showlegend: true, legend: { orientation: 'h', x: .5, xanchor: 'center', y: -0.2 }, margin: { l: 64, r: 16, t: 16, b: 90 } });
      specs.forEach(function (s, i) { var k = i ? 'xaxis' + (i + 1) : 'xaxis'; l[k] = Object.assign({}, l.xaxis || {}, { title: { text: s[1], font: { size: 12 } }, domain: [i * 0.2 + 0.025, (i + 1) * 0.2 - 0.025], anchor: 'y', zeroline: false, nticks: 5 }); }); return l; }, { filename: 'shandal-soil-properties-depth' });
    var a = r[0], b = r[5], dir = function (u, v, en, ar) { return Math.abs(v - u) / Math.max(Math.abs(u), 1e-6) < 0.08 ? t('stable', 'ثابت') : (v > u ? t('increases', 'يزداد') : t('decreases', 'يتناقص')); };
    $('#sPropCap').innerHTML = t('Organic carbon ', 'الكربون العضوي ') + dir(a.soc.mean, b.soc.mean) + t(' from ', ' من ') + num(a.soc.mean, 1) + t(' to ', ' إلى ') + num(b.soc.mean, 1) + ' g/kg' + t(' with depth, as expected where carbon enters from roots and litter at the surface; bulk density ', ' مع العمق، كما هو متوقع لأن الكربون يدخل من الجذور والبقايا عند السطح؛ والكثافة الظاهرية ') + dir(a.bdod.mean, b.bdod.mean) + t(' (overburden and less organic matter) and pH is ', ' (بفعل الحمل العلوي وقلة المادة العضوية)، ودرجة الحموضة ') + dir(a.phh2o.mean, b.phh2o.mean) + '. ' +
      t('Field capacity minus wilting point gives the water available to plants. The shaded band around each line is the 90 % prediction interval: the true value lies inside it at nine sites out of ten.', 'الفرق بين السعة الحقلية ونقطة الذبول هو الماء المتاح للنبات. والنطاق المظلل حول كل خط هو فترة التنبؤ 90 %: تقع القيمة الحقيقية داخله في تسعة مواقع من كل عشرة.');
  }
  function figWrb(W) {
    var el = $('#fs4'); el.parentElement.hidden = !W; if (!W) return;
    var p = W.p.slice(0, 5).reverse(), col = function (n) { var i = WRB.findIndex(function (x) { return x[0] === n; }); return i > -1 ? WRB[i][2] : '#999'; };
    SH.plot('sWrb', [{ type: 'bar', orientation: 'h', y: p.map(function (q) { return q.n; }), x: p.map(function (q) { return q.p; }), marker: { color: p.map(function (q) { return col(q.n); }), line: { color: INK, width: .8 } }, text: p.map(function (q) { return q.p + ' %'; }), textposition: 'outside', hovertemplate: '%{y}: %{x} %<extra></extra>' }],
      function () { return lay({ margin: { l: 110, r: 50, t: 10, b: 50 }, xaxis: { range: [0, Math.max(60, (W.p[0] || {}).p + 15)], ticksuffix: ' %', title: { text: 'Probability of the Reference Soil Group' } }, yaxis: { automargin: true }, showlegend: false }); }, { filename: 'shandal-wrb' });
    var i = WRB.findIndex(function (x) { return x[0] === W.en; }), dsc = i > -1 ? W.ar.split(':')[1] : '';
    $('#sWrbCap').innerHTML = t('The most probable Reference Soil Group is ', 'المجموعة المرجعية الأكثر احتمالاً هي ') + '<b dir="ltr">' + W.en + '</b>' + (AR_UI && dsc ? ' (' + dsc.trim() + ')' : '') + t(' with ', ' باحتمال ') + num((W.p[0] || {}).p, 0, '%') + '. ' +
      ((W.p[0] || {}).p < 40 ? t('A probability below 40 % means that neighbouring groups are almost as likely; confirm the group by describing diagnostic horizons in a soil pit.', 'الاحتمال دون 40 % يعني أن المجموعات المجاورة محتملة بالدرجة نفسها تقريباً؛ أكّد المجموعة بوصف الآفاق التشخيصية في حفرة تربة.') : t('The classification is well supported by the model.', 'التصنيف مدعوم جيداً من النموذج.'));
  }
  function figProf(r) {
    var pr = last.prof || [], wrap = $('#sProfWrap'); wrap.hidden = !pr.length; if (!pr.length) return;
    var tr = [{ x: [].concat.apply([], r.map(function (x) { return [x.C, x.C]; })), y: [].concat.apply([], r.map(function (x) { return [x.top, x.bot]; })), mode: 'lines', line: { color: '#BC6C25', width: 3 }, name: 'Predicted clay at the point' }];
    var dash = ['solid', 'dot', 'dash', 'dashdot', 'longdash'], cl = ['#1B232B', '#1F6FB2', '#2A9D8F', '#7A4F9A', '#9A7631'];
    pr.forEach(function (p, j) { var ls = p.layers.filter(function (l) { return isFinite(l.clay); }); if (!ls.length) return; tr.push({ x: [].concat.apply([], ls.map(function (l) { return [l.clay, l.clay]; })), y: [].concat.apply([], ls.map(function (l) { return [l.top, l.bot]; })), mode: 'lines', line: { color: cl[j], width: 1.8, dash: dash[j] }, name: p.code + ' (' + SH.fmt(p.d, 1) + ' km' + (p.year ? ', ' + p.year : '') + ')' }); });
    SH.plot('sCmp', tr, function () { return lay({ yaxis: { autorange: 'reversed', title: { text: 'Depth (cm)' }, zeroline: false }, xaxis: { title: { text: 'Clay (%)' }, rangemode: 'tozero' }, legend: { orientation: 'v', x: 1.02, y: 1 }, margin: { l: 64, r: 10, t: 10, b: 50 } }); }, { filename: 'shandal-measured-profiles' });
    $('#sProfTbl').innerHTML = '<thead><tr><th>' + t('Profile', 'المقطع') + '</th><th class="num">' + t('Distance', 'المسافة') + '</th><th>' + t('Year', 'السنة') + '</th><th>WRB</th><th>USDA</th><th>' + t('Layer', 'الطبقة') + '</th><th class="num">' + t('Depth cm', 'العمق سم') + '</th><th class="num">' + t('Clay %', 'طين %') + '</th><th class="num">' + t('Sand %', 'رمل %') + '</th><th class="num">pH</th><th class="num">OC g/kg</th><th class="num">CaCO₃ g/kg</th><th class="num">EC dS/m</th><th class="num">CEC</th></tr></thead><tbody>' +
      pr.map(function (p) { return p.layers.map(function (l, i) { return '<tr>' + (i ? '<td></td><td></td><td></td><td></td><td></td>' : '<td><b>' + SH.esc(p.code) + '</b></td><td class="num">' + SH.fmt(p.d, 1) + ' km</td><td>' + (p.year || '—') + '</td><td>' + SH.esc(p.wrb || '—') + '</td><td>' + SH.esc(p.usda || '—') + '</td>') + '<td>' + SH.esc(l.name) + '</td><td class="num">' + l.top + '–' + l.bot + '</td><td class="num">' + f1(l.clay, 0) + '</td><td class="num">' + f1(l.sand, 0) + '</td><td class="num">' + f1(l.ph, 1) + '</td><td class="num">' + f1(l.oc, 1) + '</td><td class="num">' + f1(l.caco3, 0) + '</td><td class="num">' + f1(l.ec, 1) + '</td><td class="num">' + f1(l.cec, 1) + '</td></tr>'; }).join(''); }).join('') + '</tbody>';
    var p0 = pr[0], l0 = p0.layers[0] || {}, dif = l0.clay - r[0].C;
    $('#sCmpCap').innerHTML = t('The nearest measured profile, ', 'أقرب مقطع مقيس، ') + '<b dir="ltr">' + SH.esc(p0.code) + '</b>' + t(', lies ', '، يقع على بعد ') + '<bdi>' + SH.fmt(p0.d, 1) + ' km</bdi>' + (p0.wrb ? t(' and is classified as ', ' ومصنف ') + '<b dir="ltr">' + SH.esc(p0.wrb) + '</b>' : '') + '. ' +
      (isFinite(dif) ? t('Its topsoil clay differs from the prediction by ', 'يختلف طين تربته السطحية عن القيمة المتنبأ بها بمقدار ') + '<bdi>' + SH.fmt(Math.abs(dif), 0) + '</bdi>' + t(' percentage points', ' نقطة مئوية') + (Math.abs(dif) > 15 ? t(': a large difference that points to short-range variability (for example between levee and basin soils of a floodplain), so local sampling is essential.', ': وهو فرق كبير يدل على تباين محلي قصير المدى (مثل الفرق بين ترب ضفاف الأنهار وترب الأحواض في السهل الفيضي)، لذا يلزم أخذ عينات محلية.') : t(', which supports the predicted texture.', '، ما يدعم القوام المتنبأ به.')) : '') +
      (isFinite(l0.caco3) ? ' ' + t('Measured calcium carbonate of ', 'وكاربونات الكالسيوم المقيسة ') + '<bdi>' + SH.fmt(l0.caco3 / 10, 0) + ' %</bdi>' + (l0.caco3 > 150 ? t(' confirms a strongly calcareous soil.', ' تؤكد أن التربة شديدة الكلسية.') : '.') : '') + (isFinite(l0.ec) && l0.ec > 4 ? ' ' + t('Electrical conductivity above 4 dS/m indicates a saline soil.', 'والإيصالية الكهربائية فوق 4 dS/m تدل على تربة ملحية.') : '');
  }
  function table(r) {
    $('#sTbl').innerHTML = '<thead><tr><th>' + t('Depth (cm)', 'العمق (سم)') + '</th><th>USDA</th><th class="num">' + t('Sand %', 'رمل %') + '</th><th class="num">' + t('Silt %', 'غرين %') + '</th><th class="num">' + t('Clay %', 'طين %') + '</th><th class="num">BD g/cm³</th><th class="num">SOC g/kg</th><th class="num">N g/kg</th><th class="num">pH</th><th class="num">CEC</th><th class="num">' + t('Gravel vol %', 'حصى حجمي %') + '</th><th class="num">θ −33 kPa</th><th class="num">θ −1500 kPa</th><th class="num">Ksat mm/h</th></tr></thead><tbody>' +
      r.map(function (x) { return '<tr><td>' + DL(x.label) + '</td><td>' + nm(x.tex) + '</td><td class="num">' + f1(x.S, 0) + '</td><td class="num">' + f1(100 - x.S - x.C, 0) + '</td><td class="num">' + f1(x.C, 0) + '</td><td class="num">' + f1(x.bdod.mean, 2) + '</td><td class="num">' + f1(x.soc.mean) + '</td><td class="num">' + f1(x.nitrogen.mean, 2) + '</td><td class="num">' + f1(x.phh2o.mean) + '</td><td class="num">' + f1(x.cec.mean) + '</td><td class="num">' + f1(x.cfvo.mean, 0) + '</td><td class="num">' + f1(x.wv0033.mean, 1) + '</td><td class="num">' + f1(x.wv1500.mean, 1) + '</td><td class="num">' + f1(x.h.ks, 1) + '</td></tr>'; }).join('') + '</tbody>';
  }
  function interp(r, paw, W) {
    var top = r[0], sub = r[3], f = function (v, d) { return '<span class="ltr">' + (isNaN(v) ? '—' : SH.fmt(v, d)) + '</span>'; }, Pp = [];
    var clayT = top.C, sandT = top.S, ph = top.phh2o.mean, soc = top.soc.mean, bd = top.bdod.mean, cec = top.cec.mean, cf = top.cfvo.mean, dClay = sub.C - top.C;
    if (W) Pp.push(t('<b>Soil group.</b> ', '<b>مجموعة التربة.</b> ') + t('The soil is most probably a ', 'التربة على الأرجح من مجموعة ') + '<b dir="ltr">' + W.en + '</b>' + (AR_UI ? ' (' + W.ar.split(':')[1].trim() + ')' : '') + '.');
    Pp.push(t('<b>Texture.</b> The topsoil is ', '<b>القوام.</b> التربة السطحية ') + '<b>' + nm(top.tex) + '</b>' + t(' with ', ' بنسبة طين ') + f(clayT, 0) + ' %' + t(' clay and ', ' ورمل ') + f(sandT, 0) + ' %' + t(' sand. ', '. ') +
      (clayT >= 35 ? t('Clay-rich soil drains slowly, holds water and nutrients well, swells when wet and cracks when dry.', 'التربة الغنية بالطين تصرّف الماء ببطء وتحتفظ بالماء والعناصر جيداً، وتنتفخ عند الترطيب وتتشقق عند الجفاف.') : sandT >= 65 ? t('Sandy soil drains fast, stores little water and is prone to wind erosion.', 'التربة الرملية سريعة التصريف قليلة الخزن للماء ومعرضة للتعرية الريحية.') : t('This balanced texture combines reasonable drainage with good water retention.', 'هذا القوام المتوازن يجمع بين تصريف معقول واحتفاظ جيد بالماء.')) +
      (Math.abs(dClay) >= 8 ? ' ' + (dClay > 0 ? t('Clay increases by ', 'يزداد الطين بمقدار ') + f(dClay, 0) + t(' points in the subsoil.', ' نقطة في التربة تحت السطحية.') : t('Clay decreases by ', 'يتناقص الطين بمقدار ') + f(-dClay, 0) + t(' points in the subsoil.', ' نقطة في التربة تحت السطحية.')) : ''));
    Pp.push(t('<b>Chemistry.</b> ', '<b>الكيمياء.</b> ') + 'pH ' + f(ph, 1) + ': ' + (ph > 8.5 ? t('strongly alkaline; exchangeable sodium may be high — test ESP and SAR before irrigation.', 'قاعدية قوية؛ قد يكون الصوديوم المتبادل مرتفعاً — افحص ESP وSAR قبل الري.') : ph > 7.3 ? t('alkaline, typical of calcareous and gypsiferous soils of dry regions; phosphorus, iron and zinc are less available.', 'قاعدية، وهذا نموذجي للترب الكلسية والجبسية في المناطق الجافة؛ تقل جاهزية الفسفور والحديد والزنك.') : ph < 5.5 ? t('acidic; aluminium toxicity and low base saturation are likely.', 'حامضية؛ يُحتمل تسمم بالألمنيوم وانخفاض التشبع القاعدي.') : t('near neutral, favourable for most crops.', 'قريبة من التعادل، ملائمة لمعظم المحاصيل.')) + ' ' +
      t('Organic carbon ', 'الكربون العضوي ') + f(soc, 1) + ' g/kg ' + (soc < 6 ? t('is low.', 'منخفض.') : soc < 15 ? t('is moderate.', 'متوسط.') : t('is high.', 'مرتفع.')) + ' ' + t('CEC ', 'السعة التبادلية الكاتيونية ') + f(cec, 1) + ' cmol(+)/kg ' + (cec < 10 ? t('indicates a low nutrient-holding capacity.', 'تدل على قدرة منخفضة على الاحتفاظ بالعناصر.') : cec < 25 ? t('indicates a moderate nutrient-holding capacity.', 'تدل على قدرة متوسطة على الاحتفاظ بالعناصر.') : t('indicates a high nutrient-holding capacity.', 'تدل على قدرة عالية على الاحتفاظ بالعناصر.')));
    Pp.push(t('<b>Physical and engineering notes.</b> Bulk density ', '<b>ملاحظات فيزيائية وهندسية.</b> الكثافة الظاهرية ') + f(bd, 2) + ' g/cm³ ' + (bd > 1.6 ? t('indicates compaction that restricts roots.', 'تدل على انضغاط يقيد الجذور.') : bd < 1.1 ? t('is low (loose or organic soil).', 'منخفضة (تربة مفككة أو عضوية).') : t('is within the normal range.', 'ضمن المدى الطبيعي.')) +
      (isFinite(cf) && cf > 15 ? ' ' + t('Coarse fragments occupy ', 'تشغل القطع الخشنة ') + f(cf, 0) + t(' % of the volume.', ' % من الحجم.') : '') + ' ' + t('The profile stores about ', 'يخزن المقطع نحو ') + f(paw, 0) + ' mm ' + t('of plant-available water to 2 m. ', 'من الماء المتاح للنبات حتى 2 م. ') +
      (sub.C >= 35 ? t('High subsoil clay suggests moderate to high shrink–swell potential: confirm with Atterberg limits and free-swell tests before founding light structures.', 'ارتفاع الطين تحت السطحي يشير إلى احتمال انتفاخ وانكماش متوسط إلى عالٍ: أكّده بحدود أتربرغ وفحص الانتفاخ الحر قبل تأسيس المنشآت الخفيفة.') : t('Subsoil clay suggests a low to moderate shrink–swell potential.', 'نسبة الطين تحت السطحية تشير إلى احتمال انتفاخ وانكماش منخفض إلى متوسط.')));
    Pp.push('<span class="xsmall muted">' + t('Predicted values at 250 m describe the typical soil of the cell, not a sample; confirm with sampling and laboratory tests on site.', 'القيم المتنبأ بها بدقة 250 م تصف التربة النموذجية للخلية لا عينة بعينها؛ أكّدها بأخذ العينات والفحوص المختبرية في الموقع.') + '</span>');
    $('#sInterp').innerHTML = Pp.map(function (x) { return '<p style="margin:0 0 10px;line-height:1.9">' + x + '</p>'; }).join('');
  }

  /* ---------- maps of the study area */
  function niceStep(r, n) { var raw = r / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function rampCol(stops, f) { var x = f * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), u = x - i, h = function (s) { return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; }, a = h(stops[i]), b = h(stops[i + 1]); return a.map(function (v, k) { return Math.round(v + (b[k] - v) * u); }); }
  function dms(v, ax) { var a = Math.abs(v), d = Math.floor(a + 1e-9), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m + '′' + (ax === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); }
  function maps() {
    var host = $('#sMaps'), L0 = last.layers, b = last.b, d = last.depth, run0 = last; host.innerHTML = ''; last.maps = {};
    last.baseP = null; if (!L0.length) return Promise.resolve();
    var prog = document.createElement('div'); prog.className = 'pn'; prog.innerHTML = '<div class="pn-b" style="display:flex;align-items:center;gap:12px"><span class="spin" aria-hidden="true" style="width:18px;height:18px;border:2.5px solid var(--line);border-top-color:var(--gold-500,#B08A3E);border-radius:50%;animation:shSpin .9s linear infinite;flex:none"></span><span class="small" id="sMapProg"></span></div>'; host.appendChild(prog);
    var nDone = 0, nFail = [], upd = function () { $('#sMapProg').textContent = t('Preparing the maps of the study area: ', 'جارٍ إعداد خرائط منطقة الدراسة: ') + nDone + ' / ' + L0.length + t(' ready', ' جاهزة'); }; upd();
    var cells = Math.max((b.e - b.w), (b.n - b.s)) / 0.0020833, sf = cells > 640 ? Math.max(0.2, 640 / cells) : 1, conc = cells <= 160 ? 6 : cells <= 400 ? 3 : 2;
    var get = function (k, tries) { var ac = new AbortController(), tm = setTimeout(function () { ac.abort(); }, 90000);
      return fetch(wcs(k, d, b) + (sf < 1 ? '&SCALEFACTOR=' + sf.toFixed(3) : ''), { signal: ac.signal }).then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error('WCS ' + r.status); return r.arrayBuffer(); })
        .catch(function (e) { clearTimeout(tm); if (tries > 0) return new Promise(function (r) { setTimeout(r, 2000); }).then(function () { return get(k, tries - 1); }); throw e; }); };
    var slots = {}; L0.forEach(function (k) { slots[k] = document.createElement('div'); host.appendChild(slots[k]); });
    var queue = L0.slice(), worker = function () { var k = queue.shift(); if (!k || last !== run0) return Promise.resolve();
      return get(k, 2).then(function (buf) { last.maps[k] = { buf: buf }; return tiff(buf.slice(0)); }).then(function (G) { return new Promise(function (r) { setTimeout(r, 20); }).then(function () {
          var id = 'smap_' + k, box = slots[k]; box.setAttribute('data-rp-page', 'm' + k);
          box.innerHTML = '<section class="fig" id="fm_' + k + '"><div class="fig-h"><span class="n"></span><h3>' + (AR_UI ? LY[k][1] : LY[k][0]) + (k === 'wrb' || k === 'ocs' ? '' : ' · <bdi>' + DL(d) + '</bdi>') + '</h3><div class="sp no-print">' + ['png', 'jpg', 'pdf'].map(function (f) { return '<button class="btn btn-line btn-xs" data-mx="' + k + '" data-f="' + f + '" type="button">' + f.toUpperCase() + '</button>'; }).join('') + '<button class="btn btn-line btn-xs" data-tif="' + k + '" type="button">GeoTIFF</button></div></div><div class="fig-b" style="overflow:auto"><svg class="chart" id="' + id + '" viewBox="0 0 1000 700" style="min-width:620px"></svg></div><div class="fig-cap" id="' + id + 'Cap"></div></section>';
          last.maps[k].G = G; return drawMap(k, G); }); })
        .then(function () { nDone++; }, function () { nFail.push(k); if (slots[k]) slots[k].remove(); delete last.maps[k]; })
        .then(function () { upd(); return worker(); }); };
    var ws = []; for (var c = 0; c < Math.min(conc, L0.length); c++) ws.push(worker());
    var chain = Promise.all(ws).then(function () { if (last !== run0) return;
      var n = 6; SH.$$('#sMaps .fig .n').forEach(function (e) { e.textContent = n++; });
      if (nFail.length) { prog.innerHTML = '<div class="pn-b small muted">' + t('These layers could not be obtained from the international soil-map service at this time and were left out: ', 'تعذر الحصول على هذه الطبقات من خدمة خرائط التربة الدولية حالياً فلم تُرسم: ') + '<b dir="ltr">' + nFail.map(function (k) { return LY[k][0]; }).join(', ') + '</b>. ' + t('Run the analysis again later to add them.', 'أعد إصدار التحليل لاحقاً لإضافتها.') + '</div>'; }
      else prog.remove(); });
    return chain;
  }
  var LOGO = null; function logo64() { return LOGO || (LOGO = fetch(SH.base + 'assets/img/emblem-64.png').then(function (r) { return r.blob(); }).then(function (bl) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(bl); }); }).catch(function () { return null; })); }
  function baseMap(b, cw, ch) {
    var key = [b.w, b.e, b.s, b.n, cw, ch].join(); if (last.baseP && last.baseKey === key) return last.baseP; last.baseKey = key;
    var z = Math.max(2, Math.min(16, Math.round(Math.log2(360 * cw / (256 * (b.e - b.w)))))), n = Math.pow(2, z), X = function (lo) { return (lo + 180) / 360 * n; }, Y = function (la) { var r = SH.rad(la); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n; }, LA = function (yy) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI; };
    var x0 = Math.floor(X(b.w)), x1 = Math.floor(X(b.e)), y0 = Math.floor(Y(b.n)), y1 = Math.floor(Y(b.s)); if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return (last.baseP = Promise.resolve(null));
    var mk = function (svc) { var c = document.createElement('canvas'); c.width = cw; c.height = ch; var g = c.getContext('2d'), jobs = []; if (svc.indexOf('Base') > -1) { g.fillStyle = '#EDEDEA'; g.fillRect(0, 0, cw, ch); }
      for (var tx0 = x0; tx0 <= x1; tx0++) for (var ty = y0; ty <= y1; ty++) (function (tx1, ty1) { jobs.push(new Promise(function (res) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { var l0 = tx1 / n * 360 - 180, l1 = (tx1 + 1) / n * 360 - 180, qx = function (l) { return (l - b.w) / (b.e - b.w) * cw; }, qy = function (a) { return (b.n - a) / (b.n - b.s) * ch; }; for (var r = 0; r < 16; r++) { var Y0p = qy(LA(ty1 + r / 16)), Y1p = qy(LA(ty1 + (r + 1) / 16)); g.drawImage(im, 0, r * 16, 256, 16, qx(l0), Y0p, qx(l1) - qx(l0), Y1p - Y0p + .5); } res(); }; im.onerror = function () { res(); }; im.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/' + svc + '/MapServer/tile/' + z + '/' + ty1 + '/' + tx1; })); })(tx0, ty);
      return Promise.all(jobs).then(function () { return c; }); };
    return (last.baseP = Promise.all([mk('World_Light_Gray_Base'), mk('World_Light_Gray_Reference')]).then(function (a) { try { a[0].toDataURL(); } catch (e) { return null; } return { base: a[0], ref: a[1] }; }).catch(function () { return null; }));
  }
  function drawMap(k, G) {
    var S = SH.svgB('smap_' + k), W = 1000, b = last.b, isW = k === 'wrb', div = DIV[k] || 1, lat0 = (b.n + b.s) / 2, kx = Math.cos(SH.rad(lat0));
    var asp = ((b.e - b.w) * kx) / (b.n - b.s), PW = asp >= 1 ? 640 : 640 * asp, PH = asp >= 1 ? 640 / asp : 640; if (PH > 640) { PW *= 640 / PH; PH = 640; }
    var X0 = 86, Y0 = 70, VH = Y0 + PH + 90, LX = X0 + Math.max(PW, 420) + 50; S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + Math.max(VH, 560)); VH = Math.max(VH, 560);
    var tx = function (x, y, s, a) { return S.text(x, y, s, Object.assign({ fill: INK, 'font-size': 13, direction: 'ltr', 'font-family': PF }, a || {})); };
    S.add('rect', { x: 0, y: 0, width: W, height: VH, fill: '#fff' });
    var title = SH.val('sTitle').trim(); tx(W / 2, 32, (title ? title + ' — ' : '') + LY[k][0] + (isW || k === 'ocs' ? '' : ' (' + DL(last.depth) + ')'), { 'font-size': 18, 'font-weight': 800, 'text-anchor': 'middle' });
    // values: zero fill and WRB no-data are not predicted
    var zeroOk = k === 'cfvo'; for (var i0 = 0; i0 < G.data.length; i0++) if (!isW && !zeroOk && G.data[i0] === 0) G.data[i0] = NaN; else if (isW && G.data[i0] === 255) G.data[i0] = NaN;
    var gx0 = Math.max(0, Math.floor((b.w - G.x0) / G.dx)), gx1 = Math.min(G.W, Math.ceil((b.e - G.x0) / G.dx)), gy0 = Math.max(0, Math.floor((G.y0 - b.n) / G.dy)), gy1 = Math.min(G.H, Math.ceil((G.y0 - b.s) / G.dy));
    var vals = []; for (var y = gy0; y < gy1; y++) for (var x = gx0; x < gx1; x++) { var v0 = G.data[y * G.W + x]; if (isFinite(v0)) vals.push(isW ? v0 : v0 / div); }
    var present = [], lo, hi, st;
    if (isW) { var cnt = {}; vals.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; }); present = Object.keys(cnt).map(Number).filter(function (v) { return WRB[v] && cnt[v] / vals.length >= 0.005; }).sort(function (a, c) { return cnt[c] - cnt[a]; }); last.maps[k].cnt = cnt; last.maps[k].n = vals.length; }
    else if (vals.length) { var sv = vals.slice().sort(function (a, c) { return a - c; }); lo = sv[Math.floor(sv.length * .02)]; hi = sv[Math.floor(sv.length * .98)]; if (hi - lo < 1e-9) hi = lo + 1; st = niceStep(hi - lo, 5); last.maps[k].stats = { mean: vals.reduce(function (a, v) { return a + v; }, 0) / vals.length, lo: sv[0], hi: sv[sv.length - 1], p10: sv[Math.floor(sv.length * .1)], p90: sv[Math.floor(sv.length * .9)], n: vals.length }; }
    // continuous surface: light smoothing of the 250 m grid, then bilinear interpolation to the page resolution
    var Gs = G.data; if (!isW) { Gs = new Float64Array(G.W * G.H); for (y = 0; y < G.H; y++) for (x = 0; x < G.W; x++) { var c0 = G.data[y * G.W + x]; if (!isFinite(c0)) { Gs[y * G.W + x] = NaN; continue; } var sw = 0, sa = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= G.H || xx >= G.W) continue; var q = G.data[yy * G.W + xx]; if (!isFinite(q)) continue; var wq = (dx ? 1 : 2) * (dy ? 1 : 2); sw += wq; sa += wq * q; } Gs[y * G.W + x] = sa / sw; } }
    var SC = 1.6, cw = Math.round(PW * SC), ch = Math.round(PH * SC), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; var cx = cv.getContext('2d'), img = cx.createImageData(cw, ch), D = img.data, lut = [], stops = isW ? null : RAMP[LY[k][3]], nodata = 0, GW = G.W, GH = G.H, inv = 1 / div;
    if (!isW) for (var li = 0; li < 256; li++) lut.push(rampCol(stops, li / 255));
    var wc = WRB.map(function (e) { return e ? [parseInt(e[2].slice(1, 3), 16), parseInt(e[2].slice(3, 5), 16), parseInt(e[2].slice(5, 7), 16)] : null; }), cv4 = [0, 0, 0, 0], cw4 = [0, 0, 0, 0], span = hi - lo;
    var xs = new Float64Array(cw); for (var i = 0; i < cw; i++) xs[i] = (b.w + (i + .5) / cw * (b.e - b.w) - G.x0) / G.dx - .5;
    for (var j = 0; j < ch; j++) { var fy = (G.y0 - (b.n - (j + .5) / ch * (b.n - b.s))) / G.dy - .5, y0i = Math.floor(fy), uy = fy - y0i;
      for (i = 0; i < cw; i++) { var fx = xs[i], x0i = Math.floor(fx), ux = fx - x0i, o = (j * cw + i) * 4, wsum = 0, acc = 0, nc = 0;
        for (var n4 = 0; n4 < 4; n4++) { var xi = x0i + (n4 & 1), yi = y0i + (n4 >> 1); if (xi < 0 || yi < 0 || xi >= GW || yi >= GH) continue; var g = Gs[yi * GW + xi]; if (g !== g) continue; var wt = ((n4 & 1) ? ux : 1 - ux) * ((n4 >> 1) ? uy : 1 - uy); wsum += wt;
          if (isW) { var m2 = 0; while (m2 < nc && cv4[m2] !== g) m2++; if (m2 === nc) { cv4[nc] = g; cw4[nc] = 0; nc++; } cw4[m2] += wt; } else acc += wt * g; }
        if (wsum < .5) { nodata++; continue; }
        var c;
        if (isW) { var bi = 0; for (var q2 = 1; q2 < nc; q2++) if (cw4[q2] > cw4[bi]) bi = q2; c = wc[cv4[bi]] || [200, 200, 200]; }
        else { var f = (acc / wsum * inv - lo) / span; c = lut[f <= 0 ? 0 : f >= 1 ? 255 : Math.round(f * 255)]; }
        D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255; } }
    cx.putImageData(img, 0, 0);
    var px = function (lo) { return X0 + (lo - b.w) / (b.e - b.w) * PW; }, py = function (la) { return Y0 + (b.n - la) / (b.n - b.s) * PH; };
    var imgEl = S.add('image', { x: X0, y: Y0, width: PW, height: PH, preserveAspectRatio: 'none' });
    var done = baseMap(b, cw, ch).then(function (B) { if (!B) { imgEl.setAttribute('href', cv.toDataURL('image/png')); return; } var out = document.createElement('canvas'); out.width = cw; out.height = ch; var o2 = out.getContext('2d'); o2.drawImage(B.base, 0, 0); o2.globalAlpha = .74; o2.drawImage(cv, 0, 0); o2.globalAlpha = 1; o2.drawImage(B.ref, 0, 0); imgEl.setAttribute('href', out.toDataURL('image/jpeg', .9)); });
    // point and measured profiles
    (last.prof || []).forEach(function (p) { if (p.lat < b.s || p.lat > b.n || p.lon < b.w || p.lon > b.e) return; S.add('rect', { x: px(p.lon) - 4.5, y: py(p.lat) - 4.5, width: 9, height: 9, fill: '#fff', stroke: INK, 'stroke-width': 1.6 }); });
    var sx = px(last.lon), sy = py(last.lat); S.path('M' + sx + ' ' + (sy - 9) + 'L' + (sx + 8) + ' ' + (sy + 6) + 'L' + (sx - 8) + ' ' + (sy + 6) + 'Z', { fill: '#C0392B', stroke: '#fff', 'stroke-width': 1.5 });
    // frame and graticule
    S.add('rect', { x: X0, y: Y0, width: PW, height: PH, fill: 'none', stroke: INK, 'stroke-width': 1.6 }); S.add('rect', { x: X0 - 6, y: Y0 - 6, width: PW + 12, height: PH + 12, fill: 'none', stroke: INK, 'stroke-width': .8 });
    var gs = [1 / 60, 2 / 60, 5 / 60, 10 / 60, .25, .5, 1, 2], st2 = gs.filter(function (g) { return (b.e - b.w) / g <= 5; })[0] || 2;
    for (var lo2 = Math.ceil(b.w / st2) * st2; lo2 <= b.e + 1e-9; lo2 += st2) { var X = px(lo2); if (X < X0 + 3 || X > X0 + PW - 3) continue; S.line(X, Y0 - 6, X, Y0 + 6, { stroke: INK }); S.line(X, Y0 + PH - 6, X, Y0 + PH + 6, { stroke: INK }); tx(X, Y0 + PH + 24, dms(lo2, 'lon'), { 'font-size': 11.5, 'text-anchor': 'middle' }); }
    for (var la2 = Math.ceil(b.s / st2) * st2; la2 <= b.n + 1e-9; la2 += st2) { var Y = py(la2); if (Y < Y0 + 3 || Y > Y0 + PH - 3) continue; S.line(X0 - 6, Y, X0 + 6, Y, { stroke: INK }); S.line(X0 + PW - 6, Y, X0 + PW + 6, Y, { stroke: INK }); tx(X0 - 12, Y + 4, dms(la2, 'lat'), { 'font-size': 11.5, 'text-anchor': 'end' }); }
    // side panel: north arrow, scale, legend
    var ny = Y0 + 10; S.path('M' + (LX + 20) + ' ' + ny + 'l-11 34l11 -8z', { fill: INK }); S.path('M' + (LX + 20) + ' ' + ny + 'l11 34l-11 -8z', { fill: '#fff', stroke: INK, 'stroke-width': 1.2 }); tx(LX + 20, ny - 6, 'N', { 'font-size': 15, 'font-weight': 800, 'text-anchor': 'middle' });
    var kmPx = (b.e - b.w) * 111.32 * kx / PW, want = kmPx * 160, p10 = Math.pow(10, Math.floor(Math.log10(want))), m = want / p10, len = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p10, spx = len / kmPx, sx0 = X0 + PW - spx - 22, sy0 = Y0 + PH + 46;
    for (i = 0; i < 4; i++) S.add('rect', { x: sx0 + i * spx / 4, y: sy0, width: spx / 4, height: 7, fill: i % 2 ? '#fff' : INK }); S.add('rect', { x: sx0, y: sy0, width: spx, height: 7, fill: 'none', stroke: INK, 'stroke-width': .9 });
    var fl = function (v) { return v >= 1 ? SH.fmt(v, v % 1 ? 1 : 0) : SH.fmt(v, 2); }; tx(sx0, sy0 - 6, '0', { 'font-size': 11.5, 'text-anchor': 'middle' }); tx(sx0 + spx / 2, sy0 - 6, fl(len / 2), { 'font-size': 11.5, 'text-anchor': 'middle' }); tx(sx0 + spx, sy0 - 6, fl(len) + ' km', { 'font-size': 11.5, 'font-weight': 700, 'text-anchor': 'middle' });
    var ly2 = ny + 66; tx(LX, ly2, 'LEGEND', { 'font-size': 13, 'font-weight': 800, 'letter-spacing': 1 }); tx(LX, ly2 + 20, isW ? 'Reference Soil Group' : LY[k][0] + ' (' + LY[k][2] + ')', { 'font-size': 11.5, fill: MUT }); ly2 += 36;
    if (isW) present.slice(0, 12).forEach(function (v) { S.add('rect', { x: LX, y: ly2, width: 30, height: 18, fill: WRB[v][2], stroke: INK, 'stroke-width': .7 }); tx(LX + 40, ly2 + 14, WRB[v][0] + '  ' + SH.fmt(100 * last.maps[k].cnt[v] / last.maps[k].n, 0) + ' %', { 'font-size': 12 }); ly2 += 24; });
    else if (stops) { var BH = 200, BW = 24, by = ly2 + 4, gid = 'mg_' + k, gr = S.add('linearGradient', { id: gid, x1: 0, y1: 1, x2: 0, y2: 0 }, null, S.add('defs', {})); stops.forEach(function (c2, q) { S.add('stop', { offset: q / (stops.length - 1), 'stop-color': c2, 'stop-opacity': .74 }, null, gr); });
      S.add('rect', { x: LX, y: by, width: BW, height: BH, fill: 'url(#' + gid + ')', stroke: INK, 'stroke-width': .8 }); var dd = Math.max(0, -Math.floor(Math.log10(st) + 1e-9)); if (Math.abs(st * Math.pow(10, dd) - Math.round(st * Math.pow(10, dd))) > 1e-9) dd++;
      for (var tv = Math.ceil(lo / st - 1e-9) * st; tv <= hi + 1e-9; tv += st) { var ty = by + BH - (tv - lo) / (hi - lo) * BH; S.line(LX + BW, ty, LX + BW + 6, ty, { stroke: INK }); tx(LX + BW + 11, ty + 4, tv.toFixed(dd), { 'font-size': 12 }); }
      ly2 = by + BH + 18; }
    ly2 += 6; S.add('rect', { x: LX, y: ly2, width: 30, height: 18, fill: '#EDEDEA', stroke: INK, 'stroke-width': .7 }); tx(LX + 40, ly2 + 10, 'No prediction: built-up land', { 'font-size': 12 }); tx(LX + 40, ly2 + 25, 'or water (base map shown)', { 'font-size': 12 }); ly2 += 36;
    S.path('M' + (LX + 15) + ' ' + (ly2 + 1) + 'l8 14h-16z', { fill: '#C0392B', stroke: '#fff', 'stroke-width': 1 }); tx(LX + 40, ly2 + 14, 'Selected point', { 'font-size': 12 }); ly2 += 24;
    if ((last.prof || []).length) { S.add('rect', { x: LX + 10, y: ly2 + 3, width: 10, height: 10, fill: '#fff', stroke: INK, 'stroke-width': 1.5 }); tx(LX + 40, ly2 + 14, 'Measured soil profile', { 'font-size': 12 }); ly2 += 24; }
    var crW = 262, crH = 30, crX = X0 + 8, crY = Y0 + PH - crH - 8; S.add('rect', { x: crX, y: crY, width: crW, height: crH, rx: 4, fill: '#fff', 'fill-opacity': .9, stroke: '#B08A3E', 'stroke-width': .8 }); var lg = S.add('image', { x: crX + 5, y: crY + 3, width: 24, height: 24 }); logo64().then(function (u) { if (u) lg.setAttribute('href', u); }); tx(crX + 35, crY + 14, '© Shandal Geological Field Survey System', { 'font-size': 10.5, 'font-weight': 800 }); tx(crX + 35, crY + 25, 'geologicalfieldsurvey.com', { 'font-size': 9, fill: MUT });
    tx(LX, VH - 46, 'Geographic coordinates, WGS 84', { 'font-size': 11, fill: MUT }); tx(LX, VH - 30, 'SoilGrids, ' + (Math.round(G.dy * 111320 / 50) * 50) + ' m grid, interpolated', { 'font-size': 11, fill: MUT });
    S.add('rect', { x: 6, y: 6, width: W - 12, height: VH - 12, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    // caption
    var cap = $('#smap_' + k + 'Cap'), msk = nodata / (cw * ch);
    if (isW) { var tp = present.slice(0, 3).map(function (v) { return '<b dir="ltr">' + WRB[v][0] + '</b> (' + SH.fmt(100 * last.maps[k].cnt[v] / last.maps[k].n, 0) + ' %)'; }); cap.innerHTML = t('The study area is dominated by ', 'تسود منطقة الدراسة ') + tp.join(AR_UI ? '، ' : ', ') + '. ' + (present[0] != null && AR_UI ? WRB[present[0]][1] + '. ' : '') + t('Boundaries between groups are transitional at 250 m; the map shows the most probable group of each cell.', 'الحدود بين المجموعات انتقالية عند دقة 250 م، والخريطة تبين المجموعة الأكثر احتمالاً لكل خلية.'); }
    else { var s = last.maps[k].stats, u = LY[k][2]; cap.innerHTML = t('Across the study area the ', 'في منطقة الدراسة يتراوح ') + (AR_UI ? LY[k][1] : LY[k][0].toLowerCase()) + t(' ranges from ', ' بين ') + '<bdi>' + fl(s.p10) + '</bdi>' + t(' to ', ' و') + '<bdi>' + fl(s.p90) + ' ' + u + '</bdi>' + t(' (10th–90th percentile), with a mean of ', ' (المئين العاشر إلى التسعين)، بمتوسط ') + '<bdi>' + fl(s.mean) + ' ' + u + '</bdi>' + '. ' + t('Colours change continuously across this range; lighter tones are low values and darker tones high values.', 'تتدرج الألوان تدرجاً مستمراً ضمن هذا المدى؛ الدرجات الفاتحة للقيم المنخفضة والداكنة للقيم المرتفعة.'); }
    if (msk > 0.02) cap.innerHTML += ' ' + t('Uncoloured parts (', 'الأجزاء غير الملوّنة (') + '<bdi>' + SH.fmt(msk * 100, 0) + ' %</bdi>' + t(' of the area) are built-up land or water, where soil is not predicted; the base map is shown there.', ' من المساحة) أراضٍ مبنية أو مياه لا يُتنبأ فيها بالتربة، وتظهر فيها خريطة الأساس.');
    return done;
  }

  /* ---------- exports */
  function plotCanvas(id) { var gd = $('#' + id); EXP = true; var fig = { data: gd.data, layout: Object.assign({}, gd.layout, { paper_bgcolor: '#fff', plot_bgcolor: '#fff', font: { family: PF, color: INK, size: 13 } }) }; EXP = false; var w = Math.max(gd.offsetWidth, 900), h = Math.max(gd.offsetHeight, 420);
    return P.toImage(fig, { format: 'png', width: w, height: h, scale: 2 }).then(SH.loadImage).then(function (im) { var c = document.createElement('canvas'); c.width = im.width; c.height = im.height; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0); return c; }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-px],[data-sx],[data-mx],[data-tif]'); if (!b || !last) return; var f = b.getAttribute('data-f'), tag = last.lat.toFixed(3) + '_' + last.lon.toFixed(3), lbl = b.innerHTML, done = function () { b.disabled = false; b.innerHTML = lbl; b.removeAttribute('aria-busy'); }; b.disabled = true; b.setAttribute('aria-busy', 'true'); b.innerHTML = '<span aria-hidden="true" style="display:inline-block;width:11px;height:11px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:shSpin .8s linear infinite;vertical-align:-1px;margin-inline-end:5px"></span>' + t('Preparing…', 'جارٍ التجهيز…'); SH.toast(t('Preparing the file for download…', 'جارٍ تجهيز الملف للتنزيل…'));
    if (b.hasAttribute('data-tif')) { var k = b.getAttribute('data-tif'), m = last.maps[k]; if (m && m.buf) SH.download('shandal-' + k + '_' + (k === 'wrb' ? 'MostProbable' : last.depth) + '_' + tag + '.tif', new Blob([m.buf], { type: 'image/tiff' })); setTimeout(done, 600); return; }
    var p = b.hasAttribute('data-px') ? plotCanvas(b.getAttribute('data-px')).then(function (c) { return SH.exportCanvas(c, 'shandal-' + b.getAttribute('data-px') + '_' + tag, f); })
      : SH.exportFigure($('#' + (b.getAttribute('data-sx') || 'smap_' + b.getAttribute('data-mx'))), 'shandal-' + (b.getAttribute('data-sx') || b.getAttribute('data-mx')) + '_' + tag, f);
    p.catch(function () { SH.toast(t('The image could not be created.', 'تعذر إنشاء الصورة.'), 'warn'); }).then(done);
  });
  $('#sCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-soil-profile-' + last.lat.toFixed(4) + '_' + last.lon.toFixed(4) + '.csv', [['depth_cm', 'usda_texture', 'sand_pct', 'silt_pct', 'clay_pct', 'bdod_g_cm3', 'soc_g_kg', 'nitrogen_g_kg', 'ph_h2o', 'cec_cmol_kg', 'cfvo_vol_pct', 'ocd_kg_m3', 'theta_10kpa_vol_pct', 'theta_33kpa_vol_pct', 'theta_1500kpa_vol_pct', 'ksat_mm_h']].concat(last.rows.map(function (x) { return [x.label, x.tex, x.S.toFixed(1), (100 - x.S - x.C).toFixed(1), x.C.toFixed(1), x.bdod.mean, x.soc.mean, x.nitrogen.mean, x.phh2o.mean, x.cec.mean, x.cfvo.mean, x.ocd.mean, x.wv0010.mean, x.wv0033.mean, x.wv1500.mean, x.h.ks.toFixed(2)]; }))); });
  $('#sProfCsv').addEventListener('click', function () { if (!last || !last.prof.length) return; var rows = [['profile', 'distance_km', 'lat', 'lon', 'year', 'wrb', 'usda', 'layer', 'top_cm', 'bottom_cm', 'clay_pct', 'sand_pct', 'silt_pct', 'ph_h2o', 'oc_g_kg', 'caco3_g_kg', 'ec_dS_m', 'cec_cmol_kg']]; last.prof.forEach(function (p) { p.layers.forEach(function (l) { rows.push([p.code, p.d.toFixed(2), p.lat, p.lon, p.year, p.wrb, p.usda, l.name, l.top, l.bot, l.clay, l.sand, l.silt, l.ph, l.oc, l.caco3, l.ec, l.cec]); }); }); SH.csv('shandal-measured-soil-profiles.csv', rows); });
  $('#sRun').addEventListener('click', run);
  (function () { var st = document.createElement('style'); st.textContent = '@keyframes shSpin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); })();
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Run the analysis first.', 'أصدر التحليل أولاً.'), 'warn'); } });
})();
