# -*- coding: utf-8 -*-
"""Build the compact data of the Faults & Plates atlas from the open sources (run once; output in src/assets/data/tectonics/).
Sources: GEM Global Active Faults (harmonized, CC BY-SA 4.0); Bird (2003) PB2002 steps and orogens (ODC-BY via fraxen/tectonicplates);
NNR-MORVEL56 plate outlines and angular velocities (Argus et al. 2011, Table 1 and Table S1)."""
import json, math, re, sys, os
SRC = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)

def hav(a, b):
    p1, p2 = math.radians(a[1]), math.radians(b[1]); dl = math.radians(b[0] - a[0]); dp = p2 - p1
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2; return 2 * 6371.0088 * math.asin(min(1, math.sqrt(h)))
def dp_simplify(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy; imax, dmax = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        if L2 == 0: d = math.hypot(p[0] - a[0], p[1] - a[1])
        else:
            t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); d = math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
        if d > dmax: imax, dmax = i, d
    if dmax <= tol: return [a, b]
    return dp_simplify(pts[:imax + 1], tol)[:-1] + dp_simplify(pts[imax:], tol)
def tup(s):
    """'(best,min,max)' → [best, min, max] with None for blanks"""
    if s is None: return None
    m = re.findall(r'[-\d.]+|(?<=[(,])(?=[,)])', str(s)); out = []
    for x in str(s).strip('()').split(','):
        x = x.strip(); out.append(float(x) if re.match(r'^-?\d+(\.\d+)?$', x) else None)
    return out if any(v is not None for v in out) else None
def bearing(a, b):
    p1, p2 = math.radians(a[1]), math.radians(b[1]); dl = math.radians(b[0] - a[0])
    return (math.degrees(math.atan2(math.sin(dl) * math.cos(p2), math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl))) + 360) % 360

TYPES = ['Normal', 'Reverse', 'Dextral', 'Sinistral', 'Strike-Slip', 'Reverse-Strike-Slip', 'Dextral-Reverse', 'Dextral-Normal', 'Sinistral-Reverse', 'Sinistral-Normal', 'Reverse-Dextral', 'Normal-Dextral', 'Reverse-Sinistral', 'Normal-Sinistral', 'Normal-Strike-Slip', 'Dextral-Oblique',
         'Blind Thrust', 'Subduction_Thrust', 'Spreading_Ridge', 'Dextral_Transform', 'Sinistral_Transform', 'Anticline', 'Syncline', None]
# ---------------------------------------------------------------- faults
g = json.load(open(os.path.join(SRC, 'gaf/geojson/gem_active_faults_harmonized.geojson')))
raw = json.load(open(os.path.join(SRC, 'gaf/geojson/gem_active_faults.geojson')))
rawname = {f['properties'].get('catalog_id'): f['properties'].get('name') for f in raw['features'] if f['properties'].get('name')}
out = []; n_named = 0
# Named traces of the major fault systems, used only to name unnamed segments that lie along them (≥ 75 % of the trace within the
# corridor and a compatible sense of movement). Centre lines: the public-domain "This Dynamic Planet" major fault zones (USGS,
# Smithsonian, US Naval Research Laboratory), plus the Dead Sea Transform and the Main Recent Fault of the Zagros traced for this atlas.
REF = []
try:
    zz = json.load(open(os.path.join(SRC, 'fla/data/Micro_Plates_and_Major_Fault_Zones.geojson')))
    KEEP = {'North Anatolian Fault': ('strike', 20), 'East Anatolian Fault': ('strike', 20), 'Chaman': ('strike', 25), 'Altyn Tagh': ('strike', 25), 'Haiyuan': ('strike', 25), 'Karakoram': ('strike', 25), 'Kunlun Fault': ('strike', 25),
            'Red River Fault': ('strike', 25), 'Sagaing Fault': ('strike', 25), 'Sumatra Fault System': ('strike', 25), 'Talas Fergana': ('strike', 25), 'Xiangshuihe - Xiaojiang Fault System': ('strike', 25),
            'Main Pamir Thrust': ('reverse', 30), 'Longmen Shan Thrust Belt': ('reverse', 30), 'Dauki Thrust': ('reverse', 25), 'Matano Fault': ('strike', 20), 'Oriente Fault': ('strike', 25), 'Stanovoy Fault System': ('any', 30),
            'Morrocoy Fault Zone': ('strike', 20), 'Southern Panama Fault Zone': ('strike', 25), 'Baikal Rift': ('normal', 40), 'East African Rift System': ('normal', 40)}
    for f in zz['features']:
        nm = (f['properties'].get('Name') or '').strip()
        if nm in KEEP:
            geo = f['geometry']; ls = [geo['coordinates']] if geo['type'] == 'LineString' else geo['coordinates']
            for l in ls: REF.append((nm, KEEP[nm][0], KEEP[nm][1], [[q[0], q[1]] for q in l]))
except FileNotFoundError:
    pass
REF.append(('Dead Sea Transform', 'strike', 20, [[34.45, 28.0], [34.75, 29.0], [35.0, 29.6], [35.15, 30.2], [35.3, 30.8], [35.45, 31.3], [35.52, 31.8], [35.55, 32.4], [35.6, 33.0], [35.65, 33.3], [35.85, 33.7], [36.05, 34.1], [36.2, 34.6], [36.3, 35.1], [36.35, 35.6], [36.4, 36.1]]))
REF.append(('Main Recent Fault (Zagros)', 'strike', 15, [[45.1, 36.7], [45.6, 36.1], [46.2, 35.5], [46.9, 35.0], [47.7, 34.5], [48.4, 34.2], [48.75, 33.9], [49.05, 33.5], [49.6, 32.8]]))
SENSE = {'strike': ('Dextral', 'Sinistral', 'Strike-Slip', 'Dextral-Reverse', 'Dextral-Normal', 'Sinistral-Reverse', 'Sinistral-Normal', 'Dextral-Oblique', 'Dextral_Transform', 'Sinistral_Transform', 'Reverse-Strike-Slip', 'Normal-Strike-Slip', 'Reverse-Dextral', 'Normal-Dextral', 'Reverse-Sinistral', 'Normal-Sinistral'),
         'reverse': ('Reverse', 'Reverse-Strike-Slip', 'Reverse-Dextral', 'Reverse-Sinistral', 'Blind Thrust', 'Dextral-Reverse', 'Sinistral-Reverse'), 'normal': ('Normal', 'Normal-Dextral', 'Normal-Sinistral', 'Normal-Strike-Slip', 'Dextral-Normal', 'Sinistral-Normal')}
def seg_d(p, a, b):
    k = math.cos(math.radians(p[1])) * 111.32; ax, ay, bx, by, px, py = a[0] * k, a[1] * 110.57, b[0] * k, b[1] * 110.57, p[0] * k, p[1] * 110.57
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy; tt = 0 if L2 == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); return math.hypot(px - ax - tt * dx, py - ay - tt * dy)
def ref_name(lines, ty):
    pts = [q for l in lines for q in l]
    for nm, sense, buf, cl in REF:
        if sense != 'any' and ty not in SENSE[sense]: continue
        lo0, lo1, la0, la1 = min(q[0] for q in cl) - 1, max(q[0] for q in cl) + 1, min(q[1] for q in cl) - 1, max(q[1] for q in cl) + 1
        if not any(lo0 <= q[0] <= lo1 and la0 <= q[1] <= la1 for q in pts): continue
        inside = sum(1 for q in pts if min(seg_d(q, cl[i], cl[i + 1]) for i in range(len(cl) - 1)) <= buf)
        if inside >= 0.75 * len(pts): return nm
    return None
n_assigned = 0
for f in g['features']:
    p = f['properties']
    if p.get('catalog_name') == 'Bird 2003': continue  # plate boundaries come from the PB2002 steps instead
    geo = f['geometry']
    if not geo: continue
    lines = [geo['coordinates']] if geo['type'] == 'LineString' else geo['coordinates']
    L = sum(hav(l[i], l[i + 1]) for l in lines for i in range(len(l) - 1))
    if L <= 0: continue
    first, last = lines[0][0], lines[-1][-1]; az = bearing(first, last) % 180
    name = p.get('name') or rawname.get(p.get('catalog_id')) or ''
    assigned = None
    if not name:
        assigned = ref_name(lines, p.get('slip_type'))
        if assigned: name = assigned; n_assigned += 1
    if name: n_named += 1
    t = p.get('slip_type'); ti = TYPES.index(t) if t in TYPES else len(TYPES) - 1
    simp = []
    for l in lines:
        s = dp_simplify([[round(x[0], 4), round(x[1], 4)] for x in l], 0.0015)
        simp.append([v for q in s for v in (int(round(q[0] * 1e4)), int(round(q[1] * 1e4)))])
    rec = {'t': ti, 'g': simp, 'L': round(L, 1), 'az': round(az)}
    if name: rec['n'] = name.strip()
    if assigned: rec['na'] = 1
    d = tup(p.get('average_dip')); r = tup(p.get('average_rake')); sr = tup(p.get('net_slip_rate')); u = tup(p.get('upper_seis_depth')); lo = tup(p.get('lower_seis_depth'))
    if d: rec['dip'] = d
    if p.get('dip_dir'): rec['dd'] = p['dip_dir']
    if r: rec['rk'] = r
    if sr: rec['sr'] = sr
    if u and u[0] is not None: rec['ud'] = u[0]
    if lo and lo[0] is not None: rec['ld'] = lo[0]
    out.append(rec)
json.dump({'types': TYPES, 'f': out}, open(os.path.join(OUT, 'faults.json'), 'w'), separators=(',', ':'))
print('faults', len(out), 'named', n_named, 'named by location', n_assigned)

# ---------------------------------------------------------------- plate boundary steps → runs of the same boundary and class
st = json.load(open(os.path.join(SRC, 'tp/GeoJSON/PB2002_steps.json')))['features']
st.sort(key=lambda f: f['properties']['SEQNUM'])
runs = []; cur = None
for f in st:
    p = f['properties']; c = f['geometry']['coordinates']; key = (p['PLATEBOUND'], p['STEPCLASS'])
    a = [round(p['STARTLONG'], 3), round(p['STARTLAT'], 3)]; b = [round(p['FINALLONG'], 3), round(p['FINALLAT'], 3)]
    if cur and cur['k'] == key and abs(cur['pts'][-1][0] - a[0]) < 1e-6 and abs(cur['pts'][-1][1] - a[1]) < 1e-6:
        cur['pts'].append(b); cur['v'].append([p['VELOCITYLE'], p['VELOCITYAZ'], p['VELOCITYDI'], p['VELOCITYRI'], p['STEPLENGTH']])
    else:
        cur = {'k': key, 'pts': [a, b], 'v': [[p['VELOCITYLE'], p['VELOCITYAZ'], p['VELOCITYDI'], p['VELOCITYRI'], p['STEPLENGTH']]], 'oro': p['OROGEN'] == 'TRUE'}; runs.append(cur)
B = []
for r in runs:
    w = sum(v[4] for v in r['v']) or 1
    mean = lambda i: round(sum(v[i] * v[4] for v in r['v']) / w, 1)
    vs = [v[0] for v in r['v']]
    B.append({'p': r['k'][0], 'c': r['k'][1], 'g': [v for q in r['pts'] for v in (int(round(q[0] * 1e3)), int(round(q[1] * 1e3)))], 'L': round(w, 1), 'v': mean(0), 'vmin': round(min(vs), 1), 'vmax': round(max(vs), 1), 'di': mean(2), 'ri': mean(3), 'o': 1 if r['oro'] else 0})
json.dump(B, open(os.path.join(OUT, 'boundaries.json'), 'w'), separators=(',', ':'))
print('boundary runs', len(B))

# ---------------------------------------------------------------- orogens (diffuse deformation zones)
O = json.load(open(os.path.join(SRC, 'tp/GeoJSON/PB2002_orogens.json')))['features']
orog = []
for f in O:
    geo = f['geometry']; polys = [geo['coordinates']] if geo['type'] == 'Polygon' else geo['coordinates']
    orog.append({'n': f['properties']['Name'], 'g': [[[round(x[0], 3), round(x[1], 3)] for x in dp_simplify(ring, 0.02)] for poly in polys for ring in poly[:1]]})
json.dump(orog, open(os.path.join(OUT, 'orogens.json'), 'w'), separators=(',', ':'))

# ---------------------------------------------------------------- MORVEL56 plates: outlines and NNR angular velocities
tab = open(os.path.join(SRC, 'sf/plate_motion/models/NNR-MORVEL56-tab-delimited.text'), encoding='latin-1').read().splitlines()
poles = {}
for ln in tab:
    m = re.match(r'^\s+(.+?)\t(\w\w)\t(-?[\d.]+)\t(-?[\d.]+)\t([\d.]+) \+/- ([\d.]+)', ln)
    if m: poles[m.group(2)] = {'name': m.group(1).strip(), 'lat': float(m.group(3)), 'lon': float(m.group(4)), 'w': float(m.group(5)), 'sw': float(m.group(6))}
print('poles', len(poles))
bl = open(os.path.join(SRC, 'sf/plate_motion/models/MORVEL56-plate-boundaries.text'), encoding='latin-1').read().splitlines()
plates = {}; code = None
for ln in bl:
    s = ln.strip()
    if re.match(r'^[A-Za-z]{2}$', s): code = s; plates.setdefault(code, []).append([]); continue
    m = re.match(r'^(-?[\d.]+)\s+(-?[\d.]+)$', s)
    if m and code: plates[code][-1].append([float(m.group(2)), float(m.group(1))])
P = []
for c, rings in plates.items():
    if c not in poles: print('no pole', c); continue
    rr = []
    for ring in rings:
        if len(ring) < 3: continue
        # unwrap longitudes so a ring crossing the antimeridian stays continuous
        u = [ring[0][:]]
        for q in ring[1:]:
            lo = q[0]
            while lo - u[-1][0] > 180: lo -= 360
            while lo - u[-1][0] < -180: lo += 360
            u.append([lo, q[1]])
        rr.append([[round(x[0], 3), round(x[1], 3)] for x in dp_simplify(u, 0.01)])
    wr = lambda d: (d + 180) % 360 - 180
    pole = []
    for r in rr:  # rings that encircle a pole (North America, Antarctica) need a different point-in-polygon ray
        sm = sum(wr(r[i][0] - r[i - 1][0]) for i in range(len(r)))
        pole.append(0 if abs(sm) < 1 else (1 if sum(q[1] for q in r) / len(r) > 0 else -1))
    P.append(dict(poles[c], c=c, g=rr, pole=pole))
json.dump(P, open(os.path.join(OUT, 'plates.json'), 'w'), separators=(',', ':'))
print('plates', len(P), [p['c'] for p in P])
