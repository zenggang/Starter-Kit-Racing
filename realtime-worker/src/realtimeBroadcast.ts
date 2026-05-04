import type { CommandResult, MatchEvent, RealtimeEvent, RoomCommandEnvelope, RoomEvent } from './protocol';

/**
 * Converts command results into the peer-facing event envelope that live socket
 * listeners consume. HTTP bridge commands and socket commands share this exact
 * fanout contract so mixed-transport rooms stay in sync.
 */
export function buildRealtimeEvent(command: RoomCommandEnvelope, result: CommandResult): RealtimeEvent | null {
  if (!result.ok || !result.room) {
    return null;
  }

  if (command.type === 'match.progress' || command.type === 'match.join' || command.type === 'match.leave') {
    return result.match
      ? {
          type: 'match.event',
          seq: result.seq,
          room: result.room,
          match: result.match
        } satisfies MatchEvent
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
 * Fans one authoritative coordinator result out to every connected peer except
 * the originating socket when present. Bridge-originated commands pass
 * `sourceSocket=null`, which means every connected socket receives the event.
 */
export function broadcastRealtimeEvent(
  peers: Iterable<{ send(message: string): void }>,
  command: RoomCommandEnvelope,
  result: CommandResult,
  sourceSocket: { send(message: string): void } | null
): void {
  const event = buildRealtimeEvent(command, result);
  if (!event) {
    return;
  }

  const payload = JSON.stringify(event);
  for (const peer of peers) {
    if (sourceSocket && peer === sourceSocket) {
      continue;
    }

    try {
      peer.send(payload);
    } catch {
      // Ignore stale peers; the DO runtime will clean them up on close.
    }
  }
}
