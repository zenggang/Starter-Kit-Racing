create extension if not exists "pgcrypto";

create table if not exists public.racing_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_player_id text not null,
  status text not null check (status in ('waiting', 'racing', 'finished', 'closed')),
  lap_target integer not null default 3 check (lap_target between 1 and 10),
  track_map text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  expires_at timestamptz not null,
  closed_reason text null
);

create table if not exists public.racing_room_players (
  room_id uuid not null references public.racing_rooms(id) on delete cascade,
  player_id text not null,
  nickname text not null,
  color text null check (color in ('yellow', 'green', 'purple', 'red')),
  ready boolean not null default false,
  is_host boolean not null default false,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

create unique index if not exists racing_room_players_room_color_unique
  on public.racing_room_players(room_id, color)
  where color is not null;

create index if not exists racing_rooms_status_expires_at_idx
  on public.racing_rooms(status, expires_at);

create index if not exists racing_room_players_room_id_idx
  on public.racing_room_players(room_id);

alter table public.racing_rooms enable row level security;
alter table public.racing_room_players enable row level security;

drop policy if exists "anon can read active waiting racing rooms" on public.racing_rooms;
create policy "anon can read active waiting racing rooms"
  on public.racing_rooms
  for select
  to anon
  using (status = 'waiting' and expires_at > now());

drop policy if exists "anon can read players for active waiting rooms" on public.racing_room_players;
create policy "anon can read players for active waiting rooms"
  on public.racing_room_players
  for select
  to anon
  using (
    exists (
      select 1
      from public.racing_rooms rooms
      where rooms.id = racing_room_players.room_id
        and rooms.status = 'waiting'
        and rooms.expires_at > now()
    )
  );
