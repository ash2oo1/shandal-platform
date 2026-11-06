/* Shandal Visual Lab — engine for animated, interactive geology lessons.
   A lesson registers { dur, steps, params, render(t, P) } where render returns the inner SVG of a 960 × 540 stage for
   time t (seconds). The engine plays, scrubs and steps the lesson, shows the caption of the current step, rebuilds
   the scene when a parameter changes, and exports the current frame (PNG, JPG, PDF) or the whole lesson as a video
   recorded in the browser (MP4 where the browser can encode it, WebM otherwise), each stamped with the Shandal strip. */
(function () {
  'use strict';
  var w = window, d = document, SHL = w.SHL = w.SHL || {}, AR = (d.documentElement.lang || 'ar').slice(0, 2) === 'ar';
  SHL.reg = SHL.reg || {}; SHL.W = 960; SHL.H = 540; SHL.AR = AR;
  SHL.add = function (slug, def) { SHL.reg[slug] = def; };
  var T = SHL.t = function (en, ar) { return AR ? ar : en; };

  /* ---------------------------------------------------------------- helpers */
  var clamp = SHL.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  SHL.lerp = function (a, b, f) { return a + (b - a) * f; };
  SHL.seg = function (t, a, b) { return clamp((t - a) / (b - a), 0, 1); };
  SHL.ease = function (f) { return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; };
  SHL.rnd = function (seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; };
  SHL.f = function (v) { return Math.round(v * 10) / 10; };
  SHL.pts = function (P) { return P.map(function (p) { return SHL.f(p[0]) + ',' + SHL.f(p[1]); }).join(' '); };
  SHL.pathD = function (P, close) { return 'M' + P.map(function (p) { return SHL.f(p[0]) + ' ' + SHL.f(p[1]); }).join('L') + (close ? 'Z' : ''); };
  SHL.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var FONT = "'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";
  SHL.FONT = FONT;

  /* standard lithology symbols (sandstone dots, shale dashes, limestone bricks, conglomerate pebbles, granite crosses,
     basalt v's, metamorphic waves) laid over a lithology colour */
  SHL.LITH = {
    sand: ['#EBCB7A', 'pSand'], shale: ['#9DB08C', 'pShale'], lime: ['#B9D0DF', 'pLime'], cong: ['#D9A877', 'pCong'], marl: ['#CFC7A6', 'pShale'],
    granite: ['#F2A9A0', 'pGran'], basalt: ['#5F6170', 'pBas'], meta: ['#B79FC9', 'pMeta'], salt: ['#F3F1EA', 'pSalt'], mantle: ['#C9734A', null], ocean: ['#3F5F7A', 'pBas']
  };
  SHL.defs = function () {
    return '<defs>' +
      '<pattern id="pSand" width="14" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" fill="#7A5B1E" opacity=".55"/><circle cx="10" cy="7.5" r="1.1" fill="#7A5B1E" opacity=".55"/></pattern>' +
      '<pattern id="pShale" width="22" height="8" patternUnits="userSpaceOnUse"><path d="M2 3h9M13 7h7" stroke="#3E4F35" stroke-width="1.1" opacity=".55"/></pattern>' +
      '<pattern id="pLime" width="28" height="14" patternUnits="userSpaceOnUse"><path d="M0 0.5h28M0 7.5h28M7 0.5v7M21 7.5v7" stroke="#3D5568" stroke-width="1" fill="none" opacity=".55"/></pattern>' +
      '<pattern id="pCong" width="20" height="14" patternUnits="userSpaceOnUse"><circle cx="5" cy="4" r="2.6" fill="none" stroke="#6B4320" stroke-width="1" opacity=".6"/><circle cx="14" cy="10" r="3.2" fill="none" stroke="#6B4320" stroke-width="1" opacity=".6"/></pattern>' +
      '<pattern id="pGran" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M4 1v6M1 4h6M12 9v6M9 12h6" stroke="#7E2E2A" stroke-width="1.1" opacity=".55"/></pattern>' +
      '<pattern id="pBas" width="16" height="12" patternUnits="userSpaceOnUse"><path d="M2 3l2.5 4 2.5-4M10 8l2.5 4 2.5-4" stroke="#E6E6EA" stroke-width="1" fill="none" opacity=".45"/></pattern>' +
      '<pattern id="pMeta" width="30" height="10" patternUnits="userSpaceOnUse"><path d="M0 5q7.5-5 15 0t15 0" stroke="#4E3566" stroke-width="1.1" fill="none" opacity=".55"/></pattern>' +
      '<pattern id="pSalt" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M3 3l4 4M7 3l-4 4" stroke="#8A8577" stroke-width="1" opacity=".5"/></pattern>' +
      '<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFE6F5"/><stop offset="1" stop-color="#EEF6FB"/></linearGradient>' +
      '<linearGradient id="gSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5DA9D6" stop-opacity=".85"/><stop offset="1" stop-color="#2D6E9E" stop-opacity=".9"/></linearGradient>' +
      '<linearGradient id="gMantle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E08A4F"/><stop offset="1" stop-color="#9E3B22"/></linearGradient>' +
      '<radialGradient id="gMagma" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE08A"/><stop offset=".55" stop-color="#FF7A1A"/><stop offset="1" stop-color="#C8261B"/></radialGradient>' +
      '<marker id="mArr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker>' +
      '</defs>';
  };
  /* a lithology body: colour fill plus its symbol */
  SHL.body = function (d0, lith, extra) {
    var L = SHL.LITH[lith] || [lith, null];
    return '<path d="' + d0 + '" fill="' + L[0] + '" ' + (extra || '') + '/>' + (L[1] ? '<path d="' + d0 + '" fill="url(#' + L[1] + ')" ' + (extra || '') + '/>' : '');
  };
  SHL.arrow = function (x1, y1, x2, y2, col, wd, dash) { return '<path d="M' + SHL.f(x1) + ' ' + SHL.f(y1) + 'L' + SHL.f(x2) + ' ' + SHL.f(y2) + '" stroke="' + (col || '#1B232B') + '" stroke-width="' + (wd || 3) + '" fill="none" marker-end="url(#mArr)"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linecap="round"/>'; };
  /* label with a light halo so it reads on any background */
  SHL.text = function (x, y, s, o) {
    o = o || {}; var sz = o.size || 18; if (o.ext) o.anchor = (o.ext === 'left') === AR ? 'start' : 'end';
    return '<text x="' + SHL.f(x) + '" y="' + SHL.f(y) + '" font-family="' + FONT + '" font-size="' + sz + '" font-weight="' + (o.weight || 700) + '" fill="' + (o.fill || '#1B232B') + '" text-anchor="' + (o.anchor || 'middle') + '"' + (AR ? ' direction="rtl"' : '') +
      (o.halo === false ? '' : ' stroke="' + (o.haloCol || 'rgba(255,255,255,.9)') + '" stroke-width="' + (o.haloW || 4) + '" paint-order="stroke" stroke-linejoin="round"') + (o.op != null ? ' opacity="' + o.op + '"' : '') + '>' + SHL.esc(s) + '</text>';
  };
  SHL.tag = function (x, y, s, col) { var wd = s.length * 9 + 22; return '<g><rect x="' + SHL.f(x - wd / 2) + '" y="' + SHL.f(y - 15) + '" width="' + wd + '" height="26" rx="13" fill="' + (col || '#1B232B') + '" opacity=".9"/>' + SHL.text(x, y + 4, s, { size: 14, fill: '#fff', halo: false }) + '</g>'; };
  SHL.svg = function (inner, bg) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540"><rect width="960" height="540" fill="' + (bg || 'url(#gSky)') + '"/>' + SHL.defs() + inner + '</svg>'; };
  /* ids inside one frame are made unique, so several frames can share a page (cards, exports) */
  var NID = 0; SHL.id = function (b) { return b + '_' + NID; };
  SHL.render = function (slug, t, P) { var L = SHL.reg[slug]; NID++; return SHL.svg(L.render(t, P), L.bg); };
  SHL.defaults = function (L) { var P = {}; (L.params || []).forEach(function (p) { P[p.id] = p.val; }); return P; };
  SHL.dur = function (L, P) { return typeof L.dur === 'function' ? L.dur(P) : L.dur; };
  SHL.steps = function (L, P) { return typeof L.steps === 'function' ? L.steps(P) : L.steps; };
  /* a still frame inside any element (cards on the index page) */
  SHL.still = function (slug, el, f) { var L = SHL.reg[slug]; if (!L) return; var P = SHL.defaults(L); el.innerHTML = SHL.render(slug, (f == null ? (L.thumb != null ? L.thumb : 0.7) : f) * SHL.dur(L, P), P); };

  /* ---------------------------------------------------------------- frame to canvas (caption strip and brand) */
  var EMB = null; function emblem(base) { return EMB || (EMB = new Promise(function (r) { var i = new Image(); i.onload = function () { r(i); }; i.onerror = function () { r(null); }; i.src = base + 'assets/img/emblem-192.png'; })); }
  function svgImg(svg) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }); }
  function wrap(x, s, maxW) { var words = s.split(' '), lines = [], cur = ''; words.forEach(function (wd) { var tst = cur ? cur + ' ' + wd : wd; if (x.measureText(tst).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = tst; }); if (cur) lines.push(cur); return lines; }
  SHL.frame = function (cv, slug, t, P, opts) {
    opts = opts || {}; var L = SHL.reg[slug], sc = cv.width / 960, x = cv.getContext('2d'), capH = Math.round(150 * sc);
    return Promise.all([svgImg(SHL.render(slug, t, P)), emblem(opts.base || '')]).then(function (r) {
      x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(r[0], 0, 0, cv.width, 540 * sc);
      var y0 = 540 * sc; x.fillStyle = '#14202B'; x.fillRect(0, y0, cv.width, capH); x.fillStyle = '#B08A3E'; x.fillRect(0, y0, cv.width, Math.max(2, 3 * sc));
      var st = cur(SHL.steps(L, P), t), pad = 26 * sc, ls = 58 * sc;
      x.direction = AR ? 'rtl' : 'ltr'; x.textAlign = AR ? 'right' : 'left'; x.textBaseline = 'top';
      var tx = AR ? cv.width - pad : pad;
      x.fillStyle = '#E2C27A'; x.font = '700 ' + Math.round(22 * sc) + 'px ' + FONT; x.fillText(opts.title || '', tx, y0 + 16 * sc);
      x.fillStyle = '#fff'; x.font = '500 ' + Math.round(19 * sc) + 'px ' + FONT;
      var lines = wrap(x, st ? T(st.en, st.ar) : '', cv.width - 2 * pad - ls - 30 * sc).slice(0, 3);
      lines.forEach(function (ln, k) { x.fillText(ln, tx, y0 + (52 + k * 28) * sc); });
      var lx = AR ? pad : cv.width - pad - ls; if (r[1]) x.drawImage(r[1], lx, y0 + 18 * sc, ls, ls);
      x.direction = 'ltr'; x.textAlign = AR ? 'left' : 'right'; x.fillStyle = '#9FB0BF'; x.font = '600 ' + Math.round(13 * sc) + 'px ' + FONT;
      x.fillText('geologicalfieldsurvey.com', AR ? pad : cv.width - pad, y0 + capH - 26 * sc);
    });
  };
  function cur(S, t) { var c = S[0]; S.forEach(function (s) { if (t >= s.t) c = s; }); return c; }
  SHL.cur = cur;

  /* ---------------------------------------------------------------- lesson player */
  SHL.player = function (slug, root) {
    var L = SHL.reg[slug]; if (!L) return; var $ = function (s) { return root.querySelector(s); };
    var P = SHL.defaults(L), t = 0, playing = false, speed = 1, last = 0, raf = 0, stage = $('#lxStage'), rng = $('#lxT'), base = root.getAttribute('data-base') || '', title = root.getAttribute('data-title') || '';
    var params = $('#lxParams');
    (L.params || []).forEach(function (p) {
      var wrapEl = d.createElement('div'); wrapEl.className = 'lx-p';
      if (p.type === 'seg') { wrapEl.innerHTML = '<span class="lx-pl">' + T(p.en, p.ar) + '</span><div class="seg" data-p="' + p.id + '">' + p.opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (o[0] === p.val) + '">' + T(o[1], o[2]) + '</button>'; }).join('') + '</div>'; }
      else wrapEl.innerHTML = '<label class="lx-pl" for="lxp_' + p.id + '">' + T(p.en, p.ar) + ' <b id="lxv_' + p.id + '" dir="ltr">' + p.val + (p.unit || '') + '</b></label><input type="range" id="lxp_' + p.id + '" min="' + p.min + '" max="' + p.max + '" step="' + (p.step || 1) + '" value="' + p.val + '">';
      params.appendChild(wrapEl);
    });
    params.hidden = !(L.params || []).length;
    params.addEventListener('input', function (e) { var i = e.target; if (!i.id || i.id.indexOf('lxp_') !== 0) return; var id = i.id.slice(4), p = (L.params || []).filter(function (q) { return q.id === id; })[0]; P[id] = +i.value; $('#lxv_' + id).textContent = i.value + (p.unit || ''); setup(false); });
    params.addEventListener('click', function (e) { var b = e.target.closest('.seg button'); if (!b) return; var sg = b.parentElement, id = sg.getAttribute('data-p'); sg.querySelectorAll('button').forEach(function (q) { q.setAttribute('aria-pressed', q === b); }); var v = b.getAttribute('data-v'); P[id] = isNaN(+v) ? v : +v; t = 0; setup(true); });
    function setup(rebuildSteps) { var D = SHL.dur(L, P); rng.max = D; if (t > D) t = D; if (rebuildSteps !== false) chips(); draw(); }
    function chips() { var S = SHL.steps(L, P); $('#lxSteps').innerHTML = S.map(function (s, k) { return '<button type="button" data-k="' + k + '"><span>' + (k + 1) + '</span>' + T(s.en_h || '', s.ar_h || '') + '</button>'; }).join(''); }
    function draw() {
      stage.innerHTML = SHL.render(slug, t, P); rng.value = t; var D = SHL.dur(L, P);
      $('#lxTime').textContent = t.toFixed(1) + ' / ' + D.toFixed(0) + ' s'; rng.style.setProperty('--p', (100 * t / D) + '%');
      var S = SHL.steps(L, P), c = cur(S, t), k = S.indexOf(c);
      if ($('#lxCap')._k !== k) { $('#lxCap')._k = k; $('#lxCap').innerHTML = '<b>' + (k + 1) + ' · ' + T(c.en_h || '', c.ar_h || '') + '</b><span>' + T(c.en, c.ar) + '</span>'; $('#lxCap').classList.remove('in'); void $('#lxCap').offsetWidth; $('#lxCap').classList.add('in'); }
      root.querySelectorAll('#lxSteps button').forEach(function (b, i) { b.classList.toggle('on', i === k); b.classList.toggle('done', i < k); });
    }
    function loop(now) { if (!playing) return; var dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt * speed; var D = SHL.dur(L, P); if (t >= D) { t = D; play(false); } draw(); raf = requestAnimationFrame(loop); }
    function play(on) { playing = on; $('#lxPlay').setAttribute('aria-pressed', on); $('#lxPlay').querySelector('.i-play').style.display = on ? 'none' : ''; $('#lxPlay').querySelector('.i-pause').style.display = on ? '' : 'none'; if (on) { if (t >= SHL.dur(L, P) - 0.01) t = 0; last = performance.now(); raf = requestAnimationFrame(loop); } else cancelAnimationFrame(raf); }
    $('#lxPlay').addEventListener('click', function () { play(!playing); });
    $('#lxRe').addEventListener('click', function () { t = 0; draw(); play(true); });
    rng.addEventListener('input', function () { play(false); t = +rng.value; draw(); });
    $('#lxSteps').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var S = SHL.steps(L, P); t = S[+b.getAttribute('data-k')].t + 0.001; draw(); });
    root.querySelector('#lxSpeed').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; speed = +b.getAttribute('data-v'); b.parentElement.querySelectorAll('button').forEach(function (q) { q.setAttribute('aria-pressed', q === b); }); });
    d.addEventListener('keydown', function (e) { if (e.target.closest('input,textarea,select')) return; if (e.code === 'Space') { e.preventDefault(); play(!playing); } if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { play(false); t = clamp(t + ((e.key === 'ArrowRight') !== AR ? 0.5 : -0.5), 0, SHL.dur(L, P)); draw(); } });

    /* ---------------- exports */
    var fname = function (ext) { return 'Shandal-' + slug + '-' + new Date().toISOString().slice(0, 10) + ext; };
    function still(scale) { var cv = d.createElement('canvas'); cv.width = 960 * scale; cv.height = (540 + 150) * scale; return SHL.frame(cv, slug, t, P, { base: base, title: title }).then(function () { return cv; }); }
    function save(blob, name) { if (w.SH && SH.download) SH.download(name, blob); else { var a = d.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; d.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); } }
    function loadPdf() { return w.jspdf ? Promise.resolve() : new Promise(function (r, j) { var s = d.createElement('script'); s.src = base + 'assets/vendor/pdf/jspdf.umd.min.js'; s.onload = r; s.onerror = j; d.head.appendChild(s); }); }
    root.querySelector('#lxEx').addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return; var f = b.getAttribute('data-f'); play(false);
      if (f === 'video') return video(b);
      still(2).then(function (cv) {
        if (f === 'png') cv.toBlob(function (bl) { save(bl, fname('.png')); }, 'image/png');
        else if (f === 'jpg') cv.toBlob(function (bl) { save(bl, fname('.jpg')); }, 'image/jpeg', 0.93);
        else if (f === 'pdf') loadPdf().then(function () { var pdf = new w.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = 297, H = 210, m = 12, iw = W - 2 * m, ih = iw * cv.height / cv.width; if (ih > H - 2 * m) { ih = H - 2 * m; iw = ih * cv.width / cv.height; } pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', (W - iw) / 2, (H - ih) / 2, iw, ih); save(pdf.output('blob'), fname('.pdf')); });
      });
    });
    function video(btn) {
      if (!w.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { alert(T('This browser cannot record video. Use Chrome, Edge or a recent Safari.', 'هذا المتصفح لا يستطيع تسجيل الفيديو. استعمل كروم أو إيدج أو سفاري حديثاً.')); return; }
      if (btn.disabled) return; btn.disabled = true; var lab = btn.querySelector('span'), old = lab.textContent;
      var cv = d.createElement('canvas'); cv.width = 1280; cv.height = Math.round(1280 * 690 / 960 / 2) * 2;
      var mimes = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'], mime = mimes.filter(function (m) { return MediaRecorder.isTypeSupported(m); })[0] || '';
      var fps = 25, D = SHL.dur(L, P), N = Math.ceil((D + 1.5) * fps), stream = cv.captureStream(fps), rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined), chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () { var type = (rec.mimeType || mime || 'video/webm').split(';')[0]; save(new Blob(chunks, { type: type }), fname(type === 'video/mp4' ? '.mp4' : '.webm')); btn.disabled = false; lab.textContent = old; };
      SHL.frame(cv, slug, 0, P, { base: base, title: title }).then(function () {
        rec.start(250); var t0 = performance.now(), i = 0;
        (function next() { if (i > N) { rec.stop(); return; } var tt = Math.min(D, i / fps); SHL.frame(cv, slug, tt, P, { base: base, title: title }).then(function () { lab.textContent = Math.round(100 * i / N) + ' %'; i++; setTimeout(next, Math.max(0, t0 + i * 1000 / fps - performance.now())); }); })();
      });
    }

    /* ---------------- quiz */
    d.querySelectorAll('.lx-q').forEach(function (q) { q.addEventListener('click', function (e) { var b = e.target.closest('button[data-ok]'); if (!b || q.classList.contains('answered')) return; q.classList.add('answered'); b.classList.add(b.getAttribute('data-ok') === '1' ? 'right' : 'wrong'); q.querySelectorAll('button[data-ok="1"]').forEach(function (r) { r.classList.add('right'); }); q.querySelector('.lx-qex').hidden = false; }); });
    setup(true); setTimeout(function () { play(true); }, 500);
  };
})();
