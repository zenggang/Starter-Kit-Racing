'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RaceHud } from './RaceHud';
import { formatRacingError } from '@/realtime/errorMessages';
import { createMatchCommand } from '@/realtime/matchReducer';
import { useMatchSession } from '@/realtime/useMatchSession';
import { RacingRuntimeHost, type RemoteVehicleTelemetry, type RuntimeHandle } from '@/game/RacingRuntimeHost';
import { advanceRaceProgress, buildTrackProgressModel, createInitialRaceProgressState } from '@/game/trackProgress';
import { getRaceTelemetryIntervalMs } from '@/game/telemetryPolicy';
import { usePlayerSession } from '@/session/usePlayerSession';

/**
 * Race page binds the legacy canvas runtime to coordinator-backed match state.
 * Local physics remains browser-owned for now, while leaderboard and finish
 * state come from telemetry reported into the coordinator.
 */
export function RaceClient({ code }: { code: string }) {
  const router = useRouter();
  const { session } = usePlayerSession();
  const { room, match, transportMode, connectionState, lastErrorCode, sendCommand } = useMatchSession(code, session);
  const runtimeRef = useRef<RuntimeHandle | null>(null);
  const progressRef = useRef(createInitialRaceProgressState());
  const telemetryInFlightRef = useRef(false);
  const connectionStateRef = useRef(connectionState);
  const sendCommandRef = useRef(sendCommand);
  const trackModelRef = useRef<ReturnType<typeof buildTrackProgressModel> | null>(null);
  const playerIdRef = useRef<string | null>(session?.playerId ?? null);
  const lapTargetRef = useRef<number | null>(match?.lapTarget ?? null);
  const matchPhaseRef = useRef(match?.phase ?? null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const handleRuntimeReady = useCallback((runtime: RuntimeHandle | null) => {
    runtimeRef.current = runtime;
    setRuntimeReady(Boolean(runtime));
  }, []);

  const currentPlayer = useMemo(() => {
    return match?.players.find((player) => player.playerId === session?.playerId) ?? null;
  }, [match?.players, session?.playerId]);

  const remoteVehicles = useMemo<RemoteVehicleTelemetry[]>(() => {
    return (
      match?.players
        .filter((player) => player.playerId !== session?.playerId)
        .map((player) => ({
          playerId: player.playerId,
          nickname: player.nickname,
          color: player.color,
          presence: player.presence,
          position: player.position,
          heading: player.heading,
          speed: player.speed,
          lastReportAt: player.lastReportAt
        })) ?? []
    );
  }, [match?.players, session?.playerId]);

  const effectiveMatch = useMemo(() => {
    if (!room || !match) return null;

    return {
      ...match,
      trackName: match.trackName ?? room.trackName,
      trackMap: match.trackMap ?? room.trackMap
    };
  }, [match, room]);

  const trackModel = useMemo(() => {
    return effectiveMatch ? buildTrackProgressModel(effectiveMatch.trackMap) : null;
  }, [effectiveMatch]);
  const telemetryIntervalMs = useMemo(() => getRaceTelemetryIntervalMs(transportMode ?? null), [transportMode]);

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  useEffect(() => {
    trackModelRef.current = trackModel;
  }, [trackModel]);

  useEffect(() => {
    playerIdRef.current = session?.playerId ?? null;
  }, [session?.playerId]);

  useEffect(() => {
    lapTargetRef.current = match?.lapTarget ?? null;
    matchPhaseRef.current = match?.phase ?? null;
  }, [match?.lapTarget, match?.phase]);

  useEffect(() => {
    progressRef.current = createInitialRaceProgressState();
    telemetryInFlightRef.current = false;
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
    if (!runtimeReady || !match?.id) return;

    let cancelled = false;

    async function reportProgress() {
      const runtime = runtimeRef.current;
      const activeTrackModel = trackModelRef.current;
      const activePlayerId = playerIdRef.current;
      const lapTarget = lapTargetRef.current;

      if (
        !runtime ||
        cancelled ||
        telemetryInFlightRef.current ||
        !activeTrackModel ||
        !activePlayerId ||
        lapTarget === null ||
        connectionStateRef.current !== 'connected' ||
        matchPhaseRef.current !== 'live'
      ) {
        return;
      }

      telemetryInFlightRef.current = true;
      const telemetry = advanceRaceProgress(activeTrackModel, progressRef.current, runtime.getSnapshot(), lapTarget);
      progressRef.current = telemetry.state;

      if (telemetry.state.finished && telemetry.state.finishSent) {
        telemetryInFlightRef.current = false;
        return;
      }

      try {
        const result = await sendCommandRef.current(createMatchCommand('match.progress', activePlayerId, telemetry.payload));
        if (!cancelled && result.ok && telemetry.payload.finished) {
          progressRef.current = {
            ...progressRef.current,
            finishSent: true
          };
        }
      } finally {
        telemetryInFlightRef.current = false;
      }
    }

    void reportProgress();
    const timer = window.setInterval(() => {
      void reportProgress();
    }, telemetryIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [match?.id, runtimeReady, telemetryIntervalMs]);

  if (!session || !room || !match || !effectiveMatch || !currentPlayer) {
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
      trackMap={effectiveMatch.trackMap}
      vehicleColor={currentPlayer.color}
      remoteVehicles={remoteVehicles}
      onRuntimeReady={handleRuntimeReady}
    >
      <RaceHud match={effectiveMatch} currentPlayerId={session.playerId} model={trackModel} />
      {lastErrorCode ? <p className="race-overlay error-banner race-error-banner">{formatRacingError(lastErrorCode)}</p> : null}
    </RacingRuntimeHost>
  );
}
