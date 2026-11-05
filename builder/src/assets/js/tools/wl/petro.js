/* Well-log lab — petrophysics: shale volume, porosity, a constrained mineral solution (non-negative least squares with the
   unity equation), water saturation (Archie, Simandoux, Indonesia), fluids, invasion, bad hole, fracture candidates,
   source-rock flags, zonation, pay, uncertainty of saturation, and the groundwater (aquifer and salinity) reading. */
(function () {
  'use strict';
  var WL = window.WL;
  /* end-member responses: density g/cm³, neutron (limestone units) v/v, photoelectric factor b/e, volumetric
     cross-section U b/cm³, sonic µs/ft (Schlumberger log-interpretation charts) */
  var MIN = {
    qtz: { en: 'Quartz', ar: 'كوارتز', r: 2.65, n: -0.035, p: 1.81, u: 4.79, dt: 55.5, col: '#f6e05e' },
    cal: { en: 'Calcite', ar: 'كالسايت', r: 2.71, n: 0.0, p: 5.08, u: 13.77, dt: 47.6, col: '#6fa8dc' },
    dol: { en: 'Dolomite', ar: 'دولومايت', r: 2.87, n: 0.02, p: 3.14, u: 9.0, dt: 43.5, col: '#c27ba0' },
    anh: { en: 'Anhydrite', ar: 'أنهايدرايت', r: 2.98, n: -0.02, p: 5.05, u: 14.93, dt: 50.0, col: '#f4cccc' },
    hal: { en: 'Halite', ar: 'هالايت', r: 2.04, n: -0.03, p: 4.65, u: 9.45, dt: 67.0, col: '#e6f2ff' }
  };
  WL.MIN = MIN;
  var SETS = { clastic: ['qtz', 'cal', 'dol'], carbonate: ['cal', 'dol', 'qtz'], mixed: ['qtz', 'cal', 'dol'] };

  /* Lawson & Hanson (1974) non-negative least squares for a small dense system A x ≈ b */
  function nnls(A, b, nv) {
    var m = A.length, x = new Array(nv).fill(0), P = [], Z = [], it = 0, i, j, k;
    for (j = 0; j < nv; j++) Z.push(j);
    var grad = function () { var w = new Array(nv).fill(0); for (i = 0; i < m; i++) { var r = b[i]; for (k = 0; k < nv; k++) r -= A[i][k] * x[k]; for (j = 0; j < nv; j++) w[j] += A[i][j] * r; } return w; };
    var lsq = function (cols) { var n = cols.length, M = [], v = []; for (var a = 0; a < n; a++) { M.push(new Array(n).fill(0)); v.push(0); for (var c = 0; c < n; c++) for (i = 0; i < m; i++) M[a][c] += A[i][cols[a]] * A[i][cols[c]]; for (i = 0; i < m; i++) v[a] += A[i][cols[a]] * b[i]; }
      for (var p = 0; p < n; p++) { var mx = p; for (var q = p + 1; q < n; q++) if (Math.abs(M[q][p]) > Math.abs(M[mx][p])) mx = q; var tm = M[p]; M[p] = M[mx]; M[mx] = tm; var tv = v[p]; v[p] = v[mx]; v[mx] = tv; if (Math.abs(M[p][p]) < 1e-12) M[p][p] = 1e-12;
        for (q = p + 1; q < n; q++) { var f = M[q][p] / M[p][p]; for (var c2 = p; c2 < n; c2++) M[q][c2] -= f * M[p][c2]; v[q] -= f * v[p]; } }
      var s = new Array(n).fill(0); for (p = n - 1; p >= 0; p--) { var t = v[p]; for (q = p + 1; q < n; q++) t -= M[p][q] * s[q]; s[p] = t / M[p][p]; } return s; };
    while (Z.length && it++ < 3 * nv) {
      var w = grad(), best = -1, bw = 1e-10; Z.forEach(function (z) { if (w[z] > bw) { bw = w[z]; best = z; } }); if (best < 0) break;
      P.push(best); Z.splice(Z.indexOf(best), 1);
      for (var inner = 0; inner < 3 * nv; inner++) {
        var s = lsq(P); if (s.every(function (v) { return v > 0; })) { P.forEach(function (p, a) { x[p] = s[a]; }); break; }
        var al = 1; P.forEach(function (p, a) { if (s[a] <= 0) al = Math.min(al, x[p] / (x[p] - s[a])); });
        P.forEach(function (p, a) { x[p] += al * (s[a] - x[p]); });
        P.filter(function (p) { return x[p] <= 1e-10; }).forEach(function (p) { x[p] = 0; P.splice(P.indexOf(p), 1); Z.push(p); });
      }
    }
    return x;
  }
  var pct = function (arr, p) { var v = Array.prototype.filter.call(arr, isFinite).sort(function (a, b) { return a - b; }); return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : NaN; };
  var median = function (arr) { return pct(arr, 0.5); };
  WL.pct = pct;

  WL.analyse = function (w, P) {
    var D = w.D, n = D.length, i, c = function (k) { return WL.curve(w, k); };
    var GR = c('CGR') && P.useCGR ? c('CGR') : c('GR') || c('CGR'), SP = c('SP'), CAL = c('CALI'), BS = c('BS'), RD = c('RD') || c('RM'), RM = c('RM'), RXO = c('RXO'),
      RHOB = c('RHOB'), NPHI = c('NPHI'), PEF = c('PEF'), DT = c('DT'), DRHO = c('DRHO'), U = c('U');
    var top = isFinite(P.top) ? P.top : D[0], bot = isFinite(P.bot) ? P.bot : D[n - 1], IN = new Uint8Array(n);
    for (i = 0; i < n; i++) IN[i] = D[i] >= top && D[i] <= bot ? 1 : 0;
    var sel = function (arr) { if (!arr) return []; var o = []; for (var q = 0; q < n; q++) if (IN[q] && isFinite(arr[q])) o.push(arr[q]); return o; };
    var R = { n: n, IN: IN, top: top, bot: bot, avail: { GR: !!GR, SP: !!SP, CALI: !!CAL, BS: !!BS, RD: !!RD, RXO: !!RXO, RHOB: !!RHOB, NPHI: !!NPHI, PEF: !!PEF, DT: !!DT, U: !!U } };
    var A = function () { return new Float32Array(n).fill(NaN); };
    /* ---- shale volume from gamma ray (or SP) */
    var grMin = isFinite(P.grMin) ? P.grMin : pct(sel(GR), 0.05), grMax = isFinite(P.grMax) ? P.grMax : (function () { var g = sel(GR).sort(function (a, b) { return a - b; }); if (!g.length) return NaN; var up = g.slice(Math.floor(g.length * 0.75)); return Math.max(up[Math.floor(up.length / 2)], g[Math.floor(g.length * 0.9)]); })();  /* shale line: a thin very radioactive bed must not set it */
    var spCl = pct(sel(SP), 0.03), spSh = pct(sel(SP), 0.97);
    R.grMin = grMin; R.grMax = grMax; R.IGR = A(); R.VSH = A();
    for (i = 0; i < n; i++) {
      var ig = NaN;
      if (GR && isFinite(GR[i])) ig = (GR[i] - grMin) / ((grMax - grMin) || 1);
      else if (SP && isFinite(SP[i])) ig = (SP[i] - spCl) / ((spSh - spCl) || 1);
      if (!isFinite(ig)) continue; ig = Math.max(0, Math.min(1, ig)); R.IGR[i] = ig;
      R.VSH[i] = P.vshM === 'lart' ? 0.083 * (Math.pow(2, 3.7 * ig) - 1) : P.vshM === 'laro' ? 0.33 * (Math.pow(2, 2 * ig) - 1) : P.vshM === 'stieber' ? ig / (3 - 2 * ig) : ig;
    }
    /* ---- bad hole: caliper against bit size, density correction */
    R.WASH = new Uint8Array(n); R.CAKE = new Uint8Array(n);
    var bsz = BS ? null : (isFinite(P.bit) ? P.bit : pct(sel(CAL), 0.15));
    for (i = 0; i < n; i++) { var b = BS ? BS[i] : bsz; if (CAL && isFinite(CAL[i]) && isFinite(b)) { if (CAL[i] - b > 1.0) R.WASH[i] = 1; else if (b - CAL[i] > 0.1) R.CAKE[i] = 1; } if (DRHO && Math.abs(DRHO[i]) > 0.1) R.WASH[i] = 1; }
    /* ---- shale end-member from the shaliest levels */
    var shIdx = []; for (i = 0; i < n; i++) if (IN[i] && R.IGR[i] > 0.85 && !R.WASH[i]) shIdx.push(i);
    var shp = function (arr, def) { if (!arr || shIdx.length < 5) return def; var v = shIdx.map(function (q) { return arr[q]; }).filter(isFinite); return v.length >= 5 ? median(v) : def; };
    var SH = { r: shp(RHOB, 2.45), n: shp(NPHI, 0.33), p: shp(PEF, 3.4), dt: shp(DT, 100), rt: isFinite(P.rsh) ? P.rsh : shp(RD, 2.5) }; SH.u = SH.p * (SH.r + 0.1883) / 1.0704; R.SH = SH;
    /* ---- porosity logs */
    var rf = P.rhof || 1.0;
    R.PHID = A(); R.PHIN = A(); R.PHIS = A(); R.PHIND = A();
    for (i = 0; i < n; i++) {
      if (RHOB && isFinite(RHOB[i])) R.PHID[i] = (2.71 - RHOB[i]) / (2.71 - rf);           /* limestone units, as the neutron */
      if (NPHI && isFinite(NPHI[i])) R.PHIN[i] = NPHI[i];
      if (DT && isFinite(DT[i])) { var dma = P.form === 'clastic' ? 55.5 : P.form === 'carbonate' ? 47.6 : 51.0; R.PHIS[i] = Math.max(0, 0.625 * (DT[i] - dma) / DT[i]); } /* Raymer–Hunt–Gardner */
      if (isFinite(R.PHID[i]) && isFinite(R.PHIN[i])) R.PHIND[i] = (R.PHID[i] + R.PHIN[i]) / 2;
    }
    /* ---- mineral solution, sample by sample */
    /* the sonic enters the solution only without density and neutron: it misses fracture and vug porosity, which the comparison of the two then reveals */
    var logs = []; if (RHOB) logs.push('r'); if (NPHI) logs.push('n'); if (PEF && RHOB) logs.push('u'); if (DT && !(RHOB && NPHI)) logs.push('dt');
    var set = (SETS[P.form] || SETS.mixed).slice(0, Math.max(1, Math.min(3, logs.length))), SIG = { r: 0.025, n: 0.03, u: 0.6, dt: 3 }, FL = { r: rf, n: 1.0, u: 0.398 * rf, dt: 189 };
    R.set = set; R.V = {}; set.concat(['anh', 'hal', 'coal']).forEach(function (k) { R.V[k] = A(); }); R.PHI = A(); R.RES = A(); R.FAC = new Int8Array(n).fill(-1); R.GAS = new Uint8Array(n);
    R.MA = { r: A(), n: A() };
    for (i = 0; i < n; i++) {
      if (!IN[i]) continue; var vsh = R.VSH[i]; if (!isFinite(vsh)) vsh = 0;
      var meas = { r: RHOB && RHOB[i], n: NPHI && NPHI[i], u: PEF && RHOB && PEF[i] * (RHOB[i] + 0.1883) / 1.0704, dt: DT && DT[i] };
      var ok = logs.filter(function (k) { return isFinite(meas[k]); });
      /* coal and salt cannot be fitted by the matrix minerals: recognised first by their unique density–neutron pairs */
      if (RHOB && NPHI && isFinite(meas.r) && isFinite(meas.n)) {
        if (meas.r < 1.85 && meas.n > 0.3 && vsh < 0.6) { R.V.coal[i] = 1 - vsh; R.PHI[i] = 0; R.FAC[i] = 6; continue; }
        if (meas.r < 2.15 && meas.n < 0.04 && (!GR || R.IGR[i] < 0.2) && (!PEF || PEF[i] > 4)) { R.V.hal[i] = 1 - vsh; R.PHI[i] = 0; R.FAC[i] = 5; continue; }
        if (meas.r > 2.93 && meas.n < 0.03 && (!GR || R.IGR[i] < 0.25) && (!PEF || PEF[i] > 4.3)) { R.V.anh[i] = 1 - vsh; R.PHI[i] = 0; R.FAC[i] = 3; R.ANH = 1; continue; }
      }
      if (!ok.length) { if (isFinite(R.PHIS[i])) R.PHI[i] = R.PHIS[i] * (1 - vsh); continue; }
      var Am = [], bm = [], nv = set.length + 1;
      ok.forEach(function (k) { var row = set.map(function (s) { return MIN[s][k === 'r' ? 'r' : k === 'n' ? 'n' : k === 'u' ? 'u' : 'dt'] / SIG[k]; }); row.push(FL[k] / SIG[k]); Am.push(row); bm.push((meas[k] - vsh * SH[k === 'r' ? 'r' : k === 'n' ? 'n' : k === 'u' ? 'u' : 'dt']) / SIG[k]); });
      var urow = set.map(function () { return 1 / 0.01; }); urow.push(1 / 0.01); Am.push(urow); bm.push((1 - vsh) / 0.01);
      var x = nnls(Am, bm, nv), res = 0; ok.forEach(function (k, a) { var pr = 0; for (var q = 0; q < nv; q++) pr += Am[a][q] * x[q]; res += Math.pow(pr - bm[a], 2); });
      R.RES[i] = Math.sqrt(res / ok.length);
      var sm = x.reduce(function (s2, v) { return s2 + v; }, 0) || 1, sc = (1 - vsh) / sm;
      set.forEach(function (s, a) { R.V[s][i] = x[a] * sc; }); R.PHI[i] = x[set.length] * sc;
      /* matrix of the solid part: used to read the density and neutron porosities in the right matrix */
      var vs = 0, mr = 0, mn = 0, md = 0; set.forEach(function (s, a) { vs += x[a]; mr += x[a] * MIN[s].r; mn += x[a] * MIN[s].n; md += x[a] * MIN[s].dt; }); if (vs > 0) { R.MA.r[i] = mr / vs; R.MA.n[i] = mn / vs; if (DT && isFinite(DT[i])) R.PHIS[i] = Math.max(0, 0.625 * (DT[i] - md / vs) / DT[i]); }
    }
    /* ---- gas: density porosity well above neutron porosity once both are read in the solved matrix */
    R.SEP = A();
    for (i = 0; i < n; i++) {
      if (!IN[i] || !RHOB || !NPHI || !isFinite(RHOB[i]) || !isFinite(NPHI[i]) || R.FAC[i] >= 5) continue;
      var dom = null, dv = -1; set.forEach(function (s5) { if (R.V[s5][i] > dv) { dv = R.V[s5][i]; dom = s5; } }); if (R.FAC[i] === 3) continue;
      var rma = dom ? MIN[dom].r : 2.68, nma = dom ? MIN[dom].n : 0, vv = isFinite(R.VSH[i]) ? R.VSH[i] : 0;   /* read in the matrix of the dominant mineral, so the solution cannot absorb the gas effect */
      var pd = (rma - RHOB[i] - vv * (rma - SH.r)) / (rma - rf), pn = (NPHI[i] - nma - vv * (SH.n - nma)) / (1 - nma), sep = pd - pn; R.SEP[i] = sep;
      if (sep > 0.08 && pd > 0.06 && vv < 0.35 && !R.WASH[i]) { R.GAS[i] = 1; R.PHI[i] = Math.min(0.45, Math.sqrt((pd * pd + Math.max(0, pn) * Math.max(0, pn)) / 2)); }
    }
    /* ---- water resistivity */
    var a = P.a || 1, m = P.m || 2, nn = P.n || 2, rwList = [];
    for (i = 0; i < n; i++) if (IN[i] && RD && isFinite(RD[i]) && R.PHI[i] > 0.1 && R.VSH[i] < 0.15 && !R.GAS[i]) rwList.push(RD[i] * Math.pow(R.PHI[i], m) / a);
    var rw = isFinite(P.rw) && P.rw > 0 ? P.rw : rwList.length >= 5 ? pct(rwList, 0.1) : 0.05;
    if (isFinite(P.rwT) && isFinite(P.fT) && isFinite(P.rw)) rw = P.rw * (P.rwT + 21.5) / (P.fT + 21.5);      /* Arps (1953), °C */
    R.rw = rw; R.rwAuto = !(isFinite(P.rw) && P.rw > 0); R.rwN = rwList.length;
    /* ---- water saturation */
    var swOf = function (rt, phi, vsh2, aa, mm, n2, rw2) {
      if (!(rt > 0) || !(phi > 0.005)) return NaN;
      var s;
      if (P.model === 'simandoux' && vsh2 > 0) { var q1 = vsh2 / SH.rt, q2 = Math.pow(phi, mm) / (aa * rw2); s = (Math.sqrt(q1 * q1 + 4 * q2 / rt) - q1) / (2 * q2); s = Math.pow(Math.max(s, 1e-6), 2 / n2); }
      else if (P.model === 'indonesia' && vsh2 > 0) { var den = Math.pow(vsh2, 1 - vsh2 / 2) / Math.sqrt(SH.rt) + Math.sqrt(Math.pow(phi, mm) / (aa * rw2)); s = Math.pow(1 / (Math.sqrt(rt) * den), 2 / n2); }
      else s = Math.pow(aa * rw2 / (Math.pow(phi, mm) * rt), 1 / n2);
      return Math.max(0, Math.min(1, s)); };
    R.swOf = swOf; R.SW = A(); R.SXO = A(); R.BVW = A(); R.PERM = A();
    var rmf = P.rmf;
    for (i = 0; i < n; i++) {
      if (!IN[i] || !RD) continue; var sw = swOf(RD[i], R.PHI[i], R.VSH[i] || 0, a, m, nn, rw); R.SW[i] = sw; if (isFinite(sw)) R.BVW[i] = R.PHI[i] * sw;
      var RS = RXO || RM; if (RS && rmf > 0 && isFinite(RS[i])) R.SXO[i] = swOf(RS[i], R.PHI[i], R.VSH[i] || 0, a, m, nn, rmf);   /* flushed zone from the microresistivity, or the shallow laterolog when there is none */
      if (isFinite(sw) && sw < 0.9 && R.PHI[i] > 0.03) R.PERM[i] = 0.136 * Math.pow(R.PHI[i] * 100, 4.4) / Math.pow(Math.max(sw, 0.08) * 100, 2);  /* Timur (1968), md */
    }
    /* ---- invasion, fractures, source rock */
    R.INV = new Uint8Array(n); R.FRAC = new Uint8Array(n); R.SRC = new Uint8Array(n); R.SPI = A();
    var grHi = grMax + 0.4 * (grMax - grMin);
    for (i = 0; i < n; i++) {
      if (!IN[i]) continue;
      if ((RXO && RD && isFinite(RXO[i]) && isFinite(RD[i]) && Math.abs(Math.log10(RXO[i] / RD[i])) > 0.2 && R.PHI[i] > 0.04) || R.CAKE[i]) R.INV[i] = 1;
      if (isFinite(R.PHIS[i]) && isFinite(R.PHI[i]) && R.FAC[i] < 5) { var spi = R.PHI[i] - R.PHIS[i] * (1 - (R.VSH[i] || 0)); R.SPI[i] = spi; if (spi > 0.025 && R.PHI[i] < 0.12 && (R.VSH[i] || 0) < 0.3 && !R.WASH[i]) R.FRAC[i] = 1; }
      var hotU = U && isFinite(U[i]) && U[i] > 8, hotG = GR && GR[i] > grHi;
      if ((hotU || hotG) && RD && RD[i] > 3 * SH.rt && (!RHOB || RHOB[i] < SH.r)) R.SRC[i] = 1;
    }
    /* ---- facies: 0 sandstone, 1 limestone, 2 dolomite, 3 anhydrite, 4 shale, 5 salt, 6 coal, 7 organic-rich shale, 8 unknown clean rock */
    for (i = 0; i < n; i++) {
      if (!IN[i] || R.FAC[i] >= 3) continue; var vsh3 = R.VSH[i];
      if (!isFinite(vsh3)) continue;
      if (R.IGR[i] >= 0.55) { R.FAC[i] = R.SRC[i] ? 7 : 4; continue; }
      if (!set.length || !logs.length) { R.FAC[i] = P.form === 'carbonate' ? 1 : 0; continue; }
      var bk = -1, bv = -1; set.forEach(function (s) { var v = R.V[s][i]; if (v > bv) { bv = v; bk = s; } });
      R.FAC[i] = { qtz: 0, cal: 1, dol: 2, anh: 3 }[bk]; if (R.FAC[i] == null) R.FAC[i] = 8;
    }
    /* ---- fluids and pay (oil and gas) or aquifers (groundwater) */
    var cV = P.cutV, cP = P.cutP, cS = P.cutS;
    R.PAY = new Uint8Array(n); R.FLU = new Int8Array(n).fill(-1);  /* 0 water, 1 oil, 2 gas, 3 fresh, 4 brackish, 5 saline */
    R.TDS = A();
    for (i = 0; i < n; i++) {
      if (!IN[i]) continue; var res2 = (R.VSH[i] || 0) <= cV && R.PHI[i] >= cP;
      if (P.mode === 'water') {
        if (!res2 || !RD || !isFinite(RD[i])) continue;
        var rwi = RD[i] * Math.pow(R.PHI[i], m) / a, rw25 = isFinite(P.fT) ? rwi * (P.fT + 21.5) / (25 + 21.5) : rwi, tds = 0.64 * 10000 / rw25;
        R.TDS[i] = tds; R.FLU[i] = tds < 1000 ? 3 : tds < 10000 ? 4 : 5; R.PAY[i] = 1; continue;
      }
      if (!res2) continue;
      var swi = R.SW[i]; if (!isFinite(swi)) continue;
      if (swi <= cS) { R.FLU[i] = R.GAS[i] ? 2 : 1; R.PAY[i] = 1; } else R.FLU[i] = 0;
    }
    /* ---- zonation: runs of one facies, thinner runs merged into the neighbour of nearest gamma ray */
    /* majority filter over about 1 m: single noisy samples do not open a layer */
    var win = Math.max(2, Math.round((w.unit === 'ft' ? 3.3 : 1) / (w.step || 1) / 2)), mode = function (A2) { var out = A2.slice(); for (var q = 0; q < n; q++) { if (!IN[q] || A2[q] < 0) continue; var cnt = {}, best = A2[q], bc = 0; for (var r2 = Math.max(0, q - win); r2 <= Math.min(n - 1, q + win); r2++) { if (!IN[r2] || A2[r2] < 0) continue; var v2 = A2[r2]; cnt[v2] = (cnt[v2] || 0) + 1; if (cnt[v2] > bc) { bc = cnt[v2]; best = v2; } } out[q] = best; } return out; };
    R.FAC = mode(R.FAC); var FL2 = mode(R.FLU); for (i = 0; i < n; i++) if (R.FLU[i] >= 0 || FL2[i] < 0) R.FLU[i] = FL2[i];
    var zones = [], minTh = P.minTh > 0 ? P.minTh : Math.max(w.unit === 'ft' ? 2 : 0.6, 4 * (w.step || 0)), cur = null;
    /* a layer is one lithology with one fluid: a sandstone with gas over oil over water gives three layers */
    var key = function (q) { return R.FAC[q] * 10 + (R.FLU[q] >= 0 ? R.FLU[q] : 9); };
    for (i = 0; i < n; i++) { if (!IN[i]) continue; var f = key(i); if (!cur || f !== cur.k) { if (cur) zones.push(cur); cur = { k: f, f: R.FAC[i], a: i, b: i }; } else cur.b = i; }
    if (cur) zones.push(cur);
    var mean = function (arr, z) { if (!arr) return NaN; var s3 = 0, k3 = 0; for (var q = z.a; q <= z.b; q++) if (isFinite(arr[q])) { s3 += arr[q]; k3++; } return k3 ? s3 / k3 : NaN; };
    var th = function (z) { return D[z.b] - D[z.a] + (w.step || 0); };
    for (var pass = 0; pass < 20000; pass++) {
      var idx = -1, tmin = minTh; zones.forEach(function (z, k) { var t = th(z); if (t < tmin) { tmin = t; idx = k; } }); if (idx < 0 || zones.length < 2) break;
      var z0 = zones[idx], L = zones[idx - 1], Rz = zones[idx + 1], g0 = mean(GR || R.VSH, z0), tgt;
      if (!L) tgt = Rz; else if (!Rz) tgt = L; else tgt = Math.abs(mean(GR || R.VSH, L) - g0) <= Math.abs(mean(GR || R.VSH, Rz) - g0) ? L : Rz;
      tgt.a = Math.min(tgt.a, z0.a); tgt.b = Math.max(tgt.b, z0.b); zones.splice(idx, 1);
      for (var k4 = zones.length - 1; k4 > 0; k4--) if (zones[k4].k === zones[k4 - 1].k) { zones[k4 - 1].b = zones[k4].b; zones.splice(k4, 1); }
    }
    zones.forEach(function (z) {
      var cnt = {}, net = 0, fl = {}, frac = 0, wash = 0, inv = 0, nz = z.b - z.a + 1;
      for (var q = z.a; q <= z.b; q++) { if (R.PAY[q]) net++; if (R.FLU[q] >= 0) fl[R.FLU[q]] = (fl[R.FLU[q]] || 0) + 1; if (R.FRAC[q]) frac++; if (R.WASH[q]) wash++; if (R.INV[q]) inv++; }
      var mf = -1, mc = 0; Object.keys(fl).forEach(function (k5) { if (fl[k5] > mc) { mc = fl[k5]; mf = +k5; } }); if (mc < 0.3 * nz) mf = -1;
      var fc = {}; for (q = z.a; q <= z.b; q++) if (R.FAC[q] >= 0) fc[R.FAC[q]] = (fc[R.FAC[q]] || 0) + 1; var mfc = z.f, mcc = 0; Object.keys(fc).forEach(function (k6) { if (fc[k6] > mcc) { mcc = fc[k6]; mfc = +k6; } }); z.f = mfc;
      z.top = D[z.a]; z.base = D[z.b] + (w.step || 0); z.th = z.base - z.top; z.net = [0, 1, 2, 8].indexOf(z.f) >= 0 || P.mode === 'water' && z.f !== 4 ? net * (w.step || 0) : 0;
      z.gr = mean(GR, z); z.vsh = mean(R.VSH, z); z.phi = mean(R.PHI, z); z.sw = mean(R.SW, z); z.rt = RD ? Math.pow(10, mean(Float32Array.from(RD, function (v) { return v > 0 ? Math.log10(v) : NaN; }), z)) : NaN;
      z.rhob = mean(RHOB, z); z.nphi = mean(NPHI, z); z.dt = mean(DT, z); z.tds = mean(R.TDS, z);
      z.sxo = mean(R.SXO, z); z.mhi = isFinite(z.sxo) && z.sxo > 0 && isFinite(z.sw) ? z.sw / z.sxo : NaN;   /* moveable hydrocarbon index Sw/Sxo */
      z.flu = mf; z.frac = frac / nz; z.wash = wash / nz; z.inv = inv / nz; z.gas = mean(Float32Array.from(R.GAS), z);
      /* uncertainty of saturation: cementation exponent ±0.2, Rw ±20 %, porosity ±0.02, saturation exponent ±0.2 */
      if (P.mode !== 'water' && isFinite(z.sw) && isFinite(z.rt) && z.phi > 0.02) {
        var lo = 1, hi = 0; [[-0.2, 1.2, 0.02, -0.2], [0.2, 0.8, -0.02, 0.2], [0.2, 1.2, -0.02, 0.2], [-0.2, 0.8, 0.02, -0.2]].forEach(function (e) {
          var s4 = swOf(z.rt, Math.max(0.01, z.phi + e[2]), z.vsh || 0, a, m + e[0], nn + e[3], rw * e[1]); if (isFinite(s4)) { lo = Math.min(lo, s4); hi = Math.max(hi, s4); } });
        z.swLo = lo; z.swHi = hi;
      }
    });
    R.zones = zones;
    /* ---- totals */
    var cnt2 = 0, pay = 0, sp = 0, ss = 0, sv = 0, gross = 0, gasN = 0, nFrac = 0, nWash = 0;
    for (i = 0; i < n; i++) { if (!IN[i]) continue; cnt2++; if (R.PAY[i]) { pay++; sp += R.PHI[i]; if (isFinite(R.SW[i])) ss += R.SW[i]; if (R.GAS[i]) gasN++; } if ((R.VSH[i] || 0) <= cV && R.PHI[i] >= cP) gross++; if (R.FRAC[i]) nFrac++; if (R.WASH[i]) nWash++; sv += R.VSH[i] || 0; }
    var st = w.step || 0; R.tot = { len: cnt2 * st, net: pay * st, res: gross * st, phi: pay ? sp / pay : NaN, sw: pay ? ss / pay : NaN, gas: pay ? gasN / pay : 0, frac: nFrac * st, wash: cnt2 ? nWash / cnt2 : 0, vsh: cnt2 ? sv / cnt2 : NaN };
    /* ---- quality: how well the solved volumes rebuild the measured logs (in units of the assumed log error) */
    R.resMed = median(sel(R.RES));
    return R;
  };
})();
