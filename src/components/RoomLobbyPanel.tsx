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
  const canStart = Boolean(isHost && current?.ready && current?.color);

  if (!room || !player) {
    return <p className="loading-copy">正在连接房间数据...</p>;
  }

  return (
    <div className="race-panel lobby-panel stack">
      <div className="lobby-topline">
        <div>
          <span className="panel-kicker">发车区</span>
          <h2>{room.code}</h2>
        </div>
        <span className="status-pill">{room.status === 'waiting' ? '等待中' : '比赛中'}</span>
      </div>

      <section className="driver-grid">
        {room.players.map((member) => (
          <div key={member.playerId} className={`driver-card driver-${member.color ?? 'none'}`}>
            <span className="driver-role">{member.isHost ? '房主' : '车手'}</span>
            <strong>{member.nickname}</strong>
            <span>{member.color ? '已选赛车' : '未选赛车'}</span>
            <span>{member.ready ? '已准备' : '待准备'}</span>
          </div>
        ))}
      </section>

      <section className="tuning-panel">
        <div>
          <span className="panel-kicker">比赛圈数</span>
          <p className="muted">{isHost ? '房主可以调整圈数' : '等待房主调整圈数'}</p>
        </div>
        <LapTargetControl
          value={room.lapTarget}
          disabled={!isHost || disabled}
          onChange={(lapTarget) => onCommand(createCommand('room.setLapTarget', player.playerId, { lapTarget }))}
        />
      </section>

      <section className="tuning-panel tuning-panel-column">
        <div>
          <span className="panel-kicker">选择赛车</span>
          <p className="muted">每辆车只能被一名车手选择。</p>
        </div>
        <ColorPicker
          selected={current?.color ?? null}
          taken={takenColors}
          disabled={disabled}
          onSelect={(color) => onCommand(createCommand('room.chooseColor', player.playerId, { color }))}
        />
      </section>

      <div className="race-actions">
        <button type="button" className="secondary-action" disabled={disabled} onClick={() => onCommand(createCommand('room.ready', player.playerId))}>
          准备
        </button>
        {isHost ? (
          <button type="button" className="primary-action" disabled={disabled || !canStart} onClick={() => onCommand(createCommand('room.start', player.playerId))}>
            发车
          </button>
        ) : null}
        {room.status === 'racing' ? (
          <Link href={`/race/${room.code}`}>
            <button type="button" className="primary-action">
              进入赛道
            </button>
          </Link>
        ) : null}
      </div>
      <p className="muted start-hint">
        {room.players.length === 1
          ? '单人在线模式下，房主选车并准备后即可发车。'
          : '房主当前可以单人发车；其他已选车且已准备的车手会一起进入比赛。'}
      </p>
    </div>
  );
}
