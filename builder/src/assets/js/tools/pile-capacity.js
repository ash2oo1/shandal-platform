/* Axial capacity of a single pile in layered soil. Clay: α-method (API RP 2A for driven piles; O'Neill & Reese 1999 for bored
   piles, top 1.5 m excluded) and end bearing 9cu (6(1 + 0.2 L/D) ≤ 9 for bored). Sand: API RP 2A (2000) β-method with limiting
   skin friction and end bearing for driven closed-ended piles; O'Neill & Reese (1999) β = 1.5 − 0.245√z (reduced for N60 < 15)
   and qb = 57.5 N60 ≤ 2.9 MPa for bored piles. Capacity against length and the length for a working load. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, GW = 9.81, PA = 101.325;
  var IDS = ['pcT', 'pcD', 'pcL', 'pcW', 'pcFS', 'pcP'], persist = SH.persist('pilecap', IDS), last = null;
  var COLS = [{ k: 'ty', h: t('Soil', 'التربة'), w: '62px', type: 'select', opts: [['clay', t('Clay', 'طين')], ['sand', t('Sand', 'رمل')]] }, { k: 'h', h: 'h' }, { k: 'g', h: 'γ' }, { k: 'cu', h: 'cu' }, { k: 'phi', h: 'φ′' }, { k: 'n', h: 'N60' }];
  var DEF = [{ ty: 'clay', h: 3, g: 18, cu: 40 }, { ty: 'clay', h: 7, g: 17.5, cu: 25 }, { ty: 'sand', h: 5, g: 19, phi: 32, n: 22 }, { ty: 'clay', h: 4, g: 19, cu: 120 }, { ty: 'sand', h: 10, g: 20, phi: 36, n: 45 }];
  var T = G.rows($('#pcRows'), 'shandal_pile_rows', COLS, DEF, function () { later(); });
  $('#pcAdd').addEventListener('click', function () { T.add({ ty: 'sand', h: 5, g: 19.5, phi: 34, n: 30 }); });
  var API = [[15, 47.8, 8, 1900], [20, 67.0, 12, 2900], [25, 81.3, 20, 4800], [30, 95.7, 40, 9600], [35, 114.8, 50, 12000]];
  var apiCat = function (phi) { var d = phi - 5; return API[d < 17.5 ? 0 : d < 22.5 ? 1 : d < 27.5 ? 2 : d < 32.5 ? 3 : 4]; };
  var nFromPhi = function (phi) { for (var n = 1; n <= 60; n++) if (27.1 + 0.3 * n - 0.00054 * n * n >= phi) return n; return 60; };

  function profile(p, Ls) { /* unit shaft friction and end bearing at every 0.25 m */
    var dz = 0.25, out = [], sv = 0, Ztot = Ls.reduce(function (a, l) { return a + l.h; }, 0);
    for (var z = dz / 2; z < Ztot; z += dz) {
      var li = 0, top = 0; while (li < Ls.length - 1 && z > top + Ls[li].h) { top += Ls[li].h; li++; } var l = Ls[li];
      sv += l.g * dz; var se = sv - GW * Math.max(0, z - p.w), fs = 0, qb = 0, note = '';
      if (l.ty === 'clay') { var cu = Math.max(0, l.cu || 0);
        if (p.ty === 'driven') { var psi = cu / Math.max(se, 1), a = Math.min(1, psi <= 1 ? 0.5 * Math.pow(psi, -0.5) : 0.5 * Math.pow(psi, -0.25)); fs = a * cu; note = 'α = ' + F(a, 2); qb = 9 * cu; }
        else { var r = cu / PA, ab = r <= 1.5 ? 0.55 : r <= 2.5 ? 0.55 - 0.1 * (r - 1.5) : 0.45; fs = z < 1.5 ? 0 : ab * cu; note = 'α = ' + F(ab, 2); qb = Math.min(9, 6 * (1 + 0.2 * z / p.D)) * cu; } }
      else { var phi = l.phi > 0 ? l.phi : 30, N = l.n > 0 ? l.n : nFromPhi(phi);
        if (p.ty === 'driven') { var c = apiCat(phi); fs = Math.min(c[1], 1.0 * se * Math.tan(SH.rad(c[0]))); qb = Math.min(c[3], c[2] * se); note = 'δ = ' + c[0] + '°, Nq = ' + c[2]; }
        else { var b = Math.min(1.2, Math.max(0.25, 1.5 - 0.245 * Math.sqrt(z))); if (N < 15) b *= N / 15; fs = Math.min(200, b * se); qb = Math.min(2900, 57.5 * Math.min(N, 50)); note = 'β = ' + F(b, 2) + ', N60 = ' + F(N, 0); } }
      out.push({ z: z, dz: dz, li: li, se: se, fs: fs, qb: qb, note: note });
    }
    return out;
  }
  function cap(p, P, L) {
    var A = Math.PI * p.D * p.D / 4, per = Math.PI * p.D, Qs = 0, byL = {};
    P.forEach(function (s) { if (s.z > L) return; var part = Math.min(s.dz, L - (s.z - s.dz / 2)); if (part <= 0) return; var q = s.fs * per * part; Qs += q; byL[s.li] = (byL[s.li] || 0) + q; });
    var tip = P.filter(function (s) { return s.z <= L; }).pop() || P[0], Qb = tip.qb * A;
    return { Qs: Qs, Qb: Qb, Qu: Qs + Qb, byL: byL, tip: tip };
  }
  function run() {
    var p = { ty: $('#pcT').value, D: G.v('pcD'), L: G.v('pcL'), w: Math.max(0, G.v('pcW') || 0), FS: G.v('pcFS') || 2.5, P: G.v('pcP') || 0 };
    if (!(p.D > 0 && p.L > 0)) return; persist.save();
    var Ls = T.get().filter(function (l) { return l.h > 0 && l.g > 0; }); if (!Ls.length) return;
    var Ztot = Ls.reduce(function (a, l) { return a + l.h; }, 0), P = profile(p, Ls), short = p.L > Ztot - 0.01, L = Math.min(p.L, Ztot - 0.01), C = cap(p, P, L);
    var curve = []; for (var l2 = 2; l2 <= Ztot - 0.01; l2 += 0.5) { var c2 = cap(p, P, l2); curve.push({ L: l2, Qs: c2.Qs, Qb: c2.Qb, Qu: c2.Qu, Qa: c2.Qu / p.FS }); }
    var need = null; if (p.P > 0) for (var i = 0; i < curve.length; i++) if (curve[i].Qa >= p.P) { need = curve[i].L; break; }
    last = { p: p, Ls: Ls, P: P, C: C, L: L, short: short, curve: curve, need: need, Ztot: Ztot }; render();
  }
  function render() {
    var R = last, p = R.p, C = R.C, Qa = C.Qu / p.FS, okP = !p.P || Qa >= p.P;
    $('#pcKpis').innerHTML = G.kpi(okP ? 'ok' : 'bad', t('Allowable load', 'الحمل المسموح'), F(Qa, 0) + '<small> kN</small>', 'FS = ' + F(p.FS, 1) + (p.P ? t(' · working ', ' · التشغيلي ') + F(p.P, 0) : '')) + G.kpi('info', t('Ultimate capacity', 'القدرة القصوى'), F(C.Qu, 0) + '<small> kN</small>', t('length ', 'الطول ') + F(R.L, 1) + t(' m', ' م')) +
      G.kpi('', t('Shaft resistance', 'مقاومة الجسم'), F(C.Qs, 0) + '<small> kN</small>', F(100 * C.Qs / C.Qu, 0) + t(' % of the total', ' % من الكلي')) + G.kpi('', t('End bearing', 'تحمل الطرف'), F(C.Qb, 0) + '<small> kN</small>', F(C.tip.qb, 0) + t(' kPa at the tip', ' كيلوباسكال عند الطرف'));
    var v = [];
    if (p.P) v.push(okP ? G.verdict('ok', t('The pile carries the working load', 'الركيزة تحمل الحمل التشغيلي'), t('Allowable ', 'المسموح ') + F(Qa, 0) + t(' kN against ', ' كيلونيوتن مقابل ') + F(p.P, 0) + t(' kN. ', ' كيلونيوتن. ') + (R.need ? t('A length of ', 'يكفي طول ') + F(R.need, 1) + t(' m would already be enough.', ' م لتحقيق ذلك.') : '')) :
      G.verdict('bad', t('The pile is too weak for the working load', 'الركيزة أضعف من الحمل التشغيلي'), R.need ? t('Lengthen it to about ', 'أطِلها إلى نحو ') + F(R.need, 1) + t(' m, increase the diameter or share the load between more piles.', ' م، أو زِد القطر، أو وزّع الحمل على ركائز أكثر.') : t('No length within the given layers is enough: increase the diameter, use more piles or reach a deeper bearing layer.', 'لا طول ضمن الطبقات المعطاة يكفي: زِد القطر أو استعمل ركائز أكثر أو اصل إلى طبقة حاملة أعمق.')));
    if (R.short) v.push(G.verdict('warn', t('Layers end at the pile tip', 'الطبقات تنتهي عند طرف الركيزة'), t('Enter the soil below the tip as well (at least 3–5 diameters): a soft layer below a bearing stratum can punch through.', 'أدخل التربة تحت الطرف أيضاً (3–5 أقطار على الأقل): فالطبقة الطرية تحت طبقة حاملة قد تنثقب.')));
    var tipL = R.Ls[C.tip.li]; if (tipL && tipL.ty === 'clay' && tipL.cu < 50) v.push(G.verdict('warn', t('Tip in soft clay', 'الطرف في طين طري'), t('End bearing in soft clay is small and mobilises only after large settlement; seat the tip in a firmer layer.', 'تحمل الطرف في الطين الطري صغير ولا يتعبأ إلا بعد هبوط كبير؛ فأسند الطرف في طبقة أصلب.')));
    v.push(G.verdict('info', t('Not included', 'غير مشمول'), t('Negative skin friction from settling fill or soft clay, group efficiency and settlement of the pile group, uplift and lateral loads, and the structural strength of the pile.', 'الاحتكاك السالب من ردم أو طين طري يهبط، وكفاءة المجموعة وهبوطها، وقوى السحب والأحمال الجانبية، والمقاومة الإنشائية للركيزة.')));
    $('#pcVerd').innerHTML = v.join('');
    figProf(); figLen(); table();
  }
  var LC = { sand: '#E9D9A6', clay: '#BFD3E6' };
  function figProf() {
    var R = last, p = R.p, P = R.P.filter(function (s) { return s.z <= R.L + 0.13; }), zmax = Math.ceil(R.Ztot), y = { lo: 0, hi: zmax, rev: true }, H = 560;
    var bands = function (fx, fy) { var top = 0, s = ''; R.Ls.forEach(function (l) { s += '<rect x="0" y="' + fy(top) + '" width="2000" height="' + (fy(top + l.h) - fy(top)) + '" fill="' + LC[l.ty] + '" opacity=".55"/>'; top += l.h; }); return s + '<line x1="0" x2="2000" y1="' + fy(p.w) + '" y2="' + fy(p.w) + '" stroke="#2E6FBF" stroke-dasharray="6 4"/>'; };
    var A = G.panel({ W: 230, H: H, m: { l: 62, r: 10, t: 50, b: 10 }, x: { lo: 0, hi: 1, none: true, title: 'Soil and pile', top: true }, y: Object.assign({ title: 'Depth (m)' }, y), under: function (fx, fy) { var s = bands(fx, fy), top = 0; R.Ls.forEach(function (l) { s += G.tx(fx(0.04), fy(top + l.h / 2) + 4, l.ty === 'clay' ? 'Clay cu ' + F(l.cu || 0, 0) : 'Sand φ′ ' + F(l.phi || 0, 0) + '°', { fs: 10.5, halo: 1 }); top += l.h; }); var w = Math.min(0.22, 0.05 + p.D * 0.1); return s + '<rect x="' + fx(0.72 - w / 2) + '" y="' + fy(0) + '" width="' + (fx(0.72 + w / 2) - fx(0.72 - w / 2)) + '" height="' + (fy(R.L) - fy(0)) + '" fill="#8A8F94" stroke="' + G.INK + '"/>'; } });
    var fmax = Math.max(20, Math.ceil(Math.max.apply(null, P.map(function (s) { return s.fs; })) / 20) * 20);
    var B = G.panel({ W: 330, H: H, m: { l: 36, r: 10, t: 50, b: 10 }, x: { lo: 0, hi: fmax, title: 'Unit shaft friction fs (kPa)', top: true }, y: y, under: bands, series: [{ pts: P.map(function (s) { return [s.fs, s.z]; }), col: '#C0392B', w: 2, step: false, area: 'x0', fillOp: .15 }] });
    var cum = [], q = 0, per = Math.PI * p.D, A0 = Math.PI * p.D * p.D / 4; P.forEach(function (s) { q += s.fs * per * s.dz; cum.push([q, s.z, q + s.qb * A0]); });
    var qmax = Math.max.apply(null, cum.map(function (c) { return c[2]; }));
    var C = G.panel({ W: 340, H: H, m: { l: 36, r: 18, t: 50, b: 10 }, x: { lo: 0, hi: G.span([0, qmax]).hi, title: 'Capacity if the tip were here (kN)', top: true }, y: y, under: bands, series: [{ pts: cum.map(function (c) { return [c[0], c[1]]; }), col: '#2E6FBF', w: 2 }, { pts: cum.map(function (c) { return [c[2], c[1]]; }), col: G.INK, w: 2.2 }], hl: [{ v: R.L, col: G.INK, dash: '4 3' }] });
    var s = '<rect width="900" height="760" fill="#fff"/><g>' + A + '</g><g transform="translate(230 0)">' + B + '</g><g transform="translate(560 0)">' + C + '</g>';
    var it = [{ name: 'Clay', col: '#7FA5C8', box: 1, op: .5 }, { name: 'Sand', col: '#C9A94E', box: 1, op: .5 }, { name: 'Pile (' + F(p.D, 2) + ' m, ' + (p.ty === 'driven' ? 'driven' : 'bored') + ')', col: '#8A8F94', box: 1, op: 1 }, { name: 'Water table', col: '#2E6FBF', dash: '6 4' }, { name: 'Unit shaft friction', col: '#C0392B' }, { name: 'Cumulative shaft resistance Qs', col: '#2E6FBF' }, { name: 'Ultimate capacity Qs + Qb', col: G.INK }, { name: 'Present pile tip', col: G.INK, dash: '4 3' }];
    var ly = H + 22; it.forEach(function (q2, i) { var x = 62 + (i % 3) * 280, yy = ly + Math.floor(i / 3) * 20; s += G.sym(q2, x + 10, yy - 4) + G.tx(x + 26, yy, q2.name, { fs: 11.5 }); });
    var HH = ly + Math.ceil(it.length / 3) * 20 + 8; $('#pcProf').setAttribute('viewBox', '0 0 900 ' + HH); $('#pcProf').innerHTML = s.replace('height="760"', 'height="' + HH + '"');
    $('#pcProfCap').textContent = t('Skin friction builds up layer by layer along the shaft; the black curve adds the end bearing a tip at each depth would get. Jumps in the black curve show the layers worth reaching: a short extension into dense sand often adds more than many metres in soft clay.', 'تتراكم مقاومة الاحتكاك طبقة بعد طبقة على امتداد الجسم، ويضيف المنحنى الأسود تحمل الطرف الذي ينشأ لو كان الطرف عند كل عمق. وتبين قفزات المنحنى الأسود الطبقات التي تستحق الوصول إليها: فامتداد قصير في رمل كثيف كثيراً ما يضيف أكثر من أمتار عديدة في طين طري.');
  }
  function figLen() {
    var R = last, p = R.p, c = R.curve; if (!c.length) return; var ymax = G.span(c.map(function (q) { return q.Qu; }).concat([p.P || 0])).hi;
    var vl = [{ v: R.L, col: G.INK, dash: '3 3', label: 'L = ' + F(R.L, 1) + ' m' }]; if (R.need && Math.abs(R.need - R.L) > 0.3) vl.push({ v: R.need, col: '#2E8B57', label: F(R.need, 1) + ' m' });
    G.chart($('#pcLen'), { W: 760, H: 400, x: { lo: 0, hi: Math.ceil(R.Ztot), title: 'Pile length below ground (m)' }, y: { lo: 0, hi: ymax, title: 'Axial compression capacity (kN)' }, series: [{ pts: c.map(function (q) { return [q.L, q.Qu]; }), col: G.INK, w: 2.4 }, { pts: c.map(function (q) { return [q.L, q.Qs]; }), col: '#2E6FBF', w: 1.6, dash: '6 4' }, { pts: c.map(function (q) { return [q.L, q.Qa]; }), col: '#C0392B', w: 2.4 }], hl: p.P ? [{ v: p.P, col: '#2E8B57', dash: '8 4', label: 'P = ' + F(p.P, 0) + ' kN' }] : [], vl: vl,
      legend: [{ name: 'Ultimate Qu = Qs + Qb', col: G.INK }, { name: 'Shaft resistance Qs', col: '#2E6FBF', dash: '6 4' }, { name: 'Allowable Qu / FS', col: '#C0392B' }].concat(p.P ? [{ name: 'Working load', col: '#2E8B57', dash: '8 4' }] : []), note: 'D = ' + F(p.D, 2) + ' m ' + (p.ty === 'driven' ? 'driven closed-ended pile' : 'bored pile') + ', FS = ' + F(p.FS, 1) + '. Group effects, negative skin friction and settlement not included.' });
    $('#pcLenCap').textContent = t('The same pile at every length from 2 m to the bottom of the layers. Where the red curve crosses the working load is the shortest pile that carries it with the chosen factor of safety.', 'الركيزة نفسها بكل طول من 2 م حتى قاعدة الطبقات. ونقطة تقاطع المنحنى الأحمر مع الحمل التشغيلي هي أقصر ركيزة تحمله بمعامل الأمان المختار.');
  }
  function table() {
    var R = last, top = 0;
    $('#pcTbl').innerHTML = '<thead><tr><th>' + t('Layer', 'الطبقة') + '</th><th>' + t('Depth m', 'العمق م') + '</th><th>' + t('Parameter', 'المعامل') + '</th><th class="num">' + t('Qs kN', 'Qs كيلونيوتن') + '</th></tr></thead><tbody>' + R.Ls.map(function (l, i) { var z0 = top; top += l.h; var mid = R.P.filter(function (s) { return s.li === i; }), md = mid[Math.floor(mid.length / 2)]; return z0 < R.L ? '<tr><td>' + (i + 1) + ' · ' + (l.ty === 'clay' ? t('Clay', 'طين') : t('Sand', 'رمل')) + '</td><td class="ltr">' + F(z0, 1) + '–' + F(Math.min(top, R.L), 1) + '</td><td class="ltr xsmall">' + (md ? md.note : '') + '</td><td class="num">' + F(R.C.byL[i] || 0, 0) + '</td></tr>' : ''; }).join('') +
      '<tr><td><b>' + t('Shaft', 'الجسم') + '</b></td><td></td><td></td><td class="num"><b>' + F(R.C.Qs, 0) + '</b></td></tr><tr><td><b>' + t('Tip', 'الطرف') + '</b></td><td class="ltr">' + F(R.L, 1) + '</td><td class="ltr xsmall">qb = ' + F(R.C.tip.qb, 0) + ' kPa</td><td class="num"><b>' + F(R.C.Qb, 0) + '</b></td></tr></tbody>';
  }
  $('#pcCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-pile-capacity.csv', [['depth_m', 'sigma_v_eff_kPa', 'fs_kPa', 'qb_kPa', 'parameter']].concat(last.P.map(function (s) { return [s.z.toFixed(2), s.se.toFixed(1), s.fs.toFixed(1), s.qb.toFixed(0), s.note]; })).concat([[], ['length_m', last.L], ['Qs_kN', last.C.Qs.toFixed(0)], ['Qb_kN', last.C.Qb.toFixed(0)], ['Qu_kN', last.C.Qu.toFixed(0)], ['Qall_kN', (last.C.Qu / last.p.FS).toFixed(0)]])); });
  var tm = null; function later() { clearTimeout(tm); tm = setTimeout(run, 150); }
  IDS.forEach(function (id) { var e = $('#' + id); e.addEventListener('input', later); e.addEventListener('change', later); });
  $('#pcDemo').addEventListener('click', function () { T.set(DEF); G.set({ pcT: 'bored', pcD: 0.8, pcL: 22, pcW: 2, pcFS: 2.5, pcP: 1500 }); run(); });
  document.addEventListener('DOMContentLoaded', run);
})();
