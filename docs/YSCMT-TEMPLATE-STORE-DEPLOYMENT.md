# YSCMT Template Store — deployment and security

## Delivery architecture

- Storefront: `/templates/` on the existing YSCMT Enterprise Vercel project.
- Customer account page: `/templates/account.html`.
- Private administration page: `/templates/admin.html`; access is enforced by the server-side `store_admin` role, not by hiding the URL.
- API functions: Vercel Node.js functions under `/api`.
- Database, authentication and private archive storage: a dedicated Supabase project.
- Existing main website and root `index.html` remain unchanged.
- Work branch: `feature/yscmt-template-store`.

## Required dedicated Supabase project

Create a separate project named `YSCMT-Template-Store`. Do not reuse YSCMT-Student-Portal or YSCMT-Community. Apply migrations in timestamp order only to that dedicated project:

1. `supabase/migrations/20261116000100_template_store.sql`
2. `supabase/migrations/20261116000200_store_audit_and_updated_at.sql`

The first migration creates products, orders, installation requests, RLS policies and a private `template-archives` bucket. The second adds an audit trail and updated-at triggers.

Configure Vercel environment variables for Preview and Production:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose to browser code)

The service-role key bypasses RLS. Keep it only in encrypted Vercel server environment variables. The public config endpoint exposes only the Supabase URL and anon key.

## API

- `GET /api/public-config`: returns the public Supabase URL and anon key for browser authentication.
- `GET /api/catalog`: returns published catalogue records only.
- `POST /api/create-order`: authenticates the customer, validates a published product and purchase option, and creates a pending order using the database price. It does not charge the customer.
- `POST /api/download`: authenticates the customer, verifies ownership and a paid source-code order, then creates a 60-second signed URL from private storage.
- `POST /api/installation-request`: accepts only an authenticated customer's paid installation order and creates one installation request per order.
- `GET/POST/PATCH /api/admin/products`: checks the authenticated user's `app_metadata.role=store_admin` on the server before listing or changing products; product changes are written to the audit log.

## Admin access

After the dedicated project is created, assign the `store_admin` role to the intended administrator account using Supabase Auth user app metadata. Do not put admin privileges in user-editable metadata. The admin page is `/templates/admin.html`. It cannot grant itself administrator rights.

## Payment and production launch gates

Checkout is not live. The current order API creates pending orders only. A payment provider has not been selected or configured. Before taking customer money:

1. Select and authorize a payment provider.
2. Configure its secret keys in Vercel only.
3. Implement server-side payment initialization, signed webhook verification, idempotency and amount/currency validation.
4. Ensure webhook processing is atomic and cannot mark an order paid from browser input.
5. Test duplicate, forged, failed, pending, refunded and successful payment events.
6. Upload only YSCMT-owned or explicitly licensed ZIP archives to private storage.
7. Publish products only after checking ownership/licence, demo, screenshots, supported technologies, version, price and archive integrity.
8. Test customer registration, login, order creation, payment, download entitlement, installation requests and expired signed links end to end.

## Domain and deployment

The Vercel project already has the verified `yscmtenterprise.ng` domain attached. Once the dedicated database, environment variables, administrator role, payment provider and end-to-end tests are ready, merge the reviewed feature branch to `main`. The route will then be served at `https://yscmtenterprise.ng/templates/`.

Do not change DNS or replace the existing homepage. Do not deploy this incomplete checkout to production or represent pending orders as paid purchases.
