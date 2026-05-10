import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface RaceRecordRow {
  matchId: string;
  roomCode: string;
  phase: string;
  winnerPlayerId: string | null;
  finishedAt: string | null;
}

interface RaceRecordDbRow extends RowDataPacket {
  id: string;
  room_code: string;
  phase: string;
  winner_player_id: string | null;
  finished_at: string | null;
}

export async function listRaceRecords(pool: Pool, limit = 50): Promise<RaceRecordRow[]> {
  const [rows] = await pool.query<RaceRecordDbRow[]>(
    `
      select
        id,
        room_code,
        phase,
        winner_player_id,
        if(finished_at is null, null, date_format(finished_at, '%Y-%m-%dT%H:%i:%sZ')) as finished_at
      from racing_matches
      order by started_at desc
      limit ?
    `,
    [limit]
  );

  return rows.map((row) => ({
    matchId: row.id,
    roomCode: row.room_code,
    phase: row.phase,
    winnerPlayerId: row.winner_player_id,
    finishedAt: row.finished_at
  }));
}
