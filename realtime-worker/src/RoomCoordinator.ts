import {
  DEFAULT_LAP_TARGET,
  WAITING_ROOM_TTL_MS,
  commandError,
  isAuthTicketValid,
  isPlayerColor,
  validateLapTarget,
  type AuthTicket,
  type CommandResult,
  type CreateRoomPayload,
  type JoinRoomPayload,
  type RoomCommandEnvelope,
  type RoomPlayer,
  type RoomSnapshot,
  type RoomState
} from './protocol';
import type { RoomStorage } from './storage';

type Clock = () => number;
type RoomCodeGenerator = () => string;

export interface RoomCoordinatorOptions {
  now?: Clock;
  roomCodeGenerator?: RoomCodeGenerator;
}

/**
 * Pure coordinator core for Phase 1 room lifecycle rules. It owns room truth
 * only: creation, lobby membership, colors, readiness, start gate, expiration,
 * and snapshots. Racing physics and per-frame state remain browser-side.
 */
export class RoomCoordinator {
  private readonly now: Clock;
  private readonly roomCodeGenerator: RoomCodeGenerator;

  constructor(private readonly storage: RoomStorage, options: RoomCoordinatorOptions = {}) {
    this.now = options.now ?? Date.now;
    this.roomCodeGenerator = options.roomCodeGenerator ?? createRoomCode;
  }

  async execute(command: RoomCommandEnvelope): Promise<CommandResult> {
    const now = this.now();

    if (!isAuthTicketValid(command.authTicket as AuthTicket | undefined, command.playerId, now)) {
      const room = await this.storage.loadRoom();
      return commandError(command.commandId, room?.seq ?? 0, 'AUTH_TICKET_INVALID');
    }

    if (command.type === 'room.create') {
      return this.createRoom(command as RoomCommandEnvelope<CreateRoomPayload>, now);
    }

    const room = await this.storage.loadRoom();
    if (!room) {
      return commandError(command.commandId, 0, 'ROOM_NOT_FOUND');
    }

    if (command.type === 'sync.request') {
      return this.success(command.commandId, room);
    }

    if (room.status === 'closed') {
      return commandError(command.commandId, room.seq, 'ROOM_CLOSED');
    }

    if (this.isWaitingRoomExpired(room, now) && command.type !== 'room.closeExpired') {
      return commandError(command.commandId, room.seq, 'ROOM_EXPIRED');
    }

    switch (command.type) {
      case 'room.join':
        return this.joinRoom(command as RoomCommandEnvelope<JoinRoomPayload>, room, now);
      case 'room.setLapTarget':
        return this.setLapTarget(command, room);
      case 'room.chooseColor':
        return this.chooseColor(command, room, now);
      case 'room.ready':
        return this.setReady(command, room, now);
      case 'room.start':
        return this.startRoom(command, room, now);
      case 'room.closeExpired':
        return this.closeExpired(command, room, now);
      default:
        return this.success(command.commandId, room);
    }
  }

  async snapshot(): Promise<RoomSnapshot | null> {
    const room = await this.storage.loadRoom();
    return room ? { type: 'room.snapshot', seq: room.seq, room } : null;
  }

  private async createRoom(command: RoomCommandEnvelope<CreateRoomPayload>, now: number): Promise<CommandResult> {
    const timestamp = new Date(now).toISOString();
    const roomCode = normalizeRoomCode(command.payload.roomCode) ?? this.roomCodeGenerator();
    const host = createPlayer(command.playerId, command.payload.nickname, true, timestamp);
    const room: RoomState = {
      code: roomCode,
      hostPlayerId: command.playerId,
      status: 'waiting',
      lapTarget: DEFAULT_LAP_TARGET,
      trackMap: null,
      createdAt: timestamp,
      startedAt: null,
      finishedAt: null,
      closedAt: null,
      expiresAt: new Date(now + WAITING_ROOM_TTL_MS).toISOString(),
      closedReason: null,
      seq: 1,
      players: [host]
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
      existing.lastSeenAt = timestamp;
    } else {
      room.players.push(createPlayer(command.playerId, command.payload.nickname, false, timestamp));
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

    const player = this.findPlayer(room, command.playerId);
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

    const player = this.findPlayer(room, command.playerId);
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

    const player = this.findPlayer(room, command.playerId);
    if (!player) {
      return commandError(command.commandId, room.seq, 'PLAYER_NOT_IN_ROOM');
    }

    player.ready = (command.payload as { ready?: boolean }).ready ?? true;
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

    const everyoneReadyWithColor = room.players.length > 0 && room.players.every((player) => player.ready && player.color);
    if (!everyoneReadyWithColor) {
      return commandError(command.commandId, room.seq, 'NOT_ALL_PLAYERS_READY');
    }

    room.status = 'racing';
    room.startedAt = new Date(now).toISOString();
    return this.mutate(command.commandId, room);
  }

  private async closeExpired(command: RoomCommandEnvelope, room: RoomState, now: number): Promise<CommandResult> {
    if (room.status === 'closed') {
      return commandError(command.commandId, room.seq, 'ROOM_CLOSED');
    }

    if (room.status !== 'waiting') {
      return this.success(command.commandId, room);
    }

    if (!this.isWaitingRoomExpired(room, now)) {
      return this.success(command.commandId, room);
    }

    room.status = 'closed';
    room.closedAt = new Date(now).toISOString();
    room.closedReason = 'not_started_timeout';
    return this.mutate(command.commandId, room);
  }

  private findPlayer(room: RoomState, playerId: string): RoomPlayer | undefined {
    return room.players.find((player) => player.playerId === playerId);
  }

  private isWaitingRoomExpired(room: RoomState, now: number): boolean {
    return room.status === 'waiting' && Date.parse(room.expiresAt) <= now;
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
      room
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

function createRoomCode(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 36).toString(36).toUpperCase()).join('');
}

function normalizeRoomCode(roomCode: string | undefined): string | null {
  const normalized = roomCode?.trim().toUpperCase();
  return normalized && /^[A-Z0-9]{4,12}$/.test(normalized) ? normalized : null;
}
