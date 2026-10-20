/* IGRF-14 spherical-harmonic synthesis (IAGA Working Group V-MOD, 2024). Coefficients in assets/data/igrf14.json.
   field(lat, lon, alt_km, year) → geodetic X (north), Y (east), Z (down), H, F (nT), D, I (deg), and secular variation per year. */
(function (w) {
  'use strict';
  var SH = w.SH, M = SH.igrf = {}, C = null, RE = 6371.2, A = 6378.137, B = 6356.7523142;
  M.load = function () { return C ? Promise.resolve(C) : SH.getJSON(SH.base + 'assets/data/igrf14.json').then(function (j) { C = j; return j; }); };
  M.setCoeffs = function (j) { C = j; };
  function coeffs(year) {
    var E = C.epochs, k = E.length - 2; for (var i = 0; i < E.length - 1; i++) if (year < E[i + 1]) { k = i; break; }
    var f = (year - E[k]) / (E[k + 1] - E[k]); return { g: C.g[k].map(function (v, q) { return v + f * (C.g[k + 1][q] - v); }), h: C.h[k].map(function (v, q) { return v + f * (C.h[k + 1][q] - v); }) };
  }
  function synth(lat, lon, alt, year) {
    var N = C.nmax, cf = coeffs(year), th = (90 - lat) * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
    var one = A * A * st * st, two = B * B * ct * ct, three = one + two, rho = Math.sqrt(three), r = Math.sqrt(alt * (alt + 2 * rho) + (A * A * A * A * st * st + B * B * B * B * ct * ct) / three);
    var cd = (alt + rho) / r, sd = (A * A - B * B) / rho * ct * st / r, ctc = ct * cd - st * sd, stc = st * cd + ct * sd;
    var P = [], dP = [], n, m, ph = lon * Math.PI / 180;
    for (n = 0; n <= N; n++) { P.push(new Array(n + 1).fill(0)); dP.push(new Array(n + 1).fill(0)); }
    P[0][0] = 1; dP[0][0] = 0;
    for (n = 1; n <= N; n++) for (m = 0; m <= n; m++) {
      if (n === m) { var k1 = n === 1 ? 1 : Math.sqrt((2 * n - 1) / (2 * n)); P[n][n] = k1 * stc * P[n - 1][n - 1]; dP[n][n] = k1 * (stc * dP[n - 1][n - 1] + ctc * P[n - 1][n - 1]); }
      else { var a1 = 2 * n - 1, b1 = n >= 2 && m <= n - 2 ? Math.sqrt((n - 1) * (n - 1) - m * m) : 0, d1 = Math.sqrt(n * n - m * m);
        P[n][m] = (a1 * ctc * P[n - 1][m] - b1 * (n >= 2 && m <= n - 2 ? P[n - 2][m] : 0)) / d1;
        dP[n][m] = (a1 * (ctc * dP[n - 1][m] - stc * P[n - 1][m]) - b1 * (n >= 2 && m <= n - 2 ? dP[n - 2][m] : 0)) / d1; }
    }
    var Br = 0, Bt = 0, Bp = 0, q = 0, ar = RE / r;
    for (n = 1; n <= N; n++) { var fn = Math.pow(ar, n + 2);
      for (m = 0; m <= n; m++, q++) { var g = cf.g[q], h = cf.h[q], cm = Math.cos(m * ph), sm = Math.sin(m * ph), gh = g * cm + h * sm;
        Br += (n + 1) * fn * gh * P[n][m]; Bt -= fn * gh * dP[n][m]; Bp -= fn * m * (-g * sm + h * cm) * P[n][m]; } }
    Bp = stc > 1e-10 ? Bp / stc : 0;
    var X = -Bt, Y = Bp, Z = -Br, Xd = X * cd + Z * sd, Zd = Z * cd - X * sd;
    return [Xd, Y, Zd];
  }
  M.field = function (lat, lon, alt, year) {
    var b = synth(lat, lon, alt || 0, year), b1 = synth(lat, lon, alt || 0, year + 1), o = mk(b), o1 = mk(b1);
    o.sv = { X: b1[0] - b[0], Y: b1[1] - b[1], Z: b1[2] - b[2], H: o1.H - o.H, F: o1.F - o.F, D: (o1.D - o.D) * 60, I: (o1.I - o.I) * 60 }; return o;
  };
  function mk(b) { var H = Math.hypot(b[0], b[1]); return { X: b[0], Y: b[1], Z: b[2], H: H, F: Math.hypot(H, b[2]), D: Math.atan2(b[1], b[0]) * 180 / Math.PI, I: Math.atan2(b[2], H) * 180 / Math.PI }; }
  M.decimalYear = function (d) { d = d || new Date(); var y = d.getUTCFullYear(), s = Date.UTC(y, 0, 1), e = Date.UTC(y + 1, 0, 1); return y + (d - s) / (e - s); };
})(window);
