create extension if not exists "pgcrypto";

-- Public hall read model. These rows stay intentionally lightweight because the
-- browser hall only needs waiting-room metadata and roster counts after refresh.
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

comment on table public.racing_rooms is
  'Durable waiting-room projection used by the public hall list and room lifecycle recovery.';

-- Per-room roster projection for the waiting-room read model. This table does
-- not try to represent live in-race telemetry; it only tracks lobby identity
-- and readiness choices that must survive page refreshes.
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

comment on table public.racing_room_players is
  'Durable waiting-room roster projection keyed by room and player.';

-- Durable match header rows. The coordinator may emit high-frequency
-- match.progress updates in memory, but Postgres only stores start/finish
-- facts that must survive refreshes, rematches, and result-page reloads.
create table if not exists public.racing_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.racing_rooms(id) on delete cascade,
  phase text not null check (phase in ('live', 'finished', 'aborted')),
  lap_target integer not null check (lap_target between 1 and 10),
  track_map text null,
  started_at timestamptz not null,
  finished_at timestamptz null,
  winner_player_id text null,
  created_at timestamptz not null default now()
);

comment on table public.racing_matches is
  'Durable match lifecycle rows. One row per race start, not one row per telemetry report.';

comment on column public.racing_matches.winner_player_id is
  'Player id chosen by the coordinator as the winning finisher, or null for aborted matches.';

-- Durable per-player result rows. Keep only the final ordering and progress
-- snapshot needed by result UI and audits. Do not persist per-frame position,
-- heading, or speed samples here.
create table if not exists public.racing_match_results (
  match_id uuid not null references public.racing_matches(id) on delete cascade,
  player_id text not null,
  nickname text not null,
  color text not null check (color in ('yellow', 'green', 'purple', 'red')),
  is_host boolean not null default false,
  presence text not null check (presence in ('pending', 'connected', 'disconnected', 'finished')),
  rank integer not null check (rank >= 1),
  completed_laps integer not null default 0 check (completed_laps >= 0),
  lap_progress double precision not null default 0 check (lap_progress >= 0 and lap_progress <= 1),
  total_progress double precision not null default 0 check (total_progress >= 0),
  finished_at timestamptz null,
  last_report_at timestamptz null,
  primary key (match_id, player_id)
);

comment on table public.racing_match_results is
  'Durable per-player final ordering/progress rows for result pages and audits.';

comment on column public.racing_match_results.total_progress is
  'Coordinator-approved final progress scalar used to explain ordering without storing raw telemetry samples.';

create unique index if not exists racing_room_players_room_color_unique
  on public.racing_room_players(room_id, color)
  where color is not null;

create index if not exists racing_rooms_status_expires_at_idx
  on public.racing_rooms(status, expires_at);

create index if not exists racing_room_players_room_id_idx
  on public.racing_room_players(room_id);

create unique index if not exists racing_matches_room_id_live_unique
  on public.racing_matches(room_id)
  where phase = 'live';

create index if not exists racing_matches_room_id_started_at_idx
  on public.racing_matches(room_id, started_at desc);

create index if not exists racing_match_results_match_id_rank_idx
  on public.racing_match_results(match_id, rank);

alter table public.racing_rooms enable row level security;
alter table public.racing_room_players enable row level security;
alter table public.racing_matches enable row level security;
alter table public.racing_match_results enable row level security;

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
