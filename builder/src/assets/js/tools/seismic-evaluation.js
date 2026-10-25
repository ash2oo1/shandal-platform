/* Seismic site evaluation — ASCE 7-16 site coefficients, design spectrum, seismic design category, ELF base shear,
   nearest active faults (GEM GAF-DB) with deterministic scenario PGA, and Youd et al. (2001) liquefaction triggering. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, L = window.L;
  var persist = SH.persist('seismic', ['geoName', 'sProj', 'sLat', 'sLon', 'sSs', 'sS1', 'sTL', 'sClass', 'sRisk', 'sSys', 'sH', 'sW', 'lZ', 'lGw', 'lG', 'lN', 'lFC', 'lM']);
  var map = SH.map('sMap', { zoom: 6, base: 'topo' }), site = null, siteMk = null, faultLayer = null, faults = [], tileCache = {}, index = null, last = null;
  var VS30 = { A: 1400, B: 1070, C: 560, D: 270, E: 150, F: 150 };

  /* ---------- ASCE 7-16 Tables 11.4-1 and 11.4-2 */
  var FA = { A: [.8, .8, .8, .8, .8, .8], B: [.9, .9, .9, .9, .9, .9], C: [1.3, 1.3, 1.2, 1.2, 1.2, 1.2], D: [1.6, 1.4, 1.2, 1.1, 1.0, 1.0], E: [2.4, 1.7, 1.3, 1.2, 1.2, 1.2] };
  var FV = { A: [.8, .8, .8, .8, .8, .8], B: [.8, .8, .8, .8, .8, .8], C: [1.5, 1.5, 1.5, 1.5, 1.5, 1.4], D: [2.4, 2.2, 2.0, 1.9, 1.8, 1.7], E: [4.2, 3.3, 2.8, 2.4, 2.2, 2.0] };
  function interp(row, xs, x) { if (x <= xs[0]) return row[0]; if (x >= xs[xs.length - 1]) return row[row.length - 1]; for (var i = 1; i < xs.length; i++) if (x <= xs[i]) return row[i - 1] + (row[i] - row[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]); }
  function coeffs(cls, Ss, S1) {
    var c = cls === 'F' ? 'D' : cls, notes = [];
    var Fa = interp(FA[c], [.25, .5, .75, 1, 1.25, 1.5], Ss), Fv = interp(FV[c], [.1, .2, .3, .4, .5, .6], S1);
    if (cls === 'F') notes.push(['bad', t('Site class F requires a site response analysis (ASCE 7 §20.2.1). Values shown use class D coefficients for orientation only.', 'صنف الموقع F يتطلب تحليل استجابة موقعية (ASCE 7 §20.2.1). القيم المعروضة تستخدم معاملات الصنف D للاسترشاد فقط.')]);
    if (cls === 'E' && Ss >= 1) notes.push(['warn', t('Class E with SS ≥ 1.0: Fa is taken as for class C (ASCE 7-16 §11.4.8, exception 1); a site-specific study is otherwise required.', 'الصنف E مع SS ≥ 1.0: يُؤخذ Fa كما للصنف C (ASCE 7-16 §11.4.8، الاستثناء 1)، وإلا تلزم دراسة موقعية.')]);
    if (cls === 'E' && Ss >= 1) Fa = interp(FA.C, [.25, .5, .75, 1, 1.25, 1.5], Ss);
    if ((cls === 'D' || cls === 'E') && S1 >= 0.2) notes.push(['warn', t('S1 ≥ 0.2 on class ' + cls + ': ASCE 7-16 §11.4.8 requires a site-specific ground-motion analysis unless its exceptions are used (for class D, Cs per exception 2).', 'S1 ≥ 0.2 على الصنف ' + cls + ': يشترط ASCE 7-16 §11.4.8 تحليل حركة أرضية موقعياً ما لم تُطبق استثناءاته (للصنف D يُحسب Cs وفق الاستثناء 2).')]);
    return { Fa: Fa, Fv: Fv, notes: notes };
  }
  function sdc(SDS, SD1, S1, rc) {
    var iv = rc === 'IV', o = ['A', 'B', 'C', 'D', 'E', 'F'];
    if (S1 >= 0.75) return iv ? 'F' : 'E';
    var a = SDS < 0.167 ? 'A' : SDS < 0.33 ? (iv ? 'C' : 'B') : SDS < 0.5 ? (iv ? 'D' : 'C') : 'D';
    var b = SD1 < 0.067 ? 'A' : SD1 < 0.133 ? (iv ? 'C' : 'B') : SD1 < 0.2 ? (iv ? 'D' : 'C') : 'D';
    return o[Math.max(o.indexOf(a), o.indexOf(b))];
  }
  function Sa(T, p) { if (T < p.T0) return p.SDS * (0.4 + 0.6 * T / p.T0); if (T <= p.Ts) return p.SDS; if (T <= p.TL) return p.SD1 / T; return p.SD1 * p.TL / (T * T); }

  /* ---------- faults */
  function kind(s) { s = (s || '').toLowerCase(); if (/thrust|reverse|anticline/.test(s)) return 'R'; if (/normal/.test(s)) return 'N'; if (/dextral|sinistral|strike/.test(s)) return 'SS'; return 'U'; }
  var KCOL = { R: '#C0392B', N: '#2E6FBF', SS: '#2E8B57', U: '#7A7A7A' };
  var KNAME = { R: t('Reverse / thrust', 'عكسي / زاحف'), N: t('Normal', 'اعتيادي'), SS: t('Strike-slip', 'انزلاق مضربي'), U: t('Unspecified', 'غير محدد') };
  function loadTiles(lat, lon) {
    var base = SH.base + 'assets/data/faults/';
    var idx = index ? Promise.resolve(index) : SH.getJSON(base + 'index.json').then(function (j) { index = j; return j; });
    return idx.then(function (ix) {
      var la = Math.floor(lat / 10) * 10, lo = Math.floor(lon / 10) * 10, want = [];
      for (var dy = -10; dy <= 10; dy += 10) for (var dx = -10; dx <= 10; dx += 10) { var lo2 = ((lo + dx + 180) % 360 + 360) % 360 - 180, k = (la + dy) + '_' + lo2; if (ix.indexOf(k) >= 0) want.push(k); }
      return Promise.all(want.map(function (k) { return tileCache[k] ? tileCache[k] : (tileCache[k] = SH.getJSON(base + k + '.json').catch(function () { return []; })); }));
    }).then(function (arrs) { var seen = {}, out = []; arrs.forEach(function (a) { a.forEach(function (r) { var key = r[4].slice(0, 4).join(','); if (!seen[key]) { seen[key] = 1; out.push(r); } }); }); return out; });
  }
  function analyseFaults(recs, lat, lon) {
    var kx = 111.195 * Math.cos(SH.rad(lat)), ky = 111.195, res = [];
    recs.forEach(function (r) {
      var c = r[4], best = 1e9, len = 0, px = 0, py = 0;
      for (var i = 0; i + 3 < c.length; i += 2) {
        var x1 = (c[i] - lon) * kx, y1 = (c[i + 1] - lat) * ky, x2 = (c[i + 2] - lon) * kx, y2 = (c[i + 3] - lat) * ky, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
        var u = L2 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / L2)) : 0, qx = x1 + u * dx, qy = y1 + u * dy, dd = Math.sqrt(qx * qx + qy * qy);
        if (dd < best) { best = dd; px = qx; py = qy; } len += Math.sqrt(L2);
      }
      if (best > 400) return;
      var k = kind(r[1]), lg = Math.log10(Math.max(len, 1));
      var Mw = k === 'SS' ? 5.16 + 1.12 * lg : k === 'R' ? 5.00 + 1.22 * lg : k === 'N' ? 4.86 + 1.32 * lg : 5.08 + 1.16 * lg;
      res.push({ name: r[0], type: r[1], k: k, rate: r[2], dip: r[3], coords: c, d: best, len: len, Mw: Math.min(Mw, 8.0), near: [lat + py / ky, lon + px / kx] });
    });
    return res.sort(function (a, b) { return a.d - b.d; });
  }
  /* Boore, Joyner & Fumal (1997) median PGA (g), random horizontal component */
  function bjf(M, rjb, vs, k) { var b1 = k === 'SS' ? -0.313 : k === 'R' ? -0.117 : -0.242, r = Math.sqrt(rjb * rjb + 5.57 * 5.57); return Math.exp(b1 + 0.527 * (M - 6) - 0.778 * Math.log(r) - 0.371 * Math.log(vs / 1396)); }

  function drawFaults(list) {
    if (!map) return; if (faultLayer) map.removeLayer(faultLayer); faultLayer = L.layerGroup().addTo(map);
    list.slice(0, 400).forEach(function (f, i) {
      var ll = []; for (var j = 0; j < f.coords.length; j += 2) ll.push([f.coords[j + 1], f.coords[j]]);
      L.polyline(ll, { color: KCOL[f.k], weight: i < 5 ? 3.5 : 2, opacity: i < 5 ? 1 : .75 }).bindTooltip('<b>' + SH.esc(f.name || t('Unnamed fault', 'صدع غير مسمى')) + '</b><br>' + KNAME[f.k] + ' · ' + SH.fmt(f.d, 1) + ' km').addTo(faultLayer);
    });
    if (list[0]) L.polyline([[site.lat, site.lon], list[0].near], { color: '#1B232B', weight: 1.5, dashArray: '5 5' }).addTo(faultLayer);
  }
  var legend = L && map ? L.control({ position: 'bottomright' }) : null;
  if (legend) { legend.onAdd = function () { var dv = L.DomUtil.create('div'); dv.style.cssText = 'background:var(--surface);color:var(--text);padding:8px 10px;border-radius:10px;border:1px solid var(--line);font-size:11px;line-height:1.7;box-shadow:var(--shadow-1)'; dv.innerHTML = ['R', 'N', 'SS', 'U'].map(function (k) { return '<div><span style="display:inline-block;width:18px;height:3px;background:' + KCOL[k] + ';vertical-align:middle;margin-inline-end:6px"></span>' + KNAME[k] + '</div>'; }).join(''); return dv; }; legend.addTo(map); }

  function setSite(lat, lon, fly) {
    site = { lat: lat, lon: lon }; $('#sLat').value = lat.toFixed(5); $('#sLon').value = lon.toFixed(5); persist.save();
    if (!map) return Promise.resolve();
    if (siteMk) siteMk.setLatLng([lat, lon]); else siteMk = L.marker([lat, lon], { icon: SH.pin('', 'mk mk-site', [18, 18]) }).addTo(map);
    if (fly) map.setView([lat, lon], 8);
    SH.busy($('#sMap').parentElement, true, t('Loading active faults…', 'جارٍ تحميل الصدوع النشطة…'));
    return loadTiles(lat, lon).then(function (recs) { faults = analyseFaults(recs, lat, lon); drawFaults(faults); SH.busy($('#sMap').parentElement, false); if (SH.seg('sSrc') === 'scen') scenarioFill(); })
      .catch(function (e) { SH.busy($('#sMap').parentElement, false); SH.toast(e.message, 'bad'); });
  }
  if (map) map.on('click', function (e) { setSite(e.latlng.lat, e.latlng.lng); });
  $('#sGps').addEventListener('click', function () { var b = this; b.disabled = true; SH.locate().then(function (p) { b.disabled = false; setSite(p.lat, p.lon, true); }).catch(function (e) { b.disabled = false; SH.toast(e.message, 'bad'); }); });
  ['sLat', 'sLon'].forEach(function (id) { $('#' + id).addEventListener('change', function () { var la = SH.num('sLat'), lo = SH.num('sLon'); if (Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !isNaN(la) && !isNaN(lo)) setSite(la, lo, true); }); });

  function scenario() {
    var vs = VS30[SH.val('sClass')], best = null;
    faults.slice(0, 40).forEach(function (f) { f.pga = bjf(f.Mw, f.d, vs, f.k); f.pgaRock = bjf(f.Mw, f.d, 760, f.k); if (f.d <= 200 && (!best || f.pgaRock > best.pgaRock)) best = f; });
    return best;
  }
  function scenarioFill() {
    var b = scenario(); if (!b) { SH.toast(t('No active fault within 200 km in the database. Enter the code values instead.', 'لا يوجد صدع نشط ضمن 200 كم في قاعدة البيانات. أدخل قيم الكود بدلاً من ذلك.'), 'info'); return; }
    var p84 = b.pgaRock * Math.exp(0.52), Ss = Math.min(2.5 * p84, 3), S1 = 0.4 * Ss;
    $('#sSs').value = Ss.toFixed(2); $('#sS1').value = S1.toFixed(2);
    $('#sSrcNote').innerHTML = t('Screening estimate: 84th-percentile PGA on B/C rock = ', 'تقدير أولي: PGA عند المئين 84 على صخر B/C = ') + '<b>' + SH.fmt(p84, 3) + ' g</b> ' + t('from ', 'من ') + SH.esc(b.name || t('an unnamed fault', 'صدع غير مسمى')) + ' (M<sub>w</sub> ' + SH.fmt(b.Mw, 1) + ', ' + SH.fmt(b.d, 1) + ' km). S<sub>S</sub> = 2.5 PGA, S<sub>1</sub> = 0.4 S<sub>S</sub>. ' + t('Replace with the code values for design.', 'استبدلها بقيم الكود لأغراض التصميم.');
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('#sSrc button'); if (!b) return; setTimeout(function () { if (SH.seg('sSrc') === 'scen') { if (!site) SH.toast(t('Place the site first.', 'حدد الموقع أولاً.'), 'warn'); else scenarioFill(); } else $('#sSrcNote').textContent = t('Enter the mapped values from the governing code. The fault scenario fills them with a screening estimate from the nearest active faults.', 'أدخل القيم المرجعية من الكود الحاكم. يملؤها سيناريو الصدع بتقدير أولي من أقرب الصدوع النشطة.'); }, 0); });
  $('#lOn').addEventListener('change', function () { $('#lBox').hidden = !this.checked; });

  /* ---------- liquefaction: Youd et al. (2001) */
  function liquefaction(amax) {
    var z = SH.num('lZ'), gw = SH.num('lGw'), g = SH.num('lG'), N = SH.num('lN'), FC = SH.num('lFC'), M = SH.num('lM');
    var sv = g * z, u = z > gw ? 9.81 * (z - gw) : 0, sve = sv - u;
    var rd = z <= 23 ? (1 - 0.4113 * Math.sqrt(z) + 0.04052 * z + 0.001753 * Math.pow(z, 1.5)) / (1 - 0.4177 * Math.sqrt(z) + 0.05729 * z - 0.006205 * Math.pow(z, 1.5) + 0.00121 * z * z) : 0.5;
    var csr = 0.65 * amax * sv / sve * rd;
    var a = FC <= 5 ? 0 : FC >= 35 ? 5 : Math.exp(1.76 - 190 / (FC * FC)), b = FC <= 5 ? 1 : FC >= 35 ? 1.2 : 0.99 + Math.pow(FC, 1.5) / 1000, Ncs = a + b * N;
    var crr = Ncs >= 30 ? Infinity : 1 / (34 - Ncs) + Ncs / 135 + 50 / Math.pow(10 * Ncs + 45, 2) - 1 / 200, msf = Math.pow(10, 2.24) / Math.pow(M, 2.56);
    return { z: z, gw: gw, sv: sv, sve: sve, rd: rd, csr: csr, Ncs: Ncs, crr: crr, msf: msf, fs: z <= gw ? Infinity : crr * msf / csr, dry: z <= gw };
  }

  function kpi(cls, k, v, s) { return '<div class="kpi ' + cls + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>'; }
  function verdict(state, h, p) { return '<div class="verdict ' + state + '"><span class="vi">' + SH.icon(state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }
  var row = function (k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; };

  function run() {
    var Ss = SH.num('sSs'), S1 = SH.num('sS1'), TL = SH.num('sTL') || 8, cls = SH.val('sClass'), rc = SH.val('sRisk');
    if (!(Ss > 0 && S1 > 0)) { SH.toast(t('Enter SS and S1, or switch to the fault scenario.', 'أدخل SS وS1 أو انتقل إلى سيناريو الصدع.'), 'warn'); return; }
    var c = coeffs(cls, Ss, S1), p = { Ss: Ss, S1: S1, TL: TL, cls: cls, rc: rc, Fa: c.Fa, Fv: c.Fv };
    p.SMS = c.Fa * Ss; p.SM1 = c.Fv * S1; p.SDS = 2 / 3 * p.SMS; p.SD1 = 2 / 3 * p.SM1; p.Ts = p.SD1 / p.SDS; p.T0 = 0.2 * p.Ts; p.pgaM = 0.4 * p.SMS;
    p.sdc = sdc(p.SDS, p.SD1, S1, rc); p.Ie = { I: 1, II: 1, III: 1.25, IV: 1.5 }[rc];
    var sys = SH.val('sSys').split('|').map(Number), R = sys[0], Ct = sys[1], x = sys[2], hn = SH.num('sH'), W = SH.num('sW');
    p.R = R; p.Ta = Ct * Math.pow(hn, x); var RI = R / p.Ie, T = p.Ta;
    var cs = p.SDS / RI, csMax = T <= TL ? p.SD1 / (T * RI) : p.SD1 * TL / (T * T * RI), csMin = Math.max(0.044 * p.SDS * p.Ie, 0.01); if (S1 >= 0.6) csMin = Math.max(csMin, 0.5 * S1 / RI);
    p.csRaw = cs; p.csMax = csMax; p.csMin = csMin; p.Cs = Math.max(Math.min(cs, csMax), csMin); p.V = p.Cs * W; p.W = W; p.k = T <= 0.5 ? 1 : T >= 2.5 ? 2 : 1 + (T - 0.5) / 2;
    p.notes = c.notes; p.fault = faults[0] || null; p.scen = faults.length ? scenario() : null;
    p.liq = $('#lOn').checked ? liquefaction(p.pgaM) : null;
    last = p; persist.save(); render(p);
  }

  function render(p) {
    $('#sEmpty').hidden = true; $('#sOut').hidden = false;
    var hi = p.sdc >= 'D';
    $('#sKpis').innerHTML = kpi('info', 'S<sub>DS</sub>', SH.fmt(p.SDS, 3) + '<small> g</small>', 'F<sub>a</sub> = ' + SH.fmt(p.Fa, 2)) + kpi('info', 'S<sub>D1</sub>', SH.fmt(p.SD1, 3) + '<small> g</small>', 'F<sub>v</sub> = ' + SH.fmt(p.Fv, 2)) +
      kpi(hi ? 'bad' : p.sdc === 'C' ? 'warn' : 'ok', t('Seismic design category', 'فئة التصميم الزلزالي'), p.sdc, t('Risk category ', 'فئة الخطورة ') + p.rc + ' · I<sub>e</sub> = ' + p.Ie) +
      kpi('', t('Base shear V', 'قوة القص القاعدي V'), SH.fmt(p.V, 0) + '<small> kN</small>', 'C<sub>s</sub> = ' + SH.fmt(p.Cs, 4) + ' · T<sub>a</sub> = ' + SH.fmt(p.Ta, 2) + ' s') +
      kpi(p.fault && p.fault.d < 15 ? 'bad' : p.fault && p.fault.d < 50 ? 'warn' : 'ok', t('Nearest active fault', 'أقرب صدع نشط'), p.fault ? SH.fmt(p.fault.d, 1) + '<small> km</small>' : '—', p.fault ? SH.esc(p.fault.name || KNAME[p.fault.k]) : t('none within 400 km', 'لا يوجد ضمن 400 كم'));
    var v = [];
    p.notes.forEach(function (n) { v.push(verdict(n[0], t('Code note', 'ملاحظة كودية'), n[1])); });
    if (p.sdc === 'E' || p.sdc === 'F') v.push(verdict('bad', t('Seismic design category ', 'فئة التصميم الزلزالي ') + p.sdc, t('Near-fault site (S1 ≥ 0.75). Many structural systems and irregularities are prohibited, and a dynamic analysis is expected.', 'موقع قريب من الصدع (S1 ≥ 0.75). كثير من الأنظمة الإنشائية وحالات عدم الانتظام ممنوعة، ويُتوقع إجراء تحليل ديناميكي.')));
    else if (p.sdc === 'D') v.push(verdict('warn', t('Seismic design category D', 'فئة التصميم الزلزالي D'), t('Special detailing is required. ELF is permitted only for regular structures with T < 3.5 Ts (= ', 'يلزم تفصيل خاص. طريقة القوة الجانبية المكافئة مسموحة فقط للمنشآت المنتظمة مع T < 3.5 Ts (= ') + SH.fmt(3.5 * p.Ts, 2) + ' s).'));
    else v.push(verdict('ok', t('Seismic design category ', 'فئة التصميم الزلزالي ') + p.sdc, t('Moderate requirements. Equivalent lateral force analysis is permitted.', 'متطلبات معتدلة. يُسمح بتحليل القوة الجانبية المكافئة.')));
    if (p.R === 5 && p.sdc >= 'D') v.push(verdict('bad', t('System not permitted', 'النظام غير مسموح'), t('Intermediate RC moment frames are not permitted in SDC D–F.', 'الأطر الخرسانية المتوسطة غير مسموحة في الفئات D–F.')));
    if (p.R === 3 && p.sdc >= 'C') v.push(verdict('bad', t('System not permitted', 'النظام غير مسموح'), t('Ordinary RC moment frames are not permitted in SDC C–F.', 'الأطر الخرسانية الاعتيادية غير مسموحة في الفئات C–F.')));
    if (p.R <= 2 && p.sdc >= 'C') v.push(verdict('bad', t('System not permitted', 'النظام غير مسموح'), t('Ordinary and unreinforced masonry walls are not permitted in SDC C and above.', 'جدران الطابوق الاعتيادية وغير المسلحة غير مسموحة في الفئة C فما فوق.')));
    if (p.liq && !p.liq.dry) v.push(verdict(p.liq.fs < 1 ? 'bad' : p.liq.fs < 1.3 ? 'warn' : 'ok', t('Liquefaction factor of safety ', 'معامل الأمان ضد التميع ') + (isFinite(p.liq.fs) ? SH.fmt(p.liq.fs, 2) : '∞'), p.liq.fs < 1 ? t('The layer is expected to liquefy. Shallow foundations are not suitable without ground improvement; consider piles or densification.', 'يُتوقع تميّع الطبقة. الأساسات السطحية غير مناسبة دون تحسين التربة؛ فكّر بالركائز أو التكثيف.') : p.liq.fs < 1.3 ? t('Marginal. Check more layers and consider settlement and lateral spreading.', 'حدّي. افحص طبقات أخرى وراعِ الهبوط والانتشار الجانبي.') : t('Liquefaction is not triggered at this depth for the design earthquake.', 'لا يُتوقع التميع عند هذا العمق للزلزال التصميمي.')));
    $('#sVerd').innerHTML = v.join('');
    plot(p); tables(p); narrative(p);
  }

  function plot(p) {
    var Ts = [], d = [], m = [], tmax = Math.max(4, Math.min(p.TL + 2, 10));
    for (var T = 0; T <= tmax + 1e-9; T += 0.01) { Ts.push(+T.toFixed(2)); var s = Sa(T, p); d.push(s); m.push(1.5 * s); }
    var c = SH.palette(), sa = Sa(p.Ta, p);
    SH.plot('sSpec', [
      { x: Ts, y: m, name: t('MCE (1.5 × design)', 'الأقصى المعتبر (1.5 × التصميمي)'), line: { color: c.text3, width: 1.5, dash: 'dash' }, hovertemplate: 'T %{x:.2f} s · Sa %{y:.3f} g<extra></extra>' },
      { x: Ts, y: d, name: t('Design spectrum', 'الطيف التصميمي'), line: { color: SH.css('--danger') || '#C0392B', width: 3 }, fill: 'tozeroy', fillcolor: SH.alpha(SH.css('--danger') || '#C0392B', .08), hovertemplate: 'T %{x:.2f} s · Sa %{y:.3f} g<extra></extra>' },
      { x: [p.Ta], y: [sa], mode: 'markers+text', name: 'T<sub>a</sub>', marker: { size: 11, color: c.accent, line: { color: '#fff', width: 2 } }, text: ['  T<sub>a</sub> = ' + p.Ta.toFixed(2) + ' s'], textposition: 'middle right', hovertemplate: 'T<sub>a</sub> %{x:.2f} s · Sa %{y:.3f} g<extra></extra>' }
    ], function () { return SH.plotLayout({ xaxis: { title: { text: t('Period T (s)', 'الزمن الدوري T (ثانية)') }, range: [0, tmax] }, yaxis: { title: { text: t('Spectral acceleration Sa (g)', 'التسارع الطيفي Sa (g)') }, rangemode: 'tozero' },
      shapes: [{ type: 'line', x0: p.T0, x1: p.T0, y0: 0, y1: p.SDS, line: { color: c.line2, width: 1, dash: 'dot' } }, { type: 'line', x0: p.Ts, x1: p.Ts, y0: 0, y1: p.SDS, line: { color: c.line2, width: 1, dash: 'dot' } }].concat(p.TL < tmax ? [{ type: 'line', x0: p.TL, x1: p.TL, y0: 0, y1: Sa(p.TL, p), line: { color: c.line2, width: 1, dash: 'dot' } }] : []),
      annotations: [{ x: p.T0, y: 0, text: 'T<sub>0</sub>', showarrow: false, yshift: -10, font: { size: 11, color: c.text2 } }, { x: p.Ts, y: 0, text: 'T<sub>s</sub>', showarrow: false, yshift: -10, font: { size: 11, color: c.text2 } }] }); }, { filename: 'shandal-design-spectrum' });
    $('#sSpecCap').innerHTML = 'T<sub>0</sub> = ' + SH.fmt(p.T0, 3) + ' s · T<sub>s</sub> = ' + SH.fmt(p.Ts, 3) + ' s · T<sub>L</sub> = ' + SH.fmt(p.TL, 1) + ' s · S<sub>a</sub>(T<sub>a</sub>) = ' + SH.fmt(sa, 3) + ' g. ' + t('ASCE 7-16 §11.4.6 shape.', 'شكل ASCE 7-16 §11.4.6.');
  }

  function tables(p) {
    $('#sPar').innerHTML = row(t('Site class · Vs30', 'صنف الموقع · Vs30'), p.cls + ' · ' + VS30[p.cls] + ' m/s') + row('S<sub>S</sub> · S<sub>1</sub>', SH.fmt(p.Ss, 3) + ' g · ' + SH.fmt(p.S1, 3) + ' g') + row('F<sub>a</sub> · F<sub>v</sub>', SH.fmt(p.Fa, 3) + ' · ' + SH.fmt(p.Fv, 3)) +
      row('S<sub>MS</sub> · S<sub>M1</sub>', SH.fmt(p.SMS, 3) + ' g · ' + SH.fmt(p.SM1, 3) + ' g') + row('S<sub>DS</sub> · S<sub>D1</sub>', '<b>' + SH.fmt(p.SDS, 3) + ' g · ' + SH.fmt(p.SD1, 3) + ' g</b>') + row('T<sub>0</sub> · T<sub>s</sub> · T<sub>L</sub>', SH.fmt(p.T0, 3) + ' · ' + SH.fmt(p.Ts, 3) + ' · ' + SH.fmt(p.TL, 1) + ' s') +
      row(t('PGA<sub>M</sub> (≈ S<sub>MS</sub>/2.5)', 'PGA<sub>M</sub> (≈ S<sub>MS</sub>/2.5)'), SH.fmt(p.pgaM, 3) + ' g') + row(t('Design category · I<sub>e</sub>', 'فئة التصميم · I<sub>e</sub>'), '<b>' + p.sdc + '</b> · ' + p.Ie);
    $('#sElf').innerHTML = row(t('System', 'النظام'), SH.selText('sSys')) + row('T<sub>a</sub> = C<sub>t</sub> h<sub>n</sub><sup>x</sup>', SH.fmt(p.Ta, 3) + ' s') + row('S<sub>DS</sub> / (R/I<sub>e</sub>)', SH.fmt(p.csRaw, 4)) +
      row(t('Upper limit', 'الحد الأعلى'), SH.fmt(p.csMax, 4)) + row(t('Lower limit', 'الحد الأدنى'), SH.fmt(p.csMin, 4)) + row('C<sub>s</sub>', '<b>' + SH.fmt(p.Cs, 4) + '</b>') + row('V = C<sub>s</sub> W', '<b>' + SH.fmt(p.V, 0) + ' kN</b> (W = ' + SH.fmt(p.W, 0) + ' kN)') + row(t('Distribution exponent k', 'أس التوزيع k'), SH.fmt(p.k, 2));
    var vs = VS30[p.cls];
    $('#sFaults').innerHTML = '<thead><tr><th>No.</th><th>' + t('Fault', 'الصدع') + '</th><th>' + t('Type', 'النوع') + '</th><th class="num">' + t('Distance km', 'المسافة كم') + '</th><th class="num">' + t('Trace km', 'طول الأثر كم') + '</th><th class="num">M<sub>w</sub></th><th class="num">' + t('Slip mm/yr', 'الانزلاق مم/سنة') + '</th><th class="num">PGA g</th></tr></thead><tbody>' +
      (faults.length ? faults.slice(0, 10).map(function (f, i) { var pga = bjf(f.Mw, f.d, vs, f.k); return '<tr><td>' + (i + 1) + '</td><td>' + SH.esc(f.name || t('Unnamed', 'غير مسمى')) + '</td><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + KCOL[f.k] + ';margin-inline-end:6px"></span>' + SH.esc(f.type || KNAME[f.k]) + '</td><td class="num">' + SH.fmt(f.d, 1) + '</td><td class="num">' + SH.fmt(f.len, 0) + '</td><td class="num">' + SH.fmt(f.Mw, 1) + '</td><td class="num">' + (f.rate != null ? SH.fmt(f.rate, 2) : '—') + '</td><td class="num">' + (f.d > 80 ? '<span class="muted" title="' + t('Beyond the 80 km validity of BJF97', 'خارج مدى صلاحية BJF97 البالغ 80 كم') + '">' + SH.fmt(pga, 3) + '*</span>' : SH.fmt(pga, 3)) + '</td></tr>'; }).join('') : '<tr><td colspan="8" class="muted">' + t('No fault data for this site. Place the site on the map.', 'لا توجد بيانات صدوع لهذا الموقع. حدد الموقع على الخريطة.') + '</td></tr>') + '</tbody>';
    var lq = p.liq; $('#sLiqPn').hidden = !lq;
    if (lq) $('#sLiq').innerHTML = lq.dry ? row(t('Result', 'النتيجة'), t('The layer is above the water table and cannot liquefy.', 'الطبقة فوق منسوب المياه ولا يمكن أن تتميع.')) :
      row('a<sub>max</sub> = PGA<sub>M</sub>', SH.fmt(p.pgaM, 3) + ' g') + row('σ<sub>v</sub> · σ′<sub>v</sub>', SH.fmt(lq.sv, 1) + ' · ' + SH.fmt(lq.sve, 1) + ' kPa') + row('r<sub>d</sub>', SH.fmt(lq.rd, 3)) + row('CSR = 0.65 a<sub>max</sub> (σ<sub>v</sub>/σ′<sub>v</sub>) r<sub>d</sub>', SH.fmt(lq.csr, 3)) +
        row('(N<sub>1</sub>)<sub>60cs</sub>', SH.fmt(lq.Ncs, 1)) + row('CRR<sub>7.5</sub>', isFinite(lq.crr) ? SH.fmt(lq.crr, 3) : t('≥ 30 blows · too dense to liquefy', '≥ 30 ضربة · أكثف من أن تتميع')) + row('MSF = 10<sup>2.24</sup>/M<sub>w</sub><sup>2.56</sup>', SH.fmt(lq.msf, 3)) + row(t('Factor of safety', 'معامل الأمان'), '<b>' + (isFinite(lq.fs) ? SH.fmt(lq.fs, 2) : '∞') + '</b>');
  }

  function narrative(p) {
    var f = p.fault, h = '';
    h += '<p>' + t('The site at ', 'يقع الموقع عند ') + '<span class="ltr">' + (site ? SH.fmtLatLon(site.lat, site.lon, 4) : '—') + '</span>' + t(' is evaluated for ', ' ويُقيَّم لـ') + '<b>' + SH.esc(SH.val('sProj') || t('the proposed structure', 'المنشأة المقترحة')) + '</b>' + t(' under risk category ', ' ضمن فئة الخطورة ') + p.rc + t(' on site class ', ' على صنف الموقع ') + p.cls + '. ' +
      t('Site amplification raises the mapped accelerations to S<sub>MS</sub> = ', 'يرفع تضخيم الموقع التسارعات المرجعية إلى S<sub>MS</sub> = ') + SH.fmt(p.SMS, 3) + ' g ' + t('and S<sub>M1</sub> = ', 'وS<sub>M1</sub> = ') + SH.fmt(p.SM1, 3) + ' g, ' + t('giving design values S<sub>DS</sub> = ', 'لتعطي قيم التصميم S<sub>DS</sub> = ') + '<b>' + SH.fmt(p.SDS, 3) + ' g</b> ' + t('and S<sub>D1</sub> = ', 'وS<sub>D1</sub> = ') + '<b>' + SH.fmt(p.SD1, 3) + ' g</b>.</p>';
    h += '<p>' + t('The structure falls in seismic design category ', 'تقع المنشأة في فئة التصميم الزلزالي ') + '<b>' + p.sdc + '</b>. ' + t('With an approximate period of ', 'وبزمن دوري تقريبي ') + SH.fmt(p.Ta, 2) + ' s ' + (p.Ta <= p.Ts ? t('the building sits on the spectral plateau, so short-period acceleration S<sub>DS</sub> governs. ', 'يقع المبنى على هضبة الطيف، لذا يحكم التسارع قصير الزمن S<sub>DS</sub>. ') : t('the building is in the velocity-controlled branch, so S<sub>D1</sub> governs. ', 'يقع المبنى في الفرع المحكوم بالسرعة، لذا يحكم S<sub>D1</sub>. ')) +
      t('The seismic response coefficient is C<sub>s</sub> = ', 'معامل الاستجابة الزلزالية C<sub>s</sub> = ') + SH.fmt(p.Cs, 4) + t(', which gives a design base shear of ', '، مما يعطي قوة قص قاعدي تصميمية ') + '<b>' + SH.fmt(p.V, 0) + ' kN</b>.</p>';
    if (f) h += '<p>' + t('The nearest mapped active fault is ', 'أقرب صدع نشط مرسوم هو ') + '<b>' + SH.esc(f.name || t('an unnamed fault', 'صدع غير مسمى')) + '</b> (' + KNAME[f.k] + ')' + t(', about ', ' على بعد نحو ') + SH.fmt(f.d, 1) + ' km' + t(' from the site. ', ' من الموقع. ') + (f.d < 15 ? t('This is a near-fault setting: check directivity and fling effects and consider a site-specific hazard study.', 'هذا وضع قريب من الصدع: تحقق من تأثيرات الاتجاهية والقذف وفكّر بدراسة خطر موقعية.') : '') + (p.scen ? ' ' + t('The controlling deterministic scenario is M<sub>w</sub> ', 'السيناريو الحتمي الحاكم هو M<sub>w</sub> ') + SH.fmt(p.scen.Mw, 1) + t(' on ', ' على ') + SH.esc(p.scen.name || t('an unnamed fault', 'صدع غير مسمى')) + t(' with a median site PGA of ', ' بقيمة PGA وسيطية للموقع ') + SH.fmt(p.scen.pga, 3) + ' g.' : '') + '</p>';
    h += '<p class="xsmall muted">' + t('This evaluation supports preliminary design. Final values must come from the governing national code and be signed off by a licensed structural engineer.', 'هذا التقييم يدعم التصميم الأولي. يجب أن تُؤخذ القيم النهائية من الكود الوطني الحاكم وأن يعتمدها مهندس إنشائي مرخص.') + '</p>';
    $('#sNarr').innerHTML = h;
  }

  $('#sFCsv').addEventListener('click', function () { var vs = VS30[SH.val('sClass')]; SH.csv('shandal-nearest-faults.csv', [['name', 'slip_type', 'distance_km', 'trace_km', 'Mw_WC94', 'slip_rate_mm_yr', 'pga_median_g_BJF97']].concat(faults.slice(0, 50).map(function (f) { return [f.name, f.type, f.d.toFixed(2), f.len.toFixed(1), f.Mw.toFixed(2), f.rate, bjf(f.Mw, f.d, vs, f.k).toFixed(4)]; }))); });
  $('#sRun').addEventListener('click', function () { if (!site) { var la = SH.num('sLat'), lo = SH.num('sLon'); if (!isNaN(la) && !isNaN(lo)) setSite(la, lo, true).then(run); else run(); } else run(); });
  $('#sDemo').addEventListener('click', function () {
    var v = { sProj: t('Al-Andalus housing complex', 'مجمع الأندلس السكني'), sSs: 0.6, sS1: 0.24, sTL: 8, sClass: 'D', sRisk: 'II', sH: 15, sW: 20000, lZ: 6, lGw: 2, lG: 19, lN: 12, lFC: 10, lM: 6.5 };
    for (var k in v) $('#' + k).value = v[k]; $('#sSys').selectedIndex = 1; $('#lOn').checked = true; $('#lBox').hidden = false;
    setSite(33.3152, 44.3661, true).then(run);
  });
  document.addEventListener('sh:beforereport', function (e) { if (!last) { e.preventDefault(); SH.toast(t('Evaluate the site first.', 'قيّم الموقع أولاً.'), 'warn'); } else if (map) map.invalidateSize(); });
  document.addEventListener('sh:redraw', function () { if (last) plot(last); });
  var la0 = SH.num('sLat'), lo0 = SH.num('sLon'); if (!isNaN(la0) && !isNaN(lo0) && SH.val('sLat') !== '') setSite(la0, lo0, true);
})();
