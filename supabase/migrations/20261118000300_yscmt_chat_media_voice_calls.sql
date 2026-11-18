-- WhatsApp-style media, voice notes, and 1:1 WebRTC call signalling for YSCMT Enterprise chat.
alter table public.store_chat_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_name text,
  add column if not exists media_mime text,
  add column if not exists media_size bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'store_chat_messages_message_type_check') then
    alter table public.store_chat_messages
      add constraint store_chat_messages_message_type_check
      check (message_type in ('text','image','video','audio','voice_note'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'store_chat_messages_media_metadata_check') then
    alter table public.store_chat_messages
      add constraint store_chat_messages_media_metadata_check
      check (
        (message_type = 'text' and media_path is null) or
        (message_type <> 'text' and media_path is not null and media_mime is not null and media_size is not null)
      );
  end if;
end $$;

create table if not exists public.store_chat_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.store_chat_conversations(id) on delete cascade,
  caller_type text not null check (caller_type in ('visitor','admin')),
  call_type text not null check (call_type in ('voice','video')),
  status text not null default 'ringing' check (status in ('ringing','active','rejected','ended','missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists store_chat_calls_conversation_status_idx
  on public.store_chat_calls(conversation_id, status, created_at desc);

create table if not exists public.store_chat_call_events (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.store_chat_calls(id) on delete cascade,
  sender_type text not null check (sender_type in ('visitor','admin')),
  event_type text not null check (event_type in ('offer','answer','ice','accepted','rejected','ended')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists store_chat_call_events_call_id_idx
  on public.store_chat_call_events(call_id, id);

alter table public.store_chat_calls enable row level security;
alter table public.store_chat_call_events enable row level security;
revoke all on public.store_chat_calls, public.store_chat_call_events from anon, authenticated, public;
grant select, insert, update, delete on public.store_chat_calls, public.store_chat_call_events to service_role;
grant usage, select on sequence public.store_chat_call_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'yscmt-chat-media',
  'yscmt-chat-media',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/webm','audio/wav','audio/x-wav']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
