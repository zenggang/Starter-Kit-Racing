'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RacingRuntimeHost, type RuntimeHandle } from '@/game/RacingRuntimeHost';
import { RaceHud } from './RaceHud';
import { advanceRaceProgress, buildTrackProgressModel, createInitialRaceProgressState } from '@/game/trackProgress';
import type { MatchState } from '@/realtime/protocol';

const DEMO_LAP_TARGET = 1;
const TELEMETRY_INTERVAL_MS = 200;

/**
 * Local telemetry harness for debugging the race-data pipeline without any
 * coordinator or Supabase dependency. It reuses the same runtime snapshot and
 * track-progress code as online mode, so a local pass here is meaningful.
 */
export function LocalRaceTelemetryClient() {
  const runtimeRef = useRef<RuntimeHandle | null>(null);
  const progressRef = useRef(createInitialRaceProgressState());
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [match, setMatch] = useState<MatchState>(() => ({
    id: 'local-demo-match',
    roomCode: 'DEMO',
    phase: 'live',
    lapTarget: DEMO_LAP_TARGET,
    trackMap: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    winnerPlayerId: null,
    players: [
      {
        playerId: 'local-player',
        nickname: 'LocalRacer',
        color: 'yellow',
        isHost: true,
        presence: 'connected',
        rank: 1,
        position: { x: 0, y: 0.5, z: 0 },
        heading: 0,
        speed: 0,
        checkpoint: 0,
        completedLaps: 0,
        lapProgress: 0,
        totalProgress: 0,
        lastReportAt: null,
        finishedAt: null
      }
    ]
  }));
  const handleRuntimeReady = useCallback((runtime: RuntimeHandle | null) => {
    runtimeRef.current = runtime;
    setRuntimeReady(Boolean(runtime));
  }, []);

  const trackModel = useMemo(() => buildTrackProgressModel(null), []);

  useEffect(() => {
    if (!runtimeReady) return;

    let cancelled = false;

    function tick() {
      const runtime = runtimeRef.current;
      if (!runtime || cancelled) return;

      const telemetry = advanceRaceProgress(trackModel, progressRef.current, runtime.getSnapshot(), DEMO_LAP_TARGET);
      progressRef.current = telemetry.state;

      setMatch((current) => {
        const player = current.players[0];
        const finishedAt = telemetry.payload.finished && !player.finishedAt ? new Date().toISOString() : player.finishedAt;

        return {
          ...current,
          phase: telemetry.payload.finished ? 'finished' : 'live',
          finishedAt,
          winnerPlayerId: telemetry.payload.finished ? player.playerId : current.winnerPlayerId,
          players: [
            {
              ...player,
              position: telemetry.payload.position,
              heading: telemetry.payload.heading,
              speed: telemetry.payload.speed,
              checkpoint: telemetry.payload.checkpoint,
              completedLaps: telemetry.payload.completedLaps,
              lapProgress: telemetry.payload.lapProgress,
              totalProgress: telemetry.payload.completedLaps + telemetry.payload.lapProgress,
              lastReportAt: new Date().toISOString(),
              finishedAt,
              presence: telemetry.payload.finished ? 'finished' : 'connected'
            }
          ]
        };
      });
    }

    tick();
    const timer = window.setInterval(tick, TELEMETRY_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [runtimeReady, trackModel]);

  return (
    <RacingRuntimeHost roomCode="DEMO" trackMap={null} vehicleColor="yellow" onRuntimeReady={handleRuntimeReady}>
      <RaceHud match={match} currentPlayerId="local-player" model={trackModel} />
    </RacingRuntimeHost>
  );
}
