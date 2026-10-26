/* Stereonet Lab — orientation data analysis on the lower hemisphere.
   Pole density (exponential Kamb, Vollmer 1995), Fisher set statistics (Fisher 1953), orientation tensor
   eigenvalues and Woodcock (1977) fabric shape, π-girdle axis, rose diagram of strikes, and Dips-style
   kinematic counts for planar, wedge and toppling failure (Markland 1972; Hocking 1976; Goodman & Bray 1976). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, AR = SH.lang === 'ar', G = SH.gm, R = G.R, D = G.D;
  var store = SH.persist('stereonet', ['geoName', 'nProject', 'nLat', 'nLon', 'nRef', 'nFmt', 'nSets', 'nK', 'oCont', 'oGc', 'oCone', 'kOn', 'kFdd', 'kFdip', 'kPhi', 'kLimP', 'kLimT', 'cSet']);
  var rows = SH.store.get('shandal_stereonet_rows', []), decl = null, last = null;
  var INK = '#1B232B', MUT = '#55616B', SETC = ['#B4552D', '#2F6FB2', '#2E7D5B', '#8A5A9E', '#C9A227', '#2A8FB8', '#7A4E1F', '#D35D8E'], CRIT = '#C0392B', ZONE = '#E8A33D', FR = '#2F7F7C';
  var save = function () { SH.store.set('shandal_stereonet_rows', rows); };
  var p3 = function (v) { return String(Math.round(G.norm(v)) % 360).padStart(3, '0'); };

  /* ---------- declination */
  function fmtDecl(d) { return Math.abs(d).toFixed(1) + '° ' + (d >= 0 ? 'E' : 'W'); }
  function updDecl() { var la = SH.num('nLat'), lo = SH.num('nLon'); if (!isFinite(la) || !isFinite(lo) || !SH.igrf) { decl = null; $('#nDecl').innerHTML = ''; return; }
    SH.igrf.load().then(function () { var n = new Date(); decl = SH.igrf.field(la, lo, 0, n.getFullYear() + (n.getMonth() + .5) / 12).D; $('#nDecl').innerHTML = t('Magnetic declination (IGRF-14): ', 'الانحراف المغناطيسي (IGRF-14): ') + '<b class="ltr">' + fmtDecl(decl) + '</b>'; }).catch(function () { decl = null; }); }
  ['nLat', 'nLon'].forEach(function (id) { $('#' + id).addEventListener('change', updDecl); });
  $('#nLoc').addEventListener('click', function () { SH.locate().then(function (p) { $('#nLat').value = p.lat.toFixed(6); $('#nLon').value = p.lon.toFixed(6); store.save(); updDecl(); }).catch(function (e) { SH.toast(e.message, 'bad'); }); });

  /* ---------- measurement table */
  function drawTable() {
    var fmt = $('#nFmt').value;
    var h = '<thead><tr><th>No.</th><th>' + t('Type', 'النوع') + '</th><th>' + (fmt === 'rhr' ? t('Strike (RHR) / trend', 'المضرب / الاتجاه') : t('Dip direction / trend', 'اتجاه الميل / الاتجاه')) + ' °</th><th>' + t('Dip / plunge', 'الميل / الغطس') + ' °</th><th>' + t('Set', 'المجموعة') + '</th><th>' + t('Source', 'المصدر') + '</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r, i) { var az = r.t === 'P' && fmt === 'rhr' ? G.norm(r.a - 90) : r.a;
      h += '<tr><td>' + (i + 1) + '</td><td><select data-r="' + i + '" data-k="t" style="height:34px;border-radius:8px"><option value="P"' + (r.t === 'P' ? ' selected' : '') + '>P</option><option value="L"' + (r.t === 'L' ? ' selected' : '') + '>L</option></select></td>' +
        '<td><input data-r="' + i + '" data-k="a" inputmode="decimal" value="' + (isFinite(az) ? Math.round(az * 10) / 10 : '') + '"></td><td><input data-r="' + i + '" data-k="b" inputmode="decimal" value="' + (isFinite(r.b) ? r.b : '') + '"></td>' +
        '<td><input data-r="' + i + '" data-k="s" value="' + SH.esc(r.s || '') + '" style="min-width:60px"></td><td class="xsmall muted">' + (r.src === 'phone' ? t('phone', 'الهاتف') : t('typed', 'يدوي')) + '</td><td><button class="btn btn-line btn-xs" data-del="' + i + '" type="button" aria-label="' + t('Delete', 'حذف') + '">×</button></td></tr>'; });
    $('#nIn').innerHTML = h + '</tbody>';
  }
  $('#nIn').addEventListener('change', function (e) { var i = e.target.getAttribute('data-r'), k = e.target.getAttribute('data-k'); if (i == null) return; var r = rows[+i], v = e.target.value;
    if (k === 'a') { v = parseFloat(v); if ($('#nFmt').value === 'rhr' && r.t === 'P') v = G.norm(v + 90); r.a = v; r.src = 'typed'; } else if (k === 'b') r.b = parseFloat(v); else r[k] = v; save(); });
  $('#nIn').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; rows.splice(+b.getAttribute('data-del'), 1); save(); drawTable(); });
  $('#nAdd').addEventListener('click', function () { rows.push({ t: 'P', a: NaN, b: NaN, s: '', src: 'typed' }); save(); drawTable(); });
  $('#nClear').addEventListener('click', function () { if (!rows.length) return; rows = []; save(); drawTable(); });
  $('#nFmt').addEventListener('change', drawTable);
  function parse(txt) {
    var n = 0, fmt = $('#nFmt').value;
    txt.split(/\r?\n/).forEach(function (line) { var c = line.split(/[,;\t]+|\s{2,}|\s(?=[\d.-])/).map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; }); if (!c.length) return;
      var typ = 'P'; if (/^[PL]$/i.test(c[0])) typ = c.shift().toUpperCase(); var a = parseFloat(c[0]), b = parseFloat(c[1]); if (!isFinite(a) || !isFinite(b) || b < 0 || b > 90) return;
      if (typ === 'P' && fmt === 'rhr') a = G.norm(a + 90); rows.push({ t: typ, a: G.norm(a), b: b, s: c[2] || '', src: 'typed' }); n++; });
    save(); drawTable(); return n;
  }
  $('#nPasteGo').addEventListener('click', function () { var n = parse($('#nPaste').value); SH.toast(n + t(' measurements added.', ' قياس أضيف.'), n ? 'ok' : 'warn'); if (n) $('#nPaste').value = ''; });
  $('#nFileBtn').addEventListener('click', function () { $('#nFile').click(); });
  $('#nFile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { var n = parse(rd.result); SH.toast(n + t(' measurements added.', ' قياس أضيف.'), n ? 'ok' : 'warn'); }; rd.readAsText(f); this.value = ''; });

  /* ---------- compass */
  var buf = [], cur = null, on = false;
  function onOri(e) {
    if (!on) return; var al = e.alpha, be = e.beta, ga = e.gamma; if (typeof e.webkitCompassHeading === 'number') al = 360 - e.webkitCompassHeading; if (al == null || be == null || ga == null) return;
    var a = R(al), b = R(be), g = R(ga), nx = Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g), ny = Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g), nz = Math.cos(b) * Math.cos(g);
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    var dd = G.norm(D(Math.atan2(nx, ny)) + (decl || 0)), dip = D(Math.acos(Math.max(-1, Math.min(1, nz)))); buf.push(G.poleVec(dd, dip)); if (buf.length > 30) buf.shift();
    var f = G.fisher(buf), pl = G.poleToPlane(f.v); cur = pl; $('#cDd').textContent = p3(pl.dd) + '°'; $('#cDip').textContent = Math.round(pl.dip) + '°'; $('#cA95').textContent = isFinite(f.a95) ? f.a95.toFixed(1) + '°' : '—';
  }
  $('#cStart').addEventListener('click', function () {
    function go() { on = true; $('#cLive').hidden = false; buf = []; if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri); else window.addEventListener('deviceorientation', onOri);
      if (decl == null) SH.toast(t('Enter the position to correct readings to true north.', 'أدخل الموقع لتصحيح القراءات إلى الشمال الجغرافي.'), 'warn', 5000); }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') go(); }).catch(function () {}); else go();
  });
  $('#cRec').addEventListener('click', function () { if (!cur) return SH.toast(t('No compass reading yet.', 'لا توجد قراءة بعد.'), 'warn'); rows.push({ t: 'P', a: Math.round(cur.dd * 10) / 10, b: Math.round(cur.dip * 10) / 10, s: SH.val('cSet') || '', src: 'phone' }); save(); drawTable(); SH.toast((SH.val('cSet') || 'P') + ' ' + G.att(cur.dd, cur.dip), 'ok'); });

  /* ---------- analysis */
  function analyse() {
    var magShift = $('#nRef').value === 'mag' && decl != null ? decl : 0;
    var P = [], Lns = [];
    rows.forEach(function (r) { if (!isFinite(r.a) || !isFinite(r.b)) return; var a = G.norm(r.a + (r.src === 'phone' ? 0 : magShift)); if (r.t === 'L') Lns.push({ tr: a, pl: r.b, s: r.s, v: G.lineVec(a, r.b) }); else P.push({ dd: a, dip: Math.min(90, r.b), s: (r.s || '').trim(), v: G.poleVec(a, Math.min(90, r.b)) }); });
    if (P.length < 3) { SH.toast(t('Enter at least three planes.', 'أدخل ثلاثة مستويات على الأقل.'), 'warn'); return null; }
    var mode = $('#nSets').value, k = SH.clamp(Math.round(SH.num('nK') || 3), 1, 6);
    if (mode === 'auto') { var lab = G.kmeans(P.map(function (p) { return p.v; }), k); var cnt = {}; lab.forEach(function (l) { cnt[l] = (cnt[l] || 0) + 1; }); var ord = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }); P.forEach(function (p, i) { p.set = 'S' + (ord.indexOf(String(lab[i])) + 1); }); }
    else P.forEach(function (p) { p.set = p.s || '—'; });
    var names = []; P.forEach(function (p) { if (names.indexOf(p.set) < 0) names.push(p.set); }); names.sort(function (a, b) { return a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b, 'en', { numeric: true }); });
    var sets = names.filter(function (n) { return n !== '—'; }).map(function (n, i) { var m = P.filter(function (p) { return p.set === n; }), f = G.fisher(m.map(function (p) { return p.v; })), pl = G.poleToPlane(f.v); return { name: n, n: m.length, f: f, dd: pl.dd, dip: pl.dip, col: SETC[i % SETC.length] }; });
    var fab = G.fabric(P.map(function (p) { return p.v; })), e3 = G.vecLine(fab.e[2].vec), e1 = G.vecLine(fab.e[0].vec);
    var r = { P: P, L: Lns, sets: sets, fab: fab, beta: e3, e1: e1, mode: mode, k: k };
    if ($('#kOn').checked) {
      var F = { dd: G.norm(SH.num('kFdd')), dip: SH.num('kFdip') }, phi = SH.num('kPhi'), limP = SH.num('kLimP') || 20, limT = SH.num('kLimT') || 10;
      if (isFinite(F.dd) && F.dip > 0 && isFinite(phi)) {
        var nP = 0, nT = 0; P.forEach(function (p) { var q = G.planeTests(p, F, phi, limP, limT); p.planar = q.planar; p.topple = q.topple; if (q.planar) nP++; if (q.topple) nT++; });
        var nW = 0, nPairs = 0, crit = []; var N = P.length, stride = N > 300 ? Math.ceil(N * (N - 1) / 2 / 45000) : 1, c = 0;
        for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) { if ((c++ % stride) !== 0) continue; var L = G.inter(P[i], P[j]); if (!isFinite(L.plunge)) continue; nPairs++; if (G.wedgeTest(L, F, phi)) { nW++; if (crit.length < 4000) crit.push(L); } }
        sets.forEach(function (s) { var q = G.planeTests(s, F, phi, limP, limT); s.planar = q.planar; s.topple = q.topple; });
        var sw = []; for (i = 0; i < sets.length; i++) for (j = i + 1; j < sets.length; j++) { var Ls = G.inter(sets[i], sets[j]); sw.push({ a: sets[i], b: sets[j], L: Ls, kin: G.wedgeTest(Ls, F, phi) }); }
        r.kin = { F: F, phi: phi, limP: limP, limT: limT, nP: nP, nT: nT, nW: nW, nPairs: nPairs, crit: crit, sw: sw };
      }
    }
    return r;
  }

  /* ---------- drawing helpers */
  function halo(S, x, y, s, a) { return S.text(x, y, s, Object.assign({ fill: INK, stroke: '#fff', 'stroke-width': 3.2, 'paint-order': 'stroke', 'stroke-linejoin': 'round', direction: 'ltr', 'font-size': 11, 'font-weight': 800 }, a || {})); }
  function frame(S, W, H, title) { S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + H); S.add('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }); S.add('rect', { x: 6, y: 6, width: W - 12, height: H - 12, fill: 'none', stroke: INK, 'stroke-width': 1.1 }); S.text(20, 30, title, { 'font-size': 11.5, 'font-weight': 700, fill: INK, direction: 'ltr' }); S.text(16, H - 14, 'Shandal System · ' + new Date().toISOString().slice(0, 10), { 'font-size': 9.5, fill: MUT, direction: 'ltr' }); }
  function legend(S, x, y, w, items, rh) { rh = rh || 21; S.add('rect', { x: x, y: y, width: w, height: 30 + items.length * rh, fill: '#fff', stroke: INK, 'stroke-width': .9 }); S.text(x + 10, y + 18, 'LEGEND', { 'font-size': 10.5, 'font-weight': 800, fill: INK, 'letter-spacing': 1.2 });
    items.forEach(function (it, i) { var yy = y + 36 + i * rh; it[0](x + 10, yy); S.text(x + 46, yy + 4, it[1], { 'font-size': 10, fill: INK, direction: 'ltr' }); if (it[2]) S.text(x + 46, yy + 18, it[2], { 'font-size': 9.5, fill: MUT, direction: 'rtl', 'text-anchor': 'end' }); }); }
  function net(S, cx, cy, RR, P, grid) {
    S.circle(cx, cy, RR, { fill: '#FBFAF6' });
    if (grid) { var g = S.g({ stroke: '#E1E4E7', 'stroke-width': .7, fill: 'none' }); for (var d = 10; d < 90; d += 10) { S.path(S.pl(G.greatCircle(P, 90, d)), {}, g); S.path(S.pl(G.greatCircle(P, 270, d)), {}, g); } }
    S.line(cx, cy - RR, cx, cy + RR, { stroke: '#C6CBD0', 'stroke-width': .7 }); S.line(cx - RR, cy, cx + RR, cy, { stroke: '#C6CBD0', 'stroke-width': .7 });
    for (var a = 0; a < 360; a += 10) { var l = a % 30 === 0 ? 9 : 5; S.line(cx + RR * Math.sin(R(a)), cy - RR * Math.cos(R(a)), cx + (RR + l) * Math.sin(R(a)), cy - (RR + l) * Math.cos(R(a)), { stroke: INK, 'stroke-width': .8 }); if (a % 30 === 0 && a) S.text(cx + (RR + 22) * Math.sin(R(a)), cy - (RR + 22) * Math.cos(R(a)) + 4, p3(a), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    S.text(cx, cy - RR - 16, 'N', { 'font-size': 15, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' });
  }
  var placer = function (S) { var used = []; return function (x, y, s, col) { var w = s.length * 7 + 4, cand = [[9, -8], [9, 14], [-9 - w, -8], [-9 - w, 14], [9, -22], [-9 - w, -22], [9, 28], [-9 - w, 28]], best = cand[0];
    for (var i = 0; i < cand.length; i++) { var bx = x + cand[i][0], by = y + cand[i][1]; if (!used.some(function (q) { return bx < q[0] + q[2] && bx + w > q[0] && by - 11 < q[1] && by + 2 > q[1] - 11; })) { best = cand[i]; break; } }
    used.push([x + best[0], y + best[1], w]); halo(S, x + best[0], y + best[1], s, { fill: col }); }; };
  var symLine = function (S, col, w, da) { return function (x, y) { S.line(x, y, x + 28, y, { stroke: col, 'stroke-width': w || 2, 'stroke-dasharray': da || null }); }; };
  var symFill = function (S, col, op) { return function (x, y) { S.add('rect', { x: x, y: y - 7, width: 28, height: 14, fill: SH.alpha(col, op || .3), stroke: col, 'stroke-width': .8 }); }; };
  var symDot = function (S, col, r) { return function (x, y) { S.circle(x + 14, y, r || 3, { fill: col }); }; };
  var MUDC = ['#FFF6D5', '#FDE4A6', '#F9C57A', '#F09B57', '#DC6B43', '#B8442F', '#8A2A22'];

  /* ---------- 1. pole density */
  function drawN1(r) {
    var S = SH.svgB('svgN1'), mode = SH.seg('projSeg') || 'area', cx = 290, cy = 312, RR = 240, P = G.projector(cx, cy, RR, mode), defs = S.add('defs', {});
    frame(S, 760, 600, 'Poles to planes · lower hemisphere · ' + (mode === 'area' ? 'equal-area (Schmidt)' : 'equal-angle (Wulff)') + ' · n = ' + r.P.length); net(S, cx, cy, RR, P, false);
    var lv = [];
    if ($('#oCont').checked) {
      var Gd = G.density(r.P.map(function (p) { return p.v; }), P, cx, cy, RR, 81); r.dens = Gd;
      var cl = S.add('clipPath', { id: 'n1clip' }, null, defs); S.circle(cx, cy, RR, {}, cl); var g = S.g({ 'clip-path': 'url(#n1clip)' });
      var steps = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32].filter(function (v) { return v < Gd.max; }); lv = steps;
      steps.forEach(function (L, i) { var col = MUDC[Math.min(i, MUDC.length - 1)]; for (var j = 0; j < Gd.n; j++) for (var q = 0; q < Gd.n; q++) { var v = Gd.g[j][q]; if (v >= L && (i === steps.length - 1 || v < steps[i + 1])) S.add('rect', { x: Gd.x0 + q * Gd.step - Gd.step / 2, y: Gd.y0 + j * Gd.step - Gd.step / 2, width: Gd.step + .6, height: Gd.step + .6, fill: col }, null, g); } });
      steps.forEach(function (L) { var seg = G.contour(Gd, L); if (seg.length) S.path(seg.map(function (s) { return 'M' + s[0][0].toFixed(1) + ' ' + s[0][1].toFixed(1) + 'L' + s[1][0].toFixed(1) + ' ' + s[1][1].toFixed(1); }).join(''), { stroke: '#6B3A1E', 'stroke-width': .8, fill: 'none' }, g); });
    }
    if ($('#oGc').checked) { var gg = S.g({ stroke: '#9AA3AD', 'stroke-width': .6, fill: 'none', opacity: .8 }); r.P.forEach(function (p) { S.path(S.pl(G.greatCircle(P, p.dd, p.dip, 4)), {}, gg); }); }
    var colOf = {}; r.sets.forEach(function (s) { colOf[s.name] = s.col; });
    r.P.forEach(function (p) { var q = P.xy(p.dd + 180, 90 - p.dip); S.circle(q[0], q[1], 2.6, { fill: colOf[p.set] || '#555', stroke: '#fff', 'stroke-width': .5 }); });
    r.L.forEach(function (l) { var q = P.xy(l.tr, l.pl); S.add('rect', { x: q[0] - 3, y: q[1] - 3, width: 6, height: 6, fill: '#fff', stroke: INK, 'stroke-width': 1.2 }); });
    var put = placer(S);
    if ($('#oCone').checked) r.sets.forEach(function (s) { var m = G.vecLine(s.f.v), q = P.xy(m.trend, m.plunge); if (isFinite(s.f.a95) && s.n > 1) S.path(S.pl(G.smallCircle(P, m.trend, m.plunge, Math.max(s.f.a95, .5))) + 'Z', { fill: 'none', stroke: s.col, 'stroke-width': 1.6 }); S.circle(q[0], q[1], 5.5, { fill: s.col, stroke: '#fff', 'stroke-width': 1.4 }); put(q[0], q[1], s.name + ' ' + G.att(s.dd, s.dip), s.col); });
    S.circle(cx, cy, RR, { fill: 'none', stroke: INK, 'stroke-width': 1.8 });
    var items = r.sets.map(function (s) { return [symDot(S, s.col, 3.5), s.name + ' poles (n = ' + s.n + ')']; });
    if (r.P.some(function (p) { return p.set === '—'; })) items.push([symDot(S, '#555'), 'Unassigned poles']);
    if (r.L.length) items.push([function (x, y) { S.add('rect', { x: x + 11, y: y - 3, width: 6, height: 6, fill: '#fff', stroke: INK, 'stroke-width': 1.2 }); }, 'Lines (n = ' + r.L.length + ')']);
    if ($('#oCone').checked) items.push([function (x, y) { S.circle(x + 14, y, 6, { fill: 'none', stroke: INK, 'stroke-width': 1.4 }); S.circle(x + 14, y, 3, { fill: INK }); }, 'Mean pole and α95 cone']);
    lv.forEach(function (L, i) { items.push([symFill(S, MUDC[Math.min(i, MUDC.length - 1)], 1), '≥ ' + L + ' MUD']); });
    legend(S, 560, 54, 186, items.slice(0, 22), 20);
    var top = r.sets.slice().sort(function (a, b) { return b.n - a.n; })[0];
    $('#capN1').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + r.P.length + t(' poles to planes', ' قطباً للمستويات') + (r.L.length ? t(' and ', ' و') + r.L.length + t(' lines', ' خطاً') : '') + (r.mode === 'auto' ? t(', sets by axial k-means (k = ', '، والمجموعات بطريقة k-means المحورية (k = ') + r.k + ')' : t(', sets from the set column', '، والمجموعات من عمود المجموعة')) + '.' +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('pole density by the exponential Kamb method (Vollmer 1995) in multiples of a uniform distribution (MUD), maximum ', 'كثافة الأقطاب بطريقة Kamb الأسية (Vollmer 1995) بمضاعفات التوزيع المنتظم (MUD)، وأقصاها ') + (r.dens ? SH.fmt(r.dens.max, 1) : '—') + ' MUD' + t('; Fisher mean pole and 95 % confidence cone of each set.', '؛ والقطب المتوسط بطريقة Fisher ومخروط الثقة 95 % لكل مجموعة.') +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (top ? t('the dominant set is ', 'المجموعة السائدة هي ') + top.name + ' ' + G.att(top.dd, top.dip) + ' (n = ' + top.n + ', k = ' + (isFinite(top.f.k) ? SH.fmt(top.f.k, 0) : '∞') + ')' + (top.f.k < 20 ? t('; its dispersion is high and the set orientation should be confirmed by further readings.', '؛ وتشتتها مرتفع ويُستحسن تأكيد اتجاهها بقراءات إضافية.') : t('; its poles are tightly clustered.', '؛ وأقطابها متجمعة بإحكام.')) : '');
  }

  /* ---------- 2. set great circles and fabric */
  function drawN2(r) {
    var S = SH.svgB('svgN2'), mode = SH.seg('projSeg') || 'area', cx = 290, cy = 312, RR = 240, P = G.projector(cx, cy, RR, mode);
    frame(S, 760, 600, 'Mean planes of the sets, intersections and eigenvectors · lower hemisphere · ' + (mode === 'area' ? 'equal-area' : 'equal-angle')); net(S, cx, cy, RR, P, true);
    r.sets.forEach(function (s) { S.path(S.pl(G.greatCircle(P, s.dd, s.dip)), { fill: 'none', stroke: s.col, 'stroke-width': 2.2 }); });
    var put = placer(S);
    for (var i = 0; i < r.sets.length; i++) for (var j = i + 1; j < r.sets.length; j++) { var L = G.inter(r.sets[i], r.sets[j]), q = P.xy(L.trend, L.plunge); S.circle(q[0], q[1], 5, { fill: '#fff', stroke: INK, 'stroke-width': 1.8 }); put(q[0], q[1], 'I' + (i + 1) + (j + 1) + ' ' + G.lin(L.trend, L.plunge), INK); }
    var ev = r.fab.e.map(function (e) { return G.vecLine(e.vec); });
    [['E1', ev[0], '#B23A2E'], ['E2', ev[1], '#C9A227'], ['E3', ev[2], '#2F6FB2']].forEach(function (e) { var q = P.xy(e[1].trend, e[1].plunge); S.path('M' + (q[0] - 6) + ' ' + q[1] + 'L' + q[0] + ' ' + (q[1] - 7) + 'L' + (q[0] + 6) + ' ' + q[1] + 'L' + q[0] + ' ' + (q[1] + 7) + 'Z', { fill: e[2], stroke: '#fff', 'stroke-width': 1 }); put(q[0], q[1], e[0] + ' ' + G.lin(e[1].trend, e[1].plunge), e[2]); });
    var girdle = isFinite(r.fab.K) && r.fab.K < 1; if (girdle) { var pg = G.poleToPlane(r.fab.e[2].vec); S.path(S.pl(G.greatCircle(P, pg.dd, pg.dip)), { fill: 'none', stroke: '#2F6FB2', 'stroke-width': 1.4, 'stroke-dasharray': '8 4' }); }
    S.circle(cx, cy, RR, { fill: 'none', stroke: INK, 'stroke-width': 1.8 });
    var items = r.sets.map(function (s) { return [symLine(S, s.col, 2.2), s.name + ' mean plane ' + G.att(s.dd, s.dip)]; });
    items.push([function (x, y) { S.circle(x + 14, y, 4.5, { fill: '#fff', stroke: INK, 'stroke-width': 1.6 }); }, 'Intersection of mean planes'], [function (x, y) { S.path('M' + (x + 8) + ' ' + y + 'l6 -6l6 6l-6 6z', { fill: '#B23A2E' }); }, 'Eigenvectors E1 · E2 · E3']);
    if (girdle) items.push([symLine(S, '#2F6FB2', 1.4, '8 4'), 'π-girdle (best-fit great circle)']);
    legend(S, 560, 54, 186, items);
    $('#capN2').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('the orientation tensor of all poles and the Fisher mean plane of each set.', 'موتر الاتجاه لجميع الأقطاب والمستوى المتوسط لكل مجموعة بطريقة Fisher.') +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('eigenvalues S1 = ', 'القيم الذاتية S1 = ') + SH.fmt(r.fab.S1, 3) + '، S2 = ' + SH.fmt(r.fab.S2, 3) + '، S3 = ' + SH.fmt(r.fab.S3, 3) + t('; Woodcock shape K = ln(S1/S2)/ln(S2/S3) = ', '؛ ومعامل الشكل لـ Woodcock K = ln(S1/S2)/ln(S2/S3) = ') + (isFinite(r.fab.K) ? SH.fmt(r.fab.K, 2) : '∞') + t(' and strength C = ln(S1/S3) = ', ' والقوة C = ln(S1/S3) = ') + SH.fmt(r.fab.C, 2) + '.' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (girdle ? t('K < 1 indicates a girdle distribution of poles; E3 = ', 'K < 1 يدل على توزيع حزامي للأقطاب؛ والمحور E3 = ') + G.lin(r.beta.trend, r.beta.plunge) + t(' is the pole to the π-girdle, i.e. the statistical fold axis (β) if the planes are folded bedding.', ' هو قطب الحزام π، أي محور الطية الإحصائي (β) إذا كانت المستويات تطبقاً مطوياً.') : t('K > 1 indicates a cluster distribution; E1 = ', 'K > 1 يدل على توزيع عنقودي؛ والمحور E1 = ') + G.lin(r.e1.trend, r.e1.plunge) + t(' is the dominant pole direction.', ' هو الاتجاه السائد للأقطاب.')) + (r.fab.C < 2 ? t(' The low strength C indicates a weakly organised fabric.', ' وتدل القيمة المنخفضة لـ C على نسيج ضعيف التنظيم.') : '');
  }

  /* ---------- 3. rose diagram of strikes */
  function drawN3(r) {
    var S = SH.svgB('svgN3'), cx = 290, cy = 290, RR = 210, bins = new Array(18).fill(0);
    frame(S, 760, 560, 'Rose diagram of strikes (right-hand rule, bidirectional) · 10° bins · petal area ∝ frequency · n = ' + r.P.length);
    r.P.forEach(function (p) { bins[Math.floor(G.norm(p.dd - 90) % 180 / 10) % 18]++; });
    var mx = Math.max.apply(null, bins), N = r.P.length;
    [0.25, 0.5, 0.75, 1].forEach(function (f) { S.circle(cx, cy, RR * Math.sqrt(f), { fill: 'none', stroke: '#DCDFE2', 'stroke-dasharray': f < 1 ? '3 3' : null }); halo(S, cx + 4, cy - RR * Math.sqrt(f) + 12, SH.fmt(100 * f * mx / N, 1) + ' %', { 'font-size': 9.5, fill: MUT, 'font-weight': 600 }); });
    S.circle(cx, cy, RR, { fill: 'none', stroke: INK, 'stroke-width': 1.4 });
    var petal = function (a0, rr) { var a1 = a0 + 10; return 'M' + cx + ' ' + cy + 'L' + (cx + rr * Math.sin(R(a0))) + ' ' + (cy - rr * Math.cos(R(a0))) + 'A' + rr + ' ' + rr + ' 0 0 1 ' + (cx + rr * Math.sin(R(a1))) + ' ' + (cy - rr * Math.cos(R(a1))) + 'Z'; };
    bins.forEach(function (c, i) { if (!c) return; var rr = RR * Math.sqrt(c / mx); [i * 10, i * 10 + 180].forEach(function (a0) { S.path(petal(a0, rr), { fill: SH.alpha('#B4552D', .55), stroke: '#8A3A1E', 'stroke-width': .8 }); }); });
    for (var a = 0; a < 360; a += 10) { var l = a % 30 === 0 ? 9 : 5; S.line(cx + RR * Math.sin(R(a)), cy - RR * Math.cos(R(a)), cx + (RR + l) * Math.sin(R(a)), cy - (RR + l) * Math.cos(R(a)), { stroke: INK, 'stroke-width': .8 }); if (a % 30 === 0 && a) S.text(cx + (RR + 22) * Math.sin(R(a)), cy - (RR + 22) * Math.cos(R(a)) + 4, p3(a), { 'font-size': 10, fill: MUT, 'text-anchor': 'middle', direction: 'ltr' }); }
    S.text(cx, cy - RR - 16, 'N', { 'font-size': 15, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' });
    var sx = 0, sy = 0; r.P.forEach(function (p) { var s2 = R(2 * G.norm(p.dd - 90)); sx += Math.sin(s2); sy += Math.cos(s2); }); var ms = G.norm(D(Math.atan2(sx, sy)) / 2), Rb = Math.hypot(sx, sy) / N;
    S.line(cx - (RR + 4) * Math.sin(R(ms)), cy + (RR + 4) * Math.cos(R(ms)), cx + (RR + 4) * Math.sin(R(ms)), cy - (RR + 4) * Math.cos(R(ms)), { stroke: INK, 'stroke-width': 1.6, 'stroke-dasharray': '7 4' });
    var top = bins.indexOf(mx);
    legend(S, 560, 54, 186, [[symFill(S, '#B4552D', .55), 'Strike frequency'], [symLine(S, INK, 1.6, '7 4'), 'Mean strike ' + p3(ms) + '° / ' + p3(ms + 180) + '°'], [function () {}, 'Modal class ' + (top * 10) + '–' + (top * 10 + 10) + '°'], [function () {}, 'Mean resultant length R̄ = ' + SH.fmt(Rb, 2)]]);
    $('#capN3').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('strikes of ', 'مضارب ') + N + t(' planes (right-hand rule), treated as axial data.', ' مستوياً (قاعدة اليد اليمنى) بوصفها بيانات محورية.') + '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('the modal class is ', 'الفئة المنوالية ') + (top * 10) + '–' + (top * 10 + 10) + '° (' + SH.fmt(100 * mx / N, 1) + ' %)' + t('; the axial mean strike is ', '؛ والمضرب المتوسط المحوري ') + p3(ms) + '° ' + t('with R̄ = ', 'مع R̄ = ') + SH.fmt(Rb, 2) + '.' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (Rb > 0.6 ? t('strikes are strongly preferred along ', 'المضارب ذات اتجاه مفضل قوي على امتداد ') + p3(ms) + '–' + p3(ms + 180) + '°' + t(', indicating one dominant structural trend.', '، مما يدل على اتجاه تركيبي سائد واحد.') : Rb > 0.3 ? t('a moderate preferred trend exists with secondary directions, consistent with more than one joint set.', 'يوجد اتجاه مفضل متوسط مع اتجاهات ثانوية، بما يتوافق مع أكثر من مجموعة فواصل.') : t('strikes are widely dispersed; several sets or a random fracture pattern are present.', 'المضارب متشتتة على نطاق واسع؛ أي توجد عدة مجموعات أو نمط تكسّر عشوائي.'));
  }

  /* ---------- 4. kinematic analysis */
  function drawN4(r) {
    var k = r.kin, S = SH.svgB('svgN4'), mode = SH.seg('projSeg') || 'area', cx = 290, cy = 312, RR = 240, P = G.projector(cx, cy, RR, mode), F = k.F, phi = k.phi;
    frame(S, 760, 600, 'Kinematic analysis · dip vectors and intersections · face ' + G.att(F.dd, F.dip) + ' · φ = ' + phi + '°'); net(S, cx, cy, RR, P, true);
    var cres = function (lim) { var z = [], q; for (q = -lim; q <= lim; q += 2) z.push(P.xy(F.dd + q, phi)); for (q = lim; q >= -lim; q -= 2) z.push(P.xy(F.dd + q, Math.max(phi, G.appDip(F.dip, F.dd, F.dd + q)))); return z; };
    if (F.dip > phi) { S.poly(cres(88), { fill: SH.alpha(ZONE, .14) }); S.poly(cres(k.limP), { fill: SH.alpha(CRIT, .16), stroke: CRIT, 'stroke-width': .9, 'stroke-dasharray': '4 3' }); }
    var tmin = 90 - F.dip + phi; if (tmin < 90) { var tz = [P.xy(0, 90)]; for (var q2 = -k.limT; q2 <= k.limT; q2 += 2) tz.push(P.xy(F.dd + 180 + q2, tmin)); S.poly(tz, { fill: SH.alpha('#8A5A9E', .16), stroke: '#8A5A9E', 'stroke-width': .9, 'stroke-dasharray': '4 3' }); }
    var fr = []; for (var a = 0; a <= 360; a += 3) fr.push(P.xy(a, phi)); S.path(S.pl(fr) + 'Z', { fill: 'none', stroke: FR, 'stroke-width': 1.5, 'stroke-dasharray': '7 4' });
    S.path(S.pl(G.greatCircle(P, F.dd, F.dip)), { fill: 'none', stroke: INK, 'stroke-width': 2.6 });
    k.crit.slice(0, 1500).forEach(function (L) { var q = P.xy(L.trend, L.plunge); S.circle(q[0], q[1], 1.2, { fill: SH.alpha(CRIT, .45) }); });
    r.P.forEach(function (p) { var q = P.xy(p.dd, p.dip), c = p.planar ? CRIT : p.topple ? '#8A5A9E' : '#6B7680', s = 3; S.path('M' + (q[0] - s) + ' ' + (q[1] - s) + 'L' + (q[0] + s) + ' ' + (q[1] + s) + 'M' + (q[0] + s) + ' ' + (q[1] - s) + 'L' + (q[0] - s) + ' ' + (q[1] + s), { stroke: c, 'stroke-width': 1.4 }); });
    var put = placer(S);
    k.sw.forEach(function (w, i) { var q = P.xy(w.L.trend, w.L.plunge); S.circle(q[0], q[1], 5.5, { fill: '#fff', stroke: w.kin ? CRIT : INK, 'stroke-width': 2 }); put(q[0], q[1], w.a.name + '∩' + w.b.name, w.kin ? CRIT : INK); });
    S.circle(cx, cy, RR, { fill: 'none', stroke: INK, 'stroke-width': 1.8 });
    var pc = function (n, d) { return d ? SH.fmt(100 * n / d, 1) + ' %' : '—'; };
    legend(S, 560, 54, 186, [[symLine(S, INK, 2.6), 'Slope face ' + G.att(F.dd, F.dip)], [symLine(S, FR, 1.5, '7 4'), 'Friction circle φ = ' + phi + '°'], [symFill(S, CRIT, .25), 'Planar zone ±' + k.limP + '°'], [symFill(S, ZONE, .22), 'Wedge zone'], [symFill(S, '#8A5A9E', .22), 'Toppling zone ±' + k.limT + '°'],
      [function (x, y) { S.path('M' + (x + 10) + ' ' + (y - 3) + 'l6 6m0 -6l-6 6', { stroke: CRIT, 'stroke-width': 1.6 }); }, 'Critical dip vector'], [function (x, y) { S.path('M' + (x + 10) + ' ' + (y - 3) + 'l6 6m0 -6l-6 6', { stroke: '#6B7680', 'stroke-width': 1.6 }); }, 'Non-critical dip vector'], [symDot(S, SH.alpha(CRIT, .6), 1.8), 'Critical intersection'],
      [function () {}, 'Planar ' + pc(k.nP, r.P.length) + ' · Wedge ' + pc(k.nW, k.nPairs)], [function () {}, 'Toppling ' + pc(k.nT, r.P.length)]]);
    $('#nKin').innerHTML = '<thead><tr><th>' + t('Mode', 'النمط') + '</th><th class="num">' + t('Critical', 'الحرجة') + '</th><th class="num">' + t('Total', 'المجموع') + '</th><th class="num">%</th><th>' + t('Critical set means', 'متوسطات المجموعات الحرجة') + '</th></tr></thead><tbody>' +
      [[t('Planar sliding', 'انزلاق مستوٍ'), k.nP, r.P.length, r.sets.filter(function (s) { return s.planar; }).map(function (s) { return s.name; })], [t('Wedge sliding', 'انزلاق إسفيني'), k.nW, k.nPairs, k.sw.filter(function (w) { return w.kin; }).map(function (w) { return w.a.name + '∩' + w.b.name; })], [t('Flexural toppling', 'انقلاب انحنائي'), k.nT, r.P.length, r.sets.filter(function (s) { return s.topple; }).map(function (s) { return s.name; })]]
        .map(function (x) { return '<tr><td><b>' + x[0] + '</b></td><td class="num">' + x[1] + '</td><td class="num">' + x[2] + '</td><td class="num">' + pc(x[1], x[2]) + '</td><td class="ltr">' + (x[3].join(', ') || '—') + '</td></tr>'; }).join('') + '</tbody>';
    var hi = [[k.nP / r.P.length, t('planar sliding', 'الانزلاق المستوي')], [k.nPairs ? k.nW / k.nPairs : 0, t('wedge sliding', 'الانزلاق الإسفيني')], [k.nT / r.P.length, t('flexural toppling', 'الانقلاب الانحنائي')]].sort(function (a, b) { return b[0] - a[0]; })[0];
    $('#capN4').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('slope face ', 'وجه المنحدر ') + G.att(F.dd, F.dip) + '، φ = ' + phi + '°، ' + t('lateral limits ±', 'الحدود الجانبية ±') + k.limP + '° / ±' + k.limT + '°، ' + r.P.length + t(' planes and ', ' مستوياً و') + k.nPairs + t(' intersections.', ' خط تقاطع.') +
      '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('critical fractions: planar ', 'النسب الحرجة: مستوٍ ') + pc(k.nP, r.P.length) + t('، wedge ', '، إسفيني ') + pc(k.nW, k.nPairs) + t('، toppling ', '، انقلاب ') + pc(k.nT, r.P.length) + '.' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (hi[0] > 0.05 ? hi[1] + t(' is the most probable mechanism (', ' هو الآلية الأكثر احتمالاً (') + SH.fmt(100 * hi[0], 1) + ' %)' + t('; the factor of safety of the governing blocks should be computed in the Structural & Geotechnical Survey.', '؛ ويُحسب معامل أمان الكتل الحاكمة في المسح التركيبي والجيوتقني.') : t('fewer than 5 % of the measurements are critical for any mode; the face orientation is kinematically favourable.', 'أقل من 5 % من القياسات حرجة لأي نمط؛ واتجاه الوجه ملائم حركياً.'));
  }

  /* ---------- 5. hazard radar */
  function drawN5(r) {
    var k = r.kin, F = k.F, S = SH.svgB('svgN5'), cx = 290, cy = 292, RR = 206;
    frame(S, 760, 560, 'Plan view of the slope crest · arrow length ∝ dip'); if (AR) S.text(20, 48, 'منظر علوي لقمة المنحدر · طول السهم يتناسب مع الميل', { 'font-size': 11, fill: MUT, direction: 'rtl', 'text-anchor': 'end' });
    S.circle(cx, cy, RR, { fill: '#FBFAF6', stroke: INK, 'stroke-width': 1.4 }); [30, 60].forEach(function (d) { S.circle(cx, cy, RR * d / 90, { fill: 'none', stroke: '#C9CED3', 'stroke-dasharray': '3 3' }); halo(S, cx + 4, cy - RR * d / 90 - 3, d + '°', { 'font-size': 9.5, fill: MUT, 'font-weight': 600 }); });
    var sector = function (c, h, col, op) { var a0 = R(c - h), a1 = R(c + h); S.path('M' + cx + ' ' + cy + 'L' + (cx + RR * Math.sin(a0)) + ' ' + (cy - RR * Math.cos(a0)) + 'A' + RR + ' ' + RR + ' 0 0 1 ' + (cx + RR * Math.sin(a1)) + ' ' + (cy - RR * Math.cos(a1)) + 'Z', { fill: SH.alpha(col, op), stroke: col }); };
    var anyP = r.sets.some(function (s) { return s.planar; }) || k.nP > 0, anyT = r.sets.some(function (s) { return s.topple; }) || k.nT > 0;
    sector(F.dd, k.limP, anyP ? CRIT : '#7A8B8F', anyP ? .3 : .12); sector(F.dd + 180, k.limT, anyT ? '#8A5A9E' : '#7A8B8F', anyT ? .3 : .12);
    ['N', 'E', 'S', 'W'].forEach(function (c, i) { var a = R(i * 90), x = cx + (RR + 24) * Math.sin(a), y = cy - (RR + 24) * Math.cos(a) + 5; S.text(x, y, c, { 'font-size': 14, 'font-weight': 800, fill: INK, 'text-anchor': 'middle' }); });
    var s = R(F.dd); S.line(cx - RR * Math.cos(s), cy - RR * Math.sin(s), cx + RR * Math.cos(s), cy + RR * Math.sin(s), { stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' });
    S.arrow(cx, cy, cx + RR * F.dip / 90 * Math.sin(s), cy - RR * F.dip / 90 * Math.cos(s), INK, 2.4, '');
    var tags = [], tag = function (a, rr, txt, col) { var x = cx + rr * Math.sin(a), y = cy - rr * Math.cos(a); tags.forEach(function (q) { if (Math.abs(q[0] - x) < 70 && Math.abs(q[1] - y) < 14) y += 16; }); tags.push([x, y]); halo(S, x, y, txt, { fill: col, 'text-anchor': Math.sin(a) > 0.2 ? 'start' : Math.sin(a) < -0.2 ? 'end' : 'middle' }); };
    tag(s, RR * F.dip / 90 + 14, 'Face ' + G.att(F.dd, F.dip), INK);
    r.sets.forEach(function (q) { var a = R(q.dd), L = RR * q.dip / 90; S.arrow(cx, cy, cx + L * Math.sin(a), cy - L * Math.cos(a), q.col, 2.6, ''); tag(a, L + 14, q.name + ' ' + G.att(q.dd, q.dip), q.col); });
    k.sw.forEach(function (w) { var a = R(w.L.trend), L = RR * w.L.plunge / 90; S.line(cx, cy, cx + L * Math.sin(a), cy - L * Math.cos(a), { stroke: w.kin ? CRIT : MUT, 'stroke-width': 1.8, 'stroke-dasharray': '5 3' }); S.circle(cx + L * Math.sin(a), cy - L * Math.cos(a), 4, { fill: '#fff', stroke: w.kin ? CRIT : MUT, 'stroke-width': 1.8 }); });
    var items = [[function (x, y) { S.line(x, y, x + 28, y, { stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }); }, 'Slope crest', AR ? 'قمة المنحدر' : ''], [symFill(S, CRIT, .3), 'Planar sector ±' + k.limP + '°', AR ? 'قطاع الانزلاق المستوي' : ''], [symFill(S, '#8A5A9E', .3), 'Toppling sector ±' + k.limT + '°', AR ? 'قطاع الانقلاب' : ''], [function (x, y) { S.arrow(x, y, x + 28, y, SETC[0], 2.2, ''); }, 'Mean dip vector of a set', AR ? 'متجه الميل المتوسط للمجموعة' : ''], [function (x, y) { S.line(x, y, x + 24, y, { stroke: CRIT, 'stroke-width': 1.8, 'stroke-dasharray': '5 3' }); }, 'Intersection of set means', AR ? 'تقاطع متوسطات المجموعات' : '']];
    legend(S, AR ? 506 : 540, 64, AR ? 244 : 208, items, AR ? 34 : 21);
    $('#capN5').innerHTML = '<b>' + t('Input: ', 'المدخلات: ') + '</b>' + t('mean dip vectors of the sets and the face, lines of intersection of the set means.', 'متجهات الميل المتوسطة للمجموعات وللوجه، وخطوط تقاطع متوسطات المجموعات.') + '<br><b>' + t('Output: ', 'المخرجات: ') + '</b>' + t('critical sectors for planar sliding (toward ', 'القطاعات الحرجة للانزلاق المستوي (باتجاه ') + p3(F.dd) + '°) ' + t('and toppling (toward ', 'وللانقلاب (باتجاه ') + p3(F.dd + 180) + '°).' +
      '<br><b>' + t('Interpretation: ', 'التفسير: ') + '</b>' + (anyP || anyT || k.sw.some(function (w) { return w.kin; }) ? t('one or more sets or intersections fall in a critical sector; the hazard is directed toward ', 'تقع مجموعة أو خط تقاطع واحد على الأقل في قطاع حرج؛ ويتجه الخطر نحو ') + SH.dir16(F.dd) + '.' : t('no set mean falls in a critical sector.', 'لا يقع أي متوسط مجموعة في قطاع حرج.'));
  }

  /* ---------- outputs */
  var MATH = /[A-Za-z0-9ψφξβδαγκΣπ(\[|][A-Za-z0-9ψφξβδαγκΣπ°′″±+\-−×()=\/·∩→≤≥<>.,%²³\[\]|̄ ]*[A-Za-z0-9ψφξβδαγκΣπ°′″)%²³\]̄]|[A-Za-z0-9]/g;
  function fixNode(root) {
    if (!AR) { root.innerHTML = root.innerHTML.replace(/،/g, ','); return; }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n; while ((n = w.nextNode())) if (!n.parentNode.closest('bdi')) list.push(n);
    list.forEach(function (tn) { var txt = tn.nodeValue, out = document.createDocumentFragment(), lst = 0; txt.replace(MATH, function (m, off) { if (off > lst) out.appendChild(document.createTextNode(txt.slice(lst, off))); var b = document.createElement('bdi'); b.dir = 'ltr'; b.textContent = m; out.appendChild(b); lst = off + m.length; return m; }); if (!lst) return; if (lst < txt.length) out.appendChild(document.createTextNode(txt.slice(lst))); tn.parentNode.replaceChild(out, tn); });
  }
  function kpi(c, k, v, s) { return '<div class="kpi ' + (c || '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function render(r) {
    last = r; $('#nEmpty').hidden = true; $('#nOut').hidden = false;
    var k = r.kin, pc = function (a, b) { return b ? SH.fmt(100 * a / b, 1) : '—'; };
    $('#nKpis').innerHTML = kpi('', t('Measurements', 'القياسات'), r.P.length + '<small> P</small>' + (r.L.length ? ' · ' + r.L.length + '<small> L</small>' : ''), t('planes · lines', 'مستويات · خطوط')) + kpi('', t('Sets', 'المجموعات'), r.sets.length, r.mode === 'auto' ? 'k-means' : t('from field labels', 'من الرموز الحقلية')) +
      kpi('', t('Fabric shape K', 'شكل النسيج K'), isFinite(r.fab.K) ? SH.fmt(r.fab.K, 2) : '∞', r.fab.K < 1 ? t('girdle · β ', 'حزامي · β ') + '<bdi>' + G.lin(r.beta.trend, r.beta.plunge) + '</bdi>' : t('cluster', 'عنقودي')) +
      (k ? kpi(k.nP / r.P.length > .1 ? 'bad' : 'ok', t('Planar critical', 'حرج للانزلاق المستوي'), pc(k.nP, r.P.length) + '<small> %</small>', k.nP + ' / ' + r.P.length) + kpi(k.nW / Math.max(1, k.nPairs) > .1 ? 'bad' : 'ok', t('Wedge critical', 'حرج للإسفين'), pc(k.nW, k.nPairs) + '<small> %</small>', k.nW + ' / ' + k.nPairs) + kpi(k.nT / r.P.length > .1 ? 'bad' : 'ok', t('Toppling critical', 'حرج للانقلاب'), pc(k.nT, r.P.length) + '<small> %</small>', k.nT + ' / ' + r.P.length) : '');
    $('#nStats').innerHTML = '<thead><tr><th>' + t('Set', 'المجموعة') + '</th><th class="num">n</th><th>' + t('Mean plane (dip/dip dir.)', 'المستوى المتوسط (الميل/اتجاه الميل)') + '</th><th>' + t('Strike (RHR)', 'المضرب') + '</th><th>' + t('Mean pole', 'القطب المتوسط') + '</th><th class="num">k</th><th class="num">α95 (°)</th><th class="num">' + t('Spherical s.d. (°)', 'الانحراف الكروي (°)') + '</th></tr></thead><tbody>' +
      r.sets.map(function (s) { var m = G.vecLine(s.f.v); return '<tr><td><b style="color:' + s.col + '">' + SH.esc(s.name) + '</b></td><td class="num">' + s.n + '</td><td class="ltr">' + G.att(s.dd, s.dip) + '</td><td class="ltr">' + p3(s.dd - 90) + '°</td><td class="ltr">' + G.lin(m.trend, m.plunge) + '</td><td class="num">' + (isFinite(s.f.k) ? SH.fmt(s.f.k, 1) : '∞') + '</td><td class="num">' + (isFinite(s.f.a95) ? SH.fmt(s.f.a95, 1) : '—') + '</td><td class="num">' + SH.fmt(s.f.sd, 1) + '</td></tr>'; }).join('') + '</tbody>';
    $('#nFab').innerHTML = '<thead><tr><th>' + t('Eigenvector', 'المتجه الذاتي') + '</th><th class="num">' + t('Eigenvalue', 'القيمة الذاتية') + '</th><th>' + t('Trend → plunge', 'الاتجاه ← الغطس') + '</th></tr></thead><tbody>' + r.fab.e.map(function (e, i) { var l = G.vecLine(e.vec); return '<tr><td><b>E' + (i + 1) + '</b></td><td class="num">' + SH.fmt(e.val, 4) + '</td><td class="ltr">' + G.lin(l.trend, l.plunge) + '</td></tr>'; }).join('') + '<tr><td>Woodcock K · C</td><td class="num" colspan="2">' + (isFinite(r.fab.K) ? SH.fmt(r.fab.K, 2) : '∞') + ' · ' + SH.fmt(r.fab.C, 2) + '</td></tr></tbody>';
    drawN1(r); drawN2(r); drawN3(r);
    $('#kinWrap').hidden = !k; $('#radWrap').hidden = !k; if (k) { drawN4(r); drawN5(r); }
    ['#capN1', '#capN2', '#capN3', '#capN4', '#capN5'].forEach(function (q) { fixNode($(q)); });
  }
  function run() { var r = analyse(); if (r) { store.save(); render(r); } return r; }
  $('#nRun').addEventListener('click', function () { if (run()) $('#nOut').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#nDemo').addEventListener('click', function () {
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var gen = function (dd, dip, k, n, s) { var m = G.poleVec(dd, dip), u = G.unit(G.cross(m, [0, 0, 1])), w = G.cross(m, u); for (var i = 0; i < n; i++) { var c = 1 + Math.log(1 - rnd() * (1 - Math.exp(-2 * k))) / k, th = Math.acos(Math.max(-1, Math.min(1, c))), ph = 2 * Math.PI * rnd(); var v = G.add(G.mul(m, Math.cos(th)), G.add(G.mul(u, Math.sin(th) * Math.cos(ph)), G.mul(w, Math.sin(th) * Math.sin(ph)))), p = G.poleToPlane(v); rows.push({ t: 'P', a: Math.round(p.dd), b: Math.round(p.dip), s: s, src: 'typed' }); } };
    rows = []; gen(52, 38, 45, 28, 'J1'); gen(128, 60, 35, 22, 'J2'); gen(240, 78, 55, 16, 'J3'); gen(48, 22, 80, 12, 'S0');
    rows.push({ t: 'L', a: 64, b: 37, s: 'F1', src: 'typed' }, { t: 'L', a: 58, b: 33, s: 'F1', src: 'typed' });
    var v = { nProject: t('Road cut, km 14', 'قطع طريق، كم 14'), nLat: 36.7412, nLon: 43.8754, kFdd: 60, kFdip: 65, kPhi: 30, kLimP: 20, kLimT: 10 }; for (var q in v) $('#' + q).value = v[q];
    $('#nSets').value = 'manual'; $('#kOn').checked = true; $('#nRef').value = 'true'; save(); drawTable(); updDecl(); run();
  });
  $('#nCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-stereonet-data.csv', [['type', 'dip_direction_or_trend', 'dip_or_plunge', 'strike_rhr', 'set']].concat(last.P.map(function (p) { return ['P', Math.round(p.dd * 10) / 10, p.dip, Math.round(G.norm(p.dd - 90) * 10) / 10, p.set]; })).concat(last.L.map(function (l) { return ['L', l.tr, l.pl, '', l.s]; }))); });
  $('#nCsvS').addEventListener('click', function () { if (!last) return; SH.csv('shandal-stereonet-sets.csv', [['set', 'n', 'dip_direction', 'dip', 'strike_rhr', 'fisher_k', 'a95_deg', 'spherical_sd_deg']].concat(last.sets.map(function (s) { return [s.name, s.n, Math.round(s.dd * 10) / 10, Math.round(s.dip * 10) / 10, Math.round(G.norm(s.dd - 90) * 10) / 10, isFinite(s.f.k) ? Math.round(s.f.k * 10) / 10 : '', isFinite(s.f.a95) ? Math.round(s.f.a95 * 10) / 10 : '', Math.round(s.f.sd * 10) / 10]; }))); });
  document.getElementById('projSeg').addEventListener('segchange', function () { if (last) render(last); });
  document.addEventListener('sh:redraw', function () { if (last) render(last); });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Run the analysis first.', 'شغّل التحليل أولاً.'), 'warn'); } });
  SH.$$('[data-svg]').forEach(function (b) { b.addEventListener('click', function () { SH.svgPng($('#' + b.getAttribute('data-svg')), 'shandal-' + b.getAttribute('data-svg') + '.png', 2); }); });
  if (SH.fa) { SH.fa.attach('kPhi', 'phi', { ctx: function () { return { psi: last && last.sets[0] ? last.sets[0].dip : 40 }; } }); SH.fa.attach('kLimP', 'limP'); SH.fa.attach('kLimT', 'limT'); }
  drawTable(); updDecl(); if (rows.filter(function (r) { return r.t === 'P'; }).length >= 3) run();
})();
