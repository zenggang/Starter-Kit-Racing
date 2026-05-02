'use client';

import { useEffect, useRef } from 'react';
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
  const currentPlayer = snapshot?.players.find((candidate) => candidate.playerId === session?.playerId) ?? null;

  useEffect(() => {
    if (!session || connectionState !== 'connected') return;
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
  }, [currentPlayer, router, snapshot]);

  return (
    <section className="race-layout console-screen">
      {lastErrorCode ? <p className="error-banner">{formatRacingError(lastErrorCode)}</p> : null}
      <RoomLobbyPanel room={snapshot} player={session} roomCode={code} connectionState={connectionState} disabled={connectionState !== 'connected'} onCommand={sendCommand} />
    </section>
  );
}
