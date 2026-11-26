const test = require('node:test');
const assert = require('node:assert');
const L = require('../js/lib.js');
const NOW = Date.parse('2026-11-26T10:00:00Z');

test('countdown splits time and reports done', () => {
  const c = L.countdown('2026-11-27T11:02:03Z', NOW);
  assert.deepStrictEqual([c.d, c.h, c.m, c.s, c.done], [1, 1, 2, 3, false]);
  assert.strictEqual(L.countdown('2026-11-26T09:00:00Z', NOW).done, true);
  assert.strictEqual(L.countdown('garbage', NOW).valid, false);
});

test('drop locks only drop products until the date', () => {
  const s = L.defaultState(NOW);
  const dropP = s.products.find(p => p.drop), normal = s.products.find(p => !p.drop);
  assert.ok(L.isLocked(dropP, s, NOW));
  assert.ok(!L.isLocked(normal, s, NOW));
  assert.ok(!L.isLocked(dropP, s, NOW + 7 * 86400000));
  s.drop.enabled = false;
  assert.ok(!L.isLocked(dropP, s, NOW));
});

test('phone normalisation', () => {
  assert.strictEqual(L.normalizePhone('010 0000 0000', '20'), '201000000000');
  assert.strictEqual(L.normalizePhone('+20 100 000 0000', '20'), '201000000000');
  assert.strictEqual(L.normalizePhone('0044 7700 900123', '20'), '447700900123');
  assert.strictEqual(L.normalizePhone('', '20'), '');
});

test('price formatting both languages and positions', () => {
  assert.strictEqual(L.formatPrice(1250, { symbol: 'EGP', position: 'before' }, 'en'), 'EGP\u00a01,250');
  assert.strictEqual(L.formatPrice(1250.5, { symbol: 'ج.م', position: 'after' }, 'ar'), '١٬٢٥٠٫٥\u00a0ج.م');
});

test('cart merges identical lines and caps quantity', () => {
  let c = [];
  c = L.addToCart(c, { pid: 'p1', size: 'M', color: 'Sand', qty: 1 });
  c = L.addToCart(c, { pid: 'p1', size: 'M', color: 'Sand', qty: 2 });
  c = L.addToCart(c, { pid: 'p1', size: 'L', color: 'Sand', qty: 1 });
  assert.strictEqual(c.length, 2);
  assert.strictEqual(c[0].qty, 3);
  c = L.addToCart(c, { pid: 'p1', size: 'M', color: 'Sand', qty: 500 });
  assert.strictEqual(c[0].qty, 99);
  assert.strictEqual(L.setQty(c, 0, 0).length, 1);
});

test('totals skip locked and sold out lines', () => {
  const s = L.defaultState(NOW);
  s.cart = [{ pid: 'p1', size: 'M', color: 'Sand', qty: 2 }, { pid: 'p4', size: 'M', color: 'Salt', qty: 1 }];
  assert.strictEqual(L.cartTotal(s, NOW), 900);
  assert.strictEqual(L.cartTotal(s, NOW + 7 * 86400000), 2050);
  s.products[0].soldOut = true;
  assert.strictEqual(L.cartTotal(s, NOW + 7 * 86400000), 1150);
});

test('order message contains lines, total, customer, and is encoded in link', () => {
  const s = L.defaultState(NOW);
  s.cart = [{ pid: 'p1', size: 'M', color: 'Sand', qty: 2 }];
  const msg = L.buildOrderMessage(s, { name: 'Sara', phone: '0111', address: 'Smouha', notes: '' }, 'en', 'B1001', NOW);
  assert.match(msg, /2 x Boxy Tee \(M, Sand\)/);
  assert.match(msg, /Total: 900/);
  assert.match(msg, /Name: Sara/);
  assert.ok(!/Notes:/.test(msg));
  const link = L.waLink('01000000000', '20', msg);
  assert.ok(link.startsWith('https://wa.me/201000000000?text='));
  assert.ok(decodeURIComponent(link.split('text=')[1]) === msg);
  const ar = L.buildOrderMessage(s, { name: 'سارة', phone: '0111', address: 'سموحة' }, 'ar', 'B1001', NOW);
  assert.match(ar, /طلب جديد - شمسة/);
});

test('customer validation', () => {
  assert.deepStrictEqual(Object.keys(L.validateCustomer({})).sort(), ['address', 'name', 'phone']);
  assert.deepStrictEqual(L.validateCustomer({ name: 'Al', phone: '01000000', address: 'Somewhere' }), {});
});

test('sanitize rejects junk and keeps valid data', () => {
  const s = L.sanitizeState({ brand: { colors: { bg: 'red', accent: '#112233' }, lang: 'fr', logoImage: 'javascript:alert(1)' }, products: [{ id: 'x y!', price: -4, cat: 'nope', colors: [{ hex: 'bad' }, { name: 'ok', hex: '#ffffff' }] }, null] }, NOW);
  assert.strictEqual(s.brand.colors.bg, '#f3ece1');
  assert.strictEqual(s.brand.colors.accent, '#112233');
  assert.strictEqual(s.brand.lang, 'ar');
  assert.strictEqual(s.brand.logoImage, '');
  assert.strictEqual(s.products.length, 1);
  assert.strictEqual(s.products[0].price, 0);
  assert.strictEqual(s.products[0].cat, 'tops');
  assert.strictEqual(s.products[0].colors.length, 1);
  assert.strictEqual(s.products[0].id, 'xy');
});

test('export then import round-trips brand, drop and products', () => {
  const s = L.defaultState(NOW);
  s.brand.name.en = 'Nile Wear';
  s.brand.currency = { code: 'USD', symbol: '$', position: 'before' };
  const r = L.parseImport(L.exportKit(s), NOW);
  assert.ok(r.ok);
  assert.strictEqual(r.state.brand.name.en, 'Nile Wear');
  assert.strictEqual(r.state.brand.currency.symbol, '$');
  assert.strictEqual(r.state.products.length, s.products.length);
  assert.deepStrictEqual(r.state.cart, []);
  assert.strictEqual(L.parseImport('nope', NOW).error, 'json');
  assert.strictEqual(L.parseImport('{"a":1}', NOW).error, 'shape');
});

test('contrast picks readable text colour', () => {
  assert.strictEqual(L.onColor('#000000'), '#ffffff');
  assert.strictEqual(L.onColor('#f3ece1'), '#111111');
  assert.ok(L.contrast('#000000', '#ffffff') > 20);
});

test('escape prevents HTML injection', () => {
  assert.strictEqual(L.esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});

test('orders CSV escapes commas, quotes and formula injection', () => {
  const csv = L.ordersToCsv([{ id: 'B1001', at: '2026-11-26T10:00:00Z', name: '=HYPERLINK("x"), Ali', count: 2, total: 900, status: 'paid' }], 'EGP');
  assert.ok(csv.startsWith('\ufeffid,date'));
  assert.match(csv, /"'=HYPERLINK\(""x""\), Ali"/);
  assert.match(csv, /,2,900,EGP,paid$/);
});
