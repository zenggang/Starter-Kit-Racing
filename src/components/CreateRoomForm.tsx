'use client';

import React from 'react';
import { createCommand } from '@/realtime/sessionReducer';
import type { PlayerSession } from '@/session/playerSession';

export function CreateRoomForm({
  player,
  disabled,
  onCreate
}: {
  player: PlayerSession | null;
  disabled?: boolean;
  onCreate(command: ReturnType<typeof createCommand>): void;
}) {
  return (
    <div className="console-action-card stack">
      <div className="console-section-head">
        <span className="panel-kicker">新比赛</span>
        <strong className="console-block-title">创建房间</strong>
      </div>
      <p className="muted">立即生成 4 位数字房间码。</p>
      <button type="button" className="primary-action console-button" disabled={!player || disabled} onClick={() => player && onCreate(createCommand('room.create', player.playerId))}>
        创建房间
      </button>
    </div>
  );
}
