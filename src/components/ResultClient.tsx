'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRacingError } from '@/realtime/errorMessages';
import { createMatchCommand } from '@/realtime/matchReducer';
import { useMatchSession } from '@/realtime/useMatchSession';
import { usePlayerSession } from '@/session/usePlayerSession';

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

  useEffect(() => {
    if (room?.status === 'racing') {
      router.replace(`/race/${room.code}`);
    }

    if (room?.status === 'waiting') {
      router.replace(`/room/${room.code}`);
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

  return (
    <section className="race-layout">
      <div className="race-page-head">
        <p className="eyebrow">终点线</p>
        <h1>结果 {code}</h1>
        <p className="muted">连接状态：{connectionState === 'connected' ? '已连接' : '连接中'}</p>
      </div>
      {lastErrorCode ? <p className="error-banner">{formatRacingError(lastErrorCode)}</p> : null}

      <div className="race-panel stack">
        <div className="lobby-topline">
          <div>
            <span className="panel-kicker">比赛结果</span>
            <h2>{match?.winnerPlayerId ? '完赛排名' : '等待完赛同步'}</h2>
          </div>
          {match?.winnerPlayerId ? <span className="status-pill">已完赛</span> : null}
        </div>

        <section className="driver-grid">
          {sortedPlayers.map((player) => (
            <div key={player.playerId} className={`driver-card driver-${player.color}`}>
              <span className="driver-role">#{player.rank}</span>
              <strong>{player.nickname}</strong>
              <span>{player.completedLaps}/{match?.lapTarget ?? room?.lapTarget ?? 0} 圈</span>
              <span>{player.finishedAt ? '已完赛' : '未完赛'}</span>
            </div>
          ))}
        </section>

        <div className="race-actions">
          <button type="button" className="secondary-action" onClick={() => router.push('/hall')}>
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
