-- Remove redundant administrator INSERT policies. Admins retain UPDATE/DELETE
-- management; order and installation creation stays customer-scoped and validated.
drop policy if exists "Store admins insert orders" on public.store_orders;
drop policy if exists "Store admins insert installation requests" on public.store_installations;