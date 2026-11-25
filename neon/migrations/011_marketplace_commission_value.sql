-- Record completed marketplace transaction values so YSCMT can calculate agreed commissions.
alter table public.service_marketplace_requests
  add column if not exists service_value_ngn bigint check (service_value_ngn is null or service_value_ngn >= 0);
