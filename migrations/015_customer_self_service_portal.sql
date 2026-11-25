-- Customer self-service portal access links.
-- Tokens are high entropy, stored only as SHA-256 hashes, and expire after 30 days.
create table if not exists public.enterprise_customer_portal_access (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null unique,
  customer_name text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_by uuid not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enterprise_customer_portal_email_check check (customer_email = lower(customer_email)),
  constraint enterprise_customer_portal_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists enterprise_customer_portal_access_expiry_idx
  on public.enterprise_customer_portal_access(expires_at)
  where revoked_at is null;
