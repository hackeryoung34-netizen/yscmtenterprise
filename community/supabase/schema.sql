-- YSCMT Community database schema for Supabase
create table if not exists public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  role text not null check (role in ('student','teacher','mentor')),
  country text not null check (char_length(country) between 2 and 80),
  field text not null default '' check (char_length(field) <= 120),
  bio text not null default '' check (char_length(bio) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now()
);
create index if not exists community_profiles_created_idx on public.community_profiles(created_at desc);
create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
alter table public.community_profiles enable row level security;
alter table public.community_posts enable row level security;
drop policy if exists "Profiles are public to read" on public.community_profiles;
create policy "Profiles are public to read" on public.community_profiles for select using (true);
drop policy if exists "Members create their own profile" on public.community_profiles;
create policy "Members create their own profile" on public.community_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members update their own profile" on public.community_profiles;
create policy "Members update their own profile" on public.community_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Discussions are public to read" on public.community_posts;
create policy "Discussions are public to read" on public.community_posts for select using (true);
drop policy if exists "Members publish discussions" on public.community_posts;
create policy "Members publish discussions" on public.community_posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Authors delete their discussions" on public.community_posts;
create policy "Authors delete their discussions" on public.community_posts for delete to authenticated using (auth.uid() = user_id);
