'use client';

import type { HallRoomSummary } from '@/server/rooms';

export function HallRoomList({ rooms, onJoin }: { rooms: HallRoomSummary[]; onJoin(code: string): void }) {
  if (rooms.length === 0) {
    return (
      <div className="race-panel empty-grid">
        <span className="panel-kicker">赛道空闲</span>
        <p className="muted">暂时没有等待中的房间。可以先创建一个房间，分享房间码给对手。</p>
      </div>
    );
  }

  return (
    <div className="race-panel stack">
      <div>
        <span className="panel-kicker">等待发车</span>
        <h2>房间列表</h2>
      </div>
      {rooms.map((room) => (
        <div key={room.code} className="room-list-item">
          <strong>{room.code}</strong>
          <span>{room.playerCount} 名车手</span>
          <span>{room.lapTarget} 圈</span>
          <button type="button" className="secondary-action" onClick={() => onJoin(room.code)}>
            加入
          </button>
        </div>
      ))}
    </div>
  );
}
