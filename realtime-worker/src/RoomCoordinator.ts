import {
  DEFAULT_LAP_TARGET,
  FINISHED_ROOM_TTL_MS,
  MATCH_START_COUNTDOWN_MS,
  PLAYER_COLORS,
  WAITING_ROOM_TTL_MS,
  commandError,
  isAuthTicketValid,
  isPlayerColor,
  validateLapTarget,
  validateMatchProgressPayload,
  type AuthTicket,
  type CommandResult,
  type CreateRoomPayload,
  type JoinRoomPayload,
  type MatchPlayerState,
  type MatchProgressPayload,
  type MatchState,
  type RoomCommandEnvelope,
  type RoomPlayer,
  type RoomSnapshot,
  type RoomState
} from './protocol';
import type { RoomStorage } from './storage';
import { validateTrackMap } from '../../shared/trackMapValidation';

type Clock = () => number;
type RoomCodeGenerator = () => string;
type MatchIdGenerator = () => string;
const MATCH_FINISH_WINDOW_MS = 60 * 1000;

export interface RoomCoordinatorOptions {
  now?: Clock;
  roomCodeGenerator?: RoomCodeGenerator;
  matchIdGenerator?: MatchIdGenerator;
}

/**
 * Pure coordinator core for the room and match lifecycle. Lobby truth, live
 * race ordering, reconnect recovery, and result shaping all stay here so the
 * worker shell can add transport and projections without changing the rules.
 */
export class RoomCoordinator {
  private readonly now: Clock;
  private readonly roomCodeGenerator: RoomCodeGenerator;
  private readonly matchIdGenerator: MatchIdGenerator;

  constructor(private readonly storage: RoomStorage, options: RoomCoordinatorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.roomCodeGenerator = options.roomCodeGenerator ?? createRoomCode;
    this.matchIdGenerator = options.matchIdGenerator ?? (() => crypto.randomUUID());
  }

  async execute(command: RoomCommandEnvelope): Promise<CommandResult> {
    const now = this.now();

    if (command.type === 'room.create') {
      if (!isAuthTicketValid(command.authTicket as AuthTicket | undefined, command.playerId, now)) {
        return commandError(command.commandId, 0, 'AUTH_TICKET_INVALID');
      }

      return this.createRoom(command as RoomCommandEnvelope<CreateRoomPayload>, now);
    }

    const room = await this.storage.loadRoom();
    if (!room) {
      return commandError(command.commandId, 0, 'ROOM_NOT_FOUND');
    }

    if (!isAuthTicketValid(command.authTicket as AuthTicket | undefined, command.playerId, now, room.code)) {
      return commandError(command.commandId, room.seq, 'AUTH_TICKET_INVALID');
    }

    await this.syncLifecycleTransitions(room, now);

    if (command.type === 'sync.request') {
      return this.success(command.commandId, room);
    }

    if (command.type === 'match.sync') {
      return room.activeMatch ? this.success(command.commandId, room) : commandError(command.commandId, room.seq, 'MATCH_NOT_FOUND');
    }

    if (room.status === 'closed') {
      return commandError(command.commandId, room.seq, 'ROOM_CLOSED');
    }

    if (this.isRoomExpired(room, now) && command.type !== 'room.closeExpired') {
      return commandError(command.commandId, room.seq, 'ROOM_EXPIRED');
    }

    switch (command.type) {
      case 'room.join':
        return this.joinRoom(command as RoomCommandEnvelope<JoinRoomPayload>, room, now);
      case 'room.leave':
        return this.leaveRoom(command, room, now);
      case 'room.setLapTarget':
        return this.setLapTarget(command, room);
      case 'room.chooseColor':
        return this.chooseColor(command, room, now);
      case 'room.ready':
        return this.setReady(command, room, now);
      case 'room.start':
        return this.startRoom(command, room, now);
      case 'room.rematch':
        return this.rematchRoom(command, room, now);
      case 'room.closeExpired':
        return this.closeExpired(command, room, now);
      case 'match.join':
        return this.joinMatch(command, room, now);
      case 'match.leave':
        return this.leaveMatch(command, room, now);
      case 'match.progress':
        return this.progressMatch(command as RoomCommandEnvelope<MatchProgressPayload>, room, now);
      default:
        return this.success(command.commandId, room);
    }
  }

  async snapshot(): Promise<RoomSnapshot | null> {
    const room = await this.storage.loadRoom();
    if (room) {
      await this.syncLifecycleTransitions(room, this.now());
    }
    return room ? { type: 'room.snapshot', seq: room.seq, room: stripActiveMatch(room) } : null;
  }

  async advanceLifecycle(): Promise<CommandResult | null> {
    const room = await this.storage.loadRoom();
    if (!room) {
      return null;
    }

    const changed = await this.syncLifecycleTransitions(room, this.now());
    return changed ? this.success(undefined, room) : null;
  }

  private async createRoom(command: RoomCommandEnvelope<CreateRoomPayload>, now: number): Promise<CommandResult> {
    const timestamp = new Date(now).toISOString();
    const roomCode = normalizeRoomCode(command.payload.roomCode) ?? this.roomCodeGenerator();
    const track = normalizeTrackSelection(command.payload.trackId, command.payload.trackName, command.payload.trackMap);
    if (!track.ok) {
      return commandError(command.commandId, 0, track.errorCode);
    }

    const host = createPlayer(command.playerId, command.payload.nickname, true, timestamp);
    assignFirstAvailableColor(host, []);
    const room: RoomState = {
      id: crypto.randomUUID(),
      code: roomCode,
      hostPlayerId: command.playerId,
      status: 'waiting',
      lapTarget: DEFAULT_LAP_TARGET,
      trackId: track.trackId,
      trackName: track.trackName,
      trackMap: track.trackMap,
      createdAt: timestamp,
      startedAt: null,
      finishedAt: null,
      closedAt: null,
      expiresAt: new Date(now + WAITING_ROOM_TTL_MS).toISOString(),
      closedReason: null,
      matchId: null,
      seq: 1,
      players: [host],
      activeMatch: null
    };

    await this.storage.saveRoom(room);
    return this.success(command.commandId, room);
  }

  private async joinRoom(command: RoomCommandEnvelope<JoinRoomPayload>, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status !== 'waiting') {
      return commandError(command.commandId, room.seq, 'ROOM_NOT_WAITING');
    }

    const timestamp = new Date(now).toISOString();
    const existing = room.players.find((player) => player.playerId === command.playerId);

    if (existing) {
      existing.nickname = command.payload.nickname || existing.nickname;
      existing.status = existing.ready ? 'ready' : 'joined';
      existing.lastSeenAt = timestamp;
      assignFirstAvailableColor(existing, room.players);
    } else {
      if (room.players.length >= PLAYER_COLORS.length) {
        return commandError(command.commandId, room.seq, 'ROOM_FULL');
      }
      const incoming = createPlayer(command.playerId, command.payload.nickname, false, timestamp);
      assignFirstAvailableColor(incoming, room.players);
      room.players.push(incoming);
    }

    return this.mutate(command.commandId, room);
  }

  private async leaveRoom(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status !== 'waiting' && room.status !== 'finished') {
      return commandError(command.commandId, room.seq, 'ROOM_NOT_WAITING');
    }

    const playerIndex = room.players.findIndex((player) => player.playerId === command.playerId);
    if (playerIndex === -1) {
      return commandError(command.commandId, room.seq, 'PLAYER_NOT_IN_ROOM');
    }

    const timestamp = new Date(now).toISOString();
    const departing = room.players[playerIndex];
    room.players.splice(playerIndex, 1);

    /**
     * If the last racer leaves, the room obviously disappears. Product also
     * treats the host leaving as a hard room teardown for everyone else, so
     * occupied waiting/finished rooms close immediately instead of promoting a
     * new host and silently keeping guests stranded on the room page.
     */
    if (room.players.length === 0) {
      room.status = 'closed';
      room.closedAt = timestamp;
      room.closedReason = 'room_empty';
      return this.mutate(command.commandId, room);
    }

    if (departing.isHost) {
      room.status = 'closed';
      room.closedAt = timestamp;
      room.closedReason = 'host_left';
      room.players.forEach((player) => {
        player.isHost = false;
      });
    }

    return this.mutate(command.commandId, room);
  }

  private async setLapTarget(command: RoomCommandEnvelope, room: RoomState): Promise<CommandResult> {
    if (room.status !== 'waiting') {
      return commandError(command.commandId, room.seq, 'ROOM_NOT_WAITING');
    }

    const lapTarget = (command.payload as { lapTarget?: unknown }).lapTarget;
    if (!validateLapTarget(lapTarget)) {
      return commandError(command.commandId, room.seq, 'LAP_TARGET_INVALID');
    }

    const player = this.findRoomPlayer(room, command.playerId);
    if (!player) {
      return commandError(command.commandId, room.seq, 'PLAYER_NOT_IN_ROOM');
    }

    if (!player.isHost) {
      return commandError(command.commandId, room.seq, 'ONLY_HOST_CAN_START');
    }

    room.lapTarget = lapTarget;
    return this.mutate(command.commandId, room);
  }

  private async chooseColor(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status !== 'waiting') {
      return commandError(command.commandId, room.seq, 'ROOM_NOT_WAITING');
    }

    const color = (command.payload as { color?: unknown }).color;
    if (!isPlayerColor(color)) {
      return commandError(command.commandId, room.seq, 'COLOR_INVALID');
    }

    const player = this.findRoomPlayer(room, command.playerId);
    if (!player) {
      return commandError(command.commandId, room.seq, 'PLAYER_NOT_IN_ROOM');
    }

    const owner = room.players.find((candidate) => candidate.color === color && candidate.playerId !== command.playerId);
    if (owner) {
      return commandError(command.commandId, room.seq, 'COLOR_TAKEN');
    }

    player.color = color;
    player.lastSeenAt = new Date(now).toISOString();
    return this.mutate(command.commandId, room);
  }

  private async setReady(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status !== 'waiting') {
      return commandError(command.commandId, room.seq, 'ROOM_NOT_WAITING');
    }

    const player = this.findRoomPlayer(room, command.playerId);
    if (!player) {
      return commandError(command.commandId, room.seq, 'PLAYER_NOT_IN_ROOM');
    }

    player.ready = (command.payload as { ready?: boolean }).ready ?? true;
    player.status = player.ready ? 'ready' : 'joined';
    player.lastSeenAt = new Date(now).toISOString();
    return this.mutate(command.commandId, room);
  }

  private async startRoom(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status !== 'waiting') {
      return commandError(command.commandId, room.seq, 'ROOM_NOT_WAITING');
    }

    if (room.hostPlayerId !== command.playerId) {
      return commandError(command.commandId, room.seq, 'ONLY_HOST_CAN_START');
    }

    const host = this.findRoomPlayer(room, command.playerId);
    if (!host || !host.ready || !host.color) {
      return commandError(command.commandId, room.seq, 'NOT_ALL_PLAYERS_READY');
    }

    /**
     * Waiting-room semantics now require a unanimous ready check for every
     * racer currently occupying a seat. The host no longer gets the previous
     * "single-player path" shortcut once a guest has joined but stayed idle.
     */
    const everyPlayerReady = room.players.every((player) => player.ready && player.color);
    if (!everyPlayerReady) {
      return commandError(command.commandId, room.seq, 'NOT_ALL_PLAYERS_READY');
    }

    if (room.trackMap && !validateTrackMap(room.trackMap).ok) {
      return commandError(command.commandId, room.seq, 'TRACK_MAP_INVALID');
    }

    const startedAt = new Date(now).toISOString();
    const matchStartedAt = new Date(now + MATCH_START_COUNTDOWN_MS).toISOString();
    room.status = 'racing';
    room.startedAt = startedAt;
    room.finishedAt = null;
    room.matchId = this.matchIdGenerator();
    room.activeMatch = createMatchState(room, matchStartedAt);
    return this.mutate(command.commandId, room);
  }

  private async rematchRoom(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status !== 'finished') {
      return commandError(command.commandId, room.seq, 'ROOM_NOT_FINISHED');
    }

    if (room.hostPlayerId !== command.playerId) {
      return commandError(command.commandId, room.seq, 'ONLY_HOST_CAN_REMATCH');
    }

    const timestamp = new Date(now).toISOString();
    room.status = 'waiting';
    room.startedAt = null;
    room.finishedAt = null;
    room.closedAt = null;
    room.closedReason = null;
    room.expiresAt = new Date(now + WAITING_ROOM_TTL_MS).toISOString();
    room.matchId = null;
    room.activeMatch = null;

    room.players.forEach((player) => {
      player.ready = false;
      player.status = 'joined';
      player.lastSeenAt = timestamp;
    });

    return this.mutate(command.commandId, room);
  }

  private async closeExpired(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status === 'closed') {
      return commandError(command.commandId, room.seq, 'ROOM_CLOSED');
    }

    if (!this.isRoomExpired(room, now)) {
      return this.success(command.commandId, room);
    }

    room.status = 'closed';
    room.closedAt = new Date(now).toISOString();
    room.closedReason = room.finishedAt ? 'finished_timeout' : 'not_started_timeout';
    return this.mutate(command.commandId, room);
  }

  private async joinMatch(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    const match = room.activeMatch;
    if (!match) {
      return commandError(command.commandId, room.seq, 'MATCH_NOT_FOUND');
    }

    const player = this.findMatchPlayer(match, command.playerId);
    if (!player) {
      return commandError(command.commandId, room.seq, 'MATCH_PLAYER_NOT_REGISTERED');
    }

    player.presence = player.finishedAt ? 'finished' : 'connected';
    player.lastReportAt = new Date(now).toISOString();
    return this.mutate(command.commandId, room);
  }

  private async leaveMatch(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    const match = room.activeMatch;
    if (!match) {
      return commandError(command.commandId, room.seq, 'MATCH_NOT_FOUND');
    }

    const player = this.findMatchPlayer(match, command.playerId);
    if (!player) {
      return commandError(command.commandId, room.seq, 'MATCH_PLAYER_NOT_REGISTERED');
    }

    if (!player.finishedAt) {
      player.presence = 'disconnected';
    }
    player.lastReportAt = new Date(now).toISOString();
    return this.mutate(command.commandId, room);
  }

  private async progressMatch(command: RoomCommandEnvelope<MatchProgressPayload>, room: RoomState, now: number): Promise<CommandResult> {
    const match = room.activeMatch;
    if (!match) {
      return commandError(command.commandId, room.seq, 'MATCH_NOT_FOUND');
    }

    if (room.status !== 'racing' || match.phase !== 'live') {
      return commandError(command.commandId, room.seq, 'MATCH_NOT_ACTIVE');
    }

    if (!validateMatchProgressPayload(command.payload)) {
      return commandError(command.commandId, room.seq, 'MATCH_PROGRESS_INVALID');
    }

    const player = this.findMatchPlayer(match, command.playerId);
    if (!player) {
      return commandError(command.commandId, room.seq, 'MATCH_PLAYER_NOT_REGISTERED');
    }

    const nextTelemetry = normalizeProgress(player, command.payload, room.lapTarget, now);
    if (!nextTelemetry.ok) {
      return commandError(command.commandId, room.seq, nextTelemetry.errorCode);
    }

    Object.assign(player, nextTelemetry.player);
    player.presence = player.finishedAt ? 'finished' : 'connected';
    updateMatchRanks(match);

    if (player.finishedAt && !match.winnerPlayerId) {
      match.winnerPlayerId = player.playerId;
    }

    if (match.players.every((candidate) => candidate.finishedAt)) {
      finalizeFinishedMatch(room, now);
    } else if (player.finishedAt && !match.finishDeadlineAt) {
      match.finishDeadlineAt = new Date(now + MATCH_FINISH_WINDOW_MS).toISOString();
    }

    return this.mutate(command.commandId, room);
  }

  private findRoomPlayer(room: RoomState, playerId: string): RoomPlayer | undefined {
    return room.players.find((player) => player.playerId === playerId);
  }

  private findMatchPlayer(match: MatchState, playerId: string): MatchPlayerState | undefined {
    return match.players.find((player) => player.playerId === playerId);
  }

  private isRoomExpired(room: RoomState, now: number): boolean {
    if (room.status === 'closed') return false;
    if (room.status !== 'waiting' && room.status !== 'finished') return false;
    return Date.parse(room.expiresAt) <= now;
  }

  private async syncLifecycleTransitions(room: RoomState, now: number): Promise<boolean> {
    const countdownPromoted = promoteCountdownMatchIfReady(room, now);
    const finishDeadlineReached = finalizeMatchIfDeadlineReached(room, now);

    if (!countdownPromoted && !finishDeadlineReached) {
      return false;
    }

    room.seq += 1;
    await this.storage.saveRoom(room);
    return true;
  }

  private async mutate(commandId: string | undefined, room: RoomState): Promise<CommandResult> {
    room.seq += 1;
    await this.storage.saveRoom(room);
    return this.success(commandId, room);
  }

  private success(commandId: string | undefined, room: RoomState): CommandResult {
    return {
      type: 'command.result',
      commandId,
      ok: true,
      seq: room.seq,
      room: stripActiveMatch(room),
      match: room.activeMatch ? structuredClone(room.activeMatch) : undefined
    };
  }
}

function createPlayer(playerId: string, nickname: string, isHost: boolean, timestamp: string): RoomPlayer {
  return {
    playerId,
    nickname,
    color: null,
    status: 'joined',
    ready: false,
    isHost,
    joinedAt: timestamp,
    lastSeenAt: timestamp
  };
}

/**
 * Lobby colors now behave like seat reservations: when a racer enters the room
 * for the first time, or returns from an older snapshot that predates this
 * rule, the coordinator silently assigns the first currently unclaimed color.
 * Existing explicit choices are never overwritten.
 */
function assignFirstAvailableColor(player: RoomPlayer, players: RoomPlayer[]): void {
  if (player.color) {
    return;
  }

  const taken = new Set(
    players.filter((candidate) => candidate.playerId !== player.playerId).map((candidate) => candidate.color).filter((color): color is NonNullable<RoomPlayer['color']> => Boolean(color))
  );
  const nextColor = PLAYER_COLORS.find((color) => !taken.has(color)) ?? null;
  player.color = nextColor;
}

function createMatchState(room: RoomState, startedAt: string): MatchState {
  return {
    id: room.matchId as string,
    roomCode: room.code,
    phase: 'countdown',
    lapTarget: room.lapTarget,
    trackId: room.trackId,
    trackName: room.trackName,
    trackMap: room.trackMap,
    startedAt,
    finishedAt: null,
    finishDeadlineAt: null,
    winnerPlayerId: null,
    players: room.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      color: player.color as MatchPlayerState['color'],
      isHost: player.isHost,
      presence: 'pending',
      rank: 0,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      checkpoint: 0,
      completedLaps: 0,
      lapProgress: 0,
      totalProgress: 0,
      lastReportAt: null,
      finishedAt: null
    }))
  };
}

function promoteCountdownMatchIfReady(room: RoomState, now: number): boolean {
  const match = room.activeMatch;
  if (!match || room.status !== 'racing' || match.phase !== 'countdown') {
    return false;
  }

  if (Date.parse(match.startedAt) > now) {
    return false;
  }

  match.phase = 'live';
  return true;
}

function finalizeMatchIfDeadlineReached(room: RoomState, now: number): boolean {
  const match = room.activeMatch;
  if (!match || room.status !== 'racing' || match.phase !== 'live' || !match.finishDeadlineAt) {
    return false;
  }

  if (Date.parse(match.finishDeadlineAt) > now) {
    return false;
  }

  finalizeFinishedMatch(room, now);
  return true;
}

function normalizeProgress(
  player: MatchPlayerState,
  payload: MatchProgressPayload,
  lapTarget: number,
  now: number
): { ok: true; player: MatchPlayerState } | { ok: false; errorCode: NonNullable<CommandResult['errorCode']> } {
  if (payload.completedLaps > lapTarget || (payload.finished && payload.completedLaps < lapTarget)) {
    return { ok: false, errorCode: 'MATCH_PROGRESS_INVALID' };
  }

  const reportedTotalProgress = payload.completedLaps + payload.lapProgress;
  const sameLapProgressResetRecovery =
    payload.completedLaps === player.completedLaps &&
    player.lapProgress >= 0.95 &&
    payload.lapProgress <= 0.25 &&
    reportedTotalProgress + 0.05 < player.totalProgress;

  if (reportedTotalProgress + 0.05 < player.totalProgress && !sameLapProgressResetRecovery) {
    return { ok: false, errorCode: 'MATCH_PROGRESS_REGRESSION' };
  }

  if (player.finishedAt) {
    return { ok: false, errorCode: 'MATCH_FINISH_DUPLICATE' };
  }

  const nextTotalProgress = sameLapProgressResetRecovery ? reportedTotalProgress : Math.max(player.totalProgress, reportedTotalProgress);
  const nextCompletedLaps = payload.completedLaps > player.completedLaps ? payload.completedLaps : player.completedLaps;
  const nextLapProgress =
    payload.completedLaps > player.completedLaps || sameLapProgressResetRecovery
      ? payload.lapProgress
      : Math.max(player.lapProgress, payload.lapProgress);
  const nextCheckpoint =
    payload.completedLaps > player.completedLaps || sameLapProgressResetRecovery
      ? payload.checkpoint
      : Math.max(player.checkpoint, payload.checkpoint);
  const finishedAt = payload.finished && payload.completedLaps >= lapTarget ? new Date(now).toISOString() : null;

  return {
    ok: true,
    player: {
      ...player,
      position: {
        x: payload.position.x,
        y: payload.position.y,
        z: payload.position.z
      },
      heading: payload.heading,
      speed: payload.speed,
      checkpoint: nextCheckpoint,
      completedLaps: finishedAt ? lapTarget : nextCompletedLaps,
      lapProgress: finishedAt ? 1 : nextLapProgress,
      totalProgress: finishedAt ? lapTarget : nextTotalProgress,
      lastReportAt: new Date(now).toISOString(),
      finishedAt
    }
  };
}

function updateMatchRanks(match: MatchState): void {
  const sorted = [...match.players].sort((left, right) => {
    if (left.finishedAt && right.finishedAt) {
      return Date.parse(left.finishedAt) - Date.parse(right.finishedAt);
    }

    if (left.finishedAt) return -1;
    if (right.finishedAt) return 1;

    if (right.totalProgress !== left.totalProgress) {
      return right.totalProgress - left.totalProgress;
    }

    return left.playerId.localeCompare(right.playerId);
  });

  sorted.forEach((player, index) => {
    const target = match.players.find((candidate) => candidate.playerId === player.playerId);
    if (target) {
      target.rank = index + 1;
    }
  });
}

function finalizeFinishedMatch(room: RoomState, now: number): void {
  const match = room.activeMatch;
  if (!match) {
    return;
  }

  updateMatchRanks(match);

  const finishedAt = new Date(now).toISOString();
  match.phase = 'finished';
  match.finishedAt = finishedAt;
  match.winnerPlayerId = match.players[0]?.playerId ?? null;
  room.status = 'finished';
  room.finishedAt = finishedAt;
  room.expiresAt = new Date(now + FINISHED_ROOM_TTL_MS).toISOString();
}

function stripActiveMatch(room: RoomState): RoomState {
  return {
    ...structuredClone(room),
    activeMatch: null
  };
}

function createRoomCode(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10).toString()).join('');
}

function normalizeRoomCode(roomCode: string | undefined): string | null {
  const normalized = roomCode?.trim();
  return normalized && /^\d{4}$/.test(normalized) ? normalized : null;
}

function normalizeTrackSelection(
  trackId: string | null | undefined,
  trackName: string | null | undefined,
  trackMap: string | null | undefined
): { ok: true; trackId: string | null; trackName: string | null; trackMap: string | null } | { ok: false; errorCode: NonNullable<CommandResult['errorCode']> } {
  const normalized = trackMap?.trim();
  if (!normalized) {
    return {
      ok: true,
      trackId: null,
      trackName: null,
      trackMap: null
    };
  }

  const validation = validateTrackMap(normalized);
  if (!validation.ok) {
    return { ok: false, errorCode: validation.errors[0] ?? 'TRACK_MAP_INVALID' };
  }

  return {
    ok: true,
    trackId: normalizeTrackIdentity(trackId),
    trackName: normalizeTrackName(trackName),
    trackMap: validation.normalizedTrackMap
  };
}

function normalizeTrackIdentity(trackId: string | null | undefined): string | null {
  const normalized = trackId?.trim();
  return normalized ? normalized : null;
}

function normalizeTrackName(trackName: string | null | undefined): string | null {
  const normalized = trackName?.trim();
  return normalized ? normalized.slice(0, 40) : null;
}
