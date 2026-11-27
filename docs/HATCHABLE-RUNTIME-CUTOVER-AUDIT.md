# Hatchable runtime dependency and cutover gate audit

Updated: 2026-11-26

## Runtime route inventory

This audit inspects the live Hatchable project manifests and source files, not just the imported archive.

| App | Active API routes | Hatchable runtime dependencies | Migration status |
|---|---:|---|---|
| Student Portal | 34 | Database SDK on most student/admin routes; platform auth/role injection; storage in payment flows; config secrets; webhook helper | Only public course listing and certificate verification have Vercel-native read-only ports |
| YSCMT Connect | 14 | Database SDK, storage URLs/uploads, event publishing, scheduler cleanup, user/admin identity | Source and DB archived; runtime routes not ported |
| AdForge AI | 2 | AI generation service and database SDK; user identity | Source and DB archived; runtime routes not ported |

## Student Portal blockers

The active Hatchable project currently exposes student, teacher, admin, course, classroom, exam, payment, certificate and Paystack routes. The Vercel branch currently ports only:
- `GET /api/student-portal/courses`
- `GET /api/student-portal/certificate-verify?code=...`

Remaining routes must be implemented behind verified identity and server-side role authorization. The old Paystack callback URL is tied to the Hatchable domain and must be replaced only after the new domain and webhook are verified.

## Connect blockers

The 14 API routes use Hatchable database access throughout. Several also require:
- private media upload and signed URL generation;
- event fan-out / live updates;
- moderation and report workflows;
- scheduled expiry/cleanup;
- member identity and admin-only moderation checks.

A plain SQL port without the corresponding auth, storage, event, and scheduled-job semantics would not be a faithful migration. Preserve the imported records and map media objects before moving traffic.

## AdForge blockers

The generation endpoint calls Hatchable's managed AI service with model `sonnet`, then saves the result to the app database. The history endpoint is database-backed. Before replacing this service, configure an approved AI provider/model and secret in the destination, test JSON output validation, quotas/rate limits, and ensure users can access only their own history.

## Destination infrastructure review

- Neon databases for all three apps exist and contain the verified source table/row copies.
- The existing Supabase `YSCMT-Community` project is currently `ACTIVE_HEALTHY`; the separate `YSCMT-Student-Portal` Supabase project is `INACTIVE`. No paused project was restored and no paid upgrade was requested.
- Vercel production deployment `dpl_DNfaVqWwBEGMJP8qucmK8GdHUiiV` is now confirmed `READY` from commit `cd6be4ad3c5b46745a99cb36c88661ea446399ee` on `migration/hatchable-source-import`. Vercel reports aliases for both `yscmtenterprise.ng` and `www.yscmtenterprise.ng`; this confirms deployment and domain attachment, not end-to-end application health. Runtime API checks, destination environment-variable validation, portal routing, and full workflow acceptance remain outstanding.

## Cutover checklist — all required before disabling Hatchable

- [ ] Destination sign-in, verified account claim, password recovery and logout work.
- [ ] Student, teacher, admin, member and moderator permissions pass positive and negative tests.
- [ ] All student course, lesson, exam, progress, certificate and payment workflows pass.
- [ ] Connect posts, comments, follows, groups, chat, stories, media and moderation pass.
- [ ] AdForge generation and private history pass with configured provider and usage controls.
- [ ] Storage/media object inventory matches; files open from destination URLs.
- [ ] Paystack live initialization, signed webhook, verification, idempotency and callback work on the YSCMT domain.
- [x] Vercel production deployment is READY and both root custom-domain aliases are attached.
- [ ] Vercel preview, portal routing, API health, and full production workflows are reachable and tested.
- [ ] Database backup and rollback procedure are verified.
- [ ] Traffic is cut over and monitored; only then deactivate Hatchable projects.

## Safety decision

The user has authorized deactivation after migration is complete. This does not authorize an early shutdown while the destination is not working. Keep all three Hatchable projects online as rollback sources until every required acceptance check passes. Do not delete or deactivate any project before that point.
