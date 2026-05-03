import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomSession } from './useRoomSession';
import type { RoomState } from './protocol';
import type { PlayerSession } from '@/session/playerSession';
import { openCoordinatorSocket, requestCoordinatorTicket, sendBridgeCommand } from './sessionClient';

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

  it('does not start bridge polling while the socket transport is healthy', async () => {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const socket = {
      close: vi.fn(),
      addEventListener: vi.fn((type: string, listener: (...args: unknown[]) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      })
    } as unknown as WebSocket;

    vi.mocked(requestCoordinatorTicket).mockResolvedValue({
      token: 'signed-ticket',
      url: 'https://starter-kit-racing.example.com',
      mode: 'socket'
    });
    vi.mocked(openCoordinatorSocket).mockReturnValue(socket);

    const { result } = renderHook(() => useRoomSession('ABCD12', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      listeners.get('open')?.forEach((listener) => listener(new Event('open')));
      await Promise.resolve();
    });

    vi.mocked(sendBridgeCommand).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.connectionState).toBe('connected');
    expect(sendBridgeCommand).not.toHaveBeenCalled();
  });

  it('falls back to bridge sync after the socket transport closes', async () => {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const socket = {
      close: vi.fn(),
      addEventListener: vi.fn((type: string, listener: (...args: unknown[]) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      })
    } as unknown as WebSocket;

    vi.mocked(requestCoordinatorTicket).mockResolvedValue({
      token: 'signed-ticket',
      url: 'https://starter-kit-racing.example.com',
      mode: 'socket'
    });
    vi.mocked(openCoordinatorSocket).mockReturnValue(socket);
    vi.mocked(sendBridgeCommand).mockResolvedValue({
      type: 'command.result',
      seq: 1,
      ok: true,
      room: readyRoom
    });

    const { result } = renderHook(() => useRoomSession('ABCD12', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      listeners.get('open')?.forEach((listener) => listener(new Event('open')));
      listeners.get('close')?.forEach((listener) => listener(new Event('close')));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.snapshot?.players).toHaveLength(2);
    expect(sendBridgeCommand).toHaveBeenCalledWith(
      'ABCD12',
      expect.objectContaining({ mode: 'socket' }),
      expect.objectContaining({ type: 'sync.request' })
    );
  });

  it('falls back to bridge sync when the socket transport never opens', async () => {
    const socket = {
      close: vi.fn(),
      addEventListener: vi.fn()
    } as unknown as WebSocket;

    vi.mocked(requestCoordinatorTicket).mockResolvedValue({
      token: 'signed-ticket',
      url: 'https://starter-kit-racing.example.workers.dev',
      mode: 'socket'
    });
    vi.mocked(openCoordinatorSocket).mockReturnValue(socket);
    vi.mocked(sendBridgeCommand).mockResolvedValue({
      type: 'command.result',
      seq: 1,
      ok: true,
      room: readyRoom
    });

    const { result } = renderHook(() => useRoomSession('ABCD12', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.snapshot?.players).toHaveLength(2);
    expect(sendBridgeCommand).toHaveBeenCalledWith(
      'ABCD12',
      expect.objectContaining({ mode: 'socket' }),
      expect.objectContaining({ type: 'sync.request' })
    );
  });

  it('retries socket in the background and switches back once a later probe opens', async () => {
    const attempts: Array<{
      listeners: Map<string, Array<(...args: unknown[]) => void>>;
      socket: WebSocket & { readyState: number; send: ReturnType<typeof vi.fn> };
    }> = [];
    vi.mocked(requestCoordinatorTicket).mockResolvedValue({
      token: 'signed-ticket',
      url: 'https://starter-kit-racing.example.workers.dev',
      mode: 'socket'
    });
    vi.mocked(openCoordinatorSocket).mockImplementation(() => {
      const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
      const socket = {
        close: vi.fn(),
        send: vi.fn(),
        readyState: WebSocket.CONNECTING,
        addEventListener: vi.fn((type: string, listener: (...args: unknown[]) => void) => {
          listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        })
      } as unknown as WebSocket & { readyState: number; send: ReturnType<typeof vi.fn> };

      attempts.push({ listeners, socket });
      return socket;
    });
    vi.mocked(sendBridgeCommand).mockResolvedValue({
      type: 'command.result',
      seq: 1,
      ok: true,
      room: readyRoom
    });

    const { result } = renderHook(() => useRoomSession('ABCD12', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toBe('connected');
    expect(sendBridgeCommand).toHaveBeenCalled();

    vi.mocked(sendBridgeCommand).mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });

    expect(vi.mocked(openCoordinatorSocket).mock.calls.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      const latest = attempts[attempts.length - 1];
      latest.socket.readyState = WebSocket.OPEN;
      latest.listeners.get('open')?.forEach((listener) => listener(new Event('open')));
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(vi.mocked(sendBridgeCommand).mock.calls.length).toBeLessThanOrEqual(1);
  });
});
