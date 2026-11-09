/* Vertical Electrical Sounding lab — Schlumberger and Wenner readings to apparent resistivity, joining of MN segments, exact
   layered-earth forward model (Pekeris recurrence, 61-point J0 digital filter of Guptasarma & Singh 1997, coefficients from libdlf,
   CC BY 4.0), Levenberg–Marquardt inversion in log parameters with covariance uncertainty, equivalence, Dar Zarrouk parameters,
   lithology and aquifer interpretation, and a geoelectric section from saved stations. Works offline. */
(function () {
  'use strict';
  var FB0 = 8.26989508568e-06, FBR = 1.3080920429005054;
  var FW = [3.30220475766e-04,-1.18223623458e-03,2.01879495264e-03,-2.13218719891e-03,1.60839063172e-03,-9.09156346708e-04,4.37889252738e-04,-1.55298878782e-04,7.98411962729e-05,4.37268394072e-06,3.94253441247e-05,4.02675924344e-05,5.66053344653e-05,7.25774926389e-05,9.55412535465e-05,1.24699163157e-04,1.63262166579e-04,2.13477133718e-04,2.79304232173e-04,3.65312787897e-04,4.77899413107e-04,6.25100170825e-04,8.17726956451e-04,1.06961339341e-03,1.39920928148e-03,1.83020380399e-03,2.39417015791e-03,3.13158560774e-03,4.09654426763e-03,5.35807925630e-03,7.00889482693e-03,9.16637526490e-03,1.19891721272e-02,1.56755740646e-02,2.04953856060e-02,2.67778388247e-02,3.49719672729e-02,4.55975312615e-02,5.93498881451e-02,7.69179091244e-02,9.91094769804e-02,1.26166963993e-01,1.57616825575e-01,1.89707800260e-01,2.13804195282e-01,2.08669340316e-01,1.40250562745e-01,-3.65385242807e-02,-2.98004010732e-01,-4.21898149249e-01,5.94373771266e-02,5.29621428353e-01,-4.41362405166e-01,1.90355040550e-01,-6.19966386785e-02,1.87255115744e-02,-5.68736766738e-03,1.68263510609e-03,-4.38587145792e-04,8.59117336292e-05,-9.15853765160e-06];
  var DEMO = [{ s: 1, mn: 0.5, v: 19.83 }, { s: 1.5, mn: 0.5, v: 19.48 }, { s: 2, mn: 0.5, v: 18.6 }, { s: 3, mn: 0.5, v: 16.5 }, { s: 4, mn: 0.5, v: 14.57 }, { s: 5, mn: 0.5, v: 12.78 }, { s: 6, mn: 0.5, v: 11.74 }, { s: 8, mn: 0.5, v: 10.57 }, { s: 10, mn: 0.5, v: 9.85 }, { s: 8, mn: 2.5, v: 11.27 }, { s: 10, mn: 2.5, v: 10.67 }, { s: 12, mn: 2.5, v: 10.57 }, { s: 15, mn: 2.5, v: 11.01 }, { s: 20, mn: 2.5, v: 12.21 }, { s: 25, mn: 2.5, v: 13.87 }, { s: 30, mn: 2.5, v: 15.36 }, { s: 40, mn: 2.5, v: 16.76 }, { s: 50, mn: 2.5, v: 17.93 }, { s: 40, mn: 10, v: 14.55 }, { s: 50, mn: 10, v: 15.68 }, { s: 60, mn: 10, v: 15.81 }, { s: 80, mn: 10, v: 15.3 }, { s: 100, mn: 10, v: 13.3 }, { s: 120, mn: 10, v: 11.59 }, { s: 150, mn: 10, v: 8.89 }, { s: 200, mn: 10, v: 5.86 }, { s: 250, mn: 10, v: 4.18 }];
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, NF = FW.length;
  var IDS = ['vsArr', 'vsMode', 'vsJoin', 'vsN', 'vsWt', 'vsName', 'vsX', 'vsZ'], persist = SH.persist('ves', IDS);
  var SK = 'shandal_ves_stations', POS = null, last = null, busy = false, quiet = false;
  function hush(fn) { quiet = true; try { fn(); } finally { quiet = false; } }
  var RD = G.rows($('#vsRows'), 'shandal_ves_rows', [{ k: 's', h: 'AB/2 · a m' }, { k: 'mn', h: 'MN/2 m' }, { k: 'v', h: t('Reading', 'القراءة') }, { k: 'i', h: 'I mA', w: '64px' }], DEMO, function () { if (!quiet) later(refit, 600); });
  var MD = G.rows($('#vsMod'), 'shandal_ves_model', [{ k: 'r', h: 'ρ Ω·m' }, { k: 'h', h: 'h m' }, { k: 'fx', h: t('Fix', 'ثبّت'), type: 'select', w: '76px', opts: [['', '—'], ['r', 'ρ'], ['h', 'h'], ['rh', 'ρ + h']] }], [], function () { if (!quiet) later(forwardOnly, 250); });

  /* ---------------------------------------------------------------- forward model (layered earth, exact finite MN) */
  function trans(lam, r, h) { var T = r[r.length - 1]; for (var i = r.length - 2; i >= 0; i--) { var th = Math.tanh(lam * h[i]); T = (T + r[i] * th) / (1 + T * th / r[i]); } return T; }
  function I0(x, r, h) { var s = 0, b = FB0 / x; for (var k = 0; k < NF; k++) { s += (trans(b, r, h) - r[0]) * FW[k]; b *= FBR; } return s / x; }
  function fwd(L, l, r, h) { return (L * L - l * l) / (2 * l) * (r[0] / (L - l) - r[0] / (L + l) + I0(L - l, r, h) - I0(L + l, r, h)); }
  function respond(D, r, h) { return D.map(function (p) { return fwd(p.L, p.lm, r, h); }); }

  /* ---------------------------------------------------------------- readings */
  function readings() {
    var arr = $('#vsArr').value, mode = $('#vsMode').value, join = $('#vsJoin').checked, P = [], bad = 0, close = 0;
    RD.get().forEach(function (q, i) {
      var s = +q.s, v = +q.v, L, l; if (!(s > 0) || !(v > 0) || q.s == null || q.v == null) return;
      if (arr === 'wen') { L = 1.5 * s; l = 0.5 * s; } else { l = +q.mn; if (!(l > 0) || l >= s) { bad++; return; } L = s; if (s < 3 * l) close++; }
      var K = Math.PI * (L * L - l * l) / (2 * l), ra = mode === 'rho' ? v : mode === 'R' ? K * v : (q.i > 0 ? K * v / q.i : NaN);
      if (!(ra > 0)) { bad++; return; }
      P.push({ i: i, s: s, L: L, l: l, K: K, raw: ra, seg: arr === 'wen' ? 0 : +l.toPrecision(4) });
    });
    P.sort(function (a, b) { return a.s - b.s || a.l - b.l; });
    var segs = [], info = [];
    P.forEach(function (p) { if (segs.indexOf(p.seg) < 0) segs.push(p.seg); }); segs.sort(function (a, b) { return a - b; });
    P.forEach(function (p) { p.f = 1; p.ra = p.raw; p.lm = p.l; });
    if (arr === 'sch' && segs.length > 1 && join) {
      var ref = P.filter(function (p) { return p.seg === segs[0]; });
      for (var j = 1; j < segs.length; j++) {
        var cur = P.filter(function (p) { return p.seg === segs[j]; }), lr = [];
        cur.forEach(function (p) { var v0 = interp(ref, p.s); if (v0) lr.push(Math.log(v0 / p.raw)); });
        var f = lr.length ? Math.exp(lr.reduce(function (a, b) { return a + b; }, 0) / lr.length) : 1;
        cur.forEach(function (p) { p.f = f; p.ra = p.raw * f; });
        info.push({ mn: segs[j], f: f, n: lr.length });
        ref = ref.concat(cur).sort(function (a, b) { return a.s - b.s; });
      }
      P.forEach(function (p) { p.lm = segs[0]; });
    }
    P.forEach(function (p) { p.y = Math.log(p.ra); });
    return { P: P, arr: arr, segs: segs, info: info, join: join, bad: bad, close: close };
  }
  function interp(set, s) {
    var a = null, b = null; set.forEach(function (p) { if (p.s <= s && (!a || p.s >= a.s)) a = p; if (p.s >= s && (!b || p.s <= b.s)) b = p; });
    if (!a || !b) return null; if (a.s === b.s) return a.ra;
    var u = Math.log(s / a.s) / Math.log(b.s / a.s); return Math.exp(Math.log(a.ra) + u * Math.log(b.ra / a.ra));
  }

  /* ---------------------------------------------------------------- Levenberg–Marquardt on log ρ and log h */
  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var i = 0; i < n; i++) { var p = i; for (var j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j; var tmp = M[i]; M[i] = M[p]; M[p] = tmp; if (Math.abs(M[i][i]) < 1e-14) return null;
      for (j = i + 1; j < n; j++) { var f = M[j][i] / M[i][i]; for (var k = i; k <= n; k++) M[j][k] -= f * M[i][k]; } }
    var x = new Array(n); for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x;
  }
  function inverse(A) { var n = A.length, out = []; for (var c = 0; c < n; c++) { var e = []; for (var i = 0; i < n; i++) e.push(i === c ? 1 : 0); var x = solve(A, e); if (!x) return null; out.push(x); } return out[0].map(function (_, i) { return out.map(function (col) { return col[i]; }); }); }
  function setup(N, fix) {
    var map = []; for (var i = 0; i < N; i++) if (!(fix[i] && fix[i].r)) map.push(['r', i]); for (i = 0; i < N - 1; i++) if (!(fix[i] && fix[i].h)) map.push(['h', i]); return map;
  }
  function jac(D, m, map, base) {
    return map.map(function (q) { var r = m.r.slice(), h = m.h.slice(), dl = 0.01; if (q[0] === 'r') r[q[1]] *= Math.exp(dl); else h[q[1]] *= Math.exp(dl); var c = respond(D, r, h); return c.map(function (v, k) { return (Math.log(v) - Math.log(base[k])) / dl; }); });
  }
  function misfit(D, c) { var s = 0; D.forEach(function (p, k) { var e = p.y - Math.log(c[k]); s += e * e; }); return s; }
  function lm(D, m0, fix, it) {
    var m = { r: m0.r.slice(), h: m0.h.slice() }, N = m.r.length, map = setup(N, fix), Lmax = Math.max.apply(null, D.map(function (p) { return p.L; }));
    var c = respond(D, m.r, m.h), E = misfit(D, c), mu = 0.05, stall = 0;
    for (var n = 0; n < (it || 60) && map.length; n++) {
      var J = jac(D, m, map, c), res = D.map(function (p, k) { return p.y - Math.log(c[k]); }), np = map.length, A = [], g = [];
      for (var a = 0; a < np; a++) { A.push([]); g.push(J[a].reduce(function (s, v, k) { return s + v * res[k]; }, 0)); for (var b = 0; b < np; b++) A[a].push(J[a].reduce(function (s, v, k) { return s + v * J[b][k]; }, 0)); }
      var ok = false;
      for (var tr = 0; tr < 8; tr++) {
        var B = A.map(function (row, i) { return row.map(function (v, j) { return i === j ? v * (1 + mu) + 1e-9 : v; }); }), dx = solve(B, g); if (!dx) { mu *= 10; continue; }
        var r = m.r.slice(), h = m.h.slice();
        map.forEach(function (q, i) { var st = Math.max(-1.5, Math.min(1.5, dx[i])); if (q[0] === 'r') r[q[1]] = Math.min(1e5, Math.max(0.05, r[q[1]] * Math.exp(st))); else h[q[1]] = Math.min(2 * Lmax, Math.max(0.05, h[q[1]] * Math.exp(st))); });
        var c2 = respond(D, r, h), E2 = misfit(D, c2);
        if (E2 < E) { stall = (E - E2) / E < 1e-5 ? stall + 1 : 0; m = { r: r, h: h }; c = c2; E = E2; mu = Math.max(1e-6, mu / 3); ok = true; break; }
        mu *= 4;
      }
      if (!ok || stall >= 3 || mu > 1e8) break;
    }
    return { r: m.r, h: m.h, c: c, E: E, rms: Math.sqrt(E / D.length) * 100 };
  }
  function uncert(D, m, fix) {
    var N = m.r.length, map = setup(N, fix), c = respond(D, m.r, m.h), E = misfit(D, c), dof = Math.max(1, D.length - map.length), s2 = Math.max(E / dof, 1e-6), J = jac(D, m, map, c), np = map.length, A = [];
    for (var a = 0; a < np; a++) { A.push([]); for (var b = 0; b < np; b++) A[a].push(J[a].reduce(function (s, v, k) { return s + v * J[b][k]; }, 0) + (a === b ? 1e-8 : 0)); }
    var C = np ? inverse(A) : [], idx = {}; map.forEach(function (q, i) { idx[q[0] + q[1]] = i; });
    var cv = function (p, q) { var i = idx[p], j = idx[q]; return C && i != null && j != null ? C[i][j] * s2 : 0; };
    return { cv: cv, idx: idx, ok: !!C };
  }
  function startModels(D, N) {
    var s = D.map(function (p) { return p.s; }), smin = Math.min.apply(null, s), smax = Math.max.apply(null, s), set = D.map(function (p) { return { s: p.s, ra: p.ra }; }).sort(function (a, b) { return a.s - b.s; });
    var at = function (x) { x = Math.max(smin, Math.min(smax, x)); return interp(set, x) || set[0].ra; }, lg = Math.exp(D.reduce(function (a, p) { return a + p.y; }, 0) / D.length), out = [];
    [[1, 1], [0.55, 1], [1.8, 1], [1, 1.6]].forEach(function (v) {
      var z1 = Math.max(0.3, smin * 0.7) * v[0], z2 = smax * 0.33 * v[0], z = [];
      for (var i = 1; i < N; i++) z.push(N === 2 ? Math.sqrt(z1 * z2) : z1 * Math.pow(z2 / z1, (i - 1) / (N - 2)));
      var h = z.map(function (q, i) { return q - (i ? z[i - 1] : 0); }), r = [];
      for (i = 0; i < N; i++) { var zt = i ? z[i - 1] : 0, zb = i < N - 1 ? z[i] : z[N - 2] * 3, ra = i === 0 ? at(smin) : i === N - 1 ? at(smax) : at(1.6 * Math.sqrt(Math.max(zt, 0.1) * zb)); r.push(Math.exp(Math.log(lg) + v[1] * (Math.log(ra) - Math.log(lg)))); }
      out.push({ r: r, h: h });
    });
    return out;
  }
  function applyFix(m, fix, tab) { fix.forEach(function (f, i) { if (!f) return; if (f.r && tab[i] && tab[i].r > 0) m.r[i] = tab[i].r; if (f.h && tab[i] && tab[i].h > 0 && i < m.h.length) m.h[i] = tab[i].h; }); return m; }
  function fixes(N) { var tab = MD.get(); if (tab.length !== N) return { fix: [], tab: tab }; return { fix: tab.map(function (q) { return { r: /r/.test(q.fx || ''), h: /h/.test(q.fx || '') }; }), tab: tab }; }
  function autoFit(D, N) {
    var fx = fixes(N), best = null;
    startModels(D, N).forEach(function (m0) { var r = lm(D, applyFix(m0, fx.fix, fx.tab), fx.fix, 45); if (!best || r.E < best.E) best = r; });
    return lm(D, best, fx.fix, 80);
  }

  /* ---------------------------------------------------------------- actions */
  function current() { var tab = MD.get().filter(function (q) { return q.r > 0; }), N = tab.length; if (N < 1) return null; var r = tab.map(function (q) { return q.r; }), h = []; for (var i = 0; i < N - 1; i++) h.push(tab[i].h > 0 ? tab[i].h : 1); return { r: r, h: h }; }
  function writeModel(m) { var old = MD.get(); hush(function () { MD.set(m.r.map(function (r, i) { return { r: +r.toPrecision(4), h: i < m.h.length ? +m.h[i].toPrecision(4) : null, fx: old.length === m.r.length && old[i] ? old[i].fx || '' : '' }; })); }); }
  function interpret(mode) {
    if (busy) return; var R0 = readings(); if (R0.P.length < 4) { show(R0, null); return; }
    busy = true; var btn = $('#vsAuto'); btn.disabled = true; $('#vsRef').disabled = true; $('#vsSegInfo').textContent = t('Interpreting…', 'جارٍ التفسير…');
    setTimeout(function () {
      try {
        var D = R0.P, out = null, sel = $('#vsN').value, nmax = Math.min(6, Math.floor(D.length / 2)), tries = {};
        if (mode === 'refine' && current()) { var m0 = current(), fx = fixes(m0.r.length); out = lm(D, m0, fx.fix, 100); out.N = m0.r.length; }
        else if (sel === 'auto') {
          for (var N = 2; N <= nmax; N++) { tries[N] = autoFit(D, N); }
          var bestR = Math.min.apply(null, Object.keys(tries).map(function (k) { return tries[k].rms; })), lim = Math.max(bestR * 1.15, bestR + 0.4);
          for (N = 2; N <= nmax; N++) if (tries[N].rms <= lim) { out = tries[N]; out.N = N; break; }
          out.tries = tries;
        } else { N = Math.min(+sel, nmax); out = autoFit(D, N); out.N = N; }
        writeModel(out); last = { tries: out.tries || null };
      } finally { busy = false; btn.disabled = false; $('#vsRef').disabled = false; }
      forwardOnly(true);
    }, 30);
  }
  function refit() { if (current() && current().r.length >= 2 && $('#vsN').value !== 'auto') interpret('refine'); else interpret('auto'); }
  function forwardOnly(keep) {
    if (busy) return; persist.save(); var R0 = readings(), m = current(); if (!keep && last) last.tries = null;
    if (!m || R0.P.length < 3) { show(R0, null); return; }
    show(R0, m);
  }

  /* ---------------------------------------------------------------- interpretation */
  function lith(r) {
    if (r < 1) return { k: 'clay', en: 'Brine-bearing layer or very saline clay', ar: 'طبقة بماء شديد الملوحة أو طين شديد الملوحة' };
    if (r < 5) return { k: 'clay', en: 'Saline clay or silt, or sediment with saline water', ar: 'طين أو غرين مالح، أو رسوبيات بماء مالح' };
    if (r < 15) return { k: 'clay', en: 'Clay or silty clay, or sand with brackish water', ar: 'طين أو طين غريني، أو رمل بماء مويلح' };
    if (r < 40) return { k: 'sand', en: 'Silty or clayey sand, or sand with slightly brackish water', ar: 'رمل غريني أو طيني، أو رمل بماء قليل الملوحة', aq: 1 };
    if (r < 150) return { k: 'sand', en: 'Sand and gravel with fresh water, or dry silt', ar: 'رمل وحصى بماء عذب، أو غرين جاف', aq: 1 };
    if (r < 600) return { k: 'mix', en: 'Dry sand and gravel, gypsiferous soil or weathered limestone', ar: 'رمل وحصى جاف، أو تربة جبسية، أو حجر جيري متجوٍّ' };
    if (r < 3000) return { k: 'rock', en: 'Compact limestone, gypsum or dry conglomerate', ar: 'حجر جيري متماسك أو جبس أو مدملكات جافة' };
    return { k: 'rock', en: 'Massive limestone, anhydrite or crystalline rock', ar: 'حجر جيري كتلي أو أنهيدرايت أو صخر متبلور' };
  }
  function water(r) {
    var rw = G.v('vsWt'), o = {};
    if (rw > 0) { var Ff = r / rw; o.F = Ff; if (Ff > 1.5) o.phi = Math.pow(Ff, -0.5); o.rw = rw; }
    else { o.rw = r / 11.1; o.est = 1; }
    o.ec = 1e4 / o.rw; o.tds = 0.64 * o.ec; o.cls = o.tds < 1000 ? 'fresh' : o.tds < 3000 ? 'brackish' : o.tds < 10000 ? 'saline' : 'brine';
    return o;
  }
  var WCL = { fresh: ['fresh', 'عذب'], brackish: ['brackish', 'مويلح'], saline: ['saline', 'مالح'], brine: ['very saline', 'شديد الملوحة'] };
  function ctype(r) {
    if (r.length === 2) return r[1] > r[0] ? t('ascending (ρ2 > ρ1)', 'صاعد (ρ2 > ρ1)') : t('descending (ρ2 < ρ1)', 'نازل (ρ2 < ρ1)');
    var s = ''; for (var i = 0; i + 2 < r.length; i++) { var a = r[i], b = r[i + 1], c = r[i + 2]; s += b < a && b < c ? 'H' : b > a && b > c ? 'K' : a < b ? 'A' : 'Q'; } return s;
  }
  function analyse(R0, m) {
    var D = R0.P, N = m.r.length, fx = fixes(N), c = respond(D, m.r, m.h), E = misfit(D, c), U = uncert(D, m, fx.fix), Lmax = Math.max.apply(null, D.map(function (p) { return p.L; })), doi = (R0.arr === 'wen' ? Math.max.apply(null, D.map(function (p) { return p.s; })) : Lmax) / 3;
    var pct = function (v) { return v > 0 ? (Math.exp(Math.sqrt(v)) - 1) * 100 : 0; }, z = 0, lay = [];
    for (var i = 0; i < N; i++) {
      var top = z, h = i < N - 1 ? m.h[i] : null, bot = h != null ? z + h : null, vz = 0;
      if (h != null) { for (var a = 0; a <= i; a++) for (var b = 0; b <= i; b++) vz += m.h[a] * m.h[b] * U.cv('h' + a, 'h' + b); z = bot; }
      var L0 = lith(m.r[i]), q = { i: i, r: m.r[i], h: h, top: top, bot: bot, sr: pct(U.cv('r' + i, 'r' + i)), sh: h != null ? pct(U.cv('h' + i, 'h' + i)) : null, sz: bot ? Math.sqrt(vz) : null, L: L0, fr: /r/.test((fx.tab[i] || {}).fx || ''), fh: /h/.test((fx.tab[i] || {}).fx || '') };
      if (i > 0 && i < N - 1) { var cond = m.r[i] < m.r[i - 1] && m.r[i] < m.r[i + 1], res = m.r[i] > m.r[i - 1] && m.r[i] > m.r[i + 1]; if (cond || res) { var vS = U.cv('h' + i, 'h' + i) + U.cv('r' + i, 'r' + i) + (cond ? -2 : 2) * U.cv('h' + i, 'r' + i); q.eq = { cond: cond, v: cond ? h / m.r[i] : h * m.r[i], s: pct(Math.max(vS, 0)) }; } }
      if (L0.aq && i > 0) q.w = water(m.r[i]);
      lay.push(q);
    }
    var H = 0, S = 0, T = 0; lay.forEach(function (q) { if (q.h != null) { H += q.h; S += q.h / q.r; T += q.h * q.r; } });
    var dz = H ? { H: H, S: S, T: T, rl: H / S, rt: T / H, lam: Math.sqrt((T / H) / (H / S)) } : null;
    return { R0: R0, m: m, c: c, rms: Math.sqrt(E / D.length) * 100, lay: lay, doi: doi, dz: dz, type: ctype(m.r), U: U };
  }

  /* ---------------------------------------------------------------- colour scale for resistivity (log, 1–1000 Ω·m) */
  var CS = [[0, [26, 58, 143]], [0.17, [46, 111, 191]], [0.33, [63, 178, 201]], [0.5, [89, 179, 106]], [0.67, [231, 209, 74]], [0.83, [229, 138, 46]], [1, [192, 57, 43]]];
  function col(r, arr) { var u = Math.max(0, Math.min(1, Math.log10(Math.max(r, 1e-3)) / 3)); for (var i = 1; i < CS.length; i++) if (u <= CS[i][0]) { var a = CS[i - 1], b = CS[i], k = (u - a[0]) / (b[0] - a[0]), c = [0, 1, 2].map(function (j) { return Math.round(a[1][j] + k * (b[1][j] - a[1][j])); }); return arr ? c : 'rgb(' + c.join(',') + ')'; } return arr ? CS[6][1] : 'rgb(192,57,43)'; }
  function colorbar(x, y, w) {
    var s = '<defs><linearGradient id="vsGrad" x1="0" x2="1">' + CS.map(function (q) { return '<stop offset="' + q[0] + '" stop-color="rgb(' + q[1].join(',') + ')"/>'; }).join('') + '</linearGradient></defs>';
    s += G.tx(x, y + 11, 'True resistivity (Ω·m)', { fs: 11.5, fw: 700 }); var bx = x + 150;
    s += '<rect x="' + bx + '" y="' + y + '" width="' + w + '" height="12" fill="url(#vsGrad)" stroke="' + G.INK + '" stroke-width=".8"/>';
    [1, 10, 100, 1000].forEach(function (v, i) { var px = bx + w * i / 3; s += '<line x1="' + px + '" x2="' + px + '" y1="' + (y + 12) + '" y2="' + (y + 16) + '" stroke="' + G.INK + '"/>' + G.tx(px, y + 28, (i === 0 ? '≤ ' : i === 3 ? '≥ ' : '') + v, { fs: 10.5, anchor: 'middle' }); });
    return s;
  }
  function grow(svg, extra, add) { var vb = svg.getAttribute('viewBox').split(' ').map(Number); svg.setAttribute('viewBox', '0 0 ' + vb[2] + ' ' + (vb[3] + extra)); svg.innerHTML = svg.innerHTML.replace(/^<rect width="[^"]+" height="[^"]+" fill="#fff"\/>/, '<rect width="' + vb[2] + '" height="' + (vb[3] + extra) + '" fill="#fff"/>') + add(vb[3]); }

  /* ---------------------------------------------------------------- render */
  function show(R0, m) {
    var segTxt = R0.info.map(function (q) { return 'MN/2 = ' + F(q.mn, q.mn < 1 ? 2 : 1) + ' m: ×' + F(q.f, 3) + (q.n ? '' : t(' (no overlap)', ' (دون تداخل)')); }).join(' · ');
    $('#vsSegInfo').textContent = R0.segs.length > 1 && R0.arr === 'sch' ? (R0.join ? t('Segments joined to MN/2 = ', 'وُصلت القطع إلى MN/2 = ') + F(R0.segs[0], 2) + ' m — ' + segTxt : R0.segs.length + t(' MN segments modelled as measured.', ' قطع MN تُنمذج كما قيست.')) : '';
    if (!m) { last = { R0: R0, A: null, tries: last && last.tries }; $('#vsKpis').innerHTML = ''; $('#vsVerd').innerHTML = G.verdict('info', t('Readings needed', 'القراءات مطلوبة'), t('Enter at least four readings to interpret the sounding.', 'أدخل أربع قراءات على الأقل لتفسير السبر.')); ['vsCur', 'vsCol'].forEach(function (id) { $('#' + id).innerHTML = ''; }); $('#vsLay').innerHTML = ''; $('#vsTbl').innerHTML = ''; stations(); return; }
    var A = analyse(R0, m), tries = last && last.tries; last = { R0: R0, A: A, tries: tries };
    var k = [], v = [], aq = A.lay.filter(function (q) { return q.w; }), main = aq.slice().sort(function (a, b) { return (b.h != null ? b.h : -1) - (a.h != null ? a.h : -1); })[0];
    k.push(G.kpi('info', t('Layers · curve type', 'الطبقات · نوع المنحنى'), A.m.r.length + '<small> · ' + A.type + '</small>', R0.arr === 'wen' ? 'Wenner' : 'Schlumberger'));
    k.push(G.kpi(A.rms < 3 ? 'ok' : A.rms < 6 ? 'warn' : 'bad', t('Fit error (RMS)', 'خطأ المطابقة (RMS)'), F(A.rms, 1) + '<small> %</small>', R0.P.length + t(' readings', ' قراءة')));
    k.push(G.kpi('info', t('Depth of investigation', 'عمق الاستكشاف'), '≈ ' + F(A.doi, 0) + '<small> m</small>', t('about a third of the largest spacing', 'نحو ثلث أكبر مسافة')));
    k.push(G.kpi(main ? 'ok' : 'info', t('Likely water-bearing layer', 'الطبقة المحتملة الحاملة للماء'), main ? F(main.top, 1) + '–' + (main.bot != null ? F(main.bot, 1) : '…') + '<small> m</small>' : '—', main ? F(main.r, 0) + ' Ω·m · ' + t(WCL[main.w.cls][0], WCL[main.w.cls][1]) : t('none in the usual range', 'لا شيء في المدى المعتاد')));
    v.push(G.verdict(A.rms < 3 ? 'ok' : A.rms < 6 ? 'warn' : 'bad', A.rms < 3 ? t('Good fit', 'مطابقة جيدة') : A.rms < 6 ? t('Acceptable fit', 'مطابقة مقبولة') : t('Poor fit', 'مطابقة ضعيفة'), t('The ', 'يطابق النموذج ذو ') + A.m.r.length + t('-layer model fits the readings with an RMS error of ', ' طبقات القراءات بخطأ RMS قدره ') + F(A.rms, 1) + ' %' + (tries ? t(' (automatic choice among ', ' (اختيار تلقائي من بين ') + Object.keys(tries).map(function (n) { return n + ': ' + F(tries[n].rms, 1) + ' %'; }).join(', ') + ')' : '') + '. ' + (A.rms >= 6 ? t('Check outlying readings in the table, try another number of layers, or the ground may not be horizontally layered here.', 'افحص القراءات الشاذة في الجدول، أو جرب عدداً آخر من الطبقات، فقد لا تكون الأرض هنا طبقية أفقية.') : '')));
    if (main) { var w = main.w; v.push(G.verdict('ok', t('Possible aquifer', 'خزان مائي محتمل'), t('Layer ', 'الطبقة ') + (main.i + 1) + t(' from ', ' من ') + F(main.top, 1) + t(' m to ', ' م إلى ') + (main.bot != null ? F(main.bot, 1) + t(' m', ' م') : t('below the depth reached', 'ما دون العمق المستكشف')) + ' (' + F(main.r, 0) + ' Ω·m) ' + t('has the resistivity of sand or gravel holding water. ', 'لها مقاومة رمل أو حصى حامل للماء. ') + (w.est ? t('If it is clean sand with about 30 % porosity, its water would be about ', 'إذا كانت رملاً نظيفاً بمسامية نحو 30 % فماؤها نحو ') : t('With the groundwater resistivity entered, the formation factor is ', 'مع مقاومة المياه المُدخلة يكون عامل التكوين ') + F(w.F, 1) + (w.phi ? t(' and the porosity about ', ' والمسامية نحو ') + F(w.phi * 100, 0) + ' %' : t(' — lower than expected for clean sand, so clay is present', ' — أقل من المتوقع لرمل نظيف، فالطين موجود')) + t('; water of ', '؛ وماء بـ ')) + F(w.tds, 0) + t(' mg/L dissolved solids (', ' ملغم/لتر أملاح ذائبة (') + t(WCL[w.cls][0], WCL[w.cls][1]) + '). ' + t('Confirm with a test well or a water sample before drilling a production well.', 'أكّد ذلك ببئر اختبارية أو عينة ماء قبل حفر بئر إنتاجية.'))); }
    A.lay.forEach(function (q) { if (q.eq && (q.sr > 30 || (q.sh || 0) > 30)) v.push(G.verdict('warn', t('Equivalence in layer ', 'تكافؤ في الطبقة ') + (q.i + 1), t('Its resistivity (±', 'مقاومتها (±') + F(q.sr, 0) + t(' %) and thickness (±', ' %) وسمكها (±') + F(q.sh, 0) + t(' %) are poorly resolved one by one, but its ', ' %) غير محددين كلاً على حدة، لكن ') + (q.eq.cond ? t('conductance h/ρ = ', 'توصيليتها h/ρ = ') + F(q.eq.v, 2) + ' S' : t('transverse resistance hρ = ', 'مقاومتها العرضية hρ = ') + F(q.eq.v, 0) + ' Ω·m²') + t(' is known to ±', ' معروفة ضمن ±') + F(q.eq.s, 0) + t(' %. Fix its thickness or resistivity from a borehole to separate them.', ' %. ثبّت سمكها أو مقاومتها من بئر للفصل بينهما.'))); });
    var deep = A.lay[A.lay.length - 2]; if (deep && deep.bot > A.doi * 1.05) v.push(G.verdict('warn', t('Deepest boundary below the depth reached', 'أعمق حد تحت العمق المستكشف'), t('The top of the last layer at ', 'قمة الطبقة الأخيرة عند ') + F(deep.bot, 0) + t(' m is deeper than about ', ' م أعمق من نحو ') + F(A.doi, 0) + t(' m that the spacings can resolve; extend AB/2 or treat it as uncertain.', ' م التي تستطيع المسافات تمييزها؛ مدّ AB/2 أو عدّه غير مؤكد.')));
    if (R0.info.some(function (q) { return !q.n; })) v.push(G.verdict('warn', t('Segment without overlap', 'قطعة دون تداخل'), t('A segment measured with a new MN has no reading at the same AB/2 as the previous one, so it could not be joined. Repeat one or two readings when MN is changed.', 'لا تحوي قطعة مقيسة بـ MN جديد قراءة عند AB/2 نفسه للقطعة السابقة، فلم تُوصل. كرر قراءة أو اثنتين عند تغيير MN.')));
    if (R0.info.some(function (q) { return q.n && (q.f > 1.15 || q.f < 0.87); })) v.push(G.verdict('warn', t('Large jump between segments', 'قفزة كبيرة بين القطع'), t('A segment had to be shifted by more than 15 %: a lateral change or a near-surface body lies close to the potential electrodes.', 'احتاجت قطعة إلى إزاحة أكثر من 15 %: يوجد تغير جانبي أو جسم قريب من السطح قرب أقطاب الجهد.')));
    if (R0.bad) v.push(G.verdict('warn', t('Readings skipped', 'قراءات مستبعدة'), R0.bad + t(' readings were skipped (missing value, MN/2 not smaller than AB/2, or missing current).', ' قراءة استُبعدت (قيمة ناقصة، أو MN/2 ليس أصغر من AB/2، أو التيار ناقص).')));
    if (R0.close) v.push(G.verdict('info', t('Short spacings', 'مسافات قصيرة'), R0.close + t(' readings have AB/2 less than three times MN/2; they are modelled exactly, but the Schlumberger rule asks for at least five times.', ' قراءة فيها AB/2 أقل من ثلاثة أضعاف MN/2؛ وهي تُنمذج بدقة، لكن قاعدة شلمبرجر تطلب خمسة أضعاف على الأقل.')));
    if (A.dz) v.push(G.verdict('info', t('Dar Zarrouk parameters', 'معاملات دار زاروك'), t('Above the last layer (', 'فوق الطبقة الأخيرة (') + F(A.dz.H, 1) + t(' m): longitudinal conductance S = ', ' م): التوصيلية الطولية S = ') + F(A.dz.S, 2) + t(' S, transverse resistance T = ', ' سيمنز، والمقاومة العرضية T = ') + F(A.dz.T, 0) + t(' Ω·m², longitudinal resistivity ', ' أوم·م²، والمقاومة الطولية ') + F(A.dz.rl, 1) + t(', transverse ', '، والعرضية ') + F(A.dz.rt, 1) + t(' Ω·m and coefficient of anisotropy ', ' أوم·م، ومعامل عدم التجانس ') + F(A.dz.lam, 2) + '. ' + (A.dz.S > 1 ? t('S above 1 S points to a thick clay cover that protects the aquifer from surface pollution.', 'S أكبر من 1 سيمنز تدل على غطاء طيني سميك يحمي الخزان من التلوث السطحي.') : A.dz.S < 0.2 ? t('S below 0.2 S means little clay cover: the aquifer is vulnerable to pollution from the surface.', 'S أقل من 0.2 سيمنز تعني غطاءً طينياً قليلاً: فالخزان معرض للتلوث من السطح.') : '')));
    $('#vsKpis').innerHTML = k.join(''); $('#vsVerd').innerHTML = v.join('');
    figCurve(A); figColumn(A); tables(A); stations();
  }

  function figCurve(A) {
    var R0 = A.R0, D = R0.P, svg = $('#vsCur'), xs = D.map(function (p) { return p.s; }), lo = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, xs) * 0.9))), hi = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, xs) * 1.1)));
    var rs = D.map(function (p) { return p.ra; }).concat(D.map(function (p) { return p.raw; })).concat(A.m.r.map(function (r) { return Math.max(0.1, Math.min(1e5, r)); })), ylo = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, rs) * 0.9))), yhi = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, rs) * 1.1)));
    if (yhi / ylo < 100) { if (Math.min.apply(null, rs) / ylo < yhi / Math.max.apply(null, rs)) ylo /= 10; else yhi *= 10; }
    var cur = [], lm0 = R0.arr === 'wen' ? null : (R0.join ? R0.segs[0] : null);
    for (var e = Math.log10(Math.min.apply(null, xs)); e <= Math.log10(Math.max.apply(null, xs)) + 1e-9; e += 0.025) { var s = Math.pow(10, e), L = R0.arr === 'wen' ? 1.5 * s : s, l = R0.arr === 'wen' ? 0.5 * s : (lm0 || nearestL(D, s)); if (l < L) cur.push([s, fwd(L, l, A.m.r, A.m.h)]); }
    var st = [[lo, A.m.r[0]]], z = 0; A.m.h.forEach(function (h, i) { z += h; st.push([z, A.m.r[i + 1]]); }); st.push([hi, A.m.r[A.m.r.length - 1]]);
    var ser = [], lg = [], shifted = R0.join && R0.info.some(function (q) { return Math.abs(q.f - 1) > 0.005; });
    if (shifted) { ser.push({ pts: D.filter(function (p) { return p.f !== 1; }).map(function (p) { return [p.s, p.raw]; }), col: '#9AA3AB', w: 0, mark: 'o', r: 3.5 }); lg.push({ name: 'Readings before joining', col: '#9AA3AB', mark: 'o', noLine: 1 }); }
    if (!R0.join && R0.segs.length > 1) R0.segs.forEach(function (sg, i) { var c = G.C[(i + 1) % G.C.length]; ser.push({ pts: D.filter(function (p) { return p.seg === sg; }).map(function (p) { return [p.s, p.ra]; }), col: c, w: 1, mark: 'o', r: 4.5, mfill: c }); lg.push({ name: 'Observed, MN/2 = ' + F(sg, sg < 1 ? 2 : 1) + ' m', col: c, mark: 'o', mfill: c, noLine: 1 }); });
    else { ser.push({ pts: D.map(function (p) { return [p.s, p.ra]; }), col: G.INK, w: 0, mark: 'o', r: 4.5, mfill: G.INK }); lg.push({ name: 'Observed apparent resistivity', col: G.INK, mark: 'o', mfill: G.INK, noLine: 1 }); }
    ser.push({ pts: cur, col: '#C0392B', w: 2.4 }); lg.push({ name: 'Model response', col: '#C0392B' });
    ser.unshift({ pts: st, col: '#2E6FBF', w: 2, step: 1 }); lg.push({ name: 'Layered model: true ρ against depth (m)', col: '#2E6FBF' });
    lg.push({ name: 'Depth of investigation', col: '#2E8B57', dash: '6 4' });
    G.chart(svg, { W: 760, H: 470, m: { l: 74, r: 18, t: 18, b: 58 }, x: { lo: lo, hi: hi, log: 1, title: (R0.arr === 'wen' ? 'Electrode spacing a (m)' : 'Half current-electrode spacing AB/2 (m)') + ' · model depth (m)' }, y: { lo: ylo, hi: yhi, log: 1, title: 'Apparent resistivity ρa (Ω·m)' }, series: ser, vl: [{ v: A.doi, col: '#2E8B57', dash: '6 4', label: 'DOI ≈ ' + F(A.doi, 0) + ' m' }], legend: lg,
      note: A.m.r.length + '-layer model · curve type ' + A.type + ' · RMS ' + F(A.rms, 1) + ' % · ' + (R0.arr === 'wen' ? 'Wenner array' : 'Schlumberger array') + ($('#vsName').value ? ' · station ' + $('#vsName').value : '') + '.' });
    $('#vsCurCap').textContent = t('Points are the measured apparent resistivities; the red line is the response of the layered model and the blue steps are the model itself, plotted with depth on the same axis. Apparent resistivity at a spacing reflects the ground to a depth of roughly a third to a half of AB/2, so the curve is smoother than the model.', 'النقاط هي المقاومات الظاهرية المقيسة، والخط الأحمر استجابة النموذج الطبقي، والدرجات الزرقاء هي النموذج نفسه مرسوماً بدلالة العمق على المحور نفسه. والمقاومة الظاهرية عند مسافة ما تعكس الأرض حتى عمق يقارب ثلث AB/2 إلى نصفه، لذا يكون المنحنى أنعم من النموذج.');
  }
  function nearestL(D, s) { var b = D[0]; D.forEach(function (p) { if (Math.abs(Math.log(p.s / s)) < Math.abs(Math.log(b.s / s))) b = p; }); return Math.min(b.l, s * 0.5); }
  function spread(ys, gap, lo, hi) { var o = ys.map(function (y, i) { return { y: y, i: i }; }); for (var it = 0; it < 60; it++) { var mv = false; for (var i = 1; i < o.length; i++) { var d = o[i].y - o[i - 1].y; if (d < gap) { var sh = (gap - d) / 2; o[i - 1].y -= sh; o[i].y += sh; mv = true; } } o.forEach(function (q) { q.y = Math.max(lo, Math.min(hi, q.y)); }); if (!mv) break; } return o.map(function (q) { return q.y; }); }
  function figColumn(A) {
    var svg = $('#vsCol'), L = A.lay, zb = L.length > 1 ? L[L.length - 2].bot : A.doi, zmax = Math.max(A.doi * 1.1, zb * 1.25), cx0 = 150, cx1 = 300, defs = '';
    L.forEach(function (q) { defs += G.hatch('vsH' + q.i, 'rgba(20,28,36,.55)', col(q.r), q.L.k === 'mix' ? 'other' : q.L.k); });
    G.chart(svg, { W: 760, H: 520, m: { l: 74, r: 18, t: 18, b: 30 }, x: { lo: 0, hi: 1, none: 1 }, y: { lo: 0, hi: zmax, rev: 1, title: 'Depth below ground (m)' },
      under: function (fx, fy) { var s = '<defs>' + defs + '</defs>'; L.forEach(function (q) { var y0 = fy(q.top), y1 = fy(q.bot != null ? Math.min(q.bot, zmax) : zmax); s += '<rect x="' + cx0 + '" y="' + y0 + '" width="' + (cx1 - cx0) + '" height="' + Math.max(0.5, y1 - y0) + '" fill="url(#vsH' + q.i + ')" stroke="' + G.INK + '" stroke-width="1"/>'; if (q.w) s += '<rect x="' + (cx0 - 14) + '" y="' + y0 + '" width="8" height="' + Math.max(0.5, y1 - y0) + '" fill="#2E6FBF"/>'; }); s += '<line x1="74" x2="760" y1="' + fy(A.doi) + '" y2="' + fy(A.doi) + '" stroke="#2E8B57" stroke-width="1.4" stroke-dasharray="6 4"/>'; return s; },
      top: function (fx, fy) {
        var s = '', mids = L.map(function (q) { return fy((q.top + (q.bot != null ? Math.min(q.bot, zmax) : zmax)) / 2); }), ly = spread(mids, 46, 30, fy(zmax) - 26);
        L.forEach(function (q, i) { var y = ly[i]; s += '<path d="M' + cx1 + ' ' + mids[i] + 'L' + (cx1 + 22) + ' ' + mids[i] + 'L' + (cx1 + 40) + ' ' + y + 'L' + (cx1 + 46) + ' ' + y + '" fill="none" stroke="' + G.MUT + '" stroke-width="1"/>';
          s += G.tx(cx1 + 52, y - 4, 'Layer ' + (i + 1) + ': ρ = ' + F(q.r, q.r < 10 ? 1 : 0) + ' Ω·m ±' + F(q.sr, 0) + ' %' + (q.h != null ? ', h = ' + F(q.h, 1) + ' m ±' + F(q.sh, 0) + ' %' : ', half-space') + (q.fr || q.fh ? ' (fixed)' : ''), { fs: 11.5, fw: 700 }) ; G.wrap(q.L.en + (q.w ? ' — possible aquifer' : ''), 62).slice(0, 2).forEach(function (ln, j) { s += G.tx(cx1 + 52, y + 11 + j * 14, ln, { fs: 11, fill: q.w ? '#2E6FBF' : G.MUT }); }); });
        var bz = L.filter(function (q) { return q.bot != null && q.bot <= zmax; }), by = spread(bz.map(function (q) { return fy(q.bot); }), 15, 26, fy(zmax) - 4);
        bz.forEach(function (q, i) { s += '<line x1="' + (cx0 - 22) + '" x2="' + cx0 + '" y1="' + fy(q.bot) + '" y2="' + fy(q.bot) + '" stroke="' + G.INK + '"/>' + G.tx(cx0 - 26, by[i] + 4, F(q.bot, 1) + ' m', { fs: 11, anchor: 'end', halo: 1 }); });
        s += G.tx(760 - 24, fy(A.doi) - 6, 'Depth of investigation ≈ ' + F(A.doi, 0) + ' m', { fs: 11, anchor: 'end', fill: '#2E8B57', fw: 700, halo: 1 });
        return s; },
    });
    grow(svg, 74, function (y) { var s = '<defs>' + [['sand', 'Sand or gravel'], ['clay', 'Clay or silt'], ['other', 'Mixed or gypsiferous'], ['rock', 'Rock']].map(function (q) { return G.hatch('vsK' + q[0], 'rgba(20,28,36,.7)', '#fff', q[0]); }).join('') + '</defs>', x = 74;
      [['sand', 'Sand or gravel'], ['clay', 'Clay or silt'], ['other', 'Mixed or gypsiferous'], ['rock', 'Rock']].forEach(function (q) { s += '<rect x="' + x + '" y="' + (y + 8) + '" width="18" height="12" fill="url(#vsK' + q[0] + ')" stroke="' + G.INK + '" stroke-width=".8"/>' + G.tx(x + 24, y + 18, q[1], { fs: 11.5 }); x += 34 + q[1].length * 6.6; });
      s += '<rect x="' + x + '" y="' + (y + 8) + '" width="8" height="12" fill="#2E6FBF"/>' + G.tx(x + 14, y + 18, 'Possible aquifer', { fs: 11.5 });
      return s + colorbar(74, y + 36, 300); });
    $('#vsColCap').textContent = t('Colours give the true resistivity of each layer and the patterns the lithology suggested by it; the blue bar marks layers with the resistivity of water-bearing sand or gravel. Boundary depths are measured from the ground surface.', 'تعطي الألوان المقاومة الحقيقية لكل طبقة، وتعطي النقوش الصخارية التي تقترحها؛ ويؤشر الشريط الأزرق الطبقات ذات مقاومة الرمل أو الحصى الحامل للماء. وتُقاس أعماق الحدود من سطح الأرض.');
  }
  function tables(A) {
    var L = A.lay;
    $('#vsLay').innerHTML = '<thead><tr><th>#</th><th class="num">ρ Ω·m</th><th class="num">±</th><th class="num">h m</th><th class="num">±</th><th class="num">' + t('Top m', 'القمة م') + '</th><th class="num">' + t('Bottom m', 'القاع م') + '</th><th>' + t('Interpretation', 'التفسير') + '</th></tr></thead><tbody>' + L.map(function (q) { return '<tr><td>' + (q.i + 1) + '</td><td class="num">' + F(q.r, q.r < 10 ? 2 : 1) + (q.fr ? ' 🔒' : '') + '</td><td class="num"><span class="ltr">±' + F(q.sr, 0) + ' %</span></td><td class="num">' + (q.h != null ? F(q.h, 2) + (q.fh ? ' 🔒' : '') : '∞') + '</td><td class="num">' + (q.h != null ? '<span class="ltr">±' + F(q.sh, 0) + ' %</span>' : '') + '</td><td class="num">' + F(q.top, 2) + '</td><td class="num">' + (q.bot != null ? '<span class="ltr">' + F(q.bot, 2) + ' ±' + F(q.sz, 1) + '</span>' : '—') + '</td><td>' + t(q.L.en, q.L.ar) + (q.w ? '<br><small style="color:#2E6FBF">' + t('Possible aquifer · water ≈ ', 'خزان محتمل · الماء ≈ ') + F(q.w.tds, 0) + t(' mg/L', ' ملغم/لتر') + (q.w.phi ? t(' · porosity ≈ ', ' · المسامية ≈ ') + F(q.w.phi * 100, 0) + ' %' : '') + '</small>' : '') + '</td></tr>'; }).join('') + '</tbody>';
    var D = A.R0.P, rms = A.rms;
    $('#vsTbl').innerHTML = '<thead><tr><th>#</th><th class="num">AB/2 · a</th><th class="num">MN/2</th><th class="num">K m</th><th class="num">ρa ' + t('measured', 'المقيسة') + '</th><th class="num">ρa ' + t('used', 'المستعملة') + '</th><th class="num">' + t('model', 'النموذج') + '</th><th class="num">' + t('residual', 'الفرق') + '</th></tr></thead><tbody>' + D.map(function (p, i) { var e = (p.ra / A.c[i] - 1) * 100, out = Math.abs(e) > Math.max(5, 3 * rms); return '<tr' + (out ? ' style="background:color-mix(in srgb,#C0392B 12%,transparent)"' : '') + '><td>' + (i + 1) + '</td><td class="num">' + F(p.s, p.s < 10 ? 1 : 0) + '</td><td class="num">' + (A.R0.arr === 'wen' ? '—' : F(p.l, p.l < 1 ? 2 : 1)) + '</td><td class="num">' + F(p.K, p.K < 100 ? 2 : 0) + '</td><td class="num">' + F(p.raw, 2) + '</td><td class="num">' + F(p.ra, 2) + '</td><td class="num">' + F(A.c[i], 2) + '</td><td class="num"><span class="ltr">' + (e >= 0 ? '+' : '') + F(e, 1) + ' %</span>' + (out ? ' ⚠' : '') + '</td></tr>'; }).join('') + '</tbody>';
  }

  /* ---------------------------------------------------------------- stations and section */
  function getSt() { return SH.store.get(SK, []); }
  function stations() {
    var S = getSt(), host = $('#vsStations');
    host.innerHTML = S.length ? S.slice().sort(function (a, b) { return a.x - b.x; }).map(function (s) { return '<div class="it"><div><b class="ltr">' + SH.esc(s.name) + '</b><small>' + F(s.x, 0) + t(' m on line', ' م على الخط') + ' · ' + s.r.length + t(' layers', ' طبقات') + ' · RMS ' + F(s.rms, 1) + ' %' + (s.lat != null ? ' · ' + F(s.lat, 5) + ', ' + F(s.lon, 5) : '') + '</small></div><button class="btn btn-line btn-xs" type="button" data-ld="' + s.id + '">' + t('Open', 'افتح') + '</button><button class="btn btn-line btn-xs" type="button" data-dl="' + s.id + '" aria-label="' + t('Delete', 'احذف') + '">×</button></div>'; }).join('') : '<p class="xsmall muted" style="margin:0">' + t('No stations saved yet.', 'لا محطات محفوظة بعد.') + '</p>';
    figSection(S);
  }
  $('#vsStations').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ld],[data-dl]'); if (!b) return; var S = getSt(), id = b.getAttribute('data-ld') || b.getAttribute('data-dl'), s = S.filter(function (q) { return q.id === id; })[0]; if (!s) return;
    if (b.hasAttribute('data-dl')) { SH.confirm(t('Delete station ', 'احذف المحطة ') + SH.esc(s.name) + '?').then(function (ok) { if (ok) { SH.store.set(SK, S.filter(function (q) { return q.id !== id; })); stations(); } }); return; }
    G.set({ vsArr: s.arr, vsMode: s.mode, vsName: s.name, vsX: s.x, vsZ: s.z != null ? s.z : '' }); $('#vsJoin').checked = s.join !== false; hush(function () { RD.set(s.rows); MD.set(s.r.map(function (r, i) { return { r: r, h: i < s.h.length ? s.h[i] : null, fx: (s.fx || [])[i] || '' }; })); }); POS = s.lat != null ? { lat: s.lat, lon: s.lon, acc: s.acc } : null; posTxt(); forwardOnly(); SH.toast(t('Station opened.', 'فُتحت المحطة.'), 'ok');
  });
  function posTxt() { $('#vsPos').textContent = POS ? t('Position: ', 'الموقع: ') + F(POS.lat, 6) + ', ' + F(POS.lon, 6) + ' (±' + F(POS.acc || 0, 0) + ' m)' : ''; }
  $('#vsGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.gpsFix({ ms: 20000, target: 5 }).then(function (f) { POS = { lat: f.lat, lon: f.lon, acc: f.acc }; if (f.alt != null && !$('#vsZ').value) $('#vsZ').value = Math.round(f.alt); posTxt(); SH.toast(t('Position taken.', 'أُخذ الموقع.'), 'ok'); }).catch(function (er) { SH.toast(er.message, 'bad'); }).then(function () { b.disabled = false; }); });
  $('#vsSave').addEventListener('click', function () {
    if (!last || !last.A) { SH.toast(t('Interpret the sounding first.', 'فسّر السبر أولاً.'), 'warn'); return; }
    var A = last.A, name = ($('#vsName').value || 'VES').trim(), S = getSt(), ex = S.filter(function (q) { return q.name === name; })[0], z = G.v('vsZ');
    var rec = { id: ex ? ex.id : SH.uid('VES'), name: name, x: G.v('vsX') || 0, z: isFinite(z) ? z : null, lat: POS ? POS.lat : null, lon: POS ? POS.lon : null, acc: POS ? POS.acc : null, arr: A.R0.arr, mode: $('#vsMode').value, join: A.R0.join, rows: RD.get(), r: A.m.r, h: A.m.h, fx: MD.get().map(function (q) { return q.fx || ''; }), rms: A.rms, doi: A.doi, type: A.type, date: new Date().toISOString() };
    var go = function () { SH.store.set(SK, S.filter(function (q) { return q.name !== name; }).concat([rec])); stations(); SH.toast(t('Station saved on this device.', 'حُفظت المحطة على هذا الجهاز.'), 'ok'); var m = /^(.*?)(\d+)$/.exec(name); if (m) $('#vsName').value = m[1] + (+m[2] + 1); persist.save(); };
    if (ex) SH.confirm(t('Replace the saved station ', 'استبدل المحطة المحفوظة ') + SH.esc(name) + '?').then(function (ok) { if (ok) go(); }); else go();
  });
  function figSection(S) {
    var svg = $('#vsSec'), cap = $('#vsSecCap'), em = $('#vsSecEmpty');
    if (S.length < 2) { svg.innerHTML = ''; svg.style.display = 'none'; em.hidden = false; cap.textContent = ''; return; }
    svg.style.display = ''; em.hidden = true;
    S = S.slice().sort(function (a, b) { return a.x - b.x; });
    var elev = S.every(function (s) { return s.z != null && isFinite(s.z); }), x0 = S[0].x, x1 = S[S.length - 1].x, span = Math.max(1, x1 - x0), pad = span * 0.04;
    var top = elev ? Math.max.apply(null, S.map(function (s) { return s.z; })) : 0, bot = elev ? Math.min.apply(null, S.map(function (s) { return s.z - s.doi * 1.1; })) : Math.max.apply(null, S.map(function (s) { return s.doi * 1.1; }));
    var rAt = function (s, d) { var z = 0; for (var i = 0; i < s.h.length; i++) { z += s.h[i]; if (d < z) return s.r[i]; } return s.r[s.r.length - 1]; };
    var nx = 220, nz = 110, cv = document.createElement('canvas'); cv.width = nx; cv.height = nz; var g = cv.getContext('2d'), im = g.createImageData(nx, nz);
    for (var ix = 0; ix < nx; ix++) {
      var X = x0 - pad + (span + 2 * pad) * (ix + 0.5) / nx, j = 0; while (j < S.length - 2 && X > S[j + 1].x) j++; var a = S[j], b = S[j + 1], u = Math.max(0, Math.min(1, (X - a.x) / Math.max(1e-9, b.x - a.x))), gz = elev ? a.z + u * (b.z - a.z) : 0, dmax = a.doi + u * (b.doi - a.doi);
      for (var iz = 0; iz < nz; iz++) {
        var Z = elev ? top - (top - bot) * (iz + 0.5) / nz : bot * (iz + 0.5) / nz, k = (iz * nx + ix) * 4;
        if (elev && Z > gz) { im.data[k + 3] = 0; continue; }
        var dA = elev ? a.z - Z : Z, dB = elev ? b.z - Z : Z, lr = (1 - u) * Math.log(rAt(a, Math.max(0, dA))) + u * Math.log(rAt(b, Math.max(0, dB))), c = col(Math.exp(lr), 1), dep = elev ? gz - Z : Z, fade = dep > dmax ? 0.45 : 1;
        im.data[k] = Math.round(c[0] * fade + 255 * (1 - fade)); im.data[k + 1] = Math.round(c[1] * fade + 255 * (1 - fade)); im.data[k + 2] = Math.round(c[2] * fade + 255 * (1 - fade)); im.data[k + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0); var url = cv.toDataURL('image/png'), ylo = elev ? bot : 0, yhi = elev ? top : bot;
    var R = G.chart(svg, { W: 760, H: 470, m: { l: 74, r: 18, t: 40, b: 58 }, x: { lo: x0 - pad, hi: x1 + pad, title: 'Distance along the line (m)' }, y: elev ? { lo: ylo, hi: yhi + (yhi - ylo) * 0.02, title: 'Elevation (m)' } : { lo: 0, hi: yhi, rev: 1, title: 'Depth below ground (m)' },
      under: function (fx, fy) { var yA = elev ? fy(yhi) : fy(0), yB = elev ? fy(ylo) : fy(yhi); return '<image href="' + url + '" x="' + fx(x0 - pad) + '" y="' + yA + '" width="' + (fx(x1 + pad) - fx(x0 - pad)) + '" height="' + (yB - yA) + '" preserveAspectRatio="none"/>'; },
      over: function (fx, fy) { var s = ''; if (elev) s += '<path d="' + S.map(function (q, i) { return (i ? 'L' : 'M') + fx(q.x) + ' ' + fy(q.z); }).join('') + '" fill="none" stroke="' + G.INK + '" stroke-width="2"/>';
        S.forEach(function (q) { var g0 = elev ? q.z : 0, yb = function (d) { return fy(elev ? g0 - d : d); }; s += '<line x1="' + fx(q.x) + '" x2="' + fx(q.x) + '" y1="' + yb(0) + '" y2="' + yb(q.doi) + '" stroke="' + G.INK + '" stroke-width="1.6"/>'; var z = 0; q.h.forEach(function (h) { z += h; if (z <= q.doi * 1.1) s += '<line x1="' + (fx(q.x) - 7) + '" x2="' + (fx(q.x) + 7) + '" y1="' + yb(z) + '" y2="' + yb(z) + '" stroke="' + G.INK + '" stroke-width="1.6"/>'; }); });
        return s; },
      top: function (fx, fy) { var s = '', px = S.map(function (q) { return fx(q.x); }), lx = spreadX(px, 54, 74 + 20, 742 - 20); S.forEach(function (q, i) { s += '<path d="M' + px[i] + ' 40L' + px[i] + ' 34L' + lx[i] + ' 26" fill="none" stroke="' + G.MUT + '"/>' + G.tx(lx[i], 22, q.name, { fs: 11.5, fw: 700, anchor: 'middle' }); });
        var ppm = (fx(x1 + pad) - fx(x0 - pad)) / (span + 2 * pad), sb = G.scaleBar(0, 0, ppm, 160), sx = 92, sy = (elev ? fy(ylo) : fy(yhi)) - 30; s += '<rect x="' + (sx - 10) + '" y="' + (sy - 18) + '" width="205" height="34" rx="4" fill="#fff" fill-opacity=".85"/>' + '<g transform="translate(' + sx + ' ' + sy + ')">' + sb + '</g>'; return s; },
      legend: [{ name: 'Sounding: layer boundaries to the depth of investigation', col: G.INK }, { name: 'Pale: below the depth of investigation', col: '#C9CED2', box: 1, op: 1 }].concat(elev ? [{ name: 'Ground surface', col: G.INK, w: 2 }] : []) });
    var ve = (R.PH / (Math.abs(yhi - ylo))) / ((R.PW) / (span + 2 * pad)); void R;
    grow(svg, 44, function (y) { return colorbar(74, y + 6, 300) + G.tx(742, y + 18, 'Vertical exaggeration × ' + F(ve, ve < 10 ? 1 : 0), { fs: 11, anchor: 'end', fill: G.MUT }); });
    cap.textContent = t('Resistivity between soundings is interpolated along each depth, so the section shows the likely continuity of layers, not measured values. Boundaries that do not line up between neighbouring stations may be real changes or equivalence; add stations where the pattern changes.', 'تُستوفى المقاومة بين الجسات على امتداد كل عمق، فيُظهر المقطع الاستمرارية المحتملة للطبقات لا قيماً مقيسة. والحدود غير المتطابقة بين محطتين متجاورتين قد تكون تغيرات حقيقية أو تكافؤاً؛ فأضف محطات حيث يتغير النمط.');
  }
  function spreadX(xs, gap, lo, hi) { var o = xs.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x - b.x; }); for (var it = 0; it < 80; it++) { var mv = false; for (var i = 1; i < o.length; i++) { var d = o[i].x - o[i - 1].x; if (d < gap) { var sh = (gap - d) / 2; o[i - 1].x -= sh; o[i].x += sh; mv = true; } } o.forEach(function (q) { q.x = Math.max(lo, Math.min(hi, q.x)); }); if (!mv) break; } var out = []; o.forEach(function (q) { out[q.i] = q.x; }); return out; }

  /* ---------------------------------------------------------------- inputs, paste, exports */
  $('#vsAdd').addEventListener('click', function () { RD.add({}); });
  $('#vsAddL').addEventListener('click', function () { var tab = MD.get(); if (tab.length >= 8) return; var lastL = tab[tab.length - 1]; if (lastL && !(lastL.h > 0)) lastL.h = 10; MD.set(tab.concat([{ r: lastL ? lastL.r : 20, h: null, fx: '' }])); });
  $('#vsClear').addEventListener('click', function () { SH.confirm(t('Clear all readings and the model?', 'امسح كل القراءات والنموذج؟')).then(function (ok) { if (ok) { hush(function () { RD.set([{}, {}, {}, {}, {}, {}]); MD.set([]); }); last = null; forwardOnly(); } }); });
  $('#vsPasteBtn').addEventListener('click', function () { var b = $('#vsPasteBox'); b.hidden = !b.hidden; if (!b.hidden) $('#vsPaste').focus(); });
  $('#vsPasteOk').addEventListener('click', function () {
    var wen = $('#vsArr').value === 'wen', rows = [];
    $('#vsPaste').value.split(/\r?\n/).forEach(function (ln) { var c = ln.trim().split(/[\s,;]+/).map(function (v) { return parseFloat(v.replace(/٫/g, '.').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })); }); if (!c.length || !isFinite(c[0])) return;
      if (wen) { if (isFinite(c[1])) rows.push({ s: c[0], mn: null, v: c[1], i: isFinite(c[2]) ? c[2] : null }); } else if (c.length >= 3 && isFinite(c[1]) && isFinite(c[2])) rows.push({ s: c[0], mn: c[1], v: c[2], i: isFinite(c[3]) ? c[3] : null }); });
    if (rows.length < 3) { SH.toast(t('No readings found. Use one line per reading: AB/2, MN/2, reading.', 'لم تُعثر على قراءات. استعمل سطراً لكل قراءة: AB/2 ثم MN/2 ثم القراءة.'), 'bad'); return; }
    hush(function () { RD.set(rows); MD.set([]); }); $('#vsPasteBox').hidden = true; $('#vsPaste').value = ''; SH.toast(rows.length + t(' readings loaded.', ' قراءة حُمّلت.'), 'ok'); interpret('auto');
  });
  $('#vsAuto').addEventListener('click', function () { interpret('auto'); });
  $('#vsRef').addEventListener('click', function () { if (!current() || current().r.length < 2) interpret('auto'); else interpret('refine'); });
  $('#vsN').addEventListener('change', function () { persist.save(); hush(function () { MD.set([]); }); interpret('auto'); });
  ['vsArr', 'vsMode', 'vsJoin'].forEach(function (id) { $('#' + id).addEventListener('change', function () { persist.save(); later(refit, 100); }); });
  ['vsWt', 'vsName'].forEach(function (id) { $('#' + id).addEventListener('input', function () { later(forwardOnly, 300); }); });
  $('#vsCsv').addEventListener('click', function () { if (!last || !last.A) return; var A = last.A; SH.csv('shandal-ves-readings.csv', [['AB2_or_a_m', 'MN2_m', 'K_m', 'rhoa_measured', 'segment_factor', 'rhoa_used', 'rhoa_model', 'residual_pct']].concat(A.R0.P.map(function (p, i) { return [p.s, A.R0.arr === 'wen' ? '' : p.l, p.K.toFixed(3), p.raw.toFixed(3), p.f.toFixed(4), p.ra.toFixed(3), A.c[i].toFixed(3), ((p.ra / A.c[i] - 1) * 100).toFixed(2)]; })).concat([[], ['RMS_pct', A.rms.toFixed(2)], ['curve_type', A.type]])); });
  $('#vsModCsv').addEventListener('click', function () { if (!last || !last.A) return; var A = last.A; SH.csv('shandal-ves-model.csv', [['layer', 'rho_ohm_m', 'rho_unc_pct', 'thickness_m', 'thickness_unc_pct', 'top_m', 'bottom_m', 'interpretation']].concat(A.lay.map(function (q) { return [q.i + 1, q.r.toFixed(3), q.sr.toFixed(0), q.h != null ? q.h.toFixed(3) : '', q.sh != null ? q.sh.toFixed(0) : '', q.top.toFixed(2), q.bot != null ? q.bot.toFixed(2) : '', q.L.en]; })).concat(A.dz ? [[], ['S_siemens', A.dz.S.toFixed(4)], ['T_ohm_m2', A.dz.T.toFixed(1)], ['anisotropy', A.dz.lam.toFixed(3)]] : [])); });
  $('#vsStCsv').addEventListener('click', function () { var S = getSt(); if (!S.length) { SH.toast(t('No stations saved yet.', 'لا محطات محفوظة بعد.'), 'warn'); return; } var mx = Math.max.apply(null, S.map(function (s) { return s.r.length; })), hd = ['station', 'distance_m', 'elevation_m', 'lat', 'lon', 'array', 'layers', 'rms_pct', 'curve_type']; for (var i = 1; i <= mx; i++) hd.push('rho' + i, 'h' + i); SH.csv('shandal-ves-stations.csv', [hd].concat(S.map(function (s) { var row = [s.name, s.x, s.z != null ? s.z : '', s.lat != null ? s.lat.toFixed(6) : '', s.lon != null ? s.lon.toFixed(6) : '', s.arr, s.r.length, s.rms.toFixed(2), s.type]; for (var i = 0; i < mx; i++) row.push(s.r[i] != null ? s.r[i].toFixed(3) : '', s.h[i] != null ? s.h[i].toFixed(3) : ''); return row; }))); });
  $('#vsBak').addEventListener('click', function () { SH.json('shandal-ves-project.json', { app: 'shandal-ves', v: 1, saved: new Date().toISOString(), stations: getSt(), current: { rows: RD.get(), model: MD.get() } }); });
  $('#vsRes').addEventListener('change', function () { var f = this.files[0], inp = this; if (!f) return; var rd = new FileReader(); rd.onload = function () { var o; try { o = JSON.parse(rd.result); } catch (e) { o = null; } if (!o || o.app !== 'shandal-ves' || !Array.isArray(o.stations)) { SH.toast(t('This is not a Shandal sounding backup.', 'هذا ليس ملف نسخة لمختبر السبر في نظام شندل.'), 'bad'); return; } SH.confirm(t('Replace the saved stations with the ', 'استبدل المحطات المحفوظة بـ ') + o.stations.length + t(' stations of the backup?', ' محطة من النسخة؟')).then(function (ok) { if (!ok) return; SH.store.set(SK, o.stations); if (o.current && Array.isArray(o.current.rows)) hush(function () { RD.set(o.current.rows); MD.set(o.current.model || []); }); forwardOnly(); SH.toast(t('Backup opened.', 'فُتحت النسخة.'), 'ok'); }); inp.value = ''; }; rd.readAsText(f); });
  $('#vsDemo').addEventListener('click', function () { G.set({ vsArr: 'sch', vsMode: 'rho', vsN: 'auto', vsWt: '', vsName: 'VES-1', vsX: 0, vsZ: '' }); $('#vsJoin').checked = true; hush(function () { RD.set(DEMO); MD.set([]); }); interpret('auto'); });
  var tm = null; function later(fn, ms) { clearTimeout(tm); tm = setTimeout(fn, ms || 200); }
  window.SHVES = { fwd: fwd, lm: lm, autoFit: autoFit, readings: readings };
  document.addEventListener('DOMContentLoaded', function () { posTxt(); if (current() && current().r.length >= 2) forwardOnly(); else interpret('auto'); });
})();
