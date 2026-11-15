"""Ищет снимки на каждую плёнку по темам быстрого выбора (стрит, портрет, туман…) под свободными лицензиями.

До 3 снимков на плёнку и тему; потом tools/fetch_photos.py скачивает их на сайт, как и общую подборку.
На странице плёнки они показываются, когда посетитель выбрал тему в «Быстром выборе».
Источники: поиск по Wikimedia Commons (плёнка + слова темы) и кандидаты Flickr из tools/photos_raw.json (по тегам).
Запуск из папки репозитория:  python3 tools/find_theme_photos.py  →  tools/theme_photos.json
"""
import json, os, re, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import find_photos as FP  # FILMS, commons_api, strip_html, ov_size, norm, BAD

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'theme_photos.json')
CACHE_PATH = os.path.join(HERE, 'theme_cache.json')  # ответы Commons: правила можно менять без новых запросов
CACHE = json.load(open(CACHE_PATH, encoding='utf-8')) if os.path.exists(CACHE_PATH) else {}
EXCL = os.path.join(HERE, 'photos_exclude.txt')
MAX, PER_AUTHOR = 3, 2

PEOPLE = r'(?<!self-)\bportraits?\b(?! orientation| format| mode)|selfie|headshot|porträt|retrato|портрет'
INDOOR = r'indoor|interior|studio|at home|room|window light|cafe|café|kitchen|bedroom|\bbar\b|restaurant|inside|innen|intérieur|в помещении'
THEMES = {
    # id: (название пресета, слова для поиска на Commons, шаблон темы, шаблон-исключение)
    'portrait-out': ('Портрет на улице', 'portrait OR people OR woman OR girl', PEOPLE, INDOOR),
    'portrait-in': ('Портрет в помещении', 'portrait indoor OR interior OR studio OR home', '(' + PEOPLE + ').*(' + INDOOR + ')|(' + INDOOR + ').*(' + PEOPLE + ')', None),
    'sun': ('Яркое солнце', 'sunny OR sunlight OR summer OR beach', r'sunny|sunlight|sunshine|summer|beach|golden hour|sonne|soleil|playa|strand|солнце', None),
    'fog': ('Пасмурно и туман', 'fog OR mist OR overcast OR rain OR nebel', r'\bfog|foggy|\bmist|misty|overcast|cloudy|\brain\b|rainy|haze|nebel|brouillard|niebla|туман|пасмур', None),
    'night': ('Вечер и ночь', 'night OR evening OR dusk OR neon', r'night|nacht|noche|\bnuit|evening|dusk|neon|twilight|blue hour|ночь|ночн|вечер', None),
    'street': ('Стрит', 'street OR urban OR city', r'street|straße|strasse|\brue\b|calle|urban|downtown|city|market|улиц|город', None),
    'landscape': ('Пейзаж', 'landscape OR mountain OR lake OR forest', r'landscape|mountain|\blake\b|forest|valley|\bhills?\b|coast|seascape|countryside|landschaft|paysage|пейзаж|горы|озеро|лес', None),
    'travel': ('Путешествия', 'travel OR trip OR vacation OR holiday', r'travel|\btrip\b|vacation|holiday|journey|touris|reise|voyage|viaje|путешеств', None),
    'cine': ('Кино‑эстетика', 'cinematic OR cinema OR movie OR neon', r'cinematic|cinema|movie|film noir|moody|neon|cinestill|anamorphic|кино', None),
}


BRAND = re.compile(r'^(Kodak|Fujifilm|Fuji|Ilford|Lomography|ORWO|Wolfen|Agfa|AGFA|HARMAN|Harman|CineStill|Lucky|Eastman)\s+')


DISTINCT = re.compile(r'(Portra|Ektar|Tri-X|T-Max|TMax|HP5|FP4|XP2|Ektachrome|Velvia|Provia|ColorPlus|UltraMax|Vision[23]|Eterna|Superia|APX|Aviphot|Pan F|SFX|LomoChrome|Redscale|Fomapan|Kentmere)', re.I)
PACK = re.compile(r'(\b(120|135|35 ?mm) film\b|film$|\bbox\b|packag|canister|cartridge|\broll\b|rolls|expired)', re.I)


def words(s):
    return ' ' + re.sub(r'[^0-9a-zа-яё]+', ' ', (s or '').lower()) + ' '


def mentions(text, qs):
    """Название плёнки встречается в описании как отдельные слова («portra 400», «tri x 400»)."""
    t = words(text)
    return any(words(ph) in t or words(ph).replace(' ', '') in t.replace(' ', '') and len(words(ph).strip()) > 6 for ph in phrases(qs))


def phrases(qs):
    """Полное название и короткое без марки («Kodak Portra 400» → «Portra 400»), если в остатке есть буквы."""
    out = []
    for q in qs[:2]:
        out.append(q)
        short = BRAND.sub('', q)
        if short != q and DISTINCT.search(short): out.append(short)  # без марки — только узнаваемые названия
    return list(dict.fromkeys(out))


def theme_ok(text, tid):
    _, _, pat, neg = THEMES[tid]
    t = text.lower()
    return re.search(pat, t) and not (neg and re.search(neg, t))


def commons_search(q, limit=50):
    d = FP.commons_api(action='query', list='search', srnamespace='6', srlimit=str(limit), srsearch=q)
    time.sleep(1)
    return [x['title'] for x in d.get('query', {}).get('search', [])]


INFO = {}  # кэш: один и тот же файл находится по нескольким темам


def commons_info(titles):
    out = [INFO[t] for t in titles if t in INFO]
    todo = [t for t in titles if t not in INFO]
    for i in range(0, len(todo), 50):
        d = FP.commons_api(action='query', titles='|'.join(todo[i:i + 50]), prop='imageinfo|categories', cllimit='max',
                           iiprop='url|extmetadata|size|mime', iiurlwidth='500',
                           iiextmetadatafilter='ImageDescription|LicenseShortName|LicenseUrl|Artist')
        time.sleep(1)
        for pg in d.get('query', {}).get('pages', []):
            ii = (pg.get('imageinfo') or [{}])[0]
            if ii.get('mime') not in ('image/jpeg', 'image/png', 'image/webp'): continue
            md = ii.get('extmetadata', {})
            lic = FP.strip_html(md.get('LicenseShortName', {}).get('value', ''))
            if not re.match(r'(CC0|CC BY(-SA)? \d|Public domain|PD)', lic, re.I): continue
            cats = ' '.join(c['title'] for c in pg.get('categories', []))
            text = pg['title'] + ' ' + FP.strip_html(md.get('ImageDescription', {}).get('value', ''))[:1500] + ' ' + cats
            m = re.search(r'/thumb/(\w/\w\w/([^/]+))/', ii.get('thumburl', ''))
            w = ii.get('width') or 0
            if m:
                full = 'https://upload.wikimedia.org/wikipedia/commons/thumb/%s/%dpx-%s' % (m.group(1), 1920 if w > 1920 else 1280 if w > 1280 else 960, m.group(2))
                if w <= 960: full = ii['url']
            else:
                full = ii['url']
            INFO[pg['title']] = item = ({'src': 'commons', 'w': w, 'h': ii.get('height'), 'title': re.sub(r'\.(jpe?g|png|webp)$', '', pg['title'][5:], flags=re.I), 'thumb': ii.get('thumburl') or ii['url'], 'full': full,
                        'author': FP.strip_html(md.get('Artist', {}).get('value', ''))[:80] or 'неизвестен', 'license': lic,
                        'licenseUrl': md.get('LicenseUrl', {}).get('value', ''), 'page': ii.get('descriptionurl'),
                        'mx': 'Pentax MX' in cats and 'MX-1' not in cats, 'text': text})
            out.append(item)
    return out


def collect(fid, qs, pat, raw, exclude):
    """Один широкий поиск по названию плёнки на Commons, дальше снимки раскладываются по темам по тексту описания и категориям."""
    pool = [p for p in raw.get(fid, []) if p['src'] != 'commons' and p.get('tags')]
    for p in pool: p['mx'] = 'pentaxmx' in p['tags']
    if fid in CACHE:
        found = CACHE[fid]
    else:
        titles = []
        for ph in phrases(qs):
            titles += commons_search('"%s"' % ph, limit=300)
        titles = list(dict.fromkeys(titles))
        found = CACHE[fid] = commons_info(titles)
        json.dump(CACHE, open(CACHE_PATH, 'w', encoding='utf-8'), ensure_ascii=False)
    films = [p for p in found if mentions(p['text'], qs) and not PACK.search(p['title'])]
    by_theme = {}
    for tid in THEMES:
        cands = [p for p in films if theme_ok(p['text'], tid)] + [p for p in pool if theme_ok(p['title'] + ' ' + p['tags'], tid)]
        seen, per, picked = set(), {}, []
        for p in sorted(cands, key=lambda p: not p['mx']):
            if p['page'] in seen or p['page'] in exclude or FP.BAD.search(p['title'] or '') or PACK.search(p['title'] or ''): continue
            a = p['author'].lower()
            if per.get(a, 0) >= PER_AUTHOR: continue
            seen.add(p['page']); per[a] = per.get(a, 0) + 1
            picked.append({k: p[k] for k in ('src', 'w', 'h', 'thumb', 'full', 'author', 'license', 'licenseUrl', 'page', 'mx', 'title') if p.get(k) not in (None, '')})
            if len(picked) >= MAX: break
        by_theme[tid] = picked
    return fid, by_theme


def main():
    raw = json.load(open(os.path.join(HERE, 'photos_raw.json'), encoding='utf-8'))
    exclude = set(l.strip() for l in open(EXCL, encoding='utf-8') if l.strip() and not l.startswith('#')) if os.path.exists(EXCL) else set()
    res = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    only = set(sys.argv[1:])
    todo = [(fid, qs, pat) for fid, (qs, pat) in FP.FILMS.items() if (fid in only) or (not only and fid not in res)]
    for t in todo:  # по одному запросу за раз: Commons просит не нагружать его параллельными запросами
        if True:
            fid, by_theme = collect(t[0], t[1], t[2], raw, exclude)
            res[fid] = by_theme
            print(fid, {t: len(v) for t, v in by_theme.items() if v}, flush=True)
            json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
