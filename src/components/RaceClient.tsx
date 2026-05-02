'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RaceHud } from './RaceHud';
import { formatRacingError } from '@/realtime/errorMessages';
import { createMatchCommand } from '@/realtime/matchReducer';
import { useMatchSession } from '@/realtime/useMatchSession';
import { RacingRuntimeHost, type RuntimeHandle } from '@/game/RacingRuntimeHost';
import { advanceRaceProgress, buildTrackProgressModel, createInitialRaceProgressState } from '@/game/trackProgress';
import { usePlayerSession } from '@/session/usePlayerSession';

const TELEMETRY_INTERVAL_MS = 200;

/**
 * Race page binds the legacy canvas runtime to coordinator-backed match state.
 * Local physics remains browser-owned for now, while leaderboard and finish
 * state come from telemetry reported into the coordinator.
 */
export function RaceClient({ code }: { code: string }) {
  const router = useRouter();
  const { session } = usePlayerSession();
  const { room, match, connectionState, lastErrorCode, sendCommand } = useMatchSession(code, session);
  const runtimeRef = useRef<RuntimeHandle | null>(null);
  const progressRef = useRef(createInitialRaceProgressState());

  const currentPlayer = useMemo(() => {
    return match?.players.find((player) => player.playerId === session?.playerId) ?? null;
  }, [match?.players, session?.playerId]);

  const trackModel = useMemo(() => {
    return room && match ? buildTrackProgressModel(match.trackMap ?? room.trackMap) : null;
  }, [match, room]);

  useEffect(() => {
    progressRef.current = createInitialRaceProgressState();
  }, [match?.id]);

  useEffect(() => {
    if (room?.status === 'finished' || match?.phase === 'finished') {
      router.replace(`/result/${code}`);
      return;
    }

    if (room?.status === 'waiting') {
      router.replace(`/room/${code}`);
      return;
    }

    if (room?.status === 'closed') {
      router.replace('/hall');
    }
  }, [code, match?.phase, room?.status, router]);

  useEffect(() => {
    if (!session || !match || !trackModel || !runtimeRef.current || connectionState !== 'connected' || match.phase !== 'live') return;

    let cancelled = false;
    const activeTrackModel = trackModel;
    const activeMatch = match;
    const activePlayerId = session.playerId;

    async function reportProgress() {
      const runtime = runtimeRef.current;
      if (!runtime || cancelled) return;

      const telemetry = advanceRaceProgress(activeTrackModel, progressRef.current, runtime.getSnapshot(), activeMatch.lapTarget);
      progressRef.current = telemetry.state;

      if (telemetry.state.finished && telemetry.state.finishSent) {
        return;
      }

      const result = await sendCommand(createMatchCommand('match.progress', activePlayerId, telemetry.payload));
      if (!cancelled && result.ok && telemetry.payload.finished) {
        progressRef.current = {
          ...progressRef.current,
          finishSent: true
        };
      }
    }

    void reportProgress();
    const timer = window.setInterval(() => {
      void reportProgress();
    }, TELEMETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connectionState, match, sendCommand, session, trackModel]);

  if (!session || !room || !match || !currentPlayer) {
    return (
      <section className="racing-runtime">
        <div className="race-overlay race-loading-card">
          <span className="panel-kicker">赛道同步中</span>
          <strong>正在接入比赛状态...</strong>
        </div>
      </section>
    );
  }

  return (
    <RacingRuntimeHost
      roomCode={code}
      trackMap={match.trackMap}
      vehicleColor={currentPlayer.color}
      onRuntimeReady={(runtime) => {
        runtimeRef.current = runtime;
      }}
    >
      <RaceHud match={match} currentPlayerId={session.playerId} model={trackModel} />
      {lastErrorCode ? <p className="race-overlay error-banner race-error-banner">{formatRacingError(lastErrorCode)}</p> : null}
    </RacingRuntimeHost>
  );
}
