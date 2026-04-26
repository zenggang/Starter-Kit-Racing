export const ROOM_STATUSES = ['waiting', 'racing', 'finished', 'closed'] as const;
export const PLAYER_STATUSES = ['joined', 'ready', 'disconnected'] as const;
export const TRANSPORT_MODES = ['socket', 'bridge'] as const;
export const PLAYER_COLORS = ['yellow', 'green', 'purple', 'red'] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];
export type TransportMode = (typeof TRANSPORT_MODES)[number];
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
  | 'NOT_ALL_PLAYERS_READY'
  | 'PLAYER_NOT_IN_ROOM'
  | 'COORDINATOR_NOT_READY'
  | 'AUTH_TICKET_INVALID';

export type RoomCommandType =
  | 'room.create'
  | 'room.join'
  | 'room.leave'
  | 'room.setLapTarget'
  | 'room.chooseColor'
  | 'room.ready'
  | 'room.start'
  | 'room.closeExpired'
  | 'sync.request';

export type RealtimeMessageType = 'room.snapshot' | 'room.event' | 'command.result';

export interface RoomPlayer {
  playerId: string;
  nickname: string;
  color: PlayerColor | null;
  status: PlayerStatus;
  ready: boolean;
  isHost: boolean;
  lastSeenAt: string;
}

export interface RoomSnapshot {
  type: 'room.snapshot';
  seq: number;
  room: RoomState;
}

export interface RoomEvent {
  type: 'room.event';
  seq: number;
  room: RoomState;
}

export interface CommandResult {
  type: 'command.result';
  seq: number;
  commandId?: string;
  ok: boolean;
  errorCode?: RacingErrorCode;
  room?: RoomState;
}

export type RealtimeMessage = RoomSnapshot | RoomEvent | CommandResult;

export interface RoomState {
  code: string;
  hostPlayerId: string;
  status: RoomStatus;
  lapTarget: number;
  trackMap: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  expiresAt: string;
  closedReason: string | null;
  players: RoomPlayer[];
}

export interface RoomCommandEnvelope<TPayload = unknown> {
  commandId: string;
  type: RoomCommandType;
  playerId: string;
  nickname?: string;
  payload?: TPayload;
}

/**
 * Validates the Phase 1 lap target contract. The coordinator is the final
 * authority, but client forms and API routes use this helper to fail fast with
 * the same machine-readable error code.
 */
export function validateLapTarget(value: unknown): { ok: true; value: number } | { ok: false; errorCode: 'LAP_TARGET_INVALID' } {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1 || value > 10) {
    return { ok: false, errorCode: 'LAP_TARGET_INVALID' };
  }

  return { ok: true, value };
}

/**
 * Restricts player color selection to vehicle GLB assets that already exist in
 * the repository. Phase 1 does not synthesize or recolor extra vehicles.
 */
export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === 'string' && (PLAYER_COLORS as readonly string[]).includes(value);
}

export function createCommandResult(
  seq: number,
  ok: boolean,
  fields: Omit<Partial<CommandResult>, 'type' | 'seq' | 'ok'> = {}
): CommandResult {
  return {
    type: 'command.result',
    seq,
    ok,
    ...fields
  };
}
