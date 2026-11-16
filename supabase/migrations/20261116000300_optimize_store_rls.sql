-- YSCMT Template Store: consolidate read policies and index installation ownership.
-- Keep customer reads scoped to their own records and administrator access explicit.

drop policy if exists "Published products are publicly readable" on public.store_products;
drop policy if exists "Store admins manage products" on public.store_products;
create policy "Published products and store admin reads"
on public.store_products for select
to anon, authenticated
using (status = 'published' or (select public.is_store_admin()));
create policy "Store admins insert products"
on public.store_products for insert
to authenticated
with check ((select public.is_store_admin()));
create policy "Store admins update products"
on public.store_products for update
to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));
create policy "Store admins delete products"
on public.store_products for delete
to authenticated
using ((select public.is_store_admin()));

drop policy if exists "Customers read their own orders" on public.store_orders;
drop policy if exists "Store admins manage orders" on public.store_orders;
create policy "Customers and admins read orders"
on public.store_orders for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_store_admin()));
create policy "Store admins insert orders"
on public.store_orders for insert
to authenticated
with check ((select public.is_store_admin()));
create policy "Store admins update orders"
on public.store_orders for update
to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));
create policy "Store admins delete orders"
on public.store_orders for delete
to authenticated
using ((select public.is_store_admin()));

drop policy if exists "Customers read their own installation requests" on public.store_installations;
drop policy if exists "Store admins manage installation requests" on public.store_installations;
create policy "Customers and admins read installation requests"
on public.store_installations for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_store_admin()));
create policy "Store admins insert installation requests"
on public.store_installations for insert
to authenticated
with check ((select public.is_store_admin()));
create policy "Store admins update installation requests"
on public.store_installations for update
to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));
create policy "Store admins delete installation requests"
on public.store_installations for delete
to authenticated
using ((select public.is_store_admin()));

create index if not exists store_installations_user_idx
on public.store_installations(user_id);