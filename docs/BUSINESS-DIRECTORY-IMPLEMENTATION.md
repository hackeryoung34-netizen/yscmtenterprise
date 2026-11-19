# YSCMT Enterprise Business Directory — implementation notes

## Scope

This is the first revenue feature in the Nigeria-first expansion. It is additive and must not replace or modify the existing homepage, student/training content, Digital Services quote flow, Template Store, chat, or voice/video calling.

## Database migration

Migration: `supabase/migrations/20261119000100_business_directory.sql`

It creates two independent tables:

- `business_directory_listings`: business profile, Nigeria state/city, contact channels, moderation state, and optional featured-placement expiry.
- `business_directory_audit_logs`: server-written moderation/submission audit trail.

The migration enables RLS. Public clients can read approved listings only. Public clients cannot insert, update, or delete listings and cannot access audit logs. All submissions and moderation must go through server-side endpoints using the server-only Supabase service role. The service role key must never be returned to a browser.

Featured expiry is separate from listing approval: when a featured period ends, the approved listing remains visible as a normal listing. A listing must never be removed merely because its paid promotion expired.

## API work required before launch

1. `GET /api/business-directory`
   - Return approved listings only.
   - Support bounded search and exact state/city/category filters.
   - Paginate with a strict maximum page size.
   - Return whether a featured placement is currently active, calculated server-side.
2. `POST /api/business-directory`
   - Validate and normalize all fields server-side.
   - Create a pending listing only; never auto-publish.
   - Add abuse controls (Turnstile or equivalent, honeypot, request throttling).
   - Never accept a client-supplied status, approval timestamp, or featured flag.
3. Admin moderation endpoint
   - Require a verified Supabase session with the existing administrator role.
   - Approve, reject, or suspend a listing; record an audit event.
   - Only a separate verified payment flow may activate a featured placement.

## Product decisions still unapproved

No listing price, featured duration, or payment amount is hard-coded by this migration. The previously discussed ₦5,000 / 30-day featured option remains a proposal only and needs owner approval before implementation.

## Safety and release gates

- Do not apply this migration to the current production Template Store project.
- First create/use a separately isolated development database branch or project, after reviewing any recurring cost.
- Test RLS as anon, authenticated non-admin, and server-side service role.
- Test invalid inputs, HTML/script payloads, duplicate slugs, pagination limits, spam controls, moderation transitions, and expired featured placements.
- Verify that the existing Template Store, homepage, chat, voice/video calling, and quote form still work.
- Do not merge to `main`, alter DNS, set production environment variables, or deploy production without explicit owner approval.
