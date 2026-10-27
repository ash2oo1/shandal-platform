/* Shandal report engine — builds an A4 PDF from the current workspace and saves it directly (no print dialog).
   Every page carries the emblem, system name, report title and date in the header, and "page X of N",
   report code and site address in the footer. Content: cover block (prepared by, date, code, QR),
   tool summary, input data, results (KPIs, verdicts, figures, tables, narrative), method and references.
   Figures are rasterised from Plotly, SVG, canvas and Leaflet. Language follows the page. */
(function (w) {
  'use strict';
  var d = document, SH = w.SH, t = SH.t, AR = SH.lang === 'ar';
  var LIBS = [SH.base + 'assets/vendor/pdf/html2canvas.min.js', SH.base + 'assets/vendor/pdf/jspdf.umd.min.js'];
  var PW = 794, PH = 1123, PAD = 46, HEAD = 74, FOOT = 46;

  function load(src) { return new Promise(function (res, rej) { var s = d.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error(t('Could not load the PDF library. Check the internet connection.', 'تعذر تحميل مكتبة PDF. تحقق من الاتصال بالإنترنت.'))); }; d.head.appendChild(s); }); }
  function libs() { return (w.html2canvas && w.jspdf ? Promise.resolve() : LIBS.reduce(function (p, u) { return p.then(function () { return load(u); }); }, Promise.resolve())); }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var el = function (tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  var vis = function (e) { return !!(e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'); };
  var txt = function (e) { return (e ? e.textContent : '').replace(/\s+/g, ' ').trim(); };

  /* html2canvas cannot parse color(), color-mix(), oklch()… : inline sRGB equivalents in the cloned DOM */
  var CPROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'text-decoration-color', 'fill', 'stroke', 'column-rule-color', 'caret-color'];
  function srgb(v) { return v.replace(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+%?))?\)/g, function (m, r, g, b, a) { var A = a == null ? 1 : /%$/.test(a) ? parseFloat(a) / 100 : +a; return 'rgba(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ',' + A + ')'; }).replace(/(oklch|oklab|lab|lch)\([^)]*\)/g, 'rgba(128,128,128,1)'); }
  function fixColors(root, win) { var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*'))); all.forEach(function (e) { var cs = win.getComputedStyle(e); CPROPS.forEach(function (p) { var v = cs.getPropertyValue(p); if (v && /color\(|oklch|oklab|lab\(|lch\(/.test(v)) e.style.setProperty(p, srgb(v), 'important'); }); }); }
  /* the site resets img to display:block, which breaks html2canvas's font-baseline probe (a tiny GIF set inline
     next to a text span) and drops every line of text towards the bottom of its box: restore inline for that probe */
  (function () { var st = d.createElement('style'); st.textContent = 'img[src^="data:image/gif"]{display:inline!important;vertical-align:baseline!important;max-width:none!important}'; d.head.appendChild(st); })();
  var ONCLONE = function (doc, el) { try { fixColors(el, doc.defaultView); } catch (e) {} };

  /* ---------------------------------------------------------------- figure rasterisation */
  function imgFromURL(url) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = url; }); }
  var PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline', 'paint-order', 'direction'];
  function svgImg(svg) {
    var r = svg.getBoundingClientRect(), W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    var c = svg.cloneNode(true), a = svg.querySelectorAll('*'), b = c.querySelectorAll('*');
    for (var i = 0; i < a.length; i++) { var cs = getComputedStyle(a[i]), st = ''; PROPS.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) st += p + ':' + v + ';'; }); b[i].setAttribute('style', st + (b[i].getAttribute('style') || '')); }
    var cs0 = getComputedStyle(svg); c.setAttribute('width', W); c.setAttribute('height', H); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('style', 'color:' + cs0.color + ';font-family:' + cs0.fontFamily + ';background:transparent');
    var s = new XMLSerializer().serializeToString(c), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    return imgFromURL(url).then(function (im) { var cv = d.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); return { src: cv.toDataURL('image/png'), w: W, h: H }; });
  }
  function plotImg(gd) { var W = gd.offsetWidth || 700, H = gd.offsetHeight || 400; return w.Plotly.toImage(gd, { format: 'png', width: W, height: H, scale: 2 }).then(function (u) { return { src: u, w: W, h: H }; }); }
  /* Leaflet: draw the loaded tiles ourselves (html2canvas often leaves them blank), then the overlays and
     markers on top, then a proper graphic scale and north arrow in place of the on-screen controls */
  function tileImg(t) { return new Promise(function (res) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = t.src; }); }
  function mapImg(m, bare) {
    var W = m.offsetWidth, H = m.offsetHeight, R0 = m.getBoundingClientRect(), lm = m._shMap;
    var tiles = Array.prototype.filter.call(m.querySelectorAll('.leaflet-tile-pane img.leaflet-tile'), function (t) { var r = t.getBoundingClientRect(); return t.classList.contains('leaflet-tile-loaded') && r.right > R0.left && r.left < R0.right && r.bottom > R0.top && r.top < R0.bottom && getComputedStyle(t.closest('.leaflet-layer') || t).opacity !== '0'; });
    if (!tiles.length) return mapImg0(m);
    var cv = d.createElement('canvas'), k = 2; cv.width = W * k; cv.height = H * k; var x = cv.getContext('2d'); x.fillStyle = '#e9e6df'; x.fillRect(0, 0, cv.width, cv.height);
    return Promise.all(tiles.map(tileImg)).then(function (ims) { ims.forEach(function (im, i) { if (!im) return; var t = tiles[i], r = t.getBoundingClientRect(), lay = t.closest('.leaflet-layer'), op = lay ? parseFloat(getComputedStyle(lay).opacity) : 1; x.globalAlpha = isFinite(op) ? op : 1; x.drawImage(im, (r.left - R0.left) * k, (r.top - R0.top) * k, r.width * k, r.height * k); }); x.globalAlpha = 1; }).then(function () {
      return w.html2canvas(m, { useCORS: true, scale: k, backgroundColor: null, onclone: function (doc, el) { ONCLONE(doc, el); el.style.setProperty('background', 'transparent', 'important'); }, logging: false, ignoreElements: function (e) { return e.classList && (e.classList.contains('leaflet-tile-pane') || e.classList.contains('leaflet-overlay-pane') || e.classList.contains('leaflet-control-container') || e.classList.contains('map-tools') || e.classList.contains('map-hint') || e.classList.contains('loading')); } }).catch(function () { return null; });
    }).then(function (ov) {
      return Promise.all(Array.prototype.map.call(m.querySelectorAll('.leaflet-overlay-pane svg'), function (sv) { var r = sv.getBoundingClientRect(), c = sv.cloneNode(true); c.setAttribute('width', r.width); c.setAttribute('height', r.height); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.removeAttribute('style');
        return imgFromURL('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c))).then(function (im) { x.drawImage(im, (r.left - R0.left) * k, (r.top - R0.top) * k, r.width * k, r.height * k); }).catch(function () {}); })).then(function () { return ov; });
    }).then(function (ov) {
      if (ov && ov.width && ov.height) x.drawImage(ov, 0, 0, cv.width, cv.height);
      if (lm && w.L && !bare) try { mapDeco(x, k, W, H, lm, m); } catch (e) {}
      return { src: cv.toDataURL('image/jpeg', .92), w: W, h: H };
    });
  }
  function mapDeco(x, k, W, H, lm, m) {
    var y = H / 2, a = lm.containerPointToLatLng([0, y]), b = lm.containerPointToLatLng([100, y]), mpp = lm.distance(a, b) / 100, want = mpp * Math.min(160, W * 0.3), p = Math.pow(10, Math.floor(Math.log10(want))), n = want / p, len = (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p, px = len / mpp;
    var lab = len >= 1000 ? (len / 1000) + ' km' : len + ' m', x0 = 14, y0 = H - 22;
    x.save(); x.scale(k, k); x.fillStyle = 'rgba(255,255,255,.88)'; x.fillRect(x0 - 8, y0 - 18, px + 64, 32);
    for (var i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#fff' : '#1B232B'; x.fillRect(x0 + i * px / 4, y0, px / 4, 6); } x.strokeStyle = '#1B232B'; x.lineWidth = .8; x.strokeRect(x0, y0, px, 6);
    x.fillStyle = '#1B232B'; x.font = '700 10px Manrope, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('0', x0, y0 - 5); x.fillText(lab, x0 + px, y0 - 5); x.textAlign = 'left';
    var cx = W - 30, cy = 18; x.fillStyle = 'rgba(255,255,255,.88)'; x.beginPath(); x.arc(cx, cy + 18, 20, 0, 2 * Math.PI); x.fill();
    x.fillStyle = '#1B232B'; x.textAlign = 'center'; x.font = '800 11px Manrope, Arial, sans-serif'; x.fillText('N', cx, cy + 9); x.beginPath(); x.moveTo(cx, cy + 12); x.lineTo(cx - 7, cy + 34); x.lineTo(cx, cy + 29); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(cx, cy + 12); x.lineTo(cx + 7, cy + 34); x.lineTo(cx, cy + 29); x.closePath(); x.fillStyle = '#fff'; x.fill(); x.stroke();
    var at = m.querySelector('.leaflet-control-attribution'), tx = at ? at.textContent.replace(/^.*?\|\s*/, '').replace(/\s+/g, ' ').trim() : ''; if (tx) { x.font = '8px Manrope, Arial, sans-serif'; var tw = x.measureText(tx).width; x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(W - tw - 10, H - 13, tw + 10, 13); x.fillStyle = '#333'; x.textAlign = 'right'; x.fillText(tx, W - 5, H - 3.5); }
    x.restore();
  }
  function mapImg0(m) { var W = m.offsetWidth, H = m.offsetHeight; return w.html2canvas(m, { useCORS: true, scale: 2, imageTimeout: 8000, onclone: ONCLONE, backgroundColor: '#ffffff', logging: false, ignoreElements: function (e) { return e.classList && (e.classList.contains('leaflet-control-zoom') || e.classList.contains('leaflet-control-layers') || e.classList.contains('map-tools') || e.classList.contains('map-hint') || e.classList.contains('loading')); } }).then(function (cv) { return { src: cv.toDataURL('image/jpeg', .9), w: W, h: H }; }); }
  function canvasImg(cv) { var r = cv.getBoundingClientRect(); return Promise.resolve({ src: cv.toDataURL('image/png'), w: r.width || cv.width, h: r.height || cv.height }); }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]); }
  function figOf(e) { return timeout(figOf0(e), 25000); }
  function figOf0(e) {
    if (e.classList.contains('js-plotly-plot') && w.Plotly) return plotImg(e);
    if (e.classList.contains('leaflet-container')) return mapImg(e);
    if (e.tagName === 'CANVAS') return canvasImg(e);
    if (e.tagName.toLowerCase() === 'svg') return svgImg(e);
    return Promise.resolve(null);
  }
  /* clone a node, replacing plots / maps / svgs / canvases by images (in order) */
  function cloneWithFigures(node) {
    var sel = '.js-plotly-plot, .leaflet-container, canvas, svg', src = Array.prototype.filter.call(node.querySelectorAll(sel), keep);
    function keep(e) { if (e.closest('.js-plotly-plot') && !e.classList.contains('js-plotly-plot')) return false; if (e.closest('.leaflet-container') && !e.classList.contains('leaflet-container')) return false; if (e.tagName.toLowerCase() === 'svg' && (e.classList.contains('ico') || e.getBoundingClientRect().width < 60)) return false; return vis(e); }
    if (node.classList.contains('wsm-map')) return mapImg(node).then(function (im) { var f = el('figure', 'rp-fig'), g = d.createElement('img'); g.src = im.src; g.className = 'rp-img'; g.style.aspectRatio = im.w + ' / ' + im.h; f.appendChild(g); return f; });
    var c;
    src.forEach(function (e, i) { e.setAttribute('data-rp', i); });
    var flds = node.querySelectorAll('td input:not([type=checkbox]):not([type=hidden]), td select'); flds.forEach(function (f) { f.setAttribute('data-rpv', f.tagName === 'SELECT' ? (f.selectedOptions[0] ? f.selectedOptions[0].textContent : '') : f.value); });
    c = node.cloneNode(true); src.forEach(function (e) { e.removeAttribute('data-rp'); }); flds.forEach(function (f) { f.removeAttribute('data-rpv'); });
    c.querySelectorAll('[data-rpv]').forEach(function (f) { var sp = d.createElement('span'); sp.textContent = f.getAttribute('data-rpv'); f.replaceWith(sp); });
    return Promise.all(src.map(function (e, i) { return figOf(e).catch(function () { return null; }).then(function (im) { var tgt = c.querySelector('[data-rp="' + i + '"]'); if (!tgt) return; if (!im) { tgt.remove(); return; } var g = d.createElement('img'); g.src = im.src; g.className = 'rp-img'; g.style.aspectRatio = im.w + ' / ' + im.h; tgt.replaceWith(g); }); })).then(function () {
      c.querySelectorAll('button, .btn, .no-print, .map-tools, .map-hint, .loading, [hidden], input, select, textarea, .tip, .leaflet-control-container').forEach(function (e) { if (e.closest('.fig-h') && e.tagName === 'BUTTON') { e.remove(); return; } e.remove(); });
      c.querySelectorAll('[data-rp]').forEach(function (e) { e.removeAttribute('data-rp'); });
      return c;
    });
  }

  /* ---------------------------------------------------------------- content collection */
  function inputs(side) {
    var groups = [];
    side.querySelectorAll('.pn, .sec').forEach(function (p) {
      if (!vis(p)) return; var h = p.querySelector('.pn-h h2, h3'), rows = [];
      p.querySelectorAll('.fg').forEach(function (f) {
        if (!vis(f) || f.closest('[data-rp-skip]')) return; var lab = f.querySelector('label'), c = f.querySelector('input, select, textarea'); if (!c || !lab || c.closest('.chks') || c.type === 'file' || c.type === 'color' || c.type === 'hidden') return;
        var v = c.tagName === 'SELECT' ? (c.selectedOptions[0] ? c.selectedOptions[0].textContent : '') : c.type === 'checkbox' ? (c.checked ? '✓' : '') : c.value;
        v = String(v || '').trim(); if (!v) return; var l = lab ? lab.cloneNode(true) : null; if (l) l.querySelectorAll('.tip').forEach(function (x) { x.remove(); });
        rows.push([l ? txt(l) : (c.getAttribute('aria-label') || c.id), v]);
      });
      p.querySelectorAll('.chks').forEach(function (g) { if (!vis(g) || g.closest('[data-rp-skip]')) return; var on = Array.prototype.filter.call(g.querySelectorAll('label'), function (lb) { var c = lb.querySelector('input[type=checkbox]'); return c && c.checked; }).map(txt); if (!on.length) return; var f = g.closest('.fg'), lb = f && f.querySelector(':scope > .lb, :scope > label'); rows.push([lb ? txt(lb) : t('Selected', 'المحدد'), on.join(AR ? '، ' : ', ')]); });
      if (rows.length) groups.push({ h: h ? txt(h).replace(/^\d+\s*/, '') : '', rows: rows });
    });
    return groups;
  }
  function results() {
    var main = d.querySelector('.ws-main'), out = [];
    if (main) {
      Array.prototype.forEach.call(main.children, function (e) { if (vis(e) && !e.classList.contains('empty-s') && !e.querySelector(':scope > .empty-s')) out.push(e); });
    } else {
      var mp = d.querySelector('.wsm-map .leaflet-container'); if (mp) out.push(mp.parentElement);
      var side = d.querySelector('.wsm-side');
      if (side) side.querySelectorAll('.sec, [data-v]:not([hidden]) > .sec').forEach(function (s) { if (vis(s) && !s.querySelector('input:not([type=checkbox]), select, textarea') && s.textContent.trim().length > 20) out.push(s); });
      if (side) Array.prototype.forEach.call(side.children, function (s) { if (vis(s) && !s.classList.contains('sec') && !s.matches('[data-v]') && s.children.length && !s.querySelector('input, select')) out.push(s); });
    }
    return out.filter(function (e, i, a) { return a.indexOf(e) === i && !a.some(function (o) { return o !== e && o.contains(e); }); });
  }

  /* break a results container into page-sized atomic pieces (figures, KPI rows, verdicts, tables, paragraphs) */
  var ATOM = '.fig, .kpis, .kpi, .verdict, .tbl-wrap, table, figure, img, .plot, p, h2, h3, h4, .fx-card, .note, .rp-fig, ul, ol, .pn-h';
  function flatten(n) {
    if (n.matches && n.matches(ATOM)) return [n];
    var kids = Array.prototype.filter.call(n.children || [], function (k) { return k.textContent.trim() || k.querySelector('img'); });
    if (!kids.length) return n.textContent.trim() ? [n] : [];
    if (kids.length === 1 && !kids[0].matches(ATOM) && !n.matches('.pn, .sec')) return flatten(kids[0]);
    var out = [];
    if (n.matches('.pn') && n.querySelector(':scope > .pn-h')) { /* keep panel heading with its body */ }
    kids.forEach(function (k) { out = out.concat(flatten(k)); });
    return out;
  }

  /* ---------------------------------------------------------------- page factory */
  function page(meta, n) {
    var p = el('div', 'rp-page'); p.setAttribute('dir', AR ? 'rtl' : 'ltr'); p.setAttribute('lang', SH.lang);
    p.innerHTML = '<header class="rp-head"><div class="rp-logo"><img src="' + SH.base + 'assets/img/emblem-192.png" alt=""><div class="rp-brand"><b>' + t('Shandal System', 'نظام شندل') + '</b><span>' + t('Geological Field Survey', 'للمسح الميداني الجيولوجي') + '</span></div></div><div class="rp-ht"><b>' + SH.esc(meta.title) + '</b><span>' + SH.esc(meta.date) + '</span></div></header>' +
      '<main class="rp-body"></main><footer class="rp-foot"><span>geologicalfieldsurvey.com</span><span class="rp-code">' + meta.code + '</span><span class="rp-pn">' + t('Page ', 'الصفحة ') + '<b data-pn>' + n + '</b>' + t(' of ', ' من ') + '<b data-pt></b></span></footer>';
    return p;
  }

  SH.mapImage = function (m, bare) { return libs().then(function () { return mapImg(m, bare); }); };
  SH.svgImage = function (svg) { return libs().then(function () { return svgImg(svg); }); };
  SH.loadImage = imgFromURL;
  /* save a canvas as PNG, JPG or a one-page PDF (orientation follows the canvas) */
  SH.exportCanvas = function (cv, name, fmt) {
    if (fmt === 'pdf') return libs().then(function () { var land = cv.width > cv.height, pdf = new w.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: land ? 'landscape' : 'portrait', compress: true }), pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 20, k = Math.min((pw - 2 * m) / cv.width, (ph - 2 * m) / cv.height);
      pdf.addImage(cv.toDataURL('image/jpeg', .95), 'JPEG', (pw - cv.width * k) / 2, (ph - cv.height * k) / 2, cv.width * k, cv.height * k); return SH.download(name + '.pdf', pdf.output('blob')); });
    return new Promise(function (res) { cv.toBlob(function (b) { res(SH.download(name + (fmt === 'jpg' ? '.jpg' : '.png'), b)); }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', .95); });
  };
  /* export one figure (Leaflet map element or SVG) as PNG, JPG or a one-page PDF */
  SH.exportFigure = function (node, name, fmt) {
    var get = node.tagName && node.tagName.toLowerCase() === 'svg' ? SH.svgImage(node) : SH.mapImage(node);
    return get.then(function (im) { return imgFromURL(im.src).then(function (i) {
      var cv = d.createElement('canvas'); cv.width = i.naturalWidth; cv.height = i.naturalHeight; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(i, 0, 0); return SH.exportCanvas(cv, name, fmt); }); });
  };
  SH.report = function (title) {
    var host = d.body, meta0 = {}; try { meta0 = JSON.parse((d.getElementById('toolMeta') || {}).textContent || '{}'); } catch (e) {}
    var s = SH.session(), geo = (d.getElementById('geoName') && d.getElementById('geoName').value) || (d.getElementById('qGeo') && d.getElementById('qGeo').value) || (s && s.name) || '—';
    var now = new Date(), code = SH.uid('SHD'), dateStr = now.toLocaleDateString(AR ? 'ar-IQ-u-nu-latn' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    var meta = { title: title || meta0.name || d.title, date: dateStr, code: code };
    var wasDark = SH.isDark(), root = d.documentElement, prevTheme = root.getAttribute('data-theme');
    var stage = el('div', 'rp-stage'); stage.setAttribute('aria-hidden', 'true');
    SH.busy(host, true, t('Preparing your PDF report…', 'جارٍ إعداد تقرير PDF…'));
    var lw = host.querySelector(':scope > .loading'); if (lw) lw.style.position = 'fixed';
    return libs().then(function () {
      if (wasDark) { root.setAttribute('data-theme', 'light'); d.dispatchEvent(new CustomEvent('themechange')); return wait(700); }
    }).then(function () {
      var side = d.querySelector('.ws-side, .wsm-side'), ins = side ? inputs(side) : [], res = results();
      return Promise.all(res.map(function (r) { return cloneWithFigures(r).catch(function () { return null; }); })).then(function (cl) { return { ins: ins, res: cl.filter(Boolean) }; });
    }).then(function (C) {
      d.body.appendChild(stage);
      var blocks = [];
      // cover block
      var qr = el('div', 'rp-qr');
      if (w.QRCode) { try { new w.QRCode(qr, { text: location.origin + location.pathname.replace(/(ar\/)?tools\/.*$/, '') + 'verify/index.html?code=' + code, width: 96, height: 96, correctLevel: w.QRCode.CorrectLevel.M }); } catch (e) {} }
      var cover = el('section', 'rp-cover', '<div class="rp-kicker">' + SH.esc(meta0.cat || '') + ' · ' + t('Technical report', 'تقرير فني') + '</div><h1>' + SH.esc(meta.title) + '</h1>' +
        '<table class="rp-meta"><tr><th>' + t('Prepared by', 'إعداد') + '</th><td>' + SH.esc(geo) + '</td></tr><tr><th>' + t('Date of issue', 'تاريخ الإصدار') + '</th><td>' + SH.esc(dateStr) + '</td></tr><tr><th>' + t('Report code', 'رمز التقرير') + '</th><td class="ltr">' + code + '</td></tr><tr><th>' + t('Issued by', 'الجهة المُصدِرة') + '</th><td>' + t('Shandal Geological Field Survey System', 'نظام شندل للمسح الميداني الجيولوجي') + '</td></tr></table>');
      var qcv = qr.querySelector('canvas'); if (qcv) { try { var qi = new Image(); qi.src = qcv.toDataURL('image/png'); qr.innerHTML = ''; qr.appendChild(qi); } catch (e) {} }
      var qb = el('div', 'rp-qrbox'); qb.appendChild(qr); qb.appendChild(el('span', '', t('Verify', 'التحقق'))); cover.appendChild(qb); blocks.push(cover);
      var sec = 0, H = function (en, ar) { sec++; return el('h2', 'rp-h2', '<svg class="rp-n" width="28" height="28" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#121b24"/><text x="14" y="19" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Manrope,Arial,sans-serif">' + sec + '</text></svg><span class="rp-t">' + t(en, ar) + '</span>'); };
      var paged = !!d.querySelector('.ws-main [data-rp-paged]');
      if (meta0.summary) { blocks.push(H('Purpose and scope', 'الغرض والنطاق')); blocks.push(el('p', 'rp-p', SH.esc(meta0.summary))); }
      if (C.ins.length) {
        var hi = H('Input data', 'البيانات المُدخلة'); if (paged) hi.rpBreak = true; blocks.push(hi);
        C.ins.forEach(function (g) { blocks.push(el('div', 'rp-tbl', (g.h ? '<h3>' + SH.esc(g.h) + '</h3>' : '') + '<table>' + g.rows.map(function (r) { return '<tr><th>' + SH.esc(r[0]) + '</th><td>' + SH.esc(r[1]) + '</td></tr>'; }).join('') + '</table>')); });
      }
      if (C.res.length) {
        var hr = H('Results and interpretation', 'النتائج والتفسير'); if (paged) hr.rpBreak = true; blocks.push(hr);
        var lastPg = null, first = true;
        C.res.forEach(function (r) { var atoms = flatten(r), flags = atoms.map(function (a) { var pg = a.closest ? a.closest('[data-rp-page]') : null, f = pg && pg !== lastPg; if (pg) lastPg = pg; return f; });
          atoms.forEach(function (a, i) { var b = el('div', 'rp-res'); b.appendChild(a); if (flags[i] && !first) b.rpBreak = true; first = false; blocks.push(b); }); });
      }
      if (!paged && ((meta0.method || []).length || (meta0.refs || []).length)) {
        blocks.push(H('Method and references', 'المنهجية والمراجع'));
        (meta0.method || []).forEach(function (m) { blocks.push(el('div', 'rp-m', (m.h ? '<h3>' + SH.esc(m.h) + '</h3>' : '') + '<p class="rp-p">' + SH.esc(m.p) + '</p>' + (m.eq ? '<p class="rp-eq ltr">' + m.eq + '</p>' : ''))); });
        if ((meta0.refs || []).length) blocks.push(el('ol', 'rp-refs', meta0.refs.map(function (r) { return '<li dir="ltr">' + SH.esc(r) + '</li>'; }).join('')));
      }
      blocks.push(el('p', 'rp-disc', t('This report was generated automatically by Shandal System from the data entered and from the cited public data services. Results support, and do not replace, professional judgement and site investigation.', 'أُنشئ هذا التقرير آلياً بواسطة نظام شندل من البيانات المُدخلة ومن خدمات البيانات العامة المذكورة. النتائج تدعم الحكم المهني والتحري الموقعي ولا تغني عنهما.')));
      // paginate
      var pages = [], cur = null, n = 0, room = PH - HEAD - FOOT - 2 * 18;
      function newPage() { cur = page(meta, ++n); stage.appendChild(cur); pages.push(cur); return cur.querySelector('.rp-body'); }
      var body = newPage();
      function fits() { return body.scrollHeight <= body.clientHeight + 1; }
      function place(b, depth) {
        if (b.rpBreak && body.children.length) body = newPage();
        body.appendChild(b); if (fits()) return;
        b.remove();
        if (body.children.length) { body = newPage(); body.appendChild(b); if (fits()) return; b.remove(); }
        // oversize block on an empty page: split
        var tb = b.querySelector('table'), kids = b.children;
        if (tb && tb.rows.length > 2 && depth < 4) {
          var rows = Array.prototype.slice.call(tb.rows), head = tb.tHead ? tb.tHead.cloneNode(true) : null, part = b.cloneNode(true), pt = part.querySelector('table');
          while (pt.rows.length) pt.deleteRow(0); if (head) pt.appendChild(head);
          body.appendChild(part); var tbody = pt.tBodies[0] || pt.appendChild(d.createElement('tbody'));
          for (var i = 0; i < rows.length; i++) { if (rows[i].parentElement && rows[i].parentElement.tagName === 'THEAD') continue; tbody.appendChild(rows[i].cloneNode(true)); if (!fits()) { tbody.lastChild.remove(); if (!tbody.rows.length && part.previousElementSibling) { part.remove(); body = newPage(); place(b, depth + 1); return; } var rest = b.cloneNode(true), rt = rest.querySelector('table'); while (rt.rows.length) rt.deleteRow(0); if (head) rt.appendChild(head.cloneNode(true)); var rb = d.createElement('tbody'); rt.appendChild(rb); rows.slice(i).forEach(function (r) { if (!(r.parentElement && r.parentElement.tagName === 'THEAD')) rb.appendChild(r.cloneNode(true)); }); body = newPage(); place(rest, depth + 1); return; } }
          return;
        }
        if (kids.length > 1 && depth < 6) { var arr = Array.prototype.slice.call(kids); arr.forEach(function (k) { var wrap = b.cloneNode(false); wrap.appendChild(k); place(wrap, depth + 1); }); return; }
        body.appendChild(b); b.querySelectorAll('img').forEach(function (im) { im.style.maxHeight = (room - 80) + 'px'; im.style.width = 'auto'; im.style.maxWidth = '100%'; });
      }
      return Promise.all(Array.prototype.map.call(stage.querySelectorAll('img'), function () {})).then(function () {
        // images must be decoded to measure correctly
        var imgs = []; blocks.forEach(function (b) { b.querySelectorAll && b.querySelectorAll('img').forEach(function (i) { imgs.push(i); }); });
        return Promise.all(imgs.map(function (i) { return i.decode ? i.decode().catch(function () {}) : null; }));
      }).then(function () {
        blocks.forEach(function (b) { place(b, 0); });
        pages.forEach(function (p) { p.querySelector('[data-pt]').textContent = pages.length; });
        return wait(150);
      }).then(function () {
        var pdf = new w.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true }), pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        pdf.setProperties({ title: meta.title, subject: meta0.cat || '', author: geo, creator: 'Shandal System — geologicalfieldsurvey.com', keywords: code });
        return pages.reduce(function (p, pg, i) {
          return p.then(function () { SH.busy(host, true, t('Rendering page ', 'جارٍ إخراج الصفحة ') + (i + 1) + t(' of ', ' من ') + pages.length + '…'); return w.html2canvas(pg, { scale: 2, useCORS: true, onclone: ONCLONE, backgroundColor: '#ffffff', logging: false, width: PW, height: PH, windowWidth: PW }); })
            .then(function (cv) { if (i) pdf.addPage(); pdf.addImage(cv.toDataURL('image/jpeg', .93), 'JPEG', 0, 0, pw, ph, undefined, 'FAST'); });
        }, Promise.resolve()).then(function () { return pdf; });
      });
    }).then(function (pdf) {
      var name = ('Shandal-' + (d.body.getAttribute('data-slug') || 'report') + '-' + now.toISOString().slice(0, 10) + '-' + code + '.pdf').replace(/[^\w.\-]+/g, '-');
      var blob = pdf.output('blob');
      return SH.saveFile(blob, name, 'application/pdf');
    }).then(function (ok) {
      if (ok !== false) SH.toast(t('Report saved.', 'تم حفظ التقرير.'), 'ok');
    }).catch(function (e) { if (e && e.name === 'AbortError') return; SH.toast((e && e.message) || String(e), 'bad'); })
      .then(function () {
        stage.remove(); SH.busy(host, false); if (lw) lw.style.position = '';
        if (wasDark) { if (prevTheme) root.setAttribute('data-theme', prevTheme); else root.removeAttribute('data-theme'); d.dispatchEvent(new CustomEvent('themechange')); }
      });
  };

  /* Save a blob: native "Save as" picker where supported (choose any folder), otherwise a normal download. */
  SH.saveFile = function (blob, name, type) {
    if (w.showSaveFilePicker && w.self === w.top) {
      var ext = '.' + name.split('.').pop();
      var acc = {}; acc[type] = [ext];
      return w.showSaveFilePicker({ suggestedName: name, types: [{ description: ext.slice(1).toUpperCase(), accept: acc }] })
        .then(function (h) { return h.createWritable(); }).then(function (ws) { return ws.write(blob).then(function () { return ws.close(); }); })
        .then(function () { return true; })
        .catch(function (e) { if (e && e.name === 'AbortError') return false; return dl(); });
    }
    return Promise.resolve(dl());
    function dl() { var u = URL.createObjectURL(blob), a = d.createElement('a'); a.href = u; a.download = name; d.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); return true; }
  };
})(window);
