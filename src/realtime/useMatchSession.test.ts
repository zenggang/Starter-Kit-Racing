import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchSession } from './useMatchSession';
import type { MatchState, RoomState } from './protocol';
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
  lastRoomCode: '5035'
};

const finishedRoom: RoomState = {
  id: 'room-5035',
  code: '5035',
  hostPlayerId: 'player-1',
  status: 'finished',
  lapTarget: 1,
  trackMap: null,
  createdAt: '2026-05-02T00:00:00.000Z',
  startedAt: '2026-05-02T00:01:00.000Z',
  finishedAt: '2026-05-02T00:02:00.000Z',
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

const finishedMatch: MatchState = {
  id: 'match-5035',
  roomCode: '5035',
  phase: 'finished',
  lapTarget: 1,
  trackMap: null,
  startedAt: '2026-05-02T00:01:00.000Z',
  finishedAt: '2026-05-02T00:02:00.000Z',
  finishDeadlineAt: '2026-05-02T00:03:00.000Z',
  winnerPlayerId: 'player-1',
  players: [
    {
      playerId: 'player-1',
      nickname: 'Racer',
      color: 'yellow',
      isHost: true,
      presence: 'finished',
      rank: 1,
      finishedAt: '2026-05-02T00:01:19.090Z',
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      checkpoint: 7,
      completedLaps: 1,
      lapProgress: 1,
      totalProgress: 1,
      lastReportAt: '2026-05-02T00:01:19.090Z'
    }
  ]
};

describe('useMatchSession', () => {
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

  it('sends match.join only once after bridge connect', async () => {
    let sequence = 0;

    vi.mocked(sendBridgeCommand).mockImplementation(async (_roomCode, _ticket, command) => {
      sequence += 1;

      return {
        type: 'command.result',
        seq: sequence,
        ok: true,
        commandId: command.commandId,
        room: finishedRoom,
        match: finishedMatch
      };
    });

    renderHook(() => useMatchSession('5035', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      vi.mocked(sendBridgeCommand).mock.calls.filter(([, , command]) => command.type === 'match.join')
    ).toHaveLength(1);
  });

  it('falls back to bridge match sync when the socket transport never opens', async () => {
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

    let sequence = 0;
    vi.mocked(sendBridgeCommand).mockImplementation(async (_roomCode, _ticket, command) => {
      sequence += 1;

      return {
        type: 'command.result',
        seq: sequence,
        ok: true,
        commandId: command.commandId,
        room: finishedRoom,
        match: finishedMatch
      };
    });

    const { result } = renderHook(() => useMatchSession('5035', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toBe('connected');
    expect(result.current.match?.id).toBe('match-5035');
    expect(sendBridgeCommand).toHaveBeenCalledWith(
      '5035',
      expect.objectContaining({ mode: 'socket' }),
      expect.objectContaining({ type: 'match.sync' })
    );
  });

  it('retries socket in the background and upgrades back once a later probe opens', async () => {
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

    let sequence = 0;
    vi.mocked(sendBridgeCommand).mockImplementation(async (_roomCode, _ticket, command) => {
      sequence += 1;

      return {
        type: 'command.result',
        seq: sequence,
        ok: true,
        commandId: command.commandId,
        room: finishedRoom,
        match: finishedMatch
      };
    });

    const { result } = renderHook(() => useMatchSession('5035', player));

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
    expect(result.current.transportMode).toBe('bridge');

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

    expect(result.current.transportMode).toBe('socket');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(vi.mocked(sendBridgeCommand).mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('routes room rematch through bridge even when the race socket is already open', async () => {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const socket = {
      close: vi.fn(),
      send: vi.fn(),
      readyState: WebSocket.CONNECTING,
      addEventListener: vi.fn((type: string, listener: (...args: unknown[]) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      })
    } as unknown as WebSocket & { readyState: number; send: ReturnType<typeof vi.fn> };

    vi.mocked(requestCoordinatorTicket).mockResolvedValue({
      token: 'signed-ticket',
      url: 'https://starter-kit-racing.example.com',
      mode: 'socket'
    });
    vi.mocked(openCoordinatorSocket).mockReturnValue(socket);
    vi.mocked(sendBridgeCommand).mockResolvedValue({
      type: 'command.result',
      seq: 2,
      ok: true,
      room: {
        ...finishedRoom,
        status: 'waiting',
        startedAt: null,
        finishedAt: null,
        matchId: null
      }
    });

    const { result } = renderHook(() => useMatchSession('5035', player));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      socket.readyState = WebSocket.OPEN;
      listeners.get('open')?.forEach((listener) => listener(new Event('open')));
      await Promise.resolve();
      await Promise.resolve();
    });

    vi.mocked(sendBridgeCommand).mockClear();
    socket.send.mockClear();

    await act(async () => {
      await result.current.sendCommand({
        commandId: 'room.rematch:player-1',
        type: 'room.rematch',
        playerId: 'player-1',
        payload: {}
      });
    });

    expect(sendBridgeCommand).toHaveBeenCalledWith(
      '5035',
      expect.objectContaining({ mode: 'socket' }),
      expect.objectContaining({ type: 'room.rematch' })
    );
    expect(socket.send).not.toHaveBeenCalled();
  });
});
