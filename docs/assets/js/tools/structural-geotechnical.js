/* Structural & geotechnical survey.
   Orientation data: phone compass-clinometer (Fisher mean of recorded points, IGRF-14 declination) or typed values.
   Kinematics: Markland (1972) planar and wedge tests with Hocking (1976) single-plane check, Goodman & Bray (1976)
   flexural toppling, lateral limits after Wyllie & Mah (2004).
   Limit equilibrium: planar sliding with tension crack, water and pseudo-static load (Hoek & Bray 1981; Wyllie & Mah 2004),
   wedge factor K (Wyllie & Mah 2004, eq. 7.2) for friction-only wedges.
   Rock mass: RMR89 (Bieniawski 1989) with the A4 condition sub-ratings, RQD from Jv (Palmström 2005),
   SMR (Romana 1985) with the continuous F1–F3 functions of Tomás et al. (2007). */
(function () {
  'use strict';
  var t = SH.t, R = SH.rad, D = SH.deg, $ = SH.$, AR = SH.lang === 'ar', ST = SH.strat;
  var PL = ['J1', 'J2', 'J3', 'S0', 'F'];
  var ids = ['geoName', 'sProject', 'sRock', 'sLat', 'sLon', 'sRef', 'hgt', 'gam', 'phi', 'coh', 'crack', 'crackZ', 'crackW', 'kh', 'limP', 'limT', 'rUcs', 'ucsV', 'is50', 'rqdV', 'jv', 'spc', 'cPer', 'cApe', 'cRou', 'cInf', 'cWea', 'rGw', 'f4', 'useJ2', 'useJ3', 'useS0', 'useCol'];
  PL.forEach(function (p) { ids.push(p + 'dd', p + 'dip'); });
  var store = SH.persist('structural2', ids);
  var reads = SH.store.get('shandal_struct_reads', {}), src = SH.store.get('shandal_struct_src', {});
  var last = null, decl = null;
  var INK = '#1B232B', MUT = '#55616B', GRID = '#C9CED3', BG = '#FFFFFF';
  var COL = { J1: '#B4552D', J2: '#2F6FB2', J3: '#2E7D5B', S0: '#8A5A9E', F: '#1B232B', fr: '#2F7F7C', crit: '#C0392B', zone: '#E8A33D', water: '#3D8FD1' };

  /* ---------- vector helpers (x East, y North, z Down) */
  var norm = function (a) { return ((a % 360) + 360) % 360; };
  var angDiff = function (a, b) { var x = Math.abs(norm(a) - norm(b)); return x > 180 ? 360 - x : x; };
  var strikeOf = function (dd) { return norm(dd - 90); };
  var p3 = function (v) { return String(Math.round(norm(v)) % 360).padStart(3, '0'); };
  var att = function (dd, dip) { return String(Math.round(dip)).padStart(2, '0') + '/' + p3(dd); };
  var lin = function (tr, pl) { return String(Math.round(pl)).padStart(2, '0') + '→' + p3(tr); };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var unit = function (v) { var n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
  var mul = function (v, k) { return [v[0] * k, v[1] * k, v[2] * k]; };
  var add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  function lineVec(tr, pl) { return [Math.sin(R(tr)) * Math.cos(R(pl)), Math.cos(R(tr)) * Math.cos(R(pl)), Math.sin(R(pl))]; }
  function vecLine(v) { v = unit(v); if (v[2] < 0) v = mul(v, -1); return { trend: norm(D(Math.atan2(v[0], v[1]))), plunge: D(Math.asin(SH.clamp(v[2], -1, 1))) }; }
  function poleVec(dd, dip) { return lineVec(dd + 180, 90 - dip); }
  function inter(a, b) { return vecLine(cross(poleVec(a.dd, a.dip), poleVec(b.dd, b.dip))); }
  function appDip(dip, dd, dir) { return D(Math.atan(Math.tan(R(Math.min(dip, 89.99))) * Math.cos(R(dir - dd)))); }
  var atd = function (x) { return D(Math.atan(x)); };
  var between = function (a, lo, hi) { return Math.abs(angDiff(lo, a) + angDiff(a, hi) - angDiff(lo, hi)) < 0.5; };

  /* ---------- magnetic declination (IGRF-14) */
  function fmtDecl(d) { return Math.abs(d).toFixed(1) + '° ' + (d >= 0 ? 'E' : 'W'); }
  function updDecl() {
    var la = SH.num('sLat'), lo = SH.num('sLon');
    if (!isFinite(la) || !isFinite(lo) || !SH.igrf) { decl = null; $('#sDecl').innerHTML = ''; return; }
    SH.igrf.load().then(function () { var n = new Date(), yr = n.getFullYear() + (n.getMonth() + 0.5) / 12, f = SH.igrf.field(la, lo, 0, yr); decl = f.D;
      $('#sDecl').innerHTML = t('Magnetic declination (IGRF-14): ', 'الانحراف المغناطيسي (IGRF-14): ') + '<b class="ltr">' + fmtDecl(decl) + '</b>'; })
      .catch(function () { decl = null; });
  }
  ['sLat', 'sLon'].forEach(function (id) { $('#' + id).addEventListener('change', updDecl); });
  $('#sLoc').addEventListener('click', function () { SH.locate().then(function (p) { $('#sLat').value = p.lat.toFixed(6); $('#sLon').value = p.lon.toFixed(6); store.save(); updDecl(); }).catch(function (e) { SH.toast(e.message, 'bad'); }); });

  /* ---------- plane inputs */
  function updStrike() { PL.forEach(function (p) { var a = SH.num(p + 'dd'); $('#' + p + 's').value = isNaN(a) ? '' : p3(strikeOf(a)) + '°'; }); }
  function updBoxes() { ['J2', 'J3', 'S0'].forEach(function (p) { $('#box' + p).hidden = !$('#use' + p).checked; }); $('#colBox').hidden = !$('#useCol').checked; }
  PL.forEach(function (p) { [p + 'dd', p + 'dip'].forEach(function (id) { $('#' + id).addEventListener('input', function () { src[p] = 'typed'; SH.store.set('shandal_struct_src', src); updStrike(); }); }); });
  ['useJ2', 'useJ3', 'useS0', 'useCol'].forEach(function (id) { $('#' + id).addEventListener('change', updBoxes); });

  /* ---------- Fisher statistics of plane normals */
  function fisher(list) {
    var s = [0, 0, 0]; list.forEach(function (r) { s = add(s, mul(poleVec(r[0], r[1]), -1)); });
    var N = list.length, Rl = Math.hypot(s[0], s[1], s[2]), u = unit(s);
    var dd = norm(D(Math.atan2(u[0], u[1]))), dip = D(Math.acos(SH.clamp(-u[2], -1, 1)));
    var k = N > 1 && N > Rl ? (N - 1) / (N - Rl) : Infinity, a95 = N > 1 && Rl > 0 ? D(Math.acos(SH.clamp(1 - (N - Rl) / Rl * (Math.pow(20, 1 / (N - 1)) - 1), -1, 1))) : NaN;
    if (dip > 90) { dip = 180 - dip; dd = norm(dd + 180); }
    return { dd: dd, dip: dip, n: N, k: k, a95: a95 };
  }
  function showN() { PL.forEach(function (p) { var l = reads[p] || []; if (!l.length) { $('#n' + p).textContent = ''; return; } var f = fisher(l); $('#n' + p).textContent = 'n = ' + f.n + (f.n > 1 ? ' · α95 = ' + (isFinite(f.a95) ? f.a95.toFixed(1) : '—') + '° · k = ' + (isFinite(f.k) ? f.k.toFixed(0) : '∞') : ''); }); }

  /* ---------- compass (W3C device orientation, Z-X'-Y'' Tait–Bryan) */
  var buf = [], compassOn = false, cur = null;
  function onOri(e) {
    if (!compassOn) return;
    var al = e.alpha, be = e.beta, ga = e.gamma, s;
    if (typeof e.webkitCompassHeading === 'number') { al = 360 - e.webkitCompassHeading; s = 'iOS'; } else s = e.absolute ? 'absolute' : 'relative';
    if (al == null || be == null || ga == null) return;
    var a = R(al), b = R(be), g = R(ga);
    var nx = Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g), ny = Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g), nz = Math.cos(b) * Math.cos(g);
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    var dd = norm(D(Math.atan2(nx, ny)) + (decl || 0)), dip = D(Math.acos(SH.clamp(nz, -1, 1)));
    buf.push([dd, dip]); if (buf.length > 30) buf.shift();
    var f = fisher(buf); cur = f;
    $('#cDd').textContent = p3(f.dd) + '°'; $('#cDip').textContent = Math.round(f.dip) + '°'; $('#cA95').textContent = isFinite(f.a95) ? f.a95.toFixed(1) + '°' : '—';
    $('#cSrc').textContent = s + (decl != null ? ' · D ' + fmtDecl(decl) : '');
  }
  $('#cStart').addEventListener('click', function () {
    function go() { compassOn = true; $('#cLive').hidden = false; buf = [];
      if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri); else window.addEventListener('deviceorientation', onOri);
      setTimeout(function () { if (!cur) SH.toast(t('No orientation data. Open this page on a phone with a magnetometer.', 'لا توجد بيانات اتجاه. افتح هذه الصفحة على هاتف مزوّد بحساس مغناطيسي.'), 'warn', 5000); }, 2500);
      if (decl == null) SH.toast(t('Enter the site position to correct readings to true north.', 'أدخل موقع الموقع لتصحيح القراءات إلى الشمال الحقيقي.'), 'warn', 5000); }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') go(); else SH.toast(t('Motion sensor permission was refused.', 'رُفض إذن حساس الحركة.'), 'bad'); }).catch(function () { SH.toast(t('Motion sensor permission failed.', 'فشل طلب إذن حساس الحركة.'), 'bad'); });
    else go();
  });
  $('#cLive').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rec]'); if (!b) return; if (!cur) return SH.toast(t('No compass reading yet.', 'لا توجد قراءة بعد.'), 'warn');
    var p = b.getAttribute('data-rec'); (reads[p] = reads[p] || []).push([cur.dd, cur.dip]); var f = fisher(reads[p]);
    if (p !== 'J1' && p !== 'F') { $('#use' + p).checked = true; updBoxes(); }
    $('#' + p + 'dd').value = Math.round(f.dd); $('#' + p + 'dip').value = Math.round(f.dip); src[p] = 'rec';
    SH.store.set('shandal_struct_reads', reads); SH.store.set('shandal_struct_src', src); store.save(); updStrike(); showN();
    SH.toast(p + ': ' + att(cur.dd, cur.dip) + ' · n = ' + f.n, 'ok');
  });
  $('#cClear').addEventListener('click', function () { reads = {}; SH.store.set('shandal_struct_reads', reads); showN(); });

  /* ---------- classifications */
  var RMRCLS = [[81, 'I', t('Very good rock', 'صخر جيد جداً'), '> 400', '> 45', 'ok'], [61, 'II', t('Good rock', 'صخر جيد'), '300–400', '35–45', 'ok'], [41, 'III', t('Fair rock', 'صخر متوسط'), '200–300', '25–35', 'warn'], [21, 'IV', t('Poor rock', 'صخر ضعيف'), '100–200', '15–25', 'bad'], [-1e9, 'V', t('Very poor rock', 'صخر ضعيف جداً'), '< 100', '< 15', 'bad']];
  var SMRCLS = [[81, 'I', t('Completely stable', 'مستقر تماماً'), t('none', 'لا توجد'), t('none', 'لا يلزم'), 'ok'], [61, 'II', t('Stable', 'مستقر'), t('some blocks', 'بعض الكتل'), t('occasional', 'موضعي'), 'ok'],
    [41, 'III', t('Partially stable', 'مستقر جزئياً'), t('some joints or many wedges', 'على بعض الفواصل أو أسافين عديدة'), t('systematic', 'منهجي'), 'warn'], [21, 'IV', t('Unstable', 'غير مستقر'), t('planar or big wedges', 'مستوية أو أسافين كبيرة'), t('important or corrective', 'مهم أو تصحيحي'), 'bad'], [-1e9, 'V', t('Completely unstable', 'غير مستقر تماماً'), t('big planar or soil-like', 'مستوية كبيرة أو شبيهة بالتربة'), t('re-excavation', 'إعادة الحفر'), 'bad']];
  var cls = function (tab, v) { for (var i = 0; i < tab.length; i++) if (v >= tab[i][0]) return tab[i]; return tab[tab.length - 1]; };
  var F1 = function (A) { return 0.64 - 0.006 * atd(0.1 * (Math.abs(A) - 17)); };
  var F2 = function (B) { return 0.5625 + atd(0.17 * Math.abs(B) - 5) / 195; };
  var F3P = function (C) { return -30 + atd(C) / 3; };
  var F3T = function (C) { return -13 - atd(C - 120) / 7; };

  /* ---------- analysis */
  function getPlane(p) { var dd = SH.num(p + 'dd'), dip = SH.num(p + 'dip'); if (isNaN(dd) || isNaN(dip)) return null; if ($('#sRef').value === 'mag' && src[p] !== 'rec' && decl != null) dd = norm(dd + decl); return { k: p, dd: norm(dd), dip: SH.clamp(dip, 0, 90) }; }
  function analyse() {
    var F = getPlane('F'), J1 = getPlane('J1'), phi = SH.num('phi');
    if (!F || !J1 || isNaN(phi)) { SH.toast(t('Enter J1, the slope face and the friction angle.', 'أدخل J1 ووجه المنحدر وزاوية الاحتكاك.'), 'warn'); return null; }
    if (F.dip <= 0) { SH.toast(t('The slope face dip must be greater than 0°.', 'يجب أن يكون ميل وجه المنحدر أكبر من 0°.'), 'warn'); return null; }
    var sets = [J1]; ['J2', 'J3', 'S0'].forEach(function (p) { if ($('#use' + p).checked) { var q = getPlane(p); if (q) sets.push(q); } });
    var r = { F: F, sets: sets, phi: phi, c: SH.num('coh') || 0, H: SH.num('hgt'), gam: SH.num('gam') || 26, kh: SH.num('kh') || 0, crack: $('#crack').value, zIn: SH.num('crackZ'), wf: +$('#crackW').value, limP: SH.num('limP') || 20, limT: SH.num('limT') || 10 };
    var faceApp = function (dir) { return appDip(F.dip, F.dd, dir); };
    sets.forEach(function (s) {
      s.dA = angDiff(s.dd, F.dd); s.out = s.dA <= 90; s.fApp = faceApp(s.dd);
      s.daylight = s.dA <= r.limP && s.dip < s.fApp && s.dip > 0;
      s.planar = s.daylight && s.dip > phi;
      s.topple = angDiff(s.dd, F.dd + 180) <= r.limT && s.dip >= (90 - F.dip) + phi;
      s.le = s.daylight ? planarFS(r, s.dip) : null;
      if (s.out) s.smr = { mode: 'P', A: s.dA, F1: F1(s.dA), F2: F2(s.dip), F3: F3P(s.dip - F.dip) };
      else { var A = angDiff(s.dd, F.dd + 180); s.smr = { mode: 'T', A: A, F1: F1(A), F2: 1, F3: F3T(s.dip + F.dip) }; }
    });
    r.wedges = [];
    for (var i = 0; i < sets.length; i++) for (var j = i + 1; j < sets.length; j++) {
      var a = sets[i], b = sets[j], L = inter(a, b); if (!isFinite(L.plunge) || angDiff(a.dd, b.dd) < 1 && Math.abs(a.dip - b.dip) < 1) continue;
      var w = { a: a, b: b, L: L, key: 'I' + a.k.replace('J', '').replace('S0', 'b') + b.k.replace('J', '').replace('S0', 'b') }; w.lbl = a.k + '∩' + b.k;
      w.fApp = faceApp(L.trend); w.daylight = angDiff(L.trend, F.dd) < 90 && L.plunge < w.fApp && L.plunge > 0;
      w.kin = w.daylight && L.plunge > phi;
      w.hock = null; [a, b].forEach(function (q) { if (w.kin && between(q.dd, L.trend, F.dd) && q.dip > phi) w.hock = q.k; });
      if (w.daylight) { var g = wedgeK(a, b, L); w.xi = g.xi; w.beta = g.beta; w.K = g.K; w.fs = g.K * Math.tan(R(phi)) / Math.tan(R(Math.max(L.plunge, 0.5))); }
      if (w.daylight) w.smr = { mode: 'W', A: angDiff(L.trend, F.dd), F1: F1(angDiff(L.trend, F.dd)), F2: F2(L.plunge), F3: F3P(L.plunge - F.dip) };
      r.wedges.push(w);
    }
    // RMR89
    var ucs = SH.num('ucsV'); if (!(ucs > 0) && SH.num('is50') > 0) ucs = 22 * SH.num('is50');
    var a1 = ucs > 0 ? (ucs > 250 ? 15 : ucs > 100 ? 12 : ucs > 50 ? 7 : ucs > 25 ? 4 : ucs > 5 ? 2 : ucs >= 1 ? 1 : 0) : +$('#rUcs').value;
    var rqd = SH.num('rqdV'); if (isNaN(rqd) && SH.num('jv') >= 0) rqd = SH.clamp(110 - 2.5 * SH.num('jv'), 0, 100);
    if (isNaN(rqd)) { SH.toast(t('Enter RQD or the volumetric joint count Jv.', 'أدخل RQD أو عدد الفواصل الحجمي Jv.'), 'warn'); return null; }
    var spc = SH.num('spc'); if (!(spc > 0)) { SH.toast(t('Enter the mean spacing of discontinuities.', 'أدخل متوسط تباعد الانقطاعات.'), 'warn'); return null; }
    var a2 = rqd >= 90 ? 20 : rqd >= 75 ? 17 : rqd >= 50 ? 13 : rqd >= 25 ? 8 : 3, a3 = spc > 2 ? 20 : spc >= 0.6 ? 15 : spc >= 0.2 ? 10 : spc >= 0.06 ? 8 : 5;
    var sub = ['cPer', 'cApe', 'cRou', 'cInf', 'cWea'].map(function (id) { return parseInt($('#' + id).value, 10); }), a4 = sub.reduce(function (x, y) { return x + y; }, 0), a5 = +$('#rGw').value;
    r.ucs = ucs > 0 ? ucs : null; r.rqd = rqd; r.spc = spc; r.sub = sub; r.p = [a1, a2, a3, a4, a5]; r.rmr = a1 + a2 + a3 + a4 + a5; r.F4 = +$('#f4').value;
    // SMR for every mode, critical = minimum
    var modes = [];
    sets.forEach(function (s) { s.smr.v = SH.clamp(r.rmr + s.smr.F1 * s.smr.F2 * s.smr.F3 + r.F4, 0, 100); modes.push({ lbl: s.k, m: s.smr }); });
    r.wedges.forEach(function (w) { if (w.smr) { w.smr.v = SH.clamp(r.rmr + w.smr.F1 * w.smr.F2 * w.smr.F3 + r.F4, 0, 100); modes.push({ lbl: w.lbl, m: w.smr }); } });
    r.smrCrit = modes.reduce(function (m, x) { return !m || x.m.v < m.m.v ? x : m; }, null);
    r.smr = r.smrCrit ? r.smrCrit.m.v : r.rmr + r.F4;
    // governing planar block
    r.crit = sets.filter(function (s) { return s.le; }).sort(function (x, y) { return x.le.fs - y.le.fs; })[0] || null;
    r.wcrit = r.wedges.filter(function (w) { return w.fs != null; }).sort(function (x, y) { return x.fs - y.fs; })[0] || null;
    r.S0 = sets.filter(function (s) { return s.k === 'S0'; })[0] || null;
    return r;
  }
  function planarFS(r, psp) {
    var H = r.H, pf = r.F.dip; if (!(H > 0) || psp >= pf || psp <= 0) return null;
    var cp = 1 / Math.tan(R(psp)), cf = 1 / Math.tan(R(pf)), zmax = H * (1 - cf * Math.tan(R(psp))), z = 0;
    if (r.crack === 'crit') z = H * (1 - Math.sqrt(cf * Math.tan(R(psp)))); else if (r.crack === 'given' && r.zIn > 0) z = Math.min(r.zIn, zmax);
    z = SH.clamp(z, 0, Math.max(0, zmax)); var zw = r.crack === 'none' ? 0 : z * r.wf, sp = Math.sin(R(psp)), co = Math.cos(R(psp));
    var A = (H - z) / sp, W = 0.5 * r.gam * H * H * ((1 - (z / H) * (z / H)) * cp - cf); if (!(W > 0)) return null;
    var U = 0.5 * 9.81 * zw * (H - z) / sp, V = 0.5 * 9.81 * zw * zw, N = W * (co - r.kh * sp) - U - V * sp, Tq = W * (sp + r.kh * co) + V * co, Rs = r.c * A + Math.max(N, 0) * Math.tan(R(r.phi));
    return { fs: Rs / Tq, z: z, zw: zw, A: A, W: W, U: U, V: V, N: N, T: Tq, Rs: Rs, b: (H - z) * cp - H * cf, psp: psp };
  }
  function wedgeK(A, B, L) {
    var i = lineVec(L.trend, L.plunge), gp = add([0, 0, 1], mul(i, -i[2])), u = unit(mul(gp, -1));
    var a = unit(cross(i, poleVec(A.dd, A.dip))), b = unit(cross(i, poleVec(B.dd, B.dip))); if (dot(a, u) < 0) a = mul(a, -1); if (dot(b, u) < 0) b = mul(b, -1);
    var xi = D(Math.acos(SH.clamp(dot(a, b), -1, 1))), sb = SH.clamp(dot(unit(add(a, b)), u), 0, 1);
    return { xi: xi, beta: D(Math.asin(sb)), K: sb / Math.sin(R(Math.max(xi, 1) / 2)) };
  }

  /* ---------- outputs */
  var f2 = function (v) { return v == null || !isFinite(v) ? '—' : SH.fmt(v, 2); };
  var fsState = function (v) { return v == null || !isFinite(v) ? '' : v < 1 ? 'bad' : v < 1.3 ? 'warn' : 'ok'; };
  function kpi(cls2, k, v, s) { return '<div class="kpi ' + (cls2 || '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var bdi = function (s) { return '<bdi>' + s + '</bdi>'; };
  var MATH = /[A-Za-z0-9ψφξβδαγκΣ(\[|][A-Za-z0-9ψφξβδαγκΣ°′″±+\-−×()=\/·∩→≤≥<>.,%²³\[\]| ]*[A-Za-z0-9ψφξβδαγκΣ°′″)%²³\]]|[A-Za-z0-9]/g;
  function fixNode(root) {
    if (!AR) { root.innerHTML = root.innerHTML.replace(/،/g, ','); return; }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n; while ((n = w.nextNode())) if (!n.parentNode.closest('bdi')) list.push(n);
    list.forEach(function (tn) { var txt = tn.nodeValue, out = document.createDocumentFragment(), last = 0; txt.replace(MATH, function (m, off) { if (off > last) out.appendChild(document.createTextNode(txt.slice(last, off))); var b = document.createElement('bdi'); b.dir = 'ltr'; b.textContent = m; out.appendChild(b); last = off + m.length; return m; }); if (!last) return; if (last < txt.length) out.appendChild(document.createTextNode(txt.slice(last))); tn.parentNode.replaceChild(out, tn); });
  }
  function fixAll() { ['#capNet', '#capSec', '#capPlan', '#capRadar', '#capRmr', '#verdicts'].forEach(function (q) { var e = $(q); if (e) fixNode(e); }); }

  function render(r) {
    last = r; $('#sEmpty').hidden = true; $('#sOut').hidden = false;
    var rc = cls(RMRCLS, r.rmr), sc = cls(SMRCLS, r.smr), pl = r.sets.filter(function (s) { return s.planar; }), tp = r.sets.filter(function (s) { return s.topple; }), wd = r.wedges.filter(function (w) { return w.kin; });
    var modes = []; if (pl.length) modes.push(t('Planar', 'مستوٍ')); if (wd.length) modes.push(t('Wedge', 'إسفيني')); if (tp.length) modes.push(t('Toppling', 'انقلاب'));
    $('#sKpis').innerHTML = kpi(rc[5], 'RMR<sub>89</sub>', r.rmr + '<small> /100</small>', t('Class ', 'الصنف ') + rc[1] + ' · ' + rc[2]) +
      kpi(sc[5], 'SMR', SH.fmt(r.smr, 0) + '<small> /100</small>', t('Class ', 'الصنف ') + sc[1] + (r.smrCrit ? ' · ' + bdi(r.smrCrit.lbl) : '')) +
      kpi(fsState(r.crit && r.crit.le.fs), t('Planar FS', 'معامل الأمان المستوي'), r.crit ? f2(r.crit.le.fs) : '—', r.crit ? bdi(r.crit.k + ' ' + att(r.crit.dd, r.crit.dip)) : t('No daylighting plane', 'لا يوجد مستوى منكشف')) +
      kpi(fsState(r.wcrit && r.wcrit.fs), t('Wedge FS', 'معامل أمان الإسفين'), r.wcrit ? f2(r.wcrit.fs) : '—', r.wcrit ? bdi(r.wcrit.lbl + ' ' + lin(r.wcrit.L.trend, r.wcrit.L.plunge)) : t('No daylighting wedge', 'لا يوجد إسفين منكشف')) +
      kpi(modes.length ? 'bad' : 'ok', t('Kinematic test', 'الفحص الحركي'), '<span style="font-size:1rem">' + (modes.join(' · ') || t('None', 'لا يوجد')) + '</span>', modes.length ? t('Feasible failure modes', 'أنماط انهيار ممكنة') : t('Kinematically stable', 'مستقر حركياً'));
    var v = [];
    pl.forEach(function (s) { v.push(verdict(s.le && s.le.fs < 1 ? 'bad' : 'warn', t('Planar sliding on ', 'انزلاق مستوٍ على ') + s.k, bdi(att(s.dd, s.dip)) + t(': |αj − αf| = ', ': |αj − αf| = ') + Math.round(s.dA) + '° ≤ ' + r.limP + '°، φ (' + r.phi + '°) < ψj (' + Math.round(s.dip) + '°) < ψf (' + Math.round(s.fApp) + '°)' + (s.le ? '. FS = ' + f2(s.le.fs) : '') + '.')); });
    wd.forEach(function (w) { v.push(verdict(w.fs < 1 ? 'bad' : 'warn', (w.hock ? t('Single-plane sliding on ', 'انزلاق على المستوى ') + w.hock + t(' (Hocking test)', ' (اختبار Hocking)') : t('Wedge sliding on ', 'انزلاق إسفيني على ') + w.lbl), t('Line of intersection ', 'خط التقاطع ') + bdi(lin(w.L.trend, w.L.plunge)) + ': φ (' + r.phi + '°) < ψi (' + Math.round(w.L.plunge) + '°) < ψfi (' + Math.round(w.fApp) + '°). K = ' + f2(w.K) + ', FS = ' + f2(w.fs) + '.')); });
    tp.forEach(function (s) { v.push(verdict('warn', t('Flexural toppling on ', 'انقلاب انثنائي على ') + s.k, bdi(att(s.dd, s.dip)) + ': ψj (' + Math.round(s.dip) + '°) ≥ (90° − ψf) + φ = ' + Math.round(90 - r.F.dip + r.phi) + '°, |αj − (αf + 180°)| ≤ ' + r.limT + '°.')); });
    if (!v.length) v.push(verdict('ok', t('No kinematically feasible failure mode', 'لا يوجد نمط انهيار ممكن حركياً'), t('No plane or line of intersection daylights in the face steeper than φ, and no set satisfies the toppling condition.', 'لا ينكشف أي مستوى أو خط تقاطع في الوجه بميل أكبر من φ، ولا تحقق أي مجموعة شرط الانقلاب.')));
    v.push(verdict(sc[5], 'SMR = ' + SH.fmt(r.smr, 0) + ' · ' + t('class ', 'الصنف ') + sc[1] + ': ' + sc[2], t('Expected failures: ', 'الانهيارات المتوقعة: ') + sc[3] + '. ' + t('Support: ', 'التدعيم: ') + sc[4] + ' (Romana 1985).'));
    $('#verdicts').innerHTML = v.join('');
    kinTable(r); drawNet(r); drawSection(r); drawPlan(r); drawRadar(r); drawRmr(r, rc, sc); drawCol(r); summary(r, rc, sc); fixAll();
  }

  function kinTable(r) {
    var yes = function (b) { return b ? '<span class="badge bad">' + t('Feasible', 'ممكن') + '</span>' : '<span class="badge ok">' + t('Not feasible', 'غير ممكن') + '</span>'; };
    var rows = [];
    r.sets.forEach(function (s) { rows.push('<tr><td><b>' + s.k + '</b></td><td class="ltr">' + att(s.dd, s.dip) + '</td><td>' + yes(s.planar) + '</td><td>' + yes(s.topple) + '</td><td class="num">' + (s.le ? f2(s.le.fs) : '—') + '</td><td class="num">' + SH.fmt(s.smr.v, 0) + ' <span class="xsmall muted">' + (s.smr.mode === 'P' ? 'P' : 'T') + '</span></td></tr>'); });
    r.wedges.forEach(function (w) { rows.push('<tr><td><b class="ltr">' + w.key + '</b> <span class="xsmall muted ltr">' + w.lbl + '</span></td><td class="ltr">' + lin(w.L.trend, w.L.plunge) + '</td><td>' + yes(w.kin) + (w.hock ? ' <span class="xsmall">→ ' + w.hock + '</span>' : '') + '</td><td>—</td><td class="num">' + (w.fs != null ? f2(w.fs) : '—') + '</td><td class="num">' + (w.smr ? SH.fmt(w.smr.v, 0) + ' <span class="xsmall muted">W</span>' : '—') + '</td></tr>'); });
    $('#kinTable').innerHTML = '<thead><tr><th>' + t('Structure', 'التركيب') + '</th><th>' + t('Attitude', 'الوضع') + '</th><th>' + t('Sliding (planar · wedge)', 'الانزلاق (مستوٍ · إسفيني)') + '</th><th>' + t('Flexural toppling', 'الانقلاب الانثنائي') + '</th><th class="num">FS</th><th class="num">SMR</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  }

  /* ---------- SVG helpers (figures are drawn in English, on white, for print and publication) */
  function halo(S, x, y, s, a, g) { return S.text(x, y, s, Object.assign({ fill: INK, stroke: '#fff', 'stroke-width': 3.2, 'paint-order': 'stroke', 'stroke-linejoin': 'round', direction: 'ltr' }, a || {}), g); }
  function boxLabel(S, x, y, s, a) { a = a || {}; var fs = a['font-size'] || 11, w = String(s).length * fs * 0.56 + 10, anc = a['text-anchor'] || 'middle', x0 = anc === 'middle' ? x - w / 2 : anc === 'end' ? x - w : x;
    S.add('rect', { x: x0, y: y - fs - 1, width: w, height: fs + 7, rx: 3, fill: '#fff', stroke: a.box || 'none', 'stroke-width': .8 }); S.text(anc === 'middle' ? x : anc === 'end' ? x - 5 : x + 5, y + 1, s, Object.assign({ 'font-size': fs, 'text-anchor': anc, direction: 'ltr', fill: INK }, a)); }
  function frame(S, W, H) { S.add('rect', { x: 0, y: 0, width: W, height: H, fill: BG }); S.add('rect', { x: 6, y: 6, width: W - 12, height: H - 12, fill: 'none', stroke: INK, 'stroke-width': 1.1 }); }
  function northArrow(S, x, y, s, rot) { var g = S.g({ transform: 'rotate(' + (rot || 0) + ' ' + x + ' ' + (y + s * 0.6) + ')' }); S.text(x, y, 'N', { 'font-size': 13, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' }, g); S.path('M' + x + ' ' + (y + 5) + 'L' + (x - s * .26) + ' ' + (y + s) + 'L' + x + ' ' + (y + s * .8) + 'z', { fill: INK, stroke: INK }, g); S.path('M' + x + ' ' + (y + 5) + 'L' + (x + s * .26) + ' ' + (y + s) + 'L' + x + ' ' + (y + s * .8) + 'z', { fill: '#fff', stroke: INK }, g); }
  function niceLen(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; }
  function scaleBar(S, x, y, pxPerM, maxPx) { var L = niceLen(maxPx / pxPerM), w = L * pxPerM; for (var q = 0; q < 4; q++) S.add('rect', { x: x + q * w / 4, y: y, width: w / 4, height: 6, fill: q % 2 ? '#fff' : INK, stroke: INK, 'stroke-width': .7 });
    [0, 2, 4].forEach(function (q) { var vv = L * q / 4; S.text(x + q * w / 4, y + 18, SH.fmt(vv, vv % 1 ? (vv * 10 % 1 ? 2 : 1) : 0), { 'font-size': 9.5, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }); S.text(x + w + 8, y + 7, 'm', { 'font-size': 10, 'font-weight': 700, fill: INK }); return L; }
  function legendBox(S, x, y, w, items, title, rh) { rh = rh || 21; var h = 30 + items.length * rh; S.add('rect', { x: x, y: y, width: w, height: h, fill: '#fff', stroke: INK, 'stroke-width': .9 }); S.text(x + 10, y + 18, title || 'LEGEND', { 'font-size': 10.5, 'font-weight': 800, fill: INK, 'letter-spacing': 1.2 });
    items.forEach(function (it, i) { var yy = y + 36 + i * rh; it[0](x + 10, yy); S.text(x + 46, yy + 4, it[1], { 'font-size': 10, fill: INK, direction: 'ltr' }); if (it[2]) S.text(x + w - 8, yy + 4, it[2], { 'font-size': 10, fill: MUT, direction: 'rtl', 'text-anchor': 'end' }); }); return y + h; }
  var symLine = function (S, col, w, da) { return function (x, y) { S.line(x, y, x + 28, y, { stroke: col, 'stroke-width': w || 2, 'stroke-dasharray': da || null }); }; };
  var symFill = function (S, col, op) { return function (x, y) { S.add('rect', { x: x, y: y - 7, width: 28, height: 14, fill: SH.alpha(col, op || .3), stroke: col, 'stroke-width': .8 }); }; };
  var footer = function (S, H) { S.text(16, H - 14, 'Shandal System · ' + new Date().toISOString().slice(0, 10), { 'font-size': 9.5, fill: MUT, direction: 'ltr' }); };

  /* ---------- 1. stereonet */
  function drawNet(r) {
    var VW = 760, VH = 600, S = SH.svgB('svgNet'), cx = 290, cy = 312, RR = 240, mode = SH.seg('projSeg') || 'angle'; S.el.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); frame(S, VW, VH);
    var proj = function (tr, pl) { var z = R(90 - pl), rr = mode === 'area' ? RR * Math.SQRT2 * Math.sin(z / 2) : RR * Math.tan(z / 2); return [cx + rr * Math.sin(R(tr)), cy - rr * Math.cos(R(tr))]; };
    var gc = function (dd, dip) { var pts = [], s = [Math.sin(R(dd - 90)), Math.cos(R(dd - 90)), 0], dv = lineVec(dd, dip); for (var k = 0; k <= 180; k += 2) { var a = R(k); pts.push(proj.apply(null, (function (l) { return [l.trend, l.plunge]; })(vecLine([s[0] * Math.cos(a) + dv[0] * Math.sin(a), s[1] * Math.cos(a) + dv[1] * Math.sin(a), dv[2] * Math.sin(a)])))); } return pts; };
    S.text(20, 30, 'Lower hemisphere · ' + (mode === 'area' ? 'equal-area (Schmidt)' : 'equal-angle (Wulff)') + ' · n = ' + r.sets.length + ' planes', { 'font-size': 11.5, 'font-weight': 700, fill: INK, direction: 'ltr' });
    S.circle(cx, cy, RR, { fill: '#FBFAF6', stroke: 'none' });
    var G = S.g({ stroke: '#DCDFE2', 'stroke-width': .7, fill: 'none' });
    for (var d = 10; d < 90; d += 10) { S.path(S.pl(gc(90, d)), {}, G); S.path(S.pl(gc(270, d)), {}, G); }
    S.line(cx, cy - RR, cx, cy + RR, { stroke: '#BFC5CB', 'stroke-width': .8 }); S.line(cx - RR, cy, cx + RR, cy, { stroke: '#BFC5CB', 'stroke-width': .8 });
    for (var a2 = 0; a2 < 360; a2 += 10) { var l1 = a2 % 30 === 0 ? 9 : 5; S.line(cx + RR * Math.sin(R(a2)), cy - RR * Math.cos(R(a2)), cx + (RR + l1) * Math.sin(R(a2)), cy - (RR + l1) * Math.cos(R(a2)), { stroke: INK, 'stroke-width': .8 }); if (a2 % 30 === 0 && a2) S.text(cx + (RR + 22) * Math.sin(R(a2)), cy - (RR + 22) * Math.cos(R(a2)) + 4, String(a2).padStart(3, '0'), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    S.text(cx, cy - RR - 16, 'N', { 'font-size': 15, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' });
    var F = r.F, phi = r.phi;
    // wedge daylight zone (whole face envelope) and planar zone (±limit), in dip-vector space
    var crescent = function (lim) { var z = [], k; for (k = -lim; k <= lim; k += 2) z.push(proj(F.dd + k, phi)); for (k = lim; k >= -lim; k -= 2) z.push(proj(F.dd + k, Math.max(phi, appDip(F.dip, F.dd, F.dd + k)))); return z; };
    if (F.dip > phi) { S.poly(crescent(88), { fill: SH.alpha(COL.zone, .12), stroke: 'none' }); S.poly(crescent(r.limP), { fill: SH.alpha(COL.crit, .16), stroke: COL.crit, 'stroke-width': .9, 'stroke-dasharray': '4 3' }); }
    // flexural toppling zone (dip vectors toward the face-opposite direction, plunge ≥ 90 − ψf + φ)
    var tpMin = 90 - F.dip + phi; if (tpMin < 90) { var tz = [proj(0, 90)]; for (var k3 = -r.limT; k3 <= r.limT; k3 += 2) tz.push(proj(F.dd + 180 + k3, tpMin)); S.poly(tz, { fill: SH.alpha(COL.S0, .15), stroke: COL.S0, 'stroke-width': .9, 'stroke-dasharray': '4 3' }); }
    var fr = []; for (var k2 = 0; k2 <= 360; k2 += 3) fr.push(proj(k2, phi)); S.path(S.pl(fr) + 'Z', { fill: 'none', stroke: COL.fr, 'stroke-width': 1.5, 'stroke-dasharray': '7 4' });
    S.path(S.pl(gc(F.dd, F.dip)), { fill: 'none', stroke: COL.F, 'stroke-width': 2.6 });
    r.sets.forEach(function (s) { S.path(S.pl(gc(s.dd, s.dip)), { fill: 'none', stroke: COL[s.k], 'stroke-width': 2.1 }); });
    var labels = [];
    var put = function (x, y, s, col) { var w = s.length * 7 + 4, cand = [[9, -8], [9, 14], [-9 - w, -8], [-9 - w, 14], [9, -22], [-9 - w, -22], [9, 28], [-9 - w, 28], [-w / 2, -16], [-w / 2, 24]], best = cand[0];
      for (var i = 0; i < cand.length; i++) { var bx = x + cand[i][0], by = y + cand[i][1], hit = labels.some(function (q) { return bx < q[0] + q[2] && bx + w > q[0] && by - 11 < q[1] && by + 2 > q[1] - 11; }); if (!hit) { best = cand[i]; break; } }
      labels.push([x + best[0], y + best[1], w]); halo(S, x + best[0], y + best[1], s, { 'font-size': 11, 'font-weight': 800, fill: col }); };
    r.sets.forEach(function (s) { var q = proj(s.dd + 180, 90 - s.dip); S.circle(q[0], q[1], 5, { fill: COL[s.k], stroke: '#fff', 'stroke-width': 1.3 }); put(q[0], q[1], 'P' + s.k, COL[s.k]);
      var dv = proj(s.dd, s.dip); S.path('M' + (dv[0] - 4.5) + ' ' + (dv[1] - 4.5) + 'L' + (dv[0] + 4.5) + ' ' + (dv[1] + 4.5) + 'M' + (dv[0] + 4.5) + ' ' + (dv[1] - 4.5) + 'L' + (dv[0] - 4.5) + ' ' + (dv[1] + 4.5), { stroke: COL[s.k], 'stroke-width': 2 }); });
    var pf = proj(F.dd + 180, 90 - F.dip); S.circle(pf[0], pf[1], 5, { fill: INK }); put(pf[0], pf[1], 'PF', INK);
    r.wedges.forEach(function (w) { var I = proj(w.L.trend, w.L.plunge); S.circle(I[0], I[1], 6.5, { fill: '#fff', stroke: w.kin ? COL.crit : MUT, 'stroke-width': 2.2 }); put(I[0], I[1], w.key, w.kin ? COL.crit : MUT); });
    S.circle(cx, cy, RR, { fill: 'none', stroke: INK, 'stroke-width': 1.8 });
    var items = [[symLine(S, INK, 2.6), 'Slope face ' + att(F.dd, F.dip)]];
    r.sets.forEach(function (s) { items.push([symLine(S, COL[s.k], 2.1), s.k + ' ' + att(s.dd, s.dip)]); });
    items.push([symLine(S, COL.fr, 1.5, '7 4'), 'Friction cone φ = ' + phi + '°'], [symFill(S, COL.crit, .25), 'Planar zone ±' + r.limP + '°'], [symFill(S, COL.zone, .2), 'Wedge zone (daylight)'], [symFill(S, COL.S0, .2), 'Toppling zone ±' + r.limT + '°'],
      [function (x, y) { S.circle(x + 14, y, 4.5, { fill: INK }); }, 'Pole (P)'], [function (x, y) { S.path('M' + (x + 10) + ' ' + (y - 4) + 'l8 8m0 -8l-8 8', { stroke: INK, 'stroke-width': 2 }); }, 'Dip vector'], [function (x, y) { S.circle(x + 14, y, 5.5, { fill: '#fff', stroke: COL.crit, 'stroke-width': 2 }); }, 'Intersection (I)']);
    legendBox(S, 560, 54, 186, items); footer(S, VH);
    var crit = r.sets.filter(function (s) { return s.planar; }).map(function (s) { return s.k; }), wk = r.wedges.filter(function (w) { return w.kin; }).map(function (w) { return w.key; }), tk = r.sets.filter(function (s) { return s.topple; }).map(function (s) { return s.k; });
    $('#capNet').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('slope face ', 'وجه المنحدر ') + bdi(att(F.dd, F.dip)) + '، ' + r.sets.map(function (s) { return s.k + ' ' + bdi(att(s.dd, s.dip)); }).join('، ') + '، φ = ' + phi + '°. ' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('dip vectors inside the red crescent → planar sliding: ', 'متجهات الميل داخل الهلال الأحمر ← انزلاق مستوٍ: ') + (crit.join('، ') || '—') + '; ' + t('intersections inside the daylight envelope and outside the friction cone → wedge sliding: ', 'خطوط التقاطع داخل غلاف الانكشاف وخارج مخروط الاحتكاك ← انزلاق إسفيني: ') + (wk.join('، ') || '—') + '; ' + t('dip vectors in the purple sector → flexural toppling: ', 'متجهات الميل في القطاع البنفسجي ← انقلاب انثنائي: ') + (tk.join('، ') || '—') + '. ' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (crit.length || wk.length || tk.length ? t('the structural geometry of the face permits ', 'تسمح الهندسة التركيبية للوجه بحدوث ') + [crit.length ? t('planar', 'الانزلاق المستوي') : '', wk.length ? t('wedge', 'الانزلاق الإسفيني') : '', tk.length ? t('toppling', 'الانقلاب') : ''].filter(Boolean).join(AR ? ' و' : ' and ') + t(' failure; limit-equilibrium factors of safety are given in the table above.', '؛ وترد معاملات الأمان بطريقة التوازن الحدّي في الجدول أعلاه.') : t('no discontinuity or intersection is kinematically free to move out of the face under the measured friction angle.', 'لا يوجد انقطاع أو خط تقاطع حرّ الحركة خارج الوجه تحت زاوية الاحتكاك المقاسة.'));
  }

  /* ---------- 2. section and forces */
  function drawSection(r) {
    var VW = 760, VH = 520, S = SH.svgB('svgSec'), F = r.F, s0 = r.crit || r.sets[0], le = r.crit ? r.crit.le : null; S.el.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); frame(S, VW, VH);
    var H = r.H > 0 ? r.H : 10, psf = R(F.dip), psp = R(s0.dip), cf = 1 / Math.tan(psf), cp = s0.dip > 0.5 ? 1 / Math.tan(psp) : 1e3;
    var xCrest = H * cf, xTop = Math.min(H * cp, xCrest + 6 * H), z = le ? le.z : 0, xc = le ? (H - z) * cp : xTop;
    var x0 = -0.35 * H, x1 = Math.max(xc, xCrest) + 0.45 * H, y0 = -0.45 * H, y1 = H * 1.18;
    var MX = 34, MY = 66, AW = 440, AH = 380, sc = Math.min(AW / (x1 - x0), AH / (y1 - y0)), ox = MX + (AW - (x1 - x0) * sc) / 2 - x0 * sc, oy = MY + AH - (0 - y0) * sc;
    var X = function (x) { return ox + x * sc; }, Y = function (y) { return oy - y * sc; };
    S.text(20, 30, 'Section along the slope dip direction ' + p3(F.dd) + '° · scale 1:1 (no vertical exaggeration)', { 'font-size': 11.5, 'font-weight': 700, fill: INK, direction: 'ltr' });
    var clip = S.add('clipPath', { id: 'secClip' }, null, S.add('defs', {})); S.add('rect', { x: MX, y: MY, width: AW, height: AH }, null, clip); var g = S.g({ 'clip-path': 'url(#secClip)' });
    S.poly([[X(x0 - 50), Y(0)], [X(0), Y(0)], [X(xCrest), Y(H)], [X(x1 + 50), Y(H)], [X(x1 + 50), Y(y0 - 50)], [X(x0 - 50), Y(y0 - 50)]], { fill: '#EFE9DB', stroke: 'none' }, g);
    for (var k = -12; k <= 12; k++) { var bx = k * H * 0.22; S.line(X(bx - 3 * H * cp / 2), Y(-3 * H / 2), X(bx + 3 * H * cp / 2), Y(3 * H / 2), { stroke: '#D9CFB8', 'stroke-width': .8 }, g); }
    S.path(S.pl([[X(x0 - 50), Y(0)], [X(0), Y(0)], [X(xCrest), Y(H)], [X(x1 + 50), Y(H)]]), { fill: 'none', stroke: INK, 'stroke-width': 2.2 }, g);
    if (le) {
      var blk = [[X(0), Y(0)], [X(xCrest), Y(H)], [X(xc), Y(H)], [X(xc), Y(H - z)]]; S.poly(blk, { fill: SH.alpha(COL.crit, .28), stroke: COL.crit, 'stroke-width': 1.6 }, g);
      if (z > 0) { S.line(X(xc), Y(H), X(xc), Y(H - z), { stroke: INK, 'stroke-width': 2.6 }, g); if (le.zw > 0) S.add('rect', { x: X(xc) - 3, y: Y(H - z + le.zw), width: 6, height: le.zw * sc, fill: COL.water }, null, g); }
    }
    S.line(X(-0.3 * H), Y(-0.3 * H * Math.tan(psp)), X(Math.min(x1 + 50, xTop + H)), Y(Math.min(x1 + 50, xTop + H) * Math.tan(psp)), { stroke: COL[s0.k], 'stroke-width': 2.4 }, g);
    S.add('rect', { x: MX, y: MY, width: AW, height: AH, fill: 'none', stroke: INK, 'stroke-width': 1 });
    // angles at the toe
    var arc = function (rad, a1, col) { return S.path('M' + (X(0) + rad) + ' ' + Y(0) + ' A' + rad + ' ' + rad + ' 0 0 0 ' + (X(0) + rad * Math.cos(a1)) + ' ' + (Y(0) - rad * Math.sin(a1)), { fill: 'none', stroke: col, 'stroke-width': 1.4 }); };
    S.line(X(0), Y(0), X(0) + 150, Y(0), { stroke: MUT, 'stroke-width': .8, 'stroke-dasharray': '4 3' });
    var rp = 112, rf = 62; arc(rp, psp, COL[s0.k]); arc(rf, psf, INK);
    var lp = [X(0) + (rp + 14) * Math.cos(psp / 2), Y(0) - (rp + 14) * Math.sin(psp / 2)]; boxLabel(S, lp[0] + 26, lp[1] + 4, 'ψp = ' + Math.round(s0.dip) + '°', { 'font-size': 11, 'font-weight': 700, fill: COL[s0.k], 'text-anchor': 'start', box: COL[s0.k] });
    var lf = [X(0) + (rf + 10) * Math.cos(psf * 0.62), Y(0) - (rf + 10) * Math.sin(psf * 0.62)]; boxLabel(S, lf[0] - 4, lf[1] - 12, 'ψf = ' + Math.round(F.dip) + '°', { 'font-size': 11, 'font-weight': 700, 'text-anchor': 'end', box: INK });
    // dimensions: H and z, crack distance b
    var dimV = function (x, ya, yb, s) { S.line(x, ya, x, yb, { stroke: INK, 'stroke-width': .9 }); S.line(x - 5, ya, x + 5, ya, { stroke: INK }); S.line(x - 5, yb, x + 5, yb, { stroke: INK }); boxLabel(S, x, (ya + yb) / 2 + 4, s, { 'font-size': 10.5, 'font-weight': 700 }); };
    dimV(X(x0) + 26, Y(0), Y(H), 'H = ' + SH.fmt(H, 1) + ' m');
    if (le && z > 0) { dimV(Math.min(X(xc) + 28, MX + AW - 30), Y(H), Y(H - z), 'z = ' + SH.fmt(z, 1) + ' m'); var yb = Y(H) - 14; S.line(X(xCrest), yb, X(xc), yb, { stroke: INK, 'stroke-width': .9 }); S.line(X(xCrest), yb - 5, X(xCrest), yb + 5, { stroke: INK }); S.line(X(xc), yb - 5, X(xc), yb + 5, { stroke: INK }); boxLabel(S, (X(xCrest) + X(xc)) / 2, yb - 6, 'b = ' + SH.fmt(le.b, 1) + ' m', { 'font-size': 10 }); }
    // azimuths at both ends
    S.text(MX + 4, MY + AH + 18, SH.dir16(F.dd) + ' ' + p3(F.dd) + '°', { 'font-size': 11, 'font-weight': 800, fill: INK, direction: 'ltr' }); S.text(MX + AW - 4, MY + AH + 18, SH.dir16(F.dd + 180) + ' ' + p3(F.dd + 180) + '°', { 'font-size': 11, 'font-weight': 800, fill: INK, 'text-anchor': 'end', direction: 'ltr' });
    scaleBar(S, MX + 150, MY + AH + 12, sc, 120);
    // force diagram inset (enlarged, not to the section scale)
    var IX = 494, IY = 66, IW = 250, IH = 250; S.add('rect', { x: IX, y: IY, width: IW, height: IH, fill: '#fff', stroke: INK, 'stroke-width': 1 }); S.text(IX + 10, IY + 18, 'FORCES ON THE BLOCK (per m run)', { 'font-size': 10, 'font-weight': 800, fill: INK, 'letter-spacing': .6, direction: 'ltr' });
    var gx = IX + IW / 2 + 6, gy = IY + IH / 2 + 4, Lm = 74;
    S.line(gx - 110 * Math.cos(psp), gy + 34 + 110 * Math.sin(psp), gx + 110 * Math.cos(psp), gy + 34 - 110 * Math.sin(psp), { stroke: COL[s0.k], 'stroke-width': 2 });
    var bw = 54, bh = 30, bxp = gx, byp = gy + 34; var tx = [Math.cos(psp), -Math.sin(psp)], nx2 = [-Math.sin(psp), -Math.cos(psp)];
    S.poly([[bxp - tx[0] * bw / 2, byp - tx[1] * bw / 2], [bxp + tx[0] * bw / 2, byp + tx[1] * bw / 2], [bxp + tx[0] * bw / 2 + nx2[0] * bh, byp + tx[1] * bw / 2 + nx2[1] * bh], [bxp - tx[0] * bw / 2 + nx2[0] * bh, byp - tx[1] * bw / 2 + nx2[1] * bh]], { fill: SH.alpha(COL.crit, .25), stroke: COL.crit, 'stroke-width': 1.2 });
    var cxp = bxp + nx2[0] * bh / 2, cyp = byp + nx2[1] * bh / 2; S.circle(cxp, cyp, 3, { fill: INK });
    var Wv = le ? le.W : 1, scl = function (v) { return Lm * Math.max(0.25, Math.min(1.2, v / Wv)); };
    S.arrow(cxp, cyp, cxp, cyp + Lm, '#2E7D5B', 2.4, ''); halo(S, cxp + 10, cyp + Lm, 'W', { 'font-size': 12, 'font-weight': 800, fill: '#2E7D5B' });
    S.arrow(cxp, cyp, cxp - nx2[0] * Lm * Math.cos(psp), cyp - nx2[1] * Lm * Math.cos(psp), '#4B63B5', 1.8, ''); halo(S, cxp - nx2[0] * Lm * Math.cos(psp) + 12, cyp - nx2[1] * Lm * Math.cos(psp) + 4, 'W cosψp', { 'font-size': 10.5, 'font-weight': 700, fill: '#4B63B5' });
    S.arrow(cxp, cyp, cxp - tx[0] * Lm * Math.sin(psp), cyp - tx[1] * Lm * Math.sin(psp), COL.crit, 1.8, ''); halo(S, cxp - tx[0] * Lm * Math.sin(psp) - 6, cyp - tx[1] * Lm * Math.sin(psp) - 8, 'W sinψp', { 'font-size': 10.5, 'font-weight': 700, fill: COL.crit, 'text-anchor': 'end' });
    if (le && le.U > 0) { var ux0 = bxp - tx[0] * 18, uy0 = byp - tx[1] * 18, ul = Math.max(26, scl(le.U) * .6); S.arrow(ux0 - nx2[0] * ul, uy0 - nx2[1] * ul, ux0, uy0, COL.water, 1.8, ''); halo(S, ux0 - nx2[0] * ul - 4, uy0 - nx2[1] * ul + 14, 'U', { 'font-size': 11, 'font-weight': 800, fill: COL.water }); }
    if (le && le.V > 0) { var vx = bxp + tx[0] * bw / 2 + nx2[0] * bh / 2 + 34, vy = byp + tx[1] * bw / 2 + nx2[1] * bh / 2; S.arrow(vx, vy, vx - 30, vy, COL.water, 1.8, ''); halo(S, vx + 6, vy + 4, 'V', { 'font-size': 11, 'font-weight': 800, fill: COL.water }); }
    if (r.kh > 0) { S.arrow(cxp, cyp, cxp - 40, cyp, '#9C4D9A', 1.6, ''); halo(S, cxp - 46, cyp - 6, 'kh·W', { 'font-size': 10, 'font-weight': 700, fill: '#9C4D9A', 'text-anchor': 'end' }); }
    S.path('M' + cxp + ' ' + (cyp + 30) + ' A30 30 0 0 ' + (1) + ' ' + (cxp - nx2[0] * 30) + ' ' + (cyp - nx2[1] * 30), { fill: 'none', stroke: MUT, 'stroke-width': .9 });
    halo(S, cxp + 26, cyp + 30, 'ψp', { 'font-size': 10, fill: MUT });
    var rows = le ? [['W', SH.fmt(le.W, 0) + ' kN/m'], ['U', SH.fmt(le.U, 0) + ' kN/m'], ['V', SH.fmt(le.V, 0) + ' kN/m'], ['A', SH.fmt(le.A, 2) + ' m²/m'], ['ΣR (resisting)', SH.fmt(le.Rs, 0) + ' kN/m'], ['ΣD (driving)', SH.fmt(le.T, 0) + ' kN/m'], ['FS = ΣR / ΣD', f2(le.fs)]] : [['FS', '—']];
    var ty = IY + IH + 24; S.add('rect', { x: IX, y: IY + IH + 8, width: IW, height: rows.length * 18 + 12, fill: '#fff', stroke: INK, 'stroke-width': 1 });
    rows.forEach(function (rw, i) { S.text(IX + 10, ty + i * 18, rw[0], { 'font-size': 10.5, fill: MUT, direction: 'ltr' }); S.text(IX + IW - 10, ty + i * 18, rw[1], { 'font-size': 10.5, 'font-weight': 800, fill: i === rows.length - 1 ? COL.crit : INK, 'text-anchor': 'end', direction: 'ltr' }); });
    footer(S, VH);
    var crackTxt = r.crack === 'none' ? t('no tension crack', 'دون شق شد') : t('tension crack depth z = ', 'عمق شق الشد z = ') + (le ? SH.fmt(le.z, 2) : '—') + ' m' + (r.crack === 'crit' ? t(' (critical depth)', ' (العمق الحرج)') : '') + t(', water depth zw = ', '، وعمق الماء zw = ') + (le ? SH.fmt(le.zw, 2) : '—') + ' m';
    $('#capSec').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + 'H = ' + SH.fmt(H, 1) + ' m، ψf = ' + F.dip + '°، ψp (' + s0.k + ') = ' + Math.round(s0.dip) + '°، γ = ' + r.gam + ' kN/m³، c = ' + r.c + ' kPa، φ = ' + r.phi + '°، kh = ' + r.kh + '، ' + crackTxt + '. ' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + (le ? 'W = ' + SH.fmt(le.W, 0) + ' kN/m، U = ' + SH.fmt(le.U, 0) + ' kN/m، V = ' + SH.fmt(le.V, 0) + ' kN/m، FS = ' + bdi('[cA + (W(cosψp − kh sinψp) − U − V sinψp) tanφ] / [W(sinψp + kh cosψp) + V cosψp]') + ' = <b>' + f2(le.fs) + '</b>. ' : t('the plane does not daylight in the face, so no block is released.', 'المستوى لا ينكشف في الوجه، فلا تتحرر كتلة.') + ' ') +
      (le ? '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (le.fs < 1 ? t('the driving forces exceed the available shear resistance on ', 'القوى الدافعة تتجاوز مقاومة القص المتاحة على ') + s0.k + t('; the block is in a state of limiting failure.', '؛ والكتلة في حالة انهيار حدّي.') : le.fs < 1.3 ? t('the margin of safety is below the 1.3 commonly required for permanent rock cuts.', 'هامش الأمان أقل من 1.3 المعتمد عادة للقطوع الصخرية الدائمة.') : t('the block is stable with an adequate margin for permanent rock cuts (FS ≥ 1.3).', 'الكتلة مستقرة بهامش كافٍ للقطوع الصخرية الدائمة (FS ≥ 1.3).')) : '');
  }

  /* ---------- 3. geological plan and section A–A′ */
  function drawPlan(r) {
    var VW = 760, VH = 640, S = SH.svgB('svgPlan'), defs = S.add('defs', {}); S.el.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); frame(S, VW, VH);
    var P = r.S0 || r.sets[0], isBed = !!r.S0, dip = SH.clamp(P.dip, 2, 88), dd = P.dd, sd = Math.sin(R(dip));
    var beds = isBed && $('#useCol').checked ? colBeds().slice().reverse().map(function (b) { var k = ST.R[b.rock]; return { th: b.th, col: k[2], nm: k[0], pat: k[3] }; }) : null;
    var units = beds && beds.length ? beds : null, sp = isBed ? (r.H > 0 ? r.H / 4 : 5) : r.spc;
    var BX = 34, BY = 50, BW = 520, BH = 290, SY = 392, SHh = 200;
    var ux = Math.sin(R(dd)), uy = -Math.cos(R(dd)), Lu = Math.abs(ux) * BW + Math.abs(uy) * BH;
    var widths = units ? units.map(function (u) { return u.th / sd; }) : null, Wt = units ? widths.reduce(function (a, b) { return a + b; }, 0) : sp / sd * 6;
    var sc = 0.75 * Lu / Wt, mx = BX + BW / 2, my = BY + BH / 2;
    S.text(20, 30, (isBed ? 'Geological plan of bedding S0 ' : 'Structural plan of joint set ' + P.k + ' ') + att(dd, dip) + ' and section A–A′ (perpendicular to strike)', { 'font-size': 11.5, 'font-weight': 700, fill: INK, direction: 'ltr' });
    var cp = S.add('clipPath', { id: 'plClip' }, null, defs); S.add('rect', { x: BX, y: BY, width: BW, height: BH }, null, cp); var g = S.g({ 'clip-path': 'url(#plClip)' });
    var cs = S.add('clipPath', { id: 'scClip' }, null, defs); S.add('rect', { x: BX, y: SY, width: BW, height: SHh }, null, cs); var g2 = S.g({ 'clip-path': 'url(#scClip)' });
    var band = function (s0, s1, fill, grp, pat) { var a = [mx + ux * s0 * sc, my + uy * s0 * sc], b = [mx + ux * s1 * sc, my + uy * s1 * sc], vx = -uy * 900, vy = ux * 900; S.poly([[a[0] - vx, a[1] - vy], [a[0] + vx, a[1] + vy], [b[0] + vx, b[1] + vy], [b[0] - vx, b[1] - vy]], { fill: fill, stroke: INK, 'stroke-width': .7 }, grp); if (pat) S.poly([[a[0] - vx, a[1] - vy], [a[0] + vx, a[1] + vy], [b[0] + vx, b[1] + vy], [b[0] - vx, b[1] - vy]], { fill: pat, stroke: 'none' }, grp); };
    var sx0 = BX + BW / 2, sSc = sc, half = BW / 2 / sSc;
    var secBand = function (s0, s1, fill, pat) { var dx = SHh / sSc / Math.tan(R(dip)); var p = [[sx0 + s0 * sSc, SY], [sx0 + s1 * sSc, SY], [sx0 + (s1 + dx) * sSc, SY + SHh], [sx0 + (s0 + dx) * sSc, SY + SHh]]; S.poly(p, { fill: fill, stroke: INK, 'stroke-width': .7 }, g2); if (pat) S.poly(p, { fill: pat, stroke: 'none' }, g2); };
    var bnds = [];
    if (units) {
      var s = -Wt / 2; units.forEach(function (u, i) { var id = 'pp' + i; ST.pattern(S, defs, id, u.pat); var e0 = i === 0 ? -1e4 : s, e1 = i === units.length - 1 ? 1e4 : s + widths[i]; band(e0, e1, u.col, g, 'url(#' + id + ')'); secBand(e0, e1, u.col, 'url(#' + id + ')'); u.s0 = s; u.s1 = s + widths[i]; bnds.push(s); s += widths[i]; }); bnds.push(s);
    } else {
      var w0 = sp / sd, n = Math.ceil(Lu / (w0 * sc)) + 2; band(-1e4, 1e4, isBed ? '#EFE6CC' : '#F3F1EC', g); secBand(-1e4, 1e4, isBed ? '#EFE6CC' : '#F3F1EC');
      for (var k = -n; k <= n; k++) { var q = k * w0, a = [mx + ux * q * sc, my + uy * q * sc]; S.line(a[0] + uy * 900, a[1] - ux * 900, a[0] - uy * 900, a[1] + ux * 900, { stroke: isBed ? INK : COL[P.k], 'stroke-width': isBed ? .8 : 1.2 }, g); var dx2 = SHh / sSc / Math.tan(R(dip)); S.line(sx0 + q * sSc, SY, sx0 + (q + dx2) * sSc, SY + SHh, { stroke: isBed ? INK : COL[P.k], 'stroke-width': isBed ? .8 : 1.2 }, g2); bnds.push(q); }
    }
    S.add('rect', { x: BX, y: BY, width: BW, height: BH, fill: 'none', stroke: INK, 'stroke-width': 1.2 }); S.add('rect', { x: BX, y: SY, width: BW, height: SHh, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
    // section line A–A′ on the plan
    var A1 = [mx - ux * 1000, my - uy * 1000], A2 = [mx + ux * 1000, my + uy * 1000], clipL = function (p, q) { var tmin = 0, tmax = 1, dxl = q[0] - p[0], dyl = q[1] - p[1]; [[-dxl, p[0] - BX], [dxl, BX + BW - p[0]], [-dyl, p[1] - BY], [dyl, BY + BH - p[1]]].forEach(function (c) { if (c[0] === 0) return; var tt = c[1] / c[0]; if (c[0] < 0) tmin = Math.max(tmin, tt); else tmax = Math.min(tmax, tt); }); return [[p[0] + dxl * tmin, p[1] + dyl * tmin], [p[0] + dxl * tmax, p[1] + dyl * tmax]]; };
    var sl = clipL(A1, A2); S.line(sl[0][0], sl[0][1], sl[1][0], sl[1][1], { stroke: '#2A8FB8', 'stroke-width': 1.6, 'stroke-dasharray': '8 4' });
    halo(S, sl[0][0] + (sl[0][0] < mx ? 10 : -10), sl[0][1] + (sl[0][1] < my ? 16 : -8), 'A', { 'font-size': 13, 'font-weight': 800, fill: '#2A8FB8', 'text-anchor': 'middle' }); halo(S, sl[1][0] + (sl[1][0] < mx ? 12 : -12), sl[1][1] + (sl[1][1] < my ? 16 : -8), 'A′', { 'font-size': 13, 'font-weight': 800, fill: '#2A8FB8', 'text-anchor': 'middle' });
    // strike-and-dip symbol placed on a contact, off the section line
    var off = 0.28 * Math.min(BW, BH), sxy = [mx - uy * off, my + ux * off]; if (sxy[0] < BX + 40 || sxy[0] > BX + BW - 40 || sxy[1] < BY + 30 || sxy[1] > BY + BH - 30) sxy = [mx + uy * off, my - ux * off];
    S.line(sxy[0] + uy * 24, sxy[1] - ux * 24, sxy[0] - uy * 24, sxy[1] + ux * 24, { stroke: INK, 'stroke-width': 3 }); S.line(sxy[0], sxy[1], sxy[0] + ux * 11, sxy[1] + uy * 11, { stroke: INK, 'stroke-width': 3 });
    boxLabel(S, sxy[0] + ux * 30, sxy[1] + uy * 30 + 4, String(Math.round(dip)), { 'font-size': 12, 'font-weight': 800, box: INK });
    // section annotations: dip angle, true thickness and outcrop width
    S.text(BX + 4, SY - 8, 'A  ' + SH.dir16(dd + 180) + ' ' + p3(dd + 180) + '°', { 'font-size': 11, 'font-weight': 800, fill: '#2A8FB8', direction: 'ltr' }); S.text(BX + BW - 4, SY - 8, SH.dir16(dd) + ' ' + p3(dd) + '°  A′', { 'font-size': 11, 'font-weight': 800, fill: '#2A8FB8', 'text-anchor': 'end', direction: 'ltr' });
    var pick = units ? units.reduce(function (m, u) { return !m || Math.abs(u.s0 + u.s1) < Math.abs(m.s0 + m.s1) ? u : m; }, null) : { s0: 0, s1: sp / sd, th: sp }, bxA = sx0 + pick.s0 * sSc, bxB = sx0 + pick.s1 * sSc;
    if (bxA > BX && bxB < BX + BW) {
      var rr = 72; S.path('M' + (bxA + rr) + ' ' + SY + ' A' + rr + ' ' + rr + ' 0 0 1 ' + (bxA + rr * Math.cos(R(dip))) + ' ' + (SY + rr * Math.sin(R(dip))), { fill: 'none', stroke: COL.crit, 'stroke-width': 1.4 });
      boxLabel(S, bxA + rr + 22, SY + 26, 'δ = ' + Math.round(dip) + '°', { 'font-size': 10.5, 'font-weight': 700, fill: COL.crit, 'text-anchor': 'start', box: COL.crit });
      var th = pick.th, f0 = [bxB, SY], f1 = [bxB - th * sSc * Math.sin(R(dip)), SY + th * sSc * Math.cos(R(dip))];
      if (th * sSc > 12) { S.line(f0[0], f0[1], f1[0], f1[1], { stroke: '#2E7D5B', 'stroke-width': 2, 'stroke-dasharray': '4 3' }); boxLabel(S, (f0[0] + f1[0]) / 2 + 30, (f0[1] + f1[1]) / 2 + 26, 't = ' + SH.fmt(th, 2) + ' m', { 'font-size': 10.5, 'font-weight': 700, fill: '#2E7D5B', box: '#2E7D5B' }); }
      var wy = SY - 30; S.line(bxA, wy, bxB, wy, { stroke: INK, 'stroke-width': .9 }); S.line(bxA, wy - 5, bxA, SY, { stroke: INK, 'stroke-width': .6 }); S.line(bxB, wy - 5, bxB, SY, { stroke: INK, 'stroke-width': .6 });
      boxLabel(S, (bxA + bxB) / 2, wy - 6, 'w = t / sin δ = ' + SH.fmt(th / sd, 2) + ' m', { 'font-size': 10 });
    }
    // side panel: north arrow, legend, scale
    var PX = 572, PW = 174; S.add('rect', { x: PX, y: BY, width: PW, height: SY + SHh - BY, fill: '#fff', stroke: INK, 'stroke-width': 1 });
    northArrow(S, PX + PW / 2, BY + 22, 46); S.line(PX, BY + 84, PX + PW, BY + 84, { stroke: INK, 'stroke-width': .7 });
    S.text(PX + 10, BY + 104, 'LEGEND', { 'font-size': 10.5, 'font-weight': 800, fill: INK, 'letter-spacing': 1.2 }); var ly = BY + 124;
    (units ? units.slice().reverse() : [{ col: isBed ? '#EFE6CC' : '#F3F1EC', nm: isBed ? 'Bedded unit (t = ' + SH.fmt(sp, 1) + ' m)' : P.k + ' trace (S = ' + SH.fmt(sp, 2) + ' m)' }]).slice(0, 8).forEach(function (u, i) { S.add('rect', { x: PX + 10, y: ly - 8, width: 24, height: 14, fill: u.col, stroke: INK, 'stroke-width': .6 }); S.text(PX + 42, ly + 3, (units ? (i + 1) + '. ' : '') + u.nm, { 'font-size': 9.5, fill: INK, direction: 'ltr' }); ly += 20; });
    S.line(PX + 10, ly, PX + 34, ly, { stroke: INK, 'stroke-width': 3 }); S.line(PX + 22, ly, PX + 22, ly + 7, { stroke: INK, 'stroke-width': 3 }); S.text(PX + 42, ly + 4, 'Strike and dip', { 'font-size': 9.5, fill: INK, direction: 'ltr' }); ly += 20;
    S.line(PX + 10, ly, PX + 34, ly, { stroke: '#2A8FB8', 'stroke-width': 1.6, 'stroke-dasharray': '6 3' }); S.text(PX + 42, ly + 4, 'Section line A–A′', { 'font-size': 9.5, fill: INK, direction: 'ltr' }); ly += 20;
    S.line(PX, ly, PX + PW, ly, { stroke: INK, 'stroke-width': .7 }); ly += 20; S.text(PX + 10, ly, 'SCALE (plan and section)', { 'font-size': 10, 'font-weight': 800, fill: INK, direction: 'ltr' }); scaleBar(S, PX + 14, ly + 12, sc, PW - 60);
    S.text(PX + 10, ly + 52, 'Vertical exaggeration 1.0', { 'font-size': 9.5, fill: MUT, direction: 'ltr' });
    footer(S, VH);
    $('#capPlan').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + (isBed ? t('bedding S0 ', 'التطبق S0 ') : t('joint set ', 'مجموعة الفواصل ') + P.k + ' ') + bdi(att(dd, dip)) + t(' (strike ', ' (المضرب ') + p3(strikeOf(dd)) + '°)' + (units ? t(', bed thicknesses from the logged column', '، وسماكات الطبقات من العمود الموثّق') : isBed ? t(', uniform bed thickness t = ', '، بسمك طبقي منتظم t = ') + SH.fmt(sp, 2) + ' m' : t(', mean spacing S = ', '، بتباعد متوسط S = ') + SH.fmt(sp, 2) + ' m') + '. ' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('outcrop pattern on a horizontal surface and the section perpendicular to strike at the same scale; the outcrop width of a layer of true thickness t is w = t / sin δ = ', 'نمط التكشف على سطح أفقي والمقطع العمودي على المضرب بالمقياس نفسه؛ عرض التكشف لطبقة سمكها الحقيقي t هو w = t / sin δ = ') + SH.fmt(1 / sd, 2) + ' t. ' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (isBed ? t('beds young toward ', 'تحدث الطبقات نحو ') + SH.dir16(dd) + ' (' + p3(dd) + '°)' + t('; the face at ', '؛ والوجه باتجاه ') + p3(r.F.dd) + '°' + (angDiff(dd, r.F.dd) <= 90 ? t(' cuts the bedding in a dip-slope (unfavourable) orientation.', ' يقطع التطبق بوضع منحدر الميل (غير ملائم).') : t(' cuts the bedding in an anti-dip (favourable for sliding) orientation.', ' يقطع التطبق بوضع معاكس للميل (ملائم ضد الانزلاق).')) : t('the traces show how the joint set intersects the ground surface and the section.', 'تبين الآثار تقاطع مجموعة الفواصل مع سطح الأرض والمقطع.'));
  }

  /* ---------- 4. directional hazard radar */
  function drawRadar(r) {
    var VW = 760, VH = 560, S = SH.svgB('svgRadar'), cx = 290, cy = 292, RR = 206, F = r.F; S.el.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); frame(S, VW, VH);
    var bi = function (en, ar) { return AR ? en + ' · ' + ar : en; };
    S.text(20, 30, 'Plan view of the slope crest · arrow length ∝ dip', { 'font-size': 11.5, 'font-weight': 700, fill: INK, direction: 'ltr' }); if (AR) S.text(20, 48, 'منظر علوي لقمة المنحدر · طول السهم يتناسب مع الميل', { 'font-size': 11, fill: MUT, direction: 'rtl', 'text-anchor': 'end' });
    S.circle(cx, cy, RR, { fill: '#FBFAF6', stroke: INK, 'stroke-width': 1.4 }); [30, 60].forEach(function (d) { S.circle(cx, cy, RR * d / 90, { fill: 'none', stroke: GRID, 'stroke-dasharray': '3 3' }); halo(S, cx + 4, cy - RR * d / 90 - 3, d + '°', { 'font-size': 9.5, fill: MUT }); });
    var sector = function (center, hf, col, op) { var a0 = R(center - hf), a1 = R(center + hf); S.path('M' + cx + ' ' + cy + 'L' + (cx + RR * Math.sin(a0)) + ' ' + (cy - RR * Math.cos(a0)) + 'A' + RR + ' ' + RR + ' 0 0 1 ' + (cx + RR * Math.sin(a1)) + ' ' + (cy - RR * Math.cos(a1)) + 'Z', { fill: SH.alpha(col, op), stroke: col, 'stroke-width': 1 }); };
    var anyP = r.sets.some(function (s) { return s.planar; }), anyT = r.sets.some(function (s) { return s.topple; });
    sector(F.dd, r.limP, anyP ? COL.crit : '#7A8B8F', anyP ? .32 : .12); sector(F.dd + 180, r.limT, anyT ? COL.S0 : '#7A8B8F', anyT ? .32 : .12);
    [['N', 'شمال'], ['E', 'شرق'], ['S', 'جنوب'], ['W', 'غرب']].forEach(function (c, i) { var a = R(i * 90), x = cx + (RR + 22) * Math.sin(a), y = cy - (RR + 22) * Math.cos(a) + 5; S.text(x, y, c[0], { 'font-size': 14, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' }); if (AR) S.text(x, y + 15, c[1], { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'rtl' }); });
    var s = R(F.dd), cr = [Math.cos(s), Math.sin(s)]; S.line(cx - RR * cr[0], cy - RR * cr[1], cx + RR * cr[0], cy + RR * cr[1], { stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' });
    var fa = R(F.dd); S.arrow(cx, cy, cx + RR * F.dip / 90 * Math.sin(fa), cy - RR * F.dip / 90 * Math.cos(fa), INK, 2.4, '');
    var tags = [];
    var tag = function (a, rr, txt2, col) { var x = cx + rr * Math.sin(a), y = cy - rr * Math.cos(a); tags.forEach(function (q) { if (Math.abs(q[0] - x) < 70 && Math.abs(q[1] - y) < 14) y += 16; }); tags.push([x, y]); halo(S, x, y, txt2, { 'font-size': 11, 'font-weight': 800, fill: col, 'text-anchor': Math.sin(a) > 0.2 ? 'start' : Math.sin(a) < -0.2 ? 'end' : 'middle' }); };
    tag(fa, RR * F.dip / 90 + 14, 'Face ' + att(F.dd, F.dip), INK);
    r.sets.forEach(function (q) { var a = R(q.dd), L = RR * q.dip / 90; S.arrow(cx, cy, cx + L * Math.sin(a), cy - L * Math.cos(a), COL[q.k], 2.6, ''); tag(a, L + 14, q.k + ' ' + att(q.dd, q.dip), COL[q.k]); });
    r.wedges.forEach(function (w) { var a = R(w.L.trend), L = RR * w.L.plunge / 90; S.line(cx, cy, cx + L * Math.sin(a), cy - L * Math.cos(a), { stroke: w.kin ? COL.crit : MUT, 'stroke-width': 1.8, 'stroke-dasharray': '5 3' }); S.circle(cx + L * Math.sin(a), cy - L * Math.cos(a), 4, { fill: '#fff', stroke: w.kin ? COL.crit : MUT, 'stroke-width': 1.8 }); tag(a, L + 12, w.key + ' ' + lin(w.L.trend, w.L.plunge), w.kin ? COL.crit : MUT); });
    var items = [[function (x, y) { S.line(x, y, x + 28, y, { stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }); }, 'Slope crest', AR ? 'قمة المنحدر' : ''], [symFill(S, COL.crit, .3), 'Planar sector ±' + r.limP + '°', AR ? 'قطاع الانزلاق المستوي' : ''], [symFill(S, COL.S0, .3), 'Toppling sector ±' + r.limT + '°', AR ? 'قطاع الانقلاب' : ''],
      [function (x, y) { S.arrow(x, y, x + 28, y, COL.J1, 2.2, ''); }, 'Dip vector of a set', AR ? 'متجه ميل المجموعة' : ''], [function (x, y) { S.line(x, y, x + 24, y, { stroke: COL.crit, 'stroke-width': 1.8, 'stroke-dasharray': '5 3' }); S.circle(x + 26, y, 3.5, { fill: '#fff', stroke: COL.crit, 'stroke-width': 1.6 }); }, 'Line of intersection', AR ? 'خط التقاطع' : '']];
    legendBox(S, AR ? 506 : 540, 64, AR ? 244 : 208, items.map(function (it) { return AR ? [it[0], it[1], ''] : [it[0], it[1]]; }), 'LEGEND', AR ? 34 : 21);
    if (AR) items.forEach(function (it, i) { S.text(516 + 36, 64 + 36 + i * 34 + 18, it[2], { 'font-size': 9.5, fill: MUT, direction: 'rtl', 'text-anchor': 'end' }); });
    footer(S, VH);
    $('#capRadar').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('dip directions and dips of the face, of each set and of each line of intersection, with lateral limits ±', 'اتجاهات الميل وقيمه للوجه ولكل مجموعة ولكل خط تقاطع، مع حدود جانبية ±') + r.limP + '° ' + t('(planar) and ±', '(مستوٍ) و±') + r.limT + '° ' + t('(toppling).', '(انقلاب).') + '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('the sector facing ', 'القطاع المواجه للاتجاه ') + p3(F.dd) + '° ' + t('collects the planes and lines that can slide out of the face; the opposite sector collects the steep sets that can topple.', 'يجمع المستويات والخطوط التي يمكن أن تنزلق خارج الوجه؛ والقطاع المقابل يجمع المجموعات شديدة الميل القابلة للانقلاب.') + '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' +
      (anyP || anyT || r.wedges.some(function (w) { return w.kin; }) ? t('the hazard is concentrated toward ', 'يتركز الخطر باتجاه ') + [anyP || r.wedges.some(function (w) { return w.kin; }) ? SH.dir16(F.dd) + ' ' + p3(F.dd) + '°' : '', anyT ? SH.dir16(F.dd + 180) + ' ' + p3(F.dd + 180) + '° ' + t('(toppling)', '(انقلاب)') : ''].filter(Boolean).join(AR ? ' و' : ' and ') + '.' : t('no set or intersection falls in a critical sector.', 'لا تقع أي مجموعة أو خط تقاطع في قطاع حرج.'));
  }

  /* ---------- 5. RMR column */
  function drawRmr(r, rc, sc) {
    var VW = 760, VH = 470, S = SH.svgB('svgRmr'); S.el.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); frame(S, VW, VH);
    var names = ['A1 Intact strength', 'A2 RQD', 'A3 Spacing', 'A4 Condition', 'A5 Groundwater'], mx = [15, 20, 20, 30, 15], x0 = 200, wmax = 400;
    var det = [r.ucs ? 'UCS ' + SH.fmt(r.ucs, 0) + ' MPa' : 'field estimate', 'RQD ' + SH.fmt(r.rqd, 0) + ' %', 'S = ' + SH.fmt(r.spc, 2) + ' m', 'P' + r.sub[0] + ' · A' + r.sub[1] + ' · R' + r.sub[2] + ' · I' + r.sub[3] + ' · W' + r.sub[4], ''];
    S.text(20, 30, 'Rock Mass Rating RMR89 (Bieniawski 1989) · rating / maximum', { 'font-size': 11.5, 'font-weight': 700, fill: INK, direction: 'ltr' });
    r.p.forEach(function (v, i) { var y = 52 + i * 50, f = v / mx[i], col = f < 0.4 ? COL.crit : f < 0.7 ? '#C9A227' : '#2E7D5B';
      S.text(x0 - 12, y + 18, names[i], { 'font-size': 12, 'font-weight': 700, fill: INK, 'text-anchor': 'end', direction: 'ltr' }); if (det[i]) S.text(x0 - 12, y + 33, det[i], { 'font-size': 9.5, fill: MUT, 'text-anchor': 'end', direction: 'ltr' });
      S.add('rect', { x: x0, y: y + 4, width: wmax, height: 22, rx: 4, fill: '#EEF0F2' }); S.add('rect', { x: x0, y: y + 4, width: Math.max(2, wmax * f), height: 22, rx: 4, fill: col });
      S.text(x0 + wmax + 12, y + 20, v + ' / ' + mx[i], { 'font-size': 12, 'font-weight': 800, fill: INK, direction: 'ltr' }); });
    var by = 330, bx = 40, bw = 680, bands = [[0, 20, 'V', '#B23A2E'], [21, 40, 'IV', '#D9822B'], [41, 60, 'III', '#C9A227'], [61, 80, 'II', '#6C8F2E'], [81, 100, 'I', '#2E7D5B']];
    S.text(bx, by - 26, 'Rock mass class (RMR89 above the bar, SMR below)', { 'font-size': 11, 'font-weight': 700, fill: INK, direction: 'ltr' });
    bands.forEach(function (b) { var xa = bx + b[0] / 100 * bw, xb = bx + (b[1] === 100 ? 100 : b[1] + 1) / 100 * bw; S.add('rect', { x: xa, y: by, width: xb - xa, height: 20, fill: SH.alpha(b[3], .75), stroke: '#fff' }); S.text((xa + xb) / 2, by + 14, b[2], { 'font-size': 11, 'font-weight': 800, fill: '#fff', 'text-anchor': 'middle' }); });
    [0, 20, 40, 60, 80, 100].forEach(function (v) { S.text(bx + v / 100 * bw, by + 34, v, { 'font-size': 9.5, fill: MUT, 'text-anchor': 'middle' }); });
    var mk = function (v, up, lab) { var x = bx + SH.clamp(v, 0, 100) / 100 * bw; S.poly(up ? [[x, by - 2], [x - 7, by - 13], [x + 7, by - 13]] : [[x, by + 40], [x - 7, by + 51], [x + 7, by + 51]], { fill: INK }); if (!up) S.line(x, by + 20, x, by + 40, { stroke: INK, 'stroke-width': 1, 'stroke-dasharray': '2 2' }); boxLabel(S, x, up ? by - 18 : by + 70, lab, { 'font-size': 11, 'font-weight': 800, box: INK }); };
    mk(r.rmr, true, 'RMR89 = ' + r.rmr); mk(r.smr, false, 'SMR = ' + SH.fmt(r.smr, 0));
    S.text(bx, by + 96, 'P persistence · A aperture · R roughness · I infilling · W weathering (Bieniawski 1989, Table 1-E)', { 'font-size': 9.5, fill: MUT, direction: 'ltr' });
    footer(S, VH);
    var low = r.p.map(function (v, i) { return [v / mx[i], i]; }).sort(function (a, b) { return a[0] - b[0]; })[0], nmA = [t('intact rock strength', 'مقاومة الصخر السليم'), 'RQD', t('discontinuity spacing', 'تباعد الانقطاعات'), t('discontinuity condition', 'حالة الانقطاعات'), t('groundwater', 'المياه الجوفية')];
    $('#capRmr').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>A1 = ' + r.p[0] + '، A2 = ' + r.p[1] + ' (RQD ' + SH.fmt(r.rqd, 0) + ' %)، A3 = ' + r.p[2] + ' (S = ' + SH.fmt(r.spc, 2) + ' m)، A4 = ' + r.p[3] + '، A5 = ' + r.p[4] + '. ' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>RMR89 = ' + r.rmr + ' (' + t('class ', 'الصنف ') + rc[1] + ' · ' + rc[2] + t('; rock-mass cohesion ', '؛ تماسك الكتلة ') + rc[3] + ' kPa، φ ' + rc[4] + '°)، SMR = ' + SH.fmt(r.smr, 0) + ' (' + t('class ', 'الصنف ') + sc[1] + '). ' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + t('the lowest relative rating is ', 'أدنى تقييم نسبي هو ') + nmA[low[1]] + ' (' + Math.round(low[0] * 100) + ' %)' + t(', which controls the rock-mass quality; ', '، وهو المتحكم بجودة الكتلة الصخرية؛ ') + t('the difference RMR − SMR = ', 'والفرق RMR − SMR = ') + SH.fmt(r.rmr - r.smr, 0) + t(' points expresses the penalty of the discontinuity–face geometry and the excavation method.', ' نقطة يعبّر عن أثر العلاقة الهندسية بين الانقطاعات والوجه وطريقة الحفر.');
  }

  /* ---------- 6. stratigraphic column of the outcrop */
  var bedEd = ST.editor($('#sBeds'), $('#sAddBed'), 'shandal_struct_beds', [{ rock: 'limestone', th: 2 }, { rock: 'marl', th: 1 }, { rock: 'limestone', th: 3 }]);
  function colBeds() { return bedEd.get().filter(function (b) { return ST.R[b.rock] && b.th > 0; }); }
  function drawCol(r) {
    var on = $('#useCol').checked && colBeds().length; $('#colWrap').hidden = !on; if (!on) return;
    ST.render($('#svgCol'), colBeds(), { title: t('Geological stratigraphic column', 'العمود الطباقي الجيولوجي') + (SH.val('sProject') ? ' — ' + SH.val('sProject') : ''), faceAz: r.F.dd, credit: 'Shandal System' });
  }

  function summary(r, rc, sc) {
    var row = function (k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; };
    var out = [row(t('Project', 'المشروع'), SH.esc(SH.val('sProject') || '—')), row(t('Lithology', 'الصخارية'), SH.esc(SH.val('sRock') || '—'))];
    if (isFinite(SH.num('sLat'))) out.push(row(t('Position', 'الموقع'), '<span class="ltr">' + SH.num('sLat').toFixed(5) + '°, ' + SH.num('sLon').toFixed(5) + '°' + (decl != null ? ' · D ' + fmtDecl(decl) : '') + '</span>'));
    out.push(row(t('Slope face', 'وجه المنحدر'), '<span class="ltr">' + att(r.F.dd, r.F.dip) + ' · H ' + SH.fmt(r.H, 1) + ' m</span>'));
    r.sets.forEach(function (s) { var l = reads[s.k] || []; out.push(row(s.k, '<span class="ltr">' + att(s.dd, s.dip) + ' · strike ' + p3(strikeOf(s.dd)) + '°' + (l.length > 1 ? ' · n ' + l.length + ' · α95 ' + fisher(l).a95.toFixed(1) + '°' : '') + '</span>')); });
    r.wedges.forEach(function (w) { out.push(row(w.lbl, '<span class="ltr">' + lin(w.L.trend, w.L.plunge) + (w.K ? ' · ξ ' + SH.fmt(w.xi, 0) + '° · β ' + SH.fmt(w.beta, 0) + '° · K ' + f2(w.K) : '') + '</span>')); });
    out.push(row(t('Shear strength', 'مقاومة القص'), '<span class="ltr">φ ' + r.phi + '° · c ' + r.c + ' kPa · γ ' + r.gam + ' kN/m³ · kh ' + r.kh + '</span>'));
    out.push(row('RMR89', '<span class="ltr">' + r.p.join(' + ') + ' = ' + r.rmr + '</span> · ' + t('class ', 'الصنف ') + rc[1]));
    if (r.smrCrit) { var m = r.smrCrit.m; out.push(row('SMR', '<span class="ltr">' + r.rmr + ' + (' + SH.fmt(m.F1, 2) + ' × ' + SH.fmt(m.F2, 2) + ' × ' + SH.fmt(m.F3, 1) + ') + ' + r.F4 + ' = ' + SH.fmt(m.v, 0) + ' · ' + r.smrCrit.lbl + '</span> · ' + t('class ', 'الصنف ') + sc[1])); }
    $('#sumTable').innerHTML = out.join('');
  }

  $('#sRun').addEventListener('click', function () { var r = analyse(); if (r) { store.save(); render(r); $('#sOut').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  $('#sDemo').addEventListener('click', function () {
    var v = { sProject: t('Road cut, km 14', 'قطع طريق، كم 14'), sRock: t('Jointed limestone with marl interbeds', 'حجر جيري متشقق مع تداخلات مارلية'), sLat: 36.7412, sLon: 43.8754, J1dd: 52, J1dip: 38, J2dd: 128, J2dip: 60, J3dd: 240, J3dip: 78, S0dd: 48, S0dip: 22, Fdd: 60, Fdip: 65, hgt: 15, gam: 26, phi: 30, coh: 10, kh: 0.08, rqdV: 72, spc: 0.45, ucsV: 85 };
    for (var k in v) $('#' + k).value = v[k];
    ['useJ2', 'useJ3', 'useS0', 'useCol'].forEach(function (id) { $('#' + id).checked = true; }); $('#crack').value = 'crit'; $('#crackW').value = '0.5';
    PL.forEach(function (p) { src[p] = 'typed'; }); $('#sRef').value = 'true'; updBoxes(); updStrike(); updDecl();
    bedEd.set([{ rock: 'limestone', th: 3, base: 'sharp', st: ['joint'] }, { rock: 'marl', th: 1.2, base: 'grad' }, { rock: 'limestone', th: 4, sec: 'marl', mix: 'inter', base: 'sharp', st: ['stylolite'] }, { rock: 'dolomite', th: 2.5, base: 'erosive', st: ['vug'] }]);
    var r = analyse(); if (r) { store.save(); render(r); }
  });
  document.getElementById('projSeg').addEventListener('segchange', function () { if (last) drawNet(last); });
  document.addEventListener('sh:redraw', function () { if (last) render(last); });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Run the analysis first.', 'شغّل التحليل أولاً.'), 'warn'); } });
  SH.$$('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { SH.svgPng($('#' + b.getAttribute('data-svg')), 'shandal-' + b.getAttribute('data-svg') + '.png', 2); }); });
  updBoxes(); updStrike(); showN(); updDecl();
  if (!isNaN(SH.num('J1dd')) && !isNaN(SH.num('Fdd')) && (SH.num('rqdV') >= 0 || SH.num('jv') >= 0) && SH.num('spc') > 0) { var r0 = analyse(); if (r0) render(r0); }
})();
