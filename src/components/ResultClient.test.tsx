import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultClient } from './ResultClient';

const pushSpy = vi.fn();
const replaceSpy = vi.fn();
const sendCommandSpy = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushSpy,
    replace: replaceSpy
  })
}));

let mockedSession = {
  playerId: 'player-1',
  nickname: '车手1',
  lastRoomCode: '8966'
};

vi.mock('@/session/usePlayerSession', () => ({
  usePlayerSession: () => ({
    session: mockedSession
  })
}));

let mockedRoom = {
  id: 'room-1',
  code: '8966',
  hostPlayerId: 'player-1',
  status: 'finished' as const,
  lapTarget: 3,
  trackMap: null,
  createdAt: '2026-05-02T10:00:00.000Z',
  startedAt: '2026-05-02T10:01:00.000Z',
  finishedAt: '2026-05-02T10:02:00.000Z',
  expiresAt: '2026-05-02T11:00:00.000Z',
  closedReason: null,
  matchId: 'match-1',
  players: []
};

let mockedMatch = {
  id: 'match-1',
  roomCode: '8966',
  phase: 'finished' as const,
  lapTarget: 3,
  trackMap: null,
  startedAt: '2026-05-02T10:01:00.000Z',
  finishedAt: '2026-05-02T10:02:00.000Z',
  finishDeadlineAt: '2026-05-02T10:03:00.000Z',
  winnerPlayerId: 'player-1',
  players: [
    {
      playerId: 'player-1',
      nickname: '车手1',
      color: 'yellow' as const,
      isHost: true,
      presence: 'finished' as const,
      rank: 1,
      finishedAt: '2026-05-02T10:01:44.000Z',
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 20,
      checkpoint: 7,
      completedLaps: 3,
      lapProgress: 1,
      totalProgress: 1,
      lastReportAt: '2026-05-02T10:01:44.000Z'
    },
    {
      playerId: 'player-2',
      nickname: '车手2',
      color: 'green' as const,
      isHost: false,
      presence: 'finished' as const,
      rank: 2,
      finishedAt: '2026-05-02T10:01:47.000Z',
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 20,
      checkpoint: 7,
      completedLaps: 3,
      lapProgress: 1,
      totalProgress: 1,
      lastReportAt: '2026-05-02T10:01:47.000Z'
    },
    {
      playerId: 'player-3',
      nickname: '车手3',
      color: 'purple' as const,
      isHost: false,
      presence: 'finished' as const,
      rank: 3,
      finishedAt: '2026-05-02T10:01:50.000Z',
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 20,
      checkpoint: 7,
      completedLaps: 3,
      lapProgress: 1,
      totalProgress: 1,
      lastReportAt: '2026-05-02T10:01:50.000Z'
    },
    {
      playerId: 'player-4',
      nickname: '车手4',
      color: 'red' as const,
      isHost: false,
      presence: 'finished' as const,
      rank: 4,
      finishedAt: null,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 18,
      checkpoint: 6,
      completedLaps: 2,
      lapProgress: 0.74,
      totalProgress: 0.91,
      lastReportAt: '2026-05-02T10:01:58.000Z'
    }
  ]
};

vi.mock('@/realtime/useMatchSession', () => ({
  useMatchSession: () => ({
    room: mockedRoom,
    match: mockedMatch,
    connectionState: 'connected',
    lastErrorCode: null,
    sendCommand: sendCommandSpy
  })
}));

describe('ResultClient', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    sendCommandSpy.mockReset();
    sendCommandSpy.mockResolvedValue({
      type: 'command.result',
      seq: 2,
      ok: true,
      room: {
        ...mockedRoom
      }
    });

    mockedSession = {
      playerId: 'player-1',
      nickname: '车手1',
      lastRoomCode: '8966'
    };

    mockedRoom = {
      id: 'room-1',
      code: '8966',
      hostPlayerId: 'player-1',
      status: 'finished',
      lapTarget: 3,
      trackMap: null,
      createdAt: '2026-05-02T10:00:00.000Z',
      startedAt: '2026-05-02T10:01:00.000Z',
      finishedAt: '2026-05-02T10:02:00.000Z',
      expiresAt: '2026-05-02T11:00:00.000Z',
      closedReason: null,
      matchId: 'match-1',
      players: []
    };
  });

  it('uses the compact roster density when the result board contains four racers', () => {
    const { container } = render(<ResultClient code="8966" />);

    expect(container.querySelector('.result-driver-grid')).toHaveAttribute('data-roster-density', 'compact');
    expect(container.querySelector('.result-console')).toHaveAttribute('data-result-count', '4');
  });

  it('sends room.leave before returning a guest to the hall from the result page', async () => {
    mockedRoom = {
      ...mockedRoom,
      hostPlayerId: 'host-1'
    };

    render(<ResultClient code="8966" />);

    fireEvent.click(screen.getByRole('button', { name: '返回大厅' }));

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.leave',
          playerId: 'player-1'
        })
      );
    });
    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('/hall');
    });
    expect(pushSpy).not.toHaveBeenCalledWith('/hall');
  });

  it('returns result-page racers to the hall when the host closes the finished room', async () => {
    mockedRoom = {
      ...mockedRoom,
      hostPlayerId: 'host-1',
      status: 'closed',
      closedReason: 'host_left'
    };

    render(<ResultClient code="8966" />);

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('/hall');
    });
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
