-- YSCMT Enterprise homepage content management.
-- Apply only to the dedicated YSCMT Enterprise website Supabase project.
create table if not exists public.site_content_pages (
  page_key text primary key check (page_key in ('home')),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),\n  draft_content jsonb check (draft_content is null or jsonb_typeof(draft_content) = 'object'),
  status text not null default 'draft' check (status in ('draft','published')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.site_content_audit_logs (
  id bigint generated always as identity primary key,
  page_key text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','updated','published','unpublished')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists site_content_audit_logs_created_idx
  on public.site_content_audit_logs(created_at desc);
alter table public.site_content_pages enable row level security;
alter table public.site_content_audit_logs enable row level security;
revoke all on public.site_content_pages, public.site_content_audit_logs from public;
revoke all on public.site_content_pages, public.site_content_audit_logs from anon, authenticated;
grant select on public.site_content_pages to anon, authenticated;
drop policy if exists "Public can read published website content" on public.site_content_pages;
create policy "Public can read published website content"
  on public.site_content_pages for select to anon, authenticated
  using (status = 'published');

-- Server-side Vercel handlers use the service role; browser roles receive no write access.
grant all on public.site_content_pages, public.site_content_audit_logs to service_role;
grant usage, select on sequence public.site_content_audit_logs_id_seq to service_role;
