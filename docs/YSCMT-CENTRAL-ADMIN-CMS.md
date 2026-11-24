# YSCMT Enterprise Central Admin — Homepage Content Management

## Implemented in the feature branch

The Central Admin has a **Website Content** workspace for the public homepage banner. It edits plain-text content and a same-page CTA link:

- Banner kicker and tagline
- Homepage description
- Side-panel heading and description
- Up to six short banner labels
- CTA button text and a section anchor such as `#services`

The public homepage requests `/api/site-content` and applies only published content. Text is inserted with `textContent`; the editor does not accept HTML or arbitrary external URLs.

## Draft and publish behavior

- **Save draft** writes `draft_content` and leaves currently published content unchanged.
- **Publish homepage** copies submitted content to `content`, clears the draft, and changes status to `published`.
- The public endpoint returns only rows with `status = 'published'`.
- The public response is cached for up to 60 seconds, with stale-while-revalidate support.
- Both CMS content and audit history are stored in Neon through the server-side `REVENUE_DATABASE_URL` connection.

## Neon database prerequisite

Before deploying this feature, apply:

`neon/migrations/007_site_content_management.sql`

Target the **YSCMT-Revenue-Development** project and its **revenue-development** branch first. Do not apply this migration to Supabase, the Student Portal database, or the Neon production branch as part of this feature-branch work.

The migration creates:
- `public.site_content_pages` for published and draft homepage content.
- `public.site_content_audit_logs` for CMS save/publish history.

The API uses the existing Neon server-side connection. No Supabase service-role key is used for CMS storage. The existing sign-in flow may still validate the administrator's identity with the current auth provider; role records and CMS data are read from Neon.

## Administrator permissions

The API requires the Central Admin permission `content.manage`. Super Admin has access through the wildcard permission. The Content Manager role includes `content.manage`; existing role rows should be refreshed by a Super Admin role update if they were created before this permission was added.

The CMS audit records are included in Central Admin Activity History.

## Safe release sequence

1. Confirm the YSCMT Revenue Neon project and the `revenue-development` branch.
2. Apply the Neon CMS migration to development only after owner approval.
3. Ensure Vercel has the server-side `REVENUE_DATABASE_URL` for the intended Neon branch.
4. Deploy the feature branch only after the owner approves the release.
5. Sign in as a Super Admin or a Content Manager with the permission, save a draft, then publish when ready.

No database migration, production deployment, DNS change, production cutover, or Hatchable shutdown is performed by these code changes.
