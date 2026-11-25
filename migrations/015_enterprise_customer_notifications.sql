-- Durable customer notification outbox for YSCMT Enterprise.
-- Messages are prepared for admin delivery; this migration does not enable email sending.
create table if not exists public.enterprise_customer_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null unique,
  event_type text not null check (event_type in ('invoice_issued','invoice_paid','invoice_overdue','subscription_due','subscription_renewal_invoice')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  subject text not null,
  message text not null,
  related_invoice_id uuid references public.enterprise_invoices(id) on delete set null,
  related_subscription_id uuid,
  status text not null default 'queued' check (status in ('queued','sent','cancelled')),
  copied_at timestamptz,
  sent_at timestamptz,
  sent_channel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enterprise_customer_notifications_status_idx
  on public.enterprise_customer_notifications(status,created_at desc);
create index if not exists enterprise_customer_notifications_email_idx
  on public.enterprise_customer_notifications(customer_email,created_at desc);
