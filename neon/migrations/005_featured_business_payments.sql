-- YSCMT Featured Business Paystack test checkout.
-- Apply only to Neon YSCMT-Revenue-Development / revenue-development.
create table if not exists public.featured_business_payment_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.business_directory_listings(id) on delete restrict,
  reference text not null unique check (reference ~ '^[A-Za-z0-9.=-]{12,100}$'),
  customer_email text not null,
  amount_kobo integer not null default 500000 check (amount_kobo = 500000),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','paid','failed','needs_review')),
  paystack_transaction_id bigint,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists featured_business_payment_listing_idx
  on public.featured_business_payment_orders(listing_id, created_at desc);
create index if not exists featured_business_payment_status_idx
  on public.featured_business_payment_orders(status, created_at desc);
