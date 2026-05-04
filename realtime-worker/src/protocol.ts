import type { TrackMapErrorCode } from '../../shared/trackMapValidation';

export const ROOM_STATUSES = ['waiting', 'racing', 'finished', 'closed'] as const;
export const PLAYER_COLORS = ['yellow', 'green', 'purple', 'red'] as const;
export const MATCH_PHASES = ['countdown', 'live', 'finished', 'aborted'] as const;
export const MATCH_PRESENCE = ['pending', 'connected', 'disconnected', 'finished'] as const;
export const DEFAULT_LAP_TARGET = 3;
export const WAITING_ROOM_TTL_MS = 60 * 60 * 1000;
export const FINISHED_ROOM_TTL_MS = 60 * 60 * 1000;
export const MATCH_START_COUNTDOWN_MS = 15 * 1000;

export type RoomStatus = (typeof ROOM_STATUSES)[number];
export type PlayerColor = (typeof PLAYER_COLORS)[number];
export type MatchPhase = (typeof MATCH_PHASES)[number];
export type MatchPresence = (typeof MATCH_PRESENCE)[number];

export type RacingErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_CLOSED'
  | 'ROOM_NOT_WAITING'
  | 'ROOM_NOT_FINISHED'
  | 'ROOM_EXPIRED'
  | 'COLOR_TAKEN'
  | 'COLOR_INVALID'
  | 'LAP_TARGET_INVALID'
  | 'ONLY_HOST_CAN_START'
  | 'ONLY_HOST_CAN_REMATCH'
  | 'MIN_PLAYERS_REQUIRED'
  | 'NOT_ALL_PLAYERS_READY'
  | 'PLAYER_NOT_IN_ROOM'
  | 'AUTH_TICKET_INVALID'
  | 'MATCH_NOT_FOUND'
  | 'MATCH_NOT_ACTIVE'
  | 'MATCH_NOT_JOINABLE'
  | 'MATCH_PHASE_INVALID'
  | 'MATCH_PLAYER_NOT_REGISTERED'
  | 'MATCH_PROGRESS_INVALID'
  | 'MATCH_PROGRESS_REGRESSION'
  | 'MATCH_FINISH_DUPLICATE'
  | 'MATCH_SYNC_REQUIRED'
  | 'MATCH_TICKET_ROOM_MISMATCH'
  | 'TRACK_NOT_FOUND'
  | TrackMapErrorCode;

export type RoomCommandType =
  | 'room.create'
  | 'room.join'
  | 'room.leave'
  | 'room.setLapTarget'
  | 'room.chooseColor'
  | 'room.ready'
  | 'room.start'
  | 'room.rematch'
  | 'room.closeExpired'
  | 'sync.request';

export type MatchCommandType = 'match.join' | 'match.leave' | 'match.progress' | 'match.sync';
export type RealtimeCommandType = RoomCommandType | MatchCommandType;

export interface AuthTicket {
  playerId: string;
  roomCode?: string;
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

export interface MatchTelemetry {
  position: {
    x: number;
    y: number;
    z: number;
  };
  heading: number;
  speed: number;
  checkpoint: number;
  completedLaps: number;
  lapProgress: number;
  totalProgress: number;
  lastReportAt: string | null;
}

export interface MatchPlayerState extends MatchTelemetry {
  playerId: string;
  nickname: string;
  color: PlayerColor;
  isHost: boolean;
  presence: MatchPresence;
  rank: number;
  finishedAt: string | null;
}

export interface MatchState {
  id: string;
  roomCode: string;
  phase: MatchPhase;
  lapTarget: number;
  trackId: string | null;
  trackName: string | null;
  trackMap: string | null;
  startedAt: string;
  finishedAt: string | null;
  finishDeadlineAt?: string | null;
  winnerPlayerId: string | null;
  players: MatchPlayerState[];
}

export interface RoomState {
  id: string;
  code: string;
  hostPlayerId: string;
  status: RoomStatus;
  lapTarget: number;
  trackId: string | null;
  trackName: string | null;
  trackMap: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  closedAt: string | null;
  expiresAt: string;
  closedReason: 'not_started_timeout' | 'finished_timeout' | 'host_left' | 'room_empty' | null;
  matchId: string | null;
  seq: number;
  players: RoomPlayer[];
  activeMatch: MatchState | null;
}

export interface CommandResult {
  type: 'command.result';
  commandId?: string;
  ok: boolean;
  seq: number;
  errorCode?: RacingErrorCode;
  room?: RoomState;
  match?: MatchState;
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

export interface MatchSnapshot {
  type: 'match.snapshot';
  seq: number;
  room: RoomState;
  match: MatchState;
}

export interface MatchEvent {
  type: 'match.event';
  seq: number;
  room: RoomState;
  match: MatchState;
}

export type RealtimeEvent = RoomSnapshot | RoomEvent | MatchSnapshot | MatchEvent | CommandResult;

export type CreateRoomPayload = {
  roomCode?: string;
  nickname: string;
  trackId?: string | null;
  trackName?: string | null;
  trackMap?: string | null;
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

export type MatchProgressPayload = {
  checkpoint: number;
  completedLaps: number;
  lapProgress: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  heading: number;
  speed: number;
  finished?: boolean;
};

export type RoomCommandPayloadMap = {
  'room.create': CreateRoomPayload;
  'room.join': JoinRoomPayload;
  'room.leave': Record<string, never>;
  'room.setLapTarget': SetLapTargetPayload;
  'room.chooseColor': ChooseColorPayload;
  'room.ready': ReadyPayload;
  'room.start': Record<string, never>;
  'room.rematch': Record<string, never>;
  'room.closeExpired': Record<string, never>;
  'sync.request': Record<string, never>;
  'match.join': Record<string, never>;
  'match.leave': Record<string, never>;
  'match.progress': MatchProgressPayload;
  'match.sync': Record<string, never>;
};

export interface RoomCommandEnvelope<TPayload = unknown> {
  commandId: string;
  type: RealtimeCommandType;
  playerId: string;
  authTicket: AuthTicket;
  payload: TPayload;
}

/**
 * Keeps all machine-readable command failures inside the shared realtime
 * protocol contract so worker routes, WebSocket handlers, and unit tests emit
 * the same envelope shape regardless of transport.
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
 * The coordinator is the final authority for lap target, but both the worker
 * and the Next.js shell share this exact range contract.
 */
export function validateLapTarget(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;
}

/**
 * Color selection must stay inside the four existing GLB variants so the room
 * roster, minimap markers, and local runtime all agree on the same palette.
 */
export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === 'string' && (PLAYER_COLORS as readonly string[]).includes(value);
}

/**
 * Match telemetry is intentionally lightweight: the browser reports local race
 * progress while the coordinator owns ordering, finish state, and result shape.
 */
export function validateMatchProgressPayload(value: unknown): value is MatchProgressPayload {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Partial<MatchProgressPayload>;
  const position = payload.position;

  return Boolean(
    Number.isInteger(payload.checkpoint) &&
      typeof payload.completedLaps === 'number' &&
      Number.isInteger(payload.completedLaps) &&
      payload.completedLaps >= 0 &&
      typeof payload.lapProgress === 'number' &&
      payload.lapProgress >= 0 &&
      payload.lapProgress <= 1 &&
      position &&
      typeof position.x === 'number' &&
      typeof position.y === 'number' &&
      typeof position.z === 'number' &&
      typeof payload.heading === 'number' &&
      Number.isFinite(payload.heading) &&
      typeof payload.speed === 'number' &&
      Number.isFinite(payload.speed) &&
      (payload.finished === undefined || typeof payload.finished === 'boolean')
  );
}

/**
 * Ticket validation checks ownership, time bounds, and room scoping. The
 * signature is still verified one layer above in the public worker shell.
 */
export function isAuthTicketValid(ticket: AuthTicket | undefined, playerId: string, now: number, roomCode?: string): ticket is AuthTicket {
  return Boolean(
    ticket &&
      ticket.playerId === playerId &&
      Number.isFinite(ticket.issuedAt) &&
      Number.isFinite(ticket.expiresAt) &&
      ticket.issuedAt <= now &&
      ticket.expiresAt > now &&
      (!roomCode || !ticket.roomCode || ticket.roomCode === roomCode)
  );
}
