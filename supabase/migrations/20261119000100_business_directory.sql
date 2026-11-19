-- YSCMT Enterprise Nigeria-first Business Directory
-- Additive migration only. Apply to an isolated Supabase development branch first.
-- Public visitors can read approved listings only. All writes go through server-side
-- API routes using the Supabase service role after validation/moderation.

create table if not exists public.business_directory_listings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(business_name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (category in (
    'technology', 'education', 'professional-services', 'health',
    'retail', 'food-hospitality', 'construction', 'transport',
    'beauty-wellness', 'agriculture', 'other'
  )),
  description text not null check (char_length(description) between 20 and 3000),
  state text not null check (char_length(state) between 2 and 80),
  city text not null check (char_length(city) between 2 and 100),
  street_address text,
  phone text not null check (char_length(phone) between 7 and 30),
  whatsapp text check (whatsapp is null or char_length(whatsapp) between 7 and 30),
  email text,
  website_url text,
  logo_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  is_featured boolean not null default false,
  featured_until timestamptz,
  submitted_by uuid references auth.users(id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint business_directory_feature_window check (
    is_featured = false or featured_until is not null
  )
);

create index if not exists business_directory_public_browse_idx
  on public.business_directory_listings (state, city, category, created_at desc)
  where status = 'approved';

create index if not exists business_directory_featured_idx
  on public.business_directory_listings (featured_until desc, created_at desc)
  where status = 'approved' and is_featured = true;

create table if not exists public.business_directory_audit_logs (
  id bigint generated always as identity primary key,
  listing_id uuid references public.business_directory_listings(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists business_directory_audit_listing_idx
  on public.business_directory_audit_logs (listing_id, created_at desc);

alter table public.business_directory_listings enable row level security;
alter table public.business_directory_audit_logs enable row level security;

drop policy if exists "Public can read approved business directory listings"
  on public.business_directory_listings;
create policy "Public can read approved business directory listings"
  on public.business_directory_listings
  for select
  to anon, authenticated
  using (
    status = 'approved'
    and (is_featured = false or featured_until > now() or featured_until is null
         or featured_until <= now())
  );

-- No anon/authenticated INSERT, UPDATE, or DELETE policies are intentional.
-- Submissions and moderation must be performed by server routes only.
-- Audit records are never directly readable or writable by public clients.

revoke all on public.business_directory_listings from anon, authenticated;
grant select on public.business_directory_listings to anon, authenticated;
revoke all on public.business_directory_audit_logs from anon, authenticated;

create or replace function public.set_business_directory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_directory_set_updated_at
  on public.business_directory_listings;
create trigger business_directory_set_updated_at
  before update on public.business_directory_listings
  for each row execute function public.set_business_directory_updated_at();
