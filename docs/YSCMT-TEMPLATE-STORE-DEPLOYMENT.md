# YSCMT Template Store — deployment and security

## Current delivery model

- Static storefront: `/templates/` on the existing Vercel project.
- API functions: Vercel Node.js functions under `/api`.
- Database, authentication and private archive storage: a dedicated Supabase project for this store.
- Main website: existing root `index.html`; do not replace it.
- Work branch: `feature/yscmt-template-store`.

## Required Supabase project

Create/use a dedicated project named `YSCMT-Template-Store`. Do not reuse the Student Portal or Community database. Apply `supabase/migrations/20261116000100_template_store.sql` only after confirming the dedicated project ref.

Configure Vercel environment variables for Preview and Production:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never use a NEXT_PUBLIC_ prefix)

The service-role key bypasses RLS. Keep it only in Vercel server environment variables. Never commit secrets or expose them to browser code.

## API

- `GET /api/catalog`: returns published catalogue records only.
- `POST /api/download`: requires a Supabase access token and an order ID; checks that the order belongs to the authenticated user, is paid, and is a source-code purchase; creates a 60-second signed URL from the private `template-archives` bucket.

The download endpoint is intentionally unavailable until environment variables and the dedicated database are configured. Payment is not considered complete until a payment provider integration verifies its signature server-side and atomically records a paid order. Never set an order to paid from browser input.

## Payment and product launch gates

Before enabling checkout:
1. Select a payment provider and configure its secret keys in Vercel only.
2. Implement its server-side initialization, signed webhook verification, idempotency and amount/currency validation.
3. Add customer sign-in and order creation with server-side pricing.
4. Test duplicate, forged, failed, pending and successful webhook events.
5. Upload only YSCMT-owned or explicitly licensed ZIP archives to private storage.
6. Publish products only after checking demo, licence, screenshots, supported technologies, version, price and archive integrity.
7. Test customer purchase, installation request, entitlement and expired signed links.

## Deployments

Vercel Git integration can create Preview deployments from this feature branch. Do not merge to `main`, attach production domains, change DNS, or release the live site until the dedicated backend and payment gates have passed review.
