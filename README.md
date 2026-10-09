# Optika Miftari

React/Vite storefront and PHP commerce/CMS for Optika Miftari.

**Live website:** https://optika.itdks.tech/

This repository contains the source of the published storefront, including sans-serif headings, centered homepage collection CTA, and rounded black/white action buttons. GitHub hosts the source; the working site remains on its existing PHP-capable hosting. GitHub Pages alone cannot run the CMS, accounts, checkout, appointments or other PHP endpoints.

## Development

Use Node.js 22+ and pnpm. Install dependencies with the committed lockfile:

```sh
pnpm install --frozen-lockfile
pnpm run dev --port 4190 --strictPort
```

Port 4190 is the assigned Optika local port. The Vite development server previews the frontend, not the PHP workflows. Do not use another project's occupied port.

Copy `.env.example` to `.env.local` before building, or set `VITE_PUBLIC_SITE_URL=https://optika.itdks.tech` in the build environment:

```sh
pnpm run build
```

The postbuild generates initial HTML for the public pages, products and guides. Preview output with `pnpm run preview --port 4190 --strictPort`; full commerce testing requires PHP and isolated test storage.

## Hosting and private configuration

Deploy the contents of `dist/` to the existing Hostinger `public_html`, preserving operational APIs, uploads and sibling private storage. See [deployment instructions](HOSTINGER_DEPLOYMENT.md), [operations guide](ADMIN_GUIDE.md), and [virtual try-on guide](VIRTUAL_TRY_ON_GUIDE.md). Historical evidence paths in these documents refer to private local QA artifacts, which are deliberately not published here.

This is a source publication of an existing installation, not an automatically configured fresh backend. Credentials, provider keys, customer records, health/prescription data, catalogue runtime state, uploaded files, recovery archives, generated release ZIPs and local Git history are excluded. Configure staff credentials and backend storage securely outside the public web root; never commit them. Existing live accounts and orders are not changed by this publication.

The public source contains illustrative catalogue/campaign material. Real product content, payment/email delivery, clinical approvals and protected production workflows require their own verification. A live page or successful build does not constitute production-readiness sign-off.

## Checks

```sh
node --test scripts/*.test.mjs
```

Some integration and historical release-verification scripts require PHP, isolated fixtures or private local QA artifacts; inspect their setup before running them. Never point synthetic write tests at production.
