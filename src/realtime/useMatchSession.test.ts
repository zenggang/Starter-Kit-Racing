import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchState, RealtimeMessage, RoomState } from './protocol';
import { useMatchSession } from './useMatchSession';
import type { PlayerSession } from '@/session/playerSession';

const {
  acquireRealtimeRoom,
  attachRealtimeHandlers,
  sendRealtimeCommand,
  disposeRealtimeConnection,
  detachActiveListeners
} = vi.hoisted(() => ({
  acquireRealtimeRoom: vi.fn(),
  attachRealtimeHandlers: vi.fn(),
  sendRealtimeCommand: vi.fn(),
  disposeRealtimeConnection: vi.fn(),
  detachActiveListeners: vi.fn()
}));

vi.mock('./sessionClient', () => ({
  acquireRealtimeRoom,
  attachRealtimeHandlers,
  sendRealtimeCommand,
  disposeRealtimeConnection
}));

vi.mock('./roomConnectionStore', () => ({
  detachActiveListeners
}));

const player: PlayerSession = {
  playerId: 'player-1',
  nickname: 'Racer',
  lastRoomCode: '5035'
};

const room: RoomState = {
  id: 'room-5035',
  code: '5035',
  hostPlayerId: 'player-1',
  status: 'racing',
  lapTarget: 1,
  trackMap: null,
  createdAt: '2026-05-02T00:00:00.000Z',
  startedAt: '2026-05-02T00:01:00.000Z',
  finishedAt: null,
  expiresAt: '2026-05-02T01:00:00.000Z',
  closedReason: null,
  matchId: 'match-5035',
  players: [
    {
      playerId: 'player-1',
      nickname: 'Racer',
      color: 'yellow',
      status: 'ready',
      ready: true,
      isHost: true,
      lastSeenAt: '2026-05-02T00:00:00.000Z'
    }
  ]
};

const match: MatchState = {
  id: 'match-5035',
  roomCode: '5035',
  phase: 'countdown',
  lapTarget: 1,
  trackMap: null,
  startedAt: '2026-05-02T00:01:00.000Z',
  finishedAt: null,
  finishDeadlineAt: null,
  winnerPlayerId: null,
  players: [
    {
      playerId: 'player-1',
      nickname: 'Racer',
      color: 'yellow',
      isHost: true,
      presence: 'connected',
      rank: 1,
      finishedAt: null,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      checkpoint: 0,
      completedLaps: 0,
      lapProgress: 0,
      totalProgress: 0,
      lastReportAt: null
    }
  ]
};

describe('useMatchSession', () => {
  let messageHandler: ((message: RealtimeMessage) => void) | null = null;
  const fakeRoom = {
    removeAllListeners: vi.fn()
  };

  beforeEach(() => {
    messageHandler = null;
    vi.clearAllMocks();
    acquireRealtimeRoom.mockResolvedValue(fakeRoom);
    attachRealtimeHandlers.mockImplementation((_room, onMessage) => {
      messageHandler = onMessage;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connects and consumes incoming match snapshots', async () => {
    const { result } = renderHook(() => useMatchSession('5035', player));

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    await act(async () => {
      messageHandler?.({
        type: 'match.snapshot',
        seq: 1,
        room,
        match
      });
    });

    expect(result.current.room?.code).toBe('5035');
    expect(result.current.match?.phase).toBe('countdown');
  });

  it('sends match.progress over the shared realtime room and resolves on command.result', async () => {
    const { result } = renderHook(() => useMatchSession('5035', player));

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    const commandPromise = result.current.sendCommand({
      commandId: 'match.progress:1',
      type: 'match.progress',
      playerId: 'player-1',
      payload: {
        checkpoint: 1,
        completedLaps: 0,
        lapProgress: 0.1,
        position: { x: 1, y: 0, z: 2 },
        heading: 0,
        speed: 12
      }
    });

    expect(sendRealtimeCommand).toHaveBeenCalledWith(
      fakeRoom,
      expect.objectContaining({ type: 'match.progress', commandId: 'match.progress:1' })
    );

    await act(async () => {
      messageHandler?.({
        type: 'command.result',
        seq: 2,
        ok: true,
        commandId: 'match.progress:1',
        room,
        match: {
          ...match,
          phase: 'live',
          players: [
            {
              ...match.players[0],
              checkpoint: 1,
              lapProgress: 0.1,
              totalProgress: 0.1,
              speed: 12,
              position: { x: 1, y: 0, z: 2 }
            }
          ]
        }
      });
    });

    await expect(commandPromise).resolves.toMatchObject({
      ok: true,
      commandId: 'match.progress:1'
    });
  });

  it('does not reacquire the realtime room when the player object identity changes without changing player identity', async () => {
    const { result, rerender } = renderHook(({ nextPlayer }) => useMatchSession('5035', nextPlayer), {
      initialProps: { nextPlayer: player }
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    expect(acquireRealtimeRoom).toHaveBeenCalledTimes(1);
    rerender({
      nextPlayer: {
        ...player
      }
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    expect(acquireRealtimeRoom).toHaveBeenCalledTimes(1);
  });
});
