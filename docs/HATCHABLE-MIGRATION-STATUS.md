# YSCMT Hatchable Migration Status

Updated: 2026-11-26

## Completed on migration branch

- Archived all 110 non-virtual source files from the three Hatchable projects under `hatchable-imports/`.
- Created the three dedicated Neon databases and applied the application schemas.
- Copied the current data from all 43 tables.
- Verified that every source table row count matches its Neon target count.
- Added a server-side Neon connectivity health endpoint at `/api/migration/neon-health`; it requires three encrypted Vercel environment variables and is not yet live.
- Added detailed reports in `docs/HATCHABLE-MIGRATION-REPORT.md` and `docs/NEON-VERCEL-CONNECTIONS.md`.

## Source archive counts

| Application | Source files imported | Tables | Rows copied and count-verified |
|---|---:|---:|---:|
| YSCMT Student Portal | 75 | 23 | 106 |
| YSCMT Connect | 28 | 18 | 3 |
| AdForge AI | 7 | 2 | 1 |
| **Total** | **110** | **43** | **110** |

## Neon destinations

- Student Portal: project `rough-paper-00162484`, branch `br-super-queen-bh0pn704`, database `yscmt_student_portal`
- Connect: project `odd-flower-59014209`, branch `br-noisy-hat-bhbccsa0`, database `yscmt_connect`
- AdForge AI: project `round-term-16397339`, branch `br-blue-cherry-bhhyo0vp`, database `adforge_ai`

All three projects were created in the existing Neon Free organization. No paid plan was selected.

## GitHub review

- Branch: `migration/hatchable-source-import`
- Pull request: [#54 — Hatchable source and Neon migration foundation](https://github.com/hackeryoung34-netizen/yscmtenterprise/pull/54)
- PR is kept in **Draft** to prevent premature merge/deployment.

## Remaining production work

1. Port Hatchable-specific runtime SDKs to Vercel-compatible API functions.
2. Design and validate authentication, password reset, sessions and role-based access; password/session portability is not assumed.
3. Verify every binary/media asset and migrate external storage objects.
4. Integrate the apps into the main YSCMT website navigation and protected portal/admin routes.
5. Add least-privilege database roles and encrypted Vercel Preview environment variables.
6. Run end-to-end checks for student learning flows, Connect social functions, AdForge generation/history and Paystack verification.
7. Verify the preview deployment and the production domain, then obtain explicit cutover approval.

## Safety and current limitations

- Hatchable remains online as the rollback source.
- No production DNS cutover has been performed.
- No Hatchable project has been deleted or deactivated.
- No live payment or settlement has been initiated.
- Vercel deployment listing returned HTTP 403 (not authorized), so preview deployment and runtime verification could not be confirmed in this session.
- This is a verified source-and-database foundation, **not yet a production-ready replacement**.
