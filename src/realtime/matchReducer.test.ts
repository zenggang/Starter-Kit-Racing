import { describe, expect, it } from 'vitest';
import { initialMatchSessionState, reduceMatchSession } from './matchReducer';
import type { MatchState, RoomState } from './protocol';

const room: RoomState = {
  id: 'room-1',
  code: 'ABCD',
  hostPlayerId: 'host',
  status: 'racing',
  lapTarget: 3,
  trackMap: null,
  createdAt: '2026-04-26T00:00:00.000Z',
  startedAt: '2026-04-26T00:01:00.000Z',
  finishedAt: null,
  expiresAt: '2026-04-26T01:00:00.000Z',
  closedReason: null,
  matchId: 'match-1',
  players: []
};

const match: MatchState = {
  id: 'match-1',
  roomCode: 'ABCD',
  phase: 'live',
  lapTarget: 3,
  trackMap: null,
  startedAt: '2026-04-26T00:01:00.000Z',
  finishedAt: null,
  winnerPlayerId: null,
  players: []
};

describe('match session reducer', () => {
  it('applies snapshots and ordered events', () => {
    const state = reduceMatchSession(initialMatchSessionState, { type: 'match.snapshot', seq: 1, room, match });
    const next = reduceMatchSession(state, {
      type: 'match.event',
      seq: 2,
      room: { ...room, finishedAt: '2026-04-26T00:02:00.000Z', status: 'finished' },
      match: { ...match, phase: 'finished', finishedAt: '2026-04-26T00:02:00.000Z' }
    });

    expect(next.match?.phase).toBe('finished');
    expect(next.room?.status).toBe('finished');
    expect(next.lastSeq).toBe(2);
    expect(next.needsSync).toBe(false);
  });

  it('flags sequence gaps without applying the event', () => {
    const state = reduceMatchSession(initialMatchSessionState, { type: 'match.snapshot', seq: 1, room, match });
    const next = reduceMatchSession(state, {
      type: 'match.event',
      seq: 3,
      room,
      match: { ...match, phase: 'finished' }
    });

    expect(next.match?.phase).toBe('live');
    expect(next.needsSync).toBe(true);
  });

  it('records command errors and keeps the previous match snapshot', () => {
    const state = reduceMatchSession(initialMatchSessionState, { type: 'match.snapshot', seq: 1, room, match });
    const next = reduceMatchSession(state, { type: 'command.result', seq: 2, ok: false, errorCode: 'MATCH_NOT_ACTIVE' });

    expect(next.match).toEqual(match);
    expect(next.lastErrorCode).toBe('MATCH_NOT_ACTIVE');
  });

  it('applies newer command results even when bridge responses arrive out of order', () => {
    const state = reduceMatchSession(initialMatchSessionState, { type: 'match.snapshot', seq: 1, room, match });
    const next = reduceMatchSession(state, {
      type: 'command.result',
      seq: 3,
      ok: true,
      room,
      match: {
        ...match,
        players: [
          {
            playerId: 'player-1',
            nickname: 'LocalRacer',
            color: 'yellow',
            isHost: true,
            presence: 'connected',
            rank: 1,
            position: { x: 12, y: 0.5, z: 18 },
            heading: 0.5,
            speed: 4,
            checkpoint: 6,
            completedLaps: 0,
            lapProgress: 0.42,
            totalProgress: 0.42,
            lastReportAt: '2026-04-26T00:01:01.000Z',
            finishedAt: null
          }
        ]
      }
    });

    expect(next.match?.players[0]?.lapProgress).toBe(0.42);
    expect(next.lastSeq).toBe(3);
    expect(next.needsSync).toBe(false);
  });
});
