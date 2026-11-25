-- YSCMT Enterprise revenue modules: service marketplace, advertising, affiliates,
-- digital service enquiries and communications subscription requests.
-- Additive-only migration. Existing Template Store and student data are untouched.

create table if not exists public.digital_service_inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  email text not null,
  phone text not null,
  service_key text not null,
  project_description text not null,
  budget_ngn bigint,
  status text not null default 'new' check (status in ('new','contacted','quoted','in_progress','completed','cancelled')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_provider_profiles (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  slug text not null unique,
  category text not null,
  description text not null,
  state text not null,
  city text not null,
  phone text not null,
  whatsapp text,
  email text not null,
  website_url text,
  service_tags text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.service_marketplace_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.service_provider_profiles(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  requester_phone text not null,
  service_description text not null,
  state text not null,
  city text not null,
  budget_ngn bigint,
  commission_rate numeric(5,4) not null default 0.1000 check (commission_rate >= 0 and commission_rate <= 1),
  commission_amount_ngn bigint,
  status text not null default 'new' check (status in ('new','contacted','accepted','completed','cancelled','rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advertiser_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  placement text not null check (placement in ('homepage','business-directory','jobs','services','marketplace')),
  headline text not null,
  description text not null,
  image_url text,
  destination_url text not null,
  budget_ngn bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','active','paused','completed','rejected')),
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text not null,
  website_url text,
  promotion_channels text[] not null default '{}',
  referral_code text not null unique,
  commission_rate numeric(5,4) not null default 0.1000 check (commission_rate >= 0 and commission_rate <= 1),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id) on delete restrict,
  referral_code text not null,
  ip_hash text,
  referrer text,
  landing_path text,
  status text not null default 'clicked' check (status in ('clicked','converted','approved','paid','void')),
  order_reference text,
  sale_amount_ngn bigint,
  commission_amount_ngn bigint,
  clicked_at timestamptz not null default now(),
  converted_at timestamptz,
  paid_at timestamptz
);

create table if not exists public.communications_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  monthly_price_ngn bigint,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.communications_subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.communications_plans(id) on delete restrict,
  customer_name text not null,
  business_name text not null,
  email text not null,
  phone text not null,
  team_size integer,
  requirements text,
  status text not null default 'requested' check (status in ('requested','quoted','pending_payment','active','past_due','cancelled')),
  payment_reference text unique,
  starts_at timestamptz,
  ends_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enterprise_module_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  module text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists digital_service_inquiries_status_idx on public.digital_service_inquiries(status, created_at desc);
create index if not exists service_provider_public_idx on public.service_provider_profiles(status, category, state, city, created_at desc);
create index if not exists service_marketplace_requests_status_idx on public.service_marketplace_requests(status, created_at desc);
create index if not exists advertiser_campaigns_public_idx on public.advertiser_campaigns(status, placement, starts_at, ends_at);
create index if not exists affiliate_referrals_partner_idx on public.affiliate_referrals(partner_id, clicked_at desc);
create index if not exists communications_subscriptions_status_idx on public.communications_subscriptions(status, created_at desc);

insert into public.communications_plans(slug,name,description,monthly_price_ngn,features,sort_order)
values
('starter','Business Starter','For small teams that need a professional business calling setup.',null,'["Business call routing","Team contact management","Basic call activity","Email support"]'::jsonb,1),
('growth','Business Growth','For growing teams that need shared calling workflows.',null,'["Everything in Starter","Multiple team members","Call queues and routing","Usage reporting","Priority support"]'::jsonb,2),
('enterprise','Enterprise','For organisations that need a tailored communications deployment.',null,'["Custom call flows","Advanced team controls","Integration planning","Dedicated onboarding","Custom service agreement"]'::jsonb,3)
on conflict (slug) do nothing;
