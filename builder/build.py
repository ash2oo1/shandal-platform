# -*- coding: utf-8 -*-
"""Static site generator for the Shandal System website. Run: python3 build.py"""
import os, re, json, shutil, math, random, html
from jinja2 import Environment, FileSystemLoader
from markupsafe import Markup

import illus
from content_ui import UI
from content_tools import TOOLS, CATS
import content_pages as CP
import content_extra as CX

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), 'docs')
LUCIDE = os.path.join(ROOT, 'vendor', 'icons')
SIMPLE = os.path.join(ROOT, 'vendor', 'brand')
import time as _time
VERSION = _time.strftime('%Y%m%d%H%M')

CAT_ICONS = {'geology': 'pickaxe', 'terrain': 'mountain', 'engineering': 'hard-hat', 'environment': 'leaf', 'hazards': 'siren', 'labs': 'flask-conical'}
FEATURED = ['terrain-contours', 'structural-geotechnical', 'seismic-hazard', 'spectral-indices', 'hazards-monitor', 'grain-size']

_icon_cache = {}
def icon(name, cls='ico'):
    if name not in _icon_cache:
        s = open(os.path.join(LUCIDE, name + '.svg')).read()
        inner = re.search(r'<svg[^>]*>(.*)</svg>', s, re.S).group(1)
        _icon_cache[name] = re.sub(r'\s+', ' ', inner).strip()
    return Markup(f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{_icon_cache[name]}</svg>')

def brandicon(name):
    s = open(os.path.join(SIMPLE, name + '.svg')).read()
    d = re.search(r'<path d="([^"]+)"', s).group(1)
    return Markup(f'<svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17" fill="currentColor"><path d="{d}"/></svg>')

def bg_contours():
    """Contour lines for inner-page heroes."""
    nx, ny, cell = 71, 31, 20
    def z(x, y): return illus.terrain(x, y, 2.2) + 14 * math.sin(x * 9) * math.cos(y * 3)
    g = [[z(i / (nx - 1), j / (ny - 1)) for i in range(nx)] for j in range(ny)]
    paths = []
    for lv in range(10, 170, 8):
        segs = illus.march(g, nx, ny, cell, 0, 0, lv)
        op = .55 if lv % 40 == 2 else .28
        paths.append(f'<path d="{illus.segs_path(segs)}" fill="none" stroke="#DEC07A" stroke-opacity="{op}" stroke-width="1"/>')
    return Markup(f'<svg viewBox="0 0 {(nx-1)*cell} {(ny-1)*cell}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">{"".join(paths)}</svg>')

def cover_lines():
    nx, ny, cell = 16, 21, 10
    g = [[illus.terrain(i / (nx - 1), j / (ny - 1), 3.1) for i in range(nx)] for j in range(ny)]
    out = []
    for lv in range(20, 150, 9):
        out.append(f'<path d="{illus.segs_path(illus.march(g, nx, ny, cell, 0, 0, lv))}" fill="none" stroke="#DEC07A" stroke-opacity=".35" stroke-width=".8"/>')
    return Markup(''.join(out))

# ------------------------------------------------------------------ pages
def pages():
    P = []
    P.append(dict(path='', tpl='home.html', key='home'))
    P.append(dict(path='platform/', tpl='platform.html', key='platform'))
    for t in TOOLS:
        P.append(dict(path=f'tools/{t["slug"]}/', tpl='tool.html', key='tool', tool=t))
        if os.path.exists(os.path.join(ROOT, 'templates', 'apps', t['slug'] + '.html')):
            P.append(dict(path=f'tools/{t["slug"]}/app/', tpl='apps/' + t['slug'] + '.html', key='app', tool=t))
    for key, path in [('data', 'data/'), ('earth', 'earth-now/'), ('heritage', 'geoheritage/'), ('academy', 'academy/'), ('library', 'library/'),
                      ('about', 'about/'), ('pricing', 'pricing/'), ('contact', 'contact/'), ('verify', 'verify/'), ('account', 'account/')]:
        P.append(dict(path=path, tpl='pages.html', key=key))
    P.append(dict(path='login/', tpl='login.html', key='login'))
    for key, path in [('privacy', 'legal/privacy/'), ('terms', 'legal/terms/'), ('disclaimer', 'legal/disclaimer/')]:
        P.append(dict(path=path, tpl='pages.html', key=key))
    return P

PAGE_DATA = {
 'data': CX.DATA, 'earth': CX.EARTH, 'heritage': CX.HERITAGE, 'academy': CX.ACADEMY, 'library': CX.LIBRARY,
 'pricing': CX.PRICING, 'contact': CX.CONTACT, 'verify': CX.VERIFY, 'account': CX.ACCOUNT,
}

def build():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(os.path.join(ROOT, 'src'), OUT)
    env = Environment(loader=FileSystemLoader(os.path.join(ROOT, 'templates')), autoescape=True, trim_blocks=True, lstrip_blocks=True)
    bgc = bg_contours(); covl = cover_lines()
    count = 0
    for lang in ('en', 'ar'):
        other = 'ar' if lang == 'en' else 'en'
        for pg in pages():
            path = pg['path']
            full = (('ar/' if lang == 'ar' else '') + path)
            depth = full.count('/')
            prefix = '../' * depth if depth else './'
            def u(p, _lang=lang, _prefix=prefix):
                if p.startswith('assets/') or p.startswith('http'):
                    return _prefix + p
                q = (('ar/' if _lang == 'ar' else '') + p)
                if '#' in q:
                    a, h = q.split('#', 1); return _prefix + a + 'index.html#' + h
                return _prefix + q + 'index.html'
            def u_lang(l, _prefix=prefix, _path=path):
                return _prefix + (('ar/' if l == 'ar' else '') + _path) + 'index.html'
            tr = lambda d, _l=lang: Markup(d[_l]) if isinstance(d, dict) else d
            t = lambda k, _l=lang: Markup(UI[k][_l])
            def il(key, label):
                return Markup(illus.draw(key, str(label)))
            index = [{'n': x['name'][lang], 'd': x['tagline'][lang], 'u': u('tools/' + x['slug'] + '/'), 'i': str(icon(x['icon'])),
                      'k': ' '.join([x['name']['en'], x['name']['ar'], x['tagline'][lang], x['summary'][lang], x['slug'], ' '.join(r for r in x['refs'])])} for x in TOOLS]
            ctx = dict(lang=lang, other=other, u=u, u_lang=u_lang, t=t, tr=tr, icon=icon, brandicon=brandicon, illus=il,
                       tools=TOOLS, cats=CATS, cat_icons=CAT_ICONS, home=CP.HOME, H=CP.HOME, P=CP, ai={k: (v[lang] if isinstance(v, dict) else [i[lang] for i in v]) for k, v in CX.AI.items()},
                       version=VERSION, search_index=Markup(json.dumps(index, ensure_ascii=False)), bgcontours=bgc, coverlines=covl,
                       sources=CP.DATA_SOURCES, sites=CP.SITES, more_sites=CP.MORE_SITES, courses=CP.COURSES, books=CP.BOOKS,
                       plans=CP.PLANS, plan_features=CP.PLAN_FEATURES, faq=CP.FAQ, A=CP.ABOUT, PG=CX.PLATFORM, page=pg['key'])
            key = pg['key']
            if key == 'home':
                ctx.update(title=CP.HOME['title'][lang], desc=CP.HOME['desc'][lang], featured=[x for s in FEATURED for x in TOOLS if x['slug'] == s])
            elif key == 'platform':
                ctx.update(title=CX.PLATFORM['title'][lang], desc=CX.PLATFORM['p'][lang])
            elif key == 'app':
                tl = pg['tool']
                ctx.update(tool=tl, title=f"{tl['name'][lang]} — {UI['workspace'][lang]} · {UI['brand'][lang]}", desc=tl['summary'][lang], solid_header=True)
            elif key == 'tool':
                tl = pg['tool']
                ctx.update(tool=tl, related=[x for s in tl['related'] for x in TOOLS if x['slug'] == s],
                           title=f"{tl['name'][lang]} — {UI['brand'][lang]}", desc=tl['summary'][lang])
            elif key == 'about':
                ctx.update(title=CP.ABOUT['title'][lang], desc=CP.ABOUT['lead'][lang], crumb=CP.ABOUT['title'][lang], h1=Markup(CP.ABOUT['title'][lang]), lead=Markup(CP.ABOUT['lead'][lang]))
            elif key == 'login':
                ctx.update(title=CX.LOGIN['title'][lang], desc=CX.LOGIN['art_p'][lang], X=CX.LOGIN, solid_header=True)
            elif key in ('privacy', 'terms', 'disclaimer'):
                D = {'privacy': CX.PRIVACY, 'terms': CX.TERMS, 'disclaimer': CX.DISCLAIMER}[key]
                ctx.update(page='legal', X=CX.LEGAL_COMMON, legal=D['sections'], title=f"{D['title'][lang]} — {UI['brand'][lang]}", desc=D['p'][lang],
                           crumb=D['title'][lang], h1=Markup(D['title'][lang]), lead=Markup(D['p'][lang]))
            else:
                D = PAGE_DATA[key]
                ctx.update(X=D, title=D['title'][lang], desc=D['p'][lang], crumb=D['h'][lang], h1=Markup(D['h'][lang]), lead=Markup(D['p'][lang]))
            out_html = env.get_template(pg['tpl']).render(**ctx)
            dest = os.path.join(OUT, full, 'index.html')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            open(dest, 'w', encoding='utf-8').write(out_html)
            count += 1
    # 404
    # sitemap / robots
    base = 'https://geologicalfieldsurvey.com/'
    urls = [base + ('ar/' if l == 'ar' else '') + p['path'] for l in ('en', 'ar') for p in pages()]
    open(os.path.join(OUT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>{x}</loc></url>' for x in urls) + '</urlset>')
    open(os.path.join(OUT, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nSitemap: {base}sitemap.xml\n')
    open(os.path.join(OUT, '.nojekyll'), 'w').write('')
    print('pages:', count)

if __name__ == '__main__':
    build()
