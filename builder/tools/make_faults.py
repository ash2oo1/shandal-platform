"""Tile the GEM Global Active Faults database (CC BY-SA 4.0) into 10-degree JSON tiles.
Usage: python3 make_faults.py gem_active_faults_harmonized.geojson OUTDIR"""
import json, sys, os, math, re
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
d = json.load(open(src))
tiles = {}
def first(v):
    if v is None: return None
    m = re.match(r'\(([-\d.]*)', str(v)); 
    try: return float(m.group(1)) if m and m.group(1) else None
    except: return None
def simplify(pts, tol=0.004):
    if len(pts) < 3: return pts
    keep = [pts[0]]
    for p in pts[1:-1]:
        if abs(p[0]-keep[-1][0]) + abs(p[1]-keep[-1][1]) >= tol: keep.append(p)
    keep.append(pts[-1]); return keep
n = 0
for f in d['features']:
    g = f['geometry']
    if not g: continue
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    p = f['properties']
    for ln in lines:
        ln = simplify([[round(c[0], 3), round(c[1], 3)] for c in ln])
        if len(ln) < 2: continue
        xs = [c[0] for c in ln]; ys = [c[1] for c in ln]
        rec = [p.get('name') or '', (p.get('slip_type') or '').replace('_', ' '), first(p.get('net_slip_rate')), first(p.get('average_dip')), sum(ln, [])]
        for tx in range(math.floor(min(xs)/10), math.floor(max(xs)/10)+1):
            for ty in range(math.floor(min(ys)/10), math.floor(max(ys)/10)+1):
                tiles.setdefault((ty*10, tx*10), []).append(rec)
        n += 1
for (la, lo), recs in tiles.items():
    json.dump(recs, open(os.path.join(out, f'{la}_{lo}.json'), 'w'), separators=(',', ':'))
json.dump(sorted(f'{a}_{b}' for a, b in tiles), open(os.path.join(out, 'index.json'), 'w'))
print(n, 'lines in', len(tiles), 'tiles')
