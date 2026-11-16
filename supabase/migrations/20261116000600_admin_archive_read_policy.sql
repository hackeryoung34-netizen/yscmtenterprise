-- Permit verified store administrators to inspect private archive objects.
-- Required by Storage upsert operations and remains restricted to store_admin.
drop policy if exists "Store admins read template archives" on storage.objects;
create policy "Store admins read template archives"
on storage.objects for select
to authenticated
using (bucket_id = 'template-archives' and (select public.is_store_admin()));