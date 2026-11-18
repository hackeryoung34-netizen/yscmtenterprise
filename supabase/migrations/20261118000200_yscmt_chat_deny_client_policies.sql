-- Explicit deny-all policies for direct anon/authenticated access.
-- The server-side API uses service_role; direct clients must not read or write chat records.
drop policy if exists "No direct client access to chat conversations" on public.store_chat_conversations;
create policy "No direct client access to chat conversations"
on public.store_chat_conversations for all
to anon, authenticated
using (false)
with check (false);
drop policy if exists "No direct client access to chat messages" on public.store_chat_messages;
create policy "No direct client access to chat messages"
on public.store_chat_messages for all
to anon, authenticated
using (false)
with check (false);
