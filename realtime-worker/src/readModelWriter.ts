import type { MatchState, RoomState } from './protocol';

interface WriterEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface ReadModelWriter {
  syncRoom(room: RoomState): Promise<void>;
  syncMatch(room: RoomState, match: MatchState): Promise<void>;
}

/**
 * Durable room truth lives in the coordinator. Supabase only receives coarse
 * room lifecycle snapshots and final match results so browser recovery and
 * reporting can use durable read models without turning Postgres into a tick
 * loop.
 */
export function createReadModelWriter(env: WriterEnv): ReadModelWriter {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      async syncRoom() {},
      async syncMatch() {}
    };
  }

  return new SupabaseReadModelWriter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

class SupabaseReadModelWriter implements ReadModelWriter {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string
  ) {}

  async syncRoom(room: RoomState): Promise<void> {
    try {
      await this.request('racing_rooms?on_conflict=code', 'POST', [
        {
          id: room.id,
          code: room.code,
          host_player_id: room.hostPlayerId,
          status: room.status,
          lap_target: room.lapTarget,
          track_map: room.trackMap,
          created_at: room.createdAt,
          started_at: room.startedAt,
          finished_at: room.finishedAt,
          expires_at: room.expiresAt,
          closed_reason: room.closedReason
        }
      ]);

      await this.request(`racing_room_players?room_id=eq.${encodeURIComponent(room.id)}`, 'DELETE');
      if (room.players.length === 0) {
        return;
      }

      await this.request('racing_room_players', 'POST', room.players.map((player) => ({
        room_id: room.id,
        player_id: player.playerId,
        nickname: player.nickname,
        color: player.color,
        ready: player.ready,
        is_host: player.isHost,
        last_seen_at: player.lastSeenAt
      })));
    } catch (error) {
      console.error('Failed to sync room read model', error);
    }
  }

  async syncMatch(room: RoomState, match: MatchState): Promise<void> {
    try {
      await this.request('racing_matches?on_conflict=id', 'POST', [
        {
          id: match.id,
          room_id: room.id,
          room_code: room.code,
          phase: match.phase,
          lap_target: match.lapTarget,
          track_map: match.trackMap,
          started_at: match.startedAt,
          finished_at: match.finishedAt,
          winner_player_id: match.winnerPlayerId
        }
      ]);

      if (match.phase !== 'finished' && match.phase !== 'aborted') {
        return;
      }

      await this.request(`racing_match_results?match_id=eq.${encodeURIComponent(match.id)}`, 'DELETE');
      await this.request('racing_match_results', 'POST', match.players.map((player) => ({
        match_id: match.id,
        room_id: room.id,
        player_id: player.playerId,
        nickname: player.nickname,
        color: player.color,
        rank: player.rank,
        presence: player.presence,
        completed_laps: player.completedLaps,
        lap_progress: player.lapProgress,
        total_progress: player.totalProgress,
        finished_at: player.finishedAt,
        last_report_at: player.lastReportAt
      })));
    } catch (error) {
      console.error('Failed to sync match read model', error);
    }
  }

  private async request(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<void> {
    const response = await fetch(`${this.url}/rest/v1/${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        prefer: 'resolution=merge-duplicates'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Supabase read model sync failed with ${response.status}`);
    }
  }
}
