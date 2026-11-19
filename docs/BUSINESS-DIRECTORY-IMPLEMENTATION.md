# YSCMT Enterprise Business Directory — implementation notes

## Scope

This is the first Nigeria-first revenue feature. It is additive and must not replace the existing homepage, student/training content, Digital Services quote flow, Template Store, chat, or voice/video calling.

## Database ownership

The Business Directory development schema lives in the dedicated Neon project `YSCMT-Revenue-Development`, on branch `revenue-development`. It creates:

- `public.business_directory_listings`: business profiles, Nigeria state/city, contact channels, moderation state, and optional featured-placement expiry.
- `public.business_directory_audit_logs`: server-written moderation audit trail.

The schema has been applied and verified on the Neon development branch only. It has not been applied to the Neon default `production` branch or the existing Supabase Template Store project. The matching Supabase migration file is intentionally a no-op, preventing accidental duplicate revenue tables in Supabase.

## Implemented routes and page

- `GET /api/business-directory`: approved listings only; bounded search, state/city/category filters, page size capped at 50, featured status calculated by the database.
- `POST /api/business-directory`: validates submitted business details, requires explicit permission to publish contact details, records the consent timestamp, and creates a `pending` listing only. Client cannot set approval or featured fields. Includes a honeypot and Neon-backed durable throttling (maximum three submissions per IP hash per feature per hour). IP addresses are HMAC-hashed with a Preview-only secret; raw IP addresses are not stored. An in-memory fallback remains if the secret is not configured. This is not a substitute for Turnstile.
- `GET /api/admin/business-directory`: requires a valid Supabase session with `app_metadata.role = store_admin`; returns recent listings for moderation.
- `PATCH /api/admin/business-directory`: same admin check; supports approve/reject/suspend and records an audit event.
- `/business-directory/`: standalone responsive directory and submission page. The existing homepage sections and features remain unchanged; two additive main-navigation links now expose Business Directory and Find Jobs.

## Environment and storage

- `REVENUE_RATE_LIMIT_SECRET` is configured as a sensitive Preview-only variable scoped to `feature/revenue-monetization-2026`; it HMAC-hashes client IPs before writing rate-limit records.
- `REVENUE_DATABASE_URL` has been configured as a sensitive Vercel Preview variable scoped to `feature/revenue-monetization-2026`; it points to Neon `revenue-development`. No Production environment variable was changed.
- The private Neon bucket `yscmt-revenue-assets` exists. A scoped Neon Object Storage credential (storage read/write, expires 2027-02-17) and the S3 endpoint, access key, secret, region, and bucket name are now configured as sensitive Vercel Preview variables for `feature/revenue-monetization-2026`. No Production variables were changed. Logo upload is not yet implemented in the Directory UI.
- A separate `REVENUE_HEALTH_TOKEN` is configured as a sensitive Preview-only variable. The protected health endpoint can be checked after a fresh Preview deployment loads the new variables.

## Payments and featured placement

Owner-approved pricing for the launch plan: Featured Business placement is ₦5,000 for 30 days. Job Ads remain free during the initial launch period. The Directory page now displays this price with a clear notice that online payment is not yet enabled; users must not send money until an official checkout is released. A listing cannot become featured through its public submission payload. A separate Neon payment-order table is defined in `neon/migrations/005_featured_business_payments.sql` and has been applied to the `revenue-development` branch only. The new `POST /api/featured-payment` route initializes a fixed NGN 500,000-kobo Paystack checkout only when a listing is approved and the supplied email matches its published contact email. It uses the dedicated `REVENUE_PAYSTACK_SECRET_KEY`, which must begin with `sk_test_`; the existing Template Store Paystack secret is not reused. The callback is verified server-side through `GET /api/featured-payment/verify`; only a successful Paystack transaction with test domain, exact amount/currency/reference, and matching order metadata can activate a 30-day featured period. Repeated verification is idempotent and does not extend the period again. This is test-mode code only; no live key, Production variable, or live payment has been enabled. The dedicated test key still needs to be added to the Preview environment before checkout can be exercised end-to-end.

## Release gates

- Confirm the Vercel Preview deployment and database connectivity.
- Add Turnstile before public launch; durable Neon-backed throttling is now implemented for Preview.
- Credentials are connected in Preview only; still test actual upload/download/delete before enabling logo uploads.
- Test listing submission, consent enforcement, duplicate handling, search/pagination, admin authorization, moderation, and audit records.
- Add Job Ads as a separate schema/API/payment workflow; do not reuse Template Store order tables.
- Do not merge to `main`, alter DNS, set Production environment variables, activate live payments, or deploy Production without explicit owner approval.


## Job Ads — development implementation

A separate Job Ads feature has been added on the same isolated Neon development branch:

- Tables: `public.job_ads` and `public.job_ad_audit_logs`, with status constraints, salary-range validation, closing dates, and moderation audit records. Reproducible migrations are `neon/migrations/002_job_ads.sql`, `neon/migrations/003_public_contact_consent.sql`, and `neon/migrations/004_submission_rate_limits.sql`.
- `GET /api/jobs`: approved, non-expired adverts only; bounded search and filters for state, category, and employment type.
- `POST /api/jobs`: validates vacancy details, requires at least one application contact method and explicit permission to publish employer contact details, records the consent timestamp, and creates `pending` adverts only. Public users cannot approve or feature an advert.
- `GET/PATCH /api/admin/jobs`: uses the same Supabase administrator role check as Business Directory and records moderation actions.
- `/jobs/`: standalone responsive vacancy search and employer submission page.
- `/revenue-admin/`: private moderation dashboard for Business Directory and Job Ads. It reuses the existing YSCMT account session, checks the Supabase `store_admin` role, and calls protected moderation APIs; it does not expose service-role credentials. It also includes an admin-only database and Object Storage smoke-test button that performs temporary PUT/GET/DELETE operations and cleans up the test object. Applicant CV uploads and storage of applicant personal data are intentionally not included in this first version.

Both Job Ads routes are rewrites to the existing consolidated `api/revenue.js` function so the project remains within the Vercel Hobby function-count limit. The homepage and Production environment remain unchanged.

## Featured Business Paystack test checkout

- `POST /api/featured-payment` creates a fixed-price NGN 5,000 checkout for an approved listing only, and requires the email to match the contact email displayed on that listing.
- `GET /api/featured-payment/verify?reference=...` calls Paystack Verify from the server and checks `status`, `domain=test`, exact NGN amount (500,000 kobo), reference, and `metadata.order_id` before setting `is_featured` and a 30-day expiry.
- The new payment-order schema is migration `005_featured_business_payments.sql`, applied to Neon `revenue-development` only. Payment orders are separate from the Template Store tables.
- Add `REVENUE_PAYSTACK_SECRET_KEY` as a sensitive Preview-only variable scoped to `feature/revenue-monetization-2026`; it must be a Paystack **test** secret beginning `sk_test_`. Do not reuse the Template Store key. Do not add a live key.
- End-to-end testing remains blocked until the dedicated test key is supplied and set in Preview. Test with Paystack test credentials/payment method only; verify pending, success, failed, wrong amount/reference/metadata, repeat callback, and listing status changes. No real funds should move.

## Additional Job Ads release gates

- Test job submission, filters, expired adverts, admin authorization, moderation, and audit logging through an authenticated Preview session.
- Add Turnstile / stronger bot protection before opening public submissions; durable Neon-backed throttling is implemented for Preview.
- Define employer identity checks, privacy notice, job-ad retention/deletion rules, and a separate verified payment workflow before charging employers.
- No paid promotion or Paystack workflow is active; no job advert is published automatically.
