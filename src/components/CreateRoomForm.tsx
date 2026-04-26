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
    <div className="surface stack">
      <h2>Create Room</h2>
      <button type="button" disabled={!player || disabled} onClick={() => player && onCreate(createCommand('room.create', player.playerId))}>
        Create Room
      </button>
    </div>
  );
}
