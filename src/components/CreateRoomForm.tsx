'use client';

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
    <div className="race-panel action-panel stack">
      <span className="panel-kicker">新比赛</span>
      <h2>创建房间</h2>
      <p className="muted">生成房间码，邀请另一名车手进维修区后再发车。</p>
      <button type="button" className="primary-action" disabled={!player || disabled} onClick={() => player && onCreate(createCommand('room.create', player.playerId))}>
        创建房间
      </button>
    </div>
  );
}
