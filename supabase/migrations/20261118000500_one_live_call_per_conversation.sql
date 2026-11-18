create unique index if not exists store_chat_one_live_call_per_conversation_idx
on public.store_chat_calls(conversation_id)
where status in ('ringing','active');
