'use client';

import React from 'react';
import Link from 'next/link';
import { ColorPicker } from './ColorPicker';
import { LapTargetControl } from './LapTargetControl';
import { createLobbySeatSlots, getRosterDensity } from './rosterLayout';
import type { PlayerColor, RoomState } from '@/realtime/protocol';
import { createCommand } from '@/realtime/sessionReducer';
import type { PlayerSession } from '@/session/playerSession';

export function RoomLobbyPanel({
  room,
  player,
  roomCode,
  connectionState,
  disabled,
  onCommand,
  onLeave
}: {
  room: RoomState | null;
  player: PlayerSession | null;
  roomCode: string;
  connectionState: 'idle' | 'connecting' | 'connected' | 'error';
  disabled?: boolean;
  onCommand(command: ReturnType<typeof createCommand>): void;
  onLeave(): void;
}) {
  const current = room?.players.find((candidate) => candidate.playerId === player?.playerId) ?? null;
  const takenColors = room?.players.map((candidate) => candidate.color).filter((color): color is PlayerColor => Boolean(color)) ?? [];
  const isHost = current?.isHost ?? false;
  const canStart = Boolean(isHost && current?.ready && current?.color);
  const seatSlots = room ? createLobbySeatSlots(room.players) : [];
  const rosterDensity = getRosterDensity(room?.players.length ?? 0, { reserveCapacity: true });

  if (!room || !player) {
    return <p className="loading-copy">正在连接房间数据...</p>;
  }

  return (
    <div className="race-panel lobby-console stack">
      <div className="console-topline">
        <div className="console-title-group">
          <span className="panel-kicker">发车格</span>
          <strong className="console-screen-title">
            房间 <span className="room-code-head">{roomCode}</span>
          </strong>
          <p className="muted">连接状态：{connectionState === 'connected' ? '已连接' : '连接中'}</p>
        </div>
        <span className="status-pill">{room.status === 'waiting' ? '等待中' : '比赛中'}</span>
      </div>

      <div className="room-console-grid">
        <section className="console-section stack">
          <div className="console-section-head">
            <span className="panel-kicker">车手席</span>
            <strong className="console-block-title">已入场车手</strong>
          </div>
          <section className="driver-grid room-driver-grid" data-roster-density={rosterDensity}>
            {seatSlots.map((member, index) =>
              member ? (
                <div key={member.playerId} className={`driver-card driver-${member.color ?? 'none'}`}>
                  <span className="driver-role">{member.isHost ? '房主' : '车手'}</span>
                  <strong>{member.nickname}</strong>
                  <div className="driver-meta">
                    <span>{member.color ? '已选赛车' : '未选赛车'}</span>
                    <span>{member.ready ? '已准备' : '待准备'}</span>
                  </div>
                </div>
              ) : (
                <div key={`seat-${index + 1}`} className="driver-card driver-card-empty">
                  <span className="driver-role">空位</span>
                  <strong>待加入</strong>
                  <div className="driver-meta">
                    <span>等待车手进入房间</span>
                    <span>发车后将不再补位</span>
                  </div>
                </div>
              )
            )}
          </section>
        </section>

        <section className="console-section stack">
          <section className="compact-row">
            <div>
              <span className="panel-kicker">比赛圈数</span>
              <p className="muted">{isHost ? '房主可在这里调圈数' : '等待房主调圈数'}</p>
            </div>
            <LapTargetControl
              value={room.lapTarget}
              disabled={!isHost || disabled}
              onChange={(lapTarget) => onCommand(createCommand('room.setLapTarget', player.playerId, { lapTarget }))}
            />
          </section>

          <section className="console-section-head">
            <span className="panel-kicker">选择赛车</span>
            <strong className="console-block-title">发车准备</strong>
          </section>
          <ColorPicker
            selected={current?.color ?? null}
            taken={takenColors}
            disabled={disabled}
            onSelect={(color) => onCommand(createCommand('room.chooseColor', player.playerId, { color }))}
          />

          <div className="race-actions compact-actions">
            <button type="button" className="secondary-action" disabled={disabled} onClick={() => onCommand(createCommand('room.ready', player.playerId))}>
              准备
            </button>
            {isHost ? (
              <button type="button" className="primary-action" disabled={disabled || !canStart} onClick={() => onCommand(createCommand('room.start', player.playerId))}>
                发车
              </button>
            ) : null}
            {current ? (
              <button type="button" className="secondary-action" disabled={disabled} onClick={onLeave}>
                退出房间
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
        </section>
      </div>
    </div>
  );
}
