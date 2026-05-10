import type { Pool } from 'mysql2/promise';
import { DEFAULT_VEHICLE_TYPE, type CommandResult, type MatchState, type RoomState } from '../lib/protocol.js';
import { upsertPlayer } from './playerService.js';

export async function syncRoomProjection(pool: Pool, room: RoomState): Promise<void> {
  await pool.execute(
    `
      insert into racing_rooms (
        id, code, host_player_id, status, lap_target, track_id, track_name, track_map,
        created_at, started_at, finished_at, expires_at, closed_reason
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on duplicate key update
        host_player_id = values(host_player_id),
        status = values(status),
        lap_target = values(lap_target),
        track_id = values(track_id),
        track_name = values(track_name),
        track_map = values(track_map),
        started_at = values(started_at),
        finished_at = values(finished_at),
        expires_at = values(expires_at),
        closed_reason = values(closed_reason)
    `,
    [
      room.id,
      room.code,
      room.hostPlayerId,
      room.status,
      room.lapTarget,
      room.trackId,
      room.trackName,
      room.trackMap,
      toMysqlDatetime(room.createdAt),
      toMysqlDatetime(room.startedAt),
      toMysqlDatetime(room.finishedAt),
      toMysqlDatetime(room.expiresAt),
      room.closedReason
    ]
  );

  /**
   * Room projections can be refreshed multiple times in quick succession while
   * players change color/readiness or while a match transitions. A destructive
   * `delete -> insert` rewrite is race-prone under concurrent refreshes because
   * two refreshes can interleave and reinsert the same composite primary key.
   *
   * Upserting each visible player row keeps the operation idempotent, and the
   * trailing prune step removes players who are no longer part of the room.
   */
  for (const player of room.players) {
    await upsertPlayer(pool, player.playerId, player.nickname, player.lastSeenAt);

    await pool.execute(
      `
        insert into racing_room_players (
          room_id, player_id, nickname, color, vehicle_type, ready, is_host, last_seen_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on duplicate key update
          nickname = values(nickname),
          color = values(color),
          vehicle_type = values(vehicle_type),
          ready = values(ready),
          is_host = values(is_host),
          last_seen_at = values(last_seen_at)
      `,
      [
        room.id,
        player.playerId,
        player.nickname,
        player.color,
        player.vehicleType ?? DEFAULT_VEHICLE_TYPE,
        player.ready ? 1 : 0,
        player.isHost ? 1 : 0,
        toMysqlDatetime(player.lastSeenAt)
      ]
    );
  }

  await pruneRoomPlayers(pool, room.id, room.players.map((player) => player.playerId));
}

export async function syncMatchProjection(pool: Pool, room: RoomState, match: MatchState): Promise<void> {
  await pool.execute(
    `
      insert into racing_matches (
        id, room_id, room_code, phase, lap_target, track_id, track_name, track_map,
        started_at, finished_at, winner_player_id
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on duplicate key update
        phase = values(phase),
        lap_target = values(lap_target),
        track_id = values(track_id),
        track_name = values(track_name),
        track_map = values(track_map),
        started_at = values(started_at),
        finished_at = values(finished_at),
        winner_player_id = values(winner_player_id)
    `,
    [
      match.id,
      room.id,
      room.code,
      match.phase,
      match.lapTarget,
      match.trackId,
      match.trackName,
      match.trackMap,
      toMysqlDatetime(match.startedAt),
      toMysqlDatetime(match.finishedAt),
      match.winnerPlayerId
    ]
  );

  if (match.phase !== 'finished' && match.phase !== 'aborted') {
    return;
  }

  /**
   * Final result projection faces the same concurrency pattern as room player
   * projection. Keep per-player result rows idempotent via upsert, then delete
   * any stale rows that do not belong to the latest finished snapshot.
   */
  for (const player of match.players) {
    await upsertPlayer(pool, player.playerId, player.nickname, player.lastReportAt ?? new Date().toISOString());

    await pool.execute(
      `
        insert into racing_match_results (
          match_id, room_id, player_id, nickname, color, vehicle_type,
          \`rank\`, presence, completed_laps, lap_progress, total_progress,
          finished_at, last_report_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on duplicate key update
          nickname = values(nickname),
          color = values(color),
          vehicle_type = values(vehicle_type),
          \`rank\` = values(\`rank\`),
          presence = values(presence),
          completed_laps = values(completed_laps),
          lap_progress = values(lap_progress),
          total_progress = values(total_progress),
          finished_at = values(finished_at),
          last_report_at = values(last_report_at)
      `,
      [
        match.id,
        room.id,
        player.playerId,
        player.nickname,
        player.color,
        player.vehicleType ?? DEFAULT_VEHICLE_TYPE,
        player.rank,
        player.presence,
        player.completedLaps,
        player.lapProgress,
        player.totalProgress,
        toMysqlDatetime(player.finishedAt),
        toMysqlDatetime(player.lastReportAt)
      ]
    );
  }

  await pruneMatchResults(pool, match.id, match.players.map((player) => player.playerId));
}

export async function syncCommandResultProjection(pool: Pool, commandType: string, result: CommandResult): Promise<void> {
  if (!result.ok || !result.room) {
    return;
  }

  if (commandType.startsWith('room.')) {
    await syncRoomProjection(pool, result.room);
  }

  if (commandType === 'room.start' && result.match) {
    await syncMatchProjection(pool, result.room, result.match);
    return;
  }

  if (commandType === 'match.progress' && result.match && (result.match.phase === 'finished' || result.match.phase === 'aborted')) {
    await syncRoomProjection(pool, result.room);
    await syncMatchProjection(pool, result.room, result.match);
    return;
  }

  if ((commandType === 'match.join' || commandType === 'match.leave' || commandType === 'match.sync') && result.match) {
    await syncMatchProjection(pool, result.room, result.match);
  }
}

function toMysqlDatetime(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 19).replace('T', ' ');
}

async function pruneRoomPlayers(pool: Pool, roomId: string, playerIds: string[]): Promise<void> {
  if (playerIds.length === 0) {
    await pool.execute('delete from racing_room_players where room_id = ?', [roomId]);
    return;
  }

  const placeholders = playerIds.map(() => '?').join(', ');
  await pool.execute(`delete from racing_room_players where room_id = ? and player_id not in (${placeholders})`, [roomId, ...playerIds]);
}

async function pruneMatchResults(pool: Pool, matchId: string, playerIds: string[]): Promise<void> {
  if (playerIds.length === 0) {
    await pool.execute('delete from racing_match_results where match_id = ?', [matchId]);
    return;
  }

  const placeholders = playerIds.map(() => '?').join(', ');
  await pool.execute(`delete from racing_match_results where match_id = ? and player_id not in (${placeholders})`, [matchId, ...playerIds]);
}
