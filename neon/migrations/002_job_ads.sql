-- YSCMT Enterprise revenue database: Job Ads
-- Apply only to the dedicated Neon revenue-development branch.
-- Applicant CV files and applicant personal-data records are intentionally
-- out of scope for this first release.

create table if not exists public.job_ads (
  id uuid primary key default gen_random_uuid(),
  job_title varchar(160) not null,
  employer_name varchar(160) not null,
  description text not null,
  category varchar(40) not null check (category in (
    'technology','sales','administration','customer-service','finance',
    'education','healthcare','skilled-trades','logistics','hospitality','other'
  )),
  employment_type varchar(24) not null check (employment_type in (
    'full-time','part-time','contract','internship','temporary','remote'
  )),
  state varchar(80) not null,
  city varchar(100) not null,
  is_remote boolean not null default false,
  salary_min numeric(14,2) check (salary_min is null or salary_min >= 0),
  salary_max numeric(14,2) check (salary_max is null or salary_max >= 0),
  salary_period varchar(16) not null default 'monthly'
    check (salary_period in ('hourly','daily','weekly','monthly','yearly')),
  application_email varchar(254),
  application_url varchar(2048),
  whatsapp varchar(30),
  closing_date date,
  status varchar(16) not null default 'pending'
    check (status in ('pending','approved','rejected','suspended','expired')),
  admin_notes varchar(2000),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_ads_salary_range check (
    salary_min is null or salary_max is null or salary_max >= salary_min
  ),
  constraint job_ads_application_method check (
    application_email is not null or application_url is not null or whatsapp is not null
  )
);

create index if not exists job_ads_public_search_idx
  on public.job_ads (status, state, category, created_at desc);
create index if not exists job_ads_closing_date_idx
  on public.job_ads (closing_date);

create table if not exists public.job_ad_audit_logs (
  id uuid primary key default gen_random_uuid(),
  job_ad_id uuid not null references public.job_ads(id) on delete cascade,
  actor_user_id uuid not null,
  action varchar(40) not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists job_ad_audit_logs_job_created_idx
  on public.job_ad_audit_logs (job_ad_id, created_at desc);

create trigger job_ads_set_updated_at
  before update on public.job_ads
  for each row execute function public.set_business_directory_updated_at();
