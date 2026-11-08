/* Iraq Time Machine — where Iraq was on the globe, what covered it, and which formations were laid down,
   from the Cambrian to today. Palaeogeography is reconstructed in the reader's browser with the plate model of
   Merdith et al. (2021) through the GPlates Web Service; coastlines and plate boundaries are simplified and
   cached on the device. Formation ages follow Jassim & Goff (2006). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, D = window.ITM, AR = SH.lang === 'ar', NS = 'http://www.w3.org/2000/svg';
  var GWS = 'https://gws.gplates.org/', MODEL = 'MERDITH2021', MAXA = 540;
  var tr = function (a, b) { return AR ? b : a; };
  var fmt = function (a) { return a < 0.0117 ? t('today', 'اليوم') : a < 10 ? SH.fmt(a, 1) + t(' Ma', ' م.س') : SH.fmt(a, 0) + t(' Ma', ' م.س'); };
  var esc = SH.esc;
  var FORMS = D.F.map(function (f) { return { id: f[0], en: f[1], ar: f[2], b: f[3], t: f[4], lith: f[5], env: f[6], reg: f[7], roles: f[8] ? f[8].split(' ') : [], loc: f[9], den: f[10], dar: f[11], approx: !!f[12] }; });
  var BYID = {}; FORMS.forEach(function (f) { BYID[f.id] = f; });
  /* non-linear time axis: the square root gives the young record room without losing the Paleozoic */
  var S = function (a) { return Math.sqrt(Math.max(0, Math.min(MAXA, a)) / MAXA); }, SI = function (s) { return MAXA * s * s; };
  var per = function (a) { for (var i = 0; i < D.PER.length; i++) if (a <= D.PER[i][1] && a >= D.PER[i][2]) return D.PER[i]; return D.PER[D.PER.length - 1]; };
  var era = function (a) { for (var i = 0; i < D.ERA.length; i++) if (a <= D.ERA[i][1] && a >= D.ERA[i][2]) return D.ERA[i]; return D.ERA[2]; };
  var epo = function (a) { for (var i = 0; i < D.EPO.length; i++) if (a <= D.EPO[i][2] && a >= D.EPO[i][3]) return D.EPO[i]; return null; };
  var story = function (a) { for (var i = 0; i < D.STORY.length; i++) if (a <= D.STORY[i][0] && a >= D.STORY[i][1]) return D.STORY[i]; return D.STORY[0]; };
  var snap = function (a) { var b = D.STEPS[0]; D.STEPS.forEach(function (s) { if (Math.abs(s - a) < Math.abs(b - a)) b = s; }); return b; };
  var age = +(SH.store.get('shandal_itm_age', 100)), sel = SH.store.get('shandal_itm_sel', null), playing = false;

  /* ---------------------------------------------------------------- lithology patterns (shared by column and cards) */
  var LITH = { sand: ['#EBCB7A', 'pS', T2('Sandstone', 'حجر رملي')], silt: ['#D9B48F', 'pSi', T2('Siltstone and mudstone', 'حجر غريني وطيني')], shale: ['#8FA08A', 'pSh', T2('Shale', 'طفل')], marl: ['#C9C3A2', 'pMa', T2('Marl', 'مارل')],
    lime: ['#A9C8DD', 'pL', T2('Limestone', 'حجر جيري')], dolo: ['#B6B3D6', 'pD', T2('Dolomite', 'دولوميت')], chalk: ['#E8EEF2', 'pCh', T2('Chalky limestone', 'حجر جيري طباشيري')], reef: ['#7FB7B0', 'pR', T2('Reef limestone', 'حجر جيري شعابي')],
    evap: ['#F2D4DE', 'pE', T2('Gypsum and anhydrite', 'جبس وأنهيدرايت')], cong: ['#D9A877', 'pC', T2('Conglomerate', 'مدملكات')], phos: ['#B9A1C9', 'pP', T2('Phosphorite', 'فوسفوريت')], chert: ['#C9C9B8', 'pCt', T2('Siliceous limestone', 'حجر جيري سيليسي')] };
  function T2(a, b) { return [a, b]; }
  var DEFS = '<defs>' +
    '<pattern id="pS" width="10" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".9" fill="#7A5B1E"/><circle cx="7" cy="6" r=".9" fill="#7A5B1E"/></pattern>' +
    '<pattern id="pSi" width="14" height="8" patternUnits="userSpaceOnUse"><path d="M1 3h5M8 6h5" stroke="#6E4E2E" stroke-width=".8"/><circle cx="11" cy="2.5" r=".7" fill="#6E4E2E"/></pattern>' +
    '<pattern id="pSh" width="14" height="6" patternUnits="userSpaceOnUse"><path d="M1 2h6M8 5h5" stroke="#2F3E2A" stroke-width=".9"/></pattern>' +
    '<pattern id="pMa" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 .5h16M8 .5v7.5" stroke="#5F5A43" stroke-width=".7"/><path d="M2 5h4" stroke="#5F5A43" stroke-width=".7"/></pattern>' +
    '<pattern id="pL" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 .5h16M0 4.5h16M4 .5v4M12 4.5v4" stroke="#3D5568" stroke-width=".7" fill="none"/></pattern>' +
    '<pattern id="pD" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 .5h16M0 4.5h16M3 .5l2 4M11 4.5l2 4" stroke="#463F78" stroke-width=".7" fill="none"/></pattern>' +
    '<pattern id="pCh" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 .5h16M0 4.5h16M4 .5v4M12 4.5v4" stroke="#8798A6" stroke-width=".6" fill="none"/></pattern>' +
    '<pattern id="pR" width="14" height="10" patternUnits="userSpaceOnUse"><path d="M2 8q2-6 4 0M8 4q2-5 4 0" stroke="#1F5550" stroke-width=".8" fill="none"/></pattern>' +
    '<pattern id="pE" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M2 1l3 3-3 3M8 1l3 3-3 3" stroke="#9D4E6A" stroke-width=".7" fill="none"/></pattern>' +
    '<pattern id="pC" width="14" height="10" patternUnits="userSpaceOnUse"><circle cx="4" cy="3" r="2.2" fill="none" stroke="#6B4320" stroke-width=".8"/><circle cx="10" cy="7.5" r="2" fill="none" stroke="#6B4320" stroke-width=".8"/></pattern>' +
    '<pattern id="pP" width="10" height="8" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="#4C2E63"/><circle cx="8" cy="6.5" r="1" fill="#4C2E63"/></pattern>' +
    '<pattern id="pCt" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 .5h16M4 .5v4" stroke="#55553F" stroke-width=".7"/><path d="M9 4l2 2 2-2" stroke="#55553F" stroke-width=".7" fill="none"/></pattern>' +
    '<radialGradient id="gOcean" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#3D7FB8"/><stop offset="1" stop-color="#0E2D4D"/></radialGradient>' +
    '<radialGradient id="gShade" cx=".35" cy=".3" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>' +
    '</defs>';
  var swatch = function (l, w, h) { var L = LITH[l] || LITH.lime; return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' + DEFS + '<rect width="' + w + '" height="' + h + '" fill="' + L[0] + '"/><rect width="' + w + '" height="' + h + '" fill="url(#' + L[1] + ')"/></svg>'; };

  /* ---------------------------------------------------------------- reconstruction service with on-device cache */
  var MEM = {};
  function cacheGet(k) { if (MEM[k]) return MEM[k]; try { var v = localStorage.getItem('itm1_' + k); if (v) return (MEM[k] = JSON.parse(v)); } catch (e) {} return null; }
  function cacheSet(k, v) { MEM[k] = v; try { localStorage.setItem('itm1_' + k, JSON.stringify(v)); } catch (e) { /* storage full: keep in memory */ } }
  function dp(P, eps) { if (P.length < 3) return P; var keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; var st = [[0, P.length - 1]];
    while (st.length) { var r = st.pop(), a = r[0], b = r[1], mx = -1, mi = -1, ax = P[a][0], ay = P[a][1], vx = P[b][0] - ax, vy = P[b][1] - ay, L = Math.hypot(vx, vy) || 1e-9; for (var k = a + 1; k < b; k++) { var d = Math.abs((P[k][0] - ax) * vy - (P[k][1] - ay) * vx) / L; if (d > mx) { mx = d; mi = k; } } if (mx > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return P.filter(function (p, i) { return keep[i]; }); }
  function dpRing(P, eps) { var k = 0, mx = -1; P.forEach(function (p, i) { var d = Math.hypot(p[0] - P[0][0], p[1] - P[0][1]); if (d > mx) { mx = d; k = i; } }); var a = dp(P.slice(0, k + 1), eps), b = dp(P.slice(k), eps); return a.concat(b.slice(1)); }
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  function coast(a) { var k = 'c' + a, c = cacheGet(k); if (c) return Promise.resolve(c);
    return SH.getJSON(GWS + 'reconstruct/coastlines/?time=' + a + '&model=' + MODEL, { timeout: 45000 }).then(function (j) { var out = [];
      (j.features || []).forEach(function (f) { var g = f.geometry, rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map(function (c) { return c[0]; }) : []; rings.forEach(function (r) { var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; r.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); if ((x1 - x0) * (y1 - y0) < 1) return; var s = dpRing(r, 0.35).map(function (p) { return [r1(p[0]), r1(p[1])]; }); if (s.length >= 4) out.push(s); }); });
      cacheSet(k, out); return out; }); }
  function bounds(a) { var k = 'b' + a, c = cacheGet(k); if (c) return Promise.resolve(c);
    return SH.getJSON(GWS + 'topology/plate_boundaries?time=' + a + '&model=' + MODEL, { timeout: 45000 }).then(function (j) { var out = [];
      (j.features || []).forEach(function (f) { var g = f.geometry, ty = (f.properties && f.properties.type) || '', lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []; lines.forEach(function (l) { var s = dp(l, 0.3).map(function (p) { return [r1(p[0]), r1(p[1])]; }); if (s.length >= 2) out.push([ty, s]); }); });
      cacheSet(k, out); return out; }); }
  function iraq(a) { var k = 'i' + a, c = cacheGet(k); if (c) return Promise.resolve(c);
    var pts = D.IRAQ.concat([D.BAGHDAD]);
    if (a === 0) { cacheSet(k, pts); return Promise.resolve(pts); }
    return SH.getJSON(GWS + 'reconstruct/reconstruct_points/?points=' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(',') + '&time=' + a + '&model=' + MODEL, { timeout: 30000 }).then(function (j) { var o = (j.coordinates || []).map(function (p) { return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]; }); if (o.length !== pts.length) throw new Error('reconstruction'); cacheSet(k, o); return o; }); }
  function load(a) { return Promise.all([coast(a), bounds(a).catch(function () { return []; }), iraq(a)]); }

  /* ---------------------------------------------------------------- the globe (orthographic, centred on Iraq) */
  var G = { lon: 44, lat: 33, data: null, shown: null }, GR = 240, GC = 260;
  function proj(lon, lat) { var l0 = G.lon * Math.PI / 180, p0 = G.lat * Math.PI / 180, l = lon * Math.PI / 180, p = lat * Math.PI / 180, cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0);
    var x = GR * Math.cos(p) * Math.sin(l - l0), y = GR * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0));
    if (cosc < 0) { var n = Math.hypot(x, y) || 1; x = x / n * GR; y = y / n * GR; } return [GC + x, GC - y, cosc]; }
  var pth = function (P, close) { return 'M' + P.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + (close ? 'Z' : ''); };
  var BCOL = { SubductionZone: '#FF5A5F', MidOceanRidge: '#FFC857', ContinentalRift: '#FFA94D', Transform: '#B794F4', InferredPaleoBoundary: '#C9CED6', OrogenicBelt: '#FF8FAB' };
  function btype(s) { s = s || ''; if (/Subduction/i.test(s)) return 'SubductionZone'; if (/Ridge/i.test(s)) return 'MidOceanRidge'; if (/Rift/i.test(s)) return 'ContinentalRift'; if (/Transform|Fault/i.test(s)) return 'Transform'; if (/Orogen|Collision/i.test(s)) return 'OrogenicBelt'; return 'InferredPaleoBoundary'; }
  function globe() {
    var svg = $('#tGlobe'), o = DEFS + '<circle cx="' + GC + '" cy="' + GC + '" r="' + GR + '" fill="url(#gOcean)"/>';
    /* graticule */
    for (var la = -60; la <= 60; la += 30) { var P = []; for (var lo = -180; lo <= 180; lo += 4) { var q = proj(lo, la); if (q[2] >= 0) P.push(q); else if (P.length) { o += '<path d="' + pth(P) + '" stroke="#fff" stroke-opacity="' + (la === 0 ? .9 : .18) + '" stroke-width="' + (la === 0 ? 1.6 : .8) + '" fill="none"' + (la === 0 ? ' stroke-dasharray="6 5"' : '') + '/>'; P = []; } } if (P.length > 1) o += '<path d="' + pth(P) + '" stroke="#fff" stroke-opacity="' + (la === 0 ? .9 : .18) + '" stroke-width="' + (la === 0 ? 1.6 : .8) + '" fill="none"' + (la === 0 ? ' stroke-dasharray="6 5"' : '') + '/>'; }
    for (var lo2 = -180; lo2 < 180; lo2 += 30) { var P2 = []; for (var la2 = -88; la2 <= 88; la2 += 4) { var q2 = proj(lo2, la2); if (q2[2] >= 0) P2.push(q2); else if (P2.length) { o += '<path d="' + pth(P2) + '" stroke="#fff" stroke-opacity=".15" stroke-width=".8" fill="none"/>'; P2 = []; } } if (P2.length > 1) o += '<path d="' + pth(P2) + '" stroke="#fff" stroke-opacity=".15" stroke-width=".8" fill="none"/>'; }
    if (G.shown) {
      var C = G.shown[0], B = G.shown[1], I = G.shown[2];
      C.forEach(function (r) { var pr = r.map(function (p) { return proj(p[0], p[1]); }); if (pr.every(function (q) { return q[2] < 0; })) return; o += '<path d="' + pth(pr, true) + '" fill="#D9C9A3" stroke="#8B7651" stroke-width=".6"/>'; });
      B.forEach(function (b) { var ty = btype(b[0]), P3 = []; b[1].forEach(function (p) { var q = proj(p[0], p[1]); if (q[2] >= 0) P3.push(q); else { if (P3.length > 1) o += '<path d="' + pth(P3) + '" stroke="' + BCOL[ty] + '" stroke-width="2" fill="none" stroke-linecap="round"/>'; P3 = []; } }); if (P3.length > 1) o += '<path d="' + pth(P3) + '" stroke="' + BCOL[ty] + '" stroke-width="2" fill="none" stroke-linecap="round"/>'; });
      var ir = I.slice(0, -1).map(function (p) { return proj(p[0], p[1]); }), bg = proj(I[I.length - 1][0], I[I.length - 1][1]);
      o += '<path d="' + pth(ir, true) + '" fill="#E63946" fill-opacity=".85" stroke="#fff" stroke-width="2"/>';
      o += '<circle cx="' + bg[0].toFixed(1) + '" cy="' + bg[1].toFixed(1) + '" r="5" fill="#fff" stroke="#E63946" stroke-width="2.5"><animate attributeName="r" values="5;9;5" dur="1.8s" repeatCount="indefinite"/></circle>';
      var lbx = bg[0] + 18, lby = bg[1] - 16;
      o += '<text x="' + lbx.toFixed(1) + '" y="' + lby.toFixed(1) + '" font-size="17" font-weight="800" fill="#fff" stroke="#14202B" stroke-width="4" paint-order="stroke"' + (AR ? ' direction="rtl" text-anchor="end"' : '') + '>' + t('Iraq', 'العراق') + '</text>';
    }
    o += '<circle cx="' + GC + '" cy="' + GC + '" r="' + GR + '" fill="url(#gShade)" pointer-events="none"/><circle cx="' + GC + '" cy="' + GC + '" r="' + GR + '" fill="none" stroke="#B08A3E" stroke-width="2"/>';
    var snapA = G.shownAge != null ? G.shownAge : age;
    o += '<text x="' + GC + '" y="' + (GC * 2 - 2) + '" font-size="13" fill="#9FB0BF" text-anchor="middle">' + esc(t('Reconstruction at ', 'إعادة البناء عند ') + fmt(snapA)) + '</text>';
    svg.innerHTML = o;
  }
  var anim = null;
  function turnTo(lon, lat) { var l0 = G.lon, p0 = G.lat, dl = ((lon - l0 + 540) % 360) - 180, t0 = performance.now(); cancelAnimationFrame(anim);
    (function step(now) { var f = Math.min(1, (now - t0) / 700), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; G.lon = l0 + dl * e; G.lat = p0 + (lat - p0) * e; globe(); if (f < 1) anim = requestAnimationFrame(step); })(t0); }
  var want = null;
  function showGlobe() { var a = snap(age); if (G.shownAge === a && G.shown) return; want = a; $('#tGLoad').hidden = false; $('#tGErr').hidden = true;
    load(a).then(function (r) { if (want !== a) return; G.shown = r; G.shownAge = a; var bg = r[2][r[2].length - 1]; turnTo(bg[0], Math.max(-60, Math.min(60, bg[1]))); info(); $('#tGLoad').hidden = true; prefetch(a); })
      .catch(function () { if (want !== a) return; $('#tGLoad').hidden = true; $('#tGErr').hidden = false; }); }
  function prefetch(a) { var i = D.STEPS.indexOf(a); [i + 1, i - 1].forEach(function (k) { var s = D.STEPS[k]; if (s != null && !cacheGet('c' + s)) setTimeout(function () { load(s).catch(function () {}); }, 400); }); }

  /* ---------------------------------------------------------------- the timeline */
  var TW = 1000, TH = 74;
  function tx(a) { var x = S(a) * TW; return AR ? x : TW - x; }
  function timeline() {
    var o = '';
    D.PER.forEach(function (p) { var x0 = tx(p[1]), x1 = tx(p[2]), xa = Math.min(x0, x1), w = Math.abs(x1 - x0); o += '<rect x="' + xa.toFixed(1) + '" y="26" width="' + w.toFixed(1) + '" height="30" fill="' + p[3] + '" stroke="#fff" stroke-width="1" data-a="' + ((p[1] + p[2]) / 2) + '" style="cursor:pointer"/>'; if (w > 34) o += '<text x="' + (xa + w / 2).toFixed(1) + '" y="46" font-size="' + (w > 70 ? 12 : 10) + '" font-weight="700" fill="#1B232B" text-anchor="middle" pointer-events="none">' + esc(tr(p[4], p[5])) + '</text>'; });
    D.ERA.forEach(function (e) { var x0 = tx(e[1]), x1 = tx(e[2]), xa = Math.min(x0, x1), w = Math.abs(x1 - x0); o += '<rect x="' + xa.toFixed(1) + '" y="4" width="' + w.toFixed(1) + '" height="20" fill="' + e[3] + '" stroke="#fff" stroke-width="1"/><text x="' + (xa + w / 2).toFixed(1) + '" y="18" font-size="11" font-weight="700" fill="#1B232B" text-anchor="middle" pointer-events="none">' + esc(tr(e[4], e[5])) + '</text>'; });
    [0, 10, 23, 66, 145, 252, 359, 444, 539].forEach(function (a) { var x = tx(a); o += '<path d="M' + x.toFixed(1) + ' 56v5" stroke="#55616B"/><text x="' + x.toFixed(1) + '" y="72" font-size="10" fill="#55616B" text-anchor="' + (a === 0 ? (AR ? 'start' : 'end') : a === 539 ? (AR ? 'end' : 'start') : 'middle') + '">' + a + '</text>'; });
    var xs = tx(age); o += '<path d="M' + xs.toFixed(1) + ' 0V60" stroke="#E63946" stroke-width="3"/><circle cx="' + xs.toFixed(1) + '" cy="60" r="6" fill="#E63946" stroke="#fff" stroke-width="2"/>';
    $('#tLine').innerHTML = o;
  }
  function setAge(a, fromSlider) { age = Math.max(0, Math.min(MAXA, a)); SH.store.set('shandal_itm_age', age); if (!fromSlider) $('#tAge').value = Math.round(S(age) * 1000); timeline(); info(); column(); showGlobe(); }
  $('#tLine').addEventListener('click', function (e) { var r = $('#tLine').getBoundingClientRect(), f = (e.clientX - r.left) / r.width, s = AR ? f : 1 - f; setAge(SI(Math.max(0, Math.min(1, s)))); });
  $('#tAge').addEventListener('input', function () { setAge(SI(+this.value / 1000), true); });
  $('#tAge').style.direction = AR ? 'ltr' : 'rtl';
  var stepIdx = function () { var a = snap(age); return D.STEPS.indexOf(a); };
  $('#tOlder').addEventListener('click', function () { var i = stepIdx(); if (i < D.STEPS.length - 1) setAge(D.STEPS[i + 1]); });
  $('#tYounger').addEventListener('click', function () { var i = stepIdx(); if (i > 0) setAge(D.STEPS[i - 1]); });
  $('#tPlay').addEventListener('click', function () { playing = !playing; this.setAttribute('aria-pressed', playing); this.querySelector('.i-play').style.display = playing ? 'none' : ''; this.querySelector('.i-pause').style.display = playing ? '' : 'none';
    if (playing) { if (stepIdx() === 0) setAge(D.STEPS[D.STEPS.length - 1]); (function next() { if (!playing) return; var i = stepIdx(); if (i <= 0) { $('#tPlay').click(); return; } setAge(D.STEPS[i - 1]); setTimeout(next, 3200); })(); } });

  /* ---------------------------------------------------------------- the story panel */
  function info() {
    var p = per(age), e = era(age), ep = epo(age), st = story(age), env = D.ENV[st[2]], bg = G.shown && G.shownAge === snap(age) ? G.shown[2][G.shown[2].length - 1] : null;
    var pos = '';
    if (bg) { var la = bg[1], drift = SH.dist({ lat: la, lon: bg[0] }, { lat: D.BAGHDAD[1], lon: D.BAGHDAD[0] }) / 1000;
      pos = '<div class="itm-pos"><b>' + SH.fmt(Math.abs(la), 0) + '° ' + (la >= 0 ? t('N', 'شمالاً') : t('S', 'جنوباً')) + '</b><span>' + t('latitude of Baghdad then', 'خط عرض بغداد آنذاك') + '</span></div>' +
        (snap(age) > 0 ? '<div class="itm-pos"><b>' + SH.fmt(Math.round(drift / 100) * 100, 0) + t(' km', ' كم') + '</b><span>' + t('travelled since then to its place today', 'قطعتها منذ ذلك الحين إلى مكانها اليوم') + '</span></div>' : '') +
        '<div class="itm-pos"><b>' + (Math.abs(la) < 23.4 ? t('tropics', 'المدارين') : Math.abs(la) < 40 ? t('subtropics', 'شبه المداري') : Math.abs(la) < 60 ? t('mid-latitudes', 'العروض الوسطى') : t('polar', 'القطبي')) + '</b><span>' + t('climate belt', 'النطاق المناخي') + '</span></div>'; }
    var act = FORMS.filter(function (f) { return age <= f.b + 0.001 && age >= f.t - 0.001; });
    $('#tInfo').innerHTML =
      '<div class="itm-when"><span class="itm-age">' + esc(fmt(age)) + '</span><span class="itm-chips"><i style="background:' + e[3] + '">' + esc(tr(e[4], e[5])) + '</i><i style="background:' + p[3] + '">' + esc(tr(p[4], p[5])) + '</i>' + (ep ? '<i style="background:#FFF3B0">' + esc(tr(ep[0], ep[1])) + '</i>' : '') + '</span></div>' +
      '<div class="itm-posrow">' + pos + '</div>' +
      '<h3 class="itm-st">' + esc(tr(st[4], st[5])) + ' <small>' + st[3] + '</small></h3>' +
      '<div class="itm-env"><i style="background:' + env[0] + '"></i>' + esc(tr(env[1], env[2])) + '</div>' +
      '<p class="itm-txt">' + esc(tr(st[6], st[7])) + '</p>' +
      '<h4 class="itm-h4">' + t('Formations being laid down now', 'التكاوين التي تترسب الآن') + ' <b dir="ltr">' + act.length + '</b></h4>' +
      (act.length ? '<div class="itm-fl">' + act.map(function (f) { return '<button type="button" data-f="' + f.id + '"' + (sel === f.id ? ' class="on"' : '') + '>' + swatch(f.lith, 18, 14) + '<span>' + esc(tr(f.en, f.ar)) + '</span><em>' + esc(D.REG[f.reg][AR ? 1 : 0]) + '</em></button>'; }).join('') + '</div>' : '<p class="xsmall muted">' + t('No formation of this age is preserved in Iraq: a gap in the record (erosion or no deposition).', 'لا يُحفظ في العراق تكوين بهذا العمر: فجوة في السجل (تعرية أو انقطاع ترسيب).') + '</p>');
  }
  $('#tInfo').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) pick(b.getAttribute('data-f'), true); });

  /* ---------------------------------------------------------------- the stratigraphic column of Iraq */
  var CH = 1180, CW = 760, TOP = 34, REGS = ['W', 'S', 'C', 'N'];
  var cy = function (a) { return TOP + S(a) * (CH - TOP - 10); };
  function lanes(list) { var L = []; list.slice().sort(function (a, b) { return b.b - a.b; }).forEach(function (f) { for (var i = 0; ; i++) { L[i] = L[i] || []; if (L[i].every(function (g) { return f.b <= g.t || f.t >= g.b; })) { L[i].push(f); f._lane = i; return; } } }); return L.length; }
  function column() {
    var o = DEFS, x0 = 0, pw = 54, ew = 28;
    /* periods */
    D.PER.forEach(function (p) { var y0 = cy(p[2]), y1 = cy(p[1]); o += '<rect x="' + x0 + '" y="' + y0.toFixed(1) + '" width="' + pw + '" height="' + (y1 - y0).toFixed(1) + '" fill="' + p[3] + '" stroke="#fff"/>'; if (y1 - y0 > 26) o += '<text x="' + (x0 + pw / 2) + '" y="' + ((y0 + y1) / 2 + 4).toFixed(1) + '" font-size="10.5" font-weight="700" text-anchor="middle" fill="#1B232B" transform="rotate(-90 ' + (x0 + pw / 2) + ' ' + ((y0 + y1) / 2).toFixed(1) + ')">' + esc(tr(p[4], p[5])) + '</text>'; });
    /* environment of each interval */
    D.STORY.forEach(function (s) { var y0 = cy(s[1]), y1 = cy(s[0]); o += '<rect x="' + (pw + 4) + '" y="' + y0.toFixed(1) + '" width="' + ew + '" height="' + (y1 - y0).toFixed(1) + '" fill="' + D.ENV[s[2]][0] + '" stroke="#fff"><title>' + esc(tr(s[4], s[5])) + '</title></rect>'; });
    /* region columns */
    var cx0 = pw + ew + 14, colW = (CW - cx0) / 4;
    REGS.forEach(function (r, k) { var xl = cx0 + k * colW, list = FORMS.filter(function (f) { return f.reg === r; }), n = lanes(list), lw = (colW - 6) / n;
      o += '<text x="' + (xl + colW / 2).toFixed(1) + '" y="16" font-size="12" font-weight="800" text-anchor="middle" fill="currentColor">' + esc(D.REG[r][AR ? 1 : 0]) + '</text><rect x="' + xl.toFixed(1) + '" y="' + TOP + '" width="' + (colW - 4).toFixed(1) + '" height="' + (CH - TOP - 10) + '" fill="none" stroke="currentColor" stroke-opacity=".12"/>';
      list.forEach(function (f) { var y0 = cy(f.t), y1 = Math.max(cy(f.b), y0 + 3), x = xl + 2 + f._lane * lw, w = lw - 2, L = LITH[f.lith] || LITH.lime, on = sel === f.id, act = age <= f.b && age >= f.t;
        o += '<g data-f="' + f.id + '" style="cursor:pointer"><rect x="' + x.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (y1 - y0).toFixed(1) + '" fill="' + L[0] + '"/><rect x="' + x.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (y1 - y0).toFixed(1) + '" fill="url(#' + L[1] + ')" stroke="' + (on ? '#E63946' : act ? '#B08A3E' : '#333') + '" stroke-width="' + (on ? 3 : act ? 2 : .6) + '"/>';
        if (y1 - y0 > 13 && w > 40) o += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + ((y0 + y1) / 2 + 4).toFixed(1) + '" font-size="' + (y1 - y0 > 20 ? 11 : 9.5) + '" font-weight="700" text-anchor="middle" fill="#1B232B" stroke="rgba(255,255,255,.85)" stroke-width="3" paint-order="stroke">' + esc(tr(f.en, f.ar)) + '</text>';
        o += '<title>' + esc(tr(f.en, f.ar) + ' · ' + f.b + '–' + f.t + ' Ma') + '</title></g>'; }); });
    /* age ticks */
    [0, 5, 23, 66, 100, 145, 201, 252, 299, 359, 419, 444, 485, 539].forEach(function (a) { var y = cy(a); o += '<path d="M' + (pw + ew + 6) + ' ' + y.toFixed(1) + 'h6" stroke="currentColor" stroke-opacity=".5"/><text x="' + (pw + ew + 6) + '" y="' + (y - 2).toFixed(1) + '" font-size="9" fill="currentColor" fill-opacity=".7" text-anchor="end">' + a + '</text>'; });
    var ya = cy(age); o += '<path d="M0 ' + ya.toFixed(1) + 'H' + CW + '" stroke="#E63946" stroke-width="2.4" stroke-dasharray="7 4"/><text x="' + (CW - 4) + '" y="' + (ya - 5).toFixed(1) + '" font-size="12" font-weight="800" fill="#E63946" text-anchor="end">' + esc(fmt(age)) + '</text>';
    $('#tCol').innerHTML = o;
  }
  $('#tCol').addEventListener('click', function (e) { var g = e.target.closest('[data-f]'); if (g) pick(g.getAttribute('data-f'), false); else { var r = $('#tCol').getBoundingClientRect(), y = (e.clientY - r.top) * CH / r.height; if (y > TOP) setAge(SI((y - TOP) / (CH - TOP - 10))); } });

  /* ---------------------------------------------------------------- formation card and map */
  var map = SH.map('tMap', { zoom: 5, base: 'light', center: [33.2, 43.6] }), mk = {}, geoLay = null;
  var PCOL = function (f) { return per((f.b + f.t) / 2)[3]; };
  if (map) { var grp = {}; FORMS.forEach(function (f) { if (!f.loc || !D.LOC[f.loc]) return; (grp[f.loc] = grp[f.loc] || []).push(f); });
    Object.keys(grp).forEach(function (k) { var L = D.LOC[k], fs = grp[k]; mk[k] = window.L.circleMarker([L[0], L[1]], { radius: 7 + Math.min(6, fs.length), color: '#fff', weight: 2, fillColor: PCOL(fs[0]), fillOpacity: .95 }).bindPopup(function () { return '<b>' + esc(tr(L[2], L[3])) + '</b> <span class="xsmall muted">(' + t('approximate', 'تقريبي') + ')</span><br>' + fs.map(function (f) { return '<a href="#" data-f="' + f.id + '">' + esc(tr(f.en, f.ar)) + '</a> <span class="xsmall">' + f.b + '–' + f.t + ' Ma</span>'; }).join('<br>'); }).addTo(map); });
    map.on('popupopen', function (e) { e.popup.getElement().addEventListener('click', function (ev) { var a = ev.target.closest('[data-f]'); if (a) { ev.preventDefault(); pick(a.getAttribute('data-f'), true); } }); });
    $('#tGeo').addEventListener('change', function () { if (this.checked) geoLay = window.L.tileLayer('https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png', { opacity: .6, maxZoom: 18, attribution: 'Geology © Macrostrat (CC BY 4.0)' }).addTo(map); else if (geoLay) { map.removeLayer(geoLay); geoLay = null; } }); }
  function pick(id, jump) { var f = BYID[id]; if (!f) return; sel = id; SH.store.set('shandal_itm_sel', id);
    if (jump && !(age <= f.b && age >= f.t)) { setAge((f.b + f.t) / 2); } else { column(); info(); }
    var env = D.ENV[f.env], L = LITH[f.lith] || LITH.lime, loc = f.loc && D.LOC[f.loc], p0 = per(f.b), p1 = per(f.t);
    $('#tCard').innerHTML = '<div class="itm-card"><div class="itm-ch">' + swatch(f.lith, 54, 54) + '<div><h3>' + esc(tr(f.en, f.ar)) + '</h3><span class="xsmall muted" dir="ltr">' + esc(AR ? f.en : f.ar) + '</span></div></div>' +
      '<table class="itm-tb"><tr><td>' + t('Age', 'العمر') + '</td><td><b dir="ltr">' + f.b + ' – ' + f.t + ' Ma</b>' + (f.approx ? ' <span class="xsmall muted">(' + t('approx.', 'تقريبي') + ')</span>' : '') + '<br><span class="xsmall">' + esc(tr(p0[4], p0[5]) + (p0 !== p1 ? ' – ' + tr(p1[4], p1[5]) : '')) + '</span></td></tr>' +
      '<tr><td>' + t('Rock', 'الصخر') + '</td><td>' + esc(tr(L[2][0], L[2][1])) + '</td></tr>' +
      '<tr><td>' + t('Setting', 'البيئة') + '</td><td><i class="itm-dot" style="background:' + env[0] + '"></i>' + esc(tr(env[1], env[2])) + '</td></tr>' +
      '<tr><td>' + t('Where', 'أين') + '</td><td>' + esc(D.REG[f.reg][AR ? 1 : 0]) + (loc ? '<br><span class="xsmall">' + t('Seen at: ', 'يُرى في: ') + esc(tr(loc[2], loc[3])) + ' (' + t('approx.', 'تقريبي') + ')</span>' : '<br><span class="xsmall muted">' + t('Mostly known from wells (subsurface).', 'يُعرف غالباً من الآبار (تحت السطح).') + '</span>') + '</td></tr>' +
      (f.roles.length ? '<tr><td>' + t('Importance', 'الأهمية') + '</td><td>' + f.roles.map(function (r) { var R = D.ROLE[r]; return R ? '<span class="itm-role" style="--c:' + R[0] + '">' + esc(tr(R[1], R[2])) + '</span>' : ''; }).join(' ') + '</td></tr>' : '') +
      '</table><p class="itm-txt">' + esc(tr(f.den, f.dar)) + '</p></div>';
    if (map && loc) { map.flyTo([loc[0], loc[1]], 7, { duration: .8 }); setTimeout(function () { if (mk[f.loc]) mk[f.loc].openPopup(); }, 900); }
    if (jump && window.innerWidth < 900) $('#tCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------------------------------------------------------- legend and downloads */
  $('#tLeg').innerHTML = '<div class="itm-lg"><b>' + t('Plate boundaries', 'حدود الصفائح') + '</b>' + [['SubductionZone', 'Subduction', 'اندساس'], ['MidOceanRidge', 'Spreading ridge', 'ظهر انتشار'], ['ContinentalRift', 'Rift', 'خسيف'], ['Transform', 'Transform', 'تحويلي'], ['InferredPaleoBoundary', 'Other', 'أخرى']].map(function (q) { return '<span><i style="background:' + BCOL[q[0]] + '"></i>' + tr(q[1], q[2]) + '</span>'; }).join('') + '<span><i style="background:#E63946"></i>' + t('Iraq', 'العراق') + '</span><span><i style="background:#fff;border-top:2px dashed #fff;height:0;width:16px"></i>' + t('Equator', 'خط الاستواء') + '</span></div>' +
    '<div class="itm-lg"><b>' + t('Settings', 'البيئات') + '</b>' + Object.keys(D.ENV).map(function (k) { return '<span><i style="background:' + D.ENV[k][0] + '"></i>' + tr(D.ENV[k][1], D.ENV[k][2]) + '</span>'; }).join('') + '</div>' +
    '<div class="itm-lg"><b>' + t('Rocks', 'الصخور') + '</b>' + Object.keys(LITH).map(function (k) { return '<span>' + swatch(k, 18, 12) + tr(LITH[k][2][0], LITH[k][2][1]) + '</span>'; }).join('') + '</div>';
  function loadPdf() { return window.jspdf ? Promise.resolve() : new Promise(function (r, j) { var s = document.createElement('script'); s.src = SH.base + 'assets/vendor/pdf/jspdf.umd.min.js'; s.onload = r; s.onerror = j; document.head.appendChild(s); }); }
  function svgCanvas(svg, scale, bg) { return new Promise(function (res) { var vb = svg.viewBox.baseVal, w = vb.width, h = vb.height, cl = svg.cloneNode(true); cl.setAttribute('width', w); cl.setAttribute('height', h); cl.setAttribute('xmlns', NS); cl.setAttribute('color', getComputedStyle(svg).color);
    var img = new Image(); img.onload = function () { var c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; var x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); SH.stamp(c).then(res); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl)); }); }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-dl]'); if (!b) return; var what = b.getAttribute('data-dl'), f = b.getAttribute('data-fmt'), svg = $(what === 'globe' ? '#tGlobe' : '#tCol'), name = 'Shandal-Iraq-time-' + (what === 'globe' ? Math.round(snap(age)) + 'Ma' : 'column') + '-' + new Date().toISOString().slice(0, 10);
    svgCanvas(svg, 2, what === 'globe' ? '#14202B' : '#FFFFFF').then(function (c) {
      if (f === 'png') c.toBlob(function (bl) { SH.download(name + '.png', bl); }, 'image/png');
      else if (f === 'jpg') c.toBlob(function (bl) { SH.download(name + '.jpg', bl); }, 'image/jpeg', .93);
      else loadPdf().then(function () { var land = c.width > c.height, pdf = new window.jspdf.jsPDF({ orientation: land ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' }), W = land ? 297 : 210, H = land ? 210 : 297, m = 10, iw = W - 2 * m, ih = iw * c.height / c.width; if (ih > H - 2 * m) { ih = H - 2 * m; iw = ih * c.width / c.height; } pdf.addImage(c.toDataURL('image/jpeg', .92), 'JPEG', (W - iw) / 2, (H - ih) / 2, iw, ih); SH.download(name + '.pdf', pdf.output('blob')); });
    }); });
  $('#tCsv').addEventListener('click', function () { SH.csv('Shandal-Iraq-formations.csv', [['formation', 'name_ar', 'base_Ma', 'top_Ma', 'lithology', 'setting', 'region', 'importance', 'representative_outcrop', 'age_note']].concat(FORMS.map(function (f) { var l = f.loc && D.LOC[f.loc]; return [f.en, f.ar, f.b, f.t, LITH[f.lith][2][0], D.ENV[f.env][1], D.REG[f.reg][0], f.roles.map(function (r) { return D.ROLE[r][1]; }).join('; '), l ? l[2] + ' (' + l[0] + ', ' + l[1] + ', approx.)' : '', f.approx ? 'approximate' : '']; }))); });
  $('#tRetry').addEventListener('click', function () { G.shownAge = null; showGlobe(); });

  $('#tAge').value = Math.round(S(age) * 1000);
  globe(); timeline(); info(); column(); showGlobe(); if (sel && BYID[sel]) pick(sel, false);
})();
