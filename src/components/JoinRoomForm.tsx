'use client';

import { useState } from 'react';
import { createCommand } from '@/realtime/sessionReducer';
import type { PlayerSession } from '@/session/playerSession';

export function JoinRoomForm({
  player,
  disabled,
  onJoin
}: {
  player: PlayerSession | null;
  disabled?: boolean;
  onJoin(roomCode: string, command: ReturnType<typeof createCommand>): void;
}) {
  const [roomCode, setRoomCode] = useState('');

  return (
    <form
      className="race-panel action-panel stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (!player || !roomCode.trim()) return;
        onJoin(roomCode.trim().toUpperCase(), createCommand('room.join', player.playerId));
      }}
    >
      <span className="panel-kicker">加入比赛</span>
      <h2>输入房间码</h2>
      <label className="field">
        <span>房间码</span>
        <input className="input room-code-input" value={roomCode} maxLength={8} onChange={(event) => setRoomCode(event.target.value)} />
      </label>
      <button type="submit" className="secondary-action" disabled={!player || disabled || !roomCode.trim()}>
        加入房间
      </button>
    </form>
  );
}
