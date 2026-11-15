"""Ищет примеры снимков на каждой плёнке под свободными лицензиями (CC0, PD, CC BY, CC BY-SA).

Источники: Wikimedia Commons (категории «Photographs taken on …») и Openverse (в основном Flickr).
Запуск из папки репозитория:  python3 tools/find_photos.py  →  tools/photos_raw.json (кандидаты)
Потом отобранные кандидаты попадают в tools/photos.json, который встраивает build_films.py.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'film-course-site/1.0 (static site build script)'
OUT = os.path.join(HERE, 'photos_raw.json')

# id плёнки → (поисковые запросы, обязательный шаблон в «склеенном» тексте: строчные буквы и цифры без пробелов)
FILMS = {
    'lucky-color-400': (['Lucky Color 400', 'Lucky C400', 'Lucky 400 film', '乐凯 400'], r'(lucky(color|c)?400|乐凯400)'),
    'lucky-color-200': (['Lucky Color 200', 'Lucky C200', 'Lucky 200 film', '乐凯 200'], r'(lucky(color|c)?200|乐凯200)'),
    'kodak-vision3-500t': (['Vision3 500T', 'Kodak 5219'], r'(vision3500t|5219)'),
    'kodak-vision3-250d': (['Vision3 250D', 'Kodak 5207'], r'(vision3250d|5207)'),
    'lomography-lomochrome-classicolor-200': (['LomoChrome Classicolor'], r'classicolor'),
    'color-negative-400d': (['Color Negative 400D'], r'colornegative400d'),
    'color-negative-800t': (['Color Negative 800T'], r'colornegative800t'),
    'harman-phoenix-ii-200': (['Harman Phoenix II', 'Phoenix II 200', 'Harman Phoenix 2'], r'phoenix(ii|2)'),
    'harman-phoenix-200': (['Harman Phoenix 200'], r'harmanphoenix(200)?(?!ii|2)'),
    'cinestill-800t': (['CineStill 800T'], r'cinestill800'),
    'cinestill-400d': (['CineStill 400D'], r'cinestill400'),
    'orwo-wolfen-p400': (['ORWO P400', 'Wolfen P400'], r'(orwo|wolfen)p400'),
    'orwo-wolfen-np100': (['ORWO NP100', 'Wolfen NP100'], r'np100'),
    'lucky-shd-400': (['Lucky SHD 400', 'Lucky SHD400', 'Lucky 400 black and white'], r'luckyshd400|lucky(bw|blackandwhite)?400'),
    'lucky-shd-100': (['Lucky SHD 100'], r'luckyshd100'),
    'lomography-redscale-xr-50-200': (['Lomography Redscale XR', 'Redscale XR'], r'redscale'),
    'agfa-apx-100': (['Agfa APX 100'], r'apx100'),
    'agfa-apx-400': (['Agfa APX 400'], r'apx400'),
    'cyberpunk-800t': (['Cyberpunk 800T film'], r'cyberpunk800t'),
    'cyberpunk-400d': (['Cyberpunk 400D film'], r'cyberpunk400d'),
    'lomography-lomochrome-purple-100-400': (['LomoChrome Purple'], r'lomochromepurple'),
    'lomography-lomochrome-metropolis-100-400': (['LomoChrome Metropolis'], r'lomochromemetropolis'),
    'lomography-color-negative-800': (['Lomography 800', 'Lomography Color Negative 800'], r'lomo(graphy)?(colornegative|cn)?800'),
    'lomography-color-negative-400': (['Lomography 400', 'Lomography Color Negative 400'], r'lomo(graphy)?(colornegative|cn)?400'),
    'lomography-color-negative-100': (['Lomography 100', 'Lomography Color Negative 100'], r'lomo(graphy)?(colornegative|cn)?100'),
    'aerocolor-alien-film-125': (['Aerocolor', 'Kodak Aerocolor'], r'aerocolor'),
    'orwo-wolfen-nc400': (['ORWO NC400', 'Wolfen NC400'], r'nc400'),
    'orwo-wolfen-nc500': (['ORWO NC500', 'Wolfen NC500'], r'nc500'),
    'fujifilm-eterna-160t': (['Eterna 160T', 'Fuji 8553', 'Fujifilm Eterna 160', 'Eterna 160'], r'(eterna160|8553)'),
    'fujifilm-eterna-500t': (['Eterna 500T', 'Fuji Eterna Vivid 500'], r'eterna(vivid)?500'),
    'kodak-vision2-500t': (['Vision2 500T', 'Kodak 5218'], r'(vision2500t|5218)'),
    'kodak-vision2-250d': (['Vision2 250D', 'Kodak 5205'], r'(vision2250d|5205)'),
    'ilford-pan-50': (['Ilford Pan F', 'Pan F Plus 50'], r'panf'),
    'kentmere-400': (['Kentmere 400'], r'kentmere(pan)?400'),
    'kentmere-100': (['Kentmere 100'], r'kentmere(pan)?100'),
    'fomapan-creative-200': (['Fomapan 200', 'Fomapan Creative 200'], r'fomapan(creative)?200'),
    'lucky-aerial-film-1021-200': (['Lucky aerial film'], r'luckyaerial'),
    'fujifilm-400': (['Fujifilm 400 film', 'Fuji Superia 400'], r'(fujifilm400|fujicolor400|superia400|superiaxtra400|fuji400)'),
    'fujifilm-200': (['Fujifilm 200 film', 'Fujicolor C200'], r'(fujifilm200|fujicolor200|fujicolorc200|fujic200|fuji200)'),
    'kodak-gold-200': (['Kodak Gold 200'], r'gold200'),
    'fomapan-action-400': (['Fomapan 400'], r'fomapan(action)?400'),
    'ilford-xp2-super-400': (['Ilford XP2'], r'xp2'),
    'ilford-delta-400': (['Ilford Delta 400'], r'delta400'),
    'ilford-delta-100': (['Ilford Delta 100'], r'delta100'),
    'ilford-hp5-plus-400': (['Ilford HP5'], r'hp5'),
    'ilford-fp4-plus-125': (['Ilford FP4'], r'fp4'),
    'kodak-ektar-100': (['Kodak Ektar 100'], r'ektar(100)?'),
    'ilford-sfx-200': (['Ilford SFX 200'], r'sfx200|ilfordsfx'),
    'ilford-ortho-plus-80': (['Ilford Ortho Plus'], r'ilfordortho|orthoplus'),
    'ilford-pan-400': (['Ilford Pan 400'], r'ilfordpan400'),
    'ilford-pan-100': (['Ilford Pan 100'], r'ilfordpan100'),
    'kodak-ektachrome-e100': (['Ektachrome E100'], r'ektachromee100|ektachrome100|e100(?!vs|g)'),
    'kodak-portra-400': (['Kodak Portra 400'], r'portra400'),
    'kodak-portra-160': (['Kodak Portra 160'], r'portra160'),
    'kodak-portra-800': (['Kodak Portra 800'], r'portra800'),
    'kodak-pro-image-100': (['Kodak Pro Image 100', 'Kodak ProImage', 'Pro Image 100 film'], r'proimage(100)?'),
    'fujifilm-velvia-100': (['Fujifilm Velvia 100'], r'velvia100(?!f)'),
    'fujifilm-provia-100f': (['Fujifilm Provia 100F'], r'provia(100f?)?'),
    'kodak-t-max-p3200': (['Kodak TMax P3200', 'T-Max 3200'], r't?max(p)?3200|tmz'),
    'kodak-color-a125': (['Kodak ColorPlus 200 A125', 'Kodak Color A125'], r'a125'),
    'ilford-delta-3200': (['Ilford Delta 3200'], r'delta3200'),
    'kodak-tri-x-400': (['Kodak Tri-X 400'], r'trix'),
    'kodak-t-max-400': (['Kodak T-Max 400'], r'tmax400|tmy'),
    'kodak-t-max-100': (['Kodak T-Max 100'], r'tmax100|tmx(?!\d)'),
    'agfa-aviphot-pan-200': (['Agfa Aviphot', 'Aviphot Pan 200', 'Rollei Superpan 200'], r'aviphot|superpan200'),
    'tasma-tip-42l-400': (['Tasma 42L', 'Тасма 42Л', 'Tasma film', 'Тасма плёнка', 'Tasma Type-42'], r'(tasma|тасма)'),
    'kodak-colorplus-200': (['Kodak ColorPlus 200'], r'colorplus'),
    'kodacolor-200-eastman': (['Kodacolor 200'], r'kodacolor200'),
    'kodak-double-x-5222': (['Kodak Double-X 5222', 'Eastman Double-X'], r'doublex|5222'),
    'kodak-ultramax-400': (['Kodak UltraMax 400'], r'ultramax'),
}
OK_OV = {'by', 'by-sa', 'cc0', 'pdm'}
BAD = re.compile(r'(\bbox\b|packag|canister|cartridge|\bfilm roll\b|rolls of film|unboxing|film stock|expired film|\bcamera\b.*\bfor sale\b)', re.I)


def norm(s):
    return re.sub(r'[^0-9a-zа-яё]+', '', (s or '').lower())


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if '429' in str(e):
                time.sleep(30 * (i + 1)); continue
            if i == 3: print('  ! ', e, url[:90], file=sys.stderr); return {}
            time.sleep(3)
    return {}


def commons_api(**p):
    p.update(format='json', formatversion='2')
    return get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(p))


def strip_html(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()


def commons_files(titles, mx_set):
    out = []
    for i in range(0, len(titles), 40):
        d = commons_api(action='query', titles='|'.join(titles[i:i + 40]), prop='imageinfo|categories', cllimit='max',
                        iiprop='url|extmetadata|size|mime', iiurlwidth='640')
        for pg in d.get('query', {}).get('pages', []):
            ii = (pg.get('imageinfo') or [{}])[0]
            if ii.get('mime') not in ('image/jpeg', 'image/png', 'image/webp'): continue
            md = ii.get('extmetadata', {})
            lic = strip_html(md.get('LicenseShortName', {}).get('value', ''))
            if not re.match(r'(CC0|CC BY(-SA)? \d|Public domain|PD)', lic, re.I): continue
            cats = [c['title'] for c in pg.get('categories', [])]
            full = ii['thumburl'].replace('/640px-', '/1600px-') if ii.get('width', 0) > 1600 else ii['url']
            out.append({'src': 'commons', 'title': pg['title'][5:], 'thumb': ii['thumburl'], 'full': full,
                        'w': ii.get('width'), 'h': ii.get('height'),
                        'author': strip_html(md.get('Artist', {}).get('value', ''))[:80] or 'неизвестен',
                        'license': lic, 'licenseUrl': md.get('LicenseUrl', {}).get('value', ''),
                        'page': ii.get('descriptionurl'),
                        'mx': pg['title'] in mx_set or any('Pentax MX' in c and 'MX-1' not in c for c in cats),
                        'camera': strip_html(md.get('Model', {}).get('value', ''))})
    return out


def commons_category_files(cat, limit=60):
    d = commons_api(action='query', list='categorymembers', cmtitle=cat, cmtype='file', cmlimit=str(limit))
    return [m['title'] for m in d.get('query', {}).get('categorymembers', [])]


def ov_size(url, s):
    m = re.match(r'(https://live\.staticflickr\.com/\d+/\d+_[0-9a-f]+)(_[a-z])?\.jpg$', url)
    return m.group(1) + s + '.jpg' if m else url


def openverse(q, pat, mx_hint=False):
    url = 'https://api.openverse.org/v1/images/?' + urllib.parse.urlencode(
        {'q': q, 'license': ','.join(sorted(OK_OV)), 'page_size': 20, 'mature': 'false'})
    d = get(url); time.sleep(4)
    out = []
    for x in d.get('results', []):
        text = norm(x.get('title', '') + ' ' + ' '.join(t['name'] for t in x.get('tags') or []))
        if not re.search(pat, text): continue
        if BAD.search(x.get('title', '') or ''): continue
        if x.get('license') not in OK_OV: continue
        lic = {'by': 'CC BY', 'by-sa': 'CC BY-SA', 'cc0': 'CC0', 'pdm': 'Public domain'}[x['license']]
        if x.get('license_version') and x['license'] in ('by', 'by-sa'): lic += ' ' + x['license_version']
        u = x.get('url') or ''
        out.append({'src': x.get('source'), 'title': (x.get('title') or '')[:100], 'thumb': ov_size(u, '_z'), 'full': ov_size(u, '_b'),
                    'w': x.get('width'), 'h': x.get('height'), 'author': (x.get('creator') or 'неизвестен')[:80],
                    'license': lic, 'licenseUrl': x.get('license_url'), 'page': x.get('foreign_landing_url'),
                    'mx': 'pentaxmx' in text, 'tags': text[:400]})
    return out


def main():
    only = set(sys.argv[1:])
    res = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    mx_set = set(commons_category_files('Category:Taken with Pentax MX', 500))
    print('Commons, снято на Pentax MX:', len(mx_set))
    cats = {}
    for fid, (qs, pat) in FILMS.items():
        if only and fid not in only: continue
        if fid in res and not only: continue
        found, seen = [], set()
        # Commons: категории «Photographs taken on …»
        for q in qs:
            d = commons_api(action='query', list='search', srnamespace='14', srsearch=q, srlimit='10')
            for s in d.get('query', {}).get('search', []):
                t = s['title']
                if re.search(r'(taken (on|with)|photographs (on|with)|shot on)', t, re.I) and re.search(pat, norm(t)):
                    cats[t] = fid
                    titles = commons_category_files(t)
                    for p in commons_files(titles, mx_set):
                        if p['page'] not in seen: seen.add(p['page']); found.append(p)
        # Openverse: сначала с Pentax MX, потом без
        for q in [qs[0] + ' Pentax MX'] + qs:
            for p in openverse(q, pat, mx_hint=q.endswith('Pentax MX')):
                if p['page'] not in seen: seen.add(p['page']); found.append(p)
            if len(found) >= 25: break
        res[fid] = found
        print(f'{fid}: {len(found)} (MX: {sum(p["mx"] for p in found)})', flush=True)
        json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('категории Commons:', cats)


if __name__ == '__main__':
    main()
