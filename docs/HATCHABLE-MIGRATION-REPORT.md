# Hatchable source archive and database migration report

Updated: 2026-11-26

## Source archive

The following non-virtual project files were imported from Hatchable into this repository branch under `hatchable-imports/`:

| Application | Hatchable files | Imported source files |
|---|---:|---:|
| YSCMT Student Portal | 75 + generated virtual manifest | 75 |
| YSCMT Connect | 28 + generated virtual manifest | 28 |
| AdForge AI | 7 + generated virtual manifest | 7 |
| **Total** | **110 source files** | **110** |

The Hatchable-generated `AGENTS.md` manifests are virtual platform output and are not treated as source files. Files are preserved in an archive layout; this does not mean Hatchable-specific runtime code is already compatible with Vercel.

## Neon databases created and populated

All 43 application tables were created in YSCMT's Neon organization, and source/target row counts were checked.

| App | Neon project | Database | Tables | Rows in source and target |
|---|---|---|---:|---:|
| Student Portal | `YSCMT-Student-Portal` | `yscmt_student_portal` | 23 | 106 |
| YSCMT Connect | `YSCMT-Connect` | `yscmt_connect` | 18 | 3 |
| AdForge AI | `YSCMT-AdForge-AI` | `adforge_ai` | 2 | 1 |
| **Total** | | | **43** | **110** |

Row counts match for every listed table at the time of verification. This validates the table-level data copy, not authentication portability, media object availability, or application behavior.

## Neon projects

- Student Portal: project `rough-paper-00162484`, branch `br-super-queen-bh0pn704`
- Connect: project `odd-flower-59014209`, branch `br-noisy-hat-bhbccsa0`
- AdForge AI: project `round-term-16397339`, branch `br-blue-cherry-bhhyo0vp`

These were created under the existing Neon Free organization. No paid plan was selected.

## Not yet completed

1. Replace Hatchable SDK/runtime bindings with a Vercel-compatible server layer.
2. Design and verify shared authentication, password reset, session handling, and authorization. Do not assume Hatchable password/session records can be reused directly.
3. Verify/export storage objects and binary materials, then ensure all referenced URLs resolve.
4. Move each app into the main YSCMT site navigation and establish protected admin routes.
5. Configure destination secrets in Vercel; never copy secrets into Git.
6. Run end-to-end acceptance checks for courses, enrolments, exams, certificates, Connect social features, AdForge generation/history, and Paystack verification.
7. Verify the deployed YSCMT domain and obtain explicit cutover approval.

## Safety

- Hatchable remains online and is the rollback source.
- No production DNS change or live cutover has been made.
- No Hatchable project has been deleted or deactivated.
- No payment or settlement has been initiated.
- This branch is an imported source archive and database foundation, not a completed production migration.

## First Vercel-native Student Portal API ports

The migration branch now contains two read-only endpoints dispatched through the existing shared `api/revenue.js` function, preserving the Vercel Hobby limit of 12 serverless functions:

- `GET /api/student-portal/courses`
- `GET /api/student-portal/certificate-verify?code=...`

Both use the dedicated Student Portal Neon database, parameterized SQL, generic error responses, and server-side-only connection configuration. These endpoints are source changes in the Draft PR; they have not been deployed or runtime-verified because Vercel project access returned 403.
