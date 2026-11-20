# Neon setup for YSCMT Enterprise (development only)

## Repository facts

- This repository is a static HTML/JavaScript site with Vercel Node.js API Functions.
- It has no `package.json`, no framework build script, and no `npm run build` command today.
- Keep existing Supabase-backed Template Store, chat/call APIs, and Paystack flows unchanged.
- Neon is for the new Business Directory / Job Board data only.

## Important branch safety

The Neon CLI setup command may link the folder to a branch named `production`. Do **not** run `neon deploy` while that is the active branch. Provision the new services on a dedicated development branch first.

After `neon init` completes, from the repository root:

```bash
neon checkout development --create
neon status
neon config plan
```

Confirm `neon status` shows the intended Neon project and the `development` branch before applying anything. Only then:

```bash
neon deploy
neon env pull --file .env.local
```

If the project uses `.env` instead of `.env.local`, keep using that same file. Never commit either file.

## Object Storage

Use a private bucket for submitted business logos and future job attachments. Suggested bucket name: `yscmt-revenue-assets`.

Neon Object Storage is S3-compatible. The expected server-only variables after provisioning include:

- `AWS_ENDPOINT_URL_S3`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

The bucket should be private by default. Do not expose these credentials to browser JavaScript or use `NEXT_PUBLIC_` / `VITE_` prefixes.

## Application integration plan

- PostgreSQL: use `@neondatabase/serverless` from Vercel Node.js API Functions. Initialize lazily at request time so builds do not fail when local secrets are absent.
- Object Storage: use a server-side S3-compatible client (for example `aws4fetch` or AWS SDK) with the Neon-issued `AWS_*` variables. Keep upload authorization, file-size/type validation, and object keys on the server.
- Database records should store object keys, not secret credentials or public bucket URLs.
- Do not reuse Supabase Template Store tables or Paystack order/RPC logic for directory/job-board data.

## Verification

This repository currently has no `npm run build`; do not invent a framework build or claim it passed. Once local CLI setup and env files exist, add a focused validation script appropriate to this static/Vercel Functions project, then run:
- JavaScript syntax checks for every `api/**/*.js` file.
- A read-only Neon Postgres connectivity query from a server-side test route/script.
- A private Object Storage PUT, GET, and DELETE smoke test using a temporary test object.
- A Vercel Preview build/deployment check only; never Production during this phase.

Never print environment variable values in logs or paste them into chat.


## Current repository implementation

The repository now includes:
- `api/_lib/revenue-db.js`: lazy Neon serverless SQL client, using `REVENUE_DATABASE_URL`.
- `api/_lib/revenue-storage.js`: private S3-compatible Neon storage client, using the branch-scoped `AWS_*` credentials.
- `api/revenue/health.js`: private diagnostic route; requires `Authorization: Bearer <REVENUE_HEALTH_TOKEN>` and checks Postgres plus bucket availability.
- `neon/migrations/001_business_directory.sql`: Neon-native Business Directory schema. It intentionally does not use Supabase Auth roles or RLS; all reads/writes must go through authenticated server routes.
- `scripts/test-revenue-services.js`: creates a temporary object, reads it back, and deletes it after checking a Postgres query.

## Local development checks

After dependencies and development-only environment variables are configured:

```bash
npm install
npm run build
npm run test:revenue-services
```

The build command is a syntax/build sanity check for this static-site + Vercel Functions repository. It is not a framework bundler. The service smoke test requires a real development Neon branch and a private bucket; it must not be run against production.

The CLI-generated `neon.ts` is intentionally not committed yet: run the requested `neon init` locally first, inspect its output, and confirm the target branch before provisioning. Do not run `neon deploy` while linked to the production branch.
