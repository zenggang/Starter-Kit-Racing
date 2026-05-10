import { Client, Room } from '@colyseus/core';
import { getMysqlPool } from '../db/mysql.js';
import { buildRealtimeEvent } from '../lib/realtimeBroadcast.js';
import { InMemoryRoomStorage } from '../lib/storage.js';
import { RoomCoordinator } from '../lib/RoomCoordinator.js';
import type { CommandResult, MatchState, RealtimeCommandType, RoomCommandEnvelope, RoomState } from '../lib/protocol.js';
import { syncCommandResultProjection, syncMatchProjection, syncRoomProjection } from '../services/roomProjectionService.js';
import { RaceState } from '../schema/RaceState.js';
import { registerRoomId, unregisterRoomId } from '../lib/inMemoryRoomIndex.js';

interface JoinOptions {
  playerId?: string;
  nickname?: string;
  roomCode?: string;
  trackId?: string | null;
  trackName?: string | null;
  trackMap?: string | null;
}

interface ClientAuth {
  playerId: string;
  nickname: string;
  issuedAt: number;
  expiresAt: number;
}

export class RaceRoom extends Room<RaceState> {
  maxClients = 4;
  private readonly storage = new InMemoryRoomStorage();
  private readonly coordinator = new RoomCoordinator(this.storage);

  async onCreate(options: JoinOptions): Promise<void> {
    console.log('[race-room] onCreate:start', {
      roomCode: options.roomCode ?? null,
      playerId: options.playerId ?? null,
      nickname: options.nickname ?? null
    });
    this.setState(new RaceState());
    this.autoDispose = true;

    const playerId = String(options.playerId ?? '').trim();
    const nickname = String(options.nickname ?? '').trim();
    if (!playerId || !nickname) {
      throw new Error('AUTH_TICKET_INVALID');
    }

    const authTicket = this.buildAuthTicket({
      playerId,
      nickname,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    });

    const created = await this.coordinator.execute({
      commandId: `room.create:${crypto.randomUUID()}`,
      type: 'room.create',
      playerId,
      authTicket,
      payload: {
        roomCode: options.roomCode,
        nickname,
        trackId: options.trackId ?? null,
        trackName: options.trackName ?? null,
        trackMap: options.trackMap ?? null
      }
    });
    console.log('[race-room] onCreate:coordinatorResolved', {
      ok: created.ok,
      roomCode: created.room?.code ?? null,
      errorCode: created.errorCode ?? null
    });

    if (!created.ok || !created.room) {
      throw new Error(created.errorCode ?? 'ROOM_NOT_FOUND');
    }

    this.roomId = created.room.code;
    this.state.roomCode = created.room.code;
    this.state.status = created.room.status;
    registerRoomId(this.roomId);
    await this.setMetadata({
      roomCode: created.room.code,
      status: created.room.status
    });
    /**
     * Room creation must acknowledge quickly. Projection writes only feed the
     * hall/read-model side and must never block the seat reservation response.
     */
    void this.syncProjectionInBackground('room.create', created);
    console.log('[race-room] onCreate:projectionQueued', {
      roomCode: created.room.code,
      status: created.room.status
    });

    this.onMessage('command', async (client, raw) => {
      const command = this.normalizeIncomingCommand(client, raw);
      console.log('[race-room] command:received', {
        roomCode: this.roomId,
        rawType: typeof (raw as { type?: unknown } | undefined)?.type === 'string' ? (raw as { type: string }).type : null,
        normalizedType: command?.type ?? null,
        playerId: command?.playerId ?? null
      });
      if (!command) {
        client.send('command.result', {
          type: 'command.result',
          seq: 0,
          ok: false,
          errorCode: 'AUTH_TICKET_INVALID'
        } satisfies CommandResult);
        return;
      }

      const result = await this.coordinator.execute(command);
      console.log('[race-room] command:coordinatorResolved', {
        roomCode: this.roomId,
        type: command.type,
        ok: result.ok,
        seq: result.seq,
        errorCode: result.errorCode ?? null
      });
      client.send('command.result', result);
      console.log('[race-room] command:responseSent', {
        roomCode: this.roomId,
        type: command.type,
        ok: result.ok,
        seq: result.seq
      });

      const event = buildRealtimeEvent(command, result);
      if (event) {
        this.broadcast(event.type, event, { except: client });
      }

      /**
       * Durable read-model updates happen after the realtime acknowledgement so
       * a slow MySQL write cannot freeze room controls, ready toggles, or room
       * creation in the browser.
       */
      void this.syncProjectionInBackground(command.type, result);
      void this.refreshRoomStatusInBackground(result.room);
    });
  }

  async onJoin(client: Client, options: JoinOptions): Promise<void> {
    console.log('[race-room] onJoin:start', {
      roomCode: this.roomId,
      playerId: options.playerId ?? null,
      nickname: options.nickname ?? null
    });
    const playerId = String(options.playerId ?? '').trim();
    const nickname = String(options.nickname ?? '').trim();
    if (!playerId || !nickname) {
      throw new Error('AUTH_TICKET_INVALID');
    }

    client.userData = {
      playerId,
      nickname,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    } satisfies ClientAuth;

    const existingRoom = await this.storage.loadRoom();
    const joinCommand: RoomCommandEnvelope =
      existingRoom?.activeMatch
        ? {
            commandId: `match.join:${crypto.randomUUID()}`,
            type: 'match.join',
            playerId,
            authTicket: this.buildAuthTicket(client.userData as ClientAuth, existingRoom.code),
            payload: {}
          }
        : {
            commandId: `room.join:${crypto.randomUUID()}`,
            type: 'room.join',
            playerId,
            authTicket: this.buildAuthTicket(client.userData as ClientAuth),
            payload: { nickname }
          };

    const result = await this.coordinator.execute(joinCommand);
    console.log('[race-room] onJoin:coordinatorResolved', {
      roomCode: this.roomId,
      type: joinCommand.type,
      ok: result.ok,
      seq: result.seq,
      errorCode: result.errorCode ?? null
    });

    if (!result.ok) {
      throw new Error(result.errorCode ?? 'ROOM_NOT_FOUND');
    }

    /**
     * Joining should prioritize getting the latest snapshot to the browser.
     * Projection lag is acceptable for a short period because the room truth is
     * already held in coordinator memory.
     */
    void this.syncProjectionInBackground(joinCommand.type, result);
    void this.refreshRoomStatusInBackground(result.room);
    await this.sendSnapshot(client, playerId);
    console.log('[race-room] onJoin:snapshotSent', {
      roomCode: this.roomId,
      playerId
    });
  }

  async onLeave(_client: Client): Promise<void> {
    // Internal page switches should not mutate room truth by accident.
    // Explicit leave actions are handled through `room.leave` / `match.leave`.
  }

  async onDispose(): Promise<void> {
    unregisterRoomId(this.roomId);
  }

  private normalizeIncomingCommand(client: Client, raw: unknown): RoomCommandEnvelope | null {
    const auth = client.userData as ClientAuth | undefined;
    if (!auth || !raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Partial<RoomCommandEnvelope> & { payload?: unknown };
    if (typeof candidate.type !== 'string') {
      return null;
    }

    return {
      commandId: typeof candidate.commandId === 'string' ? candidate.commandId : crypto.randomUUID(),
      type: candidate.type as RealtimeCommandType,
      playerId: auth.playerId,
      authTicket: this.buildAuthTicket(auth, this.roomId),
      payload: candidate.payload ?? {}
    };
  }

  private async sendSnapshot(client: Client, playerId: string): Promise<void> {
    const room = await this.storage.loadRoom();
    if (!room) {
      return;
    }

    const command: RoomCommandEnvelope =
      room.activeMatch
        ? {
            commandId: `match.sync:${crypto.randomUUID()}`,
            type: 'match.sync',
            playerId,
            authTicket: this.buildAuthTicket(client.userData as ClientAuth, room.code),
            payload: {}
          }
        : {
            commandId: `sync.request:${crypto.randomUUID()}`,
            type: 'sync.request',
            playerId,
            authTicket: this.buildAuthTicket(client.userData as ClientAuth, room.code),
            payload: {}
          };

    const result = await this.coordinator.execute(command);
    if (!result.ok || !result.room) {
      return;
    }

    if (result.match) {
      client.send('match.snapshot', {
        type: 'match.snapshot',
        seq: result.seq,
        room: result.room,
        match: result.match
      });
      return;
    }

    client.send('room.snapshot', {
      type: 'room.snapshot',
      seq: result.seq,
      room: result.room
    });
  }

  private buildAuthTicket(auth: ClientAuth, roomCode?: string) {
    return {
      playerId: auth.playerId,
      roomCode,
      issuedAt: auth.issuedAt,
      expiresAt: auth.expiresAt
    };
  }

  private async syncProjection(commandType: string, result: CommandResult): Promise<void> {
    await syncCommandResultProjection(getMysqlPool(), commandType, result);

    if (result.ok && result.room && result.match && (commandType === 'match.sync' || commandType === 'match.join')) {
      await syncMatchProjection(getMysqlPool(), result.room, result.match as MatchState);
    }
  }

  private async refreshRoomStatus(room: RoomState | undefined): Promise<void> {
    if (!room) return;
    this.state.roomCode = room.code;
    this.state.status = room.status;
    await this.setMetadata({
      roomCode: room.code,
      status: room.status
    });
    await syncRoomProjection(getMysqlPool(), room);
  }

  private async syncProjectionInBackground(commandType: string, result: CommandResult): Promise<void> {
    try {
      await this.syncProjection(commandType, result);
    } catch (error) {
      console.error('[race-room] projection-sync-failed', {
        roomCode: this.roomId,
        commandType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async refreshRoomStatusInBackground(room: RoomState | undefined): Promise<void> {
    try {
      await this.refreshRoomStatus(room);
    } catch (error) {
      console.error('[race-room] room-status-refresh-failed', {
        roomCode: this.roomId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
