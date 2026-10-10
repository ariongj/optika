# Optika Miftari — storefront + CMS

**Live demo:** https://ariongj.github.io/optika/ · CMS: https://ariongj.github.io/optika/admin

A complete, clickable web shop and back office for **Optika Miftari** (Mitrovicë, Kosovo), rebuilt on the design and
architecture of the [Selca](https://ariongj.github.io/Selca/) build: warm paper palette, serif headings with an italic accent,
pill buttons, a full-bleed hero slider and a client-side CMS. Optika's own brand photography, frames and copy are carried over,
together with the **virtual try-on** (live camera, photo and 3D, processed on the device).

- **Storefront** — home page (hero slider, categories, bestsellers, end-of-season offer with countdown, process, services,
  lookbook, FAQ, advice), catalogue with filters, product pages with lens choices (frame only / single vision / screen /
  progressive / prescription sun) and the **Kujdes+** add-on (12-month breakage cover), cart, checkout (cash on delivery, bank
  transfer, simulated card) with a prescription step, order confirmation, eye-exam booking, services, lookbook, about,
  contact, advice articles, CMS pages, search (products, pages and advice), wishlist and **Provo virtualisht**
  (`/provo-virtualisht`). Also:
  - **Rezervo termin** (`/rezervo`) — real slot booking (service → day → time → details) against the CMS opening hours and
    calendar, with an `.ics` calendar file on confirmation;
  - **Gjurmo porosinë** (`/gjurmo-porosine`) — order tracking by order number + e-mail/phone;
  - **Klinika Miftari** (`/klinika`) and **Optical Lab** (`/optical-lab`, with a B2B partner application);
  - **Udhëzuesi i lenteve** (`/lentet`) — interactive lens chooser, lens-thickness comparison, coatings and prescription
    explainer; **Gjeni kornizën tuaj** (`/gjej-kornizen`) — a five-step frame-finder quiz with shareable results.
- **CMS** (`/admin`) — dashboard, orders, draft orders, returns, products, collections, inventory, purchasing, customers and
  segments, discounts and offer campaigns, homepage builder with live preview, slides and banners, pages, advice posts, lookbook,
  menus, media, appointments (eye exams, fittings, Klinika Miftari), B2B quotes for Optical Lab, markets, analytics, settings.
- **Languages** — Albanian (default) and English on the storefront. A third slot holds Serbian (Latin) and can be switched on in
  *Konfigurimet → Gjuhët*. The CMS itself is available in all three.

Everything runs in the browser (no backend). Data is kept in `localStorage`, and open tabs stay in sync, so an order placed in the
shop appears in the CMS straight away. Each visitor's browser keeps its own copy of the demo data.

**CMS demo login** (pre-filled): `admin@optikamiftari.com` / `miftari2026`

## Run it

Requirements: Node.js 20.19+ (tested with Node 24).

```bash
npm ci
```

```bash
npm run dev -- --port 4190
```

Open http://localhost:4190 — the CMS is at http://localhost:4190/admin. The camera mode of the virtual try-on needs `localhost` or
HTTPS.

Production build (static files in `dist/`):

```bash
npm run build
```

## Deploy

Every push to `main` builds the site with `BASE_PATH=/optika/` and publishes it to GitHub Pages
(`.github/workflows/pages.yml`). After the build, `scripts/prerender-meta.mjs` writes an HTML shell for every known route
with its own title, description, social preview image (`public/og/*.jpg`), canonical URL and JSON-LD, plus `sitemap.xml`
and `robots.txt`; `dist/404.html` stays the SPA fallback. For a root deployment (Vercel, Netlify or a custom domain) build
without `BASE_PATH` and set `SITE_URL`; `vercel.json` and `public/_redirects` handle client-side routes.

## The previous PHP site

The earlier React + PHP version (Hostinger deployment with server-side accounts, orders and the staff portal) is preserved
unchanged on the [`hostinger-php`](https://github.com/ariongj/optika/tree/hostinger-php) branch.

## What is placeholder

- Prices, stock, lens packages and most product copy — based on the previous Optika catalogue; edit them in the CMS.
- Orders, customers, bookings, quotes and staff — generated demo data (fictional names, `@example.com` addresses).
- E-mail address, NUI / TVSH numbers and bank account in *Konfigurimet* — samples to be replaced.
- Card payment is simulated; no card data is collected. The second store's address is not listed.
- The try-on frames are dimensional approximations built from the catalogue measurements, not product scans; PD and fit are
  confirmed in store.

## Tech

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router 7 · Zustand · Motion · Recharts · Lucide icons · three.js and
MediaPipe Face Landmarker (try-on, loaded only on that page) · Fraunces + Manrope fonts (self-hosted).

```
src/
  App.tsx              routes (storefront + /admin; CMS and try-on are code-split)
  lib/                 types, pricing (VAT, shipping zones, discounts), formatting, search
  i18n/                typed SQ / EN / SR dictionaries
  data/                catalogue, homepage sections, pages, posts, lookbook, demo orders and CMS data
  store/               zustand stores (db = CMS data, ui = cart/lang/session) + cross-tab sync
  components/          UI kit, logo, icons
  site/                storefront layout, sections, pages, virtual try-on
  admin/               CMS layout, components, pages
public/images/         WebP photography (+ -sm thumbnails)
public/mediapipe/      face-landmark model and WASM runtime for the try-on
```
