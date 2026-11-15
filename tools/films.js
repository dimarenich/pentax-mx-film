/* ===== Справочник плёнок: подбор, карточки, таблица, сравнение, ссылки, подсказки для Pentax MX ===== */
var FILMDB = (function () {
  'use strict';
  var D = JSON.parse(document.getElementById('films-data').textContent);
  var FILMS = D.films, SHOPS = D.shops;
  var byId = {}; FILMS.forEach(function (f) { byId[f.id] = f; });

  var LIGHT = [
    ['sun', 'Яркий день', 'ISO 50–200'], ['cloud', 'День и пасмурно', ''], ['uni', 'Универсальная', 'ISO 400'],
    ['night', 'Вечер и ночь', 'ISO 800+'], ['lamp', 'Лампы (тунгстен)', 'неон, интерьер']
  ];
  var ICON = {
    sun: '<circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g>',
    cloud: '<circle cx="8" cy="9" r="4" fill="currentColor" opacity=".55"/><path d="M6 19h11a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.6A3.3 3.3 0 0 0 6 19z" fill="currentColor"/>',
    uni: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    night: '<path d="M15 3a8.5 8.5 0 1 0 6 13.5A7 7 0 0 1 15 3z" fill="currentColor"/>',
    lamp: '<path d="M12 2a6 6 0 0 0-3.5 10.9V16h7v-3.1A6 6 0 0 0 12 2z" fill="currentColor"/><path d="M9 18h6M10 21h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  function icon(k) { return '<svg class="fdb-ico" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[k] || '') + '</svg>'; }
  var TYPES = ['Цветной негатив', 'Ч/б негатив', 'Кинонегатив', 'Слайд (позитив)', 'Креатив / эффект', 'Ч/б хромоген'];
  var TYPE_CLS = { 'Цветной негатив': 't-color', 'Ч/б негатив': 't-bw', 'Кинонегатив': 't-cine', 'Слайд (позитив)': 't-slide', 'Креатив / эффект': 't-art', 'Ч/б хромоген': 't-xp' };
  var GRAIN = ['Очень мелкое', 'Мелкое', 'Среднее', 'Заметное', 'Крупное'];
  var CONTRAST = ['Низкий', 'Средний', 'Высокий', 'Очень высокий'];
  var DEV = ['C-41', 'Ч/б (D-76 и др.)', 'ECN-2 / C-41', 'E-6'];
  var SUBJECTS = D.subjects;

  var PRESETS = [
    ['Портрет на улице', { subject: 'Портрет на улице' }],
    ['Портрет в помещении', { subject: 'Портрет в помещении' }],
    ['Яркое солнце', { light: ['sun'] }],
    ['Пасмурно и туман', { light: ['cloud', 'uni'] }],
    ['Вечер и ночь', { light: ['night', 'lamp'] }],
    ['Стрит', { subject: 'Стрит' }],
    ['Пейзаж', { subject: 'Пейзаж и природа' }],
    ['Путешествия', { subject: 'Путешествия' }],
    ['Классическая ч/б', { type: ['Ч/б негатив', 'Ч/б хромоген'] }],
    ['Кино‑эстетика', { subject: 'Кино-эстетика' }],
    ['До 1 000 ₽', { max: 1000, sort: 'price' }]
  ];
  var BUDGET = [600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 99999];
  var MAXCMP = 3;

  function fresh() { return { subject: '', light: [], type: [], grain: [], contrast: [], dev: [], fmt: '135', max: 99999, q: '', sort: 'price', dir: 1, view: 'cards', preset: -1 }; }
  var st = fresh();
  var cmp = [];
  try { cmp = (JSON.parse(localStorage.getItem('fdb-compare') || '[]') || []).filter(function (id) { return byId[id]; }).slice(0, MAXCMP); } catch (e) { cmp = []; }
  function saveCmp() { try { localStorage.setItem('fdb-compare', JSON.stringify(cmp)); } catch (e) {} }

  function plural(n, one, few, many) { var m10 = n % 10, m100 = n % 100; return n + ' ' + (m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rub(n) { return n == null ? '—' : n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽'; }
  function minPrice(f, fmt) {
    var p = f.prices.filter(function (x) { return !fmt || x.fmt === fmt; });
    return p.length ? p.reduce(function (a, b) { return b.price < a.price ? b : a; }) : null;
  }
  function priceFor(f) { return st.fmt === 'any' ? minPrice(f) : minPrice(f, st.fmt); }
  function lightLabel(k) { var l = LIGHT.filter(function (x) { return x[0] === k; })[0]; return l ? l[1] : ''; }
  function pageUrl(hash) { return location.origin + location.pathname + '#' + hash; }

  /* ---------- Как снимать на Pentax MX ---------- */
  var MX_T = [1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
  var MX_A = [1.7, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
  var DIAL = [25, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600];
  var SCEN = {
    sun: [['Яркое солнце', 15], ['Пасмурно', 13], ['Тень, облачно', 12]],
    cloud: [['Пасмурно, туман', 13], ['Тень, сильная облачность', 12], ['Светлая комната у окна', 9]],
    uni: [['Яркое солнце', 15], ['Пасмурно, туман', 13], ['Помещение днём', 8]],
    night: [['Сумерки', 10], ['Освещённая улица ночью', 7], ['Помещение с лампами', 6]],
    lamp: [['Витрины и неон', 8], ['Помещение с лампами', 7], ['Ночная улица', 6]]
  };
  function fT(t) { return t >= 1 ? '1 с' : '1/' + Math.round(1 / t); }
  function fA(a) { return 'f/' + String(a).replace('.', ','); }
  function dial(iso) { return DIAL.reduce(function (b, x) { return Math.abs(Math.log(x / iso)) < Math.abs(Math.log(b / iso)) ? x : b; }, 400); }
  function nearestT(t) { var best = MX_T[0]; MX_T.forEach(function (x) { if (Math.abs(Math.log2(x / t)) < Math.abs(Math.log2(best / t))) best = x; }); return best; }
  function pair(ev100, iso) {
    var ev = ev100 + Math.log2(iso / 100), order = [8, 5.6, 11, 4, 16, 2.8, 2, 1.7, 22];
    for (var i = 0; i < order.length; i++) {
      var a = order[i], t = a * a / Math.pow(2, ev), n = nearestT(t);
      if (Math.abs(Math.log2(n / t)) <= 0.5 && n <= 1 / 60) return { a: a, t: n };
    }
    var tMin = 22 * 22 / Math.pow(2, ev);
    if (tMin < 1 / 1000) return { a: 22, t: 1 / 1000, warn: 'слишком светло даже для f/22 · 1/1000 — нужен ND‑фильтр' };
    var tOpen = 1.7 * 1.7 / Math.pow(2, ev), n2 = nearestT(tOpen);
    return { a: 1.7, t: n2, warn: tOpen > 1.4 ? 'длиннее 1 с — штатив и выдержка B' : 'с рук не удержать — штатив или опора' };
  }
  function mxPlan(f) {
    if (f.formats.indexOf('135') === -1) return null;
    var iso = f.iso || 100, d = dial(iso), rows = (SCEN[f.light] || SCEN.uni).map(function (s) { var p = pair(s[1], d); return { name: s[0], ev: s[1], p: p }; });
    var tips = [];
    var isT = /\d+\s*T\b/.test(f.name);
    if (f.type === 'Цветной негатив' || f.type === 'Кинонегатив') tips.push('Негатив любит свет: при сомнении добавьте +½…+1 ступени (пусть горит верхний жёлтый светодиод) или выставьте на диске ISO ' + dial(d / 2) + ' вместо ' + d + '.');
    if (isT) tips.push('Буква T — баланс под лампы. Днём без фильтра 85 кадр уйдёт в синеву; с фильтром 85 ставьте на диске ISO ' + dial(d * 0.63) + '.');
    if (f.type === 'Слайд (позитив)') tips.push('Слайд не прощает передержку: точный замер, лучше −⅓ ступени. Меряйте по светлым деталям — пусть горит зелёный или нижний жёлтый.');
    if (f.type === 'Ч/б негатив') tips.push('Меряйте по теням с деталями: ч/б негатив вытянет передержку на 1–2 ступени, а недодержку — нет. Жёлтый или оранжевый фильтр сделает небо драматичнее, поправку MX учтёт сам.');
    if (f.type === 'Ч/б хромоген') tips.push('Очень широкая широта: на диске подойдёт и ISO 200, и 400. Проявка C‑41 в любой лаборатории.');
    if (f.type === 'Креатив / эффект') tips.push('Эффектные плёнки часто любят лишний свет: +½…+1 ступени. Снимайте вилкой по 2–3 кадра — результат непредсказуем.');
    if (f.type === 'Ч/б негатив' && iso >= 400 && iso <= 500) tips.push('В темноте можно пушить: на диске ISO ' + dial(iso * 4) + ', в лаборатории попросите push +2.');
    if (f.type === 'Цветной негатив' && iso >= 400 && iso <= 500) tips.push('Пуш на одну ступень допустим: ISO ' + dial(iso * 2) + ' на диске и push +1 в лаборатории.');
    if (f.light === 'night' || f.light === 'lamp') tips.push('Со вспышкой на MX — только 1/60 и длиннее (синхронизация затвора).');
    var s16 = iso > 1000 ? fA(22) + ' · ' + fT(nearestT(2 / iso)) : fA(16) + ' · ' + fT(nearestT(1 / iso));
    tips.push('Без батареек, «Солнечные 16»: на солнце ' + s16 + '.');
    return { dial: d, rows: rows, tips: tips, iso: iso };
  }
  function mxBlock(f) {
    var m = mxPlan(f);
    if (!m) return '<p class="fdb-warn">Только формат 120 — в Pentax MX не заряжается. Для MX нужна 135.</p>';
    return '<div class="fdb-mxplan"><div class="fdb-dial"><span>Диск ISO на MX</span><b>' + m.dial + '</b>' + (m.dial !== m.iso ? '<small>ближайшее деление к ' + m.iso + '</small>' : '') + '</div>' +
      '<table class="fdb-pairs"><tbody>' + m.rows.map(function (r) {
        return '<tr><td>' + esc(r.name) + '<small>EV ' + r.ev + '</small></td><td><b>' + fA(r.p.a) + ' · ' + fT(r.p.t) + '</b>' + (r.p.warn ? '<small class="fdb-w">' + esc(r.p.warn) + '</small>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<ul class="fdb-tips">' + m.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<p class="fdb-fine">Пары — ориентир для типичного света с объективом 50/1.7. В кадре доверяйте светодиодам MX: крутите второе кольцо до зелёного.</p>';
  }

  /* ---------- Подбор ---------- */
  function match(f) {
    if (st.fmt !== 'any' && f.formats.indexOf(st.fmt) === -1) return false;
    if (st.subject && f.subjects.indexOf(st.subject) === -1) return false;
    if (st.light.length && st.light.indexOf(f.light) === -1) return false;
    if (st.type.length && st.type.indexOf(f.type) === -1) return false;
    if (st.grain.length && st.grain.indexOf(f.grain) === -1) return false;
    if (st.contrast.length && st.contrast.indexOf(f.contrast) === -1) return false;
    if (st.dev.length && st.dev.indexOf(f.dev) === -1) return false;
    if (st.max < 99999) { var p = priceFor(f); if (!p || p.price > st.max) return false; }
    if (st.q) {
      var hay = (f.name + ' ' + f.look + ' ' + f.purpose + ' ' + f.subjects.join(' ') + ' ' + f.note + ' ' + f.type).toLowerCase();
      if (hay.indexOf(st.q.toLowerCase()) === -1) return false;
    }
    return true;
  }
  function sorted(list) {
    var key = {
      price: function (f) { var x = priceFor(f); return x ? x.price : null; },
      iso: function (f) { return f.iso || null; },
      grain: function (f) { var i = GRAIN.indexOf(f.grain); return i === -1 ? null : i; },
      contrast: function (f) { var i = CONTRAST.indexOf(f.contrast); return i === -1 ? null : i; }
    }[st.sort];
    var byName = function (a, b) { return a.name.localeCompare(b.name, 'ru'); };
    return list.slice().sort(function (a, b) {
      if (!key) return st.dir * byName(a, b);
      var x = key(a), y = key(b);
      if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1; /* без значения — всегда в конце */
      return st.dir * (x - y) || byName(a, b);
    });
  }

  function dots(val, scale, label) {
    var i = scale.indexOf(val), s = '';
    for (var k = 0; k < scale.length; k++) s += '<i class="' + (k <= i ? 'on' : '') + '"></i>';
    return '<span class="fdb-meter" title="' + label + ': ' + esc(val) + '"><span class="fdb-meter-l">' + label + '</span><span class="fdb-dots">' + s + '</span><span class="fdb-meter-v">' + esc(val.toLowerCase()) + '</span></span>';
  }

  function pricesTable(f) {
    var rows = f.prices.slice().sort(function (a, b) { return a.fmt === b.fmt ? a.price - b.price : a.fmt.localeCompare(b.fmt); });
    var best = {};
    rows.forEach(function (p) { if (!best[p.fmt] || p.price < best[p.fmt]) best[p.fmt] = p.price; });
    return '<div class="table-wrap fdb-prices"><table><thead><tr><th>Магазин</th><th>Формат</th><th>Цена</th><th>Кадров</th><th>₽/кадр</th><th></th></tr></thead><tbody>' +
      rows.map(function (p) {
        return '<tr' + (p.price === best[p.fmt] ? ' class="best"' : '') + '><td>' + esc(p.shop) + '</td><td>' + esc(p.fmt) + (p.fmt === '135' ? '' : ' <span class="fdb-no-mx">не для MX</span>') + '</td><td><b>' + rub(p.price) + '</b></td><td>' + (p.frames || '—') + '</td><td>' + (p.perFrame ? rub(p.perFrame) : '—') + '</td><td>' +
          (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">Купить ↗</a>' : '') + '</td></tr>' + (p.note ? '<tr class="fdb-pnote"><td colspan="6">' + esc(p.note) + '</td></tr>' : '');
      }).join('') + '</tbody></table></div>';
  }

  function cmpBtn(f) {
    var on = cmp.indexOf(f.id) !== -1, full = !on && cmp.length >= MAXCMP;
    return '<button type="button" class="fdb-act fdb-cmp-btn" data-cmp="' + f.id + '" aria-pressed="' + on + '"' + (full ? ' title="Можно сравнить не больше трёх плёнок"' : '') + '>' + (on ? '✓ В сравнении' : '+ Сравнить') + '</button>';
  }

  function card(f, o) {
    o = o || {};
    var p = priceFor(f) || minPrice(f);
    var mx = f.formats.indexOf('135') !== -1;
    return '<div class="fdb-card" id="fc-' + f.id + '">' +
      '<div class="fdb-can ' + (TYPE_CLS[f.type] || '') + '" aria-hidden="true"><span class="fdb-can-iso">' + f.iso + '</span><span class="fdb-can-t">ISO</span></div>' +
      '<div class="fdb-main">' +
      '<div class="fdb-head">' + (o.h1 ? '<h1 class="fdb-name fdb-name-big">' + esc(f.name) + '</h1>' : '<h3 class="fdb-name"><a href="#film-' + f.id + '">' + esc(f.name) + '</a></h3>') +
      '<div class="fdb-acts">' + cmpBtn(f) + '<button type="button" class="fdb-act" data-share="film-' + f.id + '">Ссылка</button></div></div>' +
      '<div class="fdb-tags"><span class="fdb-tag ' + (TYPE_CLS[f.type] || '') + '">' + esc(f.type) + '</span><span class="fdb-tag">' + icon(f.light) + esc(lightLabel(f.light)) + '</span><span class="fdb-tag">' + esc(f.dev) + '</span>' +
      f.formats.map(function (x) { return '<span class="fdb-tag ' + (x === '135' ? 'fdb-mx' : 'fdb-dim') + '">' + x + (x === '135' ? ' · MX' : '') + '</span>'; }).join('') + '</div>' +
      '<p class="fdb-look">' + esc(f.look) + '</p>' +
      '<p class="fdb-for"><span>Для чего:</span> ' + esc(f.purpose) + '</p>' +
      '<div class="fdb-meters">' + dots(f.grain, GRAIN, 'Зерно') + dots(f.contrast, CONTRAST, 'Контраст') + '</div>' +
      (f.note ? '<p class="fdb-note">' + esc(f.note) + '</p>' : '') +
      '<div class="fdb-buy">' + (p ? '<span class="fdb-from">от <b>' + rub(p.price) + '</b> · ' + esc(p.shop) + ' · ' + esc(p.fmt) + (p.perFrame ? ' · ' + rub(p.perFrame) + '/кадр' : '') + '</span>' : '<span class="fdb-from">нет в наличии</span>') +
      (!mx ? '<span class="fdb-warn">Только 120 — в Pentax MX не встанет</span>' : '') + '</div>' +
      photosBlock(f, o.open) +
      '<details class="fdb-det fdb-det-mx"' + (o.open ? ' open' : '') + '><summary>Как снимать на Pentax MX</summary>' + mxBlock(f) + '</details>' +
      '<details class="fdb-det"' + (o.open ? ' open' : '') + '><summary>Цены в магазинах (' + f.prices.length + ')</summary>' + pricesTable(f) +
      '<p class="fdb-subj"><span>Сюжеты:</span> ' + f.subjects.map(esc).join(' · ') + '</p></details>' +
      '<p class="fdb-shared" hidden></p>' +
      '</div></div>';
  }

  function tableView(list) {
    return '<div class="table-wrap"><table class="fdb-table"><thead><tr><th></th><th>Плёнка</th><th>ISO</th><th>от, 135</th><th>Тип</th><th>Свет</th><th>Зерно</th><th>Контраст</th><th>от, 120</th></tr></thead><tbody>' +
      list.map(function (f) {
        var a = minPrice(f, '135'), b = minPrice(f, '120'), on = cmp.indexOf(f.id) !== -1;
        return '<tr><td><button type="button" class="fdb-mini" data-cmp="' + f.id + '" aria-pressed="' + on + '" aria-label="Добавить в сравнение: ' + esc(f.name) + '">' + (on ? '✓' : '+') + '</button></td><td><a href="#film-' + f.id + '">' + esc(f.name) + '</a></td><td>' + f.iso + '</td><td class="fdb-tp">' + (a ? rub(a.price) + '<small>' + esc(a.shop) + '</small>' : '—') + '</td><td><span class="fdb-sw ' + (TYPE_CLS[f.type] || '') + '"></span>' + esc(f.type) + '</td><td title="' + esc(lightLabel(f.light)) + '">' + icon(f.light) + '</td><td>' + esc(f.grain) + '</td><td>' + esc(f.contrast) + '</td><td>' + (b ? rub(b.price) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function chips(name, opts, sel, labelFn, iconFn) {
    return '<div class="fdb-chips" data-k="' + name + '">' + opts.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, lab = labelFn ? labelFn(o) : v;
      return '<button type="button" class="fdb-chip" data-v="' + esc(v) + '" aria-pressed="' + (sel.indexOf(v) !== -1) + '">' + (iconFn ? iconFn(v) : '') + esc(lab) + '</button>';
    }).join('') + '</div>';
  }

  /* ---------- Панель сравнения ---------- */
  function cmpBar() {
    if (!cmp.length) return '';
    return '<div class="fdb-cmpbar" role="region" aria-label="Сравнение плёнок"><span class="fdb-cmpbar-n">Сравнение ' + cmp.length + '/' + MAXCMP + '</span>' +
      '<div class="fdb-cmpbar-list">' + cmp.map(function (id) { return '<span class="fdb-cmpchip">' + esc(byId[id].name) + '<button type="button" data-uncmp="' + id + '" aria-label="Убрать ' + esc(byId[id].name) + '">×</button></span>'; }).join('') + '</div>' +
      (cmp.length >= 2 ? '<a class="fdb-cmpgo" href="#compare-' + cmp.join('+') + '">Сравнить →</a>' : '<span class="fdb-cmphint">выберите ещё одну</span>') +
      '<button type="button" class="fdb-act" data-cmpclear="1">Очистить</button></div>';
  }
  function refreshCmp() {
    if (!root) return;
    var bar = root.querySelector('#fdbCmpBar'); if (bar) bar.innerHTML = cmpBar();
    root.querySelectorAll('[data-cmp]').forEach(function (b) {
      var on = cmp.indexOf(b.dataset.cmp) !== -1;
      b.setAttribute('aria-pressed', String(on));
      if (b.classList.contains('fdb-mini')) b.textContent = on ? '✓' : '+';
      else { b.textContent = on ? '✓ В сравнении' : '+ Сравнить'; b.title = !on && cmp.length >= MAXCMP ? 'Можно сравнить не больше трёх плёнок' : ''; }
    });
  }
  function toggleCmp(id, btn) {
    var i = cmp.indexOf(id);
    if (i !== -1) cmp.splice(i, 1);
    else if (cmp.length >= MAXCMP) { flash(btn, 'Не больше трёх — уберите одну внизу'); return; }
    else cmp.push(id);
    saveCmp(); refreshCmp();
  }
  function flash(btn, text) {
    var holder = btn && btn.closest('.fdb-card') ? btn.closest('.fdb-card').querySelector('.fdb-shared') : root.querySelector('#fdbMsg');
    if (!holder) return;
    holder.hidden = false; holder.textContent = text;
    clearTimeout(holder._t); holder._t = setTimeout(function () { holder.hidden = true; }, 4000);
  }
  function share(hash, btn) {
    var url = pageUrl(hash);
    var holder = btn.closest('.fdb-card') ? btn.closest('.fdb-card').querySelector('.fdb-shared') : root.querySelector('#fdbMsg');
    function showUrl(msg) { holder.hidden = false; holder.innerHTML = esc(msg) + ' <input class="fdb-url" readonly value="' + esc(url) + '">'; var i = holder.querySelector('input'); i.focus(); i.select(); }
    try {
      navigator.clipboard.writeText(url).then(function () { holder.hidden = false; holder.innerHTML = 'Ссылка скопирована: <span class="fdb-url-t">' + esc(url) + '</span>'; }, function () { showUrl('Скопируйте ссылку:'); });
    } catch (e) { showUrl('Скопируйте ссылку:'); }
  }

  /* ---------- Вид: сравнение ---------- */
  function compareView(ids) {
    var L = ids.map(function (id) { return byId[id]; }).filter(Boolean);
    if (L.length < 2) return '<p><a href="#films">← Все плёнки</a></p><h1>Сравнение плёнок</h1><p class="fdb-empty">Для сравнения нужно минимум две плёнки. Отметьте их кнопкой «+ Сравнить» в справочнике.</p>';
    var p135 = L.map(function (f) { return minPrice(f, '135'); }), best = Math.min.apply(null, p135.filter(Boolean).map(function (p) { return p.price; }));
    var gBest = Math.min.apply(null, L.map(function (f) { return GRAIN.indexOf(f.grain); }));
    var row = function (label, fn) { return '<tr><th scope="row">' + label + '</th>' + L.map(function (f, i) { return '<td>' + fn(f, i) + '</td>'; }).join('') + '</tr>'; };
    var plans = L.map(mxPlan);
    return '<p class="fdb-back"><a href="#films">← Все плёнки</a></p><h1>Сравнение плёнок</h1>' +
      '<div class="fdb-bar"><span class="fdb-lead" style="margin:0">' + L.map(function (f) { return esc(f.name); }).join(' · ') + '</span><button type="button" class="fdb-act" data-share="compare-' + L.map(function (f) { return f.id; }).join('+') + '">Ссылка на сравнение</button></div><p class="fdb-shared" id="fdbMsg" hidden></p>' +
      '<div class="table-wrap"><table class="fdb-ctable" style="--n:' + L.length + '"><thead><tr><th></th>' + L.map(function (f) {
        return '<th><div class="fdb-can fdb-can-s ' + (TYPE_CLS[f.type] || '') + '" aria-hidden="true"><span class="fdb-can-iso">' + f.iso + '</span></div><a href="#film-' + f.id + '">' + esc(f.name) + '</a><button type="button" class="fdb-x" data-uncmp="' + f.id + '" data-incompare="1" aria-label="Убрать из сравнения">убрать</button></th>';
      }).join('') + '</tr></thead><tbody>' +
      row('Тип', function (f) { return '<span class="fdb-sw ' + TYPE_CLS[f.type] + '"></span> ' + esc(f.type); }) +
      row('ISO', function (f) { return '<b>' + f.iso + '</b>'; }) +
      row('Свет', function (f) { return icon(f.light) + ' ' + esc(lightLabel(f.light)); }) +
      row('Зерно', function (f) { return dots(f.grain, GRAIN, '') + (GRAIN.indexOf(f.grain) === gBest ? ' <span class="fdb-good">мельче всех</span>' : ''); }) +
      row('Контраст', function (f) { return dots(f.contrast, CONTRAST, ''); }) +
      row('Характер', function (f) { return esc(f.look); }) +
      row('Для чего', function (f) { return esc(f.purpose); }) +
      row('Проявка', function (f) { return esc(f.dev); }) +
      row('Для MX (135)', function (f) { return f.formats.indexOf('135') !== -1 ? '<span class="fdb-good">да</span>' : '<span class="fdb-warn">нет, только 120</span>'; }) +
      row('Цена 135 от', function (f, i) { var p = p135[i]; return p ? '<b class="' + (p.price === best ? 'fdb-best' : '') + '">' + rub(p.price) + '</b><small>' + esc(p.shop) + (p.perFrame ? ' · ' + rub(p.perFrame) + '/кадр' : '') + '</small>' + (p.price === best ? '<span class="fdb-good">дешевле</span>' : '') : '—'; }) +
      row('Цена 120 от', function (f) { var p = minPrice(f, '120'); return p ? rub(p.price) + '<small>' + esc(p.shop) + '</small>' : '—'; }) +
      row('Диск ISO на MX', function (f, i) { return plans[i] ? '<b>' + plans[i].dial + '</b>' : '—'; }) +
      row('Пасмурно, f · t', function (f, i) { if (!plans[i]) return '—'; var pp = pair(13, plans[i].dial); return fA(pp.a) + ' · ' + fT(pp.t); }) +
      row('Вечер в помещении', function (f, i) { if (!plans[i]) return '—'; var pp = pair(7, plans[i].dial); return fA(pp.a) + ' · ' + fT(pp.t) + (pp.warn ? '<small class="fdb-w">' + esc(pp.warn) + '</small>' : ''); }) +
      row('Сюжеты', function (f) { return '<small>' + f.subjects.map(esc).join(', ') + '</small>'; }) +
      '</tbody></table></div>' +
      '<p class="fdb-fine">«Пасмурно» — EV 13, «вечер в помещении» — EV 7, объектив 50/1.7, ближайшие значения на кольце и диске MX.</p>';
  }

  /* ---------- Вид: одна плёнка ---------- */
  function filmView(f) {
    var similar = FILMS.filter(function (x) { return x !== f && x.type === f.type && x.light === f.light && x.formats.indexOf('135') !== -1; })
      .sort(function (a, b) { var x = minPrice(a, '135'), y = minPrice(b, '135'); return (x ? x.price : 1e9) - (y ? y.price : 1e9); }).slice(0, 3);
    return '<p class="fdb-back"><a href="#films">← Все плёнки</a></p>' +
      '<div class="fdb-cards fdb-single">' + card(f, { open: true, h1: true }) + '</div>' +
      '<div class="fdb-sharebox"><span>Ссылка на эту плёнку для друга:</span><input class="fdb-url" readonly value="' + esc(pageUrl('film-' + f.id)) + '" aria-label="Ссылка на плёнку"><button type="button" class="fdb-act" data-share="film-' + f.id + '">Скопировать</button></div>' +
      (similar.length ? '<h2>Похожие: тот же тип и свет</h2><div class="fdb-cards">' + similar.map(function (x) { return card(x); }).join('') + '</div>' : '') +
      '<div id="fdbCmpBar" class="fdb-cmpwrap"></div>';
  }

  /* ---------- Вид: справочник ---------- */
  var root = null;
  function shell() {
    var counts = {}; FILMS.forEach(function (f) { f.prices.forEach(function (p) { counts[p.shop] = (counts[p.shop] || 0) + 1; }); });
    var nPrices = FILMS.reduce(function (a, f) { return a + f.prices.length; }, 0);
    return '<h1>Справочник плёнок</h1>' +
      '<p class="fdb-lead">' + FILMS.length + ' плёнок, ' + nPrices + ' цен в ' + SHOPS.length + ' магазинах. Выберите сюжет и свет — справочник покажет, что брать. Отметьте до трёх плёнок кнопкой «+ Сравнить», чтобы поставить их рядом. Цены проверены <b>' + esc(D.priceDate) + '</b>, перед покупкой сверьте на сайте магазина.</p>' +
      '<section class="fdb-panel" aria-label="Подбор плёнки">' +
      '<div class="fdb-row"><span class="fdb-lab">Быстрый выбор</span><div class="fdb-presets">' + PRESETS.map(function (p, i) { return '<button type="button" class="fdb-preset" data-i="' + i + '">' + esc(p[0]) + '</button>'; }).join('') + '</div></div>' +
      '<div class="fdb-grid">' +
      '<label class="fdb-field"><span class="fdb-lab">Сюжет</span><select id="fdbSubj"><option value="">Любой</option>' + SUBJECTS.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fdb-field"><span class="fdb-lab">Слово в описании</span><input id="fdbQ" type="search" placeholder="неон, тёплый, кожа…"></label>' +
      '<label class="fdb-field"><span class="fdb-lab">Цена плёнки до</span><span class="fdb-range"><input id="fdbMax" type="range" min="0" max="' + (BUDGET.length - 1) + '" step="1" value="' + (BUDGET.length - 1) + '"><output id="fdbMaxV">без ограничения</output></span></label>' +
      '</div>' +
      '<div class="fdb-row"><span class="fdb-lab">Свет</span><div id="fdbLight"></div></div>' +
      '<div class="fdb-row"><span class="fdb-lab">Тип</span><div id="fdbType"></div></div>' +
      '<div class="fdb-row"><span class="fdb-lab">Формат</span><div class="fdb-chips" id="fdbFmt"></div></div>' +
      '<details class="fdb-more"><summary>Ещё фильтры: зерно, контраст, проявка</summary>' +
      '<div class="fdb-row"><span class="fdb-lab">Зерно</span><div id="fdbGrain"></div></div>' +
      '<div class="fdb-row"><span class="fdb-lab">Контраст</span><div id="fdbContrast"></div></div>' +
      '<div class="fdb-row"><span class="fdb-lab">Проявка</span><div id="fdbDev"></div></div></details>' +
      '</section>' +
      '<div class="fdb-bar"><span id="fdbCount" class="fdb-count" aria-live="polite"></span>' +
      '<label class="fdb-sort"><span class="fdb-lab">Сортировка</span><select id="fdbSort"><option value="price">по цене</option><option value="iso">по ISO</option><option value="grain">по зерну</option><option value="contrast">по контрасту</option><option value="name">по названию</option></select></label><button type="button" class="fdb-chip fdb-dir" id="fdbDir"></button>' +
      '<div class="fdb-chips" id="fdbView"></div><button type="button" class="fdb-reset" id="fdbReset">Сбросить</button></div>' +
      '<div id="fdbList"></div>' +
      '<div id="fdbCmpBar" class="fdb-cmpwrap"></div>' +
      '<h2 id="shops">Магазины и лаборатории</h2>' +
      '<p class="fdb-lead">Адреса и часы — с сайтов магазинов, проверено ' + esc(D.shopsChecked) + '.</p>' +
      '<div class="fdb-shops">' + SHOPS.map(function (s) {
        return '<section class="fdb-shop"><h3>' + esc(s.name) + '</h3><p class="fdb-shop-meta">' + esc(s.city) + ' · ' + plural(counts[s.name] || 0, 'предложение', 'предложения', 'предложений') + ' в справочнике</p>' +
          '<ul>' + s.points.map(function (p) { return '<li><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span>' + (p[2] ? '<small>' + esc(p[2]) + '</small>' : '') + '</li>'; }).join('') + '</ul>' +
          '<p class="fdb-shop-c">' + (s.hours ? esc(s.hours) + '<br>' : '') + (s.phone ? 'Телефон: <span class="sel">' + esc(s.phone) + '</span><br>' : '') + '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.site) + ' ↗</a></p></section>';
      }).join('') + '</div>' +
      '<p class="fdb-src">Источник: личный архив плёнок автора курса (таблица «Архив фотоплёнок»). Описания характера плёнок — по данным магазинов и опыту фотографов. Подсказки для Pentax MX рассчитаны по ISO и типу плёнки.</p>';
  }

  function syncControls() {
    var q = function (s) { return root.querySelector(s); };
    q('#fdbLight').innerHTML = chips('light', LIGHT, st.light, function (o) { return o[1]; }, icon);
    q('#fdbType').innerHTML = chips('type', TYPES, st.type, null, function (v) { return '<span class="fdb-sw ' + TYPE_CLS[v] + '"></span>'; });
    q('#fdbGrain').innerHTML = chips('grain', GRAIN, st.grain);
    q('#fdbContrast').innerHTML = chips('contrast', CONTRAST, st.contrast);
    q('#fdbDev').innerHTML = chips('dev', DEV, st.dev);
    q('#fdbFmt').innerHTML = [['135', '135 · подходит для MX'], ['120', '120 (средний формат)'], ['any', 'Любой']].map(function (o) {
      return '<button type="button" class="fdb-chip" data-fmt="' + o[0] + '" aria-pressed="' + (st.fmt === o[0]) + '">' + o[1] + '</button>';
    }).join('');
    q('#fdbView').innerHTML = [['cards', 'Карточки'], ['table', 'Таблица']].map(function (o) {
      return '<button type="button" class="fdb-chip" data-view="' + o[0] + '" aria-pressed="' + (st.view === o[0]) + '">' + o[1] + '</button>';
    }).join('');
    q('#fdbSubj').value = st.subject; q('#fdbQ').value = st.q; q('#fdbSort').value = st.sort;
    dirLabel();
    q('#fdbMax').value = BUDGET.indexOf(st.max) === -1 ? BUDGET.length - 1 : BUDGET.indexOf(st.max);
    q('#fdbMaxV').textContent = st.max >= 99999 ? 'без ограничения' : rub(st.max);
    root.querySelectorAll('.fdb-preset').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.i === st.preset)); });
  }
  var DIR_TXT = {
    price: ['дешевле → дороже', 'дороже → дешевле'], iso: ['ISO: меньше → больше', 'ISO: больше → меньше'],
    grain: ['зерно: мельче → крупнее', 'зерно: крупнее → мельче'], contrast: ['контраст: мягче → жёстче', 'контраст: жёстче → мягче'],
    name: ['А → Я', 'Я → А']
  };
  function dirLabel() {
    var b = root.querySelector('#fdbDir'), t = DIR_TXT[st.sort][st.dir === 1 ? 0 : 1];
    b.innerHTML = (st.dir === 1 ? '↑ ' : '↓ ') + esc(t);
    b.setAttribute('aria-label', 'Порядок сортировки: ' + (st.dir === 1 ? 'по возрастанию' : 'по убыванию') + ', ' + t + '. Нажмите, чтобы поменять');
  }
  function draw() {
    var list = sorted(FILMS.filter(match));
    root.querySelector('#fdbCount').textContent = list.length ? 'Найдено плёнок: ' + list.length : 'Ничего не нашлось';
    root.querySelector('#fdbList').innerHTML = list.length ? (st.view === 'table' ? tableView(list) : '<div class="fdb-cards">' + list.map(function (f) { return card(f); }).join('') + '</div>') :
      '<p class="fdb-empty">Под эти условия плёнок нет. Уберите один из фильтров или нажмите «Сбросить».</p>';
    refreshCmp();
  }
  function update() { syncControls(); draw(); }

  var mode = 'list';
  function onClick(e) {
    var b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.cmp) { toggleCmp(b.dataset.cmp, b); return; }
    if (b.dataset.uncmp) {
      var i = cmp.indexOf(b.dataset.uncmp); if (i !== -1) cmp.splice(i, 1); saveCmp();
      if (b.dataset.incompare) { location.hash = cmp.length >= 2 ? 'compare-' + cmp.join('+') : 'films'; return; }
      refreshCmp(); return;
    }
    if (b.dataset.cmpclear) { cmp = []; saveCmp(); refreshCmp(); return; }
    if (b.dataset.share) { share(b.dataset.share, b); return; }
    if (b.dataset.phf) { lbOpen(byId[b.dataset.phf], +b.dataset.phi, b); return; }
    if (mode !== 'list') return;
    if (b.classList.contains('fdb-preset')) {
      var k = +b.dataset.i, keepFmt = st.fmt, keepView = st.view, keepDir = st.dir;
      if (st.preset === k) { st = fresh(); } else { st = fresh(); Object.keys(PRESETS[k][1]).forEach(function (key) { st[key] = PRESETS[k][1][key]; }); st.preset = k; }
      st.fmt = keepFmt; st.view = keepView; st.dir = keepDir; update(); return;
    }
    if (b.id === 'fdbDir') { st.dir = -st.dir; dirLabel(); draw(); return; }
    if (b.id === 'fdbReset') { st = fresh(); update(); return; }
    if (b.dataset.fmt) { st.fmt = b.dataset.fmt; update(); return; }
    if (b.dataset.view) { st.view = b.dataset.view; update(); return; }
    var box = b.closest('.fdb-chips'); if (!box || !box.dataset.k) return;
    var arr = st[box.dataset.k], v = b.dataset.v, idx = arr.indexOf(v);
    if (idx === -1) arr.push(v); else arr.splice(idx, 1);
    st.preset = -1; update();
  }
  function bindList() {
    root.querySelector('#fdbSubj').addEventListener('change', function (e) { st.subject = e.target.value; st.preset = -1; update(); });
    root.querySelector('#fdbSort').addEventListener('change', function (e) { st.sort = e.target.value; dirLabel(); draw(); });
    root.querySelector('#fdbQ').addEventListener('input', function (e) { st.q = e.target.value.trim(); st.preset = -1; draw(); });
    root.querySelector('#fdbMax').addEventListener('input', function (e) { st.max = BUDGET[+e.target.value]; st.preset = -1; root.querySelector('#fdbMaxV').textContent = st.max >= 99999 ? 'без ограничения' : rub(st.max); draw(); });
  }

  /* ---------- Примеры снимков и просмотрщик ---------- */
  function photosBlock(f, open) {
    var P = f.photos || [];
    if (!P.length) return '<p class="fdb-nophoto">Примеров снимков под свободной лицензией пока не нашлось.</p>';
    var nMx = P.filter(function (p) { return p.mx; }).length;
    return '<details class="fdb-det fdb-det-ph" data-ph="' + f.id + '"' + (open ? ' open' : '') + '><summary>Примеры снимков (' + P.length + ')' + (nMx ? ' · ' + nMx + ' на Pentax MX' : '') + '</summary><div class="fdb-ph-grid"></div>' +
      '<p class="fdb-fine">Снимки разных фотографов под свободными лицензиями (CC0, CC BY, CC BY‑SA), копии хранятся на этом сайте. Цвет и контраст зависят от сканирования и обработки — смотрите на характер и зерно. Нажмите на снимок, чтобы увеличить: там автор, лицензия и ссылка на оригинал.</p></details>';
  }
  function fillPhotos(det) {
    var g = det.querySelector('.fdb-ph-grid');
    if (!g || g.childElementCount) return;
    var f = byId[det.dataset.ph];
    g.innerHTML = f.photos.map(function (p, i) {
      return '<button type="button" class="fdb-ph" data-phf="' + f.id + '" data-phi="' + i + '" aria-label="Увеличить снимок ' + (i + 1) + ': ' + esc(p.author) + '">' +
        '<img src="' + esc(p.thumb) + '" alt="' + esc(f.name + ' — пример снимка ' + (i + 1)) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest(\'.fdb-ph\').hidden=true">' +
        (p.mx ? '<span class="fdb-ph-mx">MX</span>' : '') + '</button>';
    }).join('');
  }
  var lb = null, lbF = null, lbI = 0, lbBack = null;
  function lbEl() {
    if (lb) return lb;
    lb = document.createElement('div'); lb.className = 'fdb-lb'; lb.hidden = true;
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Просмотр снимка');
    lb.innerHTML = '<div class="fdb-lb-top"><span class="fdb-lb-n"></span><button type="button" class="fdb-lb-x" aria-label="Закрыть">×</button></div>' +
      '<div class="fdb-lb-stage"><button type="button" class="fdb-lb-nav fdb-lb-prev" aria-label="Предыдущий снимок">‹</button><img class="fdb-lb-img" alt="" referrerpolicy="no-referrer"><button type="button" class="fdb-lb-nav fdb-lb-next" aria-label="Следующий снимок">›</button></div>' +
      '<div class="fdb-lb-cap"></div>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function (e) {
      if (e.target.classList.contains('fdb-lb-img')) { if (!dragged) lbZoom(e); return; }
      if (e.target.closest('.fdb-lb-x') || e.target === lb || (e.target.classList.contains('fdb-lb-stage') && !lb.classList.contains('zoom'))) lbClose();
      else if (e.target.closest('.fdb-lb-prev')) lbGo(-1);
      else if (e.target.closest('.fdb-lb-next')) lbGo(1);
    });
    var stage = lb.querySelector('.fdb-lb-stage'), drag = null, dragged = false;
    stage.addEventListener('pointerdown', function (e) {
      dragged = false;
      if (!lb.classList.contains('zoom') || e.pointerType === 'touch') return;
      drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop }; e.preventDefault();
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
      stage.scrollLeft = drag.l - dx; stage.scrollTop = drag.t - dy;
    });
    window.addEventListener('pointerup', function () { drag = null; });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    lb.addEventListener('touchend', function (e) { if (x0 == null || lb.classList.contains('zoom')) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) lbGo(dx < 0 ? 1 : -1); x0 = null; });
    window.addEventListener('hashchange', function () { if (!lb.hidden) lbClose(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbGo(-1); else if (e.key === 'ArrowRight') lbGo(1);
    });
    return lb;
  }
  function lbZoom(e) {
    var img = e.target, stage = lb.querySelector('.fdb-lb-stage'), p = lbF.photos[lbI];
    if (lb.classList.contains('zoom')) { lb.classList.remove('zoom'); return; }
    var r = img.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    function go() {
      if (img.naturalWidth <= img.clientWidth * 1.05) { lbHint('Этот снимок уже показан в полную величину — больше деталей в файле нет'); return; }
      lb.classList.add('zoom');
      stage.scrollLeft = fx * img.naturalWidth - stage.clientWidth / 2;
      stage.scrollTop = fy * img.naturalHeight - stage.clientHeight / 2;
    }
    if (img.getAttribute('src') !== p.full) {  /* большая версия ещё не подставлена — дождёмся её */
      lbHint('Загружаю снимок в полном размере…');
      img.onload = function () { img.onload = null; if (lbF.photos[lbI] === p) { lbHint(''); go(); } };
      img.src = p.full; return;
    }
    go();
  }
  function lbHint(t) {
    var h = lb.querySelector('.fdb-lb-hint');
    if (h) h.textContent = t || 'Нажмите на снимок — увеличение 1:1, чтобы рассмотреть зерно';
  }
  function lbShow() {
    lb.classList.remove('zoom');
    var P = lbF.photos, p = P[lbI], img = lb.querySelector('.fdb-lb-img');
    img.src = p.thumb; img.alt = lbF.name + ' — пример снимка ' + (lbI + 1);
    img.onload = null;
    var full = new Image(); full.referrerPolicy = 'no-referrer'; full.onload = function () { if (P[lbI] === p) img.src = p.full; }; full.src = p.full;
    lb.querySelector('.fdb-lb-n').textContent = lbF.name + ' · ' + (lbI + 1) + ' из ' + P.length;
    lb.querySelector('.fdb-lb-cap').innerHTML = (p.mx ? '<span class="fdb-ph-mx">Pentax MX</span> ' : '') + (p.title ? '«' + esc(p.title) + '» · ' : '') +
      'Автор: ' + esc(p.author) + ' · ' + (p.licenseUrl ? '<a href="' + esc(p.licenseUrl) + '" target="_blank" rel="noopener">' + esc(p.license) + '</a>' : esc(p.license)) +
      ' · <a href="' + esc(p.page) + '" target="_blank" rel="noopener">оригинал у автора ↗</a>' +
      '<span class="fdb-lb-hint">Нажмите на снимок — увеличение 1:1, чтобы рассмотреть зерно</span>';
  }
  function lbOpen(f, i, from) {
    lbEl(); lbF = f; lbI = i; lbBack = from; lb.hidden = false; document.documentElement.classList.add('fdb-lb-on'); lbShow();
    lb.querySelector('.fdb-lb-x').focus();
  }
  function lbGo(d) { var n = lbF.photos.length; lbI = (lbI + d + n) % n; lbShow(); }
  function lbClose() { lb.hidden = true; lb.querySelector('.fdb-lb-img').removeAttribute('src'); document.documentElement.classList.remove('fdb-lb-on'); if (lbBack) lbBack.focus(); }
  function onToggle(e) { var d = e.target; if (d.classList && d.classList.contains('fdb-det-ph') && d.open) fillPhotos(d); }

  var bound = null;
  /* hash: 'films' | 'film-<id>' | 'compare-<id>+<id>' ; returns page title */
  function render(content, hash) {
    root = content;
    if (bound !== content) { content.addEventListener('click', onClick); content.addEventListener('toggle', onToggle, true); bound = content; }
    hash = hash || 'films';
    if (hash.indexOf('film-') === 0) {
      var f = byId[hash.slice(5)];
      if (f) { mode = 'film'; content.innerHTML = filmView(f); content.querySelectorAll('.fdb-det-ph[open]').forEach(fillPhotos); refreshCmp(); return f.name; }
    }
    if (hash.indexOf('compare-') === 0) {
      var ids = hash.slice(8).split('+').filter(function (id) { return byId[id]; }).slice(0, MAXCMP);
      if (ids.length) { cmp = ids; saveCmp(); }
      mode = 'compare'; content.innerHTML = compareView(ids); return 'Сравнение плёнок';
    }
    mode = 'list'; content.innerHTML = shell(); bindList(); update();
    return 'Справочник плёнок';
  }

  function callout(num, content) {
    if (num !== '05' && num !== '03') return;
    var h = [].filter.call(content.querySelectorAll('h2'), function (x) { return /^(5\.9|3\.12)\./.test(x.textContent.trim()); })[0];
    if (!h) return;
    var a = document.createElement('a'); a.href = '#films'; a.className = 'fdb-callout';
    a.innerHTML = '<b>Справочник плёнок →</b><span>' + FILMS.length + ' плёнок с фильтрами по сюжету и свету, сравнение, подсказки для MX и цены в трёх магазинах</span>';
    h.insertAdjacentElement('afterend', a);
  }
  var searchText = FILMS.map(function (f) { return f.name + ' ' + f.look + ' ' + f.purpose + ' ' + f.subjects.join(' ') + ' ' + f.type; }).join(' ').toLowerCase() + ' справочник плёнок магазины цены';
  return { render: render, callout: callout, searchText: searchText, count: FILMS.length, mxPlan: mxPlan, pair: pair };
})();
