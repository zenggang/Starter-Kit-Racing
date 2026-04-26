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
      className="surface stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (!player || !roomCode.trim()) return;
        onJoin(roomCode.trim().toUpperCase(), createCommand('room.join', player.playerId));
      }}
    >
      <h2>Join Room</h2>
      <label className="field">
        <span>Room code</span>
        <input className="input" value={roomCode} maxLength={8} onChange={(event) => setRoomCode(event.target.value)} />
      </label>
      <button type="submit" disabled={!player || disabled || !roomCode.trim()}>
        Join
      </button>
    </form>
  );
}
