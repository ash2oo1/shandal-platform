/* Structural & geotechnical survey: digital compass, Markland kinematics (planar, wedge, toppling),
   planar factor of safety (Hoek & Bray), RMR89 (Bieniawski 1989) and SMR (Romana 1985). */
(function () {
  'use strict';
  var t = SH.t, R = SH.rad, D = SH.deg, $ = SH.$;
  var ids = ['geoName', 'sProject', 'sRock', 'j1dd', 'j1d', 'useJ2', 'j2dd', 'j2d', 'sfdd', 'sfd', 'phi', 'coh', 'hgt', 'gam', 'rUcs', 'rRqd', 'rSp', 'rCo', 'rGw', 'f4', 'xUnder', 'xFreeze', 'xVib'];
  var store = SH.persist('structural', ids);
  var last = null;

  /* ---------- helpers */
  var norm = function (a) { return ((a % 360) + 360) % 360; };
  var strikeOf = function (dd) { return norm(dd - 90); };
  var angDiff = function (a, b) { var x = Math.abs(norm(a) - norm(b)); return x > 180 ? 360 - x : x; };
  function fmtDD(dd, dip) { return String(Math.round(dip)).padStart(2, '0') + '/' + String(Math.round(norm(dd))).padStart(3, '0'); }
  function updStrike() {
    var a = SH.num('j1dd'); $('#j1s').value = isNaN(a) ? '' : Math.round(strikeOf(a)) + '° (' + SH.dir16(strikeOf(a)) + ')';
    var b = SH.num('j2dd'); $('#j2s').value = isNaN(b) ? '' : Math.round(strikeOf(b)) + '° (' + SH.dir16(strikeOf(b)) + ')';
  }
  ['j1dd', 'j2dd'].forEach(function (id) { $('#' + id).addEventListener('input', updStrike); });
  $('#useJ2').addEventListener('change', function () { $('#j2box').hidden = !this.checked; });

  /* ---------- digital compass (W3C device orientation, Z-X'-Y'' Tait–Bryan) */
  var buf = [], compassOn = false, curReading = null;
  function onOri(e) {
    if (!compassOn) return;
    var alpha = e.alpha, beta = e.beta, gamma = e.gamma, src;
    if (typeof e.webkitCompassHeading === 'number') { alpha = 360 - e.webkitCompassHeading; src = 'iOS heading'; }
    else src = e.absolute ? t('absolute', 'مطلق') : t('relative', 'نسبي');
    if (alpha == null || beta == null || gamma == null) return;
    var a = R(alpha), b = R(beta), g = R(gamma);
    // screen-normal (device z) in the earth frame (x East, y North, z Up)
    var nx = Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g);
    var ny = Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g);
    var nz = Math.cos(b) * Math.cos(g);
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    var dip = D(Math.acos(SH.clamp(nz, -1, 1))), dd = norm(D(Math.atan2(nx, ny)));
    buf.push([dd, dip]); if (buf.length > 20) buf.shift();
    var sx = 0, sy = 0, sd = 0; buf.forEach(function (r) { sx += Math.sin(R(r[0])); sy += Math.cos(R(r[0])); sd += r[1]; });
    var mdd = norm(D(Math.atan2(sx, sy))), md = sd / buf.length;
    curReading = { dd: mdd, dip: md };
    $('#cDd').textContent = Math.round(mdd) + '°'; $('#cDip').textContent = Math.round(md) + '°'; $('#cStk').textContent = Math.round(strikeOf(mdd)) + '°'; $('#cSrc').textContent = src;
  }
  $('#cStart').addEventListener('click', function () {
    function go() {
      compassOn = true; $('#cLive').hidden = false; buf = [];
      if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri); else window.addEventListener('deviceorientation', onOri);
      setTimeout(function () { if (!curReading) SH.toast(t('No orientation data yet. Open this page on a phone with a compass sensor.', 'لا توجد بيانات اتجاه بعد. افتح هذه الصفحة على هاتف يحتوي على حساس بوصلة.'), 'warn', 5000); }, 2500);
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') go(); else SH.toast(t('Motion sensor permission was refused.', 'تم رفض إذن حساس الحركة.'), 'bad'); }).catch(function () { SH.toast(t('Motion sensor permission failed.', 'فشل طلب إذن حساس الحركة.'), 'bad'); });
    } else go();
  });
  function capture(ddId, dId, label) {
    if (!curReading) return SH.toast(t('No compass reading yet.', 'لا توجد قراءة من البوصلة بعد.'), 'warn');
    $('#' + ddId).value = Math.round(curReading.dd); $('#' + dId).value = Math.round(curReading.dip); updStrike(); store.save();
    SH.toast(label + ': ' + fmtDD(curReading.dd, curReading.dip), 'ok');
  }
  $('#cToJ1').addEventListener('click', function () { capture('j1dd', 'j1d', 'J1'); });
  $('#cToJ2').addEventListener('click', function () { $('#useJ2').checked = true; $('#j2box').hidden = false; capture('j2dd', 'j2d', 'J2'); });
  $('#cToSlope').addEventListener('click', function () { capture('sfdd', 'sfd', t('Slope face', 'وجه المنحدر')); });

  /* ---------- vectors (x East, y North, z Down) */
  function lineVec(trend, plunge) { return [Math.sin(R(trend)) * Math.cos(R(plunge)), Math.cos(R(trend)) * Math.cos(R(plunge)), Math.sin(R(plunge))]; }
  function vecLine(v) { var n = Math.hypot(v[0], v[1], v[2]); v = v.map(function (x) { return x / n; }); if (v[2] < 0) v = v.map(function (x) { return -x; }); return { trend: norm(D(Math.atan2(v[0], v[1]))), plunge: D(Math.asin(SH.clamp(v[2], -1, 1))) }; }
  function poleVec(dd, dip) { return lineVec(dd + 180, 90 - dip); }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function intersection(p1, p2) { return vecLine(cross(poleVec(p1.dd, p1.dip), poleVec(p2.dd, p2.dip))); }
  function apparentDip(dip, dd, dir) { return D(Math.atan(Math.tan(R(dip)) * Math.cos(R(dir - dd)))); }

  /* ---------- analysis */
  var RMRCLS = [
    [81, 'I', t('Very good rock', 'صخر جيد جداً'), '> 400', '> 45', 'ok'], [61, 'II', t('Good rock', 'صخر جيد'), '300–400', '35–45', 'ok'], [41, 'III', t('Fair rock', 'صخر متوسط'), '200–300', '25–35', 'warn'],
    [21, 'IV', t('Poor rock', 'صخر ضعيف'), '100–200', '15–25', 'bad'], [-1e9, 'V', t('Very poor rock', 'صخر ضعيف جداً'), '< 100', '< 15', 'bad']];
  var SMRCLS = [
    [81, 'I', t('Completely stable', 'مستقر تماماً'), t('No failures', 'لا انهيارات'), t('No support needed', 'لا حاجة لدعم'), 'ok'],
    [61, 'II', t('Stable', 'مستقر'), t('Some block failures', 'انهيار بعض الكتل'), t('Occasional spot bolting', 'تثبيت موضعي عند الحاجة'), 'ok'],
    [41, 'III', t('Partially stable', 'مستقر جزئياً'), t('Some joint or many wedge failures', 'انهيارات على بعض الفواصل أو أسافين عديدة'), t('Systematic support', 'دعم منهجي'), 'warn'],
    [21, 'IV', t('Unstable', 'غير مستقر'), t('Planar or large wedge failures', 'انهيارات مستوية أو أسافين كبيرة'), t('Important or corrective support', 'دعم مهم أو تصحيحي'), 'bad'],
    [-1e9, 'V', t('Completely unstable', 'غير مستقر تماماً'), t('Large planar or soil-like failures', 'انهيارات مستوية كبيرة أو شبيهة بالتربة'), t('Re-excavation', 'إعادة الحفر'), 'bad']];
  var cls = function (tab, v) { for (var i = 0; i < tab.length; i++) if (v >= tab[i][0]) return tab[i]; return tab[tab.length - 1]; };

  function analyse() {
    var j1 = { dd: SH.num('j1dd'), dip: SH.num('j1d') }, sf = { dd: SH.num('sfdd'), dip: SH.num('sfd') }, phi = SH.num('phi');
    if ([j1.dd, j1.dip, sf.dd, sf.dip, phi].some(isNaN)) { SH.toast(t('Enter J1, the slope face and the friction angle.', 'أدخل الفاصل J1 ووجه المنحدر وزاوية الاحتكاك.'), 'warn'); return null; }
    if (j1.dip > 90 || sf.dip > 90 || j1.dip < 0 || sf.dip <= 0) { SH.toast(t('Dip angles must be between 0 and 90°.', 'يجب أن تكون زوايا الميل بين 0 و90°.'), 'warn'); return null; }
    var useJ2 = $('#useJ2').checked, j2 = useJ2 ? { dd: SH.num('j2dd'), dip: SH.num('j2d') } : null;
    if (useJ2 && (isNaN(j2.dd) || isNaN(j2.dip))) { SH.toast(t('Enter J2 or untick the second joint set.', 'أدخل J2 أو ألغِ تحديد مجموعة الفواصل الثانية.'), 'warn'); return null; }
    var r = { j1: j1, j2: j2, sf: sf, phi: phi, c: SH.num('coh') || 0, H: SH.num('hgt'), gam: SH.num('gam') || 26 };
    // kinematics
    var dA = angDiff(j1.dd, sf.dd);
    r.planar = dA <= 20 && j1.dip > phi && j1.dip < sf.dip;
    r.topple = angDiff(j1.dd, sf.dd + 180) <= 10 && (90 - j1.dip) + phi < sf.dip;
    r.planarPartial = dA <= 20 && j1.dip < sf.dip && j1.dip <= phi; // daylights but friction holds
    if (j2) {
      r.inter = intersection(j1, j2);
      var appSlope = apparentDip(sf.dip, sf.dd, r.inter.trend);
      r.wedge = angDiff(r.inter.trend, sf.dd) < 90 && r.inter.plunge > phi && r.inter.plunge < appSlope;
      r.dA2 = angDiff(j2.dd, sf.dd);
      r.planar2 = r.dA2 <= 20 && j2.dip > phi && j2.dip < sf.dip;
      r.topple2 = angDiff(j2.dd, sf.dd + 180) <= 10 && (90 - j2.dip) + phi < sf.dip;
    }
    // planar FS (Hoek & Bray, dry, no tension crack)
    r.app = apparentDip(j1.dip, j1.dd, sf.dd);
    if (r.app > 0 && r.app < sf.dip) {
      var psp = R(r.app), psf = R(sf.dip);
      if (r.H > 0) { var W = 0.5 * r.gam * r.H * r.H * (1 / Math.tan(psp) - 1 / Math.tan(psf)), A = r.H / Math.sin(psp); r.W = W; r.A = A; r.fs = (r.c * A + W * Math.cos(psp) * Math.tan(R(phi))) / (W * Math.sin(psp)); }
      else r.fs = Math.tan(R(phi)) / Math.tan(psp);
    } else r.fs = NaN;
    // RMR & SMR
    r.p = ['rUcs', 'rRqd', 'rSp', 'rCo', 'rGw'].map(function (id) { return +SH.val(id); });
    r.rmr = r.p.reduce(function (a, b) { return a + b; }, 0);
    var A1 = dA, F1 = SH.clamp(Math.pow(1 - Math.sin(R(Math.min(A1, 90))), 2), 0.15, 1), F2 = SH.clamp(Math.pow(Math.tan(R(j1.dip)), 2), 0.15, 1), F3, diff = j1.dip - sf.dip, mode = 'P';
    if (angDiff(j1.dd, sf.dd + 180) < angDiff(j1.dd, sf.dd)) { // dipping into slope: toppling case
      mode = 'T'; A1 = angDiff(j1.dd, sf.dd + 180); F1 = SH.clamp(Math.pow(1 - Math.sin(R(Math.min(A1, 90))), 2), 0.15, 1); F2 = 1;
      var sum = j1.dip + sf.dip; F3 = sum < 110 ? 0 : sum <= 120 ? -6 : -25;
    } else F3 = diff > 10 ? 0 : diff > 0 ? -6 : diff === 0 ? -25 : diff >= -10 ? -50 : -60;
    r.F1 = F1; r.F2 = F2; r.F3 = F3; r.F4 = +SH.val('f4'); r.smrMode = mode;
    r.smr = SH.clamp(r.rmr + F1 * F2 * F3 + r.F4, 0, 100);
    r.x = { under: $('#xUnder').checked, freeze: $('#xFreeze').checked, vib: $('#xVib').checked };
    return r;
  }

  /* ---------- outputs */
  function kpi(id, v, s, state) { $('#v' + id).innerHTML = v; $('#s' + id).innerHTML = s; $('#k' + id).className = 'kpi ' + (state || ''); }
  function verdict(state, title, text) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + title + '</h3><p>' + text + '</p></div></div>'; }

  function render(r) {
    last = r; $('#sEmpty').hidden = true; $('#sOut').hidden = false;
    var rc = cls(RMRCLS, r.rmr), sc = cls(SMRCLS, r.smr);
    kpi('Rmr', r.rmr + '<small> /100</small>', t('Class ', 'الصنف ') + rc[1] + ' · ' + rc[2], rc[5]);
    kpi('Smr', SH.fmt(r.smr, 0) + '<small> /100</small>', t('Class ', 'الصنف ') + sc[1] + ' · ' + sc[2], sc[5]);
    var fsState = isNaN(r.fs) ? '' : r.fs < 1 ? 'bad' : r.fs < 1.5 ? 'warn' : 'ok';
    kpi('Fs', isNaN(r.fs) ? '—' : SH.fmt(r.fs, 2), isNaN(r.fs) ? t('J1 does not daylight in the face', 'J1 لا ينكشف على وجه المنحدر') : (r.fs < 1 ? t('Failure expected', 'الانهيار متوقع') : r.fs < 1.5 ? t('Marginal (target ≥ 1.5)', 'حدّي (المطلوب ≥ 1.5)') : t('Adequate', 'مقبول')), fsState);
    var modes = [];
    if (r.planar || r.planar2) modes.push(t('Planar', 'مستوي'));
    if (r.wedge) modes.push(t('Wedge', 'إسفيني'));
    if (r.topple || r.topple2) modes.push(t('Toppling', 'انقلاب'));
    kpi('Kin', modes.length ? modes.join(' · ') : t('No mode', 'لا يوجد نمط'), modes.length ? t('Kinematically possible', 'ممكن كينماتيكياً') : t('Kinematically stable', 'مستقر كينماتيكياً'), modes.length ? 'bad' : 'ok');

    var v = [];
    v.push(r.planar ? verdict('bad', t('Planar sliding on J1 is possible', 'الانزلاق المستوي على J1 ممكن'), t('J1 dips out of the face within 20° of the slope direction, at ', 'يميل J1 خارج وجه المنحدر ضمن 20° من اتجاهه، بزاوية ') + r.j1.dip + '° ' + t('which is steeper than φ = ', 'أكبر من φ = ') + r.phi + '° ' + t('and gentler than the face (', 'وأقل من ميل الوجه (') + r.sf.dip + '°).')
      : r.planarPartial ? verdict('warn', t('J1 daylights but friction holds', 'J1 ينكشف لكن الاحتكاك يمنع الانزلاق'), t('The plane is exposed in the face but dips less than the friction angle. Water pressure or vibration could still trigger sliding.', 'المستوى مكشوف في الوجه لكنه يميل بأقل من زاوية الاحتكاك. قد يؤدي ضغط الماء أو الاهتزاز إلى الانزلاق.'))
      : verdict('ok', t('No planar sliding on J1', 'لا انزلاق مستوي على J1'), t('J1 either strikes away from the face by more than 20°, dips more steeply than the face, or dips less than φ.', 'إما أن J1 ينحرف عن الوجه بأكثر من 20°، أو يميل أكثر من الوجه، أو يميل أقل من φ.')));
    if (r.j2) v.push(r.wedge ? verdict('bad', t('Wedge sliding is possible', 'الانزلاق الإسفيني ممكن'), t('The J1–J2 intersection plunges ', 'يغطس خط تقاطع J1–J2 بزاوية ') + SH.fmt(r.inter.plunge, 0) + '° ' + t('toward ', 'نحو ') + SH.fmt(r.inter.trend, 0) + '°, ' + t('out of the face and steeper than φ.', 'خارج الوجه وأكبر من φ.'))
      : verdict('ok', t('No wedge sliding', 'لا انزلاق إسفيني'), t('The J1–J2 intersection (', 'خط تقاطع J1–J2 (') + fmtDD(r.inter.trend, r.inter.plunge).split('/').reverse().join('→') + ') ' + t('does not daylight steeper than φ.', 'لا ينكشف بزاوية أكبر من φ.')));
    if (r.topple || r.topple2) v.push(verdict('bad', t('Flexural toppling is possible', 'الانقلاب الانثنائي ممكن'), t('A steep joint set dips into the slope within 10° of the opposite direction (Goodman & Bray condition).', 'مجموعة فواصل شديدة الميل تميل داخل المنحدر ضمن 10° من الاتجاه المعاكس (شرط Goodman & Bray).')));
    var adv = [];
    if (r.x.under) adv.push(t('active toe undercutting removes support at the base', 'التقويض السفلي النشط يزيل الدعم عند القاعدة'));
    if (r.x.freeze) adv.push(t('freeze–thaw opens joints and adds water pressure', 'الانجماد والذوبان يوسعان الفواصل ويضيفان ضغطاً مائياً'));
    if (r.x.vib) adv.push(t('vibration reduces friction momentarily', 'الاهتزاز يقلل الاحتكاك لحظياً'));
    v.push(verdict(sc[5], t('SMR class ', 'صنف SMR ') + sc[1] + ': ' + sc[2], sc[3] + '. ' + t('Recommended: ', 'الموصى به: ') + sc[4] + '.' + (adv.length ? ' ' + t('Also note that ', 'لاحظ كذلك أن ') + adv.join('; ') + '.' : '')));
    $('#verdicts').innerHTML = v.join('');

    drawNet(r); drawSection(r); drawPlan(r); drawRadar(r); drawRmr(r); summary(r, rc, sc);
  }

  /* ---------- 1. stereonet */
  function drawNet(r) {
    var S = SH.svgB('svgNet'), p = SH.palette(), cx = 260, cy = 262, RR = 215, mode = SH.seg('projSeg') || 'angle';
    var proj = function (trend, plunge) { var z = R(90 - plunge), rr = mode === 'area' ? RR * Math.SQRT2 * Math.sin(z / 2) : RR * Math.tan(z / 2); return [cx + rr * Math.sin(R(trend)), cy - rr * Math.cos(R(trend))]; };
    var gc = function (dd, dip) { var pts = [], s = [Math.sin(R(dd - 90)), Math.cos(R(dd - 90)), 0], dv = lineVec(dd, dip); for (var k = 0; k <= 180; k += 2) { var a = R(k), v = [s[0] * Math.cos(a) + dv[0] * Math.sin(a), s[1] * Math.cos(a) + dv[1] * Math.sin(a), s[2] * Math.cos(a) + dv[2] * Math.sin(a)], l = vecLine(v); pts.push(proj(l.trend, l.plunge)); } return pts; };
    S.circle(cx, cy, RR, { fill: SH.css('--il-bg'), stroke: 'none' });
    var G = S.g({ stroke: p.line, 'stroke-width': 1, fill: 'none' });
    for (var d = 10; d < 90; d += 10) { S.path(S.pl(gc(90, d)), {}, G); S.path(S.pl(gc(270, d)), {}, G); }
    S.line(cx, cy - RR, cx, cy + RR, { stroke: p.line2, 'stroke-width': 1 }); S.line(cx - RR, cy, cx + RR, cy, { stroke: p.line2, 'stroke-width': 1 });
    for (var a2 = 0; a2 < 360; a2 += 10) { var l1 = a2 % 30 === 0 ? 10 : 5; S.line(cx + RR * Math.sin(R(a2)), cy - RR * Math.cos(R(a2)), cx + (RR + l1) * Math.sin(R(a2)), cy - (RR + l1) * Math.cos(R(a2)), { stroke: p.text3 }); if (a2 % 30 === 0 && a2) S.text(cx + (RR + 22) * Math.sin(R(a2)), cy - (RR + 22) * Math.cos(R(a2)) + 4, a2, { 'font-size': 10, fill: p.text3, 'text-anchor': 'middle' }); }
    S.text(cx, cy - RR - 14, 'N', { 'font-size': 15, 'font-weight': 800, fill: p.text, 'text-anchor': 'middle' });
    // planar critical zone: dip vectors with trend within ±20° of slope dd, plunge between phi and apparent face dip
    var zone = [];
    for (var tr = -20; tr <= 20; tr += 2) { var T = r.sf.dd + tr; zone.push(proj(T, Math.max(r.phi, 0))); }
    for (var tr2 = 20; tr2 >= -20; tr2 -= 2) { var T2 = r.sf.dd + tr2; zone.push(proj(T2, Math.max(r.phi, apparentDip(r.sf.dip, r.sf.dd, T2)))); }
    S.poly(zone, { fill: SH.alpha(p.warn, 0.18), stroke: p.warn, 'stroke-width': 1, 'stroke-dasharray': '4 3' });
    // friction circle (dip = phi)
    var fr = []; for (var k2 = 0; k2 <= 360; k2 += 4) fr.push(proj(k2, r.phi));
    S.path(S.pl(fr) + 'Z', { fill: 'none', stroke: p.data, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' });
    // great circles
    S.path(S.pl(gc(r.sf.dd, r.sf.dip)), { fill: 'none', stroke: p.text, 'stroke-width': 2.4 });
    S.path(S.pl(gc(r.j1.dd, r.j1.dip)), { fill: 'none', stroke: p.accent, 'stroke-width': 2.8 });
    if (r.j2) S.path(S.pl(gc(r.j2.dd, r.j2.dip)), { fill: 'none', stroke: p.series[3], 'stroke-width': 2.4 });
    // poles & dip vectors
    var pole = function (pl, col, lab) { var q = proj(pl.dd + 180, 90 - pl.dip); S.circle(q[0], q[1], 5.5, { fill: col, stroke: p.bg, 'stroke-width': 1.5 }); S.text(q[0] + 9, q[1] - 7, lab, { 'font-size': 11, 'font-weight': 700, fill: col }); var dv = proj(pl.dd, pl.dip); S.path('M' + (dv[0] - 5) + ' ' + (dv[1] - 5) + 'L' + (dv[0] + 5) + ' ' + (dv[1] + 5) + 'M' + (dv[0] + 5) + ' ' + (dv[1] - 5) + 'L' + (dv[0] - 5) + ' ' + (dv[1] + 5), { stroke: col, 'stroke-width': 2 }); };
    pole(r.j1, p.accent, t('P1', 'ق1'));
    if (r.j2) { pole(r.j2, p.series[3], t('P2', 'ق2')); var I = proj(r.inter.trend, r.inter.plunge); S.circle(I[0], I[1], 7, { fill: 'none', stroke: p.warn, 'stroke-width': 2.4 }); S.text(I[0] + 10, I[1] + 14, 'I₁₂', { 'font-size': 11, 'font-weight': 800, fill: p.warn }); }
    S.circle(cx, cy, RR, { fill: 'none', stroke: p.text, 'stroke-width': 2 });
    var sf = proj(r.sf.dd + 180, 90 - r.sf.dip); S.circle(sf[0], sf[1], 4.5, { fill: p.text });
    $('#netLegend').innerHTML = '<span><i class="ln" style="background:' + p.text + '"></i>' + t('Slope face ', 'وجه المنحدر ') + fmtDD(r.sf.dd, r.sf.dip) + '</span><span><i class="ln" style="background:' + p.accent + '"></i>J1 ' + fmtDD(r.j1.dd, r.j1.dip) + '</span>' + (r.j2 ? '<span><i class="ln" style="background:' + p.series[3] + '"></i>J2 ' + fmtDD(r.j2.dd, r.j2.dip) + '</span>' : '') +
      '<span><i class="dash" style="color:' + p.data + '"></i>' + t('Friction circle φ = ', 'دائرة الاحتكاك φ = ') + r.phi + '°</span><span><i style="background:' + SH.alpha(p.warn, .25) + '"></i>' + t('Planar critical zone', 'نطاق الانزلاق المستوي الحرج') + '</span><span>● ' + t('poles', 'الأقطاب') + ' · ✕ ' + t('dip vectors', 'متجهات الميل') + '</span>';
    $('#capNet').innerHTML = '<b>' + t('Reading: ', 'القراءة: ') + '</b>' + (r.planar ? t('the J1 dip vector (✕) falls inside the shaded crescent between the friction circle and the slope face, so planar sliding is kinematically possible.', 'متجه ميل J1 (✕) يقع داخل الهلال المظلل بين دائرة الاحتكاك ووجه المنحدر، فالانزلاق المستوي ممكن كينماتيكياً.') : t('the J1 dip vector (✕) lies outside the shaded critical crescent, so planar sliding on J1 is not kinematically possible.', 'متجه ميل J1 (✕) يقع خارج الهلال الحرج المظلل، فالانزلاق المستوي على J1 غير ممكن كينماتيكياً.')) + ' ' + (mode === 'area' ? t('Schmidt (equal-area) net.', 'شبكة شميت (متساوية المساحات).') : t('Wulff (equal-angle) net.', 'شبكة وولف (متساوية الزوايا).'));
  }

  /* ---------- 2. section and free-body forces */
  function drawSection(r) {
    var S = SH.svgB('svgSec'), p = SH.palette(), W = 560, H = 400, toeX = 150, toeY = 320, h = 200;
    var psf = R(r.sf.dip), crestX = toeX + h / Math.tan(psf), crestY = toeY - h, app = r.app;
    S.add('rect', { x: 0, y: 0, width: W, height: H, fill: SH.css('--il-bg') });
    var rock = [[0, toeY], [toeX, toeY], [crestX, crestY], [W, crestY - 10], [W, H], [0, H]];
    S.poly(rock, { fill: SH.css('--b2'), stroke: 'none' });
    S.path(S.pl([[0, toeY], [toeX, toeY], [crestX, crestY], [W, crestY - 10]]), { fill: 'none', stroke: p.text, 'stroke-width': 2.4 });
    // bedding hint lines parallel to J1 apparent dip
    if (app > 0) {
      var pa = R(app);
      for (var k = -6; k <= 6; k++) { var ox = toeX + k * 46; S.line(ox - 400 * Math.cos(pa), toeY + 400 * Math.sin(pa), ox + 400 * Math.cos(pa), toeY - 400 * Math.sin(pa), { stroke: p.line2, 'stroke-width': 1, opacity: .5 }); }
      var jEnd = [toeX + 520 * Math.cos(pa), toeY - 520 * Math.sin(pa)];
      // where joint meets the upper surface
      var top = crestY, jx = toeX + (toeY - top) / Math.tan(pa);
      if (app < r.sf.dip && jx > crestX) {
        var block = [[toeX, toeY], [crestX, crestY], [jx, crestY - 10 * (jx - crestX) / (W - crestX)]];
        S.poly(block, { fill: SH.alpha(p.warn, r.planar ? 0.35 : 0.12), stroke: p.warn, 'stroke-width': 1.5 });
        // forces at the block centroid
        var gx = (block[0][0] + block[1][0] + block[2][0]) / 3, gy = (block[0][1] + block[1][1] + block[2][1]) / 3, L = 70;
        S.circle(gx, gy, 4, { fill: p.text });
        S.arrow(gx, gy, gx, gy + L, p.ok, 2.6, 'W', { dx: 0, dy: 18 });
        S.arrow(gx, gy, gx - L * 0.8 * Math.sin(pa), gy - L * 0.8 * Math.cos(pa), p.series[5], 2.4, 'N');
        S.arrow(gx, gy, gx - L * 0.8 * Math.cos(pa), gy + L * 0.8 * Math.sin(pa), p.series[0], 2.4, 'T');
      }
      S.line(toeX - 60 * Math.cos(pa), toeY + 60 * Math.sin(pa), jEnd[0], jEnd[1], { stroke: p.warn, 'stroke-width': 3 });
      S.path('M' + (toeX + 60) + ' ' + toeY + ' A60 60 0 0 0 ' + (toeX + 60 * Math.cos(pa)) + ' ' + (toeY - 60 * Math.sin(pa)), { fill: 'none', stroke: p.warn, 'stroke-width': 1.5 });
      S.text(toeX + 68 * Math.cos(pa / 2) + 4, toeY - 68 * Math.sin(pa / 2) + 4, 'ψp ' + SH.fmt(app, 0) + '°', { 'font-size': 12, 'font-weight': 700, fill: p.warn });
    }
    S.path('M' + (toeX + 95) + ' ' + toeY + ' A95 95 0 0 0 ' + (toeX + 95 * Math.cos(psf)) + ' ' + (toeY - 95 * Math.sin(psf)), { fill: 'none', stroke: p.data, 'stroke-width': 1.8 });
    S.text(toeX + 104 * Math.cos(psf * 0.75) + 4, toeY - 104 * Math.sin(psf * 0.75), 'ψf ' + r.sf.dip + '°', { 'font-size': 12, 'font-weight': 700, fill: p.data });
    S.line(toeX - 20, toeY, toeX + 130, toeY, { stroke: p.text3, 'stroke-dasharray': '4 4' });
    S.text(20, 30, t('Section along the slope dip direction ', 'مقطع باتجاه ميل المنحدر ') + Math.round(r.sf.dd) + '°', { 'font-size': 12, fill: p.text2 });
    if (r.H > 0) { S.line(40, toeY, 40, crestY, { stroke: p.text3 }); S.text(46, (toeY + crestY) / 2, 'H = ' + r.H + ' m', { 'font-size': 12, fill: p.text2 }); }
    $('#capSec').innerHTML = '<b>' + t('Mechanics: ', 'الميكانيك: ') + '</b>' + t('the block above J1 is pulled down-dip by the weight component W·sinψp and held by friction N·tanφ', 'الكتلة فوق J1 تُسحب باتجاه الميل بمركبة الوزن W·sinψp ويقاومها الاحتكاك N·tanφ') + (r.c ? t(' and cohesion c·A', ' والتماسك c·A') : '') + '. ' + (isNaN(r.fs) ? t('J1 does not daylight in the face here, so no block is released.', 'لا ينكشف J1 في الوجه هنا، فلا توجد كتلة حرة.') : 'FS = ' + SH.fmt(r.fs, 2) + (r.W ? ' (W = ' + SH.fmt(r.W, 0) + ' kN/m)' : '') + '.');
  }

  /* ---------- 3. plan and cross-section */
  function drawPlan(r) {
    var S = SH.svgB('svgPlan'), p = SH.palette(), dip = SH.clamp(r.j1.dip, 3, 87), stk = strikeOf(r.j1.dd);
    S.add('rect', { x: 0, y: 0, width: 560, height: 420, fill: SH.css('--il-bg') });
    var cols = [SH.css('--l1'), SH.css('--l2'), SH.css('--l4')];
    // plan view: map box 40..520 x 30..190, beds striking at stk
    S.text(40, 22, t('Plan view', 'المسقط الأفقي'), { 'font-size': 12, 'font-weight': 700, fill: p.text });
    var bx = 40, by = 30, bw = 480, bh = 160, mx = bx + bw / 2, my = by + bh / 2;
    var clip = S.add('clipPath', { id: 'pclip' }); S.add('rect', { x: bx, y: by, width: bw, height: bh }, null, clip);
    var g = S.g({ 'clip-path': 'url(#pclip)' });
    var sr = R(stk), ux = Math.sin(sr), uy = -Math.cos(sr), nx = -uy, ny = ux; // strike unit vector and normal (screen)
    var ddv = [Math.sin(R(r.j1.dd)), -Math.cos(R(r.j1.dd))];
    if (nx * ddv[0] + ny * ddv[1] < 0) { nx = -nx; ny = -ny; }
    for (var k = -6; k <= 6; k++) {
      var o = k * 70, c0 = [mx + nx * o, my + ny * o], c1 = [mx + nx * (o + 70), my + ny * (o + 70)];
      S.poly([[c0[0] - ux * 600, c0[1] - uy * 600], [c0[0] + ux * 600, c0[1] + uy * 600], [c1[0] + ux * 600, c1[1] + uy * 600], [c1[0] - ux * 600, c1[1] - uy * 600]], { fill: cols[(k + 60) % 3], stroke: p.text3, 'stroke-width': 1 }, g);
    }
    S.add('rect', { x: bx, y: by, width: bw, height: bh, fill: 'none', stroke: p.text, 'stroke-width': 1.5 });
    // strike/dip symbol
    S.line(mx - ux * 26, my - uy * 26, mx + ux * 26, my + uy * 26, { stroke: p.text, 'stroke-width': 3 });
    S.line(mx, my, mx + nx * 12, my + ny * 12, { stroke: p.text, 'stroke-width': 3 });
    S.text(mx + nx * 22 + 4, my + ny * 22 + 4, Math.round(r.j1.dip) + '°', { 'font-size': 13, 'font-weight': 800, fill: p.text });
    S.path('M' + (bx + bw - 22) + ' ' + (by + 30) + 'l7 18h-14z', { fill: p.accent }); S.text(bx + bw - 22, by + 24, 'N', { 'font-size': 11, 'font-weight': 800, fill: p.text, 'text-anchor': 'middle' });
    // section line A–A' perpendicular to strike
    S.line(mx - nx * 240, my - ny * 240, mx + nx * 240, my + ny * 240, { stroke: p.data, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' });
    // cross-section
    var sy = 250, sh = 150; S.text(40, sy - 10, t('Cross-section A–A′ (perpendicular to strike)', 'المقطع A–A′ (عمودي على المضرب)'), { 'font-size': 12, 'font-weight': 700, fill: p.text });
    var clip2 = S.add('clipPath', { id: 'sclip' }); S.add('rect', { x: 40, y: sy, width: 480, height: sh }, null, clip2);
    var g2 = S.g({ 'clip-path': 'url(#sclip)' }), dr = R(dip), dx = 1000 / Math.tan(dr);
    var xs = [-400, 180, 330, 900];
    for (var i = 0; i < 3; i++) S.poly([[xs[i], sy], [xs[i + 1], sy], [xs[i + 1] + dx, sy + 1000], [xs[i] + dx, sy + 1000]], { fill: cols[i], stroke: p.text3 }, g2);
    S.add('rect', { x: 40, y: sy, width: 480, height: sh, fill: 'none', stroke: p.text, 'stroke-width': 1.5 });
    S.path('M220 ' + sy + ' A40 40 0 0 1 ' + (180 + 40 * Math.cos(dr)) + ' ' + (sy + 40 * Math.sin(dr)), { fill: 'none', stroke: p.warn, 'stroke-width': 1.6 });
    S.text(226, sy + 22, Math.round(dip) + '°', { 'font-size': 12, 'font-weight': 800, fill: p.warn });
    var c = 150, tt = c * Math.sin(dr), xi = 330 - tt * Math.sin(dr), yi = sy + tt * Math.cos(dr);
    S.line(330, sy, xi, yi, { stroke: p.ok, 'stroke-width': 2.4, 'stroke-dasharray': '5 4' });
    S.text((330 + xi) / 2 + 8, (sy + yi) / 2, t('true thickness', 'السمك الحقيقي'), { 'font-size': 11, 'font-weight': 700, fill: p.ok });
    S.text(30, sy + sh / 2, 'A', { 'font-size': 13, 'font-weight': 800, fill: p.data, 'text-anchor': 'end' }); S.text(530, sy + sh / 2, 'A′', { 'font-size': 13, 'font-weight': 800, fill: p.data });
  }

  /* ---------- 4. hazard radar */
  function drawRadar(r) {
    var S = SH.svgB('svgRadar'), p = SH.palette(), cx = 260, cy = 210, RR = 150;
    S.add('rect', { x: 0, y: 0, width: 520, height: 420, fill: SH.css('--il-bg') });
    S.circle(cx, cy, RR, { fill: p.bg2, stroke: p.line2, 'stroke-width': 1.5 });
    [50, 100].forEach(function (rr) { S.circle(cx, cy, rr, { fill: 'none', stroke: p.line }); });
    ['N', 'E', 'S', 'W'].forEach(function (s, i) { var a = R(i * 90); S.text(cx + (RR + 18) * Math.sin(a), cy - (RR + 18) * Math.cos(a) + 5, s, { 'font-size': 14, 'font-weight': 800, fill: p.text2, 'text-anchor': 'middle' }); });
    var sector = function (center, half, col, op) { var a0 = R(center - half), a1 = R(center + half); S.path('M' + cx + ' ' + cy + 'L' + (cx + RR * Math.sin(a0)) + ' ' + (cy - RR * Math.cos(a0)) + 'A' + RR + ' ' + RR + ' 0 0 1 ' + (cx + RR * Math.sin(a1)) + ' ' + (cy - RR * Math.cos(a1)) + 'Z', { fill: SH.alpha(col, op), stroke: col, 'stroke-width': 1 }); };
    sector(r.sf.dd, 20, r.planar ? p.warn : p.ok, r.planar ? 0.4 : 0.15);
    sector(r.sf.dd + 180, 10, r.topple ? p.warn : p.data, r.topple ? 0.4 : 0.12);
    var s = R(r.sf.dd), cr = [Math.cos(s), Math.sin(s)];
    S.line(cx - RR * cr[0], cy - RR * cr[1], cx + RR * cr[0], cy + RR * cr[1], { stroke: p.text, 'stroke-width': 5, 'stroke-linecap': 'round' });
    S.text(cx + (RR - 10) * cr[0] + 6, cy + (RR - 10) * cr[1] - 8, t('crest', 'القمة'), { 'font-size': 11, fill: p.text2 });
    var a = R(r.j1.dd); S.arrow(cx, cy, cx + RR * 0.85 * Math.sin(a), cy - RR * 0.85 * Math.cos(a), p.accent, 3, '');
    S.text(cx + (RR + 46) * Math.sin(a), cy - (RR + 46) * Math.cos(a) + 4, 'J1 ' + Math.round(r.j1.dd) + '°', { 'font-size': 12, 'font-weight': 800, fill: p.accent, 'text-anchor': 'middle' });
    var b = R(r.sf.dd); S.arrow(cx, cy, cx + RR * 0.55 * Math.sin(b), cy - RR * 0.55 * Math.cos(b), p.text, 2, '');
    S.text(18, 24, t('Slope dips toward ', 'المنحدر يميل نحو ') + Math.round(r.sf.dd) + '° (' + SH.dir16(r.sf.dd) + ')', { 'font-size': 12, fill: p.text2 });
  }

  /* ---------- 5. RMR bars */
  function drawRmr(r) {
    var S = SH.svgB('svgRmr'), p = SH.palette(), names = [t('Intact strength (UCS)', 'مقاومة الانضغاط'), 'RQD', t('Joint spacing', 'تباعد الفواصل'), t('Joint condition', 'حالة الفواصل'), t('Groundwater', 'المياه الجوفية')], mx = [15, 20, 20, 30, 15];
    S.add('rect', { x: 0, y: 0, width: 560, height: 330, fill: SH.css('--il-bg') });
    var rtl = SH.lang === 'ar', x0 = rtl ? 90 : 190, wmax = 290;
    r.p.forEach(function (v, i) {
      var y = 30 + i * 56, f = v / mx[i], col = f < 0.4 ? p.warn : f < 0.7 ? p.accent : p.ok;
      S.text(rtl ? 395 : 176, y + 24, names[i], { 'font-size': 13, 'font-weight': 700, fill: p.text, 'text-anchor': rtl ? 'start' : 'end' });
      S.add('rect', { x: x0, y: y + 6, width: wmax, height: 28, rx: 6, fill: p.bg2 });
      S.add('rect', { x: rtl ? x0 + wmax * (1 - f) : x0, y: y + 6, width: Math.max(2, wmax * f), height: 28, rx: 6, fill: col });
      S.text(rtl ? x0 - 10 : x0 + wmax + 12, y + 25, v + ' / ' + mx[i], { 'font-size': 13, 'font-weight': 800, fill: p.text, direction: 'ltr', 'text-anchor': rtl ? 'end' : 'start' });
    });
  }

  function summary(r, rc, sc) {
    var row = function (k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; };
    $('#sumTable').innerHTML = [
      row(t('Project', 'المشروع'), SH.esc(SH.val('sProject') || '—')), row(t('Lithology', 'الصخارية'), SH.esc(SH.val('sRock') || '—')),
      row('J1 (dip/dip dir.)', '<span class="ltr">' + fmtDD(r.j1.dd, r.j1.dip) + ' · ' + t('strike ', 'المضرب ') + Math.round(strikeOf(r.j1.dd)) + '°</span>'),
      r.j2 ? row('J2', '<span class="ltr">' + fmtDD(r.j2.dd, r.j2.dip) + '</span>') : '',
      r.j2 ? row(t('J1–J2 intersection', 'تقاطع J1–J2'), '<span class="ltr">' + SH.fmt(r.inter.plunge, 0) + '° → ' + SH.fmt(r.inter.trend, 0) + '°</span>') : '',
      row(t('Slope face', 'وجه المنحدر'), '<span class="ltr">' + fmtDD(r.sf.dd, r.sf.dip) + '</span>'), row(t('Friction angle φ', 'زاوية الاحتكاك φ'), r.phi + '°'),
      row(t('Apparent dip of J1 in the face', 'الميل الظاهري لـ J1 في الوجه'), SH.fmt(r.app, 1) + '°'),
      row('RMR89', r.rmr + ' · ' + t('class ', 'الصنف ') + rc[1] + ' (' + rc[2] + ') · c ' + rc[3] + ' kPa · φ ' + rc[4] + '°'),
      row('SMR', SH.fmt(r.smr, 0) + ' = ' + r.rmr + ' + (' + SH.fmt(r.F1, 2) + ' × ' + SH.fmt(r.F2, 2) + ' × ' + r.F3 + ') + ' + r.F4 + ' · ' + (r.smrMode === 'T' ? t('toppling', 'انقلاب') : t('planar', 'مستوي'))),
      row(t('Planar factor of safety', 'معامل الأمان المستوي'), isNaN(r.fs) ? '—' : SH.fmt(r.fs, 2))
    ].join('');
  }

  $('#sRun').addEventListener('click', function () { var r = analyse(); if (r) { store.save(); render(r); document.getElementById('sOut').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  $('#sDemo').addEventListener('click', function () {
    var v = { sProject: t('Road cut, km 14', 'قطع طريق، كم 14'), sRock: t('Jointed limestone', 'حجر جيري متشقق'), j1dd: 52, j1d: 38, sfdd: 60, sfd: 65, phi: 30, coh: 10, hgt: 15, gam: 26, j2dd: 128, j2d: 60 };
    for (var k in v) $('#' + k).value = v[k];
    $('#useJ2').checked = true; $('#j2box').hidden = false; updStrike();
    var r = analyse(); if (r) render(r);
  });
  document.getElementById('projSeg').addEventListener('segchange', function () { if (last) drawNet(last); });
  document.addEventListener('sh:redraw', function () { if (last) render(last); });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Run the analysis first.', 'شغّل التحليل أولاً.'), 'warn'); } });
  $('#j2box').hidden = !$('#useJ2').checked; updStrike();
  SH.$$('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { SH.svgPng($('#' + b.getAttribute('data-svg')), 'shandal-' + b.getAttribute('data-svg') + '.png', 2); }); });
  if (!isNaN(SH.num('j1dd')) && !isNaN(SH.num('sfdd'))) { var r0 = analyse(); if (r0) render(r0); }
})();
