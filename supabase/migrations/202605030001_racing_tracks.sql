create table if not exists public.racing_tracks (
  id uuid primary key default gen_random_uuid(),
  owner_player_id text not null,
  name text not null,
  track_map text not null,
  track_hash text not null,
  cell_count integer not null check (cell_count between 8 and 192),
  bounds jsonb not null,
  preview_points jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz null,
  deleted_at timestamptz null
);

comment on table public.racing_tracks is
  'Player-owned custom track library. Room and match rows keep their own track_map snapshot so later edits do not affect live or historical races.';

alter table public.racing_rooms
  add column if not exists track_id uuid null,
  add column if not exists track_name text null;

alter table public.racing_matches
  add column if not exists track_id uuid null,
  add column if not exists track_name text null;

create index if not exists racing_tracks_owner_updated_at_idx
  on public.racing_tracks(owner_player_id, updated_at desc)
  where deleted_at is null;

create unique index if not exists racing_tracks_owner_hash_unique
  on public.racing_tracks(owner_player_id, track_hash)
  where deleted_at is null;

create index if not exists racing_rooms_track_id_idx
  on public.racing_rooms(track_id)
  where track_id is not null;

create index if not exists racing_matches_track_id_idx
  on public.racing_matches(track_id)
  where track_id is not null;

alter table public.racing_tracks enable row level security;

drop policy if exists "anon can read own active racing tracks" on public.racing_tracks;
create policy "anon can read own active racing tracks"
  on public.racing_tracks
  for select
  to anon
  using (deleted_at is null);
