# YSCMT Template Store — deployment and security

## Delivery architecture

- Storefront: `/templates/` on the existing YSCMT Enterprise Vercel project.
- Customer account page: `/templates/account.html`.
- Private administration page: `/templates/admin.html`; access is enforced by the server-side `store_admin` role and database RLS, not by hiding the URL.
- API functions: Vercel Node.js functions under `/api`.
- Database, authentication and private archive storage: a dedicated Supabase project.
- Existing main website and root `index.html` remain unchanged.
- Work branch: `feature/yscmt-template-store`.

## Dedicated Supabase project and migrations

Use the dedicated project `YSCMT-Template-Store`. Do not reuse YSCMT-Student-Portal or YSCMT-Community. Apply migrations in timestamp order only to the Template Store project:

1. `supabase/migrations/20261116000100_template_store.sql`
2. `supabase/migrations/20261116000200_store_audit_and_updated_at.sql`
3. `supabase/migrations/20261116000300_optimize_store_rls.sql`
4. `supabase/migrations/20261116000400_customer_rls_checkout_and_downloads.sql`
5. `supabase/migrations/20261116000500_remove_redundant_insert_policies.sql`

The migrations create the product, order, installation and audit tables; the private `template-archives` bucket; customer/admin RLS; pending-order price validation; paid-installation checks; and paid-source-code download entitlements.

## Vercel environment variables

Set only these two values for Preview and Production environments:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (the modern publishable key is preferred)

The current implementation deliberately does **not** require or store a Supabase service-role key in Vercel. Customer writes use the signed-in customer's access token, and PostgreSQL/Storage RLS checks ownership, product price, paid status and administrator role. Never expose a service-role/secret key to browser code or commit one to Git.

## API

- `GET /api/public-config`: returns only the public Supabase URL and publishable key for browser authentication.
- `GET /api/catalog`: returns published catalogue records only.
- `POST /api/create-order`: authenticates the customer and creates a pending order. The database independently checks that the customer owns the order and that the submitted amount equals the current published product price. It does not charge the customer.
- `POST /api/download`: authenticates the customer and asks private Storage for a 60-second signed URL. Storage RLS independently checks that the customer owns a paid source-code order for the exact archive.
- `POST /api/installation-request`: accepts only a paid installation order owned by the signed-in customer. RLS enforces the same condition and prevents customer-supplied admin status/notes.
- `GET/POST/PATCH /api/admin/products`: checks the signed-in user's `app_metadata.role=store_admin`; RLS independently authorizes product changes and audit events.

## Admin access

Assign `store_admin` to the intended administrator account using Supabase Auth user app metadata (not user-editable metadata). The admin page is `/templates/admin.html`. It cannot grant itself administrator rights. The intended admin account has not yet been created or verified.

## Payment and production launch gates

Checkout is not live. The order API creates pending orders only. A payment provider has not been selected or configured. Before taking customer money:

1. Select and authorize a payment provider.
2. Configure its secret keys in server-side environment variables only.
3. Implement server-side payment initialization, signed webhook verification, idempotency and amount/currency validation.
4. Ensure webhook processing is atomic and cannot mark an order paid from browser input.
5. Test duplicate, forged, failed, pending, refunded and successful payment events.
6. Upload only YSCMT-owned or explicitly licensed ZIP archives to private storage.
7. Publish products only after checking ownership/licence, demo, screenshots, supported technologies, version, price and archive integrity.
8. Test customer registration, login, order creation, payment, download entitlement, installation requests and expired signed links end to end.

## Domain and deployment

The existing Vercel project has the `yscmtenterprise.ng` domain attached. After payment, administrator access, product assets and end-to-end tests are ready, review and merge the feature branch to `main`. The route will then be served at `https://yscmtenterprise.ng/templates/`.

Do not change DNS or replace the existing homepage. Do not deploy incomplete checkout to production or represent pending orders as paid purchases.
