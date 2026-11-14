# YSCMT Community

This static community app is served by the main YSCMT Enterprise Vercel project at `/community/` and uses its own Supabase project.

## Supabase project

- Project: `YSCMT-Community`
- Project ref: `tfaraznupjwpkyflwdjg`
- Region: `eu-west-3` (Paris)
- API URL: `https://tfaraznupjwpkyflwdjg.supabase.co`

The browser client is configured in `config.js` with the public publishable key. Do not add a Supabase `service_role` or secret key to this repository.

## Authentication URL configuration

In Supabase Dashboard → Authentication → URL Configuration:

- Set Site URL to `https://www.yscmtenterprise.ng/community/`.
- Add these Redirect URLs:
  - `https://yscmtenterprise.ng/community/`
  - `https://www.yscmtenterprise.ng/community/`
  - `https://yscmtenterprise-l6aorgeir-yscmtonlines-projects.vercel.app/community/`

Add any new Vercel preview URL as a redirect URL before testing email sign-in from that preview.

## Database

The schema is in `supabase/schema.sql`. It creates `community_profiles` and `community_posts`, enables Row Level Security, and limits profile changes and discussion publishing/deletion to the authenticated owner.

## Migration note

Hatchable remains the legacy source until profiles and any other required data have been exported, imported, and verified. Existing members will need to sign in again using the email magic link; Hatchable passwords/sessions are not portable.
