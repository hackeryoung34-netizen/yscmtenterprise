-- Customer loyalty points ledger. Points are earned only from verified paid invoices.
-- Rule: one point for each complete NGN 1,000 paid on an invoice. No cash redemption is enabled.
create table if not exists public.enterprise_customer_loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null check (customer_email=lower(customer_email)),
  customer_name text not null,
  points_delta integer not null check (points_delta > 0),
  event_type text not null check (event_type='earned'),
  source_type text not null check (source_type='invoice'),
  source_id uuid not null references public.enterprise_invoices(id) on delete restrict,
  description text not null,
  created_at timestamptz not null default now(),
  constraint enterprise_customer_loyalty_one_per_source unique(source_type,source_id)
);
create index if not exists enterprise_customer_loyalty_customer_idx on public.enterprise_customer_loyalty_ledger(lower(customer_email),created_at desc);
create index if not exists enterprise_customer_loyalty_balance_idx on public.enterprise_customer_loyalty_ledger(customer_email,created_at desc);
