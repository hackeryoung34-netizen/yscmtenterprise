-- YSCMT Enterprise native live chat.
-- Visitor and administrator access is mediated only by the server-side API.
create table if not exists public.store_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_token_hash text not null,
  visitor_name text not null,
  visitor_email text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists store_chat_conversations_last_message_idx
  on public.store_chat_conversations(last_message_at desc);
create table if not exists public.store_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.store_chat_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor','admin')),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists store_chat_messages_conversation_created_idx
  on public.store_chat_messages(conversation_id, created_at asc);
alter table public.store_chat_conversations enable row level security;
alter table public.store_chat_messages enable row level security;
revoke all on public.store_chat_conversations, public.store_chat_messages from anon, authenticated, public;
grant select, insert, update, delete on public.store_chat_conversations, public.store_chat_messages to service_role;
