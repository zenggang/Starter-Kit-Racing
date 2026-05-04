'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRosterDensity } from './rosterLayout';
import { formatRacingError } from '@/realtime/errorMessages';
import { createMatchCommand } from '@/realtime/matchReducer';
import { useMatchSession } from '@/realtime/useMatchSession';
import { usePlayerSession } from '@/session/usePlayerSession';
import { formatRaceDuration, getPlayerRaceTimeMs } from '@/game/raceTiming';
import type { MatchPlayerState, MatchState } from '@/realtime/protocol';

/**
 * Result page stays on the same coordinator-driven match snapshot used by the
 * race page so refresh, reconnect, and host rematch all reuse one authority.
 */
export function ResultClient({ code }: { code: string }) {
  const router = useRouter();
  const { session } = usePlayerSession();
  const { room, match, connectionState, lastErrorCode, sendCommand } = useMatchSession(code, session);
  const [busy, setBusy] = useState(false);

  const sortedPlayers = useMemo(() => {
    return [...(match?.players ?? [])].sort((left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId));
  }, [match?.players]);
  const winner = useMemo(() => sortedPlayers.find((player) => player.rank === 1) ?? null, [sortedPlayers]);
  const winnerTimeMs = match && winner ? getPlayerRaceTimeMs(match, winner) : null;
  const rosterDensity = getRosterDensity(sortedPlayers.length);

  useEffect(() => {
    if (room?.status === 'racing') {
      router.replace(`/race/${room.code}`);
    }

    if (room?.status === 'waiting') {
      router.replace(`/room/${room.code}`);
    }

    /**
     * The result screen stays subscribed to room lifecycle updates so a host
     * teardown can evict every remaining racer back to the hall immediately.
     */
    if (room?.status === 'closed') {
      router.replace('/hall');
    }
  }, [room, router]);

  async function rematch() {
    if (!session) return;
    setBusy(true);

    try {
      const result = await sendCommand(createMatchCommand('room.rematch', session.playerId, {}));
      if (result.ok && result.room) {
        router.push(`/room/${result.room.code}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function returnToHall() {
    if (!session) {
      router.replace('/hall');
      return;
    }

    setBusy(true);

    try {
      /**
       * Finished-room exits must still go through the coordinator so guests are
       * removed from the roster and host exits can close the room for everyone.
       */
      const result = await sendCommand(createMatchCommand('room.leave', session.playerId, {}));
      if (result.ok) {
        router.replace('/hall');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="race-layout console-screen">
      {lastErrorCode ? <p className="error-banner">{formatRacingError(lastErrorCode)}</p> : null}

      <div className="race-panel result-console stack">
        <div className="console-topline">
          <div className="console-title-group">
            <span className="panel-kicker">终点线</span>
            <strong className="console-screen-title">
              结果 <span className="room-code-head">{code}</span>
            </strong>
            <p className="muted">连接状态：{connectionState === 'connected' ? '已连接' : '连接中'}</p>
            <p className="muted">赛道：{match?.trackName ?? room?.trackName ?? '默认赛道'}</p>
            {winnerTimeMs !== null ? <p className="muted">冠军用时：{formatRaceDuration(winnerTimeMs)}</p> : null}
          </div>
          {match?.winnerPlayerId ? <span className="status-pill">已完赛</span> : null}
        </div>

        <div className="console-section-head">
          <div>
            <span className="panel-kicker">比赛结果</span>
            <strong className="console-block-title">{match?.winnerPlayerId ? '完赛排名' : '等待完赛同步'}</strong>
          </div>
        </div>

        <section className="driver-grid result-driver-grid" data-roster-density={rosterDensity}>
          {sortedPlayers.map((player) => (
            <div key={player.playerId} className={`driver-card driver-${player.color}`}>
              <span className="driver-role">#{player.rank}</span>
              <strong>{player.nickname}</strong>
              <div className="driver-meta">
                <span>{player.completedLaps}/{match?.lapTarget ?? room?.lapTarget ?? 0} 圈</span>
                <span>{formatResultStatus(match, room?.lapTarget ?? 0, player)}</span>
              </div>
            </div>
          ))}
        </section>

        <div className="race-actions compact-actions">
          <button type="button" className="secondary-action" disabled={busy} onClick={returnToHall}>
            返回大厅
          </button>
          {session && room?.hostPlayerId === session.playerId ? (
            <button type="button" className="primary-action" disabled={busy || connectionState !== 'connected'} onClick={rematch}>
              重新发车
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function formatResultStatus(match: MatchState | null, lapTarget: number, player: MatchPlayerState): string {
  if (!match) {
    return `${player.completedLaps}/${lapTarget} 圈`;
  }

  const raceTimeMs = getPlayerRaceTimeMs(match, player);

  if (raceTimeMs !== null) {
    return `完赛用时 ${formatRaceDuration(raceTimeMs)}`;
  }

  return `未完赛 · ${player.completedLaps}/${lapTarget} 圈 · ${Math.round(player.lapProgress * 100)}%`;
}
