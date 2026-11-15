import json, sys, zipfile, xml.etree.ElementTree as ET
NS = {'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0', 'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
      'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'xlink': 'http://www.w3.org/1999/xlink'}
T = lambda t: '{%s}%s' % (NS[t.split(':')[0]], t.split(':')[1])
def cell_text(c):
    parts, links = [], []
    for p in c.iter(T('text:p')):
        s = ''.join(p.itertext()); parts.append(s)
        for a in p.iter(T('text:a')): links.append(a.get(T('xlink:href')))
    v = '\n'.join(parts).strip()
    num = c.get(T('office:value'))
    return v, links, num
root = ET.fromstring(zipfile.ZipFile(sys.argv[1]).read('content.xml'))
out = {}
for sh in root.iter(T('table:table')):
    rows = []
    for r in sh.iter(T('table:table-row')):
        rr = int(r.get(T('table:number-rows-repeated'), 1)); row = []
        for c in r:
            if c.tag not in (T('table:table-cell'), T('table:covered-table-cell')): continue
            n = int(c.get(T('table:number-columns-repeated'), 1)); v, l, num = cell_text(c)
            row.extend([{'v': v, 'l': l, 'n': num}] * min(n, 60))
        while row and not row[-1]['v']: row.pop()
        if row: rows.extend([row] * min(rr, 1))
    out[sh.get(T('table:name'))] = rows
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
for k, v in out.items(): print(k, len(v), 'rows, max cols', max((len(r) for r in v), default=0))
