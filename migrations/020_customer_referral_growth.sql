-- Customer referral growth. Separate from affiliate partner commissions.
create table if not exists public.enterprise_customer_referral_codes (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null unique check (customer_email=lower(customer_email)),
  customer_name text not null,
  referral_code text not null unique check (referral_code ~ '^[A-F0-9]{16}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.enterprise_customer_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_email text not null check (referrer_email=lower(referrer_email)),
  referrer_name text not null,
  referral_code text not null references public.enterprise_customer_referral_codes(referral_code) on delete restrict,
  prospect_name text not null,
  prospect_email text not null check (prospect_email=lower(prospect_email)),
  prospect_phone text not null,
  service_interest text not null check (service_interest in ('website_development','ecommerce','cybersecurity','it_training','software','other')),
  message text,
  status text not null default 'new' check (status in ('new','contacted','qualified','converted','declined')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(referral_code,prospect_email)
);
create index if not exists enterprise_customer_referrals_status_idx on public.enterprise_customer_referrals(status,created_at desc);
create index if not exists enterprise_customer_referrals_referrer_idx on public.enterprise_customer_referrals(referrer_email,created_at desc);
