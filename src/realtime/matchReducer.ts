import type { MatchState, RealtimeMessage, RacingErrorCode, RoomCommandEnvelope, RoomState } from './protocol';
import { createClientUuid } from '@/utils/clientUuid';

export interface MatchSessionState {
  room: RoomState | null;
  match: MatchState | null;
  lastSeq: number;
  lastErrorCode: RacingErrorCode | null;
  needsSync: boolean;
}

export const initialMatchSessionState: MatchSessionState = {
  room: null,
  match: null,
  lastSeq: 0,
  lastErrorCode: null,
  needsSync: false
};

/**
 * Match reducer mirrors the room reducer, but stores both room lifecycle data
 * and live race state so race pages and result pages can recover from the same
 * bridge or socket message stream.
 */
export function reduceMatchSession(state: MatchSessionState, message: RealtimeMessage): MatchSessionState {
  const isAuthoritativeSnapshot = message.type === 'match.snapshot' || message.type === 'command.result';

  if (message.seq > state.lastSeq + 1 && state.lastSeq !== 0 && !isAuthoritativeSnapshot) {
    return {
      ...state,
      needsSync: true
    };
  }

  if (message.seq <= state.lastSeq && message.type !== 'match.snapshot') {
    return state;
  }

  if (message.type === 'match.snapshot' || message.type === 'match.event') {
    return {
      room: message.room,
      match: message.match,
      lastSeq: message.seq,
      lastErrorCode: null,
      needsSync: false
    };
  }

  if (message.type === 'room.event') {
    return {
      room: message.room,
      match: state.match,
      lastSeq: message.seq,
      lastErrorCode: null,
      needsSync: false
    };
  }

  if (message.type === 'command.result') {
    return {
      room: message.room ?? state.room,
      match: message.match ?? state.match,
      lastSeq: message.seq,
      lastErrorCode: message.ok ? null : message.errorCode ?? null,
      needsSync: false
    };
  }

  return state;
}

export function createMatchCommand<TPayload = unknown>(
  type: RoomCommandEnvelope<TPayload>['type'],
  playerId: string,
  payload?: TPayload
): RoomCommandEnvelope<TPayload> {
  return {
    commandId: createClientUuid(),
    type,
    playerId,
    payload
  };
}
