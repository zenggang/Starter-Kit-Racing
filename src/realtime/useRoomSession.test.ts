import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomSession } from './useRoomSession';
import type { RoomState } from './protocol';
import type { PlayerSession } from '@/session/playerSession';
import { requestCoordinatorTicket, sendBridgeCommand } from './sessionClient';

vi.mock('./sessionClient', () => ({
  openCoordinatorSocket: vi.fn(),
  requestCoordinatorTicket: vi.fn(),
  sendBridgeCommand: vi.fn()
}));

const player: PlayerSession = {
  playerId: 'player-1',
  nickname: 'Racer',
  lastRoomCode: 'ABCD12'
};

const waitingRoom: RoomState = {
  id: 'room-1',
  code: 'ABCD12',
  hostPlayerId: 'host-1',
  status: 'waiting',
  lapTarget: 3,
  trackMap: null,
  createdAt: '2026-05-02T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  expiresAt: '2026-05-02T01:00:00.000Z',
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
      lastSeenAt: '2026-05-02T00:00:00.000Z'
    }
  ]
};

const readyRoom: RoomState = {
  ...waitingRoom,
  players: [
    ...waitingRoom.players,
    {
      playerId: 'player-2',
      nickname: 'Guest',
      color: 'green',
      status: 'ready',
      ready: true,
      isHost: false,
      lastSeenAt: '2026-05-02T00:00:01.000Z'
    }
  ]
};

describe('useRoomSession bridge sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(requestCoordinatorTicket).mockResolvedValue({
      token: 'signed-ticket',
      url: 'https://starter-kit-racing.example.workers.dev',
      mode: 'bridge'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('pulls bridge snapshots after connect so other players and host actions become visible without refresh', async () => {
    let syncCount = 0;

    vi.mocked(sendBridgeCommand).mockImplementation(async (_roomCode, _ticket, command) => {
      if (command.type !== 'sync.request') {
        return {
          type: 'command.result',
          seq: 0,
          ok: false,
          commandId: command.commandId,
          errorCode: 'COORDINATOR_NOT_READY'
        };
      }

      syncCount += 1;

      return {
        type: 'command.result',
        seq: syncCount,
        ok: true,
        commandId: command.commandId,
        room: syncCount === 1 ? waitingRoom : readyRoom
      };
    });

    const { result } = renderHook(() => useRoomSession('ABCD12', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.snapshot?.players).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.snapshot?.players).toHaveLength(2);

    expect(sendBridgeCommand).toHaveBeenCalledWith(
      'ABCD12',
      expect.objectContaining({ mode: 'bridge' }),
      expect.objectContaining({
        type: 'sync.request',
        playerId: 'player-1'
      })
    );
  });
});
