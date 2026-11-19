# YSCMT Enterprise — Backend Architecture (Nigeria Revenue Features)

## Decision

Use a hybrid architecture for new revenue features while preserving all existing production services:

- **Vercel** remains the web hosting and server-side API layer for the existing YSCMT Enterprise site.
- **Neon Postgres** is the proposed database for new Business Directory and Job Board data.
- **Supabase** remains in place for the existing Template Store and its existing chat/call data. Do not migrate or alter those tables as part of this work.
- **Cloudflare R2** is a later option for business logos and job attachments. Do not enable uploads until access rules, file validation, retention, and cost controls are designed.
- **Existing authentication** should be reused where safe. Do not introduce Clerk until an actual gap is demonstrated.

## Environments and safety boundaries

1. Keep all code on `feature/revenue-monetization-2026` until reviewed.
2. Use a separate Neon development database/branch for development and testing.
3. Configure a Neon connection string only as a server-side Vercel **Preview** environment variable (for example, `REVENUE_DATABASE_URL`). Never use a `VITE_` prefix, expose it to browser code, or commit it to Git.
4. Do not add this variable to Production. Do not change existing Production variables.
5. Do not run migrations against Supabase production or Neon production as part of setup.
6. Do not merge to `main`, change DNS, enable live payments, or deploy production without explicit approval.
7. Keep existing homepage, Digital Services, student-related content, Template Store, live chat, Voice Call, and Video Call unchanged.

## Data ownership

The new Neon database owns only new revenue-feature data, initially:
- Business directory submissions and approved listings.
- Job advertisements and moderation records.

Supabase continues to own existing Template Store orders/products, installations, and existing chat/call data. Do not create cross-database foreign keys. If a future workflow needs a link between systems, use stable opaque IDs and server-side integration with explicit failure handling.

## Initial implementation sequence

1. Create a Neon account/project and a dedicated development database/branch. Verify the plan and usage limits before adding production data.
2. Keep the database empty of real customer data. Use synthetic test records only.
3. Review the existing additive Business Directory SQL migration for Postgres compatibility and apply a revised migration to Neon development only.
4. Implement isolated server API routes for directory submission, public approved-listing reads, and admin moderation. All writes remain server-side; public users cannot set approval or featured status.
5. Add the directory UI as a new route, not a replacement of the existing homepage.
6. Add Job Board only after Directory tests pass.
7. Use Preview-only configuration and test with the feature branch.
8. Review the full diff and regression-test the existing website and Template Store before requesting production approval.

## Security requirements

- Never place database credentials or service-role secrets in client-side JavaScript.
- Validate and normalize Nigerian phone numbers, URLs, email addresses, state/city fields, and text lengths on the server.
- Escape output and prevent stored XSS.
- Add spam protection, request rate limits, pagination caps, and moderation audit logs.
- Public reads must expose approved listings only.
- Admin actions must verify the existing trusted admin identity server-side.
- Featured status must never be granted from client-supplied fields.
- If paid placements are added later, use separate payment records and server-side Paystack verification/webhooks. Do not reuse Template Store order tables or payment RPCs.

## Cost and operational notes

Neon's Free plan currently advertises 100 projects, 100 CU-hours per project/month, 1 GB Postgres storage per project, and 5 GB public network transfer per project/month. Limits can change and usage may stop when a quota is exhausted; check the current plan and usage dashboard before relying on it for production.

Cloudflare R2 is optional, not a prerequisite for the first directory release. Start with no user uploads or use a tightly limited upload design only after storage policies are reviewed.

## Current status

This document records the architecture decision only. It does not create a Neon account/project, configure Vercel variables, apply a database migration, change Supabase, deploy code, or alter production.
