import type { RacingErrorCode, RealtimeMessage, RoomCommandEnvelope, RoomState } from './protocol';

export interface RoomSessionState {
  snapshot: RoomState | null;
  lastSeq: number;
  lastErrorCode: RacingErrorCode | null;
  needsSync: boolean;
}

export const initialRoomSessionState: RoomSessionState = {
  snapshot: null,
  lastSeq: 0,
  lastErrorCode: null,
  needsSync: false
};

/**
 * Projects coordinator messages into the client-visible room snapshot. Events
 * with sequence gaps do not mutate room truth; the caller must send sync.request
 * and replace local state with the returned snapshot.
 */
export function reduceRoomSession(state: RoomSessionState, message: RealtimeMessage): RoomSessionState {
  if (message.seq > state.lastSeq + 1 && state.lastSeq !== 0) {
    return {
      ...state,
      needsSync: true
    };
  }

  if (message.seq <= state.lastSeq && message.type !== 'room.snapshot') {
    return state;
  }

  if (message.type === 'room.snapshot') {
    return {
      snapshot: message.room,
      lastSeq: message.seq,
      lastErrorCode: null,
      needsSync: false
    };
  }

  if (message.type === 'room.event') {
    return {
      snapshot: message.room,
      lastSeq: message.seq,
      lastErrorCode: null,
      needsSync: false
    };
  }

  return {
    snapshot: message.room ?? state.snapshot,
    lastSeq: message.seq,
    lastErrorCode: message.ok ? null : message.errorCode ?? null,
    needsSync: false
  };
}

export function createCommand(type: RoomCommandEnvelope['type'], playerId: string, payload?: unknown): RoomCommandEnvelope {
  return {
    commandId: crypto.randomUUID(),
    type,
    playerId,
    payload
  };
}
