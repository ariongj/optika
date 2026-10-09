# Optika Miftari launch acceptance audit

## Current audit — 8 October 2026

Target: https://optika.itdks.tech · CMS: https://optika.itdks.tech/staff/

Status: **CMS fixes deployed and live-verified; core functional checks passed. Not unconditional production sign-off.**

### Repaired and verified

- Product editor Cancel previously opened a blank new-product form. It now returns to the catalogue without saving, for both existing and new products.
- Products created without optional measurements previously reopened with invalid zero values, blocking subsequent saves. Unspecified measurements now reopen blank; measured products retain their values.
- The English product-name field now says Product name, not First name.
- Browser round trip with isolated synthetic data: create draft → refresh → reopen → edit → save; cancel unsaved edits; cancel new product. No live product writes were used.

### Fresh automated evidence

- All **34** local suites passed, including **198** unit tests, production build/prerender, CMS API, checkout/accounts, authoritative pricing, stock reservation/restoration, retries, ownership, discounts, B2B, appointments, credential/session controls, concurrent storage, empty catalogue, CMS SEO and all PHP syntax checks.
- CMS API exercises stock-conflict rejection, CSV preview/idempotency, product duplication, draft/publish/rollback, scheduled placements, discount reservations, role permissions and revocation. These are isolated local tests, not production mutations.
- **35** Luna PHP parser/configuration/output checks passed. A fresh public-site Albanian text-help question returned a real answer; unchecked consent initially disabled submission. No image or personal information was sent to Luna.
- Post-deployment: **1,500/1,500** live route/SEO/asset checks across **96** indexable URLs; **113/113** release checks for exact new JS bytes, current entry scripts, denied private-file URLs, anonymous protected-endpoint denial and Luna availability.
- Evidence: `output/qa/final-audit-20261008/suite-results.json`, `live-audit.json`, `live-release.json`, `release-verification.json`, `deployment-package.json`.

### Browser checks

- Live staff login; overview, product search/editor, orders, customers, offers, discounts, contacts, appointments, analytics, content/SEO, staff-role, integration, collections, inventory, banner, revision and audit screens opened. No browser errors were observed during checked paths. Staff logout returned to protected login.
- Live customer login loaded the existing test account's order history; logout succeeded. No profile, order or appointment was changed.
- Phone homepage/menu/search/quick view/cart/delivery validation and account view checked at 390px. Synthetic CMS editor checked at 320px and desktop; no document-level horizontal overflow observed. CMS tables have their own horizontal scrolling.
- Live 3D mode rendered; photo input accepted a non-face test image, reported Face not found, and manual size/reset controls responded. The temporary image and added bag item were removed after testing.
- After deployment, the corrected Product name label and Cancel behavior were exercised again on the live CMS without saving a record.

### Release and recovery

- Additive upgrade: `release/optika-itdks-cms-audit-20261008-r19.zip` — 236 files, 19,572,922 bytes.
- SHA-256: `4cbbadd2de8dbed35ee2832e445e9005a0b83909e000f161928ecd8507cb6386`.
- Compared against a fresh hosting archive: only 102 HTML/template files and five newly hashed JS assets differ. Included public SEO PHP files are byte-identical. No private data, credentials, uploaded files or API behavior changed. Old hashed assets were retained for already-open sessions.
- Fresh public_html rollback archive: `output/qa/final-audit-20261008/rollback/optika-pre-cms-audit-public-20261008-r19.zip` — 66,452,280 bytes, 453 entries, CRC verified, SHA-256 `cfe14bf2ac5306c4d41e2c453dfb9bf4551e60e670db97739fe3855301c35fd7`.
- A matching backup and release ZIP remain outside public_html on hosting. Restore the public archive's contents to public_html and clear cache if rollback is necessary. This is a frontend rollback, not a new full business-data backup; private data and Luna configuration were not touched.

### Not verified / external dependencies

- Real payment-provider capture and inbox email delivery. CMS accurately labels their configuration/delivery limits; courier sync and automated SMS/WhatsApp are not connected.
- Physical iPhone/Android camera permission, live face tracking, successful portrait tracking and optical measurement accuracy. The no-face photo fallback and 3D UI checks do not prove these capabilities.
- New live orders, appointments, CMS publication, uploads or account mutations: intentionally tested only in isolated local storage to avoid client-side effects.
- Client approval of real catalogue specifications/images, clinical copy, final domain, policies and commercial delivery terms. Current campaign/product visuals include disclosed illustrative images.
- The CMS has partially translated English copy; Albanian operational labels remain on some English screens. This audit repaired the misleading product-name label, not the entire CMS translation catalogue.

The OpenAI credential-safety workflow preserved the already approved key and model. No new key was created or exposed. No claim of full production readiness or client acceptance is made.

## Historical audit — superseded

The following August record is retained for history only. Its counts, domain and staff-role statements are not the current release status; use the October evidence above.

Audit date: 14 August 2026  
Scope: local production build, generated Hostinger package, public website, customer accounts, checkout, Operations portal, storage lifecycle and security controls.

## Verified

- Production build: 15 primary pages, 40 product pages and 40 Lens Focus article pages generated successfully.
- PHP APIs: all 10 endpoint files pass syntax validation.
- Static release: 97 HTML files, 167 packaged files, 2,364 internal references, 97 unique page titles and zero missing references.
- Catalogue integrity: 40 variants across 12 base products, 12 unique base images and no repeated base-product image.
- Sitemap: 91 unique permanent-domain URLs, including all 40 products and all 40 Lens Focus articles; no missing, duplicate or foreign URLs.
- Customer accounts: seed login, first-password change, registration, profile update, logout, private order history, authenticated order ownership and cross-account isolation pass.
- Checkout: authoritative server pricing, stock reservation, idempotent retries, account ownership, guest checkout, customer/CRM record creation and inventory restoration pass.
- Operations portal: login, required first-password change, authenticated snapshot, Draft/Published/Archived product states, publication, multi-page CMS content, appointments, orders, customer-account access controls and relogin pass.
- Background lifecycle: expired Pending reservations are cancelled when the public catalogue, order-status endpoint or Operations snapshot is next requested; reserved stock and active-request value are restored before the response is returned.
- Uploads: authenticated JPG/PNG/WEBP product upload, validated glTF 2.0 GLB upload, private PDF/JPG/PNG prescription upload and authenticated prescription download pass with PHP `fileinfo` enabled.
- Security: anonymous admin access, invalid CSRF, weak customer passwords, cross-origin writes, anonymous product/model upload, anonymous prescription download and mismatched order contacts are rejected.
- Analytics: first-party events persist and the server limits stored history.
- Browser layout: landing page, shop, quick view, cart, delivery step, Lens Focus, Virtual Try-On, customer account and administrator login were checked at desktop and compact mobile widths without horizontal overflow.
- Virtual Try-On: the left-to-right flow is Camera, Photo, Product in 3D; the default product view is straight and centered, with rotation, zoom, reset and snapshot controls present.
- Original logo: remains visible in the public header, customer surfaces and Operations portal.

## Production-host checks still required

These depend on Hostinger or a physical customer device and cannot be truthfully completed in the local workspace:

- Domain connection, permanent HTTPS redirect, SSL certificate and HSTS response on `optikamiftari.com`.
- Hostinger PHP write permissions for the private sibling data folder and public product/model upload folders.
- Hostinger PHP `fileinfo` extension and 20 MB/22 MB upload limits.
- Real email delivery from the configured order mailbox, including spam-folder and sender-policy checks.
- Camera permission and face tracking on representative iPhone Safari and Android Chrome devices over HTTPS.
- Lens Focus scroll smoothness on representative physical mobile devices.
- Provider-hosted payment-link handoff using the client's final payment provider.

Automated password-reset email, direct card capture, SMS automation and multi-user staff roles are not part of this release and require separate provider/infrastructure work.

## Acceptance result

Local application and package: **verified**.  
Live launch state: **blocked until the production-host checks above are completed after upload**.
