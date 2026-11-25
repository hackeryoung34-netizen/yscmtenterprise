-- Customer reviews and satisfaction, tied to a completed YSCMT support interaction.
create table if not exists public.enterprise_customer_reviews (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('support_ticket')),
  source_id uuid not null references public.enterprise_support_tickets(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (length(trim(review_text)) between 10 and 1200),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_response text,
  moderated_by uuid,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enterprise_customer_reviews_one_per_source unique(source_type,source_id),
  constraint enterprise_customer_reviews_email_check check (customer_email=lower(customer_email))
);
create index if not exists enterprise_customer_reviews_public_idx
  on public.enterprise_customer_reviews(status,created_at desc);
create index if not exists enterprise_customer_reviews_customer_idx
  on public.enterprise_customer_reviews(lower(customer_email),created_at desc);
