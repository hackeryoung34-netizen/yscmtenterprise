# Student Portal path and frontend compatibility audit

Updated: 2026-11-27

## What was inspected

- The current YSCMT main-site `vercel.json` on `migration/hatchable-source-import`.
- The archived Hatchable Student Portal `public/index.html`, `public/app.js`, `public/login.js`, and `hatchable.toml`.
- The existing `/portal` rewrite target.

## Verified findings

1. The main website currently rewrites `/portal` and `/portal/:path*` to the separate `yscmt-react.vercel.app` deployment. It does not serve the archived Hatchable Student Portal frontend.
2. The archived portal frontend expects to run at the origin root. Its stylesheet, page links, login paths, and API calls use root-relative paths such as `/theme.css`, `/login`, `/admin`, and `/api/student/...`. Simply copying these files under a `/portal` folder would send requests to the wrong root paths.
3. The archived login and app scripts call `window.hatchable.auth` for sessions, login, one-time codes, and sign-out. This object is supplied by Hatchable and is not a standard browser API. The copied files therefore cannot authenticate against Neon or Supabase without a deliberate identity adapter and route rewrite.
4. The archived frontend uses the Hatchable-authenticated user object to decide whether to show the student dashboard. That behavior must be replaced with verified destination session checks, not a client-side-only role check.
5. `hatchable.toml` declares email authentication and row-access rules for student profiles, enrolments, courses, progress, exams, certificates, payments, and classroom tables. These declarations are not automatically enforced by Neon after source import.

## Required implementation sequence

1. Keep the existing `/portal` rewrite unchanged until the React portal is proven healthy; do not point it at a partial static copy.
2. Confirm the React app's Vite base and router basename both support `/portal`, including refresh/deep-link behavior for `/portal/login`, `/portal/admin`, and course routes.
3. Implement a destination identity adapter (shared YSCMT identity or a verified account-claim flow) and server-side role checks for student, teacher, and admin. Never trust a role supplied by browser storage or editable profile metadata.
4. Port the archived UI into the React app with an explicit `/portal` base path. Move APIs to a clearly namespaced destination such as `/api/portal/*`; avoid collisions with the main site's existing `/api/admin/*` and revenue routes.
5. Port one workflow at a time and verify it against the copied Neon records: login/account claim, course listing, enrolment, lesson progress, exams, certificates, teacher tools, admin tools, and Paystack payment lifecycle.
6. Test direct navigation, refresh, asset loading, mobile layout, unauthenticated redirects, role-denied responses, and payment callbacks on a Vercel preview before changing production routing.

## Acceptance gate

- [ ] React app base and router basename both use `/portal`.
- [ ] Static assets and every in-app link stay under the intended portal path.
- [ ] No frontend code depends on `window.hatchable`.
- [ ] Authentication, account claim, sessions, logout, and password recovery work on destination infrastructure.
- [ ] Server-side student/teacher/admin authorization is tested, including denied requests.
- [ ] Namespaced API routes are deployed and tested against the migrated Neon database.
- [ ] Deep links and refresh work on the YSCMT custom domain.
- [ ] Payment callbacks and webhooks work on the YSCMT custom domain.

## Cutover decision

The archived frontend is valuable source material, but it is not yet a drop-in production portal. Keep the existing routing and Hatchable rollback source intact until every acceptance gate passes. This audit does not authorize a production route change or Hatchable shutdown.
