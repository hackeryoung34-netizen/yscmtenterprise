-- Durable, privacy-preserving submission throttling for public revenue forms.
-- Store HMAC hashes of source IPs, never raw addresses.
create table if not exists public.revenue_submission_rate_limits (
  ip_hash char(64) not null,
  feature varchar(32) not null check (feature in ('business_directory','job_ads')),
  window_started_at timestamptz not null default now(),
  submission_count integer not null default 1 check (submission_count between 1 and 3),
  primary key (ip_hash, feature)
);
create index if not exists revenue_submission_rate_limits_window_idx
  on public.revenue_submission_rate_limits (window_started_at);
