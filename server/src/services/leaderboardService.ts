import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface LeaderboardRow {
  playerId: string;
  nickname: string;
  wins: number;
  races: number;
  bestRank: number | null;
}

interface LeaderboardDbRow extends RowDataPacket {
  player_id: string;
  nickname: string;
  wins: number;
  races: number;
  best_rank: number | null;
}

export async function listLeaderboard(pool: Pool, limit = 50): Promise<LeaderboardRow[]> {
  const [rows] = await pool.query<LeaderboardDbRow[]>(
    `
      select
        player_id,
        max(nickname) as nickname,
        sum(case when \`rank\` = 1 then 1 else 0 end) as wins,
        count(*) as races,
        min(\`rank\`) as best_rank
      from racing_match_results
      group by player_id
      order by wins desc, best_rank asc, races desc, player_id asc
      limit ?
    `,
    [limit]
  );

  return rows.map((row) => ({
    playerId: row.player_id,
    nickname: row.nickname,
    wins: Number(row.wins ?? 0),
    races: Number(row.races ?? 0),
    bestRank: row.best_rank === null ? null : Number(row.best_rank)
  }));
}
