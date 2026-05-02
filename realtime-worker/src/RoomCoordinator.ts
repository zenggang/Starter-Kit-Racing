import {
  DEFAULT_LAP_TARGET,
  FINISHED_ROOM_TTL_MS,
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

type Clock = () => number;
type RoomCodeGenerator = () => string;
type MatchIdGenerator = () => string;

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
    return room ? { type: 'room.snapshot', seq: room.seq, room: stripActiveMatch(room) } : null;
  }

  private async createRoom(command: RoomCommandEnvelope<CreateRoomPayload>, now: number): Promise<CommandResult> {
    const timestamp = new Date(now).toISOString();
    const roomCode = normalizeRoomCode(command.payload.roomCode) ?? this.roomCodeGenerator();
    const host = createPlayer(command.playerId, command.payload.nickname, true, timestamp);
    const room: RoomState = {
      id: crypto.randomUUID(),
      code: roomCode,
      hostPlayerId: command.playerId,
      status: 'waiting',
      lapTarget: DEFAULT_LAP_TARGET,
      trackMap: normalizeTrackMap(command.payload.trackMap),
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
    } else {
      room.players.push(createPlayer(command.playerId, command.payload.nickname, false, timestamp));
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

    if (room.players[playerIndex].isHost) {
      room.status = 'closed';
      room.closedAt = new Date(now).toISOString();
      room.closedReason = 'host_left';
      room.players[playerIndex].status = 'disconnected';
      room.players[playerIndex].lastSeenAt = room.closedAt;
      return this.mutate(command.commandId, room);
    }

    room.players.splice(playerIndex, 1);
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

    const eligiblePlayers = room.players.filter((player) => player.ready && player.color);
    if (eligiblePlayers.length === 0) {
      return commandError(command.commandId, room.seq, 'NOT_ALL_PLAYERS_READY');
    }

    const startedAt = new Date(now).toISOString();
    room.players = eligiblePlayers;
    room.status = 'racing';
    room.startedAt = startedAt;
    room.finishedAt = null;
    room.matchId = this.matchIdGenerator();
    room.activeMatch = createMatchState(room, startedAt);
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

    if (match.players.every((candidate) => candidate.finishedAt)) {
      const finishedAt = new Date(now).toISOString();
      match.phase = 'finished';
      match.finishedAt = finishedAt;
      match.winnerPlayerId = match.players[0]?.playerId ?? null;
      room.status = 'finished';
      room.finishedAt = finishedAt;
      room.expiresAt = new Date(now + FINISHED_ROOM_TTL_MS).toISOString();
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

function createMatchState(room: RoomState, startedAt: string): MatchState {
  return {
    id: room.matchId as string,
    roomCode: room.code,
    phase: 'live',
    lapTarget: room.lapTarget,
    trackMap: room.trackMap,
    startedAt,
    finishedAt: null,
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
  if (reportedTotalProgress + 0.05 < player.totalProgress) {
    return { ok: false, errorCode: 'MATCH_PROGRESS_REGRESSION' };
  }

  if (player.finishedAt) {
    return { ok: false, errorCode: 'MATCH_FINISH_DUPLICATE' };
  }

  const nextTotalProgress = Math.max(player.totalProgress, reportedTotalProgress);
  const nextCompletedLaps = payload.completedLaps > player.completedLaps ? payload.completedLaps : player.completedLaps;
  const nextLapProgress = payload.completedLaps > player.completedLaps ? payload.lapProgress : Math.max(player.lapProgress, payload.lapProgress);
  const nextCheckpoint = payload.completedLaps > player.completedLaps ? payload.checkpoint : Math.max(player.checkpoint, payload.checkpoint);
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

function stripActiveMatch(room: RoomState): RoomState {
  return {
    ...structuredClone(room),
    activeMatch: null
  };
}

function createRoomCode(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 36).toString(36).toUpperCase()).join('');
}

function normalizeRoomCode(roomCode: string | undefined): string | null {
  const normalized = roomCode?.trim().toUpperCase();
  return normalized && /^[A-Z0-9]{4,12}$/.test(normalized) ? normalized : null;
}

function normalizeTrackMap(trackMap: string | null | undefined): string | null {
  const normalized = trackMap?.trim();
  return normalized ? normalized : null;
}
