/* Liquefaction triggering from SPT — Idriss & Boulanger (2008): energy, borehole, rod and sampler corrections, overburden
   correction with the iterative exponent, fines correction to N1,60cs, CRR for M 7.5 and σ′v = 1 atm, MSF, Kσ, stress reduction
   rd, factor of safety; post-liquefaction volumetric strain and settlement (Ishihara & Yoshimine 1992 in the I&B form) and the
   liquefaction potential index (Iwasaki et al. 1978). */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, F = SH.fmt, G = window.EG, GW = 9.81, PA = 101.325;
  var IDS = ['lqM', 'lqA', 'lqW', 'lqER', 'lqBH', 'lqSm'], persist = SH.persist('liquef', IDS), last = null;
  var COLS = [{ k: 'z', h: 'z' }, { k: 'n', h: 'N' }, { k: 'fc', h: 'FC' }, { k: 'g', h: 'γ' }, { k: 'cl', h: t('Clay-like', 'شبيه بالطين'), w: '70px', type: 'select', opts: [['0', t('No', 'لا')], ['1', t('Yes', 'نعم')]] }];
  var DEF = [{ z: 1.5, n: 6, fc: 15, g: 18, cl: '0' }, { z: 3, n: 5, fc: 8, g: 18.5, cl: '0' }, { z: 4.5, n: 8, fc: 6, g: 19, cl: '0' }, { z: 6, n: 10, fc: 12, g: 19, cl: '0' }, { z: 7.5, n: 7, fc: 35, g: 18.5, cl: '0' }, { z: 9, n: 12, fc: 70, g: 18.5, cl: '1' }, { z: 10.5, n: 18, fc: 10, g: 19.5, cl: '0' }, { z: 12, n: 24, fc: 8, g: 20, cl: '0' }, { z: 15, n: 32, fc: 5, g: 20, cl: '0' }];
  var T = G.rows($('#lqRows'), 'shandal_liq_rows', COLS, DEF, function () { later(); });
  $('#lqAdd').addEventListener('click', function () { var r = T.get(), z = r.length ? (r[r.length - 1].z || 0) + 1.5 : 1.5; T.add({ z: z, n: 15, fc: 10, g: 19, cl: '0' }); });

  var CRR = function (N) { return N >= 37.5 ? 2 : Math.exp(N / 14.1 + Math.pow(N / 126, 2) - Math.pow(N / 23.6, 3) + Math.pow(N / 25.4, 4) - 2.8); };
  var dN = function (fc) { return Math.exp(1.63 + 9.7 / (fc + 0.01) - Math.pow(15.7 / (fc + 0.01), 2)); };
  var CRod = function (z) { var L = z + 1.5; return L < 3 ? 0.75 : L < 4 ? 0.8 : L < 6 ? 0.85 : L < 10 ? 0.95 : 1; };

  function run() {
    var p = { M: G.v('lqM'), a: G.v('lqA'), w: Math.max(0, G.v('lqW')), er: G.v('lqER') || 60, cb: +$('#lqBH').value || 1, cs: +$('#lqSm').value || 1 };
    if (!(p.M >= 5 && p.a > 0) || isNaN(p.w)) return; persist.save();
    var rows = T.get().filter(function (r) { return r.z > 0 && r.n != null && r.n >= 0; }).sort(function (a, b) { return a.z - b.z; }); if (!rows.length) { $('#lqKpis').innerHTML = ''; return; }
    var MSF = Math.min(1.8, 6.9 * Math.exp(-p.M / 4) - 0.058), sv = 0, zp = 0, out = [];
    rows.forEach(function (r, i) {
      var g = r.g > 0 ? r.g : 19, fc = Math.max(0, r.fc || 0); sv += g * (r.z - zp); zp = r.z;
      var u = GW * Math.max(0, r.z - p.w), se = sv - u, N60 = r.n * p.er / 60 * p.cb * CRod(r.z) * p.cs, Nc = N60, CN = 1;
      for (var k = 0; k < 20; k++) { var m = 0.784 - 0.0768 * Math.sqrt(Math.min(46, Nc)); CN = Math.min(1.7, Math.pow(PA / se, m)); Nc = CN * N60 + dN(fc); }
      var N1 = CN * N60, Ncs = N1 + dN(fc), zz = r.z, al = -1.012 - 1.126 * Math.sin(zz / 11.73 + 5.133), be = 0.106 + 0.118 * Math.sin(zz / 11.28 + 5.142), rd = zz <= 34 ? Math.exp(al + be * p.M) : 0.12 * Math.exp(0.22 * p.M);
      var CSR = 0.65 * (sv / se) * p.a * rd, Cs = Math.min(0.3, 1 / (18.9 - 2.55 * Math.sqrt(Math.min(Ncs, 37)))), Ks = Math.min(1.1, 1 - Cs * Math.log(se / PA)), crr = CRR(Ncs), R0 = crr * MSF * Ks;
      var sat = r.z > p.w, clay = String(r.cl) === '1', FS = !sat || clay ? null : Math.min(R0 / CSR, 5);
      var top = i ? (rows[i - 1].z + r.z) / 2 : Math.max(0, r.z - (rows[1] ? (rows[1].z - r.z) / 2 : 0.75)), bot = i + 1 < rows.length ? (r.z + rows[i + 1].z) / 2 : r.z + (i ? (r.z - rows[i - 1].z) / 2 : 0.75); top = Math.max(top, p.w);
      var dz = Math.max(0, bot - top), ev = 0, Dr = Math.min(1, Math.sqrt(Math.max(Ncs, 0) / 46));
      if (FS != null && FS < 2) { var gl = Math.max(0, 1.859 * Math.pow(1.1 - Dr, 3)), Fa = 0.032 + 4.7 * Math.max(Dr, 0.4) - 6 * Math.pow(Math.max(Dr, 0.4), 2), gm = FS <= Fa ? gl : Math.min(gl, 0.035 * (2 - FS) * (1 - Fa) / (FS - Fa)); ev = 1.5 * Math.exp(-2.5 * Dr) * Math.min(0.08, gm); }
      var Fl = FS != null && FS < 1 ? 1 - FS : 0, wz = Math.max(0, 10 - 0.5 * r.z);
      out.push({ z: r.z, n: r.n, fc: fc, sv: sv, se: se, N60: N60, CN: CN, N1: N1, Ncs: Ncs, rd: rd, CSR: CSR, CRR: R0, crr: crr, Ks: Ks, FS: FS, sat: sat, clay: clay, dz: r.z <= 20 ? dz : 0, ev: ev, S: ev * (r.z <= 20 ? dz : 0), LPI: Fl * wz * (r.z <= 20 ? dz : 0), Dr: Dr });
    });
    var LPI = out.reduce(function (s, o) { return s + o.LPI; }, 0), S = out.reduce(function (s, o) { return s + o.S; }, 0), liq = out.filter(function (o) { return o.FS != null && o.FS < 1; }), thick = liq.reduce(function (s, o) { return s + o.dz; }, 0);
    var fsMin = out.filter(function (o) { return o.FS != null; }).reduce(function (a, o) { return !a || o.FS < a.FS ? o : a; }, null);
    last = { p: p, out: out, MSF: MSF, LPI: LPI, S: S, liq: liq, thick: thick, fsMin: fsMin }; render();
  }
  var lpiCls = function (v) { return v === 0 ? [t('Very low', 'منخفض جداً'), 'ok'] : v <= 5 ? [t('Low', 'منخفض'), 'ok'] : v <= 15 ? [t('High', 'مرتفع'), 'warn'] : [t('Very high', 'مرتفع جداً'), 'bad']; };
  function render() {
    var R = last, lc = lpiCls(R.LPI), mn = R.fsMin;
    $('#lqKpis').innerHTML = G.kpi(mn && mn.FS < 1 ? 'bad' : mn && mn.FS < 1.3 ? 'warn' : 'ok', t('Lowest factor of safety', 'أدنى معامل أمان'), mn ? (mn.FS >= 5 ? '> 5' : F(mn.FS, 2)) : '—', mn ? t('at ', 'عند ') + F(mn.z, 1) + t(' m', ' م') : t('no saturated sand', 'لا رمل مشبع')) +
      G.kpi(lc[1], t('Liquefaction potential index', 'دليل احتمال التميع'), F(R.LPI, 1), lc[0] + ' (LPI)') + G.kpi(R.thick > 0 ? 'warn' : 'ok', t('Liquefiable thickness', 'السمك القابل للتميع'), F(R.thick, 1) + '<small> ' + t('m', 'م') + '</small>', t('FS < 1 down to 20 m', 'معامل أقل من 1 حتى 20 م')) +
      G.kpi(R.S > 0.05 ? 'bad' : R.S > 0.025 ? 'warn' : 'ok', t('Ground settlement after shaking', 'هبوط الأرض بعد الاهتزاز'), F(R.S * 1000, 0) + '<small> mm</small>', t('free-field, volumetric', 'حجمي، في الحقل الحر'));
    var v = [];
    if (R.liq.length) v.push(G.verdict(R.LPI > 15 ? 'bad' : 'warn', t('Liquefaction is expected', 'التميع متوقع'), t('Layers at ', 'الطبقات عند أعماق ') + R.liq.map(function (o) { return F(o.z, 1); }).join(AR() ? '، ' : ', ') + t(' m have FS below 1 for this earthquake. Expect sand boils, settlement of about ', ' م معامل أمانها أقل من 1 لهذا الزلزال. توقع فوران الرمل وهبوطاً بنحو ') + F(R.S * 1000, 0) + t(' mm and loss of bearing for shallow footings; ground improvement (vibro-compaction, stone columns, drains) or piles through the layers are the usual remedies.', ' مم وفقدان التحمل للأسس الضحلة؛ والعلاج المعتاد تحسين التربة (الرص الاهتزازي، الأعمدة الحجرية، المصارف) أو ركائز تخترق الطبقات.')));
    else v.push(G.verdict('ok', t('No layer liquefies', 'لا طبقة تتميع'), t('Every saturated sandy layer has FS ≥ 1. Layers with FS between 1 and 1.3 still build up pore pressure and soften.', 'كل الطبقات الرملية المشبعة معامل أمانها ≥ 1. والطبقات بين 1 و1.3 يرتفع فيها ضغط المسام وتلين مع ذلك.')));
    if (R.out.some(function (o) { return o.clay && o.sat; })) v.push(G.verdict('info', t('Clay-like layers', 'طبقات شبيهة بالطين'), t('They are not checked for sand-like liquefaction; soft clays can still lose strength by cyclic softening and need the cyclic strength from undrained tests.', 'لا تُفحص للتميع الرملي؛ لكن الأطيان الطرية قد تفقد مقاومتها بالتليّن الدوري وتحتاج إلى المقاومة الدورية من فحوص غير مصرفة.')));
    $('#lqVerd').innerHTML = v.join('');
    figProf(); figCrr(); table();
  }
  function AR() { return SH.lang === 'ar'; }
  function panel(o) { var tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); G.chart(tmp, o); return tmp.innerHTML.replace(/^<rect[^>]*fill="#fff"[^>]*>(<\/rect>)?/, ''); }
  function figProf() {
    var R = last, p = R.p, O = R.out, zmax = Math.ceil((Math.max.apply(null, O.map(function (o) { return o.z; })) + 1) / 2) * 2, y = { lo: 0, hi: zmax, rev: true }, H = 560;
    var wt = function (fx, fy) { return '<rect x="0" y="' + fy(0) + '" width="2000" height="' + (fy(p.w) - fy(0)) + '" fill="#F3EFE6"/><line x1="0" x2="2000" y1="' + fy(p.w) + '" y2="' + fy(p.w) + '" stroke="#2E6FBF" stroke-dasharray="6 4"/>'; };
    var nmax = Math.max(40, Math.ceil(Math.max.apply(null, O.map(function (o) { return o.Ncs; })) / 10) * 10);
    var A = panel({ W: 300, H: H, m: { l: 62, r: 10, t: 50, b: 10 }, x: { lo: 0, hi: nmax, st: 10, title: 'N1,60cs', top: true }, y: Object.assign({ title: 'Depth (m)' }, y), under: wt, series: [{ pts: O.map(function (o) { return [o.N60, o.z]; }), col: '#8C8C8C', w: 1.2, mark: 's', r: 3 }, { pts: O.map(function (o) { return [o.Ncs, o.z]; }), col: '#2E6FBF', w: 2, mark: 'o' }] });
    var cmax = Math.max(0.6, Math.ceil(Math.max.apply(null, O.map(function (o) { return Math.max(o.CSR, Math.min(o.CRR, 1)); })) * 10) / 10);
    var B = panel({ W: 300, H: H, m: { l: 36, r: 10, t: 50, b: 10 }, x: { lo: 0, hi: cmax, title: 'CSR, CRR', top: true }, y: y, under: wt, series: [{ pts: O.map(function (o) { return [o.CSR, o.z]; }), col: '#C0392B', w: 2, mark: 'o' }, { pts: O.filter(function (o) { return o.sat && !o.clay; }).map(function (o) { return [Math.min(o.CRR, cmax), o.z]; }), col: '#2E8B57', w: 2, mark: 's' }] });
    var C = panel({ W: 300, H: H, m: { l: 36, r: 16, t: 50, b: 10 }, x: { lo: 0, hi: 2, st: 0.5, title: 'Factor of safety FS', top: true }, y: y, under: function (fx, fy) { return wt(fx, fy) + '<rect x="' + fx(0) + '" y="0" width="' + (fx(1) - fx(0)) + '" height="2000" fill="#C0392B" fill-opacity=".08"/>'; }, vl: [{ v: 1, col: '#C0392B', w: 1.6 }, { v: 1.3, col: '#E67E22', dash: '5 4' }], series: [{ pts: O.filter(function (o) { return o.FS != null; }).map(function (o) { return [Math.min(o.FS, 2), o.z]; }), col: G.INK, w: 1.6, mark: 'o', r: 4.5 }] });
    var s = '<rect width="900" height="700" fill="#fff"/><g>' + A + '</g><g transform="translate(300 0)">' + B + '</g><g transform="translate(600 0)">' + C + '</g>';
    var it = [{ name: 'N60 corrected for energy, rods, borehole and sampler', col: '#8C8C8C', mark: 's', w: 1.2 }, { name: 'N1,60cs clean-sand equivalent', col: '#2E6FBF', mark: 'o' }, { name: 'CSR demand of the earthquake', col: '#C0392B', mark: 'o' }, { name: 'CRR resistance (M = ' + F(p.M, 1) + ', Kσ)', col: '#2E8B57', mark: 's' }, { name: 'FS = 1 (liquefaction) and 1.3', col: '#C0392B' }, { name: 'Water table, unsaturated zone shaded', col: '#2E6FBF', dash: '6 4' }];
    var ly = H + 22; it.forEach(function (q, i) { var x = 62 + (i % 2) * 420, yy = ly + Math.floor(i / 2) * 20; s += G.sym(q, x + 10, yy - 4) + G.tx(x + 26, yy, q.name, { fs: 11.5 }); });
    var ny = ly + 66; s += G.tx(62, ny, 'Idriss & Boulanger (2008) SPT procedure; clay-like and unsaturated layers are not assessed. FS above 2 drawn at 2.', { fs: 11, fill: G.MUT });
    $('#lqProf').setAttribute('viewBox', '0 0 900 ' + (ny + 10)); $('#lqProf').innerHTML = s.replace('height="700"', 'height="' + (ny + 10) + '"');
    $('#lqProfCap').textContent = t('Left: the corrected blow counts. Middle: the cyclic stress the earthquake imposes (CSR) against the resistance of the sand (CRR). Right: their ratio; points inside the shaded band liquefy. Thin loose layers near the water table matter most because they are closest to footings.', 'اليسار: أعداد الضربات المصححة. الوسط: الإجهاد الدوري الذي يفرضه الزلزال (CSR) مقابل مقاومة الرمل (CRR). اليمين: نسبتهما؛ والنقاط داخل الشريط المظلل تتميع. والطبقات الرقيقة المفككة قرب منسوب المياه هي الأهم لأنها الأقرب إلى الأسس.');
  }
  function figCrr() {
    var R = last, curve = []; for (var n = 0; n <= 37; n += 0.5) curve.push([n, CRR(n)]);
    var pts = R.out.filter(function (o) { return o.FS != null; }), liq = pts.filter(function (o) { return o.FS < 1; }), ok = pts.filter(function (o) { return o.FS >= 1; });
    var adj = function (o) { return [Math.min(o.Ncs, 40), Math.min(0.6, o.CSR / (R.MSF * o.Ks))]; };
    G.chart($('#lqCrr'), { W: 760, H: 420, x: { lo: 0, hi: 40, st: 5, title: 'Clean-sand equivalent blow count N1,60cs' }, y: { lo: 0, hi: 0.6, st: 0.1, title: 'CSR for M = 7.5 and σ′v = 1 atm' }, series: [{ pts: curve.filter(function (q) { return q[1] <= 0.62; }), col: G.INK, w: 2.4 }, { pts: liq.map(adj), col: '#C0392B', w: 0, mark: 'o', r: 6, mfill: '#C0392B' }, { pts: ok.map(adj), col: '#2E8B57', w: 0, mark: 'o', r: 6 }],
      legend: [{ name: 'CRR boundary (Idriss & Boulanger 2008)', col: G.INK }, { name: 'Test that liquefies (FS < 1)', col: '#C0392B', mark: 'o', mfill: '#C0392B', noLine: 1 }, { name: 'Test that resists (FS ≥ 1)', col: '#2E8B57', mark: 'o', noLine: 1 }], note: 'Demand adjusted to M 7.5 by MSF = ' + F(R.MSF, 2) + ' and to 1 atm by Kσ for each test.' });
    $('#lqCrrCap').textContent = t('The classic chart of liquefaction case histories: points above the line liquefied in past earthquakes, points below did not. Each test of the borehole is placed on it after correcting the earthquake demand to magnitude 7.5 and one atmosphere.', 'المخطط الكلاسيكي لحالات التميع المسجلة: النقاط فوق الخط تميعت في زلازل سابقة، والنقاط تحته لم تتميع. ويوضع كل فحص من البئر عليه بعد تصحيح طلب الزلزال إلى القدر 7.5 وضغط جوي واحد.');
  }
  function table() {
    var R = last;
    $('#lqTbl').innerHTML = '<thead><tr><th class="num">z m</th><th class="num">N</th><th class="num">N1,60cs</th><th class="num">σ′v kPa</th><th class="num">r<sub>d</sub></th><th class="num">CSR</th><th class="num">CRR</th><th class="num">FS</th><th class="num">ε<sub>v</sub> %</th></tr></thead><tbody>' +
      R.out.map(function (o) { var fs = o.FS == null ? '<span class="xsmall muted">' + (o.clay ? t('clay-like', 'شبيه بالطين') : t('above water', 'فوق الماء')) + '</span>' : '<span class="badge ' + (o.FS < 1 ? 'bad' : o.FS < 1.3 ? 'warn' : 'ok') + '">' + (o.FS >= 5 ? '> 5' : F(o.FS, 2)) + '</span>'; return '<tr><td class="num">' + F(o.z, 1) + '</td><td class="num">' + F(o.n, 0) + '</td><td class="num">' + F(o.Ncs, 1) + '</td><td class="num">' + F(o.se, 0) + '</td><td class="num">' + F(o.rd, 2) + '</td><td class="num">' + F(o.CSR, 3) + '</td><td class="num">' + (o.sat && !o.clay ? F(Math.min(o.CRR, 9.99), 3) : '—') + '</td><td class="num">' + fs + '</td><td class="num">' + (o.ev ? F(o.ev * 100, 2) : '—') + '</td></tr>'; }).join('') + '</tbody>';
  }
  $('#lqCsv').addEventListener('click', function () { if (!last) return; SH.csv('shandal-liquefaction.csv', [['depth_m', 'N_field', 'FC_pct', 'sigma_v_kPa', 'sigma_v_eff_kPa', 'N60', 'CN', 'N1_60', 'N1_60cs', 'rd', 'CSR', 'CRR_M_sigma', 'K_sigma', 'FS', 'eps_v_pct', 'LPI_contribution']].concat(last.out.map(function (o) { return [o.z, o.n, o.fc, o.sv.toFixed(1), o.se.toFixed(1), o.N60.toFixed(1), o.CN.toFixed(3), o.N1.toFixed(1), o.Ncs.toFixed(1), o.rd.toFixed(3), o.CSR.toFixed(3), o.CRR.toFixed(3), o.Ks.toFixed(3), o.FS == null ? (o.clay ? 'clay-like' : 'unsaturated') : o.FS.toFixed(2), (o.ev * 100).toFixed(2), o.LPI.toFixed(2)]; })).concat([[], ['MSF', last.MSF.toFixed(3)], ['LPI', last.LPI.toFixed(1)], ['settlement_mm', (last.S * 1000).toFixed(0)]])); });
  var tm = null; function later() { clearTimeout(tm); tm = setTimeout(run, 200); }
  IDS.forEach(function (id) { var e = $('#' + id); e.addEventListener('input', later); e.addEventListener('change', later); });
  $('#lqDemo').addEventListener('click', function () { T.set(DEF); G.set({ lqM: 6.5, lqA: 0.2, lqW: 1.5, lqER: 60, lqBH: '1', lqSm: '1' }); run(); });
  document.addEventListener('DOMContentLoaded', run);
})();
