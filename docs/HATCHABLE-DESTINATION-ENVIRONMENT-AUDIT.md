# Destination environment and identity readiness audit

Updated: 2026-11-27

## Scope

Read-only inspection of the Vercel `yscmtenterprise` project's environment-variable names/targets (values were not decrypted) and the Neon AdForge AI database schema.

## Findings

### Vercel environment configuration

The production project currently has configuration for the YSCMT main site, template store, revenue/payments, object storage, and Cloudflare TURN. The inspected variable-name inventory does **not** contain dedicated runtime database URLs or AI-provider credentials for the three imported Hatchable applications:

- `STUDENT_PORTAL_DATABASE_URL`
- `CONNECT_DATABASE_URL`
- `ADFORGE_DATABASE_URL`
- an approved AdForge AI provider key/model configuration

The project has a Supabase URL and publishable key for the Template Store. That is not evidence that the Student Portal or Connect identity systems have been migrated. The Supabase service-role key is present, but must remain server-only and must not be used as a substitute for a verified user-authentication design.

No secret values were decrypted or copied during this audit.

### AdForge AI database

Neon project `round-term-16397339`, branch `br-blue-cherry-bhhyo0vp`, database `adforge_ai` is READY. It contains:

- `public.users`: stable text ID, email, optional name/image, verified-email timestamp, legacy Hatchable user ID, optional Google subject, created/updated timestamps.
- `public.creations`: UUID ID, text user ID, product/platform/objective/audience/tone/offer/key message, JSONB result, created timestamp.

The original AdForge generation route calls Hatchable's managed AI service with model `sonnet`, then inserts the result into `creations`. Its history route filters by the authenticated `req.user.id`. The destination has not yet been given a replacement AI provider or a verified identity bridge, so exposing a generation or history endpoint now would either fail or risk cross-account data access.

### Identity migration requirements

- Preserve legacy user IDs and the `creations.user_id` relationship.
- Map each legacy user to a verified destination auth subject through a one-time account-claim flow.
- Do not infer identity from an email address alone or permit a client to submit another user's ID.
- Enforce per-user ownership in server-side queries and test unauthorized access.
- Keep provider keys and database credentials in encrypted server-side environment variables only.

## Next implementation gates

1. Provision narrowly scoped database roles for each app; do not place Neon owner credentials in Vercel functions.
2. Add app-specific production environment variables only after least-privilege roles and connection tests exist.
3. Select and configure an approved AI provider/model for AdForge; add quotas, input/output validation and rate limiting.
4. Complete Supabase Auth account-claim mapping and role checks for each app.
5. Port APIs app-by-app, then run positive and negative workflow tests before changing traffic.

## Cutover decision

This is a readiness audit, not a runtime migration completion. Hatchable must remain available as rollback until all three apps pass their production acceptance checks.