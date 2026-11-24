# YSCMT Enterprise Central Admin — Homepage Content Management

## Implemented in the feature branch

The Central Admin has a **Website Content** workspace for the public homepage banner. It edits only plain-text content and a same-page CTA link:

- Banner kicker and tagline
- Homepage description
- Side-panel heading and description
- Up to six short banner labels
- CTA button text and a section anchor such as `#services`

The public homepage requests `/api/site-content` and applies only published content. Text is inserted with `textContent`; the editor does not accept HTML or arbitrary external URLs.

## Draft and publish behavior

- **Save draft** writes `draft_content` and leaves the currently published homepage content unchanged.
- **Publish homepage** copies the submitted content to `content`, clears the draft, and changes the page status to `published`.
- The public endpoint returns only rows with `status = 'published'`.
- The public response is cached for up to 60 seconds, with stale-while-revalidate support.

## Database prerequisite

Before deploying this feature, apply:

`supabase/migrations/20261124000100_site_content_management.sql`

Apply it only to the Supabase project configured for the YSCMT Enterprise website (the same project used by the website's existing `SUPABASE_URL` and `SUPABASE_ANON_KEY`). Do not apply it to the YSCMT Student Portal database or the Neon migration database.

The migration creates:
- `public.site_content_pages` for published and draft homepage content.
- `public.site_content_audit_logs` for CMS save/publish history.

Anonymous/authenticated browser roles can select published content only. Writes are made by the Vercel server-side API using `SUPABASE_SERVICE_ROLE_KEY`; never put this key in browser code.

## Administrator permissions

The API requires the Central Admin permission `content.manage`. Super Admin has access through the wildcard permission. The Content Manager role now includes `content.manage`; existing role rows should be refreshed by a Super Admin role update if they were created before this permission was added.

The CMS audit records are included in Central Admin Activity History.

## Safe release sequence

1. Confirm the configured website Supabase project.
2. Apply the migration to that website project.
3. Confirm the Vercel server-side environment has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy the feature branch only after the owner approves the release.
5. Sign in as a Super Admin or a Content Manager with the permission, save a draft, then publish when ready.

No database migration, production deployment, DNS change, production cutover, or Hatchable shutdown is performed by the code changes in this branch.
