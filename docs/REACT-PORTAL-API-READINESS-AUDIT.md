# React Portal API and authentication readiness audit

Updated: 2026-11-27

## Scope

Read-only review of the linked `hackeryoung34-netizen/yscmt-react` source used by the main site's `/portal` rewrite. Files reviewed: `vite.config.js`, `src/App.tsx`, `src/services/api.ts`, `src/admin/services/adminApi.ts`, sign-in/sign-up page wrappers, dashboard, courses, and students pages.

## Confirmed positive findings

- Vite `base` is `/portal/`.
- React Router uses `basename="/portal"`.
- The app defines student/LMS pages and a separate `/admin` route, which maps to `/portal/admin` through the router basename.
- The main YSCMT site already rewrites `/portal` and `/portal/:path*` to this React deployment.

## Blocking findings

1. The API client defaults to `http://127.0.0.1:8000/api/` whenever `VITE_API_URL` is not configured. That is a developer-machine address, not a public production API. Production requests will fail if the environment variable is absent.
2. The client expects Django REST Framework-style endpoints, including `courses/`, `students/`, `dashboard/admin/`, and `token/refresh/`. No proof of a deployed, reachable backend for these routes was found in this review.
3. Authentication currently stores access and refresh JWTs in browser `localStorage` and attaches the access token through an Axios interceptor. This is not the same identity system as the archived Hatchable portal, and it does not yet demonstrate a verified account-claim bridge for the 5 legacy Student Portal users.
4. The React pages use a Django-style student/course schema (`username`, `first_name`, `last_name`, numeric IDs, `price`) while the imported Hatchable source and Neon archive use the legacy portal's own user and course schema. A deliberate data/API mapping is required; simply pointing this frontend at the Neon database is not compatible.
5. The admin dashboard and student directory call protected API endpoints, but production role enforcement must be implemented and tested server-side. Hiding pages in React is not authorization.

## Required work before production acceptance

- [ ] Confirm the Django backend repository, deployment target, and live health endpoint.
- [ ] Set a production `VITE_API_URL` to the actual HTTPS API origin (never localhost), or implement a same-origin API proxy after the backend exists.
- [ ] Verify all API routes used by the React app, including sign-in, sign-up, token refresh, course list, student list, admin dashboard, lessons, exams, certificates, and payments.
- [ ] Confirm secure token lifecycle, refresh rotation, logout invalidation, CORS, CSRF strategy where relevant, and HTTPS-only transport.
- [ ] Map legacy Student Portal users and records to the React/Django model without losing stable IDs, course ownership, enrolments, progress, certificates, or payment references.
- [ ] Test student, teacher, and admin role authorization with both allowed and denied requests.
- [ ] Test `/portal` and deep links on the YSCMT custom domain from mobile and desktop.
- [ ] Verify live Paystack initialization, signed webhooks, idempotency, and callback handling against the production backend.

## Decision

The React app is a suitable path/base foundation for `/portal`, but its API and identity dependencies are not yet production-proven. Keep the current routing target unchanged while the API and account migration are completed. Do not declare the portal migrated or disable Hatchable based on a READY frontend deployment alone.
