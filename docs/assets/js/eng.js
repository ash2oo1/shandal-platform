/* Shandal engineering helpers (EG): SVG charts with framed plot area and legend below, KPI / verdict blocks,
   editable row tables kept on the device, and PNG / JPG / PDF export of every figure. Text inside figures is English. */
(function (w) {
  'use strict';
  var d = document, SH = w.SH, t = SH.t, E = SH.esc, F = SH.fmt;
  var EG = w.EG = {};
  var PF = EG.PF = 'Manrope, Arial, sans-serif', INK = EG.INK = '#1B232B', MUT = EG.MUT = '#55616B', GRID = '#E3E6E8';
  EG.C = ['#2E6FBF', '#C0392B', '#2E8B57', '#E67E22', '#7A4F9A', '#8C6D1F', '#1B9AAA', '#6E6E6E'];

  EG.tx = function (x, y, s, a) {
    a = a || {};
    return '<text x="' + (+x).toFixed(1) + '" y="' + (+y).toFixed(1) + '" font-family="' + PF + '" font-size="' + (a.fs || 12) + '" fill="' + (a.fill || INK) + '"' + (a.anchor ? ' text-anchor="' + a.anchor + '"' : '') + (a.fw ? ' font-weight="' + a.fw + '"' : '') + (a.rot ? ' transform="rotate(' + a.rot + ' ' + (+x).toFixed(1) + ' ' + (+y).toFixed(1) + ')"' : '') + (a.base ? ' dominant-baseline="' + a.base + '"' : '') + (a.halo ? ' stroke="#fff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round"' : '') + ' direction="ltr">' + E(String(s)) + '</text>';
  };
  EG.step = function (lo, hi, n) { var r = Math.abs(hi - lo) / (n || 5) || 1, p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m > 5 ? 10 : m > 2 ? 5 : m > 1 ? 2 : 1) * p; };
  EG.ticks = function (lo, hi, st) { var a = [], s = Math.min(lo, hi), e = Math.max(lo, hi); for (var v = Math.ceil(s / st - 1e-9) * st; v <= e + st * 1e-6; v += st) a.push(+v.toFixed(10)); return a; };
  EG.span = function (vals, o) {
    o = o || {}; var v = vals.filter(function (x) { return isFinite(x); }); if (!v.length) v = [0, 1];
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v); if (o.zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    if (hi === lo) { hi += Math.abs(hi) * 0.1 || 1; lo -= Math.abs(lo) * 0.1 || (o.zero ? 0 : 1); }
    var st = EG.step(lo, hi, o.n || 5); return { lo: o.zero && lo >= 0 ? 0 : Math.floor(lo / st) * st, hi: Math.ceil(hi / st - 1e-9) * st, st: st };
  };
  var fmtT = function (v, st) { var dp = st >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(st) - 1e-9)); return F(v, dp); };

  /* generic XY chart. o = {W, H, m:{l,r,t,b}, x:{lo,hi,st,title,rev,log,top}, y:{...}, series:[{pts,col,w,dash,mark,r,name,area,fillOp}], hl:[{v,col,dash,label}], vl:[...], legend:[{name,col,dash,mark,box}], under:'svg', over:fn(px,py) -> svg, note:'' } */
  EG.chart = function (svg, o) {
    var W = o.W || 760, H = o.H || 420, m = Object.assign({ l: 72, r: 24, t: 20, b: 58 }, o.m || {}), PW = W - m.l - m.r, PH = H - m.t - m.b, X = o.x, Y = o.y;
    var lg = function (v) { return Math.log10(Math.max(v, 1e-12)); };
    var fx = function (v) { var a = X.log ? (lg(v) - lg(X.lo)) / (lg(X.hi) - lg(X.lo)) : (v - X.lo) / (X.hi - X.lo); return m.l + (X.rev ? 1 - a : a) * PW; };
    var fy = function (v) { var a = Y.log ? (lg(v) - lg(Y.lo)) / (lg(Y.hi) - lg(Y.lo)) : (v - Y.lo) / (Y.hi - Y.lo); return m.t + (Y.rev ? a : 1 - a) * PH; };
    var id = 'c' + Math.random().toString(36).slice(2, 8), s = '<defs><clipPath id="' + id + '"><rect x="' + m.l + '" y="' + m.t + '" width="' + PW + '" height="' + PH + '"/></clipPath></defs>';
    var xt = X.none ? [] : X.log ? logTicks(X.lo, X.hi) : EG.ticks(X.lo, X.hi, X.st || EG.step(X.lo, X.hi, 6)), yt = Y.log ? logTicks(Y.lo, Y.hi) : EG.ticks(Y.lo, Y.hi, Y.st || EG.step(Y.lo, Y.hi, 5));
    xt.forEach(function (v) { var x = fx(v); s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + PH) + '" stroke="' + GRID + '"/>'; var ty = X.top ? m.t - 8 : m.t + PH + 17; s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (X.top ? m.t - 4 : m.t + PH) + '" y2="' + (X.top ? m.t : m.t + PH + 4) + '" stroke="' + INK + '"/>' + EG.tx(x, ty, X.log ? logLab(v) : fmtT(v, X.st || EG.step(X.lo, X.hi, 6)), { anchor: 'middle', fs: 11 }); });
    yt.forEach(function (v) { var y = fy(v); s += '<line x1="' + m.l + '" x2="' + (m.l + PW) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + GRID + '"/><line x1="' + (m.l - 4) + '" x2="' + m.l + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + INK + '"/>' + EG.tx(m.l - 8, y + 4, Y.log ? logLab(v) : fmtT(v, Y.st || EG.step(Y.lo, Y.hi, 5)), { anchor: 'end', fs: 11 }); });
    s += '<g clip-path="url(#' + id + ')">' + (o.under ? (typeof o.under === 'function' ? o.under(fx, fy) : o.under) : '');
    (o.hl || []).forEach(function (h) { var y = fy(h.v); s += '<line x1="' + m.l + '" x2="' + (m.l + PW) + '" y1="' + y + '" y2="' + y + '" stroke="' + (h.col || INK) + '" stroke-width="' + (h.w || 1.4) + '"' + (h.dash ? ' stroke-dasharray="' + h.dash + '"' : '') + '/>' + (h.label ? EG.tx(m.l + PW - 6, y - 5, h.label, { anchor: 'end', fs: 11, fill: h.col || INK, fw: 700 }) : ''); });
    (o.vl || []).forEach(function (h) { var x = fx(h.v); s += '<line x1="' + x + '" x2="' + x + '" y1="' + m.t + '" y2="' + (m.t + PH) + '" stroke="' + (h.col || INK) + '" stroke-width="' + (h.w || 1.4) + '"' + (h.dash ? ' stroke-dasharray="' + h.dash + '"' : '') + '/>' + (h.label ? EG.tx(x + 5, m.t + 14, h.label, { fs: 11, fill: h.col || INK, fw: 700 }) : ''); });
    (o.series || []).forEach(function (q) {
      var P = q.pts.filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); }); if (!P.length) return;
      if (q.area) { var base = q.area === 'x0' ? fx(X.lo) : fy(Y.rev ? Y.lo : Math.max(Y.lo, 0)); s += '<path d="' + P.map(function (p, i) { return (i ? 'L' : 'M') + fx(p[0]).toFixed(1) + ' ' + fy(p[1]).toFixed(1); }).join('') + (q.area === 'x0' ? 'L' + base + ' ' + fy(P[P.length - 1][1]).toFixed(1) + 'L' + base + ' ' + fy(P[0][1]).toFixed(1) : 'L' + fx(P[P.length - 1][0]).toFixed(1) + ' ' + base + 'L' + fx(P[0][0]).toFixed(1) + ' ' + base) + 'Z" fill="' + q.col + '" fill-opacity="' + (q.fillOp || 0.18) + '" stroke="none"/>'; }
      if (q.step) { var dd = ''; P.forEach(function (p, i) { dd += (i ? 'L' + fx(p[0]).toFixed(1) + ' ' + fy(P[i - 1][1]).toFixed(1) + 'L' : 'M') + fx(p[0]).toFixed(1) + ' ' + fy(p[1]).toFixed(1); }); s += '<path d="' + dd + '" fill="none" stroke="' + q.col + '" stroke-width="' + (q.w || 2) + '"/>'; }
      else if (q.w !== 0 && P.length > 1) s += '<path d="' + P.map(function (p, i) { return (i ? 'L' : 'M') + fx(p[0]).toFixed(1) + ' ' + fy(p[1]).toFixed(1); }).join('') + '" fill="none" stroke="' + q.col + '" stroke-width="' + (q.w || 2) + '"' + (q.dash ? ' stroke-dasharray="' + q.dash + '"' : '') + ' stroke-linejoin="round"/>';
      if (q.mark) P.forEach(function (p) { var x = fx(p[0]), y = fy(p[1]), r = q.r || 4; s += q.mark === 's' ? '<rect x="' + (x - r) + '" y="' + (y - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="' + (q.mfill || '#fff') + '" stroke="' + q.col + '" stroke-width="1.6"/>' : q.mark === 't' ? '<path d="M' + x + ' ' + (y - r - 1) + 'L' + (x + r) + ' ' + (y + r) + 'L' + (x - r) + ' ' + (y + r) + 'Z" fill="' + (q.mfill || q.col) + '" stroke="' + q.col + '"/>' : '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + (q.mfill || '#fff') + '" stroke="' + q.col + '" stroke-width="1.6"/>'; });
    });
    if (o.over) s += o.over(fx, fy);
    s += '</g><rect x="' + m.l + '" y="' + m.t + '" width="' + PW + '" height="' + PH + '" fill="none" stroke="' + INK + '" stroke-width="1.2"/>';
    if (o.top) s += o.top(fx, fy);
    if (X.title) s += EG.tx(m.l + PW / 2, X.top ? m.t - 28 : m.t + PH + 40, X.title, { anchor: 'middle', fw: 700, fs: 12.5 });
    if (Y.title) s += EG.tx(18, m.t + PH / 2, Y.title, { anchor: 'middle', fw: 700, fs: 12.5, rot: -90 });
    var yL = H + 4, lgH = 0;
    if (o.legend && o.legend.length) { var lx = m.l, ly = H + 10, colW = Math.max(180, Math.min(PW / 2, 260)); o.legend.forEach(function (q) { var wq = Math.min(PW, 30 + q.name.length * 6.6); if (lx + wq > m.l + PW && lx > m.l) { lx = m.l; ly += 20; } s += sym(q, lx + 10, ly - 4) + EG.tx(lx + 26, ly, q.name, { fs: 11.5 }); lx += Math.max(wq + 18, 0); }); lgH = ly - H + 12; yL = H + lgH; void colW; }
    if (o.note) { var lines = wrap(o.note, Math.floor(PW / 6.2)); lines.forEach(function (l, i) { s += EG.tx(m.l, yL + 14 + i * 15, l, { fs: 11, fill: MUT }); }); yL += 14 + lines.length * 15; }
    var HH = Math.ceil(Math.max(H, yL + 6));
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + HH); svg.innerHTML = '<rect width="' + W + '" height="' + HH + '" fill="#fff"/>' + s;
    return { fx: fx, fy: fy, m: m, PW: PW, PH: PH };
  };
  function sym(q, x, y) {
    if (q.box) return '<rect x="' + (x - 8) + '" y="' + (y - 6) + '" width="16" height="12" fill="' + q.col + '" fill-opacity="' + (q.op || 0.35) + '" stroke="' + q.col + '"/>';
    var l = q.noLine ? '' : '<line x1="' + (x - 10) + '" x2="' + (x + 10) + '" y1="' + y + '" y2="' + y + '" stroke="' + q.col + '" stroke-width="' + (q.w || 2.2) + '"' + (q.dash ? ' stroke-dasharray="' + q.dash + '"' : '') + '/>';
    var mk = q.mark === 's' ? '<rect x="' + (x - 4) + '" y="' + (y - 4) + '" width="8" height="8" fill="#fff" stroke="' + q.col + '" stroke-width="1.6"/>' : q.mark === 't' ? '<path d="M' + x + ' ' + (y - 5) + 'L' + (x + 4) + ' ' + (y + 4) + 'L' + (x - 4) + ' ' + (y + 4) + 'Z" fill="' + q.col + '"/>' : q.mark ? '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + (q.mfill || '#fff') + '" stroke="' + q.col + '" stroke-width="1.6"/>' : '';
    return l + mk;
  }
  EG.sym = sym;
  EG.panel = function (o) { var tmp = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); EG.chart(tmp, o); return tmp.innerHTML.replace(/^<rect[^>]*fill="#fff"[^>]*>(<\/rect>)?/, ''); };
  function wrap(s, n) { var out = [], cur = ''; String(s).split(' ').forEach(function (w0) { if ((cur + ' ' + w0).trim().length > n) { if (cur) out.push(cur); cur = w0; } else cur = (cur + ' ' + w0).trim(); }); if (cur) out.push(cur); return out; }
  EG.wrap = wrap;
  function logTicks(lo, hi) { var a = []; for (var e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) { var b = Math.pow(10, e); if (b >= lo * 0.999 && b <= hi * 1.001) a.push(b); } return a; }
  function logLab(v) { return v >= 1 ? F(v, 0) : String(+v.toPrecision(1)); }

  /* scale bar and north-free section helpers for engineering sections */
  EG.scaleBar = function (x, y, pxPerM, maxPx) {
    var want = maxPx / pxPerM, p = Math.pow(10, Math.floor(Math.log10(want))), mq = want / p, len = (mq >= 5 ? 5 : mq >= 2 ? 2 : 1) * p, L0 = len * pxPerM, s = '';
    for (var i = 0; i < 4; i++) s += '<rect x="' + (x + i * L0 / 4) + '" y="' + y + '" width="' + L0 / 4 + '" height="6" fill="' + (i % 2 ? '#fff' : INK) + '"/>';
    s += '<rect x="' + x + '" y="' + y + '" width="' + L0 + '" height="6" fill="none" stroke="' + INK + '" stroke-width=".8"/>' + EG.tx(x, y - 4, '0', { fs: 10.5, anchor: 'middle' }) + EG.tx(x + L0 / 2, y - 4, F(len / 2, (len / 2) % 1 ? (len / 2 < 0.1 ? 2 : 1) : 0), { fs: 10.5, anchor: 'middle' }) + EG.tx(x + L0, y - 4, F(len, len % 1 ? 1 : 0), { fs: 10.5, anchor: 'middle' }) + EG.tx(x + L0 + 8, y + 7, 'm', { fs: 11, fw: 700 });
    return s;
  };
  EG.hatch = function (id, col, bg, kind) {
    var p = kind === 'sand' ? '<circle cx="2" cy="2" r=".9" fill="' + col + '"/><circle cx="6" cy="6" r=".9" fill="' + col + '"/>' : kind === 'clay' ? '<path d="M0 4h8" stroke="' + col + '" stroke-width=".9"/>' : kind === 'rock' ? '<path d="M0 0l8 8M8 0L0 8" stroke="' + col + '" stroke-width=".7"/>' : '<path d="M0 8L8 0" stroke="' + col + '" stroke-width=".8"/>';
    return '<pattern id="' + id + '" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="' + bg + '"/>' + p + '</pattern>';
  };

  /* KPI and verdict blocks */
  EG.kpi = function (cls, k, v, s) { return '<div class="kpi ' + (cls || '') + '"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + (s || '') + '</span></div>'; };
  EG.verdict = function (st, h, p) { return '<div class="verdict ' + st + '"><span class="vi">' + SH.icon(st === 'ok' ? 'ok' : st === 'bad' ? 'warn' : st === 'warn' ? 'warn' : 'info') + '</span><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; };

  /* PNG / JPG / PDF buttons for a figure (SVG id) */
  EG.dl = function (id) { return ['png', 'jpg', 'pdf'].map(function (f) { return '<button class="btn btn-line btn-xs" type="button" data-egdl="' + id + '" data-fmt="' + f + '">' + f.toUpperCase() + '</button>'; }).join(''); };
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-egdl]'); if (!b) return; var sv = d.getElementById(b.getAttribute('data-egdl')); if (!sv || !sv.innerHTML) return;
    var slug = d.body.getAttribute('data-slug') || 'figure'; b.disabled = true;
    Promise.resolve(SH.exportFigure(sv, 'shandal-' + slug + '-' + b.getAttribute('data-egdl'), b.getAttribute('data-fmt'))).catch(function (er) { SH.toast(er.message, 'bad'); }).then(function () { b.disabled = false; });
  });
  d.addEventListener('DOMContentLoaded', function () { Array.prototype.forEach.call(d.querySelectorAll('[data-egfig]'), function (s) { s.innerHTML = EG.dl(s.getAttribute('data-egfig')); }); });

  /* editable rows table. cols: [{k, h (html), w (css width), type:'number'|'select'|'text', opts:[[v,label]], step, ph}] */
  EG.rows = function (host, key, cols, defRows, onChange) {
    var rows = SH.store.get(key, null) || JSON.parse(JSON.stringify(defRows)), inp = 'height:34px;border:1px solid var(--line-2);border-radius:8px;padding:0 6px;background:var(--bg);color:var(--text);font:inherit;font-size:.82rem;min-width:0;width:100%';
    var gt = cols.map(function (c) { return c.w || 'minmax(0,1fr)'; }).join(' ') + ' 26px';
    function draw() {
      host.innerHTML = '<div style="display:grid;grid-template-columns:' + gt + ';gap:5px;font-size:.72rem;color:var(--text-3);align-items:end">' + cols.map(function (c) { return '<span>' + c.h + '</span>'; }).join('') + '<span></span></div>' +
        rows.map(function (r, i) { return '<div style="display:grid;grid-template-columns:' + gt + ';gap:5px;align-items:center" data-i="' + i + '">' + cols.map(function (c) {
          if (c.type === 'select') return '<select style="' + inp + '" data-k="' + c.k + '">' + c.opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(r[c.k]) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
          return '<input class="ltr" type="' + (c.type || 'number') + '" step="' + (c.step || 'any') + '" style="' + inp + '" data-k="' + c.k + '" value="' + (r[c.k] != null ? E(String(r[c.k])) : '') + '"' + (c.ph ? ' placeholder="' + c.ph + '"' : '') + '>'; }).join('') +
          '<button type="button" class="btn btn-line btn-xs" data-del style="padding:0;width:26px;height:26px" aria-label="' + t('Delete row', 'احذف الصف') + '">×</button></div>'; }).join('');
    }
    function save() { SH.store.set(key, rows); onChange(rows); }
    host.addEventListener('input', function (e) { var r = e.target.closest('[data-i]'), k = e.target.getAttribute('data-k'); if (!r || !k) return; var c = cols.filter(function (q) { return q.k === k; })[0], v = e.target.value; rows[+r.getAttribute('data-i')][k] = c.type === 'select' || c.type === 'text' ? v : (v === '' ? null : parseFloat(v)); save(); });
    host.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') { var r = e.target.closest('[data-i]'); rows[+r.getAttribute('data-i')][e.target.getAttribute('data-k')] = e.target.value; save(); } });
    host.addEventListener('click', function (e) { if (!e.target.closest('[data-del]')) return; rows.splice(+e.target.closest('[data-i]').getAttribute('data-i'), 1); draw(); save(); });
    draw();
    return { get: function () { return rows; }, set: function (r) { rows = JSON.parse(JSON.stringify(r)); draw(); save(); }, add: function (r) { rows.push(r || {}); draw(); save(); } };
  };
  EG.v = function (id) { var e = d.getElementById(id); if (!e) return NaN; var v = parseFloat(e.value); return isNaN(v) ? NaN : v; };
  EG.set = function (o) { Object.keys(o).forEach(function (k) { var e = d.getElementById(k); if (e) { e.value = o[k]; e.dispatchEvent(new Event('change', { bubbles: true })); } }); };
})(window);
