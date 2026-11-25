-- Add YSCMT Enterprise event hosting and sponsorship intake.
create table if not exists public.events_sponsorship_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('host_event','sponsor_event')),
  organisation_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null,
  event_title text not null,
  event_type text not null check (event_type in ('webinar','conference','workshop','training','exhibition','community','other')),
  event_date date,
  budget_ngn bigint,
  description text not null,
  status text not null default 'new' check (status in ('new','contacted','quoted','approved','completed','cancelled')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_sponsorship_status_idx on public.events_sponsorship_requests(status,created_at desc);
