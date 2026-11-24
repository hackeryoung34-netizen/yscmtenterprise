# YSCMT Enterprise Central Admin — Completion Notes

## Scope

This work is committed to the isolated branch `feature/central-admin-completion-2026`. It does not alter the production branch or hosting configuration.

Existing Business Directory, Job Ads, Template Store, orders, installations, and chat modules are retained and linked from the Central Admin. The Student Portal remains on Hatchable and keeps its separate authentication and database.

## Central Admin modules

- Overview and existing management module navigation.
- Staff & Permissions: Super Admin can add existing Supabase users as Finance, Content Manager, or Support Staff; change those limited roles; and enable/disable staff. Super Admin assignment is not available in the form.
- Actual permission grants are displayed for each staff record. Role changes continue to apply the server-defined permission sets; there is no browser-side arbitrary permission editor.
- Revenue Reports: read-only Business Directory, Job Ads, and Business Directory featured-listing payment summaries. Template Store revenue is intentionally excluded.
- Activity History: recent Central Admin, Business Directory, Job Ads, and Website Content audit entries.
- Website Content: homepage banner editor with private drafts and explicit publish action.
- Student Portal: navigation to the existing Hatchable admin and public portal only.
- System Settings: Super Admin-only, read-only presence checks for server configuration. It returns only configured/missing booleans; it never returns credential values.

## Login return flow

The Central Admin sign-in link sends the user to the existing account page with a restricted return destination. After successful sign-in or email confirmation, the account page returns to `/admin/`. Only the exact local admin path and the existing validated payment callback format are accepted as return destinations.

## Website CMS database prerequisite

Apply `supabase/migrations/20261124000100_site_content_management.sql` only to the Supabase project used by the YSCMT Enterprise website.

Do not apply it to the Student Portal project or Neon. It creates:
- `public.site_content_pages` for homepage published content and drafts.
- `public.site_content_audit_logs` for save/publish history.

Public browser roles can read published content only. Server writes use the service-role key through Vercel API handlers. Never expose that key to browser code.

## Required server-side configuration

The read-only System Settings view reports presence for:
- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Revenue database: `REVENUE_DATABASE_URL`.
- Payment processing: `REVENUE_PAYSTACK_SECRET_KEY`, `REVENUE_PAYSTACK_WEBHOOK_SECRET`, `REVENUE_PAYMENTS_ENABLED`.
- Submission abuse protection: `REVENUE_RATE_LIMIT_SECRET`.
- Object storage: `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`; `REVENUE_ASSETS_BUCKET` is an optional override because the code has a default bucket name.

The endpoint does not read or return secret values. The configured environment must be set in the Vercel server-side environment used by the eventual deployment.

## Release boundary and remaining operational steps

The code changes are committed to the feature branch only. The following have deliberately not been performed:
- No test suite, smoke test, trial deployment, or CI run.
- No production deployment, merge to the production branch, DNS change, or production cutover.
- No database migration execution or live CMS content publication.
- No role assignment, staff activation/deactivation, or permission change on live accounts.
- No Hatchable shutdown or Student Portal migration.

Before the feature can become live, the owner must approve the production release and the correct website Supabase project must be confirmed for the CMS migration. The production environment must then be configured and the migration applied before deploying the feature. Keep Hatchable and all existing production modules intact during this process.
