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
6. `supabase/migrations/20261116000600_admin_archive_read_policy.sql`
7. `supabase/migrations/20261116000700_paystack_payment_security.sql`
8. `supabase/migrations/20261116000800_restrict_payment_reference_rpc.sql`
9. `supabase/migrations/20261116000900_fix_server_payment_reference_rpc.sql`

The migrations create the product, order, installation and audit tables; the private `template-archives` bucket; customer/admin RLS; pending-order price validation; paid-installation checks; and paid-source-code download entitlements.

## Vercel environment variables

Set these values only in Vercel server-side environment settings. Never prefix secrets with `NEXT_PUBLIC_`, `VITE_`, or expose them through browser config:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (the modern publishable key is preferred)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; required for payment reference attachment and verified paid-state updates)
- `PAYSTACK_SECRET_KEY` (server-side only; start with Paystack Test Secret Key in Preview)
- `PAYSTACK_WEBHOOK_SECRET` (optional newer Paystack webhook signing secret; server-side only)
- `STORE_PAYMENT_CALLBACK_URL` (set to `https://yscmtenterprise.ng/templates/payment-callback.html` only after production route is deployed and tested)

Customer order creation and installation requests use the signed-in customer's access token, with PostgreSQL RLS checking ownership and product price. Payment reference attachment and paid-state confirmation use narrowly scoped server-side RPCs called with the service-role key. Never expose a service-role/secret key to browser code or commit one to Git.

## API

- `GET /api/public-config`: returns only the public Supabase URL and publishable key for browser authentication.
- `GET /api/catalog`: returns published catalogue records only.
- `POST /api/create-order`: authenticates the customer, derives the current published price from the database, creates a pending order, initializes a Paystack NGN transaction and attaches the unique reference using a server-only RPC. It returns a Paystack checkout URL; it never marks the order paid.
- `POST /api/verify-payment`: authenticates the customer, verifies the Paystack transaction server-side, checks exact amount, NGN currency and matching YSCMT order metadata, then applies the paid state through a service-role-only database function.
- `POST /api/paystack-webhook`: validates Paystack webhook signatures, verifies the transaction directly with Paystack and applies the same idempotent order checks.
- `POST /api/download`: authenticates the customer and asks private Storage for a 60-second signed URL. Storage RLS independently checks that the customer owns a paid source-code order for the exact archive.
- `POST /api/installation-request`: accepts only a paid installation order owned by the signed-in customer. RLS enforces the same condition and prevents customer-supplied admin status/notes.
- `GET/POST/PATCH /api/admin/products`: checks the signed-in user's `app_metadata.role=store_admin`; RLS independently authorizes product changes and audit events.

## Admin access

Assign `store_admin` to the intended administrator account using Supabase Auth user app metadata (not user-editable metadata). The admin page is `/templates/admin.html`. It cannot grant itself administrator rights. The intended admin account has not yet been created or verified.

## Payment and production launch gates

Paystack is the selected first payment provider. The integration code is implemented, but checkout is not live until the required server-side keys, merchant activation, webhook endpoint and end-to-end tests are complete. Before taking customer money:

1. Complete Paystack merchant compliance and activate the Nigerian business account.
2. Add the Paystack Test Secret Key and Supabase service-role key to Vercel Preview server-side environment variables; never share or commit them.
3. Configure the Paystack webhook URL to the production API only after the route is deployed and TLS is active.
4. Test duplicate, forged, failed, pending, refunded and successful payment events; confirm amount, currency, order ID metadata and idempotency.
5. Switch to the Paystack Live Secret Key only after successful test-mode review and merchant activation.
6. Upload only YSCMT-owned or explicitly licensed ZIP archives to private storage.
7. Publish products only after checking ownership/licence, demo, screenshots, supported technologies, version, price and archive integrity.
8. Test customer registration, login, order creation, payment, download entitlement, installation requests and expired signed links end to end.

## Domain and deployment

The existing Vercel project has the `yscmtenterprise.ng` domain attached. After payment, administrator access, product assets and end-to-end tests are ready, review and merge the feature branch to `main`. The route will then be served at `https://yscmtenterprise.ng/templates/`.

Do not change DNS or replace the existing homepage. Do not deploy incomplete checkout to production or represent pending orders as paid purchases.
