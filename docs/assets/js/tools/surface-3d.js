/* 3-D Surface Plotter — Z = f(X, Y) from a table of samples: thin-plate spline, distance-weighted least squares,
   inverse distance weighting, quadratic or planar regression; classed colour surface with grid lines, projected map
   on the base, sample points, rotatable view; contour map; simple and multiple regressions with R², adjusted R²,
   leave-one-out cross-validation; interpretation; PNG, JPG and PDF figures composed with legend and equations. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, AR = SH.lang === 'ar', P = window.Plotly;
  var persist = SH.persist('surface3d3', ['geoName', 'sTitle', 'sData', 'sX', 'sY', 'sZ', 'sLab', 'sMeth', 'sSmooth', 'sGrid', 'sVex', 'sNc', 'sRamp', 'sBase', 'sMesh', 'sPts', 'sEq', 'sAz', 'sEl']);
  var RAMPS = { spec: ['#8B00FF', '#5A1EFF', '#1F3FBF', '#16A34A', '#7FE000', '#FFF200', '#FFB300', '#FF6A00', '#E00000'], viridis: ['#440154', '#3B528B', '#21918C', '#5EC962', '#FDE725'], terrain: ['#2B83BA', '#ABDDA4', '#FFFFBF', '#E6B86A', '#A6611A', '#F2F2F2'], blue: ['#2166AC', '#67A9CF', '#D1E5F0', '#FDDBC7', '#EF8A62', '#B2182B'] };
  var DEMO = ['Sample\tLL, %\tPI, %\tLS, %\tClay, %\tFines, %\tSand, %\tGravel, %\tGs\tFSR\tFSI, %\tSmectite, %\tSilica, %\tK-feldspar, %\tPlagioclase, %',
    'PTS-A\t48.91\t31.08\t13.51\t23.14\t52.19\t30.75\t16.03\t2.60\t1.42\t50.71\t49.64\t12.58\t27.05\t4.67', 'PTS-B\t51.08\t32.46\t12.93\t26.56\t54.51\t32.45\t12.16\t2.63\t1.49\t53.21\t51.55\t13.14\t25.12\t5.21', 'PTS-C\t54.78\t34.81\t12.06\t29.85\t58.45\t31.97\t9.45\t2.66\t1.60\t57.14\t55.61\t13.10\t24.96\t6.33',
    'BLS-A\t58.98\t36.82\t9.28\t30.40\t59.51\t29.39\t10.09\t2.64\t1.64\t64.31\t56.83\t12.47\t23.51\t3.29', 'BLS-B\t61.27\t38.25\t8.93\t32.20\t61.82\t29.49\t8.38\t2.68\t1.70\t66.66\t58.00\t14.00\t24.88\t3.12', 'BLS-C\t64.60\t40.33\t8.47\t35.07\t65.18\t30.48\t4.32\t2.71\t1.79\t70.19\t61.15\t11.93\t19.01\t2.63',
    'WBS-A\t63.78\t42.48\t7.69\t34.03\t67.52\t26.80\t4.85\t2.73\t1.73\t81.37\t58.22\t25.08\t10.42\t2.45', 'WBS-B\t66.22\t44.10\t7.41\t36.50\t70.10\t27.20\t2.45\t2.76\t1.80\t84.66\t59.41\t27.70\t9.99\t2.90', 'WBS-C\t70.64\t47.04\t6.97\t39.73\t74.78\t23.98\t1.21\t2.78\t1.92\t90.30\t63.37\t20.34\t10.71\t1.80',
    'WKS-A\t69.45\t49.87\t6.12\t40.00\t73.00\t23.50\t2.56\t2.73\t2.20\t116.60\t67.05\t19.98\t10.66\t2.31', 'WKS-B\t74.31\t53.36\t5.72\t48.31\t78.11\t18.71\t1.98\t2.78\t2.35\t124.60\t71.74\t13.40\t9.91\t1.85', 'WKS-C\t78.94\t56.68\t5.38\t55.25\t82.98\t15.92\t1.10\t2.83\t2.50\t132.60\t76.21\t11.69\t8.57\t1.25',
    'BTS-A\t40.29\t19.23\t16.67\t12.31\t41.24\t44.66\t13.85\t2.55\t1.17\t35.81\t31.67\t31.39\t21.22\t8.15', 'BTS-B\t43.59\t20.80\t15.41\t16.18\t44.61\t45.31\t9.96\t2.59\t1.26\t38.56\t34.26\t30.75\t20.32\t7.04', 'BTS-C\t48.37\t23.09\t13.89\t20.00\t49.50\t44.00\t6.48\t2.63\t1.40\t42.85\t38.02\t38.98\t17.23\t5.77'].join('\n');
  var D = { cols: [], num: [], rows: [] }, R = null, spin = 0;

  /* ---------- parsing */
  function parse(txt) {
    var lines = String(txt || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); }); if (lines.length < 2) return { cols: [], rows: [], num: [] };
    var h = lines[0], del = h.indexOf('\t') > -1 ? '\t' : h.indexOf(';') > -1 ? ';' : ',', dec = del !== ',';
    var split = function (l) { var out = [], cur = '', q = false; for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === '"') q = !q; else if (c === del && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(function (s) { return s.trim(); }); };
    var cols = split(h), rows = lines.slice(1).map(split), num = cols.map(function (c, j) { var ok = 0; rows.forEach(function (r) { if (isFinite(toN(r[j], dec)) && r[j] !== '') ok++; }); return ok >= rows.length * 0.8; });
    return { cols: cols, rows: rows.map(function (r) { return cols.map(function (c, j) { return num[j] ? toN(r[j], dec) : r[j] || ''; }); }), num: num };
  }
  function toN(s, dec) { s = String(s == null ? '' : s).trim(); if (/^trace$/i.test(s) || s === '') return NaN; if (dec) s = s.replace(/\s/g, '').replace(',', '.'); return +s; }
  function fill() { D = parse($('#sData').value); var o = D.cols.map(function (c, j) { return D.num[j] ? '<option value="' + j + '">' + SH.esc(c) + '</option>' : ''; }).join(''), ol = '<option value="-1">' + t('— none —', '— بلا —') + '</option>' + D.cols.map(function (c, j) { return '<option value="' + j + '">' + SH.esc(c) + '</option>'; }).join('');
    ['sX', 'sY', 'sZ'].forEach(function (id, k) { var e = $('#' + id), v = e.value; e.innerHTML = o; var nums = D.num.map(function (f, j) { return f ? j : -1; }).filter(function (j) { return j > -1; }); if (v !== '' && D.num[+v]) e.value = v; else if (nums[k] != null) e.value = nums[k]; });
    var l = $('#sLab'), lv = l.value; l.innerHTML = ol; l.value = lv !== '' && +lv < D.cols.length ? lv : String(D.num.indexOf(false)); if (l.value === '') l.value = '-1';
    $('#sInfo').textContent = D.rows.length ? D.rows.length + t(' samples · ', ' عينة · ') + D.num.filter(Boolean).length + t(' numeric columns', ' عموداً رقمياً') : '';
  }

  /* ---------- linear algebra and fitting (coordinates normalised to 0–1) */
  function solve(A, b) { var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); }); for (var c = 0; c < n; c++) { var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; var tmp = M[c]; M[c] = M[p]; M[p] = tmp; if (Math.abs(M[c][c]) < 1e-12) return null; for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c] / M[c][c]; for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map(function (r, i) { return r[n] / r[i]; }); }
  function lsq(X, z) { var m = X[0].length, A = [], b = []; for (var i = 0; i < m; i++) { A.push([]); b.push(0); for (var j = 0; j < m; j++) { var s = 0; for (var k = 0; k < X.length; k++) s += X[k][i] * X[k][j]; A[i].push(s); } for (k = 0; k < X.length; k++) b[i] += X[k][i] * z[k]; } return solve(A, b); }
  function fitter(pts, meth, sm) {
    var n = pts.length, U = function (r) { return r > 1e-12 ? r * r * Math.log(r) : 0; };
    if (meth === 'plane' || meth === 'quad') { var row = meth === 'plane' ? function (x, y) { return [1, x, y]; } : function (x, y) { return [1, x, y, x * x, x * y, y * y]; }; if (n < row(0, 0).length) return null; var c = lsq(pts.map(function (p) { return row(p[0], p[1]); }), pts.map(function (p) { return p[2]; })); if (!c) return null; return function (x, y) { return row(x, y).reduce(function (a, v, i) { return a + v * c[i]; }, 0); }; }
    if (meth === 'idw') { var pw = 4 - sm / 50, e2 = 1e-7; return function (x, y) { var sw = 0, sz = 0; for (var i = 0; i < n; i++) { var d2 = (x - pts[i][0]) * (x - pts[i][0]) + (y - pts[i][1]) * (y - pts[i][1]) + e2; if (d2 < 1e-14) return pts[i][2]; var w = Math.pow(d2, -pw / 2); sw += w; sz += w * pts[i][2]; } return sz / sw; }; }
    if (meth === 'dwls') { var h = 0.05 + sm / 100 * 0.45, h2 = h * h; return function (x, y) { var d2 = pts.map(function (p) { return (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); }), dm = Math.min.apply(null, d2), A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0], sw = 0;
      for (var i = 0; i < n; i++) { var dx = pts[i][0] - x, dy = pts[i][1] - y, w = Math.exp(-(d2[i] - dm) / h2), v = [1, dx, dy]; sw += w; for (var r = 0; r < 3; r++) { for (var q = 0; q < 3; q++) A[r][q] += w * v[r] * v[q]; b[r] += w * v[r] * pts[i][2]; } }
      A[1][1] += 1e-3 * sw; A[2][2] += 1e-3 * sw; var s2 = solve(A, b); return s2 ? s2[0] : NaN; }; }
    // thin-plate spline with smoothing parameter
    if (n < 3) return null; var lam = sm <= 0 ? 0 : Math.pow(10, sm / 25 - 4), N = n + 3, A2 = [], b2 = [];
    for (var i = 0; i < N; i++) { A2.push(new Array(N).fill(0)); b2.push(i < n ? pts[i][2] : 0); }
    for (i = 0; i < n; i++) { for (var j = 0; j < n; j++) A2[i][j] = U(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])) + (i === j ? lam * n : 0); A2[i][n] = A2[n][i] = 1; A2[i][n + 1] = A2[n + 1][i] = pts[i][0]; A2[i][n + 2] = A2[n + 2][i] = pts[i][1]; }
    var w = solve(A2, b2); if (!w) return null;
    return function (x, y) { var s = w[n] + w[n + 1] * x + w[n + 2] * y; for (var k = 0; k < n; k++) s += w[k] * U(Math.hypot(x - pts[k][0], y - pts[k][1])); return s; };
  }
  function reg1(x, z) { var n = x.length, mx = mean(x), mz = mean(z), sxx = 0, sxz = 0, szz = 0; for (var i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxz += (x[i] - mx) * (z[i] - mz); szz += (z[i] - mz) * (z[i] - mz); } var b = sxz / sxx, a = mz - b * mx; return { a: a, b: b, r: sxz / Math.sqrt(sxx * szz), r2: sxz * sxz / (sxx * szz) }; }
  function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
  function sig(v, k) { if (!isFinite(v)) return '—'; var a = Math.abs(v); var d = a === 0 ? 2 : Math.max(0, (k || 4) - 1 - Math.floor(Math.log10(a))); return v.toFixed(Math.min(6, d)); }
  function niceStep(r, n) { var raw = r / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function ramp(name, f) { var c = RAMPS[name] || RAMPS.spec, x = f * (c.length - 1), i = Math.min(c.length - 2, Math.floor(x)), u = x - i, h = function (s) { return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; }, a = h(c[i]), b = h(c[i + 1]); return 'rgb(' + a.map(function (v, k) { return Math.round(v + (b[k] - v) * u); }).join(',') + ')'; }
  var nm = function (j) { return D.cols[j] || ''; }, short = function (s) { return String(s).split(',')[0].trim(); };

  /* ---------- compute */
  function compute() {
    var jx = +$('#sX').value, jy = +$('#sY').value, jz = +$('#sZ').value, jl = +$('#sLab').value;
    var S = D.rows.map(function (r, i) { return { x: r[jx], y: r[jy], z: r[jz], l: jl > -1 ? String(r[jl]) : String(i + 1) }; }).filter(function (p) { return isFinite(p.x) && isFinite(p.y) && isFinite(p.z); });
    if (S.length < 4 || jx === jy || jx === jz || jy === jz) return null;
    var xs = S.map(function (p) { return p.x; }), ys = S.map(function (p) { return p.y; }), zs = S.map(function (p) { return p.z; });
    var nr = function (a, b) { var raw = (b - a) / 5, pp = Math.pow(10, Math.floor(Math.log10(raw))), mm = raw / pp, st = (mm <= 1 ? 1 : mm <= 2 ? 2 : mm <= 5 ? 5 : 10) * pp; return [Math.floor(a / st + 1e-9) * st, Math.ceil(b / st - 1e-9) * st, st]; }, xa = nr(Math.min.apply(null, xs), Math.max.apply(null, xs)), ya = nr(Math.min.apply(null, ys), Math.max.apply(null, ys)), x0 = xa[0], x1 = xa[1], y0 = ya[0], y1 = ya[1], dtx = xa[2], dty = ya[2]; if (x1 === x0 || y1 === y0) return null;
    var nx = function (x) { return (x - x0) / (x1 - x0); }, ny = function (y) { return (y - y0) / (y1 - y0); }, pts = S.map(function (p) { return [nx(p.x), ny(p.y), p.z]; });
    var meth = $('#sMeth').value, sm = SH.num('sSmooth'), f = fitter(pts, meth, sm); if (!f) return null;
    var G = +$('#sGrid').value, gx = [], gy = [], Z = [];
    for (var i = 0; i < G; i++) { gx.push(x0 + (x1 - x0) * i / (G - 1)); gy.push(y0 + (y1 - y0) * i / (G - 1)); }
    for (var r = 0; r < G; r++) { var row = []; for (var c = 0; c < G; c++) row.push(f(c / (G - 1), r / (G - 1))); Z.push(row); }
    var flat = [].concat.apply([], Z).filter(isFinite), zmin = Math.min.apply(null, flat.concat(zs)), zmax = Math.max.apply(null, flat.concat(zs)), za = (function () { var st = niceStep(zmax - zmin, 5), lo = Math.floor(zmin / st + 1e-9) * st; if (zmin >= 0 && lo - st * 2 <= 0 && zmin < (zmax - zmin) * 0.6) lo = 0; return [lo, Math.ceil(zmax / st - 1e-9) * st]; })();
    var nc = +$('#sNc').value, st = niceStep(zmax - zmin, nc), b0 = Math.floor(zmin / st) * st, bounds = [b0]; while (bounds[bounds.length - 1] < zmax - 1e-9) bounds.push(+(bounds[bounds.length - 1] + st).toFixed(10));
    var K = bounds.length - 1, cols = []; for (i = 0; i < K; i++) cols.push(ramp($('#sRamp').value, K === 1 ? 0.5 : i / (K - 1)));
    // statistics
    var rx = reg1(xs, zs), ry = reg1(ys, zs), rxy = reg1(xs, ys), mc = lsq(S.map(function (p) { return [1, p.x, p.y]; }), zs), pred = S.map(function (p) { return mc[0] + mc[1] * p.x + mc[2] * p.y; });
    var mz = mean(zs), sst = zs.reduce(function (a, v) { return a + (v - mz) * (v - mz); }, 0), sse = zs.reduce(function (a, v, k) { return a + (v - pred[k]) * (v - pred[k]); }, 0), n = S.length, r2m = 1 - sse / sst, adj = 1 - (1 - r2m) * (n - 1) / (n - 3);
    var cv = 0, ok = 0; for (i = 0; i < n; i++) { var g = fitter(pts.filter(function (q, k) { return k !== i; }), meth, sm); if (!g) continue; var e = g(pts[i][0], pts[i][1]) - pts[i][2]; if (isFinite(e)) { cv += e * e; ok++; } } cv = ok ? Math.sqrt(cv / ok) : NaN;
    var fit = pts.map(function (p) { return f(p[0], p[1]); }), rmsF = Math.sqrt(fit.reduce(function (a, v, k) { return a + (v - zs[k]) * (v - zs[k]); }, 0) / n);
    var im = 0, iM = 0; flat = [].concat.apply([], Z); flat.forEach(function (v, k) { if (v < flat[im]) im = k; if (v > flat[iM]) iM = k; });
    return { S: S, gx: gx, gy: gy, Z: Z, zmin: zmin, zmax: zmax, bounds: bounds, cols: cols, st: st, rx: rx, ry: ry, rxy: rxy, mc: mc, r2m: r2m, adj: adj, rmse: Math.sqrt(sse / n), cv: cv, rmsF: rmsF, n: n,
      za: za, dtx: dtx, dty: dty, lo: [gx[im % G], gy[Math.floor(im / G)], flat[im]], hi: [gx[iM % G], gy[Math.floor(iM / G)], flat[iM]], jx: jx, jy: jy, jz: jz, meth: meth, zr: [Math.min.apply(null, zs), Math.max.apply(null, zs)] };
  }
  function cf(v) { var d = Math.max(0, -Math.floor(Math.log10(R.st) + 1e-9)); if (Math.abs(R.st * Math.pow(10, d) - Math.round(R.st * Math.pow(10, d))) > 1e-9) d++; return v.toFixed(d); }
  function cscale(R) { var a = R.bounds[0], b = R.bounds[R.bounds.length - 1], s = []; R.cols.forEach(function (c, i) { s.push([(R.bounds[i] - a) / (b - a), c]); s.push([(R.bounds[i + 1] - a) / (b - a), c]); }); s[s.length - 1][0] = 1; return s; }
  function eye(k) { var az = SH.num('sAz') * Math.PI / 180, el = SH.num('sEl') * Math.PI / 180, r = k || 1.75; return { x: r * Math.cos(el) * Math.cos(az), y: r * Math.cos(el) * Math.sin(az), z: r * Math.sin(el) + 0.1 }; }
  function eqs(R) { var X = short(nm(R.jx)), Y = short(nm(R.jy)), Zn = nm(R.jz), sgn = function (v) { return (v < 0 ? ' − ' : ' + ') + sig(Math.abs(v)); };
    return [Zn + ' = ' + sig(R.rx.a) + sgn(R.rx.b) + '·' + X + '   R² = ' + SH.fmt(R.rx.r2 * 100, 2) + '%', Zn + ' = ' + sig(R.ry.a) + sgn(R.ry.b) + '·' + Y + '   R² = ' + SH.fmt(R.ry.r2 * 100, 2) + '%', Zn + ' = ' + sig(R.mc[0]) + sgn(R.mc[1]) + '·' + X + sgn(R.mc[2]) + '·' + Y + '   R² = ' + SH.fmt(R.r2m * 100, 2) + '%']; }
  function figs(R, exp) {
    var cs = cscale(R), zr = R.bounds[R.bounds.length - 1] - R.bounds[0], zb = R.bounds[0] - zr * 0.0, mesh = $('#sMesh').checked, sx = (R.gx[1] - R.gx[0]), sy = (R.gy[1] - R.gy[0]);
    var tr = [{ type: 'surface', x: R.gx, y: R.gy, z: R.Z, colorscale: cs, cmin: R.bounds[0], cmax: R.bounds[R.bounds.length - 1], showscale: !exp, colorbar: { title: { text: nm(R.jz) }, tickvals: R.bounds, len: .75, thickness: 16 },
      contours: mesh ? { x: { show: true, start: R.gx[0], end: R.gx[R.gx.length - 1], size: sx, color: '#000000', width: 3 }, y: { show: true, start: R.gy[0], end: R.gy[R.gy.length - 1], size: sy, color: '#000000', width: 3 } } : {},
      lighting: { ambient: .85, diffuse: .45, specular: .05, roughness: .9 }, hovertemplate: short(nm(R.jx)) + ' %{x:.3g}<br>' + short(nm(R.jy)) + ' %{y:.3g}<br>' + short(nm(R.jz)) + ' %{z:.3g}<extra></extra>' }];
    var zlo = R.za[0], zhi = Math.max(R.za[1], R.bounds[R.bounds.length - 1]), base = zlo + (zhi - zlo) * 0.004;
    if ($('#sBase').checked) tr.push({ type: 'surface', x: R.gx, y: R.gy, z: R.Z.map(function (r) { return r.map(function () { return base; }); }), surfacecolor: R.Z, colorscale: cs, cmin: R.bounds[0], cmax: R.bounds[R.bounds.length - 1], showscale: false, hoverinfo: 'skip', lighting: { ambient: 1, diffuse: 0, specular: 0 } });
    if ($('#sPts').checked) tr.push({ type: 'scatter3d', mode: 'markers', x: R.S.map(function (p) { return p.x; }), y: R.S.map(function (p) { return p.y; }), z: R.S.map(function (p) { return p.z; }), text: R.S.map(function (p) { return p.l; }), marker: { size: 4, color: '#111', line: { color: '#fff', width: 1 } }, hovertemplate: '%{text}<br>%{z:.3g}<extra></extra>', showlegend: false });
    var ax = function (title, rng, dt) { return { title: { text: title, font: { size: exp ? 22 : 13, color: '#1B232B' } }, backgroundcolor: '#F2F2F2', showbackground: true, gridcolor: '#C9C9C9', zerolinecolor: '#999', tickfont: { size: exp ? 19 : 11, color: '#333' }, dtick: dt, tick0: rng ? rng[0] : undefined, range: rng }; };
    var lay = { margin: { l: 0, r: 0, t: 10, b: 0 }, paper_bgcolor: exp ? '#fff' : 'rgba(0,0,0,0)', scene: { xaxis: ax(nm(R.jx), [R.gx[0], R.gx[R.gx.length - 1]], R.dtx), yaxis: ax(nm(R.jy), [R.gy[0], R.gy[R.gy.length - 1]], R.dty), zaxis: ax(nm(R.jz), [zlo, zhi], niceStep(zhi - zlo, 5)), aspectmode: 'manual', aspectratio: { x: exp ? 1.3 : 1.15, y: exp ? 1.3 : 1.15, z: (exp ? 1.3 : 1.15) * SH.num('sVex') / 100 }, camera: { eye: eye(exp ? 1.02 : 1.15), center: { x: 0, y: 0, z: -0.04 }, projection: { type: 'orthographic' } } }, font: { family: 'Manrope, Arial, sans-serif' } };
    return { data: tr, layout: lay };
  }
  /* plan view: classed raster, contour lines with labels, samples, axes and legend (SVG) */
  function draw2d(R) {
    var S = SH.svgB('s2d'), W = 1000, ML = 96, MT = 30, PW = 640, PH = 560, X0 = ML, Y0 = MT, INK = '#1B232B', MUT = '#55616B', G = R.gx.length;
    var tx = function (x, y, s, a) { return S.text(x, y, s, Object.assign({ fill: INK, 'font-size': 13, direction: 'ltr' }, a || {})); };
    var xr = [R.gx[0], R.gx[G - 1]], yr = [R.gy[0], R.gy[G - 1]], px = function (x) { return X0 + (x - xr[0]) / (xr[1] - xr[0]) * PW; }, py = function (y) { return Y0 + PH - (y - yr[0]) / (yr[1] - yr[0]) * PH; };
    var VH = MT + PH + 80; S.el.setAttribute('viewBox', '0 0 ' + W + ' ' + VH); S.add('rect', { x: 0, y: 0, width: W, height: VH, fill: '#fff' });
    // raster of classes (bilinear on the grid, 3 px cells)
    var N = 230, cv = document.createElement('canvas'); cv.width = N; cv.height = N; var cx = cv.getContext('2d'), img = cx.createImageData(N, N), cl = R.cols.map(function (c) { return c.match(/\d+/g).map(Number); });
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) { var gx = i / (N - 1) * (G - 1), gy = (1 - j / (N - 1)) * (G - 1), i0 = Math.min(G - 2, Math.floor(gx)), j0 = Math.min(G - 2, Math.floor(gy)), u = gx - i0, v = gy - j0, z = R.Z[j0][i0] * (1 - u) * (1 - v) + R.Z[j0][i0 + 1] * u * (1 - v) + R.Z[j0 + 1][i0] * (1 - u) * v + R.Z[j0 + 1][i0 + 1] * u * v;
      var k = Math.max(0, Math.min(cl.length - 1, Math.floor((z - R.bounds[0]) / R.st))), o = (j * N + i) * 4; if (!isFinite(z)) continue; img.data[o] = cl[k][0]; img.data[o + 1] = cl[k][1]; img.data[o + 2] = cl[k][2]; img.data[o + 3] = 255; }
    cx.putImageData(img, 0, 0); S.add('image', { x: X0, y: Y0, width: PW, height: PH, href: cv.toDataURL('image/png'), preserveAspectRatio: 'none' });
    // contour lines at the class limits
    var Gd = { nx: G, ny: G, z: new Float32Array(G * G), b: { n: yr[1], s: yr[0], w: xr[0], e: xr[1] } }; for (j = 0; j < G; j++) for (i = 0; i < G; i++) Gd.z[j * G + i] = R.Z[G - 1 - j][i];
    var lv = R.bounds.slice(1, -1), cs = SH.dem.contours(Gd, lv), labs = [];
    cs.forEach(function (c) { var best = null; c.lines.forEach(function (ln) { if (ln.length < 2) return; S.path('M' + ln.map(function (p) { return px(p[1]).toFixed(1) + ' ' + py(p[0]).toFixed(1); }).join('L'), { fill: 'none', stroke: 'rgba(20,20,20,.75)', 'stroke-width': .9 }); if (!best || ln.length > best.length) best = ln; });
      if (best && best.length > 6) { var m = best[Math.floor(best.length / 2)]; labs.push([px(m[1]), py(m[0]), sig(c.level, 3)]); } });
    labs.filter(function (l) { return !R.S.some(function (p) { var dx = px(p.x) - l[0], dy = py(p.y) - l[1]; return dx > -30 && dx < 80 && Math.abs(dy) < 26; }); }).forEach(function (l) { tx(l[0], l[1] + 4, l[2], { 'font-size': 11, 'font-weight': 700, 'text-anchor': 'middle', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }); });
    // samples
    R.S.forEach(function (p) { var x = px(p.x), y = py(p.y); S.circle(x, y, 4.5, { fill: INK, stroke: '#fff', 'stroke-width': 1.5 }); tx(x + 7, y - 6, p.l, { 'font-size': 11, 'font-weight': 700, stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' }); });
    // frame and axes
    S.add('rect', { x: X0, y: Y0, width: PW, height: PH, fill: 'none', stroke: INK, 'stroke-width': 1.4 });
    var nice = function (a, b) { var st = niceStep(b - a, 6), v = Math.ceil(a / st) * st, out = []; for (; v <= b + 1e-9; v += st) out.push(+v.toFixed(10)); return out; };
    nice(xr[0], xr[1]).forEach(function (v) { var x = px(v); S.line(x, Y0 + PH, x, Y0 + PH + 6, { stroke: INK }); tx(x, Y0 + PH + 22, sig(v, 3), { 'text-anchor': 'middle', fill: MUT, 'font-size': 12 }); });
    nice(yr[0], yr[1]).forEach(function (v) { var y = py(v); S.line(X0 - 6, y, X0, y, { stroke: INK }); tx(X0 - 10, y + 4, sig(v, 3), { 'text-anchor': 'end', fill: MUT, 'font-size': 12 }); });
    tx(X0 + PW / 2, Y0 + PH + 52, nm(R.jx), { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14 }); var cy = Y0 + PH / 2; tx(30, cy, nm(R.jy), { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14, transform: 'rotate(-90 30 ' + cy + ')' });
    // legend
    var LX = X0 + PW + 40; tx(LX, Y0 + 14, nm(R.jz), { 'font-weight': 800, 'font-size': 15 });
    for (var q = R.cols.length - 1, r = 0; q >= 0; q--, r++) { var yy = Y0 + 34 + r * 30; S.add('rect', { x: LX, y: yy, width: 34, height: 22, fill: R.cols[q], stroke: INK, 'stroke-width': .8 }); tx(LX + 44, yy + 16, cf(R.bounds[q]) + '–' + cf(R.bounds[q + 1]), { 'font-size': 13, 'font-weight': 600 }); }
    var ly = Y0 + 34 + R.cols.length * 30 + 20; S.circle(LX + 17, ly, 4.5, { fill: INK, stroke: '#fff', 'stroke-width': 1.5 }); tx(LX + 44, ly + 4, 'Sample', { 'font-size': 13 }); S.line(LX, ly + 26, LX + 34, ly + 26, { stroke: INK, 'stroke-width': 1 }); tx(LX + 44, ly + 30, 'Class limit (contour)', { 'font-size': 13 });
    S.add('rect', { x: 6, y: 6, width: W - 12, height: VH - 12, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
  }
  /* ---------- render */
  function run() {
    fill(); R = compute(); persist.save();
    if (!R) { $('#sKpis').innerHTML = '<div class="kpi warn"><span class="k">' + t('Data', 'البيانات') + '</span><span class="v" style="font-size:.95rem">' + t('Enter at least four samples and choose three different numeric columns for X, Y and Z.', 'أدخل أربع عينات على الأقل واختر ثلاثة أعمدة رقمية مختلفة للمحاور X وY وZ.') + '</span></div>'; return; }
    var F = figs(R, false); SH.plot('s3d', F.data, function () { return SH.merge(SH.plotLayout({}), F.layout); }, { filename: 'shandal-3d-surface' });
    draw2d(R);
    var g = $('#s3d'); if (g.removeAllListeners) g.removeAllListeners('plotly_relayout'); if (g.on) g.on('plotly_relayout', function (e) { var c = e && (e['scene.camera'] || null); if (!c || !c.eye) return; var ex = c.eye, r = Math.hypot(ex.x, ex.y, ex.z); $('#sAz').value = Math.round((Math.atan2(ex.y, ex.x) * 180 / Math.PI + 360) % 360); $('#sEl').value = Math.round(Math.asin(Math.max(-1, Math.min(1, (ex.z - .1) / r))) * 180 / Math.PI); });
    var q = function (v) { return R.r2m >= .9 ? 'ok' : R.r2m >= .7 ? 'info' : 'warn'; };
    $('#sKpis').innerHTML = '<div class="kpi info"><span class="k">' + t('Samples', 'العينات') + '</span><span class="v">' + R.n + '</span><span class="s">' + SH.esc(short(nm(R.jz))) + ' ' + SH.fmt(R.zr[0], 2) + '–' + SH.fmt(R.zr[1], 2) + '</span></div>' +
      '<div class="kpi"><span class="k">R² ' + SH.esc(short(nm(R.jz))) + ' ~ ' + SH.esc(short(nm(R.jx))) + '</span><span class="v">' + SH.fmt(R.rx.r2 * 100, 2) + '<small>%</small></span><span class="s">r = ' + SH.fmt(R.rx.r, 3) + '</span></div>' +
      '<div class="kpi"><span class="k">R² ' + SH.esc(short(nm(R.jz))) + ' ~ ' + SH.esc(short(nm(R.jy))) + '</span><span class="v">' + SH.fmt(R.ry.r2 * 100, 2) + '<small>%</small></span><span class="s">r = ' + SH.fmt(R.ry.r, 3) + '</span></div>' +
      '<div class="kpi ' + q() + '"><span class="k">' + t('Multiple R² (X + Y)', 'معامل التحديد المتعدد (X + Y)') + '</span><span class="v">' + SH.fmt(R.r2m * 100, 2) + '<small>%</small></span><span class="s">' + t('adjusted ', 'المعدّل ') + SH.fmt(R.adj * 100, 2) + '%</span></div>' +
      '<div class="kpi"><span class="k">' + t('Cross-validation error', 'خطأ التحقق المتقاطع') + '</span><span class="v">' + sig(R.cv, 3) + '</span><span class="s">' + t('leave-one-out RMSE', 'RMSE بترك عينة واحدة') + '</span></div>';
    var E = eqs(R), row = function (a, b, c, d) { return '<tr><td>' + a + '</td><td class="ltr" style="white-space:normal">' + b + '</td><td class="num">' + c + '</td><td class="num">' + d + '</td></tr>'; };
    $('#sReg').innerHTML = '<thead><tr><th>' + t('Model', 'النموذج') + '</th><th>' + t('Equation', 'المعادلة') + '</th><th class="num">R²</th><th class="num">r</th></tr></thead><tbody>' +
      row(t('Simple, on X', 'بسيط على X'), SH.esc(E[0].split('   ')[0]), SH.fmt(R.rx.r2 * 100, 2) + '%', SH.fmt(R.rx.r, 3)) + row(t('Simple, on Y', 'بسيط على Y'), SH.esc(E[1].split('   ')[0]), SH.fmt(R.ry.r2 * 100, 2) + '%', SH.fmt(R.ry.r, 3)) +
      row(t('Multiple, on X and Y', 'متعدد على X وY'), SH.esc(E[2].split('   ')[0]), SH.fmt(R.r2m * 100, 2) + '% (' + t('adj. ', 'معدّل ') + SH.fmt(R.adj * 100, 2) + '%)', '—') + row(t('X with Y (collinearity)', 'X مع Y (التداخل الخطي)'), SH.esc(short(nm(R.jy)) + ' = ' + sig(R.rxy.a) + (R.rxy.b < 0 ? ' − ' : ' + ') + sig(Math.abs(R.rxy.b)) + '·' + short(nm(R.jx))), SH.fmt(R.rxy.r2 * 100, 2) + '%', SH.fmt(R.rxy.r, 3)) + '</tbody>';
    narr(); table(); caps();
  }
  var MN = { tps: ['thin-plate spline', 'شريحة الصفيحة الرقيقة'], dwls: ['distance-weighted least squares', 'المربعات الصغرى الموزونة بالمسافة'], idw: ['inverse distance weighting (Shepard)', 'وزن مقلوب المسافة (طريقة شيبارد)'], quad: ['quadratic polynomial regression', 'انحدار متعدد الحدود من الدرجة الثانية'], plane: ['linear plane regression', 'الانحدار المستوي الخطي'] };
  function strength(r2) { return r2 >= .9 ? t('very strong', 'قوية جداً') : r2 >= .7 ? t('strong', 'قوية') : r2 >= .5 ? t('moderate', 'متوسطة') : r2 >= .3 ? t('weak', 'ضعيفة') : t('very weak', 'ضعيفة جداً'); }
  function narr() {
    var X = SH.esc(nm(R.jx)), Y = SH.esc(nm(R.jy)), Zn = SH.esc(nm(R.jz)), p = function (s) { return '<p>' + s + '</p>'; }, b = function (s) { return '<b>' + s + '</b>'; }, dir = function (v) { return v > 0 ? t('increases', 'يزداد') : t('decreases', 'يتناقص'); }, h = '';
    h += p(Zn + ' ' + dir(R.rx.b) + t(' with ', ' مع زيادة ') + X + t(' (', ' (') + b('R² = ' + SH.fmt(R.rx.r2 * 100, 2) + '%') + t(', a ', '، علاقة ') + strength(R.rx.r2) + t(' correlation) and ', ') و') + dir(R.ry.b) + t(' with ', ' مع زيادة ') + Y + ' (' + b('R² = ' + SH.fmt(R.ry.r2 * 100, 2) + '%') + t(', ', '، ') + strength(R.ry.r2) + ').');
    h += p(t('Together, ', 'ويفسّر المتغيران معاً ') + X + t(' and ', ' و') + Y + t(' explain ', ' ') + b(SH.fmt(R.r2m * 100, 1) + '%') + t(' of the variation of ', ' من تباين ') + Zn + t(' (adjusted R² ', ' (معامل التحديد المعدّل ') + SH.fmt(R.adj * 100, 1) + '%' + t(', residual standard error ', '، والخطأ المعياري للبواقي ') + sig(R.rmse, 3) + ').' +
      (Math.abs(R.rxy.r) >= .8 ? ' ' + t('The two predictors are themselves highly correlated (r = ', 'لكن المتغيرين المستقلين مترابطان بقوة (r = ') + SH.fmt(R.rxy.r, 2) + t('), so their individual coefficients in the multiple equation are not reliable; the surface mainly follows a single trend.', ')، لذا لا يُعتمد على معامل كل منهما منفرداً في المعادلة المتعددة، والسطح يتبع اتجاهاً واحداً في الغالب.') : ''));
    h += p(t('The surface was fitted by ', 'رُسم السطح بطريقة ') + MN[R.meth][AR ? 1 : 0] + t('. It departs from the samples by ', '، ويبتعد عن العينات بمقدار ') + sig(R.rmsF, 3) + t(' (RMS), and predicts a withheld sample with an error of ', ' (جذر متوسط المربعات)، ويتنبأ بالعينة المحجوبة بخطأ ') + b(sig(R.cv, 3)) + t(' (leave-one-out cross-validation). ', ' (التحقق المتقاطع بترك عينة واحدة). ') +
      t('The highest values (', 'تقع أعلى القيم (') + sig(R.hi[2], 3) + t(') lie near ', ') قرب ') + short(nm(R.jx)) + ' ≈ ' + sig(R.hi[0], 3) + t(', ', ' و') + short(nm(R.jy)) + ' ≈ ' + sig(R.hi[1], 3) + t(', and the lowest (', '، وأدناها (') + sig(R.lo[2], 3) + t(') near ', ') قرب ') + short(nm(R.jx)) + ' ≈ ' + sig(R.lo[0], 3) + t(', ', ' و') + short(nm(R.jy)) + ' ≈ ' + sig(R.lo[1], 3) + '.');
    h += p(t('With ', 'مع ') + R.n + t(' samples, the surface is reliable only inside the area covered by the samples (see the contour map); corners without samples are extrapolated and local bumps between distant samples are not supported by data.', ' عينة، يُعتمد على السطح داخل المنطقة التي تغطيها العينات فقط (انظر الخريطة الكنتورية)؛ أما الأركان الخالية من العينات فمستقرأة، والتموجات المحلية بين العينات المتباعدة لا تسندها البيانات.'));
    $('#sNarr').innerHTML = h;
  }
  function caps() {
    $('#s3dCap').textContent = t('Colours show classes of ', 'تمثل الألوان فئات ') + nm(R.jz) + t(' every ', ' كل ') + SH.fmt(R.st, 2) + t('; the base shows the same classes projected as a map, and black dots are the measured samples. Drag the figure to rotate it.', '؛ وتُظهر القاعدة الفئات نفسها مسقطة كخريطة، والنقاط السوداء هي العينات المقيسة. اسحب الشكل لتدويره.');
    $('#s2dCap').textContent = t('Plan view of the same surface: contour interval ', 'مسقط أفقي للسطح نفسه: الفاصل الكنتوري ') + SH.fmt(R.st, 2) + t('. Values far from the labelled samples are interpolated or extrapolated.', '. القيم البعيدة عن العينات المسماة مستكمَلة أو مستقرأة.');
  }
  function table() { var cs = [R.jx, R.jy, R.jz]; $('#sTbl').innerHTML = '<thead><tr><th>' + t('Sample', 'العينة') + '</th>' + cs.map(function (j) { return '<th class="num">' + SH.esc(nm(j)) + '</th>'; }).join('') + '<th class="num">' + t('Fitted Z', 'Z المحسوبة') + '</th></tr></thead><tbody>' +
    R.S.map(function (p) { var x = (p.x - R.gx[0]) / (R.gx[R.gx.length - 1] - R.gx[0]), y = (p.y - R.gy[0]) / (R.gy[R.gy.length - 1] - R.gy[0]); return '<tr><td><b>' + SH.esc(p.l) + '</b></td><td class="num">' + sig(p.x) + '</td><td class="num">' + sig(p.y) + '</td><td class="num">' + sig(p.z) + '</td><td class="num">' + sig(R.mc[0] + R.mc[1] * p.x + R.mc[2] * p.y) + '</td></tr>'; }).join('') + '</tbody>'; }

  /* ---------- composed figure for download: title, class legend, plot, equations */
  function composed(which) {
    var W = 1500, Fg = figs(R, true), pw = 1200, ph = 980;
    return P.toImage({ data: Fg.data, layout: Fg.layout }, { format: 'png', width: pw, height: ph, scale: 1.6 }).then(function (u) { return SH.loadImage(u); }).then(function (im) {
      var eq = $('#sEq').checked ? eqs(R) : [], title = SH.val('sTitle').trim(), top = title ? 90 : 30, Hh = top + ph + 40 + eq.length * 34 + 30, cv = document.createElement('canvas'), k = 1.6; cv.width = W * k; cv.height = Hh * k; var x = cv.getContext('2d'); x.scale(k, k);
      var Fn = 'Manrope, Arial, sans-serif'; x.fillStyle = '#fff'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#1B232B'; x.textBaseline = 'alphabetic';
      if (title) { x.font = '800 30px ' + Fn; x.textAlign = 'center'; x.fillText(title, W / 2, 56); }
      x.textAlign = 'left'; x.font = '800 22px ' + Fn; x.fillText(nm(R.jz), 30, top + 34);
      for (var i = R.cols.length - 1, row = 0; i >= 0; i--, row++) { var y = top + 52 + row * 36; x.fillStyle = R.cols[i]; x.fillRect(30, y, 40, 26); x.strokeStyle = '#1B232B'; x.lineWidth = 1; x.strokeRect(30, y, 40, 26); x.fillStyle = '#1B232B'; x.font = '700 19px ' + Fn; x.fillText(cf(R.bounds[i]) + '–' + cf(R.bounds[i + 1]), 82, y + 20); }
      x.drawImage(im, W - pw - 20, top, pw, ph);
      x.font = '700 22px ' + Fn; eq.forEach(function (s, j) { x.fillText(s, 40, top + ph + 44 + j * 34); });
      x.strokeStyle = '#1B232B'; x.lineWidth = 1.5; x.strokeRect(8, 8, W - 16, Hh - 16);
      return cv;
    });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-ex]'); if (!b || !R || !P) return; b.disabled = true;
    (b.getAttribute('data-ex') === 's3d' ? composed('s3d').then(function (cv) { return SH.exportCanvas(cv, 'shandal-3d-surface', b.getAttribute('data-f')); }) : SH.exportFigure($('#s2d'), 'shandal-contour-map', b.getAttribute('data-f'))).catch(function () { SH.toast(t('The image could not be created.', 'تعذر إنشاء الصورة.'), 'warn'); }).then(function () { b.disabled = false; }); });

  /* ---------- view controls */
  function setCam() { if (R && P && $('#s3d').data) P.relayout($('#s3d'), { 'scene.camera.eye': eye() }); }
  $('#sAz').addEventListener('input', setCam); $('#sEl').addEventListener('input', setCam);
  $('#sReset').addEventListener('click', function () { $('#sAz').value = 315; $('#sEl').value = 24; setCam(); persist.save(); });
  $('#sSpin').addEventListener('click', function () { if (spin) { cancelAnimationFrame(spin); spin = 0; return; } var a0 = SH.num('sAz'), d = 0; (function step() { d += 2; $('#sAz').value = (a0 + d) % 360; setCam(); if (d < 360) spin = requestAnimationFrame(step); else { spin = 0; persist.save(); } })(); });
  ['sX', 'sY', 'sZ', 'sLab', 'sMeth', 'sGrid', 'sNc', 'sRamp', 'sBase', 'sMesh', 'sPts', 'sEq'].forEach(function (id) { $('#' + id).addEventListener('change', run); });
  ['sSmooth', 'sVex'].forEach(function (id) { $('#' + id).addEventListener('change', run); });
  var tm = 0; $('#sData').addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(run, 500); });
  $('#sFile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { $('#sData').value = r.result; run(); }; r.readAsText(f); });
  $('#sDemo').addEventListener('click', function () { $('#sData').value = DEMO; fill(); $('#sX').value = 1; $('#sY').value = 3; $('#sZ').value = 14; $('#sLab').value = 0; $('#sMeth').value = 'idw'; $('#sSmooth').value = 50; $('#sGrid').value = 30; $('#sAz').value = 315; $('#sEl').value = 22; $('#sVex').value = 85; $('#sTitle').value = 'Plagioclase vs liquid limit and linear shrinkage'; run(); SH.toast(t('Example: 15 heaving soils from Free State, South Africa (Fondjo & Theron 2020).', 'مثال: 15 تربة منتفخة من ولاية فري ستيت، جنوب أفريقيا (Fondjo & Theron 2020).'), 'ok'); });
  $('#sCsv').addEventListener('click', function () { if (!R) return; SH.csv('shandal-surface-samples.csv', [['sample', nm(R.jx), nm(R.jy), nm(R.jz)]].concat(R.S.map(function (p) { return [p.l, p.x, p.y, p.z]; }))); });
  document.addEventListener('sh:beforereport', function (e) { if (!R) { e.preventDefault(); SH.toast(t('Enter the data first.', 'أدخل البيانات أولاً.'), 'warn'); } });
  if (!$('#sData').value.trim()) { $('#sDemo').click(); } else run();
})();
