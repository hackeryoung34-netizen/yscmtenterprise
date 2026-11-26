# Student Portal identity and authentication migration

Updated: 2026-11-26

## Audit findings

A read-only inspection of the migrated Neon database `yscmt_student_portal` confirmed:

- `public.users` contains 5 user records.
- All 5 have an email address and a non-null `email_verified_at`.
- The table has identity/profile fields (`id`, `email`, `name`, `image`, `hatchable_user_id`, `google_sub`, timestamps), but no password hash, password salt, refresh token, or session-token columns.
- `public.student_profiles` currently contains 0 rows and `public.enrollments` contains 0 rows.
- Existing student-owned records refer to the legacy `users.id` string. That identifier must not be silently replaced with a new authentication provider's UUID.

This means the source database does not contain portable password credentials. It is unsafe to invent passwords, copy browser sessions, or claim existing passwords will continue working after migration.

## Required destination design

Use a supported identity provider (preferred: the existing YSCMT Supabase Auth integration) for new sign-in and account recovery. The Vercel server must validate the bearer token with the provider before reading or changing student records.

For existing accounts:

1. Match the verified identity to the legacy account by normalized, verified email.
2. Preserve the original `public.users.id` as the legacy student key for existing enrolments, certificates, payments, progress and audit relationships.
3. Store an explicit provider-user-ID to legacy-user-ID mapping in a dedicated table, with unique constraints on both identifiers. Do not infer or rewrite ownership at request time using an unverified email.
4. Require a one-time verified email/password reset or account-claim flow before creating that mapping.
5. Do not allow a newly registered account to claim an existing legacy record solely by supplying its email address; require the identity provider's verified-email claim and a single-use, expiring claim token.
6. Enforce role/permission checks server-side for every admin and teacher route. A valid student session must never imply admin or teacher access.

For new accounts, create a new legacy identity record and provider mapping in a single transaction after identity verification. Keep the database's existing text user IDs stable.

## Implementation gates

Before enabling authenticated student routes:

- Confirm the selected Supabase project is active, accessible, and approved for use; do not restore or upgrade a paused project without checking cost.
- Confirm the Vercel environment variables are configured without exposing values in logs or Git.
- Add schema migration for the identity mapping and claim-token records, with hashed single-use tokens and expiry.
- Implement token verification, account claim, sign-in recovery, logout/session expiry, and role authorization.
- Add rate limits and audit events to account-claim and recovery endpoints.
- Test account linking against all five existing users without returning email addresses or other personal data in build logs.
- Test that unauthenticated requests receive 401, student tokens cannot call admin routes, and expired/used claim tokens are rejected.

## Current status

No identity provider has been connected to the new Vercel API yet. No existing account has been linked, no password reset has been sent, and no user credentials have been changed. The Hatchable portal remains the active rollback system until the complete flow is implemented and accepted.
