# YSCMT Enterprise Business Directory — implementation notes

## Scope

This is the first Nigeria-first revenue feature. It is additive and must not replace the existing homepage, student/training content, Digital Services quote flow, Template Store, chat, or voice/video calling.

## Database ownership

The Business Directory development schema lives in the dedicated Neon project `YSCMT-Revenue-Development`, on branch `revenue-development`. It creates:

- `public.business_directory_listings`: business profiles, Nigeria state/city, contact channels, moderation state, and optional featured-placement expiry.
- `public.business_directory_audit_logs`: server-written moderation audit trail.

The schema has been applied and verified on the Neon development branch only. It has not been applied to the Neon default `production` branch or the existing Supabase Template Store project.

## Implemented routes and page

- `GET /api/business-directory`: approved listings only; bounded search, state/city/category filters, page size capped at 50, featured status calculated by the database.
- `POST /api/business-directory`: validates submitted business details and creates a `pending` listing only. Client cannot set approval or featured fields. Includes a honeypot and per-instance in-memory throttling; this is basic abuse resistance, not a substitute for Turnstile or durable distributed rate limiting.
- `GET /api/admin/business-directory`: requires a valid Supabase session with `app_metadata.role = store_admin`; returns recent listings for moderation.
- `PATCH /api/admin/business-directory`: same admin check; supports approve/reject/suspend and records an audit event.
- `/business-directory/`: standalone responsive directory and submission page. The existing homepage/navigation has not been changed.

## Environment and storage

- `REVENUE_DATABASE_URL` has been configured as a sensitive Vercel Preview variable scoped to `feature/revenue-monetization-2026`; it points to Neon `revenue-development`. No Production environment variable was changed.
- The private Neon bucket `yscmt-revenue-assets` exists. A scoped Neon Object Storage credential (storage read/write, expires 2027-02-17) and the S3 endpoint, access key, secret, region, and bucket name are now configured as sensitive Vercel Preview variables for `feature/revenue-monetization-2026`. No Production variables were changed. Logo upload is not yet implemented in the Directory UI.
- A separate `REVENUE_HEALTH_TOKEN` is configured as a sensitive Preview-only variable. The protected health endpoint can be checked after a fresh Preview deployment loads the new variables.

## Payments and featured placement

No payment endpoint or pricing is enabled for directory listings. A listing cannot become featured through its public submission payload. Featured status must only be activated after a separate server-side Paystack verification and payment record are implemented. The previously discussed ₦5,000 / 30-day option remains a proposal, not an active price.

## Release gates

- Confirm the Vercel Preview deployment and database connectivity.
- Add Turnstile or durable distributed rate limiting before public launch.
- Connect Neon Object Storage credentials in Preview only and test upload/download/delete.
- Test listing submission, duplicate handling, search/pagination, admin authorization, moderation, and audit records.
- Add Job Ads as a separate schema/API/payment workflow; do not reuse Template Store order tables.
- Do not merge to `main`, alter DNS, set Production environment variables, activate live payments, or deploy Production without explicit owner approval.


## Job Ads — development implementation

A separate Job Ads feature has been added on the same isolated Neon development branch:

- Tables: `public.job_ads` and `public.job_ad_audit_logs`, with status constraints, salary-range validation, closing dates, and moderation audit records.
- `GET /api/jobs`: approved, non-expired adverts only; bounded search and filters for state, category, and employment type.
- `POST /api/jobs`: validates vacancy details and requires at least one application contact method. New adverts are always `pending`; public users cannot approve or feature an advert.
- `GET/PATCH /api/admin/jobs`: uses the same Supabase administrator role check as Business Directory and records moderation actions.
- `/jobs/`: standalone responsive vacancy search and employer submission page. Applicant CV uploads and storage of applicant personal data are intentionally not included in this first version.

Both Job Ads routes are rewrites to the existing consolidated `api/revenue.js` function so the project remains within the Vercel Hobby function-count limit. The homepage and Production environment remain unchanged.

## Additional Job Ads release gates

- Test job submission, filters, expired adverts, admin authorization, moderation, and audit logging through an authenticated Preview session.
- Add durable rate limiting / bot protection before opening public submissions.
- Define employer identity checks, privacy notice, job-ad retention/deletion rules, and a separate verified payment workflow before charging employers.
- No paid promotion or Paystack workflow is active; no job advert is published automatically.
