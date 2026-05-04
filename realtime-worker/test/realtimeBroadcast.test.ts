import { describe, expect, it, vi } from 'vitest';
import { broadcastRealtimeEvent } from '../src/realtimeBroadcast';
import type { CommandResult, MatchState, RoomCommandEnvelope, RoomState } from '../src/protocol';

const room: RoomState = {
  id: 'room-1',
  code: '8693',
  hostPlayerId: 'host-1',
  status: 'racing',
  lapTarget: 3,
  trackMap: null,
  createdAt: '2026-05-03T00:00:00.000Z',
  startedAt: '2026-05-03T00:01:00.000Z',
  finishedAt: null,
  closedAt: null,
  expiresAt: '2026-05-03T01:00:00.000Z',
  closedReason: null,
  matchId: 'match-1',
  seq: 9,
  players: [
    {
      playerId: 'host-1',
      nickname: 'Host',
      color: 'yellow',
      status: 'ready',
      ready: true,
      isHost: true,
      joinedAt: '2026-05-03T00:00:00.000Z',
      lastSeenAt: '2026-05-03T00:01:00.000Z'
    },
    {
      playerId: 'guest-1',
      nickname: 'Guest',
      color: 'purple',
      status: 'ready',
      ready: true,
      isHost: false,
      joinedAt: '2026-05-03T00:00:10.000Z',
      lastSeenAt: '2026-05-03T00:01:00.000Z'
    }
  ],
  activeMatch: null
};

const match: MatchState = {
  id: 'match-1',
  roomCode: '8693',
  phase: 'live',
  lapTarget: 3,
  trackMap: null,
  startedAt: '2026-05-03T00:01:00.000Z',
  finishedAt: null,
  winnerPlayerId: null,
  players: [
    {
      playerId: 'host-1',
      nickname: 'Host',
      color: 'yellow',
      isHost: true,
      presence: 'connected',
      rank: 1,
      finishedAt: null,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      checkpoint: 0,
      completedLaps: 0,
      lapProgress: 0,
      totalProgress: 0,
      lastReportAt: null
    }
  ]
};

describe('realtime broadcast fanout', () => {
  it('fans authoritative match.sync countdown promotions out as match events', () => {
    const peer = {
      send: vi.fn()
    };

    const command: RoomCommandEnvelope = {
      commandId: 'match.sync:host-1',
      type: 'match.sync',
      playerId: 'host-1',
      authTicket: {
        playerId: 'host-1',
        roomCode: '8693',
        issuedAt: 1,
        expiresAt: 2
      },
      payload: {}
    };
    const result: CommandResult = {
      type: 'command.result',
      commandId: 'match.sync:host-1',
      ok: true,
      seq: 10,
      room,
      match: {
        ...match,
        phase: 'live'
      }
    };

    broadcastRealtimeEvent([peer], command, result, null);

    expect(peer.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(peer.send.mock.calls[0][0] as string)).toMatchObject({
      type: 'match.event',
      match: {
        phase: 'live'
      }
    });
  });

  it('fans bridge-triggered room events out to every connected socket peer', () => {
    const peerA = {
      send: vi.fn()
    };
    const peerB = {
      send: vi.fn()
    };

    const command: RoomCommandEnvelope = {
      commandId: 'room.start:host-1',
      type: 'room.start',
      playerId: 'host-1',
      authTicket: {
        playerId: 'host-1',
        roomCode: '8693',
        issuedAt: 1,
        expiresAt: 2
      },
      payload: {}
    };
    const result: CommandResult = {
      type: 'command.result',
      commandId: 'room.start:host-1',
      ok: true,
      seq: 9,
      room,
      match
    };

    broadcastRealtimeEvent([peerA, peerB], command, result, null);

    expect(peerA.send).toHaveBeenCalledTimes(1);
    expect(peerB.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(peerA.send.mock.calls[0][0] as string)).toMatchObject({
      type: 'room.event',
      room: {
        status: 'racing',
        code: '8693'
      }
    });
  });

  it('fans bridge-triggered rematch resets out to result-page socket peers', () => {
    const peer = {
      send: vi.fn()
    };

    const command: RoomCommandEnvelope = {
      commandId: 'room.rematch:host-1',
      type: 'room.rematch',
      playerId: 'host-1',
      authTicket: {
        playerId: 'host-1',
        roomCode: '8693',
        issuedAt: 1,
        expiresAt: 2
      },
      payload: {}
    };
    const result: CommandResult = {
      type: 'command.result',
      commandId: 'room.rematch:host-1',
      ok: true,
      seq: 10,
      room: {
        ...room,
        status: 'waiting',
        startedAt: null,
        finishedAt: null,
        matchId: null
      }
    };

    broadcastRealtimeEvent([peer], command, result, null);

    expect(peer.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(peer.send.mock.calls[0][0] as string)).toMatchObject({
      type: 'room.event',
      room: {
        status: 'waiting',
        code: '8693',
        matchId: null
      }
    });
  });
});
