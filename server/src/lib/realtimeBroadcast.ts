import type { CommandResult, MatchEvent, RealtimeEvent, RoomCommandEnvelope, RoomEvent } from './protocol.js';

export function buildRealtimeEvent(command: RoomCommandEnvelope, result: CommandResult): RealtimeEvent | null {
  if (!result.ok || !result.room) {
    return null;
  }

  if (command.type === 'match.progress' || command.type === 'match.join' || command.type === 'match.leave') {
    return result.match
      ? ({
          type: 'match.event',
          seq: result.seq,
          room: result.room,
          match: result.match
        } satisfies MatchEvent)
      : null;
  }

  if (command.type === 'match.sync' && result.match) {
    return {
      type: 'match.event',
      seq: result.seq,
      room: result.room,
      match: result.match
    } satisfies MatchEvent;
  }

  if (command.type === 'sync.request' || command.type === 'match.sync') {
    return null;
  }

  return {
    type: 'room.event',
    seq: result.seq,
    room: result.room
  } satisfies RoomEvent;
}

/**
 * Lifecycle promotion does not originate from a client command, so the room
 * ticker cannot reuse `buildRealtimeEvent()` directly. This helper turns the
 * coordinator result back into the same websocket contract the browser already
 * understands, ensuring countdown -> live and live -> finished transitions are
 * pushed proactively instead of waiting for another player action.
 */
export function buildLifecycleRealtimeEvent(result: CommandResult): RealtimeEvent | null {
  if (!result.ok || !result.room) {
    return null;
  }

  if (result.match) {
    return {
      type: 'match.event',
      seq: result.seq,
      room: result.room,
      match: result.match
    } satisfies MatchEvent;
  }

  return {
    type: 'room.event',
    seq: result.seq,
    room: result.room
  } satisfies RoomEvent;
}
