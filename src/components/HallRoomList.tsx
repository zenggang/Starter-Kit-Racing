'use client';

import React from 'react';
import type { HallRoomSummary } from '@/server/rooms';

export function HallRoomList({ rooms, onJoin }: { rooms: HallRoomSummary[]; onJoin(code: string): void }) {
  if (rooms.length === 0) {
    return (
      <div className="console-room-list empty-grid">
        <div className="console-section-head">
          <span className="panel-kicker">候场列表</span>
          <strong className="console-block-title">暂无等待中的房间</strong>
        </div>
        <p className="muted">直接创建房间，分享 4 位数字房间码即可开始。</p>
      </div>
    );
  }

  return (
    <div className="console-room-list stack">
      <div className="console-section-head">
        <span className="panel-kicker">等待发车</span>
        <strong className="console-block-title">候场房间</strong>
      </div>
      {rooms.map((room) => (
        <div key={room.code} className="room-list-item">
          <strong>{room.code}</strong>
          <span>{room.playerCount} 名车手</span>
          <span>{room.lapTarget} 圈</span>
          <span>{room.trackName ?? '默认赛道'}</span>
          <button type="button" className="secondary-action" onClick={() => onJoin(room.code)}>
            加入
          </button>
        </div>
      ))}
    </div>
  );
}
