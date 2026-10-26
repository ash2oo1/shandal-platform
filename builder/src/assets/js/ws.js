/* Shandal System — workspace core (SH). Shared by every tool page. No dependencies. */
(function (w) {
  'use strict';
  var d = document, root = d.documentElement;
  var lang = root.lang === 'ar' ? 'ar' : 'en';
  var SH = w.SH = {};
  SH.lang = lang;
  SH.t = function (en, ar) { return lang === 'ar' ? (ar == null ? en : ar) : en; };
  SH.base = (d.querySelector('meta[name="sh-base"]') || {}).content || './';
  SH.cfg = {
    gate: true,
    authUrl: 'https://script.google.com/macros/s/AKfycbxjbge1wg7soV51_ZedXgmxZsF3KOPDxUZ89qnrly6vpqnaxa-GtmjIZxZgZ1xLIDHQmg/exec',
    sessionHours: 24,
    ai: 'https://shandal-ai-backend.shandal-geosystem.workers.dev'
  };
  var $ = SH.$ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = SH.$$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  SH.el = function (tag, attrs, html) { var e = d.createElement(tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; };
  SH.ltr = function (s) { return '\u2066' + s + '\u2069'; };
  SH.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  SH.store = {
    get: function (k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------------------------------------------------------------- icons */
  var IC = {
    ok: '<path d="M20 6 9 17l-5-5"/>',
    bad: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  SH.icon = function (n, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || IC.info) + '</svg>'; };

  /* ---------------------------------------------------------------- toast & modal */
  var toastBox;
  SH.toast = function (msg, type, ms) {
    if (!toastBox) { toastBox = SH.el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); d.body.appendChild(toastBox); }
    var t = SH.el('div', { class: 'toast ' + (type || 'info') }, SH.icon(type || 'info') + '<span>' + msg + '</span>');
    toastBox.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, ms || 3600);
  };
  SH.modal = function (title, html, buttons) {
    return new Promise(function (res) {
      var m = SH.el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
      var btns = (buttons || [{ label: SH.t('Close', 'إغلاق'), value: true, cls: 'btn-ink' }]).map(function (b, i) { return '<button class="btn btn-sm ' + (b.cls || 'btn-line') + '" data-i="' + i + '">' + b.label + '</button>'; }).join('');
      m.innerHTML = '<div class="modal-box"><div class="mh"><h3>' + title + '</h3><button class="icon-btn" data-x aria-label="' + SH.t('Close', 'إغلاق') + '">' + SH.icon('x', 'ico-sm') + '</button></div><div class="mb">' + html + '</div><div class="mf">' + btns + '</div></div>';
      function done(v) { m.remove(); d.removeEventListener('keydown', esc); res(v); }
      function esc(e) { if (e.key === 'Escape') done(false); }
      m.addEventListener('click', function (e) {
        if (e.target === m || e.target.closest('[data-x]')) return done(false);
        var b = e.target.closest('[data-i]'); if (b) done((buttons || [{ value: true }])[+b.getAttribute('data-i')].value);
      });
      d.addEventListener('keydown', esc); d.body.appendChild(m);
      var f = m.querySelector('.mf .btn:last-child'); f && f.focus();
    });
  };
  SH.confirm = function (msg) {
    return SH.modal(SH.t('Please confirm', 'يرجى التأكيد'), '<p>' + msg + '</p>', [{ label: SH.t('Cancel', 'إلغاء'), value: false }, { label: SH.t('Confirm', 'تأكيد'), value: true, cls: 'btn-gold' }]);
  };
  SH.busy = function (host, on, text) {
    if (!host) return; var l = host.querySelector(':scope > .loading');
    if (!l) {
      l = SH.el('div', { class: 'loading', role: 'status', 'aria-live': 'polite' }, '<div class="ld-card"><div class="ld-em"><span class="ld-ring"></span><span class="ld-arc"></span><img src="' + SH.base + 'assets/img/emblem-64.png" alt="" width="40" height="40"></div><div class="ld-strata" aria-hidden="true"><i></i></div><div class="lt"></div><div class="ls">' + SH.t('Please wait — Shandal System is collecting the data for you.', 'يرجى الانتظار — يجمع نظام شندل البيانات من أجلك.') + '</div><div class="le ltr"></div></div>');
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(l);
    }
    l.querySelector('.lt').textContent = text || SH.t('Loading…', 'جارٍ التحميل…');
    clearInterval(l._tm); var le = l.querySelector('.le'); le.textContent = '';
    var ls = l.querySelector('.ls'), ST = [SH.t('Connecting to the international data service…', 'جارٍ الاتصال بخدمة البيانات الدولية…'), SH.t('Receiving and checking the data…', 'جارٍ استلام البيانات والتحقق منها…'), SH.t('Computing results and drawing the figures…', 'جارٍ حساب النتائج ورسم الأشكال…'), SH.t('Large requests take a little longer — thank you for waiting.', 'الطلبات الكبيرة تستغرق وقتاً أطول قليلاً — شكراً لانتظارك.')];
    if (on) { var t0 = Date.now(); ls.textContent = ST[0]; l._tm = setInterval(function () { var s = Math.round((Date.now() - t0) / 1000); ls.textContent = ST[s < 3 ? 0 : s < 7 ? 1 : s < 14 ? 2 : 3]; le.textContent = s >= 2 ? s + ' s' : ''; }, 1000); }
    l.hidden = !on;
  };

  /* ---------------------------------------------------------------- numbers */
  SH.fmt = function (v, dp, opt) {
    if (v == null || isNaN(v)) return '—';
    return Number(v).toLocaleString(lang === 'ar' ? 'en-US' : 'en-US', { minimumFractionDigits: dp == null ? 0 : dp, maximumFractionDigits: dp == null ? 2 : dp, useGrouping: !(opt && opt.nogroup) });
  };
  SH.num = function (id) { var e = typeof id === 'string' ? d.getElementById(id) : id; if (!e) return NaN; var v = String(e.value).replace(',', '.').trim(); return v === '' ? NaN : parseFloat(v); };
  SH.val = function (id) { var e = d.getElementById(id); return e ? e.value : ''; };
  SH.selText = function (id) { var e = d.getElementById(id); return e && e.options ? e.options[e.selectedIndex].text : ''; };
  SH.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  SH.rad = function (x) { return x * Math.PI / 180; };
  SH.deg = function (x) { return x * 180 / Math.PI; };
  SH.dir8 = function (az) { var a = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; return a[Math.round(((az % 360) + 360) % 360 / 45) % 8]; };
  SH.dir16 = function (az) { var a = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']; return a[Math.round(((az % 360) + 360) % 360 / 22.5) % 16]; };
  SH.rng = function (seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };
  SH.uid = function (prefix) {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    var buf = new Uint32Array(8); (w.crypto || w.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 8; i++) s += a[buf[i] % a.length];
    return (prefix || 'SHD') + '-' + new Date().getFullYear() + '-' + s.slice(0, 4) + '-' + s.slice(4);
  };

  /* ---------------------------------------------------------------- downloads */
  SH.download = function (name, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    if (SH.saveFile) return SH.saveFile(blob, name, (blob.type || mime || 'application/octet-stream').split(';')[0]);
    var a = SH.el('a', { href: URL.createObjectURL(blob), download: name }); a.style.display = 'none';
    d.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  };
  SH.csv = function (name, rows) {
    var txt = rows.map(function (r) { return r.map(function (c) { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\r\n');
    SH.download(name, '﻿' + txt, 'text/csv;charset=utf-8');
  };
  SH.tableRows = function (table) { return $$('tr', table).map(function (tr) { return $$('th,td', tr).filter(function (c) { return !c.hasAttribute('data-noexport'); }).map(function (c) { return c.innerText.trim(); }); }); };
  SH.json = function (name, obj) { SH.download(name, JSON.stringify(obj, null, 1), 'application/geo+json'); };
  SH.svgPng = function (svg, name, scale, bg) {
    scale = scale || 2;
    var clone = svg.cloneNode(true), vb = svg.viewBox && svg.viewBox.baseVal, wdt = vb && vb.width || svg.clientWidth, hgt = vb && vb.height || svg.clientHeight;
    clone.setAttribute('width', wdt); clone.setAttribute('height', hgt); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // inline computed styles for every element so the PNG matches the screen
    var src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
    var props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline', 'direction', 'paint-order'];
    for (var i = 0; i < src.length; i++) { var cs = getComputedStyle(src[i]), st = ''; props.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) st += p + ':' + v + ';'; }); dst[i].setAttribute('style', st); }
    var xml = new XMLSerializer().serializeToString(clone);
    var img = new Image(); img.onload = function () {
      var c = d.createElement('canvas'); c.width = wdt * scale; c.height = hgt * scale; var x = c.getContext('2d');
      x.fillStyle = bg || getComputedStyle(svg).getPropertyValue('--il-bg') || '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height); c.toBlob(function (b) { SH.download(name, b); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  };
  SH.canvasPng = function (canvas, name) { canvas.toBlob(function (b) { SH.download(name, b); }); };

  /* ---------------------------------------------------------------- tiny SVG builder */
  SH.svgB = function (svg) {
    var NS = 'http://www.w3.org/2000/svg';
    svg = typeof svg === 'string' ? d.getElementById(svg) : svg; svg.innerHTML = '';
    var api = {
      el: svg,
      add: function (tag, a, txt, parent) { var e = d.createElementNS(NS, tag); for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; (parent || svg).appendChild(e); return e; },
      g: function (a, parent) { return api.add('g', a || {}, null, parent); },
      line: function (x1, y1, x2, y2, a, parent) { return api.add('line', Object.assign({ x1: x1, y1: y1, x2: x2, y2: y2 }, a || {}), null, parent); },
      path: function (dd, a, parent) { return api.add('path', Object.assign({ d: dd }, a || {}), null, parent); },
      text: function (x, y, s, a, parent) { return api.add('text', Object.assign({ x: x, y: y, 'font-family': 'inherit' }, a || {}), s, parent); },
      circle: function (cx, cy, r, a, parent) { return api.add('circle', Object.assign({ cx: cx, cy: cy, r: r }, a || {}), null, parent); },
      poly: function (pts, a, parent) { return api.add('polygon', Object.assign({ points: pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') }, a || {}), null, parent); },
      pl: function (pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'); },
      arrow: function (x1, y1, x2, y2, col, w, label, a) {
        var ang = Math.atan2(y2 - y1, x2 - x1), h = 9 + (w || 2);
        api.line(x1, y1, x2, y2, { stroke: col, 'stroke-width': w || 2, 'stroke-linecap': 'round' });
        api.poly([[x2, y2], [x2 - h * Math.cos(ang - 0.4), y2 - h * Math.sin(ang - 0.4)], [x2 - h * Math.cos(ang + 0.4), y2 - h * Math.sin(ang + 0.4)]], { fill: col });
        if (label) api.text(x2 + (a && a.dx || 8 * Math.cos(ang)), y2 + (a && a.dy || 8 * Math.sin(ang) + 5), label, { fill: col, 'font-size': 14, 'font-weight': 800, 'text-anchor': 'middle' });
      }
    };
    return api;
  };

  /* ---------------------------------------------------------------- css colours */
  SH.css = function (v, el) { return getComputedStyle(el || root).getPropertyValue(v).trim(); };
  SH.alpha = function (hex, a) { hex = (hex || '#888').trim(); if (hex[0] !== '#') return hex; if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]; var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  SH.isDark = function () { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  SH.palette = function () {
    return { text: SH.css('--text'), text2: SH.css('--text-2'), text3: SH.css('--text-3'), line: SH.css('--line'), line2: SH.css('--line-2'), bg: SH.css('--surface'), bg2: SH.css('--surface-2'),
      accent: SH.css('--accent'), data: SH.css('--data'), warn: SH.css('--warn'), ok: SH.css('--ok'),
      series: SH.isDark() ? ['#D6B66B', '#64B9B5', '#E08A5E', '#9BB0E8', '#B8D27A', '#D79AD6', '#E6E1D4', '#7EC8E3'] : ['#9A7631', '#2F7F7C', '#B4552D', '#4B63B5', '#6C8F2E', '#9C4D9A', '#33414C', '#2A8FB8'] };
  };

  /* ---------------------------------------------------------------- Plotly */
  SH.plotLayout = function (extra) {
    var p = SH.palette(), font = lang === 'ar' ? '"Plex Arabic", Tahoma, sans-serif' : 'Manrope, system-ui, sans-serif';
    var ax = { gridcolor: p.line, zerolinecolor: p.line2, linecolor: p.line2, tickcolor: p.line2, tickfont: { color: p.text2, size: 11 }, title: { font: { color: p.text2, size: 12 } }, automargin: true };
    var L = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: font, color: p.text, size: 12 }, margin: { l: 60, r: 20, t: 20, b: 50 },
      colorway: p.series, hoverlabel: { font: { family: font } }, modebar: { bgcolor: 'rgba(0,0,0,0)', color: p.text2, activecolor: p.accent, orientation: 'h' }, legend: { orientation: 'h', y: -0.18, font: { color: p.text2 } },
      xaxis: JSON.parse(JSON.stringify(ax)), yaxis: JSON.parse(JSON.stringify(ax)) };
    return deepMerge(L, extra || {});
  };
  function deepMerge(a, b) { for (var k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]); else a[k] = b[k]; } return a; }
  SH.merge = deepMerge;
  var plots = [];
  SH.plot = function (el, traces, layout, cfg) {
    el = typeof el === 'string' ? d.getElementById(el) : el;
    if (!w.Plotly) { el.innerHTML = '<div class="empty-s"><p>' + SH.t('Chart library failed to load. Refresh the page.', 'تعذر تحميل مكتبة المخططات. أعد تحميل الصفحة.') + '</p></div>'; return; }
    var conf = Object.assign({ displaylogo: false, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines', 'hoverCompareCartesian'], toImageButtonOptions: { format: 'png', scale: 2, filename: (cfg && cfg.filename) || 'shandal-chart' } }, cfg || {});
    var lay = typeof layout === 'function' ? layout() : layout;
    w.Plotly.react(el, traces, SH.plotLayout(JSON.parse(JSON.stringify(lay || {}))), conf);
    var rec = plots.filter(function (p) { return p.el === el; })[0];
    if (!rec) plots.push({ el: el, layout: layout, traces: traces, cfg: conf }); else { rec.layout = layout; rec.traces = traces; }
    return el;
  };
  SH.plotPng = function (el, name) { el = typeof el === 'string' ? d.getElementById(el) : el; if (w.Plotly) w.Plotly.downloadImage(el, { format: 'png', scale: 2, filename: name || 'shandal-chart' }); };
  d.addEventListener('themechange', function () {
    setTimeout(function () {
      plots.forEach(function (p) { if (d.body.contains(p.el)) w.Plotly.react(p.el, p.traces, SH.plotLayout(JSON.parse(JSON.stringify((typeof p.layout === 'function' ? p.layout() : p.layout) || {}))), p.cfg); });
      d.dispatchEvent(new CustomEvent('sh:redraw'));
    }, 30);
  });

  /* ---------------------------------------------------------------- geolocation */
  /* GNSS capture. Listens with high accuracy (the device then uses every constellation it supports:
     GPS, GLONASS, Galileo, BeiDou), keeps all readings, averages the good ones (weights 1/σ²) and stops
     early once the target accuracy is reached. With `prev`, earlier readings are merged and the result is
     never worse than the previous fix. */
  SH.gpsFix = function (o) {
    o = o || {}; var ms = o.ms || 30000, target = o.target || 4, prev = o.prev || null;
    return new Promise(function (res, rej) {
      if (!navigator.geolocation) return rej(new Error(SH.t('This browser does not support location.', 'هذا المتصفح لا يدعم تحديد الموقع.')));
      var fixes = (prev && prev.fixes ? prev.fixes.slice(-80) : []), t0 = Date.now(), done = false, id, tm;
      function summary() {
        if (!fixes.length) return null; var best = fixes.reduce(function (a, f) { return f.acc < a.acc ? f : a; }), good = fixes.filter(function (f) { return f.acc <= Math.max(best.acc * 1.6, best.acc + 3); });
        var sw = 0, la = 0, lo = 0, al = 0, na = 0; good.forEach(function (f) { var w = 1 / (f.acc * f.acc); sw += w; la += f.lat * w; lo += f.lon * w; if (f.alt != null) { al += f.alt; na++; } });
        return { lat: la / sw, lon: lo / sw, acc: best.acc, prec: Math.sqrt(1 / sw), n: fixes.length, used: good.length, alt: na ? al / na : null, fixes: fixes, t: Date.now() };
      }
      function finish(err) {
        if (done) return; done = true; navigator.geolocation.clearWatch(id); clearInterval(tm); var r = summary();
        if (!r) return rej(err || new Error(SH.t('No satellite fix yet. Go outdoors with an open view of the sky and turn on precise (GPS) location on the device. Desktop computers without a GNSS receiver only estimate an approximate position from Wi-Fi or the network.', 'لم يُلتقط أي إرسال من الأقمار الصناعية بعد. اخرج إلى مكان مفتوح على السماء وفعّل الموقع الدقيق (GPS) في الجهاز. الحواسيب المكتبية التي لا تحتوي مستقبِل GNSS تقدّر موقعاً تقريبياً فقط من شبكة Wi-Fi أو الإنترنت.')));
        if (prev && prev.acc != null && prev.acc < r.acc && !prev.fixes) { prev.kept = true; return res(prev); }
        res(r);
      }
      id = navigator.geolocation.watchPosition(function (p) {
        var c = p.coords; if (!isFinite(c.accuracy) || c.accuracy > 5000) return;
        fixes.push({ lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, t: p.timestamp });
        var r = summary(); o.onUpdate && o.onUpdate(Object.assign({ elapsed: (Date.now() - t0) / 1000, ms: ms }, r));
        var fresh = fixes.filter(function (f) { return f.t >= t0; }).length;
        if (r.acc <= target && fresh >= 5) finish();
      }, function (e) { if (e.code === 1) { done = true; navigator.geolocation.clearWatch(id); clearInterval(tm); rej(new Error(SH.t('Location permission was denied. Allow location for this site in the browser settings.', 'تم رفض إذن الموقع. اسمح بالموقع لهذا الموقع من إعدادات المتصفح.'))); } },
      { enableHighAccuracy: true, maximumAge: 0 });
      tm = setInterval(function () { var r = summary(); o.onUpdate && o.onUpdate(Object.assign({ elapsed: (Date.now() - t0) / 1000, ms: ms, waiting: !r }, r || {})); if (Date.now() - t0 >= ms) finish(); }, 1000);
      if (o.control) o.control.stop = function () { finish(); };
    });
  };
  SH.locate = function () { return SH.gpsFix({ ms: 15000, target: 30 }); };
  SH.locateBest = function (ms, onUpdate) { return SH.gpsFix({ ms: Math.max(ms || 20000, 20000), onUpdate: onUpdate }); };

  /* ---------------------------------------------------------------- geodesy */
  var A = 6378137, F = 1 / 298.257223563, K0 = 0.9996, E2 = F * (2 - F), EP2 = E2 / (1 - E2);
  SH.utmZone = function (lat, lon) {
    var z = Math.floor((lon + 180) / 6) + 1;
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
    if (lat >= 72 && lat < 84) { if (lon >= 0 && lon < 9) z = 31; else if (lon >= 9 && lon < 21) z = 33; else if (lon >= 21 && lon < 33) z = 35; else if (lon >= 33 && lon < 42) z = 37; }
    return z;
  };
  SH.utmBand = function (lat) { return 'CDEFGHJKLMNPQRSTUVWXX'.charAt(Math.floor((SH.clamp(lat, -80, 84) + 80) / 8)); };
  /* Snyder (1987) transverse Mercator series, WGS 84 */
  SH.toUTM = function (lat, lon, forceZone) {
    var zone = forceZone || SH.utmZone(lat, lon), l0 = SH.rad((zone - 1) * 6 - 180 + 3), phi = SH.rad(lat), lam = SH.rad(lon);
    var N = A / Math.sqrt(1 - E2 * Math.sin(phi) * Math.sin(phi)), T = Math.tan(phi) * Math.tan(phi), C = EP2 * Math.cos(phi) * Math.cos(phi), Aa = Math.cos(phi) * (lam - l0);
    var M = A * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256) * phi - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 * E2 / 1024) * Math.sin(2 * phi) + (15 * E2 * E2 / 256 + 45 * E2 * E2 * E2 / 1024) * Math.sin(4 * phi) - (35 * E2 * E2 * E2 / 3072) * Math.sin(6 * phi));
    var x = K0 * N * (Aa + (1 - T + C) * Math.pow(Aa, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(Aa, 5) / 120) + 500000;
    var y = K0 * (M + N * Math.tan(phi) * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(Aa, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(Aa, 6) / 720));
    if (lat < 0) y += 10000000;
    return { zone: zone, band: SH.utmBand(lat), hemi: lat < 0 ? 'S' : 'N', E: x, N: y };
  };
  SH.fromUTM = function (E, N, zone, south) {
    var x = E - 500000, y = south ? N - 10000000 : N, l0 = SH.rad((zone - 1) * 6 - 180 + 3);
    var M = y / K0, mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256)), e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    var p1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
    var N1 = A / Math.sqrt(1 - E2 * Math.sin(p1) * Math.sin(p1)), T1 = Math.tan(p1) * Math.tan(p1), C1 = EP2 * Math.cos(p1) * Math.cos(p1), R1 = A * (1 - E2) / Math.pow(1 - E2 * Math.sin(p1) * Math.sin(p1), 1.5), D = x / (N1 * K0);
    var lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    var lon = l0 + (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(p1);
    return { lat: SH.deg(lat), lon: SH.deg(lon) };
  };
  SH.dist = function (a, b) { var R = 6371008.8, p1 = SH.rad(a.lat), p2 = SH.rad(b.lat), dp = p2 - p1, dl = SH.rad(b.lon - a.lon); var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2); return 2 * R * Math.asin(Math.sqrt(h)); };
  SH.bearing = function (a, b) { var p1 = SH.rad(a.lat), p2 = SH.rad(b.lat), dl = SH.rad(b.lon - a.lon); return (SH.deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360; };
  SH.dest = function (p, brg, m) { var R = 6371008.8, dr = m / R, b = SH.rad(brg), p1 = SH.rad(p.lat), l1 = SH.rad(p.lon); var p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(b)); var l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2)); return { lat: SH.deg(p2), lon: ((SH.deg(l2) + 540) % 360) - 180 }; };
  SH.fmtLatLon = function (lat, lon, dp) { dp = dp == null ? 5 : dp; return Math.abs(lat).toFixed(dp) + '° ' + (lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(dp) + '° ' + (lon >= 0 ? 'E' : 'W'); };
  SH.dms = function (v, pos, neg) { var a = Math.abs(v), dd = Math.floor(a), mm = Math.floor((a - dd) * 60), ss = ((a - dd) * 60 - mm) * 60; return dd + '°' + String(mm).padStart(2, '0') + '′' + ss.toFixed(1).padStart(4, '0') + '″' + (v >= 0 ? pos : neg); };

  /* ---------------------------------------------------------------- Leaflet helpers */
  SH.basemaps = function () {
    var L = w.L; if (!L) return {};
    var osm = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    var esri = function (base, ref) { var u = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/', o = { maxZoom: 19, maxNativeZoom: 16 }; return L.layerGroup([L.tileLayer(u + base + '/MapServer/tile/{z}/{y}/{x}', L.extend({ attribution: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors' }, o)), L.tileLayer(u + ref + '/MapServer/tile/{z}/{y}/{x}', L.extend({ pane: 'overlayPane' }, o))]); };
    return {
      light: { name: SH.t('Light', 'فاتح'), layer: esri('World_Light_Gray_Base', 'World_Light_Gray_Reference') },
      dark: { name: SH.t('Dark', 'داكن'), layer: esri('World_Dark_Gray_Base', 'World_Dark_Gray_Reference') },
      streets: { name: SH.t('Streets', 'شوارع'), layer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: osm }) },
      topo: { name: SH.t('Topographic', 'طبوغرافية'), layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: 'Map data ' + osm + ', SRTM | Style © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' }) },
      satellite: { name: SH.t('Satellite', 'فضائية'), layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community' }) }
    };
  };
  SH.map = function (el, opts) {
    var L = w.L; el = typeof el === 'string' ? d.getElementById(el) : el;
    if (!L) { el.innerHTML = '<div class="empty-s"><p>' + SH.t('Map library failed to load. Refresh the page.', 'تعذر تحميل مكتبة الخرائط. أعد تحميل الصفحة.') + '</p></div>'; return null; }
    opts = opts || {};
    var m = L.map(el, { center: opts.center || [33.31, 44.37], zoom: opts.zoom || 6, zoomControl: true, worldCopyJump: true, preferCanvas: !!opts.canvas, attributionControl: true });
    var bm = SH.basemaps(), layers = {}, def = opts.base || (SH.isDark() ? 'dark' : 'light');
    (opts.bases || ['light', 'dark', 'streets', 'topo', 'satellite']).forEach(function (k) { if (bm[k]) layers[bm[k].name] = bm[k].layer; });
    (bm[def] || bm.light).layer.addTo(m);
    m._shBase = def; el._shMap = m;
    m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.control.scale({ metric: true, imperial: false }).addTo(m);
    m._shLayers = L.control.layers(layers, opts.overlays || {}, { position: 'topleft', collapsed: true }).addTo(m);
    if (opts.locate !== false) {
      var Loc = L.Control.extend({ options: { position: 'topleft' }, onAdd: function () {
        var b = L.DomUtil.create('div', 'leaflet-bar'); b.innerHTML = '<a href="#" role="button" title="' + SH.t('My location', 'موقعي') + '" style="display:grid;place-items:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg></a>';
        L.DomEvent.on(b, 'click', function (e) { L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); SH.locate().then(function (p) { m.setView([p.lat, p.lon], Math.max(m.getZoom(), 14)); L.circle([p.lat, p.lon], { radius: p.acc, color: SH.css('--data'), weight: 1, fillOpacity: .1 }).addTo(m); m.fire('sh:located', p); }).catch(function (er) { SH.toast(er.message, 'bad'); }); });
        return b;
      } });
      new Loc().addTo(m);
    }
    d.addEventListener('themechange', function () {
      if (m._shBase !== 'light' && m._shBase !== 'dark') return;
      var want = SH.isDark() ? 'dark' : 'light'; if (want === m._shBase) return;
      m.removeLayer(bm[m._shBase].layer); bm[want].layer.addTo(m); m._shBase = want;
    });
    m.on('baselayerchange', function (e) { for (var k in bm) if (bm[k].layer === e.layer) m._shBase = k; });
    setTimeout(function () { m.invalidateSize(); }, 200);
    return m;
  };
  SH.pin = function (html, cls, size) { return w.L.divIcon({ className: '', html: '<div class="' + (cls || 'mk') + '">' + (html || '') + '</div>', iconSize: size || [14, 14], iconAnchor: size ? [size[0] / 2, size[1] / 2] : [7, 7] }); };
  /* draw a rectangle on the map by two clicks or by dragging */
  SH.drawRect = function (map, onDone, hintEl) {
    var L = w.L, start = null, rect = null, active = true;
    map.dragging.disable(); map.getContainer().style.cursor = 'crosshair'; if (hintEl) hintEl.hidden = false;
    function finish(b) { active = false; map.dragging.enable(); map.getContainer().style.cursor = ''; if (hintEl) hintEl.hidden = true; map.off('mousedown', md); map.off('mousemove', mm); map.off('mouseup', mu); map.off('click', ck); onDone(b, rect); }
    function md(e) { start = e.latlng; rect = rect || L.rectangle([start, start], { color: SH.css('--accent'), weight: 2, fillOpacity: .08, dashArray: '6 4' }).addTo(map); rect.setBounds([start, start]); }
    function mm(e) { if (start && rect) rect.setBounds([start, e.latlng]); }
    function mu(e) { if (!start) return; var b = L.latLngBounds(start, e.latlng); if (map.latLngToContainerPoint(start).distanceTo(e.containerPoint) < 8) return; start = null; finish(b); }
    function ck(e) { if (!active) return; }
    map.on('mousedown', md); map.on('mousemove', mm); map.on('mouseup', mu); map.on('click', ck);
    // touch: two taps
    var taps = [];
    map.getContainer().addEventListener('touchend', function te(ev) {
      if (!active) { map.getContainer().removeEventListener('touchend', te); return; }
      var t = ev.changedTouches[0], r = map.getContainer().getBoundingClientRect(); var ll = map.containerPointToLatLng([t.clientX - r.left, t.clientY - r.top]);
      taps.push(ll); if (!rect) rect = L.rectangle([ll, ll], { color: SH.css('--accent'), weight: 2, fillOpacity: .08, dashArray: '6 4' }).addTo(map);
      if (taps.length === 2) { var b = L.latLngBounds(taps[0], taps[1]); rect.setBounds(b); map.getContainer().removeEventListener('touchend', te); finish(b); }
    });
    return { cancel: function () { if (active) { active = false; map.dragging.enable(); map.getContainer().style.cursor = ''; if (hintEl) hintEl.hidden = true; if (rect) map.removeLayer(rect); } } };
  };

  /* ---------------------------------------------------------------- fetch helpers */
  SH.v = (function () { var s = d.currentScript, m = s && /[?&]v=([^&]+)/.exec(s.src); return m ? m[1] : ''; })();
  SH.getJSON = function (url, opts) {
    if (SH.v && url.indexOf(SH.base + 'assets/') === 0 && url.indexOf('?') < 0) url += '?v=' + SH.v;
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, (opts && opts.timeout) || 30000);
    return fetch(url, Object.assign({ signal: ctl.signal }, opts || {})).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { clearTimeout(t); throw new Error(e.name === 'AbortError' ? SH.t('The data service took too long to answer. Try again.', 'استغرقت خدمة البيانات وقتاً طويلاً. حاول مجدداً.') : (/HTTP/.test(e.message) ? SH.t('The data service returned an error (', 'أعادت خدمة البيانات خطأ (') + e.message + ').' : SH.t('Could not reach the data service. Check your internet connection.', 'تعذر الوصول إلى خدمة البيانات. تحقق من اتصالك بالإنترنت.'))); });
  };

  /* ---------------------------------------------------------------- Copernicus DEM from the Planetary Computer
     Copernicus GLO-30 / GLO-90 (ESA, licence allows any use with attribution) read as float32 NumPy arrays from the
     Planetary Computer data API: STAC search for the 1° tiles, one bbox request per tile, bilinear sampler over the mosaic. */
  var PC = 'https://planetarycomputer.microsoft.com/api/';
  SH.pc = {
    search: function (coll, b, limit) {
      return fetch(PC + 'stac/v1/search?collections=' + coll + '&bbox=' + [b.w, b.s, b.e, b.n].map(function (v) { return v.toFixed(6); }).join(',') + '&limit=' + (limit || 20))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) { return j.features || []; });
    },
    npy: function (url) {
      return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(function (buf) {
        var u8 = new Uint8Array(buf), major = u8[6], hl = major >= 2 ? (u8[8] | (u8[9] << 8) | (u8[10] << 16) | (u8[11] << 24)) : (u8[8] | (u8[9] << 8)), off = (major >= 2 ? 12 : 10) + hl;
        var hdr = new TextDecoder().decode(u8.slice(major >= 2 ? 12 : 10, off)), shp = /shape': \(([^)]*)\)/.exec(hdr)[1].split(',').filter(function (x) { return x.trim(); }).map(Number);
        return { shape: shp, data: new Float32Array(buf.slice(off)) };
      });
    },
    /* sampler over bounds b {n,s,e,w}; coll 'cop-dem-glo-30' | 'cop-dem-glo-90'; maxPx caps each tile request side */
    dem: function (b, coll, onProgress, maxPx) {
      var res = coll === 'cop-dem-glo-30' ? 1 / 3600 : 1 / 1200, cap = maxPx || 2400;
      return SH.pc.search(coll, b).then(function (items) {
        if (!items.length) throw new Error(SH.t('No Copernicus DEM tile covers this area (open sea).', 'لا تغطي بلاطات نموذج كوبرنيكوس هذه المنطقة (بحر مفتوح).'));
        if (items.length > 9) throw new Error(SH.t('The area spans too many 1° DEM tiles. Shrink it or use the SRTM composite.', 'المنطقة تمتد على بلاطات كثيرة. صغّرها أو استخدم نموذج SRTM المركّب.'));
        var done = 0, pieces = [];
        return Promise.all(items.map(function (it) {
          var ib = { w: Math.max(b.w, it.bbox[0]), s: Math.max(b.s, it.bbox[1]), e: Math.min(b.e, it.bbox[2]), n: Math.min(b.n, it.bbox[3]) };
          if (ib.e <= ib.w || ib.n <= ib.s) return null;
          var W = Math.max(2, Math.ceil((ib.e - ib.w) / res)), H = Math.max(2, Math.ceil((ib.n - ib.s) / res)), k = Math.max(W, H) > cap ? cap / Math.max(W, H) : 1;
          W = Math.max(2, Math.round(W * k)); H = Math.max(2, Math.round(H * k));
          var url = PC + 'data/v1/item/bbox/' + [ib.w, ib.s, ib.e, ib.n].map(function (v) { return v.toFixed(7); }).join(',') + '/' + W + 'x' + H + '.npy?collection=' + coll + '&item=' + encodeURIComponent(it.id) + '&assets=data&resampling=bilinear';
          return SH.pc.npy(url).then(function (a) { var h = a.shape[1], w2 = a.shape[2]; pieces.push({ b: ib, W: w2, H: h, z: a.data.subarray(0, w2 * h), m: a.shape[0] > 1 ? a.data.subarray(w2 * h, 2 * w2 * h) : null }); if (onProgress) onProgress(++done, items.length); });
        })).then(function () {
          var f = function (lat, lon) {
            for (var q = 0; q < pieces.length; q++) { var P = pieces[q]; if (lat < P.b.s || lat > P.b.n || lon < P.b.w || lon > P.b.e) continue;
              var gx = (lon - P.b.w) / (P.b.e - P.b.w) * P.W - 0.5, gy = (P.b.n - lat) / (P.b.n - P.b.s) * P.H - 0.5, ix = Math.max(0, Math.min(P.W - 2, Math.floor(gx))), iy = Math.max(0, Math.min(P.H - 2, Math.floor(gy))), fx = Math.max(0, Math.min(1, gx - ix)), fy = Math.max(0, Math.min(1, gy - iy)), o = iy * P.W + ix;
              var idx = [o, o + 1, o + P.W, o + P.W + 1], wt = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy], sum = 0, ws = 0;
              for (var c = 0; c < 4; c++) { if (P.m && P.m[idx[c]] === 0) continue; sum += P.z[idx[c]] * wt[c]; ws += wt[c]; }
              if (ws > 0.05) return sum / ws; }
            return NaN;
          };
          f.pixel = res * 111320; return f;
        });
      });
    }
  };

  /* ---------------------------------------------------------------- session & gate */
  SH.session = function () { var s = SH.store.get('shandal_session', null); if (!s || !s.name || !s.exp || s.exp < Date.now()) return null; return s; };
  SH.deviceToken = function () {
    var t = null; try { t = localStorage.getItem('shandal_device_token'); } catch (e) {}
    if (!t) { var b = new Uint32Array(4); crypto.getRandomValues(b); t = 'DEV-' + Array.prototype.map.call(b, function (x) { return x.toString(36); }).join('') + Date.now(); try { localStorage.setItem('shandal_device_token', t); } catch (e) {} }
    return t;
  };
  SH.login = function (name, code) {
    return fetch(SH.cfg.authUrl, { method: 'POST', body: JSON.stringify({ name: name, password: code, deviceToken: SH.deviceToken() }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success) { var s = { name: name, since: Date.now(), exp: Date.now() + SH.cfg.sessionHours * 3600e3 }; SH.store.set('shandal_session', s); return s; }
        throw new Error((res && res.message) || SH.t('The name or access code is not correct.', 'الاسم أو رمز الدخول غير صحيح.'));
      }, function () { throw new Error(SH.t('Could not reach the subscriber service. Check your connection and try again.', 'تعذر الوصول إلى خدمة المشتركين. تحقق من الاتصال وحاول مجدداً.')); });
  };
  SH.logout = function () { SH.store.del('shandal_session'); };
  /* access levels (body data-access): 'sub' subscribers only · 'open' free data view, Shandal analysis for subscribers · 'free' */
  SH.access = function () { return (d.body && d.body.getAttribute('data-access')) || 'sub'; };
  SH.pro = function () { return !SH.cfg.gate || !!SH.session(); };
  SH.needPro = function () {
    if (SH.pro()) return true;
    var tpl = d.getElementById('proLockTpl');
    if (tpl && SH.modal) SH.modal(SH.t('Subscribers only', 'للمشتركين فقط'), tpl.innerHTML.replace('class="pro-lock"', 'class="pro-lock in-modal"')); else location.href = d.body.getAttribute('data-pricing');
    return false;
  };
  function lockPro() {
    if (SH.access() !== 'open' || SH.pro()) return;
    d.body.classList.add('pro-locked'); var n = d.getElementById('openNote'); if (n) n.hidden = false;
    var tpl = d.getElementById('proLockTpl'); if (!tpl) return;
    $$('[data-pro]').forEach(function (el) { if (!el.querySelector(':scope > .pro-lock')) el.appendChild(tpl.content.firstElementChild.cloneNode(true)); });
    /* downloads and other Shandal outputs inside open tools ask for a subscription */
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-pro-action],#reportBtn'); if (!b || SH.pro()) return; e.preventDefault(); e.stopImmediatePropagation(); SH.needPro(); }, true);
  }
  SH.gate = function () {
    if (SH.access() === 'sub' && SH.cfg.gate && !SH.session() && d.body.getAttribute('data-pricing')) { location.replace(d.body.getAttribute('data-pricing')); }
    lockPro();
    var g = d.getElementById('gate'); if (!g) return true;
    var ok = !SH.cfg.gate || !!SH.session(); g.hidden = ok;
    var ws = d.getElementById('ws-root'); if (ws) { ws.inert = !ok; ws.setAttribute('aria-hidden', ok ? 'false' : 'true'); }
    return ok;
  };

  /* ---------------------------------------------------------------- report */
  SH.report = function (title) {
    var h = d.getElementById('repHead'); if (!h) { w.print(); return; }
    var s = SH.session(), code = SH.uid('SHD');
    h.querySelector('[data-r=title]').textContent = title || d.title;
    h.querySelector('[data-r=meta]').textContent = SH.t('Prepared by ', 'إعداد: ') + ((d.getElementById('geoName') && d.getElementById('geoName').value) || (s && s.name) || '—') + ' · ' + new Date().toLocaleString(lang === 'ar' ? 'ar-IQ' : 'en-GB');
    h.querySelector('[data-r=code]').textContent = code;
    var q = h.querySelector('.qr'); q.innerHTML = '';
    if (w.QRCode) { try { new w.QRCode(q, { text: location.origin + location.pathname.replace(/tools\/.*$/, '') + (lang === 'ar' ? '' : '') + 'verify/index.html?code=' + code, width: 148, height: 148, correctLevel: w.QRCode.CorrectLevel.M }); } catch (e) {} }
    setTimeout(function () { w.print(); }, 250);
  };

  /* ---------------------------------------------------------------- persist simple inputs */
  SH.persist = function (key, ids) {
    var k = 'shandal_tool_' + key, saved = SH.store.get(k, {});
    ids.forEach(function (id) { var e = d.getElementById(id); if (!e) return; if (saved[id] != null) { if (e.type === 'checkbox') e.checked = saved[id]; else e.value = saved[id]; } e.addEventListener('change', save); });
    function save() { var o = {}; ids.forEach(function (id) { var e = d.getElementById(id); if (e) o[id] = e.type === 'checkbox' ? e.checked : e.value; }); SH.store.set(k, o); }
    return { save: save, clear: function () { SH.store.del(k); } };
  };

  /* ---------------------------------------------------------------- tip buttons: open a modal with long help */
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-help]'); if (!t) return;
    e.preventDefault(); var tpl = d.getElementById(t.getAttribute('data-help')); if (tpl) SH.modal(tpl.getAttribute('data-title') || '', tpl.innerHTML);
  });
  d.addEventListener('click', function (e) {
    var s = e.target.closest('.seg button'); if (!s) return;
    $$('button', s.parentElement).forEach(function (b) { b.setAttribute('aria-pressed', b === s ? 'true' : 'false'); });
    s.parentElement.dispatchEvent(new CustomEvent('segchange', { detail: s.getAttribute('data-v'), bubbles: true }));
  });
  /* ICS International Chronostratigraphic Chart (v2023/09): periods with base age (Ma) and official colours */
  SH.ics = [['Quaternary', 'الرباعي', 0, 2.58, '#F9F97F'], ['Neogene', 'النيوجين', 2.58, 23.03, '#FFE619'], ['Paleogene', 'الباليوجين', 23.03, 66, '#FD9A52'], ['Cretaceous', 'الطباشيري', 66, 145, '#7FC64E'], ['Jurassic', 'الجوراسي', 145, 201.4, '#34B2C9'], ['Triassic', 'الترياسي', 201.4, 251.902, '#812B92'],
    ['Permian', 'البرمي', 251.902, 298.9, '#F04028'], ['Carboniferous', 'الكربوني', 298.9, 358.9, '#67A599'], ['Devonian', 'الديفوني', 358.9, 419.2, '#CB8C37'], ['Silurian', 'السيلوري', 419.2, 443.8, '#B3E1B6'], ['Ordovician', 'الأوردوفيشي', 443.8, 485.4, '#009270'], ['Cambrian', 'الكامبري', 485.4, 538.8, '#7FA056'], ['Ediacaran', 'الإدياكاري', 538.8, 635, '#FED96A'], ['Cryogenian', 'الكرايوجيني', 635, 720, '#FECC5C'], ['Tonian', 'التوني', 720, 1000, '#FEBF4E'], ['Mesoproterozoic', 'البروتيروزوي الأوسط', 1000, 1600, '#FDB462'], ['Paleoproterozoic', 'البروتيروزوي القديم', 1600, 2500, '#F74370'], ['Archean', 'الأركي', 2500, 4031, '#F0047F'], ['Hadean', 'الهادي', 4031, 4567, '#AE027E']];
  SH.icsAt = function (ma) { for (var i = 0; i < SH.ics.length; i++) if (ma >= SH.ics[i][2] && ma <= SH.ics[i][3]) return SH.ics[i]; return null; };
  SH.seg = function (id) { var b = d.querySelector('#' + id + ' button[aria-pressed=true]'); return b ? b.getAttribute('data-v') : null; };
  d.addEventListener('input', function (e) { var r = e.target; if (r.type === 'range' && r.nextElementSibling && r.nextElementSibling.tagName === 'OUTPUT') r.nextElementSibling.textContent = r.value; });

  d.addEventListener('DOMContentLoaded', function () {
    SH.gate();
    var sl = d.body.getAttribute('data-slug'); if (sl) { var rec = SH.store.get('shandal_recent', []).filter(function (r) { return r.s !== sl; }); rec.unshift({ s: sl, n: d.body.getAttribute('data-tname'), t: Date.now(), l: lang }); SH.store.set('shandal_recent', rec.slice(0, 12)); }
    $$('.range input[type=range]').forEach(function (r) { if (r.nextElementSibling && r.nextElementSibling.tagName === 'OUTPUT') r.nextElementSibling.textContent = r.value; });
    var rb = d.getElementById('reportBtn'); if (rb) rb.addEventListener('click', function () { if (d.dispatchEvent(new CustomEvent('sh:beforereport', { cancelable: true }))) SH.report(rb.getAttribute('data-title')); });
  });
  /* floating help tips: positioned in the viewport so they are never clipped by narrow panels */
  (function () {
    var box = null, cur = null;
    function hide() { if (box) { box.remove(); box = null; } cur = null; }
    function show(el) { hide(); var tx = el.getAttribute('data-tip'); if (!tx) return; cur = el; box = d.createElement('div'); box.className = 'tipbox'; box.textContent = tx; box.setAttribute('dir', SH.lang === 'ar' ? 'rtl' : 'ltr'); d.body.appendChild(box);
      var r = el.getBoundingClientRect(), bw = Math.min(280, w.innerWidth - 16); box.style.width = bw + 'px'; var bh = box.offsetHeight, x = Math.max(8, Math.min(w.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)), y = r.top - bh - 8; if (y < 8) y = r.bottom + 8; box.style.left = x + 'px'; box.style.top = y + 'px'; }
    d.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('.tip'); if (t && t !== cur) show(t); else if (!t && cur) hide(); });
    d.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('.tip'); if (t) show(t); });
    d.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.tip')) hide(); });
    d.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('.tip'); if (t) { e.preventDefault(); if (cur === t) hide(); else show(t); } else if (cur) hide(); });
    w.addEventListener('scroll', function () { if (cur) { var r = cur.getBoundingClientRect(); if (r.bottom < 0 || r.top > w.innerHeight) hide(); else show(cur); } }, true); w.addEventListener('resize', hide);
  })();
  /* offline shell: keep the last good copy of pages and assets for use in the field without a connection */
  if ('serviceWorker' in navigator && location.protocol === 'https:') w.addEventListener('load', function () { navigator.serviceWorker.register(SH.base + 'sw.js').catch(function () {}); });
})(window);
