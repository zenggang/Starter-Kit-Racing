alter table public.racing_rooms
  add column if not exists track_scene text not null default 'forest';

alter table public.racing_matches
  add column if not exists track_scene text not null default 'forest';

comment on column public.racing_rooms.track_scene is
  'Visual environment selected for the room, such as forest or city.';

comment on column public.racing_matches.track_scene is
  'Visual environment snapshot copied from the room when a match starts.';
