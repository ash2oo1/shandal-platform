/* Flood radar — Sentinel-1 C-band SAR, radiometrically terrain-corrected gamma-nought (10 m), which sees through
   cloud and at night. A dry reference (mean of up to three passes of the same orbit before the flood) and the first
   pass after the flood are cropped to the area; open water is dark (specular reflection) and is found with an
   automatic minimum-error threshold on the VV backscatter in dB, optionally confirmed by a drop of 3 dB or more; steep slopes
   (radar shadow and layover) are left out with an elevation model. Flooded, permanent and receded water are mapped
   with their true ground areas, and the flood can be followed through every pass in the weeks around it. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, G = window.EG, P = window.PCX, AR = SH.lang === 'ar';
  var COL = 'sentinel-1-rtc', MS = 800, LO = -30, HI = 5, DB = function (v) { return LO + v / 255 * (HI - LO); }, BY = function (db) { return Math.round((db - LO) / (HI - LO) * 255); };
  var Q_VV = P.expr('10*log10(vv+0.000001)', LO, HI);
  var IDS = ['frDate', 'frAfter', 'frBefore', 'frTh', 'frChg', 'frSlope', 'frSpk', 'frName', 'frView'], persist = SH.persist('floodradar', IDS);
  var PRE = [
    ['missan19', 'Missan floods, April 2019', 'فيضانات ميسان، نيسان 2019', [46.85, 31.55, 47.65, 32.15], '2019-04-08'],
    ['sindh22', 'Sindh floods, Pakistan 2022', 'فيضانات السند، باكستان 2022', [67.45, 26.2, 68.25, 26.85], '2022-08-30'],
    ['valencia24', 'Valencia flood, Spain 2024', 'فيضان فالنسيا، إسبانيا 2024', [-0.48, 39.28, -0.28, 39.48], '2024-10-30'],
    ['emilia23', 'Emilia-Romagna, Italy 2023', 'إميليا رومانيا، إيطاليا 2023', [11.8, 44.22, 12.3, 44.55], '2023-05-20'],
    ['kerala18', 'Kerala, India 2018', 'كيرالا، الهند 2018', [76.2, 9.85, 76.6, 10.3], '2018-08-17'],
    ['derna23', 'Derna, Libya 2023', 'درنة، ليبيا 2023', [22.5, 32.68, 22.75, 32.82], '2023-09-11']];
  var map = SH.map('frMap', { zoom: 6, base: 'satellite', center: [33, 44] }), L = window.L, ovl = null, R = null, busy = false;
  var aoiP = P.aoiPicker({ key: 'floodradar', prefix: 'fr', map: map, presets: PRE, maxKm: 120, minKm: 2,
    groups: [['Iraq', 'العراق', ['missan19']], ['The world', 'العالم', ['sindh22', 'valencia24', 'emilia23', 'kerala18', 'derna23']]],
    onChange: function (a) { if (a.extra) $('#frDate').value = a.extra; } });
  if (!$('#frDate').value) $('#frDate').value = (aoiP.cur && aoiP.cur.extra) || new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
  function msg(p, s) { $('#frBar').style.width = Math.round(p * 100) + '%'; $('#frMsg').textContent = s; }
  function iso(d) { return d.toISOString().slice(0, 19) + 'Z'; }
  function day(s) { return new Date(s + 'T00:00:00Z'); }

  /* ------------------------------------------------------------------ scenes: group passes by orbit and day */
  function groups(items, a) {
    var G0 = {}; items.forEach(function (f) { var p = f.properties, k = (p['sat:orbit_state'] || '') + '|' + (p['sat:relative_orbit'] || '') + '|' + p.datetime.slice(0, 10); (G0[k] = G0[k] || []).push(f); });
    return Object.keys(G0).map(function (k) { var L0 = G0[k], pts = P.grid(a, 10), got = pts.map(function () { return false; }); L0.forEach(function (f) { P.hits(f.geometry, pts).forEach(function (v, i) { if (v) got[i] = true; }); });
      var p = L0[0].properties; return { key: k, items: L0, date: p.datetime.slice(0, 10), t: Date.parse(p.datetime), orbit: p['sat:relative_orbit'], dir: p['sat:orbit_state'], plat: p.platform, cov: got.filter(Boolean).length / got.length, vh: (p['sar:polarizations'] || []).indexOf('VH') >= 0 }; });
  }
  function fetchVV(a, grp) { var use = P.pick(grp.items.map(function (f) { return f; }), a, 4); return P.mosaic(a, COL, use.map(function (f) { return { id: f.id }; }), Q_VV, MS); }
  function median3(img) {
    var w = img.width, h = img.height, D = img.data, out = new Uint8ClampedArray(D), v = new Array(9);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var o = 4 * (y * w + x); if (D[o + 3] < 128) continue; var n = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var q = 4 * ((y + dy) * w + x + dx); if (D[q + 3] > 127) v[n++] = D[q]; } var s = v.slice(0, n).sort(function (p, q) { return p - q; }); out[o] = out[o + 1] = out[o + 2] = s[n >> 1]; }
    return new ImageData(out, w, h);
  }

  /* ------------------------------------------------------------------ run */
  function run() {
    if (busy) return; var a = aoiP.cur; if (!a) return SH.toast(t('Choose a place first.', 'اختر مكاناً أولاً.'), 'warn');
    var ev = $('#frDate').value; if (!ev) return SH.toast(t('Enter the date of the flood.', 'أدخل تاريخ الفيضان.'), 'warn');
    if (day(ev) < day('2014-10-10')) return SH.toast(t('Sentinel-1 radar images start in October 2014.', 'تبدأ صور رادار سنتينل-1 في تشرين الأول 2014.'), 'warn');
    persist.save(); busy = true; $('#frRun').disabled = true; var d0 = day(ev), aft = +$('#frAfter').value, bef = +$('#frBefore').value;
    msg(0.05, t('Searching the radar passes after the flood…', 'البحث عن مرورات الرادار بعد الفيضان…'));
    P.search(COL, a, [iso(d0), iso(new Date(d0.getTime() + aft * 864e5 + 864e5 - 1000))], null, 100).then(function (A) {
      var GA = groups(A, a).filter(function (g) { return g.cov >= 0.6; }).sort(function (x, y) { return (y.cov >= 0.95) - (x.cov >= 0.95) || x.t - y.t; });
      if (!GA.length) throw new Error(t('No radar pass covers this area in the chosen days after the flood. Widen the window to 24 days or move the date.', 'لا يوجد مرور رادار يغطي هذه المنطقة في الأيام المختارة بعد الفيضان. وسّع المدة إلى 24 يوماً أو غيّر التاريخ.'));
      var ga = GA[0], b0 = bef === 365 ? new Date(d0.getTime() - 400 * 864e5) : new Date(d0.getTime() - bef * 864e5), b1 = bef === 365 ? new Date(d0.getTime() - 330 * 864e5) : new Date(d0.getTime() - 864e5);
      msg(0.15, t('Searching the dry reference before the flood…', 'البحث عن المرجع الجاف قبل الفيضان…'));
      return P.search(COL, a, [iso(b0), iso(b1)], null, 200).then(function (B) {
        var GB = groups(B, a).filter(function (g) { return g.cov >= 0.95; }), same = GB.filter(function (g) { return g.orbit === ga.orbit && g.dir === ga.dir; }).sort(function (x, y) { return y.t - x.t; }).slice(0, 3), other = false;
        if (!same.length) { same = GB.sort(function (x, y) { return y.t - x.t; }).slice(0, 2); other = true; }
        if (!same.length) throw new Error(t('No radar pass covers the area before the flood. Choose a longer reference period.', 'لا يوجد مرور رادار يغطي المنطقة قبل الفيضان. اختر مدة مرجعية أطول.'));
        msg(0.3, t('Reading the radar images… ', 'قراءة صور الرادار… ') + (1 + same.length));
        return Promise.all([fetchVV(a, ga)].concat(same.map(function (g) { return fetchVV(a, g); }))).then(function (IM) { return { ga: ga, gb: same, other: other, IM: IM }; });
      });
    }).then(function (X) {
      msg(0.7, t('Reading the terrain…', 'قراءة التضاريس…'));
      var w0 = X.IM[0].width, h0 = X.IM[0].height, gx = Math.min(160, w0), gy = Math.max(2, Math.round(gx * h0 / w0));
      var slope = $('#frSlope').checked && SH.dem ? SH.dem.grid({ n: aoiP.cur.n, s: aoiP.cur.s, w: aoiP.cur.w, e: aoiP.cur.e }, gx, gy, { source: 'aws' }).then(function (Gd) { return { G: Gd, gx: gx, gy: gy }; }).catch(function () { return null; }) : Promise.resolve(null);
      return slope.then(function (S) { X.S = S; return X; });
    }).then(function (X) { msg(0.85, t('Finding the water…', 'تحديد المياه…')); R = analyse(X); render(); msg(1, t('Ready.', 'جاهز.')); })
      .catch(function (e) { msg(0, ''); SH.toast(e.message || String(e), 'bad'); })
      .then(function () { busy = false; $('#frRun').disabled = false; });
  }
  $('#frRun').addEventListener('click', run);

  function analyse(X) {
    var a = aoiP.cur, spk = $('#frSpk').checked, A0 = spk ? median3(X.IM[0]) : X.IM[0], Bs = X.IM.slice(1).map(function (im) { return spk ? median3(im) : im; });
    var w0 = A0.width, h0 = A0.height, n = w0 * h0, aft = new Uint8Array(n), bef = new Uint8Array(n), ok = new Uint8Array(n), H = new Uint32Array(256), Hb = new Uint32Array(256), i;
    for (i = 0; i < n; i++) { var o = 4 * i; if (A0.data[o + 3] < 128) continue; var s = 0, c = 0; Bs.forEach(function (B) { if (B.width === w0 && B.data[o + 3] > 127) { s += B.data[o]; c++; } }); if (!c) continue; ok[i] = 1; aft[i] = A0.data[o]; bef[i] = Math.round(s / c); H[aft[i]]++; Hb[bef[i]]++; }
    /* slope from the elevation model, sampled to the image grid */
    var steep = new Uint8Array(n), nSteep = 0;
    if (X.S) { var Gd = X.S.G, gx = X.S.gx, gy = X.S.gy, z = Gd.z, sl = new Float32Array(gx * gy); for (var yy = 0; yy < gy; yy++) for (var xx = 0; xx < gx; xx++) { var xm = Math.max(0, xx - 1), xp = Math.min(gx - 1, xx + 1), ym = Math.max(0, yy - 1), yp = Math.min(gy - 1, yy + 1), dzdx = (z[yy * gx + xp] - z[yy * gx + xm]) / ((xp - xm) * Gd.dx || 1), dzdy = (z[yp * gx + xx] - z[ym * gx + xx]) / ((yp - ym) * Gd.dy || 1); sl[yy * gx + xx] = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI; }
      for (var py = 0; py < h0; py++) for (var px = 0; px < w0; px++) { var gi = Math.min(gy - 1, Math.round(py / (h0 - 1) * (gy - 1))) * gx + Math.min(gx - 1, Math.round(px / (w0 - 1) * (gx - 1))); if (sl[gi] > 5) { steep[py * w0 + px] = 1; nSteep++; } } }
    var manual = parseFloat($('#frTh').value), th, auto = isNaN(manual);
    if (auto) { var tb = P.ki(H, BY(-30), BY(0)), tdb = Math.max(-24, Math.min(-14, DB(tb))), wf = 0, tot = 0; for (i = 0; i < 256; i++) { tot += H[i]; if (DB(i) <= tdb) wf += H[i]; } th = wf / tot < 0.01 ? -18 : tdb; } else th = manual;
    var T = BY(th), chg = $('#frChg').checked, dropB = Math.round(3 / (HI - LO) * 255), rows = P.rowArea(a, w0, h0), aF = 0, aP = 0, aR = 0, aV = 0, aS = 0, cls = new Uint8Array(n);
    for (i = 0; i < n; i++) { if (!ok[i]) continue; var Ar = rows[Math.floor(i / w0)]; aV += Ar; if (steep[i]) { cls[i] = 4; aS += Ar; continue; } var wa = aft[i] <= T, wb = bef[i] <= T;
      if (wa && wb) { cls[i] = 2; aP += Ar; } else if (wa && (!chg || bef[i] - aft[i] >= dropB)) { cls[i] = 1; aF += Ar; } else if (wb && !wa) { cls[i] = 3; aR += Ar; } }
    return { a: a, w: w0, h: h0, aft: aft, bef: bef, ok: ok, cls: cls, H: H, Hb: Hb, th: th, auto: auto, aF: aF, aP: aP, aR: aR, aV: aV, aS: aS, steep: nSteep, ga: X.ga, gb: X.gb, other: X.other, cov: aV / (a.km2 || aV) };
  }

  /* ------------------------------------------------------------------ drawing */
  var COLS = { 1: [255, 59, 48], 2: [31, 78, 156], 3: [255, 196, 0] };
  function grey(arr, ok, w0, h0) { var c = document.createElement('canvas'); c.width = w0; c.height = h0; var g = c.getContext('2d'), im = g.createImageData(w0, h0); for (var i = 0; i < arr.length; i++) { var o = 4 * i; if (!ok[i]) continue; var v = Math.max(0, Math.min(255, (DB(arr[i]) + 25) / 25 * 255)); im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255; } g.putImageData(im, 0, 0); return c; }
  function maskCv(r, alpha) { var c = document.createElement('canvas'); c.width = r.w; c.height = r.h; var g = c.getContext('2d'), im = g.createImageData(r.w, r.h); for (var i = 0; i < r.cls.length; i++) { var k = r.cls[i], o = 4 * i; if (!COLS[k]) continue; im.data[o] = COLS[k][0]; im.data[o + 1] = COLS[k][1]; im.data[o + 2] = COLS[k][2]; im.data[o + 3] = alpha; } g.putImageData(im, 0, 0); return c; }
  function chgCv(r) { var c = document.createElement('canvas'); c.width = r.w; c.height = r.h; var g = c.getContext('2d'), im = g.createImageData(r.w, r.h), sc = function (v) { return Math.max(0, Math.min(255, (DB(v) + 25) / 25 * 255)); }; for (var i = 0; i < r.cls.length; i++) { var o = 4 * i; if (!r.ok[i]) continue; im.data[o] = sc(r.bef[i]); im.data[o + 1] = sc(r.aft[i]); im.data[o + 2] = sc(r.aft[i]); im.data[o + 3] = 255; } g.putImageData(im, 0, 0); return c; }
  function km2(v) { return F(v, v < 10 ? 2 : v < 100 ? 1 : 0) + ' km²'; }
  function nm() { return aoiP.name(); }
  function render() {
    var r = R; if (!r) return; $('#frEmpty').hidden = true; $('#frOut').hidden = false;
    $('#frKpis').innerHTML = G.kpi(r.aF > 0.5 ? 'bad' : 'ok', t('Flooded area', 'المساحة المغمورة'), F(r.aF, r.aF < 10 ? 2 : 1) + '<small> km²</small>', t('new water after the flood', 'مياه جديدة بعد الفيضان')) + G.kpi('info', t('Permanent water', 'المياه الدائمة'), F(r.aP, r.aP < 10 ? 2 : 1) + '<small> km²</small>', t('rivers, lakes and marshes before and after', 'أنهار وبحيرات وأهوار قبل وبعد')) + G.kpi('info', t('Water that went back', 'مياه انحسرت'), F(r.aR, r.aR < 10 ? 2 : 1) + '<small> km²</small>', t('water before, dry after', 'ماء قبل، جاف بعد')) + G.kpi('info', t('Water threshold', 'حد الماء'), F(r.th, 1) + '<small> dB</small>', r.auto ? t('automatic (minimum error)', 'تلقائي (أقل خطأ)') : t('set by you', 'حددته أنت'));
    var v = [G.verdict(r.aF > 0.02 * r.aV ? 'bad' : r.aF > 0.002 * r.aV ? 'warn' : 'ok', t('What the radar shows', 'ما يُظهره الرادار'), t('After the flood ', 'بعد الفيضان ') + km2(r.aF) + t(' of land was under new water (', ' من الأرض كانت تحت مياه جديدة (') + F(100 * r.aF / (r.aV || 1), 1) + t(' % of the area), besides ', ' % من المنطقة)، إضافة إلى ') + km2(r.aP) + t(' of permanent water. The after image is of ', ' من المياه الدائمة. صورة ما بعد الفيضان من ') + r.ga.date + t('; the dry reference is the mean of ', '؛ والمرجع الجاف متوسط ') + r.gb.length + t(' pass(es) up to ', ' مرور حتى ') + r.gb[0].date + '.')];
    if (r.other) v.push(G.verdict('warn', t('Different orbit for the reference', 'مدار مختلف للمرجع'), t('No dry pass from the same orbit was found, so another orbit is used. The radar looks from another angle, and slopes and buildings can show false changes; read the map with care.', 'لم يُعثر على مرور جاف من المدار نفسه، فاستُعمل مدار آخر. ينظر الرادار من زاوية أخرى، وقد تُظهر المنحدرات والمباني تغيرات زائفة؛ فاقرأ الخريطة بحذر.')));
    v.push(G.verdict('info', t('What radar cannot see', 'ما لا يراه الرادار'), t('Water inside towns (between buildings), under trees and in fields with crops standing above it often does not look dark, so urban and forest flooding is underestimated. Wind, rain at the moment of the pass and very smooth surfaces such as dry sand, tarmac and airports can look like water. Compare with the optical images when the sky clears.', 'المياه داخل المدن (بين المباني) وتحت الأشجار وفي الحقول ذات المحاصيل البارزة فوقها كثيراً لا تبدو داكنة، فيُقدَّر غمر المدن والغابات بأقل من حقيقته. وقد تبدو الرياح والمطر لحظة المرور والسطوح الملساء جداً كالرمل الجاف والإسفلت والمطارات كأنها ماء. قارن مع الصور البصرية حين تصفو السماء.')));
    $('#frVerd').innerHTML = v.join('');
    var cv = $('#frCv'), base = grey(r.aft, r.ok, r.w, r.h);
    P.sheet(cv, { a: r.a, title: nm() + ' — flood ' + r.ga.date, sub: 'Sentinel-1 radar (VV, 10 m) after ' + r.ga.date + ' compared with the dry reference of ' + r.gb.map(function (g) { return g.date; }).join(', '), layers: [base, { img: maskCv(r, 220) }],
      legend: [['Flooded (new water)', 'rgb(255,59,48)'], ['Permanent water', 'rgb(31,78,156)'], ['Water that went back', 'rgb(255,196,0)']], stats: 'Flooded ' + km2(r.aF) + '  ·  Permanent water ' + km2(r.aP) + '  ·  Went back ' + km2(r.aR) + '  ·  Threshold ' + F(r.th, 1) + ' dB' });
    $('#frCap').textContent = t('Red is land under new water after the flood, dark blue is water that was there before as well, and yellow is water that was there before and is now dry. The grey background is the radar image after the flood: dark is smooth (water, sand), bright is rough (towns, rocks, vegetation).', 'الأحمر أرض تحت مياه جديدة بعد الفيضان، والأزرق الداكن مياه كانت موجودة قبله أيضاً، والأصفر مياه كانت موجودة وجفت الآن. والخلفية الرمادية صورة الرادار بعد الفيضان: الداكن سطح أملس (ماء، رمل)، والفاتح سطح خشن (مدن، صخور، نبات).') + (r.aS ? ' ' + t('Steep slopes are left out (', 'استُبعدت المنحدرات الشديدة (') + km2(r.aS) + ').' : '');
    view2(); hist(); table();
    if (map) { if (ovl) map.removeLayer(ovl); ovl = L.imageOverlay(maskCv(r, 200).toDataURL(), [[r.a.s, r.a.w], [r.a.n, r.a.e]], { opacity: 0.85 }).addTo(map); }
  }
  function view2() {
    var r = R; if (!r) return; var v = $('#frView').value, cv = $('#frCv2');
    var lay = v === 'before' ? grey(r.bef, r.ok, r.w, r.h) : v === 'after' ? grey(r.aft, r.ok, r.w, r.h) : chgCv(r);
    P.sheet(cv, { a: r.a, title: nm() + (v === 'before' ? ' — radar before (reference)' : v === 'after' ? ' — radar after ' + r.ga.date : ' — radar change'), sub: v === 'chg' ? 'Red: before · Green and blue: after. Red areas darkened (new water); cyan areas brightened.' : 'Sentinel-1 VV backscatter, −25 to 0 dB', layers: [lay],
      legend: v === 'chg' ? [['New water (darker after)', '#E03030'], ['Brighter after', '#30D0D0'], ['Unchanged', '#9A9A9A']] : [['Smooth (water)', '#111'], ['Rough', '#EEE']] });
    $('#frCap2').textContent = v === 'chg' ? t('The two images in one: red where the ground was bright before and dark after (new water), cyan where it became brighter, grey where nothing changed.', 'الصورتان في صورة واحدة: الأحمر حيث كانت الأرض فاتحة قبل وداكنة بعد (مياه جديدة)، والسماوي حيث صارت أفتح، والرمادي حيث لم يتغير شيء.') : t('Radar backscatter: the darker, the smoother the surface. Calm water is the darkest.', 'الإشارة الراجعة للرادار: كلما كان أدكن كان السطح أملس. والمياه الهادئة هي الأدكن.');
  }
  $('#frView').addEventListener('change', function () { persist.save(); view2(); });
  function hist() {
    var r = R, pa = [], pb = [], tot = 0, totb = 0, i; for (i = 0; i < 256; i++) { tot += r.H[i]; totb += r.Hb[i]; }
    for (i = 0; i < 256; i += 2) { var x = DB(i); if (x < -30 || x > 0) continue; pa.push([x, 100 * (r.H[i] + (r.H[i + 1] || 0)) / (tot || 1)]); pb.push([x, 100 * (r.Hb[i] + (r.Hb[i + 1] || 0)) / (totb || 1)]); }
    var mx = Math.max.apply(null, pa.concat(pb).map(function (q) { return q[1]; })) || 1;
    G.chart($('#frHist'), { W: 760, H: 340, m: { l: 64, r: 20, t: 18, b: 56 }, x: { lo: -30, hi: 0, n: 7, title: 'Backscatter VV (dB)' }, y: { lo: 0, hi: mx * 1.1, title: 'Share of pixels (%)' },
      top: function (fx, fy) { return '<line x1="' + fx(r.th) + '" x2="' + fx(r.th) + '" y1="' + fy(mx * 1.1) + '" y2="' + fy(0) + '" stroke="#C0392B" stroke-width="2" stroke-dasharray="6 4"/>' + G.tx(fx(r.th) + 6, fy(mx * 1.05), 'Water below ' + F(r.th, 1) + ' dB', { fs: 11.5, fw: 700, fill: '#C0392B' }); },
      series: [{ pts: pb, col: '#8A94A0', w: 2 }, { pts: pa, col: '#2E6FBF', w: 2.6 }], legend: [{ name: 'Before (dry reference)', col: '#8A94A0' }, { name: 'After the flood', col: '#2E6FBF' }, { name: 'Water threshold', col: '#C0392B', dash: '6 4' }] });
    $('#frHistCap').textContent = t('Water is the peak on the left (dark, smooth) and land the peak on the right. The threshold separates them; after a flood the left peak grows.', 'المياه هي القمة اليسرى (داكنة وملساء) واليابسة القمة اليمنى. ويفصل الحد بينهما؛ وبعد الفيضان تكبر القمة اليسرى.');
  }
  function table() {
    var r = R, rows = [[t('After the flood', 'بعد الفيضان'), r.ga]].concat(r.gb.map(function (g) { return [t('Dry reference', 'المرجع الجاف'), g]; }));
    $('#frTbl').innerHTML = '<thead><tr><th>' + t('Role', 'الدور') + '</th><th>' + t('Date', 'التاريخ') + '</th><th>' + t('Satellite', 'القمر') + '</th><th>' + t('Orbit', 'المدار') + '</th><th class="num">' + t('Coverage %', 'التغطية %') + '</th></tr></thead><tbody>' +
      rows.map(function (q) { var g = q[1]; return '<tr><td>' + q[0] + '</td><td class="ltr">' + g.date + '</td><td class="ltr">' + SH.esc(g.plat || 'Sentinel-1') + '</td><td class="ltr">' + (g.orbit || '—') + ' ' + (g.dir === 'ascending' ? t('ascending', 'صاعد') : g.dir === 'descending' ? t('descending', 'نازل') : '') + '</td><td class="num">' + F(g.cov * 100, 0) + '</td></tr>'; }).join('') + '</tbody>';
  }

  /* ------------------------------------------------------------------ following the flood through every pass */
  $('#frTrackGo').addEventListener('click', function () {
    if (!R || busy) return; var a = R.a, d0 = day($('#frDate').value), btn = this, lbl = btn.innerHTML; busy = true; btn.disabled = true;
    P.search(COL, a, [iso(new Date(d0.getTime() - 30 * 864e5)), iso(new Date(d0.getTime() + 45 * 864e5))], null, 200).then(function (A) {
      var GA = groups(A, a).filter(function (g) { return g.cov >= 0.95; }).sort(function (x, y) { return x.t - y.t; }).slice(0, 16), done = 0, out = [];
      if (!GA.length) throw new Error(t('No complete radar pass in these weeks.', 'لا يوجد مرور رادار كامل في هذه الأسابيع.'));
      var q = GA.slice(), T = BY(R.th), rows = P.rowArea(a, R.w, R.h), steep = R.cls;
      var work = function () { if (!q.length) return Promise.resolve(); var g = q.shift(); return fetchVV(a, g).then(function (im) { var I = $('#frSpk').checked ? median3(im) : im, wa = 0; for (var i = 0; i < I.width * I.height; i++) { var o = 4 * i; if (I.data[o + 3] < 128 || (I.width === R.w && steep[i] === 4)) continue; if (I.data[o] <= T) wa += rows[Math.floor(i / I.width)] || 0; } out.push({ g: g, water: wa }); }).catch(function () {}).then(function () { done++; btn.textContent = t('Following… ', 'جارٍ التتبع… ') + done + ' / ' + GA.length; return work(); }); };
      return Promise.all([work(), work(), work()]).then(function () { out.sort(function (x, y) { return x.g.t - y.g.t; }); track(out, d0); });
    }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { busy = false; btn.disabled = false; btn.innerHTML = lbl; });
  });
  function track(out, d0) {
    if (!out.length) return; var t0 = d0.getTime(), pts = out.map(function (o) { return [(o.g.t - t0) / 864e5, o.water]; }), mx = Math.max.apply(null, pts.map(function (p) { return p[1]; })) || 1;
    G.chart($('#frTrack'), { W: 760, H: 340, m: { l: 70, r: 20, t: 18, b: 56 }, x: { lo: -30, hi: 45, n: 8, title: 'Days from the flood date (' + $('#frDate').value + ')' }, y: { lo: 0, hi: mx * 1.15, title: 'Water area (km²)' },
      top: function (fx, fy) { return '<line x1="' + fx(0) + '" x2="' + fx(0) + '" y1="' + fy(mx * 1.15) + '" y2="' + fy(0) + '" stroke="#C0392B" stroke-width="2" stroke-dasharray="6 4"/>' + G.tx(fx(0) + 6, fy(mx * 1.08), 'Flood date', { fs: 11.5, fw: 700, fill: '#C0392B' }); },
      series: [{ pts: pts, col: '#2E6FBF', w: 2.6, mark: 'o', r: 4 }], legend: [{ name: 'Open water in the area (each radar pass)', col: '#2E6FBF', mark: 'o' }] });
    $('#frTrackCap').textContent = t('Every radar pass that covers the area, with the same water threshold. Passes from different orbits look from different angles, so small jumps between them are normal; the rise and fall of the water is the flood.', 'كل مرور رادار يغطي المنطقة، بحد الماء نفسه. وتنظر المرورات من مدارات مختلفة بزوايا مختلفة، فالقفزات الصغيرة بينها طبيعية؛ وارتفاع المياه وانخفاضها هو الفيضان.');
  }

  /* ------------------------------------------------------------------ exports */
  $$('[data-cv]').forEach(function (b) { b.addEventListener('click', function () { if (!R) return; SH.exportCanvas($('#' + b.getAttribute('data-cv')), 'shandal-flood-' + (R.a.key || 'area') + '-' + R.ga.date, b.getAttribute('data-fmt')); }); });
  $('#frCsv').addEventListener('click', function () { if (!R) return; var r = R; SH.csv('shandal-flood-' + (r.a.key || 'area') + '.csv', [['place', nm()], ['bbox_w_s_e_n', [r.a.w, r.a.s, r.a.e, r.a.n].join(' ')], ['after_date', r.ga.date], ['reference_dates', r.gb.map(function (g) { return g.date; }).join(' ')], ['orbit', r.ga.orbit + ' ' + r.ga.dir], ['threshold_db', r.th.toFixed(2)], ['flooded_km2', r.aF.toFixed(3)], ['permanent_water_km2', r.aP.toFixed(3)], ['receded_km2', r.aR.toFixed(3)], ['steep_excluded_km2', r.aS.toFixed(3)], ['valid_area_km2', r.aV.toFixed(3)]]); });
  /* flood as polygons: runs of flooded pixels along each row, merged downwards into rectangles */
  $('#frGeo').addEventListener('click', function () {
    if (!R) return; var r = R, a = r.a, dx = (a.e - a.w) / r.w, dy = (a.n - a.s) / r.h, open = {}, rects = [];
    for (var y = 0; y <= r.h; y++) { var runs = {}, x = 0; if (y < r.h) while (x < r.w) { if (r.cls[y * r.w + x] === 1) { var x0 = x; while (x < r.w && r.cls[y * r.w + x] === 1) x++; runs[x0 + ':' + x] = 1; } else x++; }
      Object.keys(open).forEach(function (k) { if (runs[k]) { delete runs[k]; } else { var p = k.split(':'); rects.push([+p[0], open[k], +p[1], y]); delete open[k]; } }); Object.keys(runs).forEach(function (k) { open[k] = y; }); }
    var feats = rects.map(function (q) { var W0 = a.w + q[0] * dx, E0 = a.w + q[2] * dx, N0 = a.n - q[1] * dy, S0 = a.n - q[3] * dy; return [[[W0, S0], [E0, S0], [E0, N0], [W0, N0], [W0, S0]]]; });
    SH.json('shandal-flood-' + (a.key || 'area') + '-' + r.ga.date + '.geojson', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: nm(), class: 'flooded', after: r.ga.date, threshold_db: +r.th.toFixed(2), area_km2: +r.aF.toFixed(3) }, geometry: { type: 'MultiPolygon', coordinates: feats } }] });
  });
  $('#frName').addEventListener('input', function () { persist.save(); if (R) render(); });
  window.SHFR = { analyse: analyse, R: function () { return R; } };
})();
