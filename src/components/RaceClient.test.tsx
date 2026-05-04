import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RaceClient } from './RaceClient';
import type { MatchState, RoomState } from '@/realtime/protocol';
import { encodeTrackCells } from '../../shared/trackMapValidation';

const replaceSpy = vi.fn();
const sendCommandSpy = vi.fn();
const runtimeGetSnapshotSpy = vi.fn(() => ({
  position: { x: 1, y: 0.5, z: 2 },
  heading: 0,
  speed: 1,
  driftIntensity: 0
}));
const runtimeUpdateRemoteVehiclesSpy = vi.fn();
const runtimeSetInputLockedSpy = vi.fn();
let racingRuntimeHostProps: Record<string, unknown> | null = null;
let mockRoom: RoomState;
let mockMatch: MatchState;

const CUSTOM_TRACK_MAP = encodeTrackCells([
  [0, 0, 'track-corner', 16],
  [1, 0, 'track-finish', 16],
  [2, 0, 'track-corner', 0],
  [2, 1, 'track-straight', 0],
  [2, 2, 'track-corner', 22],
  [1, 2, 'track-straight', 16],
  [0, 2, 'track-corner', 10],
  [0, 1, 'track-straight', 0]
]);

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
    room: mockRoom,
    match: mockMatch,
    transportMode: 'bridge',
    connectionState: 'connected',
    lastErrorCode: null,
    sendCommand: sendCommandSpy
  })
}));

vi.mock('@/game/trackProgress', () => ({
  buildTrackProgressModel: vi.fn(() => ({
    points: [
      { x: 0, z: 0 },
      { x: 1, z: 1 }
    ],
    bounds: {
      centerX: 0.5,
      halfWidth: 1,
      centerZ: 0.5,
      halfDepth: 1
    }
  })),
  createInitialRaceProgressState: vi.fn(() => ({
    completedLaps: 0,
    lastNormalizedProgress: 0,
    forwardProgressSinceLapStart: 0,
    checkpoint: 0,
    finished: false,
    finishSent: false,
    finishLineArmed: false
  })),
  advanceRaceProgress: vi.fn(() => ({
    payload: {
      checkpoint: 0,
      completedLaps: 0,
      lapProgress: 0.25,
      position: { x: 1, y: 0.5, z: 2 },
      heading: 0,
      speed: 1,
      finished: false
    },
    state: {
      completedLaps: 0,
      lastNormalizedProgress: 0.25,
      forwardProgressSinceLapStart: 0.25,
      checkpoint: 0,
      finished: false,
      finishSent: false,
      finishLineArmed: true
    }
  }))
}));

vi.mock('@/game/telemetryPolicy', () => ({
  getRaceTelemetryIntervalMs: vi.fn(() => 100)
}));

vi.mock('@/game/RacingRuntimeHost', () => ({
  RacingRuntimeHost: ({ onRuntimeReady, children, ...props }: Record<string, unknown>) => {
    racingRuntimeHostProps = { onRuntimeReady, children, ...props };
    React.useEffect(() => {
      onRuntimeReady?.({
        destroy: vi.fn(),
        getSnapshot: runtimeGetSnapshotSpy,
        updateRemoteVehicles: runtimeUpdateRemoteVehiclesSpy,
        setInputLocked: runtimeSetInputLockedSpy
      });

      return () => {
        onRuntimeReady?.(null);
      };
    }, [onRuntimeReady]);

    return <section data-testid="runtime-host">{children as React.ReactNode}</section>;
  }
}));

function createRaceRoom(): RoomState {
  return {
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
}

function createRaceMatch(): MatchState {
  return {
    id: 'match-1',
    roomCode: '8966',
    phase: 'live',
    lapTarget: 3,
    trackId: 'default',
    trackName: 'Default Track',
    trackMap: null,
    startedAt: '2026-05-03T10:01:12.000Z',
    finishedAt: null,
    finishDeadlineAt: null,
    winnerPlayerId: null,
    players: [
      createMatchPlayer('player-1', '本地车手', 'yellow', { x: 1, y: 0.5, z: 2 }, 0),
      createMatchPlayer('player-2', '远端绿车', 'green', { x: 3, y: 0.5, z: 4 }, 0.5),
      createMatchPlayer('player-3', '远端紫车', 'purple', { x: 5, y: 0.5, z: 6 }, 1.2, 'disconnected')
    ]
  };
}

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T10:01:00.000Z'));
    replaceSpy.mockReset();
    sendCommandSpy.mockReset();
    runtimeGetSnapshotSpy.mockClear();
    runtimeUpdateRemoteVehiclesSpy.mockClear();
    runtimeSetInputLockedSpy.mockClear();
    racingRuntimeHostProps = null;
    mockRoom = createRaceRoom();
    mockMatch = createRaceMatch();
    sendCommandSpy.mockResolvedValue({
      type: 'command.result',
      seq: 1,
      ok: true,
      commandId: 'match.progress:player-1'
    });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('passes only non-local match players into the racing runtime', async () => {
    render(<RaceClient code="8966" />);

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

  it('falls back to the room custom track when match track fields are missing', async () => {
    mockRoom.trackId = 'track-room';
    mockRoom.trackName = '自定义 T 赛道';
    mockRoom.trackMap = CUSTOM_TRACK_MAP;
    mockMatch.trackId = null;
    mockMatch.trackName = null;
    mockMatch.trackMap = null;

    render(<RaceClient code="8966" />);

    expect(racingRuntimeHostProps?.trackMap).toBe(CUSTOM_TRACK_MAP);

    expect(screen.getByText('赛道：自定义 T 赛道')).toBeInTheDocument();
  });

  it('renders the countdown overlay, keeps the race clock at zero, and locks input during countdown', async () => {
    mockMatch.phase = 'countdown';
    mockMatch.startedAt = '2026-05-03T10:01:12.000Z';

    render(<RaceClient code="8966" />);

    expect(screen.getByText('比赛即将开始')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('比赛计时：00:00.000')).toBeInTheDocument();
    expect(racingRuntimeHostProps?.inputLocked).toBe(true);

    await vi.advanceTimersByTimeAsync(250);
    expect(sendCommandSpy).not.toHaveBeenCalled();
  });

  it('sends live telemetry once the race is active', async () => {
    render(<RaceClient code="8966" />);

    await vi.advanceTimersByTimeAsync(150);

    expect(sendCommandSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'match.progress',
        playerId: 'player-1'
      })
    );
  });

  it('locks the local car and shows the waiting message after the player finishes', async () => {
    mockMatch.players[0] = {
      ...mockMatch.players[0],
      finishedAt: '2026-05-03T10:01:33.000Z',
      presence: 'finished',
      completedLaps: 3,
      lapProgress: 1,
      totalProgress: 3
    };

    render(<RaceClient code="8966" />);

    expect(screen.getByText('已完赛，等待其他玩家/等待结算')).toBeInTheDocument();
    expect(racingRuntimeHostProps?.inputLocked).toBe(true);

    await vi.advanceTimersByTimeAsync(150);
    expect(sendCommandSpy).not.toHaveBeenCalled();
  });
});
