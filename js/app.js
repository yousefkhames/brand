(function () {
  'use strict';
  var L = window.BrandLib, A = window.BrandArt, I = window.BrandI18n, esc = L.esc;
  var lastFocus = null, S, route = 'lookbook', filter = 'all', sel = null, tickId = null, lastLive = null, lastOrder = null, formErrors = {};
  var CUSTOMER_KEY = 'brand.customer';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function load() {
    try {
      var raw = localStorage.getItem(L.STORAGE_KEY);
      if (raw) return L.sanitizeState(JSON.parse(raw));
    } catch (e) {}
    return L.defaultState();
  }
  function save() {
    try { localStorage.setItem(L.STORAGE_KEY, JSON.stringify(S)); } catch (e) { toast('Storage full: remove large photos'); }
  }
  function customer() { try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {}; } catch (e) { return {}; } }
  function saveCustomer(c) { try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c)); } catch (e) {} }

  var lang = function () { return S.brand.lang; };
  var t = function (k) { return (I[lang()][k] != null ? I[lang()][k] : I.en[k]) || k; };
  var tr = function (o) { return L.tr(o, lang()); };
  var money = function (n) { return L.formatPrice(n, S.brand.currency, lang()); };
  var num = function (n) { return L.formatNumber(n, lang()); };
  var pad = function (n) { var s = (n < 10 ? '0' : '') + n; return lang() === 'ar' ? L.toArabicDigits(s) : s; };

  /* ---------- chrome ---------- */
  function applyTheme() {
    var c = S.brand.colors, r = document.documentElement;
    r.style.setProperty('--bg', c.bg); r.style.setProperty('--ink', c.ink);
    r.style.setProperty('--accent', c.accent); r.style.setProperty('--accent2', c.accent2);
    r.style.setProperty('--on-accent', L.onColor(c.accent)); r.style.setProperty('--on-accent2', L.onColor(c.accent2));
    r.style.setProperty('--on-ink', L.onColor(c.ink));
    r.style.setProperty('--card', A.shade(c.bg, L.onColor(c.bg) === '#111111' ? -0.045 : 0.07));
    r.style.colorScheme = L.onColor(c.bg) === '#ffffff' ? 'dark' : 'light';
    r.lang = lang(); r.dir = lang() === 'ar' ? 'rtl' : 'ltr';
    document.title = tr(S.brand.name) + ' - ' + tr(S.brand.tagline);
    var tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = c.bg;
  }
  function logoHtml(size) {
    var b = S.brand;
    var inner = b.logoImage ? '<img src="' + esc(b.logoImage) + '" alt="">' : A.logo(b.monogram, b.colors.accent, b.colors.accent2);
    return '<span class="logo" style="--s:' + (size || 40) + 'px">' + inner + '</span>';
  }
  function navItems() {
    return [['lookbook', ''], ['drop', 'drop'], ['bag', 'bag'], ['orders', 'orders'], ['settings', 'settings']];
  }
  var ICONS = {
    lookbook: '<path d="M4 5h6v14H4zM14 5h6v6h-6zM14 15h6v4h-6z"/>',
    drop: '<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 2h6"/>',
    bag: '<path d="M5 8h14l-1 12H6zM9 8a3 3 0 016 0"/>',
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'
  };
  function icon(n) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>'; }
  function renderChrome() {
    applyTheme();
    var cnt = L.cartCount(S);
    $('#header').innerHTML = '<a class="brandlink" href="#/" aria-label="' + esc(tr(S.brand.name)) + '">' + logoHtml(38) + '<span class="bname">' + esc(tr(S.brand.name)) + '</span></a>' +
      '<nav class="topnav" aria-label="Main">' + navItems().map(function (n) {
        return '<a href="#/' + n[1] + '" class="' + (route === n[0] ? 'on' : '') + '"' + (route === n[0] ? ' aria-current="page"' : '') + '>' + t(n[0]) + (n[0] === 'bag' && cnt ? ' <b class="badge">' + num(cnt) + '</b>' : '') + '</a>';
      }).join('') + '</nav>' +
      '<button class="langbtn" data-act="lang" type="button">' + t('switchLang') + '</button>';
    $('#tabbar').innerHTML = navItems().map(function (n) {
      return '<a href="#/' + n[1] + '" class="' + (route === n[0] ? 'on' : '') + '">' + icon(n[0]) + (n[0] === 'bag' && cnt ? '<b class="badge">' + num(cnt) + '</b>' : '') + '<span>' + t(n[0]) + '</span></a>';
    }).join('');
    $('#skip').textContent = t('skip');
    $('#footer').innerHTML = '<div class="foot-brand">' + logoHtml(30) + '<strong>' + esc(tr(S.brand.name)) + '</strong></div><p>' + esc(t('footer')) + '</p>' +
      (S.brand.instagram ? '<a href="https://instagram.com/' + esc(S.brand.instagram) + '" target="_blank" rel="noopener">@' + esc(S.brand.instagram) + '</a>' : '');
  }

  /* ---------- product art ---------- */
  function art(p, colorHex, locked) {
    var first = colorHex || (p.colors[0] && p.colors[0].hex) || '#d9c6a5';
    var inner = p.img ? '<img src="' + esc(p.img) + '" alt="' + esc(tr(p.name)) + '" loading="lazy">' : A.garment(p.type, first);
    var bg = A.shade(S.brand.colors.bg, L.onColor(S.brand.colors.bg) === '#111111' ? -0.1 : 0.12);
    return '<div class="art' + (locked ? ' locked' : '') + '" style="background:' + bg + '">' + inner + '</div>';
  }
  function swatches(p) {
    return '<span class="sw">' + p.colors.map(function (c) { return '<i style="background:' + esc(c.hex) + '" title="' + esc(c.name) + '"></i>'; }).join('') + '</span>';
  }
  function card(p, i) {
    var locked = L.isLocked(p, S), sold = p.soldOut;
    var tag = sold ? '<em class="tag">' + t('soldOut') + '</em>' : locked ? '<em class="tag lock">' + t('locked') + '</em>' : p.drop ? '<em class="tag drop">' + t('drop') + '</em>' : '';
    return '<article class="card' + (i % 5 === 0 ? ' wide' : '') + '"><button class="cardbtn" data-act="open" data-id="' + esc(p.id) + '" type="button" aria-label="' + t('open') + ': ' + esc(tr(p.name)) + '">' +
      '<span class="no">' + t('look') + ' ' + pad(i + 1) + '</span>' + tag + art(p, null, locked) +
      '<span class="meta"><span class="pn">' + esc(tr(p.name)) + '</span><span class="pp">' + money(p.price) + '</span></span>' + swatches(p) + '</button></article>';
  }

  /* ---------- views ---------- */
  function viewLookbook() {
    var live = L.dropIsLive(S);
    var list = S.products.filter(function (p) { return !p.drop || live; });
    var cats = ['all'].concat(L.CATS.filter(function (c) { return list.some(function (p) { return p.cat === c; }); }));
    if (cats.indexOf(filter) < 0) filter = 'all';
    var shown = list.filter(function (p) { return filter === 'all' || p.cat === filter; });
    var dropTeaser = !live && S.drop.enabled && S.products.some(function (p) { return p.drop; });
    return '<section class="hero"><p class="kicker">' + t('lookbook') + ' / ' + esc(S.brand.currency.code) + '</p>' +
      '<h1>' + esc(tr(S.brand.name)) + '</h1><p class="tag-line">' + esc(tr(S.brand.tagline)) + '</p>' +
      '<div class="hero-art">' + S.products.slice(0, 3).map(function (p, i) { return '<div class="h' + i + '">' + art(p) + '</div>'; }).join('') + '</div>' +
      '<div class="cta-row"><a class="btn" href="#grid" data-act="scroll">' + t('shopNow') + '</a>' + (dropTeaser ? '<a class="btn ghost" href="#/drop">' + t('seeDrop') + '</a>' : '') + '</div></section>' +
      (dropTeaser ? '<a class="ticker" href="#/drop"><span>' + esc(tr(S.drop.title)) + '</span><b data-cd="inline">' + inlineCd() + '</b></a>' : '') +
      '<section id="grid" class="grid-sec"><div class="chips" role="tablist">' + cats.map(function (c) {
        return '<button type="button" class="chip' + (c === filter ? ' on' : '') + '" data-act="filter" data-cat="' + c + '">' + t(c) + '</button>';
      }).join('') + '</div><div class="grid">' + shown.map(card).join('') + '</div></section>' +
      '<section class="about"><h2>' + t('aboutUs') + '</h2><p>' + esc(tr(S.brand.about)) + '</p></section>';
  }
  function inlineCd() {
    var c = L.countdown(S.drop.at);
    return c.done ? t('dropLive') : (c.d ? pad(c.d) + ':' : '') + pad(c.h) + ':' + pad(c.m) + ':' + pad(c.s);
  }
  function viewDrop() {
    if (!S.drop.enabled) return '<section class="empty"><h1>' + t('dropOff') + '</h1><p>' + t('dropOffText') + '</p><a class="btn" href="#/settings">' + t('settings') + '</a></section>';
    var c = L.countdown(S.drop.at), items = S.products.filter(function (p) { return p.drop; });
    var tiles = c.done ? '<div class="live-banner">' + t('dropLive') + '</div>' :
      '<div class="tiles" role="timer" aria-live="off">' + [['d', 'days'], ['h', 'hours'], ['m', 'mins'], ['s', 'secs']].map(function (u) {
        return '<div class="tile"><b data-cd="' + u[0] + '">' + pad(c[u[0]]) + '</b><span>' + t(u[1]) + '</span></div>';
      }).join('') + '</div>';
    var when = new Date(S.drop.at).toLocaleString(lang() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'full', timeStyle: 'short' });
    var remind = !c.done ? '<a class="btn ghost" data-act="remind" href="' + esc(L.waLink(S.brand.whatsapp, S.brand.countryCode, t('remindMsg') + tr(S.drop.title))) + '" target="_blank" rel="noopener">' + t('remind') + '</a>' : '';
    return '<section class="drop-hero"><span class="stamp">' + t('drop') + '</span><p class="kicker">' + (c.done ? t('dropLive') : t('dropIn')) + '</p><h1>' + esc(tr(S.drop.title)) + '</h1>' +
      '<p class="tag-line">' + esc(tr(S.drop.blurb)) + '</p>' + tiles + '<p class="when">' + esc(when) + '</p>' + remind + '</section>' +
      '<section class="grid-sec"><div class="grid">' + items.map(card).join('') + '</div></section>';
  }
  function viewBag() {
    var lines = L.cartLines(S), cu = customer();
    if (lastOrder && !lines.length) {
      return '<section class="done"><span class="stamp ok">✓</span><h1>' + esc(lastOrder.id) + '</h1><p>' + t('orderReady') + '</p><a class="btn wa" href="' + esc(lastOrder.link) + '" target="_blank" rel="noopener">' + t('orderWa') + '</a> <a class="btn ghost" href="#/orders">' + t('orders') + '</a></section>';
    }
    if (!lines.length) return '<section class="empty"><h1>' + t('empty') + '</h1><p>' + t('emptyHint') + '</p><a class="btn" href="#/">' + t('lookbook') + '</a></section>';
    var total = L.cartTotal(S);
    var fe = formErrors;
    return '<section class="bag"><h1>' + t('bag') + '</h1><ul class="lines">' + lines.map(function (l) {
      return '<li class="line' + (l.blocked ? ' blocked' : '') + '"><div class="lart">' + art(l.product, colorHex(l.product, l.color)) + '</div><div class="linfo"><strong>' + esc(tr(l.product.name)) + '</strong>' +
        '<small>' + esc([l.size, l.color].filter(Boolean).join(' / ')) + '</small>' + (l.blocked ? '<small class="warn">' + t('blockedLine') + '</small>' : '<small>' + money(l.unit) + '</small>') + '</div>' +
        '<div class="qty"><button type="button" data-act="qty" data-i="' + l.index + '" data-d="-1" aria-label="-">−</button><output>' + num(l.qty) + '</output><button type="button" data-act="qty" data-i="' + l.index + '" data-d="1" aria-label="+">+</button></div>' +
        '<div class="lt">' + (l.blocked ? '' : money(l.total)) + '</div><button type="button" class="x" data-act="rm" data-i="' + l.index + '" aria-label="' + t('remove') + '">×</button></li>';
    }).join('') + '</ul><div class="totalrow"><span>' + t('total') + '</span><strong id="total">' + money(total) + '</strong></div>' +
      '<form id="checkout" class="form" novalidate><h2>' + t('checkout') + '</h2>' +
      field('name', t('name'), cu.name, fe.name, 'text', 'name') + field('phone', t('phone'), cu.phone, fe.phone, 'tel', 'tel') +
      field('address', t('address'), cu.address, fe.address, 'text', 'street-address') + field('notes', t('notes'), cu.notes, false, 'text', 'off') +
      '<div class="cta-col"><button class="btn wa" type="submit">' + t('orderWa') + '</button><button class="btn ghost" type="button" data-act="copy">' + t('copyMsg') + '</button></div></form></section>';
  }
  function field(id, label, val, err, type, ac) {
    return '<label class="f' + (err ? ' err' : '') + '"><span>' + label + '</span><input name="' + id + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(val || '') + '"' + (err ? ' aria-invalid="true"' : '') + '></label>';
  }
  function colorHex(p, name) { var c = p.colors.filter(function (x) { return x.name === name; })[0]; return c ? c.hex : null; }
  function viewOrders() {
    if (!S.orders.length) return '<section class="empty"><h1>' + t('noOrders') + '</h1><p>' + t('noOrdersHint') + '</p></section>';
    return '<section class="orders"><h1>' + t('orders') + '</h1><ul class="olist">' + S.orders.map(function (o, i) {
      var d = new Date(o.at).toLocaleDateString(lang() === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return '<li><div><strong>' + esc(o.id) + '</strong><small>' + esc(d) + ' · ' + esc(o.name) + ' · ' + num(o.count) + ' ' + t('pieces') + '</small></div><b>' + money(o.total) + '</b>' +
        '<select data-act="ostatus" data-i="' + i + '" aria-label="' + t('status') + '">' + ['sent', 'paid', 'delivered'].map(function (s) { return '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + t(s) + '</option>'; }).join('') + '</select></li>';
    }).join('') + '</ul><div class="rowbtns"><button class="btn" type="button" data-act="csv">' + t('exportCsv') + '</button><button class="btn ghost" type="button" data-act="clearorders">' + t('clearOrders') + '</button></div></section>';
  }

  /* settings */
  var PALETTES = [
    ['Salt & Clay', '#f3ece1', '#1d1a17', '#c4472b', '#2f4a43'],
    ['Midnight', '#14161c', '#f2efe9', '#e6b34a', '#6f8fb7'],
    ['Mint Studio', '#e9f1ec', '#16231d', '#1f7a5c', '#d9663b'],
    ['Rose Noir', '#f6e9e6', '#2a1717', '#b02a4f', '#40305c'],
    ['Cobalt', '#eef1f7', '#101828', '#2146c7', '#e3562a']
  ];
  function toLocalInput(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function inp(label, path, val, opts) {
    opts = opts || {};
    return '<label class="f"><span>' + label + '</span><input data-set="' + path + '" type="' + (opts.type || 'text') + '" value="' + esc(val) + '"' + (opts.dir ? ' dir="' + opts.dir + '"' : '') + (opts.max ? ' maxlength="' + opts.max + '"' : '') + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '></label>';
  }
  function colorInp(label, key) {
    return '<label class="f color"><span>' + label + '</span><input data-set="brand.colors.' + key + '" type="color" value="' + S.brand.colors[key] + '"><code>' + S.brand.colors[key] + '</code></label>';
  }
  function viewSettings() {
    var b = S.brand, d = S.drop;
    var low = L.contrast(b.colors.bg, b.colors.ink) < 4.5;
    return '<section class="settings"><h1>' + t('settings') + '</h1>' +
      '<details open class="sec"><summary>' + t('sBrand') + '</summary><div class="secbody">' +
      '<div class="logo-edit">' + logoHtml(72) + '<div><label class="btn ghost small">' + t('uploadLogo') + '<input id="logofile" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>' +
      (b.logoImage ? ' <button type="button" class="btn ghost small" data-act="rmlogo">' + t('removeLogo') + '</button>' : '') + '</div></div>' +
      inp(t('monogram'), 'brand.monogram', b.monogram, { max: 2 }) +
      inp(t('nameEn'), 'brand.name.en', b.name.en, { dir: 'ltr', max: 40 }) + inp(t('nameAr'), 'brand.name.ar', b.name.ar, { dir: 'rtl', max: 40 }) +
      inp(t('tagEn'), 'brand.tagline.en', b.tagline.en, { dir: 'ltr', max: 90 }) + inp(t('tagAr'), 'brand.tagline.ar', b.tagline.ar, { dir: 'rtl', max: 90 }) +
      inp(t('aboutEn'), 'brand.about.en', b.about.en, { dir: 'ltr', max: 300 }) + inp(t('aboutAr'), 'brand.about.ar', b.about.ar, { dir: 'rtl', max: 300 }) +
      '<p class="lbl">' + t('palettes') + '</p><div class="pal">' + PALETTES.map(function (p, i) {
        return '<button type="button" class="pbtn" data-act="palette" data-i="' + i + '" title="' + p[0] + '"><i style="background:' + p[1] + '"></i><i style="background:' + p[2] + '"></i><i style="background:' + p[3] + '"></i><i style="background:' + p[4] + '"></i></button>';
      }).join('') + '</div><div class="colors">' + colorInp(t('cBg'), 'bg') + colorInp(t('cInk'), 'ink') + colorInp(t('cAccent'), 'accent') + colorInp(t('cAccent2'), 'accent2') + '</div>' +
      (low ? '<p class="warn">' + t('contrastWarn') + '</p>' : '') + '</div></details>' +

      '<details class="sec"><summary>' + t('sStore') + '</summary><div class="secbody">' +
      inp(t('curCode'), 'brand.currency.code', b.currency.code, { dir: 'ltr', max: 5 }) + inp(t('curSym'), 'brand.currency.symbol', b.currency.symbol, { max: 6 }) +
      '<label class="f"><span>' + t('curPos') + '</span><select data-set="brand.currency.position"><option value="after"' + (b.currency.position === 'after' ? ' selected' : '') + '>' + t('after') + '</option><option value="before"' + (b.currency.position === 'before' ? ' selected' : '') + '>' + t('before') + '</option></select></label>' +
      inp(t('wa'), 'brand.whatsapp', b.whatsapp, { type: 'tel', dir: 'ltr', inputmode: 'tel' }) + inp(t('cc'), 'brand.countryCode', b.countryCode, { dir: 'ltr', max: 4, inputmode: 'numeric' }) +
      inp(t('insta'), 'brand.instagram', b.instagram, { dir: 'ltr', max: 30 }) +
      '<label class="f"><span>' + t('lang') + '</span><select data-set="brand.lang"><option value="ar"' + (b.lang === 'ar' ? ' selected' : '') + '>العربية</option><option value="en"' + (b.lang === 'en' ? ' selected' : '') + '>English</option></select></label></div></details>' +

      '<details class="sec"><summary>' + t('sDrop') + '</summary><div class="secbody">' +
      '<label class="f chk"><input type="checkbox" data-set="drop.enabled"' + (d.enabled ? ' checked' : '') + '><span>' + t('dropOn') + '</span></label>' +
      '<label class="f"><span>' + t('dropAt') + '</span><input type="datetime-local" data-set="drop.at" value="' + toLocalInput(d.at) + '"></label>' +
      '<div class="rowbtns"><button type="button" class="btn ghost small" data-act="dropin" data-min="10080">' + t('inWeek') + '</button><button type="button" class="btn ghost small" data-act="dropin" data-min="1">' + t('in1min') + '</button></div>' +
      inp(t('dropTitleEn'), 'drop.title.en', d.title.en, { dir: 'ltr', max: 80 }) + inp(t('dropTitleAr'), 'drop.title.ar', d.title.ar, { dir: 'rtl', max: 80 }) +
      inp(t('dropBlurbEn'), 'drop.blurb.en', d.blurb.en, { dir: 'ltr', max: 200 }) + inp(t('dropBlurbAr'), 'drop.blurb.ar', d.blurb.ar, { dir: 'rtl', max: 200 }) + '</div></details>' +

      '<details class="sec"><summary>' + t('sProducts') + ' (' + num(S.products.length) + ')</summary><div class="secbody"><ul class="plist">' + S.products.map(function (p) {
        return '<li><div class="pthumb">' + art(p) + '</div><div class="pi"><strong>' + esc(tr(p.name)) + '</strong><small>' + money(p.price) + (p.drop ? ' · ' + t('drop') : '') + (p.soldOut ? ' · ' + t('soldOut') : '') + '</small></div>' +
          '<button type="button" class="btn ghost small" data-act="editp" data-id="' + esc(p.id) + '">' + t('edit') + '</button></li>';
      }).join('') + '</ul><button type="button" class="btn small" data-act="addp">' + t('addProduct') + '</button></div></details>' +

      '<details class="sec"><summary>' + t('sData') + '</summary><div class="secbody"><p class="hint">' + t('kitHint') + '</p><div class="rowbtns">' +
      '<button type="button" class="btn small" data-act="exportkit">' + t('exportKit') + '</button><button type="button" class="btn ghost small" data-act="exportall">' + t('exportAll') + '</button>' +
      '<label class="btn ghost small">' + t('importFile') + '<input id="importfile" type="file" accept="application/json,.json" hidden></label>' +
      '<button type="button" class="btn ghost small danger" data-act="reset">' + t('reset') + '</button></div></div></details></section>';
  }

  /* ---------- render ---------- */
  function renderView() {
    var html = route === 'drop' ? viewDrop() : route === 'bag' ? viewBag() : route === 'orders' ? viewOrders() : route === 'settings' ? viewSettings() : viewLookbook();
    $('#view').innerHTML = html;
    lastLive = L.dropIsLive(S);
    startTick();
  }
  function render() { renderChrome(); renderView(); }
  function startTick() {
    if (tickId) clearInterval(tickId);
    tickId = setInterval(function () {
      var live = L.dropIsLive(S);
      if (live !== lastLive) { render(); return; }
      var c = L.countdown(S.drop.at);
      $$('[data-cd]').forEach(function (el) {
        var k = el.getAttribute('data-cd');
        el.textContent = k === 'inline' ? inlineCd() : pad(c[k]);
      });
    }, 1000);
  }
  function parseRoute() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    route = ['drop', 'bag', 'orders', 'settings'].indexOf(h) >= 0 ? h : 'lookbook';
  }

  /* ---------- product sheet ---------- */
  function openSheet(id) {
    var p = L.findProduct(S, id); if (!p) return;
    sel = { id: id, size: p.sizes[0] || '', color: p.colors[0] ? p.colors[0].name : '', qty: 1 };
    drawSheet();
    var d = $('#sheet'); d.hidden = false; document.body.classList.add('noscroll');
    var f = $('#sheet [data-act=closesheet]'); if (f) f.focus();
  }
  function drawSheet() {
    var p = L.findProduct(S, sel.id), locked = L.isLocked(p, S), blocked = locked || p.soldOut;
    var c = L.countdown(S.drop.at);
    $('#sheet').innerHTML = '<div class="scrim" data-act="closesheet"></div><div class="panel" role="dialog" aria-modal="true" aria-label="' + esc(tr(p.name)) + '">' +
      '<button class="x close" type="button" data-act="closesheet" aria-label="' + t('close') + '">×</button>' +
      '<div class="pa">' + art(p, colorHex(p, sel.color), locked) + '</div><div class="pb"><h2>' + esc(tr(p.name)) + '</h2><p class="price">' + money(p.price) + '</p><p class="desc">' + esc(tr(p.desc)) + '</p>' +
      (p.sizes.length ? '<p class="lbl">' + t('size') + '</p><div class="opts">' + p.sizes.map(function (s) { return '<button type="button" class="opt' + (s === sel.size ? ' on' : '') + '" data-act="size" data-v="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' : '') +
      (p.colors.length ? '<p class="lbl">' + t('color') + ': <b>' + esc(sel.color) + '</b></p><div class="opts">' + p.colors.map(function (cc) { return '<button type="button" class="dot' + (cc.name === sel.color ? ' on' : '') + '" data-act="color" data-v="' + esc(cc.name) + '" style="background:' + esc(cc.hex) + '" aria-label="' + esc(cc.name) + '"></button>'; }).join('') + '</div>' : '') +
      '<p class="lbl">' + t('qty') + '</p><div class="qty big"><button type="button" data-act="sq" data-d="-1" aria-label="-">−</button><output>' + num(sel.qty) + '</output><button type="button" data-act="sq" data-d="1" aria-label="+">+</button></div>' +
      (blocked ? '<button class="btn" type="button" disabled>' + (p.soldOut ? t('soldOut') : t('locked') + (c.valid && !c.done ? ' · ' + inlineCd() : '')) + '</button>' : '<button class="btn" type="button" data-act="addbag">' + t('addToBag') + ' · ' + money(p.price * sel.qty) + '</button>') +
      '<a class="btn ghost" data-act="share" target="_blank" rel="noopener" href="' + esc('https://wa.me/?text=' + encodeURIComponent(t('shareMsg') + tr(p.name) + ' - ' + money(p.price) + '\n' + location.href.split('#')[0])) + '">' + t('share') + '</a></div></div>';
  }
  function closeSheet() { var d = $('#sheet'); d.hidden = true; d.innerHTML = ''; sel = null; document.body.classList.remove('noscroll'); if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }

  /* ---------- product editor ---------- */
  var editing = null;
  function openEditor(id) {
    var p = id ? JSON.parse(JSON.stringify(L.findProduct(S, id))) : { id: L.uid('p'), name: { en: '', ar: '' }, desc: { en: '', ar: '' }, cat: 'tops', type: 'tee', price: 0, sizes: ['S', 'M', 'L'], colors: [{ name: 'Sand', hex: '#d9c6a5' }], drop: false, soldOut: false, img: '', isNew: true };
    editing = p;
    var o = function (arr, cur, label) { return arr.map(function (v) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + t(v) + '</option>'; }).join(''); };
    $('#editor').innerHTML = '<div class="scrim" data-act="closeeditor"></div><form class="panel ed" id="pform" novalidate><button class="x close" type="button" data-act="closeeditor" aria-label="' + t('close') + '">×</button><h2>' + (p.isNew ? t('addProduct') : t('edit')) + '</h2>' +
      fld('pName', t('pName'), 'name.en', p.name.en, 'ltr') + fld('pNameAr', t('pNameAr'), 'name.ar', p.name.ar, 'rtl') +
      '<label class="f"><span>' + t('pPrice') + '</span><input name="price" type="number" min="0" step="any" inputmode="decimal" value="' + esc(p.price) + '"></label>' +
      '<label class="f"><span>' + t('pCat') + '</span><select name="cat">' + o(L.CATS, p.cat) + '</select></label>' +
      '<label class="f"><span>' + t('pType') + '</span><select name="type">' + o(L.TYPES, p.type) + '</select></label>' +
      '<label class="f"><span>' + t('pSizes') + '</span><input name="sizes" dir="ltr" value="' + esc(p.sizes.join(', ')) + '"></label>' +
      '<label class="f"><span>' + t('pColors') + '</span><input name="colors" dir="ltr" value="' + esc(p.colors.map(function (c) { return c.name + ':' + c.hex; }).join(', ')) + '"></label>' +
      fld('pDesc', t('pDesc'), 'desc.en', p.desc.en, 'ltr') + fld('pDescAr', t('pDescAr'), 'desc.ar', p.desc.ar, 'rtl') +
      '<label class="f chk"><input name="drop" type="checkbox"' + (p.drop ? ' checked' : '') + '><span>' + t('pDrop') + '</span></label>' +
      '<label class="f chk"><input name="soldOut" type="checkbox"' + (p.soldOut ? ' checked' : '') + '><span>' + t('pSold') + '</span></label>' +
      '<div class="logo-edit"><div class="pthumb">' + art(p) + '</div><div><label class="btn ghost small">' + t('pImg') + '<input id="pimgfile" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>' + (p.img ? ' <button type="button" class="btn ghost small" data-act="rmpimg">' + t('pImgRemove') + '</button>' : '') + '</div></div>' +
      '<p class="warn" id="ederr" hidden></p><div class="rowbtns"><button class="btn" type="submit">' + t('save') + '</button><button class="btn ghost" type="button" data-act="closeeditor">' + t('cancel') + '</button>' +
      (p.isNew ? '' : '<button class="btn ghost danger" type="button" data-act="delp">' + t('delete') + '</button>') + '</div></form>';
    $('#editor').hidden = false; document.body.classList.add('noscroll');
    $('#pform input[name=name\\.en]').focus();
  }
  function fld(id, label, name, val, dir) { return '<label class="f"><span>' + label + '</span><input name="' + name + '" dir="' + dir + '" maxlength="160" value="' + esc(val) + '"></label>'; }
  function closeEditor() { $('#editor').hidden = true; $('#editor').innerHTML = ''; editing = null; if (!sel) document.body.classList.remove('noscroll'); }
  function saveEditor(form) {
    var g = function (n) { return form.elements[n].value.trim(); };
    var colors = g('colors').split(',').map(function (s) { var m = s.trim().match(/^(.*?):?\s*(#[0-9a-fA-F]{6})$/); return m ? { name: (m[1] || m[2]).trim(), hex: m[2] } : null; }).filter(Boolean);
    var price = parseFloat(g('price'));
    var err = null;
    if (!g('name.en') && !g('name.ar')) err = t('pName');
    else if (!isFinite(price) || price < 0) err = t('pPrice');
    if (err) { var e = $('#ederr'); e.hidden = false; e.textContent = t('needFields') + ' (' + err + ')'; return; }
    editing.name = { en: g('name.en') || g('name.ar'), ar: g('name.ar') || g('name.en') };
    editing.desc = { en: g('desc.en'), ar: g('desc.ar') };
    editing.price = price; editing.cat = g('cat'); editing.type = g('type');
    editing.sizes = g('sizes').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    editing.colors = colors; editing.drop = form.elements.drop.checked; editing.soldOut = form.elements.soldOut.checked;
    var isNew = editing.isNew; delete editing.isNew;
    var clean = L.sanitizeState({ brand: S.brand, drop: S.drop, products: [editing] }).products[0];
    clean.id = editing.id;
    if (isNew) S.products.push(clean); else S.products = S.products.map(function (p) { return p.id === clean.id ? clean : p; });
    save(); closeEditor(); render(); toast(t('saved'));
  }

  /* ---------- helpers ---------- */
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function setPath(obj, path, val) {
    var k = path.split('.'), o = obj;
    for (var i = 0; i < k.length - 1; i++) o = o[k[i]];
    o[k[k.length - 1]] = val;
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
  }
  function fileToImage(file, max, mime, cb) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL(mime, 0.82));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand'; }
  function readCheckout() {
    var f = $('#checkout'); if (!f) return {};
    var c = {}; ['name', 'phone', 'address', 'notes'].forEach(function (k) { c[k] = f.elements[k].value.trim(); });
    return c;
  }
  function buildMsg(c, id) { return L.buildOrderMessage(S, c, lang(), id); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    var idx = parseInt(el.getAttribute('data-i'), 10);
    switch (act) {
      case 'lang': S.brand.lang = lang() === 'ar' ? 'en' : 'ar'; save(); render(); break;
      case 'scroll': e.preventDefault(); $('#grid').scrollIntoView({ behavior: 'smooth' }); break;
      case 'filter': filter = el.getAttribute('data-cat'); renderView(); break;
      case 'open': openSheet(id); lastFocus = el; break;
      case 'closesheet': closeSheet(); break;
      case 'size': sel.size = el.getAttribute('data-v'); drawSheet(); break;
      case 'color': sel.color = el.getAttribute('data-v'); drawSheet(); break;
      case 'sq': sel.qty = Math.max(1, Math.min(99, sel.qty + parseInt(el.getAttribute('data-d'), 10))); drawSheet(); break;
      case 'addbag':
        S.cart = L.addToCart(S.cart, { pid: sel.id, size: sel.size, color: sel.color, qty: sel.qty }); lastOrder = null; save(); closeSheet(); renderChrome(); toast(t('added')); break;
      case 'qty': S.cart = L.setQty(S.cart, idx, S.cart[idx].qty + parseInt(el.getAttribute('data-d'), 10)); save(); renderChrome(); renderView(); break;
      case 'rm': S.cart = L.setQty(S.cart, idx, 0); save(); renderChrome(); renderView(); break;
      case 'copy':
        var c = readCheckout(); saveCustomer(c);
        var msg = buildMsg(c, L.nextOrderId(S.orders));
        (navigator.clipboard ? navigator.clipboard.writeText(msg) : Promise.reject()).then(function () { toast(t('copied')); }, function () { window.prompt('', msg); });
        break;
      case 'ostatus': break;
      case 'csv': download(slug(S.brand.name.en) + '-orders.csv', L.ordersToCsv(S.orders, S.brand.currency.code), 'text/csv'); break;
      case 'clearorders': S.orders = []; save(); renderView(); break;
      case 'palette': var p = PALETTES[idx]; S.brand.colors = { bg: p[1], ink: p[2], accent: p[3], accent2: p[4] }; save(); render(); break;
      case 'rmlogo': S.brand.logoImage = ''; save(); render(); break;
      case 'dropin': S.drop.at = L.inDays(parseInt(el.getAttribute('data-min'), 10) / 1440); S.drop.enabled = true; save(); keepOpen(render); break;
      case 'addp': openEditor(null); break;
      case 'editp': openEditor(id); break;
      case 'closeeditor': closeEditor(); break;
      case 'delp':
        if (confirm(t('confirmDelete'))) { var pid = editing.id; S.products = S.products.filter(function (p) { return p.id !== pid; }); S.cart = S.cart.filter(function (l) { return l.pid !== pid; }); save(); closeEditor(); keepOpen(render); }
        break;
      case 'rmpimg': editing.img = ''; keepForm(); break;
      case 'exportkit': download(slug(S.brand.name.en) + '-brand-kit.json', L.exportKit(S)); break;
      case 'exportall': download(slug(S.brand.name.en) + '-backup.json', L.exportAll(S)); break;
      case 'reset': if (confirm(t('resetConfirm'))) { S = L.defaultState(); save(); render(); toast(t('saved')); } break;
    }
  });
  function keepOpen(fn) { var open = $$('details.sec').map(function (d) { return d.open; }); fn(); $$('details.sec').forEach(function (d, i) { d.open = !!open[i]; }); }
  function keepForm() {
    var f = $('#pform'), vals = {};
    $$('input,select', f).forEach(function (i) { if (i.name) vals[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
    var p = editing; var tmp = p.isNew; openEditor(null); editing = p; if (tmp) editing.isNew = true;
    var nf = $('#pform'); Object.keys(vals).forEach(function (k) { var i = nf.elements[k]; if (i) { if (i.type === 'checkbox') i.checked = vals[k]; else i.value = vals[k]; } });
    $('#pform h2').textContent = tmp ? t('addProduct') : t('edit');
  }

  document.addEventListener('input', function (e) {
    var el = e.target, path = el.getAttribute && el.getAttribute('data-set');
    if (!path) return;
    var v = el.type === 'checkbox' ? el.checked : el.value;
    if (path === 'drop.at') { var dt = new Date(v); if (isNaN(dt)) return; v = dt.toISOString(); }
    if (path === 'brand.countryCode') v = String(v).replace(/\D/g, '');
    if (path === 'brand.instagram') v = String(v).replace(/[^\w.]/g, '');
    setPath(S, path, v); save();
    if (path === 'brand.lang') { render(); return; }
    renderChrome();
    if (path.indexOf('brand.colors.') === 0) { var code = el.parentNode.querySelector('code'); if (code) code.textContent = v; }
    if (path === 'drop.enabled' || path === 'drop.at') lastLive = null;
    if (path === 'brand.monogram') { var lg = $('.logo-edit .logo'); if (lg) lg.outerHTML = logoHtml(72); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'logofile' && el.files[0]) fileToImage(el.files[0], 256, 'image/png', function (d) { S.brand.logoImage = d; save(); keepOpen(render); });
    if (el.id === 'pimgfile' && el.files[0]) fileToImage(el.files[0], 480, 'image/jpeg', function (d) { editing.img = d; keepForm(); });
    if (el.id === 'importfile' && el.files[0]) {
      var r = new FileReader();
      r.onload = function () {
        var res = L.parseImport(String(r.result));
        if (!res.ok) { toast(t('importBad')); return; }
        var keepCart = S.cart, keepOrders = S.orders; S = res.state; if (!S.cart.length) S.cart = []; S.orders = S.orders.length ? S.orders : keepOrders; void keepCart;
        save(); render(); toast(t('imported'));
      };
      r.readAsText(el.files[0]);
    }
    if (el.getAttribute('data-act') === 'ostatus') { S.orders[parseInt(el.getAttribute('data-i'), 10)].status = el.value; save(); }
    if (el.getAttribute('data-set') && el.tagName === 'SELECT') { /* handled by input event */ }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'pform') { e.preventDefault(); saveEditor(e.target); return; }
    if (e.target.id !== 'checkout') return;
    e.preventDefault();
    var c = readCheckout(); saveCustomer(c);
    formErrors = L.validateCustomer(c);
    if (Object.keys(formErrors).length) { renderView(); var bad = $('.f.err input'); if (bad) bad.focus(); toast(t('needFields')); return; }
    if (!L.normalizePhone(S.brand.whatsapp, S.brand.countryCode)) { toast(t('needWa')); return; }
    if (L.cartTotal(S) <= 0 && !L.cartLines(S).some(function (l) { return !l.blocked; })) { toast(t('empty')); return; }
    var id = L.nextOrderId(S.orders), lines = L.cartLines(S).filter(function (l) { return !l.blocked; });
    var link = L.waLink(S.brand.whatsapp, S.brand.countryCode, buildMsg(c, id));
    S.orders.unshift({ id: id, at: new Date().toISOString(), total: L.cartTotal(S), count: lines.reduce(function (a, l) { return a + l.qty; }, 0), name: c.name, status: 'sent' });
    S.cart = []; formErrors = {}; lastOrder = { id: id, link: link }; save();
    window.open(link, '_blank', 'noopener');
    renderChrome(); renderView();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      var ov = !$('#editor').hidden ? $('#editor') : !$('#sheet').hidden ? $('#sheet') : null;
      if (ov) {
        var f = $$('button:not([disabled]),a[href],input,select', ov).filter(function (x) { return x.offsetParent !== null; });
        if (f.length) {
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }
    if (e.key === 'Escape') { if (!$('#editor').hidden) closeEditor(); else if (!$('#sheet').hidden) closeSheet(); }
  });
  window.addEventListener('hashchange', function () { parseRoute(); filter = filter; render(); window.scrollTo(0, 0); });

  S = load(); parseRoute(); render();
  window.__brand = { get state() { return S; } };
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
