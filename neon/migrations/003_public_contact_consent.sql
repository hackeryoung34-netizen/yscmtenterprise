-- Track consent to publish employer/business contact details.
-- Apply only to the dedicated Neon revenue database.
alter table public.business_directory_listings
  add column if not exists public_contact_consent boolean not null default false,
  add column if not exists public_contact_consent_at timestamptz;

alter table public.job_ads
  add column if not exists public_contact_consent boolean not null default false,
  add column if not exists public_contact_consent_at timestamptz;
