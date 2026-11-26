-- Manual customer retention contact history. No automatic messaging or referral payout.
create table if not exists public.enterprise_customer_followups (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null check (customer_email=lower(customer_email)),
  customer_name text not null,
  segment text not null check (segment in ('active','at_risk','win_back')),
  channel text not null check (channel in ('email','whatsapp','sms','phone','other')),
  outcome text not null check (outcome in ('contacted','no_response','interested','not_interested','converted')),
  notes text,
  follow_up_at date,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists enterprise_customer_followups_email_idx
  on public.enterprise_customer_followups(customer_email,created_at desc);
create index if not exists enterprise_customer_followups_due_idx
  on public.enterprise_customer_followups(follow_up_at) where follow_up_at is not null;
