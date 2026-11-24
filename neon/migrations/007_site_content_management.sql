-- YSCMT Enterprise homepage CMS storage on Neon.
-- Run against the YSCMT-Revenue-Development / revenue-development branch first.
-- Authentication identity UUIDs are issued by the existing sign-in provider;
-- all CMS records and audit history are stored in Neon.
CREATE TABLE IF NOT EXISTS public.site_content_pages (
  page_key text PRIMARY KEY CHECK (page_key IN ('home')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  draft_content jsonb CHECK (draft_content IS NULL OR jsonb_typeof(draft_content) = 'object'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.site_content_audit_logs (
  id bigserial PRIMARY KEY,
  page_key text NOT NULL CHECK (page_key IN ('home')),
  actor_user_id uuid,
  action text NOT NULL CHECK (action IN ('created','updated','published','unpublished')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_content_audit_logs_created_idx
  ON public.site_content_audit_logs (created_at DESC);
