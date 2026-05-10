'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RoomLobbyPanel } from './RoomLobbyPanel';
import { useRoomSession } from '@/realtime/useRoomSession';
import { PLAYER_COLORS } from '@/realtime/protocol';
import { formatRacingError } from '@/realtime/errorMessages';
import { createCommand } from '@/realtime/sessionReducer';
import { usePlayerSession } from '@/session/usePlayerSession';

export function RoomClient({
  code,
  onEnterRace,
  onEnterResult,
  onExitToHall
}: {
  code: string;
  onEnterRace?(code: string): void;
  onEnterResult?(code: string): void;
  onExitToHall?(): void;
}) {
  const router = useRouter();
  const { session, rememberRoom } = usePlayerSession();
  const { snapshot, connectionState, lastErrorCode, sendCommand } = useRoomSession(code, session);
  const leavingRef = useRef(false);
  const autoColorRequestRef = useRef<string | null>(null);
  const autoReadyRequestRef = useRef<string | null>(null);
  const manualReadyCancelledRef = useRef(false);
  const currentPlayer = snapshot?.players.find((candidate) => candidate.playerId === session?.playerId) ?? null;

  useEffect(() => {
    autoReadyRequestRef.current = null;
    manualReadyCancelledRef.current = false;
  }, [code, session?.playerId]);

  useEffect(() => {
    if (!session || connectionState !== 'connected') return;
    if (leavingRef.current) return;
    rememberRoom(code);
  }, [code, connectionState, rememberRoom, session]);

  useEffect(() => {
    if (snapshot?.status === 'racing' && currentPlayer?.ready && currentPlayer?.color) {
      if (onEnterRace) {
        onEnterRace(snapshot.code);
      } else {
        router.push(`/race/${snapshot.code}`);
      }
    }

    if (snapshot?.status === 'finished' && currentPlayer) {
      if (onEnterResult) {
        onEnterResult(snapshot.code);
      } else {
        router.push(`/result/${snapshot.code}`);
      }
    }

    if (snapshot?.status === 'closed') {
      if (onExitToHall) {
        onExitToHall();
      } else {
        router.replace('/');
      }
    }
  }, [currentPlayer, onEnterRace, onEnterResult, onExitToHall, router, snapshot]);

  useEffect(() => {
    if (!session || !snapshot || !currentPlayer) return;
    if (connectionState !== 'connected' || leavingRef.current) return;
    if (snapshot.status !== 'waiting' || currentPlayer.color) {
      autoColorRequestRef.current = null;
      return;
    }

    const takenColors = snapshot.players
      .filter((candidate) => candidate.playerId !== currentPlayer.playerId)
      .map((candidate) => candidate.color)
      .filter((color): color is (typeof PLAYER_COLORS)[number] => Boolean(color));
    const nextColor = PLAYER_COLORS.find((color) => !takenColors.includes(color));
    if (!nextColor) return;

    const requestKey = `${snapshot.code}:${currentPlayer.playerId}:${nextColor}`;
    if (autoColorRequestRef.current === requestKey) {
      return;
    }

    autoColorRequestRef.current = requestKey;
    void sendCommand(createCommand('room.chooseColor', session.playerId, { color: nextColor })).then((result) => {
      if (!result.ok) {
        autoColorRequestRef.current = null;
      }
    });
  }, [connectionState, currentPlayer, sendCommand, session, snapshot]);

  useEffect(() => {
    if (!session || !snapshot || !currentPlayer) return;
    if (connectionState !== 'connected' || leavingRef.current) return;

    if (snapshot.status !== 'waiting' || currentPlayer.ready) {
      autoReadyRequestRef.current = null;
      return;
    }

    if (manualReadyCancelledRef.current) {
      return;
    }

    /**
     * Ready depends on a chosen vehicle color because the coordinator requires
     * every starting player to be both ready and color-assigned. Auto color
     * selection is asynchronous, so this waits for the authoritative snapshot
     * to show a color before sending the ready command.
     */
    if (!currentPlayer.color) {
      autoReadyRequestRef.current = null;
      return;
    }

    const requestKey = `${snapshot.code}:${currentPlayer.playerId}:ready`;
    if (autoReadyRequestRef.current === requestKey) {
      return;
    }

    autoReadyRequestRef.current = requestKey;
    void sendCommand(createCommand('room.ready', session.playerId, { ready: true })).then((result) => {
      if (!result.ok) {
        autoReadyRequestRef.current = null;
      }
    });
  }, [connectionState, currentPlayer, sendCommand, session, snapshot]);

  async function handleLeaveRoom() {
    if (!session) return;
    leavingRef.current = true;

    /**
     * Leaving the lobby is an explicit user action, so the UI waits for the
     * authoritative coordinator result before returning to the hall. This
     * avoids leaving the page while the room state is still unresolved.
     */
    const result = await sendCommand(createCommand('room.leave', session.playerId));
    if (result.ok) {
      if (onExitToHall) {
        onExitToHall();
      } else {
        router.replace('/');
      }
      return;
    }

    leavingRef.current = false;
  }

  function handleRoomCommand(command: ReturnType<typeof createCommand>) {
    if (command.type === 'room.ready') {
      const ready = (command.payload as { ready?: boolean } | undefined)?.ready ?? true;
      manualReadyCancelledRef.current = ready === false;
    }

    void sendCommand(command);
  }

  return (
    <section className="race-layout console-screen room-lobby-screen">
      {lastErrorCode ? <p className="error-banner">{formatRacingError(lastErrorCode)}</p> : null}
      <RoomLobbyPanel
        room={snapshot}
        player={session}
        roomCode={code}
        connectionState={connectionState}
        disabled={connectionState !== 'connected'}
        onCommand={handleRoomCommand}
        onLeave={handleLeaveRoom}
        onEnterRace={onEnterRace}
      />
    </section>
  );
}
