import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomClient } from './RoomClient';

const replaceSpy = vi.fn();
const pushSpy = vi.fn();
const sendCommandSpy = vi.fn().mockResolvedValue({
  type: 'command.result',
  seq: 2,
  ok: true,
  room: {
    id: 'room-1',
    code: '8966',
    hostPlayerId: 'player-1',
    status: 'closed',
    lapTarget: 3,
    trackMap: null,
    createdAt: '2026-05-02T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    expiresAt: '2026-05-02T11:00:00.000Z',
    closedReason: 'room_empty',
    matchId: null,
    players: []
  }
});

vi.stubGlobal('React', React);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: replaceSpy
  })
}));

vi.mock('@/session/usePlayerSession', () => ({
  usePlayerSession: () => ({
    session: {
      playerId: 'player-1',
      nickname: '车手1',
      lastRoomCode: '8966'
    },
    rememberRoom: vi.fn()
  })
}));

let mockedSnapshot = {
  id: 'room-1',
  code: '8966',
  hostPlayerId: 'player-1',
  status: 'waiting',
  lapTarget: 3,
  trackMap: null,
  createdAt: '2026-05-02T10:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  expiresAt: '2026-05-02T11:00:00.000Z',
  closedReason: null,
  matchId: null,
  players: [
    {
      playerId: 'player-1',
      nickname: '车手1',
      color: 'yellow',
      status: 'ready',
      ready: true,
      isHost: true,
      lastSeenAt: '2026-05-02T10:00:00.000Z'
    }
  ]
};

vi.mock('@/realtime/useRoomSession', () => ({
  useRoomSession: () => ({
    snapshot: mockedSnapshot,
    connectionState: 'connected',
    lastErrorCode: null,
    sendCommand: sendCommandSpy
  })
}));

describe('RoomClient', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    replaceSpy.mockClear();
    pushSpy.mockClear();
    sendCommandSpy.mockClear();
  });

  it('sends room.leave and returns to the hall when the racer exits the room', async () => {
    mockedSnapshot = {
      ...mockedSnapshot,
      status: 'waiting',
      closedReason: null,
      players: [
        {
          playerId: 'player-1',
          nickname: '车手1',
          color: 'yellow',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    };
    render(<RoomClient code="8966" />);

    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.leave',
          playerId: 'player-1'
        })
      );
    });
    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('/');
    });
  });

  it('returns guests to the hall when the room becomes closed', async () => {
    mockedSnapshot = {
      ...mockedSnapshot,
      hostPlayerId: 'player-1',
      status: 'closed',
      closedReason: 'host_left',
      players: [
        {
          playerId: 'player-1',
          nickname: '房主',
          color: 'yellow',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        },
        {
          playerId: 'player-2',
          nickname: '房客',
          color: 'green',
          status: 'ready',
          ready: true,
          isHost: false,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    };

    render(<RoomClient code="8966" />);

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('/');
    });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('does not auto-rejoin after the current racer explicitly leaves the room', async () => {
    mockedSnapshot = {
      ...mockedSnapshot,
      hostPlayerId: 'host-1',
      status: 'waiting',
      closedReason: null,
      players: [
        {
          playerId: 'host-1',
          nickname: '房主',
          color: 'yellow',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        },
        {
          playerId: 'player-1',
          nickname: '爸爸',
          color: null,
          status: 'joined',
          ready: false,
          isHost: false,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    };

    const { rerender } = render(<RoomClient code="8966" />);

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.join',
          playerId: 'player-1'
        })
      );
    });

    sendCommandSpy.mockClear();
    sendCommandSpy.mockResolvedValueOnce({
      type: 'command.result',
      seq: 3,
      ok: true,
      room: {
        ...mockedSnapshot,
        players: mockedSnapshot.players.filter((player) => player.playerId !== 'player-1')
      }
    });

    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.leave',
          playerId: 'player-1'
        })
      );
    });

    mockedSnapshot = {
      ...mockedSnapshot,
      players: mockedSnapshot.players.filter((player) => player.playerId !== 'player-1')
    };
    rerender(<RoomClient code="8966" />);

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('/');
    });
    expect(sendCommandSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'room.join',
        playerId: 'player-1'
      })
    );
  });

  it('auto-selects the first available color when the current racer enters without one', async () => {
    mockedSnapshot = {
      ...mockedSnapshot,
      hostPlayerId: 'host-1',
      status: 'waiting',
      closedReason: null,
      players: [
        {
          playerId: 'host-1',
          nickname: '房主',
          color: 'green',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        },
        {
          playerId: 'player-1',
          nickname: '爸爸',
          color: null,
          status: 'joined',
          ready: false,
          isHost: false,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    };

    render(<RoomClient code="8966" />);

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.chooseColor',
          playerId: 'player-1',
          payload: { color: 'yellow' }
        })
      );
    });
  });

  it('waits for the current racer to receive a color before auto-readying', async () => {
    mockedSnapshot = {
      ...mockedSnapshot,
      hostPlayerId: 'host-1',
      status: 'waiting',
      closedReason: null,
      players: [
        {
          playerId: 'host-1',
          nickname: '房主',
          color: 'green',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        },
        {
          playerId: 'player-1',
          nickname: '爸爸',
          color: null,
          status: 'joined',
          ready: false,
          isHost: false,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    };

    render(<RoomClient code="8966" />);

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.chooseColor',
          playerId: 'player-1',
          payload: { color: 'yellow' }
        })
      );
    });

    expect(sendCommandSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'room.ready',
        playerId: 'player-1',
        payload: { ready: true }
      })
    );
  });

  it('auto-readies the current racer after joining the room', async () => {
    mockedSnapshot = {
      ...mockedSnapshot,
      hostPlayerId: 'host-1',
      status: 'waiting',
      closedReason: null,
      players: [
        {
          playerId: 'host-1',
          nickname: '房主',
          color: 'green',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        },
        {
          playerId: 'player-1',
          nickname: '爸爸',
          color: 'yellow',
          status: 'joined',
          ready: false,
          isHost: false,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    };

    render(<RoomClient code="8966" />);

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.ready',
          playerId: 'player-1',
          payload: { ready: true }
        })
      );
    });
  });

  it('does not auto-ready the current racer again after they cancel readiness', async () => {
    mockedSnapshot = {
      ...mockedSnapshot,
      hostPlayerId: 'host-1',
      status: 'waiting',
      closedReason: null,
      players: [
        {
          playerId: 'host-1',
          nickname: '房主',
          color: 'green',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        },
        {
          playerId: 'player-1',
          nickname: '爸爸',
          color: 'yellow',
          status: 'ready',
          ready: true,
          isHost: false,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    };

    const { rerender } = render(<RoomClient code="8966" />);
    fireEvent.click(screen.getByRole('button', { name: '取消准备' }));

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.ready',
          playerId: 'player-1',
          payload: { ready: false }
        })
      );
    });

    sendCommandSpy.mockClear();
    mockedSnapshot = {
      ...mockedSnapshot,
      players: mockedSnapshot.players.map((player) =>
        player.playerId === 'player-1' ? { ...player, ready: false, status: 'joined' } : player
      )
    };

    rerender(<RoomClient code="8966" />);

    expect(screen.getByRole('button', { name: '准备' })).toBeInTheDocument();
    expect(sendCommandSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'room.ready',
        playerId: 'player-1',
        payload: { ready: true }
      })
    );
  });
});
