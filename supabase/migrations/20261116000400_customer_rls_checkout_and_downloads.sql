-- Secure customer-scoped writes and downloads without exposing a service-role key to Vercel.
-- Every customer write is constrained by ownership, current product price, and pending/paid state.

create policy "Customers create only their own pending orders"
on public.store_orders for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and payment_provider is null
  and provider_reference is null
  and paid_at is null
  and exists (
    select 1
    from public.store_products p
    where p.id = product_id
      and p.status = 'published'
      and (
        (purchase_type = 'source_code' and amount_ngn = p.download_price_ngn)
        or
        (purchase_type = 'installation'
          and p.installation_price_ngn is not null
          and amount_ngn = p.installation_price_ngn)
      )
  )
);

create policy "Customers create installation requests for paid orders"
on public.store_installations for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'requested'
  and admin_notes = ''
  and exists (
    select 1
    from public.store_orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
      and o.status = 'paid'
      and o.purchase_type = 'installation'
  )
);

create policy "Store admins write audit logs"
on public.store_audit_logs for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (select public.is_store_admin())
);
grant insert on public.store_audit_logs to authenticated;
grant usage, select on sequence public.store_audit_logs_id_seq to authenticated;

create policy "Customers download only purchased source archives"
on storage.objects for select
to authenticated
using (
  bucket_id = 'template-archives'
  and exists (
    select 1
    from public.store_orders o
    join public.store_products p on p.id = o.product_id
    where o.user_id = (select auth.uid())
      and o.status = 'paid'
      and o.purchase_type = 'source_code'
      and p.artifact_path = storage.objects.name
  )
);