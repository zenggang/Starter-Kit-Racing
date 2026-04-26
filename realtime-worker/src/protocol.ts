export const ROOM_STATUSES = ['waiting', 'racing', 'finished', 'closed'] as const;
export const PLAYER_COLORS = ['yellow', 'green', 'purple', 'red'] as const;
export const DEFAULT_LAP_TARGET = 3;
export const WAITING_ROOM_TTL_MS = 60 * 60 * 1000;

export type RoomStatus = (typeof ROOM_STATUSES)[number];
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export type RacingErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CLOSED'
  | 'ROOM_NOT_WAITING'
  | 'ROOM_EXPIRED'
  | 'COLOR_TAKEN'
  | 'COLOR_INVALID'
  | 'LAP_TARGET_INVALID'
  | 'ONLY_HOST_CAN_START'
  | 'MIN_PLAYERS_REQUIRED'
  | 'NOT_ALL_PLAYERS_READY'
  | 'PLAYER_NOT_IN_ROOM'
  | 'AUTH_TICKET_INVALID';

export type RoomCommandType =
  | 'room.create'
  | 'room.join'
  | 'room.setLapTarget'
  | 'room.chooseColor'
  | 'room.ready'
  | 'room.start'
  | 'room.closeExpired'
  | 'sync.request';

export interface AuthTicket {
  playerId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface RoomPlayer {
  playerId: string;
  nickname: string;
  color: PlayerColor | null;
  status: 'joined' | 'ready' | 'disconnected';
  ready: boolean;
  isHost: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface RoomState {
  code: string;
  hostPlayerId: string;
  status: RoomStatus;
  lapTarget: number;
  trackMap: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  closedAt: string | null;
  expiresAt: string;
  closedReason: 'not_started_timeout' | null;
  seq: number;
  players: RoomPlayer[];
}

export interface CommandResult {
  type: 'command.result';
  commandId?: string;
  ok: boolean;
  seq: number;
  errorCode?: RacingErrorCode;
  room?: RoomState;
}

export interface RoomSnapshot {
  type: 'room.snapshot';
  seq: number;
  room: RoomState;
}

export type CreateRoomPayload = {
  roomCode?: string;
  nickname: string;
};

export type JoinRoomPayload = {
  nickname: string;
};

export type SetLapTargetPayload = {
  lapTarget: number;
};

export type ChooseColorPayload = {
  color: unknown;
};

export type ReadyPayload = {
  ready?: boolean;
};

export type RoomCommandPayloadMap = {
  'room.create': CreateRoomPayload;
  'room.join': JoinRoomPayload;
  'room.setLapTarget': SetLapTargetPayload;
  'room.chooseColor': ChooseColorPayload;
  'room.ready': ReadyPayload;
  'room.start': Record<string, never>;
  'room.closeExpired': Record<string, never>;
  'sync.request': Record<string, never>;
};

export interface RoomCommandEnvelope<TPayload = unknown> {
  commandId: string;
  type: RoomCommandType;
  playerId: string;
  authTicket: AuthTicket;
  payload: TPayload;
}

/**
 * Keeps all machine-readable command failures inside the Phase 1 protocol
 * contract. Worker routes and tests can use the same result shape as DO RPC.
 */
export function commandError(commandId: string | undefined, seq: number, errorCode: RacingErrorCode): CommandResult {
  return {
    type: 'command.result',
    commandId,
    ok: false,
    seq,
    errorCode
  };
}

/**
 * The coordinator is the authority for lap count. The browser may pre-check
 * forms, but only this shared protocol helper defines the accepted range.
 */
export function validateLapTarget(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

/**
 * Colors are limited to the four vehicle colors already agreed for Phase 1.
 * Unknown values are rejected instead of becoming ad-hoc custom skins.
 */
export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === 'string' && (PLAYER_COLORS as readonly string[]).includes(value);
}

/**
 * Phase 1 auth intentionally validates only ticket shape, ownership, and time
 * bounds. Signature verification can be added by the ticket issuer later
 * without changing room lifecycle semantics.
 */
export function isAuthTicketValid(ticket: AuthTicket | undefined, playerId: string, now: number): ticket is AuthTicket {
  return Boolean(
    ticket &&
      ticket.playerId === playerId &&
      Number.isFinite(ticket.issuedAt) &&
      Number.isFinite(ticket.expiresAt) &&
      ticket.issuedAt <= now &&
      ticket.expiresAt > now
  );
}
