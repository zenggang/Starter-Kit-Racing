import type { RoomState } from './protocol.js';

export interface RoomStorage {
  loadRoom(): Promise<RoomState | null>;
  saveRoom(room: RoomState): Promise<void>;
  deleteRoom(): Promise<void>;
}

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
