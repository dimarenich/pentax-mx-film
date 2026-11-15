"""Отбирает из tools/photos_raw.json до 10 снимков на плёнку → tools/photos.json.

Правила: сначала снятые на Pentax MX, не больше 3 снимков одного автора, без упаковок и коробок.
Исключения после ручного просмотра — в tools/photos_exclude.txt (ссылка на страницу снимка, по одной в строке).
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
raw = json.load(open(os.path.join(HERE, 'photos_raw.json'), encoding='utf-8'))
ex_path = os.path.join(HERE, 'photos_exclude.txt')
exclude = set(l.strip() for l in open(ex_path, encoding='utf-8') if l.strip() and not l.startswith('#')) if os.path.exists(ex_path) else set()
BAD = re.compile(r'(\bbox\b|packag|canister|cartridge|\broll\b|rolls|unboxing|film stock|\bfilm\b\s*$|^lucky shd|^kodak portra 400$|camera)', re.I)
MAX, PER_AUTHOR = 10, 3

out = {}
for fid, L in raw.items():
    for p in L:
        if p['src'] != 'commons': p['mx'] = 'pentaxmx' in p.get('tags', '')
    L = [p for p in L if p['page'] not in exclude and not BAD.search(p.get('title') or '') and (p.get('w') or 999) >= 500]
    L.sort(key=lambda p: (not p['mx'], p['src'] != 'commons'))
    picked, per = [], {}
    for p in L:
        a = p['author'].lower()
        if per.get(a, 0) >= PER_AUTHOR: continue
        per[a] = per.get(a, 0) + 1; picked.append(p)
        if len(picked) >= MAX: break
    out[fid] = picked
json.dump(out, open(os.path.join(HERE, 'photos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = [len(v) for v in out.values()]
print('плёнок с фото:', sum(1 for x in n if x), 'из', len(n), '· снимков:', sum(n), '· на MX:', sum(p['mx'] for v in out.values() for p in v))
print('без фото:', ', '.join(k for k, v in out.items() if not v))
print('меньше 3:', ', '.join(f'{k}({len(v)})' for k, v in out.items() if 0 < len(v) < 3))
