alter table public.racing_room_players
  add column if not exists vehicle_type text not null default 'truck';

alter table public.racing_room_players
  drop constraint if exists racing_room_players_vehicle_type_check;

alter table public.racing_room_players
  add constraint racing_room_players_vehicle_type_check
  check (vehicle_type in ('truck', 'motorcycle'));

alter table public.racing_match_results
  add column if not exists vehicle_type text not null default 'truck';

alter table public.racing_match_results
  drop constraint if exists racing_match_results_vehicle_type_check;

alter table public.racing_match_results
  add constraint racing_match_results_vehicle_type_check
  check (vehicle_type in ('truck', 'motorcycle'));

comment on column public.racing_room_players.vehicle_type is
  'Cosmetic vehicle body selection. Unlike color, this is not unique per room.';

comment on column public.racing_match_results.vehicle_type is
  'Final per-player vehicle body used by result and recovery projections.';
