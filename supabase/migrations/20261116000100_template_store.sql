-- YSCMT Template Store: initial schema.
-- Apply only to a dedicated Template Store Supabase project, never to Student Portal or Community.
create extension if not exists pgcrypto;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'store_admin', false);
$$;

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('Business Websites','E-commerce','Portfolio','School & LMS','Blog & News','Admin Dashboard')),
  summary text not null default '',
  description text not null default '',
  screenshot_urls text[] not null default '{}',
  demo_url text,
  technologies text[] not null default '{}',
  license_type text not null default 'single-project',
  version text not null default '1.0.0',
  download_price_ngn integer not null default 0 check (download_price_ngn >= 0),
  installation_price_ngn integer check (installation_price_ngn is null or installation_price_ngn >= 0),
  artifact_path text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_product_has_artifact check (status <> 'published' or artifact_path is not null)
);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.store_products(id) on delete restrict,
  purchase_type text not null check (purchase_type in ('source_code','installation')),
  amount_ngn integer not null check (amount_ngn >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  payment_provider text,
  provider_reference text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists store_orders_user_created_idx on public.store_orders(user_id, created_at desc);
create index if not exists store_orders_product_idx on public.store_orders(product_id);

create table if not exists public.store_installations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.store_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  requirements text not null default '',
  status text not null default 'requested' check (status in ('requested','reviewing','in_progress','completed','cancelled')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_products enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_installations enable row level security;

drop policy if exists "Published products are publicly readable" on public.store_products;
create policy "Published products are publicly readable"
on public.store_products for select
to anon, authenticated
using (status = 'published' or public.is_store_admin());

drop policy if exists "Store admins manage products" on public.store_products;
create policy "Store admins manage products"
on public.store_products for all
to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "Customers read their own orders" on public.store_orders;
create policy "Customers read their own orders"
on public.store_orders for select
to authenticated
using (auth.uid() = user_id or public.is_store_admin());

drop policy if exists "Store admins manage orders" on public.store_orders;
create policy "Store admins manage orders"
on public.store_orders for all
to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "Customers read their own installation requests" on public.store_installations;
create policy "Customers read their own installation requests"
on public.store_installations for select
to authenticated
using (auth.uid() = user_id or public.is_store_admin());

drop policy if exists "Store admins manage installation requests" on public.store_installations;
create policy "Store admins manage installation requests"
on public.store_installations for all
to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

-- Private bucket: files are delivered only by the authenticated server-side download endpoint.
insert into storage.buckets (id, name, public)
values ('template-archives', 'template-archives', false)
on conflict (id) do update set public = false;

drop policy if exists "Store admins upload template archives" on storage.objects;
create policy "Store admins upload template archives"
on storage.objects for insert
to authenticated
with check (bucket_id = 'template-archives' and public.is_store_admin());

drop policy if exists "Store admins update template archives" on storage.objects;
create policy "Store admins update template archives"
on storage.objects for update
to authenticated
using (bucket_id = 'template-archives' and public.is_store_admin())
with check (bucket_id = 'template-archives' and public.is_store_admin());

drop policy if exists "Store admins delete template archives" on storage.objects;
create policy "Store admins delete template archives"
on storage.objects for delete
to authenticated
using (bucket_id = 'template-archives' and public.is_store_admin());

revoke all on public.store_products, public.store_orders, public.store_installations from anon;
grant select on public.store_products to anon, authenticated;
grant select on public.store_orders, public.store_installations to authenticated;
grant insert, update, delete on public.store_products, public.store_orders, public.store_installations to authenticated;
