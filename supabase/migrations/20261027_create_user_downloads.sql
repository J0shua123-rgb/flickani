-- ============================================================
-- Migration: create user_downloads table + RLS
-- Run this in the Supabase SQL Editor for project:
--   https://zwtskyaqethvjvtrbozr.supabase.co
-- ============================================================

-- 1. Create the table
create table if not exists public.user_downloads (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  tmdb_id     text        not null,
  title       text        not null,
  poster_url  text,
  media_type  text        not null check (media_type in ('movie', 'tv')),
  quality     text        not null check (quality in ('1080p', '720p', '480p')),
  season      int         default 1,
  episode     int         default 1,
  created_at  timestamptz default timezone('utc', now()) not null
);

-- 2. Index for fast per-user lookups (covers all common queries)
create index if not exists user_downloads_user_id_idx
  on public.user_downloads (user_id, created_at desc);

-- 3. Enable Row Level Security
alter table public.user_downloads enable row level security;

-- 4. SELECT — users can only read their own rows
create policy "users_select_own_downloads"
  on public.user_downloads
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- 5. INSERT — users can only insert rows for themselves
create policy "users_insert_own_downloads"
  on public.user_downloads
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

-- 6. DELETE — users can delete their own download queue entries
create policy "users_delete_own_downloads"
  on public.user_downloads
  for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- 7. Grant table access to the authenticated role so PostgREST can reach it
grant select, insert, delete on public.user_downloads to authenticated;
