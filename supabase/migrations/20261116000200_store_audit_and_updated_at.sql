-- YSCMT Template Store: audit trail and updated timestamps.
-- Apply only after the initial Template Store migration on its dedicated project.
create table if not exists public.store_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists store_audit_logs_created_idx on public.store_audit_logs(created_at desc);
create index if not exists store_audit_logs_actor_idx on public.store_audit_logs(actor_user_id, created_at desc);
alter table public.store_audit_logs enable row level security;
drop policy if exists "Store admins read audit logs" on public.store_audit_logs;
create policy "Store admins read audit logs" on public.store_audit_logs for select to authenticated using (public.is_store_admin());
revoke all on public.store_audit_logs from anon, authenticated;
grant select on public.store_audit_logs to authenticated;
create or replace function public.set_store_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists store_products_updated_at on public.store_products;
create trigger store_products_updated_at before update on public.store_products for each row execute function public.set_store_updated_at();
drop trigger if exists store_installations_updated_at on public.store_installations;
create trigger store_installations_updated_at before update on public.store_installations for each row execute function public.set_store_updated_at();
