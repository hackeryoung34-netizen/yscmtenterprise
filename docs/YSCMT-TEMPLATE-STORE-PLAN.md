# YSCMT Template Store — Implementation Plan

## Project goal

Add a digital template marketplace to the YSCMT Enterprise website at `https://yscmtenterprise.ng/` without replacing, deleting, or destabilizing the existing corporate homepage.

The store will support two purchase paths:

1. **Download** — a customer pays for a template and receives a protected ZIP/source-code download.
2. **Professional installation** — a customer pays for the template and YSCMT installs/configures it for them.

## Repository baseline

- Repository: `hackeryoung34-netizen/yscmtenterprise`
- Existing production branch: `main`
- Existing homepage: root `index.html` (large, self-contained HTML/CSS/JS page).
- The homepage must remain unchanged during store development.
- Work is isolated on `feature/yscmt-template-store`.
- No production deployment, DNS change, payment activation, or live homepage edit is part of this phase.

## Store categories

- Business Websites
- E-commerce
- Portfolio
- School & LMS
- Blog & News
- Admin Dashboard

## Customer-facing requirements

- Store landing page with category navigation, search, and filters.
- Template cards with screenshots, title, short description, price, and demo link.
- Product detail page with screenshots, live demo, supported technologies, version, license, update history, and separate download/installation prices.
- Customer registration, sign-in, profile, and order history.
- Clear checkout summary and payment status.
- Download access only after server-side payment verification.
- Installation request form and progress/status tracking.

## Admin requirements

- Secure admin authentication and role checks.
- Create, edit, publish, archive, and categorize templates.
- Manage screenshots, demo URLs, supported technologies, versions, licenses, and prices.
- Review orders and payment references.
- Grant/revoke time-limited or entitlement-based download access.
- Manage installation requests, assign work, update progress, and record completion.
- Audit log for sensitive administrative actions.

## Proposed technical architecture

The current homepage is static HTML, so it must not be trusted to validate payments or expose downloadable source archives.

Use a separate application/API for the store:
- **Frontend:** store UI served under a dedicated path such as `/templates/` or a dedicated subdomain, subject to the actual hosting configuration.
- **Backend:** server-side API for catalog, accounts, orders, payment verification, download entitlements, and installation jobs.
- **Database:** relational database for products, users, orders, payments, downloads, and installation records.
- **File storage:** private object/file storage for ZIP packages; never place paid archives in a public static directory.
- **Payments:** choose and integrate a Nigeria-compatible provider only after account/merchant eligibility and webhook verification are confirmed.

Django + Django REST Framework is a candidate because it is already used in other YSCMT projects, but the final choice must follow a review of the hosting target, existing repository setup, and operational costs. Do not assume a backend or database is already deployed.

## Security and operational requirements

- Verify payment status on the server using provider APIs/webhooks; never trust a browser success redirect.
- Make webhook handling idempotent and validate signatures.
- Authorize every order, download, and installation request server-side.
- Use expiring or signed download links and log download events.
- Store secrets only in server environment variables; never commit API keys.
- Apply rate limits, input validation, secure password handling, backups, and audit logging.
- Sell only templates owned by YSCMT or covered by explicit redistribution/resale rights.
- Define license terms before launch.

## Delivery phases

1. **Repository and hosting audit** — inspect the existing site, deployment source, DNS/routing, and available backend hosting.
2. **Store foundation** — create isolated frontend/backend structure and database schema.
3. **Catalog and product pages** — categories, product metadata, images, and demos.
4. **Customer accounts and orders** — authentication, cart/checkout records, and order history.
5. **Payment integration** — provider selection, server verification, and webhooks.
6. **Protected downloads** — private storage and entitlement checks.
7. **Installation workflow** — customer request, admin queue, progress, and completion.
8. **Testing and launch** — security, payment, download, mobile, backup, and rollback tests before production release.

## Current status

- [x] Confirmed the existing corporate homepage is in root `index.html`.
- [x] Created isolated working branch `feature/yscmt-template-store` from `main`.
- [x] Recorded this implementation plan.
- [ ] Confirm the current production hosting/deployment configuration.
- [ ] Confirm whether an existing VPS/backend host is available for the store API.
- [ ] Select the final frontend/backend/database and payment provider after the audit.

## Change-control rule

Do not modify `main`, the live homepage, DNS, payment settings, or production deployment as part of this isolated development work. Any production release must be reviewed and explicitly approved first.
