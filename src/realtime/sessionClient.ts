import { Client, type Room, type SeatReservation } from 'colyseus.js';
import { buildPublicApiUrl, getPublicRuntimeConfig } from '@/config/env';
import type { RacingTrackSummary } from '@/server/tracks';
import { cacheRoomReservation, clearActiveConnection, consumeRoomReservation, getActiveConnection, setActiveConnection } from './roomConnectionStore';
import type { RealtimeMessage, RoomCommandEnvelope } from './protocol';

interface RoomReservationResponse {
  ok: boolean;
  roomCode?: string;
  reservation?: SeatReservation;
  errorCode?: string;
}

export async function createRoomReservation(input: {
  playerId: string;
  nickname: string;
  track: RacingTrackSummary | null;
}): Promise<{ roomCode: string }> {
  const response = await fetch(buildPublicApiUrl('/rooms'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      playerId: input.playerId,
      nickname: input.nickname,
      track: input.track
    })
  });
  const body = (await response.json()) as RoomReservationResponse;

  if (!response.ok || !body.ok || !body.roomCode || !body.reservation) {
    throw new Error(body.errorCode ?? 'COORDINATOR_NOT_READY');
  }

  cacheRoomReservation(body.roomCode, input.playerId, body.reservation);
  return { roomCode: body.roomCode };
}

export async function joinRoomReservation(input: {
  roomCode: string;
  playerId: string;
  nickname: string;
}): Promise<void> {
  const roomCode = input.roomCode.toUpperCase();
  const response = await fetch(buildPublicApiUrl('/rooms'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'join',
      roomCode,
      playerId: input.playerId,
      nickname: input.nickname
    })
  });
  const body = (await response.json()) as RoomReservationResponse;

  if (!response.ok || !body.ok || !body.roomCode || !body.reservation) {
    throw new Error(body.errorCode ?? 'ROOM_NOT_FOUND');
  }

  cacheRoomReservation(body.roomCode, input.playerId, body.reservation);
}

export async function acquireRealtimeRoom(input: {
  roomCode: string;
  playerId: string;
  nickname: string;
}): Promise<Room> {
  const roomCode = input.roomCode.toUpperCase();
  const existing = getActiveConnection(roomCode, input.playerId);
  if (existing) {
    return existing;
  }

  const reservation =
    consumeRoomReservation(roomCode, input.playerId) ??
    (await requestJoinReservation(roomCode, input.playerId, input.nickname));

  const { colyseusUrl } = getPublicRuntimeConfig();
  const client = new Client(colyseusUrl);
  const room = await client.consumeSeatReservation(reservation);
  setActiveConnection(roomCode, input.playerId, room);
  return room;
}

export function attachRealtimeHandlers(
  room: Room,
  onMessage: (message: RealtimeMessage) => void,
  onLeave: () => void,
  onError: (errorCode: string) => void
): void {
  room.removeAllListeners();
  room.onMessage('room.snapshot', (message) => onMessage(message as RealtimeMessage));
  room.onMessage('room.event', (message) => onMessage(message as RealtimeMessage));
  room.onMessage('match.snapshot', (message) => onMessage(message as RealtimeMessage));
  room.onMessage('match.event', (message) => onMessage(message as RealtimeMessage));
  room.onMessage('command.result', (message) => onMessage(message as RealtimeMessage));
  room.onLeave((_code) => onLeave());
  room.onError((_code, message) => onError(message ?? 'COORDINATOR_NOT_READY'));
}

export function sendRealtimeCommand(room: Room, command: RoomCommandEnvelope): void {
  room.send('command', command);
}

export async function disposeRealtimeConnection(): Promise<void> {
  await clearActiveConnection();
}

async function requestJoinReservation(roomCode: string, playerId: string, nickname: string): Promise<SeatReservation> {
  const response = await fetch(buildPublicApiUrl('/rooms'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'join',
      roomCode,
      playerId,
      nickname
    })
  });
  const body = (await response.json()) as RoomReservationResponse;

  if (!response.ok || !body.ok || !body.reservation) {
    throw new Error(body.errorCode ?? 'ROOM_NOT_FOUND');
  }

  return body.reservation;
}
