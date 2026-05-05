alter table public.racing_matches
  add column if not exists room_code text null;

update public.racing_matches matches
set room_code = rooms.code
from public.racing_rooms rooms
where matches.room_id = rooms.id
  and matches.room_code is null;

alter table public.racing_matches
  alter column room_code set not null;

alter table public.racing_matches
  drop constraint if exists racing_matches_phase_check;

alter table public.racing_matches
  add constraint racing_matches_phase_check
  check (phase in ('countdown', 'live', 'finished', 'aborted'));
