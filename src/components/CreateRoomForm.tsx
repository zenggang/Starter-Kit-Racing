'use client';

import React from 'react';
import Link from 'next/link';
import type { RacingTrackSummary } from '@/server/tracks';
import type { PlayerSession } from '@/session/playerSession';

export function CreateRoomForm({
  player,
  tracks,
  selectedTrackId,
  disabled,
  onSelectTrack,
  onCreate,
  onOpenTrackEditor
}: {
  player: PlayerSession | null;
  tracks: RacingTrackSummary[];
  selectedTrackId: string | null;
  disabled?: boolean;
  onSelectTrack(trackId: string | null): void;
  onCreate(): void;
  onOpenTrackEditor?(): void;
}) {
  const selectedTrack = selectedTrackId ? tracks.find((track) => track.id === selectedTrackId) ?? null : null;

  return (
    <div className="console-action-card stack">
      <div className="console-section-head">
        <span className="panel-kicker">新比赛</span>
        <strong className="console-block-title">创建房间</strong>
      </div>
      <p className="muted">选择赛道后立即生成 4 位数字房间码。</p>
      <label className="field">
        <span>比赛赛道</span>
        <select className="input" value={selectedTrackId ?? ''} disabled={disabled} onChange={(event) => onSelectTrack(event.target.value || null)}>
          <option value="">默认赛道</option>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
            </option>
          ))}
        </select>
      </label>
      <div className="track-picker-helper">
        <p className="muted">{selectedTrack ? `${selectedTrack.cellCount} 个路块 · 自定义赛道` : '使用内置默认赛道'}</p>
        {onOpenTrackEditor ? (
          <button type="button" className="secondary-action track-editor-entry" onClick={onOpenTrackEditor}>
            创建/管理赛道
          </button>
        ) : (
          <Link href="/track-editor" className="secondary-action track-editor-entry">
            创建/管理赛道
          </Link>
        )}
      </div>
      <button
        type="button"
        className="primary-action console-button"
        disabled={!player || disabled}
        onClick={() => player && onCreate()}
      >
        创建房间
      </button>
    </div>
  );
}
