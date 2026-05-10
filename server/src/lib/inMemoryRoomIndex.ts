const activeRooms = new Set<string>();

export function registerRoomId(roomId: string): void {
  activeRooms.add(roomId);
}

export function unregisterRoomId(roomId: string): void {
  activeRooms.delete(roomId);
}

export function listActiveRoomIds(): string[] {
  return [...activeRooms];
}
