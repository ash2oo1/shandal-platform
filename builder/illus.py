# -*- coding: utf-8 -*-
"""Scientific SVG illustrations, drawn from real geometry. Colours come from CSS classes so they follow the theme."""
import math, json, random

W, H = 480, 320

def svg(body, uid, label, defs=''):
    return (f'<svg class="illus" viewBox="0 0 {W} {H}" role="img" aria-label="{label}" xmlns="http://www.w3.org/2000/svg">'
            f'<defs>{defs}</defs>{body}</svg>')

def f(v):
    return f'{v:.1f}'

# ---------------------------------------------------------------- terrain helpers
def terrain(x, y, seed=0):
    hills = [(.25, .35, .17, 60), (.68, .3, .2, 75), (.8, .75, .14, 40), (.42, .74, .19, 35), (.1, .8, .1, 20)]
    z = 20 + 8 * math.sin(x * 6 + seed) * math.cos(y * 5 - seed)
    for cx, cy, r, h in hills:
        z += h * math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r))
    return z

def march(grid, nx, ny, cell, ox, oy, lv):
    segs = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a, b, c, d = grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]
            code = (8 if a > lv else 0) | (4 if b > lv else 0) | (2 if c > lv else 0) | (1 if d > lv else 0)
            if code in (0, 15):
                continue
            x, y = ox + i * cell, oy + j * cell
            T = (x + cell * (lv - a) / (b - a), y) if b != a else (x, y)
            R = (x + cell, y + cell * (lv - b) / (c - b)) if c != b else (x + cell, y)
            B = (x + cell * (lv - d) / (c - d), y + cell) if c != d else (x, y + cell)
            Lf = (x, y + cell * (lv - a) / (d - a)) if d != a else (x, y)
            table = {1: [Lf, B], 2: [B, R], 3: [Lf, R], 4: [T, R], 5: [T, Lf, B, R], 6: [T, B], 7: [T, Lf], 8: [T, Lf], 9: [T, B],
                     10: [T, R, Lf, B], 11: [T, R], 12: [Lf, R], 13: [B, R], 14: [Lf, B]}
            s = table[code]
            for k in range(0, len(s), 2):
                segs.append((s[k], s[k + 1]))
    return segs

def segs_path(segs):
    return ''.join(f'M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}' for a, b in segs)

# ---------------------------------------------------------------- 1 quarry
def quarry(uid, label):
    s = 13.0; cx, cy = 240, 120
    def P(x, y, z):
        return (cx + (x - y) * math.cos(math.pi / 6) * s, cy + (x + y) * math.sin(math.pi / 6) * s - z * s)
    def poly(pts, cls):
        return f'<polygon class="{cls}" points="{" ".join(f(p[0]) + "," + f(p[1]) for p in [P(*q) for q in pts])}"/>'
    o = []
    # ground slab
    G, D = 12, 4.2
    o.append(poly([(-G, -G, 0), (G, -G, 0), (G, G, 0), (-G, G, 0)], 'il-surface'))
    o.append(poly([(-G, G, 0), (G, G, 0), (G, G, -D), (-G, G, -D)], 'il-side'))
    o.append(poly([(G, -G, 0), (G, G, 0), (G, G, -D), (G, -G, -D)], 'il-side2'))
    # layers on outer faces
    layers = [(0, -.8, 'il-l1'), (-.8, -2.0, 'il-l2'), (-2.0, -3.1, 'il-l3'), (-3.1, -D, 'il-l4')]
    for top, bot, c in layers:
        o.append(poly([(-G, G, top), (G, G, top), (G, G, bot), (-G, G, bot)], c))
        o.append(poly([(G, -G, top), (G, G, top), (G, G, bot), (G, -G, bot)], c + ' il-shade'))
    # pit
    a0, a1, b0, b1, pd = -6, 6, -7, 3, 3.1
    o.append(poly([(a0, b0, -pd), (a1, b0, -pd), (a1, b1, -pd), (a0, b1, -pd)], 'il-pitfloor'))
    for top, bot, c in layers:
        if top <= -pd: continue
        bb = max(bot, -pd)
        o.append(poly([(a0, b0, top), (a1, b0, top), (a1, b0, bb), (a0, b0, bb)], c))          # back wall (faces viewer)
        o.append(poly([(a0, b0, top), (a0, b1, top), (a0, b1, bb), (a0, b0, bb)], c + ' il-shade'))  # left wall
    o.append(poly([(a0, b0, 0), (a1, b0, 0), (a1, b1, 0), (a0, b1, 0)], 'il-pitrim'))
    # dimension lines
    def line(p, q, cls='il-dim'):
        A, B = P(*p), P(*q)
        return f'<line class="{cls}" x1="{f(A[0])}" y1="{f(A[1])}" x2="{f(B[0])}" y2="{f(B[1])}" marker-start="url(#ar{uid})" marker-end="url(#ar{uid})"/>'
    def text(p, t, dx=0, dy=0):
        A = P(*p)
        return f'<text class="il-label" x="{f(A[0] + dx)}" y="{f(A[1] + dy)}" text-anchor="middle">{t}</text>'
    o.append(line((a0, b1 + 1.6, 0), (a1, b1 + 1.6, 0))); o.append(text(((a0 + a1) / 2, b1 + 1.6, 0), 'L = 120 m', 0, 18))
    o.append(line((a1 + 1.6, b0, 0), (a1 + 1.6, b1, 0))); o.append(text((a1 + 1.6, (b0 + b1) / 2, 0), 'W = 100 m', 34, 10))
    o.append(line((a0 - .3, b1, 0), (a0 - .3, b1, -pd))); o.append(text((a0 - .3, b1, -pd / 2), 'D = 6 m', -36, 30))
    # survey corners
    for p in [(a0, b0, 0), (a1, b0, 0), (a1, b1, 0), (a0, b1, 0)]:
        A = P(*p); o.append(f'<circle class="il-node" cx="{f(A[0])}" cy="{f(A[1])}" r="4"/>')
    o.append(f'<g class="il-chip" transform="translate(24 248)"><rect width="168" height="50" rx="8"/><text x="12" y="20" class="il-small">Worked volume</text><text x="12" y="40" class="il-value">72,000 m³</text></g>')
    o.append(f'<g class="il-chip" transform="translate(288 248)"><rect width="168" height="50" rx="8"/><text x="12" y="20" class="il-small">Remaining of contract</text><text x="12" y="40" class="il-value">28,000 m³</text></g>')
    defs = f'<marker id="ar{uid}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" class="il-arrowhead"/></marker>'
    return svg(''.join(o), uid, label, defs)

# ---------------------------------------------------------------- 2 stereonet
def _sph(trend, plunge, R, cx, cy):
    r = R * math.tan(math.radians(90 - plunge) / 2)
    return cx + r * math.sin(math.radians(trend)), cy - r * math.cos(math.radians(trend))

def _plane(dipdir, dip, R, cx, cy):
    a, p = math.radians(dipdir), math.radians(dip)
    sx, sy, sz = math.sin(a - math.pi / 2), math.cos(a - math.pi / 2), 0
    dx, dy, dz = math.sin(a) * math.cos(p), math.cos(a) * math.cos(p), -math.sin(p)
    pts = []
    for k in range(0, 181, 3):
        t = math.radians(k)
        vx, vy, vz = math.cos(t) * sx + math.sin(t) * dx, math.cos(t) * sy + math.sin(t) * dy, math.cos(t) * sz + math.sin(t) * dz
        if vz > 0: vx, vy, vz = -vx, -vy, -vz
        plunge = math.degrees(math.asin(min(1, -vz)))
        trend = math.degrees(math.atan2(vx, vy)) % 360
        pts.append(_sph(trend, plunge, R, cx, cy))
    return 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts)

def stereonet(uid, label, compact=False):
    cx, cy, R = (175, 160, 128)
    o = [f'<circle class="il-surface" cx="{cx}" cy="{cy}" r="{R}"/>']
    # graticule: great circles every 10 deg dipping E/W, small circles
    for d in range(10, 90, 10):
        o.append(f'<path class="il-grid" d="{_plane(90, d, R, cx, cy)}"/><path class="il-grid" d="{_plane(270, d, R, cx, cy)}"/>')
    o.append(f'<line class="il-grid" x1="{cx}" y1="{cy - R}" x2="{cx}" y2="{cy + R}"/><line class="il-grid" x1="{cx - R}" y1="{cy}" x2="{cx + R}" y2="{cy}"/>')
    for t in range(0, 360, 10):
        x1, y1 = cx + R * math.sin(math.radians(t)), cy - R * math.cos(math.radians(t))
        x2, y2 = cx + (R + (7 if t % 30 == 0 else 4)) * math.sin(math.radians(t)), cy - (R + (7 if t % 30 == 0 else 4)) * math.cos(math.radians(t))
        o.append(f'<line class="il-tick" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')
    o.append(f'<text class="il-label" x="{cx}" y="{cy - R - 12}" text-anchor="middle">N</text>')
    # friction circle (phi = 30)
    phi = 30; rf = R * math.tan(math.radians(90 - phi) / 2)
    o.append(f'<circle class="il-friction" cx="{cx}" cy="{cy}" r="{f(rf)}"/>')
    # daylight envelope approx: slope face 50/060
    o.append(f'<path class="il-plane2" d="{_plane(60, 62, R, cx, cy)}"/>')
    # bedding + joints
    o.append(f'<path class="il-plane" d="{_plane(45, 38, R, cx, cy)}"/>')
    o.append(f'<path class="il-plane3" d="{_plane(160, 70, R, cx, cy)}"/>')
    o.append(f'<path class="il-plane3" d="{_plane(300, 64, R, cx, cy)}"/>')
    # poles cloud
    rnd = random.Random(4)
    for _ in range(26):
        tr = 225 + rnd.gauss(0, 9); pl = 52 + rnd.gauss(0, 6)
        x, y = _sph(tr % 360, max(1, min(89, pl)), R, cx, cy)
        o.append(f'<circle class="il-pole" cx="{f(x)}" cy="{f(y)}" r="2.6"/>')
    # intersection point of joints
    x, y = _sph(232, 41, R, cx, cy)
    o.append(f'<path class="il-intersect" d="M{f(x-5)} {f(y-5)}L{f(x+5)} {f(y+5)}M{f(x+5)} {f(y-5)}L{f(x-5)} {f(y+5)}"/>')
    if not compact:
        lx = 334
        rows = [('il-plane', 'Bedding 045/38'), ('il-plane2', 'Slope face 060/62'), ('il-plane3', 'Joint sets J1, J2'), ('il-friction', 'Friction cone φ = 30°')]
        for i, (c, t) in enumerate(rows):
            y = 60 + i * 30
            o.append(f'<line class="{c}" x1="{lx}" y1="{y}" x2="{lx + 22}" y2="{y}"/><text class="il-small" x="{lx + 30}" y="{y + 4}">{t}</text>')
        o.append(f'<g class="il-chip" transform="translate(330 196)"><rect width="134" height="84" rx="8"/><text x="12" y="22" class="il-small">Planar sliding</text><text x="12" y="44" class="il-value il-warn">Possible</text><text x="12" y="66" class="il-small">RMR 47 · Class III</text></g>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 3 contours (field)
def contours(uid, label):
    nx, ny, cell, ox, oy = 49, 33, 10, 0, 0
    g = [[terrain(i / (nx - 1), j / (ny - 1)) for i in range(nx)] for j in range(ny)]
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    for lv in range(25, 160, 5):
        segs = march(g, nx, ny, cell, ox, oy, lv)
        cls = 'il-index' if lv % 25 == 0 else 'il-contour'
        o.append(f'<path class="{cls}" d="{segs_path(segs)}"/>')
    # drainage line following valley between hills
    stream = [(10, 300), (70, 262), (120, 232), (168, 205), (205, 168), (232, 120), (262, 88), (300, 52), (330, 10)]
    o.append('<path class="il-stream" d="M' + 'L'.join(f'{x} {y}' for x, y in stream) + '"/>')
    rnd = random.Random(7)
    for _ in range(22):
        x, y = rnd.uniform(20, 460), rnd.uniform(20, 300)
        o.append(f'<path class="il-gps" d="M{f(x-4)} {f(y)}H{f(x+4)}M{f(x)} {f(y-4)}V{f(y+4)}"/>')
    o.append(f'<g transform="translate(440 40)"><path class="il-north" d="M0 -16L7 8L0 3L-7 8z"/><text class="il-label" y="26" text-anchor="middle">N</text></g>')
    o.append(f'<g class="il-scale" transform="translate(24 296)"><rect width="50" height="5"/><rect x="50" width="50" height="5" class="alt"/><text class="il-small" y="-5">0</text><text class="il-small" x="100" y="-5" text-anchor="end">200 m</text></g>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 4 filled contour
BANDS = ['il-b1', 'il-b2', 'il-b3', 'il-b4', 'il-b5', 'il-b6', 'il-b7']
def contourfill(uid, label):
    nx, ny, cell = 97, 65, 5
    g = [[terrain(i / (nx - 1), j / (ny - 1), 1.3) for i in range(nx)] for j in range(ny)]
    zmin = min(min(r) for r in g); zmax = max(max(r) for r in g)
    o = []
    for j in range(ny):
        run_start, run_band = 0, None
        for i in range(nx + 1):
            band = None if i == nx else min(6, int((g[j][i] - zmin) / (zmax - zmin) * 7))
            if band != run_band:
                if run_band is not None:
                    o.append(f'<rect class="{BANDS[run_band]}" x="{run_start * cell}" y="{j * cell}" width="{(i - run_start) * cell + .6}" height="{cell + .6}"/>')
                run_start, run_band = i, band
    for lv in range(25, 160, 10):
        segs = march(g, nx, ny, cell, 2.5, 2.5, lv)
        o.append(f'<path class="il-isoline" d="{segs_path(segs)}"/>')
    # coordinate grid
    for x in range(80, W, 80):
        o.append(f'<line class="il-coord" x1="{x}" y1="0" x2="{x}" y2="{H}"/>')
    for y in range(80, H, 80):
        o.append(f'<line class="il-coord" x1="0" y1="{y}" x2="{W}" y2="{y}"/>')
    o.append(f'<g transform="translate(446 36)"><circle class="il-chipbg" r="20"/><path class="il-north" d="M0 -13L6 7L0 3L-6 7z"/></g>')
    o.append(f'<g class="il-legend" transform="translate(20 20)"><rect class="il-chipbg" width="34" height="132" rx="6"/>' +
             ''.join(f'<rect class="{BANDS[6 - k]}" x="8" y="{8 + k * 17}" width="18" height="17"/>' for k in range(7)) + '</g>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 5 strata column
def strata(uid, label):
    defs = (f'<pattern id="lst{uid}" width="24" height="12" patternUnits="userSpaceOnUse"><path class="il-pat" d="M0 0H24M0 12H24M12 0V6M0 6H24M6 6V12M18 6V12"/></pattern>'
            f'<pattern id="sst{uid}" width="10" height="10" patternUnits="userSpaceOnUse"><circle class="il-dot" cx="2" cy="3" r="1"/><circle class="il-dot" cx="7" cy="8" r="1"/></pattern>'
            f'<pattern id="sh{uid}" width="18" height="8" patternUnits="userSpaceOnUse"><path class="il-pat" d="M1 3H8M10 7H17"/></pattern>'
            f'<pattern id="cg{uid}" width="22" height="16" patternUnits="userSpaceOnUse"><circle class="il-pat" cx="6" cy="6" r="3.5"/><circle class="il-pat" cx="16" cy="12" r="2.5"/></pattern>'
            f'<pattern id="gy{uid}" width="14" height="12" patternUnits="userSpaceOnUse"><path class="il-pat" d="M2 3L7 9L12 3"/></pattern>'
            f'<pattern id="dol{uid}" width="24" height="12" patternUnits="userSpaceOnUse"><path class="il-pat" d="M0 0H24M0 6H24M12 0V6M4 6L8 12M16 6L20 12"/></pattern>')
    beds = [('Alluvium', 'il-l1', f'cg{uid}', 18, .78), ('Injana Fm. · sandstone', 'il-l2', f'sst{uid}', 40, .62), ('Mudstone', 'il-l3', f'sh{uid}', 30, .42),
            ('Fatha Fm. · gypsum', 'il-l4', f'gy{uid}', 34, .55), ('Limestone', 'il-l5', f'lst{uid}', 46, .9), ('Marly limestone', 'il-l2', f'sh{uid}', 26, .6),
            ('Dolomite', 'il-l5', f'dol{uid}', 52, .95)]
    o = []; x0, y = 120, 24; maxw = 140
    total = sum(b[3] for b in beds)
    scale = 270 / total
    o.append(f'<line class="il-axis" x1="{x0 - 22}" y1="{y}" x2="{x0 - 22}" y2="{y + 270}"/>')
    depth = 0
    for k in range(0, 260, 50):
        yy = y + k * scale
        o.append(f'<line class="il-tick" x1="{x0 - 28}" y1="{f(yy)}" x2="{x0 - 22}" y2="{f(yy)}"/><text class="il-small" x="{x0 - 32}" y="{f(yy + 4)}" text-anchor="end">{k} m</text>')
    for name, cls, pat, th, hard in beds:
        h = th * scale; w = maxw * hard
        o.append(f'<rect class="{cls}" x="{x0}" y="{f(y)}" width="{f(w)}" height="{f(h)}"/>')
        o.append(f'<rect fill="url(#{pat})" x="{x0}" y="{f(y)}" width="{f(w)}" height="{f(h)}"/>')
        o.append(f'<rect class="il-bedline" x="{x0}" y="{f(y)}" width="{f(w)}" height="{f(h)}"/>')
        o.append(f'<line class="il-leader" x1="{f(x0 + w + 6)}" y1="{f(y + h / 2)}" x2="{x0 + maxw + 22}" y2="{f(y + h / 2)}"/>')
        o.append(f'<text class="il-small" x="{x0 + maxw + 28}" y="{f(y + h / 2 + 4)}">{name}</text>')
        y += h
    o.append(f'<path class="il-unconf" d="M{x0} {f(24 + (18+40+30)*scale)} q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0"/>')
    o.append(f'<text class="il-small" x="{x0 + maxw * .5}" y="{20 + 0}" text-anchor="middle"></text>')
    return svg(''.join(o), uid, label, defs)

# ---------------------------------------------------------------- 6 response spectrum
def spectrum(uid, label):
    x0, y0, x1, y1 = 64, 268, 456, 30
    SDS, SD1 = 0.80, 0.40; T0, Ts = 0.2 * SD1 / SDS, SD1 / SDS
    def X(t): return x0 + (x1 - x0) * t / 3.0
    def Y(a): return y0 - (y0 - y1) * a / 1.0
    o = []
    for a in [0.2, 0.4, 0.6, 0.8, 1.0]:
        o.append(f'<line class="il-grid" x1="{x0}" y1="{f(Y(a))}" x2="{x1}" y2="{f(Y(a))}"/><text class="il-small" x="{x0 - 8}" y="{f(Y(a) + 4)}" text-anchor="end">{a:.1f}</text>')
    for t in [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]:
        o.append(f'<line class="il-grid" x1="{f(X(t))}" y1="{y0}" x2="{f(X(t))}" y2="{y1}"/><text class="il-small" x="{f(X(t))}" y="{y0 + 18}" text-anchor="middle">{t:g}</text>')
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}"/><line class="il-axis" x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}"/>')
    pts = []
    t = 0.0
    while t <= 3.0001:
        if t < T0: sa = SDS * (0.4 + 0.6 * t / T0)
        elif t <= Ts: sa = SDS
        else: sa = SD1 / t
        pts.append((X(t), Y(sa))); t += 0.01
    area = f'M{x0} {y0}L' + 'L'.join(f'{f(a)} {f(b)}' for a, b in pts) + f'L{f(X(3))} {y0}Z'
    o.append(f'<path class="il-area" d="{area}"/>')
    o.append('<path class="il-curve" d="M' + 'L'.join(f'{f(a)} {f(b)}' for a, b in pts) + '"/>')
    for tt, lab in [(T0, 'T₀'), (Ts, 'Tₛ')]:
        o.append(f'<line class="il-dash" x1="{f(X(tt))}" y1="{f(Y(SDS))}" x2="{f(X(tt))}" y2="{y0}"/><text class="il-label" x="{f(X(tt))}" y="{y0 - 8}" text-anchor="middle">{lab}</text>')
    o.append(f'<circle class="il-node" cx="{f(X(1))}" cy="{f(Y(SD1))}" r="5"/><text class="il-label" x="{f(X(1) + 10)}" y="{f(Y(SD1) - 8)}">S<tspan baseline-shift="sub" font-size="10">D1</tspan> = 0.40 g</text>')
    o.append(f'<text class="il-label" x="{f(X(Ts) + 10)}" y="{f(Y(SDS) - 8)}">S<tspan baseline-shift="sub" font-size="10">DS</tspan> = 0.80 g</text>')
    o.append(f'<text class="il-small" x="{(x0 + x1) / 2}" y="{H - 4}" text-anchor="middle">Period T (s)</text>')
    o.append(f'<text class="il-small" transform="translate(18 {(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">Sa (g)</text>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 7 rainfall
def rainfall(uid, label):
    rnd = random.Random(11)
    rain = [max(0, rnd.gauss(0, 1)) * 6 for _ in range(30)]
    rain[17] = 38; rain[18] = 52; rain[19] = 29; rain[8] = 22
    x0, y0, x1, y1 = 48, 270, 458, 34
    bw = (x1 - x0) / 30
    o = []
    for v in [20, 40, 60]:
        y = y0 - (y0 - y1) * v / 70
        o.append(f'<line class="il-grid" x1="{x0}" y1="{f(y)}" x2="{x1}" y2="{f(y)}"/><text class="il-small" x="{x0 - 8}" y="{f(y + 4)}" text-anchor="end">{v}</text>')
    thr = 34
    for i, v in enumerate(rain):
        h = (y0 - y1) * v / 70
        cls = 'il-bar-hi' if v > thr else 'il-bar'
        o.append(f'<rect class="{cls}" x="{f(x0 + i * bw + 2)}" y="{f(y0 - h)}" width="{f(bw - 4)}" height="{f(h)}" rx="2"/>')
    acc = 0; pts = []
    for i, v in enumerate(rain):
        acc = acc * 0.82 + v
        pts.append((x0 + i * bw + bw / 2, y0 - (y0 - y1) * acc / 140))
    o.append('<path class="il-curve2" d="M' + 'L'.join(f'{f(a)} {f(b)}' for a, b in pts) + '"/>')
    ty = y0 - (y0 - y1) * thr / 70
    o.append(f'<line class="il-threshold" x1="{x0}" y1="{f(ty)}" x2="{x1}" y2="{f(ty)}"/><text class="il-label il-warntext" x="{x1}" y="{f(ty - 8)}" text-anchor="end">Caine threshold</text>')
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}"/>')
    o.append(f'<text class="il-small" x="{x0}" y="{y0 + 20}">Day 1</text><text class="il-small" x="{x1}" y="{y0 + 20}" text-anchor="end">Day 30</text>')
    o.append(f'<text class="il-small" transform="translate(16 {(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">mm / day</text>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 8 DEM mesh
def mesh(uid, label):
    n = 26; s = 8.4; cx, cy = 240, 112
    def P(i, j):
        z = terrain(i / (n - 1), j / (n - 1), .6)
        return (cx + (i - j) * math.cos(math.pi / 6) * s, cy + (i + j) * math.sin(math.pi / 6) * s - z * 1.05), z
    pts = [[P(i, j) for i in range(n)] for j in range(n)]
    o = []
    # faces painted back to front for depth
    for j in range(n - 1):
        for i in range(n - 1):
            (a, za), (b, zb), (c, zc), (d, zd) = pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]
            z = (za + zb + zc + zd) / 4
            band = min(6, max(0, int((z - 15) / 18)))
            o.append(f'<polygon class="{BANDS[band]} il-face" points="{f(a[0])},{f(a[1])} {f(b[0])},{f(b[1])} {f(c[0])},{f(c[1])} {f(d[0])},{f(d[1])}"/>')
    o.append(f'<g class="il-chip" transform="translate(20 252)"><rect width="200" height="48" rx="8"/><text x="12" y="20" class="il-small">Grid 26 × 26 · Copernicus GLO-90</text><text x="12" y="38" class="il-value">676 points · CSV</text></g>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 9 magnetic
MAG = ['il-m1', 'il-m2', 'il-m3', 'il-m4', 'il-m5', 'il-m6', 'il-m7']
_MAG_IMG = None
def _magfield(x, y):
    """Total-field map: regional gradient (northward increase) plus an induced dipole at mid latitude
    (positive lobe to the south-centre, negative lobe to the north), as over a buried magnetic body."""
    base = 44700 + 1500 * (1 - y) + 300 * x
    def body(cx, cy, k, d):
        dx, dy = x - cx, y - cy
        r2 = dx * dx + dy * dy + d * d
        return k * (2 * (dy + .35 * d) ** 2 - dx * dx - d * d) / r2 ** 2.5 * d ** 3
    return base + body(.56, .48, 1400, .16) + body(.2, .25, 380, .1)
def _mag_png():
    global _MAG_IMG
    if _MAG_IMG: return _MAG_IMG
    import io, base64
    from PIL import Image
    stops = [(0, (43, 74, 107)), (.17, (61, 110, 138)), (.33, (94, 154, 162)), (.5, (169, 195, 160)), (.67, (226, 201, 133)), (.83, (216, 147, 90)), (1, (180, 85, 45))]
    w, h = 240, 160
    vals = [[_magfield(i / (w - 1), j / (h - 1)) for i in range(w)] for j in range(h)]
    lo, hi = min(map(min, vals)), max(map(max, vals))
    im = Image.new('RGB', (w, h))
    px = im.load()
    for j in range(h):
        for i in range(w):
            t = (vals[j][i] - lo) / (hi - lo)
            for k in range(len(stops) - 1):
                if t <= stops[k + 1][0]:
                    u = (t - stops[k][0]) / (stops[k + 1][0] - stops[k][0]); c0, c1 = stops[k][1], stops[k + 1][1]
                    px[i, j] = tuple(int(c0[q] + (c1[q] - c0[q]) * u) for q in range(3)); break
    bio = io.BytesIO(); im.save(bio, 'PNG', optimize=True)
    _MAG_IMG = 'data:image/png;base64,' + base64.b64encode(bio.getvalue()).decode()
    return _MAG_IMG
def magnetic(uid, label):
    nx, ny, cell = 161, 108, 3
    g = [[_magfield(i / (nx - 1), j / (ny - 1)) for i in range(nx)] for j in range(ny)]
    lo, hi = min(min(r) for r in g), max(max(r) for r in g)
    o = [f'<image href="{_mag_png()}" x="0" y="0" width="{W}" height="{H}" preserveAspectRatio="none"/>']
    for lv in range(int(lo // 100 * 100) + 100, int(hi), 100):
        segs = march(g, nx, ny, cell, 0, 0, lv)
        major = lv % 500 == 0
        o.append(f'<path d="{segs_path(segs)}" fill="none" stroke="#1d2a33" stroke-opacity="{.75 if major else .32}" stroke-width="{1.3 if major else .7}"/>')
    # flight lines with stations
    for xl in range(36, W, 48):
        o.append(f'<line x1="{xl}" y1="8" x2="{xl}" y2="{H - 8}" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-dasharray="4 4"/>')
        o.extend(f'<circle cx="{xl}" cy="{yy}" r="1.3" fill="#fff" fill-opacity=".8"/>' for yy in range(16, H - 8, 16))
    # profile line A–A' through the anomaly and inset profile
    ax = int(.56 * W)
    o.append(f'<line x1="{ax}" y1="22" x2="{ax}" y2="{H - 22}" stroke="#111" stroke-width="1.6"/><text x="{ax + 5}" y="22" font-size="11" font-weight="800" fill="#111">A</text><text x="{ax + 5}" y="{H - 16}" font-size="11" font-weight="800" fill="#111">A′</text>')
    prof = [_magfield(.56, k / 60) - (44700 + 1500 * (1 - k / 60) + 300 * .56) for k in range(61)]
    pmin, pmax = min(prof), max(prof)
    pts = ' '.join(f'{f(14 + k * 2.2)},{f(286 - (v - pmin) / (pmax - pmin) * 40)}' for k, v in enumerate(prof))
    zero = 286 - (0 - pmin) / (pmax - pmin) * 40
    o.append(f'<g><rect x="6" y="236" width="150" height="78" rx="8" fill="#fff" fill-opacity=".92"/><text x="14" y="252" style="fill:#1d2a33;font-size:10px;font-weight:700">ΔT profile A–A′ (nT)</text>'
             f'<line x1="14" y1="{f(zero)}" x2="146" y2="{f(zero)}" stroke="#9aa3ad" stroke-dasharray="3 2" stroke-width=".8"/><polyline points="{pts}" fill="none" stroke="#B4552D" stroke-width="2"/></g>')
    o.append('<g transform="translate(450 30)"><path d="M0 -14 L7 8 L0 3 L-7 8Z" fill="#111"/><text x="0" y="-18" text-anchor="middle" font-size="11" font-weight="800" fill="#111">N</text></g>')
    o.append(f'<g class="il-chip" transform="translate(292 18)"><rect width="140" height="74" rx="8"/><text x="12" y="22" class="il-small">IGRF total field</text><text x="12" y="44" class="il-value">45,812 nT</text><text x="12" y="62" class="il-small">I 51.3° · D 4.8° E</text></g>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 10 gauges
def gauges(uid, label):
    def gauge(cx, cy, r, frac, val, name, cls):
        a0, a1 = math.radians(150), math.radians(390)
        def pt(a, rr): return cx + rr * math.cos(a), cy + rr * math.sin(a)
        s, e = pt(a0, r), pt(a1, r)
        am = a0 + (a1 - a0) * frac; m = pt(am, r)
        large = 1 if (am - a0) > math.pi else 0
        g = [f'<path class="il-track" d="M{f(s[0])} {f(s[1])}A{r} {r} 0 1 1 {f(e[0])} {f(e[1])}"/>',
             f'<path class="{cls}" d="M{f(s[0])} {f(s[1])}A{r} {r} 0 {large} 1 {f(m[0])} {f(m[1])}"/>',
             f'<text class="il-gval" x="{cx}" y="{cy + 6}" text-anchor="middle">{val}</text>',
             f'<text class="il-small" x="{cx}" y="{cy + 30}" text-anchor="middle">{name}</text>']
        return ''.join(g)
    o = [gauge(92, 112, 58, .74, '31.2°', 'WBGT · caution', 'il-arc-warn'), gauge(240, 112, 58, .56, '112', 'AQI · sensitive', 'il-arc'), gauge(388, 112, 58, .82, '9', 'UV · very high', 'il-arc-hot')]
    # wind rose
    cx, cy = 92, 252
    o.append(f'<circle class="il-track-thin" cx="{cx}" cy="{cy}" r="40"/><circle class="il-track-thin" cx="{cx}" cy="{cy}" r="22"/>')
    vals = [.5, .9, .4, .25, .2, .3, .7, 1.0]
    for k, v in enumerate(vals):
        a = math.radians(k * 45 - 90 - 12); b = math.radians(k * 45 - 90 + 12); rr = 40 * v
        o.append(f'<path class="il-petal" d="M{cx} {cy}L{f(cx + rr * math.cos(a))} {f(cy + rr * math.sin(a))}A{f(rr)} {f(rr)} 0 0 1 {f(cx + rr * math.cos(b))} {f(cy + rr * math.sin(b))}Z"/>')
    o.append(f'<text class="il-small" x="{cx + 54}" y="{cy - 6}">Wind NW</text><text class="il-value" x="{cx + 54}" y="{cy + 16}">14 km/h</text>')
    # plume
    px, py = 300, 250
    o.append(f'<path class="il-plume" d="M{px} {py}Q {px+60} {py-28} {px+150} {py-36}L {px+150} {py+36}Q {px+60} {py+28} {px} {py}Z"/>')
    o.append(f'<path class="il-plume2" d="M{px} {py}Q {px+50} {py-12} {px+150} {py-16}L {px+150} {py+16}Q {px+50} {py+12} {px} {py}Z"/>')
    o.append(f'<rect class="il-node" x="{px-6}" y="{py-12}" width="12" height="24" rx="2"/><text class="il-small" x="{px}" y="{py+36}" text-anchor="middle">Gaussian plume</text>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 11 ndvi
ND = ['il-n1', 'il-n2', 'il-n3', 'il-n4', 'il-n5', 'il-n6']
def ndvi(uid, label):
    o = []
    def panel(ox, year, shift):
        cell = 9; n = 22
        for j in range(n):
            for i in range(n):
                x, y = i / n, j / n
                river = math.exp(-((x - .5 - .12 * math.sin(y * 6)) ** 2) / .008)
                v = .55 * river + .25 * math.sin(x * 9 + y * 4) * .5 + .3 - shift * (0.6 * (1 - river)) * (0.6 + .4 * math.sin(i * 1.7 + j))
                b = max(0, min(5, int(v * 6)))
                o.append(f'<rect class="{ND[b]}" x="{ox + i * cell}" y="{40 + j * cell}" width="{cell - .6}" height="{cell - .6}"/>')
        o.append(f'<text class="il-label" x="{ox}" y="28">{year}</text>')
    panel(20, 'Baseline · 2016', 0); panel(262, 'Recent · 2026', .45)
    o.append(f'<path class="il-arrow" d="M226 139h24m-7 -7l7 7l-7 7"/>')
    o.append(f'<g transform="translate(20 252)">' + ''.join(f'<rect class="{ND[k]}" x="{k * 34}" y="0" width="34" height="10"/>' for k in range(6)) +
             '<text class="il-small" x="0" y="28">−0.1</text><text class="il-small" x="204" y="28" text-anchor="end">0.8 NDVI</text></g>')
    o.append(f'<g class="il-chip" transform="translate(262 250)"><rect width="198" height="50" rx="8"/><text x="12" y="20" class="il-small">Vegetated area change</text><text x="12" y="40" class="il-value il-warn">−18.4 %</text></g>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 12 heritage map (Iraq)
_IRQ = None
def _iraq():
    global _IRQ
    if _IRQ is None:
        g = json.load(open('' + __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'vendor', 'ne') + '/ne_110m_admin_0_countries.geojson'))
        feats = {ft['properties']['ADM0_A3']: ft for ft in g['features']}
        rv = json.load(open('' + __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'vendor', 'ne') + '/ne_50m_rivers_lake_centerlines.geojson'))
        rivers = [ft for ft in rv['features'] if (ft['properties'].get('name') or '') in ('Tigris', 'Euphrates', 'Dijlah', 'Furat')]
        _IRQ = (feats, rivers)
    return _IRQ

SITES = [('Shanidar Cave', 36.83, 44.20), ('Aqar Quf', 33.3536, 44.2022), ('Abbasid Palace', 33.343, 44.3836), ('Borsippa', 32.3917, 44.3417), ('Jabal Sanam', 30.1264, 47.6256)]
def heritage(uid, label):
    feats, rivers = _iraq()
    lon0, lon1, lat0, lat1 = 37.5, 49.5, 28.6, 38.0
    def P(lon, lat):
        return 20 + (lon - lon0) / (lon1 - lon0) * 440, 10 + (lat1 - lat) / (lat1 - lat0) * 300 * 1.0
    def ring(coords):
        return 'M' + 'L'.join(f'{f(P(*c[:2])[0])} {f(P(*c[:2])[1])}' for c in coords) + 'Z'
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    for code in ['SYR', 'TUR', 'IRN', 'SAU', 'JOR', 'KWT']:
        ft = feats.get(code)
        if not ft: continue
        gm = ft['geometry']; polys = gm['coordinates'] if gm['type'] == 'MultiPolygon' else [gm['coordinates']]
        o.append('<path class="il-land2" d="' + ''.join(ring(p[0]) for p in polys) + '"/>')
    gm = feats['IRQ']['geometry']; polys = gm['coordinates'] if gm['type'] == 'MultiPolygon' else [gm['coordinates']]
    o.append('<path class="il-land" d="' + ''.join(ring(p[0]) for p in polys) + '"/>')
    for ft in rivers:
        gm = ft['geometry']; lines = gm['coordinates'] if gm['type'] == 'MultiLineString' else [gm['coordinates']]
        for ln in lines:
            o.append('<path class="il-river" d="M' + 'L'.join(f'{f(P(*c[:2])[0])} {f(P(*c[:2])[1])}' for c in ln) + '"/>')
    for i, (n, lat, lon) in enumerate(SITES):
        x, y = P(lon, lat)
        dx, dy, anchor = {'Shanidar Cave': (12, -8, 'start'), 'Aqar Quf': (-12, -8, 'end'), 'Abbasid Palace': (12, -10, 'start'),
                          'Borsippa': (12, 14, 'start'), 'Jabal Sanam': (-12, -8, 'end')}[n]
        o.append(f'<g class="il-pin" transform="translate({f(x)} {f(y)})"><circle r="9" class="il-pinhalo"/><circle r="4.5"/></g>')
        o.append(f'<text class="il-small il-pinlabel" x="{f(x + dx)}" y="{f(y + dy)}" text-anchor="{anchor}">{n}</text>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 13 van krevelen (HI vs OI)
def vankrevelen(uid, label):
    x0, y0, x1, y1 = 60, 276, 456, 24
    def X(oi): return x0 + (x1 - x0) * oi / 200
    def Y(hi): return y0 - (y0 - y1) * hi / 1000
    o = []
    for hi in range(200, 1001, 200):
        o.append(f'<line class="il-grid" x1="{x0}" y1="{f(Y(hi))}" x2="{x1}" y2="{f(Y(hi))}"/><text class="il-small" x="{x0 - 8}" y="{f(Y(hi) + 4)}" text-anchor="end">{hi}</text>')
    for oi in range(50, 201, 50):
        o.append(f'<line class="il-grid" x1="{f(X(oi))}" y1="{y0}" x2="{f(X(oi))}" y2="{y1}"/><text class="il-small" x="{f(X(oi))}" y="{y0 + 18}" text-anchor="middle">{oi}</text>')
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}"/><line class="il-axis" x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}"/>')
    curves = {'I': [(2, 920), (4, 860), (8, 700), (12, 420), (16, 180), (22, 60)],
              'II': [(4, 640), (8, 560), (14, 420), (22, 260), (35, 120), (55, 50)],
              'III': [(8, 260), (16, 200), (30, 150), (60, 100), (110, 60), (180, 30)],
              'IV': [(20, 60), (60, 45), (120, 30), (190, 20)]}
    for k, pts in curves.items():
        d = 'M' + 'L'.join(f'{f(X(a))} {f(Y(b))}' for a, b in pts)
        o.append(f'<path class="il-curve il-k{k}" d="{d}"/>')
        a, b = pts[0]
        o.append(f'<text class="il-label" x="{f(X(a) + 8)}" y="{f(Y(b) - 4)}">{k}</text>')
    rnd = random.Random(5)
    for _ in range(14):
        oi = abs(rnd.gauss(18, 8)); hi = rnd.gauss(470, 90)
        o.append(f'<circle class="il-sample" cx="{f(X(oi))}" cy="{f(Y(hi))}" r="4.2"/>')
    o.append(f'<text class="il-small" x="{(x0 + x1) / 2}" y="{H - 4}" text-anchor="middle">Oxygen index OI (mg CO₂/g TOC)</text>')
    o.append(f'<text class="il-small" transform="translate(16 {(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">Hydrogen index HI (mg HC/g TOC)</text>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 14 Tyson ternary
def ternary(uid, label):
    A = (84, 292); B = (396, 292); C = (240, 292 - 312 * math.sqrt(3) / 2)  # AOM left, Paly right, Phyto top
    def T(aom, phy, pal):
        s = aom + phy + pal; a, p, q = aom / s, phy / s, pal / s
        return (a * A[0] + q * B[0] + p * C[0], a * A[1] + q * B[1] + p * C[1])
    o = [f'<polygon class="il-surface il-tri" points="{A[0]},{A[1]} {B[0]},{B[1]} {f(C[0])},{f(C[1])}"/>']
    for k in range(1, 10):
        t = k / 10
        for p, q in [((t, 1 - t, 0), (t, 0, 1 - t)), ((0, t, 1 - t), (1 - t, t, 0)), ((1 - t, 0, t), (0, 1 - t, t))]:
            a, b = T(*p), T(*q)
            o.append(f'<line class="il-grid" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}"/>')
    # simplified Tyson field boundaries (illustrative)
    bounds = [((10, 90, 0), (0, 90, 10)), ((30, 70, 0), (0, 60, 40)), ((60, 40, 0), (10, 40, 50)), ((0, 40, 60), (40, 20, 40)),
              ((85, 15, 0), (70, 0, 30)), ((60, 40, 0), (60, 0, 40)), ((40, 40, 20), (40, 0, 60))]
    for p, q in bounds:
        a, b = T(*p), T(*q)
        o.append(f'<line class="il-field" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}"/>')
    for lab, p in [('I', (3, 94, 3)), ('II', (15, 72, 13)), ('III', (5, 55, 40)), ('IVa', (30, 45, 25)), ('V', (20, 15, 65)), ('VI', (55, 40, 5)), ('VII', (45, 15, 40)), ('VIII', (70, 10, 20)), ('IX', (90, 5, 5))]:
        x, y = T(*p)
        o.append(f'<text class="il-field-lab" x="{f(x)}" y="{f(y + 4)}" text-anchor="middle">{lab}</text>')
    o.append(f'<text class="il-label" x="{A[0] - 6}" y="{A[1] + 22}" text-anchor="middle">AOM</text>')
    o.append(f'<text class="il-label" x="{B[0] + 6}" y="{B[1] + 22}" text-anchor="middle">Palynomorphs</text>')
    o.append(f'<text class="il-label" x="{f(C[0])}" y="{f(C[1] - 10)}" text-anchor="middle">Phytoclasts</text>')
    for p in [(58, 30, 12), (62, 26, 12), (52, 34, 14)]:
        x, y = T(*p)
        o.append(f'<circle class="il-sample" cx="{f(x)}" cy="{f(y)}" r="5"/>')
    return svg(''.join(o), uid, label)

# ---------------------------------------------------------------- 15 geotherm
def geotherm(uid, label):
    x0, y0, x1, y1 = 70, 30, 456, 292   # temperature horizontal, depth downward
    def X(t): return x0 + (x1 - x0) * t / 200
    def Y(z): return y0 + (y1 - y0) * z / 5000
    o = []
    G = 30.0; Ts = 25.0
    def depth(T): return (T - Ts) / G * 1000
    oil_top, oil_bot, gas_bot = depth(65), depth(145), depth(190)
    o.append(f'<rect class="il-oil" x="{x0}" y="{f(Y(oil_top))}" width="{x1 - x0}" height="{f(Y(oil_bot) - Y(oil_top))}"/>')
    o.append(f'<rect class="il-gas" x="{x0}" y="{f(Y(oil_bot))}" width="{x1 - x0}" height="{f(min(Y(gas_bot), y1) - Y(oil_bot))}"/>')
    o.append(f'<text class="il-label" x="{x1 - 10}" y="{f(Y(oil_top) + 20)}" text-anchor="end">Oil window · Ro 0.6–1.35 %</text>')
    o.append(f'<text class="il-label" x="{x1 - 10}" y="{f(Y(oil_bot) + 20)}" text-anchor="end">Gas window</text>')
    for z in range(1000, 5001, 1000):
        o.append(f'<line class="il-grid" x1="{x0}" y1="{f(Y(z))}" x2="{x1}" y2="{f(Y(z))}"/><text class="il-small" x="{x0 - 8}" y="{f(Y(z) + 4)}" text-anchor="end">{z}</text>')
    for t in range(50, 201, 50):
        o.append(f'<line class="il-grid" x1="{f(X(t))}" y1="{y0}" x2="{f(X(t))}" y2="{y1}"/><text class="il-small" x="{f(X(t))}" y="{y0 - 10}" text-anchor="middle">{t} °C</text>')
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}"/><line class="il-axis" x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}"/>')
    o.append(f'<line class="il-curve" x1="{f(X(Ts))}" y1="{f(Y(0))}" x2="{f(X(Ts + G * 5))}" y2="{f(Y(5000))}"/>')
    rnd = random.Random(2)
    for z in [800, 1500, 2100, 2600, 3200, 3900, 4400]:
        t = Ts + G * z / 1000 + rnd.gauss(0, 5)
        o.append(f'<circle class="il-sample" cx="{f(X(t))}" cy="{f(Y(z))}" r="4.5"/>')
    o.append(f'<g class="il-chip" transform="translate(84 196)"><rect width="150" height="50" rx="8"/><text x="12" y="20" class="il-small">Geothermal gradient</text><text x="12" y="40" class="il-value">30.0 °C/km</text></g>')
    o.append(f'<text class="il-small" transform="translate(18 {(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">Depth (m)</text>')
    return svg(''.join(o), uid, label)

REG = {'quarry': quarry, 'stereonet': stereonet, 'contours': contours, 'contourfill': contourfill, 'strata': strata, 'spectrum': spectrum,
       'rainfall': rainfall, 'mesh': mesh, 'magnetic': magnetic, 'gauges': gauges, 'ndvi': ndvi, 'heritage': heritage,
       'vankrevelen': vankrevelen, 'ternary': ternary, 'geotherm': geotherm}

_counter = [0]
def draw(key, label):
    _counter[0] += 1
    return REG[key](f'{key[:3]}{_counter[0]}', label)

# ================================================================ new illustrations
def geomap(uid, label):
    """Stylised geological map: folded units with strike/dip symbols and a fault."""
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    cols = ['il-g1', 'il-g2', 'il-g3', 'il-g4', 'il-g5', 'il-g6']
    nx, ny = 96, 64
    cw, ch = W / nx, H / ny
    def unit(x, y):
        u = (x - .5) * 1.6; v = (y - .5)
        f = v * 3.2 + 0.9 * math.cos(u * 3.4) - (0.6 if x > .62 + .1 * y else 0)
        return int(math.floor(f * 1.6)) % 6
    for j in range(ny):
        rs, ru = 0, None
        for i in range(nx + 1):
            uu = None if i == nx else unit(i / nx, j / ny)
            if uu != ru:
                if ru is not None:
                    o.append(f'<rect class="{cols[ru]}" x="{f(rs * cw)}" y="{f(j * ch)}" width="{f((i - rs) * cw + .6)}" height="{f(ch + .6)}"/>')
                rs, ru = i, uu
    o.append(f'<path class="il-fault" d="M{f(W*.6)} 0 L{f(W*.66)} {f(H*.5)} L{f(W*.72)} {H}"/>')
    for x, y, a, d in [(110, 90, 20, 35), (330, 70, 200, 28), (180, 230, 15, 40), (400, 240, 195, 22)]:
        r = math.radians(a)
        dx, dy = 14 * math.cos(r), 14 * math.sin(r)
        o.append(f'<path class="il-sym" d="M{f(x-dx)} {f(y-dy)}L{f(x+dx)} {f(y+dy)}M{x} {y}L{f(x+7*math.sin(r))} {f(y-7*math.cos(r))}"/><text class="il-small" x="{x+10}" y="{y-8}">{d}</text>')
    o.append(f'<g transform="translate(386 30)"><rect class="il-chipbg" width="80" height="58" rx="8"/><circle class="il-pinc" cx="16" cy="18" r="6"/><text class="il-small" x="28" y="22">Point</text><text class="il-value" x="12" y="44" style="font-size:12px">Fatha Fm.</text></g>')
    o.append(f'<g transform="translate(250 150)"><circle class="il-pinhalo2" r="16"/><circle class="il-pinc" r="6"/></g>')
    return svg(''.join(o), uid, label)

def ammonite(uid, label):
    cx, cy = 240, 160
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    # logarithmic spiral whorls
    pts = []
    a, b = 3.2, 0.2
    for k in range(0, 900):
        t = k * 0.02
        r = a * math.exp(b * t)
        if r > 130: break
        pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    o.append('<path class="il-shell" d="M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts) + '"/>')
    # ribs
    for k in range(30, len(pts), 9):
        t = k * 0.02; r = a * math.exp(b * t); r0 = r * math.exp(-b * 2 * math.pi)
        o.append(f'<line class="il-rib" x1="{f(cx + r0*math.cos(t))}" y1="{f(cy + r0*math.sin(t))}" x2="{f(cx + r*math.cos(t))}" y2="{f(cy + r*math.sin(t))}"/>')
    o.append(f'<g class="il-chip" transform="translate(24 24)"><rect width="150" height="50" rx="8"/><text x="12" y="20" class="il-small">Ammonoidea · Jurassic</text><text x="12" y="40" class="il-value">1,284 records</text></g>')
    return svg(''.join(o), uid, label)

def grlaw(uid, label):
    x0, y0, x1, y1 = 64, 268, 456, 30
    def X(m): return x0 + (x1 - x0) * (m - 3.5) / 4.5
    def Y(lg): return y0 - (y0 - y1) * (lg + 3) / 5
    o = []
    for lg in range(-3, 3):
        o.append(f'<line class="il-grid" x1="{x0}" y1="{f(Y(lg))}" x2="{x1}" y2="{f(Y(lg))}"/><text class="il-small" x="{x0-8}" y="{f(Y(lg)+4)}" text-anchor="end">10{"⁻³⁻²⁻¹⁰¹²"[0] if False else ""}{["⁻³","⁻²","⁻¹","⁰","¹","²"][lg+3]}</text>')
    for m in [4, 5, 6, 7, 8]:
        o.append(f'<line class="il-grid" x1="{f(X(m))}" y1="{y0}" x2="{f(X(m))}" y2="{y1}"/><text class="il-small" x="{f(X(m))}" y="{y0+18}" text-anchor="middle">{m}</text>')
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}"/><line class="il-axis" x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}"/>')
    a, b = 4.6, 1.0
    rnd = random.Random(9)
    for k in range(0, 34):
        m = 3.8 + k * 0.1
        lg = a - b * m + rnd.gauss(0, 0.05) * (1 + (m - 3.8))
        if m < 4.3: lg -= (4.3 - m) * 1.2
        o.append(f'<rect class="il-sq" x="{f(X(m)-3)}" y="{f(Y(lg)-3)}" width="6" height="6"/>')
    o.append(f'<line class="il-curve" x1="{f(X(4.2))}" y1="{f(Y(a-b*4.2))}" x2="{f(X(7.6))}" y2="{f(Y(a-b*7.6))}"/>')
    o.append(f'<line class="il-dash" x1="{f(X(4.3))}" y1="{y0}" x2="{f(X(4.3))}" y2="{y1}"/><text class="il-label" x="{f(X(4.3)+6)}" y="{y1+14}">Mc</text>')
    o.append(f'<g class="il-chip" transform="translate(300 40)"><rect width="150" height="66" rx="8"/><text x="12" y="22" class="il-small">Gutenberg–Richter</text><text x="12" y="42" class="il-value">b = 1.02</text><text x="12" y="58" class="il-small">T(M≥6) ≈ 38 yr</text></g>')
    o.append(f'<text class="il-small" x="{(x0+x1)/2}" y="{H-4}" text-anchor="middle">Magnitude M</text>')
    o.append(f'<text class="il-small" transform="translate(16 {(y0+y1)/2}) rotate(-90)" text-anchor="middle">N(≥M) per year</text>')
    return svg(''.join(o), uid, label)

USDA_POLY = {  # (sand, clay) vertices, USDA Soil Survey Manual texture triangle
 'Sand': [(100, 0), (85, 0), (90, 10)],
 'Loamy sand': [(85, 0), (70, 0), (85, 15), (90, 10)],
 'Sandy loam': [(70, 0), (50, 0), (43, 7), (52, 7), (52, 20), (80, 20), (85, 15)],
 'Loam': [(52, 7), (43, 7), (23, 27), (45, 27), (52, 20)],
 'Silt loam': [(50, 0), (20, 0), (8, 12), (0, 12), (0, 27), (23, 27), (43, 7)],
 'Silt': [(20, 0), (0, 0), (0, 12), (8, 12)],
 'Sandy clay loam': [(80, 20), (52, 20), (45, 27), (45, 35), (65, 35)],
 'Clay loam': [(45, 27), (20, 27), (20, 40), (45, 40)],
 'Silty clay loam': [(20, 27), (0, 27), (0, 40), (20, 40)],
 'Sandy clay': [(65, 35), (45, 35), (45, 55)],
 'Silty clay': [(20, 40), (0, 40), (0, 60)],
 'Clay': [(45, 40), (20, 40), (0, 60), (0, 100), (45, 55)],
}
TRI_A, TRI_B, TRI_C = (100, 290), (380, 290), (240, 290 - 280 * math.sqrt(3) / 2)
def _tri(sand, clay):
    silt = 100 - sand - clay
    return (sand / 100 * TRI_A[0] + silt / 100 * TRI_B[0] + clay / 100 * TRI_C[0], sand / 100 * TRI_A[1] + silt / 100 * TRI_B[1] + clay / 100 * TRI_C[1])
def soiltri(uid, label):
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    for i, (nm, poly) in enumerate(USDA_POLY.items()):
        pts = ' '.join(f'{f(_tri(sd, c)[0])},{f(_tri(sd, c)[1])}' for sd, c in poly)
        o.append(f'<polygon class="il-tx il-tx{i % 4}" points="{pts}"/>')
    for (sd, c), t in [((20, 65), 'Clay'), ((35, 30), 'Clay loam'), ((40, 18), 'Loam'), ((20, 12), 'Silt loam'), ((62, 10), 'Sandy loam')]:
        x, y = _tri(sd, c); o.append(f'<text class="il-small" x="{f(x)}" y="{f(y)}" text-anchor="middle">{t}</text>')
    for sd, c in [(30, 32), (28, 34), (26, 36), (25, 38)]:
        x, y = _tri(sd, c); o.append(f'<circle class="il-sample" cx="{f(x)}" cy="{f(y)}" r="4.5"/>')
    o.append(f'<text class="il-label" x="{TRI_C[0]}" y="{f(TRI_C[1] - 8)}" text-anchor="middle">Clay</text><text class="il-label" x="{TRI_A[0] - 6}" y="308" text-anchor="middle">Sand</text><text class="il-label" x="{TRI_B[0] + 6}" y="308" text-anchor="middle">Silt</text>')
    return svg(''.join(o), uid, label)

def footing(uid, label):
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    gy = 110
    o.append(f'<rect class="il-soil" x="0" y="{gy}" width="{W}" height="{H-gy}"/>')
    o.append(f'<line class="il-axis" x1="0" y1="{gy}" x2="{W}" y2="{gy}"/>')
    bx, bw, df = 190, 100, 50
    o.append(f'<rect class="il-conc" x="{bx}" y="{gy+df-24}" width="{bw}" height="24"/><rect class="il-conc" x="{bx+38}" y="{gy-40}" width="24" height="{df+16}"/>')
    # failure surfaces (log spiral approximations)
    for s in (1, -1):
        xa = bx + (bw if s > 0 else 0)
        pts = []
        for k in range(0, 41):
            t = k / 40
            ang = math.pi / 2 * t
            r = 70 * math.exp(t * 0.9)
            pts.append((xa + s * r * math.sin(ang) * 0.95 - s * (bw / 2) * (1 - t), gy + df + r * math.cos(ang) * 0.75 * (1 - t * .6)))
        end = pts[-1]
        o.append('<path class="il-fail" d="M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts) + f'L{f(end[0] + s*60)} {gy}"/>')
    o.append(f'<path class="il-wedge" d="M{bx} {gy+df}L{bx+bw} {gy+df}L{bx+bw/2} {gy+df+58}Z"/>')
    o.append(f'<path class="il-water" d="M0 {gy+150}H{W}"/><text class="il-small" x="12" y="{gy+144}">▽ GWT</text>')
    o.append(f'<path class="il-load" d="M{bx+50} {gy-90}V{gy-46}"/><path class="il-arrowp" d="M{bx+43} {gy-56}L{bx+50} {gy-42}L{bx+57} {gy-56}Z"/><text class="il-label" x="{bx+62}" y="{gy-66}">Q</text>')
    o.append(f'<g class="il-chip" transform="translate(320 18)"><rect width="140" height="66" rx="8"/><text x="12" y="22" class="il-small">Vesić · square</text><text x="12" y="42" class="il-value">q<tspan font-size="10">all</tspan> 312 kPa</text><text x="12" y="58" class="il-small">FS = 3</text></g>')
    o.append(f'<text class="il-small" x="{bx+bw/2}" y="{gy+df+12}" text-anchor="middle">B</text><text class="il-small" x="{bx-26}" y="{gy+df/2+4}">Df</text>')
    return svg(''.join(o), uid, label)

def mohr(uid, label):
    x0, y0 = 50, 230; sc = 1.25
    o = []
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{W-16}" y2="{y0}"/><line class="il-axis" x1="{x0}" y1="30" x2="{x0}" y2="{H-20}"/>')
    o.append(f'<text class="il-small" x="{W-20}" y="{y0+16}" text-anchor="end">σ</text><text class="il-small" x="{x0+8}" y="40">τ</text>')
    c, phi = 18, 32
    tphi = math.tan(math.radians(phi))
    o.append(f'<line class="il-env" x1="{x0}" y1="{f(y0 - c*sc)}" x2="{W-16}" y2="{f(y0 - (c + (W-16-x0)/sc * tphi)*sc)}"/>')
    Nphi = math.tan(math.radians(45 + phi / 2)) ** 2
    for s3 in (10, 35, 60):
        s1 = s3 * Nphi + 2 * c * math.sqrt(Nphi)
        cc, r = (s1 + s3) / 2, (s1 - s3) / 2
        o.append(f'<path class="il-circ" d="M{f(x0+s3*sc)} {y0} A{f(r*sc)} {f(r*sc)} 0 0 1 {f(x0+s1*sc)} {y0}"/>')
    s1 = 60 * Nphi + 2 * c * math.sqrt(Nphi); cc, r = (s1 + 60) / 2, (s1 - 60) / 2; th = math.radians(45 + phi / 2)
    px, py = x0 + (cc + r * math.cos(2*th)) * sc, y0 - r * math.sin(2*th) * sc
    o.append(f'<line class="il-dash" x1="{f(x0+cc*sc)}" y1="{y0}" x2="{f(px)}" y2="{f(py)}"/><circle class="il-node" cx="{f(px)}" cy="{f(py)}" r="5"/>')
    o.append(f'<g class="il-chip" transform="translate(300 230)"><rect width="160" height="66" rx="8"/><text x="12" y="22" class="il-small">Fitted envelope</text><text x="12" y="42" class="il-value">c = 18 kPa</text><text x="12" y="58" class="il-small">φ = 32°</text></g>')
    return svg(''.join(o), uid, label)

def plasticity(uid, label):
    x0, y0, x1, y1 = 56, 276, 456, 26
    def X(ll): return x0 + (x1 - x0) * ll / 100
    def Y(pi): return y0 - (y0 - y1) * pi / 60
    o = []
    for v in range(10, 61, 10):
        o.append(f'<line class="il-grid" x1="{x0}" y1="{f(Y(v))}" x2="{x1}" y2="{f(Y(v))}"/><text class="il-small" x="{x0-8}" y="{f(Y(v)+4)}" text-anchor="end">{v}</text>')
    for v in range(10, 101, 10):
        o.append(f'<line class="il-grid" x1="{f(X(v))}" y1="{y0}" x2="{f(X(v))}" y2="{y1}"/><text class="il-small" x="{f(X(v))}" y="{y0+16}" text-anchor="middle">{v}</text>')
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}"/><line class="il-axis" x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}"/>')
    o.append(f'<line class="il-curve" x1="{f(X(25.5))}" y1="{f(Y(4))}" x2="{f(X(100))}" y2="{f(Y(58.4))}"/>')
    o.append(f'<line class="il-dash" x1="{f(X(16))}" y1="{f(Y(7))}" x2="{f(X(74.7))}" y2="{f(Y(60))}"/>')
    o.append(f'<line class="il-dash2" x1="{f(X(50))}" y1="{y0}" x2="{f(X(50))}" y2="{y1}"/>')
    o.append(f'<polygon class="il-hatch" points="{f(X(12.3))},{f(Y(4))} {f(X(25.5))},{f(Y(4))} {f(X(29.6))},{f(Y(7))} {f(X(16))},{f(Y(7))}"/>')
    for x, y, t in [(30, 22, 'CL'), (75, 45, 'CH'), (36, 6, 'ML'), (80, 18, 'MH'), (89, 54, 'A-line'), (58, 52, 'U-line')]:
        o.append(f'<text class="il-label" x="{f(X(x))}" y="{f(Y(y))}" text-anchor="middle">{t}</text>')
    o.append(f'<circle class="il-sample" cx="{f(X(48))}" cy="{f(Y(24))}" r="5.5"/>')
    o.append(f'<text class="il-small" x="{(x0+x1)/2}" y="{H-2}" text-anchor="middle">Liquid limit LL (%)</text>')
    o.append(f'<text class="il-small" transform="translate(16 {(y0+y1)/2}) rotate(-90)" text-anchor="middle">Plasticity index PI (%)</text>')
    return svg(''.join(o), uid, label)

def psd(uid, label):
    x0, y0, x1, y1 = 56, 270, 456, 26
    def X(d): return x0 + (x1 - x0) * (math.log10(d) + 3) / 5
    def Y(p): return y0 - (y0 - y1) * p / 100
    o = []
    for p in range(20, 101, 20):
        o.append(f'<line class="il-grid" x1="{x0}" y1="{f(Y(p))}" x2="{x1}" y2="{f(Y(p))}"/><text class="il-small" x="{x0-8}" y="{f(Y(p)+4)}" text-anchor="end">{p}</text>')
    for d in [0.001, 0.01, 0.1, 1, 10, 100]:
        o.append(f'<line class="il-grid" x1="{f(X(d))}" y1="{y0}" x2="{f(X(d))}" y2="{y1}"/><text class="il-small" x="{f(X(d))}" y="{y0+16}" text-anchor="middle">{d:g}</text>')
    for d, t in [(0.075, 'Fines | Sand'), (4.75, 'Sand | Gravel')]:
        o.append(f'<line class="il-dash" x1="{f(X(d))}" y1="{y0}" x2="{f(X(d))}" y2="{y1}"/><text class="il-small" x="{f(X(d)+4)}" y="{y1+12}">{t}</text>')
    o.append(f'<line class="il-axis" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}"/><line class="il-axis" x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}"/>')
    pts = [(0.03, 2), (0.075, 6), (0.15, 14), (0.3, 32), (0.6, 55), (1.18, 72), (2.36, 84), (4.75, 92), (9.5, 98), (19, 100)]
    o.append('<path class="il-curve" d="M' + 'L'.join(f'{f(X(d))} {f(Y(p))}' for d, p in pts) + '"/>')
    for d, p in pts: o.append(f'<circle class="il-node" cx="{f(X(d))}" cy="{f(Y(p))}" r="3.5"/>')
    o.append(f'<g class="il-chip" transform="translate(70 40)"><rect width="148" height="66" rx="8"/><text x="12" y="22" class="il-small">USCS</text><text x="12" y="42" class="il-value">SW-SM</text><text x="12" y="58" class="il-small">Cu 7.2 · Cc 1.3</text></g>')
    o.append(f'<text class="il-small" x="{(x0+x1)/2}" y="{H-2}" text-anchor="middle">Particle size (mm)</text>')
    o.append(f'<text class="il-small" transform="translate(16 {(y0+y1)/2}) rotate(-90)" text-anchor="middle">Percent passing</text>')
    return svg(''.join(o), uid, label)

def aqi(uid, label):
    o = []
    bands = [('Good', 50, 'il-q1'), ('Moderate', 100, 'il-q2'), ('Sensitive', 150, 'il-q3'), ('Unhealthy', 200, 'il-q4'), ('Very unhealthy', 300, 'il-q5'), ('Hazardous', 500, 'il-q6')]
    x0, x1 = 40, 440
    prev = 0
    for nm, hi, cls in bands:
        xa = x0 + (x1 - x0) * prev / 300; xb = x0 + (x1 - x0) * min(hi, 300) / 300
        o.append(f'<rect class="{cls}" x="{f(xa)}" y="40" width="{f(xb-xa)}" height="14"/>'); prev = hi
        if prev >= 300: break
    o.append(f'<path class="il-pointer" d="M{f(x0+(x1-x0)*132/300)} 34l-7 -12h14z"/><text class="il-value" x="{f(x0+(x1-x0)*132/300)}" y="18" text-anchor="middle">132</text>')
    rnd = random.Random(3)
    ys = []
    for k in range(48):
        v = 60 + 50 * math.sin(k / 7) + 35 * math.exp(-((k - 30) / 4) ** 2) * 2 + rnd.gauss(0, 4)
        ys.append(v)
    def X(k): return 40 + 400 * k / 47
    def Y(v): return 290 - v * 1.0
    o.append(f'<line class="il-axis" x1="40" y1="290" x2="440" y2="290"/>')
    o.append(f'<line class="il-threshold" x1="40" y1="{f(Y(45))}" x2="440" y2="{f(Y(45))}"/><text class="il-small il-warntext" x="440" y="{f(Y(45)-6)}" text-anchor="end">WHO PM10 24-h 45 µg/m³</text>')
    o.append('<path class="il-area" d="M40 290L' + 'L'.join(f'{f(X(k))} {f(Y(v))}' for k, v in enumerate(ys)) + 'L440 290Z"/>')
    o.append('<path class="il-curve" d="M' + 'L'.join(f'{f(X(k))} {f(Y(v))}' for k, v in enumerate(ys)) + '"/>')
    o.append(f'<text class="il-small" x="40" y="80">Dust · PM10 forecast (µg/m³)</text>')
    return svg(''.join(o), uid, label)

def quakes(uid, label):
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    land = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'vendor', 'ne', 'ne_110m_land.geojson')))
    def P(lon, lat): return (10 + (lon + 180) / 360 * 460, 20 + (90 - lat) / 180 * 280)
    for ft in land['features']:
        g = ft['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            o.append('<path class="il-land2" d="M' + 'L'.join(f'{f(P(*c[:2])[0])} {f(P(*c[:2])[1])}' for c in poly[0]) + 'Z"/>')
    rnd = random.Random(12)
    belts = [(-72, -30, 8, 40), (140, 35, 10, 30), (120, 0, 15, 20), (-120, 40, 6, 15), (45, 33, 10, 20), (170, -20, 6, 15), (-90, 15, 8, 15), (28, 38, 8, 10)]
    for lon0, lat0, sp, n in belts:
        for _ in range(n):
            lon, lat = lon0 + rnd.gauss(0, sp), lat0 + rnd.gauss(0, sp * .8)
            m = 4.5 + abs(rnd.gauss(0, .6))
            x, y = P(lon, lat)
            o.append(f'<circle class="{"il-eq6" if m >= 6 else "il-eq"}" cx="{f(x)}" cy="{f(y)}" r="{f((m-4)*2.4)}"/>')
    for lon, lat in [(-120, 38), (150, -30), (20, 5), (100, 60)]:
        x, y = P(lon, lat); o.append(f'<path class="il-fire" d="M{f(x)} {f(y-6)}l4 7h-8z"/>')
    return svg(''.join(o), uid, label)

def volcano(uid, label):
    o = [f'<rect class="il-surface" width="{W}" height="{H}"/>']
    base = 280
    o.append(f'<path class="il-l3" d="M0 {base} L150 {base} L215 92 Q240 78 265 92 L330 {base} L{W} {base} L{W} {H} L0 {H}Z"/>')
    for k in range(1, 6):
        yy = base - k * 32
        xl = 150 + (215 - 150) * (base - yy) / (base - 92); xr = 330 - (330 - 265) * (base - yy) / (base - 92)
        o.append(f'<path class="il-strata" d="M{f(xl)} {yy} Q240 {yy-6} {f(xr)} {yy}"/>')
    o.append(f'<path class="il-magma" d="M232 {H} L234 120 Q240 98 246 120 L248 {H}Z"/>')
    o.append(f'<ellipse class="il-magma" cx="240" cy="{H-6}" rx="90" ry="20"/>')
    for k in range(7):
        x = 240 + (k - 3) * 22; o.append(f'<circle class="il-ash" cx="{x}" cy="{60 - (k % 3) * 14}" r="{16 + (k % 2) * 6}"/>')
    o.append(f'<g class="il-chip" transform="translate(24 24)"><rect width="150" height="66" rx="8"/><text x="12" y="22" class="il-small">Stratovolcano</text><text x="12" y="42" class="il-value">Damavand</text><text x="12" y="58" class="il-small">5,609 m · Holocene</text></g>')
    return svg(''.join(o), uid, label)

REG.update({'geomap': geomap, 'ammonite': ammonite, 'grlaw': grlaw, 'soiltri': soiltri, 'footing': footing, 'mohr': mohr,
            'plasticity': plasticity, 'psd': psd, 'aqi': aqi, 'quakes': quakes, 'volcano': volcano})

# ---------------------------------------------------------------- piper (hydrochemistry)
def piper(uid, label):
    s, g, y0 = 150, 22, 300
    h = s * math.sqrt(3) / 2
    ox2 = s + g
    cx = s + g / 2
    def tri(ox, a, b, c):  # a: left %, b: top %, c: right %
        t = a + b + c; a, b, c = a / t, b / t, c / t
        return (ox + a * 0 + b * s / 2 + c * s, y0 - b * h)
    def dia(p, q):  # p: Na+K fraction, q: Cl+SO4 fraction
        B = (cx + 79, y0 - g * math.sqrt(3) / 2)
        L = (B[0] - s / 2, B[1] - h); T = (B[0], B[1] - 2 * h); 
        return (L[0] + p * (B[0] - L[0]) + q * (T[0] - L[0]), L[1] + p * (B[1] - L[1]) + q * (T[1] - L[1]))
    o = []
    for ox in (79, ox2 + 79):
        o.append(f'<polygon class="il-surface il-tri" points="{f(ox)},{y0} {f(ox + s)},{y0} {f(ox + s / 2)},{f(y0 - h)}"/>')
        for k in range(1, 5):
            t = k / 5 * 100
            for p, q in [((t, 100 - t, 0), (t, 0, 100 - t)), ((0, t, 100 - t), (100 - t, t, 0)), ((100 - t, 0, t), (0, 100 - t, t))]:
                a, b = tri(ox, *p), tri(ox, *q)
                o.append(f'<line class="il-grid" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}"/>')
    D = [dia(0, 0), dia(1, 0), dia(1, 1), dia(0, 1)]
    o.append('<polygon class="il-surface il-tri" points="' + ' '.join(f'{f(x)},{f(y)}' for x, y in [D[0], D[1], D[2], D[3]]) + '"/>')
    for k in range(1, 5):
        t = k / 5
        a, b = dia(t, 0), dia(t, 1); o.append(f'<line class="il-grid" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}"/>')
        a, b = dia(0, t), dia(1, t); o.append(f'<line class="il-grid" x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}"/>')
    samples = [((55, 25, 20), (40, 25, 35)), ((30, 25, 45), (12, 45, 43)), ((20, 20, 60), (14, 56, 30)), ((60, 18, 22), (65, 12, 23))]
    for cat, an in samples:
        x, y = tri(79, *cat); o.append(f'<circle class="il-sample" cx="{f(x)}" cy="{f(y)}" r="4.5"/>')
        x, y = tri(ox2 + 79, *an); o.append(f'<circle class="il-sample" cx="{f(x)}" cy="{f(y)}" r="4.5"/>')
        p = cat[2] / 100; q = (an[1] + an[2]) / 100
        x, y = dia(p, q); o.append(f'<circle class="il-sample" cx="{f(x)}" cy="{f(y)}" r="4.5"/>')
    o.append(f'<text class="il-label" x="{f(79 + s / 2)}" y="{y0 + 16}" text-anchor="middle">Cations</text>')
    o.append(f'<text class="il-label" x="{f(ox2 + 79 + s / 2)}" y="{y0 + 16}" text-anchor="middle">Anions</text>')
    return svg(''.join(o), uid, label)

REG.update({'piper': piper})
