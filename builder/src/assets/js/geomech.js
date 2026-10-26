/* SH.gm — orientation geometry shared by the structural tools.
   Frame: x East, y North, z Down. Planes are given by dip direction / dip, lines by trend / plunge.
   Includes: stereographic and Lambert projections, great circles, Fisher statistics (Fisher 1953),
   orientation tensor and eigen analysis (Woodcock 1977), exponential Kamb density in MUD (Vollmer 1995),
   axial k-means set detection, marching-squares contours and the Markland/Hocking/Goodman kinematic tests. */
(function () {
  'use strict';
  var R = function (d) { return d * Math.PI / 180; }, D = function (r) { return r * 180 / Math.PI; };
  var norm = function (a) { return ((a % 360) + 360) % 360; };
  var angDiff = function (a, b) { var x = Math.abs(norm(a) - norm(b)); return x > 180 ? 360 - x : x; };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var unit = function (v) { var n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
  var mul = function (v, k) { return [v[0] * k, v[1] * k, v[2] * k]; };
  var add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  function lineVec(tr, pl) { return [Math.sin(R(tr)) * Math.cos(R(pl)), Math.cos(R(tr)) * Math.cos(R(pl)), Math.sin(R(pl))]; }
  function vecLine(v) { v = unit(v); if (v[2] < 0) v = mul(v, -1); return { trend: norm(D(Math.atan2(v[0], v[1]))), plunge: D(Math.asin(Math.max(-1, Math.min(1, v[2])))) }; }
  function poleVec(dd, dip) { return lineVec(dd + 180, 90 - dip); }
  function poleToPlane(v) { var l = vecLine(v); return { dd: norm(l.trend + 180), dip: 90 - l.plunge }; }
  function inter(a, b) { return vecLine(cross(poleVec(a.dd, a.dip), poleVec(b.dd, b.dip))); }
  function appDip(dip, dd, dir) { return D(Math.atan(Math.tan(R(Math.min(dip, 89.99))) * Math.cos(R(dir - dd)))); }
  function between(a, lo, hi) { return Math.abs(angDiff(lo, a) + angDiff(a, hi) - angDiff(lo, hi)) < 0.5; }

  /* projection factory: returns {xy(trend, plunge), inv(x, y) → lower-hemisphere unit vector or null} */
  function projector(cx, cy, RR, mode) {
    var area = mode === 'area';
    return {
      xy: function (tr, pl) { var z = R(90 - pl), rr = area ? RR * Math.SQRT2 * Math.sin(z / 2) : RR * Math.tan(z / 2); return [cx + rr * Math.sin(R(tr)), cy - rr * Math.cos(R(tr))]; },
      inv: function (x, y) { var dx = x - cx, dy = cy - y, rr = Math.hypot(dx, dy) / RR; if (rr > 1) return null; var z = area ? 2 * Math.asin(Math.min(1, rr / Math.SQRT2)) : 2 * Math.atan(rr); var pl = 90 - D(z), tr = D(Math.atan2(dx, dy)); return lineVec(tr, pl); }
    };
  }
  function greatCircle(P, dd, dip, step) {
    var pts = [], s = [Math.sin(R(dd - 90)), Math.cos(R(dd - 90)), 0], dv = lineVec(dd, dip);
    for (var k = 0; k <= 180; k += step || 2) { var a = R(k), l = vecLine([s[0] * Math.cos(a) + dv[0] * Math.sin(a), s[1] * Math.cos(a) + dv[1] * Math.sin(a), dv[2] * Math.sin(a)]); pts.push(P.xy(l.trend, l.plunge)); }
    return pts;
  }
  function smallCircle(P, axisTr, axisPl, ang, step) { /* cone of half-angle ang about a lower-hemisphere axis; points above the horizon are folded */
    var a = lineVec(axisTr, axisPl), u = unit(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = cross(a, u), pts = [];
    for (var k = 0; k <= 360; k += step || 4) { var t = R(k), v = add(mul(a, Math.cos(R(ang))), add(mul(u, Math.sin(R(ang)) * Math.cos(t)), mul(w, Math.sin(R(ang)) * Math.sin(t)))), l = vecLine(v); pts.push(P.xy(l.trend, l.plunge)); }
    return pts;
  }

  /* Fisher mean of axial unit vectors (sign-corrected to the first mean estimate) */
  function fisher(vs) {
    if (!vs.length) return null; var ref = vs[0], s = [0, 0, 0];
    vs.forEach(function (v) { s = add(s, dot(v, ref) < 0 ? mul(v, -1) : v); }); ref = unit(s); s = [0, 0, 0];
    vs.forEach(function (v) { s = add(s, dot(v, ref) < 0 ? mul(v, -1) : v); });
    var N = vs.length, Rl = Math.hypot(s[0], s[1], s[2]), k = N > Rl ? (N - 1) / (N - Rl) : Infinity;
    var a95 = N > 1 && Rl > 0 ? D(Math.acos(Math.max(-1, Math.min(1, 1 - (N - Rl) / Rl * (Math.pow(20, 1 / (N - 1)) - 1))))) : NaN;
    return { v: unit(s), n: N, R: Rl, k: k, a95: a95, sd: isFinite(k) ? 81 / Math.sqrt(k) : 0 };
  }
  /* symmetric 3×3 eigen decomposition (Jacobi) → values descending with vectors */
  function eigen(T) {
    var a = [T[0].slice(), T[1].slice(), T[2].slice()], V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (var it = 0; it < 60; it++) {
      var p = 0, q = 1, mx = Math.abs(a[0][1]); if (Math.abs(a[0][2]) > mx) { p = 0; q = 2; mx = Math.abs(a[0][2]); } if (Math.abs(a[1][2]) > mx) { p = 1; q = 2; mx = Math.abs(a[1][2]); }
      if (mx < 1e-12) break; var th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (var k = 0; k < 3; k++) { var akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (k = 0; k < 3; k++) { var apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (k = 0; k < 3; k++) { var vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
    var out = [0, 1, 2].map(function (i) { return { val: a[i][i], vec: [V[0][i], V[1][i], V[2][i]] }; });
    return out.sort(function (x, y) { return y.val - x.val; });
  }
  function fabric(vs) {
    var N = vs.length, T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    vs.forEach(function (v) { for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) T[i][j] += v[i] * v[j] / N; });
    var e = eigen(T), S1 = Math.max(e[0].val, 1e-9), S2 = Math.max(e[1].val, 1e-9), S3 = Math.max(e[2].val, 1e-9);
    return { e: e, S1: S1, S2: S2, S3: S3, K: Math.log(S2 / S3) > 1e-9 ? Math.log(S1 / S2) / Math.log(S2 / S3) : Infinity, C: Math.log(S1 / S3) };
  }
  /* exponential Kamb density (Vollmer 1995) on a grid, in multiples of a uniform distribution */
  function density(vs, P, cx, cy, RR, n) {
    var N = vs.length, K = 2 * (1 + N / 9), norm0 = N * (1 - Math.exp(-K)) / K, g = [], step = 2 * RR / (n - 1), mx = 0;
    for (var j = 0; j < n; j++) { var row = []; for (var i = 0; i < n; i++) { var x = cx - RR + i * step, y = cy - RR + j * step, u = P.inv(x, y), d = NaN;
      if (u) { d = 0; for (var q = 0; q < N; q++) d += Math.exp(K * (Math.abs(dot(u, vs[q])) - 1)); d /= norm0; if (d > mx) mx = d; } row.push(d); } g.push(row); }
    return { g: g, n: n, x0: cx - RR, y0: cy - RR, step: step, max: mx, K: K };
  }
  /* marching squares: line segments of level L on a grid with NaN outside */
  function contour(G, L) {
    var segs = [], g = G.g, n = G.n, s = G.step, X = function (i) { return G.x0 + i * s; }, Y = function (j) { return G.y0 + j * s; };
    var lerp = function (a, b, va, vb) { var t = (L - va) / (vb - va); return a + (b - a) * t; };
    for (var j = 0; j < n - 1; j++) for (var i = 0; i < n - 1; i++) {
      var a = g[j][i], b = g[j][i + 1], c = g[j + 1][i + 1], d = g[j + 1][i]; if ([a, b, c, d].some(isNaN)) continue;
      var code = (a >= L ? 8 : 0) | (b >= L ? 4 : 0) | (c >= L ? 2 : 0) | (d >= L ? 1 : 0); if (code === 0 || code === 15) continue;
      var T = [lerp(X(i), X(i + 1), a, b), Y(j)], Rr = [X(i + 1), lerp(Y(j), Y(j + 1), b, c)], B = [lerp(X(i), X(i + 1), d, c), Y(j + 1)], Lf = [X(i), lerp(Y(j), Y(j + 1), a, d)];
      var map = { 1: [[Lf, B]], 2: [[B, Rr]], 3: [[Lf, Rr]], 4: [[T, Rr]], 5: [[Lf, T], [B, Rr]], 6: [[T, B]], 7: [[Lf, T]], 8: [[Lf, T]], 9: [[T, B]], 10: [[T, Rr], [Lf, B]], 11: [[T, Rr]], 12: [[Lf, Rr]], 13: [[B, Rr]], 14: [[Lf, B]] };
      (map[code] || []).forEach(function (sg) { segs.push(sg); });
    }
    return segs;
  }
  /* axial k-means on the sphere, seeded from density maxima (deterministic) */
  function kmeans(vs, k, iters) {
    if (vs.length < k) return vs.map(function (v, i) { return i; });
    var C = [vs[0]];
    while (C.length < k) { var best = null, bd = -1; vs.forEach(function (v) { var dmin = Math.min.apply(null, C.map(function (c) { return 1 - Math.abs(dot(v, c)); })); if (dmin > bd) { bd = dmin; best = v; } }); C.push(best); }
    var lab = vs.map(function () { return 0; });
    for (var it = 0; it < (iters || 30); it++) {
      vs.forEach(function (v, i) { var b = 0, bv = -1; C.forEach(function (c, j) { var x = Math.abs(dot(v, c)); if (x > bv) { bv = x; b = j; } }); lab[i] = b; });
      C = C.map(function (c, j) { var m = vs.filter(function (v, i) { return lab[i] === j; }); return m.length ? fisher(m).v : c; });
    }
    return lab;
  }
  /* kinematic tests against a slope face; returns flags for one plane */
  function planeTests(p, F, phi, limP, limT) {
    var fApp = appDip(F.dip, F.dd, p.dd), dA = angDiff(p.dd, F.dd);
    return { daylight: dA <= limP && p.dip < fApp && p.dip > 0, planar: dA <= limP && p.dip < fApp && p.dip > phi, topple: angDiff(p.dd, F.dd + 180) <= limT && p.dip >= (90 - F.dip) + phi };
  }
  function wedgeTest(L, F, phi) { var fApp = appDip(F.dip, F.dd, L.trend); return angDiff(L.trend, F.dd) < 90 && L.plunge < fApp && L.plunge > phi; }

  SH.gm = { R: R, D: D, norm: norm, angDiff: angDiff, dot: dot, cross: cross, unit: unit, mul: mul, add: add, lineVec: lineVec, vecLine: vecLine, poleVec: poleVec, poleToPlane: poleToPlane, inter: inter, appDip: appDip, between: between,
    projector: projector, greatCircle: greatCircle, smallCircle: smallCircle, fisher: fisher, eigen: eigen, fabric: fabric, density: density, contour: contour, kmeans: kmeans, planeTests: planeTests, wedgeTest: wedgeTest,
    att: function (dd, dip) { return String(Math.round(dip)).padStart(2, '0') + '/' + String(Math.round(norm(dd)) % 360).padStart(3, '0'); },
    lin: function (tr, pl) { return String(Math.round(pl)).padStart(2, '0') + '→' + String(Math.round(norm(tr)) % 360).padStart(3, '0'); } };
})();
