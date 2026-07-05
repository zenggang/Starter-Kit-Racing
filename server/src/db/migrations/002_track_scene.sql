alter table racing_rooms
  add column if not exists track_scene varchar(32) not null default 'forest' after track_map;

alter table racing_matches
  add column if not exists track_scene varchar(32) not null default 'forest' after track_map;
