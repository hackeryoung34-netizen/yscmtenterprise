-- YSCMT production revenue safeguards: featured checkout throttling and webhook idempotency.
-- Apply to the isolated revenue-production Neon branch only.
alter table public.revenue_submission_rate_limits
  drop constraint if exists revenue_submission_rate_limits_feature_check;
alter table public.revenue_submission_rate_limits
  add constraint revenue_submission_rate_limits_feature_check
  check (feature in ('business_directory','job_ads','featured_checkout'));

create table if not exists public.featured_business_payment_webhook_events (
  id bigint generated always as identity primary key,
  payload_hash char(64) not null unique,
  event_type varchar(80) not null,
  reference varchar(100),
  transaction_id bigint,
  processing_status varchar(16) not null default 'received'
    check (processing_status in ('received','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists featured_payment_webhook_reference_idx
  on public.featured_business_payment_webhook_events(reference, received_at desc);
