-- YSCMT Enterprise revenue database: Business Directory
-- Apply only to the dedicated Neon development branch.
-- All writes are server-side; do not expose direct database credentials to clients.

create extension if not exists pgcrypto;

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
  logo_object_key text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  is_featured boolean not null default false,
  featured_until timestamptz,
  submitted_by text,
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
  actor_user_id text,
  action text not null check (char_length(action) between 2 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists business_directory_audit_listing_idx
  on public.business_directory_audit_logs (listing_id, created_at desc);

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
