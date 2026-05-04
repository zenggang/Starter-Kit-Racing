'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RoomLobbyPanel } from './RoomLobbyPanel';
import { useRoomSession } from '@/realtime/useRoomSession';
import { formatRacingError } from '@/realtime/errorMessages';
import { createCommand } from '@/realtime/sessionReducer';
import { usePlayerSession } from '@/session/usePlayerSession';

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { session, rememberRoom } = usePlayerSession();
  const { snapshot, connectionState, lastErrorCode, sendCommand } = useRoomSession(code, session);
  const joinedRef = useRef(false);
  const leavingRef = useRef(false);
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
    <section className="race-layout console-screen">
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
