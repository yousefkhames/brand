/* Pure logic for Brand. Works in the browser (window.BrandLib) and in Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BrandLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  var STORAGE_KEY = 'brand.v1';

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toArabicDigits(str) {
    return String(str).replace(/[0-9]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; });
  }

  function formatNumber(n, lang) {
    var num = Number(n) || 0;
    var s = (Math.round(num * 100) / 100).toString();
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    s = parts.join('.');
    return lang === 'ar' ? toArabicDigits(s).replace(/,/g, '٬').replace(/\./g, '٫') : s;
  }

  function formatPrice(n, currency, lang) {
    var sym = (currency && currency.symbol) || '';
    var num = formatNumber(n, lang);
    return currency && currency.position === 'before' ? sym + '\u00a0' + num : num + '\u00a0' + sym;
  }

  function countdown(targetIso, now) {
    var t = new Date(targetIso).getTime();
    if (isNaN(t)) return { valid: false, done: false, d: 0, h: 0, m: 0, s: 0, total: 0 };
    var diff = t - (now == null ? Date.now() : now);
    if (diff <= 0) return { valid: true, done: true, d: 0, h: 0, m: 0, s: 0, total: 0 };
    var secs = Math.floor(diff / 1000);
    return {
      valid: true, done: false, total: diff,
      d: Math.floor(secs / 86400), h: Math.floor((secs % 86400) / 3600),
      m: Math.floor((secs % 3600) / 60), s: secs % 60
    };
  }

  function dropIsLive(state, now) {
    if (!state.drop || !state.drop.enabled) return true; // no drop scheduled: everything open
    var c = countdown(state.drop.at, now);
    return !c.valid || c.done;
  }

  function isLocked(product, state, now) {
    return !!product.drop && !dropIsLive(state, now);
  }

  function normalizePhone(num, countryCode) {
    var value = String(num || '').trim().replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
    if (!/^\+?[\d().\s-]+$/.test(value)) return '';
    var d = value.replace(/\D/g, '');
    if (!d) return '';
    var cc = String(countryCode || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    else if (!value.startsWith('+') && d.charAt(0) === '0' && cc) d = cc + d.slice(1);
    return /^[1-9]\d{7,14}$/.test(d) ? d : '';
  }

  function waLink(number, countryCode, message) {
    var n = normalizePhone(number, countryCode);
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(message) : '';
  }

  function shopPhone(state) {
    var value = normalizePhone(state.brand.whatsapp, state.brand.countryCode);
    return !state.demo && value !== '201000000000' ? value : '';
  }

  function lineKey(l) { return JSON.stringify([l.pid, l.size || '', l.color || '']); }
  function validVariant(p, l) {
    return (p.sizes.length ? p.sizes.includes(l.size) : !l.size) &&
      (p.colors.length ? p.colors.some(function (c) { return c.name === l.color; }) : !l.color);
  }

  function addToCart(cart, line) {
    var out = cart.map(function (l) { return Object.assign({}, l); });
    var key = lineKey(line);
    var qty = Math.max(1, Math.min(99, parseInt(line.qty, 10) || 1));
    for (var i = 0; i < out.length; i++) {
      if (lineKey(out[i]) === key) { out[i].qty = Math.min(99, out[i].qty + qty); return out; }
    }
    out.push({ pid: line.pid, size: line.size || '', color: line.color || '', qty: qty });
    return out;
  }

  function setQty(cart, index, qty) {
    var out = cart.map(function (l) { return Object.assign({}, l); });
    if (!out[index]) return out;
    if (qty <= 0) out.splice(index, 1); else out[index].qty = Math.min(99, qty);
    return out;
  }

  function findProduct(state, id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }

  function cartLines(state, now) {
    var res = [];
    state.cart.forEach(function (l, idx) {
      var p = findProduct(state, l.pid);
      if (!p) return;
      res.push({ index: idx, product: p, size: l.size, color: l.color, qty: l.qty,
        unit: Number(p.price) || 0, total: (Number(p.price) || 0) * l.qty,
        blocked: !!p.soldOut || isLocked(p, state, now) || !validVariant(p, l) });
    });
    return res;
  }

  function cartTotal(state, now) {
    return cartLines(state, now).reduce(function (a, l) { return a + (l.blocked ? 0 : l.total); }, 0);
  }

  function cartCount(state) {
    return state.cart.reduce(function (a, l) { return a + l.qty; }, 0);
  }

  function tr(obj, lang) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || obj.ar || '';
  }

  function buildOrderMessage(state, customer, lang, orderId, now) {
    var L = lang === 'ar' ? {
      head: 'طلب جديد', total: 'الإجمالي', name: 'الاسم', phone: 'الهاتف', addr: 'العنوان', notes: 'ملاحظات', ord: 'رقم الطلب', pay: 'الدفع عند الاستلام'
    } : {
      head: 'New order', total: 'Total', name: 'Name', phone: 'Phone', addr: 'Address', notes: 'Notes', ord: 'Order', pay: 'Cash on delivery'
    };
    var lines = cartLines(state, now).filter(function (l) { return !l.blocked; });
    var out = [];
    out.push('*' + L.head + ' - ' + tr(state.brand.name, lang) + '*');
    out.push(L.ord + ': ' + orderId);
    out.push('');
    lines.forEach(function (l) {
      var opts = [l.size, l.color].filter(Boolean).join(', ');
      out.push(l.qty + ' x ' + tr(l.product.name, lang) + (opts ? ' (' + opts + ')' : '') + ' - ' + formatPrice(l.total, state.brand.currency, lang));
    });
    out.push('');
    out.push('*' + L.total + ': ' + formatPrice(lines.reduce(function (a, l) { return a + l.total; }, 0), state.brand.currency, lang) + '*');
    out.push(L.pay);
    out.push('');
    if (customer.name) out.push(L.name + ': ' + customer.name);
    if (customer.phone) out.push(L.phone + ': ' + customer.phone);
    if (customer.address) out.push(L.addr + ': ' + customer.address);
    if (customer.notes) out.push(L.notes + ': ' + customer.notes);
    return out.join('\n');
  }

  function validateCustomer(c) {
    var errors = {};
    if (!c.name || c.name.trim().length < 2) errors.name = true;
    if (!c.phone || c.phone.replace(/\D/g, '').length < 7) errors.phone = true;
    if (!c.address || c.address.trim().length < 5) errors.address = true;
    return errors;
  }

  var HEX = /^#[0-9a-fA-F]{6}$/;

  function isHex(s) { return HEX.test(String(s)); }

  function luminance(hex) {
    var h = hex.replace('#', '');
    var rgb = [0, 2, 4].map(function (i) {
      var v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function onColor(bg) { return contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#ffffff' : '#111111'; }

  function inDays(days, now) {
    var d = new Date((now == null ? Date.now() : now) + days * 86400000);
    d.setSeconds(0, 0);
    return d.toISOString();
  }

  function defaultState(now) {
    var C = function (name, hex) { return { name: name, hex: hex }; };
    return {
      v: VERSION,
      demo: true,
      brand: {
        name: { en: 'Shamsa', ar: 'شمسة' },
        tagline: { en: 'Sun-washed basics from Alexandria', ar: 'ملابس يومية بروح الإسكندرية' },
        about: { en: 'This sample lookbook illustrates how a shop can present a collection.', ar: 'كتالوج تجريبي يوضح طريقة عرض مجموعة ملابس.' },
        monogram: 'S',
        logoImage: '',
        colors: { bg: '#f3ece1', ink: '#1d1a17', accent: '#c4472b', accent2: '#2f4a43' },
        currency: { code: 'EGP', symbol: 'ج.م', position: 'after' },
        whatsapp: '',
        countryCode: '20',
        lang: 'ar',
        instagram: ''
      },
      drop: {
        enabled: true,
        at: inDays(6, now),
        title: { en: 'Drop 04: Salt & Linen', ar: 'الإصدار ٠٤: ملح وكتان' },
        blurb: { en: 'Sample launch countdown. No stock or availability is promised.', ar: 'عدّ تنازلي تجريبي. لا يعكس المخزون أو التوافر الفعلي.' }
      },
      products: [
        { id: 'p1', name: { en: 'Boxy Tee', ar: 'تيشيرت واسع' }, cat: 'tops', type: 'tee', price: 450, sizes: ['S', 'M', 'L', 'XL'], colors: [C('Sand', '#d9c6a5'), C('Ink', '#1d1a17')], drop: false, soldOut: false, img: '', desc: { en: '240gsm Egyptian cotton, drop shoulder.', ar: 'قطن مصري ٢٤٠ جرام، كتف نازل.' } },
        { id: 'p2', name: { en: 'Heavy Hoodie', ar: 'هودي تقيل' }, cat: 'tops', type: 'hoodie', price: 980, sizes: ['M', 'L', 'XL'], colors: [C('Olive', '#5b6a46'), C('Clay', '#b5651d')], drop: false, soldOut: false, img: '', desc: { en: 'Brushed fleece inside, double-stitched.', ar: 'فليس مبطن من جوه، خياطة مضاعفة.' } },
        { id: 'p3', name: { en: 'Wide Trousers', ar: 'بنطلون واسع' }, cat: 'bottoms', type: 'pants', price: 720, sizes: ['S', 'M', 'L'], colors: [C('Bone', '#e8dfcf'), C('Charcoal', '#3a3a3c')], drop: false, soldOut: false, img: '', desc: { en: 'Relaxed cut, elastic back waist.', ar: 'قصة مريحة، وسط مطاط من ورا.' } },
        { id: 'p4', name: { en: 'Linen Shirt Dress', ar: 'فستان كتان' }, cat: 'dresses', type: 'dress', price: 1150, sizes: ['S', 'M', 'L'], colors: [C('Salt', '#f1ede4'), C('Sea', '#2f4a43')], drop: true, soldOut: false, img: '', desc: { en: 'Washed linen, button front, side pockets.', ar: 'كتان مغسول، زراير من قدام، جيوب جانبية.' } },
        { id: 'p5', name: { en: 'Dock Cap', ar: 'كاب الميناء' }, cat: 'accessories', type: 'cap', price: 260, sizes: ['One size'], colors: [C('Rust', '#a8432a'), C('Cream', '#efe6d2')], drop: true, soldOut: false, img: '', desc: { en: 'Six panel, brass buckle.', ar: 'ست قطع، إبزيم نحاس.' } },
        { id: 'p6', name: { en: 'Short Sleeve Overshirt', ar: 'قميص نص كم' }, cat: 'tops', type: 'shirt', price: 640, sizes: ['S', 'M', 'L', 'XL'], colors: [C('Sea', '#2f4a43'), C('Sand', '#d9c6a5')], drop: true, soldOut: false, img: '', desc: { en: 'Boxy fit, camp collar.', ar: 'قصة واسعة، ياقة كامب.' } }
      ],
      cart: [],
      orders: []
    };
  }

  var CATS = ['tops', 'bottoms', 'dresses', 'accessories'];
  var TYPES = ['tee', 'hoodie', 'pants', 'dress', 'cap', 'shirt'];

  function clampStr(s, n) { return String(s == null ? '' : s).slice(0, n); }
  function bi(o, n) {
    o = o && typeof o === 'object' ? o : { en: o, ar: o };
    return { en: clampStr(o.en, n), ar: clampStr(o.ar, n) };
  }

  /* Accepts untrusted JSON (import / localStorage) and returns a safe state. */
  function sanitizeState(input, now) {
    var base = defaultState(now);
    if (!input || typeof input !== 'object') return base;
    var b = input.brand || {};
    var colors = b.colors || {};
    var cur = b.currency || {};
    var out = {
      v: VERSION,
      demo: input.demo !== false,
      brand: {
        name: bi(b.name || base.brand.name, 40),
        tagline: bi(b.tagline || base.brand.tagline, 90),
        about: bi(b.about || base.brand.about, 300),
        monogram: clampStr(b.monogram || base.brand.monogram, 2),
        logoImage: typeof b.logoImage === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(b.logoImage) && b.logoImage.length < 400000 ? b.logoImage : '',
        colors: {
          bg: isHex(colors.bg) ? colors.bg : base.brand.colors.bg,
          ink: isHex(colors.ink) ? colors.ink : base.brand.colors.ink,
          accent: isHex(colors.accent) ? colors.accent : base.brand.colors.accent,
          accent2: isHex(colors.accent2) ? colors.accent2 : base.brand.colors.accent2
        },
        currency: {
          code: clampStr(cur.code || base.brand.currency.code, 5),
          symbol: clampStr(cur.symbol || base.brand.currency.symbol, 6),
          position: cur.position === 'before' ? 'before' : 'after'
        },
        whatsapp: clampStr(b.whatsapp == null ? base.brand.whatsapp : b.whatsapp, 20),
        countryCode: clampStr(b.countryCode == null ? base.brand.countryCode : b.countryCode, 4).replace(/\D/g, ''),
        lang: b.lang === 'en' ? 'en' : 'ar',
        instagram: clampStr(b.instagram, 40).replace(/[^\w.]/g, '')
      },
      drop: {
        enabled: input.drop ? input.drop.enabled !== false : base.drop.enabled,
        at: input.drop && !isNaN(new Date(input.drop.at).getTime()) ? new Date(input.drop.at).toISOString() : base.drop.at,
        title: bi(input.drop && input.drop.title || base.drop.title, 80),
        blurb: bi(input.drop && input.drop.blurb || base.drop.blurb, 200)
      },
      products: [],
      cart: [],
      orders: []
    };
    var prods = Array.isArray(input.products) ? input.products : base.products;
    prods.slice(0, 200).forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      var price = Number(p.price);
      out.products.push({
        id: clampStr(p.id, 30).replace(/[^\w-]/g, '') || uid('p'),
        name: bi(p.name, 60),
        cat: CATS.indexOf(p.cat) >= 0 ? p.cat : 'tops',
        type: TYPES.indexOf(p.type) >= 0 ? p.type : 'tee',
        price: isFinite(price) && price >= 0 && price <= 1_000_000 ? price : 0,
        sizes: (Array.isArray(p.sizes) ? p.sizes : []).map(function (s) { return clampStr(s, 10).trim(); }).filter(Boolean).slice(0, 12),
        colors: (Array.isArray(p.colors) ? p.colors : []).filter(function (c) { return c && isHex(c.hex); }).slice(0, 8).map(function (c) { return { name: clampStr(c.name, 20), hex: c.hex }; }),
        drop: !!p.drop,
        soldOut: !!p.soldOut,
        img: typeof p.img === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(p.img) && p.img.length < 400000 ? p.img : '',
        desc: bi(p.desc, 160)
      });
    });
    // unique ids
    var seen = Object.create(null);
    out.products.forEach(function (p) { if (seen[p.id]) p.id = uid('p'); seen[p.id] = 1; });
    if (Array.isArray(input.cart)) {
      input.cart.slice(0, 100).forEach(function (l) {
        if (l && findProduct(out, l.pid)) out.cart = addToCart(out.cart, { pid: l.pid, size: clampStr(l.size, 10), color: clampStr(l.color, 20), qty: l.qty });
      });
    }
    if (Array.isArray(input.orders)) {
      out.orders = input.orders.slice(0, 100).filter(function (o) { return o && o.id; }).map(function (o) {
        return { id: clampStr(o.id, 12), at: clampStr(o.at, 30), total: Number(o.total) || 0, count: Number(o.count) || 0, name: clampStr(o.name, 60), status: ['sent', 'paid', 'delivered'].indexOf(o.status) >= 0 ? o.status : 'sent' };
      });
    }
    return out;
  }

  /* Brand-kit only (no cart/orders), what you hand to a client. */
  function exportKit(state) {
    return JSON.stringify({ kind: 'brand-kit', v: VERSION, demo: state.demo, brand: state.brand, drop: state.drop, products: state.products }, null, 2);
  }

  function exportAll(state) {
    return JSON.stringify(Object.assign({ kind: 'brand-backup' }, state), null, 2);
  }

  function parseImport(text, now) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'json' }; }
    if (!data || typeof data !== 'object' || !data.brand || typeof data.brand !== 'object' || Array.isArray(data.brand) || !Array.isArray(data.products)) return { ok: false, error: 'shape' };
    if (data.v !== undefined && data.v !== VERSION) return { ok: false, error: 'version' };
    if (data.kind !== undefined && data.kind !== 'brand-kit' && data.kind !== 'brand-backup') return { ok: false, error: 'kind' };
    return { ok: true, kind: data.kind || 'legacy', state: sanitizeState(data, now) };
  }

  function csvCell(v) {
    var x = String(v == null ? '' : v);
    if (/^[\t\r\n]|^\s*[=+\-@]/.test(x)) x = "'" + x; // block spreadsheet formula injection
    return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x;
  }
  function ordersToCsv(orders, currencyCode) {
    var rows = [['id', 'date', 'customer', 'pieces', 'total', 'currency', 'status']];
    orders.forEach(function (o) { rows.push([o.id, o.at, o.name, o.count, o.total, currencyCode, o.status === 'sent' ? 'drafted' : o.status]); });
    return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  function nextOrderId(orders) {
    return 'B' + (1 + orders.reduce(function (n, order) {
      var match = /^B(\d{1,10})$/.exec(order.id);
      return match ? Math.max(n, Number(match[1])) : n;
    }, 1000));
  }

  return {
    VERSION: VERSION, STORAGE_KEY: STORAGE_KEY, CATS: CATS, TYPES: TYPES,
    uid: uid, esc: esc, toArabicDigits: toArabicDigits, formatNumber: formatNumber, formatPrice: formatPrice,
    countdown: countdown, dropIsLive: dropIsLive, isLocked: isLocked, shopPhone: shopPhone, normalizePhone: normalizePhone, waLink: waLink,
    addToCart: addToCart, setQty: setQty, findProduct: findProduct, cartLines: cartLines, cartTotal: cartTotal, cartCount: cartCount,
    tr: tr, buildOrderMessage: buildOrderMessage, validateCustomer: validateCustomer,
    isHex: isHex, contrast: contrast, onColor: onColor, inDays: inDays,
    defaultState: defaultState, sanitizeState: sanitizeState, exportKit: exportKit, exportAll: exportAll, parseImport: parseImport, nextOrderId: nextOrderId, ordersToCsv: ordersToCsv
  };
});
