'use client';

import type { MatchState } from '@/realtime/protocol';
import type { TrackProgressModel } from '@/game/trackProgress';

/**
 * HUD stays in React so coordinator snapshots, leaderboard text, and minimap
 * dots can update independently from the legacy canvas renderer.
 */
export function RaceHud({
  match,
  currentPlayerId,
  model
}: {
  match: MatchState | null;
  currentPlayerId: string;
  model: TrackProgressModel | null;
}) {
  if (!match) return null;

  const orderedPlayers = [...match.players].sort((left, right) => left.rank - right.rank || left.playerId.localeCompare(right.playerId));
  const current = orderedPlayers.find((player) => player.playerId === currentPlayerId) ?? null;
  const currentLapNumber = current ? Math.min(match.lapTarget, current.completedLaps + (current.finishedAt ? 0 : 1)) : 1;
  const currentLapProgress = current ? Math.round(current.lapProgress * 100) : 0;

  return (
    <>
      <section className="race-overlay race-status-card">
        <span className="panel-kicker">当前圈数</span>
        <strong>{current ? `${current.completedLaps}/${match.lapTarget}` : `0/${match.lapTarget}`}</strong>
        <span className="muted">当前第 {currentLapNumber} 圈 · 本圈进度 {currentLapProgress}%</span>
        <span className="muted">阶段：{match.phase === 'finished' ? '已完赛' : '比赛中'}</span>
      </section>

      <section className="race-overlay race-leaderboard">
        <div className="race-leaderboard-head">
          <span className="panel-kicker">实时排行榜</span>
          <strong>{match.roomCode}</strong>
        </div>
        <div className="race-leaderboard-list">
          {orderedPlayers.map((player) => (
            <div key={player.playerId} className={`race-leaderboard-row driver-${player.color}`}>
              <span>#{player.rank}</span>
              <strong>{player.nickname}</strong>
              <span>{player.completedLaps}/{match.lapTarget} 圈 · {Math.round(player.lapProgress * 100)}%</span>
            </div>
          ))}
        </div>
      </section>

      {model ? (
        <section className="race-overlay race-minimap">
          <span className="panel-kicker">小地图</span>
          <svg viewBox="0 0 100 100" className="race-minimap-svg" aria-label="赛道小地图">
            <polyline
              points={model.points.map((point) => `${normalizeX(point.x, model)},${normalizeZ(point.z, model)}`).join(' ')}
              className="race-minimap-track"
            />
            {match.players.map((player) => (
              <circle
                key={player.playerId}
                cx={normalizeX(player.position.x, model)}
                cy={normalizeZ(player.position.z, model)}
                r={player.playerId === currentPlayerId ? 4 : 3}
                className={`race-minimap-player race-minimap-${player.color}`}
              />
            ))}
          </svg>
        </section>
      ) : null}
    </>
  );
}

function normalizeX(value: number, model: TrackProgressModel): number {
  const left = model.bounds.centerX - model.bounds.halfWidth;
  const width = model.bounds.halfWidth * 2 || 1;
  return ((value - left) / width) * 100;
}

function normalizeZ(value: number, model: TrackProgressModel): number {
  const top = model.bounds.centerZ - model.bounds.halfDepth;
  const height = model.bounds.halfDepth * 2 || 1;
  return ((value - top) / height) * 100;
}
