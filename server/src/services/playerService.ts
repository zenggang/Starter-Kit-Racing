import type { Pool } from 'mysql2/promise';

export async function upsertPlayer(
  pool: Pool,
  playerId: string,
  nickname: string,
  timestamp: string
): Promise<void> {
  const normalizedTimestamp = timestamp.slice(0, 19).replace('T', ' ');

  await pool.execute(
    `
      insert into players (player_id, nickname, created_at, updated_at, last_seen_at)
      values (?, ?, ?, ?, ?)
      on duplicate key update
        nickname = values(nickname),
        updated_at = values(updated_at),
        last_seen_at = values(last_seen_at)
    `,
    [playerId, nickname, normalizedTimestamp, normalizedTimestamp, normalizedTimestamp]
  );
}
