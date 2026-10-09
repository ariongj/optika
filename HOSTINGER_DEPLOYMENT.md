# Hostinger deployment

The current verified deployment target is `https://optika.itdks.tech`, on Hostinger shared hosting with Apache/LiteSpeed and an existing PHP backend. Rebuild with `VITE_PUBLIC_SITE_URL=https://optika.itdks.tech` for this target. A final client-domain change requires explicit confirmation and a new canonical/sitemap build; do not assume `optikamiftari.com` is the active target.

Current upgrade: `release/optika-itdks-page-review-20261008-r22.zip`, deployed on 8 October 2026. Live verification: 53 release/hash/redirect checks (including both atelier stylesheets) and 1,500 SEO checks passed; all 100 main/product/guide routes individually opened at phone width. Examination desktop/mobile, booking selection contrast, protected staff login, product/bag and delivery-form entry were checked without submitting a live order or appointment. Evidence: `output/qa/page-review-20261008-r22/deployment-proof.json`, `live-audit.json`, `browser-acceptance.json` and `review.md`. All local integration suites and 200 unit tests passed; all CMS sections were opened in the isolated synthetic preview. Live authenticated CMS mutation and production provider/clinical launch gates remain unverified. Fresh public rollback: `output/qa/page-review-20261008-r22/rollback/optika-pre-page-review-public-20261008-r22.zip`.

Latest presentation upgrade: `release/optika-itdks-cta-20261008-r23.zip`, deployed 8 October 2026. Sans-serif titles, centered homepage collection CTA and rounded black/white buttons. Build/prerender, focused homepage/navigation/service tests, 38 local responsive route checks and 53 live release/hash/redirect checks passed. Live homepage CTA navigated to the collection; 17 additional live routes checked at 390px with no heading-font, CTA-style or overflow failures. Evidence: `output/qa/cta-20261008-r23/review.md`, `deployment-package.json`, `deployment-proof.json`, and `rollback-proof.json`. Prior r22 functional-verification boundaries remain unchanged.

## Upload the prepared package

1. In Hostinger hPanel, open **Websites > Dashboard > File Manager** for the domain.
2. Back up the current `public_html` outside the document root and verify the downloaded archive before changing files. Preserve the sibling `optika-miftari-data/`, accounts, orders and uploads.
3. Upload the exact verified upgrade ZIP outside `public_html`, then extract its contents additively into `public_html` with overwrite enabled. In Hostinger's folder-name field use `.` when extracting into the selected directory. Do not delete existing site files. The r19 ZIP is a frontend upgrade, not a fresh backend installation; its included SEO PHP files are unchanged from the live rollback copy.
4. Confirm these paths exist at the root: `public_html/index.html`, `public_html/.htaccess`, `public_html/assets/`, `public_html/api/`, and `public_html/crafted-lens/`.
5. In File Manager settings, enable hidden files if `.htaccess` is not visible.
6. In **Advanced > PHP Configuration**, use PHP 8.1 or newer and confirm the standard PHP `fileinfo` extension is enabled; image, prescription and GLB validation depends on it. Confirm PHP can create the private sibling folder `optika-miftari-data/` outside `public_html` and can write to `public_html/uploads/products/` and `public_html/uploads/models/`. Prescription documents are stored privately in `optika-miftari-data/prescriptions/`, never under a public URL. Set `upload_max_filesize` to at least `20M` and `post_max_size` to at least `22M` for GLB uploads and prescription files.
7. Enable the SSL certificate in hPanel before opening the uploaded site. The package enforces HTTPS and sends HSTS after the secure connection is active.
8. Existing staff/customer credentials are preserved. Use the separately approved private access handoff, never a credential embedded in the upload ZIP. Do **not** upload credential notes to `public_html`. Where an account is flagged for first-use rotation, the user must complete the password change before opening operational data.
9. Confirm the actual order-desk address configured through `OPTIKA_ORDER_EMAIL` and prove delivery to the staff/customer mailboxes. The PHP mail attempt is not proof of receipt. WhatsApp and the staff portal remain the disclosed fallback when mail is unavailable.
10. Clear the cache for this domain in hPanel, compare the live entry/assets with the release manifest, and rerun public-route/SEO checks.

Do not upload the `dist` folder itself as a nested directory. Upload and extract its contents.

## Rebuild after edits

```powershell
pnpm run build
```

The postbuild prerender step generates route-specific HTML in `dist`. If invoking Vite directly rather than `pnpm run build`, also run `scripts/prerender.mjs`. Use `scripts/package-division-upgrade.py --frontend-only --include-seo --name <new-release-slug> --report-dir <qa-slug>` to create and reopen an exact, secret-excluding upgrade from the build contents. Do not overwrite an existing release.

## Smoke-test after upload

- `/` presents Miftari Holding Group and the Optical, Optical Lab and clinic divisions.
- `/optical`, `/laboratory` and `/clinic` load their own pages. `/laboratory/kosovo`, `/laboratory/europe` and `/laboratory/partners` have separate market/partnership content; the EU page is English, with no invented certification claims.
- `/lens-focus` loads a lightweight lens page and survives a refresh. The supplied animation opens only on request; guided mobile controls and Escape/focus recovery must work.
- `/shop` opens the catalogue and survives a refresh.
- `/virtual-try-on` opens Live Camera, Photo and 3D Product modes. Camera access must work over HTTPS, photo analysis must stay local, manual alignment must respond, and a configured product must reach the cart.
- `/syze-dielli/vtx-x1` and `/syze-optike/nov-n04` open unique pre-rendered product pages and survive a refresh. The legacy `/products/...` addresses must redirect one-to-one with HTTP 301.
- `/wishlist`, `/about`, `/contact`, and `/lens-focus` load directly.
- `/order-status` finds a test order only when the matching order number and customer email/phone are supplied.
- `/account` allows customer registration, login, profile editing, password change and logout. Sign in with the separate test credential, change its temporary password, then place a checkout request and confirm that the order appears only in that account's history.
- `/staff` opens protected login. In an approved test environment, verify Dashboard, Products, Orders, Appointments, Clients, Content, Discounts, Analytics, image/model upload, logout and password change. Create a Draft product and confirm it is absent from `/shop`, then publish and confirm visibility. Do not create live transactional records solely for an anonymous deployment audit.
- In **Clients**, confirm registered website accounts are listed separately from the CRM customer register and that an administrator can activate or disable account access without viewing passwords.
- In an isolated test environment or a specifically authorized live test, submit one appointment and one checkout request. Test prescription PDF/JPG/PNG upload and staff-only download. Confirm server pricing, one stock reservation, ownership/inbox records and idempotent retries. Keep real email disabled for synthetic local tests.
- In Orders, test payment status, fulfilment status, tracking, a secure HTTPS payment link and cancellation. Cancellation must restore reserved stock. Pending stock reservations expire automatically after 24 hours.
- Cart and consultation handoff open a prefilled WhatsApp message without collecting card details; the server-priced operational order and stock reservation are stored first.

## Data, backup and production boundary

Catalog, CMS content, orders, appointments, customer accounts, clients, analytics and audit records are persisted in the private `optika-miftari-data/` folder created beside `public_html`, outside the public web root. Passwords are stored only as one-way hashes. Product uploads are stored in `public_html/uploads/products/`. Back up both folders before replacing site files and include them in the normal Hostinger backup schedule. If the hosting account blocks sibling-folder writes, the API falls back to the protected `public_html/api/storage/` directory.

Cart preferences stay in browser `localStorage`. Product prices, lens/coating prices, discounts, delivery fees and inventory are authoritative only on the server. Camera and selected selfie images used by Fit Studio are processed only in the visitor's browser and are not uploaded. Online PD and face-width values are estimates and must be professionally verified before lens production. This release does not collect card details. Prescription documents are accepted only through the protected upload endpoint, stored outside the public web root, attached to the corresponding order, and removed when the customer is anonymized. Customer order history is linked by the authenticated server session; an email match alone never exposes an old order. A provider-hosted HTTPS payment link can be attached to an order by staff; direct card capture, password-reset email automation, SMS automation and broader medical-record storage require separate provider configuration and a dedicated compliance review.

## Final domain and launch requirement

The current release's canonical URLs, structured data, social links and sitemap use `optika.itdks.tech`. Confirm the client's final public domain before advertising or enabling real sales. If it changes, rebuild those identities, verify SSL and the new domain, and authorize matching one-to-one redirects from the old host. Real sellable product facts, delivery/returns policies, clinical content, certificates, payment/email providers and controlled live protected workflows remain separate launch gates in the r11 handoff.

The included `.htaccess` provides the required `.wasm` and `.glb` MIME/cache rules and a `camera=(self)` permissions policy. Do not disable HTTPS: production camera APIs are unavailable on an insecure origin. Review [VIRTUAL_TRY_ON_GUIDE.md](VIRTUAL_TRY_ON_GUIDE.md) before enabling product-specific models or signing off mobile camera QA.
