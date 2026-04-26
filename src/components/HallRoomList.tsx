'use client';

import type { HallRoomSummary } from '@/server/rooms';

export function HallRoomList({ rooms, onJoin }: { rooms: HallRoomSummary[]; onJoin(code: string): void }) {
  if (rooms.length === 0) {
    return (
      <div className="surface">
        <p className="muted">No waiting rooms are available.</p>
      </div>
    );
  }

  return (
    <div className="surface stack">
      <h2>Waiting Rooms</h2>
      {rooms.map((room) => (
        <div key={room.code} className="row row-wrap">
          <strong>{room.code}</strong>
          <span className="muted">{room.playerCount} players</span>
          <span className="muted">{room.lapTarget} laps</span>
          <button type="button" onClick={() => onJoin(room.code)}>
            Join
          </button>
        </div>
      ))}
    </div>
  );
}
