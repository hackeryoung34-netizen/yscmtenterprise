-- YSCMT Enterprise billing, invoice and cash ledger.
-- Additive migration: preserves existing Template Store and enterprise records.
create sequence if not exists public.enterprise_invoice_number_seq;

create table if not exists public.enterprise_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default (
    'YSCMT-' || to_char(current_date,'YYYY') || '-' ||
    lpad(nextval('public.enterprise_invoice_number_seq')::text,6,'0')
  ),
  module text not null check (module in ('digital_services','marketplace','advertising','communications','events','other')),
  entity_id uuid,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  description text not null,
  amount_ngn bigint not null check (amount_ngn > 0),
  currency text not null default 'NGN' check (currency='NGN'),
  status text not null default 'issued' check (status in ('draft','issued','pending','paid','overdue','cancelled')),
  due_at date,
  access_token_hash text not null,
  paystack_reference text unique,
  paystack_transaction_id bigint,
  paid_at timestamptz,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enterprise_invoices_status_created_idx on public.enterprise_invoices(status,created_at desc);
create index if not exists enterprise_invoices_entity_idx on public.enterprise_invoices(module,entity_id);
create index if not exists enterprise_invoices_customer_email_idx on public.enterprise_invoices(lower(customer_email));

create table if not exists public.enterprise_payment_webhook_events (
  id bigserial primary key,
  payload_hash char(64) not null unique,
  event_type text not null,
  reference text,
  transaction_id bigint,
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists enterprise_payment_webhook_reference_idx on public.enterprise_payment_webhook_events(reference);

create table if not exists public.enterprise_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,
  description text not null,
  amount_ngn bigint not null check (amount_ngn > 0),
  vendor text,
  reference text,
  status text not null default 'paid' check (status in ('paid','pending','void')),
  recorded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists enterprise_expenses_date_idx on public.enterprise_expenses(expense_date desc);

create table if not exists public.enterprise_settlements (
  id uuid primary key default gen_random_uuid(),
  beneficiary_type text not null check (beneficiary_type in ('affiliate','provider','other')),
  beneficiary_id uuid,
  beneficiary_name text not null,
  amount_ngn bigint not null check (amount_ngn > 0),
  status text not null default 'pending' check (status in ('pending','paid','void')),
  payment_method text,
  payment_reference text,
  notes text,
  created_by uuid,
  paid_by uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists enterprise_settlements_status_idx on public.enterprise_settlements(status,created_at desc);

create table if not exists public.enterprise_billing_audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists enterprise_billing_audit_created_idx on public.enterprise_billing_audit_logs(created_at desc);
