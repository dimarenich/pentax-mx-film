"""Скачивает отобранные примеры снимков (tools/photos.json) в папку photos/ сайта.

Каждый снимок хранится в двух размерах: photos/<плёнка>/<id>.jpg — для просмотра, до 2560 px (файл меньше
этого размера копируется без пересжатия, чтобы было видно зерно; с Commons берётся копия 1920 px) и <id>-t.jpg — миниатюра 480 px для сетки.
Уже скачанные файлы не перекачиваются: история сохраняется, даже если автор удалит оригинал.
Скачивает и общую подборку (tools/photos.json), и снимки по темам быстрого выбора (tools/theme_photos.json).
Запуск из папки репозитория:  python3 tools/fetch_photos.py <временная папка для загрузок>
Нужен macOS (sips) для уменьшения.
"""
import hashlib, json, shutil, os, re, subprocess, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DL = sys.argv[1]
UA = 'film-course-site/1.0 (static site build script)'
BIG, BIG_Q, THUMB, THUMB_Q = 2560, 92, 480, 75
THEME_BIG = 1600  # снимки по темам: их больше, поэтому чуть меньше по размеру, чтобы сайт уложился в 1 ГБ GitHub Pages
PH = os.path.join(HERE, 'photos.json')


def pid(p):
    return hashlib.sha1(p['page'].encode()).hexdigest()[:10]


def source_url(p):
    """Commons: копия 1920 px (стандартный размер, Commons отдаёт её без ограничений); если снимок уже, — оригинал."""
    m = re.search(r'/thumb/(\w/\w\w/([^/]+))/', p['thumb'])
    if not m: return p['full']
    if (p.get('w') or 0) > 1920:
        name = m.group(2) + ('.jpg' if m.group(2).lower().endswith(('.tif', '.tiff')) else '')
        return 'https://upload.wikimedia.org/wikipedia/commons/thumb/%s/1920px-%s' % (m.group(1), name)
    return 'https://upload.wikimedia.org/wikipedia/commons/' + m.group(1)


def fallback_url(p):
    m = re.search(r'/thumb/(\w/\w\w/([^/]+))/', p['thumb'])
    size = next((x for x in (1280, 960, 500) if x < (p.get('w') or 0)), None)
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/%s/%dpx-%s' % (m.group(1), size, m.group(2)) if m and size else None


def fetch(url, path, retries=5):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=90) as r, open(path, 'wb') as f:
                f.write(r.read())
            return
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == retries - 1: raise
            time.sleep(60 * (attempt + 1))  # Wikimedia просит не спешить


def dims(path):
    out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'format', path], capture_output=True, text=True).stdout
    g = lambda k: re.search(k + r':\s*(\S+)', out).group(1)
    return int(g('pixelWidth')), int(g('pixelHeight')), g('format')


def resize(src, dst, size, q):
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', str(q), '-Z', str(size), src, '--out', dst],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def items(data):
    """photos.json: {плёнка: [снимки]}; theme_photos.json: {плёнка: {тема: [снимки]}}."""
    for fid, v in data.items():
        for L in (v.values() if isinstance(v, dict) else [v]):
            for p in L:
                yield fid, p


def main():
    os.makedirs(DL, exist_ok=True)
    ok = fail = skip = 0
    for path in (PH, os.path.join(HERE, 'theme_photos.json')):
        if not os.path.exists(path): continue
        data = json.load(open(path, encoding='utf-8'))
        ok, fail, skip = run(data, path, ok, fail, skip, BIG if path == PH else THEME_BIG)
    print('скачано', ok, '· уже были', skip, '· ошибок', fail)


def run(data, path, ok, fail, skip, big_max):
    n = 0
    for fid, p in items(data):
        if True:
            i = pid(p)
            rel = 'photos/%s/%s' % (fid, i)
            big, small = os.path.join(ROOT, rel + '.jpg'), os.path.join(ROOT, rel + '-t.jpg')
            p['id'] = i
            if os.path.exists(big) and os.path.exists(small):
                p['local'] = rel; skip += 1; continue
            os.makedirs(os.path.dirname(big), exist_ok=True)
            tmp = os.path.join(DL, i + '.img')
            try:
                try:
                    fetch(source_url(p), tmp, retries=1 if '/thumb/' not in source_url(p) and 'wikimedia' in source_url(p) else 5)
                except urllib.error.HTTPError as e:
                    fb = fallback_url(p)
                    if e.code != 429 or not fb: raise
                    fetch(fb, tmp)  # Commons не отдаёт оригинал — берём ближайшую стандартную копию
                w, h, fmt = dims(tmp)
                if max(w, h) <= big_max and fmt == 'jpeg':
                    shutil.copyfile(tmp, big)  # без пересжатия
                else:
                    resize(tmp, big, big_max, BIG_Q if big_max == BIG else 88)
                resize(big, small, THUMB, THUMB_Q)
                p['local'] = rel; ok += 1
            except Exception as e:
                fail += 1; p.pop('local', None)
                print('  ! не скачался', fid, p['page'], e, file=sys.stderr)
            finally:
                if os.path.exists(tmp): os.remove(tmp)
            time.sleep(4 if 'wikimedia' in source_url(p) and '/thumb/' not in source_url(p) else 0.7)
            n += 1
            if n % 20 == 0: json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return ok, fail, skip


if __name__ == '__main__':
    main()
