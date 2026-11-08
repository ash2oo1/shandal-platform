/* Field Survey Companion — works without a connection after the first visit: stations with averaged GPS fixes, lithology,
   unit and description, planar and linear measurements typed or read from the phone (Fisher-averaged, corrected to true north
   with IGRF-14), samples and photos kept on the device (IndexedDB). When the device is back online every station is completed
   automatically with place name, ground elevation and the mapped geological unit. Outputs: station map, traverse plan with
   strike-and-dip symbols, lower-hemisphere equal-area stereonet, photo sheet, PDF report, CSV, GeoJSON, KML and a full
   backup; measurements can be sent to the Stereonet Lab and any station to the Site Report. */
(function () {
  'use strict';
  var t = SH.t, $ = SH.$, $$ = SH.$$, F = SH.fmt, E = SH.esc, L = window.L, G = window.EG, GM = SH.gm, AR = SH.lang === 'ar';
  var KEY = 'shandal_fc', db = null, decl = null;
  var MT = { S0: ['Bedding', 'تطبق', 'P', '#8C6D1F'], J: ['Joint', 'فاصل', 'P', '#2E6FBF'], F: ['Fault', 'صدع', 'P', '#C0392B'], S1: ['Foliation / cleavage', 'تورق / انفصام', 'P', '#7A4F9A'], V: ['Vein / dyke', 'عرق / قاطع', 'P', '#E67E22'], L: ['Lineation', 'تخطط', 'L', '#2E8B57'], FA: ['Fold axis', 'محور طية', 'L', '#1B232B'], SL: ['Slickenline', 'تخدش صدعي', 'L', '#B03A2E'] };
  var LITH = {}; $$('#fcLith option').forEach(function (o) { LITH[o.value] = o.textContent; });
  var mtName = function (k) { return t(MT[k][0], MT[k][1]); };

  /* ------------------------------------------------------------------ storage */
  var S = (function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } })();
  function ask(msg, cb) { Promise.resolve(SH.confirm(msg)).then(function (v) { if (v) cb(); }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  if (!S || !S.P) { var id0 = uid(); S = { cur: id0, P: {} }; S.P[id0] = { name: t('Field survey ', 'مسح حقلي ') + new Date().toISOString().slice(0, 10), st: [] }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { SH.toast(t('The device storage is full. Download a backup and delete old surveys.', 'ذاكرة الجهاز ممتلئة. نزّل نسخة احتياطية واحذف المسوح القديمة.'), 'bad'); } }
  var P = function () { return S.P[S.cur]; };
  function idb() { return db ? Promise.resolve(db) : new Promise(function (res, rej) { var r = indexedDB.open('shandal_fc', 1); r.onupgradeneeded = function () { r.result.createObjectStore('ph'); }; r.onsuccess = function () { db = r.result; res(db); }; r.onerror = function () { rej(r.error); }; }); }
  function pPut(id, v) { return idb().then(function (d) { return new Promise(function (res, rej) { var tx = d.transaction('ph', 'readwrite'); tx.objectStore('ph').put(v, id); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); }); }
  function pGet(id) { return idb().then(function (d) { return new Promise(function (res) { var q = d.transaction('ph').objectStore('ph').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }); }
  function pDel(id) { return idb().then(function (d) { d.transaction('ph', 'readwrite').objectStore('ph').delete(id); }).catch(function () {}); }
  var urls = {}; function purl(id) { if (urls[id]) return Promise.resolve(urls[id]); return pGet(id).then(function (b) { if (!b) return null; urls[id] = URL.createObjectURL(b); return urls[id]; }); }

  /* ------------------------------------------------------------------ projects */
  function projUi() { $('#fcProj').innerHTML = Object.keys(S.P).map(function (k) { return '<option value="' + k + '"' + (k === S.cur ? ' selected' : '') + '>' + E(S.P[k].name) + ' (' + S.P[k].st.length + ')</option>'; }).join(''); $('#fcName').value = P().name; }
  $('#fcProj').addEventListener('change', function () { S.cur = this.value; save(); clearForm(); all(); });
  $('#fcName').addEventListener('change', function () { P().name = this.value.trim() || P().name; save(); projUi(); });
  $('#fcNew').addEventListener('click', function () { var id = uid(); S.P[id] = { name: t('Field survey ', 'مسح حقلي ') + new Date().toISOString().slice(0, 10), st: [] }; S.cur = id; save(); clearForm(); all(); });
  $('#fcDel').addEventListener('click', function () { var p = P(); ask(t('Delete the survey “', 'احذف المسح «') + p.name + t('” with its ', '» مع ') + p.st.length + t(' stations and photos from this device? Download a backup first if you need it.', ' محطة وصوره من هذا الجهاز؟ نزّل نسخة احتياطية أولاً إن احتجتها.'), function () { p.st.forEach(function (s) { (s.ph || []).forEach(pDel); }); delete S.P[S.cur]; var ks = Object.keys(S.P); if (!ks.length) { var id = uid(); S.P[id] = { name: t('Field survey', 'مسح حقلي'), st: [] }; ks = [id]; } S.cur = ks[0]; save(); clearForm(); all(); }); });

  /* ------------------------------------------------------------------ station form */
  var D = null, editIdx = -1;
  function blank() { var n = P().st.length + 1; return { id: 'S' + String(n).padStart(2, '0'), t: null, lat: null, lon: null, acc: null, alt: null, lith: '', unit: '', desc: '', m: [], s: [], ph: [] }; }
  function clearForm() { D = blank(); editIdx = -1; fillForm(); }
  function fillForm() { $('#fcId').value = D.id; $('#fcLith').value = D.lith || ''; $('#fcLat').value = D.lat != null ? D.lat.toFixed(6) : ''; $('#fcLon').value = D.lon != null ? D.lon.toFixed(6) : ''; $('#fcAcc').value = D.acc != null ? D.acc.toFixed(1) : ''; $('#fcUnit').value = D.unit || ''; $('#fcDesc').value = D.desc || ''; lists(); $('.ws-side').classList.toggle('fc-edit', editIdx >= 0); $('#fcSave').lastChild.textContent = editIdx >= 0 ? t('Update station', 'حدّث المحطة') : t('Save station', 'احفظ المحطة'); }
  function lists() {
    $('#fcMs').innerHTML = D.m.map(function (q, i) { return '<div class="fc-it"><span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + MT[q.k][3] + ';margin-inline-end:6px"></span>' + mtName(q.k) + '</span><b class="ltr">' + (MT[q.k][2] === 'P' ? GM.att(q.a, q.b) : String(Math.round(q.b)).padStart(2, '0') + '→' + String(Math.round(q.a) % 360).padStart(3, '0')) + (q.src === 'phone' ? ' 📱' : '') + '</b><button type="button" class="btn btn-line btn-xs" data-dm="' + i + '" aria-label="delete">×</button></div>'; }).join('');
    $('#fcSs').innerHTML = D.s.map(function (q, i) { return '<div class="fc-it"><b class="ltr">' + E(q.code) + '</b><span>' + E(q.type) + (q.note ? ' · ' + E(q.note) : '') + '</span><button type="button" class="btn btn-line btn-xs" data-ds="' + i + '" aria-label="delete">×</button></div>'; }).join('');
    var host = $('#fcPhs'); host.innerHTML = D.ph.map(function (id, i) { return '<div><img alt="" data-pid="' + id + '"><button type="button" data-dp="' + i + '" aria-label="delete">×</button></div>'; }).join('');
    $$('#fcPhs img').forEach(function (im) { purl(im.getAttribute('data-pid')).then(function (u) { if (u) im.src = u; }); });
  }
  $('#fcMs').addEventListener('click', function (e) { var b = e.target.closest('[data-dm]'); if (b) { D.m.splice(+b.getAttribute('data-dm'), 1); lists(); } });
  $('#fcSs').addEventListener('click', function (e) { var b = e.target.closest('[data-ds]'); if (b) { D.s.splice(+b.getAttribute('data-ds'), 1); lists(); } });
  $('#fcPhs').addEventListener('click', function (e) { var b = e.target.closest('[data-dp]'); if (b) { var id = D.ph.splice(+b.getAttribute('data-dp'), 1)[0]; if (editIdx < 0) pDel(id); lists(); } });
  function readForm() { D.id = $('#fcId').value.trim() || D.id; D.lith = $('#fcLith').value; D.unit = $('#fcUnit').value.trim(); D.desc = $('#fcDesc').value.trim(); var la = parseFloat($('#fcLat').value), lo = parseFloat($('#fcLon').value), ac = parseFloat($('#fcAcc').value); D.lat = isFinite(la) ? la : null; D.lon = isFinite(lo) ? lo : null; D.acc = isFinite(ac) ? ac : null; }
  $('#fcGps').addEventListener('click', function () { var b = this; b.disabled = true; var lab = b.lastChild.textContent; b.lastChild.textContent = t('Averaging satellite fixes…', 'جارٍ حساب معدل قراءات الأقمار…');
    SH.gpsFix({ ms: 20000, target: 5 }).then(function (f) { D.lat = f.lat; D.lon = f.lon; D.acc = f.acc; D.alt = f.alt; fillFormKeep(); decl0(f.lat, f.lon); SH.toast(t('Position fixed to ±', 'ثُبّت الموقع بدقة ±') + F(f.acc, 0) + t(' m from ', ' م من ') + f.used + t(' readings.', ' قراءة.'), 'ok'); }).catch(function (e) { SH.toast(e.message, 'bad'); }).then(function () { b.disabled = false; b.lastChild.textContent = lab; }); });
  function fillFormKeep() { $('#fcLat').value = D.lat.toFixed(6); $('#fcLon').value = D.lon.toFixed(6); $('#fcAcc').value = D.acc != null ? D.acc.toFixed(1) : ''; }
  $('#fcAddM').addEventListener('click', function () { var k = $('#fcMt').value, a, b, src = 'typed';
    if (live && cur) { if (MT[k][2] !== 'P') return SH.toast(t('The phone reads planes only; type lines by hand.', 'يقرأ الهاتف السطوح فقط؛ اكتب الخطوط يدوياً.'), 'warn'); a = cur.dd; b = cur.dip; src = 'phone'; }
    else { a = parseFloat($('#fcA').value); b = parseFloat($('#fcB').value); if (!(a >= 0 && a <= 360 && b >= 0 && b <= 90)) return SH.toast(t('Enter a direction 0–360° and a dip 0–90°.', 'أدخل اتجاهاً 0–360° وميلاً 0–90°.'), 'warn'); }
    D.m.push({ k: k, a: Math.round(GM.norm(a) * 10) / 10, b: Math.round(b * 10) / 10, src: src, a95: src === 'phone' && cur ? cur.a95 : null }); $('#fcA').value = ''; $('#fcB').value = ''; lists(); });
  $('#fcAddS').addEventListener('click', function () { readForm(); var n = D.s.length; D.s.push({ code: D.id + '-' + String.fromCharCode(65 + n), type: $('#fcSt').selectedOptions[0].textContent, note: $('#fcSn').value.trim() }); $('#fcSn').value = ''; lists(); });
  $('#fcPh').addEventListener('change', function () { var fs = Array.prototype.slice.call(this.files || []); this.value = ''; fs.reduce(function (p, f) { return p.then(function () { return shrink(f).then(function (b) { var id = uid(); return pPut(id, b).then(function () { D.ph.push(id); }); }); }); }, Promise.resolve()).then(lists).catch(function (e) { SH.toast(e.message, 'bad'); }); });
  function shrink(f) { return createImageBitmap(f).then(function (bm) { var k = Math.min(1, 1600 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.85); }); }); }
  $('#fcSave').addEventListener('click', function () { readForm(); if (D.lat == null || D.lon == null) return SH.toast(t('Fix the position first (GPS or coordinates).', 'ثبّت الموقع أولاً (GPS أو الإحداثيات).'), 'warn');
    if (!D.t) D.t = new Date().toISOString(); var st = JSON.parse(JSON.stringify(D)); if (editIdx >= 0) { var old = P().st[editIdx]; if (old.lat !== st.lat || old.lon !== st.lon) st.web = null; else st.web = old.web; P().st[editIdx] = st; } else P().st.push(st);
    save(); SH.toast(t('Station ', 'المحطة ') + st.id + t(' saved on this device.', ' حُفظت على هذا الجهاز.'), 'ok'); stopLive(); clearForm(); all(); enrich(); });
  $('#fcClear').addEventListener('click', function () { stopLive(); clearForm(); });

  /* ------------------------------------------------------------------ phone compass */
  var live = false, buf = [], cur = null;
  function decl0(la, lo) { if (!SH.igrf || !isFinite(la)) return; SH.igrf.load().then(function () { var n = new Date(); decl = SH.igrf.field(la, lo, 0, n.getFullYear() + (n.getMonth() + .5) / 12).D; }).catch(function () {}); }
  function onOri(e) {
    if (!live) return; var al = e.alpha, be = e.beta, ga = e.gamma; if (typeof e.webkitCompassHeading === 'number') al = 360 - e.webkitCompassHeading; if (al == null || be == null || ga == null) return;
    var R = GM.R, a = R(al), b = R(be), g = R(ga), nx = Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g), ny = Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g), nz = Math.cos(b) * Math.cos(g);
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    var dd = GM.norm(GM.D(Math.atan2(nx, ny)) + (decl || 0)), dip = GM.D(Math.acos(Math.max(-1, Math.min(1, nz)))); buf.push(GM.poleVec(dd, dip)); if (buf.length > 30) buf.shift();
    var f = GM.fisher(buf), pl = GM.poleToPlane(f.v); cur = { dd: pl.dd, dip: pl.dip, a95: f.a95 }; $('#fcLdd').textContent = String(Math.round(pl.dd) % 360).padStart(3, '0') + '°'; $('#fcLdip').textContent = Math.round(pl.dip) + '°'; $('#fcLa95').textContent = isFinite(f.a95) ? f.a95.toFixed(1) + '°' : '—';
  }
  function stopLive() { live = false; cur = null; buf = []; $('#fcLive').hidden = true; $('#fcLhint').hidden = true; window.removeEventListener('deviceorientationabsolute', onOri); window.removeEventListener('deviceorientation', onOri); $('#fcPhone').setAttribute('aria-pressed', 'false'); }
  $('#fcPhone').addEventListener('click', function () {
    if (live) return stopLive();
    function go() { live = true; buf = []; $('#fcLive').hidden = false; $('#fcLhint').hidden = false; $('#fcPhone').setAttribute('aria-pressed', 'true'); if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri); else window.addEventListener('deviceorientation', onOri);
      if (decl == null) SH.toast(t('Fix the position first so the readings are corrected to true north.', 'ثبّت الموقع أولاً لتُصحح القراءات إلى الشمال الجغرافي.'), 'warn', 5000); }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') go(); }).catch(function () {}); else if (typeof DeviceOrientationEvent === 'undefined') SH.toast(t('This device has no orientation sensor.', 'لا يملك هذا الجهاز متحسس اتجاه.'), 'warn'); else go();
  });

  /* ------------------------------------------------------------------ online completion */
  var running = false;
  function net() { var on = navigator.onLine, pend = P().st.filter(function (s) { return !s.web; }).length; $('#fcNet').classList.toggle('off', !on); $('#fcNet span').textContent = (on ? t('Online', 'متصل') : t('Offline: everything is saved on this device', 'غير متصل: كل شيء محفوظ على هذا الجهاز')) + (pend ? t(' · stations waiting for map data: ', ' · محطات تنتظر بيانات الخرائط: ') + pend : ''); }
  function enrich() {
    net(); if (running || !navigator.onLine) return; var q = []; Object.keys(S.P).forEach(function (k) { S.P[k].st.forEach(function (s) { if (!s.web) q.push(s); }); }); if (!q.length) return; running = true;
    var one = function () { var s = q.shift(); if (!s) { running = false; save(); all(); return; } var p = { lat: s.lat, lon: s.lon };
      Promise.all([
        SH.getJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=' + p.lat.toFixed(5) + '&lon=' + p.lon.toFixed(5) + '&accept-language=' + (AR ? 'ar,en' : 'en'), { timeout: 12000 }).then(function (j) { var a = j.address || {}; return [a.village || a.town || a.city || a.hamlet || a.county || '', a.state || ''].filter(Boolean).join(AR ? '، ' : ', '); }).catch(function () { return null; }),
        SH.getJSON('https://api.open-meteo.com/v1/elevation?latitude=' + p.lat.toFixed(5) + '&longitude=' + p.lon.toFixed(5), { timeout: 12000 }).then(function (j) { return j.elevation && j.elevation[0]; }).catch(function () { return null; }),
        SH.getJSON('https://macrostrat.org/api/v2/geologic_units/map?lat=' + p.lat.toFixed(5) + '&lng=' + p.lon.toFixed(5), { timeout: 15000 }).then(function (j) { var a = ((j.success && j.success.data) || []).filter(function (u) { return u.name; }); var o = { large: 0, medium: 1, small: 2, tiny: 3 }; a.sort(function (x, y) { return (o[x.scale] || 4) - (o[y.scale] || 4); }); return a[0] ? { n: a[0].name, age: a[0].b_int_name === a[0].t_int_name ? a[0].b_int_name : a[0].b_int_name + ' – ' + a[0].t_int_name, lith: a[0].lith || '' } : null; }).catch(function () { return null; })
      ]).then(function (r) { if (r[0] == null && r[1] == null && r[2] == null && !navigator.onLine) { running = false; return; } s.web = { place: r[0] || '', elev: r[1], unit: r[2], ts: new Date().toISOString() }; save(); net(); setTimeout(one, 1200); });
    }; one();
  }
  window.addEventListener('online', enrich); window.addEventListener('offline', net);

  /* ------------------------------------------------------------------ outputs */
  var map = SH.map('fcMap', { zoom: 6, base: 'topo', center: [33.3, 44.4] }), lay = null;
  function all() { projUi(); kpis(); table(); mapLay(); plan(); stereo(); photos(); net(); }
  function allM() { var a = []; P().st.forEach(function (s) { s.m.forEach(function (q) { a.push(Object.assign({ st: s.id }, q)); }); }); return a; }
  function kpis() { var st = P().st, m = allM(), sa = st.reduce(function (a, s) { return a + s.s.length; }, 0), ph = st.reduce(function (a, s) { return a + s.ph.length; }, 0), len = 0; for (var i = 1; i < st.length; i++) len += SH.dist(st[i - 1], st[i]);
    $('#fcKpis').innerHTML = G.kpi('info', t('Stations', 'المحطات'), st.length, len ? t('traverse ', 'المسار ') + F(len / 1000, 2) + t(' km', ' كم') : '') + G.kpi('', t('Measurements', 'القياسات'), m.length, m.filter(function (q) { return q.src === 'phone'; }).length + t(' from the phone', ' من الهاتف')) + G.kpi('', t('Samples', 'العينات'), sa, '') + G.kpi('', t('Photos', 'الصور'), ph, t('on this device', 'على هذا الجهاز'));
    $('#fcVerd').innerHTML = st.length ? '' : G.verdict('info', t('Start the survey', 'ابدأ المسح'), t('Fix your position, describe the outcrop, add measurements, samples and photos, then save the station. Everything stays on this device, even without a connection; when the connection returns each station is completed with place name, elevation and the mapped geological unit.', 'ثبّت موقعك، وصف المكشف، وأضف القياسات والعينات والصور، ثم احفظ المحطة. يبقى كل شيء على هذا الجهاز حتى دون اتصال، وحين يعود الاتصال تكتمل كل محطة باسم المكان والارتفاع والوحدة الجيولوجية المرسومة.')); }
  function table() {
    var st = P().st; $('#fcTbl').innerHTML = '<thead><tr><th>' + t('Station', 'المحطة') + '</th><th>' + t('Time', 'الوقت') + '</th><th>' + t('Position', 'الموقع') + '</th><th>' + t('Rock and unit', 'الصخر والوحدة') + '</th><th>' + t('Measurements', 'القياسات') + '</th><th>' + t('From the maps', 'من الخرائط') + '</th><th data-noexport></th></tr></thead><tbody>' +
      st.map(function (s, i) { return '<tr data-ed="' + i + '"><td><b>' + E(s.id) + '</b></td><td class="ltr xsmall">' + (s.t ? s.t.slice(0, 16).replace('T', ' ') : '') + '</td><td class="ltr xsmall">' + s.lat.toFixed(5) + ', ' + s.lon.toFixed(5) + (s.acc != null ? ' ±' + F(s.acc, 0) + ' m' : '') + '</td><td>' + E(LITH[s.lith] && s.lith ? LITH[s.lith] : '') + (s.unit ? '<br><span class="xsmall muted">' + E(s.unit) + '</span>' : '') + '</td><td class="ltr xsmall">' + s.m.map(function (q) { return q.k + ' ' + (MT[q.k][2] === 'P' ? GM.att(q.a, q.b) : Math.round(q.b) + '→' + Math.round(q.a)); }).join('<br>') + '</td><td class="xsmall">' + (s.web ? E(s.web.place || '') + (s.web.elev != null ? ' · ' + F(s.web.elev, 0) + t(' m', ' م') : '') + (s.web.unit ? '<br>' + E(s.web.unit.n) + ' (' + E(s.web.unit.age) + ')' : '') : '<span class="muted">' + t('waiting for connection', 'بانتظار الاتصال') + '</span>') + '</td><td data-noexport><button type="button" class="btn btn-line btn-xs" data-rm="' + i + '" aria-label="delete">×</button></td></tr>'; }).join('') + '</tbody>';
  }
  $('#fcTbl').addEventListener('click', function (e) { var r = e.target.closest('[data-rm]'); if (r) { e.stopPropagation(); var i = +r.getAttribute('data-rm'), s = P().st[i]; ask(t('Delete station ', 'احذف المحطة ') + s.id + '?', function () { s.ph.forEach(pDel); P().st.splice(i, 1); save(); clearForm(); all(); }); return; }
    var row = e.target.closest('[data-ed]'); if (!row) return; editIdx = +row.getAttribute('data-ed'); D = JSON.parse(JSON.stringify(P().st[editIdx])); fillForm(); sel = editIdx; if (map) map.setView([D.lat, D.lon], Math.max(map.getZoom(), 14)); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  var sel = -1;
  function mapLay() { if (!map) return; if (lay) map.removeLayer(lay); lay = L.layerGroup().addTo(map); var st = P().st; if (!st.length) return; var ll = st.map(function (s) { return [s.lat, s.lon]; });
    if (ll.length > 1) L.polyline(ll, { color: '#B08A3E', weight: 2, dashArray: '6 5' }).addTo(lay); st.forEach(function (s, i) { L.marker([s.lat, s.lon], { icon: SH.pin('<b style="font-size:10px">' + E(s.id) + '</b>', 'mk mk-site', [30, 18]) }).bindTooltip(E(s.id) + (s.lith ? ' · ' + E(LITH[s.lith]) : '')).on('click', function () { $('#fcTbl [data-ed="' + i + '"]').click(); }).addTo(lay); });
    map.fitBounds(L.latLngBounds(ll).pad(0.3), { maxZoom: 16 }); }
  /* traverse plan: local metres, strike-and-dip symbols */
  function plan() {
    var st = P().st, svg = $('#fcPlan'); if (!st.length) { svg.innerHTML = ''; $('#fcPlanCap').textContent = ''; return; }
    var lat0 = st.reduce(function (a, s) { return a + s.lat; }, 0) / st.length, lon0 = st.reduce(function (a, s) { return a + s.lon; }, 0) / st.length, kx = 111320 * Math.cos(SH.rad(lat0)), ky = 110574;
    var P2 = st.map(function (s) { return { s: s, x: (s.lon - lon0) * kx, y: (s.lat - lat0) * ky }; }), xs = P2.map(function (p) { return p.x; }), ys = P2.map(function (p) { return p.y; }), span = Math.max(50, Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys)) * 1.25;
    var cx = (Math.max.apply(null, xs) + Math.min.apply(null, xs)) / 2, cy = (Math.max.apply(null, ys) + Math.min.apply(null, ys)) / 2, W = 900, X0 = 70, Y0 = 30, PW = 760, PH = 500, k = Math.min(PW, PH) / span;
    var X = function (x) { return X0 + PW / 2 + (x - cx) * k; }, Y = function (y) { return Y0 + PH / 2 - (y - cy) * k; }, s = '<rect width="900" height="700" fill="#fff"/><rect x="' + X0 + '" y="' + Y0 + '" width="' + PW + '" height="' + PH + '" fill="#FBFAF6" stroke="' + G.INK + '" stroke-width="1.4"/>';
    var U0 = SH.toUTM(lat0, lon0), st0 = G.step(0, span, 5), ex0 = U0.E - (PW / 2 / k) + (cx), ny0 = U0.N - (PH / 2 / k) + (cy);
    G.ticks(ex0, ex0 + PW / k, st0).forEach(function (E1) { var x = X0 + (E1 - ex0) * k; if (x < X0 + 20 || x > X0 + PW - 20) return; s += '<line x1="' + x + '" x2="' + x + '" y1="' + (Y0 + PH) + '" y2="' + (Y0 + PH + 5) + '" stroke="' + G.INK + '"/>' + G.tx(x, Y0 + PH + 18, F(E1, 0), { anchor: 'middle', fs: 10.5 }); });
    G.ticks(ny0, ny0 + PH / k, st0).forEach(function (N1) { var y = Y0 + PH - (N1 - ny0) * k; if (y < Y0 + 14 || y > Y0 + PH - 14) return; s += '<line x1="' + (X0 - 5) + '" x2="' + X0 + '" y1="' + y + '" y2="' + y + '" stroke="' + G.INK + '"/>' + G.tx(X0 - 8, y + 4, F(N1, 0), { anchor: 'end', fs: 10.5 }); });
    if (P2.length > 1) s += '<path d="' + P2.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join('') + '" fill="none" stroke="#B08A3E" stroke-width="2" stroke-dasharray="6 5"/>';
    P2.forEach(function (p) { var x = X(p.x), y = Y(p.y), m = p.s.m.filter(function (q) { return MT[q.k][2] === 'P'; })[0];
      if (m) { var str = GM.R(m.a - 90), dx = Math.sin(str) * 16, dy = -Math.cos(str) * 16, ddx = Math.sin(GM.R(m.a)) * 8, ddy = -Math.cos(GM.R(m.a)) * 8, col = MT[m.k][3]; s += '<line x1="' + (x - dx) + '" y1="' + (y - dy) + '" x2="' + (x + dx) + '" y2="' + (y + dy) + '" stroke="' + col + '" stroke-width="2.6"/><line x1="' + x + '" y1="' + y + '" x2="' + (x + ddx) + '" y2="' + (y + ddy) + '" stroke="' + col + '" stroke-width="2.6"/>' + G.tx(x + ddx * 2 + 2, y + ddy * 2 + 4, String(Math.round(m.b)), { fs: 11, fw: 800, fill: col, halo: 1 }); }
      else s += '<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="#fff" stroke="' + G.INK + '" stroke-width="1.6"/>';
      s += G.tx(x + 8, y - 8, p.s.id, { fs: 11.5, fw: 800, halo: 1 }); });
    var nx = X0 + PW - 30, ny = Y0 + 14; s += '<path d="M' + nx + ' ' + (ny + 6) + 'l-9 32l9 -7z" fill="' + G.INK + '"/><path d="M' + nx + ' ' + (ny + 6) + 'l9 32l-9 -7z" fill="#fff" stroke="' + G.INK + '"/>' + G.tx(nx, ny + 2, 'N', { anchor: 'middle', fw: 800, fs: 13 });
    s += G.scaleBar(X0, Y0 + PH + 48, k, 170) + G.tx(X0 + PW, Y0 + PH + 56, 'UTM zone ' + U0.zone + U0.hemi + ' (WGS 84), metres; grid north', { anchor: 'end', fs: 10.5, fill: G.MUT });
    var used = {}; P2.forEach(function (p) { var m = p.s.m.filter(function (q) { return MT[q.k][2] === 'P'; })[0]; if (m) used[m.k] = 1; }); var it = [{ name: 'Station', col: G.INK, mark: 'o', noLine: 1 }, { name: 'Traverse in order of time', col: '#B08A3E', dash: '6 5' }].concat(Object.keys(used).map(function (k2) { return { name: MT[k2][0] + ': strike line, dip tick and dip value', col: MT[k2][3] }; }));
    var ly = Y0 + PH + 86; it.forEach(function (q, i) { var x = X0 + (i % 2) * 380, y = ly + Math.floor(i / 2) * 20; s += G.sym(q, x + 10, y - 4) + G.tx(x + 26, y, q.name, { fs: 11.5 }); });
    var HH = ly + Math.ceil(it.length / 2) * 20 + 8; svg.setAttribute('viewBox', '0 0 900 ' + HH); svg.innerHTML = s.replace('height="700"', 'height="' + HH + '"');
    $('#fcPlanCap').textContent = t('Stations drawn to scale in UTM coordinates in the order they were visited, with the first planar measurement of each station shown by the geological map symbol: the long line is the strike, the short tick points down-dip and the number is the dip.', 'المحطات مرسومة بالمقياس بإحداثيات UTM بترتيب زيارتها، مع أول قياس سطحي في كل محطة بالرمز الجيولوجي: الخط الطويل هو المضرب، والشرطة القصيرة تشير إلى اتجاه الميل، والرقم هو مقدار الميل.');
  }
  function stereo() {
    var m = allM(), svg = $('#fcNetF'); if (!m.length) { svg.innerHTML = ''; $('#fcNetCap').textContent = ''; return; }
    var cx = 320, cy = 300, Rr = 240, pr = function (tr, pl) { var r = Rr * Math.SQRT2 * Math.sin(GM.R(90 - pl) / 2), a = GM.R(tr); return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; }, s = '<rect width="640" height="720" fill="#fff"/><circle cx="' + cx + '" cy="' + cy + '" r="' + Rr + '" fill="#fff" stroke="' + G.INK + '" stroke-width="1.6"/>';
    for (var a = 0; a < 360; a += 10) { var p1 = pr(a, 0), p2 = [cx + (Rr - (a % 90 ? 5 : 10)) * Math.sin(GM.R(a)), cy - (Rr - (a % 90 ? 5 : 10)) * Math.cos(GM.R(a))]; s += '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" stroke="' + G.INK + '"/>'; }
    s += '<line x1="' + (cx - 6) + '" x2="' + (cx + 6) + '" y1="' + cy + '" y2="' + cy + '" stroke="' + G.INK + '"/><line y1="' + (cy - 6) + '" y2="' + (cy + 6) + '" x1="' + cx + '" x2="' + cx + '" stroke="' + G.INK + '"/>' + G.tx(cx, cy - Rr - 10, 'N', { anchor: 'middle', fw: 800, fs: 14 });
    m.forEach(function (q) { var col = MT[q.k][3];
      if (MT[q.k][2] === 'P') { var path = ''; for (var i = 0; i <= 36; i++) { var ang = -90 + i * 5, v = GM.unit(GM.add(GM.mul(GM.lineVec(q.a, q.b), Math.cos(GM.R(ang))), GM.mul(GM.lineVec(q.a - 90, 0), Math.sin(GM.R(ang))))), l = GM.vecLine(v); var pt = pr(l.trend, l.plunge); path += (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); } s += '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="1.1" opacity=".55"/>'; var pp = pr(q.a + 180, 90 - q.b); s += '<circle cx="' + pp[0] + '" cy="' + pp[1] + '" r="4.5" fill="' + col + '" stroke="#fff"/>'; }
      else { var lp = pr(q.a, q.b); s += '<path d="M' + lp[0] + ' ' + (lp[1] - 6) + 'l5.5 9.5h-11z" fill="' + col + '" stroke="#fff"/>'; } });
    var used = {}; m.forEach(function (q) { used[q.k] = (used[q.k] || 0) + 1; }); var it = Object.keys(used).map(function (k2) { return { name: MT[k2][0] + (MT[k2][2] === 'P' ? ' (great circle and pole)' : ' (line)') + ', n = ' + used[k2], col: MT[k2][3], mark: MT[k2][2] === 'P' ? 'o' : 't', mfill: MT[k2][3] }; });
    var ly = cy + Rr + 34; it.forEach(function (q, i) { var x = 40 + (i % 2) * 300, y = ly + Math.floor(i / 2) * 20; s += G.sym(q, x + 10, y - 4) + G.tx(x + 26, y, q.name, { fs: 11.5 }); });
    var HH = ly + Math.ceil(it.length / 2) * 20 + 24; s += G.tx(40, HH - 10, 'Lower hemisphere, equal-area (Schmidt) projection; directions to true north.', { fs: 11, fill: G.MUT });
    svg.setAttribute('viewBox', '0 0 640 ' + HH); svg.innerHTML = s.replace('height="720"', 'height="' + HH + '"');
    $('#fcNetCap').textContent = t('All planes and lines of the survey on one net. Clusters of poles show the main sets of bedding and joints; the Stereonet Lab gives their statistics and the kinematic checks against a slope face.', 'كل سطوح المسح وخطوطه على شبكة واحدة. تُظهر تجمعات الأقطاب المجموعات الرئيسية للتطبق والفواصل، ويعطي مختبر الإسقاط المجسم إحصاءاتها والفحوص الحركية مقابل وجه منحدر.');
  }
  function photos() {
    var host = $('#fcPhotos'), items = []; P().st.forEach(function (s) { s.ph.forEach(function (id, i) { items.push({ id: id, cap: s.id + ' · ' + t('photo ', 'صورة ') + (i + 1) + (s.lith ? ' · ' + LITH[s.lith] : '') + (s.desc ? ' · ' + s.desc.slice(0, 80) : '') }); }); });
    $('#fcPhotoSec').hidden = !items.length; host.innerHTML = items.map(function (q) { return '<figure><img alt="" data-pid="' + q.id + '"><figcaption>' + E(q.cap) + '</figcaption></figure>'; }).join('');
    $$('#fcPhotos img').forEach(function (im) { purl(im.getAttribute('data-pid')).then(function (u) { if (u) im.src = u; }); });
  }

  /* ------------------------------------------------------------------ send and export */
  $('#fcToNet').addEventListener('click', function () { var m = allM(); if (!m.length) return SH.toast(t('No measurements yet.', 'لا قياسات بعد.'), 'warn'); var rows = SH.store.get('shandal_stereonet_rows', []); m.forEach(function (q) { rows.push({ t: MT[q.k][2], a: q.a, b: q.b, s: q.k, src: q.src }); }); SH.store.set('shandal_stereonet_rows', rows); location.href = SH.base + (AR ? 'ar/' : '') + 'tools/stereonet-lab/app/'; });
  $('#fcToSite').addEventListener('click', function () { var s = P().st[sel >= 0 ? sel : P().st.length - 1]; if (!s) return SH.toast(t('Save a station first.', 'احفظ محطة أولاً.'), 'warn'); var o = SH.store.get('shandal_tool_sitereport', {}); o.sLat = s.lat.toFixed(5); o.sLon = s.lon.toFixed(5); o.sTitle = P().name + ' · ' + s.id; SH.store.set('shandal_tool_sitereport', o); location.href = SH.base + (AR ? 'ar/' : '') + 'tools/site-report/app/'; });
  var fn = function (ext) { return 'shandal-field-' + P().name.replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 40) + '.' + ext; };
  $$('[data-ex]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-ex'), st = P().st; if (!st.length && k !== 'json') return SH.toast(t('No stations yet.', 'لا محطات بعد.'), 'warn');
    if (k === 'csv') { var rows = [['station', 'time', 'lat', 'lon', 'accuracy_m', 'lithology', 'unit', 'description', 'type', 'dipdir_or_trend', 'dip_or_plunge', 'source', 'place', 'elevation_m', 'mapped_unit', 'mapped_age']]; st.forEach(function (s) { var base = [s.id, s.t, s.lat, s.lon, s.acc, s.lith, s.unit, s.desc], w = s.web ? [s.web.place, s.web.elev, s.web.unit && s.web.unit.n, s.web.unit && s.web.unit.age] : ['', '', '', '']; if (!s.m.length) rows.push(base.concat(['', '', '', '']).concat(w)); s.m.forEach(function (q) { rows.push(base.concat([q.k, q.a, q.b, q.src]).concat(w)); }); }); SH.csv(fn('csv'), rows); }
    if (k === 'geojson') SH.json(fn('geojson'), { type: 'FeatureCollection', name: P().name, features: st.map(function (s) { return { type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat].concat(s.alt != null ? [s.alt] : []) }, properties: { station: s.id, time: s.t, accuracy_m: s.acc, lithology: s.lith, unit: s.unit, description: s.desc, measurements: s.m, samples: s.s, photos: s.ph.length, place: s.web && s.web.place, elevation_m: s.web && s.web.elev, mapped_unit: s.web && s.web.unit } }; }) });
    if (k === 'kml') { var x = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + E(P().name) + '</name>' + st.map(function (s) { return '<Placemark><name>' + E(s.id) + '</name><description>' + E([LITH[s.lith] && s.lith ? LITH[s.lith] : '', s.unit, s.desc, s.m.map(function (q) { return q.k + ' ' + q.a + '/' + q.b; }).join('; ')].filter(Boolean).join(' · ')) + '</description><Point><coordinates>' + s.lon + ',' + s.lat + '</coordinates></Point></Placemark>'; }).join('') + '</Document></kml>'; SH.download(fn('kml'), x, 'application/vnd.google-earth.kml+xml'); }
    if (k === 'json') { var p = JSON.parse(JSON.stringify(P())), ids = []; p.st.forEach(function (s) { ids = ids.concat(s.ph); }); var out = {}; ids.reduce(function (pr, id) { return pr.then(function () { return pGet(id).then(function (bl) { if (!bl) return; return new Promise(function (res) { var r = new FileReader(); r.onload = function () { out[id] = r.result; res(); }; r.readAsDataURL(bl); }); }); }); }, Promise.resolve()).then(function () { SH.download(fn('json'), JSON.stringify({ shandal: 'field-companion', v: 1, project: p, photos: out }), 'application/json'); }); }
  }); });
  $('#fcImp').addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (!f) return; var r = new FileReader(); r.onload = function () { try { var j = JSON.parse(r.result); if (j.shandal !== 'field-companion' || !j.project) throw new Error(t('This is not a field survey backup.', 'هذا ليس ملف نسخة احتياطية لمسح حقلي.')); var id = uid(); S.P[id] = j.project; S.P[id].name += t(' (restored)', ' (مسترجع)'); S.cur = id;
      Promise.all(Object.keys(j.photos || {}).map(function (pid) { return fetch(j.photos[pid]).then(function (x) { return x.blob(); }).then(function (b) { return pPut(pid, b); }); })).then(function () { save(); clearForm(); all(); SH.toast(t('Survey restored.', 'استُرجع المسح.'), 'ok'); }); } catch (e) { SH.toast(e.message, 'bad'); } }; r.readAsText(f); });
  document.addEventListener('sh:beforereport', function (e) { if (!P().st.length) { e.preventDefault(); SH.toast(t('Save at least one station first.', 'احفظ محطة واحدة على الأقل أولاً.'), 'warn'); } });

  clearForm(); all(); enrich(); if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
})();
