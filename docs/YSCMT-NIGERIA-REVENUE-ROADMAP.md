# YSCMT Enterprise — Nigeria Revenue Expansion Roadmap

## Objective

Add sustainable revenue streams for the Nigerian market to the existing YSCMT Enterprise website without removing, replacing, or destabilizing any current feature.

Primary market: Nigeria  
Currency: NGN (₦)  
Initial payment provider: Paystack, subject to merchant activation and successful end-to-end testing.

## Non-negotiable change-control rules

- Keep `main` and the production website unchanged during development.
- All new work is isolated on `feature/revenue-monetization-2026`.
- Do not delete or overwrite existing homepage content, student-related sections, digital services, store pages, live chat, voice/video calling, API routes, database tables, or storage objects.
- Add new pages, APIs, database objects, and policies only. Any unavoidable edit to an existing file must be reviewed as a minimal additive diff and must preserve all existing behavior.
- Do not run destructive SQL, reset a database, change DNS, change production environment variables, activate live payments, or deploy to production without explicit approval.
- Keep all secrets server-side. Never commit payment keys, Supabase service-role keys, or customer data.
- Create and verify a backup/rollback point before any production change.

## Audit findings (2026-11-19)

### Repository

- Repository: `hackeryoung34-netizen/yscmtenterprise`
- Production branch: `main`
- Existing homepage: root `index.html`
- Existing API includes Paystack checkout, server-side transaction verification, webhook signature validation, catalog, orders, downloads, installation requests, and admin product management.
- Existing template store pages are under `/templates/`.
- Existing live chat and voice/video call code is present and must be preserved.
- An older revenue branch was found to have diverged substantially from `main`; it must not be merged into this work.

### Existing template-store payment foundation

- Supabase project: `YSCMT-Template-Store` (dedicated project; do not reuse other YSCMT projects).
- Existing store currency constraint is NGN.
- Existing Paystack code verifies successful transactions on the server, checks reference, amount, currency and order metadata, and processes signed webhooks.
- One published template product was found at the time of audit; one order was pending and none was recorded as paid. This is a point-in-time database observation, not proof of a successful live customer checkout.
- Paystack merchant activation, production environment configuration, webhook configuration and full end-to-end live checkout readiness still need confirmation.
- Do not reuse `store_orders` for business listings or job advertisements: that table is tied to `store_products`. New revenue products need separate order/entitlement records and separately authorized server-side payment confirmation.

### Existing security observations

The Supabase security advisor reported:
- RLS enabled without policies on `store_chat_calls` and `store_chat_call_events`.
- Leaked-password protection disabled.

These are pre-existing findings. Do not silently change existing chat/call policies during the revenue project. Assess the call API's server-side access model and address the findings in a separately reviewed security task. Enable leaked-password protection only after reviewing the auth impact and obtaining approval.

## Initial revenue products

Build the following as additive, separately testable services:

### 1. Business Directory

- Public directory of Nigerian businesses and service providers.
- Business profile: name, category, description, state/city, contact channels, website/social links, logo and images.
- Free basic listing to seed useful directory content.
- Paid featured placement / verified profile as optional upgrades.
- Suggested starting price for review only: featured listing ₦5,000 per 30 days.
- Business owner must control or verify their listing; provide report and moderation controls.
- Clearly label paid/featured listings.

### 2. Job Advertisement Board

- Public job listings with role, employer, location, type, salary range (optional), deadline and application method.
- Employer submission and admin moderation before publication.
- Suggested starting prices for review only: standard listing ₦3,000; featured listing ₦7,000.
- Do not promise employment or collect applicant fees.
- Protect applicant contact details and avoid exposing private CVs publicly.

### 3. Digital Services Lead & Quote Workflow

- Keep the existing Digital Services section and existing contact flow intact.
- Add a dedicated request/quote workflow as a new page or endpoint, not a replacement.
- Services may include design, IT support, cybersecurity consultation, software support, social media services and related work that YSCMT can actually deliver.
- Pricing should be quoted after scope review rather than promising fixed prices for unknown work.
- Record customer consent and contact preferences; prevent spam with validation and rate limits.

## Later expansion (not part of first release)

- Marketplace for service providers with referral/commission model.
- Business advertising placements and sponsorship packages.
- Affiliate links to legitimate products/software.
- Paid Voice/Video calling plans only after call quality, usage costs, support and abuse controls are measured.
- Morocco and international market support after the Nigerian NGN workflow is stable.

## Nigeria-first requirements

- Show NGN prices clearly and store money values as integer kobo or integer NGN consistently; do not mix units.
- Use Paystack only after verifying merchant account eligibility, settlement details, live keys and webhook delivery.
- Validate all prices on the server; never accept amount or paid status from the browser.
- Use unique payment references, signed webhook validation, idempotent payment processing, reconciliation and refund handling.
- Provide clear receipts, terms, privacy notice, cancellation/refund policy and customer support route.
- Use Nigeria-relevant location fields (state and city) and phone format validation, without requiring sensitive personal data unnecessarily.

## Technical implementation sequence

1. Baseline audit and branch isolation — completed.
2. Write and review this Nigeria revenue roadmap — current step.
3. Inspect current homepage navigation, routing, deployment settings, template-store UI, payment endpoints, database RLS and storage without modifying production.
4. Implement Business Directory in new files and additive database migrations on an isolated development database/branch.
5. Implement Job Board in new files and additive database migrations.
6. Add the Digital Services quote workflow without replacing the existing section/form.
7. Build separate payment/order records and Paystack checkout integration for paid listings; do not alter the existing template-store order semantics.
8. Add admin moderation, renewals/expiry, audit logs, notifications and abuse controls.
9. Run static checks, API tests, RLS tests, payment test-mode scenarios, mobile checks and regression checks for existing features.
10. Review diffs and deployment preview. Only after explicit approval may changes be merged/deployed.

## Acceptance criteria

- Existing homepage and all existing sections remain present and functional.
- Existing student-related features, template store, chat, voice call and video call are not removed or broken.
- New directory and job board pages work on mobile and desktop.
- Unapproved business/job submissions are not publicly visible.
- Paid listing status changes only after trusted server-side Paystack verification.
- Duplicate, forged, failed, pending, refunded and mismatched payments cannot grant paid placement.
- Admin actions are role-checked and audited.
- No production deployment or live payment activation occurs without explicit approval.

## Current status

- [x] Confirmed Nigeria as the first target market.
- [x] Audited the current repository and identified existing template-store/Paystack foundation.
- [x] Confirmed the existing Supabase Template Store project and current table/payment setup.
- [x] Created isolated working branch `feature/revenue-monetization-2026` from the current `main` commit.
- [x] Recorded this roadmap as an additive documentation-only commit on the isolated branch.
- [ ] Complete UI/routing and deployment configuration audit.
- [ ] Implement Business Directory.
- [ ] Implement Job Advertisement Board.
- [ ] Implement Digital Services quote workflow.
- [ ] Add and test separate payment handling for paid listings.
- [ ] Complete regression and security review.
- [ ] Obtain explicit approval before production release.
