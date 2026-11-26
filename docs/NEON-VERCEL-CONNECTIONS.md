# Neon to Vercel connection setup

The migration branch contains a server-side-only health endpoint at `/api/migration/neon-health`. It uses the existing `@neondatabase/serverless` dependency. It does not expose database URLs or query user records.

## Required Vercel environment variables

Create these as **Encrypted** variables in the YSCMT Enterprise Vercel project:

- `YSCMT_STUDENT_PORTAL_DATABASE_URL` — Student Portal Neon database connection URI
- `YSCMT_CONNECT_DATABASE_URL` — Connect Neon database connection URI
- `YSCMT_ADFORGE_DATABASE_URL` — AdForge AI Neon database connection URI

First add them to the **Preview** environment for the migration branch only. Do not add them to Production until app authentication, role permissions, storage and acceptance checks have passed.

Use the Neon pooled connection URI for serverless runtime when available. Use dedicated least-privilege application roles rather than database-owner credentials. Do not place connection strings in source code, client-side JavaScript, issue comments, or public logs.

## Health check

After the variables are configured on a preview deployment, call:

`GET /api/migration/neon-health`

A healthy response must show all three apps as configured, connected, and schema-ready. The endpoint returns only status flags and app names.

## Production gate

The health check proves connectivity and the presence of one expected table per app. It does not prove authentication, authorization, complete data integrity, storage/media availability, payment processing, or feature behavior. Those require separate end-to-end acceptance checks before cutover.
