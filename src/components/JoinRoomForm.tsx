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
      className="console-action-card stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (!player || roomCode.trim().length !== 4) return;
        onJoin(roomCode.trim(), createCommand('room.join', player.playerId));
      }}
    >
      <div className="console-section-head">
        <span className="panel-kicker">加入比赛</span>
        <strong className="console-block-title">输入房间码</strong>
      </div>
      <label className="field">
        <span>房间码</span>
        <input
          className="input room-code-input"
          value={roomCode}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="1234"
          onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </label>
      <button type="submit" className="secondary-action console-button" disabled={!player || disabled || roomCode.trim().length !== 4}>
        加入房间
      </button>
    </form>
  );
}
