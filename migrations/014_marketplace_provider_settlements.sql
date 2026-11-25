-- Link marketplace provider settlements to the completed request that earned them.
-- Additive and idempotent; existing settlements remain unchanged.
alter table public.enterprise_settlements
  add column if not exists source_module text,
  add column if not exists source_entity_id uuid;
create unique index if not exists enterprise_settlements_source_unique
  on public.enterprise_settlements(source_module,source_entity_id)
  where source_module is not null and source_entity_id is not null;
create index if not exists enterprise_settlements_beneficiary_idx
  on public.enterprise_settlements(beneficiary_type,beneficiary_id,created_at desc);
