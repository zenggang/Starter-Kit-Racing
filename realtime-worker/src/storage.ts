import type { RoomState } from './protocol';

const ROOM_STATE_KEY = 'room-state';

export interface RoomStorage {
  loadRoom(): Promise<RoomState | null>;
  saveRoom(room: RoomState): Promise<void>;
  deleteRoom(): Promise<void>;
}

/**
 * Small storage adapter used by unit tests. It intentionally clones values at
 * the boundary so tests exercise persistence-style reads instead of mutating
 * the coordinator's internal object references.
 */
export class InMemoryRoomStorage implements RoomStorage {
  private room: RoomState | null = null;

  async loadRoom(): Promise<RoomState | null> {
    return this.room ? structuredClone(this.room) : null;
  }

  async saveRoom(room: RoomState): Promise<void> {
    this.room = structuredClone(room);
  }

  async deleteRoom(): Promise<void> {
    this.room = null;
  }
}

/**
 * Durable Object storage adapter. The coordinator core does not depend on
 * Cloudflare globals, which keeps lifecycle rules testable without a worker
 * runtime while preserving the same state boundary in production.
 */
export class DurableObjectRoomStorage implements RoomStorage {
  constructor(private readonly storage: DurableObjectStorage) {}

  async loadRoom(): Promise<RoomState | null> {
    return (await this.storage.get<RoomState>(ROOM_STATE_KEY)) ?? null;
  }

  async saveRoom(room: RoomState): Promise<void> {
    await this.storage.put(ROOM_STATE_KEY, room);
  }

  async deleteRoom(): Promise<void> {
    await this.storage.delete(ROOM_STATE_KEY);
  }
}
