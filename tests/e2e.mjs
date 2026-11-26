// Real-browser click-through. Usage: node tests/e2e.mjs <url> [screenshot-dir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const URL_ = process.argv[2] || 'http://localhost:8099/';
const SHOTS = process.argv[3] || '';
const PORT = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${PORT}`, '--window-size=390,844', '--user-data-dir=/tmp/e2e-' + PORT, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); break; }
    } catch (e) {}
    await sleep(200);
  }
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map(a => a.value || a.description).join(' '));
  };
}
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error('eval failed: ' + expr + ' :: ' + JSON.stringify(r.result.exceptionDetails.exception?.description));
  return r.result.result.value;
}
async function until(expr, label, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (await ev(expr)) return; } catch (e) {} await sleep(100); }
  throw new Error('timeout waiting for: ' + label);
}
let passed = 0;
const ok = (c, label) => { if (!c) throw new Error('FAIL: ' + label); passed++; console.log('  ok -', label); };
const click = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const setVal = (sel, v, evt = 'input') => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event(${JSON.stringify(evt)},{bubbles:true}));})()`);
const shot = async name => { if (!SHOTS) return; await ev(`document.querySelector('#toast').style.display='none'`); await sleep(100); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const go = async hash => { await ev(`location.hash=${JSON.stringify(hash)}`); await sleep(150); };

try {
  await connect();
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: URL_ });
  await until(`document.querySelector('#view h1')`, 'first render', 15000);
  await ev(`localStorage.clear()`);
  await send('Page.navigate', { url: URL_ });
  await until(`document.querySelector('#view h1')`, 'render after clear', 15000);
  console.log('Running on', URL_);

  console.log('Arabic default and RTL');
  ok(await ev(`document.documentElement.dir`) === 'rtl', 'dir is rtl');
  ok((await ev(`document.querySelector('#view h1').textContent`)) === 'شمسة', 'Arabic brand name');
  ok(await ev(`document.documentElement.scrollWidth <= window.innerWidth`), 'no horizontal overflow at 390px');
  await shot('01-lookbook-ar');

  console.log('Switch language');
  await click('[data-act=lang]');
  ok(await ev(`document.documentElement.dir`) === 'ltr', 'dir is ltr in English');
  ok((await ev(`document.querySelector('#view h1').textContent`)) === 'Shamsa', 'English brand name');
  await shot('02-lookbook-en');

  console.log('Lookbook filter and product sheet');
  const before = await ev(`document.querySelectorAll('.card').length`);
  await click('[data-cat=bottoms]');
  ok(await ev(`document.querySelectorAll('.card').length`) < before, 'category filter narrows grid');
  await click('[data-cat=all]');
  await click('[data-act=open][data-id=p1]');
  await until(`!document.querySelector('#sheet').hidden`, 'sheet open');
  await click('[data-act=size][data-v=L]');
  await click('[data-act=color][data-v=Ink]');
  await click('[data-act=sq][data-d="1"]');
  await sleep(450);
  await shot('03-product');
  ok((await ev(`document.querySelector('#sheet [data-act=share]').href`)).startsWith('https://wa.me/?text='), 'share link built');
  await ev(`document.querySelector('#sheet [data-act=closesheet].close').click()`);
  ok(await ev(`document.activeElement.getAttribute('data-id')`) === 'p1', 'focus returns to the card after closing');
  await click('[data-act=open][data-id=p1]');
  await click('[data-act=size][data-v=L]');
  await click('[data-act=color][data-v=Ink]');
  await click('[data-act=sq][data-d="1"]');
  await click('[data-act=addbag]');
  ok(await ev(`document.querySelector('#sheet').hidden`), 'sheet closes after add');
  ok(await ev(`JSON.parse(localStorage.getItem('brand.v1')).cart[0].qty`) === 2, 'cart persisted in localStorage with qty 2');
  ok(await ev(`JSON.parse(localStorage.getItem('brand.v1')).cart[0].size`) === 'L', 'size L stored');

  console.log('Drop locking');
  await go('#/drop');
  ok(await ev(`!!document.querySelector('[data-cd=s]')`), 'countdown tiles render');
  const s1 = await ev(`document.querySelector('[data-cd=s]').textContent`);
  await sleep(1300);
  ok(s1 !== await ev(`document.querySelector('[data-cd=s]').textContent`), 'countdown ticks every second');
  await shot('04-drop');
  await click('[data-act=open][data-id=p4]');
  ok(await ev(`document.querySelector('#sheet .btn').disabled`), 'drop item cannot be added before the drop');
  await click('[data-act=closesheet]');

  console.log('Checkout via WhatsApp');
  await go('#/bag');
  ok(await ev(`document.querySelectorAll('.line').length`) === 1, 'bag shows one line');
  ok((await ev(`document.querySelector('#total').textContent`)).includes('900'), 'total is 900');
  await ev(`window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null;}`);
  await click('#checkout button[type=submit]');
  ok(await ev(`!!document.querySelector('.f.err')`), 'empty form shows validation errors');
  ok(await ev(`window.__opened.length`) === 0, 'nothing opened while invalid');
  await setVal('input[name=name]', 'Sara Ali'); await setVal('input[name=phone]', '01112223344'); await setVal('input[name=address]', '12 Smouha St, Alexandria'); await setVal('input[name=notes]', 'Call before');
  await shot('05-bag');
  await click('#checkout button[type=submit]');
  const link = await ev(`window.__opened[0]`);
  ok(link && link.startsWith('https://wa.me/201000000000?text='), 'opens wa.me link with normalised shop number');
  const msg = decodeURIComponent(link.split('text=')[1]);
  ok(/2 x Boxy Tee \(L, Ink\)/.test(msg) && /Total: 900/.test(msg) && /Sara Ali/.test(msg) && /Call before/.test(msg), 'message has item, total, customer');
  ok(await ev(`JSON.parse(localStorage.getItem('brand.v1')).cart.length`) === 0, 'cart cleared after order');
  ok((await ev(`document.querySelector('.done a.wa').href`)).startsWith('https://wa.me/201000000000'), 'confirmation page keeps a re-open WhatsApp link');
  await go('#/orders');
  ok((await ev(`document.querySelector('.olist').textContent`)).includes('B1001'), 'order logged as B1001');
  await setVal('.olist select', 'paid', 'change');
  ok(await ev(`JSON.parse(localStorage.getItem('brand.v1')).orders[0].status`) === 'paid', 'order status can be changed');

  ok(await ev(`!!document.querySelector('[data-act=csv]')`), 'orders CSV button present');
  console.log('Settings: white-label editing');
  await go('#/settings');
  await setVal('[data-set="brand.name.en"]', 'Nile Wear');
  await setVal('[data-set="brand.monogram"]', 'N');
  await ev(`document.querySelector('details.sec:nth-of-type(2)').open=true`);
  await setVal('[data-set="brand.currency.symbol"]', '$');
  await setVal('[data-set="brand.currency.position"]', 'before', 'input');
  await setVal('[data-set="brand.whatsapp"]', '0100 555 6677');
  await click('[data-act=palette][data-i="1"]');
  ok(await ev(`getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`) === '#14161c', 'palette changes theme colours');
  ok(await ev(`document.querySelector('.bname').textContent`) === 'Nile Wear', 'header shows new brand name');
  await sleep(400);
  await shot('06-settings');
  await go('#/');
  ok((await ev(`document.querySelector('.pp').textContent`)).startsWith('$'), 'currency symbol before price');
  ok(await ev(`document.querySelector('.header .logo svg text').textContent==='N'`), 'logo uses new letter');

  console.log('Settings: add product, edit drop date');
  await go('#/settings');
  await ev(`document.querySelectorAll('details.sec')[3].open=true`);
  await click('[data-act=addp]');
  await setVal('#pform [name="name.en"]', 'Test Scarf'); await setVal('#pform [name=price]', '123.5');
  await setVal('#pform [name=sizes]', 'One size'); await setVal('#pform [name=colors]', 'Red:#ff0000, Blue:#0000ff');
  await click('#pform button[type=submit]');
  ok(await ev(`JSON.parse(localStorage.getItem('brand.v1')).products.some(p=>p.name.en==='Test Scarf'&&p.price===123.5&&p.colors.length===2)`), 'new product saved');
  await ev(`document.querySelectorAll('details.sec')[2].open=true`);
  await setVal('[data-set="drop.at"]', '2020-01-01T10:00');
  await go('#/drop');
  ok(await ev(`!!document.querySelector('.live-banner')`), 'past drop date shows live banner');
  await go('#/');
  ok(await ev(`document.querySelectorAll('.card').length`) === 7, 'lookbook shows all 7 products once the drop is live');
  ok(await ev(`!!document.querySelector('[data-id=p4]')`), 'drop products appear in lookbook once live');
  await click('[data-act=open][data-id=p4]');
  ok(await ev(`!document.querySelector('#sheet .btn').disabled`), 'drop item orderable after the drop');
  await click('[data-act=closesheet]');

  console.log('Export and import');
  const kit = await ev(`BrandLib.exportKit(window.__brand.state)`);
  ok(JSON.parse(kit).brand.name.en === 'Nile Wear' && !('cart' in JSON.parse(kit)), 'kit export has branding, no cart');
  await ev(`localStorage.clear()`);
  await go('#/settings'); await send('Page.reload');
  await until(`document.querySelector('#importfile')`, 'settings after reload', 10000);
  ok((await ev(`document.querySelector('.bname').textContent`)) === 'شمسة', 'cleared storage returns to demo brand');
  await ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(kit)}],'kit.json'));const i=document.querySelector('#importfile');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(`document.querySelector('.bname').textContent==='Nile Wear'`, 'import applied');
  ok(await ev(`window.__brand.state.products.some(p=>p.name.en==='Test Scarf')`), 'imported products restored');
  await ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File(['not json'],'bad.json'));const i=document.querySelector('#importfile');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(300);
  ok(await ev(`window.__brand.state.brand.name.en`) === 'Nile Wear', 'bad file leaves data unchanged');

  console.log('Arabic editor');
  await click('[data-act=lang]'); await go('#/settings');
  ok(await ev(`document.documentElement.dir`) === 'rtl', 'back to rtl');
  await ev(`document.querySelectorAll('details.sec')[3].open=true`);
  await click('[data-act=editp][data-id=p2]'); await sleep(450);
  ok(await ev(`document.documentElement.scrollWidth <= window.innerWidth`), 'editor has no horizontal overflow');
  await shot('07-editor-ar');
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
  ok(await ev(`document.querySelector('#editor').hidden`), 'Escape closes the editor');
  ok(errors.length === 0, 'no JS errors (' + errors.join(' | ') + ')');
  console.log(`\nE2E PASS: ${passed} checks`);
} catch (e) {
  console.error('\nE2E FAIL:', e.message, errors.length ? '\nJS errors: ' + errors.join(' | ') : '');
  process.exitCode = 1;
} finally { try { ws.close(); } catch (e) {} chrome.kill(); }
