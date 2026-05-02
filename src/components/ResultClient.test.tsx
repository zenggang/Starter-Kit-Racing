import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultClient } from './ResultClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock('@/session/usePlayerSession', () => ({
  usePlayerSession: () => ({
    session: {
      playerId: 'player-1',
      nickname: '车手1',
      lastRoomCode: '8966'
    }
  })
}));

vi.mock('@/realtime/useMatchSession', () => ({
  useMatchSession: () => ({
    room: {
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
    },
    match: {
      id: 'match-1',
      roomCode: '8966',
      phase: 'finished',
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
          color: 'yellow',
          isHost: true,
          presence: 'finished',
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
          color: 'green',
          isHost: false,
          presence: 'finished',
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
          color: 'purple',
          isHost: false,
          presence: 'finished',
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
          color: 'red',
          isHost: false,
          presence: 'finished',
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
    },
    connectionState: 'connected',
    lastErrorCode: null,
    sendCommand: vi.fn()
  })
}));

describe('ResultClient', () => {
  it('uses the compact roster density when the result board contains four racers', () => {
    const { container } = render(<ResultClient code="8966" />);

    expect(container.querySelector('.result-driver-grid')).toHaveAttribute('data-roster-density', 'compact');
  });
});
