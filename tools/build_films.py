"""Встраивает «Справочник плёнок» из таблицы «Архив фотоплёнок.ods» в index.html.

Запуск из папки репозитория:
    python3 tools/build_films.py "../Архив фотоплёнок.ods"
Повторный запуск обновляет данные (цены и плёнки) — блок между маркерами FILMDB заменяется целиком.
"""
import json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ODS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'Архив фотоплёнок.ods')
INDEX = os.path.join(ROOT, 'index.html')

# Адреса проверены на сайтах магазинов 15.11.2026
SHOPS = [
    {'name': 'Filmly Lab', 'city': 'Москва и Санкт‑Петербург', 'site': 'filmlylab.ru', 'url': 'https://filmlylab.ru/',
     'hours': 'Каждый день 10:00–22:00', 'phone': '+7 (499) 938-81-08',
     'points': [['Артплей', 'Москва, ул. Нижняя Сыромятническая, 10 стр. 9, 4 этаж', 'м. Курская · вход Е (лестница) или С (лифт)'],
                ['Хлебозавод', 'Москва, ул. Новодмитровская, 1 стр. 7', 'м. Дмитровская · Хлебозавод №9'],
                ['Тверская', 'Москва, ул. Тверская, 12 стр. 8', 'м. Тверская'],
                ['БУМ', 'Москва, ул. Перерва, 43к1', 'м. Братиславская · ТЦ «БУМ»'],
                ['Речной', 'Москва, ул. Фестивальная, 2Б', 'м. Речной вокзал · ТЦ «Речной»'],
                ['Питер', 'Санкт‑Петербург, ул. Итальянская, 12Е', 'м. Гостиный двор']]},
    {'name': 'FOQUS', 'city': 'Санкт‑Петербург', 'site': 'foqus.film', 'url': 'https://foqus.film/contacts/',
     'hours': 'Ежедневно 12:00–21:00', 'phone': '+7 (812) 408-05-36',
     'points': [['Маяковская', 'Поварской пер., 10', ''],
                ['Невский', 'пер. Сергея Тюленина, 4/23', 'арка открыта, вход во дворе']]},
    {'name': 'Сканим.рф', 'city': 'Москва', 'site': 'сканим.рф', 'url': 'https://xn--80aqekdv.xn--p1ai/kontakty',
     'hours': 'Пн–Вс 11:00–21:00', 'phone': '8 (495) 971-971-2',
     'points': [['Таганская', 'ул. Таганская, 3, «Таганский Пассаж»', 'м. Таганская'],
                ['Коньково', 'ул. Профсоюзная, 118, ТЦ «Дропин»', 'м. Коньково']]},
]
LIGHT = {'Яркий день': 'sun', 'День и пасмурно': 'cloud', 'Универсальная': 'uni', 'Вечер и ночь': 'night', 'Лампы': 'lamp'}


TR = dict(zip('абвгдеёзийклмнопрстуфхъыьэ', ['a','b','v','g','d','e','e','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','','y','','e']))
TR.update({'ж': 'zh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ю': 'yu', 'я': 'ya'})


def translit(s):
    return ''.join(TR.get(c, c) for c in s)


def num(s):
    s = re.sub(r'[^\d.,]', '', s or '').replace(',', '')
    return int(float(s)) if s else None


def main():
    tmp = tempfile.mktemp(suffix='.json')
    subprocess.run([sys.executable, '-I', os.path.join(HERE, 'ods.py'), ODS, tmp], check=True, stdout=subprocess.DEVNULL)
    sheets = json.load(open(tmp, encoding='utf-8')); os.remove(tmp)

    F = sheets['Плёнки']; h = [c['v'] for c in F[0]]
    col = lambda r, name: (r[h.index(name)]['v'].strip() if len(r) > h.index(name) else '')
    films, ids, used = [], {}, set()
    for r in F[1:]:
        name = col(r, 'Плёнка')
        if not name: continue
        light = next((v for k, v in LIGHT.items() if k in col(r, 'Свет / время')), 'uni')
        fid = re.sub(r'[^a-z0-9]+', '-', translit(name.lower())).strip('-') or str(len(films))
        while fid in used: fid += '-2'
        used.add(fid)
        ids[name] = len(films)
        films.append({'id': fid, 'name': name, 'type': col(r, 'Тип'), 'iso': num(col(r, 'ISO')) or 0, 'light': light,
                      'subjects': [s.strip() for s in col(r, 'Сюжеты').split(',') if s.strip()],
                      'purpose': col(r, 'Для чего'), 'look': col(r, 'Характер картинки'),
                      'formats': [x.strip() for x in col(r, 'Форматы').split('·') if x.strip()],
                      'grain': col(r, 'Зерно'), 'contrast': col(r, 'Контраст'), 'dev': col(r, 'Проявка'),
                      'note': col(r, 'Примечание'), 'prices': []})
    P = sheets['Цены']; ph = [c['v'] for c in P[0]]
    pc = lambda r, name: (r[ph.index(name)]['v'].strip() if len(r) > ph.index(name) else '')
    dates, missing = set(), set()
    for r in P[1:]:
        name = pc(r, 'Плёнка')
        if not name: continue
        if name not in ids: missing.add(name); continue
        cell = r[ph.index('Ссылка')] if len(r) > ph.index('Ссылка') else {'v': '', 'l': []}
        url = (cell['l'][0] if cell['l'] else cell['v']).strip()
        if not url.startswith('http'): url = ''
        films[ids[name]]['prices'].append({'fmt': pc(r, 'Формат'), 'shop': pc(r, 'Магазин'), 'price': num(pc(r, 'Цена, ₽')),
                                           'frames': num(pc(r, 'Кадров')), 'perFrame': num(pc(r, '₽ за кадр')), 'url': url,
                                           'note': pc(r, 'Примечание')})
        if pc(r, 'Цена на дату'): dates.add(pc(r, 'Цена на дату'))
    for f in films:
        f['prices'] = [p for p in f['prices'] if p['price']]
    ph_path = os.path.join(HERE, 'photos.json')
    photos = json.load(open(ph_path, encoding='utf-8')) if os.path.exists(ph_path) else {}
    keep = ('thumb', 'full', 'author', 'license', 'licenseUrl', 'page', 'mx', 'title')
    for f in films:
        L = [p for p in photos.get(f['id'], []) if p.get('local') and os.path.exists(os.path.join(ROOT, p['local'] + '.jpg'))]
        for p in L:  # показываем копии из папки photos/ сайта, ссылки ведут на оригиналы авторов
            p['thumb'], p['full'] = p['local'] + '-t.jpg', p['local'] + '.jpg'
        f['photos'] = [{k: p[k] for k in keep if p.get(k) not in (None, '')} for p in L]
        for p in f['photos']:
            if 'title' in p: p['title'] = re.sub(r'\.(jpe?g|png|webp|tiff?)$', '', p['title'], flags=re.I).strip() or None
            if not p.get('title'): p.pop('title', None)
    # Снимки по темам быстрого выбора — отдельный файл, страница грузит его, только когда тема выбрана
    th_path = os.path.join(HERE, 'theme_photos.json')
    if os.path.exists(th_path):
        themes = {}
        for fid, by in json.load(open(th_path, encoding='utf-8')).items():
            for tid, L in by.items():
                L = [p for p in L if p.get('local') and os.path.exists(os.path.join(ROOT, p['local'] + '.jpg')) and os.path.exists(os.path.join(ROOT, p['local'] + '-t.jpg'))]
                if L:
                    themes.setdefault(tid, {})[fid] = [dict({k: p[k] for k in keep if p.get(k) not in (None, '')},
                                                            thumb=p['local'] + '-t.jpg', full=p['local'] + '.jpg') for p in L]
        json.dump(themes, open(os.path.join(ROOT, 'photos', 'themes.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('снимки по темам:', {t: sum(len(v) for v in d.values()) for t, d in themes.items()})
    subjects = [r[0]['v'] for r in sheets['Списки'][1:] if r and r[0]['v']]
    d = max(dates) if dates else ''
    data = {'films': films, 'shops': SHOPS, 'subjects': subjects,
            'priceDate': '.'.join(reversed(d.split('-'))) if d else '', 'shopsChecked': '15.11.2026'}

    esc = lambda s: s.replace('</', '<\\/')
    block = ('<!--FILMDB:START-->\n<style id="fdb-css">\n' + open(os.path.join(HERE, 'films.css'), encoding='utf-8').read() + '</style>\n'
             '<script type="application/json" id="films-data">' + esc(json.dumps(data, ensure_ascii=False)) + '</script>\n'
             '<script>\n' + esc(open(os.path.join(HERE, 'films.js'), encoding='utf-8').read()) + '</script>\n<!--FILMDB:END-->\n')
    html = open(INDEX, encoding='utf-8').read()
    if '<!--FILMDB:START-->' in html:
        html = re.sub(r'<!--FILMDB:START-->.*?<!--FILMDB:END-->\n', lambda m: block, html, flags=re.S)
    else:
        anchor = "<script>\n(function () {\n  var MODS = JSON.parse"
        assert html.count(anchor) == 1
        html = html.replace(anchor, block + anchor)
    html = patch_app(html)
    html = patch_v2(html)
    open(INDEX, 'w', encoding='utf-8').write(html)
    print(len(films), 'плёнок,', sum(len(f['prices']) for f in films), 'цен, дата цен', data['priceDate'])
    if missing: print('В «Цены» есть плёнки, которых нет на листе «Плёнки»:', ', '.join(sorted(missing)))


def patch_app(html):
    """Одноразовые правки основного скрипта курса: пункт меню, маршрут #films, поиск."""
    if 'function renderFilms(' in html:
        return html
    R = [
        ("    navList.appendChild(box);\n  });\n",
         "    navList.appendChild(box);\n  });\n"
         "  (function () {\n"
         "    var box = document.createElement('div'); box.className = 'stage';\n"
         "    box.innerHTML = '<div class=\"stage-h\">Справочник</div><a class=\"nav-item\" href=\"#films\" data-id=\"films\"><span class=\"nav-num\">◎</span><span>Плёнки, цены и магазины</span><span></span></a>';\n"
         "    navList.appendChild(box);\n"
         "  })();\n"),
        ("    try { FIGS.mount(m.num, content); } catch (e) { console.error(e); }\n",
         "    try { FIGS.mount(m.num, content); } catch (e) { console.error(e); }\n"
         "    try { FILMDB.callout(m.num, content); } catch (e) { console.error(e); }\n"),
        ("  function route() {\n    var id = (location.hash || '').slice(1);\n    if (!/^m\\d\\d$/.test(id)) id = 'm00';\n    render(id);\n  }\n",
         "  function renderFilms() {\n"
         "    var content = document.getElementById('content');\n"
         "    FILMDB.render(content);\n"
         "    document.getElementById('rebate').textContent = ('FILM ARCHIVE  ▸ ' + FILMDB.count + ' ROLLS  ▸ 135 / 120     ').repeat(4);\n"
         "    document.getElementById('topTitle').textContent = 'Справочник плёнок';\n"
         "    document.title = 'Справочник плёнок — Курс плёночной фотографии';\n"
         "    document.querySelectorAll('.nav-item').forEach(function (a) { a.classList.toggle('active', a.dataset.id === 'films'); });\n"
         "    var footer = document.getElementById('footer');\n"
         "    footer.innerHTML = '<div class=\"pn\"><a href=\"#m05\"><small>← Теория</small><span>05. Плёнка: как устроена и какую выбрать</span></a><a class=\"next\" href=\"#m00\"><small>Курс →</small><span>Оглавление и как учиться</span></a></div>';\n"
         "    window.scrollTo(0, 0);\n"
         "    closeNav();\n"
         "  }\n"
         "  function route() {\n    var id = (location.hash || '').slice(1);\n    if (id === 'films') { renderFilms(); return; }\n    if (!/^m\\d\\d$/.test(id)) id = 'm00';\n    render(id);\n  }\n"),
        ("      var ok = !q || (m.title + ' ' + m.md).toLowerCase().indexOf(q) !== -1;\n",
         "      var ok = !q || (m ? (m.title + ' ' + m.md).toLowerCase() : FILMDB.searchText).indexOf(q) !== -1;\n"),
        ("    render(/^m\\d\\d$/.test(cur) ? cur : 'm00', true);\n",
         "    if (cur === 'films') return;\n    render(/^m\\d\\d$/.test(cur) ? cur : 'm00', true);\n"),
    ]
    for a, b in R:
        assert html.count(a) == 1, 'не найден фрагмент: ' + a[:60]
        html = html.replace(a, b)
    return html


def patch_v2(html):
    """v2: маршруты #film-<id> и #compare-<id>+<id>, заголовок страницы от справочника."""
    if 'function renderFilms(hash)' in html:
        return html
    R = [
        ("  function renderFilms() {\n", "  function renderFilms(hash) {\n"),
        ("    FILMDB.render(content);\n", "    var t = FILMDB.render(content, hash);\n"),
        ("    document.getElementById('topTitle').textContent = 'Справочник плёнок';\n    document.title = 'Справочник плёнок — Курс плёночной фотографии';\n",
         "    document.getElementById('topTitle').textContent = t;\n    document.title = t + ' — Курс плёночной фотографии';\n"),
        ("    if (id === 'films') { renderFilms(); return; }\n",
         "    if (id === 'films' || /^film-|^compare-/.test(id)) { renderFilms(id); return; }\n"),
        ("    if (cur === 'films') return;\n", "    if (/^films$|^film-|^compare-/.test(cur)) return;\n"),
    ]
    for a, b in R:
        assert html.count(a) == 1, 'не найден фрагмент: ' + a[:60]
        html = html.replace(a, b)
    return html


if __name__ == '__main__':
    main()
