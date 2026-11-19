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
- The private Neon bucket `yscmt-revenue-assets` exists. S3-compatible access credentials have not yet been connected to Vercel, so logo upload is not enabled.
- The health endpoint requires a separate `REVENUE_HEALTH_TOKEN` and Object Storage credentials; it is not yet ready for end-to-end health verification.

## Payments and featured placement

No payment endpoint or pricing is enabled for directory listings. A listing cannot become featured through its public submission payload. Featured status must only be activated after a separate server-side Paystack verification and payment record are implemented. The previously discussed ₦5,000 / 30-day option remains a proposal, not an active price.

## Release gates

- Confirm the Vercel Preview deployment and database connectivity.
- Add Turnstile or durable distributed rate limiting before public launch.
- Connect Neon Object Storage credentials in Preview only and test upload/download/delete.
- Test listing submission, duplicate handling, search/pagination, admin authorization, moderation, and audit records.
- Add Job Ads as a separate schema/API/payment workflow; do not reuse Template Store order tables.
- Do not merge to `main`, alter DNS, set Production environment variables, activate live payments, or deploy Production without explicit owner approval.
