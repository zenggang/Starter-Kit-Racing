import { describe, expect, it } from 'vitest';
import type { CommandResult, MatchState, RoomState } from './protocol.js';
import { buildLifecycleRealtimeEvent } from './realtimeBroadcast.js';

function createRoomState(): RoomState {
  return {
    id: 'room-1',
    code: '1234',
    hostPlayerId: 'player-1',
    status: 'racing',
    lapTarget: 3,
    trackId: null,
    trackName: '默认赛道',
    trackMap: null,
    createdAt: '2026-05-10T00:00:00.000Z',
    startedAt: '2026-05-10T00:00:00.000Z',
    finishedAt: null,
    closedAt: null,
    expiresAt: '2026-05-10T01:00:00.000Z',
    closedReason: null,
    matchId: 'match-1',
    seq: 4,
    players: [],
    activeMatch: null
  };
}

function createMatchState(): MatchState {
  return {
    id: 'match-1',
    roomCode: '1234',
    phase: 'live',
    lapTarget: 3,
    trackId: null,
    trackName: '默认赛道',
    trackMap: null,
    startedAt: '2026-05-10T00:00:15.000Z',
    finishedAt: null,
    finishDeadlineAt: null,
    winnerPlayerId: null,
    players: []
  };
}

describe('buildLifecycleRealtimeEvent', () => {
  it('broadcasts a match event when lifecycle promotion updates an active match', () => {
    const room = createRoomState();
    const match = createMatchState();
    const result: CommandResult = {
      type: 'command.result',
      ok: true,
      seq: 5,
      room,
      match
    };

    expect(buildLifecycleRealtimeEvent(result)).toEqual({
      type: 'match.event',
      seq: 5,
      room,
      match
    });
  });

  it('broadcasts a room event when lifecycle changes only affect room metadata', () => {
    const room = {
      ...createRoomState(),
      status: 'closed' as const,
      activeMatch: null
    };
    const result: CommandResult = {
      type: 'command.result',
      ok: true,
      seq: 6,
      room
    };

    expect(buildLifecycleRealtimeEvent(result)).toEqual({
      type: 'room.event',
      seq: 6,
      room
    });
  });

  it('returns null for unsuccessful lifecycle ticks so the room does not broadcast fake state', () => {
    const result: CommandResult = {
      type: 'command.result',
      ok: false,
      seq: 6,
      errorCode: 'ROOM_NOT_FOUND'
    };

    expect(buildLifecycleRealtimeEvent(result)).toBeNull();
  });
});
