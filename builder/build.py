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
import content_learn as CL

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), 'docs')
LUCIDE = os.path.join(ROOT, 'vendor', 'icons')
SIMPLE = os.path.join(ROOT, 'vendor', 'brand')
import time as _time
VERSION = _time.strftime('%Y%m%d%H%M')

CAT_ICONS = {'geology': 'pickaxe', 'terrain': 'mountain', 'remote': 'satellite', 'geophysics': 'activity', 'engineering': 'hard-hat', 'water': 'droplets', 'atmosphere': 'wind', 'climate': 'thermometer-sun', 'hazards': 'siren', 'labs': 'flask-conical'}
REDIRECTS = {'dem-hub': 'dem-studio', 'terrain-contours': 'dem-studio'}
FEATURED = ['dem-studio', 'structural-geotechnical', 'seismic-hazard', 'spectral-indices', 'hazards-monitor', 'grain-size']

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
    P.append(dict(path='learn/', tpl='learn.html', key='learn'))
    for i, l in enumerate(CL.LESSONS):
        P.append(dict(path=f'learn/{l["slug"]}/', tpl='lesson.html', key='lesson', lesson=l, prev=CL.LESSONS[i - 1] if i else None, nxt=CL.LESSONS[i + 1] if i + 1 < len(CL.LESSONS) else None))
    P.append(dict(path='login/', tpl='login.html', key='login'))
    for key, path in [('privacy', 'legal/privacy/'), ('terms', 'legal/terms/'), ('disclaimer', 'legal/disclaimer/')]:
        P.append(dict(path=path, tpl='pages.html', key=key))
    return P

PAGE_DATA = {
 'data': CX.DATA, 'earth': CX.EARTH, 'heritage': CX.HERITAGE, 'academy': CX.ACADEMY, 'library': CX.LIBRARY,
 'pricing': CX.PRICING, 'contact': CX.CONTACT, 'verify': CX.VERIFY, 'account': CX.ACCOUNT,
}

_EN1 = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
_EN10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
def en_words(n):
    if n < 20: return _EN1[n]
    return _EN10[n // 10] + ('-' + _EN1[n % 10] if n % 10 else '')
_AR_U = ['', 'إحدى', None, 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع']   # forms used with a feminine noun (أداة)
_AR_T = [None, None, ('عشرون', 'عشرين'), ('ثلاثون', 'ثلاثين'), ('أربعون', 'أربعين'), ('خمسون', 'خمسين'), ('ستون', 'ستين'), ('سبعون', 'سبعين'), ('ثمانون', 'ثمانين'), ('تسعون', 'تسعين')]
def ar_words(n, gen=False):
    """Arabic number words for a feminine counted noun (أداة); gen=True for the genitive (after a preposition)."""
    if n == 1: return 'واحدة'
    if n == 2: return 'اثنتين' if gen else 'اثنتان'
    if n < 10: return _AR_U[n]
    if n == 10: return 'عشر'
    if n == 12: return ('اثنتي' if gen else 'اثنتا') + ' عشرة'
    if n < 20: return _AR_U[n - 10] + ' عشرة'
    t, u = _AR_T[n // 10][1 if gen else 0], n % 10
    if not u: return t
    uw = ('اثنتين' if gen else 'اثنتان') if u == 2 else _AR_U[u]
    return uw + ' و' + t

def ntools(n, lang):
    """'n tools' with correct singular/dual/plural in both languages"""
    if lang == 'en': return '%d tool%s' % (n, '' if n == 1 else 's')
    if n == 1: return 'أداة واحدة'
    if n == 2: return 'أداتان'
    if 3 <= n <= 10: return '%d أدوات' % n
    return '%d أداة' % n

def _count(o, n):
    """replace {N} (digits) and the number words {NWE}/{nwe} (English), {NWA}/{NWAG} (Arabic nominative/genitive)
    with the live number of tools in every content string, so no count is ever written by hand"""
    if isinstance(o, str):
        e = en_words(n)
        return (o.replace('{NWE}', e[:1].upper() + e[1:]).replace('{nwe}', e).replace('{NWAG}', ar_words(n, True))
                 .replace('{NWA}', ar_words(n)).replace('{N}', str(n)))
    if isinstance(o, dict):
        for k in o: o[k] = _count(o[k], n)
        return o
    if isinstance(o, list):
        for i in range(len(o)): o[i] = _count(o[i], n)
        return o
    if isinstance(o, tuple): return tuple(_count(x, n) for x in o)
    return o

BASE = 'https://geologicalfieldsurvey.com/'
NOINDEX = {'login', 'account', 'verify'}          # private pages: kept out of search results and the sitemap
# addresses of the first version of the site (single html files at the root) forward to their tools today
OLD_URLS = {'index.html': '', '2d_map_lab.html': 'tools/contour-lab/', 'contour-map.html': 'tools/dem-studio/', 'dem-hub.html': 'tools/dem-studio/',
            'Geophysics_Lab.html': 'tools/magnetic-lab/', 'ShandalGeo-Alert.html': 'tools/hazards-monitor/', 'geo-environmental-dynamics-survey.html': 'tools/env-monitoring/',
            'shandal-env-module.html': 'tools/env-monitoring/', 'geopark.html': 'geoheritage/', 'geopark1.html': 'geoheritage/', 'geopark2.html': 'geoheritage/',
            'geopark3.html': 'geoheritage/', 'geopark4.html': 'geoheritage/', 'geopark5.html': 'geoheritage/', 'geopark6.html': 'geoheritage/',
            'geothermal_lab.html': 'tools/geothermal-lab/', 'kerogen_lab.html': 'tools/kerogen-lab/', 'palynofacies_lab.html': 'tools/palynofacies-lab/',
            'seismic-evaluation.html': 'tools/seismic-evaluation/', 'strata.html': 'tools/strata/', 'test-structural.html': 'tools/structural-geotechnical/',
            'quarry.html': 'tools/quarry-survey/', 'login.html': 'login/', 'about.html': 'about/', 'pricing.html': 'pricing/', 'contact.html': 'contact/'}

def _org(lang):
    return {'@type': 'Organization', '@id': BASE + '#org', 'name': 'Shandal Geological Field Survey System',
            'alternateName': ['Shandal System', 'نظام شندل', 'نظام شندل للمسح الميداني الجيولوجي', 'Shandal Geo'],
            'url': BASE, 'logo': {'@type': 'ImageObject', 'url': BASE + 'assets/img/emblem.png', 'width': 512, 'height': 512},
            'image': BASE + 'assets/img/og.png', 'foundingDate': '2025', 'foundingLocation': 'Baghdad, Iraq',
            'description': CP.ABOUT['lead'][lang], 'founder': {'@id': BASE + '#founder'},
            'address': {'@type': 'PostalAddress', 'addressLocality': 'Baghdad', 'addressCountry': 'IQ'},
            'contactPoint': {'@type': 'ContactPoint', 'contactType': 'customer support', 'telephone': '+' + CP.WA, 'availableLanguage': ['Arabic', 'English']},
            'knowsAbout': ['Field geology', 'Structural geology', 'Geotechnical engineering', 'Remote sensing', 'Geophysics', 'Seismic hazard', 'Geoheritage', 'GIS'],
            'sameAs': [CP.FACEBOOK, CP.YOUTUBE, 'https://github.com/ash2oo1/shandal-platform']}

def _founder():
    return {'@type': 'Person', '@id': BASE + '#founder', 'name': 'Ali Shandal Al-Janabi', 'alternateName': ['علي شندل الجنابي', 'Ali Shandal Falah Al-Janabi', 'علي شندل فلاح الجنابي'],
            'jobTitle': 'Geologist, remote sensing and geophysics', 'nationality': 'Iraqi', 'url': BASE + 'about/',
            'image': BASE + 'assets/img/founder.jpg', 'worksFor': {'@id': BASE + '#org'},
            'alumniOf': {'@type': 'CollegeOrUniversity', 'name': 'Al-Karkh University of Science'}, 'sameAs': ['https://www.instagram.com/ash2oo1']}

def jsonld(key, lang, url, title, desc, tool=None, faq=None):
    site = {'@type': 'WebSite', '@id': BASE + '#website', 'url': BASE, 'name': 'نظام شندل' if lang == 'ar' else 'Shandal System',
            'alternateName': ['Shandal Geological Field Survey System', 'نظام شندل للمسح الميداني الجيولوجي'], 'inLanguage': ['ar', 'en'], 'publisher': {'@id': BASE + '#org'}}
    g = [_org(lang), _founder(), site]
    page = {'@type': 'AboutPage' if key == 'about' else 'WebPage', '@id': url + '#page', 'url': url, 'name': title, 'description': desc,
            'inLanguage': lang, 'isPartOf': {'@id': BASE + '#website'}, 'publisher': {'@id': BASE + '#org'}}
    g.append(page)
    home = BASE + ('ar/' if lang == 'ar' else '')
    if key == 'home':
        g.append({'@type': 'WebApplication', '@id': BASE + '#app', 'name': 'نظام شندل للمسح الميداني الجيولوجي' if lang == 'ar' else 'Shandal Geological Field Survey System',
                  'url': home, 'applicationCategory': 'BusinessApplication', 'applicationSubCategory': 'Geoscience field survey',
                  'operatingSystem': 'Any modern browser: Android, iOS, iPadOS, Windows, macOS, Linux', 'browserRequirements': 'Requires JavaScript',
                  'description': desc, 'image': BASE + 'assets/img/og.png', 'author': {'@id': BASE + '#founder'}, 'publisher': {'@id': BASE + '#org'},
                  'inLanguage': ['ar', 'en'], 'featureList': [t['name'][lang] for t in TOOLS]})
        if faq:
            g.append({'@type': 'FAQPage', '@id': url + '#faq', 'mainEntity': [{'@type': 'Question', 'name': q[0][lang], 'acceptedAnswer': {'@type': 'Answer', 'text': q[1][lang]}} for q in faq]})
    if tool is not None:
        g.append({'@type': 'WebApplication', '@id': url + '#app', 'name': tool['name'][lang], 'alternateName': tool['name']['ar' if lang == 'en' else 'en'], 'url': url,
                  'description': tool['summary'][lang], 'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Any modern browser',
                  'isPartOf': {'@id': BASE + '#app'}, 'publisher': {'@id': BASE + '#org'}, 'author': {'@id': BASE + '#founder'}, 'inLanguage': lang})
        g.append({'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'نظام شندل' if lang == 'ar' else 'Shandal System', 'item': home},
            {'@type': 'ListItem', 'position': 2, 'name': UI['cat_' + tool['cat']][lang], 'item': home + 'platform/'},
            {'@type': 'ListItem', 'position': 3, 'name': tool['name'][lang], 'item': url}]})
    return Markup(json.dumps({'@context': 'https://schema.org', '@graph': g}, ensure_ascii=False).replace('</', '<\\/'))

INDEXNOW_KEY = 'b7e3c1a95f2d4e8a9c6b0d4f1a2e3c7d'

def llms(day):
    """llms.txt: a plain description of the system for AI assistants and answer engines (both languages)"""
    A, H = CP.ABOUT, CP.HOME
    clean = lambda x: re.sub(r'<[^>]+>', '', str(x))
    cats = {}
    for t in TOOLS: cats.setdefault(t['cat'], []).append(t)
    L = ['# Shandal Geological Field Survey System (نظام شندل للمسح الميداني الجيولوجي)', '',
         '> ' + clean(A['lead']['en']), '> ' + clean(A['lead']['ar']), '',
         'Website: ' + BASE + ' (English) · ' + BASE + 'ar/ (العربية)',
         'Also called: Shandal System, Shandal Geo, نظام شندل.',
         'Founder and designer: Ali Shandal Al-Janabi (علي شندل الجنابي), Iraqi geologist specialising in remote sensing and geophysics, Baghdad, Iraq.',
         'Founded: 2025 · Official launch: 5 April 2026 · Registered as a scientific work no. 2841/ع at the Iraqi National Centre for Protection of Copyright and Related Rights (13 April 2026).',
         f'Contact: WhatsApp +{CP.WA} · Facebook {CP.FACEBOOK} · YouTube {CP.YOUTUBE}', f'Updated: {day}', '',
         '## What it is', clean(H['desc']['en']), clean(A['mission_p1']['en']), clean(A['mission_p2']['en']), '',
         '## ما هو', clean(H['desc']['ar']), clean(A['mission_p1']['ar']), clean(A['mission_p2']['ar']), '',
         '## Main pages', f'- [Home]({BASE}): the system and its tools', f'- [Platform]({BASE}platform/): how the workstation works', f'- [About]({BASE}about/): history, founder, registration',
         f'- [Pricing]({BASE}pricing/): plans and payment', f'- [Academy]({BASE}academy/) and [Library]({BASE}library/)', f'- [Geo-heritage]({BASE}geoheritage/): geological and archaeological sites of Iraq', '',
         f'## Tools ({len(TOOLS)})']
    for c, ts in cats.items():
        L.append(f"### {UI['cat_' + c]['en']} · {UI['cat_' + c]['ar']}")
        for t in ts:
            L.append(f"- [{t['name']['en']} · {t['name']['ar']}]({BASE}tools/{t['slug']}/): {clean(t['summary']['en'])}")
        L.append('')
    L += ['## Frequently asked questions']
    for q in CP.FAQ:
        L += [f"- {clean(q[0]['en'])} {clean(q[1]['en'])}", f"- {clean(q[0]['ar'])} {clean(q[1]['ar'])}"]
    open(os.path.join(OUT, 'llms.txt'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

def build():
    for mod in (CP, CX):
        for k, v in list(vars(mod).items()):
            if k.isupper(): setattr(mod, k, _count(v, len(TOOLS)))
    _count(UI, len(TOOLS))
    cname = open(os.path.join(OUT, 'CNAME')).read() if os.path.exists(os.path.join(OUT, 'CNAME')) else 'geologicalfieldsurvey.com'  # custom domain set on GitHub (kept even if an earlier build stopped half way)
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(os.path.join(ROOT, 'src'), OUT)
    env = Environment(loader=FileSystemLoader(os.path.join(ROOT, 'templates')), autoescape=True, trim_blocks=True, lstrip_blocks=True)
    env.filters['ntools'] = ntools
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
                       plans=CP.PLANS, plan_features=CP.PLAN_FEATURES, faq=CP.FAQ, A=CP.ABOUT, PG=CX.PLATFORM, page=pg['key'], learn_lessons=CL.LESSONS, LXG=CL.LEARN)
            key = pg['key']
            if key == 'home':
                ctx.update(title=CP.HOME['title'][lang], desc=CP.HOME['desc'][lang], featured=[x for s in FEATURED for x in TOOLS if x['slug'] == s])
            elif key == 'platform':
                ctx.update(title=CX.PLATFORM['title'][lang], desc=CX.PLATFORM['p'][lang])
            elif key == 'app':
                tl = pg['tool']
                L_ = lambda v: v[lang] if isinstance(v, dict) else v
                meta = {'name': L_(tl['name']), 'cat': UI['cat_' + tl['cat']][lang], 'summary': L_(tl['summary']), 'overview': [L_(x) for x in tl.get('overview', [])],
                        'method': [{'h': L_(m.get('h', '')), 'p': L_(m.get('p', '')), 'eq': m.get('eq', '')} for m in tl.get('method', [])], 'refs': list(tl.get('refs', []))}
                ctx.update(tool=tl, title=f"{tl['name'][lang]} — {UI['workspace'][lang]} · {UI['brand'][lang]}", desc=tl['summary'][lang], solid_header=True,
                           tool_meta=Markup(json.dumps(meta, ensure_ascii=False).replace('</', '<\\/')))
            elif key == 'tool':
                tl = pg['tool']
                ctx.update(tool=tl, related=[x for s in tl['related'] for x in TOOLS if x['slug'] == s],
                           title=f"{tl['name'][lang]} — {UI['brand'][lang]}", desc=tl['summary'][lang])
            elif key == 'about':
                ctx.update(title=CP.ABOUT['title'][lang], desc=CP.ABOUT['lead'][lang], crumb=CP.ABOUT['title'][lang], h1=Markup(CP.ABOUT['title'][lang]), lead=Markup(CP.ABOUT['lead'][lang]))
            elif key == 'learn':
                ctx.update(LX=CL.LEARN, disciplines=CL.DISCIPLINES, lessons=CL.LESSONS, title=CL.LEARN['title'][lang], desc=CL.LEARN['p'][lang])
            elif key == 'lesson':
                l = pg['lesson']; D = [d for d in CL.DISCIPLINES if d['key'] == l['disc']][0]
                ctx.update(LX=CL.LEARN, L=l, D=D, prev=pg['prev'], nxt=pg['nxt'], title=f"{l['name'][lang]} — {CL.LEARN['h'][lang]}", desc=l['tagline'][lang])
            elif key == 'login':
                ctx.update(title=CX.LOGIN['title'][lang], desc=CX.LOGIN['art_p'][lang], X=CX.LOGIN, solid_header=True)
            elif key in ('privacy', 'terms', 'disclaimer'):
                D = {'privacy': CX.PRIVACY, 'terms': CX.TERMS, 'disclaimer': CX.DISCLAIMER}[key]
                ctx.update(page='legal', X=CX.LEGAL_COMMON, legal=D['sections'], title=f"{D['title'][lang]} — {UI['brand'][lang]}", desc=D['p'][lang],
                           crumb=D['title'][lang], h1=Markup(D['title'][lang]), lead=Markup(D['p'][lang]))
            else:
                D = PAGE_DATA[key]
                ctx.update(X=D, title=D['title'][lang], desc=D['p'][lang], crumb=D['h'][lang], h1=Markup(D['h'][lang]), lead=Markup(D['p'][lang]))
            canon = BASE + full
            ctx.update(canon=canon, canon_en=BASE + path, canon_ar=BASE + 'ar/' + path, noindex=key in NOINDEX, og_image=BASE + 'assets/img/og.png',
                       ldjson=jsonld(key, lang, canon, str(ctx.get('title', '')), str(ctx.get('desc', '')), tool=pg.get('tool') if key in ('tool', 'app') else None, faq=CP.FAQ))
            out_html = env.get_template(pg['tpl']).render(**ctx)
            dest = os.path.join(OUT, full, 'index.html')
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            open(dest, 'w', encoding='utf-8').write(out_html)
            count += 1
    # retired tool addresses forward to the merged tool (bookmarks and shared links keep working)
    for old_slug, new_slug in REDIRECTS.items():
        for lp in ('', 'ar/'):
            for sub in ('', 'app/'):
                dest = os.path.join(OUT, lp + 'tools/' + old_slug + '/' + sub, 'index.html')
                rel = '../' * (2 if sub else 1) + new_slug + '/' + sub + 'index.html'
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                open(dest, 'w', encoding='utf-8').write(f'<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="{rel}"><meta http-equiv="refresh" content="0; url={rel}"><script>location.replace("{rel}"+location.search+location.hash)</script></head><body><a href="{rel}">{rel}</a></body></html>')
    # addresses of the first version of the site forward to the same work today (search engines and old shared links)
    for oldf, newp in OLD_URLS.items():
        if oldf == 'index.html': continue
        tgt = BASE + newp
        open(os.path.join(OUT, oldf), 'w', encoding='utf-8').write(f'<!doctype html><html><head><meta charset="utf-8"><title>Shandal System · نظام شندل</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="{tgt}"><meta http-equiv="refresh" content="0; url={tgt}"><script>location.replace("{tgt}"+location.search+location.hash)</script></head><body><a href="{tgt}">{tgt}</a></body></html>')
    # sitemap with both languages linked to each other, robots, files for AI assistants
    day = _time.strftime('%Y-%m-%d')
    pub = [p for p in pages() if p['key'] not in NOINDEX]
    def alt(p):
        return (f'<xhtml:link rel="alternate" hreflang="en" href="{BASE}{p["path"]}"/><xhtml:link rel="alternate" hreflang="ar" href="{BASE}ar/{p["path"]}"/>'
                f'<xhtml:link rel="alternate" hreflang="x-default" href="{BASE}ar/{p["path"]}"/>')
    def pri(p): return '1.0' if p['key'] == 'home' else '0.9' if p['key'] in ('platform', 'about', 'tool') else '0.7'
    sm = ''.join(f'<url><loc>{BASE}{l}{p["path"]}</loc><lastmod>{day}</lastmod><priority>{pri(p)}</priority>{alt(p)}</url>' for p in pub for l in ('ar/', ''))
    open(os.path.join(OUT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + sm + '</urlset>')
    open(os.path.join(OUT, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nDisallow: /account/\nDisallow: /ar/account/\n\nSitemap: {BASE}sitemap.xml\n')
    llms(day)
    open(os.path.join(OUT, INDEXNOW_KEY + '.txt'), 'w').write(INDEXNOW_KEY)
    open(os.path.join(OUT, '.nojekyll'), 'w').write('')
    if cname: open(os.path.join(OUT, 'CNAME'), 'w').write(cname)
    print('pages:', count)

if __name__ == '__main__':
    build()
