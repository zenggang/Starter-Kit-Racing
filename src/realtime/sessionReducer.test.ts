import { describe, expect, it } from 'vitest';
import { initialRoomSessionState, reduceRoomSession } from './sessionReducer';
import type { RoomState } from './protocol';

const room: RoomState = {
  id: 'room-1',
  code: 'ABCD',
  hostPlayerId: 'host',
  status: 'waiting',
  lapTarget: 3,
  trackMap: null,
  createdAt: '2026-04-26T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  expiresAt: '2026-04-26T01:00:00.000Z',
  closedReason: null,
  matchId: null,
  players: []
};

describe('room session reducer', () => {
  it('applies snapshots and ordered events', () => {
    const state = reduceRoomSession(initialRoomSessionState, { type: 'room.snapshot', seq: 1, room });
    const nextRoom = { ...room, lapTarget: 5 };
    const next = reduceRoomSession(state, { type: 'room.event', seq: 2, room: nextRoom });

    expect(next.snapshot?.lapTarget).toBe(5);
    expect(next.lastSeq).toBe(2);
    expect(next.needsSync).toBe(false);
  });

  it('flags sequence gaps without applying the event', () => {
    const state = reduceRoomSession(initialRoomSessionState, { type: 'room.snapshot', seq: 1, room });
    const next = reduceRoomSession(state, { type: 'room.event', seq: 3, room: { ...room, lapTarget: 7 } });

    expect(next.snapshot?.lapTarget).toBe(3);
    expect(next.needsSync).toBe(true);
  });

  it('records command errors and keeps the previous snapshot', () => {
    const state = reduceRoomSession(initialRoomSessionState, { type: 'room.snapshot', seq: 1, room });
    const next = reduceRoomSession(state, { type: 'command.result', seq: 2, ok: false, errorCode: 'COLOR_TAKEN' });

    expect(next.snapshot).toEqual(room);
    expect(next.lastErrorCode).toBe('COLOR_TAKEN');
  });

  it('applies newer command results even when bridge responses arrive out of order', () => {
    const state = reduceRoomSession(initialRoomSessionState, { type: 'room.snapshot', seq: 1, room });
    const nextRoom = { ...room, lapTarget: 5 };
    const next = reduceRoomSession(state, {
      type: 'command.result',
      seq: 3,
      ok: true,
      room: nextRoom
    });

    expect(next.snapshot?.lapTarget).toBe(5);
    expect(next.lastSeq).toBe(3);
    expect(next.needsSync).toBe(false);
  });
});
