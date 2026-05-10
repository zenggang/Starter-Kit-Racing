create table if not exists players (
  player_id varchar(64) primary key,
  nickname varchar(64) not null,
  created_at datetime not null,
  updated_at datetime not null,
  last_seen_at datetime null
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists racing_rooms (
  id varchar(64) primary key,
  code varchar(16) not null unique,
  host_player_id varchar(64) not null,
  status varchar(32) not null,
  lap_target int not null,
  track_id varchar(64) null,
  track_name varchar(128) null,
  track_map mediumtext null,
  created_at datetime not null,
  started_at datetime null,
  finished_at datetime null,
  expires_at datetime not null,
  closed_reason varchar(64) null,
  key idx_racing_rooms_status_expires (status, expires_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists racing_room_players (
  room_id varchar(64) not null,
  player_id varchar(64) not null,
  nickname varchar(64) not null,
  color varchar(32) null,
  vehicle_type varchar(32) not null,
  ready tinyint(1) not null default 0,
  is_host tinyint(1) not null default 0,
  last_seen_at datetime not null,
  primary key (room_id, player_id),
  key idx_racing_room_players_player (player_id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists racing_tracks (
  id varchar(64) primary key,
  owner_player_id varchar(64) not null,
  name varchar(128) not null,
  track_map mediumtext not null,
  track_hash varchar(128) not null,
  cell_count int not null,
  bounds_json json not null,
  preview_points_json json null,
  created_at datetime not null,
  updated_at datetime not null,
  last_used_at datetime null,
  deleted_at datetime null,
  key idx_racing_tracks_owner_updated (owner_player_id, updated_at),
  key idx_racing_tracks_owner_deleted (owner_player_id, deleted_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists racing_matches (
  id varchar(64) primary key,
  room_id varchar(64) not null,
  room_code varchar(16) not null,
  phase varchar(32) not null,
  lap_target int not null,
  track_id varchar(64) null,
  track_name varchar(128) null,
  track_map mediumtext null,
  started_at datetime not null,
  finished_at datetime null,
  winner_player_id varchar(64) null,
  key idx_racing_matches_room (room_id),
  key idx_racing_matches_room_code (room_code),
  key idx_racing_matches_finished_at (finished_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists racing_match_results (
  id bigint unsigned not null auto_increment primary key,
  match_id varchar(64) not null,
  room_id varchar(64) not null,
  player_id varchar(64) not null,
  nickname varchar(64) not null,
  color varchar(32) null,
  vehicle_type varchar(32) not null,
  `rank` int not null,
  presence varchar(32) not null,
  completed_laps int not null,
  lap_progress decimal(10,6) not null,
  total_progress decimal(10,6) not null,
  finished_at datetime null,
  last_report_at datetime null,
  unique key uniq_match_player (match_id, player_id),
  key idx_match_results_match_rank (match_id, `rank`),
  key idx_match_results_player (player_id),
  key idx_match_results_finished (finished_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
