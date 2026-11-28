# Brand · كتالوج الملابس

A static, white-label lookbook for clothing shops: bilingual product cards, size and colour selection, a release countdown, a bag and a WhatsApp draft. Arabic RTL and English LTR; no runtime dependencies, no hosting account needed to preview, and no payment gateway.

<div lang="ar" dir="rtl">كتالوج للملابس بالعربية والإنجليزية. جهّز حقيبة الطلب ثم افتح مسودة في واتساب. يتم إرسال الرسالة يدويًا، وتأكيد الطلب عند رد المتجر.</div>

<img src="assets/yk-logo.svg" width="24" height="24" alt=""> **By Yousef Khames · من تطوير يوسف خميس**

## Preview and test

```sh
python3 -m http.server 8099 --bind 127.0.0.1
npm test
node tests/e2e.mjs http://127.0.0.1:8099/
```

Open `http://127.0.0.1:8099/` from the repository root. Unit tests run on Node 22+ without an npm install. The browser suite expects `google-chrome` on `PATH`. It intercepts the checkout link in the browser; no message or order is sent. The app shell works offline after the first successful visit over localhost or HTTPS. The WhatsApp hand-off requires a connection.

**Screenshot placeholder:** Add screenshots of the Arabic lookbook and English settings view from this version, with synthetic catalog items only. Prior screenshots may still be present under `docs/`.

## Rebrand for a shop

1. In **Settings → Brand**, set Arabic and English names, about copy, a logo or monogram and colours. Configure the catalog, currency and drop. The sample catalog shows fictional items and sample prices; replace them before taking orders.
2. Enter the public shop WhatsApp number in international format or give a local number and country code. Leave **Demo catalog** on until the catalog, prices and destination are ready. Turn it off when you are ready to test the real store flow. Old files with no explicit choice default to demo; a legacy factory placeholder stays blocked even with demo off.
3. Export a **brand kit** (branding, demo flag, drop and products only). A **full backup** additionally contains the local cart and order log; store it privately. Importing a brand kit resets the cart and retains local orders. A full backup replaces both after confirmation when local orders or a cart exist. Older unlabelled imports are treated as backups. Export before any destructive action.
4. For static rebranding, edit `assets/kit-theme.js` (`name`, optional `logo`, `accent`, `mode`, `light` and `dark`) and load the kit in a fresh browser profile. `index.html` loads the script before app code and the service worker caches it. Use a local relative asset for `logo`; uploaded images override it, and the logo credit remains separate. Settings changed locally do **not** become public. For public visitors to see a custom product list, a maintainer must replace catalog defaults in `js/lib.js`; importing to a seller device only changes that device. No publishing is part of this change.

## Honest limits

- Free static hosting and device-local data: no stock synchronisation, staff accounts, automatic sending, tax or shipping calculation, or checkout payment integration. A paid/delivered status is an owner annotation, not a provider event.
- The order log records a prepared message, not proof of a WhatsApp send, receipt, payment, or delivery. Stale variants must be removed before preparing a draft. The countdown uses the device clock.
- Checkout contact details are not saved as a reusable browser profile by this revision. The local order log still retains the entered name and a summary; exports can contain that information. Use a shop device, clear or back up the log intentionally, and do not share backup files publicly.
- Invalid or explicitly unsupported stored state is left untouched until you reset it on purpose. The UI can temporarily load sample defaults. Clearing browser site data erases local edits.
- The design includes checked palette pairs, keyboard focus and RTL tests; it has not been certified against every WCAG requirement or tested on real mobile hardware in this review.

## License

MIT, copyright Yousef Khames. See `LICENSE`.
