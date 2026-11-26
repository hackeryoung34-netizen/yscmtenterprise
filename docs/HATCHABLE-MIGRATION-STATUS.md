# YSCMT Hatchable Migration Status

Last checked: 2026-11-26 (UTC)

## Scope

The migration target is the YSCMT Enterprise-controlled platform:
- Source control: GitHub `hackeryoung34-netizen/yscmtenterprise`
- Web hosting: Vercel project `yscmtenterprise`
- DNS/CDN/security: Cloudflare
- PostgreSQL target under evaluation: Neon

## Hatchable projects inventoried

| Project | Hatchable project ID | Source files | Database tables | Current state |
|---|---|---:|---:|---|
| YSCMT Student Portal | `proj_wtjM5VcpGROw` | 76 | 23 | Active; keep online until cutover |
| YSCMT Connect | `proj_IIZ9xHDMs0jW` | 29 | 18 | Active; keep online until cutover |
| AdForge AI | `proj_qOSxVPgmZGyw` | 8 | 2 | Active; keep online until cutover |
| **Total** | | **113** | **43** | |

Counts are based on Hatchable project file/schema inventory. This is an inventory, not a completed source/data export.

## Neon assessment

Read-only inspection found:
- Neon project `YSCMT-Student-Portal` (`rough-paper-00162484`), branch `development`, database `yscmt_student_portal`: no user tables visible.
- Neon project `YSCMT-Revenue-Development` (`lingering-voice-52104737`), branch `production`, database `neondb`: no user tables visible.
- The same Revenue project branches `revenue-production` and `revenue-development` contain 36 public tables. These appear to be YSCMT revenue/enterprise tables and are not evidence that the three Hatchable applications have been migrated.

Do not point production apps at an empty Neon branch. Confirm schema, data, access policies, and app compatibility before selecting a target branch.

## Required migration gates

1. Export and checksum every source file, including public assets and server functions.
2. Export all 43 tables' schema and complete data; preserve IDs, timestamps, relationships, indexes, and constraints.
3. Identify and migrate user authentication safely. Passwords/sessions may not be portable; plan secure account recovery where needed.
4. Export media/storage objects and verify every referenced asset.
5. Rebuild Hatchable-specific API/runtime integrations for the independent Vercel backend; do not blindly copy platform-specific SDK code.
6. Configure secrets only in the destination's secret manager; never commit secrets.
7. Verify student enrolment, courses, lessons, exams, certificates, Connect posts/messages/groups, AdForge history/generation, and payment webhook verification.
8. Run acceptance checks against the YSCMT domain and confirm data counts/checksums.
9. Obtain explicit user approval for production cutover.
10. Deactivate Hatchable only after successful cutover and a verified rollback backup.

## Safety status

- No Hatchable project has been deleted, paused, or deactivated.
- No Neon database has been reset or overwritten.
- No production DNS cutover has been performed.
- No live payment or settlement has been initiated.
- Migration is **not complete**. Existing Hatchable services remain the rollback source until all gates pass.
