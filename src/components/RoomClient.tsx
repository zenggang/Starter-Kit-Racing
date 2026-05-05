'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RoomLobbyPanel } from './RoomLobbyPanel';
import { useRoomSession } from '@/realtime/useRoomSession';
import { PLAYER_COLORS } from '@/realtime/protocol';
import { formatRacingError } from '@/realtime/errorMessages';
import { createCommand } from '@/realtime/sessionReducer';
import { usePlayerSession } from '@/session/usePlayerSession';

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { session, rememberRoom } = usePlayerSession();
  const { snapshot, connectionState, lastErrorCode, sendCommand } = useRoomSession(code, session);
  const joinedRef = useRef(false);
  const leavingRef = useRef(false);
  const autoColorRequestRef = useRef<string | null>(null);
  const currentPlayer = snapshot?.players.find((candidate) => candidate.playerId === session?.playerId) ?? null;

  useEffect(() => {
    if (!session || connectionState !== 'connected') return;
    if (leavingRef.current) return;
    if (joinedRef.current && currentPlayer) return;
    joinedRef.current = true;
    rememberRoom(code);
    void sendCommand(createCommand('room.join', session.playerId));
  }, [code, connectionState, currentPlayer, rememberRoom, sendCommand, session]);

  useEffect(() => {
    if (snapshot?.status === 'racing' && currentPlayer?.ready && currentPlayer?.color) {
      router.push(`/race/${snapshot.code}`);
    }

    if (snapshot?.status === 'finished' && currentPlayer) {
      router.push(`/result/${snapshot.code}`);
    }

    if (snapshot?.status === 'closed') {
      router.replace('/');
    }
  }, [currentPlayer, router, snapshot]);

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
      router.replace('/');
      return;
    }

    leavingRef.current = false;
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
        onCommand={sendCommand}
        onLeave={handleLeaveRoom}
      />
    </section>
  );
}
