import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerReadModelWriter, syncCoordinatorReadModels } from './readModelWriter';
import type { MatchState, RoomState } from '@/realtime/protocol';

const room: RoomState = {
  id: 'room-1',
  code: '8693',
  hostPlayerId: 'host-1',
  status: 'waiting',
  lapTarget: 3,
  trackMap: null,
  createdAt: '2026-05-03T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  expiresAt: '2026-05-03T01:00:00.000Z',
  closedReason: null,
  matchId: null,
  players: [
    {
      playerId: 'host-1',
      nickname: 'Host',
      color: 'yellow',
      status: 'ready',
      ready: true,
      isHost: true,
      lastSeenAt: '2026-05-03T00:00:00.000Z'
    }
  ]
};

const match: MatchState = {
  id: 'match-1',
  roomCode: '8693',
  phase: 'live',
  lapTarget: 3,
  trackMap: null,
  startedAt: '2026-05-03T00:01:00.000Z',
  finishedAt: null,
  winnerPlayerId: null,
  players: []
};

describe('server read model writer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reuses NEXT_PUBLIC_SUPABASE_URL when only the service role key is server-only', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const writer = createServerReadModelWriter({
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.com',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    });

    await writer.syncRoom(room);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://supabase.example.com/rest/v1/racing_rooms?on_conflict=code',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('persists room lifecycle snapshots for successful bridge room commands', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await syncCoordinatorReadModels(
      { type: 'room.rematch' },
      {
        ok: true,
        room: {
          ...room,
          status: 'waiting',
          matchId: null
        }
      },
      {
        NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.com',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
      }
    );

    expect(fetchMock).toHaveBeenCalled();
  });

  it('persists match headers when bridge room.start returns a live match', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await syncCoordinatorReadModels(
      { type: 'room.start' },
      {
        ok: true,
        room: {
          ...room,
          status: 'racing',
          startedAt: '2026-05-03T00:01:00.000Z',
          matchId: 'match-1'
        },
        match
      },
      {
        NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.com',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://supabase.example.com/rest/v1/racing_matches?on_conflict=id',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });
});
