import type { Room, SeatReservation } from 'colyseus.js';

interface CachedReservation {
  playerId: string;
  reservation: SeatReservation;
}

interface ActiveConnection {
  roomCode: string;
  playerId: string;
  room: Room;
}

let activeConnection: ActiveConnection | null = null;
const reservationByRoomCode = new Map<string, CachedReservation>();

export function cacheRoomReservation(roomCode: string, playerId: string, reservation: SeatReservation): void {
  reservationByRoomCode.set(roomCode.toUpperCase(), { playerId, reservation });
}

export function consumeRoomReservation(roomCode: string, playerId: string): SeatReservation | null {
  const normalizedCode = roomCode.toUpperCase();
  const cached = reservationByRoomCode.get(normalizedCode);
  if (!cached || cached.playerId !== playerId) {
    return null;
  }

  reservationByRoomCode.delete(normalizedCode);
  return cached.reservation;
}

export function getActiveConnection(roomCode: string, playerId: string): Room | null {
  if (!activeConnection) return null;
  if (activeConnection.roomCode !== roomCode.toUpperCase() || activeConnection.playerId !== playerId) {
    return null;
  }

  return activeConnection.room;
}

export function setActiveConnection(roomCode: string, playerId: string, room: Room): void {
  activeConnection = {
    roomCode: roomCode.toUpperCase(),
    playerId,
    room
  };
}

export async function clearActiveConnection(): Promise<void> {
  if (!activeConnection) return;
  const room = activeConnection.room;
  activeConnection = null;
  try {
    await room.leave();
  } catch {
    // Ignore close races.
  }
}

export function detachActiveListeners(roomCode: string, playerId: string): void {
  const room = getActiveConnection(roomCode, playerId);
  room?.removeAllListeners();
}
