export const ROOM_STATUSES = ['waiting', 'racing', 'finished', 'closed'] as const;
export const PLAYER_STATUSES = ['joined', 'ready', 'disconnected'] as const;
export const MATCH_PHASES = ['live', 'finished', 'aborted'] as const;
export const MATCH_PRESENCE = ['pending', 'connected', 'disconnected', 'finished'] as const;
export const TRANSPORT_MODES = ['socket', 'bridge'] as const;
export const PLAYER_COLORS = ['yellow', 'green', 'purple', 'red'] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];
export type MatchPhase = (typeof MATCH_PHASES)[number];
export type MatchPresence = (typeof MATCH_PRESENCE)[number];
export type TransportMode = (typeof TRANSPORT_MODES)[number];
export type PlayerColor = (typeof PLAYER_COLORS)[number];

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
  | 'COORDINATOR_NOT_READY'
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
  | 'MATCH_TICKET_ROOM_MISMATCH';

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
export type RealtimeMessageType = 'room.snapshot' | 'room.event' | 'match.snapshot' | 'match.event' | 'command.result';

export interface RoomPlayer {
  playerId: string;
  nickname: string;
  color: PlayerColor | null;
  status: PlayerStatus;
  ready: boolean;
  isHost: boolean;
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

/**
 * Match player state is the coordinator-shaped race truth that powers the HUD,
 * minimap, leaderboard, result page, reconnect recovery, and bridge refresh.
 * The browser may calculate telemetry locally, but once submitted the
 * coordinator becomes the single source of truth for ordering and finish state.
 */
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
  trackMap: string | null;
  startedAt: string;
  finishedAt: string | null;
  finishDeadlineAt?: string | null;
  winnerPlayerId: string | null;
  players: MatchPlayerState[];
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

export interface CommandResult {
  type: 'command.result';
  seq: number;
  commandId?: string;
  ok: boolean;
  errorCode?: RacingErrorCode;
  room?: RoomState;
  match?: MatchState;
}

export type RealtimeMessage = RoomSnapshot | RoomEvent | MatchSnapshot | MatchEvent | CommandResult;

/**
 * Room state remains the lobby and lifecycle envelope. Match state lives beside
 * it instead of being flattened into `players[]`, which keeps waiting-room UI,
 * result UI, and race HUD responsibilities separate and easier to evolve.
 */
export interface RoomState {
  id: string;
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
  matchId: string | null;
  players: RoomPlayer[];
}

export interface MatchProgressPayload {
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
}

export interface RoomCommandEnvelope<TPayload = unknown> {
  commandId: string;
  type: RealtimeCommandType;
  playerId: string;
  nickname?: string;
  payload?: TPayload;
}

/**
 * Validates the shared lap target contract. The coordinator remains the final
 * authority, but client forms and API routes use the same helper so the browser
 * fails fast with the same machine-readable error code as the worker.
 */
export function validateLapTarget(value: unknown): { ok: true; value: number } | { ok: false; errorCode: 'LAP_TARGET_INVALID' } {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1 || value > 10) {
    return { ok: false, errorCode: 'LAP_TARGET_INVALID' };
  }

  return { ok: true, value };
}

/**
 * Restricts player color selection to the four GLB vehicle variants that are
 * already present in the repository so room and race state never drift.
 */
export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === 'string' && (PLAYER_COLORS as readonly string[]).includes(value);
}

/**
 * Ensures browser-side telemetry stays inside the coordinator protocol's
 * accepted bounds before it is sent over bridge or socket transport.
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
