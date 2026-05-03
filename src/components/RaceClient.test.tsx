import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RaceClient } from './RaceClient';
import type { MatchState, RoomState } from '@/realtime/protocol';

const replaceSpy = vi.fn();
const sendCommandSpy = vi.fn();
let racingRuntimeHostProps: Record<string, unknown> | null = null;

vi.stubGlobal('React', React);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceSpy
  })
}));

vi.mock('@/session/usePlayerSession', () => ({
  usePlayerSession: () => ({
    session: {
      playerId: 'player-1',
      nickname: '本地车手',
      lastRoomCode: '8966'
    }
  })
}));

vi.mock('@/realtime/useMatchSession', () => ({
  useMatchSession: () => ({
    room: raceRoom,
    match: raceMatch,
    transportMode: 'bridge',
    connectionState: 'connected',
    lastErrorCode: null,
    sendCommand: sendCommandSpy
  })
}));

vi.mock('@/game/RacingRuntimeHost', () => ({
  RacingRuntimeHost: (props: Record<string, unknown>) => {
    racingRuntimeHostProps = props;
    return <section data-testid="runtime-host">{props.children as React.ReactNode}</section>;
  }
}));

const raceRoom: RoomState = {
  id: 'room-1',
  code: '8966',
  hostPlayerId: 'player-1',
  status: 'racing',
  lapTarget: 3,
  trackId: 'default',
  trackName: 'Default Track',
  trackMap: null,
  createdAt: '2026-05-03T10:00:00.000Z',
  startedAt: '2026-05-03T10:01:00.000Z',
  finishedAt: null,
  expiresAt: '2026-05-03T11:00:00.000Z',
  closedReason: null,
  matchId: 'match-1',
  players: []
};

const raceMatch: MatchState = {
  id: 'match-1',
  roomCode: '8966',
  phase: 'live',
  lapTarget: 3,
  trackId: 'default',
  trackName: 'Default Track',
  trackMap: null,
  startedAt: '2026-05-03T10:01:00.000Z',
  finishedAt: null,
  finishDeadlineAt: null,
  winnerPlayerId: null,
  players: [
    createMatchPlayer('player-1', '本地车手', 'yellow', { x: 1, y: 0.5, z: 2 }, 0),
    createMatchPlayer('player-2', '远端绿车', 'green', { x: 3, y: 0.5, z: 4 }, 0.5),
    createMatchPlayer('player-3', '远端紫车', 'purple', { x: 5, y: 0.5, z: 6 }, 1.2, 'disconnected')
  ]
};

function createMatchPlayer(
  playerId: string,
  nickname: string,
  color: MatchState['players'][number]['color'],
  position: MatchState['players'][number]['position'],
  heading: number,
  presence: MatchState['players'][number]['presence'] = 'connected'
): MatchState['players'][number] {
  return {
    playerId,
    nickname,
    color,
    isHost: playerId === 'player-1',
    presence,
    rank: Number(playerId.at(-1) ?? 1),
    finishedAt: null,
    position,
    heading,
    speed: 12,
    checkpoint: 0,
    completedLaps: 0,
    lapProgress: 0,
    totalProgress: 0,
    lastReportAt: '2026-05-03T10:01:02.000Z'
  };
}

describe('RaceClient remote vehicle projection', () => {
  it('passes only non-local match players into the racing runtime', async () => {
    render(<RaceClient code="8966" />);

    await waitFor(() => {
      expect(racingRuntimeHostProps?.remoteVehicles).toEqual([
        {
          playerId: 'player-2',
          nickname: '远端绿车',
          color: 'green',
          presence: 'connected',
          position: { x: 3, y: 0.5, z: 4 },
          heading: 0.5,
          speed: 12,
          lastReportAt: '2026-05-03T10:01:02.000Z'
        },
        {
          playerId: 'player-3',
          nickname: '远端紫车',
          color: 'purple',
          presence: 'disconnected',
          position: { x: 5, y: 0.5, z: 6 },
          heading: 1.2,
          speed: 12,
          lastReportAt: '2026-05-03T10:01:02.000Z'
        }
      ]);
    });
  });
});
