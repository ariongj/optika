# Optika Miftari Operations Guide

## Access and security

Open `https://optika.itdks.tech/staff/` and sign in with the existing administrator credentials from the separate private access handoff. No credentials are changed by the r19 upgrade. The portal uses server sessions and CSRF validation; it does not unlock from a browser-only code. Where first-use rotation is required, the user must replace the temporary password with a password of at least 12 characters before opening operational data. Five failed login attempts trigger a 15-minute lock and inactive sessions expire after eight hours. See [the current acceptance audit](LAUNCH_ACCEPTANCE_AUDIT.md) for local versus live verification and remaining launch dependencies.

## Products

`Products` creates, edits and removes catalog products. It manages regular and sale price, stock, type, collection, material, sizing, prescription compatibility, description and validated image/GLB uploads. Use **Draft** while preparing an item, **Published** to show it in the storefront, and **Archived** to retain it only in management. The Virtual Try-On section controls real dimensions, product activation, model scale, vertical offset and X/Y/Z rotation. Its first/default preview is the straight front view; check the angled and profile views before publishing.

## Orders And Customers

`Orders` receives checkout requests from the public website. The server recalculates every price, validates the discount and shipping method, checks stock and reserves inventory for 24 hours. Orders move through Pending, Confirmed, In lab, Ready, Completed, Return requested, Returned or Cancelled. Cancelling a reserved order restores stock automatically.

Payment and fulfilment are tracked independently. Staff can mark Awaiting payment, Partially paid, Paid or Refunded; update fulfilment from Unfulfilled through Delivered; add a tracking number; attach a provider-hosted HTTPS payment link; and keep a private staff note. Important status changes attempt an email notification when Hostinger mail is available.

`Appointments` receives booking, enquiry and order submissions. `Clients` contains two connected views: registered website accounts and the CRM register created from real orders. Account access can be set to Active or Disabled; password hashes are never exposed in the portal. The CRM register separates active request value from completed spend. The delete action anonymises contact data in the client record, related order records and submissions, and removes a matching login account while preserving non-identifying financial history.

## Customer accounts

Customers use `/account` to register, sign in, update their contact details, change their password and review orders owned by that account. Checkout remains available to guests. When a customer is signed in, checkout prefills the account contact details and the server links the new order to the authenticated account ID. Historical guest orders are not attached merely because an email address matches, which prevents an unverified account from claiming another person's order.

The separate access note includes one test customer. Change its temporary password on the first test, and disable the account in **Clients** before the public launch.

## Checkout

The checkout covers bag review, server-scoped discount codes, regional delivery details, Kosovo as the default market and optical confirmation. It creates the server-priced order, inventory reservation, customer and inbox record before opening WhatsApp. Customers can review payment, fulfilment and tracking at `/order-status`. Card details are not requested or stored by this site.

`Discounts` manages typed product/order, buy-X-get-Y and delivery rules, with eligibility, dates and a sample-cart preview. Final discounts are calculated by the server. The legacy-code action still manages earlier codes such as `15%` or `Free`; inactive codes are never accepted by server pricing.

## Website content and media

`Content` manages the group homepage, Optical, Optical Lab, clinic, Kosovo/Europe market pages, partnership page and existing catalogue/service pages, including the supported copy and page artwork fields. Product content, prices, stock and images are managed under `Products`. Image uploads accept JPG, PNG and WEBP up to 5 MB; Virtual Try-On models accept validated glTF 2.0 GLB files up to 20 MB. A procedural fallback is not a real product scan: prepare and calibrate an actual GLB before claiming product-realistic AR.

For model preparation, mesh naming, privacy, browser support, calibration and launch limitations, follow [VIRTUAL_TRY_ON_GUIDE.md](VIRTUAL_TRY_ON_GUIDE.md).

## Analytics and operations

`Analytics` shows first-party page views and actions without storing raw visitor IP addresses. Dashboard metrics use the live orders, stock and submissions in server storage. `Settings` changes the administrator password and shows the active security controls.

## Backup and boundaries

Back up the private `optika-miftari-data/` folder beside `public_html` and `public_html/uploads/` through Hostinger before changes that affect operational data. This release does not store card data or selfie images; prescription files are stored privately outside the public web root. Keep backups private. Provider-hosted secure payment links and Hostinger PHP mail are supported, but direct gateway capture, automated password-reset email and SMS need separate provider setup and verification.

`Settings > Staff & roles` provides separate staff access and module permissions. Disabling a staff account revokes its access. Owner-only staff management and role-limited catalogue/content access are covered by isolated API tests; never share owner credentials as a substitute for scoped staff access.

In the product editor, Cancel returns to the catalogue without saving. Optional measurements can remain blank while preparing a draft; do not invent measurements. Enter and professionally verify real dimensions before relying on a product's try-on representation.
