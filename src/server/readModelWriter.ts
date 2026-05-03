import type { MatchState, RoomState } from '@/realtime/protocol';

type ServerWriterEnv = Record<string, string | undefined> & {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

interface CommandResultShape {
  ok: boolean;
  room?: RoomState;
  match?: MatchState;
}

export interface ReadModelWriter {
  syncRoom(room: RoomState): Promise<void>;
  syncMatch(room: RoomState, match: MatchState): Promise<void>;
}

/**
 * The browser hall restores waiting rooms from Supabase, so bridge-triggered
 * room lifecycle commands need a server-side write path even when the worker
 * deployment is missing Supabase secrets. The public URL is safe to reuse on
 * the server; only the service-role key remains strictly required.
 */
export function createServerReadModelWriter(env: ServerWriterEnv = process.env): ReadModelWriter {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return {
      async syncRoom() {},
      async syncMatch() {}
    };
  }

  return new SupabaseReadModelWriter(url, serviceRoleKey);
}

export async function syncCoordinatorReadModels(
  command: { type?: string },
  result: CommandResultShape,
  env: ServerWriterEnv = process.env
): Promise<void> {
  if (!result.ok || !result.room || typeof command.type !== 'string') {
    return;
  }

  const writer = createServerReadModelWriter(env);

  if (command.type.startsWith('room.')) {
    await writer.syncRoom(result.room);
  }

  if (command.type === 'room.start' && result.match) {
    await writer.syncMatch(result.room, result.match);
    return;
  }

  if (command.type === 'match.progress' && result.match && (result.match.phase === 'finished' || result.match.phase === 'aborted')) {
    await writer.syncRoom(result.room);
    await writer.syncMatch(result.room, result.match);
  }
}

class SupabaseReadModelWriter implements ReadModelWriter {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string
  ) {}

  async syncRoom(room: RoomState): Promise<void> {
    await this.request('racing_rooms?on_conflict=code', 'POST', [
      {
        id: room.id,
        code: room.code,
        host_player_id: room.hostPlayerId,
        status: room.status,
        lap_target: room.lapTarget,
        track_id: room.trackId,
        track_name: room.trackName,
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

    await this.request(
      'racing_room_players',
      'POST',
      room.players.map((player) => ({
        room_id: room.id,
        player_id: player.playerId,
        nickname: player.nickname,
        color: player.color,
        ready: player.ready,
        is_host: player.isHost,
        last_seen_at: player.lastSeenAt
      }))
    );
  }

  async syncMatch(room: RoomState, match: MatchState): Promise<void> {
    await this.request('racing_matches?on_conflict=id', 'POST', [
      {
        id: match.id,
        room_id: room.id,
        room_code: room.code,
        phase: match.phase,
        lap_target: match.lapTarget,
        track_id: match.trackId,
        track_name: match.trackName,
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
    await this.request(
      'racing_match_results',
      'POST',
      match.players.map((player) => ({
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
      }))
    );
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
