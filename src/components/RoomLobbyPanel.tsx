'use client';

import Link from 'next/link';
import { ColorPicker } from './ColorPicker';
import { LapTargetControl } from './LapTargetControl';
import type { PlayerColor, RoomState } from '@/realtime/protocol';
import { createCommand } from '@/realtime/sessionReducer';
import type { PlayerSession } from '@/session/playerSession';

export function RoomLobbyPanel({
  room,
  player,
  disabled,
  onCommand
}: {
  room: RoomState | null;
  player: PlayerSession | null;
  disabled?: boolean;
  onCommand(command: ReturnType<typeof createCommand>): void;
}) {
  const current = room?.players.find((candidate) => candidate.playerId === player?.playerId) ?? null;
  const takenColors = room?.players.map((candidate) => candidate.color).filter((color): color is PlayerColor => Boolean(color)) ?? [];
  const isHost = current?.isHost ?? false;

  if (!room || !player) {
    return <p className="muted">Connecting to room snapshot...</p>;
  }

  return (
    <div className="surface stack">
      <div>
        <h2>Room {room.code}</h2>
        <p className="muted">Status: {room.status}</p>
      </div>

      <section className="stack">
        <h3>Players</h3>
        {room.players.map((member) => (
          <div key={member.playerId} className="row row-wrap">
            <strong>{member.nickname}</strong>
            <span className="muted">{member.isHost ? 'host' : 'driver'}</span>
            <span className="muted">{member.color ?? 'no color'}</span>
            <span className="muted">{member.ready ? 'ready' : 'not ready'}</span>
          </div>
        ))}
      </section>

      <section className="stack">
        <h3>Lap Target</h3>
        <LapTargetControl
          value={room.lapTarget}
          disabled={!isHost || disabled}
          onChange={(lapTarget) => onCommand(createCommand('room.setLapTarget', player.playerId, { lapTarget }))}
        />
      </section>

      <section className="stack">
        <h3>Color</h3>
        <ColorPicker
          selected={current?.color ?? null}
          taken={takenColors}
          disabled={disabled}
          onSelect={(color) => onCommand(createCommand('room.chooseColor', player.playerId, { color }))}
        />
      </section>

      <div className="row row-wrap">
        <button type="button" disabled={disabled} onClick={() => onCommand(createCommand('room.ready', player.playerId))}>
          Ready
        </button>
        {isHost ? (
          <button type="button" disabled={disabled} onClick={() => onCommand(createCommand('room.start', player.playerId))}>
            Start
          </button>
        ) : null}
        {room.status === 'racing' ? (
          <Link href={`/race/${room.code}`}>
            <button type="button">Enter Race</button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
