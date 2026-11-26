# Student Portal: first Vercel API ports

These serverless endpoints are the first Hatchable-independent Student Portal API ports.

## Routes

- `GET /api/student-portal/courses` — public active course catalogue.
- `GET /api/student-portal/certificate-verify?code=YSCMT-YYYY-XXXXXXXXXXXX` — public certificate verification.

Both use the dedicated Neon database through `@neondatabase/serverless`. They use parameterized SQL, do not expose database credentials, and return generic server errors rather than SQL details.

## Required encrypted environment variable

- `YSCMT_STUDENT_PORTAL_DATABASE_URL`

Configure this only in the Vercel Preview environment for the migration branch until the preview and data access are verified. Do not commit the connection URI.

## Scope

These two routes are deliberately public and read-only. Student enrolments, profile updates, admin actions, classroom access, exams, payments, and teacher operations remain blocked from production until a shared authentication and authorization layer is implemented. Do not treat this initial API port as a complete portal migration.
