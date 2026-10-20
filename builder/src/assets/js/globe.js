/* Shandal System — dotted 3D globe and world map (Natural Earth land, public domain). */
(function () {
  'use strict';
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cache = {};
  function loadDots(url) {
    if (!cache[url]) cache[url] = fetch(url).then(function (r) { return r.json(); });
    return cache[url];
  }
  var RAD = Math.PI / 180;
  function vec(lat, lon) { var la = lat * RAD, lo = lon * RAD; return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; }
  function inIraq(lat, lon) { return lat > 29.1 && lat < 37.4 && lon > 38.8 && lon < 48.6 && !(lat < 31 && lon < 41) && !(lat > 36.6 && lon < 42.3); }

  /* ------------------------------------------------------------ globe */
  function Globe(canvas) {
    var ctx = canvas.getContext('2d'), W = 0, H = 0, R = 0, cx = 0, cy = 0;
    var pts = [], iraq = [], rot = 44 * RAD + 0.5, tilt = 22 * RAD, drag = null, vel = 0.0016, running = true, t0 = performance.now();
    var HOME = vec(33.31, 44.37);
    var cities = [[51.5, -0.12], [29.76, -95.37], [39.9, 116.4], [-1.29, 36.82], [-33.86, 151.2], [-23.55, -46.63], [55.75, 37.6], [24.71, 46.67], [35.68, 139.69], [48.85, 2.35], [19.43, -99.13], [1.35, 103.82]];
    var arcs = cities.map(function (c, i) { return { to: vec(c[0], c[1]), phase: i / cities.length }; });
    function size() {
      var r = canvas.getBoundingClientRect(); W = canvas.width = Math.round(r.width * DPR); H = canvas.height = Math.round(r.height * DPR);
      R = Math.min(W, H) * 0.4; cx = W / 2; cy = H / 2;
    }
    function rotP(v) {
      var x = v[0], y = v[1], z = v[2];
      var c = Math.cos(rot), s = Math.sin(rot);
      var x1 = x * c - z * s, z1 = x * s + z * c;
      var ct = Math.cos(tilt), st = Math.sin(tilt);
      var y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      return [x1, y2, z2];
    }
    function slerp(a, b, t) {
      var d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), s = Math.sin(d);
      if (s < 1e-6) return a;
      var k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s;
      return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
    }
    function frame(now) {
      if (!running) return;
      var dt = Math.min(50, now - t0); t0 = now;
      if (!drag && !reduce) rot -= vel * dt * 0.06;
      draw(now);
      requestAnimationFrame(frame);
    }
    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      // atmosphere
      var g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
      g.addColorStop(0, 'rgba(222,192,122,0.20)'); g.addColorStop(0.35, 'rgba(93,179,176,0.08)'); g.addColorStop(1, 'rgba(10,20,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, 7); ctx.fill();
      // sphere body
      var b = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      b.addColorStop(0, '#1b3145'); b.addColorStop(0.7, '#0f1f2e'); b.addColorStop(1, '#0a1520');
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(222,192,122,0.35)'; ctx.lineWidth = 1 * DPR; ctx.stroke();
      // graticule (latitude rings)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1 * DPR;
      for (var la = -60; la <= 60; la += 30) {
        ctx.beginPath(); var first = true;
        for (var lo = -180; lo <= 180; lo += 6) {
          var p = rotP(vec(la, lo)); if (p[2] < 0) { first = true; continue; }
          var X = cx + p[0] * R, Y = cy - p[1] * R; if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y);
        }
        ctx.stroke();
      }
      // land dots
      var s = 1.55 * DPR;
      for (var i = 0; i < pts.length; i++) {
        var q = rotP(pts[i]); if (q[2] <= 0.02) continue;
        var a = 0.18 + 0.75 * q[2];
        ctx.fillStyle = 'rgba(214,188,124,' + a.toFixed(3) + ')';
        ctx.fillRect(cx + q[0] * R - s / 2, cy - q[1] * R - s / 2, s, s);
      }
      for (var j = 0; j < iraq.length; j++) {
        var w = rotP(iraq[j]); if (w[2] <= 0.02) continue;
        ctx.fillStyle = 'rgba(255,226,150,' + (0.55 + 0.45 * w[2]).toFixed(3) + ')';
        ctx.fillRect(cx + w[0] * R - s * 0.75, cy - w[1] * R - s * 0.75, s * 1.5, s * 1.5);
      }
      // arcs from Baghdad
      var T = (now || 0) / 4200;
      arcs.forEach(function (arc) {
        var prog = (T + arc.phase) % 1, head = Math.min(1, prog * 1.6), tail = Math.max(0, prog * 1.6 - 0.55);
        if (tail >= 1) return;
        ctx.beginPath(); var started = false;
        for (var k = 0; k <= 40; k++) {
          var t = tail + (head - tail) * k / 40; var v = slerp(HOME, arc.to, t); var lift = 1 + 0.18 * Math.sin(Math.PI * t);
          var r = rotP([v[0] * lift, v[1] * lift, v[2] * lift]);
          if (r[2] < -0.15) { started = false; continue; }
          var X = cx + r[0] * R, Y = cy - r[1] * R; if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
        }
        var alpha = prog > 0.8 ? (1 - prog) * 5 : 1;
        ctx.strokeStyle = 'rgba(108,194,190,' + (0.75 * alpha).toFixed(3) + ')'; ctx.lineWidth = 1.4 * DPR; ctx.stroke();
      });
      // home marker
      var h = rotP(HOME);
      if (h[2] > 0) {
        var hx = cx + h[0] * R, hy = cy - h[1] * R, pulse = ((now || 0) % 2000) / 2000;
        ctx.beginPath(); ctx.arc(hx, hy, (4 + pulse * 16) * DPR, 0, 7); ctx.strokeStyle = 'rgba(255,226,150,' + (1 - pulse).toFixed(3) + ')'; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
        ctx.beginPath(); ctx.arc(hx, hy, 3.5 * DPR, 0, 7); ctx.fillStyle = '#FFE29A'; ctx.fill();
      }
    }
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, r: rot }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) { if (drag) { rot = drag.r - (e.clientX - drag.x) * 0.008; if (reduce) draw(performance.now()); } });
    canvas.addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('pointercancel', function () { drag = null; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
      var vis = en[0].isIntersecting;
      if (vis && !running) { running = true; t0 = performance.now(); requestAnimationFrame(frame); } else if (!vis) running = false;
    }).observe(canvas);
    addEventListener('resize', function () { size(); draw(performance.now()); });
    size(); draw(0);
    loadDots(canvas.getAttribute('data-dots')).then(function (flat) {
      for (var i = 0; i < flat.length; i += 2) { var v = vec(flat[i], flat[i + 1]); (inIraq(flat[i], flat[i + 1]) ? iraq : pts).push(v); }
      draw(performance.now());
      if (!reduce) requestAnimationFrame(frame);
    });
  }

  /* ------------------------------------------------------------ flat world map with optional events */
  function WorldMap(canvas) {
    var ctx = canvas.getContext('2d'), W, H, dots = [], events = [];
    function css(n) { return getComputedStyle(canvas).getPropertyValue(n).trim(); }
    function P(lat, lon) { return [(lon + 180) / 360 * W, (90 - lat) / 180 * H]; }
    function size() { var r = canvas.getBoundingClientRect(); W = canvas.width = Math.round(r.width * DPR); H = canvas.height = Math.round(r.width / 2 * DPR); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var land = css('--il-gold') || '#A9853B';
      ctx.fillStyle = land; ctx.globalAlpha = 0.6;
      var s = Math.max(1.6, W / 620);
      for (var i = 0; i < dots.length; i += 2) { var p = P(dots[i], dots[i + 1]); ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s); }
      ctx.globalAlpha = 1;
      events.forEach(function (e) {
        var p = P(e.lat, e.lon), r = e.r * DPR;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = e.c; ctx.globalAlpha = 0.25; ctx.fill();
        ctx.globalAlpha = 1; ctx.lineWidth = 1.2 * DPR; ctx.strokeStyle = e.c; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 1.8 * DPR, 0, 7); ctx.fillStyle = e.c; ctx.fill();
      });
    }
    canvas.setEvents = function (ev) { events = ev; draw(); };
    addEventListener('resize', function () { size(); draw(); });
    document.addEventListener('themechange', draw);
    size();
    loadDots(canvas.getAttribute('data-dots')).then(function (flat) { dots = flat; draw(); });
    return canvas;
  }

  /* ------------------------------------------------------------ earth now feeds */
  function earthNow() {
    var box = document.getElementById('quakeList');
    var hm = document.getElementById('homeMap');
    if (!box && hm) {
      fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson').then(function (r) { return r.json(); }).then(function (d) {
        var w = getComputedStyle(document.documentElement).getPropertyValue('--warn').trim(), g = getComputedStyle(document.documentElement).getPropertyValue('--data').trim();
        hm.setEvents(d.features.map(function (x) { var c = x.geometry.coordinates, m = x.properties.mag || 4.5; return { lat: c[1], lon: c[0], r: Math.max(2.5, (m - 4) * 4), c: m >= 6 ? w : g }; }));
      }).catch(function () {});
    }
    if (!box) return;
    var lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    var map = document.getElementById('quakeMap');
    var fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    function warn() { return getComputedStyle(document.documentElement).getPropertyValue('--warn').trim() || '#B4552D'; }
    function gold() { return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#9A7631'; }
    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var f = d.features.slice().sort(function (a, b) { return b.properties.time - a.properties.time; });
        var max = f.reduce(function (m, x) { return Math.max(m, x.properties.mag || 0); }, 0);
        var near = f.filter(function (x) { var c = x.geometry.coordinates; return c[1] > 25 && c[1] < 42 && c[0] > 35 && c[0] < 63; }).length;
        var deep = f.reduce(function (m, x) { return Math.max(m, x.geometry.coordinates[2] || 0); }, 0);
        var set = function (id, v) { var n = document.getElementById(id); if (n) n.textContent = v; };
        set('qCount', f.length); set('qMax', 'M ' + max.toFixed(1)); set('qNear', near); set('qDeep', Math.round(deep) + ' km');
        box.innerHTML = f.slice(0, 12).map(function (x) {
          var p = x.properties, c = x.geometry.coordinates, m = p.mag || 0;
          return '<a class="feed-item" href="' + p.url + '" target="_blank" rel="noopener"><span class="mag ' + (m >= 6 ? 'm6' : m >= 5 ? 'm5' : '') + '">' + m.toFixed(1) + '</span><span><b dir="ltr">' + (p.place || '') + '</b><small>' + fmt.format(new Date(p.time)) + ' UTC · ' + Math.round(c[2]) + ' km</small></span><svg class="ico ico-sm flip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg></a>';
        }).join('');
        if (map && map.setEvents) map.setEvents(f.map(function (x) { var c = x.geometry.coordinates, m = x.properties.mag || 4.5; return { lat: c[1], lon: c[0], r: Math.max(2.5, (m - 4) * 4), c: m >= 6 ? warn() : gold() }; }));
      })
      .catch(function () { box.innerHTML = '<p class="muted">' + box.getAttribute('data-fail') + '</p>'; });
    var ev = document.getElementById('eonetList');
    if (ev) fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=12&days=30')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        ev.innerHTML = d.events.slice(0, 10).map(function (e) {
          var cat = (e.categories[0] || {}).title || '', g = e.geometry[e.geometry.length - 1] || {};
          return '<a class="feed-item" href="' + ((e.sources[0] || {}).url || 'https://eonet.gsfc.nasa.gov/') + '" target="_blank" rel="noopener"><span class="mag">' + cat.split(' ')[0].slice(0, 7) + '</span><span><b dir="ltr">' + e.title + '</b><small>' + (g.date ? fmt.format(new Date(g.date)) + ' UTC' : '') + '</small></span><svg class="ico ico-sm flip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg></a>';
        }).join('');
      })
      .catch(function () { ev.innerHTML = '<p class="muted">' + ev.getAttribute('data-fail') + '</p>'; });
  }

  /* ------------------------------------------------------------ contour field (auth page backdrop) */
  function contourField(canvas) {
    var ctx = canvas.getContext('2d'), W, H, t = 0;
    function z(x, y) { return Math.sin(x * 3.1 + t) * Math.cos(y * 2.3 - t * .7) + Math.exp(-((x - .6) * (x - .6) + (y - .45) * (y - .45)) * 9) * 1.6 + Math.exp(-((x - .2) * (x - .2) + (y - .8) * (y - .8)) * 14); }
    function size() { var r = canvas.getBoundingClientRect(); W = canvas.width = Math.round(r.width * DPR); H = canvas.height = Math.round(r.height * DPR); }
    function draw() {
      ctx.clearRect(0, 0, W, H); var cell = 14 * DPR, nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1, g = [];
      for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) g[j * nx + i] = z(i * cell / W, j * cell / H);
      for (var lv = -1.6; lv < 2.6; lv += 0.2) {
        var idx = Math.abs(Math.round(lv * 5) % 5) === 0;
        ctx.strokeStyle = idx ? 'rgba(222,192,122,.55)' : 'rgba(222,192,122,.18)'; ctx.lineWidth = (idx ? 1.4 : .8) * DPR; ctx.beginPath();
        for (j = 0; j < ny - 1; j++) for (i = 0; i < nx - 1; i++) {
          var a = g[j * nx + i], b = g[j * nx + i + 1], c = g[(j + 1) * nx + i + 1], d = g[(j + 1) * nx + i];
          var code = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0); if (code === 0 || code === 15) continue;
          var x = i * cell, y = j * cell, T = [x + cell * (lv - a) / (b - a), y], Rr = [x + cell, y + cell * (lv - b) / (c - b)], B = [x + cell * (lv - d) / (c - d), y + cell], L = [x, y + cell * (lv - a) / (d - a)];
          var s = { 1: [L, B], 2: [B, Rr], 3: [L, Rr], 4: [T, Rr], 5: [T, L, B, Rr], 6: [T, B], 7: [T, L], 8: [T, L], 9: [T, B], 10: [T, Rr, L, B], 11: [T, Rr], 12: [L, Rr], 13: [B, Rr], 14: [L, B] }[code];
          for (var k = 0; k < s.length; k += 2) { ctx.moveTo(s[k][0], s[k][1]); ctx.lineTo(s[k + 1][0], s[k + 1][1]); }
        }
        ctx.stroke();
      }
    }
    size(); draw(); addEventListener('resize', function () { size(); draw(); });
    if (!reduce) setInterval(function () { t += 0.015; draw(); }, 90);
  }

  document.querySelectorAll('canvas[data-globe]').forEach(Globe);
  document.querySelectorAll('canvas[data-worldmap]').forEach(WorldMap);
  document.querySelectorAll('canvas[data-contours]').forEach(contourField);
  earthNow();
})();
