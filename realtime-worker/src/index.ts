import { DurableObject } from 'cloudflare:workers';
import { verifyCoordinatorBearerToken } from './auth';
import { RoomCoordinator } from './RoomCoordinator';
import type { CommandResult, RoomCommandEnvelope, RoomSnapshot } from './protocol';
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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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

    return jsonError('not found', 404);
  }
} satisfies ExportedHandler<Env>;

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
