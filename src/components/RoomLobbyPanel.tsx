'use client';

import React from 'react';
import Link from 'next/link';
import { ColorPicker, PLAYER_COLOR_HEX, PLAYER_COLOR_LABELS } from './ColorPicker';
import { LapTargetControl } from './LapTargetControl';
import { createLobbySeatSlots, getRosterDensity } from './rosterLayout';
import type { PlayerColor, RoomState } from '@/realtime/protocol';
import { createCommand } from '@/realtime/sessionReducer';
import type { PlayerSession } from '@/session/playerSession';
import { buildTrackProgressModel, type TrackProgressModel } from '@/game/trackProgress';

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
  const everyPlayerReady = Boolean(room?.players.every((candidate) => candidate.ready && candidate.color));
  const canStart = Boolean(isHost && current?.ready && current?.color && everyPlayerReady);
  const seatSlots = room ? createLobbySeatSlots(room.players) : [];
  const rosterDensity = getRosterDensity(room?.players.length ?? 0, { reserveCapacity: true });
  const roomTrackMap = room?.trackMap ?? null;
  const trackModel = React.useMemo(() => buildTrackProgressModel(roomTrackMap), [roomTrackMap]);
  const trackPreview = React.useMemo(() => (trackModel ? createRoomTrackPreview(trackModel) : null), [trackModel]);

  if (!room || !player) {
    return <p className="loading-copy">正在连接房间数据...</p>;
  }

  return (
    <div className="race-panel lobby-console stack">
      <div className="console-topline room-console-topline">
        <div className="console-title-group">
          <div className="room-console-title-row">
            <strong className="console-screen-title room-console-screen-title">
              房间 <span className="room-code-head">{roomCode}</span>
            </strong>
            <span className="status-pill">{room.status === 'waiting' ? '等待中' : '比赛中'}</span>
          </div>
          <p className="muted">{connectionState === 'connected' ? '已连接' : '连接中'} · {room.trackName ?? '默认赛道'}</p>
        </div>
      </div>

      <div className="room-console-grid room-lobby-layout">
        <section className="console-section stack room-lobby-main">
          <div className="room-roster-head">
            <div className="console-section-head">
              <span className="panel-kicker">车手席</span>
              <strong className="console-block-title">4 个发车位</strong>
            </div>
            <ColorPicker
              selected={current?.color ?? null}
              taken={takenColors}
              disabled={disabled}
              compact
              label="车身颜色"
              onSelect={(color) => onCommand(createCommand('room.chooseColor', player.playerId, { color }))}
            />
          </div>
          <section className="driver-grid room-driver-grid" data-roster-density={rosterDensity}>
            {seatSlots.map((member, index) =>
              member ? (
                <div key={member.playerId} className={`driver-card driver-${member.color ?? 'none'}`}>
                  <div className="driver-card-topline">
                    <span className="driver-role">{member.isHost ? '房主' : '车手'}</span>
                    {member.color ? (
                      <span
                        className="driver-color-chip"
                        aria-label={PLAYER_COLOR_LABELS[member.color]}
                        style={{ backgroundColor: PLAYER_COLOR_HEX[member.color] }}
                      />
                    ) : null}
                  </div>
                  <strong>{member.nickname}</strong>
                  <div className="driver-meta">
                    <span>{member.ready ? '已准备' : '待准备'}</span>
                  </div>
                </div>
              ) : (
                <div key={`seat-${index + 1}`} className="driver-card driver-card-empty">
                  <span className="driver-role">空位</span>
                  <strong>待加入</strong>
                  <div className="driver-meta">
                    <span>等待车手进入房间</span>
                  </div>
                </div>
              )
            )}
          </section>
        </section>

        <aside className="room-lobby-sidebar stack">
          <section className="console-section stack room-actions-panel">
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
                  退出
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
          </section>

          <section className="console-section compact-row room-lap-panel">
            <span className="panel-kicker">比赛圈数</span>
            <LapTargetControl
              value={room.lapTarget}
              disabled={!isHost || disabled}
              compact
              onChange={(lapTarget) => onCommand(createCommand('room.setLapTarget', player.playerId, { lapTarget }))}
            />
          </section>

          <section className="console-section stack room-track-preview">
            <div className="compact-row room-track-preview-head">
              <div className="console-section-head room-track-preview-title">
                <span className="panel-kicker">赛道预览</span>
              </div>
            </div>
            {trackPreview ? (
              <svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMin meet" className="room-track-preview-svg" aria-label="房间赛道预览">
                <polyline
                  points={trackPreview.points}
                  className="room-track-preview-line"
                />
                <circle
                  cx={trackPreview.startX}
                  cy={trackPreview.startY}
                  r="3.25"
                  className="room-track-preview-start"
                />
              </svg>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * 等待页预览不需要继承比赛页那套“给车点和 HUD 留安全边”的缩放。
 * 这里直接按赛道中心线的真实包围盒去 fit 到预览框里，尽量吃满底部面板。
 */
function createRoomTrackPreview(model: TrackProgressModel) {
  const viewportWidth = 100;
  const viewportHeight = 64;
  const paddingX = 10;
  const topPadding = 1;
  const bottomPadding = 16;
  const xs = model.points.map((point) => point.x);
  const zs = model.points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const trackWidth = Math.max(1, maxX - minX);
  const trackHeight = Math.max(1, maxZ - minZ);
  const baseScale = Math.min((viewportWidth - paddingX * 2) / trackWidth, (viewportHeight - topPadding - bottomPadding) / trackHeight);
  const scale = baseScale * 0.8;
  const renderWidth = trackWidth * scale;
  const offsetX = (viewportWidth - renderWidth) / 2;
  const offsetY = topPadding;

  function project(point: { x: number; z: number }) {
    return {
      x: (point.x - minX) * scale + offsetX,
      y: (point.z - minZ) * scale + offsetY
    };
  }

  const start = project(model.finishLine.point);

  return {
    points: model.points
      .map((point) => {
        const projected = project(point);
        return `${projected.x},${projected.y}`;
      })
      .join(' '),
    startX: start.x,
    startY: start.y
  };
}
