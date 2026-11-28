const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/lib.js');
const theme = require('../assets/kit-theme.js');

test('demo and old placeholder cannot open the merchant checkout', () => {
  const s = L.defaultState();
  s.brand.whatsapp = '+١٢٠٢٥٥٥٠١٠٠'; // reserved fictional US number
  assert.equal(L.shopPhone(s), '');
  s.demo = false;
  assert.equal(L.shopPhone(s), '12025550100');
  s.brand.whatsapp = ['20', '1', '0'.repeat(9)].join('');
  assert.equal(L.shopPhone(s), '');
  assert.equal(L.waLink('1a2b3', '1', 'invalid'), '');
});

test('cart variant keys cannot alias and edited variants become blocked', () => {
  const s = L.defaultState();
  const p = s.products[0];
  p.sizes = ['A|B', 'A'];
  p.colors = [{ name: 'C' }, { name: 'B|C' }];
  s.cart = L.addToCart([], { pid: p.id, size: 'A|B', color: 'C' });
  s.cart = L.addToCart(s.cart, { pid: p.id, size: 'A', color: 'B|C' });
  assert.equal(s.cart.length, 2);
  p.sizes = ['A'];
  assert.deepEqual(L.cartLines(s).map(x => x.blocked), [true, false]);
  assert.equal(L.cartTotal(s), p.price);
});

test('imports retain explicit demo choice, default old files to demo and reject unknown versions', () => {
  const s = L.defaultState();
  s.demo = false;
  assert.equal(L.parseImport(L.exportKit(s)).state.demo, false);
  delete s.demo;
  assert.equal(L.parseImport(JSON.stringify(s)).state.demo, true);
  assert.equal(L.parseImport(JSON.stringify({ ...s, v: 99 })).error, 'version');
  assert.equal(L.parseImport(JSON.stringify({ ...s, kind: 'other' })).error, 'kind');
});

test('retained order IDs advance from the highest valid number, not log length', () => {
  assert.equal(L.nextOrderId([{ id: 'B2499' }, { id: 'B1003' }, { id: 'n/a' }]), 'B2500');
});

test('shared colour adapter picks at least 4.5:1 for theme text pairs', () => {
  for (const dark of [false, true]) {
    const result = theme.palette({ paper: '#777777', ink: '#888888', accent: '#777777' }, dark);
    assert.ok(theme.contrast(result.ink, result.paper) >= 4.5);
    assert.ok(theme.contrast(result.onAccent, result.accent) >= 4.5);
  }
});
