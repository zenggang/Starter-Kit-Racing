import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeMessage, RoomState } from './protocol';
import { useRoomSession } from './useRoomSession';
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

const waitingRoom: RoomState = {
  id: 'room-5035',
  code: '5035',
  hostPlayerId: 'player-1',
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

describe('useRoomSession', () => {
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

  it('connects through the shared realtime room and applies incoming room snapshots', async () => {
    const { result } = renderHook(() => useRoomSession('5035', player));

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    await act(async () => {
      messageHandler?.({
        type: 'room.snapshot',
        seq: 1,
        room: waitingRoom
      });
    });

    expect(result.current.snapshot?.code).toBe('5035');
    expect(result.current.snapshot?.players).toHaveLength(1);
  });

  it('resolves sendCommand when a matching command.result arrives', async () => {
    const { result } = renderHook(() => useRoomSession('5035', player));

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    const commandPromise = result.current.sendCommand({
      commandId: 'room.ready:1',
      type: 'room.ready',
      playerId: 'player-1',
      payload: { ready: true }
    });

    expect(sendRealtimeCommand).toHaveBeenCalledWith(
      fakeRoom,
      expect.objectContaining({ type: 'room.ready', commandId: 'room.ready:1' })
    );

    await act(async () => {
      messageHandler?.({
        type: 'command.result',
        seq: 2,
        ok: true,
        commandId: 'room.ready:1',
        room: waitingRoom
      });
    });

    await expect(commandPromise).resolves.toMatchObject({
      ok: true,
      commandId: 'room.ready:1'
    });
  });

  it('disposes the active realtime connection after an explicit room.leave command succeeds', async () => {
    const { result } = renderHook(() => useRoomSession('5035', player));

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    const leavePromise = result.current.sendCommand({
      commandId: 'room.leave:1',
      type: 'room.leave',
      playerId: 'player-1',
      payload: {}
    });

    await act(async () => {
      messageHandler?.({
        type: 'command.result',
        seq: 3,
        ok: true,
        commandId: 'room.leave:1',
        room: {
          ...waitingRoom,
          status: 'closed',
          closedReason: 'room_empty'
        }
      });
    });

    await leavePromise;
    expect(disposeRealtimeConnection).toHaveBeenCalled();
  });

  it('does not reacquire the realtime room when the player object identity changes without changing player identity', async () => {
    const { result, rerender } = renderHook(({ nextPlayer }) => useRoomSession('5035', nextPlayer), {
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
