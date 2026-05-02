import { DurableObject } from 'cloudflare:workers';
import { verifyCoordinatorBearerToken, type VerifiedCoordinatorTicket } from './auth';
import { RoomCoordinator } from './RoomCoordinator';
import type { CommandResult, MatchEvent, RealtimeEvent, RoomCommandEnvelope, RoomEvent, RoomSnapshot } from './protocol';
import { createReadModelWriter, type ReadModelWriter } from './readModelWriter';
import { DurableObjectRoomStorage } from './storage';

export interface Env {
  ROOM_COORDINATOR: DurableObjectNamespace<RoomCoordinatorDurableObject>;
  COORDINATOR_SHARED_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

/**
 * Durable Object shell around the pure coordinator. Cloudflare owns routing,
 * RPC, and storage durability; the RoomCoordinator core owns Phase 1 room
 * lifecycle semantics and remains unit-testable outside the worker runtime.
 */
export class RoomCoordinatorDurableObject extends DurableObject<Env> {
  private readonly coordinator: RoomCoordinator;
  private readonly readModelWriter: ReadModelWriter;
  private readonly workerEnv: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.workerEnv = env;
    this.coordinator = new RoomCoordinator(new DurableObjectRoomStorage(ctx.storage));
    this.readModelWriter = createReadModelWriter(env);
  }

  async execute(command: RoomCommandEnvelope): Promise<CommandResult> {
    const result = await this.coordinator.execute(command);
    await this.syncReadModels(command, result);
    return result;
  }

  async snapshot(): Promise<RoomSnapshot | null> {
    return this.coordinator.snapshot();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const socketMatch = url.pathname.match(/^\/rooms\/(\d{4})\/socket$/);

    if (!socketMatch || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return jsonError('not found', 404);
    }

    const roomCode = normalizeWorkerRoomCode(socketMatch[1]);
    const ticket = await verifyCoordinatorBearerToken(request, this.workerEnv.COORDINATOR_SHARED_SECRET);

    if (!roomCode || !ticket || (ticket.roomCode && ticket.roomCode !== roomCode)) {
      return authError();
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(ticket);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const ticket = socket.deserializeAttachment() as VerifiedCoordinatorTicket | null;
    if (!ticket) {
      socket.close(4401, 'AUTH_TICKET_INVALID');
      return;
    }

    let rawCommand: unknown;
    try {
      const rawMessage = typeof message === 'string' ? message : new TextDecoder().decode(message);
      rawCommand = JSON.parse(rawMessage);
    } catch {
      socket.close(4400, 'INVALID_COMMAND');
      return;
    }

    const command = injectSocketCommand(rawCommand, ticket);
    if (!command) {
      socket.close(4400, 'INVALID_COMMAND');
      return;
    }

    const result = await this.execute(command);
    socket.send(JSON.stringify(result));
    this.broadcastRealtimeEvent(socket, command, result);
  }

  private async syncReadModels(command: RoomCommandEnvelope, result: CommandResult): Promise<void> {
    if (!result.ok || !result.room) return;

    if (command.type.startsWith('room.')) {
      await this.readModelWriter.syncRoom(result.room);
    }

    if (command.type === 'room.start' && result.match) {
      await this.readModelWriter.syncMatch(result.room, result.match);
      return;
    }

    if (command.type === 'match.progress' && result.match && (result.match.phase === 'finished' || result.match.phase === 'aborted')) {
      await this.readModelWriter.syncRoom(result.room);
      await this.readModelWriter.syncMatch(result.room, result.match);
    }
  }

  private broadcastRealtimeEvent(socket: WebSocket, command: RoomCommandEnvelope, result: CommandResult): void {
    const event = buildRealtimeEvent(command, result);
    if (!event) {
      return;
    }

    const payload = JSON.stringify(event);
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === socket) {
        continue;
      }

      try {
        peer.send(payload);
      } catch {
        // Ignore stale peers; DO hibernation cleans them up after close.
      }
    }
  }
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/rooms') {
      if (!(await verifyCoordinatorBearerToken(request, env.COORDINATOR_SHARED_SECRET))) {
        return authError();
      }

      const command = await request.json<RoomCommandEnvelope>();
      if (command.type !== 'room.create') {
        return jsonError('room.create is required for POST /rooms', 400);
      }

      const roomCode = normalizeWorkerRoomCode((command.payload as { roomCode?: string }).roomCode) ?? createWorkerRoomCode();
      const stub = env.ROOM_COORDINATOR.getByName(roomCode);
      const result = await stub.execute({
        ...command,
        payload: {
          ...(command.payload as Record<string, unknown>),
          roomCode
        }
      });

      return Response.json(result, { headers: JSON_HEADERS });
    }

    const commandMatch = url.pathname.match(/^\/rooms\/([A-Za-z0-9-]+)\/commands$/);
    if (request.method === 'POST' && commandMatch) {
      if (!(await verifyCoordinatorBearerToken(request, env.COORDINATOR_SHARED_SECRET))) {
        return authError();
      }

      const roomCode = normalizeWorkerRoomCode(commandMatch[1]);
      if (!roomCode) {
        return jsonError('invalid room code', 400);
      }

      const command = await request.json<RoomCommandEnvelope>();
      const stub = env.ROOM_COORDINATOR.getByName(roomCode);
      const result = await stub.execute(command);
      return Response.json(result, { headers: JSON_HEADERS });
    }

    const socketMatch = url.pathname.match(/^\/rooms\/(\d{4})\/socket$/);
    if (request.method === 'GET' && socketMatch && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const roomCode = normalizeWorkerRoomCode(socketMatch[1]);
      if (!roomCode) {
        return jsonError('invalid room code', 400);
      }

      const token = url.searchParams.get('token');
      const headers = new Headers(request.headers);
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }

      const stub = env.ROOM_COORDINATOR.getByName(roomCode);
      return stub.fetch(new Request(request, { headers }));
    }

    return jsonError('not found', 404);
  }
} satisfies ExportedHandler<Env>;

function injectSocketCommand(rawCommand: unknown, ticket: VerifiedCoordinatorTicket): RoomCommandEnvelope | null {
  if (!rawCommand || typeof rawCommand !== 'object') {
    return null;
  }

  const command = rawCommand as Partial<RoomCommandEnvelope> & { payload?: unknown };
  if (typeof command.type !== 'string' || !isRealtimeCommandType(command.type)) {
    return null;
  }

  const payload = command.payload && typeof command.payload === 'object' ? { ...(command.payload as Record<string, unknown>) } : {};

  if ((command.type === 'room.create' || command.type === 'room.join') && !payload.nickname) {
    payload.nickname = ticket.nickname;
  }

  return {
    commandId: typeof command.commandId === 'string' ? command.commandId : crypto.randomUUID(),
    type: command.type,
    playerId: ticket.playerId,
    authTicket: {
      playerId: ticket.playerId,
      roomCode: ticket.roomCode,
      issuedAt: ticket.issuedAt,
      expiresAt: ticket.expiresAt
    },
    payload
  };
}

function buildRealtimeEvent(command: RoomCommandEnvelope, result: CommandResult): RealtimeEvent | null {
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

  if (command.type === 'match.sync' && result.match?.phase === 'finished') {
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

function authError(): Response {
  const body: CommandResult = {
    type: 'command.result',
    ok: false,
    seq: 0,
    errorCode: 'AUTH_TICKET_INVALID'
  };

  return Response.json(body, { status: 401, headers: JSON_HEADERS });
}

function jsonError(message: string, status: number): Response {
  const body: CommandResult = {
    type: 'command.result',
    ok: false,
    seq: 0,
    errorCode: 'ROOM_NOT_FOUND'
  };

  return Response.json({ ...body, message }, { status, headers: JSON_HEADERS });
}

function createWorkerRoomCode(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10).toString()).join('');
}

function normalizeWorkerRoomCode(roomCode: string | undefined): string | null {
  const normalized = roomCode?.trim();
  return normalized && /^\d{4}$/.test(normalized) ? normalized : null;
}

function isRealtimeCommandType(value: string): value is RoomCommandEnvelope['type'] {
  return (
    value === 'room.create' ||
    value === 'room.join' ||
    value === 'room.leave' ||
    value === 'room.setLapTarget' ||
    value === 'room.chooseColor' ||
    value === 'room.ready' ||
    value === 'room.start' ||
    value === 'room.rematch' ||
    value === 'room.closeExpired' ||
    value === 'sync.request' ||
    value === 'match.join' ||
    value === 'match.leave' ||
    value === 'match.progress' ||
    value === 'match.sync'
  );
}
